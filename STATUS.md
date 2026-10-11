# STATUS

Letzte Aktualisierung: 2026-10-10 (Claude Haiku, Branch `claude/haiku-stufe1-b`)

## Stand

- Das Spiel heißt Nachtjagd (Ego-Shooter, allein oder bis zu 4 Spieler über Raumcode, Schauplatz Dark Valley). `DESIGN.md` beschreibt die gesamte Vision in vier Ausbaustufen. `PLAN.md` enthält Stufe 1 (Kern) mit 15 Aufgaben.
- Aufgaben 1 bis 5 aus `PLAN.md` sind umgesetzt: ES-Module, `game.js` (Spiellogik ohne Netzwerk), `public/level.json` mit Kollision, Three.js-Ego-Client (`public/main.js`, Kamera, Eingabe, Spieler als Kapseln) und die Spielwelt aus `level.json` (`public/world.js`). `npm test` ist grün (30 Tests).
- Die Welt ist Optik nach Palette, aber noch ohne Nachtstimmung. Dächer, Tunnelende und die nördlichen Berge wirken in der Nacht sehr dunkel. Das ändert Aufgabe 6.
- Der Server speichert `pitch` noch nicht. `fire` wird nur als Flag gespeichert und nicht ausgewertet. Beides kommt mit Aufgabe 8. Der Client schickt beides schon.
- Der Client lädt `level.json` selbst per `fetch`. Das Protokoll sieht vor, dass `welcome` das Level enthält (`level`). Das ist noch nicht umgesetzt und wird mit Aufgabe 12 ohnehin überarbeitet.
- Deployment vorbereitet: `render.yaml` und die Gesundheitsprüfung `/healthz` liegen im Repository. Der Dienst selbst ist bei Render noch nicht angelegt.
- Domain: `altay.vision` (Dynadot).

## Stand Mehrspieler (Claude, 10.10.)

- Mehrspieler ohne Server ist auf dem Branch `claude/p2p-github-pages` umgesetzt und lokal mit zwei Browserfenstern getestet: Host erzeugt einen Raumcode und Einladungslink, der Gast tritt bei, Bewegung wird übertragen. 35 Tests grün. Landschaft von Haiku (`claude/haiku-landschaft`) ist eingemergt, aber noch nicht visuell abgenommen.
- Veröffentlicht: https://risinghurricane.github.io/nachtjagd/ (GitHub Pages, Branch `gh-pages` = Inhalt von `public/`). Live getestet: ein Fenster hostet, ein zweites tritt per `?room=CODE` bei. Quelle ist dieses öffentliche Repository `RisingHurricane/nachtjagd`. Neu veröffentlichen: `git subtree split --prefix public -b gh-pages && git push -f origin gh-pages`.
- Schwerpunkt ab jetzt: Grafik und Stimmung nach den Referenzbildern (siehe `DESIGN.md`, Abschnitt Referenzbilder). Das Spielprinzip (Monster, Waffen, Kristalle, Fahrzeuge) lässt sich von der Live-Seite `altay.vision/nachtjagd` abschauen und später übernehmen.

## Burgmodelle und Übergabe an Codex (Claude, 11.10.)

Auf dem Branch `claude/burg` liegen zwei grobe, neugotische Burgvarianten als fertige Modellmodule. Sie fassen nur neue Dateien an (`public/models/`, `test/castle.test.js`, in `package.json` die Dev-Abhängigkeit `three@0.170.0` nur für den Test). `world.js`, `level.json`, `main` und `gh-pages` sind unberührt.

