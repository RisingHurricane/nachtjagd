'use strict';

// Räumliche Studie: ausschließlich Baukörper, Wege und Waldkegel.
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Dreidimensionaler Blockout des Dorfs und des Tals');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cbd8dc');
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 2200);
  scene.add(new THREE.HemisphereLight(0xf9fbff, 0x6d786c, .85));
  const sun = new THREE.DirectionalLight(0xfff7e5, .85);
  sun.position.set(-80, 180, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, far: 650 });
  sun.shadow.bias = -.0005;
  scene.add(sun);
  const colors = { ground: '#e4e7df', house: '#d6ba92', landmark: '#b59370', forest: '#658777', path: '#b9a78b', castle: '#8a9aab', water: '#8eb0bc', hill: '#bac3b4' };
  const materials = {};
  for (const [key, value] of Object.entries(colors)) materials[key] = new THREE.MeshLambertMaterial({ color: new THREE.Color(value).convertSRGBToLinear() });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1), coneGeometry = new THREE.ConeGeometry(1, 1, 7);
  const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#526266', transparent: true, opacity: .3 });
  const colliders = [], roadSegments = [];
  const labels = new THREE.Group();
  scene.add(labels);
  function box(x, z, w, d, h, material = 'house', rotation = 0, floor = 0, solid = true) {
    const mesh = new THREE.Mesh(boxGeometry, materials[material]);
    mesh.position.set(x, floor + h / 2, z);
    mesh.scale.set(w, h, d);
    mesh.rotation.y = rotation;
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) {
      mesh.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
      colliders.push({ x, z, w: w / 2, d: d / 2, rotation });
    }
    return mesh;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(850, 750), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-90, 0, -65);
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(800, 80, '#aab8b4', '#ccd4cc');
  grid.position.set(-90, .025, -65);
  scene.add(grid);
  function road(points, width = 6) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
      box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, width, Math.hypot(dx, dz) + width * .3, .06, 'path', Math.atan2(dx, dz), .035, false);
      roadSegments.push({ a, b, width });
    }
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
    sprite.position.set(x, height, z); sprite.scale.set(size, size / 5.12, 1);
    labels.add(sprite);
  }
  // Hauspositionen und Dorfgrundriss aus dem zuletzt erprobten Entwurf.
  const houses = [
    [-36,-4,9,10,.025],[-23,-6,8,9,-.035],[20,-7,9,10,-.025],[32,-4,8,9,.025],[44,-2,10,9,-.08],
    [-33,20,10,10,.045],[-20,21,8,9,-.035],[24,23,11,11,-.025],[39,21,9,10,.035],
    [111,-39,9,8,0],[122,-17,10,8,0],[-129,81,8,7,0],[100,117,8,7,0],
    [-16,-23,8,9,Math.PI/2+.02],[9,-26,8,9,-Math.PI/2-.025],[-16,-37,8,9,Math.PI/2-.025],[9,-40,7,9,-Math.PI/2+.025],[-4,27,10,9,.02]
  ];
  houses.forEach((h, i) => box(...h.slice(0, 4), i === 2 ? 9 : 7 + (i % 3), 'house', h[4]));
  box(0, 4, 27, 21, .08, 'path', 0, .035, false);
  road([[-57,-10],[-47,9],[-27,9],[0,8],[45,10],[83,20],[100,45]], 7);
  road([[0,8],[-4,-10],[-4,-31],[-5,-42]], 5.5);
  road([[10,10],[11,32],[10,60],[12,106],[50,167],[82,199]], 6);
  road([[83,20],[111,-17],[130,-60]], 5);
  road([[-27,9],[-68,42],[-129,81],[-120,104]], 5);
  road([[100,45],[100,117],[118,131]], 4);
  road([[-57,-10],[-110,-35],[-146,-26],[-177,-38],[-204,-63],[-222,-94],[-239,-128],[-253,-160],[-285,-180],[-320,-165]], 6);
  road([[-4,-52],[-10,-88],[-10,-111],[23,-130]], 4);
  box(7, -3, 2.5, 2.5, 1.2, 'castle'); box(-5, 3, 2, 2, .35, 'landmark');
  box(-5, -57, 13, 23, 13, 'landmark'); box(-5, -43, 7, 7, 25, 'landmark');
  box(130, -60, 13, 12, 13, 'landmark'); box(-120, 104, 12, 16, 10, 'landmark');
  box(70, 45, 13, 11, 7, 'landmark'); box(168, 90, 7, 7, 20, 'castle'); box(118, 131, 11, 9, 3, 'landmark');
  label('Dorfplatz', 0, 10, 3, 14); label('Kirchgasse', -4, -30, 11, 15); label('Kirche', -5, -57, 28, 14);
  label('Mühle', 130, -60, 19, 17); label('Scheune', -120, 104, 15, 20); label('Wachturm', 168, 90, 25, 23);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 64), materials.water);
  lake.rotation.x = -Math.PI / 2; lake.scale.set(110, 60, 1); lake.position.set(-35, .09, -171);
  scene.add(lake); label('See', -35, -171, 1, 25);
  // Die Burg wird vorerst nur als erhöhtes Ensemble mit Hof dargestellt.
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(43, 61, 18, 10), materials.hill);
  hill.position.set(-320, 9, -235); hill.receiveShadow = true; scene.add(hill);
  box(-320, -235, 62, 53, .8, 'castle', 0, 18, false);
  box(-340, -235, 12, 51, 15, 'castle', 0, 18); box(-300, -235, 12, 51, 18, 'castle', 0, 18);
  box(-320, -257, 31, 10, 21, 'castle', 0, 18); box(-320, -213, 10, 8, 13, 'castle', 0, 18);
  box(-338, -254, 10, 10, 29, 'castle', 0, 18);
  const ramp = box(-320, -187, 9, Math.hypot(18, 43), 1, 'path', 0, 9, false);
  ramp.rotation.x = Math.atan2(18, 43);
  label('Burg / Schlosshof', -320, -235, 54, 49);
  // Reproduzierbarer Wald; Wege, See und Gebäuderänder bleiben frei.
  let seed = 71;
  function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
  function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }
  const forest = new THREE.InstancedMesh(coneGeometry, materials.forest, 420), dummy = new THREE.Object3D();
  let treeCount = 0;
  for (let i = 0; i < 2500 && treeCount < 420; i++) {
    const x = -252 + random() * 450, z = -110 + random() * 290;
    if ((x / 65) ** 2 + (z / 65) ** 2 < 1) continue;
    if (((x + 35) / 118) ** 2 + ((z + 171) / 69) ** 2 < 1) continue;
    if (colliders.some(c => Math.hypot(x - c.x, z - c.z) < Math.max(c.w, c.d) + 8)) continue;
    if (roadSegments.some(s => segmentDistance(x, z, s.a, s.b) < s.width / 2 + 6)) continue;
    const height = 10 + random() * 8;
    dummy.position.set(x, height / 2, z); dummy.scale.set(2.6 + random() * 1.6, height, 2.6 + random() * 1.6); dummy.updateMatrix();
    forest.setMatrixAt(treeCount++, dummy.matrix);
    colliders.push({ x, z, w: 1, d: 1, rotation: 0 });
  }
  forest.count = treeCount; forest.castShadow = true; scene.add(forest);
  label('Waldweg zur Burg', -160, -27, 15, 36); label('10 m Raster', 60, 65, .7, 20);

  const target = new THREE.Vector3();
  let yaw, polar, distance, mode, walkingYaw = Math.PI, pitch = 0;
  const keys = new Set();
  const views = {
    village: { target: [0,0,-14], distance: 150, yaw: .68, polar: .78, name: 'Dorfkern · 18 Hauskörper · Raster 10 m' },
    world: { target: [-92,0,-63], distance: 640, yaw: .37, polar: .63, name: 'Ganzes Tal · Anordnung der Orte' },
    castle: { target: [-320,22,-235], distance: 145, yaw: .55, polar: .85, name: 'Burg · Hof, Baukörper und Zufahrt' },
    forest: { target: [-150,0,-32], distance: 110, yaw: 1.4, polar: 1.05, name: 'Waldweg · Verbindung zwischen Dorf und Burg' }
  };
  function setView(view) {
    mode = view; keys.clear(); labels.visible = view !== 'walk';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view === 'walk') {
      camera.position.set(0, 1.75, 13); walkingYaw = Math.PI; pitch = 0;
      status.textContent = 'Im Dorf · Augenhöhe 1,75 m';
      help.textContent = 'WASD / Pfeiltasten: gehen · Ziehen: umsehen · Shift: schneller · Esc: Übersicht';
    } else {
      const preset = views[view]; target.fromArray(preset.target); ({ yaw, polar, distance } = preset);
      status.textContent = preset.name;
      help.textContent = 'Ziehen: drehen · Mausrad: Abstand · Rechte Maustaste: verschieben';
    }
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  let drag = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('pointermove', event => {
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
  canvas.addEventListener('wheel', event => { event.preventDefault(); if (mode !== 'walk') distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * .001), 20, 1000); }, { passive: false });
  addEventListener('keydown', event => {
    if (event.key === 'Escape') setView('village');
    const key = event.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) { keys.add(key); event.preventDefault(); }
  });
  addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); drag = null; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  function blocked(x, z) {
    if (x < -270 || x > 210 || z < -130 || z > 205) return true;
    if (((x + 35) / 111) ** 2 + ((z + 171) / 61) ** 2 < 1) return true;
    return colliders.some(c => {
      const dx = x - c.x, dz = z - c.z, cosine = Math.cos(c.rotation), sine = Math.sin(c.rotation);
      return Math.abs(cosine * dx - sine * dz) < c.w + .45 && Math.abs(sine * dx + cosine * dz) < c.d + .45;
    });
  }
  let previous = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (mode === 'walk') {
      const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
      const side = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      const speed = (keys.has('shift') ? 12 : 5) * dt / (Math.hypot(forward, side) || 1);
      const dx = (Math.sin(walkingYaw) * forward - Math.cos(walkingYaw) * side) * speed;
      const dz = (Math.cos(walkingYaw) * forward + Math.sin(walkingYaw) * side) * speed;
      if (!blocked(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
      if (!blocked(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
      camera.lookAt(camera.position.x + Math.sin(walkingYaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), camera.position.z + Math.cos(walkingYaw) * Math.cos(pitch));
    } else {
      camera.position.set(target.x + distance * Math.sin(polar) * Math.sin(yaw), target.y + distance * Math.cos(polar), target.z + distance * Math.sin(polar) * Math.cos(yaw));
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
  }
  setView('village'); requestAnimationFrame(frame);
})();
