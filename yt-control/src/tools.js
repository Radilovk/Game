/*
 * YT Контрол – инструменти при гледане:
 *   • история на гледане с позиция – видеото продължава оттам, докъдето си стигнал
 *   • скорост на възпроизвеждане (0.25×–3×), запомня се
 *   • таймер за сън (след N минути или в края на видеото) – с плавно затихване
 *   • повторение на видеото
 *   • SponsorBlock – прескача спонсорските части вътре в клиповете (данни от общността)
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  let S = {};
  YTC.toolsApply = (s) => { S = s; tick(); };

  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  const toast = (msg, action, fn) => { if (YTC.toast) YTC.toast(msg, action, fn); };
  const curVideo = () => location.pathname === '/watch' ? (location.search.match(/[?&]v=([\w-]{6,})/) || [])[1] : null;
  const video = () => document.querySelector('.html5-video-player video') || document.querySelector('video');
  const inAd = () => !!document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');

  // ======================================================== История с позиция
  const H_KEY = 'ytc-history';
  const history = {
    all() { return LS.get(H_KEY, []); },
    get(id) { return this.all().find((x) => x.id === id) || null; },
    upsert(o) {
      const a = this.all();
      const i = a.findIndex((x) => x.id === o.id);
      const prev = i >= 0 ? a.splice(i, 1)[0] : {};
      a.unshift(Object.assign(prev, o));
      LS.set(H_KEY, a.slice(0, 300));
    },
    remove(id) { LS.set(H_KEY, this.all().filter((x) => x.id !== id)); },
    clear() { LS.set(H_KEY, []); },
  };
  YTC.history = history;

  function pageTitle() {
    const t = document.querySelector('ytm-slim-video-information-renderer h2, .slim-video-information-title, ytm-watch h2');
    const s = (t && t.textContent.trim()) || document.title.replace(/\s*-\s*YouTube\s*$/, '');
    return s.split('\n')[0].trim();
  }
  function pageChannel() {
    const c = document.querySelector('ytm-slim-owner-renderer .slim-owner-channel-name, ytm-slim-owner-renderer h3, .slim-owner-icon-and-title');
    return c ? c.textContent.trim().split('\n')[0] : '';
  }

  // ======================================================== Скорост
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  YTC.desiredSpeed = () => { const r = +LS.get('ytc-speed', 1); return r > 0 && r <= 4 ? r : 1; };
  function setSpeed(r) {
    LS.set('ytc-speed', r);
    const v = video();
    if (v && !inAd()) v.playbackRate = r;
    updateButton();
  }

  // ======================================================== Таймер за сън
  const sleep = { mode: 'off', until: 0, stopNextUntil: 0 };
  function setSleep(mode, minutes) {
    sleep.mode = mode;
    sleep.until = mode === 'min' ? Date.now() + minutes * 60e3 : 0;
    updateButton();
    if (mode === 'min') toast('⏾ Таймер за сън: ' + minutes + ' мин');
    if (mode === 'end') toast('⏾ Спира в края на видеото');
  }
  function fadeAndPause(v) {
    const vol = v.volume;
    let i = 0;
    const t = setInterval(() => {
      i++;
      v.volume = Math.max(0, vol * (1 - i / 12));
      if (i >= 12) { clearInterval(t); v.pause(); v.volume = vol; toast('⏾ Таймерът за сън спря видеото'); }
    }, 500);
  }

  // ======================================================== Повторение
  let loopOn = false;

  // ======================================================== SponsorBlock
  const SB_CATS = { sponsor: 'спонсор', selfpromo: 'самореклама', interaction: 'напомняне за абониране' };
  const sb = { id: null, segs: [], skipped: new Set(), count: 0 };
  async function loadSponsor(id) {
    sb.id = id; sb.segs = []; sb.skipped = new Set();
    if (!S.sponsorBlock || !window.crypto || !crypto.subtle) return;
    try {
      // поверителност: изпраща се само началото на хеша – сървърът връща видеа с такова начало, ние избираме нашето
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
      const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const url = 'https://sponsor.ajay.app/api/skipSegments/' + hex.slice(0, 4) + '?categories=' + encodeURIComponent(JSON.stringify(Object.keys(SB_CATS)));
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) return;
      const list = await r.json();
      const mine = Array.isArray(list) && list.find((x) => x.videoID === id);
      if (mine && sb.id === id) sb.segs = (mine.segments || []).filter((s) => s.actionType === 'skip' && Array.isArray(s.segment));
    } catch (e) { /* без връзка – просто няма прескачане */ }
  }
  function checkSponsor(v) {
    if (!S.sponsorBlock || !sb.segs.length) return;
    const t = v.currentTime;
    for (const s of sb.segs) {
      const [a, b] = s.segment;
      if (t >= a && t < b - 0.4 && !sb.skipped.has(s.UUID)) {
        sb.skipped.add(s.UUID);
        v.currentTime = b;
        sb.count++;
        toast('⏭ Прескочено: ' + (SB_CATS[s.category] || s.category) + ' (' + Math.round(b - a) + ' сек)', 'Върни', () => { v.currentTime = a; });
        return;
      }
    }
  }

  // ======================================================== Основен цикъл за текущото видео
  let curId = null, resumed = new Set(), speedSet = new Set(), lastSave = 0, invalidated = new Set();
  function onNewVideo(id) {
    curId = id;
    loopOn = false;
    loadSponsor(id);
  }
  function tick() {
    if (!S.enabled) return;
    const id = curVideo();
    if (id !== curId) { if (id) onNewVideo(id); else curId = null; }
    mountButton();
    const v = video();
    if (!id || !v || inAd()) return;

    // таймер за сън – "в края на видеото": не позволяваме автоматичното следващо видео
    if (sleep.stopNextUntil && Date.now() < sleep.stopNextUntil && !v.paused && v.currentTime > 0.5) { v.pause(); sleep.stopNextUntil = 0; }
    if (sleep.mode === 'min' && Date.now() >= sleep.until) { sleep.mode = 'off'; updateButton(); fadeAndPause(v); }
    if (sleep.mode === 'end' && isFinite(v.duration) && v.duration - v.currentTime < 1.2 && !v.paused) {
      sleep.mode = 'off'; v.pause(); sleep.stopNextUntil = Date.now() + 20000; updateButton(); toast('⏾ Таймерът за сън спря в края на видеото');
    }

    if (!isFinite(v.duration) || v.duration <= 0) return;
    if (v.loop !== loopOn) v.loop = loopOn;
    // скорост за всяко ново видео (YouTube я връща на 1× при зареждане)
    if (!speedSet.has(id) && v.currentTime > 0) {
      speedSet.add(id);
      const r = YTC.desiredSpeed();
      if (r !== 1 && Math.abs(v.playbackRate - r) > 0.01) v.playbackRate = r;
    }
    // продължаване оттам, докъдето е стигнато
    if (S.resumePlayback !== false && !resumed.has(id)) {
      resumed.add(id);
      const h = history.get(id);
      const hasT = /[?&](t|start)=/.test(location.search);
      if (h && !hasT && !h.done && h.pos > 15 && v.currentTime < 10 && h.pos < v.duration - 20) {
        v.currentTime = h.pos;
        toast('▶ Продължава от ' + fmt(h.pos), 'От начало', () => { v.currentTime = 0; });
      }
    }
    checkSponsor(v);
    // запис в историята (на всеки 5 сек)
    if (S.saveHistory !== false && v.currentTime > 3 && Date.now() - lastSave > 5000) {
      lastSave = Date.now();
      const done = v.currentTime > v.duration - 20;
      history.upsert({ id, title: pageTitle(), channel: pageChannel(), len: Math.round(v.duration), pos: done ? 0 : Math.round(v.currentTime), done, t: Date.now() });
      if (!invalidated.has(id)) { invalidated.add(id); LS.set('ytc-feed', null); } // предложенията се опресняват с новото
    }
  }
  YTC.toolsTick = tick;
  setInterval(tick, 1000);
  document.addEventListener('timeupdate', () => { const v = video(); if (v && !inAd() && sb.segs.length) checkSponsor(v); }, true);
  document.addEventListener('ratechange', () => updateButton(), true);

  // ======================================================== Бутон и лист "Инструменти"
  let host = null, root = null;
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .tb{position:fixed;right:16px;bottom:calc(176px + env(safe-area-inset-bottom));min-width:40px;height:40px;padding:0 8px;border-radius:20px;border:0;
    background:rgba(28,28,30,.92);color:#fff;font:700 13px -apple-system,Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.35);z-index:2147483645}
  .tb.act{background:#ff0033}
  .back{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646}
  .sheet{position:fixed;left:0;right:0;bottom:0;background:#1c1c1e;color:#f2f2f7;border-radius:18px 18px 0 0;max-height:85vh;overflow-y:auto;
    padding:14px 16px calc(18px + env(safe-area-inset-bottom));z-index:2147483647;font:15px/1.35 -apple-system,Roboto,"Segoe UI",sans-serif}
  h3{margin:2px 4px 12px;font-size:18px}
  .lbl{margin:14px 4px 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#8e8e93}
  .grid{display:flex;flex-wrap:wrap;gap:8px}
  .c{border:0;border-radius:10px;background:#2c2c2e;color:#f2f2f7;font:600 15px inherit;padding:10px 0;flex:1 0 calc(20% - 8px)}
  .c.on{background:#ff0033;color:#fff}
  .row{display:flex;align-items:center;justify-content:space-between;background:#2c2c2e;border-radius:12px;padding:12px 14px;margin-top:8px}
  .row small{display:block;color:#8e8e93;font-size:12px}
  .sw{position:relative;width:51px;height:31px;flex:0 0 auto}
  .sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;z-index:1}
  .sw i{position:absolute;inset:0;border-radius:16px;background:#39393d;transition:background .2s}
  .sw i:after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;transition:transform .2s}
  .sw input:checked+i{background:#30d158}.sw input:checked+i:after{transform:translateX(20px)}
  .info{margin:12px 4px 0;color:#8e8e93;font-size:13px}
  `;
  const speedLabel = (r) => (Math.round(r * 100) / 100) + '×';
  function mountButton() {
    const want = S.enabled && S.toolsButton !== false && location.pathname === '/watch';
    if (!want) { if (host) { host.remove(); host = null; root = null; } return; }
    if (host && host.isConnected) return;
    if (!document.body) return;
    host = el('div'); host.id = 'ytc-tools';
    root = host.attachShadow({ mode: 'open' });
    root.appendChild(el('style', null, CSS));
    const b = el('button', 'tb');
    b.setAttribute('aria-label', 'Инструменти: скорост, таймер, повторение');
    b.addEventListener('click', openSheet);
    root.appendChild(b);
    document.body.appendChild(host);
    updateButton();
  }
  function updateButton() {
    if (!root) return;
    const b = root.querySelector('.tb');
    if (!b) return;
    const r = YTC.desiredSpeed();
    const v = video();
    const live = v && !inAd() ? v.playbackRate : r;
    let t = speedLabel(live || r);
    if (sleep.mode === 'min') t = '⏾ ' + Math.max(1, Math.ceil((sleep.until - Date.now()) / 60e3)) + '′ · ' + t;
    else if (sleep.mode === 'end') t = '⏾ · ' + t;
    if (loopOn) t = '🔁 ' + t;
    b.textContent = t;
    b.classList.toggle('act', sleep.mode !== 'off' || loopOn || Math.abs((live || 1) - 1) > 0.01);
  }
  setInterval(() => { if (sleep.mode === 'min') updateButton(); }, 20000);

  function sw(checked, onChange) {
    const s = el('label', 'sw'); const c = el('input'); c.type = 'checkbox'; c.checked = checked;
    c.addEventListener('change', () => onChange(c.checked));
    s.appendChild(c); s.appendChild(el('i')); return s;
  }
  function openSheet() {
    const back = el('div', 'back');
    const sh = el('div', 'sheet');
    const close = () => { back.remove(); sh.remove(); };
    back.addEventListener('click', close);
    sh.appendChild(el('h3', null, 'Инструменти'));

    sh.appendChild(el('div', 'lbl', 'Скорост'));
    const g = el('div', 'grid');
    const cur = YTC.desiredSpeed();
    for (const r of SPEEDS) {
      const c = el('button', 'c' + (Math.abs(r - cur) < 0.01 ? ' on' : ''), speedLabel(r));
      c.addEventListener('click', () => { setSpeed(r); g.querySelectorAll('.c').forEach((x) => x.classList.toggle('on', x === c)); });
      g.appendChild(c);
    }
    sh.appendChild(g);

    sh.appendChild(el('div', 'lbl', 'Таймер за сън'));
    const g2 = el('div', 'grid');
    const opts = [['off', 0, 'Изкл.'], ['min', 15, '15 мин'], ['min', 30, '30 мин'], ['min', 45, '45 мин'], ['min', 60, '1 час'], ['min', 90, '1,5 ч'], ['end', 0, 'Край на видеото']];
    for (const [m, n, l] of opts) {
      const on = sleep.mode === m && (m !== 'min' || Math.abs((sleep.until - Date.now()) / 60e3 - n) < 1);
      const c = el('button', 'c' + (on || (m === 'off' && sleep.mode === 'off') ? ' on' : ''), l);
      c.style.flexBasis = m === 'end' ? '100%' : 'calc(25% - 8px)';
      c.addEventListener('click', () => { setSleep(m, n); g2.querySelectorAll('.c').forEach((x) => x.classList.toggle('on', x === c)); });
      g2.appendChild(c);
    }
    sh.appendChild(g2);

    const loopRow = el('div', 'row');
    const lt = el('div', null, 'Повтаряй това видео'); lt.appendChild(el('small', null, 'Безкрайно, докато го изключиш'));
    loopRow.appendChild(lt);
    loopRow.appendChild(sw(loopOn, (on) => { loopOn = on; const v = video(); if (v) v.loop = on; updateButton(); }));
    sh.appendChild(loopRow);

    const sbRow = el('div', 'row');
    const st = el('div', null, 'Прескачай спонсорските части');
    st.appendChild(el('small', null, sb.segs.length ? ('В това видео: ' + sb.segs.length + ' ' + (sb.segs.length === 1 ? 'част' : 'части')) : 'Данни от общността SponsorBlock'));
    sbRow.appendChild(st);
    sbRow.appendChild(sw(!!S.sponsorBlock, (on) => {
      const ns = Object.assign({}, S, { sponsorBlock: on });
      if (YTC.saveSettings) YTC.saveSettings(ns);
      if (on && curId) loadSponsor(curId);
    }));
    sh.appendChild(sbRow);

    const h = curId && history.get(curId);
    if (h && h.pos > 15 && !h.done) sh.appendChild(el('div', 'info', 'Последно спря на ' + fmt(h.pos) + '.'));
    root.appendChild(back); root.appendChild(sh);
  }
})();
