// ==UserScript==
// @name         YT Контрол – блокер на Shorts и реклами (мобилен)
// @namespace    yt-control
// @version      3.1.0
// @description  Изрязва Shorts и рекламите от данните на m.youtube.com, преди да се покажат. Филтри по думи и канали, фокус режим.
// @match        https://m.youtube.com/*
// @match        https://radilovk.github.io/Game/yt-control/*
// @homepageURL  https://radilovk.github.io/Game/yt-control/
// @updateURL    https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js
// @downloadURL  https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

/* YT Контрол – настройки (само мобилна версия m.youtube.com) */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  YTC.VERSION = '3.1.0';
  YTC.KEY = 'ytc-settings';

  YTC.SCHEMA = [
    { group: 'Shorts' },
    { key: 'blockShorts', label: 'Блокирай Shorts напълно', hint: 'Изчезват навсякъде. Линк към Short не се отваря изобщо.', def: true },

    { group: 'Начална страница' },
    { key: 'smartHome', label: 'Предложения при отваряне', hint: 'По това, което гледаш, и по твоите интереси', def: true },

    { group: 'Гледане' },
    { key: 'resumePlayback', label: 'Продължавай оттам, докъдето си стигнал', hint: 'Видеото тръгва от мястото, където си спрял', def: true },
    { key: 'saveHistory', label: 'Пази история на гледане', hint: 'Само на това устройство. Виж „История“ на началната страница', def: true },
    { key: 'toolsButton', label: 'Бутон „Инструменти“ при гледане', hint: 'Скорост, таймер за сън, повторение', def: true },
    { key: 'sponsorBlock', label: 'Прескачай спонсорските части в клиповете', hint: 'Данни от общността SponsorBlock. Изпраща се само част от хеша на видеото', def: true },
    { key: 'backgroundPlay', label: 'Слушане във фонов режим', hint: 'Продължава при заключен екран и в други приложения', def: true },
    { key: 'showDates', label: 'Дата на качване навсякъде', hint: 'Добавя датата и в препоръките под видеото', def: true },
    { key: 'captionsButton', label: 'Бутон за изтегляне на надписи', hint: 'Бутон „CC“ при гледане на видео', def: true },

    { group: 'Реклами' },
    { key: 'hideAds', label: 'Премахвай рекламите от данните', hint: 'Най-чисто. Ако клиповете тръгват бавно – изключи го, остава прескачането', def: true },
    { key: 'skipVideoAds', label: 'Прескачай видео рекламите', hint: 'Ако мине реклама: скрита, без звук, превъртана за миг', def: true },

    { group: 'Съдържание' },
    { key: 'hideHomeFeed', label: 'Фокус режим', hint: 'Празна начална страница – без никакви предложения', def: false },
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

    // ---------- Слушане във фонов режим ----------
    // YouTube спира видеото, когато страницата стане "скрита" (заключен екран, друго приложение).
    // Страницата винаги вижда "visible", а събитието visibilitychange не стига до кода на YouTube.
    if (S.enabled && S.backgroundPlay !== false) {
      const vis = { hidden: false, webkitHidden: false, visibilityState: 'visible', webkitVisibilityState: 'visible' };
      for (const k in vis) {
        try { Object.defineProperty(Document.prototype, k, { configurable: true, get: () => vis[k] }); } catch (e) { /* */ }
        try { Object.defineProperty(document, k, { configurable: true, get: () => vis[k] }); } catch (e) { /* */ }
      }
      const stop = (e) => { e.stopImmediatePropagation(); };
      for (const t of ['visibilitychange', 'webkitvisibilitychange']) {
        window.addEventListener(t, stop, true);
        document.addEventListener(t, stop, true);
      }
    }

    // ---------- Команди от интерфейса (друг "свят") към плейъра ----------
    document.addEventListener('ytc-cmd', (e) => {
      let c = {};
      try { c = parse(String(e.detail || '{}')); } catch (x) { return; }
      const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      if (!p) return;
      try {
        if (c.cmd === 'cc-on') {
          if (p.loadModule) p.loadModule('captions');
          if (p.setOption) p.setOption('captions', 'track', c.lang ? { languageCode: c.lang } : {});
        } else if (c.cmd === 'cc-off') {
          if (p.setOption) p.setOption('captions', 'track', {});
          if (p.unloadModule) p.unloadModule('captions');
        } else if (c.cmd === 'play' && p.playVideo) p.playVideo();
        else if (c.cmd === 'pause' && p.pauseVideo) p.pauseVideo();
      } catch (x) { /* */ }
    });

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
      if (S.blockShorts && overlays.some((o) => o.thumbnailOverlayTimeStatusRenderer && o.thumbnailOverlayTimeStatusRenderer.style === 'SHORTS')) return 'shorts';
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

    const SKIP = new Set(['streamingData', 'responseContext', 'frameworkUpdates', 'microformat', 'trackingParams',
      'loggingDirectives', 'accessibility', 'accessibilityData', 'thumbnail', 'thumbnails', 'commandMetadata',
      'storyboards', 'captions', 'heartbeatParams', 'playbackTracking', 'videoDetails', 'attestation', 'annotations',
      'clickTrackingParams', 'serviceTrackingParams', 'webCommandMetadata', 'menu', 'richThumbnail', 'inlinePlaybackEndpoint']);
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
      for (const k in o) { if (SKIP.has(k)) continue; const v = o[k]; if (v && typeof v === 'object') walk(v, depth + 1); }
    }

    let reported = false, statsTimer = 0;
    function prune(obj) {
      try {
        if (!S.enabled || !obj || typeof obj !== 'object') return obj;
        // само отговори на YouTube (всички имат responseContext), за да не пипаме чужди данни
        if (!('responseContext' in obj) && !('playerResponse' in obj) && !('onResponseReceivedActions' in obj)) return obj;
        // езиците на надписите за текущото видео – за бутона "CC"
        if (obj.captions && obj.videoDetails && obj.captions.playerCaptionsTracklistRenderer) {
          const r = obj.captions.playerCaptionsTracklistRenderer;
          const tracks = (r.captionTracks || []).map((t) => ({ lang: t.languageCode, name: txt(t.name), kind: t.kind || '', tr: !!t.isTranslatable }));
          document.documentElement.setAttribute('data-ytc-cc', JSON.stringify({ v: obj.videoDetails.videoId, tracks }));
        }
        walk(obj, 0);
        if (!reported) { reported = true; document.documentElement.setAttribute('data-ytc-hook', 'on'); }
        if (!statsTimer) statsTimer = setTimeout(() => {
          statsTimer = 0;
          document.documentElement.setAttribute('data-ytc-stats', JSON.stringify(stats));
        }, 500);
      } catch (e) { /* никога не чупим страницата */ }
      return obj;
    }

    // 0) YouTube е SPA: при докосване на Short сменя адреса с history.pushState. Спираме това още тук.
    try {
      for (const fn of ['pushState', 'replaceState']) {
        const orig = history[fn];
        history[fn] = function (state, title, url) {
          if (S.enabled && S.blockShorts && url && /^\/shorts(\/|$)/.test(new URL(String(url), location.href).pathname)) {
            stats.shorts++;
            document.dispatchEvent(new CustomEvent('ytc-shorts-blocked'));
            return undefined;
          }
          return orig.apply(this, arguments);
        };
      }
    } catch (e) { /* */ }

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

