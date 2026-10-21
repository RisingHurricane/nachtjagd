import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Tests für Lampenfeld (lamp-field.js), Schnee und Lampenkegel (night-fx.js) und Nachbearbeitung (post-fx.js).
async function load(file) {
  const source = await readFile(new URL('../public/entwurf/' + file, import.meta.url), 'utf8');
  const context = { Math, Number, Array, Object, WeakSet, Infinity, console };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { context, source };
}
const { context: lampContext } = await load('lamp-field.js');
const { context: fxContext, source: fxSource } = await load('night-fx.js');
const { context: postContext } = await load('post-fx.js');
const Lamps = lampContext.NachtjagdLampField, Fx = fxContext.NachtjagdNightFx, Post = postContext.NachtjagdPostFx;

test('Lampenfeld: Shaderanteil passt in Lambert-, Phong- und Standardvorlagen', () => {
  for (const kind of ['lambert', 'phong', 'standard']) {
    const shader = { vertexShader: THREE.ShaderLib[kind].vertexShader, fragmentShader: THREE.ShaderLib[kind].fragmentShader, uniforms: {} };
    assert.equal(Lamps.inject(shader, { uLfPos: { value: [] }, uLfCol: { value: [] } }), true, kind);
    assert.ok(shader.vertexShader.includes('vLfP = lfp.xyz'), kind + ': Weltposition');
    assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb += diffuseColor.rgb * lfAdd') < shader.fragmentShader.indexOf('#include <tonemapping_fragment>'), kind + ': vor der Tonwertkorrektur');
    assert.ok(shader.uniforms.uLfPos && shader.uniforms.uLfCol, kind + ': gemeinsame Uniforms');
  }
  // Ohne passende Stellen bleibt ein Shader unverändert
  const plain = { vertexShader: 'void main(){}', fragmentShader: 'void main(){}', uniforms: {} };
  assert.equal(Lamps.inject(plain, { uLfPos: {}, uLfCol: {} }), false);
  assert.equal(plain.vertexShader, 'void main(){}');
});

test('Lampenfeld: nur die acht nächsten Lampen mit Lichtwirkung, Fenster nur als Lichthof', () => {
  const scene = new THREE.Scene(), field = Lamps.create({ THREE, scene });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.7, 0);
  for (let i = 0; i < 20; i++) field.add({ x: i * 5, y: 3, z: 0, r: 12, kind: 'laterne' });
  field.add({ x: .5, y: 2, z: 0, shade: false, halo: 1.5, kind: 'fenster' });
  field.update(camera, .016, { k: 1 });
  assert.equal(field.slots.length, Lamps.SLOTS);
  assert.ok(field.slots.every((l) => l.kind === 'laterne'), 'Fenster belegt keinen Platz');
  assert.deepEqual(Array.from(field.slots, (l) => l.x), [0, 5, 10, 15, 20, 25, 30, 35]);
  assert.equal(field.halos.geometry.attributes.position.count, 21, 'alle Lampen haben einen Lichthof');
  // Tag: keine Lichtwirkung, Lichthöfe aus
  field.update(camera, .016, { k: 0 });
  assert.ok(field.uniforms.uLfCol.value.every((c) => c.length() === 0));
  assert.equal(field.halos.material.uniforms.uK.value, 0);
});

test('Lampenfeld: Materialien werden einmal erweitert, eigene Schlüssel bleiben getrennt', () => {
  const scene = new THREE.Scene(), field = Lamps.create({ THREE, scene });
  const terrain = new THREE.MeshPhongMaterial(); terrain.customProgramCacheKey = () => 'gelaende';
  const wood = new THREE.MeshLambertMaterial(), sky = new THREE.ShaderMaterial(), glow = new THREE.MeshBasicMaterial();
  for (const m of [terrain, wood, sky, glow]) scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  assert.equal(field.patchScene(), 2, 'nur beleuchtete Materialien');
  assert.equal(field.patchScene(), 0, 'kein zweites Mal');
  assert.equal(terrain.customProgramCacheKey(), 'lampfeld-1|gelaende');
  assert.notEqual(wood.customProgramCacheKey(), terrain.customProgramCacheKey());
  assert.ok(wood.customProgramCacheKey().startsWith('lampfeld-1|'));
});

