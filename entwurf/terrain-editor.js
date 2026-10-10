'use strict';

// Höhenpinsel, Verlauf und Dateiformat ohne Abhängigkeit von der Darstellung.
globalThis.NachtjagdTerrain = {
  create({ width, depth, step, originX, originZ, base, basis = 'default' }) {
    const offsets = new Float32Array(width * depth);
    const undoStack = [], redoStack = [];
    let before = null;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const height = index => base[index] + offsets[index];
    function remember(snapshot) {
      undoStack.push(snapshot);
      if (undoStack.length > 24) undoStack.shift();
      redoStack.length = 0;
    }
    return {
      offsets,
      begin() { before = offsets.slice(); },
      end() {
        const changed = before && offsets.some((value, index) => value !== before[index]);
        if (changed) remember(before);
        before = null;
        return Boolean(changed);
      },
      brush({ x, z, radius, strength, seconds, tool, level, protect = () => 1 }) {
        if (![x, z, radius, strength, seconds].every(Number.isFinite) || radius <= 0) return false;
        const minX = Math.max(0, Math.floor((x - radius - originX) / step));
        const maxX = Math.min(width - 1, Math.ceil((x + radius - originX) / step));
        const minZ = Math.max(0, Math.floor((z - radius - originZ) / step));
        const maxZ = Math.min(depth - 1, Math.ceil((z + radius - originZ) / step));
        const source = tool === 'smooth' ? offsets.slice() : offsets;
        let changed = false;
        for (let row = minZ; row <= maxZ; row++) for (let col = minX; col <= maxX; col++) {
          const px = originX + col * step, pz = originZ + row * step;
          const distance = Math.hypot(px - x, pz - z) / radius;
          if (distance >= 1) continue;
          const weight = (1 - distance * distance) ** 2 * clamp(protect(px, pz), 0, 1);
          if (!weight) continue;
          const index = row * width + col, current = height(index);
          let delta = strength * seconds * weight * (tool === 'lower' ? -1 : 1);
          if (tool === 'flatten' || tool === 'smooth') {
            let target = level;
            if (tool === 'smooth') {
              let sum = 0, count = 0;
              for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
                const column = clamp(col + dx, 0, width - 1), line = clamp(row + dz, 0, depth - 1);
                const neighbor = line * width + column;
                sum += base[neighbor] + source[neighbor]; count++;
              }
              target = sum / count;
            }
            if (!Number.isFinite(target)) continue;
            delta = (target - current) * clamp(strength * seconds * .15 * weight, 0, 1);
          }
          const next = clamp(offsets[index] + delta, Math.max(-250, -100 - base[index]), Math.min(250, 400 - base[index]));
          if (Math.abs(next - offsets[index]) > .00001) { offsets[index] = next; changed = true; }
        }
        return changed;
      },
      undo() {
        if (!undoStack.length) return false;
        redoStack.push(offsets.slice()); offsets.set(undoStack.pop()); return true;
      },
      redo() {
        if (!redoStack.length) return false;
        undoStack.push(offsets.slice()); offsets.set(redoStack.pop()); return true;
      },
      get canUndo() { return undoStack.length > 0; },
      get canRedo() { return redoStack.length > 0; },
      get changedCount() { return offsets.reduce((sum, value) => sum + Number(Math.abs(value) > .00001), 0); },
      reset() {
        if (!offsets.some(value => value !== 0)) return false;
        remember(offsets.slice()); offsets.fill(0); return true;
      },
      serialize() {
        return JSON.stringify({ format: 'nachtjagd-terrain', version: 2, basis, grid: { width, depth, step, originX, originZ }, offsets: Array.from(offsets) });
      },
      load(text, record = true) {
        if (typeof text !== 'string' || text.length > 2000000) throw new Error('Die Geländedatei ist zu groß.');
        let data;
        try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist keine lesbare Geländedatei.'); }
        const expected = { width, depth, step, originX, originZ };
        if (!data || data.format !== 'nachtjagd-terrain' || data.version !== 2 || data.basis !== basis || !data.grid || Object.entries(expected).some(([key, value]) => data.grid[key] !== value)
          || !Array.isArray(data.offsets) || data.offsets.length !== offsets.length
          || data.offsets.some((value, index) => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 250 || base[index] + value < -100 || base[index] + value > 400)) {
          throw new Error('Diese Datei passt nicht zum Gelände des Bergdorfs.');
        }
        if (record) remember(offsets.slice());
        offsets.set(data.offsets);
      }
    };
  }
};
