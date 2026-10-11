# Musik

`tracks.json` listet die Stücke. Neue Datei hier ablegen und einen Eintrag ergänzen:
`{ "file": "name.mp3", "title": "Anzeigename", "moods": ["explore"], "volume": 1 }`.

Stimmungen: `dusk` (Auftakt im Abendrot, erste 2,5 Minuten der ersten Welle), `explore` (ruhige Nacht zwischen den Wellen),
`tension` (Welle läuft), `combat` (viele Gegner in 28 m Umkreis, Endkampf), `victory` (Morgengrauen). Ein Stück darf mehrere Stimmungen tragen.
`volume` (0 bis 1) gleicht zu laute Stücke an. Die Regie steht in `public/entwurf/music.js`.
