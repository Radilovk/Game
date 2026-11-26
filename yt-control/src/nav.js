/*
 * YT Контрол – навигация и хедър:
 *   • бутон „‹ Назад“ върху видеото (вижда се на пауза и при докосване) – затваря клипа с една стъпка
 *   • плъзгане надолу в средата на видеото – клипът се отмества надолу и се затваря
 *   • подреден хедър: без „Отваряне на приложението“, бутон „‹“ извън началната страница, бутон за търсене
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  let S = {};
  const on = () => S.enabled && S.navButtons !== false;
  const player = () => document.querySelector('.html5-video-player');
  const video = () => document.querySelector('.html5-video-player video') || document.querySelector('video');
  const isWatch = () => location.pathname === '/watch';
  const NS = 'http://www.w3.org/2000/svg';
  function icon(d) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'currentColor');
    s.appendChild(p);
    return s;
  }
  const BACK = 'M15.4 4.6 14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12z';
  const SEARCH = 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z';

  // ======================================================== Една стъпка назад
  const watchUi = () => { const w = document.querySelector('ytm-watch, .watch-below-the-player'); return !!(w && w.getBoundingClientRect().height > 0); };
  YTC.navBack = function () {
    const v = video();
    if (isWatch() && v && !v.paused) { window.__ytcUserPaused = true; v.pause(); }
    const here = location.href;
    if (history.length > 1) history.back();
    setTimeout(() => {
      if (location.href === here) location.assign('/');                       // нямаше къде да се върне
      else if (!isWatch() && watchUi()) location.reload();                    // адресът се смени, но YouTube не прерисува
    }, 900);
  };

  // ======================================================== Стил
  const CSS = `
  .ytc-pback{position:fixed;left:8px;top:8px;z-index:2147483000;width:44px;height:44px;border:0;border-radius:50%;padding:0;
    background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;
    opacity:0;pointer-events:none;transition:opacity .2s;-webkit-tap-highlight-color:transparent}
  .ytc-pback.on{opacity:1;pointer-events:auto}
  .ytc-pback svg{width:28px;height:28px}
  .ytc-hbtn{flex:0 0 auto;width:40px;height:40px;border:0;border-radius:50%;padding:0;background:none;color:inherit;
    display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
  .ytc-hbtn:active{background:rgba(128,128,128,.25)}
  .ytc-hback{margin:0 2px 0 -6px}
  .ytc-hsearch{margin-left:auto}
  [data-ytc-upsell]{display:none!important}
  .ytc-sbar{position:fixed;left:0;right:0;top:0;z-index:2147483646;display:flex;gap:8px;align-items:center;
    padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:#0f0f0f;box-shadow:0 2px 10px rgba(0,0,0,.4)}
  .ytc-sbar.light{background:#fff}
  .ytc-sbar input{flex:1;min-width:0;border:0;border-radius:20px;padding:10px 14px;font:16px Roboto,-apple-system,sans-serif;outline:none;background:#272727;color:#f1f1f1}
  .ytc-sbar.light input{background:#f2f2f2;color:#0f0f0f}
  .ytc-sbar button{border:0;background:none;color:#3ea6ff;font:500 15px Roboto,-apple-system,sans-serif;padding:8px 4px}
  `;
  let styled = false;
  function style() {
    if (styled || !document.head) return;
    const st = document.createElement('style'); st.id = 'ytc-nav-css'; st.textContent = CSS;
    document.head.appendChild(st); styled = true;
  }

  // ======================================================== Бутон „Назад“ върху видеото
  // Отделен слой над плейъра (не вътре в него) – така плейърът на YouTube не поглъща докосването.
  // Вижда се заедно с контролите на YouTube (докосване на видеото), на пауза и в края.
  let pb = null, showUntil = 0, pressed = false;
  function controlsShown(p) {
    const ov = p.querySelector('#player-control-overlay, .player-controls-overlay');
    if (ov && /\bfadein\b/.test(ov.className)) return true;
    const btn = p.querySelector('.player-control-play-pause-icon, button.icon-button.player-control-play-pause-icon, .player-controls-middle button, .ytp-play-button');
    if (btn) {
      // видимостта е сборна: YouTube скрива контролите чрез някой от родителите (opacity / visibility / display)
      if (btn.getBoundingClientRect().width === 0) return false;
      let op = 1;
      for (let n = btn; n && n !== p.parentNode; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        op *= +cs.opacity;
      }
      return op > 0.4;
    }
    return null;   // не можем да разберем – разчитаме на таймера
  }
  function mountPlayerBack() {
    const p = player();
    if (!on() || !isWatch() || !p) { if (pb) pb.classList.remove('on'); return; }
    if (!pb || !pb.isConnected) {
      pb = document.createElement('button');
      pb.className = 'ytc-pback'; pb.type = 'button'; pb.setAttribute('aria-label', 'Назад');
      pb.appendChild(icon(BACK));
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); if (pressed) return; pressed = true; setTimeout(() => { pressed = false; }, 800); pb.classList.remove('on'); YTC.navBack(); };
      pb.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
      pb.addEventListener('touchend', fire);
      pb.addEventListener('click', fire);
      (document.body || document.documentElement).appendChild(pb);
    }
    const r = p.getBoundingClientRect();
    const v = video();
    const c = controlsShown(p);
    const show = r.bottom > 60 && r.top < innerHeight - 60 && !document.fullscreenElement && !document.querySelector('.ad-showing') &&
      (c === true || Date.now() < showUntil || (v && (v.ended || (v.paused && v.currentTime > 0 && c === null))));
    pb.style.left = Math.round(r.left + 8) + 'px';
    pb.style.top = Math.round(Math.max(r.top, 0) + 8) + 'px';
    pb.classList.toggle('on', !!show);
  }
  // докосване на видеото → бутонът се показва заедно с контролите (3 сек., ако не можем да ги следим)
  document.addEventListener('touchstart', (e) => {
    if (e.target && e.target.closest && e.target.closest('.html5-video-player')) { showUntil = Date.now() + 3000; setTimeout(mountPlayerBack, 0); setTimeout(mountPlayerBack, 350); }
  }, { capture: true, passive: true });
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.html5-video-player')) { showUntil = Date.now() + 3000; setTimeout(mountPlayerBack, 350); }
  }, true);
  ['pause', 'play', 'ended'].forEach((t) => document.addEventListener(t, () => setTimeout(mountPlayerBack, 30), true));
  window.addEventListener('scroll', () => { if (pb && pb.classList.contains('on')) mountPlayerBack(); }, { passive: true });

  // ======================================================== Плъзгане надолу = затваряне (вика се от жестовете)
  YTC.dragClose = {
    box() { const p = player(); return p ? (p.closest('#player-container-id, .player-container, ytm-player, #player') || p) : null; },
    move(dy, h) {
      const b = this.box(); if (!b) return;
      const y = Math.max(0, dy);
      b.style.transition = 'none';
      b.style.transform = 'translateY(' + Math.round(y * 0.7) + 'px) scale(' + Math.max(0.82, 1 - y / h * 0.18).toFixed(3) + ')';
      b.style.opacity = String(Math.max(0.35, 1 - y / (h * 1.6)));
      b.style.transformOrigin = '50% 0';
    },
    end(dy, h) {
      const b = this.box(); if (!b) return;
      const close = dy > h * 0.3;
      b.style.transition = 'transform .2s ease, opacity .2s ease';
      if (close) { b.style.transform = 'translateY(' + h + 'px) scale(.8)'; b.style.opacity = '0'; }
      else { b.style.transform = ''; b.style.opacity = ''; }
      setTimeout(() => { b.style.transition = ''; if (close) { b.style.transform = ''; b.style.opacity = ''; YTC.navBack(); } }, 210);
      return close;
    },
  };

  // ======================================================== Хедър
  const UPSELL = /^(Отваряне на приложението|Отвори приложението|Отваряне в приложението|Към приложението|Open app|Open App|Get the app|Use the app|Изтегли приложението)$/i;
  function hideUpsell(top) {
    let found = null;
    for (const n of top.querySelectorAll('button, a, [role="button"]')) {
      if (n.closest('.ytc-hbtn')) continue;
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const href = n.getAttribute && (n.getAttribute('href') || '');
      if (UPSELL.test(t) || /^(intent|vnd\.youtube|youtube):/i.test(href) || /open-app|app-upsell|app-promo/i.test(n.className && n.className.baseVal === undefined ? n.className : '')) {
        const box = n.closest('ytm-button-renderer, yt-button-view-model, button-view-model, ytm-topbar-menu-button-renderer') || n;
        if (!box.hasAttribute('data-ytc-upsell')) box.setAttribute('data-ytc-upsell', '1');
        found = found || box;
      }
    }
    return found;
  }
  function hasOwnSearch(top) {
    return [...top.querySelectorAll('button, a, [role="button"], ytm-search-box')].some((n) => {
      if (n.closest('.ytc-hbtn') || n.closest('[data-ytc-upsell]')) return false;
      const l = ((n.getAttribute && n.getAttribute('aria-label')) || '') + ' ' + (n.className && typeof n.className === 'string' ? n.className : '');
      return /търс|search/i.test(l) && n.getBoundingClientRect().width > 0;
    });
  }
  function header() {
    const top = document.querySelector('ytm-mobile-topbar-renderer');
    if (!top) return;
    if (!on()) {
      top.querySelectorAll('.ytc-hbtn').forEach((x) => x.remove());
      top.querySelectorAll('[data-ytc-upsell]').forEach((x) => x.removeAttribute('data-ytc-upsell'));
      return;
    }
    const upsell = hideUpsell(top);
    const logo = top.querySelector('ytm-home-logo, .mobile-topbar-header-endpoint');
    // „‹“ горе – само където няма видео (търсене, канал…); при клип е върху самото видео
    let hb = top.querySelector('.ytc-hback');
    if (location.pathname !== '/' && !isWatch() && logo) {
      if (!hb) {
        hb = document.createElement('button'); hb.type = 'button'; hb.className = 'ytc-hbtn ytc-hback'; hb.setAttribute('aria-label', 'Назад');
        hb.appendChild(icon(BACK));
        hb.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); YTC.navBack(); });
      }
      if (hb.nextSibling !== logo) logo.parentNode.insertBefore(hb, logo);
    } else if (hb) hb.remove();
    // търсене – само ако YouTube не е показал свое
    let sb = top.querySelector('.ytc-hsearch');
    if (!hasOwnSearch(top)) {
      if (!sb) {
        sb = document.createElement('button'); sb.type = 'button'; sb.className = 'ytc-hbtn ytc-hsearch'; sb.setAttribute('aria-label', 'Търсене');
        sb.appendChild(icon(SEARCH));
        sb.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openSearch(); });
      }
      const anchor = upsell || null;
      if (anchor && anchor.parentNode) { if (sb.nextSibling !== anchor) anchor.parentNode.insertBefore(sb, anchor); }
      else if (logo && !sb.isConnected) { const row = logo.parentNode; row.appendChild(sb); }
    } else if (sb) sb.remove();
  }

  // ======================================================== Търсене (наша лента)
  let sbar = null;
  function openSearch() {
    if (sbar) return;
    sbar = document.createElement('div');
    const dark = (() => { const c = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number); return c.length < 3 || (c[0] + c[1] + c[2]) < 384; })();
    sbar.className = 'ytc-sbar' + (dark ? '' : ' light');
    const back = document.createElement('button'); back.className = 'ytc-hbtn'; back.style.color = dark ? '#f1f1f1' : '#0f0f0f'; back.appendChild(icon(BACK));
    const inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = 'Търсене в YouTube'; inp.enterKeyHint = 'search';
    try { inp.value = new URLSearchParams(location.search).get('search_query') || ''; } catch (e) { /* */ }
    const go = document.createElement('button'); go.textContent = 'Търси';
    const close = () => { if (sbar) sbar.remove(); sbar = null; };
    const submit = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } close(); location.assign('/results?search_query=' + encodeURIComponent(q)); };
    back.addEventListener('click', close);
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') close(); });
    sbar.appendChild(back); sbar.appendChild(inp); sbar.appendChild(go);
    document.body.appendChild(sbar);
    setTimeout(() => inp.focus(), 50);
  }
  YTC.openSearch = openSearch;

  // ======================================================== Цикъл
  function tick() { if (!document.body) return; style(); header(); mountPlayerBack(); }
  YTC.navApply = (s) => { S = s; tick(); };
  setInterval(tick, 700);
  setInterval(() => { if (isWatch()) mountPlayerBack(); }, 250);
  window.addEventListener('popstate', () => setTimeout(tick, 50));
})();
