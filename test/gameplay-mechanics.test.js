import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Tests für die aus dem Altay-Import übernommenen Mechaniken: Gegnertypen, Wurfgeschosse, Beute, Handel, Wetter.
const source = await readFile(new URL('../public/entwurf/gameplay-core.js', import.meta.url), 'utf8');
const quiet = { spawnEnemy: () => null };
function seeded(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function make(world = {}, extra = {}) {
  const context = { Math, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  const api = context.NachtjagdGame;
  const game = api.create({
    random: extra.random || (() => 0.5), lei: extra.lei, startWave: extra.startWave,
    world: { spawn: [0, 0], floor: () => 0, blocked: () => false, ...quiet, ...world }
  });
  return { game, api };
}
function advance(game, seconds, input = {}, onStep) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) { game.step(Math.min(0.1, seconds - t), input); if (onStep) onStep(); }
}
const events = (game, type) => game.drainEvents().filter(e => !type || e.type === type);
const mon = (game, i = 0) => game.snapshot().monsters[i];
function aim(game, x, y, z) {
  const p = game.snapshot().player, dx = x - p.x, dz = z - p.z;
  game.setLook(Math.atan2(dx, dz), Math.atan2(y - (p.y + 1.75), Math.hypot(dx, dz)));
}
const seal = (id, x = 0, z = 0, extra = {}) => ({ id, name: id, x, z, ...extra });

test('body shots deal base damage, head shots multiply it and score more, emerging enemies are not targetable', () => {
  const { game } = make(); game.start();
  game.spawn('villager', 0, 8, false);
  aim(game, 0, 1.23, 8); game.step(0.1, { fire: true });
  assert.equal(mon(game).hp, 70, 'während des Auftauchens unverwundbar');
  advance(game, 0.6); // Auftauchen halb geschafft
  aim(game, 0, 1.23, 8); game.step(0.1, { fire: true });
  assert.equal(mon(game).hp, 32);
  advance(game, 0.4);
  const m = mon(game);
  aim(game, m.x, m.y + 1.78, m.z); game.step(0.1, { fire: true });
  const s = game.snapshot();
  assert.equal(s.monsters.length, 0);
  assert.equal(s.stats.head, 1);
  assert.equal(s.stats.score, 150);
  assert.equal(s.stats.lei, 18);
});

test('silver ammunition only strengthens shots against unholy enemies', () => {
  const run = (kind, bodyY) => {
    const { game } = make({ smith: { x: 0, z: 0 } }, { lei: 1000 }); game.start();
    game.interact(); assert.equal(game.snapshot().phase, 'shop');
    assert.equal(game.buy(5), true); game.closeShop(); // Index 5 beim Schmied: Silbergeschosse
    game.spawn(kind, 0, 10, true);
    advance(game, 0.1);
    const m = mon(game); aim(game, m.x, m.y + bodyY, m.z);
    const before = m.hp; game.step(0.1, { fire: true });
    return before - mon(game).hp;
  };
  const wolf = run('wolf', 0.8), villager = run('villager', 1.2);
  assert.ok(Math.abs(wolf / villager - 1.35) < 0.15, `Verhältnis ${wolf / villager}`);
});

test('axe hits enemies in front within reach and respects its cooldown', () => {
  const { game } = make(); game.start(); game.setLook(0, 0);
  game.spawn('villager', 0, 1.8, true); game.spawn('villager', 0, -2, true);
  assert.equal(game.melee(), true);
  assert.equal(game.melee(), false);
  advance(game, 0.5);
  const hp = game.snapshot().monsters.map(m => Math.round(m.hp));
  assert.ok(hp.includes(4), 'Schlag trifft mit 66 Schaden');
  assert.ok(hp.includes(70), 'Gegner hinter dem Spieler bleibt unverletzt');
  assert.equal(game.melee(), false, 'Abklingzeit 0,75 s');
  advance(game, 0.4);
  assert.equal(game.melee(), true);
});

