'use strict';

// Gemeinsame Oberflächen für alle selbst gebauten Baukörper: Mauerwerk, Putz, Holz, Dachschindeln,
// Pflaster mit Schnee und Schneewälle. Die Muster entstehen im Shader aus Weltkoordinaten
// (keine Bilddateien, keine UV-Koordinaten nötig) und verblassen mit dem Abstand, damit nichts flimmert.
// Nur die Grundfarbe wird verändert; Licht, Schatten, Nebel und das Lampenfeld bleiben unberührt.
// Vertrag: style(material, kind) bzw. styleScene(scene) mit Zuordnung über material.name.
globalThis.NachtjagdSurface = (() => {
  const KINDS = { stone: 1, plaster: 2, wood: 3, roof: 4, path: 5, snow: 6, water: 7, rock: 8 };
  // Materialnamen aus blockout.js, village-houses.js, village-wall.js, building-site.js, mine-tunnels.js und models/kit.js.
  const BY_NAME = {
    castle: 'stone', viaduct: 'stone', 'kit-stone': 'stone', 'kit-stoneDark': 'stone', 'kit-stoneLight': 'stone', 'kit-reveal': 'stone',
    'wall-stone': 'stone', 'wall-stairs': 'stone', 'wall-deck': 'stone', foundation: 'stone', 'mine-rock': 'stone',
    house: 'plaster', plaster: 'plaster',
    wood: 'wood', darkWood: 'wood', landmark: 'wood', board: 'wood', floor: 'wood', 'mine-timber': 'wood', 'kit-wood': 'wood',
    slate: 'roof', 'kit-slate': 'roof', 'kit-copper': 'roof', roof: 'roof',
    path: 'path', 'path-bank': 'snow', 'kit-snow': 'snow', water: 'water', rock: 'rock'
  };
  let noise = null;
  function noiseTexture(THREE) {
    if (!noise) noise = NachtjagdTerrainMaterial.makeNoise(THREE, 128);
    return noise;
  }
  const VERTEX_HEAD = 'varying vec3 vSfP; varying vec3 vSfN;\nattribute vec2 sfInfo;\nvarying vec2 vSfInfo;';
  const VERTEX_BODY = `{ vec4 sfp = vec4(transformed, 1.0); vec3 sfn = objectNormal;
  #ifdef USE_INSTANCING
  sfp = instanceMatrix * sfp; sfn = mat3(instanceMatrix) * sfn;
  #endif
  sfp = modelMatrix * sfp; vSfP = sfp.xyz; vSfN = normalize(mat3(modelMatrix) * sfn); vSfInfo = sfInfo; }`;
  // Eigene Kameraposition: r128 setzt cameraPosition für Lambert-Materialien nicht.
  const FRAGMENT_HEAD = `varying vec3 vSfP; varying vec3 vSfN; varying vec2 vSfInfo; uniform sampler2D uSfNoise; uniform vec3 uSfCam;
float sfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Abstand (in Metern) zur nächsten Fuge eines versetzten Rasters; cell liefert die Zelle.
float sfBond(vec2 uv, vec2 size, float shift, out vec2 cell, out vec2 f) {
  vec2 q = uv / size; float row = floor(q.y);
  q.x += mod(row, 2.0) * shift + sfHash(vec2(row, 3.7)) * 0.25;
  cell = floor(q); f = fract(q);
  vec2 e = min(f, 1.0 - f) * size;
  return min(e.x, e.y);
}
vec3 sfSurface(vec3 base) {
  vec3 P = vSfP, N = normalize(vSfN), an = abs(N);
  bool top = an.y > 0.62;
  vec2 uv = top ? P.xz : (an.x > an.z ? vec2(P.z, P.y) : vec2(P.x, P.y));
  float dist = length(uSfCam - P);
  float fade = 1.0 - smoothstep(40.0, 120.0, dist);
  float big = texture2D(uSfNoise, P.xz / 37.0 + P.y / 53.0).r;
  float mid = texture2D(uSfNoise, uv / 6.0).g;
  float fine = texture2D(uSfNoise, uv / 1.3).b;
  vec3 far = base * (0.9 + 0.18 * big);
  vec3 c = far;
#if SURF_KIND == 1
  // Bruchsteinmauerwerk: versetzte Lagen, helle und dunkle Steine, Fugen; oben Platten.
  vec2 cell, f;
  float e = sfBond(uv + vec2(0.0, 0.13), top ? vec2(0.8, 0.7) : vec2(0.9, 0.42), 0.5, cell, f);
  float h = sfHash(cell);
  float joint = 1.0 - smoothstep(0.012, 0.05, e);
  float face = top ? 1.0 : 1.04 - 0.1 * smoothstep(0.55, 1.0, f.y) + 0.06 * smoothstep(0.35, 0.0, f.y);
  vec3 rock = base * (0.8 + 0.34 * h + (fine - 0.5) * 0.22 + (mid - 0.5) * 0.12) * face;
  rock = mix(rock, rock * vec3(1.04, 1.0, 0.93), step(0.7, sfHash(cell + 9.1)));
  c = mix(rock, base * 0.5, joint * 0.85);
  // Schneereste auf Oberseiten und unten am Fuß der Mauern
  float snowTop = top ? smoothstep(0.35, 0.6, big + fine * 0.3) * 0.75 : 0.0;
  c = mix(c, vec3(0.86, 0.89, 0.92), snowTop);
  c = mix(far * (1.0 - 0.35 * snowTop) + vec3(0.86, 0.89, 0.92) * 0.35 * snowTop, c, fade);
#elif SURF_KIND == 2
  // Kalkputz: wolkige Flecken, leicht dunklere Feuchtezonen, feines Korn.
  float damp = smoothstep(0.55, 0.85, mid) * 0.12;
  c = base * (0.92 + 0.14 * big - damp + (fine - 0.5) * 0.1 * fade);
#elif SURF_KIND == 3
  // Holz: Bretter mit Fugen und gestreckter Maserung.
  float across = top ? P.x * 0.7 + P.z * 0.3 : uv.x;
  float along = top ? P.z : uv.y;
  float p = floor(across / 0.23), fp = fract(across / 0.23);
  float h = sfHash(vec2(p, 7.0));
  float grain = texture2D(uSfNoise, vec2(across * 1.7, along * 0.09 + h)).b;
  float seam = 1.0 - smoothstep(0.0, 0.08, min(fp, 1.0 - fp));
  vec3 plank = base * (0.8 + 0.32 * h + (grain - 0.5) * 0.45);
  c = mix(far, mix(plank, base * 0.45, seam * 0.8), fade);
#elif SURF_KIND == 4
  // Dach: Schindelreihen nach der Höhe, versetzte Schindeln, Schneeauflage mit dunklen Lücken.
  float t = an.x > an.z ? P.z : P.x;
  float r = floor(P.y / 0.26), fr = fract(P.y / 0.26);
  float tab = floor(t / 0.38 + mod(r, 2.0) * 0.5);
  float h = sfHash(vec2(r, tab));
  float lip = smoothstep(0.0, 0.3, fr);
  float gap = 1.0 - smoothstep(0.0, 0.06, min(fract(t / 0.38 + mod(r, 2.0) * 0.5), 1.0 - fract(t / 0.38 + mod(r, 2.0) * 0.5)));
  vec3 shingle = base * (0.74 + 0.26 * lip) * (0.93 + 0.12 * h) * (1.0 - 0.18 * gap);
  float bare = smoothstep(0.62, 0.8, mid + (h - 0.5) * 0.2) * 0.6;
  shingle = mix(shingle, base * vec3(0.42, 0.44, 0.47), bare);
  // Schneeauflage in Flecken und Streifen längs der Reihen: auf dunklen Dächern deutlich, auf hellen kaum sichtbar.
  float snowy = smoothstep(0.48, 0.7, big * 0.55 + mid * 0.45 + (h - 0.5) * 0.12) * (0.75 + 0.25 * lip);
  vec3 snowCol = vec3(0.84, 0.88, 0.92);
  shingle = mix(shingle, snowCol, snowy * 0.85);
  c = mix(mix(far, snowCol, smoothstep(0.48, 0.7, big) * 0.6), shingle, fade);
#elif SURF_KIND == 5
  // Weg: Pflaster im Dorf, festgetretene Fahrspur außerhalb; Schnee in Fugen, an Rändern und in Flecken.
  // Flächen ohne Angaben (Dorfplätze aus Quadern) gelten als gepflastert.
  float edge = vSfInfo.x, village = 1.0 - vSfInfo.y;
  vec2 cell, f;
  float e = sfBond(P.xz, vec2(0.34, 0.3), 0.5, cell, f);
  float h = sfHash(cell);
  vec3 cobble = mix(vec3(0.24, 0.23, 0.22), vec3(0.42, 0.39, 0.35), h) * (0.85 + 0.3 * fine);
  // Gewölbte Steine: Mitte heller, Rand dunkler.
  cobble *= 0.78 + 0.32 * smoothstep(0.0, 0.11, e);
  float joint = 1.0 - smoothstep(0.012, 0.04, e);
  vec3 snowC = vec3(0.87, 0.9, 0.93) * (0.94 + 0.08 * fine);
  vec3 packed = mix(vec3(0.62, 0.62, 0.62), vec3(0.78, 0.8, 0.82), fine) * (0.92 + 0.1 * mid);
  // Zwei Fahrspuren auf Wegen außerhalb des Dorfs (Querposition aus sfInfo.x mit Vorzeichen in z nicht bekannt: Muster über Randabstand).
  float rut = smoothstep(0.25, 0.4, edge) * (1.0 - smoothstep(0.45, 0.6, edge));
  packed = mix(packed, vec3(0.45, 0.43, 0.41) * (0.9 + 0.2 * fine), rut * 0.55);
  vec3 ground = mix(packed, mix(cobble, snowC, joint * 0.9), village * fade);
  // Schnee: an den Rändern; außerhalb des Dorfs zusätzlich in Flecken, im Dorf nur dünn verweht.
  float snow = smoothstep(0.6, 0.98, edge + (mid - 0.5) * 0.3);
  snow = max(snow, smoothstep(0.6, 0.78, big + (fine - 0.5) * 0.25) * mix(0.85, 0.25, village));
  c = mix(ground, snowC, snow);
  c = mix(mix(packed, snowC, max(snow, 0.25)), c, max(fade, 0.35));
#elif SURF_KIND == 7
  // Wintersee: dunkles, kaltes Wasser mit treibenden Eisschollen und Schnee darauf.
  float floe = big * 0.65 + mid * 0.35 + (fine - 0.5) * 0.08;
  float ice = smoothstep(0.54, 0.57, floe);
  float rim = smoothstep(0.54, 0.56, floe) - smoothstep(0.57, 0.61, floe);
  vec3 deep = vec3(0.075, 0.11, 0.14) * (0.85 + 0.3 * mid);
  vec3 sheet = vec3(0.74, 0.8, 0.85) * (0.9 + 0.12 * fine);
  c = mix(deep, sheet, ice);
  c = mix(c, vec3(0.5, 0.58, 0.64), rim * 0.6);
#elif SURF_KIND == 8
  // Rauer Fels (Menhire): fleckig, Flechten, Schnee obenauf, keine Fugen.
  float lichen = smoothstep(0.62, 0.75, mid + (fine - 0.5) * 0.3);
  vec3 rockC = base * (0.72 + 0.38 * mid + (fine - 0.5) * 0.3);
  rockC = mix(rockC, rockC * vec3(0.85, 1.05, 0.8), lichen * 0.6);
  float cap = top ? smoothstep(0.4, 0.6, big + fine * 0.2) : 0.0;
  c = mix(far, mix(rockC, vec3(0.86, 0.89, 0.92), cap), fade);
#elif SURF_KIND == 6
  // Schneewall: weiß wie das Gelände, mit leichter Struktur.
  c = vec3(0.86, 0.89, 0.92) * (0.93 + 0.08 * big + (fine - 0.5) * 0.06 * fade);
#endif
  return c;
}`;
  const patched = new WeakSet(), camera = { value: null };
  function style(THREE, material, kind) {
    const id = KINDS[kind];
    if (!id || !material || patched.has(material)) return false;
    if (!(material.isMeshLambertMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial)) return false;
    patched.add(material);
    const previous = material.onBeforeCompile, previousText = previous.toString();
    const ownKey = material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : null;
    const uniform = { value: noiseTexture(THREE) };
    if (!camera.value) camera.value = new THREE.Vector3();
    material.defines = Object.assign({}, material.defines, { SURF_KIND: id });
    material.onBeforeCompile = function (shader, renderer) {
      previous.call(this, shader, renderer);
      const v = shader.vertexShader, f = shader.fragmentShader;
      if (!v.includes('#include <project_vertex>') || !f.includes('#include <color_fragment>')) return;
      shader.uniforms.uSfNoise = uniform; shader.uniforms.uSfCam = camera;
      shader.vertexShader = v.replace('#include <common>', '#include <common>\n' + VERTEX_HEAD)
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERTEX_BODY);
      shader.fragmentShader = f.replace('#include <common>', '#include <common>\n' + FRAGMENT_HEAD)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = sfSurface(diffuseColor.rgb);');
    };
    material.customProgramCacheKey = () => 'surface-1-' + kind + '|' + (ownKey ? ownKey() : previousText);
    material.userData.surface = kind;
    material.needsUpdate = true;
    return true;
  }
  // Alle Meshes der Szene nach Materialnamen zuordnen; schon behandelte Materialien bleiben unverändert.
  function styleScene(THREE, scene) {
    let count = 0;
    scene.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const kind = m && (m.userData?.surfaceKind || BY_NAME[m.name]);
        if (kind && style(THREE, m, kind)) count++;
      }
    });
    return count;
  }
  // Einmal je Bild mit der aktiven Kamera aufrufen (Abstandsausblendung der Muster).
  function update(activeCamera) {
    if (!camera.value) camera.value = activeCamera.position.clone();
    camera.value.copy(activeCamera.position);
  }
  return { style, styleScene, update, KINDS, BY_NAME };
})();
