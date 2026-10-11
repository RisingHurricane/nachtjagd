# Bergdorf nach Nutzerskizze

Vorschau Entwurf 13: https://risinghurricane.github.io/nachtjagd/entwurf/?v=13

Norden ist -z: Burg westlich auf freiem Felssporn, großer Südwestsee, ummauertes Hangdorf rechts der Mitte. Ein innerer Ring weicher Mittelberge (103–208 m) und eine äußere Reihe schroffer Hochgipfel (235–436 m) umschließen die Welt. Unebene Vorberge füllen die Lücke hinter dem Dorf. Beide Bergtypen variieren reproduzierbar in Höhe, Breite, Tiefe, Ausrichtung und Abständen. Gewellte Bergrücken füllen die tiefen Spalten zwischen den Bergreihen. 140 Hangbäume und 140 Bäume auf den Sätteln bilden kleine Gruppen; drei gezielte Lichtungen gleichen sie aus. world-layout.js enthält Orte, Grundhöhen, See, Wald und Häuser; blockout.js erzeugt die Szene. Kein Build-Schritt.

28 Häuser in vier groben Volumenformen stehen versetzt und unterschiedlich gedreht in kleinen Gruppen. Der unregelmäßige Dorfrand mit Vorsprüngen und Einzügen bestimmt Mauer und Waldkante. Kirche, Höfe, Mauer mit drei Toren und drei zusätzlich offenen Abschnitten und zwei begehbare Treppenwege. Aufgelichteter Wald mit 3380 Bäumen, mit größeren Stammabständen, kleineren Kronen, Lichtungen, einzelnen Baumgruppen und niedrigem Bewuchs. Sechs kleine Gruppen aus insgesamt 96 höheren Buschformen ergänzen Dorf- und Wegränder. Kronen beginnen mindestens 4 m über dem Boden; nur Stämme kollidieren. Modelle bleiben bewusst Quader und Kegel.

road-layout.js beschreibt 18 Straßen/Gassen einschließlich der beiden Treppen. road-profile.js verbindet Kreuzungen und begrenzt Längsneigungen auf 18 %. Fahrbahnen sind quer waagerecht; der Boden erhält weiche Einschnitte und Aufschüttungen. stairs.js erzeugt waagerechte Trittflächen mit höchstens 20 cm Stufenhöhe; dieselben Tritte setzen die Augenhöhe. Das siebenbogige Viadukt bleibt rund 135 m lang und begehbar; Brüstungen/Pfeiler blockieren, offene Bögen lassen sich unten durchqueren.

Ansichten: Dorf, Hochebene, Draufsicht, Burg, Viadukt und Rundgänge auf Brücke, Waldweg, Dorftreppe und Dorfplatz. Ziehen dreht, Mausrad zoomt, rechts ziehen verschiebt. Rundgang: WASD/Pfeiltasten, Ziehen zum Umsehen, Shift schneller, Esc zurück. Spiel starten öffnet einen ersten Solo-Spieltest. Online-Koop ist noch nicht verbunden.

## Neue Orte als grobe Baukörper

landmarks.js ergänzt eine Holzwindmühle im Süden, einen Steinkreis aus zehn Menhiren mit vier Decksteinen nördlich des Dorfs, eine Klosterruine mit offenem Hof und Kapellenresten im Osten sowie vier eng gruppierte Seehäuser mit begehbarem Steg und eine kleine Seeinsel mit drei Bäumen. West- und Nordmine sind kurze überdachte Vorstollen mit Holzrahmen, Schienen und dunklem Abschluss; ein unterirdisches Netz ist noch nicht ausgebaut. Fünf zusätzliche Zugangswege verwenden dasselbe querebene Straßenprofil. Kleine Lichtungen halten die Orte sichtbar. Das Menü Neue Orte bietet direkte Ansichten aller Ergänzungen.

## Gelände modellieren

