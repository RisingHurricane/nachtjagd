# STATUS

Letzte Aktualisierung: 2026-10-11 (Claude, Fahrzeuge Entwurf 14; davor Codex, grober Weltentwurf auf Basis von `nachtjagd-neu`)

## Aktueller grober Weltentwurf

- Entwurf 13: Unregelmäßiger Dorfrand mit Vorsprüngen und Einzügen statt rechteckiger Mauer. Waldkante folgt derselben Kontur; neun Randhäuser versetzt, drei Tore bleiben an ihren Straßenanschlüssen frei. Drei weitere Mauerabschnitte sind bewusst offen.
- Gewellte Bergrücken schließen tiefe Spalten zwischen den Mittelbergen und dem äußeren Hochgebirgsring. Unterschiedliche Gipfelgrößen und -höhen bleiben sichtbar. Burgsporn, Senke unter dem Viadukt und sanftes Seeufer bleiben erhalten.
- 3383 Bäume: drei auf der kleinen Seeinsel und 3380 in der Landschaft, davon 3100 im Hauptwald, 140 an niedrigen Hängen und 140 in sechs lockeren Gruppen auf den Bergrücken. Drei gezielte Lichtungen öffnen den bisherigen Wald; insgesamt 56 Bäume weniger als in Entwurf 07. Kronenfreiheit mindestens 4 m, nur Stämme kollidieren; 3200 niedrige Vegetationskörper und 96 höhere Buschformen in sechs Gruppen bleiben durchquerbar.
- 28 Häuser mit vier groben Volumenformen, Kirche, Höfe und zwei begehbare Treppenwege mit 58 waagerechten Tritten. 18 Straßen/Gassen bleiben quer waagerecht, mit gemeinsamen Kreuzungshöhen und maximal 18 % Längsneigung. Gebäude schließen an das Gelände an; Straßen und Viaduktanschlüsse bleiben beim Modellieren fest.
- Neue Orte: Holzwindmühle im Süden, Steinkreis mit zehn Menhiren und vier Decksteinen im Norden, Klosterruine mit offenem Hof und Kapellenresten im Osten, vier eng gruppierte Seehäuser und ein begehbarer Steg sowie eine kleine Insel mit drei Bäumen. West- und Nordmine sind kurze überdachte Vorstollen mit Holzrahmen, Schienen und dunklem Abschluss. Unterirdische Verbindungen folgen später. Fünf zusätzliche Zugangswege und sechs direkte Ansichten im Menü Neue Orte.
- Nutzerskizze: Norden ist -z, Burg westlich auf freiem Felssporn, großer See im Südwesten, Hangdorf rechts der Mitte. Siebenbogiges Viadukt und Wegschleifen erhalten.
- Neue Grundform bergdorf-seeinsel-2026-10-11-v8, Browser-Schlüssel nachtjagd-bergdorf-seeinsel-v8, Raster 321×281. Vorherige Browserstände bleiben erhalten; Dateien anderer Grundformen werden ohne Zustandsänderung abgewiesen. Gelände-Editor mit Pinsel, Undo/Redo und Datei-Sicherung verfügbar.
- Validierung: 78 automatisierte Tests (35 Server/Client, neun Editor, vierzehn Weltlayout, fünf Straßen, vier Viadukt, zwei Treppen, neun Spielkern) und 22 geometrische sowie acht Spieladapter-Browserprüfungen bestanden. Dorfkontur, Bergübergänge und Lichtungen sichtbar geprüft. Keine neue Abhängigkeit.
- Aktuelle Vorschau: https://risinghurricane.github.io/nachtjagd/entwurf/?v=13 . Versionskennung und Skriptadressen gemeinsam aktualisiert. Die Layoutstudie bietet jetzt einen ersten Solo-Spieltest mit Kampf; Online-Koop fehlt noch; Multiplayer für 1–4, endgültige Modelle und Schlossinnenräume bleiben spätere Schritte. Originalimport und spielbarer Vergleich erhalten, keine privaten Referenzbilder veröffentlicht. main unverändert.

