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
  YTC.featuresApply = (s) => {
    S = s;
    try { if (window.YTCApp && typeof window.YTCApp.setPip === 'function') window.YTCApp.setPip(!!(s.enabled && s.pip !== false)); } catch (e) { /* */ }
    refresh();
  };

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

  const isMetaPart = (p) => isDateText(p) || /показв|views|гледа|^на живо$|^live$/i.test(p) || /^[\d\s.,\u00a0]+(млрд|млн|хил|[KMB])?\.?$/i.test(p.trim());
  function viewsPart(parts) {
    const w = parts.find((p) => /показв|views|гледа/i.test(p));
    if (w) return w;
    const n = parts.find((p) => !isDateText(p) && /^[\d\s.,\u00a0]+(млрд|млн|хил|[KMB])?\.?$/i.test(p.trim()));
    return n ? n.trim() + ' показвания' : '';
  }
  // първият browseId на канал (UC…) в даден обект – за "Следвай канала"
  function findChannelId(o, d) {
    if (!o || typeof o !== 'object' || (d || 0) > 12) return '';
    if (o.browseEndpoint && /^UC[\w-]{20,}$/.test(o.browseEndpoint.browseId || '')) return o.browseEndpoint.browseId;
    for (const k in o) { const r = findChannelId(o[k], (d || 0) + 1); if (r) return r; }
    return '';
  }
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
      id: v.contentId, title: txt(md.title), channel: parts.find((p) => !isMetaPart(p)) || '', handle: '', chId: findChannelId(md.image) || findChannelId(md.metadata),
      views: viewsPart(parts), date: parts.find(isDateText) || '',
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
      chId: be && /^UC/.test(be.browseId || '') ? be.browseId : '',
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

  // ======================================================== Абонаменти, „По-късно“, скрити (локално, без профил)
  const SUB_KEY = 'ytc-subs', LATER_KEY = 'ytc-later', DIS_KEY = 'ytc-dismissed';
  const subs = {
    all() { return LS.get(SUB_KEY, []); },
    has(id) { return !!id && this.all().some((c) => c.id === id); },
    add(c) { if (!c || !c.id || this.has(c.id)) return; const a = this.all(); a.unshift(Object.assign({ t: Date.now() }, c)); LS.set(SUB_KEY, a); LS.set('ytc-subs-feed', null); },
    remove(id) { LS.set(SUB_KEY, this.all().filter((c) => c.id !== id)); LS.set('ytc-subs-feed', null); },
  };
  const later = {
    all() { return LS.get(LATER_KEY, []); },
    has(id) { return this.all().some((x) => x.id === id); },
    add(it) { if (!it || !it.id || this.has(it.id)) return; const a = this.all(); a.unshift({ id: it.id, title: it.title, channel: it.channel, dur: it.dur, thumb: it.thumb, t: Date.now() }); LS.set(LATER_KEY, a.slice(0, 500)); },
    remove(id) { LS.set(LATER_KEY, this.all().filter((x) => x.id !== id)); },
  };
  YTC.subs = subs; YTC.later = later;
  let disCache = null;
  const dismissed = () => disCache || (disCache = new Set(LS.get(DIS_KEY, [])));
  function dismiss(id) { const a = LS.get(DIS_KEY, []); a.unshift(id); LS.set(DIS_KEY, a.slice(0, 2000)); disCache = null; }

  /** Канал по адрес (/@име или /channel/UC…) → { id, name, handle } */
  const resolved = new Map(LS.get('ytc-resolved', []));
  async function resolveChannel(href) {
    if (!href) return null;
    const m = href.match(/\/channel\/(UC[\w-]+)/);
    if (m) return { id: m[1] };
    const h = (href.match(/\/@([^/?#]+)/) || [])[1];
    if (!h) return null;
    if (resolved.has(h)) return { id: resolved.get(h), handle: h };
    const r = await api('navigation/resolve_url', { url: 'https://www.youtube.com/@' + h }, 'WEB');
    const id = r && r.endpoint && r.endpoint.browseEndpoint && r.endpoint.browseEndpoint.browseId;
    if (!id) return null;
    resolved.set(h, id); LS.set('ytc-resolved', [...resolved].slice(-300));
    return { id, handle: decodeURIComponent(h) };
  }
  YTC.resolveChannel = resolveChannel;

  /** WEB "next" за видео – общ (кеширан) за дати, глави и собственика на видеото */
  const nextCache = new Map();
  YTC.webNext = function (id) {
    if (!nextCache.has(id)) {
      nextCache.set(id, api('next', { videoId: id }, 'WEB'));
      if (nextCache.size > 30) nextCache.delete(nextCache.keys().next().value);
    }
    return nextCache.get(id);
  };
  YTC.videoOwner = async function (id) {
    const r = await YTC.webNext(id);
    let o = null;
    const walk = (x, d) => { if (o || !x || typeof x !== 'object' || d > 30) return; if (x.videoOwnerRenderer) { o = x.videoOwnerRenderer; return; } for (const k in x) walk(x[k], d + 1); };
    walk(r, 0);
    if (!o) return null;
    const be = o.navigationEndpoint && o.navigationEndpoint.browseEndpoint;
    return be ? { id: be.browseId, name: txt(o.title), handle: (be.canonicalBaseUrl || '').replace(/^\/@?/, ''), avatar: lastUrl(o.thumbnail && o.thumbnail.thumbnails) } : null;
  };

  // ======================================================== Филтри (същите като в настройките)
  const lines = (t) => String(t || '').split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  function allowed(it, watched) {
    if (!it.title) return false;
    if (dismissed().has(it.id)) return false;
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

  // ======================================================== Подредба и период
  // Параметри на търсенето на YouTube (protobuf → base64): подредба + период + само видеа
  const SORTS = [['rec', 'Препоръчани'], ['new', 'Най-нови'], ['views', 'Най-гледани'], ['rating', 'Най-висок рейтинг']];
  const PERIODS = [['any', 'Всякога'], ['day', 'Днес'], ['week', 'Тази седмица'], ['month', 'Този месец'], ['year', 'Тази година']];
  const SORT_CODE = { rec: 0, rating: 1, new: 2, views: 3 };
  const PERIOD_CODE = { any: 0, day: 2, week: 3, month: 4, year: 5 };
  const PERIOD_SEC = { day: 86400, week: 7 * 86400, month: 31 * 86400, year: 366 * 86400 };
  function sp(sort, period) {
    const f = [];
    if (PERIOD_CODE[period]) f.push(0x08, PERIOD_CODE[period]);
    f.push(0x10, 0x01); // само видеа
    const b = [];
    if (SORT_CODE[sort]) b.push(0x08, SORT_CODE[sort]);
    b.push(0x12, f.length, ...f);
    return btoa(String.fromCharCode(...b));
  }
  let view = LS.get('ytc-feed-view', { sort: 'rec', period: 'any' });
  // "преди 7 м." (месеца), "2 седм.", "6 ч", "3 дни", "1 г.", "5 hours ago"…
  const UNITS = [['сек', 1], ['мин', 60], ['седм', 604800], ['ч', 3600], ['ден', 86400], ['дн', 86400], ['д', 86400],
    ['мес', 2592000], ['м', 2592000], ['год', 31536000], ['г', 31536000],
    ['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  function ageSec(d) {
    if (!d) return null;
    const m = String(d).toLowerCase().match(/(\d+)\s*([^\s\d]+)/);
    if (!m) return null;
    for (const [u, mul] of UNITS) if (m[2].startsWith(u)) return +m[1] * mul;
    return null;
  }
  function viewsNum(v) {
    if (!v) return 0;
    const m = v.replace(/\s/g, '').match(/([\d.,]+)\s*(млрд|млн|хил|B|M|K)?/i);
    if (!m) return 0;
    const n = parseFloat(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const mul = { млрд: 1e9, b: 1e9, млн: 1e6, m: 1e6, хил: 1e3, k: 1e3 }[(m[2] || '').toLowerCase()] || 1;
    return n * mul;
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
  .dark .chips,.dark .head{background:#0f0f0f}.light .chips,.light .head{background:#fff}
  .chips::-webkit-scrollbar{display:none}
  .chip{flex:0 0 auto;border:0;border-radius:8px;padding:7px 12px;font:500 14px inherit;white-space:nowrap}
  .dark .chip{background:#272727;color:#f1f1f1}.light .chip{background:#f2f2f2;color:#0f0f0f}
  .dark .chip.on{background:#f1f1f1;color:#0f0f0f}.light .chip.on{background:#0f0f0f;color:#fff}
  .card{display:block;text-decoration:none;color:inherit;margin-bottom:16px;position:relative}
  .sorts{display:flex;gap:8px;overflow-x:auto;padding:0 12px 10px;scrollbar-width:none;align-items:center}
  .sorts::-webkit-scrollbar{display:none}
  .sorts .chip{padding:5px 10px;font-size:13px}
  .sel{flex:0 0 auto;border:0;border-radius:8px;padding:5px 8px;font:500 13px inherit}
  .dark .sel{background:#272727;color:#f1f1f1}.light .sel{background:#f2f2f2;color:#0f0f0f}
  .prog{position:absolute;left:0;bottom:0;height:3px;background:#ff0033}
  .progbg{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.35)}
  .cont{padding:4px 0 14px}
  .cont h4{margin:0 12px 8px;font-size:16px}
  .hs{display:flex;gap:10px;overflow-x:auto;padding:0 12px;scrollbar-width:none}
  .hs::-webkit-scrollbar{display:none}
  .hs .card{flex:0 0 62%;margin:0}
  .hs .th{border-radius:10px}
  .hs .meta{padding:6px 2px 0}.hs .tt{font-size:13.5px}
  .hhead{display:flex;justify-content:space-between;align-items:center;padding:4px 12px 12px}
  .hhead h4{margin:0;font-size:16px}
  .lnk{border:0;background:none;color:#3ea6ff;font:500 14px inherit;padding:4px 0}
  .card .meta{position:relative;padding-right:40px}
  .more3{position:absolute;right:4px;top:6px;width:32px;height:32px;border:0;background:none;color:inherit;font-size:20px;opacity:.7;padding:0}
  .mback{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10}
  .msheet{position:fixed;left:0;right:0;bottom:0;border-radius:16px 16px 0 0;padding:10px 0 calc(14px + env(safe-area-inset-bottom));z-index:11}
  .dark .msheet,.dark~.msheet{background:#212121;color:#f1f1f1}
  .msheet{background:#212121;color:#f1f1f1}
  .mtitle{padding:8px 18px 10px;font-weight:500;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mrow{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;font:15px inherit;padding:13px 18px}
  .avs{padding-bottom:14px}
  .av{flex:0 0 auto;width:64px;text-align:center;text-decoration:none;color:inherit;font-size:11px}
  .av img{width:56px;height:56px;border-radius:50%;background:#333;display:block;margin:0 auto 4px;object-fit:cover}
  .av span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .srow{display:flex;align-items:center;gap:12px;padding:8px 12px}
  .srow img{width:40px;height:40px;border-radius:50%;background:#333;object-fit:cover}
  .srow span{flex:1}
  .x{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:15px;line-height:28px;padding:0}
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
    const sorts = el('div', 'sorts');
    feedList = el('div', 'list');
    const head = el('div', 'head');
    head.style.cssText = 'position:sticky;top:0;z-index:2';
    chips.style.position = 'static';
    head.appendChild(chips); head.appendChild(sorts);
    wrap.appendChild(head); wrap.appendChild(feedList);
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
        activeChip = id; renderChips();
        if (id === 'hist') showHistory(); else if (id === 'subs') showSubs(); else if (id === 'later') showLater(); else startFeed(true);
      });
      chips.appendChild(c);
    };
    add('all', 'За теб');
    add('subs', '📺 Абонаменти');
    add('later', '⏱ По-късно');
    add('hist', '🕘 История');
    ints.forEach((i) => add('i:' + i, i));
    add('edit', ints.length ? '✎ Интереси' : '＋ Избери интереси');
    renderSorts();
  }

  function renderSorts() {
    const row = feedRoot.querySelector('.sorts');
    while (row.firstChild) row.removeChild(row.firstChild);
    if (activeChip === 'hist' || activeChip === 'subs' || activeChip === 'later') { row.style.display = 'none'; return; }
    row.style.display = '';
    for (const [k, l] of SORTS) {
      const c = el('button', 'chip' + (view.sort === k ? ' on' : ''), l);
      c.addEventListener('click', () => { view.sort = k; LS.set('ytc-feed-view', view); renderSorts(); startFeed(true); });
      row.appendChild(c);
    }
    const sel = el('select', 'sel');
    for (const [k, l] of PERIODS) { const o = el('option', null, '⏱ ' + l); o.value = k; if (view.period === k) o.selected = true; sel.appendChild(o); }
    sel.addEventListener('change', () => { view.period = sel.value; LS.set('ytc-feed-view', view); startFeed(true); });
    row.appendChild(sel);
  }

  // ---------- История с прогрес ----------
  function showHistory() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const h = (YTC.history ? YTC.history.all() : []);
    if (!h.length) { feedList.appendChild(msg('Историята е празна', 'Видеата, които гледаш, ще се появяват тук – и ще продължават оттам, докъдето си стигнал.')); return; }
    const head = el('div', 'hhead');
    head.appendChild(el('h4', null, h.length + ' ' + (h.length === 1 ? 'видео' : 'видеа')));
    const clr = el('button', 'lnk', 'Изчисти историята');
    clr.addEventListener('click', () => { if (confirm('Да се изчисти ли цялата история на гледане?')) { YTC.history.clear(); showHistory(); } });
    head.appendChild(clr);
    feedList.appendChild(head);
    for (const x of h) {
      const c = card({ id: x.id, title: x.title, channel: x.channel, dur: x.len ? fmtDur(x.len) : '', views: '',
        date: (x.done ? 'гледано' : x.pos ? 'спряно на ' + fmtDur(x.pos) : '') + ' • ' + ago(x.t) });
      const del = el('button', 'x', '✕');
      del.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); YTC.history.remove(x.id); c.remove(); });
      c.appendChild(del);
      feedList.appendChild(c);
    }
  }
  function fmtDur(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s2 = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s2).padStart(2, '0');
  }
  function ago(t) {
    const d = (Date.now() - t) / 1000;
    if (d < 3600) return 'преди ' + Math.max(1, Math.round(d / 60)) + ' мин';
    if (d < 86400) return 'преди ' + Math.round(d / 3600) + ' ч';
    return 'преди ' + Math.round(d / 86400) + ' дни';
  }
  function continueRow() {
    const h = (YTC.history ? YTC.history.all() : []).filter((x) => !x.done && x.pos > 30 && x.len && Date.now() - x.t < 14 * 86400e3).slice(0, 10);
    if (!h.length) return null;
    const box = el('div', 'cont');
    box.appendChild(el('h4', null, 'Продължи гледането'));
    const hs = el('div', 'hs');
    for (const x of h) hs.appendChild(card({ id: x.id, title: x.title, channel: x.channel, dur: fmtDur(x.len - x.pos) + ' ост.', views: '', date: '' }));
    box.appendChild(hs);
    return box;
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
    if (it.channel) a.dataset.ch = it.channel;
    a.addEventListener('click', (e) => { e.preventDefault(); YTC.go('/watch?v=' + it.id); });
    const th = el('div', 'th');
    const img = el('img'); img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.src = it.thumb || ('https://i.ytimg.com/vi/' + it.id + '/hqdefault.jpg');
    th.appendChild(img);
    if (it.live) th.appendChild(el('span', 'dur live', 'НА ЖИВО'));
    else if (it.dur) th.appendChild(el('span', 'dur', it.dur));
    const hh = histMap().get(it.id);
    if (hh && hh.len && (hh.pos || hh.done)) {
      th.appendChild(el('div', 'progbg'));
      const p = el('div', 'prog'); p.style.width = (hh.done ? 100 : Math.min(100, Math.round(hh.pos / hh.len * 100))) + '%';
      th.appendChild(p);
    }
    a.appendChild(th);
    const meta = el('div', 'meta');
    meta.appendChild(el('div', 'tt', it.title));
    meta.appendChild(el('div', 'sub', [it.channel, it.views, it.date].filter(Boolean).join(' • ')));
    const more = el('button', 'more3', '⋮');
    more.setAttribute('aria-label', 'Още');
    more.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cardMenu(it, a); });
    meta.appendChild(more);
    a.appendChild(meta);
    return a;
  }
  let hmCache = null, hmT = 0;
  function histMap() {
    if (!hmCache || Date.now() - hmT > 3000) { hmCache = new Map((YTC.history ? YTC.history.all() : []).map((x) => [x.id, x])); hmT = Date.now(); }
    return hmCache;
  }

  // ---------- меню на карта ----------
  function cardMenu(it, cardEl) {
    const back = el('div', 'mback'), sh = el('div', 'msheet');
    const close = () => { back.remove(); sh.remove(); };
    back.addEventListener('click', close);
    sh.appendChild(el('div', 'mtitle', it.title));
    const act = (label, fn) => { const b = el('button', 'mrow', label); b.addEventListener('click', () => { close(); fn(); }); sh.appendChild(b); };
    if (later.has(it.id)) act('⏱ Махни от „По-късно“', () => { later.remove(it.id); if (activeChip === 'later') cardEl.remove(); toastMsg('Махнато от „По-късно“'); });
    else act('⏱ Гледай по-късно', () => { later.add(it); toastMsg('✓ Запазено в „По-късно“'); });
    if (it.chId) {
      if (subs.has(it.chId)) act('📺 Спри да следваш ' + (it.channel || 'канала'), () => { subs.remove(it.chId); toastMsg('Вече не следваш ' + it.channel); });
      else act('📺 Следвай ' + (it.channel || 'канала'), () => { subs.add({ id: it.chId, name: it.channel, handle: it.handle || '' }); toastMsg('✓ Следваш ' + it.channel); });
    }
    act('🙈 Не ме интересува', () => { dismiss(it.id); cardEl.remove(); toastMsg('Няма да го виждаш повече'); });
    if (it.channel) act('⛔ Блокирай ' + it.channel, () => {
      const ns = Object.assign({}, S);
      ns.blockedChannels = (S.blockedChannels ? S.blockedChannels + '\n' : '') + (it.handle ? '@' + it.handle : it.channel);
      if (YTC.saveSettings) YTC.saveSettings(ns);
      feedList.querySelectorAll('.card').forEach((c) => { if (c.dataset.ch === it.channel) c.remove(); });
      cardEl.remove();
      toastMsg('⛔ ' + it.channel + ' е блокиран');
    });
    feedRoot.appendChild(back); feedRoot.appendChild(sh);
  }
  const toastMsg = (m) => { if (YTC.toast) YTC.toast(/^[✓⛔]/.test(m) ? m : '✓ ' + m.replace(/^✓\s*/, '')); };

  // ---------- Абонаменти ----------
  async function showSubs() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const list = subs.all();
    if (!list.length) {
      feedList.appendChild(msg('Още не следваш канали', 'Натисни „Следвай“ под видео или на страницата на канал, или „⋮ → Следвай“ на всяко предложение. Новите им видеа ще се появяват тук, без Google профил.'));
      return;
    }
    const top = el('div', 'hhead');
    top.appendChild(el('h4', null, list.length + ' ' + (list.length === 1 ? 'канал' : 'канала')));
    const mg = el('button', 'lnk', 'Управлявай');
    mg.addEventListener('click', manageSubs);
    top.appendChild(mg);
    feedList.appendChild(top);
    const av = el('div', 'hs avs');
    const drawAvatars = () => { while (av.firstChild) av.removeChild(av.firstChild); for (const c of subs.all()) {
      const b = el('a', 'av');
      b.href = c.handle ? '/@' + c.handle : '/channel/' + c.id;
      b.addEventListener('click', (e) => { e.preventDefault(); YTC.go(b.getAttribute('href')); });
      const im = el('img'); im.alt = ''; im.loading = 'lazy'; if (c.avatar) im.src = c.avatar; b.appendChild(im);
      b.appendChild(el('span', null, c.name || c.handle || ''));
      av.appendChild(b);
    } };
    drawAvatars();
    feedList.appendChild(av);
    const cached = LS.get('ytc-subs-feed', null);
    let items = cached && Date.now() - cached.t < 30 * 60e3 ? cached.items : null;
    if (!items) {
      skeleton(3);
      const chunks = [];
      for (let i = 0; i < Math.min(list.length, 30); i += 6) chunks.push(list.slice(i, i + 6));
      items = [];
      for (const ch of chunks) {
        const res = await Promise.all(ch.map((c) => api('browse', { browseId: c.id, params: 'EgZ2aWRlb3PyBgQKAjoA' }, 'WEB').then((r) => {
          if (!r) return [];
          // аватар и име, ако ги нямаме
          const md = r.metadata && r.metadata.channelMetadataRenderer;
          if (md && (!c.avatar || !c.name)) {
            const all = subs.all(); const me = all.find((x) => x.id === c.id);
            if (me) { me.name = me.name || md.title; me.avatar = me.avatar || (md.avatar && md.avatar.thumbnails && md.avatar.thumbnails[0] && md.avatar.thumbnails[0].url) || ''; LS.set(SUB_KEY, all); }
          }
          return collect(r).slice(0, 12).map((x) => Object.assign(x, { channel: x.channel || (md && md.title) || c.name, chId: c.id }));
        })));
        res.forEach((r) => items.push(...r));
        if (activeChip !== 'subs' || !feedList) return;
      }
      const watched = new Set();
      items = items.filter((x) => allowed(x, watched));
      items.sort((x, y) => (ageSec(x.date) ?? 9e12) - (ageSec(y.date) ?? 9e12));
      items = items.slice(0, 120);
      LS.set('ytc-subs-feed', { t: Date.now(), items });
      clearSkeleton();
      drawAvatars();
    }
    if (activeChip !== 'subs' || !feedList) return;
    if (!items.length) { feedList.appendChild(msg('Няма видеа', 'Каналите, които следваш, още не са качили видеа или не се заредиха. Опитай пак след малко.')); return; }
    for (const it of items) { if (it.date) rememberDate(it.id, it.date); feedList.appendChild(card(it)); }
  }
  function manageSubs() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const top = el('div', 'hhead');
    top.appendChild(el('h4', null, 'Канали, които следваш'));
    const bk = el('button', 'lnk', 'Готово'); bk.addEventListener('click', showSubs); top.appendChild(bk);
    feedList.appendChild(top);
    for (const c of subs.all()) {
      const r = el('div', 'srow');
      const im = el('img'); im.alt = ''; if (c.avatar) im.src = c.avatar; r.appendChild(im);
      r.appendChild(el('span', null, c.name || c.handle || c.id));
      const x = el('button', 'lnk', 'Спри');
      x.addEventListener('click', () => { subs.remove(c.id); r.remove(); });
      r.appendChild(x);
      feedList.appendChild(r);
    }
  }

  // ---------- Гледай по-късно ----------
  function showLater() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const list = later.all();
    if (!list.length) { feedList.appendChild(msg('Списъкът е празен', 'Запазвай видеа с „⋮ → Гледай по-късно“ или от бутона „Инструменти“ при гледане.')); return; }
    const top = el('div', 'hhead');
    top.appendChild(el('h4', null, list.length + ' ' + (list.length === 1 ? 'видео' : 'видеа') + ' за по-късно'));
    feedList.appendChild(top);
    for (const x of list) feedList.appendChild(card(x));
  }

  function skeleton(n) { for (let i = 0; i < n; i++) feedList.appendChild(el('div', 'sk')); }
  function clearSkeleton() { feedList.querySelectorAll('.sk, .more, .msg').forEach((e) => e.remove()); }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** Взима предложения: свързани с последно гледаните видеа + нови видеа по интересите. */
  async function fetchBatch(first) {
    const hist = LS.get(H_KEY, []);
    const ints = LS.get(I_KEY, []);
    const jobs = [];
    const sort = view.sort, period = view.period;
    // при "Препоръчани" без период – свежо съдържание от последния месец; иначе – точно избраното
    const prm = sort === 'rec' && period === 'any' ? sp('rec', first ? 'month' : 'any') : sp(sort, period);
    // теми за търсене: интересите + най-гледаните канали от историята
    const chanCount = {};
    hist.slice(0, 60).forEach((h) => { if (h.channel) chanCount[h.channel] = (chanCount[h.channel] || 0) + 1; });
    const topChannels = Object.keys(chanCount).sort((x, y) => chanCount[y] - chanCount[x]).slice(0, 3);
    if (activeChip.startsWith('i:')) {
      const q = activeChip.slice(2);
      const page = feedState.page = (feedState.page || 0) + 1;
      jobs.push(api('search', { query: page > 1 ? q + ' ' + ['', 'нови', 'най-добрите', new Date().getFullYear()][page % 4] : q, params: prm }, 'MWEB'));
    } else {
      let seeds = [];
      if (sort === 'rec' || sort === 'new' || sort === 'views') {
        if (first) seeds = hist.slice(0, 2).map((h) => h.id).concat(shuffle(hist.slice(2, 15).map((h) => h.id)).slice(0, 2));
        else seeds = feedState.seeds.splice(0, 3);
      }
      for (const id of seeds) jobs.push(api('next', { videoId: id }, 'WEB'));
      const qs = shuffle(ints.slice()).slice(0, first ? 2 : 1);
      if (sort !== 'rec' || !qs.length) qs.push(...shuffle(topChannels.slice()).slice(0, first ? 2 : 1));
      for (const q of qs) jobs.push(api('search', { query: q, params: prm }, 'MWEB'));
      if (!jobs.length) return null; // няма история и интереси
    }
    const res = await Promise.all(jobs);
    const lists = res.filter(Boolean).map((r) => { const l = collect(r).slice(0, 25); return sort === 'rec' ? shuffle(l) : l; });
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
    // период и подредба важат и за свързаните видеа (по датата/показванията им)
    let res2 = out;
    if (period !== 'any') res2 = res2.filter((x) => { const a = ageSec(x.date); return a == null || a <= PERIOD_SEC[period]; });
    if (sort === 'new') res2.sort((x, y) => (ageSec(x.date) ?? 9e12) - (ageSec(y.date) ?? 9e12));
    else if (sort === 'views') res2.sort((x, y) => viewsNum(y.views) - viewsNum(x.views));
    return res2;
  }

  async function startFeed(force) {
    if (!feedList) return;
    feedState = { items: [], seen: new Set(), seeds: [], loading: false, done: false };
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const plain = activeChip === 'all' && view.sort === 'rec' && view.period === 'any';
    const cached = plain && LS.get(F_KEY, null);
    if (!force && cached && cached.items && Date.now() - cached.t < 6 * 3600e3) {
      { const c = continueRow(); if (c) feedList.appendChild(c); }
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
    if (activeChip === 'all') { const c = continueRow(); if (c) feedList.appendChild(c); }
    items.forEach((it) => feedList.appendChild(card(it)));
    feedState.items = items;
    if (plain) LS.set(F_KEY, { t: Date.now(), items: items.slice(0, 40), seeds: feedState.seeds.slice(0, 20) });
  }
  function msg(h, p) { const b = el('div', 'msg'); b.appendChild(el('h2', null, h)); b.appendChild(el('p', null, p)); return b; }

  async function loadMore() {
    if (!feedList || feedState.loading || feedState.done || /^(hist|subs|later)$/.test(activeChip)) return;
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
    const r = await YTC.webNext(videoId);
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

  // iOS приложение: при излизане iOS понякога спира видеото. Ако не си го спрял ти – пускаме го отново.
  let wasPlaying = false;
  document.addEventListener('playing', () => { wasPlaying = true; window.__ytcUserPaused = false; }, true);
  document.addEventListener('pause', (e) => {
    const v = e.target;
    if (!window.__ytcBg || window.__ytcUserPaused || !wasPlaying || !S.backgroundPlay || v.ended) { wasPlaying = !v.paused; return; }
    if (document.querySelector('.ad-showing')) return;
    setTimeout(() => { if (window.__ytcBg && !window.__ytcUserPaused && v.paused) v.play().catch(() => {}); }, 200);
  }, true);
  // докосване на пауза в самата страница = решение на потребителя
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.html5-video-player, .player-controls-content, ytm-custom-control')) {
      setTimeout(() => { const v = document.querySelector('.html5-video-player video'); if (v && v.paused) window.__ytcUserPaused = true; }, 300);
    }
  }, true);
  // команди от известието / заключения екран
  YTC.mediaCommand = function (cmd) {
    const v = document.querySelector('.html5-video-player video, video');
    if (!v) return;
    // команда от заключения екран / известието = решение на потребителя
    window.__ytcUserPaused = cmd === 'pause' || (cmd === 'toggle' && !v.paused);
    if (cmd === 'play') v.play().catch(() => {}); else if (cmd === 'pause') v.pause();
    else if (cmd === 'toggle') { if (v.paused) v.play().catch(() => {}); else v.pause(); }
  };

  // ======================================================== Бутон „Следвай“ (вместо „Абониране“, което иска профил)
  let loggedIn = null;
  function isLoggedIn() {
    if (loggedIn !== null) return loggedIn;
    for (const sc of document.scripts) { const m = sc.textContent && sc.textContent.match(/"LOGGED_IN":(true|false)/); if (m) return (loggedIn = m[1] === 'true'); }
    return false;
  }
  const FOLLOW_CSS = 'border:0;border-radius:18px;padding:0 16px;height:36px;font:500 14px Roboto,-apple-system,sans-serif;white-space:nowrap;flex:0 0 auto;margin-left:8px;';
  function styleFollow(b, on) {
    const dark = isDark();
    b.textContent = on ? '✓ Следваш' : 'Следвай';
    b.style.cssText = FOLLOW_CSS + (on ? (dark ? 'background:#272727;color:#f1f1f1' : 'background:#f2f2f2;color:#0f0f0f')
      : (dark ? 'background:#f1f1f1;color:#0f0f0f' : 'background:#0f0f0f;color:#fff'));
  }
  function followButtons() {
    if (!S.enabled || isLoggedIn()) return;
    let spots = [];
    if (location.pathname === '/watch') {
      const owner = document.querySelector('ytm-slim-owner-renderer');
      if (owner) {
        const a = owner.querySelector('a[href*="/@"], a[href*="/channel/"]');
        spots.push({ box: owner, href: a && a.getAttribute('href'), name: (owner.querySelector('.slim-owner-channel-name, h3') || a || {}).textContent || '' });
      }
    } else if (/^\/(@[^/]+|channel\/UC[\w-]+)/.test(location.pathname)) {
      const head = document.querySelector('yt-page-header-view-model, ytm-c4-tabbed-header-renderer, page-header-view-model, ytm-browse header');
      if (head) spots.push({ box: head, href: location.pathname, name: (head.querySelector('h1, .page-header-view-model-wiz__page-header-title, yt-dynamic-text-view-model') || {}).textContent || '' });
    }
    for (const sp of spots) {
      if (!sp.href) continue;
      let yt = sp.box.querySelector('ytm-subscribe-button-renderer, yt-subscribe-button-view-model, subscribe-button-view-model, .ytmSubscribeButtonRendererHost');
      if (!yt) { // новият дизайн: обикновен бутон с текст "Абониране"
        const btn = [...sp.box.querySelectorAll('button, a[role="button"]')].find((x) => !x.classList.contains('ytc-follow') && /^(Абониране|Абонирай се|Абонирайте се|Subscribe)$/i.test((x.textContent || '').trim()));
        if (btn) yt = btn.closest('button-view-model, yt-button-view-model, .yt-flexible-actions-view-model-wiz__action, .ytFlexibleActionsViewModelAction') || btn;
      }
      let b = sp.box.querySelector('.ytc-follow');
      if (b && b.dataset.href === sp.href) continue;
      if (b) b.remove();
      b = document.createElement('button');
      b.className = 'ytc-follow'; b.dataset.href = sp.href;
      const h = (sp.href.match(/\/@([^/?#]+)/) || [])[1];
      const known = subs.all().find((c) => (h && c.handle && c.handle.toLowerCase() === decodeURIComponent(h).toLowerCase()) || sp.href.includes(c.id));
      styleFollow(b, !!known);
      b.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const k = subs.all().find((c) => (h && c.handle && c.handle.toLowerCase() === decodeURIComponent(h).toLowerCase()) || sp.href.includes(c.id));
        const keepWide = () => { if (b.dataset.wide) { b.style.width = '100%'; b.style.height = '40px'; b.style.marginLeft = '0'; } };
        if (k) { subs.remove(k.id); styleFollow(b, false); keepWide(); toastMsg('Вече не следваш ' + (k.name || '')); return; }
        b.textContent = '…';
        const r = await resolveChannel(sp.href);
        if (!r) { styleFollow(b, false); toastMsg('⛔ Каналът не можа да се намери'); return; }
        const name = sp.name.trim().split('\n')[0] || r.handle || '';
        subs.add({ id: r.id, name, handle: r.handle || '' });
        styleFollow(b, true); keepWide();
        toastMsg('✓ Следваш ' + name + ' – новите видеа са в „Абонаменти“');
      });
      if (yt) {
        const wide = yt.getBoundingClientRect().width > 200;   // голям бутон в шапката на канала
        yt.style.display = 'none';
        yt.after(b);
        if (wide) { b.style.width = '100%'; b.style.height = '40px'; b.style.marginLeft = '0'; b.dataset.wide = '1'; }
      }
      else sp.box.appendChild(b);
    }
  }

  // ======================================================== Общ цикъл
  let lastPath = '';
  function refresh() {
    if (!document.body) return;
    if (feedWanted()) mountFeed(); else unmountFeed();
    if (ccWanted()) mountCC(); else unmountCC();
    followButtons();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (feedHost) placeFeed();
    }
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
