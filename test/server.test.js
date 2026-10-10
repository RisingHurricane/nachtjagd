'use strict';

import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import WebSocket from 'ws';
import { createGameServer } from '../server.js';

// Startet einen Server auf einem freien Port und räumt danach auf.
async function withServer(fn) {
  const { server, stop } = createGameServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(server.address().port);
  } finally {
    stop();
  }
}

// Wartet auf die erste Nachricht, für die predicate wahr ist.
function waitFor(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Zeitüberschreitung beim Warten auf eine Nachricht'));
    }, timeoutMs);
    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (predicate(message)) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(message);
      }
    }
    ws.on('message', onMessage);
  });
}

async function connect(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const welcome = waitFor(ws, (m) => m.type === 'welcome');
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const { id } = await welcome;
  return { ws, id };
}

function findPlayer(state, id) {
  return state.players.find((p) => p.id === id);
}

test('liefert die Startseite aus', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /<canvas/);
  });
});

test('Startseite lädt Three.js über die Import-Map in fester Version', async () => {
  await withServer(async (port) => {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /<script type="importmap">/);
    assert.match(html, /three@0\.170\.0\/build\/three\.module\.js/);
    assert.match(html, /<script type="module">/);
  });
});

test('main.js wird als JavaScript-Modul ausgeliefert', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/main.js`);
    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    assert.match(await response.text(), /from 'three'/);
  });
});

test('world.js wird als JavaScript-Modul ausgeliefert', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/world.js`);
    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    assert.match(await response.text(), /export function buildWorld/);
  });
});

test('level.json wird ausgeliefert', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/level.json`);
    assert.strictEqual(response.status, 200);
  });
});

test('Zugriffe außerhalb von public werden nicht ausgeliefert', async () => {
  await withServer(async (port) => {
    const status = await new Promise((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path: '/../package.json' }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on('error', reject);
    });
    assert.notStrictEqual(status, 200);
  });
});

test('Gesundheitsprüfung antwortet mit ok', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(await response.text(), 'ok');
  });
});

test('zwei Spieler sehen sich gegenseitig', async () => {
  await withServer(async (port) => {
    const a = await connect(port);
    const b = await connect(port);
    const state = await waitFor(a.ws, (m) => m.type === 'state' && m.players.length === 2);
    assert.ok(findPlayer(state, a.id));
    assert.ok(findPlayer(state, b.id));
  });
});

test('Eingaben bewegen den Spieler', async () => {
  await withServer(async (port) => {
    const a = await connect(port);
    const first = await waitFor(a.ws, (m) => m.type === 'state' && findPlayer(m, a.id));
    const startX = findPlayer(first, a.id).x;
    a.ws.send(JSON.stringify({ type: 'input', mx: 1, mz: 0, yaw: 0, fire: false }));
    const moved = await waitFor(
      a.ws,
      (m) => m.type === 'state' && (findPlayer(m, a.id)?.x ?? 0) > startX + 0.5,
    );
    assert.ok(findPlayer(moved, a.id).x > startX);
  });
});

test('ungültige Nachrichten stören den Server nicht', async () => {
  await withServer(async (port) => {
    const a = await connect(port);
    a.ws.send('das ist kein JSON');
    a.ws.send(JSON.stringify({ type: 'input', mx: 'abc', mz: 99999, yaw: 'x' }));
    a.ws.send(JSON.stringify(null));
    const state = await waitFor(a.ws, (m) => m.type === 'state' && findPlayer(m, a.id));
    const player = findPlayer(state, a.id);
    assert.ok(player.x >= -98 && player.x <= 98);
    assert.ok(player.z >= -98 && player.z <= 98);
  });
});

test('Namen werden übernommen und gekürzt', async () => {
  await withServer(async (port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: 'name', name: '  Ein sehr langer Spielername  ' }));
    const state = await waitFor(
      a.ws,
      (m) => m.type === 'state' && findPlayer(m, a.id)?.name.startsWith('Ein'),
    );
    assert.ok(findPlayer(state, a.id).name.length <= 16);
  });
});
