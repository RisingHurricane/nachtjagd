# Bergdorf nach Nutzerskizze

Vorschau Entwurf 04: https://risinghurricane.github.io/nachtjagd/entwurf/?v=04

Norden ist -z: kantiges Hochgebirge im Norden, Burg westlich auf freiem Felssporn, großer unregelmäßiger See im Südwesten, Bergdorf rechts der Mitte. Wald folgt dem grünen Bogen im Norden, Osten und Süden sowie dem zentralen westlichen Streifen der Skizze. `world-layout.js` enthält Orte, Höhen, Uferkontur, Waldmasken und Hauspositionen. `blockout.js` baut daraus die grobe Szene. Kein Build-Schritt.

28 Häuser in vier einfachen Volumenformen, Kirche und Umfassungsmauer mit drei Toren. Kleine Bauplätze sind geglättet, das übrige Dorf bleibt hügelig; zwischen Hausplätzen liegen rund 31 m Höhenunterschied. Die Burg liegt auf einem kantigen 102 m hohen Sporn mit Zufahrt über einen schmalen Rücken. 2400 instanzierte Bäume haben dünne Stämme und Kegelkronen ab 4 m. Nur Stämme blockieren den Rundgang. Modelle bleiben Quader und Kegel.

Ansichten: Dorf, Hochebene, Draufsicht mit Norden oben, Burg sowie Rundgänge im Wald und Dorf. Ziehen dreht, Mausrad zoomt, rechts ziehen verschiebt. Rundgang: WASD/Pfeiltasten, Ziehen zum Umsehen, Shift schneller, Esc zurück. Haus-, Mauer-, Stamm- und Wasserkollisionen. Die Studie besitzt keine Kämpfe oder Koop-Verbindung; Schlossinnenräume sind noch offen.

Die Berge umschließen die Hochebene ringsum. Eigene Hügel ersetzen die vorher durch die Bergfunktion versehentlich nivellierte Grundfläche. Das Seeufer steigt in den ersten 30 m nur rund 7 % an und geht anschließend in die Hügel über.

`viaduct.js` hält das gemeinsame Brückenprofil für Geometrie, Augenhöhe und Kollisionen. Ein rund 135 m langes Viadukt mit sieben Bögen führt über die Senke zur Burg. Die Fahrbahn ist begehbar; Brüstungen und Pfeiler blockieren, offene Bögen lassen sich unten durchqueren. Viadukt und Brücke betreten sind eigene Ansichten. Der Gelände-Editor schützt die Brücke standardmäßig; Widerlager und Pfeiler werden mit der Szene aktualisiert.

Die sichtbare Kennung Entwurf 04 und die Skriptadressen mit ?v=04 verhindern gemischte alte/neue Dateien im Browser. Bei der nächsten Veröffentlichung Kennung, Direktlink und Versionszusätze gemeinsam ändern. Neue Grundformkennung: bergdorf-gebirgsring-2026-10-10-v2. Dateien der vorherigen Grundform werden abgewiesen; alte Browserstände bleiben erhalten.

## Gelände modellieren

**Berge formen** öffnet Anheben, Absenken, Glätten und Ebnen. Links ziehen malt, rechts dreht, Alt + links verschiebt. Radius/Stärke sind einstellbar. Ebnen übernimmt die Höhe am Strichbeginn. Bauplätze, Burg und Ufer sind standardmäßig geschützt; Schutzmaske abschaltbar. 24 Schritte Undo/Redo. Wege, Häuser, Bäume und Augenhöhe folgen der Oberfläche.

Änderungen bleiben lokal im Browser und ändern weder GitHub noch andere Spieler. **Datei speichern** exportiert `nachtjagd-berge.json`; **Datei laden** prüft Format v2, Grundformkennung, Raster und Werte vor Übernahme. Laden und Zurücksetzen sind rückgängig. Die Skizzenwelt nutzt `nachtjagd-bergdorf-gebirgsring-v2`; vorheriger Browserstand bleibt unter seinem alten Schlüssel erhalten. Dateien der alten Grundform passen nicht auf die neue Karte und werden abgewiesen. Bei Änderungen der Basis `world-layout.js:basis` und Speicherschlüssel aktualisieren.

54 Tests: 35 bestehende Server/Client-, acht Editor-, sieben Weltlayout- und vier Viadukt-Tests. Zwölf Browserprüfungen unter `?test=terrain` prüfen Relief, Hangdorf, Burg, See, Baumfreiheit, Tore/Kollisionen, Wegverbindungen und Oberflächenanschlüsse. Alle bestehen. Waldbewegung und Ansichten sichtbar geprüft. Pinsel, Undo/Redo und Wiederherstellung nach Reload auf der neuen Karte geprüft; Teständerungen zurückgesetzt. Datei-Export/-Import im vorherigen Editor geprüft, das neue Grundformformat zusätzlich automatisiert.

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
