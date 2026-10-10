'use strict';

// Norden ist -z. Die Orte und Waldflächen folgen der farbigen Nutzerskizze.
globalThis.NachtjagdLayout = (() => {
  const village = { x: 90, z: 45 };
  const castle = { x: -265, z: -100, height: 102 };
  const lake = [[-353,267],[-344,193],[-334,115],[-317,69],[-293,82],[-268,116],[-213,147],[-149,170],[-81,194],[-12,218],[18,242],[-24,264],[-113,281],[-237,289],[-321,284]];
  const forestBands = [
    [[-130,-145],[-60,-165],[25,-142],[125,-102],[211,-34],[255,62]],
    [[-115,-134],[-128,-60],[-100,5],[-142,65],[-65,57],[0,70]],
    [[255,40],[247,131],[201,196],[142,178],[75,173],[22,150]],
    [[227,170],[255,225],[175,222],[112,201]]
  ];
  const houses = [];
  // Vier kurze Gassen mit verschieden großen, noch bewusst einfachen Baukörpern.
  for (const z of [-43,-23,24,44]) for (const x of [-48,-29,-10,14,36,57]) {
    if (z < 0 && x >= -10 && x <= 14) continue;
    const i = houses.length;
    houses.push([village.x + x, village.z + z, 8 + i % 3 * 1.5, 9 + i % 4, (i % 3 - 1) * .07, 6 + i % 5, i % 4]);
  }
  for (const z of [-40,-20,24,43]) for (const x of [-67,77]) {
    const i = houses.length;
    houses.push([village.x + x, village.z + z, 9, 10 + i % 3, Math.PI / 2 + .05 * (i % 2), 7 + i % 4, i % 4]);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function smooth(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }
  // Negativ im Wasser, positiv am Ufer: dieselbe Kontur für Boden, Bäume und Schutzmaske.
  function lakeDistance(x, z) {
    let inside = false, distance = Infinity;
    for (let i = 0, j = lake.length - 1; i < lake.length; j = i++) {
      const a = lake[i], b = lake[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      distance = Math.min(distance, segmentDistance(x, z, a, b));
    }
    return inside ? -distance : distance;
  }
  function forestWeight(x, z) {
    let distance = Infinity;
    for (const band of forestBands) for (let i = 1; i < band.length; i++) distance = Math.min(distance, segmentDistance(x, z, band[i - 1], band[i]));
    return 1 - smooth(28, 57, distance);
  }
  function naturalHeight(x, z) {
    let h = 29 - z * .028 + 9 * Math.sin(x / 95) * Math.cos(z / 88) + 6 * Math.sin((x + z) / 57);
    h += 12 * Math.exp(-(((x - 180) / 130) ** 2) - ((z - 120) / 140) ** 2);
    h += 24 * Math.exp(-(((x - 57) / 92) ** 2) - ((z + 10) / 72) ** 2);
    // Kantige, sich überschneidende Bergpyramiden bilden den nördlichen Gebirgskamm.
    const peaks = [[-370,-293,100,116,235],[-270,-315,104,120,290],[-155,-285,100,135,245],[-50,-329,116,125,310],[65,-293,116,130,260],[182,-313,120,128,295],[310,-280,102,132,237]];
    for (const [px,pz,rx,rz,top] of peaks) {
      const dx = (x - px) / rx, dz = (z - pz) / rz;
      const radius = Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx * .72 + dz * .63));
      h = Math.max(h, 31 + (top - 31) * Math.max(0, 1 - radius));
    }
    // Freier Sporn mit steilen Flanken; ein schmaler Rücken verbindet ihn nach Osten.
    const dx = x - castle.x, dz = z - castle.z;
    const spur = Math.max(Math.abs(dx) / 64, Math.abs(dz) / 58, Math.abs(dx + dz * .35) / 75);
    const shelf = castle.height - 3 + 3 * Math.sin(x / 13) * Math.cos(z / 17);
    h = Math.max(h, h + (shelf - h) * (1 - clamp((spur - .74) / .28, 0, 1)));
    const along = clamp((x + 221) / 128, 0, 1);
    if (x > -225 && x < -90) {
      const ridge = (94 - 48 * along) * (1 - smooth(9, 30, Math.abs(z + 82 - 18 * along)));
      h = Math.max(h, ridge);
    }
    const shore = lakeDistance(x, z);
    return shore < 0 ? Math.max(-7, shore * .7) : h * smooth(0, 40, shore);
  }
  return { village, castle, lake, houses, forestBands, smooth, segmentDistance, lakeDistance, forestWeight, naturalHeight, basis: 'bergdorf-skizze-2026-10-10-v1' };
})();
