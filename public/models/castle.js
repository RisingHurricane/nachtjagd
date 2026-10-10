'use strict';

// Burg im neugotischen Stil (um 1880 bis 1920), grobe Fassung aus Quadern, Zylindern, Kegeln,
// Pyramiden und Prismen. Sie ersetzt später die Schlossboxen in world.js.
//
// Vertrag (damit eine detaillierte Fassung sie 1:1 ablösen kann):
//   buildCastle(THREE, options) gibt eine THREE.Group zurück.
//   - THREE wird übergeben, damit dieselbe Datei mit Three.js r128 (Live-Frontend) und 0.170 läuft.
//   - Maßstab 1 Einheit = 1 Meter. Ursprung = Mitte der Burg auf Bodenhöhe (y = 0).
//   - Das Tor liegt an der +z-Seite (Süden), der Bergfried steht an der -z-Seite (Norden).
//   - Außenmaß der Mauern 40 x 40 m (Mitte der Mauern bei ±20), Tor 6 m breit.
//   - group.userData.colliders: Liste der festen Körper in lokalen Koordinaten, damit das Layout
//     die Kollision aus dem Modell übernehmen kann:
//       { type: 'box', x, z, w, d, h } oder { type: 'circle', x, z, r, h }
//   - Fenster sind eine InstancedMesh mit dem Namen 'windows' und leuchtendem Material (Name 'windowGlow').
//   - Platzieren: group.position.set(x, bodenhoehe, z); group.rotation.y = drehung.

const DEFAULTS = {
  windowColor: 0xe0a050, // warmes Licht aus der Palette in DESIGN.md
  stone: 0x596b74,
  stoneDark: 0x4e4e4b,
  stoneLight: 0x7e868c,
  roofSlate: 0x2f3d4a,
  roofCopper: 0x6e4637,
  snow: 0xdfe6ec,
};

