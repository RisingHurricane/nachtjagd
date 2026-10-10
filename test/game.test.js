'use strict';

import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGame, parseLevel, MAX_PLAYERS } from '../public/game.js';

const LEVEL_PATH = fileURLToPath(new URL('../public/level.json', import.meta.url));
const realLevel = parseLevel(readFileSync(LEVEL_PATH, 'utf8'));

// Ebene ohne Hindernisse, der Spieler startet bei (0, 0). Der See liegt weit weg.
function flatLevel(extra = {}) {
  return {
    size: 200,
    playerSpawns: [{ x: 0, z: 0 }],
    boxes: [],
    circles: [],
    lake: { x: -90, z: 90, r: 5 },
    monsterSpawns: [],
    guards: [],
    crystals: [],
    pickups: [],
    ...extra,
  };
}

// Liefert den Zustand eines Spielers aus dem Snapshot.
function stateOf(game, id) {
  return game.snapshot().players.find((p) => p.id === id);
}

// Läuft die Zeit in Schritten von 0,1 Sekunden weiter, wie es der Server bei jedem Tick auch tut.
function advance(game, seconds) {
  const steps = Math.round(seconds / 0.1);
  for (let i = 0; i < steps; i++) {
    game.step(0.1);
  }
}

// Ein Punkt liegt in einem Hindernis, wenn er tiefer als 1 cm im erweiterten Hindernis steckt.
// Der Snapshot rundet auf Zentimeter, deshalb gibt es diese Toleranz.
function obstacleAt(level, x, z) {
  const R = 0.5;
  const slack = 0.01;
  for (const b of level.boxes) {
    if (
      x > b.x - b.w / 2 - R + slack && x < b.x + b.w / 2 + R - slack &&
      z > b.z - b.d / 2 - R + slack && z < b.z + b.d / 2 + R - slack
    ) {
      return `Gebäude bei (${b.x}, ${b.z})`;
    }
  }
  for (const c of level.circles) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + R - slack) {
      return `Kreis bei (${c.x}, ${c.z})`;
    }
  }
  if (Math.hypot(x - level.lake.x, z - level.lake.z) < level.lake.r + R - slack) {
    return 'See';
  }
  if (Math.abs(x) > 98 + slack || Math.abs(z) > 98 + slack) {
    return 'Kartenrand';
  }
  return null;
}

// Kleiner Zufallsgenerator mit festem Seed, damit der Test immer gleich läuft.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('höchstens vier Spieler, ein freier Platz wird nach dem Austritt wieder vergeben', () => {
  const game = createGame(realLevel);
  const ids = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    ids.push(game.addPlayer());
  }
  assert.ok(ids.every((id) => typeof id === 'string'));
  assert.strictEqual(game.addPlayer(), null);

  game.removePlayer(ids[0]);
  assert.notStrictEqual(game.addPlayer(), null);
});

test('neuer Spieler startet an einem Startpunkt mit vollen Werten', () => {
  const game = createGame(realLevel);
  const id = game.addPlayer();
  const p = stateOf(game, id);
  assert.ok(realLevel.playerSpawns.some((s) => Math.abs(s.x - p.x) < 0.01 && Math.abs(s.z - p.z) < 0.01));
  assert.strictEqual(p.hp, 100);
  assert.strictEqual(p.ammo, 80);
  assert.strictEqual(p.score, 0);
  assert.strictEqual(p.alive, true);
});

test('mx nach rechts bewegt in +x mit 6 m/s', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 1, mz: 0, yaw: 0 });
  advance(game, 1);
  const after = stateOf(game, id);
  assert.ok(Math.abs(after.x - 6) < 0.05);
  assert.strictEqual(after.z, 0);
});

test('mz nach vorn geht bei yaw 0 in -z', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: 0 });
  advance(game, 0.5);
  assert.ok(Math.abs(stateOf(game, id).z + 3) < 0.05);
});

test('Blickrichtung dreht die Bewegung: yaw π/2 geht nach vorn in -x', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: Math.PI / 2 });
  advance(game, 0.5);
  assert.ok(Math.abs(stateOf(game, id).x + 3) < 0.05);
});

test('diagonale Bewegung ist nicht schneller als gerade', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 1, mz: 1, yaw: 0 });
  advance(game, 1);
  const after = stateOf(game, id);
  const distance = Math.hypot(after.x, after.z);
  assert.ok(Math.abs(distance - 6) < 0.05, `Strecke ${distance}`);
});

test('Spieler bleibt innerhalb von ±98', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 1, mz: 0, yaw: 0 });
  advance(game, 100);
  assert.strictEqual(stateOf(game, id).x, 98);
});

test('ungültige Eingaben werden begrenzt oder ignoriert', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setInput(id, { mx: 'abc', mz: 99, yaw: NaN, fire: 'ja' });
  advance(game, 1);
  const after = stateOf(game, id);
  assert.ok(Math.abs(after.x) < 0.01);
  assert.ok(Math.abs(after.z + 6) < 0.05);
  assert.strictEqual(after.yaw, 0);
});

test('Eingabe für unbekannte id wird ignoriert', () => {
  const game = createGame(flatLevel());
  assert.doesNotThrow(() => game.setInput('gibtsnicht', { mx: 1 }));
  assert.doesNotThrow(() => game.setName('gibtsnicht', 'Name'));
});

