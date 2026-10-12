'use strict';

// Begehbare Dorfmauer mit gemeinsamem Instancing je Material.
(function(root) {
  function create({THREE,scene,walls,heightAt,village={x:0,z:0},houses=[]}) {
    const WALL_WIDTH=2.9,WALL_HEIGHT=4.8,STAIR_WIDTH=1.55,STEP_MAX=.2;
    const decks=[],stairs=[],endCaps=[],parts={stone:[],deck:[],stairs:[]},meshes=[];
    let deckCells=new Map(),treadCells=new Map(),capCells=new Map(),worldBounds=null;
    const point=(seg,t)=>({x:seg.a[0]+(seg.b[0]-seg.a[0])*t,z:seg.a[1]+(seg.b[1]-seg.a[1])*t});
    const segmentInfo=walls.map(([a,b],id)=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      return {id,a,b,dx,dz,length,cos:dx/length,sin:dz/length,rotation:-Math.atan2(dz,dx)};
    }).filter(s=>s.length>1);
    const height=(x,z)=>Number(heightAt(x,z))||0;
    const deckHeight=(seg,t)=>height(...seg.a)+(height(...seg.b)-height(...seg.a))*t+WALL_HEIGHT;
    const add=(bucket,x,y,z,length,h,width,rotation,pitch=0)=>parts[bucket].push({x,y,z,length,h,width,rotation,pitch});
    const cellSize=24,key=(x,z)=>`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;
    function indexItems(items,boundsOf) {
      const map=new Map();
      for(const item of items) {
        const b=boundsOf(item),x0=Math.floor(b.x0/cellSize),x1=Math.floor(b.x1/cellSize),z0=Math.floor(b.z0/cellSize),z1=Math.floor(b.z1/cellSize);
        for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++) {
          const k=`${x},${z}`;if(!map.has(k))map.set(k,[]);map.get(k).push(item);
        }
      }
      return map;
    }
    const cell=(map,x,z)=>map.get(key(x,z))||[];
    function boundsForOriented(p,length,width,pad=0) {
      const halfL=length/2,halfW=width/2,c=p.cos,s=p.sin;
      const xs=[p.x+c*halfL-s*halfW,p.x+c*halfL+s*halfW,p.x-c*halfL-s*halfW,p.x-c*halfL+s*halfW];
      const zs=[p.z+s*halfL+c*halfW,p.z+s*halfL-c*halfW,p.z-s*halfL+c*halfW,p.z-s*halfL-c*halfW];
      return {x0:Math.min(...xs)-pad,x1:Math.max(...xs)+pad,z0:Math.min(...zs)-pad,z1:Math.max(...zs)+pad};
    }
    const local=(seg,t,side=0)=>{
      const p=point(seg,t),nx=-seg.sin,nz=seg.cos;
      return {x:p.x+nx*side,z:p.z+nz*side};
    };
    function accessFor(seg,t) {
      const wall=point(seg,t),nx=-seg.sin,nz=seg.cos,dot=(v)=>(v.x-wall.x)*nx+(v.z-wall.z)*nz;
      const side=dot(village)>=0?1:-1,wallY=deckHeight(seg,t);
      let best=null;
      for(let run=11;run<=16;run++) {
        const start={x:wall.x+nx*side*run,z:wall.z+nz*side*run},rise=wallY-height(start.x,start.z);
        if(rise<1.5)continue;
        const score=Math.abs(rise-4.8);
        if(!best||score<best.score)best={wall,start,run,side,rise,score};
      }
      return best;
    }
    function houseClear(access) {
      if(!houses.length)return 0;
      const {wall,start}=access;
      let penalty=0;
      for(let i=0;i<=12;i++) {
        const q=i/12,x=start.x+(wall.x-start.x)*q,z=start.z+(wall.z-start.z)*q;
        for(const h of houses) {
          if(h.bounds) {
            const dx=Math.max(h.bounds.x0-x,0,x-h.bounds.x1),dz=Math.max(h.bounds.z0-z,0,z-h.bounds.z1);
            if(Math.hypot(dx,dz)<STAIR_WIDTH*.6)penalty+=STAIR_WIDTH*.6-Math.hypot(dx,dz)+.1;
            continue;
          }
          const hx=Array.isArray(h)?h[0]:h.x,hz=Array.isArray(h)?h[1]:h.z;
          const hw=Array.isArray(h)?h[2]||7:h.w||7,hd=Array.isArray(h)?h[3]||7:h.d||7;
          const clearance=Math.hypot(x-hx,z-hz)-Math.max(hw,hd)*.55-STAIR_WIDTH*.6;
          if(clearance<0)penalty+=Math.abs(clearance)+.1;
        }
      }
      return penalty;
    }
    function selectStairs() {
      const chosen=[];
      for(const side of [-1,1]) {
        const candidates=segmentInfo.filter(s=>((s.a[1]+s.b[1])/2-village.z)*side<0 && Math.abs(s.dz)/s.length<.68 && s.length>22);
        candidates.sort((a,b)=>b.length-a.length);
        const reserved=[];
        for(let n=0;n<2;n++) {
          let best=null;
          for(const seg of candidates) {
            if(reserved.includes(seg))continue;
            for(const t of [.32,.5,.68]) {
              const access=accessFor(seg,t);if(!access)continue;
              const p=access.wall,avoid=houseClear(access);
              const score=Math.abs(access.rise-4.8)*2+avoid*20+Math.max(0,30-seg.length)+reserved.reduce((v,r)=>v+Math.max(0,12-Math.hypot(p.x-point(r,.5).x,p.z-point(r,.5).z))*2,0);
              if(!best||score<best.score)best={seg,t,access,score};
            }
          }
          if(!best)break;
          reserved.push(best.seg);chosen.push(best);
        }
      }
      return chosen;
    }
    function resetPlan() {
      decks.splice(0);stairs.splice(0);endCaps.splice(0);
      for(const key of Object.keys(parts))parts[key].splice(0);
      const stairPicks=selectStairs();
      for(const seg of segmentInfo) {
        const yA=height(seg.a[0],seg.a[1])+WALL_HEIGHT,yB=height(seg.b[0],seg.b[1])+WALL_HEIGHT;
        const deck={id:seg.id,a:{x:seg.a[0],z:seg.a[1]},b:{x:seg.b[0],z:seg.b[1]},length:seg.length,width:WALL_WIDTH,yA,yB,rotation:seg.rotation,cos:seg.cos,sin:seg.sin};
        decks.push(deck);
        const count=Math.ceil(seg.length/3.2),partLength=seg.length/count;
        for(let i=0;i<count;i++) {
          const t=(i+.5)/count,p=point(seg,t),ground=height(p.x,p.z),top=yA+(yB-yA)*t;
          const pitch=Math.atan2(yB-yA,seg.length);
          add('stone',p.x,(ground+top-.28)/2,p.z,partLength+.025,Math.max(.1,top-ground-.28),WALL_WIDTH,seg.rotation,pitch);
          add('deck',p.x,top-.14,p.z,partLength+.06,.28,WALL_WIDTH,seg.rotation,pitch);
        }
        const portals=stairPicks.filter(p=>p.seg===seg).map(p=>({center:p.t*seg.length,half:(STAIR_WIDTH+.4)/2}));
        const railCuts=(start,end)=>{
          const cuts=[start,end];
          for(const portal of portals) {cuts.push(Math.max(start,portal.center-portal.half),Math.min(end,portal.center+portal.half));}
          cuts.sort((a,b)=>a-b);
          for(let i=0;i<cuts.length-1;i++) {
            const a=cuts[i],b=cuts[i+1];if(b-a<.08)continue;
            const center=(a+b)/2;
            if(portals.some(p=>Math.abs(center-p.center)<p.half-.01))continue;
            const count=Math.ceil((b-a)/3.2),size=(b-a)/count;
            for(let j=0;j<count;j++) {
              const d=a+(j+.5)*size,t=d/seg.length,p=point(seg,t),top=yA+(yB-yA)*t,pitch=Math.atan2(yB-yA,seg.length);
              for(const side of [-1,1]) {
                const edge=local(seg,t,side*(WALL_WIDTH/2-.18));
                add('stone',edge.x,top+.47,edge.z,size+.025,.94,.36,seg.rotation,pitch);
              }
            }
          }
        };
        railCuts(0,seg.length);
        for(let d=0;d<seg.length;d+=1.65) {
          const t=Math.min(.99,(d+.5)/seg.length),p=point(seg,t),top=yA+(yB-yA)*t;
          if(portals.some(c=>Math.abs(d+.5-c.center)<c.half+.4))continue;
          for(const side of [-1,1]) {
            const edge=local(seg,t,side*(WALL_WIDTH/2-.18));
            add('stone',edge.x,top+1.13,edge.z,.72,.42,.4,seg.rotation);
          }
        }
      }
      for(const pick of stairPicks) {
        const seg=pick.seg,center=pick.access.wall,start=pick.access.start;
        const y0=height(start.x,start.z),y1=deckHeight(seg,pick.t),rise=Math.max(.1,y1-y0),count=Math.max(24,Math.ceil(rise/STEP_MAX));
        const dx=center.x-start.x,dz=center.z-start.z,length=Math.hypot(dx,dz),cos=dx/length,sin=dz/length,rotation=-Math.atan2(dz,dx),treadLength=length/count;
        const stair={wallId:seg.id,start,end:{x:center.x,z:center.z},run:length,width:STAIR_WIDTH,y0,y1,rise,count,rotation,cos,sin,treads:[]};
        for(let i=0;i<count;i++) {
          const t=(i+.5)/count,x=start.x+dx*t,z=start.z+dz*t,top=y0+rise*(i+1)/count,previous=y0+rise*i/count;
          const tread={x,z,length:treadLength,width:STAIR_WIDTH,top,previous,rotation,cos,sin};
          stair.treads.push(tread);
          add('stairs',x,(top+y0)/2,z,treadLength+.025,top-y0,STAIR_WIDTH,rotation);
        }
        stairs.push(stair);
      }
      // Deckenden bekommen Brüstungen nur auf Deckhöhe, damit die Wege durch die Tore unten frei bleiben.
      const ends=[];
      for(const seg of segmentInfo) for(const p of [seg.a,seg.b]) {
        const connected=segmentInfo.some(other=>other!==seg&&[other.a,other.b].some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.01));
        if(!connected)ends.push({seg,p});
      }
      for(const {seg,p} of ends) {
        const y=height(p[0],p[1])+WALL_HEIGHT;
        add('stone',p[0],y+.48,p[1],.38,.96,WALL_WIDTH-.2,seg.rotation);
        endCaps.push({x:p[0],z:p[1],y,cos:seg.cos,sin:seg.sin,width:WALL_WIDTH-.2,thickness:.38});
      }
      deckCells=indexItems(decks,d=>({x0:Math.min(d.a.x,d.b.x)-WALL_WIDTH/2-1,x1:Math.max(d.a.x,d.b.x)+WALL_WIDTH/2+1,z0:Math.min(d.a.z,d.b.z)-WALL_WIDTH/2-1,z1:Math.max(d.a.z,d.b.z)+WALL_WIDTH/2+1}));
      const allTreads=stairs.flatMap(s=>s.treads);
      treadCells=indexItems(allTreads,t=>boundsForOriented(t,t.length,t.width,.5));
      capCells=indexItems(endCaps,c=>boundsForOriented(c,c.thickness,c.width,.8));
      const xs=segmentInfo.flatMap(s=>[s.a[0],s.b[0]]).concat(stairs.flatMap(s=>[s.start.x,s.end.x]));
      const zs=segmentInfo.flatMap(s=>[s.a[1],s.b[1]]).concat(stairs.flatMap(s=>[s.start.z,s.end.z]));
      worldBounds=xs.length?{x0:Math.min(...xs)-WALL_WIDTH/2-2,x1:Math.max(...xs)+WALL_WIDTH/2+2,z0:Math.min(...zs)-WALL_WIDTH/2-2,z1:Math.max(...zs)+WALL_WIDTH/2+2}:null;
      if(THREE)buildMeshes();
    }
    function clearMeshes() {
      const geometries=new Set(),materials=new Set();
      for(const mesh of meshes) {scene.remove(mesh);geometries.add(mesh.geometry);materials.add(mesh.material);}
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
      meshes.splice(0);
    }
    function buildMeshes() {
      clearMeshes();
      const materials={stone:new THREE.MeshLambertMaterial({color:0x777b79}),deck:new THREE.MeshLambertMaterial({color:0x8d908c}),stairs:new THREE.MeshLambertMaterial({color:0x777b79})};
      const geometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),axis=new THREE.Vector3(1,0,0),direction=new THREE.Vector3();
      for(const key of Object.keys(parts)) {
        const list=parts[key];if(!list.length)continue;
        const mesh=new THREE.InstancedMesh(geometry,materials[key],list.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
        list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.length,p.h,p.width);direction.set(Math.cos(p.rotation)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.sin(p.rotation)*Math.cos(p.pitch)).normalize();dummy.quaternion.setFromUnitVectors(axis,direction);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
        mesh.instanceMatrix.needsUpdate=true;mesh.name='VillageWall';mesh.userData.villageWall=true;scene.add(mesh);meshes.push(mesh);
      }
    }
    function locateDeck(x,z,deck) {
      const dx=x-deck.a.x,dz=z-deck.a.z,t=(dx*deck.cos+dz*deck.sin)/deck.length,lateral=-dx*deck.sin+dz*deck.cos;
      if(t<-.001||t>1.001||Math.abs(lateral)>deck.width/2)return null;
      return {t,lateral,y:deck.yA+(deck.yB-deck.yA)*Math.max(0,Math.min(1,t))};
    }
    function locateTread(x,z,tread,radius=0) {
      const dx=x-tread.x,dz=z-tread.z,along=dx*tread.cos+dz*tread.sin,lateral=-dx*tread.sin+dz*tread.cos;
      return Math.abs(along)<=tread.length/2+.015+radius&&Math.abs(lateral)<=tread.width/2+radius;
    }
    function floor(x,z,feet) {
      if(!worldBounds||x<worldBounds.x0||x>worldBounds.x1||z<worldBounds.z0||z>worldBounds.z1)return null;
      let best=null;
      for(const tread of cell(treadCells,x,z))if(locateTread(x,z,tread)) {
        if(feet!==undefined&&feet<tread.top-.3)continue;
        if(best===null||tread.top>best)best=tread.top;
      }
      if(best!==null)return best;
      for(const deck of cell(deckCells,x,z)) {
        const found=locateDeck(x,z,deck);if(!found)continue;
        if(feet!==undefined&&feet<found.y-.35)continue;
        if(best===null||found.y>best)best=found.y;
      }
      return best;
    }
    function blocked(x,z,feet,radius=.45) {
      if(!worldBounds||x<worldBounds.x0-radius||x>worldBounds.x1+radius||z<worldBounds.z0-radius||z>worldBounds.z1+radius)return false;
      for(const tread of cell(treadCells,x,z))if(locateTread(x,z,tread,radius)&&feet>=tread.top-.28&&feet<=tread.top+.45)return false;
      for(const deck of cell(deckCells,x,z)) {
        const dx=x-deck.a.x,dz=z-deck.a.z,t=(dx*deck.cos+dz*deck.sin)/deck.length,lateral=-dx*deck.sin+dz*deck.cos;
        if(t>=-radius/deck.length&&t<=1+radius/deck.length&&Math.abs(lateral)<=deck.width/2+radius) {
          const clamped=Math.max(0,Math.min(1,t)),top=deck.yA+(deck.yB-deck.yA)*clamped;
          if(feet<top-.2)return true;
          if(feet>=top-.2&&feet<=top+1.5) {
            const along=clamped*deck.length,portal=stairs.some(s=>s.wallId===deck.id&&Math.abs(along-Math.hypot(s.end.x-deck.a.x,s.end.z-deck.a.z))<=(STAIR_WIDTH+.4)/2+radius);
            const railInner=WALL_WIDTH/2-.18-.36/2;
            if(!portal&&Math.abs(lateral)+radius>railInner)return true;
          }
        }
      }
      for(const cap of cell(capCells,x,z)) {
        const dx=x-cap.x,dz=z-cap.z,along=dx*cap.cos+dz*cap.sin,lateral=-dx*cap.sin+dz*cap.cos;
        if(Math.abs(along)<=cap.thickness/2+radius&&Math.abs(lateral)<=cap.width/2+radius&&feet>=cap.y-.2&&feet<=cap.y+1.5)return true;
      }
      return false;
    }
    resetPlan();
    return {floor,blocked,refresh:resetPlan,targets:()=>meshes.slice(),stairs,decks};
  }
  root.NachtjagdVillageWall={create};
})(globalThis);
