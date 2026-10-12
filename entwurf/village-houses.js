'use strict';

// Vier begehbare Hausmodelle für die separate Vorschau und die Dorfplatzierung.
// Vertrag: 1 Einheit = 1 m, Ursprung auf dem Gelände, Vorderseite +z.
// build(w,d,height,type) liefert eine Group; userData.house enthält Grundriss,
// Zugänge und walk.{floor,blocked,move,indoor}. Weltplatzierung muss Punkte
// vor diesen Abfragen in lokale Koordinaten umrechnen. Keine Spielregeln hier.
(function (root) {
  const BASE = .3, STOREY = 3.15, WALL = .22, EYE = 1.68, RADIUS = .26, STEP = .23;
  const inside = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const rect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });

  function plan(w, d, height, type) {
    if (![w, d, height].every(v => Number.isFinite(v) && v >= 6) || ![0,1,2,3].includes(type)) {
      throw new Error('Hausmaße müssen mindestens 6 m betragen; Haustyp 0–3.');
    }
    const names = ['Bergwohnhaus', 'Bauernhof', 'Bürgerhaus', 'Winkelhaus'];
    const volumes = [], links = [], doors = [];
    function volume(id, x0, x1, z0, z1, levels, roof, turn = 0) {
      const v = { id, ...rect(x0,x1,z0,z1), levels, roof, turn };
      volumes.push(v); return v;
    }
    function opening(list, volumeId, side, at, width, id) {
      list.push({ volumeId, side, at, width, id });
    }
    if (type === 0) {
      volume('main', -w*.47,w*.47,-d*.43,d*.43,2,w*.76);
      volume('porch', -w*.35,w*.05,d*.43,d*.69,1,w*.33);
      volume('side', w*.47,w*.7,d*.12,d*.53,1,w*.24);
      opening(links,'main','front',-w*.15,1.5,'vorraum');
      opening(links,'porch','back',-w*.15,1.5,'vorraum');
      opening(links,'main','right',d*.35,1.4,'seitenraum');
      opening(links,'side','left',d*.35,1.4,'seitenraum');
      opening(doors,'porch','front',-w*.15,1.45,'haustuer');
      opening(doors,'main','back',w*.16,1.35,'hintertuer');
    } else if (type === 1) {
      volume('main', -w*.57,w*.33,-d*.58,d*.34,2,w*.82);
      volume('barn', w*.33,w*1.03,d*.02,d*.45,1,w*.5,Math.PI/2);
      opening(links,'main','right',d*.21,1.5,'scheunengang');
      opening(links,'barn','left',d*.21,1.5,'scheunengang');
      opening(doors,'main','front',-w*.18,1.45,'haustuer');
      opening(doors,'barn','front',w*.69,2.25,'scheunentor');
    } else if (type === 2) {
      volume('main', -w*.4,w*.4,-d*.48,d*.4,3,w*.83);
      volume('porch', -w*.37,w*.07,d*.4,d*.7,1,w*.4);
      volume('bay', w*.4,w*.69,-d*.12,d*.2,2,w*.3,Math.PI/2);
      opening(links,'main','front',-w*.16,1.5,'vorraum');
      opening(links,'porch','back',-w*.16,1.5,'vorraum');
      opening(links,'main','right',d*.04,1.3,'erker');
      opening(links,'bay','left',d*.04,1.3,'erker');
      opening(doors,'porch','front',-w*.16,1.45,'haustuer');
      opening(doors,'bay','right',d*.04,1.35,'seitentuer');
    } else {
      volume('main', -w*.49,w*.09,-d*.52,d*.38,2,w*.55);
      volume('wing', w*.09,w*.58,d*.04,d*.52,1,w*.44,Math.PI/2);
      volume('back', -w*.37,-w*.03,-d*.7,-d*.52,1,w*.31);
      opening(links,'main','right',d*.22,1.5,'wohnfluegel');
      opening(links,'wing','left',d*.22,1.5,'wohnfluegel');
      opening(links,'main','back',-w*.2,1.5,'hinterraum');
      opening(links,'back','front',-w*.2,1.5,'hinterraum');
      opening(doors,'wing','front',w*.27,1.45,'haustuer');
      opening(doors,'back','back',-w*.2,1.35,'hintertuer');
    }
    const main = volumes[0], stairWidth = type === 2 ? 2.65 : 1.4;
    const stairs = {
      ...rect(main.x1-WALL-stairWidth,main.x1-WALL-.04,main.z0+1.05,main.z0+(type===2?4.9:6.6)),
      flights: main.levels-1, returnFlight: type===2
    };
    return { name:names[type], type, volumes, links, doors, stairs, base:BASE, storey:STOREY, eye:EYE };
  }

  // Sichtbare Körper und Bewegung verwenden dieselben Maße, einschließlich Treppenloch.
  function createWalk(data) {
    // Kleine räumliche Indizes halten Abfragen unabhängig von der Möbelanzahl.
    function index(items,bounds) {
      const cells=new Map();
      for(const item of items) {
        const r=bounds(item);
        for(let x=Math.floor(r.x0/2);x<=Math.floor(r.x1/2);x++)for(let z=Math.floor(r.z0/2);z<=Math.floor(r.z1/2);z++) {
          const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);
        }
      }
      return (x,z)=>cells.get(`${Math.floor(x/2)},${Math.floor(z/2)}`)||[];
    }
    const floorsAt=index(data.surfaces,s=>s);
    const solidsAt=index(data.solids,s=>{
      const c=Math.abs(Math.cos(s.turn)),n=Math.abs(Math.sin(s.turn));
      const dx=(c*s.w+n*s.d)/2+.6,dz=(n*s.w+c*s.d)/2+.6;
      return rect(s.x-dx,s.x+dx,s.z-dz,s.z+dz);
    });
    function floor(x, z, feet = 0) {
      let best = 0;
      for (const surface of floorsAt(x,z)) {
        if (surface.y <= feet + STEP + .001 && inside(surface,x,z) &&
            !(surface.holes || []).some(h => inside(h,x,z))) best = Math.max(best,surface.y);
      }
      return best;
    }
    function blocked(x, z, feet, radius = RADIUS) {
      return (radius<=.6?solidsAt(x,z):data.solids).some(s => {
        if (feet >= s.y1-.015 || feet+EYE <= s.y0+.015) return false;
        if (s.surface && s.y1 <= feet+STEP+.001) return false;
        const dx=x-s.x, dz=z-s.z, c=Math.cos(s.turn), n=Math.sin(s.turn);
        const lx=c*dx-n*dz, lz=n*dx+c*dz;
        const qx=Math.max(Math.abs(lx)-s.w/2,0), qz=Math.max(Math.abs(lz)-s.d/2,0);
        return qx*qx+qz*qz < radius*radius;
      });
    }
    function move(position, dx, dz) {
      const p={...position}, count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07));
      for(let i=0;i<count;i++) for(const axis of ['x','z']) {
        const next={...p}; next[axis]+=(axis==='x'?dx:dz)/count;
        const y=floor(next.x,next.z,p.y);
        if (y-p.y <= STEP+.001 && !blocked(next.x,next.z,y)) { p[axis]=next[axis]; p.y=y; }
      }
      return p;
    }
    function indoor(x,z,feet) {
      return data.plan.volumes.some(v => inside(v,x,z) && feet>=BASE-.1 && feet<BASE+v.levels*STOREY);
    }
    return { floor, blocked, move, indoor, radius:RADIUS, step:STEP, eye:EYE };
  }

  function create(THREE, materials = {}) {
    const cube = new THREE.BoxGeometry(1,1,1);
    const mat = (color, extras={}) => new THREE.MeshLambertMaterial({color,...extras});
    const palette = {
      house:materials.house || mat('#cfba9c'), castle:materials.castle || mat('#728583'),
      plaster:mat('#e1d4bb'), wood:mat('#76604b'), darkWood:mat('#473c32'),
      floor:mat('#a58b68'), board:mat('#ac9270'), slate:mat('#edf1f4'),
      glass:mat('#92b4bc',{transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide}),
      metal:mat('#3e4847'), cloth:mat('#879587'), linen:mat('#ded4b9'), rug:mat('#796455'),
      hay:mat('#baa474'), paper:mat('#cabb9d'), ember:mat('#d79044',{emissive:'#a44d19'}),
      lamp:mat('#edc98b',{emissive:'#a0793b'})
    };
    function build(w,d,height,type) {
      const layout=plan(w,d,height,type), group=new THREE.Group(); group.name=layout.name;
      const data={plan:layout,solids:[],surfaces:[],entries:[],rooms:[]};
      const pieces=[];
      function part(x,y,z,width,rise,depth,material='wood',opts={}) {
        const mesh=new THREE.Mesh(cube,palette[material]);
        mesh.position.set(x,y,z); mesh.scale.set(width,rise,depth); mesh.rotation.y=opts.turn||0;
        mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh);
        pieces.push({mesh,y0:y-rise/2,y1:y+rise/2,...opts});
        if(opts.solid) data.solids.push({x,z,w:width,d:depth,y0:y-rise/2,y1:y+rise/2,turn:opts.turn||0,surface:!!opts.surface});
        return mesh;
      }
      function surface(r,y,holes=[]) {
        data.surfaces.push({...r,y,holes});
        // Slab in vier Rechtecke um das einzige Treppenloch zerlegen.
        let slabs=[r];
        for(const h of holes) slabs=slabs.flatMap(s => {
          if(h.x1<=s.x0||h.x0>=s.x1||h.z1<=s.z0||h.z0>=s.z1)return[s];
          const x0=Math.max(s.x0,h.x0),x1=Math.min(s.x1,h.x1),z0=Math.max(s.z0,h.z0),z1=Math.min(s.z1,h.z1);
          return [rect(s.x0,x0,s.z0,s.z1),rect(x1,s.x1,s.z0,s.z1),rect(x0,x1,s.z0,z0),rect(x0,x1,z1,s.z1)].filter(q=>q.x1-q.x0>.01&&q.z1-q.z0>.01);
        });
        for(const s of slabs) {
          part((s.x0+s.x1)/2,y-.09,(s.z0+s.z1)/2,s.x1-s.x0,.18,s.z1-s.z0,'floor',{solid:true,surface:true});
          for(let x=s.x0+.26;x<s.x1;x+=.53) part(x,y+.003,(s.z0+s.z1)/2,Math.min(.51,s.x1-x),.012,s.z1-s.z0,'board');
        }
      }
      function beam(a,b,thickness=.12,material='wood',opts={}) {
        const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
        const mesh=part((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,thickness,v.length(),thickness,material,opts);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
        return mesh;
      }
      function sidePoint(v,side,at,offset=0) {
        if(side==='front'||side==='back')return [at,side==='front'?v.z1+offset:v.z0-offset];
        return [side==='right'?v.x1+offset:v.x0-offset,at];
      }
      function wall(v,side,y0,y1,openings,interior=false) {
        const alongX=side==='front'||side==='back';
        const start=alongX?v.x0:v.z0,end=alongX?v.x1:v.z1;
        const edges=[start,end,...openings.flatMap(o=>[Math.max(start,o.at-o.width/2),Math.min(end,o.at+o.width/2)])].sort((a,b)=>a-b);
        const opts={solid:true,cutFace:!interior&&(side==='front'||side==='right')};
        function strip(a,b,lo,hi) {
          if(b-a<.01||hi-lo<.01)return;
          const [x,z]=sidePoint(v,side,(a+b)/2);
          part(x,(lo+hi)/2,z,alongX?b-a:WALL,hi-lo,alongX?WALL:b-a,interior?'plaster':'house',opts);
        }
        for(let i=0;i<edges.length-1;i++) {
          const a=edges[i],b=edges[i+1],middle=(a+b)/2;
          const o=openings.find(q=>middle>q.at-q.width/2+.001&&middle<q.at+q.width/2-.001);
          if(!o)strip(a,b,y0,y1);
          else {strip(a,b,y0,o.bottom);strip(a,b,o.top,y1);}
        }
        const turn=alongX?0:Math.PI/2;
        for(const o of openings) {
          const [x,z]=sidePoint(v,side,o.at,.025);
          const low=o.bottom,high=o.top,thick=.13;
          for(const at of [-1,1]) {
            const [px,pz]=sidePoint(v,side,o.at+at*(o.width/2+.05));
            part(px,(low+high)/2,pz,alongX?thick:.3,high-low+.12,alongX?.3:thick,'darkWood',{cutFace:opts.cutFace});
          }
          part(x,high+.06,z,o.width+.24,.14,.3,'darkWood',{turn,cutFace:opts.cutFace});
          if(o.kind==='window') {
            part(x,(low+high)/2,z,o.width,high-low,.035,'glass',{turn,cutFace:opts.cutFace});
            part(x,low-.04,z,o.width+.32,.12,.4,'wood',{turn,cutFace:opts.cutFace});
            part(x,(low+high)/2,z,.055,high-low,.06,'wood',{turn,cutFace:opts.cutFace});
            part(x,(low+high)/2,z,o.width,.055,.06,'wood',{turn,cutFace:opts.cutFace});
          }
        }
        // Sockel und durchgehender Geschossbalken; Türen bleiben bis zum Boden frei.
        const [cx,cz]=sidePoint(v,side,(start+end)/2,.04);
        part(cx,y1-.09,cz,end-start,.18,.3,'wood',{turn,cutFace:opts.cutFace});
      }
      function roof(v,baseY=BASE+v.levels*STOREY) {
        const y=baseY,rotated=v.turn!==0;
        const cx=(v.x0+v.x1)/2,cz=(v.z0+v.z1)/2;
        const span=(rotated?v.z1-v.z0:v.x1-v.x0)/2+.32;
        const length=(rotated?v.x1-v.x0:v.z1-v.z0)+.6;
        const slope=Math.hypot(span,v.roof),angle=Math.atan2(v.roof,span);
        const roofGroup=new THREE.Group(); roofGroup.position.set(cx,y,cz);roofGroup.rotation.y=v.turn;group.add(roofGroup);
        for(const sign of [-1,1]) {
          const panel=new THREE.Mesh(cube,palette.slate);
          panel.position.set(sign*span/2,v.roof/2,0);panel.scale.set(slope,.14,length);
          panel.rotation.z=-sign*angle;panel.castShadow=true;panel.receiveShadow=true;roofGroup.add(panel);
          for(let z=-length/2+.45;z<length/2;z+=.65) {
            const seam=new THREE.Mesh(cube,palette.castle);seam.position.set(sign*span/2,v.roof/2+.08,z);
            seam.scale.set(slope,.035,.028);seam.rotation.z=-sign*angle;roofGroup.add(seam);
          }
        }
        const shape=new THREE.Shape();shape.moveTo(-span+.32,0);shape.lineTo(span-.32,0);shape.lineTo(0,v.roof-.1);shape.closePath();
        const gableGeometry=new THREE.ExtrudeGeometry(shape,{depth:WALL,bevelEnabled:false});
        for(const sign of [-1,1]) {
          const mesh=new THREE.Mesh(gableGeometry,palette.house);mesh.position.z=sign*(length/2-.3)-WALL/2;roofGroup.add(mesh);
          for(const edge of [-1,1]) {
            const trim=new THREE.Mesh(cube,palette.darkWood);trim.position.set(edge*span/2,v.roof/2,sign*length/2);
            trim.scale.set(slope,.13,.16);trim.rotation.z=-edge*angle;roofGroup.add(trim);
          }
        }
        pieces.push({mesh:roofGroup,roof:true,y0:y,y1:y+v.roof});
      }
      const main=layout.volumes[0],stairs=layout.stairs;
      for(const v of layout.volumes) {
        for(let level=0;level<v.levels;level++) {
          const y=BASE+level*STOREY,top=y+STOREY;
          const holes=v.id==='main'&&level>0?[stairs]:[];
          surface(v,y,holes);
          data.rooms.push({id:v.id,level,...rect(v.x0+WALL,v.x1-WALL,v.z0+WALL,v.z1-WALL),y});
          for(const side of ['front','back','left','right']) {
            const alongX=side==='front'||side==='back',start=alongX?v.x0:v.z0,end=alongX?v.x1:v.z1;
            const passages=[...layout.links,...(level===0?layout.doors:[])].filter(o=>o.volumeId===v.id&&o.side===side&&
              (level===0||layout.links.includes(o)&&layout.volumes.find(q=>q.id!==v.id&&inside(q,...sidePoint(v,side,o.at,.25)))?.levels>level));
            const openings=passages.map(o=>({...o,bottom:y,top:y+2.35,kind:'door'}));
            const covered=layout.volumes.filter(q=>q!==v&&q.levels>level);
            for(let at=start+1.35;at<end-.8;at+=2.2) {
              const [x,z]=sidePoint(v,side,at,.3);
              if(covered.some(q=>inside(q,x,z))||openings.some(o=>Math.abs(at-o.at)<o.width/2+.8))continue;
              // Die Treppenwand hinten/rechts bleibt für ausreichende Kopffreiheit geschlossen.
              openings.push({at,width:.95,bottom:y+1.05,top:y+2.27,kind:'window'});
            }
            wall(v,side,y,top,openings);
          }
          // Eckständer und Geschossbalken, ohne die Öffnungen zu kreuzen.
          for(const x of [v.x0,v.x1])for(const z of [v.z0,v.z1])part(x,y+STOREY/2,z,.19,STOREY,.19,'wood',{cutFace:x===v.x1||z===v.z1});
        }
        roof(v);
      }
      // Kleine Zwerchgiebel gliedern die großen Dachflächen. Sie liegen über
      // der obersten Raumdecke; der Dachboden gehört nicht zum Rundgang.
      const dormerZ=type===1?[main.z0+3.1,main.z1-2.8]:[(main.z0+main.z1)/2];
      for(const z of dormerZ) {
        const x=main.x1-.05,y=BASE+main.levels*STOREY+main.roof*.18;
        part(x-.55,y+.5,z,1.2,1,1.5,'house',{roof:true});
        part(x+.065,y+.5,z,.035,.72,.9,'glass',{roof:true});
        for(const dz of [-.5,.5])part(x+.09,y+.5,z+dz,.1,.92,.1,'darkWood',{roof:true});
        part(x+.09,y+.5,z,.1,.8,.045,'wood',{roof:true});
        part(x+.09,y+.5,z,.1,.045,1,'wood',{roof:true});
        roof({x0:x-1.2,x1:x+.2,z0:z-.8,z1:z+.8,levels:0,roof:1.1,turn:Math.PI/2},y+1);
      }
      // Echte, dauerhaft geöffnete Türblätter neben den freien Durchgängen.
      for(const door of layout.doors) {
        const v=layout.volumes.find(q=>q.id===door.volumeId),[x,z]=sidePoint(v,door.side,door.at);
        const horizontal=door.side==='front'||door.side==='back',out=door.side==='front'||door.side==='right'?1:-1;
        const turn=(horizontal?0:Math.PI/2)+out*1.22;
        const hinge=sidePoint(v,door.side,door.at-door.width/2,.12);
        const leafX=hinge[0]+Math.cos(turn)*door.width/2,leafZ=hinge[1]-Math.sin(turn)*door.width/2;
        part(leafX,BASE+1.12,leafZ,door.width-.1,2.24,.09,'darkWood',{turn,solid:true});
        for(const y of [BASE+.45,BASE+1.8])part(leafX,y,leafZ,door.width-.12,.09,.13,'metal',{turn});
        const forward=sidePoint(v,door.side,door.at,1.1);
        for(let i=0;i<3;i++) {
          const offset=.2+i*.28,[sx,sz]=sidePoint(v,door.side,door.at,offset),y=BASE-i*.1;
          const r=horizontal?rect(sx-door.width/2-.15,sx+door.width/2+.15,sz-.21,sz+.21):rect(sx-.21,sx+.21,sz-door.width/2-.15,sz+door.width/2+.15);
          surface(r,y);
        }
        data.entries.push({...door,x,z,outside:{x:forward[0],z:forward[1],y:0},inside:{x:sidePoint(v,door.side,door.at,-.8)[0],z:sidePoint(v,door.side,door.at,-.8)[1],y:BASE}});
      }
      function rail(x0,z0,x1,z1,y) {
        beam([x0,y+.94,z0],[x1,y+.94,z1],.09,'darkWood');
        const length=Math.hypot(x1-x0,z1-z0),count=Math.ceil(length/.7);
        for(let i=0;i<=count;i++)part(x0+(x1-x0)*i/count,y+.46,z0+(z1-z0)*i/count,.075,.92,.075,'wood',{solid:true});
      }
      const run=stairs.z1-stairs.z0,steps=type===2?9:18;
      for(let level=0;level<stairs.flights;level++) {
        const y=BASE+level*STOREY;
        data.solids.push({x:stairs.x0,z:(stairs.z0+stairs.z1)/2,w:.08,d:run,y0:y,y1:y+STOREY+1,turn:0});
        if(!stairs.returnFlight) {
          for(let i=0;i<steps;i++) {
            const z1=stairs.z1-i*run/steps,z0=z1-run/steps,top=y+(i+1)*STOREY/steps;
            surface(rect(stairs.x0,stairs.x1,z0,z1),top);
          }
          // Absturzschutz auf der offenen Seite, mit freiem An- und Austritt.
          beam([stairs.x0,y+.95,stairs.z1],[stairs.x0,y+STOREY+.95,stairs.z0],.09,'darkWood');
          for(let i=1;i<steps;i+=2)part(stairs.x0,y+(i+1)*STOREY/steps+.44,stairs.z1-(i+.5)*run/steps,.07,.88,.07,'wood',{solid:true});
          rail(stairs.x0,stairs.z0,stairs.x0,stairs.z1,y+STOREY);
        } else {
          const middle=(stairs.x0+stairs.x1)/2,landing=.8,flightRun=run-landing;
          data.solids.push({x:middle,z:stairs.z0+landing+flightRun/2,w:.08,d:flightRun,y0:y,y1:y+STOREY+1,turn:0});
          for(let i=0;i<steps;i++) {
            const f0=stairs.z1-(i+1)*flightRun/steps,f1=f0+flightRun/steps;
            surface(rect(stairs.x0,middle-.07,f0,f1),y+(i+1)*STOREY/2/steps);
            const b0=stairs.z0+landing+i*flightRun/steps,b1=b0+flightRun/steps;
            surface(rect(middle+.07,stairs.x1,b0,b1),y+STOREY/2+(i+1)*STOREY/2/steps);
          }
          surface(rect(stairs.x0,stairs.x1,stairs.z0,stairs.z0+landing),y+STOREY/2);
          beam([middle,y+.95,stairs.z1],[middle,y+STOREY/2+.95,stairs.z0+landing],.08,'darkWood');
          beam([middle,y+STOREY/2+.95,stairs.z0+landing],[middle,y+STOREY+.95,stairs.z1],.08,'darkWood');
          for(let i=0;i<=steps;i+=2)part(middle,y+STOREY/2+.45,stairs.z0+landing+i*flightRun/steps,.08,STOREY/2+.9,.08,'wood',{solid:true});
          rail(stairs.x0,stairs.z0,stairs.x0,stairs.z1,y+STOREY);
        }
      }
      function furnitureBox(x,y,z,fw,fh,fd,material='wood',solid=true) {
        return part(x,y+fh/2,z,fw,fh,fd,material,{solid});
      }
      function table(x,y,z,fw=1.5,fd=.8) {
        furnitureBox(x,y+.74,z,fw,.12,fd,'wood');
        for(const sx of [-1,1])for(const sz of [-1,1])furnitureBox(x+sx*(fw/2-.12),y,z+sz*(fd/2-.1),.12,.74,.12,'darkWood');
      }
      function chair(x,y,z,turn=0) {
        part(x,y+.45,z,.53,.12,.54,'wood',{turn,solid:true});
        const backZ=z-Math.cos(turn)*.22,backX=x-Math.sin(turn)*.22;
        part(backX,y+.83,backZ,.53,.65,.09,'wood',{turn,solid:true});
        for(const sx of [-1,1])for(const sz of [-1,1]) {
          const lx=sx*.2,lz=sz*.2;
          part(x+Math.cos(turn)*lx+Math.sin(turn)*lz,y+.21,z-Math.sin(turn)*lx+Math.cos(turn)*lz,.07,.42,.07,'darkWood');
        }
      }
      function bed(x,y,z) {
        furnitureBox(x,y,z,1.3,.4,2.1,'darkWood');furnitureBox(x,y+.4,z,1.24,.22,2,'linen');
        furnitureBox(x,y+.62,z+.28,1.25,.055,1.36,'cloth');
        furnitureBox(x,y+.62,z-.72,.95,.13,.38,'linen');
        furnitureBox(x,y,z-1.03,1.38,.95,.12,'wood');
      }
      function cabinet(x,y,z,fw=1.25,fh=1.8) {
        furnitureBox(x,y,z,fw,fh,.52,'darkWood');
        for(const sx of [-1,1])furnitureBox(x+sx*fw*.245,y+.08,z+.28,fw*.47,fh-.16,.06,'wood',false);
        for(const sx of [-1,1])furnitureBox(x+sx*.08,y+fh*.5,z+.33,.035,.1,.04,'metal',false);
      }
      function shelf(x,y,z) {
        for(const sx of [-1,1])furnitureBox(x+sx*.66,y,z,.09,1.8,.36,'wood');
        for(let i=0;i<4;i++) {
          furnitureBox(x,y+i*.54,z,1.4,.07,.4,'wood');
          for(let j=0;j<5;j++)furnitureBox(x-.5+j*.21,y+i*.54+.08,z,.13,.28+(j%2)*.1,.24,j%2?'paper':'cloth',false);
        }
      }
      // Stube und Küche vorne, Schlafräume oben, freie Laufachse zur Treppe rechts.
      const left=main.x0+.95,center=(main.x0+stairs.x0)/2,front=main.z1-2.7,rear=main.z0+1.6;
      table(center,BASE,front,1.35,1.05);chair(center,BASE,front+.96);chair(center-.99,BASE,front,Math.PI/2);
      furnitureBox(center,BASE+.005,front,2.65,.025,2.9,'rug',false);
      cabinet(left,BASE,rear,1.35,1.8);
      // Schmale Küchennische mit Arbeitsplatte, Becken und zwei Töpfen.
      furnitureBox(main.x0+.47,BASE,main.z0+2.75,.65,.82,.75,'wood');
      furnitureBox(main.x0+.47,BASE+.82,main.z0+2.75,.72,.08,.82,'castle');
      furnitureBox(main.x0+.47,BASE+.9,main.z0+2.58,.43,.035,.3,'metal',false);
      for(const offset of [-.15,.16])furnitureBox(main.x0+.47+offset,BASE+.9,main.z0+2.98,.17,.19,.17,'metal',false);
      // Feuerstelle, Kaminsims, Holzkorb und passender Schornstein.
      furnitureBox(left,BASE,main.z0+3.7,1.35,1.35,.65,'castle');
      furnitureBox(left,BASE+.15,main.z0+4.04,.9,.68,.04,'darkWood',false);
      furnitureBox(left,BASE+.18,main.z0+4.08,.58,.08,.12,'ember',false);
      furnitureBox(left,BASE+1.35,main.z0+3.7,1.55,.13,.82,'wood');
      const chimneyHeight=main.levels*STOREY+main.roof*.5;
      part(left,BASE+1.48+chimneyHeight/2,main.z0+3.7,.6,chimneyHeight,.6,'castle',{solid:true,roof:true});
      for(let level=1;level<main.levels;level++) {
        const y=BASE+level*STOREY;
        bed(left+.15,y,rear+.05);cabinet(center,y,front+1.15,1.25,1.8);
        if(type===2&&level===2) {table(center,y,front-.45,1.2,.65);chair(center,y,front+.3);shelf(main.x0+.92,y,main.z1-.35);}
        else {table(center,y,front-.25,1,.65);chair(center,y,front+.55);}
        // Trennwand zwischen Schlafkammer und oberer Diele: Tür plus Treppenkorridor offen.
        const partition={...rect(main.x0+WALL,stairs.x0-.22,rear+1.8,rear+1.8)};
        if(partition.x1-partition.x0>1.6) {
          wall(partition,'front',y,y+STOREY,[{at:center,width:1.15,bottom:y,top:y+2.25,kind:'door'}],true);
          data.rooms.push({id:'schlafkammer',level,...rect(partition.x0,partition.x1,main.z0+WALL,partition.z0),y});
        }
      }
      for(const v of layout.volumes.slice(1)) {
        const x=(v.x0+v.x1)/2,z=(v.z0+v.z1)/2;
        if(v.id==='barn') {
          table(v.x1-.8,BASE,v.z0+.8,1.3,.65);
          for(let i=0;i<3;i++)furnitureBox(v.x1-.8,BASE,v.z1-1.1-i*.75,1,.65,.62,i===0?'hay':'wood');
          shelf(x,BASE,v.z0+.35);
        } else if(v.id==='wing') {table(v.x1-1.3,BASE,z,1.5,.8);chair(v.x1-1.3,BASE,z+1);cabinet(v.x1-1.05,BASE,v.z0+.5);}
        else if(v.id==='side') {shelf(x,BASE,v.z0+.4);furnitureBox(x,BASE,v.z1-.65,1.2,.65,.65,'wood');}
        else if(v.id==='bay') {table(v.x1-.65,BASE,v.z0+.65,.8,.55);table(v.x1-.65,BASE+STOREY,v.z0+.65,.8,.55);}
        else if(v.id==='back')cabinet(v.x0+.75,BASE,z,.9,1.7);
        // Eine kleine Sitzbank im Vorraum, seitlich außerhalb der Eingangslinie.
        else furnitureBox(v.x0+.4,BASE,z,.45,.45,1,'wood');
      }
      // Innenleuchten sind bewusst schwach; die Fenster bleiben die Hauptlichtquelle.
      for(const v of layout.volumes)for(let level=0;level<v.levels;level++) {
        const x=(v.x0+v.x1)/2,z=(v.z0+v.z1)/2,y=BASE+level*STOREY+2.65;
        part(x,y,z,.25,.32,.25,'lamp');
        const light=new THREE.PointLight(0xffdda5,.25,8,2);light.position.set(x,y-.25,z);group.add(light);
        pieces.push({mesh:light,y0:y,y1:y});
      }
      function setView(mode='outside') {
        const level=mode==='ground'?0:mode==='upper'?1:2,ceiling=BASE+(level+1)*STOREY;
        for(const p of pieces)p.mesh.visible=mode==='outside'||(!p.roof&&p.y0<ceiling-.04&&
          !(p.surface&&p.y1>=ceiling-.01)&&!(p.cutFace&&p.y1>BASE+level*STOREY+.05));
      }
      data.walk=createWalk(data);data.setView=setView;
      group.userData.house=data;
      return group;
    }
    return {build};
  }
  root.NachtjagdVillageHouses={create,plan,createWalk,BASE,STOREY};
})(globalThis);
