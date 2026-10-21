# AGENTS.md

Gemeinsame Anleitung für alle KI-Agenten in diesem Repository (Claude Code und Codex). Codex liest diese Datei direkt, Claude Code über `CLAUDE.md`. Änderungen an den Regeln gehören hierher, damit es nur eine Quelle gibt.

## Projekt

Nachtjagd ist ein Ego-Shooter im Browser (Three.js), allein oder mit bis zu 4 Spielern online über Raumcode, und soll auf einer eigenen Domain laufen. Eine Nacht in einem verschneiten Tal: Monsterwellen abwehren, drei Kristalle finden und bis zum Morgengrauen durchhalten. Die gesamte Vision steht in `DESIGN.md`. Spielregeln, Karte, Zielarchitektur und die Aufgabenliste der aktuellen Ausbaustufe stehen in `PLAN.md`. Der Abschnitt Architektur unten beschreibt den aktuellen Stand der Umsetzung (Aufgaben 1 bis 5 aus `PLAN.md` erledigt: Three.js-Ego-Client und Spielwelt aus `level.json`) und wird bei jeder Änderung nachgeführt.

## Architektur

Das Projekt nutzt ES-Module (`"type": "module"` in `package.json`).

Aktueller Entwicklungsstand Entwurf 26 (`codex/world-playability`, Basis Entwurf 25): Das Dorf hat ein zusammenhängendes sanftes Gefälle und zwei kurze, geknickte Gassen statt dreier paralleler Durchgangsstraßen. Grundform `bergdorf-minen-2026-10-12-v9` verwendet einen neuen Browser-Speicherschlüssel; alte Geländedateien bleiben erhalten. `mine-tunnels.js` liefert zwei absteigende Hauptgänge mit je zwei Seitenkammern, Gehflächen, Decken, Kollision, Terrainöffnungen und einem Pool aus zwei Lampen. Nur die Mündungen erhalten fein geschnittenes Gelände. Das Westminen-Siegel liegt unter Tage. Der optionale Weltvertrag `ceiling(x,z,feet)` begrenzt Sprünge und Fluggegner. `village-wall.js` ersetzt die Mauerquader durch Wehrgänge, Brüstungen und vier offene Treppenanschlüsse; Tore und bestehende Unterbrechungen bleiben frei. `world-layout.js` definiert die feste Gondeltrasse; Stationen und Baumfreiheit beziehen sich auf dieselbe Linie. `terrain-ray.js` prüft Schuss-/Sichtstrahlen gegen exakte Höhenraster-Dreiecke entlang des Strahls statt die ganze Boden-Geometrie. Häuser und Mauer haben räumliche Abfrage-Raster; Baumhöhen werden nur bei Geländeänderungen berechnet, im undurchsichtigen Nebel ausgesparte Fernbäume behalten ihre Modelle. `E` wird einmal pro Druck im nächsten Spielschritt verarbeitet; Mausbewegungen erzeugen keinen vollständigen Spielzustands-Snapshot. Mehr Gegner pro Welle, dichterer Schnee/Nebel, dekorierte Laternen sowie stärkere Burgfenster und Innenlichter sind integriert. Geometrie-/Physiktests liegen in `test/`; ein zusätzlicher langsamer Vollwelt-Lauf mit Renderer-/Asset-Stubs liegt unter `tools/check-world-headless.mjs`. Er ersetzt keine visuelle Browserprüfung oder FPS-Messung. Nur `public/entwurf/` ist der gemeinsame Spielpfad; Entwurf 26 ist nach Lights Freigabe seit 2026-10-12 unter /nachtjagd/entwurf/?v=26 veröffentlicht (gh-pages 85eff13).

