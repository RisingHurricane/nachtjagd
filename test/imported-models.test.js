'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { console, TextDecoder, TextEncoder, Blob, URL, setTimeout, clearTimeout };
context.self = { URL };
vm.createContext(context);
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url));
vm.runInContext(read('public/entwurf/vendor/three.min.js').toString(), context);
const T = context.THREE;
// Nur die Bilddekodierung ersetzen. GLB-Geometrie, Skelette und Animationen lädt der echte Loader.
T.TextureLoader.prototype.load = function (url, onLoad) {
  const texture = new T.Texture(); texture.image = { width: 2, height: 2 };
  queueMicrotask(() => onLoad(texture)); return texture;
};
vm.runInContext(read('public/entwurf/vendor/GLTFLoader.js').toString(), context);
const Loader = T.GLTFLoader;
const names = ['monster.glb', 'stylized_low-poly_wendigo.glb', 'low_poly_forest_tree.glb',
  'low_poly_forest_tree_pack.glb', 'low-poly_trees.glb', 'willys_jeep_low_poly.glb', 'mountain_low_poly.glb'];
const loaded = new Map(await Promise.all(names.map(async name => {
  const bytes = read('public/assets/imported/' + name);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((resolve, reject) => new Loader().parse(data, '', resolve, reject));
  return [name, gltf];
})));
function api(fail = false) {
  T.GLTFLoader = class { loadAsync(url) {
    return fail ? Promise.reject(new Error('Test: fehlendes Modell')) : Promise.resolve(loaded.get(new URL(url).pathname.split('/').pop()));
  } };
  const c = { THREE: T, URL, console: { warn() {} }, document: { currentScript: { src: 'http://localhost/entwurf/imported-models.js' } } };
  vm.runInNewContext(read('public/entwurf/imported-models.js').toString(), c);
  return c.NachtjagdImportedModels;
}

test('Alle sieben echten GLBs laden; acht Baumvarianten bleiben nach Geländeänderungen am Boden', async () => {
  const models = api(); await models.ready;
  assert.equal(models.errors.length, 0);
  const scene = new T.Scene(), forest = new T.Group(), trunks = new T.Group();
  let y = 7;
  const placements = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, z: i, height: 15, clearance: 4 }));
  const result = models.buildForest({ scene, placements, heightAt: () => y, forest, trunks });
  await models.ready;
  assert.equal(result.root.userData.treeCount, placements.length);
  assert.equal(result.root.userData.variantCount, 8);
  assert.equal(forest.visible, false); assert.equal(trunks.visible, false);
  y = 21; result.update();
  const matrix = new T.Matrix4();
  for (const mesh of result.root.children) {
    mesh.getMatrixAt(0, matrix); assert.equal(matrix.elements[13], 21);
    mesh.geometry.computeBoundingBox(); assert.ok(mesh.geometry.boundingBox.min.y >= -1e-5);
  }
});

test('Jeep entfernt die Präsentationsfläche und passt zum Fahrzeugursprung', async () => {
  const models = api(); await models.ready;
  const builders = { jeep: () => { const g = new T.Group(); g.userData = { wheels: [] }; return g; } };
  models.installJeep(builders);
  const jeep = builders.jeep(T), bounds = new T.Box3().setFromObject(jeep), size = bounds.getSize(new T.Vector3());
  assert.equal(jeep.userData.imported, true);
  assert.ok(Math.abs(bounds.min.y) < 1e-5);
  assert.ok(Math.abs(size.z - 4.2) < 1e-5);
  assert.ok(size.x < 3 && size.y < 5);
});

