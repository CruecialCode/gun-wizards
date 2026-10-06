import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fighter, blankInput, step, resolveAttack, blocked, DT } from '../shared/simulation';
test('sprint, dodge, jump land, and walls remain bounded', () => {
  const p = fighter('a', 'A', 0, 36, 20);
  for (let n = 0; n < 120; n++) step(p, { ...blankInput(), mz: 1, sprint: true }, DT);
  assert.ok(p.distance > 30);
  step(p, { ...blankInput(), jump: true }, DT);
  assert.ok(p.vy > 0);
  for (let n = 0; n < 60; n++) step(p, blankInput(), DT);
  assert.equal(p.grounded, true);
  const x = p.x;
  step(p, { ...blankInput(), mx: 1, dash: true }, DT);
  assert.ok(p.x > x);
  assert.ok(p.dashCd > 0);
  for (let n = 0; n < 1000; n++) step(p, { ...blankInput(), mx: 1 }, DT);
  assert.ok(p.x <= 38);
});
test('fire rate, magazine and reload are authoritative', () => {
  const p = fighter('a', 'A');
  let shots = 0;
  for (let n = 0; n < 90; n++)
    shots += step(p, { ...blankInput(), fire: true }, DT).filter((e) => e.type === 'shot').length;
  assert.equal(shots, 8);
  assert.equal(p.ammo, 0);
  step(p, { ...blankInput(), reload: true }, DT);
  assert.equal(step(p, { ...blankInput(), fire: true }, DT).length, 0);
  for (let n = 0; n < 40; n++) step(p, blankInput(), DT);
  assert.equal(p.ammo, 8);
});
test('line of sight blocks gunfire through cover', () => {
  assert.equal(blocked(0, 1.5, 20, 0, 1.5, 5), true);
  const a = fighter('a', 'A', 0, 0, 20),
    b = fighter('b', 'B', 0, 0, 5);
  assert.equal(resolveAttack(a, [b], 'shot', 0).filter((e) => e.type === 'hit').length, 0);
  assert.equal(b.hp, 100);
});
test('front guard blocks, rear guard does not, melee cannot hit at range', () => {
  const a = fighter('a', 'A', 0, 36, 5),
    b = fighter('b', 'B', 0, 36, 3);
  b.guard = true;
  b.yaw = Math.PI;
  assert.equal(resolveAttack(a, [b], 'shot', 0)[0].type, 'parry');
  b.yaw = 0;
  assert.equal(resolveAttack(a, [b], 'shot', 0)[0].damage, 18);
  b.z = -10;
  assert.equal(resolveAttack(a, [b], 'melee', 0).length, 0);
});
test('a hit eliminates exactly once and builds combo chains', () => {
  const a = fighter('a', 'A', 0, 36, 5),
    b = fighter('b', 'B', 0, 36, 3);
  b.hp = 18;
  assert.equal(resolveAttack(a, [b], 'shot', 0).at(-1)?.type, 'out');
  assert.equal(
    resolveAttack(a, [b], 'shot', 0.3).filter((e) => e.type === 'out' || e.type === 'hit').length,
    0,
  );
  assert.equal(a.hits, 1);
});

test('destruction opens cover only after its health is exhausted', () => {
  const damage: Record<string, number> = {},
    p = fighter('a', 'A', 0, 0, 20),
    target = fighter('b', 'B', 0, 0, 5);
  for (let n = 0; n < 3; n++) {
    assert.equal(resolveAttack(p, [target], 'shot', n, damage)[0].type, 'chip');
    assert.equal(target.hp, 100);
  }
  assert.equal(resolveAttack(p, [target], 'shot', 3, damage)[0].type, 'break');
  assert.equal(blocked(0, 1.55, 20, 0, 1, 5, damage), false);
  assert.equal(resolveAttack(p, [target], 'shot', 4, damage)[0].type, 'hit');
  assert.equal(blocked(0, 1.55, 20, 0, 1, 5, {}), true);
});
test('stairs reach an elevated floor and interior ceilings stop jumps', () => {
  const p = fighter('a', 'A', 0, 15, 30);
  for (let n = 0; n < 61; n++) step(p, { ...blankInput(), mz: 1 }, DT);
  assert.ok(p.y > 5.5, `stair height ${p.y}`);
  const q = fighter('b', 'B', 0, 25, 10);
  q.y = 3.8;
  q.grounded = false;
  q.vy = 9;
  step(q, blankInput(), DT);
  assert.ok(q.y + 1.72 <= 5.65);
  assert.equal(q.vy, 0);
});

test('street entrances and broken interior partitions form a continuous route', () => {
  const p = fighter('route', 'Route', 0, -10, -16.3),
    damage: Record<string, number> = {};
  for (let n = 0; n < 46; n++) step(p, { ...blankInput(), mx: -1 }, DT, damage);
  assert.ok(p.x < -20, 'enter the open shop portal');
  for (let n = 0; n < 120; n++) step(p, { ...blankInput(), mz: -1 }, DT, damage);
  assert.ok(p.z < -0.3, 'intact partition blocks the passage');
  p.yaw = Math.PI;
  for (let n = 0; n < 3; n++) resolveAttack(p, [], 'shot', n, damage);
  assert.equal(damage['partition--1'], 54);
  for (let n = 0; n < 35; n++) step(p, { ...blankInput(), mz: -1 }, DT, damage);
  assert.ok(p.z > 5, 'breach opens the passage');
});
