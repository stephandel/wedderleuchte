/* tests/regler-schnell.test.js – Bleibt die Radar-Karte heil, wenn man den Zeitregler schnell hin und her schiebt? (18.11.2026)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8977 node tests/regler-schnell.test.js
           WURZEL=<anderer App-Ordner> prüft einen anderen Stand (z. B. main, um zu zeigen, dass der Test vorher rot ist).
   Anlass: Stephan schob am iPhone (Home-Bildschirm-App, Mobilfunk) den Zeitregler im Reiter Radar schnell hin und her – die App stürzte ab.
   Am Mac lässt sich ein iOS-Absturz nicht erzwingen; der Test misst stattdessen, was dabei wächst (WebKit 402 × 874, Faktor 3):
     - Zahl der DWD-Bildebenen in Leaflet und der Kachelbilder (<img>) in der Karte, dazu deren Pixel (entpackt je Bild Breite × Höhe × 4 Byte),
     - Zahl der DWD-Bildanfragen gesamt und höchstens gleichzeitig offen.
   Der Regler wird 20 s lang schnell hin und her geschoben (wie ein Finger: etwa 60 input-Ereignisse je Sekunde, alle 1,4 s einmal
   über die ganze Leiste und zurück), einmal mit langsamem DWD (6 s je Bild), einmal mit schnellem (0,3 s), dazu 16 s Abspielen.
   Grenzen: höchstens 8 DWD-Ebenen, 60 Bilder, 60 Megapixel und (beim schnellen Schieben) 24 gleichzeitig offene DWD-Anfragen;
   gemächliches Schieben (0,25 s je Schritt) begrenzt Ebenen und Bilder, die Anfragen dort werden nur gemessen. Nach dem Loslassen kommt das
   Bild des gezeigten Zeitpunkts; langsames Schieben (ein Schritt je 0,5 s) zeigt bei schnellem DWD jeden Schritt als eigenes Bild
   (spätestens 1 s nach dem Schritt; gemessen 0,49–0,72 s).
   Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..');
const PORT = +process.env.PORT || 8977;
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

const GRENZE = { ebenen: 8, bilder: 60, megapixel: 60, offen: 24 };

async function neueSeite(b, bildMs) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), async route => {
    const u = new URL(route.request().url());
    let warte = 100, antwort;
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (u.host === 'api.open-meteo.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: OM };
    else if (u.host === 'ensemble-api.open-meteo.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: ENS };
    else if (u.host === 'maps.dwd.de' && /GetCapabilities/i.test(u.search)) { warte = 300; antwort = { status: 200, contentType: 'text/xml', headers: cors, body: caps() }; }
    else if (u.host === 'maps.dwd.de' && /GetMap/i.test(u.search)) { warte = bildMs; antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL }; }
    else if (u.host === 'api.rainviewer.com') antwort = { status: 200, contentType: 'application/json', headers: cors, body: rainviewer() };
    else if (/rainviewer\.com$/.test(u.host)) antwort = { status: 200, contentType: 'image/png', headers: cors, body: KACHEL };
    await new Promise(r => setTimeout(r, warte));
    try { if (antwort) await route.fulfill(antwort); else await route.abort(); } catch (e) { /* Anfrage abgebrochen oder Seite zu */ }
  });
  const p = await ctx.newPage(), probleme = [], netz = { gesamt: 0, offen: 0, maxOffen: 0, abgebrochen: 0, fertig: 0 };
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') probleme.push('Konsole: ' + m.text()); });
  p.on('crash', () => probleme.push('Seite abgestürzt'));
  const dwdBild = r => /maps\.dwd\.de/.test(r.url()) && /GetMap/i.test(r.url());
  p.on('request', r => { if (dwdBild(r)) { netz.gesamt++; netz.offen++; netz.maxOffen = Math.max(netz.maxOffen, netz.offen); } });
  p.on('requestfinished', r => { if (dwdBild(r)) { netz.offen--; netz.fertig++; } });
  p.on('requestfailed', r => { if (dwdBild(r)) { netz.offen--; netz.abgebrochen++; } });
  return { ctx, p, probleme, netz };
}

