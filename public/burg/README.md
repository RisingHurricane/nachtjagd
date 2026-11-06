# Burg (eigene Kopie, Stand Entwurf 31)

Getrennte Arbeitskopie der Burg für Light und Claude. Sie stammt aus `claude/grafik-laden` (Entwurf 31, gh-pages aa02809) und wird unabhängig von `public/models/` und `public/entwurf/` weiterentwickelt. Das Spiel lädt weiterhin die Originale; diese Kopie fließt erst nach Freigabe zurück.

- `kit.js`, `castle.js`, `castle2.js`, `castle-interior.js`: Modell (Vertrag in der Kopfzeile von `castle.js`, 1 Einheit = 1 m, Eingang +z).
- `castle-site.js`: Einsetzen in die Welt (Felssporn, Material-Zusammenfassung, Innenlichter). `castle-walk.js`: Begehbarkeit.
- `viewer.html`, `preview.html`: Ansicht im Browser (`npm start`, dann `/burg/viewer.html`).
- Tests: `test/burg.test.js`, `test/burg-walk.test.js`. GLB-Export: `node tools/export-burg-glb.mjs`.

Beim Zurückführen in das Spiel die geänderten Dateien nach `public/models/` und `public/entwurf/` kopieren und die Tests dort (`test/castle*.test.js`) angleichen.
