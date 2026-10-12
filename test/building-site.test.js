'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
const ctx={Math};ctx.globalThis=ctx;
for(const file of ['world-layout.js','village-houses.js','building-site.js'])vm.runInNewContext(fs.readFileSync(new URL('../public/entwurf/'+file,import.meta.url),'utf8'),ctx);
const specs=ctx.NachtjagdBuildings.describe(ctx.NachtjagdLayout.houses),builder=ctx.NachtjagdVillageHouses.create(THREE);

test('Alle 28 Weltplatzierungen teilen Türen, Mauern und gedrehte Gehflächen mit dem Hausmodell',()=>{
  assert.equal(specs.length,28);
  for(const spec of specs) {
    spec.y=60;
    const model=builder.build(spec.w,spec.d,spec.height,spec.type),data=model.userData.house,walk=ctx.NachtjagdBuildings.spatial(spec,data);
    for(const e of data.entries) {
      const p=spec.toWorld(e.inside.x,e.inside.z);
      assert.ok(Math.abs(walk.floor(p.x,p.z,0)-60.3)<1e-6,'Erdgeschoss auch bei erstmaligem Spawn richtig wählen');
      assert.equal(walk.blocked(p.x,p.z,60.3),false);
      assert.equal(walk.indoor(p.x,60.3,p.z),1);
      const q=spec.toLocal(p.x,p.z);assert.ok(Math.hypot(q.x-e.inside.x,q.z-e.inside.z)<1e-8);
    }
    const wall=spec.toWorld(data.plan.volumes[0].x0,(data.plan.volumes[0].z0+data.plan.volumes[0].z1)/2);
    assert.equal(walk.blocked(wall.x,wall.z,60.3),true);
    assert.equal(walk.floor(-1000,-1000,0),null);
  }
});

test('Zusammengefasste Modelle behalten UVs, Farben und Welttransformation; Originalgeometrien bleiben nutzbar',()=>{
  const source=new THREE.Group(),material=new THREE.MeshLambertMaterial(),g=new THREE.BoxGeometry(1,1,1);
  const mesh=new THREE.Mesh(g,material);mesh.position.set(4,3,2);source.add(mesh);
  const output=new THREE.Group();ctx.NachtjagdBuildings.merge(THREE,[source],output);
  assert.equal(output.children.length,1);
  const baked=output.children[0].geometry;baked.computeBoundingBox();
  assert.equal(baked.boundingBox.min.x,3.5);assert.equal(baked.attributes.uv.count,baked.attributes.position.count);
  assert.equal(g.attributes.position.count,24);
  mesh.position.x=9;ctx.NachtjagdBuildings.merge(THREE,[source],output);output.children[0].geometry.computeBoundingBox();
  assert.equal(output.children[0].geometry.boundingBox.min.x,8.5);assert.equal(output.children.length,1);
});
