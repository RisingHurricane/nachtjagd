# DESIGN: Nachtjagd (Vision)

Dieses Dokument beschreibt das gesamte Spiel, wie der Besitzer es sich wünscht. Umgesetzt wird in Stufen. `PLAN.md` enthält die Aufgaben der aktuellen Stufe. Wer in einer späteren Stufe arbeitet, schreibt zuerst die Aufgaben dieser Stufe nach dem Muster aus `PLAN.md` auf und lässt sie vom Besitzer bestätigen.

## Beschreibung des Besitzers

Nachtjagd ist ein Ego-Shooter im Browser, allein oder mit bis zu vier Spielern online über Raumcode.

- **Schauplatz:** Ein verschneites Tal im tiefen Winter (Dark Valley) mit Dorf, Wäldern, steinernem Viadukt, Gondel zur Bergstation, See mit Inseln, Schloss auf einem Felsen und einem Tunnelnetz mit stillgelegten Minen.
- **Ziel:** Drei Kristalle finden und dann bis zum Morgengrauen durchhalten.
- **Spielablauf:** Monsterwellen, Punkte, Kopftreffer-Zählung. Start wahlweise bei Wellen, höhere Wellen mit passender Ausrüstung. Am Ende eine Auswertung mit erreichter Welle, erlegten Monstern, Kopftreffern und Punkten.
- **Ausrüstung:** Pistole, Flinte, Gewehr, Panzerfaust, Granaten, Molotows, Taschenlampe und weiteres.
- **Weitere Elemente:** Sachen eintauschen oder upgraden, Durchsuchen, Geländewagen und Lore auf einem Minenschienennetz, Karte, Pause (online läuft die Welt weiter).
- **Technik:** Auflösung in drei Stufen mit automatischer Anpassung, Maus und Tastatur empfohlen, Steuerung auch ohne Maussperre über Pfeiltasten, eigener Soundtrack.

## Ausbaustufen

| Stufe | Inhalt | Aufwand |
| --- | --- | --- |
| 1 (Kern, siehe `PLAN.md`) | Verschneites Tal mit Dorf, Wald, See, Schloss und Tunnel. Pistole, Flinte, Gewehr, Taschenlampe. Monsterwellen, Wächter, drei Kristalle, Morgengrauen. Kopftreffer, Punkte, Auswertung. Räume mit Raumcode, Pause im Einzelspiel | hoch, Ziel dieser Stufe ist ein spielbarer Stand |
| 2 (Ausbau) | Glättung und Vorhersage, Töne und Soundtrack, Granaten und Molotows, Karte, Durchsuchen von Kisten, Tauschen und Upgraden, Start bei gewählter Welle mit passender Ausrüstung, drei Auflösungsstufen mit automatischer Anpassung, Steuerung ohne Maussperre | hoch, mehrere Sitzungen |
| 3 (Welt) | Viadukt, See mit Inseln und Stegen, Gondel zur Bergstation, Tunnelnetz mit Minen und Schienen, Höhenunterschiede | sehr hoch |
| 4 (Fahrzeuge) | Lore auf dem Schienennetz, Geländewagen, Panzerfaust | sehr hoch, größtes technisches Risiko (Fahrphysik im Mehrspielerbetrieb) |

Hinweise für die Planung der späteren Stufen:

- Höhenunterschiede (Fels unter dem Schloss, Gondel, Viadukt, Inseln) sind mit der flachen Kollision aus Stufe 1 nicht umsetzbar. Stufe 3 braucht eine Höhenkarte oder begehbare Ebenen in `level.json`.
- Der Soundtrack ist eigenes Material des Besitzers (Dateien in `public/audio/`, komprimiert und klein halten) oder wird aus einfachen Schwingungen erzeugt.
- Granaten, Molotows und die Panzerfaust sind Flächenschaden mit Radius, das lässt sich auf der Draufsicht-Logik des Servers aufbauen.
- Tauschen und Upgraden braucht ein Inventar und eine Währung (Punkte oder Fundstücke) und ein Menü auf dem Client.

