/** Pure deterministic gameplay. Shared by the authoritative server and client prediction. */
export const DT = 1 / 30;
export const WORLD = 38;
import { STREET_COVER, activeSolids, type DamageState, type Solid } from './district';
export const COVER = STREET_COVER;
export interface Input {
  mx: number;
  mz: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  dash: boolean;
  fire: boolean;
  reload: boolean;
  melee: boolean;
  guard: boolean;
  seq: number;
}
export const blankInput = (): Input => ({
  mx: 0,
  mz: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sprint: false,
  crouch: false,
  dash: false,
  fire: false,
  reload: false,
  melee: false,
  guard: false,
  seq: 0,
});
export interface Fighter {
  id: string;
  name: string;
  hero: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  hp: number;
  ammo: number;
  reload: number;
  shotCd: number;
  dashCd: number;
  dashTime: number;
  slideTime: number;
  meleeCd: number;
  guard: boolean;
  grounded: boolean;
  alive: boolean;
  seq: number;
  shots: number;
  hits: number;
  distance: number;
  dodges: number;
  jumps: number;
  combo: number;
  lastHit: number;
}
export function fighter(id: string, name: string, hero = 0, x = 0, z = 20): Fighter {
  return {
    id,
    name,
    hero,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    ammo: 8,
    reload: 0,
    shotCd: 0,
    dashCd: 0,
    dashTime: 0,
    slideTime: 0,
    meleeCd: 0,
    guard: false,
    grounded: true,
    alive: true,
    seq: 0,
    shots: 0,
    hits: 0,
    distance: 0,
    dodges: 0,
    jumps: 0,
    combo: 0,
    lastHit: -99,
  };
}
export type GameEvent = {
  type:
    | 'shot'
    | 'hit'
    | 'melee'
    | 'dash'
    | 'jump'
    | 'land'
    | 'reload'
    | 'parry'
    | 'out'
    | 'break'
    | 'chip';
  actor: string;
  target?: string;
  x: number;
  y: number;
  z: number;
  damage?: number;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function step(p: Fighter, i: Input, dt: number, damage: DamageState = {}): GameEvent[] {
  const ev: GameEvent[] = [];
  const emit = (type: GameEvent['type']) => ev.push({ type, actor: p.id, x: p.x, y: p.y, z: p.z });
  if (!p.alive) return ev;
  dt = clamp(dt, 0, 0.05);
  p.seq = i.seq;
  p.yaw = i.yaw;
  p.pitch = clamp(i.pitch, -1.4, 1.4);
  p.guard = i.guard;
  for (const k of ['shotCd', 'dashCd', 'dashTime', 'slideTime', 'meleeCd'] as const)
    p[k] = Math.max(0, p[k] - dt);
  if (p.reload > 0) {
    p.reload = Math.max(0, p.reload - dt);
    if (p.reload === 0) p.ammo = 8;
  }
  if (i.reload && p.ammo < 8 && p.reload === 0) {
    p.reload = 1.15;
    emit('reload');
  }
  let mx = clamp(i.mx, -1, 1),
    mz = clamp(i.mz, -1, 1);
  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }
  const dx = mx * Math.cos(p.yaw) - mz * Math.sin(p.yaw),
    dz = -mx * Math.sin(p.yaw) - mz * Math.cos(p.yaw);
  if (i.dash && p.dashCd === 0) {
    p.dashCd = 0.95;
    p.dashTime = 0.17;
    p.vx = (mag > 0.1 ? dx : -Math.sin(p.yaw)) * 23;
    p.vz = (mag > 0.1 ? dz : -Math.cos(p.yaw)) * 23;
    p.dodges++;
    emit('dash');
  }
  if (i.crouch && i.sprint && p.grounded && p.slideTime === 0 && Math.hypot(p.vx, p.vz) > 8) {
    p.slideTime = 0.55;
    p.vx *= 1.22;
    p.vz *= 1.22;
  }
  if (i.jump && p.grounded) {
    p.vy = 9;
    p.grounded = false;
    p.slideTime = 0;
    p.jumps++;
    emit('jump');
  }
  if (p.dashTime === 0) {
    const speed = p.guard ? 4 : i.crouch && p.slideTime === 0 ? 3.5 : i.sprint ? 11.5 : 7.5;
    const a = 1 - Math.exp(-(p.grounded ? 22 : 6) * dt);
    if (p.slideTime > 0) {
      p.vx *= Math.exp(-1.4 * dt);
      p.vz *= Math.exp(-1.4 * dt);
    } else {
      p.vx += (dx * speed - p.vx) * a;
      p.vz += (dz * speed - p.vz) * a;
    }
  }
  p.vy -= 25 * dt;
  let nx = p.x + p.vx * dt,
    nz = p.z + p.vz * dt,
    ny = p.y + p.vy * dt;
  let floor = 0;
  const height = i.crouch ? 1.05 : 1.72;
  const solids = activeSolids(damage);
  // Resolve each horizontal axis independently; small stairs auto-step, ceilings remain solid.
  for (const axis of ['x', 'z'] as const) {
    for (const b of solids) {
      const xx = axis === 'x' ? nx : p.x,
        zz = axis === 'z' ? nz : p.z;
      if (Math.abs(xx - b.x) >= b.w / 2 + 0.36 || Math.abs(zz - b.z) >= b.d / 2 + 0.36) continue;
      const top = b.y + b.h;
      if (p.y >= top - 0.05 || p.y + height <= b.y + 0.01) continue;
      if (p.grounded && top - p.y <= 0.34) {
        ny = Math.max(ny, top);
        floor = Math.max(floor, top);
        continue;
      }
      if (axis === 'x') {
        nx = p.x;
        p.vx = 0;
      } else {
        nz = p.z;
        p.vz = 0;
      }
    }
  }
  for (const b of solids) {
    if (Math.abs(nx - b.x) >= b.w / 2 + 0.32 || Math.abs(nz - b.z) >= b.d / 2 + 0.32) continue;
    const top = b.y + b.h;
    if (p.y >= top - 0.05 && p.vy <= 0) floor = Math.max(floor, top);
    if (p.vy > 0 && p.y + height <= b.y + 0.05 && ny + height > b.y) {
      ny = b.y - height;
      p.vy = 0;
    }
  }
  p.distance += Math.hypot(nx - p.x, nz - p.z);
  p.x = clamp(nx, -WORLD, WORLD);
  p.z = clamp(nz, -WORLD, WORLD);
  if (ny <= floor) {
    if (!p.grounded && p.vy < -4) emit('land');
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  } else {
    p.y = ny;
    p.grounded = false;
  }
  if (i.fire && p.shotCd === 0 && p.reload === 0 && p.ammo > 0 && !p.guard) {
    p.ammo--;
    p.shotCd = 0.235;
    p.shots++;
    emit('shot');
  }
  if (i.melee && p.meleeCd === 0 && p.reload === 0) {
    p.meleeCd = 0.7;
    emit('melee');
  }
  return ev;
}
export function raySolid(
  ax: number,
  ay: number,
  az: number,
  dx: number,
  dy: number,
  dz: number,
  b: Solid,
  maxDistance = 90,
) {
  let lo = 0,
    hi = maxDistance;
  for (const [a, d, min, max] of [
    [ax, dx, b.x - b.w / 2, b.x + b.w / 2],
    [ay, dy, b.y, b.y + b.h],
    [az, dz, b.z - b.d / 2, b.z + b.d / 2],
  ]) {
    if (Math.abs(d) < 1e-8) {
      if (a < min || a > max) return Infinity;
    } else {
      let t1 = (min - a) / d,
        t2 = (max - a) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}
export function blocked(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  damage: DamageState = {},
) {
  return activeSolids(damage).some(
    (b) => raySolid(ax, ay, az, bx - ax, by - ay, bz - az, b, 1) !== Infinity,
  );
}
export function resolveAttack(
  p: Fighter,
  others: Fighter[],
  kind: 'shot' | 'melee',
  time: number,
  damage: DamageState = {},
): GameEvent[] {
  const dir = {
    x: -Math.sin(p.yaw) * Math.cos(p.pitch),
    y: Math.sin(p.pitch),
    z: -Math.cos(p.yaw) * Math.cos(p.pitch),
  };
  let chosen: Fighter | undefined,
    nearest = kind === 'melee' ? 3 : 90;
  let obstacle: Solid | undefined;
  for (const b of activeSolids(damage)) {
    const t = raySolid(p.x, p.y + 1.55, p.z, dir.x, dir.y, dir.z, b, nearest);
    if (t < nearest) {
      nearest = t;
      obstacle = b;
    }
  }
  for (const q of others) {
    if (q.id === p.id || !q.alive) continue;
    const x = q.x - p.x,
      y = q.y + 1 - (p.y + 1.55),
      z = q.z - p.z;
    const along = x * dir.x + y * dir.y + z * dir.z;
    const dist = Math.hypot(x, y, z);
    const side = Math.sqrt(Math.max(0, dist * dist - along * along));
    if (
      along > 0 &&
      along < nearest &&
      side < (kind === 'melee' ? 1.6 : 0.65) &&
      !blocked(p.x, p.y + 1.55, p.z, q.x, q.y + 1, q.z, damage)
    ) {
      chosen = q;
      nearest = along;
    }
  }
  if (!chosen) {
    if (!obstacle?.hp) return [];
    const b = obstacle;
    damage[b.id] = (damage[b.id] ?? 0) + (kind === 'melee' ? 36 : 18);
    return [
      {
        type: damage[b.id] >= b.hp! ? 'break' : 'chip',
        actor: p.id,
        target: b.id,
        x: p.x + dir.x * nearest,
        y: p.y + 1.55 + dir.y * nearest,
        z: p.z + dir.z * nearest,
      },
    ];
  }
  const q = chosen;
  const facing = Math.sin(q.yaw) * (p.x - q.x) + Math.cos(q.yaw) * (p.z - q.z) < 0;
  if (q.guard && facing) {
    return [{ type: 'parry', actor: q.id, target: p.id, x: q.x, y: q.y + 1, z: q.z }];
  }
  const dealt = kind === 'melee' ? 30 : 18;
  q.hp = Math.max(0, q.hp - dealt);
  q.vx += dir.x * (kind === 'melee' ? 12 : 3);
  q.vz += dir.z * (kind === 'melee' ? 12 : 3);
  q.vy = Math.max(q.vy, kind === 'melee' ? 4 : 0);
  q.alive = q.hp > 0;
  p.hits++;
  p.combo = time - p.lastHit < 1.5 ? p.combo + 1 : 1;
  p.lastHit = time;
  return [
    { type: 'hit', actor: p.id, target: q.id, x: q.x, y: q.y + 1, z: q.z, damage: dealt },
    ...(!q.alive
      ? [{ type: 'out' as const, actor: p.id, target: q.id, x: q.x, y: q.y, z: q.z }]
      : []),
  ];
}
