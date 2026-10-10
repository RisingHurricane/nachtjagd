'use strict';

// Verbindet den ausgelagerten Spielkern mit der bestätigten Weltstudie.
globalThis.NachtjagdPlay = {
  create({THREE,scene,camera,canvas,world,onStart,onExit}) {
    const hud=document.querySelector('#game-hud'),panel=document.querySelector('#game-panel');
    const title=document.querySelector('#game-title'),message=document.querySelector('#game-message');
    const action=document.querySelector('#game-action'),exit=document.querySelector('#game-exit');
    const score=document.querySelector('#game-score'),objective=document.querySelector('#game-objective');
    const hint=document.querySelector('#game-hint'),feed=document.querySelector('#game-feed');
    const actors=new THREE.Group(),markers=new THREE.Group(),supplies=new THREE.Group();
    scene.add(actors,markers,supplies);
    const actorMeshes=new Map(),keys=new Set(),itemMeshes=[];
    const bodyGeo=new THREE.CylinderGeometry(.38,.5,1.25,7),headGeo=new THREE.IcosahedronGeometry(.3,0);
    const bodyMat=new THREE.MeshLambertMaterial({color:0x714d56}),headMat=new THREE.MeshLambertMaterial({color:0xc8a8a0});
    const sealGeo=new THREE.OctahedronGeometry(.65),sealMat=new THREE.MeshLambertMaterial({color:0x77dce8,emissive:0x154857});
    const bellMat=new THREE.MeshLambertMaterial({color:0xe4ba61,emissive:0x523919});
    const itemGeo=new THREE.BoxGeometry(.7,.5,.7),ammoMat=new THREE.MeshLambertMaterial({color:0xddae61}),healthMat=new THREE.MeshLambertMaterial({color:0x93c7a3});
    const barrel=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,.32),new THREE.MeshLambertMaterial({color:0x3d4549}));
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.05,.11,.065),new THREE.MeshLambertMaterial({color:0x795b42}));
    const weapon=new THREE.Group(); barrel.position.z=-.12; grip.position.set(0,-.07,.02); weapon.add(barrel,grip);
    weapon.position.set(.2,-.2,-.4); camera.add(weapon); scene.add(camera);
    const flash=new THREE.PointLight(0xffc16b,0,12); camera.add(flash);
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffdf9a})); scene.add(tracer);
    let game=null,current=null,active=false,firing=false,aiming=false,drag=null,shotClick=false,flashT=0,hitT=0,feedT=0,clock=0;
    const markerMeshes=world.objectives.map(o=>{
      const mesh=new THREE.Mesh(sealGeo,sealMat); markers.add(mesh); return {o,mesh};
    });
    const bellMesh=new THREE.Mesh(new THREE.ConeGeometry(.5,.8,8),bellMat); markers.add(bellMesh);
    actors.visible=markers.visible=supplies.visible=weapon.visible=tracer.visible=false;
    function clearInput() { keys.clear(); firing=aiming=shotClick=false; drag=null; }
    function releasePointer() { if(document.pointerLockElement===canvas) document.exitPointerLock(); }
    function lockPointer() {
      try { const result=canvas.requestPointerLock(); if(result && result.catch) result.catch(()=>{}); } catch {}
    }
    function showPanel() {
      const phase=current.phase;
      panel.hidden=phase==='playing';
      title.textContent=phase==='paused'?'Nachtjagd pausiert':phase==='won'?'Morgengrauen':phase==='dead'?'Überrannt':'Nachtjagd';
      message.textContent=phase==='paused'?'Die Spielwelt wartet auf dich.':phase==='won'?'Drei Siegel gefunden und die letzte Nacht überstanden.':`Welle ${current.waves.n} · ${current.stats.kills} Gegner besiegt · ${current.stats.score} Punkte`;
      action.textContent=phase==='paused'?'Weiterspielen':'Erneut spielen';
      if(phase!=='playing') { clearInput(); releasePointer(); }
    }
    function start() {
      onStart();
      clearInput(); world.resetNavigation?.(); game=NachtjagdGame.create({world}); current=game.start(); active=true;
      document.body.classList.add('playing'); hud.hidden=false; actors.visible=markers.visible=supplies.visible=weapon.visible=true;
      camera.fov=74; camera.updateProjectionMatrix(); game.setLook(Math.PI,0); current=game.snapshot();
      feed.textContent='Finde die drei Mondsiegel bei Kirche, Mine und Burg.'; feedT=8;
      update(0); showPanel(); lockPointer();
    }
    function leave() {
      active=false; clearInput(); releasePointer(); hud.hidden=panel.hidden=true;
      actors.visible=markers.visible=supplies.visible=weapon.visible=tracer.visible=false;
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
      game.setLook(current.player.yaw-dx*.003,current.player.pitch-dy*.003); current=game.snapshot();
    });
    addEventListener('pointerup',e=>{
      if(!active) return;
      if(e.button===2) aiming=false;
      if(e.button===0) { if(drag && drag.total<5) shotClick=true; firing=false; drag=null; }
    });
    canvas.addEventListener('pointercancel',clearInput);
    document.addEventListener('pointerlockchange',()=>{ if(active && document.pointerLockElement!==canvas) pause(); });
    addEventListener('keydown',e=>{
      if(!active || e.target.matches('input,textarea,select')) return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR','KeyE','Digit1','Digit2','Digit3','Escape'].includes(e.code)) e.preventDefault();
      if(e.code==='Escape') { pause(); return; }
      if(current.phase!=='playing') return;
      keys.add(e.code);
      if(e.repeat) return;
      if(e.code==='KeyR') game.reload();
      if(e.code==='KeyE') game.interact();
      if(/^Digit[123]$/.test(e.code)) game.selectWeapon(Number(e.code.slice(-1))-1);
    });
    addEventListener('keyup',e=>keys.delete(e.code));
    addEventListener('blur',pause);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
    function actor(m) {
      if(actorMeshes.has(m.id)) return actorMeshes.get(m.id);
      const group=new THREE.Group(),body=new THREE.Mesh(bodyGeo,bodyMat.clone()),head=new THREE.Mesh(headGeo,headMat);
      body.position.y=.85; head.position.y=1.65; body.castShadow=head.castShadow=true;
      group.add(body,head); actors.add(group); actorMeshes.set(m.id,group); return group;
    }
    function update(dt) {
      if(!active) return;
      clock+=dt;
      if(current.phase==='playing') {
        if(keys.has('ArrowLeft') || keys.has('ArrowRight')) game.setLook(current.player.yaw+(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*2.1,current.player.pitch);
        current=game.step(dt,{
          forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
          side:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),fire:firing||shotClick,aim:aiming
        });
        shotClick=false;
      }
      const p=current.player;
      camera.position.set(p.x,p.y+1.75,p.z);
      camera.lookAt(p.x+Math.sin(p.yaw)*Math.cos(p.pitch),p.y+1.75+Math.sin(p.pitch),p.z+Math.cos(p.yaw)*Math.cos(p.pitch));
      const targetFov=aiming?(current.current===2?26:62):74;
      camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*12); camera.updateProjectionMatrix();
      for(const m of current.monsters) {
        const group=actor(m); group.position.set(m.x,m.y,m.z); group.rotation.y=Math.atan2(p.x-m.x,p.z-m.z);
        group.children[0].material.color.setHex(m.wind>0?0xb95244:m.kind==='wolf'?0x5b6473:m.kind==='lycan'?0x645a42:0x714d56);
      }
      for(const [id,mesh] of actorMeshes) if(!current.monsters.some(m=>m.id===id)) { actors.remove(mesh); mesh.children[0].material.dispose(); actorMeshes.delete(id); }
      markerMeshes.forEach(({o,mesh},i)=>{
        mesh.visible=!current.quest.objectives[i].found;
        mesh.position.set(o.x,world.floor(o.x,o.z)+1.5+Math.sin(clock*2)*.12,o.z); mesh.rotation.y=clock;
      });
      const bell=world.bell; bellMesh.visible=current.quest.stage==='bell'; bellMesh.position.set(bell.x,world.floor(bell.x,bell.z)+1.7,bell.z);
      while(itemMeshes.length<current.items.length) { const mesh=new THREE.Mesh(itemGeo,ammoMat); supplies.add(mesh); itemMeshes.push(mesh); }
      itemMeshes.forEach((mesh,i)=>{
        const item=current.items[i]; mesh.visible=Boolean(item); if(!item) return;
        mesh.material=item.type==='health'?healthMat:ammoMat; mesh.position.set(item.x,world.floor(item.x,item.z)+.45,item.z);
      });
      for(const e of game.drainEvents()) {
        if(e.type==='shot') {
          flashT=.06; weapon.position.z=-.34;
          const direction=new THREE.Vector3(); camera.getWorldDirection(direction);
          const origin=camera.position.clone(),end=origin.clone().addScaledVector(direction,Math.min(80,world.rayDistance(origin,direction,80)));
          geometry.attributes.position.setXYZ(0,origin.x,origin.y-.12,origin.z); geometry.attributes.position.setXYZ(1,end.x,end.y,end.z); geometry.attributes.position.needsUpdate=true;
          if(e.hit) hitT=.15;
        }
        if(e.type==='hurt') { hud.classList.add('hurt'); setTimeout(()=>hud.classList.remove('hurt'),160); }
        if(e.type==='notice' && e.text!=='Angriff!') { feed.textContent=e.text; feedT=3; }
        if(e.type==='objective') { feed.textContent=e.id==='bell'?'Glocke geläutet – überlebe 100 Sekunden.':`${e.name} gefunden · Vorräte ergänzt`; feedT=5; }
        if(e.type==='state') showPanel();
      }
      flashT=Math.max(0,flashT-dt); hitT=Math.max(0,hitT-dt); feedT=Math.max(0,feedT-dt);
      flash.intensity=flashT>0?2:0; tracer.visible=flashT>0; weapon.position.z+=(-.4-weapon.position.z)*Math.min(1,dt*15);
      hud.classList.toggle('hit',hitT>0); feed.hidden=feedT<=0;
      const w=current.weapons[current.current];
      score.textContent=`Leben ${Math.ceil(p.hp)} · ${w.name} ${w.ammo}/${w.reserve}${w.reloading>0?' · Nachladen …':''} · Welle ${current.waves.n} · ${current.stats.score} Punkte`;
      const remaining=current.quest.objectives.filter(o=>!o.found);
      objective.textContent=current.quest.stage==='final'?`Bis zum Morgengrauen: ${Math.ceil(current.waves.finalT)} s`:current.quest.stage==='bell'?'Läute die Glocke vor der Kirche':`Mondsiegel ${3-remaining.length}/3 · ${remaining.map(o=>`${o.name} ${Math.round(Math.hypot(p.x-o.x,p.z-o.z))} m`).join(' · ')}`;
      const nearby=current.quest.stage==='bell'?[bell]:remaining;
      hint.textContent=nearby.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<3.2)?'E · Aufnehmen / Glocke läuten':'WASD · Shift laufen · Maus umsehen · Klick schießen · R nachladen · 1–3 Waffen · Esc Pause';
      const report=document.querySelector('#game-tests');
      if(report) report.textContent=JSON.stringify({phase:current.phase,player:p,wave:current.waves.n,monsters:current.monsters.length,ammo:w.ammo,checks:world.checks},null,2);
    }
    return {start,update,leave,get active(){return active;}};
  }
};
