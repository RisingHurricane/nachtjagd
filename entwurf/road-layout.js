'use strict';

// Straßenführung und feste Anschlusshöhen der Weltstudie.
globalThis.NachtjagdRoadLayout = ({ height,castle }) => {
  // Das Viadukt mündet direkt vor dem Burgtor (Tor bei x ≈ -242, z = -100).
  const bridgeSpec={ a:[-230,-100],b:[-120,-180],width:8,arches:7 };
  const bridgeDx=bridgeSpec.b[0]-bridgeSpec.a[0],bridgeDz=bridgeSpec.b[1]-bridgeSpec.a[1],bridgeLength=Math.hypot(bridgeDx,bridgeDz);
  const bridgePoint=s=>[bridgeSpec.a[0]+bridgeDx*s/bridgeLength,bridgeSpec.a[1]+bridgeDz*s/bridgeLength];
  const castleRoute=[[90,45],[72,40],[58,41],[44,48],[28,44],[12,49],[-5,45],[-50,30],[-65,-20],[-55,-95],[-65,-145],bridgePoint(bridgeLength+10),bridgeSpec.b,bridgeSpec.a,[-248,-100]]; // vom Viaduktende geradeaus durch das Tor
  const southRoad=[[90,45],[104,52],[106,67],[113,86],[109,100],[115,112],[110,143],[140,174],[200,185]];
  const southLoop=[[200,185],[215,240],[175,275],[80,265],[55,225],[15,180],[-45,150],[-90,162],[-110,170]];
  const shoreRoute=[...southRoad,...southLoop.slice(1)];
  const routes=[
    { id:'castle',points:castleRoute,width:6,bridge:castleRoute.indexOf(bridgeSpec.b) },
    { id:'east',points:[[90,45],[111,40],[124,44],[138,37],[154,41],[170,48],[185,45],[221,60],[245,99]],width:7 },
    { id:'church',points:[[90,45],[90,25]],width:5 },
    { id:'south',points:southRoad,width:5 },
    // Zweite Dorfstraße aus dem Dorfplan: vom Weg zum Südtor nach Westen
    { id:'lower-street',points:[[106,67],[88,76],[70,79],[52,88],[34,85],[14,92]],width:5.5 },
    { id:'south-loop',points:southLoop,width:5 },
    { id:'lake-loop',points:[[-190,0],[-270,-20],[-290,25],[-275,70],[-215,108],[-140,130],[-65,135],[-45,150]],width:4 },
    { id:'lower-forest',points:[[-50,30],[-120,25],[-190,0]],width:4 },
    { id:'east-loop',points:[[185,45],[250,0],[288,-65],[220,-120],[135,-145],[65,-125],[-55,-95]],width:5 },
    { id:'east-link',points:[[245,99],[275,145],[260,205],[215,240]],width:4 },
    { id:'wind-path',points:[[215,240],[245,260],[250,255]],width:3 },
    { id:'stone-path',points:[[135,-145],[170,-130],[170,-110]],width:3 },
    { id:'ruin-path',points:[[275,145],[300,150],[300,132]],width:3 },
    { id:'mine-west',points:[[-270,-20],[-310,-5],[-340,-15]],width:3.5 },
    { id:'mine-north',points:[[-65,-145],[-40,-170],[-55,-185]],width:3.5 }
  ];
  const anchors=[
    { point:[90,45],height:height(90,45) },
    { point:[-248,-100],height:castle.height },
    { point:bridgeSpec.a,height:height(...bridgeSpec.a) },
    { point:bridgeSpec.b,height:height(...bridgeSpec.b) },
    { point:[-110,170],height:height(-110,170) }
  ];
  return { bridgeSpec,castleRoute,shoreRoute,routes,anchors };
};
