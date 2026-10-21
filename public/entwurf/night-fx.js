'use strict';

// Schneefall und sichtbarer Lampenkegel nach dem Altay-Original.
// Der Schnee liegt in einem 76 x 36 x 76 m großen Kasten, der mit der Kamera wandert und sich auf der Grafikkarte
// wiederholt (keine Rechenarbeit pro Flocke im Hauptprogramm). Die Flocken sind klein (2 bis 5 cm), erscheinen im
// Dunkeln nur als schwacher Schimmer und leuchten dort auf, wo Taschenlampe oder Lampen hinscheinen.
(function (root) {
  const BOX = [76, 36, 76];

  function createSnow({ THREE: T, scene, lamps, count = 9000 }) {
    const position = new Float32Array(count * 3);
    for (let i = 0; i < position.length; i++) position[i] = Math.random();
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(position, 3));
    const uniforms = {
      uT: { value: 0 }, uCam: { value: new T.Vector3() }, uScale: { value: 600 }, uK: { value: .85 }, uDrift: { value: new T.Vector2() },
      uWind: { value: 1 }, uFall: { value: 1 }, uLight: { value: .5 }, uOpacity: { value: 1 },
      uFlashPos: { value: new T.Vector3() }, uFlashDir: { value: new T.Vector3(0, 0, -1) }, uFlashCos: { value: new T.Vector2(.86, .955) },
      uFlashOn: { value: 1 }, uFlashAtt: { value: .0045 },
      uLfPos: lamps ? lamps.uniforms.uLfPos : { value: [] }, uLfCol: lamps ? lamps.uniforms.uLfCol : { value: [] }
    };
    const slots = lamps ? lamps.SLOTS : 0;
    const material = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uT; uniform vec3 uCam; uniform float uScale; uniform float uK; uniform vec2 uDrift; uniform float uWind; uniform float uFall;
varying float vA; varying vec3 vWP; varying float vS;
void main() {
  vec3 B = vec3(${BOX[0]}.0, ${BOX[1]}.0, ${BOX[2]}.0); vec3 s = position; vec3 p = s * B;
  // Fallen mit leicht unterschiedlicher Geschwindigkeit, dazu Taumeln im Wind
  p.y -= uT * (1.1 + s.x * 1.3) * uFall;
  p.x += uDrift.x + sin(uT * 0.7 + s.z * 30.0) * uWind * 0.8 + sin(uT * 2.3 + s.y * 40.0) * 0.12;
  p.z += uDrift.y + cos(uT * 0.6 + s.x * 25.0) * uWind * 0.8 + cos(uT * 1.9 + s.z * 35.0) * 0.12;
  vec3 rel = mod(p - uCam + B * 0.5, B) - B * 0.5;
  vWP = uCam + rel; vec4 mv = viewMatrix * vec4(vWP, 1.0); float d = -mv.z;
  gl_PointSize = clamp((0.05 + s.y * 0.075) * uScale / max(d, 0.3), 2.4, 12.0); vS = gl_PointSize;
  // Schneestärke: ein zufälliger Teil der Flocken wird ausgeblendet (eigener Zufallswert, unabhängig vom Ort)
  float h = fract(sin(dot(s, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  float vis = 1.0 - smoothstep(uK - 0.012, uK + 0.012, h);
  vA = (1.0 - smoothstep(5.0, 36.0, d)) * smoothstep(0.25, 1.4, d) * vis; // aufsteigende Kanten (GLSL-konform)
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `varying float vA; varying vec3 vWP; varying float vS; uniform float uLight; uniform float uOpacity;
uniform vec3 uFlashPos; uniform vec3 uFlashDir; uniform float uFlashOn; uniform vec2 uFlashCos; uniform float uFlashAtt;
${slots ? `uniform vec4 uLfPos[${slots}]; uniform vec3 uLfCol[${slots}];` : ''}
void main() {
  vec2 c = gl_PointCoord - 0.5; // Kleine Punkte (ferne Flocken) erhalten eine weichere, vollere Maske, damit sie nicht verschwinden.
  float tiny = 1.0 - smoothstep(2.5, 6.0, vS);
  float a = min(1.0, (1.0 - smoothstep(mix(0.15, 0.36, tiny), 0.5, length(c))) * vA * (1.25 + 0.5 * tiny)) * uOpacity;
  if (a < 0.003) discard;
  vec3 ray = vWP - uFlashPos; float d = max(length(ray), 0.001);
  float cone = smoothstep(uFlashCos.x, uFlashCos.y, dot(ray / d, uFlashDir));
  vec3 lit = vec3(uLight) + vec3(2.4, 2.25, 1.95) * cone * uFlashOn / (1.0 + d * d * uFlashAtt);
  ${slots ? `for (int i = 0; i < ${slots}; i++) { float f = max(0.0, 1.0 - length(vWP - uLfPos[i].xyz) / uLfPos[i].w); lit += uLfCol[i] * f * f * 1.6; }` : ''}
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * min(lit, vec3(1.25)), a);
}`
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false; points.renderOrder = 6; points.name = 'Schneefall';
    scene.add(points);
    let t = 0;
    const drift = new T.Vector2();
    // k: Schneestärke 0..1, light: Grundhelligkeit der Flocken (Mond, Himmel), wind: Taumeln, dx/dz: Windrichtung.
    function update(camera, dt, { k = .85, light = .5, wind = 1, dx = 0, dz = 0, opacity = 1, scale = 600, flash = null } = {}) {
      t += dt; drift.x += dx * dt; drift.y += dz * dt;
      uniforms.uT.value = t; uniforms.uCam.value.copy(camera.position); uniforms.uK.value = Math.max(0, Math.min(1, k));
      uniforms.uLight.value = light; uniforms.uWind.value = wind; uniforms.uDrift.value.copy(drift); uniforms.uOpacity.value = opacity;
      uniforms.uScale.value = scale;
      if (flash) {
        uniforms.uFlashPos.value.copy(flash.position); uniforms.uFlashDir.value.copy(flash.direction);
        uniforms.uFlashCos.value.set(flash.cosOuter, flash.cosInner); uniforms.uFlashOn.value = flash.on ? flash.k || 1 : 0;
      } else uniforms.uFlashOn.value = 0;
      points.visible = opacity > .01 && k > .01;
    }
    return { points, uniforms, update };
  }

  // Leichter, additiver Kegel vor der Lampe: im Nebel und Schneefall sichtbar, ohne die Szene zu überstrahlen.
  function createBeam({ THREE: T, parent }) {
    const material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { uA: { value: .06 }, uCol: { value: new T.Color(1, .93, .78) } },
      vertexShader: 'varying float vT; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vT = -position.z; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vT; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = uA * pow(1.0 - clamp(vT, 0.0, 1.0), 1.5) * smoothstep(0.0, 0.12, vT) * (0.25 + 0.75 * e) * smoothstep(2.0, 8.0, vD); gl_FragColor = vec4(uCol * a, a); }'
    });
    const geometry = new T.ConeGeometry(1, 1, 22, 1, true);
    geometry.translate(0, -.5, 0); geometry.rotateX(Math.PI / 2);
    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.visible = false; mesh.name = 'Lampenkegel';
    mesh.position.set(.12, -.12, 0);
    parent.add(mesh);
    function update({ on, length = 22, angle = .5, strength = .06 }) {
      mesh.visible = !!on; if (!on) return;
      const r = length * Math.tan(angle * .95);
      mesh.scale.set(r, r, length); material.uniforms.uA.value = strength;
    }
    return { mesh, update };
  }

  const api = { createSnow, createBeam, BOX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdNightFx = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
