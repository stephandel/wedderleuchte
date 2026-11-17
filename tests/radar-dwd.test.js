/* tests/radar-dwd.test.js – DWD-Radar und Sicherheits-Anzeige in der Oberfläche (18.11.2026)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8975 node tests/radar-dwd.test.js
           WURZEL=<anderer App-Ordner> prüft einen anderen Stand (z. B. main, um zu zeigen, dass die Tests vorher rot sind).
   WebKit bei 402 × 874 (iPhone 17 Pro), hell und dunkel, dazu 320 breit. Ohne Netz: Open-Meteo, Ensemble und DWD antworten
   mit Attrappen aus tests/fixtures (die DWD-Zeiten werden um „jetzt“ herum erzeugt), alles andere Fremde wird abgewiesen.
   Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..');
const PORT = +process.env.PORT || 8975;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/wedderleuchte-tests';
const FIX = path.join(__dirname, 'fixtures');
const OM = fs.readFileSync(path.join(FIX, 'open-meteo-mannheim.json'), 'utf8');
const ENS = fs.readFileSync(path.join(FIX, 'ensemble-mannheim-2026-11-17.json'), 'utf8');
const KACHEL = fs.readFileSync(path.join(FIX, 'dwd-radar-kachel-2026-11-17.png'));
fs.mkdirSync(BILDER, { recursive: true });

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
function server() {
  return new Promise(fertig => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, BASIS).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const datei = path.join(WURZEL, path.normalize(p));
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); return res.end('fehlt'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      fs.createReadStream(datei).pipe(res);
    }).listen(PORT, '127.0.0.1', () => fertig(s));
  });
}

// DWD-Fähigkeitenliste wie beim echten Dienst: letzte Messung vor 5–10 Minuten, Vorhersage 2 Std. weiter
const MIN = 60000;
function caps() {
  const ref = Math.floor(Date.now() / (5 * MIN)) * 5 * MIN - 5 * MIN, iso = t => new Date(t).toISOString().replace(/\.\d+Z$/, '.000Z');
  return { ref, xml: '<WMS_Capabilities><Layer><Name>Niederschlagsradar</Name><Dimension name="time" default="current" units="ISO8601">' + iso(ref - 3 * 24 * 60 * MIN) + '/' + iso(ref + 120 * MIN) + '/PT5M</Dimension>' +
    '<Dimension name="REFERENCE_TIME" default="' + iso(ref) + '" units="ISO8601">' + iso(ref - 5 * MIN) + ',' + iso(ref) + '</Dimension></Layer></WMS_Capabilities>' };
}
const DWD_FEHLER_XML = '<?xml version="1.0" encoding="UTF-8"?><ServiceExceptionReport version="1.3.0"><ServiceException code="InvalidDimensionValue" locator="time">Could not find a match</ServiceException></ServiceExceptionReport>';

async function neueSeite(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.breite || 402, height: o.hoehe || 874 }, colorScheme: o.farbe || 'light', serviceWorkers: 'block' });
  const anfragen = [];
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url()), json = (t, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: t });
    anfragen.push(u.href);
    if (o.allesAus) return route.abort();
    if (u.host === 'api.open-meteo.com') return json(OM);
    if (u.host === 'ensemble-api.open-meteo.com') return o.ensembleAus ? json('{"error":true,"reason":"Test"}', 400) : json(ENS);
    if (u.host === 'maps.dwd.de') {
      if (/GetCapabilities/i.test(u.search)) return o.dwdAus ? route.fulfill({ status: 500, body: 'Fehler' }) : route.fulfill({ status: 200, contentType: 'text/xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: caps().xml });
      if (/GetMap/i.test(u.search)) return o.dwdBildFehler ? route.fulfill({ status: 200, contentType: 'text/xml', body: DWD_FEHLER_XML }) : route.fulfill({ status: 200, contentType: 'image/png', body: KACHEL });
    }
    return route.abort();
  });
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|access control|net::|Load failed/i.test(m.text())) probleme.push('Konsole: ' + m.text()); });
  if (o.speicher) await ctx.addInitScript(s => { if (!sessionStorage.getItem('gesetzt')) { Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); sessionStorage.setItem('gesetzt', '1'); } }, o.speicher);
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 10000 });
  await p.waitForTimeout(800);
  return { ctx, p, probleme, anfragen };
}
const dwdBilder = a => a.filter(u => /maps\.dwd\.de/.test(u) && /GetMap/i.test(u));
const zeitParam = u => (/[?&]time=([^&]+)/i.exec(u) || [])[1];

// Text unter 11 px, Knöpfe unter 44 px, seitliches Scrollen (wie app.test.js)
const masse = p => p.evaluate(() => {
  const r = { breit: document.documentElement.scrollWidth > innerWidth + 1, klein: [], knopf: [] };
  document.querySelectorAll('body *').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    const cs = getComputedStyle(e);
    const eigenText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (eigenText && parseFloat(cs.fontSize) < 11 && !e.closest('svg') && !e.closest('.leaflet-container')) r.klein.push(e.className + ' ' + cs.fontSize);
    if (e.tagName === 'SUMMARY') { const b = e.getBoundingClientRect(); if (b.height < 43.5) r.knopf.push('summary ' + Math.round(b.height)); }
  });
  return r;
});
// Nachbarn in Flex-/Grid-Zeilen, deren Text sich berührt (wie woerter.test.js)
const KLEBT = sel => {
  const sicht = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const flaeche = e => { const r = document.createRange(); r.selectNodeContents(e); const q = [...r.getClientRects()].filter(x => x.width > 0); if (!q.length) return null;
    return { l: Math.min(...q.map(x => x.left)), r: Math.max(...q.map(x => x.right)), o: Math.min(...q.map(x => x.top)), u: Math.max(...q.map(x => x.bottom)) }; };
  const funde = [];
  document.querySelectorAll(sel + ' *').forEach(c => {
    if (!/flex|grid/.test(getComputedStyle(c).display) || !sicht(c)) return;
    const kinder = [...c.children].filter(k => sicht(k) && k.textContent.trim());
    for (let i = 0; i + 1 < kinder.length; i++) {
      const a = flaeche(kinder[i]), b = flaeche(kinder[i + 1]); if (!a || !b) continue;
      const luecke = b.l - a.r;
      if (Math.min(a.u, b.u) - Math.max(a.o, b.o) > 4 && luecke > -20 && luecke < 3) funde.push(kinder[i].textContent.trim().slice(-16) + '|' + kinder[i + 1].textContent.trim().slice(0, 16));
    }
  });
  return funde;
};

(async () => {
  const s = await server();
  const b = await webkit.launch();
  try {
    for (const farbe of ['light', 'dark']) {
      console.log('1) Startseite ' + farbe + ', 402 × 874: Sicherheits-Anzeige und Radar-Kachel');
      const { ctx, p, probleme, anfragen } = await neueSeite(b, { farbe });
      await p.waitForSelector('.aussicht', { timeout: 6000 }).catch(() => {});
      const module = await p.$$eval('#tab-wetter .raster > .kachel', ks => ks.map(k => k.getAttribute('aria-label')));
      pruefe('Module: die vier bisherigen unverändert vorn, „Temperatur-Aussicht 10 Tage“ am Ende', JSON.stringify(module) === JSON.stringify(['Aktuell', 'Stunden', 'Vorhersage 8 Tage', 'Regenradar', 'Temperatur-Aussicht 10 Tage']), module);
      const aus = await p.evaluate(() => [...document.querySelectorAll('.aus-tag')].map(d => ({ wort: d.querySelector('.aus-wort') && d.querySelector('.aus-wort').textContent.trim(), h: d.querySelector('summary').getBoundingClientRect().height, baender: d.querySelectorAll('.aus-tief,.aus-hoch').length })));
      pruefe('10 Tage mit je einem Wort sicher/mittel/unsicher', aus.length === 10 && aus.every(t => /^(sicher|mittel|unsicher)$/.test(t.wort)), aus.map(t => t.wort));
      pruefe('erster Tag sicher, letzter unsicher (echte Daten vom 17.11.)', aus.length === 10 && aus[0].wort === 'sicher' && aus[9].wort === 'unsicher');
      pruefe('je Tag zwei Bänder (Tiefst- und Höchstwert)', aus.length && aus.every(t => t.baender === 2));
      pruefe('Zeilen mindestens 44 px hoch (Tippfläche)', aus.length && aus.every(t => t.h >= 43.5), aus.map(t => Math.round(t.h)));
      pruefe('Erklärung ohne Fachwort „Perzentil“', await p.evaluate(() => { const e = document.querySelector('.aus-erklaer'); return !!e && /Je breiter, desto unsicherer/.test(e.textContent) && !/Perzentil/i.test(document.querySelector('.aussicht').textContent); }));
      if (aus.length) {
        await p.click('.aus-tag:nth-child(10) summary');
        const satz = await p.evaluate(() => { const d = document.querySelector('.aus-tag:nth-child(10)'); return { offen: d.open, text: d.querySelector('p').textContent, sichtbar: d.querySelector('p').getBoundingClientRect().height > 0 }; });
        pruefe('Antippen zeigt den Erklär-Satz', satz.offen && satz.sichtbar && /Höchstwert wahrscheinlich/.test(satz.text) && /ändern/.test(satz.text), satz);
      }
      const kachel = await p.evaluate(() => ({ bilder: [...document.querySelectorAll('#radarKachel img:not(.topo)')].map(i => i.src), zeit: (document.querySelector('#radarKachel .radar-zeit') || {}).textContent }));
      pruefe('Radar-Kachel: Bilder vom DWD, Zeit mit „vor … Min“', kachel.bilder.length > 0 && kachel.bilder.every(u => /maps\.dwd\.de/.test(u)) && /^\d\d:\d\d · vor \d+ Min$/.test(kachel.zeit || ''), kachel.zeit);
      pruefe('Quellenzeile nennt den Deutschen Wetterdienst', /Radar: Deutscher Wetterdienst \(CC BY 4\.0\)/.test(await p.textContent('#tab-wetter .quellen-zeile')));
      pruefe('Ensemble einmal abgefragt (ECMWF, 10 Tage)', anfragen.filter(u => /ensemble-api/.test(u)).length === 1 && anfragen.some(u => /models=ecmwf_ifs025/.test(u) && /forecast_days=10/.test(u)));
      const m = await masse(p);
      pruefe('Startseite: kein Text unter 11 px, kein seitliches Scrollen', !m.klein.length && !m.breit && !m.knopf.length, m);
      pruefe('Sicherheits-Anzeige: nichts klebt aneinander', (await p.evaluate(KLEBT, '.aussicht')).length === 0, await p.evaluate(KLEBT, '.aussicht'));
      await (await p.$('.aussicht')).screenshot({ path: path.join(BILDER, 'aussicht-' + farbe + '.png') }).catch(() => {});

      console.log('2) Reiter Radar ' + farbe + ': DWD-Zeitleiste');
      const vorher = anfragen.length;
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(2500);
      const z = await p.evaluate(() => {
        const r = document.querySelector('.wk-range'), t = document.querySelector('.wk-titel'), vor = document.querySelector('.wk-vor'), leg = document.querySelector('.wk-rleg');
        return { max: r && +r.max, wert: r && +r.value, titel: t && t.textContent, art: t && t.dataset.art, vor: !!vor && !vor.hidden && vor.getBoundingClientRect().width > 20,
          tage: (document.querySelector('.wk-tage') || {}).textContent, leg: !!leg && !leg.hidden && leg.textContent, quelle: (document.querySelector('.wk-quelle') || {}).textContent,
          text: r && r.getAttribute('aria-valuetext') };
      });
      pruefe('43 Bilder im 5-Minuten-Takt (−90 Min bis +2 Std.)', z.max === 42, z.max);
      pruefe('anfangs die neueste Messung', z.wert === 18, z.wert);
      pruefe('Titel „gemessen vor X Min“', /gemessen vor \d+ Min/.test(z.titel || '') && z.art === 'gemessen', z.titel);
      pruefe('Vorhersage-Teil gestrichelt sichtbar und mit Wörtern „gemessen“ / „Vorhersage“', z.vor && /gemessen/.test(z.tage) && /Vorhersage/.test(z.tage), z);
      pruefe('Farbskala mit leicht / mäßig / stark', /leicht/.test(z.leg) && /mäßig/.test(z.leg) && /stark/.test(z.leg), z.leg);
      pruefe('Quelle in der Karte: Deutscher Wetterdienst (CC BY 4.0)', /Deutscher Wetterdienst \(CC BY 4\.0\)/.test(z.quelle || ''), z.quelle);
      pruefe('Zeitregler sagt Zeitpunkt und „gemessen“ an (VoiceOver)', /gemessen vor/.test(z.text || ''), z.text);
      const neu = anfragen.slice(vorher), bilder = dwdBilder(neu), zeiten = [...new Set(bilder.map(zeitParam))];
      pruefe('sparsam: anfangs nur ein Zeitpunkt geladen, kein RainViewer, kein EUMETSAT', zeiten.length === 1 && !neu.some(u => /rainviewer|eumetsat/.test(u)), { zeiten: zeiten.length, fremd: neu.filter(u => /rainviewer|eumetsat/.test(u)).length });
      pruefe('512er-Kacheln in Web-Mercator', bilder.length > 0 && bilder.every(u => /width=512/.test(u) && /EPSG(%3A|:)3857/i.test(u)), bilder[0]);
      if (farbe === 'light') await p.screenshot({ path: path.join(BILDER, 'radar-gemessen-light.png') });
      await p.click('[data-film="ende"]'); await p.waitForTimeout(1200);
      const e = await p.evaluate(() => { const t = document.querySelector('.wk-titel'); return { titel: t.textContent, art: t.dataset.art }; });
      pruefe('Ende: „Vorhersage für in 2 Std.“', /Vorhersage für in (1 Std\. \d+ Min|2 Std\.)/.test(e.titel) && e.art === 'vorhergesagt', e);
      const vorBild = dwdBilder(anfragen).filter(u => /dim_reference_time=/i.test(u));
      pruefe('Vorhersagebild trägt den Lauf (DIM_REFERENCE_TIME)', vorBild.length > 0, dwdBilder(anfragen).slice(-1));
      await p.click('[data-film="anfang"]'); await p.waitForTimeout(300);
      await p.click('.wk-play'); await p.waitForTimeout(3500);
      const lauf = await p.evaluate(() => +document.querySelector('.wk-range').value);
      await p.click('.wk-play'); await p.waitForTimeout(300);
      const steht = await p.evaluate(() => +document.querySelector('.wk-range').value);
      await p.waitForTimeout(1200);
      pruefe('Abspielen läuft in 10-Minuten-Schritten und hält an', lauf > 0 && lauf % 2 === 0 && steht === (await p.evaluate(() => +document.querySelector('.wk-range').value)), { lauf, steht });
      const m2 = await masse(p);
      pruefe('Radar: kein Text unter 11 px, kein seitliches Scrollen', !m2.klein.length && !m2.breit, m2);
      await p.screenshot({ path: path.join(BILDER, 'radar-' + farbe + '.png') });
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('3) 320 breit: Sicherheits-Anzeige passt');
    {
      const { ctx, p, probleme } = await neueSeite(b, { breite: 320, hoehe: 568 });
      await p.waitForSelector('.aussicht', { timeout: 6000 }).catch(() => {});
      const m = await masse(p);
      pruefe('320: kein Text unter 11 px, kein seitliches Scrollen, Zeilen ≥ 44 px', !m.klein.length && !m.breit && !m.knopf.length, m);
      const ueber = await p.evaluate(() => [...document.querySelectorAll('.aus-tag summary > *')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className));
      pruefe('320: nichts abgeschnitten', ueber.length === 0, ueber);
      pruefe('320: nichts klebt aneinander', (await p.evaluate(KLEBT, '.aussicht')).length === 0, await p.evaluate(KLEBT, '.aussicht'));
      await (await p.$('.aussicht')).screenshot({ path: path.join(BILDER, 'aussicht-320.png') }).catch(() => {});
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('4) Fehlerfälle');
    {
      const { ctx, p, probleme, anfragen } = await neueSeite(b, { dwdAus: true, ensembleAus: true });
      await p.waitForTimeout(800);
      const module = await p.$$eval('#tab-wetter .raster > .kachel', ks => ks.map(k => k.getAttribute('aria-label')));
      pruefe('Ensemble-Fehler: Startseite wie bisher (4 Module, keine leere Kachel)', JSON.stringify(module) === JSON.stringify(['Aktuell', 'Stunden', 'Vorhersage 8 Tage', 'Regenradar']), module);
      pruefe('DWD-Fehler: Radar-Kachel meldet sich (RainViewer ist im Test auch weg)', /nicht erreichbar/.test(await p.textContent('#radarKachel')));
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(1500);
      const h = await p.evaluate(() => { const e = document.querySelector('.wk-hinweis'); return { text: e && !e.hidden && e.textContent, leg: document.querySelector('.wk-rleg').hidden, max: +document.querySelector('.wk-range').max }; });
      pruefe('DWD-Fehler: Hinweis „gezeigt wird RainViewer“, alte Zeitleiste (13 Bilder), keine Farbskala', /RainViewer/.test(h.text || '') && h.leg && h.max === 12, h);
      pruefe('DWD-Fehler: keine Kartenbilder vom DWD angefragt', dwdBilder(anfragen).length === 0);
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }
    {
      const { ctx, p, probleme } = await neueSeite(b, { dwdBildFehler: true });
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(2500);
      const h = await p.evaluate(() => { const e = document.querySelector('.wk-hinweis'); return e && !e.hidden && e.textContent; });
      pruefe('DWD liefert Fehlerseite statt Bild: Hinweis „kein Radarbild“', /kein Radarbild/.test(h || ''), h);
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }
    {
      // Erst normal laden (merkt Wetter und Aussicht), dann ohne jedes Netz neu laden
      const { ctx, p, probleme } = await neueSeite(b, {});
      await p.waitForSelector('.aussicht', { timeout: 6000 }).catch(() => {});
      await ctx.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), r => r.abort());
      await p.reload(); await p.waitForSelector('.aktuell-kachel', { timeout: 10000 }); await p.waitForTimeout(1200);
      const t = await p.evaluate(() => ({ meldung: document.getElementById('meldung').textContent, aus: document.querySelectorAll('.aus-tag').length }));
      pruefe('Ohne Netz: Wetter und Aussicht aus dem letzten Stand', /Offline/.test(t.meldung) && t.aus === 10, t);
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(1500);
      const h = await p.evaluate(() => { const e = document.querySelector('.wk-hinweis'); return e && !e.hidden && e.textContent; });
      pruefe('Ohne Netz: Radar meldet sich mit Hinweis statt leer', !!h, h);
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('5) Ort außerhalb Deutschlands (Corralejo): RainViewer wie bisher');
    {
      const { ctx, p, probleme, anfragen } = await neueSeite(b, { speicher: { 'wedder-ort': JSON.stringify({ id: 'corralejo', name: 'Corralejo', lat: 28.73079, lon: -13.86749 }) } });
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(1500);
      const q = await p.evaluate(() => ({ quelle: document.querySelector('.wk-quelle').textContent, leg: document.querySelector('.wk-rleg').hidden }));
      pruefe('Corralejo: kein Abruf beim DWD, Quelle RainViewer, keine DWD-Farbskala', !anfragen.some(u => /maps\.dwd\.de/.test(u)) && /RainViewer/.test(q.quelle) && q.leg, q);
      pruefe('keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }
  } catch (e) { fehler++; console.log('  ✗ Abbruch: ' + e.message); }
  await b.close(); s.close();
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})();
