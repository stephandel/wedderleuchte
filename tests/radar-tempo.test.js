/* tests/radar-tempo.test.js – Wie schnell zeigt die Wedderleuchte ein Regenbild, wenn der DWD langsam ist? (18.11.2026, P-7ed7)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8976 node tests/radar-tempo.test.js
           WURZEL=<anderer App-Ordner> prüft einen anderen Stand (z. B. main, um zu zeigen, dass der Test vorher rot ist).
   Anlass: Der DWD-Kartendienst rechnet jedes Radarbild frisch (geowebcache MISS). Messreihen 18.11. 04:08–04:29 UTC: etwa alle
   5 Minuten 1–1,5 Minuten lang langsam (3–14 s je Bild, auch das vorletzte Bild) oder ohne Antwort (Abbruch nach 40 s), sonst 0,25–0,8 s. Der Test verzögert die Antworten künstlich und misst in WebKit
   (402 × 874), nach wie vielen Millisekunden ein Regenbild zu sehen ist (Deckung = Anteil von 5 × 5 Punkten im Kartenausschnitt,
   über denen ein fertig geladenes, sichtbares Radarbild liegt) und wann die Ladeanzeige verschwindet.
   Zielgrenzen (Begründung im Bericht BERICHT-2026-11-18-karte-schneller.md):
     - Reiter Radar: Regenbild (Deckung ≥ 50 %) spätestens 1,5 s nach dem Antippen, über Mobilfunk (jede Antwort +0,7 s) 2,5 s.
     - Radar-Kachel auf dem Start: Regenbild spätestens 2,5 s nach dem Aufruf (Mobilfunk 4 s).
     - Ehrlich: Ist RainViewer zu sehen, nennt der Titel RainViewer; ist das DWD-Bild da, verschwindet RainViewer.
     - Abspielen: mindestens 90 % der Zeit ist ein Regenbild zu sehen (kein leerer Film).
     - Ladeanzeige und Bild hängen nicht an der Open-Meteo-Abfrage für die Ortsmarken; ohne Bild stehen Ladeanzeige oder Hinweis.
     - Zoomen und Verschieben werden nur gemessen (Zoomen verwirft bei Leaflet ohne Zoom-Animation alle Kacheln, siehe Bericht).
   Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..');
const PORT = +process.env.PORT || 8976;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/wedderleuchte-tests';
const FIX = path.join(__dirname, 'fixtures');
const OM = fs.readFileSync(path.join(FIX, 'open-meteo-mannheim.json'), 'utf8');
const ENS = fs.readFileSync(path.join(FIX, 'ensemble-mannheim-2026-11-17.json'), 'utf8');
const KACHEL = fs.readFileSync(path.join(FIX, 'dwd-radar-kachel-2026-11-17.png'));
fs.mkdirSync(BILDER, { recursive: true });

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name + (detail !== undefined ? '  (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : '')); }
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

const MIN = 60000, iso = t => new Date(t).toISOString().replace(/\.\d+Z$/, '.000Z');
function caps() {
  const ref = Math.floor(Date.now() / (5 * MIN)) * 5 * MIN - 5 * MIN;
  return '<WMS_Capabilities><Layer><Name>Niederschlagsradar</Name><Dimension name="time" default="current" units="ISO8601">' + iso(ref - 3 * 24 * 60 * MIN) + '/' + iso(ref + 120 * MIN) + '/PT5M</Dimension>' +
    '<Dimension name="REFERENCE_TIME" default="' + iso(ref) + '" units="ISO8601">' + iso(ref - 5 * MIN) + ',' + iso(ref) + '</Dimension></Layer></WMS_Capabilities>';
}
// RainViewer-Liste wie beim echten Dienst: letzte Aufnahme 10–20 Minuten alt, 10-Minuten-Takt
function rainviewer() {
  const neu = Math.floor(Date.now() / (10 * MIN)) * 10 * MIN - 10 * MIN, past = [];
  for (let k = 12; k >= 0; k--) past.push({ time: (neu - k * 10 * MIN) / 1000, path: '/v2/radar/test' + k });
  return JSON.stringify({ version: '2.0', host: 'https://tilecache.rainviewer.com', radar: { past, nowcast: [] } });
}

// Verzögerungen in ms: caps = DWD-Fähigkeitenliste, bild = DWD-Radarbild, gitter = Open-Meteo-Abfrage der Karte (viele Punkte), sonst = alles andere Fremde
const LAGEN = {
  // Messreihe 18.11. 04:08–04:18 UTC: etwa alle 5 Min ist der DWD 1–1,5 Min lang langsam (3,6–9,2 s) oder antwortet gar nicht (Abbruch nach 40 s)
  langsam: { name: 'DWD langsam (Liste 2 s, Bild 9 s), sonst schnell', caps: 2000, bild: 9000, gitter: 150, sonst: 100, zielReiter: 1500, zielKachel: 2500 },
  nie: { name: 'DWD-Bilder kommen nie (Liste 0,3 s)', caps: 300, bild: Infinity, gitter: 150, sonst: 100, zielReiter: 1500, zielKachel: 2500 },
  mobil: { name: 'Mobilfunk: jede Antwort +0,7 s, DWD langsam (Bild 9 s)', caps: 2700, bild: 9700, gitter: 850, sonst: 700, zielReiter: 2500, zielKachel: 4000 },
  meteo: { name: 'DWD schnell, Open-Meteo-Gitter langsam (4 s)', caps: 300, bild: 400, gitter: 4000, sonst: 100, zielReiter: 1500, zielKachel: 2500 }
};

const MESSER = () => {
  // Deckung: Anteil von 5 × 5 Punkten im Rahmen, über denen ein fertig geladenes, sichtbares Radarbild (DWD oder RainViewer) liegt
  window.__deckung = sel => {
    const box = document.querySelector(sel); if (!box) return { anteil: 0, quellen: [] };
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return { anteil: 0, quellen: [] };
    const sichtbar = i => { let e = i, o = 1; while (e && e !== box.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; o *= +cs.opacity; e = e.parentElement; } return o > 0.05; };
    const rechtecke = [...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de|rainviewer/.test(i.src) && i.complete && i.naturalWidth > 0 && sichtbar(i))
      .map(i => ({ q: /dwd/.test(i.src) ? 'dwd' : 'rainviewer', b: i.getBoundingClientRect() }));
    let treffer = 0; const quellen = new Set();
    for (let a = 0; a < 5; a++) for (let c = 0; c < 5; c++) {
      const x = r.left + r.width * (a + 0.5) / 5, y = r.top + r.height * (c + 0.5) / 5;
      const t = rechtecke.find(k => x >= k.b.left && x < k.b.right && y >= k.b.top && y < k.b.bottom);
      if (t) { treffer++; quellen.add(t.q); }
    }
    return { anteil: treffer / 25, quellen: [...quellen].sort() };
  };
  window.__spur = []; window.__null = 0; window.__sel = '#radarKachel';
  window.__messen = (sel) => { window.__sel = sel; window.__spur = []; window.__null = performance.now(); };
  setInterval(() => {
    const d = window.__deckung(window.__sel), lade = document.querySelector('#karte .wk-lade'), hw = document.querySelector('#karte .wk-hinweis'), titel = document.querySelector(window.__sel === '#karte' ? '#karte .wk-titel' : '#radarKachel .radar-zeit');
    window.__spur.push({ t: Math.round(performance.now() - window.__null), anteil: d.anteil, quellen: d.quellen.join('+'), lade: !!lade && !lade.hidden, hinweis: !!hw && !hw.hidden ? hw.textContent : '', titel: titel ? titel.textContent : '' });
  }, 50);
};

async function neueSeite(b, lage) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' });
  const anfragen = [];
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), async route => {
    const u = new URL(route.request().url());
    let warte = lage.sonst, antwort;
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (u.host === 'api.open-meteo.com') { const gitter = /latitude=[^&]*,/.test(u.search); if (gitter) warte = lage.gitter; antwort = { status: 200, contentType: 'application/json', headers: cors, body: OM }; }
    else if (u.host === 'ensemble-api.open-meteo.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: ENS };
    else if (u.host === 'maps.dwd.de' && /GetCapabilities/i.test(u.search)) { warte = lage.caps; antwort = { status: 200, contentType: 'text/xml', headers: cors, body: caps() }; }
    else if (u.host === 'maps.dwd.de' && /GetMap/i.test(u.search)) { warte = lage.bild; antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL }; }
    else if (u.host === 'api.rainviewer.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: rainviewer() };
    else if (/rainviewer\.com$/.test(u.host)) antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL };
    anfragen.push({ url: u.href, t: Date.now() });
    if (warte === Infinity) return;            // antwortet nie (die Anfrage bleibt offen, bis die Seite zugeht)
    await new Promise(r => setTimeout(r, warte));
    try { if (antwort) await route.fulfill(antwort); else await route.abort(); } catch (e) { /* Seite schon zu */ }
  });
  await ctx.addInitScript(MESSER);
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  return { ctx, p, probleme, anfragen };
}
const spur = p => p.evaluate(() => window.__spur);
const erstes = (s, f) => { const e = s.find(f); return e ? e.t : null; };
async function warten(p, bedingung, ms) { const ende = Date.now() + ms; while (Date.now() < ende) { const s = await spur(p); if (s.length && bedingung(s)) return s; await p.waitForTimeout(100); } return spur(p); }
// Ehrlichkeit: ist RainViewer zu sehen, nennt der Titel RainViewer; ist nur der DWD zu sehen, steht RainViewer nicht im Titel
// Solange im Reiter Radar kein Regenbild zu sehen ist, sagt die Karte das (Ladeanzeige oder Hinweis) – nicht leer und still
const stumm = s => s.filter(x => x.t > 300 && x.anteil < 0.5 && !x.lade && !x.hinweis);
const ehrlich = s => s.filter(x => x.anteil > 0 && ((x.quellen === 'rainviewer' && !/RainViewer/.test(x.titel)) || (x.quellen === 'dwd' && /RainViewer/.test(x.titel)) || x.quellen === 'dwd+rainviewer'));

