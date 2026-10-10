# AGENTS.md

Gemeinsame Anleitung für alle KI-Agenten in diesem Repository (Claude Code und Codex). Codex liest diese Datei direkt, Claude Code über `CLAUDE.md`. Änderungen an den Regeln gehören hierher, damit es nur eine Quelle gibt.

## Projekt

Nachtjagd ist ein Ego-Shooter im Browser (Three.js), allein oder mit bis zu 4 Spielern online über Raumcode, und soll auf einer eigenen Domain laufen. Eine Nacht in einem verschneiten Tal: Monsterwellen abwehren, drei Kristalle finden und bis zum Morgengrauen durchhalten. Die gesamte Vision steht in `DESIGN.md`. Spielregeln, Karte, Zielarchitektur und die Aufgabenliste der aktuellen Ausbaustufe stehen in `PLAN.md`. Der Abschnitt Architektur unten beschreibt den aktuellen Stand der Umsetzung (Aufgaben 1 bis 5 aus `PLAN.md` erledigt: Three.js-Ego-Client und Spielwelt aus `level.json`) und wird bei jeder Änderung nachgeführt.

## Architektur

Das Projekt nutzt ES-Module (`"type": "module"` in `package.json`).

Zusätzlich zum folgenden älteren Prototyp liegt der unveränderte Import des neueren Altay-Frontends unter `live/altay.vision/nachtjagd-neu/`. Die getrennte Layout-Studie unter `public/entwurf/index.html` lädt `world-layout.js` (Nutzerskizze, Orte, See, Waldmasken, Grundhöhen) und `blockout.js` (Geometrie, Ansichten, Rundgang und Kollisionen). Norden ist -z: Gebirge im Norden, Burg westlich auf Felssporn, See im Südwesten, ummauertes Bergdorf rechts der Mitte. Die 28 Häuser stehen in versetzten Gruppen und haben vier grobe Volumenformen; 3300 Bäume bestehen aus Stamm und erhöhtem Kegel. Das Höhenmodell mit kleinen Bauplatzglättungen nutzt 5-m-Dreiecke; dieselbe Dreiecksinterpolation setzt Bäume und Gebäudesockel. Straßen und Augenhöhe nutzen das gemeinsame, quer ebene Straßenprofil. 16 geometrische Prüfungen sind unter `?test=terrain` abrufbar. Änderungen am groben Layout dort vornehmen. Der bisherige spielbare Dorfentwurf bleibt als Vergleich unter `public/entwurf/spiel.html`; `node tools/build-village-preview.mjs` erzeugt nur diesen Vergleich neu. Seine Welt liegt im monolithischen HTML, nicht in `public/level.json`; der private Altay-Koop-Backendcode fehlt. Details und Referenzgruppen: `public/entwurf/README.md`.

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

Der See ist nach Südwesten erweitert; zusätzliche Waldflächen, neun Baumgruppen und 3200 niedrige Vegetationskörper beleben den Boden. Die 3300 Bäume behalten mindestens 4 m Kronenfreiheit. `road-layout.js` beschreibt 13 Straßen/Gassen einschließlich zwei Treppenwegen mit zusätzlichen Wald-, See- und Ostschleifen. `road-profile.js` verknüpft Kreuzungen, begrenzt Längsneigungen auf 18 % und hält Fahrbahnquerschnitte waagerecht. Der Boden erhält geglättete Einschnitte und Aufschüttungen; die Brücke bleibt über der Senke. Straßenprofile und Widerlager bleiben beim Modellieren fest, der Pinsel verändert das übrige Gelände. Bauplätze, Ufer, Brücke und Straßen sind standardmäßig geschützt. Tests zusätzlich: `test/roads.test.js`.

`stairs.js` erzeugt aus den als Treppen markierten Straßenabschnitten waagerechte Tritte mit höchstens 20 cm Höhe. Dasselbe Profil setzt die Augenhöhe; `blockout.js` hält Sockel am Gelände und bietet den Rundgang Dorftreppe. Tests zusätzlich in `test/stairs.test.js`. Wald mit größeren Stammabständen und kleineren Kronen aufgelichtet.

## Befehle

Der Gelände-Editor unter `public/entwurf/` nutzt `terrain-editor.js` als unabhängigen Höhenpinsel mit Undo/Redo und validiertem JSON-Dateiformat v2. `blockout.js` hält das feste 321×281-Raster (5 m), aktualisiert Szene und Anker und speichert Änderungen am Strichende lokal im Browser unter `nachtjagd-bergdorf-vorberge-dorf-v4`. Die neue Welt setzt maxHeight=650 für die äußeren Hochgipfel (Editor-Standard bleibt 400 m); Datei-Limit 4 MB. Exporte enthalten die Grundformkennung `world-layout.js:basis`; unpassende Grundformen und ältere Dateien werden ohne Zustandsänderung abgelehnt. Vorheriger Browserstand bleibt unter seinem alten Schlüssel erhalten. Bei inkompatiblen Grundformänderungen Kennung und Speicherschlüssel aktualisieren. Tests: `test/terrain-editor.test.js` und `test/world-layout.test.js`.

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
