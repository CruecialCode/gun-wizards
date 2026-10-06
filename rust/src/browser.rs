use crate::{
    renderer::Renderer,
    scene,
    simulation::{Input, Snapshot, World},
};
use glam::{Mat4, Quat, Vec3};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct Game {
    renderer: Renderer,
    world: World,
    snapshot: Snapshot,
    previous_snapshot: Option<Snapshot>,
    snapshot_age: f32,
    snapshot_interval: f32,
    smoothed_eye: Option<Vec3>,
    player: u64,
    online: bool,
    mode: u8,
    time: f32,
    accum: f32,
    pending: Input,
    recoil: f32,
    impacts: Vec<(Vec3, f32)>,
    reference_camera: Option<Vec3>,
    reference_skeleton: Option<(scene::Mesh, serde_json::Value)>,
    reference_weapon: Option<scene::Mesh>,
}
#[wasm_bindgen]
pub async fn create_game(id: &str) -> Result<Game, JsValue> {
    console_error_panic_hook::set_once();
    let canvas = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.get_element_by_id(id))
        .ok_or_else(|| JsValue::from_str("Canvas missing"))?
        .dyn_into::<web_sys::HtmlCanvasElement>()?;
    let renderer = Renderer::new(canvas)
        .await
        .map_err(|e| JsValue::from_str(&e))?;
    let mut world = World::new();
    world.add_player(1);
    let snapshot = world.snapshot();
    Ok(Game {
        renderer,
        world,
        snapshot,
        previous_snapshot: None,
        snapshot_age: 0.,
        snapshot_interval: 0.05,
        smoothed_eye: None,
        player: 1,
        online: false,
        mode: 0,
        time: 0.,
        accum: 0.,
        pending: Input::default(),
        recoil: 0.,
        impacts: vec![],
        reference_camera: None,
        reference_skeleton: None,
        reference_weapon: None,
    })
}
#[wasm_bindgen]
impl Game {
    pub fn load_reference(
        &mut self,
        vertices: &[u8],
        atlas: &[u8],
        width: u32,
        height: u32,
        metadata: &str,
    ) -> Result<(), JsValue> {
        self.world
            .set_reference_geometry(vertices)
            .map_err(|e| JsValue::from_str(&e))?;
        self.renderer
            .load_reference(vertices, atlas, width, height)
            .map_err(|e| JsValue::from_str(&e))?;
        let meta: serde_json::Value =
            serde_json::from_str(metadata).map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(c) = meta["camera_time"].as_array() {
            self.reference_camera = Some(Vec3::new(
                c[0].as_f64().unwrap_or(0.) as f32,
                c[1].as_f64().unwrap_or(2.) as f32,
                c[2].as_f64().unwrap_or(7.) as f32,
            ));
        }
        self.renderer.lights = [[0.; 4]; 48];
        self.renderer.light_colors = [[0.; 4]; 48];
        if let Some(lights) = meta["lights"].as_array() {
            for (i, l) in lights.iter().take(12).enumerate() {
                for j in 0..4 {
                    self.renderer.lights[i][j] =
                        l["position_radius"][j].as_f64().unwrap_or(0.) as f32;
                    self.renderer.light_colors[i][j] =
                        l["color_intensity"][j].as_f64().unwrap_or(0.) as f32;
                }
            }
        }
        Ok(())
    }
    pub fn load_skeleton(&mut self, vertices: &[u8], metadata: &str) -> Result<(), JsValue> {
        let data: Vec<scene::Vertex> = vertices
            .chunks_exact(std::mem::size_of::<scene::Vertex>())
            .map(bytemuck::pod_read_unaligned)
            .collect();
        let meta = serde_json::from_str(metadata).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.reference_skeleton = Some((scene::Mesh { vertices: data }, meta));
        Ok(())
    }
    pub fn load_weapon(&mut self, vertices: &[u8]) {
        self.reference_weapon = Some(scene::Mesh {
            vertices: vertices
                .chunks_exact(std::mem::size_of::<scene::Vertex>())
                .map(bytemuck::pod_read_unaligned)
                .collect(),
        });
    }
    pub fn resize(&mut self, w: u32, h: u32) {
        self.renderer.resize(w, h)
    }
    pub fn set_mode(&mut self, mode: u8) {
        self.mode = mode;
        self.smoothed_eye = None;
        self.previous_snapshot = None;
        self.accum = 0.;
        self.pending = Input::default();
    }
    pub fn set_player(&mut self, id: f64) {
        self.player = id as u64;
        self.smoothed_eye = None;
    }
    pub fn set_online(&mut self, online: bool) {
        self.online = online;
        self.previous_snapshot = None;
        self.smoothed_eye = None;
    }
    pub fn start(&mut self, weapon: u8) {
        self.world.start(weapon);
        self.snapshot = self.world.snapshot();
        self.mode = 1;
        self.recoil = 0.;
        self.previous_snapshot = None;
        self.smoothed_eye = None;
    }
    pub fn next_round(&mut self) {
        self.world.next();
        self.snapshot = self.world.snapshot();
    }
    pub fn set_snapshot(&mut self, json: &str) -> Result<(), JsValue> {
        let s: Snapshot =
            serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        // Shot events have no actor ID. Only this player's ammo can authorize
        // local recoil; a nearby partner firing must never move our weapon.
        if self.online {
            if local_ammo_spent(&self.snapshot, &s, self.player) {
                self.recoil = 1.;
            }
            let interval = s.time - self.snapshot.time;
            if interval > 0. && interval < 0.5 && self.snapshot.phase == s.phase {
                self.snapshot_interval = interval.clamp(0.025, 0.15);
                self.previous_snapshot = Some(self.snapshot.clone());
            } else {
                self.previous_snapshot = None;
                self.smoothed_eye = None;
            }
            self.snapshot_age = 0.;
        }
        self.events(&s);
        self.snapshot = s;
        Ok(())
    }
    fn events(&mut self, s: &Snapshot) {
        for e in &s.events {
            if e.kind == "shot" && !self.online {
                self.recoil = 1.;
            }
            if e.kind == "hit" {
                self.impacts.push((e.pos.into(), 0.24));
            }
        }
    }
    #[allow(clippy::too_many_arguments)]
    pub fn frame(
        &mut self,
        dt: f32,
        mx: f32,
        mz: f32,
        yaw: f32,
        pitch: f32,
        fire: bool,
        melee: bool,
        spell: bool,
        dodge: bool,
        jump: bool,
        reload: bool,
    ) -> Result<String, JsValue> {
        let dt = dt.clamp(0., 0.05);
        self.time += dt;
        self.snapshot_age += dt;
        self.recoil = (self.recoil - dt * 6.).max(0.);
        let mut events = vec![];
        if self.mode == 1 && !self.online {
            self.pending.mx = mx;
            self.pending.mz = mz;
            self.pending.yaw = yaw;
            self.pending.pitch = pitch;
            self.pending.fire |= fire;
            self.pending.melee |= melee;
            self.pending.spell |= spell;
            self.pending.dodge |= dodge;
            self.pending.jump |= jump;
            self.pending.reload |= reload;
            self.accum += dt;
            while self.accum >= 1. / 60. {
                self.world
                    .step(1. / 60., &BTreeMap::from([(1, self.pending)]));
                let s = self.world.snapshot();
                self.events(&s);
                events.extend(s.events);
                self.pending.fire = false;
                self.pending.melee = false;
                self.pending.spell = false;
                self.pending.dodge = false;
                self.pending.jump = false;
                self.pending.reload = false;
                self.accum -= 1. / 60.;
            }
            self.snapshot = self.world.snapshot();
            self.snapshot.events = events;
        }
        let mut mesh = scene::effects_at(self.time, &self.renderer.lights);
        let (eye, yaw, pitch) = if self.mode == 0 {
            for (i, p) in [
                [0., -0.102, -9.],
                [3.5, -0.0158, -6.5],
                [-4.5, -0.1606, -2.],
            ]
            .iter()
            .enumerate()
            {
                mesh.append(self.skeleton(
                    (*p).into(),
                    std::f32::consts::PI,
                    self.time * 0.1 + i as f32,
                    0,
                    0.,
                ));
            }
            (
                self.reference_camera.unwrap_or(Vec3::new(0., 1.9, 13.)),
                -0.0594 + (self.time * 0.045).sin() * 0.025,
                -0.04,
            )
        } else {
            let player = self
                .snapshot
                .players
                .iter()
                .find(|p| p.id == self.player)
                .or(self.snapshot.players.first());
            let (mut eye, weapon, cooldown) = player
                .map(|p| (Vec3::from(p.pos) + Vec3::Y * 1.58, p.weapon, p.cooldown))
                .unwrap_or((Vec3::new(0., 1.58, 7.), 0, 0.));
            // Camera position follows server truth with a short visual filter.
            // Orientation below still uses this frame's mouse input immediately.
            if self.online {
                eye = match self.smoothed_eye {
                    Some(previous) if previous.distance_squared(eye) < 9. => {
                        previous.lerp(eye, 1. - (-dt * 28.).exp())
                    }
                    _ => eye,
                };
                self.smoothed_eye = Some(eye);
            }
            let alpha = (self.snapshot_age / self.snapshot_interval).clamp(0., 1.);
            for enemy in &self.snapshot.enemies {
                let previous = self
                    .previous_snapshot
                    .as_ref()
                    .and_then(|s| s.enemies.iter().find(|e| e.id == enemy.id));
                let (pos, angle) = interpolated_pose(
                    previous.map(|e| (e.pos, e.yaw)),
                    enemy.pos,
                    enemy.yaw,
                    alpha,
                );
                mesh.append(self.skeleton(
                    pos,
                    angle,
                    self.time + enemy.id as f32,
                    enemy.kind,
                    enemy.attack.max(0.),
                ))
            }
            for p in self.snapshot.players.iter().filter(|p| p.id != self.player) {
                let previous = self
                    .previous_snapshot
                    .as_ref()
                    .and_then(|s| s.players.iter().find(|q| q.id == p.id));
                let (pos, angle) =
                    interpolated_pose(previous.map(|q| (q.pos, q.yaw)), p.pos, p.yaw, alpha);
                let mut partner = scene::skeleton(pos, angle, self.time, 2, 0.);
                for v in &mut partner.vertices {
                    v.color[2] *= 1.3;
                }
                mesh.append(partner);
            }
            let rotation = Quat::from_rotation_y(yaw) * Quat::from_rotation_x(pitch);
            let mut gun = scene::weapon(
                weapon,
                self.time,
                self.recoil,
                if cooldown > 0.8 {
                    (cooldown - 0.8) * 1.8
                } else {
                    0.
                },
            );
            if weapon == 0 {
                if let Some(reference) = &self.reference_weapon {
                    gun = scene::Mesh {
                        vertices: reference.vertices.clone(),
                    };
                    let bob = (self.time * 9.).sin() * 0.005 * (mx.abs() + mz.abs()).min(1.);
                    gun.transform(Mat4::from_rotation_translation(
                        Quat::from_rotation_x(self.recoil * 0.08),
                        Vec3::new(0., bob, self.recoil * 0.035),
                    ));
                }
            }
            gun.transform(Mat4::from_rotation_translation(rotation, eye));
            mesh.append(gun);
            if self.recoil > 0.65 {
                let p = eye + rotation * Vec3::new(0.05, -0.15, -1.1);
                mesh.orb(
                    p,
                    Vec3::splat(0.035 + self.recoil * 0.03),
                    Vec3::new(5., 2.5, 0.5),
                    5.,
                    8,
                );
            }
            (eye, yaw, pitch)
        };
        for (pos, age) in &mut self.impacts {
            *age -= dt;
            mesh.orb(
                *pos,
                Vec3::splat(age.max(0.) * 0.35),
                Vec3::new(3.5, 0.4, 0.1),
                5.,
                6,
            );
        }
        self.impacts.retain(|(_, age)| *age > 0.);
        self.renderer
            .draw(eye, yaw, pitch, self.time, mesh)
            .map_err(|e| JsValue::from_str(&e))?;
        let mut result =
            serde_json::to_value(&self.snapshot).map_err(|e| JsValue::from_str(&e.to_string()))?;
        result["render"] = serde_json::json!({"backend":"Rust / WebGPU","triangles":self.renderer.triangles,"physics":"Rapier"});
        Ok(result.to_string())
    }
}
impl Game {
    fn skeleton(&self, pos: Vec3, yaw: f32, time: f32, kind: u8, attack: f32) -> scene::Mesh {
        let Some((base, meta)) = &self.reference_skeleton else {
            return scene::skeleton(pos, yaw, time, kind, attack);
        };
        let mut mesh = scene::Mesh {
            vertices: base.vertices.clone(),
        };
        if let Some(parts) = meta["parts"].as_array() {
            for part in parts {
                let start = part["vertex_start"].as_u64().unwrap_or(0) as usize;
                let count = part["vertex_count"].as_u64().unwrap_or(0) as usize;
                let name = part["name"].as_str().unwrap_or("");
                let idx = part["part"].as_u64().unwrap_or(0);
                let pivot = Vec3::new(
                    part["pivot"][0].as_f64().unwrap_or(0.) as f32,
                    part["pivot"][1].as_f64().unwrap_or(1.) as f32,
                    part["pivot"][2].as_f64().unwrap_or(0.) as f32,
                );
                let side = if idx % 2 == 0 { 1. } else { -1. };
                let walk = (time * 6.).sin() * side;
                let angle = if name.contains("thigh") || name.contains("shin") {
                    walk * 0.25
                } else if name.contains("arm") || name.contains("weapon") {
                    walk * 0.17 - attack.min(0.5) * 0.6
                } else {
                    0.
                };
                let rotation = Quat::from_rotation_x(angle);
                for v in mesh.vertices.iter_mut().skip(start).take(count) {
                    v.position = (pivot + rotation * (Vec3::from(v.position) - pivot)).to_array();
                    v.normal = (rotation * Vec3::from(v.normal)).to_array();
                }
            }
        }
        let scale = if kind == 2 { 1.6 } else { 1. };
        mesh.transform(Mat4::from_scale_rotation_translation(
            Vec3::splat(scale),
            Quat::from_rotation_y(yaw + std::f32::consts::PI),
            pos,
        ));
        mesh
    }
}

// Interpolation is presentation only. Snapshot coordinates remain untouched for
// HUD, transport and all authoritative gameplay checks; teleports snap cleanly.
fn interpolated_pose(
    previous: Option<([f32; 3], f32)>,
    position: [f32; 3],
    yaw: f32,
    alpha: f32,
) -> (Vec3, f32) {
    let current = Vec3::from(position);
    let Some((p, angle)) = previous else {
        return (current, yaw);
    };
    let p = Vec3::from(p);
    if p.distance_squared(current) > 9. {
        return (current, yaw);
    }
    let delta = (yaw - angle + std::f32::consts::PI).rem_euclid(std::f32::consts::TAU)
        - std::f32::consts::PI;
    (p.lerp(current, alpha), angle + delta * alpha)
}

fn local_ammo_spent(previous: &Snapshot, current: &Snapshot, id: u64) -> bool {
    match (
        previous.players.iter().find(|p| p.id == id),
        current.players.iter().find(|p| p.id == id),
    ) {
        (Some(old), Some(new)) => old.weapon == new.weapon && new.ammo < old.ammo,
        _ => false,
    }
}
