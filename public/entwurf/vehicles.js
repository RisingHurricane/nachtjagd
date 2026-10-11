/* Fahrzeuge für den Geländeentwurf: Geländewagen, Lore auf Schienen, Gondel, Ruderboot.
   Reine Physik und Fahrpläne ohne Darstellung, übernommen aus dem Altay-Import (nachtjagd-neu).
   Koordinaten wie im Spielkern: Blickrichtung ist (sin yaw, cos yaw), ein positiver yaw dreht nach links.
   Sitzplätze liegen in Fahrzeugkoordinaten: x seitlich (positiv rechts), y hoch, z vorn.
   Die Welt liefert über den Adapter: jeeps, boats, rails, carts, gondola, waterLevel, boatOk, onRoad. */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = v => Number.isFinite(v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  const KINDS = {
    jeep: { name: 'Geländewagen', seats: 4 },
    cart: { name: 'Lore', seats: 4 },
    gondola: { name: 'Gondel', seats: 4 },
    boat: { name: 'Ruderboot', seats: 1 }
  };
  const SEATS = {
    jeep: [[-0.43, 0.78, -0.10], [0.43, 0.78, -0.10], [-0.43, 0.83, -1.15], [0.43, 0.83, -1.15]],
    cart: [[-0.3, 0.25, 0.35], [0.3, 0.25, 0.35], [-0.3, 0.3, -0.45], [0.3, 0.3, -0.45]],
    gondola: [[-0.68, 0.2, 0.55], [0.68, 0.2, 0.55], [-0.68, 0.2, -0.55], [0.68, 0.2, -0.55]],
    boat: [[0, -0.5, 0]]
  };
  const SEAT_NAMES = ['Fahrer', 'Beifahrer', 'Hinten links', 'Hinten rechts'];
  const EYE = { jeep: 1.06, gondola: 1.06, cart: 1.7, boat: 1.7 };
  const JEEP = { wheelBase: 2.51, halfWidth: 0.96, front: 1.24, back: 1.27 };
  // Gondelfahrplan: 8 s Halt, 46 s Fahrt, 8 s Halt, 46 s zurück.
  const GONDOLA = { halt: 8, trip: 46, cycle: 108, steps: 80, lane: 2.15, arch: 9 };

  // Welt-Koordinate eines Punktes in Fahrzeugkoordinaten (lx rechts, lz vorn).
  function toWorld(x, z, yaw, lx, lz) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return [x - c * lx + s * lz, z + s * lx + c * lz];
  }

  function seatPose(v, index) {
    const s = SEATS[v.kind][index];
    const p = toWorld(v.x, v.z, v.yaw, s[0], s[2]);
    return { x: p[0], y: v.y + s[1], z: p[1] };
  }

  // ------------------------------------------------------------------ Aufbau
  function create(world, floorAt) {
    const vehicles = [];
    const info = { rails: null, gondola: null };
    const add = (kind, data) => {
      const v = {
        id: ({ jeep: 'jeep-', cart: 'lore-', gondola: 'gondel-', boat: 'boot-' })[kind] + vehicles.filter(o => o.kind === kind).length,
        kind, name: KINDS[kind].name, x: 0, y: 0, z: 0, yaw: 0, sp: 0, pitch: 0, roll: 0,
        seats: new Array(KINDS[kind].seats).fill(null), ...data
      };
      v.init = JSON.parse(JSON.stringify({ x: v.x, y: v.y, z: v.z, yaw: v.yaw, edge: v.edge, t: v.t, dir: v.dir, phase: v.phase }));
      vehicles.push(v);
      return v;
    };

    for (const j of world.jeeps || []) {
      const y = floorAt(j.x, j.z, 0);
      add('jeep', { x: j.x, z: j.z, y, yaw: j.yaw || 0, steer: 0, yawRate: 0 });
    }

    const nodes = world.rails && world.rails.nodes ? world.rails.nodes.map((n, i) => ({ id: i, x: n.x, z: n.z })) : [];
    const links = world.rails && world.rails.links ? world.rails.links.map((l, i) => {
      const a = nodes[l[0]], b = nodes[l[1]];
      return { id: i, a: l[0], b: l[1], length: Math.hypot(b.x - a.x, b.z - a.z), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }) : [];
    info.rails = { nodes, links };
    for (const c of world.carts || []) {
      const l = links[c.link];
      if (!l) continue;
      const v = add('cart', { edge: c.link, t: clamp(c.t || 0, 0, l.length), dir: c.dir < 0 ? -1 : 1, choice: 0, L: l.length });
      placeCart(v, info.rails, floorAt, 1);
      v.init.x = v.x; v.init.y = v.y; v.init.z = v.z; v.init.yaw = v.yaw;
    }

    if (world.gondola && world.gondola.stations && world.gondola.stations.length === 2) {
      const [a, b] = world.gondola.stations.map(s => ({ ...s, y: finite(s.y) ? s.y : floorAt(s.x, s.z, 0) }));
      const path = [];
      for (let k = 0; k <= GONDOLA.steps; k++) {
        const t = k / GONDOLA.steps, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
        path.push({ x, z, y: Math.max(lerp(a.y, b.y, t) + 0.12, floorAt(x, z, lerp(a.y, b.y, t)) + GONDOLA.arch * Math.pow(Math.sin(Math.PI * t), 0.65)) });
      }
      info.gondola = { stations: [a, b], path, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
      for (const [phase, lane] of [[0, -1], [54, 1]]) {
        const v = add('gondola', { phase, lane });
        poseGondola(v, info.gondola);
        v.init.x = v.x; v.init.y = v.y; v.init.z = v.z; v.init.yaw = v.yaw;
      }
    }

    for (const b of world.boats || []) {
      add('boat', { x: b.x, z: b.z, y: finite(world.waterLevel) ? world.waterLevel : 0, yaw: b.yaw || 0, ph: 0 });
    }
    return { vehicles, info };
  }

  // ------------------------------------------------------------------ Geländewagen
  const onRoad = (world, x, z) => typeof world.onRoad === 'function' ? !!world.onRoad(x, z) : false;

  // Fußabdruck des Wagens (Mitte, vier Ecken, Bug und Heck) gegen Hindernisse prüfen.
  function jeepBlocked(world, x, z, yaw, y) {
    for (const [lx, lz] of [[0, 0], [0, 2.0], [0, -2.0], [0.95, 1.9], [-0.95, 1.9], [0.95, -1.9], [-0.95, -1.9]]) {
      const p = toWorld(x, z, yaw, lx, lz);
      if (world.blocked(p[0], p[1], y)) return true;
    }
    return false;
  }

  function driveJeep(v, dt, c, ctx) {
    const { world, floorAt } = ctx;
    if (dt <= 0) return;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps, oldSpeed = v.sp;
    for (let i = 0; i < steps; i++) {
      const grip = onRoad(world, v.x, v.z) ? 0.92 : 0.57;
      const maxSteer = 0.65 / (1 + Math.pow(Math.abs(v.sp) / 16, 1.6));
      v.steer = lerp(v.steer || 0, c.steer * maxSteer, 1 - Math.exp(-h * 14));
      const s = Math.sin(v.yaw), co = Math.cos(v.yaw);
      const grade = (floorAt(v.x + s * 1.25, v.z + co * 1.25, v.y) - floorAt(v.x - s * 1.25, v.z - co * 1.25, v.y)) / 2.5;
      const forward = c.forward && !c.reverse, reverse = c.reverse && !c.forward;
      const opposing = (forward && v.sp < -0.25) || (reverse && v.sp > 0.25);
      let force = 0;
      if (opposing) force = -Math.sign(v.sp) * 13;
      else if (forward) force = 7.2 * (1 - Math.min(0.52, Math.abs(v.sp) / 34));
      else if (reverse) force = -5.2 * (1 - Math.min(0.5, Math.abs(v.sp) / 14));
      const serviceBrake = v.seats[0] === null || c.brake || (c.forward && c.reverse) || (!forward && !reverse && Math.abs(v.sp) < 0.05);
      const brakes = serviceBrake ? 17 : opposing ? 0 : (forward || reverse) ? 0.22 : 1.25;
      force -= 9.81 * Math.sin(Math.atan(grade)) * 0.5;
      const prior = v.sp;
      v.sp = clamp((v.sp + force * h) * Math.exp(-brakes * h), -7.5, 22);
      if (opposing && prior * v.sp <= 0) v.sp = 0;
      if (Math.abs(v.sp) < (serviceBrake ? 0.24 : 0.04)) v.sp = 0;
      const ideal = v.sp / JEEP.wheelBase * Math.tan(v.steer), maxYaw = grip * 9.81 / Math.max(Math.abs(v.sp), 3);
      v.yawRate = lerp(v.yawRate || 0, clamp(ideal, -maxYaw, maxYaw), 1 - Math.exp(-h * 12));
      v.yaw += v.yawRate * h;
      const nx = v.x + Math.sin(v.yaw) * v.sp * h, nz = v.z + Math.cos(v.yaw) * v.sp * h;
      const surface = floorAt(nx, nz, v.y), run = Math.hypot(nx - v.x, nz - v.z);
      const steep = Math.abs(surface - v.y) > 0.9 * run + 0.02 && Math.abs(surface - v.y) > 0.05;
      if (!finite(surface) || Math.abs(surface - v.y) > 1 || steep || jeepBlocked(world, nx, nz, v.yaw, surface)) {
        v.sp = 0; v.yawRate *= 0.35; break;
      }
      v.x = nx; v.z = nz; v.y = surface;
    }
    settleJeep(v, dt, clamp((v.sp - oldSpeed) / dt, -14, 8), ctx);
  }

  // Neigung aus vier Bodenproben; positives pitch senkt den Bug, positives roll hebt die linke Seite.
  function settleJeep(v, dt, acceleration, ctx) {
    const sample = (lx, lz) => { const p = toWorld(v.x, v.z, v.yaw, lx, lz); return ctx.floorAt(p[0], p[1], v.y); };
    const w = JEEP.halfWidth;
    const front = (sample(-w, JEEP.front) + sample(w, JEEP.front)) / 2, back = (sample(-w, -JEEP.back) + sample(w, -JEEP.back)) / 2;
    const left = (sample(-w, JEEP.front) + sample(-w, -JEEP.back)) / 2, right = (sample(w, JEEP.front) + sample(w, -JEEP.back)) / 2;
    const pitch = clamp(Math.atan2(back - front, JEEP.front + JEEP.back) - acceleration * 0.006, -0.38, 0.38);
    const roll = clamp(Math.atan2(left - right, w * 2) + v.sp * (v.yawRate || 0) * 0.009, -0.22, 0.22);
    const k = dt > 0 ? 1 - Math.exp(-dt * 9) : 1;
    v.pitch = lerp(v.pitch || 0, pitch, k); v.roll = lerp(v.roll || 0, roll, k);
  }

  // ------------------------------------------------------------------ Lore
  function railEnds(rails, v) {
    const l = rails.links[v.edge];
    return { l, a: rails.nodes[l.a], b: rails.nodes[l.b] };
  }
  function placeCart(v, rails, floorAt, k) {
    const { l, a, b } = railEnds(rails, v), t = clamp(v.t / l.length, 0, 1);
    v.x = lerp(a.x, b.x, t); v.z = lerp(a.z, b.z, t); v.L = l.length;
    v.y = floorAt(v.x, v.z, v.y) + 0.18;
    const target = l.yaw + (v.dir < 0 ? Math.PI : 0);
    v.yaw += angDiff(target, v.yaw) * k;
    const f = floorAt(v.x + Math.sin(v.yaw) * 0.9, v.z + Math.cos(v.yaw) * 0.9, v.y), r = floorAt(v.x - Math.sin(v.yaw) * 0.9, v.z - Math.cos(v.yaw) * 0.9, v.y);
    v.pitch = Math.atan2(r - f, 1.8);
    return l;
  }
  // Weiche: Wahl nach Fahrtrichtung. choice -1 links, 1 rechts, 0 möglichst geradeaus.
  function nextRail(v, nodeId, rails) {
    const options = rails.links.filter(l => (l.a === nodeId || l.b === nodeId) && l.id !== v.edge);
    if (!options.length) return null;
    const node = rails.nodes[nodeId], cur = rails.links[v.edge];
    const travelYaw = cur.yaw + (v.dir < 0 ? Math.PI : 0) + (v.sp < 0 ? Math.PI : 0);
    const dx = Math.sin(travelYaw), dz = Math.cos(travelYaw);
    const turn = l => {
      const o = rails.nodes[l.a === nodeId ? l.b : l.a], ex = o.x - node.x, ez = o.z - node.z, D = Math.hypot(ex, ez) || 1;
      return Math.atan2(dx * (ez / D) - dz * (ex / D), dx * (ex / D) + dz * (ez / D));
    };
    const sorted = options.slice().sort((p, q) => turn(p) - turn(q));
    if (v.choice < 0) return sorted[0];
    if (v.choice > 0) return sorted[sorted.length - 1];
    return sorted.reduce((best, l) => Math.abs(turn(l)) < Math.abs(turn(best)) ? l : best, sorted[0]);
  }
  function driveCart(v, dt, c, ctx) {
    const rails = ctx.info.rails;
    const accel = (c.forward ? 1 : 0) - (c.reverse ? 1 : 0);
    v.sp = clamp((v.sp + accel * 7 * dt) * Math.exp(-(c.brake ? 12 : accel ? 0.18 : 1.1) * dt), -9, 13);
    if (c.steer > 0.3) v.choice = -1; else if (c.steer < -0.3) v.choice = 1;
    let l = rails.links[v.edge];
    v.t += v.sp * v.dir * dt;
    if (v.t < 0 || v.t > l.length) {
      const atStart = v.t < 0, endId = atStart ? l.a : l.b, overflow = atStart ? -v.t : v.t - l.length;
      const next = nextRail(v, endId, rails);
      if (next) {
        const fromA = next.a === endId;
        v.edge = next.id; v.dir = (fromA ? 1 : -1) * (v.sp < 0 ? -1 : 1);
        v.t = fromA ? overflow : next.length - overflow; v.choice = 0;
      } else {
        v.dir *= -1; v.t = atStart ? Math.min(l.length, overflow) : Math.max(0, l.length - overflow); v.choice = 0;
      }
    }
    placeCart(v, rails, ctx.floorAt, 1 - Math.exp(-dt * 12));
  }

  // ------------------------------------------------------------------ Gondel
  function gondolaPhase(v) { return ((v.phase || 0) % GONDOLA.cycle + GONDOLA.cycle) % GONDOLA.cycle; }
  // 0 an der Talstation, 1 an der Bergstation, null unterwegs.
  function gondolaDock(v) {
    const p = gondolaPhase(v);
    return p < GONDOLA.halt ? 0 : p >= 54 && p < 62 ? 1 : null;
  }
  function gondolaWait(v) {
    const p = gondolaPhase(v);
    return p < GONDOLA.halt ? GONDOLA.halt - p : p >= 54 && p < 62 ? 62 - p : 0;
  }
  function poseGondola(v, g) {
    const p = gondolaPhase(v), h = GONDOLA.halt, trip = GONDOLA.trip;
    const t = p < h ? 0 : p < h + trip ? (p - h) / trip : p < 62 ? 1 : 1 - (p - 62) / trip;
    const k = Math.min(GONDOLA.steps - 1, Math.floor(t * GONDOLA.steps)), f = t * GONDOLA.steps - k, a = g.path[k], b = g.path[k + 1];
    const lane = v.lane || 1, s = Math.sin(g.yaw), c = Math.cos(g.yaw);
    v.x = lerp(a.x, b.x, f) - c * lane * GONDOLA.lane; v.z = lerp(a.z, b.z, f) + s * lane * GONDOLA.lane;
    v.y = lerp(a.y, b.y, f); v.yaw = g.yaw;
  }
  function driveGondola(v, dt, ctx) {
    const ox = v.x, oy = v.y, oz = v.z;
    v.phase = (v.phase + dt) % GONDOLA.cycle;
    poseGondola(v, ctx.info.gondola);
    v.sp = dt ? Math.hypot(v.x - ox, v.y - oy, v.z - oz) / dt : 0;
    v.dock = gondolaDock(v);
  }

  // ------------------------------------------------------------------ Boot
  const boatOk = (world, x, z) => typeof world.boatOk === 'function' ? !!world.boatOk(x, z) : (typeof world.waterDepth === 'function' && world.waterDepth(x, z) > 0.45);
  function driveBoat(v, dt, c, ctx) {
    const world = ctx.world, f = clamp(c.forward ? 1 : c.reverse ? -1 : 0, -1, 1);
    const target = v.seats[0] !== null ? (f > 0 ? f : f * 0.5) * (c.sprint ? 4.8 : 3.3) : 0;
    v.sp += (target - v.sp) * Math.min(1, dt * (target !== 0 ? 1.2 : 0.6));
    const turn = v.seats[0] !== null ? c.steer : 0;
    v.yaw += turn * dt * (0.5 + 0.28 * Math.min(1, Math.abs(v.sp) / 3.3)) * (v.sp < -0.2 ? -1 : 1);
    const hx = Math.sin(v.yaw), hz = Math.cos(v.yaw), nx = v.x + hx * v.sp * dt, nz = v.z + hz * v.sp * dt;
    if (boatOk(world, nx, nz) && boatOk(world, nx + hx * 1.4, nz + hz * 1.4) && boatOk(world, nx - hx * 1.3, nz - hz * 1.3)) { v.x = nx; v.z = nz; }
    else { if (Math.abs(v.sp) > 1.2) v.bump = true; v.sp *= -0.3; }
    v.y = finite(world.waterLevel) ? world.waterLevel : v.y;
    v.ph = (v.ph || 0) + Math.abs(v.sp) * dt * 1.9;
  }

  // ------------------------------------------------------------------ Sammelschritt
  // Steuerung aus der Spielereingabe (nur der Fahrer, sonst leer).
  function controls(input, driver) {
    if (!driver) return { forward: false, reverse: false, steer: 0, brake: true, sprint: false };
    const f = clamp(input.forward || 0, -1, 1), s = clamp(input.side || 0, -1, 1), turn = clamp(input.turn || 0, -0.8, 0.8);
    return { forward: f > 0.2, reverse: f < -0.2, steer: Math.abs(s) > 0.1 ? -s : turn, brake: !!(input.brake || input.jump), sprint: !!input.sprint };
  }
  function step(fleet, dt, ctx, inputOf) {
    for (const v of fleet.vehicles) {
      const driver = v.seats[0] !== null;
      const c = controls(inputOf ? inputOf(v) : {}, driver);
      if (v.kind === 'jeep') driveJeep(v, dt, c, ctx);
      else if (v.kind === 'cart') { c.brake = c.brake && driver; driveCart(v, dt, driver ? c : { forward: false, reverse: false, steer: 0, brake: false }, ctx); }
      else if (v.kind === 'gondola') driveGondola(v, dt, ctx);
      else driveBoat(v, dt, c, ctx);
    }
  }

  // ------------------------------------------------------------------ Aussteigen
  function exitSpot(v, ctx) {
    const { world, floorAt } = ctx;
    if (v.kind === 'gondola') {
      const dock = gondolaDock(v);
      if (dock === null) return null;
      const s = ctx.info.gondola.stations[dock];
      for (const r of [3, 4.5, 6, 8]) for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, y = floorAt(x, z, s.y);
        if (Math.abs(y - s.y) <= 1.7 && !world.blocked(x, z, y)) return { x, y, z };
      }
      return null;
    }
    const radii = v.kind === 'boat' ? [2.2, 3.3, 4.6, 6.2] : [2.5, 3.5, 4.5];
    let best = null, bestD = Infinity;
    for (const r of radii) for (let k = 0; k < 24; k++) {
      const a = k * TAU / 24, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r, y = floorAt(x, z, v.y + 0.8);
      const reach = v.kind === 'boat' ? 2.6 : 1.7;
      if (!finite(y) || Math.abs(y - v.y) > reach || world.blocked(x, z, y)) continue;
      if (v.kind === 'boat' && boatOk(world, x, z)) continue;
      if (r < bestD) { bestD = r; best = { x, y, z }; }
    }
    return best;
  }

  root.NachtjagdVehicles = { KINDS, SEATS, SEAT_NAMES, EYE, JEEP, GONDOLA, create, step, seatPose, exitSpot, gondolaDock, gondolaWait, controls, onRoad, boatOk };
})(typeof globalThis !== 'undefined' ? globalThis : window);
