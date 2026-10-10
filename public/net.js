'use strict';

// Mehrspieler ohne eigenen Server: Ein Spieler ist Host und rechnet das Spiel (game.js) in seinem Browser.
// Die anderen verbinden sich über WebRTC direkt mit ihm. Den Verbindungsaufbau vermittelt der öffentliche
// PeerJS-Dienst, die Bibliothek kommt als globales `Peer` aus index.html.

import { createGame, parseLevel } from './game.js';
import { createSession } from './session.js';

const PEER_PREFIX = 'nachtjagd-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen
const TICK_MS = 33;

function randomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

// Für Tests lässt sich ein eigener Vermittler angeben (?peerhost=localhost&peerport=9000).
function peerOptions() {
  const query = new URLSearchParams(location.search);
  const host = query.get('peerhost');
  if (!host) {
    return {};
  }
  return { host, port: Number(query.get('peerport')) || 9000, path: '/', secure: false };
}

// Öffnet einen Peer. Gibt null zurück, wenn die gewünschte id schon vergeben ist.
function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = new window.Peer(id, peerOptions());
    peer.on('open', () => resolve(peer));
    peer.on('error', (error) => {
      if (error.type === 'unavailable-id') {
        resolve(null);
      } else {
        reject(error);
      }
    });
  });
}

export function roomFromUrl() {
  const code = new URLSearchParams(location.search).get('room');
  return code ? code.trim().toUpperCase().slice(0, 12) : null;
}

// Startet einen neuen Raum. handlers: onMessage(Objekt), onStatus(Text), onRoom(Code).
async function hostRoom(handlers) {
  const level = parseLevel(await (await fetch('level.json')).text());
  const session = createSession(createGame(level));

  let peer = null;
  let code = null;
  for (let attempt = 0; attempt < 5 && !peer; attempt++) {
    code = randomCode();
    peer = await openPeer(PEER_PREFIX + code);
  }
  if (!peer) {
    throw new Error('Kein freier Raumcode');
  }

  const localId = session.join((message) => handlers.onMessage(message));

  peer.on('connection', (connection) => {
    let id = null;
    const drop = () => {
      if (id !== null) {
        session.leave(id);
        id = null;
      }
    };
    connection.on('open', () => {
      id = session.join((message) => {
        if (connection.open) {
          connection.send(message);
        }
      });
      if (id === null) {
        connection.send({ type: 'full' });
        setTimeout(() => connection.close(), 200);
      }
    });
    connection.on('data', (data) => {
      if (id !== null) {
        session.receive(id, data);
      }
    });
    connection.on('close', drop);
    connection.on('error', drop);
  });

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    session.tick(Math.min((now - last) / 1000, 0.1));
    last = now;
  }, TICK_MS);

  handlers.onRoom(code);
  handlers.onStatus(`Raum ${code}, du bist Host. Dieses Fenster muss offen und sichtbar bleiben.`);

  return {
    send(message) {
      session.receive(localId, message);
      return true;
    },
  };
}

// Tritt einem Raum bei.
function joinRoom(code, handlers) {
  const peer = new window.Peer(undefined, peerOptions());
  let connection = null;
  handlers.onStatus(`Verbinde mit Raum ${code} …`);

  peer.on('open', () => {
    connection = peer.connect(PEER_PREFIX + code, { serialization: 'json', reliable: true });
    connection.on('open', () => handlers.onStatus(`Verbunden mit Raum ${code}`));
    connection.on('data', (data) => {
      if (data && data.type === 'full') {
        handlers.onStatus('Der Raum ist voll (höchstens 4 Spieler).');
      } else {
        handlers.onMessage(data);
      }
    });
    connection.on('close', () => handlers.onStatus('Der Host hat das Spiel verlassen. Seite neu laden für einen neuen Raum.'));
  });
  peer.on('error', (error) => {
    if (error.type === 'peer-unavailable') {
      handlers.onStatus(`Raum ${code} nicht gefunden. Ist der Host noch im Spiel?`);
    } else {
      handlers.onStatus(`Verbindungsfehler (${error.type})`);
    }
  });

  return {
    send(message) {
      if (connection && connection.open) {
        connection.send(message);
        return true;
      }
      return false;
    },
  };
}

// Gibt ein Objekt mit send(message) zurück. Ohne ?room=CODE in der Adresse wird ein neuer Raum gehostet.
export async function connectRoom(handlers) {
  const code = roomFromUrl();
  return code ? joinRoom(code, handlers) : hostRoom(handlers);
}
