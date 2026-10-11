'use strict';

// Erkennbare Silhouetten für die räumliche Planung, ohne fertige Modelle.
globalThis.NachtjagdLandmarks = {
  create({THREE,scene,materials,box,label,groundHeight,streetHeight,layout}) {
    const {wind,stones,ruin}=layout.landmarkSites;
    materials.mine=new THREE.MeshLambertMaterial({color:new THREE.Color('#293431').convertSRGBToLinear()});
    const windWheel=new THREE.Group();
    windWheel.position.set(wind[0]+Math.sin(-2.2)*6,groundHeight(...wind)+17,wind[1]+Math.cos(-2.2)*6);
    windWheel.rotation.y=-2.2;
    const bladeGeometry=new THREE.BoxGeometry(2.1,8.5,.5);
    for(let i=0;i<4;i++) {
      const arm=new THREE.Group(),blade=new THREE.Mesh(bladeGeometry,materials.landmark);
      arm.rotation.z=i*Math.PI/2+Math.PI/4;
      blade.position.y=5; blade.castShadow=true; arm.add(blade); windWheel.add(arm);
    }
    const hub=new THREE.Mesh(new THREE.BoxGeometry(2,2,1.2),materials.castle);
    windWheel.add(hub); scene.add(windWheel);
    box(...wind,6,6,17,'landmark');
    box(...wind,9,8,1,'house',0,groundHeight(...wind)+17,false);
    label('Windrad',...wind,30,48);

    // Zehn Menhire, vier grobe Decksteine; der Innenraum bleibt offen.
    const stoneTop=groundHeight(...stones)+7;
    const positions=Array.from({length:10},(_,i)=>{
      const angle=i/10*Math.PI*2+.08*Math.sin(i*3),radius=14+Math.sin(i*7)*1.1;
      return [stones[0]+Math.cos(angle)*radius,stones[1]+Math.sin(angle)*radius];
    });
    positions.forEach(([x,z],i)=>box(x,z,2.5,2.9,Math.max(4,stoneTop-groundHeight(x,z)),'castle',i*.38));
    for(const i of [0,2,5,8]) {
      const a=positions[i],b=positions[(i+1)%positions.length];
      box((a[0]+b[0])/2,(a[1]+b[1])/2,Math.hypot(b[0]-a[0],b[1]-a[1])+2.3,2.5,1.1,'castle',-Math.atan2(b[1]-a[1],b[0]-a[0]),stoneTop,false);
    }
    label('Steinkreis',...stones,13,58);

    // Klosterhof und dachlose Kapelle: Öffnungen statt geschlossener Hauswürfel.
    const [cx,cz]=ruin;
    box(cx-19,cz,2,36,5,'castle');
    box(cx+19,cz-9,2,18,7,'castle'); box(cx+19,cz+13,2,10,3.5,'castle');
    for(const side of [-1,1]) {
      box(cx+side*12,cz+18,14,2,4,'castle');
      box(cx+side*12,cz-18,14,2,6,'castle');
      box(cx+side*7,cz-29,2,22,6.5,'castle');
    }
    box(cx,cz-40,16,2,8,'castle');
    box(cx-17,cz-26,5,5,13,'castle');
    for(const z of [-10,-3,4,11]) box(cx-11,cz+z,1.3,1.3,4.8,'castle');
    box(cx-11,cz,1.6,26,.8,'castle',0,groundHeight(cx-11,cz)+5,false);
    for(const [dx,dz] of [[-15,13],[15,-10],[-20,-6]]) box(cx+dx,cz+dz,3,2,1.3,'castle',dx*.1);
    label('Klosterruine',cx,cz,20,72);

    for(const [x,z,w,d,rotation,height] of layout.lakeHomes) {
      const house=box(x,z,w,d,height,'house',rotation);
      box(x,z,w+1,d+1,.6,'landmark',rotation,house.position.y+house.scale.y/2,false);
    }
    label('Seehäuser',-222,105,16,60);
    const islandTrees=layout.island.trees.map(([dx,dz],i)=>{
      const x=layout.island.x+dx,z=layout.island.z+dz,height=10+i*1.7;
      box(x,z,.7,.7,4.2,'landmark');
      const crown=new THREE.Mesh(NachtjagdImportedModels.pineGeometry(),materials.forest);
      crown.scale.set(3+i*.25,height,3+i*.25);
      crown.position.set(x,groundHeight(x,z)+4+height/2,z); crown.castShadow=true; scene.add(crown);
      return {x,z,height,crown};
    });
    // Der schmale Steg ist bereits als einfache Gehfläche über dem Wasser nutzbar.
    const dock={a:[-224,126],b:[-210,151],width:3.6,top:2.3};
    const dx=dock.b[0]-dock.a[0],dz=dock.b[1]-dock.a[1],length=Math.hypot(dx,dz),rotation=-Math.atan2(dz,dx);
    box((dock.a[0]+dock.b[0])/2,(dock.a[1]+dock.b[1])/2,length,dock.width,.4,'landmark',rotation,dock.top-.4,false);
    for(const t of [0,.33,.66,1]) for(const side of [-1,1]) {
      const x=dock.a[0]+dx*t-dz/length*side*1.4,z=dock.a[1]+dz*t+dx/length*side*1.4;
      box(x,z,.45,.45,Math.max(.5,dock.top-groundHeight(x,z)),'landmark',0,undefined,false);
    }
    label('Steg',...dock.b,8,36);

    // Zwei kurze Vorstollen mit Holzrahmen, Dach und Schienen; spätere Tiefen sind angedeutet.
    for(const mine of layout.mines) {
      const dx=mine.b[0]-mine.a[0],dz=mine.b[1]-mine.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
      const count=Math.ceil(length/4.5),rotation=-Math.atan2(dz,dx);
      const floor=(x,z)=>streetHeight(x,z) ?? groundHeight(x,z)+.4;
      for(let i=0;i<=count;i++) {
        const t=i/count,x=mine.a[0]+dx*t,z=mine.a[1]+dz*t,y=floor(x,z);
        for(const side of [-1,1]) box(x-uz*side*mine.width/2,z+ux*side*mine.width/2,.7,.7,5.5,'landmark',0,y);
        box(x,z,mine.width+.7,.8,.7,'landmark',rotation+Math.PI/2,y+5.2,false);
        if(i<count) {
          const mx=x+dx/count/2,mz=z+dz/count/2,my=floor(mx,mz);
          box(mx,mz,length/count+.2,mine.width+1,.95,'castle',rotation,my+5.15,false);
          for(const side of [-1,1]) box(mx-uz*side*.8,mz+ux*side*.8,length/count+.1,.12,.12,'mine',rotation,my+.03,false);
        }
      }
      box(mine.b[0]+ux*3,mine.b[1]+uz*3,mine.width,1,5.8,'mine',rotation+Math.PI/2,floor(...mine.b));
      label(mine.id==='mine-west'?'Westmine':'Nordmine',...mine.a,13,52);
    }
    return {
      stoneCount:positions.length,lakeHouseCount:layout.lakeHomes.length,islandTreeCount:islandTrees.length,
      refresh() {
        windWheel.position.y=groundHeight(...wind)+17;
        for(const tree of islandTrees) tree.crown.position.y=groundHeight(tree.x,tree.z)+4+tree.height/2;
      },
      floor(x,z) {
        const t=((x-dock.a[0])*dx+(z-dock.a[1])*dz)/(length*length);
        if(t<0 || t>1) return null;
        return Math.hypot(x-dock.a[0]-t*dx,z-dock.a[1]-t*dz)<=dock.width/2?dock.top:null;
      }
    };
  }
};
