/* tests/durchgang.test.js – Funde aus dem Nutzer-Durchgang vom 21.10.2026 (DURCHGANG-2026-10-21.md)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8962 node tests/durchgang.test.js
   Prüft in WebKit: Kontrast des Chips „Karte öffnen“ auf dem Himmel-Verlauf, sichtbarer Fokusring auf den Glas-Kacheln, Fokus nach dem Ortswechsel.
   Ohne Netz: Open-Meteo antwortet mit tests/fixtures/open-meteo-mannheim.json (Wetterlage über current.weather_code), Suche mit einer Attrappe. Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8895;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const OM = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8'));
const GEO = { results: [{ id: 2907911, name: 'Heidelberg', latitude: 49.40768, longitude: 8.69079, admin1: 'Baden-Württemberg', country: 'Deutschland' }] };

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

// Wetterlage der Attrappe: Wettercode, Tag/Nacht, Uhrzeit, Regenmenge (Regen und Schnee zählen nur mit Menge)
function wetterBody(w) {
  const d = JSON.parse(JSON.stringify(OM));
  Object.assign(d.current, w || {});
  return JSON.stringify(d);
}
async function neueSeite(b, w, farbe, breite) {
  const ctx = await b.newContext({ viewport: { width: breite || 390, height: 844 }, colorScheme: farbe || 'light', serviceWorkers: 'block' });
  const body = wetterBody(w);
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url());
    if (u.host === 'api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body });
    if (u.host === 'geocoding-api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(GEO) });
    return route.abort();
  });
  const p = await ctx.newPage();
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p };
}

// Kontrast von Text (Farbe des Elements) bzw. Fokusring gegen den Hintergrund hinter dem Element, gemessen im Bildschirmfoto.
// Elementtext und Ring werden dafür unsichtbar gemacht; schlechtester Wert (10-%-Quantil) über die Fläche des Elements.
// farbe: 'text' = color des Elements, 'ring' = outline-color
async function kontrastAuf(p, selektor, art, fokusSel) {
  await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), selektor);
  await p.waitForTimeout(300);
  if (art === 'ring' && fokusSel) await p.focus(fokusSel);   // Suchfeld: Ring über :focus-within
  else if (art === 'ring') await p.focus(selektor), await p.keyboard.press('Alt+Tab'), await p.keyboard.press('Alt+Shift+Tab');
  const info = await p.evaluate(([s, art]) => {
    const e = document.querySelector(s), cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const o = 2 + 2;   // Ring: Breite 2 px plus Abstand 2 px
    return { farbe: art === 'ring' ? cs.outlineColor : cs.color, x: r.left - (art === 'ring' ? o : 0), y: r.top - (art === 'ring' ? o : 0), w: r.width + (art === 'ring' ? 2 * o : 0), h: r.height + (art === 'ring' ? 2 * o : 0), ring: art === 'ring' ? cs.outlineStyle : 'text' };
  }, [selektor, art]);
  const stil = await p.addStyleTag({ content: '* { transition: none !important; animation: none !important; color: transparent !important; -webkit-text-fill-color: transparent !important; outline-color: transparent !important; } svg { color: transparent !important; }' });
  await p.waitForTimeout(150);
  if (process.env.DEBUG_RING) console.log(JSON.stringify(info));
  const png = (await p.screenshot()).toString('base64');
  const wert = await p.evaluate(async ([png, info]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const lum = (r, gg, b) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
    const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(info.farbe), a = m[4] === undefined ? 1 : +m[4];
    const d = g.getImageData(Math.max(0, Math.floor(info.x)), Math.max(0, Math.floor(info.y)), Math.ceil(info.w), Math.ceil(info.h)).data, l = [];
    const bx = Math.max(0, Math.floor(info.x)), by = Math.max(0, Math.floor(info.y)), bw = Math.ceil(info.w), bh = Math.ceil(info.h);
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % bw, py = Math.floor(i / 4 / bw);
      if (info.ring === 'solid' && px >= 3 && py >= 3 && px < bw - 3 && py < bh - 3) continue;   // nur der Streifen, auf dem der Ring liegt
      const fg = [0, 1, 2].map(k => +m[k + 1] * a + d[i + k] * (1 - a)), l1 = lum(...fg), l2 = lum(d[i], d[i + 1], d[i + 2]);
      l.push((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05));
    }
    l.sort((x, y) => x - y); return +l[Math.floor(l.length * .1)].toFixed(2);
  }, [png, info]);
  await stil.evaluate(e => e.remove());
  return { wert, ring: info.ring };
}

// Alle Texte im Meteogramm: gezeichnete Größe = font-size × Skalierung des SVG
const GROESSEN_JS = () => {
  const aus = [];
  document.querySelectorAll('#graphs text, #graphs small, #graphs span, #graphs div, #graphs button, #graphs b, #graphs label, #graphs p').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    let px = parseFloat(getComputedStyle(e).fontSize);
    if (e instanceof SVGElement) { const m = e.getScreenCTM(); px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
    aus.push({ t: e.textContent.trim().slice(0, 16), cls: e.getAttribute('class') || e.tagName, px: Math.round(px * 100) / 100 });
  });
  return aus;
};
// Textproben (bis zu 3 je Klasse, nur sichtbar und nicht verdeckt): Ort und Schriftfarbe
const PROBEN_JS = () => {
  const je = {}, aus = [];
  document.querySelectorAll('#graphs text, #graphs small, #graphs span, #graphs div, #graphs button, #graphs b, #graphs label, #graphs p').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = e.getBoundingClientRect(), cls = e.getAttribute('class') || e.tagName;
    if (r.width < 4 || r.height < 4 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return;
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!oben || !(e === oben || e.contains(oben) || oben.contains(e))) return;
    if ((je[cls] = (je[cls] || 0) + 1) > 3) return;
    const cs = getComputedStyle(e);
    aus.push({ t: e.textContent.trim().slice(0, 16), cls, x: r.left, y: r.top, w: r.width, h: r.height, fill: e instanceof SVGElement ? cs.fill : cs.color });
  });
  return aus;
};
// Kontrast Schriftfarbe gegen den häufigsten Pixel hinter dem Text (der echte Untergrund)
const PIXEL_JS = async ({ png, fill }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, zaehler = {};
  for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; zaehler[k] = (zaehler[k] || 0) + 1; }
  const grund = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const m = (fill.match(/[\d.]+/g) || [0, 0, 0]).map(Number), vorn = /^color\(/.test(fill) ? m.slice(0, 3).map(v => v * 255) : m.slice(0, 3), al = m.length > 3 ? m[3] : 1;
  const mix = vorn.map((v, i) => v * al + grund[i] * (1 - al));
  const L = q => { const [r, gg, b] = q.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
  const x = L(mix), y = L(grund);
  return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100;
};

const LAGEN = {
  heiter: { weather_code: 0, is_day: 1, time: '2026-10-20T12:00' },
  bewoelkt: { weather_code: 3, is_day: 1, time: '2026-10-20T12:00' },
  nebel: { weather_code: 45, is_day: 1, time: '2026-10-20T09:00' },
  schnee: { weather_code: 73, is_day: 1, time: '2026-10-20T14:00', precipitation: 1.5 },
  regen: { weather_code: 63, is_day: 1, time: '2026-10-20T12:00', precipitation: 2.1 },
  nacht: { weather_code: 1, is_day: 0, time: '2026-10-20T23:00' }
};

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    console.log('1) Kontrast „Karte öffnen“ (Chip) auf dem Himmel-Verlauf, mindestens 4,5:1');
    for (const [name, w] of Object.entries(LAGEN)) {
      const { ctx, p } = await neueSeite(b, w);
      const k = await kontrastAuf(p, '#radarAuf', 'text');
      pruefe('Chip „Karte öffnen“, Lage ' + name + ': ' + k.wert + ':1', k.wert >= 4.5, k.wert);
      await ctx.close();
    }
    console.log('2) Fokusring auf den Glas-Kacheln mindestens 3:1 sichtbar');
    for (const [name, w] of [['heiter', LAGEN.heiter], ['nacht', LAGEN.nacht]]) {
      for (const sel of ['#radarAuf', '#aktWechsel']) {
        const { ctx, p } = await neueSeite(b, w);
        const k = await kontrastAuf(p, sel, 'ring');
        pruefe('Fokusring ' + sel + ', Lage ' + name + ': ' + k.wert + ':1', k.ring === 'solid' && k.wert >= 3, k);
        await ctx.close();
      }
    }
    console.log('3a) Fokusring im Suchfeld, in Kopf und Tab-Leiste mindestens 3:1');
    for (const [name, w, farbe] of [['heiter hell', LAGEN.heiter, 'light'], ['nacht hell', LAGEN.nacht, 'light'], ['heiter dunkel', LAGEN.heiter, 'dark']]) {
      const { ctx, p } = await neueSeite(b, w, farbe);
      for (const sel of ['#kopfSuche', '[data-tab="graphs"]', '[data-tab="kamera"]']) {
        const k = await kontrastAuf(p, sel, 'ring');
        pruefe('Fokusring ' + sel + ', ' + name + ': ' + k.wert + ':1', k.ring === 'solid' && k.wert >= 3, k);
      }
      await p.click('[data-tab="mehr"]'); await p.waitForTimeout(300);
      const k = await kontrastAuf(p, '.suchfeld', 'ring', '#suchfeld');
      pruefe('Fokusring Suchfeld, ' + name + ': ' + k.wert + ':1', k.ring === 'solid' && k.wert >= 3, k);
      await ctx.close();
    }
    console.log('3b) Rad/Sat: Zeit-Regler mindestens 44 px, Kartentitel mindestens 12 px');
    {
      const { ctx, p } = await neueSeite(b, LAGEN.heiter);
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(1500);
      const m = await p.evaluate(() => { const r = document.querySelector('#karte .wk-range'), t = document.querySelector('#karte .wk-titel'), d = document.querySelector('#karte .wk-tage'); return { regler: r && Math.round(r.getBoundingClientRect().height), titel: t && Math.min(parseFloat(getComputedStyle(t).fontSize), parseFloat(getComputedStyle(d).fontSize)) }; });
      pruefe('Zeit-Regler der Karte mindestens 44 px hoch', m.regler >= 44, m);
      pruefe('Kartentitel und Tagesnamen unter dem Regler mindestens 12 px', m.titel >= 12, m);
      await ctx.close();
    }
    console.log('3) Fokus nach dem Ortswechsel');
    {
      const { ctx, p } = await neueSeite(b, LAGEN.heiter);
      await p.click('[data-tab="mehr"]'); await p.waitForTimeout(300);
      await p.fill('#suchfeld', 'Heidelberg'); await p.waitForTimeout(900);
      await p.click('[data-treffer="0"]'); await p.waitForTimeout(1200);
      const f = await p.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName, kopf: document.getElementById('kopfTitel').textContent }));
      pruefe('Nach dem Ortswechsel liegt der Fokus auf dem Ortsnamen im Kopf, nicht auf dem Seitenkörper', f.kopf === 'Heidelberg' && f.id === 'kopfTitel', f);
      await ctx.close();
    }
    console.log('4) Meteogramm: jeder Text mindestens 11 px gezeichnet und Kontrast mindestens 4,5:1');
    for (const farbe of ['light', 'dark']) for (const breite of [390, 1280]) for (const voll of [false, true]) {
      const { ctx, p } = await neueSeite(b, LAGEN.heiter, farbe, breite);
      await p.click('#leiste [data-tab="graphs"]');
      await p.waitForSelector('#graphs .mg-svg .mg-sonne', { timeout: 10000 });
      if (voll) await p.click('#graphs .mg-btn-voll');
      await p.waitForTimeout(700);
      await p.evaluate(() => { const w = document.querySelector('#graphs .mg-ax-wert'); if (w) w.hidden = false; });   // die Marke zeigt sich sonst nur beim Antippen
      const l = await p.evaluate(GROESSEN_JS), name = farbe + ' ' + breite + (voll ? ' Vollbild' : '');
      const klein = l.filter(x => x.px < 10.95);
      pruefe(name + ': ' + l.length + ' Texte, keiner unter 11 px gezeichnet', l.length > 20 && !klein.length, klein.slice(0, 6));
      if (breite === 390) {
        const schwach = [], proben = await p.evaluate(PROBEN_JS);
        for (const q of proben) {
          const png = (await p.screenshot({ clip: { x: q.x, y: q.y, width: q.w, height: q.h } })).toString('base64');
          const k = await p.evaluate(PIXEL_JS, { png, fill: q.fill });
          if (k < 4.5) schwach.push({ t: q.t, cls: q.cls, k });
        }
        pruefe(name + ': ' + proben.length + ' Proben (je Klasse bis 3), Kontrast gegen den echten Untergrund mindestens 4,5:1', proben.length > 8 && !schwach.length, schwach.slice(0, 8));
      }
      await ctx.close();
    }
  } finally {
    await b.close(); s.close();
  }
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden' + (fehler ? ', ' + fehler + ' Fehler' : ''));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
