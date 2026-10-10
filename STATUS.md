# STATUS

Letzte Aktualisierung: 2026-10-10 (Codex, grober Weltentwurf auf Basis von `nachtjagd-neu`)

## Aktueller grober Weltentwurf

- Entwurf 06: Der bisherige Gebirgsring besteht nun aus weicheren Mittelbergen (rund 110–165 m). Eine eigene äußere Reihe von 24 schroffen Hochgipfeln (rund 290–420 m) umschließt ihn. Unebene Vorberge füllen die Senke nördlich des Dorfhügels. Die äußere Geländegrundfläche ist auf 1600×1400 m erweitert, bei weiterhin 5 m Rasterweite.
- Wald auf 3300 statt 4800 Bäume reduziert, größere Stammabstände, kleinere Kronen und ungleichmäßige Dichte; Baumgruppen und niedriger Waldbewuchs bleiben. Kronenfreiheit mindestens 4 m, nur Stämme kollidieren.
- 28 Häuser mit vier groben Volumenformen in versetzten Gruppen, unterschiedlichen Abständen und Drehungen. Kleine Höfe und zwei begehbare Treppenwege statt gleichmäßiger Hauszeilen. Rundgang Dorftreppe ergänzt. Treppen besitzen waagerechte Trittflächen mit höchstens 20 cm Stufenhöhe und gemeinsamer Geometrie/Augenhöhe aus stairs.js.
- Die 13 Straßen/Gassen einschließlich Treppen nutzen road-layout.js und road-profile.js: waagerechte Querschnitte, gemeinsame Kreuzungshöhen, maximal 18 % Längsneigung. Straßenprofile und Viaduktanschlüsse bleiben beim Modellieren fest; Gebäude, Vegetation und Treppensockel schließen an das bearbeitete Gelände an.
- Nutzerskizze bleibt Grundlage: Norden ist -z, Burg westlich auf freiem Felssporn, See im Südwesten, ummauertes Hangdorf rechts der Mitte. Großer Südwestsee mit sanftem Ufersaum, siebenbogiges Viadukt, drei Dorftore und Wegschleifen bleiben erhalten.
- Neue Grundform bergdorf-vorberge-dorf-2026-10-10-v4, Browser-Schlüssel nachtjagd-bergdorf-vorberge-dorf-v4, Raster 321×281. Vorherige Browserstände bleiben erhalten; Dateien anderer Grundformen werden ohne Zustandsänderung abgewiesen. Gelände-Editor mit Pinsel, Undo/Redo und Datei-Sicherung bleibt verfügbar.
- Validierung: 64 automatisierte Tests (35 Server/Client, neun Editor, neun Weltlayout, fünf Straßen, vier Viadukt, zwei Treppen) und 16 geometrische Browserprüfungen bestanden. Treppenbewegung sichtbar geprüft; Höhenpinsel, Undo/Redo und Wiederherstellung nach Reload auf dem vergrößerten Gelände geprüft. Lokale Teständerungen zurückgesetzt. Keine neue Abhängigkeit.
- Aktuelle Vorschau: https://risinghurricane.github.io/nachtjagd/entwurf/?v=06 . Versionskennung und Skriptadressen gemeinsam aktualisiert. Die Layoutstudie enthält noch keinen Kampf/Koop; Multiplayer für 1–4, endgültige Modelle und Schlossinnenräume bleiben spätere Schritte. Originalimport und spielbarer Vergleich erhalten, keine privaten Referenzbilder veröffentlicht. main unverändert.

### Bisheriger spielbarer Vergleich

