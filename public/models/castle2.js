'use strict';

import { createKit, PALETTE } from './kit.js';

// Zweite Burgvariante, neugotisch und unsymmetrisch, aber mit anderem Grundriss als castle.js:
// langer Palas im Norden, sehr hoher runder Hauptturm am Ostende des Palas, ein um 30 Grad
// gedrehter Fachwerkflügel (Wernigerode-Art) im Osten, Kapelle mit Apsis im Nordwesten, Torturm
// mit Spitzbogentor und Pyramidendach im Süden, dazu ein Bogengang. Grobe Fassung aus einfachen Körpern.
//
// Vertrag wie bei castle.js (siehe dort): buildCastle2(THREE, options) liefert eine THREE.Group,
// 1 Einheit = 1 m, Ursprung = Mitte auf Bodenhöhe, Tor an der +z-Seite (hier bei x = -6),
// userData.colliders (Boxen mit optionalem rot, Kreise), Fenster als InstancedMesh 'windows'.

export function buildCastle2(THREE, options = {}) {
  const opt = { ...PALETTE, ...options };
  const group = new THREE.Group();
  group.name = 'castle';

  const kit = createKit(THREE, group, opt);
  const { M, colliders, add, box, roundTower, pyramid, gable, dormer, windowRow, arcadePanel, arcadeSeg, wallSeg, frame, col } = kit;

  // ---------- Felssockel ----------
  kit.rock([
    [-31, -4], [-30, -12], [-27, -19], [-18, -21], [-9, -19], [2, -20], [4, -20], [12, -13], [20, -12],
    [28, -6], [29, 5], [27, 12], [22, 15], [14, 17], [6, 23.5], [-6, 24], [-12, 22], [-21, 12], [-27, 3],
  ]);

  // ---------- Palas: langer Bau im Norden, sehr steiles Dach, zwei Zwerchgiebel zum Hof ----------
  box(26, 11, 10, -7, 0, -9, M.stone);
  col.box(-7, -9, 26, 10, 11);
  gable(26, 10, 17, 0.5, -7, 11, -9, true, M.slate);
  box(6, 13, 3, -13, 0, -2.5, M.stoneLight);
  gable(6, 3, 12, 0.3, -13, 13, -2.5, false, M.copper);
  box(6, 12, 3, 0.5, 0, -2.5, M.stoneLight);
  gable(6, 3, 9, 0.3, 0.5, 12, -2.5, false, M.slate);
  col.box(-13, -2.5, 6, 3, 13);
  col.box(0.5, -2.5, 6, 3, 12);
  windowRow(-13, -1, '+z', 2, 2.4, 4);
  windowRow(-13, -1, '+z', 2, 2.4, 8.5);
  windowRow(-13, -1, '+z', 1, 1, 12.5, 0.9, 1.5);
  windowRow(0.5, -1, '+z', 2, 2.4, 4);
  windowRow(0.5, -1, '+z', 2, 2.4, 8.5);
  windowRow(-3.5, -4, '+z', 1, 1, 4); // schmale Reihe zwischen den Giebeln
  windowRow(-7, -14, '-z', 7, 3.4, 4);
  windowRow(-7, -14, '-z', 7, 3.4, 8.5);
  for (const x of [-9, -5]) dormer(x, 15.3, -6.0, '+z');
  for (const x of [-16, -10, -4, 2]) dormer(x, 15.3, -12.0, '-z');
  box(1.3, 5, 1.3, -12, 26.5, -9, M.stoneDark);
  box(1.3, 5, 1.3, 2, 26.5, -9, M.stoneDark);
  // Erkerturm auf einem umgekehrten Kegel zwischen den Giebeln
  const corbel = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 8), M.stoneDark);
  corbel.rotation.x = Math.PI;
  add(corbel, -6.5, 4.5, -3.2);
  roundTower(-6.5, -3.2, 1.6, 9, 11, M.copper, M.stoneLight, 6, 8);

  // ---------- Hauptturm am Ostende des Palas: rund, zwei Stufen, sechs Erkertürmchen ----------
  {
    const cx = 9;
    const cz = -7;
    add(new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.4, 28, 12), M.stone), cx, 14, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(5.4, 4.1, 1.2, 12), M.stoneDark), cx, 28.6, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 14, 12), M.stoneLight), cx, 36.2, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.4, 1, 12), M.stoneDark), cx, 43.7, cz);
    add(new THREE.Mesh(new THREE.ConeGeometry(4.6, 30, 12), M.slate), cx, 44.2 + 15, cz);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 5, 6), M.dark), cx, 44.2 + 30 + 2.2, cz);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = cx + Math.cos(a) * 4.7;
      const z = cz + Math.sin(a) * 4.7;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 5, 8), M.stoneLight), x, 29.2 + 2.5, z);
      add(new THREE.Mesh(new THREE.ConeGeometry(1.0, 6, 8), M.copper), x, 34.2 + 3, z);
    }
    col.circle(cx, cz, 4.4, 78);
    for (const y of [10, 18, 24]) {
      windowRow(cx, cz - 4.3, '-z', 1, 1, y, 0.9, 2.2);
      windowRow(cx + 4.3, cz, '+x', 1, 1, y, 0.9, 2.2);
    }
    windowRow(cx, cz + 4.2, '+z', 1, 1, 25, 0.9, 2.2);
    for (const y of [36, 41]) {
      windowRow(cx, cz - 3.4, '-z', 1, 1, y, 0.8, 2.4);
      windowRow(cx, cz + 3.4, '+z', 1, 1, y, 0.8, 2.4);
      windowRow(cx + 3.4, cz, '+x', 1, 1, y, 0.8, 2.4);
      windowRow(cx - 3.4, cz, '-x', 1, 1, y, 0.8, 2.4);
    }
  }

  // ---------- Rückturm hinter dem Palas ----------
  roundTower(3, -16.5, 2.8, 24, 20, M.slate, M.stoneLight);
  col.circle(3, -16.5, 2.8, 24);
  windowRow(3, -13.7, '+z', 1, 1, 12, 0.8, 1.8);

  // ---------- Fachwerkflügel im Osten, 30 Grad gedreht, oben vorkragend ----------
  frame(17, 2, 0.52, () => {
    box(9, 5, 16, 0, 0, 0, M.stone);
    box(10, 6, 17, 0, 5, 0, M.wood);
    gable(10, 17, 13, 0.6, 0, 11, 0, false, M.copper);
    col.box(0, 0, 10, 17, 11);
    windowRow(-4.5, 0, '-x', 3, 4.5, 2.6, 0.8, 1.6);
    windowRow(-5, 0, '-x', 3, 4.5, 8, 0.9, 1.8);
    windowRow(4.5, 0, '+x', 3, 4.5, 2.6, 0.8, 1.6);
    windowRow(5, 0, '+x', 3, 4.5, 8, 0.9, 1.8);
    windowRow(0, 8, '+z', 2, 3.2, 2.6, 0.8, 1.6);
    windowRow(0, 8.5, '+z', 2, 3.2, 8, 0.9, 1.8);
    roundTower(-4.6, 8, 1.8, 14, 14, M.copper, M.stone);
    col.circle(-4.6, 8, 1.8, 14);
  });

  // ---------- Kapelle im Nordwesten, 14 Grad gedreht, Apsis nach Norden ----------
  frame(-24, -9, 0.25, () => {
    box(7, 12, 15, 0, 0, 0, M.stone);
    gable(7, 15, 14, 0.5, 0, 12, 0, false, M.copper);
    col.box(0, 0, 7, 15, 12);
    windowRow(3.5, 0, '+x', 3, 4, 5.5, 1.0, 3.4);
    windowRow(-3.5, 0, '-x', 3, 4, 5.5, 1.0, 3.4);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 12, 10), M.stone), 0, 6, -7.5);
    add(new THREE.Mesh(new THREE.ConeGeometry(4.1, 14, 10), M.copper), 0, 12 + 7, -7.5);
    col.circle(0, -7.5, 3.5, 12);
    roundTower(3.9, 6, 1.4, 22, 18, M.slate, M.stoneLight);
    col.circle(3.9, 6, 1.4, 22);
  });

  // ---------- Torturm mit Spitzbogentor und Pyramidendach ----------
  const gateX = -6;
  const gateZ = 17;
  arcadePanel(1, 5, 1.5, 18, 5.5, 9, 8, gateX, gateZ, M.stone);
  col.box(gateX - 3.25, gateZ, 1.5, 8, 18);
  col.box(gateX + 3.25, gateZ, 1.5, 8, 18);
  box(8.4, 1, 8.4, gateX, 18, gateZ, M.stoneDark); // Kragen unter dem Dach
  pyramid(8.8, 22, gateX, 19, gateZ, M.slate);
  for (const [dx, dz] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 8), M.stoneLight), gateX + dx, 19 + 1.5, gateZ + dz);
    add(new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 8), M.copper), gateX + dx, 19 + 3 + 2.5, gateZ + dz);
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 3.5, 6), M.dark), gateX, 19 + 22 + 1.5, gateZ);
  windowRow(gateX, gateZ + 4, '+z', 1, 1, 12.5, 0.8, 1.7);
  windowRow(gateX, gateZ + 4, '+z', 1, 1, 15.5, 0.8, 1.7);
  windowRow(gateX + 4, gateZ, '+x', 1, 1, 12.5, 0.8, 1.7);
  windowRow(gateX - 4, gateZ, '-x', 1, 1, 12.5, 0.8, 1.7);

  // ---------- Mauern: Bogengang zum Hof, schlichte Mauer im Westen ----------
  arcadeSeg(-2, 16.3, 15.5, 12.3, 6.5, 3.2);
  wallSeg(-10, 17.5, -20.5, 1.5, 5.5);

  kit.finish();

  group.userData = {
    kind: 'castle',
    variant: 'fachwerk-hang',
    footprint: { w: 60, d: 46 },
    height: 82,
    gate: { x: gateX, z: gateZ, w: 5, facing: '+z' },
    colliders,
  };
  return group;
}
