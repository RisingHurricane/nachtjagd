'use strict';

// Gemeinsames Straßennetz: begrenzte Längsneigung und waagerechte Querschnitte.
globalThis.NachtjagdRoads = {
  create({ routes, height, anchors = [], maxGrade = .18 }) {
    const nodes = [], edges = [], segments = [], nodeMap = new Map(), buckets = new Map();
    const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
    const key = (x,z) => Math.round(x*1000)+','+Math.round(z*1000);
    function node(x,z) {
      const id = key(x,z);
      if (!nodeMap.has(id)) { nodeMap.set(id,nodes.length); nodes.push({ x,z,desired:height(x,z),links:[] }); }
      return nodeMap.get(id);
    }
    const lines = [];
    for (const route of routes) for (let i = 1; i < route.points.length; i++) lines.push({ a:route.points[i-1],b:route.points[i],width:route.width,id:route.id,bridge:route.bridge === i-1,cuts:[0,1] });
    // Echte Kreuzungen verbinden; Unterführung und Viadukt behalten getrennte Ebenen.
    for (let i = 0; i < lines.length; i++) for (let j = i+1; j < lines.length; j++) {
      const a=lines[i],b=lines[j]; if (a.bridge || b.bridge) continue;
      const dx=a.b[0]-a.a[0],dz=a.b[1]-a.a[1],ex=b.b[0]-b.a[0],ez=b.b[1]-b.a[1],det=dx*ez-dz*ex;
      if (Math.abs(det)<.00001) continue;
      const qx=b.a[0]-a.a[0],qz=b.a[1]-a.a[1],t=(qx*ez-qz*ex)/det,u=(qx*dz-qz*dx)/det;
      if (t>=0 && t<=1 && u>=0 && u<=1) { a.cuts.push(t); b.cuts.push(u); }
    }
    for (const line of lines) {
      const cuts=Array.from(new Set(line.cuts)).sort((a,b)=>a-b);
      for (let k=1;k<cuts.length;k++) {
        const start=cuts[k-1],end=cuts[k],dx=line.b[0]-line.a[0],dz=line.b[1]-line.a[1],length=Math.hypot(dx,dz)*(end-start);
        if (length<.001) continue;
        const count=line.bridge?1:Math.ceil(length/2), ids=[];
        for (let i=0;i<=count;i++) { const t=start+(end-start)*i/count; ids.push(node(line.a[0]+dx*t,line.a[1]+dz*t)); }
        for (let i=1;i<ids.length;i++) {
          const a=ids[i-1],b=ids[i],distance=length/count;
          // Kurze ebene Bereiche an Kurven und Kreuzungen verhindern verdrehte Anschlüsse.
          const flat=!line.bridge && (i*distance<=3 || (count-i+1)*distance<=3);
          const cost=flat?0:distance*maxGrade;
          nodes[a].links.push([b,cost]); nodes[b].links.push([a,cost]); edges.push({ a,b,cost });
          segments.push({ a,b,width:line.width,id:line.id,bridge:line.bridge,length:distance });
        }
      }
    }
    // Mehrquellen-Kürzestwege berechnen obere/untere zulässige Höhenhüllen.
    function envelope(values) {
      const result=values.slice(),heap=[];
      function push(item) {
        heap.push(item); let i=heap.length-1;
        while(i>0) { const p=(i-1)>>1; if(heap[p][0]<=item[0]) break; heap[i]=heap[p]; i=p; } heap[i]=item;
      }
      function pop() {
        const first=heap[0],last=heap.pop();
        if(heap.length) { let i=0; while(i*2+1<heap.length) { let c=i*2+1; if(c+1<heap.length && heap[c+1][0]<heap[c][0]) c++; if(heap[c][0]>=last[0]) break; heap[i]=heap[c]; i=c; } heap[i]=last; }
        return first;
      }
      result.forEach((v,i)=>{ if(Number.isFinite(v)) push([v,i]); });
      while(heap.length) {
        const [value,index]=pop(); if(value>result[index]+.0000001) continue;
        for(const [next,cost] of nodes[index].links) if(value+cost<result[next]-.0000001) { result[next]=value+cost; push([result[next],next]); }
      }
      return result;
    }
    const upper=envelope(nodes.map(n=>n.desired)),negativeLower=envelope(nodes.map(n=>-n.desired));
    const fixed=nodes.map(()=>Infinity),fixedNegative=fixed.slice();
    for(const anchor of anchors) { const index=nodeMap.get(key(...anchor.point)); if(index!==undefined) { fixed[index]=anchor.height; fixedNegative[index]=-anchor.height; } }
    const ceiling=envelope(fixed),floor=envelope(fixedNegative).map(v=>-v);
    const conflicts=nodes.filter((n,i)=>floor[i]>ceiling[i]+.001);
    if(conflicts.length) throw new Error('Straßenanschlüsse brauchen längere Anstiege: '+JSON.stringify(anchors.map(a=>{const i=nodeMap.get(key(...a.point));return {point:a.point,target:a.height,lower:floor[i],upper:ceiling[i]};})));
    nodes.forEach((n,i)=>{ n.y=clamp((upper[i]-negativeLower[i])/2,floor[i],ceiling[i]); });
    function project(segment,x,z) {
      const a=nodes[segment.a],b=nodes[segment.b],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      return { distance:Math.hypot(x-a.x-t*dx,z-a.z-t*dz),y:a.y+(b.y-a.y)*t };
    }
    for(const segment of segments) {
      const a=nodes[segment.a],b=nodes[segment.b],padding=segment.width/2+12;
      for(let x=Math.floor((Math.min(a.x,b.x)-padding)/16);x<=Math.floor((Math.max(a.x,b.x)+padding)/16);x++) for(let z=Math.floor((Math.min(a.z,b.z)-padding)/16);z<=Math.floor((Math.max(a.z,b.z)+padding)/16);z++) {
        const id=x+','+z; if(!buckets.has(id)) buckets.set(id,[]); buckets.get(id).push(segment);
      }
    }
    return {
      nodes,segments,maxGrade,project,
      nearby(x,z) { return buckets.get(Math.floor(x/16)+','+Math.floor(z/16))||[]; },
      clearance(x,z) {
        let distance=Infinity;
        for(const s of this.nearby(x,z)) distance=Math.min(distance,project(s,x,z).distance-s.width/2);
        return distance;
      },
      grade(x,z,ground) {
        const nearby=buckets.get(Math.floor(x/16)+','+Math.floor(z/16))||[];
        let best=Infinity,target=ground,weight=0,body=Infinity,bridgeCeiling=Infinity;
        for(const s of nearby) {
          const p=project(s,x,z),edge=p.distance-s.width/2-5;
          if(s.bridge) { if(edge<=0) bridgeCeiling=Math.min(bridgeCeiling,p.y); continue; }
          if(edge<=0) body=Math.min(body,p.y);
          if(edge<best) { best=edge; target=p.y; const t=clamp(edge/7,0,1); weight=1-t*t*(3-2*t); }
        }
        return Math.min(bridgeCeiling,Number.isFinite(body)?body:ground+(target-ground)*weight);
      }
    };
  }
};
