'use strict';

// Teamspiel für bis zu vier Spieler ohne eigenen Server: Wer einen Raum eröffnet, ist Host und rechnet Gegner,
// Wellen und Ziele in seinem Browser (gameplay-core.js, role 'host'). Die anderen verbinden sich über WebRTC direkt
// mit ihm. Den Verbindungsaufbau vermittelt der öffentliche PeerJS-Dienst; die Bibliothek wird erst geladen,
// wenn jemand einen Raum eröffnet oder beitritt. Für Tests: ?peerhost=localhost&peerport=9000 (eigener peer-Server).
(function (root) {
  const PREFIX = 'nachtjagd-team-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen
  const PEER_LIBRARY = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const MAX_PLAYERS = 4, MAX_BYTES = 64000;
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function randomCode(random = () => (crypto.getRandomValues(new Uint8Array(1))[0] / 256)) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length) % CODE_CHARS.length];
    return code;
  }
  function cleanCode(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IO01]/g, '').slice(0, 6);
  }
  function cleanName(text) {
    const name = String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16).trim();
    return name || 'Jäger';
  }
  function codeFromUrl(search = typeof location !== 'undefined' ? location.search : '') {
    const code = cleanCode(new URLSearchParams(search).get('raum'));
    return code.length === 6 ? code : null;
  }
  function peerOptions(search = typeof location !== 'undefined' ? location.search : '') {
    const query = new URLSearchParams(search), host = query.get('peerhost');
    return host ? { host, port: Number(query.get('peerport')) || 9000, path: '/', secure: false } : {};
  }

  // --- Nachrichtenprüfung: Gäste und Host gelten gegenseitig als nicht vertrauenswürdig.
  const num = (v, lo, hi) => finite(v) ? clamp(v, lo, hi) : null;
  function profile(p) {
    if (!p || typeof p !== 'object') return null;
    const x = num(p.x, -2000, 2000), y = num(p.y, -500, 1500), z = num(p.z, -2000, 2000);
    if (x === null || y === null || z === null) return null;
    return {
      x, y, z, yaw: num(p.yaw, -1000, 1000) ?? 0, pitch: num(p.pitch, -2, 2) ?? 0, hp: num(p.hp, 0, 200) ?? 100, down: !!p.down,
      vx: num(p.vx, -40, 40) ?? 0, vz: num(p.vz, -40, 40) ?? 0, w: Number.isInteger(p.w) ? clamp(p.w, 0, 2) : 0, light: p.light !== false
    };
  }
  function guestEvent(e) {
    if (!e || typeof e !== 'object') return null;
    if (e.type === 'netHit' && Number.isInteger(e.id)) return { type: e.type, id: e.id, damage: num(e.damage, 0, 400) ?? 0, head: !!e.head, dx: num(e.dx, -1, 1) ?? 0, dz: num(e.dz, -1, 1) ?? 0 };
    if (e.type === 'netInteract' && (e.what === 'seal' || e.what === 'bell')) return { type: e.type, what: e.what, index: Number.isInteger(e.index) ? clamp(e.index, 0, 16) : undefined };
    if (e.type === 'netTake' && Number.isInteger(e.id)) return { type: e.type, id: e.id };
    return null;
  }
  // Nachricht eines Gastes an den Host: null, wenn sie nicht dem Protokoll entspricht.
  function fromGuest(data) {
    if (!data || typeof data !== 'object' || typeof data.t !== 'string') return null;
    try { if (JSON.stringify(data).length > MAX_BYTES) return null; } catch (error) { return null; }
    if (data.t === 'hello') return { t: 'hello', name: cleanName(data.name) };
    if (data.t === 'me') { const p = profile(data.p); return p ? { t: 'me', p } : null; }
    if (data.t === 'ev' && Array.isArray(data.list)) return { t: 'ev', list: data.list.slice(0, 40).map(guestEvent).filter(Boolean) };
    return null;
  }
  // Nachricht des Hosts an einen Gast (Weltzustand wird im Kern noch einmal geprüft).
  function fromHost(data) {
    if (!data || typeof data !== 'object' || typeof data.t !== 'string') return null;
    if (data.t === 'welcome' && typeof data.id === 'string') return { t: 'welcome', id: data.id.slice(0, 8), host: cleanName(data.host) };
    if (data.t === 'full') return { t: 'full' };
    if (data.t === 'world' && data.s && typeof data.s === 'object') {
      const team = Array.isArray(data.team) ? data.team.slice(0, MAX_PLAYERS).map((m) => {
        const p = profile(m); return p && typeof m.id === 'string' ? { ...p, id: m.id.slice(0, 8), name: cleanName(m.name) } : null;
      }).filter(Boolean) : [];
      return { t: 'world', s: data.s, team, epoch: Number.isInteger(data.epoch) ? data.epoch : 0 };
    }
    if (data.t === 'hurt') return { t: 'hurt', damage: num(data.damage, 0, 200) ?? 0, melee: !!data.melee, kind: typeof data.kind === 'string' ? data.kind.slice(0, 16) : '' };
    if (data.t === 'lei') return { t: 'lei', n: num(data.n, 0, 500) ?? 0 };
    if (data.t === 'note' && typeof data.text === 'string') return { t: 'note', text: data.text.replace(/[<>]/g, '').slice(0, 120) };
    return null;
  }

  // --- PeerJS nachladen (nur beim ersten Teamspiel)
  let loading = null;
  function loadPeer() {
    if (root.Peer) return Promise.resolve(root.Peer);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PEER_LIBRARY; script.async = true;
      script.onload = () => root.Peer ? resolve(root.Peer) : reject(new Error('PeerJS fehlt'));
      script.onerror = () => { loading = null; reject(new Error('Die Verbindungsbibliothek konnte nicht geladen werden.')); };
      document.head.append(script);
    });
    return loading;
  }
  function openPeer(Peer, id) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, peerOptions());
      const timer = setTimeout(() => reject(new Error('Der Vermittlungsdienst antwortet nicht.')), 15000);
      peer.on('open', () => { clearTimeout(timer); resolve(peer); });
      peer.on('error', (error) => {
        clearTimeout(timer);
        if (error.type === 'unavailable-id') { peer.destroy(); resolve(null); } else reject(error);
      });
    });
  }

  // Raum eröffnen. onEvent erhält {type:'join'|'leave'|'message', id, name, msg}.
  async function host({ name, onEvent = () => {} }) {
    const Peer = await loadPeer();
    let peer = null, code = null;
    for (let attempt = 0; attempt < 5 && !peer; attempt++) { code = randomCode(); peer = await openPeer(Peer, PREFIX + code); }
    if (!peer) throw new Error('Kein freier Raumcode gefunden.');
    const guests = new Map();
    let serial = 0, closed = false;
    peer.on('connection', (conn) => {
      let id = null;
      conn.on('data', (raw) => {
        const msg = fromGuest(raw);
        if (!msg) return;
        if (msg.t === 'hello' && id === null) {
          if (guests.size >= MAX_PLAYERS - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
          id = 'g' + (++serial);
          guests.set(id, { id, conn, name: msg.name, profile: null, seen: performance.now() });
          conn.send({ t: 'welcome', id, host: cleanName(name) });
          onEvent({ type: 'join', id, name: msg.name });
          return;
        }
        const g = id && guests.get(id);
        if (!g) return;
        g.seen = performance.now();
        if (msg.t === 'me') g.profile = msg.p;
        onEvent({ type: 'message', id, name: g.name, msg });
      });
      const drop = () => { if (id && guests.has(id)) { const g = guests.get(id); guests.delete(id); onEvent({ type: 'leave', id, name: g.name }); } id = null; };
      conn.on('close', drop); conn.on('error', drop);
    });
    peer.on('disconnected', () => { if (!closed) peer.reconnect(); });
    return {
      role: 'host', code, id: 'h', name: cleanName(name), guests,
      sendTo(id, msg) { const g = guests.get(id); if (g && g.conn.open) g.conn.send(msg); },
      broadcast(msg) { for (const g of guests.values()) if (g.conn.open) g.conn.send(msg); },
      // Gäste, die seit 12 s nichts gesendet haben, gelten als getrennt.
      sweep() { const now = performance.now(); for (const g of [...guests.values()]) if (now - g.seen > 12000) { g.conn.close(); guests.delete(g.id); onEvent({ type: 'leave', id: g.id, name: g.name }); } },
      close() { closed = true; for (const g of guests.values()) g.conn.close(); guests.clear(); peer.destroy(); }
    };
  }

  // Raum beitreten. onEvent erhält {type:'message', msg} oder {type:'closed', reason}.
  async function join(code, { name, onEvent = () => {} }) {
    code = cleanCode(code);
    if (code.length !== 6) throw new Error('Der Raumcode hat sechs Zeichen.');
    const Peer = await loadPeer();
    const peer = await openPeer(Peer, undefined);
    return new Promise((resolve, reject) => {
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      let room = null, closed = false;
      const timer = setTimeout(() => { if (!room) { peer.destroy(); reject(new Error(`Raum ${code} antwortet nicht.`)); } }, 15000);
      peer.on('error', (error) => {
        if (room) return;
        clearTimeout(timer); peer.destroy();
        reject(new Error(error.type === 'peer-unavailable' ? `Raum ${code} nicht gefunden. Ist der Host noch im Spiel?` : `Verbindungsfehler (${error.type})`));
      });
      conn.on('open', () => conn.send({ t: 'hello', name: cleanName(name) }));
      conn.on('data', (raw) => {
        const msg = fromHost(raw);
        if (!msg) return;
        if (msg.t === 'full') { clearTimeout(timer); peer.destroy(); reject(new Error('Der Raum ist voll (höchstens vier Spieler).')); return; }
        if (msg.t === 'welcome' && !room) {
          clearTimeout(timer);
          room = {
            role: 'guest', code, id: msg.id, name: cleanName(name), hostName: msg.host,
            send(m) { if (conn.open) conn.send(m); },
            close() { closed = true; conn.close(); peer.destroy(); }
          };
          resolve(room); return;
        }
        if (room) onEvent({ type: 'message', msg });
      });
      conn.on('close', () => { if (room && !closed) onEvent({ type: 'closed', reason: 'Der Host hat das Spiel beendet.' }); });
    });
  }

  const api = { host, join, randomCode, cleanCode, cleanName, codeFromUrl, peerOptions, fromGuest, fromHost, profile, MAX_PLAYERS, PREFIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdCoop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
