'use strict';

// Kleine Lichtinseln wie im Altay-Original. Viele sichtbare Laternen, aber nur drei
// echte Lichter ohne Schatten; die nächsten Lampen teilen sich diesen festen Pool.
globalThis.NachtjagdOutdoor = {
  create({ THREE: T, scene, layout, routes, height, clearance, box, label, houses=[] }) {
    const lamps = [], batches = new Map(), dummy = new T.Object3D();
    const iron = new T.MeshLambertMaterial({ color: 0x29332e });
    const wood = new T.MeshLambertMaterial({ color: 0x46392b });
    const glass = new T.MeshBasicMaterial({ color: 0xffd08b });
    const snow = new T.MeshLambertMaterial({ color: 0xbac7c9 });
    const cube = new T.BoxGeometry(1,1,1);
    function part(mat,x,y,z,w,h,d,rotation=0) {
      if(!batches.has(mat)) batches.set(mat,[]);
      batches.get(mat).push({x,y,z,w,h,d,rotation,ground:height(x,z)});
    }
    // Bestehende Blockout-Häuser bleiben bestehen; einfache warme Fenster machen
    // ihre Fassaden nachts lesbar. Die vier separaten Hausstudien werden nicht eingesetzt.
    const frames = new T.MeshLambertMaterial({color:0x3a3028});
    houses.forEach((mesh,i)=>{
      const [x,z,w,d,rotation]=layout.houses[i],cy=mesh.position.y;
      for(const side of [-1,1]) for(const offset of [-.24,.24]) {
        const lx=offset*w,lz=side*(d/2+.045);
        const wx=x+Math.cos(rotation)*lx+Math.sin(rotation)*lz,wz=z-Math.sin(rotation)*lx+Math.cos(rotation)*lz;
        part(frames,wx,cy,wz,1.15,1.65,.14,rotation);
        const gx=wx+Math.sin(rotation)*side*.09,gz=wz+Math.cos(rotation)*side*.09;
        part(glass,gx,cy,gz,.8,1.27,.09,rotation);
        part(frames,gx+Math.sin(rotation)*side*.055,cy,gz+Math.cos(rotation)*side*.055,.06,1.3,.05,rotation);
      }
    });
    const sites = [[72,45],[105,45],[38,45],[145,45],[181,45],[0,45],[115,102],[90,25]];
    // Außerhalb des Dorfs deutlich größere Abstände und keine Lampen auf dem Viadukt.
    for(const route of routes.filter(r=>['south','lower-forest','lake-loop','east-loop','mine-west','mine-north'].includes(r.id))) {
      for(let i=1;i<route.points.length;i+=2) sites.push(route.points[i]);
    }
    for(const [x,z] of sites) {
      // Rechts neben der Fahrbahn; bei nahe gelegenen Häusern auf die andere Seite ausweichen.
      let lx=x,lz=z+(lamps.length%2?6:-6);
      const occupied=(a,b)=>layout.houses.some(h=>Math.hypot(h[0]-a,h[1]-b)<Math.max(h[2],h[3])*.65+1);
      if(occupied(lx,lz)) lz=z-(lz-z);
      if(occupied(lx,lz)||clearance(lx,lz)<.6) continue;
      const y=height(lx,lz);
      lamps.push({x:lx,y:y+4.2,z:lz});
      part(iron,lx,y+2,lz,.16,4,.16);
      part(iron,lx,y+.2,lz,.42,.4,.42);
      part(iron,lx,y+3.95,lz,.72,.14,.72);
      part(glass,lx,y+4.2,lz,.48,.55,.48);
      part(iron,lx,y+4.52,lz,.82,.16,.82);
      part(snow,lx,y+4.63,lz,.85,.07,.85);
      for(const dx of [-.29,.29]) for(const dz of [-.29,.29]) part(iron,lx+dx,y+4.2,lz+dz,.055,.55,.055);
    }
    // Offener Holzwachturm am Osttor, mit Querstreben, Brüstung und steilem Satteldach.
    const tx=191,tz=29,base=height(tx,tz),top=base+11,towerParts=[];
    for(const dx of [-2.5,2.5]) for(const dz of [-2.5,2.5]) {
      box(tx+dx,tz+dz,.48,.48,14,'landmark',0,base);
      for(const y of [base+3,base+7]) {
        part(wood,tx+dx,y,tz, .22,.22,5.5);
        part(wood,tx,y,tz+dz,5.5,.22,.22);
      }
    }
    box(tx,tz,6.2,6.2,.4,'landmark',0,top,false);
    for(const side of [-1,1]) {
      box(tx+side*2.8,tz,.18,5.8,1.1,'landmark',0,top+.4,false);
      box(tx,tz+side*2.8,5.8,.18,1.1,'landmark',0,top+.4,false);
      const roof = new T.Mesh(new T.BoxGeometry(4.35,.2,7),wood);
      roof.position.set(tx+side*1.65,top+4,tz); roof.rotation.z=-side*.78;
      roof.castShadow=true; scene.add(roof); towerParts.push({mesh:roof,y:roof.position.y});
    }
    // Schrägstreben als ein einziges instanziertes Netz.
    for(const side of [-1,1]) for(const direction of [-1,1]) {
      const brace = new T.Mesh(new T.BoxGeometry(.23,6.7,.23),wood);
      brace.position.set(tx,base+6,tz+side*2.5); brace.rotation.z=direction*.75;
      scene.add(brace); towerParts.push({mesh:brace,y:brace.position.y});
    }
    label('Wachturm · Osttor',tx,tz,20,47);
    const built=[];
    for(const [material,parts] of batches) {
      const mesh=new T.InstancedMesh(cube,material,parts.length); mesh.frustumCulled=false;
      mesh.receiveShadow=material!==glass; scene.add(mesh); built.push({mesh,parts});
    }
    const pool=Array.from({length:3},()=>{
      const light=new T.PointLight(0xffbf73,0,18,2); light.userData.outdoor=true; scene.add(light); return light;
    });
    // Transparenter radialer Lichtschein liegt auf dem Gelände, ohne weitere Lichtquellen.
    const glowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
      uniforms:{strength:{value:.28}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv; uniform float strength; void main(){float d=length(vUv-.5)*2.; gl_FragColor=vec4(1.,.59,.22,pow(max(0.,1.-d),2.)*strength);}' });
    const glows=lamps.map(l=>{
      const geo=new T.PlaneGeometry(17,17,4,4); geo.rotateX(-Math.PI/2);
      const p=geo.attributes.position;
      for(let i=0;i<p.count;i++) p.setXYZ(i,p.getX(i)+l.x,height(p.getX(i)+l.x,p.getZ(i)+l.z)+.12,p.getZ(i)+l.z);
      geo.computeBoundingSphere(); const m=new T.Mesh(geo,glowMaterial); scene.add(m); return m;
    });
    function refresh() {
      for(const p of towerParts) p.mesh.position.y=p.y+height(tx,tz)-base;
      for(const {mesh,parts} of built) {
        parts.forEach((p,i)=>{
          dummy.position.set(p.x,p.y+height(p.x,p.z)-p.ground,p.z);
          dummy.scale.set(p.w,p.h,p.d); dummy.rotation.set(0,p.rotation,0); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
        }); mesh.instanceMatrix.needsUpdate=true;
      }
      for(const l of lamps) l.y=height(l.x,l.z)+4.2;
      // Bei Geländeänderungen den Lichtschein neu auf die gleichen x/z-Punkte legen.
      for(const m of glows) { const p=m.geometry.attributes.position; for(let i=0;i<p.count;i++) p.setY(i,height(p.getX(i),p.getZ(i))+.12); p.needsUpdate=true; m.geometry.computeBoundingSphere(); }
    }
    function update(camera,night=1,indoor=0) {
      const p=camera.position,order=lamps.map(l=>({l,d:(l.x-p.x)**2+(l.z-p.z)**2})).sort((a,b)=>a.d-b.d);
      pool.forEach((light,i)=>{
        const target=order[i];
        light.intensity=target&&target.d<48*48?(1.3+night*.9)*(1-indoor):0;
        if(target) light.position.set(target.l.x,target.l.y,target.l.z);
      });
      glowMaterial.uniforms.strength.value=.16+.32*night;
    }
    refresh();
    return {lamps,pool,refresh,update,tower:{x:tx,z:tz,top}};
  }
};