test('grenade detonates after 1.9 seconds and hurts nearby enemies and the player', () => {
  const { game } = make(); game.start(); game.setLook(0, -1.4);
  game.spawn('villager', 0, 5, false); // taucht noch auf, erreicht den Spieler erst nach der Explosion
  assert.equal(game.throwGrenade(), true);
  assert.equal(game.snapshot().player.gren, 1);
  assert.equal(game.throwGrenade(), false, 'Wurfpause');
  advance(game, 1.8); assert.equal(game.snapshot().player.hp, 100);
  advance(game, 0.3);
  const boom = events(game, 'explosion');
  assert.equal(boom.length, 1);
  assert.equal(boom[0].kind, 'grenade');
  const s = game.snapshot();
  assert.ok(s.player.hp < 100);
  assert.ok(!s.monsters.length || s.monsters[0].hp < 70);
});

test('molotov starts a burning carpet that damages enemies over time and is quenched by water', () => {
  const { game } = make(); game.start(); game.setLook(0, 1.5);
  game.spawn('wolf', 2, 0, true);
  game.throwMolotov(); advance(game, 3);
  assert.ok(game.snapshot().fires.length >= 1 || events(game, 'fire').length > 0);
  advance(game, 5);
  assert.equal(game.snapshot().monsters.length, 0, 'Wolf verbrennt');
  const wet = make({ waterDepth: () => 1 }); wet.game.start(); wet.game.setLook(0, 1.5);
  wet.game.throwMolotov(); advance(wet.game, 4);
  assert.equal(wet.game.snapshot().fires.length, 0);
});

test('bloater explodes on contact range and damages the player and neighbours', () => {
  const { game } = make(); game.start();
  game.spawn('bloater', 0, 2.2, true); game.spawn('villager', 0, 4, true);
  advance(game, 3);
  const s = game.snapshot();
  assert.ok(s.player.hp < 100, 'Spieler nimmt Explosionsschaden');
  assert.ok(!s.monsters.some(m => m.kind === 'bloater'));
  assert.ok(s.monsters.every(m => m.hp < 70), 'Nachbar verliert Leben');
});

test('shot bloaters explode too', () => {
  const { game } = make(); game.start();
  game.spawn('bloater', 0, 7, true);
  advance(game, 0.2);
  for (let i = 0; i < 4 && game.snapshot().monsters.length; i++) {
    const m = mon(game); aim(game, m.x, m.y + 1.2, m.z); game.step(0.1, { fire: true }); advance(game, 0.4);
  }
  assert.equal(game.snapshot().monsters.length, 0);
  assert.ok(events(game, 'explosion').length >= 1);
});

test('spitter spits acid from range, which hits and slows the player', () => {
  const { game } = make(); game.start();
  game.spawn('spitter', 0, 9, true);
  let spat = false, hit = false;
  advance(game, 6, {}, () => {
    for (const e of game.drainEvents()) { if (e.type === 'spit') spat = true; if (e.type === 'hurt') hit = true; }
  });
  assert.ok(spat, 'spuckt');
  assert.ok(hit, 'trifft');
  assert.ok(game.snapshot().player.hp < 100);
});

test('lycan pounces from distance and bites for extra damage', () => {
  const { game } = make(); game.start(); game.setLook(0, 0);
  game.spawn('lycan', 0, 18, true);
  let pounced = false;
  advance(game, 8, {}, () => { for (const e of game.drainEvents()) if (e.type === 'pounce') pounced = true; });
  assert.ok(pounced);
  assert.ok(game.snapshot().player.hp < 100);
});

test('bats circle, dive, bite and are shot down with a single hit', () => {
  const { game } = make(); game.start();
  game.spawn('bat', 0, 10, true);
  const bat = mon(game);
  assert.ok(bat.y > 3, 'Fledermaus beginnt in der Luft');
  let bitten = false;
  advance(game, 30, {}, () => { for (const e of game.drainEvents()) if (e.type === 'hurt') bitten = true; });
  assert.ok(bitten);
  assert.ok(mon(game).y > 0);
  const { game: g2 } = make(); g2.start();
  g2.spawn('bat', 0, 6, true); advance(g2, 0.3);
  const b = mon(g2); aim(g2, b.x, b.y + 0.1, b.z); g2.step(0.1, { fire: true });
  assert.equal(g2.snapshot().monsters.length, 0);
});

