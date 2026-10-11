'use strict';

// Himmel und Licht: Kuppel mit Verlauf, Sonne und Wolken aus Rauschen, dazu Sonnen-/Mondlicht, Hemisphärenlicht und Nebelfarbe.
// Zustand: night 0 = Sonnenuntergang (Spielstart), 1 = tiefe, graue Nacht; sunrise 0..1 = Morgengrauen; cover = Bewölkung;
// grey = zusätzliche Entsättigung; blood = roter Schimmer in der letzten Phase; lightK = Gesamtfaktor der Lichtstärke.
globalThis.NachtjagdSky = {
  create({ THREE, scene, sun, hemi }) {
    const col = hex => new THREE.Color(hex).convertSRGBToLinear();
    const lerp = (a, b, k) => a + (b - a) * k;
    const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    // Farbsätze: Sonnenuntergang, Nacht, Morgengrauen (sRGB, werden einmal nach linear umgerechnet).
    const SET = {
      horizon:    [col('#f08a4b'), col('#2b3240'), col('#f4b48c')],
      mid:        [col('#8a6578'), col('#1a202c'), col('#b98f98')],
      zenith:     [col('#26345c'), col('#090d16'), col('#5d7090')],
      ground:     [col('#6a5258'), col('#10141b'), col('#8b7076')],
      sunCol:     [col('#ffb06a'), col('#8fa4d6'), col('#ffd2a8')],
      cloudLit:   [col('#ffb383'), col('#4b5565'), col('#ffd6b0')],
      cloudDark:  [col('#4a3f52'), col('#12161f'), col('#8a7a86')],
      fog:        [col('#85686e'), col('#1d222c'), col('#cfa58f')],
      lightCol:   [col('#ffbd8c'), col('#8196c9'), col('#ffc8a0')],
      hemiSky:    [col('#98a0c4'), col('#4b5c7e'), col('#e0b6a4')],
      hemiGround: [col('#5d4a48'), col('#1c2028'), col('#6e5b57')]
    };
    const blood = col('#4a1218'), greyTarget = new THREE.Color();
    const mix3 = (set, night, dawn, out) => {
      out.copy(set[0]).lerp(set[1], night).lerp(set[2], dawn);
      return out;
    };
    const uniforms = {
      uSun: { value: new THREE.Vector3(-.8, .06, .45).normalize() },
      uHorizon: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
      uCover: { value: .7 }, uTime: { value: 0 }, uGlow: { value: 1 }, uDark: { value: .5 }
    };
    const material = new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir;\nvoid main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `
varying vec3 vDir;
uniform vec3 uSun, uHorizon, uMid, uZenith, uGround, uSunCol, uCloudLit, uCloudDark;
uniform float uCover, uTime, uGlow, uDark;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.02 + vec2(3.1, 1.7); a *= .5; } return s; }
float field(vec2 p) { float b = fbm2(p); float d = fbm2(p * 3.1 + vec2(uTime * .012, 0.)); return b * .78 + d * .22; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y, up = max(y, 0.);
  vec3 c = mix(uHorizon, uMid, smoothstep(0., .2, up));
  c = mix(c, uZenith, smoothstep(.15, .85, up));
  c = mix(c, uGround, smoothstep(0., .3, -y));
  float sd = max(dot(d, uSun), 0.);
  float glow = pow(sd, 5.) * .42 + pow(sd, 48.) * .7;
  c += uSunCol * glow * uGlow * (1. - smoothstep(0., .7, up) * .55);
  float disc = smoothstep(.9990, .9996, sd) * uGlow * step(0., y);
  float cloudCut = 1.;
  if (y > -.03) {
    vec2 p = d.xz / (up + .2) * .55 + vec2(uTime * .006, uTime * .0032);
    float f = field(p);
    float thr = 1. - uCover;
    float dens = smoothstep(thr - .03, thr + .3, f);
    vec2 toward = normalize(uSun.xz + vec2(1e-4)) * .05;
    float f2 = field(p + toward);
    float shade = clamp((f - f2) * 5. + .5, 0., 1.);
    float edge = 1. - smoothstep(thr + .04, thr + .34, f);
    float facing = .4 + .6 * sqrt(sd);
    vec3 cc = mix(uCloudDark, uCloudLit, smoothstep(.25, .8, shade) * facing);
    cc = mix(cc, uCloudDark, smoothstep(.55, 1., dens) * uDark);
    cc += uSunCol * edge * pow(sd, 4.) * .7 * uGlow;
    float fade = smoothstep(-.03, .17, y);
    cc = mix(uHorizon * .9, cc, fade);
    float a = dens * (.55 + .45 * fade);
    c = mix(c, cc, a);
    cloudCut = 1. - a;
  }
  c += uSunCol * disc * 2.2 * cloudCut;
  gl_FragColor = vec4(c, 1.);
  gl_FragColor = linearToOutputTexel(gl_FragColor);
}`
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3200, 40, 20), material);
    dome.frustumCulled = false; dome.renderOrder = -1000; dome.name = 'Himmel';
    scene.add(dome);
    const baseSun = sun.intensity, baseHemi = hemi.intensity;
    const tmp = new THREE.Color(), fogColor = new THREE.Color();
    const sunAt = (night, dawn) => {   // Richtung der sichtbaren Sonne
      const west = new THREE.Vector3(-.8, lerp(.07, -.22, smooth(0, 1, night)), .45);
      const east = new THREE.Vector3(.8, lerp(-.12, .1, dawn), -.4);
      return west.lerp(east, dawn).normalize();
    };
    const lightAt = (night, dawn) => { // Richtung des Lichts: Dämmerlicht etwas höher, Mond hoch, damit Schatten brauchbar bleiben
      const dusk = new THREE.Vector3(-.8, .5, .45), moon = new THREE.Vector3(.35, .9, -.3), morn = new THREE.Vector3(.8, .45, -.4);
      return dusk.lerp(moon, smooth(0, 1, night)).lerp(morn, dawn).normalize();
    };
    const state = { night: 0, sunrise: 0, cover: .7, grey: 0, blood: 0, lightK: 1 };
    function apply(s = {}) {
      Object.assign(state, s);
      const night = Math.min(1, Math.max(0, state.night)), dawn = Math.min(1, Math.max(0, state.sunrise));
      const n = smooth(0, 1, night);
      const setColor = (target, set, tint) => {
        mix3(set, n, dawn, target);
        if (state.blood > 0 && tint) target.lerp(blood, state.blood * tint);
        const grey = Math.min(1, state.grey + n * .55) * (1 - dawn * .8);
        const l = target.r * .3 + target.g * .59 + target.b * .11;
        target.lerp(greyTarget.setRGB(l, l, l * 1.04), grey * .6);
      };
      setColor(uniforms.uHorizon.value, SET.horizon, .45); setColor(uniforms.uMid.value, SET.mid, .5); setColor(uniforms.uZenith.value, SET.zenith, .3);
      setColor(uniforms.uGround.value, SET.ground, .3); setColor(uniforms.uSunCol.value, SET.sunCol, .2);
      setColor(uniforms.uCloudLit.value, SET.cloudLit, .55); setColor(uniforms.uCloudDark.value, SET.cloudDark, .3);
      uniforms.uSun.value.copy(sunAt(n, dawn));
      uniforms.uGlow.value = lerp(1, .12, n) * (1 - dawn) + dawn * .9;
      uniforms.uDark.value = lerp(.45, .8, n);
      // Viele Wolken von Anfang an, in der Nacht fast geschlossen.
      const cover = Math.max(state.cover, .62 + .3 * n);
      uniforms.uCover.value = lerp(cover, Math.min(cover, .5), dawn);
      // Licht
      const dir = lightAt(n, dawn);
      sun.position.copy(dir).multiplyScalar(300);
      setColor(sun.color, SET.lightCol, .4);
      const lk = state.lightK;
      sun.intensity = baseSun * lk * lerp(lerp(1.15, .38, n), 1, dawn);
      setColor(hemi.color, SET.hemiSky, .3); setColor(hemi.groundColor, SET.hemiGround, .2);
      hemi.intensity = baseHemi * lk * lerp(lerp(1, .55, n), .95, dawn);
      // Nebelfarbe für Szene und Rückfall-Hintergrund
      setColor(fogColor, SET.fog, .5);
      return fogColor;
    }
    function update(camera, dt) { dome.position.copy(camera.position); uniforms.uTime.value += dt; }
    const owns = o => o === sun || o === hemi;
    apply({});
    return { apply, update, owns, state, fogColor, dome, uniforms };
  }
};
