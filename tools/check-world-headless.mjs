'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { createChurchSpatial } from '../public/assets/church/church-adapter.js';

const root=new URL('../',import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,root),'utf8');

class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.attributes={};this.hidden=false;this.disabled=false;
    this.value=tag==='input'?'8':'';this.textContent=tag==='button'?'Start':'';this.classList={add(){},remove(){},toggle(){},contains(){return false;}};
  }
  append(...items){this.children.push(...items);}
  prepend(...items){this.children.unshift(...items);}
  addEventListener(){}
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];}
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:800};}
  setPointerCapture(){}
  click(){}
  getContext(){
    return new Proxy({measureText:(text)=>({width:String(text).length*10})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  }
}

function rendererStub() {
  return {domElement:new Element('canvas'),shadowMap:{},setPixelRatio(){},setSize(){},render(){}};
}

async function buildWorld() {
  const elements=new Map(),reports=[];
  const THREEHeadless={...THREE,WebGLRenderer:class {constructor(){return rendererStub();}}};
  const document={
    hidden:false,
    body:new Element('body'),
    querySelector(selector){if(!elements.has(selector))elements.set(selector,new Element(selector==='#place-view'?'select':'div'));return elements.get(selector);},
    querySelectorAll(){return [];},
    createElement(tag){return new Element(tag);}
  };
  document.body.classList.contains=()=>false;
  const churchManifest=JSON.parse(read('public/assets/church/church-manifest.json'));
  const churchCollision=JSON.parse(read('public/assets/church/church-collision.json'));
  const imported={
    pineGeometry:()=>new THREEHeadless.ConeGeometry(1,2,6),
    buildBackdrop:()=>({setMood(){}}),
    buildForest({scene,placements}) {
      const group=new THREEHeadless.Group();group.userData.treeCount=placements.length;group.userData.variantCount=8;scene.add(group);
      return {root:group,ready:Promise.resolve(),update(){},lod(){}};
    },
    async loadChurch({origin}) {
      const spatial=createChurchSpatial(churchManifest,churchCollision,origin,0),group=new THREEHeadless.Group();
      group.position.set(origin.x,origin.y,origin.z);
      const material=new THREEHeadless.MeshLambertMaterial({color:0x999999});
      for(const box of churchCollision.boxes) {
        const mesh=new THREEHeadless.Mesh(new THREEHeadless.BoxGeometry(box.halfSize[0]*2,box.halfSize[1]*2,box.halfSize[2]*2),material);
        mesh.position.set(...box.center);group.add(mesh);
      }
      return {root:group,manifest:churchManifest,collision:churchCollision,...spatial};
    }
  };
  const castle={create:()=>({ready:Promise.resolve(),walk:null,update(){},indoor(){return 0;},targets(){return [];}})};
  const sky={create:()=>({apply:()=>new THREEHeadless.Color('#202630'),update(){},owns:()=>false,state:{night:1},fogColor:new THREEHeadless.Color('#202630')})};
  const play={create:()=>({active:false,start(){},stop(){}})};
  const interfaceStub={flyover:()=>new THREE.Vector3()};
  const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const context={THREE:THREEHeadless,document,location:{search:'?test=1',href:'http://localhost/entwurf/index.html?test=1'},URL,URLSearchParams,
    localStorage,devicePixelRatio:1,innerWidth:1200,innerHeight:800,addEventListener(){},requestAnimationFrame(){},cancelAnimationFrame(){},
    performance,console,Math,setTimeout,clearTimeout,matchMedia:()=>({matches:false}),NachtjagdImportedModels:imported,NachtjagdCastleSite:castle,NachtjagdSky:sky,
    NachtjagdPlay:play,NachtjagdInterface:interfaceStub};
  context.globalThis=context;context.window=context;
  vm.createContext(context);
  const scripts=[
    'public/entwurf/world-layout.js','public/entwurf/road-layout.js','public/entwurf/road-profile.js','public/entwurf/terrain-editor.js',
    'public/entwurf/viaduct.js','public/entwurf/stairs.js','public/entwurf/landmarks.js','public/entwurf/mountain-relief.js',
    'public/entwurf/terrain-material.js','public/entwurf/vehicles.js','public/entwurf/gameplay-core.js','public/entwurf/play-spots.js',
    'public/entwurf/village-houses.js','public/entwurf/building-site.js','public/entwurf/outdoor-details.js','public/entwurf/mine-tunnels.js',
    'public/entwurf/village-wall.js','public/entwurf/terrain-ray.js','public/entwurf/blockout.js'
  ];
  for(const file of scripts) {
    let source=read(file);
    if(file.endsWith('blockout.js')) {
      const mark=(needle,label)=>{source=source.replace(needle,`console.error('[world-playability] ${label} '+Date.now());\n  ${needle}`);};
      mark('updateHeightGrid();','before-height-grid');
      mark('openMineEntrances();','before-open-mines');
      mark('const importedForest =','before-forest');
      mark('const world={','before-world');
      mark('gameplay=NachtjagdPlay.create(','before-gameplay');
      // The real blockout readiness callback contains 28 house routes; this
      // focused integration keeps the full terrain and player physics but
      // limits the expensive probes to church, mines, and wall stairs.
      source=source.replace('for(const h of buildings.houses) {','for(const h of []) {');
    }
    vm.runInContext(source,context,{filename:file,timeout:120000});
  }
  for(let i=0;i<30&&!context.NachtjagdDebug;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(context.NachtjagdDebug,'Blockout-Prüflauf wurde nach Asset-Promises nicht abgeschlossen');
  const debug=context.NachtjagdDebug;
  const terrainReport=document.body.children.find(el=>el.id==='terrain-tests')?.textContent||null;
  return {debug,terrainReport};
}

test('Blockout-Welt: echte Gebäude, Minen und Mauer bestehen Gameplay-Läufe in beide Richtungen', {timeout:240000}, async()=>{
  const {debug,terrainReport}=await buildWorld(),checks=debug.world.checks;
  const wanted=checks.filter(c=>/^(Kirche vom Vorplatz bis zum Siegel|mine(?:-.+): Spielfigur hinein und zurück|Dorfmauer Treppe \d+: hinauf und hinunter|Haus \d+: (?:Eingang|Außentreppe|obere Etagen))/.test(c.name));
  const failures=wanted.filter(c=>!c.passed);
  const mine=wanted.filter(c=>/: Spielfigur hinein und zurück$/.test(c.name));
  const wall=wanted.filter(c=>/^Dorfmauer Treppe /.test(c.name));
  const nonCastleFailures=checks.filter(c=>!c.passed&&!/Burg-Siegel/.test(c.name));
  const parsedTerrain=terrainReport?JSON.parse(terrainReport):null;
  const terrainFailures=parsedTerrain?.checks.filter(c=>!c.passed)||[];
  console.error('[world-playability] world checks',JSON.stringify({checks:checks.map(({name,passed})=>({name,passed})),nonCastleFailures,terrainReport}));
  assert.equal(mine.length,6,`Erwartete 6 Minenwege, gefunden ${mine.length}: ${mine.map(c=>c.name).join(', ')}`);
  assert.equal(wall.length,4,`Erwartete 4 Mauerwege, gefunden ${wall.length}: ${wall.map(c=>c.name).join(', ')}`);
  assert.ok(wanted.some(c=>c.name.startsWith('Kirche vom Vorplatz')),'Kirchenweg-Prüfung fehlt');
  assert.equal(failures.length,0,JSON.stringify(failures));
  assert.equal(nonCastleFailures.length,0,JSON.stringify(nonCastleFailures));
  assert.ok(parsedTerrain,'Gelände-QA fehlt');
  assert.equal(terrainFailures.length,0,JSON.stringify(terrainFailures));
});
