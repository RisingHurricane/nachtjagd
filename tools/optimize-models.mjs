// Verkleinert die heruntergeladenen GLB-Modelle für das Laden im Browser.
// Quelle: public/assets/imported/*.glb und public/assets/church/church.glb (bleiben unverändert).
// Ziel:   public/assets/opt/*.glb (wird von entwurf/imported-models.js geladen).
//
// Was passiert: ungenutzte Objekte (Hintergrundbaum-Atlas, Felsen, Ausstellungsboden, Requisiten) fallen weg,
// ungenutzte Attribute/Texturen ebenso (Three.js r128 liest weder KHR_materials_specular noch Tangenten oder
// zweite/dritte UV-Sätze). Texturen werden verkleinert; deckende Bilder als JPEG, Bilder mit Transparenz als PNG.
// Die Geometrie bleibt Float32 (keine Quantisierung), weil Spielcode Positionen direkt ausliest.
// Bäume (far: true) erhalten zusätzlich je Objekt eine vereinfachte Fernfassung `<Name>__far` mit etwa einem Drittel der Dreiecke.
//
// Einmalig im Projektordner ausführen (keine dauerhafte Abhängigkeit):
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp meshoptimizer@1.3
//   node tools/optimize-models.mjs
'use strict';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/assets/opt');
fs.mkdirSync(out, { recursive: true });
// Getrennte Puffer je Attribut: Spielcode (z. B. building-site.js merge) liest attribute.array direkt.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);

// keep: Objektnamen, die erhalten bleiben (null = alle). drop: Texturplätze, die das Spiel nicht nutzt.
const jobs = [
  { file: 'imported/low_poly_forest_tree_pack.glb', keep: /^Tree_(Trunk|Branches)_/, size: 512, far: true },
  { file: 'imported/low_poly_forest_tree.glb', size: 512, far: true },
  { file: 'imported/low-poly_trees.glb', keep: /^DeadTree_/, size: 512, far: true },
  { file: 'imported/mountain_low_poly.glb', size: 1024, drop: ['normal', 'metallicRoughness', 'occlusion'] },
  { file: 'imported/stylized_low-poly_wendigo.glb', size: 512 },
  { file: 'imported/monster.glb', size: 256 },
  { file: 'church/church.glb', size: 512 }
];

for (const job of jobs) {
  const src = path.join(root, 'public/assets', job.file);
  const doc = await io.read(src);
  const r = doc.getRoot();
  if (job.keep) {
    for (const node of r.listNodes()) if (node.getMesh() && !job.keep.test(node.getName())) node.dispose();
  }
  for (const ext of r.listExtensionsUsed()) if (ext.extensionName === 'KHR_materials_specular') ext.dispose();
  for (const mat of r.listMaterials()) {
    for (const slot of job.drop || []) {
      if (slot === 'normal') mat.setNormalTexture(null);
      if (slot === 'metallicRoughness') mat.setMetallicRoughnessTexture(null);
      if (slot === 'occlusion') mat.setOcclusionTexture(null);
    }
  }
  // Alle Texturen lesen den ersten UV-Satz (r128 kennt keinen zweiten für Normalen).
  for (const mat of r.listMaterials()) for (const info of [mat.getBaseColorTextureInfo(), mat.getNormalTextureInfo(), mat.getMetallicRoughnessTextureInfo(), mat.getOcclusionTextureInfo(), mat.getEmissiveTextureInfo()]) if (info) info.setTexCoord(0);
  // Tangenten und weitere UV-Sätze nutzt das Spiel nicht.
  for (const mesh of r.listMeshes()) for (const prim of mesh.listPrimitives()) {
    for (const semantic of ['TANGENT', 'TEXCOORD_1', 'TEXCOORD_2']) {
      const attr = prim.getAttribute(semantic);
      if (attr) prim.setAttribute(semantic, null);
    }
  }
  await doc.transform(
    prune({ keepAttributes: false, keepLeaves: true }),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [job.size, job.size], quality: 82,
      slots: /^(?!baseColorTexture)/ }),
    // Grundfarben: JPEG, außer das Material nutzt Transparenz.
    textureCompress({ encoder: sharp, resize: [job.size, job.size], slots: /^baseColorTexture$/,
    })
  );
  // Deckende Grundfarben nachträglich als JPEG speichern.
  for (const mat of r.listMaterials()) {
    const tex = mat.getBaseColorTexture();
    if (!tex || mat.getAlphaMode() !== 'OPAQUE' || tex.getMimeType() === 'image/jpeg') continue;
    let shared = false;
    for (const other of r.listMaterials()) if (other !== mat && other.getBaseColorTexture() === tex && other.getAlphaMode() !== 'OPAQUE') shared = true;
    if (shared) continue;
    const jpg = await sharp(Buffer.from(tex.getImage())).flatten({ background: '#808080' }).jpeg({ quality: 84 }).toBuffer();
    tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg').setURI(tex.getURI().replace(/\.png$/i, '.jpg'));
  }
  if (job.far) await addFarCopies(doc);
  const target = path.join(out, path.basename(job.file));
  await io.write(target, doc);
  const before = fs.statSync(src).size, after = fs.statSync(target).size;
  console.log(`${path.basename(job.file).padEnd(36)} ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`);
}

// Fernfassung: gleiche Knotenlage, gleiche Attribute, nur ein vereinfachter Index (meshoptimizer).
async function addFarCopies(doc) {
  await MeshoptSimplifier.ready;
  const r = doc.getRoot();
  for (const node of r.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || /__far$/.test(node.getName())) continue;
    const far = doc.createMesh(mesh.getName() + '__far');
    for (const prim of mesh.listPrimitives()) {
      const copy = prim.clone(), indices = prim.getIndices(), position = prim.getAttribute('POSITION');
      const count = indices.getCount();
      if (count / 3 >= 60) {
        // Nähte (gleiche Position, andere UV/Normale) für die Vereinfachung zusammenlegen.
        const pos = position.getArray(), canon = new Map(), remap = new Uint32Array(position.getCount());
        for (let i = 0; i < remap.length; i++) {
          const key = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
          if (!canon.has(key)) canon.set(key, i);
          remap[i] = canon.get(key);
        }
        const source = Uint32Array.from(indices.getArray(), i => remap[i]);
        const target = Math.max(36, Math.floor(count * 0.33 / 3) * 3);
        let [simple] = MeshoptSimplifier.simplify(source, new Float32Array(position.getArray()), 3, target, 0.08);
        if (simple.length > count * 0.6) simple = MeshoptSimplifier.simplifySloppy(source, new Float32Array(position.getArray()), 3, null, target, 0.08)[0];
        const accessor = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(simple)).setBuffer(indices.getBuffer());
        copy.setIndices(accessor);
      }
      far.addPrimitive(copy);
    }
    const twin = doc.createNode(node.getName() + '__far').setMesh(far)
      .setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale());
    for (const parent of node.listParents()) if (parent.propertyType === 'Node' || parent.propertyType === 'Scene') parent.addChild(twin);
  }
}
