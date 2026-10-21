/* ks-engine.js – Technik (Engine) des Kamera-Studios (Paket E, 16.10.2026)
 *
 * Eine Technik für alle Oberflächen: Foto laden → bearbeiten → Wetterdaten/Text/Sticker → Bild/PDF/Postkarte.
 * Schnittstelle: siehe SPEC.md „Engine-Schnittstelle". Global: window.KSEngine. Keine Abhängigkeiten
 * außer window.KSSymbole (ks-symbole.js, optional). Einziger fremder Server: Open-Meteo in wetterZumZeitpunkt.
 *
 * Zeichen-Reihenfolge (fest, für Vorschau und Export identisch):
 *   1 Quelle → 2 Drehen/Spiegeln/Begradigen (mit Vergrößerung ohne leere Ecken) → 3 Zuschnitt im Format
 *   → 4 Anpassungen + Filter (eigene Pixel-Rechnung, Nachschlagetabellen + Farbmatrix), Vignette, Körnung
 *   → 5 Wetter-Effekte → 6 Rahmen → 7 Wetter-Overlay (6 Stile, automatische Lesbarkeit)
 *   → 8 Sticker → 9 Texte → 10 Postkarten-Gruß.
 * Schritte 2–5 sind „teuer" und werden für die Vorschau zwischengespeichert, solange sich nur Overlay,
 * Texte, Sticker oder Gruß ändern. Alle Größen hängen an der kürzeren Bildseite (u = kurze Seite / 1000),
 * damit 1080, 2160 und Original gleich aussehen. Zufall (Körnung, Regen …) hat einen festen Startwert.
 *
 * Größen-Konvention für Texte und Sticker: `groesse` ist ein Faktor, 1 = Standard
 *   (Text: Schrift 5,5 % der kurzen Fotoseite; Sticker: 14 % der kurzen Fotoseite). x/y = Mitte, 0…1 vom Foto.
 * Overlay: `groesse` Faktor (1 = Standard), bei position 'frei' sind x/y die Mitte des Felds.
 */