- `public/models/castle.js` (`buildCastle`): Palas im Norden, sehr hoher achteckiger Hauptturm im Hof, Bergfried, schräge Flügel, Bogengang, Tor bei x = 4.
- `public/models/castle2.js` (`buildCastle2`): langer Palas, runder Hauptturm (rund 78 m) am Ostende, 30 Grad gedrehter Fachwerkflügel, Kapelle mit Apsis, Torturm mit Pyramidendach, Tor bei x = -6.
- `public/models/kit.js`: gemeinsame Bauteile (Türme, Dächer, Spitzbögen, Bogengänge, schräge Flügel mit `frame`, Fenster). Neue Gebäude (Kirche, Häuser) sollen darauf aufbauen.
- Vorschau: `public/models/preview.html?model=castle2&view=front|back|side|west|aerial|top|court|arcade|tower|gate|free`.
- Läuft mit Three.js 0.170 und r128 (Build geprüft, r128 nur ohne Rendering).

Vertrag: `buildX(THREE, options)` gibt eine `THREE.Group` zurück, 1 Einheit = 1 m, Ursprung = Mitte am Boden, Eingang nach +z, `userData` mit `footprint`, `height`, `gate` und `colliders`. Collider sind `{type:'box', x, z, w, d, h, rot?}` (rot = Drehung um y) oder `{type:'circle', x, z, r, h}` in lokalen Koordinaten. Beim Platzieren (`group.position`, `group.rotation.y`) müssen die Collider mitgedreht und verschoben werden.

### Nächste Schritte für Codex (Spiellogik verknüpfen)

1. Branch `codex/<thema>` von `main` oder von `codex/village-layout` anlegen und `claude/burg` hineinholen (`git merge origin/claude/burg`). Konflikte sind nur bei `package.json` und `package-lock.json` zu erwarten.
2. Burg am Felssporn des Weltentwurfs einsetzen: Modul laden, `group.position` und `rotation.y` aus dem Layout setzen, die Collider in Weltkoordinaten umrechnen und der Kollision übergeben. `game.js` kennt bisher nur achsenparallele Boxen und Kreise. Entweder gedrehte Boxen unterstützen (Feld `rot`) oder sie durch Kreise annähern (Radius `hypot(w, d) / 2`).
3. Spielmechanik aus dem Live-Frontend (Wellen, Monster, Waffen, Kristalle, Fahrzeuge) auf die gemeinsame Spiellogik übertragen. Der Host rechnet (`game.js` über `session.js`), Gäste schicken nur Eingaben, das Protokoll steht in `AGENTS.md`. `fire` und `pitch` werden bisher nicht ausgewertet.
4. Mehrspieler: `net.js` (PeerJS, Raumcode) ist mit dem Weltentwurf noch nicht verbunden. Alle Teilnehmer brauchen dieselbe Weltversion.
5. Vor dem Push `npm test` ausführen, eigenen Branch pushen, nicht `main` und nicht `gh-pages` anfassen, danach `STATUS.md` und den Übergabe-Log ergänzen.

### Burg-Innenräume (Claude, 11.10.)

`public/models/castle-interior.js` (`buildCastleInterior(THREE)`) liefert fünf Innenräume im selben Koordinatensystem wie `castle.js` (gleiche Position und Drehung verwenden): Rittersaal, Bibliothek, Turmtreppe, Turmzimmer, Kapelle. `userData.rooms` enthält je Raum `id`, `label`, `eye`, `target`, `cutY`, `userData.lights` Lichtvorschläge je Raum. Grenzen: Die Außenhülle hat noch keine Türöffnungen, die Innenräume haben keine Collider. Ein interaktiver Betrachter mit Schnittebene liegt als Artifact vor (Quelle im Arbeitsverzeichnis des Agenten, nicht im Repository). Für andere Werkzeuge ließe sich ein GLB-Export ergänzen.

### Burg: Rückseite, Außendetails, Keller (Claude, 11.10.)

