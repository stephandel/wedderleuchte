# Nutzer-Durchgang Wedderleuchte – 21.10.2026

Stand `main` a671c83. Geprüft wie ein Nutzer mit Playwright/WebKit (Safari-Motor) in 390 × 844 (iPhone), 1280 × 800 (Mac), 844 × 390 (Querformat) und 130 % Schrift. Wetterdaten aus der Attrappe `tests/fixtures/open-meteo-mannheim.json` (Wetterlage per `current.weather_code` verändert: Heiter, Bewölkt, Nebel, Regen, Schnee, Gewitter, Dämmerung, Nacht), Ortssuche aus einer Attrappe; RainViewer und Kartenkacheln waren gesperrt (Radar zeigt deshalb „gerade nicht erreichbar“ – das ist kein Fund). Teil 1 (Durchgang) ohne Codeänderung, Behebungen danach in Commit d4d8d50 auf Zweig `durchgang-wedder`.

Bildschirmfotos: `/private/tmp/claude-501/-Users-stephanhandel-KI-Projekte/f6383d02-b902-4603-adb1-44563a289b95/scratchpad/durchgang-wedder/` (Namen unten; Sitzungs-Zwischenspeicher, kann verschwinden). Prüfskripte: Unterordner `skripte/`, Protokolle `protokoll-*.txt`.

Konsole: in allen Durchgängen (iPhone, Mac, Querformat, 130 %, Studio) keine Fehler.

---

## 1. Was ein Nutzer sieht

**Start** – `390x844-01-start-voll.png`, Mac `1280x800-01-start.png`, quer `844x390-01-start.png`
Kopf mit Ort und „Modell: Beste Mischung“, Orte-, Such- und Teilen-Knopf. Darunter Aktuell (Symbol, Temperatur, Wetterlage, Gefühlt, Wind, Böen, Regen, Feuchte, Windrose), „Nächste Stunden“ (3 Zeitpunkte), 8-Tage-Tabelle, Regenradar mit „Trocken bis …“, Chip „Karte öffnen“ und 8 Balken für die nächsten 2 Stunden, Quellenzeile. Verständlich, Reihenfolge wie in `CLAUDE.md`. Kein seitliches Scrollen, kleinste Schrift 12 px, keine Tippfläche unter 44 px. Am Mac steht die Stundenkachel in halber Breite mit leerer Fläche daneben (Fund 6).

**Himmel-Verlauf nach Wetterlage** – `390-himmel-<lage>.png` (heiter, bewoelkt, regen, nacht, gewitter, schnee, nebel, daemmerung)
Alle acht Lagen werden richtig erkannt. Kontrast des Textes im Bild gemessen (Text unsichtbar gemacht, Hintergrund aus dem Bildschirmfoto, ganze Seite durchgescrollt, Kopf und Tab-Leiste getrennt): alle Texte ≥ 4,5:1 außer dem Chip „Karte öffnen“ (Heiter 3,7, Schnee 4,1, Bewölkt 4,3, Nebel 4,45; Fund 1). Kopf und Tab-Leiste hell wie dunkel ≥ 10:1.

**Aktuell-Kachel (Werte ↔ Radar)** – `390x844-02-aktuell-radar.png`
Tipp auf die linke Hälfte wechselt rechts zwischen Werten und Radar, der Fokus bleibt auf dem Knopf. Die Antwort „Das Radar ist gerade nicht erreichbar“ erscheint bei gesperrtem RainViewer sauber als Text.

**Regenradar-Kachel** – `390x844-03-regenradar-kachel.png`
Kachel und Chip öffnen Rad/Sat. Chip siehe Fund 1.

**Rad/Sat** – `390x844-04-radsat.png`; **Graphs** – `390x844-05-graphs.png`; **Mehr** – `390x844-06-mehr-voll.png`
Rad/Sat: Umschalter „Radar & Satellit / Karten“, Ebenen-Leiste, Zoom, Vollbild, Zeitleiste. Graphs: Meteogramm mit vier Zeilen, Zoom-Knöpfe unter dem Diagramm (nicht darüber), Knopfleiste. Mehr: Ortssuche, Orte und Favoriten mit Stern, Darstellung (Wind-Einheit, Schalter „immer im Vollbild“), Quellen. Eine kurze Seite (1254 px), gut überschaubar.

**Ortswechsel per Suche** – `07-suche`, `08-neuer-ort`, `09-favorit`
„Heidelberg“ → Treffer mit Region → Tipp wechselt zum Wetter-Reiter, Kopf zeigt „Heidelberg“, der Ort steht danach in der Liste. Favoriten-Stern: Tipp setzt den Stern, Fokus bleibt auf dem Stern, Favoriten stehen oben. Nach dem Ortswechsel lag der Fokus auf dem Seitenkörper (Fund 3).

