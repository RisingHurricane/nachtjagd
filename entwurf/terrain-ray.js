'use strict';

// Exakte Dreieckstreffer im vorhandenen Höhenraster, ohne die ganze Landschaft abzusuchen.
globalThis.NachtjagdTerrainRay={
  create({THREE,heightAtGrid,cols=321,rows=281,step=5,x0=-800,z0=-705,cutTerrain=()=>false}) {
    const ray=new THREE.Ray(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),hit=new THREE.Vector3();
    function distance(origin,direction,maxRange) {
      ray.origin.set(origin.x,origin.y,origin.z);ray.direction.set(direction.x,direction.y,direction.z).normalize();
      const visited=new Set(),horizontal=Math.hypot(ray.direction.x,ray.direction.z),samples=Math.max(1,Math.ceil(maxRange*horizontal/(step/2)));
      let nearest=maxRange;
      const point=(v,col,row)=>v.set(x0+col*step,Math.fround(heightAtGrid(col,row)),z0+row*step);
      const triangle=(u,v,w)=>{
        if(!ray.intersectTriangle(u,v,w,true,hit))return;
        const t=hit.distanceTo(ray.origin);
        if(t>=.05&&t<nearest&&!cutTerrain(hit.x,hit.z))nearest=t;
      };
      for(let i=0;i<=samples;i++) {
        const t=Math.min(maxRange,i/samples*maxRange);
        if(t>nearest+step*3)break;
        const col=Math.floor((origin.x+ray.direction.x*t-x0)/step),row=Math.floor((origin.z+ray.direction.z*t-z0)/step);
        // Nachbarzellen sichern sehr kurze Durchtritte an Rasterecken ab.
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
          const x=col+dx,z=row+dz,key=z*cols+x;
          if(x<0||z<0||x>=cols-1||z>=rows-1||visited.has(key))continue;
          visited.add(key);point(a,x,z);point(b,x,z+1);point(c,x+1,z);point(d,x+1,z+1);
          triangle(a,b,c);triangle(d,c,b);
        }
      }
      return nearest;
    }
    return {distance};
  }
};
