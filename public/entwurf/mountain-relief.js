'use strict';

// Gebirgsrelief über der Waldgrenze: Felsstufen, Grate und Rinnen.
// Reine Funktion von (x, z, Höhe), damit Darstellung, Kollision und Baumsetzung dieselbe Fläche nutzen.
// Unter 110 m ändert sich nichts: Dorf, Wege, Burg (102 m, Sporn), Viadukt, See und Seilbahn bleiben praktisch unberührt.
(root => {
  const START = 110, FULL = 240, TOP = 645;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Gitterrauschen mit festem Hash (keine Zufallszahlen, jede Sitzung liefert dasselbe Gebirge).
  function hash(ix, iz) {
    let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    let fx = x - ix, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function fbm(x, z, octaves) {
    let amp = 0.5, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * noise(x, z); norm += amp; x = x * 2.03 + 17.1; z = z * 2.03 - 9.7; amp *= 0.5; }
    return sum / norm;
  }
  // Grate: Betrag des Rauschens gefaltet, höhere Oktaven nur dort, wo die Grundform schon scharf ist.
  function ridge(x, z) {
    let amp = 0.5, sum = 0, weight = 1, norm = 0;
    for (let i = 0; i < 4; i++) {
      let n = 1 - Math.abs(noise(x, z) * 2 - 1); n *= n;
      sum += n * amp * weight; norm += amp; weight = Math.min(1, n * 1.6);
      x = x * 2.1 + 5.3; z = z * 2.1 - 3.1; amp *= 0.5;
    }
    return sum / norm;
  }
  // Hohe Gipfel werden oben weich zusammengedrückt: weniger Nadeln, breitere, ruhigere Massive. Stetig bei 200 m (Steigung 1).
  const SOFT = 200, RANGE = 260;
  const soften = h => h <= SOFT ? h : SOFT + RANGE * (1 - Math.exp(-(h - SOFT) / RANGE));
  function relief(x, z, h0) {
    const w = smooth(START, FULL, h0);
    if (w <= 0) return h0;
    const h = soften(h0);
    // Gebirgsrelief: Koordinaten leicht verbogen, damit Grate nicht in geraden Linien laufen.
    const wx = x + 90 * (fbm(x / 170 + 2.2, z / 170 + 8.8, 2) - 0.5), wz = z + 90 * (fbm(x / 170 - 6.1, z / 170 + 1.3, 2) - 0.5);
    // Felsstufen: weiche, unregelmäßig hohe Terrassen, dazwischen steile Wände.
    const step = 26 + 34 * fbm(x / 240 + 11.3, z / 240 - 4.7, 2);
    const t = h / step, floor = Math.floor(t);
    const terraced = (floor + smooth(0.25, 0.85, t - floor)) * step;
    let out = h + (terraced - h) * 0.25 * w;
    // Große Grate und Rinnen, nach oben schärfer, dazu kleinere Rippen.
    const sharp = 0.3 + 0.7 * smooth(180, 360, h);
    out += w * (ridge(wx / 170 + 3.1, wz / 170 + 7.7) - 0.32) * 230 * sharp;
    out += w * (ridge(wx / 62 - 4.3, wz / 62 + 2.9) - 0.3) * 70 * sharp;
    // Kleinrelief für unruhige Flanken.
    out += w * (fbm(x / 30, z / 30, 3) - 0.5) * 16;
    return Math.min(out, TOP);
  }
  // Glättet einzelne Rasterspitzen: ein Durchgang mit 3×3-Mittel, nur oberhalb der Waldgrenze wirksam (gleiche Gewichtung wie das Relief).
  function smoothGrid(heights, cols, rows) {
    const src = Float32Array.from(heights);
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c, w = smooth(START, FULL, src[i]);
      if (w <= 0) continue;
      let sum = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) sum += src[i + dr * cols + dc] * (dr || dc ? 1 : 2);
      heights[i] = src[i] + (sum / 10 - src[i]) * 0.7 * w;
    }
  }
  const api = { relief, smoothGrid, soften, START, FULL, TOP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NachtjagdRelief = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
