'use strict';

// Begehbare Minengänge mit unabhängiger Laufplanung und optionalem Three.js-Modell.
globalThis.NachtjagdMines = {
  create({THREE,scene,mines=[],heightAt=()=>0,entranceHeight=null}) {
    const routes=[],targets=[],tubes=[],lampSites=[],pointLights=[];
    const root=THREE&&scene?new THREE.Group():null;
    if(root)scene.add(root);
    const materials=THREE?{
      rock:new THREE.MeshLambertMaterial({color:0x303936}),
      floor:new THREE.MeshLambertMaterial({color:0x514b3f}),
      timber:new THREE.MeshLambertMaterial({color:0x49392b}),
      rail:new THREE.MeshLambertMaterial({color:0x554633}),
      lamp:new THREE.MeshLambertMaterial({color:0x665a36,emissive:0xb99a42})
    }:null;
    const boxInstances=new Map();

    function addBox(x,y,z,w,h,d,rotationY,material,rotationX=0) {
      if(!root)return;
      if(!boxInstances.has(material))boxInstances.set(material,[]);
      boxInstances.get(material).push({x,y,z,w,h,d,rotationY,rotationX});
    }
    function addLamp(x,y,z) {
      if(!root)return;
      addBox(x,y,z,.42,.12,.26,0,materials.lamp);
      lampSites.push({x,y:y-.2,z});
    }
    function vec(p){return {x:p[0],z:p[1]};}
    function boundsFor(route) {
      const pad=route.width/2+.7, xs=route.points.map(p=>p.x),zs=route.points.map(p=>p.z);
      route.bounds={minX:Math.min(...xs)-pad,maxX:Math.max(...xs)+pad,minZ:Math.min(...zs)-pad,maxZ:Math.max(...zs)+pad};
    }
    function addRoute(route) {
      boundsFor(route); routes.push(route); tubes.push(route);
    }
    function makeMine(mine) {
      const a=vec(mine.a),b=vec(mine.b),dx=b.x-a.x,dz=b.z-a.z;
      const length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,vx=-uz,vz=ux;
      const at=(u,v)=>({x:a.x+ux*u+vx*v,z:a.z+uz*u+vz*v});
      const y0=entranceHeight?entranceHeight(mine.id,a.x,a.z):heightAt(a.x,a.z)+.4;
      const points=[
        {x:a.x,z:a.z,y:y0},
        {x:b.x,z:b.z,y:y0-length*.12},
        {...at(length+15,0),y:y0-(length+15)*.12},
        {...at(length+30,0),y:y0-(length+30)*.12},
        {...at(length+45,0),y:y0-(length+45)*.12}
      ];
      const main={id:mine.id,name:mine.id+'-hauptgang',type:'main',width:4.8,points};
      addRoute(main);
      for(const [index,station,side] of [[1,length+18,1],[2,length+36,-1]]) {
        const start=at(station,0),elbow=at(station+6,side*5),end=at(station+10,side*11),baseY=y0-station*.12;
        addRoute({id:mine.id+'-abzweig-'+index,name:mine.id+'-kammer-'+index,type:'chamber',width:4.2,
          points:[{...start,y:baseY},{...elbow,y:baseY-.55},{...end,y:baseY-1.05}]});
      }
      const final=points[points.length-1],targetDistance=1.1;
      targets.push({id:mine.id+'-siegel',mine:mine.id,x:final.x-ux*targetDistance,y:final.y+1.05,z:final.z-uz*targetDistance});
      return {id:mine.id,a,b,ux,uz,vx,vz,width:mine.width,entry:{x:a.x,y:y0,z:a.z},deep:final};
    }
    function segmentData(route,callback) {
      for(let i=0;i<route.points.length-1;i++)callback(route.points[i],route.points[i+1],i);
    }
    function routePoint(route,x,z) {
      let best=null;
      segmentData(route,(a,b)=>{
        const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
        const t=den?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den)):0;
        const px=a.x+dx*t,pz=a.z+dz*t,distance=Math.hypot(x-px,z-pz);
        if(!best||distance<best.distance)best={x:px,z:pz,distance};
      });
      return best;
    }
    function sharesOpening(route,x,z,cx,cz,nx,nz) {
      return tubes.some(other=>{
        if(other===route||x<other.bounds.minX||x>other.bounds.maxX||z<other.bounds.minZ||z>other.bounds.maxZ)return false;
        const nearest=routePoint(other,x,z);
        const toward=(nearest.x-cx)*nx+(nearest.z-cz)*nz;
        return nearest.distance<=other.width/2+.55&&toward>.15;
      });
    }
    function buildGeometry(route) {
      if(!root)return;
      let travelled=0,nextLamp=0;
      segmentData(route,(a,b)=>{
        const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
        const tilt=-Math.atan2(dy,length),pieces=Math.max(1,Math.ceil(length));
        for(let i=0;i<pieces;i++) {
          const t=(i+.5)/pieces,x=a.x+dx*t,z=a.z+dz*t,y=a.y+dy*t,part=length/pieces;
          addBox(x,y-.12,z,route.width,.24,part+.025,angle,materials.floor,tilt);
          addBox(x,y+3.35,z,route.width+.3,.28,part+.025,angle,materials.rock,tilt);
          for(const side of [-1,1]) {
            const wallX=x+Math.cos(angle)*side*(route.width/2+.13),wallZ=z-Math.sin(angle)*side*(route.width/2+.13);
            // Kurze, fein geteilte Wandfelder lassen den Anschluss wirklich offen.
            let opening=false;
            for(let sample=0;sample<=4;sample++) {
              const s=(sample/4-.5)*part,px=wallX+dx/length*s,pz=wallZ+dz/length*s;
              const centerX=x+dx/length*s,centerZ=z+dz/length*s;
              if(sharesOpening(route,px,pz,centerX,centerZ,Math.cos(angle)*side,-Math.sin(angle)*side)){opening=true;break;}
            }
            if(!opening)addBox(wallX,y+1.6,wallZ,.26,3.3,part+.03,angle,materials.rock,tilt);
            if(i%3===0&&!opening) {
              addBox(x+Math.cos(angle)*side*(route.width/2-.18),y+1.55,z-Math.sin(angle)*side*(route.width/2-.18),.22,3.1,.24,angle,materials.timber);
            }
          }
          if(i%3===0)addBox(x,y+3.05,z,route.width-.25,.2,.24,angle,materials.timber,tilt);
          for(const side of [-1,1])addBox(x+Math.cos(angle)*side*.8,y+.1,z-Math.sin(angle)*side*.8,.12,.12,part+.025,angle,materials.rail,tilt);
          travelled+=part;
          if(travelled>=nextLamp){addLamp(x,y+3.05,z);nextLamp=travelled+12;}
        }
      });
      // Seitenflächen, Decke und Boden schließen jedes Tunnelende; nur der Start bleibt offen.
      const last=route.points[route.points.length-1],prev=route.points[route.points.length-2];
      const angle=Math.atan2(last.x-prev.x,last.z-prev.z);
      addBox(last.x,last.y+1.6,last.z,route.width,3.3,.28,angle,materials.rock);
    }
    const mineInfo=mines.map(makeMine);
    for(const route of routes)buildGeometry(route);
    if(root) {
      const unitBox=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
      for(const [material,instances] of boxInstances) {
        const mesh=new THREE.InstancedMesh(unitBox,material,instances.length);
        instances.forEach((item,index)=>{
          dummy.position.set(item.x,item.y,item.z);dummy.rotation.set(item.rotationX,item.rotationY,0);
          dummy.scale.set(item.w,item.h,item.d);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.mine=true;root.add(mesh);
      }
      for(let i=0;i<2;i++){const light=new THREE.PointLight(0xd8bd74,.43,8,2);light.userData.mineLight=true;light.visible=false;pointLights.push(light);root.add(light);}
    }
    function closest(x,z,margin=0,feet=undefined,feetTolerance=Infinity) {
      let best=null;
      for(const route of tubes) {
        const bounds=route.bounds;
        if(x<bounds.minX-margin||x>bounds.maxX+margin||z<bounds.minZ-margin||z>bounds.maxZ+margin)continue;
        segmentData(route,(a,b)=>{
          const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
          const t=den?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den)):0;
          const px=a.x+dx*t,pz=a.z+dz*t,distance=Math.hypot(x-px,z-pz),y=a.y+(b.y-a.y)*t;
          if(distance>route.width/2+margin||feet!==undefined&&Math.abs(feet-y)>feetTolerance)return;
          if(!best||distance<best.distance)best={route,a,b,t,x:px,z:pz,distance,y};
        });
      }
      return best;
    }
    function floor(x,z,feet) {
      const hit=closest(x,z,-.12,feet,3.5);
      return hit&&entryDistance(hit,x,z)>=-.05?hit.y:null;
    }
    function entryDistance(hit,x,z) {
      if(hit.route.type!=='main'||hit.a!==hit.route.points[0])return Infinity;
      const dx=hit.b.x-hit.a.x,dz=hit.b.z-hit.a.z;
      return ((x-hit.a.x)*dx+(z-hit.a.z)*dz)/Math.hypot(dx,dz);
    }
    function blocked(x,z,feet,radius=.4) {
      const margin=Math.max(0,radius),hit=closest(x,z,margin+.5);
      if(!hit)return false;
      if(entryDistance(hit,x,z)<-.05)return false;
      if(feet>hit.y+3.2)return false;
      if(hit.distance+margin>hit.route.width/2-.12)return true;
      if(feet<hit.y-.08)return true;
      if(feet+1.75>hit.y+3.2)return true;
      const end=hit.route.points[hit.route.points.length-1],prev=hit.route.points[hit.route.points.length-2];
      const dx=end.x-prev.x,dz=end.z-prev.z,len=Math.hypot(dx,dz),along=(x-end.x)*dx/len+(z-end.z)*dz/len;
      const lateral=Math.abs((x-end.x)*(-dz/len)+(z-end.z)*(dx/len));
      if(along>=-margin-.12&&along<=margin+.22&&lateral+margin<=hit.route.width/2&&feet<hit.y+3.2&&feet+1.75>hit.y)return true;
      return false;
    }
    function indoor(x,y,z) {
      const hit=closest(x,z,0);
      return !!hit&&entryDistance(hit,x,z)>=-.05&&y>=hit.y-.2&&y<=hit.y+3.5;
    }
    function terrainClearance(x,z) {
      const hit=closest(x,z,8);
      return hit&&hit.route.type==='main'?Math.min(hit.route.width/2+.08-hit.distance,hit.y+3.5-heightAt(x,z)+.05,entryDistance(hit,x,z)):-1000;
    }
    function cutTerrain(x,z) {return terrainClearance(x,z)>=0;}
    function entrance(id) {
      const m=mineInfo.find(item=>item.id===id);
      return m?{x:m.a.x,y:m.entry.y,z:m.a.z,yaw:Math.atan2(m.ux,m.uz),radius:m.width/2}:null;
    }
    function seal(id){return targets.find(t=>t.mine===id)||null;}
    function update(x,y,z) {
      if(pointLights.length!==2)return;
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)) {pointLights.forEach(light=>{light.visible=false;});return;}
      const nearest=lampSites.map(site=>({site,distance:(site.x-x)**2+(site.y-y)**2+(site.z-z)**2})).sort((a,b)=>a.distance-b.distance).slice(0,2);
      pointLights.forEach((light,index)=>{
        const selected=nearest[index];
        if(!selected||selected.distance>100){light.visible=false;return;}
        light.position.set(selected.site.x,selected.site.y,selected.site.z);light.visible=true;
      });
    }
    return {routes,points:routes.map(route=>({id:route.id,type:route.type,points:route.points.map(p=>({...p}))})),targets,
      floor,blocked,indoor,cutTerrain,terrainClearance,entrance,seal,update,root};
  }
};
