'use strict';

import { createKit, PALETTE } from './kit.js';

// Burg im neugotischen Stil (um 1880 bis 1920), grobe Fassung aus Quadern, Zylindern, Kegeln,
// Pyramiden und Prismen. Sie ersetzt später die Schlossboxen in world.js.
//
// Vertrag (damit eine detaillierte Fassung sie 1:1 ablösen kann):
//   buildCastle(THREE, options) gibt eine THREE.Group zurück.
//   - THREE wird übergeben, damit dieselbe Datei mit Three.js r128 (Live-Frontend) und 0.170 läuft.
//   - Maßstab 1 Einheit = 1 Meter. Ursprung = Mitte der Burg auf Bodenhöhe (y = 0).
//   - Das Tor liegt an der +z-Seite (Süden) bei x = 4, ein hoher Hauptturm steht im Hof vor dem
//     Palas, der Bergfried (Eckturm mit Pyramidendach) im Nordosten. Der Grundriss ist bewusst
//     unsymmetrisch (Gipfelburg wie Neuschwanstein, Wernigerode): Palas im Norden, Kapelle im
//     Westen, Kemenate im Osten, niedrige Mauern ohne Zinnen.
//   - Außenmaß etwa 52 x 49 m, Höhe 85 m, Tor 6 m breit. Die Rückseite ist durch Verbindungsbau, Mauern
//     und Palisaden geschlossen, Strebepfeiler tragen Fialen, Türen sitzen an den Hofseiten.
//   - Gemeinsame Bauteile (Türme, Dächer, Spitzbögen, Bogengänge) stehen in kit.js.
//   - group.userData.colliders: Liste der festen Körper in lokalen Koordinaten, damit das Layout
//     die Kollision aus dem Modell übernehmen kann:
//       { type: 'box', x, z, w, d, h } oder { type: 'circle', x, z, r, h }
//   - Fenster sind eine InstancedMesh mit dem Namen 'windows' und leuchtendem Material (Name 'windowGlow').
//   - Einzelne Flügel sind gegen die Achsen gedreht. Ihre Box-Collider tragen dann zusätzlich
//     { rot } (Drehung um y in Radiant, Konvention wie THREE.Object3D.rotation.y, Mittelpunkt x, z).
//     Wer nur achsenparallele Boxen kennt, kann sie über den Kreis um (x, z) mit Radius
//     hypot(w, d) / 2 annähern.
//   - Platzieren: group.position.set(x, bodenhoehe, z); group.rotation.y = drehung.

