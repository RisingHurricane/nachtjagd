'use strict';

// Verbindet den ausgelagerten Spielkern mit der bestätigten Weltstudie: Eingabe, Anzeige, Platzhalterfiguren, Umgebung.
globalThis.NachtjagdPlay = {
  create({THREE,scene,camera,canvas,world,sky,layoutSky,backdrop,onStart,onExit}) {
    const hud=document.querySelector('#game-hud'),panel=document.querySelector('#game-panel');
    const title=document.querySelector('#game-title'),message=document.querySelector('#game-message');
    const action=document.querySelector('#game-action'),exit=document.querySelector('#game-exit');
    const score=document.querySelector('#game-score'),objective=document.querySelector('#game-objective');
    const hint=document.querySelector('#game-hint'),feed=document.querySelector('#game-feed');
    const ENEMIES=NachtjagdGame.ENEMIES;
    // Zusätzliche Anzeigen werden hier erzeugt, damit die Seite unverändert bleibt.
    function addEl(id,css,parent=hud) { const e=document.createElement('div'); e.id=id; e.style.cssText=css; parent.append(e); return e; }
    const box='position:absolute;padding:10px 14px;border-radius:6px;background:#152a31d9;max-width:90vw;';
    feed.style.top='176px'; const extra=addEl('game-extra',box+'top:108px;left:16px;font-size:13px;line-height:1.5;color:#cfe2ea');
    const vehicleBox=addEl('game-vehicle',box+'bottom:70px;left:16px;font-size:13px;line-height:1.5;color:#e4eef2');
    vehicleBox.hidden=true;
    const noteBox=addEl('game-note',box+'bottom:70px;left:50%;transform:translateX(-50%);width:min(620px,90vw);text-align:center;font-style:italic;line-height:1.5;transition:opacity .6s;opacity:0');
    const banner=addEl('game-banner',box+'top:22%;left:50%;transform:translateX(-50%);text-align:center;font-size:26px;transition:opacity .8s;opacity:0;background:#0b1620cc');
    const shopBox=addEl('game-shop',box+'top:50%;right:24px;transform:translateY(-50%);width:min(420px,92vw);background:#0b1620ee;pointer-events:auto',document.body);
    shopBox.style.zIndex=8; shopBox.hidden=true;
    const vehicleLayer=NachtjagdVehicleModels.create({THREE,scene});
    // Musik: Stückliste aus assets/music/tracks.json, Stimmung folgt dem Spielgeschehen (music.js). M schaltet stumm.
    let storage=null; try { storage=localStorage; } catch(e) { storage=null; }
    const musicBase=NachtjagdMusic.baseUrl(),music=NachtjagdMusic.create({base:musicBase,storage});
    NachtjagdMusic.load(new URL('tracks.json',musicBase)).then(list=>music.setTracks(list));
    const actors=new THREE.Group(),markers=new THREE.Group(),supplies=new THREE.Group(),props=new THREE.Group(),effects=new THREE.Group();
    scene.add(actors,markers,supplies,props,effects);
    const actorMeshes=new Map(),keys=new Set(),itemMeshes=[];
    // --- Material und Grundformen
    const lam=(c,e=0)=>new THREE.MeshLambertMaterial({color:c,emissive:e});
    const bodyGeo=new THREE.CylinderGeometry(.38,.5,1.25,7),headGeo=new THREE.IcosahedronGeometry(.3,0),sphereGeo=new THREE.SphereGeometry(1,10,8),boxGeo=new THREE.BoxGeometry(1,1,1);
    const sealGeo=new THREE.OctahedronGeometry(.65),sealMat=lam(0x77dce8,0x154857);
    const bellMat=lam(0xe4ba61,0x523919);
    const itemGeo=new THREE.BoxGeometry(.7,.5,.7),ammoMat=lam(0xddae61),healthMat=lam(0x93c7a3);
    const headMat=lam(0xc8a8a0);
    const barrel=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,.32),lam(0x3d4549));
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.05,.11,.065),lam(0x795b42));
    const weapon=new THREE.Group(); barrel.position.z=-.12; grip.position.set(0,-.07,.02); weapon.add(barrel,grip);
    weapon.position.set(.2,-.2,-.4); camera.add(weapon); scene.add(camera);
    const axe=new THREE.Group(),axeHandle=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.5),lam(0x6b4a2c)),axeHead=new THREE.Mesh(new THREE.BoxGeometry(.03,.16,.2),lam(0x9aa4aa));
    axeHead.position.z=-.25; axe.add(axeHandle,axeHead); axe.position.set(.18,-.1,-.45); axe.visible=false; camera.add(axe);
    const flash=new THREE.PointLight(0xffc16b,0,12); camera.add(flash);
    const torch=new THREE.SpotLight(0xfff0cf,0,70,.5,.45,1); torch.position.set(.1,-.1,0); torch.target.position.set(0,0,-10); camera.add(torch,torch.target);
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffdf9a})); scene.add(tracer);
    // --- Platzhalterfiguren je Gegnerart
    const LOOK={
      villager:{c:0x714d56},lycan:{c:0x645a42},wolf:{c:0x5b6473},hag:{c:0x6b4a7a},samca:{c:0x7a4020},spitter:{c:0x5d7a3e},
      bloater:{c:0xa0642a},brute:{c:0x5a5658},reaper:{c:0x3d2d36},bat:{c:0x241d22}
    };
    function makeActor(kind) {
      const spec=ENEMIES[kind],look=LOOK[kind],mat=lam(look.c),group=new THREE.Group(),model=new THREE.Group(); group.add(model);
      const add=(geo,m,x,y,z,sx=1,sy=1,sz=1)=>{ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); o.scale.set(sx,sy,sz); o.castShadow=true; model.add(o); return o; };
      const parts={};
      if(spec.air) {
        const span=kind==='bat'?.55:3.4,len=kind==='bat'?.35:1.2;
        add(sphereGeo,mat,0,0,0,len*.35,len*.28,len*.6);
        parts.wingL=add(boxGeo,mat,-span/2,0,0,span,.04,len*.6); parts.wingR=add(boxGeo,mat,span/2,0,0,span,.04,len*.6);
        parts.wingL.geometry=parts.wingR.geometry=boxGeo;
        add(sphereGeo,lam(0xff3a1a,0xff3a1a),0,.02,len*.6,len*.12,len*.12,len*.12);
      } else if(kind==='wolf') {
        add(boxGeo,mat,0,.9,0,.55,.55,1.3); add(boxGeo,mat,0,1.15,.95,.38,.38,.5); add(boxGeo,mat,0,.4,.4,.5,.8,.3); add(boxGeo,mat,0,.4,-.4,.5,.8,.3);
      } else if(kind==='bloater') {
        add(sphereGeo,mat,0,1.05,0,.75,.85,.7); add(headGeo,headMat,0,1.9,.15);
      } else {
        add(bodyGeo,mat,0,.85,0); add(headGeo,headMat,0,1.65,.1);
        if(kind==='hag') { add(boxGeo,lam(0x3a2748),0,.9,0,1.1,1.3,.4); }
        if(kind==='brute') { add(boxGeo,lam(0x3a3638),0,1.35,0,.95,.3,.55); }
      }
      const s=kind==='bat'?1:spec.scale; model.scale.setScalar(s);
      group.userData={mat,parts,kind,spec};
      return group;
    }
    function actor(m) {
      if(actorMeshes.has(m.id)) return actorMeshes.get(m.id);
      const g=makeActor(m.kind); actors.add(g); actorMeshes.set(m.id,g); return g;
    }
    // --- Orte: Truhen, Händler, Schmied, Bildstöcke, Angelplätze
    const crateMat=lam(0x7a5530),crateBand=lam(0xc9a45a),noteMat=lam(0xf2ead2,0x403c30),grenMat=lam(0x44513a);
    const relicMat={heart:lam(0x8fd8ff,0x2a6f96),compass:lam(0xf0d27a,0x6a5316),lamp:lam(0xffb347,0x7a4210)};
    const lootMeshes=world.loots?.map(l=>{
      const g=new THREE.Group(),y=world.floor(l.x,l.z);
      if(l.relicId) g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.35),relicMat[l.relicId]));
      else if(l.special==='note') { const p=new THREE.Mesh(new THREE.BoxGeometry(.5,.04,.38),noteMat); p.position.y=.1; g.add(p); }
      else { const c=new THREE.Mesh(boxGeo,l.special==='grenades'?grenMat:crateMat); c.scale.set(.9,.55,.6); c.position.y=.28; g.add(c); const b=new THREE.Mesh(boxGeo,crateBand); b.scale.set(.1,.58,.62); b.position.y=.28; g.add(b); }
      g.position.set(l.x,y+(l.relicId?1:0),l.z); g.rotation.y=(l.x*3.1+l.z*1.7)%6.28; props.add(g); return {l,g,baseY:g.position.y};
    })||[];
    function person(spot,color,label) {
      const g=new THREE.Group(),y=world.floor(spot.x,spot.z);
      const body=new THREE.Mesh(bodyGeo,lam(color)),head=new THREE.Mesh(headGeo,headMat); body.position.y=.85; head.position.y=1.65; g.add(body,head);
      const pole=new THREE.Mesh(boxGeo,lam(0x4c3a2a)); pole.scale.set(.08,2.4,.08); pole.position.set(1,1.2,0); g.add(pole);
      const sign=new THREE.Mesh(boxGeo,lam(color,color>>1)); sign.scale.set(.8,.5,.05); sign.position.set(1,2.3,0); g.add(sign);
      g.position.set(spot.x,y,spot.z); props.add(g); return g;
    }
    const merchantMesh=world.merchant?person(world.merchant,0x2f8f7a):null,smithMesh=world.smith?person(world.smith,0x8c3b2a):null;
    for(const s of world.shrines||[]) {
      const g=new THREE.Group(),stone=lam(0x8b9494); const base=new THREE.Mesh(boxGeo,stone); base.scale.set(.9,.5,.9); base.position.y=.25; const post=new THREE.Mesh(boxGeo,stone); post.scale.set(.5,1.9,.5); post.position.y=1.4;
      const top=new THREE.Mesh(boxGeo,stone); top.scale.set(.9,.7,.8); top.position.y=2.6; const lamp=new THREE.Mesh(sphereGeo,lam(0xffd68a,0xffb04a)); lamp.scale.setScalar(.18); lamp.position.y=2.6;
      g.add(base,post,top,lamp); g.position.set(s.x,world.floor(s.x,s.z),s.z); props.add(g);
    }
    for(const s of world.fishSpots||[]) {
      const g=new THREE.Group(),pole=new THREE.Mesh(boxGeo,lam(0x6b4a2c)); pole.scale.set(.06,2.2,.06); pole.position.y=1.1; const flag=new THREE.Mesh(boxGeo,lam(0x3d86b5)); flag.scale.set(.5,.3,.03); flag.position.set(.25,2,0);
      g.add(pole,flag); g.position.set(s.x,world.floor(s.x,s.z),s.z); props.add(g);
    }
    // --- Wurfgeschosse, Säure, Flammen
    const nadeMeshes=[],acidMeshes=[],fireMeshes=[];
    const nadeMat=lam(0x22261d),moloMat=lam(0xb8742a),acidMat=new THREE.MeshBasicMaterial({color:0xb4ff3a}),fireMat=new THREE.MeshBasicMaterial({color:0xff7a22,transparent:true,opacity:.75});
    const boomFlash=new THREE.PointLight(0xffa24a,0,60); effects.add(boomFlash);
    // --- Umgebung: Nacht, Nebel, Schnee, Taschenlampe
    const mix=(a,b,k)=>a+(b-a)*k;
    const lights=[];
    scene.traverse(o=>{ if(o.isLight&&o!==torch&&o!==flash&&o!==boomFlash&&!sky.owns(o)) lights.push({o,base:o.intensity}); });
    const snowCount=900,snowGeo=new THREE.BufferGeometry(),snowPos=new Float32Array(snowCount*3);
    for(let i=0;i<snowCount;i++) { snowPos[i*3]=(Math.random()-.5)*60; snowPos[i*3+1]=Math.random()*30; snowPos[i*3+2]=(Math.random()-.5)*60; }
    snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
    const snowMat=new THREE.PointsMaterial({color:0xffffff,size:.16,transparent:true,opacity:.8,depthWrite:false}),snow=new THREE.Points(snowGeo,snowMat); snow.frustumCulled=false; effects.add(snow);
    let torchOn=true;
    function applyEnv(s,dt) {
      const e=s.env,w=s.weather;
      // Der Verlauf von Sonnenuntergang zu tiefer, grauer Nacht folgt dem Spielfortschritt (e.dusk fällt von 1 auf 0).
      const night=1-e.dusk;
      const k=Math.max(.2,Math.min(1.25,.2+.55*e.light+e.sunrise*.4));
      const color=sky.apply({night,sunrise:e.sunrise,cover:e.cover,grey:w.fog>1.2?.25:0,blood:e.mod==='blood'&&e.sunrise<.4?.55:0,lightK:Math.max(.55,k)});
      scene.background=color; backdrop?.setMood(color);
      scene.fog=scene.fog||new THREE.FogExp2(color,.002);
      scene.fog.color.copy(color); scene.fog.density=.0016*(1+.9*night)*w.fog*(e.mod==='fog'?1.9:1)*(e.sunrise>0?.8:1);
      for(const l of lights) l.o.intensity=l.base*k;
      const lampBonus=(s.up.lamp+(s.relics.lamp?1:0));
      torch.intensity=torchOn?1.35+.25*lampBonus:0; torch.distance=70+14*lampBonus; torch.angle=.5+.07*lampBonus;
      snowMat.opacity=Math.min(.9,w.snow*1.1)*(e.sunrise>.7?0:1);
      const pos=snowGeo.attributes.position,px=s.player.x,py=s.player.y,pz=s.player.z;
      for(let i=0;i<snowCount;i++) {
        let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        y-=dt*(1.4+w.wind*.8); x+=dt*w.wind*1.2+Math.sin(clock*.7+i)*dt*.3; z+=Math.cos(clock*.5+i*.3)*dt*.3;
        if(y<py-2) y=py+20+Math.random()*6; if(x-px>30) x-=60; if(x-px<-30) x+=60; if(z-pz>30) z-=60; if(z-pz<-30) z+=60; if(Math.abs(y-py)>40) y=py+Math.random()*24;
        pos.setXYZ(i,x,y,z);
      }
      pos.needsUpdate=true;
    }
    function restoreEnv() {
      scene.background=sky.apply(layoutSky); backdrop?.setMood(null);
      scene.fog=null; for(const l of lights) l.o.intensity=l.base; torch.intensity=0; snowMat.opacity=0;
    }
    // --- Zustand
    let mouseSteer=0,game=null,current=null,active=false,firing=false,aiming=false,drag=null,shotClick=false,flashT=0,hitT=0,boomT=0,clock=0;
    const feedLines=[];
    let noteT=0,bannerT=0;
    const markerMeshes=world.objectives.map(o=>{
      const mesh=new THREE.Mesh(sealGeo,sealMat); markers.add(mesh); return {o,mesh};
    });
    const bellMesh=new THREE.Mesh(new THREE.ConeGeometry(.5,.8,8),bellMat); markers.add(bellMesh);
    const all=()=>[actors,markers,supplies,props,effects,weapon,tracer];
    function setVisible(v) { for(const g of all()) g.visible=v; vehicleLayer.setVisible(v); }
    setVisible(false);
    function say(text,seconds=4) { feedLines.push({text,t:seconds}); while(feedLines.length>4) feedLines.shift(); }
    function show(el,text,seconds,key) { el.textContent=text; el.style.opacity=1; if(key==='note') noteT=seconds; else bannerT=seconds; }
    function clearInput() { keys.clear(); firing=aiming=shotClick=false; drag=null; }
    function releasePointer() { if(document.pointerLockElement===canvas) document.exitPointerLock(); }
    function lockPointer() {
      try { const result=canvas.requestPointerLock(); if(result && result.catch) result.catch(()=>{}); } catch {}
    }
    function showPanel() {
      const phase=current.phase;
      shopBox.hidden=phase!=='shop';
      panel.hidden=phase==='playing'||phase==='shop';
      title.textContent=phase==='paused'?'Nachtjagd pausiert':phase==='won'?'Morgengrauen':phase==='dead'?'Überrannt':'Nachtjagd';
      message.textContent=phase==='paused'?'Die Spielwelt wartet auf dich.':phase==='won'?'Drei Siegel gefunden und die letzte Nacht überstanden.':`Welle ${current.waves.n} · ${current.stats.kills} Gegner besiegt · ${current.stats.score} Punkte`;
      action.textContent=phase==='paused'?'Weiterspielen':'Erneut spielen';
      if(phase!=='playing'&&phase!=='shop') { clearInput(); releasePointer(); }
      if(phase==='shop') clearInput();
    }
    function renderShop() {
      const list=game.shopList(),vendor=list.length&&current.shop?current.shop.vendor:'h';
      shopBox.innerHTML=`<div style="letter-spacing:.1em;text-transform:uppercase;font-size:12px;color:#9fc0cc">${vendor==='s'?'Schmiede':'Händler'} · ${current.stats.lei} Lei</div><div style="font-size:22px;margin:4px 0 8px">${vendor==='s'?'Der Schmied':'Der Händler'}</div>`+
        list.map((it,i)=>`<div data-buy="${i}" style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;padding:6px 0;border-bottom:1px solid #ffffff22;cursor:pointer;opacity:${it.affordable?1:.4}"><b>${i+1}</b><span>${it.name}<br><small style="color:#9fc0cc">${it.desc}</small></span><b>${it.label}</b></div>`).join('')+
        '<div style="margin-top:8px;font-size:12px;color:#9fc0cc">Zahl drücken oder klicken zum Kaufen · E oder Esc schließt</div>';
    }
    shopBox.addEventListener('click',e=>{ const row=e.target.closest('[data-buy]'); if(row&&game) { game.buy(Number(row.dataset.buy)); current=game.snapshot(); renderShop(); } });
    function start() {
      onStart();
      clearInput(); world.resetNavigation?.(); game=NachtjagdGame.create({world,...options}); current=game.start(); active=true;
      document.body.classList.add('playing'); hud.hidden=false; setVisible(true); music.start();
      camera.fov=74; camera.updateProjectionMatrix(); game.setLook(Math.PI,0); current=game.snapshot();
      feedLines.length=0; say('Finde die drei Mondsiegel bei Kirche, Mine und Burg.',8); torchOn=true;
      for(const m of actorMeshes.values()) actors.remove(m); for(const mesh of actorMeshes.values()) NachtjagdImportedModels.disposeEnemy(mesh); actorMeshes.clear();
      vehicleLayer.clear(); vehicleLayer.setStatic(NachtjagdVehicleModels.buildStatic(THREE,{world,layout:game.layout()})); mouseSteer=0;
      update(0); showPanel(); lockPointer();
    }
    function leave() {
      active=false; music.stop(); music.update(null,10); clearInput(); releasePointer(); hud.hidden=panel.hidden=shopBox.hidden=true;
      setVisible(false); restoreEnv();
      flash.intensity=0; document.body.classList.remove('playing'); camera.fov=48; camera.updateProjectionMatrix(); onExit();
    }
    function pause() {
      if(active && current.phase==='playing') { current=game.pause(); showPanel(); }
    }
    action.addEventListener('click',()=>{
      if(current?.phase==='paused') { clearInput(); current=game.resume(); showPanel(); lockPointer(); }
      else start();
    });
    exit.addEventListener('click',leave);
    document.querySelector('#game-pause').addEventListener('click',pause);
    document.querySelector('#play-start').addEventListener('click',start);
    canvas.addEventListener('pointerdown',e=>{
      if(!active || current.phase!=='playing') return;
      if(e.button===2) { aiming=true; return; }
      if(e.button!==0) return;
      if(document.pointerLockElement===canvas) firing=true;
      else { drag={x:e.clientX,y:e.clientY,total:0}; canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener('pointermove',e=>{
      if(!active || current.phase!=='playing') return;
      let dx=0,dy=0;
      if(document.pointerLockElement===canvas) { dx=e.movementX; dy=e.movementY; }
      else if(drag) { dx=e.clientX-drag.x; dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; drag.total+=Math.abs(dx)+Math.abs(dy); }
      else return;
      const ride=current.player.ride;
      if(ride&&ride.driver&&ride.kind==='jeep') { mouseSteer=Math.max(-.8,Math.min(.8,mouseSteer-dx*.0042)); game.setLook(current.player.yaw,current.player.pitch-dy*.003); }
      else game.setLook(current.player.yaw-dx*.003,current.player.pitch-dy*.003);
      current=game.snapshot();
    });
    addEventListener('pointerup',e=>{
      if(!active) return;
      if(e.button===2) aiming=false;
      if(e.button===0) { if(drag && drag.total<5) shotClick=true; firing=false; drag=null; }
    });
    canvas.addEventListener('pointercancel',clearInput);
    document.addEventListener('pointerlockchange',()=>{ if(active && document.pointerLockElement!==canvas) pause(); });
    const CONTROL_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyR','KeyE','KeyG','KeyT','KeyV','KeyF','KeyC','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Escape'];
    addEventListener('keydown',e=>{
      if(!active || e.target.matches('input,textarea,select')) return;
      if(CONTROL_KEYS.includes(e.code)) e.preventDefault();
      if(current.phase==='shop') {
        if(e.repeat) return;
        if(e.code==='Escape'||e.code==='KeyE') { game.closeShop(); current=game.snapshot(); showPanel(); lockPointer(); }
        else if(/^Digit[1-9]$/.test(e.code)) { game.buy(Number(e.code.slice(-1))-1); current=game.snapshot(); renderShop(); }
        return;
      }
      if(e.code==='Escape') { pause(); return; }
      if(current.phase!=='playing') return;
      keys.add(e.code);
      if(e.repeat) return;
      if(e.code==='KeyR') game.reload();
      if(e.code==='KeyE') { game.interact(); current=game.snapshot(); if(current.phase==='shop') { showPanel(); renderShop(); releasePointer(); } }
      if(e.code==='KeyG') game.throwGrenade();
      if(e.code==='KeyT') game.throwMolotov();
      if(e.code==='KeyV') game.melee();
      if(e.code==='KeyF') torchOn=!torchOn;
      if(e.code==='KeyM') say(music.toggleMute()?'Musik aus':'Musik an',2);
      if(e.code==='KeyC') game.changeSeat();
      if(/^Digit[123]$/.test(e.code)) game.selectWeapon(Number(e.code.slice(-1))-1);
    });
    addEventListener('keyup',e=>keys.delete(e.code));
    addEventListener('blur',pause);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
    function update(dt) {
      if(!active) return;
      clock+=dt; music.setPaused(current.phase==='paused'||current.phase==='shop'); music.update(current,dt);
      if(current.phase==='playing') {
        if(keys.has('ArrowLeft') || keys.has('ArrowRight')) game.setLook(current.player.yaw+(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*2.1,current.player.pitch);
        current=game.step(dt,{
          forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
          side:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),
          jump:keys.has('Space'),fire:firing||shotClick,aim:aiming,turn:mouseSteer
        });
        mouseSteer*=Math.exp(-dt*2.6);
        shotClick=false;
      }
      const p=current.player;
      camera.position.set(p.x,p.y+p.eye,p.z);
      camera.lookAt(p.x+Math.sin(p.yaw)*Math.cos(p.pitch),p.y+p.eye+Math.sin(p.pitch),p.z+Math.cos(p.yaw)*Math.cos(p.pitch));
      const targetFov=aiming?(current.current===2?26:62):74;
      camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*12); camera.updateProjectionMatrix();
      // Fahrzeuge
      vehicleLayer.update(current.vehicles,dt,clock);
      const ride=p.ride,rv=ride&&current.vehicles.find(v=>v.id===ride.id);
      weapon.visible=!(ride&&ride.driver&&ride.kind==='jeep');
      vehicleBox.hidden=!rv;
      if(rv) {
        const names=['Fahrer','Beifahrer','Hinten links','Hinten rechts'],seat=rv.kind==='gondola'?'Platz '+(ride.seat+1):rv.kind==='boat'?'Ruderer':names[ride.seat];
        const speed=Math.round(Math.abs(rv.sp)*3.6);
        let hints='C Platz wechseln · E Aussteigen';
        if(ride.driver) hints={jeep:'W/S Gas und Rückwärts · Maus oder A/D lenken · Leertaste bremsen · ',cart:'W/S vor und zurück · A/D Weiche · Leertaste bremsen · ',boat:'W/S rudern (Shift schneller) · A/D lenken · '}[rv.kind]+hints;
        else if(rv.kind==='gondola') hints=rv.dock===null?'Maus umsehen · Klick schießen · C Platz · Aussteigen an der Station':'E Aussteigen · C Platz · Abfahrt in '+Math.ceil(Math.max(0,(rv.dock===0?8-rv.phase:62-rv.phase)))+' s';
        else hints='Maus und Klick schießen · '+hints;
        vehicleBox.innerHTML=`<b>${rv.name} · ${seat}${rv.kind==='gondola'?'':' · '+speed+' km/h'}</b><br><small style="color:#9fc0cc">${hints}</small>`;
      }
      // Gegner
      for(const m of current.monsters) {
        const group=actor(m),spec=ENEMIES[m.kind],d=group.userData;
        NachtjagdImportedModels.decorateEnemy(group,m.kind,spec);
        const rise=m.state==='emerge'&&!spec.air?-(1-Math.min(1,m.em/spec.emerge))*2.2*spec.scale:0;
        group.position.set(m.x,m.y+(m.lift||0)+rise,m.z); group.rotation.y=m.yaw;
        group.scale.setScalar(m.sv||1);
        if(spec.air) { const flap=Math.sin(clock*(m.kind==='bat'?24:8)+m.id)*(m.A.ph==='dive'?.2:.55); d.parts.wingL.rotation.z=flap; d.parts.wingR.rotation.z=-flap; }
        const hot=m.state==='windup'?.5:0,hurt=m.hit>0?.7:0;
        const last=d.last||(d.last={x:m.x,z:m.z,speed:0});
        last.speed+=((dt>0?Math.hypot(m.x-last.x,m.z-last.z)/dt:0)-last.speed)*Math.min(1,dt*8); last.x=m.x; last.z=m.z;
        NachtjagdImportedModels.updateEnemy(group,dt,hurt,hot,{speed:last.speed,state:m.state});
        d.mat.emissive.setRGB(Math.max(hurt,hot*(m.kind==='bloater'?.5+.5*Math.sin(clock*40):1)),hurt*.1,0);
      }
      for(const [id,mesh] of actorMeshes) if(!current.monsters.some(m=>m.id===id)) { NachtjagdImportedModels.disposeEnemy(mesh); actors.remove(mesh); actorMeshes.delete(id); }
      // Siegel, Glocke, Beute
      markerMeshes.forEach(({o,mesh},i)=>{
        mesh.visible=!current.quest.objectives[i].found;
        mesh.position.set(o.x,world.floor(o.x,o.z)+1.5+Math.sin(clock*2)*.12,o.z); mesh.rotation.y=clock;
      });
      const bell=world.bell; bellMesh.visible=current.quest.stage==='bell'; bellMesh.position.set(bell.x,world.floor(bell.x,bell.z)+1.7,bell.z);
      lootMeshes.forEach(({l,g,baseY},i)=>{ g.visible=!current.loots[i].taken; if(l.relicId) { g.rotation.y+=dt*.65; g.position.y=baseY+Math.sin(clock*2.2+i)*.12; } });
      while(itemMeshes.length<current.items.length) { const mesh=new THREE.Mesh(itemGeo,ammoMat); supplies.add(mesh); itemMeshes.push(mesh); }
      itemMeshes.forEach((mesh,i)=>{
        const item=current.items[i]; mesh.visible=Boolean(item)&&(item.life>8||Math.floor(item.life*4)%2===0); if(!item) return;
        mesh.material=item.type==='health'?healthMat:ammoMat; mesh.position.set(item.x,item.y+.45+Math.sin(item.t*2.4)*.1,item.z); mesh.rotation.y=item.t*1.6;
      });
      // Wurfgeschosse, Säure, Flammen
      const sync=(list,data,make,set)=>{ while(list.length<data.length) { const m=make(); effects.add(m); list.push(m); } list.forEach((m,i)=>{ m.visible=i<data.length; if(i<data.length) set(m,data[i]); }); };
      sync(nadeMeshes,current.nades,()=>new THREE.Mesh(sphereGeo,nadeMat),(m,n)=>{ m.scale.setScalar(n.molo?.1:.12); m.material=n.molo?moloMat:nadeMat; m.position.set(n.x,n.y,n.z); });
      sync(acidMeshes,current.acids,()=>{ const m=new THREE.Mesh(sphereGeo,acidMat); m.scale.setScalar(.22); return m; },(m,a)=>m.position.set(a.x,a.y,a.z));
      sync(fireMeshes,current.fires,()=>new THREE.Mesh(new THREE.ConeGeometry(1,1,8),fireMat),(m,f)=>{ const k=.8+.25*Math.sin(clock*18+f.x); m.scale.set(f.r*.9,1.4*k,f.r*.9); m.position.set(f.x,f.y+.7*k,f.z); });
      // Ereignisse
      for(const e of game.drainEvents()) {
        if(e.type==='shot') {
          flashT=.06; weapon.position.z=-.34;
          const direction=new THREE.Vector3(); camera.getWorldDirection(direction);
          const origin=camera.position.clone(),end=origin.clone().addScaledVector(direction,Math.min(80,world.rayDistance(origin,direction,80)));
          geometry.attributes.position.setXYZ(0,origin.x,origin.y-.12,origin.z); geometry.attributes.position.setXYZ(1,end.x,end.y,end.z); geometry.attributes.position.needsUpdate=true;
          if(e.hit) hitT=.15;
        }
        if(e.type==='hurt') { hud.classList.add('hurt'); setTimeout(()=>hud.classList.remove('hurt'),160); }
        if(e.type==='notice' && e.text!=='Angriff!') { say(e.text,3); if(e.detail) say(e.detail,4); if(e.wave) show(banner,e.text,3,'banner'); }
        if(e.type==='objective') say(e.id==='bell'?'Glocke geläutet – überlebe 100 Sekunden.':`${e.name} gefunden · Vorräte ergänzt`,5);
        if(e.type==='note') show(noteBox,`„${e.text}“`,9,'note');
        if(e.type==='relic') { say(e.text,4); if(e.detail) show(banner,e.name+' · '+e.detail,4,'banner'); }
        if(e.type==='explosion') { boomFlash.position.set(e.x,e.y,e.z); boomT=.35; }
        if(e.type==='fire') { boomFlash.position.set(e.x,e.y+1,e.z); boomT=.2; }
        if(e.type==='swing') { axe.visible=true; axe.rotation.x=-.9; axe.userData.t=.4; }
        if(e.type==='state') showPanel();
        if(e.type==='state'&&e.phase==='shop') renderShop();
        if(e.type==='buy') say(`${e.name} gekauft`,2);
        if(e.type==='kill') say(`${ENEMIES[e.kind].name} erlegt${e.head?' · Kopftreffer':''}`,2);
      }
      if(current.phase==='shop') renderShop();
      if(axe.visible) { axe.userData.t-=dt; axe.rotation.x+=dt*5; if(axe.userData.t<=0) axe.visible=false; }
      flashT=Math.max(0,flashT-dt); hitT=Math.max(0,hitT-dt); boomT=Math.max(0,boomT-dt);
      for(const l of feedLines) l.t-=dt;
      while(feedLines.length&&feedLines[0].t<=0) feedLines.shift();
      noteT=Math.max(0,noteT-dt); if(noteT<=0) noteBox.style.opacity=0;
      bannerT=Math.max(0,bannerT-dt); if(bannerT<=0) banner.style.opacity=0;
      flash.intensity=flashT>0?2:0; boomFlash.intensity=boomT>0?4*boomT/.35:0; tracer.visible=flashT>0; weapon.position.z+=(-.4-weapon.position.z)*Math.min(1,dt*15);
      if(current.phase!=='ready') applyEnv(current,dt);
      hud.classList.toggle('hit',hitT>0);
      feed.hidden=!feedLines.length; feed.innerHTML=feedLines.map(l=>l.text.replace(/[<&]/g,c=>c==='<'?'&lt;':'&amp;')).join('<br>');
      // Anzeige
      const w=current.weapons[current.current],mag=w.mag+current.up.mag*(w.mag>=6?2:1);
      score.textContent=`Leben ${Math.ceil(p.hp)}/${p.maxHp} · ${w.name} ${w.ammo}/${w.reserve}${w.reloading>0?' · Nachladen …':''} · Welle ${current.waves.n}${current.waves.mod!=='normal'?' ('+({blood:'Blutmond',fog:'Nebel',bats:'Fledermäuse'}[current.waves.mod])+')':''} · ${current.stats.score} Punkte`;
      extra.textContent=`Lei ${current.stats.lei} · Granaten ${p.gren} [G] · Molotow ${p.molo} [T] · Axt [V] · Sprung [Leertaste] · Lampe [F]  ·  ${current.weather.name}${p.bless>0?'  ·  Segen '+Math.ceil(p.bless)+' s':''}${p.slowT>0?'  ·  Säure':''}`;
      const relic=game.relicStatus(); if(relic) extra.textContent+='\n'+relic;
      extra.style.whiteSpace='pre-line';
      const remaining=current.quest.objectives.filter(o=>!o.found);
      objective.textContent=current.quest.stage==='final'?`Bis zum Morgengrauen: ${Math.ceil(current.waves.finalT)} s`:current.quest.stage==='bell'?'Läute die Glocke vor der Kirche':`Mondsiegel ${3-remaining.length}/3 · ${remaining.map(o=>`${o.name} ${Math.round(Math.hypot(p.x-o.x,p.z-o.z))} m`).join(' · ')}`;
      const prompt=game.prompt();
      hint.textContent=prompt||'WASD · Shift laufen · Leertaste springen · Klick schießen · R nachladen · 1–3 Waffen · G Granate · T Molotow · V Axt · M Musik · Esc Pause';
      const report=document.querySelector('#game-tests');
      if(report) report.textContent=JSON.stringify({phase:current.phase,player:p,wave:current.waves.n,monsters:current.monsters.length,ammo:w.ammo,mag,checks:world.checks},null,2);
    }
    // --- Vorschau in der Layoutansicht: Fahrzeuge, Schienen und Gondelbahn laufen ohne Spieler und ohne Gegner
    const options={}; // Prüfhaken: z. B. {startWave:3} für Aufnahmen und Tests
    let preview=null;
    function previewUpdate(dt) {
      if(active) return;
      if(!preview) {
        preview=NachtjagdGame.create({world:{...world,spawnEnemy:()=>null}}); preview.start();
        vehicleLayer.clear(); vehicleLayer.setStatic(NachtjagdVehicleModels.buildStatic(THREE,{world,layout:preview.layout()}));
      }
      clock+=dt; vehicleLayer.setVisible(true);
      vehicleLayer.update(preview.step(dt,{}).vehicles,dt,clock);
    }
    return {start,options,music,update,previewUpdate,get previewGame(){return preview;},leave,get active(){return active;},get game(){return game;}};
  }
};
