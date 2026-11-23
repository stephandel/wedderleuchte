/* tests/zoom-tempo.test.js – Bleibt nach Zoomen und Verschieben ein Regenbild zu sehen, wenn der DWD langsam ist? (23.11.2026, P-cd84)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=9231 node tests/zoom-tempo.test.js
           WURZEL=<anderer App-Ordner> prüft einen anderen Stand (z. B. main, um zu zeigen, dass der Test vorher rot ist).
   Anlass: Stephan zu „Karte zoomen/verschieben: Wartezeit danach in Ordnung?“ → „Teils“. Leaflet 1.9.4 wirft ohne Zoom-Animation
   beim Zoomen alle fertigen Kacheln weg (viewprereset → _invalidateAll); bei langsamem DWD (Langsam-Fenster etwa alle 5 Minuten,
   3–14 s je Bild) war die Karte danach 9–11 s ohne Regen (radar-tempo.test.js, 18.11.).
   Ablauf (WebKit 402 × 874): Reiter Radar öffnen, das DWD-Bild schnell laden lassen (0,3 s), dann wird der DWD langsam (9 s je Bild)
   und erst dann wird gezoomt (Knopf +, Knopf −, Mausrad) oder verschoben (Ziehen 250 px, Wischen mit Schwung). Alle 50 ms wird gemessen, welcher Anteil
   von 5 × 5 Punkten im Kartenausschnitt (bzw. der inneren 3 × 3) von einem fertig geladenen, sichtbaren Radarbild gedeckt ist.
   Zielgrenzen:
     - Zoomen hinein und Mausrad: höchstens 300 ms ohne Regenbild (Deckung < 50 %), danach durchgehend Regen bis zum neuen DWD-Bild.
     - Zoomen hinaus: das bisher gezeigte Gebiet (innere 3 × 3 Punkte) bleibt durchgehend gedeckt (höchstens 300 ms Lücke),
       der neu sichtbare Rand lädt mit Ladeanzeige.
     - Verschieben: höchstens 300 ms mit Deckung unter 50 %.
     - Weit verschieben (Wischen mit Schwung, die Karte läuft über 1000 px nach): höchstens 1 s ohne Regenbild, gezählt ab dem
       Stillstand der Karte (RainViewer springt wie beim Start nach 600 ms ein, ehrlich beschriftet).
     - Alle Lücken und die Ladeanzeige werden ab dem Stillstand der Karte (letztes moveend) gemessen.
     - Ehrlich: Titel nennt weiter den DWD-Zeitpunkt („gemessen vor“), am Ende ist das neue DWD-Bild vollständig da, ohne Platzhalter.
     - Platzhalter laden nichts nach (keine zusätzlichen DWD-Anfragen) und lassen die Begrenzung aus dem Regler-Test stehen
       (höchstens 8 DWD-Ebenen, 60 Kachelbilder).
     - Gegenprobe DWD schnell (0,3 s): nach dem Zoomen in ≤ 1,5 s wieder das volle DWD-Bild, kein Platzhalter bleibt hängen.
   Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..');
const PORT = +process.env.PORT || 9231;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const FIX = path.join(__dirname, 'fixtures');
const OM = fs.readFileSync(path.join(FIX, 'open-meteo-mannheim.json'), 'utf8');
const ENS = fs.readFileSync(path.join(FIX, 'ensemble-mannheim-2026-11-17.json'), 'utf8');
const KACHEL = fs.readFileSync(path.join(FIX, 'dwd-radar-kachel-2026-11-17.png'));

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
function rainviewer() {
  const neu = Math.floor(Date.now() / (10 * MIN)) * 10 * MIN - 10 * MIN, past = [];
  for (let k = 12; k >= 0; k--) past.push({ time: (neu - k * 10 * MIN) / 1000, path: '/v2/radar/test' + k });
  return JSON.stringify({ version: '2.0', host: 'https://tilecache.rainviewer.com', radar: { past, nowcast: [] } });
}

// Verzögerung der DWD-Bilder, im Lauf umschaltbar (erst schnell laden, dann beginnt das Langsam-Fenster)
const lage = { bild: 300 };
async function neueSeite(b, viewport) {
  const ctx = await b.newContext({ viewport: viewport || { width: 402, height: 874 }, serviceWorkers: 'block' });
  const dwdAnfragen = [];
  // Antworten ohne Cache-Kopfzeilen wie beim echten DWD (geowebcache MISS, kein Cache-Control)
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), async route => {
    const u = new URL(route.request().url());
    let warte = 100, antwort;
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (u.host === 'api.open-meteo.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: OM };
    else if (u.host === 'ensemble-api.open-meteo.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: ENS };
    else if (u.host === 'maps.dwd.de' && /GetCapabilities/i.test(u.search)) { warte = 300; antwort = { status: 200, contentType: 'text/xml', headers: cors, body: caps() }; }
    else if (u.host === 'maps.dwd.de' && /GetMap/i.test(u.search)) { warte = lage.bild; dwdAnfragen.push(u.href); antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL }; }
    else if (u.host === 'api.rainviewer.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: rainviewer() };
    else if (/rainviewer\.com$/.test(u.host)) antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL };
    await new Promise(r => setTimeout(r, warte));
    try { if (antwort) await route.fulfill(antwort); else await route.abort(); } catch (e) { /* Seite schon zu */ }
  });
  await ctx.addInitScript(MESSER);
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') probleme.push('Konsole: ' + m.text()); });
  return { ctx, p, probleme, dwdAnfragen };
}

