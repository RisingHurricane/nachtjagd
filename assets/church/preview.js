'use strict';
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9baeb5');
const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 300);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxDistance = 110;
const sky = new THREE.HemisphereLight(0xbcd9ef, 0x5d5142, 1.05);
scene.add(sky);
const sun = new THREE.DirectionalLight(0xffe2bc, 2.5);
sun.position.set(-20, 35, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-35, right:35, top:35, bottom:-35, near:1, far:110});
sun.shadow.bias = -0.0002;
sun.target.position.set(0, 7, -14);
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160,160), new THREE.MeshStandardMaterial({color:0x566565, roughness:1}));
ground.rotation.x = -Math.PI/2;
ground.position.set(0,-1.41,-14);
ground.receiveShadow = true;
scene.add(ground);
const roomFill = new THREE.PointLight(0xb1c6e4, 1.3, 28, 1);
roomFill.position.set(0, 7, -18);
scene.add(roomFill);
for (const x of [-3.4,3.4]) for (const z of [-13,-21]) {
  const light = new THREE.PointLight(0xffb55f, 1.4, 13, 1.3);
  light.position.set(x,5.1,z);
  scene.add(light);
}
const views = {
  outside: {eye:[39,27,47], target:[0,14,-13]},
  inside: {eye:[0,2.1,-5], target:[0,5.6,-24]},
  side: {eye:[-44,19,-14], target:[0,13,-15]}
};
function setView(name) {
  const view = views[name];
  camera.position.fromArray(view.eye);
  controls.target.fromArray(view.target);
  controls.minDistance = name === 'inside' ? 0.2 : 3;
  controls.update();
  for (const key of Object.keys(views)) document.getElementById(key).classList.toggle('active', key===name);
}
for (const name of Object.keys(views)) document.getElementById(name).onclick = () => setView(name);
let night = false;
document.getElementById('night').onclick = () => {
  night = !night;
  scene.background.set(night ? '#101b2a' : '#9baeb5');
  sun.intensity = night ? 0.24 : 2.5;
  sky.intensity = night ? 0.32 : 1.05;
  document.getElementById('night').setAttribute('aria-pressed',String(night));
  document.getElementById('night').classList.toggle('active',night);
};
setView('outside');
new THREE.GLTFLoader().load('church.glb?v=1.1', (gltf) => {
  gltf.scene.traverse((node) => { if (node.isMesh) {node.castShadow=true; node.receiveShadow=true;} });
  scene.add(gltf.scene);
  window.churchPreview = {scene, camera, controls, model:gltf.scene, renderer};
  document.getElementById('status').textContent = 'Erste Modellfassung · frei erkundbar';
}, undefined, (error) => {
  document.getElementById('status').textContent = 'Modell konnte nicht geladen werden. Bitte neu laden.';
  console.error(error);
});
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
resize();
renderer.setAnimationLoop(() => {controls.update(); renderer.render(scene,camera);});
