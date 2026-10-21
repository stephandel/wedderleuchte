/* ===========================================================================
   WetterKarte – gemeinsamer Kartenbaustein der WetterPro-Apps.
   Zwei Modi:
     „karten"  – Reliefkarte (OpenTopoMap) mit Wetter-Marken, Temperatur-/Niederschlags-/Wind-/Wolken-/Luftdruck-Fläche
                 aus einem Open-Meteo-Gitter, Zeitleiste über alle Stunden der nächsten 7 Tage.
     „radsat"  – Regen-Radar (RainViewer, dazu EUMETSAT-Niederschlag), Satellitenbild in Farbe und Infrarot schwarz-weiß (EUMETSAT),
                 Zeitleiste über die letzten 2 Stunden in 10-Minuten-Schritten.
   Braucht Leaflet (global `L`). Ohne Netz (offline) zeigt er die gespeicherte Ansicht aus snapshot/karte.json.

   var k = WetterKarte.einbauen({ ziel, modus, ort, orte, offset, symbol(code, istTag, werte), offline, snapshot, merk(k, v), beiZeit(text),
                                  vollbildKnopf, vollbildStart, vollbildTitel, beiVollbildZu(), zurueckGeste, wechsel: [{ id, name }], aktiv, beiWechsel(id) });
   k.zeigeOrt(ort, orte); k.sichtbar(); k.verlassen(); k.vollbild(an); k.abbauen();
   Vollbild (A32, 21.10.2026): ⤢ unten in der Ebenenleiste legt die Karte als Blatt über den ganzen Bildschirm, „Fertig“, Esc und
   Zurück schließen. `wechsel` zeigt im Blatt-Kopf Umschalter (z. B. „Radar & Satellit | Karten“), die Wahl meldet beiWechsel(id).
   =========================================================================== */
