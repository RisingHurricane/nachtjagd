# PLAN: Nachtjagd, Stufe 1 (Kern)

Ein stärkeres Modell schreibt diesen Plan, ein kleineres Modell setzt ihn Aufgabe für Aufgabe um. Die gesamte Vision steht in `DESIGN.md`, diese Datei enthält nur Stufe 1. Die Regeln für die Umsetzung stehen am Ende.

## Spielidee

Nachtjagd ist ein Ego-Shooter im Browser (Three.js), allein oder mit bis zu vier Spielern online über einen Raumcode. Schauplatz ist Dark Valley, ein verschneites Tal im tiefen Winter, mit Dorf, Wald, See, Schloss auf einem Felsen und einem stillgelegten Minentunnel. Monsterwellen greifen an, das Team verteidigt sich und sucht drei Kristalle. Hat es alle drei, muss es bis zum Morgengrauen durchhalten. Am Ende steht eine Auswertung mit erreichter Welle, erlegten Monstern, Kopftreffern und Punkten.

Alles ist auf kurze Sitzungen ausgelegt (5 Minuten sind möglich, mehr sind es meist): keine Wartezeit, ein Einzelspiel startet sofort. Die Monstermenge wächst mit der Spielerzahl.

Ziel ist ein spielbarer Stand in dunkler Low-Poly-Optik. Farben und Stimmung orientieren sich an den Referenzfotos des Besitzers (Palette und Zuordnung in `DESIGN.md`, Abschnitt Referenzbilder, Übersicht in `referenz/moodboard-1.jpg` und `referenz/moodboard-2.jpg`), eine fotorealistische Nachbildung ist nicht das Ziel.

## Spielregeln (Startwerte, dürfen beim Testen angepasst werden)

| Thema | Regel |
| --- | --- |
| Spieler | 100 HP, 6 m/s, Radius 0,5 m, Augenhöhe 1,7 m, Start auf dem Dorfplatz, Taschenlampe mit Taste F |
| Pistole (Taste 1) | 20 Schaden, 3 Schuss pro Sekunde, Reichweite 60 m, Munition 80 (höchstens 200) |
| Flinte (Taste 2) | 8 Schrote mit je 12 Schaden, 1 Schuss pro Sekunde, Streuung ±5 Grad, Reichweite 25 m, Munition 16 (höchstens 40) |
| Gewehr (Taste 3) | 70 Schaden, 1 Schuss alle 0,8 s, Reichweite 100 m, Munition 20 (höchstens 60) |
| Kopftreffer | Doppelter Schaden, zählt in der Auswertung als Kopftreffer |
| Läufer | 50 HP, Höhe 1,6 m, 4,5 m/s, Nahkampf 10 Schaden alle 0,8 s |
| Brocken | 200 HP, Höhe 2,2 m, 2,2 m/s, Nahkampf 25 Schaden alle 1,2 s |
| Wächter des Schlosses | 1200 HP, Höhe 3,5 m, 2,5 m/s, Nahkampf 40 Schaden alle 1,5 s, bewacht den Schloss-Kristall |
| Spielerfaktor f | f = 0,6 + 0,4 x Zahl der Spieler (allein 1,0, zu viert 2,2) |
| Nachtangriffe | Alle 45 s kommt Welle w (1, 2, 3, ...) mit Runden(2 + 2w) x f Läufern und Runden(Abrunden(w / 3) x f) Brocken. Spawn abwechselnd an den drei Toren (Tunnel, See, Schloss). Höchstens 20 Monster gleichzeitig, der Rest wartet |
| Wächter | Tunnel: 3 Läufer und 1 Brocken. See: 2 Brocken. Schloss: der Wächter. Sie stehen still, bis ein Spieler näher als 20 m kommt, dann jagen sie ihn |
| Kristalle | 3 Stück (Tunnelkammer, Seeufer, Schlosshof). Aufnahme durch Berühren, der Zähler gilt für das ganze Team |
| Morgengrauen | Nach dem dritten Kristall beginnt die Dämmerung: 3 Minuten, in denen die Wellen 1,5-mal so stark sind und der Himmel langsam heller wird. Überleben mindestens ein Spieler bis zum Ende, ist die Nacht gewonnen |
| Tod | Wer stirbt, steht nach 30 s mit 50 HP am Dorfplatz wieder auf, solange mindestens ein Teammitglied lebt. Sind alle tot, ist die Nacht verloren. Neustart nach 10 s |
| Pickups | Medikit +40 HP, Munitionskiste (+30 Pistole, +4 Flinte, +5 Gewehr), feste Plätze, nach 25 s wieder da |
| Punkte | Läufer 10, Brocken 30, Wächter 200, Kopftreffer +5 |
| Pause | Einzelspiel: Taste P hält die Welt an. Mit mehreren Spielern läuft die Welt weiter |

