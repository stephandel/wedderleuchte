/* ks-studio.js – Kamera-Studio, Oberflächen (Paket U) → window.KSStudio
 * Sieben austauschbare Oberflächen (Varianten) über einer gemeinsamen Technik (window.KSEngine).
 * mount(element, {variante, funktionen, optionen, wetter, beispielFoto, theme, speicher, onEreignis, start})
 * start (aus dem Design-Konfigurator, 21.10.2026): Teil eines Zustands als Startwerte (format, overlay, daten, rahmen, ausgabe);
 *   setze({start}) ändert nur die geänderten Werte.
 * Jede Funktion lässt sich einzeln abschalten (funktionen[name] === false → Bedienelement fehlt ganz).
 * Symbole: eigene Inline-SVG im Stil von Lucide (ISC-Lizenz), immer mit Beschriftung. */
(function () {
  'use strict';

  const E = () => window.KSEngine || null;
  const VARIANTEN = ['bisher', 'schnell', 'assistent', 'werkzeug', 'buehne', 'postkarte', 'sucher'];

  /* ---------- Symbole (24er-Raster, Strich 2, runde Enden) ---------- */
  const ICON = {
    kamera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    bild: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    zuschneiden: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    regler: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    filter: '<circle cx="9" cy="9" r="6.5"/><circle cx="15" cy="15" r="6.5"/>',
    wetter: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41"/><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    format: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h3M7 9v3M17 15h-3M17 15v-3"/>',
    teilen: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4M12 2v13"/>',
    sichern: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    kopieren: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    rueck: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    vor: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    links: '<path d="m15 18-6-6 6-6"/>',
    rechts: '<path d="m9 18 6-6-6-6"/>',
    drehenL: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    drehenR: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    spiegeln: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v2M12 8v2M12 14v2M12 20v2"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    pfeilO: '<path d="m5 12 7-7 7 7M12 19V5"/>',
    pfeilU: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    pfeilL: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    pfeilR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    loeschen: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    haken: '<path d="M20 6 9 17l-5-5"/>',
    sticker: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    zauber: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
    auge: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    wenden: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    einfuegen: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    video: '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    merken: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    stift: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    post: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    neu: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    kamerawechsel: '<path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/>',
    licht: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    raster: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    waage: '<path d="M2 12h5M17 12h5"/><rect x="8" y="9" width="8" height="6" rx="3"/>',
    ton: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    zahnrad: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    graph: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    radar: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    mehr: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    orte: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    suche: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    galerie: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18"/><circle cx="12" cy="8" r="2"/><rect x="6" y="2" width="16" height="16" rx="2"/>'
  };
  const ic = n => `<svg class="ks-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[n] || ''}</svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tief = o => JSON.parse(JSON.stringify(o));
  const klemme = (v, a, b) => Math.min(b, Math.max(a, v));
  const istObj = o => o && typeof o === 'object' && !Array.isArray(o);
  function mische(ziel, teil) {
    Object.keys(teil || {}).forEach(k => {
      if (istObj(teil[k]) && istObj(ziel[k])) mische(ziel[k], teil[k]);
      else ziel[k] = tief(teil[k]);
    });
    return ziel;
  }
  let zaehler = 0;
  const neueId = p => p + '-' + Date.now().toString(36) + '-' + (++zaehler);

  /* ---------- Listen (aus der Engine, sonst eigene Rückfall-Werte) ---------- */
  const STD = {
    FILTER: [['keiner', 'Original'], ['natur', 'Natur'], ['warm', 'Warm'], ['kuehl', 'Kühl'], ['analog', 'Analog'], ['klar', 'Klar'], ['drama', 'Drama'], ['sw', 'Schwarz-Weiß'], ['sw-kontrast', 'S/W stark'], ['sepia', 'Sepia'], ['abend', 'Abendlicht']],
    EFFEKTE: [['keiner', 'Kein Effekt'], ['regen', 'Regen'], ['schnee', 'Schnee'], ['sonnenstrahl', 'Sonnenstrahl'], ['nebel', 'Nebel'], ['lichtleck', 'Lichtschein']],
    FORMATE: [['original', 'Original'], ['1:1', 'Quadrat'], ['4:5', '4:5'], ['3:4', '3:4'], ['2:3', '2:3'], ['9:16', 'Story'], ['postkarte', 'Postkarte'], ['frei', 'Frei']],
    STILE: [['glas', 'Glas'], ['band', 'Band'], ['chips', 'Kärtchen'], ['stempel', 'Stempel'], ['gross', 'Groß'], ['minimal', 'Schlicht']],
    WETTER_STICKER: [['temperatur', 'Temperatur'], ['symbol', 'Wettersymbol'], ['ort', 'Ort'], ['lage', 'Wetterlage']],
    RAHMEN: [['keiner', 'Ohne'], ['weiss', 'Weiß'], ['polaroid', 'Sofortbild'], ['postkarte', 'Postkarte']],
    DATEN_FELDER: [['temperatur', 'Temperatur'], ['symbol', 'Symbol'], ['lage', 'Wetterlage'], ['ort', 'Ort'], ['datum', 'Datum'], ['uhrzeit', 'Uhrzeit'], ['wind', 'Wind'], ['regen', 'Regen'], ['feuchte', 'Feuchte'], ['uv', 'UV'], ['sonne', 'Sonne'], ['druck', 'Luftdruck'], ['logo', 'App-Name']],
    EMOJI_SAETZE: [['Wetter', ['☀️', '🌤️', '⛅', '☁️', '🌦️', '🌧️', '⛈️', '❄️', '🌈', '🌬️', '🌫️', '☔']], ['Gefühle', ['😊', '😍', '🥰', '😎', '🤩', '😂', '🥶', '🥵', '❤️', '👍', '🙌', '😴']],
      ['Natur', ['🌻', '🌳', '🍂', '🌊', '⛰️', '🌸', '🍀', '🐝']], ['Reise', ['✈️', '🚆', '🚲', '🏖️', '🏔️', '🗺️', '📍', '🏰']], ['Essen', ['☕', '🍦', '🍰', '🍷', '🍺', '🥨', '🍝', '🍓']]]
  };
  /* ---------- Paket I-B: Einstellungen aus der Konfigurator-Seite (opts.optionen), Standardwerte laut PLAN-PAKET-I.md ---------- */
  const OPT_STD = { zugangOrt: 'tab', zugangPlatz: '3', zugangAussehen: 'rund', zugangAktion: 'kamera', ausloeserOrt: 'mitte', galerieOriginale: 3, galerieBearbeitet: 5,
    vorschauStart: 'app', nutzerDarf: { zugang: [], ausloeser: [], galerie: [], sucher: [] } };
  const AUSLOESER_ORTE = [['mitte', 'Mitte'], ['rechts', 'Rechts'], ['links', 'Links'], ['frei', 'Frei']];
  const MENGEN_ORIG = [0, 1, 3, 5, 10], MENGEN_BEARB = [0, 3, 5, 10, 20];
  const SUCHER_SCHALTER = [['sucherKameraWechsel', 'Kamera wechseln'], ['sucherZoom', 'Zoom'], ['sucherLicht', 'Licht'], ['sucherTimer', 'Timer'], ['sucherRaster', 'Raster'],
    ['sucherWaage', 'Waage'], ['sucherFormat', 'Format'], ['sucherSpiegeln', 'Selfie spiegeln'], ['sucherTon', 'Auslöseton']];
  const SUCHER_FORMATE = [['3:4', '4:3'], ['1:1', '1:1'], ['9:16', '16:9']];   // [Format im Entwurf, Anzeige im Sucher]; im Hochformat steht 4:3 aufrecht
  const SUCHER_ZOOM = [['0.5', '0,5×'], ['1', '1×'], ['2', '2×']];
  const NUTZER_PRAEFIX = 'ks-nutzer-';
  const NUTZER_GRUPPE = { ausloeserOrt: 'ausloeser', galerieOriginale: 'galerie', galerieBearbeitet: 'galerie', zugangOrt: 'zugang', zugangPlatz: 'zugang', zugangAussehen: 'zugang' };
  // Paket I-C: Zugangsknopf auf der App-Startseite (Namen wie in der Konfigurator-Seite)
  const ZUGANG_ORTE = [['tab', 'Tab-Leiste'], ['kopf', 'Kopfzeile'], ['schwebend', 'Schwebend'], ['mehr', 'Im Tab „Mehr“'], ['kachel', 'Kachel']];
  const ZUGANG_PLATZ_STD = { tab: '3', kopf: 'rechts-aussen', schwebend: 'ur', mehr: 'oben', kachel: 'oben' };
  const ZUGANG_PLAETZE = {
    tab: [['1', 'Platz 1'], ['2', 'Platz 2'], ['3', 'Platz 3'], ['4', 'Platz 4'], ['5', 'Platz 5']],
    kopf: [['links-aussen', 'Links außen'], ['links-innen', 'Links innen'], ['rechts-innen', 'Rechts innen'], ['rechts-aussen', 'Rechts außen']],
    schwebend: [['ol', 'Oben links'], ['or', 'Oben rechts'], ['ul', 'Unten links'], ['ur', 'Unten rechts']],
    kachel: [['oben', 'Ganz oben'], ['mitte', 'Unter „Aktuell“'], ['unten', 'Ganz unten']],
    mehr: [['oben', 'Erste Zeile']]
  };
  const ZUGANG_AUSSEHEN = [['rund', 'Rund'], ['symbol', 'Nur Symbol'], ['symbolText', 'Symbol und Text'], ['pille', 'Text-Knopf']];
  const ZUGANG_NICHT = { tab: ['pille'], mehr: ['rund', 'symbol'], kachel: ['symbol'] };   // passt an diesem Ort nicht
  const ZUGANG_AKTIONEN = { kamera: 'Foto aufnehmen', auswahl: 'Foto wählen', sucher: 'Sucher öffnen', studio: 'Studio öffnen' };
  // Tabs der WetterPro-App (ohne den Kamera-Platz): Kennung, Name, Symbol
  const START_TABS = [['wetter', 'Wetter', 'wetter'], ['graphs', 'Graphs', 'graph'], ['radsat', 'Rad/Sat', 'radar'], ['mehr', 'Mehr', 'mehr']];
  const LANG_MS = 500;
  const GAL_HINWEIS = 'Nur auf diesem Gerät gespeichert. Mit Teilen oder Sichern behalten.';
  // Filter-Anmutung im Sucher: CSS-Näherung der Engine-Filter (das fertige Foto rechnet die Engine genau)
  const FILTER_CSS = { natur: 'saturate(1.12) contrast(1.04)', warm: 'sepia(.25) saturate(1.15)', kuehl: 'hue-rotate(10deg) saturate(.95) brightness(1.02)', analog: 'sepia(.25) contrast(.95) saturate(.9)',
    klar: 'contrast(1.12) saturate(1.1)', drama: 'contrast(1.3) saturate(.9) brightness(.92)', sw: 'grayscale(1)', 'sw-kontrast': 'grayscale(1) contrast(1.35)', sepia: 'sepia(.9)', abend: 'sepia(.35) saturate(1.3) hue-rotate(-10deg)' };
  const EFFEKT_WETTER = ['regen', 'schnee', 'sonnenstrahl'];
  const AUTO_WERTE = ['licht', 'kontrast', 'waerme'];   // was autoVerbessern() verändert
  // A23: drei kleine Bilder für „Motiv aus Fotos“ (Handy mit Motiv und Finger · Kopieren · Motiv auf dem Foto)
  const MOTIV_BILD = {
    druecken: '<rect x="11" y="3" width="18" height="34" rx="4"/><path d="M16 22c0-3 2-6 4-6s4 3 4 6v3h-8z"/><circle cx="20" cy="13" r="2.5"/><circle cx="27" cy="27" r="5" class="ks-motiv-akzent"/>',
    kopieren: '<rect x="13" y="13" width="18" height="20" rx="3"/><path d="M9 27V10a3 3 0 0 1 3-3h13"/><path d="M18 21h8M18 26h5" class="ks-motiv-akzent"/>',
    einfuegen: '<rect x="4" y="8" width="32" height="24" rx="3"/><path d="M4 27l9-8 7 6 5-4 11 8"/><path d="M24 13c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5v2h-6z" class="ks-motiv-akzent"/>'
  };
  const FORMAT_V = { '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '2:3': 2 / 3, '9:16': 9 / 16, postkarte: 148 / 105 };
  const SCHRIFTEN = [['system', 'System', '-apple-system, system-ui, sans-serif'], ['hand', 'Hand', 'Noteworthy, "Bradley Hand", cursive'],
    ['serif', 'Serif', '"New York", Georgia, serif'], ['rund', 'Rund', 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif']];
  const FARBEN = [['#FFFFFF', 'Weiß'], ['#000000', 'Schwarz'], ['#FFD60A', 'Gelb'], ['#FF9F0A', 'Orange'], ['#FF453A', 'Rot'], ['#30D158', 'Grün'], ['#0A84FF', 'Blau'], ['#BF5AF2', 'Lila']];
  const ANPASSUNG = [['licht', 'Licht', -100, 100], ['kontrast', 'Kontrast', -100, 100], ['waerme', 'Wärme', -100, 100], ['saettigung', 'Farbstärke', -100, 100], ['vignette', 'Dunkle Ränder', 0, 100], ['koernung', 'Körnung', 0, 100]];
  const POSITIONEN = [['unten', 'Unten'], ['oben', 'Oben'], ['unten-links', 'Unten links'], ['unten-rechts', 'Unten rechts'], ['oben-links', 'Oben links'], ['oben-rechts', 'Oben rechts']];
  const ORT_STUFEN = [['genau', 'Stadtteil'], ['stadt', 'Stadt'], ['region', 'Region'], ['aus', 'Aus']];
  const ENTWURF_VERSION = 1, ENTWURF_MAX = 3072, ENTWURF_DATEI_MAX = 4096;   // A25: Speicherformat der Entwürfe; längste Kante einer verkleinerten Kopie / der Datei selbst (4032-px-Fotos vom iPhone bleiben so pixelgleich)
  const STUFEN = [['einfach', 'Einfach', 'schnell'], ['profi', 'Profi', 'werkzeug']];   // [Stufe, Name, Variante]: Ein-Tipp-Karte und „Wie Apple Fotos“
  const AUSGABE = { jpeg: ['JPEG', 'kleine Datei, für Fotos'], png: ['PNG', 'beste Qualität, größere Datei'], pdf: ['PDF', 'zum Drucken'], webp: ['WebP', 'sehr klein, modern'] };

  function normListe(q) {
    if (!q) return [];
    if (Array.isArray(q)) return q.map(o => {
      if (typeof o === 'string') return { id: o, name: o };
      if (Array.isArray(o)) return { id: o[0], name: o[1] || o[0] };
      const id = o.id != null ? o.id : (o.wert != null ? o.wert : (o.schluessel != null ? o.schluessel : o.key));
      return { id, name: o.name || o.titel || o.label || o.text || String(id), v: o };
    }).filter(o => o.id != null);
    if (typeof q === 'object') return Object.keys(q).map(k => ({ id: k, name: typeof q[k] === 'string' ? q[k] : (q[k].name || q[k].titel || k), v: q[k] }));
    return [];
  }
  function liste(name) {
    const e = E(), n = normListe(e && e[name]);
    return n.length ? n : STD[name].map(([id, nm]) => ({ id, name: nm }));
  }
  function emojiSaetze() {
    const e = E(), q = e && e.EMOJI_SAETZE; let r = [];
    if (Array.isArray(q)) r = q.map(s => Array.isArray(s) ? { name: s[0], emojis: s[1] } : { name: s.name || s.titel || 'Emojis', emojis: s.emojis || s.liste || s.zeichen || s.werte || [] });
    else if (q && typeof q === 'object') r = Object.keys(q).map(k => ({ name: (q[k] && q[k].name) || k, emojis: Array.isArray(q[k]) ? q[k] : (q[k].emojis || []) }));
    r = r.filter(s => Array.isArray(s.emojis) && s.emojis.length);
    return r.length ? r : STD.EMOJI_SAETZE.map(([name, emojis]) => ({ name, emojis }));
  }
  const groesseText = b => b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

  /* ---------- Bausteine für HTML ---------- */
  function knopf(o) {
    const fk = o.fk || (o.akt + ':' + (o.wert == null ? '' : o.wert));
    return `<button type="button" class="ks-knopf ${o.klasse || ''}" data-akt="${o.akt}"${o.wert != null ? ` data-wert="${esc(o.wert)}"` : ''} data-fk="${esc(fk)}"` +
      `${o.label ? ` aria-label="${esc(o.label)}"` : ''}${o.titel ? ` title="${esc(o.titel)}"` : ''}${o.gedrueckt != null ? ` aria-pressed="${!!o.gedrueckt}"` : ''}` +
      `${o.aufgeklappt != null ? ` aria-expanded="${!!o.aufgeklappt}"` : ''}${o.rolle ? ` role="${o.rolle}"` : ''}${o.checked != null ? ` aria-checked="${!!o.checked}"` : ''}${o.aus ? ' disabled' : ''}${o.grau ? ' aria-disabled="true"' : ''}${o.stil ? ` style="${o.stil}"` : ''}>` +
      `${o.icon ? ic(o.icon) : ''}${o.html || ''}${o.text ? `<span class="ks-knopf-text">${esc(o.text)}</span>` : ''}</button>`;
  }
  const chip = (akt, wert, text, an, extra) => knopf(Object.assign({ akt, wert, text, gedrueckt: !!an, klasse: 'ks-chip' + (an ? ' ks-an' : '') }, extra || {}));
  const schalter = (akt, wert, text, an) => `<button type="button" class="ks-schalter-zeile" role="switch" aria-checked="${!!an}" data-akt="${akt}" data-wert="${esc(wert)}" data-fk="${akt}:${esc(wert)}"><span>${esc(text)}</span><span class="ks-schalter" aria-hidden="true"></span></button>`;
  const gruppe = (titel, inhalt, extra) => inhalt ? `<section class="ks-gruppe ${extra || ''}">${titel ? `<h3 class="ks-gruppe-titel">${esc(titel)}</h3>` : ''}${inhalt}</section>` : '';

  /* =====================================================================
     Studio-Instanz
     ===================================================================== */
  function Studio(el, o) {
    this.el = el; this.o = o || {};
    this.variante = VARIANTEN.includes(this.o.variante) ? this.o.variante : 'werkzeug';
    this.F = Object.assign({}, this.o.funktionen || {});
    this.wetter = this.o.wetter || (E() && E().DEMO_WETTER) || {};
    this.theme = this.o.theme || 'auto';
    this.hilfen = this.o.hilfen || {};
    this.appName = this.o.appName || 'WetterPro';
    this.optionen = mische(tief(OPT_STD), this.o.optionen || { vorschauStart: 'studio' });   // ohne Optionen (Einbau in die echte App) kein Startseiten-Nachbau
    this.nutzerMem = {};   // Nutzerwahl, falls localStorage gesperrt ist
    // o.speicher: eigener Speichername der App für Nutzerwahl und Galerie; ohne ihn die alten gemeinsamen Namen
    this.nutzerPraefix = (this.o.speicher ? this.o.speicher + '-' : '') + NUTZER_PRAEFIX;
    this.vorlageSchluessel = (this.o.speicher ? this.o.speicher + '-' : '') + 'ks-vorlage';
    // A25 (Entscheidung Nr. 2): Umschalter „Einfach | Profi“; die Wahl des Nutzers gilt je Gerät und geht beim Start vor
    this.vorgabeVariante = this.variante;
    if (this.stufeDa()) { const g = this.nutzerLies('stufe'); if (STUFEN.some(s => s[0] === g)) this.variante = STUFEN.find(s => s[0] === g)[2]; }
    if (E() && E().galerie && E().galerie.speicherName) E().galerie.speicherName(this.o.speicher || '');
    this.gal = { liste: [], modus: 'indexeddb', geloescht: null, ansicht: null };
    this.quelle = null; this.layout = null; this.zsErg = null;
    this.verlauf = []; this.pos = -1; this.lKey = null; this.lZeit = 0;
    this.zeiger = new Map(); this.ziehen = null;
    this.exportNr = 0; this.thumbs = {}; this.thumbVersion = 0;
    this.ui = { ansicht: 'bearbeiten', geteilt: false, blatt: null, auswahl: null, werkzeug: null, param: 'licht', schritt: 0, seite: 'vorne',
      original: false, fehler: null, laedt: false, senden: { format: null, groesse: 2160, beide: true, erg: null, laeuft: false, key: null, fehler: null },
      emojiSatz: 0, textId: null, vorlage: 'empfohlen', leistenPanel: null, liveFehler: null, wetterQuelle: 'jetzt', wetterAufnahme: null, blattDaten: null,
      beispielModus: false, beispielGrund: '', countdown: 0, nimmtAuf: false, sucherF: { zoom: null, licht: false }, appAn: true, stTab: 'wetter',
      sucher: { kamera: 'environment', zoom: '1', zoomArt: 'kamera', licht: false, timer: 0, raster: false, waage: false, ton: true, spiegeln: false } };
    this.Z = this.neuZ();
    this.root = document.createElement('div');
    this.root.className = 'ks';
    el.appendChild(this.root);
    this._klick = this.klick.bind(this); this._eingabe = this.eingabe.bind(this); this._taste = this.taste.bind(this);
    this._einfuegen = this.einfuegenEreignis.bind(this);
    this.root.addEventListener('click', this._klick);
    this.root.addEventListener('input', this._eingabe);
    // Schreibmarke merken, damit Emoji-Knöpfe an der richtigen Stelle einfügen (Antippen nimmt dem Feld den Fokus)
    this.marken = {};
    this.root.addEventListener('focusout', ev => { const t = ev.target; if (t && t.dataset && t.dataset.eingabe && t.selectionStart != null) this.marken[t.dataset.eingabeZiel || t.dataset.eingabe] = [t.selectionStart, t.selectionEnd, t.value]; });
    this.root.addEventListener('change', this._eingabe);
    this.root.addEventListener('pointerdown', ev => this.langDruck(ev));
    this.root.addEventListener('pointerdown', ev => this.blattWischen(ev));
    this.root.addEventListener('contextmenu', ev => { const b = ev.target.closest && ev.target.closest('[data-akt="zugang"]'); if (b && this.langOeffnen(b)) ev.preventDefault(); });
    document.addEventListener('keydown', this._taste);
    this.root.addEventListener('dblclick', ev => { const r = ev.target.closest('[data-regler]'); if (r) { this.setzeRegler(r.dataset.regler, 0); this.zeichneUI(); } });
    this.root.addEventListener('change', ev => { if (ev.target.matches('.ks-datei, .ks-datei-kamera') && ev.target.files && ev.target.files[0]) { this.ladeDatei(ev.target.files[0]); ev.target.value = ''; } });
    this.root.addEventListener('change', ev => { if (ev.target.matches('.ks-datei-motiv') && ev.target.files && ev.target.files[0]) { const f = ev.target.files[0]; ev.target.value = ''; if (this.ui.blatt) this.schliesseBlatt(); this.alsSticker(f); } });
    document.addEventListener('paste', this._einfuegen);
    this.ziehenAblegenEinrichten();
    this.ro = new ResizeObserver(() => this.passeAn());
    this.ro.observe(this.root);
    this.aufbauen();
    if (E() && E().pruefen) Promise.resolve(E().pruefen()).then(() => this.zeichneUI()).catch(() => {});
    this.galerieLaden();
  }
  const P = Studio.prototype;

  const NUTZER_AN = SUCHER_SCHALTER.map(s => s[0]).concat('galerie');
  /* Ein Schalter ist an, wenn die Seite ihn eingeschaltet hat und der Nutzer ihn (wo er darf) nicht selbst ausgeschaltet hat */
  const NUR_AUSDRUECKLICH = ['webp'];   // Entscheidung Nr. 4 (21.10.2026): JPEG, PNG, PDF – WebP nur, wenn die Seite es ausdrücklich einschaltet
  P.an = function (n) {
    if (NUR_AUSDRUECKLICH.includes(n)) return this.F[n] === true;
    if (this.F[n] === false) return false;
    if (NUTZER_AN.includes(n) && this.nutzerErlaubt(n === 'galerie' ? 'galerie' : 'sucher') && this.nutzerLies(n) === '0') return false;
    return true;
  };
  /* Einstellung: Wahl des Nutzers (nur wo er sie ändern darf) geht vor den Werten der Seite */
  P.opt = function (k) {
    const g = NUTZER_GRUPPE[k];
    if (g && this.nutzerErlaubt(g)) {
      const v = this.nutzerLies(k);
      if (k === 'ausloeserOrt' && AUSLOESER_ORTE.some(x => x[0] === v)) return v;
      if (g === 'zugang') { if (v) return v; }   // Ort, Platz, Aussehen sind Wörter oder Ziffern als Text; geprüft wird in zugang()
      else if (k !== 'ausloeserOrt' && v != null && v !== '' && (k === 'galerieOriginale' ? MENGEN_ORIG : MENGEN_BEARB).includes(+v)) return +v;   // nur Mengen aus der Liste
    }
    return this.optionen[k];
  };
  P.nutzerErlaubt = function (g) { const l = this.optionen.nutzerDarf && this.optionen.nutzerDarf[g]; return Array.isArray(l) && l.length > 0; };
  P.nutzerLies = function (k) {
    if (k in this.nutzerMem) return this.nutzerMem[k];
    try { return localStorage.getItem(this.nutzerPraefix + k); } catch (e) { return null; }
  };
  P.nutzerSchreibe = function (k, v) {
    if (v == null) delete this.nutzerMem[k]; else this.nutzerMem[k] = String(v);
    try { if (v == null) localStorage.removeItem(this.nutzerPraefix + k); else localStorage.setItem(this.nutzerPraefix + k, String(v)); } catch (e) { /* gesperrt: die Wahl gilt bis zum Neuladen */ }
  };
  P.freiGemerkt = function () {
    try { const p = JSON.parse(localStorage.getItem(this.nutzerPraefix + 'ausloeserPos')); if (p && isFinite(p.x) && isFinite(p.y)) return { x: klemme(p.x, 0, 1), y: klemme(p.y, 0, 1) }; } catch (e) { /* keine gemerkt */ }
    return this.freiMem || null;
  };
  P.freiPos = function () { return this.freiGemerkt() || { x: 0.5, y: 1 }; };
  P.freiMerken = function (p) {
    this.freiMem = p;
    try { localStorage.setItem(this.nutzerPraefix + 'ausloeserPos', JSON.stringify(p)); } catch (e) { /* gesperrt */ }
  };
  /* Nutzer-Einstellungen: nur, wo der Nutzer sie am Ort `wo` ändern darf ('studio' = Zahnrad, 'einstellungen' = Tab „Mehr“, 'lang' = langes Drücken, 'ersterStart' = erste Frage) */
  P.nutzerGruppen = function (wo) {
    wo = wo || 'studio';
    const d = this.optionen.nutzerDarf || {}, da = g => Array.isArray(d[g]) && d[g].includes(wo);
    return { zugang: da('zugang') && this.appModus(), ausloeser: da('ausloeser'), galerie: da('galerie') && this.F.galerie !== false, sucher: da('sucher') && SUCHER_SCHALTER.some(s => this.F[s[0]] !== false) };
  };
  P.nutzerGruppenDa = function (g) { return g.zugang || g.ausloeser || g.galerie || g.sucher; };
  P.zahnradDa = function () { return this.nutzerGruppenDa(this.nutzerGruppen()); };
  P.zahnradKnopf = function () {
    return this.zahnradDa() ? knopf({ akt: 'nutzer-oeffnen', icon: 'zahnrad', label: 'Einstellungen für Auslöser, Wetterfotos und Sucher', titel: 'Einstellungen', klasse: 'ks-rund ks-flach' }) : '';
  };
  P.faeh = function () { try { return (E() && E().faehigkeiten && E().faehigkeiten()) || {}; } catch (e) { return {}; } };
  P.ereignis = function (d) { try { if (typeof this.o.onEreignis === 'function') this.o.onEreignis(d); } catch (e) { /* Ereignis-Empfänger darf uns nicht stören */ } };
  P.haptik = function (ms) { if (this.an('haptik') && navigator.vibrate) try { navigator.vibrate(ms || 8); } catch (e) { /* egal */ } };
  P.hilfe = function (t) { return this.an('hilfeTexte') ? `<p class="ks-hilfe">${esc(t)}</p>` : ''; };
  P.grossAuto = function () {
    if (this.o.autoGross === false || this.F.grosseBedienung === true) return false;
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return fs >= 20;   // Systemschrift deutlich vergrößert (≈ 125 % und mehr)
  };
  P.gross = function () { return this.F.grosseBedienung === true || this.grossAuto(); };

  P.neuZ = function () {
    const e = E();
    const z = e && e.neuerZustand ? e.neuerZustand(this.o.start) : { drehung: 0, spiegeln: false, gerade: 0, format: 'original', ausrichtung: 'auto', zuschnitt: null, anpassung: { licht: 0, kontrast: 0, saettigung: 0, waerme: 0, vignette: 0, koernung: 0 }, filter: 'keiner', filterStaerke: 100, effekt: 'keiner', daten: {}, overlay: { stil: 'glas', position: 'unten', x: 0.5, y: 0.9, groesse: 1 }, rahmen: 'keiner', texte: [], sticker: [], postkarte: { an: false, gruss: '', rueckseite: {} }, ausgabe: { format: 'jpeg', groesse: 2160, qualitaet: 0.9 } };
    if (this.wetter && this.wetter.ort && this.wetter.ort.stadt && z.postkarte && /Mannheim/.test(z.postkarte.gruss || '')) z.postkarte.gruss = 'Grüße aus ' + this.wetter.ort.stadt;
    this.variantenZ(z);
    return z;
  };
  P.variantenZ = function (z) {
    if (this.variante === 'postkarte' && this.an('postkarte')) {
      z.postkarte.an = true;
      if (z.format === 'original') z.format = 'postkarte';
      if (this.an('pdf')) z.ausgabe.format = 'pdf';
    } else if (z.postkarte) z.postkarte.an = z.postkarte.an && this.variante !== 'postkarte' ? z.postkarte.an : false;
  };

  /* Zustand so, wie er gezeichnet/exportiert wird: abgeschaltete Funktionen wirken nicht. */
  P.wirksam = function () {
    const z = tief(this.Z);
    if (z.daten) z.daten.logoText = this.appName;
    if (!this.an('daten')) z.overlay.stil = 'aus';
    if (!this.an('logo') && z.daten) z.daten.logo = false;
    if (!this.an('text')) z.texte = [];
    z.sticker = (z.sticker || []).filter(s => s.art === 'wetter' ? this.an('sticker') : s.art === 'emoji' ? (this.an('sticker') || this.an('emojis')) : this.an('einfuegen'));
    if (!this.an('postkarte')) z.postkarte.an = false;
    if (!this.an('effekte') && !(this.an('wetterEffekte') && EFFEKT_WETTER.includes(z.effekt))) z.effekt = 'keiner';
    if (!this.an('rahmen')) z.rahmen = 'keiner';
    if (!this.an('anpassen') && !this.an('autoVerbessern')) Object.keys(z.anpassung).forEach(k => { z.anpassung[k] = 0; });
    if (!this.an('filter') && !(this.an('sw') && z.filter === 'sw')) z.filter = 'keiner';
    if (!this.an('formate') && !this.an('zuschneiden') && this.variante !== 'postkarte') { z.format = 'original'; z.zuschnitt = null; }
    if (this.ui.original) {
      const v = E().neuerZustand ? E().neuerZustand() : tief(z);
      ['drehung', 'spiegeln', 'gerade', 'format', 'ausrichtung', 'zuschnitt'].forEach(k => { v[k] = z[k]; });
      v.overlay.stil = 'aus'; v.texte = []; v.sticker = []; v.rahmen = 'keiner'; v.postkarte.an = false; v.effekt = 'keiner'; v.filter = 'keiner';
      return v;
    }
    return z;
  };
  P.aktWetter = function () { return this.ui.wetterQuelle === 'aufnahme' && this.ui.wetterAufnahme ? this.ui.wetterAufnahme : this.wetter; };

  /* ---------- Verlauf (Rückgängig/Wiederholen) ---------- */
  P.verlaufStart = function () { this.verlauf = [JSON.stringify(this.Z)]; this.pos = 0; this.lKey = null; };
  P.commit = function (key) {
    const j = JSON.stringify(this.Z);
    if (this.verlauf[this.pos] === j) { this.nachAenderung(); return; }
    const jetzt = Date.now();
    if (key && key === this.lKey && jetzt - this.lZeit < 1500 && this.pos > 0) this.verlauf[this.pos] = j;
    else {
      this.verlauf.splice(this.pos + 1); this.verlauf.push(j);
      while (this.verlauf.length > 51) this.verlauf.shift();
      this.pos = this.verlauf.length - 1;
    }
    this.lKey = key || null; this.lZeit = jetzt;
    this.ereignis({ typ: 'geaendert', zustand: tief(this.Z) });
    this.nachAenderung();
  };
  P.rueckgaengig = function (vor) {
    if (!this.an('rueckgaengig')) return;
    const n = this.pos + (vor ? 1 : -1);
    if (n < 0 || n >= this.verlauf.length) return;
    const ausgabe = this.Z.ausgabe;   // Dateiart/Größe sind keine Bearbeitung → bleiben beim Rückgängigmachen
    this.pos = n; this.Z = JSON.parse(this.verlauf[n]); this.lKey = null; this.Z.ausgabe = ausgabe;
    if (this.ui.auswahl && !this.objekt(this.ui.auswahl.art, this.ui.auswahl.id)) this.ui.auswahl = null;
    this.ereignis({ typ: 'geaendert', zustand: tief(this.Z) });
    this.nachAenderung(); this.zeichneUI(); if (this.ui.blatt) this.zeichneBlatt();
    this.zeigeHinweis(vor ? 'Wiederholt' : 'Rückgängig gemacht');
  };
  P.nachAenderung = function () {
    this.zeichnen();
    if (this.brauchtVorbereitung()) this.planeVorbereitung();
    if (this.ui.blatt === 'senden' || (this.variante === 'assistent' && this.schrittId() === 'senden')) this.planeVorbereitung();
    if (this.variante === 'schnell') this.planeThumbs();
  };

  /* ---------- Aufbau des Grundgerüsts ---------- */
  P.aufbauen = function () {
    this.stoppeLive();
    const r = this.root, v = this.variante;
    r.dataset.ksVariante = v;
    r.dataset.ksTheme = ['hell', 'dunkel'].includes(this.theme) ? this.theme : 'auto';
    r.classList.toggle('ks-gross', this.gross());
    r.classList.toggle('ks-gross-auto', this.grossAuto());
    r.classList.toggle('ks-dunkel-fest', v === 'bisher' || v === 'sucher');
    const flaeche = v === 'postkarte'
      ? `<div class="ks-karte"><div class="ks-karte-seite ks-vorne"><canvas class="ks-cv" role="img" aria-label="Vorderseite"></canvas><div class="ks-ebene"></div></div><div class="ks-karte-seite ks-hinten"><canvas class="ks-cv2" role="img" aria-label="Rückseite"></canvas><div class="ks-ebene ks-ebene2"></div></div></div>`
      : `<canvas class="ks-cv" role="img" aria-label="Vorschau"></canvas><div class="ks-ebene"></div>`;
    r.innerHTML =
      `<div class="ks-app"><div class="ks-kopf"></div><div class="ks-haupt"><div class="ks-buehne">` +
      `<div class="ks-sucher-rahmen"><video class="ks-video" playsinline muted autoplay aria-label="Kamerabild"></video><img class="ks-beispiel-bild" alt="" hidden>` +
      `<canvas class="ks-live-cv" aria-hidden="true"></canvas><div class="ks-live-overlay" aria-hidden="true"></div><div class="ks-raster ks-raster-live" aria-hidden="true"></div>` +
      `<div class="ks-waage" aria-hidden="true"><div class="ks-waage-linie"></div><span class="ks-waage-text"></span></div><div class="ks-zaehler" role="status" aria-live="assertive"></div>` +
      `<p class="ks-beispiel-hinweis" hidden></p><p class="ks-sucher-wartet" role="status" aria-live="polite"></p></div>` +
      `<div class="ks-flaeche">${flaeche}</div><div class="ks-leer"></div><div class="ks-zusatz"></div></div><div class="ks-seite"></div></div></div>` +
      `<div class="ks-frei-ebene"></div><div class="ks-start" hidden></div><div class="ks-blatt-schicht" hidden></div><div class="ks-toast" role="status" aria-live="polite"></div>` +
      `<input type="file" accept="image/*" class="ks-datei" tabindex="-1" aria-hidden="true">` +
      `<input type="file" accept="image/*" capture="environment" class="ks-datei-kamera" tabindex="-1" aria-hidden="true">` +
      `<input type="file" accept="image/*" class="ks-datei-motiv" tabindex="-1" aria-hidden="true">` +
      `<div class="ks-ablegen" aria-hidden="true"><span>Foto hier ablegen</span></div>`;
    const q = s => r.querySelector(s);
    this.$ = { kopf: q('.ks-kopf'), buehne: q('.ks-buehne'), flaeche: q('.ks-flaeche'), cv: q('.ks-cv'), cv2: q('.ks-cv2'), ebene: q('.ks-ebene'), ebene2: q('.ks-ebene2'),
      leer: q('.ks-leer'), zusatz: q('.ks-zusatz'), frei: q('.ks-frei-ebene'), seite: q('.ks-seite'), start: q('.ks-start'), blatt: q('.ks-blatt-schicht'), toast: q('.ks-toast'),
      datei: q('.ks-datei'), dateiKamera: q('.ks-datei-kamera'), dateiMotiv: q('.ks-datei-motiv'), video: q('.ks-video'), live: q('.ks-live-overlay'), karte: q('.ks-karte'),
      rahmen: q('.ks-sucher-rahmen'), bsp: q('.ks-beispiel-bild'), liveCv: q('.ks-live-cv'), raster: q('.ks-raster-live'), waage: q('.ks-waage'), zaehler: q('.ks-zaehler'), bspHinweis: q('.ks-beispiel-hinweis'), wartet: q('.ks-sucher-wartet') };
    this.liveKey = '';
    if (this.roB) this.ro.unobserve(this.roB);
    this.roB = this.$.buehne; this.ro.observe(this.roB);   // Bühne ändert sich auch, wenn unten etwas dazukommt (Galerie-Streifen)
    this.zeigerEinrichten();
    this.freiEinrichten();
    this.passeAn(true);
    this.zeichneUI();
    this.zeichneStart();
    this.zeichnen();
  };

  /* Größe des Containers → Layout-Klassen */
  P.passeAn = function (still) {
    const b = this.root.clientWidth, h = this.root.clientHeight;
    if (!b || !h) return;
    const g = this.gross();
    if (g !== this.root.classList.contains('ks-gross') && !still) { this.root.classList.toggle('ks-gross', g); this.root.classList.toggle('ks-gross-auto', this.grossAuto()); this.zeichneUI(); }
    const quer = b > h && h < 500, breit = !quer && b >= 768;
    const k = quer ? 'ks-quer' : breit ? 'ks-breit' : 'ks-hoch';
    const alt = this.root.classList.contains(k);
    this.root.classList.remove('ks-quer', 'ks-breit', 'ks-hoch');
    this.root.classList.add(k);
    this.root.classList.toggle('ks-klein', b < 360 || h < 600);
    this.layoutArt = k;
    if (!alt && !still) this.zeichneUI();
    this.zeichnen();
  };

  /* ---------- Struktur neu zeichnen (Kopf, Seite, Leerzustand, Zusätze) ---------- */
  P.zeichneUI = function () {
    if (!this.$) return;
    const fokus = this.merkeFokus();
    const live = this.ui.ansicht === 'live', v = live ? V.sucher : V[this.variante], zs = this.ui.ansicht === 'zuschneiden';
    this.root.classList.toggle('ks-mit-foto', !!this.quelle);
    this.root.classList.toggle('ks-zuschneiden', zs);
    this.root.classList.toggle('ks-live', live);
    this.root.classList.toggle('ks-dunkel-fest', this.variante === 'bisher' || this.variante === 'sucher' || live);   // Kamera-Ansicht ist immer dunkel
    this.$.kopf.innerHTML = zs ? this.kopfZuschneiden() : v.kopf.call(this);
    this.$.kopf.classList.toggle('ks-kopf-leer', !this.$.kopf.querySelector('button, h2, .ks-schritt-kopf'));
    let seite, kontext = false;
    if (zs) seite = this.seiteZuschneiden();
    else if (this.quelle && !live && this.ui.auswahl && this.objekt(this.ui.auswahl.art, this.ui.auswahl.id)) { seite = this.kontextHtml(); kontext = true; }
    else seite = v.seite.call(this);
    // Nach-Foto-Knöpfe stehen immer fest unten (nie im Rollbereich, sonst schaut nur ein Streifen heraus); nur der Galerie-Streifen rollt mit, wo es eng ist (klein, quer, große Bedienung)
    const eng = this.variante === 'assistent' || this.root.classList.contains('ks-klein') || this.root.classList.contains('ks-quer') || this.root.classList.contains('ks-gross');
    const nach = !zs && !kontext && !live ? this.nachFotoHtml(eng && /ks-seite-inhalt/.test(seite || '')) : { fest: '', rolle: '' };
    if (nach.fest) seite = (seite || '') + nach.fest;
    const SCROLL = '.ks-seite-inhalt, .ks-karussell, .ks-chips, .ks-werkzeugleiste, .ks-galerie-reihe';
    const scroll = Array.from(this.$.seite.querySelectorAll(SCROLL)).map(e => [e.scrollLeft, e.scrollTop]);
    const galAlt = this.$.seite.querySelector('.ks-galerie-reihe'), galLinks = galAlt ? galAlt.scrollLeft : 0;   // eigens gemerkt: nachFestPruefen hängt den Streifen um, das verschiebt die Reihenfolge oben
    this.$.seite.innerHTML = (seite || '').trim();
    if (nach.rolle) { const inh = this.$.seite.querySelector('.ks-seite-inhalt'); if (inh) inh.insertAdjacentHTML('beforeend', nach.rolle); }
    Array.from(this.$.seite.querySelectorAll(SCROLL)).forEach((e, i) => { if (scroll[i]) { e.scrollLeft = scroll[i][0]; e.scrollTop = scroll[i][1]; } });
    { const wl = this.$.seite.querySelector('.ks-werkzeugleiste'), wa = wl && wl.querySelector('.ks-an');   // rollende Werkzeugleiste (große Schrift): das gewählte Werkzeug bleibt im Bild
      if (wl && wa && wl.scrollWidth > wl.clientWidth) { const q = wa.getBoundingClientRect(), p = wl.getBoundingClientRect(); if (q.width && (q.left < p.left || q.right > p.right)) wl.scrollLeft += (q.left + q.width / 2) - (p.left + p.width / 2); } }
    if (this.vorlageZeigen) { this.vorlageZeigen = false; const k = this.$.seite.querySelector('.ks-vorlage.ks-an'), c = k && k.parentElement; if (k && c && c.scrollWidth > c.clientWidth) { const z = k.offsetLeft - (c.clientWidth - k.offsetWidth) / 2; c.scrollTo({ left: Math.max(0, z), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }
    this.$.leer.innerHTML = this.quelle || live ? '' : this.leerHtml();
    this.$.zusatz.innerHTML = (!zs && v.zusatz ? (v.zusatz.call(this) || '') : '') + (!zs && !live ? this.frageHtml() : '');
    if (this.$.karte) this.$.karte.classList.toggle('ks-gewendet', this.ui.seite === 'hinten');
    this.nachFestPruefen();
    const galNeu = this.$.seite.querySelector('.ks-galerie-reihe'); if (galNeu && galLinks) galNeu.scrollLeft = galLinks;
    this.$.frei.innerHTML = live && this.ausloeserEbene() ? this.ausloeserKnopf() : '';
    if (live) { this.zeichneSucher(); this.freiPlatzieren(); }
    this.stelleFokus(fokus);
  };
  /* Würden die festen Nach-Foto-Knöpfe den Rollbereich unter 160 px drücken (klein, quer, große Bedienung), rollen sie stattdessen am Ende des Rollbereichs mit */
  P.nachFestPruefen = function () {
    const n = this.$.seite.querySelector(':scope > .ks-nach-foto'), inh = this.$.seite.querySelector(':scope > .ks-seite-inhalt');
    const genug = () => inh.clientHeight >= Math.min(inh.scrollHeight, 160);
    if (!n || !inh || genug()) return;
    // Zuerst nur den Galerie-Streifen mitrollen lassen; die Knöpfe bleiben fest, sonst schaut von ihnen nur ein Streifen heraus
    const g = n.querySelector(':scope > .ks-galerie-streifen');
    if (g && n.querySelector(':scope > .ks-nach-reihe, :scope > .ks-reihe')) {
      const rolle = document.createElement('div'); rolle.className = 'ks-nach-foto ks-nach-rolle'; rolle.appendChild(g); inh.appendChild(rolle);
      if (genug()) return;
    }
    inh.insertBefore(n, inh.querySelector('.ks-nach-rolle'));
  };
  P.merkeFokus = function () {
    const a = document.activeElement;
    if (!a || !this.root.contains(a)) return null;
    return { fk: a.dataset && a.dataset.fk, feld: a.dataset && a.dataset.feld, s: a.selectionStart, e: a.selectionEnd };
  };
  P.stelleFokus = function (f) {
    if (!f) return;
    const a = document.activeElement;
    if (a && this.root.contains(a) && a !== document.body && a.isConnected) return;
    let ziel = null;
    if (f.fk) ziel = this.root.querySelector(`[data-fk="${CSS.escape(f.fk)}"]`);
    if (!ziel && f.feld) ziel = this.root.querySelector(`[data-feld="${CSS.escape(f.feld)}"]`);
    if (ziel && !ziel.disabled) { try { ziel.focus({ preventScroll: true }); if (f.s != null && ziel.setSelectionRange) ziel.setSelectionRange(f.s, f.e); } catch (e) { /* egal */ } }
  };

  P.kopfHtml = function (l, m, r) { return `<div class="ks-kopf-l">${l || ''}</div><div class="ks-kopf-m">${m || ''}</div><div class="ks-kopf-r">${r || ''}</div>${this.stufeHtml()}`; };
  /* ---------- A25: Umschalter „Einfach | Profi“ (Ein-Tipp-Karte ↔ Werkzeugleiste), nur mit Mount-Option stufenWahl ---------- */
  // stufenWahl als Ja/Nein oder als Text aus dem Konfigurator-JSON („ja“/„nein“); „nein“, „false“, „aus“, „0“ und leer heißen aus
  const jaNein = v => typeof v === 'string' ? !/^(nein|false|aus|0|)$/i.test(v.trim()) : !!v;
  P.stufeDa = function () { return jaNein(this.o.stufenWahl) && STUFEN.some(s => s[2] === this.variante); };
  P.stufe = function () { return (STUFEN.find(s => s[2] === this.variante) || STUFEN[0])[0]; };
  P.stufeHtml = function () {
    if (!this.stufeDa() || !this.quelle || this.ui.ansicht !== 'bearbeiten') return '';
    const st = this.stufe();
    return `<div class="ks-kopf-stufe"><div class="ks-segment" role="group" aria-label="Bedienung">${STUFEN.map(([id, n]) => chip('stufe', id, n, st === id)).join('')}</div></div>`;
  };
  /* Wechsel ohne nachLaden (sonst käme die Vorlage noch einmal aufs Bild): Foto, Zustand und Verlauf bleiben, offene Blätter gehen vorher zu */
  P.stufeWechseln = function (st) {
    const s = STUFEN.find(x => x[0] === st);
    if (!s || !this.stufeDa()) return;
    this.nutzerSchreibe('stufe', st);
    if (s[2] === this.variante) { if (this.ui.blatt) this.schliesseBlatt(); return; }
    if (this.ui.blatt) this.schliesseBlatt();
    this.variante = s[2]; this.ui.auswahl = null; this.ui.leistenPanel = null;
    this.aufbauen(); this.nachAenderung();
    this.ereignis({ typ: 'stufe', stufe: st, variante: s[2] });
    const k = this.root.querySelector(`[data-akt="stufe"][data-wert="${st}"]`); if (k) try { k.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  };
  // Plan 3.7 / Entscheidung Nr. 12: der Live-Sucher ist erst nach dem iPhone-Test freigegeben – jeder Weg in den Sucher mit Design braucht auch den Schalter „Live-Sucher“ (im Konfigurator nur bei „Alles“ an; die Apps lassen alles an)
  P.designSucherDa = function () { return this.an('designSucher') && this.an('liveSucher'); };
  P.kNeu = function () { return this.quelle ? knopf({ akt: 'verwerfen-frage', text: 'Anderes Foto', label: 'Anderes Foto (alles verwerfen)', klasse: 'ks-flach' }) : ''; };
  P.kUndo = function () {
    if (!this.an('rueckgaengig') || !this.quelle) return '';
    // „Foto:“ trennt diese Knöpfe von Rückgängig/Wiederholen der Einstellungen in der Kopfleiste der Seite; Kurzbeschriftung nur, wo Platz ist (CSS)
    // „Foto“ davor: sichtbar nur, wo die Seite es einschaltet (Konfigurator, Plan 3.8: zwei Rückgängig-Paare auf einem Bildschirm)
    return `<div class="ks-undo"><span class="ks-undo-titel" aria-hidden="true">Foto</span>${knopf({ akt: 'rueck', icon: 'rueck', label: 'Foto: Rückgängig', titel: 'Foto: Rückgängig (⌘Z)', klasse: 'ks-rund ks-flach', aus: this.pos <= 0, html: '<span class="ks-undo-text" aria-hidden="true">Foto zurück</span>' })}` +
      `${knopf({ akt: 'vor', icon: 'vor', label: 'Foto: Wiederholen', titel: 'Foto: Wiederholen (⇧⌘Z)', klasse: 'ks-rund ks-flach', aus: this.pos >= this.verlauf.length - 1, html: '<span class="ks-undo-text" aria-hidden="true">Foto vor</span>' })}</div>`;
  };
  P.kSenden = function () { return this.quelle ? knopf({ akt: 'senden', text: 'Teilen', icon: 'teilen', klasse: 'ks-primaer ks-pille' }) : ''; };

  /* ---------- Leerzustand und Fotoquellen ---------- */
  // Am Rechner (Maus, kein Touch) öffnet „Foto aufnehmen“ keine Kamera
  const ohneKamera = () => !(navigator.maxTouchPoints > 0) && !!(window.matchMedia && matchMedia('(pointer: fine)').matches);
  P.quellenKnoepfe = function () {
    const k = [];
    // Der Konfigurator (Option beispielHaupt) stellt das Beispielfoto vorn hin, solange noch kein Foto da ist: am Rechner tut die Kamera nichts
    const bspVorn = !!(this.o.beispielHaupt && this.o.beispielFoto && !this.quelle);
    if (bspVorn) k.push(knopf({ akt: 'beispiel', text: 'Beispielfoto', icon: 'bild', klasse: 'ks-primaer ks-breit-knopf' }));
    if (this.variante === 'sucher' && this.an('liveSucher')) k.push(knopf({ akt: 'live-start', text: this.ui.liveFehler ? 'Kamera nochmal versuchen' : 'Kamera starten', icon: 'video', klasse: (this.ui.liveFehler ? 'ks-flach ' : 'ks-primaer ') + 'ks-breit-knopf' }));
    const erster = () => !k.length || (this.ui.liveFehler && k.length === 1);
    if (this.an('kamera')) k.push(knopf({ akt: 'foto-kamera', text: 'Foto aufnehmen', icon: 'kamera', klasse: (erster() ? 'ks-primaer ' : '') + 'ks-breit-knopf' }));
    if (this.an('kamera') && ohneKamera()) k.push(`<p class="ks-hilfe ks-kamera-hinweis">Am Rechner öffnet sich hier keine Kamera. Nimm „Foto wählen“${this.o.beispielFoto ? ' oder das Beispielfoto' : ''}.</p>`);
    if (this.an('mediathek')) k.push(knopf({ akt: 'foto-waehlen', text: 'Foto wählen', icon: 'bild', klasse: (k.length ? '' : 'ks-primaer ') + 'ks-breit-knopf' }));
    if (this.an('einfuegen') && navigator.clipboard && navigator.clipboard.read) k.push(knopf({ akt: 'einfuegen', text: 'Einfügen', icon: 'einfuegen', klasse: 'ks-breit-knopf' }));
    if (this.variante !== 'sucher' && this.designSucherDa()) k.push(knopf({ akt: 'weiter-foto', text: 'Mit Live-Sucher aufnehmen', icon: 'video', klasse: 'ks-breit-knopf' }));
    if (this.o.beispielFoto && !bspVorn) k.push(knopf({ akt: 'beispiel', text: 'Beispielfoto', icon: 'bild', klasse: (k.length ? 'ks-flach ' : 'ks-primaer ') + 'ks-breit-knopf' }));
    return k.join('');
  };
  P.leerHtml = function () {
    if (!E()) return `<div class="ks-leer-inhalt"><h2>Technik fehlt</h2><p>Die Bildtechnik (ks-engine.js) wurde nicht geladen.</p></div>`;
    const sucher = this.variante === 'sucher';
    const knoepfe = this.quellenKnoepfe();
    const meldung = this.ui.fehler ? `<div class="ks-meldung" role="status"><p>${esc(this.ui.fehler)}</p></div>` : '';
    const live = sucher && this.ui.liveFehler ? `<div class="ks-meldung" role="status"><p>${esc(this.ui.liveFehler)}${/Foto/.test(this.ui.liveFehler) ? '' : ' Du kannst trotzdem ein Foto aufnehmen oder wählen.'}</p></div>` : '';
    if (this.ui.laedt) return `<div class="ks-leer-inhalt"><div class="ks-skelett" aria-hidden="true"></div><p>Foto wird geöffnet …</p></div>`;
    return `<div class="ks-leer-inhalt"><div class="ks-leer-symbol">${ic(sucher ? 'video' : 'kamera')}</div>` +
      `<h2>${sucher ? 'Foto mit Wetter aufnehmen' : 'Wetterfoto gestalten'}</h2>` +
      `<p>${sucher && this.an('liveSucher') && !this.ui.liveFehler ? 'Du siehst das Wetter schon im Kamerabild.' : 'Nimm ein Foto auf oder wähle eins aus – das Wetter kommt danach aufs Bild.'} Es bleibt auf deinem Gerät.</p>${meldung}${live}` +
      (knoepfe ? `<div class="ks-leer-knoepfe">${knoepfe}</div>` : `<p class="ks-hilfe">Alle Fotoquellen sind ausgeschaltet.</p>`) +
      (this.an('einfuegen') ? `<p class="ks-hilfe ks-hilfe-fest">In Fotos: Motiv lange drücken → Kopieren, dann hier „Einfügen“.</p>` : '') +
      (this.an('ziehenAblegen') ? `<p class="ks-hilfe ks-nur-zeiger">Oder ein Foto hierher ziehen.</p>` : '') +
      this.galerieHtml() + (this.zahnradDa() || this.appModus() ? `<div class="ks-reihe ks-reihe-mitte">${this.appModus() ? knopf({ akt: 'zur-start', text: 'Zur Startseite', icon: 'links', klasse: 'ks-flach' }) : ''}${this.zahnradKnopf()}</div>` : '') + `</div>`;
  };

  /* ---------- Nach dem ersten Foto: weiterfotografieren, neues Foto, Meine Wetterfotos ---------- */
  P.nachFotoHtml = function (galerieRollt) {
    const leer = { fest: '', rolle: '' };
    if (!this.quelle || this.ui.ansicht !== 'bearbeiten') return leer;
    if (this.variante === 'assistent' && this.schrittId() !== 'senden') return leer;   // im Assistenten erst im letzten Schritt
    if (this.variante === 'schnell' && this.galerieOben()) return leer;   // Knöpfe, Galerie und Zahnrad zeigt die Karte selbst (V.schnell.seite)
    const k = [];
    // Kurzer Text, damit kein Wort bricht; der Knopf-Name für Vorlesen bleibt der lange
    if (this.designSucherDa() && this.ui.geteilt && this.variante !== 'schnell') k.push(knopf({ akt: 'weiter-foto', text: 'Gleiches Design', label: 'Mit diesem Design weiterfotografieren', icon: 'video', klasse: 'ks-primaer ks-nach-knopf' }));
    if (this.an('neuesFoto') && this.ui.geteilt && this.variante !== 'schnell') k.push(knopf({ akt: 'neu-kamera', text: 'Neues Foto', icon: 'kamera', klasse: 'ks-nach-knopf' }));
    const zahnrad = this.zahnradKnopf(), galerie = this.galerieOben() ? '' : this.galerieHtml();   // in der Ein-Tipp-Karte steht die Leiste über den Vorlagen
    if (!k.length && !galerie) return leer;
    const reihe = k.length ? `<div class="ks-nach-reihe">${k.join('')}${zahnrad}</div>` : zahnrad ? `<div class="ks-reihe ks-reihe-mitte">${zahnrad}</div>` : '';
    return {
      fest: reihe || (!galerieRollt && galerie) ? `<div class="ks-nach-foto">${reihe}${galerieRollt ? '' : galerie}</div>` : '',
      rolle: galerieRollt && galerie ? `<div class="ks-nach-foto ks-nach-rolle">${galerie}</div>` : ''
    };
  };

  // Nach dem Teilen steht in der Ein-Tipp-Karte an der Stelle des Links „Teilen-Optionen“ eine einzeilige Reihe: gleiches Design, neues Foto (die Optionen rücken als Knopf neben „Teilen“); die Karte wird dadurch nicht höher, nichts springt
  P.nachSchnellHtml = function () {
    const k = [];
    if (this.designSucherDa()) k.push(knopf({ akt: 'weiter-foto', text: 'Gleiches Design', label: 'Mit diesem Design weiterfotografieren', icon: 'video', klasse: 'ks-nach-knopf' }));
    if (this.an('neuesFoto')) k.push(knopf({ akt: 'neu-kamera', text: 'Neues Foto', icon: 'kamera', klasse: 'ks-nach-knopf' }));
    return `<div class="ks-nach-foto ks-nach-schnell"><div class="ks-nach-reihe">${k.join('')}</div></div>`;
  };

  /* ---------- Meine Wetterfotos (Galerie, nur auf diesem Gerät) ---------- */
  P.galerieAn = function () { return this.an('galerie') && !!(E() && E().galerie) && (this.opt('galerieOriginale') > 0 || this.opt('galerieBearbeitet') > 0); };
  P.galerieGrenzen = function () { return { original: this.opt('galerieOriginale'), bearbeitet: this.opt('galerieBearbeitet') }; };
  P.galerieHinweisText = function () { return GAL_HINWEIS + (this.gal.modus === 'speicher' ? ' Hier nur, solange diese Seite offen ist.' : ''); };
  P.galerieName = function (e) {
    const d = new Date(e.zeit), wann = d.toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (e.art === 'bearbeitet' ? 'Fertiges Foto vom ' : 'Original vom ') + wann;
  };
  P.galerieThumb = function (e) {
    return `<button type="button" class="ks-galerie-thumb" data-akt="galerie-eintrag" data-wert="${esc(e.id)}" data-art="${e.art}" data-fk="galerie-eintrag:${esc(e.id)}" aria-label="${esc(this.galerieName(e))}, öffnen">` +
      `<img alt="" src="${esc(e.thumb)}"><span class="ks-galerie-marke" aria-hidden="true">${ic(e.art === 'bearbeitet' ? 'haken' : 'kamera')}</span></button>`;
  };
  // Ein-Tipp-Karte: die Leiste steht über den Vorlagen (kein Springen, auch nicht nach dem Teilen)
  P.galerieOben = function () { return this.variante === 'schnell' && this.root.clientHeight >= 600; };   // niedriger (iPhone SE, quer): wie früher unten, denn oben fehlte der Platz für die Vorlagen; die Höhe ändert sich nach dem Teilen nicht, also springt nichts
  P.galerieHtml = function (kompakt) {
    if (!this.galerieAn() || !this.gal.liste.length) return '';
    const l = this.gal.liste.slice(0, 12);
    return `<div class="ks-galerie-streifen${kompakt ? ' ks-galerie-kompakt' : ''}" role="group" aria-label="Meine Wetterfotos"><div class="ks-galerie-kopf"><strong class="ks-galerie-titel">Meine Wetterfotos</strong>` +
      `${knopf({ akt: 'galerie-alle', text: 'Alle (' + this.gal.liste.length + ')', klasse: 'ks-flach' })}</div>` +
      `<div class="ks-galerie-reihe">${l.map(e => this.galerieThumb(e)).join('')}</div>${kompakt ? '' : `<p class="ks-galerie-hinweis">${esc(this.galerieHinweisText())}</p>`}</div>`;   // kompakt: den Hinweis „nur auf diesem Gerät“ zeigt das Blatt „Meine Wetterfotos“
  };
  P.galerieLaden = async function () {
    const G = E() && E().galerie; if (!G || !this.an('galerie')) { if (this.gal.liste.length) { this.gal.liste = []; this.zeichneUI(); } return; }
    try {
      const l = await G.liste(), modus = await G.modus();
      const gleich = JSON.stringify(l.map(e => e.id)) === JSON.stringify(this.gal.liste.map(e => e.id)) && modus === this.gal.modus;
      this.gal.liste = l; this.gal.modus = modus;
      if (gleich || !this.root.isConnected) return;
      this.zeichneUI(); if (this.ui.blatt === 'galerie') this.zeichneBlatt();
    } catch (e) { this.gal.liste = []; }
  };
  /* Grenzen anwenden (zu viele Fotos fliegen raus, älteste zuerst), dann Streifen neu */
  P.galerieAnwenden = async function () {
    const G = E() && E().galerie;
    if (G && this.an('galerie')) { try { await G.begrenze(this.galerieGrenzen()); } catch (e) { /* egal */ } }   // auch bei 0/0: dann wird geräumt
    await this.galerieLaden();
  };
  P.galerieOriginalSichern = async function (q) {
    if (!this.galerieAn() || !(this.opt('galerieOriginale') > 0) || !q || !q.bild) return;
    try {
      const bild = q.bild, thumb = E().galerie.thumb(bild, 160);
      const blob = await new Promise(res => bild.toBlob(res, q.transparent ? 'image/png' : 'image/jpeg', 0.9));   // JPEG hätte schwarzen Grund statt durchsichtig
      if (!blob) return;
      await E().galerie.speichere({ art: 'original', blob, thumb, name: q.name || 'Foto', breite: q.breite, hoehe: q.hoehe }, this.galerieGrenzen());
      await this.galerieLaden();
    } catch (e) { /* die Galerie ist eine Zugabe: ein Fehler hier stört das Foto nicht */ }
  };
  /* Fertiges Bild (nach Teilen, Sichern, Kopieren) in die Galerie legen; erg = schon erzeugtes Bild, sonst wird eines erzeugt */
  P.speichereBearbeitet = async function (erg) {
    if (!this.quelle || !this.galerieAn() || !(this.opt('galerieBearbeitet') > 0)) return;
    const q = this.quelle;
    try {
      const Zw = this.wirksam(), w = this.aktWetter();
      if (!erg || !/^image\//.test(erg.mime || '')) erg = await E().exportiere(q, Zw, w, { format: 'jpeg', groesse: 2160, qualitaet: 0.88, beideSeiten: false });
      const c = document.createElement('canvas');
      E().render(c, q, Zw, w, { maxSeite: 200, vorschau: true });
      const thumb = E().galerie.thumb(c, 160); c.width = c.height = 0;
      const satz = { art: 'bearbeitet', blob: erg.blob, thumb, name: erg.dateiname || 'Wetterfoto', breite: erg.breite, hoehe: erg.hoehe };
      let ent = null; try { ent = await this.entwurfDaten(q); } catch (e) { ent = null; }   // ohne Entwurf geht es trotzdem
      try { await E().galerie.speichere(Object.assign({}, satz, ent ? { entwurf: ent.meta, entwurfBlob: ent.blob } : {}), this.galerieGrenzen()); }
      catch (e) {
        if (!e || e.code !== 'speicher-voll') throw e;
        let ohne = false;
        if (ent) { try { await E().galerie.speichere(satz, this.galerieGrenzen()); ohne = true; } catch (e2) { /* auch ohne Entwurf kein Platz */ } }
        this.zeigeHinweis(ohne ? 'Speicher voll: Das Foto liegt in „Meine Wetterfotos“, aber ohne „Weiter bearbeiten“. Lösche alte Fotos, dann klappt es wieder.'
          : 'Speicher voll: Das Foto ist nicht in „Meine Wetterfotos“. Lösche alte Fotos, dann klappt es wieder.');
      }
      await this.galerieLaden();
    } catch (e) { /* Zugabe, siehe oben */ }
  };
  /* A25 (Entscheidung Nr. 14): Entwurf = Bearbeitungsstand + Original, damit „Weiter bearbeiten“ genau dort weitermacht.
     Original ist die Datei selbst, wenn sie unverkleinert geladen wurde (dann pixelgleich; GPS-Werte genullt), sonst eine Kopie mit höchstens 3072 px. */
  P.entwurfDaten = async function (q) {
    const d = q.datei, typ = (d && d.type) || '';
    let blob = null;
    if (d && /^image\/(jpeg|png)$/.test(typ) && q.originalBreite === q.breite && q.originalHoehe === q.hoehe && Math.max(q.breite, q.hoehe) <= ENTWURF_DATEI_MAX && d.size <= 12e6)
      blob = typ === 'image/jpeg' && E().ohneGps ? new Blob([E().ohneGps(await d.arrayBuffer())], { type: typ }) : d;
    else {
      const f = Math.min(1, ENTWURF_MAX / Math.max(q.breite, q.hoehe)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(q.breite * f)); c.height = Math.max(1, Math.round(q.hoehe * f));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(q.bild, 0, 0, c.width, c.height);
      blob = await new Promise(res => c.toBlob(res, q.transparent ? 'image/png' : 'image/jpeg', 0.92)); c.width = c.height = 0;
    }
    if (!blob) return null;
    return { blob, meta: { version: ENTWURF_VERSION, zustand: tief(this.Z), wetter: tief(this.aktWetter() || {}), exif: { datum: (q.exif && q.exif.datum) || null },
      name: q.name || 'Foto', vorlage: this.ui.vorlage, autoWerte: this.ui.autoWerte ? tief(this.ui.autoWerte) : null } };
  };
  P.entwurfDa = r => !!(r && r.entwurfBlob && r.entwurf && r.entwurf.version === ENTWURF_VERSION && r.entwurf.zustand);
  /* Original mit genau diesem Stand öffnen; Rückgängig beginnt neu, das Wetter von damals bleibt (umschaltbar unter „Welches Wetter?“) */
  P.weiterBearbeiten = async function (r) {
    if (!this.entwurfDa(r) || !E()) return;
    const e = r.entwurf;
    this.ui.fehler = null; this.ui.laedt = true; this.zeichneUI();
    try {
      const q = await E().ladeDatei(new File([r.entwurfBlob], e.name || 'Foto.jpg', { type: r.entwurfBlob.type || 'image/jpeg' }));
      if (e.exif && e.exif.datum) q.exif.datum = e.exif.datum;
      q.exif.lat = null; q.exif.lon = null;
      this.setzeQuelle(q, { entwurf: e, ausGalerie: true });
      this.zeigeHinweis('Entwurf geöffnet ✓ Rückgängig beginnt hier neu.');
    } catch (err) {   // der Text „Kamera → Formate“ passt hier nicht: das gemerkte Original ist beschädigt oder wurde von Safari gelöscht
      const kaputt = !err || err.code === 'leer' || err.code === 'unlesbar';
      this.fehler(kaputt ? null : err, 'Der Entwurf ist nicht mehr lesbar (Safari löscht manchmal gespeicherte Daten). Das fertige Foto bleibt in „Meine Wetterfotos“.');
    }
  };
  P.oeffneGalerieEintrag = async function (id) {
    let rec = null; try { rec = await E().galerie.lade(id); } catch (e) { rec = null; }
    if (!rec) { this.zeigeHinweis('Dieses Foto gibt es nicht mehr.'); this.galerieLaden(); return; }
    this.galAnsichtFrei();
    this.gal.ansicht = { rec, url: URL.createObjectURL(rec.blob) };
    this.oeffneBlatt('galerie-eintrag');
  };
  P.galAnsichtFrei = function () { if (this.gal.ansicht) { URL.revokeObjectURL(this.gal.ansicht.url); this.gal.ansicht = null; } };
  /* Zahnrad-Wahl wirkt sofort: Blatt und Oberfläche neu, bei Galerie auch die Grenzen */
  P.nutzerAnwenden = function (galerie) {
    this.zeichneBlatt(); this.zeichneUI(); this.zeichneStart();
    if (galerie) this.galerieAnwenden();
  };

  /* ---------- Paket I-C: App-Startseite (Nachbau der WetterPro-App) mit Zugangsknopf ---------- */
  P.appModus = function () { return this.optionen.vorschauStart === 'app'; };
  P.startZeigt = function () { return this.appModus() && this.ui.appAn; };
  /* Ort, Platz, Aussehen und Aktion des Knopfs: Wahl des Nutzers (wo erlaubt) vor der Seite; Ungültiges fällt auf Standards zurück */
  P.zugang = function () {
    const ort0 = String(this.opt('zugangOrt')), ort = ZUGANG_ORTE.some(x => x[0] === ort0) ? ort0 : 'tab';
    const platz0 = String(this.opt('zugangPlatz')), platz = ZUGANG_PLAETZE[ort].some(x => x[0] === platz0) ? platz0 : ZUGANG_PLATZ_STD[ort];
    const nicht = ZUGANG_NICHT[ort] || [], aus0 = String(this.opt('zugangAussehen'));
    const aus = ZUGANG_AUSSEHEN.some(x => x[0] === aus0) && !nicht.includes(aus0) ? aus0 : ZUGANG_AUSSEHEN.map(x => x[0]).find(a => !nicht.includes(a));
    const aktion = ZUGANG_AKTIONEN[this.optionen.zugangAktion] ? this.optionen.zugangAktion : 'kamera';
    return { ort, platz, aus, aktion };
  };
  P.startAus = function () { if (!this.ui.appAn) return; this.ui.appAn = false; this.zeichneStart(); };
  P.startZeigen = function () {
    if (!this.appModus()) return;
    this.ui.appAn = true; this.zeichneStart();
    const k = this.$.start.querySelector('[data-akt="zugang"]'); if (k) try { k.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  };
  P.zeichneStart = function () {
    const s = this.$ && this.$.start; if (!s) return;
    const an = this.startZeigt();
    this.root.classList.toggle('ks-auf-start', an);
    s.hidden = !an;
    if (!an) { s.innerHTML = ''; return; }
    const fokus = this.merkeFokus(), alt = s.querySelector('.ks-st-haupt'), scroll = alt ? alt.scrollTop : 0, tab = alt && alt.dataset.tab;
    s.innerHTML = this.startHtml();
    const neu = s.querySelector('.ks-st-haupt'); if (neu && tab === this.ui.stTab) neu.scrollTop = scroll;
    this.stelleFokus(fokus);
    this.ersterStartPruefen();
  };
  P.wetterSymbol = function (code, g) {
    try { const S = window.KSSymbole; if (S && S.svgFuerCode) return `<span class="ks-st-sym" aria-hidden="true">${S.svgFuerCode(code, false, g || 48)}</span>`; } catch (e) { /* Rückfall unten */ }
    return `<span class="ks-st-sym" aria-hidden="true">${ic('wetter')}</span>`;
  };
  /* Der Zugangsknopf: eine Bauform für alle Orte, das Aussehen kommt aus der Klasse ks-za-… */
  P.zugangKnopf = function (z) {
    const lang = this.nutzerGruppen('lang').zugang, name = 'Wetterfoto – ' + ZUGANG_AKTIONEN[z.aktion];
    const sym = `<span class="ks-za-sym">${ic('kamera')}</span>`, text = '<span class="ks-za-text">Wetterfoto</span>';
    const innen = z.aus === 'pille' ? text : z.aus === 'symbolText' ? sym + text : sym;
    this.nr = this.nr || ++zaehler;
    return `<button type="button" class="ks-za ks-za-${z.aus}${z.ort === 'mehr' ? ' ks-za-zeile' : ''}" data-akt="zugang" data-fk="zugang:" data-ort="${z.ort}" aria-label="${esc(name)}"` +
      `${lang ? ` aria-describedby="ks-zh-${this.nr}" title="${esc(name + ' (lange drücken zum Anpassen)')}"` : ''}>${innen}${z.ort === 'mehr' ? `<span class="ks-za-sub">${ZUGANG_AKTIONEN[z.aktion]}</span>` : ''}</button>`;
  };
  P.startHtml = function () {
    const z = this.zugang(), w = this.wetter || {}, tab = this.ui.stTab, knopf0 = this.zugangKnopf(z);
    const app = (id, label, icon) => `<button type="button" class="ks-st-ikon" data-akt="start-hinweis" data-wert="${id}" data-fk="start-hinweis:${id}" aria-label="${label}">${ic(icon)}</button>`;
    const L = [app('orte', 'Meine Orte', 'orte')], R = [app('suche', 'Ort suchen', 'suche')];
    if (z.ort === 'kopf') ({ 'links-aussen': () => L.unshift(knopf0), 'links-innen': () => L.push(knopf0), 'rechts-innen': () => R.unshift(knopf0), 'rechts-aussen': () => R.push(knopf0) })[z.platz]();
    const ort = (w.ort && w.ort.stadt) || 'Ort', teil = (w.ort && w.ort.stadtteil) || '';
    const kopf = `<header class="ks-st-kopf"><div class="ks-st-seite">${L.join('')}</div><div class="ks-st-titel"><h2 class="ks-st-ort">${esc(ort)}</h2><p class="ks-st-sub">${esc(teil || 'Jetzt')}</p></div><div class="ks-st-seite ks-st-seite-r">${R.join('')}</div></header>`;
    const tabs = START_TABS.map(([id, name, icon]) => `<button type="button" class="ks-st-tab" data-akt="start-tab" data-wert="${id}" data-tab="${id}" data-fk="start-tab:${id}"${tab === id ? ' aria-current="page"' : ''}>${ic(icon)}<span>${name}</span></button>`);
    if (z.ort === 'tab') tabs.splice(+z.platz - 1, 0, knopf0);
    const nav = `<nav class="ks-st-tabs" aria-label="Bereiche">${tabs.join('')}</nav>`;
    const schwebend = z.ort === 'schwebend' ? `<div class="ks-st-schwebend ks-st-pos-${z.platz}">${knopf0}</div>` : '';
    const hinweis = this.nutzerGruppen('lang').zugang ? `<span class="ks-nur-sr" id="ks-zh-${this.nr}">Lange drücken, um den Knopf anzupassen.</span>` : '';
    return `${kopf}<div class="ks-st-haupt" role="region" aria-label="${esc((START_TABS.find(t => t[0] === tab) || START_TABS[0])[1])}" tabindex="0" data-tab="${tab}">${this.startSeite(tab, z, knopf0)}</div>${nav}${schwebend}${hinweis}`;
  };
  P.startSeite = function (tab, z, knopf0) {
    if (tab === 'mehr') return this.startMehr(z, knopf0);
    if (tab !== 'wetter') {
      const t = tab === 'graphs' ? ['Graphs', 'Temperatur, Regen und Wind als Diagramme über mehrere Tage.'] : ['Rad/Sat', 'Regenradar und Satellitenbild auf der Karte.'];
      return `<section class="ks-st-karte"><h3 class="ks-st-karte-titel">${t[0]}</h3><p class="ks-st-text">${t[1]}</p><p class="ks-st-sub">Dieser Bereich der App ist in der Vorschau nicht nachgebaut.</p></section>`;
    }
    const temp = v => v != null && isFinite(v) ? Math.round(v) + '°' : '–', t0 = this.wetter && isFinite(this.wetter.temp) ? +this.wetter.temp : 14;
    const d0 = new Date((this.wetter && this.wetter.zeit) || Date.now()), h0 = d0.getHours(), start = isNaN(h0) ? 10 : h0;
    const code = this.wetter && this.wetter.code != null ? this.wetter.code : 2;
    const stunden = [0, 1, 2, 3, 4, 5].map(i => `<li><span class="ks-st-sub">${i ? ((start + i) % 24) + ' Uhr' : 'Jetzt'}</span>${this.wetterSymbol([code, 2, 3, 3, 61, 3][i], 32)}<b>${temp(t0 + [0, 1, 2, 2, 1, 0][i])}</b></li>`).join('');
    const tage = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = new Date((isNaN(d0.getTime()) ? Date.now() : d0.getTime()) + i * 864e5), nm = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'long' });
      return `<li><span class="ks-st-tag">${esc(nm)}</span>${this.wetterSymbol([code, 3, 61, 2, 0, 3, 61][i], 32)}<span class="ks-st-hl">${temp(t0 + [2, 3, 0, 4, 5, 2, 1][i])} / ${temp(t0 - [6, 5, 7, 6, 8, 7, 6][i])}</span></li>`;
    }).join('');
    const sub = [this.wetter && this.wetter.gefuehlt != null ? 'Gefühlt ' + temp(this.wetter.gefuehlt) : '', this.wetter && this.wetter.wind != null ? 'Wind ' + Math.round(this.wetter.wind) + ' km/h' : ''].filter(Boolean).join(' · ');
    const karten = [
      `<section class="ks-st-karte" data-karte="aktuell"><h3 class="ks-st-karte-titel">Aktuell</h3><div class="ks-st-aktuell">${this.wetterSymbol(code, 64)}<div><p class="ks-st-temp">${temp(this.wetter && this.wetter.temp != null ? this.wetter.temp : t0)}</p><p class="ks-st-lage">${esc((this.wetter && this.wetter.lage) || 'Wetter')}</p></div></div><p class="ks-st-sub">${esc(sub)}</p></section>`,
      `<section class="ks-st-karte" data-karte="stunden"><h3 class="ks-st-karte-titel">Nächste Stunden</h3><ul class="ks-st-stunden">${stunden}</ul></section>`,
      `<section class="ks-st-karte" data-karte="tage"><h3 class="ks-st-karte-titel">7 Tage</h3><ul class="ks-st-tage">${tage}</ul></section>`];
    if (z.ort === 'kachel') {
      const kachel = `<section class="ks-st-karte ks-st-zugangskarte" data-karte="zugang"><div class="ks-st-zk-text"><h3 class="ks-st-karte-titel">Wetterfoto</h3><p class="ks-st-text">Foto machen, Wetter drauf, teilen.</p></div>${knopf0}</section>`;
      karten.splice(z.platz === 'oben' ? 0 : z.platz === 'mitte' ? 1 : karten.length, 0, kachel);
    }
    return karten.join('');
  };
  P.startMehr = function (z, knopf0) {
    const zeile = (id, t, icon) => `<li><button type="button" class="ks-st-zeile" data-akt="start-hinweis" data-wert="${id}" data-fk="start-hinweis:${id}">${ic(icon)}<span>${t}</span>${ic('rechts')}</button></li>`;
    const g = this.nutzerGruppen('einstellungen'), lang = this.nutzerGruppen('lang').zugang;
    let h = '<h2 class="ks-st-seitentitel">Mehr</h2>';
    if (z.ort === 'mehr') h += `<div class="ks-st-zugangszeile">${knopf0}</div>`;
    h += `<ul class="ks-st-liste">${zeile('orte', 'Meine Orte', 'orte')}${zeile('einheiten', 'Einheiten', 'regler')}${zeile('hinweise', 'Hinweise', 'zauber')}</ul>`;
    if (this.nutzerGruppenDa(g)) {
      h += `<section class="ks-st-karte ks-st-wetterfoto"><h3 class="ks-st-karte-titel">Wetterfoto</h3>` +
        `<p class="ks-st-sub">Das gilt nur für dieses Gerät.${lang ? ' Tipp: Den Wetterfoto-Knopf lange drücken öffnet diese Einstellungen auch.' : ''}</p>${this.nutzerGruppenHtml(g)}` +
        `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'nutzer-zuruecksetzen', text: 'Zurücksetzen', klasse: 'ks-flach' })}</div></section>`;
    }
    return h + '<p class="ks-st-sub ks-st-fuss">Vorschau mit Beispieldaten</p>';
  };
  /* Einmalige Frage beim ersten Öffnen (nutzerDarf … 'ersterStart'); gemerkt in ks-nutzer-ersterStart */
  P.ersterStartPruefen = function () {
    if (this.ersterGefragt || this.ui.blatt || !this.startZeigt() || !this.nutzerGruppenDa(this.nutzerGruppen('ersterStart'))) return;
    this.ersterGefragt = true;
    if (this.nutzerLies('ersterStart') != null) return;
    this.nutzerSchreibe('ersterStart', '1');
    this.oeffneBlatt('erster-start');
  };
  /* Antippen des Zugangsknopfs nach zugangAktion */
  P.zugangTippen = function () {
    if (this.langGerade) { this.langGerade = false; return; }   // ein langer Druck hat schon das Menü geöffnet
    const a = this.zugang().aktion;
    if (a === 'kamera') {
      if (!this.an('kamera')) this.zeigeHinweis('Die Kamera ist hier ausgeschaltet.');
      else if (this.o.beispielHaupt && this.o.beispielFoto && !this.quelle) this.startAus();   // Konfigurator: statt Dateidialog das leere Studio mit dem Knopf „Beispielfoto“ zeigen
      else this.$.dateiKamera.click();
    }
    else if (a === 'auswahl') this.oeffneBlatt('zugang-auswahl');
    else if (a === 'sucher') {
      this.startAus();
      if (this.designSucherDa()) this.starteLive(true);
      else if (this.an('liveSucher')) this.starteLive(false);
      else { this.ui.liveFehler = 'Der eigene Sucher ist ausgeschaltet.'; this.zeichneUI(); }
    } else this.startAus();
  };
  /* Langes Drücken (Zeiger), Kontextmenü-Taste und Umschalt+F10 öffnen das kleine Menü, wenn „lang“ erlaubt ist */
  P.langOeffnen = function (knopfEl) {
    if (this.ui.blatt || !this.nutzerGruppen('lang').zugang) return false;
    this.letzterAusloeser = knopfEl && knopfEl.dataset.fk;
    this.oeffneBlatt('zugang-menue'); return true;
  };
  P.langDruck = function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-akt="zugang"]');
    if (!b || !this.root.contains(b) || (ev.pointerType === 'mouse' && ev.button !== 0) || !this.nutzerGruppen('lang').zugang) return;
    const x0 = ev.clientX, y0 = ev.clientY, weg = e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) { clearTimeout(this.langTimer); this.langTimer = null; } };
    const ende = () => {
      clearTimeout(this.langTimer); this.langTimer = null;
      window.removeEventListener('pointerup', ende); window.removeEventListener('pointercancel', ende); window.removeEventListener('pointermove', weg);
      if (this.langGerade) setTimeout(() => { this.langGerade = false; }, 400);   // der Klick nach dem Loslassen kommt sofort; danach gilt wieder normal
    };
    clearTimeout(this.langTimer);
    this.langTimer = setTimeout(() => { this.langTimer = null; if (this.langOeffnen(b)) this.langGerade = true; }, LANG_MS);
    window.addEventListener('pointerup', ende); window.addEventListener('pointercancel', ende); window.addEventListener('pointermove', weg);
  };
  P.zugangMenueTaste = function (ev) {
    const b = ev.target && ev.target.closest && ev.target.closest('[data-akt="zugang"]');
    if (!b || !this.root.contains(b)) return false;
    if ((ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10')) && this.langOeffnen(b)) { ev.preventDefault(); return true; }
    return false;
  };

  /* ---------- Foto laden ---------- */
  P.ladeDatei = async function (datei, o) {
    if (!E()) return;
    this.ui.fehler = null; this.ui.laedt = true; this.zeichneUI();
    try { const q = await E().ladeDatei(datei); this.setzeQuelle(q, o); }
    catch (e) { this.fehler(e, 'Dieses Foto lässt sich nicht öffnen. Wähle bitte ein anderes, zum Beispiel ein JPEG.'); }
  };
  P.ladeBeispiel = async function () {
    const b = this.o.beispielFoto; if (!b || !E()) return;
    this.ui.fehler = null; this.ui.laedt = true; this.zeichneUI();
    try { const q = typeof b === 'string' ? await E().ladeUrl(b) : await E().ladeDatei(b); q.istBeispiel = true; this.setzeQuelle(q); }
    catch (e) { this.fehler(e, 'Das Beispielfoto ließ sich nicht laden.'); }
  };
  P.fehler = function (e, satz) {
    this.ui.laedt = false;
    const text = (e && e.message && /[a-zäöü]/.test(e.message) && e.message.length < 200) ? e.message : satz;
    this.ui.fehler = text;
    this.ereignis({ typ: 'fehler', text });
    this.startAus();   // den Fehler im Studio zeigen, nicht hinter der Startseite
    this.zeichneUI();
    if (this.quelle) this.zeigeHinweis(text, this.an('mediathek') ? { text: 'Anderes Foto', akt: 'foto-waehlen' } : null);
  };
  /* o.design: das Design (Stil, Filter, Format …) bleibt, auch in „Ein-Tipp“; o.spiegeln: Selfie gespiegelt; o.ausGalerie: nicht noch einmal in die Galerie */
  P.setzeQuelle = function (q, o) {
    o = o || {};
    const alt = this.quelle;
    if (alt && alt !== q && E().freigeben) try { E().freigeben(alt); } catch (e) { /* egal */ }
    this.quelle = q; this.ui.laedt = false; this.ui.fehler = null; this.ui.auswahl = null; this.ui.original = false; this.ui.geteilt = false;
    this.startAus();   // ein Foto ist da: von der Startseite ins Studio
    this.ui.wetterQuelle = 'jetzt'; this.ui.wetterAufnahme = null; this.ui.wetterFrage = null; this.ui.altKi = null; this.thumbs = {};
    Object.assign(this.Z, { drehung: 0, spiegeln: !!o.spiegeln, gerade: 0, zuschnitt: null });
    const v = V[this.variante];
    if (o.entwurf) { if (v.nachLaden && this.variante !== 'schnell') v.nachLaden.call(this); this.entwurfAnwenden(o.entwurf); }   // die Vorlage der Ein-Tipp-Karte nicht noch einmal anwenden
    else if (v.nachLaden && !(o.design && this.variante === 'schnell')) v.nachLaden.call(this);
    this.verlaufStart();
    this.ereignis({ typ: 'foto-geladen', breite: q.breite, hoehe: q.hoehe, name: q.name, entwurf: !!o.entwurf });
    this.zeichneUI(); this.nachAenderung(); this.fokusNachLaden();
    if (!o.entwurf) this.wetterZurAufnahme();
    if (!o.ausGalerie) this.galerieOriginalSichern(q);
  };
  /* Nach dem Laden zeichnet das Studio neu; war der Fokus verloren (BODY), geht er an das offene Blatt, sonst an die gewählte oder erste sichtbare Vorlage bzw. das erste sichtbare Werkzeug */
  P.fokusNachLaden = function () {
    const a = document.activeElement;
    if (a && a.isConnected && a !== document.body && a !== document.documentElement) return;   // der Fokus liegt noch irgendwo sinnvoll
    const k = this.root.getBoundingClientRect();
    const imBild = e => {   // ganz im Studio und in jedem rollenden Vorfahren zu sehen
      const q = e.getBoundingClientRect(); if (!(q.width > 0) || q.left < k.left - 1 || q.right > k.right + 1 || q.top < k.top - 1 || q.bottom > k.bottom + 1) return false;
      for (let x = e.parentElement; x && x !== this.root; x = x.parentElement) {
        const c = getComputedStyle(x);
        if (/auto|scroll|hidden/.test(c.overflowX + c.overflowY)) { const p = x.getBoundingClientRect(); if (q.left < p.left - 1 || q.right > p.right + 1 || q.top < p.top - 1 || q.bottom > p.bottom + 1) return false; }
      }
      return true;
    };
    const blatt = this.ui.blatt && this.root.querySelector('.ks-blatt h2');
    const z = blatt || ['[data-akt="vorlage"][aria-pressed="true"]', '[data-akt="vorlage"]', '[data-akt="werkzeug"]', '[data-akt="schnell-teilen"]:not([disabled])', 'button:not([disabled])']
      .map(sel => Array.from(this.root.querySelectorAll(sel)).find(imBild)).find(Boolean);
    if (z) try { z.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  };
  P.entwurfAnwenden = function (e) {
    this.Z = E().neuerZustand ? E().neuerZustand(e.zustand) : tief(e.zustand);   // älterer Stand: fehlende Schlüssel kommen aus dem Standard
    this.ui.vorlage = e.vorlage || this.ui.vorlage; this.ui.autoWerte = e.autoWerte ? tief(e.autoWerte) : null;
    if (e.wetter && Object.keys(e.wetter).length) { this.ui.wetterAufnahme = tief(e.wetter); this.ui.wetterQuelle = 'aufnahme'; }
    this.ui.ansicht = 'bearbeiten';
  };
  /* Wetter zum Aufnahmezeitpunkt: Foto älter als 2 Stunden → ruhig nachfragen */
  P.wetterZurAufnahme = function () {
    const q = this.quelle, x = q && q.exif;
    this.ui.wetterFrage = null;
    if (!this.an('wetterZeitpunkt') || !this.an('daten') || !x || !x.datum || !E().wetterZumZeitpunkt) return;
    const d = new Date(x.datum);
    if (isNaN(d.getTime()) || Date.now() - d.getTime() < 2 * 3600e3) return;
    this.ui.wetterFrage = { text: 'Dieses Foto ist von ' + this.wannText(d) + '. Wetter von damals nehmen?' };
    this.zeichneUI();
  };
  P.wannText = function (d) {
    const h = new Date(), tag = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((tag(h) - tag(d)) / 864e5);
    const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    if (diff === 0) return 'heute, ' + uhr;
    if (diff === 1) return 'gestern, ' + uhr;
    if (diff === 2) return 'vorgestern, ' + uhr;
    const o = { day: 'numeric', month: 'long' }; if (d.getFullYear() !== h.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('de-DE', o) + ', ' + uhr;
  };
  P.wetterDamals = async function () {
    const q = this.quelle, x = q && q.exif; if (!x) return;
    this.ui.wetterFrage = null; this.ui.wetterLaedt = true; this.zeichneUI();
    const ortJetzt = (this.wetter && this.wetter.ort) || {};
    const lat = x.lat != null ? x.lat : ortJetzt.lat, lon = x.lon != null ? x.lon : ortJetzt.lon;
    let w = null;
    try { w = await E().wetterZumZeitpunkt(x.datum, lat, lon); } catch (e) { w = null; }
    this.ui.wetterLaedt = false;
    if (this.quelle !== q) return;
    if (!w) { this.zeichneUI(); this.zeigeHinweis('Das Wetter von damals ist gerade nicht abrufbar.'); return; }
    // Ortsname übernehmen, wenn das Foto in der Nähe des bekannten Orts entstand (≈ 30 km)
    const nah = ortJetzt.lat != null && Math.abs(ortJetzt.lat - lat) < 0.3 && Math.abs(ortJetzt.lon - lon) < 0.4;
    w = Object.assign({}, this.wetter, w, { ort: Object.assign({}, nah ? ortJetzt : {}, w.ort || {}) });
    if (!w.lage && this.wetter) w.lage = '';
    this.ui.wetterAufnahme = w; this.ui.wetterQuelle = 'aufnahme';
    this.zeichneUI(); this.nachAenderung(); this.zeigeHinweis('Wetter von damals übernommen ✓');
  };
  P.frageHtml = function () {
    if (this.ui.wetterLaedt) return `<div class="ks-frage" role="status"><p>Wetter von damals wird geholt …</p></div>`;
    const f = this.ui.wetterFrage; if (!f || !this.quelle) return '';
    return `<div class="ks-frage" role="status"><p>${esc(f.text)}</p><div class="ks-reihe">${knopf({ akt: 'wetter-damals', text: 'Ja', klasse: 'ks-primaer ks-pille' })}${knopf({ akt: 'wetter-jetzt', text: 'Nein, aktuelles Wetter', klasse: 'ks-flach' })}</div></div>`;
  };
  P.verwerfen = function () {
    this.stoppeLive();
    if (this.quelle && E().freigeben) try { E().freigeben(this.quelle); } catch (e) { /* egal */ }
    this.quelle = null; this.layout = null; this.Z = this.neuZ(); this.verlauf = []; this.pos = -1;
    this.ui.auswahl = null; this.ui.ansicht = 'bearbeiten'; this.ui.schritt = 0; this.ui.seite = 'vorne'; this.ui.senden.erg = null; this.ui.senden.key = null; this.ui.geteilt = false;
    this.schliesseBlatt(); this.zeichneUI(); this.zeichnen();
    this.startZeigen();   // „Neu“ führt zurück zur Startseite (nur im Modus „app“)
  };

  /* Einfügen aus der Zwischenablage (z. B. freigestelltes Motiv aus Apple Fotos) */
  P.einfuegenEreignis = function (ev) {
    if (!this.an('einfuegen') || !this.root.isConnected) return;
    const t = ev.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'))) return;
    const items = (ev.clipboardData && ev.clipboardData.items) || [];
    for (const it of items) {
      if (it.kind === 'file' && /^image\//.test(it.type)) { const f = it.getAsFile(); if (f) { ev.preventDefault(); this.eingefuegt(f); return; } }
    }
  };
  P.einfuegenKnopf = async function () {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const typ = it.types.find(t => /^image\//.test(t));
        if (typ) { this.eingefuegt(await it.getType(typ)); return; }
      }
      this.zeigeHinweis('In der Zwischenablage ist kein Bild. Kopiere zuerst ein Foto oder Motiv.');
    } catch (e) { this.zeigeHinweis('Einfügen ging hier nicht. Wähle das Foto stattdessen aus.', this.an('mediathek') ? { text: 'Foto wählen', akt: 'foto-waehlen' } : null); }
  };
  /* Bild als Sticker auf das Foto legen (freigestelltes Motiv: durchsichtiger Hintergrund bleibt, weil PNG) */
  P.alsSticker = async function (blob) {
    if (!this.quelle) { this.ladeDatei(blob); return; }
    try {
      const d = await E().stickerAusBild(blob);
      if (E().bildStickerLaden) await E().bildStickerLaden(d);
      const st = { id: neueId('b'), art: 'bild', bild: d, x: 0.5, y: 0.45, groesse: 1, drehung: 0 };
      this.Z.sticker = (this.Z.sticker || []).concat([st]);
      this.commit('sticker-bild-' + st.id); this.waehle('sticker', st.id); this.haptik(8);
      this.zeigeHinweis('Als Sticker eingefügt – verschieben und vergrößern wie du magst.');
    } catch (e) { this.zeigeHinweis((e && e.laienText) || 'Dieses Bild lässt sich nicht als Sticker einfügen.'); }
  };
  /* A23: Knopf „Motiv aus Fotos wählen“ und bebilderter Hinweis in drei Schritten; Apples Freistellen selbst lässt sich aus dem Web nicht aufrufen */
  P.motivDa = function () { return this.an('einfuegen') && !!this.quelle && !!(E() && E().stickerAusBild); };
  P.motivKnopf = function () { return this.motivDa() ? knopf({ akt: 'motiv-waehlen', text: 'Motiv aus Fotos wählen', icon: 'bild', klasse: 'ks-breit-knopf' }) : ''; };
  P.motivHinweisHtml = function () {
    if (!this.motivDa()) return '';
    const einfuegen = !!(navigator.clipboard && navigator.clipboard.read);
    const s = [
      [MOTIV_BILD.druecken, 'In Fotos das Motiv lange drücken'],
      [MOTIV_BILD.kopieren, '„Kopieren“ antippen'],
      [MOTIV_BILD.einfuegen, einfuegen ? 'Hier „Einfügen“ oder „Motiv aus Fotos wählen“' : 'Hier „Motiv aus Fotos wählen“']
    ];
    return `<div class="ks-motiv-hinweis"><ol class="ks-motiv-schritte">${s.map(([b, t]) => `<li><svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${b}</svg><span>${esc(t)}</span></li>`).join('')}</ol>` +
      `<p class="ks-hilfe ks-hilfe-fest">Nimm „Kopieren“: „Teilen → Bild sichern“ legt das Motiv in Fotos oft mit schwarzem Grund ab (iOS speichert dort ohne Durchsichtigkeit). Das Freistellen macht Apple Fotos selbst – eine Web-App kann es nicht aufrufen.</p></div>`;
  };
  P.eingefuegt = function (blob) {
    if (this.quelle) { this.ui.blattDaten = blob; this.oeffneBlatt('einfuegen-frage'); }
    else this.ladeDatei(blob);
  };

  P.ziehenAblegenEinrichten = function () {
    const r = this.root;
    const darf = ev => this.an('ziehenAblegen') && ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
    r.addEventListener('dragover', ev => { if (!darf(ev)) return; ev.preventDefault(); r.classList.add('ks-zieht-datei'); });
    r.addEventListener('dragleave', ev => { if (ev.target === r || !r.contains(ev.relatedTarget)) r.classList.remove('ks-zieht-datei'); });
    r.addEventListener('drop', ev => {
      r.classList.remove('ks-zieht-datei');
      if (!darf(ev)) return; ev.preventDefault();
      const f = Array.from(ev.dataTransfer.files || []).find(x => /^image\//.test(x.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(x.name));
      if (f) this.eingefuegt(f); else this.zeigeHinweis('Das ist kein Foto. Ziehe bitte eine Bilddatei hierher.');
    });
  };

  /* ---------- Zeichnen (Canvas-Vorschau), gedrosselt per requestAnimationFrame ---------- */
  P.zeichnen = function () {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; try { this.jetztZeichnen(); } catch (e) { console.error('Kamera-Studio: Zeichnen fehlgeschlagen', e); } });
  };
  P.originalPlatz = function () {
    return this.quelle && this.an('vorherNachher') && this.ui.ansicht === 'bearbeiten' && (this.variante === 'werkzeug' || this.variante === 'buehne') ? Math.max(56, ((this.$.zusatz.querySelector('.ks-original') || {}).offsetHeight || 44) + 12) : 0;
  };
  P.einpassen = function (ar, rand) {
    const unten = this.originalPlatz();
    const br = this.$.buehne.clientWidth, bh = this.$.buehne.clientHeight - unten;
    const aw = Math.max(40, br - 2 * rand), ah = Math.max(40, bh - 2 * rand);
    let w = aw, h = aw / ar; if (h > ah) { h = ah; w = ah * ar; }
    w = Math.floor(w); h = Math.floor(h);
    const st = this.$.flaeche.style;
    st.width = w + 'px'; st.height = h + 'px'; st.left = Math.round((br - w) / 2) + 'px'; st.top = Math.round((bh - h) / 2) + 'px';
    return { w, h };
  };
  P.jetztZeichnen = function () {
    const e = E(), q = this.quelle, $ = this.$;
    if ($ && this.ui.ansicht === 'live') this.zeichneSucher();
    if (!$ || !e || !q || this.ui.ansicht === 'live') { if ($) $.flaeche.style.visibility = 'hidden'; return; }
    $.flaeche.style.visibility = 'visible';
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const rand = this.variante === 'buehne' && this.ui.ansicht !== 'zuschneiden' ? 0 : (this.ui.ansicht === 'zuschneiden' ? 28 : (this.layoutArt === 'ks-hoch' ? 12 : 16));
    if (this.ui.ansicht === 'zuschneiden') {
      const d = (this.Z.drehung || 0) % 180 !== 0, ar = d ? q.hoehe / q.breite : q.breite / q.hoehe;
      const g = this.einpassen(ar, rand);
      this.zsErg = e.renderZuschneiden($.cv, q, this.Z, { maxSeite: Math.min(1600, Math.ceil(Math.max(g.w, g.h) * dpr)) });
      const g2 = this.einpassen($.cv.width / $.cv.height, rand);
      this.k = g2.w / $.cv.width;
      this.zeichneZuschnittRahmen();
      return;
    }
    const Zw = this.wirksam(), w = this.aktWetter();
    let ar = 1;
    try { const m = e.masse(q, Zw); ar = m.seitenverhaeltnis || (m.breite / m.hoehe) || 1; } catch (err) { ar = q.breite / q.hoehe; }
    let g = this.einpassen(ar, rand);
    const max = Math.min(1600, Math.ceil(Math.max(g.w, g.h) * dpr));
    const lay = e.render($.cv, q, Zw, w, { maxSeite: max, seite: 'vorne', vorschau: true }) || { breite: $.cv.width, hoehe: $.cv.height, felder: [] };
    const lb = lay.breite || $.cv.width, lh = lay.hoehe || $.cv.height;
    if (Math.abs(lb / lh - ar) > 0.01) g = this.einpassen(lb / lh, rand);
    this.layout = lay; this.k = g.w / lb;
    if ($.cv2 && Zw.postkarte && Zw.postkarte.an && this.an('rueckseite') && !(this.ziehen && this.zeiger.size)) {
      const lh2 = e.render($.cv2, q, Zw, w, { maxSeite: max, seite: 'hinten', vorschau: true });
      this.zeichneFelderHinten(lh2, g.w / ((lh2 && lh2.breite) || $.cv2.width || 1));
    }
    try { $.cv.setAttribute('aria-label', 'Vorschau: ' + (e.altText ? e.altText(Zw, w) : 'Wetterfoto')); } catch (err) { /* egal */ }
    this.zeichneFelder();
  };

  /* Antippbare Flächen über Texten, Stickern, Wetterkarte */
  P.feldName = function (f) {
    if (f.art === 'text') { const t = this.objekt('text', f.id); return 'Text „' + ((t && t.text) || '').slice(0, 30) + '“'; }
    if (f.art === 'sticker') { const s = this.objekt('sticker', f.id); if (s && s.art === 'bild') return 'Eingefügtes Bild'; return 'Sticker ' + (s ? (s.art === 'wetter' ? (liste('WETTER_STICKER').find(x => x.id === s.wert) || { name: s.wert }).name : s.wert) : ''); }
    if (f.art === 'overlay') return 'Wetterkarte';
    return 'Gruß';
  };
  P.zeichneFelder = function () {
    const eb = this.$.ebene; if (!eb) return;
    const fokus = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ks-feld') ? document.activeElement.dataset.feld : null;
    const felder = (this.layout && this.layout.felder) || [], k = this.k || 1, a = this.ui.auswahl;
    const bedienbar = !this.ui.original && this.variante !== 'sucher';
    eb.classList.toggle('ks-ebene-aktiv', bedienbar && !!this.quelle);
    let html = '';
    if (bedienbar) felder.forEach(f => {
      if (f.art === 'overlay' && !this.an('datenFrei')) return;
      if (f.art === 'gruss' && this.variante !== 'postkarte') return;
      if ((f.art === 'text' && !this.an('text')) || (f.art === 'sticker' && !this.objekt('sticker', f.id))) return;
      let x = f.x * k, y = f.y * k, b = f.b * k, h = f.h * k;
      if (b < 44) { x -= (44 - b) / 2; b = 44; }
      if (h < 44) { y -= (44 - h) / 2; h = 44; }
      const sel = a && a.art === f.art && String(a.id) === String(f.id);
      const id = f.art + '|' + f.id;
      html += `<button type="button" class="ks-feld${sel ? ' ks-gewaehlt' : ''}" data-feld="${esc(id)}" aria-pressed="${!!sel}" aria-label="${esc(this.feldName(f))} auswählen" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${b.toFixed(1)}px;height:${h.toFixed(1)}px"></button>`;
    });
    eb.innerHTML = html;
    if (fokus) { const z = eb.querySelector(`[data-feld="${CSS.escape(fokus)}"]`); if (z) z.focus({ preventScroll: true }); }
  };

  P.zeichneFelderHinten = function (lay, k) {
    const eb = this.$.ebene2; if (!eb) return;
    const namen = { 'rueckseite-text': 'Text auf der Rückseite ändern', empfaenger: 'Empfänger ändern', briefmarke: 'Briefmarke ein- oder ausschalten' };
    eb.innerHTML = ((lay && lay.felder) || []).filter(f => namen[f.art]).map(f => {
      let x = f.x * k, y = f.y * k, b = f.b * k, h = f.h * k;
      if (b < 44) { x -= (44 - b) / 2; b = 44; } if (h < 44) { y -= (44 - h) / 2; h = 44; }
      return `<button type="button" class="ks-feld" data-akt="rs-feld" data-wert="${f.art}" aria-label="${namen[f.art]}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${b.toFixed(1)}px;height:${h.toFixed(1)}px"></button>`;
    }).join('');
  };
  P.objekt = function (art, id) {
    if (art === 'text') return (this.Z.texte || []).find(t => String(t.id) === String(id));
    if (art === 'sticker') return (this.Z.sticker || []).find(t => String(t.id) === String(id));
    if (art === 'overlay') return this.Z.overlay.stil !== 'aus' && this.an('daten') ? this.Z.overlay : null;
    if (art === 'gruss') return this.Z.postkarte.an ? this.Z.postkarte : null;
    return null;
  };
  P.waehle = function (art, id) {
    this.ui.auswahl = art ? { art, id } : null;
    this.zeichneUI(); this.zeichneFelder();
  };

  /* ---------- Zeiger: ziehen, zwei Finger, Zuschneide-Rahmen ---------- */
  P.zeigerEinrichten = function () {
    const eb = this.$.ebene; if (!eb) return;
    eb.addEventListener('pointerdown', ev => this.zeigerAb(ev));
    eb.addEventListener('pointermove', ev => this.zeigerBewegt(ev));
    eb.addEventListener('pointerup', ev => this.zeigerAuf(ev));
    eb.addEventListener('pointercancel', ev => this.zeigerAuf(ev, true));
    eb.addEventListener('click', ev => {
      // Tastatur (Enter/Leertaste) auf einem Feld: auswählen bzw. bearbeiten
      if (ev.detail !== 0) return;
      const f = ev.target.closest('.ks-feld'); if (!f) return;
      const [art, id] = f.dataset.feld.split('|');
      const a = this.ui.auswahl;
      if (a && a.art === art && String(a.id) === id) this.bearbeiteAuswahl(); else this.waehle(art, id);
    });
  };
  P.normPunkt = function (ev) {
    const r = this.$.flaeche.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, r };
  };
  P.zeigerAb = function (ev) {
    if (!this.quelle || this.ui.original) return;
    if (ev.button != null && ev.button > 0) return;
    this.zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try { this.$.ebene.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
    if (this.ui.ansicht === 'zuschneiden') { this.zsAb(ev); return; }
    if (this.zeiger.size === 1) {
      const btn = ev.target.closest('.ks-feld');
      if (!btn) { this.ziehen = { leer: true, x0: ev.clientX, y0: ev.clientY, bewegt: false }; return; }
      ev.preventDefault();
      const [art, id] = btn.dataset.feld.split('|');
      const a = this.ui.auswahl, warSchon = !!(a && a.art === art && String(a.id) === id);
      const o = this.objekt(art, id);
      if (!o) return;
      if (art === 'overlay' && o.position !== 'frei') {
        const f = (this.layout.felder || []).find(x => x.art === 'overlay');
        if (f) { o.x = (f.x + f.b / 2) / this.layout.breite; o.y = (f.y + f.h / 2) / this.layout.hoehe; }
      }
      this.ziehen = { art, id, warSchon, x0: ev.clientX, y0: ev.clientY, sx: o.x, sy: o.y, sg: o.groesse || 1, sd: o.drehung || 0, bewegt: false };
      if (!warSchon) this.waehle(art, id);
    } else if (this.zeiger.size === 2 && this.ziehen && !this.ziehen.leer) {
      const [p1, p2] = Array.from(this.zeiger.values());
      const o = this.objekt(this.ziehen.art, this.ziehen.id);
      Object.assign(this.ziehen, { pinch: true, d0: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, w0: Math.atan2(p2.y - p1.y, p2.x - p1.x), sg: (o && o.groesse) || 1, sd: (o && o.drehung) || 0 });
    }
  };
  P.zeigerBewegt = function (ev) {
    if (!this.zeiger.has(ev.pointerId)) return;
    this.zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.ui.ansicht === 'zuschneiden') { this.zsBewegt(ev); return; }
    const z = this.ziehen; if (!z) return;
    const dx = ev.clientX - z.x0, dy = ev.clientY - z.y0;
    if (Math.abs(dx) + Math.abs(dy) > 4) z.bewegt = true;
    if (z.leer) return;
    const o = this.objekt(z.art, z.id); if (!o) return;
    if (this.zeiger.size >= 2 && z.pinch) {
      const [p1, p2] = Array.from(this.zeiger.values());
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y), w = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      o.groesse = klemme(z.sg * d / z.d0, 0.3, 4);
      if (z.art !== 'overlay' && z.art !== 'gruss') o.drehung = Math.round(z.sd + (w - z.w0) * 180 / Math.PI);
      z.bewegt = true;
    } else if (!z.pinch && z.art !== 'gruss') {
      if (z.art === 'overlay') { if (!this.an('datenFrei')) return; o.position = 'frei'; }
      const r = this.$.flaeche.getBoundingClientRect();
      o.x = klemme(z.sx + dx / r.width, 0, 1); o.y = klemme(z.sy + dy / r.height, 0, 1);
    }
    this.zeichnen();
  };
  P.zeigerAuf = function (ev, abbruch) {
    if (!this.zeiger.has(ev.pointerId)) return;
    this.zeiger.delete(ev.pointerId);
    if (this.ui.ansicht === 'zuschneiden') { if (!this.zeiger.size) this.zsAuf(); return; }
    const z = this.ziehen; if (!z) return;
    if (this.zeiger.size) { if (z.pinch) { const [p] = Array.from(this.zeiger.values()); const o = this.objekt(z.art, z.id); z.pinch = false; z.x0 = p.x; z.y0 = p.y; if (o) { z.sx = o.x; z.sy = o.y; } } return; }
    this.ziehen = null;
    if (abbruch) { this.commit('ziehen'); return; }
    if (z.leer) { if (!z.bewegt && this.ui.auswahl) this.waehle(null); return; }
    if (z.bewegt) { this.commit('ziehen-' + z.id); this.zeichneUI(); this.haptik(5); }
    else if (z.warSchon || z.art === 'gruss') this.bearbeiteAuswahl();
  };
  P.bearbeiteAuswahl = function () {
    const a = this.ui.auswahl; if (!a) return;
    if (a.art === 'text') { this.ui.textId = a.id; this.oeffneBlatt('text'); }
    else if (a.art === 'gruss') this.oeffneBlatt('gruss');
    else if (a.art === 'overlay' && this.an('daten')) this.oeffneBlatt('wetter');
  };

  /* Zuschneiden */
  P.zsAkt = function () {
    if (this.Z.zuschnitt) return Object.assign({}, this.Z.zuschnitt);
    const r = this.zsErg; if (!r) return { x: 0, y: 0, b: 1, h: 1 };
    const b = r.bildRechteck, f = r.rahmen;
    return { x: (f.x - b.x) / b.b, y: (f.y - b.y) / b.h, b: f.b / b.b, h: f.h / b.h };
  };
  P.formatVerh = function () {
    const q = this.quelle, Z = this.Z; if (!q) return null;
    if (Z.format === 'frei') return null;
    const d = (Z.drehung || 0) % 180 !== 0, bild = d ? q.hoehe / q.breite : q.breite / q.hoehe;
    let v = Z.format === 'original' ? bild : (FORMAT_V[Z.format] || bild);
    let aus = Z.ausrichtung || 'auto';
    if (aus === 'auto' && Z.format !== 'original') aus = bild >= 1 ? 'quer' : 'hoch';
    if (aus === 'quer' && v < 1) v = 1 / v;
    if (aus === 'hoch' && v > 1) v = 1 / v;
    return v;
  };
  P.zsSetze = function (z) {
    this.Z.zuschnitt = { x: z.x, y: z.y, b: z.b, h: z.h };
    const e = E();
    if (e.zuschnittBegrenzen) {
      try {
        const r = e.zuschnittBegrenzen(this.Z, this.quelle);
        if (r && r.zuschnitt) this.Z.zuschnitt = r.zuschnitt;
        else if (r && r.b != null) this.Z.zuschnitt = r;
      } catch (err) { /* eigene Grenzen gelten */ }
    }
  };
  P.zsAb = function (ev) {
    const t = ev.target.closest('[data-zs]'); if (!t || !this.an('zuschneiden')) return;
    ev.preventDefault();
    const r = this.zsErg; if (!r) return;
    this.zsZug = { modus: t.dataset.zs, p0: this.zsNorm(ev), z0: this.zsAkt() };
  };
  P.zsNorm = function (ev) {
    // Bounding-Rect statt clientWidth: funktioniert auch, wenn der Gerätrahmen per transform skaliert ist
    const p = this.normPunkt(ev), b = this.zsErg.bildRechteck, cv = this.$.cv;
    const kx = cv.width / (p.r.width || 1), ky = cv.height / (p.r.height || 1);
    return { x: (p.x * kx - b.x) / b.b, y: (p.y * ky - b.y) / b.h };
  };
  P.zsBewegt = function (ev) {
    const z = this.zsZug; if (!z) return;
    const p = this.zsNorm(ev), z0 = z.z0, MIN = 0.08;
    let n;
    if (z.modus === 'bewegen') {
      n = { x: klemme(z0.x + p.x - z.p0.x, 0, 1 - z0.b), y: klemme(z0.y + p.y - z.p0.y, 0, 1 - z0.h), b: z0.b, h: z0.h };
    } else {
      const w = z.modus.includes('w'), no = z.modus.includes('n');
      const ax = w ? z0.x + z0.b : z0.x, ay = no ? z0.y + z0.h : z0.y;
      let bb = w ? klemme(ax - p.x, MIN, ax) : klemme(p.x - ax, MIN, 1 - ax);
      let hh = no ? klemme(ay - p.y, MIN, ay) : klemme(p.y - ay, MIN, 1 - ay);
      const v = this.formatVerh();
      if (v) {
        const b = this.zsErg.bildRechteck, rn = v * b.h / b.b;
        if (bb / hh > rn) bb = hh * rn; else hh = bb / rn;
      }
      n = { x: w ? ax - bb : ax, y: no ? ay - hh : ay, b: bb, h: hh };
    }
    this.zsSetze(n);
    this.zeichnen();
  };
  P.zsAuf = function () { if (this.zsZug) { this.zsZug = null; this.commit('zuschnitt'); this.zeichneUI(); } };
  P.zeichneZuschnittRahmen = function () {
    const eb = this.$.ebene, r = this.zsErg; if (!eb || !r) return;
    eb.classList.add('ks-ebene-aktiv');
    const k = this.k || 1, f = r.rahmen;
    const fokus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.zs : null;
    let html = `<div class="ks-zs" style="left:${(f.x * k).toFixed(1)}px;top:${(f.y * k).toFixed(1)}px;width:${(f.b * k).toFixed(1)}px;height:${(f.h * k).toFixed(1)}px">`;
    if (this.an('zuschneiden')) {
      html += `<button type="button" class="ks-zs-flaeche" data-zs="bewegen" aria-label="Zuschnitt verschieben (Pfeiltasten; mit Umschalttaste größer/kleiner)"><span class="ks-raster" aria-hidden="true"></span></button>`;
      html += [['nw', 'oben links'], ['ne', 'oben rechts'], ['sw', 'unten links'], ['se', 'unten rechts']].map(([g, n]) =>
        `<button type="button" class="ks-griff ks-griff-${g}" data-zs="${g}" aria-label="Ecke ${n} ziehen"><span aria-hidden="true"></span></button>`).join('');
    }
    eb.innerHTML = html + '</div>';
    if (fokus) { const z = eb.querySelector(`[data-zs="${fokus}"]`); if (z) z.focus({ preventScroll: true }); }
  };
  P.kopfZuschneiden = function () {
    return this.kopfHtml(knopf({ akt: 'zs-abbrechen', text: 'Abbrechen', klasse: 'ks-flach' }), `<h2 class="ks-titel">Zuschnitt</h2>`,
      knopf({ akt: 'zs-fertig', text: 'Fertig', klasse: 'ks-primaer ks-pille' }));
  };
  P.formatChips = function (mitBild) {
    if (!this.an('formate')) return '';
    return `<div class="ks-chips ks-umbruch" role="group" aria-label="Seitenformat">` + liste('FORMATE').filter(f => this.variante !== 'postkarte' || ['postkarte', 'original', '1:1'].includes(f.id) || true).map(f => {
      const v = FORMAT_V[f.id]; const vor = mitBild && v ? `<span class="ks-format-bild" style="aspect-ratio:${v}" aria-hidden="true"></span>` : '';
      return chip('format', f.id, f.name, this.Z.format === f.id, { html: vor });
    }).join('') + `</div>`;
  };
  P.ausrichtungSeg = function () {
    if (!this.an('formate') || ['original', '1:1', 'frei'].includes(this.Z.format)) return '';
    const v = this.formatVerh(), hoch = v != null && v <= 1;
    return `<div class="ks-segment" role="group" aria-label="Ausrichtung">${chip('ausrichtung', 'hoch', 'Hochformat', hoch)}${chip('ausrichtung', 'quer', 'Querformat', !hoch)}</div>`;
  };
  P.drehKnoepfe = function () {
    const k = [];
    if (this.an('drehen')) k.push(knopf({ akt: 'drehen', text: 'Drehen', icon: 'drehenL', klasse: 'ks-werkzeug', label: 'Um 90 Grad drehen' }));
    if (this.an('spiegeln')) k.push(knopf({ akt: 'spiegeln', text: 'Spiegeln', icon: 'spiegeln', klasse: 'ks-werkzeug', gedrueckt: !!this.Z.spiegeln }));
    return k.length ? `<div class="ks-reihe ks-reihe-mitte">${k.join('')}</div>` : '';
  };
  P.seiteZuschneiden = function () {
    let h = '';
    h += gruppe('', this.hilfe(this.an('zuschneiden') ? 'Zieh an den Ecken oder verschiebe den Rahmen.' : 'Hier kannst du das Foto drehen und das Format wählen.'));
    h += gruppe('Format', this.formatChips(true) + this.ausrichtungSeg());
    h += this.drehKnoepfe();
    if (this.an('gerade')) h += gruppe('', this.regler('gerade', 'Gerade richten', -15, 15, 0.5, ' °'));
    h += `<div class="ks-reihe ks-reihe-mitte">${knopf({ akt: 'zs-zuruecksetzen', text: 'Zurücksetzen', klasse: 'ks-flach' })}</div>`;
    return `<div class="ks-seite-inhalt">${h}</div>`;
  };

  /* ---------- Regler ---------- */
  P.reglerWert = function (id) {
    const Z = this.Z;
    if (id.startsWith('anp.')) return Z.anpassung[id.slice(4)] || 0;
    if (id === 'filterStaerke') return Z.filterStaerke == null ? 100 : Z.filterStaerke;
    if (id === 'gerade') return Z.gerade || 0;
    if (id === 'overlay') return Math.round((Z.overlay.groesse || 1) * 100);
    return 0;
  };
  P.setzeRegler = function (id, v, ohneCommit) {
    const Z = this.Z;
    if (id.startsWith('anp.')) Z.anpassung[id.slice(4)] = v;
    else if (id === 'filterStaerke') Z.filterStaerke = v;
    else if (id === 'gerade') { Z.gerade = v; Z.zuschnitt = null; }
    else if (id === 'overlay') Z.overlay.groesse = v / 100;
    const out = this.root.querySelectorAll(`[data-regler-wert="${id}"]`);
    out.forEach(o => { o.textContent = this.reglerText(id, v); });
    const inp = this.root.querySelector(`[data-regler="${id}"]`);
    if (inp && +inp.value !== v) inp.value = v;
    if (!ohneCommit) this.commit('regler:' + id);
  };
  P.reglerText = function (id, v) {
    const r = this.reglerDef && this.reglerDef[id];
    const ein = r ? r.einheit : '';
    if (id === 'filterStaerke' || id === 'overlay') return Math.round(v) + ' %';
    return (v > 0 && r && r.min < 0 ? '+' : '') + String(v).replace('.', ',') + ein;
  };
  P.regler = function (id, name, min, max, schritt, einheit) {
    this.reglerDef = this.reglerDef || {};
    this.reglerDef[id] = { min, max, schritt, einheit: einheit || '' };
    const v = this.reglerWert(id);
    const dom = 'ks-r-' + id.replace(/\W/g, '') + '-' + (this.nr || (this.nr = ++zaehler));
    return `<div class="ks-regler"><div class="ks-regler-kopf"><label for="${dom}">${esc(name)}</label><output data-regler-wert="${id}" for="${dom}">${esc(this.reglerText(id, v))}</output></div>` +
      `<div class="ks-regler-zeile">${knopf({ akt: 'regler-schritt', wert: id + '|-1', icon: 'minus', label: name + ' weniger', klasse: 'ks-rund ks-flach' })}` +
      `<input type="range" id="${dom}" data-regler="${id}" data-fk="regler:${id}" min="${min}" max="${max}" step="${schritt || 1}" value="${v}" title="Doppeltippen: zurück auf ${id === 'filterStaerke' || id === 'overlay' ? '100' : '0'}">` +
      `${knopf({ akt: 'regler-schritt', wert: id + '|1', icon: 'plus', label: name + ' mehr', klasse: 'ks-rund ks-flach' })}</div></div>`;
  };

  /* ---------- Werkzeug-Felder (von mehreren Varianten genutzt) ---------- */
  P.panelAnpassen = function () {
    let h = this.hilfe('Regler nach rechts: mehr. Doppeltippen setzt zurück.');
    if (this.an('autoVerbessern')) h += `<div class="ks-reihe">${knopf({ akt: 'auto', text: 'Automatisch verbessern', icon: 'zauber', klasse: 'ks-breit-knopf' })}</div>`;
    if (this.an('anpassen')) {
      const ps = ANPASSUNG;   // die Chip-Reihe rollt; bei großer Schrift darf kein Regler verschwinden
      if (!ps.find(p => p[0] === this.ui.param)) this.ui.param = ps[0][0];
      h += `<div class="ks-chips" role="group" aria-label="Was anpassen?">${ps.map(([id, n]) => chip('param', id, n + (this.Z.anpassung[id] ? ' •' : ''), this.ui.param === id)).join('')}</div>`;
      const p = ps.find(x => x[0] === this.ui.param);
      h += this.regler('anp.' + p[0], p[1], p[2], p[3], 1);
    }
    return h;
  };
  P.filterChips = function () {
    if (!this.an('filter')) return '';
    let fl = liste('FILTER'); if (this.gross()) fl = fl.slice(0, 6);
    return `<div class="ks-chips" role="group" aria-label="Filter">${fl.map(f => chip('filter', f.id, f.name, this.Z.filter === f.id)).join('')}</div>`;
  };
  P.panelFilter = function () {
    let h = this.hilfe('Wähle eine Stimmung. Mit „Stärke“ machst du sie schwächer.');
    if (this.an('sw')) h += `<div class="ks-reihe">${knopf({ akt: 'sw', text: 'Schwarz-Weiß', klasse: 'ks-chip' + (/^sw/.test(this.Z.filter) ? ' ks-an' : ''), gedrueckt: /^sw/.test(this.Z.filter) })}</div>`;
    h += this.filterChips();
    if (this.an('filter') && this.Z.filter !== 'keiner') h += this.regler('filterStaerke', 'Stärke', 0, 100, 1);
    h += this.effektChips();
    return h;
  };
  P.effektChips = function () {
    const ef = liste('EFFEKTE').filter(f => f.id === 'keiner' ? (this.an('effekte') || this.an('wetterEffekte')) : EFFEKT_WETTER.includes(f.id) ? (this.an('wetterEffekte') || this.an('effekte')) : this.an('effekte'));
    if (ef.length < 2 || this.gross()) return '';
    return gruppe('Effekt', `<div class="ks-chips" role="group" aria-label="Effekt">${ef.map(f => chip('effekt', f.id, f.name, this.Z.effekt === f.id)).join('')}</div>`);
  };
  P.datenChips = function (kurz) {
    const d = this.Z.daten || {};
    let felder = liste('DATEN_FELDER').filter(f => f.id !== 'logo' || this.an('logo'));
    if (this.an('ortStufen')) felder = felder.filter(f => f.id !== 'ort');
    if (kurz) felder = felder.filter(f => ['temperatur', 'symbol', 'lage', 'ort', 'datum', 'uhrzeit', 'wind', 'logo'].includes(f.id));   // App-Name auch kurz abschaltbar (Entscheidung Nr. 13)
    return `<div class="ks-chips ks-umbruch" role="group" aria-label="Wetterdaten auf dem Bild">` + felder.map(f => {
      const an = f.id === 'ort' ? d.ort !== 'aus' : !!d[f.id];
      return knopf({ akt: 'datum-feld', wert: f.id, gedrueckt: an, klasse: 'ks-chip ks-haken-chip' + (an ? ' ks-an' : ''), html: an ? ic('haken') : '', text: f.id === 'logo' ? this.appName : f.name });
    }).join('') + `</div>` + (!kurz && this.an('logo') && this.an('einfuegen') ? this.hilfe('Eigenes Logo: als Bild einfügen.') : '');
  };
  P.panelWetter = function (kurz) {
    if (!this.an('daten')) return '';
    const Z = this.Z, aus = Z.overlay.stil === 'aus';
    let h = this.hilfe('Tippe an, was auf dem Bild stehen soll.');
    h += schalter('wetter-zeigen', '1', 'Wetterdaten zeigen', !aus);
    if (aus) return h;
    if (this.an('wetterZeitpunkt') && this.ui.wetterAufnahme)
      h += gruppe('Welches Wetter?', `<div class="ks-segment">${chip('wetter-quelle', 'jetzt', 'Jetzt', this.ui.wetterQuelle === 'jetzt')}${chip('wetter-quelle', 'aufnahme', 'Bei der Aufnahme', this.ui.wetterQuelle === 'aufnahme')}</div>`);
    if (this.an('datenEinzeln')) h += gruppe('Was steht auf dem Bild?', this.datenChips(kurz));
    if (this.an('ortStufen')) h += gruppe('Ort', `<div class="ks-segment" role="group" aria-label="Ort">${ORT_STUFEN.map(([id, n]) => chip('ort', id, n, (Z.daten.ort || 'genau') === id)).join('')}</div>` + this.hilfe('„Stadtteil“ zeigt, wo genau du warst. Den GPS-Standort aus dem Foto entfernt das Studio immer.'));
    if (this.an('datenStile') && !kurz) h += gruppe('Aussehen der Wetterkarte', `<div class="ks-chips" role="group" aria-label="Aussehen">${liste('STILE').filter(s => s.id !== 'aus').map(s => chip('stil', s.id, s.name, Z.overlay.stil === s.id)).join('')}</div>`);
    if (!kurz) {
      h += gruppe('Platz', `<div class="ks-chips ks-umbruch" role="group" aria-label="Platz">${POSITIONEN.slice(0, this.gross() ? 2 : 6).map(([id, n]) => chip('position', id, n, Z.overlay.position === id)).join('')}${Z.overlay.position === 'frei' ? chip('position', 'frei', 'Frei', true) : ''}</div>` +
        (this.an('datenFrei') ? this.hilfe('Du kannst die Wetterkarte auch direkt im Bild verschieben.') : ''));
      h += this.regler('overlay', 'Größe', 50, 200, 5);
    }
    return h;
  };
  P.panelText = function () {
    let h = this.hilfe('Tippe auf einen Text im Bild, um ihn zu verschieben. Nochmal tippen: ändern.');
    // Plan 3.10: zwei Reihen kurzer Knöpfe (Text · Sticker · Motiv, dann Einfügen · Mehr); der Vorleser hört die langen Namen, Seltenes steckt hinter „Mehr“
    const k = [], mehr = [];
    if (this.an('text')) k.push(knopf({ akt: 'text-neu', text: 'Text', label: 'Text hinzufügen', icon: 'text', klasse: 'ks-breit-knopf' }));
    if (this.an('sticker') || this.an('emojis')) k.push(knopf({ akt: 'sticker-blatt', text: this.an('sticker') ? 'Sticker' : 'Emoji', icon: 'sticker', klasse: 'ks-breit-knopf' }));
    if (this.motivDa()) k.push(knopf({ akt: 'motiv-waehlen', text: 'Motiv', label: 'Motiv aus Fotos wählen', icon: 'bild', klasse: 'ks-breit-knopf' }));
    if (this.an('einfuegen') && navigator.clipboard && navigator.clipboard.read && E().stickerAusBild) k.push(knopf({ akt: 'einfuegen', text: 'Einfügen', label: 'Aus Zwischenablage einfügen', icon: 'einfuegen', klasse: 'ks-breit-knopf' }));
    if (this.an('postkarte') && this.variante !== 'postkarte') mehr.push(knopf({ akt: 'gruss-an', text: this.Z.postkarte.an ? 'Gruß entfernen' : 'Gruß wie auf Postkarte', icon: 'post', klasse: 'ks-breit-knopf' }));
    if (mehr.length) k.push(knopf({ akt: 'text-mehr', text: 'Mehr', label: 'Mehr zum Hinzufügen', icon: 'mehr', aufgeklappt: !!this.ui.textMehr, klasse: 'ks-breit-knopf' }));
    h += `<div class="ks-text-werkzeuge" role="group" aria-label="Hinzufügen">${k.join('')}</div>`;
    if (mehr.length && this.ui.textMehr) h += `<div class="ks-reihe ks-reihe-umbruch">${mehr.join('')}</div>`;
    if (this.motivDa()) h += this.motivHinweisHtml();
    else if (this.an('einfuegen')) h += this.hilfe('In Fotos: Motiv lange drücken → Kopieren, dann hier „Einfügen“.');
    const t = (this.Z.texte || []).filter(() => this.an('text'));
    if (t.length) h += gruppe('Deine Texte', `<div class="ks-chips ks-umbruch">${t.map(x => chip('text-waehlen', x.id, (x.text || '(leer)').slice(0, 24), false)).join('')}</div>`);
    return h;
  };
  P.panelFormat = function () {
    let h = '';
    if (this.an('formate')) h += gruppe('Seitenformat', this.formatChips(true) + this.ausrichtungSeg());
    if (this.an('rahmen')) h += gruppe('Rahmen', `<div class="ks-chips ks-umbruch">${liste('RAHMEN').map(r => chip('rahmen', r.id, r.name, this.Z.rahmen === r.id)).join('')}</div>`);
    return h;
  };

  /* ---------- Kontextstreifen für das gewählte Element ---------- */
  P.kontextHtml = function () {
    const a = this.ui.auswahl, o = this.objekt(a.art, a.id);
    const name = a.art === 'text' ? 'Text' : a.art === 'sticker' ? 'Sticker' : a.art === 'overlay' ? 'Wetterkarte' : 'Gruß';
    const w = (akt, wert, icon, text, label) => knopf({ akt, wert, icon, text, label, klasse: 'ks-werkzeug' });
    const r1 = [w('el-groesse', '-1', 'minus', 'Kleiner', name + ' kleiner'), w('el-groesse', '1', 'plus', 'Größer', name + ' größer')];
    if (a.art === 'text' || a.art === 'sticker') {
      if (!this.gross()) r1.push(w('el-drehen', '-1', 'drehenL', 'Drehen ↺', name + ' nach links drehen'), w('el-drehen', '1', 'drehenR', 'Drehen ↻', name + ' nach rechts drehen'));
      if (a.art === 'text') r1.push(w('el-bearbeiten', '', 'stift', 'Ändern', 'Text ändern'));
      r1.push(knopf({ akt: 'el-loeschen', icon: 'loeschen', text: 'Löschen', label: name + ' löschen', klasse: 'ks-werkzeug ks-rot' }));
    }
    if (a.art === 'overlay') r1.push(w('el-bearbeiten', '', 'wetter', 'Daten', 'Wetterdaten wählen'));
    if (a.art === 'gruss') r1.push(w('el-bearbeiten', '', 'stift', 'Ändern', 'Gruß ändern'));
    const bew = (a.art !== 'overlay' || this.an('datenFrei')) && a.art !== 'gruss';
    const r2 = bew ? [w('el-bewegen', 'l', 'pfeilL', 'Links', name + ' nach links'), w('el-bewegen', 'o', 'pfeilO', 'Hoch', name + ' nach oben'), w('el-bewegen', 'u', 'pfeilU', 'Runter', name + ' nach unten'), w('el-bewegen', 'r', 'pfeilR', 'Rechts', name + ' nach rechts')] : [];
    return `<div class="ks-kontext" role="toolbar" aria-label="${name} bearbeiten"><div class="ks-kontext-kopf"><strong>${name}</strong>${o && o.groesse ? `<span class="ks-wert">${Math.round(o.groesse * 100)} %</span>` : ''}` +
      `${knopf({ akt: 'el-fertig', text: 'Fertig', klasse: 'ks-primaer ks-pille' })}</div>` +
      this.hilfe('Ziehen verschiebt. Mit zwei Fingern größer machen und drehen.') +
      `<div class="ks-kontext-reihe">${r1.join('')}</div>${r2.length ? `<div class="ks-kontext-reihe">${r2.join('')}</div>` : ''}</div>`;
  };

  /* ---------- Senden ---------- */
  P.erlaubteFormate = function () {
    const fae = this.faeh();
    return ['jpeg', 'png', 'pdf', 'webp'].filter(f => this.an(f) && (f !== 'webp' || fae.webp));
  };
  P.ausgabeFormat = function () {
    const erl = this.erlaubteFormate(); const s = this.ui.senden;
    let f = s.format || this.Z.ausgabe.format;
    if (!s.format && f === 'jpeg' && this.quelle && this.quelle.transparent && erl.includes('png')) f = 'png';   // durchsichtiges Foto (Motiv): PNG, sonst ginge der Grund verloren
    if (!erl.includes(f)) f = erl[0] || 'jpeg';
    return f;
  };
  P.brauchtVorbereitung = function () {
    return !!this.quelle && (this.variante === 'schnell' || this.variante === 'bisher' || (this.variante === 'sucher' && this.ui.ansicht !== 'live'));
  };
  P.planeVorbereitung = function () {
    clearTimeout(this.vorbTimer);
    const s = this.ui.senden;
    if (s.erg || s.laeuft) { s.erg = null; s.key = null; this.sendenAnzeige(); }
    this.vorbTimer = setTimeout(() => this.vorbereiten(), 450);
  };
  P.vorbereiten = async function () {
    if (!this.quelle || !E()) return;
    const s = this.ui.senden, fmt = this.ausgabeFormat();
    const beide = !!(s.beide && this.an('rueckseite') && this.Z.postkarte.an);
    const key = JSON.stringify([this.Z, fmt, s.groesse, beide, this.ui.wetterQuelle]);
    if (s.key === key && (s.erg || s.laeuft)) return;
    s.key = key; s.erg = null; s.laeuft = true; s.fehler = null; this.sendenAnzeige();
    const nr = ++this.exportNr;
    try {
      const groesse = this.an('groesseWaehlen') ? s.groesse : 2160;
      const erg = await E().exportiere(this.quelle, this.wirksam(), this.aktWetter(), { format: fmt, groesse, qualitaet: this.Z.ausgabe.qualitaet || 0.9, beideSeiten: beide });
      if (nr !== this.exportNr) return;
      s.erg = erg;
    } catch (e) {
      if (nr !== this.exportNr) return;
      s.fehler = 'Das Bild konnte nicht erstellt werden. Versuch eine kleinere Größe.'; this.ereignis({ typ: 'fehler', text: s.fehler });
    }
    s.laeuft = false; this.sendenAnzeige();
  };
  P.sendenAnzeige = function () {
    if (this.ui.blatt === 'senden') this.zeichneBlatt();
    if (this.brauchtVorbereitung() || (this.variante === 'assistent' && this.schrittId() === 'senden')) this.zeichneUI();
  };
  // ohneKnoepfe: true = Knöpfe getrennt (Assistent), 'fest' = Dateiname und Knöpfe getrennt (Blatt: unten fest, Plan 3.11)
  P.sendenHtml = function (ohneKnoepfe) {
    const fae = this.faeh(), s = this.ui.senden, fmt = this.ausgabeFormat(), erl = this.erlaubteFormate();
    let h = '';
    if (erl.length > 1) h += gruppe('Dateiart', `<div class="ks-chips ks-umbruch" role="group" aria-label="Dateiart">${erl.map(f => chip('ausgabe', f, AUSGABE[f][0], fmt === f)).join('')}</div>` +
      `<p class="ks-hilfe ks-hilfe-fest">${esc(AUSGABE[fmt][0] + ': ' + AUSGABE[fmt][1])}${fmt === 'pdf' && this.Z.postkarte.an ? ' – Postkarte im Format A6.' : '.'}</p>`);
    if (this.an('webp') && !fae.webp) h += `<p class="ks-hilfe ks-hilfe-fest">WebP kann dieser Browser nicht erzeugen. Nimm JPEG – das kann jedes Gerät öffnen.</p>`;
    if (this.an('groesseWaehlen')) h += gruppe('Größe', `<div class="ks-segment" role="group" aria-label="Größe">${chip('groesse', 1080, 'Normal', s.groesse === 1080)}${chip('groesse', 2160, 'Groß', s.groesse === 2160)}${chip('groesse', 'original', 'Original', s.groesse === 'original')}</div>` + this.hilfe('„Normal“ reicht für Nachrichten, „Groß“ zum Drucken.'));
    if (this.an('rueckseite') && this.an('postkarte') && this.Z.postkarte.an) h += schalter('beide-seiten', '1', 'Rückseite mitsenden', s.beide);
    let status;
    if (s.fehler) status = `<p class="ks-meldung">${esc(s.fehler)}</p>`;
    else if (s.erg) status = `<p class="ks-datei-info">${esc(s.erg.dateiname || 'Datei')} · ${groesseText(s.erg.blob ? s.erg.blob.size : 0)}${s.erg.hinweis ? ' · ' + esc(s.erg.hinweis) : ''}</p>`;
    else status = `<p class="ks-datei-info">Wird vorbereitet …</p>`;
    const bereit = !!s.erg, k = [];
    const kannTeilen = this.kannTeilen();
    if (kannTeilen) k.push(knopf({ akt: 'teilen', text: bereit ? 'Teilen' : 'Wird vorbereitet …', icon: 'teilen', klasse: 'ks-primaer ks-breit-knopf', aus: !bereit }));
    if (this.an('sichern') || (this.an('teilen') && !kannTeilen)) k.push(knopf({ akt: 'sichern', text: bereit ? 'Sichern' : 'Wird vorbereitet …', icon: 'sichern', klasse: (kannTeilen ? '' : 'ks-primaer ') + 'ks-breit-knopf', aus: !bereit }));
    if (this.an('kopieren') && fae.zwischenablageBild !== false && fmt !== 'pdf' && navigator.clipboard) k.push(knopf({ akt: 'kopieren', text: 'Kopieren', icon: 'kopieren', klasse: 'ks-breit-knopf', aus: !bereit }));
    const knoepfe = k.length ? `<div class="ks-senden-knoepfe">${k.join('')}</div>` : `<p class="ks-hilfe ks-hilfe-fest">${this.an('kopieren') && fmt === 'pdf' ? 'Ein PDF lässt sich nicht kopieren. Nimm JPEG oder PNG, um das Bild zu kopieren.' : 'Für das Bild ist gerade kein Weg zum Weitergeben eingeschaltet.'}</p>`;
    if (ohneKnoepfe !== 'fest') h += status + (ohneKnoepfe ? '' : knoepfe);
    else h += status.replace('class="ks-datei-info"', 'class="ks-datei-info ks-nur-quer"');   // quer steht der Dateiname bei den Optionen, damit der feste Fuß flach bleibt (CSS)
    if (this.an('teilen') && this.hilfen.teilenGesperrt) h += `<p class="ks-hilfe ks-hilfe-fest">Teilen geht in der echten App; hier kannst du sichern.</p>`;
    else if (this.an('teilen') && !kannTeilen) h += `<p class="ks-hilfe ks-hilfe-fest">Direktes Teilen geht hier nicht. „Sichern“ legt die Datei ab.</p>`;
    if (s.erg && s.erg.rueckseite) h += `<p class="ks-hilfe ks-hilfe-fest">Zwei Bilder: Vorder- und Rückseite${kannTeilen && !fae.teilenMehrere ? ' – sie werden nacheinander gesichert.' : '.'}</p>`;
    if (this.an('metadatenHinweis')) h += `<p class="ks-hinweis-zeile">${ic('haken')}<span>GPS-Standort und Gerätedaten werden aus dem Bild entfernt. ${esc(this.ortSatz())} Nur was du siehst, wird geteilt.</span></p>`;
    if (this.an('altText') && E().altText) {
      const alt = this.altAktuell();
      if (alt) h += gruppe('Bildbeschreibung', `<p class="ks-alt">${esc(alt)}</p><div class="ks-reihe">${knopf({ akt: 'alt-kopieren', text: 'Beschreibung kopieren', icon: 'kopieren', klasse: 'ks-flach' })}${this.kiKnopf('alt', 'Beschreibung verbessern')}</div>` + this.hilfe('Für Menschen, die das Bild nicht sehen können – zum Einfügen beim Posten.'));
    }
    if (this.an('vorlagenMerken')) h += `<div class="ks-reihe">${knopf({ akt: 'vorlage-merken', text: 'Als meine Vorlage merken', icon: 'merken', klasse: 'ks-flach' })}</div>`;
    return ohneKnoepfe === 'fest' ? { inhalt: h, fuss: status + knoepfe } : ohneKnoepfe ? { inhalt: h, knoepfe } : h;
  };
  // Was der Ort auf dem Bild verrät (Z.daten.ort: genau = Stadtteil, stadt, aus)
  P.ortSatz = function () {
    const o = (this.Z.daten && this.Z.daten.ort) || 'genau';
    if (!this.an('daten') || this.Z.overlay.stil === 'aus' || o === 'aus') return 'Auf dem Bild steht kein Ort.';
    return o === 'stadt' ? 'Auf dem Bild steht nur die Stadt.' : 'Auf dem Bild steht nur der Stadtteil.';
  };
  P.kannTeilen = function () {
    return this.an('teilen') && !this.hilfen.teilenGesperrt && this.faeh().teilenDateien !== false && !!navigator.share;
  };
  P.teilenWort = function () { return this.kannTeilen() ? 'Teilen' : 'Sichern'; };
  P.altAktuell = function () {
    if (this.ui.altKi) return this.ui.altKi;
    try { return E().altText(this.wirksam(), this.aktWetter()); } catch (e) { return ''; }
  };
  P.teilenJetzt = async function () {
    const erg = this.ui.senden.erg; if (!erg) return;
    if (erg.rueckseite && !this.faeh().teilenMehrere) { this.sichernJetzt(); return; }
    let r;
    try { r = await E().teilen(erg, { titel: 'Wetterfoto' }); }
    catch (e) { r = 'nicht-moeglich'; }
    if (r === 'geteilt') { this.zeigeHinweis('Geteilt ✓'); this.haptik(12); this.ereignis({ typ: 'geteilt', format: this.ausgabeFormat() }); this.speichereBearbeitet(erg); this.teilenErledigt(); }
    else if (r === 'gesichert') { this.zeigeHinweis('Gesichert ✓'); this.ereignis({ typ: 'gesichert', format: this.ausgabeFormat() }); this.speichereBearbeitet(erg); this.teilenErledigt(); }
    else if (r === 'nicht-moeglich') this.zeigeHinweis('Teilen ging hier nicht. Nutze „Sichern“.', this.an('sichern') ? { text: 'Sichern', akt: 'sichern' } : null);
  };
  P.sichernJetzt = function () {
    const erg = this.ui.senden.erg; if (!erg) return;
    const dateien = [{ blob: erg.blob, name: erg.dateiname || 'Wetterfoto' }];
    if (erg.rueckseite && erg.rueckseite.blob) dateien.push({ blob: erg.rueckseite.blob, name: erg.rueckseite.dateiname || 'Wetterfoto-Rueckseite' });
    return this.sichereDateien(dateien, () => {
      this.zeigeHinweis(dateien.length > 1 ? 'Beide Seiten gesichert ✓' : 'Gesichert ✓'); this.haptik(10); this.ereignis({ typ: 'gesichert', format: this.ausgabeFormat() });
      this.speichereBearbeitet(erg); this.teilenErledigt();
    });
  };
  // Erst nach dem ersten Teilen, Sichern oder Kopieren bieten die Karten „Weiter mit diesem Design“ und „Neues Foto“ an
  P.teilenErledigt = function () { if (this.ui.geteilt) return; this.ui.geteilt = true; this.zeichneUI(); };
  /* Dateien ablegen: eigener Weg der Seite, sonst Download, sonst Bild zum langen Drücken; ok() bei Erfolg */
  P.sichereDateien = async function (dateien, ok) {
    if (typeof this.hilfen.sichern === 'function') {   // Seite reicht eigenen Weg herein (z. B. im claude.ai-Fenster)
      let r = 'nicht-moeglich';
      for (const d of dateien) { try { r = await this.hilfen.sichern(d.blob, d.name); } catch (e) { r = 'nicht-moeglich'; } if (r !== 'gesichert') break; }
      if (r === 'gesichert') ok(); else if (r !== 'abgebrochen') this.zeigeBilder(dateien);
      return;
    }
    try {
      dateien.forEach((d, i) => setTimeout(() => {
        const url = URL.createObjectURL(d.blob), a = document.createElement('a');
        a.href = url; a.download = d.name; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
      }, i * 450));
      ok();
    } catch (e) { this.zeigeBilder(dateien); }
  };
  /* Rückfall: fertiges Bild zeigen, damit man es per langem Drücken sichern kann */
  P.zeigeBilder = function (dateien) {
    this.zeigUrlsFrei();
    this.zeigUrls = dateien.map(d => ({ url: URL.createObjectURL(d.blob), name: d.name, pdf: /pdf/.test(d.blob.type) }));
    this.oeffneBlatt('bild-zeigen');
  };
  P.zeigUrlsFrei = function () { (this.zeigUrls || []).forEach(u => URL.revokeObjectURL(u.url)); this.zeigUrls = null; };
  P.kiKnopf = function (ziel, text) {
    if (typeof this.hilfen.kiText !== 'function' || !this.an('kiText') || !this.quelle) return '';
    const laeuft = this.ui.kiLaeuft === ziel, f = this.ui.kiFehler && this.ui.kiFehler.ziel === ziel;
    return knopf({ akt: 'ki', wert: ziel, text: laeuft ? 'Schreibe …' : '✨ ' + (text || 'Vorschlag schreiben lassen'), klasse: 'ks-flach ks-ki', aus: !!this.ui.kiLaeuft }) +
      (f ? `<p class="ks-hilfe ks-hilfe-fest" role="status">${esc(this.ui.kiFehler.text)}</p>` : '');
  };
  P.kiSchreiben = async function (ziel) {
    if (this.ui.kiLaeuft || typeof this.hilfen.kiText !== 'function') return;
    const art = ziel === 'alt' ? 'beschreibung' : ziel === 'rs-text' ? 'postkarte' : 'gruss';
    this.ui.kiLaeuft = ziel; this.ui.kiFehler = null; this.zeichneUI(); this.zeichneBlatt();
    let bild = null;
    try { const c = document.createElement('canvas'); E().render(c, this.quelle, this.wirksam(), this.aktWetter(), { maxSeite: 512 }); bild = c.toDataURL('image/jpeg', 0.7); c.width = 0; c.height = 0; } catch (e) { bild = null; }
    try {
      const t = String((await this.hilfen.kiText({ art, wetter: this.aktWetter(), z: this.wirksam(), bildDataUrl: bild })) || '').trim();
      if (!t) throw new Error('leer');
      if (ziel === 'alt') this.ui.altKi = t; else this.eingabeWert(ziel, t);
    } catch (e) { this.ui.kiFehler = { ziel, text: 'Der Vorschlag hat gerade nicht geklappt. Schreib selbst oder versuch es später.' }; }
    this.ui.kiLaeuft = null; this.zeichneUI(); this.zeichneBlatt();
  };
  P.kopierenJetzt = async function () {
    const erg = this.ui.senden.erg; if (!erg) return;
    let ok = false; try { ok = await E().kopieren(erg); } catch (e) { ok = false; }
    this.zeigeHinweis(ok ? 'Kopiert ✓' : 'Kopieren ging hier nicht. Nutze „Sichern“.');
    if (ok) { this.speichereBearbeitet(erg); this.teilenErledigt(); }
  };

  /* ---------- Hinweis (Toast) ---------- */
  P.zeigeHinweis = function (text, aktion) {
    const t = this.$ && this.$.toast; if (!t) return;
    clearTimeout(this.toastTimer);
    t.innerHTML = `<div class="ks-toast-inhalt"><span>${esc(text)}</span>${aktion ? knopf({ akt: aktion.akt, text: aktion.text, klasse: 'ks-flach ks-toast-knopf' }) : ''}</div>`;
    t.classList.add('ks-sichtbar');
    this.toastTimer = setTimeout(() => { t.classList.remove('ks-sichtbar'); setTimeout(() => { if (!t.classList.contains('ks-sichtbar')) t.innerHTML = ''; }, 400); }, aktion ? 6000 : 2800);
  };

  /* ---------- Blätter (Bottom Sheets / Dialoge) ---------- */
  P.oeffneBlatt = function (name) {
    if (!this.ui.blatt) this.blattVorher = { el: document.activeElement, fk: this.letzterAusloeser };
    if (this.$.toast) { clearTimeout(this.toastTimer); this.$.toast.classList.remove('ks-sichtbar'); this.$.toast.innerHTML = ''; }
    this.ui.blatt = name;
    this.hintergrundSperren(true);
    if (name === 'senden') { this.ui.senden.key = null; this.vorbereiten(); }
    this.zeichneBlatt(true);
  };
  /* Solange ein Blatt offen ist, kommt weder Tab noch Vorlesen an die Knöpfe dahinter (inert) */
  P.hintergrundSperren = function (an) {
    ['.ks-app', '.ks-start', '.ks-frei-ebene'].forEach(q => { const e = this.root.querySelector(q); if (e) { if (an) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } });
  };
  P.schliesseBlatt = function () {
    const war = this.ui.blatt; if (!war) return;
    if (war === 'text') {
      const t = this.objekt('text', this.ui.textId);
      if (t && !String(t.text || '').trim()) { this.Z.texte = this.Z.texte.filter(x => x !== t); this.ui.auswahl = null; this.commit('text-leer'); }
    }
    if (war === 'bild-zeigen') this.zeigUrlsFrei();
    if (war === 'galerie-eintrag') this.galAnsichtFrei();
    this.ui.blatt = null; this.ui.blattDaten = null;
    this.hintergrundSperren(false);
    const s = this.$.blatt; s.classList.remove('ks-offen'); s.hidden = true; s.innerHTML = '';
    this.zeichneUI();
    const v = this.blattVorher || {}; this.blattVorher = null;
    // Fokus zurück auf den Auslöser (Safari fokussiert angeklickte Knöpfe nicht → über data-fk wiederfinden)
    let ziel = v.el && v.el.isConnected && this.root.contains(v.el) && v.el !== this.root ? v.el : null;
    if (!ziel && v.fk) ziel = this.root.querySelector(`[data-fk="${CSS.escape(v.fk)}"]`);
    if (ziel) try { ziel.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  };
  /* Wischen nach unten (am Griff oder Kopf) schließt das Blatt; zu kurz, zu langsam: es federt zurück */
  P.blattWischen = function (ev) {
    if (!ev.target.closest('.ks-blatt-griff, .ks-blatt-kopf') || ev.target.closest('button')) return;
    const b = this.$.blatt.querySelector('.ks-blatt'); if (!b || this.root.classList.contains('ks-quer') || this.root.classList.contains('ks-breit')) return;
    const y0 = ev.clientY, t0 = Date.now(); let dy = 0;
    const bewege = e => { dy = Math.max(0, e.clientY - y0); b.style.transition = 'none'; b.style.transform = `translateY(${dy}px)`; };
    const ende = () => {
      document.removeEventListener('pointermove', bewege); document.removeEventListener('pointerup', ende); document.removeEventListener('pointercancel', ende);
      b.style.transition = '';
      if (dy > 90 || (dy > 30 && Date.now() - t0 < 250)) this.schliesseBlatt(); else b.style.transform = '';
    };
    document.addEventListener('pointermove', bewege); document.addEventListener('pointerup', ende); document.addEventListener('pointercancel', ende);
  };
  P.zeichneBlatt = function (neu) {
    const s = this.$.blatt, name = this.ui.blatt;
    if (!name) return;
    const b = BLAETTER[name]; if (!b) return;
    const fokus = neu ? null : this.merkeFokus();
    const titel = typeof b.titel === 'function' ? b.titel.call(this) : b.titel;
    const teile = b.teile ? b.teile.call(this) : { inhalt: b.inhalt.call(this) }, inhalt = teile.inhalt;
    const tid = 'ks-bt-' + (this.nr || (this.nr = ++zaehler));
    s.hidden = false;
    s.innerHTML = `<div class="ks-blatt-hinter" data-akt="blatt-zu" aria-hidden="true"></div>` +
      `<div class="ks-blatt ks-blatt-${name}" role="dialog" aria-modal="true" aria-labelledby="${tid}"><div class="ks-blatt-griff" aria-hidden="true"></div>` +
      `<div class="ks-blatt-kopf"><h2 id="${tid}" tabindex="-1">${esc(titel)}</h2>${knopf({ akt: 'blatt-zu', text: b.kopfZu || 'Fertig', klasse: 'ks-flach ks-blatt-zu', fk: 'fertig' })}</div>` +
      `<div class="ks-blatt-inhalt">${inhalt}</div>${teile.fuss ? `<div class="ks-blatt-fuss">${teile.fuss}</div>` : ''}</div>`;
    requestAnimationFrame(() => s.classList.add('ks-offen'));
    if (neu) {
      const ziel = s.querySelector(b.fokus || '.ks-blatt-inhalt button, .ks-blatt-inhalt textarea, .ks-blatt-inhalt input');
      if (ziel) try { ziel.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    } else this.stelleFokus(fokus);
  };
  P.emojiLeiste = function (ziel) {
    if (!this.an('emojis')) return '';
    const offen = this.ui.emojiOffen === ziel;
    const auf = knopf({ akt: 'emoji-auf', wert: ziel, text: offen ? 'Emojis ausblenden' : 'Emoji einfügen', icon: 'sticker', klasse: 'ks-flach ks-ki', gedrueckt: offen });
    if (!offen) return auf;
    const saetze = emojiSaetze(), i = klemme(this.ui.emojiSatz, 0, saetze.length - 1);
    return auf + `<div class="ks-emoji"><div class="ks-chips" role="group" aria-label="Emoji-Gruppe">${saetze.map((s, n) => chip('emoji-satz', n, s.name, n === i)).join('')}</div>` +
      `<div class="ks-emoji-raster" role="group" aria-label="Emojis ${esc(saetze[i].name)}">${saetze[i].emojis.map(e => `<button type="button" class="ks-emoji-knopf" data-akt="emoji" data-wert="${esc(e)}" data-ziel="${esc(ziel)}" aria-label="Emoji ${esc(e)} einfügen">${esc(e)}</button>`).join('')}</div></div>`;
  };

  const BLAETTER = {
    // Plan 3.11: Optionen oben im Rollbereich, Dateiname und Teilen/Sichern/Kopieren unten fest in der Daumenzone
    senden: { titel: 'Teilen-Optionen', teile() { return this.sendenHtml('fest'); } },
    text: {
      titel() { return 'Text'; }, fokus: 'textarea',
      inhalt() {
        const t = this.objekt('text', this.ui.textId); if (!t) return '<p>Dieser Text existiert nicht mehr.</p>';
        const sch = SCHRIFTEN.filter(s => s[0] !== 'hand' || this.an('handschrift'));
        return `<textarea class="ks-eingabe" rows="3" data-eingabe="text:${esc(t.id)}" data-fk="text:${esc(t.id)}" aria-label="Dein Text" placeholder="Schreib etwas … 😊">${esc(t.text)}</textarea>` +
          this.kiKnopf('text:' + t.id) +
          this.hilfe('Emojis gehen auch über die Tastatur (Weltkugel- oder Smiley-Taste).') +
          this.emojiLeiste('text:' + t.id) +
          gruppe('Schrift', `<div class="ks-chips ks-umbruch" role="group" aria-label="Schrift">${sch.map(([id, n, fam]) => knopf({ akt: 'text-schrift', wert: id, gedrueckt: t.schrift === id, klasse: 'ks-chip ks-schrift-chip' + (t.schrift === id ? ' ks-an' : ''), html: `<span class="ks-probe" style='font-family:${fam}'>Aa</span>`, text: n })).join('')}</div>`) +
          gruppe('Farbe', `<div class="ks-farben" role="group" aria-label="Farbe">${FARBEN.map(([f, n]) => `<button type="button" class="ks-farbe${t.farbe === f ? ' ks-an' : ''}" data-akt="text-farbe" data-wert="${f}" data-fk="text-farbe:${f}" aria-pressed="${t.farbe === f}" aria-label="${n}" title="${n}"><span style="background:${f}"></span></button>`).join('')}</div>`) +
          schalter('text-hinterlegt', '1', 'Hinterlegt (Fläche hinter dem Text)', t.hinterlegt) +
          `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'text-loeschen', text: 'Löschen', icon: 'loeschen', klasse: 'ks-flach ks-rot' })}</div>`;
      }
    },
    gruss: {
      titel: 'Gruß auf der Vorderseite', fokus: 'input',
      inhalt() {
        return `<input type="text" class="ks-eingabe" data-eingabe="gruss" data-fk="gruss" aria-label="Gruß" value="${esc(this.Z.postkarte.gruss)}" placeholder="Grüße aus …">` + this.emojiLeiste('gruss');
      }
    },
    sticker: {
      titel() { return this.an('sticker') ? 'Sticker' : 'Emoji'; },
      inhalt() {
        let h = this.hilfe('Antippen legt den Sticker aufs Bild. Danach kannst du ihn verschieben.');
        if (this.motivDa()) h += gruppe('Eigenes Motiv', `<div class="ks-reihe">${this.motivKnopf()}</div>${this.motivHinweisHtml()}`);
        if (this.an('sticker') && this.an('daten')) h += gruppe('Wetter', `<div class="ks-sticker-raster">${liste('WETTER_STICKER').map(({ id, name: n }) => knopf({ akt: 'sticker-neu', wert: 'wetter|' + id, text: n, klasse: 'ks-sticker-knopf', html: id === 'symbol' && E().symbolSvg ? `<span class="ks-sticker-svg" aria-hidden="true">${E().symbolSvg(this.wetter.code, false)}</span>` : `<span class="ks-sticker-wert" aria-hidden="true">${esc(this.stickerVorschau(id))}</span>` })).join('')}</div>`);
        if (this.an('emojis')) {
          h += emojiSaetze().map(s => gruppe(s.name, `<div class="ks-emoji-raster">${s.emojis.map(e => `<button type="button" class="ks-emoji-knopf" data-akt="sticker-neu" data-wert="emoji|${esc(e)}" aria-label="${esc(e)} als Sticker">${esc(e)}</button>`).join('')}</div>`)).join('');
        }
        return h;
      }
    },
    wetter: { titel: 'Wetterdaten', inhalt() { return this.panelWetter(false) || '<p>Wetterdaten sind ausgeschaltet.</p>'; } },
    filter: { titel: 'Aussehen', inhalt() { return this.panelFilter() + (this.an('anpassen') || this.an('autoVerbessern') ? gruppe('Anpassen', this.panelAnpassen()) : ''); } },
    format: {
      titel: 'Format',
      inhalt() {
        let h = '';
        if (this.an('zuschneiden') || this.an('drehen') || this.an('gerade')) h += `<div class="ks-reihe">${knopf({ akt: 'zs-oeffnen', text: 'Zuschnitt wählen', icon: 'zuschneiden', klasse: 'ks-breit-knopf' })}</div>`;
        return h + this.panelFormat() + this.drehKnoepfe();
      }
    },
    einfach: {
      titel: 'Bearbeiten', fokus: '.ks-blatt-kopf h2',   // nicht ins Textfeld: auf dem iPhone käme sonst gleich die Tastatur
      inhalt() {
        let h = '';
        // Häufigstes zuerst: Dein Text, dann Wetterdaten, dann Format (Plan 21.10.)
        if (this.an('text')) {
          const t = (this.Z.texte || [])[0];
          h += gruppe('Dein Text', `<input type="text" class="ks-eingabe" data-eingabe="schnelltext" data-fk="schnelltext" aria-label="Dein Text" value="${esc(t ? t.text : '')}" placeholder="Zum Beispiel: Endlich Sonne! ☀️">`);
        }
        if (this.an('daten')) h += gruppe('Wetterdaten', this.an('datenEinzeln') ? this.datenChips(true) : schalter('wetter-zeigen', '1', 'Wetterdaten zeigen', this.Z.overlay.stil !== 'aus'));
        if (this.an('formate')) h += gruppe('Format', this.formatChips(true));
        // W6: nach der Vorlage „Postkarte“ den Gruß hier ändern können (gleiches Feld wie im Gruß-Blatt)
        if (this.an('postkarte') && this.Z.postkarte.an) h += gruppe('Gruß auf der Postkarte', `<input type="text" class="ks-eingabe" data-eingabe="gruss" data-fk="gruss" aria-label="Gruß" value="${esc(this.Z.postkarte.gruss)}" placeholder="Grüße aus …">`);
        if (this.ui.autoWerte) h += gruppe('', schalter('auto-verbessert', '1', 'Automatisch verbessert', this.autoAktiv()));
        // Motiv aus Apple Fotos (Entscheidung Nr. 9): in den Apps läuft die Ein-Tipp-Karte, ohne Text-Werkzeug wäre es sonst nicht erreichbar
        if (this.motivDa()) {
          const k = [];
          if (navigator.clipboard && navigator.clipboard.read) k.push(knopf({ akt: 'einfuegen', text: 'Aus Zwischenablage einfügen', icon: 'einfuegen', klasse: 'ks-breit-knopf' }));
          k.push(this.motivKnopf());
          h += gruppe('Motiv aufs Foto', `<div class="ks-reihe ks-reihe-umbruch">${k.join('')}</div><details class="ks-motiv-mehr"><summary>Wie geht das?</summary>${this.motivHinweisHtml()}</details>`);
        }
        if (this.an('vorlagenMerken')) h += `<div class="ks-reihe">${knopf({ akt: 'vorlage-merken', text: 'Als meine Vorlage merken', icon: 'merken', klasse: 'ks-flach' })}</div>${this.hilfe('Nächstes Foto startet so.')}`;
        // A25: aus „Bearbeiten“ in die volle Werkzeugleiste (Entscheidung Nr. 1 und 2)
        if (this.stufeDa()) h += `<div class="ks-reihe ks-profi-zeile">${knopf({ akt: 'stufe', wert: 'profi', fk: 'stufe-profi-blatt', text: 'Alle Werkzeuge (Profi) ›', label: 'Alle Werkzeuge (Profi)', klasse: 'ks-flach ks-breit-knopf' })}</div>`;
        return h;
      }
    },
    'bild-zeigen': {
      titel: 'Bild sichern',
      inhalt() {
        const l = this.zeigUrls || [];
        return `<p class="ks-text">Bild lange drücken (Mac: Rechtsklick) → „Bild sichern“.</p>` +
          l.map(u => u.pdf ? `<p class="ks-meldung">Ein PDF lässt sich hier nicht anzeigen. Wähle JPEG oder PNG und versuch es noch einmal.</p>` : `<img class="ks-zeig-bild" src="${u.url}" alt="${esc(u.name)}">`).join('');
      }
    },
    'verwerfen-frage': {
      titel: 'Alles verwerfen?', kopfZu: 'Abbrechen',
      inhalt() {
        return `<p class="ks-text">Das Foto und alle Änderungen werden entfernt. Das lässt sich nicht rückgängig machen.</p>` +
          `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'verwerfen', text: 'Alles verwerfen', icon: 'loeschen', klasse: 'ks-gefahr' })}</div>`;
      }
    },
    'einfuegen-frage': {
      titel: 'Eingefügtes Bild', kopfZu: 'Abbrechen',
      inhalt() {
        const st = !!(E().stickerAusBild && this.an('einfuegen'));
        return `<p class="ks-text">Wie möchtest du das Bild verwenden?</p>` +
          (st ? `<div class="ks-leer-knoepfe">${knopf({ akt: 'einfuegen-sticker', text: 'Als Sticker auf das Foto', icon: 'sticker', klasse: 'ks-primaer ks-breit-knopf' })}` : '<div class="ks-leer-knoepfe">') +
          `${knopf({ akt: 'einfuegen-ok', text: 'Als neues Foto', icon: 'bild', klasse: (st ? '' : 'ks-primaer ') + 'ks-breit-knopf' })}</div>` +
          (st ? `<p class="ks-hilfe ks-hilfe-fest">Sticker: ideal für ein freigestelltes Motiv aus Apple Fotos oder ein eigenes Logo. „Als neues Foto“ ersetzt das jetzige Foto.</p>` : `<p class="ks-hilfe ks-hilfe-fest">Das jetzige Foto und deine Änderungen werden ersetzt.</p>`);
      }
    },
    galerie: {
      titel: 'Meine Wetterfotos',
      inhalt() {
        const L = this.gal.liste;
        const teil = (art, titel) => { const l = L.filter(e => e.art === art); return l.length ? gruppe(titel, `<div class="ks-galerie-raster">${l.map(e => this.galerieThumb(e)).join('')}</div>`) : ''; };
        return (L.length ? teil('original', 'Originale – zum Neugestalten') + teil('bearbeitet', 'Fertige Fotos – zum Teilen und Sichern') : '<p class="ks-text">Noch nichts gespeichert. Nach dem Teilen oder Sichern erscheint dein Foto hier.</p>') +
          `<p class="ks-hilfe ks-hilfe-fest">${esc(this.galerieHinweisText())}</p>`;
      }
    },
    'galerie-eintrag': {
      titel() { const r = this.gal.ansicht && this.gal.ansicht.rec; return r && r.art === 'bearbeitet' ? 'Fertiges Foto' : 'Originalfoto'; },
      inhalt() {
        const a = this.gal.ansicht, r = a && a.rec; if (!r) return '<p class="ks-text">Dieses Foto gibt es nicht mehr.</p>';
        const orig = r.art === 'original', k = [];
        if (orig) k.push(knopf({ akt: 'galerie-neu', text: 'Neu gestalten', icon: 'regler', klasse: 'ks-primaer ks-breit-knopf' }));
        else {
          if (this.kannTeilen()) k.push(knopf({ akt: 'galerie-teilen', text: 'Teilen', icon: 'teilen', klasse: 'ks-primaer ks-breit-knopf' }));
          k.push(knopf({ akt: 'galerie-sichern', text: 'Sichern', icon: 'sichern', klasse: (this.kannTeilen() ? '' : 'ks-primaer ') + 'ks-breit-knopf' }));
          if (this.entwurfDa(r)) k.push(knopf({ akt: 'galerie-weiter', text: 'Weiter bearbeiten', icon: 'stift', klasse: 'ks-breit-knopf' }));   // A25, Entscheidung Nr. 14
        }
        return `<img class="ks-zeig-bild" src="${a.url}" alt="${esc(this.galerieName(r))}"><p class="ks-datei-info">${esc(this.galerieName(r))} · ${groesseText(r.groesse || (r.blob && r.blob.size) || 0)}</p>` +
          `<div class="ks-senden-knoepfe">${k.join('')}</div><p class="ks-hilfe ks-hilfe-fest">${orig ? 'Dein aktuelles Design wird auf dieses Foto gelegt.' : (this.entwurfDa(r) ? '„Weiter bearbeiten“ öffnet das Original mit genau dieser Gestaltung. ' : '') + esc(this.galerieHinweisText())}</p>` +
          `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'galerie-alle', text: 'Alle Fotos', klasse: 'ks-flach' })}${knopf({ akt: 'galerie-loeschen', text: 'Löschen', icon: 'loeschen', klasse: 'ks-flach ks-rot' })}</div>`;
      }
    },
    nutzer: {
      titel: 'Einstellungen',
      inhalt() {
        return this.hilfe('Das gilt nur für dieses Gerät. „Zurücksetzen“ nimmt alles wieder so, wie es eingestellt war.') + this.nutzerGruppenHtml(this.nutzerGruppen('studio')) + this.nutzerFuss();
      }
    },
    'zugang-auswahl': {
      titel: 'Wetterfoto',
      inhalt() {
        const k = [];
        if (this.an('kamera')) k.push(knopf({ akt: 'za-kamera', text: 'Kamera', icon: 'kamera', klasse: 'ks-primaer ks-breit-knopf' }));
        if (this.an('mediathek')) k.push(knopf({ akt: 'za-mediathek', text: 'Foto wählen', icon: 'bild', klasse: (k.length ? '' : 'ks-primaer ') + 'ks-breit-knopf' }));
        if (this.an('einfuegen') && navigator.clipboard && navigator.clipboard.read) k.push(knopf({ akt: 'za-einfuegen', text: 'Einfügen', icon: 'einfuegen', klasse: 'ks-breit-knopf' }));
        if (this.o.beispielFoto) k.push(knopf({ akt: 'za-beispiel', text: 'Beispielfoto', icon: 'bild', klasse: 'ks-flach ks-breit-knopf' }));
        return `<p class="ks-text">Woher soll das Foto kommen?</p>` + (k.length ? `<div class="ks-leer-knoepfe">${k.join('')}</div>` : `<p class="ks-hilfe ks-hilfe-fest">Alle Fotoquellen sind ausgeschaltet.</p>`);
      }
    },
    'zugang-menue': {
      titel: 'Wetterfoto-Knopf anpassen',
      inhalt() { return this.hilfe('Das gilt nur für dieses Gerät. „Zurücksetzen“ nimmt alles wieder so, wie es eingestellt war.') + this.nutzerGruppenHtml(this.nutzerGruppen('lang')) + this.nutzerFuss(); }
    },
    'erster-start': {
      titel: 'Dein Wetterfoto-Knopf',
      inhalt() {
        const wo = [], d = this.optionen.nutzerDarf || {}, hat = w => ['zugang', 'ausloeser', 'galerie', 'sucher'].some(g => Array.isArray(d[g]) && d[g].includes(w));
        if (hat('einstellungen')) wo.push('unter „Mehr“ bei „Wetterfoto“');
        if (hat('lang')) wo.push('mit langem Druck auf den Knopf');
        if (hat('studio')) wo.push('mit dem Zahnrad im Studio');
        return `<p class="ks-text">Wie soll es für dich aussehen? ${wo.length ? 'Du kannst das später ' + wo.join(' oder ') + ' ändern.' : 'Die Wahl gilt nur für dieses Gerät.'}</p>` +
          this.nutzerGruppenHtml(this.nutzerGruppen('ersterStart')) +
          `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'erster-spaeter', text: 'Später', klasse: 'ks-flach' })}</div>`;
      }
    }
  };
  /* Auswahlfelder für die Nutzer-Einstellungen (Zahnrad, Tab „Mehr“, langes Drücken, erster Start) */
  const segment = (akt, liste, aktuell, name) => `<div class="ks-chips ks-umbruch" role="group" aria-label="${name}">${liste.map(([w, t]) => chip(akt, w, t, String(aktuell) === String(w))).join('')}</div>`;
  P.zugangEinstellHtml = function () {
    const z = this.zugang(), nicht = ZUGANG_NICHT[z.ort] || [], titel = t => `<h3 class="ks-gruppe-titel">${t}</h3>`;
    return gruppe('Wetterfoto-Knopf', titel('Wo sitzt der Knopf?') + segment('nutzer-zugang-ort', ZUGANG_ORTE, z.ort, 'Ort des Knopfs') +
      (ZUGANG_PLAETZE[z.ort].length > 1 ? titel('Welcher Platz?') + segment('nutzer-zugang-platz', ZUGANG_PLAETZE[z.ort], z.platz, 'Platz') : '') +
      titel('Aussehen') + segment('nutzer-zugang-aussehen', ZUGANG_AUSSEHEN.filter(x => !nicht.includes(x[0])), z.aus, 'Aussehen'));
  };
  P.nutzerGruppenHtml = function (g) {
    const seg = segment;
    let h = '';
    if (g.zugang) h += this.zugangEinstellHtml();
    if (g.ausloeser) h += gruppe('Auslöser im Sucher', seg('nutzer-ausloeser', AUSLOESER_ORTE, this.opt('ausloeserOrt'), 'Auslöser') + this.hilfe('„Frei“: den Auslöser im Sucher mit dem Finger verschieben.'));
    if (g.galerie) {
      const an = this.an('galerie');
      h += gruppe('Meine Wetterfotos', seg('nutzer-galerie', [['1', 'An'], ['0', 'Aus']], an ? '1' : '0', 'Meine Wetterfotos') +
        (an ? '<h3 class="ks-gruppe-titel">Originale behalten</h3>' + seg('nutzer-galerie-orig', MENGEN_ORIG.map(n => [n, n === 0 ? 'Keine' : n]), this.opt('galerieOriginale'), 'Anzahl Originale') +
          '<h3 class="ks-gruppe-titel">Fertige Fotos behalten</h3>' + seg('nutzer-galerie-bearb', MENGEN_BEARB.map(n => [n, n === 0 ? 'Keine' : n]), this.opt('galerieBearbeitet'), 'Anzahl fertige Fotos') : '') +
        this.hilfe('Mehr Fotos brauchen mehr Speicher auf diesem Gerät. Safari räumt nach 7 Tagen ohne Nutzung auf, die App auf dem Home-Bildschirm nicht.'));
    }
    if (g.sucher) h += gruppe('Knöpfe im Sucher', SUCHER_SCHALTER.filter(s => this.F[s[0]] !== false).map(s => schalter('nutzer-schalter', s[0], s[1], this.an(s[0]))).join(''));
    return h;
  };
  P.nutzerFuss = function () {
    return `<div class="ks-reihe ks-reihe-ende">${knopf({ akt: 'nutzer-zuruecksetzen', text: 'Zurücksetzen', klasse: 'ks-flach' })}</div>`;
  };
  P.stickerVorschau = function (id) {
    const w = this.aktWetter() || {};
    return { temperatur: (w.temp != null ? Math.round(w.temp) : '–') + '°', ort: (w.ort && w.ort.stadt) || 'Ort', lage: w.lage || 'Wetter', wind: (w.wind != null ? w.wind : '–') + ' km/h' }[id] || '';
  };

  /* ---------- Ereignisse: Klicks ---------- */
  P.klick = function (ev) {
    const el = ev.target.closest('[data-akt]');
    if (!el || !this.root.contains(el) || el.disabled) return;
    const akt = el.dataset.akt, wert = el.dataset.wert;
    if (el.dataset.fk && !el.closest('.ks-blatt')) this.letzterAusloeser = el.dataset.fk;
    const f = AKT[akt];
    if (f) { f.call(this, wert, el, ev); }
  };
  P.neuerText = function (text, y) {
    const t = { id: neueId('t'), text: text || '', x: 0.5, y: y || 0.45, groesse: 1, schrift: 'system', farbe: '#FFFFFF', drehung: 0, hinterlegt: true };
    this.Z.texte = (this.Z.texte || []).concat([t]);
    return t;
  };
  P.elAenderung = function (fn, key) {
    const a = this.ui.auswahl; if (!a) return;
    const o = this.objekt(a.art, a.id); if (!o) return;
    fn(o, a);
    this.commit(key + ':' + a.id); this.zeichneUI();
  };
  P.oeffneZuschneiden = function () {
    this.zsVorher = JSON.stringify(this.Z);
    this.ui.ansicht = 'zuschneiden'; this.ui.auswahl = null;
    this.schliesseBlatt(); this.zeichneUI(); this.zeichnen();
  };
  P.schliesseZuschneiden = function (behalten) {
    if (!behalten && this.zsVorher) { this.Z = JSON.parse(this.zsVorher); this.commit('zs-abbruch'); }
    this.zsVorher = null; this.ui.ansicht = 'bearbeiten';
    if (this.$.ebene) this.$.ebene.innerHTML = '';
    this.zeichneUI(); this.zeichnen();
  };
  P.vorlageLaden = function () { try { const j = localStorage.getItem(this.vorlageSchluessel); return j ? JSON.parse(j) : null; } catch (e) { return null; } };

  const AKT = {
    'foto-waehlen'() { this.$.datei.click(); },
    'foto-kamera'() { this.$.dateiKamera.click(); },
    beispiel() { this.ladeBeispiel(); },
    einfuegen() { this.einfuegenKnopf(); },
    async 'einfuegen-sticker'() {
      const b = this.ui.blattDaten; this.schliesseBlatt(); if (!b) return;
      await this.alsSticker(b);
    },
    'motiv-waehlen'() { this.$.dateiMotiv.click(); },
    'einfuegen-ok'() { const b = this.ui.blattDaten; this.schliesseBlatt(); if (b) this.ladeDatei(b); },
    'verwerfen-frage'() { this.oeffneBlatt('verwerfen-frage'); },
    verwerfen() { this.verwerfen(); this.zeigeHinweis('Verworfen. Du kannst neu beginnen.'); },
    rueck() { this.rueckgaengig(false); },
    vor() { this.rueckgaengig(true); },
    senden() { this.ui.auswahl = null; this.oeffneBlatt('senden'); },
    'blatt-zu'() { this.schliesseBlatt(); },
    teilen() { this.teilenJetzt(); },
    sichern() { this.sichernJetzt(); },
    kopieren() { this.kopierenJetzt(); },
    ki(w) { this.kiSchreiben(w); },
    'wetter-damals'() { this.wetterDamals(); },
    'wetter-jetzt'() { this.ui.wetterFrage = null; this.zeichneUI(); },
    'rs-feld'(w) {
      const sel = { 'rueckseite-text': '[data-eingabe="rs-text"]', empfaenger: '[data-eingabe="rs-empfaenger"]', briefmarke: '[data-akt="rs-schalter"][data-wert="briefmarke"]' }[w];
      const z = sel && this.$.seite.querySelector(sel);
      if (z) { try { z.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* alt */ } z.focus({ preventScroll: true }); z.classList.add('ks-blinkt'); setTimeout(() => z.classList.remove('ks-blinkt'), 900); }
    },
    'alt-kopieren'() {
      const t = this.altAktuell();
      const ok = () => this.zeigeHinweis('Beschreibung kopiert ✓'), nein = () => this.zeigeHinweis('Kopieren ging hier nicht.');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, nein); else nein();
    },
    ausgabe(w) { this.ui.senden.format = w; this.Z.ausgabe.format = w; this.ui.senden.key = null; this.vorbereiten(); this.zeichneBlatt(); this.zeichneUI(); },
    groesse(w) { this.ui.senden.groesse = w === 'original' ? 'original' : +w; this.Z.ausgabe.groesse = this.ui.senden.groesse; this.ui.senden.key = null; this.vorbereiten(); this.zeichneBlatt(); this.zeichneUI(); },
    'beide-seiten'() { this.ui.senden.beide = !this.ui.senden.beide; this.ui.senden.key = null; this.vorbereiten(); this.zeichneBlatt(); this.zeichneUI(); },
    'vorlage-merken'() {
      const v = tief(this.Z); delete v.zuschnitt; delete v.drehung; delete v.spiegeln; delete v.gerade;
      try { localStorage.setItem(this.vorlageSchluessel, JSON.stringify(v)); this.zeigeHinweis('Als deine Vorlage gemerkt ✓'); } catch (e) { this.zeigeHinweis('Merken ging hier nicht (Speicher gesperrt).'); }
      this.thumbs = {}; this.zeichneUI(); if (this.variante === 'schnell') this.planeThumbs();
    },
    /* Bearbeiten */
    format(w) { this.Z.format = w; this.Z.zuschnitt = null; if (w === 'original' || w === '1:1') this.Z.ausrichtung = 'auto'; this.commit('format'); this.zeichneUI(); this.zeichneBlatt(); },
    ausrichtung(w) { this.Z.ausrichtung = w; this.Z.zuschnitt = null; this.commit('ausrichtung'); this.zeichneUI(); this.zeichneBlatt(); },
    drehen() {
      this.Z.drehung = ((this.Z.drehung || 0) + 270) % 360; this.Z.zuschnitt = null;
      if (this.Z.ausrichtung !== 'auto') this.Z.ausrichtung = this.Z.ausrichtung === 'hoch' ? 'quer' : 'hoch';
      this.commit('drehen-' + Date.now()); this.haptik(6); this.zeichneUI();
    },
    spiegeln() { this.Z.spiegeln = !this.Z.spiegeln; if (this.Z.zuschnitt) this.Z.zuschnitt.x = 1 - this.Z.zuschnitt.x - this.Z.zuschnitt.b; this.commit('spiegeln-' + Date.now()); this.zeichneUI(); },
    'zs-oeffnen'() { this.oeffneZuschneiden(); },
    'zs-abbrechen'() { this.schliesseZuschneiden(false); },
    'zs-fertig'() { this.schliesseZuschneiden(true); },
    'zs-zuruecksetzen'() { Object.assign(this.Z, { drehung: 0, spiegeln: false, gerade: 0, zuschnitt: null, ausrichtung: 'auto' }); if (this.variante !== 'postkarte') this.Z.format = 'original'; this.commit('zs-reset'); this.zeichneUI(); },
    'regler-schritt'(w) {
      const [id, d] = w.split('|'), def = (this.reglerDef || {})[id] || { min: -100, max: 100, schritt: 1 };
      const st = id === 'gerade' ? 1 : (id === 'overlay' ? 10 : 5);
      this.setzeRegler(id, klemme(this.reglerWert(id) + st * (+d), def.min, def.max));
    },
    param(w) { this.ui.param = w; this.zeichneUI(); this.zeichneBlatt(); },
    auto() {
      try { const t = E().autoVerbessern(this.quelle); if (t) mische(this.Z, t); } catch (e) { return; }
      this.commit('auto-' + Date.now()); this.zeichneUI(); this.zeichneBlatt();
      this.zeigeHinweis('Automatisch verbessert', this.an('rueckgaengig') ? { text: 'Rückgängig', akt: 'rueck' } : null);
    },
    filter(w) { this.Z.filter = w; this.commit('filter'); this.zeichneUI(); this.zeichneBlatt(); },
    sw() { this.Z.filter = /^sw/.test(this.Z.filter) ? 'keiner' : 'sw'; this.commit('sw-' + Date.now()); this.zeichneUI(); this.zeichneBlatt(); },
    effekt(w) { this.Z.effekt = w; this.commit('effekt'); this.zeichneUI(); this.zeichneBlatt(); },
    rahmen(w) { this.Z.rahmen = w; this.commit('rahmen'); this.zeichneUI(); this.zeichneBlatt(); },
    /* Wetterdaten */
    'auto-verbessert'() {
      const w = this.ui.autoWerte; if (!w) return;
      const an = !this.autoAktiv();
      AUTO_WERTE.forEach(k => { this.Z.anpassung[k] = an ? (w[k] || 0) : 0; });
      this.commit('auto-schalter-' + Date.now()); this.zeichneUI(); this.zeichneBlatt();
    },
    'wetter-zeigen'() { this.Z.overlay.stil = this.Z.overlay.stil === 'aus' ? (this.letzterStil || 'glas') : (this.letzterStil = this.Z.overlay.stil, 'aus'); this.commit('wz-' + Date.now()); this.zeichneUI(); this.zeichneBlatt(); },
    'wetter-quelle'(w) { this.ui.wetterQuelle = w; this.nachAenderung(); this.zeichneUI(); this.zeichneBlatt(); },
    'datum-feld'(w) {
      const d = this.Z.daten;
      if (w === 'ort') d.ort = d.ort === 'aus' ? 'genau' : 'aus'; else d[w] = !d[w];   // Ort wieder an = Standard Stadtteil (Entscheidung Nr. 5)
      this.commit('daten-' + w + Date.now()); this.zeichneUI(); this.zeichneBlatt(); this.zeichneLiveOverlay();
    },
    ort(w) { this.Z.daten.ort = w; this.commit('ort'); this.zeichneUI(); this.zeichneBlatt(); },
    stil(w) { this.Z.overlay.stil = w; this.commit('stil'); this.zeichneUI(); this.zeichneBlatt(); },
    position(w) { this.Z.overlay.position = w; this.commit('position'); this.zeichneUI(); this.zeichneBlatt(); },
    /* Text, Sticker */
    'text-neu'() { const t = this.neuerText(''); this.ui.textId = t.id; this.ui.auswahl = { art: 'text', id: t.id }; this.commit('text-neu-' + t.id); this.oeffneBlatt('text'); },
    'text-waehlen'(w) { this.waehle('text', w); },
    'text-schrift'(w) { const t = this.objekt('text', this.ui.textId); if (t) { t.schrift = w; this.commit('ts'); this.zeichneBlatt(); } },
    'text-farbe'(w) { const t = this.objekt('text', this.ui.textId); if (t) { t.farbe = w; this.commit('tf'); this.zeichneBlatt(); } },
    'text-hinterlegt'() { const t = this.objekt('text', this.ui.textId); if (t) { t.hinterlegt = !t.hinterlegt; this.commit('th' + Date.now()); this.zeichneBlatt(); } },
    'text-loeschen'() { this.Z.texte = this.Z.texte.filter(t => String(t.id) !== String(this.ui.textId)); this.ui.auswahl = null; this.commit('text-weg'); this.schliesseBlatt(); this.zeigeHinweis('Text gelöscht', this.an('rueckgaengig') ? { text: 'Rückgängig', akt: 'rueck' } : null); },
    'emoji-auf'(w) { this.ui.emojiOffen = this.ui.emojiOffen === w ? null : w; this.zeichneBlatt(); this.zeichneUI(); },
    'emoji-satz'(w) { this.ui.emojiSatz = +w; this.zeichneBlatt(); this.zeichneUI(); },
    emoji(w, el) {
      const ziel = el.dataset.ziel, inp = this.root.querySelector(`[data-eingabe-ziel="${CSS.escape(ziel)}"], [data-eingabe="${CSS.escape(ziel)}"]`);
      if (!inp) return;
      const fokus = document.activeElement === inp;   // ohne Fokus (Knopf angetippt, Blatt neu gezeichnet) ans Ende anhängen
      const m = this.marken[ziel], gemerkt = m && m[2] === inp.value ? m : null;
      const s = fokus && inp.selectionStart != null ? inp.selectionStart : (gemerkt ? gemerkt[0] : inp.value.length), e = fokus && inp.selectionEnd != null ? inp.selectionEnd : (gemerkt ? gemerkt[1] : s);
      inp.value = inp.value.slice(0, s) + w + inp.value.slice(e);
      try { inp.setSelectionRange(s + w.length, s + w.length); } catch (err) { /* egal */ }
      this.marken[ziel] = [s + w.length, s + w.length, inp.value];
      this.eingabeWert(ziel, inp.value);
    },
    'sticker-blatt'() { this.oeffneBlatt('sticker'); },
    'sticker-neu'(w) {
      const i = w.indexOf('|'), art = w.slice(0, i), wert = w.slice(i + 1);
      const n = (this.Z.sticker || []).length;
      const st = { id: neueId('s'), art, wert, x: 0.5 + ((n % 3) - 1) * 0.12, y: 0.35 + (n % 2) * 0.1, groesse: 1, drehung: 0 };
      this.Z.sticker = (this.Z.sticker || []).concat([st]);
      this.commit('sticker-neu-' + st.id); this.schliesseBlatt(); this.ui.leistenPanel = null; this.waehle('sticker', st.id); this.haptik(6);
    },
    'text-mehr'() { this.ui.textMehr = !this.ui.textMehr; this.zeichneUI(); },
    'gruss-an'() { this.Z.postkarte.an = !this.Z.postkarte.an; this.commit('gruss-an'); this.zeichneUI(); },
    /* Kontextstreifen */
    'el-fertig'() { this.waehle(null); },
    'el-groesse'(w) { this.elAenderung(o => { o.groesse = klemme(Math.round((o.groesse || 1) * (w === '1' ? 1.15 : 0.87) * 100) / 100, 0.3, 4); }, 'el-gr'); },
    'el-drehen'(w) { this.elAenderung(o => { o.drehung = ((o.drehung || 0) + (w === '1' ? 15 : -15)); }, 'el-dr'); },
    'el-bewegen'(w) { this.bewegeAuswahl(w, 0.03); },
    'el-bearbeiten'() { this.bearbeiteAuswahl(); },
    'el-loeschen'() {
      const a = this.ui.auswahl; if (!a) return;
      if (a.art === 'text') this.Z.texte = this.Z.texte.filter(t => String(t.id) !== String(a.id));
      if (a.art === 'sticker') this.Z.sticker = this.Z.sticker.filter(t => String(t.id) !== String(a.id));
      this.ui.auswahl = null; this.commit('el-weg'); this.zeichneUI();
      this.zeigeHinweis('Gelöscht', this.an('rueckgaengig') ? { text: 'Rückgängig', akt: 'rueck' } : null);
    },
    /* Variantenspezifisch */
    werkzeug(w) { if (w === 'ausschnitt') { this.oeffneZuschneiden(); return; } this.ui.werkzeug = this.ui.werkzeug === w && this.variante === 'buehne' ? null : w; this.ui.auswahl = null; this.zeichneUI(); },
    leiste(w) {
      this.ui.auswahl = null;
      if (w === 'text') AKT['text-neu'].call(this);
      else if (w === 'sticker') this.oeffneBlatt('sticker');
      else if (w === 'wetter') this.oeffneBlatt('wetter');
      else if (w === 'filter') { this.ui.leistenPanel = this.ui.leistenPanel === 'filter' ? null : 'filter'; this.zeichneUI(); }
      else if (w === 'format') this.oeffneBlatt('format');
    },
    original(w, el, ev) { if (ev && ev.detail !== 0) return; this.ui.original = !this.ui.original; this.zeichneUI(); this.zeichnen(); },
    vorlage(w) { this.wendeVorlageAn(w); },
    'anpassen-einfach'() { this.oeffneBlatt('einfach'); },
    'schnell-teilen'() { const s = this.ui.senden; if (!s.erg) return; if (this.kannTeilen()) this.teilenJetzt(); else this.sichernJetzt(); },
    'schritt-vor'() { this.geheSchritt(1); },
    'schritt-zurueck'() { this.geheSchritt(-1); },
    'seite-wahl'(w) { this.wende(w); },
    wenden() { this.wende(this.ui.seite === 'vorne' ? 'hinten' : 'vorne'); },
    'rs-schalter'(w) { const r = this.Z.postkarte.rueckseite; r[w] = !r[w]; this.commit('rs-' + w + Date.now()); this.zeichneUI(); },
    'gruss-blatt'() { this.oeffneBlatt('gruss'); },
    'live-start'() { this.starteLive(false); },
    'live-stopp'() { this.sucherVerlassen(); },
    ausloesen() { this.ausloesenKlick(); },
    /* Nach dem Foto */
    'weiter-foto'() { this.starteLive(true); },
    'neu-kamera'() { this.$.dateiKamera.click(); },
    /* Sucher-Knöpfe */
    's-kamera'() { this.sucherKameraWechsel(); },
    's-zoom'(w) { this.sucherZoom(+w); },
    's-licht'() { this.sucherLicht(); },
    's-timer'() { const S = this.ui.sucher; S.timer = { 0: 3, 3: 10 }[S.timer] || 0; this.zeichneUI(); },
    's-raster'() { const S = this.ui.sucher; S.raster = !S.raster; this.zeichneUI(); },
    's-waage'() { this.sucherWaage(); },
    's-format'() { this.sucherFormat(); },
    's-spiegeln'() { const S = this.ui.sucher; S.spiegeln = !S.spiegeln; this.zeichneUI(); },
    's-ton'() { const S = this.ui.sucher; S.ton = !S.ton; this.zeichneUI(); },
    /* Meine Wetterfotos */
    'galerie-alle'() { if (this.ui.blatt === 'galerie-eintrag') this.galAnsichtFrei(); this.oeffneBlatt('galerie'); },
    'galerie-eintrag'(w) { this.oeffneGalerieEintrag(w); },
    async 'galerie-neu'() {
      const r = this.gal.ansicht && this.gal.ansicht.rec; if (!r) return;
      const datei = new File([r.blob], r.name || 'Foto.jpg', { type: r.blob.type || 'image/jpeg' });
      this.schliesseBlatt(); this.ladeDatei(datei, { design: true, ausGalerie: true });
    },
    'galerie-weiter'() { const r = this.gal.ansicht && this.gal.ansicht.rec; if (!r) return; this.schliesseBlatt(); this.weiterBearbeiten(r); },
    async 'galerie-teilen'() {
      const r = this.gal.ansicht && this.gal.ansicht.rec; if (!r) return;
      let s; try { s = await E().teilen({ blob: r.blob, mime: r.blob.type, dateiname: r.name || 'Wetterfoto.jpg' }, { titel: 'Wetterfoto' }); } catch (e) { s = 'nicht-moeglich'; }
      if (s === 'geteilt') this.zeigeHinweis('Geteilt ✓'); else if (s === 'gesichert') this.zeigeHinweis('Gesichert ✓'); else if (s === 'nicht-moeglich') this.zeigeHinweis('Teilen ging hier nicht. Nutze „Sichern“.');
    },
    'galerie-sichern'() {
      const r = this.gal.ansicht && this.gal.ansicht.rec; if (!r) return;
      this.sichereDateien([{ blob: r.blob, name: r.name || 'Wetterfoto.jpg' }], () => this.zeigeHinweis('Gesichert ✓'));
    },
    async 'galerie-loeschen'() {
      const r = this.gal.ansicht && this.gal.ansicht.rec; if (!r) return;
      this.schliesseBlatt();
      try { await E().galerie.loesche(r.id); } catch (e) { /* war schon weg */ }
      this.gal.geloescht = r; await this.galerieLaden();
      this.zeigeHinweis('Foto gelöscht', { text: 'Rückgängig', akt: 'galerie-zurueck' });
    },
    async 'galerie-zurueck'() {
      const r = this.gal.geloescht; if (!r) return;
      this.gal.geloescht = null;
      try { await E().galerie.setzeZurueck(r); } catch (e) { this.zeigeHinweis('Das Foto ließ sich nicht wiederherstellen.'); return; }
      await this.galerieLaden(); this.zeigeHinweis('Wiederhergestellt ✓');
    },
    /* Zahnrad „Anpassen“ */
    'nutzer-oeffnen'() { this.oeffneBlatt('nutzer'); },
    'nutzer-ausloeser'(w) { this.nutzerSchreibe('ausloeserOrt', w); this.nutzerAnwenden(); },
    'nutzer-galerie'(w) { this.nutzerSchreibe('galerie', w); this.nutzerAnwenden(true); },
    'nutzer-galerie-orig'(w) { this.nutzerSchreibe('galerieOriginale', w); this.nutzerAnwenden(true); },
    'nutzer-galerie-bearb'(w) { this.nutzerSchreibe('galerieBearbeitet', w); this.nutzerAnwenden(true); },
    'nutzer-schalter'(w) { this.nutzerSchreibe(w, this.an(w) ? '0' : '1'); this.nutzerAnwenden(); },
    'nutzer-zuruecksetzen'() { ['ausloeserOrt', 'galerie', 'galerieOriginale', 'galerieBearbeitet', 'zugangOrt', 'zugangPlatz', 'zugangAussehen'].concat(SUCHER_SCHALTER.map(s => s[0])).forEach(k => this.nutzerSchreibe(k, null)); this.nutzerAnwenden(true); },
    'nutzer-zugang-ort'(w) {   // beim Ortswechsel gilt der Standardplatz des neuen Orts (oder der Platz der Seite, wenn der Ort wieder der der Seite ist)
      this.nutzerSchreibe('zugangOrt', w); this.nutzerSchreibe('zugangPlatz', w === this.optionen.zugangOrt ? this.optionen.zugangPlatz : ZUGANG_PLATZ_STD[w]); this.nutzerAnwenden();
    },
    'nutzer-zugang-platz'(w) { this.nutzerSchreibe('zugangPlatz', w); this.nutzerAnwenden(); },
    'nutzer-zugang-aussehen'(w) { this.nutzerSchreibe('zugangAussehen', w); this.nutzerAnwenden(); },
    zugang() { this.zugangTippen(); },
    'start-tab'(w) { this.ui.stTab = w; this.zeichneStart(); },
    'start-hinweis'() { this.zeigeHinweis('Das ist nur ein Nachbau der Startseite.'); },
    'zur-start'() { this.startZeigen(); },
    'za-kamera'() { this.schliesseBlatt(); this.$.dateiKamera.click(); },
    'za-mediathek'() { this.schliesseBlatt(); this.$.datei.click(); },
    'za-einfuegen'() { this.schliesseBlatt(); this.einfuegenKnopf(); },
    'za-beispiel'() { this.schliesseBlatt(); this.ladeBeispiel(); },
    'erster-spaeter'() { this.schliesseBlatt(); },
    stufe(w) { this.stufeWechseln(w); },
    'zu-werkzeug'() { this.variante = 'werkzeug'; this.ui.auswahl = null; this.aufbauen(); this.nachAenderung(); this.ereignis({ typ: 'variante', variante: 'werkzeug' }); },
    'neues-foto'() { this.verwerfen(); }
  };

  P.bewegeAuswahl = function (r, schritt) {
    const a = this.ui.auswahl; if (!a || a.art === 'gruss') return;
    if (a.art === 'overlay' && !this.an('datenFrei')) return;
    this.elAenderung(o => {
      if (a.art === 'overlay' && o.position !== 'frei') {
        const f = ((this.layout && this.layout.felder) || []).find(x => x.art === 'overlay');
        if (f) { o.x = (f.x + f.b / 2) / this.layout.breite; o.y = (f.y + f.h / 2) / this.layout.hoehe; }
        o.position = 'frei';
      }
      if (r === 'l') o.x = klemme(o.x - schritt, 0, 1); if (r === 'r') o.x = klemme(o.x + schritt, 0, 1);
      if (r === 'o') o.y = klemme(o.y - schritt, 0, 1); if (r === 'u') o.y = klemme(o.y + schritt, 0, 1);
    }, 'el-bew');
  };

  /* ---------- Eingaben (Textfelder, Regler) ---------- */
  P.eingabe = function (ev) {
    const t = ev.target;
    if (t.dataset.regler && ev.type === 'input') { this.setzeRegler(t.dataset.regler, +t.value); return; }
    if (t.dataset.eingabe && ev.type === 'input') this.eingabeWert(t.dataset.eingabe, t.value);
  };
  P.eingabeWert = function (name, wert) {
    const Z = this.Z, rs = Z.postkarte.rueckseite;
    if (name.startsWith('text:')) { const o = this.objekt('text', name.slice(5)); if (o) o.text = wert; }
    else if (name === 'gruss' || name === 'gruss-inline') Z.postkarte.gruss = wert;
    else if (name === 'rs-text') rs.text = wert;
    else if (name === 'rs-unterschrift') rs.unterschrift = wert;
    else if (name === 'rs-empfaenger') rs.empfaenger = wert;
    else if (name === 'schnelltext') {
      let t = (Z.texte || [])[0];
      if (!t && wert) t = this.neuerText('', 0.14);
      if (t) t.text = wert;
      if (t && !wert) Z.texte = Z.texte.filter(x => x !== t);
    }
    this.commit('eingabe:' + name);
  };

  /* ---------- Tastatur ---------- */
  P.taste = function (ev) {
    // Tasten gelten, wenn der Fokus im Studio liegt – oder nirgends (Safari fokussiert angeklickte Knöpfe nicht).
    if (!this.root.isConnected) return;
    // Offenes Blatt ist modal: Esc gilt überall, Tab kreist im Blatt
    if (this.ui.blatt && (ev.key === 'Escape' || ev.key === 'Tab')) {
      const bl = this.$.blatt.querySelector('.ks-blatt');
      if (ev.key === 'Escape') { ev.preventDefault(); this.schliesseBlatt(); return; }
      const f = bl ? Array.from(bl.querySelectorAll('button, input, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.getClientRects().length) : [];
      if (f.length) {
        const i = f.indexOf(document.activeElement);
        // immer selbst weiterschalten (Safari überspringt Knöpfe beim Tabben sonst)
        ev.preventDefault(); f[ev.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1)].focus();
      }
      return;
    }
    if (this.zugangMenueTaste(ev)) return;
    const imStudio = this.root.contains(ev.target);
    if (!imStudio && !(ev.target === document.body || ev.target === document.documentElement)) return;
    if (!imStudio && document.querySelectorAll('.ks').length > 1 && !this.root.matches(':hover') && !this.ui.blatt) return;
    const t = ev.target, schreibt = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range'));
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && (ev.key === 'z' || ev.key === 'Z') && !schreibt) { ev.preventDefault(); this.rueckgaengig(ev.shiftKey); return; }
    if (mod && ev.key === 'y' && !schreibt) { ev.preventDefault(); this.rueckgaengig(true); return; }
    if (ev.key === 'Escape') {
      if (this.ui.blatt) { ev.preventDefault(); this.schliesseBlatt(); return; }
      if (this.ui.ansicht === 'zuschneiden') { ev.preventDefault(); this.schliesseZuschneiden(false); return; }
      if (this.ui.auswahl) { ev.preventDefault(); this.waehle(null); return; }
      if (this.ui.ansicht === 'live') {
        ev.preventDefault();
        if (this.ui.countdown) { this.stoppeCountdown(); this.zeichneUI(); } else this.sucherVerlassen();
      }
      return;
    }
    // Auslöser „frei“: Pfeiltasten verschieben ihn (Alternative zum Ziehen)
    if (this.ui.ansicht === 'live' && t && t.dataset && t.dataset.akt === 'ausloesen' && this.opt('ausloeserOrt') === 'frei' && this.freiTaste(ev)) return;
    const pf = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'o', ArrowDown: 'u' }[ev.key];
    if (!pf || schreibt || (t && t.type === 'range')) return;
    if (this.ui.ansicht === 'zuschneiden' && t.dataset && t.dataset.zs) {
      ev.preventDefault();
      const z = this.zsAkt(), s = 0.02;
      if (ev.shiftKey) { const d = (pf === 'r' || pf === 'u') ? s : -s; const v = this.formatVerh(), b = this.zsErg.bildRechteck; z.b = klemme(z.b + d, 0.08, 1 - z.x); z.h = v ? z.b / (v * b.h / b.b) : klemme(z.h + d, 0.08, 1 - z.y); }
      else { if (pf === 'l') z.x -= s; if (pf === 'r') z.x += s; if (pf === 'o') z.y -= s; if (pf === 'u') z.y += s; z.x = klemme(z.x, 0, 1 - z.b); z.y = klemme(z.y, 0, 1 - z.h); }
      this.zsSetze(z); this.commit('zs-taste'); this.zeichnen(); return;
    }
    if (this.ui.auswahl && !this.ui.blatt && (t.classList.contains('ks-feld') || t === this.root || t.closest('.ks-kontext') || t.closest('.ks-flaeche'))) {
      ev.preventDefault(); this.bewegeAuswahl(pf, ev.shiftKey ? 0.05 : 0.01);
    }
  };

  /* ---------- Postkarte ---------- */
  P.wende = function (seite) {
    if (seite === this.ui.seite) return;
    this.ui.seite = seite; this.ui.auswahl = null;
    this.zeichnen(); this.zeichneUI();
  };

  /* ---------- Live-Sucher ---------- */
  /* Eigener Sucher: Kamerabild mit dem aktuellen Design darüber. Läuft in jeder Bedienweise (design = „Mit diesem Design weiterfotografieren“).
     Ohne Kamera (kein Zugriff, claude.ai, Test) steht das Beispielfoto als „Kamerabild“ da, klar beschriftet. */
  P.starteLive = async function (design) {
    if (this.ui.ansicht === 'live') return;
    if (design ? !this.designSucherDa() : !this.an('liveSucher')) { this.ui.liveFehler = 'Live-Kamera ist hier nicht verfügbar.'; this.zeichneUI(); return; }
    this.startAus();
    this.ui.liveFehler = null; this.ui.beispielModus = false; this.ui.beispielGrund = ''; this.ui.countdown = 0; this.ui.ansicht = 'live';
    Object.assign(this.ui.sucher, { zoom: '1', zoomArt: 'kamera', licht: false, waage: false });
    this.ui.sucherF = { zoom: null, licht: false }; this.ui.liveWartet = true;
    this.zeichneUI();
    const ab = this.$.kopf.querySelector('[data-akt="live-stopp"]'); if (ab) try { ab.focus({ preventScroll: true }); } catch (e) { /* egal */ }   // Esc und Tab wirken von „Abbrechen“ aus
    const nr = this.liveNr = (this.liveNr || 0) + 1;   // ein später fertiger Start aus einem abgebrochenen Versuch darf keinen Strom zurücklassen
    try {
      if (!E() || !E().liveKamera) throw new Error('Live-Kamera ist hier nicht verfügbar.');
      const k = await E().liveKamera(this.$.video, { kamera: this.ui.sucher.kamera });
      if (nr !== this.liveNr || this.ui.ansicht !== 'live') {   // nur den eigenen Strom stoppen, das Bild eines neueren Suchers bleibt
        const v = this.$.video, alt = k.strom; if (alt) alt.getTracks().forEach(t => t.stop());
        if (v && v.srcObject === alt) v.srcObject = this.live && this.live.strom || null;
        return;
      }
      this.live = k;
      this.ui.sucherF = this.live.faehigkeiten ? this.live.faehigkeiten() : { zoom: null, licht: false };
    } catch (e) {
      if (nr !== this.liveNr) return;
      this.live = null;
      const text = e && e.message && e.message.length < 200 ? e.message : 'Die Kamera lässt sich hier nicht live öffnen.';
      if (this.o.beispielFoto) { this.ui.beispielModus = true; this.ui.beispielGrund = text; }
      else {
        this.ui.ansicht = 'bearbeiten'; this.ui.liveFehler = text;
        this.ereignis({ typ: 'fehler', text });
      }
    }
    this.ui.liveWartet = false;
    this.zeichneUI();
  };
  P.stoppeLive = function () {
    this.liveNr = (this.liveNr || 0) + 1; this.ui.liveWartet = false;
    this.stoppeCountdown();
    this.waageAus(); this.ui.sucher.waage = false;
    if (this.live) { try { this.live.stopp(); } catch (e) { /* egal */ } this.live = null; }
    if (this.bspUrl) { URL.revokeObjectURL(this.bspUrl); this.bspUrl = null; }
  };
  P.sucherVerlassen = function () { this.stoppeLive(); this.ui.ansicht = 'bearbeiten'; this.ui.beispielModus = false; this.zeichneUI(); this.zeichnen(); if (!this.quelle) this.startZeigen(); };
  P.ausloesenKlick = function () {
    if (this.nichtAusloesen) return;
    if (this.ui.countdown) { this.stoppeCountdown(); this.zeichneUI(); return; }
    const t = this.an('sucherTimer') ? this.ui.sucher.timer : 0;
    if (t > 0) this.starteCountdown(t); else this.ausloesen();
  };
  P.starteCountdown = function (s) {
    this.ui.countdown = s; this.zeigeZaehler(); this.zeichneUI();
    this.cdTimer = setInterval(() => {
      this.ui.countdown--;
      if (this.ui.countdown <= 0) { clearInterval(this.cdTimer); this.cdTimer = null; this.ui.countdown = 0; this.zeigeZaehler(); this.ausloesen(); }
      else this.zeigeZaehler();
    }, 1000);
  };
  P.stoppeCountdown = function () {
    if (this.cdTimer) { clearInterval(this.cdTimer); this.cdTimer = null; }
    if (this.ui.countdown) { this.ui.countdown = 0; this.zeigeZaehler(); }
  };
  P.zeigeZaehler = function () { if (this.$ && this.$.zaehler) this.$.zaehler.textContent = this.ui.countdown > 0 ? String(this.ui.countdown) : ''; };
  P.ausloesen = async function () {
    if (this.ui.ansicht !== 'live' || this.ui.nimmtAuf) return;
    if (!this.live && !this.ui.beispielModus) return;
    this.ui.nimmtAuf = true;
    this.haptik(15); this.spieleTon();
    const S = this.ui.sucher, spiegeln = S.kamera === 'user' && this.an('sucherSpiegeln') && S.spiegeln && !this.ui.beispielModus;
    try {
      let q;
      if (this.ui.beispielModus) {
        const b = this.o.beispielFoto;
        q = typeof b === 'string' ? await E().ladeUrl(b) : await E().ladeDatei(b);
        q.istBeispiel = true;
      } else q = this.live.foto();
      // Der Rahmen im Sucher zeigte die Mitte im gewählten Format: das Foto soll genauso ausgerichtet sein
      if (!['original', 'frei', '1:1'].includes(this.Z.format)) this.Z.ausrichtung = this.sucherHoch() ? 'hoch' : 'quer';
      this.stoppeLive(); this.ui.ansicht = 'bearbeiten'; this.ui.beispielModus = false;
      this.setzeQuelle(q, { design: true, spiegeln });
    } catch (e) { this.zeigeHinweis('Das Foto hat nicht geklappt. Versuch es noch einmal.'); }
    this.ui.nimmtAuf = false;
  };
  /* Auslöseton: kurzer Klick per WebAudio; „ambient“ lässt die Stummschaltung des iPhones gelten */
  P.spieleTon = function () {
    if (!this.an('sucherTon') || !this.ui.sucher.ton) return;
    this.tonZaehler = (this.tonZaehler || 0) + 1;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.audio || (this.audio = new AC()); if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'square'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.09);
    } catch (e) { /* kein Ton ist kein Fehler */ }
  };

  /* Rahmen des Suchers: Seitenverhältnis aus Format und Ausrichtung des Entwurfs; „Original“ zeigt 4:3 passend zur Bühne */
  P.sucherHoch = function () {
    const a = this.Z.ausrichtung;
    return a === 'hoch' ? true : a === 'quer' ? false : this.layoutArt === 'ks-hoch';   // Hochformat-Layout = aufrechtes Bild
  };
  P.sucherVerhaeltnis = function () {
    let v = FORMAT_V[this.Z.format] || 3 / 4;
    if (v > 1) v = 1 / v;
    return this.sucherHoch() ? v : 1 / v;
  };
  P.passeSucher = function () {
    const r = this.$.rahmen, b = this.$.buehne, br = b.clientWidth, bh = b.clientHeight;
    if (!br || !bh) return null;
    const a = this.sucherVerhaeltnis();
    let w = br, h = br / a; if (h > bh) { h = bh; w = bh * a; }
    w = Math.floor(w); h = Math.floor(h);
    const st = r.style; st.width = w + 'px'; st.height = h + 'px'; st.left = Math.round((br - w) / 2) + 'px'; st.top = Math.round((bh - h) / 2) + 'px';
    return { w, h };
  };
  P.filterCss = function () {
    const Z = this.wirksam(), a = Z.anpassung || {};
    let f = FILTER_CSS[Z.filter] || '';
    if (a.licht) f += ` brightness(${(1 + a.licht / 250).toFixed(3)})`;
    if (a.kontrast) f += ` contrast(${(1 + a.kontrast / 200).toFixed(3)})`;
    if (a.saettigung) f += ` saturate(${(1 + a.saettigung / 100).toFixed(3)})`;
    return f.trim() || 'none';
  };
  /* Alles im Kamerabild: Rahmen, Filter-Anmutung, Zoom, Spiegelung, Beispiel-Beschriftung, Raster, Waage, Design-Overlay */
  P.zeichneSucher = function () {
    const $ = this.$;
    if (!$ || !$.rahmen || this.ui.ansicht !== 'live') return;
    $.flaeche.style.visibility = 'hidden';
    const g = this.passeSucher(); if (!g) return;
    const S = this.ui.sucher, bsp = this.ui.beispielModus, z = S.zoomArt === 'digital' ? +S.zoom : 1, vorn = S.kamera === 'user' && !bsp;
    const css = this.filterCss(), tr = `scale(${vorn ? -z : z}, ${z})`;
    [$.video, $.bsp].forEach(el => { el.style.filter = css; el.style.transform = tr; });
    $.rahmen.classList.toggle('ks-beispiel-modus', bsp);
    if (bsp && !$.bsp.getAttribute('src')) {
      const b = this.o.beispielFoto; this.bspUrl = typeof b === 'string' ? null : URL.createObjectURL(b);
      $.bsp.src = this.bspUrl || b;
    }
    $.bsp.hidden = !bsp;
    $.bspHinweis.hidden = !bsp;
    $.bspHinweis.classList.toggle('ks-hinweis-unten', /^oben/.test((this.Z.overlay && this.Z.overlay.position) || ''));   // nicht über die Wetterkarte legen (Nutzertest 19.10.)
    $.wartet.textContent = this.ui.liveWartet && !bsp ? 'Kamera wird gestartet …' : '';
    if (bsp) $.bspHinweis.innerHTML = `<strong>Beispiel – hier wäre das Kamerabild</strong>${this.ui.beispielGrund ? `<span>${esc(this.ui.beispielGrund.split(' Tipp:')[0])}</span>` : ''}`;
    $.raster.classList.toggle('ks-an', !!S.raster && this.an('sucherRaster'));
    $.waage.classList.toggle('ks-an', !!S.waage && this.an('sucherWaage'));
    this.zeigeZaehler();
    this.zeichneLiveOverlay(g);
  };
  /* Design-Overlay: die echte Wetterkarte der Engine auf durchsichtigem Grund, darunter läuft das Kamerabild */
  P.leerQuelle = function (a) {
    const k = a.toFixed(3);
    if (this.leerQ && this.leerQ.k === k) return this.leerQ.q;
    this.leerQuelleFrei();
    const c = document.createElement('canvas'); c.height = 1000; c.width = Math.max(1, Math.round(1000 * a));
    const q = E().quelleAus(c, 'Sucher'); q.transparent = true; c.width = c.height = 0;
    this.leerQ = { k, q };
    return q;
  };
  P.leerQuelleFrei = function () { if (this.leerQ) { try { E().freigeben(this.leerQ.q); } catch (e) { /* egal */ } this.leerQ = null; } };
  P.zeichneLiveOverlay = function (g) {
    const $ = this.$, cv = $ && $.liveCv, l = $ && $.live; if (!cv) return;
    g = g || { w: $.rahmen.clientWidth, h: $.rahmen.clientHeight };
    const e = E(), w = this.aktWetter();
    if (this.ui.ansicht !== 'live' || !this.an('daten') || this.Z.overlay.stil === 'aus' || !g.w || !g.h) { cv.width = 0; l.innerHTML = ''; this.liveKey = ''; return; }
    const Zl = this.wirksam();
    Object.assign(Zl, { format: 'original', zuschnitt: null, drehung: 0, spiegeln: false, gerade: 0, filter: 'keiner', effekt: 'keiner', rahmen: 'keiner' });
    Zl.anpassung = { licht: 0, kontrast: 0, saettigung: 0, waerme: 0, vignette: 0, koernung: 0 };
    Zl.postkarte = Object.assign({}, Zl.postkarte, { an: false });
    if (!Zl.overlay.farbe || Zl.overlay.farbe === 'auto') Zl.overlay = Object.assign({}, Zl.overlay, { farbe: 'hell' });   // Kamerabild unbekannt: weiße Schrift auf dunklem Schleier
    const dpr = Math.min(2, window.devicePixelRatio || 1), key = JSON.stringify([Zl, w, g.w, g.h, dpr]);
    if (key === this.liveKey) return;
    this.liveKey = key;
    try {
      const a = g.w / g.h;
      e.render(cv, this.leerQuelle(a), Zl, w, { maxSeite: Math.min(1400, Math.ceil(Math.max(g.w, g.h) * dpr)), vorschau: true });
      l.innerHTML = '';
    } catch (err) {   // Rückfall: einfache Karte aus Text
      cv.width = 0;
      let zeilen = []; try { zeilen = e.datenZeilen(this.wirksam(), w) || []; } catch (e2) { zeilen = []; }
      const sym = this.Z.daten.symbol && e.symbolSvg ? `<span class="ks-live-symbol">${e.symbolSvg(this.wetter.code, false)}</span>` : '';
      l.innerHTML = `<div class="ks-live-karte ks-pos-${esc(this.Z.overlay.position)}">${sym}<div>${zeilen.map(z => `<span class="ks-live-zeile ks-z-${esc(z.schluessel)}">${esc(z.text)}</span>`).join('')}</div></div>`;
    }
  };

  /* Sucher-Knöpfe */
  P.sucherHinweis = function (t) { this.zeigeHinweis(t); };
  P.sucherKameraWechsel = async function () {
    const S = this.ui.sucher, neu = S.kamera === 'user' ? 'environment' : 'user';
    if (this.live) {
      try { await this.live.wechsle(neu); }
      catch (e) { this.sucherHinweis(e && e.message && e.message.length < 200 ? e.message : 'Die Kamera lässt sich nicht wechseln.'); this.zeichneUI(); return; }
      this.ui.sucherF = this.live.faehigkeiten();
    }
    Object.assign(S, { kamera: neu, zoom: '1', zoomArt: 'kamera', licht: false });
    this.zeichneUI();
  };
  P.sucherZoom = async function (z) {
    const S = this.ui.sucher, f = this.ui.sucherF, echt = !!(f.zoom && z >= f.zoom.min && z <= f.zoom.max);
    if (z < 1 && !echt) { this.sucherHinweis('Das 0,5-fach-Weitwinkel (Ultraweitwinkel) gibt es im Browser nur auf manchen Geräten. Dieses Gerät meldet es nicht.'); return; }
    let art = z === 1 ? 'kamera' : 'digital';
    if (this.live) { art = await this.live.zoom(z); if (art === 'nicht-moeglich') { this.sucherHinweis('Dieser Zoom geht hier nicht.'); return; } }
    Object.assign(S, { zoom: String(z), zoomArt: art });
    this.zeichneUI();
  };
  P.sucherLicht = async function () {
    const S = this.ui.sucher;
    if (!this.ui.sucherF.licht || !this.live) { this.sucherHinweis('Das Licht (Taschenlampe) gibt es im Browser nur bei der Rückkamera und nicht auf jedem Gerät.'); return; }
    S.licht = await this.live.licht(!S.licht);
    this.zeichneUI();
  };
  P.sucherFormat = function () {
    const i = Math.max(0, SUCHER_FORMATE.findIndex(f => f[0] === this.Z.format)), n = SUCHER_FORMATE[(i + 1) % SUCHER_FORMATE.length][0];   // „Original“ gilt als 4:3
    this.Z.format = n; this.Z.zuschnitt = null; this.Z.ausrichtung = 'auto';
    if (this.quelle) this.commit('format'); else this.ereignis({ typ: 'geaendert', zustand: tief(this.Z) });
    this.zeichneUI();
  };
  P.sucherWaage = async function () {
    const S = this.ui.sucher;
    if (S.waage) { S.waage = false; this.waageAus(); this.zeichneUI(); return; }
    const DO = window.DeviceOrientationEvent; if (!DO) return;
    if (typeof DO.requestPermission === 'function') {   // iPhone: Erlaubnis nur nach Antippen
      let r = 'denied'; try { r = await DO.requestPermission(); } catch (e) { r = 'denied'; }
      if (r !== 'granted') { this.sucherHinweis('Ohne deine Erlaubnis kann die Waage nichts messen. Du kannst sie in den Safari-Einstellungen erlauben.'); return; }
    }
    S.waage = true; this.waageAn(); this.zeichneUI();
  };
  P.waageAn = function () {
    this.waageAus();
    const t = this.$.waage.querySelector('.ks-waage-text'); t.textContent = 'Waage wartet auf Messwerte …';
    this.waageHat = false;
    this._orient = ev => this.waageWert(ev);
    window.addEventListener('deviceorientation', this._orient);
    this.waageTimer = setTimeout(() => { if (!this.waageHat) t.textContent = 'Dieses Gerät meldet keine Neigung.'; }, 2000);
  };
  P.waageAus = function () {
    if (this._orient) { window.removeEventListener('deviceorientation', this._orient); this._orient = null; }
    clearTimeout(this.waageTimer);
  };
  P.waageWert = function (ev) {
    const w = this.$ && this.$.waage; if (!w || ev.gamma == null) return;
    this.waageHat = true;
    const dreh = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let roll = dreh === 90 ? -(ev.beta || 0) : dreh === 270 || dreh === -90 ? (ev.beta || 0) : dreh === 180 ? -ev.gamma : ev.gamma;
    roll = klemme(roll, -45, 45);
    const eben = Math.abs(roll) < 1.5;
    w.querySelector('.ks-waage-linie').style.transform = `rotate(${(-roll).toFixed(1)}deg)`;
    w.querySelector('.ks-waage-text').textContent = eben ? 'Waagerecht ✓' : `Neigung ${Math.abs(roll).toFixed(0)}° ${roll > 0 ? 'nach rechts' : 'nach links'}`;
    w.classList.toggle('ks-eben', eben);
  };
  /* Ausgegraute Knöpfe bleiben antippbar und erklären sich per Hinweis */
  P.sucherWerkzeuge = function () {
    const F = n => this.an(n), S = this.ui.sucher, f = this.ui.sucherF, vorn = S.kamera === 'user', k = [];
    const t = (akt, icon, text, o) => knopf(Object.assign({ akt, icon, text, klasse: 'ks-werkzeug' }, o));
    if (F('sucherKameraWechsel')) k.push(t('s-kamera', 'kamerawechsel', 'Kamera', { label: 'Kamera wechseln, jetzt ' + (vorn ? 'vorne' : 'hinten') }));
    if (F('sucherLicht')) k.push(t('s-licht', 'licht', 'Licht', { gedrueckt: !!S.licht, grau: !f.licht, klasse: 'ks-werkzeug' + (f.licht ? '' : ' ks-grau') + (S.licht ? ' ks-an' : ''), label: f.licht ? 'Licht' : 'Licht, auf diesem Gerät nicht möglich' }));
    if (F('sucherTimer')) k.push(t('s-timer', 'timer', S.timer ? S.timer + ' s' : 'Timer aus', { label: 'Timer wechseln, jetzt ' + (S.timer ? S.timer + ' Sekunden' : 'aus'), klasse: 'ks-werkzeug' + (S.timer ? ' ks-an' : '') }));
    if (F('sucherRaster')) k.push(t('s-raster', 'raster', 'Raster', { gedrueckt: !!S.raster, klasse: 'ks-werkzeug' + (S.raster ? ' ks-an' : '') }));
    if (F('sucherWaage') && window.DeviceOrientationEvent) k.push(t('s-waage', 'waage', 'Waage', { gedrueckt: !!S.waage, klasse: 'ks-werkzeug' + (S.waage ? ' ks-an' : '') }));
    if (F('sucherFormat')) { const fo = (SUCHER_FORMATE.find(x => x[0] === this.Z.format) || SUCHER_FORMATE[0])[1]; k.push(t('s-format', 'format', fo, { label: 'Format wechseln, jetzt ' + fo })); }
    if (F('sucherSpiegeln') && vorn) k.push(t('s-spiegeln', 'spiegeln', 'Spiegeln', { gedrueckt: !!S.spiegeln, klasse: 'ks-werkzeug' + (S.spiegeln ? ' ks-an' : ''), label: 'Selfie spiegeln' }));
    if (F('sucherTon')) k.push(t('s-ton', 'ton', 'Ton', { gedrueckt: !!S.ton, klasse: 'ks-werkzeug' + (S.ton ? ' ks-an' : ''), label: 'Auslöseton' }));
    return k.length ? `<div class="ks-sucher-regler" role="toolbar" aria-label="Sucher">${k.join('')}</div>` : '';
  };
  P.sucherZoomHtml = function () {
    if (!this.an('sucherZoom')) return '';
    const S = this.ui.sucher, f = this.ui.sucherF;
    return `<div class="ks-sucher-zoom" role="group" aria-label="Zoom">${SUCHER_ZOOM.map(([w, t]) => {
      const echt = !!(f.zoom && +w >= f.zoom.min && +w <= f.zoom.max), grau = +w < 1 && !echt;
      return knopf({ akt: 's-zoom', wert: w, text: t, klasse: 'ks-chip ks-glas-knopf' + (S.zoom === w ? ' ks-an' : '') + (grau ? ' ks-grau' : ''), gedrueckt: S.zoom === w, grau, label: 'Zoom ' + t + (grau ? ', auf diesem Gerät nicht möglich' : '') });
    }).join('')}</div>`;
  };
  /* Auslöser auf eigener Ebene über dem ganzen Sucher: „Frei“ (verschiebbar) und „Links“ im Quer-/Breitformat (am Bildschirmrand statt am Rand der Bedienspalte) */
  P.ausloeserEbene = function () {
    const ort = this.opt('ausloeserOrt');
    return ort === 'frei' || (ort === 'links' && (this.layoutArt === 'ks-quer' || this.layoutArt === 'ks-breit'));
  };
  P.ausloeserKnopf = function () {
    const ort = this.opt('ausloeserOrt'), ebene = this.ausloeserEbene(), frei = ort === 'frei', cd = this.ui.countdown > 0, p = this.freiPos();
    return knopf({ akt: 'ausloesen', label: cd ? 'Abbrechen – Countdown stoppen' : 'Auslösen – Foto aufnehmen' + (frei ? ' (ziehen oder mit Pfeiltasten verschieben)' : ''),
      klasse: 'ks-ausloeser' + (ebene ? ' ks-ausloeser-frei' : '') + (ebene && !frei ? ' ks-ausloeser-rand' : '') + (cd ? ' ks-laeuft' : ''), html: '<span class="ks-ausloeser-ring" aria-hidden="true"></span>',
      aus: !this.live && !this.ui.beispielModus, stil: frei ? `--ax:${p.x};--ay:${p.y}` : ebene ? '--ax:0;--ay:.5' : '' });
  };
  P.sucherFuss = function () {
    const ort = this.opt('ausloeserOrt'), fotos = this.an('mediathek') ? knopf({ akt: 'foto-waehlen', icon: 'bild', text: 'Fotos', klasse: 'ks-werkzeug' }) : '<span></span>';
    // Frei: der Platz in der Mitte bleibt leer, dort liegt der Auslöser zunächst (wie „Mitte“) und lässt sich von dort verschieben
    if (ort === 'frei') return `<div class="ks-seite-fuss">${this.hilfe('Der Auslöser lässt sich mit dem Finger oder den Pfeiltasten verschieben.').replace('class="ks-hilfe"', 'class="ks-hilfe ks-ausl-hinweis"')}<div class="ks-sucher-leiste ks-ausl-mitte">${fotos}<span class="ks-ausl-platz" aria-hidden="true"></span><span></span></div></div>`;
    if (this.ausloeserEbene()) return `<div class="ks-seite-fuss ks-sucher-leiste ks-ausl-links ks-ausl-ebene"><span></span>${fotos}</div>`;
    const a = this.ausloeserKnopf();
    return `<div class="ks-seite-fuss ks-sucher-leiste ks-ausl-${ort}">${ort === 'links' ? a + fotos : ort === 'rechts' ? fotos + a : fotos + a + '<span></span>'}</div>`;
  };

  /* Auslöser „frei“: mit dem Finger über den ganzen Sucher ziehen (auch in die untere Bedienleiste), rastet am nächsten Rand ein, weicht anderen Knöpfen aus; Ort wird gemerkt */
  P.freiAnzeige = function (k) {
    const R = this.root.getBoundingClientRect(), r = k.getBoundingClientRect();
    return { x: klemme((r.left + r.width / 2 - R.left) / R.width, 0, 1), y: klemme((r.top + r.height / 2 - R.top) / R.height, 0, 1) };
  };
  P.freiSetze = function (k, p) { k.style.setProperty('--ax', p.x.toFixed(4)); k.style.setProperty('--ay', p.y.toFixed(4)); };
  /* Ohne gemerkten Ort liegt der Auslöser dort, wo „Mitte“ ihn hätte (leerer Platz in der Bedienleiste) */
  P.freiPlatzieren = function () {
    const k = this.$.frei.querySelector('.ks-ausloeser-frei:not(.ks-ausloeser-rand)'), platz = this.$.seite.querySelector('.ks-ausl-platz');
    if (!k) return;
    const g = this.freiGemerkt();
    if (g) { if (this.freiBelegt(k)) this.freiFrei(k, g, g, g); return; }   // nach Drehen o. Ä. liegt der gemerkte Ort auf einem Knopf: nächster freier Randplatz (gemerkt bleibt)
    if (!platz) return;
    const R = this.root.getBoundingClientRect(), r = platz.getBoundingClientRect();
    if (r.width) this.freiSetze(k, { x: (r.left + r.width / 2 - R.left) / R.width, y: (r.top + r.height / 2 - R.top) / R.height });
  };
  /* Überdeckt der Auslöser einen anderen Knopf (sichtbarer Teil, Rollbereiche beachtet)? */
  P.freiBelegt = function (k) {
    const kr = k.getBoundingClientRect(), m = 4;
    for (const e of this.root.querySelectorAll('button, input, select, textarea')) {
      if (e === k || e.closest('[hidden]')) continue;
      let r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      for (let a = e.parentElement; a && a !== this.root; a = a.parentElement) {
        const cs = getComputedStyle(a); if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const c = a.getBoundingClientRect(); r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) };
      }
      if (r.right > kr.left - m && r.left < kr.right + m && r.bottom > kr.top - m && r.top < kr.bottom + m) return true;
    }
    return false;
  };
  /* Nächster freier Randplatz zum losgelassenen Ort; findet sich keiner, geht der Auslöser zurück an die alte Stelle */
  P.freiFrei = function (k, n, roh, vorher) {
    const R = this.root.getBoundingClientRect();
    this.freiSetze(k, n); if (!this.freiBelegt(k)) return n;
    const nx = Math.ceil(R.width / 12), ny = Math.ceil(R.height / 12), kand = [];
    for (let i = 0; i <= nx; i++) kand.push({ x: i / nx, y: 0 }, { x: i / nx, y: 1 });
    for (let i = 0; i <= ny; i++) kand.push({ x: 0, y: i / ny }, { x: 1, y: i / ny });
    const d = c => Math.hypot((c.x - roh.x) * R.width, (c.y - roh.y) * R.height);
    kand.sort((a, b) => d(a) - d(b));
    for (const c of kand) { this.freiSetze(k, c); if (!this.freiBelegt(k)) return c; }
    this.freiSetze(k, vorher); return vorher;
  };
  P.freiEinrichten = function () {
    const b = this.root;
    b.addEventListener('pointerdown', ev => {
      const k = ev.target.closest && ev.target.closest('.ks-ausloeser-frei:not(.ks-ausloeser-rand)'); if (!k || (ev.button != null && ev.button > 0)) return;
      this.frei = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, k, bewegt: false, vorher: this.freiAnzeige(k) };
    });
    b.addEventListener('pointermove', ev => {
      const f = this.frei; if (!f || ev.pointerId !== f.id) return;
      if (!f.bewegt && Math.abs(ev.clientX - f.x0) + Math.abs(ev.clientY - f.y0) < 8) return;
      if (!f.bewegt) { f.bewegt = true; try { f.k.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ } }
      const r = b.getBoundingClientRect(), p = { x: klemme((ev.clientX - r.left) / r.width, 0, 1), y: klemme((ev.clientY - r.top) / r.height, 0, 1) };
      this.freiSetze(f.k, p); f.pos = p;
    });
    const ende = ev => {
      const f = this.frei; if (!f || ev.pointerId !== f.id) return;
      this.frei = null;
      if (!f.bewegt || !f.pos) return;
      this.nichtAusloesen = true; setTimeout(() => { this.nichtAusloesen = false; }, 80);   // das Klick-Ereignis nach dem Ziehen löst nicht aus
      const r = b.getBoundingClientRect(), rad = f.k.offsetWidth / 2, p = f.pos;
      const d = { l: p.x * r.width - rad, r: (1 - p.x) * r.width - rad, o: p.y * r.height - rad, u: (1 - p.y) * r.height - rad };
      const nah = Object.keys(d).reduce((m, k) => d[k] < d[m] ? k : m, 'l');   // nächster Rand
      const n = this.freiFrei(f.k, { x: nah === 'l' ? 0 : nah === 'r' ? 1 : p.x, y: nah === 'o' ? 0 : nah === 'u' ? 1 : p.y }, p, f.vorher);
      this.freiMerken(n); this.haptik(6);
    };
    b.addEventListener('pointerup', ende); b.addEventListener('pointercancel', ende);
  };
  P.freiTaste = function (ev) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!d) return false;
    ev.preventDefault();
    const k = this.$.frei.querySelector('.ks-ausloeser-frei'); if (!k) return true;
    const p = this.freiAnzeige(k), s = ev.shiftKey ? 0.15 : 0.06;
    for (let i = 1, n = p; i <= 20; i++) {   // liegt der nächste Schritt auf einem Knopf, weiter in dieselbe Richtung bis zum ersten freien Platz
      const c = { x: klemme(p.x + d[0] * s * i, 0, 1), y: klemme(p.y + d[1] * s * i, 0, 1) };
      if (c.x === n.x && c.y === n.y) break;
      n = c; this.freiSetze(k, n);
      if (!this.freiBelegt(k)) { this.freiMerken(n); return true; }
    }
    this.freiSetze(k, p);   // in dieser Richtung kein freier Platz: bleibt stehen
    return true;
  };

  /* ---------- Schnell: Vorlagen ---------- */
  P.vorlagen = function () {
    const r = [], F = id => this.an(id);
    const meine = F('vorlagenMerken') ? this.vorlageLaden() : null;
    if (meine) r.push({ id: 'meine', name: 'Meine Vorlage', teil: meine });
    r.push({ id: 'empfohlen', name: 'Empfohlen', teil: { overlay: { stil: 'glas', position: 'unten' }, filter: 'keiner', rahmen: 'keiner', format: 'original' } });
    if (F('datenStile')) r.push({ id: 'band', name: 'Band', teil: { overlay: { stil: 'band', position: 'unten' }, filter: 'keiner', rahmen: 'keiner', format: F('formate') ? '4:5' : 'original' } });
    if (F('formate')) r.push({ id: 'story', name: 'Story (9:16)', teil: { overlay: { stil: F('datenStile') ? 'gross' : 'glas', position: 'unten' }, filter: 'keiner', rahmen: 'keiner', format: '9:16' } });
    if (F('formate') && F('datenStile')) r.push({ id: 'quadrat', name: 'Quadrat', teil: { overlay: { stil: 'chips', position: 'unten' }, filter: 'keiner', rahmen: 'keiner', format: '1:1' } });
    if (F('filter') && F('datenStile')) r.push({ id: 'analog', name: 'Analog', teil: { overlay: { stil: 'stempel', position: 'unten-rechts' }, filter: 'analog', rahmen: 'keiner', format: 'original' } });
    if (F('sw') || F('filter')) r.push({ id: 'sw', name: 'Schwarz-Weiß', teil: { overlay: { stil: F('datenStile') ? 'minimal' : 'glas', position: 'unten' }, filter: 'sw', rahmen: 'keiner', format: 'original' } });
    if (F('rahmen')) r.push({ id: 'sofortbild', name: 'Sofortbild', teil: { overlay: { stil: F('datenStile') ? 'minimal' : 'glas', position: 'unten' }, filter: F('filter') ? 'warm' : 'keiner', rahmen: 'polaroid', format: F('formate') ? '1:1' : 'original' } });
    if (F('postkarte')) r.push({ id: 'postkarte', name: 'Postkarte', teil: { overlay: { stil: F('datenStile') ? 'minimal' : 'glas', position: 'unten' }, filter: 'keiner', rahmen: F('rahmen') ? 'postkarte' : 'keiner', format: F('formate') ? 'postkarte' : 'original', postkarte: { an: true } } });   // W6: Format, Rahmen und Gruß mit einem Tipp
    if (!F('daten')) r.forEach(v => { if (v.teil.overlay) delete v.teil.overlay; });
    return r;
  };
  /* A7b: Die Ein-Tipp-Karte verbessert beim Laden automatisch; solange das gilt, sagt die Karte leise, was sich geändert hat */
  P.autoAktiv = function () { const w = this.ui.autoWerte, a = this.Z.anpassung || {}; return !!w && AUTO_WERTE.every(k => (a[k] || 0) === (w[k] || 0)); };
  P.autoHinweis = function () {
    if (!this.autoAktiv()) return '';
    const w = this.ui.autoWerte, t = [];
    if (w.licht) t.push(w.licht > 0 ? 'heller' : 'dunkler');
    if (w.kontrast) t.push(w.kontrast > 0 ? 'mehr Kontrast' : 'weicher');
    if (w.waerme) t.push(w.waerme > 0 ? 'wärmer' : 'kühler');
    return 'Automatisch verbessert: ' + t.join(', ');
  };
  P.wendeVorlageAn = function (id) {
    const v = this.vorlagen().find(x => x.id === id); if (!v) return;
    const geo = { drehung: this.Z.drehung, spiegeln: this.Z.spiegeln, gerade: this.Z.gerade };
    const teil = tief(v.teil); delete teil.texte; delete teil.sticker; delete teil.zuschnitt;
    mische(this.Z, teil); Object.assign(this.Z, geo); this.Z.zuschnitt = null;
    if (!(teil.postkarte && teil.postkarte.an)) this.Z.postkarte.an = false;   // nur die Vorlage „Postkarte“ (oder eine gemerkte mit Gruß) schaltet den Gruß ein
    this.ui.vorlage = id; this.vorlageZeigen = true; this.commit('vorlage-' + id); this.zeichneUI(); this.haptik(5);
  };
  P.planeThumbs = function () {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => this.machThumbs(), 350);
  };
  P.machThumbs = function () {
    if (!this.quelle || this.variante !== 'schnell' || !E()) return;
    const ver = ++this.thumbVersion, liste = this.vorlagen();
    const basis = this.wirksam(), w = this.aktWetter();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let i = 0;
    const naechster = () => {
      if (ver !== this.thumbVersion || i >= liste.length || !this.quelle) { if (this.thumbCv) { this.thumbCv.width = 0; this.thumbCv.height = 0; } return; }
      const v = liste[i++];
      try {
        const z = mische(tief(basis), (() => { const t = tief(v.teil); delete t.texte; delete t.sticker; return t; })());
        z.zuschnitt = null;
        if (!(v.teil.postkarte && v.teil.postkarte.an)) z.postkarte.an = false;   // Kärtchen ohne Gruß, wenn die Vorlage keine Postkarte ist
        const c = this.thumbCv || (this.thumbCv = document.createElement('canvas'));
        E().render(c, this.quelle, z, w, { maxSeite: Math.round(200 * dpr), vorschau: true });
        this.thumbs[v.id] = c.toDataURL('image/jpeg', 0.8);
        const img = this.root.querySelector(`[data-vorlage-bild="${v.id}"]`);
        if (img) img.src = this.thumbs[v.id];
      } catch (e) { /* Vorschau-Kärtchen bleibt leer */ }
      setTimeout(naechster, 16);
    };
    naechster();
  };

  /* ---------- Assistent ---------- */
  P.schritte = function () {
    const F = n => this.an(n);
    return [
      { id: 'foto', name: 'Foto', frage: 'Welches Foto möchtest du nehmen?' },
      (F('zuschneiden') || F('formate') || F('drehen') || F('spiegeln') || F('gerade')) && { id: 'ausschnitt', name: 'Zuschnitt', frage: 'Welcher Bildausschnitt passt?' },
      (F('filter') || F('sw') || F('anpassen') || F('autoVerbessern')) && { id: 'aussehen', name: 'Aussehen', frage: 'Wie soll das Foto aussehen?' },
      F('daten') && { id: 'wetter', name: 'Wetterdaten', frage: 'Was soll vom Wetter aufs Bild?' },
      (F('text') || F('sticker') || F('emojis') || F('postkarte')) && { id: 'text', name: 'Text und Grüße', frage: 'Möchtest du etwas dazuschreiben?' },
      { id: 'senden', name: 'Teilen', frage: 'Wie möchtest du das Bild teilen?' }
    ].filter(Boolean);
  };
  P.schrittId = function () { const s = this.schritte(); return (s[klemme(this.ui.schritt, 0, s.length - 1)] || {}).id; };
  P.geheSchritt = function (d) {
    const s = this.schritte();
    const n = klemme(this.ui.schritt + d, 0, s.length - 1);
    if (n === this.ui.schritt) return;
    this.ui.schritt = n; this.ui.auswahl = null;
    if (s[n].id === 'senden') { this.ui.senden.key = null; this.vorbereiten(); }
    this.zeichneUI(); this.zeichnen();
    const h = this.$.kopf.querySelector('.ks-titel'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  };

  /* =====================================================================
     Varianten: je Kopf, Seite (Werkzeuge), Zusatz (über dem Bild)
     ===================================================================== */
  const V = {};

  V.bisher = {
    kopf() {
      return this.kopfHtml(this.quelle ? knopf({ akt: 'verwerfen-frage', text: 'Abbrechen', klasse: 'ks-flach' }) : '', `<h2 class="ks-titel">Wetterfoto</h2>`,
        this.quelle && this.an('daten') ? knopf({ akt: 'leiste', wert: 'wetter', text: 'Infos', klasse: 'ks-flach' }) : '');
    },
    seite() {
      if (!this.quelle) return '';
      let h = '';
      if (this.an('formate')) h += `<div class="ks-chips" role="group" aria-label="Format">${['original', '4:5', '1:1', '9:16'].map(f => chip('format', f, (liste('FORMATE').find(x => x.id === f) || { name: f }).name, this.Z.format === f)).join('')}</div>`;
      if (this.an('datenStile') && this.an('daten')) h += `<div class="ks-chips" role="group" aria-label="Gestaltung">${liste('STILE').filter(s => s.id !== 'aus').map(s => chip('stil', s.id, s.name, this.Z.overlay.stil === s.id)).join('')}</div>`;
      const s = this.ui.senden;
      const mitte = (this.an('teilen') || this.an('sichern')) ? knopf({ akt: 'schnell-teilen', icon: 'teilen', label: s.erg ? this.teilenWort() : 'Wird vorbereitet …', text: s.erg ? this.teilenWort() : 'Bitte warten', klasse: 'ks-ausloeser ks-teilen-rund', aus: !s.erg }) : '';
      h += `<div class="ks-bisher-leiste">${this.an('mediathek') ? knopf({ akt: 'foto-waehlen', icon: 'bild', text: 'Fotos', klasse: 'ks-werkzeug' }) : '<span></span>'}${mitte}${this.an('kamera') ? knopf({ akt: 'foto-kamera', icon: 'kamera', text: 'Kamera', klasse: 'ks-werkzeug' }) : '<span></span>'}</div>`;
      return `<div class="ks-seite-inhalt">${h}</div>`;
    }
  };

  V.schnell = {
    nachLaden() {
      this.ui.autoWerte = null;
      if (this.an('autoVerbessern')) try {
        const t = E().autoVerbessern(this.quelle);
        if (t) { mische(this.Z, t); if (t.anpassung && AUTO_WERTE.some(k => t.anpassung[k])) this.ui.autoWerte = tief(t.anpassung); }
      } catch (e) { /* ohne */ }
      const v = this.vorlagen(); const id = v.find(x => x.id === 'meine') ? 'meine' : 'empfohlen';
      const teil = tief((v.find(x => x.id === id) || v[0]).teil); delete teil.texte; delete teil.sticker; delete teil.zuschnitt; delete teil.drehung;
      mische(this.Z, teil); this.ui.vorlage = id;
    },
    kopf() {
      return this.kopfHtml(this.kNeu(), this.kUndo(), this.quelle ? knopf({ akt: 'anpassen-einfach', text: 'Bearbeiten', icon: 'regler', klasse: 'ks-flach' }) : '');
    },
    seite() {
      if (!this.quelle) return '';
      const s = this.ui.senden;
      const karten = this.vorlagen().map(v => `<button type="button" class="ks-vorlage${this.ui.vorlage === v.id ? ' ks-an' : ''}" data-akt="vorlage" data-wert="${v.id}" data-fk="vorlage:${v.id}" aria-pressed="${this.ui.vorlage === v.id}">` +
        `<img alt="" data-vorlage-bild="${v.id}" src="${this.thumbs[v.id] || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}"><span>${esc(v.name)}</span></button>`).join('');
      const kannIrgendwas = this.an('teilen') || this.an('sichern');
      const zahn = this.zahnradKnopf();
      const teilen = kannIrgendwas ? knopf({ akt: 'schnell-teilen', text: s.erg ? this.teilenWort() : 'Wird vorbereitet …', icon: 'teilen', klasse: 'ks-primaer ks-gross-knopf', aus: !s.erg }) : '';
      const auto = this.autoHinweis();
      return `<div class="ks-seite-inhalt">${auto ? `<p class="ks-hilfe ks-auto-hinweis">${ic('zauber')}<span>${esc(auto)}</span></p>` : this.hilfe('Wähle eine Vorlage – dein Bild ist sofort fertig.')}${this.galerieOben() ? this.galerieHtml(true) : ''}<div class="ks-karussell" role="group" aria-label="Vorlagen">${karten}</div></div>` +
        `<div class="ks-seite-fuss">${this.ui.geteilt || (zahn && this.galerieOben()) ? `<div class="ks-teilen-reihe">${teilen}${this.ui.geteilt ? knopf({ akt: 'senden', icon: 'regler', label: 'Teilen-Optionen', titel: 'Teilen-Optionen', klasse: 'ks-rund' }) : ''}${this.galerieOben() ? zahn : ''}</div>` : teilen}` +
        `${this.ui.geteilt ? this.nachSchnellHtml() : knopf({ akt: 'senden', text: 'Teilen-Optionen', klasse: 'ks-flach ks-klein-knopf' })}</div>`;
    }
  };

  V.assistent = {
    nachLaden() { const s = this.schritte(); this.ui.schritt = s.length > 1 ? 1 : 0; },
    kopf() {
      const s = this.schritte(), i = klemme(this.ui.schritt, 0, s.length - 1), st = s[i];
      return `<div class="ks-schritt-kopf"><div class="ks-schritt-zeile"><span class="ks-schritt-nr">Schritt ${i + 1} von ${s.length} · ${esc(st.name)}</span>${this.kUndo()}</div>` +
        `<h2 class="ks-titel">${esc(st.frage)}</h2><div class="ks-fortschritt" role="progressbar" aria-label="Fortschritt" aria-valuemin="1" aria-valuemax="${s.length}" aria-valuenow="${i + 1}"><span style="width:${((i + 1) / s.length * 100).toFixed(0)}%"></span></div></div>`;
    },
    seite() {
      const s = this.schritte(), i = klemme(this.ui.schritt, 0, s.length - 1), id = s[i].id;
      let h = '', knoepfeFuss = '';
      if (id === 'foto') h = this.quelle ? `<p class="ks-text">Das Foto ist geladen. Du kannst auch ein anderes nehmen.</p><div class="ks-leer-knoepfe">${this.quellenKnoepfe()}</div>` : this.hilfe('Unten auf „Foto wählen“ tippen – oder das Beispielfoto nehmen.');
      else if (id === 'ausschnitt') {
        h = this.hilfe('Wähle ein Format. Das Bild passt sich an.') + this.formatChips(true) + this.ausrichtungSeg() + this.drehKnoepfe();
        if (this.an('zuschneiden') || this.an('gerade')) h += `<div class="ks-reihe">${knopf({ akt: 'zs-oeffnen', text: 'Genau zuschneiden', icon: 'zuschneiden', klasse: 'ks-breit-knopf' })}</div>`;
      } else if (id === 'aussehen') {
        h = this.hilfe('Tippe eine Stimmung an. Gefällt sie nicht, tippe „Original“.');
        if (this.an('autoVerbessern')) h += `<div class="ks-reihe">${knopf({ akt: 'auto', text: 'Automatisch verbessern', icon: 'zauber', klasse: 'ks-breit-knopf' })}</div>`;
        if (this.an('filter')) h += `<div class="ks-raster-2" role="group" aria-label="Stimmung">${liste('FILTER').slice(0, this.gross() ? 6 : 8).map(f => chip('filter', f.id, f.name, this.Z.filter === f.id)).join('')}</div>`;
        else if (this.an('sw')) h += `<div class="ks-reihe">${knopf({ akt: 'sw', text: 'Schwarz-Weiß', klasse: 'ks-chip' + (/^sw/.test(this.Z.filter) ? ' ks-an' : ''), gedrueckt: /^sw/.test(this.Z.filter) })}</div>`;
        if (this.an('anpassen')) h += this.regler('anp.licht', 'Helligkeit', -100, 100, 1);
      } else if (id === 'wetter') h = this.panelWetter(true);
      else if (id === 'text') {
        h = this.panelText();
      } else if (id === 'senden') { const sh = this.sendenHtml(true); h = sh.inhalt; knoepfeFuss = sh.knoepfe; }   // Teilen/Sichern neben „Zurück“ statt im Rollbereich
      const zurueck = i > 0 ? knopf({ akt: 'schritt-zurueck', text: 'Zurück', icon: 'links', klasse: 'ks-gross-knopf ks-flach' }) : '<span></span>';
      const zurueckKlein = knopf({ akt: 'schritt-zurueck', label: 'Zurück', titel: 'Zurück', icon: 'links', klasse: 'ks-flach ks-rund' });   // nur Pfeil: Platz für Teilen/Sichern in derselben Zeile
      const weiter = i < s.length - 1 ? knopf({ akt: 'schritt-vor', text: i === 0 && !this.quelle ? 'Weiter' : 'Weiter', html: '', klasse: 'ks-gross-knopf ks-primaer ks-weiter', aus: !this.quelle }) : '';
      return `<div class="ks-seite-inhalt">${h}</div>${knoepfeFuss ? `<div class="ks-seite-fuss ks-fuss-senden">${zurueckKlein}${knoepfeFuss}</div>` : `<div class="ks-seite-fuss ks-nav">${zurueck}${weiter}</div>`}` +
        (i > 0 && i < s.length - 1 ? `<p class="ks-hilfe ks-hilfe-fest ks-ueberspringen">Nichts ändern? Einfach „Weiter“ – der Schritt wird übersprungen.</p>` : '');
    }
  };

  V.werkzeug = {
    werkzeuge() {
      const F = n => this.an(n), w = [];
      if (F('zuschneiden') || F('drehen') || F('spiegeln') || F('gerade')) w.push(['ausschnitt', 'Zuschnitt', 'zuschneiden']);
      if (F('anpassen') || F('autoVerbessern')) w.push(['anpassen', 'Anpassen', 'regler']);
      if (F('filter') || F('sw') || F('effekte') || F('wetterEffekte')) w.push(['filter', 'Filter', 'filter']);
      if (F('daten')) w.push(['wetter', 'Wetter', 'wetter']);
      if (F('text') || F('sticker') || F('emojis')) w.push(['text', 'Text', 'text']);
      if (F('formate') || F('rahmen')) w.push(['format', 'Format', 'format']);
      return w;
    },
    kopf() { return this.kopfHtml(this.kNeu(), this.kUndo(), this.kSenden()); },
    zusatz() {
      if (!this.quelle || !this.an('vorherNachher')) return '';
      return `<div class="ks-schwebe ks-schwebe-unten">${knopf({ akt: 'original', text: 'Original', icon: 'auge', gedrueckt: this.ui.original, klasse: 'ks-glas-knopf ks-original', label: 'Original zeigen (gedrückt halten)' })}</div>`;
    },
    seite() {
      if (!this.quelle) return '';
      const w = V.werkzeug.werkzeuge.call(this).filter(x => x[0] !== 'ausschnitt' || true);
      const panels = w.filter(x => x[0] !== 'ausschnitt');
      if (!panels.find(x => x[0] === this.ui.werkzeug)) this.ui.werkzeug = panels.length ? panels[0][0] : null;
      const id = this.ui.werkzeug;
      const inhalt = id === 'anpassen' ? this.panelAnpassen() : id === 'filter' ? this.panelFilter() : id === 'wetter' ? this.panelWetter(false) : id === 'text' ? this.panelText() : id === 'format' ? this.panelFormat() : '';
      const leiste = w.map(([wid, n, i]) => knopf({ akt: 'werkzeug', wert: wid, icon: i, text: n, klasse: 'ks-werkzeug' + (wid === id ? ' ks-an' : ''), gedrueckt: wid === id })).join('');
      return (inhalt ? `<div class="ks-seite-inhalt">${inhalt}</div>` : '') + (leiste ? `<div class="ks-seite-fuss ks-werkzeugleiste" role="toolbar" aria-label="Werkzeuge">${leiste}</div>` : '');
    }
  };

  V.buehne = {
    kopf() { return this.kopfHtml(this.kNeu(), this.kUndo(), this.kSenden()); },
    zusatz() {
      if (!this.quelle) return '';
      const F = n => this.an(n), b = [];
      if (F('text')) b.push(['text', 'Text', 'text']);
      if (F('sticker') || F('emojis')) b.push(['sticker', F('sticker') ? 'Sticker' : 'Emoji', 'sticker']);
      if (F('daten')) b.push(['wetter', 'Wetter', 'wetter']);
      if (F('filter') || F('sw')) b.push(['filter', 'Filter', 'filter']);
      if (F('formate') || F('zuschneiden') || F('drehen') || F('rahmen')) b.push(['format', 'Format', 'format']);
      const o = F('vorherNachher') ? `<div class="ks-schwebe ks-schwebe-unten">${knopf({ akt: 'original', text: 'Original', icon: 'auge', gedrueckt: this.ui.original, klasse: 'ks-glas-knopf ks-original', label: 'Original zeigen (gedrückt halten)' })}</div>` : '';
      return o + (b.length ? `<div class="ks-leiste-senkrecht" role="toolbar" aria-label="Gestalten">${b.map(([id, n, i]) => knopf({ akt: 'leiste', wert: id, icon: i, text: n, klasse: 'ks-werkzeug ks-glas-knopf' + (this.ui.leistenPanel === id ? ' ks-an' : ''), gedrueckt: id === 'filter' ? this.ui.leistenPanel === 'filter' : null })).join('')}</div>` : '');
    },
    seite() {
      if (!this.quelle) return '';
      if (this.ui.leistenPanel === 'filter') return `<div class="ks-seite-inhalt">${this.an('sw') ? `<div class="ks-reihe">${knopf({ akt: 'sw', text: 'Schwarz-Weiß', klasse: 'ks-chip' + (/^sw/.test(this.Z.filter) ? ' ks-an' : ''), gedrueckt: /^sw/.test(this.Z.filter) })}</div>` : ''}${this.filterChips()}</div>`;
      return this.an('hilfeTexte') ? `<div class="ks-seite-inhalt">${this.hilfe('Tippe rechts auf Text, Sticker oder Wetter. Dann im Bild verschieben.')}</div>` : '';
    }
  };

  V.postkarte = {
    kopf() { return this.kopfHtml(this.kNeu(), this.kUndo(), this.kSenden()); },
    seite() {
      if (!this.quelle) return '';
      const hinten = this.ui.seite === 'hinten', rs = this.Z.postkarte.rueckseite, F = n => this.an(n);
      let h = '';
      if (F('rueckseite')) h += `<div class="ks-reihe ks-reihe-mitte"><div class="ks-segment" role="group" aria-label="Seite">${chip('seite-wahl', 'vorne', 'Vorderseite', !hinten)}${chip('seite-wahl', 'hinten', 'Rückseite', hinten)}</div>${knopf({ akt: 'wenden', text: 'Umdrehen', icon: 'wenden', klasse: 'ks-flach' })}</div>`;
      if (!hinten) {
        if (F('postkarte')) h += gruppe('Gruß', `<input type="text" class="ks-eingabe" data-eingabe="gruss" data-fk="gruss-inline" aria-label="Gruß auf der Vorderseite" data-eingabe-ziel="gruss-inline" value="${esc(this.Z.postkarte.gruss)}" placeholder="Grüße aus …">` + this.kiKnopf('gruss') + this.emojiLeiste('gruss-inline'));
        if (F('daten')) h += gruppe('Wetterdaten', this.an('datenEinzeln') ? this.datenChips(true) : schalter('wetter-zeigen', '1', 'Wetterdaten zeigen', this.Z.overlay.stil !== 'aus'));
        const k = [];
        if (F('zuschneiden') || F('drehen') || F('gerade')) k.push(knopf({ akt: 'zs-oeffnen', text: 'Zuschnitt', icon: 'zuschneiden', klasse: 'ks-werkzeug' }));
        if (F('filter') || F('sw') || F('anpassen')) k.push(knopf({ akt: 'leiste', wert: 'filter-blatt', text: 'Aussehen', icon: 'filter', klasse: 'ks-werkzeug' }));
        if (F('text')) k.push(knopf({ akt: 'text-neu', text: 'Text', icon: 'text', klasse: 'ks-werkzeug' }));
        if (F('sticker') || F('emojis')) k.push(knopf({ akt: 'sticker-blatt', text: 'Sticker', icon: 'sticker', klasse: 'ks-werkzeug' }));
        if (k.length) var fuss = `<div class="ks-seite-fuss ks-werkzeugleiste" role="toolbar" aria-label="Werkzeuge">${k.join('')}</div>`;
      } else {
        h += gruppe('Dein Text', `<textarea class="ks-eingabe ks-hand" rows="4" data-eingabe="rs-text" data-fk="rs-text" aria-label="Text auf der Rückseite" placeholder="Liebe Grüße …">${esc(rs.text)}</textarea>` + this.kiKnopf('rs-text') + this.emojiLeiste('rs-text'));
        h += gruppe('Unterschrift', `<input type="text" class="ks-eingabe ks-hand" data-eingabe="rs-unterschrift" data-fk="rs-u" aria-label="Unterschrift" value="${esc(rs.unterschrift)}" placeholder="Dein Name">`);
        h += gruppe('An (freiwillig)', `<textarea class="ks-eingabe" rows="2" data-eingabe="rs-empfaenger" data-fk="rs-e" aria-label="Empfänger" placeholder="Name und Adresse">${esc(rs.empfaenger)}</textarea>` + this.hilfe('Die Adresse bleibt auf deinem Gerät. Versand per Post gibt es hier nicht.'));
        h += schalter('rs-schalter', 'briefmarke', 'Briefmarke mit Wetter', rs.briefmarke) + schalter('rs-schalter', 'stempel', 'Poststempel mit Datum und Ort', rs.stempel);
      }
      return `<div class="ks-seite-inhalt">${h}</div>` + (typeof fuss === 'string' ? fuss : '');
    }
  };
  AKT.leiste = (function (alt) { return function (w) { if (w === 'filter-blatt') { this.oeffneBlatt('filter'); return; } alt.call(this, w); }; })(AKT.leiste);

  V.sucher = {
    nachLaden() { this.ui.ansicht = 'bearbeiten'; },
    kopf() {
      if (this.ui.ansicht === 'live') return this.kopfHtml(knopf({ akt: 'live-stopp', text: 'Abbrechen', klasse: 'ks-flach' }), `<h2 class="ks-titel">Sucher</h2>`, this.zahnradKnopf());
      return this.kopfHtml(this.kNeu(), `<h2 class="ks-titel">${this.quelle ? 'Fertig' : 'Kamera'}</h2>`, '');
    },
    zusatz() {
      if (this.ui.ansicht !== 'live') return '';
      return this.sucherZoomHtml();
    },
    seite() {
      if (this.ui.ansicht === 'live') {
        const chips = this.an('daten') && this.an('datenEinzeln') ? this.datenChips(true) : '';
        return `<div class="ks-seite-inhalt">${this.sucherWerkzeuge()}${chips}</div>${this.sucherFuss()}`;
      }
      if (!this.quelle) return '';
      const s = this.ui.senden;
      return `<div class="ks-seite-inhalt"></div><div class="ks-seite-fuss ks-sucher-fertig">${(this.an('teilen') || this.an('sichern')) ? knopf({ akt: 'schnell-teilen', text: s.erg ? this.teilenWort() : 'Wird vorbereitet …', icon: 'teilen', klasse: 'ks-primaer ks-gross-knopf', aus: !s.erg }) : ''}` +
        `<div class="ks-reihe ks-reihe-mitte">${knopf({ akt: 'zu-werkzeug', text: 'Bearbeiten', icon: 'regler', klasse: 'ks-breit-knopf' })}${this.an('neuesFoto') ? '' : knopf({ akt: 'neues-foto', text: 'Neues Foto', icon: 'kamera', klasse: 'ks-breit-knopf ks-flach' })}</div></div>`;
    }
  };

  /* ---------- Öffentliche Schnittstelle ---------- */
  // Startwerte (o.start, Teil eines Zustands: format, overlay, daten, rahmen, ausgabe …) ändern sich im Konfigurator:
  // nur die geänderten Werte kommen in den laufenden Zustand und in den Verlauf; alles andere, was jemand im Studio bearbeitet hat, bleibt.
  P.startAnwenden = function (neu) {
    const alt = this.o.start || {}; this.o.start = neu;
    const gl = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const diff = (a, b, z) => Object.keys(b).forEach(k => {
      if (istObj(b[k])) { if (!istObj(z[k])) z[k] = {}; diff(istObj(a) ? a[k] : undefined, b[k], z[k]); }
      else if (!gl(a && a[k], b[k])) z[k] = tief(b[k]);
    });
    const vorher = JSON.stringify(this.Z);
    diff(alt, neu, this.Z);
    this.verlauf = this.verlauf.map(j => { const z = JSON.parse(j); diff(alt, neu, z); return JSON.stringify(z); });
    return JSON.stringify(this.Z) !== vorher;
  };
  P.setze = function (o) {
    o = o || {};
    let neu = false;
    if (o.start && JSON.stringify(o.start) !== JSON.stringify(this.o.start || {}) && this.startAnwenden(o.start)) this.nachAenderung();
    if (o.funktionen && JSON.stringify(o.funktionen) !== JSON.stringify(this.F)) { this.F = Object.assign({}, o.funktionen); neu = true; }
    if ('stufenWahl' in o && jaNein(o.stufenWahl) !== jaNein(this.o.stufenWahl)) { this.o.stufenWahl = jaNein(o.stufenWahl); neu = true; }
    // Hat der Nutzer nur „Einfach | Profi“ gewechselt, holt dieselbe Vorgabe der Seite ihn nicht zurück
    const nurStufe = o.variante === this.vorgabeVariante && this.stufeDa() && STUFEN.some(s => s[2] === o.variante);
    if (o.variante && VARIANTEN.includes(o.variante)) this.vorgabeVariante = o.variante;
    if (o.variante && VARIANTEN.includes(o.variante) && o.variante !== this.variante && !nurStufe) {
      const war = this.variante; this.variante = o.variante; neu = true;
      this.ui.auswahl = null; this.ui.ansicht = 'bearbeiten'; this.ui.leistenPanel = null; this.ui.seite = 'vorne';
      if (o.variante === 'postkarte' || war === 'postkarte') {
        if (o.variante === 'postkarte') { this.variantenZ(this.Z); this.Z.zuschnitt = null; } else { this.Z.postkarte.an = false; if (this.Z.format === 'postkarte') this.Z.format = (this.o.start && this.o.start.format) || 'original'; this.Z.zuschnitt = null; }
        if (this.quelle) this.commit('variante');
      }
      if (o.variante === 'assistent') this.ui.schritt = this.quelle ? 1 : 0;
    }
    if (o.wetter) { this.wetter = o.wetter; this.nachAenderung(); this.zeichneStart(); }
    if (o.optionen) {   // wirkt sofort, ohne Neuladen (auch bei offenem Sucher)
      const war = this.optionen.vorschauStart;
      this.optionen = mische(this.optionen, o.optionen); this.liveKey = '';
      if (this.optionen.vorschauStart !== war && this.appModus()) this.ui.appAn = true;   // „app“ neu gewählt: wieder auf die Startseite
      this.galerieAnwenden(); this.zeichneStart();
    }
    if (o.theme) { this.theme = o.theme; this.root.dataset.ksTheme = ['hell', 'dunkel'].includes(o.theme) ? o.theme : 'auto'; }
    if ('beispielFoto' in o) { this.o.beispielFoto = o.beispielFoto; neu = true; }
    if ('hilfen' in o) { this.hilfen = o.hilfen || {}; neu = true; }
    if (o.appName && o.appName !== this.appName) { this.appName = o.appName; this.nachAenderung(); }
    if (neu) {
      if (this.ui.ansicht === 'live') { this.stoppeLive(); this.ui.ansicht = 'bearbeiten'; }   // aufbauen() schließt die Kamera
      this.schliesseBlatt(); this.aufbauen(); this.nachAenderung(); this.galerieLaden();
    } else this.zeichneUI();
  };
  P.zerstoere = function () {
    this.stoppeLive(); this.leerQuelleFrei(); this.galAnsichtFrei(); this.zeigUrlsFrei();
    if (this.audio) { try { this.audio.close(); } catch (e) { /* egal */ } this.audio = null; }
    clearTimeout(this.vorbTimer); clearTimeout(this.thumbTimer); clearTimeout(this.toastTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.thumbVersion++; this.exportNr++;
    try { this.ro.disconnect(); } catch (e) { /* egal */ }
    document.removeEventListener('paste', this._einfuegen);
    document.removeEventListener('keydown', this._taste);
    if (this.quelle && E() && E().freigeben) try { E().freigeben(this.quelle); } catch (e) { /* egal */ }
    this.quelle = null;
    if (this.$ && this.$.cv) { this.$.cv.width = 0; this.$.cv.height = 0; }
    if (this.$ && this.$.cv2) { this.$.cv2.width = 0; this.$.cv2.height = 0; }
    this.root.remove();
  };

  /* Vorher/Nachher: Gedrückthalten zeigt das Original */
  document.addEventListener('pointerdown', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('.ks .ks-original');
    if (!b) return;
    const root = b.closest('.ks'), inst = root && root._ksInst; if (!inst) return;
    inst.ui.original = true; inst.zeichnen(); b.setAttribute('aria-pressed', 'true');
    const los = () => { inst.ui.original = false; inst.zeichnen(); inst.zeichneUI(); window.removeEventListener('pointerup', los); window.removeEventListener('pointercancel', los); };
    window.addEventListener('pointerup', los); window.addEventListener('pointercancel', los);
  }, true);

  window.KSStudio = {
    VARIANTEN: VARIANTEN.slice(),
    mount(element, optionen) {
      if (!element) throw new Error('KSStudio.mount: Kein Element angegeben.');
      const inst = new Studio(element, optionen);
      inst.root._ksInst = inst;
      return {
        setze: o => inst.setze(o),
        zustand: () => JSON.parse(JSON.stringify(inst.Z)),
        zerstoere: () => inst.zerstoere(),
        sucher: () => inst.starteLive(true),   // öffnet den eigenen Sucher mit dem aktuellen Design (z. B. für den Zugangsknopf)
        neuesFoto: () => inst.$.dateiKamera.click(),
        _inst: inst
      };
    }
  };
})();
