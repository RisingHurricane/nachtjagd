'use strict';

// Baut die Three.js-Szene aus level.json: Boden, Dorf, Schloss auf dem Felsen, See, Tunnel,
// Wald, Felsen und die Berge als Kulisse. Alles hier ist Optik. Die Kollision rechnet der Server
// (game.js) mit denselben Daten. Die Farben stammen aus der Palette in DESIGN.md.

import * as THREE from 'three';
import { buildFlatGround, buildHills } from './terrain.js';

const COLOR = {
  ground: 0xb4c0cb, // verschneiter Boden bei Mondlicht (Palette: Mondlicht auf Schnee)
  snow: 0xeff0f0,
  plaster: 0x7e868c, // helle Hauswände
  stone: 0x596b74, // Mauern und Türme
  stoneDark: 0x4e4e4b, // Tunnelwände und Felsen
  slate: 0x596b74, // Dächer (Palette: Stein, bläulich), damit sie bei Mondlicht nicht schwarz bleiben
  wood: 0x5b4636, // Holz (Bootshaus, Stützen, Lore)
  warm: 0xe0a050, // Fenster und Lampen
  water: 0x1c323c, // See, dunkel und leicht durchsichtig
  mountainFar: 0x4f5d75,
  mountainNear: 0x658195,
  pine: 0x1f3a3a,
};

const SNOW_LAYER = 0.12; // Dicke der Schneehaube auf Dächern in Metern

// Nebel und Himmel am Horizont haben dieselbe Farbe, damit der Übergang ohne Kante bleibt.
export const FOG_COLOR = 0x335165;
export const FOG_DENSITY = 0.0042; // FogExp2: nah klar, ferne Berge verschwimmen
const SKY_RADIUS = 700;
// Himmelsfarbe nach Höhe: Horizont, Mitte, Zenit (Anteil der Kugelhöhe, Farbe aus der Palette)
const SKY_STOPS = [
  [0.0, 0x335165],
  [0.12, 0x1c323c],
  [0.4, 0x15222a],
  [1.0, 0x0b1116],
];

// Lichtmasten mit warmen Laternen auf dem Dorfplatz (nur Optik, ohne Kollision).
export const LANTERNS = [
  { x: -5, z: -4 },
  { x: 5, z: -4 },
  { x: -5, z: 4 },
  { x: 5, z: 4 },
];
// Diese Laternen bekommen echte Lichter. Mehr wären für die Leistung zu teuer.
const LANTERN_LIGHTS = 2;
// Laternen am Schlosstor (Mauer bei z -50, Tor 6 m breit)
const CASTLE_GATE_LANTERNS = [
  { x: -4, z: -47 },
  { x: 4, z: -47 },
];

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...options });
}

