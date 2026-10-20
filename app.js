/* app.js – Wedderleuchte 0.9.0 (gebaut auf dem Code der WeddaApp)
   Reiter: Wetter (Startseite mit 4 Modulen auf dem Himmel-Verlauf), Graphs (meteogramm.js), Kamera (Teilen-Bildschirm), Rad/Sat (wpkarte.js, dazu Karten), Mehr.
   Daten: Open-Meteo (best_match). Gemerkt wird nur im Browser (localStorage, Schlüssel wedder-…). */
(function () {
  'use strict';

  var VERSION = '0.9.0';
  var APP_NAME = 'Wedderleuchte';
  var METEO = 'https://api.open-meteo.com/v1/forecast';
  var GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  var RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';
  var TOPO = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

  var STANDARDORTE = [
    { id: 'mannheim', name: 'Mannheim', lat: 49.4875, lon: 8.466 },
    { id: 'mengerschied', name: 'Mengerschied', lat: 49.91667, lon: 7.5 },
    { id: 'corralejo', name: 'Corralejo', lat: 28.73079, lon: -13.86749 },
    { id: 'el-cotillo', name: 'El Cotillo', lat: 28.68264, lon: -14.00637 },
    { id: 'costa-calma', name: 'Costa Calma', lat: 28.16155, lon: -14.22691 },
    { id: 'morro-jable', name: 'Morro Jable', lat: 28.0498, lon: -14.3488 }
  ];
  var WIND_EINHEITEN = [
    { id: 'kmh', name: 'km/h', faktor: 1 }, { id: 'ms', name: 'm/s', faktor: 1 / 3.6 },
    { id: 'mph', name: 'mph', faktor: 0.621371 }, { id: 'kn', name: 'kn', faktor: 0.539957 }
  ];
  var TABS = [
    { id: 'wetter', name: 'Wetter', ikon: 'cloudsun' },
    { id: 'graphs', name: 'Graphs', ikon: 'chart' },
    { id: 'kamera', name: 'Kamera', ikon: 'camera' },
    { id: 'radsat', name: 'Rad/Sat', ikon: 'radar' },
    { id: 'mehr', name: 'Mehr', ikon: 'more' }
  ];
  var HIMMEL = ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'];
  var RICHTUNG_KURZ = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  var WOCHENTAG = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

  // ---------- Helfer ----------
  var $ = function (s, w) { return (w || document).querySelector(s); };
  var $$ = function (s, w) { return Array.prototype.slice.call((w || document).querySelectorAll(s)); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var speicher = {
    // Eigener Vorsatz: alle Apps unter stephandel.github.io teilen sich denselben Speicher
    lesen: function (k, std) { try { var v = localStorage.getItem('wedder-' + k); return v == null ? std : JSON.parse(v); } catch (e) { return std; } },
    schreiben: function (k, v) { try { localStorage.setItem('wedder-' + k, JSON.stringify(v)); } catch (e) { } }
  };
  function zahl(v, nk) { return v == null || isNaN(v) ? '–' : Number(v).toFixed(nk || 0).replace('.', ',').replace('-', '−'); }
  function grad(v) { return v == null || isNaN(v) ? '–' : zahl(Math.round(v)) + '°'; }
  function datumTeile(s) { var m = /(\d+)-(\d+)-(\d+)/.exec(s); return { j: +m[1], m: +m[2], t: +m[3] }; }
  function wochentag(s) { var d = datumTeile(s); return WOCHENTAG[new Date(d.j, d.m - 1, d.t).getDay()]; }
  function uhrzeit(s) { return s.slice(11, 16); }
  function stundeText(s) { return pad(+s.slice(11, 13)); }
  function himmelsrichtung(grad_) { return HIMMEL[Math.round(((grad_ % 360) + 360) % 360 / 45) % 8]; }

  // ---------- Zustand ----------
  var orte = speicher.lesen('orte', STANDARDORTE.slice());
  var favoriten = speicher.lesen('favoriten', []);
  var ort = speicher.lesen('ort', null) || orte[0];
  var windId = speicher.lesen('wind', 'kmh');
  var daten = null;           // aufbereitete Wetterdaten
  var status = 'laden';       // laden | ok | fehler
  var offline = !navigator.onLine;
  var tab = 'wetter';
  var radsatModus = speicher.lesen('radsat-modus', 'radsat');
  var karten = { radsat: null, karten: null };
  var mgInstanz = null, mgSchluessel = '';
  var suchTreffer = [], suchText = '';
  var radarBild = null;       // {host, pfad, zeit}

  function windEinheit() { return WIND_EINHEITEN.filter(function (e) { return e.id === windId; })[0] || WIND_EINHEITEN[0]; }
  function wind(v) { return zahl(v * windEinheit().faktor); }
  function istFavorit(o) { return favoriten.indexOf(o.id) >= 0; }
  function sortierteOrte() {
    return orte.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) {
      var fa = istFavorit(a.o) ? 0 : 1, fb = istFavorit(b.o) ? 0 : 1; return fa - fb || a.i - b.i;
    }).map(function (x) { return x.o; });
  }

  // ---------- Wettercodes ----------
  function codeInfo(code, tag) {
    var nacht = !tag;
    if (code === 0) return nacht ? ['mond', 'Klar'] : ['sonne', 'Sonnig'];
    if (code === 1) return nacht ? ['mondwolke', 'Überwiegend klar'] : ['sonnewolke', 'Heiter'];
    if (code === 2) return nacht ? ['mondwolke', 'Wolkig'] : ['wolke', 'Wolkig'];
    if (code === 3) return ['bedeckt', 'Bedeckt'];
    if (code === 45 || code === 48) return ['nebel', 'Nebel'];
    if (code >= 51 && code <= 57) return ['niesel', 'Nieselregen'];
    if (code === 61 || code === 63 || code === 65) return ['regen', code === 61 ? 'Leichter Regen' : code === 63 ? 'Regen' : 'Starker Regen'];
    if (code === 66 || code === 67) return ['schneeregen', 'Gefrierender Regen'];
    if (code === 71 || code === 73 || code === 75 || code === 77) return ['schnee', code === 71 ? 'Leichter Schneefall' : code === 77 ? 'Schneegriesel' : 'Schneefall'];
    if (code >= 80 && code <= 82) return [nacht ? 'mondschauer' : 'schauer', code === 80 ? 'Leichte Schauer' : code === 81 ? 'Schauer' : 'Starke Schauer'];
    if (code === 85 || code === 86) return ['schnee', 'Schneeschauer'];
    if (code === 95) return ['gewitter', 'Gewitter'];
    if (code === 96 || code === 99) return ['gewitter', 'Gewitter mit Hagel'];
    return ['wolke', 'Wolkig'];
  }
  function istSchnee(code) { return (code >= 71 && code <= 77) || code === 85 || code === 86; }
  function symbol(art) { return WetterSymbol(art); }
  function symbolFuerCode(code, tag) { return symbol(codeInfo(code, tag)[0]); }

  // ---------- Symbol nach tatsächlichem Wetter ----------
  // weather_code setzt Regen auch bei 0,0 mm, zählt Sonne durch Schleierwolken als „bedeckt“ und nimmt beim Tag die schlimmste Stunde.
  // Deshalb nur aufhellen, nie verdüstern: Regen nur mit Menge; tags nach Sonnenscheindauer, reine Sonne aber nur bei wenig Wolken; nachts Modellcode.
  function wetterCode(code, tag, regen, sonne, wolken) {
    if (code >= 51 && regen < 0.1) code = 3;
    if (code > 3 || !tag || !(sonne >= 900)) return code;
    return Math.min(code, sonne >= 2700 && wolken < 30 ? 0 : 1);
  }
  function stundenCode(m, i, code, regen) {
    var h = m.h;
    if (i < 0 || i >= h.time.length) return wetterCode(code, false, regen);
    return wetterCode(code, h.is_day[i], regen, h.sunshine_duration && h.sunshine_duration[i], h.cloud_cover && h.cloud_cover[i]);
  }
  function tagesCode(d, i) {
    var code = d.weather_code[i];
    if (code >= 51 && d.precipitation_sum[i] >= 0.5) return code;
    if (code >= 51) code = 3;
    if (!d.daylight_duration || !d.sunshine_duration || d.sunshine_duration[i] == null || !d.daylight_duration[i]) return d.weather_code[i];
    var a = d.sunshine_duration[i] / d.daylight_duration[i], wolken = d.cloud_cover_mean ? d.cloud_cover_mean[i] : 100;
    return Math.min(code, a >= 0.75 && wolken < 30 ? 0 : a >= 0.3 ? 1 : a >= 0.1 ? 2 : 3);
  }
  // Karte: gleiche Regel mit den Werten des Gitterpunkts (NaN = fehlt, dann bleibt der Modellcode)
  function kartenCode(code, tag, w) { return wetterCode(code, tag, w.regen, w.sonne, w.wolken); }
  function aktuellCode(m) { return stundenCode(m, m.idx + 1 < m.h.time.length ? m.idx + 1 : m.idx, m.c.weather_code, m.c.precipitation); }

  // ---------- Daten holen ----------
  function url(o) {
    return METEO + '?latitude=' + o.lat + '&longitude=' + o.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl' +
      '&hourly=temperature_2m,weather_code,is_day,precipitation,precipitation_probability,sunshine_duration,cloud_cover' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,daylight_duration,cloud_cover_mean,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max' +
      '&minutely_15=precipitation&forecast_minutely_15=8&forecast_days=8&timezone=auto&wind_speed_unit=kmh&models=best_match';
  }
  function laden(erneut) {
    status = daten && !erneut ? 'ok' : 'laden';
    if (!daten) zeichnen();
    var gemerkt = speicher.lesen('daten-' + ort.id, null);
    return fetch(url(ort)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      daten = { ort: ort.id, roh: j, geholt: Date.now() };
      speicher.schreiben('daten-' + ort.id, daten);
      status = 'ok'; offline = false; zeichnen(); hinweis('');
    }).catch(function () {
      if (gemerkt && gemerkt.roh) { daten = gemerkt; status = 'ok'; offline = true; hinweis('Offline · Stand ' + stand(gemerkt.geholt)); }
      else { daten = null; status = 'fehler'; }
      zeichnen();
    });
  }
  function stand(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var hinweisUhr = null;
  function hinweis(text) {
    var m = $('#meldung'); if (!m) return;
    m.textContent = text; m.hidden = !text;
    clearTimeout(hinweisUhr);
    if (text && text.indexOf('Offline') !== 0) hinweisUhr = setTimeout(function () { m.hidden = true; }, 4000);
  }
  function aufbereiten() {
    if (!daten || daten.ort !== ort.id || !daten.roh || !daten.roh.current) return null;
    var j = daten.roh, c = j.current, h = j.hourly, d = j.daily;
    var jetzt = c.time, std = jetzt.slice(0, 13) + ':00';
    var idx = h.time.indexOf(std); if (idx < 0) idx = 0;
    return { j: j, c: c, h: h, d: d, jetzt: jetzt, idx: idx, offset: j.utc_offset_seconds || 0 };
  }

  // ---------- Texte: Regen ----------
  function regenSatz(m) {
    var v = (m.j.minutely_15 && m.j.minutely_15.precipitation) || [], zeiten = (m.j.minutely_15 && m.j.minutely_15.time) || [];
    if (v.length < 2) return null;
    var nass = v.map(function (x) { return x != null && x >= 0.1; });
    var code = m.h.weather_code[m.idx + 1] != null ? m.h.weather_code[m.idx + 1] : m.c.weather_code;
    var art = istSchnee(code) || istSchnee(m.c.weather_code) ? 'Schnee' : 'Regen';
    var erste = nass.indexOf(true);
    if (erste < 0) return 'Die nächsten 2 Stunden bleibt es trocken';
    var ende = erste; while (ende < nass.length && nass[ende]) ende++;
    function zeitNach(i) { var p = zeiten[i] ? uhrzeit(zeiten[i]) : null; return p; }
    if (erste === 0) {
      if (ende >= nass.length) return art + ' die nächsten 2 Stunden';
      return art + ' bis etwa ' + (zeitNach(ende) || '') + ' Uhr';
    }
    return art + ' ab ' + zeitNach(erste) + ' Uhr für ' + (ende - erste) * 15 + ' Minuten';
  }
  function trockenBis(m) {
    var h = m.h, i = m.idx, n = h.time.length, nass = function (k) { return h.precipitation[k] != null && h.precipitation[k] >= 0.1; };
    var heute = m.jetzt.slice(0, 10);
    function wann(k) {
      var t = h.time[k], tag = t.slice(0, 10), u = +t.slice(11, 13);
      var p = tag === heute ? '' : (tag === m.d.time[1] ? 'morgen ' : wochentag(t) + ' ');
      return p + u + ' Uhr';
    }
    if (nass(i)) { var k = i; while (k < n && nass(k)) k++; return k >= n ? 'Regen in den nächsten Tagen' : 'Regen bis ' + wann(k); }
    var f = i; while (f < n && !nass(f)) f++;
    return f >= n ? 'Die nächsten 8 Tage trocken' : 'Trocken bis ' + wann(f);
  }

  // ---------- Reiter: Wetter ----------
  function rose(grad_) {
    var r = 32, pf = (grad_ + 180) % 360;   // Pfeil zeigt, wohin der Wind weht
    return '<svg viewBox="0 0 64 64" role="img" aria-label="Windrichtung ' + esc(himmelsrichtung(grad_)) + '"><circle class="rose-ring" cx="32" cy="32" r="28"/>' +
      '<text x="32" y="8">N</text><text x="57" y="32">O</text><text x="32" y="57">S</text><text x="7" y="32">W</text>' +
      '<g transform="rotate(' + pf + ' 32 32)"><path class="rose-pfeil" d="M32 14 L38 38 L32 34 L26 38 Z"/></g></svg>';
  }
  function skelettWetter() {
    return '<div class="raster" aria-busy="true" aria-label="Wetter wird geladen">' +
      '<div class="kachel k-gross"><div class="skel" style="height:' + 'calc(var(--s8) * 6)' + '"></div></div>' +
      '<div class="kachel k-mittel"><div class="skel" style="height:calc(var(--s8) * 3)"></div></div>' +
      '<div class="kachel k-gross"><div class="skel" style="height:calc(var(--s8) * 10)"></div></div>' +
      '<div class="kachel k-mittel"><div class="skel" style="height:calc(var(--s8) * 6)"></div></div></div>';
  }
  function zustandHtml(ik, titel, text, knopf) {
    return '<div class="kachel zustand">' + Ikon(ik) + '<p><b>' + esc(titel) + '</b><br>' + esc(text) + '</p>' + (knopf || '') + '</div>';
  }
  function quellenZeile() {
    return '<p class="quellen-zeile">Wetterdaten: Open-Meteo.com (CC BY 4.0) · Radar: RainViewer · Karte: © OpenStreetMap-Mitwirkende, OpenTopoMap (CC BY-SA)</p>';
  }
  // Antippen der linken Hälfte wechselt die rechte Hälfte: Werte → Radar-Karte (DESIGN.md Regel 35); die Wahl wird gemerkt
  var AKT_ANSICHTEN = ['werte', 'radar'];
  var aktAnsicht = speicher.lesen('akt-ansicht', 'werte');
  if (AKT_ANSICHTEN.indexOf(aktAnsicht) < 0) aktAnsicht = 'werte';
  function aktuellModul(m) {
    var c = m.c, info = codeInfo(aktuellCode(m), c.is_day);
    var w = windEinheit(), radar = aktAnsicht === 'radar';
    var punkte = AKT_ANSICHTEN.map(function (a) { return '<i' + (a === aktAnsicht ? ' class="an"' : '') + '></i>'; }).join('');
    return '<article class="kachel k-gross aktuell-kachel" aria-label="Aktuell"><div class="aktuell">' +
      '<button type="button" class="akt-links tippbar" id="aktWechsel" aria-label="' + esc(grad(c.temperature_2m) + ', ' + info[1]) + '. Rechte Seite wechseln, jetzt ' + (radar ? 'Radar' : 'Werte') + '">' +
      '<span class="akt-sym">' + symbol(info[0]) + '</span><span class="hero">' + esc(grad(c.temperature_2m)) + '</span>' +
      '<span class="punkte" aria-hidden="true">' + punkte + '</span></button>' +
      '<div class="akt-rechts"><div class="lage">' + esc(info[1]) + '</div>' +
      (radar ? '<div class="radar-karte akt-radar" data-radar role="img" aria-label="Regenradar, letzte Aufnahme"><span class="radar-leer">Radar wird geladen …</span></div></div></div>' : '<dl class="werte">' +
      '<div><dt>Gefühlt</dt><dd>' + esc(grad(c.apparent_temperature)) + '</dd></div>' +
      '<div><dt>Wind</dt><dd>' + wind(c.wind_speed_10m) + ' <span class="einheit">' + esc(w.name) + '</span></dd></div>' +
      '<div><dt>Böen</dt><dd>' + wind(c.wind_gusts_10m) + ' <span class="einheit">' + esc(w.name) + '</span></dd></div>' +
      '<div><dt>Regen</dt><dd>' + zahl(c.precipitation, 1) + ' <span class="einheit">mm</span></dd></div>' +
      '<div><dt>Feuchte</dt><dd>' + zahl(c.relative_humidity_2m) + ' <span class="einheit">%</span></dd></div></dl>' +
      '<div class="rose">' + rose(c.wind_direction_10m) + '<span class="klein">' + esc(himmelsrichtung(c.wind_direction_10m)) + 'wind</span></div></div></div>') +
      '<p class="klein stand">' + (offline ? 'Offline · Stand ' + stand(daten.geholt) : 'Stand ' + uhrzeit(m.jetzt) + ' Uhr') + '</p></article>';
  }
  function stundenModul(m) {
    var spalten = '';
    for (var s = 0; s < 3; s++) {
      var i = m.idx + 1 + s * 6; if (i >= m.h.time.length) break;
      var info = codeInfo(stundenCode(m, i, m.h.weather_code[i], m.h.precipitation[i]), m.h.is_day[i]);
      var pp = m.h.precipitation_probability && m.h.precipitation_probability[i];
      spalten += '<div class="stunde" aria-label="' + stundeText(m.h.time[i]) + ' Uhr, ' + esc(info[1]) + ', ' + grad(m.h.temperature_2m[i]) + (pp != null ? ', Regenwahrscheinlichkeit ' + zahl(pp) + ' %' : '') + '">' +
        '<span class="uhr">' + stundeText(m.h.time[i]) + ' Uhr</span><span class="wsym-box">' + symbol(info[0]) + '</span>' +
        '<span class="temp">' + esc(grad(m.h.temperature_2m[i])) + '</span><span class="mm">' + zahl(m.h.precipitation[i], 1) + ' mm</span>' + (pp != null ? '<span class="mm">' + zahl(pp) + ' %</span>' : '') + '</div>';
    }
    return '<article class="kachel k-mittel" aria-label="Stunden"><h2 class="kachel-kopf">' + Ikon('calendar') + 'Nächste Stunden</h2><div class="stunden">' + spalten + '</div></article>';
  }
  function tageModul(m) {
    var d = m.d, wEin = windEinheit().name, zeilen = '';
    for (var i = 0; i < d.time.length; i++) {
      var info = codeInfo(tagesCode(d, i), 1), dt = datumTeile(d.time[i]);
      var sonne = d.sunshine_duration && d.sunshine_duration[i] != null ? zahl(d.sunshine_duration[i] / 3600, 1) + ' h Sonne' : '';
      var name = i === 0 ? 'Heute' : wochentag(d.time[i]);
      var pp = d.precipitation_probability_max && d.precipitation_probability_max[i] != null ? ' <span class="pp">· ' + zahl(d.precipitation_probability_max[i]) + '&nbsp;%</span>' : '';
      zeilen += '<div class="tag" role="row" aria-label="' + name + ', ' + esc(info[1]) + '">' +
        '<span class="name">' + name + '<small>' + dt.t + '.' + dt.m + '.</small></span>' +
        '<span class="wsym-box" title="' + esc(info[1]) + '">' + symbol(info[0]) + '</span>' +
        '<span class="t">' + esc(grad(d.temperature_2m_max[i])) + ' <span>' + esc(grad(d.temperature_2m_min[i])) + '</span></span>' +
        '<span class="sr"><span>' + sonne + '</span><span>' + zahl(d.precipitation_sum[i], 1) + ' mm' + pp + '</span></span>' +
        '<span class="w">' + wind(d.wind_speed_10m_max[i]) + ' ' + esc(wEin) + '</span></div>';
    }
    return '<article class="kachel k-gross" aria-label="Vorhersage 8 Tage"><h2 class="kachel-kopf">' + Ikon('calendar') + '8-Tage-Vorhersage</h2>' +
      '<div class="liste" role="table"><div class="liste-kopf" aria-hidden="true"><span>Tag</span><span></span><span>Max / Min</span><span>Sonne, Regen</span><span>Wind</span></div>' + zeilen + '</div></article>';
  }
  function regenModul(m) {
    var v = (m.j.minutely_15 && m.j.minutely_15.precipitation) || [], satz = regenSatz(m) || '';
    var bal = '';
    for (var i = 0; i < 8; i++) {
      var x = v[i] == null ? 0 : v[i];
      bal += x >= 0.1 ? '<i style="height:' + Math.max(8, Math.min(100, x / 1.5 * 100)).toFixed(0) + '%"></i>' : '<i class="trocken"></i>';
    }
    return '<article class="kachel k-mittel" aria-label="Regenradar"><h2 class="kachel-kopf">' + Ikon('radar') + 'Regenradar</h2>' +
      '<button type="button" class="radar-karte tippbar" id="radarKachel" data-radar aria-label="Regenradar öffnen"><span class="radar-leer">Radar wird geladen …</span></button>' +
      '<div class="radar-zeile"><b>' + esc(trockenBis(m)) + '</b><button type="button" class="chip" id="radarAuf">Karte öffnen' + Ikon('chevron') + '</button></div>' +
      '<div class="regen2h"><p aria-live="polite">' + esc(satz) + '</p>' +
      '<div class="balken" role="img" aria-label="' + esc(satz) + '">' + bal + '</div>' +
      '<div class="achse" aria-hidden="true"><span>Jetzt</span><span>+1 h</span><span>+2 h</span></div></div></article>';
  }
  function renderWetter() {
    var s = $('#tab-wetter'), m = status === 'ok' ? aufbereiten() : null;
    if (status === 'laden' && !m) { s.innerHTML = skelettWetter(); return; }
    if (!m) {
      s.innerHTML = zustandHtml('cloud', 'Das Wetter lässt sich gerade nicht laden.', 'Prüfe die Verbindung, dann versuchen wir es noch einmal.',
        '<button type="button" class="button" id="nochmal">Erneut versuchen</button>') + quellenZeile();
      return;
    }
    s.innerHTML = '<div class="raster">' + [aktuellModul(m), stundenModul(m), tageModul(m), regenModul(m)].join('') + '</div>' + quellenZeile();
    himmelSetzen(m);
    radarKachelFuellen();
    pruefeSchrift();
  }

  // ---------- Hintergrund: Himmel-Verlauf nach Wetterlage (DESIGN.md Regel 13) ----------
  function himmelLage(m) {
    var art = codeInfo(aktuellCode(m), m.c.is_day)[0];
    if (art === 'gewitter') return 'gewitter';
    if (art === 'schnee') return 'schnee';
    if (/regen|niesel|schauer/.test(art)) return 'regen';
    if (art === 'nebel') return 'nebel';
    // Dämmerung: 45 Minuten um Sonnenauf- und -untergang (Ortszeit als Text, daher Minuten vergleichen)
    var min = function (t) { return t ? +t.slice(11, 13) * 60 + +t.slice(14, 16) : null; }, jetzt = min(m.jetzt);
    var auf = m.d.sunrise && min(m.d.sunrise[0]), unter = m.d.sunset && min(m.d.sunset[0]);
    if ((auf != null && Math.abs(jetzt - auf) <= 45) || (unter != null && Math.abs(jetzt - unter) <= 45)) return 'daemmerung';
    if (!m.c.is_day) return 'nacht';
    return art === 'bedeckt' || art === 'wolke' ? 'bewoelkt' : 'klar';
  }
  function himmelSetzen(m) { document.documentElement.dataset.himmel = m ? himmelLage(m) : 'klar'; }

  // ---------- Radar-Kachel (RainViewer über abgedunkelter OpenTopoMap) ----------
  function radarInfo() {
    if (radarBild && Date.now() - radarBild.geholt < 5 * 60e3) return Promise.resolve(radarBild);
    return fetch(RAINVIEWER).then(function (r) { return r.json(); }).then(function (j) {
      var p = j.radar && j.radar.past && j.radar.past[j.radar.past.length - 1];
      if (!p) throw new Error('kein Bild');
      radarBild = { host: j.host, pfad: p.path, zeit: p.time, geholt: Date.now() };
      return radarBild;
    });
  }
  // Füllt alle Radar-Karten auf dem Startbildschirm (Regenradar-Kachel und rechte Hälfte von „Aktuell“)
  function radarKachelFuellen() {
    if (!$('[data-radar]')) return;
    radarInfo().then(function (r) {
      $$('[data-radar]').forEach(function (el) { radarKarteFuellen(el, r); });
    }).catch(function () {
      $$('[data-radar]').forEach(function (e) { e.innerHTML = '<span class="radar-leer">' + (offline ? 'Offline – das Radar braucht Verbindung.' : 'Das Radar ist gerade nicht erreichbar.') + '</span>'; });
    });
  }
  function radarKarteFuellen(el, r) {
    var Z = 6, n = Math.pow(2, Z), b = el.clientWidth || 300, h = el.clientHeight || 160;
    var rad = ort.lat * Math.PI / 180;
    var px = (ort.lon + 180) / 360 * n * 256, py = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * 256;
    var links = px - b / 2, oben = py - h / 2, html = '';
    for (var ty = Math.floor(oben / 256); ty <= Math.floor((oben + h) / 256); ty++) {
      for (var tx = Math.floor(links / 256); tx <= Math.floor((links + b) / 256); tx++) {
        if (ty < 0 || ty >= n) continue;
        var x = ((tx % n) + n) % n, pos = 'left:' + (tx * 256 - links).toFixed(1) + 'px;top:' + (ty * 256 - oben).toFixed(1) + 'px';
        html += '<img class="topo" alt="" src="' + TOPO.replace('{s}', 'abc'[(x + ty) % 3]).replace('{z}', Z).replace('{x}', x).replace('{y}', ty) + '" style="' + pos + '">';
        html += '<img alt="" src="' + r.host + r.pfad + '/256/' + Z + '/' + x + '/' + ty + '/2/1_1.png" style="' + pos + '">';
      }
    }
    var d = new Date(r.zeit * 1000 + (daten.roh.utc_offset_seconds || 0) * 1000);
    el.innerHTML = html + '<span class="radar-punkt"></span><span class="radar-zeit">' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + '</span>' +
      (el.classList.contains('akt-radar') ? '<span class="radar-name">Radar</span>' : '');
  }

  // ---------- Reiter: Graphs ----------
  function ortZeile(extra) {
    return '<div class="ort-zeile">' + Ikon('pin') + '<b>' + esc(ort.name) + '</b>' + (extra || '') + '</div>';
  }
  function mgAbbauen() { if (mgInstanz) { try { mgInstanz.abbauen(); } catch (e) { } } mgInstanz = null; mgSchluessel = ''; }
  function renderGraphs() {
    var s = $('#tab-graphs'), schl = ort.id + '|' + ort.lat + '|' + ort.lon;
    if (mgInstanz && mgSchluessel === schl && $('#graphs')) return;
    mgAbbauen();
    s.innerHTML = ortZeile() + '<div id="graphs"></div>' + quellenZeile();
    if (!window.Meteogramm) { $('#graphs').innerHTML = zustandHtml('chart', 'Das Diagramm fehlt.', 'Lade die App neu.'); return; }
    try { localStorage.removeItem('wedder-mg-zeilen'); localStorage.removeItem('wedder-mg-reihenfolge'); } catch (e) { }   // Zeilen fest wie im Konfigurator
    mgInstanz = Meteogramm.einbauen({
      ziel: '#graphs', orte: [{ id: ort.id, name: ort.name, lat: ort.lat, lon: ort.lon }],
      modelle: [{ id: 'best_match', name: 'Mix', lang: 'Beste Mischung', hinweis: 'Open-Meteo nimmt je Region das passendste Modell' }],
      karte: false, zeilen: ['sonne', 'temp', 'wind', 'regen'], zeilenStandard: ['sonne', 'temp', 'wind', 'regen'],
      werteKlug: false, wertePaare: [], merkschluessel: 'wedder-mg', zeitzone: 'auto'
    });
    mgSchluessel = schl;
  }

  // ---------- Reiter: Rad/Sat und Karten ----------
  function kartenAbbauen() {
    ['radsat', 'karten'].forEach(function (k) { if (karten[k]) { try { karten[k].abbauen(); } catch (e) { } karten[k] = null; } });
  }
  var kartenOrt = '';
  function renderRadSat() {
    var s = $('#tab-radsat');
    var schl = ort.id + '|' + radsatModus;
    if (karten[radsatModus] && kartenOrt === schl && $('#karte')) { try { karten[radsatModus].sichtbar(); } catch (e) { } return; }
    kartenAbbauen();
    s.innerHTML = ortZeile() +
      '<div class="segment" id="karte-zeile" role="radiogroup" aria-label="Ansicht">' +
      '<button type="button" role="radio" data-modus="radsat" aria-checked="' + (radsatModus === 'radsat') + '">Radar &amp; Satellit</button>' +
      '<button type="button" role="radio" data-modus="karten" aria-checked="' + (radsatModus === 'karten') + '">Karten</button></div>' +
      '<div id="karte"></div>' + quellenZeile();
    if (!window.WetterKarte || !window.L) { $('#karte').innerHTML = zustandHtml('map', 'Die Karte fehlt.', 'Lade die App neu.'); return; }
    var off = daten && daten.roh ? (daten.roh.utc_offset_seconds || 0) : 0;
    karten[radsatModus] = WetterKarte.einbauen({
      ziel: '#karte', modus: radsatModus, ort: { id: ort.id, name: ort.name, lat: ort.lat, lon: ort.lon },
      orte: sortierteOrte().map(function (o) { return { id: o.id, name: o.name, lat: o.lat, lon: o.lon }; }), offset: off,
      symbol: function (code, tag, w) { return symbolFuerCode(w ? kartenCode(code, tag, w) : code, tag); },
      offline: false,
      merk: function (k, v) { if (v === undefined) return speicher.lesen('wk-' + k, null); speicher.schreiben('wk-' + k, v); return null; }
    });
    kartenOrt = schl;
    if (karten[radsatModus] && karten[radsatModus].sichtbar) setTimeout(function () { try { karten[radsatModus].sichtbar(); } catch (e) { } }, 60);
  }

  // ---------- Reiter: Mehr ----------
  function stern() {
    return '<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>';
  }
  function renderMehr() {
    var s = $('#tab-mehr'), fokus = document.activeElement && document.activeElement.id;
    var treffer = suchTreffer.map(function (t, i) {
      return '<div class="zeile"><button type="button" class="zeile-text tippbar" data-treffer="' + i + '"><b>' + esc(t.name) + '</b><small>' + esc(t.region) + '</small></button></div>';
    }).join('');
    var liste = sortierteOrte().map(function (o) {
      var fav = istFavorit(o), eigen = !STANDARDORTE.some(function (x) { return x.id === o.id; });
      return '<div class="zeile"><button type="button" class="ikon-knopf tippbar" data-fav="' + esc(o.id) + '" aria-pressed="' + fav + '" aria-label="' + esc(o.name) + (fav ? ' ist Favorit' : ' als Favorit markieren') + '">' + stern() + '</button>' +
        '<button type="button" class="zeile-text tippbar' + (o.id === ort.id ? ' aktiv-ort' : '') + '" data-ort="' + esc(o.id) + '"' + (o.id === ort.id ? ' aria-current="true"' : '') + '><b>' + esc(o.name) + '</b>' + (o.id === ort.id ? '<small>Aktueller Ort</small>' : '') + '</button>' +
        (eigen ? '<button type="button" class="ikon-knopf tippbar" data-weg="' + esc(o.id) + '" aria-label="' + esc(o.name) + ' entfernen">' + Ikon('x') + '</button>' : '') + '</div>';
    }).join('');
    var seg = WIND_EINHEITEN.map(function (e) { return '<button type="button" role="radio" data-wind="' + e.id + '" aria-checked="' + (e.id === windId) + '">' + e.name + '</button>'; }).join('');
    s.innerHTML = '<h2 class="titel-gross">' + APP_NAME + '</h2>' +
      '<form class="suchfeld" id="suchForm" role="search">' + Ikon('search') + '<input id="suchfeld" type="search" placeholder="Ort suchen" aria-label="Ort suchen" autocomplete="off" autocapitalize="words" value="' + esc(suchText) + '"></form>' +
      (treffer ? '<div class="gruppe abschnitt" aria-label="Suchergebnisse">' + treffer + '</div>' : (suchText && suchText.length > 1 && !suchLaeuft ? '<p class="klein abschnitt">Keinen Ort gefunden.</p>' : '')) +
      '<section class="abschnitt"><h2>Orte und Favoriten</h2><div class="gruppe">' + liste +
      '<div class="zeile"><button type="button" class="zeile-text tippbar" id="gpsKnopf"><b>Aktuellen Standort verwenden</b><small>Fragt vorher bei dir nach</small></button><span class="ikon-knopf" aria-hidden="true">' + Ikon('pin') + '</span></div></div></section>' +
      '<section class="abschnitt"><h2>Darstellung</h2><div class="gruppe"><div class="einstell"><span id="windLabel">Wind in</span><div class="segment" role="radiogroup" aria-labelledby="windLabel">' + seg + '</div></div>' +
      '<div class="einstell"><span>Temperatur in °C. Hell und Dunkel folgen deinem iPhone.</span></div></div></section>' +
      '<section class="abschnitt"><h2>Quellen</h2><div class="gruppe"><ul class="quellen-liste">' +
      '<li>Wetterdaten: Open-Meteo.com (CC BY 4.0), Modell „Beste Mischung“</li><li>Karte: © OpenStreetMap-Mitwirkende, OpenTopoMap (CC BY-SA)</li><li>Radar: RainViewer</li><li>Satellit: EUMETSAT</li></ul></div></section>' +
      '<p class="quellen-zeile">' + APP_NAME + ' ' + VERSION + ' · Wetterdaten: Open-Meteo.com (CC BY 4.0)</p>';
    if (fokus === 'suchfeld') { var f = $('#suchfeld'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  }
  var suchLaeuft = false, suchUhr = null;
  function suchen(text) {
    suchText = text; clearTimeout(suchUhr);
    if (text.trim().length < 2) { suchTreffer = []; suchLaeuft = false; renderMehr(); return; }
    suchLaeuft = true;
    suchUhr = setTimeout(function () {
      fetch(GEO + '?name=' + encodeURIComponent(text.trim()) + '&count=6&language=de&format=json').then(function (r) { return r.json(); }).then(function (j) {
        if (suchText !== text) return;
        suchTreffer = (j.results || []).map(function (r) {
          return { id: 'geo-' + r.id, name: r.name, lat: r.latitude, lon: r.longitude, region: [r.admin1, r.country].filter(Boolean).join(', ') };
        });
        suchLaeuft = false; renderMehr();
      }).catch(function () { suchLaeuft = false; suchTreffer = []; renderMehr(); hinweis(offline ? 'Offline – die Suche braucht Verbindung.' : 'Die Suche klappt gerade nicht.'); });
    }, 300);
  }
  function ortWaehlen(o) {
    if (!orte.some(function (x) { return x.id === o.id; })) { orte.push({ id: o.id, name: o.name, lat: o.lat, lon: o.lon }); speicher.schreiben('orte', orte); }
    ort = { id: o.id, name: o.name, lat: o.lat, lon: o.lon }; speicher.schreiben('ort', ort);
    suchTreffer = []; suchText = ''; daten = null; radarBild = null; mgAbbauen(); kartenAbbauen();
    waehleTab('wetter'); laden();
  }
  function gpsFragen() {
    if (!navigator.geolocation) { hinweis('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
    if (!window.confirm('Darf ' + APP_NAME + ' deinen aktuellen Standort einmal abfragen? Er bleibt auf deinem Gerät.')) return;
    hinweis('Standort wird gesucht …');
    navigator.geolocation.getCurrentPosition(function (p) {
      orte = orte.filter(function (o) { return o.id !== 'gps'; });
      ortWaehlen({ id: 'gps', name: 'Mein Standort', lat: Math.round(p.coords.latitude * 1e4) / 1e4, lon: Math.round(p.coords.longitude * 1e4) / 1e4 });
    }, function () { hinweis('Ohne Erlaubnis bleibt ' + ort.name + ' dein Ort.'); }, { timeout: 10000, maximumAge: 600000 });
  }

  // ---------- Kopf, Tab-Leiste, Reiterwechsel ----------
  var TITEL = { wetter: null, graphs: 'Graphs', radsat: 'Rad/Sat', mehr: APP_NAME };
  function kopfAktualisieren() {
    $('#kopfTitel').textContent = tab === 'wetter' ? ort.name : TITEL[tab] || APP_NAME;
    $('#kopfModell').hidden = tab !== 'wetter';
  }
  // Kamera: runder Auslöser in der Mitte (DESIGN.md Regel 16 und 27), ohne sichtbaren Text
  function leisteBauen() {
    $('#leiste').innerHTML = TABS.map(function (t) {
      if (t.id === 'kamera') return '<button type="button" class="tab tippbar kamera" data-tab="kamera" aria-label="Kamera">' + Ikon(t.ikon) + '</button>';
      return '<button type="button" class="tab tippbar" data-tab="' + t.id + '" aria-label="' + t.name + '">' + Ikon(t.ikon) + '<span>' + t.name + '</span></button>';
    }).join('');
  }
  function leisteMarkieren() {
    $$('.tab').forEach(function (b) { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var bar = $('#leiste'); bar.classList.remove('nur-symbole');
    var eng = $$('.tab span', bar).some(function (sp) { return sp.scrollWidth > sp.clientWidth + 1; });
    bar.classList.toggle('nur-symbole', eng);
  }
  function waehleTab(id) {
    if (id === 'kamera') { teilenAuf(true); return; }
    tab = id;
    $$('.reiter').forEach(function (s) { s.hidden = s.id !== 'tab-' + id; });
    kopfAktualisieren(); leisteMarkieren();
    if (id === 'wetter') renderWetter();
    else if (id === 'graphs') renderGraphs();
    else if (id === 'radsat') renderRadSat();
    else if (id === 'mehr') renderMehr();
    window.scrollTo(0, 0);
  }
  function zeichnen() { kopfAktualisieren(); if (tab === 'wetter') renderWetter(); }

  // Große Schrift erkennen (Tagesliste: Zusatzwerte unter den Tag)
  function pruefeSchrift() {
    var probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;font-size:1rem;width:1em';
    document.body.appendChild(probe); var px = probe.getBoundingClientRect().width; probe.remove();
    document.documentElement.classList.toggle('schrift-gross', px >= 20.7);   // 130 % = 20,8 px, Browser messen 20,797
  }

  // ---------- Teilen-Bildschirm ----------
  var VORLAGEN = ['Klassisch', 'Glas', 'Minimal', 'Rahmen', 'Polaroid', 'Zeitstempel'];
  var vorlage = speicher.lesen('vorlage', 'Klassisch');
  if (VORLAGEN.indexOf(vorlage) < 0) vorlage = 'Klassisch';
  var foto = null;            // ImageBitmap | HTMLImageElement
  var symbolBild = null, symbolArt = '';

  function farbe(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function infos() {
    var m = daten && status === 'ok' ? aufbereiten() : null, d = new Date();
    var i = {
      app: APP_NAME, ort: ort.name.split(',')[0], datum: pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2),
      temp: '–', art: 'wolke', wind: '–', regen: '–', sonne: '–', text: ''
    };
    if (m) {
      var info = codeInfo(aktuellCode(m), m.c.is_day);
      i.temp = grad(m.c.temperature_2m); i.art = info[0]; i.text = info[1];
      i.wind = wind(m.c.wind_speed_10m) + ' ' + windEinheit().name + ' ' + RICHTUNG_KURZ[Math.round(m.c.wind_direction_10m / 45) % 8];
      i.regen = zahl(m.d.precipitation_sum[0], 1) + ' mm';
      i.sonne = m.d.sunshine_duration ? zahl(m.d.sunshine_duration[0] / 3600, 1) + ' h' : '–';
    }
    return i;
  }
  function symbolLaden(art) {
    if (symbolBild && symbolArt === art) return Promise.resolve(symbolBild);
    var svg = WetterSymbol(art), defs = document.getElementById('ws-defs');
    var inner = defs ? defs.innerHTML : '';
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ').replace(/(<svg[^>]*>)/, '$1' + inner);
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { symbolBild = img; symbolArt = art; ok(img); };
      img.onerror = function () { ok(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function himmelFarben() {
    var g = farbe('--himmel-klar'); var f = g.match(/#[0-9a-fA-F]{6}/g) || [];
    return f.length >= 2 ? f : [farbe('--radar-grund'), farbe('--radar-grund')];
  }
  // Format wie das Foto: kurze Seite 1080 px, Seitenverhältnis begrenzt auf 9:16 bis 16:9; ohne Foto 3:4
  function bildFormat() {
    if (!foto) return [1080, 1440];
    var v = Math.min(16 / 9, Math.max(9 / 16, foto.width / foto.height));
    return v < 1 ? [1080, Math.round(1080 / v)] : [Math.round(1080 * v), 1080];
  }
  // Wo die Werte stehen (je Vorlage); dort wird die Helligkeit gemessen. Rahmen und Polaroid schreiben auf den hellen Rand.
  function wertebereich(bx, by, bw, bh) {
    if (vorlage === 'Klassisch') return [bx, by, bw, 210];
    if (vorlage === 'Glas') return [bx + 40, by + bh - 340, bw - 80, 300];
    if (vorlage === 'Minimal') return [bx, by + bh - 130, bw, 130];
    if (vorlage === 'Zeitstempel') return [bx + bw / 2, by + bh - 220, bw / 2, 220];
    return null;
  }
  // Farbton automatisch: Bild auf 24 × 32 px verkleinern, mittlere Helligkeit im Wertebereich; über 60 % hell
  function istHell(cv, r) {
    if (!foto || !r) return false;
    var hoch = cv.height >= cv.width, kw = hoch ? 24 : 32, kh = hoch ? 32 : 24;
    var k = document.createElement('canvas'); k.width = kw; k.height = kh;
    var kx = k.getContext('2d'); kx.drawImage(cv, 0, 0, kw, kh);
    var sx = kw / cv.width, sy = kh / cv.height;
    var x0 = Math.floor(r[0] * sx), y0 = Math.floor(r[1] * sy), w = Math.max(1, Math.ceil(r[2] * sx)), h = Math.max(1, Math.ceil(r[3] * sy));
    try {
      var p = kx.getImageData(x0, y0, Math.min(w, kw - x0), Math.min(h, kh - y0)).data, summe = 0;
      for (var j = 0; j < p.length; j += 4) summe += (0.2126 * p[j] + 0.7152 * p[j + 1] + 0.0722 * p[j + 2]) / 255;
      return summe / (p.length / 4) > 0.6;
    } catch (e) { return false; }
  }
  function bildZeichnen() {
    var cv = $('#bild'), x = cv.getContext('2d'), f = bildFormat(), W = f[0], H = f[1], i = infos();
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var band = farbe('--bild-band'), text = farbe('--bild-text'), fam = farbe('--font');
    return symbolLaden(i.art).then(function (sym) {
      var aussen = vorlage === 'Rahmen' ? 48 : vorlage === 'Polaroid' ? 60 : 0, unten = vorlage === 'Polaroid' ? 240 : aussen;
      x.clearRect(0, 0, W, H);
      x.fillStyle = vorlage === 'Polaroid' || vorlage === 'Rahmen' ? text : farbe('--bild-schwarz'); x.fillRect(0, 0, W, H);
      var bx = aussen, by = aussen, bw = W - 2 * aussen, bh = H - aussen - unten;
      x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
      if (foto) {
        var fw = foto.width, fh = foto.height, s = Math.max(bw / fw, bh / fh);
        x.drawImage(foto, bx + (bw - fw * s) / 2, by + (bh - fh * s) / 2, fw * s, fh * s);
        if (istHell(cv, wertebereich(bx, by, bw, bh))) { band = farbe('--bild-band-hell'); text = farbe('--bild-text-dunkel'); }
      } else {
        var cols = himmelFarben(), gr = x.createLinearGradient(0, by, 0, by + bh);
        gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[cols.length - 1]); x.fillStyle = gr; x.fillRect(bx, by, bw, bh);
        x.fillStyle = text; x.font = '500 40px ' + fam; x.textAlign = 'center'; x.fillText('Tippe auf „Fotos“ oder „Kamera“', W / 2, by + bh / 2);
      }
      var sz = function (px, gew) { x.font = (gew || 400) + ' ' + px + 'px ' + fam; };
      x.textBaseline = 'middle'; x.fillStyle = text; x.textAlign = 'left';
      var drawSym = function (px, py, s_) { if (sym) x.drawImage(sym, px, py, s_, s_); };

      if (vorlage === 'Klassisch') {          // Band oben: links Ort+Temperatur, Mitte Wind, rechts Regen+Sonne
        x.fillStyle = band; x.fillRect(bx, by, bw, 210); x.fillStyle = text;
        drawSym(bx + 24, by + 20, 120);
        sz(96, 300); x.textAlign = 'left'; x.fillText(i.temp, bx + 150, by + 74);
        sz(40, 600); x.fillText(i.ort, bx + 150, by + 156);
        sz(36, 400); x.fillText(i.datum, bx + 150, by + 192);
        sz(40, 600); x.textAlign = 'center'; x.fillText(i.wind, bx + bw * 0.55, by + 105);
        x.textAlign = 'right'; sz(38, 500); x.fillText('Regen ' + i.regen, bx + bw - 28, by + 80); x.fillText('Sonne ' + i.sonne, bx + bw - 28, by + 136);
      } else if (vorlage === 'Glas') {         // abgerundete Platte unten
        var ph = 300, py = by + bh - ph - 40;
        x.fillStyle = band; rundRect(x, bx + 40, py, bw - 80, ph, 40); x.fill(); x.fillStyle = text;
        drawSym(bx + 70, py + 30, 150); sz(120, 200); x.textAlign = 'left'; x.fillText(i.temp, bx + 240, py + 100);
        sz(44, 600); x.fillText(i.ort + ' · ' + i.datum, bx + 240, py + 200);
        sz(36, 400); x.fillText(i.wind + ' · ' + i.regen + ' · ' + i.sonne, bx + 70, py + 262);
      } else if (vorlage === 'Minimal') {      // dünnes Band unten
        x.fillStyle = band; x.fillRect(bx, by + bh - 130, bw, 130); x.fillStyle = text;
        sz(64, 300); x.textAlign = 'left'; x.fillText(i.temp, bx + 40, by + bh - 65);
        sz(34, 500); x.textAlign = 'right'; x.fillText(i.ort + ' · ' + i.datum, bx + bw - 40, by + bh - 85);
        sz(28, 400); x.fillText(i.wind + ' · ' + i.regen + ' · ' + i.sonne, bx + bw - 40, by + bh - 40);
      } else if (vorlage === 'Rahmen') {       // heller Rahmen, Info im unteren Rand
        x.fillStyle = farbe('--bild-schwarz'); x.textAlign = 'left'; sz(34, 600);
        x.fillText(i.temp + ' · ' + i.ort + ' · ' + i.datum, 48, H - 24);
      } else if (vorlage === 'Polaroid') {     // breiter Rand unten
        x.fillStyle = farbe('--bild-schwarz'); x.textAlign = 'left';
        drawSym(60, H - 232, 110); sz(80, 300); x.fillText(i.temp, 190, H - 168);
        sz(40, 600); x.fillText(i.ort + ' · ' + i.datum, 60, H - 70);
        sz(32, 400); x.textAlign = 'right'; x.fillText(i.wind, W - 60, H - 170); x.fillText(i.regen + ' · ' + i.sonne, W - 60, H - 120);
      } else if (vorlage === 'Zeitstempel') {  // Leuchtschein statt Fläche
        x.shadowColor = text === farbe('--bild-text') ? farbe('--bild-schwarz') : farbe('--bild-band-hell'); x.shadowBlur = 24; x.fillStyle = text; x.textAlign = 'right';
        sz(86, 300); x.fillText(i.temp + '  ' + i.datum, bx + bw - 50, by + bh - 150);
        sz(40, 500); x.fillText(i.ort + ' · ' + i.wind, bx + bw - 50, by + bh - 90);
        sz(34, 400); x.fillText(i.regen + ' · ' + i.sonne, bx + bw - 50, by + bh - 44);
        x.shadowBlur = 0;
      }
      x.restore();
      // App-Name klein in der Ecke; auf dem Foto immer weiß mit Leuchtschein, weil die Ecke nicht gemessen wird
      var aufRand = vorlage === 'Polaroid' || vorlage === 'Rahmen';
      x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = aufRand ? farbe('--bild-schwarz') : farbe('--bild-text'); x.globalAlpha = .85;
      if (!aufRand) { x.shadowColor = farbe('--bild-schwarz'); x.shadowBlur = 12; }
      sz(26, 600);
      if (vorlage === 'Klassisch') { x.textAlign = 'right'; x.fillText(APP_NAME, W - 24, H - 28); }
      else if (vorlage === 'Polaroid') { x.textAlign = 'right'; x.fillText(APP_NAME, W - 60, H - 40); }
      else if (vorlage === 'Rahmen') { x.textAlign = 'right'; x.fillText(APP_NAME, W - 48, H - 24); }
      else { x.fillText(APP_NAME, 28, 36); }
      x.globalAlpha = 1; x.shadowBlur = 0;
    });
  }
  function rundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  function vorlagenBauen() {
    $('#vorlagen').innerHTML = VORLAGEN.map(function (v) { return '<button type="button" class="vorlage" role="radio" data-vorlage="' + v + '" aria-checked="' + (v === vorlage) + '">' + v + '</button>'; }).join('');
  }
  var teilenZuletztFokus = null;
  // Hinter dem Teilen-Bildschirm ist nichts bedienbar (auch nicht für VoiceOver)
  function hintergrundSperren(an) {
    $$('#kopf, #inhalt, #leiste, #meldung').forEach(function (e) { if (an) e.setAttribute('inert', ''); else e.removeAttribute('inert'); });
  }
  // kamera: vom runden Kamera-Knopf, öffnet gleich die Kamera (geht nur direkt im Antippen)
  function teilenAuf(kamera) {
    teilenZuletztFokus = document.activeElement;
    $('#teilen').hidden = false; document.body.style.overflow = 'hidden'; hintergrundSperren(true);
    vorlagenBauen(); bildZeichnen(); $('#teilenZu').focus();
    if (kamera === true) $('#dateiKamera').click();
  }
  function teilenZu() {
    $('#teilen').hidden = true; document.body.style.overflow = ''; hintergrundSperren(false);
    if (teilenZuletztFokus && teilenZuletztFokus.focus) teilenZuletztFokus.focus();
  }
  function fotoLaden(datei) {
    if (!datei) return;
    var fertig = function (b) { foto = b; bildZeichnen(); };
    if (window.createImageBitmap) {
      createImageBitmap(datei, { imageOrientation: 'from-image' }).then(fertig).catch(function () { alsBild(datei, fertig); });
    } else alsBild(datei, fertig);
  }
  function alsBild(datei, fertig) {
    var u = URL.createObjectURL(datei), im = new Image();
    im.onload = function () { fertig(im); URL.revokeObjectURL(u); }; im.onerror = function () { hinweis('Das Foto ließ sich nicht öffnen.'); URL.revokeObjectURL(u); };
    im.src = u;
  }
  function teilenGo() {
    bildZeichnen().then(function () {
      $('#bild').toBlob(function (blob) {
        if (!blob) { hinweis('Das Bild ließ sich nicht erstellen.'); return; }
        var datei = new File([blob], 'wedderleuchte-' + ort.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [datei] }) && navigator.share) {
          navigator.share({ files: [datei] }).catch(function (e) { if (e && e.name !== 'AbortError') herunterladen(blob, datei.name); });
        } else herunterladen(blob, datei.name);
      }, 'image/jpeg', 0.9);
    });
  }
  function herunterladen(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000); hinweis('Das Bild wurde gespeichert.');
  }

  // ---------- Ereignisse ----------
  function binden() {
    $('#kopfOrte').innerHTML = Ikon('pin'); $('#kopfSuche').innerHTML = Ikon('search'); $('#kopfTeilen').innerHTML = Ikon('share');
    $('#teilenGo').innerHTML = Ikon('share');
    $('#kopfOrte').addEventListener('click', function () { waehleTab('mehr'); });
    $('#kopfSuche').addEventListener('click', function () { waehleTab('mehr'); var f = $('#suchfeld'); if (f) f.focus(); });
    $('#kopfTeilen').addEventListener('click', function () { teilenAuf(false); });
    $('#leiste').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) waehleTab(b.dataset.tab); });
    $('#teilenZu').addEventListener('click', teilenZu);
    $('#teilenGo').addEventListener('click', teilenGo);
    $('#teilenFotos').addEventListener('click', function () { $('#dateiFotos').click(); });
    $('#teilenKamera').addEventListener('click', function () { $('#dateiKamera').click(); });
    $('#dateiFotos').addEventListener('change', function (e) { fotoLaden(e.target.files[0]); e.target.value = ''; });
    $('#dateiKamera').addEventListener('change', function (e) { fotoLaden(e.target.files[0]); e.target.value = ''; });
    $('#vorlagen').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vorlage]'); if (!b) return;
      vorlage = b.dataset.vorlage; speicher.schreiben('vorlage', vorlage); vorlagenBauen(); bildZeichnen();
      var n = $('[data-vorlage="' + vorlage + '"]'); if (n) n.focus();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#teilen').hidden) teilenZu(); });

    $('#inhalt').addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#nochmal')) return void laden(true);
      if (t.closest('#radarKachel') || t.closest('#radarAuf')) return void waehleTab('radsat');
      if (t.closest('#aktWechsel')) {
        aktAnsicht = AKT_ANSICHTEN[(AKT_ANSICHTEN.indexOf(aktAnsicht) + 1) % AKT_ANSICHTEN.length]; speicher.schreiben('akt-ansicht', aktAnsicht);
        renderWetter(); var aw = $('#aktWechsel'); if (aw) aw.focus(); return;
      }
      var o = t.closest('[data-ort]'); if (o) { var f = orte.filter(function (x) { return x.id === o.dataset.ort; })[0]; if (f) ortWaehlen(f); return; }
      var tr = t.closest('[data-treffer]'); if (tr) return void ortWaehlen(suchTreffer[+tr.dataset.treffer]);
      var fv = t.closest('[data-fav]'); if (fv) {
        var id = fv.dataset.fav, i = favoriten.indexOf(id); if (i >= 0) favoriten.splice(i, 1); else favoriten.push(id);
        speicher.schreiben('favoriten', favoriten); renderMehr(); var nf = $('[data-fav="' + id + '"]'); if (nf) nf.focus(); return;
      }
      var wg = t.closest('[data-weg]'); if (wg) {
        var wid = wg.dataset.weg; orte = orte.filter(function (x) { return x.id !== wid; }); favoriten = favoriten.filter(function (x) { return x !== wid; });
        speicher.schreiben('orte', orte); speicher.schreiben('favoriten', favoriten);
        if (ort.id === wid) { ort = orte[0]; speicher.schreiben('ort', ort); daten = null; mgAbbauen(); kartenAbbauen(); laden(); }
        renderMehr(); return;
      }
      var w = t.closest('[data-wind]'); if (w) { windId = w.dataset.wind; speicher.schreiben('wind', windId); renderMehr(); var nw = $('[data-wind="' + windId + '"]'); if (nw) nw.focus(); return; }
      var md = t.closest('[data-modus]'); if (md) { radsatModus = md.dataset.modus; speicher.schreiben('radsat-modus', radsatModus); renderRadSat(); var nm = $('[data-modus="' + radsatModus + '"]'); if (nm) nm.focus(); return; }
      if (t.closest('#gpsKnopf')) return void gpsFragen();
      if (t.closest('.ort-zeile')) return void waehleTab('mehr');
    });
    $('#inhalt').addEventListener('input', function (e) { if (e.target.id === 'suchfeld') suchen(e.target.value); });
    $('#inhalt').addEventListener('submit', function (e) { e.preventDefault(); });

    window.addEventListener('online', function () { offline = false; hinweis('Wieder online.'); laden(true); });
    window.addEventListener('offline', function () { offline = true; hinweis('Offline' + (daten ? ' · Stand ' + stand(daten.geholt) : '')); zeichnen(); });
    window.addEventListener('resize', function () { leisteMarkieren(); pruefeSchrift(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && daten && Date.now() - daten.geholt > 10 * 60e3 && navigator.onLine) laden(true);
    });
  }

  // ---------- Start ----------
  function start() {
    binden(); leisteBauen(); pruefeSchrift();
    var gemerkt = speicher.lesen('daten-' + ort.id, null);
    if (gemerkt && gemerkt.roh) { daten = gemerkt; status = 'ok'; }
    if (offline && daten) hinweis('Offline · Stand ' + stand(daten.geholt));
    waehleTab('wetter');
    if (!offline) laden(); else if (!daten) { status = 'fehler'; zeichnen(); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
