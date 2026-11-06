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
const names = [];
const loaded = new Map(await Promise.all(names.map(async name => {
  // Das Spiel lädt die verkleinerten Fassungen (tools/optimize-models.mjs).
  const bytes = read('public/assets/opt/' + name);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((resolve, reject) => new Loader().parse(data, '', resolve, reject));
  return [name, gltf];
})));
let lastContext = null;
const globalThisTrees = () => lastContext.NachtjagdTreeModels.variants(T);
function api(fail = false) {
  T.GLTFLoader = class { loadAsync(url) {
    return fail ? Promise.reject(new Error('Test: fehlendes Modell')) : Promise.resolve(loaded.get(new URL(url).pathname.split('/').pop()));
  } };
  const c = { THREE: T, URL, console: { warn() {} }, document: { currentScript: { src: 'http://localhost/entwurf/imported-models.js' } } };
  c.globalThis = c;
  vm.runInNewContext(read('public/entwurf/tree-models.js').toString(), c);
  vm.runInNewContext(read('public/entwurf/imported-models.js').toString(), c);
  lastContext = c;
  return c.NachtjagdImportedModels;
}

test('Gebirgs-GLB lädt; acht eigene Baumvarianten bleiben nach Geländeänderungen am Boden', async () => {
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

test('Ohne Downloads: Wald steht aus eigenen Bäumen', async () => {
  const missing = api(true); await missing.ready;
  const forest = new T.Group(), trunks = new T.Group();
  const fallback = missing.buildForest({ scene: new T.Scene(), placements: [{ x: 0, z: 0, height: 15, clearance: 4 }], heightAt: () => 0, forest, trunks });
  await missing.ready;
  assert.equal(missing.errors.length, 0); // nichts mehr zu laden
  // Die Bäume hängen nicht mehr an Downloads: Auch ohne GLBs steht der eigene Wald.
  await fallback.ready; assert.ok(fallback.root.children.length > 0);
  assert.equal(forest.visible, false); assert.equal(trunks.visible, false);
});

test('Alle Entfernungen behalten die importierten Baumformen (fern vereinfacht); nur nahe Modelle werfen Schatten', async () => {
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
  assert.equal(scene.children.filter(o=>o.isInstancedMesh).length,0,'Keine vereinfachten Ersatzkronen');
  const pairs=[];
  for(let i=0;i<result.root.children.length;i+=2) {
    const near=result.root.children[i],far=result.root.children[i+1];pairs.push([near,far]);
    assert.equal(near.material,far.material);
    assert.notEqual(far.geometry,geometry,'Fernbäume verwenden die Baumform, keine Ersatzkegel');
    const tris=g=>g.index?g.index.count:g.attributes.position.count;
    assert.ok(tris(far.geometry)<=tris(near.geometry),'Fernfassung hat höchstens so viele Dreiecke wie das nahe Modell');
    assert.equal(near.castShadow,true);assert.equal(far.castShadow,false);
    assert.equal(near.count+far.count,near.instanceMatrix.count);
  }
  assert.ok(pairs.some(([near])=>near.count>0));assert.ok(pairs.some(([,far])=>far.count>0));
  camera.position.x = 5000; result.lod(camera);
  for(const [near,far] of pairs) {assert.equal(near.count,0);assert.equal(far.count,far.instanceMatrix.count);}
  result.update();result.lod(camera);
  for(const [near,far] of pairs)assert.equal(near.count+far.count,far.instanceMatrix.count,'Auch nach Geländeänderung kein Baum verloren');
  camera.position.x=0;result.lod(camera,180);
  const reduced=pairs.reduce((n,[a,b])=>n+a.count+b.count,0);
  result.lod(camera);
  assert.ok(pairs.reduce((n,[a,b])=>n+a.count+b.count,0)>reduced,'Im undurchsichtigen Nebel werden nur unsichtbare Ferninstanzen ausgespart');
});

test('Nur unsichtbare Fernbäume werden ausgespart; Drehen und Geländeänderung aktualisieren den Sichtbereich',async()=>{
  const models=api();await models.ready;
  let y=0;
  const result=models.buildForest({scene:new T.Scene(),placements:[-200,200].map(z=>({x:0,z,height:15,clearance:4})),heightAt:()=>y,forest:new T.Group(),trunks:new T.Group()});
  await result.ready;
  const camera=new T.PerspectiveCamera(70,1,.1,2000);camera.position.set(0,10,0);camera.lookAt(0,10,-200);
  result.lod(camera);
  const matrix=new T.Matrix4(),distant=result.root.children.filter(m=>!m.castShadow);
  for(const m of distant) {assert.equal(m.count,1);m.getMatrixAt(0,matrix);assert.equal(matrix.elements[14],-200);}
  camera.lookAt(0,10,200);result.lod(camera);
  for(const m of distant) {assert.equal(m.count,1);m.getMatrixAt(0,matrix);assert.equal(matrix.elements[14],200);}
  y=500;result.update();result.lod(camera);assert.ok(distant.every(m=>m.count===0));
});

test('Fernkrone hat mehrere Astetagen, Vertexfarben und ein kleines Dreiecksbudget', async () => {
  const models=api(); await models.ready;
  const g=models.pineGeometry(); g.computeBoundingBox();
  assert.equal(g.boundingBox.min.y,-.5); assert.equal(g.boundingBox.max.y,.5);
  assert.ok(g.attributes.position.count/3<=100);
  assert.equal(g.attributes.color.count,g.attributes.position.count);
  const levels=new Set(); for(let i=0;i<g.attributes.position.count;i++) levels.add(g.attributes.position.getY(i).toFixed(3));
  assert.ok(levels.size>8,'Krone besteht aus mehreren versetzten Astetagen');
});

test('Geländewagen (eigenes Modell): vier Räder, Vorderräder lenkbar, Rollachse x, Räder berühren den Boden', () => {
  const c = { THREE: T, console };
  vm.runInNewContext(read('public/entwurf/vehicle-models.js').toString(), c);
  const jeep = c.NachtjagdVehicleModels.builders.jeep(T), { wheels, headlight } = jeep.userData;
  assert.equal(headlight, true);
  let ownLights = 0; jeep.traverse(o => { if (o.isLight) ownLights++; });
  assert.equal(ownLights, 0, 'Wagen tragen kein eigenes Licht');
  assert.equal(wheels.length, 4);
  assert.equal(wheels.filter(w => w.steer).length, 2);
  for (const w of wheels) assert.ok(w.radius > .3 && w.radius < .7, `Radius ${w.radius}`);
  const centers = wheels.map(w => w.spin.parent.position);
  assert.ok(centers.filter(p => p.z > 0).length === 2 && centers.filter(p => p.x > 0).length === 2);
  jeep.updateMatrixWorld(true);
  const size = new T.Box3().setFromObject(jeep).getSize(new T.Vector3());
  assert.ok(size.z > 3.6 && size.z < 4.4 && size.x < 2.4 && size.y < 2.2, `Maße ${size.x} ${size.y} ${size.z}`);
  const w = wheels[0], before = new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3());
  w.spin.rotation.x = 1.2; jeep.updateMatrixWorld(true);
  const after = new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3());
  assert.ok(before.distanceTo(after) < .08, `Radmitte wandert um ${before.distanceTo(after)}`);
  w.spin.rotation.x = 0; jeep.updateMatrixWorld(true);
  const lowest = Math.min(...wheels.map(x => new T.Box3().setFromObject(x.spin.parent).min.y));
  assert.ok(Math.abs(lowest) < .05, `unterste Radkante ${lowest}`);
  // Feste Teile sind je Material zusammengefasst; zwei Wagen teilen Formen und Materialien
  const bodies = g => g.children.filter(o => o.isMesh);
  const other = c.NachtjagdVehicleModels.builders.jeep(T);
  assert.ok(bodies(jeep).length <= 14, `Netze am Wagenkörper: ${bodies(jeep).length}`);
  assert.equal(new Set(bodies(jeep).map(m => m.material)).size, bodies(jeep).length);
  assert.equal(bodies(other)[0].geometry, bodies(jeep)[0].geometry);
  for (const w of wheels) assert.ok(w.spin.children.length <= 4, 'Rad: höchstens vier Netze');
});

