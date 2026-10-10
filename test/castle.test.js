'use strict';
// Tests für das Burgmodell (public/models/castle.js) mit three aus node_modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCastle } from '../public/models/castle.js';

test('Burg liefert eine Gruppe mit Kollisionsdaten und Tor', () => {
  const castle = buildCastle(THREE);
  assert.ok(castle instanceof THREE.Group);
  const u = castle.userData;
  assert.equal(u.kind, 'castle');
  assert.deepEqual(u.gate.facing, '+z');
  assert.ok(u.colliders.length >= 8);
  for (const c of u.colliders) {
    assert.ok(c.type === 'box' || c.type === 'circle');
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && c.h > 0);
  }
});

test('Burg bleibt innerhalb des Footprints und hat ein Fensterleuchtmaterial', () => {
  const castle = buildCastle(THREE);
  const box = new THREE.Box3().setFromObject(castle);
  assert.ok(box.min.y >= -1.7); // Sockel reicht 1,6 m unter den Boden
  assert.ok(box.max.y <= castle.userData.height + 0.01);
  assert.ok(box.max.z <= castle.userData.footprint.d / 2 + 3);
  const half = castle.userData.footprint.w / 2 + 3;
  assert.ok(box.min.x >= -half && box.max.x <= half);
  const windows = castle.getObjectByName('windows');
  assert.ok(windows && windows.isInstancedMesh);
});

test('Das Tor ist frei: kein Collider im Torbogen', () => {
  const { colliders, gate } = buildCastle(THREE).userData;
  for (const c of colliders) {
    if (c.type === 'box') {
      const hit = Math.abs(gate.x - c.x) < c.w / 2 && Math.abs(gate.z - c.z) < c.d / 2;
      assert.ok(!hit, 'Box blockiert das Tor');
    } else {
      assert.ok(Math.hypot(gate.x - c.x, gate.z - c.z) > c.r, 'Kreis blockiert das Tor');
    }
  }
});

test('Die Burg ist nicht spiegelsymmetrisch', () => {
  const { colliders } = buildCastle(THREE).userData;
  const key = (c) => [c.type, c.x, c.z, c.w, c.d, c.r, c.h].join('|');
  const mirrored = new Set(colliders.map((c) => key({ ...c, x: -c.x })));
  const same = colliders.filter((c) => mirrored.has(key(c))).length;
  assert.ok(same < colliders.length / 3);
});
