// ==UserScript==
// @name         YT Контрол – блокер на Shorts и реклами (мобилен)
// @namespace    yt-control
// @version      2.0.0
// @description  Изрязва Shorts и рекламите от данните на m.youtube.com, преди да се покажат. Филтри по думи и канали, фокус режим.
// @match        https://m.youtube.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

/* YT Контрол – настройки (само мобилна версия m.youtube.com) */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  YTC.VERSION = '2.0.0';
  YTC.KEY = 'ytc-settings';

  YTC.SCHEMA = [
    { group: 'Shorts' },
    { key: 'blockShorts', label: 'Блокирай Shorts напълно', hint: 'Рафтове, бутон в долната лента, табове в каналите, отделни клипове', def: true },
    { key: 'redirectShorts', label: 'Линк към Short → нормално видео', hint: 'Иначе те връща в началото', def: true },

    { group: 'Реклами' },
    { key: 'hideAds', label: 'Премахвай рекламите от данните', hint: 'Видео реклами, банери, спонсорирани карти', def: true },
    { key: 'skipVideoAds', label: 'Резервно пропускане на видео реклами', hint: 'Ако все пак тръгне реклама: заглушава и превърта', def: true },

    { group: 'Съдържание' },
    { key: 'hideHomeFeed', label: 'Фокус режим', hint: 'Празна начална страница, без препоръки', def: false },
    { key: 'hideRelated', label: 'Без препоръки под видеото', def: false },
    { key: 'hideComments', label: 'Без коментари', def: false },
    { key: 'hideLive', label: 'Без излъчвания на живо', def: false },
    { key: 'hideMixes', label: 'Без миксове и плейлисти', def: false },
    { key: 'hideWatched', label: 'Без вече гледани видеа', def: false },
    { key: 'hideShelves', label: 'Без тематични рафтове', hint: 'Новини, тенденции и др.', def: false },

    { group: 'Филтри' },
    { key: 'blockedWords', type: 'text', label: 'Блокирани думи в заглавието', hint: 'по една на ред', def: '' },
    { key: 'blockedChannels', type: 'text', label: 'Блокирани канали', hint: 'име или @handle, по един на ред', def: '' },
    { key: 'minDuration', type: 'number', label: 'Скрий видеа под N минути', hint: '0 = изключено', def: 0 },

    { group: 'Приложение' },
    { key: 'showButton', label: 'Плаващ бутон 🛡', hint: 'Ако е скрит: задръж пръст върху логото на YouTube', def: true },
    { key: 'enabled', label: 'Защитата е включена', def: true },
  ];

  YTC.defaults = function () {
    const d = {};
    for (const f of YTC.SCHEMA) if (f.key) d[f.key] = f.def;
    return d;
  };
  YTC.normalize = function (obj) {
    const d = YTC.defaults();
    if (obj && typeof obj === 'object') {
      for (const f of YTC.SCHEMA) {
        if (!f.key || !(f.key in obj)) continue;
        const v = obj[f.key];
        d[f.key] = f.type === 'text' ? String(v == null ? '' : v) : f.type === 'number' ? Math.max(0, Number(v) || 0) : !!v;
      }
    }
    return d;
  };
  YTC.load = function () {
    try { return YTC.normalize(JSON.parse(localStorage.getItem(YTC.KEY) || 'null')); } catch (e) { return YTC.defaults(); }
  };
  YTC.save = function (s) {
    try { localStorage.setItem(YTC.KEY, JSON.stringify(s)); } catch (e) { /* */ }
    // известява и кода в страницата (другия "свят"), че настройките са сменени
    document.dispatchEvent(new CustomEvent('ytc-settings'));
  };
})();

