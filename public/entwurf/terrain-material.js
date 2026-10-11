'use strict';

// Bodenmaterial mit Fels, Schichtung und Schnee. Die Vertexfarben tragen weiter Wiese und Waldboden;
// ab etwa 40 m mischt der Shader nach Neigung und Höhe dunklen, geschichteten Fels dazu, darüber Schnee.
// Alles entsteht aus Weltkoordinaten und Normalen, es gibt keine Bilddateien.
globalThis.NachtjagdTerrainMaterial = {
  create(THREE) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const uniforms = { uSnowLine: { value: 215 }, uSnowAmount: { value: 1 } };
    material.userData.uniforms = uniforms;
    material.onBeforeCompile = shader => {
      shader.uniforms.uSnowLine = uniforms.uSnowLine;
      shader.uniforms.uSnowAmount = uniforms.uSnowAmount;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
uniform float uSnowLine;
uniform float uSnowAmount;
float h31(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm4(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec3(7.1, 3.7, 5.3); a *= .5; } return s; }
float fbm3(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + vec3(7.1, 3.7, 5.3); a *= .5; } return s * 1.14; }
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float gRock, gSnow;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 wn = normalize(vWN);
  float slope = 1. - wn.y;
  float hgt = vWP.y;
  gRock = 0.; gSnow = 0.;
  if (hgt > 36.) {
    float nLow = fbm4(vWP * .02);
    float nMid = fbm4(vWP * .11);
    float warp = fbm4(vec3(vWP.x * .012, vWP.y * .01, vWP.z * .012)) * 5.;
    float band = sin(vWP.y * .16 + warp * 1.6) * .5 + .5;
    float band2 = sin(vWP.y * .7 + warp * 2.) * .5 + .5;
    float streak = fbm4(vec3(vWP.x * .35, vWP.y * .025, vWP.z * .35));
    vec3 rockA = lin(vec3(.16, .15, .15)), rockB = lin(vec3(.30, .28, .26)), rockC = lin(vec3(.23, .24, .27));
    vec3 rock = mix(rockA, rockB, smoothstep(.28, .78, nMid * .55 + band * .5 + streak * .35));
    rock = mix(rock, rockC, smoothstep(.5, .8, nLow) * .55);
    rock *= .78 + .3 * mix(band2, nMid, .6) * (.4 + .6 * streak);
    gRock = smoothstep(.18, .42, slope + (nMid - .5) * .14) * smoothstep(36., 95., hgt);
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
  float k = gRock * (1. - gSnow * .75) + gSnow * .18;
  if (k > .02) {
    vec3 wn = normalize(vWN);
    vec3 q = vWP * vec3(.2, .15, .2);
    float e = .3;
    float b0 = fbm3(q);
    vec3 grad = vec3(fbm3(q + vec3(e, 0., 0.)) - b0, fbm3(q + vec3(0., e, 0.)) - b0, fbm3(q + vec3(0., 0., e)) - b0) / e;
    vec3 gt = grad - wn * dot(grad, wn);
    vec3 pn = normalize(wn - gt * k * 1.0);
    normal = normalize((viewMatrix * vec4(pn, 0.)).xyz);
  }
}`);
    };
    material.customProgramCacheKey = () => 'nachtjagd-terrain-1';
    return material;
  }
};