// Himmelskugel mit Farbverlauf in den Nachtfarben der Palette. Sie liegt hinter allem und
// bekommt keinen Nebel.
export function createSky() {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const stops = SKY_STOPS.map(([height, hex]) => [height, new THREE.Color(hex)]);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const height = Math.max(0, position.getY(i) / SKY_RADIUS);
    let index = 1;
    while (index < stops.length - 1 && height > stops[index][0]) {
      index++;
    }
    const [h0, c0] = stops[index - 1];
    const [h1, c1] = stops[index];
    const t = Math.min(1, Math.max(0, (height - h0) / (h1 - h0)));
    color.copy(c0).lerp(c1, t);
    colors[3 * i] = color.r;
    colors[3 * i + 1] = color.g;
    colors[3 * i + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

// Kachelbare Schneetextur aus Rauschen (per Canvas, ohne Datei). Das Rauschen wird am Rand umgebrochen
// geglättet, so entstehen keine sichtbaren Nahtstellen. Die Farben liegen bei Mondlicht im Blaugrau.
export function createSnowTexture(size = 256) {
  const random = seeded(55);
  let field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) {
    field[i] = random();
  }
  // Zwei Glättungsdurchgänge mit Umbruch, dann Mittelwert der Nachbarn
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(field.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += field[((y + dy + size) % size) * size + ((x + dx + size) % size)];
          }
        }
        next[y * size + x] = sum / 9;
      }
    }
    field = next;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const image = g.createImageData(size, size);
  // Mittelwert auf 0,5 ziehen und den Kontrast etwas anheben, damit die Körnung sichtbar bleibt
  for (let i = 0; i < field.length; i++) {
    const v = Math.min(1, Math.max(0, (field[i] - 0.5) * 1.8 + 0.5));
    const base = 0.86 + v * 0.14; // Helligkeit zwischen 86 und 100 Prozent des Schnees
    image.data[4 * i] = 255 * base;
    image.data[4 * i + 1] = 255 * base;
    image.data[4 * i + 2] = 255 * Math.min(1, base * 1.02 + 0.01); // leicht bläulich
    image.data[4 * i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Mond als weicher Schein in der Richtung des Mondlichts (MOON_DIRECTION in main.js), dazu wenige
// Sterne in der oberen Himmelshälfte. Beides liegt auf der Himmelskugel und bekommt keinen Nebel.
const MOON_DISTANCE = 600;

function moonTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Scheibe
  gradient.addColorStop(0.14, 'rgba(236, 244, 250, 1)');
  gradient.addColorStop(0.2, 'rgba(180, 200, 216, 0.55)'); // Rand der Scheibe
  gradient.addColorStop(0.45, 'rgba(158, 184, 196, 0.18)'); // weicher Schein
  gradient.addColorStop(1, 'rgba(158, 184, 196, 0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createMoonAndStars(direction) {
  const group = new THREE.Group();
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false }),
  );
  moon.position.copy(direction).normalize().multiplyScalar(MOON_DISTANCE);
  moon.scale.set(70, 70, 1);
  moon.renderOrder = -0.5;
  group.add(moon);

  const random = seeded(101);
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Zufallsrichtung in der oberen Himmelshälfte, Sterne bleiben weit weg
    const y = 0.04 + random() * 0.96;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    const distance = MOON_DISTANCE + 40;
    positions[3 * i] = Math.cos(angle) * ring * distance;
    positions[3 * i + 1] = y * distance;
    positions[3 * i + 2] = Math.sin(angle) * ring * distance;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xdfe9f2, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  stars.renderOrder = -0.9;
  group.add(stars);
  return group;
}

// Schneefall als Punkte rund um die Kamera. Die Flocken bleiben in einem Kasten um die Kamera,
// der mit ihr wandert. Pro Bild wird nur die Position fortgeschrieben, kein neues Objekt.
const SNOW_BOX = { width: 40, height: 22 };

function flakeTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createSnow(count = 1500) {
  const random = seeded(31);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[3 * i] = (random() - 0.5) * SNOW_BOX.width;
    positions[3 * i + 1] = random() * SNOW_BOX.height;
    positions[3 * i + 2] = (random() - 0.5) * SNOW_BOX.width;
    speeds[i] = 0.9 + random() * 0.6;
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: COLOR.snow,
    size: 0.1,
    sizeAttenuation: true,
    map: flakeTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const half = { x: SNOW_BOX.width / 2, y: SNOW_BOX.height };
  // Lage relativ zur Kamera in einen Kasten zurückholen (Umbruch an den Rändern).
  const wrap = (value, size) => ((((value + size / 2) % size) + size) % size) - size / 2;

  return {
    object: points,
    update(dt, center, time) {
      const drift = Math.sin(time * 0.4) * 0.6; // leichter Wind, wechselt langsam die Richtung
      for (let i = 0; i < count; i++) {
        const k = 3 * i;
        let x = positions[k] + (drift + Math.sin(time * 1.3 + phases[i]) * 0.35) * dt;
        let y = positions[k + 1] - speeds[i] * dt;
        let z = positions[k + 2] + Math.cos(time * 0.9 + phases[i]) * 0.25 * dt;
        x = center.x + wrap(x - center.x, SNOW_BOX.width);
        z = center.z + wrap(z - center.z, SNOW_BOX.width);
        if (y < 0) {
          y += half.y;
        }
        positions[k] = x;
        positions[k + 1] = y;
        positions[k + 2] = z;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// Gleichbleibende Zufallszahlen, damit die Welt bei jedem Laden gleich aussieht.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Quader mit Mittelpunkt (x, z), Breite w (x), Tiefe d (z) und Höhe h, wie in level.json.
function addBox(group, box, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), material(color));
  mesh.position.set(box.x, box.h / 2, box.z);
  group.add(mesh);
  return mesh;
}

// Satteldach über einer Box. Die Firstlinie läuft in Richtung x. Die Schneehaube liegt als dünne
// Schicht oben auf dem Dach.
function addGableRoof(group, box, roofHeight, roofColor = COLOR.slate) {
  const overhang = 0.4;
  const half = box.d / 2 + overhang;
  const depth = box.w + 2 * overhang;

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-half, 0);
  roofShape.lineTo(half, 0);
  roofShape.lineTo(0, roofHeight);
  roofShape.closePath();
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth, bevelEnabled: false });

  // Schnee: die Dachlinien ab 55 % der Höhe, oben etwas höher.
  const snowBase = roofHeight * 0.55;
  const snowHalf = half * (1 - snowBase / roofHeight);
  const snowShape = new THREE.Shape();
  snowShape.moveTo(-snowHalf, snowBase);
  snowShape.lineTo(snowHalf, snowBase);
  snowShape.lineTo(0, roofHeight + SNOW_LAYER);
  snowShape.closePath();
  const snow = new THREE.ExtrudeGeometry(snowShape, { depth, bevelEnabled: false });

  for (const geometry of [roof, snow]) {
    // Die Extrusion läuft in z. Nach dem Drehen läuft sie in x, die Firstlinie liegt also in x.
    geometry.translate(0, 0, -depth / 2);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(box.x, box.h, box.z);
  }
  group.add(new THREE.Mesh(roof, material(roofColor)));
  group.add(new THREE.Mesh(snow, material(COLOR.snow)));
}

