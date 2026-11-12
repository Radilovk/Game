/* YT Control – хранилище за браузърното разширение (Chrome / Edge / Firefox) */
(function () {
  'use strict';
  const api = globalThis.chrome && globalThis.chrome.storage ? globalThis.chrome : globalThis.browser;
  globalThis.YTC.start({
    load: () => new Promise((res) => api.storage.sync.get('ytc', (r) => res((r && r.ytc) || {}))),
    save: (s) => new Promise((res) => api.storage.sync.set({ ytc: s }, res)),
    onChange: (cb) => api.storage.onChanged.addListener((ch) => { if (ch.ytc && ch.ytc.newValue) cb(ch.ytc.newValue); }),
  });
})();
