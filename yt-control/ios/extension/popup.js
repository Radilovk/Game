(function () {
  const api = globalThis.browser || globalThis.chrome;
  const go = (url) => {
    try { api.tabs.update({ url }); } catch (e) { try { api.tabs.create({ url }); } catch (x) { /* */ } }
    window.close();
  };
  document.getElementById('open').addEventListener('click', () => go('https://m.youtube.com/'));
  // #ytc отваря панела с настройки на модула
  document.getElementById('settings').addEventListener('click', () => go('https://m.youtube.com/#ytc'));
})();
