'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/entwurf/world-layout.js', import.meta.url), 'utf8'), context);
const layout = context.NachtjagdLayout;
test('Seehäuser bilden eine enge Landgruppe; die kleine Insel bleibt ringsum im Wasser',()=>{
  for(const [x,z,w,d] of layout.lakeHomes) {
    for(const [a,b] of layout.lakeHomes) assert.ok(Math.hypot(x-a,z-b)<60);
    for(const dx of [-w/2,w/2]) for(const dz of [-d/2,d/2]) assert.ok(layout.naturalHeight(x+dx,z+dz)>.35);
  }
  const {x,z,trees}=layout.island;
  assert.equal(trees.length,3);
  assert.ok(layout.lakeDistance(x,z)<-40 && layout.naturalHeight(x,z)>4);
  for(const [dx,dz] of trees) assert.ok(layout.naturalHeight(x+dx,z+dz)>3);
  for(const [dx,dz] of [[-30,0],[30,0],[0,-25],[0,25]]) assert.ok(layout.naturalHeight(x+dx,z+dz)<-.5);
});
test('Skizzenanordnung: See südwestlich, Burg westlich, Gebirge nördlich des Dorfs', () => {
  assert.ok(layout.lakeDistance(-210,220) < 0);
  assert.ok(layout.lakeDistance(layout.village.x,layout.village.z) > 0);
  assert.ok(layout.castle.x < layout.village.x && layout.castle.z < layout.village.z);
  assert.ok(layout.naturalHeight(-40,-550) > 230);
  assert.ok(layout.naturalHeight(90,45) < layout.castle.height);
});
test('Dorfgrund besitzt Gefälle und mehr als eine Gebäudeform', () => {
  const heights = layout.houses.map(h => layout.naturalHeight(h[0],h[1]));
  assert.ok(layout.houses.length >= 28);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 8);
  assert.equal(new Set(layout.houses.map(h => h[6])).size, 4);
});
test('Burg steht auf einem freien Sporn mit niedrigerem Gelände auf drei Seiten', () => {
  const { x,z } = layout.castle, top = layout.naturalHeight(x,z);
  for (const [dx,dz] of [[-85,0],[0,-85],[0,85]]) assert.ok(top - layout.naturalHeight(x+dx,z+dz) > 40);
  assert.ok(layout.naturalHeight(x+90,z+20) > layout.naturalHeight(x+90,z+65));
});
test('Wald bildet nördliche, östliche und südliche Bänder; See bleibt getrennt', () => {
  for (const [x,z] of [[-100,-150],[210,-35],[250,90],[140,180]]) assert.ok(layout.forestWeight(x,z) > .8);
  assert.ok(layout.forestWeight(-300,220) < .01);
  assert.ok(layout.naturalHeight(-210,220) < -6);
  assert.ok(Math.abs(layout.lakeDistance(...layout.lake[0])) < .001);
});
test('Berge umschließen die Hochebene auch im Westen, Osten und Süden', () => {
  for (const [x,z] of [[-660,0],[580,0],[-40,550]]) assert.ok(layout.naturalHeight(x,z) > 175);
});
test('Der Ufersaum steigt auf den ersten dreißig Metern nur sanft an', () => {
  for (const z of [350,360,370]) {
    const distance = layout.lakeDistance(-210,z), height = layout.naturalHeight(-210,z);
    assert.ok(distance > 0 && distance < 30);
    assert.ok(height >= 0 && height < 2.1);
  }
});
test('Die Hochebene zwischen den Bergen besitzt eigenes Hügelrelief', () => {
  const heights = [[-70,10],[180,120],[-230,-20],[40,160]].map(p => layout.naturalHeight(...p));
  assert.ok(Math.max(...heights)-Math.min(...heights) > 35);
});

