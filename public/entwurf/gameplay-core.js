/* Rendererunabhängige Solospiel-Logik für den neuen Geländeentwurf.
   Die Regeln stammen aus dem Altay-Import (live/altay.vision/nachtjagd-neu/index.html) und sind
   hier von Darstellung, Audio und der alten Weltgeometrie getrennt. Die Welt liefert Höhen,
   Kollisionen und Strahlabfragen über einen Adapter (siehe `create`). */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = v => Number.isFinite(v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  const WDEF = [
    { name: 'Revolver', mag: 6, dmg: 38, rate: 0.36, pellets: 1, spread: 0.006, reload: 2.1, range: 150, res: 30, max: 90, pick: 12 },
    { name: 'Schrotflinte', mag: 6, dmg: 11, rate: 0.85, pellets: 9, spread: 0.05, reload: 2.7, range: 70, res: 12, max: 48, pick: 6 },
    { name: 'Jagdgewehr', mag: 5, dmg: 110, rate: 1.05, pellets: 1, spread: 0.0012, reload: 2.9, range: 240, res: 10, max: 40, pick: 5 }
  ];

  // Trefferkugeln in Modellkoordinaten (x seitlich, y oben, z vorn); `m` ist der Schadensfaktor, `h` markiert den Kopf.
  const HUMAN = [{ y: 1.76, z: 0.26, r: 0.27, m: 2.2, h: 1 }, { y: 1.22, z: 0.12, r: 0.5, m: 1 }, { y: 0.5, z: 0, r: 0.45, m: 0.8 }];
  const wings = s => [{ x: s * 1.2, y: 0.3, z: 0.1, r: 0.6, m: 0.55 }, { x: s * 2.3, y: 0.4, z: 0.2, r: 0.65, m: 0.5 }, { x: s * 3.2, y: 0.1, z: 0.1, r: 0.7, m: 0.45 }, { x: s * 4.0, y: -0.1, z: -0.1, r: 0.6, m: 0.4 }];
  const ENEMIES = {
    villager: { name: 'Dorfbewohner', hp: 70, speed: 2.4, turn: 5, damage: 11, range: 1.9, wind: 0.55, cd: 1.3, scale: 1, score: 100, lei: 14, rad: 0.5, emerge: 1.0, spheres: HUMAN },
    lycan: { name: 'Lykaner', hp: 90, speed: 4, turn: 7, damage: 13, range: 2.1, wind: 0.45, cd: 1.1, scale: 1, score: 180, lei: 28, rad: 0.55, emerge: 0.9, pounce: true, pr: 5.2, unholy: true,
      spheres: [{ y: 1.78, z: 0.62, r: 0.3, m: 2.2, h: 1 }, { y: 1.4, z: 0.2, r: 0.6, m: 1 }, { y: 0.6, z: 0, r: 0.5, m: 0.8 }] },
    wolf: { name: 'Wolf', hp: 55, speed: 5.6, turn: 8, damage: 10, range: 1.8, wind: 0.3, cd: 0.85, scale: 1, score: 150, lei: 20, rad: 0.6, emerge: 0.7, pounce: true, pr: 4.2, unholy: true,
      spheres: [{ y: 1.27, z: 1.08, r: 0.3, m: 2, h: 1 }, { y: 0.95, z: 0.35, r: 0.62, m: 1 }, { y: 0.9, z: -0.4, r: 0.46, m: 1 }] },
    hag: { name: 'Moroaică', hp: 55, speed: 3.2, turn: 4, damage: 12, range: 2.2, wind: 0.35, cd: 1.4, scale: 1, score: 220, lei: 38, rad: 0.5, emerge: 1.0, fly: true, unholy: true,
      spheres: [{ y: 2.15, z: 0.1, r: 0.34, m: 2, h: 1 }, { y: 1.4, z: 0, r: 0.75, m: 1 }] },
    samca: { name: 'Alpha-Lykaner', hp: 520, speed: 2.9, turn: 3.5, damage: 34, range: 3.3, wind: 0.8, cd: 1.8, scale: 1.65, score: 600, lei: 120, rad: 0.55, emerge: 1.5, unholy: true, heavy: true,
      spheres: [{ y: 1.78, z: 0.62, r: 0.32, m: 2.2, h: 1 }, { y: 1.4, z: 0.2, r: 0.62, m: 1 }, { y: 0.6, z: 0, r: 0.52, m: 0.8 }] },
    spitter: { name: 'Säurespucker', hp: 85, speed: 2.7, turn: 4, damage: 11, range: 2.0, wind: 0.9, cd: 2.4, scale: 1, score: 230, lei: 36, rad: 0.5, emerge: 1.0, ranged: true, hold: 11, spheres: HUMAN },
    bloater: { name: 'Sprengling', hp: 55, speed: 5.1, turn: 6, damage: 0, range: 2.4, wind: 0.65, cd: 9, scale: 1.1, score: 190, lei: 30, rad: 0.6, emerge: 0.9, explodes: true,
      spheres: [{ y: 1.76, z: 0.26, r: 0.27, m: 2.2, h: 1 }, { y: 1.15, z: 0.12, r: 0.62, m: 1 }, { y: 0.5, z: 0, r: 0.5, m: 0.8 }] },
    brute: { name: 'Schlächter', hp: 380, speed: 2.3, turn: 3, damage: 34, range: 3.0, wind: 0.95, cd: 2.2, scale: 1.4, score: 520, lei: 95, rad: 0.7, emerge: 1.4, heavy: true,
      spheres: [{ y: 1.8, z: 0.28, r: 0.3, m: 2.2, h: 1 }, { y: 1.25, z: 0.12, r: 0.55, m: 0.6 }, { y: 0.5, z: 0, r: 0.5, m: 0.48 }] },
    reaper: { name: 'Sensenschwinge', hp: 170, speed: 7.5, dive: 15, turn: 3, damage: 16, range: 2.6, wind: 0, cd: 4.6, scale: 0.85, score: 450, lei: 75, rad: 0.8, emerge: 1.2, air: true, alt: 11, orb: 19, cr: 0.9, unholy: true,
      spheres: [{ x: 0, y: 0.22, z: 1.0, r: 0.5, m: 2.2, h: 1 }, { x: 0, y: 0.1, z: 0.5, r: 0.7, m: 1 }, { x: 0, y: 0, z: -0.2, r: 0.65, m: 1 }, { x: 0, y: -0.05, z: -0.9, r: 0.4, m: 0.9 }, ...wings(1), ...wings(-1)] },
    bat: { name: 'Fledermaus', hp: 16, speed: 6.5, dive: 10, turn: 5, damage: 3, range: 1.2, wind: 0, cd: 3.4, scale: 0.12, score: 35, lei: 4, rad: 0.3, emerge: 0.4, air: true, alt: 3.2, orb: 6, cr: 0.42, unholy: true,
      spheres: [{ x: 0, y: 0, z: 0.2, r: 5.2, m: 1 }, { x: 0, y: 0.1, z: 0.9, r: 2.6, m: 1.6, h: 1 }] }
  };

  // Wetterfronten, deterministisch aus Zeit und Startwert; sanfte Übergänge über 24 Sekunden.
  const FRONTS = [
    { name: 'Mondklare Nacht', duration: 210, cover: 0.12, light: 1.16, snow: 0.025, fog: 0.72, wind: 0.32 },
    { name: 'Leichter Schneefall', duration: 225, cover: 0.38, light: 0.85, snow: 0.32, fog: 1, wind: 0.65 },
    { name: 'Wolken ziehen auf', duration: 230, cover: 0.76, light: 0.4, snow: 0.12, fog: 1.15, wind: 1.1 },
    { name: 'Schneesturm', duration: 240, cover: 0.98, light: 0.16, snow: 0.98, fog: 1.85, wind: 2.5 },
    { name: 'Finsteres Wolkenmeer', duration: 215, cover: 1, light: 0.025, snow: 0.4, fog: 1.28, wind: 1.4 },
    { name: 'Aufklarender Himmel', duration: 220, cover: 0.36, light: 0.7, snow: 0.15, fog: 0.9, wind: 0.55 }
  ];
  const WEATHER_PERIOD = FRONTS.reduce((n, f) => n + f.duration, 0);
  function weatherAt(t, seed) {
    let at = ((t % WEATHER_PERIOD) + WEATHER_PERIOD) % WEATHER_PERIOD, i = 0;
    while (at >= FRONTS[i].duration) { at -= FRONTS[i].duration; i++; }
    const a = FRONTS[i], b = FRONTS[(i + 1) % FRONTS.length];
    const u = clamp((at - (a.duration - 24)) / 24, 0, 1), k = u * u * (3 - 2 * u), v = { name: k < 0.5 ? a.name : b.name };
    for (const key of ['cover', 'light', 'snow', 'fog', 'wind']) v[key] = lerp(a[key], b[key], k);
    const ph = (seed % 997) * 0.013, gust = 0.9 + 0.1 * Math.sin(t * 0.11 + ph);
    v.snow = clamp(v.snow * gust, 0, 1); v.wind *= 1 + 0.18 * Math.sin(t * 0.17 + ph);
    v.dx = t * 0.95 + Math.sin(t * 0.018 + ph) * 26; v.dz = t * 0.28 + Math.sin(t * 0.025 + ph) * 18;
    return v;
  }

  const NOTES = [
    'Aus dem Tagebuch des Pfarrers: Die drei Mondsiegel hielten das Tal geschlossen. Als der Graf sie aus Gier trennte, stiegen die Toten aus ihren Gräbern.',
    'Der Bauer Aldric schrieb: Die Tiere heulen seit dem Neumond. Etwas Großes kreist über den Ställen, und es ist keine Eule.',
    'Der Schmied: Silber hilft gegen die Brut des Berges. Ich habe alle Löffel eingeschmolzen, aber die Nacht ist länger als mein Vorrat.',
    'Brief eines Händlers: Wir lagerten am Fuß des Tals. In den Stollen läuft Wasser, wo keines sein dürfte, und ein Boot liegt dort im Dunkeln.',
    'In einen Stein geritzt: Wer das Siegel der Tiefe nehmen will, muss über das schwarze Wasser. Das Boot wartet am Steg unter dem Berg.',
    'Der Fischer: Im See lebt ein Mondkarpfen. Wer ihn fängt, den schützt der Mond. Ich sah nie mehr als seinen Schatten.',
    'Steiger Brandt: Die Sprengkammer ist voll. Wenn dort einer schießt, fliegt der halbe Berg. Haltet Abstand von den roten Fässern.',
    'Letzter Eintrag des Grafen: Ich habe die Glocke nicht geläutet. Wer das Dorf retten will, trägt alle drei Siegel zum Turm.'
  ];
  const RELIC_NAMES = { heart: 'Winterherz', compass: 'Jägerkompass', lamp: 'Grubenlampe' };

  // Händler (h) verkauft Vorräte, der Schmied (s) schmiedet Verbesserungen.
  const SHOP = [
    { v: 'h', name: 'Verbandskasten', desc: 'Stellt alle Lebenspunkte wieder her', cost: () => 90, can: g => g.player.hp < g.player.maxHp, buy: g => { g.player.hp = g.player.maxHp; } },
    { v: 'h', name: 'Munition', desc: 'Füllt alle Waffen auf', cost: () => 110, can: g => g.weapons.some(w => w.owned && w.reserve < w.max), buy: g => { for (const w of g.weapons) if (w.owned) w.reserve = w.max; } },
    { v: 'h', name: 'Granaten × 3', desc: 'Flächenschaden', cost: () => 80, can: g => g.player.gren < 9, buy: g => { g.player.gren = Math.min(9, g.player.gren + 3); } },
    { v: 'h', name: 'Molotow × 3', desc: 'Flammenteppich, brennt 7 Sekunden', cost: () => 90, can: g => g.player.molo < 9, buy: g => { g.player.molo = Math.min(9, g.player.molo + 3); } },
    { v: 's', name: 'Mehr Schaden', desc: '+20 % Waffenschaden (Stufe / 3)', cost: g => 150 + g.up.dmg * 110, can: g => g.up.dmg < 3, buy: g => { g.up.dmg++; } },
    { v: 's', name: 'Größere Magazine', desc: 'Mehr Schuss pro Ladung (Stufe / 3)', cost: g => 140 + g.up.mag * 90, can: g => g.up.mag < 3, buy: g => { g.up.mag++; } },
    { v: 's', name: 'Schnelleres Nachladen', desc: '20 % kürzer (Stufe / 2)', cost: g => 130 + g.up.rel * 120, can: g => g.up.rel < 2, buy: g => { g.up.rel++; } },
    { v: 's', name: 'Mehr Leben', desc: 'Maximale Gesundheit +25 (Stufe / 4)', cost: g => 200 + g.up.hp * 120, can: g => g.up.hp < 4, buy: g => { g.up.hp++; g.player.maxHp += 25; g.player.hp += 25; } },
    { v: 's', name: 'Starke Linse', desc: 'Taschenlampe heller, größere Reichweite (Stufe / 3)', cost: g => 120 + g.up.lamp * 100, can: g => g.up.lamp < 3, buy: g => { g.up.lamp++; } },
    { v: 's', name: 'Silbergeschosse', desc: '+35 % Schaden gegen Wölfe, Lykaner, Hexen, Fledermäuse (Stufe / 2)', cost: g => 170 + g.up.silver * 140, can: g => g.up.silver < 2, buy: g => { g.up.silver++; } }
  ];

  /* Optionaler Weltadapter (alles außer floor und blocked ist freiwillig):
       spawn [x,z], floor(x,z,fromY) -> y, blocked(x,z,y) -> bool, rayDistance(origin,dir,max) -> Distanz bis zum Hindernis,
       chaseTarget(m,p) -> [dx,dz], spawnEnemy(player,random) -> [x,z] | null,
       objectives [{id,name,x,z,y?,guard?:'alpha'|'deep'}], bell {x,z,y?},
       loots [{x,z,y?,special?,noteId?,relicId?}], merchant {x,z}, smith {x,z},
       shrines [{x,z}], fishSpots [{x,z}]. */
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
    const floorAt = (x, z, y) => { const f = world.floor(x, z, y); return finite(f) ? f : y; };
    const place = (o, i) => ({ ...o, id: o.id === undefined ? i : o.id, y: finite(o.y) ? o.y : floorAt(o.x, o.z, initialY) });
    const state = {
      phase: 'ready', time: 0,
      player: { x: start[0], y: initialY, z: start[1], yaw: 0, pitch: 0, hp: 100, maxHp: 100, vx: 0, vy: 0, vz: 0, onGround: true, hurtT: 0, bless: 0, slowT: 0, frozen: false, gren: 2, molo: 2 },
      weapons: WDEF.map((w, i) => ({ ...w, owned: i === 0, ammo: w.mag, reserve: w.res, reloading: 0 })),
      current: 0, up: { dmg: 0, mag: 0, rel: 0, hp: 0, lamp: 0, silver: 0 },
      relics: { heart: false, compass: false, lamp: false, heartReady: 0 },
      waves: { n: 0, state: 'idle', timer: 3.5, toSpawn: 0, alive: 0, total: 0, spawnT: 0, finalT: 0, mod: 'normal' },
      monsters: [], items: [], acids: [], nades: [], fires: [],
      loots: (world.loots || []).map((l, i) => ({ ...place(l, i), taken: false })),
      shrines: (world.shrines || []).map((s, i) => ({ ...place(s, i), used: false })),
      fishSpots: (world.fishSpots || []).map((s, i) => ({ ...place(s, i), cool: 0 })),
      merchant: world.merchant ? place(world.merchant, 0) : null,
      smith: world.smith ? place(world.smith, 0) : null,
      shop: null, fish: { t: 0, spot: -1 }, melee: { t: 0, cd: 0, hit: false },
      quest: { stage: 'seals', got: [], objectives: [], bell: null }, stats: { kills: 0, head: 0, score: 0, lei: 0, notes: 0 },
      weather: null, env: { light: 1, cover: 0.12, dusk: 1, sunrise: 0 }, weatherSeed: Math.floor(random() * 1000000)
    };
    // Startwerte für Wiedereinstieg (Welle) und Prüfungen (Lei).
    if (Number.isInteger(options.startWave) && options.startWave > 1) state.waves.n = options.startWave - 1;
    if (finite(options.lei) && options.lei > 0) state.stats.lei = Math.floor(options.lei);
    state.quest.objectives = (world.objectives || []).map(o => ({ ...o, found: false }));
    state.quest.bell = world.bell ? { ...world.bell } : null;
    state.weather = weatherAt(0, state.weatherSeed);
    let cooldown = 0, swapTimer = 0, nextId = 1, autoReloadT = 0, nadeCool = 0;
    const events = [];
    const emit = (type, data = {}) => events.push({ type, ...data });
    const P = state.player;
    const magOf = w => w.mag + state.up.mag * (w.mag >= 6 ? 2 : 1);
    const dmgK = () => 1 + 0.2 * state.up.dmg;
    const addReserve = (mult = 1) => { for (const w of state.weapons) if (w.owned) w.reserve = Math.min(w.max, w.reserve + Math.ceil(w.pick * mult)); };

    // ------------------------------------------------------------------ Hilfen für Sicht und Raum
    function los(x0, y0, z0, x1, y1, z1) {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz);
      if (d < 0.5 || typeof world.rayDistance !== 'function') return true;
      const hit = world.rayDistance({ x: x0, y: y0, z: z0 }, { x: dx / d, y: dy / d, z: dz / d }, d);
      return !finite(hit) || hit >= d - 0.35;
    }
    function freeNear(cx, cz, rMin, rMax) {
      for (let i = 0; i < 28; i++) {
        const a = i * 2.399 + 0.7, r = rMin + (rMax - rMin) * ((i % 7) / 6);
        const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, y = floorAt(x, z, P.y);
        if (!world.blocked(x, z, y)) return [x, z];
      }
      return [cx, cz];
    }
    function spawnPosition() {
      if (typeof world.spawnEnemy === 'function') {
        const p = world.spawnEnemy({ ...P }, random);
        if (!Array.isArray(p) || p.length < 2 || !p.every(finite)) return null;
        const y = world.floor(p[0], p[1], P.y);
        if (!finite(y) || world.blocked(p[0], p[1], y)) return null;
        return p;
      }
      for (let tries = 0; tries < 40; tries++) {
        const a = random() * TAU, r = 24 + random() * 18;
        const x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
        const y = world.floor(x, z, P.y);
        if (finite(y) && !world.blocked(x, z, y)) return [x, z];
      }
      return null;
    }
    // Über Gebäude und Bäumen fliegen Flieger höher.
    function airFloor(x, z, y) { const g = floorAt(x, z, y); return world.blocked(x, z, g) ? g + 11 : g; }

    // ------------------------------------------------------------------ Gegner
    function spawnMonster(kind, x, z, ready) {
      const spec = ENEMIES[kind];
      const g = floorAt(x, z, P.y);
      const m = {
        id: nextId++, kind, x, z, y: g, hp: spec.hp, state: ready ? 'walk' : 'emerge', em: 0, t: 0, seed: random() * 6,
        yaw: Math.atan2(P.x - x, P.z - z), attack: 0, wind: 0, hit: 0, lift: 0, side: random() < 0.5 ? -1 : 1,
        speedVar: 0.9 + random() * 0.25, sv: 0.94 + random() * 0.14, pounceCd: 1.5 + random() * 2, sT: 3, sx: x, sz: z, stuck: 0
      };
      if (spec.air) {
        let y0 = g + spec.alt * (0.8 + random() * 0.5) + 6;
        y0 = Math.max(y0, airFloor(x, z, g) + 2);
        m.y = y0;
        m.A = { ph: 'circle', t: 0, ang: random() * TAU, dir: random() < 0.5 ? -1 : 1, rad: spec.orb * (0.8 + random() * 0.5), alt: spec.alt * (0.8 + random() * 0.5), cd: 3 + random() * 4, vx: 0, vy: 0, vz: 0, hit: false };
      }
      state.monsters.push(m);
      emit('spawn', { kind, id: m.id, x, z });
      return m;
    }
    function pickType() {
      const w0 = state.waves, n = Math.max(w0.n, state.quest.stage === 'final' ? 6 : 0), md = state.quest.stage === 'final' ? 'blood' : w0.mod;
      const live = k => state.monsters.filter(m => m.kind === k && m.state !== 'dead').length;
      const w = {
        villager: Math.max(2.5, 9 - n * 1.1), lycan: n >= 2 ? 1.4 + n * 0.6 : 0, wolf: n >= 3 ? 1.2 + n * 0.3 : 0, hag: n >= 4 ? 1.2 + n * 0.3 : 0,
        samca: n >= 5 && live('samca') < 1 + Math.floor((n - 5) / 3) ? 0.5 : 0, spitter: n >= 3 ? 0.8 + n * 0.22 : 0, bloater: n >= 4 ? 0.7 + n * 0.18 : 0,
        brute: n >= 6 && live('brute') < 1 + Math.floor((n - 6) / 4) ? 0.45 : 0, reaper: n >= 4 && live('reaper') < 1 + Math.floor((n - 4) / 3) ? 0.55 + n * 0.14 : 0, bat: n >= 2 ? 0.5 + n * 0.12 : 0
      };
      if (md === 'fog') { w.hag = w.hag * 2.5 + (n >= 3 ? 2 : 0); w.villager *= 0.7; }
      if (md === 'blood') { w.lycan *= 2; w.samca *= 2.5; w.wolf *= 1.6; w.brute *= 2; }
      if (md === 'bats') { w.bat = w.bat * 5 + 3; w.reaper = w.reaper * 2.2 + (n >= 3 ? 0.8 : 0); w.villager *= 0.6; }
      let sum = 0; for (const k in w) sum += w[k];
      let r = random() * sum;
      for (const k in w) { r -= w[k]; if (r <= 0 && w[k] > 0) return k; }
      return 'villager';
    }
    // Ein Spawn aus der Welle; Fledermäuse kommen in Gruppen.
    function spawnWaveMonster() {
      const p = spawnPosition();
      if (!p) return false;
      const kind = pickType();
      if (kind === 'bat') {
        const c = 2 + Math.floor(random() * 3);
        for (let i = 0; i < c; i++) spawnMonster('bat', p[0] + (random() - 0.5) * 6, p[1] + (random() - 0.5) * 6);
        state.waves.alive += c;
      } else { spawnMonster(kind, p[0], p[1]); state.waves.alive++; }
      return true;
    }
    function dropItem(type, x, z, life = 45) {
      if (state.items.length < 64) state.items.push({ type, x, z, y: floorAt(x, z, P.y), life, t: 0 });
    }
    function kill(m, head) {
      if (m.state === 'dead') return;
      const spec = ENEMIES[m.kind];
      if (spec.explodes && !m.boomed) bloaterBoom(m);
      m.state = 'dead';
      state.waves.alive = Math.max(0, state.waves.alive - 1);
      state.stats.kills++;
      state.stats.score += Math.round(spec.score * (head ? 1.5 : 1));
      state.stats.lei += Math.round(spec.lei * (head ? 1.3 : 1));
      emit('kill', { kind: m.kind, head: !!head, score: state.stats.score, lei: state.stats.lei, x: m.x, y: m.y, z: m.z });
      const roll = random();
      if (roll < 0.24) dropItem('ammo', m.x, m.z); else if (roll < 0.36 || m.kind === 'samca') dropItem('health', m.x, m.z);
    }
    function hitMonster(m, damage, head, dir) {
      if (m.state === 'dead') return;
      const spec = ENEMIES[m.kind];
      if (spec.unholy && state.up.silver) damage *= 1 + 0.35 * state.up.silver;
      m.hp -= damage; m.hit = 0.12;
      if (m.state === 'walk' && !spec.heavy && dir && !spec.air) shove(m, dir.x * 0.25, dir.z * 0.25);
      if (m.state === 'windup' && m.kind !== 'samca' && damage > 30) m.wind = Math.min(spec.wind, m.wind + 0.25);
      if (head) state.stats.head++;
      emit('hit', { id: m.id, kind: m.kind, damage, head: !!head, hp: Math.max(0, m.hp) });
      if (m.hp <= 0) kill(m, head);
    }
    function shove(m, dx, dz) {
      const nx = m.x + dx, nz = m.z + dz, ny = floorAt(nx, nz, m.y);
      if (ny <= m.y + 0.45 && !world.blocked(nx, nz, ny)) { m.x = nx; m.z = nz; m.y = ny; }
    }
    // Weicht Hindernissen (Stämme, Hausecken) seitlich aus: erst geradeaus, dann in wachsenden Winkeln zu einer
    // Seite, die sich der Gegner merkt.
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
    function bloaterBoom(m) {
      if (m.boomed) return;
      m.boomed = true;
      const x = m.x, y = m.y + 1, z = m.z;
      emit('explosion', { kind: 'bloater', x, y, z });
      const dp = Math.hypot(P.x - x, P.y + 1 - y, P.z - z);
      if (dp < 5.5) { P.hurtT = 0; hurtPlayer(42 * (1 - dp / 5.5), false, 'bloater'); }
      for (const o of state.monsters.slice()) {
        if (o === m || o.state === 'dead') continue;
        const d = Math.hypot(o.x - x, o.y + 1 - y, o.z - z);
        if (d < 6) hitMonster(o, 120 * (1 - d / 6), false, { x: (o.x - x) / (d || 1), z: (o.z - z) / (d || 1) });
      }
    }
    function spit(m) {
      const sx = m.x + Math.sin(m.yaw) * 0.5, sy = m.y + 1.55, sz = m.z + Math.cos(m.yaw) * 0.5;
      const tx = P.x + P.vx * 0.3, ty = P.y + 1.2, tz = P.z + P.vz * 0.3, d = Math.hypot(tx - sx, tz - sz), T = Math.max(0.35, d / 15);
      state.acids.push({ x: sx, y: sy, z: sz, vx: (tx - sx) / T, vy: (ty - sy) / T + 0.5 * 13 * T, vz: (tz - sz) / T, t: 0, damage: ENEMIES[m.kind].damage });
      emit('spit', { x: sx, y: sy, z: sz });
    }
    function updateAcids(dt) {
      for (let i = state.acids.length - 1; i >= 0; i--) {
        const a = state.acids[i], ox = a.x, oy = a.y, oz = a.z;
        a.t += dt; a.vy -= 13 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
        const sl = Math.hypot(a.x - ox, a.y - oy, a.z - oz);
        let wall = false;
        if (sl > 1e-4 && typeof world.rayDistance === 'function') {
          const hit = world.rayDistance({ x: ox, y: oy, z: oz }, { x: (a.x - ox) / sl, y: (a.y - oy) / sl, z: (a.z - oz) / sl }, sl);
          if (finite(hit) && hit < sl - 1e-4) { wall = true; a.x = ox + (a.x - ox) / sl * hit; a.y = oy + (a.y - oy) / sl * hit; a.z = oz + (a.z - oz) / sl * hit; }
        }
        let end = false;
        if (Math.hypot(P.x - a.x, P.z - a.z) < 0.85 && Math.abs(P.y + 1.1 - a.y) < 1.1) {
          const dead = hurtPlayer(a.damage, false, 'acid'); P.slowT = 1.8; emit('notice', { text: 'Säure: du wirst langsamer' }); end = true;
          if (dead) return;
        } else if (wall || a.y < floorAt(a.x, a.z, a.y + 0.5) + 0.05 || a.t > 4) end = true;
        if (end) { emit('splash', { x: a.x, y: a.y, z: a.z }); state.acids.splice(i, 1); }
      }
    }
    // Schaden am Spieler. Gibt true zurück, wenn der Spieler dabei stirbt.
    function hurtPlayer(damage, melee, source) {
      if (state.phase !== 'playing' || P.hurtT > 0) return false;
      if (P.bless > 0) damage *= 0.72;
      if (melee && state.relics.heart && state.time >= state.relics.heartReady) {
        state.relics.heartReady = state.time + 20; damage *= 0.5;
        emit('relic', { id: 'heart', text: 'Winterherz: Nahkampftreffer halbiert', x: P.x, y: P.y, z: P.z });
      }
      P.hp = Math.max(0, P.hp - damage); P.hurtT = 0.4;
      emit('hurt', { damage, hp: P.hp, kind: source });
      if (!P.hp) { state.phase = 'dead'; emit('state', { phase: 'dead' }); return true; }
      return false;
    }

    // ------------------------------------------------------------------ Wellen
    function startWave() {
      const w = state.waves;
      w.n++;
      w.mod = w.n % 5 === 0 ? 'blood' : w.n % 4 === 2 ? 'bats' : w.n % 3 === 0 ? 'fog' : 'normal';
      w.total = Math.min(Math.round((6 + w.n * 3) * (w.mod === 'blood' ? 1.25 : 1)), 46);
      w.toSpawn = w.total; w.alive = 0; w.state = 'active'; w.spawnT = 1;
      for (const s of state.shrines) s.used = false;
      for (const l of state.loots) if (l.taken && !l.special && !l.relicId && random() < 0.7) l.taken = false;
      const label = { blood: `Blutmond · Welle ${w.n}`, fog: `Nebelnacht · Welle ${w.n}`, bats: `Fledermaus-Sturm · Welle ${w.n}` }[w.mod] || `Welle ${w.n}`;
      emit('notice', { text: label, wave: w.n, mod: w.mod });
    }

    // ------------------------------------------------------------------ Spieler und Waffen
    function movePlayer(dt, input) {
      const p = P;
      if (p.frozen) { p.vx = p.vz = 0; return; }
      const f = clamp(input.forward || 0, -1, 1), s = clamp(input.side || 0, -1, 1);
      let dx = Math.sin(p.yaw) * f - Math.cos(p.yaw) * s;
      let dz = Math.cos(p.yaw) * f + Math.sin(p.yaw) * s;
      const length = Math.hypot(dx, dz);
      if (length > 1) { dx /= length; dz /= length; }
      const speed = (input.sprint && f > 0 && !input.aim ? 10.4 : 6.3) * (input.aim ? 0.55 : 1) * (p.slowT > 0 ? 0.62 : 1);
      p.vx = dx * speed; p.vz = dz * speed;
      if (input.jump && p.onGround) { p.vy = 7.4; p.onGround = false; emit('jump'); }
      dx = p.vx * dt; dz = p.vz * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
      const sx = dx / steps, sz = dz / steps;
      const air = !p.onGround;
      const ok = (nx, nz, ny, reach) => finite(ny) && ny <= p.y + reach && !world.blocked(nx, nz, ny);
      for (let i = 0; i < steps; i++) {
        const nx = p.x + sx, nz = p.z + sz, ny = world.floor(nx, nz, p.y);
        const reach = air ? 0.3 : 0.45 + Math.hypot(sx, sz) * 1.3;
        if (ok(nx, nz, ny, reach)) { p.x = nx; p.z = nz; if (!air) p.y = ny >= p.y - 0.6 ? ny : p.y; }
        else {
          const ax = p.x + sx, ay = world.floor(ax, p.z, p.y);
          if (ok(ax, p.z, ay, air ? 0.3 : 0.45 + Math.abs(sx) * 1.3)) { p.x = ax; if (!air) p.y = ay >= p.y - 0.6 ? ay : p.y; }
          const az = p.z + sz, azY = world.floor(p.x, az, p.y);
          if (ok(p.x, az, azY, air ? 0.3 : 0.45 + Math.abs(sz) * 1.3)) { p.z = az; if (!air) p.y = azY >= p.y - 0.6 ? azY : p.y; }
        }
      }
      // Bodenhaftung: Fällt der Boden mehr als 0,6 m ab, beginnt ein Sturz.
      if (p.onGround) {
        const g = floorAt(p.x, p.z, p.y);
        if (p.y - g > 0.6) p.onGround = false; else p.y = g;
      }
      if (!p.onGround) {
        p.vy -= 22 * dt; p.y += p.vy * dt;
        const g = floorAt(p.x, p.z, p.y);
        if (p.y <= g) {
          const fall = p.vy;
          p.y = g; p.vy = 0; p.onGround = true;
          if (fall < -6) emit('land', { speed: -fall });
          if (fall < -9 && fall > -40) { const dmg = (-fall - 9) * 3; if (dmg > 3) hurtPlayer(dmg, false, 'fall'); }
        }
      }
    }
    function traceMonsters(o, d, limit) {
      let best = null, bestT = limit, bestSp = null;
      for (const m of state.monsters) {
        if (m.state === 'dead' || (m.state === 'emerge' && m.em < ENEMIES[m.kind].emerge * 0.5)) continue;
        const spec = ENEMIES[m.kind], s = spec.scale * m.sv, cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), by = m.y + m.lift;
        for (const sp of spec.spheres) {
          const cx = m.x + (cy * (sp.x || 0) + sy * sp.z) * s, cyy = by + sp.y * s, cz = m.z + (-sy * (sp.x || 0) + cy * sp.z) * s, r = sp.r * s * 1.08;
          const ox = o.x - cx, oy = o.y - cyy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
          if (c > 0 && b > 0) continue;
          const disc = b * b - c; if (disc < 0) continue;
          const t = -b - Math.sqrt(disc);
          if (t > 0.05 && t < bestT) { bestT = t; best = m; bestSp = sp; }
        }
      }
      return best ? { m: best, sp: bestSp, t: bestT } : null;
    }
    function shoot(input) {
      const w = state.weapons[state.current];
      if (cooldown > 0 || swapTimer > 0 || w.reloading > 0 || state.melee.t > 0 || P.frozen) return;
      if (!w.ammo) { reload(); return; }
      w.ammo--; cooldown = w.rate;
      const cp = Math.cos(P.pitch), forward = { x: Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: Math.cos(P.yaw) * cp };
      const moving = Math.hypot(P.vx, P.vz) > 1.5 ? 1.5 : 1, airborne = P.onGround ? 1 : 2;
      let hitAny = false;
      for (let i = 0; i < w.pellets; i++) {
        const spread = w.spread * (input.aim ? 0.45 : 1) * moving * airborne;
        const spreadX = (random() * 2 - 1) * spread, spreadY = (random() * 2 - 1) * spread;
        let dx = forward.x + Math.cos(P.yaw) * spreadX, dy = forward.y + spreadY, dz = forward.z - Math.sin(P.yaw) * spreadX;
        const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
        const max = w.range, origin = { x: P.x, y: P.y + 1.75, z: P.z };
        const obstruction = typeof world.rayDistance === 'function' ? world.rayDistance(origin, { x: dx, y: dy, z: dz }, max) : max;
        const limit = finite(obstruction) ? clamp(obstruction, 0, max) : max;
        const hit = traceMonsters(origin, { x: dx, y: dy, z: dz }, limit);
        if (hit) {
          const falloff = w.pellets > 1 ? 1 - clamp((hit.t - 14) / 40, 0, 0.75) : 1;
          hitAny = true;
          hitMonster(hit.m, w.dmg * dmgK() * falloff * hit.sp.m, !!hit.sp.h, { x: dx, z: dz });
        }
      }
      emit('shot', { weapon: w.name, ammo: w.ammo, hit: hitAny });
      if (!w.ammo && w.reserve > 0) autoReloadT = 0.32;
    }
    function reload() {
      const w = state.weapons[state.current];
      if (state.phase !== 'playing' || P.frozen || w.reloading > 0 || w.ammo >= magOf(w) || w.reserve <= 0 || swapTimer > 0) return false;
      w.reloading = w.reload * (1 - 0.2 * state.up.rel); emit('notice', { text: 'Nachladen' }); return true;
    }
    // Axt: kurzer Schlag nach vorn, trifft nur, was im Blick und in Reichweite ist.
    function melee() {
      const m = state.melee;
      if (state.phase !== 'playing' || m.cd > 0 || m.t > 0 || P.frozen) return false;
      state.weapons[state.current].reloading = 0;
      m.t = 0.46; m.cd = 0.75; m.hit = false; emit('swing'); return true;
    }
    function updateMelee(dt) {
      const m = state.melee;
      if (m.cd > 0) m.cd = Math.max(0, m.cd - dt);
      if (m.t <= 0) return;
      m.t = Math.max(0, m.t - dt);
      const k = clamp(1 - m.t / 0.46, 0, 1);
      if (m.hit || k <= 0.45) return;
      m.hit = true;
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      let any = false;
      for (const mo of state.monsters.slice()) {
        if (mo.state === 'dead') continue;
        const spec = ENEMIES[mo.kind], cy = spec.air ? mo.y : mo.y + mo.lift + 1.0, dx = mo.x - P.x, dz = mo.z - P.z, dy = cy - (P.y + 1.4);
        const d = Math.hypot(dx, dz), reach = 2.7 + spec.rad * spec.scale * 0.6;
        if (d > reach || Math.abs(dy) > 2.4) continue;
        if ((dx * fx + dz * fz) / (d || 1) < 0.35) continue;
        if (!los(P.x, P.y + 1.4, P.z, mo.x, cy, mo.z)) continue;
        hitMonster(mo, 66 * dmgK(), false, null);
        any = true;
        if (!spec.air && !spec.heavy && mo.state !== 'dead') shove(mo, fx * 0.9, fz * 0.9);
      }
      if (any) emit('melee-hit');
    }
    // Wurfgeschosse: Granate (Flächenschaden nach 1,9 s) und Molotow (Flammenteppich beim Aufprall).
    function throwNade(molo) {
      if (state.phase !== 'playing' || nadeCool > 0 || P.frozen) return false;
      if (molo ? P.molo <= 0 : P.gren <= 0) return false;
      if (molo) P.molo--; else P.gren--;
      nadeCool = 0.6;
      const cp = Math.cos(P.pitch), f = { x: Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: Math.cos(P.yaw) * cp };
      const eye = { x: P.x, y: P.y + 1.6, z: P.z };
      const h = typeof world.rayDistance === 'function' ? world.rayDistance(eye, f, 0.6) : 0.6;
      const reach = finite(h) && h < 0.6 ? Math.max(0.05, h - 0.2) : 0.5, sp = molo ? 14 : 15, up = molo ? 3.4 : 3.2;
      state.nades.push({ molo: !!molo, x: eye.x + f.x * reach, y: eye.y + f.y * reach, z: eye.z + f.z * reach, vx: f.x * sp + P.vx * 0.5, vy: f.y * sp + up, vz: f.z * sp + P.vz * 0.5, t: 0 });
      emit('throw', { molo: !!molo }); return true;
    }
    function explode(x, y, z) {
      emit('explosion', { kind: 'grenade', x, y: y + 0.5, z });
      for (const m of state.monsters.slice()) {
        if (m.state === 'dead') continue;
        const dx = m.x - x, dz = m.z - z, dy = m.y + 1 - y, d = Math.hypot(dx, dy, dz);
        if (d < 8) {
          const dir = { x: dx / (Math.hypot(dx, dz) || 1), z: dz / (Math.hypot(dx, dz) || 1) };
          if (!ENEMIES[m.kind].air) shove(m, dir.x * 1.2 * (1 - d / 8), dir.z * 1.2 * (1 - d / 8));
          hitMonster(m, 170 * (1 - d / 8) * dmgK(), false, null);
        }
      }
      const dp = Math.hypot(P.x - x, P.y + 1 - y, P.z - z);
      if (dp < 5) { P.hurtT = 0; hurtPlayer(35 * (1 - dp / 5), false, 'grenade'); }
    }
    function ignite(x, y, z) {
      if (typeof world.waterDepth === 'function' && world.waterDepth(x, z) > 0.25) { emit('splash', { x, y, z }); return; }
      state.fires.push({ x, y, z, t: 7, r: 3.4, tick: 0 }); emit('fire', { x, y, z });
    }
    function updateNades(dt) {
      if (nadeCool > 0) nadeCool = Math.max(0, nadeCool - dt);
      for (let i = state.nades.length - 1; i >= 0; i--) {
        const n = state.nades[i], ox = n.x, oy = n.y, oz = n.z;
        n.t += dt; n.vy -= 16 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
        const g = floorAt(n.x, n.z, oy), sl = Math.hypot(n.x - ox, n.y - oy, n.z - oz);
        let wall = false;
        if (sl > 1e-4 && typeof world.rayDistance === 'function') {
          const hit = world.rayDistance({ x: ox, y: oy, z: oz }, { x: (n.x - ox) / sl, y: (n.y - oy) / sl, z: (n.z - oz) / sl }, sl);
          wall = finite(hit) && hit < sl - 1e-4;
        }
        if (n.molo) {
          const onMonster = state.monsters.some(m => m.state !== 'dead' && !ENEMIES[m.kind].air && Math.hypot(m.x - n.x, m.z - n.z) < 0.9 && Math.abs(m.y + 1 - n.y) < 1.5);
          if (wall) { n.x = ox; n.y = oy; n.z = oz; }
          if (n.y < g + 0.2 || wall || onMonster || n.t > 2.6) { ignite(n.x, Math.max(g, n.y - 0.1), n.z); state.nades.splice(i, 1); }
          continue;
        }
        if (n.y < g + 0.12) { n.y = g + 0.12; n.vy = -n.vy * 0.3; n.vx *= 0.6; n.vz *= 0.6; if (Math.abs(n.vy) < 0.8) n.vy = 0; }
        if (wall) { n.x = ox; n.y = oy; n.z = oz; n.vx *= -0.3; n.vz *= -0.3; if (n.vy > 0) n.vy *= 0.3; }
        if (n.t > 1.9) { explode(n.x, n.y, n.z); state.nades.splice(i, 1); if (state.phase !== 'playing') return; }
      }
    }
    function updateFires(dt) {
      for (let i = state.fires.length - 1; i >= 0; i--) {
        const f = state.fires[i]; f.t -= dt; f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = 0.25;
          for (const m of state.monsters.slice()) {
            const spec = ENEMIES[m.kind];
            if (m.state === 'dead' || spec.air) continue;
            if (Math.hypot(m.x - f.x, m.z - f.z) < f.r + spec.rad * 0.5 && Math.abs(m.y - f.y) < 2.6) { m.hp -= 9 * dmgK(); m.hit = 0.1; if (m.hp <= 0) kill(m, false); }
          }
          if (Math.hypot(P.x - f.x, P.z - f.z) < f.r && Math.abs(P.y - f.y) < 2.4) { P.hurtT = 0; if (hurtPlayer(6, false, 'fire')) return; }
        }
        if (f.t <= 0) state.fires.splice(i, 1);
      }
    }

    // ------------------------------------------------------------------ Gegner-KI
    function updateMonster(m, dt) {
      const spec = ENEMIES[m.kind];
      m.t += dt;
      if (m.hit > 0) m.hit = Math.max(0, m.hit - dt);
      if (spec.air) { updateAir(m, dt, spec); return; }
      const dx = P.x - m.x, dz = P.z - m.z, dist = Math.hypot(dx, dz) || 0.001;
      m.lift = spec.fly ? 1.3 + Math.sin(m.t * 1.7 + m.seed) * 0.3 : 0;
      if (m.state === 'emerge') {
        m.em += dt; m.y = floorAt(m.x, m.z, m.y);
        m.yaw += angDiff(Math.atan2(dx, dz), m.yaw) * Math.min(1, dt * 3);
        if (m.em >= spec.emerge) m.state = 'walk';
        return;
      }
      if (m.attack > 0) m.attack = Math.max(0, m.attack - dt);
      m.pounceCd -= dt;
      if (m.state === 'windup') {
        m.yaw += angDiff(Math.atan2(dx, dz), m.yaw) * Math.min(1, dt * 8);
        m.wind -= dt;
        if (m.wind > 0) return;
        m.wind = 0; m.state = 'walk'; m.attack = spec.cd;
        if (spec.explodes) { bloaterBoom(m); kill(m, false); return; }
        if (spec.ranged && dist > spec.range * 1.5) { spit(m); return; }
        if (dist <= spec.range * 1.4 && Math.abs(P.y - m.y) < 2.5) {
          const ey = m.y + 1, ddx = P.x - m.x, ddy = P.y + 0.9 - ey, ddz = P.z - m.z, d = Math.hypot(ddx, ddy, ddz) || 1;
          const clear = typeof world.rayDistance !== 'function' || (() => { const ob = world.rayDistance({ x: m.x, y: ey, z: m.z }, { x: ddx / d, y: ddy / d, z: ddz / d }, d); return !finite(ob) || ob >= d - 0.45; })();
          if (clear) hurtPlayer(spec.damage, true, m.kind);
        }
        return;
      }
      if (m.state === 'pounce') {
        const pc = m.pounce; pc.t += dt;
        const k = clamp(pc.t / pc.dur, 0, 1), nx = lerp(pc.sx, pc.tx, k), nz = lerp(pc.sz, pc.tz, k);
        if (!world.blocked(nx, nz, m.y)) { m.x = nx; m.z = nz; m.y = floorAt(nx, nz, m.y); } else pc.t = pc.dur;
        m.lift = Math.sin(k * Math.PI) * (m.kind === 'wolf' ? 0.8 : 1.05);
        m.yaw += angDiff(Math.atan2(pc.tx - pc.sx, pc.tz - pc.sz), m.yaw) * Math.min(1, dt * 12);
        if (!pc.done && Math.hypot(P.x - m.x, P.z - m.z) < 1.7 && Math.abs(P.y + 1 - (m.y + m.lift + 0.9)) < 1.6) {
          pc.done = true; if (hurtPlayer(spec.damage + 4, true, m.kind)) return;
        }
        if (k >= 1) { m.state = 'walk'; m.pounceCd = 3.5 + random() * 2.5; m.attack = 0.4; m.lift = 0; }
        return;
      }
      // Verhaken: Wer lange kaum vorankommt, obwohl der Spieler weit weg ist, taucht in der Nähe des Spielers neu auf.
      m.sT -= dt;
      if (m.sT <= 0) {
        m.sT = 3;
        m.stuck = Math.hypot(m.x - m.sx, m.z - m.sz) < 1 && dist > 5 ? m.stuck + 1 : 0;
        m.sx = m.x; m.sz = m.z;
        if (m.stuck >= 3) {
          const p = spawnPosition();
          if (p) { m.x = p[0]; m.z = p[1]; m.y = floorAt(p[0], p[1], P.y); m.sx = p[0]; m.sz = p[1]; m.state = 'emerge'; m.em = 0; m.route = null; }
          m.stuck = 0; return;
        }
      }
      m.y = floorAt(m.x, m.z, m.y);
      const sameLevel = Math.abs(P.y - m.y) < 2.5;
      if (m.attack <= 0 && dist < spec.range && sameLevel) { m.state = 'windup'; m.wind = spec.wind; return; }
      if (spec.ranged && m.attack <= 0 && dist < spec.hold + 7 && dist > spec.range * 1.5 && los(m.x, m.y + 1.5, m.z, P.x, P.y + 1.4, P.z)) { m.state = 'windup'; m.wind = spec.wind; return; }
      if (spec.pounce && dist < spec.pr + 0.4 && dist > 2.6 && m.pounceCd <= 0 && Math.abs(angDiff(Math.atan2(dx, dz), m.yaw)) < 0.5 && clearAhead(m, dx, dz, dist)) {
        const jd = Math.min(dist, spec.pr);
        m.state = 'pounce'; m.pounce = { t: 0, dur: 0.5, sx: m.x, sz: m.z, tx: m.x + dx / dist * jd, tz: m.z + dz / dist * jd, done: false };
        emit('pounce', { id: m.id, kind: m.kind }); return;
      }
      const stop = spec.hold && dist < spec.hold + 3 ? spec.hold : spec.range * 0.82;
      let chaseX = dx / dist, chaseZ = dz / dist;
      if (dist > stop) {
        if (typeof world.chaseTarget === 'function') {
          // Die Wegsuche ist teuer: pro Gegner nur alle 0,2 s neu, dazwischen gilt die letzte Richtung.
          m.routeT = (m.routeT || 0) - dt;
          if (m.routeT <= 0 || !m.route) {
            m.routeT = 0.2;
            const route = world.chaseTarget({ ...m }, { ...P });
            m.route = Array.isArray(route) && route.length >= 2 && route.every(finite) ? [route[0], route[1]] : null;
          }
          if (m.route) { const rl = Math.hypot(m.route[0], m.route[1]); if (rl > 1e-6) { chaseX = m.route[0] / rl; chaseZ = m.route[1] / rl; } }
        }
        const sp = spec.speed * m.speedVar * (dist < 10 ? 1.2 : 1) * (1 + Math.min(0.6, state.waves.n * 0.03));
        m.yaw += angDiff(Math.atan2(chaseX, chaseZ), m.yaw) * Math.min(1, dt * spec.turn);
        moveMonster(m, chaseX, chaseZ, sp * dt);
      } else m.yaw += angDiff(Math.atan2(dx, dz), m.yaw) * Math.min(1, dt * 6);
      // Gegner drängen sich gegenseitig auseinander.
      for (const o of state.monsters) {
        if (o === m || o.state === 'dead') continue;
        const ox = m.x - o.x, oz = m.z - o.z, d = Math.hypot(ox, oz), min = (spec.rad * spec.scale + ENEMIES[o.kind].rad * ENEMIES[o.kind].scale) * 1.3;
        if (d < min && d > 0.001) {
          const f = (min - d) * 0.5 * dt * 6, nx = m.x + ox / d * f, nz = m.z + oz / d * f, ny = floorAt(nx, nz, m.y);
          if (ny <= m.y + 0.45 && !world.blocked(nx, nz, ny)) { m.x = nx; m.z = nz; m.y = ny; }
        }
      }
    }
    function clearAhead(m, dx, dz, dist) {
      const steps = Math.ceil(dist / 1.2);
      for (let i = 1; i <= steps; i++) {
        const x = m.x + dx * i / steps, z = m.z + dz * i / steps, y = floorAt(x, z, m.y);
        if (world.blocked(x, z, y) || y > m.y + 0.9) return false;
      }
      return true;
    }
    // Flieger kreisen um den Spieler, stürzen herab und steigen wieder auf.
    function updateAir(m, dt, spec) {
      const A = m.A, px = P.x, pz = P.z, py = P.y + 1.3;
      const dx = px - m.x, dz = pz - m.z, dy = py - m.y, dist = Math.hypot(dx, dz), d3 = Math.hypot(dist, dy);
      A.t += dt; A.cd -= dt;
      if (m.state === 'emerge') { m.em += dt; if (m.em >= spec.emerge) m.state = 'walk'; }
      let tx, ty, tz, sp = spec.speed * (1 + Math.min(0.5, state.waves.n * 0.025));
      if (A.ph === 'circle') {
        A.ang += A.dir * (sp * 0.75 / Math.max(A.rad, 3)) * dt;
        tx = px + Math.cos(A.ang) * A.rad; tz = pz + Math.sin(A.ang) * A.rad; ty = P.y + A.alt + Math.sin(m.t * 0.9 + m.seed) * 1.5;
        if (A.cd <= 0 && m.state === 'walk' && dist < A.rad * 2.4 + 8) {
          if (los(m.x, m.y, m.z, px, py, pz)) { A.ph = 'dive'; A.t = 0; A.hit = false; emit('screech', { kind: m.kind, x: m.x, z: m.z }); }
          else { A.cd = 0.5 + random() * 0.8; A.ang += A.dir * (0.5 + random() * 0.7); }
        }
      } else if (A.ph === 'dive') {
        tx = px + P.vx * 0.28; tz = pz + P.vz * 0.28; ty = py - 0.2; sp = spec.dive;
        if (d3 < (m.kind === 'bat' ? 1.5 : 2.6) && !A.hit && los(m.x, m.y, m.z, px, py, pz)) {
          A.hit = true;
          if (hurtPlayer(spec.damage, true, m.kind)) return;
          A.ph = 'rise'; A.t = 0; A.cd = spec.cd * (0.7 + random() * 0.7); A.dir *= -1;
        } else if (A.t > 3.4 || (m.y < floorAt(m.x, m.z, m.y + 2) + 0.9 && A.t > 0.5)) { A.ph = 'rise'; A.t = 0; A.cd = 1.8 + random() * 2.2; }
      } else {
        const l = dist || 1;
        tx = m.x + (m.x - px) / l * 8; tz = m.z + (m.z - pz) / l * 8; ty = P.y + A.alt + 5; sp = spec.speed * 1.15;
        if (A.t > 1.9) { A.ph = 'circle'; A.ang = Math.atan2(m.z - pz, m.x - px); }
      }
      if (A.ph !== 'dive') ty = Math.max(ty, airFloor(tx, tz, m.y) + spec.cr + 1.5);
      const ex = tx - m.x, ey = ty - m.y, ez = tz - m.z, el = Math.hypot(ex, ey, ez) || 1, k = Math.min(1, dt * (A.ph === 'dive' ? 3.5 : 1.8));
      A.vx += (ex / el * sp - A.vx) * k; A.vy += (ey / el * sp * 0.8 - A.vy) * k; A.vz += (ez / el * sp - A.vz) * k;
      // Flieger untereinander auf Abstand halten
      for (const o of state.monsters) {
        const os = ENEMIES[o.kind];
        if (o === m || !os.air || o.state === 'dead') continue;
        const qx = m.x - o.x, qy = m.y - o.y, qz = m.z - o.z, d = Math.hypot(qx, qy, qz), mn = (spec.scale + os.scale) * 4;
        if (d < mn && d > 0.001) { const f = (mn - d) * 2.5; A.vx += qx / d * f * dt; A.vy += qy / d * f * dt; A.vz += qz / d * f * dt; }
      }
      m.x += A.vx * dt; m.y += A.vy * dt; m.z += A.vz * dt;
      const gmin = airFloor(m.x, m.z, m.y) + (A.ph === 'dive' ? 0.8 : 2.2);
      if (m.y < gmin) { m.y = gmin; if (A.vy < 0) A.vy = 0; }
      if (Math.hypot(A.vx, A.vz) > 0.5) m.yaw += angDiff(Math.atan2(A.vx, A.vz), m.yaw) * Math.min(1, dt * 5);
    }

    // ------------------------------------------------------------------ Beute, Handel und Orte
    function lootRoll() {
      const r = random(), n = state.waves.n;
      if (r < 0.34) { addReserve(1); emit('notice', { text: 'Munition gefunden' }); }
      else if (r < 0.52) {
        if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 40); emit('notice', { text: 'Verbandszeug +40' }); }
        else { const l = 25 + n * 6; state.stats.lei += l; emit('notice', { text: `${l} Lei gefunden` }); }
      } else if (r < 0.66) { P.gren = Math.min(9, P.gren + 1); emit('notice', { text: 'Granate gefunden' }); }
      else { const l = 30 + n * 10 + Math.floor(random() * 20); state.stats.lei += l; emit('notice', { text: `${l} Lei gefunden` }); }
    }
    function openLoot(l) {
      l.taken = true;
      if (l.relicId) {
        state.relics[l.relicId] = true;
        const line = { heart: 'Nahkampftreffer werden alle 20 Sekunden halbiert', compass: 'Die Richtung zum nächsten fehlenden Mondsiegel erscheint im HUD', lamp: 'Dein Lichtkegel wird heller und breiter' }[l.relicId];
        emit('relic', { id: l.relicId, name: RELIC_NAMES[l.relicId], text: `${RELIC_NAMES[l.relicId]} gefunden`, detail: line, x: P.x, y: P.y, z: P.z });
      } else if (l.special === 'shotgun') { state.weapons[1].owned = true; state.weapons[1].reserve += 12; emit('notice', { text: 'Schrotflinte gefunden' }); }
      else if (l.special === 'rifle') { state.weapons[2].owned = true; state.weapons[2].reserve += 10; emit('notice', { text: 'Jagdgewehr gefunden' }); }
      else if (l.special === 'grenades') { P.gren = Math.min(9, P.gren + 4); P.molo = Math.min(9, P.molo + 2); state.stats.lei += 120; emit('notice', { text: 'Granaten, Molotows und 120 Lei' }); }
      else if (l.special === 'note') {
        state.stats.notes++;
        emit('note', { text: NOTES[(l.noteId || 0) % NOTES.length], index: (l.noteId || 0) % NOTES.length + 1, total: NOTES.length });
      } else lootRoll();
      emit('loot', { id: l.id, special: l.special || null });
    }
    function shopList() {
      if (!state.shop) return [];
      return SHOP.filter(it => it.v === state.shop.vendor).map(it => {
        const can = it.can(state), cost = it.cost(state);
        return { name: it.name, desc: it.desc, cost, can, affordable: can && state.stats.lei >= cost, label: can ? String(cost) : (it.v === 'h' ? 'voll' : 'max') };
      });
    }
    function buy(i) {
      if (state.phase !== 'shop') return false;
      const it = SHOP.filter(x => x.v === state.shop.vendor)[i];
      if (!it) return false;
      const cost = it.cost(state);
      if (!it.can(state) || state.stats.lei < cost) return false;
      state.stats.lei -= cost; it.buy(state); emit('buy', { name: it.name, cost }); return true;
    }
    function closeShop() { if (state.phase === 'shop') { state.phase = 'playing'; state.shop = null; emit('state', { phase: 'playing' }); } }
    function fishResult(spot) {
      const r = random(), n = state.waves.n;
      spot.cool = 40;
      if (r < 0.4) { P.hp = Math.min(P.maxHp, P.hp + 22); emit('notice', { text: 'Forelle gefangen: +22 Leben' }); }
      else if (r < 0.65) { const l = 25 + Math.floor(random() * 45) + n * 4; state.stats.lei += l; emit('notice', { text: `Beutel am Haken: ${l} Lei` }); }
      else if (r < 0.8) { addReserve(1); emit('notice', { text: 'Eine rostige Patronenkiste hängt am Haken' }); }
      else if (r < 0.9) { P.molo = Math.min(9, P.molo + 1); emit('notice', { text: 'Eine Flasche Schnaps: Molotow +1' }); }
      else if (r < 0.97) emit('notice', { text: 'Nur ein alter Stiefel' });
      else { P.maxHp += 5; P.hp = P.maxHp; emit('notice', { text: 'Der Mondkarpfen! Maximale Gesundheit +5' }); }
    }
    function sealGuard(o) {
      if (o.guard === 'alpha') {
        const a = freeNear(o.x, o.z, 8, 14);
        spawnMonster('samca', a[0], a[1], true); state.waves.alive++;
        for (const side of [-1, 1]) { const l = freeNear(a[0] + side * 6, a[1], 0, 3); spawnMonster('lycan', l[0], l[1], true); state.waves.alive++; }
        emit('notice', { text: 'Der Burgwächter erwacht', detail: 'Ein Alpha-Lykaner und seine Brut ziehen heran' });
      } else if (o.guard === 'deep') {
        for (let k = 0; k < 2; k++) { const a = k * Math.PI + 0.5, m = spawnMonster('reaper', o.x + Math.cos(a) * 5, o.z + Math.sin(a) * 5, true); m.y = Math.max(m.y, floorAt(m.x, m.z, o.y) + 6); state.waves.alive++; }
        for (let k = 0; k < 5; k++) { const a = k * 1.25, m = spawnMonster('bat', o.x + Math.cos(a) * 7, o.z + Math.sin(a) * 7, true); m.y = Math.max(m.y, floorAt(m.x, m.z, o.y) + 3); state.waves.alive++; }
        emit('notice', { text: 'Die Tiefe erwacht', detail: 'Fledermäuse stürzen aus der Dunkelheit' });
      }
    }
    // Das nächste benutzbare Ziel in Reichweite (gleiche Reichweiten wie im Original).
    function findInteract() {
      let best = null, bd = Infinity;
      const consider = (type, d, dy, lim, ref) => { if (d <= lim[0] && dy < lim[1] && d < bd) { bd = d; best = { type, ...ref }; } };
      state.loots.forEach((l, i) => { if (!l.taken) consider('loot', Math.hypot(P.x - l.x, P.z - l.z), Math.abs(P.y + 0.6 - l.y), [2.4, 2.6], { index: i, relic: !!l.relicId }); });
      if (state.merchant) consider('shop', Math.hypot(P.x - state.merchant.x, P.z - state.merchant.z), Math.abs(P.y - state.merchant.y), [3.4, 2.5], {});
      if (state.smith) consider('smith', Math.hypot(P.x - state.smith.x, P.z - state.smith.z), Math.abs(P.y - state.smith.y), [3.0, 2.5], {});
      if (state.fish.t <= 0) state.fishSpots.forEach((s, i) => consider('fish', Math.hypot(P.x - s.x, P.z - s.z), Math.abs(P.y - s.y), [1.9, 2.2], { index: i, cool: s.cool }));
      state.shrines.forEach((s, i) => consider('shrine', Math.hypot(P.x - s.x, P.z - s.z), Math.abs(P.y - s.y), [2.4, 2.6], { index: i, used: s.used }));
      if (state.quest.stage === 'seals') {
        state.quest.objectives.forEach((o, i) => {
          if (o.found) return;
          const oy = o.y === undefined || o.y === null ? floorAt(o.x, o.z, P.y) : o.y;
          consider('seal', Math.hypot(P.x - o.x, P.z - o.z), Math.abs(P.y - oy), [3.2, 3], { index: i });
        });
      } else if (state.quest.stage === 'bell' && state.quest.bell) {
        const b = state.quest.bell, by = b.y === undefined ? floorAt(b.x, b.z, P.y) : b.y;
        consider('bell', Math.hypot(P.x - b.x, P.z - b.z), Math.abs(P.y - by), [3.2, 3], {});
      }
      return best;
    }
    function prompt() {
      if (state.phase === 'shop') return 'Zahl drücken zum Kaufen · E schließt';
      if (state.phase !== 'playing') return '';
      const t = findInteract();
      if (t) {
        return {
          loot: t.relic ? '[E] Relikt nehmen' : '[E] Durchsuchen', shop: '[E] Handeln', smith: '[E] Beim Schmied schmieden', fish: t.cool > 0 ? 'Hier beißt gerade nichts' : '[E] Angeln',
          shrine: t.used ? 'Das Licht ist erloschen' : '[E] Beten (Segen)', seal: '[E] Mondsiegel nehmen', bell: '[E] Glocke läuten'
        }[t.type];
      }
      const w = state.weapons[state.current];
      if (w.reloading > 0) return 'Nachladen …';
      if (w.ammo === 0 && w.reserve > 0) return '[R] Nachladen';
      if (w.ammo === 0) return 'Keine Munition';
      return '';
    }
    function interact() {
      if (state.phase === 'shop') { closeShop(); return true; }
      if (state.phase !== 'playing' || P.frozen) return false;
      const t = findInteract();
      if (!t) return false;
      if (t.type === 'loot') { openLoot(state.loots[t.index]); return true; }
      if (t.type === 'shop' || t.type === 'smith') { state.phase = 'shop'; state.shop = { vendor: t.type === 'shop' ? 'h' : 's' }; emit('state', { phase: 'shop' }); return true; }
      if (t.type === 'fish') {
        const s = state.fishSpots[t.index];
        if (s.cool > 0) { emit('notice', { text: 'Hier beißt gerade nichts' }); return true; }
        state.fish = { t: 2.8, spot: t.index }; P.frozen = true; emit('notice', { text: 'Du wirfst die Angel aus …' }); return true;
      }
      if (t.type === 'shrine') {
        const s = state.shrines[t.index];
        if (s.used) { emit('notice', { text: 'Das Licht des Bildstocks ist erloschen' }); return true; }
        s.used = true; P.hp = Math.min(P.maxHp, P.hp + 30); P.bless = 25;
        emit('notice', { text: 'Bildstock: +30 Leben, Schutz für 25 s' }); emit('bless'); return true;
      }
      if (t.type === 'seal') {
        const o = state.quest.objectives[t.index]; o.found = true; state.quest.got.push(o.id);
        if (state.quest.got.length === 1) state.weapons[1].owned = true;
        if (state.quest.got.length === 2) state.weapons[2].owned = true;
        addReserve(1);
        emit('objective', { id: o.id, name: o.name, found: state.quest.got.length });
        sealGuard(o);
        if (state.quest.objectives.length && state.quest.objectives.every(x => x.found)) {
          state.quest.stage = 'bell'; emit('notice', { text: 'Alle Siegel gefunden. Läute die Glocke.' });
        }
        return true;
      }
      if (t.type === 'bell') {
        state.quest.stage = 'final'; state.waves.finalT = 100; state.waves.spawnT = 1; state.waves.state = 'final'; state.waves.mod = 'blood';
        emit('objective', { id: 'bell', name: 'Glocke geläutet' }); return true;
      }
      return false;
    }
    function relicStatus() {
      const list = [];
      if (state.relics.heart) list.push('Winterherz');
      if (state.relics.lamp) list.push('Grubenlampe');
      if (state.relics.compass) {
        let near = null, nd = Infinity;
        if (state.quest.stage === 'seals') for (const o of state.quest.objectives) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (!o.found && d < nd) { nd = d; near = o; } }
        if (near) {
          const dx = near.x - P.x, dz = near.z - P.z, right = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), ahead = dx * Math.sin(P.yaw) + dz * Math.cos(P.yaw);
          const a = (Math.atan2(right, ahead) + TAU) % TAU;
          list.push(`Jägerkompass · ${near.name} ${['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(a / (TAU / 8)) % 8]}`);
        } else list.push('Jägerkompass · Alle Mondsiegel gefunden');
      }
      return list.join('  ·  ');
    }

    // ------------------------------------------------------------------ Schritt
    function updateEnv() {
      const w = state.waves, q = state.quest;
      const runProgress = Math.max(0, w.n - 1) + q.got.length * 0.22;
      const dusk = 1 - smooth(0.15, 2.6, runProgress);
      const sunrise = q.stage === 'final' ? smooth(0, 76, 76 - w.finalT) : state.phase === 'won' ? 1 : 0;
      const wx = state.weather;
      state.env = { light: lerp(wx.light, 1.32, sunrise) * (1 + 0.12 * dusk), cover: lerp(wx.cover, 0.12, sunrise), dusk, sunrise, mod: q.stage === 'final' ? 'blood' : w.mod };
    }
    function step(dt, input = {}) {
      if (!finite(dt) || dt <= 0 || !input || typeof input !== 'object') return snapshot();
      dt = Math.min(dt, 0.1);
      if (state.phase !== 'playing') return snapshot();
      for (const k of ['forward', 'side']) if (input[k] !== undefined && !finite(input[k])) return snapshot();
      state.time += dt; state.weather = { ...weatherAt(state.time, state.weatherSeed), t: state.time, seed: state.weatherSeed };
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
      if (swapTimer > 0) swapTimer = Math.max(0, swapTimer - dt);
      for (const k of ['hurtT', 'bless', 'slowT']) if (P[k] > 0) P[k] = Math.max(0, P[k] - dt);
      for (const w of state.weapons) if (w.reloading > 0) {
        w.reloading = Math.max(0, w.reloading - dt);
        if (!w.reloading) { const n = Math.min(magOf(w) - w.ammo, w.reserve); w.ammo += n; w.reserve -= n; emit('notice', { text: 'Nachgeladen', weapon: w.name }); }
      }
      if (autoReloadT > 0) { autoReloadT -= dt; if (autoReloadT <= 0) reload(); }
      for (const s of state.fishSpots) if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
      if (state.fish.t > 0) {
        state.fish.t -= dt;
        if (state.fish.t <= 0) { P.frozen = false; fishResult(state.fishSpots[state.fish.spot]); state.fish.spot = -1; }
      }
      movePlayer(dt, input);
      if (state.phase !== 'playing') return snapshot();
      updateMelee(dt);
      if (input.fire) shoot(input);
      if (state.phase !== 'playing') return snapshot();
      updateNades(dt); updateFires(dt); updateAcids(dt);
      if (state.phase !== 'playing') return snapshot();
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        item.t += dt; item.life -= dt;
        if (item.life <= 0) { state.items.splice(i, 1); continue; }
        if (Math.hypot(P.x - item.x, P.z - item.z) >= 1.8 || Math.abs(P.y - item.y) >= 2.2) continue;
        if (item.type === 'health') {
          if (P.hp >= P.maxHp) continue;
          P.hp = Math.min(P.maxHp, P.hp + 35);
        } else addReserve(1);
        state.items.splice(i, 1); emit('pickup', { itemType: item.type, hp: P.hp });
      }
      for (const m of state.monsters) {
        if (m.state === 'dead') continue;
        updateMonster(m, dt);
        if (state.phase !== 'playing') return snapshot();
      }
      state.monsters = state.monsters.filter(m => m.state !== 'dead');
      const w = state.waves;
      if (state.quest.stage === 'final') {
        w.finalT = Math.max(0, w.finalT - dt);
        w.spawnT -= dt;
        if (w.spawnT <= 0 && state.monsters.length < 16) { spawnWaveMonster(); w.spawnT = 1.3; }
        if (w.finalT <= 0) { state.phase = 'won'; emit('state', { phase: 'won' }); }
      } else if (w.state === 'idle' || w.state === 'break') {
        w.timer -= dt;
        if (w.timer <= 0) startWave();
      } else {
        w.spawnT -= dt;
        const cap = Math.min(7 + Math.floor(w.n * 1.6), 16);
        if (w.toSpawn > 0 && w.spawnT <= 0 && w.alive < cap && spawnWaveMonster()) {
          w.toSpawn--; w.spawnT = Math.max(0.7, 2.2 - w.n * 0.1);
        }
        if (w.toSpawn === 0 && w.alive === 0) {
          w.state = 'break'; w.timer = 12; P.hp = Math.min(P.maxHp, P.hp + 20);
          addReserve(0.5);
          state.stats.lei += 20 + w.n * 10;
          const a = freeNear(P.x + 2, P.z + 2, 0, 2); dropItem('ammo', a[0], a[1]);
          if (P.hp < P.maxHp * 0.7) { const h = freeNear(P.x - 2, P.z - 3, 0, 2); dropItem('health', h[0], h[1]); }
          emit('notice', { text: 'Welle überstanden', reward: 20 + w.n * 10 });
        }
      }
      updateEnv();
      return snapshot();
    }
    function setLook(yaw, pitch) {
      if (finite(yaw)) P.yaw = yaw;
      if (finite(pitch)) P.pitch = clamp(pitch, -1.5, 1.5);
    }
    function selectWeapon(i) {
      if (state.phase !== 'playing' || P.frozen || !Number.isInteger(i) || !state.weapons[i] || !state.weapons[i].owned) return false;
      if (i === state.current) return true;
      state.weapons[state.current].reloading = 0; autoReloadT = 0;
      state.current = i; swapTimer = 0.28; cooldown = Math.max(cooldown, 0.28); emit('notice', { text: state.weapons[i].name, weapon: i }); return true;
    }
    function snapshot() { return JSON.parse(JSON.stringify(state)); }
    function drainEvents() { return events.splice(0); }
    updateEnv();
    return {
      start() { if (state.phase === 'ready') { state.phase = 'playing'; emit('state', { phase: 'playing' }); } return snapshot(); },
      pause() { if (state.phase === 'playing') { state.phase = 'paused'; emit('state', { phase: 'paused' }); } return snapshot(); },
      resume() { if (state.phase === 'paused') { state.phase = 'playing'; emit('state', { phase: 'playing' }); } return snapshot(); },
      setLook, step, reload, selectWeapon, interact, snapshot, drainEvents,
      melee, throwGrenade: () => throwNade(false), throwMolotov: () => throwNade(true),
      buy, closeShop, shopList, prompt, relicStatus,
      // Gezieltes Auftauchen (Wächter an Siegeln, Tests, Prüfhaken); gibt die Gegner-Id zurück.
      spawn(kind, x, z, ready = true) {
        if (!ENEMIES[kind] || !finite(x) || !finite(z)) return null;
        const m = spawnMonster(kind, x, z, ready); state.waves.alive++; return m.id;
      }
    };
  }
  root.NachtjagdGame = { create, WDEF: WDEF.map(w => ({ ...w })), ENEMIES, FRONTS, weatherAt };
})(typeof globalThis !== 'undefined' ? globalThis : window);
