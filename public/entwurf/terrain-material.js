'use strict';

// Bodenmaterial mit Fels, Schichtung und Schnee. Die Vertexfarben tragen weiter Wiese und Waldboden;
// ab etwa 70 m mischt der Shader nach Neigung und Höhe dunklen, geschichteten Fels dazu, darüber Schnee.
// Das Rauschen kommt aus einer kleinen, einmalig berechneten 256×256-Textur (drei Abfragen je Pixel statt rechnerischem Rauschen),
// die Feinstruktur der Normalen aus Bildschirmableitungen. Es gibt keine Bilddateien.
globalThis.NachtjagdTerrainMaterial = {
  // Kachelbares Wertrauschen, vier Kanäle mit unterschiedlicher Körnung (R grob, G mittel, B fein, A für Rinnen).
  makeNoise(THREE, size = 256) {
    const hash = (x, y, seed) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
    const layer = (cells, seed, u, v) => {
      const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
      let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = hash(ix % cells, iy % cells, seed), b = hash((ix + 1) % cells, iy % cells, seed), c = hash(ix % cells, (iy + 1) % cells, seed), d = hash((ix + 1) % cells, (iy + 1) % cells, seed);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const plan = [[[4, .5], [8, .3], [16, .2]], [[8, .5], [16, .3], [32, .2]], [[24, .5], [48, .3], [96, .2]], [[6, .4], [12, .35], [36, .25]]];
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let ch = 0; ch < 4; ch++) {
      let value = 0;
      for (const [cells, amp] of plan[ch]) value += amp * layer(cells, ch * 11 + cells, x / size, y / size);
      data[(y * size + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round(value * 255)));
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  },
  create(THREE) {
    const material = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x000000, shininess: 0 });
    const uniforms = { uSnowLine: { value: 215 }, uSnowAmount: { value: 1 }, uDetail: { value: 1 }, uNoise: { value: this.makeNoise(THREE) } };
    material.userData.uniforms = uniforms;
    material.extensions = { derivatives: true };
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
uniform float uSnowLine;
uniform float uSnowAmount;
uniform float uDetail;
uniform sampler2D uNoise;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float gRock, gSnow, gFine;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  // Drei Abfragen: grob (180 m Kachel), fein (23 m Kachel) und gestreckt für Rinnen.
  vec4 A = texture2D(uNoise, vWP.xz / 180.);
  vec4 B = texture2D(uNoise, vWP.xz / 23.);
  vec4 S = texture2D(uNoise, vec2((vWP.x + vWP.z * .7) / 55., vWP.y / 90.));
  gFine = B.r * .55 + B.g * .45;
  vec3 wn = normalize(vWN);
  float slope = 1. - wn.y;
  float hgt = vWP.y;
  gRock = 0.; gSnow = 0.;
  if (hgt > 70.) {
    float nLow = A.r;
    float nMid = A.g * .55 + B.g * .45;
    float warp = A.b * 5.;
    float band = sin(vWP.y * .16 + warp * 1.6) * .5 + .5;
    float band2 = sin(vWP.y * .7 + warp * 2.) * .5 + .5;
    float streak = S.a * .6 + B.r * .4;
    vec3 rockA = lin(vec3(.16, .15, .15)), rockB = lin(vec3(.30, .28, .26)), rockC = lin(vec3(.23, .24, .27));
    vec3 rock = mix(rockA, rockB, smoothstep(.28, .78, nMid * .55 + band * .5 + streak * .35));
    rock = mix(rock, rockC, smoothstep(.5, .8, nLow) * .55);
    rock *= .78 + .3 * mix(band2, nMid, .6) * (.4 + .6 * streak);
    gRock = smoothstep(.18, .42, slope + (nMid - .5) * .14) * smoothstep(70., 115., hgt);
    vec3 tundra = lin(vec3(.30, .31, .24)) * (.8 + .4 * nMid);
    float gentle = smoothstep(95., 150., hgt) * (1. - gRock);
    vec3 base = mix(diffuseColor.rgb, tundra, gentle * .65);
    base = mix(base, rock, gRock);
    float line = uSnowLine + (nLow - .5) * 110.;
    float snow = smoothstep(line, line + 90., hgt);
    snow *= 1. - smoothstep(.40, .74, slope + (nMid - .5) * .26 - streak * .12);
    snow += smoothstep(.56, .78, nMid) * (1. - smoothstep(.0, .34, slope)) * smoothstep(150., 230., hgt) * .55;
    gSnow = clamp(snow, 0., 1.) * uSnowAmount;
    vec3 snowCol = lin(vec3(.86, .89, .94)) * (.9 + .12 * nMid);
    diffuseColor.rgb = mix(base, snowCol, gSnow);
  }
}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // Ableitungen außerhalb der Verzweigung, damit sie überall definiert sind
  vec3 dpx = dFdx(vWP), dpy = dFdy(vWP);
  float rawX = dFdx(gFine), rawY = dFdy(gFine);
  float k = gRock * (1. - gSnow * .75) + gSnow * .18;
  if (k > .02 && uDetail > .5) {
    // Bump aus Bildschirmableitungen der feinen Rauschhöhe (nach Mikkelsen), in Weltkoordinaten
    vec3 wn = normalize(vWN);
    vec3 r1 = cross(dpy, wn), r2 = cross(wn, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (rawX * r1 + rawY * r2) * k * 5.;
    vec3 pn = normalize(abs(det) * wn - grad);
    normal = normalize((viewMatrix * vec4(pn, 0.)).xyz);
  }
}`);
    };
    material.customProgramCacheKey = () => 'nachtjagd-terrain-3';
    return material;
  }
};
