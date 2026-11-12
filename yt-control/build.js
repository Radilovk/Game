// Сглобява разширението (extension/) и userscript-а (dist/) от общия код в src/.
// Стартиране: node build.js
const fs = require('fs');
const path = require('path');
const R = (...p) => path.join(__dirname, ...p);
const read = (f) => fs.readFileSync(R('src', f), 'utf8');
const version = /YTC\.VERSION = '([^']+)'/.exec(read('schema.js'))[1];

for (const f of ['schema.js', 'ui.js', 'core.js', 'adapter-ext.js']) fs.copyFileSync(R('src', f), R('extension', f));
const man = JSON.parse(fs.readFileSync(R('extension', 'manifest.json'), 'utf8'));
man.version = version;
fs.writeFileSync(R('extension', 'manifest.json'), JSON.stringify(man, null, 2) + '\n');

const header = `// ==UserScript==
// @name         YouTube Контрол – блокер на Shorts и реклами
// @namespace    yt-control
// @version      ${version}
// @description  Пълно блокиране на Shorts, скриване и пропускане на реклами, филтри по думи/канали, фокус режим.
// @match        *://www.youtube.com/*
// @match        *://m.youtube.com/*
// @match        *://youtube.com/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==
`;
const body = ['schema.js', 'ui.js', 'core.js', 'adapter-us.js'].map(read).join('\n');
fs.writeFileSync(R('dist', 'yt-control.user.js'), header + '\n' + body);
console.log('OK v' + version);
