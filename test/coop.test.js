import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Teamspiel: Host rechnet Gegner für alle, Gäste melden Treffer und Aktionen (gameplay-core.js, coop.js).
const core = await readFile(new URL('../public/entwurf/gameplay-core.js', import.meta.url), 'utf8');
const net = await readFile(new URL('../public/entwurf/coop.js', import.meta.url), 'utf8');
function load(source, extra = {}) {
  const context = { Math, Number, Array, Object, JSON, String, URLSearchParams, ...extra };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context;
}
const Game = load(core).NachtjagdGame, Coop = load(net).NachtjagdCoop;
const plain = (v) => JSON.parse(JSON.stringify(v));
function make(role, world = {}, extra = {}) {
  return Game.create({
    random: () => 0.5, coop: role ? { role } : null, ...extra,
    world: { spawn: [0, 0], floor: () => 0, blocked: () => false, spawnEnemy: () => null, ...world }
  });
}
function advance(game, seconds, input = {}) { for (let t = 0; t < seconds - 1e-9; t += 0.1) game.step(0.1, input); }
const drain = (game, type) => game.drainEvents().filter((e) => e.type === type);

test('Host: Gegner greifen den nächsten Spieler an, Schaden am Mitspieler geht als Ereignis hinaus', () => {
  const host = make('host'); host.start();
  host.setMates([{ id: 'g1', name: 'Ana', x: 40, y: 0, z: 0, hp: 100 }]);
  host.spawn('villager', 41.5, 0, true);
  host.drainEvents();
  advance(host, 3);
  const hurt = drain(host, 'mateHurt');
  assert.ok(hurt.length >= 1, 'Mitspieler wurde getroffen');
  assert.equal(hurt[0].id, 'g1');
  assert.equal(host.snapshot().player.hp, 100, 'der entfernte Host bleibt unverletzt');
});

test('Host: Treffer eines Mitspielers zählen, Lei für den Abschuss gehen an ihn', () => {
  const host = make('host'); host.start();
  host.setMates([{ id: 'g1', name: 'Ana', x: 10, y: 0, z: 0, hp: 100 }]);
  const id = host.spawn('villager', 14, 0, true);
  host.drainEvents();
  assert.equal(host.remoteHit({ id, damage: 9999, head: false }, 'g1'), true);
  const reward = drain(host, 'mateReward');
  assert.equal(reward.length, 1); assert.equal(reward[0].id, 'g1');
  const s = host.snapshot();
  assert.equal(s.stats.kills, 1); assert.ok(s.stats.score > 0, 'Teampunkte');
  assert.equal(s.stats.lei, 0, 'der Host bekommt diese Lei nicht');
  // Unbekannter oder zu weit entfernter Schütze wird abgewiesen
  const id2 = host.spawn('villager', 14, 0, true);
  assert.equal(host.remoteHit({ id: id2, damage: 50 }, 'g9'), false);
  host.setMates([{ id: 'g1', name: 'Ana', x: 500, y: 0, z: 0, hp: 100 }]);
  assert.equal(host.remoteHit({ id: id2, damage: 50 }, 'g1'), false);
});

test('Host: Mitspieler nimmt ein Siegel nur aus der Nähe', () => {
  const host = make('host', { objectives: [{ id: 'kirche', name: 'Kirchensiegel', x: 30, z: 0 }] }); host.start();
  host.setMates([{ id: 'g1', name: 'Ana', x: 0, y: 0, z: 0, hp: 100 }]);
  assert.equal(host.remoteInteract({ what: 'seal', index: 0 }, 'g1'), false, 'zu weit weg');
  host.setMates([{ id: 'g1', name: 'Ana', x: 29, y: 0, z: 0, hp: 100 }]);
  assert.equal(host.remoteInteract({ what: 'seal', index: 0 }, 'g1'), true);
  const s = host.snapshot();
  assert.equal(s.quest.objectives[0].found, true);
  assert.equal(drain(host, 'objective')[0].by, 'Ana');
});

