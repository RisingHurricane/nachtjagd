'use strict';

// Besondere Fundorte (nur Darstellung): Gipfelheiligtum an der Bergstation, Runenstein mit Lichtstrahl im Steinkreis,
// Muschelaltar auf der Seeinsel. Die Lage kommt aus den Relikt-Fundstellen der Welt (world.loots mit relicId).
// Der Lichtstrahl steigt auf, sobald der Runenstein berührt wurde (relics.circle), und bleibt die Nacht über sichtbar.
// Lichter laufen über das Lampenfeld (feste Shaderplätze, keine eigenen Punktlichter).
globalThis.NachtjagdRelicSites = {
  create({ THREE, scene, world, lamps }) {
    const root = new THREE.Group(); root.name = 'RelicSites'; scene.add(root);
    const c = hex => new THREE.Color(hex).convertSRGBToLinear();
    const stone = new THREE.MeshLambertMaterial({ name: 'castle', color: c('#7d7f80') });
    const darkStone = new THREE.MeshLambertMaterial({ name: 'castle', color: c('#55585a') });
    const iron = new THREE.MeshLambertMaterial({ color: c('#2c2f31') });
    const ember = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
    const rune = new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: .35 });
    const shell = new THREE.MeshLambertMaterial({ color: c('#d8cfc2'), emissive: c('#3a5a6a') });
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(.5, .5, 1, 10), bowl = new THREE.CylinderGeometry(.5, .32, 1, 10);
    const part = (g, geometry, material, x, y, z, sx, sy, sz, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, ry, rz);
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };
    const site = id => (world.loots || []).find(l => l.relicId === id);
    const floor = (x, z) => { const y = world.floor(x, z); return Number.isFinite(y) ? y : 0; };
    const out = { root, beam: null };

    // Gipfelheiligtum: Stufenaltar, vier Feuerschalen, zwei Säulen mit gebrochenem Bogen.
    const crown = site('crown');
    if (crown) {
      const g = new THREE.Group(), y = floor(crown.x, crown.z); g.position.set(crown.x, y, crown.z); root.add(g);
      part(g, box, darkStone, 0, .15, 0, 5, .3, 5); part(g, box, stone, 0, .45, 0, 3.6, .3, 3.6); part(g, box, stone, 0, .85, 0, 1.4, .5, 1);
      for (const [sx, sz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
        part(g, cyl, iron, sx, .7, sz, .16, 1.1, .16); part(g, bowl, iron, sx, 1.35, sz, .7, .25, .7); part(g, box, ember, sx, 1.47, sz, .45, .06, .45);
        lamps?.add({ x: crown.x + sx, y: y + 1.7, z: crown.z + sz, r: 11, c: [1, .5, .2], k: .8, fire: true, halo: 3.2, a: .5, kind: 'gipfelfeuer' });
      }
      for (const sx of [-3.4, 3.4]) part(g, box, stone, sx, 2.2, -2.8, .7, 4.4, .7);
      part(g, box, stone, -1.8, 4.6, -2.8, 3.4, .6, .7, 0, -.18); part(g, box, stone, 2.3, 4.25, -2.8, 1.6, .6, .7, 0, .35);
    }

    // Steinkreis: Runenstein in der Mitte; Lichtstrahl in den Himmel, wenn er berührt wurde.
    const circle = site('circle');
    let beam = null, runes = null, beamOn = 0;
    if (circle) {
      const g = new THREE.Group(), y = floor(circle.x, circle.z); g.position.set(circle.x, y, circle.z); root.add(g);
      part(g, cyl, darkStone, 0, .2, 0, 3.2, .4, 3.2); part(g, box, stone, 0, 1.1, 0, .9, 1.6, .6);
      runes = part(g, box, rune, 0, 1.15, .31, .55, 1.1, .02); runes.castShadow = false;
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uOn;
float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
void main(){
  // Helle Mitte, weiche Ränder um den Umfang; aufsteigende Schlieren; unten hell, nach oben ausdünnend.
  float around = abs(fract(vUv.x * 2.0) - 0.5) * 2.0;
  float streak = 0.55 + 0.45 * sin(vUv.x * 37.0 + h(floor(vUv.x * 12.0)) * 6.0) * sin(vUv.y * 40.0 - uT * 3.5);
  float fade = (1.0 - smoothstep(0.15, 1.0, vUv.y)) * smoothstep(0.0, 0.0015, vUv.y);
  float pulse = 0.85 + 0.15 * sin(uT * 2.3);
  vec3 col = mix(vec3(0.45, 1.0, 0.7), vec3(0.85, 1.0, 0.92), 0.4 + 0.3 * streak);
  gl_FragColor = vec4(col * (0.5 + 0.9 * around) * streak * fade * pulse * uOn * 1.4, 1.0);
}`
      });
      // Zwei Hüllen: schmaler heller Kern und breiter Schein; 900 m hoch, damit er über den Nebel hinaus reicht.
      beam = new THREE.Group(); beam.position.set(circle.x, y + .5, circle.z); beam.visible = false; root.add(beam);
      for (const [r, k] of [[1.1, 1], [3.2, .45]]) {
        const geometry = new THREE.CylinderGeometry(r, r * 1.6, 900, 24, 1, true); geometry.translate(0, 450, 0);
        const m = new THREE.Mesh(geometry, material); m.renderOrder = 8; m.frustumCulled = false; m.scale.set(1, 1, 1); m.userData.k = k; beam.add(m);
      }
      out.beam = beam;
    }

    // Seeinsel: kleiner Altar mit Muschel und zwei Grablichtern.
    const pearl = site('pearl');
    if (pearl) {
      const g = new THREE.Group(), y = floor(pearl.x, pearl.z); g.position.set(pearl.x, y, pearl.z); root.add(g);
      part(g, cyl, darkStone, 0, .25, 0, 1.6, .5, 1.6); part(g, cyl, stone, 0, .7, 0, .9, .4, .9);
      part(g, new THREE.SphereGeometry(.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, .9, 0, .6, .35, .6);
      for (const sx of [-1.1, 1.1]) { part(g, box, stone, sx, .45, .9, .2, .9, .2); lamps?.add({ x: pearl.x + sx, y: y + 1, z: pearl.z + .9, r: 7, c: [.55, .8, 1], k: .6, halo: 1.6, a: .3, flick: true, kind: 'inselgrab' }); }
    }

    let lit = false;
    out.update = (dt, clock, relics = {}) => {
      if (runes) runes.material.opacity = relics.circle ? .9 : .25 + .15 * Math.sin(clock * 2.1);
      if (!beam) return;
      if (relics.circle && !lit) {
        lit = true;
        lamps?.add({ x: beam.position.x, y: beam.position.y + 2, z: beam.position.z, r: 26, c: [.4, 1, .65], k: .9, halo: 6, a: .55, kind: 'mondstrahl' });
      }
      if (!relics.circle && lit) { lit = false; lamps?.remove('mondstrahl'); }
      beamOn += ((relics.circle ? 1 : 0) - beamOn) * Math.min(1, dt * 2.5);
      beam.visible = beamOn > .01;
      const material = beam.children[0].material; material.uniforms.uT.value = clock; material.uniforms.uOn.value = beamOn;
      beam.children.forEach(m => m.scale.set(1, Math.min(1, beamOn * 3), 1));
    };
    return out;
  }
};
