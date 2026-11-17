/* tests/radar-sicherheit.test.js – Rechenregeln für DWD-Radar und Sicherheits-Anzeige (18.11.2026)
   Start:  node tests/radar-sicherheit.test.js      (nur Node, kein Browser, kein Netz)
   Prüft radar-dwd.js (Zeiten aus der DWD-Fähigkeitenliste, Zeitleiste gemessen/vorhergesagt, Zeitpunkt-Text, Regenstufen)
   und sicherheit.js (Perzentile aus den Ensemble-Läufen, Einstufung sicher/mittel/unsicher, Erklär-Satz, Fehlerfälle).
   Exit-Code 0 = alles grün. */
'use strict';
const fs = require('fs');
const path = require('path');

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
function laden(datei) { try { return require(path.join(__dirname, '..', datei)); } catch (e) { console.log('  ✗ ' + datei + ' fehlt: ' + e.message); fehler++; return null; } }

const R = laden('radar-dwd.js');
const S = laden('sicherheit.js');
const MIN = 60000;

if (R) {
  console.log('1) DWD-Fähigkeitenliste lesen');
  const xml = '<Layer><Name>Niederschlagsradar</Name><Dimension name="time" default="current" units="ISO8601">2026-11-14T00:00:00.000Z/2026-11-18T00:30:00.000Z/PT5M</Dimension>' +
    '<Dimension name="REFERENCE_TIME" default="2026-11-17T22:30:00.000Z" units="ISO8601">2026-11-14T00:00:00.000Z,2026-11-17T22:30:00.000Z</Dimension></Layer>';
  const info = R.zeitenAusCapabilities(xml);
  pruefe('letzte Messung = REFERENCE_TIME', info && info.referenz === Date.parse('2026-11-17T22:30:00Z'), info);
  pruefe('Ende der Vorhersage aus time-Dimension', info && info.ende === Date.parse('2026-11-18T00:30:00Z'));
  pruefe('Takt 5 Minuten', info && info.schritt === 5 * MIN);
  pruefe('kaputte Antwort → null (kein Absturz)', R.zeitenAusCapabilities('<ServiceExceptionReport/>') === null);
  pruefe('leere Antwort → null', R.zeitenAusCapabilities('') === null && R.zeitenAusCapabilities(null) === null);
  pruefe('Ende vor Referenz → null', R.zeitenAusCapabilities(xml.replace('2026-11-18T00:30', '2026-11-17T20:00')) === null);

  console.log('2) Zeitleiste gemessen / vorhergesagt');
  const jetzt = Date.parse('2026-11-17T22:35:00Z');
  const zl = R.zeitleiste(info, { zurueck: 90, vor: 120 });
  pruefe('beginnt 90 Min vor der letzten Messung', zl[0].t === info.referenz - 90 * MIN, zl[0]);
  pruefe('endet 120 Min nach der letzten Messung', zl[zl.length - 1].t === info.referenz + 120 * MIN, zl[zl.length - 1]);
  pruefe('5-Minuten-Takt, 43 Bilder', zl.length === 43 && zl.every((f, i) => !i || f.t - zl[i - 1].t === 5 * MIN), zl.length);
  pruefe('bis einschließlich Referenz „gemessen“', zl.filter(f => f.art === 'gemessen').length === 19 && zl[18].art === 'gemessen' && zl[18].t === info.referenz);
  pruefe('danach „vorhergesagt“', zl.slice(19).every(f => f.art === 'vorhergesagt'));
  const kurz = R.zeitleiste({ referenz: info.referenz, ende: info.referenz + 30 * MIN, schritt: 5 * MIN }, { zurueck: 90, vor: 120 });
  pruefe('kürzere Vorhersage beim DWD → Zeitleiste endet dort', kurz[kurz.length - 1].t === info.referenz + 30 * MIN);
  pruefe('Index der letzten Messung', R.letzteMessung(zl) === 18);
  pruefe('ohne Info → leere Zeitleiste', Array.isArray(R.zeitleiste(null)) && R.zeitleiste(null).length === 0);

  console.log('3) Zeitpunkt-Text');
  pruefe('gemessen vor 5 Min', R.zeitpunktText({ t: info.referenz, art: 'gemessen' }, jetzt) === 'gemessen vor 5 Min', R.zeitpunktText({ t: info.referenz, art: 'gemessen' }, jetzt));
  pruefe('gemessen vor 1 Std. 35 Min', R.zeitpunktText({ t: info.referenz - 90 * MIN, art: 'gemessen' }, jetzt) === 'gemessen vor 1 Std. 35 Min', R.zeitpunktText({ t: info.referenz - 90 * MIN, art: 'gemessen' }, jetzt));
  pruefe('gemessen gerade eben', R.zeitpunktText({ t: jetzt - 30000, art: 'gemessen' }, jetzt) === 'gemessen gerade eben');
  pruefe('Vorhersage für in 40 Min', R.zeitpunktText({ t: jetzt + 40 * MIN, art: 'vorhergesagt' }, jetzt) === 'Vorhersage für in 40 Min');
  pruefe('Vorhersage für in 2 Std.', R.zeitpunktText({ t: jetzt + 120 * MIN, art: 'vorhergesagt' }, jetzt) === 'Vorhersage für in 2 Std.');
  pruefe('Vorhersage für jetzt', R.zeitpunktText({ t: jetzt, art: 'vorhergesagt' }, jetzt) === 'Vorhersage für jetzt');
  pruefe('Bild älter als 30 Min wird als veraltet erkannt', R.veraltet(info, jetzt + 40 * MIN) === true && R.veraltet(info, jetzt) === false);

  console.log('4) Regenstufen (Klartext zur Farbskala)');
  pruefe('0,5 mm/h leicht', R.regenStufe(0.5) === 'leicht');
  pruefe('2 mm/h mäßig', R.regenStufe(2) === 'mäßig');
  pruefe('9,9 mm/h mäßig', R.regenStufe(9.9) === 'mäßig');
  pruefe('10 mm/h stark', R.regenStufe(10) === 'stark');
  pruefe('0 mm/h kein Regen', R.regenStufe(0) === null);
  pruefe('Farbskala hat 15 DWD-Stufen mit Farbe', R.STUFEN.length === 15 && R.STUFEN.every(s => /^#[0-9a-f]{6}$/i.test(s.farbe)));
  pruefe('jede Stufe hat ein Wort', R.STUFEN.every(s => ['leicht', 'mäßig', 'stark'].indexOf(s.wort) >= 0));

  console.log('5) Abdeckung (DWD nur Deutschland und Nachbarn)');
  pruefe('Mannheim abgedeckt', R.abgedeckt(49.4875, 8.466) === true);
  pruefe('Mengerschied abgedeckt', R.abgedeckt(49.91667, 7.5) === true);
  pruefe('Corralejo nicht abgedeckt (bleibt RainViewer)', R.abgedeckt(28.73, -13.87) === false);

  console.log('6) Kachel-Adresse (Kartenbild für eine Kachel)');
  const u = R.kachelUrl(6, 33, 21, info.referenz);
  pruefe('Adresse enthält Ebene, Zeit und EPSG:3857', /layers=dwd%3ANiederschlagsradar|layers=dwd:Niederschlagsradar/.test(u) && u.indexOf('time=2026-11-17T22:30:00.000Z') > 0 && u.indexOf('EPSG:3857') > 0, u);
  const bb = /bbox=([^&]+)/.exec(u)[1].split(',').map(Number);
  pruefe('Kachel 6/33/21 hat die richtigen Mercator-Grenzen', Math.abs(bb[0] - 626172.1) < 1 && Math.abs(bb[1] - 6261721.4) < 1 && Math.abs(bb[2] - 1252344.3) < 1 && Math.abs(bb[3] - 6887893.5) < 1, bb);
}

if (S) {
  console.log('7) Perzentile');
  pruefe('10. Perzentil von 1..11 = 2', S.perzentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.1) === 2);
  pruefe('90. Perzentil von 1..11 = 10', S.perzentil([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 0.9) === 10);
  pruefe('lineare Zwischenwerte', Math.abs(S.perzentil([0, 10], 0.25) - 2.5) < 1e-9);
  pruefe('fehlende Werte (null) werden übersprungen', S.perzentil([null, 4, null, 6], 0.5) === 5);
  pruefe('nur fehlende Werte → null', S.perzentil([null, null], 0.5) === null && S.perzentil([], 0.5) === null);

  console.log('8) Einstufung sicher / mittel / unsicher');
  pruefe('Spanne 3,0 °C → sicher', S.einstufen(3) === 'sicher');
  pruefe('Spanne 3,1 °C → mittel', S.einstufen(3.1) === 'mittel');
  pruefe('Spanne 6,0 °C → mittel', S.einstufen(6) === 'mittel');
  pruefe('Spanne 6,1 °C → unsicher', S.einstufen(6.1) === 'unsicher');
  pruefe('keine Spanne → null', S.einstufen(null) === null);

  console.log('9) Echte Ensemble-Antwort (Open-Meteo, Mannheim, abgerufen 17.11.2026 22:35 UTC)');
  const ens = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ensemble-mannheim-2026-11-17.json'), 'utf8'));
  const tage = S.auswerten(ens);
  pruefe('10 Tage', tage && tage.length === 10, tage && tage.length);
  pruefe('51 Läufe gezählt', tage && tage[0].laeufe === 51, tage && tage[0].laeufe);
  pruefe('Tag 1 Höchstwert 13,8 bis 15,2 °C', tage && Math.abs(tage[0].max.p10 - 13.8) < 0.05 && Math.abs(tage[0].max.p90 - 15.2) < 0.05, tage && tage[0].max);
  pruefe('Tag 1 sicher', tage && tage[0].stufe === 'sicher');
  pruefe('Tag 4: Tiefstwert-Spanne 5,0 °C → mittel', tage && tage[3].stufe === 'mittel', tage && tage[3]);
  pruefe('Tag 10 unsicher', tage && tage[9].stufe === 'unsicher');
  pruefe('Spanne = größere der beiden Spannen', tage && Math.abs(tage[3].spanne - Math.max(tage[3].max.p90 - tage[3].max.p10, tage[3].min.p90 - tage[3].min.p10)) < 1e-9);
  pruefe('Satz nennt den Bereich in ganzen Grad', tage && /Höchstwert wahrscheinlich 14 bis 15 °C/.test(tage[0].satz), tage && tage[0].satz);
  pruefe('Satz für unsicher sagt, dass es sich ändern kann', tage && /ändern/.test(tage[9].satz), tage && tage[9].satz);
  pruefe('Minuszeichen typografisch', tage && /−1/.test(tage.map(t => t.satz).join(' ')));

  console.log('10) Fehlerfälle');
  pruefe('Fehler-Antwort von Open-Meteo → leere Liste', Array.isArray(S.auswerten({ error: true, reason: 'x' })) && S.auswerten({ error: true }).length === 0);
  pruefe('null → leere Liste', S.auswerten(null).length === 0);
  const wenig = { daily: { time: ['2026-11-17'], temperature_2m_max: [10], temperature_2m_min: [5] } };
  pruefe('weniger als 10 Läufe → Tag ohne Einstufung', S.auswerten(wenig).length === 1 && S.auswerten(wenig)[0].stufe === null);
}

console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
process.exit(fehler ? 1 : 0);
