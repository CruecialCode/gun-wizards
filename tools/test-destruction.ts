import { DbConnection } from '../src/module_bindings';
import { blankInput } from '../shared/simulation';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const room = `break-${Date.now().toString(36)}`,
  clients: DbConnection[] = [];
const wait = async (predicate: () => boolean, label: string) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 8000) throw Error(`Timed out: ${label}`);
    await new Promise((r) => setTimeout(r, 40));
  }
};
const connect = () =>
  new Promise<DbConnection>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('connect timeout')), 8000);
    DbConnection.builder()
      .withUri(process.env.SPACETIME_URI ?? 'ws://127.0.0.1:3000')
      .withDatabaseName(process.env.SPACETIME_DB ?? 'gun-wizards-local')
      .onConnect((c) => {
        clients.push(c);
        c.subscriptionBuilder()
          .onApplied(() => {
            clearTimeout(timer);
            resolve(c);
          })
          .subscribe(['SELECT * FROM player', 'SELECT * FROM arena', 'SELECT * FROM district']);
      })
      .onConnectError((_c, e) => {
        clearTimeout(timer);
        reject(e);
      })
      .build();
  });
try {
  const a = await connect(),
    b = await connect();
  await a.reducers.join({ name: 'Breaker', hero: 0, room });
  await b.reducers.join({ name: 'Witness', hero: 1, room });
  await a.reducers.startRound({});
  await wait(() => a.db.arena.id.find(room)?.phase === 'playing', 'round start');
  let seq = 1;
  const input = { ...blankInput(), yaw: Math.atan2(-8, 12), fire: true };
  for (let n = 0; n < 14; n++) {
    await a.reducers.control({ input: JSON.stringify({ ...input, seq: seq++ }) });
    await new Promise((r) => setTimeout(r, 85));
  }
  await a.reducers.control({ input: JSON.stringify({ ...blankInput(), seq: seq++ }) });
  const broken = (c: DbConnection) =>
    c.db.district.id.find(room)?.damage.some((d) => d.id === 'screen-b' && d.amount >= 72) ?? false;
  await wait(() => broken(a) && broken(b), 'both clients see broken cover');
  assert.deepEqual(a.db.district.id.find(room)?.damage, b.db.district.id.find(room)?.damage);
  const late = await connect();
  assert.ok(broken(late), 'late subscriber receives durable broken state');
  await b.reducers.leave({});
  await wait(() => a.db.arena.id.find(room)?.phase === 'finished', 'round end');
  await late.reducers.join({ name: 'Late', hero: 2, room });
  await a.reducers.startRound({});
  await wait(
    () =>
      a.db.district.id.find(room)?.damage.length === 0 &&
      late.db.district.id.find(room)?.damage.length === 0,
    'reset replicated',
  );
  const report = {
    date: new Date().toISOString(),
    room,
    server: process.env.SPACETIME_URI ?? 'local',
    twoClientsAgree: true,
    lateSubscriberReceivesBreak: true,
    rematchRestoresCover: true,
  };
  writeFileSync('docs/qa/destruction-network.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report);
} finally {
  for (const c of clients) {
    try {
      await c.reducers.leave({});
    } catch {}
    c.disconnect();
  }
}