// Was hängt gerade in der Karte? DWD-Ebenen in Leaflet, Kachelbilder (Radar/Satellit, ohne Grundkarte) und deren entpackte Pixel
const ZAEHLEN = () => {
  const box = document.querySelector('#karte'), mk = box && [box, ...box.querySelectorAll('*')].find(e => e._wkMap), map = mk && mk._wkMap;
  const ebenen = map ? Object.values(map._layers).filter(l => l._url && /maps\.dwd\.de/.test(l._url)).length : -1;
  const imgs = box ? [...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de|rainviewer|eumetsat/.test(i.src)) : [];
  // entpackte Pixel je fertigem Bild in der angeforderten Kachelgröße (DWD 512 × 512, die Testkachel ist kleiner)
  const px = imgs.reduce((s, i) => s + (i.complete && i.naturalWidth ? i.offsetWidth * i.offsetHeight || i.naturalWidth * i.naturalHeight : 0), 0);
  return { ebenen, bilder: imgs.length, megapixel: Math.round(px / 1e6 * 10) / 10 };
};
// Deckung mit fertigem, sichtbarem DWD-Bild (5 × 5 Punkte) – wie in radar-tempo.test.js
const DECKUNG = () => {
  const box = document.querySelector('#karte'), r = box.getBoundingClientRect();
  const sichtbar = i => { let e = i, o = 1; while (e && e !== box.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; o *= +cs.opacity; e = e.parentElement; } return o > 0.05; };
  const re = [...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de/.test(i.src) && i.complete && i.naturalWidth > 0 && sichtbar(i)).map(i => i.getBoundingClientRect());
  let t = 0;
  for (let a = 0; a < 5; a++) for (let c = 0; c < 5; c++) { const x = r.left + r.width * (a + 0.5) / 5, y = r.top + r.height * (c + 0.5) / 5; if (re.some(k => x >= k.left && x < k.right && y >= k.top && y < k.bottom)) t++; }
  return t / 25;
};
// Das gezeigte DWD-Bild gehört zum Zeitpunkt im Titel? (time-Parameter der sichtbaren Kacheln = Zeitpunkt des Reglers)
// Die App zeigt Uhrzeiten mit dem Versatz aus den Open-Meteo-Daten (Testdaten: utc_offset_seconds 7200), nicht mit der Zeitzone des Rechners
const VERSATZ = JSON.parse(OM).utc_offset_seconds || 0;
const PASST = (versatz) => {
  const box = document.querySelector('#karte');
  const zeiten = new Set([...box.querySelectorAll('img')].filter(i => /maps\.dwd\.de/.test(i.src) && i.complete && i.naturalWidth > 0)
    .filter(i => { let e = i, o = 1; while (e && e !== box) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return o > 0.05; })
    .map(i => new URL(i.src).searchParams.get('time') || new URL(i.src).searchParams.get('TIME')));
  // Uhrzeit des sichtbaren Bilds (mit dem Versatz der App) gegen die Uhrzeit, die der Regler ansagt (aria-valuetext „Mo. 23.11. 16:25, …“)
  const r = document.querySelector('#karte .wk-range'), reglerUhr = ((r.getAttribute('aria-valuetext') || '').match(/(\d\d:\d\d)/) || [])[1] || '';
  const bildUhr = zeiten.size === 1 ? new Date(Date.parse([...zeiten][0]) + (versatz || 0) * 1000).toISOString().slice(11, 16) : '';
  return { zeiten: [...zeiten], regler: +r.value, reglerUhr, bildUhr, stimmt: !!bildUhr && bildUhr === reglerUhr };
};

async function radarOeffnen(p) {
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 15000 });
  await p.click('[data-tab="radsat"]');
  await p.waitForFunction(() => { const r = document.querySelector('#karte .wk-range'); return r && +r.max > 20; }, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
}
// Wie ein schneller Finger: etwa alle 16 ms ein input-Ereignis, alle 1,4 s einmal über die ganze Leiste und zurück
async function schnellSchieben(p, ms, messen) {
  const werte = [];
  await p.evaluate(() => {
    const r = document.querySelector('#karte .wk-range'), max = +r.max, t0 = performance.now();
    window.__schieber = setInterval(() => {
      const ph = ((performance.now() - t0) % 1400) / 1400, v = Math.round((ph < 0.5 ? ph * 2 : 2 - ph * 2) * max);
      if (+r.value !== v) { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }
    }, 16);
  });
  const ende = Date.now() + ms;
  while (Date.now() < ende) { await p.waitForTimeout(500); werte.push(Object.assign(await p.evaluate(ZAEHLEN), messen())); }
  await p.evaluate(() => clearInterval(window.__schieber));
  return werte;
}
const max = (w, k) => Math.max(...w.map(x => x[k]));

