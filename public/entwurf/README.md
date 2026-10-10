# Bergdorf und Gelände-Editor

Der Nutzer beschreibt die Welt als Hochebene/Bergdorf. Über **Berge formen** lässt sich das Gelände direkt modellieren: Anheben, Absenken, Glätten und Ebnen. Linke Maustaste malt, rechte dreht die Ansicht, Alt + links verschiebt. Pinselradius und Stärke sind einstellbar. Ebnen übernimmt die Höhe am Beginn des Pinselstrichs. Dorf, Burg und See sind standardmäßig über eine Schutzmaske geschützt; die Maske kann ausgeschaltet werden. Ein Pinselstrich ist eine rückgängig machbare Änderung; 24 Schritte bleiben im Verlauf. Wege, Gebäude, Bäume und Augenhöhe folgen der geänderten Oberfläche.

Änderungen werden am Ende eines Strichs lokal in diesem Browser gespeichert. Sie ändern weder die veröffentlichte Grundform noch andere Spieler. **Datei speichern** exportiert `nachtjagd-berge.json`; **Datei laden** prüft Version, Raster, Anzahl und Wertebereich vor der Übernahme. Laden und Zurücksetzen sind rückgängig machbar. Bei nicht verfügbarem Browser-Speicher weist der Editor auf die Dateisicherung hin. Der Höhenpinsel und das Dateiformat liegen in `terrain-editor.js`, die Darstellung und Bedienung in `blockout.js`.

Validierung des Editors: sieben Tests für Pinsel, Schutzmaske, Glätten/Ebnen, Verlauf, Dateiformat und Zurücksetzen. Im Browser Pinselstrich, Rückgängig/Wiederholen, Wiederherstellung nach Reload sowie Datei-Export und erneutes Laden geprüft. Der Bearbeitungsstand blieb mit 248 geänderten Rasterpunkten erhalten. Der Testentwurf wird nicht veröffentlicht.

Neue Weltanordnung wartet auf die vom Nutzer angekündigte Skizze. Gewünscht: größerer See auf der anderen Seite, Dorf am Hang mit mehr unterschiedlichen Häusern und Umfassungsmauer, dichterer unterlaufbarer Wald, Burg auf freistehendem Felssporn, weiche Hügel sowie schroffer Burgberg und Bergspitzen. Keine Richtungsannahme für den See treffen.

Das Gelände bildet jetzt einen Talboden mit beidseitigen Höhenzügen, einem eingesenkten Seebecken und einem Burgplateau auf 48 m über dem Wasserspiegel. Der Dorfplatz liegt auf 2 m, die Kirchgasse steigt zur Kirchterrasse an. Bauplätze sind geglättet; einfache Gebäudesockel schließen an die Geländeoberfläche an. Wege und Bäume folgen dem Höhenmodell. Die Vorschau startet in der Talübersicht. Beim Durchlaufen folgt die Augenhöhe dem sichtbaren Geländedreieck; auch die Burgzufahrt und der offene Hof sind zugänglich.

Die Standardvorschau unter `/entwurf/` ist eine räumliche Blockout-Studie: Quader als Gebäude, Kegel als Bäume, einfache Flächen als Wege und Plätze. Das Raster hat 10 m Abstand. Dorfplatz, Marktstraße und Kirchgasse übernehmen die zuletzt erprobten Hauspositionen. Die übrigen Orte bleiben grobe Massen zur Beurteilung der Verbindungen.

`index.html` lädt `blockout.js` mit Layout, Höhenmodell und Bedienung. Ansichten: Dorf, ganzes Tal, Burg, Waldweg und Durchlaufen. Ziehen dreht, Mausrad ändert den Abstand, rechts ziehen verschiebt. Im Rundgang: WASD oder Pfeiltasten, Ziehen zum Umsehen, Shift schneller, Esc zurück. Kollisionen an Hauskörpern, Baumstämmen und See. Schlossräume sind noch nicht angelegt.

Die Vorlage in `live/` bleibt unverändert. Der bisherige spielbare Dorfentwurf bleibt separat als `spiel.html` erhalten. `node tools/build-village-preview.mjs` erzeugt nur diesen Vergleich, ohne den Blockout zu überschreiben. Keine neuen Abhängigkeiten und keine Fotos aus dem privaten Referenzordner hochgeladen.

Die Layout-Studie enthält keine Kämpfe oder Koop-Verbindung. Der spielbare Vergleich besitzt weiterhin Wellen und Interaktionen.

Online-Koop ist in dieser Vorschau bewusst nicht verbunden: Dem gesicherten öffentlichen Frontend fehlt sein privater Altay-Backendcode. Eine geänderte Welt darf außerdem nicht mit alten Räumen gemischt werden. MP3-Dateien werden nicht übernommen; die Vorschau spielt keine Musikaufnahmen ab. Die bisherige Altay-Version bleibt erreichbar.

Validierung: JavaScript-Syntax, Dorf-, Tal- und Burgansicht sowie Bewegung am Dorfhang im Browser geprüft. Unter `?test=terrain` prüfen sechs geometrische Kontrollen das Höhenrelief, Platzniveau, Burgplateau, Seebett, Gebäudesockel und die Wegoberflächen. Alle sechs bestehen. Die 35 vorhandenen Tests des separaten älteren Servers/Clients bestehen. Frühere 21 Bewegungsprüfungen gelten für `spiel.html`, nicht für den Blockout.

## Referenzen getrennt verwenden

- Dorf: `villagestreet.jpg`, `villagestreet2.jpg`, `village.jpg`, `village3.jpg`, `Bebenhausen2.jpg`.
- Wald: `wald.jpg`, `wald1.jpg`, `wald2.jpg`.
- Burg/Schloss außen: `castle*.jpg`, `cochem*.jpg`, `schloss.jpg`, `mtmichel.jpg`, `mtstmichel.jpg`, Vajdahunyad-Foto.
- Szene/Tal: `scene.jpg`, `valley.jpg`, `lake.jpg`, `mountains.jpg`, `mountains 2.avif`.
- Schloss innen: `int.jpg`, `int2.jpg`, `int3.jpg`, `lobby-lounge.jpg`; Deckenreferenz separat.
- Weitere einzelne Bauwerke und Monster bleiben eigene Referenzen.

Dieser erste Entwurf bearbeitet hauptsächlich den Dorfkern. Wald, Burg, Schlossräume und Bergkulisse erhalten später jeweils eine eigene Überarbeitung.
