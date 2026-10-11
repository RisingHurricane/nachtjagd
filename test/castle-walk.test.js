import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildCastle } from '../public/models/castle.js';

// Tests für die Begehbarkeit der Burg (castle-walk.js): Türen, Rittersaal, Treppe zur Bibliothek, Wendeltreppe im Turm.
const source = await readFile(new URL('../public/entwurf/castle-walk.js', import.meta.url), 'utf8');
const context = { Math };
context.globalThis = context;
vm.runInNewContext(source, context);
const W = context.NachtjagdCastleWalk;
const castle = buildCastle(THREE);
// Modell ohne Drehung und Verschiebung: lokale Koordinaten gleich Weltkoordinaten
const walk = W.create({ colliders: castle.userData.colliders, origin: { x: 0, z: 0, y: 0 }, rot: 0 });

// Läuft Wegpunkte in 0,2-m-Schritten ab wie der Spielkern: Boden aus floor(), Stufenhöhe und Kollision prüfen.
function walkPath(points, startY = 0) {
  let [x, z] = points[0], y = startY;
  const f0 = walk.floor(x, z, y); if (f0) y = f0.y;
  assert.equal(walk.blocked(x, z, y), false, `Start blockiert bei ${x},${z}`);
  for (let i = 1; i < points.length; i++) {
    const [tx, tz] = points[i], x0 = x, z0 = z, n = Math.max(1, Math.ceil(Math.hypot(tx - x0, tz - z0) / 0.2));
    for (let s = 1; s <= n; s++) {
      const nx = x0 + (tx - x0) * s / n, nz = z0 + (tz - z0) * s / n, f = walk.floor(nx, nz, y);
      assert.ok(f, `kein Boden bei ${nx.toFixed(2)},${nz.toFixed(2)} (y ${y.toFixed(2)})`);
      assert.ok(f.y <= y + W.STEP + 1e-9, `Stufe zu hoch bei ${nx.toFixed(2)},${nz.toFixed(2)}: ${y.toFixed(2)} -> ${f.y.toFixed(2)}`);
      assert.equal(walk.blocked(nx, nz, f.y), false, `blockiert bei ${nx.toFixed(2)},${nz.toFixed(2)} (y ${f.y.toFixed(2)})`);
      x = nx; z = nz; y = f.y;
    }
  }
  return { x, z, y };
}

test('Burg: Hof, Tor und Außenmauern', () => {
  assert.equal(walk.blocked(4, 19, 0), false, 'Torbogen ist frei');
  assert.equal(walk.blocked(4, 12, 0), false, 'Hof hinter dem Tor');
  assert.equal(walk.blocked(-7.5, 19.8, 0), true, 'Bogengang links vom Tor ist massiv');
});

test('Burg: Eingang durch den Zwerchgiebel in den Rittersaal (beide Türen)', () => {
  for (const x of [-12, 5]) {
    const end = walkPath([[x, 8], [x, -6]]);
    assert.ok(Math.abs(end.y - 0.06) < 0.01, 'Saalboden bei y 0,06: ' + end.y);
  }
  // Neben der Tür ist die Wand dicht
  assert.equal(walk.blocked(2.5, -1.5, 0.05), true);
  assert.equal(walk.blocked(-14.9, -1.2, 0.05), true);
});

test('Burg: Tisch, Kamin und Stühle blockieren im Rittersaal, Gänge daneben bleiben frei', () => {
  assert.equal(walk.blocked(-4, -6, 0.06), true, 'Tafel');
  assert.equal(walk.blocked(-14.5, -6, 0.06), true, 'Kamin');
  assert.equal(walk.blocked(-4, -3.0, 0.06), false, 'Gang an der Südwand');
  assert.equal(walk.blocked(-12.5, -6, 0.06), false, 'Platz vor dem Kamin (Siegel)');
  assert.equal(walk.blocked(-4, -2.0, 0.06), true, 'Wand');
});

test('Burg: Treppe vom Rittersaal in die Bibliothek und zurück', () => {
  const up = walkPath([[-1, -9.2], [7.0, -9.2], [7.0, -7.6], [3, -7.0]]);
  assert.ok(Math.abs(up.y - 7.4) < 0.01, 'Bibliotheksboden bei 7,4: ' + up.y);
  const down = walkPath([[3, -7.0], [6.9, -7.6], [6.9, -9.2], [0.5, -9.2], [-1.5, -8.5]], 7.4);
  assert.ok(down.y < 0.2, 'wieder unten: ' + down.y);
  // Brüstung: vom Bibliotheksboden ins Treppenloch gibt es keinen Weg in der Mitte
  assert.equal(walk.blocked(3, -8.45, 7.4), true);
  // Schreibtisch
  assert.equal(walk.blocked(-5, -4.2, 7.4), true);
});

test('Burg: Wendeltreppe im Hauptturm führt bis zum Turmzimmer', () => {
  const T = W.TOWER, door = [[T.x, T.z + 7], [T.x, T.z + 3.0]];
  const points = [...door];
  const da = Math.PI * 2 / T.stepsPerTurn;
  // von Stufe 0 (Winkel 0) im Kreis aufwärts, Radius 2,2
  for (let i = 0; i < T.steps; i++) points.push([T.x + Math.sin(i * da) * 2.2, T.z + Math.cos(i * da) * 2.2]);
  const end = walkPath(points);
  assert.ok(end.y > 34.5, 'oben: ' + end.y);
  assert.equal(walk.blocked(T.x, T.z, 1), true, 'Treppenkern');
  assert.equal(walk.blocked(T.x + 4, T.z, 1), true, 'Turmwand außen');
});

test('Burg: Gelände außerhalb der Burg bleibt unberührt', () => {
  const far = W.create({ colliders: castle.userData.colliders, origin: { x: 500, z: 500, y: 10 }, rot: 0.7 });
  assert.equal(far.blocked(0, 0, 0), false);
  assert.equal(far.floor(0, 0, 0), null);
  assert.equal(far.near(0, 0), false);
});

test('Burg: Drehung und Verschiebung werden umgerechnet', () => {
  const placed = W.create({ colliders: castle.userData.colliders, origin: { x: -264, z: -96, y: 102 }, rot: Math.PI / 2 });
  const w = placed.toWorld(4, 19), l = placed.toLocal(w.x, w.z);
  assert.ok(Math.abs(l.x - 4) < 1e-9 && Math.abs(l.z - 19) < 1e-9);
  assert.ok(Math.abs(w.x - (-264 + 19)) < 1e-9 && Math.abs(w.z - (-96 - 4)) < 1e-9, 'Tor liegt östlich der Mitte auf der Wegachse z = -100');
  assert.equal(placed.blocked(w.x, w.z, 102), false);
  const f = placed.floor(w.x - 3, w.z, 102);
  assert.ok(f && f.ground && Math.abs(f.y - 102) < 0.01);
});