const MESSER = () => {
  // Deckung: Anteil der Punkte (5 × 5 im ganzen Rahmen, innen 3 × 3), über denen ein fertig geladenes, sichtbares Radarbild liegt
  const deckung = () => {
    const box = document.querySelector('#karte .wk-karte'); if (!box) return { anteil: 0, innen: 0, quellen: '' };
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return { anteil: 0, innen: 0, quellen: '' };
    const sichtbar = i => { let e = i, o = 1; while (e && e !== box.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; o *= +cs.opacity; e = e.parentElement; } return o > 0.05; };
    const re = [...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de|rainviewer/.test(i.src) && i.complete && i.naturalWidth > 0 && sichtbar(i))
      .map(i => ({ q: /dwd/.test(i.src) ? 'dwd' : 'rainviewer', b: i.getBoundingClientRect() }));
    let t = 0, ti = 0; const quellen = new Set();
    for (let a = 0; a < 5; a++) for (let c = 0; c < 5; c++) {
      const x = r.left + r.width * (a + 0.5) / 5, y = r.top + r.height * (c + 0.5) / 5;
      const k = re.find(k => x >= k.b.left && x < k.b.right && y >= k.b.top && y < k.b.bottom);
      if (k) { t++; quellen.add(k.q); if (a > 0 && a < 4 && c > 0 && c < 4) ti++; }
    }
    return { anteil: t / 25, innen: ti / 9, quellen: [...quellen].sort().join('+') };
  };
  window.__deckung = deckung;
  window.__spur = []; window.__null = 0;
  window.__messen = () => { window.__spur = []; window.__null = performance.now(); };
  setInterval(() => {
    const d = deckung(), lade = document.querySelector('#karte .wk-lade'), titel = document.querySelector('#karte .wk-titel');
    const ph = [...document.querySelectorAll('#karte img.leaflet-image-layer')].filter(i => /maps\.dwd\.de/.test(i.src)).length;
    window.__spur.push({ t: Math.round(performance.now() - window.__null), ph, anteil: d.anteil, innen: d.innen, quellen: d.quellen, lade: !!lade && !lade.hidden, titel: titel ? titel.textContent : '' });
  }, 50);
};
const spur = p => p.evaluate(() => window.__spur);
async function warten(p, bedingung, ms) { const ende = Date.now() + ms; while (Date.now() < ende) { const s = await spur(p); if (s.length && bedingung(s)) return s; await p.waitForTimeout(100); } return spur(p); }
// längste Strecke (ms), in der die Bedingung nicht erfüllt ist
function luecke(s, gut) { let max = 0, start = null; for (const e of s) { if (!gut(e)) { if (start == null) start = e.t; max = Math.max(max, e.t - start + 50); } else start = null; } return max; }
// Was hängt in der Karte? DWD-Ebenen in Leaflet, Kachelbilder (Radar), davon Platzhalter (Bild-Ebenen, keine Kacheln)
const ZAEHLEN = () => {
  const box = document.querySelector('#karte'), mk = box && [box, ...box.querySelectorAll('*')].find(e => e._wkMap), map = mk && mk._wkMap;
  const ebenen = map ? Object.values(map._layers).filter(l => typeof l._url === 'string' && /maps\.dwd\.de/.test(l._url)).length : -1;
  const imgs = [...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de|rainviewer|eumetsat/.test(i.src));
  return { ebenen, bilder: imgs.length, platzhalter: imgs.filter(i => i.classList.contains('leaflet-image-layer')).length };
};

