'use strict';

// Gelände als Höhenfeld. Im Zentrum liegt eine ebene Scheibe (Radius 140 m), die das ganze
// begehbare Gebiet (±98 m, Ecken bei 139 m) auf Höhe 0 hält. Außerhalb steigen sanfte Hänge an.
// Das Rauschen ist selbst geschrieben (Wertrauschen mit Oktaven), keine Bibliothek.
// Alles hier ist Optik: Der Server kennt keine Höhen, die Spieler bleiben bei y = 0.

import * as THREE from 'three';

export const FLAT_RADIUS = 140; // ebene Scheibe in der Mitte, Ecken des begehbaren Gebiets liegen bei 139 m
const HILL_BAND = 120; // auf dieser Strecke außerhalb der Scheibe wachsen die Hänge auf volle Höhe
const RINGS = 140; // Ringe vom Rand der Scheibe bis zum äußeren Ende
const SEGMENTS = 512; // Winkelunterteilung (bei 500 m etwa 6 m je Schritt)
const OUTER_RADIUS = 520;
const MOUNTAIN_START = 190; // ab hier wachsen die Berge, außen am höchsten (gestaffelt)
const MOUNTAIN_FULL = 330;

// Farben aus der Palette (Schnee bei Mondlicht, Fels dunkel)
const SNOW_LIT = new THREE.Color(0xb4c0cb);
const SNOW_BRIGHT = new THREE.Color(0xd6dee4);
const ROCK_DARK = new THREE.Color(0x2f3131);
const ROCK_LIGHT = new THREE.Color(0x596b74);

// Gleichmäßig verteilte, aber feste Zufallswerte je Gitterpunkt (Hash über Ganzzahlen).
function lattice(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

// Wertrauschen mit glatter Interpolation, Ergebnis zwischen 0 und 1.
export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = lattice(x0, y0, seed);
  const b = lattice(x0 + 1, y0, seed);
  const c = lattice(x0, y0 + 1, seed);
  const d = lattice(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Mehrere Oktaven übereinander, Ergebnis zwischen 0 und 1.
export function fbm(x, y, octaves, seed = 1) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 17);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

// Gefaltetes Rauschen für Grate und Gipfel, Ergebnis zwischen 0 (Tal) und 1 (Grat).
export function ridged(x, y, octaves, seed = 1) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise(x * frequency, y * frequency, seed + i * 17) * 2 - 1;
    const ridge = 1 - Math.abs(n);
    sum += amplitude * ridge * ridge;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return sum / norm;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Höhe des Geländes an (x, z) in Metern. Innerhalb der Scheibe ist sie genau 0.
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= FLAT_RADIUS) {
    return 0;
  }
  let height = 0;
  const rise = smoothstep(FLAT_RADIUS, FLAT_RADIUS + HILL_BAND, r);
  if (rise > 0) {
    const shape = fbm(x * 0.03, z * 0.03, 5, 9); // grobe Form der Hügel
    height += rise * (8 + 34 * shape * shape); // Hänge bleiben sanft
  }
  // Gebirge: Grate aus gefaltetem Rauschen, außen höher und dunkler (zwei bis drei Ebenen)
  const band = smoothstep(MOUNTAIN_START, MOUNTAIN_FULL, r);
  if (band > 0) {
    const ridge = ridged(x * 0.0065, z * 0.0065, 4, 41); // 0 Tal, 1 Grat
    const detail = fbm(x * 0.02, z * 0.02, 3, 77) - 0.5; // kleine Zacken
    const reach = 70 + Math.min(160, (r - MOUNTAIN_START) * 0.9); // Höhe wächst mit dem Abstand
    height += band * reach * (Math.pow(ridge, 2.4) + detail * 0.25);
  }
  return Math.max(0, height);
}

// Schneefarbe und Fels nach Neigung (Normale), Höhe und einem Rauschen gegen gleichförmige Flächen.
function colorFor(x, z, y, normalY, color) {
  const grain = fbm(x * 0.05, z * 0.05, 3, 21);
  const highSnow = smoothstep(110, 170, y + (grain - 0.5) * 30); // Schnee auf den Gipfeln
  const slopeSnow = smoothstep(0.6, 0.8, normalY + (grain - 0.5) * 0.3); // Schnee auf flachen Flächen
  const snowAmount = Math.max(slopeSnow, highSnow * smoothstep(0.35, 0.6, normalY + 0.2));
  const rock = ROCK_DARK.clone().lerp(ROCK_LIGHT, grain);
  const snow = SNOW_LIT.clone().lerp(SNOW_BRIGHT, grain * 0.6);
  return color.copy(rock).lerp(snow, snowAmount);
}

// Schneetextur auf Weltkoordinaten: UV = x/z geteilt durch die Kachelgröße, damit der Schnee auf
// Scheibe und Hängen gleich aussieht. Ohne Kachel (Texture null) bleibt die Farbe allein.
const SNOW_TILE = 12; // Meter je Kachel
function worldUv(geometry, map) {
  if (!map) {
    return;
  }
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let k = 0; k < position.count; k++) {
    uv[2 * k] = position.getX(k) / SNOW_TILE;
    uv[2 * k + 1] = position.getZ(k) / SNOW_TILE;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Baut den Hang-Ring um die Scheibe. Der innere Rand liegt bei FLAT_RADIUS und hat Höhe 0,
// dort schließt die Scheibe an.
export function buildHills(snowMap = null) {
  const vertexCount = (RINGS + 1) * (SEGMENTS + 1);
  const positions = new Float32Array(vertexCount * 3);
  let p = 0;
  for (let j = 0; j <= RINGS; j++) {
    const radius = FLAT_RADIUS + (OUTER_RADIUS - FLAT_RADIUS) * (j / RINGS);
    for (let i = 0; i <= SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions[p++] = x;
      positions[p++] = terrainHeight(x, z);
      positions[p++] = z;
    }
  }

  const indices = [];
  const row = SEGMENTS + 1;
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = j * row + i;
      const b = a + row;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Die Dreiecke müssen nach oben zeigen. Zeigt die Normale nach unten, wird die Reihenfolge umgedreht.
  const normals = geometry.attributes.normal;
  if (normals.getY(0) < 0 || normals.getY(SEGMENTS) < 0) {
    for (let k = 0; k < indices.length; k += 3) {
      const tmp = indices[k + 1];
      indices[k + 1] = indices[k + 2];
      indices[k + 2] = tmp;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }

  const colors = new Float32Array(vertexCount * 3);
  const color = new THREE.Color();
  const normal = geometry.attributes.normal;
  for (let k = 0; k < vertexCount; k++) {
    colorFor(positions[3 * k], positions[3 * k + 2], positions[3 * k + 1], normal.getY(k), color);
    colors[3 * k] = color.r;
    colors[3 * k + 1] = color.g;
    colors[3 * k + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  worldUv(geometry, snowMap);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: snowMap });
  return new THREE.Mesh(geometry, material);
}

// Ebene Scheibe in der Mitte. Sie liegt auf Höhe 0 und deckt das begehbare Gebiet ab.
export function buildFlatGround(snowMap = null) {
  const geometry = new THREE.CircleGeometry(FLAT_RADIUS, 128);
  geometry.rotateX(-Math.PI / 2);
  worldUv(geometry, snowMap);
  const material = new THREE.MeshStandardMaterial({ color: SNOW_LIT, roughness: 1, metalness: 0, map: snowMap });
  return new THREE.Mesh(geometry, material);
}
