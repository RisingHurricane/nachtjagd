# Übergabe an Claude: Spiellogik in der neuen Welt

Stand: 2026-10-11. Erste Solo-Integration umgesetzt; siehe Prüfung unten.

## Ziel und Reihenfolge

Der Nutzer möchte die vorhandene gute Spiellogik der neuesten Altay-Version in die gemeinsam entwickelte Bergdorf-Welt übernehmen. Zuerst Spielbarkeit und Kollisionen, danach Grafik verfeinern. Claude baut parallel Burg und Kirche. Diese später als separate Modelle an die vorhandenen Orte setzen; Aufstellhöhe, Maßstab, Zugänge und Kollisionen abstimmen. Keine ungefragte Umgestaltung des bestätigten Weltlayouts.

## Verbindlicher Ausgangspunkt

- Repository: RisingHurricane/nachtjagd. Arbeitsbranch codex/village-layout, PR #1 gegen main.
- Lokaler Checkout: C:/Users/User/Documents/Codex/2026-10-10/https-github-com-https-github-com/work/nachtjagd.
- Aktuelle veröffentlichte Layoutvorschau: https://risinghurricane.github.io/nachtjagd/entwurf/?v=13 . Veröffentlichung separat auf gh-pages.
- main bleibt unverändert: Die automatische Freigabe hat die Übernahme zuvor abgelehnt. Kein Merge ohne ausdrückliche Freigabe des Nutzers.
- AGENTS.md und STATUS.md zuerst lesen. Vor Änderungen aktuellen Remote-Stand holen; nicht andere Agentenänderungen überschreiben.

## Welche Spiellogik gemeint ist

Die richtige Quelle ist live/altay.vision/nachtjagd-neu/index.html, nicht public/game.js. Letzteres ist nur ein älterer Bewegungs-/Mehrspielerprototyp. Die neuere Version ist ein monolithisches HTML mit Wellen, Waffen, Gegnern, Beute, Händler, Relikten, Wetter, Fahrzeugen und Quests. Der private Altay-Koop-Backendcode ist nicht im Import enthalten. public/entwurf/spiel.html bleibt als älterer spielbarer Vergleich erhalten.

Relevante Funktionen in der Originalquelle:
- P/updatePlayer/moveTry um Zeile 3054; WDEF/resetWeapons/fire/updateWeapons ab 3096.
- TYPES ab 3344; spawnMonster/updateMonster/hitMonster ab 3767.
- Quest: findInteract/interact/takeSeal/ringBell/objText/objTarget ab 4093.
- waves/startWave/updateWaves ab 4174; drei Siegel, Glocke, danach 100 Sekunden überleben.
- updateGame ab 4489 verbindet die Abläufe.

Diese Funktionen schließen über alte Weltkoordinaten, NET, SURF, Gebäude, Shader, DOM und Audio. Nicht die komplette alte Welt über die neue legen. Spielzustand von Darstellung trennen und die neuen Höhen-/Kollisionsfunktionen als Adapter verwenden. Nur übernommene Teilfunktionen als umgesetzt bezeichnen.

## Bestätigte neue Welt

public/entwurf/world-layout.js definiert Orte, See, Bergreihen und Waldmasken. blockout.js baut Geometrie und Terrain-Editor. road-layout.js/road-profile.js, stairs.js und viaduct.js enthalten die gemeinsame Weggeometrie. landmarks.js ergänzt Windrad, Steinkreis, Klosterruine und Seehäuser.

Norden=-z; Dorf (90,45), Kirche Körper (91,6), Turm (91,21), Burg (-265,-100) auf Höhe 102. Großer See im Südwesten, vier eng gruppierte Seehäuser, kleine Insel (-258,198) mit drei Bäumen. 28 Dorfhäuser, unregelmäßige teilweise offene Mauer, Mittelberge vor höherem äußeren Gipfelring. Wege quer waagerecht, maximal 18 Prozent längs; Gelände-Dreiecke und begehbare Höhe müssen zusammenpassen. Viadukt: Oberseite und Durchgang unter Bögen nicht verwechseln.

Mineneingänge: West bei (-340,-15), Nord bei (-55,-185). Bisher nur kurze überdachte Vorstollen mit Rahmen/Schienen/dunklem Abschluss. Keine echten ausgeschnittenen Bergöffnungen und kein unterirdisches Tunnelnetz. Das bleibt ein eigener nächster Schritt.

Grundform bergdorf-seeinsel-2026-10-11-v8; Browser-Speicherschlüssel nachtjagd-bergdorf-seeinsel-v8. Beim späteren Koop dieselbe unveränderte Weltbasis für alle verwenden; lokale Editoränderungen dürfen nicht still zu abweichenden Kollisionen führen.

## Technische Übergabe der laufenden ersten Integration

