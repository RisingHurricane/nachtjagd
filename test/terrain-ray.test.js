import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
const context={};vm.runInNewContext(fs.readFileSync(new URL('../public/entwurf/terrain-ray.js',import.meta.url),'utf8'),context);
test('Raster-Schussabfrage entspricht echten Landschaftsdreiecken einschließlich senkrechter und flacher Strahlen',()=>{
  const size=100,cols=21,rows=21,step=5,height=(x,z)=>Math.sin(x*.4)*4+Math.cos(z*.3)*5;
  const g=new THREE.PlaneGeometry(size,size,cols-1,rows-1);g.rotateX(-Math.PI/2);g.translate(50,0,50);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,height(Math.round(p.getX(i)/step),Math.round(p.getZ(i)/step)));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial()),raycaster=new THREE.Raycaster();mesh.updateMatrixWorld(true);
  const accelerated=context.NachtjagdTerrainRay.create({THREE,heightAtGrid:height,cols,rows,step,x0:0,z0:0});
  for(let i=0;i<90;i++) {
    const origin=new THREE.Vector3(3+(i*17)%94,12+(i%8),3+(i*23)%94),direction=new THREE.Vector3(Math.sin(i),i%3===0?-1:-.2,Math.cos(i)).normalize();
    if(i%10===0)direction.set(0,-1,0);
    raycaster.set(origin,direction);raycaster.near=.05;raycaster.far=150;
    const actual=raycaster.intersectObject(mesh)[0]?.distance??150,fast=accelerated.distance(origin,direction,150);
    assert.ok(Math.abs(actual-fast)<1e-4,`Strahl ${i}: ${actual} / ${fast}`);
  }
});
test('Minenöffnung lässt Strahlen hindurch; unterirdische Decke bleibt separate Geometrie',()=>{
  const accelerated=context.NachtjagdTerrainRay.create({THREE,heightAtGrid:()=>10,cols:21,rows:21,step:5,x0:0,z0:0,cutTerrain:(x,z)=>Math.hypot(x-50,z-50)<3});
  assert.equal(accelerated.distance({x:50,y:15,z:50},{x:0,y:-1,z:0},20),20);
  assert.equal(accelerated.distance({x:60,y:15,z:50},{x:0,y:-1,z:0},20),5);
});