## Referenzbilder

Der Besitzer hat 37 Inspirationsbilder gesammelt. Die Bilder liegen nur auf dem Rechner des Besitzers und sind in diesem öffentlichen Repository nicht enthalten. Palette und Zuordnung unten genügen als Vorlage.

**Stimmung:** Kalte, blaugraue Nacht mit Nebel und Schnee, dunkle Gotik mit spitzen Türmen, dazu warme Lichtpunkte (Laternen, erleuchtete Fenster) als Kontrast. Der Stil liegt nah an Resident Evil Village.

**Farbpalette** (aus den Bildern gemessen, Nacht, Tal und Nebel):

| Verwendung | Farbe |
| --- | --- |
| Tiefste Schatten, Nachthimmel oben | `#0b1116`, `#15222a` |
| Nebel, Himmel am Horizont, Wasser | `#1c323c`, `#335165`, `#303b4f` |
| Berge in der Ferne | `#4f5d75`, `#658195` |
| Heller Nebel, Mondlicht auf Schnee | `#9eb8c4`, `#b4c0cb` |
| Schnee | `#eff0f0` (bei Nacht abgedunkelt) |
| Stein und Mauern | `#2f3131`, `#4e4e4b`, `#596b74`, `#7e868c` |
| Warmer Akzent für Fenster und Lampen | `#e0a050` |

**Zuordnung der Bilder** (Dateinamen wie im Ordner des Besitzers):

| Ort oder Figur | Bilder |
| --- | --- |
| Dorf, Häuser | `village.jpg` (verschneites Dorf, kahle Bäume), `Bebenhausen2.jpg`, `village2.jpg`, `village3.jpg`, `villagestreet.jpg`, `villagestreet2.jpg` (steile Dächer, Fachwerk, Laternen) |
| Dorfkapelle, Ruine als Dekoration | `holmenkollen-chapel-oslo-norway-near-jumping-track-83334102.jpg`, `Friesach_Kirchenruine_Virgilienberg_14042007_01.jpeg` |
| Schloss | `castle.jpg`, `scene.jpg`, `Screenshot 2025-03-27 100243.png` (dunkle Gotik im Nebel), `schloss.jpg`, `castle2.jpg`, `castle3.jpg`, `cochem2.jpg`, `cochem3.jpg`, `free-photo-of-vajdahunyad-castle-in-budapest-hungary.jpeg` (Türme, spitze Dächer, Fels) |
| Tal, Berge, Nebel | `valley.jpg`, `mountains.jpg`, `wald2.jpg` |
| Wald | `wald.jpg` (verschneite Tannen), `wald1.jpg` (moosiger Nebelwald), `wald2.jpg` |
| See | `lake.jpg` (dunkles Grüntürkis unter Nebel) |
| Holzbrücke | `bridgewood.jpg` |
| Viadukt (Stufe 3) | `viadukt.jpg` |
| Gondel (Stufe 3) | `Luftseilbahn_Säntis.jpg` |
| Innenräume (spätere Stufen) | `int.jpg`, `int2.jpg`, `int3.jpg`, `lobby-lounge.jpg`, `Tianjin_railway_station_ceiling_0857.jpg` |
| Läufer | `wolf.jpg` (hagerer, aufrecht laufender Werwolf, grau-braun) |
| Geist (Stufe 2, durchsichtig, bläulich) | `ghost.jpg` |
| Fledermaus (Stufe 2, fliegender Gegner) | `bat.jpg` |

Hinweise: Ein Himmelspanorama im Seitenverhältnis 2:1 ist nicht dabei. Bis eines vorliegt, gibt es einen Farbverlauf aus der Palette und Randberge als Kulisse. `valley.jpg` und `mountains.jpg` eignen sich als Vorlage für die Form und Farbe der Berge.