- `public/entwurf/spiel.html` ist eine separate, allein spielbare Vorschau des neuesten Live-Frontends. Kleinerer Dorfplatz, engere Marktstraße, Kirchgasse mit fünf ergänzten Häusern, steilere variierte Dächer, Gauben und feinere Gebäudekonturen. Neun vorhandene Häuser wurden umgestellt.
- `tools/build-village-preview.mjs` erzeugt den Entwurf aus dem unveränderten Import in `live/`. Lokale Grafikdateien und relative Assetpfade erlauben die statische Vorschau auch auf GitHub Pages. Keine Referenzfotos oder MP3-Dateien hochgeladen.
- Hausrotationen, Eingänge, Innenräume und Hofdetails stimmen überein. Alle 21 Bewegungsprüfungen im Browser bestanden: drei Straßenverbindungen und alle 18 Häuser mit Eingang und Treppe. Sichtprüfung von Platz und Übersicht; JavaScript-Syntax geprüft. Die 35 vorhandenen Tests für den älteren Repository-Server/Client sind ebenfalls grün (mit erlaubtem lokalen Netzwerkzugriff).
- Vorschau unter `https://risinghurricane.github.io/nachtjagd/entwurf/` veröffentlicht und im Browser geprüft. Dorfplatz, Übersicht und friedlicher Rundgang sind über die Leiste unten links erreichbar.
- Online-Koop ist in diesem Entwurf nicht verbunden; der öffentliche Import enthält den privaten Altay-Backendcode nicht. Die bestehende Altay-Version bleibt unverändert. Der spätere gemeinsame Spielstand braucht dieselbe Weltversion für alle Teilnehmer.
- Referenzen getrennt behandeln: Dorf, Wald, Burg/Schloss außen, Gesamtstimmung/Tal sowie Schlossräume. Bisher hauptsächlich Dorfkern überarbeitet; Bergkulisse, Monster, Wald und Schlossräume sind noch der bisherige Stand.
- Änderungen gesichert in PR #1 (`codex/village-layout` gegen `main`). Automatische Freigabe hat die Übernahme in `main` ohne ausdrückliche Zustimmung abgelehnt; kein Merge erfolgt. Die separat veröffentlichte Vorschau funktioniert unabhängig davon.
- Als Nächstes: räumliches Feedback zum Dorf einarbeiten, anschließend die übrigen Bereiche einzeln nach ihren eigenen Referenzen gestalten.

Der folgende frühere Stand beschreibt den separaten Prototyp unter `public/` und dessen Server, nicht das neuere monolithische Live-Spiel.

## Stand

- Das Spiel heißt Nachtjagd (Ego-Shooter, allein oder bis zu 4 Spieler über Raumcode, Schauplatz Dark Valley). `DESIGN.md` beschreibt die gesamte Vision in vier Ausbaustufen. `PLAN.md` enthält Stufe 1 (Kern) mit 15 Aufgaben.
- Aufgaben 1 bis 5 aus `PLAN.md` sind umgesetzt: ES-Module, `game.js` (Spiellogik ohne Netzwerk), `public/level.json` mit Kollision, Three.js-Ego-Client (`public/main.js`, Kamera, Eingabe, Spieler als Kapseln) und die Spielwelt aus `level.json` (`public/world.js`). `npm test` ist grün (30 Tests).
- Die Welt ist Optik nach Palette, aber noch ohne Nachtstimmung. Dächer, Tunnelende und die nördlichen Berge wirken in der Nacht sehr dunkel. Das ändert Aufgabe 6.
- Der Server speichert `pitch` noch nicht. `fire` wird nur als Flag gespeichert und nicht ausgewertet. Beides kommt mit Aufgabe 8. Der Client schickt beides schon.
- Der Client lädt `level.json` selbst per `fetch`. Das Protokoll sieht vor, dass `welcome` das Level enthält (`level`). Das ist noch nicht umgesetzt und wird mit Aufgabe 12 ohnehin überarbeitet.
- Deployment vorbereitet: `render.yaml` und die Gesundheitsprüfung `/healthz` liegen im Repository. Der Dienst selbst ist bei Render noch nicht angelegt.
- Domain: `altay.vision` (Dynadot).

## Nächste Schritte