## Spielelogik im gemeinsamen Kern (Entwurf 14, Branch `claude/spiellogik`)

- `gameplay-core.js` enthält jetzt die Regeln des Altay-Originals bis auf Fahrzeuge und Koop: zehn Gegnerarten (Dorfbewohner, Lykan, Wolf, Hexe, Samca, Spucker, Blähling, Brocken, Schnitter, Fledermaus) mit Auftauchphase, Sprungangriff, Säure, Explosion und Luft-KI; Kopf-/Körpertreffer über Trefferkugeln; Silberschaden gegen Unheilige; Axt, Granaten und Molotows; Sprung und Fallschaden; Treffer-Schonzeit; Wellenmodifikatoren (Blut, Fledermäuse, Nebel); Questablauf Siegel, Glocke, Endphase mit Siegelwächtern (`guard` im Weltadapter); Händler und Schmied mit steigenden Preisen; Bildstöcke, Angelstellen, acht Notizen, drei Relikte (Winterherz, Jägerkompass, Grubenlampe); Wetterfronten und Dämmerung/Morgengrauen in `state.env`.
- `play-spots.js` platziert Händler, Schmied, Bildstöcke, Angelplätze, Truhen, Notizen und Relikte anhand von `world-layout.js` auf begehbaren Boden. `blockout.js` hängt die Orte an den Weltadapter, setzt die Siegelwächter (`alpha` Burg, `deep` Mine) und `waterDepth`. Die Welt-Prüfung `Spielorte frei` kommt dazu.
- `gameplay.js` zeigt alles an: Tasten Leertaste, G, T, V, F, E, 1–3, Ziffern im Laden; Platzhalterfiguren je Gegnerart (Hexe schwebt, Flugmonster mit Flügeln), Beute, Relikte, Notizen, Händler, Schmied, Bildstöcke, Angelfähnchen, Wurfgeschosse, Feuer, Säure, Nacht-/Nebel-/Schneestimmung und Taschenlampe.
- Tests: `test/gameplay-mechanics.test.js` (25 Tests) und der angepasste Kerntest; `npm test` 105 grün. Im Browser geprüft: alle neun Weltprüfungen bestanden, Client startet ohne Fehler, zehn Gegnerarten laufen. Ein einfacher Bot erreicht die Endphase und stirbt dort bzw. an den Fledermäusen; die Schwierigkeit entspricht der Vorlage.
- Bewusste Annäherungen: Trefferkugeln von Spucker, Blähling und Brocken sind geschätzt; Flugmonster bleiben 11 m über blockierten Zellen und kennen keine Höhlenvariante; Winterherz-Abklingzeit zählt in Spielzeit.
- Noch offen: Minentunnel mit Höhlenfledermäusen, explosive Fässer, Ton/Musik, Online-Koop. Platzhalterfiguren sollen durch die Modelle von ChatGPT (Jeep, Häuser, Monster) und die Burg ersetzt werden; die Kern-API bleibt dafür gleich.

### Fahrzeuge (Platzhalter, Entwurf 14)