test('K.o. statt Spielende: Spieler steigt wieder ein, das Team verliert erst, wenn alle am Boden sind', () => {
  const host = make('host'); host.start();
  host.setMates([{ id: 'g1', name: 'Ana', x: 200, y: 0, z: 0, hp: 100 }]);
  host.spawn('brute', 1.5, 0, true);
  for (let i = 0; i < 200 && !host.snapshot().player.down; i++) host.step(0.1, {});
  let s = host.snapshot();
  assert.equal(s.player.down, true); assert.equal(s.phase, 'playing', 'das Spiel läuft weiter');
  advance(host, 13);
  s = host.snapshot();
  assert.equal(s.player.down, false); assert.ok(s.player.hp > 0, 'wieder eingestiegen');
  // Alle am Boden: überrannt
  const wipe = make('host'); wipe.start();
  wipe.setMates([{ id: 'g1', name: 'Ana', x: 200, y: 0, z: 0, hp: 0, down: true }]);
  wipe.spawn('brute', 1.5, 0, true);
  for (let i = 0; i < 200 && wipe.snapshot().phase === 'playing'; i++) wipe.step(0.1, {});
  assert.equal(wipe.snapshot().phase, 'dead');
});

test('Gast: Gegner kommen vom Host, eigene Schüsse werden gemeldet statt gezählt', () => {
  const host = make('host'); host.start();
  const id = host.spawn('villager', 0, 8, true);
  const guest = make('guest'); guest.start();
  assert.equal(guest.applyHost(plain(host.hostState())), true);
  advance(guest, 0.5);
  let g = guest.snapshot();
  assert.equal(g.monsters.length, 1); assert.equal(g.monsters[0].id, id);
  assert.ok(Math.abs(g.monsters[0].z - 8) < 0.2, 'Puppe an der gemeldeten Stelle');
  guest.setLook(0, Math.atan2(1.1 - 1.75, 8)); guest.drainEvents();
  guest.step(0.1, { fire: true });
  const hits = drain(guest, 'netHit');
  assert.equal(hits.length, 1); assert.equal(hits[0].id, id);
  g = guest.snapshot();
  assert.equal(g.stats.kills, 0); assert.equal(g.monsters.length, 1, 'kein eigener Abschuss beim Gast');
  // Der Host wendet den Treffer an; nach dem nächsten Abgleich ist der Gegner beim Gast weg.
  host.setMates([{ id: 'g1', name: 'Ana', x: 0, y: 0, z: 0, hp: 100 }]);
  host.remoteHit({ ...hits[0], damage: 9999 }, 'g1');
  host.step(0.1, {});
  guest.applyHost(plain(host.hostState()));
  assert.equal(guest.snapshot().monsters.length, 0);
  assert.equal(guest.snapshot().stats.kills, 1, 'Teamzähler vom Host');
});

test('Gast: Siegel und Glocke gehen an den Host, Waffen und Fortschritt kommen zurück', () => {
  const objectives = [{ id: 'a', name: 'Siegel A', x: 2, z: 0 }, { id: 'b', name: 'Siegel B', x: 60, z: 0 }];
  const host = make('host', { objectives }), guest = make('guest', { objectives });
  host.start(); guest.start(); guest.drainEvents();
  assert.equal(guest.interact(), true);
  const ask = drain(guest, 'netInteract');
  assert.deepEqual(plain(ask[0]), { type: 'netInteract', what: 'seal', index: 0 });
  assert.equal(guest.snapshot().quest.objectives[0].found, false, 'erst der Host entscheidet');
  host.setMates([{ id: 'g1', name: 'Ana', x: 1, y: 0, z: 0, hp: 100 }]);
  host.remoteInteract(ask[0], 'g1');
  guest.applyHost(plain(host.hostState()));
  const g = guest.snapshot();
  assert.equal(g.quest.objectives[0].found, true);
  assert.equal(g.weapons[1].owned, true, 'erstes Siegel schaltet die Schrotflinte frei');
  assert.equal(drain(guest, 'objective').length, 1);
});

