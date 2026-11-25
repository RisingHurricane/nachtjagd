'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/entwurf/stairs.js',import.meta.url),'utf8'),context);
const create=context.NachtjagdStairs.create;
test('Treppen sind in beiden Richtungen lückenlos begehbar und begrenzen die Stufenhöhe',()=>{
  for(const [y0,y1] of [[10,14],[14,10]]) {
    const stairs=create({nodes:[{x:0,z:0,y:y0},{x:0,z:20,y:y1}],segments:[{a:0,b:1,width:3,stairs:true}]});
    let previous=stairs.floor(0,0);
    for(let z=0;z<=20;z+=.1) {
      const floor=stairs.floor(0,z);
      assert.notEqual(floor,null);
      assert.ok(Math.abs(floor-previous)<=.200001);
      assert.equal(stairs.floor(-1,z),stairs.floor(1,z));
      previous=floor;
    }
    assert.equal(stairs.floor(2,10),null);
  }
});

test('Das neue Dorf kommt ohne Treppen aus: Straßen folgen dem flachen Dorfgelände',()=>{
  for(const file of ['world-layout','road-layout']) vm.runInContext(fs.readFileSync(new URL('../public/entwurf/'+file+'.js',import.meta.url),'utf8'),context);
  const layout=context.NachtjagdLayout,definition=context.NachtjagdRoadLayout({height:layout.naturalHeight,castle:layout.castle});
  assert.equal(definition.routes.filter(r=>r.stairs).length,0);
});