// Warme Fenster auf der Seite, die dem Dorfplatz (0, 0) zugewandt ist.
function addWindows(group, box, windowMaterial) {
  const towardX = Math.abs(box.x) > Math.abs(box.z);
  const sign = towardX ? -Math.sign(box.x) : -Math.sign(box.z);
  for (const offset of [-1.6, 1.6]) {
    const size = towardX ? [0.1, 1.1, 0.9] : [0.9, 1.1, 0.1];
    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(...size), windowMaterial);
    const y = box.h * 0.45;
    if (towardX) {
      windowMesh.position.set(box.x + sign * (box.w / 2 + 0.02), y, box.z + offset);
    } else {
      windowMesh.position.set(box.x + offset, y, box.z + sign * (box.d / 2 + 0.02));
    }
    group.add(windowMesh);
  }
}

function addHouse(group, box, wallColor, roofHeight, windowMaterial) {
  addBox(group, box, wallColor);
  addGableRoof(group, box, roofHeight);
  addWindows(group, box, windowMaterial);
}

// Zylinder mit Kegeldach, für die Ecktürme.
function addTower(group, circle) {
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(circle.r, circle.r, circle.h, 14),
    material(COLOR.stone),
  );
  shaft.position.set(circle.x, circle.h / 2, circle.z);
  group.add(shaft);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(circle.r * 1.15, circle.r * 1.6, 14),
    material(COLOR.slate),
  );
  roof.position.set(circle.x, circle.h + circle.r * 0.8, circle.z);
  group.add(roof);
}

// Der Bergfried ist eine Box mit spitzem Dach aus vier Flächen.
function addKeep(group, box) {
  addBox(group, box, COLOR.stone);
  const radius = (box.w / 2) * Math.SQRT2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius, 5, 4), material(COLOR.slate));
  roof.rotation.y = Math.PI / 4; // Ecken der Box liegen auf den Spitzen der Pyramide
  roof.position.set(box.x, box.h + 2.5, box.z);
  group.add(roof);
}

// Der Felsen unter dem Schloss ist ein Ring aus einem Drehkörper. Er ragt nur außen und unter den
// Mauern hervor, im Inneren liegt der Boden eben (wie bei der Kollision).
function addCastleRock(group, castleCenter) {
  const profile = [
    new THREE.Vector2(22, -8),
    new THREE.Vector2(22, 0),
    new THREE.Vector2(22, 4),
    new THREE.Vector2(32, 4),
    new THREE.Vector2(50, -6),
    new THREE.Vector2(50, -8),
  ];
  const rock = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    material(COLOR.stone, { side: THREE.DoubleSide }),
  );
  rock.position.set(castleCenter.x, 0, castleCenter.z);
  group.add(rock);
}