Zusätzlich zum folgenden älteren Prototyp liegt der unveränderte Import des neueren Altay-Frontends unter `live/altay.vision/nachtjagd-neu/`. Die getrennte Layout-Studie unter `public/entwurf/index.html` lädt `world-layout.js` (Nutzerskizze, Orte, See, Waldmasken, Grundhöhen) und `blockout.js` (Geometrie, Ansichten, Rundgang und Kollisionen). Norden ist -z: Gebirge im Norden, Burg westlich auf Felssporn, See im Südwesten, ummauertes Bergdorf rechts der Mitte. Die 28 Häuser stehen in versetzten Gruppen und verwenden vier begehbare Hausmodelle; Alle 3383 Bäume einschließlich der drei Seeinselbäume nutzen acht importierte Varianten in jeder Entfernung. Instanzen teilen Geometrie/Materialien; 95 m begrenzen nur Schatten, entfernte Instanzen außerhalb des Kamerablicks werden ausgelassen. Spielstart wartet auf Baummodelle. Das Höhenmodell mit kleinen Bauplatzglättungen nutzt 5-m-Dreiecke; dieselbe Dreiecksinterpolation setzt Bäume und Gebäudesockel. Straßen und Augenhöhe nutzen das gemeinsame, quer ebene Straßenprofil. 22 geometrische Prüfungen sind unter `?test=terrain` abrufbar. Änderungen am groben Layout dort vornehmen. Der bisherige spielbare Dorfentwurf bleibt als Vergleich unter `public/entwurf/spiel.html`; `node tools/build-village-preview.mjs` erzeugt nur diesen Vergleich neu. Seine Welt liegt im monolithischen HTML, nicht in `public/level.json`; der private Altay-Koop-Backendcode fehlt. Details und Referenzgruppen: `public/entwurf/README.md`.

- `server.js`: Node.js-Server. Liefert den Ordner `public/` per HTTP aus und nimmt WebSocket-Verbindungen an (Bibliothek `ws`). Er liest `public/level.json` beim Start, ruft `game.step()` etwa 30-mal pro Sekunde auf und schickt `game.snapshot()` an alle Clients. Der Server ist autoritativ: Clients senden nur Eingaben.
- `game.js`: Spielzustand, Bewegung und Kollision ohne Netzwerk. Exporte: `parseLevel(text)` und `createGame(level)`. Das Spiel hat `addPlayer`, `removePlayer`, `setName`, `setInput`, `step(dt)`, `snapshot()` und `world`. Höchstens 4 Spieler (`MAX_PLAYERS`). Spieler sind Kreise mit 0,5 m Radius. Häuser und Mauern sind Rechtecke, Bäume, Türme und der Brunnen Kreise, der See ist nicht betretbar. Bewegung in x und z getrennt, damit Spieler an Wänden entlanggleiten. Kartenrand bei ±98.
- `public/level.json`: die Karte (Format siehe `PLAN.md`, Abschnitt Spielwelt). Server und Client lesen dieselbe Datei.
- `public/index.html`: Seite mit Namensfeld, Statuszeile, Canvas und Import-Map für Three.js (CDN, Version 0.170.0). Lädt `main.js` als Modul. Kein Build-Schritt.
- `public/main.js`: Client. Verbindung, Eingabe (WASD, Maus mit Pointer Lock, Pfeiltasten), Ego-Kamera auf 1,7 m Höhe, andere Spieler als Kapseln mit Namensschild. Sendet `input` höchstens 20-mal pro Sekunde, nur bei Änderungen. Lädt `level.json` und übergibt es an `world.js`. Die Positionen werden geglättet, Sprünge über 5 m werden direkt gesetzt.
- `public/world.js`: baut aus `level.json` die Three.js-Szene (`buildWorld(level)`): Boden, Häuser mit Satteldach und Schneehaube, Schloss mit Felsring, Türmen und Bergfried, Brunnen, See, Bootshaus, Tunnel mit Dach, Stützen und Lore, Bäume und Felsen als Instanzen, Berge als Kulisse. Farben aus der Palette in `DESIGN.md`.
- `test/game.test.js`: Tests für `game.js` ohne Netzwerk (Bewegung, Kollision mit echtem Level).
- `test/server.test.js`: Tests für Server und Protokoll mit dem eingebauten Node-Testrunner.

### Nachrichtenprotokoll (JSON über WebSocket)

