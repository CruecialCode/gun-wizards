use rapier3d::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
pub struct Input {
    pub mx: f32,
    pub mz: f32,
    pub yaw: f32,
    pub pitch: f32,
    pub fire: bool,
    pub melee: bool,
    pub spell: bool,
    pub dodge: bool,
    pub jump: bool,
    pub reload: bool,
}
impl Input {
    pub fn valid(&self) -> bool {
        [self.mx, self.mz, self.yaw, self.pitch]
            .iter()
            .all(|v| v.is_finite())
            && self.mx.abs() <= 1.01
            && self.mz.abs() <= 1.01
            && self.pitch.abs() <= 1.6
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Player {
    pub id: u64,
    pub pos: [f32; 3],
    pub yaw: f32,
    pub pitch: f32,
    pub hp: f32,
    pub mana: f32,
    pub stamina: f32,
    pub ammo: u32,
    pub weapon: u8,
    pub cooldown: f32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Enemy {
    pub id: u64,
    pub pos: [f32; 3],
    pub yaw: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub kind: u8,
    pub attack: f32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    pub pos: [f32; 3],
    pub kind: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub players: Vec<Player>,
    pub enemies: Vec<Enemy>,
    pub wave: u32,
    pub phase: String,
    pub time: f32,
    pub kills: u32,
    pub gold: u32,
    pub events: Vec<Event>,
}
#[derive(Clone, Copy)]
pub struct Solid {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub hx: f32,
    pub hy: f32,
    pub hz: f32,
}
pub fn solids() -> Vec<Solid> {
    vec![
        Solid {
            x: 0.,
            y: -0.5,
            z: 0.,
            hx: 25.,
            hy: 0.5,
            hz: 25.,
        },
        Solid {
            x: -19.,
            y: 2.,
            z: 0.,
            hx: 0.7,
            hy: 2.,
            hz: 19.,
        },
        Solid {
            x: 19.,
            y: 2.,
            z: 0.,
            hx: 0.7,
            hy: 2.,
            hz: 19.,
        },
        Solid {
            x: 0.,
            y: 2.,
            z: 19.,
            hx: 19.,
            hy: 2.,
            hz: 0.7,
        },
        Solid {
            x: 0.,
            y: 2.,
            z: -19.,
            hx: 19.,
            hy: 2.,
            hz: 0.7,
        },
        Solid {
            x: -5.,
            y: 3.5,
            z: -12.,
            hx: 1.,
            hy: 3.5,
            hz: 1.,
        },
        Solid {
            x: 5.,
            y: 3.5,
            z: -12.,
            hx: 1.,
            hy: 3.5,
            hz: 1.,
        },
        Solid {
            x: -12.5,
            y: 1.8,
            z: -12.,
            hx: 6.5,
            hy: 1.8,
            hz: 0.65,
        },
        Solid {
            x: 12.5,
            y: 1.8,
            z: -12.,
            hx: 6.5,
            hy: 1.8,
            hz: 0.65,
        },
        Solid {
            x: 0.,
            y: 6.8,
            z: -12.,
            hx: 1.,
            hy: 0.5,
            hz: 0.6,
        },
        Solid {
            x: -3.5,
            y: 4.75,
            z: -12.,
            hx: 1.2,
            hy: 0.5,
            hz: 0.6,
        },
        Solid {
            x: 3.5,
            y: 4.75,
            z: -12.,
            hx: 1.2,
            hy: 0.5,
            hz: 0.6,
        },
        Solid {
            x: -1.8,
            y: 5.8,
            z: -12.,
            hx: 1.2,
            hy: 0.5,
            hz: 0.6,
        },
        Solid {
            x: 1.8,
            y: 5.8,
            z: -12.,
            hx: 1.2,
            hy: 0.5,
            hz: 0.6,
        },
        Solid {
            x: -8.,
            y: 0.8,
            z: -3.,
            hx: 2.,
            hy: 0.8,
            hz: 1.,
        },
        Solid {
            x: 8.,
            y: 0.8,
            z: 3.,
            hx: 2.,
            hy: 0.8,
            hz: 1.,
        },
        Solid {
            x: -6.,
            y: 1.,
            z: 9.,
            hx: 1.,
            hy: 1.,
            hz: 1.,
        },
        Solid {
            x: 10.,
            y: 1.,
            z: -9.,
            hx: 1.,
            hy: 1.,
            hz: 1.,
        },
    ]
}

#[derive(Clone)]
pub struct ReferenceGeometry {
    shape: SharedShape,
    navigation: std::sync::Arc<Vec<bool>>,
}
impl ReferenceGeometry {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() % 144 != 0 || bytes.is_empty() {
            return Err("World geometry must contain complete 48-byte triangle vertices".into());
        }
        let mut vertices = Vec::new();
        let mut triangles = Vec::new();
        for triangle in bytes.chunks_exact(144) {
            let mut v = [[0f32; 12]; 3];
            for (dst, src) in v.iter_mut().zip(triangle.chunks_exact(48)) {
                for (f, b) in dst.iter_mut().zip(src.chunks_exact(4)) {
                    *f = f32::from_le_bytes(b.try_into().unwrap());
                }
            }
            if v.iter().flatten().any(|f| !f.is_finite()) {
                return Err("World geometry contains nonfinite vertices".into());
            }
            let material = v[0][9].round() as i32;
            let u = (v.iter().map(|a| a[10]).sum::<f32>() / 3. * 4.).floor() as i32;
            let vv = (v.iter().map(|a| a[11]).sum::<f32>() / 3. * 4.).floor() as i32;
            let tile = u.clamp(0, 3) + vv.clamp(0, 3) * 4;
            if material == 5 || (material != 11 && ![0, 1, 2, 3, 5, 8, 11, 13, 14].contains(&tile))
            {
                continue;
            }
            if v.iter().all(|a| a[0] < -38.)
                || v.iter().all(|a| a[0] > 38.)
                || v.iter().all(|a| a[2] < -38.)
                || v.iter().all(|a| a[2] > 38.)
                || v.iter().all(|a| a[1] > 8.)
            {
                continue;
            }
            let base = vertices.len() as u32;
            for a in v {
                vertices.push(point![a[0], a[1], a[2]]);
            }
            triangles.push([base, base + 1, base + 2]);
        }
        if triangles.is_empty() {
            return Err("No solid triangles found in world geometry".into());
        }
        let shape = SharedShape::trimesh(vertices, triangles).map_err(|e| e.to_string())?;
        let capsule = SharedShape::capsule_y(0.4, 0.43);
        let mut navigation = vec![false; 65 * 65];
        for z in 0..65 {
            for x in 0..65 {
                let wx = x as f32 - 32.;
                let wz = z as f32 - 32.;
                if let Some(t) = shape.cast_ray(
                    &Isometry::identity(),
                    &Ray::new(point![wx, 9., wz], vector![0., -1., 0.]),
                    20.,
                    true,
                ) {
                    let floor = 9. - t;
                    navigation[z * 65 + x] = !rapier3d::parry::query::intersection_test(
                        &Isometry::identity(),
                        shape.as_ref(),
                        &Isometry::translation(wx, floor + 0.96, wz),
                        capsule.as_ref(),
                    )
                    .unwrap_or(true);
                }
            }
        }
        Ok(Self {
            shape,
            navigation: std::sync::Arc::new(navigation),
        })
    }
}
pub struct World {
    reference: Option<ReferenceGeometry>,
    static_handles: Vec<ColliderHandle>,
    players: BTreeMap<u64, Player>,
    enemies: Vec<Enemy>,
    handles: BTreeMap<u64, RigidBodyHandle>,
    enemy_handles: BTreeMap<u64, RigidBodyHandle>,
    bodies: RigidBodySet,
    colliders: ColliderSet,
    pipeline: PhysicsPipeline,
    islands: IslandManager,
    broad: BroadPhaseMultiSap,
    narrow: NarrowPhase,
    joints: ImpulseJointSet,
    multi: MultibodyJointSet,
    ccd: CCDSolver,
    wave: u32,
    phase: String,
    time: f32,
    kills: u32,
    gold: u32,
    events: Vec<Event>,
    next_enemy: u64,
    pending_enemies: u32,
    spawn_timer: f32,
    knockback: BTreeMap<u64, [f32; 3]>,
    intermission: f32,
    edges: BTreeMap<u64, Input>,
    dashes: BTreeMap<u64, (f32, f32, f32)>,
    navigation: BTreeMap<u64, (f32, [f32; 3])>,
}
impl Default for World {
    fn default() -> Self {
        Self::new()
    }
}
impl World {
    pub fn new() -> Self {
        let mut colliders = ColliderSet::new();
        let mut static_handles = Vec::new();
        for s in solids() {
            static_handles.push(
                colliders.insert(
                    ColliderBuilder::cuboid(s.hx, s.hy, s.hz)
                        .translation(vector![s.x, s.y, s.z])
                        .friction(0.0)
                        .build(),
                ),
            );
        }
        Self {
            reference: None,
            static_handles,
            players: BTreeMap::new(),
            enemies: vec![],
            handles: BTreeMap::new(),
            enemy_handles: BTreeMap::new(),
            bodies: RigidBodySet::new(),
            colliders,
            pipeline: PhysicsPipeline::new(),
            islands: IslandManager::new(),
            broad: BroadPhaseMultiSap::new(),
            narrow: NarrowPhase::new(),
            joints: ImpulseJointSet::new(),
            multi: MultibodyJointSet::new(),
            ccd: CCDSolver::new(),
            wave: 0,
            phase: "lobby".into(),
            time: 0.,
            kills: 0,
            gold: 0,
            events: vec![],
            next_enemy: 100,
            pending_enemies: 0,
            spawn_timer: 0.,
            knockback: BTreeMap::new(),
            intermission: 0.,
            edges: BTreeMap::new(),
            dashes: BTreeMap::new(),
            navigation: BTreeMap::new(),
        }
    }
    pub fn set_reference_geometry(&mut self, bytes: &[u8]) -> Result<(), String> {
        let reference = ReferenceGeometry::from_bytes(bytes)?;
        self.use_reference_geometry(reference);
        Ok(())
    }
    pub fn use_reference_geometry(&mut self, reference: ReferenceGeometry) {
        for h in self.static_handles.drain(..) {
            self.colliders
                .remove(h, &mut self.islands, &mut self.bodies, true);
        }
        self.static_handles.push(
            self.colliders.insert(
                ColliderBuilder::new(reference.shape.clone())
                    .friction(0.)
                    .build(),
            ),
        );
        self.reference = Some(reference);
        self.navigation.clear();
    }
    fn body(&mut self, pos: [f32; 3]) -> RigidBodyHandle {
        let h = self.bodies.insert(
            RigidBodyBuilder::dynamic()
                .translation(vector![pos[0], pos[1] + 0.9, pos[2]])
                .lock_rotations()
                .linear_damping(0.1)
                .ccd_enabled(true)
                .build(),
        );
        self.colliders.insert_with_parent(
            ColliderBuilder::capsule_y(0.5, 0.4)
                .friction(0.)
                .restitution(0.)
                .build(),
            h,
            &mut self.bodies,
        );
        h
    }
    pub fn add_player(&mut self, id: u64) {
        if self.players.contains_key(&id) {
            return;
        }
        let mut pos = [self.players.len() as f32 * 1.5, 0.1, 7.];
        if self.reference.is_some() {
            pos[1] = spawn_height(self.reference.as_ref(), pos[0], pos[2]);
        }
        let h = self.body(pos);
        self.handles.insert(id, h);
        self.players.insert(
            id,
            Player {
                id,
                pos,
                yaw: 0.,
                pitch: 0.,
                hp: 100.,
                mana: 100.,
                stamina: 100.,
                ammo: 12,
                weapon: 0,
                cooldown: 0.,
            },
        );
    }
    pub fn remove_player(&mut self, id: u64) {
        self.players.remove(&id);
        self.edges.remove(&id);
        self.dashes.remove(&id);
        if let Some(h) = self.handles.remove(&id) {
            self.bodies.remove(
                h,
                &mut self.islands,
                &mut self.colliders,
                &mut self.joints,
                &mut self.multi,
                true,
            );
        }
    }
    pub fn start(&mut self, weapon: u8) {
        let ids: Vec<_> = self.players.keys().copied().collect();
        let reference = self.reference.clone();
        *self = Self::new();
        if let Some(reference) = reference {
            self.use_reference_geometry(reference);
        }
        for id in ids {
            self.add_player(id);
            if let Some(p) = self.players.get_mut(&id) {
                p.weapon = weapon.min(2);
                p.ammo = capacity(p.weapon);
            }
        }
        self.phase = "playing".into();
        self.spawn_wave();
    }
    pub fn next(&mut self) {
        if self.phase == "shop" {
            for p in self.players.values_mut() {
                p.hp = 100.;
                p.mana = 100.;
                p.ammo = capacity(p.weapon);
            }
            self.phase = "playing".into();
            self.spawn_wave();
        }
    }
    fn spawn_wave(&mut self) {
        self.wave += 1;
        self.pending_enemies = 25;
        self.spawn_timer = 0.;
        for _ in 0..5 {
            self.spawn_enemy();
        }
        for p in self.players.values_mut() {
            if p.hp <= 0. {
                p.hp = 50.;
            }
        }
        self.events.push(Event {
            pos: [0., 0., 0.],
            kind: "wave".into(),
        });
    }
    fn spawn_enemy(&mut self) {
        if self.pending_enemies == 0 {
            return;
        }
        let n = 25 - self.pending_enemies;
        self.pending_enemies -= 1;
        let angle = n as f32 * 2.399;
        let mut pos = [angle.cos() * 15., 0.1, angle.sin() * 15.];
        if self.reference.is_some() {
            pos[1] = spawn_height(self.reference.as_ref(), pos[0], pos[2]);
        }
        let id = self.next_enemy;
        self.next_enemy += 1;
        let kind = if self.wave % 5 == 0 && n == 0 {
            2
        } else if self.wave >= 2 && n % 5 == 4 {
            1
        } else {
            0
        };
        let hp = match kind {
            2 => 650. + self.wave as f32 * 20.,
            1 => 70.,
            _ => 45. + self.wave as f32 * 5.,
        };
        let h = self.body(pos);
        self.enemy_handles.insert(id, h);
        self.enemies.push(Enemy {
            id,
            pos,
            yaw: 0.,
            hp,
            max_hp: hp,
            kind,
            attack: 0.,
        });
        self.events.push(Event {
            pos,
            kind: "spawn".into(),
        });
    }
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            players: self.players.values().cloned().collect(),
            enemies: self.enemies.clone(),
            wave: self.wave,
            phase: self.phase.clone(),
            time: self.time,
            kills: self.kills,
            gold: self.gold,
            events: self.events.clone(),
        }
    }
    pub fn step(&mut self, dt: f32, inputs: &BTreeMap<u64, Input>) {
        let dt = dt.clamp(0., 1. / 30.);
        self.time += dt;
        self.events.clear();
        if self.phase != "playing" {
            return;
        }
        let mut attacks = vec![];
        for (&id, p) in &mut self.players {
            let i = inputs
                .get(&id)
                .copied()
                .filter(Input::valid)
                .unwrap_or_default();
            let prev = self.edges.get(&id).copied().unwrap_or_default();
            p.cooldown = (p.cooldown - dt).max(0.);
            p.mana = (p.mana + dt * 4.).min(100.);
            p.stamina = (p.stamina + dt * 17.).min(100.);
            if p.hp <= 0. {
                let body = &mut self.bodies[self.handles[&id]];
                body.set_linvel(vector![0., body.linvel().y, 0.], true);
                continue;
            }
            p.yaw = i.yaw;
            p.pitch = i.pitch;
            let mut x = i.mx;
            let mut z = i.mz;
            let len = (x * x + z * z).sqrt().max(1.);
            x /= len;
            z /= len;
            if i.dodge && !prev.dodge && p.stamina >= 25. {
                p.stamina -= 25.;
                if x.abs() + z.abs() < 0.01 {
                    z = 1.;
                }
                self.dashes.insert(
                    id,
                    (
                        0.18,
                        x * i.yaw.cos() - z * i.yaw.sin(),
                        -x * i.yaw.sin() - z * i.yaw.cos(),
                    ),
                );
            }
            let dash = self.dashes.entry(id).or_insert((0., 0., 0.));
            let velocity = if dash.0 > 0. {
                dash.0 -= dt;
                (dash.1 * 18., dash.2 * 18.)
            } else {
                (
                    (x * i.yaw.cos() - z * i.yaw.sin()) * 5.8,
                    (-x * i.yaw.sin() - z * i.yaw.cos()) * 5.8,
                )
            };
            let body = &mut self.bodies[self.handles[&id]];
            let vy = body.linvel().y;
            body.set_linvel(
                vector![
                    velocity.0,
                    if i.jump && !prev.jump && grounded(self.reference.as_ref(), p.pos) {
                        6.5
                    } else {
                        vy
                    },
                    velocity.1
                ],
                true,
            );
            if i.reload && p.cooldown <= 0. && p.ammo < capacity(p.weapon) {
                p.ammo = capacity(p.weapon);
                p.cooldown = 1.1;
                self.events.push(Event {
                    pos: p.pos,
                    kind: "reload".into(),
                });
            }
            if p.cooldown <= 0. {
                if i.melee && !prev.melee {
                    p.cooldown = 0.55;
                    attacks.push((id, p.pos, p.yaw, p.pitch, 3u8));
                } else if i.spell && !prev.spell && p.mana >= 30. {
                    p.mana -= 30.;
                    p.cooldown = 0.6;
                    attacks.push((id, p.pos, p.yaw, p.pitch, 4));
                } else if i.fire && p.ammo > 0 {
                    p.ammo -= 1;
                    p.cooldown = match p.weapon {
                        1 => 0.8,
                        2 => 0.4,
                        _ => 0.23,
                    };
                    attacks.push((id, p.pos, p.yaw, p.pitch, p.weapon));
                }
            }
            self.edges.insert(id, i);
        }
        for e in &mut self.enemies {
            let previous_attack = e.attack;
            e.attack = (e.attack - dt).max(0.);
            if let Some(p) = self
                .players
                .values_mut()
                .filter(|p| p.hp > 0.)
                .min_by(|a, b| distance(a.pos, e.pos).total_cmp(&distance(b.pos, e.pos)))
            {
                let path = self.navigation.entry(e.id).or_insert((0., p.pos));
                if path.0 <= self.time {
                    *path = (
                        self.time + 0.35,
                        navigation_waypoint_reference(e.pos, p.pos, self.reference.as_ref()),
                    );
                }
                let dx = path.1[0] - e.pos[0];
                let dz = path.1[2] - e.pos[2];
                let d = (dx * dx + dz * dz).sqrt().max(0.001);
                e.yaw = (-dx).atan2(-dz);
                let speed = if e.kind == 1 && distance(p.pos, e.pos) < 100. {
                    0.
                } else if e.kind == 2 {
                    1.7
                } else if e.kind == 1 {
                    1.8
                } else {
                    2.4 + self.wave as f32 * 0.05
                };
                let b = &mut self.bodies[self.enemy_handles[&e.id]];
                let push = self.knockback.entry(e.id).or_insert([0., 0., 0.]);
                b.set_linvel(
                    vector![
                        dx / d * speed + push[0],
                        b.linvel().y,
                        dz / d * speed + push[2]
                    ],
                    true,
                );
                push[0] *= (-dt * 9.).exp();
                push[2] *= (-dt * 9.).exp();
                if e.kind == 1 && distance(p.pos, e.pos) < 196. {
                    if e.attack <= 0. {
                        e.attack = 2.5;
                        self.events.push(Event {
                            pos: [e.pos[0], e.pos[1] + 1.3, e.pos[2]],
                            kind: "cast".into(),
                        });
                    }
                    if previous_attack > 1.8
                        && e.attack <= 1.8
                        && visible_reference(e.pos, p.pos, self.reference.as_ref())
                    {
                        p.hp = (p.hp - 12.).max(0.);
                        self.events.push(Event {
                            pos: p.pos,
                            kind: "hurt".into(),
                        });
                    }
                }

                if e.kind != 1
                    && distance(p.pos, e.pos) < if e.kind == 2 { 6.25 } else { 2.25 }
                    && (p.pos[1] - e.pos[1]).abs() < 1.5
                    && e.attack <= 0.
                {
                    p.hp = (p.hp - if e.kind == 2 { 28. } else { 10. }).max(0.);
                    e.attack = 1.1;
                    self.events.push(Event {
                        pos: p.pos,
                        kind: "hurt".into(),
                    });
                }
            }
        }
        let integration = IntegrationParameters {
            dt,
            ..Default::default()
        };
        self.pipeline.step(
            &vector![0., -19., 0.],
            &integration,
            &mut self.islands,
            &mut self.broad,
            &mut self.narrow,
            &mut self.bodies,
            &mut self.colliders,
            &mut self.joints,
            &mut self.multi,
            &mut self.ccd,
            None,
            &(),
            &(),
        );
        for (&id, p) in &mut self.players {
            let t = self.bodies[self.handles[&id]].translation();
            p.pos = [t.x, t.y - 0.9, t.z];
        }
        for e in &mut self.enemies {
            let t = self.bodies[self.enemy_handles[&e.id]].translation();
            e.pos = [t.x, t.y - 0.9, t.z];
        }
        for (_, pos, yaw, pitch, kind) in attacks {
            let origin = [pos[0], pos[1] + 1.5, pos[2]];
            let dir = [
                -yaw.sin() * pitch.cos(),
                pitch.sin(),
                -yaw.cos() * pitch.cos(),
            ];
            self.events.push(Event {
                pos: origin,
                kind: if kind == 4 {
                    "spell"
                } else if kind == 3 {
                    "melee"
                } else {
                    "shot"
                }
                .into(),
            });
            let range = if kind == 3 { 2.8 } else { 50. };
            let wall = static_ray(self.reference.as_ref(), origin, dir, range).unwrap_or(range);
            let mut hits: Vec<_> = self
                .enemies
                .iter()
                .enumerate()
                .filter_map(|(idx, e)| {
                    let v = [
                        e.pos[0] - origin[0],
                        e.pos[1] + 0.9 - origin[1],
                        e.pos[2] - origin[2],
                    ];
                    let t = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
                    let perpendicular = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] - t * t)
                        .max(0.)
                        .sqrt();
                    let radius = match kind {
                        1 => 0.6 + t * 0.085,
                        3 => 1.4,
                        4 => 1.8,
                        _ => 0.65,
                    };
                    if t > 0. && t < wall && perpendicular < radius {
                        Some((idx, t))
                    } else {
                        None
                    }
                })
                .collect();
            hits.sort_by(|a, b| a.1.total_cmp(&b.1));
            let count = if kind == 0 || kind == 2 {
                1
            } else {
                usize::MAX
            };
            for (idx, _) in hits.into_iter().take(count) {
                let e = &mut self.enemies[idx];
                e.hp -= match kind {
                    1 => 42.,
                    2 => 38.,
                    3 => 35.,
                    4 => 85.,
                    _ => 25.,
                };
                self.knockback.insert(
                    e.id,
                    [
                        dir[0] * if e.kind == 2 { 1.5 } else { 5. },
                        0.,
                        dir[2] * if e.kind == 2 { 1.5 } else { 5. },
                    ],
                );
                self.events.push(Event {
                    pos: [e.pos[0], e.pos[1] + 1., e.pos[2]],
                    kind: "hit".into(),
                });
            }
        }
        let dead: Vec<_> = self
            .enemies
            .iter()
            .filter(|e| e.hp <= 0.)
            .map(|e| e.id)
            .collect();
        for id in dead {
            if let Some(e) = self.enemies.iter().find(|e| e.id == id) {
                self.events.push(Event {
                    pos: e.pos,
                    kind: "death".into(),
                });
            }
            self.knockback.remove(&id);
            self.navigation.remove(&id);
            if let Some(h) = self.enemy_handles.remove(&id) {
                self.bodies.remove(
                    h,
                    &mut self.islands,
                    &mut self.colliders,
                    &mut self.joints,
                    &mut self.multi,
                    true,
                );
            }
            self.kills += 1;
            self.gold += 10;
        }
        self.enemies.retain(|e| e.hp > 0.);
        self.spawn_timer -= dt;
        if self.pending_enemies > 0 && self.enemies.len() < 5 && self.spawn_timer <= 0. {
            self.spawn_enemy();
            self.spawn_timer = 0.65;
        }
        if !self.players.is_empty() && self.players.values().all(|p| p.hp <= 0.) {
            self.phase = "defeat".into();
        } else if self.enemies.is_empty() && self.pending_enemies == 0 {
            self.intermission += dt;
            if self.intermission > 2. {
                self.intermission = 0.;
                if self.wave % 5 == 0 {
                    self.phase = "shop".into()
                } else {
                    self.spawn_wave()
                }
            }
        }
    }
}
fn static_ray(
    reference: Option<&ReferenceGeometry>,
    o: [f32; 3],
    d: [f32; 3],
    range: f32,
) -> Option<f32> {
    if let Some(r) = reference {
        r.shape.cast_ray(
            &Isometry::identity(),
            &Ray::new(point![o[0], o[1], o[2]], vector![d[0], d[1], d[2]]),
            range,
            true,
        )
    } else {
        solids()
            .into_iter()
            .filter_map(|s| ray_box(o, d, s))
            .filter(|t| *t <= range)
            .min_by(f32::total_cmp)
    }
}
fn spawn_height(reference: Option<&ReferenceGeometry>, x: f32, z: f32) -> f32 {
    static_ray(reference, [x, 9., z], [0., -1., 0.], 20.).map_or(2., |t| 9. - t + 0.2)
}
fn grounded(reference: Option<&ReferenceGeometry>, pos: [f32; 3]) -> bool {
    static_ray(
        reference,
        [pos[0], pos[1] + 0.3, pos[2]],
        [0., -1., 0.],
        0.44,
    )
    .is_some()
}
fn visible_reference(a: [f32; 3], b: [f32; 3], reference: Option<&ReferenceGeometry>) -> bool {
    let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt().max(0.001);
    static_ray(
        reference,
        [a[0], a[1] + 1.2, a[2]],
        [d[0] / len, d[1] / len, d[2] / len],
        len,
    )
    .is_none()
}
#[cfg(test)]
fn visible(a: [f32; 3], b: [f32; 3]) -> bool {
    let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt().max(0.001);
    let ray = [d[0] / len, d[1] / len, d[2] / len];
    solids()
        .into_iter()
        .all(|s| ray_box([a[0], a[1] + 1.2, a[2]], ray, s).map_or(true, |t| t > len))
}
#[cfg(test)]
fn navigation_waypoint(from: [f32; 3], goal: [f32; 3]) -> [f32; 3] {
    navigation_waypoint_reference(from, goal, None)
}
fn navigation_waypoint_reference(
    from: [f32; 3],
    goal: [f32; 3],
    reference: Option<&ReferenceGeometry>,
) -> [f32; 3] {
    let obstacles: Vec<_> = solids()
        .into_iter()
        .filter(|s| s.y + s.hy > 0.2 && s.y - s.hy < 1.8)
        .collect();
    let clear = |x: f32, z: f32| {
        if let Some(r) = reference {
            return r.navigation
                [((z + 32.).round() as usize).min(64) * 65 + ((x + 32.).round() as usize).min(64)];
        }
        obstacles
            .iter()
            .all(|s| (x - s.x).abs() > s.hx + 0.55 || (z - s.z).abs() > s.hz + 0.55)
    };
    let n = if reference.is_some() {
        65usize
    } else {
        37usize
    };
    let half = (n / 2) as f32;
    let index = |p: [f32; 3]| {
        ((p[2].round() as i32 + half as i32).clamp(0, n as i32 - 1) as usize) * n
            + (p[0].round() as i32 + half as i32).clamp(0, n as i32 - 1) as usize
    };
    let start = index(from);
    let end = index(goal);
    let mut dist = vec![usize::MAX; n * n];
    dist[end] = 0;
    let mut queue = std::collections::VecDeque::from([end]);
    while let Some(k) = queue.pop_front() {
        let x = k % n;
        let z = k / n;
        for (nx, nz) in [
            (x as i32 - 1, z as i32),
            (x as i32 + 1, z as i32),
            (x as i32, z as i32 - 1),
            (x as i32, z as i32 + 1),
        ] {
            if nx < 0 || nz < 0 || nx >= n as i32 || nz >= n as i32 {
                continue;
            }
            let j = nz as usize * n + nx as usize;
            if dist[j] == usize::MAX && clear(nx as f32 - half, nz as f32 - half) {
                dist[j] = dist[k] + 1;
                queue.push_back(j);
            }
        }
    }
    if dist[start] <= 1 {
        return goal;
    }
    let x = start % n;
    let z = start / n;
    let best = [
        (x as i32 - 1, z as i32),
        (x as i32 + 1, z as i32),
        (x as i32, z as i32 - 1),
        (x as i32, z as i32 + 1),
    ]
    .into_iter()
    .filter(|(x, z)| *x >= 0 && *z >= 0 && *x < n as i32 && *z < n as i32)
    .min_by_key(|(x, z)| dist[*z as usize * n + *x as usize]);
    if let Some((x, z)) = best {
        if dist[z as usize * n + x as usize] < usize::MAX {
            return [x as f32 - half, from[1], z as f32 - half];
        }
    }
    goal
}
fn capacity(weapon: u8) -> u32 {
    match weapon {
        1 => 6,
        2 => 18,
        _ => 12,
    }
}
fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
    (a[0] - b[0]).powi(2) + (a[2] - b[2]).powi(2)
}
fn ray_box(o: [f32; 3], d: [f32; 3], s: Solid) -> Option<f32> {
    let c = [s.x, s.y, s.z];
    let h = [s.hx, s.hy, s.hz];
    let (mut lo, mut hi) = (0f32, 1000f32);
    for k in 0..3 {
        if d[k].abs() < 0.00001 {
            if o[k] < c[k] - h[k] || o[k] > c[k] + h[k] {
                return None;
            }
        } else {
            let a = (c[k] - h[k] - o[k]) / d[k];
            let b = (c[k] + h[k] - o[k]) / d[k];
            lo = lo.max(a.min(b));
            hi = hi.min(a.max(b));
            if hi < lo {
                return None;
            }
        }
    }
    Some(lo)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reference_floor_survives_restart_and_supports_jump() {
        let mut data = Vec::new();
        for p in [
            [-40., 2., -40.],
            [-40., 2., 40.],
            [40., 2., 40.],
            [-40., 2., -40.],
            [40., 2., 40.],
            [40., 2., -40.],
        ] {
            for f in [p[0], p[1], p[2], 0., 1., 0., 1., 1., 1., 11., 0., 0.] {
                data.extend_from_slice(&f32::to_le_bytes(f));
            }
        }
        let mut w = World::new();
        w.add_player(1);
        w.set_reference_geometry(&data).unwrap();
        w.start(0);
        for _ in 0..60 {
            w.step(1. / 60., &BTreeMap::new());
        }
        assert!((w.snapshot().players[0].pos[1] - 2.).abs() < 0.08);
        w.step(
            1. / 60.,
            &BTreeMap::from([(
                1,
                Input {
                    jump: true,
                    ..Default::default()
                },
            )]),
        );
        for _ in 0..10 {
            w.step(1. / 60., &BTreeMap::new());
        }
        assert!(w.snapshot().players[0].pos[1] > 2.5);
        assert!(w.set_reference_geometry(&[0u8; 2]).is_err());
    }
    #[test]
    fn staggered_wave_budget_and_boss() {
        let mut w = World::new();
        w.add_player(1);
        w.start(0);
        assert_eq!(w.enemies.len(), 5);
        assert_eq!(w.pending_enemies, 20);
        w.wave = 4;
        w.enemies.clear();
        w.spawn_wave();
        assert_eq!(w.enemies.iter().filter(|e| e.kind == 2).count(), 1);
        assert!(w.enemies.iter().find(|e| e.kind == 2).unwrap().hp > 600.);
    }
    #[test]
    fn caster_cannot_hit_through_gate_wall() {
        assert!(!visible([10., 0., -14.], [10., 0., -10.]));
        assert!(visible([0., 0., -14.], [0., 0., -10.]));
    }
    #[test]
    fn navigation_routes_around_gate_wall() {
        let next = navigation_waypoint([10., 0., -14.], [8., 0., -9.]);
        assert!(
            next[0] < 10. || next[2] < -14.,
            "route must approach the open gate rather than the wall: {next:?}"
        );
    }
    #[test]
    fn finite_inputs_only() {
        assert!(!Input {
            mx: f32::NAN,
            ..Default::default()
        }
        .valid());
        assert!(!Input {
            mz: 2.,
            ..Default::default()
        }
        .valid());
    }
    #[test]
    fn collision_and_ground() {
        let mut w = World::new();
        w.add_player(1);
        w.start(0);
        w.bodies[w.handles[&1]].set_translation(vector![17., 0.91, 7.], true);
        for _ in 0..90 {
            w.step(
                1. / 60.,
                &BTreeMap::from([(
                    1,
                    Input {
                        mx: 1.,
                        ..Default::default()
                    },
                )]),
            );
        }
        let p = &w.snapshot().players[0];
        assert!(p.pos[1].abs() < 0.05);
        assert!(p.pos[0] < 18.0);
        assert!(p.pos[0] > 17.0);
    }
    #[test]
    fn reload_cannot_fire_immediately() {
        let mut w = World::new();
        w.add_player(1);
        w.start(0);
        w.step(
            1. / 60.,
            &BTreeMap::from([(
                1,
                Input {
                    fire: true,
                    ..Default::default()
                },
            )]),
        );
        assert_eq!(w.snapshot().players[0].ammo, 11);
        for _ in 0..20 {
            w.step(1. / 60., &BTreeMap::new());
        }
        w.step(
            1. / 60.,
            &BTreeMap::from([(
                1,
                Input {
                    reload: true,
                    fire: true,
                    ..Default::default()
                },
            )]),
        );
        let p = &w.snapshot().players[0];
        assert_eq!(p.ammo, 12);
        assert!(p.cooldown > 1.);
    }
    #[test]
    fn start_resets_progress_preserves_players() {
        let mut w = World::new();
        w.add_player(7);
        w.add_player(8);
        w.start(1);
        assert_eq!(w.snapshot().players.len(), 2);
        assert_eq!(w.snapshot().wave, 1);
        assert_eq!(w.snapshot().players[0].ammo, 6);
        w.gold = 200;
        w.start(2);
        assert_eq!(w.snapshot().gold, 0);
        assert_eq!(w.snapshot().players[0].weapon, 2);
    }
    #[test]
    fn cover_occludes_ray() {
        let t = ray_box(
            [0., 1., 0.],
            [1., 0., 0.],
            Solid {
                x: 4.,
                y: 1.,
                z: 0.,
                hx: 1.,
                hy: 1.,
                hz: 1.,
            },
        )
        .unwrap();
        assert_eq!(t, 3.);
    }
}