Trefferprüfung auf dem Server: Der Strahl geht von der Augenposition (x, z, Höhe 1,7 m) in Blickrichtung (yaw, pitch). In der Draufsicht (x, z) prüft der Server, welches Monster (Kreis mit dem Radius des Typs) zuerst getroffen wird und ob vorher ein Hindernis im Weg ist. Danach rechnet er die Höhe am Treffpunkt: y = 1,7 + tan(pitch) x Abstand. Liegt y zwischen 0 und der Monsterhöhe, ist es ein Treffer, liegt y im oberen Fünftel der Höhe, ist es ein Kopftreffer. Die Flinte prüft 8 Strahlen mit zufälliger Abweichung. Bewegung und Treffer berechnet allein der Server.

## Spielwelt

Karte 200 m x 200 m, Mittelpunkt (0, 0), Koordinaten x und z von -100 bis 100, Spieler und Monster bleiben innerhalb von ±98. Alles liegt auf ebenem Boden. Der Boden ist verschneit (weiß mit leichtem Blauton). Die Welt steht als Daten in `public/level.json`, Server und Client lesen dieselbe Datei.

| Ort | Lage und Aufbau |
| --- | --- |
| Dorfplatz | Mitte, Brunnen als Kreis bei (0, 0) mit Radius 2. Spieler starten rund um (0, 4) |
| Häuser | 10 Boxen um den Platz, jeweils etwa 8 x 6 m, 6 m hoch, mit Satteldach und Schneehaube (nur Optik). Beispiele: (-18, -10), (-18, 10), (18, -12), (18, 12), (-8, -24), (8, -26), (-10, 24), (10, 26), (30, 0), (-32, -2). Häuser sind massiv, ohne Innenraum |
| See | Westen, Mittelpunkt (-60, 20), Radius 25, zugefroren wirkend, aber nicht betretbar. Monster-Spawn am Ufer bei (-32, 20). Bootshaus als Box bei (-34, 36), 6 x 5 m, 4 m hoch. Kristall 2 liegt bei (-34, 30). Wächter: 2 Brocken bei (-32, 32) und (-35, 27) |
| Schloss | Norden, Mauerring von x -20 bis 20 und z -90 bis -50, Mauern 2 m dick und 8 m hoch. Tor von 6 m Breite in der Südmauer bei (0, -50). Ecktürme als Kreise mit Radius 3,5 und 14 m Höhe. Bergfried als Box (0, -82), 10 x 10 m, 16 m hoch. Optisch steht alles auf einem Felsen (großer Kegelstumpf darunter, ohne Einfluss auf die Kollision). Wächter und Monster-Spawn bei (0, -72). Kristall 3 liegt bei (0, -64) |
| Tunnel (stillgelegte Mine) | Osten. Gang von x 62 bis 86 bei z von -3 bis 3, danach Kammer von x 86 bis 98 bei z von -6 bis 6. Wände als dünne Boxen (1 m), 6 m hoch. Monster-Spawn in der Kammer bei (92, 0), Kristall 1 bei (95, 0). Wächter: 3 Läufer und 1 Brocken in der Kammer. Optik: Dach über dem Gang, Holzstützen, eine alte Lore als Dekoration, ein Bergmassiv darüber |
| Wald | Etwa 60 Tannen als Kreise (Seed-basiert, nicht auf Wegen, nicht auf dem Dorfplatz, nicht vor den Toren), dazu etwa 15 Felsen. Große Berge als Kegel außerhalb der Karte als Kulisse |
| Pickups | Munition bei (12, -4), (-14, 8), (0, -45) und (60, 0). Medikit bei (4, 14), (-6, -12) und (0, -60) |

Format von `level.json`: `size`, `playerSpawns` (Liste mit x, z), `boxes` (x, z, w, d, h, kind), `circles` (x, z, r, h, kind), `lake` (x, z, r), `monsterSpawns` (name, x, z), `guards` (x, z, type), `crystals` (id, x, z), `pickups` (x, z, type). Bei Boxen sind x und z der Mittelpunkt, w liegt entlang x und d entlang z.

## Nachtstimmung