Berge formen öffnet Anheben, Absenken, Glätten und Ebnen. Links ziehen malt, rechts dreht, Alt + links verschiebt. Radius/Stärke sind einstellbar. Ebnen übernimmt die Höhe beim Strichbeginn. Bauplätze, Burg, Ufer und Straßen sind standardmäßig geschützt; die Schutzmaske ist abschaltbar. Straßenprofile, Tritte und Widerlager bleiben eben; Häuser, Vegetation und Treppensockel folgen dem bearbeiteten Gelände. 24 Schritte Undo/Redo.

Das Gelände nutzt 321×281 Punkte bei 5 m Rasterweite, Grundform bergdorf-seeinsel-2026-10-11-v8 und Browser-Schlüssel nachtjagd-bergdorf-seeinsel-v8. Änderungen bleiben lokal und verändern weder GitHub noch andere Spieler. Datei speichern exportiert nachtjagd-berge.json; Datei laden prüft Format v2, Grundform, Raster und Werte. Andere Grundformen werden abgewiesen; vorherige Browserstände bleiben erhalten.

78 automatisierte Tests: 35 bestehende Server/Client-, neun Editor-, vierzehn Weltlayout-, fünf Straßen-, vier Viadukt-, zwei Treppen- und neun Spielkern-Tests. 22 Browserprüfungen unter ?test=terrain prüfen unter anderem Querneigung, freie Wegverbindungen, Treppen, Gebäudesockel und Geländeanschlüsse. Treppenbewegung und Editor mit Undo/Redo und Wiederherstellung nach Reload sichtbar geprüft.

Die sichtbare Kennung Entwurf 13 und Skriptadressen mit ?v=13 verhindern gemischte alte/neue Dateien. Bei Veröffentlichung Kennung, Direktlink und Skriptzusätze gemeinsam ändern; bei inkompatiblen Grundformänderungen zusätzlich Basis und Speicherschlüssel erhöhen.

## Spielbarer Vergleich

`spiel.html` bleibt als bisheriger spielbarer Dorfentwurf erhalten; `node tools/build-village-preview.mjs` erzeugt ausschließlich diesen Vergleich. Der ursprüngliche Import unter `live/` bleibt unverändert. Keine privaten Referenzfotos oder Musikdateien hochgeladen, keine neue Abhängigkeit.

Der öffentliche Import des neuesten Altay-Frontends enthält seinen privaten Koop-Backendcode nicht. Eine gemeinsame Spielwelt für 1–4 Teilnehmer ist ein späterer eigener Schritt. Die Altay-Version bleibt unverändert.

## Referenzen getrennt verwenden

- Dorf: `villagestreet.jpg`, `villagestreet2.jpg`, `village.jpg`, `village3.jpg`, `Bebenhausen2.jpg`.
- Wald: `wald.jpg`, `wald1.jpg`, `wald2.jpg`.
- Burg/Schloss außen: `castle*.jpg`, `cochem*.jpg`, `schloss.jpg`, `mtmichel.jpg`, `mtstmichel.jpg`, Vajdahunyad-Foto.
- Szene/Tal: `scene.jpg`, `valley.jpg`, `lake.jpg`, `mountains.jpg`, `mountains 2.avif`.
- Schloss innen: `int.jpg`, `int2.jpg`, `int3.jpg`, `lobby-lounge.jpg`; Deckenreferenz separat.
- Weitere einzelne Bauwerke und Monster bleiben eigene Referenzen.

Der Blockout legt die räumliche Verteilung fest. Endgültige Hausmodelle, Waldgrafik, Burgdetails und Schlossräume folgen nach dem Layoutfeedback.

## Erster Solo-Spieltest

