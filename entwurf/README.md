# Bergdorf nach Nutzerskizze

Vorschau Entwurf 10: https://risinghurricane.github.io/nachtjagd/entwurf/?v=10

Norden ist -z: Burg westlich auf freiem Felssporn, großer Südwestsee, ummauertes Hangdorf rechts der Mitte. Ein innerer Ring weicher Mittelberge (103–208 m) und eine äußere Reihe schroffer Hochgipfel (235–436 m) umschließen die Welt. Unebene Vorberge füllen die Lücke hinter dem Dorf. Beide Bergtypen variieren reproduzierbar in Höhe, Breite, Tiefe, Ausrichtung und Abständen. Gewellte Bergrücken füllen die tiefen Spalten zwischen den Bergreihen. 140 Hangbäume und 140 Bäume auf den Sätteln bilden kleine Gruppen; drei gezielte Lichtungen gleichen sie aus. world-layout.js enthält Orte, Grundhöhen, See, Wald und Häuser; blockout.js erzeugt die Szene. Kein Build-Schritt.

28 Häuser in vier groben Volumenformen stehen versetzt und unterschiedlich gedreht in kleinen Gruppen. Der unregelmäßige Dorfrand mit Vorsprüngen und Einzügen bestimmt Mauer und Waldkante. Kirche, Höfe, Mauer mit drei Toren und drei zusätzlich offenen Abschnitten und zwei begehbare Treppenwege. Aufgelichteter Wald mit 3380 Bäumen, mit größeren Stammabständen, kleineren Kronen, Lichtungen, einzelnen Baumgruppen und niedrigem Bewuchs. Sechs kleine Gruppen aus insgesamt 96 höheren Buschformen ergänzen Dorf- und Wegränder. Kronen beginnen mindestens 4 m über dem Boden; nur Stämme kollidieren. Modelle bleiben bewusst Quader und Kegel.

road-layout.js beschreibt 18 Straßen/Gassen einschließlich der beiden Treppen. road-profile.js verbindet Kreuzungen und begrenzt Längsneigungen auf 18 %. Fahrbahnen sind quer waagerecht; der Boden erhält weiche Einschnitte und Aufschüttungen. stairs.js erzeugt waagerechte Trittflächen mit höchstens 20 cm Stufenhöhe; dieselben Tritte setzen die Augenhöhe. Das siebenbogige Viadukt bleibt rund 135 m lang und begehbar; Brüstungen/Pfeiler blockieren, offene Bögen lassen sich unten durchqueren.

Ansichten: Dorf, Hochebene, Draufsicht, Burg, Viadukt und Rundgänge auf Brücke, Waldweg, Dorftreppe und Dorfplatz. Ziehen dreht, Mausrad zoomt, rechts ziehen verschiebt. Rundgang: WASD/Pfeiltasten, Ziehen zum Umsehen, Shift schneller, Esc zurück. Keine Kämpfe oder Koop-Verbindung in der Layoutstudie.

## Neue Orte als grobe Baukörper

landmarks.js ergänzt eine Holzwindmühle im Süden, einen Steinkreis aus zehn Menhiren mit vier Decksteinen nördlich des Dorfs, eine Klosterruine mit offenem Hof und Kapellenresten im Osten sowie vier Seehäuser mit begehbarem Steg. West- und Nordmine sind kurze überdachte Vorstollen mit Holzrahmen, Schienen und dunklem Abschluss; ein unterirdisches Netz ist noch nicht ausgebaut. Fünf zusätzliche Zugangswege verwenden dasselbe querebene Straßenprofil. Kleine Lichtungen halten die Orte sichtbar. Das Menü Neue Orte bietet direkte Ansichten aller Ergänzungen.

## Gelände modellieren

Berge formen öffnet Anheben, Absenken, Glätten und Ebnen. Links ziehen malt, rechts dreht, Alt + links verschiebt. Radius/Stärke sind einstellbar. Ebnen übernimmt die Höhe beim Strichbeginn. Bauplätze, Burg, Ufer und Straßen sind standardmäßig geschützt; die Schutzmaske ist abschaltbar. Straßenprofile, Tritte und Widerlager bleiben eben; Häuser, Vegetation und Treppensockel folgen dem bearbeiteten Gelände. 24 Schritte Undo/Redo.

Das Gelände nutzt 321×281 Punkte bei 5 m Rasterweite, Grundform bergdorf-entdeckungsorte-2026-10-11-v7 und Browser-Schlüssel nachtjagd-bergdorf-entdeckungsorte-v7. Änderungen bleiben lokal und verändern weder GitHub noch andere Spieler. Datei speichern exportiert nachtjagd-berge.json; Datei laden prüft Format v2, Grundform, Raster und Werte. Andere Grundformen werden abgewiesen; vorherige Browserstände bleiben erhalten.

68 automatisierte Tests: 35 bestehende Server/Client-, neun Editor-, dreizehn Weltlayout-, fünf Straßen-, vier Viadukt- und zwei Treppen-Tests. 21 Browserprüfungen unter ?test=terrain prüfen unter anderem Querneigung, freie Wegverbindungen, Treppen, Gebäudesockel und Geländeanschlüsse. Treppenbewegung und Editor mit Undo/Redo und Wiederherstellung nach Reload sichtbar geprüft.

Die sichtbare Kennung Entwurf 10 und Skriptadressen mit ?v=10 verhindern gemischte alte/neue Dateien. Bei Veröffentlichung Kennung, Direktlink und Skriptzusätze gemeinsam ändern; bei inkompatiblen Grundformänderungen zusätzlich Basis und Speicherschlüssel erhöhen.

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