| Richtung | Typ | Inhalt |
| --- | --- | --- |
| Server an Client | `welcome` | `id` des Spielers, `world` mit `width` und `height` (Kartengröße, 200) |
| Server an Client | `state` | `players`: Liste mit `id`, `name`, `color`, `x`, `z`, `yaw`, `hp`, `ammo`, `score`, `alive` |
| Client an Server | `input` | `mx`, `mz` (je -1 bis 1, relativ zur Blickrichtung, `mz` nach vorn), `yaw` (Radiant), `pitch` (Radiant, vom Server noch nicht gelesen), `fire` (true/false, vom Server noch nicht ausgewertet bis Aufgabe 8) |
| Client an Server | `name` | `name` als Text, höchstens 16 Zeichen |

Der WebSocket-Endpunkt akzeptiert jeden Pfad. Der Client verbindet sich relativ zur aktuellen Seite mit `ws` bzw. `wss` auf `<Seitenpfad>/ws`, deshalb funktioniert er auch hinter einem Reverse Proxy mit Unterpfad.

Das siebenbogige Viadukt auf der Burgverbindung nutzt `viaduct.js` für gemeinsames Fahrbahnprofil und Kollisionen (Brüstungen/Pfeiler, Durchgang unter Bögen). `blockout.js` erzeugt Extrusionsgeometrie und aktualisiert sie bei Geländeänderungen. Ein weicher mittelhoher Gebirgsring und eine separate äußere Reihe schroffer Hochgipfel umschließen die hügelige Hochebene. Unebene Vorberge füllen den Bereich nördlich des Dorfs; ein breiter Ufersaum hält die ersten 30 m am See flach. Tests zusätzlich in `test/viaduct.test.js`. Die sichtbare Versionskennung und alle Skript-Versionszusätze in `index.html` bei jeder Veröffentlichung gemeinsam erhöhen.

Der See ist nach Südwesten erweitert; zusätzliche Waldflächen, neun Baumgruppen und 3200 niedrige Vegetationskörper und 96 höhere Buschformen beleben den Boden. Die 3380 Bäume behalten mindestens 4 m Kronenfreiheit. `road-layout.js` beschreibt 18 Straßen/Gassen einschließlich zwei Treppenwegen mit zusätzlichen Wald-, See- und Ostschleifen. `road-profile.js` verknüpft Kreuzungen, begrenzt Längsneigungen auf 18 % und hält Fahrbahnquerschnitte waagerecht. Der Boden erhält geglättete Einschnitte und Aufschüttungen; die Brücke bleibt über der Senke. Straßenprofile und Widerlager bleiben beim Modellieren fest, der Pinsel verändert das übrige Gelände. Bauplätze, Ufer, Brücke und Straßen sind standardmäßig geschützt. Tests zusätzlich: `test/roads.test.js`.

`stairs.js` erzeugt aus den als Treppen markierten Straßenabschnitten waagerechte Tritte mit höchstens 20 cm Höhe. Dasselbe Profil setzt die Augenhöhe; `blockout.js` hält Sockel am Gelände und bietet den Rundgang Dorftreppe. Tests zusätzlich in `test/stairs.test.js`. Wald mit größeren Stammabständen und kleineren Kronen aufgelichtet.

Beide Bergtypen besitzen reproduzierbar unterschiedliche Gipfelhöhen, Fußabdrücke, Positionen und Ausrichtungen; die Definitionen middlePeaks/highPeaks liegen außerhalb der Höhenfunktion. Sieben Hangbereiche in foothillGroups tragen 140 Bäume unter 110 m; sechs ridgeGroups tragen 140 weitere Bäume unter 155 m an den aufgefüllten Sätteln. Beide verwenden Hänge unter 70 % Neigung. Ein gewellter Geländerücken verbindet die Bergreihen, ohne die Viaduktsenke anzuheben. Drei elliptische Lichtungen und ein Ziel von 3100 Bäumen im Hauptwald gleichen die Ergänzung aus. villageOutline/villageWalls/villageGates und villageDistance teilen die unregelmäßige Dorfkontur zwischen Mauer, Toröffnungen und Waldkante. Drei zusätzliche Mauerabschnitte bleiben bewusst offen. Tests und Browserprüfung erfassen Kontur, freie Wege, Lichtungen und Sättel.

