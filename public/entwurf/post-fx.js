'use strict';

// Nachbearbeitung nach dem Altay-Original: Kantenglättung (FXAA), weiches Glühen heller Lichter aus Mipmaps,
// kühle Schatten und warme Lichter, sanfte S-Kurve, Vignette und feines Filmkorn.
// Ein einziger zusätzlicher Vollbilddurchgang; ohne WebGL2 entfällt nur das Glühen.
(function (root) {
  const FRAGMENT = `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uT; uniform float uBloom; uniform float uGrain;
uniform float uGrade; uniform float uVignette; uniform vec3 uTint;
varying vec2 vUv;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec2 px = 1.0 / uRes;
  vec3 nw = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb, ne = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
  vec3 sw = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb, se = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb, m = texture2D(tDiffuse, vUv).rgb;
  float lnw = lum(nw), lne = lum(ne), lsw = lum(sw), lse = lum(se), lm = lum(m);
  float lmin = min(lm, min(min(lnw, lne), min(lsw, lse))), lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
  vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
  float red = max((lnw + lne + lsw + lse) * 0.03125, 0.0078125), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
  float lb = lum(b); vec3 col = (lb < lmin || lb > lmax) ? a : b;
  if (uBloom > 0.0) {
    vec3 g = texture2D(tDiffuse, vUv, 3.0).rgb * 0.22 + texture2D(tDiffuse, vUv, 4.0).rgb * 0.3 + texture2D(tDiffuse, vUv, 5.0).rgb * 0.26 + texture2D(tDiffuse, vUv, 6.0).rgb * 0.22;
    // Nur warme, helle Bildteile glühen (Fenster, Flammen, Lampen); heller Schnee kaum.
    vec3 hot = max(g - vec3(0.5), 0.0);
    float warm = smoothstep(-0.02, 0.12, g.r - g.b);
    col += hot * (0.12 + 1.1 * warm) * uBloom;
  }
  col = clamp(col, 0.0, 1.0);
  float l = lum(col);
  col = mix(vec3(l), col, 1.0 + 0.1 * uGrade);
  col *= mix(vec3(0.95, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.1, 0.75, l)) * uGrade + vec3(1.0 - uGrade);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22 * uGrade);
  col *= uTint;
  vec2 q = vUv - 0.5; col *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  float gr = fract(sin(dot(vUv * uRes + vec2(uT * 37.0, uT * 91.0), vec2(12.9898, 78.233))) * 43758.5453);
  col += (gr - 0.5) * uGrain * (1.0 - l * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

  function create({ THREE: T, renderer }) {
    const material = new T.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uT: { value: 0 }, uBloom: { value: 0 }, uGrain: { value: .012 },
        uGrade: { value: 1 }, uVignette: { value: .32 }, uTint: { value: new T.Vector3(1, 1, 1) }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAGMENT
    });
    const quadScene = new T.Scene(), quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const triangle = new T.BufferGeometry();
    triangle.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new T.Mesh(triangle, material); quad.frustumCulled = false; quadScene.add(quad);
    const size = new T.Vector2();
    const bloomSupported = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
    let target = null, enabled = true, bloom = bloomSupported, time = 0;

    function sync() {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(2, size.x), h = Math.max(2, size.y);
      if (target && target.width === w && target.height === h && target.texture.generateMipmaps === bloom) return;
      if (target) target.dispose();
      target = new T.WebGLRenderTarget(w, h, {
        minFilter: bloom ? T.LinearMipmapLinearFilter : T.LinearFilter, magFilter: T.LinearFilter,
        format: T.RGBAFormat, type: T.UnsignedByteType, depthBuffer: true, stencilBuffer: false
      });
      target.texture.generateMipmaps = bloom;
      // Gleiche Farbkodierung wie die Bildschirmausgabe: das Bild sieht ohne Nachbearbeitung gleich hell aus.
      target.texture.encoding = renderer.outputEncoding;
      material.uniforms.tDiffuse.value = target.texture;
      material.uniforms.uRes.value.set(w, h);
      material.uniforms.uBloom.value = bloom ? 1 : 0;
    }
    function render(scene, camera, dt = .016) {
      if (!enabled) { renderer.render(scene, camera); return; }
      sync(); time += dt; material.uniforms.uT.value = time % 100;
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCamera);
    }
    function set(options = {}) {
      if (options.enabled !== undefined) enabled = !!options.enabled;
      if (options.bloom !== undefined) bloom = !!options.bloom && bloomSupported;
      const u = material.uniforms;
      for (const [key, name] of [['bloomStrength', 'uBloom'], ['grain', 'uGrain'], ['grade', 'uGrade'], ['vignette', 'uVignette']]) {
        if (options[key] !== undefined && (name !== 'uBloom' || bloom)) u[name].value = options[key];
      }
      if (options.tint) u.uTint.value.set(...options.tint);
    }
    return { render, set, sync, material, get enabled() { return enabled; }, get bloom() { return bloom; }, get target() { return target; } };
  }

  const api = { create, FRAGMENT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdPostFx = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
