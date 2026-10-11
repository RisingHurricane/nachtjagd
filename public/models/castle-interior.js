'use strict';

import { createKit, PALETTE } from './kit.js';

// Innenräume der Burg aus castle.js (grobe Fassung aus einfachen Körpern):
//   Rittersaal (Erdgeschoss des Palas), Bibliothek (Obergeschoss des Palas),
//   Turmtreppe und Turmzimmer im Hauptturm, Kapelle mit Apsis und bunten Fenstern.
//
// Die Räume liegen in denselben lokalen Koordinaten wie castle.js, das Modul passt also 1:1 über die
// Burg (gleiche group.position und group.rotation.y). Wände sind Hüllen, die nur von innen sichtbar
// sind (BackSide), von außen sieht man weiter die Außenwände der Burg.
//
// Rückgabe: THREE.Group mit userData
//   rooms:  [{ id, label, group, eye: [x, y, z], target: [x, y, z], cutY }] für Kamerastandorte, cutY ist eine
//           Schnitthöhe, bei der der Raum von oben offen liegt
//   lights: [{ room, x, y, z, color, intensity, distance }] Lichtvorschläge je Raum, damit der Aufrufer
//           nur die Lichter des gerade betrachteten Raums einschalten kann
// Hinweis: Die Außenwände von castle.js haben noch keine Türen. Für ein begehbares Innere müssen dort
// Öffnungen geschnitten werden, die Innenräume bringen noch keine Kollision mit.

