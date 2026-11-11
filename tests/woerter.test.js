/* tests/woerter.test.js – deutsche Reiternamen und keine klebenden Werte (P-caad, Rundum-Prüfung C3/C7; 11.11.2026)
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" PORT=9712 node tests/woerter.test.js
   Prüft in WebKit bei 320 × 568, 375 × 667 (hell) und 402 × 874 (dunkel) in den Reitern Wetter, Kurven, Radar und Mehr:
   1) kein „Graphs“, „Rad/Sat“ oder „Letztes Update“ im sichtbaren Text, in aria-label oder title;
   2) jeder Reitername passt ganz in seinen Knopf (kein „…“, keine Leiste nur mit Symbolen);
   3) keine Werte, die in einer Zeile ohne Abstand aneinanderstoßen (unter 3 px), und kein seitliches Verschieben.
   Ohne Netz: fremde Dienste bekommen feste Antworten aus tests/fixtures. Exit-Code 0 = alles grün.
   WURZEL=<Ordner> prüft einen anderen Stand (z. B. main, um zu zeigen, dass der Test vorher rot war). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const ART = 'wedda';   // 'camera' (WetterProCamera) oder 'wedda' (WeddaApp, Wedderleuchte): bestimmt Testdaten und Uhrzeit
const WURZEL = process.env.WURZEL || path.join(__dirname, '..');
const PORT = +process.env.PORT || 9712;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const fixture = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const UHR = ART === 'camera' ? '2026-10-15T14:40:00+02:00' : '2026-10-22T10:00:00Z';   // Zeitpunkt der gespeicherten Antworten
const ENGLISCH = 'Graphs|Rad/Sat|Letztes Update';

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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

function umleiten(route) {
  const u = new URL(route.request().url());
  const json = (text, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: text });
  if (u.host === 'api.open-meteo.com') {
    if (ART !== 'camera') return json(fixture('open-meteo-mannheim.json'));
    const lat = u.searchParams.get('latitude') || '';
    if (lat.includes(',')) return json(JSON.stringify(lat.split(',').map((_, i) => ({ current: { temperature_2m: 15 + i, weather_code: 2, is_day: 1 } }))));
    return json(fixture(u.searchParams.has('past_days') ? 'open-meteo-meteogramm.json' : 'open-meteo.json'));
  }
  if (ART === 'camera' && u.host === 'air-quality-api.open-meteo.com') return json(fixture('air-quality.json'));
  if (ART === 'camera' && u.host === 'api.brightsky.dev') return json(u.pathname === '/weather' ? fixture('brightsky-mannheim.json') : u.pathname === '/current_weather' ? fixture('brightsky-mannheim-current.json') : fixture('brightsky-alerts-leer.json'));
  if (u.host === 'api.brightsky.dev') return json('{"title":"Not Found"}', 404);
  if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  return route.abort();
}

// Nachbarn in Flex- und Grid-Zeilen, deren Inhalt in derselben Zeile mit weniger als 3 px Abstand (oder überlappend) liegt
const KLEBT = () => {
  const sicht = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const flaeche = e => { const r = document.createRange(); r.selectNodeContents(e); const q = [...r.getClientRects()].filter(x => x.width > 0); if (!q.length) return null;
    return { l: Math.min(...q.map(x => x.left)), r: Math.max(...q.map(x => x.right)), o: Math.min(...q.map(x => x.top)), u: Math.max(...q.map(x => x.bottom)) }; };
  const funde = [];
  document.querySelectorAll('body *').forEach(c => {
    if (!/flex|grid/.test(getComputedStyle(c).display) || !sicht(c)) return;
    const kinder = [...c.children].filter(k => sicht(k) && k.textContent.trim());
    for (let i = 0; i + 1 < kinder.length; i++) {
      const a = flaeche(kinder[i]), b = flaeche(kinder[i + 1]); if (!a || !b) continue;
      const luecke = b.l - a.r;
      if (Math.min(a.u, b.u) - Math.max(a.o, b.o) > 4 && luecke > -20 && luecke < 3) funde.push(kinder[i].textContent.trim().slice(-16) + '|' + kinder[i + 1].textContent.trim().slice(0, 16) + ' (' + luecke.toFixed(1) + ' px)');
    }
  });
  return funde;
};
const REITER = () => {
  const leiste = document.querySelector('.nur-symbole');
  return { nurSymbole: !!leiste, knoepfe: [...document.querySelectorAll('button[data-tab]')].filter(b => b.getBoundingClientRect().width > 0).map(b => {
    const s = b.querySelector('span') || b; return { tab: b.dataset.tab, name: s.textContent.trim(), passt: s.scrollWidth <= s.clientWidth + 0.5 };
  }) };
};
const WOERTER = muster => {
  const rx = new RegExp(muster), sichtbar = document.body.innerText.split('\n');
  const attr = [...document.querySelectorAll('[aria-label],[title]')].map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || ''));
  return [...sichtbar, ...attr].filter(z => rx.test(z)).map(z => z.trim().slice(0, 80));
};

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    for (const [w, h, farbe] of [[320, 568, 'light'], [375, 667, 'light'], [402, 874, 'dark']]) {
      const kz = w + (farbe === 'dark' ? ' dunkel' : ' hell');
      console.log(kz);
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: farbe, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await ctx.addInitScript(() => { try { localStorage.setItem('wpc-mehr-offen', '[0,1,2,3,4]'); } catch (e) { } });   // Camera: alle Gruppen unter „Mehr“ offen
      await ctx.clock.setFixedTime(new Date(UHR));
      await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), umleiten);
      const p = await ctx.newPage(), probleme = [];
      p.on('pageerror', e => probleme.push(e.message));
      await p.goto(BASIS);
      await p.waitForSelector(ART === 'camera' ? '.tag' : '.aktuell-kachel', { timeout: 15000 });
      await p.waitForTimeout(1200);
      const r = await p.evaluate(REITER);
      pruefe(kz + ': Reiter heißen Wetter, Kurven, Radar, Mehr', r.knoepfe.filter(k => k.name).map(k => k.name).join() === 'Wetter,Kurven,Radar,Mehr', r.knoepfe.map(k => k.name));
      pruefe(kz + ': jeder Reitername passt ganz in seinen Knopf, Leiste zeigt alle Namen', !r.nurSymbole && r.knoepfe.every(k => k.passt), r);
      pruefe(kz + ': Startseite ohne seitliches Verschieben', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
      if (ART === 'camera') pruefe(kz + ': oben steht „Stand … Uhr“', /^Stand \d\d:\d\d Uhr$/.test(await p.textContent('#updateText')), await p.textContent('#updateText'));
      for (const t of ['wetter', 'graphs', 'radsat', 'mehr']) {
        await p.click('button[data-tab="' + t + '"]'); await p.waitForTimeout(t === 'wetter' ? 400 : 1200);
        pruefe(kz + ', Reiter ' + t + ': keine englischen Wörter (' + ENGLISCH + ')', (await p.evaluate(WOERTER, ENGLISCH)).length === 0, await p.evaluate(WOERTER, ENGLISCH));
        pruefe(kz + ', Reiter ' + t + ': keine Werte, die aneinanderkleben', (await p.evaluate(KLEBT)).length === 0, await p.evaluate(KLEBT));
      }
      pruefe(kz + ': keine Seitenfehler', probleme.length === 0, probleme);
      await ctx.close();
    }
  } catch (e) { fehler++; console.log('  ✗ Abbruch: ' + e.message); }
  await b.close(); s.close();
  console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
  process.exit(fehler ? 1 : 0);
})();
