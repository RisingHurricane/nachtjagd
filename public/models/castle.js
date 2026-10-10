'use strict';

// Burg im neugotischen Stil (um 1880 bis 1920), grobe Fassung aus Quadern, Zylindern, Kegeln,
// Pyramiden und Prismen. Sie ersetzt später die Schlossboxen in world.js.
//
// Vertrag (damit eine detaillierte Fassung sie 1:1 ablösen kann):
//   buildCastle(THREE, options) gibt eine THREE.Group zurück.
//   - THREE wird übergeben, damit dieselbe Datei mit Three.js r128 (Live-Frontend) und 0.170 läuft.
//   - Maßstab 1 Einheit = 1 Meter. Ursprung = Mitte der Burg auf Bodenhöhe (y = 0).
//   - Das Tor liegt an der +z-Seite (Süden) bei x = 4, ein hoher Mittelturm steht im Hof vor dem
//     Palas, der Bergfried (Eckturm mit Pyramidendach) im Nordosten. Der Grundriss ist bewusst unsymmetrisch (Gipfelburg wie Neuschwanstein,
//     Wernigerode): Palas im Norden, Kapelle im Westen, Kemenate im Osten, niedrige Mauern ohne Zinnen.
//   - Außenmaß etwa 46 x 40 m, Tor 6 m breit.
//   - group.userData.colliders: Liste der festen Körper in lokalen Koordinaten, damit das Layout
//     die Kollision aus dem Modell übernehmen kann:
//       { type: 'box', x, z, w, d, h } oder { type: 'circle', x, z, r, h }
//   - Fenster sind eine InstancedMesh mit dem Namen 'windows' und leuchtendem Material (Name 'windowGlow').
//   - Einzelne Flügel sind gegen die Achsen gedreht. Ihre Box-Collider tragen dann zusätzlich
//     { rot } (Drehung um y in Radiant, Konvention wie THREE.Object3D.rotation.y, Mittelpunkt x, z).
//     Wer nur achsenparallele Boxen kennt, kann sie über den Kreis um (x, z) mit Radius
//     hypot(w, d) / 2 annähern.
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

  // Teilbereiche (Flügel) lassen sich gegen die Achsen drehen. frame(x, z, rot, fn) baut fn() in
  // lokalen Koordinaten um (x, z); Fenster und Collider werden in Weltkoordinaten umgerechnet.
  let F = { x: 0, z: 0, rot: 0, g: group };
  function frame(x, z, rot, fn) {
    const prev = F;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    F = { x, z, rot, g };
    fn();
    F = prev;
  }
  const toWorld = (x, z) => ({
    x: F.x + x * Math.cos(F.rot) + z * Math.sin(F.rot),
    z: F.z - x * Math.sin(F.rot) + z * Math.cos(F.rot),
  });
  const col = {
    box(x, z, w, d, h) {
      const p = toWorld(x, z);
      const c = { type: 'box', x: p.x, z: p.z, w, d, h };
      if (F.rot !== 0) c.rot = F.rot;
      colliders.push(c);
    },
    circle(x, z, r, h) {
      const p = toWorld(x, z);
      colliders.push({ type: 'circle', x: p.x, z: p.z, r, h });
    },
  };

  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    F.g.add(mesh);
    return mesh;
  }

  // Quader, Unterkante bei y0.
  function box(w, h, d, x, y0, z, material) {
    return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y0 + h / 2, z);
  }

  // Runder Turm mit Kegeldach. roofMat bestimmt die Dachfarbe, segs die Seitenzahl.
  function roundTower(x, z, r, h, roofH, roofMat, stoneMat, y0 = 0, segs = 12) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, segs), stoneMat), x, y0 + h / 2, z);
    // Auskragung unter dem Dach
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.0, 1.1, segs), M.stoneDark), x, y0 + h + 0.55, z);
    add(new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, roofH, segs), roofMat), x, y0 + h + 1.1 + roofH / 2, z);
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

  const windows = []; // { x, y, z, face, w, h, rot } in Weltkoordinaten

  function pushWin(x, y, z, face, w, h) {
    const p = toWorld(x, z);
    windows.push({ x: p.x, y, z: p.z, face, w, h, rot: F.rot });
  }

  // Dachgaube: kleiner Kasten mit Giebel, schaut in Richtung dir ('+z' oder '-z').
  function dormer(x, y0, z, dir) {
    const s = dir === '+z' ? 1 : -1;
    box(1.8, 1.8, 1.8, x, y0, z, M.stone);
    gable(1.8, 1.8, 1.4, 0.15, x, y0 + 1.8, z, false, M.slate);
    pushWin(x, y0 + 0.9, z + s * 0.92, dir, 0.7, 1.0);
  }

  // Fensterreihe an einer Wandfläche. face: '+z' '-z' '+x' '-x'. (cx, cz) ist die Mitte der Reihe
  // auf der Wandfläche selbst, die Fenster sitzen um offset davor.
  function windowRow(cx, cz, face, count, spacing, y, w = 0.8, h = 1.8, offset = 0.08) {
    const start = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const t = start + i * spacing;
      if (face === '+z') pushWin(cx + t, y, cz + offset, face, w, h);
      else if (face === '-z') pushWin(cx + t, y, cz - offset, face, w, h);
      else if (face === '+x') pushWin(cx + offset, y, cz + t, face, w, h);
      else pushWin(cx - offset, y, cz + t, face, w, h);
    }
  }

  // Niedrige Mauer ohne Zinnen von (ax, az) nach (bx, bz), schräg erlaubt, mit Deckplatte.
  function wallSeg(ax, az, bx, bz, h, t = 2) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    frame((ax + bx) / 2, (az + bz) / 2, Math.atan2(-dz, dx), () => {
      box(len, h, t, 0, 0, 0, M.stone);
      box(len + 0.4, 0.5, t + 0.4, 0, h, 0, M.stoneLight);
      col.box(0, 0, len, t, h + 0.5);
    });
  }

  // ---------- Felssockel (unregelmäßig, ragt teils aus dem Boden) ----------
  box(46, 1.2, 40, 0.5, -1.2, 3, M.stoneDark);
  box(14, 0.7, 5, -10, 0, 21.5, M.stoneDark);
  box(5, 0.9, 12, -23.5, 0, 0, M.stoneDark);
  box(4, 0.6, 12, 24.5, 0, 12, M.stoneDark);
  box(16, 0.8, 10, -3, 0, -20, M.stoneDark);

  // ---------- Palas (Haupthaus) im Norden: langer Bau mit steilem Dach und Zwerchgiebeln ----------
  box(24, 13, 9, -4, 0, -6, M.stone);
  col.box(-4, -6, 24, 9, 13);
  gable(24, 9, 11, 0.5, -4, 13, -6, true, M.slate);
  // Zwerchgiebel zur Hofseite, unterschiedlich hoch
  box(6, 15, 3, -11, 0, 0, M.stoneLight);
  gable(6, 3, 9, 0.3, -11, 15, 0, false, M.slate);
  box(6, 13, 3, 4.5, 0, 0, M.stoneLight);
  gable(6, 3, 7, 0.3, 4.5, 13, 0, false, M.copper);
  col.box(-11, 0, 6, 3, 15);
  col.box(4.5, 0, 6, 3, 13);
  windowRow(-11, 1.5, '+z', 2, 2.4, 4);
  windowRow(-11, 1.5, '+z', 2, 2.4, 9);
  windowRow(-11, 1.5, '+z', 1, 1, 13.4, 0.9, 1.6);
  windowRow(4.5, 1.5, '+z', 2, 2.4, 4);
  windowRow(4.5, 1.5, '+z', 2, 2.4, 9);
  windowRow(-3, -10.5, '-z', 5, 3.6, 4);
  windowRow(-3, -10.5, '-z', 5, 3.6, 9);
  for (const x of [-12, -6, 0]) dormer(x, 15, -9.1, '-z');
  box(1.3, 4, 1.3, -8, 21.5, -6, M.stoneDark);
  box(1.3, 4, 1.3, 5.5, 21.5, -6.4, M.stoneDark);
  // Erkerturm am Ostende der Hofseite, auf einem umgekehrten Kegel
  const corbel = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 8), M.stoneDark);
  corbel.rotation.x = Math.PI;
  add(corbel, 8.2, 4.4, -1.4);
  roundTower(8.2, -1.4, 1.7, 9, 6.5, M.copper, M.stoneLight, 6);

  // ---------- Mittelturm im Hof vor dem Palas: achteckig, zwei Stufen, steile Haube ----------
  {
    const cx = -3.5;
    const cz = 3;
    const oct = (geo) => {
      geo.rotateY(Math.PI / 8); // Fläche statt Kante zeigt nach +z
      return geo;
    };
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(3.6, 3.9, 22, 8)), M.stone), cx, 11, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(4.6, 3.6, 1.2, 8)), M.stoneDark), cx, 22.6, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(3.0, 3.0, 8, 8)), M.stoneLight), cx, 27.2, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(3.9, 3.0, 1, 8)), M.stoneDark), cx, 31.7, cz);
    add(new THREE.Mesh(oct(new THREE.ConeGeometry(4.0, 17, 8)), M.copper), cx, 32.2 + 8.5, cz);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 4, 6), M.dark), cx, 32.2 + 17 + 1.6, cz);
    // vier Erkertürmchen auf dem unteren Kragen
    for (const [dx, dz] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4, 8), M.stoneLight), cx + dx, 23.2 + 2, cz + dz);
      add(new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.6, 8), M.slate), cx + dx, 27.2 + 1.8, cz + dz);
    }
    col.circle(cx, cz, 3.9, 32);
    windowRow(cx, cz + 3.45, '+z', 1, 1, 9, 0.9, 2);
    windowRow(cx, cz + 3.4, '+z', 1, 1, 15, 0.9, 2);
    windowRow(cx, cz + 3.35, '+z', 1, 1, 20, 0.9, 2);
    windowRow(cx, cz + 2.82, '+z', 1, 1, 26.5, 0.8, 2.4);
    windowRow(cx + 3.45, cz, '+x', 1, 1, 12, 0.9, 2);
    windowRow(cx - 3.45, cz, '-x', 1, 1, 12, 0.9, 2);
  }

  // ---------- Hoher Rundturm am Westende (Neuschwanstein-Art) ----------
  roundTower(-17, -8, 4, 26, 15, M.slate, M.stoneLight);
  col.circle(-17, -8, 4, 26);
  windowRow(-17, -4, '+z', 1, 1, 9, 0.8, 1.8);
  windowRow(-17, -4, '+z', 1, 1, 16, 0.8, 1.8);
  windowRow(-17, -4, '+z', 1, 1, 22, 0.8, 1.8);
  // schlanker Begleitturm, weiter hinten und niedriger
  roundTower(-12.5, -13.5, 1.8, 17, 9, M.copper, M.stone);
  col.circle(-12.5, -13.5, 1.8, 17);

  // ---------- Bergfried im Nordosten: quadratisch, Kragen, Eckerker, steile Pyramide ----------
  box(8, 22, 8, 9, 0, -12, M.stone);
  col.box(9, -12, 8, 8, 22);
  box(9.4, 1.6, 9.4, 9, 22, -12, M.stoneDark);
  pyramid(8.6, 14, 9, 23.6, -12, M.copper);
  for (const [dx, dz] of [[-4.1, -4.1], [4.1, -4.1], [-4.1, 4.1], [4.1, 4.1]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 8), M.stoneLight), 9 + dx, 23.6 + 1.75, -12 + dz);
    add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), M.slate), 9 + dx, 23.6 + 3.5 + 2, -12 + dz);
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 3.5, 6), M.dark), 9, 23.6 + 14 + 1.5, -12);
  windowRow(13, -12, '+x', 2, 3, 8);
  windowRow(13, -12, '+x', 2, 3, 15);
  windowRow(9, -16, '-z', 2, 3, 8);
  windowRow(9, -16, '-z', 2, 3, 15);
  windowRow(9, -16, '-z', 1, 1, 20, 0.7, 1.6);

  // ---------- Rückflügel hinter dem Palas, gegen die Achsen gedreht ----------
  frame(-3, -18, 0.45, () => {
    box(10, 9, 7, 0, 0, 0, M.stoneLight);
    gable(10, 7, 6, 0.5, 0, 9, 0, true, M.copper);
    col.box(0, 0, 10, 7, 9);
    windowRow(0, 3.5, '+z', 3, 3, 3.6);
    windowRow(0, 3.5, '+z', 3, 3, 6.6);
    windowRow(0, -3.5, '-z', 3, 3, 3.6);
    windowRow(0, -3.5, '-z', 3, 3, 6.6);
    box(1.2, 3.5, 1.2, 2, 11, 0, M.stoneDark);
  });

  // ---------- Kemenate im Osten, 22 Grad gedreht, mit Ecktürmchen ----------
  frame(18.5, 1.5, -0.38, () => {
    box(8, 10, 12, 0, 0, 0, M.stoneLight);
    gable(8, 12, 8, 0.6, 0, 10, 0, false, M.slate);
    col.box(0, 0, 8, 12, 10);
    windowRow(-4, 0, '-x', 3, 3.6, 3.6);
    windowRow(-4, 0, '-x', 3, 3.6, 7.2);
    windowRow(0, 6, '+z', 2, 3, 4);
    windowRow(0, 6, '+z', 2, 3, 7.5);
    roundTower(4.2, 6.2, 1.6, 12, 8, M.copper, M.stone);
    col.circle(4.2, 6.2, 1.6, 12);
  });

  // ---------- Kapelle im Westen, 17 Grad gedreht, mit Apsis und schlankem Spitzturm ----------
  frame(-17.5, 10, 0.3, () => {
    box(8, 10, 14, 0, 0, 0, M.stone);
    gable(8, 14, 9, 0.6, 0, 10, 0, false, M.copper);
    col.box(0, 0, 8, 14, 10);
    windowRow(4, 0, '+x', 3, 3.6, 5, 1.0, 3.2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.9, 10, 10), M.stone), 0, 5, 7);
    add(new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 10), M.copper), 0, 14, 7);
    col.circle(0, 7, 3.8, 10);
    roundTower(4.8, -5.5, 1.5, 19, 10, M.slate, M.stoneLight);
    col.circle(4.8, -5.5, 1.5, 19);
  });

  // ---------- Torhaus (rechts der Mitte) mit Rundturm ----------
  const gateX = 4;
  const gateZ = 19;
  box(2.5, 10, 5, gateX - 4.25, 0, gateZ, M.stone);
  box(2.5, 10, 5, gateX + 4.25, 0, gateZ, M.stone);
  box(11, 3.5, 5, gateX, 6.5, gateZ, M.stone); // Sturz, liegt über 6,5 m und blockiert Spieler nicht
  box(6, 6.5, 0.3, gateX, 0, gateZ - 2.2, M.dark); // dunkle Rückwand im Torbogen
  col.box(gateX - 4.25, gateZ, 2.5, 5, 10);
  col.box(gateX + 4.25, gateZ, 2.5, 5, 10);
  gable(11, 5, 7, 0.5, gateX, 10, gateZ, true, M.slate);
  windowRow(gateX, gateZ + 2.5, '+z', 2, 3, 8.2, 0.7, 1.3);
  roundTower(12.8, gateZ, 3.2, 15, 10, M.slate, M.stoneLight);
  col.circle(12.8, gateZ, 3.2, 15);
  windowRow(12.8, gateZ + 3.2, '+z', 1, 1, 9, 0.7, 1.5);

  // ---------- Niedrige Mauern ohne Zinnen, teils schräg ----------
  wallSeg(-13.5, 21, -1.5, 18.6, 6); // Süd links vom Tor, leicht schräg
  wallSeg(15.5, 20.5, 24, 12, 5); // Südost, schräg zur Kemenate
  wallSeg(-20, -4.5, -23, 3.5, 5); // West, zwischen Rundturm und Kapelle

  // ---------- Fenster als InstancedMesh ----------
  const tmp = new THREE.Object3D();
  const winGeo = new THREE.BoxGeometry(1, 1, 0.18);
  const win = new THREE.InstancedMesh(winGeo, M.glow, windows.length);
  windows.forEach((w, i) => {
    tmp.position.set(w.x, w.y, w.z);
    const base = w.face === '+x' ? Math.PI / 2 : w.face === '-x' ? -Math.PI / 2 : w.face === '-z' ? Math.PI : 0;
    tmp.rotation.set(0, base + w.rot, 0);
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
    height: 53,
    gate: { x: gateX, z: gateZ, w: 6, facing: '+z' },
    colliders,
  };
  return group;
}
