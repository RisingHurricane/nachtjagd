'use strict';

// Platzierung, Gehflächen und sparsame Darstellung der vorhandenen Hausmodelle.
// Modellmaße bleiben lokal; Gelände, Spiel und Schüsse verwenden dieselbe Transformation.
(function(root) {
  function describe(houses) {
    return houses.map(([x,z,w,d,rotation,height,type],i) => {
      // Erprobte Raummaße: kurze Blockout-Würfel würden Treppen und Türflügel einklemmen.
      [w,d]=[[8,9],[7.5,13],[7,9],[10,11]][type];
      const plan=root.NachtjagdVillageHouses.plan(w,d,height,type);
      // Die vorderen Zugänge zeigen zur nächsten Dorfstraße.
      if(z>65) rotation+=Math.PI;
      const c=Math.cos(rotation),s=Math.sin(rotation);
      const toWorld=(lx,lz)=>({x:x+c*lx+s*lz,z:z-s*lx+c*lz});
      const toLocal=(wx,wz)=>({x:c*(wx-x)-s*(wz-z),z:s*(wx-x)+c*(wz-z)});
      const corners=plan.volumes.flatMap(v=>[toWorld(v.x0,v.z0),toWorld(v.x1,v.z0),toWorld(v.x0,v.z1),toWorld(v.x1,v.z1)]);
      const bounds={x0:Math.min(...corners.map(p=>p.x)),x1:Math.max(...corners.map(p=>p.x)),z0:Math.min(...corners.map(p=>p.z)),z1:Math.max(...corners.map(p=>p.z))};
      const approaches=plan.doors.map(door=>{
        const v=plan.volumes.find(v=>v.id===door.volumeId);
        return toWorld(door.side==='front'||door.side==='back'?door.at:door.side==='right'?v.x1+1.1:v.x0-1.1,
          door.side==='left'||door.side==='right'?door.at:door.side==='front'?v.z1+1.1:v.z0-1.1);
      });
      return {id:i,x,z,w,d,rotation,height,type,plan,toWorld,toLocal,bounds,approaches,y:0};
    });
  }

  // Zusammenfassen mit UVs und Farben: auch eingebettete Kirchentexturen bleiben erhalten.
  function merge(THREE, sources, destination) {
    while(destination.children.length) {
      const child=destination.children[0]; child.geometry.dispose(); destination.remove(child);
    }
    const buckets=new Map();
    for(const source of sources) {
      source.updateMatrixWorld(true);
      source.traverse(o=>{
        if(!o.isMesh || Array.isArray(o.material)) return;
        const key=o.material.uuid+'|'+!!o.geometry.attributes.color;
        if(!buckets.has(key)) buckets.set(key,{material:o.material,list:[]});
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        if(!g.attributes.normal) g.computeVertexNormals();
        buckets.get(key).list.push(g);
      });
    }
    for(const {material,list} of buckets.values()) {
      const count=list.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();
      for(const [name,size] of [['position',3],['normal',3],['uv',2],['color',3]]) {
        if(name==='color'&&!list.some(p=>p.attributes.color)) continue;
        const values=new Float32Array(count*size); let at=0;
        for(const part of list) {
          const attr=part.attributes[name];
          for(let i=0;i<part.attributes.position.count;i++) for(let k=0;k<size;k++) {
            values[(at+i)*size+k]=attr?attr.array[i*attr.itemSize+k]:(name==='color'?1:0);
          }
          at+=part.attributes.position.count;
        }
        g.setAttribute(name,new THREE.BufferAttribute(values,size));
      }
      list.forEach(p=>p.dispose()); g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,material); mesh.castShadow=!material.transparent; mesh.receiveShadow=true;
      mesh.userData.building=true;
      mesh.name='BuildingBatch'; destination.add(mesh);
    }
    return destination.children;
  }

  function spatial(spec,data) {
    function floor(x,z,feet,roomOnly=false) {
      const p=spec.toLocal(x,z),localFeet=feet===undefined?root.NachtjagdVillageHouses.BASE:feet-spec.y;
      const near=data.surfaces.some(r=>p.x>=r.x0&&p.x<=r.x1&&p.z>=r.z0&&p.z<=r.z1);
      if(!near) {
        if(roomOnly) return null;
        const step=(data.entrySteps||[]).find(r=>p.x>=r.x0&&p.x<=r.x1&&p.z>=r.z0&&p.z<=r.z1);
        return step?spec.y+step.y:null;
      }
      return spec.y+data.walk.floor(p.x,p.z,Math.max(root.NachtjagdVillageHouses.BASE,localFeet));
    }
    function blocked(x,z,feet) {
      const p=spec.toLocal(x,z);
      return data.walk.blocked(p.x,p.z,feet-spec.y,data.walk.radius);
    }
    function indoor(x,y,z) {
      const p=spec.toLocal(x,z);return data.walk.indoor(p.x,p.z,y-spec.y)?1:0;
    }
    return {floor,blocked,indoor};
  }

  // Grobes Raster spart den linearen Lauf über alle Häuser bei jeder Spielabfrage.
  // 11 m Reserve deckt die bis zu 10 m langen Außentreppen samt halber Stufenbreite ab.
  function spatialIndex(houses,cellSize=32,margin=11) {
    const cells=new Map();
    const key=(x,z)=>`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;
    for(const house of houses) {
      const b=house.spec.bounds;
      const x0=Math.floor((b.x0-margin)/cellSize),x1=Math.floor((b.x1+margin)/cellSize);
      const z0=Math.floor((b.z0-margin)/cellSize),z1=Math.floor((b.z1+margin)/cellSize);
      for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++) {
        const k=`${x},${z}`;
        if(!cells.has(k)) cells.set(k,[]);
        cells.get(k).push(house);
      }
    }
    return {query:(x,z)=>cells.get(key(x,z))||[],cellSize,margin};
  }

  function create({THREE:T,scene,specs,height,churchOrigin}) {
    const builder=root.NachtjagdVillageHouses.create(T),sources=[],houses=[];
    const group=new T.Group();group.name='VillageBuildings';scene.add(group);
    const stone=new T.MeshLambertMaterial({color:0x9b9e9d});
    for(const spec of specs) {
      const model=builder.build(spec.w,spec.d,spec.height,spec.type),data=model.userData.house;
      // Keine eigenen Lichter pro Haus: ein kleiner gemeinsamer Innenlicht-Pool.
      const remove=[];model.traverse(o=>{if(o.isLight)remove.push(o);});remove.forEach(o=>o.parent.remove(o));
      for(const v of spec.plan.volumes) {
        const points=[[v.x0,v.z0],[v.x1,v.z0],[v.x0,v.z1],[v.x1,v.z1]].map(([x,z])=>spec.toWorld(x,z));
        const bottom=Math.min(-1,...points.map(p=>height(p.x,p.z)-spec.y-1));
        const skirt=new T.Mesh(new T.BoxGeometry(v.x1-v.x0,.28-bottom,v.z1-v.z0),stone);
        skirt.userData.foundation=true;skirt.position.set((v.x0+v.x1)/2,(bottom+.28)/2,(v.z0+v.z1)/2);model.add(skirt);
      }
      data.entrySteps=[];
      for(const e of data.entries) {
        const direction={front:[0,1],back:[0,-1],right:[1,0],left:[-1,0]}[e.side];
        const [nx,nz]=direction,initial=spec.toWorld(e.x+nx*3.8,e.z+nz*3.8);
        const length=Math.min(10,Math.max(3.8,Math.abs(height(initial.x,initial.z)-spec.y)*1.6+2));
        const end=spec.toWorld(e.x+nx*length,e.z+nz*length),endY=height(end.x,end.z)-spec.y;
        const steps=Math.max(1,Math.ceil(Math.abs(endY-.1)/.16)),run=(length-1.7)/steps;
        const terrace={x0:e.x+nx*1.2-(nx?.9:e.width+.35)/2,x1:e.x+nx*1.2+(nx?.9:e.width+.35)/2,
          z0:e.z+nz*1.2-(nz?.9:e.width+.35)/2,z1:e.z+nz*1.2+(nz?.9:e.width+.35)/2,y:.1};
        data.entrySteps.push(terrace);
        const ledge=new T.Mesh(new T.BoxGeometry(terrace.x1-terrace.x0,.3,terrace.z1-terrace.z0),stone);
        ledge.position.set((terrace.x0+terrace.x1)/2,-.05,(terrace.z0+terrace.z1)/2);model.add(ledge);
        for(let i=0;i<steps;i++) {
          const offset=1.7+(i+.5)*run,x=e.x+nx*offset,z=e.z+nz*offset,y=.1+(endY-.1)*(i+1)/steps;
          const width=e.width+.35,w=nx?run:width,d=nz?run:width;
          data.entrySteps.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y});
          const p=spec.toWorld(x,z),rise=Math.max(.25,y-(height(p.x,p.z)-spec.y)+.12);
          const block=new T.Mesh(new T.BoxGeometry(w,rise,d),stone);block.position.set(x,y-rise/2,z);model.add(block);
        }
      }
      model.position.set(spec.x,spec.y,spec.z);model.rotation.y=spec.rotation;
      const walk=spatial(spec,data); houses.push({spec,model,data,...walk});sources.push(model);
    }
    merge(T,sources,group);
    let church=null,churchFailure=null;
    const churchGroup=new T.Group();churchGroup.name='ChurchBatches';scene.add(churchGroup);
    const lamps=Array.from({length:2},()=>{
      const l=new T.PointLight(0xffdbad,0,11,2);l.userData.building=true;scene.add(l);return l;
    });
    const index=spatialIndex(houses);
    const near=(x,z)=>index.query(x,z).filter(h=>{
      const b=h.spec.bounds;return x>=b.x0-index.margin&&x<=b.x1+index.margin&&z>=b.z0-index.margin&&z<=b.z1+index.margin;
    });
    const ready=root.NachtjagdImportedModels.loadChurch({origin:churchOrigin}).then(asset=>{
      church=asset;merge(T,[asset.root],churchGroup);return asset;
    }).catch(error=>{churchFailure=error;console.error('Kirche konnte nicht geladen werden:',error);return null;});
    function floor(x,z,feet) {
      const f=church?.floorHeight(x,z);if(f!==null&&f!==undefined)return f;
      const close=near(x,z);
      for(const h of close) {const y=h.floor(x,z,feet,true);if(y!==null)return y;}
      for(const h of close.sort((a,b)=>Math.hypot(a.spec.x-x,a.spec.z-z)-Math.hypot(b.spec.x-x,b.spec.z-z))) {const y=h.floor(x,z,feet);if(y!==null)return y;}
      return null;
    }
    function blocked(x,z,feet) {
      return !!church?.collides({x,y:feet,z},.3,1.68)||near(x,z).some(h=>h.blocked(x,z,feet));
    }
    function indoor(x,y,z) {
      if(church) {
        const p=church.toLocal({x,y,z});
        if(p.z<0&&p.y>-.15&&p.y<8&&church.floorHeight(x,z)!==null)return 1;
      }
      return near(x,z).some(h=>h.indoor(x,y,z))?1:0;
    }
    function update(x,y,z) {
      const active=near(x,z).find(h=>h.indoor(x,y,z));
      const insideChurch=church&&indoor(x,y,z)&&!active;
      lamps.forEach((l,i)=>{
        if(active) {
          const p=active.spec.toWorld(0,i?-.5:1.8),floorY=active.floor(x,z,y);
          l.position.set(p.x,(floorY??y)+2.35,p.z);l.intensity=.65;l.distance=11;
        } else if(insideChurch) {
          l.position.set(churchOrigin.x,churchOrigin.y+4,churchOrigin.z-(i?22:7));l.intensity=.85;l.distance=17;
        } else l.intensity=0;
      });
    }
    return {houses,ready,floor,blocked,indoor,update,group,churchGroup,get church(){return church;},get failed(){return churchFailure;},
      targets:()=>[...group.children,...churchGroup.children],
      refresh:()=>{merge(T,sources,group);if(church)merge(T,[church.root],churchGroup);}};
  }
  root.NachtjagdBuildings={describe,spatial,spatialIndex,merge,create};
})(globalThis);
