import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Tests für das Gebirgsrelief (mountain-relief.js): Talbereich unverändert, Gipfel reicher, überall endlich und begrenzt.
const source = await readFile(new URL('../public/entwurf/mountain-relief.js', import.meta.url), 'utf8');
const context = { Math };
context.globalThis = context;
vm.runInNewContext(source, context);
const { relief, soften, START, FULL, TOP } = context.NachtjagdRelief;

test('unter der Startgrenze bleibt die Höhe exakt erhalten', () => {
  for (let x = -800; x <= 800; x += 37) for (let z = -700; z <= 700; z += 41) {
    for (const h of [-7, 0, 24, 73, 102, START]) assert.equal(relief(x, z, h), h);
  }
});

test('Übergang ist stetig: knapp über der Grenze ändert sich die Höhe kaum', () => {
  for (let x = -600; x <= 600; x += 53) {
    const d = Math.abs(relief(x, 33, START + 1) - (START + 1));
    assert.ok(d < 1.2, `Sprung ${d} bei x=${x}`);
  }
});

test('Relief ist deterministisch, endlich und begrenzt', () => {
  let changed = 0, total = 0;
  for (let x = -800; x <= 800; x += 20) for (let z = -700; z <= 700; z += 20) {
    for (const h of [150, 240, 330, 436, 600]) {
      const a = relief(x, z, h), b = relief(x, z, h);
      assert.equal(a, b);
      assert.ok(Number.isFinite(a) && a <= TOP && Math.abs(a - soften(h)) < 260, `${a} bei h=${h}`);
      total++; if (Math.abs(a - soften(h)) > 1) changed++;
    }
  }
  assert.ok(changed / total > 0.6, 'Gipfelhöhen müssen sich deutlich verändern');
});

test('Gipfelflanken erhalten Grate: gleiche Höhe an verschiedenen Orten gibt verschiedene Werte', () => {
  const values = new Set();
  for (let i = 0; i < 40; i++) values.add(Math.round(relief(i * 31 - 600, i * 17 - 300, 400)));
  assert.ok(values.size > 25, `nur ${values.size} verschiedene Werte`);
  assert.ok(FULL > START);
});
