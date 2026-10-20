# Wedderleuchte: Projektpaket

Erzeugt am 20.10.2026 mit dem Design-Konfigurator.

1. Diesen Ordner nach `~/KI Projekte/Wetter Apps/Wedderleuchte` legen.
2. Den Inhalt von `CLAUDE.md` in die CLAUDE.md des Projekts übernehmen (oder die Datei so lassen, wenn es noch keine gibt).
3. Claude Code im Ordner starten und sagen: „Baue die App nach CLAUDE.md und DESIGN.md."

Inhalt: DESIGN.md (Regeln), tokens.css (Werte), design.json (alle Einstellungen), symbole.js (Wettersymbole), ikonen.js (Bedien-Symbole), base.css (Grundwerte, als Erstes einbinden), App-Symbol, manifest.json.

## Auf GitHub Pages veröffentlichen

1. Konto anlegen: github.com öffnen, „Sign up", E-Mail bestätigen. Kostenlos.
2. Projektordner bei GitHub anlegen (heißt dort „Repository"): oben rechts „+" → „New repository", Name `wedderleuchte`, „Public" wählen, „Create repository".
3. Dateien hochladen: im neuen Repository „Add file" → „Upload files", alle Dateien der fertigen App (index.html, tokens.css, … ) aus `~/KI Projekte/Wetter Apps/Wedderleuchte` hineinziehen, unten „Commit changes". Einfacher: Claude Code sagen „Lade die App auf GitHub hoch".
4. Veröffentlichen einschalten: „Settings" → links „Pages" → bei „Branch" „main" und „/ (root)" wählen → „Save".
5. Adresse: nach 1 bis 2 Minuten steht dort „Your site is live at https://stephandel.github.io/wedderleuchte/". Auf dem iPhone in Safari öffnen, Teilen → „Zum Home-Bildschirm".
6. Später ändern: Dateien genauso neu hochladen; die Seite ist nach 1 bis 2 Minuten aktuell. Bei einer Web-App im Service Worker die Versionsnummer erhöhen, sonst zeigt das iPhone noch die alte Fassung.

Dazu `meteogramm.js` und `meteogramm.css`: der Meteogramm-Baustein für den Reiter Graphs (unverändert übernehmen).

Projektangaben: Repo `wedderleuchte`, Test-Seite https://stephandel.github.io/wedderleuchte/, App-Version 0.9.0, Design-Version 1.

## Tokens in zwei Formaten

`DESIGN.md` beginnt mit einem YAML-Kopf nach Googles DESIGN.md-Schema (Farben, Schrift, Rundungen, Abstände, Bewegung, Bauteile), darunter stehen die Regeln in Prosa. `tokens.json` enthält dieselben Werte im W3C-Design-Token-Format (Hell und Dunkel getrennt), `tokens.css` als CSS-Variablen.
