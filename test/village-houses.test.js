'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import vm from 'node:vm';

const context={Math};context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('../public/entwurf/village-houses.js',import.meta.url),'utf8'),context);
const api=context.NachtjagdVillageHouses,builder=api.create(THREE);
const dimensions=[[8,9,7],[7.5,13,7],[7,9,8],[10,11,8]];
const houses=dimensions.map((size,type)=>builder.build(...size,type));

function path(walk,start,points) {
  let p={...start};
  for(const [x,z] of points) {
    p=walk.move(p,x-p.x,z-p.z);
    assert.ok(Math.hypot(p.x-x,p.z-z)<.09,`Weg blockiert: ${JSON.stringify(p)} statt ${x},${z}`);
  }
  return p;
}

for(const [type,model] of houses.entries()) {
  const house=model.userData.house,walk=house.walk,main=house.plan.volumes[0],stairs=house.plan.stairs;
  test(`${model.name}: beide Außenzugänge sind frei, Mauer daneben und Möbel sind fest`,()=>{
    assert.equal(house.entries.length,2);
    for(const entry of house.entries) {
      const end=path(walk,entry.outside,[[entry.inside.x,entry.inside.z]]);
      assert.ok(Math.abs(end.y-api.BASE)<.01);
      path(walk,end,[[entry.outside.x,entry.outside.z]]);
    }
    assert.equal(walk.blocked(main.x0,(main.z0+main.z1)/2,api.BASE),true);
    assert.equal(walk.blocked(main.x0+.95,main.z0+1.6,api.BASE),true,'Schrank ist fest');
  });
  test(`${model.name}: Treppe hinauf und hinunter, alle Geschosse mit Kopffreiheit`,()=>{
    assert.equal(walk.blocked(stairs.x0,(stairs.z0+stairs.z1)/2,api.BASE+api.STOREY),true,'Geländer schützt das Treppenloch');
    let p={x:stairs.returnFlight?(stairs.x0+(stairs.x0+stairs.x1)/2)/2:(stairs.x0+stairs.x1)/2,y:api.BASE,z:stairs.z1+.45};
    assert.equal(walk.blocked(p.x,p.z,p.y),false,'Treppenantritt');
    const route=[];
    for(let level=0;level<stairs.flights;level++) {
      if(stairs.returnFlight) {
        const mid=(stairs.x0+stairs.x1)/2,laneA=(stairs.x0+mid)/2,laneB=(stairs.x1+mid)/2;
        route.push([laneA,stairs.z1+.45],[laneA,stairs.z0+.4],[laneB,stairs.z0+.4],[laneB,stairs.z1+.45]);
      } else route.push([p.x,stairs.z0-.4]);
      p=path(walk,p,route.splice(0));
      assert.ok(Math.abs(p.y-(api.BASE+(level+1)*api.STOREY))<.01,`Geschoss ${level+1}: ${p.y}`);
    }
    for(let level=stairs.flights-1;level>=0;level--) {
      if(stairs.returnFlight) {
        const mid=(stairs.x0+stairs.x1)/2,laneA=(stairs.x0+mid)/2,laneB=(stairs.x1+mid)/2;
        p=path(walk,p,[[laneB,stairs.z1+.45],[laneB,stairs.z0+.4],[laneA,stairs.z0+.4],[laneA,stairs.z1+.45]]);
      } else p=path(walk,p,[[p.x,stairs.z1+.45]]);
      assert.ok(Math.abs(p.y-(api.BASE+level*api.STOREY))<.01,`Abstieg ${level}: ${p.y}`);
    }
  });
  test(`${model.name}: Geschossansicht öffnet die Hülle, Außenansicht stellt sie wieder her`,()=>{
    const count=()=>{let n=0;model.traverseVisible(o=>{if(o.isMesh)n++;});return n;};
    const outside=count();house.setView('ground');assert.ok(count()<outside);house.setView('outside');assert.equal(count(),outside);
    assert.ok(Number.isFinite(new THREE.Box3().setFromObject(model).max.y));
  });
  test(`${model.name}: vom Haupteingang sind alle Räume und Geschosse erreichbar`,()=>{
    const start=house.entries[0].outside,spacing=.25,queue=[{...start}],seen=new Set();
    const rooms=new Set(),targets=new Set(house.rooms.map(r=>`${r.id}:${r.level}`));
    const bounds={x0:Math.min(...house.plan.volumes.map(v=>v.x0))-1.6,x1:Math.max(...house.plan.volumes.map(v=>v.x1))+1.6,z0:Math.min(...house.plan.volumes.map(v=>v.z0))-1.6,z1:Math.max(...house.plan.volumes.map(v=>v.z1))+1.6};
    const key=p=>`${Math.round((p.x-start.x)/spacing)},${Math.round((p.z-start.z)/spacing)},${Math.round(p.y*1000)}`;
    seen.add(key(start));
    for(let head=0;head<queue.length&&rooms.size<targets.size;head++) {
      const p=queue[head];
      for(const r of house.rooms)if(p.x>r.x0+.2&&p.x<r.x1-.2&&p.z>r.z0+.2&&p.z<r.z1-.2&&Math.abs(p.y-r.y)<.01)rooms.add(`${r.id}:${r.level}`);
      for(const [dx,dz] of [[spacing,0],[-spacing,0],[0,spacing],[0,-spacing]]) {
        const q=walk.move(p,dx,dz);
        if(Math.hypot(q.x-p.x-dx,q.z-p.z-dz)>.001||q.x<bounds.x0||q.x>bounds.x1||q.z<bounds.z0||q.z>bounds.z1)continue;
        const k=key(q);if(!seen.has(k)){seen.add(k);queue.push(q);}
      }
    }
    assert.deepEqual([...rooms].sort(),[...targets].sort());
  });
}
