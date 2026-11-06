'use strict';

// Einfache Wachtürme nach dem Vorbild des Altay-Originals: runder Steinturm, außen umlaufende Wendeltreppe mit
// Brüstung, oben ein Umgang, Kegeldach mit Schneehaube, warm erleuchtete Fenster, Laternen über das Lampenfeld.
// Begehbar: floor(x,z,feet) liefert Stufen und Umgang, blocked(x,z,feet) Turmschaft und Brüstung.
globalThis.NachtjagdWatchtowers = {
  create({ THREE, scene, sites, height, lamps }) {
    const R = 3.1, H = 13, TURNS = 3, PER_TURN = 14, R_IN = R + .35, R_OUT = R + 2.3;
    const c = hex => new THREE.Color(hex).convertSRGBToLinear();
    const mats = {
      stone: new THREE.MeshLambertMaterial({ name: 'castle', color: c('#8c8e92') }),
      ring: new THREE.MeshLambertMaterial({ name: 'castle', color: c('#76787c') }),
      roof: new THREE.MeshLambertMaterial({ name: 'roof', color: c('#2b2e33') }),
      snow: new THREE.MeshLambertMaterial({ name: 'path-bank', color: c('#e4eaee') }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffc070 })
    };
    const G = { cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 14), box: new THREE.BoxGeometry(1, 1, 1) };
    const towers = [];
    const STEPS = TURNS * PER_TURN, RISE = (H - .3) / STEPS, STEP_ANGLE = Math.PI * 2 / PER_TURN;
    for (const [x, z, turn = 0] of sites) {
      const y0 = height(x, z), g = new THREE.Group(); g.position.set(x, y0, z); scene.add(g);
      const add = (geo, mat, px, py, pz, sx, sy, sz, ry = 0) => { const m = new THREE.Mesh(G[geo], mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
      add('cyl', mats.ring, 0, .1, 0, R + .55, 1.6, R + .55);                 // Sockel bis unter den Boden
      add('cyl', mats.stone, 0, (H + 2.6) / 2, 0, R, H + 2.6, R);            // Schaft
      add('cyl', mats.ring, 0, H + 2.3, 0, R * 1.2, .6, R * 1.2);            // Gesims
      add('cone', mats.roof, 0, H + 2.9 + 3.6, 0, R * 1.5, 7.2, R * 1.5);     // Kegeldach
      add('cone', mats.snow, 0, H + 2.9 + 5.4, 0, R * .95, 3.6, R * .95);     // Schneehaube
      for (const [a, h] of [[.4, 4.5], [2.2, 7], [4.2, 9.5], [5.4, 11.5]]) add('box', mats.glow, Math.sin(a) * (R + .02), h, Math.cos(a) * (R + .02), .7, 1.4, .06, a);
      // Stufen und Brüstung der Außentreppe (Instanzen)
      const steps = new THREE.InstancedMesh(G.box, mats.ring, STEPS + PER_TURN), rail = new THREE.InstancedMesh(G.box, mats.stone, STEPS + PER_TURN);
      steps.castShadow = steps.receiveShadow = rail.castShadow = true;
      const d = new THREE.Object3D(), rc = (R_IN + R_OUT) / 2;
      for (let k = 0; k < STEPS + PER_TURN; k++) {
        const a = turn + (k + .5) * STEP_ANGLE, top = k < STEPS ? (k + 1) * RISE : H - .3;
        d.position.set(Math.cos(a) * rc, top - .15, Math.sin(a) * rc); d.rotation.set(0, -a, 0); d.scale.set(R_OUT - R_IN, .3, rc * STEP_ANGLE + .05); d.updateMatrix(); steps.setMatrixAt(k, d.matrix);
        d.position.set(Math.cos(a) * (R_OUT - .1), top + .45, Math.sin(a) * (R_OUT - .1)); d.scale.set(.18, .9, rc * STEP_ANGLE * 1.25); d.updateMatrix(); rail.setMatrixAt(k, d.matrix);
      }
      g.add(steps, rail);
      lamps?.add({ x: x + Math.cos(turn) * rc, y: y0 + H + 2.2, z: z + Math.sin(turn) * rc, r: 15, c: [1, .66, .34], k: .8, halo: 3.4, a: .4, kind: 'wachturm' });
      for (let i = 0; i < 3; i++) { const a = turn + (i + .5) * Math.PI * 2 / 3; lamps?.add({ x: x + Math.cos(a) * rc, y: y0 + RISE * PER_TURN * (i + .7) + 2.2, z: z + Math.sin(a) * rc, r: 10, c: [1, .62, .3], k: .65, halo: 2.4, a: .3, flick: i === 1, kind: 'wachturm' }); }
      towers.push({ x, z, y0, turn });
    }
    function local(t, x, z) {
      const dx = x - t.x, dz = z - t.z, r = Math.hypot(dx, dz);
      const a = (((Math.atan2(dz, dx) - t.turn) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return { r, a };
    }
    // Stufe unter den Füßen (höchstens 45 cm Anstieg) oder der Umgang oben.
    function floor(x, z, feet) {
      for (const t of towers) {
        const { r, a } = local(t, x, z);
        if (r < R_IN - .05 || r > R_OUT + .05) continue;
        const top = t.y0 + H - .3;
        if (Number.isFinite(feet) && feet > top - .6) return top;
        const first = Math.floor(a / STEP_ANGLE); let best = null;
        for (let k = first; k < STEPS; k += PER_TURN) { const h = t.y0 + (k + 1) * RISE; if (!Number.isFinite(feet)) { best = h; break; } if (h <= feet + .45) best = h; }
        if (best !== null) return best;
      }
      return null;
    }
    function blocked(x, z, feet) {
      for (const t of towers) {
        const { r, a } = local(t, x, z);
        if (r > R_OUT + 1) continue;
        if (r < R + .25 && (!Number.isFinite(feet) || feet < t.y0 + H + 2)) return true;   // Turmschaft
        // Außenbrüstung: wer auf der Treppe oder oben steht, fällt nicht hinunter; der Treppenfuß bleibt offen.
        const onStairs = Number.isFinite(feet) && feet > t.y0 + 1.2;
        if (onStairs && r > R_OUT - .2 && r < R_OUT + .5) return true;
      }
      return false;
    }
    return { floor, blocked, towers };
  }
};
