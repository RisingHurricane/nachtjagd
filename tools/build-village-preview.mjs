'use strict';

// Der importierte Live-Stand bleibt als Vergleich erhalten. Der Entwurf wird daraus gebaut.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imported = path.join(root, 'live/altay.vision');
const output = path.join(root, 'public/entwurf');
let html = fs.readFileSync(path.join(imported, 'nachtjagd-neu/index.html'), 'utf8');
function replace(before, after) {
  if (!html.includes(before)) throw new Error('Vorlage hat sich geändert: ' + before.slice(0, 90));
  html = html.replace(before, after);
}

replace('<title>Nachtjagd · Das offene Tal · Altay</title>', '<title>Nachtjagd · Dorfentwurf 01</title>');
html = html.replaceAll('/nachtjagd/vendor/', './vendor/').replaceAll('/nachtjagd/textures/', './textures/');
replace('<a class="classic-link" href="/nachtjagd/">Zur klassischen Nachtjagd</a>', '<a class="classic-link" href="https://altay.vision/nachtjagd-neu/">Zum bisherigen Spiel</a>');
replace('<h1>Nachtjagd</h1>', '<h1>Nachtjagd</h1><p style="color:#e5c691">Dorfentwurf 01 · Platz, Marktstraße und Kirchgasse</p>');
replace('<p class="lead">', '<p class="lead">Dieser Entwurf erprobt einen dichteren Dorfkern nach deinen Bildreferenzen. Allein spielbar; Online-Koop und Musikaufnahmen sind in dieser Vorschau ausgenommen.</p><p class="lead" hidden>');
replace('</head>', `<style>
#coop-panel,#music-controls{display:none!important}
#draft-label{position:fixed;bottom:15px;left:18px;z-index:14;padding:7px 11px;border:1px solid #c1b09055;background:#101a24cc;color:#e5d9c3;font:14px var(--font-hud);pointer-events:none}
#draft-label a{color:#e5d9c3;margin-left:12px;pointer-events:auto}
</style></head>`);
replace('<canvas id="c">', '<nav id="draft-label" aria-label="Entwurfsansichten">Dorfentwurf 01 <a href="?auto=1&amp;cam=3,21,17,-5,20,-45&amp;fov=62">Dorfplatz</a><a href="?auto=1&amp;cam=62,42,70,-3,5,-17">Übersicht</a><a href="?auto=1&amp;wt=99999">Rundgang</a><a href="spiel.html">Spielen</a></nav><canvas id="c">');
replace('async function mpRequest(action,body,token=MP.token){', 'async function mpRequest(action,body,token=MP.token){\n throw new Error("Online-Koop ist in diesem Dorfentwurf noch nicht verbunden.");');
replace('startMusic=function(){if(SOUNDTRACK.on)', 'startMusic=function(){return; if(SOUNDTRACK.on)');

const housesStart = html.indexOf('const HOUSES=[');
const housesEnd = html.indexOf('\n];', housesStart) + 3;
if (housesStart < 0 || housesEnd < housesStart) throw new Error('Häuserliste fehlt');
html = html.slice(0, housesStart) + `// Versetzte Straßenfronten fassen den Platz; der Händler bleibt an Index 2.
const HOUSES=[
 {x:-36,z:-4,w:9,d:10,style:'tudor',rot:.025,pitch:.68,dormer:true,upper:2.9},
 {x:-23,z:-6,w:8,d:9,style:'tudor',rot:-.035,pitch:.68},
 {x:20,z:-7,w:9,d:10,style:'tudor',merchant:true,rot:-.025,pitch:.7,dormer:true,upper:3.2},
 {x:32,z:-4,w:8,d:9,style:'tudor',rot:.025,pitch:.74},
 {x:44,z:-2,w:10,d:9,style:'log',rot:-.08,pitch:.68},
 {x:-33,z:20,w:10,d:10,style:'tudor',rot:Math.PI+.045,pitch:.64,dormer:true,upper:3.1},
 {x:-20,z:21,w:8,d:9,style:'log',rot:Math.PI-.035,pitch:.72},
 {x:24,z:23,w:11,d:11,style:'tudor',rot:Math.PI-.025,pitch:.62,dormer:true,upper:3.3},
 {x:39,z:21,w:9,d:10,style:'tudor',rot:Math.PI+.035,pitch:.74},
 {x:111,z:-39,w:9,d:8,style:'log'},
 {x:122,z:-17,w:10,d:8,style:'tudor'},
 {x:-129,z:81,w:8,d:7,style:'log'},
 {x:100,z:117,w:8,d:7,style:'log'},
 {x:-16,z:-23,w:8,d:9,style:'tudor',rot:Math.PI/2+.02,pitch:.78,lane:true},
 {x:9,z:-26,w:8,d:9,style:'tudor',rot:-Math.PI/2-.025,pitch:.7,lane:true},
 {x:-16,z:-37,w:8,d:9,style:'tudor',rot:Math.PI/2-.025,pitch:.7,lane:true},
 {x:9,z:-40,w:7,d:9,style:'tudor',rot:-Math.PI/2+.025,pitch:.84,lane:true},
 {x:-4,z:27,w:10,d:9,style:'tudor',rot:Math.PI+.02,pitch:.76}
];` + html.slice(housesEnd);

