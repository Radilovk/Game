(function () {
  const api = globalThis.chrome && globalThis.chrome.storage ? globalThis.chrome : globalThis.browser;
  const app = document.getElementById('app');
  api.storage.sync.get('ytc', (r) => {
    const s = YTC.normalize((r && r.ytc) || {});
    YTC.buildPanel(app, s, (ns) => api.storage.sync.set({ ytc: ns }));
  });
})();