(function (global) {
  'use strict';

  // Neu geladen, während ein Vollbild-Blatt offen war (A32): der Verlaufseintrag gehört zu keinem Blatt mehr
  try { if (global.history && history.state && history.state.wpVollbild === 'wk') history.replaceState(null, ''); } catch (e) { }

  // ---------- Quellen ----------
  // Grundkarte: OpenTopoMap (frei nutzbar, CC-BY-SA, mit Grenzen und Ortsnamen; bis 14.10.2026 Esri Physical Map, die ohne Schlüssel nicht erlaubt ist).
  // CARTO Voyager wäre die Alternative gewesen, liefert aber ohne API-Schlüssel nur noch Kacheln „API KEY REQUIRED".
  var KACHEL_RELIEF = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
  var KACHEL_QUELLE = '© OpenStreetMap-Mitwirkende, SRTM © OpenTopoMap (CC-BY-SA)';
  var WMS = 'https://view.eumetsat.int/geoserver/wms';
  var RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';
  var METEO = 'https://api.open-meteo.com/v1/forecast';
  var FELDER = 'temperature_2m,precipitation,weather_code,is_day,wind_speed_10m,wind_direction_10m,cloud_cover,pressure_msl,sunshine_duration';
  var NX = 7, NY = 6;                       // Gitterpunkte je Richtung
  var TAGE = 7;
  var SCHRITT = 10, VERZUG = 50, BILDER = 13; // Rad/Sat: Minuten, Minuten, Anzahl
  var WT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

  // ---------- Große Städte (Name, Breite, Länge, Rang 1 = am größten) ----------
  var STAEDTE = [
    ['London',51.51,-0.13,1],['Paris',48.86,2.35,1],['Berlin',52.52,13.40,1],['Madrid',40.42,-3.70,1],['Rom',41.90,12.50,1],['Moskau',55.76,37.62,1],['Istanbul',41.01,28.98,1],
    ['New York',40.71,-74.01,1],['Los Angeles',34.05,-118.24,1],['Chicago',41.88,-87.63,1],['Mexiko-Stadt',19.43,-99.13,1],['São Paulo',-23.55,-46.63,1],['Buenos Aires',-34.60,-58.38,1],
    ['Kairo',30.04,31.24,1],['Lagos',6.52,3.38,1],['Johannesburg',-26.20,28.05,1],['Nairobi',-1.29,36.82,1],['Dubai',25.20,55.27,1],['Mumbai',19.08,72.88,1],['Delhi',28.61,77.21,1],
    ['Peking',39.90,116.40,1],['Shanghai',31.23,121.47,1],['Tokio',35.68,139.69,1],['Seoul',37.57,126.98,1],['Bangkok',13.76,100.50,1],['Singapur',1.35,103.82,1],['Jakarta',-6.21,106.85,1],
    ['Sydney',-33.87,151.21,1],['Melbourne',-37.81,144.96,1],['Auckland',-36.85,174.76,2],['Toronto',43.65,-79.38,1],['Vancouver',49.28,-123.12,2],['Miami',25.76,-80.19,2],['Houston',29.76,-95.37,2],
    ['San Francisco',37.77,-122.42,2],['Seattle',47.61,-122.33,2],['Denver',39.74,-104.99,2],['Washington',38.91,-77.04,2],['Boston',42.36,-71.06,2],['Atlanta',33.75,-84.39,2],['Havanna',23.13,-82.38,2],
    ['Bogotá',4.71,-74.07,2],['Lima',-12.05,-77.04,2],['Santiago',-33.45,-70.67,2],['Rio de Janeiro',-22.91,-43.17,2],['Caracas',10.48,-66.90,2],
    ['Casablanca',33.57,-7.59,1],['Marrakesch',31.63,-8.01,2],['Agadir',30.43,-9.60,2],['Algier',36.75,3.06,1],['Tunis',36.81,10.18,2],['Tripolis',32.90,13.18,2],['Dakar',14.72,-17.47,2],['Nouakchott',18.08,-15.98,3],
    ['Laayoune',27.15,-13.20,3],['Dakhla',23.68,-15.96,3],['Addis Abeba',9.02,38.75,2],['Accra',5.60,-0.19,2],['Kinshasa',-4.32,15.31,2],['Luanda',-8.84,13.23,2],['Kapstadt',-33.92,18.42,2],
    ['Lissabon',38.72,-9.14,1],['Porto',41.15,-8.61,2],['Sevilla',37.39,-5.99,2],['Málaga',36.72,-4.42,2],['Valencia',39.47,-0.38,2],['Barcelona',41.39,2.17,1],['Bilbao',43.26,-2.93,2],['Palma',39.57,2.65,2],
    ['Funchal',32.65,-16.91,2],['Las Palmas',28.12,-15.43,1],['Santa Cruz de Tenerife',28.47,-16.25,2],['Puerto del Rosario',28.50,-13.86,3],['Arrecife',28.96,-13.55,3],['Ponta Delgada',37.74,-25.67,3],
    ['Marseille',43.30,5.37,2],['Lyon',45.76,4.84,2],['Toulouse',43.60,1.44,2],['Bordeaux',44.84,-0.58,2],['Nizza',43.71,7.26,2],['Nantes',47.22,-1.55,3],['Straßburg',48.57,7.75,3],
    ['Brüssel',50.85,4.35,1],['Amsterdam',52.37,4.90,1],['Luxemburg',49.61,6.13,3],['Dublin',53.35,-6.26,1],['Edinburgh',55.95,-3.19,2],['Manchester',53.48,-2.24,2],['Birmingham',52.49,-1.90,3],
    ['Hamburg',53.55,9.99,1],['München',48.14,11.58,1],['Köln',50.94,6.96,1],['Frankfurt',50.11,8.68,1],['Stuttgart',48.78,9.18,2],['Düsseldorf',51.23,6.78,3],['Leipzig',51.34,12.37,2],['Dresden',51.05,13.74,3],
    ['Hannover',52.37,9.73,3],['Nürnberg',49.45,11.08,3],['Bremen',53.08,8.80,3],['Mannheim',49.49,8.47,3],['Saarbrücken',49.24,6.99,4],['Kiel',54.32,10.14,4],['Rostock',54.09,12.10,4],['Freiburg',47.99,7.85,4],
    ['Zürich',47.38,8.54,1],['Genf',46.20,6.15,2],['Bern',46.95,7.45,2],['Wien',48.21,16.37,1],['Salzburg',47.81,13.04,3],['Innsbruck',47.27,11.39,3],['Graz',47.07,15.44,3],
    ['Prag',50.08,14.44,1],['Warschau',52.23,21.01,1],['Krakau',50.06,19.94,2],['Budapest',47.50,19.04,1],['Bratislava',48.15,17.11,3],['Ljubljana',46.06,14.51,3],['Zagreb',45.81,15.98,2],
    ['Belgrad',44.79,20.45,2],['Sarajevo',43.86,18.41,3],['Sofia',42.70,23.32,2],['Bukarest',44.43,26.10,1],['Athen',37.98,23.73,1],['Thessaloniki',40.64,22.94,3],['Heraklion',35.34,25.13,3],
    ['Mailand',45.46,9.19,1],['Venedig',45.44,12.32,2],['Florenz',43.77,11.25,3],['Neapel',40.85,14.27,2],['Palermo',38.12,13.36,2],['Cagliari',39.22,9.11,3],['Turin',45.07,7.69,2],['Bologna',44.49,11.34,3],
    ['Kopenhagen',55.68,12.57,1],['Oslo',59.91,10.75,1],['Stockholm',59.33,18.07,1],['Helsinki',60.17,24.94,1],['Göteborg',57.71,11.97,3],['Bergen',60.39,5.32,3],['Reykjavík',64.15,-21.94,1],['Tromsø',69.65,18.96,3],
    ['Tallinn',59.44,24.75,3],['Riga',56.95,24.11,2],['Vilnius',54.69,25.28,3],['Minsk',53.90,27.57,2],['Kiew',50.45,30.52,1],['Odessa',46.48,30.73,3],['St. Petersburg',59.93,30.34,1],
    ['Ankara',39.93,32.86,2],['Antalya',36.90,30.70,2],['Izmir',38.42,27.14,3],['Nikosia',35.17,33.36,3],['Beirut',33.89,35.50,2],['Tel Aviv',32.08,34.78,2],['Amman',31.95,35.93,3],['Bagdad',33.31,44.37,2],
    ['Teheran',35.69,51.39,1],['Riad',24.69,46.72,1],['Doha',25.29,51.53,2],['Maskat',23.59,58.41,3],['Karatschi',24.86,67.01,2],['Kabul',34.53,69.17,3],['Taschkent',41.30,69.24,3],
    ['Hongkong',22.32,114.17,1],['Taipeh',25.03,121.57,2],['Manila',14.60,120.98,2],['Hanoi',21.03,105.85,2],['Kuala Lumpur',3.14,101.69,2],['Kalkutta',22.57,88.36,2],['Colombo',6.93,79.86,3],['Perth',-31.95,115.86,2],
    ['Anchorage',61.22,-149.90,3],['Honolulu',21.31,-157.86,3],['Nuuk',64.18,-51.72,3],['Montreal',45.50,-73.57,2],['Calgary',51.05,-114.07,3],['Winnipeg',49.90,-97.14,3],['Halifax',44.65,-63.58,3]
  ];

  // ---------- Zeichen (SVG, weiße Striche) ----------
  function ic(inhalt, fill) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inhalt + '</svg>';
  }
  var ICONS = {
    wetter:   ic('<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 3v1.2M8.5 12.8V14M3 8.5h1.2M12.8 8.5H14"/><path d="M11 21h7.5a3.2 3.2 0 0 0 .3-6.4A4.8 4.8 0 0 0 9.6 13 4 4 0 0 0 11 21z"/>'),
    temp:     ic('<path d="M10 13.6V5.5a2 2 0 0 1 4 0v8.1a3.6 3.6 0 1 1-4 0z"/><path d="M12 9v7.5"/><circle cx="12" cy="17.5" r="1.4" fill="currentColor" stroke="none"/>'),
    regen:    ic('<path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 7.5 3.5 3.5 0 0 0 7 14z"/><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>'),
    wind:     ic('<path d="M3 8h9.5a2.5 2.5 0 1 0-2.4-3.2"/><path d="M3 12h14.5a2.5 2.5 0 1 1-2.4 3.2"/><path d="M3 16h7a2 2 0 1 1-1.9 2.6"/>'),
    wolken:   ic('<path d="M6 19h10a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 6.7 11 4 4 0 0 0 6 19z"/><path d="M9.5 7.5A3.5 3.5 0 0 1 16 8.5a3 3 0 0 1 3 3.5"/>'),
    druck:    ic('<path d="M4.5 16a8 8 0 0 1 15 0"/><path d="M12 16l3.6-5"/><circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none"/><path d="M4.5 19.5h15"/>'),
    // Radar: Radarschirm mit Ringen, Zeiger und zwei Echos
    radar:    ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.8" cy="14.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="8.6" r="1.2" fill="currentColor" stroke="none"/>'),
    // Satellit: Körper mit zwei Sonnensegeln, oben eine kleine Antenne
    sat:      ic('<rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1" transform="rotate(45 12 12)"/><rect x="1.5" y="10" width="5.5" height="4" rx=".8"/><rect x="17" y="10" width="5.5" height="4" rx=".8"/><path d="M7 12h1.2M15.8 12h1.2"/><path d="M12 8V5.5"/><path d="M9.3 4.2a3.6 3.6 0 0 1 5.4 0"/>'),
    // Satellit Infrarot (schwarz-weiß, wie in der alten WeatherPro): derselbe Satellit, Körper und Segel ausgefüllt
    satsw:    ic('<rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1" transform="rotate(45 12 12)" fill="currentColor"/><rect x="1.5" y="10" width="5.5" height="4" rx=".8" fill="currentColor"/><rect x="17" y="10" width="5.5" height="4" rx=".8" fill="currentColor"/><path d="M7 12h1.2M15.8 12h1.2"/><path d="M12 8V5.5"/><path d="M9.3 4.2a3.6 3.6 0 0 1 5.4 0"/>'),
    // Satellit und Regen: derselbe Satellit kleiner oben, darunter Regenstriche
    satregen: ic('<rect x="9.8" y="4.8" width="4.4" height="4.4" rx=".8" transform="rotate(45 12 7)"/><rect x="2.5" y="5.4" width="5" height="3.2" rx=".7"/><rect x="16.5" y="5.4" width="5" height="3.2" rx=".7"/><path d="M7.5 7h2.3M14.2 7h2.3"/><path d="M7.5 14.5l-1.6 4.5M12 14.5l-1.6 4.5M16.5 14.5l-1.6 4.5"/>'),
    plus:     ic('<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5M11 8v6M8 11h6"/>'),
    minus:    ic('<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5M8 11h6"/>'),
    voll:     ic('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    vollaus:  ic('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    play:     '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M3 2l11 6-11 6z"/></svg>',
    pause:    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>',
    anfang:   '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M2 2h2v12H2zM14 2 5 8l9 6z"/></svg>',
    ende:     '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M12 2h2v12h-2zM2 2l9 6-9 6z"/></svg>'
  };

  // ---------- Farbskalen ----------
  var TEMP_SKALA = [[-30, [90, 30, 130]], [-20, [60, 50, 170]], [-10, [40, 90, 200]], [0, [70, 160, 230]], [5, [90, 200, 190]], [10, [110, 210, 100]],
    [15, [190, 225, 70]], [20, [245, 225, 60]], [25, [247, 180, 45]], [30, [240, 115, 40]], [35, [215, 55, 40]], [42, [140, 20, 45]]];
  var REGEN_SKALA = [[0.1, [150, 205, 255]], [0.5, [80, 150, 235]], [1.5, [40, 100, 210]], [4, [110, 60, 210]], [8, [190, 40, 170]], [15, [255, 50, 110]], [30, [255, 230, 80]]];
  var WIND_SKALA = [[0, [255, 255, 255]], [20, [140, 235, 140]], [40, [250, 225, 70]], [60, [245, 140, 40]], [80, [230, 50, 40]], [110, [160, 20, 120]]];

  function farbe(skala, v) {
    if (v == null || isNaN(v)) return null;
    if (v <= skala[0][0]) return skala[0][1];
    for (var i = 1; i < skala.length; i++) {
      if (v <= skala[i][0]) {
        var a = skala[i - 1], b = skala[i], f = (v - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f];
      }
    }
    return skala[skala.length - 1][1];
  }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function verlauf(skala) {
    var lo = skala[0][0], hi = skala[skala.length - 1][0];
    return 'linear-gradient(90deg,' + skala.map(function (s) { return rgb(s[1]) + ' ' + ((s[0] - lo) / (hi - lo) * 100).toFixed(1) + '%'; }).join(',') + ')';
  }

  // ---------- Mercator-Helfer ----------
  function merc(lat) { var r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); }
  function unmerc(y) { return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---------- Gitter (Open-Meteo, viele Punkte in einer Anfrage) ----------
  // Ergebnis: { lats (Süd→Nord), lons (West→Ost), nx, ny, zeiten (UTC 'YYYY-MM-DDTHH:MM'), felder: {name: Float32Array}, bounds }
  function gitterAus(antwort, lats, lons) {
    var liste = Array.isArray(antwort) ? antwort : [antwort];
    if (!liste.length || !liste[0].hourly) return null;
    var nx = lons.length, ny = lats.length, zeiten = liste[0].hourly.time, nt = zeiten.length;
    var namen = { temp: 'temperature_2m', regen: 'precipitation', code: 'weather_code', tag: 'is_day', wind: 'wind_speed_10m', dir: 'wind_direction_10m', wolken: 'cloud_cover', druck: 'pressure_msl', sonne: 'sunshine_duration' };
    var felder = {}, k;
    for (k in namen) felder[k] = new Float32Array(nx * ny * nt);
    for (var p = 0; p < liste.length && p < nx * ny; p++) {
      var h = liste[p].hourly;
      for (k in namen) {
        var q = h[namen[k]] || [], ziel = felder[k], basis = p * nt;
        for (var t = 0; t < nt; t++) { var v = q[t]; ziel[basis + t] = (v == null) ? NaN : v; }
      }
    }
    return { lats: lats, lons: lons, nx: nx, ny: ny, nt: nt, zeiten: zeiten, felder: felder,
      bounds: { sued: lats[0], nord: lats[ny - 1], west: lons[0], ost: lons[nx - 1] } };
  }
  // bilinear (Temperatur, Druck …) – NaN, wenn außerhalb oder Lücke
  function wertBi(g, feld, lat, lon, t) {
    var fx = (lon - g.lons[0]) / (g.lons[g.nx - 1] - g.lons[0]) * (g.nx - 1);
    var fy = (lat - g.lats[0]) / (g.lats[g.ny - 1] - g.lats[0]) * (g.ny - 1);
    if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return NaN;
    var i0 = Math.min(g.nx - 2, Math.floor(fx)), j0 = Math.min(g.ny - 2, Math.floor(fy)), dx = fx - i0, dy = fy - j0;
    var f = g.felder[feld], nt = g.nt;
    var a = f[((j0) * g.nx + i0) * nt + t], b = f[((j0) * g.nx + i0 + 1) * nt + t], c = f[((j0 + 1) * g.nx + i0) * nt + t], d = f[((j0 + 1) * g.nx + i0 + 1) * nt + t];
    if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return NaN;
    return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
  }
  // nächster Punkt (Wettercode, Tag/Nacht)
  function wertNah(g, feld, lat, lon, t) {
    var i = Math.round((lon - g.lons[0]) / (g.lons[g.nx - 1] - g.lons[0]) * (g.nx - 1));
    var j = Math.round((lat - g.lats[0]) / (g.lats[g.ny - 1] - g.lats[0]) * (g.ny - 1));
    if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return NaN;
    return g.felder[feld][(j * g.nx + i) * g.nt + t];
  }
  // Windrichtung getrennt nach Komponenten mitteln, sonst springt 350°/10° auf 180°
  function windBi(g, lat, lon, t) {
    var fx = (lon - g.lons[0]) / (g.lons[g.nx - 1] - g.lons[0]) * (g.nx - 1);
    var fy = (lat - g.lats[0]) / (g.lats[g.ny - 1] - g.lats[0]) * (g.ny - 1);
    if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return null;
    var i0 = Math.min(g.nx - 2, Math.floor(fx)), j0 = Math.min(g.ny - 2, Math.floor(fy)), dx = fx - i0, dy = fy - j0;
    var u = 0, v = 0, s = 0, ecken = [[i0, j0, (1 - dx) * (1 - dy)], [i0 + 1, j0, dx * (1 - dy)], [i0, j0 + 1, (1 - dx) * dy], [i0 + 1, j0 + 1, dx * dy]];
    for (var k = 0; k < 4; k++) {
      var idx = (ecken[k][1] * g.nx + ecken[k][0]) * g.nt + t, sp = g.felder.wind[idx], di = g.felder.dir[idx];
      if (isNaN(sp) || isNaN(di)) return null;
      var r = di * Math.PI / 180;
      u += Math.sin(r) * sp * ecken[k][2]; v += Math.cos(r) * sp * ecken[k][2]; s += sp * ecken[k][2];
    }
    return { speed: s, dir: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360 };
  }

  // ---------- Isobaren (Marching Squares auf einem feinen Raster) ----------
  function isobaren(feld, w, h, stufe) {
    var min = Infinity, max = -Infinity, i;
    for (i = 0; i < feld.length; i++) { var v = feld[i]; if (!isNaN(v)) { if (v < min) min = v; if (v > max) max = v; } }
    if (!isFinite(min)) return [];
    var linien = [];
    for (var lv = Math.ceil(min / stufe) * stufe; lv <= max; lv += stufe) {
      var seg = [];
      for (var y = 0; y < h - 1; y++) for (var x = 0; x < w - 1; x++) {
        var a = feld[y * w + x], b = feld[y * w + x + 1], c = feld[(y + 1) * w + x + 1], d = feld[(y + 1) * w + x];
        if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) continue;
        var idx = (a >= lv ? 8 : 0) | (b >= lv ? 4 : 0) | (c >= lv ? 2 : 0) | (d >= lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var t = function (p, q) { return (lv - p) / (q - p); };
        var oben = [x + t(a, b), y], rechts = [x + 1, y + t(b, c)], unten = [x + t(d, c), y + 1], links = [x, y + t(a, d)];
        var paare;
        switch (idx) {
          case 1: case 14: paare = [[links, unten]]; break;
          case 2: case 13: paare = [[unten, rechts]]; break;
          case 3: case 12: paare = [[links, rechts]]; break;
          case 4: case 11: paare = [[oben, rechts]]; break;
          case 5: paare = [[oben, links], [unten, rechts]]; break;
          case 6: case 9: paare = [[oben, unten]]; break;
          case 7: case 8: paare = [[oben, links]]; break;
          case 10: paare = [[oben, rechts], [links, unten]]; break;
        }
        for (i = 0; i < paare.length; i++) seg.push(paare[i]);
      }
      if (seg.length) linien.push({ wert: lv, seg: seg });
    }
    return linien;
  }

  // ===========================================================================
  function einbauen(cfg) {
    cfg = cfg || {};
    var wurzel = typeof cfg.ziel === 'string' ? document.querySelector(cfg.ziel) : cfg.ziel;
    if (!wurzel) { console.warn('WetterKarte: Ziel fehlt'); return null; }
    if (!global.L) { wurzel.innerHTML = '<div class="wk-hinweis" style="position:static">Die Kartenbibliothek konnte nicht geladen werden (kein Internet?).</div>'; return null; }

    var MODUS = cfg.modus === 'radsat' ? 'radsat' : 'karten';
    var ort = cfg.ort || { id: 'ort', name: 'Ort', lat: 28.73, lon: -13.87 };
    var orte = cfg.orte || [];
    var offset = cfg.offset || 0;               // Sekunden zu UTC für die Anzeige
    var symbol = cfg.symbol || function () { return ''; };
    var OFFLINE = !!cfg.offline;
    var SNAP = cfg.snapshot || 'snapshot/';
    var merk = cfg.merk || function () { return null; };
    var beiZeit = cfg.beiZeit || function () {};
    var MERK = 'wk-' + MODUS;
    var VOLLBILD_KNOPF = cfg.vollbildKnopf !== false, VOLLBILD_START = cfg.vollbildStart === true, ZURUECK_GESTE = cfg.zurueckGeste !== false;
    var VOLLBILD_TITEL = cfg.vollbildTitel || (MODUS === 'karten' ? 'Karten' : 'Radar und Satellit');
    var BEI_VOLLBILD_ZU = typeof cfg.beiVollbildZu === 'function' ? cfg.beiVollbildZu : null;
    var WECHSEL = Array.isArray(cfg.wechsel) && cfg.wechsel.length > 1 ? cfg.wechsel : null, BEI_WECHSEL = typeof cfg.beiWechsel === 'function' ? cfg.beiWechsel : null;

    // Ebenen je Modus. `flaeche` = genau eine davon gleichzeitig; `wetter` schaltet die Marken.
    var EBENEN = MODUS === 'karten'
      ? [{ id: 'wetter', titel: 'Wetter am Ort' }, { id: 'temp', titel: 'Temperatur', flaeche: true }, { id: 'regen', titel: 'Niederschlag', flaeche: true },
         { id: 'wind', titel: 'Wind', flaeche: true }, { id: 'wolken', titel: 'Bewölkung', flaeche: true }, { id: 'druck', titel: 'Luftdruck', flaeche: true }]
      : [{ id: 'wetter', titel: 'Wetter am Ort' }, { id: 'radar', titel: 'Regen-Radar', flaeche: true }, { id: 'sat', titel: 'Satellit', flaeche: true }, { id: 'satsw', titel: 'Satellit Infrarot (schwarz-weiß)', flaeche: true }, { id: 'satregen', titel: 'Satellit und Regen', flaeche: true }];
    var an = { wetter: true, flaeche: MODUS === 'karten' ? 'temp' : 'radar' };
    var gemerkt = merk(MERK);
    if (gemerkt && typeof gemerkt === 'object') {
      if (typeof gemerkt.wetter === 'boolean') an.wetter = gemerkt.wetter;
      if (EBENEN.some(function (e) { return e.flaeche && e.id === gemerkt.flaeche; })) an.flaeche = gemerkt.flaeche;
      else if (gemerkt.flaeche === null) an.flaeche = null;
    }
    function merken() { merk(MERK, { wetter: an.wetter, flaeche: an.flaeche }); }

    var el = {}, map, basis, flaeche = null, marken = {}, gitter = null, gitterVersprechen = null, gitterSchluessel = '';
    var idx = 0, film = false, filmUhr = null, ladeUhr = null, abgebaut = false;
    var frames = [], frameLayer = {}, rainviewer = null, snap = null, hinweisText = '';
    var canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 540;
    var CW = canvas.width, CH = canvas.height;

    // ---------- Oberfläche ----------
    wurzel.classList.add('wk');
    function escH(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    wurzel.innerHTML =
      // Kopf des Vollbild-Blatts (A32): Umschalter oder Titel links, „Fertig“ rechts; außerhalb des Blatts versteckt
      '<div class="wk-vb-kopf" hidden>' +
        (WECHSEL ? '<div class="wk-vb-wechsel" role="radiogroup" aria-label="Ansicht">' + WECHSEL.map(function (w) {
          return '<button type="button" class="wk-vb-chip" role="radio" data-wechsel="' + escH(w.id) + '" aria-checked="' + (w.id === cfg.aktiv) + '">' + escH(w.name) + '</button>'; }).join('') + '</div>'
          : '<span class="wk-vb-titel">' + escH(VOLLBILD_TITEL) + '</span>') +
        '<button type="button" class="wk-vb-fertig">Fertig</button></div>' +
      '<div class="wk-oben">' +
        '<div class="wk-karte"><div class="wk-leaflet"></div>' +
          '<div class="wk-legende" hidden><span class="wk-leg-a"></span><i></i><span class="wk-leg-b"></span></div>' +
          '<div class="wk-titel"></div>' +
          '<div class="wk-lade" hidden>lädt …</div>' +
          '<div class="wk-hinweis" hidden></div>' +
          '<div class="wk-quelle"></div>' +
        '</div>' +
        '<div class="wk-leiste">' +
          EBENEN.map(function (e) { return '<button type="button" class="wk-knopf" data-ebene="' + e.id + '" title="' + e.titel + '" aria-label="' + e.titel + '">' + ICONS[e.id] + '</button>'; }).join('') +
          '<div class="wk-trenner"></div>' +
          '<button type="button" class="wk-knopf" data-zoom="1" aria-label="Näher" title="Näher">' + ICONS.plus + '</button>' +
          '<button type="button" class="wk-knopf" data-zoom="-1" aria-label="Weiter" title="Weiter">' + ICONS.minus + '</button>' +
          (VOLLBILD_KNOPF ? '<button type="button" class="wk-knopf wk-voll" aria-pressed="false" aria-label="Vollbild" title="Vollbild: über den ganzen Bildschirm">' + ICONS.voll + '</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="wk-zeit"><div class="wk-regler">' +
        '<button type="button" class="wk-tk" data-film="anfang" aria-label="Anfang">' + ICONS.anfang + '</button>' +
        '<button type="button" class="wk-tk wk-play" data-film="play" aria-label="Abspielen">' + ICONS.play + '</button>' +
        '<div class="wk-spur"><input type="range" class="wk-range" min="0" max="0" step="1" value="0" aria-label="Zeitpunkt"><div class="wk-ticks"></div><div class="wk-tage"></div></div>' +
        '<button type="button" class="wk-tk" data-film="ende" aria-label="Ende">' + ICONS.ende + '</button>' +
      '</div></div>';
    el.karte = wurzel.querySelector('.wk-leaflet'); el.legende = wurzel.querySelector('.wk-legende'); el.legA = wurzel.querySelector('.wk-leg-a'); el.legB = wurzel.querySelector('.wk-leg-b');
    el.titel = wurzel.querySelector('.wk-titel'); el.lade = wurzel.querySelector('.wk-lade'); el.hinweis = wurzel.querySelector('.wk-hinweis'); el.quelle = wurzel.querySelector('.wk-quelle');
    el.range = wurzel.querySelector('.wk-range'); el.ticks = wurzel.querySelector('.wk-ticks'); el.tage = wurzel.querySelector('.wk-tage'); el.play = wurzel.querySelector('.wk-play');
    el.quelle.textContent = KACHEL_QUELLE + (MODUS === 'karten' ? ' · Open-Meteo' : ' · Open-Meteo · RainViewer · EUMETSAT');

    // ---------- Karte ----------
    // zoomAnimation aus: die animierte Zoomstufe blieb im Test hängen (kein transitionend), ohne Animation zoomt es zuverlässig
    map = L.map(el.karte, { zoomControl: false, attributionControl: false, worldCopyJump: true, zoomSnap: 0.5, minZoom: 2, maxZoom: 10, tap: false, zoomAnimation: false });
    map.on('zoomend', function () { zoomKnoepfe(); });
    el.karte._wkMap = map;                             // für Fehlersuche im Browser erreichbar
    // Standardansicht: Nahaufnahme um den Ort (Stephans Wunsch: die Umgebung des Ortes füllt die Karte, z. B. Fuerteventura und Lanzarote oder die Rhein-Neckar-Region).
    // Rad/Sat etwas weiter weg, damit man Wolkenfelder als Ganzes sieht.
    var START_ZOOM = MODUS === 'karten' ? 8.3 : 7.3;
    if (!OFFLINE) {
      basis = L.tileLayer(KACHEL_RELIEF, { subdomains: 'abc', maxZoom: 10, zIndex: 1, crossOrigin: false }).addTo(map);
      map.setView([ort.lat, ort.lon], START_ZOOM, { animate: false });
    }
    var markenEbene = L.layerGroup().addTo(map);

    // ---------- Ebenenleiste ----------
    wurzel.querySelectorAll('[data-ebene]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.ebene;
        if (id === 'wetter') an.wetter = !an.wetter;
        else an.flaeche = an.flaeche === id ? null : id;
        merken(); knoepfe(); anzeigen(true);
      });
    });
    wurzel.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () { if (+b.dataset.zoom > 0) map.zoomIn(); else map.zoomOut(); });
    });
    function knoepfe() {
      wurzel.querySelectorAll('[data-ebene]').forEach(function (b) {
        var id = b.dataset.ebene;
        b.classList.toggle('is-on', id === 'wetter' ? an.wetter : an.flaeche === id);
      });
      el.karte.classList.toggle('wk-ohne-wetter', !an.wetter);
    }

    // ---------- Zeitleiste ----------
    el.range.addEventListener('input', function () { filmStopp(); idx = +el.range.value; anzeigen(false); });
    wurzel.querySelectorAll('[data-film]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.film;
        if (a === 'play') { if (film) filmStopp(); else filmStart(); return; }
        filmStopp(); idx = a === 'anfang' ? 0 : frames.length - 1; el.range.value = idx; anzeigen(false);
      });
    });
    function filmStart() {
      if (film || frames.length < 2) return;
      film = true; el.play.innerHTML = ICONS.pause; el.play.setAttribute('aria-label', 'Anhalten');
      if (MODUS === 'radsat') frames.forEach(function (f, i) { frameLayerFuer(i); });   // vorladen
      if (idx >= frames.length - 1) idx = 0;
      takt();
    }
    function takt() {
      filmUhr = setTimeout(function () {
        if (!film) return;
        idx = (idx + 1) % frames.length; el.range.value = idx; anzeigen(false); takt();
      }, idx >= frames.length - 1 ? 1500 : (MODUS === 'radsat' ? 600 : 450));
    }
    function filmStopp() {
      if (!film) return;
      film = false; if (filmUhr) { clearTimeout(filmUhr); filmUhr = null; }
      el.play.innerHTML = ICONS.play; el.play.setAttribute('aria-label', 'Abspielen');
    }
    function ortszeit(ms) { return new Date(ms + offset * 1000); }
    function zeitText(ms, mitDatum) {
      var d = ortszeit(ms);
      return (mitDatum ? WT[d.getUTCDay()] + ' ' + d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '. ' : '') + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    }
    function ticks() {
      var n = frames.length; el.range.max = Math.max(0, n - 1); if (idx > n - 1) idx = Math.max(0, n - 1); el.range.value = idx;
      var breite = el.ticks.clientWidth || 300, html = '', tage = '', i;
      if (n < 2) { el.ticks.innerHTML = ''; el.tage.innerHTML = ''; return; }
      var proSchritt = breite / (n - 1);
      if (MODUS === 'karten') {
        var schritt = [3, 6, 12, 24].filter(function (s) { return s * proSchritt >= 38; })[0]; // passt nicht einmal 24 h: keine Uhrzeiten, nur Tage
        var heute = ortszeit(Date.now()).toISOString().slice(0, 10), tagStart = {}, tagEnde = {};
        for (i = 0; i < n; i++) {
          var d = ortszeit(frames[i]), st = d.getUTCHours(), tag = d.toISOString().slice(0, 10);
          if (tagStart[tag] == null) tagStart[tag] = i; tagEnde[tag] = i;
          if (schritt && st % schritt === 5 % schritt) html += '<span style="left:' + (i / (n - 1) * 100).toFixed(2) + '%">' + pad(st) + ':00</span>';
        }
        Object.keys(tagStart).forEach(function (tag) {
          var mitte = (tagStart[tag] + tagEnde[tag]) / 2, d2 = ortszeit(frames[tagStart[tag]]);
          if ((tagEnde[tag] - tagStart[tag]) * proSchritt < 24) return;
          tage += '<span class="' + (tag === heute ? 'is-heute' : '') + '" style="left:' + (mitte / (n - 1) * 100).toFixed(2) + '%">' + WT[d2.getUTCDay()] + '</span>';
        });
      } else {
        var min = [30, 60].filter(function (m) { return m / SCHRITT * proSchritt >= 44; })[0] || 60;
        for (i = 0; i < n; i++) {
          var o = ortszeit(frames[i]);
          if ((o.getUTCMinutes() % min) !== 0) continue;
          html += '<span style="left:' + (i / (n - 1) * 100).toFixed(2) + '%">' + zeitText(frames[i]) + '</span>';
        }
        var d0 = ortszeit(frames[0]);
        tage = '<span style="left:50%">' + WT[d0.getUTCDay()] + ' ' + d0.getUTCDate() + '.' + (d0.getUTCMonth() + 1) + '.</span>';
      }
      el.ticks.innerHTML = html; el.tage.innerHTML = tage;
    }

    // ---------- Gitter holen (nur für den sichtbaren Ausschnitt) ----------
    function gitterBounds() {
      var b = map.getBounds(), dLat = (b.getNorth() - b.getSouth()) * 0.15, dLon = (b.getEast() - b.getWest()) * 0.15;
      return { sued: Math.max(-85, b.getSouth() - dLat), nord: Math.min(85, b.getNorth() + dLat), west: b.getWest() - dLon, ost: b.getEast() + dLon };
    }
    function gitterHolen() {
      if (OFFLINE) return Promise.resolve(gitter);
      var b = gitterBounds();
      if (b.ost - b.west > 120) { gitter = null; return Promise.resolve(null); }          // zu weit weg: keine Fläche
      var schl = [b.sued, b.nord, b.west, b.ost].map(function (v) { return v.toFixed(1); }).join('|');
      if (schl === gitterSchluessel && gitter) return Promise.resolve(gitter);
      var lats = [], lons = [], i, j;
      for (j = 0; j < NY; j++) lats.push(+(b.sued + (b.nord - b.sued) * j / (NY - 1)).toFixed(3));
      for (i = 0; i < NX; i++) lons.push(+(b.west + (b.ost - b.west) * i / (NX - 1)).toFixed(3));
      var la = [], lo = [];
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) { la.push(lats[j]); lo.push(lons[i]); }
      var url = METEO + '?latitude=' + la.join(',') + '&longitude=' + lo.join(',') + '&hourly=' + FELDER + '&forecast_days=' + (MODUS === 'karten' ? TAGE : 1) + '&timezone=GMT';
      lade(true);
      var vs = fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j2) {
        if (vs !== gitterVersprechen) return gitter;
        gitter = gitterAus(j2, lats, lons); gitterSchluessel = schl; lade(false);
        return gitter;
      }).catch(function (e) { console.warn('WetterKarte Gitter', e); lade(false); return gitter; });
      gitterVersprechen = vs;
      return vs;
    }
    var bewegUhr = null;
    map.on('moveend zoomend', function () {
      if (OFFLINE) { flaecheZeichnen(); markenSetzen(); return; }
      flaecheZeichnen();
      clearTimeout(bewegUhr);
      bewegUhr = setTimeout(function () {
        var alt = gitter;
        gitterHolen().then(function () { if (!abgebaut) { markenSetzen(); if (gitter !== alt || an.flaeche) flaecheZeichnen(); } });
      }, 350);
      markenSetzen();
    });

    // ---------- Zeitpunkte ----------
    function framesBauen() {
      if (MODUS === 'karten') {
        var alt = frames.length ? frames[idx] : null;
        frames = gitter ? gitter.zeiten.map(function (z) { return Date.parse(z + 'Z'); }) : [];
        if (!frames.length) return;
        var ziel = alt != null ? alt : Date.now(), i;
        idx = 0; for (i = 0; i < frames.length; i++) if (frames[i] <= ziel) idx = i;
      } else if (snap) {
        frames = snap.zeiten.map(function (z) { return Date.parse(z); });
        idx = frames.length - 1;
      } else {
        var ms = SCHRITT * 60000, neu = Math.floor((Date.now() - VERZUG * 60000) / ms) * ms, erst = !frames.length;
        frames = []; for (var k = BILDER - 1; k >= 0; k--) frames.push(neu - k * ms);
        if (erst || idx >= frames.length) idx = frames.length - 1;      // anfangs das neueste Bild
      }
      ticks();
    }

    // ---------- Fläche (Canvas → Bild-Overlay) ----------
    // Die Fläche wird in Bildschirmauflösung für den sichtbaren Ausschnitt gezeichnet und bei jedem
    // Verschieben/Zoomen neu gerechnet – so bleiben Pfeile, Zahlen und Farbverläufe in jeder Zoomstufe scharf.
    function flaecheZeichnen() {
      var g = gitter, e = an.flaeche;
      if (!g || !e || MODUS !== 'karten' || !frames.length) { if (flaeche) { map.removeLayer(flaeche); flaeche = null; } el.legende.hidden = true; return; }
      var t = gitterIndex(), size = map.getSize(), dpr = Math.min(2, window.devicePixelRatio || 1);
      var Wc = Math.max(1, Math.round(size.x)), Hc = Math.max(1, Math.round(size.y));       // CSS-Pixel
      if (!Wc || !Hc) return;
      canvas.width = Math.round(Wc * dpr); canvas.height = Math.round(Hc * dpr);
      var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wc, Hc);
      // Mercator: die Länge hängt nur von der Spalte ab, die Breite nur von der Zeile
      function lonBei(x) { return map.containerPointToLatLng([x, 0]).lng; }
      function latBei(y) { return map.containerPointToLatLng([0, y]).lat; }
      var x, y, lat, lon, v, c;
      if (e === 'temp' || e === 'regen' || e === 'wolken') {
        var Z = 2, W2 = Math.ceil(Wc / Z), H2 = Math.ceil(Hc / Z);                          // in 2-Pixel-Zellen rechnen, weich hochziehen
        var klein = document.createElement('canvas'); klein.width = W2; klein.height = H2;
        var kctx = klein.getContext('2d'), bild = kctx.createImageData(W2, H2), d = bild.data, p = 0;
        var lons = new Float64Array(W2), lats = new Float64Array(H2);
        for (x = 0; x < W2; x++) lons[x] = lonBei((x + 0.5) * Z);
        for (y = 0; y < H2; y++) lats[y] = latBei((y + 0.5) * Z);
        for (y = 0; y < H2; y++) {
          lat = lats[y];
          for (x = 0; x < W2; x++, p += 4) {
            lon = lons[x];
            if (e === 'temp') {
              v = wertBi(g, 'temp', lat, lon, t); c = farbe(TEMP_SKALA, v);
              if (c) { d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 200; }
            } else if (e === 'regen') {
              v = wertBi(g, 'regen', lat, lon, t);
              if (v >= 0.08) { c = farbe(REGEN_SKALA, v); d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = Math.min(225, 110 + v * 25); }
            } else {
              v = wertBi(g, 'wolken', lat, lon, t);
              if (v > 5) { d[p] = 240; d[p + 1] = 242; d[p + 2] = 246; d[p + 3] = Math.min(215, v * 2.2); }
            }
          }
        }
        kctx.putImageData(bild, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.drawImage(klein, 0, 0, Wc, Hc);
      } else if (e === 'wind') {
        var ABST = 68, NXW = Math.max(1, Math.round(Wc / ABST)), NYW = Math.max(1, Math.round(Hc / ABST));
        for (var j = 0; j < NYW; j++) for (var i = 0; i < NXW; i++) {
          var px = (i + 0.5) / NXW * Wc, py = (j + 0.5) / NYW * Hc;
          lat = latBei(py); lon = lonBei(px);
          var w = windBi(g, lat, lon, t); if (!w) continue;
          var len = 14 + Math.min(34, w.speed * 0.55), col = rgb(farbe(WIND_SKALA, w.speed));
          var r = (w.dir + 180) * Math.PI / 180;                     // Pfeil zeigt, wohin der Wind weht
          ctx.save(); ctx.translate(px, py); ctx.rotate(r);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          [[6.5, 'rgba(0,0,0,.55)'], [3.2, col]].forEach(function (st) {
            ctx.strokeStyle = st[1]; ctx.lineWidth = st[0];
            ctx.beginPath(); ctx.moveTo(0, len / 2); ctx.lineTo(0, -len / 2); ctx.moveTo(-7, -len / 2 + 8); ctx.lineTo(0, -len / 2); ctx.lineTo(7, -len / 2 + 8); ctx.stroke();
          });
          ctx.restore();
          ctx.font = 'bold 13px -apple-system, Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(Math.round(w.speed), px, py + len / 2 + 14);
          ctx.fillStyle = '#fff'; ctx.fillText(Math.round(w.speed), px, py + len / 2 + 14);
        }
      } else if (e === 'druck') {
        var W = Math.max(24, Math.round(Wc / 6)), H = Math.max(18, Math.round(Hc / 6)), feld = new Float32Array(W * H);
        for (y = 0; y < H; y++) { lat = latBei(y / (H - 1) * Hc); for (x = 0; x < W; x++) { lon = lonBei(x / (W - 1) * Wc); feld[y * W + x] = wertBi(g, 'druck', lat, lon, t); } }
        var linien = isobaren(feld, W, H, 4), sx = Wc / (W - 1), sy = Hc / (H - 1);
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3;
        linien.forEach(function (l) {
          ctx.beginPath();
          l.seg.forEach(function (sg) { ctx.moveTo(sg[0][0] * sx, sg[0][1] * sy); ctx.lineTo(sg[1][0] * sx, sg[1][1] * sy); });
          ctx.stroke();
        });
        ctx.shadowBlur = 0; ctx.font = 'bold 13px -apple-system, Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        linien.forEach(function (l) {
          var n = l.seg.length, k = Math.max(1, Math.floor(n / 2));
          for (var q = Math.floor(k / 2); q < n; q += k) {
            var sg = l.seg[q], mx = (sg[0][0] + sg[1][0]) / 2 * sx, my = (sg[0][1] + sg[1][1]) / 2 * sy, txt = String(Math.round(l.wert));
            ctx.fillStyle = 'rgba(15,74,148,.85)'; ctx.fillRect(mx - 20, my - 9, 40, 18);
            ctx.fillStyle = '#fff'; ctx.fillText(txt, mx, my);
          }
        });
      }
      var url = canvas.toDataURL('image/png'), mb = map.getBounds(), bounds = [[mb.getSouth(), mb.getWest()], [mb.getNorth(), mb.getEast()]];
      var deck = e === 'temp' ? 0.7 : e === 'regen' ? 0.9 : e === 'wolken' ? 0.85 : 1;
      if (!flaeche) flaeche = L.imageOverlay(url, bounds, { opacity: deck, interactive: false, className: 'wk-flaeche', zIndex: 3 }).addTo(map);
      else { flaeche.setUrl(url); flaeche.setBounds(L.latLngBounds(bounds)); flaeche.setOpacity(deck); }
      legende(e);
    }
    function legende(e) {
      if (e === 'temp') { el.legende.hidden = false; el.legA.textContent = '−30°'; el.legB.textContent = '42°'; el.legende.querySelector('i').style.background = verlauf(TEMP_SKALA); }
      else if (e === 'regen') { el.legende.hidden = false; el.legA.textContent = '0,1'; el.legB.textContent = '30 mm/h'; el.legende.querySelector('i').style.background = verlauf(REGEN_SKALA); }
      else if (e === 'wind') { el.legende.hidden = false; el.legA.textContent = '0'; el.legB.textContent = '110 km/h'; el.legende.querySelector('i').style.background = verlauf(WIND_SKALA); }
      else el.legende.hidden = true;
    }

    // ---------- Rad/Sat: Bildebenen je Zeitpunkt ----------
    function wmsLayer(ebene, zeit, png, stil) {
      return L.tileLayer.wms(WMS, { layers: ebene, styles: stil || '', format: png ? 'image/png' : 'image/jpeg', transparent: !!png, version: '1.3.0', crs: L.CRS.EPSG3857,
        time: new Date(zeit).toISOString().replace(/\.\d+Z$/, '.000Z'), opacity: 0, zIndex: png ? 4 : 2, tileSize: 256 });
    }
    function radarLayer(zeit) {
      if (!rainviewer || !rainviewer.frames.length) return null;
      var best = rainviewer.frames[0];
      rainviewer.frames.forEach(function (f) { if (Math.abs(f.time * 1000 - zeit) < Math.abs(best.time * 1000 - zeit)) best = f; });
      if (Math.abs(best.time * 1000 - zeit) > 20 * 60000) return null;
      return L.tileLayer(rainviewer.host + best.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0, zIndex: 4, tileSize: 256, maxNativeZoom: 7 }); // RainViewer liefert ab Zoom 8 nur „Zoom Level Not Supported“
    }
    // Für einen Zeitpunkt alle nötigen Bildebenen anlegen (einmal) – Rückgabe { sat, satsw, regen, radar }
    // satsw = Infrarot 10,5 µm in Graustufen (weiß = kalte, hohe Wolken), das klassische Schwarz-Weiß-Bild der alten WeatherPro
    function frameLayerFuer(i) {
      var f = frameLayer[i]; if (f) return f;
      var zeit = frames[i]; f = {};
      if (snap) {
        var bounds = [[snap.bounds.sued, snap.bounds.west], [snap.bounds.nord, snap.bounds.ost]];
        var bild = function (name, z) { return name ? L.imageOverlay(SNAP + name.replace(/^snapshot\//, ''), bounds, { opacity: 0, interactive: false, zIndex: z }) : null; };
        f.sat = bild(snap.sat && snap.sat[i], 2); f.satsw = bild(snap.satsw && snap.satsw[i], 2); f.regen = bild(snap.regen && snap.regen[i], 4); f.radar = bild(snap.radar && snap.radar[i], 4);
      } else {
        f.sat = wmsLayer('mtg_fd:rgb_geocolour', zeit, false); f.satsw = wmsLayer('mtg_fd:ir105_hrfi', zeit, false, 'mtg_fd:mtg_fd_ir105_hrfi_grayscale');
        f.regen = wmsLayer('mtg_fd:h40b', zeit, true); f.radar = radarLayer(zeit);
      }
      ['sat', 'satsw', 'regen', 'radar'].forEach(function (k) { if (f[k]) { f[k].on('loading', function () { lade(true); }); f[k].on('load', function () { lade(false); }); f[k].addTo(map); } });
      frameLayer[i] = f;
      return f;
    }
    // Alle Bildebenen unsichtbar, nur die des gewählten Zeitpunkts in der gewählten Ebene sichtbar
    function bildebenenZeigen() {
      var e = an.flaeche, i, f;
      if (e && frames.length) frameLayerFuer(idx);
      for (i in frameLayer) {
        f = frameLayer[i];
        var aktiv = e && +i === idx;
        if (f.sat) f.sat.setOpacity(aktiv && (e === 'sat' || e === 'satregen') ? 1 : 0);
        if (f.satsw) f.satsw.setOpacity(aktiv && e === 'satsw' ? 1 : 0);
        if (f.regen) f.regen.setOpacity(aktiv && (e === 'radar' || e === 'satregen') ? (e === 'radar' ? 0.55 : 0.85) : 0);
        if (f.radar) f.radar.setOpacity(aktiv && e === 'radar' ? 0.9 : 0);
      }
      f = frameLayer[idx];
      if (e === 'radar' && f && !f.radar && !snap) hinweis('Über dieser Gegend gibt es kein Regenradar – gezeigt wird der Niederschlag aus Satellitendaten (EUMETSAT).');
      else if (e && !snap && !inMeteosat()) hinweis('Satellitenbilder gibt es hier nur für Europa, Afrika und den Atlantik (Meteosat).');
      else if (hinweisText && hinweisText.indexOf('Gespeicherter') < 0) hinweis('');
    }
    function inMeteosat() { var c = map.getCenter(); return c.lng > -70 && c.lng < 75 && c.lat > -70 && c.lat < 75; }
    function rainviewerHolen() {
      if (OFFLINE || rainviewer) return Promise.resolve(rainviewer);
      return fetch(RAINVIEWER).then(function (r) { return r.json(); }).then(function (j) {
        rainviewer = { host: j.host, frames: (j.radar && j.radar.past) || [] }; return rainviewer;
      }).catch(function () { rainviewer = { host: '', frames: [] }; return rainviewer; });
    }

    // ---------- Marken ----------
    var STADT_MIN_RANG = { 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 4 };
    function kandidaten() {
      var liste = [{ id: ort.id, name: ort.name, lat: ort.lat, lon: ort.lon, hier: true, rang: 0 }];
      orte.forEach(function (o) { if (o.id !== ort.id) liste.push({ id: o.id, name: o.name, lat: o.lat, lon: o.lon, rang: 0.5 }); });
      var z = Math.round(map.getZoom()), maxRang = STADT_MIN_RANG[Math.max(2, Math.min(10, z))] || 4;
      STAEDTE.forEach(function (s) { if (s[3] <= maxRang) liste.push({ id: 's' + s[0], name: s[0], lat: s[1], lon: s[2], rang: s[3] }); });
      return liste.sort(function (a, b) { return a.rang - b.rang; });
    }
    // Stundenindex im Gitter zum gezeigten Zeitpunkt (Karten: der Regler; Rad/Sat: die Stunde des Bildes)
    function gitterIndex() {
      if (!gitter || !frames.length) return 0;
      var t0 = Date.parse(gitter.zeiten[0] + 'Z'), t = Math.floor((frames[idx] - t0) / 3600000);
      return Math.max(0, Math.min(gitter.nt - 1, t));
    }
    function markenSetzen() {
      if (!map._loaded) return;                        // Offline: Ansicht wird erst nach dem Laden von karte.json gesetzt
      var groesse = map.getSize(), gewaehlt = [], genutzt = {}, t = gitterIndex(), dxMin = 82, dyMin = 52;
      kandidaten().forEach(function (k) {
        var p = map.latLngToContainerPoint([k.lat, k.lon]);
        if (p.x < -40 || p.y < -40 || p.x > groesse.x + 40 || p.y > groesse.y + 40) return;
        for (var i = 0; i < gewaehlt.length; i++) { var q = gewaehlt[i].p; if (Math.abs(q.x - p.x) < dxMin && Math.abs(q.y - p.y) < dyMin) return; }
        k.p = p; gewaehlt.push(k);
      });
      gewaehlt.forEach(function (k) {
        genutzt[k.id] = true;
        var html = '<div class="wk-marke' + (k.hier ? ' is-hier' : '') + '"><i></i><span class="wk-name">' + k.name.replace(/[<>&]/g, '') + '</span>' + wetterHtml(k, t) + '</div>';
        var m = marken[k.id];
        if (!m) {
          m = L.marker([k.lat, k.lon], { icon: L.divIcon({ className: 'wk-mk', html: html, iconSize: null, iconAnchor: [0, 0] }), interactive: false, keyboard: false, zIndexOffset: k.hier ? 1000 : 500 - Math.round(k.rang * 100) });
          m.addTo(markenEbene); marken[k.id] = m;
        } else {
          var e2 = m.getElement(); if (e2) e2.innerHTML = html;
          m.setLatLng([k.lat, k.lon]);
        }
      });
      for (var id in marken) if (!genutzt[id]) { markenEbene.removeLayer(marken[id]); delete marken[id]; }
    }
    function wetterHtml(k, t) {
      if (!gitter || !frames.length) return '';
      var temp = wertBi(gitter, 'temp', k.lat, k.lon, t), code = wertNah(gitter, 'code', k.lat, k.lon, t), tag = wertNah(gitter, 'tag', k.lat, k.lon, t);
      if (isNaN(temp) || isNaN(code)) return '';
      // dritter Wert für Apps, die das Symbol nach Regenmenge, Sonnenscheindauer und Bewölkung statt nach rohem Wettercode wählen (NaN = fehlt, z. B. im Snapshot)
      var w = { regen: wertNah(gitter, 'regen', k.lat, k.lon, t), sonne: wertNah(gitter, 'sonne', k.lat, k.lon, t), wolken: wertNah(gitter, 'wolken', k.lat, k.lon, t) };
      return '<div class="wk-w">' + symbol(Math.round(code), tag >= 0.5, w) + '<b>' + Math.round(temp) + '°C</b></div>';
    }

    // ---------- Anzeigen ----------
    function anzeigen(ebeneGewechselt) {
      if (!frames.length) return;
      var zeit = frames[idx];
      el.titel.innerHTML = '<b>' + zeitText(zeit, true) + '</b>' + (MODUS === 'karten' ? 'Vorhersage' : (snap ? 'gespeichert' : 'Beobachtung'));
      beiZeit(zeitText(zeit, true));
      if (MODUS === 'karten') { flaecheZeichnen(); markenSetzen(); }
      else { if (ebeneGewechselt) { for (var i in frameLayer) { var f = frameLayer[i]; ['sat', 'satsw', 'regen', 'radar'].forEach(function (k) { if (f[k]) f[k].setOpacity(0); }); } } bildebenenZeigen(); if (ebeneGewechselt) markenSetzen(); }
    }
    function lade(an2) { clearTimeout(ladeUhr); if (an2) el.lade.hidden = false; else ladeUhr = setTimeout(function () { el.lade.hidden = true; }, 150); }
    // Der Hinweis steht über der Quellenzeile; die kann zweizeilig sein (zweite Meinung A32: vorher überlappten beide)
    function hinweisSetzen() { if (!el.hinweis.hidden) el.hinweis.style.bottom = (el.quelle.offsetHeight + 8) + 'px'; }
    function hinweis(text) { hinweisText = text; el.hinweis.hidden = !text; el.hinweis.textContent = text; hinweisSetzen(); }

    // Ohne Netz: das gespeicherte Bild soll die ganze Fläche ausfüllen (wie „cover"), zoomen darf man näher heran,
    // aber nicht weiter weg als bis zum Bildrand. Wird die Fläche anders (Querformat), rechnen wir neu.
    var offlineBounds = null;
    function offlineAnsicht(erstmals) {
      if (!offlineBounds) return;
      map.invalidateSize({ animate: false });
      var deckend = map.getBoundsZoom(offlineBounds, true);   // true = Ausschnitt füllt die Fläche vollständig
      var schaerfsteStufe = (snap && snap.detail && snap.detailZ) ? snap.detailZ + 1 : (snap && snap.z ? snap.z : 7) + 1.3;
      map.setMinZoom(deckend); map.setMaxZoom(Math.max(deckend + 1, schaerfsteStufe));
      if (erstmals) {
        var mitte = offlineBounds.contains([ort.lat, ort.lon]) ? L.latLng(ort.lat, ort.lon) : offlineBounds.getCenter();
        map.setView(mitte, Math.min(map.getMaxZoom(), Math.max(deckend, START_ZOOM)), { animate: false });
      } else if (map.getZoom() < deckend) {
        map.setZoom(deckend, { animate: false });
      }
    }
    function zoomKnoepfe() {
      var z = map.getZoom();
      wurzel.querySelectorAll('[data-zoom]').forEach(function (b) {
        b.disabled = +b.dataset.zoom > 0 ? z >= map.getMaxZoom() - 0.01 : z <= map.getMinZoom() + 0.01;
      });
    }
    // ---------- Vollbild-Blatt (A32) ----------
    // Wie beim Meteogramm-Baustein: Klasse wk-vollbild (CSS heftet die Karte an alle Ränder), role="dialog", Rest der Seite inert,
    // ein Verlaufseintrag, damit Zurück das Blatt schließt. Danach rechnet Leaflet die neue Größe nach.
    // zurueck: so viele history.back() sind unterwegs; ihr spätes popstate darf ein inzwischen neu geöffnetes Blatt nicht schließen
    var vollbild = false, vb = { gesperrt: [], overflow: '', gepusht: false, zurueck: 0 };
    function vollbildSetzen(an, ausVerlauf) {
      an = !!an;
      if (an === vollbild || abgebaut) return;
      vollbild = an;
      wurzel.classList.toggle('wk-vollbild', an);
      var b = wurzel.querySelector('.wk-voll'), kopf = wurzel.querySelector('.wk-vb-kopf');
      if (b) { b.innerHTML = an ? ICONS.vollaus : ICONS.voll; b.setAttribute('aria-pressed', String(an)); b.setAttribute('aria-label', an ? 'Vollbild beenden' : 'Vollbild'); }
      kopf.hidden = !an;
      if (an) {
        wurzel.setAttribute('role', 'dialog'); wurzel.setAttribute('aria-modal', 'true'); wurzel.setAttribute('aria-label', VOLLBILD_TITEL + ' im Vollbild');
        seiteSperren(true);
        // Steht der Verlauf schon auf einem Karten-Eintrag (Umschalter im Blatt baut die Karte neu), wird er weiterbenutzt
        if (ZURUECK_GESTE) { try { if (!vb.zurueck && history.state && history.state.wpVollbild === 'wk') vb.gepusht = true; else { history.pushState({ wpVollbild: 'wk' }, ''); vb.gepusht = true; } } catch (e) { } }
        wurzel.querySelector('.wk-vb-fertig').focus({ preventScroll: true });
      } else {
        wurzel.removeAttribute('role'); wurzel.removeAttribute('aria-modal'); wurzel.removeAttribute('aria-label');
        seiteSperren(false);
        if (vb.gepusht) { vb.gepusht = false; if (!ausVerlauf && history.state && history.state.wpVollbild === 'wk') { try { vb.zurueck++; history.back(); } catch (e) { vb.zurueck--; } } }
        if (b) b.focus({ preventScroll: true });
      }
      groesseGeaendert(); setTimeout(groesseGeaendert, 280);   // nach der Einblendung (250 ms) noch einmal messen
      if (!an && BEI_VOLLBILD_ZU) { try { BEI_VOLLBILD_ZU(); } catch (e) { } }
    }
    function seiteSperren(an) {
      if (an) {
        vb.gesperrt = [];
        for (var k = wurzel; k && k !== document.body && k.parentNode; k = k.parentNode) {
          Array.prototype.forEach.call(k.parentNode.children, function (g) {
            if (g === k || g.hasAttribute('inert') || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(g.tagName)) return;
            g.setAttribute('inert', ''); vb.gesperrt.push(g);
          });
        }
        vb.overflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
      } else {
        vb.gesperrt.forEach(function (g) { g.removeAttribute('inert'); }); vb.gesperrt = [];
        document.documentElement.style.overflow = vb.overflow || '';
      }
    }
    function vbTaste(ev) { if (vollbild && ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); vollbildSetzen(false); } }
    function vbZurueck() {
      // Das eigene Zurück von „Fertig“ kommt an; inzwischen neu geöffnet: Eintrag für das Blatt neu anlegen (wie im Meteogramm-Baustein)
      if (vb.zurueck > 0) { vb.zurueck--; if (!vb.zurueck && vollbild && vb.gepusht && !(history.state && history.state.wpVollbild === 'wk')) { try { history.pushState({ wpVollbild: 'wk' }, ''); } catch (e) { } } return; }
      if (vollbild && vb.gepusht) { vb.gepusht = false; vollbildSetzen(false, true); }
    }
    document.addEventListener('keydown', vbTaste);
    global.addEventListener('popstate', vbZurueck);
    if (wurzel.querySelector('.wk-voll')) wurzel.querySelector('.wk-voll').addEventListener('click', function () { vollbildSetzen(!vollbild); });
    wurzel.querySelector('.wk-vb-fertig').addEventListener('click', function () { vollbildSetzen(false); });
    wurzel.querySelectorAll('[data-wechsel]').forEach(function (c) {
      c.addEventListener('click', function () { if (c.getAttribute('aria-checked') !== 'true' && BEI_WECHSEL) BEI_WECHSEL(c.dataset.wechsel); });
    });

    function groesseGeaendert() {
      if (!map) return;
      map.invalidateSize({ animate: false });
      if (OFFLINE) offlineAnsicht(false);
      ticks(); hinweisSetzen();
    }
    window.addEventListener('resize', groesseGeaendert);
    window.addEventListener('orientationchange', function () { setTimeout(groesseGeaendert, 300); });

    // ---------- Start ----------
    function start() {
      knoepfe();
      if (OFFLINE) {
        lade(true);
        fetch(SNAP + 'karte.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('kein Snapshot'); return r.json(); }).then(function (j) {
          snap = j;
          var bounds = L.latLngBounds([j.bounds.sued, j.bounds.west], [j.bounds.nord, j.bounds.ost]);
          if (j.basis) L.imageOverlay(SNAP + j.basis.replace(/^snapshot\//, ''), bounds, { interactive: false, zIndex: 1, className: 'wk-basis-bild' }).addTo(map);
          // Nahaufnahme (Zoom 9) über der groben Grundkarte, damit die Standardansicht scharf ist
          if (j.detail && j.detailBounds) {
            var db = j.detailBounds;
            L.imageOverlay(SNAP + j.detail.replace(/^snapshot\//, ''), L.latLngBounds([db.sued, db.west], [db.nord, db.ost]), { interactive: false, zIndex: 2, className: 'wk-basis-bild' }).addTo(map);
          }
          map.options.zoomSnap = 0;                       // Bild soll die Fläche füllen, nicht auf halbe Zoomstufen springen
          offlineBounds = bounds;
          offlineAnsicht(true);
          map.options.maxBoundsViscosity = 1;             // am Bildrand ist Schluss, kein Gummiband ins Leere
          map.setMaxBounds(bounds);
          hinweis('Gespeicherter Stand vom ' + new Date(j.stand).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr (kein Netz). Zoomen und Verschieben gehen innerhalb des gespeicherten Ausschnitts.');
          setTimeout(function () { hinweis(''); }, 6000);
          return fetch(SNAP + (j.gitter || 'karte-gitter.json').replace(/^snapshot\//, ''), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
        }).then(function (gj) {
          if (gj && gj.antwort) gitter = gitterAus(gj.antwort, gj.lats, gj.lons);
          lade(false); framesBauen(); anzeigen(true);
        }).catch(function (e) { console.warn(e); lade(false); hinweis('Ohne Internet gibt es keine Karte – die gespeicherte Ansicht fehlt.'); });
        return;
      }
      if (MODUS === 'karten') {
        gitterHolen().then(function () { if (abgebaut) return; framesBauen(); anzeigen(true); });
      } else {
        framesBauen();
        Promise.all([rainviewerHolen(), gitterHolen()]).then(function () { if (abgebaut) return; anzeigen(true); });
      }
    }
    start();
    if (VOLLBILD_START) vollbildSetzen(true);
    var uhr = setInterval(function () {           // Rad/Sat: alle 10 Minuten kann ein neues Bild da sein
      if (abgebaut || OFFLINE || MODUS !== 'radsat' || film) return;
      var alt = frames[frames.length - 1]; framesBauen();
      if (frames[frames.length - 1] !== alt) { frameLayer = {}; map.eachLayer(function (l) { if (l instanceof L.TileLayer && l !== basis) map.removeLayer(l); }); anzeigen(true); }
    }, 5 * 60000);

    return {
      zeigeOrt: function (neu, neueOrte) {
        if (neueOrte) orte = neueOrte;
        var wechsel = !ort || ort.id !== neu.id; ort = neu;
        if (wechsel && !OFFLINE) { filmStopp(); map.setView([ort.lat, ort.lon], START_ZOOM, { animate: false }); }
        else markenSetzen();
      },
      setzeOffset: function (s) { offset = s || 0; ticks(); if (frames.length) anzeigen(false); },
      sichtbar: function () { map.invalidateSize(); ticks(); markenSetzen(); },
      verlassen: function () { filmStopp(); },
      vollbild: function (an) { vollbildSetzen(an); },
      // Offenes Blatt: Sperre aufheben; der Verlaufseintrag bleibt und wird von einem neuen Blatt weiterbenutzt (Umschalter im Blatt)
      abbauen: function () {
        if (vollbild) { vollbild = false; vb.gepusht = false; seiteSperren(false); }
        document.removeEventListener('keydown', vbTaste); global.removeEventListener('popstate', vbZurueck);
        wurzel.classList.remove('wk-vollbild'); wurzel.removeAttribute('role'); wurzel.removeAttribute('aria-modal'); wurzel.removeAttribute('aria-label');
        window.removeEventListener('resize', groesseGeaendert); abgebaut = true; filmStopp(); clearInterval(uhr); map.remove(); wurzel.innerHTML = ''; wurzel.classList.remove('wk'); }
    };
  }

  global.WetterKarte = { einbauen: einbauen, staedte: STAEDTE, icons: ICONS };
})(window);