// Brunnen: runder Rand, dunkles Wasser und zwei Pfosten mit Querbalken.
function addWell(group, circle) {
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(circle.r, circle.r, circle.h, 16), material(COLOR.stone));
  rim.position.set(circle.x, circle.h / 2, circle.z);
  group.add(rim);
  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(circle.r - 0.4, 16),
    material(COLOR.water, { roughness: 0.2 }),
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(circle.x, circle.h + 0.01, circle.z);
  group.add(waterMesh);
  const postGeometry = new THREE.BoxGeometry(0.15, 2.2, 0.15);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, material(COLOR.wood));
    post.position.set(circle.x + side * 1.5, 1.6, circle.z);
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), material(COLOR.wood));
  beam.position.set(circle.x, 2.7, circle.z);
  group.add(beam);
}

// Tunnel: Dach über Gang und Kammer, Holzstützen mit Balken und eine alte Lore als Dekoration.
// Das Bergmassiv darüber ist ein Kegel, dessen Grundfläche auf Höhe der Dächer liegt.
function addTunnelDetails(group) {
  const roofMaterial = material(COLOR.stoneDark);
  const gangRoof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 6.6), roofMaterial);
  gangRoof.position.set(74, 6.25, 0);
  group.add(gangRoof);
  const chamberRoof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 13), roofMaterial);
  chamberRoof.position.set(92, 6.25, 0);
  group.add(chamberRoof);

  const postGeometry = new THREE.CylinderGeometry(0.2, 0.2, 6, 6);
  const beamGeometry = new THREE.BoxGeometry(0.3, 0.3, 5);
  const woodMaterial = material(COLOR.wood);
  for (const x of [66, 72, 78, 84]) {
    for (const z of [-2.5, 2.5]) {
      const post = new THREE.Mesh(postGeometry, woodMaterial);
      post.position.set(x, 3, z);
      group.add(post);
    }
    const beam = new THREE.Mesh(beamGeometry, woodMaterial);
    beam.position.set(x, 5.7, 0);
    group.add(beam);
  }

  // Lore: Kasten auf vier Rädern, am Rand des Gangs
  const cart = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.2), woodMaterial);
  body.position.y = 0.9;
  cart.add(body);
  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 10);
  for (const dx of [-0.8, 0.8]) {
    for (const dz of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(wheelGeometry, material(COLOR.stoneDark));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(dx, 0.35, dz);
      cart.add(wheel);
    }
  }
  cart.position.set(70, 0, 1.9);
  group.add(cart);

  // Bergmassiv über dem Tunnel. Die Grundfläche liegt unter dem Boden, so ist die Deckfläche nie
  // von unten zu sehen (sie wäre dunkel und sähe aus wie ein schwarzes Loch).
  const rockMass = new THREE.Mesh(
    rockGeometry(2, 0.45, 19),
    material(COLOR.mountainFar, { flatShading: true }),
  );
  rockMass.scale.set(24, 22, 26);
  rockMass.position.set(80, 6, 0);
  group.add(rockMass);
}