Dunkelblauer Himmel, dichter Nebel, fallender Schnee (Partikel), ein schwaches bläuliches Mondlicht. Die Taschenlampe (Taste F) ist ein Scheinwerferlicht an der Kamera. Monster sieht man erst in der Nähe oder im Lichtkegel. Kristalle leuchten und sind weithin sichtbar. In der Dämmerung wird der Himmel allmählich heller.

## Zielarchitektur

Das ganze Projekt nutzt ES-Module. Die Dateien:

- `game.js`: Spielzustand und Regeln ohne Netzwerk (Spieler, Waffen, Monster, Wellen, Treffer, Kristalle, Dämmerung, Pickups, Statistik). Funktionen wie `createGame(level)`, `addPlayer`, `removePlayer`, `setInput`, `step(dt)`, `snapshot()`. Dadurch lässt sich alles ohne Browser testen.
- `server.js`: HTTP und WebSocket, verwaltet Räume (jeder Raum hat ein eigenes `game`, höchstens 4 Spieler, 30 Zustandsupdates pro Sekunde). Ein leerer Raum wird gelöscht.
- `public/index.html`: Seite mit Startmenü, Import-Map für Three.js (`https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`) und HUD.
- `public/main.js`: Verbindung, Eingabe, Kamera, Anzeige der Spieler und Monster.
- `public/world.js`: baut die Three.js-Szene aus `level.json`.

Verbindung: `/ws?room=CODE` tritt dem Raum bei, `/ws?room=new` erzeugt einen Raum mit einem zufälligen Code aus 5 Großbuchstaben, `/ws?room=solo` startet einen privaten Raum. Der Code kommt in `welcome` zurück.

Protokoll (JSON über WebSocket):

| Richtung | Typ | Inhalt |
| --- | --- | --- |
| Server an Client | `welcome` | `id`, `room`, `level` |
| Server an Client | `state` | `players` (id, name, x, z, yaw, hp, weapon, ammo, score, kills, headshots, alive, respawn), `monsters` (id, type, x, z, hp), `crystals` (id, taken), `pickups`, `night` (wave, phase, crystals, dawnLeft), `events` (Schüsse, Treffer, Tode seit dem letzten Update) |
| Server an Client | `result` | Auswertung am Ende: `wave`, `kills`, `headshots`, `score` je Spieler und für das Team |
| Client an Server | `input` | `mx`, `mz` (-1 bis 1, relativ zur Blickrichtung), `yaw`, `pitch`, `fire`, `weapon` (0 bis 2) |
| Client an Server | `name` | `name` |
| Client an Server | `pause` | `on` (nur im Einzelspiel wirksam) |

`night.phase` ist `night`, `dawn`, `won` oder `lost`.

## Aufgaben

Die Reihenfolge einhalten. Nach jeder Aufgabe `npm test`, committen und hier abhaken. Aufgaben 1 bis 15 bilden den spielbaren Kern. Danach folgt Stufe 2 aus `DESIGN.md`.

### [x] 1. Auf ES-Module umstellen
Dateien: `package.json`, `server.js`, `test/server.test.js`.
`"type": "module"` setzen, `require` durch `import` ersetzen (`import { WebSocketServer } from 'ws'`), `module.exports` durch `export`, `__dirname` über `import.meta.url` herstellen, den Start nur bei direktem Aufruf über einen Vergleich von `import.meta.url` mit `pathToFileURL(process.argv[1]).href`. In `server.js` die MIME-Typen `.json`, `.mjs`, `.jpg`, `.jpeg`, `.webp`, `.mp3` und `.ogg` ergänzen.
Abnahme: `npm test` grün, `npm start` startet den Server.

### [x] 2. Spiellogik nach game.js auslagern
Dateien: `game.js` (neu), `server.js`, `public/index.html`, Tests.
Spielzustand und Bewegung aus `server.js` nach `game.js` verlegen. Spieler haben x, z, yaw, hp, ammo, score, alive. Höchstens 4 Spieler. Eingabe jetzt mit `mx`, `mz`, `yaw`, `fire`. Den alten Canvas-Client minimal anpassen (sendet `mx`, `mz` und zeichnet Spieler an (x, z)), damit er bis Aufgabe 4 läuft.
Abnahme: Tests für `game.js` direkt ohne Netzwerk, `npm test` grün.

### [x] 3. Level-Datei und Kollision
Dateien: `public/level.json` (neu), `game.js`, Tests.
`level.json` nach dem Abschnitt Spielwelt anlegen. `game.js` lädt das Level. Spieler sind Kreise und gleiten an Boxen, Kreisen und dem See entlang, der Kartenrand liegt bei ±98. Der Server liest die Datei beim Start.
Abnahme: Tests: Spieler läuft nicht durch ein Haus, nicht in den See, nicht über den Rand.

