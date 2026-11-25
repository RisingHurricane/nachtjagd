'use strict';

// Blockhäuser des Dorfkerns aus village-plan.js (Dorfplan Entwurf G): Wände als Prismen über dem Grundriss,
// Satteldach oder Pultdach mit Schnee, einige Türme mit Spitzhelm, Kamine, Fenster (ein Teil leuchtet nachts warm). Die Häuser sind nicht begehbar; blocked()
// hält Spieler, Monster und Fahrzeuge draußen. Alle Häuser teilen sich wenige zusammengeführte Meshes.
(function (root) {
  const STOREY = 3.15;
  const area = q => { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  function inPoly(x, z, q) { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [a, b] = q[i], [e, f] = q[j]; if ((b > z) !== (f > z) && x < (e - a) * (z - b) / (f - b) + a) c = !c; } return c; }
  function segDist(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
  const polyDist = (x, z, q) => { let m = Infinity; for (let i = 0; i < q.length; i++) m = Math.min(m, segDist(x, z, q[i], q[(i + 1) % q.length])); return m; };
  const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

  // Hauptachse des Grundrisses: der First läuft entlang der längsten Ausdehnung.
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
    const W = { pos: [], col: [] }, R = { pos: [], col: [] }, G = { pos: [] }, L = { pos: [] };
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

    // Dachformen (keine Walmdächer): meist Satteldach mit Giebel, kleine Häuser Pultdach, wenige Häuser mit Turm.
    // Das Dach wird als Höhenfunktion über dem Grundriss beschrieben; Wände laufen bis unter die Dachkante,
    // Giebelwände entstehen dadurch von selbst.
    const snow = new T.Color('#edf1f4').convertSRGBToLinear(), slate = new T.Color('#3a3f47').convertSRGBToLinear();
    const fascia = new T.Color('#4a3a2c').convertSRGBToLinear(), chimney = new T.Color('#6d6a66').convertSRGBToLinear();
    const towerStone = new T.Color('#b9ad99').convertSRGBToLinear(), copper = new T.Color('#5f8a7c').convertSRGBToLinear();
    const towerSpots = [[72, 27], [112, 52], [127, 58], [153, 67], [42, 60], [128, 22], [60, 92], [16, 40], [168, 30]];
    const towerHouses = new Set(towerSpots.map(([x, z]) => houses.reduce((b, h) => {
      const cx = h.q.reduce((n, p) => n + p[0], 0) / h.q.length, cz = h.q.reduce((n, p) => n + p[1], 0) / h.q.length, d = Math.hypot(cx - x, cz - z);
      return !b || d < b.d ? { h, d } : b;
    }, null).h));
    const towers = [];
    const triangulate = q => T.ShapeUtils.triangulateShape(q.map(p => new T.Vector2(p[0], p[1])), []);
    function addTower(cx, cz, r, base, top, spire, sides, roofColor) {
      const ring = [], ring2 = [];
      for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2 + .3; ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); ring2.push([cx + Math.cos(a) * r * 1.18, cz + Math.sin(a) * r * 1.18]); }
      for (let k = 0; k < sides; k++) {
        const a = ring[k], b = ring[(k + 1) % sides], o = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
        tri(W, [a[0], base, a[1]], [b[0], base, b[1]], [b[0], top, b[1]], o, towerStone);
        tri(W, [a[0], base, a[1]], [b[0], top, b[1]], [a[0], top, a[1]], o, towerStone);
        // Schallöffnung bzw. Fenster oben, nachts teils erleuchtet
        if (k % 2 === 0) {
          const m = [(a[0] + b[0]) / 2 + o[0] * .02, (a[1] + b[1]) / 2 + o[2] * .02], u = [(b[0] - a[0]) * .18, (b[1] - a[1]) * .18], y = top - 1.6;
          const buf = hash(m[0], m[1]) < .5 ? L : G;
          tri(buf, [m[0] - u[0], y - .8, m[1] - u[1]], [m[0] + u[0], y - .8, m[1] + u[1]], [m[0] + u[0], y + .8, m[1] + u[1]], o);
          tri(buf, [m[0] - u[0], y - .8, m[1] - u[1]], [m[0] + u[0], y + .8, m[1] + u[1]], [m[0] - u[0], y + .8, m[1] - u[1]], o);
        }
        // Spitzhelm mit Traufkranz
        const c = ring2[k], d = ring2[(k + 1) % sides];
        tri(R, [c[0], top, c[1]], [d[0], top, d[1]], [cx, top + spire, cz], [o[0], .6, o[2]], roofColor);
        tri(R, [a[0], top - .01, a[1]], [d[0], top - .01, d[1]], [c[0], top - .01, c[1]], [0, -1, 0], fascia);
        tri(R, [a[0], top - .01, a[1]], [b[0], top - .01, b[1]], [d[0], top - .01, d[1]], [0, -1, 0], fascia);
      }
      towers.push({ q: ring2, x0: cx - r * 1.2, x1: cx + r * 1.2, z0: cz - r * 1.2, z1: cz + r * 1.2, top: top + spire });
    }

    for (const h of houses) {
      const q = h.q, ys = q.map(([x, z]) => height(x, z));
      const base = Math.min(...ys) - .8, ground = Math.max(...ys);
      const eave = ground + h.floors * STOREY + .3;
      const color = wallColors[Math.floor(hash(q[0][0], q[0][1]) * wallColors.length)];
      const rg = ridgeOf(q), nrm = [-rg.axis[1], rg.axis[0]], c = [rg.cx + rg.axis[0] * rg.mid, rg.cz + rg.axis[1] * rg.mid];
      const dist = p => (p[0] - c[0]) * nrm[0] + (p[1] - c[1]) * nrm[1];
      const ds = q.map(dist), dmin = Math.min(...ds), dmax = Math.max(...ds);
      const shed = Math.abs(area(q)) < 34 || h.barn && hash(c[0], c[1]) < .3;
      let roofY, parts, ridgeY;
      if (shed) {          // Pultdach: eine geneigte Fläche, höher zur Gasse hin zufällig
        const s = .45, flip = hash(c[1], c[0]) < .5 ? 1 : -1;
        roofY = p => eave + s * (flip > 0 ? dmax - dist(p) : dist(p) - dmin);
        ridgeY = eave + s * (dmax - dmin); parts = [q];
      } else {             // Satteldach: First über der Mitte der kurzen Seite, Giebel an den Schmalseiten
        const D = Math.max(-dmin, dmax), rise = Math.min(5.5, D * (h.floors >= 3 ? .95 : 1.1)), s = rise / Math.max(D, .1);
        ridgeY = eave + rise; roofY = p => ridgeY - s * Math.abs(dist(p));
        parts = [clipLine(q, c, nrm), clipLine(q, c, [-nrm[0], -nrm[1]])].filter(p => p.length >= 3);
      }
      h.top = ridgeY; h.base = base;
      // Dachflächen (Schnee), mit leicht dunklem First nicht nötig: Schnee deckt alles
      for (const part of parts) {
        const idx = triangulate(part);
        for (const [i, j, k] of idx) tri(R, [part[i][0], roofY(part[i]), part[i][1]], [part[j][0], roofY(part[j]), part[j][1]], [part[k][0], roofY(part[k]), part[k][1]], [0, 1, 0], snow);
      }
      // Wände bis unter die Dachkante; beim Satteldach am First teilen
      for (let i = 0; i < q.length; i++) {
        const a0 = q[i], b0 = q[(i + 1) % q.length], len = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
        if (len < .05) continue;
        const nx = (b0[1] - a0[1]) / len, nz = -(b0[0] - a0[0]) / len, out = [nx, 0, nz];
        const pieces = [];
        const da = dist(a0), db = dist(b0);
        if (!shed && da * db < 0) { const t = da / (da - db), m = [a0[0] + (b0[0] - a0[0]) * t, a0[1] + (b0[1] - a0[1]) * t]; pieces.push([a0, m], [m, b0]); } else pieces.push([a0, b0]);
        for (const [a, b] of pieces) {
          const ya = roofY(a), yb = roofY(b);
          tri(W, [a[0], base, a[1]], [b[0], base, b[1]], [b[0], yb - .3, b[1]], out, color);
          tri(W, [a[0], base, a[1]], [b[0], yb - .3, b[1]], [a[0], ya - .3, a[1]], out, color);
          tri(W, [a[0], ya - .3, a[1]], [b[0], yb - .3, b[1]], [b[0], yb, b[1]], out, fascia);
          tri(W, [a[0], ya - .3, a[1]], [b[0], yb, b[1]], [a[0], ya, a[1]], out, fascia);
        }
        // Fenster nur an freien Wänden (keine geteilte Brandwand zum Nachbarhaus), auch im Giebel
        const mx = (a0[0] + b0[0]) / 2, mz = (a0[1] + b0[1]) / 2;
        if (h.barn || len < 3 || insideOther(mx + nx * .7, mz + nz * .7, h)) continue;
        const n = Math.floor((len - .8) / 2.6), floors = Math.max(1, Math.floor(h.floors + .25)) + 1;
        for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
          const t = (k + .5) / n, px = a0[0] + (b0[0] - a0[0]) * t, pz = a0[1] + (b0[1] - a0[1]) * t, cx = px + nx * .04, cz = pz + nz * .04;
          const y = ground + f * STOREY + 1.45, ux = (b0[0] - a0[0]) / len * .45, uz = (b0[1] - a0[1]) / len * .45;
          if (y + 1.1 > Math.min(roofY([px - ux * 1.5, pz - uz * 1.5]), roofY([px + ux * 1.5, pz + uz * 1.5]))) continue;
          const lit = hash(cx, cz + f) < .32, buf = lit ? L : G;
          const p1 = [cx - ux, y - .65, cz - uz], p2 = [cx + ux, y - .65, cz + uz], p3 = [cx + ux, y + .65, cz + uz], p4 = [cx - ux, y + .65, cz - uz];
          tri(buf, p1, p2, p3, out); tri(buf, p1, p3, p4, out);
          if (lit && windows.length < 260 && f === 0 && hash(cz, cx) < .5) windows.push({ x: cx + nx * .3, y, z: cz + nz * .3 });
        }
      }
      // Kamin auf etwa jedem dritten Satteldach
      if (!shed && !h.barn && hash(c[0] + 3, c[1]) < .35) {
        const L4 = rg.width, p = [c[0] + rg.axis[0] * (hash(c[0], 7) - .5) * L4 * .5 + nrm[0] * .9, c[1] + rg.axis[1] * (hash(c[0], 7) - .5) * L4 * .5 + nrm[1] * .9];
        if (inPoly(p[0], p[1], q)) {
          const y0 = roofY(p) - .6, y1 = ridgeY + .9, s = .38, cs = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([u, v]) => [p[0] + u, p[1] + v]);
          for (let k = 0; k < 4; k++) { const a = cs[k], b = cs[(k + 1) % 4], o = [(a[0] + b[0]) / 2 - p[0], 0, (a[1] + b[1]) / 2 - p[1]];
            tri(W, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], o, chimney); tri(W, [a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], o, chimney); }
          tri(W, [cs[0][0], y1, cs[0][1]], [cs[1][0], y1, cs[1][1]], [cs[2][0], y1, cs[2][1]], [0, 1, 0], snow);
          tri(W, [cs[0][0], y1, cs[0][1]], [cs[2][0], y1, cs[2][1]], [cs[3][0], y1, cs[3][1]], [0, 1, 0], snow);
        }
      }
      // Turm an ausgewählten Häusern: an der Ecke, die am weitesten vom Hausmittelpunkt entfernt ist
      if (towerHouses.has(h) && !h.barn) {
        const far = q.reduce((b, p) => Math.hypot(p[0] - c[0], p[1] - c[1]) > Math.hypot(b[0] - c[0], b[1] - c[1]) ? p : b, q[0]);
        const r = Math.min(2.6, Math.max(1.8, rg.width * .28)), k = Math.min(.75, Math.max(.3, 1 - r * 1.1 / Math.hypot(far[0] - c[0], far[1] - c[1])));
        const tx = c[0] + (far[0] - c[0]) * k, tz = c[1] + (far[1] - c[1]) * k, round = hash(tx, tz) < .5;
        addTower(tx, tz, r, base, ridgeY + 3 + hash(tz, tx) * 4, r * (round ? 2.2 : 3), round ? 12 : 8, round ? copper : slate);
      }
    }
    for (const t of towers) {
      houses.push(t);
      for (let i = Math.floor(t.x0 / CELL); i <= Math.floor(t.x1 / CELL); i++)
        for (let j = Math.floor(t.z0 / CELL); j <= Math.floor(t.z1 / CELL); j++) { if (!grid.has(key(i, j))) grid.set(key(i, j), []); grid.get(key(i, j)).push(t); }
    }
    const mesh = (buf, material, name) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(buf.pos, 3));
      if (buf.col) g.setAttribute('color', new T.Float32BufferAttribute(buf.col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new T.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
    };
    const wallMat = new T.MeshLambertMaterial({ name: 'house', vertexColors: true });
    const roofMat = new T.MeshLambertMaterial({ name: 'slate', vertexColors: true });
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
