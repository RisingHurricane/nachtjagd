'use strict';

// Burg im neugotischen Stil (um 1880 bis 1920), grobe Fassung aus Quadern, Zylindern, Kegeln,
// Pyramiden und Prismen. Sie ersetzt später die Schlossboxen in world.js.
//
// Vertrag (damit eine detaillierte Fassung sie 1:1 ablösen kann):
//   buildCastle(THREE, options) gibt eine THREE.Group zurück.
//   - THREE wird übergeben, damit dieselbe Datei mit Three.js r128 (Live-Frontend) und 0.170 läuft.
//   - Maßstab 1 Einheit = 1 Meter. Ursprung = Mitte der Burg auf Bodenhöhe (y = 0).
//   - Das Tor liegt an der +z-Seite (Süden) bei x = 4, der Bergfried (Eckturm mit Pyramidendach)
//     steht im Nordosten. Der Grundriss ist bewusst unsymmetrisch (Gipfelburg wie Neuschwanstein,
//     Wernigerode): Palas im Norden, Kapelle im Westen, Kemenate im Osten, niedrige Mauern ohne Zinnen.
//   - Außenmaß etwa 46 x 40 m, Tor 6 m breit.
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

  // ---------- Felssockel (unregelmäßig, ragt teils aus dem Boden) ----------
  box(46, 1.2, 40, 0.5, -1.2, 3, M.stoneDark);
  box(14, 0.7, 5, -10, 0, 21.5, M.stoneDark);
  box(10, 0.5, 8, 16, 0, -20, M.stoneDark);
  box(5, 0.9, 12, -23.5, 0, 0, M.stoneDark);
  box(4, 0.6, 12, 24.5, 0, 12, M.stoneDark);

  // ---------- Palas (Haupthaus) im Norden: langer Bau mit steilem Dach und Zwerchgiebeln ----------
  box(24, 13, 9, -4, 0, -6, M.stone);
  colliders.push({ type: 'box', x: -4, z: -6, w: 24, d: 9, h: 13 });
  gable(24, 9, 11, 0.5, -4, 13, -6, true, M.slate);
  // Zwerchgiebel zur Hofseite, unterschiedlich hoch
  box(6, 15, 3, -10, 0, 0, M.stoneLight);
  gable(6, 3, 9, 0.3, -10, 15, 0, false, M.slate);
  box(6, 13, 3, 3, 0, 0, M.stoneLight);
  gable(6, 3, 7, 0.3, 3, 13, 0, false, M.copper);
  colliders.push({ type: 'box', x: -10, z: 0, w: 6, d: 3, h: 15 }, { type: 'box', x: 3, z: 0, w: 6, d: 3, h: 13 });
  windowRow(-10, 1.55, '+z', 2, 2.4, 4, 0.8, 1.8);
  windowRow(-10, 1.55, '+z', 2, 2.4, 9, 0.8, 1.8);
  windowRow(-10, 1.55, '+z', 1, 1, 13.4, 0.9, 1.6);
  windowRow(3, 1.55, '+z', 2, 2.4, 4, 0.8, 1.8);
  windowRow(3, 1.55, '+z', 2, 2.4, 9, 0.8, 1.8);
  windowRow(-3.5, -1.45, '+z', 3, 2.2, 4, 0.8, 1.8);
  windowRow(-3.5, -1.45, '+z', 3, 2.2, 9, 0.8, 1.8);
  windowRow(-3, -10.55, '-z', 5, 3.6, 4, 0.8, 1.8);
  windowRow(-3, -10.55, '-z', 5, 3.6, 9, 0.8, 1.8);
  for (const x of [-5.2, -1.8]) dormer(x, 15, -2.9, '+z', windows);
  for (const x of [-12, -6, 0]) dormer(x, 15, -9.1, '-z', windows);
  box(1.3, 4, 1.3, -8, 21.5, -6, M.stoneDark);
  box(1.3, 4, 1.3, 5.5, 21.5, -6.4, M.stoneDark);
  // Erkerturm am Ostende der Hofseite, auf einem umgekehrten Kegel
  const corbel = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 8), M.stoneDark);
  corbel.rotation.x = Math.PI;
  add(corbel, 8.2, 4.4, -1.4);
  roundTower(8.2, -1.4, 1.7, 9, 6.5, M.copper, M.stoneLight, 6);

  // ---------- Hoher Rundturm am Westende (Neuschwanstein-Art) ----------
  roundTower(-17, -8, 4, 26, 15, M.slate, M.stoneLight);
  colliders.push({ type: 'circle', x: -17, z: -8, r: 4, h: 26 });
  windowRow(-17, -3.95, '+z', 1, 1, 9, 0.8, 1.8);
  windowRow(-17, -3.95, '+z', 1, 1, 16, 0.8, 1.8);
  windowRow(-17, -3.95, '+z', 1, 1, 22, 0.8, 1.8);
  // schlanker Begleitturm, weiter hinten und niedriger
  roundTower(-11.5, -13, 1.8, 17, 9, M.copper, M.stone);
  colliders.push({ type: 'circle', x: -11.5, z: -13, r: 1.8, h: 17 });

  // ---------- Bergfried im Nordosten: quadratisch, Kragen, Eckerker, steile Pyramide ----------
  box(8, 22, 8, 9, 0, -12, M.stone);
  colliders.push({ type: 'box', x: 9, z: -12, w: 8, d: 8, h: 22 });
  box(9.4, 1.6, 9.4, 9, 22, -12, M.stoneDark);
  pyramid(8.6, 14, 9, 23.6, -12, M.copper);
  for (const [dx, dz] of [[-4.1, -4.1], [4.1, -4.1], [-4.1, 4.1], [4.1, 4.1]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 8), M.stoneLight), 9 + dx, 23.6 + 1.75, -12 + dz);
    add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), M.slate), 9 + dx, 23.6 + 3.5 + 2, -12 + dz);
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 3.5, 6), M.dark), 9, 23.6 + 14 + 1.5, -12);
  windowRow(13.05, -12, '+x', 2, 3, 8, 0.8, 1.8);
  windowRow(13.05, -12, '+x', 2, 3, 15, 0.8, 1.8);
  windowRow(9, -16.05, '-z', 2, 3, 8, 0.8, 1.8);
  windowRow(9, -16.05, '-z', 2, 3, 15, 0.8, 1.8);
  windowRow(9, -16.05, '-z', 1, 1, 20, 0.7, 1.6);

  // ---------- Kemenate im Osten (kürzer, mit eigenem Dach und Ecktürmchen) ----------
  box(8, 10, 12, 17.5, 0, 1, M.stoneLight);
  colliders.push({ type: 'box', x: 17.5, z: 1, w: 8, d: 12, h: 10 });
  gable(8, 12, 8, 0.6, 17.5, 10, 1, false, M.slate);
  windowRow(13.45, 1, '-x', 3, 3.6, 3.6, 0.8, 1.8);
  windowRow(13.45, 1, '-x', 3, 3.6, 7.2, 0.8, 1.8);
  windowRow(17.5, 7.05, '+z', 2, 3, 4, 0.8, 1.8);
  windowRow(17.5, 7.05, '+z', 2, 3, 7.5, 0.8, 1.8);
  roundTower(21.5, 7.5, 1.6, 12, 8, M.copper, M.stone);
  colliders.push({ type: 'circle', x: 21.5, z: 7.5, r: 1.6, h: 12 });

  // ---------- Kapelle im Westen mit Apsis und schlankem Spitzturm ----------
  box(8, 10, 14, -17, 0, 10, M.stone);
  colliders.push({ type: 'box', x: -17, z: 10, w: 8, d: 14, h: 10 });
  gable(8, 14, 9, 0.6, -17, 10, 10, false, M.copper);
  windowRow(-12.95, 10, '+x', 3, 3.6, 5, 1.0, 3.2);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.9, 10, 10), M.stone), -17, 5, 17);
  add(new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 10), M.copper), -17, 10 + 4, 17);
  colliders.push({ type: 'circle', x: -17, z: 17, r: 3.8, h: 10 });
  roundTower(-12.2, 4.5, 1.5, 19, 10, M.slate, M.stoneLight);
  colliders.push({ type: 'circle', x: -12.2, z: 4.5, r: 1.5, h: 19 });

  // ---------- Torhaus (rechts der Mitte) mit Rundturm ----------
  const gateX = 4;
  const gateZ = 19;
  box(2.5, 10, 5, gateX - 4.25, 0, gateZ, M.stone);
  box(2.5, 10, 5, gateX + 4.25, 0, gateZ, M.stone);
  box(11, 3.5, 5, gateX, 6.5, gateZ, M.stone); // Sturz, liegt über 6,5 m und blockiert Spieler nicht
  box(6, 6.5, 0.3, gateX, 0, gateZ - 2.2, M.dark); // dunkle Rückwand im Torbogen
  colliders.push(
    { type: 'box', x: gateX - 4.25, z: gateZ, w: 2.5, d: 5, h: 10 },
    { type: 'box', x: gateX + 4.25, z: gateZ, w: 2.5, d: 5, h: 10 },
  );
  gable(11, 5, 7, 0.5, gateX, 10, gateZ, true, M.slate);
  windowRow(gateX, gateZ + 2.55, '+z', 2, 3, 8.2, 0.7, 1.3);
  roundTower(12.8, gateZ, 3.2, 15, 10, M.slate, M.stoneLight);
  colliders.push({ type: 'circle', x: 12.8, z: gateZ, r: 3.2, h: 15 });
  windowRow(12.8, gateZ + 3.15, '+z', 1, 1, 9, 0.7, 1.5);

  // ---------- Niedrige Mauern ohne Zinnen, nur mit Deckplatte ----------
  const wall = (w, d, h, x, z) => {
    box(w, h, d, x, 0, z, M.stone);
    box(w + 0.4, 0.5, d + 0.4, x, h, z, M.stoneLight);
    colliders.push({ type: 'box', x, z, w, d, h: h + 0.5 });
  };
  wall(11.7, 2, 6, -7.35, gateZ); // Süd links vom Tor
  wall(6, 2, 5, 18.8, gateZ); // Süd rechts
  wall(2, 12, 5, 22, 13); // Ost
  wall(2, 8, 5, -21, -0.5); // West, zwischen Rundturm und Kapelle

  // ---------- Fenster als InstancedMesh ----------
  const tmp = new THREE.Object3D();
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
    footprint: { w: 48, d: 42 },
    height: 45,
    gate: { x: gateX, z: gateZ, w: 6, facing: '+z' },
    colliders,
  };
  return group;
}
