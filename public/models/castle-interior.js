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
//   rooms:  [{ id, label, eye: [x, y, z], target: [x, y, z], cutY }] für Kamerastandorte, cutY ist eine
//           Schnitthöhe, bei der der Raum von oben offen liegt
//   lights: [{ room, x, y, z, color, intensity, distance }] Lichtvorschläge je Raum, damit der Aufrufer
//           nur die Lichter des gerade betrachteten Raums einschalten kann
// Hinweis: Die Außenwände von castle.js haben noch keine Türen. Für ein begehbares Innere müssen dort
// Öffnungen geschnitten werden, die Innenräume bringen noch keine Kollision mit.

export function buildCastleInterior(THREE, options = {}) {
  const opt = { ...PALETTE, ...options };
  const group = new THREE.Group();
  group.name = 'castleInterior';
  const kit = createKit(THREE, group, opt);
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
  function iwin(x, y, z, ry, w, h, material) {
    const m = new THREE.Mesh(winGeo, material);
    m.scale.set(w, h, 1);
    add(m, x, y, z);
    m.rotation.y = ry;
    return m;
  }

  // Hülle eines Raums: nur von innen sichtbar. Ohne Boden oder Decke, wenn dort ein Durchgang bleibt.
  function shell(w, h, d, x, y0, z, material, { noTop = false, noBottom = false } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const drop = [];
    if (noTop) drop.push(2); // Gruppen der BoxGeometry: px, nx, py, ny, pz, nz
    if (noBottom) drop.push(3);
    if (drop.length) {
      const index = Array.from(geo.index.array);
      const keep = [];
      geo.groups.forEach((g, gi) => {
        if (!drop.includes(gi)) for (let i = g.start; i < g.start + g.count; i++) keep.push(index[i]);
      });
      geo.setIndex(keep);
      geo.clearGroups();
    }
    return add(new THREE.Mesh(geo, material), x, y0 + h / 2, z);
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
    const wall1 = new THREE.CylinderGeometry(3.45, 3.7, 35.2, 8, 1, true);
    wall1.rotateY(rot);
    add(new THREE.Mesh(wall1, I.plasterDark), cx, 17.6, cz);
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
    const wall2 = new THREE.CylinderGeometry(2.9, 2.9, 14, 8, 1, true);
    wall2.rotateY(rot);
    add(new THREE.Mesh(wall2, I.plaster), cx, 35.2 + 7, cz);
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
  // Kapelle: Spitzbogengewölbe, Apsis mit fünf bunten Fenstern, Kirchenbänke, Altar
  // ======================================================================================
  {
    const FX = -17.5;
    const FZ = 10;
    const FR = 0.3;
    const W = (x, z) => [FX + x * Math.cos(FR) + z * Math.sin(FR), FZ - x * Math.sin(FR) + z * Math.cos(FR)];
    frame(FX, FZ, FR, () => {
      // Langhaus: Spitzbogenprisma von innen, 6,6 x 13,2 m, Scheitel bei 9,5 m
      const vault = new THREE.ExtrudeGeometry(archShape(6.6, 6.2, 9.5), { depth: 13.2, bevelEnabled: false });
      vault.translate(0, 0, -6.6);
      // Stirnkappen (Gruppe 0) weglassen: Zur Apsis bleibt es offen, die Eingangswand kommt separat.
      const g1 = vault.groups[1]; // ExtrudeGeometry ist nicht indiziert: Positionen der Seitenflächen kopieren
      const sideGeo = new THREE.BufferGeometry();
      sideGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(vault.attributes.position.array.slice(g1.start * 3, (g1.start + g1.count) * 3), 3),
      );
      sideGeo.computeVertexNormals();
      add(new THREE.Mesh(sideGeo, I.plasterDark), 0, 0, 0);
      const endWall = new THREE.ExtrudeGeometry(archShape(6.6, 6.2, 9.5), { depth: 0.05, bevelEnabled: false });
      add(new THREE.Mesh(endWall, I.plasterFront), 0, 0, -6.6);
      box(6.6, 0.08, 13.2, 0, 0, 0, I.floorStone);
      box(1.7, 0.02, 11.5, 0, 0.08, -0.6, I.rug);
      // Apsis: Halbzylinder und Halbkegel nach +z
      const apseWall = new THREE.CylinderGeometry(3.3, 3.3, 6.2, 12, 1, true, -Math.PI / 2, Math.PI);
      add(new THREE.Mesh(apseWall, I.plasterDark), 0, 3.1, 6.6);
      const apseCone = new THREE.ConeGeometry(3.3, 3.3, 12, 1, true, -Math.PI / 2, Math.PI);
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

      // Fünf farbige Apsisfenster auf einem Halbkreis, zur Mitte gerichtet
      for (let k = 0; k < 5; k++) {
        const t = (-60 + k * 30) * (Math.PI / 180);
        iwin(Math.sin(t) * 3.25, 3.6, 6.6 + Math.cos(t) * 3.25, t + Math.PI, 0.95, 3.4, I.glass[k % I.glass.length]);
      }
      // Seitenfenster und Wandpfeiler des Langhauses
      for (const z of [-4.05, -1.35, 1.35, 4.05]) {
        iwin(-3.28, 4.2, z, Math.PI / 2, 1.0, 3.7, I.glass[Math.floor(rnd() * 5)]);
        iwin(3.28, 4.2, z, -Math.PI / 2, 1.0, 3.7, I.glass[Math.floor(rnd() * 5)]);
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

  group.userData = {
    kind: 'castleInterior',
    rooms,
    lights,
  };
  return group;
}
