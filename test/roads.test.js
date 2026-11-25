'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['world-layout','road-layout','road-profile']) vm.runInContext(fs.readFileSync(new URL('../public/entwurf/'+file+'.js',import.meta.url),'utf8'),context);
const layout=context.NachtjagdLayout,create=context.NachtjagdRoads.create;
const definition=context.NachtjagdRoadLayout({height:layout.naturalHeight,castle:layout.castle});
const network=create({...definition,height:layout.naturalHeight});

test('Alle Straßen begrenzen ihre Längsneigung trotz Bergrelief',()=>{
  assert.equal(definition.routes.length,18);
  for(const s of network.segments) assert.ok(Math.abs(network.nodes[s.a].y-network.nodes[s.b].y)<=s.length*.180001);
  for(const anchor of definition.anchors) {
    const n=network.nodes.find(n=>Math.hypot(n.x-anchor.point[0],n.z-anchor.point[1])<.001);
    assert.ok(Math.abs(n.y-anchor.height)<.001);
  }
});

test('Kreuzungen teilen eine Höhe, auch wenn die Rohlandschaft schräg ist',()=>{
  const n=create({routes:[{id:'east',width:6,points:[[-30,0],[30,0]]},{id:'north',width:6,points:[[0,-30],[0,30]]}],height:(x,z)=>20+x*.4+z*.6});
  const crossing=n.nodes.filter(p=>p.x===0 && p.z===0);
  assert.equal(crossing.length,1);
  assert.equal(crossing[0].links.length,4);
  for(const [next] of crossing[0].links) assert.equal(n.nodes[next].y,crossing[0].y);
});

test('Eine Fahrbahn bleibt quer waagerecht und schneidet ihren Korridor ins Gelände',()=>{
  const n=create({routes:[{id:'road',width:6,points:[[-30,0],[30,0]]}],height:(x,z)=>20+x*.1+z*3});
  const s=n.segments.find(s=>n.nodes[s.a].x>=0);
  for(const z of [-3,0,3]) {
    assert.equal(n.project(s,1,z).y,n.project(s,1,0).y);
    assert.ok(n.grade(1,z,100)<=n.project(s,1,z).y+.001);
  }
  assert.equal(n.grade(1,30,100),100);
});

test('Brücke und Unterführung behalten getrennte Höhen und füllen die Senke nicht auf',()=>{
  const n=create({routes:[{id:'bridge',width:8,bridge:0,points:[[-30,0],[30,0]]},{id:'below',width:4,points:[[0,-30],[0,30]]}],height:(x,z)=>Math.abs(x)>25?50:10,anchors:[{point:[-30,0],height:50},{point:[30,0],height:50}]});
  const bridge=n.segments.find(s=>s.bridge),below=n.nodes.find(p=>p.x===0 && p.z===0);
  assert.ok(n.project(bridge,0,0).y-below.y>20);
  assert.ok(n.grade(0,0,10)<30);
});

test('Unmöglich kurze Anstiege werden abgewiesen statt eine Steilrampe zu erzeugen',()=>{
  assert.throws(()=>create({routes:[{id:'road',width:5,points:[[0,0],[10,0]]}],height:()=>0,anchors:[{point:[0,0],height:0},{point:[10,0],height:20}]}),/längere Anstiege/);
});