### [x] 4. Three.js-Client mit Ego-Kamera
Dateien: `public/index.html`, `public/main.js` (neu).
Import-Map, Szene mit weißem Boden, Licht, Nebel und Himmelsfarbe. Klick auf das Spiel aktiviert Pointer Lock. WASD bewegt, die Maus dreht (yaw und pitch, beides geht an den Server). Eingaben mindestens 20-mal pro Sekunde senden, wenn sie sich ändern. Andere Spieler als Kapseln mit Namensschild.
Abnahme: In zwei Browserfenstern sehen sich die Spieler und bewegen sich synchron.

### [x] 5. Spielwelt bauen
Dateien: `public/world.js` (neu), `public/main.js`.
Aus `level.json` die Szene erzeugen: Häuser (Box mit Satteldach und Schneehaube), Schloss mit Mauern, Türmen, Bergfried und Felsen darunter, See als dunkle, leicht durchsichtige Fläche, Bootshaus, Tunnel mit Dach, Holzstützen, Lore-Dekoration und Bergmassiv darüber, Tannen (Zylinder und Kegel), Felsen, Brunnen, Randberge als große Kegel. Einfache Farben aus der Palette in `DESIGN.md`. Vor dem Bauen die Moodboards in `referenz/` ansehen.
Abnahme: Seite lädt ohne Konsolenfehler, Dorf, Schloss, See und Tunnel sind erkennbar.

### [ ] 6. Nachtstimmung, Schnee, Taschenlampe und Fotos
Dateien: `public/world.js`, `public/main.js`.
Dunkler Himmel, Nebel, Mondlicht, fallender Schnee (Three.js `Points`) und Taschenlampe (Taste F) nach dem Abschnitt Nachtstimmung. Existiert `public/textures/sky.jpg` (Panorama im Seitenverhältnis 2:1), wird es als Himmel genutzt und abgedunkelt. Optional `ground.jpg`, `rock.jpg`, `wood.jpg` für Boden, Fels und Holz. Fehlende Dateien werden ohne Fehlermeldung übersprungen.
Abnahme: Ohne Dateien läuft alles, die Taschenlampe lässt sich an- und ausschalten.

### [ ] 7. Monster
Dateien: `game.js`, `public/main.js`, Tests.
Monstertypen Läufer, Brocken und Wächter mit HP, Höhe, Tempo und Schaden aus der Regeltabelle. Verfolgung des nächsten lebenden Spielers, Kollision wie bei Spielern, Nahkampfschaden mit Abklingzeit. Client zeigt sie als einfache Low-Poly-Figuren (Läufer als hagerer, aufrecht laufender Werwolf in Grau-Braun, siehe `wolf.jpg` im Moodboard, Brocken groß, massig und grau, Wächter sehr groß und dunkelrot).
Abnahme: Tests: Monster läuft auf Spieler zu, richtet Schaden an, läuft nicht durch Häuser.

### [ ] 8. Schießen mit der Pistole und Kopftreffer
Dateien: `game.js`, `public/main.js`, `public/index.html`, Tests.
`fire` verbraucht Munition nach der Feuerrate. Trefferprüfung nach dem Abschnitt Spielregeln (Strahl, Höhe am Treffpunkt, Kopf im oberen Fünftel, doppelter Schaden). Spieler zählen kills und headshots. Events für Schüsse und Treffer. Client: Fadenkreuz, kurzer Mündungsblitz, Linie für den Schuss, Treffermarkierung.
Abnahme: Tests: Treffer, Kopftreffer mit doppeltem Schaden, Fehlschuss bei zu hohem pitch, Schuss durch ein Haus blockiert, Munition sinkt, Feuerrate wird eingehalten.

### [ ] 9. Flinte, Gewehr und Waffenwechsel
Dateien: `game.js`, `public/main.js`, `public/index.html`, Tests.
Waffen aus der Regeltabelle, Wechsel mit den Tasten 1 bis 3, Munition je Waffe, Anzeige der gewählten Waffe. Die Flinte verschießt 8 Strahlen mit Streuung.
Abnahme: Tests: Flinte trifft auf kurze Entfernung mehrfach, auf 40 m nicht, Gewehr trifft auf 90 m, Munition je Waffe getrennt.

