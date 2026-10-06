mod simulation;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use simulation::{Input, ReferenceGeometry, World};
static REFERENCE: std::sync::OnceLock<ReferenceGeometry> = std::sync::OnceLock::new();
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::{broadcast, Mutex};
struct Room {
    world: World,
    inputs: BTreeMap<u64, Input>,
    tx: broadcast::Sender<String>,
    last: Instant,
    owner: Option<u64>,
    events: Vec<simulation::Event>,
}
type Rooms = Arc<Mutex<BTreeMap<String, Room>>>;
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
#[derive(Deserialize)]
struct RoomQuery {
    room: Option<String>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Client {
    Input {
        #[serde(flatten)]
        input: Input,
    },
    Start {
        weapon: u8,
    },
    Next,
}
async fn upgrade(
    ws: WebSocketUpgrade,
    Query(q): Query<RoomQuery>,
    State(rooms): State<Rooms>,
) -> impl IntoResponse {
    let name = q.room.unwrap_or_else(|| "campfire".into());
    let name: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(40)
        .collect();
    ws.max_message_size(1024)
        .max_frame_size(1024)
        .on_upgrade(move |socket| session(socket, rooms, name))
}
async fn session(socket: WebSocket, rooms: Rooms, name: String) {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let mut rx = {
        let mut map = rooms.lock().await;
        if !map.contains_key(&name) && map.len() >= 128 {
            return;
        }
        let room = map.entry(name.clone()).or_insert_with(|| {
            let (tx, _) = broadcast::channel(8);
            Room {
                world: {
                    let mut world = World::new();
                    if let Some(reference) = REFERENCE.get() {
                        world.use_reference_geometry(reference.clone());
                    }
                    world
                },
                inputs: BTreeMap::new(),
                tx,
                last: Instant::now(),
                owner: None,
                events: Vec::new(),
            }
        });
        if room.inputs.len() >= 4 {
            return;
        }
        room.world.add_player(id);
        room.inputs.insert(id, Input::default());
        room.owner = room.owner.or(Some(id));
        room.last = Instant::now();
        room.tx.subscribe()
    };
    let (mut sender, mut receiver) = socket.split();
    if sender
        .send(Message::Text(
            serde_json::json!({"type":"welcome","id":id})
                .to_string()
                .into(),
        ))
        .await
        .is_err()
    {
        cleanup(&rooms, &name, id).await;
        return;
    }
    let mut budget = 0u32;
    let mut window = Instant::now();
    loop {
        tokio::select! {msg=receiver.next()=>{match msg{Some(Ok(Message::Text(text)))=>{if window.elapsed()>Duration::from_secs(1){window=Instant::now();budget=0}budget+=1;if budget>120{break}if let Ok(message)=serde_json::from_str::<Client>(&text){let mut map=rooms.lock().await;let Some(room)=map.get_mut(&name)else{break};room.last=Instant::now();match message{Client::Input{input} if input.valid()=>{room.inputs.insert(id,input);},Client::Start{weapon}if room.owner==Some(id)&&matches!(room.world.snapshot().phase.as_str(),"lobby"|"defeat")=>room.world.start(weapon.min(2)),Client::Next if room.owner==Some(id)=>room.world.next(),_=>{}}}},Some(Ok(Message::Close(_)))|None|Some(Err(_))=>break,_=>{}}},data=rx.recv()=>{match data{Ok(text)=>{if sender.send(Message::Text(text.into())).await.is_err(){break}},Err(broadcast::error::RecvError::Lagged(_))=>continue,Err(_)=>break}}}
    }
    cleanup(&rooms, &name, id).await;
}
async fn cleanup(rooms: &Rooms, name: &str, id: u64) {
    let mut map = rooms.lock().await;
    if let Some(room) = map.get_mut(name) {
        room.world.remove_player(id);
        room.inputs.remove(&id);
        if room.owner == Some(id) {
            room.owner = room.inputs.keys().next().copied()
        }
        room.last = Instant::now();
    }
}
#[tokio::main]
async fn main() {
    let geometry =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("web/reference-assets/world.bin");
    if geometry.exists() {
        let bytes = std::fs::read(&geometry).expect("read reference collision geometry");
        let reference =
            ReferenceGeometry::from_bytes(&bytes).expect("parse reference collision geometry");
        let _ = REFERENCE.set(reference);
        println!("Loaded recovered world collision geometry");
    }

    let rooms: Rooms = Arc::new(Mutex::new(BTreeMap::new()));
    let tick_rooms = rooms.clone();
    tokio::spawn(async move {
        let mut timer = tokio::time::interval(Duration::from_secs_f64(1. / 60.));
        timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut tick = 0u32;
        loop {
            timer.tick().await;
            let mut map = tick_rooms.lock().await;
            map.retain(|_, r| !(r.inputs.is_empty() && r.last.elapsed() > Duration::from_secs(60)));
            for room in map.values_mut() {
                room.world.step(1. / 60., &room.inputs);
                let mut snapshot = room.world.snapshot();
                room.events.append(&mut snapshot.events);
                if tick % 3 == 0 {
                    snapshot.events = std::mem::take(&mut room.events);
                    let mut value = serde_json::to_value(snapshot).unwrap();
                    value["type"] = "snapshot".into();
                    let _ = room.tx.send(value.to_string());
                }
            }
            tick = tick.wrapping_add(1);
        }
    });
    let assets = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("web");
    let app = Router::new()
        .route("/ws", get(upgrade))
        .fallback_service(tower_http::services::ServeDir::new(assets))
        .with_state(rooms);
    let address = std::env::var("VEIL_BIND").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .expect("bind server address");
    println!("Dark Veil: http://{address}");
    axum::serve(listener, app).await.unwrap();
}
