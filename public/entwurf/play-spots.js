'use strict';

// Spielorte für die Bergdorf-Welt: Truhen, Händler, Schmied, Bildstöcke, Angelplätze, Notizen und Reliquien.
// Die Lage folgt dem bestätigten Layout (world-layout.js); jeder Punkt wird auf den nächsten freien, begehbaren Boden gesetzt.
globalThis.NachtjagdSpots = {
  build({ layout, blocked, floor }) {
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

    return { merchant, smith, shrines, fishSpots, loots };
  }
};
