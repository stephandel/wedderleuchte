/* sw.js – Offline-Betrieb der Wedderleuchte
   - VERSION schreibt tools/version.js automatisch (Fingerabdruck über alle Dateien in HUELLE). Nicht von Hand ändern.
   - index.html und JSON: erst aus dem Netz, ohne Netz aus dem Zwischenspeicher.
   - Übrige Hülle (CSS, JS, Bilder, Leaflet): sofort aus dem Zwischenspeicher, im Hintergrund auffrischen.
   - Wetterdaten, Karten und Radar kommen von fremden Diensten und gehen direkt ins Netz; den letzten Stand merkt sich app.js. */
const VERSION = 'wedder-d05d610869';
const HUELLE = ['./', 'index.html', 'app.css', 'app.js', 'base.css', 'tokens.css', 'symbole.js', 'ikonen.js', 'manifest.json', 'meteogramm.js', 'meteogramm.css', 'wpkarte.js', 'wpkarte.css', 'apple-touch-icon.png', 'app-symbol-1024.png',
  'lib/leaflet/leaflet.min.js', 'lib/leaflet/leaflet.css', 'lib/leaflet/images/layers.png', 'lib/leaflet/images/layers-2x.png', 'lib/leaflet/images/marker-icon.png', 'lib/leaflet/images/marker-icon-2x.png', 'lib/leaflet/images/marker-shadow.png',
  'lib/kamera-studio/ks-symbole.js', 'lib/kamera-studio/ks-engine.js', 'lib/kamera-studio/ks-studio.js', 'lib/kamera-studio/ks-studio.css'];

const speicherbar = r => r && r.ok && r.type === 'basic';
const merken = (req, r) => { if (speicherbar(r)) { const kopie = r.clone(); caches.open(VERSION).then(c => c.put(req, kopie)); } return r; };

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(HUELLE)).then(() => self.skipWaiting())); });
// Nur eigene alte Speicher löschen: alle Apps unter stephandel.github.io teilen sich denselben Cache-Speicher
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wedder-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

function netzZuerst(req, seite) {
  return fetch(req).then(r => merken(seite ? 'index.html' : req, r)).catch(() =>
    caches.match(seite ? 'index.html' : req, { ignoreSearch: seite }).then(r => r || caches.match('index.html')));
}
function speicherZuerst(e) {
  const netz = fetch(e.request).then(r => merken(e.request, r));
  return caches.match(e.request).then(r => {
    if (r) { e.waitUntil(netz.catch(() => { })); return r; }
    return netz;
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const pfad = url.pathname, scope = new URL(self.registration.scope).pathname;
  const seite = e.request.mode === 'navigate' || pfad === scope || pfad.endsWith('/index.html');
  const daten = /\.json$/.test(pfad);
  e.respondWith(seite || daten ? netzZuerst(e.request, seite) : speicherZuerst(e));
});