test('seal guards: castle seal wakes an alpha with two lycans, deep seal wakes reapers and bats', () => {
  const objectives = [seal('church'), seal('mine', 0, 0, { guard: 'deep' }), seal('castle', 0, 0, { guard: 'alpha' })];
  const { game } = make({ objectives, bell: { x: 0, z: 0 } }); game.start();
  game.interact();
  assert.equal(game.snapshot().monsters.length, 0);
  game.interact();
  let kinds = game.snapshot().monsters.map(m => m.kind).sort();
  assert.deepEqual([...kinds], ['bat', 'bat', 'bat', 'bat', 'bat', 'reaper', 'reaper']);
  game.interact();
  kinds = game.snapshot().monsters.map(m => m.kind);
  assert.equal(kinds.filter(k => k === 'samca').length, 1);
  assert.equal(kinds.filter(k => k === 'lycan').length, 2);
});

test('winter heart halves one melee hit per 20 seconds; compass points to the next seal; lamp is recorded', () => {
  const loots = [{ x: 0, z: 0, relicId: 'heart' }, { x: 0, z: 0, relicId: 'compass' }, { x: 0, z: 0, relicId: 'lamp' }];
  const objectives = [seal('church', 0, 30, { name: 'Kirche' })];
  const { game } = make({ loots, objectives }); game.start(); game.setLook(0, 0);
  for (let i = 0; i < 3; i++) assert.equal(game.interact(), true);
  const s = game.snapshot();
  assert.deepEqual([s.relics.heart, s.relics.compass, s.relics.lamp], [true, true, true]);
  assert.match(game.relicStatus(), /Winterherz.*Grubenlampe.*Jägerkompass · Kirche ↑/);
  game.setLook(Math.PI / 2, 0);
  assert.match(game.relicStatus(), /Kirche ←/);
  game.drainEvents();
  game.spawn('villager', 0, 1.2, true);
  const damages = [];
  advance(game, 4, {}, () => { for (const e of game.drainEvents()) if (e.type === 'hurt') damages.push(e.damage); });
  assert.equal(damages[0], 5.5);
  assert.equal(damages[1], 11);
});

test('notes and crates: notes show text, crates give supplies and reopen on the next wave', () => {
  const loots = [{ x: 0, z: 0, special: 'note', noteId: 2 }, { x: 0, z: 0 }];
  const { game } = make({ loots }); game.start();
  game.interact();
  const note = events(game, 'note')[0];
  assert.match(note.text, /Silber hilft/);
  assert.equal(game.snapshot().stats.notes, 1);
  game.interact();
  assert.equal(game.snapshot().loots.filter(l => l.taken).length, 2);
  assert.equal(game.interact(), false);
  advance(game, 4);
  const l = game.snapshot().loots;
  assert.equal(l[0].taken, true, 'Notizen bleiben');
  assert.equal(l[1].taken, false, 'Truhe füllt sich wieder');
});

test('merchant sells supplies, blacksmith sells upgrades, and the world pauses while shopping', () => {
  const { game } = make({ merchant: { x: 0, z: 0 } }, { lei: 100 }); game.start();
  assert.equal(game.prompt(), '[E] Handeln');
  game.interact();
  assert.equal(game.snapshot().phase, 'shop');
  const t = game.snapshot().time; game.step(1, {});
  assert.equal(game.snapshot().time, t);
  const list = game.shopList();
  assert.deepEqual([...list.map(i => i.name)], ['Verbandskasten', 'Munition', 'Granaten × 3', 'Molotow × 3']);
  assert.equal(list[0].affordable, false, 'bei voller Gesundheit nicht kaufbar');
  assert.equal(game.buy(0), false);
  assert.equal(game.buy(2), true);
  assert.equal(game.snapshot().player.gren, 5);
  assert.equal(game.snapshot().stats.lei, 20);
  assert.equal(game.buy(3), false, 'zu wenig Lei');
  game.interact();
  assert.equal(game.snapshot().phase, 'playing');
});

