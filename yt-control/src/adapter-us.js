/* YT Control – хранилище за userscript (Tampermonkey / Violentmonkey / Userscripts за Safari) */
(function () {
  'use strict';
  const hasGM = typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function';
  const hasGM_ = typeof GM_getValue === 'function';
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return null; } };
  globalThis.YTC.start({
    load: async () => {
      try {
        if (hasGM) return parse(await GM.getValue('ytc', null)) || {};
        if (hasGM_) return parse(GM_getValue('ytc', null)) || {};
      } catch (e) { /* ignore */ }
      return {};
    },
    save: async (s) => {
      const v = JSON.stringify(s);
      try { if (hasGM) await GM.setValue('ytc', v); else if (hasGM_) GM_setValue('ytc', v); } catch (e) { /* ignore */ }
    },
    onChange: (cb) => {
      if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('ytc', (k, o, n, remote) => { if (remote) { const v = parse(n); if (v) cb(v); } });
      }
    },
  });
})();
