/* tests/verkleinern.test.js – „Fertig“ bleibt im Reiter (F1, P-cff6); 11.11.2026
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8897 node tests/verkleinern.test.js
   Prüft in WebKit bei 402 × 874 (hell und dunkel), 375 × 667 und 320 × 568: Schalter „immer im Vollbild“ an: „Fertig“, Esc und Zurück schließen das Blatt, die App bleibt im Reiter Graphs bzw. Rad/Sat
      und zeigt die kleine Ansicht; erst der nächste Besuch des Reiters öffnet wieder das Blatt.
   Ohne Netz wie tests/vollbild.test.js; die Uhr steht auf dem 22.10.2026 mittags, damit „jetzt“ in den Testdaten liegt.
   Bilder landen in BILDER (Standard /tmp/wedderleuchte-tests/), ihr Name beginnt mit BILDNAME (z. B. „vorher-“). Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8897;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/wedderleuchte-tests';
const BILDNAME = process.env.BILDNAME || '';
const OM = fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8');
const VORSATZ = 'wedder-';   // Speicher-Schlüssel der App
const UHR = '2026-10-22T10:00:00Z';
const GROESSEN = [[402, 874, 'light'], [402, 874, 'dark'], [375, 667, 'light'], [320, 568, 'light']];
fs.mkdirSync(BILDER, { recursive: true });

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
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

async function neueSeite(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.breite || 402, height: o.hoehe || 874 }, deviceScaleFactor: 2, colorScheme: o.farbe || 'light', serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await ctx.clock.setFixedTime(new Date(UHR));
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url());
    if (u.host === 'api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: OM });
    return route.abort();
  });
  if (o.speicher) await ctx.addInitScript(s => { Object.keys(s).forEach(k => { if (localStorage.getItem(k) === null) localStorage.setItem(k, s[k]); }); }, o.speicher);
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|access control|net::|Load failed/i.test(m.text())) probleme.push('Konsole: ' + m.text()); });
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 10000 });
  if (o.schrift) await p.evaluate(() => { document.documentElement.style.fontSize = '130%'; window.dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(400);
  return { ctx, p, probleme };
}
const foto = (p, name) => p.screenshot({ path: path.join(BILDER, BILDNAME + name + '.png') });
const kuerzel = g => g[0] + '-' + (g[2] === 'dark' ? 'dunkel' : 'hell');

const reiter = p => p.evaluate(() => ['wetter', 'graphs', 'radsat', 'mehr'].filter(t => !document.getElementById('tab-' + t).hidden)[0]);
const blatt = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight && !!document.querySelector('#leiste').closest('[inert]'); }, sel);
// Kleine Ansicht: welcher Reiter steht, liegt ein Blatt darüber, ist die Seite frei, ist ⤢ da und hat den Fokus
const KLEIN = (a) => {
  const w = document.querySelector(a.sel), r = w ? w.getBoundingClientRect() : null, leiste = document.querySelector('#leiste');
  const voll = w && w.querySelector(a.voll), vr = voll && voll.getBoundingClientRect(), markiert = leiste.querySelector('[aria-current="page"]');
  return {
    reiter: ['wetter', 'graphs', 'radsat', 'mehr'].filter(t => !document.getElementById('tab-' + t).hidden)[0],
    blatt: !!w && (w.classList.contains('mg-vollbild') || w.classList.contains('wk-vollbild')),
    breite: r ? Math.round(r.width) : 0, bild: innerWidth, inhalt: !!w && !!w.querySelector(a.inhalt),
    gesperrt: ['#leiste', '#inhalt', '#kopf'].filter(s => document.querySelector(s).closest('[inert]')),
    markiert: markiert ? markiert.getAttribute('data-tab') : null,
    vollKnopf: !!vr && vr.width > 0 && vr.height > 0, fokusAufVoll: !!voll && document.activeElement === voll,
    zustand: (history.state && history.state.wpVollbild) || null
  };
};
const istKlein = (k, name) => k.reiter === name && !k.blatt && k.breite > 0 && k.breite < k.bild && k.inhalt && !k.gesperrt.length && k.markiert === name && k.vollKnopf && !k.zustand;
const G = { sel: '#graphs', voll: '.mg-btn-voll', inhalt: '.mg-svg text' }, K = { sel: '#karte', voll: '.wk-voll', inhalt: '.leaflet-container' };
// Blatt öffnen: steht die App nicht (mehr) im Reiter, führt der Tipp auf den Reiter hin; in der kleinen Ansicht öffnet ⤢
async function blattAuf(p, name, a) {
  if (await reiter(p) !== name) { await p.click('#leiste [data-tab="' + name + '"]'); await p.waitForTimeout(900); }
  if (!(await blatt(p, a.sel))) { await p.click(a.sel + ' ' + a.voll); await p.waitForTimeout(500); }
  return blatt(p, a.sel);
}

// 1) F1: ganz = alle Wege (Fertig, Esc, Zurück, Umschalter, nächster Besuch, Neustart); sonst nur „Fertig“ in beiden Reitern
async function f1(b, g, ganz) {
  const kz = kuerzel(g);
  const s = await neueSeite(b, { breite: g[0], hoehe: g[1], farbe: g[2], speicher: { [VORSATZ + 'vollbild-immer']: 'true', [VORSATZ + 'radsat-modus']: '"radsat"' } }), p = s.p;
  await p.click('#leiste [data-tab="graphs"]'); await p.waitForSelector('#graphs .mg-svg text', { timeout: 10000 }); await p.waitForTimeout(700);
  pruefe(kz + ': Tipp auf Graphs öffnet das Meteogramm als Blatt (Schalter an)', await blatt(p, '#graphs'));
  await foto(p, 'f1-graphs-1-blatt-' + kz);
  await p.click('#graphs .mg-vb-fertig'); await p.waitForTimeout(600);
  let k = await p.evaluate(KLEIN, G);
  pruefe(kz + ': „Fertig“ bleibt im Reiter Graphs und zeigt das kleine Meteogramm, Seite frei', istKlein(k, 'graphs'), k);
  pruefe(kz + ': Fokus liegt danach auf ⤢ im kleinen Meteogramm', k.fokusAufVoll, k);
  await foto(p, 'f1-graphs-2-nach-fertig-' + kz);
  if (ganz) {
    await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(600);
    k = await p.evaluate(KLEIN, G);
    pruefe(kz + ': Tipp auf den schon offenen Reiter Graphs lässt die kleine Ansicht stehen', istKlein(k, 'graphs'), k);
    pruefe(kz + ': ⤢ in der kleinen Ansicht öffnet das Blatt wieder', await blattAuf(p, 'graphs', G));
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    k = await p.evaluate(KLEIN, G);
    pruefe(kz + ': Esc bleibt im Reiter Graphs (kleine Ansicht)', istKlein(k, 'graphs'), k);
    await blattAuf(p, 'graphs', G);
    await p.evaluate(() => history.back()); await p.waitForTimeout(600);
    k = await p.evaluate(KLEIN, G);
    pruefe(kz + ': Zurück bleibt im Reiter Graphs (kleine Ansicht)', istKlein(k, 'graphs'), k);
    await p.click('#leiste [data-tab="wetter"]'); await p.waitForTimeout(300);
    await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(800);
    pruefe(kz + ': der nächste Besuch von Graphs öffnet wieder das Blatt', await reiter(p) === 'graphs' && await blatt(p, '#graphs'));
    if (await blatt(p, '#graphs')) { await p.click('#graphs .mg-vb-fertig'); await p.waitForTimeout(500); }
  }
  await p.click('#leiste [data-tab="radsat"]'); await p.waitForSelector('#karte.wk .leaflet-container', { timeout: 10000 }); await p.waitForTimeout(900);
  pruefe(kz + ': Tipp auf Rad/Sat öffnet die Karte als Blatt (Schalter an)', await blatt(p, '#karte'));
  await foto(p, 'f1-radsat-1-blatt-' + kz);
  await p.click('#karte .wk-vb-fertig'); await p.waitForTimeout(700);
  k = await p.evaluate(KLEIN, K);
  pruefe(kz + ': „Fertig“ bleibt im Reiter Rad/Sat und zeigt die kleine Karte, Seite frei', istKlein(k, 'radsat'), k);
  await foto(p, 'f1-radsat-2-nach-fertig-' + kz);
  if (ganz) {
    if (await reiter(p) === 'radsat') { await p.click('#karte-zeile [data-modus="karten"]'); await p.waitForSelector('#karte.wk .leaflet-container', { timeout: 10000 }); await p.waitForTimeout(900); }
    k = await p.evaluate(KLEIN, K);
    pruefe(kz + ': „Karten“ in der kleinen Ansicht wechselt die Karte, ohne das Blatt wieder zu öffnen', istKlein(k, 'radsat') && await p.evaluate(() => document.querySelector('#karte-zeile [data-modus="karten"]').getAttribute('aria-checked')) === 'true', k);
    pruefe(kz + ': ⤢ in der kleinen Karte öffnet das Blatt wieder', await blattAuf(p, 'radsat', K));
    await p.click('#karte [data-wechsel="radsat"]'); await p.waitForTimeout(900);
    pruefe(kz + ': Umschalter im Blatt bleibt im Blatt', await blatt(p, '#karte'));
    await p.evaluate(() => history.back()); await p.waitForTimeout(700);
    k = await p.evaluate(KLEIN, K);
    pruefe(kz + ': Zurück nach dem Umschalten bleibt im Reiter Rad/Sat (kleine Ansicht)', istKlein(k, 'radsat'), k);
    await blattAuf(p, 'radsat', K);
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    k = await p.evaluate(KLEIN, K);
    pruefe(kz + ': Esc bleibt im Reiter Rad/Sat (kleine Ansicht)', istKlein(k, 'radsat'), k);
    await p.click('#leiste [data-tab="mehr"]'); await p.waitForTimeout(300);
    await p.click('#leiste [data-tab="radsat"]'); await p.waitForTimeout(1000);
    pruefe(kz + ': der nächste Besuch von Rad/Sat öffnet wieder das Blatt', await reiter(p) === 'radsat' && await blatt(p, '#karte'));
    await p.reload(); await p.waitForSelector('.aktuell-kachel', { timeout: 10000 }); await p.waitForTimeout(400);
    await p.click('#leiste [data-tab="graphs"]'); await p.waitForSelector('#graphs .mg-svg text', { timeout: 10000 }); await p.waitForTimeout(700);
    pruefe(kz + ': nach einem Neustart öffnet Graphs wieder als Blatt', await blatt(p, '#graphs'));
    await p.click('#graphs .mg-vb-fertig'); await p.waitForTimeout(600);
    k = await p.evaluate(KLEIN, G);
    pruefe(kz + ': „Fertig“ nach dem Neustart bleibt in Graphs', istKlein(k, 'graphs'), k);
  }
  pruefe(kz + ': keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
  await s.ctx.close();
}

(async () => {
  const srv = await server();
  const b = await webkit.launch();
  try {
    console.log('1) „Fertig“, Esc und Zurück bleiben im Reiter (F1)');
    for (const g of GROESSEN) await f1(b, g, g === GROESSEN[0]);
  } finally { await b.close(); srv.close(); }
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
