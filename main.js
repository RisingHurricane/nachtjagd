'use strict';

// Ego-Client: Verbindung zum Server, Eingabe (WASD und Maus), Ego-Kamera und die anderen Spieler
// als Kapseln mit Namensschild. Der Server ist autoritativ: dieser Client schickt nur Eingaben
// und zeichnet den Zustand, den der Server meldet.

import * as THREE from 'three';
import { buildWorld, createMoonAndStars, createSky, createSnow, FOG_COLOR, FOG_DENSITY } from './world.js';

const EYE_HEIGHT = 1.7; // Augenhöhe in Metern
const FLASHLIGHT_INTENSITY = 60; // Taschenlampe (Taste F), an oder aus
const MOUSE_SENSITIVITY = 0.0025; // Radiant je Pixel Mausbewegung
const PITCH_LIMIT = Math.PI / 2 - 0.05; // nicht ganz senkrecht nach oben oder unten
const INPUT_INTERVAL_MS = 50; // höchstens 20 Eingaben pro Sekunde, wenn sie sich ändern
const SMOOTH_RATE = 18; // Glättung der angezeigten Positionen (größer heißt schneller)
const SNAP_DISTANCE = 5; // bei größeren Sprüngen (Wiederkehr nach dem Tod) ohne Gleiten

const KEY_MAP = {
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right',
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
};

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('name');
const hintEl = document.getElementById('hint');

// Verbindung und Zustand vom Server
let myId = null;
let socket = null;
let serverPlayers = [];

// Eingabe des Spielers
const pressed = new Set();
const look = { yaw: 0, pitch: 0 }; // Blickrichtung, wird lokal gedreht und an den Server gemeldet
let lastSentKey = null;
let lastSentAt = 0;

// Anzeige des eigenen Spielers (geglättet) und der anderen Spieler
const self = { x: 0, z: 0, ready: false };
const remote = new Map(); // id -> { group, body, label, name, color }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Hält den Winkel im Bereich -π bis π.
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// Die Farbe kommt als CSS-Text vom Server (hsl). Der Browser wandelt sie in #rrggbb um.
const colorContext = document.createElement('canvas').getContext('2d');
function toHexColor(cssColor) {
  colorContext.fillStyle = '#888888';
  colorContext.fillStyle = cssColor;
  return colorContext.fillStyle;
}

// ---------- Szene ----------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY); // dichter Nebel in Palettenfarbe
scene.add(createSky());
const MOON_DIRECTION = new THREE.Vector3(-40, 80, 30); // gleiche Richtung wie das Mondlicht
scene.add(createMoonAndStars(MOON_DIRECTION));

const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 800);
camera.rotation.order = 'YXZ'; // erst Blick nach links und rechts, dann nach oben und unten
scene.add(camera); // nötig, damit die Taschenlampe an der Kamera mitwandert

// Licht: bläuliches Mondlicht von oben, bläulicher Umgebungsanteil. So bleiben Dächer und Berge
// im Norden sichtbar, auch ohne Lampen.
scene.add(new THREE.HemisphereLight(0x9eb8c4, 0x2f3131, 1.6));
const moon = new THREE.DirectionalLight(0xb4c0cb, 1.8);
moon.position.copy(MOON_DIRECTION);
scene.add(moon);

// Taschenlampe: Scheinwerfer an der Kamera, Ziel liegt geradeaus. Aus heißt Intensität 0, so
// wird die Szene beim Umschalten nicht neu übersetzt.
const flashlight = new THREE.SpotLight(0xdfe9f2, 0, 60, 0.4, 0.35, 2);
const flashlightTarget = new THREE.Object3D();
flashlight.position.set(0.2, -0.15, 0);
flashlightTarget.position.set(0, -0.05, -20);
camera.add(flashlight, flashlightTarget);
flashlight.target = flashlightTarget;
let flashlightOn = false;

// Schnee um die Kamera (Punkte, eine Draw-Anweisung)
const snow = createSnow(3000);
scene.add(snow.object);

// Die Welt (Boden, Häuser, Schloss, See, Tunnel, Wald) baut world.js aus level.json.
fetch('./level.json')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`level.json: HTTP ${response.status}`);
    }
    return response.json();
  })
  .then((level) => {
    scene.add(buildWorld(level));
  })
  .catch((error) => {
    console.error(error);
    hintEl.textContent = 'Die Spielwelt konnte nicht geladen werden.';
  });