Spiel starten verbindet die neue Welt mit einem ausgelagerten Teil der neuesten Spiellogik: Bewegung, Revolver, Nachladen, Wellen mit drei Boden-Gegnerarten, Leben/Tod, Mondsiegel bei Kirche, Westmine und Burg. E nimmt ein Siegel auf; die ersten zwei gesammelten Siegel schalten weitere Waffen frei. Danach die Glocke vor der Kirche läuten und 100 Sekunden überleben. WASD, Shift laufen, Maus umsehen, Klick schießen, rechts zielen, R nachladen, 1–3 Waffen, Esc Pause. Falls die Maus nicht eingefangen werden kann: zum Umsehen ziehen, zum Schießen kurz klicken. Pause bietet Neustart beziehungsweise Rückkehr zum Layout. Gegner/Objekte bleiben grobe Platzhalter.

gameplay-core.js enthält Spielzustand und Regeln ohne Three.js/DOM; gameplay.js verbindet Darstellung/Eingabe. Es sind 78 Node-Tests vorhanden (davon neun Spielkernprüfungen). ?test=terrain ergänzt acht Weltadapterprüfungen im ausgeblendeten Bericht #game-tests. Spezialgegner, Händler, Relikte, Wetter, Fahrzeuge, echte Minentunnel und Online-Koop sind noch nicht übertragen. Originalimport und Vergleich bleiben erhalten.

Veröffentlichte Ansicht geprüft: alle 22 Gelände- und acht Spieladapterprüfungen bestanden; Spielstart, Schussverbrauch (6/30 auf 5/30), Nachladen (6/29), Pause/Fortsetzen und Layout-Rückkehr sichtbar bestätigt. Ein vollständiger manueller Durchlauf aller drei Siegel bleibt für die nächste Sitzung.


### Modelltest: heruntergeladene Modelle

Sechs vom Besitzer bereitgestellte GLBs unter `public/assets/imported/`. `imported-models.js` ersetzt Baum-, Gegner- und Jeepdarstellung auf dem Stand von `claude/spiellogik` (6cd178d). Die drei Baumdateien ergeben acht einzeln verteilte Varianten; die zusammengesetzte Datei `low-poly_trees.glb` wurde dafür in Einzelobjekte getrennt. Waldpositionen, Terrainpinsel, Kollisionen, Sitzplätze und Fahrphysik stammen weiterhin aus der Welt bzw. dem Spielkern. Der Jeep fährt, hat aber im heruntergeladenen Modell keine separaten beweglichen Räder. Der Wendigo hat ein eigenes Skelett und eine Schleifenanimation je Gegner; das zweite Monster ist statisch. Ladefehler behalten die bisherigen Platzhalter. Die originalen Downloads bleiben unverändert erhalten.

Quellen und Namensnennung laut den mitgelieferten Modelldaten; Änderungen: Größen/Orientierung/Boden angepasst, Baumobjekte getrennt, Jeep-Präsentationsfläche ausgeblendet:

- monster — jwilson32 (https://sketchfab.com/jwilson32) — CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — https://sketchfab.com/3d-models/monster-33f0c8721e164c3296be9e889e4704e1
- low poly forest tree — ungureanuteofil (https://sketchfab.com/ungureanuteofil) — SKETCHFAB Standard (https://sketchfab.com/licenses) — https://sketchfab.com/3d-models/low-poly-forest-tree-48c948ae46804e7e85f9d98342b42623
- Low Poly Forest Tree Pack — 99.Miles (https://sketchfab.com/99.Miles) — CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b
- Low-poly trees — Sergey Egelsky (https://sketchfab.com/egelsky) — CC-BY-SA-4.0 (http://creativecommons.org/licenses/by-sa/4.0/) — https://sketchfab.com/3d-models/low-poly-trees-03523a05efdd4fafaca67ad118382900
- Willys Jeep Low Poly — InnocentBaraka (https://sketchfab.com/InnocentBaraka) — CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — https://sketchfab.com/3d-models/willys-jeep-low-poly-57ab28eb0f21472ead1f5dadf4e73a27
- Stylized Low-Poly Wendigo — PolyGoreStudio (https://sketchfab.com/Phu.99) — CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — https://sketchfab.com/3d-models/stylized-low-poly-wendigo-e93de51dcccf4525babc4249e2c43d7c