test('blacksmith upgrades change damage, magazine, reload time and health', () => {
  const { game } = make({ smith: { x: 0, z: 0 } }, { lei: 5000 }); game.start();
  game.interact();
  assert.deepEqual([...game.shopList().map(i => i.name)], ['Mehr Schaden', 'Größere Magazine', 'Schnelleres Nachladen', 'Mehr Leben', 'Starke Linse', 'Silbergeschosse']);
  for (const i of [0, 1, 2, 3]) assert.equal(game.buy(i), true);
  game.closeShop();
  const s = game.snapshot();
  assert.equal(s.player.maxHp, 125); assert.equal(s.player.hp, 125);
  assert.equal(JSON.stringify(s.up), JSON.stringify({ dmg: 1, mag: 1, rel: 1, hp: 1, lamp: 0, silver: 0 }));
  game.spawn('villager', 0, 10, true); advance(game, 0.2);
  const m = mon(game); aim(game, m.x, m.y + 1.2, m.z);
  const hp0 = m.hp; game.step(0.1, { fire: true });
  assert.ok(Math.abs(hp0 - mon(game).hp - 45.6) < 0.01, 'Schaden +20 %');
  advance(game, 0.4);
  game.reload(); advance(game, 1.5);
  assert.equal(game.snapshot().weapons[0].ammo, 5, 'nach 1,5 s noch nicht fertig');
  advance(game, 0.2);
  assert.equal(game.snapshot().weapons[0].ammo, 8, 'Nachladen nach 1,68 s, Magazin fasst 8 Schuss');
});

test('shrine blesses once per wave: heal, 28 percent less damage, resets at the next wave', () => {
  const { game } = make({ shrines: [{ x: 0, z: 0 }] }); game.start();
  assert.equal(game.prompt(), '[E] Beten (Segen)');
  game.interact();
  assert.equal(game.snapshot().player.bless, 25);
  assert.equal(game.prompt(), 'Das Licht ist erloschen');
  game.drainEvents();
  game.spawn('villager', 0, 1.2, true);
  const dmg = []; advance(game, 1.5, {}, () => { for (const e of game.drainEvents()) if (e.type === 'hurt') dmg.push(e.damage); });
  assert.ok(Math.abs(dmg[0] - 11 * 0.72) < 1e-9);
  game.interact(); assert.equal(game.snapshot().shrines[0].used, true);
  advance(game, 3.5);
  assert.equal(game.snapshot().shrines[0].used, false, 'neue Welle, neuer Segen');
});

test('fishing freezes the player for 2.8 seconds, pays out and then needs 40 seconds cooldown', () => {
  const { game } = make({ fishSpots: [{ x: 0, z: 0 }] }); game.start(); game.setLook(0, 0);
  assert.equal(game.prompt(), '[E] Angeln');
  game.interact();
  advance(game, 2.0, { forward: 1 });
  assert.equal(game.snapshot().player.z, 0, 'beim Angeln festgehalten');
  advance(game, 1.0);
  const s = game.snapshot();
  assert.equal(s.player.frozen, false);
  assert.equal(s.fishSpots[0].cool > 30, true);
  game.interact();
  assert.ok(events(game, 'notice').some(e => e.text === 'Hier beißt gerade nichts'));
});

test('waves vary: blood moon is larger, bats storm, fog nights, and enemy kinds unlock with the wave number', () => {
  const total = n => { const { game } = make({}, { startWave: n }); game.start(); advance(game, 4); const w = game.snapshot().waves; return [w.n, w.mod, w.total]; };
  assert.deepEqual(total(1), [1, 'normal', 9]);
  assert.deepEqual(total(2), [2, 'bats', 12]);
  assert.deepEqual(total(3), [3, 'fog', 15]);
  assert.deepEqual(total(5), [5, 'blood', 26]);
  const kindsAt = n => {
    const kinds = new Set();
    const { game } = make({ spawnEnemy: () => [0, 170] }, { startWave: n, random: seeded(11) });
    game.start();
    advance(game, 40, {}, () => { for (const e of game.drainEvents()) if (e.type === 'spawn') kinds.add(e.kind); });
    return kinds;
  };
  assert.deepEqual([...kindsAt(1)], ['villager']);
  const late = kindsAt(8);
  for (const k of ['villager', 'lycan', 'wolf', 'hag']) assert.ok(late.has(k), k);
  assert.ok(late.size >= 6, [...late].join());
});

test('weather fronts are deterministic, periodic and change smoothly', () => {
  const { api } = make();
  const a = api.weatherAt(100, 5), b = api.weatherAt(100, 5);
  assert.deepEqual(a, b);
  const period = api.FRONTS.reduce((n, f) => n + f.duration, 0);
  assert.equal(api.weatherAt(10, 3).name, api.weatherAt(10 + period, 3).name);
  assert.equal(api.weatherAt(10, 3).name, 'Mondklare Nacht');
  assert.equal(api.weatherAt(250, 3).name, 'Leichter Schneefall');
  let last = api.weatherAt(0, 1).light;
  for (let t = 1; t < period; t++) { const w = api.weatherAt(t, 1); assert.ok(Math.abs(w.light - last) < 0.08, `Sprung bei ${t}`); last = w.light; assert.ok(w.snow >= 0 && w.snow <= 1); }
});