test('Fernbäume: vereinfachte Fassungen derselben Modelle mit deutlich weniger Dreiecken, gleicher Fußpunkt; nah höchstens 160 Dreiecke', async () => {
  const models = api(); await models.ready;
  const placements = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, z: 0, height: 15, clearance: 4 }));
  const result = models.buildForest({ scene: new T.Scene(), placements, heightAt: () => 0, forest: new T.Group(), trunks: new T.Group() });
  await result.ready;
  let near = 0, far = 0;
  for (let i = 0; i < result.root.children.length; i += 2) {
    const a = result.root.children[i].geometry, b = result.root.children[i + 1].geometry;
    near += a.index ? a.index.count : a.attributes.position.count; far += b.index ? b.index.count : b.attributes.position.count;
    b.computeBoundingBox(); a.computeBoundingBox();
    assert.ok(Math.abs(b.boundingBox.min.y - a.boundingBox.min.y) < .05, 'Fernfassung steht auf demselben Boden');
  }
  assert.ok(far < near * 0.6, `Fern ${far} gegenüber nah ${near}`);
  // Sparsam: je Variante (Stamm + Krone) höchstens 160 Dreiecke in der Nahfassung.
  const variants = c => c; for (const v of globalThisTrees()) { let n = 0; v.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); assert.ok(n <= 160, `Variante mit ${n} Dreiecken`); }
});
