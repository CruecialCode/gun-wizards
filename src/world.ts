import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DISTRICT, BREAKABLES, type DamageState } from '../shared/district';
export const palette = {
  sand: 0x454859,
  light: 0xb7b3ad,
  stone: 0x393e51,
  teal: 0x31545d,
  red: 0xb8423a,
  brass: 0xa88e58,
  dark: 0x161d2c,
};
const ramp = new T.DataTexture(new Uint8Array([70, 150, 230, 255]), 4, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter;
ramp.needsUpdate = true;
export function mat(color: number) {
  return new T.MeshToonMaterial({ color, gradientMap: ramp });
}
export function block(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  m: T.Material,
) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function label(text: string, sub = '', color = '#f2dab1', vertical = false) {
  const c = document.createElement('canvas');
  c.width = vertical ? 256 : 1024;
  c.height = vertical ? 1024 : 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#111521';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = color;
  x.lineWidth = 4;
  x.strokeRect(12, 12, c.width - 24, c.height - 24);
  x.fillStyle = color;
  x.textAlign = 'center';
  if (vertical) {
    x.font = 'bold 120px Georgia';
    [...text.replaceAll(' ', '')].forEach((t, i) => x.fillText(t, 128, 120 + i * 124));
  } else {
    x.font = 'bold 70px Georgia';
    x.fillText(text, 512, 124);
    x.font = '25px sans-serif';
    x.letterSpacing = '6px';
    x.fillText(sub, 512, 194);
  }
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
function pavement() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#343b4c';
  x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 5; col++) {
      const px = col * 128 + (row % 2) * 64,
        py = row * 64;
      const n = (row * 7 + col * 13 + 80) % 12;
      x.fillStyle = `rgb(${53 + n},${59 + n},${72 + n})`;
      x.fillRect(px + 3, py + 3, 122, 58);
      x.strokeStyle = '#707782';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px + 6, py + 5);
      x.lineTo(px + 119, py + 5);
      x.stroke();
      x.strokeStyle = '#262e3e';
      x.beginPath();
      x.moveTo(px + 8, py + 49);
      x.lineTo(px + 37, py + 52);
      x.lineTo(px + 44, py + 57);
      x.stroke();
    }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(18, 18);
  t.anisotropy = 4;
  return t;
}
export function createWorld(scene: T.Scene) {
  scene.background = new T.Color(0x182238);
  scene.fog = new T.FogExp2(0x1c2942, 0.008);
  scene.add(new T.HemisphereLight(0xabbde1, 0x443a3e, 1.5));
  const sun = new T.DirectionalLight(0xc8d9ff, 2.6);
  sun.position.set(-25, 45, -35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -42,
    right: 42,
    top: 42,
    bottom: -42,
    near: 0.1,
    far: 130,
  });
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const wall = mat(0x666571),
    trim = mat(0xaaa6a0),
    ink = mat(0x1c2434),
    wood = mat(0x56414a),
    brass = new T.MeshStandardMaterial({ color: 0xc0a26b, metalness: 0.65, roughness: 0.37 }),
    red = mat(0xb94440),
    teal = mat(0x385d64),
    warm = new T.MeshBasicMaterial({ color: 0xeeb577 }),
    glass = new T.MeshStandardMaterial({ color: 0x253d50, metalness: 0.35, roughness: 0.19 }),
    roof = mat(0x34404c);
  const staticRoot = new T.Group();
  scene.add(staticRoot);
  const b = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material) =>
    block(staticRoot, x, y, z, w, h, d, m);
  const cylinder = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: T.Material,
    n = 10,
  ) => {
    const o = new T.Mesh(new T.CylinderGeometry(r, r, h, n), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    staticRoot.add(o);
    return o;
  };
  const sign = (
    text: string,
    sub: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rotation = 0,
    color = '#ebc99e',
    vertical = false,
  ) => {
    const o = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: label(text, sub, color, vertical), side: T.DoubleSide }),
    );
    o.position.set(x, y, z);
    o.rotation.y = rotation;
    scene.add(o);
    return o;
  };
  const ground = new T.MeshStandardMaterial({
    map: pavement(),
    color: 0xb5bed3,
    roughness: 0.43,
    metalness: 0.2,
  });
  b(0, -0.3, 0, 80, 0.6, 80, ground);
  // Narrow brass tram rails lead the eye toward the transit arch.
  for (const x of [-3.4, 3.4]) {
    b(x, 0.013, 0, 0.065, 0.025, 72, brass);
    b(x + 0.13, 0.014, 0, 0.04, 0.025, 72, ink);
  }
  // Every solid visible here comes from the authoritative collision manifest.
  const breakables = new Map<string, T.Group>();
  for (const s of DISTRICT) {
    if (s.id.startsWith('furniture')) continue;
    if (s.hp) {
      const g = new T.Group();
      g.position.set(s.x, s.y + s.h / 2, s.z);
      const material = s.material === 'wood' ? wood : trim;
      block(g, 0, 0, 0, s.w, s.h, s.d, material);
      for (let i = 1; i < 6; i++) {
        const line = block(g, -s.w / 2 + (i * s.w) / 6, 0, s.d / 2 + 0.012, 0.024, s.h, 0.02, ink);
        line.castShadow = false;
      }
      scene.add(g);
      breakables.set(s.id, g);
    } else {
      b(
        s.x,
        s.y + s.h / 2,
        s.z,
        s.w,
        s.h,
        s.d,
        s.id.startsWith('roof') || s.id.startsWith('stair') ? roof : wall,
      );
    }
  }
  // Ceramic cover doubles as the tram line's ticket barriers, with permanent corner trim.
  for (const z of [-12, 12]) {
    for (const x of [-3.65, 3.65]) {
      b(x, 1.25, z, 0.18, 2.5, 0.7, brass);
      b(x, 2.55, z, 0.32, 0.15, 0.9, ink);
    }
    b(0, 2.55, z, 7.5, 0.18, 0.7, ink);
    sign('NIGHT LINE / TICKETS', 'CERAMIC PANELS / HANDLE WITH CARE', 0, 2.11, z + 0.2, 5, 0.48);
  }
  // Storefront kit: tall recessed windows, cornices, brackets and upper floor rhythm.
  for (const side of [-1, 1]) {
    const front = side * 22.85;
    for (let n = 0; n < 6; n++) {
      const z = -25 + n * 10,
        high = 13 + (n % 3) * 2;
      // Upper volumes come from the collision manifest; roof terrace stays open.
      for (const y of [5, 6.3, 10.6, high + 0.1]) b(side * 22.6, y, z, 0.65, 0.25, 10, trim);
      for (const dz of [-3, 0, 3])
        for (const y of [8.3, 12]) {
          if (y > high - 1) continue;
          b(front, y, z + dz, 0.12, 2.1, 1.5, ink);
          b(
            front - side * 0.07,
            y,
            z + dz,
            0.15,
            1.8,
            1.2,
            (n + Math.round(dz)) % 3 === 0 ? warm : glass,
          );
          b(front - side * 0.18, y, z + dz, 0.19, 0.1, 1.5, trim);
          b(front - side * 0.18, y, z + dz, 0.19, 2.1, 0.09, trim);
          b(front - side * 0.2, y - 1.16, z + dz, 0.55, 0.18, 1.8, trim);
        }
      // Roof silhouette: chimneys, aerials and articulated parapets.
      b(side * 27.5, high + 0.5, z, 9.4, 0.9, 10.2, ink);
      b(side * 24, high + 1.5, z + 2, 1.1, 3, 1.4, wall);
      cylinder(side * 27, high + 2, z - 2, 0.07, 4, brass);
      // Shop interiors can be entered through the open portal at each pier interval.
      b(side * 25, 0.025, z, 13.5, 0.05, 9.5, wood);
      b(side * 30.8, 1.2, z, 1, 2.4, 5, teal);
      b(side * 30.8, 2.5, z, 1.5, 0.15, 5.2, brass);
      for (const offset of [-2, 2]) {
        cylinder(side * 24, 0.6, z + offset, 0.85, 1.2, wood);
        cylinder(side * 24, 1.25, z + offset, 1.05, 0.12, trim);
        for (const dx of [-1.6, 1.6]) cylinder(side * 24 + dx, 0.45, z + offset, 0.35, 0.9, red);
      }
      for (const zz of [-20, -10, 10, 20]) {
        if (z !== zz - 5) continue;
        b(side * 17.45, 2.7, zz, 0.12, 2.7, 4, glass);
        b(side * 17.3, 1.15, zz, 0.2, 0.2, 4.5, brass);
        b(side * 17.3, 4.3, zz, 0.25, 0.25, 5, brass);
      }
      const canopy = b(side * 16.8, 4.7, z, 2.8, 0.15, 8, n % 2 ? red : teal);
      canopy.rotation.z = side * 0.1;
      for (const dz of [-3.7, 3.7]) {
        cylinder(side * 15.6, 2.4, z + dz, 0.065, 4.8, brass);
        b(side * 15.6, 4.1, z + dz, 0.45, 0.65, 0.45, warm);
      }
    }
    // Lit back walls create welcoming interior depth rather than black voids.
    for (const z of [-20, 10]) {
      const light = new T.PointLight(0xffbe7d, 36, 17, 2);
      light.position.set(side * 26, 3.7, z);
      scene.add(light);
    }
  }
  sign(
    'CROW & ANVIL',
    'GUNS  /  TALISMANS  /  A BRIGHTER TOMORROW',
    -17.23,
    4,
    -20,
    7.5,
    1.6,
    Math.PI / 2,
  );
  sign(
    'VELVET SPOON',
    'BREAKFAST UNTIL THE END OF TIME',
    -17.23,
    4,
    10,
    7.5,
    1.6,
    Math.PI / 2,
    '#ffae9b',
  );
  sign(
    'LAST CALL',
    'JAZZ  /  DRINKS  /  DIVINATION',
    17.23,
    4,
    20,
    7.5,
    1.6,
    -Math.PI / 2,
    '#ff9b7b',
  );
  sign(
    'DEAD LETTER OFFICE',
    'SOME ADDRESSES ARE ONLY A MEMORY',
    17.23,
    4,
    -20,
    7.5,
    1.6,
    -Math.PI / 2,
    '#badbd4',
  );
  const neon = sign('LASTCALL', '', -16.5, 10, -8, 1.9, 8.4, 0, '#ff7655', true);
  const glow = new T.PointLight(0xff603e, 65, 23, 2);
  glow.position.set(-13, 8, -7);
  scene.add(glow);
  // Original illustrated guild posters: one atlas, four clear place identities.
  const atlas = new T.TextureLoader().load(`${import.meta.env.BASE_URL}assets/world/posters.png`);
  atlas.colorSpace = T.SRGBColorSpace;
  for (const [n, side, z] of [
    [0, 1, 20],
    [1, -1, -20],
    [2, 1, -10],
    [3, -1, 10],
  ]) {
    const texture = atlas.clone();
    texture.repeat.set(0.496, 0.496);
    texture.offset.set((n % 2) * 0.5 + 0.002, n < 2 ? 0.502 : 0.002);
    texture.needsUpdate = true;
    const poster = new T.Mesh(
      new T.PlaneGeometry(3.8, 2.55),
      new T.MeshBasicMaterial({ map: texture }),
    );
    poster.position.set(side * 17.18, 2.7, z);
    poster.rotation.y = (-side * Math.PI) / 2;
    scene.add(poster);
    // Also visible from inside the room, where it becomes a useful landmark.
    const inner = poster.clone();
    inner.position.x = side * 31.7;
    scene.add(inner);
  }
  // Fine authored street kit, all static pieces merge with their shared materials.
  for (const side of [-1, 1])
    for (const z of [-24, -4, 16]) {
      const x = side * 17.35;
      cylinder(x, 2.5, z, 0.09, 5, brass);
      b(x, 1.1, z + 1.2, 0.35, 0.7, 0.55, teal);
      b(x - side * 0.2, 1.2, z + 1.2, 0.04, 0.22, 0.3, ink);
      for (let k = 0; k < 3; k++) {
        const bx = side * (13.5 + k * 0.55);
        cylinder(bx, 0.48, z, 0.25, 0.96, wood);
        for (const y of [0.12, 0.78]) cylinder(bx, y, z, 0.27, 0.06, brass);
      }
      b(side * 17, 0.28, z + 3, 1.2, 0.55, 2.4, wood);
      for (let k = 0; k < 9; k++) {
        const leaf = new T.Mesh(new T.ConeGeometry(0.25, 0.7, 5), teal);
        leaf.position.set(side * 17 + Math.sin(k * 2) * 0.4, 0.75, z + 3 + Math.cos(k * 2) * 0.8);
        leaf.rotation.z = Math.sin(k) * 0.4;
        staticRoot.add(leaf);
      }
    }
  // Stylized reflected practicals, cheap painted pools instead of noisy screen-space reflections.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 64;
  glowCanvas.height = 128;
  const gx = glowCanvas.getContext('2d')!,
    gradient = gx.createRadialGradient(32, 64, 2, 32, 64, 60);
  gradient.addColorStop(0, 'rgba(255,200,140,.2)');
  gradient.addColorStop(1, 'rgba(255,150,100,0)');
  gx.fillStyle = gradient;
  gx.fillRect(0, 0, 64, 128);
  const glowTexture = new T.CanvasTexture(glowCanvas);
  const reflectionMat = new T.MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  for (const side of [-1, 1])
    for (const z of [-20, 0, 20]) {
      const pool = new T.Mesh(new T.PlaneGeometry(8, 12), reflectionMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(side * 13, 0.035, z);
      scene.add(pool);
    }
  sign('ROOF ACCESS', 'STAIRS / KEEP MOVING', 15, 2.8, 29, 3, 0.85);
  sign('ROOF ACCESS', 'STAIRS / KEEP MOVING', -15, 2.8, 29, 3, 0.85);
  // Transit arch: focal landmark, clock and suspended track into the clouds.
  const arch = new T.Mesh(new T.TorusGeometry(10, 0.65, 8, 48, Math.PI), trim);
  arch.position.set(0, 10, -34);
  staticRoot.add(arch);
  for (const x of [-10, 10]) {
    b(x, 5, -34, 1.3, 10, 1.7, trim);
    b(x, 10, -34, 2, 0.4, 2, brass);
  }
  sign('NIGHT LINE 07', 'ALL ROADS LEAD SOMEWHERE ELSE', 0, 11, -33.2, 9, 1.8);
  const clockFace = new T.Mesh(new T.CircleGeometry(1.4, 40), warm);
  clockFace.position.set(0, 17.5, -33.25);
  staticRoot.add(clockFace);
  b(0, 18, -33.18, 0.06, 1, 0.04, ink);
  const hand = b(0.32, 17.5, -33.17, 0.7, 0.06, 0.04, ink);
  hand.rotation.z = -0.5;
  for (let n = 0; n < 18; n++) {
    const z = -43 - n * 5;
    b(-3.4, 8 + n * 0.22, z, 0.2, 0.25, 5.1, ink);
    b(3.4, 8 + n * 0.22, z, 0.2, 0.25, 5.1, ink);
  }
  // Lamps, drain grates and street notices reinforce human scale.
  for (const side of [-1, 1])
    for (const z of [-28, -13, 2, 17, 30]) {
      const x = side * 11.8;
      cylinder(x, 2.7, z, 0.09, 5.4, ink);
      cylinder(x, 0.15, z, 0.3, 0.3, brass);
      b(x, 5.15, z, 0.5, 0.7, 0.5, warm);
      b(x, 5.55, z, 0.7, 0.12, 0.7, ink);
      b(x, 4.77, z, 0.6, 0.12, 0.6, ink);
      for (const k of [-0.24, 0.24]) b(x + k, 5.15, z, 0.04, 0.7, 0.52, ink);
      b(x, 5.9, z, 0.08, 0.5, 0.08, brass);
    }
  for (let n = 0; n < 20; n++) {
    b(-11, 0.015, -32 + n * 3.4, 0.55, 0.025, 0.65, ink);
    for (let k = 0; k < 5; k++) b(-11.2 + k * 0.1, 0.03, -32 + n * 3.4, 0.035, 0.012, 0.55, brass);
  }
  // Decorative skyline uses simple silhouette geometry beyond the accessible district.
  const far = mat(0x27334d),
    far2 = mat(0x35445e);
  for (let n = 0; n < 42; n++) {
    const a = n * 2.399,
      r = 68 + (n % 4) * 12,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r,
      h = 14 + (n % 7) * 4;
    b(x, h / 2 - 3, z, 5 + (n % 5), h, 5 + (n % 3), n % 2 ? far : far2);
    const spire = new T.Mesh(new T.ConeGeometry(3, 9, 4), far);
    spire.position.set(x, h + 1, z);
    staticRoot.add(spire);
    for (let j = 0; j < 4; j++)
      b(x - 1 + (j % 2) * 2, h - 5 - Math.floor(j / 2) * 3, z + 3, 0.4, 0.9, 0.04, warm);
  }
  const moon = new T.Mesh(
    new T.SphereGeometry(5, 24, 16),
    new T.MeshBasicMaterial({ color: 0xffefd2, fog: false }),
  );
  moon.position.set(27, 43, -95);
  scene.add(moon);
  const cables = new T.Group();
  scene.add(cables);
  for (const z of [-22, 0, 20]) {
    const points = Array.from(
      { length: 30 },
      (_, i) => new T.Vector3(-19 + (i * 38) / 29, 14 - Math.sin((i / 29) * Math.PI) * 2, z),
    );
    cables.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({ color: 0x101624 }),
      ),
    );
  }
  // Merge static geometry by material: detail density without one draw call per brick.
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  staticRoot.updateMatrixWorld(true);
  staticRoot.traverse((o) => {
    if (o instanceof T.Mesh && !Array.isArray(o.material)) {
      const list = batches.get(o.material) ?? [];
      list.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      batches.set(o.material, list);
      o.geometry.dispose();
    }
  });
  scene.remove(staticRoot);
  for (const [material, list] of batches) {
    const geometry = mergeGeometries(list, false);
    if (geometry) {
      const m = new T.Mesh(geometry, material);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    list.forEach((g) => g.dispose());
  }
  // Rain is bounded near the district; opacity keeps moving targets readable.
  const rainPositions = new Float32Array(900 * 3);
  for (let n = 0; n < 900; n++) {
    rainPositions[n * 3] = ((n * 19.73) % 76) - 38;
    rainPositions[n * 3 + 1] = (n * 3.41) % 22;
    rainPositions[n * 3 + 2] = ((n * 31.37) % 76) - 38;
  }
  const rainGeometry = new T.BufferGeometry();
  rainGeometry.setAttribute('position', new T.BufferAttribute(rainPositions, 3));
  const rain = new T.Points(
    rainGeometry,
    new T.PointsMaterial({
      color: 0xbed0e0,
      size: 0.035,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  scene.add(rain);
  const ring = new T.Mesh(
    new T.CylinderGeometry(1, 1, 10, 96, 1, true),
    new T.MeshBasicMaterial({
      color: 0xe64d50,
      transparent: true,
      opacity: 0.09,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.position.y = 5;
  ring.scale.set(37, 1, 37);
  ring.visible = false;
  scene.add(ring);
  const debris: { mesh: T.Mesh; v: T.Vector3; spin: T.Vector3; life: number }[] = [];
  const broken = new Set<string>();
  const chunkGeometry = new T.BoxGeometry(1, 1, 1);
  const fractureGeometry: T.BufferGeometry[] = [];
  void fetch(`${import.meta.env.BASE_URL}assets/world/fragments.json`)
    .then((r) => {
      if (!r.ok) throw Error('Fragment load');
      return r.json();
    })
    .then((data: { position: number[]; normal: number[]; index: number[] | null }[]) => {
      for (const f of data) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(f.position, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(f.normal, 3));
        if (f.index) g.setIndex(f.index);
        fractureGeometry.push(g);
      }
    })
    .catch((e) => console.warn('Prepared fragments unavailable; using slat fallback', e));
  function syncDamage(damage: DamageState, animate = true) {
    for (const s of BREAKABLES) {
      const destroyed = (damage[s.id] ?? 0) >= s.hp!;
      breakables.get(s.id)!.visible = !destroyed;
      if (destroyed && !broken.has(s.id) && animate) {
        for (let k = 0; k < 12 && debris.length < 64; k++) {
          const fractured = s.material !== 'wood' && fractureGeometry[k];
          const m = new T.Mesh(fractured || chunkGeometry, s.material === 'wood' ? wood : trim);
          if (fractured) {
            m.scale.set(s.w, s.h, s.d);
            m.position.set(s.x, s.y + s.h / 2, s.z);
          } else {
            m.scale.set((s.w / 4) * 0.94, (s.h / 3) * 0.94, Math.min(s.d, 0.3));
            m.position.set(
              s.x + (((k % 4) - 1.5) * s.w) / 4,
              s.y + ((Math.floor(k / 4) + 0.5) * s.h) / 3,
              s.z,
            );
          }
          scene.add(m);
          debris.push({
            mesh: m,
            v: new T.Vector3(Math.sin(k * 8) * 2, 1 + (k % 3), Math.cos(k * 7) * 3),
            spin: new T.Vector3(k * 0.3, 1, k * 0.1),
            life: 3.5,
          });
        }
      }
      if (destroyed) broken.add(s.id);
      else broken.delete(s.id);
    }
  }
  return {
    ring,
    syncDamage,
    update(time: number, dt = 1 / 60) {
      neon.material.opacity = 1;
      glow.intensity = 64 + Math.sin(time * 0.7) * 2;
      for (let n = 0; n < 900; n++) {
        rainPositions[n * 3 + 1] -= dt * 9;
        if (rainPositions[n * 3 + 1] < 0) rainPositions[n * 3 + 1] = 22;
      }
      rainGeometry.attributes.position.needsUpdate = true;
      for (let n = debris.length - 1; n >= 0; n--) {
        const d = debris[n];
        d.life -= dt;
        d.v.y -= dt * 12;
        d.mesh.position.addScaledVector(d.v, dt);
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.z += d.spin.z * dt;
        if (d.mesh.position.y < 0.12) {
          d.mesh.position.y = 0.12;
          d.v.multiplyScalar(0.4);
          d.v.y = Math.abs(d.v.y) * 0.3;
        }
        if (d.life < 0.5) d.mesh.scale.multiplyScalar(Math.exp(-dt * 8));
        if (d.life <= 0) {
          scene.remove(d.mesh);
          debris.splice(n, 1);
        }
      }
    },
  };
}
