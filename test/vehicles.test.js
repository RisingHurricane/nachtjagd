import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Tests für Geländewagen, Lore, Gondel und Ruderboot (vehicles.js im Spielkern).
const core = await readFile(new URL('../public/entwurf/gameplay-core.js', import.meta.url), 'utf8');
const vehicles = await readFile(new URL('../public/entwurf/vehicles.js', import.meta.url), 'utf8');
function make(world = {}, extra = {}) {
  const context = { Math, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(vehicles, context);
  vm.runInNewContext(core, context);
  const game = context.NachtjagdGame.create({
    random: () => 0.5,
    world: { spawn: [0, 0], floor: () => 0, blocked: () => false, spawnEnemy: () => null, ...world }
  });
  return { game, api: context.NachtjagdGame, vehicles: context.NachtjagdVehicles };
}
function advance(game, seconds, input = {}) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) game.step(Math.min(0.1, seconds - t), input);
}
const events = (game, type) => game.drainEvents().filter(e => !type || e.type === type);
const veh = (game, kind = 'jeep', i = 0) => game.snapshot().vehicles.filter(v => v.kind === kind)[i];
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≈ ${b}`);

test('without vehicle lists the world has no vehicles and interaction is unchanged', () => {
  const { game } = make(); game.start();
  assert.deepEqual([...game.snapshot().vehicles], []);
  assert.equal(game.interact(), false);
});

test('jeep: board as driver, accelerate along the heading, steer, brake and leave', () => {
  // Wagen steht bei (0,3), Blick nach +z (yaw 0)
  const { game } = make({ jeeps: [{ x: 0, z: 3, yaw: 0 }] }); game.start();
  assert.equal(game.prompt(), '[E] Geländewagen besteigen');
  assert.equal(game.interact(), true);
  let s = game.snapshot();
  assert.equal(s.player.ride.kind, 'jeep'); assert.equal(s.player.ride.driver, true);
  assert.equal(s.vehicles[0].seats[0], 'p');
  assert.equal(game.prompt(), '[E] Aussteigen');
  advance(game, 3, { forward: 1 });
  s = game.snapshot();
  assert.ok(s.vehicles[0].sp > 8, 'Tempo ' + s.vehicles[0].sp);
  assert.ok(s.vehicles[0].z > 15, 'fährt nach +z');
  near(s.vehicles[0].x, 0, 0.5, 'bleibt in der Spur');
  assert.equal(game.interact(), false, 'bei Fahrt kein Aussteigen');
  assert.ok(events(game, 'notice').some(e => /bremsen/.test(e.text)));
  advance(game, 4, { brake: true });
  s = game.snapshot();
  assert.equal(s.vehicles[0].sp, 0);
  const pos = s.vehicles[0];
  near(s.player.x, pos.x, 1.5, 'Fahrer sitzt im Wagen'); near(s.player.z, pos.z, 1.5);
  assert.equal(game.interact(), true);
  s = game.snapshot();
  assert.equal(s.player.ride, null);
  assert.ok(Math.hypot(s.player.x - pos.x, s.player.z - pos.z) >= 2.4, 'steigt neben dem Wagen aus');
  assert.equal(s.vehicles[0].seats[0], null);
});

test('jeep: steering right turns the heading right and the driver view follows', () => {
  const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); game.start();
  game.interact();
  advance(game, 1.5, { forward: 1 });
  const before = veh(game).yaw, lookBefore = game.snapshot().player.yaw;
  advance(game, 2, { forward: 1, side: 1 });
  const after = veh(game), look = game.snapshot().player.yaw;
  assert.ok(after.yaw < before - 0.2, 'rechts lenken verkleinert yaw');
  assert.ok(after.x < -1, 'Wagen weicht nach rechts (−x) aus');
  near(look - lookBefore, after.yaw - before, 0.05, 'Blick dreht mit');
  // Maus lenkt, wenn keine Taste gedrückt ist (positiv = links)
  const { game: g2 } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); g2.start(); g2.interact();
  advance(g2, 1.5, { forward: 1 });
  const y0 = veh(g2).yaw; advance(g2, 1.5, { forward: 1, turn: 0.6 });
  assert.ok(veh(g2).yaw > y0 + 0.1, 'Maus nach links lenkt links');
});

test('jeep stops at walls, steep steps and the end of passable ground', () => {
  const wall = { jeeps: [{ x: 0, z: 0, yaw: 0 }], blocked: (x, z) => z > 40 };
  const { game } = make(wall); game.start(); game.interact();
  advance(game, 8, { forward: 1 });
  const v = veh(game);
  assert.ok(v.z < 40 && v.z > 30, 'hält vor der Wand ' + v.z);
  assert.ok(v.sp < 1.5);
  const cliff = { jeeps: [{ x: 0, z: 0, yaw: 0 }], floor: (x, z) => z > 30 ? 4 : 0 };
  const { game: g2 } = make(cliff); g2.start(); g2.interact();
  advance(g2, 8, { forward: 1 });
  assert.ok(veh(g2).z < 31, 'steile Kante hält den Wagen auf');
});

test('jeep rams monsters: slow hits hurt, fast hits kill, one hit per contact', () => {
  const run = (seconds) => {
    const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); game.start();
    game.spawn('villager', 0, 40, true);
    game.interact();
    advance(game, seconds, { forward: 1 });
    return game;
  };
  const game = run(6);
  const hits = events(game, 'ram');
  assert.ok(hits.length >= 1 && hits.length <= 2, 'Treffer pro Kontakt einmal: ' + hits.length);
  assert.equal(game.snapshot().stats.kills, 1, 'schneller Wagen tötet');
  // Langsam: ein Treffer unter 8 m/s lässt den Gegner leben
  const { game: slow } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); slow.start();
  slow.spawn('brute', 0, 12, true); slow.interact();
  advance(slow, 1.9, { forward: 1 });
  const rams = events(slow, 'ram');
  if (rams.length) { assert.ok(rams[0].speed < 8); const m = slow.snapshot().monsters[0]; assert.ok(m && m.hp < 380); }
});

test('passenger seat: jeep brakes without driver, the passenger may shoot, the driver may not', () => {
  const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); game.start();
  game.interact();
  advance(game, 0.3);
  const ammo = () => game.snapshot().weapons[0].ammo;
  const a0 = ammo(); game.step(0.1, { fire: true });
  assert.equal(ammo(), a0, 'Fahrer schießt nicht');
  assert.equal(game.changeSeat(), true);
  let s = game.snapshot();
  assert.equal(s.player.ride.seat, 1); assert.equal(s.vehicles[0].seats[0], null); assert.equal(s.vehicles[0].seats[1], 'p');
  advance(game, 0.5);
  game.step(0.1, { fire: true });
  assert.equal(ammo(), a0 - 1, 'Beifahrer schießt');
  advance(game, 1, { forward: 1 });
  assert.equal(veh(game).sp, 0, 'ohne Fahrer rollt der Wagen nicht');
  assert.equal(game.melee(), false); assert.equal(game.throwGrenade(), false);
});

test('cart follows its rails, picks branches at the switch and turns around at dead ends', () => {
  const rails = {
    nodes: [{ x: 0, z: 0 }, { x: 0, z: 40 }, { x: 20, z: 60 }, { x: -20, z: 60 }],
    links: [[0, 1], [1, 2], [1, 3]]
  };
  const ride = (input, seconds = 5.5) => {
    const { game } = make({ rails, carts: [{ link: 0, t: 3 }] }); game.start();
    assert.equal(game.interact(), true);
    advance(game, seconds, input);
    return game;
  };
  let game = ride({ forward: 1 });
  let s = game.snapshot();
  assert.ok(s.vehicles[0].edge >= 1 && s.vehicles[0].z > 40, 'rollt über die Weiche hinaus');
  game = ride({ forward: 1, side: -1 }); // links = nach +x, weil der Blick nach +z zeigt
  s = game.snapshot();
  assert.equal(s.vehicles[0].edge, 1); assert.ok(s.vehicles[0].x > 3, 'linke Abzweigung (+x)');
  game = ride({ forward: 1, side: 1 });
  s = game.snapshot();
  assert.equal(s.vehicles[0].edge, 2); assert.ok(s.vehicles[0].x < -3, 'rechte Abzweigung (−x)');
  // Streckenende: Wende, die Lore bleibt auf den Schienen
  game = ride({ forward: 1, side: 1 }, 5.5);
  advance(game, 30, { forward: 1 });
  s = game.snapshot();
  assert.ok(Number.isFinite(s.vehicles[0].x) && s.vehicles[0].t >= 0 && s.vehicles[0].t <= s.vehicles[0].L);
  assert.equal(s.vehicles[0].seats[0], 'p');
  // Die Lore steht auf dem Boden der Welt (Höhe folgt der Welt plus Schienenhöhe)
  near(s.vehicles[0].y, 0.18, 0.01, 'Schienenhöhe');
});

test('cart reversing runs back along the link and coasts to a stop without input', () => {
  const rails = { nodes: [{ x: 0, z: 0 }, { x: 0, z: 40 }], links: [[0, 1]] };
  const { game } = make({ rails, carts: [{ link: 0, t: 20 }], spawn: [0, 18] }); game.start();
  assert.equal(game.interact(), true);
  advance(game, 2, { forward: -1 });
  assert.ok(veh(game, 'cart').z < 20, 'rückwärts');
  advance(game, 6);
  assert.ok(Math.abs(veh(game, 'cart').sp) < 0.2, 'rollt aus');
});

const gondola = { stations: [{ x: 0, z: 0 }, { x: 0, z: 300 }] };
const slope = (x, z) => z * 0.3;

test('gondola: boardable only while docked, rides to the other station and lets the rider out there', () => {
  const { game, vehicles: V } = make({ gondola, floor: slope }); game.start();
  assert.equal(game.snapshot().vehicles.filter(v => v.kind === 'gondola').length, 2);
  assert.equal(game.interact(), true, 'einsteigen an der Talstation');
  assert.equal(game.snapshot().player.ride.kind, 'gondola');
  advance(game, 3);
  assert.equal(game.interact(), true, 'im Halt ist Aussteigen erlaubt');
  assert.equal(game.snapshot().player.ride, null);
  assert.equal(game.interact(), true, 'wieder einsteigen');
  advance(game, 6); // Halt (8 s ab Start) ist vorbei
  assert.equal(game.interact(), false, 'unterwegs kein Aussteigen');
  advance(game, 14);
  const moving = game.snapshot().vehicles.find(v => v.seats.includes('p'));
  assert.ok(moving.z > 40 && moving.z < 260, 'unterwegs ' + moving.z);
  assert.ok(moving.y - slope(moving.x, moving.z) > 3, 'Kabine hängt über dem Gelände');
  assert.equal(game.interact(), false);
  advance(game, 32);
  assert.ok(game.snapshot().vehicles.some(v => v.seats.includes('p') && v.dock === 1), 'Bergstation erreicht');
  assert.equal(game.interact(), true);
  const out = game.snapshot().player;
  assert.ok(Math.hypot(out.x, out.z - 300) < 9, 'steigt an der Bergstation aus');
  assert.equal(out.ride, null);
  assert.equal(V.gondolaDock({ phase: 4 }), 0); assert.equal(V.gondolaDock({ phase: 20 }), null); assert.equal(V.gondolaDock({ phase: 55 }), 1);
});

test('gondola cabins keep their distance on the two cable lanes', () => {
  const { game } = make({ gondola, floor: slope }); game.start();
  let min = Infinity;
  for (let i = 0; i < 1100; i++) {
    game.step(0.1, {});
    const c = game.snapshot().vehicles.filter(v => v.kind === 'gondola');
    min = Math.min(min, Math.hypot(c[0].x - c[1].x, c[0].z - c[1].z));
  }
  assert.ok(min > 3.5, 'Abstand ' + min);
});

test('boat: rows on water, bounces off the shore, and the rider steps out on land', () => {
  // Wasser für x > 22 (Boote), Fußgänger sind ab x > 20 blockiert
  const world = { boatOk: x => x > 22, blocked: x => x > 20, waterLevel: 0.1, boats: [{ x: 22.6, z: 0, yaw: 0 }], spawn: [19.5, 0] };
  const { game } = make(world); game.start();
  assert.equal(game.prompt(), '[E] Ruderboot besteigen');
  assert.equal(game.interact(), true, 'am Ufer einsteigen');
  assert.equal(game.snapshot().player.ride.kind, 'boat');
  advance(game, 3, { forward: 1 });
  let b = veh(game, 'boat');
  assert.ok(b.z > 3 && b.x > 22, 'rudert auf dem Wasser nach +z');
  assert.equal(b.y, 0.1);
  for (const side of [-1, 1, 1, -1]) { advance(game, 6, { forward: 1, side, sprint: true }); assert.ok(veh(game, 'boat').x > 21.9, 'bleibt im Wasser'); }
  // Auf das Ufer zuhalten: Boot prallt ab statt an Land zu fahren
  const west = make({ ...world, boats: [{ x: 26, z: 0, yaw: -Math.PI / 2 }], spawn: [19, 0] }).game; west.start();
  assert.equal(west.interact(), false, 'Boot ist außer Reichweite');
  const { game: g2 } = make({ ...world, boats: [{ x: 22.5, z: 0, yaw: -Math.PI / 2 }] }); g2.start();
  assert.equal(g2.interact(), true);
  advance(g2, 5, { forward: 1 });
  assert.ok(veh(g2, 'boat').x >= 22, 'Ufer hält das Boot auf');
  advance(g2, 6);
  assert.equal(g2.interact(), true, 'an Land aussteigen');
  const p = g2.snapshot().player;
  assert.ok(p.x <= 20 && p.ride === null, 'Spieler steht an Land ' + p.x);
});

test('boat cannot leave when no shore is nearby', () => {
  const world = { boats: [{ x: 60, z: 0, yaw: 0 }], waterLevel: 0, boatOk: x => x > 22, blocked: x => x > 20, spawn: [58, 0] };
  const { game } = make(world);
  game.start();
  assert.equal(game.interact(), true);
  assert.equal(game.interact(), false, 'kein Ufer');
  assert.ok(events(game, 'notice').some(e => /Ufer/.test(e.text)));
});

test('snapshot with vehicles stays plain JSON and exposes eye height per vehicle', () => {
  const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }], gondola });
  game.start();
  const s = game.snapshot();
  assert.equal(JSON.stringify(s).includes('NaN'), false);
  assert.equal(s.player.eye, 1.75);
  game.interact();
  assert.equal(game.snapshot().player.eye, 1.06);
});

test('jeep: Lenkeinschlag baut sich weich auf und schrumpft mit dem Tempo', () => {
  const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); game.start(); game.interact();
  advance(game, 3, { forward: 1 });
  const y0 = veh(game).yaw;
  advance(game, 0.1, { forward: 1, side: 1 });
  const early = Math.abs(veh(game).yaw - y0);
  advance(game, 1.5, { forward: 1, side: 1 });
  const later = Math.abs(veh(game).yaw - y0);
  assert.ok(early < 0.12, 'kurzer Tastendruck dreht kaum: ' + early);
  assert.ok(later > early * 3, 'dauerhafter Einschlag dreht deutlich mehr');
});

test('jeep: Vollgas-Kurve ist begrenzt (Untersteuern) und bremst den Wagen', () => {
  const { game } = make({ jeeps: [{ x: 0, z: 0, yaw: 0 }] }); game.start(); game.interact();
  advance(game, 6, { forward: 1 });
  const fast = veh(game).sp;
  advance(game, 2, { forward: 1, side: 1 });
  const v = veh(game);
  assert.ok(v.sp < fast, 'Kurve kostet Tempo');
  assert.ok(Math.abs(v.yaw) < 2.5, 'dreht nicht auf der Stelle');
});

test('jeep: Wand streift den Wagen seitlich statt ihn auf Null zu stoppen', () => {
  const wall = { jeeps: [{ x: 0, z: 0, yaw: 0 }], blocked: (x, z) => z > 40 };
  const { game } = make(wall); game.start(); game.interact();
  advance(game, 8, { forward: 1 });
  const v = veh(game);
  assert.ok(v.z < 40, 'bleibt vor der Wand');
  advance(game, 2, { forward: 0 });
  assert.ok(Number.isFinite(veh(game).x) && veh(game).z < 40);
});
