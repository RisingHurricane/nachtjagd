'use strict';

// Begehbare Burg: Kollision und Böden für das Burgmodell (public/models/castle.js und castle-interior.js).
// Reine Rechenlogik ohne Three.js, damit Node-Tests sie prüfen können. Alle Maße stehen in den lokalen
// Koordinaten des Modells (1 Einheit = 1 m, y = 0 ist die Hofplatte). `create` rechnet Weltpunkte um.
//
// Aufbau:
//   solids   feste Körper des Modells (Außenmauern, Türme) aus userData.colliders, dazu der Fels unter der Burg.
//   cells    Räume und Gänge, die aus den Körpern "ausgeschnitten" sind: Rittersaal, Bibliothek, Treppen, Turm.
//            Eine Zelle hat einen Grundriss (has) und eine oder mehrere Bodenhöhen (floors).
//   blockers Möbel und Brüstungen in Räumen, die auch innerhalb einer Zelle blockieren.
// blocked(x, z, feet): der Spieler (Quadrat mit Halbseite RADIUS) darf nicht in einem Körper stehen,
//   außer jede Ecke liegt in einer Zelle auf passender Höhe.
// floor(x, z, feet): höchste Bodenhöhe unter dem Punkt, die man von feet aus erreicht (Stufenhöhe STEP).
(function (root) {
  const RADIUS = 0.34, STEP = 0.72, TAU = Math.PI * 2;
  const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

  // ------------------------------------------------------------------ Zellen
  // Rechteckzelle mit Höhenbereich [yMin, yMax] für die Fußhöhe und fester Bodenhöhe oder Funktion.
  const rect = (id, x0, x1, z0, z1, yMin, yMax, floor) => ({
    id, kind: 'rect', x0, x1, z0, z1, yMin, yMax,
    has: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
    floors: (x, z) => {
      if (x < x0 || x > x1 || z < z0 || z > z1) return [];
      const y = typeof floor === 'function' ? floor(x, z) : floor;
      return y === null || y === undefined ? [] : [y];
    }
  });

  // Der Hauptturm: Wendeltreppe um einen Kern, 176 Stufen à 0,2 m, 15 pro Umdrehung (castle-interior.js).
  const TOWER = { x: -3.5, z: 2.6, stepsPerTurn: 15, steps: 176, rise: 0.2, rIn: 1.2, rOut: 3.3, roomR: 2.8, roomY: 35.2 };
  const stairAngle = (i) => (i % TOWER.stepsPerTurn) * (TAU / TOWER.stepsPerTurn);
  function towerSteps(x, z) {
    const dx = x - TOWER.x, dz = z - TOWER.z, r = Math.hypot(dx, dz);
    if (r < TOWER.rIn || r > TOWER.rOut) return [];
    const da = TAU / TOWER.stepsPerTurn;
    let a = Math.atan2(dx, dz); if (a < 0) a += TAU;
    const m = Math.round(a / da) % TOWER.stepsPerTurn;
    const out = [];
    for (let i = m; i < TOWER.steps; i += TOWER.stepsPerTurn) out.push((i + 1) * TOWER.rise);
    return out;
  }
  // Turmzimmer oben: Sektorboden auf 35,2 m, nur über dem auslaufenden Teil der Treppe (Winkelbereich a1..a2).
  const roomStart = ((TOWER.steps - 1) % TOWER.stepsPerTurn) * (TAU / TOWER.stepsPerTurn) + 0.15;
  const roomEnd = roomStart + TAU / 3;
  function towerRoomFloor(x, z) {
    const dx = x - TOWER.x, dz = z - TOWER.z, r = Math.hypot(dx, dz);
    if (r < 0.95 || r > TOWER.roomR) return null;
    let a = Math.atan2(dx, dz); a = ((a - roomStart) % TAU + TAU) % TAU;
    return a <= roomEnd - roomStart ? TOWER.roomY : null;
  }
  const towerStairs = {
    id: 'turm', kind: 'tower', yMin: -0.7, yMax: TOWER.roomY + 0.6,
    has: (x, z) => { const r = Math.hypot(x - TOWER.x, z - TOWER.z); return r >= TOWER.rIn && r <= TOWER.rOut; },
    floors: (x, z) => {
      const f = towerSteps(x, z), top = towerRoomFloor(x, z);
      if (top !== null) f.push(top);
      return f;
    }
  };
  // Tür zum Turm (Hofseite, +z), Gang durch die Turmwand: Schaft und Treppenhülle.
  const towerDoor = rect('turmtuer', TOWER.x - 1.0, TOWER.x + 1.0, TOWER.z + TOWER.rOut - 0.3, TOWER.z + 4.6, -0.7, 1.2, 0.04);
  // Kern der Treppe
  const towerCore = { id: 'kern', kind: 'circle', x: TOWER.x, z: TOWER.z, r: 1.2, y0: -1, y1: 35.3 };

  // Rittersaal und Bibliothek im Palas, Zwerchgiebel als Vorräume (x -12 und x 5)
  const PALAS = { x0: -15.4, x1: 7.4, z0: -9.9, z1: -2.1 };
  const LIB = 7.4, SAAL_Y = 0.06, STAIR_X = 0.45, STAIR_RISE = 0.4625;
  const stairFloor = (x) => (x < 0 ? null : x >= 7.2 ? LIB : (Math.floor(x / STAIR_X) + 1) * STAIR_RISE);
  const cells = [
    rect('saal', PALAS.x0, PALAS.x1, PALAS.z0, PALAS.z1, -0.7, 1.4, SAAL_Y),
    rect('treppe-saal', 0, 7.4, -9.9, -8.4, -0.7, LIB + 0.8, (x) => stairFloor(x)),
    rect('bibliothek-west', PALAS.x0, -0.2, PALAS.z0, PALAS.z1, LIB - 0.8, LIB + 1.4, LIB + 0.0),
    rect('bibliothek-ost', -0.2, PALAS.x1, -8.4, PALAS.z1, LIB - 0.8, LIB + 1.4, LIB),
    rect('vorraum-west', -14.4, -9.6, -0.9, 0.9, -0.7, 1.4, 0.04),
    rect('vorraum-ost', 2.6, 7.4, -0.9, 0.9, -0.7, 1.4, 0.04),
    rect('tor-west', -13.1, -10.9, 0.5, 1.7, -0.7, 1.4, 0.04),
    rect('tor-ost', 3.9, 6.1, 0.5, 1.7, -0.7, 1.4, 0.04),
    rect('gang-west', -13.1, -10.9, -2.3, -0.5, -0.7, 1.4, 0.05),
    rect('gang-ost', 3.9, 6.1, -2.3, -0.5, -0.7, 1.4, 0.05),
    towerStairs, towerDoor
  ];

  // ------------------------------------------------------------------ Möbel und Brüstungen
  // y0/y1: Höhenbereich in lokalen Koordinaten (Oberkante, gegen die Fußhöhe verglichen).
  const bl = (id, x0, x1, z0, z1, y0, y1) => ({ id, kind: 'rect', x0, x1, z0, z1, y0, y1 });
  const blockers = [
    bl('tafel', -9.5, 1.5, -7.5, -4.5, 0, 1.0),
    bl('kamin-west', -15.4, -14.2, -8.2, -3.8, 0, 4),
    bl('kamin-ost', 6.5, 7.4, -5.4, -2.4, 0, 3.2),
    bl('sessel-west', -10.5, -9.7, -6.35, -5.65, 0, 1.3),
    bl('sessel-ost', 1.7, 2.5, -6.35, -5.65, 0, 1.3),
    bl('schreibtisch', -6.4, -3.6, -4.8, -3.6, LIB, LIB + 0.9),
    bl('truhe', 3.7, 5.3, -3.4, -2.6, LIB, LIB + 0.7),
    bl('gelaender', -0.2, 6.0, -8.58, -8.34, LIB, LIB + 1.1)
  ];

  // ------------------------------------------------------------------ Fels und Grundrissumriss
  const ROCK = [
    [-24, -6], [-21, -13], [-12, -19], [-6, -24.5], [4, -24.5], [8, -19], [14, -18], [15, -12],
    [23, -10], [28, 0], [27.5, 13], [26, 21.5], [17, 23.8], [8, 23.5], [-2, 23.3], [-12, 23.8],
    [-18, 23], [-24, 17], [-24.5, 4]
  ];
  function inPolygon(poly, x, z) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
  function edgeDistance(poly, x, z) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  }

  // ------------------------------------------------------------------ Körper des Modells
  function solidOf(c) {
    const h = c.h === undefined ? 10 : c.h;
    if (c.type === 'circle') return { kind: 'circle', x: c.x, z: c.z, r: c.r, y0: 0, y1: h };
    return { kind: 'box', x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2, rot: c.rot || 0, y0: 0, y1: h };
  }
  function insideSolid(s, x, z) {
    if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) < s.r;
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.rot), n = Math.sin(s.rot);
    return Math.abs(dx * c - dz * n) < s.hw && Math.abs(dx * n + dz * c) < s.hd;
  }

  // origin: Weltposition der Modellmitte, y der Hofplatte; rot: Drehung des Modells um y (wie Object3D.rotation.y).
  function create({ colliders = [], origin = { x: 0, z: 0, y: 0 }, rot = 0 } = {}) {
    const solids = colliders.map(solidOf);
    // Die Türme und der Palas sind nur teilweise massiv: Zellen schneiden sie aus. Der Fels unter der Burg
    // ist massiv (Keller werden später als Zellen herausgeschnitten).
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const toLocal = (x, z) => ({ x: (x - origin.x) * cr - (z - origin.z) * sr, z: (x - origin.x) * sr + (z - origin.z) * cr });
    const toWorld = (lx, lz) => ({ x: origin.x + lx * cr + lz * sr, z: origin.z - lx * sr + lz * cr });
    const REACH = 60;

    function cellHas(x, z, fy) {
      for (const c of cells) if (fy >= c.yMin && fy <= c.yMax && c.has(x, z)) return true;
      return false;
    }
    function blockedLocal(lx, lz, fy) {
      const pts = [[lx, lz], [lx - RADIUS, lz - RADIUS], [lx + RADIUS, lz - RADIUS], [lx - RADIUS, lz + RADIUS], [lx + RADIUS, lz + RADIUS]];
      for (const b of blockers) {
        if (fy + 0.3 >= b.y1 || fy + 1.8 <= b.y0) continue;
        for (const [px, pz] of pts) if (px > b.x0 - 0.0 && px < b.x1 && pz > b.z0 && pz < b.z1) return true;
      }
      if (fy + 0.3 < towerCore.y1 && Math.hypot(lx - towerCore.x, lz - towerCore.z) < towerCore.r + RADIUS * 0.8) return true;
      for (const s of solids) {
        if (fy + 0.3 >= s.y1 || fy + 1.8 <= s.y0) continue;
        for (const [px, pz] of pts) if (insideSolid(s, px, pz) && !cellHas(px, pz, fy)) return true;
      }
      return false;
    }
    function floorLocal(lx, lz, fy) {
      let best = null, ground = false;
      const consider = (y, isGround) => { if (y <= fy + STEP && (best === null || y > best)) { best = y; ground = isGround; } };
      for (const c of cells) for (const y of c.floors(lx, lz)) consider(y, false);
      if (inPolygon(ROCK, lx, lz)) {
        // Hofplatte: am Rand läuft sie 3 m lang aus, damit keine Stufe zum Gelände bleibt.
        const e = edgeDistance(ROCK, lx, lz);
        consider(-Math.max(0, 3 - e) * 0.2, true);
      }
      return best === null ? null : { y: best, ground };
    }
    return {
      origin, rot, solids, cells, blockers, toLocal, toWorld,
      near: (x, z) => Math.hypot(x - origin.x, z - origin.z) < REACH,
      // Blockiert die Burg den Punkt (Weltkoordinaten, feet = Weltfußhöhe)?
      blocked(x, z, feet) {
        if (Math.hypot(x - origin.x, z - origin.z) > REACH) return false;
        const p = toLocal(x, z);
        return blockedLocal(p.x, p.z, feet - origin.y);
      },
      // Bodenhöhe unter dem Punkt: { y, ground } oder null. ground = Hofplatte (mit dem Gelände zu vereinen).
      floor(x, z, feet) {
        if (Math.hypot(x - origin.x, z - origin.z) > REACH) return null;
        const p = toLocal(x, z), f = floorLocal(p.x, p.z, feet - origin.y);
        return f ? { y: f.y + origin.y, ground: f.ground } : null;
      },
      inside(x, z) { const p = toLocal(x, z); return inPolygon(ROCK, p.x, p.z); },
      blockedLocal, floorLocal, cellHas
    };
  }

  const api = { create, rect, TOWER, PALAS, LIB, RADIUS, STEP, ROCK, inPolygon, edgeDistance, towerSteps, towerRoomFloor, stairFloor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdCastleWalk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
