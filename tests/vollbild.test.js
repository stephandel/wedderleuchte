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
  const farbe = c => { const z = (c.replace(/^color\(srgb/, '').match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(srgb/.test(c) ? z.map(v => v * 255) : z; };   // WebKit gibt color-mix als color(srgb 0…1) aus
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
// Karte: füllt das Blatt abzüglich Kopf, Ebenenleiste und Zeitleiste; Zoom, Zeit-Regler, Abspielen und Umschalter bedienbar
const KARTE = {
  sel: '#karte', knopf: '.wk-voll', knopfKlasse: 'wk-voll', fertig: '.wk-vb-fertig', marke: 'wk', label: 'Radar und Satellit im Vollbild', was: 'die Karte', reiter: 'radsat',
  extra: async (p, name) => {
    const k = await p.evaluate(() => {
      const w = document.querySelector('#karte'), r = s => { const e = w.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const m = w.querySelector('.wk-leaflet')._wkMap.getSize();
      return { karte: r('.wk-leaflet'), kopf: r('.wk-vb-kopf'), zeit: r('.wk-zeit'), leiste: r('.wk-leiste'), plus: r('[data-zoom="1"]'), minus: r('[data-zoom="-1"]'), play: r('.wk-play'), regler: r('.wk-range'), mapGr: [m.x, m.y], vw: innerWidth, vh: innerHeight,
        chips: [...w.querySelectorAll('.wk-vb-chip')].map(c => c.textContent + ':' + c.getAttribute('aria-checked')) };
    });
    const drin = b => !!b && b[0] >= 0 && b[1] >= 0 && b[2] <= k.vw + 1 && b[3] <= k.vh;   // 1 px: die Ebenenleiste hat einen halben Pixel Rand
    pruefe(name + ': Karte füllt das Blatt zwischen Kopf, Ebenenleiste und Zeitleiste; Leaflet kennt die neue Größe', k.karte[1] === k.kopf[3] && k.karte[3] === k.zeit[1] && k.karte[2] === k.leiste[0] && k.mapGr[0] === k.karte[2] - k.karte[0] && k.mapGr[1] === k.karte[3] - k.karte[1] && k.zeit[3] === k.vh, k);
    pruefe(name + ': + und −, Abspielen und Zeit-Regler im Bild', [k.plus, k.minus, k.play, k.regler].every(drin), k);
    // Zweite Meinung: quer war die Ebenenleiste höher als die Karte, oben und unten angeschnitten
    const l = await p.evaluate(() => { const le = document.querySelector('#karte .wk-leiste'), lr = le.getBoundingClientRect();
      const kn = [...le.querySelectorAll('button')].filter(x => getComputedStyle(x).display !== 'none').map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.width), Math.round(r.height)]; });
      return { scroll: le.scrollHeight - le.clientHeight, oben: Math.round(lr.top), unten: Math.round(lr.bottom), kn }; });
    pruefe(name + ': Ebenenleiste ganz sichtbar, ohne Scrollen, jeder Knopf mind. 44 px', l.scroll <= 0 && l.kn.every(x => x[0] >= l.oben - 1 && x[1] <= l.unten + 1 && x[2] >= 43.5 && x[3] >= 43.5), l);
    // Zweite Meinung: Hinweis und Quellenzeile untereinander; Name des Orts lesbar auf jedem Kartenuntergrund
    const u = await p.evaluate(() => {
      const w = document.querySelector('#karte'), h = w.querySelector('.wk-hinweis'), q = w.querySelector('.wk-quelle'), n = w.querySelector('.wk-marke.is-hier .wk-name');
      const rgba = c => { const z = (c.replace(/^color\(srgb/, '').match(/[\d.]+/g) || []).map(Number); const f = /^color\(srgb/.test(c) ? 255 : 1; return [z[0] * f, z[1] * f, z[2] * f, z.length > 3 ? z[3] : 1]; };
      const L = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      let kontrast = null;
      if (n) {   // schlechtester Fall: die Pille liegt über weißer oder schwarzer Karte
        const t = rgba(getComputedStyle(n).color), bg = rgba(getComputedStyle(n).backgroundColor), a = bg[3];
        kontrast = Math.min(...[[255, 255, 255], [0, 0, 0]].map(k => { const m = [0, 1, 2].map(i => bg[i] * a + k[i] * (1 - a)); const x = L(t), y = L(m); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }));
      }
      return { hinweis: !h.hidden, hUnten: Math.round(h.getBoundingClientRect().bottom), qOben: Math.round(q.getBoundingClientRect().top), kontrast: kontrast && Math.round(kontrast * 100) / 100 };
    });
    pruefe(name + ': Hinweis steht über der Quellenzeile (keine Überlappung)', !u.hinweis || u.hUnten <= u.qOben, u);
    pruefe(name + ': Name des Orts auf der Karte mit Kontrast mind. 4,5:1 auf hellem und dunklem Grund', u.kontrast === null || u.kontrast >= 4.5, u);
    pruefe(name + ': Umschalter „Radar & Satellit | Karten“ im Blatt-Kopf', k.chips.join('|') === 'Radar & Satellit:true|Karten:false', k.chips);
    const z0 = await p.evaluate(() => document.querySelector('#karte .wk-leaflet')._wkMap.getZoom());
    await p.click('#karte [data-zoom="1"]'); await p.waitForTimeout(300);
    const z1 = await p.evaluate(() => document.querySelector('#karte .wk-leaflet')._wkMap.getZoom());
    pruefe(name + ': + zoomt im Blatt', z1 > z0, [z0, z1]);
    await p.click('#karte .wk-play'); await p.waitForTimeout(200);
    pruefe(name + ': Abspielen startet im Blatt', await p.evaluate(() => document.querySelector('#karte .wk-play').getAttribute('aria-label') === 'Anhalten'));
    await p.click('#karte .wk-play');
  }
};
async function zuKarte(p) { await p.click('#leiste [data-tab="radsat"]'); await p.waitForSelector('#karte.wk .leaflet-container', { timeout: 10000 }); await p.waitForTimeout(500); }
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
    console.log('2) Karte (Rad/Sat) im Vollbild: 390 hell und dunkel, quer 844 × 390, 1280 × 800');
    for (const o of [{ name: 'karte-390-hell' }, { name: 'karte-390-dunkel', farbe: 'dark' }, { name: 'karte-390-130', schrift: true }, { name: 'karte-844-quer', breite: 844, hoehe: 390 }, { name: 'karte-844-quer-130', breite: 844, hoehe: 390, schrift: true }, { name: 'karte-1280', breite: 1280, hoehe: 800 }]) {
      const s = await neueSeite(b, Object.assign({ speicher: { [VORSATZ + 'radsat-modus']: '"radsat"' } }, o));
      await zuKarte(s.p);
      await blattPruefen(s, Object.assign({}, KARTE, { name: o.name }));
      pruefe(o.name + ': keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
      await s.ctx.close();
    }
    console.log('3) Umschalter im Karten-Blatt: Karten statt Radar, Blatt bleibt offen, Fertig führt zurück');
    {
      const s = await neueSeite(b, { speicher: { [VORSATZ + 'radsat-modus']: '"radsat"' } });
      await zuKarte(s.p);
      const l0 = await s.p.evaluate(() => history.length);
      await s.p.click('#karte .wk-voll'); await s.p.waitForTimeout(400);
      await s.p.click('#karte [data-wechsel="karten"]'); await s.p.waitForTimeout(800);
      const z = await s.p.evaluate(() => { const w = document.querySelector('#karte'), r = w.getBoundingClientRect(); return { voll: Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight, klasse: w.classList.contains('wk-vollbild'), chips: [...w.querySelectorAll('.wk-vb-chip')].map(c => c.getAttribute('aria-checked')).join(','), fokus: document.activeElement && document.activeElement.dataset.wechsel, ebenen: w.querySelectorAll('[data-ebene]').length, laenge: history.length, leiste: !!document.querySelector('#leiste').closest('[inert]'), label: w.getAttribute('aria-label') }; });
      pruefe('Wechsel zu „Karten“: neue Karte gleich im Blatt, Umschalter gewählt, Fokus darauf', z.voll && z.klasse && z.chips === 'false,true' && z.fokus === 'karten' && z.ebenen === 6 && z.leiste, z);
      pruefe('Wechsel legt keinen weiteren Verlaufseintrag an', z.laenge === l0 + 1, [l0, z.laenge]);
      pruefe('Wahl wird gemerkt', await s.p.evaluate(v => localStorage.getItem(v + 'radsat-modus'), VORSATZ) === '"karten"');
      await foto(s.p, 'vollbild-karte-wechsel-karten');
      await s.p.click('#karte .wk-vb-fertig'); await s.p.waitForTimeout(400);
      const zu = await s.p.evaluate(() => ({ voll: document.querySelector('#karte').classList.contains('wk-vollbild'), leiste: !!document.querySelector('#leiste').closest('[inert]'), zustand: history.state, modus: document.querySelector('[data-modus="karten"]').getAttribute('aria-checked') }));
      pruefe('Fertig nach dem Wechsel: Blatt zu, Seite frei, Verlauf zurück, Reiter zeigt „Karten“', !zu.voll && !zu.leiste && !(zu.zustand && zu.zustand.wpVollbild) && zu.modus === 'true', zu);
      pruefe('keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
      await s.ctx.close();
    }
    console.log('5) Einstellung „Meteogramm und Karten immer im Vollbild“ (A32 P3)');
    {
      const s = await neueSeite(b, { speicher: { [VORSATZ + 'radsat-modus']: '"radsat"' } }), p = s.p;
      const blatt = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight && !!document.querySelector('#leiste').closest('[inert]'); }, sel);
      const reiter = () => p.evaluate(() => ['wetter', 'graphs', 'radsat', 'mehr'].filter(t => !document.getElementById('tab-' + t).hidden)[0]);
      await p.click('#leiste [data-tab="mehr"]'); await p.waitForTimeout(300);
      const sch = await p.$('#vollbildImmer');
      pruefe('Mehr → Darstellung: Schalter „Meteogramm und Karten immer im Vollbild“ (role=switch, aus, Zeile mind. 44 px)', !!sch && await sch.getAttribute('role') === 'switch' && !(await sch.isChecked()) && /immer im Vollbild/.test(await p.textContent('#tab-mehr')) && (await p.evaluate(() => document.getElementById('vollbildImmer').closest('label').getBoundingClientRect().height)) >= 44);
      if (sch) {
        await foto(p, 'vollbild-immer-mehr');
        await sch.check(); await p.waitForTimeout(100);
        pruefe('Wahl gespeichert (' + VORSATZ + 'vollbild-immer)', await p.evaluate(k => localStorage.getItem(k), VORSATZ + 'vollbild-immer') === 'true');
        await p.click('#leiste [data-tab="wetter"]'); await p.waitForTimeout(200);
        await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(700);
        pruefe('Tipp auf Graphs öffnet das Meteogramm direkt als Blatt, Fokus auf „Fertig“', await blatt('#graphs') && await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('mg-vb-fertig')));
        await foto(p, 'vollbild-immer-graphs');
        await p.click('#graphs .mg-vb-fertig'); await p.waitForTimeout(400);
        pruefe('„Fertig“ führt zum vorherigen Reiter (Wetter), Seite frei', await reiter() === 'wetter' && !(await blatt('#graphs')) && await p.evaluate(() => !document.querySelector('#leiste').closest('[inert]')), await reiter());
        await p.click('#leiste [data-tab="mehr"]'); await p.waitForTimeout(200);
        await p.click('#leiste [data-tab="radsat"]'); await p.waitForTimeout(900);
        pruefe('Tipp auf Rad/Sat öffnet die Karte direkt als Blatt', await blatt('#karte'));
        await p.click('#karte [data-wechsel="karten"]'); await p.waitForTimeout(800);
        pruefe('Umschalter im Blatt: Karten bleiben im Blatt', await blatt('#karte') && await p.evaluate(() => document.querySelectorAll('#karte [data-ebene]').length) === 6);
        await foto(p, 'vollbild-immer-karten');
        await p.evaluate(() => history.back()); await p.waitForTimeout(500);
        pruefe('Zurück führt zum vorherigen Reiter (Mehr)', await reiter() === 'mehr' && !(await blatt('#karte')), await reiter());
        await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
        pruefe('Esc aus Graphs führt ebenfalls zurück (Mehr)', await reiter() === 'mehr', await reiter());
        await p.reload(); await p.waitForSelector('.aktuell-kachel', { timeout: 10000 }); await p.waitForTimeout(300);
        await p.click('#leiste [data-tab="mehr"]'); await p.waitForTimeout(300);
        pruefe('Nach einem Neustart ist die Wahl noch gesetzt', await p.isChecked('#vollbildImmer'));
        await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(700);
        pruefe('Nach dem Neustart öffnet Graphs wieder als Blatt', await blatt('#graphs'));
        await p.click('#graphs .mg-vb-fertig'); await p.waitForTimeout(300);
        await p.uncheck('#vollbildImmer');
        await p.click('#leiste [data-tab="graphs"]'); await p.waitForTimeout(500);
        pruefe('Schalter aus: Graphs öffnet wieder normal mit Tab-Leiste', await reiter() === 'graphs' && !(await blatt('#graphs')));
      }
      pruefe('keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
      await s.ctx.close();
    }
    console.log('6) Zweite Meinung: schnelles Auf/Zu/Auf');
    {
      const s = await neueSeite(b, { speicher: { [VORSATZ + 'radsat-modus']: '"radsat"' } }), p = s.p;
      for (const [sel, auf, zu, name, hin] of [['#graphs', '#graphs .mg-btn-voll', '#graphs .mg-vb-fertig', 'Meteogramm', zuGraphs], ['#karte', '#karte .wk-voll', '#karte .wk-vb-fertig', 'Karte', zuKarte]]) {
        await hin(p);
        const l0 = await p.evaluate(() => history.length);
        await p.evaluate(([a, z]) => { document.querySelector(a).click(); document.querySelector(z).click(); document.querySelector(a).click(); }, [auf, zu]);
        await p.waitForTimeout(700);
        const r = await p.evaluate(sel => { const e = document.querySelector(sel).getBoundingClientRect(); return { voll: Math.round(e.width) === innerWidth && Math.round(e.height) === innerHeight, inert: !!document.querySelector('#leiste').closest('[inert]'), zustand: history.state, laenge: history.length }; }, sel);
        pruefe(name + ': Auf/Zu/Auf ohne Pause: Blatt bleibt offen, Seite gesperrt, Verlauf steht auf dem Blatt', r.voll && r.inert && !!r.zustand && !!r.zustand.wpVollbild, r);
        if (!r.voll) continue;
        await p.click(zu); await p.waitForTimeout(500);
        const r2 = await p.evaluate(() => ({ zustand: history.state, inert: !!document.querySelector('#leiste').closest('[inert]') }));
        await p.click(auf); await p.waitForTimeout(300); await p.click(zu); await p.waitForTimeout(500);
        const l3 = await p.evaluate(() => history.length);
        pruefe(name + ': danach schließt „Fertig“ sauber, normales Auf/Zu verlängert den Verlauf nicht weiter', !(r2.zustand && r2.zustand.wpVollbild) && !r2.inert && l3 <= r.laenge, [l0, r.laenge, l3, r2]);
      }
      pruefe('keine Fehler in der Konsole', s.probleme.length === 0, s.probleme);
      await s.ctx.close();
    }
    console.log('4) Reduzierte Bewegung');
    {
      const s = await neueSeite(b, { bewegung: 'reduce' });
      await zuGraphs(s.p);
      await s.p.click('#graphs .mg-btn-voll');
      const a = await s.p.evaluate(() => { const st = getComputedStyle(document.getElementById('graphs')); return { name: st.animationName, dauer: st.animationDuration }; });
      pruefe('prefers-reduced-motion: Meteogramm-Blatt ohne Wachs-Animation', a.name === 'none' || a.dauer === '0s', a);
      await s.p.click('#graphs .mg-vb-fertig'); await zuKarte(s.p); await s.p.click('#karte .wk-voll');
      const k = await s.p.evaluate(() => { const st = getComputedStyle(document.getElementById('karte')); return { name: st.animationName, dauer: st.animationDuration }; });
      pruefe('prefers-reduced-motion: Karten-Blatt ohne Wachs-Animation', k.name === 'none' || k.dauer === '0s', k);
      await s.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