test('Der See reicht weiter nach Südwesten; Waldinseln liegen außerhalb der großen Bänder', () => {
  for(const p of [[-390,280],[-300,325]]) assert.ok(layout.lakeDistance(...p)<0);
  assert.ok(layout.treeGroups.length>=8);
  for(const p of [[-345,-170],[15,-65],[300,-135],[320,20]]) {
    assert.ok(layout.forestWeight(...p)<.1);
    assert.ok(layout.treeWeight(...p)>=.8);
  }
});

test('Mittelberge stehen vor einem höheren äußeren Gipfelring; Vorberge füllen die Dorfsenke',()=>{
  assert.ok(layout.naturalHeight(-50,-329)>110 && layout.naturalHeight(-50,-329)<220);
  assert.ok(Math.max(...layout.highPeaks.map(p=>layout.naturalHeight(p.x,p.z)))>layout.naturalHeight(-50,-329)+150);
  const heights=[[110,-100],[180,-150],[60,-190]].map(p=>layout.naturalHeight(...p));
  assert.ok(Math.min(...heights)>38);
  assert.ok(Math.max(...heights)-Math.min(...heights)>12);
  assert.ok(new Set(layout.houses.map(h=>h[1])).size>15);
});

test('Beide Bergtypen besitzen unterschiedliche Gipfelhöhen und breite sowie schmale Fußabdrücke',()=>{
  for(const peaks of [layout.middlePeaks,layout.highPeaks]) {
    const heights=peaks.map(p=>layout.naturalHeight(p.x,p.z));
    assert.ok(Math.max(...heights)-Math.min(...heights)>70);
    assert.ok(Math.max(...peaks.map(p=>p.rx))-Math.min(...peaks.map(p=>p.rx))>40);
    assert.ok(Math.max(...peaks.map(p=>p.rz))-Math.min(...peaks.map(p=>p.rz))>30);
  }
  assert.ok(layout.foothillGroups.filter(([x,z])=>layout.naturalHeight(x,z)<110).length>=5);
});


test('Die Dorfmauer folgt einer unregelmäßigen Kontur und lässt alle drei Tore offen',()=>{
  for(const [x,z,w,d,rotation] of layout.houses) {
    for(const a of [-w/2,w/2]) for(const b of [-d/2,d/2]) {
      assert.ok(layout.villageDistance(x+Math.cos(rotation)*a+Math.sin(rotation)*b,z-Math.sin(rotation)*a+Math.cos(rotation)*b)<-2);
    }
  }
  const diagonal=layout.villageWalls.filter(([a,b])=>Math.abs(a[0]-b[0])>1 && Math.abs(a[1]-b[1])>1);
  assert.ok(diagonal.length>layout.villageWalls.length/2);
  for(const [x,z] of layout.villageGates) {
    assert.ok(Math.abs(layout.villageDistance(x,z))<.001);
    assert.ok(layout.villageWalls.every(([a,b])=>layout.segmentDistance(x,z,a,b)>=6));
  }
});

test('Tiefe Spalten zwischen den Bergreihen werden zu unebenen Sätteln',()=>{
  const heights=[[0,-440],[20,-420],[-270,-405],[125,-395]].map(p=>layout.naturalHeight(...p));
  assert.ok(Math.min(...heights)>90);
  assert.ok(Math.max(...heights)-Math.min(...heights)>30);
  assert.ok(layout.naturalHeight(-165,-130)<40);
});

test('Wenige Lichtungen öffnen den Hauptwald; Baumgruppen reichen in die Bergrücken',()=>{
  for(const [x,z] of layout.clearings) {
    assert.equal(layout.treeWeight(x,z),0);
    assert.equal(layout.forestWeight(x,z),0);
  }
  assert.ok(layout.forestWeight(-100,-150)>.8);
  for(const [x,z] of layout.ridgeGroups) {
    assert.ok(layout.naturalHeight(x,z)>75);
    assert.ok(layout.treeWeight(x,z)>=.8);
  }
});
