'use strict';

// Lampenfeld nach dem Altay-Original: viele feste Lichtpunkte (Fenster, Türlichter, Laternen, Fackeln, Grubenlampen).
// Die acht nächsten wirken im Shader jedes beleuchteten Materials (ohne echte Three.js-Lichter, daher günstig),
// alle zeigen einen weichen Lichthof, Fackeln zusätzlich Flammen und Funken.
(function (root) {
  const SLOTS = 8;
  const TAU = Math.PI * 2;

  // Lampe: x, y, z, r (Reichweite in m), c (Farbe linear, 0..1), k (Stärke), flick (Flackern), fire (Fackel),
  // halo (Größe des Lichthofs in m, 0 = keiner), a (Deckkraft des Hofs), kind (Bezeichnung für Tests und Fehlersuche),
  // shade: false = nur Lichthof (z. B. Fenster), belegt keinen der acht Shaderplätze.
  function normalize(l, i) {
    return {
      x: +l.x, y: +l.y, z: +l.z, r: l.r || 12, c: l.c || [1, .62, .3], k: l.k === undefined ? .7 : l.k,
      flick: !!l.flick, fire: !!l.fire, halo: l.halo === undefined ? 3.5 : l.halo, a: l.a === undefined ? .3 : l.a,
      kind: l.kind || 'lampe', shade: l.shade !== false, ph: l.ph === undefined ? (i * 2.399) % TAU : l.ph, on: l.on !== false, d: 0
    };
  }

  // Shaderbausteine für Lambert-, Phong- und Standardmaterialien.
  const VERTEX_HEAD = 'varying vec3 vLfP; varying vec3 vLfN;';
  const VERTEX_BODY = `{ vec4 lfp = vec4(transformed, 1.0); vec3 lfn = objectNormal;
  #ifdef USE_INSTANCING
  lfp = instanceMatrix * lfp; lfn = mat3(instanceMatrix) * lfn;
  #endif
  lfp = modelMatrix * lfp; vLfP = lfp.xyz; vLfN = normalize(mat3(modelMatrix) * lfn); }`;
  const FRAGMENT_HEAD = `varying vec3 vLfP; varying vec3 vLfN; uniform vec4 uLfPos[${SLOTS}]; uniform vec3 uLfCol[${SLOTS}];`;
  const FRAGMENT_BODY = `{ vec3 lfN = normalize(vLfN);
  #ifdef DOUBLE_SIDED
  lfN *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  vec3 lfAdd = vec3(0.0);
  for (int i = 0; i < ${SLOTS}; i++) {
    vec3 L = uLfPos[i].xyz - vLfP; float d = max(length(L), 0.001);
    float a = clamp(1.0 - d / uLfPos[i].w, 0.0, 1.0); a *= a;
    lfAdd += uLfCol[i] * (a * (0.28 + 0.72 * max(dot(lfN, L / d), 0.0)));
  }
  gl_FragColor.rgb += diffuseColor.rgb * lfAdd; }`;

  // Fügt den Lampenanteil in einen vorhandenen Shader ein; ohne passende Stellen bleibt der Shader unverändert.
  function inject(shader, uniforms) {
    const v = shader.vertexShader, f = shader.fragmentShader;
    // Die Vorlagen enthalten noch die #include-Anweisungen: objectNormal entsteht in beginnormal_vertex.
    if (!v.includes('#include <project_vertex>') || !v.includes('#include <common>') || !v.includes('#include <beginnormal_vertex>')) return false;
    if (!f.includes('#include <tonemapping_fragment>') || !f.includes('#include <common>') || !f.includes('diffuseColor')) return false;
    shader.uniforms.uLfPos = uniforms.uLfPos; shader.uniforms.uLfCol = uniforms.uLfCol;
    shader.vertexShader = v.replace('#include <common>', '#include <common>\n' + VERTEX_HEAD)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERTEX_BODY);
    shader.fragmentShader = f.replace('#include <common>', '#include <common>\n' + FRAGMENT_HEAD)
      .replace('#include <tonemapping_fragment>', FRAGMENT_BODY + '\n#include <tonemapping_fragment>');
    return true;
  }

  function create({ THREE: T, scene }) {
    const lamps = [];
    const uniforms = {
      uLfPos: { value: Array.from({ length: SLOTS }, () => new T.Vector4(0, -9999, 0, 1)) },
      uLfCol: { value: Array.from({ length: SLOTS }, () => new T.Vector3()) }
    };
    const patched = new WeakSet();
    let time = 0, level = 1, halos = null, haloDirty = true, slots = [];

    function add(list) {
      for (const l of [].concat(list)) {
        if (!Number.isFinite(+l.x) || !Number.isFinite(+l.y) || !Number.isFinite(+l.z)) continue;
        lamps.push(normalize(l, lamps.length));
      }
      haloDirty = true;
      return lamps.length;
    }
    function remove(kind) {
      for (let i = lamps.length - 1; i >= 0; i--) if (lamps[i].kind === kind) lamps.splice(i, 1);
      haloDirty = true;
    }

    // Materialien einmal erweitern; vorhandene onBeforeCompile-Anpassungen (Gelände, Schnitte) laufen weiter.
    function patchMaterial(m) {
      if (!m || patched.has(m) || (m.userData && m.userData.noLampField)) return false;
      if (!(m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshStandardMaterial || m.isMeshToonMaterial)) return false;
      patched.add(m);
      const previous = m.onBeforeCompile, previousText = previous.toString();
      const ownKey = m.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
      m.onBeforeCompile = function (shader, renderer) { previous.call(this, shader, renderer); inject(shader, uniforms); };
      m.customProgramCacheKey = () => 'lampfeld-1|' + (ownKey ? ownKey() : previousText);
      m.needsUpdate = true;
      return true;
    }
    function patchScene(object = scene) {
      let count = 0;
      object.traverse((o) => {
        if (!o.isMesh || o.isPoints) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (patchMaterial(m)) count++;
      });
      return count;
    }

    // --- Lichthöfe: ein Punktnetz für alle Lampen, additiv, in der Tiefe verdeckt
    const haloMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 600 }, uK: { value: 1 }, uT: { value: 0 }, uFogD: { value: .002 } },
      vertexShader: `attribute vec4 lfColor; attribute vec3 lfInfo; uniform float uScale; uniform float uK; uniform float uT; uniform float uFogD;
varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(-mv.z, 0.1);
  float fl = lfInfo.y > 1.5 ? 0.86 + 0.14 * sin(uT * 11.0 + lfInfo.z) * sin(uT * 6.3 + lfInfo.z * 2.0)
    : (lfInfo.y > 0.5 ? (sin(uT * 13.0 + lfInfo.z) * sin(uT * 7.1 + lfInfo.z) > 0.8 ? 0.35 : 1.0) : 1.0);
  // Ferne Lichter bleiben als kleine Punkte sichtbar (mindestens 2,5 px), der Nebel dämpft sie nur teilweise.
  gl_PointSize = clamp(lfInfo.x * uScale / d, 2.5, 220.0);
  float fog = exp(-pow(uFogD * d * 0.55, 2.0));
  vA = lfColor.a * uK * fl * (0.35 + 0.65 * fog) * smoothstep(0.6, 2.5, d);
  vC = lfColor.rgb;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
  float core = exp(-r * r * 22.0) * 1.2, glow = pow(1.0 - r, 1.9);
  gl_FragColor = vec4(vC * (glow * 1.9 + core) * vA, 1.0);
}`
    });
    haloMaterial.userData.noLampField = true;
    function buildHalos() {
      if (halos) { scene.remove(halos); halos.geometry.dispose(); halos = null; }
      const list = lamps.filter((l) => l.halo > 0);
      haloDirty = false;
      if (!list.length) return;
      const g = new T.BufferGeometry(), pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 4), info = new Float32Array(list.length * 3);
      list.forEach((l, i) => {
        pos.set([l.x, l.y, l.z], i * 3);
        col.set([Math.min(1, l.c[0]), Math.min(1, l.c[1]), Math.min(1, l.c[2]), l.a], i * 4);
        info.set([l.halo, l.fire ? 2 : l.flick ? 1 : 0, l.ph], i * 3);
      });
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('lfColor', new T.BufferAttribute(col, 4));
      g.setAttribute('lfInfo', new T.BufferAttribute(info, 3));
      halos = new T.Points(g, haloMaterial); halos.frustumCulled = false; halos.renderOrder = 5; halos.name = 'Lichthöfe';
      scene.add(halos);
    }

    // --- Flammen der Fackeln: kleiner gemeinsamer Partikelvorrat
    const FLAMES = 360;
    const flamePos = new Float32Array(FLAMES * 3), flameData = new Float32Array(FLAMES * 2), flameVel = new Float32Array(FLAMES * 3), flameLife = new Float32Array(FLAMES);
    const flameGeo = new T.BufferGeometry();
    flameGeo.setAttribute('position', new T.BufferAttribute(flamePos, 3));
    flameGeo.setAttribute('lfFlame', new T.BufferAttribute(flameData, 2));
    const flameMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute vec2 lfFlame; uniform float uScale; varying float vT;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vT = lfFlame.x;
  gl_PointSize = lfFlame.x <= 0.0 ? 0.0 : clamp(lfFlame.y * (0.4 + 0.6 * lfFlame.x) * uScale / max(-mv.z, 0.2), 1.0, 90.0);
  gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vT;
