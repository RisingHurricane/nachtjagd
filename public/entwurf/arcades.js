'use strict';

// Säulengänge: Arkaden im Kirchenschiff und ein kleiner Kreuzgang im Burghof.
// Säulen mit Basis und Kapitell, Rundbögen zwischen benachbarten Säulen, beim Kreuzgang ein Dach mit Schnee,
// ein verschneiter Garten und ein Brunnen. Alle Teile je Material zu einem Netz zusammengefasst.
// Kollision: nur die Säulenschäfte und der Brunnen (blocked); Böden kommen aus der Welt.
globalThis.NachtjagdArcades = {
  create({ THREE }) {
    const c = hex => new THREE.Color(hex).convertSRGBToLinear();
    const mats = {
      pale: new THREE.MeshLambertMaterial({ name: 'castle', color: c('#b9b2a4') }),
      grey: new THREE.MeshLambertMaterial({ name: 'castle', color: c('#8a8c8a') }),
      roof: new THREE.MeshLambertMaterial({ name: 'roof', color: c('#d9dfe4') }),
      snow: new THREE.MeshLambertMaterial({ name: 'path-bank', color: c('#e4eaee') }),
      wood: new THREE.MeshLambertMaterial({ name: 'darkWood', color: c('#4a3b2e') })
    };
    const G = { col: new THREE.CylinderGeometry(.26, .3, 1, 10), box: new THREE.BoxGeometry(1, 1, 1), arch: new THREE.TorusGeometry(1, .15, 6, 14, Math.PI), ring: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true) };
    const solids = [];
    function builder() {
      const parts = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
      return {
        add(geo, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0) {
          const g = G[geo].toNonIndexed(); m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, 0)), new THREE.Vector3(sx, sy, sz)); g.applyMatrix4(m4);
          if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g);
        },
        finish(name) {
          const group = new THREE.Group(); group.name = name;
          for (const [mat, list] of parts) {
            const count = list.reduce((n, g) => n + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
            for (const attr of ['position', 'normal']) {
              const values = new Float32Array(count * 3); let at = 0;
              for (const g of list) { values.set(g.attributes[attr].array, at); at += g.attributes[attr].array.length; }
              out.setAttribute(attr, new THREE.BufferAttribute(values, 3));
            }
            list.forEach(g => g.dispose()); out.computeBoundingSphere();
            const mesh = new THREE.Mesh(out, mats[mat]); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
          }
          return group;
        }
      };
    }
    function column(b, mat, x, y, z, h) {
      b.add('box', mat, x, y + .15, z, .78, .3, .78);
      b.add('col', mat, x, y + .3 + (h - .6) / 2, z, 1, h - .6, 1);
      b.add('box', mat, x, y + h - .15, z, .72, .3, .72);
      solids.push({ x, z, r: .42, y0: y - .5, y1: y + h });
    }
    // Rundbogen zwischen zwei Säulenköpfen (gleiche Höhe).
    function arch(b, mat, a, c2, y) {
      const dx = c2.x - a.x, dz = c2.z - a.z, span = Math.hypot(dx, dz), r = span / 2;
      b.add('arch', mat, (a.x + c2.x) / 2, y, (a.z + c2.z) / 2, r, r * .85, 1, -Math.atan2(dz, dx));
      b.add('box', mat, (a.x + c2.x) / 2, y + r * .85 + .2, (a.z + c2.z) / 2, span, .35, .4, -Math.atan2(dz, dx));
    }
    // Arkadenreihe: Säulen auf den Punkten, Bögen dazwischen. points: [{x,y,z}]
    function row(b, mat, points, h) {
      points.forEach(p => column(b, mat, p.x, p.y, p.z, h));
      for (let i = 0; i < points.length - 1; i++) arch(b, mat, { x: points[i].x, z: points[i].z }, { x: points[i + 1].x, z: points[i + 1].z }, Math.max(points[i].y, points[i + 1].y) + h);
    }

    // Kirchenschiff: zwei Arkadenreihen längs der Achse. floor(x,z) liefert den Boden.
    function church({ toWorld, floor, from, to, offset = 3.4, step = 3.5, height = 5 }) {
      const b = builder();
      for (const side of [-1, 1]) {
        const pts = [];
        for (let s = from; s <= to + .01; s += step) { const p = toWorld(side * offset, s); pts.push({ x: p.x, z: p.z, y: floor(p.x, p.z) }); }
        row(b, 'pale', pts, height);
      }
      return b.finish('ChurchArcades');
    }
    // Kreuzgang: äußere und innere Säulenreihe um einen Garten, Dach dazwischen, Brunnen in der Mitte.
    // rect: lokale Grenzen {x0,x1,z0,z1} des äußeren Rings, toWorld(lx,lz), floor(x,z), rot = Drehung der Burg.
    function cloister({ rect, toWorld, floor, rot = 0, height = 3.4, depth = 2.6 }) {
      const b = builder(), inner = { x0: rect.x0 + depth, x1: rect.x1 - depth, z0: rect.z0 + depth, z1: rect.z1 - depth };
      const ring = (r, gaps = []) => {
        const pts = [], add = (lx, lz) => { if (!gaps.some(([gx, gz]) => Math.hypot(lx - gx, lz - gz) < .1)) { const p = toWorld(lx, lz); pts.push({ lx, lz, x: p.x, z: p.z, y: floor(p.x, p.z) }); } };
        const nx = Math.max(2, Math.round((r.x1 - r.x0) / 2.6)), nz = Math.max(2, Math.round((r.z1 - r.z0) / 2.6));
        for (let i = 0; i <= nx; i++) add(r.x0 + (r.x1 - r.x0) * i / nx, r.z0);
        for (let i = 1; i <= nz; i++) add(r.x1, r.z0 + (r.z1 - r.z0) * i / nz);
        for (let i = nx - 1; i >= 0; i--) add(r.x0 + (r.x1 - r.x0) * i / nx, r.z1);
        for (let i = nz - 1; i >= 1; i--) add(r.x0, r.z0 + (r.z1 - r.z0) * i / nz);
        return pts;
      };
      for (const pts of [ring(rect), ring(inner)]) {
        pts.forEach(p => column(b, 'grey', p.x, p.y, p.z, height));
        for (let i = 0; i < pts.length; i++) { const a = pts[i], n = pts[(i + 1) % pts.length]; arch(b, 'grey', a, n, Math.max(a.y, n.y) + height); }
      }
      // Dach über dem Umgang: vier Pultflächen zwischen innerem und äußerem Ring, mit Schnee.
      const centre = toWorld((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2), base = floor(centre.x, centre.z) + height + 1.05;
      const sides = [
        [(rect.x0 + rect.x1) / 2, rect.z0 + depth / 2, rect.x1 - rect.x0 + .6, depth + .6],
        [(rect.x0 + rect.x1) / 2, rect.z1 - depth / 2, rect.x1 - rect.x0 + .6, depth + .6],
        [rect.x0 + depth / 2, (rect.z0 + rect.z1) / 2, depth + .6, rect.z1 - rect.z0 - 2 * depth],
        [rect.x1 - depth / 2, (rect.z0 + rect.z1) / 2, depth + .6, rect.z1 - rect.z0 - 2 * depth]
      ];
      for (const [lx, lz, w, d] of sides) {
        const p = toWorld(lx, lz);
        b.add('box', 'roof', p.x, base, p.z, w, .25, d, -rot);
        b.add('box', 'snow', p.x, base + .17, p.z, w - .2, .1, d - .2, -rot);
      }
      // Garten: Schneefläche mit Brunnen
      const mid = toWorld((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2), gy = floor(mid.x, mid.z);
      b.add('box', 'snow', mid.x, gy + .04, mid.z, inner.x1 - inner.x0 - .6, .08, inner.z1 - inner.z0 - .6, -rot);
      b.add('ring', 'grey', mid.x, gy + .4, mid.z, 1.1, .8, 1.1);
      b.add('col', 'grey', mid.x, gy + .9, mid.z, .6, 1.8, .6);
      b.add('box', 'wood', mid.x, gy + 2.1, mid.z, 2.2, .14, .14, -rot);
      solids.push({ x: mid.x, z: mid.z, r: 1.25, y0: gy - .5, y1: gy + 2.4 });
      return b.finish('CastleCloister');
    }
    function blocked(x, z, feet) {
      for (const s of solids) if (Math.hypot(x - s.x, z - s.z) < s.r + .3 && (!Number.isFinite(feet) || (feet > s.y0 && feet < s.y1))) return true;
      return false;
    }
    return { church, cloister, blocked, solids };
  }
};