**Vollbild** – `10-vollbild-graphs`, `11-vollbild-karte`, `12-immer-graphs`, `13-immer-radsat` (je 390, 1280, 844)
⤢ im Meteogramm und „Vollbild“ der Karte legen Blatt über den Bildschirm, Rest ist inert, „Fertig“ und Esc schließen, der Fokus kehrt auf den Auslöser zurück. Schalter „immer im Vollbild“: Graphs und Rad/Sat öffnen gleich als Blatt, „Fertig“ führt zum vorherigen Reiter (Mehr). Im Querformat zeigt das Meteogramm-Blatt nur etwa eine Zeile gleichzeitig (Fund 8).

**Wetterfoto-Studio** – `s1-leer`, `s2-foto`, `14-studio-foto`, `15-studio-profi`, `16-studio-bearbeiten`, `17-studio-teilen-optionen`, `18-studio-zahnrad`, `19-studio-galerie`
Kamera-Knopf öffnet Dateiauswahl mit `capture=environment` und das Studio, Teilen-Symbol oben öffnet es ohne Kamera. Mit Beispielfoto: Wetterkarte „8° Heiter Mannheim … WEDDERLEUCHTE“, Vorlagen, „Teilen“, „Teilen-Optionen“. Umschalter „Einfach | Profi“ im Kopf wirkt (Profi zeigt Licht, Kontrast, Wärme, Zuschnitt, Filter …). Blatt „Bearbeiten“ (Text, Wetterdaten, Format, Automatisch verbessert, Motiv aufs Foto), Teilen-Optionen, Zahnrad, „Alle (1)“ → Blatt „Meine Wetterfotos“ funktionieren, Esc schließt blattweise, Fokus kehrt zurück. Funde im Studio: eigener Abschnitt unten.

**130 % Schrift** – `390x844-gross-01-start-voll.png`: alles bricht um, kein seitliches Scrollen, kleinste Schrift 15,6 px.

**Querformat 844 × 390**: kein seitliches Scrollen, Aktuell-Kachel links, Stunden und Tage rechts; die Tab-Leiste verdeckt beim Scrollen Inhalt, wie vorgesehen.

**Tastatur** (WebKit, Tab überspringt Knöpfe wie in Safari; Wahltaste+Tab nimmt alle)
Reihenfolge: Orte, Suche, Wetterfoto, Aktuell-Umschalter, Regenradar, „Karte öffnen“, Tab-Leiste. Esc schließt das Studio, Fokus auf dem Kamera-Knopf. Fokusring siehe Fund 2.

---

## 2. Funde (App: app.js, app.css, index.html)

Schwere: **schwer** = Nutzer kommt nicht weiter oder versteht etwas falsch · **stört** = fällt auf, kostet Zeit oder Vertrauen · **klein** = Schönheitsfehler.

| Nr. | Wo | Was | Schwere | Beleg | Vorschlag | Stand |
|---|---|---|---|---|---|---|
| 1 | Start, Regenradar-Kachel, Chip „Karte öffnen“ | Akzentblau `#A8D1FF` auf hellem Himmel: Kontrast Heiter 3,7:1, Schnee 4,1, Bewölkt 4,34, Nebel 4,45 (Mindestwert 4,5:1 laut `CLAUDE.md`) | stört | `tests/durchgang.test.js` Abschnitt 1 (vorher rot); `app.css` `.chip` nutzt `--akzent-text` | Chip-Schrift weiß (`--auf-himmel-text`) | behoben in d4d8d50 (jetzt 5,9 bis 12,4:1) |
| 2 | Startseite, Tastaturfokus | Fokusring blau (`--akzent`) auf blauem Glas: Heiter nur etwa 1,8:1 (Sichtbarkeit mindestens 3:1); wer mit Tastatur bedient, verliert den Fokus aus dem Blick | stört | `tests/durchgang.test.js` Abschnitt 2 (vorher rot); `app.css:10` | Ring auf den Kacheln weiß | behoben in d4d8d50 |
| 3 | Mehr → Ort wählen | Nach dem Ortswechsel liegt der Fokus auf dem Seitenkörper (Suchtreffer ist weg); Tastatur-/VoiceOver-Nutzer starten oben | klein | `tests/durchgang.test.js` Abschnitt 3 (vorher rot); `app.js` `ortWaehlen` | Fokus auf den Ortsnamen im Kopf | behoben in d4d8d50 (`#kopfTitel` mit `tabindex="-1"`) |
| 4 | Mehr | Der App-Name steht zweimal untereinander (Kopf und große Überschrift) | klein | `390x844-06-mehr.png` | Vorgabe in `CLAUDE.md` („oben der App-Name als Titel“); bewusst belassen | offen: Vorgabe |
| 5 | Mehr, Schalter „immer im Vollbild“ | Schalter 24 × 24 px; die ganze Zeile (105 px hoch) ist antippbar und damit in Ordnung. In Playwright-WebKit erscheint er als weißes Kästchen, auf dem iPhone (Safari) vermutlich als Schalter | klein | `390x844-06-mehr.png` | auf echtem iPhone prüfen | offen: nur auf iPhone prüfbar |
| 6 | Mac (1280 px), Start | „Nächste Stunden“ nimmt die halbe Breite, rechts bleibt eine leere Fläche | klein | `1280x800-01-start.png` | Stundenkachel über die volle Breite oder Regenradar daneben (Rasterregel in `DESIGN.md` prüfen) | offen: Gestaltungsfrage für Stephan |
| 7 | Graphs, Rad/Sat (Bausteine) | Beschriftungen im Meteogramm („Sonne“, „Regen“, Achsen) und Kartentitel 11 px (erlaubt, an der Grenze); Zeit-Regler der Karte 28 px hoch (`wk-range`); Bausteine dürfen hier nicht geändert werden | klein | `protokoll-390x844-a.txt` „[graphs]“, „[radsat] Messung“ | in der Quelle der Bausteine (`WetterPro Nachbauten/gemeinsam/`) anheben | offen: Baustein, nicht hier änderbar |
| 8 | Graphs, Vollbild im Querformat | Das Meteogramm-Blatt zeigt gleichzeitig nur etwa eine Zeile (Sonne) bis zum Wischen | klein | `844x390-10-vollbild-graphs.png` | Baustein: Zeilen im Querformat niedriger | offen: Baustein |

