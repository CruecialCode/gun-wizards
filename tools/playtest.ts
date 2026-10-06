/** Headless multiplayer clients use the same public reducers as real players. */
import { DbConnection } from '../src/module_bindings';
import { blankInput, blocked, type Fighter } from '../shared/simulation';
import { writeFileSync, mkdirSync } from 'node:fs';
const useJev = process.argv.includes('--jev');
const room = `qa-${Date.now().toString(36)}`;
const clients: DbConnection[] = [];
const decisions: unknown[] = [];
const events: any[] = [];
let seq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  return new Promise<DbConnection>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 8000);
    DbConnection.builder()
      .withUri(process.env.SPACETIME_URI ?? 'ws://127.0.0.1:3000')
      .withDatabaseName(process.env.SPACETIME_DB ?? 'gun-wizards-local')
      .onConnect((c) => {
        c.db.event.onInsert((_ctx, e) => {
          if (e.room === room) events.push(JSON.parse(e.payload));
        });
        c.subscriptionBuilder()
          .onApplied(() => {
            clearTimeout(timeout);
            resolve(c);
          })
          .subscribe([
            'SELECT * FROM player',
            'SELECT * FROM arena',
            'SELECT * FROM event',
            'SELECT * FROM district',
          ]);
      })
      .onConnectError((_ctx, e) => {
        clearTimeout(timeout);
        reject(e);
      })
      .build();
  });
}
let strategies = ['advance', 'flank', 'advance', 'flank'];
async function judge(fighters: Fighter[], time: number) {
  if (!useJev) return;
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('TYPESAFE_API_KEY is required for --jev');
  const questions = Object.fromEntries(
    fighters.map((p, n) => [
      'p' + n,
      {
        type: 'choice',
        instructions: `Choose player ${p.name}'s next tactical action to survive and engage. Shots are blocked by COVER. Dodge has a cooldown. Guard blocks frontal shots. Reload at low ammo. Players should avoid camping.`,
        criteria: {
          advance: 'Close distance to the nearest opponent, staying mobile.',
          flank: 'Strafe around cover to find line of sight.',
          retreat: 'Create space and evade incoming damage.',
          guard: 'Hold a frontal defensive guard briefly.',
        },
      },
    ]),
  );
  const started = Date.now();
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: {
        time,
        players: fighters.map((p) => ({
          name: p.name,
          hp: p.hp,
          ammo: p.ammo,
          x: p.x,
          z: p.z,
          dashReady: p.dashCd === 0,
          alive: p.alive,
        })),
        arena:
          '80m square, cover near center and x +/-17; close-range strike 3m; gun 18 damage, eight rounds',
      },
      questions,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  const out = await res.json();
  strategies = fighters.map((_, n) => out.answers['p' + n]?.choice ?? 'flank');
  decisions.push({
    time,
    latencyMs: Date.now() - started,
    model: out.model,
    answers: out.answers,
    usage: out.usage,
  });
}
try {
  for (let n = 0; n < 4; n++) {
    const c = await connect();
    clients.push(c);
    await c.reducers.join({ name: `Jev-${n + 1}`, hero: n % 3, room });
  }
  await sleep(300);
  await clients[0].reducers.startRound({});
  let invalidRejected = false;
  try {
    await clients[0].reducers.control({
      input: JSON.stringify({ ...blankInput(), mx: 99, seq: 999 }),
    });
  } catch {
    invalidRejected = true;
  }
  let judging = false,
    lastJudge = -5;
  const start = Date.now();
  let ticks = 0;
  while (Date.now() - start < 45000) {
    const time = (Date.now() - start) / 1000;
    const rows = Array.from(clients[0].db.player.iter()).filter((p) => p.room === room);
    const fighters = rows.map((r) => JSON.parse(r.state) as Fighter);
    if (useJev && time - lastJudge > 3 && !judging) {
      judging = true;
      lastJudge = time;
      void judge(fighters, time)
        .catch((e) => {
          decisions.push({ error: String(e) });
        })
        .finally(() => (judging = false));
    }
    for (let n = 0; n < clients.length; n++) {
      const c = clients[n],
        p = fighters.find((f) => f.id === c.identity?.toHexString());
      if (!p || !p.alive) continue;
      const q = fighters
        .filter((f) => f.id !== p.id && f.alive)
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (!q) continue;
      const dx = q.x - p.x,
        dz = q.z - p.z,
        dist = Math.hypot(dx, dz),
        yaw = Math.atan2(-dx, -dz);
      const damage = Object.fromEntries(
        (c.db.district.id.find(room)?.damage ?? []).map((d) => [d.id, d.amount]),
      );
      const occluded = blocked(p.x, p.y + 1.55, p.z, q.x, q.y + 1, q.z, damage);
      const action = strategies[n];
      const i = {
        ...blankInput(),
        seq: ++seq,
        yaw,
        pitch: Math.atan2(q.y + 1 - (p.y + 1.55), dist),
        mz: dist > 10 ? 1 : action === 'retreat' ? -1 : 0,
        mx: occluded ? 1 : action === 'flank' ? (Math.sin(time + n) > 0 ? 1 : -1) : 0,
        sprint: dist > 15,
        jump: occluded && ticks % 20 === 0,
        dash: ticks % 43 === n * 5,
        reload: p.ammo === 0,
        fire: dist < 55,
        melee: dist < 2.8,
        guard: action === 'guard' && dist < 12,
      };
      await c.reducers.control({ input: JSON.stringify(i) });
    }
    ticks++;
    const arena = Array.from(clients[0].db.arena.iter()).find((a) => a.id === room);
    if (arena?.phase === 'finished') break;
    await sleep(34);
  }
  while (judging) await sleep(50);
  const states = clients.map((c) =>
    Array.from(c.db.player.iter())
      .filter((p) => p.room === room)
      .map((p) => JSON.parse(p.state) as Fighter),
  );
  const arena = Array.from(clients[0].db.arena.iter()).find((a) => a.id === room);
  const report = {
    date: new Date().toISOString(),
    mode: useJev ? 'Jev-directed live multiplayer' : 'deterministic live multiplayer',
    room,
    invalidInputRejected: invalidRejected,
    clients: clients.length,
    arena,
    players: states[0],
    destruction: clients.map((c) => c.db.district.id.find(room)?.damage),
    events: {
      breaks: events.filter((e) => e.type === 'break').length / 4,
      shots: events.filter((e) => e.type === 'shot').length / 4,
      hits: events.filter((e) => e.type === 'hit').length / 4,
      parries: events.filter((e) => e.type === 'parry').length / 4,
    },
    allClientsSeeFourPlayers: states.every((s) => s.length === 4),
    decisions,
    limitations: [
      'Bots use state observations and reducers, not human perception.',
      'These metrics measure responsiveness and decision opportunities, not proof of fun.',
    ],
  };
  mkdirSync('docs/qa', { recursive: true });
  writeFileSync(`docs/qa/${useJev ? 'jev-' : ''}multiplayer.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        clients: report.clients,
        invalidInputRejected: invalidRejected,
        arena,
        events: report.events,
        decisions: decisions.length,
        players: states[0].map((p) => ({
          name: p.name,
          hp: p.hp,
          shots: p.shots,
          hits: p.hits,
          distance: p.distance,
          dodges: p.dodges,
        })),
      },
      null,
      2,
    ),
  );
  if (!invalidRejected || !report.allClientsSeeFourPlayers) process.exitCode = 1;
} finally {
  for (const c of clients) {
    try {
      await c.reducers.leave({});
    } catch {}
    c.disconnect();
  }
}