/* YT Контрол – слой "DOM" (резервен): CSS скриване, блокиране на Shorts адреси, пропускане на видео реклами */
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
    if (S.blockShorts) r.push('html.ytc-shorts-page body{visibility:hidden!important}', 'ytm-shorts-player, ytm-reel-watch-player, ytm-reel-player-overlay-renderer, shorts-video{display:none!important}');
    // Когато слоят "данни" работи, рекламите и Shorts изобщо не стигат до страницата.
    // Тогава пропускаме скъпите :has() селектори – те карат браузъра да преизчислява стиловете при всяка промяна.
    const hookOn = document.documentElement && document.documentElement.getAttribute('data-ytc-hook') === 'on';
    for (const k in CSS) if (S[k]) for (const sel of CSS[k]) { if (hookOn && sel.includes(':has(')) continue; r.push(sel + '{display:none!important}'); }
    if (S.skipVideoAds) r.push('.ytc-ad-skip video{opacity:0!important}',
      '.ytc-ad-skip::after{content:"Пропускане на реклама…";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:#000;color:#aaa;font:14px sans-serif;z-index:60;pointer-events:none}');
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
    if (m || /^\/shorts\/?$/.test(p)) {
      document.querySelectorAll('video').forEach((v) => { try { v.muted = true; v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* */ } });
      try { sessionStorage.setItem('ytc-toast', '1'); } catch (e) { /* */ }
      location.replace('/');
      return true;
    }
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
    YTC.toast && YTC.toast('Shorts е блокиран');
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
    document.documentElement.classList.toggle('ytc-shorts-page', !!S.blockShorts && /^\/shorts(\/|$)/.test(location.pathname));
    if (location.href !== lastHref) { lastHref = location.href; if (checkUrl()) return; }
    document.documentElement.classList.toggle('ytc-home', location.pathname === '/');
    // резервното филтриране по DOM е нужно само ако слоят "данни" не е активен
    if (document.documentElement.getAttribute('data-ytc-hook') !== 'on') domFilter();
    if (YTC.onPass) YTC.onPass();
    if (YTC.featuresTick) YTC.featuresTick();
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(pass, 250); } }

  // ---------- Видео реклами (резервно) ----------
  function adTick() {
    if (!S.enabled || !S.skipVideoAds) return;
    const p = document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');
    const v = p && p.querySelector('video');
    if (p && v) {
      if (!ad.active) { ad.active = true; ad.muted = v.muted; YTC.domStats.ads++; p.classList.add('ytc-ad-skip'); }
      v.muted = true;
      try { if (v.playbackRate < 16) v.playbackRate = 16; } catch (e) { /* */ }
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) { try { v.currentTime = v.duration - 0.1; } catch (e) { /* */ } }
      p.querySelectorAll(SKIP_SEL).forEach((b) => { try { b.click(); } catch (e) { /* */ } });
    } else if (ad.active) {
      ad.active = false;
      document.querySelectorAll('.ytc-ad-skip').forEach((e) => e.classList.remove('ytc-ad-skip'));
      const mv = document.querySelector('.html5-video-player video');
      if (mv) { mv.muted = ad.muted; if (mv.playbackRate >= 16) mv.playbackRate = YTC.desiredSpeed ? YTC.desiredSpeed() : 1; }
    }
  }

  YTC.domApply = function (ns) {
    S = ns;
    if (YTC.featuresApply) YTC.featuresApply(ns);
    if (YTC.toolsApply) YTC.toolsApply(ns);
    document.querySelectorAll('[data-ytc-hidden]').forEach((e) => e.removeAttribute('data-ytc-hidden'));
    lastHref = '';
    if (!S.enabled && document.documentElement) document.documentElement.classList.remove('ytc-home');
    pass();
  };

  YTC.domStart = function (initial) {
    S = initial;
    if (YTC.featuresApply) YTC.featuresApply(initial);
    if (YTC.toolsApply) YTC.toolsApply(initial);
    document.addEventListener('click', onClick, true);
    ['state-navigateend', 'yt-navigate-finish', 'popstate'].forEach((ev) => window.addEventListener(ev, schedule, true));
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
    setInterval(adTick, 150);
    setInterval(() => { if (location.href !== lastHref) pass(); }, 250);
    schedule();
  };
})();

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

  function viewsPart(parts) {
    const w = parts.find((p) => /показв|views|гледа/i.test(p));
    if (w) return w;
    const n = parts.find((p) => !isDateText(p) && /^[\d\s.,\u00a0]+(млрд|млн|хил|[KMB])?\.?$/i.test(p.trim()));
    return n ? n.trim() + ' показвания' : '';
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
      id: v.contentId, title: txt(md.title), channel: parts[0] || '', handle: '',
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
        if (id === 'hist') showHistory(); else startFeed(true);
      });
      chips.appendChild(c);
    };
    add('all', 'За теб');
    add('hist', '🕘 История');
    ints.forEach((i) => add('i:' + i, i));
    add('edit', ints.length ? '✎ Интереси' : '＋ Избери интереси');
    renderSorts();
  }

  function renderSorts() {
    const row = feedRoot.querySelector('.sorts');
    while (row.firstChild) row.removeChild(row.firstChild);
    if (activeChip === 'hist') { row.style.display = 'none'; return; }
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
    a.addEventListener('click', (e) => { e.preventDefault(); YTC.go('/watch?v=' + it.id); });
    const th = el('div', 'th');
    const img = el('img'); img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.src = it.thumb || ('https://i.ytimg.com/vi/' + it.id + '/hqdefault.jpg');
    th.appendChild(img);
    if (it.live) th.appendChild(el('span', 'dur live', 'НА ЖИВО'));
    else if (it.dur) th.appendChild(el('span', 'dur', it.dur));
    const hh = YTC.history && YTC.history.get(it.id);
    if (hh && hh.len && (hh.pos || hh.done)) {
      th.appendChild(el('div', 'progbg'));
      const p = el('div', 'prog'); p.style.width = (hh.done ? 100 : Math.min(100, Math.round(hh.pos / hh.len * 100))) + '%';
      th.appendChild(p);
    }
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
    if (!feedList || feedState.loading || feedState.done || activeChip === 'hist') return;
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

/* YT Контрол – старт. Работи и когато мениджърът пуска скрипта в "content" света (Safari/Userscripts),
   и когато го пуска директно в страницата (Tampermonkey). */
(function () {
  'use strict';
  const YTC = globalThis.YTC;
  if (window.top !== window || window.__ytcBoot) return;
  // На страницата за инсталиране само съобщаваме, че модулът е инсталиран
  if (location.hostname !== 'm.youtube.com') {
    const mark = () => {
      document.documentElement.setAttribute('data-ytc-installed', YTC.VERSION);
      document.dispatchEvent(new CustomEvent('ytc-installed'));
    };
    if (document.documentElement) mark(); else document.addEventListener('DOMContentLoaded', mark);
    return;
  }
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
  const setS = (ns) => {
    S = YTC.normalize(ns);
    YTC.save(S);
    YTC.domApply(S);
  };
  YTC.saveSettings = setS;
  YTC.uiStart(() => S, setS);
})();