landmarks.js baut die groben Entdeckungsorte aus world-layout.js: Holzwindmühle, zehnteiliger Steinkreis, Klosterruine mit offenem Hof und Kapellenresten, vier eng gruppierte Seehäuser mit Steg und eine Geländeinsel mit drei separat verankerten Bäumen sowie Ortsbeschriftungen der beiden Minen; mine-tunnels.js baut seit Entwurf 26 deren unterirdische Gänge. Fünf neue Zugangswege sind Teil von road-layout.js. Alle soliden Bauteile verwenden dieselbe Anker- und Kollisionsfunktion wie Dorfhäuser. Der Seesteg ergänzt surfaceHeight und die Wasserprüfung. Das Menü Neue Orte enthält sechs Ansichten; Nahansichten blenden die großen Ortsbeschriftungen aus. Die aktuelle Grundform heißt bergdorf-minen-2026-10-12-v9. Die beiden Minen sind noch nicht miteinander verbunden.

Die vier Hausmodelle unter `public/entwurf/haeuser.html` sind seit Entwurf 24 an allen 28 Dorfplätzen eingebaut. `village-houses.js` baut Wände mit Öffnungen, Geschossplatten mit Treppenlöchern, Satteldächer und Mobiliar. Vertrag: Meter, Ursprung am Gelände, Vorderseite +z; `NachtjagdVillageHouses.create(THREE, materials).build(w,d,height,type)` liefert eine Group mit `userData.house`. Dort stehen `plan`, `entries`, `rooms`, `surfaces`, `solids`, `walk.floor(x,z,feet)`, `walk.blocked(x,z,feet,radius)` und `walk.move(position,dx,dz)` in lokalen Koordinaten. `building-site.js` transformiert Punkte, Gehflächen und Kollision in die Welt, ergänzt Sockel/Außentreppen und bündelt statische Netze nach Material. Bauplatzhöhen folgen den vorhandenen Straßen; das Gelände erhält zusammenhängende Hangübergänge und bleibt unter den Fußböden. Beide Türen, Außentreppen und obere Etagen jeder Weltplatzierung werden unter `?test=terrain` mit der Spielfigur durchlaufen. Die Kirche unter `public/assets/church/` kommt durch `imported-models.js` an (91,24.5) in dieselbe Welt; ihr Adapter liefert höhenabhängige Kollision und Gehflächen. Siegel und Glockeninteraktion liegen innen. Zwei geteilte Innenlampen beleuchten Häuser/Kirche nach Nähe. `setView('outside'|'ground'|'upper'|'top')` dient ausschließlich der separaten Vorschau. Alle Türen sind vorerst dauerhaft offen. Tests in `test/village-houses.test.js` prüfen beide Zugänge, Möbel-/Wandkollisionen, Geländer, Auf-/Abstieg und Erreichbarkeit aller Räume vom Haupteingang.

Nachtlicht (Entwurf 27): `lamp-field.js` hält alle Lampen (Fenster, Türlaternen, Laternen, Fackeln) und speist die acht nächsten in den Shader aller beleuchteten Materialien ein (`patchScene` alle 1,5 s in `blockout.js`, neue Materialien werden dabei erfasst), dazu Lichthöfe und Fackelflammen. Neue Lichtquellen bitte über `lampField.add({x,y,z,r,c,k,halo,a,fire,flick,shade,kind})` statt echter Three.js-Lichter anlegen. `night-fx.js` liefert Schneefall und Lampenkegel, `post-fx.js` die Nachbearbeitung (`?nopost` schaltet sie ab). Tests: `test/night-lights.test.js`.

## Befehle

