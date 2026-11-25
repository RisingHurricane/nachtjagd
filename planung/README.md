# Planung

`dorfplan.html`: Grobentwurf für ein neues Dorflayout (Entwurf H), getrennt vom Spiel. Häuser als Quader auf dem echten Dorfgelände (Kontur, Tore, Kirche und Hang wie in `public/entwurf/world-layout.js`). Marktplatz vor der Kirche, Hauptstraße West–Ost, zweite Straße im Süden, Gassen, dichter und höherer Kern, lockerer Rand mit Höfen. Das Zentrum besteht aus unregelmäßigen Voronoi-Blöcken, die lückenlos in Parzellen geteilt werden; Gassen sind die Grenzen zwischen den Blöcken, dazu Innenhöfe und ein zweiter kleiner Platz.

Ansehen: Datei ist ein Seiteninhalt für Claude-Artefakte (ohne eigenes `<html>`-Gerüst) und lädt Three.js r128 von cdnjs. Lokal in eine leere HTML-Seite einbetten oder als Artefakt veröffentlichen. Veröffentlichte Fassung: https://claude.ai/artifact/2xu24MuJde9h6rTo89Xjrz (privat, nur für Light).

Erst wenn Light das Layout freigibt, wird es ins Spiel übernommen ("Planungsdaten kopieren" liefert Straßen und Häuser als JSON).