void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0 || vT <= 0.0) discard;
  vec3 c = mix(vec3(0.9, 0.18, 0.03), vec3(1.0, 0.78, 0.35), smoothstep(0.35, 0.95, vT));
  gl_FragColor = vec4(c * pow(1.0 - r, 1.6) * vT * 1.1, 1.0); }`
    });
    flameMaterial.userData.noLampField = true;
    const flames = new T.Points(flameGeo, flameMaterial); flames.frustumCulled = false; flames.renderOrder = 6; flames.name = 'Flammen';
    scene.add(flames);
    let flameNext = 0;
    function updateFlames(dt, camera) {
      const cp = camera.position;
      for (let i = 0; i < FLAMES; i++) {
        if (flameLife[i] <= 0) continue;
        flameLife[i] -= dt * 1.9;
        flamePos[i * 3] += flameVel[i * 3] * dt; flamePos[i * 3 + 1] += flameVel[i * 3 + 1] * dt; flamePos[i * 3 + 2] += flameVel[i * 3 + 2] * dt;
        flameData[i * 2] = Math.max(0, flameLife[i]);
      }
      for (const l of lamps) {
        if (!l.fire || !l.on) continue;
        if ((l.x - cp.x) ** 2 + (l.z - cp.z) ** 2 > 75 * 75) continue;
        l.acc = (l.acc || 0) + dt * 22;
        while (l.acc > 1) {
          l.acc -= 1;
          const i = flameNext; flameNext = (flameNext + 1) % FLAMES;
          flamePos[i * 3] = l.x + (Math.random() - .5) * .22; flamePos[i * 3 + 1] = l.y - .25; flamePos[i * 3 + 2] = l.z + (Math.random() - .5) * .22;
          flameVel[i * 3] = (Math.random() - .5) * .3; flameVel[i * 3 + 1] = .9 + Math.random() * .9; flameVel[i * 3 + 2] = (Math.random() - .5) * .3;
          flameLife[i] = .75 + Math.random() * .25; flameData[i * 2] = flameLife[i]; flameData[i * 2 + 1] = .3 + Math.random() * .22;
        }
      }
      flameGeo.attributes.position.needsUpdate = true; flameGeo.attributes.lfFlame.needsUpdate = true;
    }

    // Pro Bild: nächste Lampen in die acht Shaderplätze, Flackern, Lichthöfe und Flammen nachführen.
    // k: Gesamtstärke (Dämmerung schwächer, Nacht voll), indoor: 0..1 (drinnen nur Lampen der Nähe).
    function update(camera, dt, { k = 1, scale = 600, fogDensity = .002 } = {}) {
      time += dt; level = k;
      if (haloDirty) buildHalos();
      const cp = camera.position;
      for (const l of lamps) l.d = l.on && l.shade ? (l.x - cp.x) ** 2 + (l.z - cp.z) ** 2 + ((l.y - cp.y) * 1.5) ** 2 : Infinity;
      slots = lamps.filter((l) => l.d < (l.r + 60) ** 2).sort((a, b) => a.d - b.d).slice(0, SLOTS);
      for (let i = 0; i < SLOTS; i++) {
        const l = slots[i], p = uniforms.uLfPos.value[i], c = uniforms.uLfCol.value[i];
        if (!l) { p.set(0, -9999, 0, 1); c.set(0, 0, 0); continue; }
        let f = l.fire ? .85 + .15 * Math.sin(time * 11 + Math.sin(time * 7.3 + l.ph) * 2) + .07 * Math.sin(time * 23 + l.ph) : 1 + .04 * Math.sin(time * 3 + l.ph);
        if (l.flick && Math.sin(time * 13 + l.ph) * Math.sin(time * 7.1 + l.ph) > .8) f *= .3;
        // Weiche Übergabe: Lampen am Rand der Auswahl blenden aus, damit Wechsel nicht springen.
        const edge = i >= SLOTS - 2 ? .6 : 1;
        p.set(l.x, l.y, l.z, l.r);
        c.set(l.c[0], l.c[1], l.c[2]).multiplyScalar(l.k * f * k * edge);
      }
      haloMaterial.uniforms.uT.value = time; haloMaterial.uniforms.uK.value = k > 0 ? Math.min(1, .3 + .8 * k) : 0;
      haloMaterial.uniforms.uScale.value = scale; haloMaterial.uniforms.uFogD.value = fogDensity;
      flameMaterial.uniforms.uScale.value = scale;
      updateFlames(dt, camera);
    }
    function setVisible(v) { if (halos) halos.visible = v; flames.visible = v; }

    return {
      lamps, uniforms, add, remove, patchMaterial, patchScene, update, setVisible,
      get slots() { return slots; }, get level() { return level; }, get halos() { return halos; }, flames, SLOTS
    };
  }

  // Fensterpositionen eines Hauses: warme Scheiben für einen Teil der Fenster (nach Lage gestreut, reproduzierbar).
  function litShare(x, z, share = .7) {
    const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    return h < share;
  }

  const api = { create, inject, litShare, SLOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdLampField = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
