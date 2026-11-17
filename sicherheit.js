/* sicherheit.js – Wie sicher ist die Temperatur-Vorhersage? (Wedderleuchte, 18.11.2026)
   Reine Rechenregeln ohne Bildschirm, laufen im Browser (window.Sicherheit) und in Node (Tests).
   Daten: Open-Meteo Ensemble-API, Modell ECMWF IFS 0,25° (51 Rechenläufe: Kontrolllauf + 50 leicht veränderte Läufe),
   ohne Schlüssel für nicht-kommerzielle Nutzung, Lizenz CC BY 4.0. Die API liefert nur die Einzelläufe,
   die Perzentile rechnet die App selbst.

   Regel (einfach, im Test festgehalten):
   - Je Tag das 10. und 90. Perzentil des Höchstwerts und des Tiefstwerts über alle Läufe („8 von 10 Läufen liegen dazwischen“).
   - Spanne = die größere der beiden Breiten (Höchstwert oder Tiefstwert), in °C.
   - Spanne bis 3 °C → „sicher“, bis 6 °C → „mittel“, darüber → „unsicher“. Unter 10 Läufen keine Einstufung. */
(function (global) {
  'use strict';

  var URL_ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';
  var MODELL = 'ecmwf_ifs025';
  var TAGE = 10;
  var GRENZE_SICHER = 3, GRENZE_MITTEL = 6, MIN_LAEUFE = 10;
  var QUELLE = 'Aussicht: Open-Meteo.com Ensemble, ECMWF IFS (CC BY 4.0)';

  function url(lat, lon) {
    return URL_ENSEMBLE + '?latitude=' + lat + '&longitude=' + lon + '&daily=temperature_2m_max,temperature_2m_min&models=' + MODELL + '&forecast_days=' + TAGE + '&timezone=auto';
  }

  // Perzentil p (0…1) mit linearer Zwischenrechnung; fehlende Werte zählen nicht; nichts da → null
  function perzentil(werte, p) {
    var a = (werte || []).filter(function (v) { return v != null && !isNaN(v); }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.min(lo + 1, a.length - 1);
    return a[lo] + (a[hi] - a[lo]) * (i - lo);
  }

  function einstufen(spanne) {
    if (spanne == null || isNaN(spanne)) return null;
    return spanne <= GRENZE_SICHER ? 'sicher' : spanne <= GRENZE_MITTEL ? 'mittel' : 'unsicher';
  }

  function grad(v) { return String(Math.round(v)).replace('-', '−'); }
  function bereich(b) { var a = grad(b.p10), z = grad(b.p90); return a === z ? 'etwa ' + a + ' °C' : a + ' bis ' + z + ' °C'; }
  var NACHSATZ = {
    sicher: 'Die Rechenläufe sind sich einig.',
    mittel: 'Die Rechenläufe weichen etwas voneinander ab.',
    unsicher: 'Die Rechenläufe gehen weit auseinander – die Werte können sich noch deutlich ändern.'
  };
  function satz(t) {
    if (!t.stufe) return 'Für diesen Tag gibt es zu wenige Rechenläufe für eine Einschätzung.';
    return 'Höchstwert wahrscheinlich ' + bereich(t.max) + ', Tiefstwert ' + bereich(t.min) + '. ' + NACHSATZ[t.stufe];
  }

  // Ensemble-Antwort → [{ datum, laeufe, max: {p10, p50, p90}, min: {…}, spanne, stufe, satz }]; Fehler → []
  function auswerten(j) {
    if (!j || j.error || !j.daily || !Array.isArray(j.daily.time)) return [];
    var d = j.daily, schl = Object.keys(d);
    var maxS = schl.filter(function (k) { return /^temperature_2m_max(_member\d+)?$/.test(k); });
    var minS = schl.filter(function (k) { return /^temperature_2m_min(_member\d+)?$/.test(k); });
    return d.time.map(function (datum, i) {
      var mx = maxS.map(function (k) { return d[k][i]; }), mn = minS.map(function (k) { return d[k][i]; });
      var laeufe = Math.min(mx.filter(function (v) { return v != null; }).length, mn.filter(function (v) { return v != null; }).length);
      var t = { datum: datum, laeufe: laeufe,
        max: { p10: perzentil(mx, 0.1), p50: perzentil(mx, 0.5), p90: perzentil(mx, 0.9) },
        min: { p10: perzentil(mn, 0.1), p50: perzentil(mn, 0.5), p90: perzentil(mn, 0.9) } };
      t.spanne = laeufe >= MIN_LAEUFE ? Math.max(t.max.p90 - t.max.p10, t.min.p90 - t.min.p10) : null;
      t.stufe = einstufen(t.spanne);
      t.satz = satz(t);
      return t;
    }).filter(function (t) { return t.max.p50 != null && t.min.p50 != null; });
  }

  var Sicherheit = { url: url, perzentil: perzentil, einstufen: einstufen, auswerten: auswerten, QUELLE: QUELLE,
    GRENZE_SICHER: GRENZE_SICHER, GRENZE_MITTEL: GRENZE_MITTEL, TAGE: TAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sicherheit;
  else global.Sicherheit = Sicherheit;
})(typeof window !== 'undefined' ? window : this);
