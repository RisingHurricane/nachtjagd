'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['world-layout.js','viaduct.js']) vm.runInContext(fs.readFileSync(new URL('../public/entwurf/'+file,import.meta.url),'utf8'),context);
function bridge(groundHeight = context.NachtjagdLayout.naturalHeight) {
  return context.NachtjagdViaduct.create({ a: [-210,-80], b: [-120,-180], width: 8, arches: 7, groundHeight });
}
test('Viadukt überquert die echte Senke mit durchgehend begehbarer Fahrbahn', () => {
  const v = bridge(), mid = v.point(v.length/2);
  assert.ok(v.top(v.length/2)-context.NachtjagdLayout.naturalHeight(...mid) > 30);
  let feet = v.floor(...v.a);
  for (let s = 0; s <= v.length; s += .5) {
    const p = v.point(s), next = v.floor(...p,feet);
    assert.ok(Math.abs(next-feet) < .5);
    assert.equal(v.collides(...p,next),false);
    feet = next;
  }
});
test('Unter einem offenen Bogen bleibt die Augenhöhe auf dem Gelände', () => {
  const v = bridge(), p = v.point(v.length/2), ground = context.NachtjagdLayout.naturalHeight(...p);
  assert.equal(v.floor(...p,ground),ground);
  assert.equal(v.collides(...p,ground),false);
  assert.ok(v.floor(...p) > ground+30);
});
test('Brüstungen und Pfeiler blockieren; die Brückenmitte bleibt offen', () => {
  const v = bridge(), s = v.length/2;
  assert.equal(v.collides(...v.point(s,3.6),v.top(s)),true);
  assert.equal(v.collides(...v.point(s,0),v.top(s)),false);
  const pier = v.point(v.span*3);
  assert.equal(v.collides(...pier,context.NachtjagdLayout.naturalHeight(...pier)),true);
  assert.equal(v.contains(...v.point(s,6)),false);
});
test('Brückenprofil folgt nach Geländebearbeitung gemeinsam seinen Widerlagern', () => {
  let offset = 0;
  const v = bridge((x,z) => context.NachtjagdLayout.naturalHeight(x,z)+offset);
  const before = v.top(v.length/2); offset = 12; v.refresh();
  assert.ok(Math.abs(v.top(v.length/2)-before-12) < .001);
  assert.equal(v.floor(...v.point(v.length/2),before+12),before+12);
});
