use bytemuck::{Pod, Zeroable};
use glam::{Mat4, Quat, Vec3};

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct Vertex {
    pub position: [f32; 3],
    pub normal: [f32; 3],
    pub color: [f32; 3],
    pub material: f32,
    pub uv: [f32; 2],
}
#[derive(Default)]
pub struct Mesh {
    pub vertices: Vec<Vertex>,
}
impl Mesh {
    pub fn tri(&mut self, a: Vec3, b: Vec3, c: Vec3, color: Vec3, material: f32) {
        let n = (b - a).cross(c - a).normalize_or_zero().to_array();
        for p in [a, b, c] {
            self.vertices.push(Vertex {
                position: p.to_array(),
                normal: n,
                color: color.to_array(),
                material,
                uv: [0., 0.],
            });
        }
    }
    pub fn quad(&mut self, a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Vec3, m: f32) {
        self.tri(a, b, c, color, m);
        self.tri(a, c, d, color, m);
    }
    pub fn cube(&mut self, p: Vec3, s: Vec3, q: Quat, c: Vec3, m: f32) {
        let t = Mat4::from_scale_rotation_translation(s, q, p);
        let v: Vec<_> = [
            [-1., -1., -1.],
            [1., -1., -1.],
            [1., 1., -1.],
            [-1., 1., -1.],
            [-1., -1., 1.],
            [1., -1., 1.],
            [1., 1., 1.],
            [-1., 1., 1.],
        ]
        .map(|v| t.transform_point3(Vec3::from(v) * 0.5))
        .to_vec();
        for [a, b, c1, d] in [
            [0, 3, 2, 1],
            [4, 5, 6, 7],
            [0, 4, 7, 3],
            [1, 2, 6, 5],
            [3, 7, 6, 2],
            [0, 1, 5, 4],
        ] {
            self.quad(v[a], v[b], v[c1], v[d], c, m);
        }
    }
    pub fn box_at(&mut self, p: [f32; 3], s: [f32; 3], c: [f32; 3], m: f32) {
        self.cube(p.into(), s.into(), Quat::IDENTITY, c.into(), m);
    }
    pub fn taper(&mut self, a: Vec3, b: Vec3, r0: f32, r1: f32, c: Vec3, m: f32, n: usize) {
        let axis = (b - a).normalize_or_zero();
        let u = axis.any_orthonormal_vector();
        let v = axis.cross(u);
        for i in 0..n {
            let theta = i as f32 * std::f32::consts::TAU / n as f32;
            let phi = (i + 1) as f32 * std::f32::consts::TAU / n as f32;
            let d = u * theta.cos() + v * theta.sin();
            let e = u * phi.cos() + v * phi.sin();
            self.quad(a + d * r0, a + e * r0, b + e * r1, b + d * r1, c, m);
            self.tri(a, a + e * r0, a + d * r0, c, m);
            self.tri(b, b + d * r1, b + e * r1, c, m);
        }
    }
    pub fn orb(&mut self, p: Vec3, s: Vec3, c: Vec3, m: f32, n: usize) {
        for y in 0..n / 2 {
            let t = y as f32 * std::f32::consts::PI / (n / 2) as f32;
            let t1 = (y + 1) as f32 * std::f32::consts::PI / (n / 2) as f32;
            for x in 0..n {
                let f = x as f32 * std::f32::consts::TAU / n as f32;
                let f1 = (x + 1) as f32 * std::f32::consts::TAU / n as f32;
                let at = |a: f32, b: f32| {
                    p + s * Vec3::new(a.sin() * b.cos(), a.cos(), a.sin() * b.sin())
                };
                self.quad(at(t, f), at(t1, f), at(t1, f1), at(t, f1), c, m);
            }
        }
    }
    pub fn transform(&mut self, t: Mat4) {
        let normal = t.inverse().transpose();
        for v in &mut self.vertices {
            v.position = t.transform_point3(v.position.into()).to_array();
            v.normal = normal
                .transform_vector3(v.normal.into())
                .normalize_or_zero()
                .to_array();
        }
    }
    pub fn append(&mut self, other: Mesh) {
        self.vertices.extend(other.vertices);
    }
}
fn rnd(n: u32) -> f32 {
    let mut h = n.wrapping_mul(747796405).wrapping_add(2891336453);
    h = ((h >> ((h >> 28) + 4)) ^ h).wrapping_mul(277803737);
    ((h >> 22) ^ h) as f32 / u32::MAX as f32
}
pub const LIGHTS: [[f32; 3]; 8] = [
    [-7., 2.6, 4.],
    [7., 2.6, 4.],
    [-5.5, 3., -11.],
    [5.5, 3., -11.],
    [-15., 2.6, -3.],
    [15., 2.6, -3.],
    [-12., 2.6, 16.],
    [12., 2.6, 16.],
];
const STONE: Vec3 = Vec3::new(0.39, 0.39, 0.34);
const WOOD: Vec3 = Vec3::new(0.22, 0.16, 0.10);
pub fn forest() -> Mesh {
    let mut mesh = Mesh::default();
    mesh.box_at([0., -0.18, 0.], [180., 0.3, 180.], [0.21, 0.25, 0.14], 0.);
    // A broken path: asymmetric stone edges, sunk into the moss.
    for i in 0..170 {
        let x = (rnd(i * 9) - 0.5) * 9.;
        let z = (rnd(i * 9 + 1) - 0.5) * 47.;
        mesh.taper(
            Vec3::new(x, -0.01, z),
            Vec3::new(x, 0.055 + rnd(i + 2) * 0.035, z),
            0.42 + rnd(i + 3) * 0.38,
            0.42 + rnd(i + 3) * 0.35,
            STONE * (0.7 + rnd(i + 4) * 0.35),
            1.,
            5,
        );
    }
    // Ruined gate and stone enclosure: individually staggered blocks.
    for side in [-1., 1.] {
        for j in 0..10 {
            for row in 0..4 {
                let x = side * (6.8 + j as f32 * 1.65);
                let y = 0.45 + row as f32 * 0.87;
                let z = -12. + if row % 2 == 0 { 0.1 } else { -0.1 };
                if rnd(j * 7 + row + if side > 0. { 22 } else { 9 }) > 0.1 {
                    mesh.box_at(
                        [x, y, z],
                        [1.56, 0.8, 1.1],
                        (STONE * (0.85 + rnd(j + row) * 0.3)).into(),
                        1.,
                    );
                }
            }
        }
        for row in 0..8 {
            let y = 0.42 + row as f32 * 0.82;
            mesh.box_at([side * 5., y, -12.], [1.48, 0.77, 1.7], STONE.into(), 1.);
        }
        for y in [0.3, 1., 5.8, 6.65] {
            mesh.box_at(
                [side * 5., y, -12.],
                [1.85, 0.23, 2.05],
                (STONE * 0.75).into(),
                1.,
            );
        }
        mesh.box_at(
            [side * 5., 7.12, -12.],
            [0.8, 0.75, 0.8],
            (STONE * 0.72).into(),
            1.,
        );
        // Pointed medieval arch with visible voussoirs.
        for j in 0..6 {
            let p = Vec3::new(side * (4.2 - j as f32 * 0.74), 4.3 + j as f32 * 0.46, -12.);
            mesh.cube(
                p,
                Vec3::new(0.97, 0.57, 1.15),
                Quat::from_rotation_z(-side * 0.56),
                STONE,
                1.,
            );
        }
        // Red faded standards and rusted iron fixtures.
        mesh.box_at(
            [side * 5., 4.6, -10.98],
            [0.57, 1.9, 0.04],
            [0.26, 0.07, 0.055],
            4.,
        );
        mesh.box_at(
            [side * 5., 5.58, -10.92],
            [0.72, 0.05, 0.08],
            [0.39, 0.29, 0.12],
            3.,
        );
        for i in 0..21 {
            for row in 0..3 {
                mesh.box_at(
                    [side * 19., 0.42 + row as f32 * 0.81, -18. + i as f32 * 1.8],
                    [0.85, 0.76, 1.69],
                    STONE.into(),
                    1.,
                );
            }
        }
    }
    // Rubble, leaning gravestones, crates, mossy boulders.
    for i in 0..160 {
        let x = (rnd(50 + i * 7) - 0.5) * 42.;
        let z = (rnd(51 + i * 7) - 0.5) * 47.;
        if x.abs() < 3. {
            continue;
        }
        let r = 0.12 + rnd(i + 53) * 0.36;
        mesh.orb(
            Vec3::new(x, r * 0.2, z),
            Vec3::new(r, r * 0.65, r * 1.4),
            STONE * 0.7,
            1.,
            6,
        );
    }
    for (x, z) in [
        (-11., -4.),
        (11., -6.),
        (-11., 10.),
        (12., 12.),
        (-4., -21.),
        (5., -22.),
    ] {
        mesh.cube(
            Vec3::new(x, 0.65, z),
            Vec3::new(1.0, 1.4, 0.35),
            Quat::from_rotation_z(0.19),
            STONE * 0.8,
            1.,
        );
        mesh.box_at([x, 1.4, z], [1.1, 0.22, 0.42], STONE.into(), 1.);
        mesh.box_at(
            [x, 0.82, z + 0.21],
            [0.075, 0.5, 0.025],
            [0.08, 0.08, 0.06],
            1.,
        );
        mesh.box_at(
            [x, 0.95, z + 0.22],
            [0.35, 0.06, 0.025],
            [0.08, 0.08, 0.06],
            1.,
        );
    }
    for s in crate::simulation::solids() {
        if s.hy < 1. && s.hx > 0.7 && s.hx < 4. {
            mesh.box_at(
                [s.x, s.y, s.z],
                [s.hx * 2., s.hy * 2., s.hz * 2.],
                STONE.into(),
                1.,
            );
        }
    }
    for i in 0..105 {
        let a = rnd(i * 13 + 500) * std::f32::consts::TAU;
        let r = 24. + rnd(i * 13 + 501) * 50.;
        let p = Vec3::new(a.sin() * r, 0., a.cos() * r);
        let h = 8. + rnd(i + 321) * 12.;
        tree(&mut mesh, p, h, i);
    }
    for (i, p) in [(-14., 7.), (15., 9.), (-16., -7.), (16., -17.), (-12., 20.)]
        .iter()
        .enumerate()
    {
        tree(
            &mut mesh,
            Vec3::new(p.0, 0., p.1),
            11. + i as f32,
            700 + i as u32,
        );
    }
    // Ground litter and blades: dark olive accents never neon grass.
    for i in 0..1500 {
        let x = (rnd(i * 11 + 900) - 0.5) * 65.;
        let z = (rnd(i * 11 + 901) - 0.5) * 65.;
        if x.abs() < 4. {
            continue;
        }
        let p = Vec3::new(x, 0.01, z);
        let h = 0.12 + rnd(i + 902) * 0.38;
        let c = Vec3::new(0.17, 0.22, 0.10) * (0.65 + rnd(i + 903) * 0.55);
        for j in 0..3 {
            let d = Vec3::new((j as f32 * 2.1).cos(), 0., (j as f32 * 2.1).sin());
            mesh.tri(p - d * 0.06, p + d * 0.06, p + d * 0.1 + Vec3::Y * h, c, 2.);
        }
    }
    for l in LIGHTS {
        let p = Vec3::from(l);
        mesh.taper(
            p - Vec3::Y * 2.6,
            p - Vec3::Y * 0.6,
            0.36,
            0.21,
            STONE * 0.7,
            1.,
            8,
        );
        mesh.taper(
            p - Vec3::Y * 0.65,
            p - Vec3::Y * 0.2,
            0.25,
            0.62,
            Vec3::splat(0.15),
            3.,
            10,
        );
        mesh.taper(
            p - Vec3::Y * 0.2,
            p - Vec3::Y * 0.12,
            0.65,
            0.65,
            Vec3::new(0.38, 0.25, 0.10),
            3.,
            10,
        );
        for i in 0..5 {
            let a = i as f32 * 1.25;
            let d = Vec3::new(a.cos(), 0., a.sin());
            mesh.taper(
                p + d * 0.53 - Vec3::Y * 0.3,
                p + d * 0.58 + Vec3::Y * 0.3,
                0.035,
                0.015,
                Vec3::splat(0.12),
                3.,
                5,
            );
        }
    }
    mesh
}
fn tree(m: &mut Mesh, p: Vec3, h: f32, seed: u32) {
    let lean = Vec3::new((rnd(seed + 1) - 0.5) * 1.7, 0., (rnd(seed + 2) - 0.5) * 1.4);
    m.taper(
        p,
        p + Vec3::Y * h + lean,
        0.45 + h * 0.012,
        0.13,
        WOOD,
        2.,
        7,
    );
    for j in 0..5 {
        let a = j as f32 * 2.4 + rnd(seed) * 5.;
        let d = Vec3::new(a.cos(), 0., a.sin());
        let b = p + Vec3::Y * (h * (0.45 + j as f32 * 0.08)) + lean * 0.5;
        let end = b + d * (2.4 + rnd(seed + j) * 2.) + Vec3::Y * 1.0;
        m.taper(b, end, 0.22, 0.05, WOOD, 2., 6);
        m.taper(
            end - Vec3::Y * 0.2,
            end + Vec3::Y * 1.3,
            2.1 + rnd(seed + j) * 1.4,
            0.28,
            Vec3::new(0.10, 0.155, 0.12) * (0.8 + rnd(seed + j) * 0.4),
            2.,
            7,
        );
    }
    for j in 0..4 {
        let a = j as f32 * 1.6;
        m.taper(
            p + Vec3::Y * 0.4,
            p + Vec3::new(a.cos() * 1.4, 0., a.sin() * 1.4),
            0.2,
            0.04,
            WOOD,
            2.,
            5,
        );
    }
}
pub fn skeleton(pos: Vec3, yaw: f32, time: f32, kind: u8, attack: f32) -> Mesh {
    let mut m = Mesh::default();
    let bone = Vec3::new(0.70, 0.66, 0.48);
    let dark = Vec3::new(0.065, 0.06, 0.05);
    let scale = if kind == 2 { 1.45 } else { 1. };
    let stride = (time * 6.).sin() * 0.38;
    for side in [-1., 1.] {
        let hip = Vec3::new(side * 0.16, 0.9, 0.);
        let knee = Vec3::new(side * 0.17, 0.51, side * stride * 0.45);
        let foot = Vec3::new(side * 0.18, 0.12, -side * stride);
        m.taper(hip, knee, 0.067, 0.052, bone, 6., 6);
        m.orb(knee, Vec3::splat(0.071), bone, 6., 6);
        m.taper(knee, foot, 0.048, 0.06, bone, 6., 6);
        m.box_at(
            (foot + Vec3::new(0., -0.07, -0.085)).into(),
            [0.13, 0.10, 0.25],
            bone.into(),
            6.,
        );
        let shoulder = Vec3::new(side * 0.30, 1.43, 0.);
        let elbow = Vec3::new(side * 0.39, 1.14, -0.12 - side * stride * 0.3);
        let hand = Vec3::new(side * 0.29, 1.00, -0.33 - attack * 0.42);
        m.taper(shoulder, elbow, 0.065, 0.05, bone, 6., 6);
        m.taper(elbow, hand, 0.055, 0.04, bone, 6., 6);
        m.orb(hand, Vec3::new(0.075, 0.10, 0.06), bone, 6., 6);
        for j in 0..4 {
            let y = 1.14 + j as f32 * 0.077;
            m.taper(
                Vec3::new(0., y, -0.06),
                Vec3::new(side * (0.17 + j as f32 * 0.025), y + 0.015, 0.03),
                0.027,
                0.025,
                bone,
                6.,
                6,
            );
            m.taper(
                Vec3::new(side * (0.17 + j as f32 * 0.025), y + 0.015, 0.03),
                Vec3::new(side * 0.08, y - 0.025, 0.13),
                0.025,
                0.025,
                bone,
                6.,
                6,
            );
        }
    }
    m.taper(
        Vec3::new(0., 0.87, 0.05),
        Vec3::new(0., 1.60, 0.04),
        0.055,
        0.05,
        bone,
        6.,
        7,
    );
    m.orb(
        Vec3::new(0., 0.93, 0.),
        Vec3::new(0.23, 0.13, 0.12),
        bone,
        6.,
        8,
    );
    m.orb(
        Vec3::new(0., 1.70, -0.02),
        Vec3::new(0.18, 0.21, 0.16),
        bone,
        6.,
        10,
    );
    for side in [-1., 1.] {
        m.orb(
            Vec3::new(side * 0.08, 1.72, -0.161),
            Vec3::new(0.052, 0.056, 0.025),
            dark,
            6.,
            8,
        );
        m.orb(
            Vec3::new(side * 0.08, 1.72, -0.18_f32),
            Vec3::splat(0.012),
            Vec3::new(2.5, 0.38, 0.06),
            5.,
            6,
        );
    }
    m.box_at([0., 1.58, -0.08], [0.22, 0.08, 0.14], bone.into(), 6.);
    for i in 0..5 {
        m.box_at(
            [-0.08 + i as f32 * 0.04, 1.62, -0.159],
            [0.022, 0.045, 0.03],
            bone.into(),
            6.,
        );
    }
    if kind == 1 {
        m.taper(
            Vec3::new(0., 1.55, 0.),
            Vec3::new(0., 0.5, 0.),
            0.28,
            0.42,
            Vec3::new(0.16, 0.12, 0.19),
            4.,
            8,
        );
    }
    if kind == 2 {
        m.box_at([0., 1.34, 0.02], [0.5, 0.45, 0.24], [0.18, 0.20, 0.20], 3.);
        for side in [-1., 1.] {
            m.taper(
                Vec3::new(side * 0.16, 1.80, 0.),
                Vec3::new(side * 0.26, 2.12, 0.),
                0.07,
                0.,
                bone,
                6.,
                6,
            );
        }
    }
    m.transform(Mat4::from_scale_rotation_translation(
        Vec3::splat(scale),
        Quat::from_rotation_y(yaw),
        pos,
    ));
    m
}
pub fn weapon(kind: u8, time: f32, recoil: f32, reload: f32) -> Mesh {
    let mut m = Mesh::default();
    let steel = Vec3::new(0.16, 0.18, 0.18);
    let brass = Vec3::new(0.57, 0.40, 0.17);
    let wood = Vec3::new(0.24, 0.09, 0.045);
    if kind == 2 {
        m.taper(
            Vec3::new(0.10, -0.37, -0.38),
            Vec3::new(0.1, 0.1, -0.95),
            0.044,
            0.035,
            wood,
            2.,
            8,
        );
        m.orb(
            Vec3::new(0.10, 0.13, -0.99),
            Vec3::new(0.062, 0.16, 0.067),
            Vec3::new(0.25, 1.0, 1.7),
            5.,
            6,
        );
        for side in [-1., 1.] {
            m.taper(
                Vec3::new(0.10, -0.04, -0.92),
                Vec3::new(0.1 + side * 0.10, 0.15, -1.01),
                0.025,
                0.005,
                brass,
                3.,
                6,
            );
        }
    } else {
        let barrels = if kind == 1 { 2 } else { 1 };
        for i in 0..barrels {
            let x = 0.05 + (i as f32 - (barrels - 1) as f32 * 0.5) * 0.10;
            m.taper(
                Vec3::new(x, -0.16, -0.44),
                Vec3::new(x, -0.10, -1.07),
                0.065,
                0.061,
                steel,
                3.,
                10,
            );
            m.taper(
                Vec3::new(x, -0.10, -1.071),
                Vec3::new(x, -0.10, -1.08),
                0.043,
                0.043,
                Vec3::splat(0.015),
                6.,
                10,
            );
            for z in [-0.50, -0.9, -1.02] {
                m.taper(
                    Vec3::new(x, -0.11, z),
                    Vec3::new(x, -0.11, z - 0.025),
                    0.07,
                    0.07,
                    brass,
                    3.,
                    10,
                );
            }
        }
        m.cube(
            Vec3::new(0.05, -0.26, -0.38),
            Vec3::new(0.1, 0.28, 0.13),
            Quat::from_rotation_x(-0.4),
            wood,
            2.,
        );
        m.box_at([0.05, -0.185, -0.53], [0.16, 0.12, 0.26], wood.into(), 2.);
        m.box_at([0.05, -0.09, -0.49], [0.15, 0.04, 0.17], brass.into(), 3.);
        m.box_at([0.05, -0.035, -0.81], [0.016, 0.04, 0.02], brass.into(), 3.);
    }
    // Small wrapped hand and wrist, anatomically connected to the lower frame.
    m.taper(
        Vec3::new(0.27, -0.62, -0.05),
        Vec3::new(0.1, -0.3, -0.36),
        0.105,
        0.075,
        Vec3::new(0.22, 0.20, 0.16),
        4.,
        8,
    );
    m.orb(
        Vec3::new(0.09, -0.27, -0.37),
        Vec3::new(0.072, 0.1, 0.08),
        Vec3::new(0.46, 0.35, 0.25),
        6.,
        8,
    );
    m.transform(Mat4::from_rotation_translation(
        Quat::from_rotation_x(recoil * 0.16 + reload * 0.8),
        Vec3::new(
            (time * 1.8).sin() * 0.004,
            -0.07 - reload * 0.22,
            recoil * 0.11,
        ),
    ));
    m
}
pub fn effects(time: f32) -> Mesh {
    effects_at(time, &LIGHTS.map(|p| [p[0], p[1], p[2], 12.]))
}
pub fn effects_at(time: f32, lights: &[[f32; 4]]) -> Mesh {
    let mut m = Mesh::default();
    for (j, l) in lights.iter().enumerate() {
        if l[3] < 1. {
            continue;
        }
        let p = Vec3::new(l[0], l[1], l[2]);
        for i in 0..7 {
            let seed = (i + j * 7) as f32;
            let phase = (time * (0.7 + seed.sin().abs() * 0.7) + seed * 0.37).fract();
            let a = seed * 2.4;
            let r = (1. - phase) * 0.26;
            let q = p + Vec3::new(
                a.cos() * r + 0.10 * (time * 3. + seed).sin(),
                phase * 1.25,
                a.sin() * r,
            );
            m.orb(
                q,
                Vec3::new(
                    (1. - phase) * 0.14 + 0.02,
                    (1. - phase) * 0.30 + 0.02,
                    (1. - phase) * 0.14 + 0.02,
                ),
                Vec3::new(4., 1.1 + phase * 0.6, 0.12),
                5.,
                6,
            );
        }
        for i in 0..4 {
            let f = (time * 0.3 + i as f32 * 0.24).fract();
            m.orb(
                p + Vec3::new((time + i as f32).sin() * 0.25, f * 2.5, 0.),
                Vec3::splat(0.014),
                Vec3::new(4., 1.3, 0.1),
                5.,
                4,
            );
        }
    }
    m
}
