// Сглобява dist/yt-control.user.js от src/. Стартиране: node build.js
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const version = /YTC\.VERSION = '([^']+)'/.exec(read('schema.js'))[1];
const header = `// ==UserScript==
// @name         YT Контрол – блокер на Shorts и реклами (мобилен)
// @namespace    yt-control
// @version      ${version}
// @description  Изрязва Shorts и рекламите от данните на m.youtube.com, преди да се покажат. Филтри по думи и канали, фокус режим.
// @match        https://m.youtube.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==
`;
const body = ['schema.js', 'hook.js', 'dom.js', 'ui.js', 'boot.js'].map(read).join('\n');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'yt-control.user.js'), header + '\n' + body);
console.log('OK v' + version);