// Gemeinsame Geometrie für alle anderen Spieler: 1,8 m hohe Kapsel.
const capsuleGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);

// Namensschild als Sprite aus einer Canvas-Textur, Breite passt sich dem Namen an.
function makeLabel(text) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = 'bold 34px system-ui, sans-serif';
  const width = Math.ceil(measure.measureText(text).width) + 32;

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = width;
  labelCanvas.height = 64;
  const g = labelCanvas.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(10, 14, 20, 0.6)';
  g.fillRect(0, 0, width, 64);
  g.fillStyle = '#e6e9ef';
  g.fillText(text, width / 2, 34);

  const texture = new THREE.CanvasTexture(labelCanvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5 * (width / 64), 0.5, 1);
  sprite.position.y = 2.2;
  return sprite;
}

function disposeLabel(sprite) {
  sprite.material.map.dispose();
  sprite.material.dispose();
}

function createRemote(player) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: toHexColor(player.color), roughness: 0.7 });
  const body = new THREE.Mesh(capsuleGeometry, material);
  body.position.y = 0.9; // Mitte der Kapsel bei halber Höhe
  group.add(body);
  const label = makeLabel(player.name);
  group.add(label);
  group.position.set(player.x, 0, player.z);
  scene.add(group);
  return { group, body, label, name: player.name, color: player.color };
}

function removeRemote(entry) {
  scene.remove(entry.group);
  disposeLabel(entry.label);
  entry.body.material.dispose();
}

// Gleicht die Anzeige der anderen Spieler mit dem letzten Zustand des Servers ab.
function updateRemotes(smoothing) {
  const seen = new Set();
  for (const p of serverPlayers) {
    if (p.id === myId) {
      continue;
    }
    seen.add(p.id);
    let entry = remote.get(p.id);
    if (!entry) {
      entry = createRemote(p);
      remote.set(p.id, entry);
    }
    if (entry.name !== p.name) {
      entry.group.remove(entry.label);
      disposeLabel(entry.label);
      entry.label = makeLabel(p.name);
      entry.group.add(entry.label);
      entry.name = p.name;
    }
    if (entry.color !== p.color) {
      entry.body.material.color.set(toHexColor(p.color));
      entry.color = p.color;
    }
    const pos = entry.group.position;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    if (Math.hypot(dx, dz) > SNAP_DISTANCE) {
      pos.set(p.x, 0, p.z);
    } else {
      pos.x += dx * smoothing;
      pos.z += dz * smoothing;
    }
    entry.group.rotation.y = p.yaw;
  }
  for (const [id, entry] of remote) {
    if (!seen.has(id)) {
      removeRemote(entry);
      remote.delete(id);
    }
  }
}

// Ego-Kamera: Augenhöhe am eigenen Spieler, Blickrichtung aus der Maus.
function updateCamera(smoothing) {
  const me = serverPlayers.find((p) => p.id === myId);
  if (me) {
    const dx = me.x - self.x;
    const dz = me.z - self.z;
    if (!self.ready || Math.hypot(dx, dz) > SNAP_DISTANCE) {
      self.x = me.x;
      self.z = me.z;
      self.ready = true;
    } else {
      self.x += dx * smoothing;
      self.z += dz * smoothing;
    }
  }
  camera.position.set(self.x, EYE_HEIGHT, self.z);
  camera.rotation.x = look.pitch;
  camera.rotation.y = look.yaw;
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) {
    return;
  }
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

// ---------- Eingabe ----------

// Mausklick auf das Bild aktiviert die Maus (Pointer Lock). Esc gibt sie wieder frei.
canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  hintEl.textContent = locked
    ? 'WASD bewegt, Maus dreht, F schaltet die Taschenlampe. Esc gibt die Maus wieder frei.'
    : 'Klick ins Bild startet die Steuerung. WASD bewegt, Maus dreht, F schaltet die Taschenlampe.';
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) {
    return;
  }
  look.yaw = wrapAngle(look.yaw - event.movementX * MOUSE_SENSITIVITY);
  look.pitch = clamp(look.pitch - event.movementY * MOUSE_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
});

