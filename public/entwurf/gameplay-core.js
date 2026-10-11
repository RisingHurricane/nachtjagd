/* Kleine, rendererunabhängige Solospiel-Logik für den neuen Geländeentwurf. */
(function (root) {
  'use strict';

  const WDEF = [
    { name: 'Revolver', mag: 6, dmg: 38, rate: 0.36, pellets: 1, spread: 0.006, reload: 2.1, range: 150, res: 30, max: 90, pick: 12 },
    { name: 'Schrotflinte', mag: 6, dmg: 11, rate: 0.85, pellets: 9, spread: 0.05, reload: 2.7, range: 70, res: 12, max: 48, pick: 6 },
    { name: 'Jagdgewehr', mag: 5, dmg: 110, rate: 1.05, pellets: 1, spread: 0.0012, reload: 2.9, range: 240, res: 10, max: 40, pick: 5 }
  ];
  const ENEMIES = {
    villager: { hp: 70, speed: 2.4, damage: 11, range: 1.9, wind: 0.55, cd: 1.3, score: 100, lei: 14, radius: 0.5 },
    lycan: { hp: 90, speed: 4, damage: 13, range: 2.1, wind: 0.45, cd: 1.1, score: 180, lei: 28, radius: 0.55 },
    wolf: { hp: 55, speed: 5.6, damage: 10, range: 1.8, wind: 0.3, cd: 0.85, score: 150, lei: 20, radius: 0.6 }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = v => Number.isFinite(v);

  function create(options) {
    options = options || {};
    const world = options.world;
    const random = options.random || Math.random;
    if (!world || typeof world.floor !== 'function' || typeof world.blocked !== 'function') {
      throw new TypeError('world.floor und world.blocked sind erforderlich');
    }
    const start = typeof world.spawn === 'function' ? world.spawn() : world.spawn;
    if (!Array.isArray(start) || start.length < 2 || !start.every(finite)) throw new TypeError('world.spawn muss [x,z] liefern');
    const initialY = world.floor(start[0], start[1], 0);
    const state = {
      phase: 'ready', player: { x: start[0], y: initialY, z: start[1], yaw: 0, pitch: 0, hp: 100, maxHp: 100 },
      weapons: WDEF.map((w, i) => ({ ...w, owned: i === 0, ammo: w.mag, reserve: w.res, reloading: 0 })),
      current: 0, waves: { n: 0, state: 'idle', timer: 3.5, toSpawn: 0, alive: 0, total: 0, spawnT: 0, finalT: 0 },
      monsters: [], items: [], quest: { stage: 'seals', got: [], objectives: [], bell: null }, stats: { kills: 0, head: 0, score: 0, lei: 0 }
    };
    state.quest.objectives = (world.objectives || []).map(o => ({ ...o, found: false }));
    state.quest.bell = world.bell ? { ...world.bell } : null;
    let cooldown = 0;
    let swapTimer = 0;
    let nextId = 1;
    const events = [];
    const emit = (type, data = {}) => events.push({ type, ...data });

    function spawnPosition() {
      if (typeof world.spawnEnemy === 'function') {
        const p = world.spawnEnemy({ ...state.player }, random);
        if (!Array.isArray(p) || p.length < 2 || !p.every(finite)) return null;
        const y = world.floor(p[0], p[1], state.player.y);
        if (!finite(y) || world.blocked(p[0], p[1], y)) return null;
        return p;
      }
      for (let tries = 0; tries < 40; tries++) {
        const a = random() * Math.PI * 2, r = 24 + random() * 18;
        const x = state.player.x + Math.sin(a) * r, z = state.player.z + Math.cos(a) * r;
        const y = world.floor(x, z, state.player.y);
        if (finite(y) && !world.blocked(x, z, y)) return [x, z];
      }
      return null;
    }
    function spawnEnemy() {
      const p = spawnPosition();
      if (!p) return false;
      const n = state.waves.n;
      let kind = 'villager';
      const lycanWeight = n >= 2 ? 1.4 + n * 0.6 : 0;
      const wolfWeight = n >= 3 ? 1.2 + n * 0.3 : 0;
      const villagerWeight = Math.max(2.5, 9 - n * 1.1);
      const roll = random() * (villagerWeight + lycanWeight + wolfWeight);
      if (roll >= villagerWeight + lycanWeight) kind = 'wolf';
      else if (roll >= villagerWeight) kind = 'lycan';
      const spec = ENEMIES[kind];
      const y = world.floor(p[0], p[1], state.player.y);
      if (!finite(y) || world.blocked(p[0], p[1], y)) return false;
      state.monsters.push({ id: nextId++, kind, x: p[0], z: p[1], y, hp: spec.hp, state: 'walk', attack: 0, wind: 0, hit: 0 });
      state.waves.alive++;
      emit('spawn', { kind });
      return true;
    }
    function kill(monster, head) {
      monster.state = 'dead';
      state.waves.alive = Math.max(0, state.waves.alive - 1);
      state.stats.kills++;
      state.stats.score += Math.round(ENEMIES[monster.kind].score * (head ? 1.5 : 1));
      state.stats.lei += Math.round(ENEMIES[monster.kind].lei * (head ? 1.3 : 1));
      emit('kill', { kind: monster.kind, head: !!head, score: state.stats.score, lei: state.stats.lei });
      const dropRoll = random();
      if (state.items.length < 64 && dropRoll < 0.24) state.items.push({ type: 'ammo', x: monster.x, z: monster.z });
      else if (state.items.length < 64 && dropRoll < 0.36) state.items.push({ type: 'health', x: monster.x, z: monster.z });
    }
    function startWave() {
      const w = state.waves;
      w.n++; w.total = Math.min(6 + w.n * 3, 46); w.toSpawn = w.total; w.alive = 0; w.state = 'active'; w.spawnT = 1;
      emit('notice', { text: `Welle ${w.n}`, wave: w.n });
    }
    function movePlayer(dt, input) {
      const f = clamp(input.forward || 0, -1, 1), s = clamp(input.side || 0, -1, 1);
      let dx = Math.sin(state.player.yaw) * f - Math.cos(state.player.yaw) * s;
      let dz = Math.cos(state.player.yaw) * f + Math.sin(state.player.yaw) * s;
      const length = Math.hypot(dx, dz);
      if (length > 1) { dx /= length; dz /= length; }
      const speed = (input.sprint && f > 0 && !input.aim ? 10.4 : 6.3) * (input.aim ? 0.55 : 1);
      dx *= speed * dt; dz *= speed * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
      const sx = dx / steps, sz = dz / steps;
      for (let i = 0; i < steps; i++) {
        const p = state.player, nx = p.x + sx, nz = p.z + sz;
        const ny = world.floor(nx, nz, p.y);
        if (finite(ny) && ny <= p.y + 0.45 + Math.hypot(sx, sz) * 1.3 && !world.blocked(nx, nz, ny)) { p.x = nx; p.z = nz; p.y = ny; }
        else {
          const ax = p.x + sx, ay = world.floor(ax, p.z, p.y);
          if (finite(ay) && ay <= p.y + 0.45 + Math.abs(sx) * 1.3 && !world.blocked(ax, p.z, ay)) { p.x = ax; p.y = ay; }
          const az = p.z + sz, azY = world.floor(p.x, az, p.y);
          if (finite(azY) && azY <= p.y + 0.45 + Math.abs(sz) * 1.3 && !world.blocked(p.x, az, azY)) { p.z = az; p.y = azY; }
        }
      }
    }
    // Gegner weichen Hindernissen (Stämme, Hausecken) seitlich aus: erst geradeaus, dann in wachsenden
    // Winkeln zu einer Seite, die sie sich merken. Danach bleibt das Gleiten entlang einer Achse.
    const TURNS = [0, 0.5, 1.0, 1.6, 2.4];
    function passable(m, nx, nz, step) {
      const ny = world.floor(nx, nz, m.y);
      return finite(ny) && ny <= m.y + 0.45 + step * 1.3 && !world.blocked(nx, nz, ny) ? ny : null;
    }
    function moveMonster(m, cx, cz, step) {
      const side = m.side || 1;
      for (const turn of TURNS) {
        for (const sign of turn === 0 ? [1] : [side, -side]) {
          const a = turn * sign, ca = Math.cos(a), sa = Math.sin(a);
          const nx = m.x + (cx * ca - cz * sa) * step, nz = m.z + (cx * sa + cz * ca) * step;
          const ny = passable(m, nx, nz, step);
          if (ny !== null) { m.x = nx; m.z = nz; m.y = ny; if (turn) m.side = sign; return true; }
        }
      }
      return false;
    }
    function shoot(input) {
      const w = state.weapons[state.current];
      if (cooldown > 0 || swapTimer > 0 || w.reloading > 0) return;
      if (!w.ammo) { reload(); return; }
      w.ammo--; cooldown = w.rate;
      const p = state.player, cp = Math.cos(p.pitch), forward = { x: Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: Math.cos(p.yaw) * cp };
      let hitAny = false;
      for (let i = 0; i < w.pellets; i++) {
        const spread = w.spread * (input.aim ? 0.45 : 1);
        const spreadX = (random() * 2 - 1) * spread, spreadY = (random() * 2 - 1) * spread;
        let dx = forward.x + Math.cos(p.yaw) * spreadX, dy = forward.y + spreadY, dz = forward.z - Math.sin(p.yaw) * spreadX;
        const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
        const max = w.range;
        const obstruction = typeof world.rayDistance === 'function' ? world.rayDistance({ x: p.x, y: p.y + 1.75, z: p.z }, { x: dx, y: dy, z: dz }, max) : max;
        const limit = finite(obstruction) ? clamp(obstruction, 0, max) : max;
        let nearest = null, nearestT = limit, head = false;
        for (const m of state.monsters) {
          if (m.state === 'dead') continue;
          const ox = p.x - m.x, oz = p.z - m.z;
          const sphereHit = (cy, radius) => {
            const oy = p.y + 1.75 - cy, b = ox * dx + oy * dy + oz * dz;
            const c = ox * ox + oy * oy + oz * oz - radius * radius, disc = b * b - c;
            if (disc < 0) return Infinity;
            const t = -b - Math.sqrt(disc);
            return t < 0 ? Infinity : t;
          };
          const bodyT = sphereHit(m.y + 1, 0.65), headT = sphereHit(m.y + 1.65, 0.3);
          const isHead = headT < bodyT, t = Math.min(bodyT, headT);
          if (!finite(t) || t > nearestT) continue;
          nearestT = t; nearest = m; head = isHead;
        }
        if (nearest) {
          const falloff = w.pellets > 1 ? 1 - clamp((nearestT - 14) / 40, 0, 0.75) : 1;
          const damage = w.dmg * (head ? 1.5 : 1) * falloff;
          nearest.hp -= damage; nearest.hit = 0.12; hitAny = true;
          if (head) state.stats.head++;
          emit('hit', { id: nearest.id, kind: nearest.kind, damage, head, hp: Math.max(0, nearest.hp) });
          if (nearest.hp <= 0) kill(nearest, head);
        }
      }
      emit('shot', { weapon: w.name, ammo: w.ammo, hit: hitAny });
    }
    function reload() {
      const w = state.weapons[state.current];
      if (state.phase !== 'playing' || w.reloading > 0 || w.ammo >= w.mag || w.reserve <= 0) return false;
      w.reloading = w.reload; emit('notice', { text: 'Nachladen' }); return true;
    }
    function step(dt, input = {}) {
      if (!finite(dt) || dt <= 0 || !input || typeof input !== 'object') return snapshot();
      dt = Math.min(dt, 0.1);
      if (state.phase !== 'playing') return snapshot();
      for (const k of ['forward', 'side']) if (input[k] !== undefined && !finite(input[k])) return snapshot();
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
      if (swapTimer > 0) swapTimer = Math.max(0, swapTimer - dt);
      for (const w of state.weapons) if (w.reloading > 0) {
        w.reloading = Math.max(0, w.reloading - dt);
        if (!w.reloading) { const n = Math.min(w.mag - w.ammo, w.reserve); w.ammo += n; w.reserve -= n; emit('notice', { text: 'Nachgeladen', weapon: w.name }); }
      }
      movePlayer(dt, input);
      if (input.fire) shoot(input);
      const p = state.player;
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        if (Math.hypot(p.x - item.x, p.z - item.z) >= 1.8) continue;
        if (item.type === 'health') {
          if (p.hp >= p.maxHp) continue;
          p.hp = Math.min(p.maxHp, p.hp + 35);
        } else {
          for (const weapon of state.weapons) if (weapon.owned) weapon.reserve = Math.min(weapon.max, weapon.reserve + weapon.pick);
        }
        state.items.splice(i, 1); emit('pickup', { itemType: item.type, hp: p.hp });
      }
      for (const m of state.monsters) {
        if (m.state === 'dead') continue;
        m.y = world.floor(m.x, m.z, m.y);
        const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 1, spec = ENEMIES[m.kind];
        if (m.wind > 0) {
          m.wind -= dt;
          if (m.wind <= 0 && Math.abs(p.y - m.y) < 3 && Math.hypot(p.x - m.x, p.z - m.z) <= spec.range + 0.35) {
            const dx = p.x - m.x, dy = p.y + 0.9 - (m.y + 1), dz = p.z - m.z, d = Math.hypot(dx, dy, dz) || 1;
            const obstruction = typeof world.rayDistance === 'function'
              ? world.rayDistance({ x: m.x, y: m.y + 1, z: m.z }, { x: dx / d, y: dy / d, z: dz / d }, d)
              : d;
            if (!finite(obstruction) || obstruction < d - 0.45) { m.attack = spec.cd; continue; }
            p.hp = Math.max(0, p.hp - spec.damage); emit('hurt', { damage: spec.damage, hp: p.hp, kind: m.kind });
            if (!p.hp) { state.phase = 'dead'; emit('state', { phase: 'dead' }); return snapshot(); }
            m.attack = spec.cd;
          }
        } else if (m.attack > 0) m.attack -= dt;
        else if (d <= spec.range && Math.abs(p.y - m.y) < 3) { m.wind = spec.wind; emit('notice', { text: 'Angriff!', kind: m.kind }); }
        else if (d > spec.range * 0.82) {
          let chaseX = dx / d, chaseZ = dz / d;
          if (typeof world.chaseTarget === 'function') {
            // Die Wegsuche ist teuer: pro Gegner nur alle 0,2 s neu, dazwischen gilt die letzte Richtung.
            m.routeT = (m.routeT || 0) - dt;
            if (m.routeT <= 0 || !m.route) {
              m.routeT = 0.2;
              const route = world.chaseTarget({ ...m }, { ...p });
              m.route = Array.isArray(route) && route.length >= 2 && route.every(finite) ? [route[0], route[1]] : null;
            }
            if (m.route) {
              const rl = Math.hypot(m.route[0], m.route[1]);
              if (rl > 1e-6) { chaseX = m.route[0] / rl; chaseZ = m.route[1] / rl; }
            }
          }
          moveMonster(m, chaseX, chaseZ, spec.speed * dt);
        }
      }
      state.monsters = state.monsters.filter(m => m.state !== 'dead');
      const w = state.waves;
      if (state.quest.stage === 'final') {
        w.finalT = Math.max(0, w.finalT - dt);
        w.spawnT -= dt;
        if (w.spawnT <= 0 && state.monsters.length < 16) { spawnEnemy(); w.spawnT = 1.3; }
        if (w.finalT <= 0) { state.phase = 'won'; emit('state', { phase: 'won' }); }
      } else if (w.state === 'idle' || w.state === 'break') {
        w.timer -= dt;
        if (w.timer <= 0) startWave();
      } else {
        w.spawnT -= dt;
        const cap = Math.min(7 + Math.floor(w.n * 1.6), 16);
        if (w.toSpawn > 0 && w.spawnT <= 0 && w.alive < cap && spawnEnemy()) {
          w.toSpawn--; w.spawnT = Math.max(0.7, 2.2 - w.n * 0.1);
        }
        if (w.toSpawn === 0 && w.alive === 0) {
          w.state = 'break'; w.timer = 12; p.hp = Math.min(p.maxHp, p.hp + 20);
          for (const weapon of state.weapons) if (weapon.owned) weapon.reserve = Math.min(weapon.max, weapon.reserve + Math.ceil(weapon.pick / 2));
          state.stats.lei += 20 + w.n * 10;
          emit('notice', { text: 'Welle überstanden', reward: 20 + w.n * 10 });
        }
      }
      return snapshot();
    }
    function interact() {
      if (state.phase !== 'playing') return false;
      const p = state.player;
      if (state.quest.stage === 'seals') {
        let best = null, bestD = Infinity;
        state.quest.objectives.forEach((o, i) => {
          if (o.found) return;
          const d = Math.hypot(p.x - o.x, p.z - o.z);
          const oy = o.y === undefined || o.y === null ? world.floor(o.x, o.z, p.y) : o.y;
          if (d <= 3.2 && Math.abs(p.y - oy) < 3 && d < bestD) { best = i; bestD = d; }
        });
        if (best !== null) {
          const o = state.quest.objectives[best]; o.found = true; state.quest.got.push(o.id);
          if (state.quest.got.length === 1) state.weapons[1].owned = true;
          if (state.quest.got.length === 2) state.weapons[2].owned = true;
          for (const weapon of state.weapons) if (weapon.owned) weapon.reserve = Math.min(weapon.max, weapon.reserve + weapon.pick);
          emit('objective', { id: o.id, name: o.name, found: state.quest.got.length });
          if (state.quest.objectives.length && state.quest.objectives.every(x => x.found)) {
            state.quest.stage = 'bell'; emit('notice', { text: 'Alle Siegel gefunden. Läute die Glocke.' });
          }
          return true;
        }
      } else if (state.quest.stage === 'bell' && state.quest.bell) {
        const b = state.quest.bell, d = Math.hypot(p.x - b.x, p.z - b.z), by = b.y === undefined ? world.floor(b.x, b.z, p.y) : b.y;
        if (d <= 3.2 && Math.abs(p.y - by) < 3) {
          state.quest.stage = 'final'; state.waves.finalT = 100; state.waves.spawnT = 1; state.waves.state = 'final'; emit('objective', { id: 'bell', name: 'Glocke geläutet' }); return true;
        }
      }
      return false;
    }
    function setLook(yaw, pitch) {
      if (finite(yaw)) state.player.yaw = yaw;
      if (finite(pitch)) state.player.pitch = clamp(pitch, -1.5, 1.5);
    }
    function selectWeapon(i) {
      if (state.phase !== 'playing' || !Number.isInteger(i) || !state.weapons[i] || !state.weapons[i].owned) return false;
      if (i === state.current) return true;
      state.current = i; swapTimer = 0.28; emit('notice', { text: state.weapons[i].name, weapon: i }); return true;
    }
    function snapshot() {
      return JSON.parse(JSON.stringify(state));
    }
    function drainEvents() { return events.splice(0); }
    return {
      start() { if (state.phase === 'ready') { state.phase = 'playing'; emit('state', { phase: 'playing' }); } return snapshot(); },
      pause() { if (state.phase === 'playing') { state.phase = 'paused'; emit('state', { phase: 'paused' }); } return snapshot(); },
      resume() { if (state.phase === 'paused') { state.phase = 'playing'; emit('state', { phase: 'playing' }); } return snapshot(); },
      setLook, step, reload, selectWeapon, interact, snapshot, drainEvents
    };
  }
  root.NachtjagdGame = { create, WDEF: WDEF.map(w => ({ ...w })) };
})(typeof globalThis !== 'undefined' ? globalThis : window);
