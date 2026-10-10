'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/entwurf/world-layout.js', import.meta.url), 'utf8'), context);
const layout = context.NachtjagdLayout;
test('Skizzenanordnung: See südwestlich, Burg westlich, Gebirge nördlich des Dorfs', () => {
  assert.ok(layout.lakeDistance(-210,220) < 0);
  assert.ok(layout.lakeDistance(layout.village.x,layout.village.z) > 0);
  assert.ok(layout.castle.x < layout.village.x && layout.castle.z < layout.village.z);
  assert.ok(layout.naturalHeight(-50,-329) > 280);
  assert.ok(layout.naturalHeight(90,45) < 60);
});
test('Dorfgrund besitzt Gefälle und mehr als eine Gebäudeform', () => {
  const heights = layout.houses.map(h => layout.naturalHeight(h[0],h[1]));
  assert.ok(layout.houses.length >= 28);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 8);
  assert.equal(new Set(layout.houses.map(h => h[6])).size, 4);
});
test('Burg steht auf einem freien Sporn mit niedrigerem Gelände auf drei Seiten', () => {
  const { x,z } = layout.castle, top = layout.naturalHeight(x,z);
  for (const [dx,dz] of [[-85,0],[0,-85],[0,85]]) assert.ok(top - layout.naturalHeight(x+dx,z+dz) > 40);
  assert.ok(layout.naturalHeight(x+90,z+20) > layout.naturalHeight(x+90,z+65));
});
test('Wald bildet nördliche, östliche und südliche Bänder; See bleibt getrennt', () => {
  for (const [x,z] of [[-100,-150],[210,-35],[250,90],[140,180]]) assert.ok(layout.forestWeight(x,z) > .8);
  assert.ok(layout.forestWeight(-300,220) < .01);
  assert.ok(layout.naturalHeight(-210,220) < -6);
  assert.ok(Math.abs(layout.lakeDistance(...layout.lake[0])) < .001);
});
