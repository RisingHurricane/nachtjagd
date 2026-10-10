'use strict';

// Dieselben waagerechten Trittflächen bestimmen Darstellung und Augenhöhe.
globalThis.NachtjagdStairs = {
  create({ segments,nodes,offset=.4,maxRise=.2 }) {
    const treads=[];
    for(const segment of segments.filter(s=>s.stairs)) {
      const a=nodes[segment.a],b=nodes[segment.b],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      const count=Math.max(1,Math.ceil(length),Math.ceil(Math.abs(b.y-a.y)/maxRise));
      for(let i=0;i<count;i++) {
        const start=i/count,end=(i+1)/count,t=(start+end)/2;
        treads.push({x:a.x+dx*t,z:a.z+dz*t,length:length/count,width:segment.width,cos:dx/length,sin:dz/length,top:Math.max(a.y+(b.y-a.y)*start,a.y+(b.y-a.y)*end)+offset});
      }
    }
    return {
      treads,
      floor(x,z) {
        let top=null;
        for(const t of treads) {
          const dx=x-t.x,dz=z-t.z;
          if(Math.abs(dx*t.cos+dz*t.sin)<=t.length/2+.0001 && Math.abs(-dx*t.sin+dz*t.cos)<=t.width/2) top=top===null?t.top:Math.max(top,t.top);
        }
        return top;
      }
    };
  }
};
