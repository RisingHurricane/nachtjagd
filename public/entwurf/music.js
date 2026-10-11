'use strict';

// Musik-Regie: wählt je nach Spielgeschehen eine Stimmung und blendet zwischen den Stücken über.
// Stücke und Stimmungen stehen in assets/music/tracks.json; neue Dateien brauchen nur dort einen Eintrag.
// Stimmungen: dusk (Auftakt im Abendrot), explore (ruhige Nacht), tension (Welle läuft), combat (viele Gegner nah, Endkampf),
// victory (Morgengrauen). Wiedergabe über HTMLAudioElement (Streaming, kein Dekodieren der ganzen Stücke im Speicher).
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SCRIPT = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';

  // Kampfnähe: Gegner im Umkreis von 28 m, schwere Gegner zählen doppelt, niedrige Gesundheit erhöht den Wert.
  function danger(s) {
    const p = s.player;
    if (!p) return 0;
    let n = 0;
    for (const m of s.monsters || []) {
      if (m.state === 'dead') continue;
      if (Math.hypot(m.x - p.x, m.z - p.z) < 28) n += m.kind === 'samca' || m.kind === 'brute' ? 2 : m.kind === 'bat' ? 0.25 : 1;
    }
    return n + (p.hp < 35 ? 1 : 0);
  }

  // Reine Entscheidung ohne Ton: liefert die Stimmung für den aktuellen Spielstand. `memory` hält Haltezeiten zwischen den Aufrufen.
  function chooseMood(s, memory, dt) {
    if (!s || s.phase === 'dead' || s.phase === 'ready') return null;
    if (s.phase === 'won' || (s.env && s.env.sunrise > 0.5)) return 'victory';
    memory.time = (memory.time || 0) + dt;
    const q = s.quest && s.quest.stage, w = s.waves || {};
    if (q === 'final') return 'combat';
    const d = danger(s);
    if (d >= 3) memory.combatUntil = memory.time + 14;
    if (memory.combatUntil && memory.time < memory.combatUntil) return 'combat';
    if (w.state === 'active' && w.alive > 0) return 'tension';
    if (memory.time < 150 && (w.n || 0) <= 1) return 'dusk';
    return 'explore';
  }

  function create({ base, tracks, createAudio = () => new Audio(), storage } = {}) {
    let list = tracks || [], mood = null, current = null, previous = null, lastFile = null, lastSwitch = -1e9;
    let master = 0.5, muted = false, ducked = false, running = false, pending = null, pendingFor = 0;
    const memory = {}, listeners = [];
    try { const v = storage && storage.getItem('nachtjagd-music'); if (v) { const o = JSON.parse(v); master = clamp(Number(o.volume ?? 0.5), 0, 1); muted = !!o.muted; } } catch (e) { /* ohne Speicher */ }
    const save = () => { try { storage && storage.setItem('nachtjagd-music', JSON.stringify({ volume: master, muted })); } catch (e) { /* ohne Speicher */ } };
    const url = file => new URL(file, base).href;
    const target = () => (muted ? 0 : master) * (ducked ? 0.3 : 1);

    function pick(forMood) {
      const options = list.filter(t => (t.moods || []).includes(forMood));
      if (!options.length) return null;
      const fresh = options.filter(t => t.file !== lastFile);
      const pool = fresh.length ? fresh : options;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // Neues Stück starten, das alte läuft über `seconds` aus.
    function play(track, seconds) {
      if (!track) return;
      if (previous) { previous.audio.pause(); previous = null; }
      previous = current;
      const audio = createAudio();
      audio.src = url(track.file); audio.loop = false; audio.volume = 0;
      current = { audio, track, level: 0, fadeIn: Math.max(0.01, seconds), fadeOut: 0, gain: track.volume ?? 1 };
      lastFile = track.file; lastSwitch = memory.time || 0;
      const started = audio.play(); if (started && started.catch) started.catch(() => { /* Browser verlangt erst eine Eingabe */ });
      if (previous) previous.fadeOut = Math.max(0.01, seconds);
      listeners.forEach(f => f(track));
    }
    function stopAll(seconds = 2) {
      for (const slot of [current, previous]) if (slot) slot.fadeOut = Math.max(0.01, seconds);
      mood = null;
    }
    function ramp(slot, dt) {
      if (!slot) return;
      const want = slot.fadeOut ? 0 : target() * slot.gain;
      const rate = slot.fadeOut ? 1 / slot.fadeOut : 1 / slot.fadeIn;
      slot.level += clamp(want - slot.level, -rate * dt, rate * dt);
      slot.audio.volume = clamp(slot.level, 0, 1);
    }

    return {
      start() { running = true; memory.time = 0; memory.combatUntil = 0; mood = null; pending = null; },
      stop() { running = false; stopAll(1.5); },
      // Pausenmenü: leiser, aber nicht still.
      setPaused(v) { ducked = !!v; },
      toggleMute() { muted = !muted; save(); return muted; },
      setVolume(v) { master = clamp(v, 0, 1); save(); },
      get volume() { return master; }, get muted() { return muted; },
      get mood() { return mood; }, get track() { return current && current.track; },
      onTrack(f) { listeners.push(f); },
      setTracks(t) { list = t; },
      update(s, dt) {
        if (running) {
          const want = chooseMood(s, memory, dt);
          if (want === null) { if (mood) stopAll(3); }
          else if (want !== mood) {
            // Kampf und Sieg sofort, alles andere erst nach drei Sekunden Beständigkeit und 25 s Mindestdauer.
            pendingFor = pending === want ? pendingFor + dt : 0; pending = want;
            const urgent = want === 'combat' || want === 'victory';
            if (urgent || (pendingFor > 3 && memory.time - lastSwitch > 25) || !current) {
              const track = pick(want) || pick('explore');
              if (track) { mood = want; play(track, urgent ? 2.5 : 6); }
              pending = null; pendingFor = 0;
            }
          } else pending = null;
          // Stück läuft aus: nächstes derselben Stimmung einblenden.
          if (current && mood && current.audio.duration && current.audio.currentTime > current.audio.duration - 6 && !current.next) {
            current.next = true; const track = pick(mood); if (track) play(track, 6);
          }
        }
        ramp(current, dt);
        if (previous) { ramp(previous, dt); if (previous.level <= 0.001 && previous.fadeOut) { previous.audio.pause(); previous = null; } }
        if (!running && current && current.level <= 0.001 && current.fadeOut) { current.audio.pause(); current = null; }
      }
    };
  }

  // Stückliste laden; ohne Datei bleibt es still.
  async function load(manifestUrl) {
    try { const r = await fetch(manifestUrl); if (!r.ok) return []; const list = await r.json(); return Array.isArray(list) ? list.filter(t => t && typeof t.file === 'string') : []; } catch (e) { return []; }
  }
  // Auf GitHub Pages liegen die Dateien eine Ebene über entwurf/, in der Artifact-Vorschau neben der Seite.
  function baseUrl() {
    const path = SCRIPT ? new URL(SCRIPT).pathname : '';
    return new URL(/\/entwurf\/[^/]*$/.test(path) ? '../assets/music/' : './assets/music/', SCRIPT || location.href);
  }

  const api = { create, chooseMood, danger, load, baseUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdMusic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