async function radarOeffnen(p) {
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 15000 });
  await p.click('[data-tab="radsat"]');
  await p.waitForFunction(() => { const r = document.querySelector('#karte .wk-range'); return r && +r.max > 20; }, null, { timeout: 15000 });
}
// DWD kurz schnell machen, bis das Bild im jetzigen Ausschnitt ganz da ist (Ausgangslage für jede Probe)
async function bildVoll(p) {
  lage.bild = 300;
  await p.evaluate(() => window.__messen());
  const s = await warten(p, x => { const l = x[x.length - 1]; return l.anteil >= 0.99 && l.quellen === 'dwd' && !l.lade && l.t > 1200; }, 15000);
  const l = s[s.length - 1];
  return l && l.anteil >= 0.99 && l.quellen === 'dwd';
}
// Wie ein Finger: 250 px in etwa 0,3 s und kurz halten (ohne Pause rechnet Leaflet aus wenigen Millisekunden eine riesige
// Geschwindigkeit und lässt die Karte über 1500 px nachschwingen – Probe 23.11.; so schnell wischt kein Finger)
async function ziehen(p, dx) {
  const box = await (await p.$('#karte .wk-leaflet')).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let k = 1; k <= 15; k++) { await p.mouse.move(x + dx * k / 15, y); await p.waitForTimeout(20); }
  await p.waitForTimeout(80); await p.mouse.up();
}

// Wischen mit Schwung: Leaflet lässt die Karte nach dem Loslassen mit panBy nachlaufen (Trägheit). Mit der Maus in Playwright
// schwankt die Geschwindigkeit stark (Probe 23.11.: mal 300 px, mal 1700 px, einmal 9 s Flug), daher hier derselbe Aufruf wie
// Leaflets Trägheit selbst: 1600 px in 1,5 s, Verlauf wie dort (easeLinearity 0,2, animate: true – ohne springt Leaflet bei mehr als
// einer Kartenbreite sofort) – danach ist alles neues Gebiet
async function wischen(p, dx) {
  await p.evaluate(dx => { const m = [...document.querySelectorAll('#karte *')].find(e => e._wkMap)._wkMap; m.panBy([dx, 0], { duration: 1.5, easeLinearity: 0.2, noMoveStart: true, animate: true }); }, dx);
}

const AKTIONEN = [
  { id: 'Zoomen hinaus (Knopf −)', art: 'hinaus', tu: p => p.click('#karte [data-zoom="-1"]') },
  { id: 'Zoomen hinein (Knopf +)', art: 'hinein', tu: p => p.click('#karte [data-zoom="1"]') },
  { id: 'Zoomen mit Mausrad (hinein)', art: 'hinein', tu: async p => { const box = await (await p.$('#karte .wk-leaflet')).boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.wheel(0, -300); } },
  { id: 'Verschieben (Ziehen 250 px)', art: 'schieben', tu: p => ziehen(p, 250) },
  { id: 'Weit verschieben (Wischen mit Schwung)', art: 'weit', tu: p => wischen(p, -1600) }
];
const GRENZE_LUECKE = 300, GRENZE_WEIT = 1000;   // weit: neues Gebiet, RainViewer nach 600 ms Wartezeit wie beim Start (ab Stillstand)

