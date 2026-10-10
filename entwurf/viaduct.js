'use strict';

// Gemeinsames Brückenprofil für Geometrie, Augenhöhe und Kollisionen.
globalThis.NachtjagdViaduct = {
  create({ a, b, width = 8, arches = 7, groundHeight }) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const cosine = dx / length, sine = dz / length, span = length / arches, pierWidth = 2.5;
    let startHeight, endHeight;
    function refresh() { startHeight = groundHeight(...a) + .4; endHeight = groundHeight(...b) + .4; }
    function point(s, lateral = 0) { return [a[0] + cosine * s - sine * lateral, a[1] + sine * s + cosine * lateral]; }
    function coordinates(x,z) { return { s: (x-a[0])*cosine + (z-a[1])*sine, lateral: -(x-a[0])*sine + (z-a[1])*cosine }; }
    function top(s) { return startHeight + (endHeight - startHeight) * s / length; }
    function contains(x,z) { const p = coordinates(x,z); return p.s >= 0 && p.s <= length && Math.abs(p.lateral) <= width / 2; }
    function intrados(s) {
      const index = Math.min(arches - 1, Math.floor(s / span)), middle = (index + .5) * span;
      const radius = (span - pierWidth) / 2, offset = s - middle;
      if (Math.abs(offset) >= radius) return -Infinity;
      const spring = Math.min(top(index * span),top((index+1) * span)) - 3 - radius;
      return spring + Math.sqrt(radius * radius - offset * offset);
    }
    refresh();
    return {
      a, b, width, arches, length, span, pierWidth, cosine, sine, point, coordinates, top, contains, intrados, refresh,
      floor(x,z,previousFeet) {
        const ground = groundHeight(x,z), p = coordinates(x,z), deck = top(p.s);
        // Unter den Bögen bleiben; nur vom Widerlager oder von der Fahrbahn aufsteigen.
        return contains(x,z) && (previousFeet === undefined || Math.abs(previousFeet - deck) < 2.5) ? Math.max(ground,deck) : ground;
      },
      collides(x,z,feet) {
        const p = coordinates(x,z);
        if (p.s < -.45 || p.s > length + .45 || Math.abs(p.lateral) > width / 2 + .45) return false;
        const deck = top(p.s);
        if (feet >= deck - .4) return feet < deck + 1.5 && Math.abs(p.lateral) > width / 2 - 1;
        if (p.s < 0 || p.s > length) return false;
        const ceiling = intrados(p.s);
        return feet < deck && feet + 1.75 > ceiling;
      }
    };
  }
};
