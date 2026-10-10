'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/entwurf/terrain-editor.js', import.meta.url), 'utf8'), context);
function model() {
  return context.NachtjagdTerrain.create({ width: 9, depth: 9, step: 5, originX: -20, originZ: -20, base: new Float32Array(81).fill(10) });
}
const brush = { x: 0, z: 0, radius: 12, strength: 10, seconds: 1, tool: 'raise' };
test('Höhenpinsel hebt die Mitte an und lässt entfernte Punkte unverändert', () => {
  const terrain = model();
  terrain.begin(); terrain.brush(brush); terrain.end();
  assert.equal(terrain.offsets[40], 10);
  assert.equal(terrain.offsets[0], 0);
  assert.ok(terrain.offsets[41] > 0 && terrain.offsets[41] < 10);
});
test('Eine komplette Pinselbewegung ist rückgängig und wiederherstellbar', () => {
  const terrain = model();
  terrain.begin(); terrain.brush(brush); terrain.brush(brush); terrain.end();
  assert.equal(terrain.offsets[40], 20);
  terrain.undo(); assert.equal(terrain.offsets[40], 0);
  terrain.redo(); assert.equal(terrain.offsets[40], 20);
});
test('Schutzmaske lässt geschützte Bereiche unverändert', () => {
  const terrain = model();
  terrain.brush({ ...brush, protect: x => x <= 0 ? 0 : 1 });
  assert.equal(terrain.offsets[40], 0); assert.ok(terrain.offsets[41] > 0);
});
test('Absenken und Ebnen berücksichtigen die Ausgangshöhe', () => {
  const terrain = model();
  terrain.brush({ ...brush, tool: 'lower' }); assert.equal(terrain.offsets[40], -10);
  terrain.brush({ ...brush, tool: 'flatten', level: 15 }); assert.equal(terrain.offsets[40], 5);
});
test('Glätten reduziert eine Spitze und überträgt Höhe an ihre Nachbarn', () => {
  const terrain = model(); terrain.offsets[40] = 20;
  terrain.brush({ ...brush, tool: 'smooth' });
  assert.ok(terrain.offsets[40] < 20); assert.ok(terrain.offsets[41] > 0);
});
test('Speichern und Laden erhält den Entwurf; ungültige Daten verändern ihn nicht', () => {
  const terrain = model(); terrain.brush(brush);
  const restored = model(); restored.load(terrain.serialize());
  assert.deepEqual(Array.from(restored.offsets), Array.from(terrain.offsets));
  const invalid = JSON.parse(restored.serialize()); invalid.offsets[0] = '30';
  assert.throws(() => restored.load(JSON.stringify(invalid)));
  assert.equal(restored.offsets[40], 10); assert.equal(restored.offsets[0], 0);
  invalid.offsets[0] = 900; assert.throws(() => restored.load(JSON.stringify(invalid)));
});
test('Zurücksetzen ist rückgängig; neuer Pinselstrich ersetzt den Vorwärtsverlauf', () => {
  const terrain = model(); terrain.begin(); terrain.brush(brush); terrain.end();
  terrain.reset(); assert.equal(terrain.offsets[40], 0);
  terrain.undo(); assert.equal(terrain.offsets[40], 10);
  terrain.begin(); terrain.brush(brush); terrain.end(); assert.equal(terrain.canRedo, false);
});
test('Dateien einer anderen Grundform werden ohne Änderung abgewiesen', () => {
  const terrain = model(); terrain.brush(brush);
  const wrongBase = JSON.parse(terrain.serialize()); wrongBase.basis = 'alte-welt';
  assert.throws(() => terrain.load(JSON.stringify(wrongBase)));
  assert.equal(terrain.offsets[40], 10);
  wrongBase.basis = 'default'; wrongBase.version = 1;
  assert.throws(() => terrain.load(JSON.stringify(wrongBase)));
  assert.equal(terrain.offsets[40], 10);
});

test('Äußere Hochgipfel über 400 m bleiben bearbeitbar und werden wiederhergestellt',()=>{
  const options={width:3,depth:3,step:5,originX:-5,originZ:-5,base:new Float32Array(9).fill(420),basis:'high-mountains',maxHeight:650};
  const terrain=context.NachtjagdTerrain.create(options);
  terrain.begin();terrain.brush({x:0,z:0,radius:8,strength:10,seconds:1,tool:'raise'});terrain.end();
  assert.ok(terrain.offsets[4]>0);
  const loaded=context.NachtjagdTerrain.create(options);
  loaded.load(terrain.serialize());
  assert.deepEqual(Array.from(loaded.offsets),Array.from(terrain.offsets));
});