`outdoor-details.js` ergänzt die gemeinsamen Weltansichten um instanzierte Laternen/Fenster, drei schattenlose Nahlichter und den groben Wachturm am Osttor. `refresh()` führt Geländeänderungen nach, `update(camera,night,indoor)` wählt die nächsten Lichtquellen. Die Hausstudien bleiben als Modellvorschau; im Spiel ersetzen ihre Modelle die Dorfquader. Deren alte Fensterandeutungen sind deaktiviert. Baukörper in `blockout.js` werden nach Material/Schattenverhalten instanziert; die unsichtbaren Originalnetze bleiben als Geländeanker und Schussziele erhalten. Nach einer Geländeänderung `updateBoxBatches()` aufrufen. `?perf=1` blendet Renderzahlen und echte Bildzeiten ein; Schatten werden begrenzt aktualisiert. Tests der Außenbeleuchtung stehen in `test/outdoor-details.test.js`.

Der Gelände-Editor unter `public/entwurf/` nutzt `terrain-editor.js` als unabhängigen Höhenpinsel mit Undo/Redo und validiertem JSON-Dateiformat v2. `blockout.js` hält das feste 321×281-Raster (5 m), aktualisiert Szene und Anker und speichert Änderungen am Strichende lokal im Browser unter `nachtjagd-bergdorf-minen-v9`. Die neue Welt setzt maxHeight=650 für die äußeren Hochgipfel (Editor-Standard bleibt 400 m); Datei-Limit 4 MB. Exporte enthalten die Grundformkennung `world-layout.js:basis`; unpassende Grundformen und ältere Dateien werden ohne Zustandsänderung abgelehnt. Vorheriger Browserstand bleibt unter seinem alten Schlüssel erhalten. Bei inkompatiblen Grundformänderungen Kennung und Speicherschlüssel aktualisieren. Tests: `test/terrain-editor.test.js` und `test/world-layout.test.js`.

- `npm install`: Abhängigkeiten installieren
- `npm start`: Server starten (Port 3000, änderbar mit der Umgebungsvariable `PORT`)
- `npm test`: Tests ausführen

Benötigt wird Node.js ab Version 20.

## Regeln für den Code

- Der Server prüft jede Eingabe von Clients (Typ, Wertebereich, Nachrichtengröße). Clients gelten als nicht vertrauenswürdig.
- Neue Abhängigkeiten sparsam einsetzen und kurz in `STATUS.md` begründen.
- Bei Änderungen an Protokoll oder Spiellogik die Tests anpassen oder ergänzen. `npm test` muss vor jedem Push grün sein.
- Stil: `'use strict'`, zwei Leerzeichen Einrückung, Semikolons, Kommentare auf Deutsch, Bezeichner auf Englisch.
- Keine Geheimnisse (Zugangsdaten, Schlüssel) committen. `.env` ist in `.gitignore` eingetragen.

## Zusammenarbeit zwischen den Agenten

1. Sitzungsbeginn: `git pull` ausführen und `STATUS.md` lesen.
2. Eigenen Branch anlegen, nach dem Muster `claude/<thema>` oder `codex/<thema>`. Nicht direkt auf `main` arbeiten.
3. Kleine, abgeschlossene Aufgaben bearbeiten und häufig committen. Das senkt die Gefahr von Merge-Konflikten.
4. Vor dem Abschluss `npm test` ausführen.
5. Branch nach `main` mergen, wenn die Tests grün sind und `git pull` keine Konflikte gezeigt hat. Bei Konflikten die Situation in `STATUS.md` beschreiben und die Entscheidung dem Besitzer des Repositorys überlassen.
6. Sitzungsende: `STATUS.md` aktualisieren (Stand, nächste Schritte, offene Fragen, ein Eintrag im Übergabe-Log), committen und pushen. Der Agent, der danach weiterarbeitet, startet mit diesem Stand.

## Deployment

