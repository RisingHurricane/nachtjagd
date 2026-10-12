'use strict';

// Gemeinsame Spielwelt: Gelände, Gebäude, Wege und höhenabhängige Kollision.
(() => {
  const status = document.querySelector('#status'), help = document.querySelector('#help');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
  catch (error) {
    const notice = document.querySelector('#error');
    notice.hidden = false;
    notice.textContent = 'Die 3D-Ansicht benötigt WebGL. Bitte die Grafikbeschleunigung im Browser aktivieren.';
    status.textContent = 'Grafik konnte nicht gestartet werden.';
    return;
  }
  // Moderate Startauflösung; langsame Geräte werden zusätzlich automatisch entlastet.
  let pixelRatio = Math.min(devicePixelRatio, 1.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.body.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Dreidimensionaler Blockout des Bergdorfs auf der Hochebene');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cbd8dc');
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 3500);
  const hemi = new THREE.HemisphereLight(0xf9fbff, 0x6d786c, .7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff7e5, .7);
  sun.position.set(-80, 180, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, far: 650 });
  sun.shadow.bias = -.0005;
  scene.add(sun);
  const sky = NachtjagdSky.create({ THREE, scene, sun, hemi });
  const layoutSky = { night: 0, sunrise: 0, cover: .62, grey: 0, blood: 0, lightK: 1 };
  scene.background = sky.apply(layoutSky);
  const colors = { ground: '#e4e7df', house: '#d6ba92', landmark: '#b59370', forest: '#658777', path: '#dfe6eb', castle: '#8a9aab', viaduct: '#b7ad97', water: '#8eb0bc', hill: '#bac3b4' };
  const materials = {};
  for (const [key, value] of Object.entries(colors)) materials[key] = new THREE.MeshLambertMaterial({ color: new THREE.Color(value).convertSRGBToLinear() });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1), coneGeometry = NachtjagdImportedModels.pineGeometry();
  materials.forest.vertexColors = true; materials.forest.color.setRGB(1,1,1);
  const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#526266', transparent: true, opacity: .3 });
  const colliders = [], anchors = [], roadMeshes = [], labelAnchors = [], treePlacements = [], coverPlacements=[];
  const roadVertices=[],roadIndices=[],roadRanges=[];
  const labels = new THREE.Group();
  scene.add(labels);
  const layout = NachtjagdLayout;
  let landmarks = null, buildings = null, mines = null, villageWall = null;
  const { houses, village, castle, naturalHeight } = layout;
  function smooth(a, b, value) {
    const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  const buildingSpecs=NachtjagdBuildings.describe(houses);
  const churchOrigin={x:91,z:24.5,y:0};
  // Jeder mehrteilige Bau bekommt ein gemeinsames waagerechtes Fundament.
  const pads=buildingSpecs.map(h=>({x:(h.bounds.x0+h.bounds.x1)/2,z:(h.bounds.z0+h.bounds.z1)/2,w:(h.bounds.x1-h.bounds.x0)/2+1,d:(h.bounds.z1-h.bounds.z0)/2+1,y:naturalHeight(h.x,h.z),blend:3}));
  pads.push(
    { x: village.x, z: village.z, w: 13, d: 10, y: naturalHeight(village.x, village.z), blend: 4 },
    { x: 91, z: 9, w: 12, d: 17, y: naturalHeight(91,27.5)+.25, blend: 4 },
    { x: castle.x + .7, z: castle.z + 2.3, w: 24.5, d: 26.5, y: castle.height, blend: 10 }
  );
  pads.push(...pads.splice(0, houses.length));
  const [windX,windZ]=layout.landmarkSites.wind;
  pads.push({x:windX,z:windZ,w:5,d:5,y:naturalHeight(windX,windZ),blend:7});
  const [stoneX,stoneZ]=layout.landmarkSites.stones;
  pads.push({x:stoneX,z:stoneZ,w:19,d:19,y:naturalHeight(stoneX,stoneZ),blend:8});
  for(const [x,z,w,d] of layout.lakeHomes) pads.push({x,z,w:w/2+1,d:d/2+1,y:naturalHeight(x,z),blend:3});
  for(const [x,z] of layout.gondolaCorridor) pads.push({x,z,w:9,d:9,y:naturalHeight(x,z),blend:8});
  function unpavedHeight(x, z) {
    let h = naturalHeight(x, z);
    for (const pad of pads) {
      const delta = Math.max(Math.abs(x - pad.x) - pad.w, Math.abs(z - pad.z) - pad.d, 0);
      h = THREE.MathUtils.lerp(pad.y, h, smooth(0, pad.blend, delta));
    }
    return h;
  }
  const { bridgeSpec,castleRoute,shoreRoute,routes,anchors:roadAnchors }=NachtjagdRoadLayout({ height:unpavedHeight,castle });
  const roadNetwork=NachtjagdRoads.create({ routes,height:unpavedHeight,maxGrade:.18,anchors:roadAnchors });
  for(const h of buildingSpecs) {
    const p=h.approaches[0];
    const road=roadNetwork.segments.filter(s=>!s.bridge).map(s=>roadNetwork.project(s,p.x,p.z)).sort((a,b)=>a.distance-b.distance)[0];
    h.y=road.y+.4;
    pads[3+h.id].y=h.y;
  }
  churchOrigin.y=streetHeight(91,27.5)+.25;
  // Zwischen den Straßen eine zusammenhängende Hangfläche statt einzelner tiefer Baugruben.
  const villageRoadNodes=roadNetwork.nodes.filter(n=>layout.villageDistance(n.x,n.z)<25);
  function villageGround(x,z,h) {
    const edge=layout.villageDistance(x,z);
    if(edge>=22)return h;
    let total=0,y=0;
    for(const n of villageRoadNodes) {
      const distance=Math.hypot(n.x-x,n.z-z),weight=1/Math.pow(8+distance,3);
      total+=weight;y+=weight*n.y;
    }
    return THREE.MathUtils.lerp(y/total+.2,h,smooth(-8,22,edge));
  }
  const baseHeights = new Float32Array(321 * 281);
  for (let row = 0; row <= 280; row++) for (let col = 0; col <= 320; col++) {
    const x=col*5-800,z=row*5-705;
    baseHeights[row*321+col]=villageGround(x,z,unpavedHeight(x,z));
  }
  const terrainModel = NachtjagdTerrain.create({ width: 321, depth: 281, step: 5, originX: -800, originZ: -705, base: baseHeights, basis: layout.basis, maxHeight: 650 });
  const storageKey = 'nachtjagd-bergdorf-minen-v9';
  let restored = false, storageWarning = '';
  try { const saved = localStorage.getItem(storageKey); if (saved) { terrainModel.load(saved, false); restored = true; } }
  catch { storageWarning = 'Browserstand konnte nicht geladen werden. Du kannst eine Geländedatei laden.'; }
  const stairs = NachtjagdStairs.create(roadNetwork);
  const stairMeshes = [];
  const renderedHeights = new Float32Array(baseHeights.length);
  // Nach dem Einebnen kann ein 5-m-Dreieck an Kurven oder Kreuzungen noch über der Fahrbahn liegen. Dort wird der Boden
  // unter der Fahrbahn so weit abgesenkt, dass sie nie vergraben ist; das Absenken verteilt sich auf die drei Eckpunkte.
  function settleRoads() {
    for(const s of roadNetwork.segments) {
      if(s.stairs||s.bridge) continue;
      const a=roadNetwork.nodes[s.a],b=roadNetwork.nodes[s.b],len=Math.hypot(b.x-a.x,b.z-a.z);
      if(len<.001) continue;
      const nx=(b.z-a.z)/len,nz=-(b.x-a.x)/len,steps=Math.max(1,Math.ceil(len/.75)),across=Math.max(2,Math.ceil(s.width/.75));
      for(let j=0;j<=steps;j++) for(let k=0;k<=across;k++) {
        const off=s.width*(k/across-.5),x=a.x+(b.x-a.x)*j/steps+nx*off,z=a.z+(b.z-a.z)*j/steps+nz*off;
        const road=roadNetwork.project(s,x,z).y+.4-.05;
        const ix=Math.floor((x+800)/5),iz=Math.floor((z+705)/5),tx=(x-(ix*5-800))/5,tz=(z-(iz*5-705))/5;
        const lower=tx+tz<=1;
        const i0=iz*321+ix,i1=iz*321+ix+1,i2=(iz+1)*321+ix,i3=(iz+1)*321+ix+1;
        const idx=lower?[i0,i1,i2]:[i3,i2,i1],w=lower?[1-tx-tz,tx,tz]:[tx+tz-1,1-tx,1-tz];
        const ground=renderedHeights[idx[0]]*w[0]+renderedHeights[idx[1]]*w[1]+renderedHeights[idx[2]]*w[2];
        const deficit=ground-road;
        if(deficit>0) { const norm=w[0]*w[0]+w[1]*w[1]+w[2]*w[2]; for(let m=0;m<3;m++) renderedHeights[idx[m]]-=deficit*w[m]/norm; }
      }
    }
  }
  function updateHeightGrid() {
    for (let i=0;i<baseHeights.length;i++) { const x=i%321*5-800,z=Math.floor(i/321)*5-705; renderedHeights[i]=roadNetwork.grade(x,z,baseHeights[i]+terrainModel.offsets[i]); }
    // Erst die Neigung der groben Kegel begrenzen (keine Nadeln), danach Felsrelief aufsetzen.
    NachtjagdRelief.limitSlope(renderedHeights,321,281,5);
    for (let i=0;i<baseHeights.length;i++) { const x=i%321*5-800,z=Math.floor(i/321)*5-705; renderedHeights[i]=NachtjagdRelief.relief(x,z,renderedHeights[i]); }
    NachtjagdRelief.limitSlope(renderedHeights,321,281,5,1.65,0.3);
    NachtjagdRelief.smoothGrid(renderedHeights,321,281);
    settleRoads();
    // Das sichtbare Dreiecksraster darf keine Innenräume auffüllen, auch bei altem Browsergelände.
    for(let i=0;i<renderedHeights.length;i++) {
      const x=i%321*5-800,z=Math.floor(i/321)*5-705;
      const churchDistance=Math.max(77-x,x-105,-9-z,z-28,0);
      renderedHeights[i]=Math.min(renderedHeights[i],THREE.MathUtils.lerp(churchOrigin.y-.35,renderedHeights[i],smooth(5,14,churchDistance)));
      for(const h of buildingSpecs) {
        const b=h.bounds;
        const distance=Math.max(b.x0-x,x-b.x1,b.z0-z,z-b.z1,0);
        if(distance<14)renderedHeights[i]=Math.min(renderedHeights[i],THREE.MathUtils.lerp(h.y-.08,renderedHeights[i],smooth(5,14,distance)));
      }
    }
  }
  updateHeightGrid();
  function vertexHeight(col, row) {
    col = THREE.MathUtils.clamp(col, 0, 320); row = THREE.MathUtils.clamp(row, 0, 280);
    const index = row * 321 + col;
    return renderedHeights[index];
  }
  // Dieselben Dreiecke wie im sichtbaren Boden bestimmen Wege und Augenhöhe.
  function groundHeight(x, z) {
    const ix = Math.floor((x + 800) / 5), iz = Math.floor((z + 705) / 5);
    const x0 = ix * 5 - 800, z0 = iz * 5 - 705, tx = (x - x0) / 5, tz = (z - z0) / 5;
    const a = vertexHeight(ix, iz), b = vertexHeight(ix + 1, iz), c = vertexHeight(ix, iz + 1), d = vertexHeight(ix + 1, iz + 1);
    return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  const bridgeAnchors=[bridgeSpec.a,bridgeSpec.b].map(point=>roadNetwork.nodes.find(n=>Math.hypot(n.x-point[0],n.z-point[1])<.001));
  const viaduct = NachtjagdViaduct.create({ ...bridgeSpec,groundHeight:(x,z)=>{
    const anchor=bridgeAnchors.find(n=>Math.hypot(n.x-x,n.z-z)<.001);
    return anchor?anchor.y:groundHeight(x,z);
  } });
  function streetHeight(x,z) {
    let best=Infinity,y=null;
    for(const segment of roadNetwork.nearby(x,z)) {
      if(segment.bridge) continue;
      const p=roadNetwork.project(segment,x,z);
      if(p.distance<=segment.width/2 && p.distance<best) { best=p.distance; y=p.y+.4; }
    }
    return y;
  }
  function surfaceHeight(x,z,previousFeet) {
    const deck=landmarks && landmarks.floor(x,z);
    if(deck!==null && deck!==false) return deck;
    const bridge=viaduct.floor(x,z,previousFeet),street=streetHeight(x,z);
    if(viaduct.contains(x,z) && Math.abs(bridge-viaduct.top(viaduct.coordinates(x,z).s))<.5) return bridge;
    const step=stairs.floor(x,z);
    return step!==null?step:street===null?bridge:street;
  }
  function box(x, z, w, d, h, material = 'house', rotation = 0, floor, solid = true) {
    const anchor = { x, z, w, d, h, rotation, automatic: floor === undefined, offset: floor === undefined ? 0 : floor - groundHeight(x, z) };
    if (floor === undefined) {
      const heights = [];
      for (const a of [-w / 2, w / 2]) for (const b of [-d / 2, d / 2]) {
        heights.push(groundHeight(x + Math.cos(rotation) * a + Math.sin(rotation) * b, z - Math.sin(rotation) * a + Math.cos(rotation) * b));
      }
      // Der einfache Baukörper reicht als Sockel bis in den tiefsten Hangpunkt.
      floor = Math.min(...heights) - .08;
      h += Math.max(...heights) - floor;
    }
    const mesh = new THREE.Mesh(boxGeometry, materials[material]);
    mesh.position.set(x, floor + h / 2, z);
    mesh.scale.set(w, h, d);
    mesh.rotation.y = rotation;
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    scene.add(mesh);
    anchors.push({ ...anchor, mesh });
    if (solid) {
      mesh.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
      colliders.push({ x, z, w: w / 2, d: d / 2, rotation });
    }
    return mesh;
  }
  const groundGeometry = new THREE.PlaneGeometry(1600, 1400, 320, 280);
  groundGeometry.rotateX(-Math.PI / 2);
  groundGeometry.translate(0, 0, -5);
  const positions = groundGeometry.attributes.position;
  const terrainColors = [];
  for (let i = 0; i < positions.count; i++) {
    const height = vertexHeight(i%321,Math.floor(i/321));
    positions.setY(i, height);
    const color = new THREE.Color('#f3f5f7').convertSRGBToLinear();
    color.lerp(new THREE.Color('#e0e7ed').convertSRGBToLinear(), layout.treeWeight(positions.getX(i),positions.getZ(i))*.34);
    color.lerp(new THREE.Color('#8c9da4').convertSRGBToLinear(), smooth(60, 115, height));
    color.lerp(new THREE.Color('#e7ebe7').convertSRGBToLinear(), smooth(165, 240, height));
    terrainColors.push(color.r, color.g, color.b);
  }
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  groundGeometry.computeVertexNormals();
  const terrainMaterial = NachtjagdTerrainMaterial.create(THREE), terrainUniforms = terrainMaterial.userData.uniforms;
  const ground = new THREE.Mesh(groundGeometry, terrainMaterial);
  ground.receiveShadow = true;
  scene.add(ground);
  const gridPositions = [];
  for (let v = -170; v <= 220; v += 10) {
    for (let t = -170; t < 220; t += 5) {
      gridPositions.push(v, groundHeight(v, t) + .04, t, v, groundHeight(v, t + 5) + .04, t + 5);
      gridPositions.push(t, groundHeight(t, v) + .04, v, t + 5, groundHeight(t + 5, v) + .04, v);
    }
  }
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3)), new THREE.LineBasicMaterial({ color: '#8eaaa1', transparent: true, opacity: .27 }));
  scene.add(grid);
  function road(segment) {
      const an=roadNetwork.nodes[segment.a],bn=roadNetwork.nodes[segment.b];
      const a=[an.x,an.z],b=[bn.x,bn.z],width=segment.width,dx=b[0]-a[0],dz=b[1]-a[1];
      const length = Math.hypot(dx, dz), count = Math.ceil(length * 2), across = Math.ceil(width * 2);
      const vertices = [], indices = [];
      for (let j = 0; j <= count; j++) {
        const x = a[0] + dx * j / count, z = a[1] + dz * j / count;
        for (let k = 0; k <= across; k++) {
          const offset = width * (k / across - .5);
          const px = x + dz / length * offset, pz = z - dx / length * offset;
          const height=segment.bridge?viaduct.top(viaduct.coordinates(x,z).s)-.4:an.y+(bn.y-an.y)*j/count;
          vertices.push(px,height+.4,pz);
          if (j < count && k < across) {
            const index = j * (across + 1) + k, next = index + across + 1;
            indices.push(index, next, index + 1, index + 1, next, next + 1);
          }
        }
      }
      const start=roadVertices.length/3;
      for(const value of vertices) roadVertices.push(value);
      for(const index of indices) roadIndices.push(index+start);
      roadRanges.push({ segment,start,count:vertices.length/3,across:across+1 });
  }
  function label(text, x, z, height = 4, size = 13) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 100;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(250,251,245,.93)'; context.fillRect(0, 8, 512, 84);
    context.fillStyle = '#28423f'; context.font = '600 39px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 50);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.position.set(x, Math.max(0, groundHeight(x, z)) + height, z); sprite.scale.set(size, size / 5.12, 1);
    labels.add(sprite);
    labelAnchors.push({ sprite, x, z, height });
  }
  buildings=NachtjagdBuildings.create({THREE,scene,specs:buildingSpecs,height:groundHeight,churchOrigin});
  const houseMeshes=buildings.houses.map(h=>h.model);
  const viaductGroup = new THREE.Group();
  viaductGroup.position.set(viaduct.a[0],0,viaduct.a[1]);
  viaductGroup.rotation.y = -Math.atan2(viaduct.sine,viaduct.cosine); scene.add(viaductGroup);
  function refreshViaduct() {
    viaduct.refresh();
    while (viaductGroup.children.length) {
      const child = viaductGroup.children[0]; child.geometry.dispose(); viaductGroup.remove(child);
    }
    function extrude(shape, depth, lateral) {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
      geometry.translate(0,0,lateral);
      const mesh = new THREE.Mesh(geometry,materials.viaduct); mesh.castShadow = mesh.receiveShadow = true;
      viaductGroup.add(mesh);
    }
    function strip(bottom,top,depth,lateral) {
      const shape = new THREE.Shape();
      shape.moveTo(0,viaduct.top(0)+bottom); shape.lineTo(viaduct.length,viaduct.top(viaduct.length)+bottom);
      shape.lineTo(viaduct.length,viaduct.top(viaduct.length)+top); shape.lineTo(0,viaduct.top(0)+top); shape.closePath();
      extrude(shape,depth,lateral);
    }
    strip(-1.5,0,viaduct.width,-viaduct.width/2);
    strip(0,1.35,.55,-viaduct.width/2); strip(0,1.35,.55,viaduct.width/2-.55);
    for (let i = 0; i < viaduct.arches; i++) {
      const left = i * viaduct.span + viaduct.pierWidth/2, right = (i+1)*viaduct.span-viaduct.pierWidth/2;
      const radius = (right-left)/2, middle = (left+right)/2;
      const spring = Math.min(viaduct.top(i*viaduct.span),viaduct.top((i+1)*viaduct.span))-3-radius;
      const arch = new THREE.Shape();
      arch.moveTo(left,viaduct.top(left)-1.5); arch.lineTo(right,viaduct.top(right)-1.5); arch.lineTo(right,spring);
      for (let k = 1; k <= 20; k++) { const angle = k/20*Math.PI; arch.lineTo(middle+radius*Math.cos(angle),spring+radius*Math.sin(angle)); }
      arch.closePath(); extrude(arch,viaduct.width-.6,-viaduct.width/2+.3);
    }
    for (let i = 0; i <= viaduct.arches; i++) {
      const s = i*viaduct.span, samples = [];
      for (const ds of [-viaduct.pierWidth/2,viaduct.pierWidth/2]) for (const lateral of [-viaduct.width/2,viaduct.width/2]) samples.push(groundHeight(...viaduct.point(s+ds,lateral)));
      const floor = Math.min(...samples)-1, top = viaduct.top(s)-1.4;
      const geometry = new THREE.BoxGeometry(viaduct.pierWidth,Math.max(.5,top-floor),viaduct.width-.6);
      const pier = new THREE.Mesh(geometry,materials.viaduct); pier.position.set(s,(floor+top)/2,0); pier.castShadow = pier.receiveShadow = true; viaductGroup.add(pier);
    }
  }
  refreshViaduct();
  roadNetwork.segments.filter(s=>!s.stairs).forEach(road);
  // Böschungsstreifen: Seitenwände unter beiden Fahrbahnkanten bis zum Boden. Wo das Gelände unter der Fahrbahn weggeht
  // (Hang, Kreuzung auf anderer Höhe), sieht die Straße dadurch aufgeschüttet aus und schwebt nicht.
  const skirtVertices=[],skirtIndices=[],skirtData=[];
  function skirt(segment) {
    if(segment.bridge) return;
    const an=roadNetwork.nodes[segment.a],bn=roadNetwork.nodes[segment.b],dx=bn.x-an.x,dz=bn.z-an.z,length=Math.hypot(dx,dz);
    if(length<.001) return;
    const count=Math.ceil(length*2),first=skirtVertices.length/3;
    for(let j=0;j<=count;j++) for(const side of [-.5,.5]) {
      const x=an.x+dx*j/count+dz/length*segment.width*side,z=an.z+dz*j/count-dx/length*segment.width*side;
      skirtVertices.push(x,0,z,x,0,z); skirtData.push({segment,x,z});
    }
    for(let j=0;j<count;j++) for(let si=0;si<2;si++) {
      const a=first+(j*2+si)*2,c=first+((j+1)*2+si)*2;
      skirtIndices.push(a,c,a+1,a+1,c,c+1);
    }
  }
  const roadGeometry=new THREE.BufferGeometry();
  roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3)); roadGeometry.setIndex(roadIndices); roadGeometry.computeVertexNormals();
  const roadMesh=new THREE.Mesh(roadGeometry,materials.path); roadMesh.receiveShadow=true; scene.add(roadMesh); roadMeshes.push(roadMesh);
  roadNetwork.segments.filter(s=>!s.stairs).forEach(skirt);
  const skirtGeometry=new THREE.BufferGeometry();
  skirtGeometry.setAttribute('position',new THREE.Float32BufferAttribute(skirtVertices,3)); skirtGeometry.setIndex(skirtIndices);
  const skirtMaterial=materials.path.clone(); skirtMaterial.side=THREE.DoubleSide; skirtMaterial.color.multiplyScalar(.8);
  const skirtMesh=new THREE.Mesh(skirtGeometry,skirtMaterial); skirtMesh.receiveShadow=true; scene.add(skirtMesh);
  function updateSkirts() {
    const p=skirtGeometry.attributes.position;
    skirtData.forEach(({segment,x,z},i)=>{
      const top=roadNetwork.project(segment,x,z).y+.4,bottom=Math.min(groundHeight(x,z),top)-.25;
      p.setY(i*2,top); p.setY(i*2+1,bottom);
    });
    p.needsUpdate=true; skirtGeometry.computeVertexNormals(); skirtGeometry.computeBoundingSphere();
  }
  updateSkirts();
  for(const tread of stairs.treads) {
    const mesh=new THREE.Mesh(boxGeometry,materials.viaduct);
    mesh.rotation.y=-Math.atan2(tread.sin,tread.cos); mesh.receiveShadow=true; scene.add(mesh);
    stairMeshes.push({mesh,tread});
  }
  function refreshStairs() {
    for(const {mesh,tread:t} of stairMeshes) {
      const floor=Math.min(groundHeight(t.x,t.z),t.top-.25)-.15;
      mesh.position.set(t.x,(floor+t.top)/2,t.z); mesh.scale.set(t.length+.01,t.top-floor,t.width);
    }
  }
  refreshStairs();
  box(82, 41, 2.5, 2.5, 1.2, 'castle');
  // Die beiden Kirchenquader sind durch das begehbare Kirchenmodell ersetzt.
  villageWall=NachtjagdVillageWall.create({THREE,scene,walls:layout.villageWalls,heightAt:groundHeight,village,houses:buildingSpecs});
  mines=NachtjagdMines.create({THREE,scene,mines:layout.mines,heightAt:groundHeight,entranceHeight:(id,x,z)=>streetHeight(x,z)??groundHeight(x,z)+.4});
  // Nur die Mündungen öffnen: unterirdische Dächer behalten das Gelände darüber.
  const originalTerrainIndex=groundGeometry.index.array.slice();
  const mineRimGeometry=new THREE.BufferGeometry(),mineRim=new THREE.Mesh(mineRimGeometry,terrainMaterial);
  mineRim.receiveShadow=true;scene.add(mineRim);
  function openMineEntrances() {
    const kept=[],rimPositions=[],rimNormals=[],rimColors=[];
    const normals=groundGeometry.attributes.normal,colors=groundGeometry.attributes.color;
    const mainBounds=mines.routes.filter(r=>r.type==='main').map(r=>r.bounds);
    const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    const vertex=(ids,u,v)=>{
      const weights=[1-u-v,u,v],sum=(attribute,k)=>ids.reduce((n,id,i)=>n+attribute.array[id*3+k]*weights[i],0);
      return {p:[0,1,2].map(k=>sum(positions,k)),n:[0,1,2].map(k=>sum(normals,k)),c:[0,1,2].map(k=>sum(colors,k))};
    };
    function clip(triangle) {
      const polygon=[];
      for(let i=0;i<3;i++) {
        const a=triangle[i],b=triangle[(i+1)%3],da=mines.terrainClearance(a.p[0],a.p[2]),db=mines.terrainClearance(b.p[0],b.p[2]);
        if(da<=0)polygon.push(a);
        if((da>0)!==(db>0)) {
          const t=Math.max(0,Math.min(1,da/(da-db)));
          polygon.push({p:mix(a.p,b.p,t),n:mix(a.n,b.n,t),c:mix(a.c,b.c,t)});
        }
      }
      for(let i=1;i<polygon.length-1;i++)for(const q of [polygon[0],polygon[i],polygon[i+1]]) {rimPositions.push(...q.p);rimNormals.push(...q.n);rimColors.push(...q.c);}
    }
    for(let i=0;i<originalTerrainIndex.length;i+=3) {
      const ids=[originalTerrainIndex[i],originalTerrainIndex[i+1],originalTerrainIndex[i+2]];
      const xs=ids.map(j=>positions.getX(j)),zs=ids.map(j=>positions.getZ(j));
      if(!mainBounds.some(b=>Math.max(...xs)>=b.minX&&Math.min(...xs)<=b.maxX&&Math.max(...zs)>=b.minZ&&Math.min(...zs)<=b.maxZ)) {kept.push(...ids);continue;}
      // Nur an den Mündungen ein feines Raster; geschlossene Untertageabschnitte behalten die Schneedecke.
      const n=5;
      for(let u=0;u<n;u++)for(let v=0;v<n-u;v++) {
        clip([vertex(ids,u/n,v/n),vertex(ids,(u+1)/n,v/n),vertex(ids,u/n,(v+1)/n)]);
        if(u+v<n-1)clip([vertex(ids,(u+1)/n,v/n),vertex(ids,(u+1)/n,(v+1)/n),vertex(ids,u/n,(v+1)/n)]);
      }
    }
    groundGeometry.setIndex(kept);
    mineRimGeometry.setAttribute('position',new THREE.Float32BufferAttribute(rimPositions,3));
    mineRimGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(rimNormals,3));
    mineRimGeometry.setAttribute('color',new THREE.Float32BufferAttribute(rimColors,3));mineRimGeometry.computeBoundingSphere();
  }
  openMineEntrances();
  label('Bergdorf', 190, -25, 16, 40);
  const lakeShape = new THREE.Shape(layout.lake.map(([x,z]) => new THREE.Vector2(x, -z)));
  const lake = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape), materials.water);
  lake.rotation.x = -Math.PI / 2; lake.position.y = .09;
  scene.add(lake); label('See', -210, 220, 4, 48);
  const cx = castle.x, cz = castle.z, ch = castle.height;
  // Burgmodell (public/models): Tor nach Osten (+x), auf der Wegachse z = -100; Hofplatte bündig mit dem Gelände.
  const castleOrigin = { x: -264, z: -96, y: ch + .03 }, castleRot = Math.PI / 2;
  renderer.localClippingEnabled = true; // Burg: Schnittebenen für den Bergfried-Ansatz
  const castleSite = NachtjagdCastleSite.create({ THREE, scene, origin: castleOrigin, rot: castleRot });
  // Ort des Burg-Siegels im Rittersaal (Modellkoordinaten -12,8 / -6) in Weltkoordinaten
  const castleSeal = { x: castleOrigin.x + -6, z: castleOrigin.z + 12.8 };
  label('Burg · Felssporn', cx, cz, 46, 58);
  const viaductMiddle = viaduct.point(viaduct.length/2);
  label('Viadukt · sieben Bögen', ...viaductMiddle, viaduct.top(viaduct.length/2)-groundHeight(...viaductMiddle)+14, 64);
  label('Hochgebirge · Norden', -20, -300, 28, 100);
  landmarks=NachtjagdLandmarks.create({THREE,scene,materials,box,label,groundHeight,streetHeight,layout});
  const outdoor=NachtjagdOutdoor.create({THREE,scene,layout,routes,height:groundHeight,clearance:(x,z)=>roadNetwork.clearance(x,z),box,label,houses:[],
    occupied:(x,z)=>(x>77&&x<105&&z>-9&&z<28)||buildingSpecs.some(h=>{
      const p=h.toLocal(x,z);
      return h.plan.volumes.some(v=>p.x>v.x0-1&&p.x<v.x1+1&&p.z>v.z0-1&&p.z<v.z1+1)||h.approaches.some(a=>Math.hypot(a.x-x,a.z-z)<2);
    })});
  // Reproduzierbarer Wald; Wege, See und Gebäuderänder bleiben frei.
  let seed = 71;
  function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
  function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }
  const forest = new THREE.InstancedMesh(coneGeometry, materials.forest, 3480), dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), materials.landmark, 3480);
  const buildingColliders = colliders.slice(), treeBuckets = new Map();
  function nearTree(x,z) {
    const bx=Math.floor(x/4),bz=Math.floor(z/4);
    for(let a=bx-2;a<=bx+2;a++) for(let b=bz-2;b<=bz+2;b++) for(const t of treeBuckets.get(a+','+b)||[]) if(Math.hypot(x-t.x,z-t.z)<4.4) return true;
    return false;
  }
  let treeCount = 0;
  function plantTree(x,z,foothill=false,ridge=false) {
    if(!layout.gondolaClear(x,z,8))return false;
    if (layout.villageDistance(x,z)<9 || layout.clearingWeight(x,z)<.15) return false;
    if (layout.lakeDistance(x, z) < 14 || groundHeight(x,z) > (ridge ? 155 : foothill ? 110 : 115)) return false;
    if (nearTree(x,z) || buildingColliders.some(c => Math.hypot(x - c.x, z - c.z) < Math.max(c.w, c.d) + 3)) return false;
    if (roadNetwork.clearance(x,z) < 1.5 || segmentDistance(x,z,bridgeSpec.a,bridgeSpec.b) < 5.5) return false;
    const height = 12 + random() * 10, clearance = 4 + random() * 1.5, rx = 3.4 + random() * 1.8, rz = 3.4 + random() * 1.8;
    dummy.position.set(x, groundHeight(x, z) + clearance + height / 2, z); dummy.scale.set(rx, height, rz); dummy.updateMatrix();
    forest.setMatrixAt(treeCount, dummy.matrix);
    dummy.position.y = groundHeight(x, z) + (clearance + 2) / 2; dummy.scale.set(.4, clearance + 2, .4); dummy.updateMatrix();
    trunks.setMatrixAt(treeCount++, dummy.matrix);
    treePlacements.push({ x, z, height, clearance, rx, rz, foothill, ridge });
    const bucket=Math.floor(x/4)+','+Math.floor(z/4);
    if(!treeBuckets.has(bucket)) treeBuckets.set(bucket,[]);
    treeBuckets.get(bucket).push({x,z});
    colliders.push({ x, z, w: .4, d: .4, rotation: 0, tree: true });
    return true;
  }
  for(let i=0;i<80000 && treeCount<3100;i++) {
    const x=-380+random()*720,z=-225+random()*575;
    if(random()>layout.treeWeight(x,z)*(.55+.45*smooth(.15,.8,Math.sin(x/27)*Math.cos(z/31)))) continue;
    plantTree(x,z);
  }
  // Nur wenige zusätzliche Bäume an niedrigen, nicht zu steilen Berghängen.
  const foothillStart=treeCount;
  for(let i=0;i<10000 && treeCount-foothillStart<140;i++) {
    const [gx,gz,r]=layout.foothillGroups[i%layout.foothillGroups.length],angle=random()*Math.PI*2,distance=r*Math.sqrt(random());
    const x=gx+Math.cos(angle)*distance,z=gz+Math.sin(angle)*distance;
    const slope=Math.hypot(groundHeight(x+2,z)-groundHeight(x-2,z),groundHeight(x,z+2)-groundHeight(x,z-2))/4;
    if(slope<.7) plantTree(x,z,true);
  }
  // Kleine Gruppen auf den aufgefüllten Sätteln, statt den Hauptwald weiter zu verdichten.
  const ridgeStart=treeCount;
  for(let i=0;i<10000 && treeCount-ridgeStart<140;i++) {
    const [gx,gz,r]=layout.ridgeGroups[i%layout.ridgeGroups.length],angle=random()*Math.PI*2,distance=r*Math.sqrt(random());
    const x=gx+Math.cos(angle)*distance,z=gz+Math.sin(angle)*distance;
    const slope=Math.hypot(groundHeight(x+2,z)-groundHeight(x-2,z),groundHeight(x,z+2)-groundHeight(x,z-2))/4;
    if(slope<.7) plantTree(x,z,true,true);
  }
  forest.count = trunks.count = treeCount; forest.castShadow = trunks.castShadow = true; scene.add(forest, trunks);
  const backdrop = NachtjagdImportedModels.buildBackdrop({scene});
  const importedForest = NachtjagdImportedModels.buildForest({scene, placements:[...treePlacements,...landmarks.islandTrees], heightAt:groundHeight, forest, trunks});
  importedForest.ready.then(()=>{
    if(importedForest.root.userData.treeCount)for(const tree of landmarks.islandTrees)tree.crown.visible=tree.trunk.visible=false;
    renderer.shadowMap.needsUpdate=true;
  });
  // Niedriger Waldboden bleibt durchquerbar; nur Baumstämme kollidieren.
  const undergrowth = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshLambertMaterial({color:'#718455'}),3296);
  let coverCount=0;
  for(let i=0;i<45000 && coverCount<3200;i++) {
    const x=-380+random()*720,z=-225+random()*575;
    if(random()>layout.treeWeight(x,z) || layout.lakeDistance(x,z)<12 || groundHeight(x,z)>110 || roadNetwork.clearance(x,z)<1) continue;
    if(layout.villageDistance(x,z)<9) continue;
    if(buildingColliders.some(c=>Math.hypot(x-c.x,z-c.z)<Math.max(c.w,c.d)+3)) continue;
    const height=.3+random()*.65,rx=1+random()*1.5,rz=1+random()*1.5,rotation=random()*Math.PI;
    dummy.position.set(x,groundHeight(x,z)+height*.45,z); dummy.scale.set(rx,height,rz); dummy.rotation.y=rotation; dummy.updateMatrix();
    undergrowth.setMatrixAt(coverCount++,dummy.matrix); coverPlacements.push({x,z,rx,rz,height,rotation});
  }
  // Wenige höhere Buschgruppen an Dorfrändern und Waldwegen, weiterhin durchquerbar.
  const bushGroups=[[-28,98],[208,94],[63,141],[-215,30],[275,-70],[-65,-80]];
  for(let i=0;i<2000 && coverCount<3296;i++) {
    const [gx,gz]=bushGroups[i%bushGroups.length],angle=random()*Math.PI*2,r=12*Math.sqrt(random());
    const x=gx+Math.cos(angle)*r,z=gz+Math.sin(angle)*r;
    if(layout.villageDistance(x,z)<5 || layout.lakeDistance(x,z)<12 || layout.clearingWeight(x,z)<.15 || roadNetwork.clearance(x,z)<2) continue;
    if(buildingColliders.some(c=>Math.hypot(x-c.x,z-c.z)<Math.max(c.w,c.d)+3)) continue;
    const height=1.1+random()*.7,rx=1.1+random()*.8,rz=.9+random()*.7,rotation=random()*Math.PI;
    dummy.position.set(x,groundHeight(x,z)+height*.45,z); dummy.scale.set(rx,height,rz); dummy.rotation.y=rotation; dummy.updateMatrix();
    undergrowth.setMatrixAt(coverCount++,dummy.matrix); coverPlacements.push({x,z,rx,rz,height,rotation});
  }
  dummy.rotation.y=0; undergrowth.count=coverCount; undergrowth.receiveShadow=true; scene.add(undergrowth);
  label('Wald', -88, -126, 32, 45);

  const target = new THREE.Vector3();
  let gameplay=null;
  // Räumlicher Index: Spielbewegung fragt nur nahe Gebäude und Stämme ab.
  const collisionBuckets=new Map();
  for(const c of colliders) {
    const radius=c.w+c.d+.5;
    for(let x=Math.floor((c.x-radius)/16);x<=Math.floor((c.x+radius)/16);x++) for(let z=Math.floor((c.z-radius)/16);z<=Math.floor((c.z+radius)/16);z++) {
      const key=x+','+z; if(!collisionBuckets.has(key)) collisionBuckets.set(key,[]); collisionBuckets.get(key).push(c);
    }
  }
  let yaw, polar, distance, mode, walkingYaw = Math.PI, pitch = 0;
  let editing = false, sculpting = false, brushPoint = null, flattenLevel = 0, lastSculpt = 0;
  let tool = 'raise';
  const editor = document.querySelector('#editor'), editToggle = document.querySelector('#edit-toggle'), editStatus = document.querySelector('#edit-status');
  const radiusInput = document.querySelector('#brush-radius'), strengthInput = document.querySelector('#brush-strength');
  const undoButton = document.querySelector('#terrain-undo'), redoButton = document.querySelector('#terrain-redo');
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const cursorGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3));
  const brushCursor = new THREE.LineLoop(cursorGeometry, new THREE.LineBasicMaterial({ color: '#246f4e', depthTest: false }));
  brushCursor.visible = false; brushCursor.renderOrder = 10; scene.add(brushCursor);
  const keys = new Set();
  const views = {
    village: { target: [90,groundHeight(90,45),45], distance: 230, yaw: .38, polar: .92, name: 'Bergdorf am Hang · 28 Häuser · drei Tore' },
    world: { target: [-25,75,5], distance: 1570, yaw: 0, polar: .62, name: 'Mittelberge und äußerer Hochgebirgsring · lockerer Wald' },
    map: { target: [-25,45,5], distance: 1650, yaw: 0, polar: .12, name: 'Draufsicht · Norden oben · Berge ringsum' },
    castle: { target: [castle.x,castle.height,castle.z], distance: 205, yaw: -.65, polar: 1.05, name: 'Burg auf freiem Felssporn · Zugang über das Viadukt' },
    wind: {target:[270,groundHeight(270,255)+10,255],distance:130,yaw:-2.2,polar:.75,name:'Windrad · grobe Holzwindmühle'},
    stones: {target:[150,groundHeight(150,-90)+5,-90],distance:140,yaw:.2,polar:.85,name:'Steinkreis auf der Anhöhe'},
    ruin: {target:[300,groundHeight(300,120)+5,120],distance:140,yaw:-1.2,polar:.8,name:'Klosterruine · offener Hof und Kapellenreste'},
    lakeside: {target:[-232,6,156],distance:210,yaw:.15,polar:.85,name:'Seehäuser, Steg und kleine Insel'},
    northmine: {target:[-60,groundHeight(-60,-200)+3,-200],distance:100,yaw:.5,polar:.9,name:'Nordmine · kurzer überdachter Stollen'},
    mines: {target:[-345,groundHeight(-345,-22)+3,-22],distance:110,yaw:.6,polar:1.05,name:'Westmine · kurzer überdachter Stollen · zweite Mine im Norden'},
    viaduct: { target: [-165,65,-130], distance: 220, yaw: 1.2, polar: 1.15, name: 'Viadukt · sieben Bögen · begehbarer Burgweg' }
  };
  views.church={target:[91,churchOrigin.y+11,9],distance:58,yaw:.6,polar:1.17,name:'Kirche · begehbares Schiff und Glockenvorraum'};
  const sampleHouse=buildings.houses[7];
  views.house={target:[sampleHouse.spec.x,sampleHouse.spec.y+5,sampleHouse.spec.z],distance:36,yaw:.65,polar:1.05,name:'Dorfhäuser · offene Türen, Treppen und Mobiliar'};
  for(const [value,text] of [['church','Kirche'],['churchwalk','Kirche betreten'],['house','Dorfhaus'],['housewalk','Dorfhaus betreten'],['minewalk','Mine betreten'],['wallwalk','Dorfmauer betreten']]) {const option=document.createElement('option');option.value=value;option.textContent=text;document.querySelector('#place-view').append(option);}
  function setView(view) {
    const walking = ['walk','forest','bridgewalk','stairswalk','churchwalk','housewalk','minewalk','wallwalk'].includes(view);
    if (walking && editing) toggleEditor(false);
    mode = walking ? 'walk' : view; keys.clear(); labels.visible = !walking && !editing && !['church','house','wind','stones','ruin','lakeside','mines','northmine','gondola','talstation','jeep','boats','carts','peaks','valley','watchtower'].includes(view); grid.visible = editing || view === 'map';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (walking) {
      const entry=sampleHouse.data.entries[0].inside,houseStart=sampleHouse.spec.toWorld(entry.x,entry.z);
      const mineEntry=mines.entrance('mine-west'),wallEntry=villageWall.stairs[0].start;
      const start = view==='minewalk' ? [mineEntry.x,mineEntry.z] : view==='wallwalk' ? [wallEntry.x,wallEntry.z] : view === 'churchwalk' ? [91,21.5] : view === 'housewalk' ? [houseStart.x,houseStart.z] : view === 'bridgewalk' ? viaduct.point(viaduct.length-4) : view === 'forest' ? [221,60] : view === 'stairswalk' ? [120,58] : [90,45];
      const [x,z] = start;
      camera.position.set(x, gameFloor(x,z) + 1.75, z); walkingYaw = view === 'housewalk' ? Math.PI+sampleHouse.spec.rotation : view === 'bridgewalk' ? Math.atan2(-viaduct.cosine,-viaduct.sine) : view === 'forest' ? .55 : view === 'stairswalk' ? 0 : Math.PI; pitch = view === 'stairswalk' ? -.24 : 0;
      if(view==='minewalk')walkingYaw=mineEntry.yaw;
      if(view==='wallwalk')walkingYaw=Math.atan2(villageWall.stairs[0].end.x-x,villageWall.stairs[0].end.z-z);
      status.textContent = view === 'stairswalk' ? 'Auf der Dorftreppe · begehbare Stufen · Augenhöhe 1,75 m' : view === 'bridgewalk' ? 'Auf dem Viadukt · zur Burg · Augenhöhe 1,75 m' : view === 'forest' ? 'Im Wald · unter den Baumkronen · Augenhöhe 1,75 m' : 'Im Dorf · Augenhöhe 1,75 m';
      if(view==='minewalk')status.textContent='Westmine · Abstieg zu Hauptgang, Kammern und Siegel';
      if(view==='wallwalk')status.textContent='Dorfmauer · vier Treppen und begehbarer Wehrgang';
      help.textContent = 'WASD / Pfeiltasten: gehen · Ziehen: umsehen · Shift: schneller · Esc: Übersicht';
    } else {
      const preset = views[view]; target.fromArray(preset.target); ({ yaw, polar, distance } = preset);
      status.textContent = preset.name;
      help.textContent = editing ? 'Links ziehen: modellieren · Rechts ziehen: drehen · Alt + links: verschieben' : 'Ziehen: drehen · Mausrad: Abstand · Rechte Maustaste: verschieben';
    }
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelector('#place-view').addEventListener('change',event=>setView(event.target.value));
  let drag = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if(gameplay && gameplay.active) return;
    canvas.setPointerCapture(event.pointerId);
    if (editing && event.button === 0 && !event.altKey) {
      locateBrush(event);
      if (brushPoint) { sculpting = true; flattenLevel = brushPoint.y; terrainModel.begin(); applySculpt(.12); }
      return;
    }
    drag = { x: event.clientX, y: event.clientY, pan: editing ? event.altKey || event.shiftKey : event.button === 2 || event.shiftKey };
  });
  canvas.addEventListener('pointerup', () => { drag = null; finishStroke(); });
  canvas.addEventListener('pointercancel', () => { drag = null; finishStroke(); });
  canvas.addEventListener('pointerleave', () => { if (!sculpting) { brushCursor.visible = false; brushPoint = null; } });
  canvas.addEventListener('pointermove', event => {
    if(gameplay && gameplay.active) return;
    if (editing && !drag) locateBrush(event);
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if (mode === 'walk') { walkingYaw -= dx * .004; pitch = THREE.MathUtils.clamp(pitch - dy * .004, -1.3, 1.3); }
    else if (drag.pan) {
      const scale = distance * .0013;
      target.x -= (Math.cos(yaw) * dx + Math.sin(yaw) * dy) * scale;
      target.z += (Math.sin(yaw) * dx - Math.cos(yaw) * dy) * scale;
    } else { yaw -= dx * .006; polar = THREE.MathUtils.clamp(polar + dy * .005, .12, 1.5); }
  });
  canvas.addEventListener('wheel', event => { event.preventDefault(); if (mode !== 'walk') distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * .001), 20, 2100); }, { passive: false });
  addEventListener('keydown', event => {
    if(gameplay && gameplay.active) return;
    if (event.target.matches('input,textarea,select')) return;
    if (editing && (event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); changeHistory(event.key.toLowerCase() === 'y' || event.shiftKey); return;
    }
    if (event.key === 'Escape') setView('village');
    const key = event.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) { keys.add(key); event.preventDefault(); }
  });
  addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); drag = null; finishStroke(); });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  function blocked(x, z, feet = surfaceHeight(x,z)) {
    if (x < -465 || x > 340 || z < -340 || z > 365) return true;
    // Stämme und überirdische Baukörper blockieren keine Personen unter ihrer Grundfläche.
    if(mines && mines.indoor(x,feet,z))return mines.blocked(x,z,feet);
    if (groundHeight(x, z) < .35 && landmarks.floor(x,z)===null) return true;
    if (viaduct.collides(x,z,feet)) return true;
    if (mines && mines.blocked(x,z,feet)) return true;
    if (villageWall && villageWall.blocked(x,z,feet)) return true;
    if (castleSite.walk && castleSite.walk.blocked(x,z,feet)) return true;
    if (buildings && buildings.blocked(x,z,feet)) return true;
    return (collisionBuckets.get(Math.floor(x/16)+','+Math.floor(z/16))||[]).some(c => {
      const dx = x - c.x, dz = z - c.z, cosine = Math.cos(c.rotation), sine = Math.sin(c.rotation);
      return Math.abs(cosine * dx - sine * dz) < c.w + .45 && Math.abs(sine * dx + cosine * dz) < c.d + .45;
    });
  }
  // Wasserfahrzeuge: tiefes Wasser ohne feste Hindernisse (Inselbäume, Stegpfosten) und ohne Stegfläche.
  function hitsSolid(x, z) {
    return (collisionBuckets.get(Math.floor(x/16)+','+Math.floor(z/16))||[]).some(c => {
      const dx = x - c.x, dz = z - c.z, cosine = Math.cos(c.rotation), sine = Math.sin(c.rotation);
      return Math.abs(cosine * dx - sine * dz) < c.w + .45 && Math.abs(sine * dx + cosine * dz) < c.d + .45;
    });
  }
  const boatOk = (x, z) => layout.lakeDistance(x, z) < -1.5 && landmarks.floor(x, z) === null && !hitsSolid(x, z);
  function refreshTerrain() {
    updateHeightGrid();
    refreshViaduct();
    refreshStairs();
    landmarks.refresh();
    villageWall.refresh();
    const low = new THREE.Color('#f3f5f7').convertSRGBToLinear(), rock = new THREE.Color('#8c9da4').convertSRGBToLinear(), snow = new THREE.Color('#e7ebe7').convertSRGBToLinear(), color = new THREE.Color();
    const colors = groundGeometry.attributes.color;
    for (let i = 0; i < positions.count; i++) {
      const height = vertexHeight(i%321,Math.floor(i/321)); positions.setY(i, height);
      color.copy(low).lerp(new THREE.Color('#e0e7ed').convertSRGBToLinear(),layout.treeWeight(positions.getX(i),positions.getZ(i))*.34).lerp(rock, smooth(60, 115, height)).lerp(snow, smooth(165, 240, height)); colors.setXYZ(i, color.r, color.g, color.b);
    }
    positions.needsUpdate = true; colors.needsUpdate = true;
    groundGeometry.computeVertexNormals(); groundGeometry.computeBoundingSphere();
    openMineEntrances();
    for (const anchor of anchors) {
      let floor = groundHeight(anchor.x, anchor.z) + anchor.offset, height = anchor.h;
      if (anchor.automatic) {
        const heights = [];
        for (const a of [-anchor.w / 2, anchor.w / 2]) for (const b of [-anchor.d / 2, anchor.d / 2]) heights.push(groundHeight(anchor.x + Math.cos(anchor.rotation) * a + Math.sin(anchor.rotation) * b, anchor.z - Math.sin(anchor.rotation) * a + Math.cos(anchor.rotation) * b));
        floor = Math.min(...heights) - .08; height += Math.max(...heights) - floor;
      }
      anchor.mesh.position.y = floor + height / 2; anchor.mesh.scale.y = height;
    }
    for (const mesh of roadMeshes) {
      const p = mesh.geometry.attributes.position;
      for(const range of roadRanges) for(let i=range.start;i<range.start+range.count;i++) {
        const x=p.getX(i),z=p.getZ(i),s=range.segment;
        p.setY(i,(s.bridge?viaduct.top(viaduct.coordinates(x,z).s)-.4:roadNetwork.project(s,x,z).y)+.4);
      }
      p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    }
    updateSkirts();
    const gp = grid.geometry.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)) + .04);
    gp.needsUpdate = true;
    treePlacements.forEach((tree, i) => {
      dummy.position.set(tree.x, groundHeight(tree.x, tree.z) + tree.clearance + tree.height / 2, tree.z); dummy.scale.set(tree.rx, tree.height, tree.rz); dummy.updateMatrix(); forest.setMatrixAt(i, dummy.matrix);
      dummy.position.y = groundHeight(tree.x,tree.z) + (tree.clearance + 2) / 2; dummy.scale.set(.4, tree.clearance + 2, .4); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    });
    importedForest.update();
    outdoor.refresh(); updateBoxBatches();
    renderer.shadowMap.needsUpdate = true;
    forest.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    coverPlacements.forEach((plant,i)=>{
      dummy.position.set(plant.x,groundHeight(plant.x,plant.z)+plant.height*.45,plant.z); dummy.scale.set(plant.rx,plant.height,plant.rz); dummy.rotation.y=plant.rotation; dummy.updateMatrix(); undergrowth.setMatrixAt(i,dummy.matrix);
    });
    dummy.rotation.y=0; undergrowth.instanceMatrix.needsUpdate=true;
    for (const anchor of labelAnchors) anchor.sprite.position.y = Math.max(0, groundHeight(anchor.x, anchor.z)) + anchor.height;
    buildings.refresh();
    updateCursor();
  }
  function updateEditorStatus(message) {
    undoButton.disabled = !terrainModel.canUndo; redoButton.disabled = !terrainModel.canRedo;
    editStatus.dataset.changed = String(terrainModel.changedCount);
    editStatus.textContent = message || (terrainModel.changedCount ? 'Dein Gelände ist in diesem Browser gespeichert.' : 'Ausgangsform geladen.');
  }
  function persistTerrain() {
    try { localStorage.setItem(storageKey, terrainModel.serialize()); updateEditorStatus(); }
    catch { updateEditorStatus('Browser-Speicher nicht verfügbar. Bitte deinen Entwurf als Datei speichern.'); }
  }
  function toggleEditor(enabled) {
    finishStroke(); editing = enabled; editor.hidden = !enabled; editToggle.setAttribute('aria-pressed', String(enabled));
    if (enabled && mode === 'walk') setView('world');
    labels.visible = !enabled && mode !== 'walk'; grid.visible = enabled || mode === 'map'; brushCursor.visible = false;
    help.textContent = enabled ? 'Links ziehen: modellieren · Rechts ziehen: drehen · Alt + links: verschieben' : 'Ziehen: drehen · Mausrad: Abstand · Rechte Maustaste: verschieben';
  }
  function locateBrush(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground, false)[0];
    brushPoint = hit ? hit.point : null; updateCursor();
  }
  function updateCursor() {
    brushCursor.visible = Boolean(editing && brushPoint);
    if (!brushCursor.visible) return;
    const radius = Number(radiusInput.value), p = cursorGeometry.attributes.position;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2, x = brushPoint.x + Math.cos(angle) * radius, z = brushPoint.z + Math.sin(angle) * radius;
      p.setXYZ(i, x, groundHeight(x, z) + .65, z);
    }
    p.needsUpdate = true; cursorGeometry.computeBoundingSphere();
  }
  function protection(x, z) {
    let weight = Math.min(smooth(8,28,layout.lakeDistance(x,z)),smooth(2,10,roadNetwork.clearance(x,z)));
    weight = Math.min(weight,smooth(7,22,segmentDistance(x,z,viaduct.a,viaduct.b)));
    for (const pad of pads) {
      const delta = Math.max(Math.abs(x - pad.x) - pad.w, Math.abs(z - pad.z) - pad.d, 0);
      weight = Math.min(weight, smooth(0, 18, delta));
    }
    return weight;
  }
  function applySculpt(seconds) {
    if (!brushPoint) return;
    const protect = document.querySelector('#protect-places').checked ? protection : () => 1;
    if (terrainModel.brush({ x: brushPoint.x, z: brushPoint.z, radius: Number(radiusInput.value), strength: Number(strengthInput.value), seconds, tool, level: flattenLevel, protect })) {
      refreshTerrain(); updateEditorStatus('Gelände wird geformt …');
    }
  }
  function finishStroke() {
    if (!sculpting) return;
    sculpting = false; if (terrainModel.end()) persistTerrain();
  }
  function changeHistory(redo) {
    finishStroke(); if (redo ? terrainModel.redo() : terrainModel.undo()) { refreshTerrain(); persistTerrain(); }
  }
  editToggle.addEventListener('click', () => toggleEditor(!editing));
  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
    tool = button.dataset.tool; document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    brushCursor.material.color.set(tool === 'lower' ? '#a64d31' : '#246f4e');
  }));
  radiusInput.addEventListener('input', () => { document.querySelector('#radius-value').textContent = radiusInput.value + ' m'; updateCursor(); });
  strengthInput.addEventListener('input', () => { document.querySelector('#strength-value').textContent = strengthInput.value; });
  undoButton.addEventListener('click', () => changeHistory(false)); redoButton.addEventListener('click', () => changeHistory(true));
  document.querySelector('#terrain-reset').addEventListener('click', () => { finishStroke(); if (terrainModel.reset()) { refreshTerrain(); persistTerrain(); } });
  document.querySelector('#terrain-save').addEventListener('click', () => {
    finishStroke(); const url = URL.createObjectURL(new Blob([terrainModel.serialize()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'nachtjagd-berge.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); updateEditorStatus('Geländedatei zum Herunterladen erstellt.');
  });
  const fileInput = document.querySelector('#terrain-file');
  document.querySelector('#terrain-load').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    try {
      if (file.size > 4000000) throw new Error('Die Geländedatei ist zu groß.');
      finishStroke(); terrainModel.load(await file.text()); refreshTerrain(); persistTerrain(); updateEditorStatus('Geländedatei geladen und in diesem Browser gespeichert.');
    } catch (error) { updateEditorStatus(error.message); }
    fileInput.value = '';
  });
  updateEditorStatus(storageWarning || (restored ? 'Dein gespeichertes Gelände wurde wieder geladen.' : 'Ausgangsform geladen.'));
  let previous = performance.now(),menuTime=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const perf = { sum: 0, frames: 0, last: performance.now(), level: 0 };
  let shadowTime=-Infinity,shadowX=Infinity,shadowZ=Infinity;
  const perfReport = new URLSearchParams(location.search).has('perf') ? document.createElement('output') : null;
  const timings = [];
  if (perfReport) {
    perfReport.id = 'render-stats';
    perfReport.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:30;background:#101821dd;color:white;padding:8px;font:12px monospace;white-space:pre';
    document.body.append(perfReport);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = (now - previous) / 1000;
    const dt = Math.min(elapsed, .1); previous = now;
    navigationBudget=3;
    if (sculpting && now - lastSculpt >= 50) { applySculpt(Math.min((now - lastSculpt) / 1000, .1)); lastSculpt = now; }
    sky.update(camera, dt);
    // Im vollständig undurchsichtigen Nebel ist der Wald unsichtbar; seine Formen bleiben erhalten.
    importedForest.lod(camera,gameplay?.active&&scene.fog?.density>0?2.63/scene.fog.density:Infinity);
    importedForest.root.visible=!(mines.indoor(camera.position.x,camera.position.y-1.75,camera.position.z)&&groundHeight(camera.position.x,camera.position.z)>camera.position.y+2);
    // Lastregelung: Bleibt die Bildzeit über zwei Sekunden hoch, sinkt die Auflösung stufenweise; ganz unten entfällt das Felsdetail.
    if (now - perf.last < 250) { perf.sum += now - perf.last; perf.frames++; } perf.last = now; // lange Pausen (Tab im Hintergrund) zählen nicht
    if (perf.sum >= 2000 && perf.frames > 0) {
      const average = perf.sum / perf.frames; perf.sum = 0; perf.frames = 0;
      if (!document.hidden && average > 30 && perf.level < 5) {
        perf.level++;
        if (pixelRatio > 1) pixelRatio = Math.max(1, pixelRatio - .5); else if (pixelRatio > .75) pixelRatio = .75; else terrainUniforms.uDetail.value = 0;
        renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
      }
    }
    if(gameplay && !gameplay.active) gameplay.previewUpdate(dt);
    if(gameplay && gameplay.active) {
      gameplay.update(dt);
    } else if (document.body.classList.contains('in-menu')) {
      if(!reducedMotion) menuTime+=dt;
      const shot=NachtjagdInterface.flyover(menuTime,groundHeight);
      camera.position.fromArray(shot.position); camera.lookAt(...shot.target);
      labels.visible=false; grid.visible=false;
    } else if (mode === 'walk') {
      const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
      const side = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      const speed = (keys.has('shift') ? 12 : 5) * dt / (Math.hypot(forward, side) || 1);
      const dx = (Math.sin(walkingYaw) * forward - Math.cos(walkingYaw) * side) * speed;
      const dz = (Math.cos(walkingYaw) * forward + Math.sin(walkingYaw) * side) * speed;
      const feet = camera.position.y - 1.75;
      if (!blocked(camera.position.x + dx, camera.position.z, gameFloor(camera.position.x + dx,camera.position.z,feet))) camera.position.x += dx;
      if (!blocked(camera.position.x, camera.position.z + dz, gameFloor(camera.position.x,camera.position.z + dz,feet))) camera.position.z += dz;
      camera.position.y = gameFloor(camera.position.x,camera.position.z,feet) + 1.75;
      if (castleSite.walk && castleSite.walk.near(camera.position.x, camera.position.z)) camera.position.y = gameFloor(camera.position.x, camera.position.z, feet) + 1.75;
      camera.lookAt(camera.position.x + Math.sin(walkingYaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), camera.position.z + Math.cos(walkingYaw) * Math.cos(pitch));
    } else {
      camera.position.set(target.x + distance * Math.sin(polar) * Math.sin(yaw), target.y + distance * Math.cos(polar), target.z + distance * Math.sin(polar) * Math.cos(yaw));
      camera.lookAt(target);
    }
    if(!gameplay?.active) {buildings.update(camera.position.x,camera.position.y-1.75,camera.position.z);mines.update(camera.position.x,camera.position.y-1.75,camera.position.z);}
    outdoor.update(camera,gameplay?.active?sky.state.night:layoutSky.night,gameplay?.active?world.indoor(camera.position.x,camera.position.y-1.75,camera.position.z):0);
    // Wie im Altay-Spiel: Schatten zwischenspeichern. Bewegte Gegner höchstens
    // zehnmal pro Sekunde, ruhige Layoutansichten nur bei Kamera-/Geländeänderungen.
    if(now-shadowTime>(gameplay?.active?100:400) || Math.hypot(camera.position.x-shadowX,camera.position.z-shadowZ)>6) {
      renderer.shadowMap.needsUpdate=true; shadowTime=now; shadowX=camera.position.x; shadowZ=camera.position.z;
    }
    renderer.render(scene, camera);
    if (perfReport && !document.hidden) {
      if(elapsed<.25) timings.push(elapsed * 1000); if (timings.length > 120) timings.shift();
      if (timings.length % 20 === 0) perfReport.textContent = JSON.stringify({
        frameMs: Math.round(timings.reduce((a,b)=>a+b,0)/timings.length*10)/10,
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        pixelRatio, shadow: renderer.shadowMap.enabled
      }, null, 2);
    }
  }
  // Kleine Prüfberichte sind nur im ausdrücklich aufgerufenen QA-Modus sichtbar.
  if (new URLSearchParams(location.search).has('test')) {
    const checks = [];
    const check = (name, passed, value) => checks.push({ name, passed, value });
    const heightValues = Array.from(positions.array).filter((value, i) => i % 3 === 1);
    check('Gelände hat Höhenunterschiede', Math.max(...heightValues) - Math.min(...heightValues) > 100, [Math.min(...heightValues), Math.max(...heightValues)]);
    const villageHeights = houses.map(h => groundHeight(h[0],h[1]));
    check('Dorf am sanften Hang mit mehr Hausformen', houses.length >= 28 && Math.max(...villageHeights) - Math.min(...villageHeights) < 10, { houses: houses.length, heightSpan: Math.max(...villageHeights) - Math.min(...villageHeights) });
    check('Burghof auf Felssporn', Math.abs(groundHeight(castle.x,castle.z) - castle.height) < .01, groundHeight(castle.x,castle.z));
    check('Großer See im Südwesten mit abgesenktem Bett', groundHeight(-210,220) < -4 && layout.lakeDistance(-310,130) < 0, groundHeight(-210,220));
    check('Aufgelichteter Wald mit freiem Raum unter den Kronen', treeCount > 2500 && treeCount <= 3480 && treePlacements.every(t => t.clearance >= 4), treeCount);
    check('Mauern blockieren; Tore bleiben frei', blocked(-7.5,.5) && !blocked(-5,45) && !blocked(185,45) && !blocked(115,112), null);
    check('Waldboden und einzelne Baumgruppen außerhalb des Waldgürtels',coverCount>2500 && treePlacements.filter(t=>layout.forestWeight(t.x,t.z)<.1).length>50,{cover:coverCount,scattered:treePlacements.filter(t=>layout.forestWeight(t.x,t.z)<.1).length});
    const foothillTrees=treePlacements.filter(t=>t.foothill && !t.ridge);
    check('Lockere Baumgruppen auf niedrigen Berghängen',foothillTrees.length>=100 && foothillTrees.every(t=>groundHeight(t.x,t.z)<=110),foothillTrees.length);
    const ridgeTrees=treePlacements.filter(t=>t.ridge);
    check('Unebene Sättel zwischen den Bergreihen tragen lockere Baumgruppen',ridgeTrees.length>=100 && layout.ridgeGroups.every(([x,z])=>groundHeight(x,z)>75),{trees:ridgeTrees.length,heights:layout.ridgeGroups.map(([x,z])=>groundHeight(x,z))});
    check('Dorf folgt unregelmäßiger Kontur; drei Lichtungen bleiben offen',houses.every(([x,z])=>layout.villageDistance(x,z)<-5) && layout.clearings.every(([x,z])=>!treePlacements.some(t=>Math.hypot(t.x-x,t.z-z)<10)),{outline:layout.villageOutline.length,clearings:layout.clearings.length});
    check('Neue Orte sind verteilt und beide Minenstollen bleiben frei',landmarks.stoneCount===10 && landmarks.lakeHouseCount===4 && layout.mines.every(m=>{
      for(let t=0;t<=1;t+=.05) {const x=m.a[0]+(m.b[0]-m.a[0])*t,z=m.a[1]+(m.b[1]-m.a[1])*t;if(blocked(x,z,mines.floor(x,z)))return false;}
      return true;
    }),{stones:landmarks.stoneCount,lakeHouses:landmarks.lakeHouseCount,mines:layout.mines.length});
    check('Seesteg besitzt eine begehbare Fläche über Wasser',landmarks.floor(-212,147)===2.3 && !blocked(-212,147,2.3),landmarks.floor(-212,147));
    check('Kleine Seeinsel trägt drei Bäume und bleibt von Wasser umgeben',landmarks.islandTreeCount===3 && groundHeight(layout.island.x,layout.island.z)>3 && [[-30,0],[30,0],[0,-25],[0,25]].every(([dx,dz])=>groundHeight(layout.island.x+dx,layout.island.z+dz)<-.5),{trees:landmarks.islandTreeCount,height:groundHeight(layout.island.x,layout.island.z)});
    const stairBlocked=stairs.treads.filter(t=>blocked(t.x,t.z,t.top));
    check('Zwei Treppenwege haben freie waagerechte Trittflächen',stairs.treads.length>30 && stairBlocked.length===0,{treads:stairs.treads.length,blocked:stairBlocked.slice(0,4)});
    let crossSlope=0;
    for(const range of roadRanges) for(let i=range.start;i<range.start+range.count;i+=range.across) for(let j=1;j<range.across;j++) crossSlope=Math.max(crossSlope,Math.abs(roadGeometry.attributes.position.getY(i)-roadGeometry.attributes.position.getY(i+j)));
    const steepest=Math.max(...roadNetwork.segments.map(s=>Math.abs(roadNetwork.nodes[s.a].y-roadNetwork.nodes[s.b].y)/s.length));
    check('Fahrbahnen quer waagerecht und längs höchstens 18 Prozent',crossSlope<.001 && steepest<=.18001,{crossSlope,steepest,routes:routes.length});
    const routeBlocked = [];
    for (const route of [castleRoute,shoreRoute]) for (let i = 1; i < route.length; i++) {
      const a = route[i-1], b = route[i], count = Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]) * 2);
      for (let j = 0; j <= count; j++) {
        const x = a[0]+(b[0]-a[0])*j/count, z = a[1]+(b[1]-a[1])*j/count;
        if (blocked(x,z)) routeBlocked.push({ x,z,feet:surfaceHeight(x,z), bridge:viaduct.collides(x,z,surfaceHeight(x,z)) });
      }
    }
    const extraBlocked=[];
    for(const segment of roadNetwork.segments) {
      if(segment.bridge) continue;
      const a=roadNetwork.nodes[segment.a],b=roadNetwork.nodes[segment.b],x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      if(blocked(x,z,(a.y+b.y)/2+.4)) extraBlocked.push({route:segment.id,x,z});
    }
    check('Zusätzliche Straßen sind frei begehbar',extraBlocked.length===0,extraBlocked.slice(0,10));
    check('Verbindungen Dorf–Burg und Dorf–See sind begehbar', routeBlocked.length === 0, routeBlocked.slice(0,10));
    check('Zwischen Stamm und Kronenrand ist Platz zum Gehen', treePlacements.some(t => !blocked(t.x + 2,t.z) && blocked(t.x,t.z)), null);
    const bridgeMiddle = viaduct.point(viaduct.length/2), bridgeFloor = viaduct.top(viaduct.length/2);
    check('Viadukt überspannt die Senke mit sieben Bögen', viaduct.arches === 7 && bridgeFloor-groundHeight(...bridgeMiddle) > 30, bridgeFloor-groundHeight(...bridgeMiddle));
    const edge = viaduct.point(viaduct.length/2,3.6), below = groundHeight(...bridgeMiddle);
    check('Fahrbahn, Brüstung und Durchgang unter dem Bogen', !blocked(...bridgeMiddle,bridgeFloor) && blocked(...edge,bridgeFloor) && !viaduct.collides(...bridgeMiddle,below), null);
    let houseError=-Infinity;
    for(const h of buildings.houses) for(const mesh of h.model.children.filter(o=>o.userData.foundation)) {
      const b=mesh.geometry.parameters,base=h.spec.y+mesh.position.y-b.height/2;
      for(const x of [-b.width/2,b.width/2]) for(const z of [-b.depth/2,b.depth/2]) {const p=h.spec.toWorld(mesh.position.x+x,mesh.position.z+z);houseError=Math.max(houseError,base-groundHeight(p.x,p.z));}
    }
    check('Gebäudesockel schließen an das Gelände an',houseError<.01,houseError);
    let indoorTerrain=-Infinity;
    for(const h of buildings.houses)for(const v of h.data.plan.volumes) {
      for(let x=v.x0+.3;x<v.x1;x+=.5)for(let z=v.z0+.3;z<v.z1;z+=.5) {
        const p=h.spec.toWorld(x,z);indoorTerrain=Math.max(indoorTerrain,groundHeight(p.x,p.z)-h.spec.y-.3);
      }
    }
    for(let x=85;x<=97;x++)for(let z=-5;z<=24;z++)indoorTerrain=Math.max(indoorTerrain,groundHeight(x,z)-churchOrigin.y);
    check('Schneegelände bleibt unter allen Innenräumen',indoorTerrain<-.04,indoorTerrain);
    let buriedRoad = 0,buriedPoint=null;
    for (const mesh of scene.children.filter(child => child.isMesh && child.material === materials.path && child.geometry.index)) {
      const p = mesh.geometry.attributes.position, indices = mesh.geometry.index;
      if (mesh.geometry === boxGeometry) continue;
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
        const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
        const y = (p.getY(a) + p.getY(b) + p.getY(c)) / 3;
        if(groundHeight(x,z)-y>buriedRoad) { buriedRoad=groundHeight(x,z)-y; buriedPoint={x,z,y,ground:groundHeight(x,z)}; }
      }
    }
    check('Wege bleiben über der Geländeoberfläche', buriedRoad < .02, {buriedRoad,buriedPoint});
    const report = document.createElement('pre');
    report.id = 'terrain-tests'; report.style.cssText = 'position:fixed;top:120px;right:16px;background:white;padding:12px;font-size:11px;z-index:5;max-width:470px;white-space:pre-wrap';
    report.textContent = JSON.stringify({ passed: checks.every(c => c.passed), checks }, null, 2);
    document.body.append(report);
  }
  // Der Weltadapter hält Spielregeln unabhängig von späteren Burg-/Kirchenmodellen.
  const shotMeshes=[];
  scene.traverse(child=>{ if(child.isMesh && !child.userData.building && !child.userData.mine && !child.userData.villageWall && child!==ground && child!==mineRim && child!==lake && child!==forest && child!==undergrowth) shotMeshes.push(child); });
  // Baukörper behalten ihre Originalnetze für Schussabfragen und Geländeanker.
  // Sichtbar sind wenige Instanznetze je Material statt hunderter Einzelwürfel und Kanten.
  const boxBatches=[];
  const boxGroups=new Map();
  for(const a of anchors) {
    if(a.mesh.userData.treePlaceholder)continue;
    const key=a.mesh.material.uuid+'|'+a.mesh.castShadow;
    if(!boxGroups.has(key)) boxGroups.set(key,[]);
    boxGroups.get(key).push(a.mesh); a.mesh.visible=false;
  }
  for(const meshes of boxGroups.values()) {
    const mesh=new THREE.InstancedMesh(boxGeometry,meshes[0].material,meshes.length);
    mesh.castShadow=meshes[0].castShadow; mesh.receiveShadow=true; mesh.frustumCulled=false;
    scene.add(mesh); boxBatches.push({mesh,meshes});
  }
  function updateBoxBatches() {
    for(const batch of boxBatches) {
      batch.meshes.forEach((m,i)=>{m.updateMatrix();batch.mesh.setMatrixAt(i,m.matrix);});
      batch.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  updateBoxBatches();
  const shotRay=new THREE.Raycaster();
  const terrainRay=NachtjagdTerrainRay.create({THREE,heightAtGrid:vertexHeight,cutTerrain:(x,z)=>mines.cutTerrain(x,z)});
  // Wo die Straße höher oder tiefer als das Gelände liegt, läuft der Rand 2,5 m lang als Rampe aus.
  // Sonst bliebe an der Kante eine Stufe, die Spielfigur und Gegner nicht überwinden.
  const SHOULDER=2.5;
  function shoulderHeight(x,z,y) {
    if(streetHeight(x,z)!==null || stairs.floor(x,z)!==null || viaduct.contains(x,z)) return y;
    let best=null;
    for(const segment of roadNetwork.nearby(x,z)) {
      if(segment.bridge || segment.stairs) continue;
      const p=roadNetwork.project(segment,x,z),over=p.distance-segment.width/2;
      if(over>0 && over<SHOULDER && (!best || over<best.over)) best={over,y:p.y+.4};
    }
    if(!best || Math.abs(best.y-y)<=.4) return y;
    return best.y+(y-best.y)*(best.over/SHOULDER);
  }
  function gameFloor(x,z,previousFeet) {
    const mf=mines && mines.floor(x,z,previousFeet);
    if(mf!==null && mf!==false)return mf;
    const wf=villageWall && villageWall.floor(x,z,previousFeet);
    if(wf!==null && wf!==false)return wf;
    const bf=buildings && buildings.floor(x,z,previousFeet);
    if(bf!==null && bf!==false) return bf;
    const y=shoulderHeight(x,z,surfaceHeight(x,z,previousFeet));
    const cf=castleSite.walk && castleSite.walk.floor(x,z,previousFeet===undefined?y:previousFeet);
    if(!cf) return y;
    // Hofplatte und Gelände vereinen sich; Räume, Treppen und Keller haben ihre eigene Höhe.
    return cf.ground?Math.max(y,cf.y):cf.y;
  }
  function clearWalk(a,b) {
    const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(distance/.8); let y=a.y;
    for(let i=1;i<=steps;i++) {
      const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps,next=gameFloor(x,z,y);
      if(blocked(x,z,next) || Math.abs(next-y)>1.6) return false; y=next;
    }
    return true;
  }
  // Gegner folgen bei Hindernissen den vorhandenen Straßen statt durch Häuser zu laufen.
  const paths=new Map();
  let navigationBudget=3;
  function nearestNode(p) {
    return roadNetwork.nodes.map((n,i)=>({n,i,d:Math.hypot(n.x-p.x,n.z-p.z)})).sort((a,b)=>a.d-b.d).slice(0,12).find(({n,d})=>d<30 && clearWalk(p,n))?.i;
  }
  function chaseTarget(m,p) {
    if(navigationBudget--<=0)return null;
    if(Math.hypot(p.x-m.x,p.z-m.z)<75 && clearWalk(m,p)) { paths.delete(m.id); return [p.x-m.x,p.z-m.z]; }
    let path=paths.get(m.id);
    if(!path || Math.hypot(path.target.x-p.x,path.target.z-p.z)>12 || !path.nodes.length) {
      const first=nearestNode(m),last=nearestNode(p);
      if(first===undefined || last===undefined) return [p.x-m.x,p.z-m.z];
      const queue=[first],previous=new Map([[first,null]]);
      for(let i=0;i<queue.length && !previous.has(last);i++) for(const [next] of roadNetwork.nodes[queue[i]].links) if(!previous.has(next)) { previous.set(next,queue[i]); queue.push(next); }
      const nodes=[];
      if(previous.has(last)) for(let i=last;i!==null;i=previous.get(i)) nodes.unshift(roadNetwork.nodes[i]);
      path={nodes,target:{x:p.x,z:p.z}}; paths.set(m.id,path);
    }
    while(path.nodes.length && Math.hypot(path.nodes[0].x-m.x,path.nodes[0].z-m.z)<1) path.nodes.shift();
    const next=path.nodes[0]||p; return [next.x-m.x,next.z-m.z];
  }
  const world={
    spawn:[90,45],floor:gameFloor,blocked,chaseTarget,resetNavigation:()=>paths.clear(),
    objectives:[{id:'church',name:'Kirche',x:91,z:-1.1},{...mines.seal('mine-west'),id:'mine',name:'Westmine',guard:'deep'},{id:'castle',name:'Burg',x:castleSeal.x,z:castleSeal.z,guard:'alpha'}],
    waterDepth:(x,z)=>layout.lakeDistance(x,z)<0?1:0,waterLevel:.09,boatOk,onRoad:(x,z)=>streetHeight(x,z)!==null,
    bell:{x:91,z:22.5},
    tick:(x,y,z)=>{castleSite.update(x,y,z);buildings.update(x,y,z);mines.update(x,y,z);},
    indoor:(x,y,z)=>Math.max(castleSite.indoor(x,y,z),buildings.indoor(x,y,z),Number(mines.indoor(x,y,z))),
    ceiling:(x,z,feet)=>{const y=mines.floor(x,z,feet);return y===null?null:y+3.2;},
    rayDistance(origin,direction,maxRange) {
      shotRay.set(new THREE.Vector3(origin.x,origin.y,origin.z),new THREE.Vector3(direction.x,direction.y,direction.z).normalize());
      shotRay.near=.05; shotRay.far=maxRange;
      const castleHits=castleSite.walk && castleSite.walk.near(origin.x,origin.z)?castleSite.targets():[];
      const terrainHit=terrainRay.distance(origin,shotRay.ray.direction,maxRange);
      shotRay.far=terrainHit;
      return shotRay.intersectObjects(shotMeshes.concat(castleHits,buildings.targets(),mines.root.children.filter(o=>o.isMesh),villageWall.targets()),false)[0]?.distance ?? terrainHit;
    },
    spawnEnemy(p,random) {
      if(mines.indoor(p.x,p.y,p.z)) {
        const candidates=[];
        for(const r of mines.routes)for(let i=1;i<r.points.length;i++) {
          const a=r.points[i-1],b=r.points[i];
          for(let t=0;t<1;t+=.2){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=mines.floor(x,z,p.y),d=Math.hypot(x-p.x,z-p.z);if(y!==null&&d>12&&d<28&&!mines.blocked(x,z,y))candidates.push([x,z]);}
        }
        return candidates.length?candidates[Math.floor(random()*candidates.length)]:null;
      }
      const candidates=roadNetwork.nodes.filter(n=>{
        const d=Math.hypot(n.x-p.x,n.z-p.z); return d>30 && d<58 && Math.abs(n.y-p.y)<16 && !blocked(n.x,n.z,gameFloor(n.x,n.z,n.y));
      });
      if(candidates.length) { const n=candidates[Math.floor(random()*candidates.length)]; return [n.x,n.z]; }
      for(let i=0;i<40;i++) {
        const angle=random()*Math.PI*2,radius=30+random()*28,x=p.x+Math.sin(angle)*radius,z=p.z+Math.cos(angle)*radius,y=gameFloor(x,z,p.y);
        if(!blocked(x,z,y) && Math.abs(y-p.y)<12 && clearWalk(p,{x,y,z})) return [x,z];
      }
      return null;
    }
  };
  Object.assign(world,NachtjagdSpots.build({layout,blocked,floor:gameFloor,boatOk,routes})); // Truhen, Händler, Schmied, Bildstöcke, Angelplätze, Notizen, Reliquien
  scene.updateMatrixWorld(true);
  world.checks=[{name:'Dorfstart frei',passed:!blocked(90,45,gameFloor(90,45))},...world.objectives.map(o=>({name:o.name+'-Siegel erreichbar',passed:!blocked(o.x,o.z,gameFloor(o.x,o.z))})),{name:'Glockenplatz frei',passed:!blocked(world.bell.x,world.bell.z,gameFloor(world.bell.x,world.bell.z))},{name:'Spielorte frei',passed:[...world.loots,...world.shrines,...world.fishSpots,world.merchant,world.smith].every(p=>!blocked(p.x,p.z,gameFloor(p.x,p.z)))}];
  world.checks.push(
    {name:'Geländewagen stehen frei',passed:world.jeeps.length===2 && world.jeeps.every(j=>[[0,0],[0,2.4],[0,-2.4],[1.3,2.2],[-1.3,2.2],[1.3,-2.2],[-1.3,-2.2]].every(([lx,lz])=>{const s=Math.sin(j.yaw),c=Math.cos(j.yaw),x=j.x-c*lx+s*lz,z=j.z+s*lx+c*lz;return !blocked(x,z,gameFloor(x,z));}))},
    {name:'Lorenschienen frei',passed:world.carts.length===4 && world.rails.nodes.every(n=>!blocked(n.x,n.z,gameFloor(n.x,n.z)))},
    {name:'Gondelstationen begehbar, Strecke über 250 m',passed:world.gondola.stations.every(s=>!blocked(s.x,s.z,gameFloor(s.x,s.z))) && Math.hypot(world.gondola.stations[0].x-world.gondola.stations[1].x,world.gondola.stations[0].z-world.gondola.stations[1].z)>250},
    {name:'Boote liegen im Wasser',passed:world.boats.length>=2 && world.boats.every(b=>boatOk(b.x,b.z))}
  );
  const startButton=document.querySelector('#play-start'),startLabel=startButton.textContent;
  const menuPlay=document.querySelector('#menu-play');menuPlay.disabled=true;
  startButton.disabled=true; startButton.textContent='Modelle werden geladen …';
  gameplay=NachtjagdPlay.create({THREE,scene,camera,canvas,world,sky,layoutSky,backdrop,onStart:()=>{ toggleEditor(false); labels.visible=false; grid.visible=false; keys.clear(); drag=null; },onExit:()=>setView('village')});
  Promise.all([castleSite.ready,buildings.ready,importedForest.ready]).then(()=>{
  if(buildings.failed) {startButton.textContent='Kirche konnte nicht geladen werden';return;}
  if(!importedForest.root.userData.treeCount) {startButton.textContent='Baummodelle konnten nicht geladen werden · bitte neu laden';return;}
  world.checks.push({name:'Alle Bäume verwenden importierte Modelle einschließlich Seeinsel',passed:importedForest.root.userData.treeCount===treePlacements.length+3&&importedForest.root.userData.variantCount===8,value:importedForest.root.userData});
  startButton.disabled=false; menuPlay.disabled=false; startButton.textContent=startLabel;
  // Das Burg-Siegel liegt im Rittersaal: erst mit geladenem Modell prüfbar.
  world.checks=world.checks.filter(c=>c.name!=='Burg-Siegel erreichbar');
  world.checks.unshift({name:'Burg-Siegel erreichbar',passed:!!castleSite.walk && !blocked(castleSeal.x,castleSeal.z,gameFloor(castleSeal.x,castleSeal.z))});
  if(new URLSearchParams(location.search).has('test')) {
    const buildingChecks=[];
    function probeWalk(start,points) {
      const probe=NachtjagdGame.create({world:{...world,spawn:[start.x,start.z],spawnEnemy:()=>null,objectives:[],loots:[],shrines:[]}});probe.start();
      let p=probe.snapshot().player;
      for(const goal of points) {
        for(let i=0;i<1600&&Math.hypot(p.x-goal.x,p.z-goal.z)>.08;i++) {
          const distance=Math.hypot(p.x-goal.x,p.z-goal.z);
          probe.setLook(Math.atan2(goal.x-p.x,goal.z-p.z),0);
          const before=p;p=probe.step(Math.min(.025,distance/6.3),{forward:1}).player;
          if(Math.hypot(p.x-before.x,p.z-before.z)<.00001)break;
        }
        if(Math.hypot(p.x-goal.x,p.z-goal.z)>.1)return {passed:false,at:{x:p.x,y:p.y,z:p.z},goal,phase:probe.snapshot().phase,floor:world.floor(goal.x,goal.z,p.y),blocked:world.blocked(goal.x,goal.z,world.floor(goal.x,goal.z,p.y))};
      }
      return {passed:true,y:p.y};
    }
    buildingChecks.push({name:'Kirche vom Vorplatz bis zum Siegel und zurück begehbar',...probeWalk({x:91,z:30},[{x:91,z:-1.1},{x:91,z:30}])});
    for(const mine of layout.mines) {
      const main=mines.routes.find(r=>r.id===mine.id),entry=main.points[0];
      const ex=main.points[1].x-entry.x,ez=main.points[1].z-entry.z,entryLength=Math.hypot(ex,ez);
      const approach={x:entry.x-ex/entryLength*2,z:entry.z-ez/entryLength*2};
      for(const route of mines.routes.filter(r=>r.id===mine.id||r.id.startsWith(mine.id+'-abzweig-'))) {
        const last=route.points.at(-1),before=route.points.at(-2),len=Math.hypot(last.x-before.x,last.z-before.z);
        const end={x:last.x-(last.x-before.x)/len*1.2,z:last.z-(last.z-before.z)/len*1.2};
        const path=route===main?[...main.points.slice(1,-1),end]:[route.points[0],end];
        buildingChecks.push({name:`${route.id}: Spielfigur hinein und zurück`,...probeWalk(approach,[entry,...path,...path.slice(0,-1).reverse(),entry,approach])});
      }
    }
    for(const [i,stair] of villageWall.stairs.entries()) {
      const approach={x:stair.start.x-stair.cos*.7,z:stair.start.z-stair.sin*.7};
      const top={x:stair.end.x+stair.cos*.2,z:stair.end.z+stair.sin*.2};
      buildingChecks.push({name:`Dorfmauer Treppe ${i+1}: hinauf und hinunter`,...probeWalk(approach,[stair.start,top,stair.start,approach])});
    }
    buildingChecks.push({name:'Baumkronen halten die Gondeltrasse frei',passed:treePlacements.every(t=>layout.gondolaClear(t.x,t.z,8))});
    for(const h of buildings.houses) {
      for(const [i,e] of h.data.entries.entries()) {
        const outside=h.spec.toWorld(e.outside.x,e.outside.z),inside=h.spec.toWorld(e.inside.x,e.inside.z);
        buildingChecks.push({name:`Haus ${h.spec.id+1}: Eingang ${i+1} hinein und hinaus`,...probeWalk(outside,[inside,outside])});
        const [nx,nz]={front:[0,1],back:[0,-1],right:[1,0],left:[-1,0]}[e.side];
        const approach=h.spec.toWorld(e.x+nx*3.6,e.z+nz*3.6);
        buildingChecks.push({name:`Haus ${h.spec.id+1}: Außentreppe ${i+1} angeschlossen`,...probeWalk(approach,[outside,inside,outside,approach])});
      }
      const st=h.data.plan.stairs,mid=(st.x0+st.x1)/2;
      const start=h.spec.toWorld(st.returnFlight?(st.x0+mid)/2:mid,st.z1+.45),route=[];
      for(let level=0;level<st.flights;level++) {
        if(st.returnFlight)route.push(h.spec.toWorld((st.x0+mid)/2,st.z1+.45),h.spec.toWorld((st.x0+mid)/2,st.z0+.4),h.spec.toWorld((st.x1+mid)/2,st.z0+.4),h.spec.toWorld((st.x1+mid)/2,st.z1+.45));
        else route.push(h.spec.toWorld(mid,st.z0-.4));
      }
      const result=probeWalk(start,route);
      buildingChecks.push({name:`Haus ${h.spec.id+1}: obere Etagen über Treppe erreichbar`,...result,passed:result.passed&&Math.abs(result.y-(h.spec.y+.3+st.flights*3.15))<.1});
    }
    world.checks.push(...buildingChecks);
    for(const [name,start,end] of [['Spielfigur steigt die Dorftreppe hinauf',[120,57],[120,87]],['Spielfigur überquert das Viadukt',viaduct.b,viaduct.a]]) {
      const probe=NachtjagdGame.create({world:{...world,spawn:start,spawnEnemy:()=>null}}); probe.start();
      let p=probe.snapshot().player;
      for(let i=0;i<2500 && Math.hypot(p.x-end[0],p.z-end[1])>.5;i++) { probe.setLook(Math.atan2(end[0]-p.x,end[1]-p.z),0); p=probe.step(.1,{forward:1}).player; }
      world.checks.push({name,passed:Math.hypot(p.x-end[0],p.z-end[1])<.5});
    }
    world.checks.push({name:'Kirchenmauer hält Schüsse auf',passed:world.rayDistance({x:91,y:churchOrigin.y+2,z:10},{x:1,y:0,z:0},30)<8});
    globalThis.NachtjagdDebug={buildings,buildingSpecs,churchOrigin,castleSite,renderer,sky,world,THREE,scene,camera,roadNetwork,clearWalk,gameFloor,groundHeight,streetHeight,stairs,viaduct,surfaceHeight,get gameplay(){return gameplay;}}; // Prüfhaken für automatische Durchläufe (nur mit ?test)
    const report=document.createElement('pre'); report.id='game-tests'; report.hidden=true; report.textContent=JSON.stringify({checks:world.checks}); document.body.append(report);
  }
  if(new URLSearchParams(location.search).get('play')==='1') gameplay.start();
  });
  // Ansichten auf die Fahrzeugorte (Koordinaten kommen aus der Weltbeschreibung)
  {
    const st=world.gondola.stations,jeep=world.jeeps[0],boat=world.boats[0];
    {
      const peak=layout.highPeaks.reduce((a,b)=>b.top>a.top?b:a);
      views.peaks={target:[peak.x,groundHeight(peak.x,peak.z)*.6,peak.z],distance:900,yaw:2.6,polar:1.38,name:'Hochgebirge · höchster Gipfel '+Math.round(groundHeight(peak.x,peak.z))+' m'};
      views.valley={target:[-25,60,-60],distance:240,yaw:3.14,polar:1.5,name:'Talblick nach Norden · Berge vom Dorf aus'};
    }
    views.gondola={target:[(st[0].x+st[1].x)/2,(st[0].y+st[1].y)/2,(st[0].z+st[1].z)/2],distance:420,yaw:.9,polar:.95,name:'Gondelbahn · Talstation und Bergstation · zwei Kabinen'};
    views.talstation={target:[st[0].x,st[0].y+3,st[0].z],distance:30,yaw:-.4,polar:1.05,name:'Talstation der Gondelbahn'};
    views.jeep={target:[jeep.x,gameFloor(jeep.x,jeep.z)+1,jeep.z],distance:28,yaw:.6,polar:.9,name:'Willys Jeep am Dorfrand'};
    views.boats={target:[boat.x,world.waterLevel,boat.z],distance:45,yaw:.4,polar:.8,name:'Ruderboote am Seesteg · Platzhaltermodell'};
    views.carts={target:[world.rails.nodes[0].x,gameFloor(world.rails.nodes[0].x,world.rails.nodes[0].z)+1,world.rails.nodes[0].z],distance:40,yaw:.5,polar:.4,name:'Minenschienen mit Loren · Platzhaltermodell'};
  }
  setView('world');
  const nightButton=document.createElement('button'); nightButton.textContent='Nacht ansehen'; document.querySelector('header').append(nightButton);
  nightButton.addEventListener('click',()=>{
    layoutSky.night=layoutSky.night?0:1; scene.background=sky.apply(layoutSky); backdrop.setMood(layoutSky.night?sky.fogColor:null);
    nightButton.textContent=layoutSky.night?'Dämmerung ansehen':'Nacht ansehen'; renderer.shadowMap.needsUpdate=true;
  });
  views.watchtower={target:[outdoor.tower.x,outdoor.tower.top-2,outdoor.tower.z],distance:42,yaw:-1.2,polar:1.12,name:'Wachturm am Osttor'};
  const towerOption=document.createElement('option'); towerOption.value='watchtower'; towerOption.textContent='Wachturm'; document.querySelector('#place-view').append(towerOption);
  requestAnimationFrame(frame);
})();