- `vehicles.js`: Physik und Fahrpläne ohne Darstellung. Geländewagen (Fahrmodell aus dem Original: Radstand 2,51 m, Lenkung nimmt mit Tempo ab, Haftung auf Straße 0,92 und im Gelände 0,57, bis 22 m/s vorwärts und 7,5 m/s rückwärts, Hangabtrieb, Stopp an Hindernissen und Steilkanten), Lore auf Schienen mit Weichen (A/D wählt links/rechts, Wende am Streckenende, Rollen ohne Gas), Gondel im Fahrplan (zwei Kabinen auf zwei Seilen, 8 s Halt, 46 s Fahrt, Aussteigen nur am Halt) und Ruderboot (W/S rudern, Shift schneller, A/D lenken, prallt am Ufer ab).
- Im Spielkern: `E` besteigt das nächste Fahrzeug (Vorrang vor Truhen und Angelplätzen), `E` steigt aus (Wagen und Lore erst unter 2,5 m/s, Gondel nur an der Station), `C` wechselt den Sitz. Der Wagen überfährt Gegner: ab 8 m/s tödlich, darunter nach Tempo, ein Treffer je Berührung. Ohne Fahrer bremst der Wagen. Der Fahrer des Wagens kann nicht schießen und lenkt mit der Maus; Beifahrer, Bootsfahrer und Gondelgäste schießen. Axt und Würfe sind in Fahrzeugen gesperrt. `snapshot().vehicles` und `player.ride`/`player.eye` liefern den Zustand, `layout()` die festen Strecken.
- Orte (`play-spots.js`): zwei Geländewagen an West- und Osttor des Dorfs, Lorenschienen entlang der Wege `mine-west` und `mine-north` (je zwei Loren), Talstation am Osttor (200, 50) und Bergstation auf dem Nordostgrat (300, −240), rund 300 m und 97 m Höhenunterschied, vier Boote (zwei am Stegende, zwei am Südufer). Welt-Prüfungen: Wagen frei, Schienen frei, Stationen begehbar, Boote im Wasser.
- `vehicle-models.js`: Platzhaltermodelle und Austauschpunkt `NachtjagdVehicleModels.builders[kind](THREE)` (Vertrag im Kopfkommentar der Datei: Ursprung am Boden, Blick +z, `userData.wheels/oars/light`). Dazu Schienen, Stationen mit Holzrahmen, Seile und drei Stützen.
- Tests: `test/vehicles.test.js` (13 Tests), `npm test` 118 grün. Im Browser gefahren: Wagen bis zum Osttor in 17 s ohne Hängenbleiben, Gondel hinauf, Boot gerudert, Lore bis zum Minenvorstollen.
- Offen: Minentunnel mit Weichen im Untergrund (die Schienen laufen bisher nur an der Oberfläche), Mehrspieler-Sitzplätze (Datenmodell vorhanden: vier Sitze), Motor- und Ruderton, Scheinwerfer nur als Platzhalterkegel, Aussichtsplattform an der Bergstation ist Platzhalter ohne Kollision.

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

### 2026-10-11 · Entwurf 07

Höhen und Fußabdrücke beider Bergtypen variiert, Anordnung und Ausrichtung unregelmäßiger. 136 Bäume an niedrigen Hängen ergänzt, insgesamt 3436 Bäume. 65 automatisierte Tests und 17 Browserprüfungen bestanden. Version 07 separat veröffentlicht, main unverändert.

### 2026-10-11 · Entwurf 08

Dorfmauer und Waldkante unregelmäßig geformt, Randhäuser versetzt. Gewellte Bergrücken verbinden Mittelberge mit dem äußeren Gipfelring; 140 Bäume auf den Sätteln ergänzt und drei andere Waldstellen geöffnet. Insgesamt 3380 Bäume. 68 automatisierte Tests und 19 Browserprüfungen bestanden. Version 08 separat veröffentlicht, main unverändert.

### 2026-10-11 · Entwurf 09

Drei Mauerabschnitte bewusst geöffnet, 96 einfache Buschformen in sechs Gruppen ergänzt. Berge unverändert. 68 Tests und 19 Browserprüfungen bestanden. Vorschau separat veröffentlicht.

### 2026-10-11 · Entwurf 10

Windrad, Steinkreis, Klosterruine, vier Seehäuser mit Steg und zwei kurze Minenvorstollen grob ergänzt. Fünf Zugangswege, freigehaltene Lichtungen und Menü Neue Orte. 68 Tests und 21 Browserprüfungen bestanden; alle Orte sichtbar geprüft. Grundform und Browser-Schlüssel v7 erhalten frühere Geländeänderungen unter ihren bisherigen Schlüsseln. Separat auf gh-pages veröffentlicht, main unverändert.

### 2026-10-11 · Entwurf 11