1. Aufgaben aus `PLAN.md` der Reihe nach umsetzen, mit Haiku, je Sitzung zwei bis drei Aufgaben. Als Nächstes Aufgabe 6 (Nachtstimmung, Schnee, Taschenlampe, Fotos).
2. Der Besitzer legt bei Render ein Konto an, verbindet das GitHub-Repository und erstellt den Dienst aus `render.yaml` (Blueprint), damit sich jeder Stand im Browser testen lässt.
3. Optional: Der Besitzer legt verkleinerte Fotos (unter 500 KB) als Texturen in `public/textures/` ab (`sky.jpg`, `ground.jpg`, `rock.jpg`, `wood.jpg`). Ein Himmelspanorama (Seitenverhältnis 2:1) fehlt in den Referenzbildern, bis dahin gibt es einen Farbverlauf.
4. Ein Browsertest mit echtem CDN ist noch offen. In der Umgebung des Agenten liefert das CDN 403, deshalb lief der Test mit lokal installiertem Three.js 0.170.0 (siehe Übergabe-Log).

## Offene Fragen

- Adresse: Subdomain `spiel.altay.vision` (einfach, CNAME bei Dynadot) oder Unterpfad `altay.vision/nachtjagd` (braucht einen Reverse Proxy auf dem Server der Hauptseite).
- Reicht der kostenlose Render-Plan (Pause nach 15 Minuten Leerlauf, etwa eine Minute Startzeit) oder soll ein bezahlter Plan genommen werden?
- Wann und wie werden die Stufen 2 bis 4 aus `DESIGN.md` angegangen? Sie umfassen mehrere Wochen Arbeit.
- Sollen Spieler einander blockieren? `PLAN.md` regelt das nicht. Bisher gehen Spieler durcheinander, nur Hindernisse aus dem Level blockieren.
- Holz (`#5b4636`), Dachschnee und die Bergfarben liegen nicht genau in der Palette aus `DESIGN.md`, weil die Palette keine Holztöne enthält. Der Besitzer kann das ändern.
- Die Berge am Kartenrand ragen stellenweise ein Stück auf die Karte hinein (Kulisse). Das lässt sich verschieben, wenn es stört.

## Übergabe-Log

- 2026-10-10, Codex: Entwurf 04 mit begehbarem siebenbogigem Viadukt, Gebirgsring, stärkerem Hügelrelief und sanftem Seeufer. Versionskennung und versionierte Skriptadressen ergänzt. 54 Tests und zwölf geometrische Browserprüfungen bestanden.

- 2026-10-10, Codex: Nutzerskizze als neuen Weltblockout umgesetzt: Nordgebirge, westlicher Burgsporn, südwestlicher See, ummauertes Hangdorf und dichter unterlaufbarer Wald. Grundformkennung für Geländedateien ergänzt. 47 Tests und zehn geometrische Browserprüfungen bestanden. Keine neue Abhängigkeit.

- 2026-10-10, Codex: Gelände-Editor für das Bergdorf ergänzt. Sieben Editor-Tests und Browserprüfung von Pinsel, Verlauf, lokaler Wiederherstellung und Datei-Export/-Import bestanden. Weltumstellung wartet auf angekündigte Nutzerskizze.

- 2026-10-10, Codex: Auf Nutzerhinweis das flache Gelände durch eine grobe Talform ersetzt. Ansteigende Wege, See im Becken, Burgplateau und höhenabhängige Bewegung ergänzt. Sechs geometrische Browserprüfungen und 35 Repository-Tests bestanden. Modelle bleiben Quader und Kegel.

- 2026-10-10, Codex: Standardvorschau auf Wunsch auf groben Blockout umgestellt; bisheriges Spiel als Vergleich erhalten. Ansichten und Dorfbewegung im Browser geprüft, 35 Repository-Tests grün. Keine neue Abhängigkeit, kein Merge nach main.

- 2026-10-10, Codex: Dorfentwurf 01 aus `nachtjagd-neu` gebaut, getrennt unter `/entwurf/` auf GitHub Pages veröffentlicht und im Browser geprüft. 21/21 Bewegungsprüfungen und 35/35 vorhandene Repository-Tests bestanden. Eigene Referenzen je Bereich dokumentiert; keine privaten Referenzfotos veröffentlicht. Online-Koop im Entwurf noch nicht angebunden.

