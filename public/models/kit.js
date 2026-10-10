'use strict';

// Baukasten für die Burgmodelle (castle.js, castle2.js): Materialien, Quader, Türme, Dächer,
// Spitzbögen, Bogengänge, schräge Flügel (frame) und Fenster. Alles nimmt THREE als Parameter,
// damit die Module mit Three.js r128 (Live-Frontend) und 0.170 laufen.

export const PALETTE = {
  windowColor: 0xe0a050, // warmes Licht aus der Palette in DESIGN.md
  stone: 0x596b74,
  stoneDark: 0x4e4e4b,
  stoneLight: 0x7e868c,
  roofSlate: 0x2f3d4a,
  roofCopper: 0x6e4637,
  snow: 0xdfe6ec,
  wood: 0x4a3a2e,
};

export function createKit(THREE, group, opt) {
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
    wood: mat(opt.wood),
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

  // Spitzes Dach (Kegel oder Pyramide) mit flacherem Rand am Fuß: Der Rand ist etwa 17 Grad geneigt
  // und geht nach der Randbreite in die steile Hauptneigung über. Maße und Mittelpunkt wie bei einer
  // ConeGeometry(R, h, segs), also ersetzt dieser Aufruf einen Kegel ohne Änderung der Position.
  function roofGeo(R, h, segs) {
    const kick = Math.min(R * 0.3, 1.3);
    const pts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(R, 0),
      new THREE.Vector2(R - kick, kick * 0.3),
      new THREE.Vector2(0.001, h),
    ];
    const geo = new THREE.LatheGeometry(pts, segs);
    geo.translate(0, -h / 2, 0);
    return geo;
  }

  // Runder Turm mit Kegeldach. roofMat bestimmt die Dachfarbe, segs die Seitenzahl.
  function roundTower(x, z, r, h, roofH, roofMat, stoneMat, y0 = 0, segs = 12) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, segs), stoneMat), x, y0 + h / 2, z);
    // Auskragung unter dem Dach
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.0, 1.1, segs), M.stoneDark), x, y0 + h + 0.55, z);
    add(new THREE.Mesh(roofGeo(r * 1.3, roofH, segs), roofMat), x, y0 + h + 1.1 + roofH / 2, z);
    // Turmspitze
    add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.8, 6), M.dark), x, y0 + h + 1.1 + roofH + 0.7, z);
  }

  // Vierseitige Pyramide über einem quadratischen Grundriss mit Seitenlänge s.
  function pyramid(s, h, x, y0, z, material) {
    const m = new THREE.Mesh(roofGeo(s * Math.SQRT1_2, h, 4), material);
    m.rotation.y = Math.PI / 4;
    return add(m, x, y0 + h / 2, z);
  }

  // Satteldach (dreieckiges Prisma). ridgeAlongX: Firstrichtung entlang x, sonst entlang z.
  function gable(w, d, rise, overhang, x, y0, z, ridgeAlongX, material) {
    const span = (ridgeAlongX ? d : w) + overhang * 2;
    const length = (ridgeAlongX ? w : d) + overhang * 2;
    // Flacher Rand am Traufrand (etwa 17 Grad), danach die steile Hauptneigung bis zum First.
    const kick = Math.min(1.6, span * 0.2);
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2, 0);
    shape.lineTo(span / 2, 0);
    shape.lineTo(span / 2 - kick, kick * 0.3);
    shape.lineTo(0, rise);
    shape.lineTo(-span / 2 + kick, kick * 0.3);
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
    gable(1.8, 1.8, 2.6, 0.15, x, y0 + 1.8, z, false, M.slate);
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

  // Wandscheibe mit Spitzbogenöffnungen bis zum Boden (Bogengang, Tor). Mitte der Scheibe bei (x, z),
  // t = Tiefe. n Öffnungen der Breite bw, Pfeiler dazwischen und außen je pw breit.
  function arcadePanel(n, bw, pw, h, spring, apex, t, x, z, material) {
    const W = n * bw + (n + 1) * pw;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(-W / 2, h);
    shape.lineTo(W / 2, h);
    shape.lineTo(W / 2, 0);
    for (let i = n - 1; i >= 0; i--) {
      const x0 = -W / 2 + pw + i * (bw + pw);
      shape.lineTo(x0 + bw, 0);
      shape.lineTo(x0 + bw, spring);
      shape.lineTo(x0 + bw / 2, apex);
      shape.lineTo(x0, spring);
      shape.lineTo(x0, 0);
    }
    shape.lineTo(-W / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    geo.translate(0, 0, -t / 2);
    return add(new THREE.Mesh(geo, material), x, 0, z);
  }

  // Bogengang von (ax, az) nach (bx, bz): Rückwand, Spitzbogenreihe zur linken Seite der Laufrichtung
  // (zum Hof), steiles Pultdach aus Kupfer. Schräg erlaubt.
  function arcadeSeg(ax, az, bx, bz, h, t) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    frame((ax + bx) / 2, (az + bz) / 2, Math.atan2(-dz, dx), () => {
      const bw = 2.6;
      const n = Math.max(1, Math.round((len - 1) / (bw + 1)));
      const pw = (len - n * bw) / (n + 1);
      box(len, h, 0.7, 0, 0, t / 2 - 0.35, M.stone); // Rückwand
      arcadePanel(n, bw, pw, h, h * 0.55, h * 0.88, 0.9, 0, -t / 2 + 0.45, M.stoneLight);
      gable(len, t, 4.5, 0.4, 0, h, 0, true, M.copper);
      col.box(0, 0, len, t, h + 0.5);
    });
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


  // Palisade: Reihe angespitzter Holzpfähle mit zwei Querlatten von (ax, az) nach (bx, bz).
  function palisade(ax, az, bx, bz, h = 3) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    frame((ax + bx) / 2, (az + bz) / 2, Math.atan2(-dz, dx), () => {
      const n = Math.max(2, Math.round(len / 0.5));
      const stakes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 1, 0.42), M.wood, n);
      const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.8, 4), M.wood, n);
      const t = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + (len * (i + 0.5)) / n;
        const hh = h * (0.88 + 0.12 * (((i * 7919) % 13) / 12)); // leicht unterschiedlich hoch
        t.position.set(x, hh / 2 - 0.2, ((i % 2) - 0.5) * 0.12);
        t.scale.set(1, hh, 1);
        t.rotation.set(0, 0, 0);
        t.updateMatrix();
        stakes.setMatrixAt(i, t.matrix);
        t.position.set(x, hh - 0.2 + 0.4, ((i % 2) - 0.5) * 0.12);
        t.scale.set(1, 1, 1);
        t.rotation.set(0, Math.PI / 4, 0);
        t.updateMatrix();
        tips.setMatrixAt(i, t.matrix);
      }
      F.g.add(stakes);
      F.g.add(tips);
      box(len, 0.2, 0.16, 0, h * 0.28, 0.3, M.wood);
      box(len, 0.2, 0.16, 0, h * 0.68, 0.3, M.wood);
      col.box(0, 0, len, 0.6, h);
    });
  }

  // Fiale (Ziertürmchen): Schaft, Kragen, Krabben an den Seiten, Pyramidenspitze. h = Gesamthöhe.
  function fiale(x, y0, z, h = 4, s = 0.55) {
    const shaft = h * 0.55;
    box(s * 1.5, 0.35, s * 1.5, x, y0, z, M.stoneDark);
    box(s, shaft, s, x, y0 + 0.35, z, M.stoneLight);
    box(s * 1.35, 0.25, s * 1.35, x, y0 + 0.35 + shaft, z, M.stoneDark);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      box(0.16, 0.36, 0.16, x + dx * s * 0.58, y0 + 0.35 + shaft * 0.75, z + dz * s * 0.58, M.stoneLight);
    }
    const tipH = h - shaft - 0.6;
    pyramid(s * 1.1, tipH, x, y0 + 0.6 + shaft, z, M.slate);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 5), M.dark), x, y0 + h + 0.2, z);
  }

  // Strebepfeiler mit Fiale an einer Wand. dir: '+x' '-x' '+z' '-z' (Richtung von der Wand weg),
  // (x, z) liegt auf der Wandfläche. h = Pfeilerhöhe, fh = Höhe der Fiale darüber.
  function buttress(x, z, dir, h, fh = 4, w = 0.9, d = 1.2, withCol = true) {
    const nx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
    const nz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
    const cx = x + (nx * d) / 2;
    const cz = z + (nz * d) / 2;
    const sx = nx ? d : w;
    const sz = nz ? d : w;
    box(sx, h, sz, cx, 0, cz, M.stone);
    box(sx + 0.2, 0.3, sz + 0.2, cx, h, cz, M.stoneLight);
    if (fh > 0) fiale(cx + nx * 0.05, h + 0.3, cz + nz * 0.05, fh, Math.min(0.6, w * 0.65));
    if (withCol) col.box(cx, cz, sx, sz, h);
  }

  // Tür im Spitzbogen mit steinerner Laibung, an einer Wandfläche. face: '+z' '-z' '+x' '-x'.
  // (x, z) ist die Mitte der Türschwelle auf der Wand.
  function door(x, z, face, w = 2.2, h = 3.8) {
    const ang = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
    const arch = (aw, spring, apex) => {
      const sh = new THREE.Shape();
      sh.moveTo(-aw / 2, 0);
      sh.lineTo(aw / 2, 0);
      sh.lineTo(aw / 2, spring);
      sh.lineTo(0, apex);
      sh.lineTo(-aw / 2, spring);
      sh.lineTo(-aw / 2, 0);
      return sh;
    };
    const apex = h;
    const spring = h * 0.68;
    const f = new THREE.ExtrudeGeometry(arch(w + 0.7, spring + 0.1, apex + 0.45), { depth: 0.4, bevelEnabled: false });
    f.translate(0, 0, -0.12);
    const frameMesh = add(new THREE.Mesh(f, M.stoneLight), x, 0, z);
    frameMesh.rotation.y = ang;
    const d = new THREE.ExtrudeGeometry(arch(w, spring, apex), { depth: 0.46, bevelEnabled: false });
    d.translate(0, 0, -0.12);
    const doorMesh = add(new THREE.Mesh(d, M.wood), x, 0, z);
    doorMesh.rotation.y = ang;
    // Eisenbänder (liegen auf dem Türblatt)
    for (const y of [h * 0.25, h * 0.55]) {
      const strap = add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.16, 0.08), M.dark), x, y, z);
      strap.rotation.y = ang;
      const n = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      strap.position.x += n.x * 0.36;
      strap.position.z += n.z * 0.36;
    }
  }

  // Ein Felsumriss (Liste von [x, z]) unter allen Gebäuden, 0,4 m über dem Boden, 1,6 m darunter.
  function rock(outline, depth = 2) {
    const shape = new THREE.Shape();
    outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); // Umriss in die x-z-Ebene, Tiefe nach unten
    const mesh = new THREE.Mesh(geo, M.stoneDark);
    mesh.position.y = 0.4;
    group.add(mesh);
    return mesh;
  }

  // Achtseitiger Zylinder oder Kegel so drehen, dass eine Fläche (keine Kante) nach +z zeigt.
  function oct(geo) {
    geo.rotateY(Math.PI / 8);
    return geo;
  }

  // Alle gesammelten Fenster als eine InstancedMesh mit Leuchtmaterial hinzufügen.
  function finish() {
  const tmp = new THREE.Object3D();
    // Spitzbogenfenster: Rechteck mit aufgesetztem Dreieck, Maße 1 x 1 (werden pro Fenster skaliert)
    const winShape = new THREE.Shape();
    winShape.moveTo(-0.5, -0.5);
    winShape.lineTo(0.5, -0.5);
    winShape.lineTo(0.5, 0.15);
    winShape.lineTo(0, 0.5);
    winShape.lineTo(-0.5, 0.15);
    winShape.lineTo(-0.5, -0.5);
    const winGeo = new THREE.ExtrudeGeometry(winShape, { depth: 0.18, bevelEnabled: false });
    winGeo.translate(0, 0, -0.09);
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
  }

  return {
    M, colliders, windows, add, box, roundTower, pyramid, gable, roofGeo, dormer, windowRow,
    arcadePanel, arcadeSeg, wallSeg, frame, col, rock, oct, finish, mat, toWorld, palisade, fiale, buttress, door,
  };
}