### [ ] 10. Nachtangriffe
Dateien: `game.js`, Tests.
Wellen alle 45 s nach der Regeltabelle (Spielerfaktor, Spawn abwechselnd an den drei Toren, höchstens 20 Monster gleichzeitig, wartende Monster rücken nach).
Abnahme: Tests: Welle 1 bringt bei einem Spieler 4 Läufer, bei vier Spielern 9 Läufer, das Monsterlimit wird eingehalten.

### [ ] 11. Wächter, Kristalle, Dämmerung und Nachtende
Dateien: `game.js`, `public/world.js`, `public/main.js`, Tests.
Wächter aus `level.json`, die bis zur Annäherung stillstehen. Drei Kristalle zum Aufnehmen. Nach dem dritten beginnt die Dämmerung (3 Minuten, Wellen 1,5-mal so stark, Himmel wird heller), danach `won`. Tod mit Wiederkehr nach 30 s, Niederlage wenn alle tot sind (`lost`), Neustart der Nacht nach 10 s.
Abnahme: Tests: Kristallzähler steigt bei Berührung, nach dem dritten Kristall läuft die Dämmerung und führt nach 3 Minuten zu `won`, Wiederkehr nach 30 s, `lost` wenn alle tot sind.

### [ ] 12. Räume mit Raumcode
Dateien: `server.js`, `public/index.html`, `public/main.js`, Tests.
Startmenü mit drei Schaltflächen: Allein spielen, Raum erstellen, Raum beitreten (Eingabefeld für den Code). Der Server verwaltet Räume nach dem Abschnitt Zielarchitektur, ein Raum fasst höchstens 4 Spieler, ein leerer Raum wird gelöscht. Der Code steht im HUD. Pause (Taste P) wirkt nur im Einzelspiel.
Abnahme: Tests: zwei Clients im selben Raum sehen sich, ein Client in einem anderen Raum sieht sie nicht, der fünfte Spieler wird abgewiesen, ein leerer Raum verschwindet.

### [ ] 13. HUD und Auswertung
Dateien: `public/index.html`, `public/main.js`, `game.js`.
Anzeige von HP, Waffe und Munition, Kristallzähler, Wellennummer, Dämmerungs-Countdown, Meldungen (Welle beginnt, Kristall gefunden, Dämmerung beginnt, gewonnen, verloren), Bildschirm mit Wiederkehr-Countdown für tote Spieler, Punktetabelle mit Tab. Am Ende der Nacht zeigt ein Bildschirm die Auswertung (`result`): erreichte Welle, erlegte Monster, Kopftreffer und Punkte je Spieler und für das Team.
Abnahme: Alle Werte aktualisieren sich während des Spiels, die Auswertung erscheint bei `won` und `lost`.

### [ ] 14. Pickups
Dateien: `game.js`, `public/world.js`, Tests.
Medikits und Munitionskisten an den Plätzen aus `level.json`, Aufnahme durch Berühren, Wiederkehr nach 25 s.
Abnahme: Tests: Aufnahme erhöht HP oder Munition bis zum Höchstwert, Wiederkehr nach der Wartezeit.

### [ ] 15. Rundencheck
Dateien: nach Bedarf.
Eine Nacht von Anfang bis Ende durchspielen (zwei Browserfenster) und offensichtliche Fehler beheben, etwa Monster, die in Wänden stecken, unerreichbare Kristalle oder fehlende Anzeigen. Zahlen in der Regeltabelle bei Bedarf anpassen.

## Regeln für die Umsetzung

- Pro Aufgabe nur die genannten Dateien ändern, ein Commit pro Aufgabe, danach die Aufgabe hier abhaken.
- Keine Build-Werkzeuge und keine neuen npm-Pakete. Three.js kommt ausschließlich über die Import-Map in der festen Version.
- Der Server bleibt autoritativ. Der Client schickt nur Eingaben.
- Die Arbeitsweise aus `AGENTS.md` gilt (eigener Branch, `npm test` vor dem Merge, `STATUS.md` pflegen).
- Scheitert eine Aufgabe nach zwei Versuchen, aufhören, das Problem in `STATUS.md` beschreiben und die nächste Aufgabe nicht beginnen. Der Besitzer wechselt dann für diese Aufgabe auf ein stärkeres Modell.
- Fotos gehören nicht ins Repository. Nur verkleinerte Texturen (unter 500 KB je Datei) kommen nach `public/textures/`. Ausnahme sind die Moodboards in `referenz/` (nur zum Ansehen, werden nicht ausgeliefert).