Zählung App: schwer 0 · stört 2 (1, 2) · klein 6 (3 behoben, 4 bis 8 offen).

## Studio-Funde (für die Quelle Kamera Konfigurator/src)

Nicht hier behoben (Dateien in `lib/kamera-studio/` sind Kopien).

| Nr. | Wo | Was | Schwere | Beleg | Vorschlag |
|---|---|---|---|---|---|
| S1 | Studio, nach Foto laden | Fokus liegt danach auf dem Seitenkörper, nicht im Studio (Tab startet oben); Aufruf `focus()` fehlt nach dem Laden | klein | `390x844-14-studio-foto.png`, Protokoll „[studio] Fokus nach Foto“; `lib/kamera-studio/ks-studio.js` (einziger `focus()`-Aufruf Zeile 2172, nur im Blatt-Kreis) | Fokus nach dem Laden auf „Empfohlen“ oder „Teilen“ |
| S2 | Studio, Galerie-Hinweis | „Nur auf diesem iPhone gespeichert“ steht auch am Mac | klein | `lib/kamera-studio/ks-studio.js:121` (`GAL_HINWEIS`), `390x844-19-studio-galerie.png` | „auf diesem Gerät“ |
| S3 | Studio am Mac (1280 × 800) und quer (844 × 390) | Vorlagen-Spalte: zweite und dritte Reihe unten abgeschnitten, nichts zeigt, dass es weitere gibt | stört | `1280x800-14-studio-foto.png`, `844x390-14-studio-foto.png`; `lib/kamera-studio/ks-studio.css` (Vorlagenbereich) | Rest-Rand sichtbar lassen oder einreihig querscrollend |
| S4 | Studio, Profi im Querformat | Beschriftungen „Zuschnitt, Anpassen, Filter, Wetter, Text“ 11 px (erlaubt, an der Grenze) | klein | Protokoll `844x390-b`, „[studio profi] Maße“ | auf 12 px |

---

## 3. Was gut ist

- Himmel-Verlauf: acht Lagen richtig erkannt, Text auf Kacheln bis auf den Chip überall ≥ 4,5:1.
- Kopf und Tab-Leiste: Kontrast ≥ 10:1, hell wie dunkel.
- Vollbild: Blatt, inert, „Fertig“/Esc, Fokus kehrt zurück; Schalter „immer“ wirkt.
- Ortssuche: ein Tipp, sofort neuer Ort, automatisch in der Liste; Stern behält den Fokus.
- Studio: Einfach/Profi, Bearbeiten, Optionen, Zahnrad, Galerie; Esc schließt blattweise, Fokus kehrt zurück.
- 130 % Schrift und Querformat: kein seitliches Scrollen, nichts abgeschnitten (gemessen).
- Keine Konsolenfehler.

## 4. Nicht geprüft

- Echte Kamera, System-Teilen-Blatt, „Einfügen“, Freistellen in Fotos, Haptik, Safe Areas und Schalter-Aussehen auf dem iPhone.
- Echtes Radar (RainViewer) und Kartenkacheln (im Test gesperrt), Radar-Abspielen, Satellit/Infrarot, Wischen und Zoomen im Meteogramm.
- „Mein Standort“ (GPS-Rückfrage).
- Dunkelmodus: nur Kontrast von Kopf/Leiste und Startseite gemessen (Chip-Fund gilt dort ebenso), nicht jeder Reiter angesehen.
- Offline-Verhalten und Service Worker (bestehende Tests grün, hier nicht neu bedient).
- Chromium/Firefox (nur WebKit).