test('Gast: Treffer vom Host, Lei für eigene Abschüsse, Spielende vom Host', () => {
  const guest = make('guest'); guest.start(); guest.drainEvents();
  guest.applyHurt(30, true, 'villager');
  assert.equal(guest.snapshot().player.hp, 70);
  guest.addLei(25); assert.equal(guest.snapshot().stats.lei, 25);
  advance(guest, 0.5);
  guest.applyHurt(500, false, 'brute');
  assert.equal(guest.snapshot().player.down, true, 'auch der Gast geht nur zu Boden');
  guest.applyHost({ phase: 'dead' });
  assert.equal(guest.snapshot().phase, 'dead');
});

test('Gast: unsinnige Weltdaten werden verworfen', () => {
  const guest = make('guest'); guest.start();
  guest.applyHost({ monsters: [[1, 'drache', 0, 0, 0], [2, 'villager', 'x', 0, 0], [3, 'villager', 1, 0, 2]], items: [[1, 'gold', 0, 0, 0], [2, 'ammo', 1, 0, 1, 20]] });
  const g = guest.snapshot();
  assert.deepEqual(g.monsters.map((m) => m.id), [3]);
  assert.deepEqual(g.items.map((i) => i.type), ['ammo']);
  assert.equal(make(null).applyHost({}), false, 'ohne Teamspiel kein Abgleich');
});

test('Protokoll: Nachrichten von Gästen werden geprüft und begrenzt', () => {
  assert.equal(Coop.fromGuest(null), null);
  assert.equal(Coop.fromGuest({ t: 'unbekannt' }), null);
  assert.equal(Coop.fromGuest({ t: 'me', p: { x: 'a', y: 0, z: 0 } }), null);
  const me = Coop.fromGuest({ t: 'me', p: { x: 1e9, y: 2, z: 3, hp: 999, w: 7 } });
  assert.equal(me.p.x, 2000); assert.equal(me.p.hp, 200); assert.equal(me.p.w, 2);
  const ev = Coop.fromGuest({ t: 'ev', list: [{ type: 'netHit', id: 4, damage: 1e6 }, { type: 'kaputt' }, { type: 'netTake', id: 2 }] });
  assert.equal(ev.list.length, 2); assert.equal(ev.list[0].damage, 400);
  assert.equal(Coop.fromGuest({ t: 'hello', name: '<b>Max</b> der sehr lange Name' }).name, 'bMax/b der sehr');
  assert.equal(Coop.fromGuest({ t: 'ev', list: new Array(5000).fill({ type: 'netTake', id: 1, pad: 'x'.repeat(20) }) }), null, 'zu groß');
  assert.equal(Coop.cleanCode(' ab-c12 3x9 '), 'ABC23X');
  assert.equal(Coop.codeFromUrl('?raum=abcdef'), 'ABCDEF');
  assert.equal(Coop.codeFromUrl('?raum=abc'), null);
  assert.match(Coop.randomCode(() => 0.99), /^[A-Z2-9]{6}$/);
});

test('Protokoll: Nachrichten vom Host werden geprüft', () => {
  assert.equal(Coop.fromHost({ t: 'world' }), null);
  const w = Coop.fromHost({ t: 'world', s: {}, epoch: 2, team: [{ id: 'h', name: 'Light', x: 1, y: 2, z: 3, hp: 90 }, { id: 5 }] });
  assert.equal(w.team.length, 1); assert.equal(w.epoch, 2);
  assert.equal(Coop.fromHost({ t: 'hurt', damage: 900 }).damage, 200);
  assert.equal(Coop.fromHost({ t: 'note', text: '<script>' }).text, 'script');
});
