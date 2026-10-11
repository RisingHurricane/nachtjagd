'use strict';

// Spielorte für die Bergdorf-Welt: Truhen, Händler, Schmied, Bildstöcke, Angelplätze, Notizen und Reliquien.
// Die Lage folgt dem bestätigten Layout (world-layout.js); jeder Punkt wird auf den nächsten freien, begehbaren Boden gesetzt.
globalThis.NachtjagdSpots = {
  build({ layout, blocked, floor, boatOk, routes }) {
    const walkable = (x, z) => { const y = floor(x, z); return Number.isFinite(y) && !blocked(x, z, y); };
    // Nächster freier Punkt um (x,z): Spirale in 1-m-Schritten, deterministisch.
    function free(x, z, minR = 0) {
      if (minR === 0 && walkable(x, z)) return { x, z };
      for (let r = Math.max(1, minR); r <= 14; r += 1) {
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2 + r * 0.7, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (walkable(px, pz)) return { x: px, z: pz };
        }
      }
      return { x, z };
    }
    const at = (x, z, extra = {}) => ({ ...free(x, z), ...extra });
    const { houses, village, landmarkSites, lakeHomes, mines, castle } = layout;

    // Handel im Dorf: auf dem Platz zwischen Kirche und Dorfmitte.
    const merchant = at(village.x - 14, village.z + 3);
    const smith = at(village.x + 15, village.z + 8);

    // Bildstöcke an Wegen und Orten.
    const shrines = [
      at(layout.villageGates[0][0] - 10, layout.villageGates[0][1]),
      at(layout.villageGates[1][0] + 9, layout.villageGates[1][1]),
      at(landmarkSites.stones[0] + 18, landmarkSites.stones[1] + 14),
      at(landmarkSites.wind[0] - 12, landmarkSites.wind[1] - 12),
      at(landmarkSites.ruin[0] - 24, landmarkSites.ruin[1] + 4)
    ];

    // Angelplätze: Stegende und Uferstellen am See.
    const dockEnd = [-211.5, 148.5];
    const fishSpots = [{ x: dockEnd[0], z: dockEnd[1] }];
    const shoreTargets = [[-330, 118], [-150, 172], [-60, 205]];
    for (const [tx, tz] of shoreTargets) {
      let best = null;
      for (let dz = -60; dz <= 60; dz += 3) for (let dx = -60; dx <= 60; dx += 3) {
        const x = tx + dx, z = tz + dz, d = layout.lakeDistance(x, z);
        if (d > 1.2 && d < 2.6 && walkable(x, z) && (!best || Math.hypot(dx, dz) < best.k)) best = { x, z, k: Math.hypot(dx, dz) };
      }
      if (best) fishSpots.push({ x: best.x, z: best.z });
    }

    // Truhen: an jedem zweiten Haus, an Landmarken und an den Seehäusern.
    const loots = [];
    houses.forEach(([x, z, w, d, rot], i) => {
      if (i % 2) return;
      const side = i % 4 === 0 ? 1 : -1, dist = (side > 0 ? w : d) / 2 + 2.4;
      loots.push(at(x + Math.cos(rot) * dist * side, z - Math.sin(rot) * dist * side));
    });
    lakeHomes.forEach(([x, z, w], i) => { if (i % 2 === 0) loots.push(at(x + w / 2 + 2.4, z)); });
    loots.push(at(landmarkSites.wind[0] + 8, landmarkSites.wind[1] + 4));
    loots.push(at(landmarkSites.stones[0] - 6, landmarkSites.stones[1] + 4));
    loots.push(at(landmarkSites.ruin[0] + 4, landmarkSites.ruin[1] - 10));
    // Spezialfund: Granaten, Molotows und Lei in der Klosterruine.
    loots.push(at(landmarkSites.ruin[0] + 2, landmarkSites.ruin[1] + 6, { special: 'grenades' }));

    // Notizen erzählen die Geschichte des Tals.
    const notes = [
      [village.x - 4, village.z - 8], [lakeHomes[1][0] - 6, lakeHomes[1][1] + 3], [landmarkSites.stones[0] + 3, landmarkSites.stones[1] - 3],
      [landmarkSites.wind[0] + 4, landmarkSites.wind[1] - 6], [landmarkSites.ruin[0] - 8, landmarkSites.ruin[1] - 4],
      [mines[0].a[0] + 6, mines[0].a[1] + 4], [mines[1].a[0] + 6, mines[1].a[1] + 4], [layout.villageGates[2][0] - 3, layout.villageGates[2][1] + 5]
    ];
    notes.forEach(([x, z], i) => loots.push(at(x, z, { special: 'note', noteId: i })));

    // Reliquien: Kompass bei der Kirche, Winterherz auf der Burg, Grubenlampe an der Westmine.
    loots.push(at(village.x - 6, village.z - 12, { relicId: 'compass' }));
    loots.push(at(castle.x + 14, castle.z - 6, { relicId: 'heart' }));
    loots.push(at(mines[0].a[0] + 9, mines[0].a[1] - 3, { relicId: 'lamp' }));

    return { merchant, smith, shrines, fishSpots, loots, ...buildVehicles() };

    // ---------------------------------------------------------------- Fahrzeuge (Platzhalter bis zu den fertigen Modellen)
    function buildVehicles() {
      // Platz für einen Geländewagen: Mitte, Ecken, Bug und Heck frei und fast eben.
      const roomy = (x, z, yaw) => {
        const s = Math.sin(yaw), c = Math.cos(yaw), ys = [];
        for (const [lx, lz] of [[0, 0], [0, 2.4], [0, -2.4], [1.3, 2.2], [-1.3, 2.2], [1.3, -2.2], [-1.3, -2.2]]) {
          const px = x - c * lx + s * lz, pz = z + s * lx + c * lz, y = floor(px, pz);
          if (!Number.isFinite(y) || blocked(px, pz, y)) return false;
          ys.push(y);
        }
        return Math.max(...ys) - Math.min(...ys) < 0.9;
      };
      const park = (x, z, yaw) => {
        for (let r = 0; r <= 16; r += 1.5) for (let i = 0; i < (r ? 12 : 1); i++) {
          const a = i / 12 * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (roomy(px, pz, yaw)) return { x: px, z: pz, yaw };
        }
        return { x, z, yaw };
      };
      // Zwei Geländewagen an den Dorftoren, Blick nach draußen.
      const g = layout.villageGates;
      const jeeps = [park(layout.village.x + 14, layout.village.z, Math.PI / 2), park(g[0][0] - 10, g[0][1], -Math.PI / 2)];

      // Lorenschienen entlang der beiden Minenwege, Weichen später mit dem Tunnelnetz.
      const rails = { nodes: [], links: [] }, carts = [];
      for (const id of ['mine-west', 'mine-north']) {
        const route = (routes || []).find(r => r.id === id);
        if (!route) continue;
        const first = rails.nodes.length;
        route.points.forEach(([x, z]) => rails.nodes.push({ x, z }));
        for (let i = 0; i < route.points.length - 1; i++) rails.links.push([first + i, first + i + 1]);
        const link0 = rails.links.length - route.points.length + 1;
        carts.push({ link: link0, t: 4 }, { link: rails.links.length - 1, t: Math.max(2, Math.hypot(route.points[route.points.length - 1][0] - route.points[route.points.length - 2][0], route.points[route.points.length - 1][1] - route.points[route.points.length - 2][1]) - 4) });
      }

      // Gondel: Talstation am Osttor, Bergstation auf dem Nordostgrat. Nächster ebener, freier Punkt.
      const level = (x, z) => {
        const y = floor(x, z);
        if (!Number.isFinite(y) || blocked(x, z, y)) return false;
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4, px = x + Math.cos(a) * 4, pz = z + Math.sin(a) * 4, py = floor(px, pz, y);
          if (!Number.isFinite(py) || blocked(px, pz, py) || Math.abs(py - y) > 2.5) return false;
        }
        return true;
      };
      const station = (x, z, name) => {
        for (let r = 0; r <= 40; r += 2) for (let i = 0; i < (r ? 16 : 1); i++) {
          const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
          if (level(px, pz)) return { x: px, z: pz, y: floor(px, pz), name };
        }
        return { x, z, y: floor(x, z), name };
      };
      const gondola = { stations: [station(layout.villageGates[1][0] + 15, layout.villageGates[1][1] + 5, 'Talstation'), station(300, -240, 'Bergstation')] };

      // Boote: am Seesteg und an den Angelstellen am Ufer.
      const boats = [];
      const dock = [[-224, 126], [-210, 151]], dl = Math.hypot(dock[1][0] - dock[0][0], dock[1][1] - dock[0][1]);
      const ux = (dock[1][0] - dock[0][0]) / dl, uz = (dock[1][1] - dock[0][1]) / dl;
      const water = (x, z) => boatOk(x, z) && layout.lakeDistance(x, z) < -3.5;
      const addBoat = (x, z, yaw) => {
        for (let r = 0; r <= 14; r += 1) for (let i = 0; i < (r ? 12 : 1); i++) {
          const a = i / 12 * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (water(px, pz) && boats.every(b => Math.hypot(b.x - px, b.z - pz) > 3.2)) { boats.push({ x: px, z: pz, yaw }); return; }
        }
      };
      const yawOut = Math.atan2(ux, uz), tip = dock[1];
      // Zwei Boote dicht am Stegende (Einstieg vom Steg aus), die übrigen am Ufer.
      const spots = [];
      for (let dx = -8; dx <= 8; dx += 0.5) for (let dz = -8; dz <= 8; dz += 0.5) {
        const x = tip[0] + dx, z = tip[1] + dz;
        if (water(x, z)) spots.push({ x, z, d: Math.hypot(dx, dz) });
      }
      spots.sort((a, b) => a.d - b.d);
      for (const p of spots) if (boats.length < 2 && p.d > 2.2 && boats.every(b => Math.hypot(b.x - p.x, b.z - p.z) > 3.4)) boats.push({ x: p.x, z: p.z, yaw: yawOut });
      for (const f of fishSpots.slice(1)) addBoat(f.x, f.z + 6, Math.PI);
      return { jeeps, rails, carts, gondola, boats };
    }
  }
};
