'use strict';

// Ausschließlich Darstellung: Spielregeln, Sitzplätze und Kollisionen bleiben beim Spielkern.
globalThis.NachtjagdImportedModels = (() => {
  const T = THREE, templates = {}, errors = [];
  const LOD_RADIUS = 140;
  // Auf GitHub Pages liegen die Modelle eine Ebene über dem Ordner entwurf/, in der Artifact-Vorschau neben der Seite.
  const scriptUrl = document.currentScript.src;
  const base = new URL(/\/entwurf\/[^/]*$/.test(new URL(scriptUrl).pathname) ? '../assets/imported/' : './assets/imported/', scriptUrl);
  const files = {
    monster: 'monster.glb', wendigo: 'stylized_low-poly_wendigo.glb',
    pine: 'low_poly_forest_tree.glb', pack: 'low_poly_forest_tree_pack.glb',
    dead: 'low-poly_trees.glb', jeep: 'willys_jeep_low_poly.glb'
  };
  const meshes = object => {
    const result = [];
    object.updateMatrixWorld(true);
    object.traverse(node => { if (node.isMesh) result.push(node); });
    return result;
  };
  function staticModel(parts, height = 1, yaw = 0, length = null) {
    const group = new T.Group();
    for (const part of parts) {
      const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
      geometry.rotateY(yaw);
      const mesh = new T.Mesh(geometry, part.material);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    const bounds = new T.Box3().setFromObject(group), size = bounds.getSize(new T.Vector3());
    if (!Number.isFinite(size.y) || size.y < 1e-8) throw new Error('Leeres Modell');
    const scale = length ? length / size.z : height / size.y;
    const center = bounds.getCenter(new T.Vector3());
    for (const mesh of group.children) {
      mesh.geometry.translate(-center.x, -bounds.min.y, -center.z);
      mesh.geometry.scale(scale, scale, scale);
    }
    return group;
  }
  // Jeder Gegner bekommt eigene Knochen; Geometrien und Texturen werden geteilt.
  function cloneCharacter(source) {
    const copy = source.clone(true), sourceToCopy = new Map();
    function pair(a, b) {
      sourceToCopy.set(a, b);
      a.children.forEach((child, i) => pair(child, b.children[i]));
    }
    pair(source, copy);
    source.traverse(node => {
      if (!node.isSkinnedMesh) return;
      const cloned = sourceToCopy.get(node);
      cloned.skeleton = node.skeleton.clone();
      cloned.skeleton.bones = node.skeleton.bones.map(bone => sourceToCopy.get(bone));
      cloned.bindMatrix.copy(node.bindMatrix);
      cloned.bind(cloned.skeleton, cloned.bindMatrix);
    });
    return copy;
  }
  function character(gltf) {
    const source = gltf.scene;
    // Die tatsächliche Haut verwenden, nicht die untransformierte Bindepose.
    const mixer = new T.AnimationMixer(source);
    if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
    mixer.update(0);
    source.updateMatrixWorld(true);
    const bounds = new T.Box3(), point = new T.Vector3();
    for (const mesh of meshes(source)) {
      if (mesh.isSkinnedMesh) mesh.skeleton.update();
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i);
        if (mesh.isSkinnedMesh) mesh.boneTransform(i, point);
        bounds.expandByPoint(point.applyMatrix4(mesh.matrixWorld));
      }
    }
    mixer.stopAllAction();
    return { source, clips: gltf.animations, bounds };
  }
  function prepare(key, gltf) {
    const parts = meshes(gltf.scene);
    if (key === 'monster') return staticModel(parts, 2);
    if (key === 'wendigo') return character(gltf);
    if (key === 'pine') return [staticModel(parts)];
    if (key === 'dead') return parts.filter(p => /^DeadTree_/.test(p.name)).map(p => staticModel([p]));
    if (key === 'pack') {
      const trunks = parts.filter(p => /^Tree_Trunk_/.test(p.name));
      const branches = parts.filter(p => /^Tree_Branches_/.test(p.name));
      const center = p => new T.Box3().setFromObject(p).getCenter(new T.Vector3());
      return trunks.map(trunk => {
        const c = center(trunk);
        const nearest = branches.slice().sort((a, b) => {
          const x = center(a), y = center(b);
          return Math.hypot(x.x-c.x, x.z-c.z) - Math.hypot(y.x-c.x, y.z-c.z);
        })[0];
        return staticModel([trunk, nearest]);
      });
    }
    // Der Download enthält eine Präsentationsfläche. Der Jeep blickt ursprünglich nach +X.
    if (key === 'jeep') return staticModel(parts.filter(p => !/ground/i.test(p.name)), 1, -Math.PI/2, 4.2);
  }
  const ready = Promise.all(Object.entries(files).map(async ([key, file]) => {
    try {
      const gltf = await new T.GLTFLoader().loadAsync(new URL(file, base).href);
      templates[key] = prepare(key, gltf);
    } catch (error) {
      errors.push(file); console.warn('Modell bleibt vorläufig als Platzhalter:', file, error);
    }
  }));

  function buildForest({ scene, placements, heightAt, forest, trunks }) {
    const root = new T.Group(), batches = [], dummy = new T.Object3D();
    root.name = 'ImportedForest'; scene.add(root);
    function update() {
      for (const batch of batches) {
        const { mesh, trees } = batch;
        trees.forEach(({ tree, index }, i) => {
          const height = tree.height + tree.clearance;
          dummy.position.set(tree.x, heightAt(tree.x, tree.z), tree.z);
          dummy.rotation.set(0, index * 2.39996323, 0);
          dummy.scale.set(height, height, height); dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        // Three r128 besitzt keine automatisch aktualisierten Instanz-Grenzen.
        mesh.frustumCulled = false;
        // Vollständige Matrizen für die Abstandsstufe merken.
        batch.full = mesh.instanceMatrix.array.slice();
      }
      if (far) { far.forestFull = forest.instanceMatrix.array.slice(0, placements.length * 16); far.trunkFull = trunks.instanceMatrix.array.slice(0, placements.length * 16); dirty = true; }
    }
    // Abstandsstufe: Nur Bäume im Umkreis von LOD_RADIUS zeigen das detaillierte Modell (einige hundert Dreiecke),
    // alle anderen die einfachen Kegel (wenige Dreiecke). So bleibt die Dreieckszahl unabhängig von der Waldgröße klein.
    // Die Aufteilung wird nur neu berechnet, wenn sich die Kamera um mehr als 8 m bewegt hat.
    const last = { x: Infinity, z: Infinity };
    let far = null, dirty = false;
    function lod(camera) {
      if (!far || !batches.length) return;
      const p = camera.position;
      if (!dirty && Math.abs(p.x - last.x) + Math.abs(p.z - last.z) < 8) return;
      dirty = false; last.x = p.x; last.z = p.z;
      const r2 = LOD_RADIUS * LOD_RADIUS, near = new Uint8Array(placements.length);
      placements.forEach((tree, i) => { const dx = tree.x - p.x, dz = tree.z - p.z; near[i] = dx * dx + dz * dz < r2 ? 1 : 0; });
      for (const batch of batches) {
        const array = batch.mesh.instanceMatrix.array; let k = 0;
        batch.trees.forEach(({ index }, j) => { if (near[index]) { array.set(batch.full.subarray(j * 16, j * 16 + 16), k * 16); k++; } });
        batch.mesh.count = k; batch.mesh.instanceMatrix.needsUpdate = true;
      }
      let f = 0; const fa = far.forest.instanceMatrix.array, ta = far.trunks.instanceMatrix.array;
      for (let i = 0; i < placements.length; i++) if (!near[i]) {
        fa.set(far.forestFull.subarray(i * 16, i * 16 + 16), f * 16); ta.set(far.trunkFull.subarray(i * 16, i * 16 + 16), f * 16); f++;
      }
      far.forest.count = far.trunks.count = f;
      far.forest.instanceMatrix.needsUpdate = far.trunks.instanceMatrix.needsUpdate = true;
    }
    ready.then(() => {
      const variants = [...(templates.pine || []), ...(templates.pack || []), ...(templates.dead || [])];
      if (!variants.length) return;
      const buckets = variants.map(() => []);
      placements.forEach((tree, index) => {
        // Etwa die Hälfte Nadelbäume; wenige kahle Bäume, übrige Varianten gemischt.
        const step = index % 20;
        const choice = step < 11 ? 0 : step < 18 ? 1 + Math.floor(index / 20) % 4 : 5 + Math.floor(index / 20) % 3;
        buckets[Math.min(choice, variants.length - 1)].push({ tree, index });
      });
      variants.forEach((variant, i) => {
        if (!buckets[i].length) return;
        for (const part of variant.children) {
          const mesh = new T.InstancedMesh(part.geometry, part.material, buckets[i].length);
          mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
          batches.push({ mesh, trees: buckets[i] });
        }
      });
      // Eigene Instanzpuffer für die einfachen Fernbäume; die ursprünglichen Netze bleiben ausgeblendet.
      far = !(forest.isInstancedMesh && trunks.isInstancedMesh) ? null : {
        forest: new T.InstancedMesh(forest.geometry, forest.material, placements.length),
        trunks: new T.InstancedMesh(trunks.geometry, trunks.material, placements.length)
      };
      // Fernbäume dunkler, damit sie am Rand der Abstandsstufe zu den Nadelmodellen passen.
      if (far && forest.material.color) { far.forest.material = forest.material.clone(); far.forest.material.color.multiplyScalar(.5); }
      if (far) for (const m of [far.forest, far.trunks]) { m.castShadow = forest.castShadow; m.frustumCulled = false; m.count = 0; scene.add(m); }
      update(); forest.visible = trunks.visible = false;
      root.userData.treeCount = placements.length;
      root.userData.variantCount = variants.length;
    });
    return { root, update, lod };
  }

  function decorateEnemy(group, kind, spec) {
    if (group.userData.imported) return;
    const key = ['lycan', 'samca', 'brute'].includes(kind) ? 'wendigo'
      : ['villager', 'spitter', 'bloater'].includes(kind) ? 'monster' : null;
    if (!templates[key]) return;
    const holder = new T.Group();
    if (key === 'wendigo') {
      const { source, bounds, clips } = templates.wendigo, model = cloneCharacter(source);
      const scale = 2.5 * spec.scale / (bounds.max.y - bounds.min.y);
      const center = bounds.getCenter(new T.Vector3());
      model.scale.multiplyScalar(scale);
      model.position.add(new T.Vector3(-center.x, -bounds.min.y, -center.z).multiplyScalar(scale));
      holder.add(model);
      const mixer = new T.AnimationMixer(model);
      if (clips[0]) mixer.clipAction(clips[0]).play();
      group.userData.mixer = mixer;
    } else {
      holder.add(templates.monster.clone(true)); holder.scale.setScalar(spec.scale);
    }
    holder.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      // Trefferfärbung darf andere Gegner nicht mitfärben.
      node.material = node.material.clone();
    });
    for (const child of group.children) child.visible = false;
    group.add(holder); group.userData.imported = holder;
  }
  function updateEnemy(group, dt, hurt, hot) {
    if (!group.userData.imported) return;
    group.userData.mixer?.update(dt);
    group.userData.imported.traverse(node => {
      if (node.isMesh && node.material.emissive) node.material.emissive.setRGB(Math.max(hurt, hot), hurt*.1, 0);
    });
  }
  function disposeEnemy(group) {
    group.userData.mixer?.stopAllAction();
    if (group.userData.mixer) group.userData.mixer.uncacheRoot(group.userData.mixer.getRoot());
    group.userData.imported?.traverse(node => { if (node.isMesh) node.material.dispose(); });
  }
  function installJeep(builders) {
    const fallback = builders.jeep;
    builders.jeep = function (THREE) {
      const group = fallback(THREE);
      const replace = () => {
        if (!templates.jeep) return;
        // Die Räder sind im Download Teil derselben Geometrie; vorerst keine eigene Radrotation.
        const light = group.userData.light;
        group.clear(); group.add(templates.jeep.clone(true));
        if (light) group.add(light, light.target);
        group.userData = { wheels: [], light, imported: true };
      };
      if (templates.jeep) replace(); else ready.then(replace);
      return group;
    };
  }
  return { ready, errors, buildForest, decorateEnemy, updateEnemy, disposeEnemy, installJeep };
})();
