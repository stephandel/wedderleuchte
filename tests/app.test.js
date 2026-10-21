/* tests/app.test.js – Wedderleuchte, 20.10.2026
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" node tests/app.test.js
           (Wedderleuchte hat keine eigenen Abhängigkeiten; Playwright z. B. aus „Wetter Apps/Design Konfigurator/konfigurator/node_modules“)
   Startet einen kleinen Server auf Port 8893 und prüft die App in WebKit (Browser-Kern von Safari).
   Ohne Netz: Open-Meteo antwortet mit tests/fixtures/open-meteo-mannheim.json, alles andere Fremde wird abgewiesen.
   Bildschirmfotos landen in BILDER (Standard /tmp/wedderleuchte-tests/). Exit-Code 0 = alles grün, 1 = mindestens ein Fehler. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8893;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/wedderleuchte-tests';
const OM = fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8');
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
  const ctx = await b.newContext({ viewport: { width: o.breite || 390, height: o.hoehe || 844 }, colorScheme: o.farbe || 'light', serviceWorkers: o.sw ? 'allow' : 'block' });
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url());
    if (u.host === 'api.open-meteo.com' && !o.omAus) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: OM });
    return route.abort();
  });
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|access control|net::|Load failed/i.test(m.text())) probleme.push('Konsole: ' + m.text()); });
  if (o.fremderSpeicher) await ctx.addInitScript(() => { if (window.caches) caches.open('fremde-app-v1'); });
  if (o.speicher) await ctx.addInitScript(s => { Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, o.speicher);
  await p.goto(BASIS + (o.adresse || ''));
  await p.waitForSelector(o.omAus && !o.speicher ? '#leiste button' : '.aktuell-kachel', { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p, probleme };
}

const FOTO = path.join(__dirname, 'fixtures', 'foto.jpg');
const studioDa = p => p.evaluate(() => !!document.getElementById('studio') && !document.getElementById('studio').hidden && !!document.querySelector('#ksWurzel .ks'));
const inst = p => p.evaluate(() => { const r = document.querySelector('#ksWurzel .ks'), i = r && r._ksInst; return i ? { foto: !!i.quelle, wetter: i.wetter, variante: i.variante, optionen: i.optionen } : null; });

// Maße prüfen: kein seitliches Scrollen, Schrift ≥ 11 px, Tippflächen ≥ 44 px (sichtbare Knöpfe)
const masse = p => p.evaluate(() => {
  const r = { breit: document.documentElement.scrollWidth > innerWidth + 1, klein: [], knopf: [] };
  document.querySelectorAll('body *').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden') return;
    const eigenText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (eigenText && parseFloat(cs.fontSize) < 11 && !e.closest('svg') && !e.closest('.leaflet-container')) r.klein.push(e.className + ' ' + cs.fontSize);
    if ((e.tagName === 'BUTTON' || e.tagName === 'A') && !e.closest('.leaflet-container') && !e.closest('.mg') && !e.closest('.wk')) {
      const b = e.getBoundingClientRect(); if (b.width < 43.5 || b.height < 43.5) r.knopf.push((e.id || e.className) + ' ' + Math.round(b.width) + '×' + Math.round(b.height));
    }
  });
  return r;
});

// Kontrast weißer Text (88 % Deckkraft) auf dem Himmel-Verlauf, schlechtester Punkt je Wetterlage, mit und ohne Glas-Kachel
function kontrastHimmel(tokens) {
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = f => 0.2126 * lin(f[0]) + 0.7152 * lin(f[1]) + 0.0722 * lin(f[2]);
  const misch = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const sm = /--himmel-schleier: linear-gradient\(180deg, rgba\(0,0,0,([.\d]+)\) 0%, rgba\(0,0,0,([.\d]+)\) 50%, rgba\(0,0,0,([.\d]+)\) 100%\)/.exec(tokens).slice(1).map(Number);
  const schleier = t => t <= 0.5 ? sm[0] + (sm[1] - sm[0]) * t / 0.5 : sm[1] + (sm[2] - sm[1]) * (t - 0.5) / 0.5;
  const ergebnis = {};
  for (const m of tokens.matchAll(/--himmel-([a-z]+): linear-gradient\(180deg, (#[0-9A-Fa-f]{6}) 0%, (#[0-9A-Fa-f]{6}) 52%, (#[0-9A-Fa-f]{6}) 100%\)/g)) {
    const [, name, a, b, c] = m; let frei = 99, kachel = 99;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      let f = t <= 0.52 ? misch(hex(a), hex(b), t / 0.52) : misch(hex(b), hex(c), (t - 0.52) / 0.48);
      f = f.map(x => x * (1 - schleier(t)));
      const k = f.map(x => x * 0.7);   // Kachel: 30 % Schwarz
      const text = g => g.map(x => x + (255 - x) * 0.88);   // weiß mit 88 % Deckkraft auf diesem Grund
      const kr = (fg, bg) => (lum(fg) + 0.05) / (lum(bg) + 0.05);
      frei = Math.min(frei, kr(text(f), f)); kachel = Math.min(kachel, kr(text(k), k));
    }
    ergebnis[name] = [+frei.toFixed(2), +kachel.toFixed(2)];
  }
  return ergebnis;
}

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    console.log('1) Startseite hell, 390 px');
    {
      const { ctx, p, probleme } = await neueSeite(b);
      const module = await p.$$eval('#tab-wetter .raster > .kachel', ks => ks.map(k => k.getAttribute('aria-label')));
      pruefe('Startseite: genau 4 Module in der Reihenfolge Aktuell, Stunden, 8 Tage, Regenradar', JSON.stringify(module) === JSON.stringify(['Aktuell', 'Stunden', 'Vorhersage 8 Tage', 'Regenradar']), module);
      const kopf = await p.evaluate(() => ({ titel: document.getElementById('kopfTitel').textContent, modell: document.getElementById('kopfModell').textContent, sichtbar: !document.getElementById('kopfModell').hidden }));
      pruefe('Kopfzeile: Ort und darunter „Modell: Beste Mischung“', kopf.titel === 'Mannheim' && kopf.modell === 'Modell: Beste Mischung' && kopf.sichtbar, kopf);
      const leiste = await p.$$eval('#leiste button', bs => bs.map(x => ({ tab: x.dataset.tab, name: x.getAttribute('aria-label'), rund: getComputedStyle(x).borderRadius })));
      pruefe('Tab-Leiste: Wetter, Graphs, Kamera (Mitte, rund), Rad/Sat, Mehr', leiste.map(x => x.tab).join() === 'wetter,graphs,kamera,radsat,mehr' && leiste[2].name === 'Kamera' && leiste[2].rund === '50%', leiste);
      const himmel = await p.evaluate(() => ({ lage: document.documentElement.dataset.himmel, bg: getComputedStyle(document.getElementById('himmel')).backgroundImage }));
      pruefe('Hintergrund: Himmel-Verlauf nach Wetterlage gesetzt', !!himmel.lage && /linear-gradient/.test(himmel.bg), himmel.lage);
      const farben = await p.evaluate(() => { const k = document.querySelector('.kachel'); return { text: getComputedStyle(k).color, bg: getComputedStyle(k).backgroundColor }; });
      pruefe('Kacheln: weißer Text auf dunklem Glas', farben.text === 'rgb(255, 255, 255)' && /rgba\(0, 0, 0, 0\.3\)/.test(farben.bg), farben);
      const m = await masse(p);
      pruefe('390 px: kein seitliches Scrollen', !m.breit);
      pruefe('Keine Schrift unter 11 px', m.klein.length === 0, m.klein.slice(0, 5));
      pruefe('Tippflächen mindestens 44 × 44 px', m.knopf.length === 0, m.knopf.slice(0, 5));
      await p.screenshot({ path: path.join(BILDER, '1-start-hell.png'), fullPage: true });

      // Aktuell-Kachel: linke Hälfte wechselt rechts zu Radar, Wahl wird gemerkt
      await p.click('#aktWechsel'); await p.waitForTimeout(300);
      const radar = await p.evaluate(() => ({ karte: !!document.querySelector('.aktuell .akt-radar'), werte: !!document.querySelector('.aktuell .werte'), fokus: document.activeElement.id, punkte: document.querySelectorAll('.punkte i').length }));
      pruefe('Aktuell: Antippen links zeigt rechts die Radar-Karte, Fokus bleibt', radar.karte && !radar.werte && radar.fokus === 'aktWechsel' && radar.punkte === 2, radar);
      await p.screenshot({ path: path.join(BILDER, '2-aktuell-radar.png') });
      await p.reload(); await p.waitForSelector('.aktuell-kachel'); await p.waitForTimeout(300);
      pruefe('Aktuell: Ansicht Radar bleibt nach Neuladen', await p.$('.aktuell .akt-radar') !== null);
      await p.click('#aktWechsel');
      pruefe('Aktuell: nochmal antippen zeigt wieder die Werte', await p.$('.aktuell .werte') !== null);

      // Graphs, Rad/Sat, Mehr
      await p.click('[data-tab="graphs"]'); await p.waitForTimeout(1200);
      pruefe('Graphs: Meteogramm eingebaut, Modell-Zeile im Kopf versteckt', await p.$('#graphs.mg') !== null && await p.evaluate(() => document.getElementById('kopfModell').hidden));
      await p.screenshot({ path: path.join(BILDER, '3-graphs.png') });
      await p.click('[data-tab="radsat"]'); await p.waitForTimeout(800);
      pruefe('Rad/Sat: Karte eingebaut', await p.$('#karte.wk') !== null);
      await p.click('[data-tab="mehr"]'); await p.waitForTimeout(400);
      const mehr = await p.evaluate(() => ({ titel: document.querySelector('.titel-gross').textContent, quellen: document.querySelector('.quellen-liste').textContent }));
      pruefe('Mehr: Titel „Wedderleuchte“, Quellen ohne DWD', mehr.titel === 'Wedderleuchte' && /Open-Meteo/.test(mehr.quellen) && !/DWD|Bright Sky/.test(mehr.quellen), mehr);
      const m2 = await masse(p);
      pruefe('Mehr: Tippflächen ≥ 44 px, kein seitliches Scrollen', m2.knopf.length === 0 && !m2.breit, m2.knopf.slice(0, 5));
      await p.screenshot({ path: path.join(BILDER, '4-mehr.png'), fullPage: true });
      const speicher = await p.evaluate(() => Object.keys(localStorage));
      pruefe('Speicher nur unter wedder-…', speicher.length > 0 && speicher.every(k => k.startsWith('wedder-')), speicher);
      pruefe('Keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('2) Wetterfoto-Studio (ersetzt den alten Teilen-Bildschirm)');
    {
      const { ctx, p, probleme } = await neueSeite(b);
      pruefe('Kein alter Teilen-Bildschirm mehr (#teilen, #bild, #vorlagen)', await p.evaluate(() => !document.getElementById('teilen') && !document.getElementById('bild') && !document.getElementById('vorlagen')));
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 }).catch(() => {});   // Vorladen nach dem Start abwarten
      const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null), p.click('[data-tab="kamera"]')]);
      pruefe('Kamera-Reiter öffnet das Studio (#ksWurzel .ks) und gleich die Kamera (capture)', await studioDa(p) && !!fc && (await fc.element().getAttribute('capture')) === 'environment');
      pruefe('Hintergrund gesperrt (inert)', await p.evaluate(() => document.getElementById('inhalt').hasAttribute('inert')));
      if (fc) await fc.setFiles(FOTO);
      await p.waitForFunction(() => { const r = document.querySelector('#ksWurzel .ks'); return r && r._ksInst && r._ksInst.quelle; }, null, { timeout: 8000 }).catch(() => {});
      const i = await inst(p);
      pruefe('Foto ist geladen', i && i.foto, i);
      const w = i && i.wetter;
      pruefe('studioWetter: Mannheim, 7,7 °C, Heiter, Wind NW, Open-Meteo, Ortszeit mit Versatz', w && w.ort.stadt === 'Mannheim' && w.temp === 7.7 && w.lage === 'Heiter' && w.windRichtung === 'NW' && w.modell === 'Open-Meteo' && /\+0[12]:00$/.test(w.zeit), w);
      pruefe('Studio zeigt den App-Namen „Wedderleuchte“', await p.evaluate(() => { const r = document.querySelector('#ksWurzel .ks'); return !!r && r._ksInst.appName === 'Wedderleuchte'; }));
      pruefe('Einstellung wie WeddaApp: Ein-Tipp-Karte, Auslöser frei, Galerie 3/5', i && i.variante === 'schnell' && i.optionen.ausloeserOrt === 'frei' && i.optionen.galerieOriginale === 3 && i.optionen.galerieBearbeitet === 5, i && i.optionen);
      pruefe('Eigener Speichername: Nutzerwahl und Vorlage unter wedderleuchte-…', await p.evaluate(() => { const r = document.querySelector('#ksWurzel .ks'), n = r && r._ksInst; return !!n && n.nutzerPraefix === 'wedderleuchte-ks-nutzer-' && n.vorlageSchluessel === 'wedderleuchte-ks-vorlage'; }));
      await p.waitForFunction(() => [...document.querySelectorAll('#ksWurzel button')].some(x => x.textContent.trim() === 'Teilen'), null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(800);   // Galerie speichert das Foto
      const dbs = await p.evaluate(() => indexedDB.databases ? indexedDB.databases().then(l => l.map(d => d.name)) : []);
      pruefe('Galerie getrennt: IndexedDB „wedderleuchte-ks-galerie“, nicht weddaapp/wpcamera/ks-galerie', dbs.includes('wedderleuchte-ks-galerie') && !dbs.some(n => /weddaapp|wpcamera|^ks-galerie$/.test(n)), dbs);
      const schluessel = await p.evaluate(() => Object.keys(localStorage));
      pruefe('Speicher ohne weddaapp-/wpcamera-/wedda-Schlüssel', !schluessel.some(k => /weddaapp|wpcamera|^wedda-/.test(k)), schluessel);
      pruefe('Kein seitliches Scrollen mit Studio', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(BILDER, '5-studio-foto-hell.png') });
      await p.click('#studioZu'); await p.waitForTimeout(200);
      pruefe('„Fertig“ schließt das Studio, Hintergrund wieder frei', await p.evaluate(() => !!document.getElementById('studio') && document.getElementById('studio').hidden && !document.querySelector('#ksWurzel .ks') && !document.getElementById('inhalt').hasAttribute('inert') && document.body.style.overflow === ''));
      await p.click('#kopfTeilen'); await p.waitForTimeout(200);
      pruefe('Teilen-Knopf oben öffnet das Studio (ohne Kamera)', await studioDa(p));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      pruefe('Esc schließt das Studio', !(await studioDa(p)));
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }
    {
      const { ctx, p, probleme } = await neueSeite(b);
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 }).catch(() => {});
      pruefe('Studio wird nach dem Start im Hintergrund geladen', await p.evaluate(() => !!window.KSStudio && !!window.KSEngine));
      await p.click('[data-tab="kamera"]').catch(() => {}); await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(BILDER, '5-studio-leer.png') });
      pruefe('Studio ohne Foto: kein seitliches Scrollen', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('3) Dunkel, 130 % Schrift, Querformat, offline');
    {
      const { ctx, p, probleme } = await neueSeite(b, { farbe: 'dark' });
      const m = await masse(p);
      pruefe('Dunkel: kein seitliches Scrollen, Tippflächen ok', !m.breit && m.knopf.length === 0, m);
      await p.screenshot({ path: path.join(BILDER, '6-start-dunkel.png'), fullPage: true });
      await p.evaluate(() => { document.documentElement.style.fontSize = '130%'; window.dispatchEvent(new Event('resize')); });
      await p.waitForTimeout(300);
      const g = await masse(p);
      pruefe('130 % Schrift: kein seitliches Scrollen', !g.breit && await p.evaluate(() => document.documentElement.classList.contains('schrift-gross')));
      await p.screenshot({ path: path.join(BILDER, '7-schrift-130.png'), fullPage: true });
      pruefe('Keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }
    {
      const { ctx, p, probleme } = await neueSeite(b, { breite: 844, hoehe: 390 });
      const m = await masse(p);
      pruefe('Querformat 844 × 390: kein seitliches Scrollen', !m.breit, m);
      await p.screenshot({ path: path.join(BILDER, '8-quer.png') });
      pruefe('Keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }
    {
      const gemerkt = JSON.stringify({ ort: 'mannheim', roh: JSON.parse(OM), geholt: Date.now() - 3600e3 });
      const { ctx, p, probleme } = await neueSeite(b, { omAus: true, speicher: { 'wedder-daten-mannheim': gemerkt } });
      const t = await p.evaluate(() => ({ meldung: document.getElementById('meldung').textContent, kachel: !!document.querySelector('.aktuell-kachel') }));
      pruefe('Ohne Verbindung: letzter Stand mit Hinweis „Offline“', t.kachel && /Offline/.test(t.meldung), t);
      pruefe('Keine JS-Fehler', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('4) Kontrast und Dateien');
    {
      const k = kontrastHimmel(fs.readFileSync(path.join(WURZEL, 'tokens.css'), 'utf8'));
      const schlecht = Object.entries(k).filter(([, v]) => v[0] < 4.5 || v[1] < 4.5);
      pruefe('Weißer Text auf jedem Himmel-Verlauf ≥ 4,5:1 (frei und auf Kachel)', Object.keys(k).length === 8 && schlecht.length === 0, schlecht.length ? schlecht : k);
      console.log('     schlechtester Wert frei/Kachel: ' + Object.entries(k).map(([n, v]) => n + ' ' + v.join('/')).join(', '));
      const sw = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
      pruefe('Service Worker: Version aktuell, nur eigene Speicher löschen', require('../tools/version.js').berechnen().neu === sw && /startsWith\('wedder-'\)/.test(sw));
      const fremd = ['index.html', 'app.js', 'app.css'].filter(d => /dwd|wedda-|weddaapp|wpcamera|WeddaApp/.test(fs.readFileSync(path.join(WURZEL, d), 'utf8').split('\n').filter(z => !/^\s*(\/\/|\/\*)/.test(z)).join('\n')));
      pruefe('Keine Reste von WeddaApp (DWD, Name, Speicher)', fremd.length === 0, fremd);
    }

    console.log('5) Offline (Service Worker) und Studio-Dateien');
    {
      const sw = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
      const dateien = ['ks-symbole.js', 'ks-engine.js', 'ks-studio.js', 'ks-studio.css'].map(d => 'lib/kamera-studio/' + d);
      pruefe('sw.js: alle 4 Studio-Dateien in der Offline-Liste, Dateien vorhanden', dateien.every(d => sw.includes("'" + d + "'") && fs.existsSync(path.join(WURZEL, d))));
      const { ctx, p, probleme } = await neueSeite(b, { sw: true, fremderSpeicher: true });
      await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
      pruefe('Service Worker löscht nur eigene Speicher (andere Apps unter derselben Adresse bleiben)', await p.evaluate(() => caches.has('fremde-app-v1')));
      const imSpeicher = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('wedder-'))); return (await c.keys()).map(r => new URL(r.url).pathname).filter(x => /kamera-studio/.test(x)).length; });
      pruefe('Alle 4 Studio-Dateien im Offline-Speicher', imSpeicher === 4, imSpeicher);
      await ctx.setOffline(true);
      await p.reload(); await p.waitForSelector('#leiste button', { timeout: 8000 });
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 }).catch(() => {});
      await p.click('#kopfTeilen'); await p.waitForTimeout(500);
      pruefe('Offline: Studio lädt aus dem Speicher und öffnet', await studioDa(p));
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }
  } finally {
    await b.close(); s.close();
  }
  console.log('\n' + ok + ' von ' + (ok + fehler) + ' Prüfungen bestanden' + (fehler ? ', ' + fehler + ' Fehler' : ''));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