export function buildCastle(THREE, options = {}) {
  const opt = { ...PALETTE, ...options };
  const group = new THREE.Group();
  group.name = 'castle';

  const kit = createKit(THREE, group, opt);
  const { M, colliders, add, box, roundTower, pyramid, gable, dormer, windowRow, arcadePanel, arcadeSeg, wallSeg, frame, col, oct, palisade, fiale, buttress, door } = kit;

  // ---------- Felssockel: ein unregelmäßiger Umriss unter allen Gebäuden, 0,4 m über dem Boden ----------
  kit.rock([
    [-24, -6], [-21, -13], [-12, -19], [-6, -24.5], [4, -24.5], [8, -19], [14, -18], [15, -12],
    [23, -10], [28, 0], [27.5, 13], [26, 21.5], [17, 23.8], [8, 23.5], [-2, 23.3], [-12, 23.8],
    [-18, 23], [-24, 17], [-24.5, 4],
  ], 9); // 9 m tief, damit der Keller im Fels liegt

  // ---------- Palas (Haupthaus) im Norden: langer Bau mit steilem Dach und Zwerchgiebeln ----------
  box(24, 13, 9, -4, 0, -6, M.stone);
  col.box(-4, -6, 24, 9, 13);
  gable(24, 9, 17, 0.5, -4, 13, -6, true, M.slate);
  // Zwerchgiebel zur Hofseite, unterschiedlich hoch
  box(6, 15, 3, -12, 0, 0, M.stoneLight);
  gable(6, 3, 14, 0.3, -12, 15, 0, false, M.slate);
  box(6, 13, 3, 5, 0, 0, M.stoneLight);
  gable(6, 3, 11, 0.3, 5, 13, 0, false, M.copper);
  col.box(-12, 0, 6, 3, 15);
  col.box(5, 0, 6, 3, 13);
  windowRow(-12, 1.5, '+z', 2, 2.4, 4);
  windowRow(-12, 1.5, '+z', 2, 2.4, 9);
  windowRow(-12, 1.5, '+z', 1, 1, 13.4, 0.9, 1.6);
  windowRow(5, 1.5, '+z', 2, 2.4, 4);
  windowRow(5, 1.5, '+z', 2, 2.4, 9);
  windowRow(-3, -10.5, '-z', 5, 3.6, 4);
  windowRow(-3, -10.5, '-z', 5, 3.6, 9);
  for (const x of [-12, -6, 0]) dormer(x, 13.4, -9.1, '-z');
  box(1.3, 4.5, 1.3, -8, 28, -6, M.stoneDark);
  box(1.3, 4.5, 1.3, 5.5, 28, -6.4, M.stoneDark);
  // Strebepfeiler mit Fialen an der Rückwand des Palas (zwischen den Fenstern)
  for (const x of [-12, -8.4, -4.8, -1.2, 2.4]) buttress(x, -10.5, '-z', 9.5, 4.5);
  door(-12, 1.5, '+z', 2.2, 3.8);
  door(5, 1.5, '+z', 2.2, 3.8);
  // Erkerturm am Ostende der Hofseite, auf einem umgekehrten Kegel
  const corbel = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 8), M.stoneDark);
  corbel.rotation.x = Math.PI;
  add(corbel, 8.2, 4.4, -1.4);
  roundTower(8.2, -1.4, 1.7, 9, 11, M.copper, M.stoneLight, 6);

  // ---------- Hauptturm im Hof vor dem Palas: achteckig, schlank, zwei Stufen, sehr steile Haube ----------
  {
    const cx = -3.5;
    const cz = 2.6; // Nordfläche liegt bündig an der Palasfront (z = -1.5)
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(4.0, 4.4, 34, 8)), M.stone), cx, 17, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(5.2, 4.0, 1.2, 8)), M.stoneDark), cx, 34.6, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(3.2, 3.2, 14, 8)), M.stoneLight), cx, 42.2, cz);
    add(new THREE.Mesh(oct(new THREE.CylinderGeometry(4.2, 3.2, 1, 8)), M.stoneDark), cx, 49.7, cz);
    add(new THREE.Mesh(oct(kit.roofGeo(4.3, 26, 8)), M.copper), cx, 50.2 + 13, cz);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 5, 6), M.dark), cx, 50.2 + 26 + 2.2, cz);
    // vier Erkertürmchen auf dem unteren Kragen
    for (const [dx, dz] of [[-3.1, -3.1], [3.1, -3.1], [-3.1, 3.1], [3.1, 3.1]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 5, 8), M.stoneLight), cx + dx, 35.2 + 2.5, cz + dz);
      add(new THREE.Mesh(kit.roofGeo(1.1, 6, 8), M.slate), cx + dx, 40.2 + 3, cz + dz);
    }
    col.circle(cx, cz, 4.4, 81);
    // Tür und Fenster an den Flächen (Radius nimmt nach oben leicht ab, Fläche = 0,924 x Radius)
    box(2.4, 4.2, 0.3, cx, 0, cz + 4.07, M.dark);
    windowRow(cx, cz + 3.96, '+z', 1, 1, 9, 0.9, 2.2);
    windowRow(cx, cz + 3.89, '+z', 1, 1, 16, 0.9, 2.2);
    windowRow(cx, cz + 3.82, '+z', 1, 1, 23, 0.9, 2.2);
    windowRow(cx, cz + 3.74, '+z', 1, 1, 30, 0.9, 2.4);
    windowRow(cx, cz + 2.96, '+z', 1, 1, 41, 0.8, 2.6);
    windowRow(cx, cz + 2.96, '+z', 1, 1, 46, 0.8, 2.6);
    for (const y of [14, 26]) {
      windowRow(cx + 3.9, cz, '+x', 1, 1, y, 0.9, 2.2);
      windowRow(cx - 3.9, cz, '-x', 1, 1, y, 0.9, 2.2);
    }
    windowRow(cx + 2.96, cz, '+x', 1, 1, 42, 0.8, 2.6);
    windowRow(cx - 2.96, cz, '-x', 1, 1, 42, 0.8, 2.6);
  }

  // ---------- Hoher Rundturm am Westende (Neuschwanstein-Art) ----------
  roundTower(-17, -8, 4, 26, 25, M.slate, M.stoneLight);
  col.circle(-17, -8, 4, 26);
  windowRow(-17, -4, '+z', 1, 1, 9, 0.8, 1.8);
  windowRow(-17, -4, '+z', 1, 1, 16, 0.8, 1.8);
  windowRow(-17, -4, '+z', 1, 1, 22, 0.8, 1.8);
  // schlanker Begleitturm, weiter hinten und niedriger
  roundTower(-12.5, -13.5, 1.8, 17, 15, M.copper, M.stone);
  col.circle(-12.5, -13.5, 1.8, 17);

  // ---------- Bergfried im Nordosten: quadratisch, Kragen, Eckerker, steile Pyramide ----------
  box(8, 22, 8, 9, 0, -12, M.stone);
  col.box(9, -12, 8, 8, 22);
  box(9.4, 1.6, 9.4, 9, 22, -12, M.stoneDark);
  pyramid(8.6, 24, 9, 23.6, -12, M.copper);
  for (const [dx, dz] of [[-4.1, -4.1], [4.1, -4.1], [-4.1, 4.1], [4.1, 4.1]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 8), M.stoneLight), 9 + dx, 23.6 + 1.75, -12 + dz);
    add(new THREE.Mesh(kit.roofGeo(1.2, 6, 8), M.slate), 9 + dx, 23.6 + 3.5 + 3, -12 + dz);
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 3.5, 6), M.dark), 9, 23.6 + 24 + 1.5, -12);
  door(13, -8.9, '+x', 1.8, 3.4);
  windowRow(13, -12, '+x', 2, 3, 8);
  windowRow(13, -12, '+x', 2, 3, 15);
  windowRow(9, -16, '-z', 2, 3, 8);
  windowRow(9, -16, '-z', 2, 3, 15);
  windowRow(9, -16, '-z', 1, 1, 20, 0.7, 1.6);

  // ---------- Rückflügel hinter dem Palas, gegen die Achsen gedreht ----------
  frame(-3, -18, 0.45, () => {
    box(10, 9, 7, 0, 0, 0, M.stoneLight);
    gable(10, 7, 10, 0.5, 0, 9, 0, true, M.copper);
    col.box(0, 0, 10, 7, 9);
    windowRow(0, 3.5, '+z', 3, 3, 3.6);
    windowRow(0, 3.5, '+z', 3, 3, 6.6);
    windowRow(0, -3.5, '-z', 3, 3, 3.6);
    windowRow(0, -3.5, '-z', 3, 3, 6.6);
    box(1.2, 3.5, 1.2, 2, 15, 0, M.stoneDark);
    door(-1.5, 3.5, '+z', 1.6, 3.0);
  });

  // ---------- Kemenate im Osten, 22 Grad gedreht, mit Ecktürmchen ----------
  frame(18.5, 1.5, -0.38, () => {
    box(8, 10, 12, 0, 0, 0, M.stoneLight);
    gable(8, 12, 13, 0.6, 0, 10, 0, false, M.slate);
    col.box(0, 0, 8, 12, 10);
    door(-4, -1.8, '-x', 1.8, 3.4);
    windowRow(-4, 0, '-x', 3, 3.6, 3.6);
    windowRow(-4, 0, '-x', 3, 3.6, 7.2);
    windowRow(0, 6, '+z', 2, 3, 4);
    windowRow(0, 6, '+z', 2, 3, 7.5);
    roundTower(4.2, 6.2, 1.6, 12, 13, M.copper, M.stone);
    col.circle(4.2, 6.2, 1.6, 12);
  });

  // ---------- Kapelle im Westen, 17 Grad gedreht, mit Apsis und schlankem Spitzturm ----------
  frame(-17.5, 10, 0.3, () => {
    box(8, 10, 14, 0, 0, 0, M.stone);
    gable(8, 14, 14, 0.6, 0, 10, 0, false, M.copper);
    col.box(0, 0, 8, 14, 10);
    windowRow(4, 0, '+x', 3, 3.6, 5, 1.0, 3.2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.9, 10, 10), M.stone), 0, 5, 7);
    add(new THREE.Mesh(kit.roofGeo(4.5, 13, 10), M.copper), 0, 16.5, 7);
    col.circle(0, 7, 3.8, 10);
    roundTower(4.8, -5.5, 1.5, 19, 17, M.slate, M.stoneLight);
    col.circle(4.8, -5.5, 1.5, 19);
    for (const z of [-1.8, 1.8, 5.4]) buttress(4, z, '+x', 8.2, 3.8, 0.8, 1.1);
    for (const z of [-3.6, -1.8, 1.8, 3.6, 5.4]) buttress(-4, z, '-x', 8.2, 3.8, 0.8, 1.1);
    door(0, -7, '-z', 2.6, 4.6);
  });

  // ---------- Torhaus (rechts der Mitte) mit Rundturm ----------
  const gateX = 4;
  const gateZ = 19;
  arcadePanel(1, 6, 2.5, 10, 5.4, 8.8, 5, gateX, gateZ, M.stone); // Spitzbogentor, 6 m breit
  col.box(gateX - 4.25, gateZ, 2.5, 5, 10);
  col.box(gateX + 4.25, gateZ, 2.5, 5, 10);
  gable(11, 5, 11, 0.5, gateX, 10, gateZ, true, M.slate);
  windowRow(gateX - 4.25, gateZ + 2.5, '+z', 1, 1, 6.5, 0.7, 1.5);
  windowRow(gateX + 4.25, gateZ + 2.5, '+z', 1, 1, 6.5, 0.7, 1.5);
  for (const sx of [-5.2, 5.2]) buttress(gateX + sx, gateZ + 2.5, '+z', 10.2, 4.6, 1.0, 1.0);
  roundTower(12.8, gateZ, 3.2, 15, 17, M.slate, M.stoneLight);
  col.circle(12.8, gateZ, 3.2, 15);
  windowRow(12.8, gateZ + 3.2, '+z', 1, 1, 9, 0.7, 1.5);

  // ---------- Niedrige Mauern ohne Zinnen, teils schräg ----------
  arcadeSeg(-13.5, 21, -1.5, 18.6, 7, 3.2); // Bogengang links vom Tor, leicht schräg
  arcadeSeg(17, 19.8, 24.3, 11.8, 6.5, 3); // zweiter Bogengang rechts vom Torturm, schräg zur Kemenate
  wallSeg(21.4, 10.4, 24.4, 12.2, 5.5, 1.6); // Anschluss an die Kemenate
  palisade(26.2, 20.4, 27.2, 14, 3.2); // Palisade am Felsrand im Südosten
  wallSeg(-20, -4.5, -23, 3.5, 5); // West, zwischen Rundturm und Kapelle

  // ---------- Rückseite: Lücken zwischen den Bauten schließen ----------
  // Verbindungsbau zwischen Begleitturm und Rückflügel, mit Satteldach und Fialen
  frame(-8.4, -13.6, 0.22, () => {
    box(5.2, 8, 3.6, 0, 0, 0, M.stoneLight);
    gable(5.2, 3.6, 6, 0.4, 0, 8, 0, true, M.slate);
    col.box(0, 0, 5.2, 3.6, 8);
    windowRow(0, -1.8, '-z', 2, 2.2, 4.5, 0.7, 1.6);
    windowRow(0, -1.8, '-z', 1, 1, 7, 0.6, 1.2);
    door(0, -1.8, '-z', 1.5, 3.0);
    buttress(-2.6, -1.8, '-z', 6.5, 3.6, 0.8, 0.9);
    buttress(2.6, -1.8, '-z', 6.5, 3.6, 0.8, 0.9);
  });
  wallSeg(3.2, -17.4, 5.4, -16.2, 5.5, 1.6); // zwischen Rückflügel und Bergfried
  palisade(13.4, -8.4, 17, -5.9, 3.2); // zwischen Bergfried und Kemenate
  palisade(-23, 4.6, -24, 9.5, 2.8); // am Westrand neben der Kapelle
  // weitere Fialen an den Giebeln des Palas
  for (const x of [-15.6, 7.6]) fiale(x, 12.2, -6, 4.2, 0.6);

  kit.finish();

  group.userData = {
    kind: 'castle',
    footprint: { w: 52, d: 49 },
    height: 85,
    gate: { x: gateX, z: gateZ, w: 6, facing: '+z' },
    colliders,
  };
  return group;
}
