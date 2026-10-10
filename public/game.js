'use strict';

// Spielzustand, Bewegung und Kollision ohne Netzwerk. Der Server ruft step() regelmäßig auf
// und schickt snapshot() an die Clients. Dadurch lässt sich alles direkt testen.

export const MAX_PLAYERS = 4;

const BOUND = 98; // Kartenrand: Spieler bleiben innerhalb von ±98 Meter
const PLAYER_RADIUS = 0.5; // Spieler sind Kreise mit 0,5 m Radius
const PLAYER_SPEED = 6; // Meter pro Sekunde
const PLAYER_HP = 100;
const START_AMMO = 80; // Munition der Pistole zu Beginn
const MAX_NAME_LENGTH = 16;
const MAX_STEP_SECONDS = 0.1;
const COLLISION_PASSES = 3; // Mehrere Durchgänge, damit Spieler zwischen zwei Hindernissen nicht steckenbleiben

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Wandelt eine beliebige Eingabe in eine Zahl zwischen -1 und 1 um.
function sanitizeAxis(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, -1, 1) : 0;
}

// Normalisiert den Blickwinkel auf -π bis π. Ungültige Werte liefern null (keine Änderung).
function sanitizeYaw(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.atan2(Math.sin(number), Math.cos(number));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Liest die Daten aus level.json und prüft die wichtigsten Felder.
export function parseLevel(text) {
  const level = JSON.parse(text);
  if (!Number.isFinite(level.size)) {
    throw new Error('level.json: "size" fehlt');
  }
  for (const key of ['playerSpawns', 'boxes', 'circles']) {
    if (!Array.isArray(level[key])) {
      throw new Error(`level.json: "${key}" fehlt`);
    }
  }
  if (level.playerSpawns.length === 0) {
    throw new Error('level.json: Es fehlen Startpunkte');
  }
  if (!level.lake || !Number.isFinite(level.lake.r)) {
    throw new Error('level.json: "lake" fehlt');
  }
  return level;
}

// Schiebt einen Spieler aus einem Rechteck, das um den Spielerradius erweitert ist.
// Liegt der Mittelpunkt darin, wird er zur nächsten Seite hinausgeschoben.
function pushOutOfBox(p, box) {
  const minX = box.minX - PLAYER_RADIUS;
  const maxX = box.maxX + PLAYER_RADIUS;
  const minZ = box.minZ - PLAYER_RADIUS;
  const maxZ = box.maxZ + PLAYER_RADIUS;
  if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) {
    return;
  }
  const toLeft = p.x - minX;
  const toRight = maxX - p.x;
  const toBottom = p.z - minZ;
  const toTop = maxZ - p.z;
  const least = Math.min(toLeft, toRight, toBottom, toTop);
  if (least === toLeft) {
    p.x = minX;
  } else if (least === toRight) {
    p.x = maxX;
  } else if (least === toBottom) {
    p.z = minZ;
  } else {
    p.z = maxZ;
  }
}

// Hält den Spieler außerhalb eines Kreises mit dem Mindestabstand minDist.
// Gilt für Bäume, Türme, den Brunnen und den See (der See ist nicht betretbar).
function keepOutsideCircle(p, cx, cz, minDist) {
  const dx = p.x - cx;
  const dz = p.z - cz;
  const distance = Math.hypot(dx, dz);
  if (distance >= minDist) {
    return;
  }
  if (distance === 0) {
    p.x = cx + minDist;
    return;
  }
  p.x = cx + (dx / distance) * minDist;
  p.z = cz + (dz / distance) * minDist;
}

