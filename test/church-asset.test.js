'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createChurchSpatial} from '../public/assets/church/church-adapter.js';

const base = new URL('../public/assets/church/', import.meta.url);
const readJSON = (name) => JSON.parse(fs.readFileSync(new URL(name, base), 'utf8'));
const manifest = readJSON('church-manifest.json');
const collision = readJSON('church-collision.json');
const file = fs.readFileSync(new URL('church.glb',base));
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.toString('utf8',20,20+jsonLength));
const binStart = 20+jsonLength+8;
const context = {};
vm.runInNewContext(fs.readFileSync(new URL('../public/entwurf/vendor/three.min.js',import.meta.url),'utf8'),context);
const T = context.THREE;

function accessor(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const components = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const sizes = {5121:1,5123:2,5125:4,5126:4};
  const methods = {5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'};
  const stride = v.byteStride ?? components*sizes[a.componentType];
  const start = binStart+(v.byteOffset??0)+(a.byteOffset??0);
  return Array.from({length:a.count*components},(_,i) =>
    file[methods[a.componentType]](start+Math.floor(i/components)*stride+(i%components)*sizes[a.componentType]));
}
function geometryScene() {
  const nodes = gltf.nodes.map((node) => {
    const group = new T.Group(); group.name=node.name;
    if(node.translation)group.position.fromArray(node.translation);
    if(node.rotation)group.quaternion.fromArray(node.rotation);
    if(node.scale)group.scale.fromArray(node.scale);
    if(node.mesh!==undefined)for(const p of gltf.meshes[node.mesh].primitives) {
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(accessor(p.attributes.POSITION),3));
      if(p.indices!==undefined)g.setIndex(accessor(p.indices));
      group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));
    }
    return group;
  });
  gltf.nodes.forEach((node,i) => {for(const child of node.children??[])nodes[i].add(nodes[child]);});
  const scene=new T.Scene();
  for(const i of gltf.scenes[gltf.scene??0].nodes)scene.add(nodes[i]);
  scene.updateMatrixWorld(true); return scene;
}

test('Kirchen-GLB ist vollständig eingebettet und enthält keine Vorschauobjekte', () => {
  assert.equal(file.toString('utf8',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length);
  assert.ok(gltf.images.length>=4);
  assert.ok(gltf.images.every((i)=>i.bufferView!==undefined && !i.uri));
  assert.ok(gltf.buffers.every((b)=>!b.uri));
  assert.ok(!gltf.cameras?.length);
  assert.ok(gltf.nodes.every((n)=>!n.name?.includes('Preview')));
  for(const name of ['Entrance','SanctuarySeal','BellInteract','BellMount','Bell'])assert.ok(gltf.nodes.some((n)=>n.name===name));
  for(const [key,name] of [['entrance','Entrance'],['seal','SanctuarySeal'],['bellInteract','BellInteract'],['bellMount','BellMount']]) {
    const node=gltf.nodes.find((n)=>n.name===name);
    node.translation.forEach((v,i)=>assert.ok(Math.abs(v-manifest.anchors[key][i])<1e-5));
  }
  for(const door of manifest.doors) {
    const node=gltf.nodes.find((n)=>n.name===door.node);
    assert.ok(node);
    assert.ok(Math.abs(2*Math.atan2(node.rotation[1],node.rotation[3])-door.openAngle)<1e-5);
  }
});

test('Tatsächliche Modellgeometrie lässt den Eingang und Mittelgang frei', () => {
  const scene=geometryScene();
  for(const x of [-0.4,0,0.4])for(const y of [0.3,0.9,1.65]) {
    const ray=new T.Raycaster(new T.Vector3(x,y,2.5),new T.Vector3(0,0,-1),0,28.4);
    const hits=ray.intersectObjects(scene.children,true);
    assert.equal(hits.length,0,`Durchgang blockiert bei x=${x}, y=${y}: ${hits.map((h)=>h.object.parent.name)}`);
  }
  const bounds=new T.Box3().setFromObject(scene);
  for(const axis of ['x','y','z']) {
    assert.ok(bounds.min[axis]>=manifest.bounds[axis][0]-.002);
    assert.ok(bounds.max[axis]<=manifest.bounds[axis][1]+.002);
  }
});

test('Spieladapter verbindet Vorplatz und Altar, auch bei gedrehter Platzierung', () => {
  for(const yaw of [0,Math.PI/2,-0.7]) {
    const church=createChurchSpatial(manifest,collision,{x:91,y:23,z:24.5},yaw);
    for(let z=2.5;z>=-25.6;z-=.2) {
      const p=church.toWorld([0,z>0?-z/12:0,z]);
      assert.ok(Math.abs(church.floorHeight(p.x,p.z)-p.y)<1e-6);
      assert.equal(church.collides(p,.5,1.75),false);
    }
    assert.equal(church.collides(church.toWorld([3.25,0,-13.2]),.4,1.75),true);
    assert.equal(church.floorHeight(-1000,-1000),null);
    const seal=church.toLocal(church.anchors.seal);
    assert.ok(Math.abs(seal.x)<1e-6 && Math.abs(seal.y-.4)<1e-6 && Math.abs(seal.z+25.6)<1e-6);
  }
});