// Ausrichtung gilt gemeinsam für Baukörper, Türen, Innenräume und Hofdetails.
html = html.replaceAll('const {x,z,w,d}=H, y0=H.pad.h, rotY=Math.atan2(-x,-z)', 'const {x,z,w,d}=H, y0=H.pad.h, rotY=H.rot??Math.atan2(-x,-z)');
replace('const x=H.x, z=H.z, rotY=Math.atan2(-x,-z)', 'const x=H.x, z=H.z, rotY=H.rot??Math.atan2(-x,-z)');
replace("ROADS['house'+i]=[front,[front[0],H.z>55?H.z-14:8]];", "ROADS['house'+i]=[front,H.lane?[-4,front[1]]:[front[0],H.z>55?H.z-14:8]];");
replace("ROADS.church=[[0,8],[-5,-25],[CHURCH.x,CHURCH.z+10]];", "ROADS.church=[[0,8],[-4,-10],[-4,-31],[CHURCH.x,CHURCH.z+10]];");
replace('ROADS.castle=[[0,8],[-27,4],[-57,-10]', 'ROADS.castle=[[0,8],[-27,9],[-47,9],[-57,-10]');
replace("[[9,24],[20,8],[45,12],[83,20],[100,45]]", "[[10,32],[11,10],[45,10],[83,20],[100,45]]");
replace("[[9,24],[9,60],[12,106]", "[[10,32],[10,60],[12,106]");

