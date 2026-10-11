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
        function body(x, z, width, depth, rise, roofRise, hipped = false, turn = 0, base = 0) {
          part(cube, x, base + rise / 2, z, width, rise, depth, 'house', turn);
          part(hipped ? hip : gable, x, base + rise, z, width * 1.08, roofRise, depth * 1.08, 'castle', turn);
        }
        if (type === 0) {
          group.name = 'Kleines Wohnhaus';
          // Sockel, überstehendes Obergeschoss, Vorbau und große Dachgaube.
          part(cube, 0, .35, 0, w * .9, .7, d * .82, 'castle');
          part(cube, 0, height * .25, 0, w * .82, height * .5, d * .76, 'house');
          body(0, 0, w * .94, d * .86, height * .27, w * .76, false, 0, height * .5);
          body(-w * .15, d * .45, w * .36, d * .36, height * .4, w * .29);
          body(w * .43, -d * .06, w * .28, d * .5, height * .33, w * .23);
          body(w * .27, d * .08, d * .3, w * .33, height * .2, w * .22, false, Math.PI / 2, height * .75);
          part(cube, -w * .2, height * 1.04, -d * .19, .8, height * .65, .9, 'castle');
        } else if (type === 1) {
          group.name = 'Langes Bauernhaus';
          // Langhaus mit hohem Walmdach, querstehender Scheune und zwei Gauben.
          body(-w * .12, -d * .12, w * .9, d * .92, height * .7, w * .82, true);
          body(w * .4, d * .31, d * .63, w * .66, height * .47, w * .57, false, Math.PI / 2);
          for (const z of [-d * .22, d * .1]) {
            body(w * .22, z, d * .22, w * .4, height * .2, w * .25, false, Math.PI / 2, height * .84);
          }
          part(cube, -w * .12, .35, -d * .12, w * .94, .7, d * .96, 'castle');
          part(cube, -w * .28, height * 1.15, -d * .32, .85, height * .8, 1, 'castle');
        } else if (type === 2) {
          group.name = 'Hohes Giebelhaus';
          // Hohes Bürgerhaus mit auskragendem Stockwerk, Zwerchgiebel und Erker.
          part(cube, 0, height * .34, -d * .08, w * .66, height * .68, d * .76, 'house');
          body(0, -d * .08, w * .8, d * .88, height * .38, w * .83, false, 0, height * .68);
          body(w * .3, d * .02, d * .5, w * .42, height * .3, w * .43, false, Math.PI / 2, height * .8);
          body(-w * .16, d * .44, w * .4, d * .32, height * .7, w * .4, true);
          body(w * .38, -d * .28, w * .3, d * .34, height * .48, w * .3);
          part(cube, -w * .2, height * 1.32, -d * .26, .75, height * .65, .9, 'castle');
        } else {
          group.name = 'Winkelhaus mit Anbau';
          // Zwei versetzte Flügel, kurzer rückwärtiger Anbau und offene Vorhalle im Winkel.
          body(-w * .2, -d * .07, w * .58, d * .9, height * .83, w * .55);
          body(w * .2, d * .27, d * .49, w * .76, height * .55, w * .44, false, Math.PI / 2);
          body(w * .19, -d * .34, w * .3, d * .34, height * .4, w * .29);
          body(-w * .2, -d * .46, w * .4, d * .25, height * .5, w * .37);
          // Die Halle bleibt als grober Dachkörper auf drei Quaderstützen offen.
          part(hip, w * .05, height * .34, d * .53, w * .46, w * .34, d * .27, 'castle', Math.PI / 2);
          for (const x of [-w * .13, w * .06, w * .25]) part(cube, x, height * .17, d * .61, .32, height * .34, .32, 'house');
          part(cube, -w * .29, height * 1.18, -d * .18, .85, height * .75, 1, 'castle');
        }
        return group;
      }
    };
  }
};
