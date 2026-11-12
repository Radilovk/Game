/* YT Контрол – старт. Работи и когато мениджърът пуска скрипта в "content" света (Safari/Userscripts),
   и когато го пуска директно в страницата (Tampermonkey). */
(function () {
  'use strict';
  const YTC = globalThis.YTC;
  if (window.top !== window || window.__ytcBoot) return;
  window.__ytcBoot = true;

  // ---- 1) Слой "данни": трябва да влезе в самата страница преди скриптовете на YouTube ----
  // Ако вече сме в страницата – това е достатъчно. Ако сме в изолиран свят – безвредно.
  try { YTC.pageHook(); } catch (e) { /* */ }

  // m.youtube.com има CSP с nonce + Trusted Types. Затова взимаме nonce от първия скрипт на страницата
  // и подаваме кода през собствена Trusted Types политика – така браузърът го допуска.
  const code = '(' + YTC.pageHook.toString() + ')();';
  let done = false;
  function inject(nonce) {
    if (done) return; done = true;
    try {
      const s = document.createElement('script');
      if (nonce) { s.nonce = nonce; s.setAttribute('nonce', nonce); }
      let payload = code;
      try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          payload = window.trustedTypes.createPolicy('ytc' + Math.random().toString(36).slice(2, 8), { createScript: (x) => x }).createScript(code);
        }
      } catch (e) { payload = code; }
      s.textContent = payload;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) { /* */ }
  }
  const findNonce = () => { const n = document.querySelector('script[nonce]'); return n ? (n.nonce || n.getAttribute('nonce')) : null; };
  const n0 = document.documentElement && findNonce();
  if (n0) inject(n0);
  else {
    const mo = new MutationObserver(() => { const n = findNonce(); if (n) { mo.disconnect(); inject(n); } });
    mo.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { mo.disconnect(); inject(findNonce()); });
  }

  // Опит за отваряне на Short е спрян в страницата. Ако YouTube все пак е почнал да рисува плейъра – връщаме страницата.
  document.addEventListener('ytc-shorts-blocked', () => {
    if (YTC.toast) YTC.toast('Shorts е блокиран');
    setTimeout(() => {
      if (document.querySelector('ytm-shorts-player, ytm-reel-watch-player, shorts-video, ytm-reel-player-overlay-renderer')) location.reload();
    }, 400);
  });

  // ---- 2) Слой "DOM" + интерфейс ----
  let S = YTC.load();
  YTC.domStart(S);
  YTC.uiStart(() => S, (ns) => {
    S = YTC.normalize(ns);
    YTC.save(S);
    YTC.domApply(S);
  });
})();
