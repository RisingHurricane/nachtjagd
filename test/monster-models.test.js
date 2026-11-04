'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url)).toString();
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('public/entwurf/vendor/three.min.js'), context);
vm.runInContext(read('public/entwurf/monster-models.js'), context);
const T = context.THREE, M = context.NachtjagdMonsterModels;
const KINDS = ['villager', 'lycan', 'samca', 'wolf', 'hag', 'spitter', 'bloater', 'brute', 'reaper', 'bat'];
const make = kind => { const skin = new T.MeshLambertMaterial(); const g = new T.Group(); const r = M.build(T, kind, skin); g.add(r.model); g.userData = { parts: r.parts, kind, mat: skin }; return { g, ...r, skin }; };
const tris = o => { let n = 0; o.traverse(m => { if (m.isMesh) n += m.geometry.attributes.position.count / 3; }); return n; };

test('Alle zehn Gegnerarten haben eigene Figuren mit leuchtenden Augen und kleinem Dreiecksbudget', () => {
  const shapes = new Set();
  for (const kind of KINDS) {
    const { g } = make(kind);
    let eyes = 0; g.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) eyes++; });
    assert.ok(eyes >= 1, `${kind}: Augen`);
    assert.ok(tris(g) <= 900, `${kind}: ${tris(g)} Dreiecke`);
    shapes.add(JSON.stringify(M.PLANS[kind].map(j => j.name + j.parts.length)));
  }
  assert.ok(shapes.size >= 9, 'mindestens neun unterscheidbare Gestalten');
});

test('Bodengegner stehen auf dem Boden und sind etwa menschengroß; Flieger haben Flügelgelenke', () => {
  for (const kind of ['villager', 'lycan', 'spitter', 'bloater', 'brute', 'hag']) {
    const { g } = make(kind); g.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(g);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.35, `${kind}: Fuß bei ${box.min.y}`);
    assert.ok(box.max.y > 1.6 && box.max.y < 2.6, `${kind}: Höhe ${box.max.y}`);
  }
  for (const kind of ['reaper', 'bat']) { const { parts } = make(kind); assert.ok(parts.wingL && parts.wingR, kind); }
});

test('Gleiche Art teilt Formen, Haut bleibt je Gegner eigen; Laufen bewegt die Beine, Zuschlagen hebt die Arme', () => {
  const a = make('lycan'), b = make('lycan');
  const meshA = a.parts.body.children[0], meshB = b.parts.body.children[0];
  assert.equal(meshA.geometry, meshB.geometry);
  assert.notEqual(a.skin, b.skin);
  for (let i = 0; i < 20; i++) M.animate(a.g, .05, { speed: 3, state: 'walk' }, i * .05);
  assert.ok(Math.abs(a.parts.legL.rotation.x) > .05 || Math.abs(a.parts.legR.rotation.x) > .05);
  for (let i = 0; i < 20; i++) M.animate(b.g, .05, { speed: 0, state: 'windup' }, i * .05);
  assert.ok(b.parts.armL.rotation.x < -1, 'Arme gehoben');
});