export function buildCastle(THREE, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const group = new THREE.Group();
  group.name = 'castle';
  const colliders = [];

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true, ...extra });
  const M = {
    stone: mat(opt.stone),
    stoneDark: mat(opt.stoneDark),
    stoneLight: mat(opt.stoneLight),
    slate: mat(opt.roofSlate, { roughness: 0.85 }),
    copper: mat(opt.roofCopper, { roughness: 0.85 }),
    snow: mat(opt.snow, { roughness: 1 }),
    dark: mat(0x0b1116),
    glow: new THREE.MeshStandardMaterial({
      name: 'windowGlow',
      color: opt.windowColor,
      emissive: opt.windowColor,
      emissiveIntensity: 1.1,
      roughness: 1,
    }),
  };

  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }

  // Quader, Unterkante bei y0.
  function box(w, h, d, x, y0, z, material) {
    return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y0 + h / 2, z);
  }

  // Runder Turm mit Kegeldach. roofMat bestimmt die Dachfarbe.
  function roundTower(x, z, r, h, roofH, roofMat, stoneMat, y0 = 0) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), stoneMat), x, y0 + h / 2, z);
    // Auskragung unter dem Dach (wie die Zinnenkränze der Vorlagen)
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.0, 1.1, 12), M.stoneDark), x, y0 + h + 0.55, z);
    add(new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, roofH, 12), roofMat), x, y0 + h + 1.1 + roofH / 2, z);
    // Turmspitze
    add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.8, 6), M.dark), x, y0 + h + 1.1 + roofH + 0.7, z);
  }

  // Vierseitige Pyramide über einem quadratischen Grundriss mit Seitenlänge s.
  function pyramid(s, h, x, y0, z, material) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(s * Math.SQRT1_2, h, 4), material);
    m.rotation.y = Math.PI / 4;
    return add(m, x, y0 + h / 2, z);
  }

  // Satteldach (dreieckiges Prisma). ridgeAlongX: Firstrichtung entlang x, sonst entlang z.
  function gable(w, d, rise, overhang, x, y0, z, ridgeAlongX, material) {
    const span = (ridgeAlongX ? d : w) + overhang * 2;
    const length = (ridgeAlongX ? w : d) + overhang * 2;
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2, 0);
    shape.lineTo(span / 2, 0);
    shape.lineTo(0, rise);
    shape.lineTo(-span / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geo.translate(0, 0, -length / 2);
    const m = new THREE.Mesh(geo, material);
    if (ridgeAlongX) {
      m.rotation.y = Math.PI / 2;
    }
    return add(m, x, y0, z);
  }

  // Dachgaube: kleiner Kasten mit Giebel, schaut in Richtung dir ('+z' oder '-z').
  function dormer(x, y0, z, dir, windows) {
    const s = dir === '+z' ? 1 : -1;
    box(1.8, 1.8, 1.8, x, y0, z, M.stone);
    gable(1.8, 1.8, 1.4, 0.15, x, y0 + 1.8, z, false, M.slate);
    windows.push({ x, y: y0 + 0.9, z: z + s * 0.92, face: dir, w: 0.7, h: 1.0 });
  }

  const windows = []; // { x, y, z, face, w, h }

  // Fensterreihen an einer Wandfläche. face: '+z' '-z' '+x' '-x', Mitte (cx, cz) der Fläche.
  function windowRow(cx, cz, face, count, spacing, y, w = 0.8, h = 1.7, offset = 0.05) {
    const start = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const t = start + i * spacing;
      if (face === '+z') windows.push({ x: cx + t, y, z: cz + offset, face, w, h });
      else if (face === '-z') windows.push({ x: cx + t, y, z: cz - offset, face, w, h });
      else if (face === '+x') windows.push({ x: cx + offset, y, z: cz + t, face, w, h });
      else windows.push({ x: cx - offset, y, z: cz + t, face, w, h });
    }
  }

  // ---------- Sockel ----------
  box(44, 1.2, 44, 0, -1.2, 0, M.stoneDark);

  // ---------- Ringmauer (Mauern bei ±20, 2 m dick, 8 m hoch) ----------
  const WALL_H = 8;
  box(42, WALL_H, 2, 0, 0, -20, M.stone); // Nord
  box(2, WALL_H, 40, -20, 0, 0, M.stone); // West
  box(2, WALL_H, 40, 20, 0, 0, M.stone); // Ost
  box(15, WALL_H, 2, -12.5, 0, 20, M.stone); // Süd links vom Tor
  box(15, WALL_H, 2, 12.5, 0, 20, M.stone); // Süd rechts vom Tor
  colliders.push(
    { type: 'box', x: 0, z: -20, w: 42, d: 2, h: WALL_H },
    { type: 'box', x: -20, z: 0, w: 2, d: 40, h: WALL_H },
    { type: 'box', x: 20, z: 0, w: 2, d: 40, h: WALL_H },
    { type: 'box', x: -12.5, z: 20, w: 15, d: 2, h: WALL_H },
    { type: 'box', x: 12.5, z: 20, w: 15, d: 2, h: WALL_H },
  );

  // Zinnen (Zähne) oben auf den Mauern, als InstancedMesh.
  const merlonSpots = [];
  const addMerlons = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      merlonSpots.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  };
  addMerlons(-21, -20, 21, -20);
  addMerlons(-21, 20, -9, 20);
  addMerlons(9, 20, 21, 20);
  addMerlons(-20, -17, -20, 17);
  addMerlons(20, -17, 20, 17);
  const merlons = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), M.stoneLight, merlonSpots.length);
  const tmp = new THREE.Object3D();
  merlonSpots.forEach(([x, z], i) => {
    tmp.position.set(x, WALL_H + 0.65, z);
    tmp.updateMatrix();
    merlons.setMatrixAt(i, tmp.matrix);
  });
  merlons.name = 'merlons';
  group.add(merlons);

  // ---------- Eckturmpaare (Rundtürme an den vier Ecken) ----------
  const corners = [
    [-20, -20, M.slate],
    [20, -20, M.copper],
    [-20, 20, M.copper],
    [20, 20, M.slate],
  ];
  for (const [x, z, roof] of corners) {
    roundTower(x, z, 3.5, 14, 10, roof, M.stone);
    colliders.push({ type: 'circle', x, z, r: 3.5, h: 14 });
    windowRow(x, z + (z > 0 ? 3.6 : -3.6), z > 0 ? '+z' : '-z', 1, 1, 9, 0.7, 1.5);
  }

  // ---------- Torhaus an der Südmauer ----------
  const gateZ = 20;
  box(3, 11, 6, -4.5, 0, gateZ, M.stone);
  box(3, 11, 6, 4.5, 0, gateZ, M.stone);
  box(12, 4, 6, 0, 7, gateZ, M.stone); // Sturz über dem Tor
  box(6, 7, 0.3, 0, 0, gateZ - 2.7, M.dark); // dunkle Rückwand im Torbogen
  colliders.push(
    { type: 'box', x: -4.5, z: gateZ, w: 3, d: 6, h: 11 },
    { type: 'box', x: 4.5, z: gateZ, w: 3, d: 6, h: 11 },
  );
  // Der Sturz liegt über 7 m und ist für Spieler kein Hindernis, das Tor bleibt frei.
  gable(12, 6, 9, 0.5, 0, 11, gateZ, false, M.slate); // Satteldach, Giebel zur Vorderseite
  windowRow(0, gateZ + 3.05, '+z', 2, 3, 9, 0.7, 1.3);
  // Zwei Spitztürmchen an den vorderen Ecken des Torhauses
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 8), M.slate), sx * 6.2, 11 + 2.5, gateZ + 2.6);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 11, 8), M.stone), sx * 6.2, 5.5, gateZ + 2.6);
  }

  // ---------- Bergfried (Hauptturm) im Norden ----------
  const keepZ = -12;
  box(10, 16, 10, 0, 0, keepZ, M.stone);
  colliders.push({ type: 'box', x: 0, z: keepZ, w: 10, d: 10, h: 16 });
  // Auskragender Zinnenkranz oben (Neugotik), breiter als der Schaft
  box(12, 2.4, 12, 0, 16, keepZ, M.stoneDark);
  // Vier Eckerker mit Spitzdach auf dem Kranz
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ex = sx * 5.2;
      const ez = keepZ + sz * 5.2;
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 8), M.stone), ex, 18.4 + 1.7, ez);
      add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.2, 8), M.slate), ex, 18.4 + 3.4 + 2.1, ez);
    }
  }
  // Steile Pyramide als Hauptdach mit Nadelspitze
  pyramid(8.6, 13, 0, 18.4, keepZ, M.copper);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 7, 6), M.dark), 0, 18.4 + 13 + 3, keepZ);
  // Fenster in drei Geschossen an Süd- und Ostseite
  windowRow(0, keepZ + 5, '+z', 2, 3, 6, 0.8, 1.8);
  windowRow(0, keepZ + 5, '+z', 3, 2.6, 11.5, 0.8, 1.8);
  windowRow(5, keepZ, '+x', 2, 3, 11.5, 0.8, 1.8);
  windowRow(-5, keepZ, '-x', 2, 3, 11.5, 0.8, 1.8);
  windowRow(0, keepZ + 6, '+z', 1, 1, 17.2, 0.9, 1.1); // Fenster im Kranz

  // ---------- Palas (Wohnbau), Nordflügel links und rechts des Bergfrieds ----------
  const wingY = 0;
  for (const sx of [-1, 1]) {
    const x = sx * 11.5;
    box(12, 11, 7, x, wingY, -15.5, M.stoneLight);
    colliders.push({ type: 'box', x, z: -15.5, w: 12, d: 7, h: 11 });
    gable(12, 7, 7.5, 0.7, x, 11, -15.5, true, M.slate);
    windowRow(x, -12, '+z', 4, 2.7, 3.6, 0.8, 1.7);
    windowRow(x, -12, '+z', 4, 2.7, 8, 0.8, 1.7);
    dormer(x - 2.7, 11 + 1.6, -13.6, '+z', windows);
    dormer(x + 2.7, 11 + 1.6, -13.6, '+z', windows);
  }

  // ---------- Ostflügel entlang der Ostmauer mit steilem Dach ----------
  box(7, 9, 18, 15.3, 0, 0, M.stoneLight);
  colliders.push({ type: 'box', x: 15.3, z: 0, w: 7, d: 18, h: 9 });
  gable(7, 18, 8, 0.6, 15.3, 9, 0, false, M.slate);
  windowRow(11.8, 0, '-x', 4, 4, 3.4, 0.8, 1.7);
  windowRow(11.8, 0, '-x', 4, 4, 6.9, 0.8, 1.7);
  dormer(11.9, 9 + 1.5, -5, '+z', windows);
  dormer(11.9, 9 + 1.5, 5, '+z', windows);

  // ---------- Westflügel mit Kapelle: kürzer, höher, mit schlankem Spitzturm ----------
  box(7, 12, 12, -15.3, 0, -2, M.stone);
  colliders.push({ type: 'box', x: -15.3, z: -2, w: 7, d: 12, h: 12 });
  gable(7, 12, 11, 0.6, -15.3, 12, -2, false, M.copper);
  windowRow(-11.8, -2, '+x', 3, 3.6, 5, 1.0, 3.2); // hohe Spitzbogenfenster (grob als Hochkant-Fenster)
  roundTower(-13.5, 8, 1.9, 22, 10, M.slate, M.stoneLight);
  colliders.push({ type: 'circle', x: -13.5, z: 8, r: 1.9, h: 22 });

  // ---------- Fenster als InstancedMesh ----------
  const winGeo = new THREE.BoxGeometry(1, 1, 0.18);
  const win = new THREE.InstancedMesh(winGeo, M.glow, windows.length);
  windows.forEach((w, i) => {
    tmp.position.set(w.x, w.y, w.z);
    tmp.rotation.set(0, w.face === '+x' ? Math.PI / 2 : w.face === '-x' ? -Math.PI / 2 : w.face === '-z' ? Math.PI : 0, 0);
    tmp.scale.set(w.w, w.h, 1);
    tmp.updateMatrix();
    win.setMatrixAt(i, tmp.matrix);
  });
  tmp.rotation.set(0, 0, 0);
  tmp.scale.set(1, 1, 1);
  win.name = 'windows';
  group.add(win);

  group.userData = {
    kind: 'castle',
    footprint: { w: 44, d: 44 },
    height: 40,
    gate: { x: 0, z: gateZ, w: 6, facing: '+z' },
    colliders,
  };
  return group;
}