test('Wendigos haben unabhängige Skelette und Animationen; fehlende Dateien behalten Platzhalter', async () => {
  const models = api(); await models.ready;
  const a = new T.Group(), b = new T.Group();
  models.decorateEnemy(a, 'lycan', { scale: 1 }); models.decorateEnemy(b, 'lycan', { scale: 1 });
  let skinA, skinB;
  a.traverse(n => { if (n.isSkinnedMesh) skinA = n; });
  b.traverse(n => { if (n.isSkinnedMesh) skinB = n; });
  assert.ok(skinA && skinB); assert.notEqual(skinA.skeleton, skinB.skeleton);
  skinA.skeleton.bones.forEach((bone, i) => assert.notEqual(bone, skinB.skeleton.bones[i]));
  models.updateEnemy(a, .2, .7, 0);
  assert.equal(b.userData.mixer.time, 0);
  assert.equal(a.userData.mixer.time, .2);
  assert.notEqual(skinA.material, skinB.material);
  models.disposeEnemy(a); models.disposeEnemy(b);
  const missing = api(true); await missing.ready;
  const forest = new T.Group(), trunks = new T.Group();
  const fallback = missing.buildForest({ scene: new T.Scene(), placements: [], heightAt: () => 0, forest, trunks });
  await missing.ready;
  assert.equal(missing.errors.length, 7); assert.equal(fallback.root.children.length, 0);
  assert.equal(forest.visible, true); assert.equal(trunks.visible, true);
});

test('Abstandsstufe: nahe Bäume als Modell, ferne als Kegel, Summe bleibt gleich', async () => {
  const models = api(); await models.ready;
  const placements = Array.from({ length: 60 }, (_, i) => ({ x: i * 10, z: 0, height: 15, clearance: 4, rx: 3, rz: 3 }));
  const geometry = new T.ConeGeometry(1, 1, 5), material = new T.MeshBasicMaterial();
  const forest = new T.InstancedMesh(geometry, material, 60), trunks = new T.InstancedMesh(geometry, material, 60);
  const dummy = new T.Object3D();
  placements.forEach((p, i) => { dummy.position.set(p.x, 0, p.z); dummy.updateMatrix(); forest.setMatrixAt(i, dummy.matrix); trunks.setMatrixAt(i, dummy.matrix); });
  const result = models.buildForest({ scene: new T.Scene(), placements, heightAt: () => 0, forest, trunks });
  await models.ready;
  const camera = { position: { x: 0, z: 0 } };
  result.lod(camera);
  const scene = result.root.parent;
  const fars = scene.children.filter(o => o.isInstancedMesh);
  assert.equal(fars.length, 2);
  // Kamera bei x=0: Bäume mit x < 140 (Indizes 0 bis 13) sind nah
  assert.equal(fars[0].count, 60 - 14);
  const detail = result.root.children.filter(m => m.count > 0).reduce((n, m) => Math.max(n, m.count), 0);
  assert.ok(detail > 0);
  // Kamera weit weg: alles Kegel
  camera.position.x = 5000; result.lod(camera);
  assert.equal(fars[0].count, 60);
  assert.ok(result.root.children.every(m => m.count === 0));
});

test('Jeep: vier Räder getrennt, Vorderräder lenkbar, Rollachse x, Räder berühren den Boden', async () => {
  const models = api(); await models.ready;
  const builders = { jeep: () => { const g = new T.Group(); g.userData = { wheels: [] }; return g; } };
  models.installJeep(builders);
  const jeep = builders.jeep(T), { wheels } = jeep.userData;
  assert.equal(wheels.length, 4);
  assert.equal(wheels.filter(w => w.steer).length, 2);
  for (const w of wheels) assert.ok(w.radius > .3 && w.radius < .7, `Radius ${w.radius}`);
  // Räder liegen vorn und hinten, links und rechts
  const centers = wheels.map(w => (w.steer || w.spin.parent).position);
  assert.ok(centers.filter(c => c.z > 0).length === 2 && centers.filter(c => c.x > 0).length === 2);
  // Rollen um x bewegt die Reifenoberfläche vorwärts-abwärts; die Reifenmitte bleibt am Ort
  jeep.updateMatrixWorld(true);
  const w = wheels[0], before = new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3());
  w.spin.rotation.x = 1.2; jeep.updateMatrixWorld(true);
  const after = new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3());
  assert.ok(before.distanceTo(after) < .08, `Radmitte wandert um ${before.distanceTo(after)}`);
  w.spin.rotation.x = 0; jeep.updateMatrixWorld(true);
  const lowest = Math.min(...wheels.map(x => new T.Box3().setFromObject(x.spin.parent).min.y));
  assert.ok(Math.abs(lowest) < .05, `unterste Radkante ${lowest}`);
});

