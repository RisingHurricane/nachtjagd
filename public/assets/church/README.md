# Eigenständige Nachtjagd-Kirche

Erste ausgearbeitete Modellfassung nach den Kirchenreferenzen: gotische Steinwände, steiles Schieferdach und schlanker, leicht geschwungener Turmhelm mit dunklem Holz. Innen: offener Mittelgang, Bänke, Altar, Rippengewölbe und farbige Bleiverglasung. Die Decke greift die verblassten Blau- und Goldtöne der Freskoreferenz auf; sie enthält kein figuratives Fresko. Alle Materialien sind neu erzeugt. Keine privaten Referenzbilder sind Bestandteil des Pakets.

Fassung 1.1: Turm um 6 m erhöht (Spitze jetzt etwa 35 m über Fußboden). An der Ostseite liegt ein längerer niedriger Kapellenbau, westlich hinten eine kleinere Sakristei. Die beiden Anbauten sind zunächst geschlossene grobe Baukörper mit eigenen Dächern und einfachen Fensterandeutungen; sie besitzen noch keine zugänglichen Innenräume. Ihr verbreiterter Grundriss ist bei Terrain und Außenkollision zu berücksichtigen. Eingang, Mittelgang und ebener Fußboden bleiben an derselben Stelle. Glocke und ihr oberer Anker wurden mit dem Turm angehoben.

## Eingebundene Dateien und Quellen

Seit Entwurf 24 lädt `public/entwurf/imported-models.js` die Kirche in die gemeinsame Welt; `building-site.js` verbindet Gehflächen, Kollision, Terrainanschluss, Siegel und Glockeninteraktion. Die bisherigen Kirchenquader sind entfernt.

Dieses Spielpaket enthält nur GLB, Manifest, Kollisionsdaten und Adapter. Die Blender-Quelle, der Generator und die eigenständige Vorschau bleiben im [Modellbranch codex/church-asset](https://github.com/RisingHurricane/nachtjagd/tree/codex/church-asset). Die folgende Liste beschreibt das vollständige Quellpaket dort:

- `church.glb`: Spielmodell mit eingebetteten Texturen, getrennten Türscharnieren und Glocke. Keine Vorschaukameras oder Beleuchtung enthalten.
- `church.blend`: bearbeitbare Blender-Quelle, zusätzlich mit Vorschaukameras, Bühne und Beleuchtung.
- `church-manifest.json`: Maße, Orientierung, Anschlusspunkte und Türwinkel.
- `church-collision.json`: lokale Kollisionsquader und Gehflächen.
- `church-adapter.js`: optionaler Lader und räumliche Abfragen; importiert keine fremde Three.js-Version.
- `index.html`: getrennte Modellvorschau. Das Spiel wird davon nicht verändert.
- `../../../tools/build-church.py` (vom Repository aus `tools/build-church.py`): reproduzierbarer Modellgenerator, Blender 4.4.

## Einbau für Claude

Quellbranch: `codex/church-asset`, aus `codex/village-layout` abgezweigt. Einbau seit Entwurf 24 auf `codex/village-church-snow`.

Einheit: Meter. GLB: Y oben, Vorderseite +Z. Ursprung: Fußboden am Eingang. Keine weitere Achsendrehung oder Skalierung nötig. Vorgeschlagener Ursprung in der bisherigen Welt: **x=91, z=24.5**, Y einmal vom Vorplatz bei (91,25) abnehmen. Die beiden bisherigen Kirchenquader bei (91,6) und (91,21) erst beim tatsächlichen Einbau entfernen. Die neuen Grundrisse folgen diesen Platzhaltern; der Turmhelm ist höher.

```js
import { loadChurch } from '/assets/church/church-adapter.js';

const church = await loadChurch({
  THREE, GLTFLoader,
  origin: { x: 91, y: churchApproachHeight, z: 24.5 }
});
scene.add(church.root);
// church.anchors.seal, church.anchors.bellInteract: Weltkoordinaten.
// church.floorHeight(x,z): Fußbodenhöhe oder null außerhalb der Gehflächen.
// church.collides({x,y,z}, 0.4, 1.75): y ist die Fußhöhe, nicht die Augenhöhe.
```

Loader, Szene und Materialdarstellung verwenden dieselbe Three.js-Version wie das Spiel. Der Lader unter `vendor/` im Quellbranch gehört ausschließlich zur separaten Vorschau (Three.js r128, MIT).

**Geländeanschluss:** Ein gemeinsames waagerechtes Fundament für Turm und Schiff herstellen. Gelände unter dem Innenraum absenken/aussparen; sonst ragt die bisherige Hanglandschaft in den Innenraum. Die kurze Eingangsrampe fällt nach +Z um 25 cm auf 3 m. Außen den Sockel in das Terrain einbetten; nicht jede Wand einzeln auf die Landschaft setzen. Das Modell enthält keine Umgebung und keine zusätzliche Geländeplatte.

**Kollision:** Quader berücksichtigen ihre Y-Ausdehnung. Der bisherige reine 2D-Blockout-Test kann die hohen Türstürze nicht korrekt verarbeiten. Gehflächen im Gebäude haben Vorrang vor der Terrainhöhe. Fenster über Spielerhöhe sind als feste Wandflächen vereinfacht. Der Mittelgang ist 2,8 m breit, das Portal 2,7 m. Für Bewegung außerdem Strecken unterteilen oder kontinuierlich prüfen, um Durchspringen bei langen Frames zu verhindern.

**Türen:** Beide Flügel stehen standardmäßig offen und sind keine statischen Kollisionsquader. Beim Schließen die benannten Scharniere über absolute lokale Y-Winkel aus dem Manifest setzen und dynamische Türblattkollision ergänzen. Scharnierknoten über die Namen im Manifest suchen, nicht über veränderliche Mesh-Indizes. Die Glocke ist ein separates Mesh `Bell`.

**Interaktion:** `SanctuarySeal` liegt im hinteren Mittelgang; `BellInteract` im Turmvorraum. Eine begehbare Treppe in den Glockenturm ist noch nicht enthalten. Der Glockenanker oben ist für spätere Animationen gedacht. Die Solo-Spielinteraktionen sind seit Entwurf 24 integriert; der ältere separate Mehrspielerserver verwendet dieses Modell noch nicht.

## Neu erzeugen

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.4/blender.exe' -b -t 4 --factory-startup --python tools/build-church.py
```

Der Generator schreibt das GLB, die Blender-Datei, beide JSON-Dateien und zwei Kontrollansichten. Details und Texturen können danach in Blender weiter verfeinert werden. Das ist eine eigenständige erste Spielmodellfassung, noch keine fotorealistische Endfassung.

Für schnelle Änderungen der Außenform `-- --quick` ergänzen: nur die Außenansicht mit reduzierten Render-Einstellungen erneuern. Die bestehende Innenansicht bleibt dabei erhalten.
