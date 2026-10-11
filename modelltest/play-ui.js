'use strict';

// Darstellung und Orientierung; Waffenwerte und Spielfortschritt kommen ausschließlich aus dem Kern.
globalThis.NachtjagdInterface = (() => {
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function targetFor(s, selected) {
    const remaining = s.quest.objectives.filter(o => !o.found);
    const choices = s.quest.stage === 'seals' ? remaining : s.quest.stage === 'bell' && s.quest.bell ? [{...s.quest.bell,id:'bell',name:'Glocke'}] : [];
    return choices.find(o => o.id === selected) || choices.reduce((best, o) => !best || Math.hypot(o.x-s.player.x,o.z-s.player.z)<Math.hypot(best.x-s.player.x,best.z-s.player.z) ? o : best, null);
  }
  const heading = yaw => (180-yaw*180/Math.PI+720)%360;
  function weapon(T) {
    const group = new T.Group(), models = [], metal = new T.MeshStandardMaterial({color:0x606b70,metalness:.75,roughness:.32});
    const dark = new T.MeshStandardMaterial({color:0x20272b,metalness:.65,roughness:.42}), wood = new T.MeshStandardMaterial({color:0x704c32,roughness:.8});
    const brass = new T.MeshStandardMaterial({color:0xc5a264,metalness:.7,roughness:.3}), glass = new T.MeshStandardMaterial({color:0x24545b,metalness:.5,roughness:.14});
    function box(g, mat, x,y,z, sx,sy,sz, angle=0) {
      const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.rotation.x=angle;g.add(m);return m;
    }
    function tube(g,mat,x,y,z,r,length) {
      const m=new T.Mesh(new T.CylinderGeometry(r,r,length,12),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;
    }
    for(let i=0;i<3;i++) {
      const g=new T.Group();group.add(g);models.push(g);g.name=['Revolver','Schrotflinte','Jagdgewehr'][i];
      if(i===0) {
        tube(g,metal,0,.012,-.21,.027,.28);tube(g,dark,0,.012,-.352,.019,.008);
        box(g,metal,0,-.04,-.075,.085,.09,.21);box(g,wood,0,-.145,.025,.065,.17,.095,-.3);
        tube(g,dark,0,-.017,-.075,.06,.105);
        for(let n=0;n<6;n++){const a=n*Math.PI/3;tube(g,metal,Math.sin(a)*.05,-.017+Math.cos(a)*.05,-.075,.012,.11);tube(g,brass,Math.sin(a)*.037,-.017+Math.cos(a)*.037,-.014,.009,.005);}
        box(g,dark,0,.045,-.33,.008,.022,.022);box(g,dark,0,.05,-.005,.045,.015,.012);
      } else {
        box(g,wood,0,-.03,.105,.075,.13,.34,-.1);box(g,metal,0,0,-.14,.085,.085,.25);
        tube(g,metal,0,.015,-.48,.025,.48);tube(g,dark,0,.015,-.724,.018,.008);
        if(i===1){tube(g,dark,0,-.035,-.45,.022,.35);box(g,wood,0,-.033,-.43,.085,.08,.21);for(let k=0;k<5;k++)box(g,dark,0,-.033,-.35-k*.035,.087,.082,.007);box(g,brass,.046,.008,-.12,.004,.024,.065);}
        else {tube(g,dark,0,.12,-.18,.039,.23);tube(g,glass,0,.12,-.3,.03,.005);box(g,dark,0,.065,-.17,.025,.05,.13);tube(g,metal,.065,-.015,-.11,.01,.055);box(g,metal,.065,-.02,-.077,.015,.06,.015);}
        box(g,dark,0,.047,-.69,.009,.025,.024);
      }
      // Abzug und Bügel sind auch bei der Nahansicht erkennbar.
      box(g,dark,0,-.103,-.04,.012,.05,.012,.3);box(g,metal,0,-.14,-.06,.02,.014,.09);box(g,metal,0,-.11,-.102,.02,.065,.012);
      g.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.renderOrder=20;}});
    }
    // Eine schwache Kameraleuchte hält die Waffe in der Nacht lesbar.
    const light=new T.PointLight(0xb4c7d7,.35,1.8);light.position.set(-.2,.2,.2);group.add(light);
    let recoil=0,time=0;
    return {group,kick(){recoil=1;},update(s,dt,aiming,moving){
      time+=dt;recoil*=Math.exp(-dt*13);models.forEach((m,i)=>m.visible=i===s.current);
      const w=s.weapons[s.current],reload=w.reloading>0?Math.sin(Math.min(1,w.reloading/w.reload)*Math.PI):0;
      group.position.set(aiming?.045:.23,-.22-reload*.16+Math.sin(time*9)*.008*moving,-.38+recoil*.09);
      group.rotation.set(recoil*.15+reload*.65,0,-reload*.24+Math.cos(time*4.5)*.008*moving);
    }};
  }
  function create({world,onPlay,onLayout,onMap}) {
    const menu=document.querySelector('#main-menu'),map=document.querySelector('#world-map'),hud=document.querySelector('#game-hud');
    const q=id=>document.getElementById(id);
    let latest=null,selected=null,mapOpen=false,mapPaused=false,lastDraw=-1;
    const layout=NachtjagdLayout,routes=NachtjagdRoadLayout({height:layout.naturalHeight,castle:layout.castle}).routes;
    const ctx=q('map-canvas').getContext('2d'),back=document.createElement('canvas');back.width=back.height=720;
    const b=back.getContext('2d'),px=x=>(x+600)/1200*720,pz=z=>(z+550)/1100*720;
    // Der Kartenhintergrund wird einmal aus derselben Weltbeschreibung gezeichnet.
    for(let z=0;z<720;z+=6)for(let x=0;x<720;x+=6){const wx=x/720*1200-600,wz=z/720*1100-550,h=layout.naturalHeight(wx,wz),water=layout.lakeDistance(wx,wz)<0;
      b.fillStyle=water?'#365560':h>185?'#9e9e8b':h>115?'#777f70':layout.forestWeight(wx,wz)>.25?'#334b42':'#596357';b.fillRect(x,z,6,6);}
    b.strokeStyle='#c5b78e';b.lineWidth=2;for(const r of routes){b.beginPath();r.points.forEach(([x,z],i)=>i?b.lineTo(px(x),pz(z)):b.moveTo(px(x),pz(z)));b.stroke();}
    b.fillStyle='#cfb88e';for(const h of layout.houses)b.fillRect(px(h[0])-2,pz(h[1])-2,4,4);
    const places=[...world.objectives,...(world.jeeps||[]).map(j=>({...j,name:'Jeep'})),...layout.mines.map(m=>({x:m.a[0],z:m.a[1],name:'Mine'})),{x:layout.village.x,z:layout.village.z,name:'Dorf'},{x:-280,z:245,name:'See'}];
    b.font='14px system-ui';b.textAlign='center';for(const p of places){b.fillStyle='#eee4c9';b.beginPath();b.arc(px(p.x),pz(p.z),3,0,Math.PI*2);b.fill();b.fillText(p.name,px(p.x),pz(p.z)-9);}
    function setMap(value){
      if(!latest||value===mapOpen)return;
      if(value&&!['playing','paused'].includes(latest.phase))return;
      mapOpen=value;map.hidden=!value;mapPaused=onMap(value,mapPaused);if(value){drawMap();q('map-close').focus();}
    }
    function drawMap(){
      if(!latest)return;ctx.drawImage(back,0,0);const p=latest.player,t=targetFor(latest,selected);
      for(const o of latest.quest.objectives){ctx.strokeStyle=o.found?'#76ac91':'#f0ce87';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(o.x),pz(o.z),o.id===t?.id?10:6,0,Math.PI*2);ctx.stroke();}
      ctx.save();ctx.translate(px(p.x),pz(p.z));ctx.rotate(heading(p.yaw)*Math.PI/180);ctx.fillStyle='#fff6db';ctx.strokeStyle='#182b2c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    q('menu-play').addEventListener('click',onPlay);
    q('menu-layout').addEventListener('click',()=>{menu.hidden=true;document.body.classList.remove('in-menu');onLayout();});
    q('menu-back').addEventListener('click',()=>{menu.hidden=false;document.body.classList.add('in-menu');});
    q('map-close').addEventListener('click',()=>setMap(false));
    document.addEventListener('keydown',e=>{if(!menu.hidden&&e.code==='Escape'){menu.hidden=true;document.body.classList.remove('in-menu');}});
    function update(s,dt){
      latest=s;const p=s.player,w=s.weapons[s.current],target=targetFor(s,selected),done=s.quest.objectives.filter(o=>o.found).length;
      q('hud-health').textContent=Math.ceil(p.hp);q('hud-healthbar').style.width=Math.max(0,p.hp/p.maxHp*100)+'%';hud.classList.toggle('low-health',p.hp<30);
      q('hud-ammo').textContent=String(w.ammo).padStart(2,'0');q('hud-reserve').textContent='/ '+w.reserve;q('hud-weapon').textContent=w.name;
      q('hud-reload').hidden=w.reloading<=0;q('hud-reload-progress').value=1-w.reloading/w.reload;
      q('hud-wave').textContent='WELLE '+s.waves.n;q('hud-points').textContent=s.stats.score+' PUNKTE';
      q('hud-supplies').textContent=`${s.stats.lei} Lei   ·   G ${p.gren}   ·   T ${p.molo}`;
      q('hud-quest').textContent=s.quest.stage==='final'?'HALTE DURCH BIS ZUM MORGENGRAUEN':s.quest.stage==='bell'?'LÄUTE DIE GLOCKE':'FINDE DIE DREI MONDSIEGEL';
      q('hud-seals').textContent=s.quest.stage==='final'?Math.ceil(s.waves.finalT)+' s':done+' / 3';
      q('hud-target').textContent=target?target.name+' · '+Math.round(Math.hypot(target.x-p.x,target.z-p.z))+' m':'Überlebe die letzte Nacht';
      q('hud-bearing').textContent=Math.round(heading(p.yaw))+'°';
      q('hud-arrow').hidden=!target;if(target)q('hud-arrow').style.transform=`rotate(${-wrap(Math.atan2(target.x-p.x,target.z-p.z)-p.yaw)*180/Math.PI}deg)`;
      q('hud-directions').innerHTML=['N','O','S','W'].map((label,i)=>{const bearing=Math.PI-i*Math.PI/2,dx=-wrap(bearing-p.yaw)*140;return Math.abs(dx)<145?`<span style="left:calc(50% + ${dx}px)">${label}</span>`:'';}).join('');
      q('hud-slots').textContent=s.weapons.map((a,i)=>(i===s.current?'▸ ':'')+(i+1)+' '+(a.owned?a.name:'🔒')).join('   ');
      if(mapOpen&&s.time-lastDraw>.1){drawMap();lastDraw=s.time;}
    }
    const targetButtons=q('map-targets');world.objectives.forEach(o=>{const button=document.createElement('button');button.textContent=o.name;button.addEventListener('click',()=>{selected=o.id;for(const b of targetButtons.children)b.setAttribute('aria-pressed',String(b===button));if(latest){update(latest,0);drawMap();}});button.setAttribute('aria-pressed','false');targetButtons.append(button);});
    return {update,setMap,get mapOpen(){return mapOpen;},started(){mapOpen=false;mapPaused=false;map.hidden=menu.hidden=true;document.body.classList.remove('in-menu');},left(){mapOpen=false;map.hidden=true;menu.hidden=false;document.body.classList.add('in-menu');},showMenu(){menu.hidden=false;document.body.classList.add('in-menu');}};
  }
  return {weapon,create,targetFor,heading};
})();