(async () => {
  const s = await server();
  const b = await webkit.launch();
  const tabelle = [];
  try {
    const { ctx, p, probleme, dwdAnfragen } = await neueSeite(b);
    await radarOeffnen(p);
    pruefe('Ausgangslage: DWD-Bild vollständig da', await bildVoll(p));
    for (const a of AKTIONEN) {
      console.log('\n== ' + a.id + ', DWD langsam (9 s je Bild) ==');
      if (!await bildVoll(p)) { pruefe(a.id + ': Ausgangslage DWD-Bild voll', false); continue; }
      const titelVorher = await p.$eval('#karte .wk-titel', e => e.textContent);
      lage.bild = 9000;
      const n0 = dwdAnfragen.length;
      await p.evaluate(() => { window.__messen(); window.__ruhe = 0; const m = document.querySelector('#karte .wk-karte')._wkMap || [...document.querySelectorAll('#karte *')].find(e => e._wkMap)._wkMap;
        if (!window.__ruheAn) { window.__ruheAn = true; m.on('moveend', () => { window.__ruhe = Math.round(performance.now() - window.__null); }); } });
      await a.tu(p);
      await p.waitForTimeout(400);
      const zaehlung = await p.evaluate(ZAEHLEN);
      const sp = await warten(p, x => x[x.length - 1].t > 20000 || (x[x.length - 1].quellen === 'dwd' && x[x.length - 1].anteil >= 0.99 && !x[x.length - 1].lade && x[x.length - 1].t > 10000), 23000);
      const nachher = await p.evaluate(ZAEHLEN);
      // gemessen ab dem Moment, in dem die Karte zur Ruhe kommt (letztes moveend; beim Wischen läuft sie gut 1 s nach)
      const ruhe = await p.evaluate(() => window.__ruhe), ganz = sp.filter(e => e.t > Math.max(100, ruhe));
      const lueckeGanz = luecke(ganz, e => e.anteil >= 0.5), lueckeInnen = luecke(ganz, e => e.innen >= 0.99);
      // fertig = neues DWD-Bild vollständig sichtbar, ohne Platzhalter und ohne RainViewer (und bleibt so)
      const voll = (sp.find((e, i) => e.t > 100 && sp.slice(i).every(x => x.anteil >= 0.99 && x.quellen === 'dwd' && !x.ph && !x.lade)) || {}).t || null;
      const kleinste = Math.min(...ganz.filter(e => e.t < Math.max(8000, ruhe + 3000)).map(e => e.anteil));
      if (a.art === 'hinaus') pruefe(a.id + ': bisher gezeigtes Gebiet bleibt gedeckt (Lücke ≤ ' + GRENZE_LUECKE + ' ms)', lueckeInnen <= GRENZE_LUECKE, { lueckeInnenMs: lueckeInnen, kleinsteDeckung: kleinste, dwdFertigMs: voll });
      else if (a.art === 'weit') pruefe(a.id + ': höchstens ' + GRENZE_WEIT + ' ms ohne Regenbild', lueckeGanz <= GRENZE_WEIT, { lueckeMs: lueckeGanz, kleinsteDeckung: kleinste, dwdFertigMs: voll });
      else pruefe(a.id + ': höchstens ' + GRENZE_LUECKE + ' ms ohne Regenbild', lueckeGanz <= GRENZE_LUECKE, { lueckeMs: lueckeGanz, kleinsteDeckung: kleinste, dwdFertigMs: voll });
      const ohneAnzeige = ganz.filter(e => e.t < 8000 && (e.anteil < 0.99 || e.ph) && e.quellen !== 'rainviewer' && !e.lade);
      pruefe(a.id + ': solange das neue Bild nicht vollständig ist (oder ein Platzhalter steht), steht „lädt …“', ohneAnzeige.length === 0, ohneAnzeige.slice(0, 2));
      if (a.art === 'weit') {
        // RainViewer nur mit dem Wort „RainViewer“ im Titel, DWD nie mit; nie beide zugleich
        const fremd = ganz.filter(e => e.anteil > 0 && ((e.quellen === 'rainviewer' && !/RainViewer/.test(e.titel)) || (e.quellen === 'dwd' && /RainViewer/.test(e.titel)) || e.quellen === 'dwd+rainviewer'));
        pruefe(a.id + ': ehrlich – RainViewer nur mit „RainViewer“ im Titel, nie gemischt', fremd.length === 0, fremd.slice(0, 2));
      } else {
        const fremd = ganz.filter(e => e.anteil > 0 && (e.quellen !== 'dwd' || !/gemessen vor/.test(e.titel)));
        pruefe(a.id + ': ehrlich – nur DWD-Bild zum Titel „gemessen vor“ (kein Wechsel der Quelle)', fremd.length === 0 && /gemessen vor/.test(titelVorher), fremd.slice(0, 2));
      }
      if (process.env.SPUR) console.log(sp.filter((e, i) => i % 4 === 0 && e.t < 12000).map(e => e.t + ':' + e.anteil + (e.quellen ? '/' + e.quellen : '') + (e.lade ? 'L' : '') + (/RainViewer/.test(e.titel) ? 'R' : '')).join(' '));
      const zuletzt = sp[sp.length - 1];
      pruefe(a.id + ': am Ende neues DWD-Bild vollständig, kein Platzhalter mehr', zuletzt.anteil >= 0.99 && zuletzt.quellen === 'dwd' && /gemessen vor/.test(zuletzt.titel) && !/RainViewer/.test(zuletzt.titel) && nachher.platzhalter === 0, { zuletzt: { anteil: zuletzt.anteil, quellen: zuletzt.quellen, titel: zuletzt.titel }, nachher });
      const neueAnfragen = dwdAnfragen.length - n0, frueher = new Set(dwdAnfragen.slice(0, n0)), doppelt = dwdAnfragen.slice(n0).filter(u => frueher.has(u)).length;
      pruefe(a.id + ': Platzhalter holen nichts nach (kein Bild doppelt beim DWD angefragt)', doppelt === 0, { neueAnfragen, doppelt });
      pruefe(a.id + ': Begrenzung bleibt (≤ 8 DWD-Ebenen, ≤ 60 Kachelbilder)', zaehlung.ebenen <= 8 && zaehlung.bilder <= 60 && nachher.ebenen <= 8 && nachher.bilder <= 60, { waehrend: zaehlung, nachher });
      console.log('  · Messwerte: längste Lücke ganz ' + lueckeGanz + ' ms, innen ' + lueckeInnen + ' ms, kleinste Deckung ' + kleinste + ', neues DWD-Bild fertig nach ' + voll + ' ms, Karte steht nach ' + ruhe + ' ms, neue DWD-Anfragen ' + neueAnfragen + ', Platzhalter währenddessen ' + zaehlung.platzhalter);
      tabelle.push({ probe: a.id, ruheMs: ruhe, lueckeGanzMs: lueckeGanz, lueckeInnenMs: lueckeInnen, kleinsteDeckung: kleinste, dwdFertigMs: voll, dwdAnfragen: neueAnfragen, platzhalter: zaehlung.platzhalter });
    }
    // Platzhalter dürfen selbst nichts laden: Bild-Kopien kommen aus dem Speicher des Browsers, nicht vom DWD
    // (geprüft über die Zahl der Anfragen: je Zoomen nur die neuen Kacheln des neuen Ausschnitts)
    pruefe('keine Fehler (langsam)', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
    await ctx.close();

    // Fund A-1 (Fable 23.11.): 520 px weg → RainViewer mit Titel „RainViewer“; 300 px zurück → die alten DWD-Kacheln decken die Mitte
    // wieder, RainViewer geht. Der Titel muss dann wieder den DWD-Zeitpunkt nennen (vorher blieb „RainViewer“ bis ca. 9 s stehen).
    console.log('\n== Weg und halb zurück (520 px, dann 300 px), DWD langsam ==');
    {
      lage.bild = 300;
      const { ctx, p, probleme } = await neueSeite(b);
      await radarOeffnen(p); await bildVoll(p);
      lage.bild = 9000;
      const schieben = dx => p.evaluate(dx => { const m = [...document.querySelectorAll('#karte *')].find(e => e._wkMap)._wkMap; m.panBy([dx, 0], { animate: false }); }, dx);
      await schieben(-520);
      const rv = await p.waitForFunction(() => /RainViewer/.test(document.querySelector('#karte .wk-titel').textContent), null, { timeout: 4000 }).then(() => true).catch(() => false);
      pruefe('Weg (520 px): RainViewer mit Titel „RainViewer“', rv);
      await p.waitForTimeout(300);
      await p.evaluate(() => window.__messen());
      await schieben(300);
      const sp = await warten(p, x => x[x.length - 1].t > 3000, 5000);
      const falsch = sp.filter(e => e.t > 200 && e.anteil > 0 && ((e.quellen === 'dwd' && /RainViewer/.test(e.titel)) || (e.quellen === 'rainviewer' && !/RainViewer/.test(e.titel))));
      const dwdZuSehen = sp.filter(e => e.t > 200 && e.quellen === 'dwd').length;
      pruefe('Halb zurück (300 px): DWD-Bild zu sehen und Titel ohne „RainViewer“ (ab 0,2 s)', dwdZuSehen > 0 && falsch.length === 0, falsch.length ? { falsch: falsch.length + ' von ' + sp.length, beispiel: falsch[0] } : { dwdMesspunkte: dwdZuSehen });
      pruefe('keine Fehler (weg und zurück)', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
      await ctx.close();
    }

    // Obergrenze der Platzhalter (Fable 23.11.: 30 statt höchstens 24 bei 1920 × 1200 nach viel Verschieben):
    // großes Fenster, 20-mal verschieben (DWD schnell, Leaflet behält Kacheln im Rand), dann DWD langsam und zoomen
    console.log('\n== Platzhalter-Obergrenze, Fenster 1920 × 1200 ==');
    {
      lage.bild = 300;
      const { ctx, p, probleme } = await neueSeite(b, { width: 1920, height: 1200 });
      await radarOeffnen(p);
      await bildVoll(p);
      for (let k = 0; k < 20; k++) {
        await p.evaluate(k => { const m = [...document.querySelectorAll('#karte *')].find(e => e._wkMap)._wkMap; m.panBy([200, 150], { animate: false }); }, k);   // schräg in eine Richtung: Leaflet behält viele Randkacheln (Probe: 29)
        await p.waitForTimeout(700);
      }
      await bildVoll(p);
      let meist = 0;
      for (const z of ['1', '1', '-1']) {
        lage.bild = 9000;
        await p.click('#karte [data-zoom="' + z + '"]'); await p.waitForTimeout(400);
        meist = Math.max(meist, (await p.evaluate(ZAEHLEN)).platzhalter);
      }
      pruefe('Großes Fenster: höchstens 24 Platzhalter-Teile (auch nach mehrfachem Zoomen während des Ladens)', meist <= 24 && meist > 0, { meist });
      pruefe('keine Fehler (großes Fenster)', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
      tabelle.push({ probe: 'Platzhalter 1920 × 1200', platzhalter: meist });
      await ctx.close();
    }

    // Gegenprobe: DWD schnell – Zoomen bringt in ≤ 1,5 s das volle neue Bild, Platzhalter verschwinden
    console.log('\n== Gegenprobe DWD schnell (0,3 s je Bild) ==');
    {
      lage.bild = 300;
      const { ctx, p, probleme } = await neueSeite(b);
      await radarOeffnen(p);
      await bildVoll(p);
      for (const a of AKTIONEN.slice(0, 2)) {   // hinaus, hinein
        await bildVoll(p);
        await p.evaluate(() => window.__messen());
        await a.tu(p);
        const sp = await warten(p, x => x.some(e => e.t > 200 && e.anteil >= 0.99 && !e.lade) && x[x.length - 1].t > 2500, 6000);
        const voll = (sp.find(e => e.t > 200 && e.anteil >= 0.99 && !e.lade) || {}).t || null, n = await p.evaluate(ZAEHLEN);
        pruefe(a.id + ' (schnell): volles DWD-Bild nach ≤ 1500 ms, kein Platzhalter', voll != null && voll <= 1500 && n.platzhalter === 0, { vollMs: voll, n });
        tabelle.push({ probe: a.id + ' (DWD schnell)', dwdFertigMs: voll, platzhalter: n.platzhalter });
      }
      // Zeitregler nach dem Zoomen: anderer Zeitpunkt → der Platzhalter des alten Zeitpunkts darf nicht stehen bleiben
      lage.bild = 9000;
      await p.click('#karte [data-zoom="1"]'); await p.waitForTimeout(300);
      const mitten = await p.evaluate(ZAEHLEN);
      await p.evaluate(() => { const r = document.querySelector('#karte .wk-range'); r.value = 5; r.dispatchEvent(new Event('input', { bubbles: true })); });
      await p.waitForTimeout(500);
      const danach = await p.evaluate(ZAEHLEN), d = await p.evaluate(() => window.__deckung());
      pruefe('Zeitregler während des Ladens: Platzhalter des alten Zeitpunkts verschwindet', mitten.platzhalter >= 0 && danach.platzhalter === 0, { mitten, danach, deckung: d.anteil });
      pruefe('keine Fehler (schnell)', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
      await ctx.close();
    }
  } catch (e) { fehler++; console.log('  ✗ Testlauf abgebrochen: ' + (e && e.stack || e)); }
  await b.close(); s.close();
  console.log('\nMesswerte (ms):'); console.table(tabelle);
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden' + (fehler ? ', ' + fehler + ' fehlgeschlagen' : ''));
  process.exit(fehler ? 1 : 0);
})();