// Proportionen und Silhouette statt zusätzlicher Oberflächenfilter.
replace('gableRoof(Pm,W2,D2,yt,W2*0.55,', 'gableRoof(Pm,W2,D2,yt,W2*(H.pitch||.66),');
replace('hs=2.7, hu=2.5, ov=', 'hs=2.7, hu=H.upper||2.5, ov=');
replace('const rh=W2*0.55, cy=', 'const rh=W2*(H.pitch||.66), cy=');
replace('rh=w*0.5+0.4, dw=', 'rh=w*(H.pitch||.58)+0.4, dw=');
replace('houses.push({x,z,w:W2,d:D2,rot:rotY});', 'dressVillageHouse(H,Pm,W2,D2,yt,rh);\n  houses.push({x,z,w:W2,d:D2,rot:rotY});');
replace('houses.push({x,z,w,d,rot:rotY});', 'if(!o.barn) dressVillageHouse(H,Pm,w,d,yF+hs,rh);\n  houses.push({x,z,w,d,rot:rotY});');
replace('// ---------------------------------------------------------------- Gebäude', `// Feinere Konturen: Ortgang, Sparrenköpfe, Giebelständer und steinerne Fensterbänke.
// Details liegen außerhalb der bestehenden Räume; Türen und Treppen behalten ihre Maße.
function dressVillageHouse(H,Pm,w,d,eave,rise){
  const timber=col(.24,.18,.13), stone=col(.64,.62,.57);
  const beam=(a,b,t=.14)=>alpineBeam(B.dark,toW(Pm,...a),toW(Pm,...b),t,timber);
  for(const end of [-1,1]){
    const z=end*(d/2+.13);
    beam([-w/2,eave,z],[0,eave+rise,z],.18);
    beam([0,eave+rise,z],[w/2,eave,z],.18);
    beam([-w/2,eave+.08,z],[w/2,eave+.08,z],.18);
    beam([0,eave+.1,z],[0,eave+rise-.12,z],.12);
    for(const s of [-1,1]) beam([s*w*.25,eave+.1,z],[s*w*.25,eave+rise*.48,z],.12);
  }
  const roofAngle=Math.atan2(rise,w/2), edgeY=eave-.6*Math.tan(roofAngle);
  for(const s of [-1,1]){
    beam([s*(w/2+.6),edgeY,-d/2-.6],[s*(w/2+.6),edgeY,d/2+.6],.16);
    for(let z=-d/2+.3;z<d/2;z+=1.25) beam([s*(w/2-.15),eave-.13,z],[s*(w/2+.55),edgeY-.13,z],.1);
    for(let y=.18;y<2.4;y+=.38) B.stone.add(texBox(.42,.3,.18,1),rel(Pm,s*(H.w/2-.18),y,H.d/2+.055),stone);
    B.stone.add(texBox(1.16,.12,.32,1),rel(Pm,s*H.w*.3,1.02,H.d/2+.16),stone);
  }
  if(H.style==='log'){
    for(let y=.3;y<eave-.15;y+=.29) for(const s of [-1,1]){
      B.wood.add(texBox(w,.245,.055,2),rel(Pm,0,y,s*(d/2+.03)),col(.72,.66,.56));
      B.wood.add(texBox(.055,.245,d,2),rel(Pm,s*(w/2+.03),y,0),col(.72,.66,.56));
    }
  }
  if(H.dormer){
    for(const side of [-1,1]){
      const roofY=eave+rise*.44-.35;
      const dm=rel(Pm,side*w*.28,roofY,-d*.12,0,side*Math.PI/2,0);
      B.plaster.add(texBox(1.6,1.35,2.0,1),rel(dm,0,.675,0),col(.78,.74,.66));
      gableRoof(dm,1.6,2.0,1.35,1.05,{ov:.18,wall:B.plaster,wc:col(.78,.74,.66),rc:col(.45,.48,.53)});
      windowAt(dm,0,.75,1.01,0,.65,.82,true,null,false,0);
    }
  }
  if(H.merchant){
    beam([2.25,3.3,H.d/2],[2.25,3.3,H.d/2+1.6],.075);
    for(const z of [H.d/2+.65,H.d/2+1.35]) beam([2.25,3.3,z],[2.25,2.9,z],.035);
    B.wood.add(texBox(.13,.7,1.1,1),rel(Pm,2.25,2.65,H.d/2+1),col(.35,.24,.14));
    B.dark.add(G.box,rel(Pm,2.25,2.65,H.d/2+1,0,0,0,.16,.08,.9),col(.72,.58,.31));
  }
}

// ---------------------------------------------------------------- Gebäude`);