window.addEventListener('keydown', (event) => {
  if (document.activeElement === nameInput) {
    return;
  }
  if (event.key.toLowerCase() === 'f' && !event.repeat) {
    flashlightOn = !flashlightOn;
    flashlight.intensity = flashlightOn ? FLASHLIGHT_INTENSITY : 0;
    return;
  }
  const direction = KEY_MAP[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    pressed.add(direction);
  }
});

window.addEventListener('keyup', (event) => {
  const direction = KEY_MAP[event.key.toLowerCase()];
  if (direction) {
    pressed.delete(direction);
  }
});

// Verlässt das Fenster den Fokus, bleiben keine Tasten hängen.
window.addEventListener('blur', () => {
  pressed.clear();
});

// Schickt die Eingabe, wenn sie sich ändert, höchstens alle 50 ms (20 Mal pro Sekunde).
function sendInputIfChanged(now) {
  const mx = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
  const mz = (pressed.has('up') ? 1 : 0) - (pressed.has('down') ? 1 : 0);
  const key = `${mx},${mz},${look.yaw.toFixed(3)},${look.pitch.toFixed(3)}`;
  if (key === lastSentKey || now - lastSentAt < INPUT_INTERVAL_MS) {
    return;
  }
  if (send({ type: 'input', mx, mz, yaw: look.yaw, pitch: look.pitch, fire: false })) {
    lastSentKey = key;
    lastSentAt = now;
  }
}

// ---------- Verbindung ----------

// Standard ist Mehrspieler ohne Server (net.js: ein Spieler hostet, die anderen treten per Link bei).
// Mit ?mode=ws verbindet sich der Client stattdessen per WebSocket mit dem Node-Server (server.js).
let transport = null;

// Der Pfad ist relativ zur Seite, damit das Spiel auch unter einem Unterpfad läuft.
function socketUrl() {
  const base = location.pathname.replace(/[^/]*$/, '');
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${base}ws`;
}

function send(message) {
  if (transport) {
    return transport.send(message);
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function sendName() {
  const name = nameInput.value.trim();
  if (name) {
    send({ type: 'name', name });
  }
}

function handleMessage(message) {
  if (message.type === 'welcome') {
    myId = message.id;
    lastSentKey = null; // nach dem Beitritt die aktuelle Eingabe sofort senden
    sendName();
  } else if (message.type === 'state') {
    serverPlayers = message.players;
  }
}

function showInvite(code) {
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const button = document.getElementById('share');
  button.hidden = false;
  button.textContent = `Einladungslink kopieren (${code})`;
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = 'Link kopiert';
    } catch {
      window.prompt('Link zum Teilen:', link);
    }
  };
}

function connectWebSocket() {
  socket = new WebSocket(socketUrl());
  socket.onopen = () => {
    statusEl.textContent = 'Verbunden';
    lastSentKey = null; // nach dem Verbinden die aktuelle Eingabe sofort senden
    sendName();
  };
  socket.onmessage = (event) => handleMessage(JSON.parse(event.data));
  socket.onclose = () => {
    statusEl.textContent = 'Getrennt, neuer Versuch …';
    serverPlayers = [];
    setTimeout(connectWebSocket, 1500);
  };
}

async function connect() {
  if (new URLSearchParams(location.search).get('mode') === 'ws') {
    connectWebSocket();
    return;
  }
  try {
    const { connectRoom } = await import('./net.js');
    transport = await connectRoom({
      onMessage: handleMessage,
      onStatus: (text) => { statusEl.textContent = text; },
      onRoom: showInvite,
    });
    lastSentKey = null;
    sendName(); // der Host bekommt seine welcome-Nachricht schon vor der Zuweisung von transport
  } catch (error) {
    statusEl.textContent = `Verbindung fehlgeschlagen (${error.message || error.type || 'Fehler'}).`;
  }
}

nameInput.addEventListener('change', () => {
  try {
    localStorage.setItem('spielername', nameInput.value);
  } catch {
    // Speicher nicht verfügbar, der Name gilt dann nur für diese Sitzung.
  }
  sendName();
});

try {
  nameInput.value = localStorage.getItem('spielername') || '';
} catch {
  // Ohne Speicher bleibt das Feld leer.
}

// ---------- Schleife ----------

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  const smoothing = 1 - Math.exp(-SMOOTH_RATE * dt);

  sendInputIfChanged(now);
  updateRemotes(smoothing);
  updateCamera(smoothing);
  snow.update(dt, camera.position, now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

connect();
requestAnimationFrame(frame);