/*
 * YT Контрол – слой "данни".
 * Тази функция се изпълнява В САМАТА СТРАНИЦА (main world), затова е напълно самостоятелна.
 * m.youtube.com получава всичко като JSON: ytInitialData / ytInitialPlayerResponse (низове,
 * подавани на JSON.parse) и отговорите от /youtubei/v1/* (също минават през JSON.parse).
 * Подменяме JSON.parse (+ Response.json и XHR.response за всеки случай) и изрязваме
 * рекламите и Shorts от данните – преди YouTube да ги нарисува или пусне в плейъра.
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  YTC.pageHook = function YTC_PAGE_HOOK() {
    'use strict';
    if (window.__ytcHook) return;
    window.__ytcHook = true;

    const KEY = 'ytc-settings';
    const origParse = JSON.parse;
    const parse = (s) => origParse.call(JSON, s);
    const D = { enabled: true, blockShorts: true, hideAds: true, hideMixes: false, hideLive: false, hideWatched: false,
      hideRelated: false, hideShelves: false, blockedWords: '', blockedChannels: '', minDuration: 0 };
    let S = D, words = [], channels = [];
    const stats = { shorts: 0, ads: 0, filtered: 0 };

    function load() {
      let s = null;
      try { s = parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* */ }
      S = Object.assign({}, D, s || {});
      const list = (t) => String(t || '').split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      words = list(S.blockedWords);
      channels = list(S.blockedChannels).map((x) => { const m = x.match(/@([^/?#\s]+)/); return m ? m[1] : x; });
    }
    load();
    document.addEventListener('ytc-settings', load);

    // ---------- помощни ----------
    const txt = (t) => !t ? '' : typeof t === 'string' ? t : t.simpleText || t.content ||
      (Array.isArray(t.runs) ? t.runs.map((r) => r.text || '').join('') : '');
    const urlOf = (ep) => (ep && ep.commandMetadata && ep.commandMetadata.webCommandMetadata &&
      ep.commandMetadata.webCommandMetadata.url) || '';

    const AD_KEYS = new Set([
      'adSlotRenderer', 'promotedSparklesWebRenderer', 'promotedSparklesTextSearchRenderer', 'promotedVideoRenderer',
      'compactPromotedVideoRenderer', 'searchPyvRenderer', 'inFeedAdLayoutRenderer', 'displayAdRenderer',
      'statementBannerRenderer', 'bannerPromoRenderer', 'mealbarPromoRenderer', 'companionSlotRenderer',
      'actionCompanionAdRenderer', 'merchandiseShelfRenderer', 'brandVideoSingletonRenderer', 'brandVideoShelfRenderer',
      'primetimePromoRenderer', 'adsEngagementPanelContentRenderer', 'videoMastheadAdV3Renderer', 'adBreakServiceRenderer',
      'compactMovieRenderer', 'movieOfferModuleRenderer',
    ]);
    const PLAYER_AD_KEYS = ['adPlacements', 'adSlots', 'playerAds'];
    const SHORTS_KEYS = new Set(['reelShelfRenderer', 'reelItemRenderer', 'shortsLockupViewModel', 'shortsLockupViewModelV2']);
    const VIDEO_KEYS = new Set(['videoWithContextRenderer', 'compactVideoRenderer', 'videoRenderer', 'gridVideoRenderer',
      'videoCardRenderer', 'playlistVideoRenderer']);
    const MIX_KEYS = new Set(['radioRenderer', 'compactRadioRenderer', 'playlistRenderer', 'compactPlaylistRenderer',
      'gridPlaylistRenderer', 'playlistWithContextRenderer']);
    const isShortsItemList = (arr) => Array.isArray(arr) && arr.some((c) => c && typeof c === 'object' &&
      (c.shortsLockupViewModel || c.shortsLockupViewModelV2 || c.reelItemRenderer ||
       (c.richItemRenderer && c.richItemRenderer.content && (c.richItemRenderer.content.shortsLockupViewModel || c.richItemRenderer.content.reelItemRenderer))));

    function videoReason(v) {
      const ep = v.navigationEndpoint || {};
      if (S.blockShorts && (ep.reelWatchEndpoint || /^\/shorts\//.test(urlOf(ep)))) return 'shorts';
      if (S.hideMixes && ep.watchEndpoint && /^RD/.test(ep.watchEndpoint.playlistId || '')) return 'filtered';
      const overlays = Array.isArray(v.thumbnailOverlays) ? v.thumbnailOverlays : [];
      if (S.hideLive) {
        const live = overlays.some((o) => o.thumbnailOverlayTimeStatusRenderer && o.thumbnailOverlayTimeStatusRenderer.style === 'LIVE') ||
          (Array.isArray(v.badges) && v.badges.some((b) => b.metadataBadgeRenderer && /LIVE/.test(b.metadataBadgeRenderer.style || '')));
        if (live) return 'filtered';
      }
      if (S.hideWatched) {
        if (v.isWatched) return 'filtered';
        const rp = overlays.find((o) => o.thumbnailOverlayResumePlaybackRenderer);
        if (rp && rp.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched >= 80) return 'filtered';
      }
      if (S.minDuration > 0) {
        let len = txt(v.lengthText);
        if (!len) { const ts = overlays.find((o) => o.thumbnailOverlayTimeStatusRenderer); len = ts ? txt(ts.thumbnailOverlayTimeStatusRenderer.text) : ''; }
        const m = len.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
        if (m && (+(m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) < S.minDuration * 60) return 'filtered';
      }
      if (words.length) {
        const t = (txt(v.headline) + ' ' + txt(v.title)).toLowerCase();
        if (words.some((w) => t.includes(w))) return 'filtered';
      }
      if (channels.length) {
        const by = v.shortBylineText || v.longBylineText || v.ownerText;
        const names = [txt(by).toLowerCase()];
        const runs = by && Array.isArray(by.runs) ? by.runs : [];
        for (const r of runs) {
          const be = r.navigationEndpoint && r.navigationEndpoint.browseEndpoint;
          if (be && be.canonicalBaseUrl) names.push(decodeURIComponent(be.canonicalBaseUrl).replace(/^\/@?/, '').toLowerCase());
        }
        if (channels.some((c) => names.includes(c))) return 'filtered';
      }
      return null;
    }

    // Връща причина, ако елементът от масив трябва да бъде махнат
    function itemReason(x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
      for (const k in x) {
        const v = x[k];
        if (S.hideAds && AD_KEYS.has(k)) return 'ads';
        if (S.blockShorts && SHORTS_KEYS.has(k)) return 'shorts';
        if (!v || typeof v !== 'object') continue;
        if (k === 'richItemRenderer' || k === 'richSectionRenderer') { const r = itemReason(v.content); if (r) return r; }
        if (S.blockShorts) {
          if (k === 'richShelfRenderer' && (v.isShorts || isShortsItemList(v.contents))) return 'shorts';
          if (k === 'gridShelfViewModel' && isShortsItemList(v.contents)) return 'shorts';
          if (k === 'shelfRenderer' && v.content && (isShortsItemList((v.content.horizontalListRenderer || {}).items) ||
              isShortsItemList((v.content.verticalListRenderer || {}).items))) return 'shorts';
          if (k === 'pivotBarItemRenderer' && (v.pivotIdentifier === 'FEshorts' || (v.navigationEndpoint && v.navigationEndpoint.reelWatchEndpoint))) return 'shorts';
          if ((k === 'guideEntryRenderer' || k === 'compactLinkRenderer') && v.navigationEndpoint && v.navigationEndpoint.reelWatchEndpoint) return 'shorts';
          if (k === 'tabRenderer' && /\/shorts\/?$/.test(urlOf(v.endpoint))) return 'shorts';
          if ((k === 'chipCloudChipRenderer' || k === 'searchFilterRenderer') && /^shorts$/i.test(txt(v.text || v.label).trim())) return 'shorts';
          if (k === 'lockupViewModel' && /SHORT/.test(v.contentType || '')) return 'shorts';
        }
        if (S.hideAds && k === 'engagementPanelSectionListRenderer' && /ads/.test(v.targetId || '')) return 'ads';
        if (S.hideMixes && (MIX_KEYS.has(k) || (k === 'lockupViewModel' && /PLAYLIST|PODCAST|MIX/.test(v.contentType || '')))) return 'filtered';
        if (S.hideShelves && (k === 'richShelfRenderer' || k === 'shelfRenderer') && !v.isShorts) return 'filtered';
        if (S.hideRelated && k === 'itemSectionRenderer' && v.sectionIdentifier === 'related-items') return 'filtered';
        if (VIDEO_KEYS.has(k)) { const r = videoReason(v); if (r) return r; }
      }
      return null;
    }

    function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 60) return;
      if (Array.isArray(o)) {
        for (let i = o.length - 1; i >= 0; i--) {
          const r = itemReason(o[i]);
          if (r) { o.splice(i, 1); stats[r]++; } else walk(o[i], depth + 1);
        }
        return;
      }
      if (S.hideAds) for (const k of PLAYER_AD_KEYS) if (k in o) { delete o[k]; stats.ads++; }
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') walk(v, depth + 1); }
    }

    let reported = false, statsTimer = 0;
    function prune(obj) {
      try {
        if (!S.enabled || !obj || typeof obj !== 'object') return obj;
        // само отговори на YouTube (всички имат responseContext), за да не пипаме чужди данни
        if (!('responseContext' in obj) && !('playerResponse' in obj) && !('onResponseReceivedActions' in obj)) return obj;
        walk(obj, 0);
        if (!reported) { reported = true; document.documentElement.setAttribute('data-ytc-hook', 'on'); }
        if (!statsTimer) statsTimer = setTimeout(() => {
          statsTimer = 0;
          document.documentElement.setAttribute('data-ytc-stats', JSON.stringify(stats));
        }, 500);
      } catch (e) { /* никога не чупим страницата */ }
      return obj;
    }

    // 1) JSON.parse – основният път на m.youtube.com
    const hookedParse = function parse(text, reviver) {
      const r = origParse.apply(this, arguments);
      return (typeof text === 'string' && text.length > 200) ? prune(r) : r;
    };
    try { Object.defineProperty(hookedParse, 'toString', { value: () => origParse.toString() }); } catch (e) { /* */ }
    JSON.parse = hookedParse;

    // 2) fetch(...).json()
    try {
      const origJson = Response.prototype.json;
      Response.prototype.json = function () { return origJson.apply(this, arguments).then(prune); };
    } catch (e) { /* */ }

    // 3) XHR с responseType = "json"
    try {
      const d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
      if (d && d.get) Object.defineProperty(XMLHttpRequest.prototype, 'response', {
        configurable: true, enumerable: d.enumerable,
        get() { const r = d.get.call(this); return this.responseType === 'json' ? prune(r) : r; },
      });
    } catch (e) { /* */ }

    // 4) ако някой ден данните дойдат като готов обект, а не като низ
    for (const name of ['ytInitialData', 'ytInitialPlayerResponse']) {
      try {
        let val = window[name];
        Object.defineProperty(window, name, {
          configurable: true,
          get() { return val; },
          set(v) { val = (v && typeof v === 'object') ? prune(v) : v; },
        });
      } catch (e) { /* */ }
    }
  };
})();

/* YT Контрол – слой "DOM" (резервен): CSS скриване, пренасочване на Shorts, пропускане на видео реклами */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  const CSS = {
    blockShorts: [
      'ytm-reel-shelf-renderer', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)', 'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)',
      'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)', 'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
      'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2)',
      'ytm-rich-item-renderer:has(a[href^="/shorts/"])', 'ytm-video-with-context-renderer:has(a[href^="/shorts/"])',
      'ytm-compact-video-renderer:has(a[href^="/shorts/"])', 'ytm-media-item:has(a[href^="/shorts/"])',
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)', 'ytm-reel-item-renderer',
    ],
    hideAds: [
      'ad-slot-renderer', 'ytm-rich-item-renderer:has(ad-slot-renderer)', 'ytm-promoted-sparkles-web-renderer',
      'ytm-promoted-video-renderer', 'ytm-companion-ad-renderer', 'ytm-companion-slot', 'ytm-promoted-sparkles-text-search-renderer',
      'ytm-item-section-renderer:has(> lazy-list > ad-slot-renderer:only-child)', 'ytm-statement-banner-renderer',
      'ytm-mealbar-promo-renderer', 'ytm-merch-shelf-renderer', '.ytp-ad-overlay-container', '.ytp-ad-image-overlay',
      '.ytp-suggested-action', '.ytp-featured-product', '.ytp-paid-content-overlay',
    ],
    hideRelated: [
      'ytm-item-section-renderer[section-identifier="related-items"]', 'ytm-watch ytm-feed-nudge-renderer',
    ],
    hideComments: [
      'ytm-comment-section-renderer', 'ytm-comments-entry-point-header-renderer',
      'ytm-item-section-renderer[section-identifier="comments-entry-point"]',
      'ytm-item-section-renderer[section-identifier="comment-item-section"]', 'comments-entry-point-teaser-view-model',
      'ytm-slim-video-metadata-section-renderer + ytm-item-section-renderer:has(comments-entry-point-teaser-view-model)',
    ],
    hideShelves: ['ytm-rich-section-renderer:has(ytm-rich-shelf-renderer)', 'ytm-shelf-renderer'],
  };
  const HOME_CSS = ['ytm-browse ytm-rich-grid-renderer', 'ytm-browse ytm-section-list-renderer', 'ytm-feed-filter-chip-bar-renderer'];
  const SKIP_SEL = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, ' +
    '.ytp-ad-skip-button-container button, button.ytp-ad-skip-button-text, .ytm-ad-skip-button';

  let S = YTC.defaults(), styleEl = null, scheduled = false, lastHref = '';
  const ad = { active: false, muted: false };
  YTC.domStats = { ads: 0 };

  function buildCSS() {
    if (!S.enabled) return '';
    const r = ['[data-ytc-hidden]{display:none!important}'];
    for (const k in CSS) if (S[k]) for (const sel of CSS[k]) r.push(sel + '{display:none!important}');
    if (S.hideHomeFeed) for (const sel of HOME_CSS) r.push('html.ytc-home ' + sel + '{display:none!important}');
    return r.join('\n'); // всяко правило отделно – непознат селектор не чупи останалите
  }
  function applyCSS() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'ytc-style'; }
    const css = buildCSS();
    if (styleEl.textContent !== css) styleEl.textContent = css;
    const parent = document.head || document.documentElement;
    if (parent && styleEl.parentNode !== parent) parent.appendChild(styleEl);
  }

  // ---------- Shorts адреси ----------
  function checkUrl() {
    if (!S.enabled || !S.blockShorts) return false;
    const p = location.pathname;
    const m = p.match(/^\/shorts\/([\w-]{5,})/);
    if (m) {
      document.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch (e) { /* */ } });
      location.replace(S.redirectShorts ? '/watch?v=' + m[1] : '/');
      return true;
    }
    if (/^\/shorts\/?$/.test(p)) { location.replace('/'); return true; }
    const ch = p.match(/^(\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+))\/shorts\/?$/);
    if (ch) { location.replace(ch[1] + '/videos'); return true; }
    return false;
  }
  function onClick(e) {
    if (!S.enabled || !S.blockShorts || !e.target || !e.target.closest) return;
    const a = e.target.closest('a[href*="/shorts"]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/shorts\/([\w-]{5,})/);
    if (!m && !/\/shorts\/?$/.test(href)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (m && S.redirectShorts) location.href = '/watch?v=' + m[1];
  }

  // ---------- Филтри по DOM (за случая, в който слоят "данни" не е активен) ----------
  const ITEM_SEL = 'ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-media-item, ytm-video-card-renderer, ' +
    'ytm-compact-playlist-renderer, ytm-compact-radio-renderer, ytm-playlist-renderer, ytm-radio-renderer';
  function lines(t) { return String(t || '').split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean); }
  function domFilter() {
    const hookOn = document.documentElement.getAttribute('data-ytc-hook') === 'on';
    const words = lines(S.blockedWords);
    const chans = lines(S.blockedChannels).map((x) => { const m = x.match(/@([^/?#\s]+)/); return m ? m[1] : x; });
    const need = !hookOn && (words.length || chans.length || S.hideLive || S.hideMixes || S.minDuration > 0);
    document.querySelectorAll(ITEM_SEL).forEach((it) => {
      const target = it.closest('ytm-rich-item-renderer') || it;
      let reason = null;
      if (need) {
        const tag = it.tagName.toLowerCase();
        const title = ((it.querySelector('h3, .media-item-headline, .compact-media-item-headline') || {}).textContent || '').toLowerCase();
        const by = ((it.querySelector('.ytm-badge-and-byline-item-byline, .media-item-byline, .compact-media-item-byline, ytm-badge-and-byline-renderer') || {}).textContent || '').toLowerCase();
        const handles = [...it.querySelectorAll('a[href*="/@"]')].map((a) => ((a.getAttribute('href') || '').match(/\/@([^/?#]+)/) || [])[1]).filter(Boolean).map((h) => decodeURIComponent(h).toLowerCase());
        const badge = ((it.querySelector('ytm-thumbnail-overlay-time-status-renderer, .badge-shape-wiz__text, .yt-badge-shape__text') || {}).textContent || '').trim();
        if (S.hideMixes && (/playlist|radio/.test(tag) || it.querySelector('a[href*="list="]'))) reason = 'mix';
        else if (S.hideLive && /^(live|на живо)$/i.test(badge)) reason = 'live';
        else if (words.length && words.some((w) => title.includes(w))) reason = 'word';
        else if (chans.length && chans.some((c) => handles.includes(c) || by.split('•').map((x) => x.trim()).includes(c))) reason = 'channel';
        else if (S.minDuration > 0) {
          const m = badge.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
          if (m && (+(m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) < S.minDuration * 60) reason = 'duration';
        }
      }
      if (S.blockShorts && it.querySelector('a[href^="/shorts/"]')) reason = 'shorts';
      if (reason) { if (target.getAttribute('data-ytc-hidden') !== reason) target.setAttribute('data-ytc-hidden', reason); }
      else if (target.hasAttribute('data-ytc-hidden')) target.removeAttribute('data-ytc-hidden');
    });
    if (S.blockShorts) {
      document.querySelectorAll('ytm-pivot-bar-item-renderer, ytm-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer, ' +
        'yt-tab-shape, .ytm-search-filter-group-renderer button, ytm-search-filter-renderer').forEach((e) => {
        const t = (e.getAttribute('tab-title') || e.textContent || '').trim();
        if (t === 'Shorts' && !e.hasAttribute('data-ytc-hidden')) e.setAttribute('data-ytc-hidden', 'shorts');
      });
    }
  }

  function pass() {
    scheduled = false;
    if (!document.documentElement) return;
    applyCSS();
    if (!S.enabled) return;
    if (location.href !== lastHref) { lastHref = location.href; if (checkUrl()) return; }
    document.documentElement.classList.toggle('ytc-home', location.pathname === '/');
    domFilter();
    if (YTC.onPass) YTC.onPass();
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(pass, 150); } }

  // ---------- Видео реклами (резервно) ----------
  function adTick() {
    if (!S.enabled || !S.skipVideoAds) return;
    const p = document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');
    const v = p && p.querySelector('video');
    if (p && v) {
      if (!ad.active) { ad.active = true; ad.muted = v.muted; YTC.domStats.ads++; }
      v.muted = true;
      try { if (v.playbackRate < 16) v.playbackRate = 16; } catch (e) { /* */ }
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) { try { v.currentTime = v.duration - 0.1; } catch (e) { /* */ } }
      p.querySelectorAll(SKIP_SEL).forEach((b) => { try { b.click(); } catch (e) { /* */ } });
    } else if (ad.active) {
      ad.active = false;
      const mv = document.querySelector('.html5-video-player video');
      if (mv) { mv.muted = ad.muted; if (mv.playbackRate >= 16) mv.playbackRate = 1; }
    }
  }

  YTC.domApply = function (ns) {
    S = ns;
    document.querySelectorAll('[data-ytc-hidden]').forEach((e) => e.removeAttribute('data-ytc-hidden'));
    lastHref = '';
    if (!S.enabled && document.documentElement) document.documentElement.classList.remove('ytc-home');
    pass();
  };

  YTC.domStart = function (initial) {
    S = initial;
    document.addEventListener('click', onClick, true);
    ['state-navigateend', 'yt-navigate-finish', 'popstate'].forEach((ev) => window.addEventListener(ev, schedule, true));
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
    setInterval(adTick, 250);
    setInterval(() => { if (location.href !== lastHref) schedule(); }, 800);
    schedule();
  };
})();

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

  // ---- 2) Слой "DOM" + интерфейс ----
  let S = YTC.load();
  YTC.domStart(S);
  YTC.uiStart(() => S, (ns) => {
    S = YTC.normalize(ns);
    YTC.save(S);
    YTC.domApply(S);
  });
})();