Geplant ist Render (Web Service, Region Frankfurt) mit der Subdomain `spiel.altay.vision`. Die Konfiguration steht in `render.yaml`, die Gesundheitsprüfung läuft über `/healthz`. Render baut bei jedem Push auf `main` automatisch neu. Die Domain `altay.vision` liegt bei Dynadot. Dort zeigt ein CNAME-Eintrag für den Host `spiel` auf die Adresse, die Render beim Hinzufügen der Domain anzeigt.

Der kostenlose Render-Plan pausiert den Dienst nach 15 Minuten ohne Verkehr, der Neustart dauert etwa eine Minute. Für den Dauerbetrieb ist ein bezahlter Plan nötig. Der Dienst ist bei Render erst angelegt, wenn `STATUS.md` das ausdrücklich vermerkt.

Der Server läuft auch hinter einem Reverse Proxy unter einem Unterpfad (Caddy oder nginx entfernen den Pfadpräfix und leiten WebSocket-Verbindungen weiter). Das wird nur gebraucht, falls das Spiel unter `altay.vision/spiel` statt unter einer Subdomain erscheinen soll.

### Erste Spiellogik-Verknüpfung (Entwurf 13)

gameplay-core.js enthält einen rendererunabhängigen Solo-Kern nach den Waffen-, Boden-Gegner-, Wellen- und Questregeln aus dem neuesten Altay-Import. gameplay.js verbindet Eingabe, HUD, Gegnerplatzhalter, Beute und Siegel mit der Szene. blockout.js liefert Höhen, Kollisionen, Strahlabfragen auf echte Geometrie und Straßen-Navigation. Start über Spiel starten; Pause/Neustart und Rückkehr zum Layout. Keine Online-Verbindung in diesem Kern. Drei Siegel liegen vor Kirche, in der Westmine und im Burghof; die Glocke ist vorläufig vor der Kirche. Erste/zweitens gesammelte Siegel schalten Schrotflinte/Jagdgewehr frei. Dies ist eine bewusste Layoutanpassung, kein vollständiger Port: Spezialgegner, Händler, Relikte, Wetter, Fahrzeuge und Minentunnel fehlen noch. Neun Kerntests; zusätzliche Weltadapterprüfungen in #game-tests unter ?test=terrain. Vollständige Übergabe in CLAUDE-HANDOFF.md.

Burg im Spiel: `public/models/` enthält die Burgmodelle (`kit.js`, `castle.js`, `castle-interior.js`, Vertrag in der Kopfzeile von `castle.js`). `public/entwurf/castle-site.js` lädt sie per `import()`, setzt sie auf den Felssporn (Ursprung -264/-96, Drehung π/2), fasst Netze je Material zusammen und schaltet Innenraum und vier Lichter nach Nähe. `public/entwurf/castle-walk.js` ist die netzfreie Begehbarkeit (Türen, Rittersaal, Treppe zur Bibliothek, Wendeltreppe im Hauptturm); Tests in `test/castle-walk.test.js`. Änderungen an Türen oder Treppen im Modell müssen dort nachgeführt werden.

### Spielelogik Stufe 2 (Entwurf 14)

`gameplay-core.js` deckt nun Spezialgegner, Luftgegner, Granaten, Molotows, Axt, Sprung, Händler, Schmied, Bildstöcke, Angelstellen, Notizen, Relikte, Wetter und Siegelwächter ab; Weltadapter-Teile dafür (`objectives[].guard`, `loots`, `merchant`, `smith`, `shrines`, `fishSpots`, `waterDepth`) sind optional. `play-spots.js` erzeugt diese Orte aus dem Layout. Tests: `test/gameplay-mechanics.test.js`. Fahrzeuge, Minentunnel und Koop fehlen. Details in `STATUS.md`.

Fahrzeuge: `vehicles.js` (Physik, Fahrpläne), Anbindung in `gameplay-core.js` (Einsteigen, Sitze, Rammen), Platzhaltermodelle und Austauschpunkt in `vehicle-models.js`, Orte in `play-spots.js`. Die Welt liefert optional `jeeps`, `boats`, `rails`, `carts`, `gondola`, `waterLevel`, `boatOk`, `onRoad`. Tests: `test/vehicles.test.js`.
