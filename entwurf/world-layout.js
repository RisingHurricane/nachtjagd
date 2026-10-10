'use strict';

// Norden ist -z. Die Orte und Waldflächen folgen der farbigen Nutzerskizze.
globalThis.NachtjagdLayout = (() => {
  const village = { x: 90, z: 45 };
  // Unregelmäßiger Dorfrand mit drei Toren und drei offenen Mauerabschnitten.
  const villageOutline=[[-5,51],[-5,39],[-15,15],[0,-14],[36,-30],[76,-26],[115,-18],[150,-28],[180,-10],[198,18],[185,39],[185,51],[198,76],[186,105],[150,124],[121,112],[109,112],[80,126],[42,118],[10,109],[-14,83]];
  const villageGates=[[-5,45],[185,45],[115,112]];
  const villageWalls=villageOutline.map((a,i)=>[a,villageOutline[(i+1)%villageOutline.length]])
    .filter(([a,b],i)=>![4,12,18].includes(i) && !villageGates.some(g=>Math.hypot((a[0]+b[0])/2-g[0],(a[1]+b[1])/2-g[1])<.01));
  const castle = { x: -265, z: -100, height: 102 };
  const lake = [[-418,312],[-405,242],[-375,168],[-334,115],[-317,69],[-293,82],[-268,116],[-213,147],[-149,170],[-81,194],[-12,218],[18,242],[-24,280],[-113,325],[-237,348],[-350,346],[-410,332]];
  const forestBands = [
    [[-130,-145],[-60,-165],[25,-142],[125,-102],[211,-34],[255,62]],
    [[-115,-134],[-128,-60],[-100,5],[-142,65],[-65,57],[0,70]],
    [[255,40],[247,131],[201,196],[142,178],[75,173],[22,150]],
    [[227,170],[255,225],[175,222],[112,201]],
    [[-295,-15],[-250,25],[-195,65],[-120,85]],
    [[55,235],[130,275],[225,280],[295,200]]
  ];
  // Feste, unregelmäßige Bergformen; identisch nach Neuladen und bei allen Spielern.
  const variation=i=>{ const n=Math.sin(i*127.1+71.7)*43758.5453; return n-Math.floor(n); };
  const middleSites = [[-370,-293,130],[-270,-315,155],[-155,-285,135],[-50,-329,165],[65,-293,145],[182,-313,155],[310,-280,130],[-475,-185,135],[-465,-50,120],[-480,85,140],[-470,222,125],[-358,342,120],[-205,405,110],[-60,405,130],[82,405,110],[221,395,125],[355,302,140],[390,180,145],[385,42,120],[397,-93,140],[375,-207,130]];
  const middlePeaks=middleSites.map(([x,z,top],i)=>({x:x+(variation(i+1)-.5)*24,z:z+(variation(i+31)-.5)*20,top:top*(.78+.48*variation(i+61)),rx:105+85*variation(i+91),rz:100+80*variation(i+121),rotation:(variation(i+151)-.5)*1.4}));
  const highPeaks=Array.from({length:24},(_,i)=>{
    const angle=(i+(variation(i+181)-.5)*.38)/24*Math.PI*2;
    const x=-40+(600+40*(variation(i+211)-.5))*Math.cos(angle),z=(540+40*(variation(i+241)-.5))*Math.sin(angle);
    return {x,z,top:235+180*variation(i+271)+(z<0?30:0),rx:Math.min(105+70*variation(i+301),780-Math.abs(x)),rz:Math.min(100+65*variation(i+331),675-Math.abs(z)),rotation:(variation(i+361)-.5)*1.1};
  });
  for(const peak of [...middlePeaks,...highPeaks]) { peak.cos=Math.cos(peak.rotation); peak.sin=Math.sin(peak.rotation); }
  const foothillGroups=[[-445,-135,48],[-410,65,45],[325,-215,50],[200,-195,48],[20,-235,45],[305,210,45],[45,365,50]];
  const ridgeGroups=[[-270,-405,38],[-110,-415,40],[125,-395,38],[350,-305,36],[-535,-20,38],[465,60,40]];
  // Wenige größere Lichtungen gleichen die neuen Hanggruppen aus.
  const clearings=[[-95,-105,27,22],[220,120,24,29],[90,255,29,23]];
  const treeGroups = [[-345,-170,24],[-320,20,23],[-235,75,28],[-35,105,24],[15,-65,22],[70,240,30],[210,315,27],[300,-135,30],[320,20,23]];
  const allTreeGroups=[...treeGroups,...foothillGroups,...ridgeGroups];
  // Kleine Hausgruppen und versetzte Höfe statt gleichmäßiger Zeilen.
  const houseSites = [[19,-5],[41,-9],[63,0],[11,12],[24,17],[48,19],[66,18],[119,-5],[141,-13],[165,-4],[115,16],[141,18],[166,17],[16,76],[37,72],[58,77],[82,74],[102,76],[133,75],[157,74],[174,89],[10,89],[39,99],[68,106],[95,98],[130,100],[147,108],[171,96]];
  const houses = houseSites.map(([x,z],i)=>[x,z,7.5+i%3*1.2,8+i%4,(i%5-2)*.12,6+i%5,i%4]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function smooth(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }
  // Negativ innerhalb, positiv außerhalb: dieselbe Kontur für Boden und Vegetation.
  function polygonDistance(polygon,x,z) {
    let inside = false, distance = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      distance = Math.min(distance, segmentDistance(x, z, a, b));
    }
    return inside ? -distance : distance;
  }
  const lakeDistance=(x,z)=>polygonDistance(lake,x,z);
  const villageDistance=(x,z)=>polygonDistance(villageOutline,x,z);
  function clearingWeight(x,z) {
    let weight=1;
    for(const [cx,cz,rx,rz] of clearings) weight=Math.min(weight,smooth(.55,1,Math.hypot((x-cx)/rx,(z-cz)/rz)));
    return weight;
  }
  function forestWeight(x, z) {
    let distance = Infinity;
    for (const band of forestBands) for (let i = 1; i < band.length; i++) distance = Math.min(distance, segmentDistance(x, z, band[i - 1], band[i]));
    return (1 - smooth(35, 68, distance))*clearingWeight(x,z);
  }
  function treeWeight(x,z) {
    let weight=forestWeight(x,z);
    for(const [cx,cz,r] of allTreeGroups) weight=Math.max(weight,.8*(1-smooth(r*.55,r,Math.hypot(x-cx,z-cz))));
    return weight*clearingWeight(x,z);
  }
  function naturalHeight(x, z) {
    let h = 24 - z * .018 + 18 * Math.sin(x / 95) * Math.cos(z / 73) + 10 * Math.sin((x + z) / 47);
    h += 45 * Math.exp(-(((x - 180) / 115) ** 2) - ((z - 120) / 110) ** 2);
    h += 25 * Math.exp(-(((x + 100) / 80) ** 2) - ((z - 25) / 95) ** 2);
    h += 25 * Math.exp(-(((x + 230) / 85) ** 2) - ((z - 35) / 85) ** 2);
    h += 24 * Math.exp(-(((x - 57) / 92) ** 2) - ((z + 10) / 72) ** 2);
    // Unebene Vorberge schließen die Lücke zwischen Dorfhügel und Gebirgsfuß.
    const foothills=smooth(-35,25,x);
    h += foothills*(52*Math.exp(-(((x-145)/140)**2)-(((z+125)/95)**2))+28*Math.exp(-(((x-30)/85)**2)-(((z+210)/85)**2)));
    h += foothills*12*Math.sin(x/37+z/51)*Math.exp(-(((z+125)/140)**2));
    // Zusammenhängende, gewellte Bergrücken füllen die tiefen Spalten zwischen den Reihen.
    // Der innere Bereich bleibt frei: Burgsporn und Viaduktsenke werden nicht angehoben.
    const ring=Math.hypot((x+40)/600,z/540);
    const shoulder=smooth(.48,.69,ring)*(1-smooth(.98,1.16,ring));
    const ridge=112+20*Math.sin(x/85+z/115)+15*Math.cos(z/63-x/130)+9*Math.sin((x+z)/41);
    h=Math.max(h,24+(ridge-24)*shoulder);
    // Der bisherige Ring wird zu weicheren, mittelhohen Bergen.
    for(const peak of middlePeaks) {
      const x0=x-peak.x,z0=z-peak.z,c=peak.cos,s=peak.sin;
      const r=Math.hypot((x0*c+z0*s)/peak.rx,(-x0*s+z0*c)/peak.rz);
      if(r<1) h=Math.max(h,24+(peak.top-24)*(1-smooth(0,1,r)));
    }
    // Äußere Hochgipfel unterscheiden sich in Höhe, Fußabdruck und Ausrichtung.
    for(const peak of highPeaks) {
      const x0=x-peak.x,z0=z-peak.z,c=peak.cos,s=peak.sin;
      const dx=(x0*c+z0*s)/peak.rx,dz=(-x0*s+z0*c)/peak.rz;
      const r=Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dx*.72+dz*.63));
      if(r<1) h=Math.max(h,30+(peak.top-30)*(1-r));
    }
    // Ein niedriger Widerlagerhügel erhält den bestehenden Brückenanschluss.
    const bridgeHill=Math.hypot((x+120)/55,(z+180)/55);
    if(bridgeHill<1) h=Math.max(h,73.11111111111111*(1-smooth(0,1,bridgeHill)));
    // Freier Sporn mit steilen Flanken; ein schmaler Rücken verbindet ihn nach Osten.
    const dx = x - castle.x, dz = z - castle.z;
    const spur = Math.max(Math.abs(dx) / 64, Math.abs(dz) / 58, Math.abs(dx + dz * .35) / 75);
    const shelf = castle.height - 3 + 3 * Math.sin(x / 13) * Math.cos(z / 17);
    h = Math.max(h, h + (shelf - h) * (1 - clamp((spur - .74) / .28, 0, 1)));
    const along = clamp((x + 221) / 128, 0, 1);
    if (x > -225 && x < -90) {
      const ridge = (94 - 48 * along) * (1 - smooth(9, 30, Math.abs(z + 82 - 18 * along)));
      h = Math.max(h, ridge);
    }
    const shore = lakeDistance(x, z);
    // Breiter, sanfter Ufersaum; die Hügel steigen erst hinter dem Strand an.
    return shore < 0 ? Math.max(-7, shore * .25) : shore * .07 * (1-smooth(30,130,shore)) + Math.max(3,h) * smooth(30,130,shore);
  }
  return { village, villageOutline, villageGates, villageWalls, castle, lake, houses, forestBands, treeGroups, foothillGroups, ridgeGroups, clearings, middlePeaks, highPeaks, smooth, segmentDistance, lakeDistance, villageDistance, clearingWeight, forestWeight, treeWeight, naturalHeight, basis: 'bergdorf-bergruecken-2026-10-11-v6' };
})();
