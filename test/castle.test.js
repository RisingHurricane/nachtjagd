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

  test(`Burg bleibt innerhalb des Footprints (${name})`, () => {
    const castle = build(THREE);
    const box = new THREE.Box3().setFromObject(castle);
    assert.ok(box.min.y >= (name === 'castle' ? -9 : -1.7)); // Fels reicht bei castle.js 8,6 m unter den Boden (Keller)
    assert.ok(box.max.y <= castle.userData.height + 0.01);
    const { w, d } = castle.userData.footprint;
    assert.ok(box.min.x >= -w / 2 - 3 && box.max.x <= w / 2 + 3);
    assert.ok(box.min.z >= -d / 2 - 3 && box.max.z <= d / 2 + 3);
  });

  test(`Fenster sind echt: Glas ist durchsichtig und die Mauer hat Öffnungen (${name})`, () => {
    const castle = build(THREE);
    const windows = castle.getObjectByName('windows');
    assert.ok(windows && windows.children.length >= 3);
    const glass = windows.children.find((m) => m.name === 'windowGlass');
    assert.ok(glass && glass.isInstancedMesh);
    assert.equal(glass.material.name, 'windowGlass');
    assert.ok(glass.material.transparent && glass.material.opacity < 0.5);
    const stats = castle.userData.windows;
    assert.ok(stats.open >= stats.total * 0.9, 'fast alle Fenster sind echte Öffnungen: ' + JSON.stringify({ ...stats, openList: undefined }));
    const walls = [];
    castle.traverse((o) => { if (o.name === 'hollowWall') walls.push(o); });
    assert.ok(walls.length >= 5);
    for (const wall of walls) {
      const p = wall.geometry.attributes.position.array;
      assert.ok(p.length > 0 && p.every(Number.isFinite));
    }
    // Ein Strahl von 1,5 m vor dem Fenster nach innen trifft keine Außenhaut: die Öffnung geht durch.
    castle.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const q of stats.openList) {
      const dir = new THREE.Vector3(-Math.sin(q.yaw), 0, -Math.cos(q.yaw));
      ray.set(new THREE.Vector3(q.x - dir.x * 1.5, q.y, q.z - dir.z * 1.5), dir);
      ray.far = 2.4;
      assert.equal(ray.intersectObjects(walls, false).length, 0, 'Wand verschließt das Fenster bei ' + q.x.toFixed(1) + ', ' + q.z.toFixed(1));
    }
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
  assert.ok(rooms.length >= 14);
  assert.ok(rooms.some((r) => r.group === 'Keller'));
  for (const r of rooms) {
    assert.ok(r.id && r.label);
    assert.equal(r.eye.length, 3);
    assert.equal(r.target.length, 3);
    assert.ok(Number.isFinite(r.cutY));
    assert.ok(lights.some((l) => l.room === r.id), `Licht für ${r.id}`);
  }
  const box = new THREE.Box3().setFromObject(g);
  assert.ok(box.min.y >= -5.5 && box.max.y < 70); // Keller bis 4,8 m unter dem Boden
});

test('Fenster der Innenräume sind echte Löcher in den Raumhüllen', () => {
  const g = buildCastleInterior(THREE);
  const stats = g.userData.windows;
  assert.ok(stats.total >= 50);
  assert.equal(stats.loose, 0, 'alle Innenfenster sitzen in einer Raumhülle: ' + JSON.stringify(stats.looseList));
  const shells = [];
  g.traverse((o) => { if (o.name === 'roomShell') shells.push(o); });
  assert.ok(shells.length >= 8);
  let reveals = 0;
  g.traverse((o) => { if (o.name === 'windowReveal') reveals++; });
  assert.ok(reveals >= 8);
  g.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const q of stats.openList) {
    const out = new THREE.Vector3(Math.sin(q.yaw), 0, Math.cos(q.yaw));
    ray.set(new THREE.Vector3(q.x - out.x * 1.2, q.y, q.z - out.z * 1.2), out);
    ray.far = 1.6; // 1,2 m bis zur Wand und 0,4 m in die Laibung hinein
    assert.equal(ray.intersectObjects(shells, false).length, 0, `Wand verschließt das Fenster bei ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
  }
  // Glas ist durchsichtig
  const glass = g.getObjectByName('windows').children.filter((m) => m.name === 'windowGlass');
  assert.ok(glass.length >= 1 && glass.every((m) => m.material.transparent && m.material.opacity < 0.7));
});
