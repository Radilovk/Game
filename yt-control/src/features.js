/*
 * YT Контрол – допълнителни функции:
 *   • начална страница с предложения (по историята на гледане и по интереси)
 *   • дата на качване навсякъде (вкл. препоръките под видеото, където YouTube не я дава)
 *   • изтегляне на надписи (SRT / текст), вкл. автоматичен превод на български
 *   • докладване на възпроизвеждането към Android приложението (фоново слушане, известие)
 * Работи и в "content" света (Safari), и директно в страницата (Android приложението).
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
  };
  const H_KEY = 'ytc-history', I_KEY = 'ytc-interests', F_KEY = 'ytc-feed', D_KEY = 'ytc-dates';
  const INTERESTS = ['Музика', 'Наука', 'Технологии', 'Игри', 'Футбол', 'Спорт', 'Готвене', 'Пътувания', 'Новини', 'Филми',
    'Комедия', 'Образование', 'История', 'Природа', 'Животни', 'Коли', 'Фитнес', 'Подкасти', 'Направи си сам', 'Финанси'];
  let S = {};
  YTC.featuresApply = (s) => { S = s; refresh(); };

  // ======================================================== InnerTube (API-то, което ползва и сайтът)
  const cfgCache = {};
  function cfg(key) {
    if (key in cfgCache) return cfgCache[key];
    const re = new RegExp('"' + key + '":"([^"]+)"');
    for (const sc of document.scripts) {
      const t = sc.textContent;
      if (t && t.length < 3e6) { const m = t.match(re); if (m) return (cfgCache[key] = m[1]); }
    }
    return null;
  }
  function client(kind) {
    const mweb = cfg('INNERTUBE_CLIENT_VERSION') || '2.20261110.07.00';
    const day = (mweb.match(/^2\.(\d{8})/) || [])[1] || '20261110';
    const c = kind === 'WEB'
      ? { clientName: 'WEB', clientVersion: '2.' + day + '.01.00' }
      : { clientName: 'MWEB', clientVersion: mweb };
    c.hl = cfg('HL') || document.documentElement.lang || 'bg';
    c.gl = cfg('GL') || 'BG';
    const vd = cfg('VISITOR_DATA');
    if (vd) c.visitorData = vd;
    return c;
  }
  function api(endpoint, body, kind) {
    return fetch('/youtubei/v1/' + endpoint + '?prettyPrint=false', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ context: { client: client(kind) } }, body)),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }

  // ======================================================== Видеа от отговорите (нормализирани)
  const txt = (t) => !t ? '' : typeof t === 'string' ? t : t.simpleText || t.content ||
    (Array.isArray(t.runs) ? t.runs.map((r) => r.text || '').join('') : '');
  const lastUrl = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1].url : '') || '';
  const isDateText = (t) => /(преди|ago|^\d{1,2}\s\w+\.?\s\d{4}|стрийм|streamed|излъчено)/i.test(t || '');

  function fromLockup(v) {
    if (!v || v.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO' || !v.contentId) return null;
    const md = (v.metadata && v.metadata.lockupMetadataViewModel) || {};
    const rows = (md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows) || [];
    const parts = [];
    for (const r of rows) for (const p of (r.metadataParts || [])) { const t = txt(p.text); if (t) parts.push(t); }
    const ti = (v.contentImage && v.contentImage.thumbnailViewModel) || {};
    let dur = '', live = false;
    for (const o of (ti.overlays || [])) {
      const bs = (o.thumbnailBottomOverlayViewModel && o.thumbnailBottomOverlayViewModel.badges) ||
        (o.thumbnailOverlayBadgeViewModel && o.thumbnailOverlayBadgeViewModel.thumbnailBadges) || [];
      for (const b of bs) { const bv = b.thumbnailBadgeViewModel; if (bv) { if (/LIVE/.test(bv.badgeStyle || '')) live = true; else dur = dur || bv.text || ''; } }
    }
    if (/SHORTS/i.test(JSON.stringify(ti.overlays || []).slice(0, 2000)) && !dur) return null;
    return {
      id: v.contentId, title: txt(md.title), channel: parts[0] || '', handle: '',
      views: parts.find((p) => /показв|views|гледа/i.test(p)) || '', date: parts.find(isDateText) || '',
      dur, live, thumb: lastUrl(ti.image && ti.image.sources),
    };
  }
  function fromVideo(v) {
    if (!v || !v.videoId) return null;
    const ep = v.navigationEndpoint || {};
    if (ep.reelWatchEndpoint) return null; // Short
    const overlays = v.thumbnailOverlays || [];
    if (overlays.some((o) => o.thumbnailOverlayTimeStatusRenderer && o.thumbnailOverlayTimeStatusRenderer.style === 'SHORTS')) return null;
    const by = v.shortBylineText || v.longBylineText || v.ownerText;
    const run = by && by.runs && by.runs[0];
    const be = run && run.navigationEndpoint && run.navigationEndpoint.browseEndpoint;
    let dur = txt(v.lengthText);
    const ts = overlays.find((o) => o.thumbnailOverlayTimeStatusRenderer);
    if (!dur && ts) dur = txt(ts.thumbnailOverlayTimeStatusRenderer.text);
    const live = !!(ts && ts.thumbnailOverlayTimeStatusRenderer.style === 'LIVE') ||
      (v.badges || []).some((b) => b.metadataBadgeRenderer && /LIVE/.test(b.metadataBadgeRenderer.style || ''));
    return {
      id: v.videoId, title: txt(v.headline) || txt(v.title), channel: txt(by),
      handle: be && be.canonicalBaseUrl ? decodeURIComponent(be.canonicalBaseUrl).replace(/^\/@?/, '') : '',
      views: txt(v.shortViewCountText) || txt(v.viewCountText), date: txt(v.publishedTimeText),
      dur, live, thumb: lastUrl(v.thumbnail && v.thumbnail.thumbnails),
    };
  }
  function collect(resp) {
    const out = [];
    const walk = (o, d) => {
      if (!o || typeof o !== 'object' || d > 40) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
      for (const k in o) {
        const v = o[k];
        if (k === 'lockupViewModel') { const it = fromLockup(v); if (it) out.push(it); continue; }
        if (k === 'videoWithContextRenderer' || k === 'compactVideoRenderer' || k === 'videoRenderer' || k === 'gridVideoRenderer') {
          const it = fromVideo(v); if (it) out.push(it); continue;
        }
        if (v && typeof v === 'object' && k !== 'responseContext' && k !== 'frameworkUpdates') walk(v, d + 1);
      }
    };
    walk(resp, 0);
    return out;
  }

  // ======================================================== Филтри (същите като в настройките)
  const lines = (t) => String(t || '').split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  function allowed(it, watched) {
    if (!it.title) return false;
    if (S.hideLive && it.live) return false;
    if (S.hideWatched && watched.has(it.id)) return false;
    const m = (it.dur || '').match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    const sec = m ? (+(m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) : null;
    if (sec != null && sec <= 60 && S.blockShorts) return false; // вертикални клипчета под минута
    if (S.minDuration > 0 && sec != null && sec < S.minDuration * 60) return false;
    const t = it.title.toLowerCase();
    if (lines(S.blockedWords).some((w) => t.includes(w))) return false;
    const ch = lines(S.blockedChannels).map((x) => { const mm = x.match(/@([^/?#\s]+)/); return mm ? mm[1] : x; });
    if (ch.length && (ch.includes((it.channel || '').toLowerCase()) || (it.handle && ch.includes(it.handle.toLowerCase())))) return false;
    return true;
  }

  // ======================================================== История на гледане
  let lastRecorded = '';
  function recordHistory() {
    const m = location.pathname === '/watch' && location.search.match(/[?&]v=([\w-]{6,})/);
    if (!m || m[1] === lastRecorded) return;
    const id = m[1];
    setTimeout(() => {
      if (!location.search.includes(id)) return;
      lastRecorded = id;
      const title = document.title.replace(/\s*-\s*YouTube\s*$/, '');
      const h = LS.get(H_KEY, []).filter((x) => x.id !== id);
      h.unshift({ id, title, t: Date.now() });
      LS.set(H_KEY, h.slice(0, 80));
      LS.set(F_KEY, null); // предложенията ще се обновят с новото гледане
    }, 8000);
  }

  // ======================================================== Начална страница с предложения
  let feedHost = null, feedRoot = null, feedList = null, feedState = { items: [], seen: new Set(), seeds: [], loading: false, done: false };

  const FEED_CSS = `
  :host{all:initial}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .wrap{position:fixed;left:0;right:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
    font:14px/1.35 Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:3}
  .dark{background:#0f0f0f;color:#f1f1f1}.light{background:#fff;color:#0f0f0f}
  .chips{display:flex;gap:8px;overflow-x:auto;padding:10px 12px;position:sticky;top:0;z-index:2;scrollbar-width:none}
  .dark .chips{background:#0f0f0f}.light .chips{background:#fff}
  .chips::-webkit-scrollbar{display:none}
  .chip{flex:0 0 auto;border:0;border-radius:8px;padding:7px 12px;font:500 14px inherit;white-space:nowrap}
  .dark .chip{background:#272727;color:#f1f1f1}.light .chip{background:#f2f2f2;color:#0f0f0f}
  .dark .chip.on{background:#f1f1f1;color:#0f0f0f}.light .chip.on{background:#0f0f0f;color:#fff}
  .card{display:block;text-decoration:none;color:inherit;margin-bottom:16px}
  .th{position:relative;aspect-ratio:16/9;background:#222;overflow:hidden}
  .th img{width:100%;height:100%;object-fit:cover;display:block}
  .dur{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.8);color:#fff;font:500 12px inherit;padding:1px 5px;border-radius:4px}
  .dur.live{background:#cc0000}
  .meta{padding:10px 12px 0}
  .tt{font-size:15px;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .sub{margin-top:4px;font-size:12.5px}
  .dark .sub{color:#aaa}.light .sub{color:#606060}
  .msg{padding:40px 24px;text-align:center}
  .msg h2{font-size:20px;margin:0 0 8px}
  .msg p{margin:0 0 16px;opacity:.75}
  .pick{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0 18px}
  .go{border:0;border-radius:20px;background:#ff0033;color:#fff;font:600 15px inherit;padding:11px 22px}
  .go:disabled{opacity:.4}
  .more{padding:18px;text-align:center;opacity:.6}
  .sk{height:0;padding-bottom:56.25%;background:linear-gradient(90deg,#1f1f1f,#2a2a2a,#1f1f1f);background-size:200% 100%;animation:sh 1.2s infinite;margin-bottom:60px}
  .light .sk{background:linear-gradient(90deg,#eee,#f6f6f6,#eee);background-size:200% 100%}
  @keyframes sh{to{background-position:-200% 0}}
  @media(min-width:700px){.list{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;padding:0 12px}.th{border-radius:12px}}
  `;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const isDark = () => {
    for (const n of [document.querySelector('ytm-mobile-topbar-renderer'), document.querySelector('ytm-app'), document.body, document.documentElement]) {
      if (!n) continue;
      const c = (getComputedStyle(n).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return (c[0] + c[1] + c[2]) < 384; // прозрачният фон не се брои
    }
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  };

  /** Отваряне на видео без презареждане – през навигацията на самия YouTube (≈2 пъти по-бързо). */
  YTC.go = function (url) {
    try {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      setTimeout(() => { if (!document.querySelector('ytm-watch') && location.pathname === '/watch') location.assign(url); }, 2500);
    } catch (e) { location.assign(url); }
  };

  function feedWanted() { return S.enabled && S.smartHome && !S.hideHomeFeed && location.pathname === '/'; }

  function placeFeed() {
    if (!feedHost) return;
    const top = document.querySelector('ytm-mobile-topbar-renderer, header');
    const bot = document.querySelector('ytm-pivot-bar-renderer');
    const t = top ? Math.max(0, top.getBoundingClientRect().bottom) : 48;
    const b = bot && bot.offsetHeight ? bot.offsetHeight : 0;
    const w = feedRoot.querySelector('.wrap');
    w.style.top = t + 'px'; w.style.bottom = b + 'px';
    w.className = 'wrap ' + (isDark() ? 'dark' : 'light');
  }

  function mountFeed() {
    if (feedHost && feedHost.isConnected) { placeFeed(); return; }
    if (!document.body) return;
    feedHost = el('div'); feedHost.id = 'ytc-home';
    feedRoot = feedHost.attachShadow({ mode: 'open' });
    feedRoot.appendChild(el('style', null, FEED_CSS));
    const wrap = el('div', 'wrap');
    const chips = el('div', 'chips');
    feedList = el('div', 'list');
    wrap.appendChild(chips); wrap.appendChild(feedList);
    feedRoot.appendChild(wrap);
    document.body.appendChild(feedHost);
    document.documentElement.classList.add('ytc-feed-on');
    wrap.addEventListener('scroll', () => {
      if (wrap.scrollTop + wrap.clientHeight > wrap.scrollHeight - 1200) loadMore();
    }, { passive: true });
    placeFeed();
    renderChips();
    startFeed(false);
  }
  function unmountFeed() {
    if (feedHost) { feedHost.remove(); feedHost = null; feedRoot = null; feedList = null; }
    document.documentElement.classList.remove('ytc-feed-on');
  }

  let activeChip = 'all';
  function renderChips() {
    const chips = feedRoot.querySelector('.chips');
    while (chips.firstChild) chips.removeChild(chips.firstChild);
    const ints = LS.get(I_KEY, []);
    const add = (id, label) => {
      const c = el('button', 'chip' + (activeChip === id ? ' on' : ''), label);
      c.addEventListener('click', () => {
        if (id === 'edit') { showPicker(); return; }
        activeChip = id; renderChips(); startFeed(true);
      });
      chips.appendChild(c);
    };
    add('all', 'За теб');
    ints.forEach((i) => add('i:' + i, i));
    add('edit', ints.length ? '✎ Интереси' : '＋ Избери интереси');
  }

  function showPicker() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const box = el('div', 'msg');
    box.appendChild(el('h2', null, 'Какво обичаш да гледаш?'));
    box.appendChild(el('p', null, 'Избери няколко теми – началната страница ще ти предлага видеа по тях и по това, което гледаш.'));
    const sel = new Set(LS.get(I_KEY, []));
    const pick = el('div', 'pick');
    const go = el('button', 'go', 'Готово');
    const upd = () => { go.disabled = sel.size === 0; };
    const custom = [...sel].filter((x) => !INTERESTS.includes(x));
    for (const i of INTERESTS.concat(custom)) {
      const c = el('button', 'chip' + (sel.has(i) ? ' on' : ''), i);
      c.addEventListener('click', () => { sel.has(i) ? sel.delete(i) : sel.add(i); c.classList.toggle('on'); upd(); });
      pick.appendChild(c);
    }
    const addOwn = el('button', 'chip', '＋ Друго…');
    addOwn.addEventListener('click', () => {
      const v = (prompt('Тема или ключова дума:') || '').trim();
      if (!v) return;
      sel.add(v);
      const c = el('button', 'chip on', v);
      c.addEventListener('click', () => { sel.has(v) ? sel.delete(v) : sel.add(v); c.classList.toggle('on'); upd(); });
      pick.insertBefore(c, addOwn); upd();
    });
    pick.appendChild(addOwn);
    box.appendChild(pick);
    go.addEventListener('click', () => { LS.set(I_KEY, [...sel]); LS.set(F_KEY, null); activeChip = 'all'; renderChips(); startFeed(true); });
    upd();
    box.appendChild(go);
    feedList.appendChild(box);
  }

  function card(it) {
    const a = el('a', 'card');
    a.href = '/watch?v=' + it.id;
    a.addEventListener('click', (e) => { e.preventDefault(); YTC.go('/watch?v=' + it.id); });
    const th = el('div', 'th');
    const img = el('img'); img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.src = it.thumb || ('https://i.ytimg.com/vi/' + it.id + '/hqdefault.jpg');
    th.appendChild(img);
    if (it.live) th.appendChild(el('span', 'dur live', 'НА ЖИВО'));
    else if (it.dur) th.appendChild(el('span', 'dur', it.dur));
    a.appendChild(th);
    const meta = el('div', 'meta');
    meta.appendChild(el('div', 'tt', it.title));
    meta.appendChild(el('div', 'sub', [it.channel, it.views, it.date].filter(Boolean).join(' • ')));
    a.appendChild(meta);
    return a;
  }

  function skeleton(n) { for (let i = 0; i < n; i++) feedList.appendChild(el('div', 'sk')); }
  function clearSkeleton() { feedList.querySelectorAll('.sk, .more, .msg').forEach((e) => e.remove()); }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** Взима предложения: свързани с последно гледаните видеа + нови видеа по интересите. */
  async function fetchBatch(first) {
    const hist = LS.get(H_KEY, []);
    const ints = LS.get(I_KEY, []);
    const jobs = [];
    if (activeChip.startsWith('i:')) {
      const q = activeChip.slice(2);
      jobs.push(api('search', { query: q, params: first ? 'EgQIBBAB' : 'EgIQAQ%3D%3D' }, 'MWEB')); // този месец / всички
      if (!first) jobs.push(api('search', { query: q + ' ' + new Date().getFullYear(), params: 'EgIQAQ%3D%3D' }, 'MWEB'));
    } else {
      let seeds;
      if (first) seeds = hist.slice(0, 2).map((h) => h.id).concat(shuffle(hist.slice(2, 15).map((h) => h.id)).slice(0, 2));
      else seeds = feedState.seeds.splice(0, 3);
      for (const id of seeds) jobs.push(api('next', { videoId: id }, 'WEB'));
      for (const q of shuffle(ints.slice()).slice(0, first ? 2 : 1)) jobs.push(api('search', { query: q, params: 'EgQIBBAB' }, 'MWEB'));
      if (!jobs.length) return null; // няма история и интереси
    }
    const res = await Promise.all(jobs);
    const lists = res.filter(Boolean).map((r) => shuffle(collect(r).slice(0, 25)));
    const watched = new Set(hist.map((h) => h.id));
    const out = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) {       // редуване: по малко от всеки източник
      for (const l of lists) {
        const it = l[i];
        if (!it || feedState.seen.has(it.id) || !allowed(it, watched)) continue;
        if (activeChip === 'all' && watched.has(it.id)) continue;   // не предлагаме вече гледаното
        feedState.seen.add(it.id);
        out.push(it);
        if (it.date) rememberDate(it.id, it.date);
      }
    }
    // следващите "семена" за безкрайно превъртане – от самите предложения
    feedState.seeds.push(...shuffle(out.slice(0, 12).map((x) => x.id)));
    return out;
  }

  async function startFeed(force) {
    if (!feedList) return;
    feedState = { items: [], seen: new Set(), seeds: [], loading: false, done: false };
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const cached = activeChip === 'all' && LS.get(F_KEY, null);
    if (!force && cached && cached.items && Date.now() - cached.t < 6 * 3600e3) {
      for (const it of cached.items) { feedState.seen.add(it.id); feedList.appendChild(card(it)); }
      feedState.seeds = cached.seeds || [];
      feedState.items = cached.items;
      if (Date.now() - cached.t < 20 * 60e3) return;               // свежо – готово
    } else skeleton(3);
    feedState.loading = true;
    const items = await fetchBatch(true);
    feedState.loading = false;
    if (!feedList) return;
    if (items === null) { clearSkeleton(); showPicker(); return; }
    if (!cached || force || !cached.items) { clearSkeleton(); while (feedList.firstChild) feedList.removeChild(feedList.firstChild); }
    else { while (feedList.firstChild) feedList.removeChild(feedList.firstChild); } // свежите заместват кешираните
    if (!items.length) { feedList.appendChild(msg('Няма нови предложения', 'Опитай „Избери интереси“ или потърси нещо.')); return; }
    items.forEach((it) => feedList.appendChild(card(it)));
    feedState.items = items;
    if (activeChip === 'all') LS.set(F_KEY, { t: Date.now(), items: items.slice(0, 40), seeds: feedState.seeds.slice(0, 20) });
  }
  function msg(h, p) { const b = el('div', 'msg'); b.appendChild(el('h2', null, h)); b.appendChild(el('p', null, p)); return b; }

  async function loadMore() {
    if (!feedList || feedState.loading || feedState.done) return;
    if (!feedState.seeds.length && !activeChip.startsWith('i:') && !LS.get(I_KEY, []).length) { feedState.done = true; return; }
    feedState.loading = true;
    const m = el('div', 'more', 'Зареждане…'); feedList.appendChild(m);
    const items = await fetchBatch(false);
    m.remove();
    feedState.loading = false;
    if (!items || !items.length) { feedState.done = true; return; }
    items.forEach((it) => feedList.appendChild(card(it)));
  }

  // ======================================================== Дата на качване навсякъде
  const dates = new Map(Object.entries(LS.get(D_KEY, {})));
  let datesDirty = false;
  function rememberDate(id, d) {
    if (!id || !d || dates.get(id) === d) return;
    dates.set(id, d); datesDirty = true;
  }
  setInterval(() => {
    if (!datesDirty) return;
    datesDirty = false;
    const arr = [...dates.entries()].slice(-600);
    LS.set(D_KEY, Object.fromEntries(arr));
  }, 5000);

  const askedDates = new Set(), pendingDates = new Set();
  async function fetchDatesFor(videoId) {
    if (askedDates.has(videoId)) return;
    askedDates.add(videoId);
    const r = await api('next', { videoId }, 'WEB');
    if (!r) return;
    for (const it of collect(r)) if (it.date) rememberDate(it.id, it.date);
    paintDates();
  }

  const ITEM_SEL = 'ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-media-item, ytm-video-card-renderer';
  function paintDates() {
    if (!S.enabled || !S.showDates) return;
    document.querySelectorAll(ITEM_SEL).forEach((it) => {
      if (it.hasAttribute('data-ytc-date')) return;
      const a = it.querySelector('a[href*="watch?v="]');
      const m = a && (a.getAttribute('href') || '').match(/[?&]v=([\w-]{6,})/);
      if (!m) return;
      const text = it.textContent || '';
      if (isDateText(text)) { it.setAttribute('data-ytc-date', 'own'); return; } // YouTube вече показва дата
      const d = dates.get(m[1]);
      if (!d) return;
      const byl = it.querySelector('ytm-badge-and-byline-renderer, .media-item-byline, .compact-media-item-byline, .YtmBadgeAndBylineRendererHost');
      const span = el('span', 'ytc-date', ' • ' + d);
      span.style.cssText = 'opacity:.9;white-space:nowrap';
      if (byl) {
        const lastItem = byl.lastElementChild && byl.lastElementChild.tagName !== 'SCRIPT' ? byl.lastElementChild : null;
        (lastItem || byl).appendChild(span);
      } else {
        const t = it.querySelector('h3, .media-item-headline');
        if (!t) return;
        const div = el('div', 'ytc-date', d);
        div.style.cssText = 'font-size:12px;opacity:.7;margin-top:2px';
        t.after(div);
      }
      it.setAttribute('data-ytc-date', d);
    });
  }

  // ======================================================== Надписи (captions)
  let ccHost = null, ccRoot = null;
  const CC_CSS = `
  :host{all:initial}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .cc{position:fixed;right:16px;bottom:calc(128px + env(safe-area-inset-bottom));width:40px;height:40px;border-radius:50%;border:0;
    background:rgba(28,28,30,.92);color:#fff;font:700 13px -apple-system,Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.35);z-index:2147483645}
  .back{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646}
  .sheet{position:fixed;left:0;right:0;bottom:0;background:#1c1c1e;color:#f2f2f7;border-radius:18px 18px 0 0;max-height:80vh;overflow-y:auto;
    padding:14px 16px calc(18px + env(safe-area-inset-bottom));z-index:2147483647;font:15px/1.35 -apple-system,Roboto,"Segoe UI",sans-serif}
  h3{margin:4px 4px 4px;font-size:18px}
  .hint{color:#8e8e93;font-size:13px;margin:0 4px 12px}
  .seg{display:flex;background:#2c2c2e;border-radius:10px;padding:3px;margin:0 0 12px}
  .seg button{flex:1;border:0;background:none;color:#aeaeb2;font:600 14px inherit;padding:8px;border-radius:8px}
  .seg button.on{background:#48484a;color:#fff}
  .row{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:#2c2c2e;color:#f2f2f7;
    font:inherit;text-align:left;padding:13px 14px;border-radius:12px;margin-bottom:8px}
  .row small{color:#8e8e93}
  .st{margin:10px 4px 0;font-size:14px;color:#ffd60a;min-height:20px}
  `;
  function ccWanted() { return S.enabled && S.captionsButton && location.pathname === '/watch'; }
  function mountCC() {
    if (ccHost && ccHost.isConnected) return;
    if (!document.body) return;
    ccHost = el('div'); ccHost.id = 'ytc-cc';
    ccRoot = ccHost.attachShadow({ mode: 'open' });
    ccRoot.appendChild(el('style', null, CC_CSS));
    const b = el('button', 'cc', 'CC');
    b.setAttribute('aria-label', 'Изтегли надписите');
    b.addEventListener('click', openCC);
    ccRoot.appendChild(b);
    document.body.appendChild(ccHost);
  }
  function unmountCC() { if (ccHost) { ccHost.remove(); ccHost = null; ccRoot = null; } }

  const curVideo = () => (location.search.match(/[?&]v=([\w-]{6,})/) || [])[1];
  function ccInfo() {
    try { const d = JSON.parse(document.documentElement.getAttribute('data-ytc-cc') || 'null'); return d && d.v === curVideo() ? d.tracks : null; } catch (e) { return null; }
  }
  function timedtextEntry(v) {
    const es = performance.getEntriesByType('resource').filter((e) => /\/api\/timedtext\?/.test(e.name) && e.name.includes('v=' + v));
    return es.length ? es[es.length - 1].name : null;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Взима адреса, с който плейърът тегли надписите (с неговия защитен токен). При нужда ги включва за миг. */
  async function playerCaptionUrl(lang) {
    const v = curVideo();
    let u = timedtextEntry(v);
    if (u) return u;
    document.dispatchEvent(new CustomEvent('ytc-cmd', { detail: JSON.stringify({ cmd: 'cc-on', lang }) }));
    const btn = document.querySelector('.ytmClosedCaptioningButtonButton, button.ytp-subtitles-button, [aria-label*="убтитр"], [aria-label*="aption"]');
    let clicked = false;
    for (let i = 0; i < 40 && !u; i++) {
      if (i === 8 && btn && !clicked) { try { btn.click(); clicked = true; } catch (e) { /* */ } }
      await sleep(200);
      u = timedtextEntry(v);
    }
    document.dispatchEvent(new CustomEvent('ytc-cmd', { detail: JSON.stringify({ cmd: 'cc-off' }) }));
    if (clicked && btn) { try { btn.click(); } catch (e) { /* */ } }
    return u;
  }

  function toSrt(events) {
    const ts = (ms) => {
      const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1000), x = Math.floor(ms % 1000);
      const p = (n, l) => String(n).padStart(l, '0');
      return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(x, 3);
    };
    let n = 0, out = '';
    for (const e of events) out += (++n) + '\n' + ts(e.s) + ' --> ' + ts(e.e) + '\n' + e.t + '\n\n';
    return out;
  }
  function parseCaptions(body) {
    const ev = [];
    const t = (body || '').trim();
    if (!t) return ev;
    if (t[0] === '{') {
      const j = JSON.parse(t);
      for (const e of (j.events || [])) {
        if (!e.segs) continue;
        const s = e.segs.map((x) => x.utf8 || '').join('').replace(/\s+\n/g, '\n').trim();
        if (!s) continue;
        ev.push({ s: e.tStartMs || 0, e: (e.tStartMs || 0) + (e.dDurationMs || 2000), t: s });
      }
    } else {
      const doc = new DOMParser().parseFromString(t, 'text/xml');
      doc.querySelectorAll('p, text').forEach((p) => {
        const s = +(p.getAttribute('t') || (parseFloat(p.getAttribute('start') || '0') * 1000));
        const d = +(p.getAttribute('d') || (parseFloat(p.getAttribute('dur') || '2') * 1000));
        const x = (p.textContent || '').trim();
        if (x) ev.push({ s, e: s + d, t: x });
      });
    }
    // без застъпване (за да не "трепти" в плейърите)
    for (let i = 0; i < ev.length - 1; i++) if (ev[i].e > ev[i + 1].s) ev[i].e = ev[i + 1].s;
    return ev;
  }

  function saveFile(name, text, mime) {
    if (window.YTCApp && typeof window.YTCApp.saveFile === 'function') { window.YTCApp.saveFile(name, mime, text); return; }
    const blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const safeName = (s) => (s || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

  async function downloadCC(opt, fmt, status) {
    status.textContent = 'Взимане на надписите…';
    try {
      const base = await playerCaptionUrl(opt.lang);
      if (!base) { status.textContent = 'Плейърът още не е заредил надписите. Пусни видеото за секунда и опитай пак.'; return; }
      const u = new URL(base, location.href);
      u.searchParams.set('fmt', 'json3');
      if (opt.lang) u.searchParams.set('lang', opt.lang);
      if (opt.kind === 'asr') u.searchParams.set('kind', 'asr'); else u.searchParams.delete('kind');
      if (opt.tlang) u.searchParams.set('tlang', opt.tlang); else u.searchParams.delete('tlang');
      const body = await fetch(u.toString(), { credentials: 'same-origin' }).then((r) => r.text());
      const ev = parseCaptions(body);
      if (!ev.length) { status.textContent = 'YouTube не върна надписи за този език. Опитай друг.'; return; }
      const title = safeName(document.title.replace(/\s*-\s*YouTube\s*$/, ''));
      const suffix = (opt.tlang || opt.lang || 'cc');
      if (fmt === 'txt') saveFile(title + ' [' + suffix + '].txt', ev.map((e) => e.t).join('\n'), 'text/plain');
      else saveFile(title + ' [' + suffix + '].srt', toSrt(ev), 'application/x-subrip');
      status.style.color = '#30d158';
      status.textContent = '✓ Запазено (' + ev.length + ' реда)' + (window.YTCApp ? ' в „Изтегляния/YT Kontrol“' : ' в „Изтегляния“');
    } catch (e) {
      status.textContent = 'Грешка при изтегляне. Опитай пак.';
    }
  }

  function openCC() {
    if (!ccRoot) return;
    const tracks = ccInfo();
    const back = el('div', 'back');
    const sheet = el('div', 'sheet');
    const close = () => { back.remove(); sheet.remove(); };
    back.addEventListener('click', close);
    sheet.appendChild(el('h3', null, 'Изтегли надписите'));
    sheet.appendChild(el('p', 'hint', 'Файлът се запазва на телефона. SRT става за всеки видео плейър, „Текст“ е само думите.'));
    let fmt = 'srt';
    const seg = el('div', 'seg');
    for (const [k, l] of [['srt', 'SRT (с време)'], ['txt', 'Текст']]) {
      const b = el('button', k === fmt ? 'on' : '', l);
      b.addEventListener('click', () => { fmt = k; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
      seg.appendChild(b);
    }
    sheet.appendChild(seg);
    const status = el('div', 'st');
    const opts = [];
    if (tracks && tracks.length) {
      for (const t of tracks) opts.push({ label: t.name || t.lang, sub: t.kind === 'asr' ? 'автоматични' : '', lang: t.lang, kind: t.kind });
      const src = tracks.find((t) => t.tr) || tracks[0];
      if (src && src.lang !== 'bg' && !tracks.some((t) => t.lang === 'bg')) opts.push({ label: 'Български', sub: 'автоматичен превод', lang: src.lang, kind: src.kind, tlang: 'bg' });
    } else if (tracks && !tracks.length) {
      sheet.appendChild(el('p', 'hint', 'Това видео няма надписи.'));
    } else {
      opts.push({ label: 'Надписите на видеото', sub: '', lang: '', kind: '' });
      opts.push({ label: 'Български', sub: 'автоматичен превод', lang: '', kind: '', tlang: 'bg' });
    }
    for (const o of opts) {
      const r = el('button', 'row');
      r.appendChild(el('span', null, o.label));
      r.appendChild(el('small', null, (o.sub ? o.sub + '  ' : '') + '⬇'));
      r.addEventListener('click', () => downloadCC(o, fmt, status));
      sheet.appendChild(r);
    }
    sheet.appendChild(status);
    ccRoot.appendChild(back); ccRoot.appendChild(sheet);
  }

  // ======================================================== Възпроизвеждане → Android (известие, фоново слушане)
  let lastMedia = '';
  function reportMedia() {
    if (!window.YTCApp || typeof window.YTCApp.media !== 'function') return;
    const v = document.querySelector('.html5-video-player video, video');
    const playing = !!(v && !v.paused && !v.ended && v.readyState > 1) && !document.querySelector('.ad-showing');
    const title = document.title.replace(/\s*-\s*YouTube\s*$/, '');
    const ch = ((document.querySelector('ytm-slim-owner-renderer .slim-owner-channel-name, ytm-slim-owner-renderer h3, .slim-owner-icon-and-title') || {}).textContent || '').trim();
    const key = playing + '|' + title + '|' + ch;
    if (key === lastMedia) return;
    lastMedia = key;
    try { window.YTCApp.media(playing, title, ch); } catch (e) { /* */ }
  }
  ['play', 'playing', 'pause', 'ended', 'emptied'].forEach((t) => document.addEventListener(t, () => setTimeout(reportMedia, 50), true));
  // команди от известието / заключения екран
  YTC.mediaCommand = function (cmd) {
    const v = document.querySelector('.html5-video-player video, video');
    if (!v) return;
    if (cmd === 'play') v.play().catch(() => {}); else if (cmd === 'pause') v.pause();
    else if (cmd === 'toggle') { if (v.paused) v.play().catch(() => {}); else v.pause(); }
  };

  // ======================================================== Общ цикъл
  let lastPath = '';
  function refresh() {
    if (!document.body) return;
    if (feedWanted()) mountFeed(); else unmountFeed();
    if (ccWanted()) mountCC(); else unmountCC();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (feedHost) placeFeed();
    }
    recordHistory();
    if (S.enabled && S.showDates) {
      const v = location.pathname === '/watch' && curVideo();
      if (v && !S.hideRelated && !askedDates.has(v) && !pendingDates.has(v) && document.querySelector(ITEM_SEL)) {
        pendingDates.add(v);
        setTimeout(() => { pendingDates.delete(v); fetchDatesFor(v); }, 1500); // след старта на видеото
      }
      paintDates();
    }
    reportMedia();
  }
  YTC.featuresTick = refresh;
  // докато се пише в търсачката, предложенията се скриват, за да се виждат подсказките на YouTube
  document.addEventListener('focusin', (e) => {
    if (feedHost && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) feedHost.style.display = 'none';
  }, true);
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (feedHost && location.pathname === '/' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) feedHost.style.display = ''; }, 300);
  }, true);
  window.addEventListener('resize', () => { if (feedHost) placeFeed(); });
})();