// Felsklotz aus einem Ikosaeder, dessen Eckpunkte unregelmäßig verschoben sind. Gleiche Punkte
// (an den Ecken der Dreiecke) bekommen dieselbe Verschiebung, sonst entstehen Risse.
function rockGeometry(detail, roughness, seed) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.attributes.position;
  const offsets = new Map();
  for (let k = 0; k < position.count; k++) {
    const x = position.getX(k);
    const y = position.getY(k);
    const z = position.getZ(k);
    const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`;
    let factor = offsets.get(key);
    if (factor === undefined) {
      const hash = seeded(seed + Math.round(x * 997 + y * 401 + z * 211) * 7)();
      factor = 1 + (hash - 0.5) * roughness;
      offsets.set(key, factor);
    }
    position.setXYZ(k, x * factor, y * factor, z * factor);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Tannen: Stamm und drei gestaffelte Kegel, auf jeder Etage eine Schneekappe. Jede Teilform ist ein
// InstancedMesh, also eine Zeichenanweisung pro Teil für alle Bäume. Jeder Baum bekommt eine
// leicht andere Farbe und Größe.
const TIERS = [
  { radius: 2.1, height: 3.0, y: 3.1 },
  { radius: 1.6, height: 2.6, y: 4.9 },
  { radius: 1.1, height: 2.2, y: 6.2 },
];
function addTrees(group, trees) {
  const random = seeded(7);
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.28, 2.4, 6);
  trunkGeometry.translate(0, 1.2, 0);
  const parts = [{ geometry: trunkGeometry, material: material(COLOR.wood), tinted: false }];
  for (const tier of TIERS) {
    const crown = new THREE.ConeGeometry(tier.radius, tier.height, 8);
    crown.translate(0, tier.y, 0);
    parts.push({ geometry: crown, material: material(COLOR.pine), tinted: true });
    // Schneekappe auf der Spitze der Etage, etwas kleiner als der Kegel
    const cap = new THREE.ConeGeometry(tier.radius * 0.5, tier.height * 0.32, 8);
    cap.translate(0, tier.y + tier.height * 0.5 - tier.height * 0.16 + 0.05, 0);
    parts.push({ geometry: cap, material: material(COLOR.snow), tinted: false });
  }
  const meshes = parts.map(({ geometry, material: mat, tinted }) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, trees.length);
    mesh.frustumCulled = false;
    if (tinted) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(trees.length * 3), 3);
    }
    return { mesh, tinted };
  });
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  trees.forEach((tree, index) => {
    const size = 0.9 + random() * 0.35;
    position.set(tree.x, 0, tree.z);
    rotation.setFromAxisAngle(axis, random() * Math.PI * 2);
    scale.set(size, size * (0.95 + random() * 0.15), size);
    matrix.compose(position, rotation, scale);
    tint.setRGB(0.9 + random() * 0.2, 1.0, 1.0);
    for (const { mesh, tinted } of meshes) {
      mesh.setMatrixAt(index, matrix);
      if (tinted) {
        mesh.setColorAt(index, tint);
      }
    }
  });
  for (const { mesh } of meshes) {
    group.add(mesh);
  }
}

// Felsen als Instanzen: unregelmäßige Ikosaeder, gestreut im Gelände.
function addRocks(group, rocks) {
  const random = seeded(11);
  const geometry = rockGeometry(1, 0.35, 3);
  const mesh = new THREE.InstancedMesh(geometry, material(COLOR.stoneDark, { flatShading: true }), rocks.length);
  mesh.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  rocks.forEach((rock, index) => {
    const wide = 1.3 + random() * 0.5;
    position.set(rock.x, 0.8, rock.z);
    rotation.setFromEuler(new THREE.Euler(random(), random() * Math.PI * 2, random()));
    scale.set(wide, 1.0 + random() * 0.4, wide);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  group.add(mesh);
}

// Berg als Kegel mit Schneekappe. Der Schnee steht als Vertex-Farbe direkt im Kegel, nicht als
// zweiter Kegel. So entstehen weder ein Kragen am Übergang noch flackernde Flächen (z-fighting).
// Die Grundfläche liegt unter dem Boden (baseY), damit man von unten keine Deckfläche sieht.
const MOUNTAIN_SNOW_LINE = 0.72; // ab diesem Anteil der Höhe liegt Schnee
function addMountain(group, { x, z, baseY, radius, height, color }) {
  const geometry = new THREE.ConeGeometry(radius, height, 10);
  geometry.translate(0, height / 2, 0); // Grundfläche bei y = 0, Spitze bei y = height
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(color);
  const snow = new THREE.Color(COLOR.snow);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) / height - MOUNTAIN_SNOW_LINE) / 0.08));
    const snowAmount = t * t * (3 - 2 * t); // weicher Übergang
    mixed.copy(base).lerp(snow, snowAmount);
    colors[3 * i] = mixed.r;
    colors[3 * i + 1] = mixed.g;
    colors[3 * i + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Facettierte Flächen wirken wie Fels und lassen die Flanke bei Mondlicht nicht als einheitliche Fläche erscheinen.
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  mesh.position.set(x, baseY, z);
  group.add(mesh);
  return mesh;
}

// Laterne: dunkler Mast mit warm leuchtendem Glaskasten. Das Glas ist emissiv, es braucht kein Licht.
function addLantern(group, lantern, glowMaterial) {
  const poleMaterial = material(COLOR.slate);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), poleMaterial);
  pole.position.set(lantern.x, 1.6, lantern.z);
  group.add(pole);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.36), glowMaterial);
  glass.position.set(lantern.x, 3.45, lantern.z);
  group.add(glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 4), poleMaterial);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(lantern.x, 3.9, lantern.z);
  group.add(cap);
}

// Baut die komplette Welt. Gibt eine Gruppe zurück, die der Aufrufer in die Szene hängt.
export function buildWorld(level) {
  const group = new THREE.Group();
  group.name = 'world';

  // Boden: ebene Scheibe in der Mitte (begehbar) und Hänge als Höhenfeld außerhalb
  const snowMap = createSnowTexture();
  group.add(buildFlatGround(snowMap));
  group.add(buildHills(snowMap));

  // Warme Fenster und Laternen als Kontrast zur Kälte. Alle teilen sich ein leuchtendes Material.
  const glowMaterial = material(COLOR.warm, { emissive: COLOR.warm, emissiveIntensity: 1.1 });
  const windowMaterial = glowMaterial;
  LANTERNS.forEach((lantern, index) => {
    addLantern(group, lantern, glowMaterial);
    if (index < LANTERN_LIGHTS) {
      // Echtes Licht, nur für wenige Laternen (jedes Licht kostet Leistung bei jedem Bild).
      const light = new THREE.PointLight(COLOR.warm, 10, 14, 2);
      light.position.set(lantern.x, 3.4, lantern.z);
      group.add(light);
    }
  });

  // Schlosstor: zwei Laternen links und rechts des Tors und ein warmes Licht darunter. Damit ist
  // das Tor von weitem sichtbar, auch aus dem Dorf.
  for (const gate of CASTLE_GATE_LANTERNS) {
    addLantern(group, gate, glowMaterial);
  }
  const gateLight = new THREE.PointLight(COLOR.warm, 12, 22, 2);
  gateLight.position.set(0, 4.2, -47);
  group.add(gateLight);

  // Häuser, Bootshaus, Mauern, Bergfried, Tunnelwände
  for (const box of level.boxes) {
    switch (box.kind) {
      case 'house':
        addHouse(group, box, COLOR.plaster, 3.2, windowMaterial);
        break;
      case 'boathouse':
        addHouse(group, box, COLOR.wood, 2.2, windowMaterial);
        break;
      case 'keep':
        addKeep(group, box);
        break;
      case 'tunnel_wall':
        addBox(group, box, COLOR.stoneDark);
        break;
      default:
        addBox(group, box, COLOR.stone); // Mauern des Schlosses
    }
  }

  // Ecktürme, Brunnen, Felsen und Bäume aus den Kreisen
  const trees = [];
  const rocks = [];
  for (const circle of level.circles) {
    switch (circle.kind) {
      case 'tower':
        addTower(group, circle);
        break;
      case 'well':
        addWell(group, circle);
        break;
      case 'rock':
        rocks.push(circle);
        break;
      case 'tree':
        trees.push(circle);
        break;
      default:
        break;
    }
  }
  addTrees(group, trees);
  addRocks(group, rocks);

  // Schloss: der Felsen liegt in der Mitte der Mauern (Mauern stehen von -90 bis -50 in z)
  addCastleRock(group, { x: 0, z: -70 });

  // See: dunkle, leicht durchsichtige Fläche knapp über dem Boden
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(level.lake.r, 48),
    material(COLOR.water, { roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.82 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(level.lake.x, 0.03, level.lake.z);
  group.add(lake);

  addTunnelDetails(group);
  // Kaltes Restlicht in der Kammer, damit das Tunnelende nicht schwarz bleibt (kein Mond kommt hinein)
  const chamberLight = new THREE.PointLight(COLOR.mountainNear, 4, 18, 2);
  chamberLight.position.set(91, 3.5, 0);
  group.add(chamberLight);
  return group;
}
