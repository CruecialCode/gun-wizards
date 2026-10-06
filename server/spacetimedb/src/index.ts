import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import {
  fighter,
  blankInput,
  step,
  resolveAttack,
  DT,
  type Fighter,
  type Input,
} from '../../../shared/simulation';
import { SPAWNS, type DamageState } from '../../../shared/district';
const clock = table(
  {},
  { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt() },
);
const db = schema({
  district: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      damage: t.array(t.object('ObjectDamage', { id: t.string(), amount: t.f64() })),
    },
  ),
  player: table(
    { public: true },
    {
      identity: t.identity().primaryKey(),
      name: t.string(),
      hero: t.u32(),
      room: t.string(),
      state: t.string(),
      input: t.string(),
      lastInput: t.u64(),
    },
  ),
  arena: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      phase: t.string(),
      elapsed: t.f64(),
      radius: t.f64(),
      winner: t.string(),
      round: t.u32(),
    },
  ),
  event: table(
    { public: true },
    { id: t.u64().primaryKey().autoInc(), room: t.string(), payload: t.string(), expires: t.u64() },
  ),
  clock,
});
export default db;
export const init = db.init((ctx) => {
  ctx.db.clock.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(33333n) });
});
export const join = db.reducer({ name: t.string(), hero: t.u32(), room: t.string() }, (ctx, a) => {
  const name = a.name.trim();
  if (name.length < 1 || name.length > 20 || a.hero > 2 || !/^[-a-zA-Z0-9]{1,24}$/.test(a.room))
    throw new SenderError('Choose a name (1–20 characters), hero, and valid room.');
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) throw new SenderError('Leave your current match first.');
  let arena = ctx.db.arena.id.find(a.room);
  if (arena?.phase === 'playing')
    throw new SenderError('This round has started. Try another room.');
  const count = [...ctx.db.player.iter()].filter((p) => p.room === a.room).length;
  if (count >= 8) throw new SenderError('Room full (8 players).');
  if (!arena)
    ctx.db.arena.insert({
      id: a.room,
      phase: 'waiting',
      elapsed: 0,
      radius: 37,
      winner: '',
      round: 1,
    });
  if (!ctx.db.district.id.find(a.room)) ctx.db.district.insert({ id: a.room, damage: [] });
  const angle = count * Math.PI * 0.75;
  const p = fighter(ctx.sender.toHexString(), name, a.hero, ...SPAWNS[count]);
  p.yaw = angle;
  ctx.db.player.insert({
    identity: ctx.sender,
    name,
    hero: a.hero,
    room: a.room,
    state: JSON.stringify(p),
    input: JSON.stringify(blankInput()),
    lastInput: ctx.timestamp.microsSinceUnixEpoch,
  });
});
export const leave = db.reducer((ctx) => {
  ctx.db.player.identity.delete(ctx.sender);
});
export const disconnect = db.clientDisconnected((ctx) => {
  ctx.db.player.identity.delete(ctx.sender);
});
export const control = db.reducer({ input: t.string() }, (ctx, { input }) => {
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p) return;
  if (input.length > 700) throw new SenderError('Input too large');
  let a: Input;
  try {
    a = JSON.parse(input);
  } catch {
    throw new SenderError('Invalid input');
  }
  for (const k of ['mx', 'mz', 'yaw', 'pitch', 'seq'] as const)
    if (typeof a[k] !== 'number' || !Number.isFinite(a[k])) throw new SenderError('Invalid input');
  for (const k of ['jump', 'sprint', 'crouch', 'dash', 'fire', 'reload', 'melee', 'guard'] as const)
    if (typeof a[k] !== 'boolean') throw new SenderError('Invalid input');
  if (
    Math.abs(a.mx) > 1 ||
    Math.abs(a.mz) > 1 ||
    Math.abs(a.yaw) > 1e6 ||
    Math.abs(a.pitch) > 1.5 ||
    a.seq < 0 ||
    a.seq > Number.MAX_SAFE_INTEGER
  )
    throw new SenderError('Input out of range');
  const old: Input = JSON.parse(p.input);
  if (a.seq <= old.seq) return;
  ctx.db.player.identity.update({
    ...p,
    input: JSON.stringify(a),
    lastInput: ctx.timestamp.microsSinceUnixEpoch,
  });
});
export const startRound = db.reducer((ctx) => {
  const me = ctx.db.player.identity.find(ctx.sender);
  if (!me) return;
  const a = ctx.db.arena.id.find(me.room)!;
  if (a.phase === 'playing') return;
  const players = [...ctx.db.player.iter()].filter((p) => p.room === me.room);
  if (players.length < 2) throw new SenderError('Two players are needed to start.');
  players.forEach((p, n) => {
    const angle = (n * Math.PI * 2) / players.length;
    const f = fighter(p.identity.toHexString(), p.name, p.hero, ...SPAWNS[n]);
    f.yaw = angle;
    ctx.db.player.identity.update({
      ...p,
      state: JSON.stringify(f),
      input: JSON.stringify(blankInput()),
    });
  });
  ctx.db.district.id.update({ id: me.room, damage: [] });
  ctx.db.arena.id.update({
    ...a,
    phase: 'playing',
    elapsed: 0,
    radius: 37,
    winner: '',
    round: a.round + 1,
  });
});
export const tick = db.reducer({ onSchedule: clock }, { timer: clock.rowType }, (ctx) => {
  if (!ctx.sender.isEqual(ctx.identity)) throw new SenderError('Scheduled only');
  const now = ctx.timestamp.microsSinceUnixEpoch;
  for (const old of ctx.db.event.iter()) if (old.expires < now) ctx.db.event.id.delete(old.id);
  for (const arena of ctx.db.arena.iter()) {
    const rows = [...ctx.db.player.iter()].filter((p) => p.room === arena.id);
    if (!rows.length) {
      ctx.db.arena.id.delete(arena.id);
      ctx.db.district.id.delete(arena.id);
      continue;
    }
    const fighters = rows.map((r) => JSON.parse(r.state) as Fighter);
    let elapsed = arena.elapsed,
      radius = arena.radius;
    if (arena.phase === 'playing') {
      elapsed += DT;
      radius = Math.max(2, 37 - Math.max(0, elapsed - 12) * 0.22);
    }
    const worldRow = ctx.db.district.id.find(arena.id);
    if (!worldRow) ctx.db.district.insert({ id: arena.id, damage: [] });
    const damage: DamageState = Object.fromEntries(
      (worldRow?.damage ?? []).map((d) => [d.id, d.amount]),
    );
    const events = [];
    for (let n = 0; n < rows.length; n++) {
      const r = rows[n],
        p = fighters[n];
      const input = now - r.lastInput > 250000n ? blankInput() : (JSON.parse(r.input) as Input);
      if (arena.phase === 'finished') continue;
      const es = step(p, input, DT, damage);
      events.push(...es);
      for (const e of es)
        if (arena.phase === 'playing' && (e.type === 'shot' || e.type === 'melee'))
          events.push(...resolveAttack(p, fighters, e.type, elapsed, damage));
      if (arena.phase === 'playing' && p.alive && Math.hypot(p.x, p.z) > radius) {
        p.hp = Math.max(0, p.hp - 14 * DT);
        p.alive = p.hp > 0;
      }
    }
    ctx.db.district.id.update({
      id: arena.id,
      damage: Object.entries(damage).map(([id, amount]) => ({ id, amount })),
    });
    for (let n = 0; n < rows.length; n++)
      ctx.db.player.identity.update({ ...rows[n], state: JSON.stringify(fighters[n]) });
    for (const e of events)
      ctx.db.event.insert({
        id: 0n,
        room: arena.id,
        payload: JSON.stringify(e),
        expires: now + 1500000n,
      });
    const alive = fighters.filter((p) => p.alive);
    const done = arena.phase === 'playing' && alive.length <= 1;
    ctx.db.arena.id.update({
      ...arena,
      elapsed,
      radius,
      phase: done ? 'finished' : arena.phase,
      winner: done ? (alive[0]?.name ?? 'The storm') : arena.winner,
    });
  }
});
