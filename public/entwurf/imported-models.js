'use strict';

// Ausschließlich Darstellung: Spielregeln, Sitzplätze und Kollisionen bleiben beim Spielkern.
globalThis.NachtjagdImportedModels = (() => {
  const T = THREE, templates = {}, errors = [];
  const LOD_RADIUS = 95;
  const MOUNTAIN_CUT = 10;
  // Auf GitHub Pages liegen die Modelle eine Ebene über dem Ordner entwurf/, in der Artifact-Vorschau neben der Seite.
  const scriptUrl = document.currentScript.src;
  const onPages = /\/entwurf\/[^/]*$/.test(new URL(scriptUrl).pathname);
  const base = new URL(onPages ? '../assets/imported/' : './assets/imported/', scriptUrl);
  // Die Artifact-Vorschau liefert keine .glb-Dateien aus, dort liegen dieselben Bytes als Base64-Text unter der Endung .txt.
  const suffix = onPages ? '' : '.txt';
  // Vier gezackte Astetagen statt glatter Kegel. Eine Geometrie für alle Fernbäume,
  // knapp hundert Dreiecke; normalisierte Krone von -0,5 bis +0,5 wie der alte Platzhalter.
  function pineGeometry() {
    const p = [], colors = [], dark = new T.Color('#24483e').convertSRGBToLinear();
    const green = new T.Color('#496656').convertSRGBToLinear(), snow = new T.Color('#bdc8c4').convertSRGBToLinear();
    function triangle(a,b,c,tint) {
      p.push(...a,...b,...c);
      for(let i=0;i<3;i++) colors.push(tint.r,tint.g,tint.b);
    }
    for(let tier=0;tier<4;tier++) {
      const y=-.5+tier*.235,r=1-tier*.21,tip=Math.min(.5,y+.39);
      for(let i=0;i<8;i++) {
        const a=i*Math.PI/4+tier*.31,b=(i+1)*Math.PI/4+tier*.31;
        const ra=r*(i%2?.75:1),rb=r*((i+1)%2?.75:1);
        const A=[Math.cos(a)*ra,y+(i%2)*.035,Math.sin(a)*ra];
        const B=[Math.cos(b)*rb,y+((i+1)%2)*.035,Math.sin(b)*rb];
        const C=[.03*Math.sin(tier*2),tip,.02*Math.cos(tier)];
        triangle(A,C,B,i%3===0?snow:green);
        triangle(A,B,[0,y+.07,0],dark);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  async function loadGltf(url) {
    const loader = new T.GLTFLoader();
    if (!suffix) return loader.loadAsync(url);
    const text = (await (await fetch(url)).text()).trim(), binary = atob(text), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Promise((resolve, reject) => loader.parse(bytes.buffer, new URL('.', url).href, resolve, reject));
  }
  const files = {
    monster: 'monster.glb', wendigo: 'stylized_low-poly_wendigo.glb',
    pine: 'low_poly_forest_tree.glb', pack: 'low_poly_forest_tree_pack.glb',
    dead: 'low-poly_trees.glb', jeep: 'willys_jeep_low_poly.glb', mountain: 'mountain_low_poly.glb'
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
  // Der Jeep ist im Download ein einziges Netz. Räder erkennt man als eigene, nicht verbundene Flächenstücke (Achse x, rund, über 50 cm);
  // sie werden abgetrennt, um ihren Mittelpunkt verschoben und in Lenk- und Rollgruppen gehängt (Vertrag von vehicle-models.js).
  function splitWheels(group) {
    const mesh = group.children[0];
    if (!mesh || !mesh.geometry.index) return group;
    const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index.array, triangles = index.length / 3;
    const ids = new Map(), parent = [], vertex = new Int32Array(position.count);
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let i = 0; i < position.count; i++) {
      const key = Math.round(position.getX(i) * 1000) + ',' + Math.round(position.getY(i) * 1000) + ',' + Math.round(position.getZ(i) * 1000);
      if (!ids.has(key)) { ids.set(key, parent.length); parent.push(parent.length); }
      vertex[i] = ids.get(key);
    }
    for (let t = 0; t < triangles; t++) {
      const a = find(vertex[index[t * 3]]);
      for (const k of [1, 2]) { const b = find(vertex[index[t * 3 + k]]); if (a !== b) parent[b] = a; }
    }
    const parts = new Map(), point = new T.Vector3();
    for (let t = 0; t < triangles; t++) {
      const root = find(vertex[index[t * 3]]);
      if (!parts.has(root)) parts.set(root, { list: [], box: new T.Box3() });
      const part = parts.get(root); part.list.push(t);
      for (let k = 0; k < 3; k++) part.box.expandByPoint(point.fromBufferAttribute(position, index[t * 3 + k]));
    }
    const wheels = [...parts.values()].filter(part => {
      const size = part.box.getSize(new T.Vector3());
      return part.list.length > 200 && size.y > .5 && size.x < .35 * size.y && Math.abs(size.y - size.z) < .15 * size.y;
    });
    if (wheels.length !== 4) return group;
    const normal = geometry.attributes.normal, uv = geometry.attributes.uv;
    function build(list, shift) {
      const out = { position: [], normal: [], uv: [] };
      for (const t of list) for (let k = 0; k < 3; k++) {
        const i = index[t * 3 + k];
        out.position.push(position.getX(i) - shift.x, position.getY(i) - shift.y, position.getZ(i) - shift.z);
        if (normal) out.normal.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        if (uv) out.uv.push(uv.getX(i), uv.getY(i));
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(out.position, 3));
      if (normal) g.setAttribute('normal', new T.Float32BufferAttribute(out.normal, 3)); else g.computeVertexNormals();
      if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(out.uv, 2));
      return g;
    }
    const wheelSet = new Set(wheels.flatMap(part => part.list));
    const bodyList = []; for (let t = 0; t < triangles; t++) if (!wheelSet.has(t)) bodyList.push(t);
    const result = new T.Group(), body = new T.Mesh(build(bodyList, new T.Vector3()), mesh.material);
    body.castShadow = body.receiveShadow = true; result.add(body);
    for (const part of wheels) {
      const center = part.box.getCenter(new T.Vector3()), size = part.box.getSize(new T.Vector3());
      const steer = new T.Group(), spin = new T.Group(), tire = new T.Mesh(build(part.list, center), mesh.material);
      tire.castShadow = true; steer.name = 'wheelSteer'; steer.position.copy(center);
      steer.userData = { front: center.z > 0, radius: size.y / 2 };
      spin.add(tire); steer.add(spin); result.add(steer);
    }
    return result;
  }
  function prepare(key, gltf) {
    const parts = meshes(gltf.scene);
    if (key === 'monster') return staticModel(parts, 1.5);
    if (key === 'wendigo') return character(gltf);
    if (key === 'mountain') {
      // Kachel mit Berg in der Mitte. Der flache Rand (unter 10 m) wird abgeschnitten, der Rest um die Mitte zentriert.
      const mesh = parts[0], geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), index = geometry.index.array, position = geometry.attributes.position;
      const keep = [];
      for (let t = 0; t < index.length; t += 3) if (Math.max(position.getY(index[t]), position.getY(index[t + 1]), position.getY(index[t + 2])) > MOUNTAIN_CUT) keep.push(index[t], index[t + 1], index[t + 2]);
      geometry.setIndex(keep); geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new T.Vector3());
      geometry.translate(-center.x, 0, -center.z); geometry.computeBoundingSphere();
      return { geometry, map: mesh.material.map };
    }
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
    if (key === 'jeep') return splitWheels(staticModel(parts.filter(p => !/ground/i.test(p.name)), 1, -Math.PI/2, 4.2));
  }
  const ready = Promise.all(Object.entries(files).map(async ([key, file]) => {
    try {
      const gltf = await loadGltf(new URL(file + suffix, base).href);
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
    // alle anderen gezackte Astetagen. Die einfachen Fernbäume benötigen keine Schattenkarte.
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
      if (far && forest.material.color) { far.forest.material = forest.material.clone(); }
      if (far) for (const m of [far.forest, far.trunks]) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
      update(); forest.visible = trunks.visible = false;
      root.userData.treeCount = placements.length;
      root.userData.variantCount = variants.length;
    });
    return { root, update, lod };
  }

  // Ferne Gebirgskulisse: Der Berg aus dem Download wird als Ring geklont (ein Netz mit 5000 Dreiecken, sechs Zeichenaufrufe, ohne Nebel,
  // dafür mit Dunstfarbe). Die Mitte der Welt bleibt dem Gelände aus mountain-relief.js überlassen.
  function buildBackdrop({ scene, count = 6, center = [0, 0], radius = [1000, 900] }) {
    const root = new T.Group(); root.name = 'MountainBackdrop'; scene.add(root);
    let material = null;
    const mood = new T.Color(0.7, 0.68, 0.7);
    function setMood(color) {
      if (!material) return;
      if (color) material.color.copy(color).lerp(new T.Color(1, 1, 1), 0.1); else material.color.copy(mood);
    }
    ready.then(() => {
      const template = templates.mountain;
      if (!template) return;
      material = new T.MeshBasicMaterial({ map: template.map, fog: false });
      material.color.copy(mood);
      for (let i = 0; i < count; i++) {
        const angle = (i + 0.35 * Math.sin(i * 2.7)) / count * Math.PI * 2, wobble = 1 + 0.12 * Math.sin(i * 5.1);
        const mesh = new T.Mesh(template.geometry, material), size = 0.6 + 0.25 * (0.5 + 0.5 * Math.sin(i * 3.3 + 1));
        mesh.position.set(center[0] + Math.cos(angle) * radius[0] * wobble, 0, center[1] + Math.sin(angle) * radius[1] * wobble);
        // Lange Achse (z) läuft entlang des Rings.
        mesh.rotation.y = Math.atan2(-Math.sin(angle) * radius[0], Math.cos(angle) * radius[1]);
        mesh.scale.set(size, size * (0.8 + 0.3 * (0.5 + 0.5 * Math.sin(i * 1.9))), size);
        root.add(mesh);
      }
      root.userData.count = count;
    });
    return { root, setMood };
  }

  // Körpermaße je Gegnerart: Höhe in Metern (null: 2,5 m mal spec.scale), Breitenfaktor und Farbton.
  const BODIES = {
    villager: { height: 1.95, width: 1, tint: [1.25, 1.1, 1.0] },
    spitter: { height: 2.1, width: 1, tint: [0.85, 1.35, 0.7] },
    bloater: { height: 2.0, width: 1.5, tint: [1.4, 0.85, 0.8] },
    lycan: { height: null, width: 1, tint: [1, 1, 1] },
    samca: { height: null, width: 1, tint: [1.15, 0.85, 0.85] },
    brute: { height: null, width: 1.1, tint: [0.9, 0.95, 1.2] }
  };
  const boneName = node => { const m = /^mixamorig(\w+?)(?:_\d+)?$/.exec(node.name); return m ? m[1] : null; };
  function decorateEnemy(group, kind, spec) {
    if (group.userData.imported) return;
    const body = BODIES[kind], key = body ? 'wendigo' : kind === 'wolf' ? 'monster' : null;
    if (!key || !templates[key]) return;
    const holder = new T.Group();
    if (key === 'wendigo') {
      const { source, bounds, clips } = templates.wendigo, model = cloneCharacter(source);
      const scale = (body.height || 2.5 * spec.scale) / (bounds.max.y - bounds.min.y);
      const center = bounds.getCenter(new T.Vector3());
      model.scale.multiplyScalar(scale);
      model.position.add(new T.Vector3(-center.x, -bounds.min.y, -center.z).multiplyScalar(scale));
      holder.add(model); holder.scale.x = holder.scale.z = body.width;
      const mixer = new T.AnimationMixer(model);
      if (clips[0]) mixer.clipAction(clips[0]).play();
      group.userData.mixer = mixer;
      // Die mitgelieferte Animation ist ein Stehen im Leerlauf. Gehen, Lauern und Zuschlagen kommen aus Knochendrehungen darüber.
      const bones = {};
      model.traverse(node => { if (node.isBone) { const name = boneName(node); if (name) bones[name] = node; } });
      group.userData.rig = { bones, phase: (group.id || 0) * 1.7, attack: 0, holder, legLength: 0.62 * (body.height || 2.5 * spec.scale) };
    } else {
      // Die Sprungpose des Downloads ist starr: Der Wolf bekommt Schaukeln und Nicken von außen.
      holder.add(templates.monster.clone(true));
      group.userData.rig = { phase: (group.id || 0) * 1.3, attack: 0, holder, rigid: true };
    }
    holder.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      // Trefferfärbung darf andere Gegner nicht mitfärben.
      node.material = node.material.clone();
      if (body && node.material.color) node.material.color.multiply(new T.Color(...body.tint));
    });
    for (const child of group.children) child.visible = false;
    group.add(holder); group.userData.imported = holder;
  }
  const tilt = new T.Quaternion(), axisX = new T.Vector3(1, 0, 0);
  function bend(bone, angle) { if (bone) bone.quaternion.multiply(tilt.setFromAxisAngle(axisX, angle)); }
  // motion: { speed (m/s), state ('walk', 'windup', 'pounce', ...) }
  function updateEnemy(group, dt, hurt, hot, motion = { speed: 0, state: 'walk' }) {
    if (!group.userData.imported) return;
    group.userData.mixer?.update(dt);
    const rig = group.userData.rig;
    if (rig) {
      const speed = Math.min(motion.speed || 0, 8), run = Math.min(1, speed / 3.2);
      rig.phase += speed * dt * 2.1;
      const target = motion.state === 'windup' || motion.state === 'pounce' ? 1 : 0;
      rig.attack += (target - rig.attack) * Math.min(1, dt * 9);
      const swing = Math.sin(rig.phase) * run * 0.62, lift = Math.abs(Math.sin(rig.phase));
      if (rig.rigid) {
        // Wolf: Nicken im Rhythmus der Schritte, Neigung nach vorn beim Sprung.
        rig.holder.rotation.x = -0.12 * run - rig.attack * 0.45;
        rig.holder.rotation.z = Math.sin(rig.phase) * 0.12 * run;
        rig.holder.position.y = lift * 0.16 * run;
      } else {
        const b = rig.bones, k = rig.attack;
        bend(b.LeftUpLeg, swing); bend(b.RightUpLeg, -swing);
        bend(b.LeftLeg, -Math.max(0, Math.sin(rig.phase)) * run * 0.8); bend(b.RightLeg, -Math.max(0, -Math.sin(rig.phase)) * run * 0.8);
        bend(b.LeftArm, swing * 0.8 - k * 1.9); bend(b.RightArm, -swing * 0.8 - k * 1.9);
        bend(b.Spine1, 0.1 + run * 0.18 + k * 0.35); bend(b.Head, -k * 0.25);
        // Beim Schreiten sinkt das Becken um den Beinwinkel, damit das hintere Standbein den Boden berührt (Beinlänge etwa 62 % der Höhe).
        rig.holder.position.y = -rig.legLength * (1 - Math.cos(Math.abs(swing))) + lift * 0.04 * run;
      }
    }
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
        const light = group.userData.light, model = templates.jeep.clone(true), wheels = [];
        // Räder (falls abtrennbar) zurück in den Vertrag von vehicle-models.js: spin rollt um x, steer lenkt die Vorderräder.
        model.traverse(node => { if (node.name === 'wheelSteer') wheels.push({ spin: node.children[0], steer: node.userData.front ? node : null, radius: node.userData.radius }); });
        group.clear(); group.add(model);
        if (light) group.add(light, light.target);
        group.userData = { wheels, light, imported: true };
      };
      if (templates.jeep) replace(); else ready.then(replace);
      return group;
    };
  }
  async function loadChurch(options) {
    const churchBase=new URL('../church/',base);
    const {loadChurch:load}=await import(new URL('church-adapter.js',churchBase).href);
    return load({THREE:T,GLTFLoader:T.GLTFLoader,baseURL:churchBase.href,...options});
  }
  return { ready, errors, pineGeometry, buildForest, buildBackdrop, decorateEnemy, updateEnemy, disposeEnemy, installJeep, loadChurch };
})();