(async () => {
  const s = await server();
  const b = await webkit.launch();
  const tabelle = [];
  try {
    for (const id of Object.keys(LAGEN)) {
      const L = LAGEN[id];
      console.log('\n== ' + L.name + ' ==');

      const NIE = L.bild === Infinity;
      // 1) Start: Radar-Kachel, dann (nach dem Laden) Reiter Radar, Abspielen, Zoomen, Verschieben (die letzten beiden nur gemessen)
      const { ctx, p, probleme, anfragen } = await neueSeite(b, L);
      await p.goto(BASIS);
      let sp = await warten(p, x => x.some(e => e.anteil >= 0.5 && e.quellen === (NIE ? 'rainviewer' : 'dwd')), 20000);
      const kRegen = erstes(sp, e => e.anteil >= 0.5), kDwd = erstes(sp, e => e.anteil >= 0.5 && e.quellen === 'dwd');
      pruefe('Start-Kachel: Regenbild nach ≤ ' + L.zielKachel + ' ms', kRegen != null && kRegen <= L.zielKachel, { regenbild: kRegen, dwd: kDwd });
      pruefe('Start-Kachel ehrlich beschriftet (RainViewer nur mit Wort „RainViewer“)', ehrlich(sp).length === 0, ehrlich(sp).slice(0, 2));
      if (!NIE) { const n = anfragen.filter(a => /GetMap/.test(a.url)).length, bilder = await p.$$eval('[data-radar] img:not(.topo)', is => new Set(is.map(i => i.src)).size);
        pruefe('Start-Kachel: jedes DWD-Bild nur einmal abgerufen (Vorladen wird wiederverwendet)', n <= bilder, { abrufe: n, bilder }); }
      if (id === 'langsam') await (await p.$('#radarKachel')).screenshot({ path: path.join(BILDER, 'tempo-kachel-' + (process.env.ETIKETT || 'stand') + '.png') }).catch(() => {});

      await p.evaluate(() => { window.__messen('#karte'); document.querySelector('[data-tab="radsat"]').click(); });
      sp = await warten(p, x => (NIE ? x[x.length - 1].t > 12000 : x.some(e => e.anteil >= 0.99 && e.quellen === 'dwd' && !e.lade)) && x[x.length - 1].t > 1200, 20000);
      const rRegen = erstes(sp, e => e.anteil >= 0.5), rDwd = erstes(sp, e => e.anteil >= 0.5 && e.quellen === 'dwd'), rVoll = erstes(sp, e => e.anteil >= 0.99 && e.quellen === 'dwd');
      const rLade = erstes(sp, (e, i) => !e.lade && sp.slice(i).every(x => !x.lade));
      pruefe('Reiter Radar (warm): Regenbild nach ≤ ' + L.zielReiter + ' ms', rRegen != null && rRegen <= L.zielReiter, { regenbild: rRegen, dwd: rDwd, dwdVoll: rVoll, ladeanzeigeWeg: rLade });
      pruefe('Reiter Radar: ehrlich beschriftet', ehrlich(sp).length === 0, ehrlich(sp).slice(0, 2));
      const zuletzt = sp[sp.length - 1];
      if (NIE) pruefe('DWD stumm: RainViewer bleibt stehen, Hinweis „antwortet gerade nicht“', zuletzt.quellen === 'rainviewer' && /RainViewer/.test(zuletzt.titel) && /antwortet gerade nicht/.test(zuletzt.hinweis), zuletzt);
      else pruefe('Reiter Radar: am Ende DWD-Bild, kein RainViewer, Titel „gemessen vor“', zuletzt.quellen === 'dwd' && /gemessen vor/.test(zuletzt.titel) && !/RainViewer/.test(zuletzt.titel) && !/RainViewer/.test(zuletzt.hinweis), zuletzt);
      if (!NIE) pruefe('Ladeanzeige weg spätestens 0,5 s nach dem vollständigen DWD-Bild', rLade != null && rVoll != null && rLade <= rVoll + 500, { voll: rVoll, ladeWeg: rLade });
      pruefe('Reiter Radar: nie leer und still (ohne Bild steht Ladeanzeige oder Hinweis)', stumm(sp).length === 0, stumm(sp).slice(0, 2));

      // Abspielen: 8 s, Anteil der Zeit mit Regenbild
      await p.evaluate(() => { window.__messen('#karte'); document.querySelector('.wk-play').click(); });
      await p.waitForTimeout(8000);
      sp = await spur(p);
      await p.evaluate(() => document.querySelector('.wk-play').click());
      const mitBild = sp.filter(e => e.anteil >= 0.5).length / sp.length;
      const wechsel = new Set(sp.map(e => e.titel)).size;
      pruefe('Abspielen: mindestens 90 % der Zeit ein Regenbild', mitBild >= 0.9, { anteil: Math.round(mitBild * 100) + ' %', titel: wechsel });
      pruefe('Abspielen: nie leer und still', stumm(sp).length === 0, stumm(sp).slice(0, 2));
      if (NIE) { pruefe('keine JS-Fehler', probleme.length === 0, probleme.length ? probleme : undefined); tabelle.push({ lage: id, kachelRegen: kRegen, reiterRegen: rRegen, film: Math.round(mitBild * 100) + ' %' }); await ctx.close(); }
      if (!NIE) {
      await p.waitForTimeout(300);
      await p.click('[data-film="ende"]').catch(() => {}); await p.waitForTimeout(100);
      // zurück zur neuesten Messung, bis sie wieder voll da ist
      await p.evaluate(() => { const r = document.querySelector('.wk-range'); r.value = 18; r.dispatchEvent(new Event('input')); });
      await warten(p, x => x.length && x[x.length - 1].anteil >= 0.99, 15000);

      // Zoomen (+) und Verschieben (Ziehen um 150 px)
      await p.evaluate(() => { window.__messen('#karte'); document.querySelector('[data-zoom="1"]').click(); });
      sp = await warten(p, x => x.some(e => e.anteil >= 0.99) && x[x.length - 1].t > 600, 15000);
      const zSofort = sp.filter(e => e.t <= 500).every(e => e.anteil >= 0.5), zVoll = erstes(sp, e => e.anteil >= 0.99);
      console.log('  · Messwert Zoomen: Regenbild in den ersten 0,5 s ' + (zSofort ? 'durchgehend' : 'NICHT durchgehend') + ' zu sehen, wieder vollständig nach ' + zVoll + ' ms (nur gemessen, siehe Bericht)');
      const box = await (await p.$('#karte .leaflet-container, #karte')).boundingBox();
      await p.evaluate(() => window.__messen('#karte'));
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
      await p.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 6 }); await p.mouse.up();
      sp = await warten(p, x => x.some(e => e.anteil >= 0.99 && e.t > 300) && x[x.length - 1].t > 600, 15000);
      const vSofort = sp.filter(e => e.t > 150 && e.t <= 500), vVoll = erstes(sp, e => e.t > 300 && e.anteil >= 0.99);
      console.log('  · Messwert Verschieben: kleinste Deckung in 0,15–0,5 s ' + Math.min(...vSofort.map(e => e.anteil)) + ', wieder vollständig nach ' + vVoll + ' ms (nur gemessen)');
      pruefe('keine JS-Fehler', probleme.length === 0, probleme.length ? probleme : undefined);
      tabelle.push({ lage: id, kachelRegen: kRegen, kachelDwd: kDwd, reiterRegen: rRegen, reiterDwd: rDwd, reiterDwdVoll: rVoll, ladeWeg: rLade, film: Math.round(mitBild * 100) + ' %', zoomVoll: zVoll, schiebVoll: vVoll });
      await ctx.close();
      }

      // 2) Kaltstart: Radar gleich nach dem Erscheinen der Startseite antippen (Fähigkeitenliste noch unterwegs)
      {
        const { ctx, p, probleme } = await neueSeite(b, L);
        await p.goto(BASIS);
        await p.waitForSelector('.aktuell-kachel', { timeout: 15000 });
        await p.evaluate(() => { window.__messen('#karte'); document.querySelector('[data-tab="radsat"]').click(); });
        if (id === 'langsam') { await p.waitForTimeout(1600); await p.screenshot({ path: path.join(BILDER, 'tempo-radar-1600ms-' + (process.env.ETIKETT || 'stand') + '.png') }); }
        const sp2 = await warten(p, x => NIE ? x.length && x[x.length - 1].t > 4000 : x.some(e => e.anteil >= 0.99 && e.quellen === 'dwd' && !e.lade), 25000);
        const kalt = erstes(sp2, e => e.anteil >= 0.5), kaltDwd = erstes(sp2, e => e.anteil >= 0.5 && e.quellen === 'dwd'), kaltLade = erstes(sp2, (e, i) => !e.lade && sp2.slice(i).every(x => !x.lade));
        pruefe('Kaltstart Reiter Radar: Regenbild nach ≤ ' + L.zielReiter + ' ms', kalt != null && kalt <= L.zielReiter, { regenbild: kalt, dwd: kaltDwd, ladeanzeigeWeg: kaltLade });
        pruefe('Kaltstart: ehrlich beschriftet', ehrlich(sp2).length === 0, ehrlich(sp2).slice(0, 2));
        pruefe('Kaltstart: nie leer und still', stumm(sp2).length === 0, stumm(sp2).slice(0, 2));
        pruefe('keine JS-Fehler', probleme.length === 0, probleme.length ? probleme : undefined);
        tabelle[tabelle.length - 1].kaltRegen = kalt; tabelle[tabelle.length - 1].kaltDwd = kaltDwd; tabelle[tabelle.length - 1].kaltLadeWeg = kaltLade;
        await ctx.close();
      }
    }
  } catch (e) { fehler++; console.log('  ✗ Abbruch: ' + e.stack); }
  console.log('\nMesswerte in ms (null = nicht erreicht):');
  console.table(tabelle);
  await b.close(); s.close();
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})();
