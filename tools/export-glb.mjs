'use strict';
// Exportiert die Burg als GLB (glTF binär) für Blender, Three.js-Editor und andere Werkzeuge.
// Aufruf: node tools/export-glb.mjs [Zielordner]   (Standard: ./export)
// Erzeugt burg-aussen.glb, burg-innen.glb und burg-komplett.glb. 1 Einheit = 1 m, y nach oben.
// Instanzierte Netze (Fenster, Bücher, Flaschen, Pfähle) werden zu einzelnen Netzen aufgelöst und
// Hüllen mit BackSide-Material (nur von innen sichtbar) werden umgedreht, damit sie auch in
// anderen Programmen von innen sichtbar sind.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildCastle } from '../public/models/castle.js';
import { buildCastleInterior } from '../public/models/castle-interior.js';

// Der Exporter erwartet FileReader (Browser). Für Node reicht eine kleine Nachbildung.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend && this.onloadend(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend && this.onloadend();
    });
  }
};

function flatten(root) {
  const colorMats = new Map();
  const instanced = [];
  root.traverse((o) => { if (o.isInstancedMesh) instanced.push(o); });
  for (const im of instanced) {
    const holder = new THREE.Group();
    holder.name = im.name || 'instances';
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      let material = im.material;
      if (im.instanceColor) {
        im.getColorAt(i, c);
        const key = c.getHexString();
        if (!colorMats.has(key)) { material = material.clone(); material.color.copy(c); colorMats.set(key, material); }
        material = colorMats.get(key);
      }
      const mesh = new THREE.Mesh(im.geometry, material);
      m.decompose(mesh.position, mesh.quaternion, mesh.scale);
      holder.add(mesh);
    }
    holder.position.copy(im.position);
    holder.quaternion.copy(im.quaternion);
    holder.scale.copy(im.scale);
    im.parent.add(holder);
    im.parent.remove(im);
  }
}

function flipBackSide(root) {
  const done = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.side !== THREE.BackSide) return;
    if (!done.has(o.material)) {
      const mm = o.material.clone();
      mm.side = THREE.FrontSide;
      done.set(o.material, mm);
    }
    const g = o.geometry.clone();
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
      g.index.needsUpdate = true;
    } else {
      for (const name of Object.keys(g.attributes)) {
        const at = g.attributes[name];
        const n = at.itemSize;
        const arr = at.array;
        for (let i = 0; i < at.count; i += 3) {
          for (let k = 0; k < n; k++) { const t = arr[(i + 1) * n + k]; arr[(i + 1) * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t; }
        }
      }
    }
    g.computeVertexNormals();
    o.geometry = g;
    o.material = done.get(o.material);
  });
}

function toGLB(obj) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(obj, (res) => resolve(Buffer.from(res)), reject, { binary: true, onlyVisible: true });
  });
}

const outDir = process.argv[2] || 'export';
fs.mkdirSync(outDir, { recursive: true });
const castle = buildCastle(THREE);
const interior = buildCastleInterior(THREE);
flatten(castle);
flatten(interior);
flipBackSide(interior);
const all = new THREE.Group();
all.name = 'burg-komplett';
const castleForAll = castle.clone();
// Die warm erleuchtete Innenhaut der hohlen Außenwände würde die Innenräume verdecken: im Gesamtmodell weglassen.
const glow = [];
castleForAll.traverse((o) => { if (o.name === 'interiorGlow') glow.push(o); });
glow.forEach((o) => o.parent.remove(o));
all.add(castleForAll, interior.clone());
for (const [name, obj] of [['burg-aussen', castle], ['burg-innen', interior], ['burg-komplett', all]]) {
  const buf = await toGLB(obj);
  fs.writeFileSync(path.join(outDir, `${name}.glb`), buf);
  console.log(name, (buf.length / 1048576).toFixed(2), 'MB');
}
