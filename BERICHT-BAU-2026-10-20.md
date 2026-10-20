# Wedderleuchte – Werkstattbericht Bau (20.10.2026)

Gebaut aus dem Design-Konfigurator-Link vom 20.10.2026, ganz mit Opus. Online: https://stephandel.github.io/wedderleuchte/

## Geändert

- Projektpaket aus dem Konfigurator erzeugt (DESIGN.md, CLAUDE.md, tokens, Symbole, App-Symbol „Linse“).
- App auf dem Code der WeddaApp aufgebaut (die Einstellungen sind fast gleich) und angepasst:
  - Hintergrund: Himmel-Verlauf nach aktuellem Wetter (klar, Dämmerung, bewölkt, Nebel, Regen, Gewitter, Schnee, Nacht), Schleier, weiße Schrift, Kacheln als dunkles Glas.
  - Kopfzeile: unter dem Ort „Modell: Beste Mischung“.
  - Aktuell-Kachel: Antippen der linken Hälfte wechselt rechts zwischen Werten und Radar-Karte; die Wahl bleibt gespeichert.
  - Tab-Leiste: runder Kamera-Knopf in der Mitte, öffnet gleich die Kamera.
  - Teilen-Bild: Format wie das Foto (kurze Seite 1080 px, 9:16 bis 16:9), Farbton des Bands automatisch nach Helligkeit des Fotos.
  - Nicht übernommen aus der WeddaApp: DWD-Daten und Kamera-Studio (stehen nicht im Paket).
- Zwei Fehler, die es so auch in der WeddaApp gibt, hier behoben:
  - Die Farben von Diagramm (Graphs) und Karte kamen nie an, weil die Stilregel am falschen Element hing.
  - Der Offline-Speicher löschte beim Aktualisieren auch die Speicher anderer Apps unter stephandel.github.io.

## Geprüft

- `node tests/app.test.js` in WebKit: 36 von 36 Prüfungen bestanden. Geprüft wurden:
  - Module und Reihenfolge, Kopfzeile, Tab-Leiste
  - Wechsel der Aktuell-Kachel mit Speichern
  - Graphs, Rad/Sat, Mehr
  - Teilen: Format, heller und dunkler Farbton, JPEG
  - 390 px, Dunkelmodus, 130 % Schrift, Querformat, offline
  - Kontrast auf allen acht Verläufen, Version des Offline-Speichers
- Der erste Lauf hatte 3 Fehler. Behoben wurden zwei Testfehler (falscher Selektor) und ein echter Kontrastfehler (klarer Himmel 4,28:1). Danach fiel auf dem Bildschirmfoto die unlesbare Datumsfahne im Diagramm auf, auch sie ist behoben.

## Offen

- Auf dem iPhone ausprobieren:
  - „Zum Home-Bildschirm“
  - Kamera-Knopf und Teilen über das Teilen-Menü
  - Standort-Abfrage
  - Radar und Karten mit echtem Netz (im Test absichtlich abgeschaltet)
- Der Name auf dem Home-Bildschirm könnte als „Wedderleuc…“ abgeschnitten werden (13 Zeichen).
- Webcam-Modul: im Konfigurator an, aber ohne Quelle und ohne Erlaubnis eines Betreibers, deshalb nicht eingebaut.
- Die beiden behobenen Fehler stecken noch in der WeddaApp.