// Ein lesbarer Platz statt einer gleichmäßig verteilten Ansammlung von Requisiten.
replace('for(let i=0;i<4;i++){ const a=i/4*TAU+0.5, bx=', 'for(let i=0;i<2;i++){ const a=i/2*TAU+0.5, bx=');
replace('[[-10,-3,0],[11,2,1],[-3,-9,2],[4,11,0]]', '[[-11,0,0],[12,-1,1]]');
replace('[[-4,6],[7,-2],[-24,4]]', '[[54,11],[-48,15],[15,38]]');
replace('[[-7,6,1],[8,5,1],[-6,-7,1],[-1,14,0],[6,-12,0],[15,4,1],[17,-12,0],[-6,-24,1],[6,-24,1]]', '[[-12,7,1],[13,6,1],[-8,-12,1],[1,-22,0],[-8,-31,0],[1,-40,1],[-29,13,1],[31,12,1],[11,28,0]]');
replace('[[6,2],[-7,-2],[18,3],[-13,2],[2,36],[-2,-25],[24,-14]]', '[[-12,2],[13,1],[-29,14],[31,14]]');
replace('woodpile(-12*WORLD_SCALE,16*WORLD_SCALE,-0.4); woodpile(16*WORLD_SCALE,-9*WORLD_SCALE,0.8); woodpile(22*WORLD_SCALE,12*WORLD_SCALE,0.3);', 'woodpile(-43,20,-0.4); woodpile(48,-10,0.8); woodpile(45,29,0.3);');
replace('gibbet(10*WORLD_SCALE,-9*WORLD_SCALE,0.5); gibbet(-9*WORLD_SCALE,-11*WORLD_SCALE,2.6);', 'gibbet(55,-16,0.5); gibbet(-45,-18,2.6);');
replace('wallSeg(-5,42,-5,48); wallSeg(13,40,13,46); wallSeg(24,-35,36,-32);', 'wallSeg(-25,31,-12,31); wallSeg(16,32,31,32); wallSeg(24,-35,36,-32);');
replace("if(QS.get('house')!==null&&QS.get('house')!==undefined){ const H=HOUSES[+QS.get('house')], l=Math.hypot(H.x,H.z)||1, off=QS.get('ho')!==null&&QS.get('ho')!==undefined?+QS.get('ho'):H.d/2+2.5; P.x=H.x-H.x/l*off; P.z=H.z-H.z/l*off;", "if(QS.get('house')!==null&&QS.get('house')!==undefined){ const H=HOUSES[+QS.get('house')], a=H.rot??Math.atan2(-H.x,-H.z), off=QS.get('ho')!==null&&QS.get('ho')!==undefined?+QS.get('ho'):H.d/2+2.5; P.x=H.x+Math.sin(a)*off; P.z=H.z+Math.cos(a)*off;");
replace("addEventListener('blur',()=>{ if(state==='play'||state==='shop') pauseGame(); });", "addEventListener('blur',()=>{ if(!QS.has('cam')&&!QS.has('top')&&(state==='play'||state==='shop')) pauseGame(); });");

// Die echten Bewegungs- und Kollisionsfunktionen prüfen die neu angeordneten Wege.
replace("{ const T=QS.get('test');", `{ const T=QS.get('test');
    if(T==='village'){
      const results=[];
      const walk=(name,start,points)=>{
        P.x=start[0]; P.z=start[1]; P.y=groundAt(P.x,P.z,heightAt(P.x,P.z)+1);
        P.vx=P.vz=P.vy=0; P.onGround=true; P.net=false; P.inside=null; P.hp=P.maxHp=1e6;
        let reached=0;
        for(const pt of points){
          let ok=false;
          for(let i=0;i<900;i++){
            const dx=pt[0]-P.x,dz=pt[1]-P.z;
            if(Math.hypot(dx,dz)<.5){ok=true;break;}
            P.yaw=Math.atan2(-dx,-dz); keys.KeyW=true; updatePlayer(1/30);
          }
          if(!ok) break;
          reached++;
        }
        keys.KeyW=false;
        results.push({name,pass:reached===points.length,reached:reached+'/'+points.length,end:[P.x,P.y,P.z].map(v=>+v.toFixed(2))});
      };
      walk('Marktstraße',[-45,9],[[48,9]]);
      walk('Kirchgasse',[0,11],[[-4,6],[-4,-10],[-4,-31],[-5,-42]]);
      walk('Südausgang',[10,10],[[10,32],[10,60]]);
      for(let i=0;i<HOUSES.length;i++){
        const h=HOUSES[i],b=h.bld;
        if(!b||!b.up) continue;
        const u=b.up,pts=[b.dIn,[u.bx,u.bz]];
        for(let k=1;k<=6;k++) pts.push([lerp(u.bx,u.tx,k/6),lerp(u.bz,u.tz,k/6)]);
        walk('Haus '+i+' Eingang und Treppe',b.dOut,pts);
      }
      const report=document.createElement('pre'); report.id='draft-tests';
      report.style.cssText='position:fixed;top:8px;left:8px;z-index:100;background:#111e;color:#fff;padding:14px;font:12px monospace;max-height:85vh;overflow:auto';
      report.textContent=JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,results},null,2);document.body.appendChild(report);
    }`);

fs.mkdirSync(output, { recursive:true });
fs.writeFileSync(path.join(output, 'spiel.html'), html);
for(const folder of ['vendor','textures']) fs.cpSync(path.join(imported,'nachtjagd',folder),path.join(output,folder),{recursive:true});
console.log('Spielbarer Vergleich erstellt: public/entwurf/spiel.html');

