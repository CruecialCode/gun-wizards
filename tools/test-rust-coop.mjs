import assert from 'node:assert/strict';
const url = process.env.VEIL_WS ?? 'ws://127.0.0.1:8787/ws';
const room = `qa-${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clients = [];
async function connect() {
  const ws = new WebSocket(`${url}?room=${room}`);
  const client = { ws, id: null, state: null, hits: 0 };
  clients.push(client);
  ws.addEventListener('message', ({ data }) => {
    const value = JSON.parse(data);
    if (value.type === 'welcome') client.id = value.id;
    if (value.type === 'snapshot') {
      client.state = value;
      client.hits += value.events.filter((e) => e.kind === 'hit').length;
    }
  });
  await until(() => client.id !== null, 'welcome');
  return client;
}
async function until(predicate, label, timeout = 8000) {
  const begin = Date.now();
  while (!predicate()) {
    if (Date.now() - begin > timeout) throw Error(`Timed out: ${label}`);
    await sleep(25);
  }
}
const send = (c, value) => c.ws.send(JSON.stringify(value));
const input = (c, changes = {}) =>
  send(c, {
    type: 'input',
    mx: 0,
    mz: 0,
    yaw: 0,
    pitch: 0,
    fire: false,
    melee: false,
    spell: false,
    dodge: false,
    jump: false,
    reload: false,
    ...changes,
  });
const player = (c) => c.state.players.find((p) => p.id === c.id);
try {
  const a = await connect();
  const b = await connect();
  await until(() => a.state?.players.length === 2 && b.state?.players.length === 2, 'two players');
  send(b, { type: 'start', weapon: 1 });
  await sleep(150);
  assert.equal(a.state.phase, 'lobby', 'non-host cannot start');
  send(a, { type: 'start', weapon: 0 });
  await until(() => a.state?.phase === 'playing' && b.state?.enemies.length === 5, 'shared wave');
  const start = player(a).pos[0];
  input(a, { mx: 1 });
  await sleep(450);
  input(a);
  await sleep(150);
  assert(player(a).pos[0] > start + 1, 'server simulates movement');
  const stopped = player(a).pos[0];
  input(a, { mx: 999, pos: [999, 999, 999], hp: 999 });
  await sleep(180);
  assert(Math.abs(player(a).pos[0] - stopped) < 0.15, 'invalid movement rejected');
  assert(player(a).hp <= 100, 'health is authoritative');
  const now = Date.now();
  while (a.state.wave === 1 && a.state.phase === 'playing' && Date.now() - now < 90000) {
    for (const c of [a, b]) {
      const p = player(c);
      const e = [...c.state.enemies].sort(
        (x, y) =>
          Math.hypot(x.pos[0] - p.pos[0], x.pos[2] - p.pos[2]) -
          Math.hypot(y.pos[0] - p.pos[0], y.pos[2] - p.pos[2]),
      )[0];
      if (!e) {
        input(c);
        continue;
      }
      const dx = e.pos[0] - p.pos[0],
        dz = e.pos[2] - p.pos[2];
      input(c, {
        yaw: Math.atan2(-dx, -dz),
        pitch: Math.atan2(e.pos[1] + 0.9 - p.pos[1] - 1.5, Math.hypot(dx, dz)),
        fire: true,
        reload: p.ammo === 0,
      });
    }
    await sleep(60);
  }
  input(a);
  input(b);
  assert(a.state.kills >= 1, 'server registered enemy kill');
  assert(a.hits > 0 && b.hits > 0, 'combat events delivered to both clients');
  assert(a.state.wave >= 2, 'bots clear first wave');
  b.ws.close();
  await until(() => a.state.players.length === 1, 'disconnect removes player');
  const wave = a.state.wave;
  send(a, { type: 'start', weapon: 2 });
  await sleep(120);
  assert.equal(a.state.wave, wave, 'start cannot reset active match');
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        players: 2,
        wave: a.state.wave,
        kills: a.state.kills,
        events: [a.hits, b.hits],
        checks: [
          'host authority',
          'shared wave',
          'movement',
          'invalid input',
          'enemy kills',
          'wave progression',
          'disconnect',
          'active reset rejected',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  for (const { ws } of clients) ws.close();
}