export function createGame(level) {
  if (!level) {
    throw new Error('createGame braucht ein Level');
  }
  const players = new Map();
  const world = { width: level.size, height: level.size };

  // Hindernisse aus dem Level, vorab in eine einfache Form gebracht.
  const obstacles = [
    ...level.boxes.map((b) => ({
      type: 'box',
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
    })),
    ...level.circles.map((c) => ({ type: 'circle', x: c.x, z: c.z, r: c.r })),
  ];

  // Hält den Spieler innerhalb des Kartenrands und außerhalb aller Hindernisse.
  function resolveCollisions(p) {
    for (let pass = 0; pass < COLLISION_PASSES; pass++) {
      for (const o of obstacles) {
        if (o.type === 'box') {
          pushOutOfBox(p, o);
        } else {
          keepOutsideCircle(p, o.x, o.z, o.r + PLAYER_RADIUS);
        }
      }
      keepOutsideCircle(p, level.lake.x, level.lake.z, level.lake.r + PLAYER_RADIUS);
      p.x = clamp(p.x, -BOUND, BOUND);
      p.z = clamp(p.z, -BOUND, BOUND);
    }
  }

  // Legt einen Spieler an einem Startpunkt an. Gibt die id zurück oder null, wenn der Raum voll ist.
  function addPlayer() {
    if (players.size >= MAX_PLAYERS) {
      return null;
    }
    const id = globalThis.crypto.randomUUID().slice(0, 8);
    const spawn = level.playerSpawns[Math.floor(Math.random() * level.playerSpawns.length)];
    const player = {
      id,
      name: `Spieler ${id.slice(0, 4)}`,
      color: `hsl(${Math.floor(Math.random() * 360)} 80% 60%)`,
      x: spawn.x,
      z: spawn.z,
      yaw: 0,
      mx: 0, // Bewegung nach rechts (-1 bis 1), relativ zur Blickrichtung
      mz: 0, // Bewegung nach vorn (-1 bis 1), relativ zur Blickrichtung
      fire: false,
      hp: PLAYER_HP,
      ammo: START_AMMO,
      score: 0,
      alive: true,
    };
    resolveCollisions(player);
    players.set(id, player);
    return id;
  }

  function removePlayer(id) {
    players.delete(id);
  }

  // Setzt den Namen, höchstens 16 Zeichen. Leere oder ungültige Namen werden ignoriert.
  function setName(id, name) {
    const player = players.get(id);
    if (!player || typeof name !== 'string') {
      return;
    }
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed) {
      player.name = trimmed;
    }
  }

  // Übernimmt die Eingabe eines Spielers. Alle Werte werden geprüft und begrenzt.
  function setInput(id, input) {
    const player = players.get(id);
    if (!player || !input || typeof input !== 'object') {
      return;
    }
    player.mx = sanitizeAxis(input.mx);
    player.mz = sanitizeAxis(input.mz);
    const yaw = sanitizeYaw(input.yaw);
    if (yaw !== null) {
      player.yaw = yaw;
    }
    player.fire = input.fire === true;
  }

  // Bewegt alle lebenden Spieler um dt Sekunden weiter. Zuerst x, dann z,
  // damit der Spieler an Wänden entlang gleitet.
  function step(dt) {
    const seconds = clamp(Number(dt) || 0, 0, MAX_STEP_SECONDS);
    for (const p of players.values()) {
      if (!p.alive) {
        continue;
      }
      // Eingabe auf Länge 1 begrenzen, damit diagonale Bewegung nicht schneller ist.
      let mx = p.mx;
      let mz = p.mz;
      const length = Math.hypot(mx, mz);
      if (length > 1) {
        mx /= length;
        mz /= length;
      }
      // Blickrichtung: yaw 0 schaut nach -z, rechts ist +x (wie in Three.js).
      const forwardX = -Math.sin(p.yaw);
      const forwardZ = -Math.cos(p.yaw);
      const rightX = Math.cos(p.yaw);
      const rightZ = -Math.sin(p.yaw);
      const dirX = rightX * mx + forwardX * mz;
      const dirZ = rightZ * mx + forwardZ * mz;
      const distance = PLAYER_SPEED * seconds;

      p.x += dirX * distance;
      resolveCollisions(p);
      p.z += dirZ * distance;
      resolveCollisions(p);
    }
  }

  // Zustand für die Clients. Positionen auf Zentimeter gerundet, um die Nachrichten klein zu halten.
  function snapshot() {
    return {
      players: [...players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: round2(p.x),
        z: round2(p.z),
        yaw: round2(p.yaw),
        hp: p.hp,
        ammo: p.ammo,
        score: p.score,
        alive: p.alive,
      })),
    };
  }

  return { world, addPlayer, removePlayer, setName, setInput, step, snapshot };
}
