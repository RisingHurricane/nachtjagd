'use strict';

// Blockhäuser des Dorfkerns aus village-plan.js (Dorfplan Entwurf G): Wände als Prismen über dem Grundriss,
// Walmdach mit Schnee, Fenster (ein Teil leuchtet nachts warm). Die Häuser sind nicht begehbar; blocked()
// hält Spieler, Monster und Fahrzeuge draußen. Alle Häuser teilen sich wenige zusammengeführte Meshes.
(function (root) {
  const STOREY = 3.15;
  const area = q => { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  function inPoly(x, z, q) { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [a, b] = q[i], [e, f] = q[j]; if ((b > z) !== (f > z) && x < (e - a) * (z - b) / (f - b) + a) c = !c; } return c; }
  function segDist(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
  const polyDist = (x, z, q) => { let m = Infinity; for (let i = 0; i < q.length; i++) m = Math.min(m, segDist(x, z, q[i], q[(i + 1) % q.length])); return m; };
  const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

  // Dachfirst: Strecke entlang der Hauptachse, so lang wie Länge minus Breite (bei quadratischen Häusern ein Zeltdach).
  function ridgeOf(q) {
    const cx = q.reduce((n, p) => n + p[0], 0) / q.length, cz = q.reduce((n, p) => n + p[1], 0) / q.length;
    let best = -1, axis = [1, 0];
    for (let k = 0; k < 18; k++) {
      const t = k * Math.PI / 18, u = [Math.cos(t), Math.sin(t)], pr = q.map(p => (p[0] - cx) * u[0] + (p[1] - cz) * u[1]), e = Math.max(...pr) - Math.min(...pr);
      if (e > best) { best = e; axis = u; }
    }
    const pa = q.map(p => (p[0] - cx) * axis[0] + (p[1] - cz) * axis[1]), pw = q.map(p => -(p[0] - cx) * axis[1] + (p[1] - cz) * axis[0]);
    const L = Math.max(...pa) - Math.min(...pa), W = Math.max(...pw) - Math.min(...pw), mid = (Math.max(...pa) + Math.min(...pa)) / 2;
    const half = Math.max(0, (L - W) / 2);
    const c = [cx + axis[0] * mid, cz + axis[1] * mid];
    return { r0: [c[0] - axis[0] * half, c[1] - axis[1] * half], r1: [c[0] + axis[0] * half, c[1] + axis[1] * half], axis, mid, width: W, cx, cz };
  }

  function create({ THREE: T, scene, plan, height }) {
    const group = new T.Group(); group.name = 'VillageBlocks'; scene.add(group);
    const wallColors = ['#d8c6a6', '#cdb497', '#e0d2b6', '#c4ad8e', '#d4bfa0', '#bfa98a', '#d9cbb0'].map(c => new T.Color(c).convertSRGBToLinear());
    const W = { pos: [], col: [] }, R = { pos: [] }, G = { pos: [] }, L = { pos: [] };
    const houses = [], windows = [];
    const tmpA = new T.Vector3(), tmpB = new T.Vector3(), tmpN = new T.Vector3();
    // Dreieck mit Blick nach außen (hint): Reihenfolge wird bei Bedarf gedreht, damit die Vorderseite außen liegt.
    function tri(buf, a, b, c, hint, color) {
      tmpA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); tmpB.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); tmpN.crossVectors(tmpA, tmpB);
      if (tmpN.x * hint[0] + tmpN.y * hint[1] + tmpN.z * hint[2] < 0) [b, c] = [c, b];
      buf.pos.push(...a, ...b, ...c);
      if (color) for (let i = 0; i < 3; i++) buf.col.push(color.r, color.g, color.b);
    }
    // Häuser, die in eine Fahrbahn ragen, an der Straßenkante abschneiden (die Plan-Grenzen folgen der Straße nur ungefähr)
    const clipLine = (q, o, n) => { const out = [], f = p => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1]; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], fa = f(a), fb = f(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
    const all = [];
    for (const h of plan.blocks.concat(plan.barns || [])) {
      let q = h.p;
      for (const s of plan.streets) for (let i = 0; i < s.p.length - 1 && q.length >= 3; i++) {
        const a = s.p[i], b = s.p[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), need = s.w / 2 + .6;
        let hit = q.some(([x, z]) => segDist(x, z, a, b) < need);
        for (let k = 0; k <= len && !hit; k += 1) { const x = a[0] + (b[0] - a[0]) * k / len, z = a[1] + (b[1] - a[1]) * k / len; hit = inPoly(x, z, q); }
        if (!hit) continue;
        const cx = q.reduce((n, p) => n + p[0], 0) / q.length, cz = q.reduce((n, p) => n + p[1], 0) / q.length;
        let nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
        if ((cx - a[0]) * nx + (cz - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
        q = clipLine(q, [a[0] + nx * need, a[1] + nz * need], [nx, nz]);
      }
      if (q.length >= 3 && Math.abs(area(q)) > 6) all.push({ ...h, p: q });
    }
    // Raster für Nachbarschaft (geteilte Wände) und Kollision
    const CELL = 10, grid = new Map(), key = (i, j) => i + ',' + j;
    for (const h of all) {
      const q = area(h.p) < 0 ? h.p.slice().reverse() : h.p;
      const xs = q.map(p => p[0]), zs = q.map(p => p[1]);
      const house = { q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), floors: h.f, barn: !!h.barn };
      houses.push(house);
      for (let i = Math.floor(house.x0 / CELL); i <= Math.floor(house.x1 / CELL); i++)
        for (let j = Math.floor(house.z0 / CELL); j <= Math.floor(house.z1 / CELL); j++) {
          if (!grid.has(key(i, j))) grid.set(key(i, j), []); grid.get(key(i, j)).push(house);
        }
    }
    const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
    const insideOther = (x, z, self) => near(x, z).some(o => o !== self && inPoly(x, z, o.q));

    for (const h of houses) {
      const q = h.q, ys = q.map(([x, z]) => height(x, z));
      const base = Math.min(...ys) - .8, ground = Math.max(...ys);
      const eave = ground + h.floors * STOREY + .3;
      h.base = base; h.top = eave;
      const color = wallColors[Math.floor(hash(q[0][0], q[0][1]) * wallColors.length)];
      const rg = ridgeOf(q), rise = Math.min(6, rg.width * .48), ridgeY = eave + rise;
      h.top = ridgeY;
      const r0 = [rg.r0[0], ridgeY, rg.r0[1]], r1 = [rg.r1[0], ridgeY, rg.r1[1]];
      const side = p => ((p[0] - rg.cx) * rg.axis[0] + (p[1] - rg.cz) * rg.axis[1]) < rg.mid ? r0 : r1;
      for (let i = 0; i < q.length; i++) {
        const a = q[i], b = q[(i + 1) % q.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < .05) continue;
        const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;   // nach außen (Umlauf gegen den Uhrzeigersinn)
        const out = [nx, 0, nz];
        // Wand
        tri(W, [a[0], base, a[1]], [b[0], base, b[1]], [b[0], eave, b[1]], out, color);
        tri(W, [a[0], base, a[1]], [b[0], eave, b[1]], [a[0], eave, a[1]], out, color);
        // Dachfläche bis zum First
        const ra = side(a), rb = side(b), up = [nx, 1, nz];
        if (ra === rb) tri(R, [a[0], eave, a[1]], [b[0], eave, b[1]], ra, up);
        else { tri(R, [a[0], eave, a[1]], [b[0], eave, b[1]], rb, up); tri(R, [a[0], eave, a[1]], rb, ra, up); }
        // Fenster nur an freien Wänden (keine geteilte Brandwand zum Nachbarhaus)
        if (h.barn || len < 3 || insideOther(mx + nx * .7, mz + nz * .7, h)) continue;
        const n = Math.floor((len - .8) / 2.6), floors = Math.max(1, Math.floor(h.floors + .25));
        for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
          const t = (k + .5) / n, cx = a[0] + (b[0] - a[0]) * t + nx * .04, cz = a[1] + (b[1] - a[1]) * t + nz * .04;
          const y = ground + f * STOREY + 1.45, ux = (b[0] - a[0]) / len * .45, uz = (b[1] - a[1]) / len * .45;
          if (y + .7 > eave) continue;
          const lit = hash(cx, cz + f) < .32, buf = lit ? L : G;
          const p1 = [cx - ux, y - .65, cz - uz], p2 = [cx + ux, y - .65, cz + uz], p3 = [cx + ux, y + .65, cz + uz], p4 = [cx - ux, y + .65, cz - uz];
          tri(buf, p1, p2, p3, out); tri(buf, p1, p3, p4, out);
          if (lit && windows.length < 260 && f === 0 && hash(cz, cx) < .5) windows.push({ x: cx + nx * .3, y, z: cz + nz * .3 });
        }
      }
    }
    const mesh = (buf, material, name) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(buf.pos, 3));
      if (buf.col) g.setAttribute('color', new T.Float32BufferAttribute(buf.col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new T.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
    };
    const wallMat = new T.MeshLambertMaterial({ name: 'house', vertexColors: true });
    const roofMat = new T.MeshLambertMaterial({ name: 'slate', color: new T.Color('#edf1f4').convertSRGBToLinear() });
    const glassMat = new T.MeshLambertMaterial({ name: 'glass', color: new T.Color('#3b4a50').convertSRGBToLinear() });
    const litMat = new T.MeshLambertMaterial({ name: 'litGlass', color: 0x2a1d12, emissive: 0xffb35c, emissiveIntensity: .25 });
    const walls = mesh(W, wallMat, 'BlockWalls'), roofs = mesh(R, roofMat, 'BlockRoofs');
    const glass = mesh(G, glassMat, 'BlockWindows'), lit = mesh(L, litMat, 'BlockWindowsLit');
    glass.castShadow = lit.castShadow = false;

    function blocked(x, z, feet) {
      for (const h of near(x, z)) {
        if (x < h.x0 - .4 || x > h.x1 + .4 || z < h.z0 - .4 || z > h.z1 + .4) continue;
        if (Number.isFinite(feet) && feet > h.top) continue;
        if (inPoly(x, z, h.q) || polyDist(x, z, h.q) < .32) return true;
      }
      return false;
    }
    const occupied = (x, z, margin = 1) => near(x, z).some(h => inPoly(x, z, h.q) || polyDist(x, z, h.q) < margin);
    return {
      group, houses, windows, blocked, occupied,
      targets: () => [walls, roofs],
      setNight(k) { litMat.emissiveIntensity = .25 + .9 * k; }
    };
  }
  root.NachtjagdVillageBlocks = { create, ridgeOf };
})(globalThis);
