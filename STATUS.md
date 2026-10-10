# STATUS

Letzte Aktualisierung: 2026-10-10 (Codex, grober Weltentwurf auf Basis von `nachtjagd-neu`)

## Aktueller grober Weltentwurf

- Aktueller Nutzerbegriff: Hochebene/Bergdorf. Ein Gelände-Editor mit Anheben, Absenken, Glätten, Ebnen, Pinselgröße/Stärke und Schutzmaske ist eingebaut. Linke Maustaste malt, rechte dreht, Alt + links verschiebt. Rückgängig/Wiederholen, lokaler Browserstand und JSON-Export/-Import sind vorhanden. Änderungen sind lokal, keine automatische Übernahme nach GitHub oder in Multiplayer.
- Sieben neue Editor-Tests bestanden; im Browser Pinsel, Undo/Redo, Wiederherstellung nach Reload, Datei-Export und erneutes Laden mit unverändertem Teststand geprüft. Der Teststand wird nicht veröffentlicht.
- AUSSTEHEND: Nutzer hat eine Skizze angekündigt und darum gebeten, auf sie zu warten. Neue Platzierung erst danach: größerer See auf der anderen Seite; Dorf am Hang, mehr unterschiedliche Häuser und Umfassungsmauer; dichterer unterlaufbarer Wald; Burg auf Felssporn statt Felsnische; hügelige und schroffe Landschaftsbereiche mit Burgberg/Bergspitzen. See-Richtung noch nicht festgelegt. Bis dahin nur den Editor fertigstellen.

- Entwurf 02: Die bisher flache Studie hat jetzt Höhenzüge, einen Talboden, ein abgesenktes Seebecken und ein Burgplateau auf 48 m über Wasser. Der Dorfplatz liegt auf 2 m; die Kirchgasse steigt zur Terrasse an. Wege, Bäume, Gebäudesockel und Augenhöhe folgen dem sichtbaren Höhenmodell. Die Gesamtansicht ist die neue Startansicht. Burgzufahrt und offener Hof sind begehbar; Innenräume bleiben offen.
- Sechs geometrische Browserprüfungen unter `?test=terrain` bestanden: Relief, Platzniveau, Burgniveau, Seebett, Gebäudesockel und Weganschlüsse. Hangbewegung sowie Tal- und Burgansicht sichtbar geprüft; 35/35 vorhandene Repository-Tests grün.

- Nutzerkorrektur: zunächst ausschließlich das grobe Layout, Quader als Gebäude und Kegel als Bäume. `public/entwurf/index.html` mit `blockout.js` ist deshalb die neue Standardansicht. Dorfplatz, Hauptstraße, Kirchgasse und Verbindungen zu Wald, See und Burg sind räumlich dargestellt.
- Fünf Ansichten: Dorf, ganzes Tal, Burg, Waldweg und Durchlaufen. Übersicht drehen/verschieben/zoomen; Rundgang mit WASD, Mausziehen und Gebäudekollision. Kein Kampf oder Koop in dieser Studie. Gelände bleibt eine grobe Studie; Burginnenräume sind noch offen.
- Der vorherige spielbare Dorfentwurf ist als `public/entwurf/spiel.html` erhalten. `tools/build-village-preview.mjs` erzeugt diesen Vergleich, nicht mehr die Standardseite. Der ursprüngliche Import unter `live/` bleibt unverändert.
- JavaScript-Syntax, Browseransichten und Dorfbewegung geprüft; 35/35 vorhandene Tests des älteren getrennten Servers/Clients bestanden. Veröffentlichung weiterhin unter demselben Vorschaupfad. Als Nächstes: Feedback zu Abständen, Straßenführung, Sichtachsen und Verteilung der Orte, erst danach Modelle ausarbeiten.

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
