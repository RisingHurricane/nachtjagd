'use strict';

// Effekte und Vorräte (nur Darstellung):
// - Feuer der Molotows aus aufsteigenden Flammen- und Funkenpartikeln, ganz im Shader animiert (ein Punktnetz für alle Feuer).
// - Mündungsfeuer: Stern aus zwei gekreuzten, additiven Flächen mit Lichtkern, zufällig gedreht.
// - Vorräte: Munitionskiste (olivgrün, gelbe Banderole, Patronen) und Verbandskasten (weiß, rotes Kreuz), beide leuchtend mit Lichtschein.
globalThis.NachtjagdFx = (() => {
  // Weicher runder Lichtfleck als Textur (einmal erzeugt).
  let glowTex = null;
  function glowTexture(THREE) {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
  }

  // ---------------------------------------------------------------- Feuer
  function createFire(THREE, parent, { slots = 10, perFire = 70 } = {}) {
    const count = slots * perFire, seed = new Float32Array(count * 4), centre = new Float32Array(count * 4), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = (i % perFire) < perFire * .18 ? 1 : 0; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const centreAttr = new THREE.BufferAttribute(centre, 4); geometry.setAttribute('centre', centreAttr);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const material = new THREE.ShaderMaterial({
      // Deckende Flammen (normale Mischung) bleiben auch vor hellem Schnee orange statt ins Weiß zu laufen.
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false,
      uniforms: { uT: { value: 0 }, uScale: { value: 500 }, uTex: { value: glowTexture(THREE) } },
      vertexShader: `attribute vec4 seed; attribute vec4 centre; uniform float uT; uniform float uScale;
varying vec3 vCol; varying float vA;
void main(){
  if (centre.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float spark = seed.w, speed = spark > 0.5 ? 0.9 : 1.4 + seed.z;
  float life = fract(uT * speed * 0.55 + seed.x);
  float ang = seed.y * 6.2831, rad = sqrt(seed.z) * centre.w * (1.0 - life * 0.6);
  vec3 p = centre.xyz + vec3(cos(ang) * rad, 0.0, sin(ang) * rad);
  float h = spark > 0.5 ? life * 5.0 : life * (2.0 + 2.2 * seed.z) * (0.6 + 0.4 * centre.w / 2.0);
  p.y += h; p.x += sin(uT * 3.0 + seed.y * 20.0) * 0.18 * life; p.z += cos(uT * 2.6 + seed.x * 17.0) * 0.18 * life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = spark > 0.5 ? 0.08 : (0.8 + 0.8 * seed.z) * (1.0 - life * 0.75);
  gl_PointSize = clamp(size * uScale / max(-mv.z, 0.1), 1.0, 260.0);
  gl_Position = projectionMatrix * mv;
  vec3 hot = vec3(1.0, 0.78, 0.28), mid = vec3(1.0, 0.36, 0.05), cool = vec3(0.32, 0.08, 0.04);
  vCol = spark > 0.5 ? vec3(1.0, 0.7, 0.3) : mix(mix(hot, mid, smoothstep(0.0, 0.45, life)), cool, smoothstep(0.45, 1.0, life));
  vA = (spark > 0.5 ? 1.0 : 0.85) * (1.0 - smoothstep(0.55, 1.0, life)) * smoothstep(0.0, 0.06, life);
}`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vCol; varying float vA;
void main(){ float a = texture2D(uTex, gl_PointCoord).a * vA; if (a < 0.02) discard; gl_FragColor = vec4(vCol, a); }`
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = 6; parent.add(points);
    // Bodenglut je Feuer
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(THREE), color: 0xc8400c, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glows = Array.from({ length: slots }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat); m.rotation.x = -Math.PI / 2; m.visible = false; parent.add(m); return m; });
    function update(fires, clock, viewHeight) {
      material.uniforms.uT.value = clock; material.uniforms.uScale.value = viewHeight * .9;
      for (let s = 0; s < slots; s++) {
        const f = fires[s], on = !!f, k = on ? Math.min(1, f.t / 1.2) : 0;
        for (let i = 0; i < perFire; i++) {
          const j = (s * perFire + i) * 4;
          centre[j] = on ? f.x : 0; centre[j + 1] = on ? f.y : 0; centre[j + 2] = on ? f.z : 0; centre[j + 3] = on ? f.r * .8 * (.4 + .6 * k) : 0;
        }
        const g = glows[s]; g.visible = on;
        if (on) { g.position.set(f.x, f.y + .06, f.z); const sc = f.r * 2.6 * (.85 + .15 * Math.sin(clock * 13 + s)); g.scale.set(sc, sc, 1); }
      }
      centreAttr.needsUpdate = true;
    }
    return { update, points };
  }

  // ---------------------------------------------------------------- Mündungsfeuer
  function createMuzzle(THREE, parent) {
    const mat = new THREE.MeshBasicMaterial({ map: glowTexture(THREE), color: 0xffa040, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
    const star = new THREE.Group(); star.visible = false; star.renderOrder = 25; parent.add(star);
    // Flammenzungen: gestreckte Lichtflecken nach vorn und zur Seite, dazu ein runder Kern.
    for (const [sx, sy, rz] of [[.34, .09, 0], [.34, .09, Math.PI / 2], [.26, .07, Math.PI / 4], [.26, .07, -Math.PI / 4]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.scale.set(sx, sy, 1); m.rotation.z = rz; m.renderOrder = 25; star.add(m);
    }
    const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); core.scale.set(.2, .2, 1); core.renderOrder = 25; star.add(core);
    const cone = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); cone.scale.set(.09, .5, 1); cone.rotation.x = -Math.PI / 2; cone.position.z = -.2; cone.renderOrder = 25; star.add(cone);
    const spin = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
    function show(position, t, camera) {
      star.visible = t > 0; if (!star.visible) return;
      star.position.copy(position);
      if (camera) star.quaternion.copy(camera.quaternion).multiply(spin.setFromAxisAngle(axis, Math.random() * Math.PI));
      const k = .75 + Math.random() * .5; star.scale.setScalar(k);
      mat.opacity = Math.min(1, t / .04);
    }
    return { show, group: star };
  }

  // ---------------------------------------------------------------- Vorräte
  let kit = null;
  function itemKit(THREE) {
    if (kit) return kit;
    const c = (hex, emissive) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), emissive: new THREE.Color(emissive).convertSRGBToLinear() });
    const box = new THREE.BoxGeometry(1, 1, 1), bullet = new THREE.CylinderGeometry(.5, .5, 1, 8), tip = new THREE.ConeGeometry(.5, 1, 8);
    const M = {
      olive: c('#3f4a2c', '#1a200f'), band: c('#d8b23a', '#5a4410'), brass: c('#d2a64a', '#5c4214'), lead: c('#8a8f92', '#2a2c2e'),
      white: c('#f2f2ee', '#6a6a66'), red: c('#c8141a', '#7a0608'), strap: c('#3a3a3a', '#101010')
    };
    const glowAmmo = new THREE.SpriteMaterial({ map: glowTexture(THREE), color: 0xffc85a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glowHealth = new THREE.SpriteMaterial({ map: glowTexture(THREE), color: 0xff6a6a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const part = (g, geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
    function ammo() {
      const g = new THREE.Group();
      part(g, box, M.olive, 0, .17, 0, .56, .3, .34);
      part(g, box, M.band, 0, .17, 0, .57, .07, .35);
      part(g, box, M.strap, 0, .34, 0, .12, .04, .2);
      for (let i = 0; i < 4; i++) { const x = -.15 + i * .1; part(g, bullet, M.brass, x, .4, .06, .045, .12, .045); part(g, tip, M.lead, x, .49, .06, .045, .06, .045); }
      const s = new THREE.Sprite(glowAmmo); s.scale.set(1.6, 1.6, 1); s.position.y = .25; g.add(s);
      return g;
    }
    function health() {
      const g = new THREE.Group();
      part(g, box, M.white, 0, .18, 0, .52, .32, .32);
      // Rotes Kreuz auf Deckel und Vorderseite
      part(g, box, M.red, 0, .345, 0, .3, .02, .09); part(g, box, M.red, 0, .345, 0, .09, .02, .24);
      part(g, box, M.red, 0, .18, .162, .22, .07, .02); part(g, box, M.red, 0, .18, .162, .07, .22, .02);
      part(g, box, M.red, 0, .18, -.162, .22, .07, .02); part(g, box, M.red, 0, .18, -.162, .07, .22, .02);
      part(g, box, M.strap, 0, .37, 0, .2, .04, .05);
      const s = new THREE.Sprite(glowHealth); s.scale.set(1.6, 1.6, 1); s.position.y = .25; g.add(s);
      return g;
    }
    kit = { ammo, health };
    return kit;
  }
  return { createFire, createMuzzle, itemKit };
})();
