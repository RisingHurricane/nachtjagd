# Dorfentwurf 01

Erster räumlicher Entwurf auf Grundlage von `nachtjagd-neu`, separat unter `/entwurf/`.

Der Dorfkern erhält einen gefassten Platz, eine Marktstraße und eine Kirchgasse. Neun bestehende Häuser rücken zusammen, fünf Häuser ergänzen die Straßenfronten. Unterschiedliche Dachneigungen, Gauben, Giebelhölzer und Sparrenköpfe verbessern die Konturen. Hausrotationen gelten nun auch für Zugänge und Hofdetails.

Die Vorlage in `live/` bleibt unverändert. Änderungen sind nachvollziehbar in `tools/build-village-preview.mjs`; `node tools/build-village-preview.mjs` erzeugt diese Vorschau samt lokalen Grafikdateien neu. Es werden keine Fotos aus dem privaten Referenzordner hochgeladen.

Ansichten unten links: Dorfplatz, Übersicht, friedlicher Rundgang und Spielen. Beim Rundgang: WASD bewegen, Pfeiltasten umsehen, Tab Karte, Esc Pause. Im eigentlichen Spiel bleiben Wellen und Interaktionen erhalten.

Online-Koop ist in dieser Vorschau bewusst nicht verbunden: Dem gesicherten öffentlichen Frontend fehlt sein privater Altay-Backendcode. Eine geänderte Welt darf außerdem nicht mit alten Räumen gemischt werden. MP3-Dateien werden nicht übernommen; die Vorschau spielt keine Musikaufnahmen ab. Die bisherige Altay-Version bleibt erreichbar.

Validierung: JavaScript-Syntax, 21 Bewegungsprüfungen im echten Browser (Marktstraße, Kirchgasse, Südausgang und alle 18 Hauseingänge mit Treppen), Sichtprüfung von Platz und Übersicht. Die 35 vorhandenen Repository-Tests betreffen den älteren separaten Server/Client und bestehen ebenfalls.

## Referenzen getrennt verwenden

- Dorf: `villagestreet.jpg`, `villagestreet2.jpg`, `village.jpg`, `village3.jpg`, `Bebenhausen2.jpg`.
- Wald: `wald.jpg`, `wald1.jpg`, `wald2.jpg`.
- Burg/Schloss außen: `castle*.jpg`, `cochem*.jpg`, `schloss.jpg`, `mtmichel.jpg`, `mtstmichel.jpg`, Vajdahunyad-Foto.
- Szene/Tal: `scene.jpg`, `valley.jpg`, `lake.jpg`, `mountains.jpg`, `mountains 2.avif`.
- Schloss innen: `int.jpg`, `int2.jpg`, `int3.jpg`, `lobby-lounge.jpg`; Deckenreferenz separat.
- Weitere einzelne Bauwerke und Monster bleiben eigene Referenzen.

Dieser erste Entwurf bearbeitet hauptsächlich den Dorfkern. Wald, Burg, Schlossräume und Bergkulisse erhalten später jeweils eine eigene Überarbeitung.
