'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

const ctx={};vm.createContext(ctx);
for(const file of ['world-layout.js','village-wall.js'])vm.runInContext(fs.readFileSync(new URL('../public/entwurf/'+file,import.meta.url),'utf8'),ctx);
const layout=ctx.NachtjagdLayout;

test('Dorfmauer liefert vier innenliegende Treppen mit maximal 20 cm Steigung und vollständig begehbaren Stufen',()=>{
  const wall=ctx.NachtjagdVillageWall.create({walls:layout.villageWalls,heightAt:layout.naturalHeight,village:layout.village,houses:layout.houses});
  assert.equal(wall.stairs.length,4);
  for(const stair of wall.stairs) {
    assert.ok(stair.run>=10.99&&stair.run<=16.01);
    assert.ok(stair.rise>0);
    assert.ok(stair.count>=24,'mindestens 24 gleichmäßig verteilte Tritte');
    assert.equal(stair.count,stair.treads.length);
    const deck=wall.decks.find(d=>d.id===stair.wallId);
    const t=((stair.end.x-deck.a.x)*deck.cos+(stair.end.z-deck.a.z)*deck.sin)/deck.length;
    assert.ok(Math.abs(stair.y1-(deck.yA+(deck.yB-deck.yA)*t))<1e-6,'Treppenende folgt dem tatsächlichen Wehrgang auch über unebenem Gelände');
    assert.notEqual(wall.floor(stair.end.x+stair.cos*.2,stair.end.z+stair.sin*.2,stair.y1),null,'Oberer Anschluss bleibt eine Gehfläche');
    for(const tread of stair.treads)assert.ok(tread.top-tread.previous<=.200001);
    for(const tread of stair.treads) {
      assert.ok(Math.abs(wall.floor(tread.x,tread.z,tread.top)-tread.top)<1e-6,'Aufstieg: jede Stufe ist eine Gehfläche');
      assert.equal(wall.blocked(tread.x,tread.z,tread.top),false,'Aufstieg: Kollision lässt die Stufe frei');
    }
    for(const tread of [...stair.treads].reverse()) {
      assert.ok(Math.abs(wall.floor(tread.x,tread.z,tread.top)-tread.top)<1e-6,'Abstieg: jede Stufe bleibt begehbar');
      assert.equal(wall.blocked(tread.x,tread.z,tread.top),false,'Abstieg: Kollision lässt die Stufe frei');
    }
  }
});

test('Mauerfuß blockiert, Deck ist nur von oben begehbar und die drei Torlücken bleiben offen',()=>{
  const wall=ctx.NachtjagdVillageWall.create({walls:layout.villageWalls,heightAt:layout.naturalHeight,village:layout.village});
  const deck=wall.decks[0],x=(deck.a.x+deck.b.x)/2,z=(deck.a.z+deck.b.z)/2,top=(deck.yA+deck.yB)/2,ground=layout.naturalHeight(x,z);
  assert.equal(wall.floor(x,z,ground+1),null,'unterhalb des Decks gibt es keine Gehfläche');
  assert.equal(wall.blocked(x,z,ground+1),true,'der Mauerfuß blockiert');
  assert.ok(Math.abs(wall.floor(x,z,top)-top)<.05);
  assert.equal(wall.blocked(x,z,top),false,'auf dem Deck ist der Weg frei');
  for(const [gx,gz] of layout.villageGates)assert.equal(wall.floor(gx,gz,1000),null,'Toröffnung wird nicht überspannt');
});

test('Mauer wird nach Geländeanpassung neu berechnet und bleibt in wenigen Instanznetzen',()=>{
  const scene=new THREE.Scene();let offset=0;
  const wall=ctx.NachtjagdVillageWall.create({THREE,scene,walls:layout.villageWalls,heightAt:(x,z)=>layout.naturalHeight(x,z)+offset,village:layout.village});
  assert.ok(wall.targets().length<=8);
  const before=wall.decks[0].yA;offset=3;wall.refresh();
  assert.equal(wall.decks[0].yA,before+3);
  assert.ok(wall.targets().every(mesh=>mesh.isInstancedMesh));
  assert.ok(scene.children.filter(mesh=>mesh.name==='VillageWall').length<=8);
  const deck=wall.decks[0],mx=(deck.a.x+deck.b.x)/2,mz=(deck.a.z+deck.b.z)/2,top=(deck.yA+deck.yB)/2,nx=-deck.sin,nz=deck.cos;
  assert.equal(wall.blocked(mx+nx*1.4,mz+nz*1.4,top+.5),true,'innere und äußere Brüstung blockieren auf Deckhöhe');
  assert.equal(wall.blocked(mx,mz,top+2),false,'oberhalb der Brüstung ist der Weg frei');
  assert.equal(wall.blocked(deck.a.x,deck.a.z,deck.yA+.5),true,'Endgeländer blockiert auf Deckhöhe');

  const stair=wall.stairs[0],stairDeck=wall.decks.find(d=>d.id===stair.wallId),tangentX=stairDeck.cos,tangentZ=stairDeck.sin;
  const y=stair.y1+.5,inwardX=(stair.start.x-stair.end.x)/stair.run,inwardZ=(stair.start.z-stair.end.z)/stair.run;
  const raycaster=new THREE.Raycaster(),targets=wall.targets();scene.updateMatrixWorld(true);
  raycaster.set(new THREE.Vector3(stair.end.x+inwardX*2.2,y,stair.end.z+inwardZ*2.2),new THREE.Vector3(-inwardX,0,-inwardZ));raycaster.far=4.5;
  assert.equal(raycaster.intersectObjects(targets,false).length,0,'Treppenportal ist auch in der echten Geometrie offen');
  const offsetAlong=(1.55+.4)/2+.3;
  raycaster.set(new THREE.Vector3(stair.end.x+tangentX*offsetAlong+inwardX*2.2,y,stair.end.z+tangentZ*offsetAlong+inwardZ*2.2),new THREE.Vector3(-inwardX,0,-inwardZ));raycaster.far=4.5;
  assert.ok(raycaster.intersectObjects(targets,false).length>0,'neben dem Portal bleibt die Brüstung als Geometrie stehen');
  for(const a of wall.decks)for(const b of wall.decks)if(a!==b) {
    if(Math.hypot(a.b.x-b.a.x,a.b.z-b.a.z)<.001)assert.ok(Math.abs(wall.floor(a.b.x,a.b.z,Math.max(a.yB,b.yA))-a.yB)<1e-6,'angrenzende Decks treffen am Knoten');
  }
});
