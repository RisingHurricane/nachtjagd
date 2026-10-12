'use strict';

// Burg im Spiel: lädt das Modell aus public/models/ (ES-Module, per dynamischem import), setzt es an den Felssporn,
// fasst die vielen Einzelteile je Material zu wenigen Netzen zusammen, schaltet das Innere erst in der Nähe ein,
// verteilt wenige Innenlichter auf die nächsten Räume und liefert die Begehbarkeit aus castle-walk.js.
// Das Modell hat keine Abhängigkeit zu Three.js-Versionen: THREE wird übergeben (hier r128).
(function (root) {
  const SCRIPT = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
  const modelBase = () => {
    const path = SCRIPT ? new URL(SCRIPT).pathname : '';
    return new URL(/\/entwurf\/[^/]*$/.test(path) ? '../models/' : './models/', SCRIPT || location.href).href;
  };

  // Alle festen Netze mit gleichem Material zu einem Netz vereinen (Welt = Gruppenkoordinaten, Gruppe unbewegt).
  // Ausgenommen: Instanznetze (Fenster, Bücher), Netze mit Vertexfarben (Innenhaut) und per `keep` benannte Netze.
  function mergeStatic(THREE, group, keep = () => false) {
    group.updateMatrixWorld(true);
    const buckets = new Map(), remove = [];
    group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || keep(o)) return;
      if (o.geometry.attributes.color) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      const key = o.material.uuid + '|' + (o.renderOrder || 0);
      if (!buckets.has(key)) buckets.set(key, { material: o.material, renderOrder: o.renderOrder || 0, list: [] });
      buckets.get(key).list.push(g);
      remove.push(o);
    });
    for (const o of remove) { o.parent.remove(o); o.geometry.dispose(); }
    let triangles = 0;
    for (const { material, renderOrder, list } of buckets.values()) {
      const count = list.reduce((n, g) => n + g.attributes.position.count, 0);
      const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
      let at = 0;
      for (const g of list) { position.set(g.attributes.position.array, at * 3); normal.set(g.attributes.normal.array, at * 3); at += g.attributes.position.count; g.dispose(); }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material); mesh.renderOrder = renderOrder; mesh.name = 'merged';
      group.add(mesh); triangles += count / 3;
    }
    return { meshes: buckets.size, triangles, removed: remove.length };
  }

  // Burg- und Turmhüllen haben eine warm beleuchtete Innenhaut (Fensterglühen von außen). Wo ein eigener Innenraum
  // existiert, wird sie ausgeblendet, sobald der Spieler nahe ist.
  const GLOW_HIDDEN = [
    { x: -4, z: -6, h: 13 }, { x: -3.5, z: 2.6, h: 34 }, { x: -3.5, z: 2.6, h: 14 }, // Palas, Hauptturm
    { x: 9, z: -12, h: 22 }, { x: 18.5, z: 1.5, h: 10 }, { x: -17.5, z: 10, h: 10 }, { x: -3, z: -18, h: 9 }, { x: -8.4, z: -13.6, h: 8 } // Bergfried, Kemenate, Kapelle, Rückflügel, Verbindung
  ];

  function create({ THREE, scene, origin, rot, nearRadius = 46, lightCount = 4 }) {
    const site = { ready: null, walk: null, group: null, interior: null, lamps: [], failed: null, stats: null, interiorVisible: false, glow: [] };
    const pool = [];
    site.ready = (async () => {
      const base = modelBase();
      const [{ buildCastle }, { buildCastleInterior }] = await Promise.all([import(base + 'castle.js'), import(base + 'castle-interior.js')]);
      const outside = buildCastle(THREE), inside = buildCastleInterior(THREE);
      const windowGlows=new Map();
      outside.traverse(o=>{
        if(o.material?.name!=='interiorGlow')return;
        if(!windowGlows.has(o.material)) {
          const material=o.material.clone();material.color.multiplyScalar(1.4);material.toneMapped=false;
          windowGlows.set(o.material,material);
        }
        o.material=windowGlows.get(o.material);
      });
      const glow = [];
      outside.traverse((o) => {
        const h = o.name === 'interiorGlow' && o.userData.host;
        if (h && GLOW_HIDDEN.some((g) => Math.abs(g.x - h.x) < 0.2 && Math.abs(g.z - h.z) < 0.2 && g.h === h.h)) glow.push(o);
      });
      // Der Bergfried ragt mit seiner Westecke in den Palas hinein (Treppe, Rittersaal). Seine Außenhaut wird dort
      // abgeschnitten, damit im Saal und auf der Treppe keine Wände mitten im Raum stehen.
      const keep = [];
      outside.traverse((o) => { const h = o.userData.host; if (h && o.name === 'hollowWall' && Math.abs(h.x - 9) < 0.2 && Math.abs(h.z + 12) < 0.2 && h.h === 22) keep.push(o); });
      const outsideStats = mergeStatic(THREE, outside, (o) => keep.includes(o)), insideStats = mergeStatic(THREE, inside);
      for (const g of [outside, inside]) { g.position.set(origin.x, origin.y, origin.z); g.rotation.y = rot; g.updateMatrixWorld(true); }
      const cut = [[-1, 0, 0, 4.9], [1, 0, 0, -8.1], [0, 0, -1, -10.6], [0, 0, 1, 7.9], [0, -1, 0, -1], [0, 1, 0, -14]]
        .map(([x, y, z, c]) => new THREE.Plane(new THREE.Vector3(x, y, z), c).applyMatrix4(outside.matrixWorld));
      for (const o of keep) { o.material = o.material.clone(); o.material.clippingPlanes = cut; o.material.clipIntersection = true; }
      inside.visible = false;
      scene.add(outside, inside);
      site.group = outside; site.interior = inside; site.glow = glow;
      site.walk = root.NachtjagdCastleWalk.create({ colliders: outside.userData.colliders, origin, rot });
      // Lichtvorschläge je Raum (lokal) in Weltkoordinaten
      site.lamps = (inside.userData.lights || []).map((l) => {
        const p = site.walk.toWorld(l.x, l.z);
        return { room: l.room, x: p.x, y: origin.y + l.y, z: p.z, color: l.color, intensity: l.intensity, distance: l.distance };
      });
      for (let i = 0; i < lightCount; i++) { const light = new THREE.PointLight(0xffc27a, 0, 12, 1.6); light.visible = false; scene.add(light); pool.push(light); }
      site.stats = { outside: outsideStats, inside: insideStats, lamps: site.lamps.length };
      return site;
    })().catch((error) => { site.failed = error; console.warn('Burgmodell nicht geladen:', error); return site; });

    // Pro Bild: Innenraum nur in der Nähe zeigen, die nächsten Lampen an den Spieler hängen.
    site.update = (x, y, z) => {
      if (!site.walk) return;
      const near = Math.hypot(x - origin.x, z - origin.z) < nearRadius;
      if (near !== site.interiorVisible) {
        site.interiorVisible = near; site.interior.visible = near;
        for (const o of site.glow) o.visible = !near;
      }
      if (!near) { for (const l of pool) l.visible = false; return; }
      const order = site.lamps.map((l) => ({ l, d: Math.hypot(l.x - x, l.y - y, l.z - z) })).sort((a, b) => a.d - b.d);
      pool.forEach((light, i) => {
        const e = order[i];
        if (!e || e.d > e.l.distance * 1.6) { light.visible = false; return; }
        light.visible = true; light.position.set(e.l.x, e.l.y, e.l.z); light.color.setHex(e.l.color);
        light.intensity = e.l.intensity * 1.3; light.distance = e.l.distance * 1.35;
      });
    };
    // Innen (Raum oder Treppe)? 1 oder 0 für Licht- und Schneeregler.
    site.indoor = (x, y, z) => {
      if (!site.walk || !site.walk.near(x, z)) return 0;
      const p = site.walk.toLocal(x, z);
      return site.walk.cellHas(p.x, p.z, y - origin.y) ? 1 : 0;
    };
    // Netze für Schussstrahlen: Außenhülle immer, Innenraum nur wenn sichtbar; Glas bleibt ausgenommen.
    site.targets = () => {
      const out = [];
      for (const g of [site.group, site.interiorVisible ? site.interior : null]) {
        if (g) g.traverse((o) => { if (o.isMesh && o.visible && o.name !== 'windowGlass' && !(o.material && o.material.transparent)) out.push(o); });
      }
      return out;
    };
    return site;
  }

  const api = { create, mergeStatic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdCastleSite = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