(function (root) {
  'use strict';

  /* ======================================================================
   * 0. Kleine Helfer
   * ==================================================================== */
  var ARBEIT_MAX = 16384;                // Kantengrenze des Arbeitsbilds nur noch Notnagel; begrenzt wird die Fläche (MAX_PIXEL), 12-MP-Fotos bleiben voll
  var EXPORT_MAX = 16384;                // Kantengrenze beim Export, ebenso nur Notnagel
  var MAX_PIXEL = 16777216;              // Safari-Grenze je Canvas (Fläche, keine Kantenlänge)
  var MAX_DATEI = 40 * 1024 * 1024;      // 40 MB
  var naechsteId = 1;

  function kopie(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function klemme(v, a, b) { return v < a ? a : v > b ? b : v; }
  function zahl(v, std) { v = Number(v); return isFinite(v) ? v : std; }
  function istObjekt(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function mische(ziel, teil) {           // tiefes Zusammenführen (Arrays werden ersetzt)
    if (!istObjekt(teil)) return ziel;
    Object.keys(teil).forEach(function (k) {
      if (istObjekt(teil[k]) && istObjekt(ziel[k])) mische(ziel[k], teil[k]);
      else ziel[k] = kopie(teil[k]);
    });
    return ziel;
  }
  function leinwand(b, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(b)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function freiCanvas(c) { if (c && c.getContext) { c.width = 0; c.height = 0; } }
  function zufall(samen) {               // mulberry32: gleicher Startwert → gleiche Folge (Vorschau = Export)
    var a = samen >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function abgerundet(ctx, x, y, b, h, r) {
    r = Math.max(0, Math.min(r, b / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + b - r, y); ctx.arcTo(x + b, y, x + b, y + r, r);
    ctx.lineTo(x + b, y + h - r); ctx.arcTo(x + b, y + h, x + b - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  /* ---------- Farben und Kontrast (WCAG) ---------- */
  function linear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminanz(r, g, b) { return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b); }
  function kontrast(l1, l2) { var a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); }
  function hexZuRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16); if (!isFinite(n) || h.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /* Deckkraft einer Hinterlegung (Farbe tint), damit Text (Farbe text) auf dem schlimmsten Hintergrund ≥ ziel erreicht. */
  function noetigeDeckkraft(text, tint, hintergruende, ziel, start) {
    var lt = luminanz(text[0], text[1], text[2]);
    for (var a = start || 0; a <= 0.96; a += 0.02) {
      var ok = true;
      for (var i = 0; i < hintergruende.length; i++) {
        var h = hintergruende[i];
        var m = [h[0] + (tint[0] - h[0]) * a, h[1] + (tint[1] - h[1]) * a, h[2] + (tint[2] - h[2]) * a];
        if (kontrast(lt, luminanz(m[0], m[1], m[2])) < ziel) { ok = false; break; }
      }
      if (ok) return a;
    }
    return 0.96;
  }

  /* ---------- Schriften (Apple-Systemschriften mit Rückfall) ---------- */
  var SCHRIFT = {
    system: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    hand: 'Noteworthy, "Bradley Hand", cursive',   // Entscheidung Nr. 8: nur Apple-Handschriften, sonst die Ersatzschrift des Geräts
    serif: '"New York", ui-serif, Georgia, "Times New Roman", serif',
    rund: '"SF Pro Rounded", ui-rounded, -apple-system, system-ui, sans-serif',
    mono: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
    schreib: '"Bradley Hand", Noteworthy, cursive'
  };
  function font(gewicht, px, art) { return (gewicht || 400) + ' ' + Math.max(1, Math.round(px * 10) / 10) + 'px ' + (SCHRIFT[art] || SCHRIFT.system); }

  /* Zeilenumbruch selbst messen (aus technik-bausteine.js, Emojis bleiben ganz) */
  function umbrechen(ctx, text, maxBreite) {
    var zeilen = [];
    String(text == null ? '' : text).split('\n').forEach(function (absatz) {
      var z = '';
      absatz.split(/[ \t]+/).forEach(function (wort) {
        var t = z ? z + ' ' + wort : wort;
        if (ctx.measureText(t).width <= maxBreite || !z && !wort) { z = t; return; }
        if (z) zeilen.push(z);
        z = wort;
        while (ctx.measureText(z).width > maxBreite && Array.from(z).length > 1) {
          var zeichen = Array.from(z), k = zeichen.length - 1;
          while (k > 1 && ctx.measureText(zeichen.slice(0, k).join('')).width > maxBreite) k--;
          zeilen.push(zeichen.slice(0, k).join('')); z = zeichen.slice(k).join('');
        }
      });
      zeilen.push(z);
    });
    return zeilen;
  }

  /* ======================================================================
   * 1. Listen für die Oberfläche (deutsche Namen)
   * ==================================================================== */
  var FILTER = [
    { id: 'keiner', name: 'Original', beschreibung: 'Foto unverändert' },
    { id: 'natur', name: 'Natürlich', beschreibung: 'Etwas kräftiger, wie gesehen' },
    { id: 'warm', name: 'Warm', beschreibung: 'Wärmere, sonnige Farben' },
    { id: 'kuehl', name: 'Kühl', beschreibung: 'Klare, bläuliche Farben' },
    { id: 'analog', name: 'Analog', beschreibung: 'Wie ein alter Film, weiche Schatten' },
    { id: 'klar', name: 'Klar', beschreibung: 'Mehr Kontrast und Farbe' },
    { id: 'drama', name: 'Drama', beschreibung: 'Dunkel und stark, wenig Farbe' },
    { id: 'sw', name: 'Schwarz-Weiß', beschreibung: 'Ohne Farbe' },
    { id: 'sw-kontrast', name: 'S/W Kontrast', beschreibung: 'Schwarz-Weiß mit viel Kontrast' },
    { id: 'sepia', name: 'Sepia', beschreibung: 'Braun wie ein altes Foto' },
    { id: 'abend', name: 'Abendlicht', beschreibung: 'Goldene Stunde' }
  ];
  var EFFEKTE = [
    { id: 'keiner', name: 'Kein Effekt' },
    { id: 'regen', name: 'Regen', beschreibung: 'Feine Regenstriche über dem Foto' },
    { id: 'schnee', name: 'Schnee', beschreibung: 'Fallende Schneeflocken' },
    { id: 'sonnenstrahl', name: 'Sonnenstrahl', beschreibung: 'Warmes Licht von oben' },
    { id: 'nebel', name: 'Nebel', beschreibung: 'Weicher Dunst von unten' },
    { id: 'lichtleck', name: 'Lichtleck', beschreibung: 'Warmer Lichtschein wie beim Film' }
  ];
  var FORMATE = [
    { id: 'original', name: 'Original', verhaeltnis: null, beschreibung: 'Seitenverhältnis des Fotos' },
    { id: '1:1', name: 'Quadrat', verhaeltnis: 1 },
    { id: '4:5', name: '4:5', verhaeltnis: 4 / 5, beschreibung: 'Beitrag (Instagram)' },
    { id: '3:4', name: '3:4', verhaeltnis: 3 / 4, beschreibung: 'iPhone-Foto' },
    { id: '2:3', name: '2:3', verhaeltnis: 2 / 3, beschreibung: 'Klassisches Foto' },
    { id: '9:16', name: '9:16', verhaeltnis: 9 / 16, beschreibung: 'Story, ganzer Bildschirm' },
    { id: 'postkarte', name: 'Postkarte', verhaeltnis: 148 / 105, beschreibung: 'A6, 148 × 105 mm' },
    { id: 'frei', name: 'Frei', verhaeltnis: null, beschreibung: 'Ausschnitt ohne festes Verhältnis' }
  ];
  var STILE = [
    { id: 'glas', name: 'Glas', beschreibung: 'Milchglas-Karte mit Symbol und Werten' },
    { id: 'band', name: 'Band', beschreibung: 'Breiter Streifen über die ganze Breite' },
    { id: 'chips', name: 'Kärtchen', beschreibung: 'Jeder Wert als kleines Kärtchen' },
    { id: 'stempel', name: 'Zeitstempel', beschreibung: 'Orange Ziffern wie bei alten Kameras' },
    { id: 'gross', name: 'Groß', beschreibung: 'Große Temperatur wie in der Wetter-App' },
    { id: 'minimal', name: 'Minimal', beschreibung: 'Eine feine Zeile' },
    { id: 'aus', name: 'Aus', beschreibung: 'Keine Wetterdaten auf dem Foto' }
  ];
  var DATEN_FELDER = [
    { id: 'temperatur', name: 'Temperatur' },
    { id: 'symbol', name: 'Wettersymbol' },
    { id: 'lage', name: 'Wetterlage', beispiel: 'Leicht bewölkt' },
    { id: 'ort', name: 'Ort', stufen: [
      { id: 'genau', name: 'Stadtteil', beschreibung: 'Stadt und Stadtteil' },
      { id: 'stadt', name: 'Stadt' },
      { id: 'region', name: 'Region', beschreibung: 'Nur die Gegend' },
      { id: 'aus', name: 'Aus', beschreibung: 'Kein Ort auf dem Bild' }] },
    { id: 'datum', name: 'Datum' },
    { id: 'uhrzeit', name: 'Uhrzeit' },
    { id: 'wind', name: 'Wind' },
    { id: 'regen', name: 'Regen' },
    { id: 'boeen', name: 'Böen', beispiel: 'Böen bis 25 km/h' },
    { id: 'regenRisiko', name: 'Regenrisiko', beispiel: 'Regenrisiko 10 %' },
    { id: 'feuchte', name: 'Luftfeuchte' },
    { id: 'uv', name: 'UV-Index' },
    { id: 'sonne', name: 'Sonnenauf- und -untergang' },
    { id: 'druck', name: 'Luftdruck' },
    { id: 'logo', name: 'App-Name „WetterPro"' }
  ];
  var ORT_STUFEN = DATEN_FELDER[3].stufen;
  var RAHMEN = [
    { id: 'keiner', name: 'Ohne' }, { id: 'weiss', name: 'Weiß' },
    { id: 'polaroid', name: 'Sofortbild', beschreibung: 'Breiter Rand unten mit Textfeld' },
    { id: 'postkarte', name: 'Postkarte', beschreibung: 'Cremefarbener Rand' }
  ];
  var POSITIONEN = [
    { id: 'oben', name: 'Oben' }, { id: 'unten', name: 'Unten' },
    { id: 'oben-links', name: 'Oben links' }, { id: 'oben-rechts', name: 'Oben rechts' },
    { id: 'unten-links', name: 'Unten links' }, { id: 'unten-rechts', name: 'Unten rechts' },
    { id: 'frei', name: 'Frei' }
  ];
  var SCHRIFTEN = [
    { id: 'system', name: 'Klar', css: SCHRIFT.system }, { id: 'hand', name: 'Handschrift', css: SCHRIFT.hand },
    { id: 'serif', name: 'Zeitung', css: SCHRIFT.serif }, { id: 'rund', name: 'Rund', css: SCHRIFT.rund }
  ];
  var WETTER_STICKER = [
    { id: 'temperatur', name: 'Temperatur-Aufkleber' }, { id: 'symbol', name: 'Wettersymbol' },
    { id: 'ort', name: 'Ort-Schild' }, { id: 'lage', name: 'Wetterlage' }
  ];
  var EMOJI_SAETZE = [
    { id: 'wetter', name: 'Wetter', emojis: ['☀️', '🌤️', '⛅️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄️', '🌬️', '💨', '🌪️', '🌫️', '🌈', '☔️', '💧', '🌙', '⭐️', '🌡️', '🔥'] },
    { id: 'gefuehle', name: 'Gefühle', emojis: ['😀', '😊', '😍', '🥰', '😎', '🤩', '😌', '🥶', '🥵', '😴', '🤗', '😂', '😮', '🙌', '👍', '👋', '❤️', '🧡', '💛', '💚', '💙', '💜', '✨', '🎉'] },
    { id: 'natur', name: 'Natur', emojis: ['🌳', '🌲', '🌴', '🌵', '🌷', '🌻', '🌼', '🌸', '🍁', '🍂', '🍃', '🌿', '🍀', '🌾', '🏔️', '⛰️', '🌊', '🏞️', '🐦', '🦋', '🐝', '🐞', '🐶', '🐱'] },
    { id: 'reise', name: 'Reise', emojis: ['📍', '🗺️', '🧭', '✈️', '🚆', '🚗', '🚲', '⛵️', '🏖️', '🏕️', '🏰', '⛪️', '🌉', '🌆', '🎡', '📸', '🎒', '🧳', '🏠', '🇩🇪', '🗼', '🗽', '⛱️', '🎈'] },
    { id: 'essen', name: 'Essen', emojis: ['☕️', '🍵', '🍺', '🍷', '🥂', '🍦', '🍰', '🥨', '🍕', '🍔', '🍝', '🥗', '🍎', '🍓', '🍒', '🍉', '🥐', '🧁', '🍫', '🍪', '🌭', '🥘', '🍇', '🍋'] }
  ];
  var DEMO_WETTER = {
    temp: 14, gefuehlt: 12, code: 2, lage: 'Leicht bewölkt',
    ort: { stadt: 'Mannheim', stadtteil: 'Quadrate', land: 'DE', lat: 49.4875, lon: 8.466 },
    zeit: '2026-10-16T10:30:00+02:00', wind: 12, windRichtung: 'SW', boeen: 25,
    regen: 0, regenRisiko: 10, feuchte: 72, uv: 2, druck: 1018,
    sonnenaufgang: '07:48', sonnenuntergang: '18:41', modell: 'ICON-D2'
  };
  var STANDARD = {
    drehung: 0, spiegeln: false, gerade: 0, format: 'original', ausrichtung: 'auto', zuschnitt: null,
    anpassung: { licht: 0, kontrast: 0, saettigung: 0, waerme: 0, vignette: 0, koernung: 0 },
    filter: 'keiner', filterStaerke: 100, effekt: 'keiner',
    daten: { temperatur: true, symbol: true, lage: true, ort: 'genau', datum: true, uhrzeit: true, wind: false, regen: false,
      feuchte: false, uv: false, sonne: false, druck: false, logo: true, boeen: false, regenRisiko: false },
    overlay: { stil: 'glas', position: 'unten', x: 0.5, y: 0.9, groesse: 1, farbe: 'auto' },
    rahmen: 'keiner', texte: [], sticker: [],
    postkarte: { an: false, gruss: 'Grüße aus Mannheim',
      rueckseite: { text: '', unterschrift: '', empfaenger: '', briefmarke: true, stempel: true } },
    ausgabe: { format: 'jpeg', groesse: 2160, qualitaet: 0.9, metadaten: 'entfernen' }
  };
  function neuerZustand(teil) { return mische(kopie(STANDARD), teil || {}); }

  /* ======================================================================
   * 2. Wetterdaten → Texte
   * ==================================================================== */
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  var RICHTUNG = { N: 'Nord', NNO: 'Nordnordost', NO: 'Nordost', ONO: 'Ostnordost', O: 'Ost', OSO: 'Ostsüdost', SO: 'Südost', SSO: 'Südsüdost',
    S: 'Süd', SSW: 'Südsüdwest', SW: 'Südwest', WSW: 'Westsüdwest', W: 'West', WNW: 'Westnordwest', NW: 'Nordwest', NNW: 'Nordnordwest',
    NE: 'Nordost', E: 'Ost', SE: 'Südost', ENE: 'Ostnordost', ESE: 'Ostsüdost', SSE: 'Südsüdost', NNE: 'Nordnordost' };
  function gradZuRichtung(g) {
    var r = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return r[Math.round(((g % 360) + 360) % 360 / 22.5) % 16];
  }
  /* Zeit aus dem Wetter: Ortszeit direkt aus dem Text lesen (keine Umrechnung in die Zeitzone des Browsers). */
  function zeitTeile(w) {
    var s = w && w.zeit, m = typeof s === 'string' && /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/.exec(s);
    if (m) return { j: +m[1], mo: +m[2], t: +m[3], h: m[4] != null ? +m[4] : null, mi: m[5] != null ? +m[5] : null };
    var d = s instanceof Date ? s : new Date();
    return { j: d.getFullYear(), mo: d.getMonth() + 1, t: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
  }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function ortText(Z, w, stufe) {
    stufe = stufe || (Z && Z.daten && Z.daten.ort) || 'stadt';
    var o = (w && w.ort) || {};
    if (stufe === 'aus' || !o) return '';
    var stadt = o.stadt || o.name || '';
    if (stufe === 'genau') return o.stadtteil && stadt && o.stadtteil !== stadt ? stadt + '-' + o.stadtteil : (o.stadtteil || stadt);
    if (stufe === 'region') return o.region || (stadt ? 'Raum ' + stadt : '');
    return stadt;
  }
  function istNacht(w) {
    var t = zeitTeile(w); if (t.h == null) return false;
    var jetzt = t.h * 60 + t.mi;
    var auf = /^(\d\d):(\d\d)/.exec(w.sonnenaufgang || ''), unter = /^(\d\d):(\d\d)/.exec(w.sonnenuntergang || '');
    if (!auf || !unter) return t.h < 7 || t.h >= 20;
    return jetzt < +auf[1] * 60 + +auf[2] || jetzt > +unter[1] * 60 + +unter[2];
  }
  function lageText(w) {
    if (!w) return '';
    if (w.lage) return w.lage;
    return root.KSSymbole && w.code != null ? root.KSSymbole.textFuerCode(w.code, istNacht(w)) : '';
  }
  function tempText(w) { return w && w.temp != null && isFinite(w.temp) ? Math.round(w.temp) + '°' : ''; }
  function datumText(w, lang) { var t = zeitTeile(w); return lang ? t.t + '. ' + MONATE[t.mo - 1] + ' ' + t.j : t.t + '. ' + MONATE_KURZ[t.mo - 1] + ' ' + t.j; }
  function uhrText(w) { var t = zeitTeile(w); return t.h == null ? '' : zwei(t.h) + ':' + zwei(t.mi); }

  /* Was auf dem Bild steht (Reihenfolge = Anzeige). Ort nach Stufe; „aus" erscheint nirgends. */
  /* App-Name für den Logo-Schriftzug (Z.daten.logoText, Standard „WetterPro“) – Ergänzung Runde 2 */
  var APP_NAME = 'WetterPro';
  function appName(Z) { var t = Z && Z.daten && Z.daten.logoText; return t ? String(t).slice(0, 40) : 'WetterPro'; }
  function datenZeilen(Z, w) {
    Z = Z || STANDARD; w = w || {};       // ohne Wetter: nichts erfinden
    var d = Z.daten || {}, z = [];
    function neu(k, t) { if (t) z.push({ schluessel: k, text: t }); }
    if (d.temperatur) neu('temperatur', tempText(w));
    if (d.symbol && w.code != null) z.push({ schluessel: 'symbol', text: lageText(w) || 'Wettersymbol', code: w.code, nacht: istNacht(w) });
    if (d.lage) neu('lage', lageText(w));
    if (d.ort && d.ort !== 'aus') neu('ort', ortText(Z, w));
    if (d.datum) neu('datum', datumText(w));
    if (d.uhrzeit) neu('uhrzeit', uhrText(w) ? uhrText(w) + ' Uhr' : '');
    if (d.wind && w.wind != null) neu('wind', 'Wind ' + Math.round(w.wind) + ' km/h' + (w.windRichtung ? ' ' + w.windRichtung : ''));
    if (d.regen && (w.regen != null || w.regenRisiko != null))
      neu('regen', 'Regen ' + (w.regen != null ? String(Math.round(w.regen * 10) / 10).replace('.', ',') + ' mm' : '') +
        (w.regenRisiko != null ? (w.regen != null ? ' · ' : '') + Math.round(w.regenRisiko) + ' %' : ''));
    if (d.boeen && w.boeen != null) neu('boeen', 'Böen bis ' + Math.round(w.boeen) + ' km/h');
    if (d.regenRisiko && w.regenRisiko != null) neu('regenRisiko', 'Regenrisiko ' + Math.round(w.regenRisiko) + ' %');
    if (d.feuchte && w.feuchte != null) neu('feuchte', 'Feuchte ' + Math.round(w.feuchte) + ' %');
    if (d.uv && w.uv != null) neu('uv', 'UV ' + Math.round(w.uv));
    if (d.sonne && (w.sonnenaufgang || w.sonnenuntergang)) neu('sonne', '↑ ' + (w.sonnenaufgang || '–') + '  ↓ ' + (w.sonnenuntergang || '–'));
    if (d.druck && w.druck != null) neu('druck', Math.round(w.druck) + ' hPa');
    if (d.logo) neu('logo', appName(Z));
    return z;
  }
  function zeilenMap(Z, w) { var m = {}; datenZeilen(Z, w).forEach(function (e) { m[e.schluessel] = e; }); return m; }

  function altText(Z, w) {
    Z = Z || STANDARD; w = w || {};
    var d = Z.daten || {}, teile = [], satz = 'Foto';
    var ort = d.ort && d.ort !== 'aus' ? ortText(Z, w) : '';
    if (ort) satz += ' aus ' + ort;
    if (d.datum) satz += ' am ' + datumText(w, true);
    if (d.uhrzeit && uhrText(w)) satz += (d.datum ? ', ' : ' um ') + uhrText(w) + ' Uhr';
    teile.push(satz + '.');
    var wetter = [];
    if (d.lage && lageText(w)) wetter.push(lageText(w));
    else if (d.symbol && lageText(w)) wetter.push(lageText(w));
    if (d.temperatur && w.temp != null) wetter.push(Math.round(w.temp) + ' Grad');
    if (d.wind && w.wind != null) wetter.push('Wind ' + Math.round(w.wind) + ' km/h' + (w.windRichtung ? ' aus ' + (RICHTUNG[w.windRichtung] || w.windRichtung) : ''));
    if (d.regen && w.regenRisiko != null) wetter.push('Regenrisiko ' + Math.round(w.regenRisiko) + ' Prozent');
    if (d.boeen && w.boeen != null) wetter.push('Böen bis ' + Math.round(w.boeen) + ' km/h');
    if (d.regenRisiko && !d.regen && w.regenRisiko != null) wetter.push('Regenrisiko ' + Math.round(w.regenRisiko) + ' Prozent');
    if (d.feuchte && w.feuchte != null) wetter.push('Luftfeuchte ' + Math.round(w.feuchte) + ' Prozent');
    if (d.uv && w.uv != null) wetter.push('UV-Index ' + Math.round(w.uv));
    if (d.sonne && w.sonnenaufgang) wetter.push('Sonnenaufgang ' + w.sonnenaufgang + ' Uhr, Sonnenuntergang ' + w.sonnenuntergang + ' Uhr');
    if (d.druck && w.druck != null) wetter.push('Luftdruck ' + Math.round(w.druck) + ' Hektopascal');
    if (wetter.length && Z.overlay && Z.overlay.stil !== 'aus') teile.push(wetter.join(', ') + '.');
    var f = (FILTER.filter(function (x) { return x.id === Z.filter; })[0] || {}).name;
    if (f && Z.filter !== 'keiner') teile.push('Filter: ' + f + '.');
    var texte = (Z.texte || []).map(function (t) { return String(t.text || '').trim(); }).filter(Boolean);
    if (Z.postkarte && Z.postkarte.an && Z.postkarte.gruss) texte.unshift(Z.postkarte.gruss);
    if (texte.length) teile.push('Text auf dem Bild: „' + texte.join('“, „') + '“.');
    return teile.join(' ');
  }

  /* ======================================================================
   * 3. Fähigkeiten des Browsers (echte Proben)
   * ==================================================================== */
  var FAEHIG = { teilenDateien: false, teilenPdf: false, webp: false, avif: false, ctxFilter: false,
    zwischenablageBild: false, liveKamera: false, heic: false, teilenMehrere: false, geprueft: false };
  function synchronPruefen() {
    try {
      var nav = root.navigator || {};
      FAEHIG.liveKamera = !!(nav.mediaDevices && nav.mediaDevices.getUserMedia) && root.isSecureContext !== false;
      FAEHIG.zwischenablageBild = !!(nav.clipboard && nav.clipboard.write && root.ClipboardItem);
      var ua = nav.userAgent || '';
      // HEIC zeigt nur Safari (WebKit ohne Chrome/Firefox-Kennung) selbst an – Annahme, siehe TECHNIK.md 1.
      FAEHIG.heic = /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|Android/.test(ua);
      var c = leinwand(2, 2), x = c.getContext('2d');
      if (x && 'filter' in x) { x.filter = 'invert(1)'; x.fillStyle = '#000'; x.fillRect(0, 0, 2, 2); FAEHIG.ctxFilter = x.getImageData(0, 0, 1, 1).data[0] === 255; }
      freiCanvas(c);
      if (nav.canShare && root.File) {
        try { FAEHIG.teilenDateien = !!nav.canShare({ files: [new File([new Uint8Array(8)], 'probe.png', { type: 'image/png' })] }); } catch (e) { /* nein */ }
        try { FAEHIG.teilenMehrere = !!nav.canShare({ files: [new File([new Uint8Array(8)], 'a.png', { type: 'image/png' }), new File([new Uint8Array(8)], 'b.png', { type: 'image/png' })] }); } catch (e) { /* nein */ }
        try { FAEHIG.teilenPdf = !!nav.canShare({ files: [new File([new Uint8Array(8)], 'probe.pdf', { type: 'application/pdf' })] }); } catch (e) { /* nein */ }
      }
    } catch (e) { /* ohne DOM (Node) */ }
  }
  function probeKodierung(typ) {
    return new Promise(function (res) {
      try {
        var c = leinwand(2, 2), x = c.getContext('2d');
        x.fillStyle = '#3a7'; x.fillRect(0, 0, 2, 2);
        c.toBlob(function (b) { freiCanvas(c); res(!!b && b.type === typ); }, typ, 0.8);
      } catch (e) { res(false); }
    });
  }
  var pruefLauf = null;
  function pruefen() {
    if (pruefLauf) return pruefLauf;
    synchronPruefen();
    pruefLauf = Promise.all([probeKodierung('image/webp'), probeKodierung('image/avif')]).then(function (r) {
      FAEHIG.webp = r[0]; FAEHIG.avif = r[1]; FAEHIG.geprueft = true; return faehigkeiten();
    });
    return pruefLauf;
  }
  function faehigkeiten() { var o = {}; for (var k in FAEHIG) o[k] = FAEHIG[k]; return o; }

  /* ======================================================================
   * 4. Laden (Datei, URL, Kamera)
   * ==================================================================== */
  function fehler(text, code) { var e = new Error(text); e.code = code || 'fehler'; e.laienText = text; return e; }
  var TEXT_UNLESBAR = 'Dieses Bild kann der Browser nicht öffnen. Tipp: In den iPhone-Einstellungen unter Kamera → Formate „Maximale Kompatibilität" wählen oder ein anderes Foto nehmen.';

  /* EXIF-Leser (aus technik-bausteine.js, geprüft): Orientation, Aufnahmedatum (Ortszeit), GPS */
  function exifLesen(buf) {
    var r = { orientation: null, datum: null, lat: null, lon: null };
    try {
      var v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return r;
      var p = 2;
      while (p + 4 < v.byteLength) {
        var m = v.getUint16(p), len = v.getUint16(p + 2);
        if (m === 0xFFE1 && p + 10 < v.byteLength && v.getUint32(p + 4) === 0x45786966) {
          var t = p + 10, le = v.getUint16(t) === 0x4949;
          var u16 = function (o) { return v.getUint16(t + o, le); }, u32 = function (o) { return v.getUint32(t + o, le); };
          var str = function (o, n) { var s = ''; for (var i = 0; i < n && v.getUint8(t + o + i); i++) s += String.fromCharCode(v.getUint8(t + o + i)); return s; };
          var rat = function (o) { var d = u32(o + 4); return d ? u32(o) / d : 0; };
          var ifd = function (o0) {
            var out = {}, n = u16(o0);
            for (var i = 0; i < n; i++) {
              var e = o0 + 2 + i * 12, typ = u16(e + 2), cnt = u32(e + 4), gr = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[typ] || 1;
              out[u16(e)] = { typ: typ, cnt: cnt, off: gr * cnt > 4 ? u32(e + 8) : e + 8 };
            }
            return out;
          };
          var i0 = ifd(u32(4));
          if (i0[0x0112]) r.orientation = u16(i0[0x0112].off);
          var ex = i0[0x8769] ? ifd(u32(i0[0x8769].off)) : {}, d = ex[0x9003] || ex[0x9004] || i0[0x0132];   // auch nur DateTime im ersten Verzeichnis gilt
          if (d) { var mm = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(str(d.off, 19));
            if (mm) r.datum = mm[1] + '-' + mm[2] + '-' + mm[3] + 'T' + mm[4] + ':' + mm[5] + ':' + mm[6]; }
          if (i0[0x8825]) {
            var g = ifd(u32(i0[0x8825].off)), dms = function (e) { return rat(e.off) + rat(e.off + 8) / 60 + rat(e.off + 16) / 3600; };
            if (g[2] && g[4]) {
              var la = dms(g[2]), lo = dms(g[4]);
              if (g[1] && str(g[1].off, 1) === 'S') la = -la;
              if (g[3] && str(g[3].off, 1) === 'W') lo = -lo;
              if (isFinite(la) && isFinite(lo) && (la || lo)) { r.lat = la; r.lon = lo; }
            }
          }
          return r;
        }
        if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
        p += 2 + len;
      }
    } catch (e) { /* defekte EXIF-Daten: leer lassen */ }
    return r;
  }

  /* A25: Kopie der JPEG-Bytes, in der alle GPS-Werte genullt sind (Aufbau bleibt, damit Ausrichtung und Pixel gleich bleiben).
     Für das Original eines Entwurfs, das in „Meine Wetterfotos“ liegt: auch auf dem Gerät kein Standort. */
  function ohneGps(buf) {
    var a = new Uint8Array(buf.slice(0)), v = new DataView(a.buffer);
    try {
      if (a.length < 4 || v.getUint16(0) !== 0xFFD8) return a;
      var p = 2;
      while (p + 4 < a.length) {
        var m = v.getUint16(p), len = v.getUint16(p + 2);
        if (m === 0xFFE1 && p + 10 < a.length && v.getUint32(p + 4) === 0x45786966) {
          var t = p + 10, ende = p + 2 + len, le = v.getUint16(t) === 0x4949;
          var u16 = function (o) { return v.getUint16(t + o, le); }, u32 = function (o) { return v.getUint32(t + o, le); };
          var i0 = u32(4), n0 = u16(i0);
          for (var i = 0; i < n0; i++) {
            var e = i0 + 2 + i * 12; if (u16(e) !== 0x8825) continue;
            var g = u32(e + 8), n = u16(g);
            for (var j = 0; j < n; j++) {
              var f = g + 2 + j * 12, gr = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[u16(f + 2)] || 1) * u32(f + 4);
              var off = gr > 4 ? u32(f + 8) : f + 8;
              for (var k = 0; k < gr && t + off + k < ende; k++) a[t + off + k] = 0;
            }
          }
        }
        if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
        p += 2 + len;
      }
    } catch (err) { /* kaputte EXIF-Daten: Kopie wie gelesen */ }
    return a;
  }

  function bildDekodieren(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.decoding = 'async';
      var fertig = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(fehler(TEXT_UNLESBAR, 'unlesbar')); };
      img.src = url;
      if (img.decode) img.decode().then(fertig, function () {
        // decode() scheitert in WebKit manchmal bei SVG ohne Größe; dann auf onload warten
        if (img.complete && img.naturalWidth) fertig(); else img.onload = fertig;
      });
      else img.onload = fertig;
    });
  }
  /* Verkleinert sicher auf ≤ ARBEIT_MAX (in Halbierungs-Stufen gegen Treppchen) und prüft Transparenz. */
  function arbeitsbild(bild, w, h, max) {
    var f = Math.min(1, max / Math.max(w, h), Math.sqrt(MAX_PIXEL / (w * h)));
    var rd = f < 1 ? Math.floor : Math.round;   // abrunden, sonst rutscht die Fläche knapp über die Grenze
    var zw = Math.max(1, rd(w * f)), zh = Math.max(1, rd(h * f));
    var c = leinwand(zw, zh), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    var cur = bild, cw = w, ch = h;
    while (cw / 2 > zw * 1.0001 && cw / 2 >= 1) {
      var t = leinwand(Math.round(cw / 2), Math.round(ch / 2)), tx = t.getContext('2d');
      tx.imageSmoothingQuality = 'high'; tx.drawImage(cur, 0, 0, t.width, t.height);
      if (cur !== bild) freiCanvas(cur);
      cur = t; cw = t.width; ch = t.height;
    }
    ctx.drawImage(cur, 0, 0, zw, zh);
    if (cur !== bild) freiCanvas(cur);
    return c;
  }
  function hatTransparenz(c) {
    var p = leinwand(64, 64), x = p.getContext('2d', { willReadFrequently: true });
    x.drawImage(c, 0, 0, 64, 64);
    var d = x.getImageData(0, 0, 64, 64).data, ja = false;
    for (var i = 3; i < d.length; i += 4) if (d[i] < 250) { ja = true; break; }
    freiCanvas(p); return ja;
  }
  function leerbildPruefung(c) {   // iOS: zu großes Canvas liefert still ein leeres Bild
    try { var x = c.getContext('2d'); x.getImageData(c.width - 1, c.height - 1, 1, 1); return true; } catch (e) { return false; }
  }

  async function ladeDatei(datei) {
    if (!datei || typeof datei.size !== 'number') throw fehler('Es wurde kein Foto übergeben. Bitte noch einmal ein Foto wählen.', 'leer');
    if (datei.size === 0) throw fehler('Die Datei ist leer. Bitte ein anderes Foto wählen.', 'leer');
    if (datei.size > MAX_DATEI) throw fehler('Dieses Foto ist zu groß (über 40 MB). Bitte ein kleineres Foto wählen oder es vorher in Fotos verkleinern.', 'zu-gross');
    var typ = (datei.type || '').toLowerCase(), name = datei.name || 'Foto';
    var istHeic = /heic|heif/.test(typ) || /\.(heic|heif)$/i.test(name);
    if (typ && !/^image\//.test(typ)) throw fehler('Das ist keine Bilddatei. Bitte ein Foto (JPEG, PNG, HEIC …) wählen.', 'kein-bild');
    // Original-Bytes ZUERST lesen (EXIF), nur den Anfang – spart Speicher
    var exif = { datum: null, lat: null, lon: null, orientation: null };
    try { if (!typ || /jpe?g/.test(typ) || /\.jpe?g$/i.test(name)) exif = exifLesen(await datei.slice(0, 262144).arrayBuffer()); } catch (e) { /* ohne EXIF weiter */ }
    var dek;
    try { dek = await bildDekodieren(datei); }
    catch (e) {
      throw fehler(istHeic && !FAEHIG.heic
        ? 'Dieses Foto ist im iPhone-Format HEIC gespeichert, das dieser Browser nicht öffnen kann. Tipp: In den iPhone-Einstellungen unter Kamera → Formate „Maximale Kompatibilität" wählen oder das Foto in Safari öffnen.'
        : TEXT_UNLESBAR, 'unlesbar');
    }
    var img = dek.img, w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { w = 1600; h = 1200; }       // SVG ohne eigene Größe
    var c;
    try { c = arbeitsbild(img, w, h, ARBEIT_MAX); }
    finally { URL.revokeObjectURL(dek.url); img.src = ''; }
    if (!leerbildPruefung(c)) throw fehler('Das Foto ist zu groß für dieses Gerät. Bitte ein kleineres Foto wählen.', 'speicher');
    var transparent = /png|gif|svg|webp|avif/.test(typ) || /\.(png|gif|svg|webp)$/i.test(name) ? hatTransparenz(c) : false;
    var q = { bild: c, breite: c.width, hoehe: c.height, exif: { datum: exif.datum, lat: exif.lat, lon: exif.lon, ausrichtung: exif.orientation },
      name: name, typ: typ || 'image/unbekannt', transparent: transparent, originalBreite: w, originalHoehe: h, id: naechsteId++,
      datei: datei };   // A25: die Datei selbst (nur ein Verweis), damit ein Entwurf dasselbe Original pixelgleich wieder öffnen kann
    if (!q.exif.datum && datei.lastModified) q.exif.dateiDatum = new Date(datei.lastModified).toISOString();
    return q;
  }
  async function ladeUrl(url) {
    var blob;
    try { var r = await fetch(url); if (!r.ok) throw new Error(r.status); blob = await r.blob(); }
    catch (e) { throw fehler('Das Bild konnte nicht geladen werden. Bitte prüfen, ob die Adresse stimmt, oder ein anderes Foto wählen.', 'netz'); }
    var name = String(url).startsWith('data:') ? 'Foto' : decodeURIComponent(String(url).split('/').pop().split('?')[0] || 'Foto');
    try { return await ladeDatei(new File([blob], name, { type: blob.type })); }
    catch (e) { if (e.code) throw e; return ladeDatei(blob); }
  }
  /* Eigene Quelle aus Canvas/ImageBitmap/Video-Bild (z. B. Live-Kamera, eingefügtes Bild) */
  function quelleAus(bild, name, typ) {
    var w = bild.videoWidth || bild.naturalWidth || bild.width, h = bild.videoHeight || bild.naturalHeight || bild.height;
    var c = arbeitsbild(bild, w, h, ARBEIT_MAX);
    return { bild: c, breite: c.width, hoehe: c.height, exif: { datum: null, lat: null, lon: null }, name: name || 'Foto',
      typ: typ || 'image/jpeg', transparent: false, originalBreite: w, originalHoehe: h, id: naechsteId++ };
  }
  function freigeben(q) {
    if (!q) return;
    var c = CACHE.get(q); if (c) { c.eintraege.forEach(freiEintrag); CACHE.delete(q); }
    var s = STUFEN.get(q); if (s) { s.forEach(function (x) { if (x !== q.bild) freiCanvas(x); }); STUFEN.delete(q); }
    if (q.bild && q.bild.close) q.bild.close(); else freiCanvas(q.bild);
    q.bild = null; q.datei = null;
  }

  /* Live-Kamera: öffnen, Kamera wechseln, Zoom (Kamera oder digital), Licht (torch), Standbild.
     opt.kamera: 'environment' (Standard) oder 'user'. Wo die Kamera keinen Zoom/kein Licht kennt, sagen
     faehigkeiten(), zoom() und licht() das ehrlich (Safari kennt beides nur auf manchen Geräten). */
  async function liveKamera(video, opt) {
    var nav = root.navigator || {};
    if (!nav.mediaDevices || !nav.mediaDevices.getUserMedia)
      throw fehler('Dieser Browser unterstützt die Live-Kamera nicht. Tipp: Mit „Foto aufnehmen" geht es trotzdem.', 'nicht-unterstuetzt');
    async function oeffne(kamera) {
      try {
        return await nav.mediaDevices.getUserMedia({ audio: false,
          video: { facingMode: { ideal: kamera }, width: { ideal: 4096 }, height: { ideal: 3072 } } });
      } catch (e) {
        var n = e && e.name;
        if (n === 'NotAllowedError' || n === 'PermissionDeniedError')
          throw fehler('Die Kamera ist nicht erlaubt. Tipp: In den Einstellungen bei Safari → Kamera „Erlauben" wählen – oder „Foto aufnehmen" nutzen.', 'keine-erlaubnis');
        if (n === 'SecurityError')
          throw fehler('In diesem Fenster ist die Kamera gesperrt. Tipp: Die Seite direkt im Browser öffnen oder „Foto aufnehmen" nutzen.', 'gesperrt');
        if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError')
          throw fehler('Es wurde keine Kamera gefunden. Tipp: Ein Foto aus der Mediathek wählen.', 'keine-kamera');
        if (n === 'NotReadableError')
          throw fehler('Die Kamera wird gerade von einer anderen App benutzt. Bitte die andere App schließen und erneut versuchen.', 'belegt');
        throw fehler('Die Live-Kamera ließ sich nicht starten. Tipp: Mit „Foto aufnehmen" geht es trotzdem.', 'unbekannt');
      }
    }
    async function anzeigen(strom) {
      video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.srcObject = strom;
      try { await video.play(); } catch (e) { /* Autoplay: Bild kommt trotzdem, sobald sichtbar */ }
    }
    function stoppStrom(strom) { if (strom) strom.getTracks().forEach(function (t) { t.stop(); }); }
    var k = { kamera: opt && opt.kamera === 'user' ? 'user' : 'environment', strom: null, zoomDigital: 1, zoomWert: 1, lichtAn: false };
    k.strom = await oeffne(k.kamera);
    await anzeigen(k.strom);
    function spur() { var t = k.strom && k.strom.getVideoTracks && k.strom.getVideoTracks()[0]; return t || null; }
    k.faehigkeiten = function () {
      var r = { zoom: null, licht: false };
      try {
        var t = spur(), c = t && t.getCapabilities ? t.getCapabilities() : {};
        if (c && c.zoom && c.zoom.max > c.zoom.min) r.zoom = { min: c.zoom.min, max: c.zoom.max };
        r.licht = !!(c && c.torch);
      } catch (e) { /* Safari ohne getCapabilities */ }
      return r;
    };
    /* → 'kamera' (echter Zoom), 'digital' (Mitte wird beim Foto ausgeschnitten) oder 'nicht-moeglich' (z. B. 0,5× ohne Weitwinkel) */
    k.zoom = async function (z) {
      z = zahl(z, 1);
      var f = k.faehigkeiten(), t = spur();
      if (f.zoom && t && t.applyConstraints && z >= f.zoom.min && z <= f.zoom.max) {
        try { await t.applyConstraints({ advanced: [{ zoom: z }] }); k.zoomWert = z; k.zoomDigital = 1; return 'kamera'; } catch (e) { /* weiter mit digital */ }
      }
      if (z < 1) return 'nicht-moeglich';
      k.zoomDigital = z; k.zoomWert = z;
      return z === 1 ? 'kamera' : 'digital';
    };
    /* → true, wenn das Licht jetzt brennt; false, wenn aus oder nicht möglich */
    k.licht = async function (an) {
      var t = spur();
      if (!k.faehigkeiten().licht || !t || !t.applyConstraints) return false;
      try { await t.applyConstraints({ advanced: [{ torch: !!an }] }); k.lichtAn = !!an; return !!an; } catch (e) { k.lichtAn = false; return false; }
    };
    k.wechsle = async function (kamera) {
      kamera = kamera === 'user' ? 'user' : 'environment';
      var alt = k.kamera;
      stoppStrom(k.strom); k.strom = null;
      try { k.strom = await oeffne(kamera); k.kamera = kamera; }
      catch (e) { try { k.strom = await oeffne(alt); await anzeigen(k.strom); } catch (e2) { /* Kamera bleibt zu */ } throw e; }
      k.zoomDigital = 1; k.zoomWert = 1; k.lichtAn = false;
      await anzeigen(k.strom);
      return true;
    };
    k.stopp = function () { stoppStrom(k.strom); k.strom = null; video.srcObject = null; };
    /* Standbild; o.spiegeln spiegelt waagrecht (Frontkamera wie im Sucher gesehen) */
    k.foto = function (o) {
      o = o || {};
      if (!video.videoWidth) throw fehler('Die Kamera ist noch nicht bereit. Bitte einen Moment warten.', 'nicht-bereit');
      var w = video.videoWidth, h = video.videoHeight, z = k.zoomDigital > 1 ? k.zoomDigital : 1;
      var sw = w / z, sh = h / z, c = leinwand(sw, sh), x = c.getContext('2d');
      if (o.spiegeln) { x.translate(c.width, 0); x.scale(-1, 1); }
      x.drawImage(video, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
      var t = new Date(), q = quelleAus(c, 'Kamera', 'image/jpeg');
      freiCanvas(c);
      q.exif.datum = t.getFullYear() + '-' + zwei(t.getMonth() + 1) + '-' + zwei(t.getDate()) + 'T' + zwei(t.getHours()) + ':' + zwei(t.getMinutes()) + ':' + zwei(t.getSeconds());
      return q;
    };
    return k;
  }

  /* ======================================================================
   * 5. Geometrie: Drehen, Spiegeln, Begradigen, Zuschnitt
   * ==================================================================== */
  function formatVerhaeltnis(Z, wr, hr) {
    var f = Z.format || 'original', a;
    if (f === 'frei') return null;
    if (f === 'original') a = wr / hr;
    else { var e = FORMATE.filter(function (x) { return x.id === f; })[0]; a = e && e.verhaeltnis ? e.verhaeltnis : wr / hr; }
    var aus = Z.ausrichtung || 'auto';
    if (aus === 'auto' && f !== 'original') aus = wr >= hr ? 'quer' : 'hoch';
    if (aus === 'hoch' && a > 1) a = 1 / a;
    if (aus === 'quer' && a < 1) a = 1 / a;
    return a;
  }
  /* Geometrie des gedrehten+begradigten Bilds G und des Zuschnitts (Pixel des Arbeitsbilds) */
  function geometrie(q, Z) {
    var dreh = ((Math.round(zahl(Z.drehung, 0) / 90) * 90) % 360 + 360) % 360;
    var w0 = q.breite, h0 = q.hoehe, quer = dreh === 90 || dreh === 270;
    var wr = quer ? h0 : w0, hr = quer ? w0 : h0;
    var g = klemme(zahl(Z.gerade, 0), -15, 15), rad = g * Math.PI / 180;
    var k = Math.cos(Math.abs(rad)) + Math.max(wr / hr, hr / wr) * Math.sin(Math.abs(rad));
    var a = formatVerhaeltnis(Z, wr, hr), c;
    if (Z.zuschnitt) c = begrenzen(Z.zuschnitt, a, wr, hr);
    else if (a == null) c = { x: 0, y: 0, b: 1, h: 1 };
    else c = mittig(a, wr, hr);
    return { drehung: dreh, spiegeln: !!Z.spiegeln, gerade: g, rad: rad, k: k, w0: w0, h0: h0, wr: wr, hr: hr, verhaeltnis: a,
      zuschnitt: c, px: { x: c.x * wr, y: c.y * hr, b: c.b * wr, h: c.h * hr } };
  }
  function mittig(a, wr, hr) {
    var b = wr, h = wr / a; if (h > hr) { h = hr; b = hr * a; }
    return { x: (wr - b) / 2 / wr, y: (hr - h) / 2 / hr, b: b / wr, h: h / hr };
  }
  /* Hält Format (Seitenverhältnis a) und Bildgrenzen ein; Mitte bleibt möglichst erhalten. */
  function begrenzen(z, a, wr, hr) {
    var b = klemme(zahl(z.b, 1), 0.02, 1) * wr, h = klemme(zahl(z.h, 1), 0.02, 1) * hr;
    var mx = (zahl(z.x, 0) + zahl(z.b, 1) / 2) * wr, my = (zahl(z.y, 0) + zahl(z.h, 1) / 2) * hr;
    if (a != null) {
      var fl = b * h; b = Math.sqrt(fl * a); h = b / a;      // gleiche Fläche, richtiges Verhältnis
      var s = Math.min(1, wr / b, hr / h); b *= s; h *= s;
      var min = Math.min(wr, hr) * 0.05; if (Math.min(b, h) < min) { var t = min / Math.min(b, h); b *= t; h *= t; }
      s = Math.min(1, wr / b, hr / h); b *= s; h *= s;
    }
    var x = klemme(mx - b / 2, 0, wr - b), y = klemme(my - h / 2, 0, hr - h);
    return { x: x / wr, y: y / hr, b: b / wr, h: h / hr };
  }
  function zuschnittBegrenzen(Z, q) {
    var dreh = ((Math.round(zahl(Z.drehung, 0) / 90) * 90) % 360 + 360) % 360, quer = dreh === 90 || dreh === 270;
    var wr = quer ? q.hoehe : q.breite, hr = quer ? q.breite : q.hoehe, a = formatVerhaeltnis(Z, wr, hr);
    Z.zuschnitt = Z.zuschnitt ? begrenzen(Z.zuschnitt, a, wr, hr) : (a == null ? { x: 0, y: 0, b: 1, h: 1 } : mittig(a, wr, hr));
    return Z.zuschnitt;
  }
  var RAHMEN_MASS = {   // Anteile der kürzeren Fotoseite: links, oben, rechts, unten
    keiner: [0, 0, 0, 0], weiss: [0.045, 0.045, 0.045, 0.045], polaroid: [0.055, 0.055, 0.055, 0.25], postkarte: [0.05, 0.05, 0.05, 0.05]
  };
  function rahmenRand(Z, pb, ph) {
    var m = RAHMEN_MASS[Z.rahmen] || RAHMEN_MASS.keiner, k = Math.min(pb, ph);
    return { l: Math.round(m[0] * k), o: Math.round(m[1] * k), r: Math.round(m[2] * k), u: Math.round(m[3] * k) };
  }
  function masse(q, Z) {
    var g = geometrie(q, Z), b = Math.round(g.px.b), h = Math.round(g.px.h), r = rahmenRand(Z, b, h);
    var mb = b + r.l + r.r, mh = h + r.o + r.u;
    return { breite: b, hoehe: h, seitenverhaeltnis: b / h, mitRahmen: { breite: mb, hoehe: mh, seitenverhaeltnis: mb / mh } };
  }
  /* Ausgabegröße: längste Seite des fertigen Bilds (mit Rahmen) = ziel; 'original' = Arbeitsbild-Pixel */
  function ausgabeMasse(q, Z, ziel, ohneRahmen) {
    var g = geometrie(q, Z), m = RAHMEN_MASS[ohneRahmen ? 'keiner' : Z.rahmen] || RAHMEN_MASS.keiner;
    var kz = Math.min(g.px.b, g.px.h), gesB = g.px.b + (m[0] + m[2]) * kz, gesH = g.px.h + (m[1] + m[3]) * kz;
    var f = ziel === 'original' || !ziel ? 1 : zahl(ziel, 1200) / Math.max(gesB, gesH);
    f = Math.min(f, EXPORT_MAX / Math.max(gesB, gesH), Math.sqrt(MAX_PIXEL * 0.98 / (gesB * gesH)));
    var pb = Math.max(1, Math.round(g.px.b * f)), ph = Math.max(1, Math.round(g.px.h * f));
    var r = ohneRahmen ? { l: 0, o: 0, r: 0, u: 0 } : rahmenRand(Z, pb, ph);
    return { g: g, f: f, pb: pb, ph: ph, rand: r, b: pb + r.l + r.r, h: ph + r.o + r.u };
  }

  /* Bildstufen (halbe Größen) für saubere Verkleinerung ohne Treppchen */
  var STUFEN = new WeakMap();
  function passendeStufe(q, faktor) {
    var liste = STUFEN.get(q); if (!liste) { liste = [q.bild]; STUFEN.set(q, liste); }
    var i = 0, f = faktor;
    while (f < 0.5 && i < 4) {
      if (!liste[i + 1]) {
        var v = liste[i], t = leinwand(Math.max(1, Math.round(v.width / 2)), Math.max(1, Math.round(v.height / 2)));
        var x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(v, 0, 0, t.width, t.height);
        liste[i + 1] = t;
      }
      i++; f *= 2;
    }
    return liste[i];
  }
  /* Zeichnet den Ausschnitt `px` (in G-Pixeln) in ein Canvas der Größe ob×oh */
  function zeichneGeometrie(ctx, q, g, px, ob, oh) {
    var s = ob / px.b;
    var stufe = passendeStufe(q, s * g.k);
    var sf = stufe.width / g.w0;
    // kleine Überdeckung (≈1,5 px) gegen halbdurchsichtige Kantenpixel
    var k = g.k * (1 + 1.5 / Math.min(ob, oh));
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.scale(s, oh / px.h);
    ctx.translate(-px.x, -px.y);
    ctx.translate(g.wr / 2, g.hr / 2);
    ctx.rotate(g.rad);
    ctx.scale(k, k);
    if (g.spiegeln) ctx.scale(-1, 1);
    ctx.rotate(g.drehung * Math.PI / 180);
    ctx.drawImage(stufe, -g.w0 / 2, -g.h0 / 2, stufe.width / sf, stufe.height / sf);
    ctx.restore();
  }

  /* ======================================================================
   * 6. Farbe: Anpassungen + Filter als Nachschlagetabellen (LUT) + Farbmatrix
   *    Gleiche Mathematik für Vorschau und Export (kein ctx.filter, fehlt in Safari).
   * ==================================================================== */
  var FILTER_DEF = {
    keiner: {},
    natur: { kontrast: 10, saett: 1.14, licht: 3 },
    warm: { r: 1.07, g: 1.01, b: 0.88, saett: 1.06, lift: 0.015, licht: 2 },
    kuehl: { r: 0.92, g: 0.99, b: 1.08, saett: 0.94, kontrast: 4 },
    analog: { lift: 0.08, gain: 0.94, kontrast: -6, saett: 0.8, r: 1.05, g: 1.0, b: 0.9, liftB: 0.04 },
    klar: { kontrast: 24, saett: 1.2, licht: 5 },
    drama: { kontrast: 48, saett: 0.72, licht: -10, gain: 0.97 },
    sw: { grau: 1, kontrast: 6 },
    'sw-kontrast': { grau: 1, kontrast: 62, licht: -4 },
    sepia: { sepia: 1, lift: 0.03, kontrast: -4 },
    abend: { r: 1.1, g: 0.97, b: 0.84, saett: 1.08, licht: -4, kontrast: 8, liftB: 0.03 }
  };
  function kontrastKurve(x, K) {
    if (!K) return x;
    if (K > 0) {
      var s = x * x * (3 - 2 * x), t = K / 100 * 1.15;
      if (t > 1) { var s2 = s * s * (3 - 2 * s); return s + (s2 - s) * (t - 1); }
      return x + (s - x) * t;
    }
    return x + ((0.5 + (x - 0.5) * 0.45) - x) * (-K / 100);
  }
  function lichtKurve(x, L) { return L ? Math.pow(x, Math.pow(2, -L / 100)) : x; }
  function farbParameter(Z, ohneAnpassung) {
    var a = ohneAnpassung ? {} : (Z.anpassung || {});
    var fd = ohneAnpassung ? {} : (FILTER_DEF[Z.filter] || {}), t = klemme(zahl(Z.filterStaerke, 100), 0, 100) / 100;
    function f(k, neutral) { return fd[k] == null ? neutral : neutral + (fd[k] - neutral) * t; }
    var p = {
      licht: klemme(zahl(a.licht, 0), -100, 100), kontrast: klemme(zahl(a.kontrast, 0), -100, 100),
      saett: klemme(zahl(a.saettigung, 0), -100, 100), waerme: klemme(zahl(a.waerme, 0), -100, 100),
      fLicht: f('licht', 0), fKontrast: f('kontrast', 0), fSaett: f('saett', 1), lift: f('lift', 0), liftB: f('liftB', 0), gain: f('gain', 1),
      r: f('r', 1), g: f('g', 1), b: f('b', 1), grau: f('grau', 0), sepia: f('sepia', 0)
    };
    p.neutral = !p.licht && !p.kontrast && !p.saett && !p.waerme && !p.fLicht && !p.fKontrast && p.fSaett === 1 && !p.lift && !p.liftB &&
      p.gain === 1 && p.r === 1 && p.g === 1 && p.b === 1 && !p.grau && !p.sepia;
    return p;
  }
  function baueLUT(p) {
    var w = p.waerme / 100, gainK = [p.r * (1 + 0.1 * w), p.g * (1 + 0.015 * w), p.b * (1 - 0.12 * w)];
    var luts = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
    for (var i = 0; i < 256; i++) {
      var x = i / 255;
      x = lichtKurve(x, p.fLicht); x = kontrastKurve(x, p.fKontrast);
      x = lichtKurve(x, p.licht); x = kontrastKurve(klemme(x, 0, 1), p.kontrast);
      x = klemme(x, 0, 1);
      for (var c = 0; c < 3; c++) {
        var y = (p.lift + (c === 2 ? p.liftB : 0)) + x * (p.gain - p.lift - (c === 2 ? p.liftB : 0));
        luts[c][i] = Math.round(klemme(y * gainK[c], 0, 1) * 255);
      }
    }
    return luts;
  }
  function mal(A, B) {  // 3×3-Matrizen
    var C = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }
  function baueMatrix(p) {
    var lr = 0.2126, lg = 0.7152, lb = 0.0722;
    var s = p.fSaett * (1 + p.saett / 100 * (p.saett > 0 ? 0.9 : 1));
    var S = [lr + (1 - lr) * s, lg - lg * s, lb - lb * s, lr - lr * s, lg + (1 - lg) * s, lb - lb * s, lr - lr * s, lg - lg * s, lb + (1 - lb) * s];
    var G = [lr, lg, lb, lr, lg, lb, lr, lg, lb], I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    var M = S;
    if (p.grau) M = mal(I.map(function (v, i) { return v + (G[i] - v) * p.grau; }), M);
    if (p.sepia) {
      var SE = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
      M = mal(I.map(function (v, i) { return v + (SE[i] - v) * p.sepia; }), M);
    }
    var ident = M.every(function (v, i) { return Math.abs(v - I[i]) < 1e-4; });
    return ident ? null : M.map(function (v) { return Math.round(v * 1024); });
  }
  /* Wendet LUT + Matrix auf ein Canvas an; opak = Alpha auf 255 setzen (gegen Kantenpixel) */
  function farbeAnwenden(ctx, b, h, p, opak) {
    if (p.neutral && !opak) return;
    var id = ctx.getImageData(0, 0, b, h), d = id.data, n = d.length, i;
    if (p.neutral) { for (i = 3; i < n; i += 4) d[i] = 255; ctx.putImageData(id, 0, 0); return; }
    var L = baueLUT(p), R = L[0], Gl = L[1], B = L[2], M = baueMatrix(p);
    if (M) {
      var m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3], m4 = M[4], m5 = M[5], m6 = M[6], m7 = M[7], m8 = M[8];
      for (i = 0; i < n; i += 4) {
        var r = R[d[i]], g = Gl[d[i + 1]], bl = B[d[i + 2]];
        d[i] = (m0 * r + m1 * g + m2 * bl) >> 10; d[i + 1] = (m3 * r + m4 * g + m5 * bl) >> 10; d[i + 2] = (m6 * r + m7 * g + m8 * bl) >> 10;
        if (opak) d[i + 3] = 255;
      }
    } else {
      for (i = 0; i < n; i += 4) { d[i] = R[d[i]]; d[i + 1] = Gl[d[i + 1]]; d[i + 2] = B[d[i + 2]]; if (opak) d[i + 3] = 255; }
    }
    ctx.putImageData(id, 0, 0);
  }
  function vignette(ctx, b, h, staerke) {
    if (!staerke) return;
    var v = klemme(staerke, 0, 100) / 100, r = Math.sqrt(b * b + h * h) / 2;
    var gr = ctx.createRadialGradient(b / 2, h / 2, r * (0.62 - 0.3 * v), b / 2, h / 2, r * 1.02);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (0.22 * v).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.72 * v).toFixed(3) + ')');
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = gr; ctx.fillRect(0, 0, b, h); ctx.restore();
  }
  var KORN = null;   // festes Rauschmuster (Startwert 4711), unabhängig von der Ausgabegröße
  function koernung(ctx, b, h, staerke) {
    if (!staerke) return;
    var kurz = Math.min(b, h), zellen = 520, nb = Math.round(zellen * b / kurz), nh = Math.round(zellen * h / kurz);
    if (!KORN || KORN.nb !== nb || KORN.nh !== nh) {
      if (KORN) freiCanvas(KORN.c);
      var c = leinwand(nb, nh), x = c.getContext('2d'), id = x.createImageData(nb, nh), d = id.data, rnd = zufall(4711);
      for (var i = 0; i < d.length; i += 4) { var v = 128 + (rnd() + rnd() + rnd() - 1.5) * 120; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      x.putImageData(id, 0, 0); KORN = { c: c, nb: nb, nh: nh };
    }
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = klemme(staerke, 0, 100) / 100 * 0.55;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(KORN.c, 0, 0, b, h); ctx.restore();
  }

  /* ======================================================================
   * 7. Wetter-Effekte (deterministisch, relativ zur kurzen Seite)
   * ==================================================================== */
  function effektZeichnen(ctx, b, h, art) {
    if (!art || art === 'keiner') return;
    var u = Math.min(b, h) / 1000, fl = (b / Math.min(b, h)) * (h / Math.min(b, h)), rnd, i, n;
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    if (art === 'regen') {
      rnd = zufall(101);
      ctx.fillStyle = 'rgba(40,58,84,0.16)'; ctx.fillRect(0, 0, b, h);
      ctx.lineCap = 'round';
      n = Math.round(520 * fl);
      var dx = Math.sin(0.22), dy = Math.cos(0.22);
      for (i = 0; i < n; i++) {
        var x = (rnd() * 1.2 - 0.1) * b, y = (rnd() * 1.1 - 0.05) * h, l = (28 + rnd() * 70) * u, a = 0.12 + rnd() * 0.32;
        ctx.strokeStyle = 'rgba(225,235,255,' + a.toFixed(3) + ')'; ctx.lineWidth = (0.9 + rnd() * 1.6) * u;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * l, y + dy * l); ctx.stroke();
      }
      for (i = 0; i < Math.round(40 * fl); i++) {   // Tropfen auf der „Linse"
        var tx = rnd() * b, ty = rnd() * h, tr = (6 + rnd() * 14) * u, tg = ctx.createRadialGradient(tx - tr * 0.3, ty - tr * 0.3, 0, tx, ty, tr);
        tg.addColorStop(0, 'rgba(255,255,255,0.35)'); tg.addColorStop(0.7, 'rgba(255,255,255,0.08)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
      }
    } else if (art === 'schnee') {
      rnd = zufall(202);
      ctx.fillStyle = 'rgba(225,235,248,0.12)'; ctx.fillRect(0, 0, b, h);
      n = Math.round(300 * fl);
      for (i = 0; i < n; i++) {
        var sx = rnd() * b, sy = rnd() * h, tiefe = rnd(), sr = (1.6 + tiefe * tiefe * 9) * u, weich = tiefe > 0.82;
        var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * (weich ? 1.8 : 1));
        var sa = weich ? 0.45 : 0.75 + rnd() * 0.25;
        sg.addColorStop(0, 'rgba(255,255,255,' + sa.toFixed(3) + ')'); sg.addColorStop(weich ? 0.3 : 0.6, 'rgba(255,255,255,' + (sa * 0.8).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * (weich ? 1.8 : 1), 0, Math.PI * 2); ctx.fill();
      }
    } else if (art === 'sonnenstrahl') {
      var qx = b * 0.82, qy = -h * 0.06, R = Math.sqrt(b * b + h * h);
      ctx.globalCompositeOperation = 'screen';
      var gl = ctx.createRadialGradient(qx, qy, 0, qx, qy, R * 0.75);
      gl.addColorStop(0, 'rgba(255,236,190,0.85)'); gl.addColorStop(0.18, 'rgba(255,214,150,0.45)'); gl.addColorStop(0.6, 'rgba(255,190,120,0.08)'); gl.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, b, h);
      rnd = zufall(303);
      var kl = 160 / Math.min(b, h), sc = leinwand(b * kl, h * kl), sx2 = sc.getContext('2d');   // kleine Fläche → weiche Kanten
      sx2.scale(kl, kl);
      for (i = 0; i < 7; i++) {
        var w0 = 1.8 + i * 0.17 + rnd() * 0.07, breite = 0.03 + rnd() * 0.05, sg2 = sx2.createRadialGradient(qx, qy, 0, qx, qy, R);
        var al = 0.16 + rnd() * 0.14;
        sg2.addColorStop(0, 'rgba(255,240,205,' + al.toFixed(3) + ')'); sg2.addColorStop(0.7, 'rgba(255,230,190,' + (al * 0.3).toFixed(3) + ')'); sg2.addColorStop(1, 'rgba(255,230,190,0)');
        sx2.fillStyle = sg2; sx2.beginPath(); sx2.moveTo(qx, qy);
        sx2.lineTo(qx + Math.cos(w0 - breite) * R, qy + Math.sin(w0 - breite) * R);
        sx2.lineTo(qx + Math.cos(w0 + breite) * R, qy + Math.sin(w0 + breite) * R); sx2.closePath(); sx2.fill();
      }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(sc, 0, 0, b, h); freiCanvas(sc);
    } else if (art === 'nebel') {
      ctx.fillStyle = 'rgba(232,236,240,0.16)'; ctx.fillRect(0, 0, b, h);
      var ng = ctx.createLinearGradient(0, h, 0, h * 0.25);
      ng.addColorStop(0, 'rgba(236,240,244,0.72)'); ng.addColorStop(0.5, 'rgba(236,240,244,0.32)'); ng.addColorStop(1, 'rgba(236,240,244,0)');
      ctx.fillStyle = ng; ctx.fillRect(0, 0, b, h);
      rnd = zufall(404);
      for (i = 0; i < 14; i++) {
        var nx = rnd() * b, ny = h * (0.45 + rnd() * 0.6), nr = (180 + rnd() * 320) * u, nb = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        nb.addColorStop(0, 'rgba(245,247,250,0.22)'); nb.addColorStop(1, 'rgba(245,247,250,0)');
        ctx.fillStyle = nb; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
      }
    } else if (art === 'lichtleck') {
      ctx.globalCompositeOperation = 'screen';
      var kurz = Math.min(b, h);
      var l1 = ctx.createRadialGradient(-0.05 * b, h * 0.62, 0, -0.05 * b, h * 0.62, kurz * 0.75);
      l1.addColorStop(0, 'rgba(255,120,30,0.85)'); l1.addColorStop(0.45, 'rgba(255,80,40,0.35)'); l1.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = l1; ctx.fillRect(0, 0, b, h);
      var l2 = ctx.createRadialGradient(b * 1.02, h * 0.08, 0, b * 1.02, h * 0.08, kurz * 0.55);
      l2.addColorStop(0, 'rgba(255,70,110,0.55)'); l2.addColorStop(1, 'rgba(255,70,110,0)');
      ctx.fillStyle = l2; ctx.fillRect(0, 0, b, h);
      var l3 = ctx.createLinearGradient(0, 0, b * 0.35, 0);
      l3.addColorStop(0, 'rgba(255,200,120,0.28)'); l3.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = l3; ctx.fillRect(0, 0, b, h);
    }
    ctx.restore();
  }

  /* ======================================================================
   * 8. Zwischenspeicher für den teuren Teil (Geometrie + Farbe + Effekte)
   * ==================================================================== */
  var CACHE = new WeakMap();
  function freiEintrag(e) { freiCanvas(e.foto); freiCanvas(e.unscharf); }
  function fotoSchluessel(q, Z, ab, pb, ph, ohne) {
    return JSON.stringify([q.id, pb, ph, ab.g.drehung, ab.g.spiegeln, ab.g.gerade, ab.g.zuschnitt, ohne.anpassung ? 0 : Z.anpassung,
      ohne.anpassung ? 0 : Z.filter, ohne.anpassung ? 0 : Z.filterStaerke, ohne.effekt ? 0 : Z.effekt]);
  }
  /* Liefert {foto (Canvas pb×ph), hell (Helligkeitsraster), unscharf (für Glas)} */
  function fotoSchicht(q, Z, ab, ohne, mitCache) {
    var pb = ab.pb, ph = ab.ph, key = fotoSchluessel(q, Z, ab, pb, ph, ohne), c = CACHE.get(q);
    if (mitCache && c) { for (var i = 0; i < c.eintraege.length; i++) if (c.eintraege[i].key === key) { c.treffer++; return c.eintraege[i]; } }
    var foto = leinwand(pb, ph), ctx = foto.getContext('2d');
    zeichneGeometrie(ctx, q, ab.g, ab.g.px, pb, ph);
    var a = ohne.anpassung ? {} : (Z.anpassung || {});
    farbeAnwenden(ctx, pb, ph, farbParameter(Z, ohne.anpassung), !q.transparent);
    vignette(ctx, pb, ph, zahl(a.vignette, 0));
    koernung(ctx, pb, ph, zahl(a.koernung, 0));
    if (!ohne.effekt) effektZeichnen(ctx, pb, ph, Z.effekt);
    var e = { key: key, foto: foto, hell: helligkeitsRaster(foto), unscharf: null };
    if (mitCache) {
      if (!c) { c = { eintraege: [], treffer: 0 }; CACHE.set(q, c); }
      c.eintraege.unshift(e);
      while (c.eintraege.length > 2) freiEintrag(c.eintraege.pop());
    }
    return e;
  }
  /* Helligkeitsraster 64 Zellen auf der kurzen Seite (für Lesbarkeit der Schrift) */
  function helligkeitsRaster(foto) {
    var kurz = Math.min(foto.width, foto.height), nb = Math.max(1, Math.round(64 * foto.width / kurz)), nh = Math.max(1, Math.round(64 * foto.height / kurz));
    var c = leinwand(nb, nh), x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#808080'; x.fillRect(0, 0, nb, nh);      // durchsichtige Stellen: mittleres Grau annehmen
    x.imageSmoothingQuality = 'high'; x.drawImage(foto, 0, 0, nb, nh);
    var d = x.getImageData(0, 0, nb, nh).data; freiCanvas(c);
    return { nb: nb, nh: nh, d: d, sx: nb / foto.width, sy: nh / foto.height };
  }
  /* Misst Hintergrund unter einem Rechteck (Foto-Pixel): Mittelwert, hellste/dunkelste 10 % */
  function messen(hell, x, y, b, h) {
    var x0 = klemme(Math.floor(x * hell.sx), 0, hell.nb - 1), x1 = klemme(Math.ceil((x + b) * hell.sx), x0 + 1, hell.nb);
    var y0 = klemme(Math.floor(y * hell.sy), 0, hell.nh - 1), y1 = klemme(Math.ceil((y + h) * hell.sy), y0 + 1, hell.nh);
    var werte = [], sr = 0, sg = 0, sb = 0, n = 0;
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) {
      var p = (j * hell.nb + i) * 4, r = hell.d[p], g = hell.d[p + 1], bl = hell.d[p + 2];
      werte.push([luminanz(r, g, bl), r, g, bl]); sr += r; sg += g; sb += bl; n++;
    }
    werte.sort(function (a, b) { return a[0] - b[0]; });
    var lo = werte[Math.floor((werte.length - 1) * 0.08)], hi = werte[Math.ceil((werte.length - 1) * 0.92)];
    var mittel = [sr / n, sg / n, sb / n];
    return { mittel: mittel, l: luminanz(mittel[0], mittel[1], mittel[2]), dunkel: lo.slice(1), hell: hi.slice(1), lDunkel: lo[0], lHell: hi[0] };
  }
  function unscharfVon(e) {
    if (!e.unscharf) {
      var f = e.foto, kurz = Math.min(f.width, f.height), k = Math.max(1, Math.round(kurz / 40));
      var t = leinwand(Math.max(1, Math.round(f.width / k)), Math.max(1, Math.round(f.height / k)));
      var tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(f, 0, 0, t.width, t.height);
      var t2 = leinwand(Math.max(1, Math.round(t.width / 3)), Math.max(1, Math.round(t.height / 3)));
      t2.getContext('2d').drawImage(t, 0, 0, t2.width, t2.height);
      var u = leinwand(f.width, f.height), ux = u.getContext('2d'); ux.imageSmoothingQuality = 'high';
      ux.drawImage(t, 0, 0, u.width, u.height); ux.globalAlpha = 0.6; ux.drawImage(t2, 0, 0, u.width, u.height);
      freiCanvas(t); freiCanvas(t2); e.unscharf = u;
    }
    return e.unscharf;
  }

  /* ======================================================================
   * 9. Wettersymbole als Bilder (für das Canvas vorgeladen)
   * ==================================================================== */
  var SYMBOL_BILD = {}, symboleBereit = null;
  function symboleLaden() {
    if (symboleBereit) return symboleBereit;
    if (!root.KSSymbole || typeof Image === 'undefined') { symboleBereit = Promise.resolve(false); return symboleBereit; }
    symboleBereit = Promise.all(root.KSSymbole.ARTEN.map(function (art) {
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () { SYMBOL_BILD[art] = img; res(true); };
        img.onerror = function () { res(false); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(root.KSSymbole.svg(art, 256));
      });
    })).then(function () { return true; });
    return symboleBereit;
  }
  function symbolSvg(code, nacht) { return root.KSSymbole ? root.KSSymbole.svgFuerCode(code, !!nacht) : ''; }
  function zeichneSymbol(ctx, code, nacht, x, y, gr) {
    var S = root.KSSymbole, art = S ? S.artFuerCode(code, nacht) : 'wolke', img = SYMBOL_BILD[art];
    if (img && img.complete && img.naturalWidth) { ctx.drawImage(img, x, y, gr, gr); return; }
    var em = S ? S.EMOJI[art] : '⛅️';
    ctx.save(); ctx.font = font(400, gr * 0.78); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(em, x + gr / 2, y + gr * 0.54); ctx.restore();
  }

  /* ======================================================================
   * 10. Lesbarkeit: Schriftfarbe + Hinterlegung automatisch wählen
   * ==================================================================== */
  var WEISS = [255, 255, 255], DUNKEL = [28, 28, 30], SCHWARZ = [0, 0, 0];
  /* Ergebnis: { text:[r,g,b], textCss, tint:[r,g,b], deck:0…1, schatten:bool, hell:bool(Hintergrund hell) } */
  function lesbarkeit(mess, farbe, minDeck) {
    var bgs = [mess.dunkel, mess.hell, mess.mittel], text, tint;
    var eigene = farbe && farbe !== 'auto' && farbe !== 'hell' && farbe !== 'dunkel' ? hexZuRgb(farbe) : null;
    if (eigene) { text = eigene; tint = luminanz(eigene[0], eigene[1], eigene[2]) > 0.4 ? SCHWARZ : WEISS; }
    else if (farbe === 'hell') { text = WEISS; tint = SCHWARZ; }
    else if (farbe === 'dunkel') { text = DUNKEL; tint = WEISS; }
    else {
      // beide Möglichkeiten rechnen, die mit weniger nötiger Hinterlegung gewinnt (bei Gleichstand: weiß)
      var dW = noetigeDeckkraft(WEISS, SCHWARZ, bgs, 4.5, minDeck), dD = noetigeDeckkraft(DUNKEL, WEISS, bgs, 4.5, minDeck);
      if (dD + 0.12 < dW) { text = DUNKEL; tint = WEISS; } else { text = WEISS; tint = SCHWARZ; }
    }
    var deck = noetigeDeckkraft(text, tint, bgs, 4.5, minDeck || 0);
    return { text: text, textCss: 'rgb(' + text.join(',') + ')', tint: tint, deck: deck,
      tintCss: function (a) { return 'rgba(' + tint.join(',') + ',' + (a == null ? deck : a).toFixed(3) + ')'; },
      textA: function (a) { return 'rgba(' + text.join(',') + ',' + a + ')'; },
      hellText: luminanz(text[0], text[1], text[2]) > 0.5 };
  }
  function schatten(ctx, les, u, stark) {
    ctx.shadowColor = les.hellText ? 'rgba(0,0,0,' + (stark ? 0.55 : 0.35) + ')' : 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = (stark ? 14 : 8) * u; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = (stark ? 2 : 1) * u;
  }
  /* Weicher, elliptischer Hof hinter Schrift (statt harter Kasten); innen volle Deckkraft a */
  function weicherHof(ctx, x, y, b, h, farbe, a) {
    var cx = x + b / 2, cy = y + h / 2, rx = b * 0.5 + Math.min(b, h) * 0.45, ry = h * 0.5 + Math.min(b, h) * 0.45;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(rx / ry, 1);
    var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, ry), f = farbe.join(',');
    rg.addColorStop(0, 'rgba(' + f + ',' + a.toFixed(3) + ')'); rg.addColorStop(0.6, 'rgba(' + f + ',' + (a * 0.92).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(' + f + ',0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, ry, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function ohneSchatten(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  /* ======================================================================
   * 11. 7-Segment-Ziffern (Analog-Zeitstempel)
   * ==================================================================== */
  var SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', 'C': 'adef', 'E': 'adefg' };
  function segBreite(ch, H) {
    var W = H * 0.5;
    if (ch === ' ') return W * 0.55; if (ch === ':' || ch === '.') return W * 0.42; if (ch === "'") return W * 0.38; if (ch === '°') return W * 0.78;
    return W + H * 0.12;
  }
  function segText(ctx, text, x, y, H) {   // y = Oberkante; gibt Breite zurück
    var W = H * 0.5, t = H * 0.13, s = H * 0.035, schraeg = 0.1;
    function seg(x0, y0, x1, y1) {  // Segment als Sechseck zwischen zwei Punkten
      var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, nx = -uy * t / 2, ny = ux * t / 2;
      var ax = x0 + ux * s, ay = y0 + uy * s, bx = x1 - ux * s, by = y1 - uy * s;
      ctx.moveTo(ax, ay); ctx.lineTo(ax + ux * t / 2 + nx, ay + uy * t / 2 + ny); ctx.lineTo(bx - ux * t / 2 + nx, by - uy * t / 2 + ny);
      ctx.lineTo(bx, by); ctx.lineTo(bx - ux * t / 2 - nx, by - uy * t / 2 - ny); ctx.lineTo(ax + ux * t / 2 - nx, ay + uy * t / 2 - ny); ctx.closePath();
    }
    var cx = x;
    ctx.beginPath();
    Array.from(String(text)).forEach(function (ch) {
      var sk = function (py) { return (H - (py - y)) * schraeg; };   // leichte Schrägstellung wie echte LED
      if (SEG[ch]) {
        var L = cx + t / 2, R = cx + W - t / 2, O = y + t / 2, M = y + H / 2, U = y + H - t / 2;
        var P = function (px, py) { return [px + sk(py), py]; };
        var pt = { a: [P(L, O), P(R, O)], b: [P(R, O), P(R, M)], c: [P(R, M), P(R, U)], d: [P(L, U), P(R, U)], e: [P(L, M), P(L, U)], f: [P(L, O), P(L, M)], g: [P(L, M), P(R, M)] };
        Array.from(SEG[ch]).forEach(function (k) { var p = pt[k]; seg(p[0][0], p[0][1], p[1][0], p[1][1]); });
      } else if (ch === ':' || ch === '.') {
        var r = t * 0.6, mx = cx + W * 0.2;
        if (ch === ':') { ctx.moveTo(mx + sk(y + H * 0.32) + r, y + H * 0.32); ctx.arc(mx + sk(y + H * 0.32), y + H * 0.32, r, 0, Math.PI * 2); }
        ctx.moveTo(mx + sk(y + H * 0.78) + r, y + H * 0.78); ctx.arc(mx + sk(y + H * 0.78), y + H * 0.78, r, 0, Math.PI * 2);
      } else if (ch === "'") {
        seg(cx + W * 0.18 + sk(y), y + t * 0.2, cx + W * 0.12 + sk(y + H * 0.3), y + H * 0.3);
      } else if (ch === '°') {
        var q = H * 0.3, ox = cx + t / 2 + sk(y), oy = y + t / 2;
        seg(ox, oy, ox + q, oy); seg(ox + q, oy, ox + q, oy + q); seg(ox, oy + q, ox + q, oy + q); seg(ox, oy, ox, oy + q);
      }
      cx += segBreite(ch, H);
    });
    ctx.fill();
    return cx - x;
  }
  function segMessen(text, H) { var b = 0; Array.from(String(text)).forEach(function (ch) { b += segBreite(ch, H); }); return b; }

  /* ======================================================================
   * 12. Wetter-Overlay: 6 Stile
   * ==================================================================== */
  /* Ankerposition für ein Feld der Größe fb×fh im Foto pb×ph */
  function platz(ov, pb, ph, fb, fh, rand, stilStd) {
    var pos = ov.position || 'unten';
    if (stilStd && stilStd[pos]) pos = stilStd[pos];
    var x, y;
    if (pos === 'frei') {
      x = klemme(zahl(ov.x, 0.5) * pb - fb / 2, 0, Math.max(0, pb - fb)); y = klemme(zahl(ov.y, 0.9) * ph - fh / 2, 0, Math.max(0, ph - fh));
      return { x: x, y: y, ausr: 'mitte', pos: pos };
    }
    var oben = /^oben/.test(pos), links = /links$/.test(pos), rechts = /rechts$/.test(pos);
    x = links ? rand : rechts ? pb - rand - fb : (pb - fb) / 2;
    y = oben ? rand : ph - rand - fh;
    return { x: x, y: y, ausr: links ? 'links' : rechts ? 'rechts' : 'mitte', pos: pos };
  }
  function nebenInfos(m) {   // Zusatzwerte als kurze Liste
    // geschützte Leerzeichen: ein Wert wird nie mitten im Wert umbrochen, nur an den Trennpunkten
    return ['wind', 'boeen', 'regen', 'regenRisiko', 'feuchte', 'uv', 'sonne', 'druck'].filter(function (k) { return m[k]; }).map(function (k) { return m[k].text.replace(/ /g, '\u00A0'); });
  }
  function zeitZeile(m) { return [m.datum && m.datum.text.replace(/ /g, '\u00A0'), m.uhrzeit && m.uhrzeit.text.replace(/ /g, '\u00A0')].filter(Boolean).join(' · '); }

  function zeichneOverlay(ctx, Z, w, e, pb, ph, ox, oy) {
    var ov = Z.overlay || {}, stil = ov.stil || 'glas';
    if (stil === 'aus') return null;
    var m = zeilenMap(Z, w);
    if (!Object.keys(m).length) return null;
    var u = Math.min(pb, ph) / 1000 * klemme(zahl(ov.groesse, 1), 0.4, 2.5), basisU = Math.min(pb, ph) / 1000;
    var rand = 44 * basisU, maxB = pb - 2 * rand;
    ctx.save(); ctx.translate(ox, oy);
    ctx.beginPath(); ctx.rect(0, 0, pb, ph); ctx.clip();
    var fn = OVERLAY[stil] || OVERLAY.glas, feld;
    // Passt nicht? Schrittweise verkleinern, bis es in die Breite passt.
    for (var versuch = 0; versuch < 8; versuch++) {
      var plan = fn.planen(ctx, m, u, maxB, ph, w, pb), grenzeB = fn.voll ? pb : maxB;
      if (plan.b <= grenzeB + 0.5 && plan.h <= ph - 2 * rand || versuch === 7) {
        var p = fn.voll ? { x: 0, y: (/^oben/.test(ov.position) ? 0 : ph - plan.h), ausr: 'mitte', pos: ov.position } : platz(ov, pb, ph, plan.b, plan.h, rand, fn.std);
        if (fn.voll && ov.position === 'frei') p.y = klemme(zahl(ov.y, 0.9) * ph - plan.h / 2, 0, ph - plan.h);
        var mess = messen(e.hell, p.x, p.y, plan.b, plan.h);
        fn.zeichnen(ctx, plan, p, mess, ov, u, e, m, w);
        feld = { art: 'overlay', id: 'overlay', x: ox + p.x, y: oy + p.y, b: plan.b, h: plan.h };
        break;
      }
      u *= Math.min(0.92, (grenzeB / plan.b) * 0.99, ((ph - 2 * rand) / plan.h) * 0.99);
    }
    ctx.restore();
    return feld;
  }

  var OVERLAY = {
    /* Milchglas-Karte: Symbol + große Temperatur, rechts Lage und Ort, darunter Zeit und Zusatzwerte */
    glas: {
      planen: function (ctx, m, u, maxB) {
        var p = { pad: 30 * u, sym: m.symbol ? 92 * u : 0, gap: 18 * u };
        ctx.font = font(600, 84 * u); p.tB = m.temperatur ? ctx.measureText(m.temperatur.text).width : 0;
        ctx.font = font(600, 33 * u); p.lB = m.lage ? ctx.measureText(m.lage.text).width : 0;
        ctx.font = font(400, 29 * u); p.oB = m.ort ? ctx.measureText(m.ort.text).width : 0;
        var kopf = p.sym + (p.sym && p.tB ? p.gap * 0.6 : 0) + p.tB, rechts = Math.max(p.lB, p.oB);
        p.kopfB = kopf + (kopf && rechts ? p.gap * 1.4 : 0) + rechts;
        p.kopfH = Math.max(p.sym, m.temperatur ? 88 * u : 0, (m.lage ? 40 * u : 0) + (m.ort ? 36 * u : 0));
        var unten = [zeitZeile(m)].concat(nebenInfos(m)).filter(Boolean).join('  ·  ');
        ctx.font = font(500, 25 * u);
        var innen = Math.max(p.kopfB, Math.min(maxB - 2 * p.pad, Math.max(p.kopfB, 520 * u)));
        p.unten = unten ? umbrechen(ctx, unten, Math.max(innen, 200 * u)) : [];
        p.untenB = p.unten.reduce(function (a, z) { return Math.max(a, ctx.measureText(z).width); }, 0);
        p.logo = !!m.logo; ctx.font = font(600, 19 * u); p.logoB = p.logo ? ctx.measureText(APP_NAME.toUpperCase()).width + 4 * u * 9 : 0;
        p.innenB = Math.max(p.kopfB, p.untenB, p.logoB);
        p.b = p.innenB + 2 * p.pad;
        p.h = p.pad * 2 + p.kopfH + (p.unten.length ? 22 * u + p.unten.length * 34 * u : 0) + (p.logo ? (p.unten.length ? 14 * u : 18 * u) + 20 * u : 0);
        return p;
      },
      zeichnen: function (ctx, p, pos, mess, ov, u, e) {
        var les = lesbarkeit(mess, ov.farbe, 0.18), x = pos.x, y = pos.y, r = 34 * u;
        // Milchglas: unscharfes Foto + Tönung (Deckkraft so, dass Kontrast ≥ 4,5:1)
        ctx.save(); abgerundet(ctx, x, y, p.b, p.h, r); ctx.clip();
        ctx.drawImage(unscharfVon(e), 0, 0);
        ctx.fillStyle = les.tintCss(Math.max(les.deck, les.hellText ? 0.22 : 0.5)); ctx.fillRect(x, y, p.b, p.h);
        ctx.restore();
        ctx.save(); abgerundet(ctx, x + 0.5, y + 0.5, p.b - 1, p.h - 1, r); ctx.lineWidth = Math.max(1, 1.5 * u);
        ctx.strokeStyle = les.hellText ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.7)'; ctx.stroke(); ctx.restore();
        var m = p.m || null; void m;
        var cx = x + p.pad, cy = y + p.pad, mitte = cy + p.kopfH / 2;
        ctx.fillStyle = les.textCss; ctx.textBaseline = 'alphabetic';
        var d = this._m;
        if (p.sym) { zeichneSymbol(ctx, d.symbol.code, d.symbol.nacht, cx - 4 * u, mitte - p.sym / 2, p.sym); cx += p.sym + (p.tB ? p.gap * 0.6 : 0); }
        if (p.tB) { ctx.font = font(600, 84 * u); ctx.fillText(d.temperatur.text, cx, mitte + 30 * u); cx += p.tB; }
        if (p.lB || p.oB) {
          cx += (p.sym || p.tB) ? p.gap * 1.4 : 0;
          var zh = (d.lage ? 40 * u : 0) + (d.ort ? 36 * u : 0), zy = mitte - zh / 2;
          if (d.lage) { ctx.font = font(600, 33 * u); ctx.fillText(d.lage.text, cx, zy + 31 * u); zy += 40 * u; }
          if (d.ort) { ctx.font = font(400, 29 * u); ctx.fillStyle = les.textA(0.82); ctx.fillText(d.ort.text, cx, zy + 28 * u); ctx.fillStyle = les.textCss; }
        }
        var ty = y + p.pad + p.kopfH;
        if (p.unten.length) {
          ty += 12 * u;
          ctx.fillStyle = les.textA(0.22); ctx.fillRect(x + p.pad, ty, p.b - 2 * p.pad, Math.max(1, 1.5 * u)); ty += 10 * u;
          ctx.font = font(500, 25 * u); ctx.fillStyle = les.textA(0.9);
          p.unten.forEach(function (z) { ty += 34 * u; ctx.fillText(z, x + p.pad, ty - 8 * u); });
        }
        if (p.logo) {
          ctx.font = font(600, 19 * u); ctx.fillStyle = les.textA(0.62);
          if ('letterSpacing' in ctx) ctx.letterSpacing = (3 * u).toFixed(1) + 'px';
          ctx.textAlign = 'right'; ctx.fillText(APP_NAME.toUpperCase(), x + p.b - p.pad + ('letterSpacing' in ctx ? 3 * u : 0), y + p.h - p.pad + 2 * u);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          ctx.textAlign = 'left';
        }
      }
    },
    /* Band über die ganze Breite */
    band: {
      voll: true,
      planen: function (ctx, m, u, maxB, ph, w, pb) {
        var p = { pad: 40 * u, sym: m.symbol ? 70 * u : 0 };
        ctx.font = font(600, 66 * u); p.tB = m.temperatur ? ctx.measureText(m.temperatur.text).width : 0;
        var mitte = [m.lage && m.lage.text, m.ort && m.ort.text].filter(Boolean);
        ctx.font = font(600, 30 * u); p.l1 = m.lage ? m.lage.text : ''; p.l1B = p.l1 ? ctx.measureText(p.l1).width : 0;
        ctx.font = font(400, 27 * u); p.l2 = m.ort ? m.ort.text : ''; p.l2B = p.l2 ? ctx.measureText(p.l2).width : 0;
        ctx.font = font(500, 26 * u); p.z1 = m.datum ? m.datum.text : ''; p.z2 = m.uhrzeit ? m.uhrzeit.text : '';
        p.zB = Math.max(p.z1 ? ctx.measureText(p.z1).width : 0, p.z2 ? ctx.measureText(p.z2).width : 0);
        p.neben = nebenInfos(m).join('   ·   '); ctx.font = font(500, 23 * u); p.nebenB = p.neben ? ctx.measureText(p.neben).width : 0;
        p.logo = !!m.logo;
        var links = p.sym + (p.sym && p.tB ? 14 * u : 0) + p.tB, mitteB = Math.max(p.l1B, p.l2B);
        p.innen = links + (mitteB ? 34 * u + mitteB : 0) + (p.zB ? 34 * u + p.zB : 0);
        p.zeilen = p.innen + 2 * p.pad > pb ? 2 : 1;   // zu schmal → Zeit in eigene Zeile
        p.b = pb; p.kopfH = Math.max(p.sym, p.tB ? 70 * u : 0, (p.l1 ? 36 * u : 0) + (p.l2 ? 33 * u : 0));
        p.h = p.pad * 1.3 + p.kopfH + (p.zeilen === 2 && p.zB ? 42 * u : 0) + (p.neben || p.logo ? 40 * u : 0) + p.pad * 0.9;
        p.mindest = links + Math.max(mitteB, 0) + 2 * p.pad + 40 * u;
        if (p.mindest > pb) p.b = p.mindest;  // erzwingt Verkleinern
        void mitte; void maxB; void w; void ph;
        return p;
      },
      zeichnen: function (ctx, p, pos, mess, ov, u, e) {
        var les = lesbarkeit(mess, ov.farbe, 0.3), x = 0, y = pos.y, oben = /^oben/.test(pos.pos);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, p.b, p.h); ctx.clip();
        ctx.drawImage(unscharfVon(e), 0, 0);
        var gr = ctx.createLinearGradient(0, oben ? y + p.h : y, 0, oben ? y : y + p.h);
        gr.addColorStop(0, les.tintCss(Math.max(0.3, les.deck * 0.85))); gr.addColorStop(1, les.tintCss(Math.min(0.96, Math.max(0.42, les.deck * 1.1))));
        ctx.fillStyle = gr; ctx.fillRect(x, y, p.b, p.h); ctx.restore();
        var d = this._m, cx = p.pad, mitte = y + p.pad * 1.3 + p.kopfH / 2 - 4 * u;
        ctx.fillStyle = les.textCss;
        if (p.sym) { zeichneSymbol(ctx, d.symbol.code, d.symbol.nacht, cx - 4 * u, mitte - p.sym / 2, p.sym); cx += p.sym + (p.tB ? 14 * u : 0); }
        if (p.tB) { ctx.font = font(600, 66 * u); ctx.fillText(d.temperatur.text, cx, mitte + 24 * u); cx += p.tB; }
        if (p.l1 || p.l2) {
          cx += 34 * u; var zh = (p.l1 ? 36 * u : 0) + (p.l2 ? 33 * u : 0), zy = mitte - zh / 2;
          if (p.l1) { ctx.font = font(600, 30 * u); ctx.fillText(p.l1, cx, zy + 28 * u); zy += 36 * u; }
          if (p.l2) { ctx.font = font(400, 27 * u); ctx.fillStyle = les.textA(0.85); ctx.fillText(p.l2, cx, zy + 26 * u); ctx.fillStyle = les.textCss; }
        }
        var ny = y + p.pad * 1.3 + p.kopfH;
        if (p.zB) {
          ctx.font = font(500, 26 * u); ctx.fillStyle = les.textA(0.92);
          if (p.zeilen === 1) {
            ctx.textAlign = 'right';
            var zz = [p.z1, p.z2].filter(Boolean), zy2 = mitte - (zz.length - 1) * 17 * u + 9 * u;
            zz.forEach(function (t, i) { ctx.fillText(t, p.b - p.pad, zy2 + i * 34 * u); });
            ctx.textAlign = 'left';
          } else { ny += 42 * u; ctx.fillText([p.z1, p.z2].filter(Boolean).join(' · '), p.pad, ny - 6 * u); }
        }
        if (p.neben || p.logo) {
          ny += 40 * u; ctx.font = font(500, 23 * u); ctx.fillStyle = les.textA(0.8);
          if (p.neben) ctx.fillText(p.neben, p.pad, ny - 6 * u);
          if (p.logo) { ctx.font = font(700, 18 * u); ctx.textAlign = 'right'; ctx.fillStyle = les.textA(0.6); ctx.fillText(APP_NAME.toUpperCase().split('').join(' '), p.b - p.pad, ny - 6 * u); ctx.textAlign = 'left'; }
        }
      }
    },
    /* Einzelne Pillen */
    chips: {
      planen: function (ctx, m, u, maxB) {
        var chips = [], h = 58 * u, pad = 22 * u, gap = 12 * u;
        function chip(t, sym) { ctx.font = font(600, 26 * u); var b = ctx.measureText(t).width + 2 * pad + (sym ? 44 * u : 0); chips.push({ t: t, sym: sym, b: b }); }
        if (m.temperatur || m.symbol) chip(m.temperatur ? m.temperatur.text : (m.lage ? m.lage.text : ''), m.symbol || null);
        if (m.lage && m.temperatur) chip(m.lage.text);
        if (m.ort) chip('📍 ' + m.ort.text);
        var z = zeitZeile(m); if (z) chip(z);
        nebenInfos(m).forEach(function (t) { chip(t); });
        if (m.logo) chip(APP_NAME);
        var reihen = [[]], rb = [0];
        chips.forEach(function (c) {
          var r = reihen.length - 1, neu = rb[r] + (reihen[r].length ? gap : 0) + c.b;
          if (reihen[r].length && neu > maxB) { reihen.push([c]); rb.push(c.b); } else { reihen[r].push(c); rb[r] = neu; }
        });
        return { chips: chips, reihen: reihen, rb: rb, ch: h, pad: pad, gap: gap, b: Math.max.apply(null, rb), h: reihen.length * h + (reihen.length - 1) * gap };
      },
      zeichnen: function (ctx, p, pos, mess, ov, u, e) {
        var y = pos.y, d = this._m;
        p.reihen.forEach(function (reihe, ri) {
          var x = pos.ausr === 'links' ? pos.x : pos.ausr === 'rechts' ? pos.x + p.b - p.rb[ri] : pos.x + (p.b - p.rb[ri]) / 2;
          reihe.forEach(function (c) {
            var les = lesbarkeit(messen(e.hell, x, y, c.b, p.ch), ov.farbe, 0.2);
            ctx.save(); abgerundet(ctx, x, y, c.b, p.ch, p.ch / 2); ctx.clip(); ctx.drawImage(unscharfVon(e), 0, 0);
            ctx.fillStyle = les.tintCss(Math.max(les.deck, les.hellText ? 0.25 : 0.55)); ctx.fillRect(x, y, c.b, p.ch); ctx.restore();
            ctx.save(); abgerundet(ctx, x + 0.5, y + 0.5, c.b - 1, p.ch - 1, p.ch / 2); ctx.lineWidth = Math.max(1, 1.2 * u);
            ctx.strokeStyle = les.hellText ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)'; ctx.stroke(); ctx.restore();
            var tx = x + p.pad;
            if (c.sym) { zeichneSymbol(ctx, c.sym.code, c.sym.nacht, tx - 6 * u, y + (p.ch - 46 * u) / 2, 46 * u); tx += 44 * u; }
            ctx.font = font(600, 26 * u); ctx.fillStyle = les.textCss; ctx.textBaseline = 'middle'; ctx.fillText(c.t, tx, y + p.ch / 2 + 1 * u); ctx.textBaseline = 'alphabetic';
            x += c.b + p.gap;
          });
          y += p.ch + p.gap;
        });
        void d;
      }
    },
    /* Analog-Zeitstempel: orange 7-Segment-Ziffern */
    stempel: {
      std: { unten: 'unten-rechts', oben: 'oben-rechts' },
      planen: function (ctx, m, u) {
        var t = zeitTeile(this._w), H = 46 * u, p = { H: H, zeilen: [] };
        var datum = m.datum ? zwei(t.t) + ' ' + zwei(t.mo) + " '" + String(t.j).slice(2) : '';
        var z2 = [m.uhrzeit && t.h != null ? zwei(t.h) + ':' + zwei(t.mi) : '', m.temperatur && this._w.temp != null ? Math.round(this._w.temp) + '°C' : ''].filter(Boolean).join('  ');
        if (datum) p.zeilen.push(datum); if (z2) p.zeilen.push(z2);
        p.klein = [m.lage && m.lage.text, m.ort && m.ort.text].filter(Boolean).join(' · ').toUpperCase();
        ctx.font = font(600, 21 * u, 'mono'); p.kleinB = p.klein ? ctx.measureText(p.klein).width + (('letterSpacing' in ctx) ? p.klein.length * 2 * u : 0) : 0;
        p.zb = p.zeilen.map(function (z) { return segMessen(z, H); });
        p.pad = 16 * u;
        p.b = Math.max(p.kleinB, Math.max.apply(null, p.zb.concat([0]))) + 2 * p.pad;
        p.h = (p.klein ? 34 * u : 0) + p.zeilen.length * H + Math.max(0, p.zeilen.length - 1) * 16 * u + 2 * p.pad;
        if (!p.zeilen.length && !p.klein) { p.b = 0; p.h = 0; }
        return p;
      },
      zeichnen: function (ctx, p, pos, mess, ov, u) {
        if (!p.b) return;
        var orange = ov.farbe && /^#/.test(ov.farbe) ? hexZuRgb(ov.farbe) || [255, 138, 30] : [255, 138, 30];
        var lo = luminanz(orange[0], orange[1], orange[2]);
        // Lesbarkeit: weicher dunkler Hof, falls der Hintergrund zu hell ist (Kontrast < 4,5:1)
        var deck = noetigeDeckkraft(orange, SCHWARZ, [mess.hell, mess.mittel], 4.5, 0);
        if (kontrast(lo, mess.lHell) < 4.5 && deck > 0.02) {
          weicherHof(ctx, pos.x, pos.y, p.b, p.h, [0, 0, 0], Math.min(0.85, deck));
        }
        var fc = 'rgb(' + orange.join(',') + ')', y = pos.y + p.pad, rechts = pos.ausr !== 'links';
        ctx.save();
        ctx.fillStyle = fc; ctx.shadowColor = 'rgba(255,110,10,0.85)'; ctx.shadowBlur = 10 * u;
        if (p.klein) {
          ctx.font = font(600, 21 * u, 'mono'); if ('letterSpacing' in ctx) ctx.letterSpacing = (2 * u).toFixed(1) + 'px';
          ctx.textAlign = rechts ? 'right' : 'left'; ctx.fillText(p.klein, rechts ? pos.x + p.b - p.pad : pos.x + p.pad, y + 21 * u);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; y += 34 * u;
        }
        p.zeilen.forEach(function (z, i) {
          var zx = rechts ? pos.x + p.b - p.pad - p.zb[i] : pos.x + p.pad;
          ctx.globalAlpha = 0.55; ctx.shadowBlur = 18 * u; segText(ctx, z, zx, y, p.H);
          ctx.globalAlpha = 1; ctx.shadowBlur = 6 * u; segText(ctx, z, zx, y, p.H);
          y += p.H + 16 * u;
        });
        ctx.restore();
      }
    },
    /* Große Temperatur wie in der Wetter-App */
    gross: {
      std: { unten: 'unten-links', oben: 'oben-links' },
      planen: function (ctx, m, u) {
        var p = { sym: m.symbol ? 118 * u : 0 };
        ctx.font = font(200, 230 * u); p.tB = m.temperatur ? ctx.measureText(m.temperatur.text).width : 0;
        ctx.font = font(600, 46 * u); p.lB = m.lage ? ctx.measureText(m.lage.text).width : 0;
        p.unter = [m.ort && m.ort.text, zeitZeile(m)].filter(Boolean).join('  ·  ');
        ctx.font = font(500, 32 * u); p.uB = p.unter ? ctx.measureText(p.unter).width : 0;
        p.neben = nebenInfos(m).join('  ·  '); ctx.font = font(500, 27 * u); p.nB = p.neben ? ctx.measureText(p.neben).width : 0;
        p.logo = !!m.logo;
        p.kopfB = p.tB + (p.sym ? 18 * u + p.sym : 0); p.kopfH = p.tB ? 200 * u : p.sym;
        p.pad = 26 * u;
        p.b = Math.max(p.kopfB, p.lB, p.uB, p.nB, p.logo ? 160 * u : 0) + 2 * p.pad;
        p.h = p.kopfH + (p.lB ? 58 * u : 0) + (p.uB ? 44 * u : 0) + (p.nB ? 40 * u : 0) + (p.logo ? 36 * u : 0) + 2 * p.pad;
        return p;
      },
      zeichnen: function (ctx, p, pos, mess, ov, u) {
        var les = lesbarkeit(mess, ov.farbe, 0), d = this._m;
        var rechts = pos.ausr === 'rechts', mitte = pos.ausr === 'mitte';
        // Falls nötig: weicher Hof hinter der Schrift statt harter Kasten
        if (les.deck > 0.02) weicherHof(ctx, pos.x, pos.y, p.b, p.h, les.tint, Math.min(0.9, les.deck));
        ctx.save(); ctx.fillStyle = les.textCss; schatten(ctx, les, u, true);
        var al = rechts ? 'right' : mitte ? 'center' : 'left', ax = rechts ? pos.x + p.b - p.pad : mitte ? pos.x + p.b / 2 : pos.x + p.pad;
        var y = pos.y + p.pad;
        // Kopf: Temperatur + Symbol
        var kx = rechts ? ax - p.kopfB : mitte ? ax - p.kopfB / 2 : ax;
        if (p.tB) { ctx.font = font(200, 230 * u); ctx.textAlign = 'left'; ctx.fillText(d.temperatur.text, kx - 8 * u, y + 184 * u); }
        if (p.sym) { ohneSchatten(ctx); zeichneSymbol(ctx, d.symbol.code, d.symbol.nacht, kx + p.tB + 18 * u, y + (p.kopfH - p.sym) / 2 + 8 * u, p.sym); schatten(ctx, les, u, true); }
        y += p.kopfH; ctx.textAlign = al;
        if (p.lB) { ctx.font = font(600, 46 * u); ctx.fillText(d.lage.text, ax, y + 46 * u); y += 58 * u; }
        if (p.uB) { ctx.font = font(500, 32 * u); ctx.fillStyle = les.textA(0.9); ctx.fillText(p.unter, ax, y + 34 * u); y += 44 * u; }
        if (p.nB) { ctx.font = font(500, 27 * u); ctx.fillStyle = les.textA(0.85); ctx.fillText(p.neben, ax, y + 30 * u); y += 40 * u; }
        if (p.logo) { ctx.font = font(700, 19 * u); ctx.fillStyle = les.textA(0.7); ctx.fillText(APP_NAME.toUpperCase().split('').join(' '), ax, y + 28 * u); }
        ctx.restore();
      }
    },
    /* Eine feine Zeile */
    minimal: {
      planen: function (ctx, m, u, maxB) {
        // Zeile 1: Wetter und Ort, Zeile 2 (nur wenn nötig): Zeit, Zusatzwerte, App-Name
        var z1 = [m.temperatur && m.temperatur.text, m.lage && m.lage.text, m.ort && m.ort.text].filter(Boolean);
        var z2 = [zeitZeile(m).replace(' · ', ', ')].concat(nebenInfos(m)).concat(m.logo ? [APP_NAME] : []).filter(Boolean);
        var p = { sym: m.symbol ? 40 * u : 0, pad: 16 * u, fs: 30 * u };
        ctx.font = font(500, p.fs);
        var platzB = Math.max(200 * u, maxB - 2 * p.pad - p.sym - 10 * u), alle = z1.concat(z2).join('  ·  ');
        if (ctx.measureText(alle).width <= platzB || !z1.length || !z2.length) p.zeilen = umbrechen(ctx, alle, platzB);
        else p.zeilen = umbrechen(ctx, z1.join('  ·  '), platzB).concat(umbrechen(ctx, z2.join('  ·  '), platzB));
        p.zb = p.zeilen.map(function (t) { return ctx.measureText(t).width; });
        p.b = Math.max.apply(null, p.zb) + p.sym + (p.sym ? 10 * u : 0) + 2 * p.pad;
        p.h = p.zeilen.length * 42 * u + 2 * p.pad - 4 * u;
        return p;
      },
      zeichnen: function (ctx, p, pos, mess, ov, u) {
        var les = lesbarkeit(mess, ov.farbe, 0), d = this._m;
        if (les.deck > 0.02) { ctx.save(); abgerundet(ctx, pos.x, pos.y, p.b, p.h, p.h / 2 > 40 * u ? 24 * u : p.h / 2); ctx.fillStyle = les.tintCss(Math.min(0.92, les.deck + 0.05)); ctx.fill(); ctx.restore(); }
        ctx.save(); ctx.fillStyle = les.textCss; schatten(ctx, les, u, false);
        var x = pos.x + p.pad;
        if (p.sym) { ohneSchatten(ctx); zeichneSymbol(ctx, d.symbol.code, d.symbol.nacht, x - 4 * u, pos.y + p.pad + (42 * u - p.sym) / 2 - 3 * u, p.sym); schatten(ctx, les, u, false); x += p.sym + 10 * u; }
        ctx.font = font(500, p.fs);
        p.zeilen.forEach(function (z, i) { ctx.fillText(z, x, pos.y + p.pad + i * 42 * u + 30 * u); });
        ctx.restore();
      }
    }
  };
  // Zugriff auf Daten im Stil (ohne zusätzliche Parameter)
  Object.keys(OVERLAY).forEach(function (k) {
    var s = OVERLAY[k], pl = s.planen, ze = s.zeichnen;
    s.planen = function (ctx, m, u, maxB, ph, w, pb) { this._m = m; this._w = w; return pl.call(this, ctx, m, u, maxB, ph, w, pb); };
    s.zeichnen = function (ctx, p, pos, mess, ov, u, e, m, w) { this._m = m; this._w = w; ctx.save(); var r = ze.call(this, ctx, p, pos, mess, ov, u, e); ctx.restore(); return r; };
  });

  /* ======================================================================
   * 13. Rahmen, Sticker, Texte, Gruß
   * ==================================================================== */
  function zeichneRahmen(ctx, Z, ab) {
    var r = ab.rand, art = Z.rahmen;
    if (!art || art === 'keiner') return;
    var farbe = art === 'polaroid' ? '#FBFAF6' : art === 'postkarte' ? '#F7F1E3' : '#FFFFFF';
    ctx.save(); ctx.fillStyle = farbe; ctx.fillRect(0, 0, ab.b, ab.h);
    if (art === 'postkarte') {   // feine Papierstruktur, fester Startwert
      var rnd = zufall(77), u = Math.min(ab.pb, ab.ph) / 1000;
      for (var i = 0; i < 900; i++) { ctx.fillStyle = 'rgba(120,95,60,' + (0.02 + rnd() * 0.04).toFixed(3) + ')'; ctx.fillRect(rnd() * ab.b, rnd() * ab.h, (1 + rnd() * 2) * u, (1 + rnd() * 2) * u); }
    }
    ctx.restore();
  }
  function rahmenNachFoto(ctx, Z, ab) {   // feine Kante am Foto
    if (!Z.rahmen || Z.rahmen === 'keiner') return;
    var u = Math.min(ab.pb, ab.ph) / 1000;
    ctx.save(); ctx.strokeStyle = Z.rahmen === 'postkarte' ? 'rgba(110,85,50,0.35)' : 'rgba(0,0,0,0.10)'; ctx.lineWidth = Math.max(1, (Z.rahmen === 'postkarte' ? 2 : 1.2) * u);
    ctx.strokeRect(ab.rand.l - ctx.lineWidth / 2, ab.rand.o - ctx.lineWidth / 2, ab.pb + ctx.lineWidth, ab.ph + ctx.lineWidth);
    if (Z.rahmen === 'postkarte') {
      ctx.strokeStyle = 'rgba(110,85,50,0.22)'; ctx.lineWidth = Math.max(1, 1 * u);
      var a = ab.rand.l * 0.45; ctx.strokeRect(a, a, ab.b - 2 * a, ab.h - 2 * a);
    }
    ctx.restore();
  }
  function zeichneSticker(ctx, Z, w, ab, felder, e) {
    var pb = ab.pb, ph = ab.ph, kurz = Math.min(pb, ph), ox = ab.rand.l, oy = ab.rand.o;
    (Z.sticker || []).forEach(function (s, i) {
      var gr = 0.14 * kurz * klemme(zahl(s.groesse, 1), 0.2, 5), cx = ox + zahl(s.x, 0.5) * pb, cy = oy + zahl(s.y, 0.5) * ph, rot = zahl(s.drehung, 0) * Math.PI / 180;
      var b = gr, h = gr, u = gr / 140;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      if (s.art === 'wetter') {
        var wert = s.wert || 'temperatur', nacht = istNacht(w);
        if ((wert === 'symbol' || wert === 'temperatur') && w.code == null && w.temp == null) { ctx.restore(); return; }
        if (wert === 'symbol') {
          ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 3 * u;
          zeichneSymbol(ctx, w.code, nacht, -gr / 2, -gr / 2, gr);
        } else if (wert === 'temperatur') {
          // Blase: weißer Kreis, Symbol oben, Temperatur groß
          var R = gr / 2; b = h = gr;
          ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 5 * u;
          var bg = ctx.createLinearGradient(0, -R, 0, R); bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#EEF3F9');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ohneSchatten(ctx);
          zeichneSymbol(ctx, w.code, nacht, -R * 0.42, -R * 0.86, R * 0.84);
          ctx.fillStyle = '#1C1C1E'; ctx.font = font(700, R * 0.62, 'rund'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(tempText(w) || '–', R * 0.04, R * 0.6);
        } else if (wert === 'ort' || wert === 'lage') {
          var t = wert === 'ort' ? ortText(Z, w) : lageText(w);
          if (!t) { ctx.restore(); return; }       // Ort „aus": Sticker wird nicht gezeichnet
          var fs = gr * 0.24; ctx.font = font(600, fs);
          var tb = ctx.measureText(t).width, pill = fs * 1.9, ib = wert === 'ort' ? fs * 1.15 : 0;
          b = tb + ib + fs * 1.5; h = pill;
          ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 12 * u; ctx.shadowOffsetY = 4 * u;
          abgerundet(ctx, -b / 2, -h / 2, b, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill(); ohneSchatten(ctx);
          var x = -b / 2 + fs * 0.75;
          if (wert === 'ort') {   // Ortsnadel in Akzentblau
            ctx.fillStyle = '#086ADC'; var px = x + fs * 0.42, py = -fs * 0.12, pr = fs * 0.36;
            ctx.beginPath(); ctx.arc(px, py, pr, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(px, py + fs * 0.62); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, pr * 0.42, 0, Math.PI * 2); ctx.fill();
            x += ib;
          }
          ctx.fillStyle = '#1C1C1E'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, fs * 0.04);
        }
      } else if (s.art === 'bild') {
        // Eingefügtes Bild (z. B. freigestelltes Motiv): längste Seite = 2,5 × Sticker-Grundgröße, Transparenz bleibt
        var bi = bildStickerHolen(s.bild), lang = gr * 2.5;
        var iw = bi && bi.w ? bi.w : 1, ih = bi && bi.h ? bi.h : 1, fk = lang / Math.max(iw, ih);
        b = iw * fk; h = ih * fk;
        if (bi && bi.bereit) {
          ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = gr * 0.08; ctx.shadowOffsetY = gr * 0.03;
          ctx.drawImage(bi.img, -b / 2, -h / 2, b, h);
        }
      } else {
        ctx.font = font(400, gr * 0.86); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = gr * 0.06; ctx.shadowOffsetY = gr * 0.02;
        ctx.fillText(String(s.wert || '⭐️'), 0, gr * 0.04);
      }
      ctx.restore();
      felder.push(gedrehtesFeld('sticker', s.id != null ? s.id : 's' + i, cx, cy, b, h, rot));
    });
    void e;
  }
  /* Bild-Sticker: dataURL → dekodiertes Bild (Zwischenspeicher). Zeichnen ist synchron; ist ein Bild noch nicht
   * dekodiert, bleibt es in diesem Durchgang leer – die Oberfläche wartet vorher mit bildStickerLaden(). */
  var BILD_STICKER = new Map();
  function bildStickerHolen(src) {
    if (!src) return null;
    if (typeof src === 'object' && src.bild) { return { bereit: true, img: src.bild, w: src.breite, h: src.hoehe }; }
    var e = BILD_STICKER.get(src);
    if (!e && typeof Image !== 'undefined') {
      e = { bereit: false, img: new Image(), w: 0, h: 0 };
      e.versprechen = new Promise(function (ok) {
        e.img.onload = function () { e.bereit = true; e.w = e.img.naturalWidth; e.h = e.img.naturalHeight; ok(e); };
        e.img.onerror = function () { ok(e); };
      });
      e.img.src = src; BILD_STICKER.set(src, e);
      if (BILD_STICKER.size > 40) BILD_STICKER.delete(BILD_STICKER.keys().next().value);
    }
    return e || null;
  }
  function bildStickerLaden(src) { var e = bildStickerHolen(src); return e && e.versprechen ? e.versprechen.then(function () { return !!e.bereit; }) : Promise.resolve(!!(e && e.bereit)); }
  function alleBildSticker(Z) { return Promise.all((Z.sticker || []).filter(function (s) { return s.art === 'bild'; }).map(function (s) { return bildStickerLaden(s.bild); })); }
  /* Datei/Blob/Quelle → PNG-dataURL, längste Seite ≤ 1024 px (damit Z JSON-fähig und klein bleibt) */
  async function stickerAusBild(eingabe, max) {
    max = max || 1024;
    var bild, w, h, url = null;
    if (eingabe && eingabe.bild) { bild = eingabe.bild; w = eingabe.breite; h = eingabe.hoehe; }
    else {
      url = URL.createObjectURL(eingabe); var img = new Image(); img.src = url;
      try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw fehler('Dieses Bild lässt sich nicht als Sticker öffnen.', 'sticker'); }
      bild = img; w = img.naturalWidth; h = img.naturalHeight;
    }
    var f = Math.min(1, max / Math.max(w, h)), c = leinwand(Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)));
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bild, 0, 0, c.width, c.height);
    var d = c.toDataURL('image/png'); freiCanvas(c); if (url) URL.revokeObjectURL(url);
    return d;
  }
  function gedrehtesFeld(art, id, cx, cy, b, h, rot) {
    var c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), bb = b * c + h * s, hh = b * s + h * c;
    return { art: art, id: id, x: cx - bb / 2, y: cy - hh / 2, b: bb, h: hh, mitteX: cx, mitteY: cy, drehung: rot * 180 / Math.PI };
  }
  function zeichneTexte(ctx, Z, ab, felder, e) {
    var pb = ab.pb, ph = ab.ph, kurz = Math.min(pb, ph), ox = ab.rand.l, oy = ab.rand.o;
    (Z.texte || []).forEach(function (t, i) {
      var text = String(t.text == null ? '' : t.text); if (!text.trim()) return;
      var art = SCHRIFT[t.schrift] ? t.schrift : 'system', fs = 0.055 * kurz * klemme(zahl(t.groesse, 1), 0.2, 6);
      var gew = art === 'hand' ? 400 : art === 'serif' ? 500 : 700;
      ctx.save(); ctx.font = font(gew, fs, art);
      var zeilen = umbrechen(ctx, text, pb * 0.86), zh = fs * 1.22;
      var b = Math.max.apply(null, zeilen.map(function (z) { return ctx.measureText(z).width; })), h = zeilen.length * zh;
      var cx = ox + zahl(t.x, 0.5) * pb, cy = oy + zahl(t.y, 0.5) * ph, rot = zahl(t.drehung, 0) * Math.PI / 180;
      var farbe = hexZuRgb(t.farbe), pad = fs * 0.42, hint = !!t.hinterlegt;
      if (!farbe) {   // automatische Farbe nach Hintergrund
        var mess = messen(e.hell, cx - ox - b / 2, cy - oy - h / 2, b, h), les = lesbarkeit(mess, 'auto', 0);
        farbe = les.text;
      }
      var hellT = luminanz(farbe[0], farbe[1], farbe[2]) > 0.4;
      ctx.translate(cx, cy); ctx.rotate(rot);
      if (hint) {
        abgerundet(ctx, -b / 2 - pad, -h / 2 - pad * 0.7, b + 2 * pad, h + pad * 1.4, fs * 0.35);
        ctx.fillStyle = hellT ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.9)'; ctx.fill();
      } else {
        ctx.shadowColor = hellT ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)'; ctx.shadowBlur = fs * 0.18; ctx.shadowOffsetY = fs * 0.03;
      }
      ctx.fillStyle = 'rgb(' + farbe.join(',') + ')'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      zeilen.forEach(function (z, k) { ctx.fillText(z, 0, -h / 2 + zh * (k + 0.5) + fs * 0.04); });
      ctx.restore();
      felder.push(gedrehtesFeld('text', t.id != null ? t.id : 't' + i, cx, cy, b + (hint ? 2 * pad : 0), h + (hint ? 1.4 * pad : 0), rot));
    });
  }
  function grussText(Z) { return Z.postkarte && Z.postkarte.an ? String(Z.postkarte.gruss || '').trim() : ''; }
  function polaroidText(Z, w) {
    var g = grussText(Z); if (g) return g;
    var d = Z.daten || {}, t = [d.ort && d.ort !== 'aus' ? ortText(Z, w) : '', d.datum ? datumText(w, true) : ''].filter(Boolean);
    return t.join(', ');
  }
  function zeichnePolaroidText(ctx, Z, w, ab, felder) {
    if (Z.rahmen !== 'polaroid') return;
    var text = polaroidText(Z, w); if (!text) return;
    var kurz = Math.min(ab.pb, ab.ph), feldH = ab.rand.u, fs = Math.min(feldH * 0.4, kurz * 0.075);
    ctx.save(); ctx.font = font(400, fs, 'hand');
    var max = ab.b - 2 * ab.rand.l - fs;
    while (ctx.measureText(text).width > max && fs > 8) { fs *= 0.92; ctx.font = font(400, fs, 'hand'); }
    ctx.fillStyle = '#2C2C2E'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var y = ab.rand.o + ab.ph + feldH * 0.5;
    ctx.fillText(text, ab.b / 2, y); ctx.restore();
    if (grussText(Z)) felder.push({ art: 'gruss', id: 'gruss', x: ab.rand.l, y: ab.rand.o + ab.ph, b: ab.pb, h: feldH });
  }
  function zeichneGruss(ctx, Z, ab, felder, e) {
    var g = grussText(Z); if (!g || Z.rahmen === 'polaroid') return;
    var pb = ab.pb, ph = ab.ph, kurz = Math.min(pb, ph), fs = kurz * 0.1;
    var unten = !/^unten/.test((Z.overlay && Z.overlay.stil !== 'aus' && Z.overlay.position) || 'oben') ? true : false;
    ctx.save(); ctx.font = font(700, fs, 'schreib');
    var max = pb * 0.88;
    var zeilen = umbrechen(ctx, g, max);
    while ((zeilen.length > 2 || Math.max.apply(null, zeilen.map(function (z) { return ctx.measureText(z).width; })) > max) && fs > kurz * 0.035) {
      fs *= 0.92; ctx.font = font(700, fs, 'schreib'); zeilen = umbrechen(ctx, g, max);
    }
    var zh = fs * 1.15, h = zeilen.length * zh, b = Math.max.apply(null, zeilen.map(function (z) { return ctx.measureText(z).width; }));
    var cx = ab.rand.l + pb / 2, y0 = ab.rand.o + (unten ? ph - kurz * 0.06 - h : kurz * 0.06);
    var mess = messen(e.hell, (pb - b) / 2, y0 - ab.rand.o, b, h), les = lesbarkeit(mess, 'hell', 0);
    if (les.deck > 0.02) {   // weicher Verlauf vom Bildrand (wie iOS), Deckkraft so, dass Kontrast ≥ 4,5:1
      var a = Math.min(0.75, les.deck), rand = unten ? ab.rand.o + ph : ab.rand.o, weit = (unten ? rand - y0 : y0 + h - rand) + kurz * 0.12;
      var lg = ctx.createLinearGradient(0, rand, 0, unten ? rand - weit : rand + weit);
      lg.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')'); lg.addColorStop(0.62, 'rgba(0,0,0,' + (a * 0.9).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.fillStyle = lg; ctx.fillRect(ab.rand.l, unten ? rand - weit : rand, pb, weit); ctx.restore();
    }
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = fs * 0.14; ctx.shadowOffsetY = fs * 0.03;
    zeilen.forEach(function (z, k) { ctx.fillText(z, cx, y0 + zh * (k + 0.5)); });
    ctx.restore();
    felder.push({ art: 'gruss', id: 'gruss', x: cx - b / 2, y: y0, b: b, h: h });
  }

  /* ======================================================================
   * 14. Postkarten-Rückseite
   * ==================================================================== */
  function zeichneRueckseite(ctx, Z, w, B, H) {
    var felder = [], rs = (Z.postkarte && Z.postkarte.rueckseite) || {}, kurz = Math.min(B, H), u = kurz / 1000, quer = B >= H;
    // Karton
    var bg = ctx.createLinearGradient(0, 0, B, H); bg.addColorStop(0, '#F8F3E8'); bg.addColorStop(1, '#F1E9D8');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, B, H);
    var rnd = zufall(99);
    for (var i = 0; i < 2600; i++) { ctx.fillStyle = 'rgba(120,90,50,' + (0.015 + rnd() * 0.04).toFixed(3) + ')'; ctx.fillRect(rnd() * B, rnd() * H, (0.8 + rnd() * 2.2) * u, (0.8 + rnd() * 2.2) * u); }
    var rand = 60 * u, tinte = '#1F3A68', linie = 'rgba(95,75,45,0.45)';
    // Kopfzeile „POSTKARTE"
    ctx.save(); ctx.fillStyle = 'rgba(95,75,45,0.75)'; ctx.font = font(600, 24 * u, 'serif'); ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (10 * u).toFixed(1) + 'px';
    ctx.fillText('POSTKARTE', B / 2 + ('letterSpacing' in ctx ? 5 * u : 0), rand + 10 * u);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    var oben = rand + 44 * u;
    // Bereiche
    var textR, adrR;
    if (quer) {
      var tx = B * 0.54;
      textR = { x: rand, y: oben, b: tx - rand - 40 * u, h: H - oben - rand };
      adrR = { x: tx + 40 * u, y: oben, b: B - tx - 40 * u - rand, h: H - oben - rand };
      ctx.fillStyle = linie; ctx.fillRect(tx - 1 * u, oben + 10 * u, Math.max(1, 2 * u), H - oben - rand - 10 * u);
    } else {
      var ty = oben + (H - oben - rand) * 0.5;
      textR = { x: rand, y: oben, b: B - 2 * rand, h: ty - oben - 30 * u };
      adrR = { x: rand, y: ty + 30 * u, b: B - 2 * rand, h: H - ty - 30 * u - rand };
      ctx.fillStyle = linie; ctx.fillRect(rand, ty - 1 * u, B - 2 * rand, Math.max(1, 2 * u));
    }
    // Briefmarke oben rechts im Adressbereich
    var mb = Math.min(adrR.b * 0.42, 230 * u), mh = mb * 1.2, mx = adrR.x + adrR.b - mb, my = adrR.y;
    if (rs.briefmarke !== false) { zeichneBriefmarke(ctx, Z, w, mx, my, mb, mh, u); felder.push({ art: 'briefmarke', id: 'briefmarke', x: mx, y: my, b: mb, h: mh }); }
    var sr = mb * 0.4;
    if (rs.stempel !== false) zeichnePoststempel(ctx, Z, w, mx - sr * 0.55, my + mh * 0.66, sr, u);
    // Empfängerlinien unter Marke und Stempel
    var lz = 4, frei = adrR.y + mh + sr * 0.5 + 30 * u, lAbst = Math.min(84 * u, (adrR.y + adrR.h - frei) / (lz - 0.2));
    var ly0 = Math.max(frei + lAbst * 0.8, adrR.y + adrR.h - (lz - 1) * lAbst);
    var lx = adrR.x + (quer ? 0 : adrR.b * 0.3), lb = adrR.x + adrR.b - lx;
    ctx.fillStyle = linie;
    for (var l = 0; l < lz; l++) ctx.fillRect(lx, ly0 + l * lAbst, lb, Math.max(1, 1.6 * u));
    var empf = String(rs.empfaenger || '').split(/\n|,\s*/).filter(Boolean).slice(0, lz);
    if (empf.length) {
      ctx.save(); ctx.fillStyle = tinte; var efs = Math.min(lAbst * 0.62, 44 * u); ctx.font = font(400, efs, 'hand');
      empf.forEach(function (z, k) { var t = z; while (ctx.measureText(t).width > lb - 10 * u && t.length > 1) t = t.slice(0, -1); ctx.fillText(t, lx + 8 * u, ly0 + k * lAbst - lAbst * 0.16); });
      ctx.restore();
    }
    felder.push({ art: 'empfaenger', id: 'empfaenger', x: lx, y: ly0 - lAbst, b: lb, h: lz * lAbst });
    // Text in Handschrift, Größe passt sich an
    var text = String(rs.text || ''), unters = String(rs.unterschrift || '');
    ctx.save(); ctx.fillStyle = tinte; ctx.textBaseline = 'alphabetic';
    var fs = 50 * u, zeilen, zh;
    var platzH = textR.h - (unters ? fs * 1.8 : 0);
    for (var v = 0; v < 30; v++) {
      ctx.font = font(400, fs, 'hand'); zeilen = text ? umbrechen(ctx, text, textR.b) : []; zh = fs * 1.42;
      platzH = textR.h - (unters ? fs * 1.9 : 0);
      if (zeilen.length * zh <= platzH || fs < 18 * u) break;
      fs *= 0.92;
    }
    if (zeilen.length * zh > platzH) zeilen = zeilen.slice(0, Math.max(1, Math.floor(platzH / zh)));
    // feine Schreiblinien als Hilfe (wie liniertes Kartenfeld), nur wenn kein Text
    if (!zeilen.length) {
      ctx.fillStyle = 'rgba(95,75,45,0.16)';
      for (var y = textR.y + 70 * u; y < textR.y + textR.h - 20 * u; y += 70 * u) ctx.fillRect(textR.x, y, textR.b, Math.max(1, 1.2 * u));
      ctx.fillStyle = tinte;
    }
    zeilen.forEach(function (z, k) { ctx.fillText(z, textR.x, textR.y + fs + k * zh); });
    if (unters) {
      ctx.font = font(400, fs * 1.08, 'hand'); ctx.textAlign = 'right';
      var uy = Math.min(textR.y + textR.h - fs * 0.3, textR.y + fs + zeilen.length * zh + fs * 0.9);
      ctx.fillText(unters, textR.x + textR.b, uy);
    }
    ctx.restore();
    felder.push({ art: 'rueckseite-text', id: 'rueckseite-text', x: textR.x, y: textR.y, b: textR.b, h: textR.h });
    return felder;
  }
  function zeichneBriefmarke(ctx, Z, w, x, y, b, h, u) {
    var zr = b * 0.045, rand = zr * 2.2;
    ctx.save(); ctx.save();
    ctx.shadowColor = 'rgba(60,40,10,0.25)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 3 * u;
    // gezackter Rand: Rechteck mit ausgestanzten Halbkreisen
    ctx.beginPath(); ctx.rect(x, y, b, h);
    var nB = Math.round(b / (zr * 3)), nH = Math.round(h / (zr * 3));
    for (var i = 0; i <= nB; i++) { var px = x + i * b / nB; ctx.moveTo(px + zr, y); ctx.arc(px, y, zr, 0, Math.PI * 2); ctx.moveTo(px + zr, y + h); ctx.arc(px, y + h, zr, 0, Math.PI * 2); }
    for (var j = 1; j < nH; j++) { var py = y + j * h / nH; ctx.moveTo(x + zr, py); ctx.arc(x, py, zr, 0, Math.PI * 2); ctx.moveTo(x + b + zr, py); ctx.arc(x + b, py, zr, 0, Math.PI * 2); }
    ctx.fillStyle = '#FFFEFA'; ctx.fill('evenodd'); ctx.restore();
    // Motiv: Himmel nach Wetterlage
    var ix = x + rand, iy = y + rand, ib = b - 2 * rand, ih = h - 2 * rand, nacht = istNacht(w), code = zahl(w.code, 2);
    var oben = nacht ? '#1B2A4A' : code >= 51 ? '#7D93AD' : code >= 3 ? '#9DB5CF' : '#4F9BE8', unten = nacht ? '#3A4D78' : code >= 51 ? '#B9C6D4' : code >= 3 ? '#D5E1EC' : '#A8D2F8';
    var gr = ctx.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, oben); gr.addColorStop(1, unten);
    ctx.fillStyle = gr; ctx.fillRect(ix, iy, ib, ih);
    zeichneSymbol(ctx, code, nacht, ix + ib * 0.14, iy + ih * 0.06, ib * 0.72);
    var dunkelText = !nacht && code < 51 && code >= 3;
    ctx.fillStyle = dunkelText ? '#13233D' : '#FFFFFF'; ctx.textAlign = 'center';
    ctx.shadowColor = dunkelText ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4 * u;
    ctx.font = font(700, ib * 0.27, 'rund'); ctx.fillText(tempText(w) || '', ix + ib / 2, iy + ih * 0.78);
    var ort = Z.daten && Z.daten.ort !== 'aus' ? ortText(Z, w, Z.daten.ort === 'genau' ? 'stadt' : Z.daten.ort) : '';
    ctx.font = font(700, ib * 0.095);
    var ot = (ort || APP_NAME).toUpperCase(); while (ctx.measureText(ot).width > ib * 0.9 && ot.length > 2) ot = ot.slice(0, -1);
    ctx.fillText(ot, ix + ib / 2, iy + ih * 0.93);
    ctx.restore();
  }
  function zeichnePoststempel(ctx, Z, w, cx, cy, r, u) {
    var t = zeitTeile(w), farbe = 'rgba(40,45,80,0.62)';
    ctx.save(); ctx.strokeStyle = farbe; ctx.fillStyle = farbe; ctx.lineWidth = Math.max(1, 3.2 * u);
    ctx.translate(cx, cy); ctx.rotate(-0.18);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, 1.8 * u); ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    // Ort im Bogen oben
    var ort = (Z.daten && Z.daten.ort !== 'aus' ? ortText(Z, w, 'stadt') : '') || APP_NAME.toUpperCase();
    ort = ort.toUpperCase(); ctx.font = font(700, r * 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var zeichen = Array.from(ort), bogen = Math.min(Math.PI * 1.1, zeichen.length * 0.27), start = -Math.PI / 2 - bogen / 2;
    zeichen.forEach(function (c, i) {
      var a = start + bogen * (zeichen.length === 1 ? 0.5 : i / (zeichen.length - 1));
      ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.fillText(c, 0, -r * 0.9 + r * 0.0); ctx.restore();
    });
    // Datum in der Mitte
    ctx.font = font(700, r * 0.26, 'mono'); ctx.fillText(zwei(t.t) + '.' + zwei(t.mo) + '.' + String(t.j).slice(2), 0, -r * 0.02);
    ctx.font = font(600, r * 0.18, 'mono'); if (t.h != null) ctx.fillText(zwei(t.h) + '–' + (t.h + 1 < 24 ? zwei(t.h + 1) : '00'), 0, r * 0.3);
    // Wellenlinien nach links
    ctx.lineWidth = Math.max(1, 2.6 * u);
    for (var k = -2; k <= 2; k++) {
      ctx.beginPath(); var yy = k * r * 0.22;
      for (var x = -r * 1.1; x > -r * 2.7; x -= 2 * u) { var yw = yy + Math.sin(x / (r * 0.22)) * r * 0.07; if (x === -r * 1.1) ctx.moveTo(x, yw); else ctx.lineTo(x, yw); }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ======================================================================
   * 15. render, renderZuschneiden
   * ==================================================================== */
  var LETZTE_ZEIT = { teuer: 0, gesamt: 0, cache: false };
  function ohneMenge(liste) {
    var o = {}; (liste || []).forEach(function (k) { o[k] = true; });
    if (o.alles) { o.daten = o.texte = o.sticker = o.gruss = o.rahmen = true; o.zuschnitt = true; }
    return o;
  }
  function renderIntern(canvas, q, Z, w, opt) {
    var t0 = now();
    Z = neuerZustand(Z); w = w || {}; opt = opt || {}; APP_NAME = appName(Z);
    var ohne = ohneMenge(opt.ohneEbenen), dpr = opt.dpr ? zahl(opt.dpr, 1) : 1;
    var ziel = opt.maxSeite === 'original' ? 'original' : zahl(opt.maxSeite, 1200) * dpr;
    var Zg = ohne.zuschnitt ? neuerZustand(Object.assign({}, Z, { format: 'frei', zuschnitt: null })) : Z;
    if (ohne.rahmen) Zg = Object.assign({}, Zg, { rahmen: 'keiner' });
    var ab = ausgabeMasse(q, Zg, ziel, !!ohne.rahmen);
    var felder = [];
    if (opt.seite === 'hinten') {
      var abV = ausgabeMasse(q, Z, ziel, false);
      canvas.width = abV.b; canvas.height = abV.h;
      var cx = canvas.getContext('2d');
      cx.clearRect(0, 0, abV.b, abV.h);
      felder = zeichneRueckseite(cx, Z, w, abV.b, abV.h);
      LETZTE_ZEIT = { teuer: 0, gesamt: now() - t0, cache: false };
      return { breite: abV.b, hoehe: abV.h, felder: felder, seite: 'hinten', dpr: dpr };
    }
    var t1 = now(), vorCache = CACHE.get(q), treffer0 = vorCache ? vorCache.treffer : 0;
    var e = fotoSchicht(q, Zg, ab, ohne, opt.vorschau !== false);
    var t2 = now();
    canvas.width = ab.b; canvas.height = ab.h;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, ab.b, ab.h);
    if (!ohne.rahmen) zeichneRahmen(ctx, Zg, ab);
    ctx.drawImage(e.foto, ab.rand.l, ab.rand.o);
    if (!ohne.rahmen) { rahmenNachFoto(ctx, Zg, ab); zeichnePolaroidText(ctx, Zg, w, ab, felder); }
    if (!ohne.daten) { var f = zeichneOverlay(ctx, Zg, w, e, ab.pb, ab.ph, ab.rand.l, ab.rand.o); if (f) felder.push(f); }
    if (!ohne.sticker) zeichneSticker(ctx, Zg, w, ab, felder, e);
    if (!ohne.texte) zeichneTexte(ctx, Zg, ab, felder, e);
    if (!ohne.gruss) zeichneGruss(ctx, Zg, ab, felder, e);
    if (opt.vorschau === false) freiEintrag(e);
    var c2 = CACHE.get(q);
    LETZTE_ZEIT = { teuer: t2 - t1, gesamt: now() - t0, cache: !!(c2 && c2.treffer > treffer0) };
    var layout = { breite: ab.b, hoehe: ab.h, felder: felder, seite: 'vorne', dpr: dpr,
      foto: { x: ab.rand.l, y: ab.rand.o, b: ab.pb, h: ab.ph } };
    if (ohne.zuschnitt) {   // Zuschnitt-Rahmen im ungeschnittenen Bild
      var g = geometrie(q, Z), s = ab.pb / g.wr;
      layout.zuschnittRahmen = { x: g.px.x * s, y: g.px.y * s, b: g.px.b * s, h: g.px.h * s };
      layout.zuschnitt = g.zuschnitt;
    }
    return layout;
  }
  function now() { return root.performance && performance.now ? performance.now() : Date.now(); }
  function render(canvas, q, Z, w, opt) {
    if (!q || !q.bild) throw fehler('Es ist noch kein Foto geladen.', 'kein-foto');
    return renderIntern(canvas, q, Z, w, Object.assign({ maxSeite: 1200, seite: 'vorne', vorschau: true }, opt || {}));
  }
  function renderZuschneiden(canvas, q, Z, opt) {
    opt = opt || {};
    var lay = renderIntern(canvas, q, Z, null, { maxSeite: opt.maxSeite || 1200, ohneEbenen: ['alles'], vorschau: true, dpr: opt.dpr });
    var ctx = canvas.getContext('2d'), r = lay.zuschnittRahmen, B = lay.breite, H = lay.hoehe, u = Math.min(B, H) / 1000;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.rect(0, 0, B, H); ctx.rect(r.x, r.y, r.b, r.h); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, 1.5 * u);
    for (var i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(r.x + r.b * i / 3, r.y); ctx.lineTo(r.x + r.b * i / 3, r.y + r.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * i / 3); ctx.lineTo(r.x + r.b, r.y + r.h * i / 3); ctx.stroke();
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, 3 * u); ctx.strokeRect(r.x, r.y, r.b, r.h);
    var e = Math.min(r.b, r.h) * 0.12, d = Math.max(3, 8 * u); ctx.lineWidth = d; ctx.lineCap = 'square';
    [[r.x, r.y, 1, 1], [r.x + r.b, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.b, r.y + r.h, -1, -1]].forEach(function (k) {
      ctx.beginPath(); ctx.moveTo(k[0] + k[2] * d / 2, k[1] + k[3] * (e + d / 2)); ctx.lineTo(k[0] + k[2] * d / 2, k[1] + k[3] * d / 2); ctx.lineTo(k[0] + k[2] * (e + d / 2), k[1] + k[3] * d / 2); ctx.stroke();
    });
    ctx.restore();
    return { bildRechteck: { x: 0, y: 0, b: B, h: H }, rahmen: r, zuschnitt: lay.zuschnitt, breite: B, hoehe: H };
  }

  /* ======================================================================
   * 16. Export, PDF, Teilen, Kopieren
   * ==================================================================== */
  function zuBlob(c, typ, q) {
    return new Promise(function (res, rej) {
      try { c.toBlob(function (b) { b ? res(b) : rej(fehler('Das Bild ist zu groß für dieses Gerät. Bitte eine kleinere Größe wählen.', 'speicher')); }, typ, q); }
      catch (e) { rej(fehler('Das Bild konnte nicht erzeugt werden. Bitte eine kleinere Größe wählen.', 'speicher')); }
    });
  }
  /* PDF mit einer oder mehreren JPEG-Seiten (aus technik-bausteine.js, erweitert). seiteMm = [b,h] oder null */
  function pdfAusJpegs(seiten, seiteMm) {
    var mm = 72 / 25.4, enc = new TextEncoder(), teile = [], offs = [], pos = 0, n = function (v) { return v.toFixed(2); };
    var push = function (d) { var x = typeof d === 'string' ? enc.encode(d) : d; teile.push(x); pos += x.length; };
    var obj = function (nr, kopf, strom) { offs[nr] = pos; push(nr + ' 0 obj\n' + kopf + '\n'); if (strom) { push('stream\n'); push(strom); push('\nendstream\n'); } push('endobj\n'); };
    var anzahl = seiten.length, kids = [];
    for (var i = 0; i < anzahl; i++) kids.push((3 + i * 3) + ' 0 R');
    push('%PDF-1.4\n'); push(new Uint8Array([37, 0xE2, 0xE3, 0xCF, 0xD3, 10]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + anzahl + ' >>');
    seiten.forEach(function (s, i) {
      var pw, ph;
      if (seiteMm) { pw = seiteMm[0] * mm; ph = seiteMm[1] * mm; }
      else { var f = 200 * mm / Math.max(s.b, s.h); pw = s.b * f; ph = s.h * f; }
      var k = Math.min(pw / s.b, ph / s.h), dw = s.b * k, dh = s.h * k, ox = (pw - dw) / 2, oy = (ph - dh) / 2;
      var inhalt = 'q ' + n(dw) + ' 0 0 ' + n(dh) + ' ' + n(ox) + ' ' + n(oy) + ' cm /Im0 Do Q', nr = 3 + i * 3;
      obj(nr, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(pw) + ' ' + n(ph) + '] /Resources << /XObject << /Im0 ' + (nr + 1) + ' 0 R >> >> /Contents ' + (nr + 2) + ' 0 R >>');
      obj(nr + 1, '<< /Type /XObject /Subtype /Image /Width ' + s.b + ' /Height ' + s.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + s.jpeg.length + ' >>', s.jpeg);
      obj(nr + 2, '<< /Length ' + inhalt.length + ' >>', inhalt);
    });
    var gesamt = 2 + anzahl * 3, xref = pos;
    push('xref\n0 ' + (gesamt + 1) + '\n0000000000 65535 f \n');
    for (var j = 1; j <= gesamt; j++) push(String(offs[j]).padStart(10, '0') + ' 00000 n \n');
    push('trailer\n<< /Size ' + (gesamt + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(teile, { type: 'application/pdf' });
  }
  function dateiTeil(s) {
    return String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function dateiname(Z, w, endung, zusatz) {
    var t = zeitTeile(w || {}), ort = Z.daten && Z.daten.ort !== 'aus' ? dateiTeil(ortText(Z, w || {})) : '';
    var teile = ['Wetterfoto'];
    if (ort) teile.push(ort);
    teile.push(t.j + '-' + zwei(t.mo) + '-' + zwei(t.t) + (t.h != null ? '-' + zwei(t.h) + zwei(t.mi) : ''));
    if (zusatz) teile.push(zusatz);
    return teile.join('-') + '.' + endung;
  }
  /* A25: Aufnahmedatum ins fertige JPEG zurückschreiben (Klaus: „Datum behalten“, sonst landet es in Fotos unter „heute“).
     Ein eigenes APP1-Segment mit TIFF-Kopf und nur drei Einträgen: DateTime, ExifVersion, DateTimeOriginal.
     Bewusst nichts sonst: kein GPS, kein Gerät, keine Ausrichtung (das Bild ist schon richtig gedreht). */
  function exifZeitText(d) {   // 'JJJJ-MM-TTTHH:MM[:SS]' (Ortszeit) oder Date → 'JJJJ:MM:TT HH:MM:SS'
    if (d instanceof Date && !isNaN(d.getTime())) return d.getFullYear() + ':' + zwei(d.getMonth() + 1) + ':' + zwei(d.getDate()) + ' ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()) + ':' + zwei(d.getSeconds());
    var m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d))?/.exec(String(d || ''));
    return m ? m[1] + ':' + m[2] + ':' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00') : null;
  }
  function exifSegment(zeit) {
    var b = new Uint8Array(118), v = new DataView(b.buffer), t = 10;   // t = Beginn des TIFF-Teils (nach Marke, Länge, „Exif\0\0“)
    var ascii = function (o, s) { for (var i = 0; i < 19; i++) b[t + o + i] = s.charCodeAt(i); b[t + o + 19] = 0; };
    var eintrag = function (o, tag, typ, anzahl, wert) { v.setUint16(t + o, tag); v.setUint16(t + o + 2, typ); v.setUint32(t + o + 4, anzahl); v.setUint32(t + o + 8, wert); };
    v.setUint16(0, 0xFFE1); v.setUint16(2, b.length - 2);
    b.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
    v.setUint16(t, 0x4D4D); v.setUint16(t + 2, 42); v.setUint32(t + 4, 8);                     // „MM“, große Zahlen zuerst, IFD0 bei 8
    v.setUint16(t + 8, 2); eintrag(10, 0x0132, 2, 20, 38); eintrag(22, 0x8769, 4, 1, 58); v.setUint32(t + 34, 0);
    ascii(38, zeit);                                                                            // DateTime
    v.setUint16(t + 58, 2); eintrag(60, 0x9000, 7, 4, 0); b.set([48, 50, 51, 50], t + 68);     // ExifVersion „0232“ steht im Eintrag selbst
    eintrag(72, 0x9003, 2, 20, 88); v.setUint32(t + 84, 0);
    ascii(88, zeit);                                                                            // DateTimeOriginal
    return b;
  }
  /* Setzt das Segment hinter SOI (bzw. hinter JFIF-APP0); vorhandene Exif-Segmente fliegen raus. Kein gültiges JPEG → unverändert. */
  async function mitExifDatum(blob, datum) {
    if (!exifZeitText(datum) || !blob) return blob;
    return exifEinsetzen(new Uint8Array(await blob.arrayBuffer()), datum) || blob;
  }
  // Kern: JPEG-Bytes → Blob mit Datum, null wenn es kein JPEG ist
  function exifEinsetzen(a, datum) {
    if (!a) return null;   // toDataURL ging nicht (z. B. Bild zu groß für das Gerät): der Aufrufer nimmt den Umweg über toBlob
    var zeit = exifZeitText(datum), v = new DataView(a.buffer, a.byteOffset, a.byteLength);
    if (!zeit || a.length < 4 || v.getUint16(0) !== 0xFFD8) return null;
    var teile = [a.subarray(0, 2)], p = 2, eingesetzt = false, seg = exifSegment(zeit);
    while (p + 4 <= a.length) {
      var m = v.getUint16(p);
      if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA || m === 0xFFD9) break;
      var ende = p + 2 + v.getUint16(p + 2);
      if (ende > a.length) return null;
      var istExif = m === 0xFFE1 && v.getUint32(p + 4) === 0x45786966;
      if (!eingesetzt && m !== 0xFFE0) { teile.push(seg); eingesetzt = true; }
      if (!istExif) teile.push(a.subarray(p, ende));
      p = ende;
    }
    if (!eingesetzt) teile.push(seg);
    teile.push(a.subarray(p));
    var erg = new Blob(teile, { type: 'image/jpeg' }); erg.exifDatum = zeit;
    return erg;
  }
  function jpegBytes(c, q) {   // JPEG als Bytes (null, wenn der Browser es nicht kann oder das Bild zu groß ist)
    try {
      var u = c.toDataURL('image/jpeg', q), i = u.indexOf(',');
      if (u.slice(0, i).indexOf('image/jpeg') < 0) return null;
      var bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
      return a;
    } catch (e) { return null; }
  }
  function aufWeiss(c) {   // JPEG kennt keine Transparenz: auf Weiß legen (sonst schwarz)
    var w = leinwand(c.width, c.height), x = w.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w.width, w.height); x.drawImage(c, 0, 0);
    return w;
  }
  async function exportiere(q, Z, w, opt) {
    if (!q || !q.bild) throw fehler('Es ist noch kein Foto geladen.', 'kein-foto');
    opt = opt || {}; Z = neuerZustand(Z); w = w || {};
    var aus = Z.ausgabe || {}, format = String(opt.format || aus.format || 'jpeg').toLowerCase().replace('jpg', 'jpeg');
    var groesse = opt.groesse != null ? opt.groesse : (aus.groesse || 2160), qual = klemme(zahl(opt.qualitaet != null ? opt.qualitaet : aus.qualitaet, 0.9), 0.3, 1);
    var postkarte = !!(Z.postkarte && Z.postkarte.an), beide = opt.beideSeiten != null ? !!opt.beideSeiten : postkarte && Z.postkarte.rueckseite != null;
    beide = beide && postkarte;
    await symboleLaden(); await alleBildSticker(Z);
    var t0 = now(), hinweis = '', vorne = document.createElement('canvas'), hinten = null;
    // Dateiname mit Aufnahmedatum und -uhrzeit aus dem Foto (Nutzertest 19.10.: sonst landet es in Fotos unter „heute“); ohne EXIF die Wetterzeit
    var wName = q.exif && q.exif.datum ? Object.assign({}, w, { zeit: q.exif.datum }) : w;
    renderIntern(vorne, q, Z, w, { maxSeite: groesse, vorschau: false });
    if (beide) { hinten = document.createElement('canvas'); renderIntern(hinten, q, Z, w, { maxSeite: groesse, seite: 'hinten', vorschau: false }); }
    var ergebnis;
    try {
      if (format === 'pdf') {
        var seiten = [];
        for (var c of [vorne, hinten].filter(Boolean)) {
          var weiss = aufWeiss(c), jb = await zuBlob(weiss, 'image/jpeg', qual); freiCanvas(weiss);
          seiten.push({ jpeg: new Uint8Array(await jb.arrayBuffer()), b: c.width, h: c.height });
        }
        var a6 = postkarte || Z.format === 'postkarte' ? (vorne.width >= vorne.height ? [148, 105] : [105, 148]) : null;
        var pdf = pdfAusJpegs(seiten, a6);
        ergebnis = { blob: pdf, mime: 'application/pdf', dateiname: dateiname(Z, wName, 'pdf', postkarte ? 'Postkarte' : ''), hinweis: '', seiten: seiten.length };
      } else {
        var wunsch = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : format === 'avif' ? 'image/avif' : 'image/jpeg';
        var bilder = [];
        for (var c2 of [vorne, hinten].filter(Boolean)) {
          var quelleC = wunsch === 'image/png' ? c2 : aufWeiss(c2), datum = (q.exif && q.exif.datum) || new Date();
          // A25: JPEG bekommt das Aufnahmedatum des Originals (ohne EXIF-Datum: jetzt, die Bearbeitungszeit) – nur das Datum, nie GPS.
          // Die Bytes kommen aus toDataURL statt aus einem Blob: einen Blob lesen, während die Seite wechselt, meldet WebKit als Seitenfehler.
          var b = wunsch === 'image/jpeg' ? exifEinsetzen(jpegBytes(quelleC, qual), datum) : null;
          if (!b) b = await zuBlob(quelleC, wunsch, qual);
          if (b.type !== wunsch) {   // Browser kann das Format nicht → JPEG
            var name = wunsch === 'image/webp' ? 'WebP' : wunsch === 'image/avif' ? 'AVIF' : wunsch;
            hinweis = name + ' kann dieser Browser nicht erzeugen. Das Bild wurde stattdessen als JPEG gespeichert.';
            if (quelleC === c2) quelleC = aufWeiss(c2);
            b = exifEinsetzen(jpegBytes(quelleC, qual), datum) || await zuBlob(quelleC, 'image/jpeg', qual);
          }
          if (quelleC !== c2) freiCanvas(quelleC);
          if (b.type === 'image/jpeg' && !b.exifDatum) { try { b = await mitExifDatum(b, datum); } catch (e) { /* ohne Datum weiter */ } }   // seltener Weg: toDataURL ging nicht
          bilder.push(b);
        }
        var mime = bilder[0].type, end = { 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[mime] || 'jpg';
        ergebnis = { blob: bilder[0], mime: mime, dateiname: dateiname(Z, wName, end, postkarte && beide ? 'Vorderseite' : ''), hinweis: hinweis };
        if (bilder[1]) ergebnis.rueckseite = { blob: bilder[1], mime: bilder[1].type, dateiname: dateiname(Z, wName, end, 'Rueckseite') };
      }
      ergebnis.breite = vorne.width; ergebnis.hoehe = vorne.height; ergebnis.dauerMs = Math.round(now() - t0);
      ergebnis.altText = altText(Z, w);
      return ergebnis;
    } finally { freiCanvas(vorne); freiCanvas(hinten); }
  }
  function alsDateien(erg) {
    var l = [new File([erg.blob], erg.dateiname, { type: erg.mime })];
    if (erg.rueckseite) l.push(new File([erg.rueckseite.blob], erg.rueckseite.dateiname, { type: erg.rueckseite.mime }));
    return l;
  }
  function herunterladen(datei) {
    var url = URL.createObjectURL(datei), a = document.createElement('a');
    a.href = url; a.download = datei.name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  /* MUSS direkt im Klick aufgerufen werden; Blob vorher mit exportiere() erzeugen. Nur Dateien teilen (kein text, iOS-Fehler). */
  async function teilen(erg, opt) {
    if (!erg || !erg.blob) return 'nicht-moeglich';
    opt = opt || {};
    var dateien = alsDateien(erg), daten = { files: dateien }, nav = root.navigator || {};
    if (opt.titel) daten.title = opt.titel;
    try {
      if (nav.share && nav.canShare && nav.canShare(daten)) { await nav.share(daten); return 'geteilt'; }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'abgebrochen';
      // NotAllowedError (Fenster gesperrt / Tipp zu lange her) → sichern statt still scheitern
    }
    try { dateien.forEach(function (d, i) { setTimeout(function () { herunterladen(d); }, i * 400); }); return 'gesichert'; }
    catch (e) { return 'nicht-moeglich'; }
  }
  async function kopieren(erg) {
    var nav = root.navigator || {};
    if (!erg || !erg.blob || !nav.clipboard || !nav.clipboard.write || !root.ClipboardItem) return false;
    var png = erg.mime === 'image/png' ? Promise.resolve(erg.blob) : (async function () {
      var bmp = await createImageBitmap(erg.blob), c = leinwand(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      var b = await zuBlob(c, 'image/png'); freiCanvas(c); return b;
    })();
    try { await nav.clipboard.write([new ClipboardItem({ 'image/png': png })]); return true; }
    catch (e) { return false; }
  }

  /* ======================================================================
   * 17. Auto-Verbessern (Histogramm) und Wetter zum Aufnahmezeitpunkt
   * ==================================================================== */
  function autoVerbessern(q) {
    var kurz = 160, f = kurz / Math.max(q.breite, q.hoehe), b = Math.max(1, Math.round(q.breite * f)), h = Math.max(1, Math.round(q.hoehe * f));
    var c = leinwand(b, h), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(q.bild, 0, 0, b, h);
    var d = x.getImageData(0, 0, b, h).data; freiCanvas(c);
    var hist = new Uint32Array(256), n = 0, ng = 0, sr = 0, sb = 0, sg = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      var l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); hist[l]++; n++;
      // Farbstich nur an fast grauen Stellen messen (blauer Himmel ist kein Farbstich)
      var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx - mn < 48 && l > 30 && l < 235) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; ng++; }
    }
    if (!n) return { anpassung: { licht: 0, kontrast: 0, waerme: 0 } };
    function perz(p) { var z = 0, ziel = n * p; for (var k = 0; k < 256; k++) { z += hist[k]; if (z >= ziel) return k / 255; } return 1; }
    var p02 = perz(0.02), p50 = perz(0.5), p98 = perz(0.98), spanne = p98 - p02;
    // Licht: Mitte Richtung 0,46 ziehen (Gammakurve zurückrechnen), moderat begrenzt
    var licht = 0;
    if (p50 > 0.02 && p50 < 0.98) { var gamma = Math.log(0.46) / Math.log(p50); licht = -100 * Math.log(gamma) / Math.LN2; }
    licht = Math.round(klemme(licht * (licht < 0 ? 0.45 : 0.65), -25, 35));   // abdunkeln vorsichtiger (Himmel, Schnee)
    var kontrastW = Math.round(klemme((0.82 - spanne) * 90, -15, 30));
    var stich = ng > n * 0.05 ? (sb - sr) / ng / 255 : 0;   // bläulicher Stich → wärmer, gelblicher → kühler
    var waerme = Math.round(klemme(stich * 160, -20, 25));
    if (Math.abs(licht) < 3) licht = 0; if (Math.abs(kontrastW) < 3) kontrastW = 0; if (Math.abs(waerme) < 3) waerme = 0;
    return { anpassung: { licht: licht, kontrast: kontrastW, waerme: waerme } };
  }
  async function wetterZumZeitpunkt(datum, lat, lon) {
    try {
      if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null;
      var s = datum instanceof Date ? datum.getFullYear() + '-' + zwei(datum.getMonth() + 1) + '-' + zwei(datum.getDate()) + 'T' + zwei(datum.getHours()) + ':' + zwei(datum.getMinutes()) : String(datum || '');
      var m = /^(\d{4}-\d\d-\d\d)(?:[T ](\d\d):(\d\d))?/.exec(s); if (!m) return null;
      var tag = m[1], stunde = m[2] != null ? +m[2] : 12, minute = m[3] != null ? +m[3] : 0;
      var alter = (Date.now() - new Date(tag + 'T12:00:00').getTime()) / 864e5;
      if (alter < -16) return null;
      var basis = alter > 80 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
      var url = basis + '?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) + '&start_date=' + tag + '&end_date=' + tag +
        '&hourly=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,relative_humidity_2m,surface_pressure,uv_index' +
        '&daily=sunrise,sunset&timezone=auto';
      var ab = root.AbortController ? new AbortController() : null, timer = ab && setTimeout(function () { ab.abort(); }, 8000);
      var r = await fetch(url, ab ? { signal: ab.signal } : undefined); if (timer) clearTimeout(timer);
      if (!r.ok) return null;
      var j = await r.json(), hh = j.hourly; if (!hh || !hh.time) return null;
      var idx = Math.min(hh.time.length - 1, Math.round(stunde + minute / 60));
      var wert = function (k) { var a = hh[k]; return a && a[idx] != null ? a[idx] : null; };
      var code = wert('weather_code'), uhr = function (t) { return t ? String(t).slice(11, 16) : null; };
      var w = { temp: wert('temperature_2m'), gefuehlt: wert('apparent_temperature'), code: code,
        ort: { lat: lat, lon: lon }, zeit: tag + 'T' + zwei(stunde) + ':' + zwei(minute) + ':00',
        wind: wert('wind_speed_10m'), windRichtung: wert('wind_direction_10m') != null ? gradZuRichtung(wert('wind_direction_10m')) : null,
        boeen: wert('wind_gusts_10m'), regen: wert('precipitation'), regenRisiko: wert('precipitation_probability'),
        feuchte: wert('relative_humidity_2m'), uv: wert('uv_index'), druck: wert('surface_pressure'),
        sonnenaufgang: j.daily && uhr(j.daily.sunrise && j.daily.sunrise[0]), sonnenuntergang: j.daily && uhr(j.daily.sunset && j.daily.sunset[0]),
        modell: 'Open-Meteo', quelle: 'Open-Meteo', zeitzone: j.timezone || null };
      w.lage = root.KSSymbole && code != null ? root.KSSymbole.textFuerCode(code, istNacht(w)) : '';
      return w;
    } catch (e) { return null; }   // im iframe gesperrt / offline → still null
  }

  /* ======================================================================
   * 17b. Galerie „Meine Wetterfotos“ (IndexedDB, Rückfall Arbeitsspeicher)
   * Zwei Arten: 'original' (das Foto, wie es kam) und 'bearbeitet' (fertiges Bild). Grenzen je Art; die ältesten
   * fliegen raus, Grenze 0 = gar nicht speichern. Liste liefert nur Kopfdaten, lade() den Blob dazu.
   * Alles bleibt auf dem Gerät. Fehlt IndexedDB oder ist es gesperrt, bleibt die Galerie im Arbeitsspeicher.
   * ==================================================================== */
  var GAL = { db: null, offen: null, modus: 'indexeddb', mem: [], zaehler: 0, letzteZeit: 0, name: 'ks-galerie' };
  // Eigener Speichername je App (z. B. 'wpcamera' → 'wpcamera-ks-galerie'), damit Apps unter derselben Adresse sich keine Galerie teilen
  function galSpeicherName(praefix) {
    var name = praefix ? praefix + '-ks-galerie' : 'ks-galerie';
    if (name === GAL.name) return;
    if (GAL.db) { try { GAL.db.close(); } catch (e) { } }
    GAL.name = name; GAL.db = null; GAL.offen = null; GAL.mem = [];
  }
  function galOeffnen() {
    if (GAL.offen) return GAL.offen;
    var name = GAL.name;
    GAL.offen = new Promise(function (res) {
      var fertig = false, timer = null;
      function ende(db) {
        if (fertig) return; fertig = true; clearTimeout(timer);
        // Name inzwischen gewechselt: altes Ergebnis verwerfen, mit dem neuen Namen öffnen
        if (name !== GAL.name) { if (db) { try { db.close(); } catch (e) { } } return res(galOeffnen()); }
        GAL.db = db; GAL.modus = db ? 'indexeddb' : 'speicher'; res(db);
      }
      timer = setTimeout(function () { ende(null); }, 2500);
      try {
        if (!root.indexedDB) return ende(null);
        var rq = root.indexedDB.open(name, 1);
        rq.onupgradeneeded = function () { var st = rq.result.createObjectStore('fotos', { keyPath: 'id' }); st.createIndex('art', 'art', { unique: false }); };
        rq.onsuccess = function () { ende(rq.result); };
        rq.onerror = rq.onblocked = function () { ende(null); };
      } catch (e) { ende(null); }
    });
    return GAL.offen;
  }
  function galAnfrage(db, modus, fn) {   // fn(store) → IDBRequest; Ergebnis erst nach Abschluss der Transaktion
    return new Promise(function (res, rej) {
      try {
        var tx = db.transaction('fotos', modus), r = fn(tx.objectStore('fotos'));
        tx.oncomplete = function () { res(r ? r.result : undefined); };
        tx.onerror = tx.onabort = function () { rej(tx.error || new Error('IndexedDB')); };
      } catch (e) { rej(e); }
    });
  }
  // A25: Speicher voll ist kein Grund, in den Arbeitsspeicher zu wechseln – der Aufrufer sagt es dem Nutzer
  function istVoll(e) { return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(String(e.message || ''))); }
  async function galTun(idb, mem) {   // IndexedDB-Fehler mitten im Betrieb → ab jetzt Arbeitsspeicher
    var db = await galOeffnen();
    if (db && GAL.modus === 'indexeddb') {
      try { return await idb(db); }
      catch (e) { if (istVoll(e)) throw fehler('Der Speicher auf diesem Gerät ist voll.', 'speicher-voll'); GAL.modus = 'speicher'; }
    }
    return mem();
  }
  /* Gespeichert wird der Inhalt als ArrayBuffer (Safari verliert Blobs in IndexedDB gelegentlich), geladen kommt wieder ein Blob */
  // Kopfdaten ohne Inhalt; A25: der Entwurf (Bearbeitungsstand + Original) bleibt draußen, die Liste sagt nur hatEntwurf
  var GAL_INHALT = ['blob', 'buf', 'entwurf', 'entwurfBuf', 'entwurfBlob', 'entwurfTyp', 'hatEntwurf'];
  function galKopf(e) { var o = {}; Object.keys(e).forEach(function (k) { if (GAL_INHALT.indexOf(k) < 0) o[k] = e[k]; }); o.hatEntwurf = !!(e.entwurf && (e.entwurfBuf || e.entwurfBlob)); return o; }
  function galAlle() { return galTun(function (db) { return galAnfrage(db, 'readonly', function (st) { return st.getAll(); }); }, function () { return GAL.mem.slice(); }); }
  async function galListe(art) {
    var l = (await galAlle()).filter(function (e) { return !art || e.art === art; });
    l.sort(function (a, b) { return b.zeit - a.zeit; });
    return l.map(galKopf);
  }
  async function galLade(id) {
    var e = await galTun(function (db) { return galAnfrage(db, 'readonly', function (st) { return st.get(id); }); }, function () { return GAL.mem.filter(function (x) { return x.id === id; })[0]; });
    if (!e) return null;
    var r = galKopf(e); r.blob = new Blob([e.buf], { type: e.typ || 'image/jpeg' });
    if (r.hatEntwurf) { r.entwurf = kopie(e.entwurf); r.entwurfBlob = new Blob([e.entwurfBuf], { type: e.entwurfTyp || 'image/jpeg' }); }
    return r;
  }
  async function galPut(rec) {
    var ein = galKopf(rec); ein.typ = rec.typ || (rec.blob && rec.blob.type) || 'image/jpeg';
    ein.buf = rec.buf || await rec.blob.arrayBuffer();
    if (rec.entwurf && (rec.entwurfBuf || rec.entwurfBlob)) {   // A25: Entwurf liegt im selben Eintrag, fliegt also mit ihm raus
      ein.entwurf = kopie(rec.entwurf); ein.entwurfBuf = rec.entwurfBuf || await rec.entwurfBlob.arrayBuffer();
      ein.entwurfTyp = rec.entwurfTyp || (rec.entwurfBlob && rec.entwurfBlob.type) || 'image/jpeg';
    }
    await galTun(function (db) { return galAnfrage(db, 'readwrite', function (st) { return st.put(ein); }); },
      function () { GAL.mem = GAL.mem.filter(function (e) { return e.id !== ein.id; }); GAL.mem.push(ein); });
    return galKopf(ein);
  }
  async function galLoesche(id) {
    if (!(await galLade(id))) return false;
    await galTun(function (db) { return galAnfrage(db, 'readwrite', function (st) { return st.delete(id); }); },
      function () { GAL.mem = GAL.mem.filter(function (e) { return e.id !== id; }); });
    return true;
  }
  /* Löscht die ältesten über der Grenze; gibt die Zahl der entfernten Fotos zurück */
  async function galBegrenze(grenzen) {
    var weg = 0, alle = await galListe();
    for (var art of ['original', 'bearbeitet']) {
      var g = grenzen && grenzen[art] != null ? Math.max(0, Math.floor(zahl(grenzen[art], 0))) : null;
      if (g == null) continue;
      var l = alle.filter(function (e) { return e.art === art; });   // neueste zuerst
      for (var e of l.slice(g)) if (await galLoesche(e.id)) weg++;
    }
    return weg;
  }
  async function galSpeichere(e, grenzen) {
    e = e || {};
    var art = e.art === 'bearbeitet' ? 'bearbeitet' : 'original';
    var g = grenzen && grenzen[art] != null ? zahl(grenzen[art], 0) : Infinity;
    if (g <= 0 || !e.blob) return null;
    var t = Date.now(); if (t <= GAL.letzteZeit) t = GAL.letzteZeit + 1; GAL.letzteZeit = t;
    var rec = { id: t.toString(36) + '-' + (++GAL.zaehler), art: art, zeit: t, name: e.name || 'Foto', breite: e.breite || 0, hoehe: e.hoehe || 0,
      thumb: e.thumb || '', groesse: e.blob.size || 0, blob: e.blob };
    if (art === 'bearbeitet' && e.entwurf && e.entwurfBlob) { rec.entwurf = e.entwurf; rec.entwurfBlob = e.entwurfBlob; rec.entwurfGroesse = e.entwurfBlob.size || 0; }
    var kopf = await galPut(rec);
    if (grenzen) await galBegrenze(grenzen);
    return kopf;
  }
  async function galLeere() {
    await galTun(function (db) { return galAnfrage(db, 'readwrite', function (st) { return st.clear(); }); }, function () { GAL.mem = []; });
  }
  function galThumb(bild, max) {   // kleines JPEG als Data-URL für den Streifen
    var w = bild.width || bild.videoWidth || 1, h = bild.height || bild.videoHeight || 1, f = Math.min(1, (max || 160) / Math.max(w, h));
    var c = leinwand(w * f, h * f), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(bild, 0, 0, c.width, c.height);
    var u = c.toDataURL('image/jpeg', 0.75); freiCanvas(c); return u;
  }
  var galerie = {
    modus: async function () { await galOeffnen(); return GAL.modus; },
    speicherName: galSpeicherName,
    liste: galListe, lade: galLade, speichere: galSpeichere, loesche: galLoesche, begrenze: galBegrenze,
    setzeZurueck: function (rec) { return galPut(rec); }, leere: galLeere, thumb: galThumb
  };

  /* ======================================================================
   * 18. Öffentliche Schnittstelle
   * ==================================================================== */
  synchronPruefen();
  if (typeof document !== 'undefined') { pruefen(); symboleLaden(); }

  root.KSEngine = {
    version: '1.0.0',
    faehigkeiten: faehigkeiten, pruefen: pruefen,
    ladeDatei: ladeDatei, ladeUrl: ladeUrl, freigeben: freigeben, quelleAus: quelleAus,
    neuerZustand: neuerZustand, masse: masse,
    render: render, renderZuschneiden: renderZuschneiden, zuschnittBegrenzen: zuschnittBegrenzen,
    exportiere: exportiere, teilen: teilen, kopieren: kopieren,
    altText: altText, datenZeilen: datenZeilen, wetterZumZeitpunkt: wetterZumZeitpunkt,
    autoVerbessern: autoVerbessern, liveKamera: liveKamera, galerie: galerie,
    FILTER: FILTER, EFFEKTE: EFFEKTE, FORMATE: FORMATE, STILE: STILE, DATEN_FELDER: DATEN_FELDER, EMOJI_SAETZE: EMOJI_SAETZE,
    ORT_STUFEN: ORT_STUFEN, RAHMEN: RAHMEN, POSITIONEN: POSITIONEN, SCHRIFTEN: SCHRIFTEN, WETTER_STICKER: WETTER_STICKER,
    DEMO_WETTER: DEMO_WETTER, symbolSvg: symbolSvg,
    // Zusätze (nur ergänzend): Hilfen für Oberfläche und Tests
    bereit: function () { return Promise.all([symboleLaden(), pruefen()]).then(function () { return true; }); },
    ortText: function (Z, w) { return ortText(Z, w || {}); },
    dateiname: function (Z, w, endung) { return dateiname(neuerZustand(Z), w || {}, endung || 'jpg'); },
    exifLesen: exifLesen, herunterladen: herunterladen, mitExifDatum: mitExifDatum, ohneGps: ohneGps,
    stickerAusBild: stickerAusBild, bildStickerLaden: bildStickerLaden,
    letzteZeit: function () { return Object.assign({}, LETZTE_ZEIT); },
    _intern: { geometrie: geometrie, farbParameter: farbParameter, baueLUT: baueLUT, pdfAusJpegs: pdfAusJpegs }
  };
})(typeof window !== 'undefined' ? window : globalThis);
