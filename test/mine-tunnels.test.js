'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

const context={Math}; context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('../public/entwurf/mine-tunnels.js',import.meta.url),'utf8'),context);
const api=context.NachtjagdMines;
const mines=[{id:'mine-west',a:[-340,-15],b:[-355,-35],width:7},{id:'mine-north',a:[-55,-185],b:[-65,-215],width:7}];

function setup(withScene=false) {
  const scene=withScene?new THREE.Scene():null;
  const world=api.create({THREE:withScene?THREE:null,scene,mines,heightAt:()=>72});
  return {world,scene};
}
test('Die offene Mündung blockiert weder die Zufahrtsstraße noch entfernt sie Gelände vor dem Portal',()=>{
  const {world}=setup();
  for(const mine of mines) {
    const [x,z]=mine.a,dx=mine.b[0]-x,dz=mine.b[1]-z,len=Math.hypot(dx,dz);
    for(const distance of [.15,1,3,5]) {
      const px=x-dx/len*distance,pz=z-dz/len*distance;
      assert.equal(world.blocked(px,pz,72.4),false);
      assert.equal(world.floor(px,pz,72.4),null);
      assert.equal(world.cutTerrain(px,pz),false);
    }
    for(const [px,pz] of mine.id==='mine-west'?[[-337.1875,-14.0625]]:[[-52.9545455,-182.9545455]])assert.equal(world.blocked(px,pz,72.4),false);
  }
});

test('jeder Eingang führt über zusammenhängende Rampen in Hauptgang und zwei Kammern',()=>{
  const {world}=setup();
  assert.equal(world.routes.length,6);
  for(const mine of mines) {
    const route=world.routes.find(r=>r.id===mine.id);
    assert.ok(route);
    assert.deepEqual([route.points[0].x,route.points[0].z],mine.a);
    assert.deepEqual([route.points[1].x,route.points[1].z],mine.b);
    assert.ok(Math.abs(route.points[0].y-(72.4))<1e-9);
    for(let i=1;i<route.points.length;i++) {
      const a=route.points[i-1],b=route.points[i],horizontal=Math.hypot(b.x-a.x,b.z-a.z);
      assert.ok(Math.abs(b.y-a.y)/horizontal<=.18+1e-9);
      const ux=(mine.b[0]-mine.a[0])/Math.hypot(mine.b[0]-mine.a[0],mine.b[1]-mine.a[1]);
      const uz=(mine.b[1]-mine.a[1])/Math.hypot(mine.b[0]-mine.a[0],mine.b[1]-mine.a[1]);
      assert.ok(Math.abs((b.x-a.x)*uz-(b.z-a.z)*ux)<1e-8,'Hauptgang folgt gerade der vorhandenen Achse');
    }
    // Hin- und Rückweg prüfen Hauptgang und Abzweige bis kurz vor die Endkappen.
    const walkRoutes=world.routes.filter(r=>r.id===mine.id||r.id.startsWith(mine.id+'-abzweig-'));
    for(const path of walkRoutes) {
      const end=path.points[path.points.length-1],before=path.points[path.points.length-2];
      const ex=(end.x-before.x)/Math.hypot(end.x-before.x,end.z-before.z),ez=(end.z-before.z)/Math.hypot(end.x-before.x,end.z-before.z);
      const walk=[...path.points.slice(0,-1),{x:end.x-ex*1.2,z:end.z-ez*1.2,y:end.y+(before.y-end.y)*(1.2/Math.hypot(end.x-before.x,end.z-before.z))}];
      for(const point of [...walk,...walk.slice().reverse()]) {
        assert.ok(Math.abs(world.floor(point.x,point.z,point.y)-point.y)<.12);
        assert.equal(world.blocked(point.x,point.z,point.y+.2,.4),false);
      }
      assert.equal(world.blocked(end.x,end.z,end.y+.2,.4),true,'Tunnelende hat eine geschlossene Kappe');
    }
    assert.equal(world.floor(mine.a[0]+100,mine.a[1],72.4),null);
    assert.equal(world.entrance(mine.id).y,72.4);
    assert.equal(world.seal(mine.id).mine,mine.id);
    assert.ok(world.cutTerrain(...mine.a));
    const ux=(mine.b[0]-mine.a[0])/Math.hypot(mine.b[0]-mine.a[0],mine.b[1]-mine.a[1]);
    const uz=(mine.b[1]-mine.a[1])/Math.hypot(mine.b[0]-mine.a[0],mine.b[1]-mine.a[1]);
    assert.equal(world.cutTerrain(mine.a[0]+ux*45,mine.a[1]+uz*45),false,'tiefer Hauptgang bleibt unter dem Terrain geschlossen');
  }
  for(const mine of mines) {
    const branches=world.routes.filter(r=>r.id.startsWith(mine.id+'-abzweig-'));
    assert.equal(branches.length,2);
    assert.ok(branches.every(r=>r.type==='chamber'&&r.points.length===3));
  }
});