export function buildCastleInterior(THREE, options = {}) {
  const opt = { ...PALETTE, ...options };
  const group = new THREE.Group();
  group.name = 'castleInterior';
  // noHosts: Möbel und Kleinteile aus box() sollen keine Fenster aufnehmen, nur die Raumhüllen.
  const kit = createKit(THREE, group, { ...opt, noHosts: true });
  const { add, box, frame } = kit;
  const rooms = [];
  const lights = [];

  // ---------- Materialien und kleine Helfer ----------
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, ...extra });
  const glow = (color, k = 1.3) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 1 });
  const I = {
    plaster: mat(0x8d8478, { side: THREE.BackSide }),
    plasterDark: mat(0x6b645c, { side: THREE.BackSide }),
    plasterFront: mat(0x6b645c),
    floorStone: mat(0x3f4144),
    wood: mat(0x4a3a2e),
    woodDark: mat(0x2e241c),
    stone: mat(0x6c747a),
    red: mat(0x7a1f26),
    rug: mat(0x5b1d24),
    gold: mat(0xc9a24a, { roughness: 0.5, emissive: 0x3a2a08 }),
    iron: mat(0x1b1d20),
    paper: mat(0xd8cba8),
    fire: glow(0xff8a2a, 1.7),
    candle: glow(0xffd58a, 1.5),
    moon: glow(0x9fbbe6, 0.95),
    glass: [0xb23a48, 0x3f6fb5, 0xd9a93a, 0x3f9a6a, 0x8a4fb0].map((c) => glow(c, 1.05)),
  };

  // Zufall mit festem Startwert, damit die Bücher bei jedem Aufruf gleich aussehen.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // Spitzbogenform (Breite w, Kämpferhöhe spring, Scheitelhöhe apex), unten bei y = 0, Mitte bei x = 0.
  const archShape = (w, spring, apex) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, spring);
    s.lineTo(0, apex);
    s.lineTo(-w / 2, spring);
    s.lineTo(-w / 2, 0);
    return s;
  };
  const winGeo = new THREE.ExtrudeGeometry(archShape(1, 0.65, 1), { depth: 0.08, bevelEnabled: false });
  winGeo.translate(0, -0.5, -0.04); // Mitte bei y = 0, Höhe 1

  // Fenster an der Wand. ry gibt die Blickrichtung des Fensters (0: +z, PI: -z, PI/2: +x, -PI/2: -x).
  // Fenster in einer Raumhülle werden beim Abschluss (kit.finish) echte Löcher mit Laibung, Rahmen,
  // Sprossen und Glas. Buntglas (Kapelle) hat farbiges, durchscheinendes Glas.
  const stained = new Map();
  const looks = new Map();
  function lookFor(material) {
    if (!looks.has(material)) {
      let glass = kit.M.glass;
      if (material !== I.moon) {
        if (!stained.has(material)) {
          stained.set(material, new THREE.MeshStandardMaterial({
            name: 'stainedGlass', color: material.color, emissive: material.color, emissiveIntensity: 0.55,
            roughness: 0.2, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false,
          }));
        }
        glass = stained.get(material);
      }
      looks.set(material, { glass, backing: material });
    }
    return looks.get(material);
  }
  function iwin(x, y, z, ry, w, h, material) {
    // Normale aus der Wand heraus (vom Raum weg): gegen die Blickrichtung des Fensters
    kit.pushWin(x, y, z, [-Math.sin(ry), -Math.cos(ry)], w, h, lookFor(material));
  }

  // Hülle eines Raums: nur von innen sichtbar. Ohne Boden oder Decke, wenn dort ein Durchgang bleibt.
  function shell(w, h, d, x, y0, z, material, opts = {}) {
    return kit.shellBox(w, h, d, x, y0, z, material, opts);
  }

  const cyl = (rt, rb, h, x, y0, z, material, segs = 10) =>
    add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), material), x, y0 + h / 2, z);
  const ball = (r, x, y, z, material) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), material), x, y, z);

  // Kerze: Wachskörper mit leuchtender Flamme
  function candle(x, y0, z, h = 0.22) {
    cyl(0.03, 0.03, h, x, y0, z, I.paper, 6);
    ball(0.035, x, y0 + h + 0.04, z, I.candle);
  }

  // Kronleuchter: Eisenring an Ketten mit Kerzen
  function chandelier(x, yTop, yRing, z, r = 1.1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 20), I.iron);
    ring.rotation.x = Math.PI / 2;
    add(ring, x, yRing, z);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const ch = cyl(0.02, 0.02, yTop - yRing, x + Math.cos(a) * r * 0.7, yRing, z + Math.sin(a) * r * 0.7, I.iron, 4);
      ch.rotation.set(0, 0, 0);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      candle(x + Math.cos(a) * r, yRing + 0.06, z + Math.sin(a) * r);
    }
  }

  // ======================================================================================
  // Rittersaal: Erdgeschoss des Palas, Innenmaß 22,8 x 7,8 m, Höhe 7 m
  // ======================================================================================
  {
    const cx = -4;
    const cz = -6;
    const w = 22.8;
    const d = 7.8;
    const H = 7;
    shell(w, H, d, cx, 0, cz, I.plaster, { noTop: true });
    box(w, 0.06, d, cx, 0, cz, I.floorStone);
    box(8.5, 0.02, 3.4, cx, 0.06, cz, I.rug);
    // Decke und Boden des Obergeschosses mit Treppenöffnung an der Nordwand (x 0 bis 7,4)
    box(15.2, 0.4, d, -7.8, H, cz, I.woodDark);
    box(7.6, 0.4, 6.3, 3.6, H, -5.25, I.woodDark);
    // Deckenbalken
    for (let x = -13.4; x <= 5.6; x += 3) box(0.4, 0.45, d, x, H - 0.45, cz, I.wood);
    box(w, 0.4, 0.4, cx, H - 0.4, cz, I.wood);

    // Tafel mit Bänken, Stühlen am Kopfende und Kerzen
    box(11, 0.12, 1.5, cx, 0.9, cz, I.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.16, 0.9, 0.16, cx + sx * 5.1, 0, cz + sz * 0.55, I.woodDark);
    for (const sz of [-1, 1]) {
      box(10.4, 0.08, 0.45, cx, 0.5, cz + sz * 1.2, I.wood);
      for (const sx of [-1, 1]) box(0.12, 0.5, 0.4, cx + sx * 5, 0, cz + sz * 1.2, I.woodDark);
    }
    for (const sx of [-1, 1]) {
      box(0.6, 0.08, 0.6, cx + sx * 6.1, 0.55, cz, I.wood);
      box(0.08, 1.3, 0.6, cx + sx * 6.4, 0.55, cz, I.woodDark);
    }
    for (let i = -2; i <= 2; i++) candle(cx + i * 2, 0.96, cz + (i % 2 === 0 ? 0.2 : -0.2));

    // Kamin an der Westwand
    const fx = -15.4;
    box(1.1, 3.9, 4.4, fx + 0.55, 0, cz, I.stone);
    box(1.0, H - 3.9, 3.4, fx + 0.5, 3.9, cz, I.stone); // Rauchfang
    box(0.2, 1.5, 2.2, fx + 1.15, 0.2, cz, I.fire);
    box(0.5, 0.15, 4.6, fx + 1.3, 3.65, cz, I.woodDark); // Sims
    // Zweiter, kleiner Kamin an der Ostwand
    box(0.9, 3.2, 3.0, 7.4 - 0.45, 0, -3.9, I.stone);
    box(0.2, 1.2, 1.6, 7.4 - 0.95, 0.2, -3.9, I.fire);

    // Fenster, Banner, Wandleuchter
    for (const x of [-13.2, -9.6, -6, -2.4, 1.2, 4.8]) {
      iwin(x, 3.8, -9.86, 0, 1.0, 2.7, I.moon);
      iwin(x, 3.8, -2.14, Math.PI, 1.0, 2.7, I.moon);
    }
    for (const x of [-11.4, -7.8, -4.2, -0.6, 3.0]) {
      box(1.0, 3.2, 0.06, x, 1.7, -9.86, I.red);
      box(0.12, 3.2, 0.07, x, 1.7, -9.855, I.gold);
      box(1.2, 0.1, 0.1, x, 4.95, -9.84, I.gold);
    }
    for (const x of [-11.4, -4.2, 3.0]) {
      box(0.1, 0.35, 0.1, x, 2.2, -2.2, I.iron);
      ball(0.07, x, 2.62, -2.22, I.candle);
    }

    // Kronleuchter
    for (const x of [-10.5, -4, 2.5]) chandelier(x, H - 0.3, 5.3, cz);
    lights.push({ room: 'saal', x: -9, y: 5, z: cz, color: 0xffc27a, intensity: 1.5, distance: 16 });
    lights.push({ room: 'saal', x: 2, y: 5, z: cz, color: 0xffc27a, intensity: 1.5, distance: 16 });
    lights.push({ room: 'saal', x: -14, y: 1.4, z: cz, color: 0xff7a2a, intensity: 1.6, distance: 11 });

    // Treppe in das Obergeschoss: 16 Stufen entlang der Nordwand, steigt nach +x
    for (let i = 0; i < 16; i++) box(0.45, (i + 1) * 0.4625, 1.4, 0.225 + 0.45 * i, 0, -9.2, I.stone);

    rooms.push({ id: 'saal', label: 'Rittersaal', eye: [-14, 1.7, -3.2], target: [-1, 2.2, -6.5], cutY: 7.2 });
  }

  // ======================================================================================
  // Bibliothek: Obergeschoss des Palas (y 7,4 bis 12,8)
  // ======================================================================================
  {
    const cx = -4;
    const cz = -6;
    const y0 = 7.4;
    shell(22.8, 5.4, 7.8, cx, y0, cz, I.plasterDark, { noBottom: true });
    box(6.5, 0.03, 3.8, -5, y0, -5.6, I.rug);
    // Regale an der Nordwand: 6 Einheiten à 3 m, je 5 Bretter, Bücher als Instanzen
    const units = [-13.3, -10.3, -7.3, -4.3, -1.3, 1.7];
    const books = [];
    const colors = [0x6e2b2b, 0x2f4a63, 0x5a4a2a, 0x3b5b3a, 0x4a3a5a, 0x8a6a3a, 0x2a2a2e, 0x7a5a52];
    for (const ux of units) {
      box(3.0, 4.4, 0.08, ux, y0, -9.84, I.woodDark); // Rückwand
      box(0.08, 4.4, 0.6, ux - 1.5, y0, -9.55, I.wood);
      box(0.08, 4.4, 0.6, ux + 1.5, y0, -9.55, I.wood);
      for (let r = 0; r < 6; r++) box(3.0, 0.06, 0.6, ux, y0 + r * 0.8, -9.55, I.wood);
      for (let r = 0; r < 5; r++) {
        let x = ux - 1.4;
        while (x < ux + 1.35) {
          const bw = 0.09 + rnd() * 0.06;
          const bh = 0.45 + rnd() * 0.25;
          books.push({ x: x + bw / 2, y: y0 + r * 0.8 + 0.06 + bh / 2, z: -9.55, w: bw, h: bh, c: colors[Math.floor(rnd() * colors.length)] });
          x += bw + 0.01;
        }
      }
    }
    const bookMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.42), mat(0xffffff), books.length);
    const tmp = new THREE.Object3D();
    const col = new THREE.Color();
    books.forEach((b, i) => {
      tmp.position.set(b.x, b.y, b.z);
      tmp.scale.set(b.w, b.h, 1);
      tmp.updateMatrix();
      bookMesh.setMatrixAt(i, tmp.matrix);
      bookMesh.setColorAt(i, col.setHex(b.c));
    });
    bookMesh.instanceMatrix.needsUpdate = true;
    if (bookMesh.instanceColor) bookMesh.instanceColor.needsUpdate = true;
    group.add(bookMesh);

    // Südwand: Fenster, Schreibtisch, Globus
    for (const x of [-12, -7, -2, 3]) iwin(x, y0 + 2.6, -2.14, Math.PI, 1.0, 2.8, I.moon);
    box(2.6, 0.08, 1.1, -5, y0 + 0.8, -4.2, I.wood);
    for (const sx of [-1, 1]) box(0.12, 0.8, 0.9, -5 + sx * 1.15, y0, -4.2, I.woodDark);
    box(0.6, 0.06, 0.45, -5.4, y0 + 0.88, -4.2, I.paper);
    candle(-4.3, y0 + 0.88, -4.3, 0.3);
    box(0.7, 0.08, 0.7, -5, y0, -3.2, I.wood); // Stuhl
    box(0.7, 0.8, 0.08, -5, y0, -2.88, I.woodDark);
    cyl(0.06, 0.1, 1.1, 0.5, y0, -4.8, I.woodDark, 6); // Globus auf Ständer
    ball(0.5, 0.5, y0 + 1.5, -4.8, mat(0x3f6a8a));
    // Lesepult und Truhe
    box(0.9, 1.1, 0.6, -11, y0, -3.2, I.wood);
    box(1.4, 0.7, 0.8, 4.5, y0, -3, I.woodDark);

    chandelier(-5, 12.7, 11.4, -6, 0.9);
    lights.push({ room: 'bibliothek', x: -5, y: 11, z: -6, color: 0xffc27a, intensity: 1.6, distance: 15 });
    lights.push({ room: 'bibliothek', x: 3, y: 9.5, z: -4, color: 0xffb060, intensity: 1.0, distance: 10 });

    rooms.push({ id: 'bibliothek', label: 'Bibliothek', eye: [-13, 9.1, -3.4], target: [-4, 9.4, -8.5], cutY: 13 });
  }

  // ======================================================================================
  // Hauptturm: Wendeltreppe um einen Kern und ein kleines Turmzimmer oben
  // ======================================================================================
  {
    const cx = -3.5;
    const cz = 2.6;
    const rot = Math.PI / 8; // Achtkant, Fläche nach +z wie der Außenturm
    kit.shellPoly(3.45, 3.7, 35.2, 8, rot, cx, 0, cz, I.plasterDark);
    cyl(3.4, 3.4, 0.08, cx, 0, cz, I.floorStone, 8);
    cyl(0.9, 0.9, 35.2, cx, 0, cz, I.stone, 8); // Treppenkern

    // 176 Stufen, 15 pro Umdrehung, je 0,2 m hoch
    const N = 176;
    const da = (Math.PI * 2) / 15;
    const stepMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, 0.18, 1.9), I.wood, N);
    const t2 = new THREE.Object3D();
    const stepPos = (i) => {
      const a = i * da;
      return [cx + Math.sin(a) * 2.2, (i + 1) * 0.2, cz + Math.cos(a) * 2.2, a];
    };
    for (let i = 0; i < N; i++) {
      const [x, y, z, a] = stepPos(i);
      t2.position.set(x, y - 0.09, z);
      t2.rotation.set(0, a, 0);
      t2.updateMatrix();
      stepMesh.setMatrixAt(i, t2.matrix);
    }
    group.add(stepMesh);

    // Schlitzfenster entlang der Treppe, mondblau
    for (let y = 4; y < 33; y += 5.5) {
      const a = Math.round(((y / 0.2) * da + 2.4) / (Math.PI / 4)) * (Math.PI / 4); // Mitte einer Wandfläche
      iwin(cx + Math.sin(a) * 3.17, y, cz + Math.cos(a) * 3.17, a + Math.PI, 0.5, 1.7, I.moon);
    }
    for (const y of [3, 9, 15, 21, 27, 33]) {
      const a = Math.round(((y / 0.2) * da + Math.PI) / (Math.PI / 4)) * (Math.PI / 4);
      const px = cx + Math.sin(a) * 3.1;
      const pz = cz + Math.cos(a) * 3.1;
      box(0.1, 0.35, 0.1, px, y - 0.2, pz, I.iron);
      ball(0.08, px, y + 0.25, pz, I.candle);
    }
    lights.push({ room: 'treppe', x: cx, y: 9, z: cz + 2.8, color: 0xffb060, intensity: 1.1, distance: 9 });
    lights.push({ room: 'treppe', x: cx, y: 19, z: cz - 2.8, color: 0xffb060, intensity: 1.1, distance: 9 });

    // Turmzimmer (y 35,2 bis 49,2): Sektorboden mit Öffnung für die auslaufende Treppe
    kit.shellPoly(2.9, 2.9, 14, 8, rot, cx, 35.2, cz, I.plaster);
    const ceil = new THREE.ConeGeometry(2.6, 11, 8, 1, true);
    ceil.rotateY(rot);
    add(new THREE.Mesh(ceil, I.woodDark.clone()), cx, 49.2 + 5.5, cz).material.side = THREE.BackSide;
    const aEnd = (N - 1) * da;
    const a1 = aEnd + 0.15;
    const a2 = aEnd + 0.15 + (Math.PI * 2) / 3;
    const rOut = 3.1;
    const rIn = 0.9;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const a = a1 + ((a2 - a1) * k) / 12;
      pts.push([Math.sin(a) * rOut, Math.cos(a) * rOut]);
    }
    for (let k = 12; k >= 0; k--) {
      const a = a1 + ((a2 - a1) * k) / 12;
      pts.push([Math.sin(a) * rIn, Math.cos(a) * rIn]);
    }
    const sector = new THREE.Shape();
    pts.forEach(([x, y], i) => (i === 0 ? sector.moveTo(x, y) : sector.lineTo(x, y)));
    const floorGeo = new THREE.ExtrudeGeometry(sector, { depth: 0.3, bevelEnabled: false });
    floorGeo.rotateX(Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, I.wood);
    floor.position.set(cx, 35.2, cz);
    group.add(floor);
    const am = (a1 + a2) / 2;
    const tx = cx + Math.sin(am) * 2.0;
    const tz = cz + Math.cos(am) * 2.0;
    cyl(0.75, 0.75, 0.85, tx, 35.2, tz, I.woodDark, 10);
    candle(tx, 36.05, tz, 0.3);
    cyl(0.25, 0.25, 0.45, cx + Math.sin(am + 0.7) * 2.2, 35.2, cz + Math.cos(am + 0.7) * 2.2, I.wood, 8); // Hocker
    // Fenster und Fernrohr
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      iwin(cx + Math.sin(a) * 2.66, 38.8, cz + Math.cos(a) * 2.66, a + Math.PI, 0.8, 2.6, I.moon);
    }
    const scope = cyl(0.07, 0.09, 1.1, cx + Math.sin(am - 0.5) * 2.3, 36.2, cz + Math.cos(am - 0.5) * 2.3, I.gold, 8);
    scope.rotation.z = 0.7;
    lights.push({ room: 'turmzimmer', x: cx, y: 38.6, z: cz, color: 0xffc27a, intensity: 0.4, distance: 9 });

    const [sx, sy, sz] = stepPos(45);
    const [lx, ly, lz] = stepPos(55);
    rooms.push({ id: 'treppe', label: 'Turmtreppe', eye: [sx, sy + 1.7, sz], target: [lx, ly + 1.2, lz], cutY: 36 });
    rooms.push({
      id: 'turmzimmer',
      label: 'Turmzimmer',
      eye: [cx + Math.sin(am + Math.PI) * 2.15, 35.2 + 1.65, cz + Math.cos(am + Math.PI) * 2.15],
      target: [tx, 36.2, tz],
      cutY: 50,
    });
  }

  // ======================================================================================
  // Kapelle: Spitzbogengewölbe, Apsis mit sechs bunten Fenstern, Kirchenbänke, Altar
  // ======================================================================================
  {
    const FX = -17.5;
    const FZ = 10;
    const FR = 0.3;
    const W = (x, z) => [FX + x * Math.cos(FR) + z * Math.sin(FR), FZ - x * Math.sin(FR) + z * Math.cos(FR)];
    frame(FX, FZ, FR, () => {
      // Langhaus: Seitenwände (mit echten Fenstern) und darüber das Spitzbogengewölbe, 6,6 x 13,2 m, Scheitel bei 9,5 m
      kit.shellBox(6.6, 6.2, 13.2, 0, 0, 0, I.plasterDark, { only: ['+x', '-x'] });
      const vault = new THREE.ExtrudeGeometry(archShape(6.6, 6.2, 9.5), { depth: 13.2, bevelEnabled: false });
      vault.translate(0, 0, -6.6);
      // ExtrudeGeometry ist nicht indiziert, je Kante des Umrisses 6 Eckpunkte (Boden, rechte Wand, rechtes
      // Dach, linkes Dach, linke Wand). Stirnkappen (Gruppe 0) und Wände weglassen: nur die Dachflächen.
      const g1 = vault.groups[1];
      const sideGeo = new THREE.BufferGeometry();
      sideGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(vault.attributes.position.array.slice((g1.start + 12) * 3, (g1.start + 24) * 3), 3),
      );
      sideGeo.computeVertexNormals();
      add(new THREE.Mesh(sideGeo, I.plasterDark), 0, 0, 0);
      const endWall = new THREE.ExtrudeGeometry(archShape(6.6, 6.2, 9.5), { depth: 0.05, bevelEnabled: false });
      add(new THREE.Mesh(endWall, I.plasterFront), 0, 0, -6.6);
      box(6.6, 0.08, 13.2, 0, 0, 0, I.floorStone);
      box(1.7, 0.02, 11.5, 0, 0.08, -0.6, I.rug);
      // Apsis: Halbzylinder und Halbkegel nach +z
      kit.shellPoly(3.3, 3.3, 6.2, 6, -Math.PI / 2, 0, 0, 6.6, I.plasterDark, Math.PI); // sechs Flächen à 30 Grad
      const apseCone = new THREE.ConeGeometry(3.3, 3.3, 6, 1, true, -Math.PI / 2, Math.PI);
      add(new THREE.Mesh(apseCone, I.plasterDark), 0, 6.2 + 1.65, 6.6);
      add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.08, 12, 1, false, -Math.PI / 2, Math.PI), I.floorStone), 0, 0.04, 6.6);
      add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 12, 1, false, -Math.PI / 2, Math.PI), I.stone), 0, 0.2, 6.6);

      // Altar mit Kreuz und Kerzen
      box(1.8, 1.0, 0.8, 0, 0.4, 8.4, I.stone);
      box(2.0, 0.08, 0.9, 0, 1.4, 8.4, I.red);
      box(0.1, 0.55, 0.05, 0, 1.48, 8.4, I.gold);
      box(0.32, 0.08, 0.05, 0, 1.78, 8.4, I.gold);
      candle(-0.7, 1.48, 8.4, 0.35);
      candle(0.7, 1.48, 8.4, 0.35);

      // Sechs farbige Apsisfenster, je eines pro Wandfläche, zur Mitte gerichtet
      for (let k = 0; k < 6; k++) {
        const t = (-75 + k * 30) * (Math.PI / 180);
        iwin(Math.sin(t) * 3.17, 3.6, 6.6 + Math.cos(t) * 3.17, t + Math.PI, 0.95, 3.4, I.glass[k % I.glass.length]);
      }
      // Seitenfenster und Wandpfeiler des Langhauses
      for (const z of [-4.05, -1.35, 1.35, 4.05]) {
        iwin(-3.28, 4.1, z, Math.PI / 2, 1.0, 3.4, I.glass[Math.floor(rnd() * 5)]);
        iwin(3.28, 4.1, z, -Math.PI / 2, 1.0, 3.4, I.glass[Math.floor(rnd() * 5)]);
      }
      for (const z of [-5.4, -2.7, 0, 2.7, 5.4]) {
        box(0.35, 6.3, 0.5, -3.12, 0.08, z, I.stone);
        box(0.35, 6.3, 0.5, 3.12, 0.08, z, I.stone);
      }
      // Kirchenbänke: acht Reihen links und rechts des Mittelgangs
      for (let r = 0; r < 8; r++) {
        const z = -5.3 + r * 1.05;
        for (const sx of [-1, 1]) {
          box(1.7, 0.08, 0.5, sx * 1.9, 0.45, z, I.wood);
          box(1.7, 0.55, 0.07, sx * 1.9, 0.5, z + 0.25, I.woodDark);
          box(0.08, 0.45, 0.45, sx * 1.9 - 0.8, 0.02, z, I.woodDark);
          box(0.08, 0.45, 0.45, sx * 1.9 + 0.8, 0.02, z, I.woodDark);
        }
      }
      // Kanzel mit Treppe und Leuchter am Gang
      box(1.0, 1.4, 1.0, 2.5, 0.08, 4.9, I.wood);
      box(0.9, 0.4, 0.5, 2.5, 0.08, 4.1, I.wood);
      for (const z of [-2, 2.2]) {
        cyl(0.05, 0.08, 1.5, -0.95, 0.08, z, I.iron, 6);
        ball(0.09, -0.95, 1.65, z, I.candle);
        cyl(0.05, 0.08, 1.5, 0.95, 0.08, z, I.iron, 6);
        ball(0.09, 0.95, 1.65, z, I.candle);
      }
    });
    const [lx, lz] = W(0, -1);
    const [ax, az] = W(0, 8.3);
    const [ex, ez] = W(0, -5.8);
    lights.push({ room: 'kapelle', x: lx, y: 4.5, z: lz, color: 0xffc27a, intensity: 1.2, distance: 12 });
    lights.push({ room: 'kapelle', x: ax, y: 2.2, z: az, color: 0xffa050, intensity: 1.2, distance: 8 });
    rooms.push({ id: 'kapelle', label: 'Kapelle', eye: [ex, 1.7, ez], target: [ax, 2.6, az], cutY: 11 });
  }

  // ======================================================================================
  // Erweiterung: Flügel, Bergfried, Bogengänge und Keller
  // ======================================================================================
  const wp = (fx, fz, fr, x, z) => [fx + x * Math.cos(fr) + z * Math.sin(fr), fz - x * Math.sin(fr) + z * Math.cos(fr)];
  I.steel = mat(0x7d868c, { roughness: 0.5, metalness: 0.4 });
  I.straw = mat(0x9a8450);
  I.barrel = mat(0x5a3e28);
  I.glassBottle = mat(0x2a4a3a, { roughness: 0.4 });
  I.sack = mat(0x8a7b5e);
  I.plasterBoth = mat(0x6b645c, { side: THREE.DoubleSide });
  I.lampIron = mat(0x1b1d20);
  const chainLamp = (x, yTop, yLamp, z) => {
    cyl(0.015, 0.015, yTop - yLamp, x, yLamp, z, I.iron, 4);
    box(0.22, 0.3, 0.22, x, yLamp - 0.3, z, I.lampIron);
    ball(0.09, x, yLamp - 0.15, z, I.fire);
  };
  const sconce = (x, y, z) => {
    box(0.12, 0.3, 0.12, x, y, z, I.iron);
    ball(0.1, x, y + 0.38, z, I.fire);
  };
  const ladder = (x, z, y0, h, alongX = true) => {
    const s = 0.3;
    for (const k of [-1, 1]) box(alongX ? 0.06 : 0.06, h, alongX ? 0.06 : 0.06, x + (alongX ? k * s : 0), y0, z + (alongX ? 0 : k * s), I.wood);
    for (let y = 0.3; y < h; y += 0.32) box(alongX ? 0.6 : 0.05, 0.05, alongX ? 0.05 : 0.6, x, y0 + y, z, I.wood);
  };
  const barrel = (x, y0, z, r = 0.8, len = 1.5, axisX = true) => {
    const b = cyl(r, r, len, x, y0, z, I.barrel, 10);
    const bandA = cyl(r * 1.04, r * 1.04, 0.1, x, y0, z, I.iron, 10);
    const bandB = cyl(r * 1.04, r * 1.04, 0.1, x, y0, z, I.iron, 10);
    // liegend: Achse entlang x bzw. z
    for (const m of [b, bandA, bandB]) {
      if (axisX) m.rotation.z = Math.PI / 2;
      else m.rotation.x = Math.PI / 2;
      m.position.y = y0 + r;
    }
    const off = len * 0.3;
    if (axisX) { bandA.position.x = x - off; bandB.position.x = x + off; } else { bandA.position.z = z - off; bandB.position.z = z + off; }
  };
  // Spitzbogen-Tonnengewölbe von innen (ohne Stirnkappen), Länge entlang z, Mitte bei x = 0, unten bei y0.
  const vaultShell = (width, spring, apex, len, y0) => {
    const v = new THREE.ExtrudeGeometry(archShape(width, spring, apex), { depth: len, bevelEnabled: false });
    v.translate(0, 0, -len / 2);
    const g1 = v.groups[1];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v.attributes.position.array.slice(g1.start * 3, (g1.start + g1.count) * 3), 3));
    geo.computeVertexNormals();
    return add(new THREE.Mesh(geo, I.plasterDark), 0, y0, 0);
  };
  // Stirnwand eines Gewölbes bei z, optional mit Durchgang (Spitzbogen) in der Mitte
  const endWall = (width, spring, apex, z, y0, hole, material) => {
    const sh = archShape(width, spring, apex);
    if (hole) {
      const p = new THREE.Path();
      p.moveTo(-hole.w / 2, 0.02);
      p.lineTo(-hole.w / 2, hole.spring);
      p.lineTo(0, hole.apex);
      p.lineTo(hole.w / 2, hole.spring);
      p.lineTo(hole.w / 2, 0.02);
      p.lineTo(-hole.w / 2, 0.02);
      sh.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false });
    return add(new THREE.Mesh(geo, material), 0, y0, z);
  };

  // ---------- Kemenate (Osten, 22 Grad gedreht): Frauengemach unten, Schlafgemach oben ----------
  {
    const FX = 18.5, FZ = 1.5, FR = -0.38;
    const W = (x, z) => wp(FX, FZ, FR, x, z);
    frame(FX, FZ, FR, () => {
      shell(6.6, 4.7, 10.6, 0, 0, 0, I.plaster, { noTop: true });
      box(6.6, 0.06, 10.6, 0, 0, 0, I.floorStone);
      box(4.2, 0.02, 6.0, -0.3, 0.06, 0.5, I.rug);
      box(4.9, 0.4, 10.6, -1.65, 4.7, 0, I.woodDark); // Zwischendecke mit Treppenöffnung an der Ostwand
      box(1.7, 0.4, 4.7, 2.45, 4.7, -2.95, I.woodDark);
      for (let z = -4; z <= 4; z += 2) box(6.6, 0.3, 0.35, 0, 4.4, z, I.wood);
      for (let i = 0; i < 14; i++) box(1.2, (i + 1) * 0.335, 0.4, 2.4, 0, 5.0 - i * 0.4, I.stone); // Treppe
      // Kamin an der Nordwand
      box(3.0, 3.2, 0.9, 0, 0, -4.85, I.stone);
      box(2.2, 1.5, 0.7, 0, 3.2, -4.95, I.stone);
      box(1.4, 0.9, 0.12, 0, 0.2, -4.35, I.fire);
      box(3.4, 0.15, 1.1, 0, 3.15, -4.8, I.woodDark);
      // Fenster zur Hofseite (Westwand)
      for (const z of [-3.6, 0, 3.6]) iwin(-3.28, 3.0, z, Math.PI / 2, 0.9, 2.2, I.moon);
      for (const z of [-1.5, 1.5]) iwin(z, 3.0, 5.28, Math.PI, 0.8, 2.0, I.moon);
      // Tisch, Stühle, Webstuhl, Truhe
      box(1.7, 0.08, 0.9, -0.3, 0.78, 0.8, I.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.78, 0.08, -0.3 + sx * 0.75, 0, 0.8 + sz * 0.35, I.woodDark);
      for (const x of [-1.2, 0.6]) { box(0.5, 0.06, 0.5, x, 0.5, 1.8, I.wood); box(0.5, 0.9, 0.06, x, 0.5, 2.05, I.woodDark); }
      candle(-0.3, 0.86, 0.8, 0.28);
      box(0.08, 2.0, 0.08, -2.7, 0, -3.3, I.woodDark); box(0.08, 2.0, 0.08, -2.7, 0, -2.3, I.woodDark);
      box(0.1, 0.1, 1.2, -2.7, 1.9, -2.8, I.woodDark); box(0.05, 1.5, 0.9, -2.7, 0.4, -2.8, I.paper);
      box(1.4, 0.6, 0.7, -2.4, 0, 4.4, I.woodDark);
      box(0.06, 2.6, 1.2, -3.26, 1.0, -1.9, I.red); // Wandteppich
      chandelier(-0.3, 4.6, 3.5, 0.8, 0.8);
      // Obergeschoss: Schlafgemach
      const y0 = 5.1;
      shell(6.6, 4.6, 10.6, 0, y0, 0, I.plasterDark, { noBottom: true });
      box(4.0, 0.02, 5.6, -0.4, y0, -0.2, I.rug);
      box(2.0, 0.45, 2.4, -1.5, y0, -3.7, I.wood); // Bett mit Himmel
      box(1.9, 0.3, 2.3, -1.5, y0 + 0.45, -3.7, I.paper);
      box(1.9, 0.12, 1.4, -1.5, y0 + 0.74, -3.3, I.red);
      box(0.8, 0.14, 0.4, -1.5, y0 + 0.74, -4.7, I.paper);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.06, 0.06, 2.5, -1.5 + sx * 1.0, y0, -3.7 + sz * 1.2, I.woodDark, 6);
      box(2.2, 0.08, 2.6, -1.5, y0 + 2.5, -3.7, I.red);
      box(1.3, 2.3, 0.6, 2.6, y0, -4.9, I.woodDark); // Schrank
      box(1.5, 0.6, 0.8, -2.6, y0, 1.6, I.woodDark); // Truhe
      box(1.4, 0.08, 0.8, -0.2, y0 + 0.75, 3.2, I.wood); candle(-0.2, y0 + 0.83, 3.2, 0.25);
      box(2.2, 3.0, 0.9, 0, y0, 4.85, I.stone); box(1.2, 1.4, 0.12, 0, y0 + 0.2, 4.35, I.fire); // Kamin Südwand
      for (const z of [-3.6, 0, 3.6]) iwin(-3.28, y0 + 2.4, z, Math.PI / 2, 0.9, 2.2, I.moon);
      chandelier(-0.3, y0 + 4.5, y0 + 3.4, 0.5, 0.8);
    });
    const [e1x, e1z] = W(-2.4, 4.4), [t1x, t1z] = W(0.4, -3.5);
    const [e2x, e2z] = W(-2.3, 4.4), [t2x, t2z] = W(0.2, -3.8);
    const [l1x, l1z] = W(0, 0), [l2x, l2z] = W(0, 1);
    rooms.push({ id: 'kemenate', label: 'Kemenate', eye: [e1x, 1.7, e1z], target: [t1x, 1.8, t1z], cutY: 4.9 });
    rooms.push({ id: 'schlafgemach', label: 'Schlafgemach', eye: [e2x, 5.1 + 1.7, e2z], target: [t2x, 7.0, t2z], cutY: 10 });
    lights.push({ room: 'kemenate', x: l1x, y: 3.2, z: l1z, color: 0xffc27a, intensity: 1.0, distance: 10 });
    lights.push({ room: 'schlafgemach', x: l2x, y: 8.4, z: l2z, color: 0xffc27a, intensity: 1.0, distance: 10 });
  }

  // ---------- Bergfried (Nordosten): Waffenkammer unten, Wachstube darüber, Leiter dazwischen ----------
  // Der Raum liegt in der Nordhälfte des Turms (z -15,3 bis -10,7), damit er nicht in den Rittersaal ragt.
  {
    const cx = 9, cz = -13;
    shell(6.6, 5.4, 4.6, cx, 0, cz, I.plaster, { noTop: true });
    box(6.6, 0.06, 4.6, cx, 0, cz, I.floorStone);
    box(5.4, 0.4, 4.6, cx + 0.6, 5.4, cz, I.woodDark); // Zwischendecke mit Leiterloch
    box(1.2, 0.4, 3.2, cx - 2.7, 5.4, cz + 0.7, I.woodDark);
    ladder(cx - 2.7, cz - 1.6, 0, 6.8, true);
    // Waffenkammer
    for (let i = 0; i < 8; i++) {
      cyl(0.03, 0.03, 2.5, cx + 2.95, 0.1, cz - 1.6 + i * 0.42, I.iron, 5);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 4), I.steel), cx + 2.95, 2.74, cz - 1.6 + i * 0.42);
    }
    box(0.3, 0.1, 3.8, cx + 2.9, 0.1, cz, I.woodDark); box(0.1, 0.1, 3.8, cx + 3.0, 1.6, cz, I.woodDark);
    [I.red, I.steel, I.gold, I.red].forEach((m, i) => {
      const sh = cyl(0.45, 0.45, 0.07, cx - 1.8 + i * 1.2, 2.4, cz + 2.25, m, 12);
      sh.rotation.x = Math.PI / 2;
    });
    for (const dx of [-1.8, 0, 1.8]) { // Rüstungsständer an der Nordwand
      box(0.14, 0.9, 0.14, cx + dx, 0, cz - 1.8, I.woodDark);
      box(0.55, 0.8, 0.3, cx + dx, 0.9, cz - 1.8, I.steel);
      ball(0.18, cx + dx, 1.95, cz - 1.8, I.steel);
      box(0.9, 0.12, 0.12, cx + dx, 1.55, cz - 1.8, I.steel);
    }
    box(1.8, 0.08, 1.0, cx, 0.85, cz + 0.5, I.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.85, 0.08, cx + sx * 0.8, 0, cz + 0.5 + sz * 0.4, I.woodDark);
    box(1.2, 0.5, 0.7, cx + 2.2, 0, cz + 1.6, I.woodDark);
    sconce(cx - 3.2, 2.0, cz + 0.5); sconce(cx + 3.2, 2.0, cz + 1.6);
    iwin(cx + 3.28, 2.6, cz - 0.6, -Math.PI / 2, 0.4, 1.4, I.moon);
    iwin(cx, 2.6, cz + 2.28, Math.PI, 0.4, 1.4, I.moon);
    // Wachstube
    const y0 = 5.8;
    shell(6.6, 5.6, 4.6, cx, y0, cz, I.plasterDark, { noBottom: true });
    box(1.0, 0.1, 2.0, cx + 2.6, y0 + 0.5, cz + 0.3, I.wood); box(1.0, 0.1, 2.0, cx + 2.6, y0 + 1.6, cz + 0.3, I.wood);
    box(0.9, 0.12, 1.8, cx + 2.6, y0 + 0.6, cz + 0.3, I.red); box(0.9, 0.12, 1.8, cx + 2.6, y0 + 1.7, cz + 0.3, I.sack);
    for (const sz of [-1, 1]) box(0.08, 2.0, 0.08, cx + 3.05, y0, cz + 0.3 + sz * 0.95, I.woodDark);
    box(1.8, 0.08, 1.0, cx - 0.4, y0 + 0.85, cz + 0.1, I.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.85, 0.08, cx - 0.4 + sx * 0.8, y0, cz + 0.1 + sz * 0.4, I.woodDark);
    for (const [x, z] of [[-1.5, 0.1], [0.7, 0.1], [-0.4, 1.3]]) box(0.4, 0.45, 0.4, cx + x, y0, cz + z, I.wood);
    candle(cx - 0.4, y0 + 0.93, cz + 0.1, 0.25);
    cyl(0.4, 0.28, 0.5, cx - 2.4, y0, cz + 1.5, I.iron, 8); box(0.5, 0.1, 0.5, cx - 2.4, y0 + 0.5, cz + 1.5, I.fire); // Kohlebecken
    barrel(cx - 2.5, y0, cz - 1.6, 0.5, 0.9, true);
    iwin(cx - 3.28, y0 + 2.6, cz + 0.5, Math.PI / 2, 0.4, 1.4, I.moon);
    iwin(cx, y0 + 2.6, cz - 2.28, 0, 0.4, 1.4, I.moon);
    iwin(cx + 3.28, y0 + 3.0, cz - 1.2, -Math.PI / 2, 0.4, 1.4, I.moon);
    chainLamp(cx - 0.4, y0 + 5.4, y0 + 3.6, cz + 0.1);
    lights.push({ room: 'waffenkammer', x: cx, y: 3.4, z: cz, color: 0xffb060, intensity: 0.9, distance: 9 });
    lights.push({ room: 'wachstube', x: cx - 0.4, y: y0 + 3.4, z: cz + 0.1, color: 0xffb060, intensity: 0.9, distance: 9 });
    rooms.push({ id: 'waffenkammer', label: 'Waffenkammer', eye: [cx - 2.6, 1.7, cz + 1.7], target: [cx + 1.5, 1.4, cz - 1.0], cutY: 5.2 });
    rooms.push({ id: 'wachstube', label: 'Wachstube', eye: [cx - 2.6, y0 + 1.7, cz + 1.7], target: [cx + 1.8, y0 + 1.0, cz - 1.0], cutY: 11.4 });
  }

  // ---------- Küche im Rückflügel: Herd, Tische, Vorräte; darüber Gästekammer ----------
  {
    const FX = -3, FZ = -18, FR = 0.45;
    const W = (x, z) => wp(FX, FZ, FR, x, z);
    frame(FX, FZ, FR, () => {
      shell(8.6, 4.7, 5.6, 0, 0, 0, I.plaster, { noTop: true });
      box(8.6, 0.06, 5.6, 0, 0, 0, I.floorStone);
      box(8.6, 0.4, 4.4, 0, 4.7, -0.6, I.woodDark); // Zwischendecke mit Treppenöffnung
      box(3.8, 0.4, 1.2, -2.4, 4.7, 2.2, I.woodDark);
      for (let x = -3.6; x <= 3.6; x += 1.8) box(0.3, 0.35, 5.6, x, 4.35, 0, I.wood);
      for (let i = 0; i < 12; i++) box(0.4, (i + 1) * 0.39, 1.0, -0.2 + i * 0.38, 0, 2.2, I.stone);
      // Herd und Rauchfang an der Westwand
      box(1.4, 1.1, 3.8, -3.6, 0, 0, I.stone);
      box(0.3, 0.8, 2.4, -2.85, 0.3, 0, I.fire);
      box(1.0, 3.6, 3.4, -3.8, 1.1, 0, I.stone);
      const kessel = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), I.iron), -2.5, 1.3, -0.4);
      kessel.rotation.x = Math.PI;
      cyl(0.03, 0.03, 1.5, -2.5, 1.5, -0.4, I.iron, 4);
      cyl(0.4, 0.4, 0.5, -2.7, 1.1, 1.2, I.iron, 10); // Topf auf dem Herd
      // Arbeitstische
      box(3.6, 0.1, 1.1, 0.6, 0.9, -0.9, I.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 0.9, 0.1, 0.6 + sx * 1.7, 0, -0.9 + sz * 0.45, I.woodDark);
      for (let i = 0; i < 4; i++) cyl(0.12, 0.1, 0.18, -0.4 + i * 0.7, 1.0, -0.9, I.iron, 8);
      box(1.2, 0.9, 0.8, 3.5, 0, -2.2, I.stone); // Steinbecken
      // Regale mit Töpfen an der Nordwand, Vorräte
      for (const y of [1.5, 2.4, 3.3]) {
        box(3.4, 0.06, 0.4, 0.8, y, -2.55, I.wood);
        for (let i = 0; i < 6; i++) cyl(0.11, 0.09, 0.22, -0.5 + i * 0.5, y + 0.06, -2.55, I.iron, 8);
      }
      for (let i = 0; i < 5; i++) {
        cyl(0.01, 0.01, 0.5, -2 + i * 1.0, 3.9, 1.0, I.iron, 3);
        cyl(0.12, 0.08, 0.5, -2 + i * 1.0, 3.4, 1.0, I.red, 6);
      }
      barrel(3.6, 0, 1.9, 0.5, 0.9, true);
      box(0.7, 0.5, 0.5, 3.6, 0, 0.6, I.sack); box(0.6, 0.4, 0.5, 3.0, 0, 0.2, I.sack);
      for (const x of [-3, 0, 3]) iwin(x, 3.2, -2.78, 0, 0.8, 1.9, I.moon);
      chainLamp(0.6, 4.5, 3.3, 0.6);
      // Gästekammer darüber
      const y0 = 5.1;
      shell(8.6, 3.6, 5.6, 0, y0, 0, I.plasterDark, { noBottom: true });
      for (const x of [-3.0, -0.8]) {
        box(1.1, 0.4, 2.1, x, y0, -1.7, I.wood); box(1.0, 0.25, 2.0, x, y0 + 0.4, -1.7, I.sack); box(1.0, 0.1, 1.2, x, y0 + 0.66, -1.4, I.red);
        box(0.5, 0.12, 0.35, x, y0 + 0.68, -2.5, I.paper);
      }
      box(1.4, 2.2, 0.6, 3.4, y0, -2.4, I.woodDark);
      box(1.1, 0.08, 0.8, 2.0, y0 + 0.75, -2.2, I.wood); candle(2.0, y0 + 0.83, -2.2, 0.25);
      box(1.2, 0.55, 0.7, -3.6, y0, 1.8, I.woodDark);
      for (const x of [-2, 1.5]) iwin(x, y0 + 2.0, -2.78, 0, 0.7, 1.6, I.moon);
      chainLamp(0, y0 + 3.5, y0 + 2.4, -0.4);
    });
    const [e1x, e1z] = W(3.4, -1.9), [t1x, t1z] = W(-2.4, 0.2);
    const [e2x, e2z] = W(3.4, -1.9), [t2x, t2z] = W(-2.5, -1.3);
    const [l1x, l1z] = W(0, 0);
    rooms.push({ id: 'kueche', label: 'Küche', eye: [e1x, 1.7, e1z], target: [t1x, 1.3, t1z], cutY: 4.9 });
    rooms.push({ id: 'gaestekammer', label: 'Gästekammer', eye: [e2x, 5.1 + 1.6, e2z], target: [t2x, 6.2, t2z], cutY: 8.9 });
    lights.push({ room: 'kueche', x: l1x, y: 3.2, z: l1z, color: 0xffb060, intensity: 1.1, distance: 10 });
    lights.push({ room: 'gaestekammer', x: l1x, y: 7.6, z: l1z, color: 0xffb060, intensity: 0.8, distance: 9 });
  }

  // ---------- Bogengänge: Flur hinter den Spitzbogenreihen der Hofmauer ----------
  function arcadeInterior(ax, az, bx, bz, h, t, id, label) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const rot = Math.atan2(-dz, dx);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const zi0 = -t / 2 + 0.9, zi1 = t / 2 - 0.7, wi = zi1 - zi0, zc = (zi0 + zi1) / 2;
    frame(cx, cz, rot, () => {
      box(len, 0.12, wi + 0.3, 0, 0, zc, I.floorStone);
      for (let x = -len / 2 + 1; x < len / 2; x += 2) box(0.05, 0.02, wi + 0.3, x, 0.12, zc, I.iron);
      box(len, 0.2, wi + 0.2, 0, h - 0.2, zc, I.woodDark);
      for (let x = -len / 2 + 0.7; x < len / 2; x += 1.4) box(0.25, 0.3, wi + 0.2, x, h - 0.5, zc, I.wood);
      box(len, 0.1, 0.5, 0, 0.45, zi1 - 0.3, I.wood); // Bank an der Rückwand
      for (let x = -len / 2 + 0.6; x < len / 2; x += 2.2) box(0.1, 0.45, 0.45, x, 0, zi1 - 0.3, I.woodDark);
      for (let x = -len / 2 + 1.8; x < len / 2 - 1; x += 3.3) {
        box(0.9, 2.2, 0.05, x, 2.2, zi1 - 0.02, I.red);
        box(0.1, 2.2, 0.06, x, 2.2, zi1 - 0.03, I.gold);
      }
      for (let x = -len / 2 + 2.2; x < len / 2 - 1; x += 3.3) chainLamp(x, h - 0.3, h - 1.5, zc - 0.2);
    });
    const P = (x, y, z) => { const [px, pz] = wp(cx, cz, rot, x, z); return [px, y, pz]; };
    rooms.push({ id, label, eye: P(-len / 2 + 0.8, 1.6, zc), target: P(len / 2, 2.2, zc), cutY: h + 0.6 });
    const l1 = P(-len / 6, h - 2.0, zc), l2 = P(len / 4, h - 2.0, zc);
    lights.push({ room: id, x: l1[0], y: l1[1], z: l1[2], color: 0xffb060, intensity: 0.8, distance: 9 });
    lights.push({ room: id, x: l2[0], y: l2[1], z: l2[2], color: 0xffb060, intensity: 0.8, distance: 9 });
  }
  arcadeInterior(-13.5, 21, -1.5, 18.6, 7, 3.2, 'bogengang', 'Bogengang West');
  arcadeInterior(17, 19.8, 24.3, 11.8, 6.5, 3, 'bogengang2', 'Bogengang Ost');

  // ---------- Keller: Weinkeller unter dem Rittersaal, Kellergang, Verlies ----------
  {
    const Y0 = -4.8;
    const KW = 3.4; // Breite des Kellergangs
    const hole = { w: KW, spring: 2.3, apex: 3.6 };
    // Weinkeller: Tonnengewölbe entlang x (Rahmen um 90 Grad gedreht: lokales z = Welt-x)
    frame(-4, -6, Math.PI / 2, () => {
      vaultShell(7.8, 2.6, 4.5, 22.8, Y0);
      add(new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(7.8, 2.6, 4.5), { depth: 0.1, bevelEnabled: false }), I.plasterFront), 0, Y0, -11.4);
      endWall(7.8, 2.6, 4.5, 11.3, Y0, hole, I.plasterBoth);
      box(7.8, 0.1, 22.8, 0, Y0 - 0.1, 0, I.floorStone);
      // Fässer an der linken Wand, zwei Lagen zum Westende hin
      for (let k = 0; k < 8; k++) barrel(-2.7, Y0, -1.5 + k * 1.75, 0.8, 1.5, true);
      for (let k = 0; k < 3; k++) barrel(-2.7, Y0 + 1.5, -1.0 + k * 1.75, 0.75, 1.4, true);
      // Weinregale an der rechten Wand mit Flaschen als Instanzen
      const bottles = [];
      for (const rz of [-0.2, 3.4, 7.0]) {
        box(0.5, 2.4, 3.0, 3.6, Y0, rz, I.wood);
        for (let r = 0; r < 6; r++) {
          box(0.52, 0.05, 3.0, 3.6, Y0 + 0.2 + r * 0.4, rz, I.woodDark);
          for (let z = rz - 1.4; z <= rz + 1.4; z += 0.14) bottles.push([3.55, Y0 + 0.4 + r * 0.4, z]);
        }
      }
      const bm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), I.glassBottle, bottles.length);
      const o = new THREE.Object3D();
      bottles.forEach((b, i) => {
        o.position.set(...b);
        o.rotation.set(0, 0, Math.PI / 2);
        o.updateMatrix();
        bm.setMatrixAt(i, o.matrix);
      });
      add(bm, 0, 0, 0);
      // Tisch mit Hockern und Kerzen
      box(2.6, 0.1, 1.0, 0.2, Y0 + 0.85, -6.8, I.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 0.85, 0.1, 0.2 + sx * 1.2, Y0, -6.8 + sz * 0.4, I.woodDark);
      for (const x of [-1.0, 1.4]) cyl(0.25, 0.22, 0.5, x, Y0, -5.7, I.wood, 8);
      candle(0.2, Y0 + 0.95, -6.8, 0.25);
      for (let i = 0; i < 14; i++) box(1.2, (i + 1) * 0.31, 0.4, 2.3, Y0, -5.0 - i * 0.4, I.stone); // Kellertreppe nach oben
      for (const z of [-7, 0, 7]) chainLamp(0, Y0 + 4.5, Y0 + 3.2, z);
    });
    // Kellergang entlang x unter den Hof, Länge 7 m (x 7,4 bis 14,4)
    frame(10.9, -6, Math.PI / 2, () => {
      vaultShell(KW, 2.3, 3.6, 7.0, Y0);
      box(KW, 0.1, 7.0, 0, Y0 - 0.1, 0, I.floorStone);
      for (const z of [-2.2, 1.2]) { sconce(-1.55, Y0 + 1.6, z); sconce(1.55, Y0 + 1.6, z + 1.0); }
      for (let z = -3; z <= 3; z += 1.5) box(KW - 0.2, 0.12, 0.14, 0, Y0 + 0.02, z, I.iron);
    });
    // Verlies: Gewölbe entlang x (x 14,4 bis 22,4), links zwei Zellen mit Gitter, rechts Folterbank
    frame(18.4, -6, Math.PI / 2, () => {
      vaultShell(6.4, 2.6, 4.4, 8.0, Y0);
      endWall(6.4, 2.6, 4.4, -4.0, Y0, hole, I.plasterBoth);
      endWall(6.4, 2.6, 4.4, 3.9, Y0, null, I.plasterFront);
      box(6.4, 0.1, 8.0, 0, Y0 - 0.1, 0, I.floorStone);
      for (const [z0, z1] of [[-3.6, -0.1], [0.1, 3.6]]) {
        for (let z = z0; z <= z1 + 0.01; z += 0.2) cyl(0.03, 0.03, 2.9, -0.9, Y0, z, I.iron, 5);
        for (const y of [0.3, 1.5, 2.8]) box(0.06, 0.06, z1 - z0, -0.9, Y0 + y, (z0 + z1) / 2, I.iron);
        box(2.0, 0.08, (z1 - z0) - 0.4, -2.1, Y0, (z0 + z1) / 2, I.straw);
        box(0.9, 0.4, 0.5, -2.8, Y0, (z0 + z1) / 2 - 0.9, I.stone);
      }
      box(2.1, 2.9, 0.2, -2.0, Y0, 0, I.stone); // Trennwand der Zellen
      for (const z of [-2.2, 2.2]) { box(0.05, 0.5, 0.4, -3.14, Y0 + 1.9, z, I.iron); box(0.05, 0.3, 0.05, -3.14, Y0 + 1.0, z, I.iron); }
      // rechte Seite: Streckbank, Kohlebecken, Werkzeugbrett, Knochen
      box(0.9, 0.2, 2.4, 2.2, Y0 + 0.5, -1.2, I.woodDark);
      for (const sz of [-1, 1]) box(0.14, 0.5, 0.14, 2.2, Y0, -1.2 + sz * 1.0, I.woodDark);
      cyl(0.35, 0.25, 0.5, 2.4, Y0, 1.8, I.iron, 8); box(0.45, 0.1, 0.45, 2.4, Y0 + 0.5, 1.8, I.fire);
      box(1.4, 0.08, 0.3, 2.9, Y0 + 1.5, -3.5, I.wood);
      for (let i = 0; i < 6; i++) box(0.08, 0.35, 0.05, 2.3 + i * 0.2, Y0 + 1.2, -3.55, I.steel);
      for (let i = 0; i < 7; i++) box(0.3, 0.07, 0.1, 1.2 + (i % 3) * 0.3, Y0 + 0.04 + (i % 2) * 0.07, 1.9 + (i % 4) * 0.2, I.paper);
      sconce(2.9, Y0 + 1.7, -2.0); sconce(-2.9, Y0 + 1.7, 3.2);
    });
    const P1 = (fx, fz, fr, x, y, z) => { const [px, pz] = wp(fx, fz, fr, x, z); return [px, y, pz]; };
    const wk = (x, y, z) => P1(-4, -6, Math.PI / 2, x, y, z);
    const kg = (x, y, z) => P1(10.9, -6, Math.PI / 2, x, y, z);
    const vl = (x, y, z) => P1(18.4, -6, Math.PI / 2, x, y, z);
    rooms.push({ id: 'weinkeller', label: 'Weinkeller', eye: wk(-0.9, Y0 + 1.7, -10.4), target: wk(0.4, Y0 + 1.9, 6), cutY: -0.15 });
    rooms.push({ id: 'kellergang', label: 'Kellergang', eye: kg(0, Y0 + 1.7, -3.2), target: kg(0, Y0 + 1.6, 3.4), cutY: -0.15 });
    rooms.push({ id: 'verlies', label: 'Verlies', eye: vl(0.3, Y0 + 1.7, -3.4), target: vl(-0.5, Y0 + 1.3, 3.5), cutY: -0.15 });
    for (const [x, z] of [[-3, -6], [4, -6]]) lights.push({ room: 'weinkeller', x: wk(0, 0, 0)[0] + x * 1.4, y: Y0 + 3.0, z: -6, color: 0xffa860, intensity: 1.0, distance: 11 });
    { const p = kg(0, Y0 + 2.6, 0); lights.push({ room: 'kellergang', x: p[0], y: p[1], z: p[2], color: 0xff9a50, intensity: 0.9, distance: 8 }); }
    { const p = vl(0, Y0 + 2.6, 0); lights.push({ room: 'verlies', x: p[0], y: p[1], z: p[2], color: 0xff8a40, intensity: 1.0, distance: 9 }); }
  }

  // Gruppen für die Raumauswahl im Betrachter
  const groupOf = {
    saal: 'Palas', bibliothek: 'Palas', treppe: 'Türme', turmzimmer: 'Türme', waffenkammer: 'Türme',
    wachstube: 'Türme', kapelle: 'Kapelle', kemenate: 'Flügel', schlafgemach: 'Flügel', kueche: 'Flügel',
    gaestekammer: 'Flügel', bogengang: 'Gänge', bogengang2: 'Gänge', weinkeller: 'Keller', kellergang: 'Keller', verlies: 'Keller',
  };
  rooms.forEach((r) => { r.group = groupOf[r.id] || 'Sonstige'; });

  const windowStats = kit.finish();

  group.userData = {
    kind: 'castleInterior',
    rooms,
    lights,
    windows: windowStats,
  };
  return group;
}
