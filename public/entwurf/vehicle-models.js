'use strict';

// Platzhaltermodelle für Geländewagen, Lore, Gondel und Boot samt Schienen und Seilbahn.
// Austauschpunkt für die späteren Detailmodelle: `NachtjagdVehicleModels.builders[kind](THREE)` liefert eine Gruppe
// (Ursprung am Boden unter der Mitte, Blick nach +z, +x zeigt nach links) und trägt in `userData`:
//   wheels  [{ spin, steer|null, radius }]  drehende Räder (spin: Gruppe, die um x rollt; steer: Lenkgruppe um y)
//   oars    [Gruppe, Gruppe]               Ruder (nur Boot)
//   light   THREE.SpotLight                 Scheinwerfer (nur Geländewagen)
// `create` verwaltet die Meshes je Fahrzeug-Id, `buildStatic` baut Schienen, Stationen, Seile und Stützen.
globalThis.NachtjagdVehicleModels = (() => {
  const lambert = (THREE, color, emissive = 0, extra = {}) => new THREE.MeshLambertMaterial({ color, emissive, ...extra });

  function box(THREE, parent, material, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Rad: Lenkgruppe (um y) mit Rollgruppe (um x) und Reifen samt Nabe.
  function wheel(THREE, group, wheels, x, y, z, radius, width, front, tire, hub) {
    const steer = new THREE.Group(), spin = new THREE.Group();
    steer.position.set(x, y, z); steer.add(spin); group.add(steer);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), tire);
    tyre.rotation.z = Math.PI / 2; spin.add(tyre);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, width + 0.02, 8), hub);
    cap.rotation.z = Math.PI / 2; spin.add(cap);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, radius * 0.25, radius * 0.25), hub); // Speiche: Drehung sichtbar
    spin.add(bar);
    wheels.push({ spin, steer: front ? steer : null, radius });
  }

  const builders = {
    jeep(THREE) {
      const g = new THREE.Group(), wheels = [];
      const body = lambert(THREE, 0x536252), iron = lambert(THREE, 0x29323a), seat = lambert(THREE, 0x5b4430), tire = lambert(THREE, 0x101212), hub = lambert(THREE, 0x8a9096);
      const lamp = new THREE.MeshBasicMaterial({ color: 0xffe5a0 });
      box(THREE, g, iron, 1.6, 0.18, 3.9, 0, 0.5, 0);                       // Rahmen
      box(THREE, g, body, 1.78, 0.42, 3.3, 0, 0.8, -0.1);                  // Karosserie
      box(THREE, g, body, 1.7, 0.4, 1.25, 0, 1.0, 1.3);                    // Motorhaube
      box(THREE, g, iron, 1.9, 0.14, 0.2, 0, 0.62, 2.0);                   // Stoßstange vorn
      box(THREE, g, iron, 1.9, 0.14, 0.2, 0, 0.62, -2.0);                  // Stoßstange hinten
      for (const s of [-1, 1]) box(THREE, g, iron, 0.07, 0.62, 0.07, s * 0.82, 1.38, 0.7); // Scheibenrahmen
      box(THREE, g, iron, 1.7, 0.07, 0.07, 0, 1.7, 0.7);
      for (const s of [-1, 1]) box(THREE, g, iron, 0.07, 0.9, 0.07, s * 0.82, 1.55, -1.5); // Überrollbügel
      box(THREE, g, iron, 1.7, 0.07, 0.07, 0, 2.0, -1.5);
      for (const [x, z] of [[-0.43, -0.1], [0.43, -0.1], [-0.43, -1.15], [0.43, -1.15]]) {
        box(THREE, g, seat, 0.5, 0.14, 0.5, x, 0.98, z);
        box(THREE, g, seat, 0.5, 0.5, 0.1, x, 1.25, z - 0.25);
      }
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lamp); l.position.set(s * 0.55, 1.05, 1.95); g.add(l); }
      for (const [x, z, front] of [[-0.96, 1.25, true], [0.96, 1.25, true], [-0.96, -1.25, false], [0.96, -1.25, false]]) wheel(THREE, g, wheels, x, 0.42, z, 0.42, 0.3, front, tire, hub);
      const light = new THREE.SpotLight(0xfff0cf, 0, 45, 0.55, 0.5, 1);
      light.position.set(0, 1.1, 1.9); light.target.position.set(0, 0.6, 12); g.add(light, light.target);
      g.userData = { wheels, light };
      return g;
    },
    cart(THREE) {
      const g = new THREE.Group(), wheels = [];
      const iron = lambert(THREE, 0x29323a), wood = lambert(THREE, 0x66503b), ore = lambert(THREE, 0x7a6a58), tire = lambert(THREE, 0x1c1f22), hub = lambert(THREE, 0x8a9096);
      box(THREE, g, iron, 1.35, 0.15, 2.2, 0, 0.36, 0);
      box(THREE, g, wood, 1.36, 0.12, 2.05, 0, 0.52, 0);
      for (const s of [-1, 1]) box(THREE, g, wood, 0.12, 0.7, 2.14, s * 0.7, 0.89, 0);
      for (const s of [-1, 1]) box(THREE, g, wood, 1.42, 0.7, 0.12, 0, 0.89, s * 1.02);
      for (let i = 0; i < 5; i++) box(THREE, g, ore, 0.4 + (i % 2) * 0.15, 0.3, 0.4, ((i * 37) % 7 - 3) * 0.12, 1.28, ((i * 53) % 9 - 4) * 0.18, 0, i, 0);
      for (const s of [-1, 1]) for (const z of [-0.72, 0.72]) wheel(THREE, g, wheels, s * 0.62, 0.25, z, 0.26, 0.14, false, tire, hub);
      g.userData = { wheels };
      return g;
    },
    gondola(THREE) {
      const g = new THREE.Group();
      const iron = lambert(THREE, 0x29323a), red = lambert(THREE, 0x853e2d), ivory = lambert(THREE, 0xc9c2aa), snow = lambert(THREE, 0xd3e2ef), seat = lambert(THREE, 0x5b4430);
      const glass = lambert(THREE, 0x9abac8, 0, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
      box(THREE, g, iron, 3, 0.18, 2.8, 0, 0.12, 0);
      box(THREE, g, seat, 2.8, 0.09, 2.6, 0, 0.25, 0);
      for (const s of [-1, 1]) {
        box(THREE, g, red, 3, 0.64, 0.1, 0, 0.6, s * 1.35);                 // Brüstung längs
        box(THREE, g, glass, 2.75, 1.5, 0.03, 0, 1.69, s * 1.36);
        for (const x of [-1.4, 0, 1.4]) box(THREE, g, iron, 0.085, 2.1, 0.085, x, 1.36, s * 1.36);
        box(THREE, g, red, 0.1, 0.65, 0.7, s * 1.45, 0.6, -0.98);          // Seitenbrüstung, Einstieg bleibt frei
        box(THREE, g, red, 0.1, 0.65, 0.7, s * 1.45, 0.6, 0.98);
        box(THREE, g, glass, 0.06, 1.5, 0.7, s * 1.46, 1.68, -0.98);
        box(THREE, g, glass, 0.06, 1.5, 0.7, s * 1.46, 1.68, 0.98);
      }
      box(THREE, g, ivory, 3.15, 0.22, 2.95, 0, 2.55, 0);
      box(THREE, g, snow, 3.05, 0.05, 2.85, 0, 2.69, 0);
      box(THREE, g, iron, 0.16, 2.5, 0.16, 0, 3.95, 0);                    // Gehänge
      box(THREE, g, iron, 0.55, 0.16, 0.7, 0, 5.25, 0);                    // Laufwagen am Seil
      for (const [x, z] of [[-0.68, 0.55], [0.68, 0.55], [-0.68, -0.55], [0.68, -0.55]]) { box(THREE, g, seat, 0.6, 0.13, 0.54, x, 0.54, z); box(THREE, g, seat, 0.6, 0.45, 0.1, x, 0.82, z - 0.26); }
      g.userData = { wheels: [] };
      return g;
    },
    boat(THREE) {
      const g = new THREE.Group(), oars = [];
      const wood = lambert(THREE, 0x5c4026), wood2 = lambert(THREE, 0x80603b), dark = lambert(THREE, 0x261a10), lamp = new THREE.MeshBasicMaterial({ color: 0xffd68a });
      box(THREE, g, dark, 1.2, 0.12, 3.2, 0, 0.12, 0);                      // Boden
      for (const s of [-1, 1]) {
        box(THREE, g, wood, 0.1, 0.55, 3.0, s * 0.62, 0.38, -0.1);          // Bordwand
        box(THREE, g, wood, 0.1, 0.55, 1.1, s * 0.4, 0.38, 1.85, 0, s * 0.55, 0); // Bug
      }
      box(THREE, g, wood, 1.15, 0.5, 0.1, 0, 0.36, -1.62);                  // Heck
      box(THREE, g, wood2, 1.1, 0.07, 0.3, 0, 0.55, -0.1);                  // Ruderbank
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lamp); l.position.set(0, 0.95, 2.1); g.add(l);
      box(THREE, g, dark, 0.05, 0.6, 0.05, 0, 0.7, 2.1);
      for (const s of [-1, 1]) {
        const o = new THREE.Group(); o.position.set(s * 0.7, 0.62, 0.1);
        box(THREE, o, wood2, 0.06, 0.04, 2.2, s * 0.9, 0, 0);
        box(THREE, o, wood2, 0.05, 0.03, 0.4, s * 1.7, 0, 0.7, 0, 0, 0);
        g.add(o); oars.push(o);
      }
      g.userData = { wheels: [], oars };
      return g;
    }
  };

  NachtjagdImportedModels.installJeep(builders);

  // ------------------------------------------------------------------ Schienen, Seilbahn
  function buildStatic(THREE, { world, layout }) {
    const group = new THREE.Group();
    const steel = lambert(THREE, 0x6e7882), wood = lambert(THREE, 0x6b4d33), iron = lambert(THREE, 0x2b333a), roofMat = lambert(THREE, 0x5b4a3a), plank = lambert(THREE, 0x8a6b45);
    const dummy = new THREE.Object3D();
    const rails = layout.rails;
    if (rails && rails.links.length) {
      const sleepers = [], pieces = [];
      for (const l of rails.links) {
        const a = rails.nodes[l.a], b = rails.nodes[l.b], count = Math.max(1, Math.round(l.length / 1.9));
        for (let i = 0; i <= count; i++) {
          const t = i / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = world.floor(x, z) + 0.1;
          sleepers.push([x, y, z, l.yaw]);
          for (const s of [-1, 1]) pieces.push([x - Math.cos(l.yaw) * s * 0.55, y + 0.09, z + Math.sin(l.yaw) * s * 0.55, l.yaw, l.length / count + 0.15]);
        }
      }
      const sleeperMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, 0.22), wood, sleepers.length);
      sleepers.forEach(([x, y, z, yaw], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); sleeperMesh.setMatrixAt(i, dummy.matrix); });
      const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.1, 1), steel, pieces.length);
      pieces.forEach(([x, y, z, yaw, len], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, len); dummy.updateMatrix(); railMesh.setMatrixAt(i, dummy.matrix); });
      group.add(sleeperMesh, railMesh);
      // Prellböcke an den freien Streckenenden
      const degree = new Map();
      for (const l of rails.links) { degree.set(l.a, (degree.get(l.a) || 0) + 1); degree.set(l.b, (degree.get(l.b) || 0) + 1); }
      for (const [id, n] of degree) if (n === 1) {
        const node = rails.nodes[id], y = world.floor(node.x, node.z) + 0.1;
        box(THREE, group, wood, 1.6, 0.5, 0.3, node.x, y + 0.3, node.z);
      }
    }
    const gondola = layout.gondola;
    if (gondola) {
      const { stations, path, yaw } = gondola, cableY = 5.3, side = [Math.cos(yaw), -Math.sin(yaw)];
      const lane = GONDOLA_LANE;
      const cableCount = (path.length - 1) * 2, cables = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1), iron, cableCount);
      let n = 0;
      for (const l of [-1, 1]) for (let k = 0; k < path.length - 1; k++) {
        const a = path[k], b = path[k + 1];
        const ax = a.x - side[0] * l * lane, az = a.z - side[1] * l * lane, bx = b.x - side[0] * l * lane, bz = b.z - side[1] * l * lane;
        dummy.position.set((ax + bx) / 2, (a.y + b.y) / 2 + cableY, (az + bz) / 2);
        dummy.lookAt(bx, b.y + cableY, bz); dummy.scale.set(1, 1, Math.hypot(bx - ax, b.y - a.y, bz - az) + 0.05);
        dummy.updateMatrix(); cables.setMatrixAt(n++, dummy.matrix);
      }
      group.add(cables);
      // Stützen am Hang
      for (const k of [20, 40, 60]) {
        const p = path[k], base = world.floor(p.x, p.z), top = p.y + cableY, h = top - base;
        for (const s of [-1, 1]) {
          const x = p.x - side[0] * s * 5, z = p.z - side[1] * s * 5;
          box(THREE, group, iron, 0.4, h, 0.4, x, base + h / 2, z);
        }
        const beam = box(THREE, group, iron, 11.2, 0.3, 0.5, p.x, top, p.z); beam.rotation.y = yaw + Math.PI / 2;
      }
      // Stationen: offener Holzrahmen mit Dach (Platzhalter), keine Kollision
      for (const s of stations) {
        const st = new THREE.Group(); st.position.set(s.x, s.y, s.z); st.rotation.y = yaw; group.add(st);
        box(THREE, st, plank, 9, 0.12, 6.5, 0, 0.06, 0);
        for (const x of [-4.2, 4.2]) for (const z of [-3, 3]) box(THREE, st, wood, 0.35, 5.6, 0.35, x, 2.8, z);
        box(THREE, st, roofMat, 10, 0.3, 7.4, 0, 5.75, 0);
        const sign = box(THREE, st, lambert(THREE, 0xe8dcc0, 0x201c14), 3.2, 0.6, 0.1, 0, 4.6, 3.2); sign.name = s.name || 'Station';
      }
    }
    return group;
  }
  const GONDOLA_LANE = 2.15;

  // ------------------------------------------------------------------ Verwaltung der Meshes
  function create({ THREE, scene }) {
    const root = new THREE.Group(); root.visible = false; scene.add(root);
    const meshes = new Map(); let statics = null;
    function setStatic(object) {
      if (statics) { root.remove(statics); }
      statics = object; if (object) root.add(object);
    }
    function clear() { for (const m of meshes.values()) root.remove(m); meshes.clear(); }
    function mesh(v) {
      let g = meshes.get(v.id);
      if (!g) { g = builders[v.kind](THREE); g.rotation.order = 'YXZ'; root.add(g); meshes.set(v.id, g); }
      return g;
    }
    function update(vehicles, dt, clock) {
      for (const v of vehicles) {
        const g = mesh(v), d = g.userData;
        let y = v.y;
        if (v.kind === 'boat') y += 0.02 + Math.sin(clock * 1.4 + v.x * 0.3) * 0.035;
        g.position.set(v.x, y, v.z);
        const sway = v.kind === 'gondola' ? Math.sin(clock * 0.8 + v.lane * 2) * 0.02 : v.kind === 'boat' ? Math.sin(clock * 0.9 + v.x) * 0.03 : 0;
        g.rotation.set(v.pitch || 0, v.yaw, (v.roll || 0) + sway, 'YXZ');
        for (const w of d.wheels) {
          w.spin.rotation.x += v.sp * dt / w.radius;
          if (w.steer) w.steer.rotation.y = v.steer || 0;
        }
        if (d.light) { d.light.intensity = v.seats[0] !== null ? 3.2 : 0; }
        if (d.oars && d.oars.length) d.oars.forEach((o, i) => { const s = i ? 1 : -1; o.rotation.set(0, s * (0.55 + Math.sin((v.ph || 0) + i * 0.4) * 0.35), s * (0.1 + Math.max(0, Math.cos((v.ph || 0) + i * 0.4)) * 0.25)); });
      }
    }
    return { root, update, clear, setStatic, setVisible(v) { root.visible = v; } };
  }

  return { builders, buildStatic, create };
})();
