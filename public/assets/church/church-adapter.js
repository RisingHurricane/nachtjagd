'use strict';

// Ohne Eingriff in die Spielwelt; GLTFLoader und THREE kommen vom aufrufenden Spiel.
export async function loadChurch({ THREE, GLTFLoader, origin, rotationY = 0,
  baseURL = new URL('./', import.meta.url).href }) {
  const base = new URL(baseURL, import.meta.url);
  const getJSON = async (name) => {
    const response = await fetch(new URL(name, base));
    if (!response.ok) throw new Error(`Kirche: ${name} (${response.status})`);
    return response.json();
  };
  const [gltf, manifest, collision] = await Promise.all([
    new GLTFLoader().loadAsync(new URL('church.glb', base).href),
    getJSON('church-manifest.json'), getJSON('church-collision.json')
  ]);
  const root = new THREE.Group();
  root.name = 'ChurchPlacement';
  root.add(gltf.scene);
  root.position.set(origin.x, origin.y, origin.z);
  root.rotation.y = rotationY;
  root.traverse((node) => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  root.updateMatrixWorld(true);
  const spatial = createChurchSpatial(manifest, collision, origin, rotationY);
  return { root, manifest, collision, ...spatial };
}

export function createChurchSpatial(manifest, collision, origin, rotationY = 0) {
  const c = Math.cos(rotationY), s = Math.sin(rotationY);
  const toWorld = ([x, y, z]) => ({ x: origin.x + c*x + s*z, y: origin.y + y,
    z: origin.z - s*x + c*z });
  const toLocal = ({ x, y, z }) => ({ x: c*(x-origin.x)-s*(z-origin.z),
    y: y-origin.y, z: s*(x-origin.x)+c*(z-origin.z) });
  const anchors = Object.fromEntries(Object.entries(manifest.anchors).map(([name, p]) => [name, toWorld(p)]));
  function floorHeight(x, z) {
    const p = toLocal({x, y: origin.y, z});
    const f = collision.floors.find((f) => p.x >= f.min[0] && p.x <= f.max[0]
      && p.z >= f.min[1] && p.z <= f.max[1]);
    if (!f) return null;
    const y = f.y ?? f.yAtMinZ + (f.yAtMaxZ-f.yAtMinZ)*(p.z-f.min[1])/(f.max[1]-f.min[1]);
    return origin.y + y;
  }
  // Füße und Körperhöhe angeben. Hohe Fenster und Stürze blockieren so nicht den Bodenweg.
  function collides(position, radius = 0.4, height = 1.75) {
    const p = toLocal(position);
    return collision.boxes.some(({center: b, halfSize: h}) => {
      if (p.y >= b[1]+h[1] || p.y+height <= b[1]-h[1]) return false;
      const dx = Math.max(Math.abs(p.x-b[0])-h[0], 0);
      const dz = Math.max(Math.abs(p.z-b[2])-h[2], 0);
      return dx*dx + dz*dz < radius*radius;
    });
  }
  return { anchors, floorHeight, collides, toWorld, toLocal };
}