- Rückseite geschlossen: Verbindungsbau zwischen Begleitturm und Rückflügel, Mauerstücke, Palisaden (`kit.palisade`) zwischen Bergfried und Kemenate, am Westrand und am Südostrand.
- Neue Bauteile in `kit.js`: `palisade`, `fiale`, `buttress` (Strebepfeiler mit Fiale), `door` (Spitzbogentür). Strebepfeiler mit Fialen an Palas, Kapelle, Torhaus und Verbindungsbau, Türen an Hofseiten. Zweiter Bogengang an der Südostmauer. Der Fels unter `castle.js` ist 9 m tief, damit der Keller darin liegt.
- `castle-interior.js`: jetzt 16 Räume in 6 Gruppen (Palas, Türme, Kapelle, Flügel, Gänge, Keller): neu Kemenate, Schlafgemach, Waffenkammer, Wachstube, Küche, Gästekammer, zwei Bogengänge, Weinkeller, Kellergang, Verlies. Der Keller liegt bis 4,8 m unter dem Boden (Weinkeller unter dem Rittersaal, Kellergang und Verlies Richtung Osten).
- `tools/export-glb.mjs`: exportiert `burg-aussen.glb`, `burg-innen.glb` und `burg-komplett.glb` (1 Einheit = 1 m). Aufruf `node tools/export-glb.mjs [Ordner]`.
- Offen: Türen sind noch Zierde, in den Außenwänden gibt es keine Öffnungen und die Innenräume haben keine Collider. Neue Collider (Strebepfeiler, Palisaden, Verbindungsbau, Bogengang) stehen in `userData.colliders`.

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
- 2026-10-10, Claude Code: Mehrspieler über PeerJS (`net.js`, `session.js`), `game.js` nach `public/` verschoben, Landschaft von Haiku eingemergt. Veröffentlichung wartet auf ein öffentliches Repository.
- 2026-10-10, Claude Code: Öffentliches Repository `nachtjagd` angelegt, Spiel auf GitHub Pages live. Ab hier wird in diesem Repository weitergearbeitet.
- 2026-10-10, Claude Code (Branch `claude/burg`): Grobe Burg als Modellmodul `public/models/castle.js` (neugotisch, unsymmetrisch nach Neuschwanstein/Wernigerode/Arendelle: Palas mit Zwerchgiebeln, hoher Rundturm, Bergfried mit Pyramidendach, Kapelle mit Apsis, Kemenate, versetztes Torhaus, niedrige Mauern ohne Zinnen). Nur Würfel, Quader, Kegel, Pyramiden und Prismen, zum Abnehmen der Form, danach folgt die Detailversion. Vorschau: `public/models/preview.html?model=castle&view=front|back|side|aerial|gate|free`. Test `test/castle.test.js`, dafür `three@0.170.0` als Dev-Abhängigkeit (gleiche Version wie im Client, nur für Tests). Nicht angefasst: `world.js`, `level.json`, `gh-pages`, `main`. Modellvertrag: `buildX(THREE, options)` liefert eine `THREE.Group`, 1 Einheit = 1 m, Ursprung Bodenmitte, Eingang nach +z, Fenstermaterial `windowGlow` (#e0a050), `userData.colliders` (box: x, z, w, d, h; circle: x, z, r, h) in lokalen Koordinaten. Einbau in die Welt: Position und Drehung des Burgplatzes aus dem Layout von Codex übernehmen.
- 2026-10-11, Claude Code (Branch `claude/burg`): Burg erweitert um einen hohen achteckigen Mittelturm im Hof und schräge Teile (Kemenate 22°, Kapelle 17°, Rückflügel 26°, drei schräge Mauern). Modellvertrag ergänzt: gedrehte Box-Collider tragen `rot` (Drehung um y, Radiant). `game.js` kennt nur achsenparallele Boxen, beim Einbau in die Welt muss das noch unterstützt werden (oder die Boxen werden durch Kreise angenähert, siehe Kopfkommentar in `castle.js`).
- 2026-10-11, Claude Code (Branch `claude/burg`): Hauptturm im Hof vergrößert (achteckig, zwei Stufen, rund 60 m, bündig an der Palasfront), Zwerchgiebel verschoben, alle Teile stehen auf einem gemeinsamen Felsumriss statt auf einzelnen Platten. Vorschau hat neue Ansichten `top`, `court`, `west`. Footprint jetzt 52 x 42 m, Höhe 62 m.
- 2026-10-11, Claude Code (Branch `claude/burg`): Hauptturm schlank und rund 80 m hoch (Höhe des Modells 85 m), alle Dächer steiler (Satteldächer 10 bis 17 m Anstieg, Kegel 11 bis 26 m), Spitzbogentor, Spitzbogenfenster, Bogengang links vom Tor (`arcadeSeg`, `arcadePanel`). Vorschau: neue Ansichten `arcade` und `tower`, Kamera skaliert mit der Modellhöhe.
- 2026-10-11, Claude Code (Branch `claude/burg`): Baukasten `kit.js` aus `castle.js` herausgelöst (Geometrie unverändert), zweite Burgvariante `castle2.js` (anderer Grundriss, Fachwerkflügel, Torturm mit Pyramidendach), Tests für beide Burgen (44 Tests grün), Übergabe an Codex (siehe Abschnitt oben). Footprint von `castle.js` auf 52 x 49 m korrigiert.
- 2026-10-11, Claude Code (Branch `claude/burg`): Dächer beider Burgen mit flacherem Rand am Traufrand (etwa 17 Grad, danach die steile Hauptneigung): `kit.gable` mit Knickprofil, neue Funktion `kit.roofGeo` für Kegel- und Pyramidendächer (Lathe-Profil), Dachgauben tiefer gesetzt. Besitzer bevorzugt die erste Burg (`castle.js`), `castle2.js` bleibt als Alternative.
- 2026-10-11, Claude Code (Branch `claude/burg`): Innenräume der Burg (`castle-interior.js`, 5 Räume, 10 Lichter), Test ergänzt (45 Tests grün), Artifact-Betrachter mit Schnittebene veröffentlicht.
- 2026-10-11, Claude Code (Branch `claude/burg`): Rückseite der Burg geschlossen, Palisaden, Fialen, Strebepfeiler, Türen, zweiter Bogengang, 16 Innenräume mit Keller, GLB-Export (`tools/export-glb.mjs`). 45 Tests grün.
- 2026-10-11, Claude Code (Branch `claude/burg`): Echte Fenster. Wände und Türme mit Fenstern werden in `kit.finish()` hohl (`hollowWall` außen, `interiorGlow` innen, warm erleuchtet), die Öffnungen gehen durch die Mauer mit Laibung, davor Steinrahmen mit Sohlbank, Holzsprossen und durchsichtiges Glas (`windowGlass`, Gruppe `windows`). Nur zwei Fenster an den Torpfeilern (und fünf bei `castle2`) sind noch Rahmen vor einer beleuchteten Platte. Neu: `kit.shaft` (Turmschaft mit Seitenflächen nach +z/+x/-z/-x), `roundTower` nutzt ihn. Tests prüfen mit Strahlen, dass jede Öffnung offen ist (47 Tests grün). Innenräume (`castle-interior.js`) haben noch aufgemalte Fensterflächen. Das Material `windowGlow` gibt es nicht mehr.
- 2026-10-11, Claude Code (Branch `claude/burg`): Auch die Fenster der Innenräume sind echt: `iwin` meldet sie dem Baukasten, `kit.shellBox` und `kit.shellPoly` (Raumhüllen und Turmwände) werden beim Abschluss zu Hüllen mit Fensterlöchern (`roomShell`), dazu Laibungen (`windowReveal`), Rahmen, Sprossen und Glas (Buntglas in der Kapelle, jetzt sechs Apsisfenster, je eines pro Wandfläche). 58 von 58 Innenfenster offen, Strahlentest je Fenster (48 Tests grün). Im Gesamtmodell (Burg außen plus innen) die beleuchtete Innenhaut der Außenwände (`interiorGlow`) ausblenden; der Betrachter und `tools/export-glb.mjs` tun das schon. Neue Optionen: `createKit(..., { noHosts: true })` (Kleinteile nehmen keine Fenster auf).
