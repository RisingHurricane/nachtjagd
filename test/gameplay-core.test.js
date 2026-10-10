import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/entwurf/gameplay-core.js', import.meta.url), 'utf8');
function make(world = {}) {
  const context = { Math, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  const api = context.NachtjagdGame;
  const game = api.create({
    random: () => 0.5,
    world: { spawn: [0, 0], floor: () => 0, blocked: () => false, spawnEnemy: () => [0, 8], ...world }
  });
  return { game, api };
}
function advance(game, seconds, input = {}) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) game.step(Math.min(0.1, seconds - t), input);
}

test('player movement normalizes diagonals, slides along a blocked wall, and pause freezes state', () => {
  const { game } = make({ blocked: (x, z) => x > 0.4 });
  game.start(); game.setLook(0, 0);
  game.step(0.1, { forward: 1, side: 1 });
  const p = game.snapshot().player;
  assert.ok(p.z > 0.3 && p.z <= 0.7);
  assert.ok(p.x <= 0.4);
  game.pause(); const before = game.snapshot(); game.step(0.1, { forward: 1 });
  assert.equal(game.snapshot().player.z, before.player.z);
});

test('shooting obeys cooldown, damages enemies, and reload transfers only needed rounds', () => {
  const { game } = make({ spawnEnemy: () => [0, 8] });
  game.start(); game.setLook(0, 0); advance(game, 4.6);
  game.step(0.1, { fire: true });
  let s = game.snapshot();
  assert.equal(s.weapons[0].ammo, 5);
  assert.equal(s.monsters.length, 1);
  assert.equal(s.monsters[0].hp, 13);
  game.step(0.1, { fire: true });
  assert.equal(game.snapshot().weapons[0].ammo, 5);
  advance(game, 0.3); game.step(0.1, { fire: true });
  assert.equal(game.snapshot().monsters.length, 0);
  game.reload(); advance(game, 2.1);
  s = game.snapshot(); assert.equal(s.weapons[0].ammo, 6); assert.equal(s.weapons[0].reserve, 28);
});

test('world ray obstruction prevents damage and invalid dt or inputs are ignored', () => {
  const { game } = make({ rayDistance: () => 3, spawnEnemy: () => [0, 8] });
  game.start(); advance(game, 4.6); game.setLook(0, 0);
  game.step(0.1, { fire: true });
  assert.equal(game.snapshot().monsters[0].hp, 70);
  const p = game.snapshot().player;
  game.step(NaN, { forward: 1 }); game.step(0.1, { forward: Infinity });
  assert.equal(game.snapshot().player.z, p.z);
});

test('objective seals unlock weapons, bell starts 100-second ending, then wins', () => {
  const objectives = [{ id: 'a', name: 'Kirche', x: 0, z: 0 }, { id: 'b', name: 'Mine', x: 0, z: 0 }, { id: 'c', name: 'Burg', x: 0, z: 0 }];
  const { game } = make({ objectives, bell: { x: 0, z: 0 }, spawnEnemy: () => null });
  game.start();
  assert.equal(game.interact(), true);
  assert.equal(game.snapshot().weapons[1].owned, true);
  assert.equal(game.interact(), true);
  assert.equal(game.snapshot().weapons[2].owned, true);
  assert.equal(game.interact(), true);
  assert.equal(game.snapshot().quest.stage, 'bell');
  assert.equal(game.interact(), true);
  assert.equal(game.snapshot().waves.finalT, 100);
  game.step(0.1, {}); assert.ok(Math.abs(game.snapshot().waves.finalT - 99.9) < 1e-8);
  advance(game, 100.1);
  assert.equal(game.snapshot().phase, 'won');
});

test('failed wave spawn leaves pending count intact and retries', () => {
  let calls = 0;
  const { game } = make({ spawnEnemy: () => (++calls === 1 ? null : [0, 8]) });
  game.start(); advance(game, 4.5);
  const before = game.snapshot().waves.toSpawn;
  game.step(0.1, {});
  assert.equal(game.snapshot().waves.toSpawn, before);
  game.step(0.1, {});
  assert.equal(game.snapshot().waves.toSpawn, before - 1);
});

test('final defense spawns reinforcements at 1.3 second intervals and caps live enemies at 16', () => {
  let spawns = 0;
  const objectives = [{ id: 'a', name: 'A', x: 0, z: 0 }, { id: 'b', name: 'B', x: 0, z: 0 }, { id: 'c', name: 'C', x: 0, z: 0 }];
  const { game } = make({
    objectives, bell: { x: 0, z: 0 },
    spawnEnemy: () => { spawns++; return [0, 20 + spawns]; },
    rayDistance: (origin, _direction, max) => origin.y < 1.5 ? 0 : max
  });
  game.start(); game.interact(); game.interact(); game.interact(); game.interact();
  advance(game, 0.9); assert.equal(spawns, 0);
  advance(game, 0.2); assert.equal(spawns, 1);
  advance(game, 1.4); assert.equal(spawns, 2);
  advance(game, 30);
  assert.ok(game.snapshot().monsters.length <= 16);
});

test('enemy wind-up attacks stop at terrain occlusion', () => {
  const { game } = make({
    spawnEnemy: () => [0, 1.5],
    rayDistance: (origin, _direction, max) => origin.y < 1.5 ? 0 : max
  });
  game.start(); advance(game, 4.6); advance(game, 3);
  assert.equal(game.snapshot().player.hp, 100);
});

test('weapon switching applies a delay and cannot bypass the current shot cooldown', () => {
  const objectives = [{ id: 'a', name: 'A', x: 0, z: 0 }, { id: 'b', name: 'B', x: 0, z: 0 }];
  const { game } = make({ objectives, spawnEnemy: () => [0, 8] });
  game.start(); game.interact(); game.interact();
  game.step(0.1, { fire: true });
  const before = game.snapshot().weapons[1].ammo;
  assert.equal(game.selectWeapon(1), true);
  game.step(0.1, { fire: true });
  assert.equal(game.snapshot().weapons[1].ammo, before);
});

test('lethal attack freezes the phase before the final timer can award a win', () => {
  let allowSpawn = false;
  const objectives = [{ id: 'a', name: 'A', x: 0, z: 0 }, { id: 'b', name: 'B', x: 0, z: 0 }, { id: 'c', name: 'C', x: 0, z: 0 }];
  const { game } = make({ objectives, bell: { x: 0, z: 0 }, spawnEnemy: () => allowSpawn ? [0, 1.5] : null });
  game.start(); game.interact(); game.interact(); game.interact(); game.interact();
  advance(game, 70);
  allowSpawn = true;
  advance(game, 30);
  const dead = game.snapshot();
  assert.equal(dead.phase, 'dead');
  assert.ok(dead.player.hp === 0 && dead.waves.finalT > 0);
  advance(game, 10);
  assert.equal(game.snapshot().phase, 'dead');
  assert.equal(game.snapshot().waves.finalT, dead.waves.finalT);
});
