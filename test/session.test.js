'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, parseLevel, MAX_PLAYERS } from '../public/game.js';
import { createSession } from '../public/session.js';

const level = parseLevel(fs.readFileSync(new URL('../public/level.json', import.meta.url), 'utf8'));

function setup() {
  const session = createSession(createGame(level));
  const inbox = [];
  const id = session.join((message) => inbox.push(message));
  return { session, inbox, id };
}

test('join schickt welcome mit id und Welt', () => {
  const { inbox, id } = setup();
  assert.equal(inbox[0].type, 'welcome');
  assert.equal(inbox[0].id, id);
  assert.ok(inbox[0].world.width > 0);
});

test('tick schickt den Zustand mit allen Spielern an alle', () => {
  const { session, inbox } = setup();
  const other = [];
  session.join((message) => other.push(message));
  session.tick(0.033);
  const stateA = inbox.find((m) => m.type === 'state');
  const stateB = other.find((m) => m.type === 'state');
  assert.equal(stateA.players.length, 2);
  assert.equal(stateB.players.length, 2);
});

test('Eingabe bewegt den Spieler, Name wird gekürzt', () => {
  const { session, inbox, id } = setup();
  session.receive(id, { type: 'name', name: 'ein sehr langer Spielername' });
  session.receive(id, { type: 'input', mx: 0, mz: 1, yaw: 0, pitch: 0, fire: false });
  session.tick(0.001);
  const first = inbox.filter((m) => m.type === 'state').pop().players.find((p) => p.id === id);
  for (let i = 0; i < 10; i++) {
    session.tick(0.1);
  }
  const last = inbox.filter((m) => m.type === 'state').pop();
  const me = last.players.find((p) => p.id === id);
  assert.ok(me.name.length <= 16);
  assert.ok(me.z < first.z, 'Spieler läuft nach vorne (z wird kleiner)');
});

test('Ungültige und zu große Nachrichten werden ignoriert', () => {
  const { session, inbox, id } = setup();
  session.receive(id, null);
  session.receive(id, 'text');
  session.receive(id, { type: 'input', mx: 'x', mz: Infinity });
  session.receive(id, { type: 'name', name: 'x'.repeat(5000) });
  session.receive(999, { type: 'name', name: 'fremd' });
  session.tick(0.033);
  const state = inbox.filter((m) => m.type === 'state').pop();
  assert.equal(state.players.length, 1);
  assert.notEqual(state.players[0].name, 'x'.repeat(5000));
});

test('Der Raum ist bei vier Spielern voll, leave gibt den Platz frei', () => {
  const { session } = setup();
  const ids = [];
  for (let i = 1; i < MAX_PLAYERS; i++) {
    ids.push(session.join(() => {}));
  }
  assert.equal(session.join(() => {}), null);
  session.leave(ids[0]);
  assert.notEqual(session.join(() => {}), null);
});