test('Wände und Decke begrenzen die Gehfläche; Innenraum ist klar erkennbar',()=>{
  const {world}=setup();
  const p=world.routes[0].points[2],route=world.routes[0],a=route.points[1],b=route.points[2];
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  const wallX=x-dz/len*(route.width/2-.2),wallZ=z+dx/len*(route.width/2-.2),y=(a.y+b.y)/2;
  assert.notEqual(world.floor(wallX,wallZ,y),null);
  assert.equal(world.blocked(wallX,wallZ,y+.2,.4),true);
  assert.equal(world.blocked(x,z,y+1.6,.4),true);
  assert.equal(world.blocked(x,z,y+5,.4),false,'Kollision blockiert keine Person oberhalb der Tunneldecke');
  assert.equal(world.floor(x,z,y+6),null,'Gehflächen gelten nur in Tunnelhöhe');
  assert.equal(world.indoor(x,y+1.5,z),true);
  assert.equal(world.indoor(x,y+4,z),false);
});

test('optionale Three-Geometrie baut geschlossene Gänge, Träger und sparsame Lampen',()=>{
  const {world,scene}=setup(true);
  assert.ok(world.root && world.root.children.length>0);
  assert.equal(world.root.parent,scene);
  assert.equal(world.targets.length,2);
  const lights=world.root.children.filter(child=>child.isPointLight);
  assert.equal(lights.length,2,'höchstens zwei echte Lichter werden geteilt');
  assert.ok(world.root.children.filter(child=>child.isInstancedMesh).length<=5);
  assert.ok(world.root.children.filter(child=>child.isInstancedMesh).every(child=>child.material.isMeshLambertMaterial));
  world.update(0,0,0);
  assert.equal(lights.filter(light=>light.visible).length,0,'ferne Tunnellampen belasten Außenansichten nicht');
  const entry=world.entrance('mine-west');
  world.update(entry.x,entry.y+1.75,entry.z);
  assert.ok(lights.some(light=>light.visible),'am Eingang wird Licht aus dem gemeinsamen Pool aktiv');
  world.update();
  assert.equal(lights.filter(light=>light.visible).length,0);

  scene.updateMatrixWorld(true);
  const raycaster=new THREE.Raycaster();
  for(const branch of world.routes.filter(route=>route.type==='chamber')) {
    const start=branch.points[0],elbow=branch.points[1],dx=elbow.x-start.x,dz=elbow.z-start.z,length=Math.hypot(dx,dz);
    raycaster.set(new THREE.Vector3(start.x,start.y+1.4,start.z),new THREE.Vector3(dx/length,0,dz/length));
    raycaster.far=3;
    assert.equal(raycaster.intersectObject(world.root,true).length,0,'Kammeranschluss besitzt eine echte Wandöffnung');
  }
  for(const path of world.routes) {
    const end=path.points.at(-1),before=path.points.at(-2),dx=end.x-before.x,dz=end.z-before.z,length=Math.hypot(dx,dz);
    raycaster.set(new THREE.Vector3(end.x-dx/length*2,end.y+1.5,end.z-dz/length*2),new THREE.Vector3(dx/length,0,dz/length));
    raycaster.far=2.3;
    assert.ok(raycaster.intersectObject(world.root,true).length>0,'Tunnelende besitzt eine echte Endwand');
  }
});
