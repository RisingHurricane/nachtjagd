'use strict';

// Ausschließlich Darstellung: Spielregeln, Sitzplätze und Kollisionen bleiben beim Spielkern.
globalThis.NachtjagdImportedModels = (() => {
  const T = THREE, templates = {}, errors = [];
  // Bis hierher volle Baumform mit Schatten, dahinter die vereinfachte Fernfassung ohne Schatten.
  const SHADOW_RADIUS = 60;
  const MOUNTAIN_CUT = 10;
  // Auf GitHub Pages liegen die Modelle eine Ebene über dem Ordner entwurf/, in der Artifact-Vorschau neben der Seite.
  const scriptUrl = document.currentScript.src;
  const onPages = /\/entwurf\/[^/]*$/.test(new URL(scriptUrl).pathname);
  // Verkleinerte Fassungen (tools/optimize-models.mjs) aus assets/opt/; die Originale bleiben unter assets/imported/.
  const base = new URL(onPages ? '../assets/opt/' : './assets/imported/', scriptUrl);
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
    // Gegner kommen aus monster-models.js; geladen wird nur noch die Gebirgskulisse.
    mountain: 'mountain_low_poly.glb'
  };
  const meshes = object => {
    const result = [];
    object.updateMatrixWorld(true);
    object.traverse(node => { if (node.isMesh) result.push(node); });
    return result;
  };
  // far: gleich lange Liste vereinfachter Netze (Fernfassung aus tools/optimize-models.mjs) oder leer.
  function staticModel(parts, height = 1, yaw = 0, length = null, far = []) {
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
    // Fernfassung mit derselben Verschiebung und Skalierung wie das nahe Modell.
    group.userData.far = parts.map((part, i) => {
      const twin = far[i];
      if (!twin) return null;
      const geometry = twin.geometry.clone().applyMatrix4(twin.matrixWorld);
      geometry.rotateY(yaw); geometry.translate(-center.x, -bounds.min.y, -center.z); geometry.scale(scale, scale, scale);
      return geometry;
    });
    return group;
  }
  function prepare(key, gltf) {
    const all = meshes(gltf.scene), parts = all.filter(p => !/__far$/.test(p.name));
    const farOf = list => list.map(p => all.find(q => q.name === p.name + '__far') || null);
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
    if (key === 'pine') return [staticModel(parts, 1, 0, null, farOf(parts))];
    if (key === 'dead') return parts.filter(p => /^DeadTree_/.test(p.name)).map(p => staticModel([p], 1, 0, null, farOf([p])));
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
        return staticModel([trunk, nearest], 1, 0, null, farOf([trunk, nearest]));
      });
    }
  }
  const loading={};
  const ready = Promise.all(Object.entries(files).map(([key, file]) => loading[key]=(async()=>{
    try {
      const gltf = await loadGltf(new URL(file + suffix, base).href);
      templates[key] = prepare(key, gltf);
    } catch (error) {
      errors.push(file); console.warn('Modell bleibt vorläufig als Platzhalter:', file, error);
    }
  })()));
  // Bäume: eigene, sparsame Modelle aus tree-models.js (acht Varianten wie zuvor: eine häufige Fichte, vier weitere
  // Nadelbäume, drei kahle Bäume). Die früheren Baum-GLBs werden nicht mehr geladen.
  const treesReady=Promise.resolve().then(()=>{
    const v=globalThis.NachtjagdTreeModels.variants(T);
    templates.pine=[v[0]]; templates.pack=v.slice(1,5); templates.dead=v.slice(5);
  });
  // Die Kirche wird sofort mitgeladen, parallel zu den übrigen Modellen und zum Aufbau der Welt.
  const churchModel = onPages ? new URL('church.glb', base).href : null;
  const churchBytes = churchModel && typeof fetch === 'function' ? fetch(churchModel).then(r => { if (!r.ok) throw new Error('Kirche ' + r.status); return r.arrayBuffer(); }) : null;
  churchBytes?.catch(() => {});

  function buildForest({ scene, placements, heightAt, forest, trunks }) {
    const root = new T.Group(), batches = [], dummy = new T.Object3D();
    const frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere();
    const radii=new Float32Array(placements.length),groundY=new Float32Array(placements.length);
    const near=new Uint8Array(placements.length),visible=new Uint8Array(placements.length);
    root.name = 'ImportedForest'; scene.add(root);
    function update() {
      placements.forEach((tree,i)=>groundY[i]=heightAt(tree.x,tree.z));
      for (const batch of batches) {
        const { mesh, trees } = batch;
        trees.forEach(({ tree, index }, i) => {
          const height = tree.height + tree.clearance;
          dummy.position.set(tree.x, groundY[index], tree.z);
          dummy.rotation.set(0, index * 2.39996323, 0);
          dummy.scale.set(height, height, height); dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        // Three r128 besitzt keine automatisch aktualisierten Instanz-Grenzen.
        mesh.frustumCulled = false;
        // Vollständige Matrizen für die Schattenaufteilung merken.
        batch.full = mesh.instanceMatrix.array.slice();
        batch.far.instanceMatrix.array.set(batch.full);batch.far.instanceMatrix.needsUpdate=true;
      }
      dirty=true;
    }
    // Überall dieselben importierten Modelle. Nur Schatten und unsichtbare Ferninstanzen
    // werden ausgespart; die Baumform bleibt unabhängig vom Abstand erhalten.
    const last = { x: Infinity, y:Infinity, z: Infinity, quaternion:new T.Quaternion(), projection:0,range:Infinity };
    let dirty = true;
    function lod(camera,maxDistance=Infinity) {
      if (!batches.length) return;
      const p=camera.position,canCull=!!camera.projectionMatrix;
      const projectionKey=canCull?camera.projectionMatrix.elements[0]+camera.projectionMatrix.elements[5]:0;
      const range=Number.isFinite(maxDistance)?Math.ceil(maxDistance/25)*25:Infinity;
      const turned=canCull&&last.quaternion.angleTo(camera.quaternion)>.015;
      if(!dirty&&!turned&&projectionKey===last.projection&&range===last.range&&Math.abs(p.x-last.x)+Math.abs((p.y??0)-last.y)+Math.abs(p.z-last.z)<8)return;
      dirty=false;last.x=p.x;last.y=p.y??0;last.z=p.z;last.projection=projectionKey;last.range=range;
      if(canCull) {
        camera.updateMatrixWorld(true);last.quaternion.copy(camera.quaternion);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      }
      placements.forEach((tree,i)=>{
        near[i]=(tree.x-p.x)**2+(tree.z-p.z)**2<SHADOW_RADIUS**2?1:0;
        sphere.center.set(tree.x,groundY[i]+(tree.height+tree.clearance)/2,tree.z);
        sphere.radius=radii[i];
        const inRange=(tree.x-p.x)**2+(tree.z-p.z)**2<=(range+radii[i])**2;
        visible[i]=near[i]||(inRange&&(!canCull||frustum.intersectsSphere(sphere)))?1:0;
      });
      for (const batch of batches) {
        const close=batch.mesh.instanceMatrix.array,distant=batch.far.instanceMatrix.array;let n=0,f=0;
        batch.trees.forEach(({index},j)=>{
          if(!visible[index])return;
          const matrix=batch.full.subarray(j*16,j*16+16);
          if(near[index])close.set(matrix,n++*16);else distant.set(matrix,f++*16);
        });
        batch.mesh.count=n;batch.far.count=f;
        batch.mesh.instanceMatrix.needsUpdate=batch.far.instanceMatrix.needsUpdate=true;
      }
    }
    const forestReady=treesReady.then(() => {
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
        const bounds=new T.Sphere();new T.Box3().setFromObject(variant).getBoundingSphere(bounds);
        for(const {tree,index} of buckets[i])radii[index]=bounds.radius*(tree.height+tree.clearance);
        variant.children.forEach((part, j) => {
          // Jenseits des Schattenradius die vereinfachte Fassung desselben Modells (etwa ein Drittel der Dreiecke).
          const mesh = new T.InstancedMesh(part.geometry, part.material, buckets[i].length);
          const far=new T.InstancedMesh(variant.userData.far?.[j] || part.geometry,part.material,buckets[i].length);
          mesh.castShadow=true;far.castShadow=false;
          for(const m of [mesh,far]) {m.receiveShadow=true;m.frustumCulled=false;root.add(m);}
          batches.push({ mesh,far, trees: buckets[i] });
        });
      });
      update(); forest.visible = trunks.visible = false;
      root.userData.treeCount = placements.length;
      root.userData.variantCount = variants.length;
    });
    return { root, update, lod, ready:forestReady };
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

  async function loadChurch(options) {
    const churchBase=new URL('../church/',base);
    const {loadChurch:load}=await import(new URL('church-adapter.js',churchBase).href);
    // Artifact-Vorschau: die Kirche liegt wie die übrigen Modelle als Base64-Text neben der .glb-Endung.
    let Loader=suffix?class extends T.GLTFLoader{loadAsync(url){return loadGltf(url+suffix);}}:T.GLTFLoader;
    if(churchBytes) Loader=class extends T.GLTFLoader{async loadAsync(url){
      if(url!==churchModel) return super.loadAsync(url);
      const bytes=await churchBytes;
      return new Promise((resolve,reject)=>this.parse(bytes,new URL('.',url).href,resolve,reject));
    }};
    return load({THREE:T,GLTFLoader:Loader,baseURL:churchBase.href,modelURL:churchModel,...options});
  }
  return { ready, errors, pineGeometry, buildForest, buildBackdrop, loadChurch };
})();
