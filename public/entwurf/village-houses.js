'use strict';

// Vier reine Volumenstudien: keine Fenster, Türen, Texturen oder Innenräume.
globalThis.NachtjagdVillageHouses = {
  create(THREE, materials) {
    const cube = new THREE.BoxGeometry(1, 1, 1);
    function roofGeometry(hipped) {
      const points = [
        [-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],
        [0,1,hipped ? -.28 : -.5],[0,1,hipped ? .28 : .5]
      ];
      const faces = [0,1,4,3,5,2,0,4,5,0,5,3,1,2,5,1,5,4,0,3,2,0,2,1];
      for (let i = 0; i < faces.length; i += 3) [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(i => points[i]), 3));
      geometry.computeVertexNormals();
      return geometry;
    }
    const gable = roofGeometry(false), hip = roofGeometry(true);
    return {
      build(w, d, height, type) {
        const group = new THREE.Group();
        function part(geometry, x, y, z, width, rise, depth, material, turn = 0) {
          const mesh = new THREE.Mesh(geometry, materials[material]);
          mesh.position.set(x, y, z); mesh.scale.set(width, rise, depth); mesh.rotation.y = turn;
          mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
        }
        function body(x, z, width, depth, rise, roofRise, hipped = false, turn = 0) {
          part(cube, x, rise / 2, z, width, rise, depth, 'house', turn);
          part(hipped ? hip : gable, x, rise, z, width * 1.04, roofRise, depth * 1.04, 'castle', turn);
        }
        if (type === 0) {
          group.name = 'Kleines Wohnhaus';
          body(0, 0, w, d, height * .55, w * .42);
        } else if (type === 1) {
          group.name = 'Langes Bauernhaus';
          // Niedriger Scheunenteil am gleichen First, beide als einfache Quader.
          body(0, -d * .19, w, d * .62, height * .6, w * .35, true);
          body(0, d * .31, w * .9, d * .38, height * .42, w * .3, true);
        } else if (type === 2) {
          group.name = 'Hohes Giebelhaus';
          body(0, 0, w * .8, d, height * 1.05, w * .65);
        } else {
          group.name = 'Winkelhaus mit Anbau';
          body(-w * .19, 0, w * .62, d, height * .7, w * .32);
          // Querflügel innerhalb des bestehenden Bauplatzes, offene Ecke bleibt sichtbar.
          body(w * .31, d * .22, d * .56, w * .38, height * .43, w * .24, false, Math.PI / 2);
        }
        return group;
      }
    };
  }
};
