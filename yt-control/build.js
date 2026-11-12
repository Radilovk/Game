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
// @match        https://radilovk.github.io/Game/yt-control/*
// @homepageURL  https://radilovk.github.io/Game/yt-control/
// @updateURL    https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js
// @downloadURL  https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==
`;
const body = ['schema.js', 'hook.js', 'dom.js', 'features.js', 'ui.js', 'boot.js'].map(read).join('\n');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'yt-control.user.js'), header + '\n' + body);
// същият модул се вгражда и в Android приложението
const assets = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'dist', 'yt-control.user.js'), path.join(assets, 'yt-control.user.js'));
console.log('OK v' + version);
