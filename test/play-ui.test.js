'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={console};vm.createContext(c);
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
vm.runInContext(read('public/entwurf/vendor/three.min.js'),c);
vm.runInContext(read('public/entwurf/play-ui.js'),c);
const ui=c.NachtjagdInterface;
test('Kompass folgt der Blickrichtung der echten Ego-Kamera: +z Süden, -z Norden',()=>{
  for(const [yaw,degrees] of [[0,180],[Math.PI,0],[Math.PI/2,90],[-Math.PI/2,270],[Math.PI*3,0]])assert.ok(Math.abs(ui.heading(yaw)-degrees)<1e-8);
});
test('Navigation überspringt gefundene Siegel und wechselt zur Glocke und zum Finale',()=>{
  const s={player:{x:0,z:0},quest:{stage:'seals',objectives:[{id:'near',x:1,z:0},{id:'far',x:100,z:0}],bell:{x:4,z:4}}};
  assert.equal(ui.targetFor(s,null).id,'near');assert.equal(ui.targetFor(s,'far').id,'far');
  s.quest.objectives[0].found=true;assert.equal(ui.targetFor(s,'near').id,'far');
  s.quest.stage='bell';assert.equal(ui.targetFor(s,'far').id,'bell');
  s.quest.stage='final';assert.equal(ui.targetFor(s,null),null);
});
test('Drei Waffen vor der Kamera, Wechsel, Rückstoß und Nachladen ohne Zustandsänderung',()=>{
  const view=ui.weapon(c.THREE),s={current:0,weapons:[{reloading:0,reload:2.1},{reloading:0,reload:2.7},{reloading:0,reload:2.9}]};
  for(let i=0;i<3;i++){
    s.current=i;const before=JSON.stringify(s);view.update(s,.016,false,0);
    const models=view.group.children.filter(o=>o.isGroup);assert.equal(models.filter(o=>o.visible).length,1);assert.equal(models[i].visible,true);
    view.group.updateMatrixWorld(true);const bounds=new c.THREE.Box3().setFromObject(models[i]);assert.ok(bounds.max.z<0,'Waffe bleibt vor der Kamera');assert.ok(bounds.min.z>-1.6,'Waffe bleibt im Nahbereich');
    view.kick();view.update(s,.016,false,0);assert.ok(view.group.position.z>-.38);
    s.weapons[i].reloading=s.weapons[i].reload/2;view.update(s,1,false,0);assert.ok(view.group.rotation.x>.5);s.weapons[i].reloading=0;
    assert.equal(JSON.stringify(s),before);
  }
});

test('Menüüberflug bleibt innerhalb der Bergwelt, über dem Boden und bewegt sich stetig',()=>{
  const floor=(x,z)=>40+20*Math.sin(x/20)*Math.cos(z/40);
  let previous=null;
  for(let t=0;t<=180;t+=1){const shot=ui.flyover(t,floor),[x,y,z]=shot.position;assert.ok(Math.abs(x)<300&&Math.abs(z)<300);assert.ok(y-floor(x,z)>=40);assert.ok(y>shot.target[1]);if(previous)assert.ok(Math.hypot(...shot.position.map((v,i)=>v-previous[i]))<12);previous=shot.position;}
});
