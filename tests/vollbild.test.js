/* tests/vollbild.test.js – Vollbild für Meteogramm und Karten (A32, 21.10.2026)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=8894 node tests/vollbild.test.js
           (Playwright z. B. aus „Wetter Apps/WetterPro Camera App/node_modules“)
   Prüft in WebKit: ⤢ legt Meteogramm bzw. Karte als Blatt über den ganzen Bildschirm, „Fertig“, Esc und Zurück schließen,
   der Rest der Seite ist solange gesperrt. Ohne Netz: Open-Meteo antwortet mit tests/fixtures/open-meteo-mannheim.json.
   Bildschirmfotos landen in BILDER (Standard /tmp/wedderleuchte-tests/). Exit-Code 0 = alles grün. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8894;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/wedderleuchte-tests';
const OM = fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8');
const VORSATZ = 'wedder-';   // Speicher-Schlüssel der App
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
  const ctx = await b.newContext({ viewport: { width: o.breite || 390, height: o.hoehe || 844 }, colorScheme: o.farbe || 'light', reducedMotion: o.bewegung || 'no-preference', serviceWorkers: 'block' });
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
const foto = (p, name) => p.screenshot({ path: path.join(BILDER, name + '.png') });

// Zustand des Blatts: Größe, wer oben liegt, Sperre, Fokus, Fertig-Knopf
const ZUSTAND = (a) => {
  const w = document.querySelector(a.sel), r = w.getBoundingClientRect();
  const fertig = w.querySelector(a.fertig), fr = fertig && fertig.getBoundingClientRect();
  const oben = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && w.contains(e); };
  return {
    r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight,
    deckt: oben(8, 8) && oben(innerWidth - 8, innerHeight - 8) && oben(8, innerHeight - 8) && oben(innerWidth / 2, innerHeight / 2),
    rolle: w.getAttribute('role'), modal: w.getAttribute('aria-modal'), label: w.getAttribute('aria-label'),
    fertig: fertig && !fertig.closest('[hidden]') && fr.width > 0 ? { t: fertig.textContent.trim(), w: Math.round(fr.width), h: Math.round(fr.height), top: Math.round(fr.top), right: Math.round(innerWidth - fr.right) } : null,
    fokus: document.activeElement === fertig ? 'fertig' : (document.activeElement && (document.activeElement.className || document.activeElement.tagName)),
    gesperrt: [...document.body.children].filter(e => e !== w && !e.contains(w) && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName) && !e.hasAttribute('inert') && !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.id || e.className),
    leisteInert: !!document.querySelector('#leiste').closest('[inert]'),
    overflow: getComputedStyle(document.documentElement).overflow,
    zustand: history.state, laenge: history.length
  };
};
const voll = z => Math.abs(z.r[0]) <= 1 && Math.abs(z.r[1]) <= 1 && Math.abs(z.r[2] - z.vw) <= 1 && Math.abs(z.r[3] - z.vh) <= 1;
// Tippflächen und Schrift im Blatt: alle sichtbaren Knöpfe ≥ 44 px (ohne Leaflet-Innereien), kein Text unter 11 px
const MASSE_BLATT = (sel) => {
  const w = document.querySelector(sel), klein = [], schrift = [];
  w.querySelectorAll('button, a, label, input, [role="button"]').forEach(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!r.width || !r.height || s.visibility === 'hidden' || e.closest('[hidden]') || e.closest('.leaflet-container') || (e.tagName === 'INPUT' && (e.closest('label') || e.type === 'range'))) return;
    if (r.width < 43.5 || r.height < 43.5) klein.push((e.getAttribute('aria-label') || e.textContent.trim() || e.className).slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  w.querySelectorAll('*').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || e.closest('[hidden]') || e.closest('svg') || getComputedStyle(e).visibility === 'hidden') return;
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11) schrift.push(e.className + ' ' + getComputedStyle(e).fontSize);
  });
  return { klein, schrift, seitlich: w.scrollWidth - w.clientWidth };
};
// Kontrast Text zu Hintergrund (erster nicht durchsichtiger Hintergrund nach oben)
const KONTRAST = (sel) => {
  const e = document.querySelector(sel); if (!e) return 0;
  const farbe = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  let g = e, bg = 'rgba(0, 0, 0, 0)';
  while (g && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(g).backgroundColor; g = g.parentElement; }
  const L = c => { const [r, gg, b] = farbe(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
  const a = L(getComputedStyle(e).color), b2 = L(bg);
  return Math.round((Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05) * 100) / 100;
};

// Ein Blatt öffnen, prüfen, mit Fertig, Esc und Zurück schließen
async function blattPruefen(s, a) {
  const p = s.p, name = a.name, zs = { sel: a.sel, fertig: a.fertig };
  const vorher = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': vor dem Öffnen kein Blatt', !voll(vorher), vorher.r);
  await p.click(a.sel + ' ' + a.knopf); await p.waitForTimeout(500);
  const z = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': ⤢ legt ' + a.was + ' über den ganzen Bildschirm (' + z.vw + ' × ' + z.vh + ')', voll(z), [z.r, z.vw, z.vh]);
  pruefe(name + ': das Blatt liegt oben, auch über Kopf und Tab-Leiste', z.deckt);
  pruefe(name + ': role="dialog", aria-modal, Name „' + a.label + '“', z.rolle === 'dialog' && z.modal === 'true' && z.label === a.label, [z.rolle, z.modal, z.label]);
  pruefe(name + ': „Fertig“ oben rechts, mind. 44 × 44 px, Text', !!z.fertig && z.fertig.t === 'Fertig' && z.fertig.w >= 44 && z.fertig.h >= 44 && z.fertig.top < 60 && z.fertig.right < 40, z.fertig);
  pruefe(name + ': Fokus steht auf „Fertig“', z.fokus === 'fertig', z.fokus);
  if (!z.fertig) { await foto(p, 'vollbild-' + name + '-ohne-fertig'); return; }   // ohne Blatt-Kopf lässt sich der Rest nicht prüfen
  pruefe(name + ': Rest der Seite gesperrt (inert), Seite scrollt nicht mit', z.gesperrt.length === 0 && z.leisteInert && z.overflow === 'hidden', [z.gesperrt, z.leisteInert, z.overflow]);
  pruefe(name + ': ein Verlaufseintrag für die Zurück-Geste', !!z.zustand && z.zustand.wpVollbild === a.marke && z.laenge === vorher.laenge + 1, [vorher.laenge, z.laenge, z.zustand]);
  const m = await p.evaluate(MASSE_BLATT, a.sel);
  pruefe(name + ': im Blatt alle Knöpfe ≥ 44 px, kein Text unter 11 px, nichts ragt seitlich heraus', !m.klein.length && !m.schrift.length && m.seitlich <= 0, m);
  const k = await p.evaluate(KONTRAST, a.sel + ' ' + a.fertig);
  pruefe(name + ': Kontrast „Fertig“ mind. 4,5:1', k >= 4.5, k);
  if (a.extra) await a.extra(p, name);
  await foto(p, 'vollbild-' + name + '-offen');
  await p.click(a.sel + ' ' + a.fertig); await p.waitForTimeout(400);
  const zu = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': „Fertig“ schließt, Fokus wieder auf ⤢, Sperre aufgehoben', !voll(zu) && zu.fokus && zu.fokus.indexOf(a.knopfKlasse) >= 0 && !zu.leisteInert && zu.overflow !== 'hidden', [zu.r, zu.fokus, zu.leisteInert, zu.overflow]);
  pruefe(name + ': nach „Fertig“ steht der Verlauf wieder vor dem Blatt', !(zu.zustand && zu.zustand.wpVollbild), zu.zustand);
  await foto(p, 'vollbild-' + name + '-zu');
  await p.click(a.sel + ' ' + a.knopf); await p.waitForTimeout(300);
  const z2 = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': zweites Öffnen: Verlauf wächst nicht weiter', z2.laenge === z.laenge, [z.laenge, z2.laenge]);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const z3 = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': Esc schließt das Blatt', voll(z2) && !voll(z3) && !z3.leisteInert, [z2.r, z3.r]);
  await p.click(a.sel + ' ' + a.knopf); await p.waitForTimeout(300);
  await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  const z4 = await p.evaluate(ZUSTAND, zs);
  pruefe(name + ': Zurück schließt das Blatt, der Reiter bleibt', !voll(z4) && !z4.leisteInert && await p.evaluate(t => !document.getElementById('tab-' + t).hidden, a.reiter), z4.r);
}

// Meteogramm: haftende Fahne unter „Fertig“, Knopfleiste unten
const MG = {
  sel: '#graphs', knopf: '.mg-btn-voll', knopfKlasse: 'mg-btn-voll', fertig: '.mg-vb-fertig', marke: 'mg', label: 'Meteogramm im Vollbild', was: 'das Meteogramm', reiter: 'graphs',
  extra: async (p, name) => {
    // Haftende Leisten: oben im Blatt ist die Knopfleiste schon unten im Bild; ganz unten haftet die Datumsfahne unter „Fertig“
    const haft = await p.evaluate((sel) => new Promise(ok => {
      const w = document.querySelector(sel), m = () => { const k = w.querySelector('.mg-vb-kopf').getBoundingClientRect(), f = w.querySelector('.mg-readout').getBoundingClientRect(), l = w.querySelector('.mg-knoepfe').getBoundingClientRect(); return { scroll: w.scrollTop, kopfUnten: Math.round(k.bottom), fahneOben: Math.round(f.top), leisteUnten: Math.round(l.bottom) }; };
      w.scrollTop = 0;
      setTimeout(() => { const a = m(); w.scrollTop = w.scrollHeight; setTimeout(() => ok({ oben: a, unten: m(), vh: innerHeight }), 250); }, 250);
    }), '#graphs');
    pruefe(name + ': Knopfleiste oben im Blatt sichtbar, Datumsfahne haftet beim Scrollen unter „Fertig“', haft.oben.leisteUnten <= haft.vh && haft.oben.fahneOben >= haft.oben.kopfUnten - 1 && (haft.unten.scroll === 0 || Math.abs(haft.unten.fahneOben - haft.unten.kopfUnten) <= 2), haft);
    await p.evaluate((sel) => { document.querySelector(sel).scrollTop = 0; }, '#graphs');
  }
};
async function zuGraphs(p) { await p.click('#leiste [data-tab="graphs"]'); await p.waitForSelector('#graphs .mg-svg text', { timeout: 10000 }); await p.waitForTimeout(400); }

(async () => {
  const srv = await server();
  const b = await webkit.launch();
  try {
    console.log('1) Meteogramm im Vollbild: 390 hell und dunkel, 130 % Schrift, quer 844 × 390, iPad/Mac 1280 × 800');
    for (const o of [{ name: 'mg-390-hell' }, { name: 'mg-390-dunkel', farbe: 'dark' }, { name: 'mg-390-130', schrift: true }, { name: 'mg-844-quer', breite: 844, hoehe: 390 }, { name: 'mg-1280', breite: 1280, hoehe: 800 }]) {
      const s = await neueSeite(b, o);
      await zuGraphs(s.p);
      await blattPruefen(s, Object.assign({}, MG, { name: o.name }));
      pruefe(o.name + ': keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
      await s.ctx.close();
    }
    console.log('2) Reduzierte Bewegung');
    {
      const s = await neueSeite(b, { bewegung: 'reduce' });
      await zuGraphs(s.p);
      await s.p.click('#graphs .mg-btn-voll');
      const a = await s.p.evaluate(() => { const st = getComputedStyle(document.getElementById('graphs')); return { name: st.animationName, dauer: st.animationDuration }; });
      pruefe('prefers-reduced-motion: Meteogramm-Blatt ohne Wachs-Animation', a.name === 'none' || a.dauer === '0s', a);
      await s.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
