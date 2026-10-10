'use strict';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame, parseLevel } from './public/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LEVEL_FILE = path.join(PUBLIC_DIR, 'level.json');
const TICK_MS = 33; // etwa 30 Zustandsupdates pro Sekunde
const MAX_MESSAGE_BYTES = 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function createGameServer() {
  // Die Level-Datei wird beim Start gelesen. Server und Client verwenden dieselben Daten.
  const game = createGame(parseLevel(fs.readFileSync(LEVEL_FILE, 'utf8')));

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      res.writeHead(400);
      res.end('Ungültige Anfrage');
      return;
    }

    // Gesundheitsprüfung für das Hosting (Render fragt diesen Pfad regelmäßig ab).
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    const relative = pathname === '/' ? '/index.html' : pathname;
    const file = path.normalize(path.join(PUBLIC_DIR, relative));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      res.end('Verboten');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Nicht gefunden');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (ws) => {
    const id = game.addPlayer();
    if (id === null) {
      ws.close(1013, 'Server voll');
      return;
    }
    ws.send(JSON.stringify({ type: 'welcome', id, world: game.world }));

    ws.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!message || typeof message !== 'object') {
        return;
      }
      // Die Spiellogik prüft die Werte selbst (Wertebereich, Länge, Typ).
      if (message.type === 'input') {
        game.setInput(id, message);
      } else if (message.type === 'name') {
        game.setName(id, message.name);
      }
    });

    ws.on('close', () => {
      game.removePlayer(id);
    });
  });

  let lastTick = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    game.step(dt);

    const state = JSON.stringify({ type: 'state', ...game.snapshot() });
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(state);
      }
    }
  }, TICK_MS);

  function stop() {
    clearInterval(timer);
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
    server.close();
    server.closeAllConnections?.();
  }

  return { server, stop };
}

// Startet den Server nur, wenn diese Datei direkt aufgerufen wird (nicht beim Import in Tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, stop } = createGameServer();
  server.listen(PORT, () => {
    console.log(`Spiel läuft auf http://localhost:${PORT}`);
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

export { createGameServer };