- 2026-10-10, Claude Code: Grundgerüst erstellt (Server, Client, Tests, Anleitungen).
- 2026-10-10, Claude Code: Deployment für Render vorbereitet (`render.yaml`, `/healthz`, Test, Anleitung). Dienst bei Render noch nicht angelegt.
- 2026-10-10, Claude Code: Spielkonzept Nachtjagd festgelegt, Vision in `DESIGN.md`, Stufe 1 in `PLAN.md`.
- 2026-10-10, Claude Code: 37 Referenzbilder des Besitzers gesichtet. Palette, Zuordnung zu Orten und Monstern in `DESIGN.md`, Moodboards in `referenz/`, `PLAN.md` darauf abgestimmt. `mountains 2.avif` wurde nicht verarbeitet.
- 2026-10-10, Claude Haiku: Aufgaben 1 bis 3 aus `PLAN.md` umgesetzt, je ein Commit (ES-Module, `game.js`, `public/level.json` mit Kollision). `npm test` grün (26 Tests). Level-Generator für Bäume und Felsen nur einmal genutzt, nicht im Repository. Keine neuen Abhängigkeiten.
- 2026-10-10, Claude Haiku (Branch `claude/haiku-stufe1-b`): Aufgabe 4 (Three.js-Ego-Client) und Aufgabe 5 (Spielwelt aus `level.json`) umgesetzt, je ein Commit. Getestet: `npm test` grün (30 Tests, inkl. Auslieferung von `main.js`, `world.js`, Import-Map mit fester Version). Browsertest mit Playwright und dem Chromium aus `/opt/pw-browsers`: Das CDN (jsdelivr) liefert hier 403, daher wurde Three.js 0.170.0 lokal installiert und die CDN-URL per Route ersetzt (nur in der Testumgebung, nicht im Repository). Ergebnis: Zwei Seiten verbinden sich, sehen einander an denselben Positionen, Bewegung mit WASD wird übertragen, Mausdrehung ergibt yaw und pitch, keine Konsolenfehler. Die Welt wurde aus mehreren Blickpunkten geprüft (Dorf, Schloss, Tunnel, Kammer, Gesamtsicht). Nicht getestet: das echte CDN, echte Maussperre im Browser des Besitzers und die Leistung auf Mobilgeräten. Offen: Server speichert `pitch` nicht und wertet `fire` nicht aus (Aufgabe 8). `welcome` enthält noch kein `level`. Keine neuen Abhängigkeiten.
- 2026-10-10, Claude Code: Öffentliches Repository `nachtjagd` angelegt, Spiel auf GitHub Pages live. Ab hier wird in diesem Repository weitergearbeitet.

- 2026-10-10, Codex: Öffentliches Live-Frontend unter live/ auf codex/live gesichert, ohne MP3. npm test vor Snapshot-Push im Runner ausgeführt. Dynamische Assetpfade noch prüfen; privater Backendcode fehlt. Kein Merge oder Deployment.

- 2026-10-10, Codex: Öffentliches Live-Frontend unter live/ auf codex/live gesichert, ohne MP3. npm test vor Snapshot-Push im Runner ausgeführt. Dynamische Schnee- und Kalksteintexturen ergänzt; privater Backendcode fehlt. Kein Merge oder Deployment.

### 2026-10-10 · Entwurf 05

See nach Südwesten vergrößert, Wald und frei stehende Baumgruppen ergänzt, niedriger Waldboden, fünf zusätzliche Wegverbindungen. Querebene Straßenprofile mit gemeinsamem Kreuzungsniveau, maximal 18 % Längsneigung und festem Geländeanschluss. 60 Tests und 15 Browserprüfungen bestanden; Pinsel, Undo/Redo, Wiederherstellung und Rundgänge kontrolliert. Vorschau separat auf gh-pages veröffentlicht; main unverändert.

### 2026-10-10 · Entwurf 06

Wald aufgelichtet, unebene Vorberge ergänzt, inneren Ring zu Mittelbergen geformt und äußeren Hochgebirgsring hinzugefügt. Häuser versetzt neu angeordnet, zwei begehbare Treppenwege und Dorftreppen-Ansicht ergänzt. 64 Tests und 16 Browserprüfungen grün, Editor und Treppenbewegung geprüft. Version 06 separat auf gh-pages veröffentlicht.
