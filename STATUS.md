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
