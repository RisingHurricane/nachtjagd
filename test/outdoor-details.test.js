'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={}; vm.createContext(c);
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
vm.runInContext(read('public/entwurf/vendor/three.min.js'),c);
vm.runInContext(read('public/entwurf/world-layout.js'),c);
vm.runInContext(read('public/entwurf/road-layout.js'),c);
vm.runInContext(read('public/entwurf/outdoor-details.js'),c);

test('Laternen teilen drei schattenlose Lichter; Geländeänderung und Innenraum werden berücksichtigt',()=>{
  const T=c.THREE,scene=new T.Scene(),layout=c.NachtjagdLayout;
  const routes=c.NachtjagdRoadLayout({height:()=>4,castle:layout.castle}).routes;
  let y=4; const solids=[];
  const insideChurch=(x,z)=>x>77&&x<105&&z>-9&&z<28;
  const out=c.NachtjagdOutdoor.create({THREE:T,scene,layout,routes,height:()=>y,clearance:()=>2,occupied:insideChurch,box:(...args)=>solids.push(args),label:()=>{}});
  assert.ok(out.lamps.length>=12); assert.equal(out.pool.length,3);
  assert.ok(out.lamps.every(l=>!insideChurch(l.x,l.z)),'Keine Straßenlaternen im Kirchenschiff oder Portal');
  const lamp=out.lamps[0],camera={position:{x:lamp.x,y:6,z:lamp.z}};
  out.update(camera,1,0); assert.ok(out.pool[0].intensity>0);
  assert.ok(out.pool.every(l=>!l.castShadow));
  out.update(camera,1,1); assert.ok(out.pool.every(l=>l.intensity===0));
  out.update({position:{x:5000,z:5000}},1,0); assert.ok(out.pool.every(l=>l.intensity===0));
  y=13; out.refresh(); assert.equal(lamp.y,17.2);
  assert.equal(solids.filter(a=>a[2]===.48&&a[3]===.48).length,4,'Vier feste Turmstützen');
  assert.ok(scene.children.filter(o=>o.isInstancedMesh).length<=5,'Laternen werden gebündelt gezeichnet');
});
