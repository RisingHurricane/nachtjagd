'use strict';

// Verbindet den ausgelagerten Spielkern mit der bestätigten Weltstudie: Eingabe, Anzeige, Platzhalterfiguren, Umgebung.
globalThis.NachtjagdPlay = {
  create({THREE,scene,camera,canvas,world,sky,layoutSky,backdrop,lamps=null,onStart,onExit}) {
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
    // Musik: Stückliste aus assets/music/tracks.json, Stimmung folgt dem Spielgeschehen (music.js). N schaltet stumm.
    let storage=null; try { storage=localStorage; } catch(e) { storage=null; }
    const musicBase=NachtjagdMusic.baseUrl(),music=NachtjagdMusic.create({base:musicBase,storage});
    NachtjagdMusic.load(new URL('tracks.json',musicBase)).then(list=>music.setTracks(list));
    // Lautstärkeregler und Stummschalter im Hauptmenü und im Pausenfenster; Taste N schaltet ebenfalls.
    const musicRows=[];
    function musicControls(parent,before=null) {
      const row=document.createElement('div');row.className='music-row';
      row.innerHTML='<label>Musik <input type="range" min="0" max="100" step="1" aria-label="Lautstärke der Musik"></label><button type="button" class="music-mute"></button>';
      const slider=row.querySelector('input'),mute=row.querySelector('button');
      slider.addEventListener('input',()=>{ music.setVolume(Number(slider.value)/100); if(music.muted&&Number(slider.value)>0) music.toggleMute(); syncMusic(); });
      mute.addEventListener('click',()=>{ music.toggleMute(); syncMusic(); });
      parent.insertBefore(row,before); musicRows.push({slider,mute}); return row;
    }
    function syncMusic() {
      for(const r of musicRows) {
        r.slider.value=String(Math.round(music.volume*100)); r.slider.disabled=false;
        r.mute.textContent=music.muted?'Ton an':'Ton aus'; r.mute.setAttribute('aria-pressed',String(music.muted));
        r.slider.closest('.music-row').classList.toggle('muted',music.muted);
      }
    }
    musicControls(document.querySelector('#main-menu .menu-content'),document.querySelector('#main-menu details'));
    musicControls(document.querySelector('#game-panel'));
    syncMusic();
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
    const weaponView=NachtjagdInterface.weapon(THREE),weapon=weaponView.group;
    camera.add(weapon); scene.add(camera);
    // Das Waffenlicht hängt direkt an der Kamera: Beim Fahren wird die Waffe ausgeblendet, die Lichtanzahl muss gleich bleiben.
    if(weaponView.light) camera.add(weaponView.light);
    const ui=NachtjagdInterface.create({world,onPlay:start,onLayout:onExit,onMap:(open,ownedPause)=>{
      if(open) { const wasPlaying=current?.phase==='playing'; pause(); return wasPlaying; }
      if(room&&teamMenu) { teamMenu=false; clearInput(); showPanel(); lockPointer(); return false; }
      if(ownedPause&&current?.phase==='paused') { clearInput(); current=game.resume(); showPanel(); lockPointer(); }
      else if(active) showPanel();
      return false;
    }});
    const axe=new THREE.Group(),axeHandle=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.5),lam(0x6b4a2c)),axeHead=new THREE.Mesh(new THREE.BoxGeometry(.03,.16,.2),lam(0x9aa4aa));
    axeHead.position.z=-.25; axe.add(axeHandle,axeHead); axe.position.set(.18,-.1,-.45); axe.visible=false; camera.add(axe);
    const flash=new THREE.PointLight(0xffc16b,0,12); camera.add(flash);
    const torch=new THREE.SpotLight(0xffe6bd,0,70,.5,.62,1.2); torch.position.set(.1,-.1,0); torch.target.position.set(0,0,-10); camera.add(torch,torch.target);
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffdf9a})); scene.add(tracer);
    // --- Platzhalterfiguren je Gegnerart
    const LOOK={
      villager:{c:0x714d56},lycan:{c:0x645a42},wolf:{c:0x5b6473},hag:{c:0x6b4a7a},samca:{c:0x7a4020},spitter:{c:0x5d7a3e},
      bloater:{c:0xa0642a},brute:{c:0x5a5658},reaper:{c:0x3d2d36},bat:{c:0x241d22}
    };
    // Gegnerfiguren aus monster-models.js: je Art eigene Gestalt, Gelenke als Gruppen, Haut je Gegner (Trefferfärbung).
    function makeActor(kind) {
      const spec=ENEMIES[kind],look=LOOK[kind],mat=lam(look.c),group=new THREE.Group();
      const {model,parts}=NachtjagdMonsterModels.build(THREE,kind,mat); group.add(model);
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
    const relicMat={heart:lam(0x8fd8ff,0x2a6f96),compass:lam(0xf0d27a,0x6a5316),lamp:lam(0xffb347,0x7a4210),crown:lam(0xffd86a,0x9a6a10),circle:lam(0x9dffc4,0x2a8a55),pearl:lam(0xdff4ff,0x4a7a9a)};
    // Gipfelheiligtum, Runenstein mit Lichtstrahl, Inselaltar (relic-sites.js)
    const relicSites=NachtjagdRelicSites.create({THREE,scene,world,lamps});
    const lootMeshes=world.loots?.map(l=>{
      const g=new THREE.Group(),y=world.floor(l.x,l.z);
      if(l.relicId) g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.35),relicMat[l.relicId]));
      else if(l.special==='note') { const p=new THREE.Mesh(new THREE.BoxGeometry(.5,.04,.38),noteMat); p.position.y=.1; g.add(p); }
      else { const c=new THREE.Mesh(boxGeo,l.special==='grenades'?grenMat:crateMat); c.scale.set(.9,.55,.6); c.position.y=.28; g.add(c); const b=new THREE.Mesh(boxGeo,crateBand); b.scale.set(.1,.58,.62); b.position.y=.28; g.add(b); }
      g.position.set(l.x,y+(l.relicId?1:0),l.z); g.rotation.y=(l.x*3.1+l.z*1.7)%6.28; props.add(g); return {l,g,baseY:g.position.y};
    })||[];
    // Händler und Schmied mit Stand (monster-models.js), zur Welt hin gedreht wie der Ort vorgibt.
    function person(spot,role) {
      const g=NachtjagdMonsterModels.person(THREE,role),y=world.floor(spot.x,spot.z);
      g.position.set(spot.x,y,spot.z); g.rotation.y=spot.yaw??0; props.add(g); return g;
    }
    const merchantMesh=world.merchant?person(world.merchant,'merchant'):null,smithMesh=world.smith?person(world.smith,'smith'):null;
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
    const nadeMeshes=[],acidMeshes=[];
    // Partikelfeuer, Mündungsfeuer und leuchtende Vorräte (fx-items.js)
    const fireFx=NachtjagdFx.createFire(THREE,scene),muzzleFx=NachtjagdFx.createMuzzle(THREE,scene),itemKit=NachtjagdFx.itemKit(THREE);
    const MUZZLE=[new THREE.Vector3(0,.016,-.31),new THREE.Vector3(0,.015,-.75),new THREE.Vector3(0,.015,-.75)],muzzlePoint=new THREE.Vector3();
    const nadeMat=lam(0x22261d),moloMat=lam(0xb8742a),acidMat=new THREE.MeshBasicMaterial({color:0xb4ff3a}),fireMat=new THREE.MeshBasicMaterial({color:0xff7a22,transparent:true,opacity:.75});
    const boomFlash=new THREE.PointLight(0xffa24a,0,60); effects.add(boomFlash);
    // --- Umgebung: Nacht, Nebel, Schnee, Taschenlampe
    const mix=(a,b,k)=>a+(b-a)*k;
    const lights=[];
    scene.traverse(o=>{ if(o.isLight&&!o.userData.outdoor&&!o.userData.building&&!o.userData.mineLight&&o!==torch&&o!==flash&&o!==boomFlash&&!sky.owns(o)) lights.push({o,base:o.intensity}); });
    // Schneefall und Lampenkegel wie im Altay-Original (night-fx.js): kleine Flocken, die im Licht aufleuchten.
    const snowFx=NachtjagdNightFx.createSnow({THREE,scene,lamps});
    const beam=NachtjagdNightFx.createBeam({THREE,parent:camera});
    const flashInfo={position:new THREE.Vector3(),direction:new THREE.Vector3(),cosOuter:.88,cosInner:.95,on:true,k:1};
    snowFx.points.visible=false;
    let torchOn=true,indoorK=0;
    function applyEnv(s,dt) {
      const e=s.env,w=s.weather;
      // Der Verlauf von Sonnenuntergang zu tiefer, grauer Nacht folgt dem Spielfortschritt (e.dusk fällt von 1 auf 0).
      const night=1-e.dusk;
      const k=Math.max(.2,Math.min(1.25,.2+.55*e.light+e.sunrise*.4));
      // Drinnen (Burgräume) dämpft Himmelslicht und Schnee; die Innenlampen der Burg bringen eigenes Licht mit.
      const inside=world.indoor?world.indoor(s.player.x,s.player.y,s.player.z):0;
      indoorK+=(inside-indoorK)*Math.min(1,dt*4);
      if(world.tick) world.tick(s.player.x,s.player.y,s.player.z);
      const color=sky.apply({night,sunrise:e.sunrise,cover:e.cover,grey:w.fog>1.2?.25:0,blood:e.mod==='blood'&&e.sunrise<.4?.55:0,lightK:Math.max(.7,k)*(1-.7*indoorK)*(.7+.3*Math.max(night,e.sunrise))});
      scene.background=color; backdrop?.setMood(color);
      scene.fog=scene.fog||new THREE.FogExp2(color,.002);
      scene.fog.color.copy(color); scene.fog.density=.003*(1+1.1*night)*w.fog*(e.mod==='fog'?2.1:1)*(e.sunrise>0?.8:1);
      for(const l of lights) l.o.intensity=l.base*k;
      const lampBonus=(s.up.lamp+(s.relics.lamp?1:0));
      torch.intensity=torchOn?(1.05+.25*lampBonus)*(.62+.38*night):0; torch.distance=70+14*lampBonus; torch.angle=.5+.07*lampBonus;
      // Taschenlampe für Schnee und Kegel: Position und Blickrichtung der Kamera.
      camera.getWorldPosition(flashInfo.position); camera.getWorldDirection(flashInfo.direction);
      flashInfo.on=torchOn&&torch.intensity>0; flashInfo.cosOuter=Math.cos(torch.angle); flashInfo.cosInner=Math.cos(torch.angle*(1-torch.penumbra));
      flashInfo.k=.75+.12*lampBonus;
      const snowLight=(.56+.36*(1-night)+.2*e.sunrise)*(1-.5*indoorK);
      snowFx.update(camera,dt,{k:.38+.6*w.snow,light:snowLight,wind:.6+w.wind*.8,dx:.5+w.wind*.9,dz:.25*w.wind,
        opacity:(e.sunrise>.7?0:1)*(1-indoorK),scale:canvas.height*.66,flash:flashInfo});
      beam.update({on:flashInfo.on&&indoorK<.5,length:22+4*lampBonus,angle:torch.angle,strength:(.025+.03*night)*(.6+.5*Math.min(1.6,w.fog))});
    }
    function restoreEnv() {
      scene.background=sky.apply(layoutSky); backdrop?.setMood(null);
      scene.fog=null; for(const l of lights) l.o.intensity=l.base; torch.intensity=0; snowFx.points.visible=false; beam.update({on:false});
    }
    // --- Zustand
    let game=null,current=null,active=false,firing=false,aiming=false,drag=null,shotClick=false,flashT=0,hitT=0,boomT=0,clock=0,viewY=null;
    const feedLines=[];
    let noteT=0,bannerT=0;
    // --- Teamspiel (coop.js): Raum, Abgleich mit Host oder Gästen, Mitspielerfiguren
    let room=null,teamEpoch=0,guestEpoch=null,netT=0,sendT=0,team=[],teamMenu=false;
    const netQueue=[],mateMeshes=new Map(),MATE_COLORS=[0xc9a24a,0x5f9fc0,0xb5574b,0x6ea05a];
    const markerMeshes=world.objectives.map(o=>{
      const mesh=new THREE.Mesh(sealGeo,sealMat); markers.add(mesh); return {o,mesh};
    });
    const bellMesh=new THREE.Mesh(new THREE.ConeGeometry(.5,.8,8),bellMat); markers.add(bellMesh);
    const all=()=>[actors,markers,supplies,props,effects,weapon,tracer];
    function setVisible(v) { for(const g of all()) g.visible=v; vehicleLayer.setVisible(v); }
    setVisible(false);
    function say(text,seconds=4) { feedLines.push({text,t:seconds}); while(feedLines.length>4) feedLines.shift(); }
    function show(el,text,seconds,key) { el.textContent=text; el.style.opacity=1; if(key==='note') noteT=seconds; else bannerT=seconds; }
    let pendingInteract=false;
    function clearInput() { keys.clear(); firing=aiming=shotClick=pendingInteract=false; drag=null; }
    function releasePointer() { if(document.pointerLockElement===canvas) document.exitPointerLock(); }
    function lockPointer() {
      try { const result=canvas.requestPointerLock(); if(result && result.catch) result.catch(()=>{}); } catch {}
    }
    function showPanel() {
      const phase=current.phase;
      shopBox.hidden=phase!=='shop';
      panel.hidden=(phase==='playing'&&!teamMenu)||phase==='shop'||ui.mapOpen;
      title.textContent=teamMenu&&phase==='playing'?'Teamspiel läuft weiter':phase==='paused'?'Nachtjagd pausiert':phase==='won'?'Morgengrauen':phase==='dead'?(room?'Das Team ist überrannt':'Überrannt'):'Nachtjagd';
      message.textContent=teamMenu&&phase==='playing'?`Raum ${room.code} · Die Nacht geht weiter, auch während dieses Fenster offen ist.`:phase==='paused'?'Die Spielwelt wartet auf dich.':phase==='won'?'Drei Siegel gefunden und die letzte Nacht überstanden.':`Welle ${current.waves.n} · ${current.stats.kills} Gegner besiegt · ${current.stats.score} Punkte`;
      action.textContent=teamMenu&&phase==='playing'||phase==='paused'?'Weiterspielen':room?.role==='guest'?'Warte auf den Host …':'Erneut spielen';
      action.disabled=!!(room?.role==='guest'&&!(teamMenu&&phase==='playing'));
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
      ui.started(); onStart();
      clearInput(); viewY=null; world.resetNavigation?.(); teamMenu=false;
      if(room?.role==='host') teamEpoch++;
      const slot=room?.role==='guest'?(parseInt(room.id.slice(1),10)||1):0;
      game=NachtjagdGame.create({world,...options,coop:room?{role:room.role}:null,spawnShift:slot?[Math.cos(slot*2.1)*2.2,Math.sin(slot*2.1)*2.2]:null}); current=game.start(); active=true;
      document.body.classList.add('playing'); hud.hidden=false; setVisible(true); music.start();
      camera.fov=74; camera.updateProjectionMatrix(); game.setLook(Math.PI,0); current=game.snapshot();
      feedLines.length=0; say('Finde die drei Mondsiegel bei Kirche, Mine und Burg.',8); torchOn=true;
      if(room) { say(room.role==='host'?`Teamspiel · Raum ${room.code} · bis zu vier Spieler`:`Teamspiel · Raum ${room.code} · Host ${room.hostName}`,8); clearMates(); }
      for(const m of actorMeshes.values()) actors.remove(m); for(const mesh of actorMeshes.values()) mesh.userData.mat.dispose(); actorMeshes.clear();
      vehicleLayer.clear(); vehicleLayer.setStatic(NachtjagdVehicleModels.buildStatic(THREE,{world,layout:game.layout()}));
      update(0); showPanel(); lockPointer();
    }
    function leave() {
      if(room) { room.close(); room=null; team=[]; clearMates(); teamUi.reset(); }
      ui.left(); active=false; music.stop(); music.update(null,10); clearInput(); releasePointer(); hud.hidden=panel.hidden=shopBox.hidden=true;
      setVisible(false); restoreEnv();
      flash.intensity=0; document.body.classList.remove('playing'); camera.fov=48; camera.updateProjectionMatrix(); onExit();
    }
    function pause() {
      // Im Teamspiel läuft die Nacht für alle weiter: nur das Fenster öffnet sich.
      if(active && room && current.phase==='playing') { teamMenu=true; clearInput(); releasePointer(); showPanel(); return; }
      if(active && current.phase==='playing') { current=game.pause(); showPanel(); }
    }
    action.addEventListener('click',()=>{
      if(teamMenu) { teamMenu=false; clearInput(); showPanel(); lockPointer(); return; }
      if(current?.phase==='paused') { clearInput(); current=game.resume(); showPanel(); lockPointer(); }
      else if(room?.role!=='guest') start();
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
      // Im Jeep lenken nur A/D und die Pfeiltasten, die Maus schaut frei um (dreht mit dem Wagen mit).
      game.setLook(current.player.yaw-dx*.003,current.player.pitch-dy*.003);
      current.player.yaw-=dx*.003; current.player.pitch=THREE.MathUtils.clamp(current.player.pitch-dy*.003,-1.5,1.5);
    });
    addEventListener('pointerup',e=>{
      if(!active) return;
      if(e.button===2) aiming=false;
      if(e.button===0) { if(drag && drag.total<5) shotClick=true; firing=false; drag=null; }
    });
    canvas.addEventListener('pointercancel',clearInput);
    document.addEventListener('pointerlockchange',()=>{ if(active && document.pointerLockElement!==canvas) pause(); });
    const CONTROL_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyR','KeyE','KeyG','KeyT','KeyV','KeyF','KeyC','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','KeyM','KeyN','Escape'];
    addEventListener('keydown',e=>{
      if(!active || e.target.matches('input,textarea,select')) return;
      if(CONTROL_KEYS.includes(e.code)) e.preventDefault();
      if(current.phase==='shop') {
        if(e.repeat) return;
        if(e.code==='Escape'||e.code==='KeyE') { game.closeShop(); current=game.snapshot(); showPanel(); lockPointer(); }
        else if(/^Digit[1-9]$/.test(e.code)) { game.buy(Number(e.code.slice(-1))-1); current=game.snapshot(); renderShop(); }
        return;
      }
      if(e.code==='KeyM'&&!e.repeat) { ui.setMap(!ui.mapOpen); return; }
      if(e.code==='Escape'&&ui.mapOpen) { ui.setMap(false); return; }
      if(e.code==='Escape') { if(teamMenu) { teamMenu=false; showPanel(); lockPointer(); } else pause(); return; }
      if(current.phase!=='playing'||teamMenu) return;
      keys.add(e.code);
      if(e.repeat) return;
      if(e.code==='KeyR') game.reload();
      // Eine Aktion je Tastendruck; der Eingabehandler selbst führt keine Weltabfragen aus.
      if(e.code==='KeyE') pendingInteract=true;
      if(e.code==='KeyG') game.throwGrenade();
      if(e.code==='KeyT') game.throwMolotov();
      if(e.code==='KeyV') game.melee();
      if(e.code==='KeyF') torchOn=!torchOn;
      if(e.code==='KeyN') { say(music.toggleMute()?'Musik aus':'Musik an',2); syncMusic(); }
      if(e.code==='KeyC') game.changeSeat();
      if(/^Digit[123]$/.test(e.code)) game.selectWeapon(Number(e.code.slice(-1))-1);
    });
    addEventListener('keyup',e=>keys.delete(e.code));
    addEventListener('blur',pause);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
    // --- Teamspiel: Abgleich je Bild
    const hudTeam=document.createElement('div'); hudTeam.id='hud-team'; hudTeam.hidden=true; hud.append(hudTeam);
    function teamTick(dt) {
      for(const e of netQueue.splice(0)) handleNet(e);
      if(!room||!game) return;
      const p=current.player;
      const me={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,down:!!p.down,vx:p.vx,vz:p.vz,w:current.current,light:torchOn};
      if(room.role==='host') {
        const guests=[...room.guests.values()].filter(g=>g.profile).map(g=>({id:g.id,name:g.name,...g.profile}));
        game.setMates(guests);
        netT+=dt;
        if(netT>=1/12) { netT=0; room.sweep(); team=[{id:'h',name:room.name,...me},...guests]; room.broadcast({t:'world',s:game.hostState(),team,epoch:teamEpoch}); }
      } else {
        sendT+=dt; if(sendT>=1/15) { sendT=0; room.send({t:'me',p:me}); }
      }
      // Eigener Eintrag immer mit den eigenen, aktuellen Werten.
      const list=team.length?team.map(t=>t.id===room.id?{...t,...me}:t):[{id:room.id,name:room.name,...me}];
      hudTeam.hidden=false;
      hudTeam.innerHTML=`<small>Raum ${room.code}</small>`+list.map(t=>`<span class="${t.down?'down':''}">${esc(t.name)} ${t.down?'· am Boden':Math.ceil(t.hp)}</span>`).join('');
    }
    const esc=t=>String(t).replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
    // Ereignisse des eigenen Kerns, die an Host oder Gäste gehen. true: nicht weiter anzeigen.
    function teamEvent(e,outbox) {
      if(room.role==='host') {
        if(e.type==='mateHurt') { room.sendTo(e.id,{t:'hurt',damage:e.damage,melee:e.melee,kind:e.kind}); return true; }
        if(e.type==='mateReward') { room.sendTo(e.id,{t:'lei',n:e.lei,kind:e.kind}); return true; }
        if(e.type==='objective'&&e.by) room.broadcast({t:'note',text:`${e.by} hat ${e.id==='bell'?'die Glocke geläutet':e.name+' genommen'}`});
      } else if(e.type==='netHit'||e.type==='netInteract'||e.type==='netTake') { outbox.push(e); return true; }
      return false;
    }
    function handleNet(e) {
      if(!room) return;
      if(room.role==='host') {
        if(e.type==='join') { say(`${e.name} ist dem Raum beigetreten`,4); room.broadcast({t:'note',text:`${e.name} ist dabei`}); teamUi.refresh(); return; }
        if(e.type==='leave') { say(`${e.name} hat den Raum verlassen`,4); removeMate(e.id); teamUi.refresh(); return; }
        if(e.type!=='message'||!game) return;
        if(e.msg.t==='ev') for(const ev of e.msg.list) {
          if(ev.type==='netHit') game.remoteHit(ev,e.id);
          else if(ev.type==='netInteract') game.remoteInteract(ev,e.id);
          else if(ev.type==='netTake') game.remoteTake(ev.id,e.id);
        }
        return;
      }
      if(e.type==='closed') { const reason=e.reason; room=null; if(active) leave(); teamUi.status(reason); return; }
      const m=e.msg;
      if(m.t==='world') {
        // Neue Runde beim Host: auch der Gast beginnt neu.
        if(guestEpoch!==null&&m.epoch!==guestEpoch&&active) { guestEpoch=m.epoch; start(); return; }
        guestEpoch=m.epoch; team=m.team;
        if(game) { game.applyHost(m.s); current=game.snapshot(); }
      } else if(m.t==='hurt'&&game) game.applyHurt(m.damage,m.melee,m.kind);
      else if(m.t==='lei'&&game) { game.addLei(m.n); say(`Abschuss · +${Math.round(m.n)} Lei`,2); }
      else if(m.t==='note') say(m.text,4);
    }
    // --- Mitspielerfiguren: Körper, Kopf, Laterne und Namensschild; die Laterne leuchtet über das Lampenfeld.
    const mateBody=new THREE.CylinderGeometry(.27,.42,1.05,8),mateHead=new THREE.SphereGeometry(.2,10,8),mateLamp=new THREE.BoxGeometry(.14,.2,.14);
    const mateLeg=new THREE.BoxGeometry(.16,.62,.18),mateArm=new THREE.BoxGeometry(.13,.58,.14),mateBrim=new THREE.CylinderGeometry(.36,.36,.04,12),mateCrown=new THREE.CylinderGeometry(.19,.21,.2,10);
    const mateDark=lam(0x2c2a27),mateSkin=lam(0xc8a690);
    function nameTag(text) {
      const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
      g.fillStyle='rgba(12,22,26,.72)'; g.fillRect(0,8,256,48); g.fillStyle='#ede7d5'; g.font='600 30px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,33);
      const tex=new THREE.CanvasTexture(c); tex.encoding=THREE.sRGBEncoding;
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false,transparent:true})); sprite.scale.set(1.6,.4,1); sprite.position.y=2.55; return sprite;
    }
    function mateFor(t) {
      if(mateMeshes.has(t.id)) return mateMeshes.get(t.id);
      const color=MATE_COLORS[(mateMeshes.size+1)%MATE_COLORS.length],g=new THREE.Group(),figure=new THREE.Group(); g.add(figure);
      // Jäger im Mantel mit Hut, Laterne in der Hand; Mantelfarbe unterscheidet die Mitspieler.
      const coat=lam(color),body=new THREE.Mesh(mateBody,coat); body.position.y=1.1; body.castShadow=true;
      const head=new THREE.Mesh(mateHead,mateSkin); head.position.y=1.82;
      const brim=new THREE.Mesh(mateBrim,mateDark); brim.position.y=1.97; const crown=new THREE.Mesh(mateCrown,mateDark); crown.position.y=2.08;
      for(const side of [-1,1]) { const leg=new THREE.Mesh(mateLeg,mateDark); leg.position.set(side*.13,.31,0); const arm=new THREE.Mesh(mateArm,coat); arm.position.set(side*.36,1.18,.04); arm.rotation.x=side>0?-.5:-.15; figure.add(leg,arm); }
      const lantern=new THREE.Mesh(mateLamp,lam(0x3a2a14,0xffb35c)); lantern.position.set(.42,.86,.3);
      figure.add(body,head,brim,crown,lantern); g.add(nameTag(t.name)); actors.add(g);
      let lamp=null;
      if(lamps) { lamps.add({x:t.x,y:t.y+1.2,z:t.z,r:11,c:[1,.78,.5],k:.65,halo:0,kind:'mitspieler-'+t.id}); lamp=lamps.lamps[lamps.lamps.length-1]; }
      const entry={g,figure,lamp,x:t.x,y:t.y,z:t.z,yaw:t.yaw};
      mateMeshes.set(t.id,entry); return entry;
    }
    function removeMate(id) {
      const e=mateMeshes.get(id); if(!e) return;
      actors.remove(e.g); if(lamps) lamps.remove('mitspieler-'+id); mateMeshes.delete(id);
    }
    function clearMates() { for(const id of [...mateMeshes.keys()]) removeMate(id); }
    function updateMates(dt) {
      const others=team.filter(t=>t.id!==room.id),seen=new Set();
      const k=Math.min(1,dt*10);
      for(const t of others) {
        const e=mateFor(t); seen.add(t.id);
        if(Math.hypot(t.x-e.x,t.z-e.z)>12) { e.x=t.x; e.y=t.y; e.z=t.z; }
        e.x+=(t.x-e.x)*k; e.y+=(t.y-e.y)*k; e.z+=(t.z-e.z)*k; e.yaw+=Math.atan2(Math.sin(t.yaw-e.yaw),Math.cos(t.yaw-e.yaw))*k;
        e.g.position.set(e.x,e.y,e.z); e.figure.rotation.y=e.yaw;
        // Am Boden liegt die Figur.
        e.figure.rotation.z=t.down?Math.PI/2:0; e.figure.position.y=t.down?.35:0;
        if(e.lamp) { e.lamp.x=e.x; e.lamp.y=e.y+1.3; e.lamp.z=e.z; e.lamp.on=t.light!==false&&!t.down; }
      }
      for(const id of [...mateMeshes.keys()]) if(!seen.has(id)) removeMate(id);
    }
    // --- Menü: Raum eröffnen oder beitreten
    const teamUi=(()=>{
      const actions=document.querySelector('#main-menu .menu-actions'),menuPlay=document.querySelector('#menu-play');
      const open=document.createElement('button'); open.id='menu-team'; open.type='button'; open.textContent='Mit Freunden spielen'; menuPlay.after(open);
      const box=document.createElement('div'); box.id='team-panel'; box.hidden=true;
      box.innerHTML=`<label class="team-field">Dein Name<input id="team-name" maxlength="16" autocomplete="nickname"></label>
        <div class="team-choice"><button type="button" id="team-host">Neuen Raum eröffnen</button></div>
        <div class="team-or">oder mit Raumcode beitreten</div>
        <div class="team-choice team-join"><input id="team-code" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false" aria-label="Raumcode"><button type="button" id="team-join">Beitreten</button></div>
        <div id="team-room" hidden><div class="team-code-label">Raumcode</div><div id="team-code-show"></div>
          <div class="team-link"><input id="team-link" readonly aria-label="Einladungslink"><button type="button" id="team-copy">Link kopieren</button></div>
          <div id="team-members"></div><button type="button" id="team-start">Nacht beginnen</button></div>
        <p id="team-status" role="status"></p>
        <button type="button" id="team-back">Zurück</button>`;
      actions.after(box);
      const $=id=>box.querySelector('#'+id),status=t=>{$('team-status').textContent=t||'';};
      let storage=null; try { storage=localStorage; } catch(e) { storage=null; }
      try { $('team-name').value=storage?.getItem('nachtjagd-name')||''; } catch(e) { /* ohne Speicher */ }
      const name=()=>{ const n=NachtjagdCoop.cleanName($('team-name').value); try { storage?.setItem('nachtjagd-name',n); } catch(e) { /* ohne Speicher */ } return n; };
      const ready=()=>{ if(menuPlay.disabled) { status('Die Welt lädt noch … einen Moment.'); return false; } return true; };
      const busy=v=>{ for(const id of ['team-host','team-join']) $(id).disabled=v; };
      function show(v) { box.hidden=!v; actions.hidden=v; document.querySelector('#main-menu').classList.toggle('team-open',v); if(v) status(''); }
      function refresh() {
        if(!room||room.role!=='host') return;
        const names=[room.name,...[...room.guests.values()].map(g=>g.name)];
        $('team-members').textContent=`Im Raum (${names.length}/4): ${names.join(', ')}`;
      }
      open.addEventListener('click',()=>show(true));
      $('team-back').addEventListener('click',()=>{ if(room&&!active) { room.close(); room=null; } reset(); show(false); });
      $('team-host').addEventListener('click',()=>{
        if(!ready()) return;
        busy(true); status('Raum wird eröffnet …');
        // Vor dem Start zählen nur Beitritte (Liste im Menü); Positionsmeldungen werden erst im Spiel gebraucht.
        NachtjagdCoop.host({name:name(),onEvent:e=>{ if(!active&&e.type==='message') return; netQueue.push(e); if(!active) refresh(); }}).then(r=>{
          room=r; $('team-room').hidden=false; $('team-code-show').textContent=r.code;
          $('team-link').value=location.origin+location.pathname+'?raum='+r.code; refresh();
          status('Schick den Link oder den Code an deine Freunde. Wer später kommt, steigt mitten in der Nacht ein. Lass dieses Fenster während des Spiels offen und sichtbar.');
        }).catch(error=>{ busy(false); status(error.message||String(error)); });
      });
      $('team-copy').addEventListener('click',()=>{
        const field=$('team-link');
        navigator.clipboard?.writeText(field.value).then(()=>status('Link kopiert.'),()=>{ field.select(); status('Link markiert, bitte kopieren.'); }) ?? (field.select(), status('Link markiert, bitte kopieren.'));
      });
      $('team-start').addEventListener('click',()=>{ if(room&&ready()) start(); });
      $('team-join').addEventListener('click',()=>{
        if(!ready()) return;
        const code=NachtjagdCoop.cleanCode($('team-code').value);
        if(code.length!==6) { status('Der Raumcode hat sechs Zeichen.'); return; }
        busy(true); status(`Verbinde mit Raum ${code} …`);
        NachtjagdCoop.join(code,{name:name(),onEvent:e=>netQueue.push(e)}).then(r=>{ room=r; guestEpoch=null; team=[]; start(); }).catch(error=>{ busy(false); status(error.message||String(error)); });
      });
      $('team-code').addEventListener('input',()=>{ $('team-code').value=NachtjagdCoop.cleanCode($('team-code').value); });
      function reset() { busy(false); $('team-room').hidden=true; $('team-members').textContent=''; }
      const invited=NachtjagdCoop.codeFromUrl();
      if(invited) { $('team-code').value=invited; show(true); status(`Einladung in Raum ${invited}. Name eintragen und beitreten.`); }
      return {refresh,reset,status:t=>{ show(true); status(t); }};
    })();
    function update(dt) {
      if(!active) return;
      if(pendingInteract && current.phase==='playing') {
        pendingInteract=false; game.interact(); current=game.snapshot();
        if(current.phase==='shop') { showPanel(); renderShop(); releasePointer(); }
      }
      clock+=dt; music.setPaused(current.phase==='paused'||current.phase==='shop'); music.update(current,dt);
      if(current.phase==='playing') {
        const ride=current.player.ride, steering=!!(ride&&ride.driver&&(ride.kind==='jeep'||ride.kind==='boat'||ride.kind==='cart'));
        const arrows=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
        if(!steering && arrows) game.setLook(current.player.yaw-arrows*dt*2.1,current.player.pitch);
        current=game.step(dt,teamMenu||current.player.down?{}:{
          forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
          side:Math.max(-1,Math.min(1,Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+(steering?arrows:0))),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),
          jump:keys.has('Space'),fire:firing||shotClick,aim:aiming
        });
        shotClick=false;
      } else if(room&&current.phase==='shop') current=game.step(dt,{});
      if(room) { teamTick(dt); if(!active) return; }
      const p=current.player;
      const eyeY=p.y+p.eye;
      // Kleine Treppenstufen weich abfangen; Sprünge, Fahrzeuge und Versetzen bleiben direkt.
      viewY=viewY===null||!p.onGround||p.ride||Math.abs(eyeY-viewY)>1?eyeY:viewY+(eyeY-viewY)*(1-Math.exp(-dt*22));
      camera.position.set(p.x,viewY,p.z);
      camera.lookAt(p.x+Math.sin(p.yaw)*Math.cos(p.pitch),viewY+Math.sin(p.pitch),p.z+Math.cos(p.yaw)*Math.cos(p.pitch));
      const targetFov=aiming?(current.current===2?26:62):74;
      camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*12); camera.updateProjectionMatrix();
      weaponView.update(current,dt,aiming,Math.hypot(p.vx,p.vz)>.2?1:0);
      ui.update(current,dt);
      // Fahrzeuge
      vehicleLayer.update(current.vehicles,dt,clock);
      const ride=p.ride,rv=ride&&current.vehicles.find(v=>v.id===ride.id);
      weapon.visible=!(ride&&ride.driver&&ride.kind==='jeep');
      vehicleBox.hidden=!rv;
      if(rv) {
        const names=['Fahrer','Beifahrer','Hinten links','Hinten rechts'],seat=rv.kind==='gondola'?'Platz '+(ride.seat+1):rv.kind==='boat'?'Ruderer':names[ride.seat];
        const speed=Math.round(Math.abs(rv.sp)*3.6);
        let hints='C Platz wechseln · E Aussteigen';
        if(ride.driver) hints={jeep:'W/S Gas und Rückwärts · A/D lenken · Maus umsehen · Leertaste bremsen · ',cart:'W/S vor und zurück · A/D Weiche · Leertaste bremsen · ',boat:'W/S rudern (Shift schneller) · A/D lenken · '}[rv.kind]+hints;
        else if(rv.kind==='gondola') hints=rv.dock===null?'Maus umsehen · Klick schießen · C Platz · Aussteigen an der Station':'E Aussteigen · C Platz · Abfahrt in '+Math.ceil(Math.max(0,(rv.dock===0?8-rv.phase:62-rv.phase)))+' s';
        else hints='Maus und Klick schießen · '+hints;
        vehicleBox.innerHTML=`<b>${rv.name} · ${seat}${rv.kind==='gondola'?'':' · '+speed+' km/h'}</b><br><small style="color:#9fc0cc">${hints}</small>`;
      }
      // Gegner
      for(const m of current.monsters) {
        const group=actor(m),spec=ENEMIES[m.kind],d=group.userData;
        const rise=m.state==='emerge'&&!spec.air?-(1-Math.min(1,m.em/spec.emerge))*2.2*spec.scale:0;
        group.position.set(m.x,m.y+(m.lift||0)+rise,m.z); group.rotation.y=m.yaw;
        group.scale.setScalar(m.sv||1);
        if(spec.air) { const flap=Math.sin(clock*(m.kind==='bat'?24:8)+m.id)*(m.A.ph==='dive'?.2:.55); d.parts.wingL.rotation.z=flap; d.parts.wingR.rotation.z=-flap; }
        const hot=m.state==='windup'?.5:0,hurt=m.hit>0?.7:0;
        const last=d.last||(d.last={x:m.x,z:m.z,speed:0});
        last.speed+=((dt>0?Math.hypot(m.x-last.x,m.z-last.z)/dt:0)-last.speed)*Math.min(1,dt*8); last.x=m.x; last.z=m.z;
        NachtjagdMonsterModels.animate(group,dt,{speed:last.speed,state:m.A?.ph==='dive'?'dive':m.state},clock);
        d.mat.emissive.setRGB(Math.max(hurt,hot*(m.kind==='bloater'?.5+.5*Math.sin(clock*40):1)),hurt*.1,0);
      }
      for(const [id,mesh] of actorMeshes) if(!current.monsters.some(m=>m.id===id)) { mesh.userData.mat.dispose(); actors.remove(mesh); actorMeshes.delete(id); }
      // Siegel, Glocke, Beute
      relicSites.update(dt,clock,current.relics);
      markerMeshes.forEach(({o,mesh},i)=>{
        mesh.visible=!current.quest.objectives[i].found;
        mesh.position.set(o.x,world.floor(o.x,o.z)+1.5+Math.sin(clock*2)*.12,o.z); mesh.rotation.y=clock;
      });
      const bell=world.bell; bellMesh.visible=current.quest.stage==='bell'; bellMesh.position.set(bell.x,world.floor(bell.x,bell.z)+1.7,bell.z);
      lootMeshes.forEach(({l,g,baseY},i)=>{ g.visible=!current.loots[i].taken; if(l.relicId) { g.rotation.y+=dt*.65; g.position.y=baseY+Math.sin(clock*2.2+i)*.12; } });
      // Vorräte: Verbandskasten mit rotem Kreuz oder Munitionskiste, beide leuchtend; Modell wechselt mit der Art.
      current.items.forEach((item,i)=>{
        let mesh=itemMeshes[i];
        if(!mesh||mesh.userData.type!==item.type) { if(mesh) supplies.remove(mesh); mesh=item.type==='health'?itemKit.health():itemKit.ammo(); mesh.userData.type=item.type; supplies.add(mesh); itemMeshes[i]=mesh; }
        mesh.visible=item.life>8||Math.floor(item.life*4)%2===0;
        mesh.position.set(item.x,item.y+.15+Math.sin(item.t*2.4)*.08,item.z); mesh.rotation.y=item.t*1.2;
      });
      for(let i=current.items.length;i<itemMeshes.length;i++) if(itemMeshes[i]) itemMeshes[i].visible=false;
      // Wurfgeschosse, Säure, Flammen
      const sync=(list,data,make,set)=>{ while(list.length<data.length) { const m=make(); effects.add(m); list.push(m); } list.forEach((m,i)=>{ m.visible=i<data.length; if(i<data.length) set(m,data[i]); }); };
      sync(nadeMeshes,current.nades,()=>new THREE.Mesh(sphereGeo,nadeMat),(m,n)=>{ m.scale.setScalar(n.molo?.1:.12); m.material=n.molo?moloMat:nadeMat; m.position.set(n.x,n.y,n.z); });
      sync(acidMeshes,current.acids,()=>{ const m=new THREE.Mesh(sphereGeo,acidMat); m.scale.setScalar(.22); return m; },(m,a)=>m.position.set(a.x,a.y,a.z));
      fireFx.update(current.fires,clock,innerHeight*Math.min(devicePixelRatio,1.25));
      // Ereignisse
      const outbox=[];
      for(const e of game.drainEvents()) {
        if(room&&teamEvent(e,outbox)) continue;
        if(e.type==='shot') {
          flashT=.06; weaponView.kick();
          const direction=new THREE.Vector3(); camera.getWorldDirection(direction);
          const origin=camera.position.clone(),end=origin.clone().addScaledVector(direction,Math.min(80,world.rayDistance(origin,direction,80)));
          geometry.attributes.position.setXYZ(0,origin.x,origin.y-.12,origin.z); geometry.attributes.position.setXYZ(1,end.x,end.y,end.z); geometry.attributes.position.needsUpdate=true;
          if(e.hit) hitT=.15;
        }
        if(e.type==='hurt') { hud.classList.add('hurt'); setTimeout(()=>hud.classList.remove('hurt'),160); }
        if(e.type==='notice' && e.text!=='Angriff!') { say(e.text,3); if(e.detail) say(e.detail,4); if(e.wave) show(banner,e.text,3,'banner'); }
        if(e.type==='objective') say((e.by?e.by+': ':'')+(e.id==='bell'?'Glocke geläutet – überlebe 100 Sekunden.':`${e.name} gefunden · Vorräte ergänzt`),5);
        if(e.type==='down') say('Du bist am Boden. Dein Team hält die Stellung.',4);
        if(e.type==='respawn') say('Wieder auf den Beinen',3);
        if(e.type==='note') show(noteBox,`„${e.text}“`,9,'note');
        if(e.type==='relic') { say(e.text,4); if(e.detail) show(banner,e.name+' · '+e.detail,4,'banner'); }
        if(e.type==='explosion') { boomFlash.position.set(e.x,e.y,e.z); boomT=.35; }
        if(e.type==='fire') { boomFlash.position.set(e.x,e.y+1,e.z); boomT=.2; }
        if(e.type==='swing') { axe.visible=true; axe.rotation.x=-.9; axe.userData.t=.4; }
        if(e.type==='state') showPanel();
        if(e.type==='state'&&e.phase==='shop') renderShop();
        if(e.type==='buy') say(`${e.name} gekauft`,2);
        if(e.type==='kill'&&!e.by) say(`${ENEMIES[e.kind].name} erlegt${e.head?' · Kopftreffer':''}`,2);
      }
      if(room?.role==='guest'&&outbox.length) room.send({t:'ev',list:outbox});
      if(room) updateMates(dt);
      if(p.down) show(banner,`Am Boden · Wiedereinstieg in ${Math.ceil(p.downT)} s`,.4,'banner');
      if(current.phase==='shop') renderShop();
      if(axe.visible) { axe.userData.t-=dt; axe.rotation.x+=dt*5; if(axe.userData.t<=0) axe.visible=false; }
      flashT=Math.max(0,flashT-dt); hitT=Math.max(0,hitT-dt); boomT=Math.max(0,boomT-dt);
      for(const l of feedLines) l.t-=dt;
      while(feedLines.length&&feedLines[0].t<=0) feedLines.shift();
      noteT=Math.max(0,noteT-dt); if(noteT<=0) noteBox.style.opacity=0;
      bannerT=Math.max(0,bannerT-dt); if(bannerT<=0) banner.style.opacity=0;
      // Mündungsfeuer an der Laufmündung der gehaltenen Waffe
      if(flashT>0&&weapon.visible) { weapon.updateMatrixWorld(true); muzzlePoint.copy(MUZZLE[current.current]||MUZZLE[0]); weapon.localToWorld(muzzlePoint); }
      muzzleFx.show(muzzlePoint,flashT>0&&weapon.visible?flashT:0,camera);
      flash.intensity=flashT>0?2:0; boomFlash.intensity=boomT>0?4*boomT/.35:0; tracer.visible=flashT>0;
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
      objective.textContent=current.quest.stage==='final'?`Bis zum Morgengrauen: ${Math.ceil(current.waves.finalT)} s`:current.quest.stage==='bell'?'Läute die Glocke im Kirchenvorraum':`Mondsiegel ${3-remaining.length}/3 · ${remaining.map(o=>`${o.name} ${Math.round(Math.hypot(p.x-o.x,p.z-o.z))} m`).join(' · ')}`;
      const prompt=game.prompt();
      hint.textContent=prompt||'WASD · Shift laufen · Leertaste springen · Klick schießen · R nachladen · 1–3 Waffen · G Granate · T Molotow · V Axt · M Karte · N Musik · Esc Pause';
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
    return {start,options,music,update,previewUpdate,get previewGame(){return preview;},leave,get active(){return active;},get game(){return game;},get room(){return room;}};
  }
};
