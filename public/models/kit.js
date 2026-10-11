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
    // Echtes Fensterglas: durchsichtig, leicht bläulich, mit einem Hauch warmem Eigenlicht.
    glass: new THREE.MeshStandardMaterial({
      name: 'windowGlass',
      color: 0x9fc0d6,
      emissive: opt.windowColor,
      emissiveIntensity: 0.1,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    mullion: mat(0x2a1d14, { roughness: 0.7 }),
    // Beleuchtete Innenseite der hohlen Mauern (unbeleuchtet, Helligkeit über Vertexfarben).
    plaster: new THREE.MeshBasicMaterial({ name: 'interiorGlow', vertexColors: true }),
    backing: new THREE.MeshBasicMaterial({ name: 'windowBacking', color: 0x8a5a2c, side: THREE.DoubleSide }),
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

  // Bauteile, in die Fenster echte Öffnungen schneiden können (Quader und Turmschäfte).
  // Jedes Bauteil beschreibt seinen Grundriss als Liste von Seitenflächen (facets) in der Reihenfolge
  // wachsenden Winkels: Normale (nx, nz), Abstand der Fläche vom Mittelpunkt (a, unten und oben),
  // halbe Länge (hl, unten und oben) und tan(Winkel/2) für das Einrücken an den Ecken.
  const hosts = [];
  const wallThickness = (size) => Math.min(1.0, Math.max(0.35, 0.2 * size));

  function boxFacets(w, d) {
    return [
      { nx: 0, nz: 1, aB: d / 2, aT: d / 2, hlB: w / 2, hlT: w / 2, tan: 1 },
      { nx: 1, nz: 0, aB: w / 2, aT: w / 2, hlB: d / 2, hlT: d / 2, tan: 1 },
      { nx: 0, nz: -1, aB: d / 2, aT: d / 2, hlB: w / 2, hlT: w / 2, tan: 1 },
      { nx: -1, nz: 0, aB: w / 2, aT: w / 2, hlB: d / 2, hlT: d / 2, tan: 1 },
    ];
  }

  function polyFacets(n, rB, rT, phase) {
    const al = Math.PI / n;
    const out = [];
    for (let k = 0; k < n; k++) {
      const phi = phase + al + 2 * al * k;
      out.push({
        nx: Math.sin(phi), nz: Math.cos(phi),
        aB: rB * Math.cos(al), aT: rT * Math.cos(al),
        hlB: rB * Math.sin(al), hlT: rT * Math.sin(al), tan: Math.tan(al),
      });
    }
    return out;
  }

  // Quader, Unterkante bei y0.
  function box(w, h, d, x, y0, z, material) {
    const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y0 + h / 2, z);
    hosts.push({ mesh, mat: material, F, x, z, y0, h, facets: boxFacets(w, d), t: wallThickness(Math.min(w, d)) });
    return mesh;
  }

  // Turmschaft: Zylinder (rTop oben, rBottom unten) mit segs Seiten, um phase gedreht. Mit Fenstern
  // wird er beim Abschluss zu einer hohlen Wand mit echten Öffnungen.
  function shaft(x, z, rTop, rBottom, h, y0, segs, material, phase = 0) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
    if (phase) geo.rotateY(phase);
    const mesh = add(new THREE.Mesh(geo, material), x, y0 + h / 2, z);
    hosts.push({
      mesh, mat: material, F, x, z, y0, h, facets: polyFacets(segs, rBottom, rTop, phase),
      t: wallThickness(Math.min(rTop, rBottom)),
    });
    return mesh;
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
    // Eine Seitenfläche zeigt genau nach +z, +x, -z und -x (bei durch 4 teilbarer Seitenzahl).
    shaft(x, z, r, r * 1.08, h, y0, segs, stoneMat, Math.PI / segs);
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

  // ---------- Fenster ----------
  // Spitzbogenfenster (Mitte bei 0, 0): Rechteck mit aufgesetztem Spitzbogen.
  const archPts = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, 0.15 * h], [0, h / 2], [-w / 2, 0.15 * h]];
  const shapeOf = (pts) => {
    const sh = new THREE.Shape();
    pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)));
    return sh;
  };
  const FACE = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

  // Mehrere Geometrien (ohne Index) zu einer zusammenfügen.
  function mergeGeos(list) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o); o += g.attributes.position.count * 3; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
  }

  // Passt das Fenster w auf eine Seitenfläche des Bauteils? Liefert { f, u, err } oder null.
  function matchWindow(host, w) {
    if (Math.abs(host.F.rot - w.rot) > 1e-6) return null;
    const c = Math.cos(host.F.rot);
    const s = Math.sin(host.F.rot);
    const dx = w.x - host.F.x;
    const dz = w.z - host.F.z;
    const xl = dx * c - dz * s - host.x;
    const zl = dx * s + dz * c - host.z;
    const k = (w.y - host.y0) / host.h;
    if (k <= 0 || k >= 1) return null;
    if (w.y - w.h / 2 < host.y0 + 0.3 || w.y + w.h / 2 > host.y0 + host.h - 0.25) return null;
    const fv = FACE[w.face];
    let best = null;
    for (const f of host.facets) {
      if (f.nx * fv[0] + f.nz * fv[1] < 0.95) continue;
      const a = f.aB + (f.aT - f.aB) * k;
      const err = Math.abs(xl * f.nx + zl * f.nz - a);
      if (err > 0.5) continue;
      const u = xl * f.nz - zl * f.nx;
      const hl = f.hlB + (f.hlT - f.hlB) * k - host.t * f.tan;
      if (Math.abs(u) + w.w / 2 > hl - 0.12) continue;
      if (!best || err < best.err) best = { f, u, err };
    }
    return best;
  }

  // Ersetzt den vollen Block durch eine hohle Wand: Außenhaut (Material des Bauteils) und Innenhaut
  // (warm erleuchtet) mit denselben Öffnungen, Laibungen dazwischen, Decke und Boden.
  function hollowOut(host, items) {
    const H = host.h;
    const t = host.t;
    const outer = [];
    const inner = [];
    const innerCol = [];
    const WALL = new THREE.Color(0xe3b070);
    const CEIL = new THREE.Color(0x8c6a44);
    const FLOOR = new THREE.Color(0x9b7648);
    const pt = (f, u, y, inset) => {
      const a = f.aB + (f.aT - f.aB) * (y / H) - inset;
      return [host.x + f.nx * a + f.nz * u, host.y0 + y, host.z + f.nz * a - f.nx * u];
    };
    const corner = (f, y, inset) => pt(f, f.hlB + (f.hlT - f.hlB) * (y / H) - inset * f.tan, y, inset);
    // Innenhaut: Helligkeit je Ecke, in Raummitte am hellsten, zu Boden und Decke dunkler (Tiefenwirkung).
    const shade = (col, y) => {
      const k = Math.sin(Math.PI * Math.min(1, Math.max(0, y / H)));
      const f = 0.42 + 0.58 * Math.pow(k, 0.7);
      return [col.r * f, col.g * f, col.b * f];
    };
    const addInner = (a, b, c, col, byHeight) => {
      inner.push(...a, ...b, ...c);
      for (const q of [a, b, c]) {
        const rgb = byHeight ? shade(col, q[1] - host.y0) : [col.r, col.g, col.b];
        innerCol.push(...rgb);
      }
    };
    const cross = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    };

    for (const f of host.facets) {
      const mine = items.filter((it) => it.hit.f === f);
      const holes = mine.map((it) => archPts(it.w.w, it.w.h).map(([du, dv]) => [it.hit.u + du, it.w.y - host.y0 + dv]));
      for (const inset of [0, t]) {
        const tn = inset * f.tan;
        const contour = [[-(f.hlB - tn), 0], [f.hlB - tn, 0]];
        // Seitenkanten unterteilen: mehr Ecken für den Helligkeitsverlauf der Innenhaut
        const rows = inset ? Math.max(1, Math.ceil(H / 3)) : 1;
        for (let r = 1; r < rows; r++) contour.push([f.hlB + (f.hlT - f.hlB) * (r / rows) - tn, H * (r / rows)]);
        contour.push([f.hlT - tn, H], [-(f.hlT - tn), H]);
        for (let r = rows - 1; r >= 1; r--) contour.push([-(f.hlB + (f.hlT - f.hlB) * (r / rows) - tn), H * (r / rows)]);
        const all = [...contour, ...holes.flat()];
        const tris = THREE.ShapeUtils.triangulateShape(
          contour.map(([x, y]) => new THREE.Vector2(x, y)),
          holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)))
        );
        for (const [i, j, k] of tris) {
          const a = all[i];
          let b = all[j];
          let c = all[k];
          if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b]; // gegen den Uhrzeigersinn = nach außen
          const A = pt(f, a[0], a[1], inset);
          const B = pt(f, b[0], b[1], inset);
          const C = pt(f, c[0], c[1], inset);
          if (inset) addInner(A, C, B, WALL, true);
          else outer.push(...A, ...B, ...C);
        }
      }
      // Laibungen: Außenkante und Innenkante jedes Fensters verbinden
      holes.forEach((hole) => {
        const O = hole.map(([u, y]) => pt(f, u, y, 0));
        const I = hole.map(([u, y]) => pt(f, u, y, t));
        const mid = [0, 1, 2].map((d) => (O.reduce((q, p) => q + p[d], 0) + I.reduce((q, p) => q + p[d], 0)) / (2 * hole.length));
        const n = hole.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          for (const tri of [[O[i], O[j], I[j]], [O[i], I[j], I[i]]]) {
            const cen = [0, 1, 2].map((d) => (tri[0][d] + tri[1][d] + tri[2][d]) / 3);
            const nrm = cross(tri[0], tri[1], tri[2]);
            const dot = nrm[0] * (mid[0] - cen[0]) + nrm[1] * (mid[1] - cen[1]) + nrm[2] * (mid[2] - cen[2]);
            if (dot > 0) outer.push(...tri[0], ...tri[1], ...tri[2]);
            else outer.push(...tri[0], ...tri[2], ...tri[1]);
          }
        }
      });
    }
    // Deckel (außen, sichtbar unter dem Dach), Decke und Boden (innen)
    const fan = (ring, up, sink) => {
      const cx = ring.reduce((q, p) => q + p[0], 0) / ring.length;
      const cy = ring[0][1];
      const cz = ring.reduce((q, p) => q + p[2], 0) / ring.length;
      const out = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const tri = [a, b, [cx, cy, cz]];
        const ny = cross(tri[0], tri[1], tri[2])[1];
        out.push(ny > 0 === up ? tri : [tri[0], tri[2], tri[1]]);
      }
      return out.map((tri) => tri.map((p) => [p[0], p[1] + sink, p[2]]));
    };
    for (const tri of fan(host.facets.map((f) => corner(f, H, 0)), true, 0)) outer.push(...tri[0], ...tri[1], ...tri[2]);
    for (const tri of fan(host.facets.map((f) => corner(f, H, t)), false, -0.02)) addInner(tri[0], tri[1], tri[2], CEIL);
    for (const tri of fan(host.facets.map((f) => corner(f, 0, t)), true, 0.04)) addInner(tri[0], tri[1], tri[2], FLOOR);

    const parent = host.mesh.parent;
    parent.remove(host.mesh);
    host.mesh.geometry.dispose();
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outer), 3));
    og.computeVertexNormals();
    const om = new THREE.Mesh(og, host.mat);
    om.name = 'hollowWall';
    const ig = new THREE.BufferGeometry();
    ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(inner), 3));
    ig.setAttribute('color', new THREE.BufferAttribute(new Float32Array(innerCol), 3));
    ig.computeVertexNormals();
    const im = new THREE.Mesh(ig, M.plaster);
    im.name = 'interiorGlow';
    parent.add(om);
    parent.add(im);
  }

  // Fensterteile für eine Größe: Steinrahmen mit Sohlbank, Holzsprossen, Glas, Hintergrundplatte.
  function windowParts(w, h) {
    const casing = new THREE.ExtrudeGeometry(
      (() => {
        const sh = shapeOf(archPts(w + 0.4, h + 0.34));
        sh.holes.push(shapeOf(archPts(w, h)));
        return sh;
      })(),
      { depth: 0.16, bevelEnabled: false }
    );
    const sill = new THREE.BoxGeometry(w + 0.62, 0.1, 0.34);
    sill.translate(0, -h / 2 - 0.2, 0.1);
    const bars = [];
    const ring = new THREE.ExtrudeGeometry(
      (() => {
        const sh = shapeOf(archPts(w + 0.04, h + 0.04));
        sh.holes.push(shapeOf(archPts(w - 0.12, h - 0.12)));
        return sh;
      })(),
      { depth: 0.06, bevelEnabled: false }
    );
    ring.translate(0, 0, -0.03);
    bars.push(ring);
    const vb = new THREE.BoxGeometry(0.05, h - 0.1, 0.05);
    vb.translate(0, -0.05, 0);
    bars.push(vb);
    for (const y of h >= 1.4 ? [-0.2 * h, 0.08 * h] : [0]) {
      const hb = new THREE.BoxGeometry(w - 0.06, 0.045, 0.045);
      hb.translate(0, y, 0);
      bars.push(hb);
    }
    return {
      casing: mergeGeos([casing, sill]),
      bars: mergeGeos(bars),
      glass: new THREE.ShapeGeometry(shapeOf(archPts(w - 0.1, h - 0.1))),
      backing: new THREE.ShapeGeometry(shapeOf(archPts(w, h))),
    };
  }

  // Alle Fenster abschließen: Fenster in Wänden werden zu echten Öffnungen mit Glas, übrige Fenster
  // sitzen als Rahmen mit Glas vor einer beleuchteten Platte. Gibt die Zählung zurück.
  function finish() {
    const stats = { total: windows.length, open: 0, loose: 0, openList: [] };
    const byHost = new Map();
    const looseList = [];
    for (const w of windows) {
      let best = null;
      for (const host of hosts) {
        const hit = matchWindow(host, w);
        if (hit && (!best || hit.err < best.hit.err)) best = { host, hit };
      }
      if (!best) { looseList.push(w); continue; }
      if (!byHost.has(best.host)) byHost.set(best.host, []);
      byHost.get(best.host).push({ w, hit: best.hit });
    }
    // Einheitliche Liste der Fensterinstanzen (Weltkoordinaten)
    const inst = [];
    for (const [host, items] of byHost) {
      hollowOut(host, items);
      const c = Math.cos(host.F.rot);
      const s = Math.sin(host.F.rot);
      for (const { w, hit } of items) {
        const f = hit.f;
        const k = (w.y - host.y0) / host.h;
        const a = f.aB + (f.aT - f.aB) * k;
        const lx = host.x + f.nx * a + f.nz * hit.u;
        const lz = host.z + f.nz * a - f.nx * hit.u;
        inst.push({
          w: w.w, h: w.h, y: w.y, open: true, depth: Math.min(0.5, 0.45 * host.t),
          x: host.F.x + lx * c + lz * s, z: host.F.z - lx * s + lz * c,
          yaw: Math.atan2(f.nx, f.nz) + host.F.rot,
        });
        stats.open++;
        stats.openList.push({ x: inst[inst.length - 1].x, y: w.y, z: inst[inst.length - 1].z, yaw: inst[inst.length - 1].yaw });
      }
    }
    for (const w of looseList) {
      const base = w.face === '+x' ? Math.PI / 2 : w.face === '-x' ? -Math.PI / 2 : w.face === '-z' ? Math.PI : 0;
      inst.push({ w: w.w, h: w.h, y: w.y, open: false, depth: 0, x: w.x, z: w.z, yaw: base + w.rot });
      stats.loose++;
    }

    const tmp = new THREE.Object3D();
    const winGroup = new THREE.Group();
    winGroup.name = 'windows';
    const bySize = new Map();
    for (const q of inst) {
      const key = q.w.toFixed(2) + 'x' + q.h.toFixed(2);
      if (!bySize.has(key)) bySize.set(key, []);
      bySize.get(key).push(q);
    }
    const place = (mesh, i, q, back) => {
      const nx = Math.sin(q.yaw);
      const nz = Math.cos(q.yaw);
      tmp.position.set(q.x - nx * back, q.y, q.z - nz * back);
      tmp.rotation.set(0, q.yaw, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    };
    for (const [key, list] of bySize) {
      const [w, h] = key.split('x').map(Number);
      const parts = windowParts(w, h);
      const casing = new THREE.InstancedMesh(parts.casing, M.stoneLight, list.length);
      const bars = new THREE.InstancedMesh(parts.bars, M.mullion, list.length);
      const glass = new THREE.InstancedMesh(parts.glass, M.glass, list.length);
      glass.renderOrder = 2;
      const loose = list.filter((q) => !q.open);
      const backing = loose.length ? new THREE.InstancedMesh(parts.backing, M.backing, loose.length) : null;
      let bi = 0;
      list.forEach((q, i) => {
        // Rahmen außen bündig mit der Wand (lose Fenster: 0,08 m vor der Wand, also 0,08 zurück)
        place(casing, i, q, q.open ? 0 : 0.08);
        place(bars, i, q, q.open ? q.depth : 0);
        place(glass, i, q, q.open ? q.depth : 0);
        if (!q.open) place(backing, bi++, q, 0.04);
      });
      casing.name = 'windowCasing';
      bars.name = 'windowBars';
      glass.name = 'windowGlass';
      winGroup.add(casing, bars, glass);
      if (backing) { backing.name = 'windowBacking'; winGroup.add(backing); }
    }
    group.add(winGroup);
    return stats;
  }

  return {
    M, colliders, windows, add, box, shaft, roundTower, pyramid, gable, roofGeo, dormer, windowRow,
    arcadePanel, arcadeSeg, wallSeg, frame, col, rock, oct, finish, mat, toWorld, palisade, fiale, buttress, door,
  };
}
