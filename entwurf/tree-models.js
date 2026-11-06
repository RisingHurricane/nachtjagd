'use strict';

// Eigene Baummodelle statt der heruntergeladenen GLBs: gleiche Rolle (acht Varianten, Höhe 1, Fuß bei y = 0,
// Mitte bei x = z = 0), aber ohne Texturen und mit wenigen Dreiecken. Nadelbäume aus gezackten, leicht hängenden
// Astetagen mit Schnee auf den Oberseiten, kahle Bäume aus Stamm und Ästen. Farben stecken in den Vertexfarben,
// alle Varianten teilen ein Material. Jede Variante hat eine Fernfassung (userData.far) mit etwa einem Drittel der Dreiecke.
// Vertrag wie imported-models.js: variants(THREE) liefert Gruppen, deren Kinder Netze sind (Stamm, Krone).
globalThis.NachtjagdTreeModels = (() => {
  let cache = null;
  // Kleiner deterministischer Zufall je Variante.
  const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function builder(THREE) {
    const pos = [], col = [];
    const tint = (hex, k = 1) => { const c = new THREE.Color(hex).convertSRGBToLinear(); return [c.r * k, c.g * k, c.b * k]; };
    function tri(a, b, c, ca, cb, cc) {
      pos.push(...a, ...b, ...c); col.push(...ca, ...(cb || ca), ...(cc || ca));
    }
    function finish() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      return g;
    }
    return { tri, finish, tint };
  }

  // Stamm: sechseckiger Kegelstumpf.
  function trunk(THREE, height, r0, r1, sides, color) {
    const b = builder(THREE), dark = b.tint(color, .75), light = b.tint(color, 1.1);
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      const p = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      b.tri(p(a0, r0, 0), p(a1, r0, 0), p(a1, r1, height), dark, dark, light);
      b.tri(p(a0, r0, 0), p(a1, r1, height), p(a0, r1, height), dark, light, light);
    }
    return b.finish();
  }

  // Nadelkrone: Etagen als gezackte Kegel. Spitze schneebedeckt, Rand dunkelgrün, Unterseite schattig.
  function pineCrown(THREE, { base, top, radius, tiers, sides, droop, seed, needle, snow }) {
    const b = builder(THREE), random = rng(seed);
    const green = b.tint(needle), deep = b.tint(needle, .55), white = b.tint('#dfe7ec');
    for (let t = 0; t < tiers; t++) {
      const k = t / tiers, y0 = base + (top - base) * k * .92, y1 = y0 + (top - base) / tiers * 1.75;
      const r = radius * (1 - k * .82) * (.92 + random() * .16), turn = random() * Math.PI;
      const apex = [(random() - .5) * radius * .05, Math.min(top, y1), (random() - .5) * radius * .05];
      const snowy = green.map((v, i) => v + (white[i] - v) * snow * (.55 + .3 * random()));
      const rim = [];
      for (let i = 0; i < sides; i++) {
        const a = turn + i / sides * Math.PI * 2, rr = r * (i % 2 ? .78 : 1);
        rim.push([Math.cos(a) * rr, y0 - droop * rr - (i % 2 ? 0 : .01), Math.sin(a) * rr]);
      }
      const under = [0, y0 + (y1 - y0) * .18, 0];
      for (let i = 0; i < sides; i++) {
        const a = rim[i], c = rim[(i + 1) % sides];
        b.tri(a, apex, c, green, snowy, green);           // Oberseite: zur Spitze hin Schnee
        b.tri(a, c, under, deep, deep, deep);             // Unterseite: dunkel
      }
    }
    return b.finish();
  }

  // Kahler Baum: Äste als dünne, dreiseitige Kegel vom Stamm schräg nach oben.
  function deadCrown(THREE, { height, branches, seed, color }) {
    const b = builder(THREE), random = rng(seed), bark = b.tint(color, .9), tip = b.tint(color, 1.2), white = b.tint('#dfe7ec');
    for (let i = 0; i < branches; i++) {
      const y = height * (.35 + .55 * i / branches), a = random() * Math.PI * 2 + i * 2.4;
      const length = height * (.18 + .22 * random()) * (1 - i / branches * .5), rise = .45 + random() * .5;
      const start = [0, y, 0], end = [Math.cos(a) * length, y + length * rise, Math.sin(a) * length];
      const w = height * .012 * (1 - i / branches * .5);
      const side = [Math.cos(a + Math.PI / 2) * w, 0, Math.sin(a + Math.PI / 2) * w];
      const s1 = [start[0] + side[0], start[1] + w, start[2] + side[2]], s2 = [start[0] - side[0], start[1] + w, start[2] - side[2]], s3 = [start[0], start[1] - w, start[2]];
      b.tri(s1, s2, end, bark, bark, tip); b.tri(s2, s3, end, bark, bark, tip); b.tri(s3, s1, end, bark, bark, tip);
      // Etwas Schnee auf dem Ast
      b.tri(s1, s2, [end[0] * .7 + s1[0] * .3, end[1] * .7 + s1[1] * .3 + w * .6, end[2] * .7 + s1[2] * .3], white, white, white);
    }
    return b.finish();
  }

  const PINES = [
    // Gewöhnliche Fichte (häufigste Variante)
    { tiers: 7, radius: .2, base: .2, droop: .16, needle: '#2f4f3f', snow: .55, bark: '#4a3828' },
    // Schlanke Fichte
    { tiers: 8, radius: .15, base: .22, droop: .2, needle: '#2a4637', snow: .5, bark: '#46352a' },
    // Breite Tanne
    { tiers: 6, radius: .26, base: .18, droop: .12, needle: '#34543f', snow: .6, bark: '#4d3a2a' },
    // Hohe Kiefer mit Krone erst weit oben
    { tiers: 5, radius: .19, base: .42, droop: .08, needle: '#3a5641', snow: .45, bark: '#5a4330' },
    // Junge, dichte Fichte
    { tiers: 6, radius: .22, base: .12, droop: .18, needle: '#2d4b3b', snow: .65, bark: '#4a3828' }
  ];
  const DEAD = [{ branches: 7, bark: '#5d5047' }, { branches: 5, bark: '#4f453e' }, { branches: 9, bark: '#665a50' }];

  // Sternbaum (nach Lights Tannenstudie): acht gekreuzte, senkrechte Flächen mit gemalter Textur, dazu ein Stamm.
  function cardTexture(THREE, initialSeed, dead) {
    let seed = initialSeed; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, between = (a, b) => a + (b - a) * random();
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), k = .5;
    x.scale(k, k);
    x.fillStyle = '#554735'; x.beginPath(); x.moveTo(501, 1000); x.lineTo(505, 110); x.lineTo(517, 110); x.lineTo(526, 1000); x.fill();
    for (let i = 0; i < 42; i++) {
      const y = 190 + i * 17, t = (y - 120) / 850, width = 20 + 385 * Math.pow(t, .85);
      for (const side of [-1, 1]) {
        const len = width * between(.72, 1.06), lift = between(14, 42);
        x.strokeStyle = '#514d35'; x.lineWidth = between(3, 5); x.beginPath(); x.moveTo(512, y); x.quadraticCurveTo(512 + side * len * .63, y + 30, 512 + side * len, y - lift); x.stroke();
        if (dead) continue;
        for (let n = 0; n < Math.floor(len / 6); n++) {
          const q = between(.03, 1), px = 512 + side * len * q, py = y + 2 * (1 - q) * q * 30 - q * q * lift, r = between(9, 22) * (1 - q * .28);
          x.fillStyle = random() < .14 ? '#dfe7ec' : ['#294b32', '#355c3a', '#426c44', '#537a4e', '#294b35', '#66875b'][Math.floor(random() * 6)];
          x.beginPath(); x.ellipse(px, py + between(-6, 6), r * between(1, 1.6), r * between(.35, .6), side * between(-.3, .2), 0, Math.PI * 2); x.fill();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; return tex;
  }
  function cardVariants(THREE) {
    const textures = [cardTexture(THREE, 43817), cardTexture(THREE, 94621), cardTexture(THREE, 7713, true)];
    const mats = textures.map(map => new THREE.MeshLambertMaterial({ map, alphaTest: .35, side: THREE.DoubleSide, name: 'treeCard' }));
    const bark = new THREE.MeshLambertMaterial({ color: new THREE.Color('#594a36').convertSRGBToLinear() });
    // Eine Fläche 0,77 × 1 (Seitenverhältnis der Studie), Fuß bei y = 0; acht Drehungen in einem Netz.
    function cross(planes) {
      const parts = [];
      for (let i = 0; i < planes; i++) { const g = new THREE.PlaneGeometry(.77, 1).toNonIndexed(); g.translate(0, .5, 0); g.rotateY(i * Math.PI / planes); parts.push(g); }
      const count = parts.reduce((n, g) => n + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
        const v = new Float32Array(count * size); let at = 0; for (const g of parts) { v.set(g.attributes[name].array, at); at += g.attributes[name].array.length; }
        out.setAttribute(name, new THREE.BufferAttribute(v, size));
      }
      out.computeBoundingSphere(); return out;
    }
    const near = cross(8), far = cross(4), trunkGeo = new THREE.CylinderGeometry(.006, .03, .87, 6); trunkGeo.translate(0, .435, 0);
    const list = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group(), mat = i >= 5 ? mats[2] : mats[i % 2];
      for (const geo of [trunkGeo, near]) { const m = new THREE.Mesh(geo, geo === trunkGeo ? bark : mat); m.castShadow = m.receiveShadow = true; g.add(m); }
      g.userData.far = [trunkGeo, far]; list.push(g);
    }
    return list;
  }
  function variants(THREE) {
    if (cache) return cache;
    if (typeof location !== 'undefined' && /[?&]baum=karte\b/.test(location.search) && typeof document !== 'undefined') return (cache = cardVariants(THREE));
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, name: 'treeProcedural' });
    const make = (meshes, far) => {
      const g = new THREE.Group();
      for (const geometry of meshes) { const m = new THREE.Mesh(geometry, material); m.castShadow = m.receiveShadow = true; g.add(m); }
      g.userData.far = far; return g;
    };
    const list = [];
    PINES.forEach((p, i) => {
      const crown = pineCrown(THREE, { base: p.base, top: 1, radius: p.radius, tiers: p.tiers, sides: 9, droop: p.droop, seed: 11 + i * 7, needle: p.needle, snow: p.snow });
      const farCrown = pineCrown(THREE, { base: p.base, top: 1, radius: p.radius, tiers: Math.max(3, Math.round(p.tiers / 2)), sides: 6, droop: p.droop, seed: 11 + i * 7, needle: p.needle, snow: p.snow });
      list.push(make([trunk(THREE, p.base + .2, p.radius * .1, p.radius * .05, 6, p.bark), crown],
        [trunk(THREE, p.base + .2, p.radius * .1, p.radius * .05, 4, p.bark), farCrown]));
    });
    DEAD.forEach((d, i) => {
      const crown = deadCrown(THREE, { height: 1, branches: d.branches, seed: 101 + i * 13, color: d.bark });
      const farCrown = deadCrown(THREE, { height: 1, branches: Math.ceil(d.branches / 2), seed: 101 + i * 13, color: d.bark });
      list.push(make([trunk(THREE, 1, .035, .008, 6, d.bark), crown], [trunk(THREE, 1, .035, .008, 4, d.bark), farCrown]));
    });
    cache = list;
    return list;
  }
  return { variants };
})();
