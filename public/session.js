'use strict';

// Verbindet die Spiellogik (game.js) mit beliebigen Verbindungen. Wer den Raum hostet, ruft
// join() für jeden Spieler auf, leitet Nachrichten mit receive() weiter und ruft tick() regelmäßig auf.
// Die Klasse kennt weder Netzwerk noch Browser und lässt sich deshalb in Node testen.

const MAX_MESSAGE_CHARS = 1024;

export function createSession(game) {
  const senders = new Map(); // id -> Funktion, die ein Objekt an diesen Spieler schickt

  // Nimmt einen Spieler auf. Gibt die id zurück oder null, wenn der Raum voll ist.
  function join(send) {
    const id = game.addPlayer();
    if (id === null) {
      return null;
    }
    senders.set(id, send);
    send({ type: 'welcome', id, world: game.world });
    return id;
  }

  // Verarbeitet eine Nachricht eines Spielers. Clients gelten als nicht vertrauenswürdig.
  function receive(id, message) {
    if (!senders.has(id) || !message || typeof message !== 'object') {
      return;
    }
    let size;
    try {
      size = JSON.stringify(message).length;
    } catch {
      return;
    }
    if (size > MAX_MESSAGE_CHARS) {
      return;
    }
    // Die Spiellogik prüft die Werte selbst (Wertebereich, Länge, Typ).
    if (message.type === 'input') {
      game.setInput(id, message);
    } else if (message.type === 'name') {
      game.setName(id, message.name);
    }
  }

  function leave(id) {
    if (senders.delete(id)) {
      game.removePlayer(id);
    }
  }

  // Rechnet einen Schritt und schickt den Zustand an alle.
  function tick(dt) {
    game.step(dt);
    const state = { type: 'state', ...game.snapshot() };
    for (const send of senders.values()) {
      send(state);
    }
  }

  return { join, receive, leave, tick };
}
