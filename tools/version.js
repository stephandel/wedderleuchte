#!/usr/bin/env node
/* tools/version.js – berechnet die Version des Service Workers automatisch.
   Liest die Liste HUELLE aus sw.js, bildet einen kurzen Fingerabdruck (SHA-1, 10 Zeichen) über alle diese Dateien
   und über sw.js selbst und schreibt ihn als  const VERSION = 'wedder-<hash>';  in sw.js.
   Ändert sich auch nur ein Zeichen in einer Datei, entsteht eine neue Version: Die installierte App holt sich dann die neue Fassung.
   Aufruf:  node tools/version.js          (schreibt sw.js, falls nötig)
            node tools/version.js --pruefen (ändert nichts, Exit-Code 1, wenn die Version nicht stimmt)
   Ohne Abhängigkeiten, nur Node. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WURZEL = path.join(__dirname, '..');
const SW = path.join(WURZEL, 'sw.js');
const VERSION_ZEILE = /const VERSION = '[^']*';/;

function huelleLesen(quelltext) {
  const m = /const HUELLE = \[([\s\S]*?)\];/.exec(quelltext);
  if (!m) throw new Error('In sw.js fehlt die Liste HUELLE.');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function berechnen() {
  const sw = fs.readFileSync(SW, 'utf8');
  if (!VERSION_ZEILE.test(sw)) throw new Error("In sw.js fehlt die Zeile  const VERSION = '…';");
  const dateien = huelleLesen(sw).map(d => (d === './' ? 'index.html' : d));
  const fehlend = dateien.filter(d => !fs.existsSync(path.join(WURZEL, d)));
  if (fehlend.length) throw new Error('Diese Dateien aus HUELLE fehlen: ' + fehlend.join(', '));
  const h = crypto.createHash('sha1');
  // sw.js ohne die Versionszeile, damit das Schreiben der Version den Hash nicht verändert
  h.update('sw.js\0' + sw.replace(VERSION_ZEILE, '') + '\0');
  for (const d of [...new Set(dateien)].sort()) { h.update(d + '\0'); h.update(fs.readFileSync(path.join(WURZEL, d))); h.update('\0'); }
  const version = 'wedder-' + h.digest('hex').slice(0, 10);
  return { sw, version, neu: sw.replace(VERSION_ZEILE, "const VERSION = '" + version + "';") };
}

if (require.main === module) {
  try {
    const { sw, version, neu } = berechnen();
    if (process.argv.includes('--pruefen')) {
      if (sw !== neu) { console.error('sw.js hat nicht die aktuelle Version (' + version + '). Bitte  npm run version  ausführen.'); process.exit(1); }
      console.log('Version stimmt: ' + version);
    } else if (sw !== neu) { fs.writeFileSync(SW, neu); console.log('Neue Version in sw.js: ' + version); }
    else console.log('Version unverändert: ' + version);
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { berechnen, huelleLesen };