Vier Seehäuser enger am Steg gruppiert. Kleine Geländeinsel mit sanftem Ufer und drei unterschiedlich großen Baumkegeln ergänzt; direkte Seeansicht angepasst. 69 Tests und 22 Browserprüfungen bestanden. Neue Grundform und Browser-Schlüssel v8 erhalten bisherige Geländeänderungen unter ihren alten Schlüsseln.

### 2026-10-11 · Entwurf 13: Spiellogik verbinden

Erster separater Solo-Kern mit Waffenwerten aus nachtjagd-neu, Revolver/Nachladen, drei Boden-Gegnerarten, Wellen, Leben/Tod, drei Mondsiegeln und 100-Sekunden-Glockenfinale. Neue Welt liefert Höhen, begehbare Flächen, Kollision und Schussabfragen; Gegner nutzen die Straßen bei Hindernissen. Spiel starten, Pause, Neustart und Layout-Rückkehr ergänzt. Waffenfreischaltung über die ersten zwei gesammelten Siegel ist eine neue Layoutanpassung. Noch kein vollständiger Port des monolithischen Spiels und kein Online-Koop. 78 Node-Tests bestanden; 22 Geländeprüfungen und acht Spieladapterprüfungen auf der veröffentlichten Seite bestanden. Start, Schussverbrauch, vollständiges Nachladen, Pause/Fortsetzen und Rückkehr zum Layout sichtbar geprüft. Übergabe an Claude in CLAUDE-HANDOFF.md.

### 2026-10-11 · Claude: Spiellogik geprüft und repariert (Branch claude/spiellogik)

Automatischer Durchlauf mit einem Browser-Bot (Weg über das Straßennetz, Siegel Kirche, Burg, Mine, Glocke, Endkampf) erreicht den Sieg. Dabei gefunden und behoben: (1) Der Burghof hatte am Tor eine etwa 2 m hohe Kante, das Burgsiegel war nicht erreichbar; `gameFloor` lässt die Hofplatte jetzt über 6 m als Rampe auslaufen. (2) Gegner blieben an Baumstämmen hängen; `moveMonster` in `gameplay-core.js` weicht jetzt seitlich aus. (3) Wo eine Straße höher oder tiefer als das Gelände liegt (zum Beispiel am Glockenplatz, 1,35 m), blieb eine Stufe, die Gegner nicht überwinden konnten und die deshalb nie angriffen; `shoulderHeight` in `blockout.js` rampt den Straßenrand 2,5 m lang aus. (4) Die Wegsuche der Gegner läuft nur noch alle 0,2 s pro Gegner. Neue Tests: Ausweichen an einer Säule, Rampe zum erhöhten Spieler (80 Node-Tests grün). Mit `?test` gibt es zusätzlich den Prüfhaken `NachtjagdDebug` für automatische Durchläufe. Noch offen: übrige Mechanik aus dem Monolithen (Sondergegner, Händler, Reliquien, Wetter, Fahrzeuge), Koop, Burg- und Kirchenmodelle einbinden, echte durchsichtige Fenster.

- 2026-10-11, Claude: Restliche Spielelogik aus dem Altay-Original in `gameplay-core.js` portiert (siehe Abschnitt Entwurf 14), `play-spots.js` neu, `gameplay.js` neu geschrieben, Versionskennung auf 14. 105 Tests grün, Browserlauf geprüft. Kein Merge nach `main`, kein Push auf `gh-pages`. Nächste Schritte: 3D-Modelle einhängen, Fahrzeuge, Burg und Kirche in die Welt, Koop.

- 2026-10-11, Claude: Fahrzeuge als Platzhalter umgesetzt (Geländewagen, Lore, Gondel, Boot): `vehicles.js`, `vehicle-models.js`, Anbindung im Kern, Orte in `play-spots.js`, Client-Steuerung. 118 Tests grün, Browserfahrten geprüft. Kein Merge nach `main`, kein Push auf `gh-pages`. Nächste Schritte: Modelle von ChatGPT über `NachtjagdVehicleModels.builders` einhängen, Minentunnel mit Schienennetz, Burg und Kirche in die Welt, Koop.