test('Lampenfeld: Fackeln erzeugen Flammen nur in der Nähe', () => {
  const scene = new THREE.Scene(), field = Lamps.create({ THREE, scene });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.7, 0);
  field.add([{ x: 2, y: 2, z: 0, fire: true }, { x: 400, y: 2, z: 0, fire: true }]);
  for (let i = 0; i < 10; i++) field.update(camera, .05, { k: 1 });
  const p = field.flames.geometry.attributes.position, life = field.flames.geometry.attributes.lfFlame;
  let near = 0, far = 0;
  for (let i = 0; i < p.count; i++) if (life.getX(i) > 0) (p.getX(i) > 100 ? far++ : near++);
  assert.ok(near > 5, 'Flammen an der nahen Fackel: ' + near);
  assert.equal(far, 0);
});

test('Schnee: eigener Zufallswert für die Stärke, Kanten der Ausblendung aufsteigend', () => {
  // Ein absteigendes smoothstep(36, 5, d) ist in GLSL undefiniert und ließ den Schnee in manchen Treibern verschwinden.
  for (const m of fxSource.matchAll(/smoothstep\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?),/g)) assert.ok(+m[1] < +m[2], m[0]);
  assert.ok(/float h = fract\(sin\(dot\(s,/.test(fxSource), 'Sichtbarkeit unabhängig von der Lage der Flocke');
  const scene = new THREE.Scene(), snow = Fx.createSnow({ THREE, scene, lamps: null, count: 100 });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(10, 5, 3);
  snow.update(camera, .5, { k: .7, light: .4, opacity: 1 });
  assert.equal(snow.points.visible, true);
  assert.deepEqual(snow.uniforms.uCam.value.toArray(), [10, 5, 3]);
  snow.update(camera, .5, { k: .7, opacity: 0 });
  assert.equal(snow.points.visible, false, 'drinnen kein Schnee');
});

test('Lampenkegel hängt an der Kamera und folgt Länge und Öffnungswinkel', () => {
  const camera = new THREE.PerspectiveCamera(), beam = Fx.createBeam({ THREE, parent: camera });
  beam.update({ on: true, length: 20, angle: .5 });
  assert.equal(beam.mesh.parent, camera);
  assert.equal(beam.mesh.scale.z, 20);
  assert.ok(Math.abs(beam.mesh.scale.x - 20 * Math.tan(.475)) < 1e-9);
  beam.update({ on: false });
  assert.equal(beam.mesh.visible, false);
});

test('Nachbearbeitung: Schalter und Stärken', () => {
  const calls = [];
  const renderer = {
    capabilities: { isWebGL2: true }, outputEncoding: 3001,
    getDrawingBufferSize: (v) => v.set(640, 400), setRenderTarget: (t) => calls.push(['target', !!t]), render: (s) => calls.push(['render', s.type])
  };
  const post = Post.create({ THREE, renderer });
  post.render(new THREE.Scene(), new THREE.PerspectiveCamera(), .016);
  assert.deepEqual(calls.map((c) => c[0] + ':' + c[1]), ['target:true', 'render:Scene', 'target:false', 'render:Scene']);
  assert.equal(post.target.width, 640);
  assert.equal(post.target.texture.encoding, 3001, 'gleiche Farbkodierung wie der Bildschirm');
  post.set({ enabled: false }); calls.length = 0;
  post.render(new THREE.Scene(), new THREE.PerspectiveCamera());
  assert.equal(calls.length, 1, 'ausgeschaltet: direkt auf den Bildschirm');
  post.set({ bloom: false }); assert.equal(post.bloom, false);
});
