/* radar-dwd.js – Regenradar des Deutschen Wetterdienstes (DWD) für die Wedderleuchte (18.11.2026)
   Reine Rechenregeln ohne Bildschirm, laufen im Browser (window.RadarDWD) und in Node (Tests).
   Quelle: DWD-Kartendienst (WMS) https://maps.dwd.de/geoserver/dwd/wms, Ebene dwd:Niederschlagsradar
   („Niederschlagsradar und -vorhersage, RV-Produkt, 1 km, 5-minütig, mm/h“), frei ohne Konto und Schlüssel,
   Lizenz CC BY 4.0, Quellenvermerk „Deutscher Wetterdienst“.
   - Die Fähigkeitenliste der Ebene nennt in REFERENCE_TIME default die letzte Messung und in der time-Dimension
     das Ende der Vorhersage (etwa +2 Std.). Bis zur letzten Messung sind die Bilder gemessen, danach vorhergesagt.
   - Vorhersagebilder tragen DIM_REFERENCE_TIME (Lauf), damit ein neuer Lauf eine neue Adresse bekommt
     (der Parameter heißt beim DWD-GeoServer DIM_REFERENCE_TIME; REFERENCE_TIME allein wird überhört). */
(function (global) {
  'use strict';

  var WMS = 'https://maps.dwd.de/geoserver/dwd/wms';
  var CAPS = 'https://maps.dwd.de/geoserver/dwd/Niederschlagsradar/wms?service=WMS&version=1.3.0&request=GetCapabilities';
  var EBENE = 'dwd:Niederschlagsradar';
  var QUELLE = 'Radar: Deutscher Wetterdienst (CC BY 4.0)';
  var MIN = 60000;
  var ERDE = 20037508.342789244;            // halbe Erdumfang-Länge in Web-Mercator (EPSG:3857), Meter

  // Farbstufen genau wie im Legendenbild des DWD (GetLegendGraphic, abgerufen 17.11.2026), mm/h.
  // Wort nach DWD-Sprachgebrauch: leicht bis 2,5, mäßig bis 10, stark darüber; Grenze hier an der nächsten Stufe (2 bzw. 10).
  var STUFEN = [
    { ab: 0.1, farbe: '#33ffff', wort: 'leicht' }, { ab: 0.2, farbe: '#1acc9a', wort: 'leicht' }, { ab: 0.4, farbe: '#019934', wort: 'leicht' },
    { ab: 1, farbe: '#4db31b', wort: 'leicht' }, { ab: 2, farbe: '#99cc01', wort: 'mäßig' }, { ab: 3, farbe: '#cce601', wort: 'mäßig' },
    { ab: 5, farbe: '#ffff01', wort: 'mäßig' }, { ab: 7.5, farbe: '#ffc401', wort: 'mäßig' }, { ab: 10, farbe: '#ff8901', wort: 'stark' },
    { ab: 15, farbe: '#ff4501', wort: 'stark' }, { ab: 30, farbe: '#fe0000', wort: 'stark' }, { ab: 45, farbe: '#e5004c', wort: 'stark' },
    { ab: 75, farbe: '#cc0098', wort: 'stark' }, { ab: 100, farbe: '#6600cb', wort: 'stark' }, { ab: 150, farbe: '#0000fe', wort: 'stark' }
  ];
  function regenStufe(mmh) {
    if (mmh == null || isNaN(mmh) || mmh < 0.1) return null;
    return mmh < 2 ? 'leicht' : mmh < 10 ? 'mäßig' : 'stark';
  }

  // Abdeckung des Radarverbunds (Deutschland und Grenzgebiete), bewusst etwas enger als das Bild
  function abgedeckt(lat, lon) { return lat >= 46.5 && lat <= 55.5 && lon >= 4.5 && lon <= 16; }

  // Fähigkeitenliste (Text) → { referenz, ende, schritt } in Millisekunden oder null
  function zeitenAusCapabilities(xml) {
    if (!xml || typeof xml !== 'string') return null;
    var ref = /<Dimension[^>]*name="REFERENCE_TIME"[^>]*default="([^"]+)"/i.exec(xml);
    var zeit = /<Dimension[^>]*name="time"[^>]*>\s*([^<\/\s]+)\/([^<\/\s]+)\/PT(\d+)M\s*<\/Dimension>/i.exec(xml);
    if (!ref || !zeit) return null;
    var referenz = Date.parse(ref[1]), ende = Date.parse(zeit[2]), schritt = +zeit[3] * MIN;
    if (isNaN(referenz) || isNaN(ende) || !schritt || ende < referenz) return null;
    return { referenz: referenz, ende: ende, schritt: schritt };
  }

  // Zeitleiste: zurueck Minuten vor der letzten Messung bis vor Minuten danach (höchstens bis zum Ende beim DWD)
  function zeitleiste(info, o) {
    if (!info) return [];
    o = o || {};
    var zurueck = o.zurueck == null ? 90 : o.zurueck, vor = o.vor == null ? 120 : o.vor, s = info.schritt || 5 * MIN;
    var bis = Math.min(info.ende, info.referenz + vor * MIN), liste = [];
    for (var t = info.referenz - zurueck * MIN; t <= bis; t += s) liste.push({ t: t, art: t <= info.referenz ? 'gemessen' : 'vorhergesagt' });
    return liste;
  }
  function letzteMessung(liste) { var i = -1; (liste || []).forEach(function (f, k) { if (f.art === 'gemessen') i = k; }); return i; }

  function dauer(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' Std.' + (m ? ' ' + m + ' Min' : '') : m + ' Min';
  }
  // „gemessen vor 10 Min“ / „Vorhersage für in 40 Min“ / „Vorhersage für jetzt“
  function zeitpunktText(f, jetzt) {
    var d = Math.round((f.t - jetzt) / MIN);
    if (f.art === 'gemessen') return d >= -1 ? 'gemessen gerade eben' : 'gemessen vor ' + dauer(-d);
    if (Math.abs(d) <= 2) return 'Vorhersage für jetzt';
    return d > 0 ? 'Vorhersage für in ' + dauer(d) : 'Vorhersage für vor ' + dauer(-d);
  }
  // Die letzte Messung ist älter als 30 Minuten: Dienst hängt oder Gerät war lange weg
  function veraltet(info, jetzt) { return !info || jetzt - info.referenz > 30 * MIN; }

  function iso(t) { return new Date(t).toISOString().replace(/\.\d+Z$/, '.000Z'); }
  // Kartenbild für eine Kachel z/x/y (Web-Mercator), 256 px – für die kleine Radar-Karte auf dem Startbildschirm
  function kachelUrl(z, x, y, zeit, lauf) {
    var g = 2 * ERDE / Math.pow(2, z);
    var bbox = [-ERDE + x * g, ERDE - (y + 1) * g, -ERDE + (x + 1) * g, ERDE - y * g].map(function (v) { return v.toFixed(1); }).join(',');
    return WMS + '?service=WMS&version=1.3.0&request=GetMap&layers=' + EBENE + '&styles=&format=image/png&transparent=true&crs=EPSG:3857' +
      '&width=256&height=256&bbox=' + bbox + '&time=' + iso(zeit) + (lauf && zeit > lauf ? '&dim_reference_time=' + iso(lauf) : '');
  }

  // Fähigkeitenliste holen, 4 Minuten im Speicher halten (eine Liste für Karte und Kachel); Fehler → Promise mit Fehler
  var gemerkt = null, unterwegs = null;
  function holen(fetchFn) {
    var f = fetchFn || (global.fetch && global.fetch.bind(global));
    if (gemerkt && Date.now() - gemerkt.geholt < 4 * MIN) return Promise.resolve(gemerkt.info);
    if (unterwegs) return unterwegs;
    unterwegs = f(CAPS).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
      var info = zeitenAusCapabilities(t);
      if (!info) throw new Error('DWD-Zeiten unlesbar');
      gemerkt = { info: info, geholt: Date.now() }; unterwegs = null;
      return info;
    }, function (e) { unterwegs = null; throw e; });
    return unterwegs;
  }

  var RadarDWD = { WMS: WMS, CAPS: CAPS, EBENE: EBENE, QUELLE: QUELLE, STUFEN: STUFEN, regenStufe: regenStufe, abgedeckt: abgedeckt,
    zeitenAusCapabilities: zeitenAusCapabilities, zeitleiste: zeitleiste, letzteMessung: letzteMessung, zeitpunktText: zeitpunktText,
    veraltet: veraltet, iso: iso, kachelUrl: kachelUrl, holen: holen };
  if (typeof module !== 'undefined' && module.exports) module.exports = RadarDWD;
  else global.RadarDWD = RadarDWD;
})(typeof window !== 'undefined' ? window : this);
