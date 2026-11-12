/* YT Контрол – интерфейс в стил мобилно приложение (bottom sheet). Без innerHTML заради Trusted Types. */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .fab{position:fixed;right:14px;bottom:calc(72px + env(safe-area-inset-bottom));width:46px;height:46px;border-radius:50%;
    border:0;background:#ff0033;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
    z-index:2147483646;opacity:.92;touch-action:manipulation}
  .fab svg{width:24px;height:24px;fill:#fff}
  .fab.off{background:#666}
  .back{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .25s;z-index:2147483646}
  .sheet{position:fixed;left:0;right:0;bottom:0;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
    background:#1c1c1e;color:#f2f2f7;border-radius:18px 18px 0 0;transform:translateY(100%);transition:transform .28s cubic-bezier(.2,.8,.2,1);
    z-index:2147483647;padding:0 16px calc(18px + env(safe-area-inset-bottom));
    font:15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",Roboto,"Segoe UI",sans-serif}
  .open .back{opacity:1}.open .sheet{transform:translateY(0)}
  .grab{width:38px;height:5px;border-radius:3px;background:#48484a;margin:8px auto 6px}
  .top{display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#1c1c1e;padding:4px 0 10px;z-index:2}
  .ttl{font-size:20px;font-weight:700}
  .x{border:0;background:#2c2c2e;color:#aeaeb2;width:30px;height:30px;border-radius:50%;font-size:18px;line-height:30px;padding:0}
  .status{display:flex;gap:10px;align-items:center;background:#2c2c2e;border-radius:12px;padding:12px}
  .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;background:#30d158;box-shadow:0 0 8px #30d158}
  .dot.warn{background:#ffd60a;box-shadow:0 0 8px #ffd60a}.dot.off{background:#8e8e93;box-shadow:none}
  .status b{display:block;font-size:15px}.status small{color:#aeaeb2;font-size:12px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
  .tile{background:#2c2c2e;border-radius:12px;padding:10px;text-align:center}
  .tile b{display:block;font-size:20px;color:#ff453a}.tile span{font-size:11px;color:#aeaeb2}
  .act{display:block;width:100%;margin-top:10px;border:0;border-radius:12px;padding:12px;background:#3a3a3c;color:#ff453a;font:inherit;font-weight:600}
  .grp{margin:18px 4px 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#8e8e93}
  .card{background:#2c2c2e;border-radius:12px;overflow:hidden}
  .row{display:flex;align-items:center;gap:12px;padding:11px 14px;min-height:48px}
  .row+.row{border-top:.5px solid #3a3a3c}
  .lbl{flex:1}.lbl small{display:block;color:#8e8e93;font-size:12px;margin-top:1px}
  .sw{position:relative;width:51px;height:31px;flex:0 0 auto}
  .sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;z-index:1}
  .sw i{position:absolute;inset:0;border-radius:16px;background:#39393d;transition:background .2s}
  .sw i:after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;
    box-shadow:0 2px 4px rgba(0,0,0,.3);transition:transform .2s}
  .sw input:checked+i{background:#30d158}.sw input:checked+i:after{transform:translateX(20px)}
  .col{flex-direction:column;align-items:stretch}
  textarea,input[type=number]{width:100%;margin-top:8px;background:#1c1c1e;color:#f2f2f7;border:1px solid #3a3a3c;border-radius:10px;
    padding:10px;font:16px/1.35 inherit}
  textarea{min-height:76px;resize:vertical}
  .note{display:none;margin-top:12px;background:#3a2f00;color:#ffd60a;border-radius:12px;padding:10px 12px;font-size:13px;align-items:center;gap:10px}
  .note.on{display:flex}.note span{flex:1}
  .note button{border:0;border-radius:8px;background:#ffd60a;color:#000;font:inherit;font-weight:600;padding:6px 10px}
  .foot{display:flex;justify-content:space-between;align-items:center;margin-top:18px;color:#636366;font-size:12px}
  .foot button{border:0;background:none;color:#0a84ff;font:inherit;font-size:14px;padding:6px 0}
  .disabled .card{opacity:.5}
  .toast{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translate(-50%,-20px);opacity:0;
    background:rgba(28,28,30,.96);color:#fff;padding:10px 16px;border-radius:20px;font:600 14px -apple-system,Roboto,sans-serif;
    box-shadow:0 4px 16px rgba(0,0,0,.4);transition:all .25s;z-index:2147483647;pointer-events:none;white-space:nowrap;
    display:flex;align-items:center;gap:12px;max-width:92vw}
  .toast.act{pointer-events:auto}
  .toast button{border:0;background:none;color:#0a84ff;font:700 14px inherit;padding:2px 0}
  .toast.on{opacity:1;transform:translate(-50%,0)}
  `;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function shieldIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z');
    svg.appendChild(p);
    return svg;
  }

  YTC.uiStart = function (getS, setS) {
    let host, root, fab, wrap, sheet, statsEls, statusEls, note, chanBtn, statTimer;

    function mount() {
      if (host && host.isConnected) return;
      if (!document.body) return;
      host = el('div'); host.id = 'ytc-app';
      root = host.attachShadow({ mode: 'open' });
      root.appendChild(el('style', null, CSS));
      fab = el('button', 'fab'); fab.setAttribute('aria-label', 'YT Контрол'); fab.appendChild(shieldIcon());
      fab.addEventListener('click', open);
      root.appendChild(fab);
      document.body.appendChild(host);
      refreshFab();
    }
    function refreshFab() {
      if (!fab) return;
      const S = getS();
      fab.style.display = S.showButton ? '' : 'none';
      fab.classList.toggle('off', !S.enabled);
    }

    function stats() {
      let d = {};
      try { d = JSON.parse(document.documentElement.getAttribute('data-ytc-stats') || '{}') || {}; } catch (e) { /* */ }
      const domHidden = document.querySelectorAll('[data-ytc-hidden="shorts"]').length;
      return { shorts: (d.shorts || 0) + domHidden, ads: (d.ads || 0) + (YTC.domStats ? YTC.domStats.ads : 0), filtered: d.filtered || 0 };
    }
    function currentChannel() {
      if (!/^\/watch/.test(location.pathname)) return null;
      const a = document.querySelector('ytm-slim-owner-renderer a[href*="/@"], .slim-owner-icon-and-title[href*="/@"], ytm-slim-video-metadata-section-renderer a[href*="/@"]');
      const m = a && (a.getAttribute('href') || '').match(/\/@([^/?#]+)/);
      return m ? '@' + decodeURIComponent(m[1]) : null;
    }
    function updateLive() {
      if (!statsEls) return;
      const S = getS(), st = stats();
      statsEls.shorts.textContent = st.shorts; statsEls.ads.textContent = st.ads; statsEls.filtered.textContent = st.filtered;
      const deep = document.documentElement.getAttribute('data-ytc-hook') === 'on';
      statusEls.dot.className = 'dot' + (!S.enabled ? ' off' : deep ? '' : ' warn');
      statusEls.b.textContent = !S.enabled ? 'Защитата е изключена' : deep ? 'Пълна защита' : 'Базова защита';
      statusEls.s.textContent = !S.enabled ? 'Включи я от най-долу' : deep
        ? 'Рекламите и Shorts се изрязват от данните, преди да се покажат'
        : 'Работи само скриването на страницата. Презареди, ако току-що си инсталирал.';
      const ch = currentChannel();
      chanBtn.style.display = ch ? '' : 'none';
      if (ch) chanBtn.textContent = '🚫 Блокирай канала ' + ch;
    }

    function build() {
      const S = getS();
      wrap = el('div', 'wrap');
      const back = el('div', 'back'); back.addEventListener('click', close);
      sheet = el('div', 'sheet' + (S.enabled ? '' : ' disabled'));
      sheet.appendChild(el('div', 'grab'));
      const top = el('div', 'top');
      top.appendChild(el('div', 'ttl', 'YT Контрол'));
      const x = el('button', 'x', '✕'); x.addEventListener('click', close); top.appendChild(x);
      sheet.appendChild(top);

      const status = el('div', 'status');
      statusEls = { dot: el('div', 'dot'), b: el('b'), s: el('small') };
      const st = el('div'); st.appendChild(statusEls.b); st.appendChild(statusEls.s);
      status.appendChild(statusEls.dot); status.appendChild(st);
      sheet.appendChild(status);

      const grid = el('div', 'stats');
      statsEls = {};
      for (const [k, label] of [['shorts', 'Shorts'], ['ads', 'Реклами'], ['filtered', 'Филтрирани']]) {
        const t = el('div', 'tile'); statsEls[k] = el('b', null, '0'); t.appendChild(statsEls[k]); t.appendChild(el('span', null, label));
        grid.appendChild(t);
      }
      sheet.appendChild(grid);

      chanBtn = el('button', 'act');
      chanBtn.addEventListener('click', () => {
        const ch = currentChannel(); if (!ch) return;
        const s = Object.assign({}, getS());
        const list = s.blockedChannels.split('\n').map((v) => v.trim()).filter(Boolean);
        if (!list.map((v) => v.toLowerCase()).includes(ch.toLowerCase())) list.push(ch);
        s.blockedChannels = list.join('\n');
        commit(s, true);
        rebuild();
      });
      sheet.appendChild(chanBtn);

      // само в Android приложението: линковете към YouTube да се отварят тук, а не в официалното приложение
      if (window.YTCApp && typeof window.YTCApp.openLinkSettings === 'function') {
        const lb = el('button', 'act', '🔗 Отваряй YouTube линковете в YT Контрол');
        lb.style.color = '#0a84ff';
        lb.addEventListener('click', () => { try { window.YTCApp.openLinkSettings(); } catch (e) { /* */ } });
        sheet.appendChild(lb);
      }

      note = el('div', 'note');
      note.appendChild(el('span', null, 'Някои промени важат напълно след презареждане.'));
      const rl = el('button', null, 'Презареди'); rl.addEventListener('click', () => location.reload());
      note.appendChild(rl);
      sheet.appendChild(note);

      let card = null, debounce;
      for (const f of YTC.SCHEMA) {
        if (f.group) { sheet.appendChild(el('div', 'grp', f.group)); card = el('div', 'card'); sheet.appendChild(card); continue; }
        const row = el('label', 'row' + (f.type ? ' col' : ''));
        const lbl = el('div', 'lbl', f.label);
        if (f.hint) lbl.appendChild(el('small', null, f.hint));
        row.appendChild(lbl);
        if (f.type) {
          const inp = el(f.type === 'text' ? 'textarea' : 'input');
          if (f.type === 'number') { inp.type = 'number'; inp.min = '0'; inp.inputMode = 'numeric'; }
          if (f.type === 'text') { inp.autocapitalize = 'off'; inp.spellcheck = false; }
          inp.value = String(S[f.key]);
          inp.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
              const s = Object.assign({}, getS());
              s[f.key] = f.type === 'number' ? Math.max(0, Number(inp.value) || 0) : inp.value;
              commit(s, true);
            }, 450);
          });
          row.appendChild(inp);
        } else {
          const sw = el('span', 'sw'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S[f.key];
          cb.addEventListener('change', () => {
            const s = Object.assign({}, getS()); s[f.key] = cb.checked;
            commit(s, f.key !== 'showButton');
            sheet.classList.toggle('disabled', !s.enabled);
          });
          sw.appendChild(cb); sw.appendChild(el('i')); row.appendChild(sw);
        }
        card.appendChild(row);
      }

      const foot = el('div', 'foot');
      foot.appendChild(el('span', null, 'v' + YTC.VERSION));
      const reset = el('button', null, 'По подразбиране');
      reset.addEventListener('click', () => { if (confirm('Да се върнат ли настройките по подразбиране?')) { commit(YTC.defaults(), true); rebuild(); } });
      foot.appendChild(reset);
      sheet.appendChild(foot);

      wrap.appendChild(back); wrap.appendChild(sheet);
      root.appendChild(wrap);
      updateLive();
    }
    function commit(s, needsReload) {
      setS(s);
      refreshFab();
      if (needsReload && note) note.classList.add('on');
      updateLive();
    }
    function rebuild() { const wasOpen = !!wrap; if (wrap) wrap.remove(); wrap = null; if (wasOpen) { build(); wrap.classList.add('open'); } }

    let prevOverflow = '';
    function open() {
      mount();
      if (wrap) wrap.remove();
      build();
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => requestAnimationFrame(() => wrap && wrap.classList.add('open')));
      clearInterval(statTimer); statTimer = setInterval(updateLive, 1000);
    }
    function close() {
      if (!wrap) return;
      wrap.classList.remove('open');
      document.body.style.overflow = prevOverflow;
      clearInterval(statTimer);
      const w = wrap; wrap = null; statsEls = null;
      setTimeout(() => w.remove(), 300);
    }
    YTC.openPanel = open;

    let toastEl, toastTimer;
    YTC.toast = function (msg, action, fn) {
      mount();
      if (!root) return;
      if (!toastEl) { toastEl = el('div', 'toast'); root.appendChild(toastEl); }
      while (toastEl.firstChild) toastEl.removeChild(toastEl.firstChild);
      toastEl.appendChild(el('span', null, /^[\u{1F300}-\u{1FAFF}\u2600-\u27BF▶⏭⏾✓]/u.test(msg) ? msg : '🚫 ' + msg));
      toastEl.classList.toggle('act', !!action);
      if (action) {
        const b = el('button', null, action);
        b.addEventListener('click', () => { toastEl.classList.remove('on'); try { fn(); } catch (e) { /* */ } });
        toastEl.appendChild(b);
      }
      requestAnimationFrame(() => toastEl.classList.add('on'));
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), action ? 4500 : 2200);
    };
    const pendingToast = () => {
      try { if (sessionStorage.getItem('ytc-toast')) { sessionStorage.removeItem('ytc-toast'); setTimeout(() => YTC.toast('Shorts е блокиран'), 600); } } catch (e) { /* */ }
    };
    if (document.body) pendingToast(); else document.addEventListener('DOMContentLoaded', pendingToast);

    // Задържане върху логото на YouTube (или двоен тап на бутона) отваря панела – работи и при скрит бутон
    let pressTimer = 0;
    document.addEventListener('touchstart', (e) => {
      const t = e.target && e.target.closest && e.target.closest('ytm-home-logo, .mobile-topbar-header-endpoint');
      if (!t) return;
      pressTimer = setTimeout(() => { pressTimer = 0; open(); }, 650);
    }, { passive: true, capture: true });
    const cancel = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; } };
    document.addEventListener('touchend', cancel, true);
    document.addEventListener('touchmove', cancel, true);
    if (location.hash === '#ytc') setTimeout(open, 800);

    YTC.onPass = mount;
    YTC.uiRefresh = refreshFab;
  };
})();