test('Gegnerdarstellung: Wendigo läuft über Knochen, Wolf schaukelt, fehlende Gegnerart bleibt Platzhalter', async () => {
  const models = api(); await models.ready;
  const walker = new T.Group(), rest = new T.Group(), wolf = new T.Group(), hag = new T.Group();
  models.decorateEnemy(walker, 'villager', { scale: 1 }); models.decorateEnemy(rest, 'villager', { scale: 1 });
  models.decorateEnemy(wolf, 'wolf', { scale: 1 }); models.decorateEnemy(hag, 'hag', { scale: 1 });
  assert.ok(walker.userData.imported && wolf.userData.imported); assert.equal(hag.userData.imported, undefined);
  const heights = [walker, wolf].map(g => new T.Box3().setFromObject(g).getSize(new T.Vector3()).y);
  assert.ok(heights[0] > 1.7 && heights[0] < 2.3, `Dorfbewohner ${heights[0]}`);
  const thigh = g => g.userData.rig.bones.LeftUpLeg.quaternion;
  assert.ok(walker.userData.rig.bones.LeftUpLeg && walker.userData.rig.bones.Spine1);
  let spread = 0;
  for (let i = 0; i < 30; i++) { models.updateEnemy(walker, .05, 0, 0, { speed: 3, state: 'walk' }); models.updateEnemy(rest, .05, 0, 0, { speed: 0, state: 'walk' }); spread = Math.max(spread, thigh(walker).angleTo(thigh(rest))); }
  assert.ok(spread > .3, 'Gehender Gegner bewegt die Beine anders als stehender');
  // Zuschlagen hebt die Arme: Armknochen weichen stark von der Ruhehaltung ab
  const armBefore = walker.userData.rig.bones.LeftArm.quaternion.clone();
  for (let i = 0; i < 20; i++) models.updateEnemy(walker, .05, 0, 0, { speed: 0, state: 'windup' });
  assert.ok(walker.userData.rig.attack > .9);
  assert.ok(walker.userData.rig.bones.LeftArm.quaternion.angleTo(armBefore) > .5);
  models.updateEnemy(wolf, .1, 0, 0, { speed: 5, state: 'walk' });
  assert.ok(wolf.userData.rig.holder.rotation.x < 0);
});

test('Gebirgskulisse: Skirt abgeschnitten, sechs Klone teilen ein Netz, Dunstfarbe wirkt auf alle', async () => {
  const models = api(); await models.ready;
  const scene = new T.Scene(), backdrop = models.buildBackdrop({ scene, count: 6 });
  await models.ready;
  assert.equal(backdrop.root.children.length, 6);
  const geometries = new Set(backdrop.root.children.map(m => m.geometry));
  assert.equal(geometries.size, 1);
  const geometry = [...geometries][0], box = geometry.boundingBox;
  assert.ok(box.max.y > 300 && geometry.index.count / 3 < 5000, `Höhe ${box.max.y}, Dreiecke ${geometry.index.count / 3}`);
  assert.ok(geometry.index.count < 15000 && geometry.index.count > 3000);
  backdrop.setMood(new T.Color(0.2, 0.1, 0.3));
  assert.ok(backdrop.root.children[0].material.color.b > 0.25);
  backdrop.setMood(null);
  assert.ok(Math.abs(backdrop.root.children[3].material.color.r - 0.7) < 1e-6);
  // Der Ring liegt außerhalb der Spielwelt (mindestens 600 m von der Mitte)
  for (const m of backdrop.root.children) assert.ok(Math.hypot(m.position.x, m.position.z) > 550);
});