test('Namen werden gekürzt, leere und fremde Typen ignoriert', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.setName(id, '   ');
  assert.match(stateOf(game, id).name, /^Spieler /);
  game.setName(id, 'x'.repeat(40));
  assert.strictEqual(stateOf(game, id).name.length, 16);
  game.setName(id, 42);
  assert.strictEqual(stateOf(game, id).name.length, 16);
});

test('entfernte Spieler erscheinen nicht mehr im Snapshot', () => {
  const game = createGame(flatLevel());
  const id = game.addPlayer();
  game.removePlayer(id);
  assert.strictEqual(stateOf(game, id), undefined);
  assert.deepStrictEqual(game.snapshot().players, []);
});

test('ohne Level startet das Spiel nicht', () => {
  assert.throws(() => createGame());
});

test('Haus stoppt den Spieler an der Vorderseite', () => {
  // Haus bei (0, -10), 8 x 6 m: Vorderseite bei z = -7, mit Spielerradius bei z = -6,5.
  const game = createGame(flatLevel({ boxes: [{ x: 0, z: -10, w: 8, d: 6, h: 6, kind: 'house' }] }));
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: 0 });
  advance(game, 3);
  const p = stateOf(game, id);
  assert.ok(Math.abs(p.z + 6.5) < 0.02, `z ${p.z}`);
  assert.ok(Math.abs(p.x) < 0.02);
});

test('Spieler gleitet an einer Mauer entlang', () => {
  // Mauer von x -10 bis 10 bei z -5 bis -3. Der Spieler bleibt bei z = -2,5 (Vorderseite + 0,5 m Radius).
  const game = createGame(flatLevel({ boxes: [{ x: 0, z: -4, w: 20, d: 2, h: 8, kind: 'wall' }] }));
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: 0 });
  advance(game, 2);
  assert.ok(Math.abs(stateOf(game, id).z + 2.5) < 0.02);

  // Schräg gegen die Mauer: die Bewegung nach rechts bleibt erhalten.
  game.setInput(id, { mx: 1, mz: 1, yaw: 0 });
  advance(game, 1);
  const p = stateOf(game, id);
  assert.ok(Math.abs(p.z + 2.5) < 0.02, `z ${p.z}`);
  assert.ok(p.x > 2, `x ${p.x}`);
});

test('Baum als Kreis stoppt den Spieler', () => {
  // Baum bei (0, -5), Radius 1: der Spieler bleibt bei z = -3,5 (1 m + 0,5 m Radius).
  const game = createGame(flatLevel({ circles: [{ x: 0, z: -5, r: 1, h: 7, kind: 'tree' }] }));
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: 0 });
  advance(game, 2);
  assert.ok(Math.abs(stateOf(game, id).z + 3.5) < 0.02);
});

test('See ist nicht betretbar', () => {
  // See bei (0, -10), Radius 3: der Spieler bleibt bei 3,5 m vom Mittelpunkt.
  const game = createGame(flatLevel({ lake: { x: 0, z: -10, r: 3 } }));
  const id = game.addPlayer();
  game.setInput(id, { mx: 0, mz: 1, yaw: 0 });
  advance(game, 2);
  const p = stateOf(game, id);
  assert.ok(Math.abs(p.z + 6.5) < 0.02, `z ${p.z}`);
});

test('Startpunkte der echten Karte liegen frei', () => {
  for (const spawn of realLevel.playerSpawns) {
    assert.strictEqual(obstacleAt(realLevel, spawn.x, spawn.z), null, `Startpunkt (${spawn.x}, ${spawn.z})`);
  }
});

test('Spieler läuft auf der echten Karte nie durch Häuser, See oder Rand', () => {
  // Zufällige Bewegungen von allen Startpunkten aus, 30 Sekunden pro Lauf.
  for (let run = 0; run < 12; run++) {
    const random = mulberry32(1000 + run);
    const game = createGame(realLevel);
    const id = game.addPlayer();
    for (let step = 0; step < 300; step++) {
      if (step % 20 === 0) {
        game.setInput(id, {
          mx: random() * 2 - 1,
          mz: random() * 2 - 1,
          yaw: random() * Math.PI * 2 - Math.PI,
        });
      }
      game.step(0.1);
      const p = stateOf(game, id);
      const hit = obstacleAt(realLevel, p.x, p.z);
      assert.strictEqual(hit, null, `Lauf ${run}, Schritt ${step}: Spieler bei (${p.x}, ${p.z}) in ${hit}`);
    }
  }
});

test('Spieler läuft vom Dorf aus auf den See zu und bleibt davor', () => {
  const game = createGame(realLevel);
  const id = game.addPlayer();
  // yaw π/2 schaut nach -x, also läuft der Spieler zum See.
  game.setInput(id, { mx: 0, mz: 1, yaw: Math.PI / 2 });
  advance(game, 20);
  const p = stateOf(game, id);
  assert.strictEqual(obstacleAt(realLevel, p.x, p.z), null);
  assert.ok(Math.hypot(p.x - realLevel.lake.x, p.z - realLevel.lake.z) >= realLevel.lake.r + 0.49);
});
