'use strict';
// Tests für die Burgmodelle (public/models/castle.js, castle2.js) mit three aus node_modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCastle } from '../public/models/castle.js';
import { buildCastle2 } from '../public/models/castle2.js';
import { buildCastleInterior } from '../public/models/castle-interior.js';

const variants = [
  ['castle', buildCastle],
  ['castle2', buildCastle2],
];

for (const [name, build] of variants) {
  test(`Burg liefert eine Gruppe mit Kollisionsdaten und Tor (${name})`, () => {
    const castle = build(THREE);
    assert.ok(castle instanceof THREE.Group);
    const u = castle.userData;
    assert.equal(u.kind, 'castle');
    assert.equal(u.gate.facing, '+z');
    assert.ok(u.colliders.length >= 8);
    for (const c of u.colliders) {
      assert.ok(c.type === 'box' || c.type === 'circle');
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && c.h > 0);
    }
  });

  test(`Burg bleibt innerhalb des Footprints und hat Fensterleuchtmaterial (${name})`, () => {
    const castle = build(THREE);
    const box = new THREE.Box3().setFromObject(castle);
    assert.ok(box.min.y >= -1.7); // Sockel reicht 1,6 m unter den Boden
    assert.ok(box.max.y <= castle.userData.height + 0.01);
    const { w, d } = castle.userData.footprint;
    assert.ok(box.min.x >= -w / 2 - 3 && box.max.x <= w / 2 + 3);
    assert.ok(box.min.z >= -d / 2 - 3 && box.max.z <= d / 2 + 3);
    const windows = castle.getObjectByName('windows');
    assert.ok(windows && windows.isInstancedMesh);
    assert.equal(windows.material.name, 'windowGlow');
  });

  test(`Das Tor ist frei: kein Collider im Torbogen (${name})`, () => {
    const { colliders, gate } = build(THREE).userData;
    for (const c of colliders) {
      if (c.type === 'box') {
        const hit = Math.abs(gate.x - c.x) < c.w / 2 && Math.abs(gate.z - c.z) < c.d / 2;
        assert.ok(!hit, 'Box blockiert das Tor');
      } else {
        assert.ok(Math.hypot(gate.x - c.x, gate.z - c.z) > c.r, 'Kreis blockiert das Tor');
      }
    }
  });

  test(`Die Burg ist nicht spiegelsymmetrisch (${name})`, () => {
    const { colliders } = build(THREE).userData;
    const key = (c) => [c.type, c.x, c.z, c.w, c.d, c.r, c.h].join('|');
    const mirrored = new Set(colliders.map((c) => key({ ...c, x: -c.x })));
    const same = colliders.filter((c) => mirrored.has(key(c))).length;
    assert.ok(same < colliders.length / 3);
  });
}

test('Die beiden Burgen unterscheiden sich im Grundriss', () => {
  const a = buildCastle(THREE).userData;
  const b = buildCastle2(THREE).userData;
  assert.notDeepEqual(a.colliders, b.colliders);
  assert.notEqual(a.gate.x, b.gate.x);
});

test('Burginnenraum liefert Räume mit Kamerapunkten und Lichtern', () => {
  const g = buildCastleInterior(THREE);
  assert.ok(g instanceof THREE.Group);
  assert.equal(g.name, 'castleInterior');
  const { rooms, lights } = g.userData;
  assert.ok(rooms.length >= 5);
  for (const r of rooms) {
    assert.ok(r.id && r.label);
    assert.equal(r.eye.length, 3);
    assert.equal(r.target.length, 3);
    assert.ok(Number.isFinite(r.cutY));
    assert.ok(lights.some((l) => l.room === r.id), `Licht für ${r.id}`);
  }
  const box = new THREE.Box3().setFromObject(g);
  assert.ok(box.min.y >= -1 && box.max.y < 70);
});
