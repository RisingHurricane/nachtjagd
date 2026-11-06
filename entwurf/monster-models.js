'use strict';

// Eigene Gegnermodelle für alle zehn Arten, ohne Downloads und ohne Skelett: Gelenke sind Gruppen, die sich drehen
// (Beine, Arme, Kopf, Flügel). Jede Art hat eine eigene Gestalt und leuchtende Augen. Teile je Gelenk und Material
// werden zu einem Netz zusammengefasst und zwischen allen Gegnern derselben Art geteilt; nur das Hautmaterial ist je
// Gegner eigen (Trefferfärbung). Koordinaten: Fuß bei y = 0, Blick nach +z, 1 Einheit = 1 m (vor spec.scale).
// Vertrag mit gameplay.js: build(THREE, kind, skin) → { model, parts }, animate(group, dt, motion, clock).
globalThis.NachtjagdMonsterModels = (() => {
  const cache = {};
  let M = null;
  function materials(THREE) {
    if (M) return M;
    const c = (hex, extra = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), ...extra });
    M = {
      cloth: c('#3b3433'), rag: c('#5b4a3c'), dark: c('#1d1a1b'), bone: c('#cfc4a8'), iron: c('#5b6064'), wood: c('#5a4030'),
      blood: c('#5e1414'), fur: c('#3e3830'), hair: c('#2a2a2e'), apron: c('#8a7a68'),
      eye: new THREE.MeshBasicMaterial({ color: 0xff3a1a }), eyeGreen: new THREE.MeshBasicMaterial({ color: 0x9cff5a }),
      eyeBlue: new THREE.MeshBasicMaterial({ color: 0x9ad8ff }), glow: c('#ff9a3a', { emissive: new THREE.Color('#c2501a') }),
      acid: c('#7fbf3a', { emissive: new THREE.Color('#2f5a10') })
    };
    return M;
  }
  // Grundformen (geteilt)
  let G = null;
  function shapes(THREE) {
    if (G) return G;
    G = {
      box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(.5, 8, 6), ballLow: new THREE.SphereGeometry(.5, 6, 4),
      cone: new THREE.ConeGeometry(.5, 1, 6), cyl: new THREE.CylinderGeometry(.5, .5, 1, 6), robe: new THREE.ConeGeometry(.5, 1, 8, 1, true),
      // Fledermausflügel: Haut zwischen Arm und Fingern, Hinterkante gezackt; nach +x, flach in der Ebene y = 0.
      wing: (() => { const s = new THREE.Shape(); s.moveTo(0, .06); s.lineTo(.22, .12); s.lineTo(.5, .1); s.lineTo(.42, -.06); s.lineTo(.36, -.02); s.lineTo(.3, -.16);
        s.lineTo(.22, -.06); s.lineTo(.14, -.18); s.lineTo(.07, -.07); s.lineTo(0, -.12); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })()
    };
    return G;
  }

  // Bauplan: Liste von Gelenken { name, at:[x,y,z], parts:[[form, material, x,y,z, sx,sy,sz, rx,ry,rz]] }.
  // Material 'skin' steht für das Hautmaterial des einzelnen Gegners.
  const P = (form, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => [form, mat, x, y, z, sx, sy, sz, rx, ry, rz];
  const eyes = (y, z, gap, r, mat = 'eye') => [P('ballLow', mat, -gap, y, z, r, r, r), P('ballLow', mat, gap, y, z, r, r, r)];
  const PLANS = {
    // Untoter Dorfbewohner: gebeugt, zerlumpter Kittel, Arme nach vorn
    villager: [
      { name: 'body', at: [0, .95, 0], parts: [P('box', 'rag', 0, .25, 0, .52, .7, .3, .25), P('box', 'skin', 0, .66, .12, .16, .14, .14, .3), P('box', 'cloth', 0, -.12, 0, .5, .28, .3)] },
      { name: 'head', at: [0, 1.62, .2], parts: [P('ball', 'skin', 0, .06, .02, .26, .3, .27), ...eyes(.09, .14, .06, .045), P('box', 'dark', 0, -.04, .13, .12, .03, .02)] },
      { name: 'armL', at: [-.32, 1.42, .1], parts: [P('box', 'rag', 0, -.25, .12, .13, .5, .13, -.9), P('box', 'skin', 0, -.38, .42, .1, .22, .1, -1.3)] },
      { name: 'armR', at: [.32, 1.42, .1], parts: [P('box', 'rag', 0, -.25, .12, .13, .5, .13, -.9), P('box', 'skin', 0, -.38, .42, .1, .22, .1, -1.3)] },
      { name: 'legL', at: [-.13, .82, 0], parts: [P('box', 'cloth', 0, -.4, 0, .17, .8, .17), P('box', 'dark', 0, -.8, .06, .17, .07, .26)] },
      { name: 'legR', at: [.13, .82, 0], parts: [P('box', 'cloth', 0, -.4, 0, .17, .8, .17), P('box', 'dark', 0, -.8, .06, .17, .07, .26)] }
    ],
    // Lykaner: breite Brust, Wolfskopf mit Schnauze und Ohren, Krallen, abgeknickte Beine
    lycan: [
      { name: 'body', at: [0, 1.05, 0], parts: [P('box', 'skin', 0, .32, .1, .66, .62, .44, .35), P('box', 'fur', 0, -.05, 0, .46, .36, .34), P('cone', 'fur', 0, .55, -.12, .5, .4, .3, -1.9)] },
      { name: 'head', at: [0, 1.72, .5], parts: [P('box', 'skin', 0, 0, 0, .32, .28, .3), P('box', 'skin', 0, -.04, .24, .18, .15, .26), P('cone', 'skin', -.11, .2, -.04, .08, .18, .06), P('cone', 'skin', .11, .2, -.04, .08, .18, .06), ...eyes(.05, .15, .08, .045), P('box', 'bone', 0, -.12, .3, .14, .04, .1)] },
      { name: 'armL', at: [-.42, 1.5, .25], parts: [P('box', 'skin', 0, -.32, .05, .16, .66, .16, -.4), P('cone', 'bone', 0, -.7, .25, .12, .16, .12, -2.4)] },
      { name: 'armR', at: [.42, 1.5, .25], parts: [P('box', 'skin', 0, -.32, .05, .16, .66, .16, -.4), P('cone', 'bone', 0, -.7, .25, .12, .16, .12, -2.4)] },
      { name: 'legL', at: [-.18, .92, 0], parts: [P('box', 'fur', 0, -.22, .08, .2, .48, .2, .35), P('box', 'skin', 0, -.62, -.04, .14, .46, .14, -.35), P('box', 'dark', 0, -.88, .08, .16, .06, .26)] },
      { name: 'legR', at: [.18, .92, 0], parts: [P('box', 'fur', 0, -.22, .08, .2, .48, .2, .35), P('box', 'skin', 0, -.62, -.04, .14, .46, .14, -.35), P('box', 'dark', 0, -.88, .08, .16, .06, .26)] }
    ],
    // Wolf: vierbeinig, langer Kopf, buschiger Schwanz
    wolf: [
      { name: 'body', at: [0, .95, 0], parts: [P('box', 'skin', 0, 0, .05, .48, .46, 1.15), P('box', 'fur', 0, .12, .45, .52, .5, .4), P('cone', 'fur', 0, .05, -.75, .2, .7, .2, -1.2)] },
      { name: 'head', at: [0, 1.15, .78], parts: [P('box', 'skin', 0, .05, .1, .3, .28, .3), P('box', 'skin', 0, -.02, .34, .17, .15, .3), P('cone', 'skin', -.1, .25, .02, .07, .16, .06), P('cone', 'skin', .1, .25, .02, .07, .16, .06), ...eyes(.1, .26, .08, .04)] },
      { name: 'legL', at: [-.18, .78, .4], parts: [P('box', 'skin', 0, -.38, 0, .12, .78, .12)] },
      { name: 'legR', at: [.18, .78, .4], parts: [P('box', 'skin', 0, -.38, 0, .12, .78, .12)] },
      { name: 'armL', at: [-.18, .78, -.4], parts: [P('box', 'skin', 0, -.38, 0, .13, .78, .13)] },
      { name: 'armR', at: [.18, .78, -.4], parts: [P('box', 'skin', 0, -.38, 0, .13, .78, .13)] }
    ],
    // Moroaică: schwebende Hexe, Kutte als offener Kegel, langes Haar, Krallenhände
    hag: [
      { name: 'body', at: [0, 1.1, 0], parts: [P('robe', 'skin', 0, -.15, 0, .95, 1.5, .8), P('box', 'skin', 0, .55, .08, .44, .45, .3, .35), P('cone', 'hair', 0, .65, -.12, .5, 1.1, .3, .25)] },
      { name: 'head', at: [0, 2.08, .2], parts: [P('ball', 'bone', 0, 0, .02, .26, .32, .26), ...eyes(.03, .12, .06, .05, 'eyeBlue'), P('cone', 'hair', 0, .12, -.05, .42, .5, .36, Math.PI)] },
      { name: 'armL', at: [-.3, 1.75, .15], parts: [P('box', 'skin', 0, -.3, .2, .1, .62, .1, -1.1), P('cone', 'bone', 0, -.45, .55, .09, .2, .09, -1.6)] },
      { name: 'armR', at: [.3, 1.75, .15], parts: [P('box', 'skin', 0, -.3, .2, .1, .62, .1, -1.1), P('cone', 'bone', 0, -.45, .55, .09, .2, .09, -1.6)] }
    ],
    // Säurespucker: gebückt, aufgeblähter grüner Kehlsack, dürre Arme
    spitter: [
      { name: 'body', at: [0, .95, 0], parts: [P('box', 'skin', 0, .3, .05, .46, .6, .32, .45), P('box', 'rag', 0, -.08, 0, .44, .3, .3)] },
      { name: 'head', at: [0, 1.5, .4], parts: [P('ball', 'skin', 0, .05, 0, .26, .26, .28), P('ball', 'acid', 0, -.16, .1, .3, .26, .28), ...eyes(.1, .12, .07, .045, 'eyeGreen')] },
      { name: 'armL', at: [-.3, 1.35, .2], parts: [P('box', 'skin', 0, -.35, .1, .09, .7, .09, -.5)] },
      { name: 'armR', at: [.3, 1.35, .2], parts: [P('box', 'skin', 0, -.35, .1, .09, .7, .09, -.5)] },
      { name: 'legL', at: [-.13, .82, 0], parts: [P('box', 'rag', 0, -.4, 0, .15, .8, .15), P('box', 'dark', 0, -.8, .06, .15, .07, .24)] },
      { name: 'legR', at: [.13, .82, 0], parts: [P('box', 'rag', 0, -.4, 0, .15, .8, .15), P('box', 'dark', 0, -.8, .06, .15, .07, .24)] }
    ],
    // Sprengling: riesiger Bauch mit glühenden Beulen, kleiner Kopf
    bloater: [
      { name: 'body', at: [0, 1.05, 0], parts: [P('ball', 'skin', 0, 0, .05, .95, 1.05, .9), P('ballLow', 'glow', .3, .2, .4, .2, .2, .2), P('ballLow', 'glow', -.28, -.1, .42, .24, .22, .2), P('ballLow', 'glow', .05, .38, .36, .16, .16, .16), P('ballLow', 'glow', -.15, .1, -.4, .2, .2, .2)] },
      { name: 'head', at: [0, 1.82, .18], parts: [P('ball', 'skin', 0, 0, 0, .3, .3, .3), ...eyes(.03, .13, .07, .05)] },
      { name: 'armL', at: [-.5, 1.4, .1], parts: [P('box', 'skin', 0, -.25, .05, .12, .5, .12, -.3)] },
      { name: 'armR', at: [.5, 1.4, .1], parts: [P('box', 'skin', 0, -.25, .05, .12, .5, .12, -.3)] },
      { name: 'legL', at: [-.22, .55, 0], parts: [P('box', 'skin', 0, -.27, 0, .2, .55, .2)] },
      { name: 'legR', at: [.22, .55, 0], parts: [P('box', 'skin', 0, -.27, 0, .2, .55, .2)] }
    ],
    // Schlächter: massig, blutige Schürze, Hackbeil in der rechten Hand
    brute: [
      { name: 'body', at: [0, 1.05, 0], parts: [P('box', 'skin', 0, .32, 0, .8, .7, .48, .12), P('box', 'apron', 0, .05, .25, .62, .85, .04), P('box', 'blood', .1, -.05, .27, .3, .3, .02), P('box', 'cloth', 0, -.12, 0, .62, .3, .42)] },
      { name: 'head', at: [0, 1.82, .14], parts: [P('box', 'skin', 0, .02, 0, .3, .32, .3), P('box', 'cloth', 0, .06, 0, .33, .2, .33), ...eyes(.0, .16, .07, .04)] },
      { name: 'armL', at: [-.52, 1.6, 0], parts: [P('box', 'skin', 0, -.38, .05, .22, .78, .22, -.2)] },
      { name: 'armR', at: [.52, 1.6, 0], parts: [P('box', 'skin', 0, -.38, .05, .22, .78, .22, -.2), P('box', 'wood', 0, -.78, .22, .06, .06, .4, 1.4), P('box', 'iron', 0, -.82, .48, .04, .32, .3, 1.4)] },
      { name: 'legL', at: [-.2, .9, 0], parts: [P('box', 'cloth', 0, -.44, 0, .26, .88, .26), P('box', 'dark', 0, -.88, .07, .26, .08, .34)] },
      { name: 'legR', at: [.2, .9, 0], parts: [P('box', 'cloth', 0, -.44, 0, .26, .88, .26), P('box', 'dark', 0, -.88, .07, .26, .08, .34)] }
    ],
    // Sensenschwinge: fliegender Kapuzenleib mit Knochenflügeln und Sense (Ursprung in der Körpermitte)
    reaper: [
      { name: 'body', at: [0, 0, 0], parts: [P('cone', 'skin', 0, -.25, -.1, .7, 1.4, .6, Math.PI), P('ball', 'dark', 0, .35, .45, .42, .46, .42), ...eyes(.38, .64, .09, .06), P('box', 'wood', .35, -.1, .5, .05, .05, 1.6, .3), P('cone', 'iron', .35, .3, 1.2, .08, .9, .25, 1.2, 0, 1.4)] },
      { name: 'wingL', at: [-.3, .2, 0], parts: [P('box', 'bone', -.9, 0, 0, 1.8, .05, .08), P('cone', 'skin', -.95, -.02, -.3, 1.7, .03, .7, 0, 0, Math.PI / 2)] },
      { name: 'wingR', at: [.3, .2, 0], parts: [P('box', 'bone', .9, 0, 0, 1.8, .05, .08), P('cone', 'skin', .95, -.02, -.3, 1.7, .03, .7, 0, 0, -Math.PI / 2)] }
    ],
    // Fledermaus (groß genug, um sie nachts zu sehen): pelziger Körper, Kopf mit spitzen Ohren und Schnauze, Hautflügel
    // mit gezackter Hinterkante und Armknochen, große rot glühende Augen (Ursprung in der Körpermitte).
    bat: [
      { name: 'body', at: [0, 0, 0], parts: [P('ball', 'skin', 0, 0, -.02, .2, .17, .32), P('ball', 'skin', 0, .05, .2, .15, .14, .15), P('cone', 'skin', 0, .03, .29, .06, .08, .06, Math.PI / 2),
        P('cone', 'skin', -.05, .16, .17, .05, .12, .04, -.2), P('cone', 'skin', .05, .16, .17, .05, .12, .04, -.2), ...eyes(.08, .27, .04, .032), P('cone', 'skin', 0, -.02, -.22, .05, .14, .05, -Math.PI / 2)] },
      { name: 'wingL', at: [-.08, .02, 0], parts: [P('wing', 'skin', 0, 0, 0, -1.6, 1, 1.6), P('box', 'dark', -.4, .01, .05, .8, .015, .015)] },
      { name: 'wingR', at: [.08, .02, 0], parts: [P('wing', 'skin', 0, 0, 0, 1.6, 1, 1.6), P('box', 'dark', .4, .01, .05, .8, .015, .015)] }
    ]
  };
  PLANS.samca = PLANS.lycan; // Alpha-Lykaner: Gestalt des Lykaners, größer (spec.scale) und mit eigener Fellfarbe
  const SKIN = { villager: '#7d6a62', lycan: '#5c5243', samca: '#6e3c22', wolf: '#59616c', hag: '#3f3048', spitter: '#5e7445', bloater: '#9a6f58', brute: '#7c6a62', reaper: '#2b2328', bat: '#4a3a36' };

  // Geometrie eines Gelenks je Material zusammenfassen (einmal je Art).
  function mergedJoint(THREE, joint) {
    const g = shapes(THREE), byMat = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const [form, mat, x, y, z, sx, sy, sz, rx, ry, rz] of joint.parts) {
      const geo = g[form].toNonIndexed();
      m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
      geo.applyMatrix4(m4);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(geo);
    }
    return [...byMat].map(([mat, list]) => {
      const count = list.reduce((n, q) => n + q.attributes.position.count, 0), out = new THREE.BufferGeometry();
      for (const name of ['position', 'normal']) {
        const values = new Float32Array(count * 3); let at = 0;
        for (const q of list) { values.set(q.attributes[name].array, at); at += q.attributes[name].array.length; }
        out.setAttribute(name, new THREE.BufferAttribute(values, 3));
      }
      list.forEach(q => q.dispose()); out.computeBoundingSphere();
      return { mat, geometry: out };
    });
  }
  function plan(THREE, kind) {
    if (!cache[kind]) cache[kind] = (PLANS[kind] || PLANS.villager).map(joint => ({ name: joint.name, at: joint.at, meshes: mergedJoint(THREE, joint) }));
    return cache[kind];
  }
  // skin: eigenes Material dieses Gegners (Farbe wird hier gesetzt).
  function build(THREE, kind, skin) {
    const mats = materials(THREE), model = new THREE.Group(), parts = {};
    skin.color.set(SKIN[kind] || SKIN.villager).convertSRGBToLinear();
    // Fledermäuse leicht glimmend und beidseitig sichtbar (dünne Flügelhaut), damit man sie im Nachtnebel erkennt.
    if (kind === 'bat') { skin.side = THREE.DoubleSide; skin.emissive.set('#3a1612'); }
    for (const joint of plan(THREE, kind)) {
      const pivot = new THREE.Group(); pivot.position.fromArray(joint.at); pivot.name = joint.name;
      for (const { mat, geometry } of joint.meshes) {
        const mesh = new THREE.Mesh(geometry, mat === 'skin' ? skin : mats[mat]);
        mesh.castShadow = !(mat.startsWith('eye')); pivot.add(mesh);
      }
      model.add(pivot); parts[joint.name] = pivot;
    }
    if (kind === 'samca') { // Mähne
      const mane = new THREE.Mesh(shapes(THREE).cone, mats.fur); mane.position.set(0, .62, .05); mane.scale.set(.75, .5, .55); mane.rotation.x = -2.4; parts.body.add(mane);
    }
    return { model, parts };
  }
  // motion: { speed (m/s), state ('walk', 'windup', 'pounce', 'emerge', ...) }
  function animate(group, dt, motion, clock) {
    const d = group.userData, p = d.parts, kind = d.kind;
    if (!p || !p.body) return;
    const rig = d.anim || (d.anim = { phase: (group.id || 0) * 1.37, attack: 0 });
    const speed = Math.min(motion.speed || 0, 9), run = Math.min(1, speed / 3);
    rig.phase += speed * dt * (kind === 'wolf' ? 2.6 : 2.2);
    const target = motion.state === 'windup' || motion.state === 'pounce' ? 1 : 0;
    rig.attack += (target - rig.attack) * Math.min(1, dt * 9);
    const s = Math.sin(rig.phase), k = rig.attack, idle = Math.sin(clock * 1.7 + rig.phase);
    if (p.wingL) {
      const flap = Math.sin(clock * (kind === 'bat' ? 22 : 7) + (group.id || 0)) * (motion.state === 'dive' ? .2 : .6);
      p.wingL.rotation.z = flap; p.wingR.rotation.z = -flap; p.body.rotation.x = motion.state === 'dive' ? .4 : 0;
      return;
    }
    if (p.legL) { p.legL.rotation.x = s * .7 * run; p.legR.rotation.x = -s * .7 * run; }
    if (kind === 'wolf') {
      if (p.armL) { p.armL.rotation.x = -s * .7 * run; p.armR.rotation.x = s * .7 * run; }
      p.body.rotation.x = -k * .3; p.head.rotation.x = -.1 + idle * .05 - k * .2;
      p.body.position.y = .95 + Math.abs(s) * .06 * run; return;
    }
    if (p.armL) {
      p.armL.rotation.x = -s * .5 * run - k * 1.6 + idle * .05;
      p.armR.rotation.x = s * .5 * run - k * 1.6 - idle * .05;
    }
    p.head.rotation.x = idle * .08 - k * .25; p.head.rotation.y = Math.sin(clock * .7 + rig.phase) * .2;
    p.body.rotation.x = run * .12 + k * .25;
    if (kind === 'hag') p.body.position.y = 1.1 + Math.sin(clock * 2 + rig.phase) * .08;
    if (kind === 'bloater') p.body.scale.setScalar(1 + Math.sin(clock * 6 + rig.phase) * .03);
  }
  // Händler und Schmied: Figur mit Stand (nur Darstellung). role 'merchant' oder 'smith'. Blick nach +z.
  const PEOPLE = {
    merchant: [
      { name: 'body', at: [0, 0, 0], parts: [P('robe', 'coat', 0, .62, 0, .62, 1.25, .5), P('box', 'coat', 0, 1.3, 0, .46, .4, .3), P('box', 'belt', 0, 1.02, 0, .5, .07, .34),
        P('box', 'pack', 0, 1.25, -.26, .4, .5, .22), P('ball', 'face', 0, 1.68, .02, .24, .27, .24), P('cone', 'beard', 0, 1.5, .1, .16, .26, .12, Math.PI),
        P('cyl', 'hat', 0, 1.86, 0, .42, .05, .42), P('cone', 'hat', 0, 1.98, 0, .26, .26, .26), P('box', 'coat', -.3, 1.1, .12, .11, .45, .11, -.5), P('box', 'coat', .3, 1.1, .12, .11, .45, .11, -.5),
        P('box', 'iron', .32, .85, .3, .12, .16, .12), P('box', 'lamp', .32, .85, .3, .08, .1, .08)] },
      // Stand: Tisch mit Waren, zwei Pfosten, Stoffdach
      { name: 'stall', at: [0, 0, 1.1], parts: [P('box', 'wood', 0, .85, 0, 2.2, .08, .8), P('box', 'wood', -1, .42, 0, .08, .84, .7), P('box', 'wood', 1, .42, 0, .08, .84, .7),
        P('box', 'wood', -1.05, 1.25, -.35, .08, 2.5, .08), P('box', 'wood', 1.05, 1.25, -.35, .08, 2.5, .08), P('box', 'awning', 0, 2.42, .05, 2.4, .05, 1.1, .35),
        P('box', 'pack', -.6, 1.02, 0, .3, .26, .3), P('box', 'crate', -.15, .99, .05, .35, .2, .3), P('cyl', 'iron', .4, 1.01, 0, .14, .24, .14), P('ball', 'glow', .75, .97, .1, .14, .14, .14),
        P('box', 'crate', -.5, .2, .55, .5, .4, .4), P('box', 'crate', .45, .18, .6, .4, .36, .36)] }
    ],
    smith: [
      { name: 'body', at: [0, 0, 0], parts: [P('box', 'pants', -.13, .42, 0, .17, .84, .18), P('box', 'pants', .13, .42, 0, .17, .84, .18), P('box', 'shirt', 0, 1.2, 0, .56, .62, .32),
        P('box', 'apronS', 0, .95, .17, .46, .8, .03), P('ball', 'face', 0, 1.68, .02, .24, .27, .24), P('box', 'beard', 0, 1.55, .12, .18, .14, .06), P('box', 'hair', 0, 1.8, -.02, .25, .07, .25),
        P('box', 'face', -.36, 1.15, .05, .14, .5, .14, -.2), P('box', 'face', .36, 1.15, .1, .14, .5, .14, -.8), P('box', 'iron', .36, 1.32, .42, .08, .3, .08, -.8), P('box', 'iron', .36, 1.5, .55, .2, .1, .1, -.8)] },
      // Amboss, Esse mit Glut, Werkzeugständer
      { name: 'stall', at: [0, 0, 1.1], parts: [P('box', 'wood', 0, .3, 0, .5, .6, .5), P('box', 'iron', 0, .7, 0, .7, .2, .3), P('box', 'iron', .4, .72, 0, .2, .12, .16),
        P('box', 'stone', 1.4, .5, -.2, 1, 1, .9), P('box', 'glow', 1.4, 1.02, -.2, .7, .06, .6), P('box', 'stone', 1.4, 1.9, -.45, .5, 1.8, .4),
        P('box', 'wood', -1.2, .9, -.3, .08, 1.8, .08), P('box', 'wood', -1.2, 1.7, -.3, .8, .06, .06), P('box', 'iron', -1.45, 1.45, -.3, .04, .45, .04), P('box', 'iron', -1, 1.45, -.3, .04, .45, .04)] }
    ]
  };
  let PM = null;
  function person(THREE, role) {
    if (!PM) {
      const c = (hex, extra = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), ...extra });
      PM = { ...materials(THREE), coat: c('#2f5f58'), belt: c('#3a2a1c'), pack: c('#6a5236'), face: c('#c79a7c'), beard: c('#8e8a84'), hat: c('#3a2f28'),
        lamp: new THREE.MeshBasicMaterial({ color: 0xffd08a }), awning: c('#8a3a2e'), crate: c('#7a5a38'), pants: c('#3a3530'), shirt: c('#6a5a4a'),
        apronS: c('#4a3a2c'), hair: c('#2a2522'), stone: c('#5a5552') };
    }
    const key = 'person-' + role;
    if (!cache[key]) cache[key] = (PEOPLE[role] || PEOPLE.merchant).map(joint => ({ name: joint.name, at: joint.at, meshes: mergedJoint(THREE, joint) }));
    const g = new THREE.Group();
    for (const joint of cache[key]) {
      const pivot = new THREE.Group(); pivot.position.fromArray(joint.at);
      for (const { mat, geometry } of joint.meshes) { const m = new THREE.Mesh(geometry, PM[mat]); m.castShadow = m.receiveShadow = true; pivot.add(m); }
      g.add(pivot);
    }
    return g;
  }
  return { build, animate, person, PLANS, SKIN };
})();
