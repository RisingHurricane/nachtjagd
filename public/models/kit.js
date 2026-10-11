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
    reveal: mat(0x6c747a),
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

  // Seitenflächen eines Vielecks (oder Kreisbogens) wie bei CylinderGeometry: Ecken bei Winkel
  // thetaStart + k * thetaLength / n, Punkt = (r sin, r cos).
  function arcFacets(n, rB, rT, thetaStart, thetaLength) {
    const al = thetaLength / n / 2;
    const out = [];
    for (let k = 0; k < n; k++) {
      const phi = thetaStart + al + 2 * al * k;
      out.push({
        nx: Math.sin(phi), nz: Math.cos(phi),
        aB: rB * Math.cos(al), aT: rT * Math.cos(al),
        hlB: rB * Math.sin(al), hlT: rT * Math.sin(al), tan: Math.tan(al),
      });
    }
    return out;
  }
  const polyFacets = (n, rB, rT, phase) => arcFacets(n, rB, rT, phase, Math.PI * 2);

  // Quader, Unterkante bei y0.
  function box(w, h, d, x, y0, z, material) {
    const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y0 + h / 2, z);
    if (!opt.noHosts) hosts.push({ mesh, mat: material, F, x, z, y0, h, facets: boxFacets(w, d), t: wallThickness(Math.min(w, d)) });
    return mesh;
  }

  // Innenraumhüllen (nur von innen sichtbar, Material mit BackSide). Fenster werden zu echten Löchern
  // mit Laibung (tunnel = Mauerstärke) samt Rahmen und Glas.
  // only: nur diese Seitenflächen (Normalen '+x' '-x' '+z' '-z') bauen, zum Beispiel nur die Längswände.
  function shellBox(w, h, d, x, y0, z, material, { noTop = false, noBottom = false, only = null } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    // Gruppen der BoxGeometry: px, nx, py, ny, pz, nz
    const names = ['+x', '-x', 'top', 'bottom', '+z', '-z'];
    const drop = [];
    if (noTop || only) drop.push(2);
    if (noBottom || only) drop.push(3);
    if (only) names.forEach((n, i) => { if (i !== 2 && i !== 3 && !only.includes(n)) drop.push(i); });
    if (drop.length) {
      const index = Array.from(geo.index.array);
      const keep = [];
      geo.groups.forEach((g, gi) => {
        if (!drop.includes(gi)) for (let i = g.start; i < g.start + g.count; i++) keep.push(index[i]);
      });
      geo.setIndex(keep);
      geo.clearGroups();
    }
    const mesh = add(new THREE.Mesh(geo, material), x, y0 + h / 2, z);
    const dirs = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] };
    const facets = boxFacets(w, d).filter((f) => !only || only.some((n) => dirs[n][0] === f.nx && dirs[n][1] === f.nz));
    hosts.push({
      interior: true, mesh, mat: material, F, x, z, y0, h, facets, t: 0, tunnel: 0.5,
      caps: { top: !noTop && !only, bottom: !noBottom && !only },
    });
    return mesh;
  }

  // Offene Wand eines runden oder vieleckigen Raums (Zylindermantel ohne Deckel), auch als Halbrund
  // (thetaLength kleiner als 2 pi, Beginn bei phase).
  function shellPoly(rTop, rBottom, h, segs, phase, x, y0, z, material, thetaLength = Math.PI * 2) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segs, 1, true, phase, thetaLength);
    const mesh = add(new THREE.Mesh(geo, material), x, y0 + h / 2, z);
    hosts.push({
      interior: true, mesh, mat: material, F, x, z, y0, h, facets: arcFacets(segs, rBottom, rTop, phase, thetaLength),
      t: 0, tunnel: 0.45, caps: { top: false, bottom: false },
    });
    return mesh;
  }

  // Turmschaft: Zylinder (rTop oben, rBottom unten) mit segs Seiten, um phase gedreht. Mit Fenstern
  // wird er beim Abschluss zu einer hohlen Wand mit echten Öffnungen.
  function shaft(x, z, rTop, rBottom, h, y0, segs, material, phase = 0) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
    if (phase) geo.rotateY(phase);
    const mesh = add(new THREE.Mesh(geo, material), x, y0 + h / 2, z);
    if (!opt.noHosts) {
      hosts.push({
        mesh, mat: material, F, x, z, y0, h, facets: polyFacets(segs, rBottom, rTop, phase),
        t: wallThickness(Math.min(rTop, rBottom)),
      });
    }
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

  const windows = []; // { x, y, z, n: [nx, nz], w, h, rot, look } in Weltkoordinaten (n: Normale aus der Wand heraus)
  const FACE = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

  // face: '+z' '-z' '+x' '-x' oder Normalenvektor [nx, nz] (rahmenlokal). look: { glass, backing } Materialien.
  function pushWin(x, y, z, face, w, h, look) {
    const p = toWorld(x, z);
    windows.push({ x: p.x, y, z: p.z, n: typeof face === 'string' ? FACE[face] : face, w, h, rot: F.rot, look });
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
    const fv = w.n;
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

  // Punkte auf der Oberfläche eines Bauteils: f = Seitenfläche, u = Abstand von deren Mitte entlang der
  // Fläche, y = Höhe über dem Bauteilfuß, inset = Tiefe nach innen (negativ: nach außen).
  function surfaceOf(host) {
    const H = host.h;
    const pt = (f, u, y, inset) => {
      const a = f.aB + (f.aT - f.aB) * (y / H) - inset;
      return [host.x + f.nx * a + f.nz * u, host.y0 + y, host.z + f.nz * a - f.nx * u];
    };
    const corner = (f, y, inset) => pt(f, f.hlB + (f.hlT - f.hlB) * (y / H) - inset * f.tan, y, inset);
    return { H, pt, corner };
  }
  const cross3 = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };

  // Dreiecke einer Seitenfläche mit Fensterlöchern. Nach außen ausgerichtet (gegen den Uhrzeigersinn
  // von außen gesehen). rows teilt die Seitenkanten für Helligkeitsverläufe.
  function sheetTris(host, S, f, holes, inset, rows) {
    const { H, pt } = S;
    const tn = inset * f.tan;
    const contour = [[-(f.hlB - tn), 0], [f.hlB - tn, 0]];
    for (let r = 1; r < rows; r++) contour.push([f.hlB + (f.hlT - f.hlB) * (r / rows) - tn, H * (r / rows)]);
    contour.push([f.hlT - tn, H], [-(f.hlT - tn), H]);
    for (let r = rows - 1; r >= 1; r--) contour.push([-(f.hlB + (f.hlT - f.hlB) * (r / rows) - tn), H * (r / rows)]);
    const all = [...contour, ...holes.flat()];
    const tris = THREE.ShapeUtils.triangulateShape(
      contour.map(([x, y]) => new THREE.Vector2(x, y)),
      holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)))
    );
    return tris.map(([i, j, k]) => {
      const a = all[i];
      let b = all[j];
      let c = all[k];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b];
      return [pt(f, a[0], a[1], inset), pt(f, b[0], b[1], inset), pt(f, c[0], c[1], inset)];
    });
  }

  // Laibung: Dreiecke zwischen Fensterkante bei Tiefe d0 und d1, zur Fenstermitte hin sichtbar.
  function revealTris(S, f, hole, d0, d1) {
    const O = hole.map(([u, y]) => S.pt(f, u, y, d0));
    const I = hole.map(([u, y]) => S.pt(f, u, y, d1));
    const mid = [0, 1, 2].map((d) => (O.reduce((q, p) => q + p[d], 0) + I.reduce((q, p) => q + p[d], 0)) / (2 * hole.length));
    const out = [];
    const n = hole.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (const tri of [[O[i], O[j], I[j]], [O[i], I[j], I[i]]]) {
        const cen = [0, 1, 2].map((d) => (tri[0][d] + tri[1][d] + tri[2][d]) / 3);
        const nrm = cross3(tri[0], tri[1], tri[2]);
        const dot = nrm[0] * (mid[0] - cen[0]) + nrm[1] * (mid[1] - cen[1]) + nrm[2] * (mid[2] - cen[2]);
        out.push(dot > 0 ? tri : [tri[0], tri[2], tri[1]]);
      }
    }
    return out;
  }

  // Deckel aus einem Eckenring, nach oben (up) oder unten ausgerichtet.
  function fanTris(ring, up, dy = 0) {
    const cx = ring.reduce((q, p) => q + p[0], 0) / ring.length;
    const cz = ring.reduce((q, p) => q + p[2], 0) / ring.length;
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const tri = [a, b, [cx, a[1], cz]];
      const flipped = cross3(tri[0], tri[1], tri[2])[1] > 0 !== up;
      const t3 = flipped ? [tri[0], tri[2], tri[1]] : tri;
      out.push(t3.map((p) => [p[0], p[1] + dy, p[2]]));
    }
    return out;
  }

  const holesOf = (host, f, items) =>
    items.filter((it) => it.hit.f === f).map((it) => archPts(it.w.w, it.w.h).map(([du, dv]) => [it.hit.u + du, it.w.y - host.y0 + dv]));

  function meshFrom(tris, colors) {
    const pos = new Float32Array(tris.length * 9);
    tris.forEach((t, i) => t.forEach((p, k) => pos.set(p, i * 9 + k * 3)));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    g.computeVertexNormals();
    return g;
  }

  // Ersetzt den vollen Block durch eine hohle Wand: Außenhaut (Material des Bauteils) und Innenhaut
  // (warm erleuchtet) mit denselben Öffnungen, Laibungen dazwischen, Decke und Boden.
  function hollowOut(host, items) {
    const S = surfaceOf(host);
    const { H } = S;
    const t = host.t;
    const outer = [];
    const inner = [];
    const innerCol = [];
    const WALL = new THREE.Color(0xe3b070);
    const CEIL = new THREE.Color(0x8c6a44);
    const FLOOR = new THREE.Color(0x9b7648);
    // Helligkeit je Ecke: in Raummitte am hellsten, zu Boden und Decke dunkler (Tiefenwirkung)
    const shade = (col, y) => {
      const k = Math.sin(Math.PI * Math.min(1, Math.max(0, y / H)));
      const f = 0.42 + 0.58 * Math.pow(k, 0.7);
      return [col.r * f, col.g * f, col.b * f];
    };
    const addInner = (tri, col, byHeight) => {
      inner.push(tri);
      for (const q of tri) innerCol.push(...(byHeight ? shade(col, q[1] - host.y0) : [col.r, col.g, col.b]));
    };
    for (const f of host.facets) {
      const holes = holesOf(host, f, items);
      outer.push(...sheetTris(host, S, f, holes, 0, 1));
      for (const [A, B, C] of sheetTris(host, S, f, holes, t, Math.max(1, Math.ceil(H / 3)))) addInner([A, C, B], WALL, true);
      for (const hole of holes) outer.push(...revealTris(S, f, hole, 0, t));
    }
    outer.push(...fanTris(host.facets.map((f) => S.corner(f, H, 0)), true));
    for (const tri of fanTris(host.facets.map((f) => S.corner(f, H, t)), false, -0.02)) addInner(tri, CEIL, false);
    for (const tri of fanTris(host.facets.map((f) => S.corner(f, 0, t)), true, 0.04)) addInner(tri, FLOOR, false);

    const parent = host.mesh.parent;
    parent.remove(host.mesh);
    host.mesh.geometry.dispose();
    const om = new THREE.Mesh(meshFrom(outer), host.mat);
    om.name = 'hollowWall';
    const im = new THREE.Mesh(meshFrom(inner, innerCol), M.plaster);
    im.name = 'interiorGlow';
    parent.add(om, im);
  }

  // Innenraumhülle mit echten Fensterlöchern: Hülle (Material des Raums, nur von innen sichtbar) und
  // Laibungen nach außen (Mauerstärke host.tunnel).
  function carveShell(host, items) {
    const S = surfaceOf(host);
    const shell = [];
    const reveals = [];
    for (const f of host.facets) {
      const holes = holesOf(host, f, items);
      shell.push(...sheetTris(host, S, f, holes, 0, 1));
      for (const hole of holes) reveals.push(...revealTris(S, f, hole, 0, -host.tunnel));
    }
    if (host.caps.top) shell.push(...fanTris(host.facets.map((f) => S.corner(f, S.H, 0)), true));
    if (host.caps.bottom) shell.push(...fanTris(host.facets.map((f) => S.corner(f, 0, 0)), false));
    const parent = host.mesh.parent;
    parent.remove(host.mesh);
    host.mesh.geometry.dispose();
    const sm = new THREE.Mesh(meshFrom(shell), host.mat);
    sm.name = 'roomShell';
    const rm = new THREE.Mesh(meshFrom(reveals), M.reveal);
    rm.name = 'windowReveal';
    parent.add(sm, rm);
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

  // Fensterbaugruppen als Instanzen. Jede Instanz q: x, z, y (Mitte), yaw (Blickrichtung der Baugruppe),
  // w, h, Versätze entlang der Blickrichtung (casing, glass; beide ≥ 0 nach vorn), loose (vor Wand statt
  // in Öffnung), gmat und bmat (Glas und Hintergrundplatte).
  function windowGroup(inst) {
    const tmp = new THREE.Object3D();
    const winGroup = new THREE.Group();
    winGroup.name = 'windows';
    const bySize = new Map();
    for (const q of inst) {
      const key = [q.w.toFixed(2), q.h.toFixed(2), q.gmat.uuid, q.bmat ? q.bmat.uuid : ''].join('|');
      if (!bySize.has(key)) bySize.set(key, []);
      bySize.get(key).push(q);
    }
    const place = (mesh, i, q, off) => {
      tmp.position.set(q.x + Math.sin(q.yaw) * off, q.y, q.z + Math.cos(q.yaw) * off);
      tmp.rotation.set(0, q.yaw, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    };
    for (const list of bySize.values()) {
      const { w, h, gmat, bmat } = list[0];
      const parts = windowParts(w, h);
      const casing = new THREE.InstancedMesh(parts.casing, M.stoneLight, list.length);
      const bars = new THREE.InstancedMesh(parts.bars, M.mullion, list.length);
      const glass = new THREE.InstancedMesh(parts.glass, gmat, list.length);
      glass.renderOrder = 2;
      const loose = list.filter((q) => q.loose);
      const backing = loose.length ? new THREE.InstancedMesh(parts.backing, bmat || M.backing, loose.length) : null;
      let bi = 0;
      list.forEach((q, i) => {
        place(casing, i, q, q.casingOff);
        place(bars, i, q, q.glassOff);
        place(glass, i, q, q.glassOff);
        if (q.loose) place(backing, bi++, q, q.casingOff * 0.5);
      });
      casing.name = 'windowCasing';
      bars.name = 'windowBars';
      glass.name = 'windowGlass';
      winGroup.add(casing, bars, glass);
      if (backing) { backing.name = 'windowBacking'; winGroup.add(backing); }
    }
    group.add(winGroup);
    return winGroup;
  }

  // Alle Fenster abschließen: Fenster in Wänden werden zu echten Öffnungen mit Glas, übrige Fenster
  // sitzen als Rahmen mit Glas vor einer beleuchteten Platte. Gibt die Zählung zurück.
  function finish() {
    const stats = { total: windows.length, open: 0, loose: 0, openList: [], looseList: [] };
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
    const inst = [];
    const yawOf = (n, rot, inside) => Math.atan2(inside ? -n[0] : n[0], inside ? -n[1] : n[1]) + rot;
    for (const [host, items] of byHost) {
      if (host.interior) carveShell(host, items);
      else hollowOut(host, items);
      const c = Math.cos(host.F.rot);
      const s = Math.sin(host.F.rot);
      for (const { w, hit } of items) {
        const f = hit.f;
        const a = f.aB + (f.aT - f.aB) * ((w.y - host.y0) / host.h);
        const lx = host.x + f.nx * a + f.nz * hit.u;
        const lz = host.z + f.nz * a - f.nx * hit.u;
        const q = {
          w: w.w, h: w.h, y: w.y, loose: false,
          x: host.F.x + lx * c + lz * s, z: host.F.z - lx * s + lz * c,
          yaw: yawOf([f.nx, f.nz], host.F.rot, host.interior),
          casingOff: 0, glassOff: -(host.interior ? host.tunnel * 0.5 : Math.min(0.5, 0.45 * host.t)),
          gmat: (w.look && w.look.glass) || M.glass, bmat: null,
        };
        // Außen liegt das Glas hinter der Außenfläche (gegen die Blickrichtung nach außen: -Versatz), innen
        // ebenso hinter der Raumwand, also in der Laibung.
        inst.push(q);
        stats.open++;
        stats.openList.push({ x: q.x, y: w.y, z: q.z, yaw: yawOf([f.nx, f.nz], host.F.rot, false), interior: !!host.interior });
      }
    }
    for (const w of looseList) {
      // Lose Fenster: Rahmen und Glas vor der Wand. Die Baugruppe blickt aus der Wand heraus.
      const q = {
        w: w.w, h: w.h, y: w.y, loose: true, x: w.x, z: w.z, yaw: yawOf(w.n, w.rot, false),
        casingOff: -0.08, glassOff: 0, gmat: (w.look && w.look.glass) || M.glass, bmat: (w.look && w.look.backing) || null,
      };
      inst.push(q);
      stats.loose++;
      stats.looseList.push({ x: w.x, y: w.y, z: w.z, w: w.w, h: w.h });
    }
    windowGroup(inst);
    return stats;
  }

  return {
    M, colliders, windows, add, box, shaft, shellBox, shellPoly, pushWin, roundTower, pyramid, gable, roofGeo, dormer, windowRow,
    arcadePanel, arcadeSeg, wallSeg, frame, col, rock, oct, finish, mat, toWorld, palisade, fiale, buttress, door,
  };
}