(async () => {
  const s = await server();
  const b = await webkit.launch();
  const tabelle = [];
  try {
    for (const [id, bildMs] of [['DWD langsam (6 s je Bild)', 6000], ['DWD schnell (0,3 s je Bild)', 300]]) {
      console.log('\n== ' + id + ' ==');
      const { ctx, p, probleme, netz } = await neueSeite(b, bildMs);
      await radarOeffnen(p);
      const vorher = await p.evaluate(ZAEHLEN);
      const w = await schnellSchieben(p, 20000, () => ({ offen: netz.offen }));
      const n = Object.assign({}, netz);
      const verlauf = w.filter((x, i) => i % 8 === 7).map(x => x.ebenen + '/' + x.bilder).join(' ');
      console.log('  · Verlauf Ebenen/Bilder alle 4 s: ' + verlauf);
      pruefe('Schnelles Schieben: höchstens ' + GRENZE.ebenen + ' DWD-Ebenen in der Karte', max(w, 'ebenen') <= GRENZE.ebenen, { max: max(w, 'ebenen'), vorher: vorher.ebenen });
      pruefe('Schnelles Schieben: höchstens ' + GRENZE.bilder + ' Kachelbilder in der Karte', max(w, 'bilder') <= GRENZE.bilder, { max: max(w, 'bilder') });
      pruefe('Schnelles Schieben: höchstens ' + GRENZE.megapixel + ' Megapixel Kachelbilder', max(w, 'megapixel') <= GRENZE.megapixel, { max: max(w, 'megapixel') });
      pruefe('Schnelles Schieben: höchstens ' + GRENZE.offen + ' DWD-Anfragen gleichzeitig offen', n.maxOffen <= GRENZE.offen, { maxOffen: n.maxOffen, gesamt: n.gesamt, abgebrochen: n.abgebrochen, fertig: n.fertig });
      // Loslassen: der gezeigte Zeitpunkt bekommt sein Bild
      const t0 = Date.now();
      await p.evaluate(() => { const r = document.querySelector('#karte .wk-range'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
      let deck = 0; while (Date.now() - t0 < bildMs + 6000) { deck = await p.evaluate(DECKUNG); if (deck >= 0.99) break; await p.waitForTimeout(100); }
      const da = Date.now() - t0, passt = await p.evaluate(PASST, VERSATZ);
      pruefe('Nach dem Loslassen: Bild des gezeigten Zeitpunkts vollständig da (Bild-Uhrzeit = Regler-Uhrzeit)', deck >= 0.99 && passt.zeiten.length === 1 && passt.stimmt, { ms: da, deckung: deck, zeiten: passt.zeiten.length, bild: passt.bildUhr, regler: passt.reglerUhr });
      const nachher = await p.evaluate(ZAEHLEN);
      pruefe('Nach dem Loslassen: höchstens ' + GRENZE.ebenen + ' DWD-Ebenen', nachher.ebenen <= GRENZE.ebenen, nachher);
      pruefe('keine Fehler', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
      tabelle.push({ lage: id, maxEbenen: max(w, 'ebenen'), maxBilder: max(w, 'bilder'), maxMegapixel: max(w, 'megapixel'), anfragen: n.gesamt, maxOffen: n.maxOffen, abgebrochen: n.abgebrochen, loslassenMs: da });

      if (bildMs >= 1000) {
        // Gemächlich schieben (ein Schritt je 0,25 s): jeder Schritt beginnt zu laden und wird überholt – die alten Anfragen müssen weg
        const n0 = Object.assign({}, netz); netz.maxOffen = netz.offen;
        const m = [];
        for (let k = 0; k < 32; k++) {
          await p.evaluate(v => { const r = document.querySelector('#karte .wk-range'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, k % 2 ? 40 - k : k);
          await p.waitForTimeout(250);
          m.push(Object.assign(await p.evaluate(ZAEHLEN), { offen: netz.offen }));
        }
        pruefe('Gemächlich schieben (0,25 s je Schritt, DWD 6 s): höchstens ' + GRENZE.ebenen + ' DWD-Ebenen', max(m, 'ebenen') <= GRENZE.ebenen, { max: max(m, 'ebenen') });
        pruefe('Gemächlich schieben: höchstens ' + GRENZE.bilder + ' Kachelbilder und ' + GRENZE.megapixel + ' Megapixel', max(m, 'bilder') <= GRENZE.bilder && max(m, 'megapixel') <= GRENZE.megapixel, { bilder: max(m, 'bilder'), megapixel: max(m, 'megapixel') });
        // Nur gemessen: WebKit bricht ein Kachelbild nicht ab, wenn Leaflet die Ebene entfernt (Probe 18.11.: Server lieferte beide
        // Bilder nach src-Wechsel und Entfernen vollständig aus). Angefangene Anfragen laufen deshalb zu Ende, ihre Bilder werden verworfen.
        console.log('  · Messwert gemächlich schieben: ' + (netz.gesamt - n0.gesamt) + ' DWD-Anfragen, höchstens ' + netz.maxOffen + ' gleichzeitig offen (nur gemessen)');
        tabelle.push({ lage: id + ', 0,25 s je Schritt', maxEbenen: max(m, 'ebenen'), maxBilder: max(m, 'bilder'), maxMegapixel: max(m, 'megapixel'), anfragen: netz.gesamt - n0.gesamt, maxOffen: netz.maxOffen, abgebrochen: netz.abgebrochen - n0.abgebrochen });
      }
      if (bildMs < 1000) {
        // Langsam schieben (höchstens ein Schritt je 0,5 s): jeder Schritt zeigt sein DWD-Bild (Drosselung darf das nicht verhindern).
        // Bis 23.11. wurde genau 500 ms nach dem Schritt einmal nachgesehen – das wackelte (ca. 2 von 5 Läufen „5 von 6“). Messung
        // 23.11. (5 Läufe × 6 Schritte, Stand main): das Bild kam bei jedem Schritt, aber erst nach 489–717 ms (Median 525):
        // 150 ms Ruhe (REGLER_RUHE) + 300 ms DWD im Test + Abholen und Einblenden. Kein Bild wurde übersprungen, das Zeitfenster war zu knapp.
        // Jetzt: nach jedem Schritt bis zu 1,5 s auf das Bild warten (Zeit gemessen), nächster Schritt frühestens 0,5 s nach dem vorigen.
        const LANGSAM_GRENZE = 1000;
        let gesehen = 0; const ankunft = [], zeitenGesehen = new Set(), falsch = [];
        for (let k = 0; k < 6; k++) {
          const t0 = Date.now();
          await p.evaluate(v => { const r = document.querySelector('#karte .wk-range'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, 10 + k);
          let ms = null;
          while (Date.now() - t0 < 1500) {
            const pa = await p.evaluate(PASST, VERSATZ);
            if (pa.zeiten.length === 1 && !zeitenGesehen.has(pa.zeiten[0]) && await p.evaluate(DECKUNG) >= 0.99) {
              ms = Date.now() - t0; zeitenGesehen.add(pa.zeiten[0]);
              if (!pa.stimmt) falsch.push({ schritt: k, bild: pa.bildUhr, regler: pa.reglerUhr });   // neues, aber falsches Bild
              break;
            }
            await p.waitForTimeout(25);
          }
          ankunft.push(ms); if (ms != null) gesehen++;
          await p.waitForTimeout(Math.max(0, 500 - (Date.now() - t0)));
        }
        const spaetest = Math.max(...ankunft.map(x => x == null ? Infinity : x));
        // Takt: nächster Schritt, sobald das Bild da ist, frühestens 0,5 s nach dem vorigen (kein fester 0,5-s-Takt – bei festem Takt
        // überholt der nächste Schritt ein Bild, das erst nach 500 ms kommt; das ist gewollt seit der Absturz-Korrektur, Bericht 23.11.)
        pruefe('Langsames Schieben (Schritt frühestens alle 0,5 s, sobald das Bild da ist): jeder Schritt zeigt sein eigenes Bild, spätestens nach ' + LANGSAM_GRENZE + ' ms', gesehen === 6 && spaetest <= LANGSAM_GRENZE, { gesehen: gesehen + ' von 6', msBisBild: ankunft });
        pruefe('Langsames Schieben: das gezeigte Bild gehört zur Uhrzeit des Reglers', gesehen > 0 && falsch.length === 0, falsch.length ? falsch : { geprueft: gesehen });
        // Abspielen 16 s: Ebenen bleiben begrenzt
        await p.evaluate(() => { const r = document.querySelector('#karte .wk-range'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
        await p.waitForTimeout(800);
        await p.click('#karte .wk-play');
        const f = [];
        for (let k = 0; k < 32; k++) { await p.waitForTimeout(500); f.push(await p.evaluate(ZAEHLEN)); }
        const titel = await p.$eval('#karte .wk-range', r => +r.value);
        await p.click('#karte .wk-play');
        pruefe('Abspielen 16 s: höchstens ' + GRENZE.ebenen + ' DWD-Ebenen', max(f, 'ebenen') <= GRENZE.ebenen, { max: max(f, 'ebenen'), reglerAmEnde: titel });
        pruefe('Abspielen: Film läuft (Regler bewegt sich)', titel > 0, { regler: titel });
        pruefe('keine Fehler nach Abspielen', probleme.length === 0, probleme.length ? probleme.slice(0, 3) : undefined);
      }
      await ctx.close();
    }
  } catch (e) { fehler++; console.log('  ✗ Testlauf abgebrochen: ' + (e && e.stack || e)); }
  await b.close(); s.close();
  console.log('\nMesswerte:'); console.table(tabelle);
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden' + (fehler ? ', ' + fehler + ' fehlgeschlagen' : ''));
  process.exit(fehler ? 1 : 0);
})();
