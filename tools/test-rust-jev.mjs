/** Jev pilots reconstructed Dark Veil through the same input WebSocket as humans.
 * This is a structured-observation adapter, not screenshot vision or proof of fun.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const key = process.env.TYPESAFE_API_KEY;
if (!key) throw Error('Set TYPESAFE_API_KEY privately before running this test.');
const maxDecisions = Math.max(1, Math.min(40, Number(process.env.JEV_DECISIONS ?? 12) || 12));
const endpoint = process.env.VEIL_WS ?? 'ws://127.0.0.1:8787/ws';
const room = `jev-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clients = [],
  decisions = [];
const source = readFileSync(
  fileURLToPath(new URL('../rust/web/reference-assets/world.bin', import.meta.url)),
);
const vertices = new DataView(source.buffer, source.byteOffset, source.byteLength);
// A compact XZ broad phase keeps visibility checks cheap; narrow phase uses
// recovered solid triangles, with the same tile exclusions as Rust collision.
const cells = new Map();
for (let base = 0; base + 144 <= source.length; base += 144) {
  const f = (vertex, offset) => vertices.getFloat32(base + vertex * 48 + offset * 4, true);
  const material = Math.round(f(0, 9));
  const tile =
    Math.max(0, Math.min(3, Math.floor(((f(0, 10) + f(1, 10) + f(2, 10)) / 3) * 4))) +
    4 * Math.max(0, Math.min(3, Math.floor(((f(0, 11) + f(1, 11) + f(2, 11)) / 3) * 4)));
  if (material === 5 || (material !== 11 && ![0, 1, 2, 3, 5, 8, 11, 13, 14].includes(tile)))
    continue;
  const xs = [f(0, 0), f(1, 0), f(2, 0)],
    zs = [f(0, 2), f(1, 2), f(2, 2)];
  const minX = Math.max(-10, Math.floor(Math.min(...xs) / 4)),
    maxX = Math.min(10, Math.floor(Math.max(...xs) / 4));
  const minZ = Math.max(-10, Math.floor(Math.min(...zs) / 4)),
    maxZ = Math.min(10, Math.floor(Math.max(...zs) / 4));
  for (let x = minX; x <= maxX; x++)
    for (let z = minZ; z <= maxZ; z++) {
      const k = `${x},${z}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(base);
    }
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function lineOfSight(from, to) {
  const delta = sub(to, from),
    length = Math.hypot(...delta),
    direction = delta.map((v) => v / length),
    candidates = new Set();
  for (let n = 0; n <= Math.ceil(length); n++) {
    const t = Math.min(1, n / Math.max(1, Math.ceil(length)));
    for (const i of cells.get(
      `${Math.floor((from[0] + delta[0] * t) / 4)},${Math.floor((from[2] + delta[2] * t) / 4)}`,
    ) ?? [])
      candidates.add(i);
  }
  for (const base of candidates) {
    const p = (n) => [0, 1, 2].map((j) => vertices.getFloat32(base + n * 48 + j * 4, true));
    const a = p(0),
      e1 = sub(p(1), a),
      e2 = sub(p(2), a),
      h = cross(direction, e2),
      det = dot(e1, h);
    if (Math.abs(det) < 1e-7) continue;
    const inv = 1 / det,
      s = sub(from, a),
      u = inv * dot(s, h);
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1),
      v = inv * dot(direction, q);
    if (v < 0 || u + v > 1) continue;
    const t = inv * dot(e2, q);
    if (t > 0.05 && t < length - 0.1) return false;
  }
  return true;
}
async function until(predicate, label) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 8000) throw Error(`Timed out: ${label}`);
    await sleep(25);
  }
}
async function connect() {
  const ws = new WebSocket(`${endpoint}?room=${room}`),
    c = { ws, id: null, state: null, yaw: 0, pitch: 0, hits: 0 };
  clients.push(c);
  ws.addEventListener('error', () => {
    c.error = true;
  });
  ws.addEventListener('message', ({ data }) => {
    const value = JSON.parse(data);
    if (value.type === 'welcome') c.id = value.id;
    if (value.type === 'snapshot') {
      c.state = value;
      c.hits += value.events.filter((e) => e.kind === 'hit').length;
    }
  });
  await until(() => c.id !== null || c.error, 'welcome');
  if (c.error) throw Error('Local Rust WebSocket connection failed');
  return c;
}
function input(c, changes = {}) {
  if (c.ws.readyState === WebSocket.OPEN)
    c.ws.send(
      JSON.stringify({
        type: 'input',
        mx: 0,
        mz: 0,
        yaw: c.yaw,
        pitch: c.pitch,
        fire: false,
        melee: false,
        spell: false,
        dodge: false,
        jump: false,
        reload: false,
        ...changes,
      }),
    );
}
const player = (c) => c.state?.players.find((p) => p.id === c.id);
function observe(c) {
  const p = player(c),
    eye = [p.pos[0], p.pos[1] + 1.5, p.pos[2]];
  const visible = c.state.enemies
    .flatMap((e) => {
      const target = [e.pos[0], e.pos[1] + 0.9, e.pos[2]],
        d = sub(target, eye),
        distance = Math.hypot(...d),
        bearing = wrap(Math.atan2(-d[0], -d[2]) - c.yaw),
        elevation = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      if (
        distance > 30 ||
        Math.abs(bearing) > Math.PI * 0.31 ||
        Math.abs(elevation - c.pitch) > 0.8 ||
        !lineOfSight(eye, target)
      )
        return [];
      return [
        {
          id: e.id,
          distance: Math.round(distance * 10) / 10,
          bearing: Math.round(bearing * 100) / 100,
          elevation: Math.round(elevation * 100) / 100,
          kind: ['skeleton', 'caster', 'boss'][e.kind],
          health: Math.round((e.hp / e.max_hp) * 100),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
  return {
    health: p.hp,
    ammo: p.ammo,
    mana: p.mana,
    stamina: p.stamina,
    weapon: p.weapon,
    ready: p.cooldown <= 0,
    wave: c.state.wave,
    kills: c.state.kills,
    visible,
  };
}
const criteria = {
  aim_and_fire:
    'Turn toward the nearest visible enemy and fire; adapter turns at a bounded rate, not instant aim.',
  turn_left: 'Rotate camera left to search.',
  turn_right: 'Rotate camera right to search.',
  strafe_left: 'Strafe left while looking forward.',
  strafe_right: 'Strafe right while looking forward.',
  advance: 'Move forward.',
  retreat: 'Move backward.',
  reload: 'Reload the weapon.',
  dodge: 'Dodge backward to make space.',
  spell: 'Cast forward using mana.',
  melee: 'Strike forward at close range.',
};
function act(c, choice, observation) {
  const changes = {};
  if (choice === 'aim_and_fire') {
    const target = observation.visible[0];
    if (target) {
      const turn = Math.max(-0.45, Math.min(0.45, target.bearing));
      c.yaw = wrap(c.yaw + turn);
      c.pitch = target.elevation;
      changes.fire = Math.abs(target.bearing - turn) < 0.12;
    }
  } else if (choice === 'turn_left') c.yaw = wrap(c.yaw + 0.4);
  else if (choice === 'turn_right') c.yaw = wrap(c.yaw - 0.4);
  else if (choice === 'strafe_left') changes.mx = -1;
  else if (choice === 'strafe_right') changes.mx = 1;
  else if (choice === 'advance') changes.mz = 1;
  else if (choice === 'retreat') changes.mz = -1;
  else if (choice === 'dodge') {
    changes.mz = -1;
    changes.dodge = true;
  } else changes[choice] = true;
  input(c, changes);
}
const report = {
  adapter: 'Rust Dark Veil reconstruction / structured observations',
  model: 'jev-latest',
  observation:
    'Own resources plus FOV and recovered-triangle line-of-sight filtered enemies; no pixels or hidden enemy positions.',
  limits: { maxDecisions, actionMs: 200, maxRuntimeMs: 45000, requestTimeoutMs: 5000 },
  decisions,
};
try {
  await connect();
  await connect();
  await until(() => clients.every((c) => c.state?.players.length === 2), 'two players');
  clients[0].ws.send(JSON.stringify({ type: 'start', weapon: 0 }));
  await until(() => clients.every((c) => c.state?.phase === 'playing'), 'start');
  const started = Date.now();
  for (
    let n = 0;
    n < maxDecisions && Date.now() - started < 45000 && clients[0].state.phase === 'playing';
    n++
  ) {
    const observations = clients.map(observe),
      questions = Object.fromEntries(
        clients.map((_, i) => [
          `p${i}`,
          {
            type: 'choice',
            instructions:
              'Choose one 200ms action for this player to survive and defeat enemies. Bearing positive means left. Fire only at visible targets; reload empty magazines. Search when none are visible. Decisions arrive at most5Hz; API latency may lower this.',
            criteria,
          },
        ]),
      );
    const began = Date.now();
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: { players: observations }, questions }),
      signal: AbortSignal.timeout(Math.max(1, Math.min(5000, 45000 - (Date.now() - started)))),
    });
    if (!response.ok) throw Error(`Jev HTTP ${response.status}`);
    const result = await response.json();
    const choices = clients.map((_, i) => result.answers?.[`p${i}`]?.choice);
    if (choices.some((choice) => !Object.hasOwn(criteria, choice)))
      throw Error('Jev returned an unknown action');
    decisions.push({
      decision: n,
      elapsedMs: Date.now() - started,
      latencyMs: Date.now() - began,
      choices,
      observations,
    });
    if (Date.now() - started >= 45000) break;
    clients.forEach((c, i) => act(c, choices[i], observations[i]));
    await sleep(Math.max(0, Math.min(200, 45000 - (Date.now() - started))));
    clients.forEach((c) => input(c));
    console.log(
      `Decision ${n + 1}/${maxDecisions}: ${choices.join(', ')} (${decisions.at(-1).latencyMs}ms)`,
    );
  }
  report.result = 'completed';
  report.elapsedMs = Date.now() - started;
  report.actualDecisionsPerSecond = decisions.length / (report.elapsedMs / 1000);
  report.final = clients.map((c) => ({
    hp: player(c).hp,
    ammo: player(c).ammo,
    wave: c.state.wave,
    kills: c.state.kills,
    receivedHitEvents: c.hits,
  }));
} catch (error) {
  report.result = 'failed';
  report.error = error.name === 'TimeoutError' ? 'Jev request timed out' : error.message;
  process.exitCode = 1;
  console.error(report.error);
} finally {
  clients.forEach((c) => {
    input(c);
    c.ws.close();
  });
  mkdirSync('docs/qa', { recursive: true });
  writeFileSync('docs/qa/rust-jev.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Report: docs/qa/rust-jev.json');
}