Umgesetzt: public/entwurf/gameplay-core.js als reiner Zustand/Regelkern und public/entwurf/gameplay.js für Eingabe/HUD/Platzhalter. blockout.js liefert den Weltadapter (Höhen, Kollision, Strahlprüfung und Wegnavigation). Spiel starten beziehungsweise ?v=13&play=1 öffnet den Solo-Test. Neun neue Kerntests und insgesamt 78 Node-Tests bestanden. Die veröffentlichte Ansicht wurde geprüft: alle 22 Gelände- und acht Spieladapterprüfungen bestanden. Spielstart, Schießen (Munition 6/30 auf 5/30), Nachladen (6/29), Pause/Fortsetzen und Rückkehr zum Layout sichtbar bestätigt. Ein vollständiger manueller Durchlauf der drei Siegel wurde noch nicht durchgeführt.

Geplant für die erste spielbare Übernahme: Bewegung auf neuen Wegen/Hängen, Revolver und Nachladen, einfache Boden-Gegner/Wellen nach den vorhandenen Waffen-/Gegnerwerten, Leben/Tod/Neustart und drei Mondsiegel mit Glockenziel. Modelle bleiben grob. Vollständige Spezialgegner-KI, Händler, Relikte, Wetter, Fahrzeuge und Online-Koop sind damit nicht automatisch übertragen.

## Prüfen und veröffentlichen

Node ist verfügbar; node --test führt die Tests aus. Lokale Netzwerk-Tests brauchen hier erlaubten Netzwerkzugriff. Browserzugriff auf localhost war in dieser Sitzung blockiert; eine veröffentlichte Vorschau lässt sich überprüfen. Keine ungeprüfte Behauptung von Online-Koop.

Quelländerungen auf codex/village-layout sichern; gh-pages nur mit den öffentlichen Dateien aktualisieren. Beim Veröffentlichen sichtbare Entwurfnummer und alle Skript-Queryversionen zusammen erhöhen. PR #1 und STATUS.md nachführen. Keine privaten Dateien aus D:/Dokumente/Game References hochladen.

## Danach

1. Erste Integration gründlich durchspielen: Häuser, Stämme, Tore, Treppen, See, Steg und Viadukt; Schüsse dürfen Wände und Terrain nicht durchdringen.
2. Fehlende Spielmechaniken schrittweise aus der neuesten Quelle übernehmen, keine zweite widersprüchliche Regelbasis schaffen.
3. Minenöffnungen und begehbare Tunnel mit separaten Boden-/Deckenflächen und höhenabhängiger Kollision ergänzen.
4. Geteilten Spielzustand für 1–4 Teilnehmer aufsetzen und mit mehreren echten Clients testen; GitHub Pages ist die statische Vorderseite, kein WebSocket-Server.
5. Burg/Kirche integrieren und erst anschließend weitere endgültige Modelle/Grafik ausbauen.

### Konkrete Anschlussstellen

- NachtjagdGame.create({world,random}) bietet start/pause/resume/setLook/step/reload/selectWeapon/interact/snapshot/drainEvents. world liefert spawn, floor, blocked, rayDistance, spawnEnemy, objectives, bell und optional chaseTarget. chaseTarget gibt eine Richtungsdifferenz [dx,dz] zurück, keinen absoluten Zielpunkt. Kamera schaut nach [sin(yaw),sin(pitch),cos(yaw)].
- Neue Weltziele: Kirche (90,30), Westmine (-349,-27), Burghof (-251,-100), Glocke (90,27). Vorläufig außen, weil Häuser/Burg/Kirche noch solide Platzhalter ohne Innenräume sind. Bei Claudes Modellen nicht bloß Optik ersetzen: Ein-/Ausgänge und Collider auf dieselben Punkte abstimmen.
- Erste Übernahme ist bewusst begrenzt: einfache Verfolgung mit Straßenwegen statt sämtlicher Original-KI, keine Sprünge/Fallphysik/Spezialattacken, kein Händler/Reliktsystem, kein Wetter/Fahrzeugcode. Ziel ist die überprüfbare Verbindung zur richtigen Welt. Multiplayer bisher nicht angebunden.
- Gelände-Editor und Layout bleiben getrennt vom Spielmodus. Solo folgt dem aktuell geladenen lokalen Gelände. Für Koop eine gemeinsame feste Basis festlegen.

### Gesicherter Stand zum Übernehmen

Entwurf 13 läuft auf gh-pages; Quellstand auf codex/village-layout, PR #1 aktualisiert. Im gleichen Branch weiterarbeiten oder davon einen eigenen Branch abzweigen, sonst fehlen Claude diese neuen Dateien. Die aktuelle main-Version enthält sie nicht. Am besten zuerst diesen Stand holen und node --test ausführen. Die Vorabfassung Entwurf 12 wurde durch Entwurf 13 ersetzt (Initialisierung der Weltmatrizen für Strahltests, keine Layoutbeschriftungen im Spiel).