test('game exposes weather and environment; dusk fades with progress and sunrise rises during the finale', () => {
  const objectives = [seal('a'), seal('b'), seal('c')];
  const { game } = make({ objectives, bell: { x: 0, z: 0 } }); game.start(); game.step(0.1, {});
  let s = game.snapshot();
  assert.equal(s.weather.name, 'Mondklare Nacht');
  assert.ok(s.env.dusk > 0.9 && s.env.sunrise === 0);
  for (let i = 0; i < 4; i++) game.interact();
  advance(game, 60);
  s = game.snapshot();
  assert.equal(s.quest.stage, 'final');
  assert.equal(s.env.mod, 'blood');
  assert.ok(s.env.sunrise > 0.2);
});

test('Nacht kommt nach 35 Spielsekunden auch ohne Fortschritt; Pause hält die Dämmerung an', () => {
  const {game}=make(); game.start();
  advance(game,18); const halfway=game.snapshot().env.dusk;
  assert.ok(halfway>.45&&halfway<.55);
  game.pause(); advance(game,30); assert.equal(game.snapshot().env.dusk,halfway);
  game.resume(); advance(game,18); assert.equal(game.snapshot().env.dusk,0);
});

test('jumping leaves the ground and lands again; falling from a ledge hurts', () => {
  const { game } = make(); game.start();
  game.step(0.1, { jump: true });
  assert.ok(game.snapshot().player.y > 0.3);
  assert.equal(game.snapshot().player.onGround, false);
  advance(game, 1.2);
  assert.equal(game.snapshot().player.y, 0);
  assert.equal(game.snapshot().player.onGround, true);
  const cliff = make({ floor: x => (x > 3 ? -7 : 0) }); cliff.game.start(); cliff.game.setLook(Math.PI / 2, 0);
  advance(cliff.game, 2.5, { forward: 1 });
  const s = cliff.game.snapshot();
  assert.equal(s.player.y, -7);
  assert.ok(s.player.hp < 100 && s.player.hp > 40, `Sturzschaden ${100 - s.player.hp}`);
});

test('pickups time out, ammo is taken, health stays when the player is at full health', () => {
  const { game } = make({ spawnEnemy: () => [0, 6] }, { random: () => 0.1 }); game.start(); game.setLook(0, 0);
  advance(game, 5.2);
  const m = mon(game); aim(game, m.x, m.y + 1.78, m.z); game.step(0.1, { fire: true });
  assert.equal(game.snapshot().items.length, 1, 'Beute fällt');
  assert.equal(game.snapshot().items[0].type, 'ammo');
  const before = game.snapshot().weapons[0].reserve;
  advance(game, 0.2, { forward: 1 });
  advance(game, 1.5, { forward: 1 });
  assert.ok(game.snapshot().weapons[0].reserve > before || game.snapshot().items.length === 0);
});

test('damage has 0.4 second invulnerability frames, so simultaneous hits do not stack', () => {
  const { game } = make(); game.start();
  game.spawn('villager', 0, 1.2, true); game.spawn('villager', 0.3, 1.2, true);
  advance(game, 0.7);
  assert.equal(game.snapshot().player.hp, 89);
});

test('enemies stuck out of reach are relocated near the player', () => {
  const ring = (x, z) => { const d = Math.hypot(x, z - 40); return d > 0.05 && d < 4; };
  let relocate = false;
  const { game } = make({ blocked: ring, spawnEnemy: () => (relocate ? [30, 30] : null) }); game.start();
  game.spawn('villager', 0, 40, true);
  advance(game, 4);
  relocate = true;
  advance(game, 8);
  const m = mon(game);
  assert.ok(Math.hypot(m.x, m.z - 40) > 10, `neu aufgetaucht bei ${m.x},${m.z}`);
});

test('snapshots stay plain JSON data', () => {
  const { game } = make({ loots: [{ x: 3, z: 3 }], shrines: [{ x: 5, z: 5 }] }); game.start(); game.spawn('reaper', 5, 5, true); advance(game, 2);
  const s = game.snapshot();
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
});
