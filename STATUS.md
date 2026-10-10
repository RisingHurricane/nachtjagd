# STATUS

Letzte Aktualisierung: 2026-10-10 (Codex, Dorfentwurf auf Basis von `nachtjagd-neu`)

## Aktueller Dorfentwurf

- `public/entwurf/index.html` ist eine separate, allein spielbare Vorschau des neuesten Live-Frontends. Kleinerer Dorfplatz, engere Marktstraße, Kirchgasse mit fünf ergänzten Häusern, steilere variierte Dächer, Gauben und feinere Gebäudekonturen. Neun vorhandene Häuser wurden umgestellt.
- `tools/build-village-preview.mjs` erzeugt den Entwurf aus dem unveränderten Import in `live/`. Lokale Grafikdateien und relative Assetpfade erlauben die statische Vorschau auch auf GitHub Pages. Keine Referenzfotos oder MP3-Dateien hochgeladen.
- Hausrotationen, Eingänge, Innenräume und Hofdetails stimmen überein. Alle 21 Bewegungsprüfungen im Browser bestanden: drei Straßenverbindungen und alle 18 Häuser mit Eingang und Treppe. Sichtprüfung von Platz und Übersicht; JavaScript-Syntax geprüft. Die 35 vorhandenen Tests für den älteren Repository-Server/Client sind ebenfalls grün (mit erlaubtem lokalen Netzwerkzugriff).
- Vorschau unter `https://risinghurricane.github.io/nachtjagd/entwurf/` vorgesehen. Dorfplatz, Übersicht und friedlicher Rundgang sind über die Leiste unten links erreichbar.
- Online-Koop ist in diesem Entwurf nicht verbunden; der öffentliche Import enthält den privaten Altay-Backendcode nicht. Die bestehende Altay-Version bleibt unverändert. Der spätere gemeinsame Spielstand braucht dieselbe Weltversion für alle Teilnehmer.
- Referenzen getrennt behandeln: Dorf, Wald, Burg/Schloss außen, Gesamtstimmung/Tal sowie Schlossräume. Bisher hauptsächlich Dorfkern überarbeitet; Bergkulisse, Monster, Wald und Schlossräume sind noch der bisherige Stand.
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

- 2026-10-10, Claude Code: Grundgerüst erstellt (Server, Client, Tests, Anleitungen).
- 2026-10-10, Claude Code: Deployment für Render vorbereitet (`render.yaml`, `/healthz`, Test, Anleitung). Dienst bei Render noch nicht angelegt.
- 2026-10-10, Claude Code: Spielkonzept Nachtjagd festgelegt, Vision in `DESIGN.md`, Stufe 1 in `PLAN.md`.
- 2026-10-10, Claude Code: 37 Referenzbilder des Besitzers gesichtet. Palette, Zuordnung zu Orten und Monstern in `DESIGN.md`, Moodboards in `referenz/`, `PLAN.md` darauf abgestimmt. `mountains 2.avif` wurde nicht verarbeitet.
- 2026-10-10, Claude Haiku: Aufgaben 1 bis 3 aus `PLAN.md` umgesetzt, je ein Commit (ES-Module, `game.js`, `public/level.json` mit Kollision). `npm test` grün (26 Tests). Level-Generator für Bäume und Felsen nur einmal genutzt, nicht im Repository. Keine neuen Abhängigkeiten.
- 2026-10-10, Claude Haiku (Branch `claude/haiku-stufe1-b`): Aufgabe 4 (Three.js-Ego-Client) und Aufgabe 5 (Spielwelt aus `level.json`) umgesetzt, je ein Commit. Getestet: `npm test` grün (30 Tests, inkl. Auslieferung von `main.js`, `world.js`, Import-Map mit fester Version). Browsertest mit Playwright und dem Chromium aus `/opt/pw-browsers`: Das CDN (jsdelivr) liefert hier 403, daher wurde Three.js 0.170.0 lokal installiert und die CDN-URL per Route ersetzt (nur in der Testumgebung, nicht im Repository). Ergebnis: Zwei Seiten verbinden sich, sehen einander an denselben Positionen, Bewegung mit WASD wird übertragen, Mausdrehung ergibt yaw und pitch, keine Konsolenfehler. Die Welt wurde aus mehreren Blickpunkten geprüft (Dorf, Schloss, Tunnel, Kammer, Gesamtsicht). Nicht getestet: das echte CDN, echte Maussperre im Browser des Besitzers und die Leistung auf Mobilgeräten. Offen: Server speichert `pitch` nicht und wertet `fire` nicht aus (Aufgabe 8). `welcome` enthält noch kein `level`. Keine neuen Abhängigkeiten.
- 2026-10-10, Claude Code: Öffentliches Repository `nachtjagd` angelegt, Spiel auf GitHub Pages live. Ab hier wird in diesem Repository weitergearbeitet.

- 2026-10-10, Codex: Öffentliches Live-Frontend unter live/ auf codex/live gesichert, ohne MP3. npm test vor Snapshot-Push im Runner ausgeführt. Dynamische Assetpfade noch prüfen; privater Backendcode fehlt. Kein Merge oder Deployment.

- 2026-10-10, Codex: Öffentliches Live-Frontend unter live/ auf codex/live gesichert, ohne MP3. npm test vor Snapshot-Push im Runner ausgeführt. Dynamische Schnee- und Kalksteintexturen ergänzt; privater Backendcode fehlt. Kein Merge oder Deployment.
