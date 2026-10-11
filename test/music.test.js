import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Tests für die Musik-Regie (music.js): Stimmungswahl, Überblendung, Stummschaltung, Stückliste.
const source = await readFile(new URL('../public/entwurf/music.js', import.meta.url), 'utf8');
const context = { Math, URL, fetch: async () => ({ ok: false }) };
context.globalThis = context;
vm.runInNewContext(source, context);
const { create, chooseMood, danger } = context.NachtjagdMusic;
const manifest = JSON.parse(await readFile(new URL('../public/assets/music/tracks.json', import.meta.url), 'utf8'));

const player = { x: 0, z: 0, hp: 100 };
const snap = (extra = {}) => ({ phase: 'playing', player, monsters: [], waves: { n: 3, state: 'idle', alive: 0 }, quest: { stage: 'seals' }, env: { sunrise: 0 }, ...extra });
const wolves = n => Array.from({ length: n }, (_, i) => ({ kind: 'wolf', state: 'walk', x: 5 + i, z: 3 }));

test('Stückliste: jede Datei existiert, jede Stimmung ist besetzt', async () => {
  const { access } = await import('node:fs/promises');
  for (const t of manifest) await access(new URL('../public/assets/music/' + t.file, import.meta.url));
  for (const mood of ['dusk', 'explore', 'tension', 'combat', 'victory']) assert.ok(manifest.some(t => t.moods.includes(mood)), mood);
});

test('Stimmung: Auftakt, ruhig, Welle, Kampf mit Nachhall, Endkampf, Sieg, Tod', () => {
  const memory = {};
  assert.equal(chooseMood(snap({ waves: { n: 1, state: 'idle', alive: 0 } }), memory, 1), 'dusk');
  assert.equal(chooseMood(snap(), { time: 400 }, 1), 'explore');
  assert.equal(chooseMood(snap({ waves: { n: 3, state: 'active', alive: 2 } }), { time: 400 }, 1), 'tension');
  const m = { time: 400 };
  assert.equal(chooseMood(snap({ monsters: wolves(4) }), m, 1), 'combat');
  // Gegner weg: Kampfmusik bleibt noch etwa 14 s
  assert.equal(chooseMood(snap(), m, 5), 'combat');
  assert.equal(chooseMood(snap(), m, 20), 'explore');
  assert.equal(chooseMood(snap({ quest: { stage: 'final' } }), { time: 400 }, 1), 'combat');
  assert.equal(chooseMood(snap({ env: { sunrise: 0.9 } }), { time: 400 }, 1), 'victory');
  assert.equal(chooseMood(snap({ phase: 'won' }), { time: 400 }, 1), 'victory');
  assert.equal(chooseMood(snap({ phase: 'dead' }), { time: 400 }, 1), null);
});

test('Kampfnähe: weit entfernte und tote Gegner zählen nicht, schwere doppelt, niedrige Gesundheit erhöht', () => {
  assert.equal(danger(snap({ monsters: [{ kind: 'wolf', state: 'walk', x: 90, z: 0 }, { kind: 'wolf', state: 'dead', x: 1, z: 1 }] })), 0);
  assert.equal(danger(snap({ monsters: [{ kind: 'brute', state: 'walk', x: 4, z: 0 }] })), 2);
  assert.equal(danger({ ...snap(), player: { ...player, hp: 20 } }), 1);
});

function harness() {
  const audios = [];
  const createAudio = () => { const a = { src: '', volume: 0, paused: false, duration: 100, currentTime: 0, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } }; audios.push(a); return a; };
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const music = create({ base: 'http://x/assets/music/', tracks: manifest, createAudio, storage });
  return { audios, music, storage, store };
}
function run(music, s, seconds) { for (let t = 0; t < seconds; t += 0.25) music.update(s, 0.25); }

test('Regie: Auftakt startet, Kampf blendet schnell über, altes Stück verstummt', () => {
  const { audios, music } = harness();
  music.start();
  run(music, snap({ waves: { n: 1, state: 'idle', alive: 0 } }), 10);
  assert.equal(music.mood, 'dusk'); assert.equal(audios.length, 1);
  assert.ok(audios[0].volume > 0.4, 'Auftakt einblenden');
  run(music, snap({ monsters: wolves(4) }), 5);
  assert.equal(music.mood, 'combat'); assert.equal(audios.length, 2);
  assert.ok(audios[0].paused, 'altes Stück ist ausgeblendet und angehalten');
  assert.ok(audios[1].volume > 0.4);
  assert.ok(music.track.moods.includes('combat'));
});

test('Regie: Stimmungswechsel braucht Beständigkeit und Mindestdauer; kein Hin und Her', () => {
  const { audios, music } = harness();
  music.start();
  const calm = snap({ waves: { n: 3, state: 'idle', alive: 0 } }), wave = snap({ waves: { n: 3, state: 'active', alive: 3 } });
  run(music, { ...calm }, 6);
  assert.equal(music.mood, 'explore');
  run(music, wave, 10);   // zu früh: erst nach 25 s Mindestdauer
  assert.equal(music.mood, 'explore'); assert.equal(audios.length, 1);
  run(music, wave, 25);
  assert.equal(music.mood, 'tension'); assert.equal(audios.length, 2);
});

test('Regie: Stück läuft aus, nächstes derselben Stimmung folgt und wiederholt nicht dasselbe', () => {
  const { audios, music } = harness();
  music.start();
  const s = snap({ waves: { n: 3, state: 'idle', alive: 0 } });
  run(music, s, 4);
  const first = music.track.file;
  audios[0].currentTime = 96;   // 4 s vor Ende bei 100 s Länge
  run(music, s, 1);
  assert.equal(audios.length, 2);
  assert.notEqual(music.track.file, first);
});

test('Stumm, Pause und Lautstärke: M schaltet stumm, Pause dämpft, Einstellung bleibt gespeichert', () => {
  const { audios, music, store } = harness();
  music.start();
  const s = snap({ waves: { n: 3, state: 'idle', alive: 0 } });
  run(music, s, 12);
  const normal = audios[0].volume; assert.ok(normal > 0.3);
  music.setPaused(true); run(music, s, 4);
  assert.ok(audios[0].volume < normal * 0.5 && audios[0].volume > 0);
  music.setPaused(false); run(music, s, 4);
  assert.ok(Math.abs(audios[0].volume - normal) < 0.02);
  assert.equal(music.toggleMute(), true); run(music, s, 4);
  assert.ok(audios[0].volume < 0.001);
  assert.ok(JSON.parse(store.get('nachtjagd-music')).muted);
  // Neue Regie liest die gespeicherte Einstellung
  const again = create({ base: 'http://x/', tracks: manifest, createAudio: () => ({ play() { return Promise.resolve(); }, pause() {} }), storage: { getItem: k => store.get(k), setItem() {} } });
  assert.equal(again.muted, true);
});

test('Stop und Tod blenden aus; ohne Stückliste bleibt es still', () => {
  const { audios, music } = harness();
  music.start(); run(music, snap(), 6);
  run(music, snap({ phase: 'dead' }), 6);
  assert.ok(audios[0].volume < 0.001);
  const silent = create({ base: 'http://x/', tracks: [], createAudio: () => { throw new Error('darf nicht starten'); } });
  silent.start(); run(silent, snap(), 5);
  assert.equal(silent.track, null);
});
