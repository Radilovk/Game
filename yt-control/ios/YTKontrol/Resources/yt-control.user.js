// ==UserScript==
// @name         YT Контрол – блокер на Shorts и реклами (мобилен)
// @namespace    yt-control
// @version      3.7.0
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
  YTC.VERSION = '3.7.0';
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
    { key: 'pip', label: 'Картина в картината (Android)', hint: 'При излизане от приложението видеото продължава в малко прозорче', def: true },
    { key: 'backgroundPlay', label: 'Слушане във фонов режим', hint: 'Продължава при заключен екран и в други приложения', def: true },
    { key: 'navButtons', label: 'Бутон „Назад“ и подреден хедър', hint: '‹ горе на всяка страница, връщане на същото място, 🔍, без „Отваряне на приложението“', def: true },
    { key: 'gestures', label: 'Жестове върху видеото', hint: 'Настрани – превъртане; вляво нагоре/надолу – яркост; вдясно – звук; в средата надолу – затваряне; задръж – 2×', def: true },
    { key: 'normalizeAudio', label: 'Изравнявай силата на звука', hint: 'Тихите клипове по-силно, силните по-тихо. Ако на iPhone звукът спре при заключен екран – изключи го', def: false },
    { key: 'watchStats', label: 'Статистика на гледането', hint: 'Време по дни и най-гледани канали – чип „Статистика“ на началната страница', def: true },
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
    // "картина в картината" (Android): в малкия прозорец – само видеото, на целия прозорец
    const PIP = 'html.ytc-pip, html.ytc-pip body{overflow:hidden!important;background:#000!important}' +
      'html.ytc-pip .html5-video-player, html.ytc-pip #player-container-id, html.ytc-pip .player-container{position:fixed!important;inset:0!important;' +
      'width:100vw!important;height:100vh!important;max-height:none!important;z-index:2147483647!important;background:#000!important;transform:none!important}' +
      'html.ytc-pip .html5-video-player video{position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;object-fit:contain!important}' +
      'html.ytc-pip .ytp-chrome-bottom, html.ytc-pip .ytm-autonav-bar, html.ytc-pip .player-controls-content, html.ytc-pip #ytc-app, html.ytc-pip #ytc-tools,' +
      ' html.ytc-pip #ytc-cc, html.ytc-pip #ytc-home, html.ytc-pip ytm-mobile-topbar-renderer, html.ytc-pip ytm-pivot-bar-renderer{display:none!important}';
    const css = buildCSS() + '\n' + PIP;
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
    if (YTC.mediaApply) YTC.mediaApply(ns);
    if (YTC.navApply) YTC.navApply(ns);
    document.querySelectorAll('[data-ytc-hidden]').forEach((e) => e.removeAttribute('data-ytc-hidden'));
    lastHref = '';
    if (!S.enabled && document.documentElement) document.documentElement.classList.remove('ytc-home');
    pass();
  };

  YTC.domStart = function (initial) {
    S = initial;
    if (YTC.featuresApply) YTC.featuresApply(initial);
    if (YTC.toolsApply) YTC.toolsApply(initial);
    if (YTC.mediaApply) YTC.mediaApply(initial);
    if (YTC.navApply) YTC.navApply(initial);
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
  const FAV_KEY = 'ytc-fav';
  const fav = {
    all() { return LS.get(FAV_KEY, []); },
    has(id) { return !!id && this.all().some((x) => x.id === id); },
    add(it) { if (!it || !it.id || this.has(it.id)) return; const a = this.all(); a.unshift({ id: it.id, title: it.title, channel: it.channel, dur: it.dur, thumb: it.thumb, t: Date.now() }); LS.set(FAV_KEY, a.slice(0, 1000)); },
    remove(id) { LS.set(FAV_KEY, this.all().filter((x) => x.id !== id)); },
  };
  const PL_KEY = 'ytc-playlists';
  const pls = {
    all() { return LS.get(PL_KEY, []); },
    get(id) { return this.all().find((p) => p.id === id) || null; },
    save(a) { LS.set(PL_KEY, a); },
    create(name) { const a = this.all(); const p = { id: 'p' + Date.now().toString(36), name: String(name).slice(0, 60), items: [], t: Date.now() }; a.unshift(p); this.save(a); return p; },
    rename(id, name) { const a = this.all(); const p = a.find((x) => x.id === id); if (p) { p.name = String(name).slice(0, 60); this.save(a); } },
    remove(id) { this.save(this.all().filter((p) => p.id !== id)); },
    has(id, vid) { const p = this.get(id); return !!(p && p.items.some((x) => x.id === vid)); },
    add(id, it) { const a = this.all(); const p = a.find((x) => x.id === id); if (!p || !it || !it.id || p.items.some((x) => x.id === it.id)) return; p.items.push({ id: it.id, title: it.title, channel: it.channel, dur: it.dur, thumb: it.thumb, t: Date.now() }); p.items = p.items.slice(-1000); this.save(a); },
    drop(id, vid) { const a = this.all(); const p = a.find((x) => x.id === id); if (p) { p.items = p.items.filter((x) => x.id !== vid); this.save(a); } },
  };
  YTC.subs = subs; YTC.later = later; YTC.fav = fav; YTC.playlists = pls;

  /** Лист „Добави в плейлист“ – самостоятелен (ползва се и от „Инструменти“). */
  YTC.pickPlaylist = function (it) {
    if (!it || !it.id || !document.body) return;
    const host = el('div'); host.id = 'ytc-plpick';
    const r = host.attachShadow({ mode: 'open' });
    r.appendChild(el('style', null, FEED_CSS));
    const back = el('div', 'mback'), sh = el('div', 'msheet');
    back.style.zIndex = sh.style.zIndex = '2147483647';
    const close = () => host.remove();
    back.addEventListener('click', close);
    const draw = () => {
      while (sh.firstChild) sh.removeChild(sh.firstChild);
      sh.appendChild(el('div', 'mtitle', 'Добави в плейлист'));
      for (const p of pls.all()) {
        const on = p.items.some((x) => x.id === it.id);
        const b = el('button', 'mrow', (on ? '✓ ' : '📂 ') + p.name + '  ·  ' + p.items.length);
        b.addEventListener('click', () => {
          if (on) { pls.drop(p.id, it.id); toastMsg('Махнато от „' + p.name + '“'); }
          else { pls.add(p.id, it); toastMsg('Добавено в „' + p.name + '“'); }
          close();
        });
        sh.appendChild(b);
      }
      const inp = el('input'); inp.placeholder = 'Нов плейлист – име'; inp.maxLength = 60;
      const mk = el('button', 'mrow', '＋ Създай и добави');
      const create = () => { const n = inp.value.trim(); if (!n) { inp.focus(); return; } const p = pls.create(n); pls.add(p.id, it); toastMsg('Добавено в „' + n + '“'); close(); };
      mk.addEventListener('click', create);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
      sh.appendChild(inp); sh.appendChild(mk);
    };
    draw();
    r.appendChild(back); r.appendChild(sh);
    document.body.appendChild(host);
  };
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
  .srch{display:block;width:calc(100% - 24px);margin:0 12px 12px;border:0;border-radius:20px;padding:9px 14px;font:15px inherit;outline:none}
  .dark .srch{background:#272727;color:#f1f1f1}.light .srch{background:#f2f2f2;color:#0f0f0f}
  .plrow{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;color:inherit;font:15px inherit;text-align:left;padding:10px 12px}
  .plrow img{width:96px;height:54px;border-radius:8px;object-fit:cover;background:#333;flex:0 0 auto}
  .plrow .ph{width:96px;height:54px;border-radius:8px;background:#333;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:24px}
  .plrow span{flex:1}.plrow small{display:block;opacity:.6;font-size:12.5px;margin-top:2px}
  .msheet input{display:block;width:calc(100% - 36px);margin:6px 18px 10px;border:1px solid #444;border-radius:10px;background:#181818;color:#f1f1f1;padding:10px;font:16px inherit}
  .stat{padding:0 12px 16px}
  .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
  .tile{border-radius:12px;padding:10px;text-align:center}
  .dark .tile{background:#272727}.light .tile{background:#f2f2f2}
  .tile b{display:block;font-size:19px}.tile span{font-size:11.5px;opacity:.7}
  .bars{display:flex;align-items:flex-end;gap:6px;height:120px;margin:6px 0 4px}
  .bars div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:10.5px}
  .bars i{display:block;width:100%;border-radius:4px 4px 0 0;background:#ff0033;min-height:2px}
  .bars small{opacity:.6;margin-top:3px}.bars em{font-style:normal;opacity:.8;margin-bottom:2px}
  .stat h4{margin:14px 0 8px;font-size:15px}
  .crow{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
  .crow span:last-child{opacity:.7}
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
  .list>.hhead,.list>.srch,.list>.plrow,.list>.stat,.list>.msg,.list>.cont,.list>.more{grid-column:1/-1}
  .contents{display:contents}
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
      if (YTC.navSaveScroll) YTC.navSaveScroll();
      window.__ytcFwd = Date.now();
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

  // При отваряне на видео началната страница само се скрива (не се изтрива) – при връщане е на същото място.
  let feedScroll = 0, feedRestore = false;
  const feedWrap = () => feedRoot && feedRoot.querySelector('.wrap');
  function hideFeed() {
    if (!feedHost || feedHost.dataset.hidden) return;
    const w = feedWrap(); if (w) feedScroll = w.scrollTop;
    feedHost.dataset.hidden = '1';
    feedHost.style.visibility = 'hidden'; feedHost.style.pointerEvents = 'none';
    document.documentElement.classList.remove('ytc-feed-on');
  }
  function mountFeed() {
    if (feedHost && feedHost.isConnected) {
      if (feedHost.dataset.hidden) {
        delete feedHost.dataset.hidden;
        feedHost.style.visibility = ''; feedHost.style.pointerEvents = '';
        document.documentElement.classList.add('ytc-feed-on');
        const w = feedWrap(); if (w && Math.abs(w.scrollTop - feedScroll) > 2) w.scrollTop = feedScroll;
      }
      placeFeed(); return;
    }
    // YouTube е изтрил слоя – изграждаме го наново и после връщаме мястото
    if (feedScroll > 0) feedRestore = true;
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
    feedScroll = 0;
    document.documentElement.classList.remove('ytc-feed-on');
  }

  let activeChip = 'all';
  YTC.feedChip = () => (feedHost && !feedHost.dataset.hidden ? activeChip : 'all');
  YTC.feedHomeChip = () => { if (!feedRoot) return; activeChip = 'all'; renderChips(); const w = feedWrap(); if (w) w.scrollTop = 0; startFeed(false); };
  const LOCAL_CHIP = /^(hist|subs|later|fav|pl|pl:.+|stats)$/;
  function openChip(id) {
    if (id === 'hist') showHistory(); else if (id === 'subs') showSubs(); else if (id === 'later') showLater();
    else if (id === 'fav') showFav(); else if (id === 'pl') showPlaylists(); else if (id.startsWith('pl:')) showPlaylist(id.slice(3));
    else if (id === 'stats') showStats(); else startFeed(true);
  }
  function renderChips() {
    const chips = feedRoot.querySelector('.chips');
    while (chips.firstChild) chips.removeChild(chips.firstChild);
    const ints = LS.get(I_KEY, []);
    const add = (id, label) => {
      const c = el('button', 'chip' + (activeChip === id || (id === 'pl' && activeChip.startsWith('pl:')) ? ' on' : ''), label);
      c.addEventListener('click', () => {
        if (id === 'edit') { showPicker(); return; }
        activeChip = id; renderChips(); if (feedList) feedList.parentNode.scrollTop = 0;
        openChip(id);
      });
      chips.appendChild(c);
    };
    add('all', 'За теб');
    add('subs', '📺 Абонаменти');
    add('fav', '❤️ Любими');
    add('pl', '📂 Плейлисти');
    add('later', '⏱ По-късно');
    add('hist', '🕘 История');
    add('stats', '📊 Статистика');
    ints.forEach((i) => add('i:' + i, i));
    add('edit', ints.length ? '✎ Интереси' : '＋ Избери интереси');
    renderSorts();
  }

  function renderSorts() {
    const row = feedRoot.querySelector('.sorts');
    while (row.firstChild) row.removeChild(row.firstChild);
    if (LOCAL_CHIP.test(activeChip)) { row.style.display = 'none'; return; }
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

  // ---------- Списък с търсене (История, Любими, По-късно, плейлисти) ----------
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function listView(o) {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const items = o.items;
    if (o.before) feedList.appendChild(o.before);
    if (!items.length) { feedList.appendChild(msg(o.empty[0], o.empty[1])); return; }
    const head = el('div', 'hhead');
    const h4 = el('h4', null, o.count(items.length));
    head.appendChild(h4);
    if (o.action) { const b = el('button', 'lnk', o.action[0]); b.addEventListener('click', o.action[1]); head.appendChild(b); }
    feedList.appendChild(head);
    const q = el('input', 'srch'); q.type = 'search'; q.placeholder = '🔎 Търси по заглавие или канал'; q.autocapitalize = 'off';
    if (items.length > 3) feedList.appendChild(q);
    const box = el('div', 'contents');
    feedList.appendChild(box);
    const draw = () => {
      while (box.firstChild) box.removeChild(box.firstChild);
      const words = norm(q.value).split(/\s+/).filter(Boolean);
      const shown = words.length ? items.filter((x) => { const t = norm(x.title + ' ' + x.channel); return words.every((w) => t.includes(w)); }) : items;
      h4.textContent = words.length ? 'Намерени: ' + shown.length : o.count(items.length);
      if (!shown.length) { box.appendChild(el('div', 'more', 'Нищо не е намерено')); return; }
      for (const x of shown.slice(0, 300)) {
        const c = card(o.map ? o.map(x) : x);
        if (o.remove) {
          const del = el('button', 'x', '✕');
          del.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); o.remove(x); items.splice(items.indexOf(x), 1); c.remove(); h4.textContent = o.count(items.length); });
          c.appendChild(del);
        }
        box.appendChild(c);
      }
    };
    let deb; q.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(draw, 150); });
    draw();
  }
  const nVideos = (n) => n + ' ' + (n === 1 ? 'видео' : 'видеа');

  // ---------- История с прогрес ----------
  function showHistory() {
    listView({
      items: (YTC.history ? YTC.history.all() : []).slice(),
      empty: ['Историята е празна', 'Видеата, които гледаш, ще се появяват тук – и ще продължават оттам, докъдето си стигнал.'],
      count: nVideos,
      action: ['Изчисти историята', () => { if (confirm('Да се изчисти ли цялата история на гледане?')) { YTC.history.clear(); showHistory(); } }],
      map: (x) => ({ id: x.id, title: x.title, channel: x.channel, dur: x.len ? fmtDur(x.len) : '', views: '',
        date: (x.done ? 'гледано' : x.pos ? 'спряно на ' + fmtDur(x.pos) : '') + ' • ' + ago(x.t) }),
      remove: (x) => YTC.history.remove(x.id),
    });
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
    if (fav.has(it.id)) act('💔 Махни от „Любими“', () => { fav.remove(it.id); if (activeChip === 'fav') cardEl.remove(); toastMsg('Махнато от „Любими“'); });
    else act('❤️ Добави в „Любими“', () => { fav.add(it); toastMsg('❤️ Добавено в „Любими“'); });
    act('📂 Добави в плейлист', () => YTC.pickPlaylist(it));
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
    listView({
      items: later.all(),
      empty: ['Списъкът е празен', 'Запазвай видеа с „⋮ → Гледай по-късно“ или от бутона „Инструменти“ при гледане.'],
      count: (n) => nVideos(n) + ' за по-късно',
      remove: (x) => later.remove(x.id),
    });
  }

  // ---------- Любими ----------
  function showFav() {
    listView({
      items: fav.all(),
      empty: ['Нямаш любими видеа', 'Добавяй с „⋮ → Добави в „Любими““ на картите или с 🤍 от бутона „Инструменти“ при гледане.'],
      count: (n) => n + ' ' + (n === 1 ? 'любимо видео' : 'любими видеа'),
      remove: (x) => fav.remove(x.id),
    });
  }

  // ---------- Плейлисти ----------
  function showPlaylists() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const list = pls.all();
    const head = el('div', 'hhead');
    head.appendChild(el('h4', null, list.length ? list.length + ' ' + (list.length === 1 ? 'плейлист' : 'плейлиста') : 'Плейлисти'));
    const nb = el('button', 'lnk', '＋ Нов плейлист');
    nb.addEventListener('click', () => { const n = (prompt('Име на плейлиста') || '').trim(); if (n) { pls.create(n); showPlaylists(); } });
    head.appendChild(nb);
    feedList.appendChild(head);
    if (!list.length) { feedList.appendChild(msg('Нямаш плейлисти', 'Създай с „＋ Нов плейлист“ или от „⋮ → Добави в плейлист“ на всяко видео.')); return; }
    for (const p of list) {
      const b = el('button', 'plrow');
      const f = p.items[0];
      if (f) { const im = el('img'); im.alt = ''; im.loading = 'lazy'; im.src = f.thumb || 'https://i.ytimg.com/vi/' + f.id + '/mqdefault.jpg'; b.appendChild(im); }
      else b.appendChild(el('div', 'ph', '📂'));
      const t = el('span', null, p.name); t.appendChild(el('small', null, nVideos(p.items.length)));
      b.appendChild(t);
      b.addEventListener('click', () => { activeChip = 'pl:' + p.id; renderChips(); showPlaylist(p.id); });
      feedList.appendChild(b);
    }
  }
  function showPlaylist(id) {
    const p = pls.get(id);
    if (!p) { activeChip = 'pl'; renderChips(); showPlaylists(); return; }
    const bar = el('div', 'hhead');
    const bk = el('button', 'lnk', '‹ Плейлисти');
    bk.addEventListener('click', () => { activeChip = 'pl'; renderChips(); showPlaylists(); });
    bar.appendChild(bk);
    const tools = el('div');
    const play = el('button', 'lnk', '▶ Пусни');
    play.style.marginRight = '14px';
    play.addEventListener('click', () => { const q = pls.get(id); if (q && q.items.length) { YTC.playQueue(q.items.map((x) => x.id), q.name); } });
    const ren = el('button', 'lnk', 'Преименувай');
    ren.style.marginRight = '14px';
    ren.addEventListener('click', () => { const n = (prompt('Ново име', p.name) || '').trim(); if (n) { pls.rename(id, n); showPlaylist(id); } });
    const del = el('button', 'lnk', 'Изтрий');
    del.style.color = '#ff453a';
    del.addEventListener('click', () => { if (confirm('Да се изтрие ли плейлистът „' + p.name + '“?')) { pls.remove(id); activeChip = 'pl'; renderChips(); showPlaylists(); } });
    if (p.items.length) tools.appendChild(play);
    tools.appendChild(ren); tools.appendChild(del);
    bar.appendChild(tools);
    listView({
      before: bar,
      items: p.items.slice(),
      empty: ['„' + p.name + '“ е празен', 'Добавяй видеа с „⋮ → Добави в плейлист“ или от „Инструменти“ при гледане.'],
      count: (n) => p.name + ' · ' + nVideos(n),
      remove: (x) => pls.drop(id, x.id),
    });
  }

  // ---------- Пускане на списък едно след друго ----------
  const Q_KEY = 'ytc-queue';
  YTC.playQueue = function (ids, name) {
    if (!ids || !ids.length) return;
    try { sessionStorage.setItem(Q_KEY, JSON.stringify({ ids, i: 0, name: name || '' })); } catch (e) { /* */ }
    YTC.go('/watch?v=' + ids[0]);
  };
  // в края на видеото от списъка – следващото от него (вместо автоматичното на YouTube)
  document.addEventListener('ended', () => {
    let q = null;
    try { q = JSON.parse(sessionStorage.getItem(Q_KEY) || 'null'); } catch (e) { /* */ }
    if (!q || !q.ids) return;
    const cur = curVideo();
    const i = q.ids.indexOf(cur);
    if (i < 0) { try { sessionStorage.removeItem(Q_KEY); } catch (e) { /* */ } return; }
    if (i + 1 >= q.ids.length) { try { sessionStorage.removeItem(Q_KEY); } catch (e) { /* */ } toastMsg('Плейлистът „' + q.name + '“ свърши'); return; }
    q.i = i + 1;
    try { sessionStorage.setItem(Q_KEY, JSON.stringify(q)); } catch (e) { /* */ }
    toastMsg('▶ Следва ' + (i + 2) + '/' + q.ids.length + ' от „' + q.name + '“');
    setTimeout(() => YTC.go('/watch?v=' + q.ids[i + 1]), 300);
  }, true);

  // ---------- Статистика ----------
  function showStats() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);
    const st = YTC.watchStats ? YTC.watchStats() : null;
    if (!st || !st.total) { feedList.appendChild(msg('Още няма статистика', 'Тук ще виждаш колко време гледаш всеки ден, колко видеа и кои канали гледаш най-много. Всичко остава само на това устройство.')); return; }
    const box = el('div', 'stat');
    const hm = (sec) => { const m = Math.round(sec / 60); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч ' + (m % 60) + ' м'; };
    const tiles = el('div', 'tiles');
    for (const [v, l] of [[hm(st.today), 'днес'], [hm(st.week / 7), 'средно на ден (7 дни)'], [String(st.todayVideos), 'видеа днес']]) {
      const t = el('div', 'tile'); t.appendChild(el('b', null, v)); t.appendChild(el('span', null, l)); tiles.appendChild(t);
    }
    box.appendChild(tiles);
    box.appendChild(el('h4', null, 'Последните 7 дни'));
    const bars = el('div', 'bars');
    const max = Math.max(60, ...st.days.map((d) => d.sec));
    for (const d of st.days) {
      const c = el('div');
      c.appendChild(el('em', null, d.sec >= 60 ? Math.round(d.sec / 60) + '' : ''));
      const i = el('i'); i.style.height = Math.round(d.sec / max * 100) + '%'; c.appendChild(i);
      c.appendChild(el('small', null, d.label));
      bars.appendChild(c);
    }
    box.appendChild(bars);
    box.appendChild(el('div', 'sub', 'в минути · общо за 7 дни: ' + hm(st.week) + ' · за всички ' + st.daysCount + ' дни: ' + hm(st.total)));
    if (st.channels.length) {
      box.appendChild(el('h4', null, 'Най-гледани канали (30 дни)'));
      for (const [n, sec] of st.channels.slice(0, 10)) { const r = el('div', 'crow'); r.appendChild(el('span', null, n)); r.appendChild(el('span', null, hm(sec))); box.appendChild(r); }
    }
    const clr = el('button', 'lnk', 'Изчисти статистиката');
    clr.style.marginTop = '14px';
    clr.addEventListener('click', () => { if (confirm('Да се изчисти ли статистиката?')) { YTC.clearWatchStats(); showStats(); } });
    box.appendChild(clr);
    feedList.appendChild(box);
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
    if (feedRestore) { feedRestore = false; const w = feedWrap(); if (w) requestAnimationFrame(() => { w.scrollTop = feedScroll; }); }
    if (plain) LS.set(F_KEY, { t: Date.now(), items: items.slice(0, 40), seeds: feedState.seeds.slice(0, 20) });
  }
  function msg(h, p) { const b = el('div', 'msg'); b.appendChild(el('h2', null, h)); b.appendChild(el('p', null, p)); return b; }

  async function loadMore() {
    if (!feedList || feedState.loading || feedState.done || LOCAL_CHIP.test(activeChip)) return;
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
  // В iOS приложението (App Store / TestFlight) изтеглянето на надписи е изключено – правило 5.2.3 на Apple.
  const IOS_APP = () => !!(window.YTCApp && window.YTCApp.platform === 'ios');
  function ccWanted() { return S.enabled && S.captionsButton && location.pathname === '/watch' && !IOS_APP(); }
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
  // Само в първите секунди след излизането: пауза по-късно (заключен екран, слушалки, обаждане) е решение на потребителя.
  const BG_GRACE = 3000;
  let bgVal = window.__ytcBg, bgAt = bgVal ? Date.now() : 0;
  try {
    Object.defineProperty(window, '__ytcBg', { configurable: true,
      get: () => bgVal, set: (x) => { if (x && !bgVal) bgAt = Date.now(); bgVal = x; } });
  } catch (e) { /* */ }
  const justLeft = () => bgVal && Date.now() - bgAt < BG_GRACE;
  let wasPlaying = false, lastPauseAt = 0, lastPlayAt = 0, lastCmdAt = 0;
  const userPause = () => { window.__ytcUserPaused = true; lastCmdAt = Date.now(); };
  const userPlay = () => { window.__ytcUserPaused = false; lastCmdAt = Date.now(); };
  // Заключеният екран на iOS праща командите и директно към страницата (Media Session на YouTube).
  // Обвиваме обработчиците, за да знаем, че паузата е от потребителя и да не я „поправяме“.
  try {
    const ms = navigator.mediaSession;
    if (window.YTCApp && ms && typeof ms.setActionHandler === 'function' && !ms.__ytcWrapped) {
      const orig = ms.setActionHandler.bind(ms);
      const mark = (a) => { if (a === 'pause' || a === 'stop') userPause(); else if (a === 'play') userPlay(); };
      ms.setActionHandler = function (action, fn) {
        if (typeof fn !== 'function') return orig(action, fn);
        return orig(action, function (d) { mark(action); return fn.apply(this, arguments); });
      };
      ms.__ytcWrapped = true;
      // ако YouTube не е задал свои – наши (иначе WebKit спира видеото, без да знаем)
      const vid = () => document.querySelector('.html5-video-player video, video');
      orig('pause', () => { userPause(); const v = vid(); if (v) v.pause(); });
      orig('play', () => { userPlay(); const v = vid(); if (v) v.play().catch(() => {}); });
    }
  } catch (e) { /* */ }
  document.addEventListener('playing', () => { wasPlaying = true; lastPlayAt = Date.now(); if (Date.now() - lastCmdAt > 1500) window.__ytcUserPaused = false; }, true);
  document.addEventListener('pause', (e) => {
    const v = e.target;
    lastPauseAt = Date.now();
    if (!bgVal || window.__ytcUserPaused || !wasPlaying || !S.backgroundPlay || v.ended) { wasPlaying = !v.paused; return; }
    if (!justLeft()) { window.__ytcUserPaused = true; wasPlaying = false; return; }   // пауза от заключения екран / системата
    if (document.querySelector('.ad-showing')) return;
    setTimeout(() => { if (bgVal && !window.__ytcUserPaused && v.paused) v.play().catch(() => {}); }, 200);
  }, true);
  // докосване на пауза в самата страница = решение на потребителя
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.html5-video-player, .player-controls-content, ytm-custom-control')) {
      setTimeout(() => { const v = document.querySelector('.html5-video-player video'); if (v && v.paused) window.__ytcUserPaused = true; }, 300);
    }
  }, true);
  // команди от известието / заключения екран (през приложението)
  YTC.mediaCommand = function (cmd) {
    const v = document.querySelector('.html5-video-player video, video');
    if (!v) return;
    const now = Date.now();
    if (cmd === 'toggle') {
      // същото натискане може вече да е стигнало до страницата директно – не го обръщаме обратно
      if (v.paused && now - lastPauseAt < 1000) { userPause(); return; }
      if (!v.paused && now - lastPlayAt < 1000) { userPlay(); return; }
      cmd = v.paused ? 'play' : 'pause';
    }
    if (cmd === 'pause') { userPause(); if (!v.paused) v.pause(); }
    else if (cmd === 'play') { userPlay(); if (v.paused) v.play().catch(() => {}); }
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
    if (feedWanted()) mountFeed();
    else if (S.enabled && S.smartHome && !S.hideHomeFeed && feedHost) hideFeed();
    else unmountFeed();
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

  // ======================================================== Глави
  let chapters = [], chaptersFor = null;
  async function loadChapters(id) {
    chapters = []; chaptersFor = id;
    if (!YTC.webNext) return;
    const r = await YTC.webNext(id);
    if (chaptersFor !== id || !r) return;
    let mm = null;
    const walk = (o, d) => { if (mm || !o || typeof o !== 'object' || d > 25) return; if (o.multiMarkersPlayerBarRenderer) { mm = o.multiMarkersPlayerBarRenderer; return; } for (const k in o) walk(o[k], d + 1); };
    walk(r.playerOverlays || r, 0);
    const maps = (mm && mm.markersMap) || [];
    const m = maps.find((x) => /CHAPTERS/.test(x.key || '')) || maps[0];
    const list = (m && m.value && m.value.chapters) || [];
    chapters = list.map((c) => c.chapterRenderer).filter(Boolean).map((c) => ({
      title: (c.title && (c.title.simpleText || (c.title.runs || []).map((x) => x.text).join(''))) || '',
      start: (c.timeRangeStartMillis || 0) / 1000,
    }));
    updateButton();
  }
  function chapterAt(t) { let c = -1; for (let i = 0; i < chapters.length; i++) if (t >= chapters[i].start - 0.5) c = i; return c; }

  // ======================================================== Основен цикъл за текущото видео
  let curId = null, resumed = new Set(), speedSet = new Set(), lastSave = 0, invalidated = new Set();
  function onNewVideo(id) {
    curId = id;
    loopOn = false;
    loadSponsor(id);
    setTimeout(() => { if (curId === id) loadChapters(id); }, 1200); // след старта на видеото
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
      if (done && YTC.later && YTC.later.has(id)) YTC.later.remove(id); // изгледано → махаме от „По-късно“
    }
  }
  YTC.toolsTick = tick;
  setInterval(() => { if (chapters.length) updateButton(); }, 2000);
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
  .acts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px}
  .acts .a{flex:1 1 calc(50% - 4px)}
  .a{flex:1;border:0;border-radius:12px;background:#2c2c2e;color:#f2f2f7;font:600 14px inherit;padding:12px 6px}
  .a.on{background:#30d158;color:#000}
  .ch{display:flex;gap:10px;align-items:baseline;width:100%;border:0;background:#2c2c2e;color:#f2f2f7;font:14px inherit;text-align:left;padding:11px 12px;border-radius:10px;margin-top:6px}
  .ch b{flex:0 0 auto;color:#0a84ff;font-weight:600;min-width:46px}
  .ch.cur{background:#3a3a3c;box-shadow:inset 3px 0 0 #ff0033}
  .nav{display:flex;gap:8px;margin-top:6px}.nav .a{padding:10px}
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
    if (chapters.length && v) { const i = chapterAt(v.currentTime); if (i >= 0) t = '§' + (i + 1) + ' · ' + t; }
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

    // бързи действия: По-късно / Следвай канала
    const acts = el('div', 'acts');
    const lb = el('button', 'a', '');
    const setL = () => { const on = YTC.later && YTC.later.has(curId); lb.textContent = on ? '✓ В „По-късно“' : '⏱ Гледай по-късно'; lb.classList.toggle('on', !!on); };
    setL();
    lb.addEventListener('click', () => {
      if (!YTC.later) return;
      if (YTC.later.has(curId)) YTC.later.remove(curId);
      else YTC.later.add({ id: curId, title: pageTitle(), channel: pageChannel(), dur: video() && isFinite(video().duration) ? fmt(video().duration) : '' });
      setL();
    });
    acts.appendChild(lb);
    const hb = el('button', 'a', '');
    const setH = () => { const on = YTC.fav && YTC.fav.has(curId); hb.textContent = on ? '❤️ В „Любими“' : '🤍 Любими'; hb.classList.toggle('on', !!on); };
    setH();
    hb.addEventListener('click', () => {
      if (!YTC.fav) return;
      if (YTC.fav.has(curId)) YTC.fav.remove(curId);
      else YTC.fav.add({ id: curId, title: pageTitle(), channel: pageChannel(), dur: video() && isFinite(video().duration) ? fmt(video().duration) : '' });
      setH();
    });
    acts.appendChild(hb);
    const pb0 = el('button', 'a', '📂 Плейлист');
    pb0.addEventListener('click', () => { close(); if (YTC.pickPlaylist) YTC.pickPlaylist({ id: curId, title: pageTitle(), channel: pageChannel(), dur: video() && isFinite(video().duration) ? fmt(video().duration) : '' }); });
    acts.appendChild(pb0);
    const fb = el('button', 'a', '📺 Следвай канала');
    acts.appendChild(fb);
    if (YTC.videoOwner && YTC.subs) {
      YTC.videoOwner(curId).then((o) => {
        if (!o) { fb.style.display = 'none'; return; }
        const setF = () => { const on = YTC.subs.has(o.id); fb.textContent = on ? '✓ Следваш ' + o.name : '📺 Следвай ' + o.name; fb.classList.toggle('on', on); };
        setF();
        fb.onclick = () => { if (YTC.subs.has(o.id)) YTC.subs.remove(o.id); else YTC.subs.add(o); setF(); };
      });
    } else fb.style.display = 'none';
    sh.appendChild(acts);

    // глави
    if (chapters.length) {
      sh.appendChild(el('div', 'lbl', 'Глави (' + chapters.length + ')'));
      const v0 = video();
      const ci = v0 ? chapterAt(v0.currentTime) : -1;
      const nav = el('div', 'nav');
      const prev = el('button', 'a', '⏮ Предишна'), next = el('button', 'a', 'Следваща ⏭');
      prev.addEventListener('click', () => { const v = video(); if (!v) return; const i = chapterAt(v.currentTime); const tgt = v.currentTime - chapters[Math.max(0, i)].start > 3 ? i : i - 1; v.currentTime = chapters[Math.max(0, tgt)].start; close(); });
      next.addEventListener('click', () => { const v = video(); if (!v) return; const i = chapterAt(v.currentTime); if (i + 1 < chapters.length) v.currentTime = chapters[i + 1].start; close(); });
      nav.appendChild(prev); nav.appendChild(next);
      sh.appendChild(nav);
      chapters.forEach((c, i) => {
        const b = el('button', 'ch' + (i === ci ? ' cur' : ''));
        b.appendChild(el('b', null, fmt(c.start)));
        b.appendChild(el('span', null, c.title));
        b.addEventListener('click', () => { const v = video(); if (v) { v.currentTime = c.start; if (v.paused) v.play().catch(() => {}); } close(); });
        sh.appendChild(b);
      });
    }

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

    // картина в картината (Safari и iOS приложението; в Android приложението става автоматично)
    const pv = video();
    const canPip = pv && !(window.YTCApp && window.YTCApp.setPip) &&
      ((typeof pv.webkitSupportsPresentationMode === 'function' && pv.webkitSupportsPresentationMode('picture-in-picture')) || document.pictureInPictureEnabled);
    if (canPip) {
      const pb = el('button', 'a', '🖼 Картина в картината');
      pb.style.cssText = 'display:block;width:100%;margin:10px 0 0';
      pb.addEventListener('click', () => {
        const v = video(); if (!v) return;
        try {
          if (typeof v.webkitSetPresentationMode === 'function') v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
          else if (document.pictureInPictureElement) document.exitPictureInPicture(); else v.requestPictureInPicture();
        } catch (e) { /* */ }
        close();
      });
      sh.appendChild(pb);
    }

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

/*
 * YT Контрол – звук, жестове и статистика:
 *   • нормализиране на звука (тихите видеа по-силно, силните по-тихо) – Web Audio
 *   • жестове върху видеото: плъзгане настрани = превъртане, нагоре/надолу вляво = яркост, вдясно = сила на звука,
 *     задържане = 2× скорост, докато държиш
 *   • статистика: време за гледане по дни, брой видеа, най-гледани канали (само на устройството)
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  let S = {};
  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
  };
  const video = () => document.querySelector('.html5-video-player video') || document.querySelector('video');
  const player = () => document.querySelector('.html5-video-player');
  const inAd = () => !!document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');
  const curVideo = () => location.pathname === '/watch' ? (location.search.match(/[?&]v=([\w-]{6,})/) || [])[1] : null;
  const pageChannel = () => ((document.querySelector('ytm-slim-owner-renderer .slim-owner-channel-name, ytm-slim-owner-renderer h3, .slim-owner-icon-and-title') || {}).textContent || '').trim().split('\n')[0];
  const playing = (v) => !!(v && !v.paused && !v.ended && v.readyState > 1);
  const isIOS = () => (window.YTCApp && window.YTCApp.platform === 'ios') || /iPhone|iPad|iPod/.test(navigator.userAgent);
  const fmt = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  const dayKey = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  YTC.dayKey = dayKey;

  // ======================================================== Статистика
  const ST_KEY = 'ytc-watch-stats';
  let st = null, stDirty = 0, lastTick = 0;
  function stLoad() { if (!st) { st = LS.get(ST_KEY, null); if (!st || !st.days) st = { days: {} }; } return st; }
  function stSave() { if (st) LS.set(ST_KEY, st); stDirty = 0; }
  function statTick(now) {
    const v = video();
    const dt = lastTick ? Math.min(5, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (!dt || !S.enabled || S.watchStats === false || !playing(v) || inAd() || !curVideo()) return;
    const s = stLoad(), k = dayKey(now);
    const d = s.days[k] || (s.days[k] = { s: 0, v: [], c: {} });
    d.s += dt;
    const id = curVideo();
    if (d.v.indexOf(id) < 0) d.v.push(id);
    const ch = pageChannel();
    if (ch) d.c[ch] = (d.c[ch] || 0) + dt;
    if (++stDirty >= 10) {
      const keys = Object.keys(s.days).sort();
      while (keys.length > 120) delete s.days[keys.shift()];
      stSave();
    }
  }
  YTC.watchStats = function () {
    const s = stLoad();
    const out = { today: 0, todayVideos: 0, week: 0, total: 0, daysCount: Object.keys(s.days).length, days: [], channels: [] };
    const names = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    for (let i = 6; i >= 0; i--) {
      const t = Date.now() - i * 86400e3, d = s.days[dayKey(t)];
      const sec = d ? d.s : 0;
      out.days.push({ sec, label: i === 0 ? 'днес' : names[new Date(t).getDay()] });
      out.week += sec;
    }
    const td = s.days[dayKey()];
    if (td) { out.today = td.s; out.todayVideos = td.v.length; }
    const ch = {}, since = dayKey(Date.now() - 30 * 86400e3);
    for (const k in s.days) {
      out.total += s.days[k].s;
      if (k >= since) for (const n in s.days[k].c) ch[n] = (ch[n] || 0) + s.days[k].c[n];
    }
    out.channels = Object.entries(ch).sort((a, b) => b[1] - a[1]);
    return out;
  };
  YTC.clearWatchStats = () => { st = { days: {} }; stSave(); };
  window.addEventListener('pagehide', stSave);

  // ======================================================== Нормализиране на звука
  // video → предварително усилване (по силата на клипа) → компресор → компенсация → ограничител → сила на звука → изход
  const chains = new WeakMap();
  let ctx = null, warned = false, lastNormId = '';
  function loudnessDb() {
    try {
      const p = document.getElementById('movie_player');
      const r = p && typeof p.getPlayerResponse === 'function' ? p.getPlayerResponse() : null;
      const a = r && r.playerConfig && r.playerConfig.audioConfig;
      if (a && typeof a.loudnessDb === 'number') return a.loudnessDb;
    } catch (e) { /* */ }
    return null;
  }
  function chainFor(v, create) {
    let c = chains.get(v);
    if (c || !create) return c || null;
    // потоци, които не идват през MediaSource (напр. HLS на iPhone), Web Audio не може да чете – иначе звукът изчезва
    if (!/^blob:/.test(v.currentSrc || v.src || '')) {
      if (!warned) { warned = true; if (YTC.toast) YTC.toast('🔈 Нормализирането не се поддържа за този вид видео поток'); }
      return null;
    }
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') return null;   // без докосване браузърът не пуска звука – иначе видеото онемява
      const src = ctx.createMediaElementSource(v);
      const pre = ctx.createGain(), comp = ctx.createDynamicsCompressor(), make = ctx.createGain(), lim = ctx.createDynamicsCompressor(), vol = ctx.createGain();
      comp.threshold.value = -26; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
      make.gain.value = 1.7;
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
      pre.connect(comp); comp.connect(make); make.connect(lim); lim.connect(vol); vol.connect(ctx.destination);
      c = { src, pre, vol, on: false };
      chains.set(v, c);
      return c;
    } catch (e) { return null; }
  }
  function route(c, on) {
    if (!c || c.on === on) return;
    try { c.src.disconnect(); c.src.connect(on ? c.pre : c.vol); c.on = on; } catch (e) { /* */ }
  }
  function normTick() {
    const v = video();
    if (!v) return;
    const want = !!(S.enabled && S.normalizeAudio);
    const c = chainFor(v, want);
    if (!c) return;
    route(c, want);
    if (ctx && ctx.state === 'suspended' && playing(v)) ctx.resume().catch(() => {});
    const id = curVideo();
    if (want && id && id !== lastNormId) {
      const db = loudnessDb();
      if (db !== null) {
        lastNormId = id;
        // loudnessDb > 0 = по-силно от нормата на YouTube; връщаме го към нормата (±10 dB)
        c.pre.gain.value = Math.pow(10, Math.max(-10, Math.min(10, -db)) / 20);
      }
    }
  }
  // браузърите пускат Web Audio само след докосване
  const unlock = () => {
    if (!S.enabled || !S.normalizeAudio) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume().then(normTick).catch(() => {});
      else normTick();
    } catch (e) { /* */ }
  };
  document.addEventListener('touchend', unlock, true);
  document.addEventListener('click', unlock, true);
  // при излизане от приложението (iOS) – опит звукът да не спре
  try { if (window.AudioContext) document.addEventListener('playing', () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true); } catch (e) { /* */ }

  // ======================================================== Жестове върху видеото
  let ovl = null, ovlTimer = 0, dim = null;
  function hint(text) {
    const p = player();
    if (!p) return;
    if (!ovl || !p.contains(ovl)) {
      ovl = document.createElement('div');
      ovl.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;pointer-events:none;' +
        'background:rgba(0,0,0,.72);color:#fff;font:600 17px Roboto,-apple-system,sans-serif;padding:10px 18px;border-radius:22px;white-space:nowrap;transition:opacity .2s';
      p.appendChild(ovl);
    }
    ovl.textContent = text;
    ovl.style.opacity = '1';
    clearTimeout(ovlTimer);
    ovlTimer = setTimeout(() => { if (ovl) ovl.style.opacity = '0'; }, 700);
  }
  function setDim(x) {
    const p = player();
    if (!p) return;
    if (!dim || !p.contains(dim)) {
      dim = document.createElement('div');
      dim.style.cssText = 'position:absolute;inset:0;background:#000;pointer-events:none;z-index:59;opacity:0';
      p.appendChild(dim);
    }
    dim.style.opacity = String(x);
  }
  let g = null, suppressClick = 0, lastVid = '';
  function onStart(e) {
    if (!S.enabled || S.gestures === false || e.touches.length !== 1) { g = null; return; }
    const p = player(), v = video();
    if (!p || !v || inAd() || !e.target.closest || !e.target.closest('.html5-video-player')) { g = null; return; }
    if (e.target.closest('.ytp-progress-bar, .ytm-progress-bar, [role="slider"], .player-controls-bottom, button')) { g = null; return; }
    const r = p.getBoundingClientRect(), t = e.touches[0];
    if (curVideo() !== lastVid) { lastVid = curVideo(); setDim(0); }
    const fx = (t.clientX - r.left) / r.width;
    g = { x: t.clientX, y: t.clientY, r, axis: '', v, t0: v.currentTime, right: t.clientX > r.left + r.width / 2, mid: fx > 0.3 && fx < 0.7,
      dim: dim ? +dim.style.opacity || 0 : 0, vol: 1, hold: 0, rate: 1 };
    const c = chains.get(v);
    g.vol = c && c.vol ? c.vol.gain.value : v.volume;
    g.hold = setTimeout(() => {
      if (!g || g.axis) return;
      g.axis = 'hold'; g.rate = v.playbackRate;
      v.playbackRate = 2; hint('2× ▶▶');
    }, 550);
  }
  function onMove(e) {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      clearTimeout(g.hold);
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.axis === 'hold') return;
    if (e.cancelable) e.preventDefault();
    if (g.axis === 'x') {
      const d = isFinite(g.v.duration) ? g.v.duration : 0;
      if (!d) return;
      g.seek = Math.max(0, Math.min(d - 1, g.t0 + dx / g.r.width * Math.min(180, Math.max(60, d / 4))));
      const delta = Math.round(g.seek - g.t0);
      hint((delta >= 0 ? '⏩ +' : '⏪ −') + Math.abs(delta) + ' с  (' + fmt(g.seek) + ')');
    } else if (g.mid) {
      // средата: плъзгане надолу отмества клипа и го затваря
      if (YTC.dragClose && S.navButtons !== false && !document.fullscreenElement) { g.drag = dy; YTC.dragClose.move(dy, g.r.height); }
    } else {
      const k = -dy / (g.r.height * 0.9);
      if (!g.right) {
        const x = Math.max(0, Math.min(0.85, g.dim - k));
        setDim(x); hint('☀️ ' + Math.round((1 - x / 0.85) * 100) + '%');
      } else {
        const c = chains.get(g.v);
        if (c && c.vol) { const x = Math.max(0, Math.min(2, g.vol + k * 1.5)); c.vol.gain.value = x; hint('🔊 ' + Math.round(x * 100) + '%'); }
        else if (!isIOS()) { const x = Math.max(0, Math.min(1, g.vol + k)); g.v.volume = x; hint('🔊 ' + Math.round(x * 100) + '%'); }
        else hint('🔊 с бутоните на телефона');
      }
    }
  }
  function onEnd() {
    if (!g) return;
    clearTimeout(g.hold);
    if (g.axis === 'x' && typeof g.seek === 'number') g.v.currentTime = g.seek;
    if (g.axis === 'hold') g.v.playbackRate = g.rate || 1;
    if (g.axis === 'y' && g.mid && typeof g.drag === 'number' && YTC.dragClose) YTC.dragClose.end(g.drag, g.r.height);
    if (g.axis) suppressClick = Date.now();
    g = null;
  }
  document.addEventListener('touchstart', onStart, { capture: true, passive: true });
  document.addEventListener('touchmove', onMove, { capture: true, passive: false });
  document.addEventListener('touchend', onEnd, true);
  document.addEventListener('touchcancel', onEnd, true);
  // след жест докосването не трябва да показва/скрива контролите или да спира видеото
  document.addEventListener('click', (e) => {
    if (suppressClick && Date.now() - suppressClick < 450) { suppressClick = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);

  // ======================================================== Цикъл
  YTC.mediaApply = (s) => { S = s; normTick(); };
  setInterval(() => { statTick(Date.now()); normTick(); }, 1000);
})();

/*
 * YT Контрол – навигация и хедър:
 *   • „‹ Назад“ в хедъра на всяка страница извън началната (вкл. при клип) – една стъпка назад
 *   • връщане на същото място: началната страница се пази, а на страниците на YouTube се помни докъде си скролнал
 *     (важи и за „назад“ на Android и жеста от ръба на iPhone)
 *   • плъзгане надолу в средата на видеото – клипът се отмества надолу и се затваря
 *   • подреден хедър: без „Отваряне на приложението“, бутон за търсене
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
    if (location.pathname === '/' && YTC.feedChip && YTC.feedChip() !== 'all') { YTC.feedHomeChip(); return; }
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

  // ======================================================== Памет за мястото (скрол) по адрес
  const POS_KEY = 'ytc-scroll';
  const urlKey = () => location.pathname + location.search;
  let pos = {}; try { pos = JSON.parse(sessionStorage.getItem(POS_KEY) || '{}') || {}; } catch (e) { /* */ }
  let pinnedUntil = 0, curKey = urlKey(), restoring = null;
  const savePos = () => { try { const k = Object.keys(pos); if (k.length > 60) delete pos[k[0]]; sessionStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) { /* */ } };
  // точно преди да тръгнеш нанякъде (докосване на линк/карта) – запомняме мястото и го пазим от нулирането на YouTube
  YTC.navSaveScroll = function () {
    if (restoring) return;
    pos[urlKey()] = window.scrollY; pinnedUntil = Date.now() + 1500; savePos();
  };
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href], ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-rich-item-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model, ytm-media-item');
    if (a) YTC.navSaveScroll();
  }, true);
  let st = 0;
  window.addEventListener('scroll', () => {
    if (restoring || Date.now() < pinnedUntil) return;
    clearTimeout(st); st = setTimeout(() => { if (Date.now() >= pinnedUntil && !restoring) { pos[urlKey()] = window.scrollY; savePos(); } }, 200);
  }, { passive: true });
  // връщане назад (бутон, Android „назад“, жест от ръба) → скролваме до запомненото, докато съдържанието се зарежда
  let backNav = false;
  window.addEventListener('popstate', () => { backNav = !(window.__ytcFwd && Date.now() - window.__ytcFwd < 500); });
  function restore(target) {
    if (restoring) restoring.stop();
    const t0 = Date.now(); let ok = 0;
    const stop = () => { clearInterval(iv); document.removeEventListener('touchstart', stop, true); restoring = null; };
    const iv = setInterval(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.min(target, Math.max(0, max)));
      ok = Math.abs(window.scrollY - target) < 4 ? ok + 1 : 0;
      if (ok >= 3 || Date.now() - t0 > 5000) stop();
    }, 150);
    document.addEventListener('touchstart', stop, true);   // докоснеш ли – спираме, за да не пречим
    restoring = { stop };
  }
  function onUrlChange() {
    const k = urlKey();
    if (k === curKey) return;
    curKey = k;
    const back = backNav; backNav = false;
    if (!back) return;
    if (location.pathname === '/' && document.getElementById('ytc-home')) return;   // нашата начална страница си пази мястото сама
    const y = pos[k];
    if (y > 50) restore(y);
  }

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
    // „‹“ горе – навсякъде извън началната страница (и в Любими, Плейлисти… на началната)
    let hb = top.querySelector('.ytc-hback');
    if (logo && (location.pathname !== '/' || (YTC.feedChip && YTC.feedChip() !== 'all'))) {
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
  function tick() { if (!document.body) return; style(); onUrlChange(); header(); }
  YTC.navApply = (s) => { S = s; tick(); };
  setInterval(tick, 700);
  window.addEventListener('popstate', () => { setTimeout(tick, 50); setTimeout(tick, 400); });
})();

/*
 * YT Контрол – родителски контрол „Мисловна пауза“.
 *   • на всеки N минути гледане видеото спира и детето решава задачи (математика, логика, памет…)
 *   • задачите се избират според възрастта; родителят избира видовете, трудността, колко задачи и през колко минути
 *   • решиш ли ги – гледаш нататък; не можеш ли – няма гледане
 *   • твърд дневен лимит: след него гледането спира, каквото и да се решава (само родителят може да добави време)
 *   • всичко е защитено с ПИН на родителя; задачите се създават на устройството, без интернет и без да се изпраща нищо
 */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const video = () => document.querySelector('.html5-video-player video') || document.querySelector('video');
  const onWatch = () => location.pathname === '/watch';
  const dayKey = () => (YTC.dayKey ? YTC.dayKey() : new Date().toISOString().slice(0, 10));

  // ======================================================== Случайни помощници
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  function numChoices(ans, spread) {
    const set = new Set([ans]);
    const sp = Math.max(2, spread || Math.ceil(Math.abs(ans) * 0.25) + 2);
    let guard = 0;
    while (set.size < 4 && guard++ < 100) {
      const d = rnd(1, sp) * (Math.random() < 0.5 ? -1 : 1);
      const x = ans + d;
      if (x >= 0 || ans < 0) set.add(x);
    }
    let k = 1; while (set.size < 4) set.add(ans + sp + k++);
    return shuffle([...set]).map(String);
  }
  const NAMES = ['Ани', 'Боби', 'Вики', 'Гошо', 'Деси', 'Иво', 'Мила', 'Нико', 'Рая', 'Сашо', 'Тея', 'Яни'];
  const EMO = {
    плодове: ['🍎', '🍌', '🍇', '🍓', '🍐', '🍒', '🍑', '🍋'],
    животни: ['🐶', '🐱', '🐰', '🐻', '🐸', '🐵', '🐷', '🦊'],
    превозни: ['🚗', '🚌', '🚲', '🚂', '✈️', '🚀', '🚜', '⛵'],
    спорт: ['⚽', '🏀', '🎾', '🏐', '🏈', '⚾'],
    форми: ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'],
    време: ['☀️', '🌧️', '❄️', '⛅', '🌈', '⚡'],
  };
  const WORDS = {
    'животни': ['куче', 'котка', 'кон', 'крава', 'лъв', 'заек', 'мечка', 'лисица', 'вълк', 'коза'],
    'плодове': ['ябълка', 'круша', 'банан', 'череша', 'праскова', 'слива', 'портокал', 'грозде'],
    'зеленчуци': ['домат', 'краставица', 'морков', 'картоф', 'чушка', 'лук', 'тиква', 'зеле'],
    'мебели': ['стол', 'маса', 'легло', 'гардероб', 'диван', 'шкаф', 'бюро', 'рафт'],
    'превозни средства': ['кола', 'автобус', 'влак', 'самолет', 'кораб', 'колело', 'трамвай', 'камион'],
    'цветове': ['червено', 'синьо', 'зелено', 'жълто', 'лилаво', 'оранжево', 'розово', 'бяло'],
    'музикални инструменти': ['пиано', 'китара', 'тъпан', 'цигулка', 'флейта', 'тромпет', 'гайда', 'акордеон'],
    'птици': ['врабче', 'орел', 'гълъб', 'щъркел', 'папагал', 'бухал', 'лястовица', 'кос'],
  };

  // ======================================================== Генератори на задачи
  // Всеки връща { q, vis?, svg?, memo?, ans, ch? (избор), ex (обяснение) }. L = ниво 1…6.
  const G = {};

  G.count = (L) => {
    const kind = pick(Object.keys(EMO).slice(0, 3)), e = pick(EMO[kind]);
    if (L >= 2 && Math.random() < 0.5) {
      const a = rnd(1, L >= 2 ? 6 : 4), b = rnd(1, L >= 2 ? 4 : 3);
      return { q: 'Колко са всички заедно?', vis: e.repeat(a) + '  +  ' + e.repeat(b), ans: a + b, ch: numChoices(a + b, 2), ex: a + ' и още ' + b + ' прави ' + (a + b) + '.' };
    }
    if (Math.random() < 0.4) {
      const e2 = pick(EMO[kind].filter((x) => x !== e));
      let a = rnd(1, 3 + L * 2), b = rnd(1, 3 + L * 2); if (a === b) b = a + 1;
      return { q: 'Къде има повече?', vis: e.repeat(a) + '\n' + e2.repeat(b), ans: a > b ? e : e2, ch: [e, e2], ex: 'Има ' + a + ' ' + e + ' и ' + b + ' ' + e2 + '.' };
    }
    const n = rnd(2, L >= 2 ? 10 : 6);
    return { q: 'Колко са?', vis: e.repeat(n), ans: n, ch: numChoices(n, 2), ex: 'Преброй ги едно по едно: те са ' + n + '.' };
  };

  G.math = (L) => {
    let a, b, q, ans, ex;
    switch (Math.min(L, 6)) {
      case 1: a = rnd(1, 6); b = rnd(1, 10 - a);
        if (Math.random() < 0.5) { q = a + ' + ' + b; ans = a + b; } else { a = a + b; q = a + ' − ' + b; ans = a - b; }
        return { q: 'Колко е ' + q + '?', ans, ch: numChoices(ans, 3), ex: q + ' = ' + ans };
      case 2: a = rnd(3, 15); b = rnd(2, 20 - a);
        if (Math.random() < 0.5) { q = a + ' + ' + b; ans = a + b; } else { a = a + b; q = a + ' − ' + b; ans = a - b; }
        return { q: 'Колко е ' + q + '?', ans, ch: numChoices(ans, 4), ex: q + ' = ' + ans };
      case 3: {
        const t = rnd(0, 2);
        if (t === 0) { a = rnd(2, 10); b = rnd(2, 10); return { q: 'Колко е ' + a + ' × ' + b + '?', ans: a * b, ex: a + ' × ' + b + ' = ' + (a * b) + ' (' + b + ' събрано ' + a + ' пъти)' }; }
        a = rnd(15, 80); b = rnd(5, 99 - a);
        if (t === 1) return { q: 'Колко е ' + a + ' + ' + b + '?', ans: a + b, ex: 'Първо десетиците, после единиците: ' + a + ' + ' + b + ' = ' + (a + b) };
        return { q: 'Колко е ' + (a + b) + ' − ' + b + '?', ans: a, ex: (a + b) + ' − ' + b + ' = ' + a };
      }
      case 4: {
        const t = rnd(0, 3);
        if (t === 0) { b = rnd(3, 9); ans = rnd(3, 12); return { q: 'Колко е ' + (b * ans) + ' : ' + b + '?', ans, ex: 'Защото ' + b + ' × ' + ans + ' = ' + (b * ans) }; }
        if (t === 1) { a = rnd(12, 49); b = rnd(3, 9); return { q: 'Колко е ' + a + ' × ' + b + '?', ans: a * b, ex: a + ' × ' + b + ' = ' + (Math.floor(a / 10) * 10) + '×' + b + ' + ' + (a % 10) + '×' + b + ' = ' + (a * b) }; }
        if (t === 2) { a = rnd(15, 70); ans = rnd(12, 60); return { q: '? + ' + a + ' = ' + (a + ans) + '\nКое е числото?', ans, ex: (a + ans) + ' − ' + a + ' = ' + ans }; }
        a = rnd(120, 600); b = rnd(40, 380);
        return { q: 'Колко е ' + (a + b) + ' − ' + b + '?', ans: a, ex: (a + b) + ' − ' + b + ' = ' + a };
      }
      case 5: {
        const t = rnd(0, 3);
        if (t === 0) { a = rnd(2, 12); b = rnd(2, 6); const c = rnd(2, 9); return { q: 'Колко е ' + a + ' + ' + b + ' × ' + c + '?', ans: a + b * c, ex: 'Първо умножението: ' + b + ' × ' + c + ' = ' + (b * c) + ', после ' + a + ' + ' + (b * c) + ' = ' + (a + b * c) }; }
        if (t === 1) { const d = pick([2, 3, 4, 5, 10]); ans = rnd(2, 12); return { q: 'Колко е 1/' + d + ' от ' + (ans * d) + '?', ans, ex: (ans * d) + ' : ' + d + ' = ' + ans }; }
        if (t === 2) { const p = pick([10, 20, 25, 50]); const base = pick([40, 60, 80, 120, 200, 360].filter((x) => x * p % 100 === 0)); return { q: 'Колко е ' + p + '% от ' + base + '?', ans: base * p / 100, ex: p + '% = ' + p + '/100, а ' + base + ' × ' + p + ' : 100 = ' + (base * p / 100) }; }
        a = rnd(2, 15); b = rnd(a + 2, 25); return { q: 'Колко е ' + a + ' − ' + b + '?', ans: a - b, ex: 'Отиваме под нулата: ' + a + ' − ' + b + ' = ' + (a - b) };
      }
      default: {
        const t = rnd(0, 3);
        if (t === 0) { const x = rnd(2, 12), k = rnd(2, 7), c = rnd(1, 20); return { q: 'Реши: ' + k + 'x + ' + c + ' = ' + (k * x + c) + '\nx = ?', ans: x, ex: k + 'x = ' + (k * x + c) + ' − ' + c + ' = ' + (k * x) + ', значи x = ' + (k * x) + ' : ' + k + ' = ' + x }; }
        if (t === 1) { const base = pick([2, 3, 5]), e = base === 2 ? rnd(4, 8) : rnd(2, 4); return { q: 'Колко е ' + base + ' на степен ' + e + '?', ans: Math.pow(base, e), ex: Array(e).fill(base).join(' × ') + ' = ' + Math.pow(base, e) }; }
        if (t === 2) { const n = [rnd(4, 20), rnd(4, 20), rnd(4, 20)]; const s = n[0] + n[1] + n[2]; const fix = (3 - s % 3) % 3; n[2] += fix; return { q: 'Средно аритметично на ' + n.join(', ') + '?', ans: (s + fix) / 3, ex: 'Сбор ' + (s + fix) + ', разделен на 3 = ' + ((s + fix) / 3) }; }
        const p = pick([10, 20, 25]), price = pick([40, 60, 80, 120, 150, 200].filter((x) => x * p % 100 === 0)); return { q: 'Нещо струва ' + price + ' лв. Поевтинява с ' + p + '%. Колко струва сега?', ans: price * (100 - p) / 100, ex: p + '% от ' + price + ' е ' + (price * p / 100) + ', а ' + price + ' − ' + (price * p / 100) + ' = ' + (price * (100 - p) / 100) };
      }
    }
  };

  G.word = (L) => {
    const [n1, n2] = sample(NAMES, 2);
    const t = Math.min(L, 6);
    if (t <= 2) {
      const things = pick(['бонбона', 'балона', 'стикера', 'топки', 'книжки', 'колички']);
      const a = rnd(4, t === 1 ? 9 : 15), b = rnd(1, a - 1);
      if (Math.random() < 0.5) return { q: n1 + ' има ' + a + ' ' + things + '. Даде ' + b + ' на ' + n2 + '. Колко ' + things + ' останаха на ' + n1 + '?', ans: a - b, ch: numChoices(a - b, 3), ex: a + ' − ' + b + ' = ' + (a - b) };
      return { q: n1 + ' има ' + a + ' ' + things + ', а ' + n2 + ' – ' + b + '. Колко имат общо?', ans: a + b, ch: numChoices(a + b, 3), ex: a + ' + ' + b + ' = ' + (a + b) };
    }
    if (t === 3) {
      const k = rnd(3, 8), m = rnd(3, 9), w = pick([['кутии', 'молива'], ['чинии', 'ябълки'], ['реда', 'стола'], ['пакета', 'бисквити']]);
      if (Math.random() < 0.5) return { q: 'Има ' + k + ' ' + w[0] + ' с по ' + m + ' ' + w[1] + '. Колко ' + w[1] + ' има общо?', ans: k * m, ex: k + ' × ' + m + ' = ' + (k * m) };
      return { q: n1 + ' раздели ' + (k * m) + ' ' + w[1] + ' поравно в ' + k + ' ' + w[0] + '. По колко има във всяка?', ans: m, ex: (k * m) + ' : ' + k + ' = ' + m };
    }
    if (t === 4) {
      const p1 = rnd(2, 6), p2 = rnd(1, 5), c1 = rnd(2, 5), c2 = rnd(2, 4);
      return { q: 'Тетрадка струва ' + p1 + ' лв., а химикал – ' + p2 + ' лв. ' + n1 + ' купи ' + c1 + ' тетрадки и ' + c2 + ' химикала. Колко плати?', ans: p1 * c1 + p2 * c2, ex: c1 + '×' + p1 + ' + ' + c2 + '×' + p2 + ' = ' + (p1 * c1) + ' + ' + (p2 * c2) + ' = ' + (p1 * c1 + p2 * c2) };
    }
    if (t === 5) {
      const v = pick([40, 50, 60, 80, 90]), hh = rnd(2, 4);
      if (Math.random() < 0.5) return { q: 'Влак се движи с ' + v + ' км в час. Колко километра ще измине за ' + hh + ' часа и половина?', ans: v * hh + v / 2, ex: v + ' × ' + hh + ' + ' + (v / 2) + ' = ' + (v * hh + v / 2) };
      const age = rnd(6, 12), d = rnd(3, 8);
      return { q: n1 + ' е на ' + age + ' години, а ' + n2 + ' е с ' + d + ' години по-голям. На колко години ще бъдат двамата заедно след 3 години?', ans: age + age + d + 6, ex: 'Сега: ' + age + ' + ' + (age + d) + ' = ' + (2 * age + d) + '. След 3 години всеки е с 3 повече: ' + (2 * age + d) + ' + 6 = ' + (2 * age + d + 6) };
    }
    const k = rnd(3, 5), son = rnd(6, 12);
    if (Math.random() < 0.5) return { q: 'Бащата е ' + k + ' пъти по-голям от сина си. Заедно са на ' + (son * (k + 1)) + ' години. На колко години е синът?', ans: son, ex: 'Синът е 1 част, бащата – ' + k + ' части; общо ' + (k + 1) + ' части = ' + (son * (k + 1)) + ', значи 1 част = ' + son };
    const w = rnd(3, 6), x = rnd(2, 5);
    return { q: w + ' работници боядисват ограда за ' + (x * 2) + ' дни. За колко дни ще я боядисат ' + (w * 2) + ' работници?', ans: x, ex: 'Двойно повече хора – двойно по-малко време: ' + (x * 2) + ' : 2 = ' + x };
  };

  G.seq = (L) => {
    if (L <= 2) {
      const set = pick([EMO.форми, EMO.плодове, EMO.животни]);
      const [a, b, c] = sample(set, 3);
      const pat = L === 1 ? pick([[a, b], [a, a, b]]) : pick([[a, b, c], [a, a, b], [a, b, b], [a, b, c, b]]);
      const len = pat.length * 2 + rnd(0, pat.length - 1);
      const shown = []; for (let i = 0; i < len; i++) shown.push(pat[i % pat.length]);
      const ans = pat[len % pat.length];
      return { q: 'Кое идва после?', vis: shown.join(' ') + ' ❓', ans, ch: shuffle([...new Set([a, b, c])]), ex: 'Повтаря се: ' + pat.join(' ') };
    }
    let s, ans, ex;
    const t = Math.min(L, 6);
    if (t === 3) { const st = rnd(1, 20), d = pick([2, 3, 5, 10]) * (Math.random() < 0.3 ? -1 : 1), st2 = d < 0 ? st + 60 : st; s = [0, 1, 2, 3, 4].map((i) => st2 + i * d); ans = st2 + 5 * d; ex = 'Всеки път ' + (d > 0 ? '+' : '') + d; }
    else if (t === 4) {
      if (Math.random() < 0.5) { const st = rnd(1, 5), m = pick([2, 3]); s = [0, 1, 2, 3].map((i) => st * Math.pow(m, i)); ans = st * Math.pow(m, 4); ex = 'Всеки път × ' + m; }
      else { const st = rnd(1, 10), a = rnd(1, 5), b = rnd(2, 9); s = [st]; for (let i = 1; i < 6; i++) s.push(s[i - 1] + (i % 2 ? a : b)); ans = s[5] + b; ex = 'Редуват се +' + a + ' и +' + b; }
    } else if (t === 5) {
      const k = rnd(0, 2);
      if (k === 0) { const o = rnd(1, 4); s = [0, 1, 2, 3, 4].map((i) => (i + o) * (i + o)); ans = (5 + o) * (5 + o); ex = 'Квадрати: ' + o + '×' + o + ', ' + (o + 1) + '×' + (o + 1) + '…'; }
      else if (k === 1) { const a = rnd(1, 3), b = rnd(1, 4); s = [a, b]; for (let i = 2; i < 6; i++) s.push(s[i - 1] + s[i - 2]); ans = s[4] + s[5]; ex = 'Всяко число е сбор от предишните две'; }
      else { const st = rnd(1, 10); s = [st]; for (let i = 1; i < 5; i++) s.push(s[i - 1] + i); ans = s[4] + 5; ex = 'Прибавяме +1, +2, +3, +4, после +5'; }
    } else {
      const k = rnd(0, 2);
      if (k === 0) { const m = rnd(2, 3), c = rnd(1, 3), st = rnd(1, 4); s = [st]; for (let i = 1; i < 5; i++) s.push(s[i - 1] * m + c); ans = s[4] * m + c; ex = 'Всеки път × ' + m + ' и + ' + c; }
      else if (k === 1) { const pr = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]; const o = rnd(0, 5); s = pr.slice(o, o + 5); ans = pr[o + 5]; ex = 'Прости числа – делят се само на 1 и на себе си'; }
      else { const a = rnd(1, 5), b = rnd(20, 40), da = rnd(2, 4), db = rnd(2, 4); s = [a, b, a + da, b - db, a + 2 * da, b - 2 * db]; ans = a + 3 * da; ex = 'Две преплетени редици: ' + a + ', ' + (a + da) + ', ' + (a + 2 * da) + '… (+' + da + ') и ' + b + ', ' + (b - db) + '… (−' + db + ')'; }
    }
    return { q: 'Кое число следва?', vis: s.join(',  ') + ',  ?', ans, ex };
  };

  G.odd = (L) => {
    if (L <= 2) {
      const cats = Object.keys(EMO);
      const [c1, c2] = sample(cats, 2);
      const items = sample(EMO[c1], 3), odd = pick(EMO[c2]);
      return { q: 'Кое не е от групата?', ans: odd, ch: shuffle(items.concat(odd)), ex: 'Другите са ' + c1 + ', а ' + odd + ' – не.' };
    }
    if (L <= 4 && Math.random() < 0.6) {
      const cats = Object.keys(WORDS);
      const [c1, c2] = sample(cats, 2);
      const items = sample(WORDS[c1], 3), odd = pick(WORDS[c2]);
      return { q: 'Коя дума е излишна?', ans: odd, ch: shuffle(items.concat(odd)), ex: 'Другите са ' + c1 + ', а „' + odd + '“ е от ' + c2 + '.' };
    }
    const k = L >= 5 ? rnd(0, 2) : rnd(0, 1);
    let items, odd, ex;
    if (k === 0) { const ev = Math.random() < 0.5; items = sample([...Array(40).keys()].map((i) => i * 2 + (ev ? 2 : 1)), 3); odd = rnd(1, 40) * 2 + (ev ? 1 : 2); ex = 'Другите са ' + (ev ? 'четни' : 'нечетни') + ', а ' + odd + ' – не.'; }
    else if (k === 1) { const m = pick([3, 4, 5, 6, 7, 9]); items = sample([...Array(12).keys()].map((i) => (i + 2) * m), 3); do { odd = rnd(10, 90); } while (odd % m === 0); ex = 'Другите се делят на ' + m + ', а ' + odd + ' – не.'; }
    else { items = sample([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31], 3); odd = pick([9, 15, 21, 25, 27, 33, 35, 39]); ex = 'Другите са прости числа, а ' + odd + ' се дели и на други числа.'; }
    return { q: 'Кое число е излишно?', ans: String(odd), ch: shuffle(items.concat(odd)).map(String), ex };
  };

  G.scale = (L) => {
    const [A, B, C] = sample(EMO.плодове, 3);
    const t = Math.min(Math.max(L, 2), 6);
    if (t === 2) { const a = rnd(1, 5); return { q: 'Колко струва ' + A + '?', vis: A + ' + ' + A + ' = ' + (2 * a), ans: a, ch: numChoices(a, 2), ex: 'Две еднакви правят ' + (2 * a) + ', значи едната е ' + a + '.' }; }
    if (t === 3) { const a = rnd(2, 6), b = rnd(1, 9); return { q: 'Колко струва ' + B + '?', vis: A + ' + ' + A + ' = ' + (2 * a) + '\n' + A + ' + ' + B + ' = ' + (a + b), ans: b, ex: A + ' = ' + a + ', значи ' + B + ' = ' + (a + b) + ' − ' + a + ' = ' + b }; }
    if (t === 4) { const a = rnd(2, 6), b = rnd(1, 7), c = rnd(1, 9); return { q: 'Колко струва ' + C + '?', vis: A + ' + ' + A + ' + ' + A + ' = ' + (3 * a) + '\n' + A + ' + ' + B + ' = ' + (a + b) + '\n' + B + ' + ' + C + ' = ' + (b + c), ans: c, ex: A + ' = ' + a + ', ' + B + ' = ' + b + ', ' + C + ' = ' + c }; }
    if (t === 5) { const a = rnd(2, 6), b = rnd(2, 5); return { q: 'Колко е ' + A + ' + ' + B + '?', vis: A + ' + ' + A + ' = ' + (2 * a) + '\n' + A + ' × ' + B + ' = ' + (a * b), ans: a + b, ex: A + ' = ' + a + ', ' + B + ' = ' + (a * b) + ' : ' + a + ' = ' + b + ', сборът е ' + (a + b) }; }
    const a = rnd(4, 12), b = rnd(1, a - 1);
    return { q: 'Колко струва ' + A + '?', vis: A + ' + ' + B + ' = ' + (a + b) + '\n' + A + ' − ' + B + ' = ' + (a - b), ans: a, ex: 'Събери двете: 2 × ' + A + ' = ' + (2 * a) + ', значи ' + A + ' = ' + a };
  };

  G.order = (L) => {
    const n = L >= 5 ? 4 : 3;
    const ppl = sample(NAMES, n);   // ppl[0] е най-висок
    const rel = pick([['по-висок', 'по-висока', 'най-висок', 'най-нисък'], ['по-голям', 'по-голяма', 'най-голям', 'най-малък'], ['по-бърз', 'по-бърза', 'най-бърз', 'най-бавен']]);
    const FEM = ['Ани', 'Вики', 'Деси', 'Мила', 'Рая', 'Тея'];
    const fem = (nm) => FEM.includes(nm);
    const facts = [];
    for (let i = 0; i < n - 1; i++) facts.push(ppl[i] + ' е ' + (fem(ppl[i]) ? rel[1] : rel[0]) + ' от ' + ppl[i + 1] + '.');
    const ask = rnd(0, n === 4 ? 2 : 1);
    let q, ans;
    if (ask === 0) { q = 'Кой е ' + rel[2] + '?'; ans = ppl[0]; }
    else if (ask === 1) { q = 'Кой е ' + rel[3] + '?'; ans = ppl[n - 1]; }
    else { q = 'Кой е на второ място?'; ans = ppl[1]; }
    return { q: shuffle(facts).join('\n') + '\n\n' + q, ans, ch: shuffle(ppl), ex: 'Подредени: ' + ppl.join(' → ') };
  };

  G.memory = (L) => {
    const n = Math.min(3 + L, 8);
    const pool = EMO.плодове.concat(EMO.животни, EMO.превозни);
    const seq = sample(pool, n);
    const showMs = 1200 + n * 700;
    if (Math.random() < 0.5) {
      const pos = rnd(1, n);
      return { memo: seq.join(' '), showMs, q: 'Кое беше на ' + pos + '-о място?', ans: seq[pos - 1], ch: shuffle([seq[pos - 1]].concat(sample(seq.filter((x, i) => i !== pos - 1), 3))), ex: 'Редът беше: ' + seq.join(' ') };
    }
    const not = pick(pool.filter((x) => !seq.includes(x)));
    return { memo: seq.join(' '), showMs, q: 'Кое НЕ беше показано?', ans: not, ch: shuffle([not].concat(sample(seq, 3))), ex: 'Показани бяха: ' + seq.join(' ') };
  };

  const hm = (h, m) => h + ':' + String(m).padStart(2, '0');
  function clockSVG(h, m) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('width', '170'); svg.setAttribute('height', '170');
    const add = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); svg.appendChild(e); return e; };
    add('circle', { cx: 100, cy: 100, r: 94, fill: '#fff', stroke: '#333', 'stroke-width': 6 });
    for (let i = 1; i <= 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const t = add('text', { x: 100 + Math.sin(a) * 74, y: 100 - Math.cos(a) * 74 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-family': 'sans-serif', 'font-weight': 700, fill: '#222' });
      t.textContent = String(i);
    }
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2, ma = m / 60 * Math.PI * 2;
    add('line', { x1: 100, y1: 100, x2: 100 + Math.sin(ha) * 45, y2: 100 - Math.cos(ha) * 45, stroke: '#222', 'stroke-width': 8, 'stroke-linecap': 'round' });
    add('line', { x1: 100, y1: 100, x2: 100 + Math.sin(ma) * 68, y2: 100 - Math.cos(ma) * 68, stroke: '#ff0033', 'stroke-width': 5, 'stroke-linecap': 'round' });
    add('circle', { cx: 100, cy: 100, r: 6, fill: '#222' });
    return svg;
  }
  G.clock = (L) => {
    const t = Math.min(Math.max(L, 2), 5);
    if (t <= 3) {
      const h = rnd(1, 12), m = t === 2 ? pick([0, 30]) : pick([0, 15, 30, 45, 5, 10, 20, 40, 50]);
      const ans = hm(h, m);
      const alts = new Set([ans]);
      while (alts.size < 4) alts.add(hm(pick([h, (h % 12) + 1, ((h + 10) % 12) + 1, rnd(1, 12)]), pick([0, 15, 30, 45, m, (m + 30) % 60])));
      return { svg: () => clockSVG(h, m), q: 'Колко е часът?', ans, ch: shuffle([...alts]), ex: 'Малката стрелка показва часа (' + h + '), голямата (червената) – минутите (' + m + ').' };
    }
    if (t === 4) {
      const h = rnd(7, 20), m = pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]), add = pick([15, 20, 30, 40, 45, 50]);
      const tot = h * 60 + m + add, ans = hm(Math.floor(tot / 60) % 24, tot % 60);
      const alts = new Set([ans]);
      for (const d of [-10, 10, 60, -60, 5]) { if (alts.size >= 4) break; const x = tot + d; alts.add(hm(Math.floor(x / 60) % 24, ((x % 60) + 60) % 60)); }
      return { q: 'Сега е ' + hm(h, m) + '. Колко ще е часът след ' + add + ' минути?', ans, ch: shuffle([...alts]), ex: hm(h, m) + ' + ' + add + ' мин = ' + ans };
    }
    const h = rnd(8, 19), m = pick([10, 15, 20, 30, 40, 45, 50]), dur = rnd(4, 14) * 5 + 30;
    const e = h * 60 + m + dur;
    return { q: 'Филмът започва в ' + hm(h, m) + ' и свършва в ' + hm(Math.floor(e / 60), e % 60) + '. Колко минути трае?', ans: dur, ex: 'От ' + hm(h, m) + ' до ' + hm(Math.floor(e / 60), e % 60) + ' са ' + dur + ' минути' };
  };

  G.geo = (L) => {
    const t = Math.min(Math.max(L, 3), 6);
    if (t === 3) {
      const sh = [['триъгълник', 3], ['квадрат', 4], ['петоъгълник', 5], ['шестоъгълник', 6]];
      const [a, b] = sample(sh, 2);
      return { q: 'Колко страни имат общо един ' + a[0] + ' и един ' + b[0] + '?', ans: a[1] + b[1], ch: numChoices(a[1] + b[1], 3), ex: a[0] + ' има ' + a[1] + ', ' + b[0] + ' има ' + b[1] + ': общо ' + (a[1] + b[1]) };
    }
    if (t === 4) { const a = rnd(3, 15), b = rnd(2, 10); return { q: 'Правоъгълник е със страни ' + a + ' см и ' + b + ' см. Колко е обиколката му (в см)?', ans: 2 * (a + b), ex: '2 × (' + a + ' + ' + b + ') = ' + (2 * (a + b)) }; }
    if (t === 5) { const a = rnd(3, 15), b = rnd(2, 12); if (Math.random() < 0.5) return { q: 'Правоъгълник е със страни ' + a + ' см и ' + b + ' см. Колко е лицето му (в кв. см)?', ans: a * b, ex: a + ' × ' + b + ' = ' + (a * b) }; return { q: 'Квадрат има обиколка ' + (4 * a) + ' см. Колко е страната му?', ans: a, ex: (4 * a) + ' : 4 = ' + a }; }
    const x = rnd(30, 80), y = rnd(30, 150 - x);
    if (Math.random() < 0.5) return { q: 'В триъгълник два от ъглите са ' + x + '° и ' + y + '°. Колко градуса е третият?', ans: 180 - x - y, ex: 'Сборът на ъглите в триъгълник е 180°: 180 − ' + x + ' − ' + y + ' = ' + (180 - x - y) };
    const a = rnd(2, 9); return { q: 'Куб е с ръб ' + a + ' см. Колко е обемът му (в куб. см)?', ans: a * a * a, ex: a + ' × ' + a + ' × ' + a + ' = ' + (a * a * a) };
  };

  // Видове задачи и за коя възраст се препоръчват
  const CATS = [
    { id: 'count', label: '🔢 Броене и сравняване', hint: 'Колко са, къде има повече', ages: [4, 6] },
    { id: 'math', label: '➕ Смятане', hint: 'Събиране, изваждане, таблица, дроби, проценти, уравнения', ages: [5, 14] },
    { id: 'word', label: '📖 Текстови задачи', hint: 'Задачи от живота – с пари, време, възраст', ages: [6, 14] },
    { id: 'seq', label: '🔁 Закономерности', hint: 'Кое следва в редицата – фигури и числа', ages: [4, 14] },
    { id: 'odd', label: '🧩 Кое е излишното', hint: 'Групиране и категории', ages: [4, 12] },
    { id: 'scale', label: '⚖️ Везни със символи', hint: 'Абстрактно мислене – първа стъпка към алгебрата', ages: [6, 14] },
    { id: 'order', label: '🧠 Логически подредби', hint: 'Кой е най-висок, ако…', ages: [7, 14] },
    { id: 'memory', label: '👀 Памет и внимание', hint: 'Запомни реда за няколко секунди', ages: [4, 14] },
    { id: 'clock', label: '🕒 Часовник и време', hint: 'Колко е часът, след колко минути', ages: [6, 11] },
    { id: 'geo', label: '📐 Геометрия', hint: 'Фигури, обиколка, лице, ъгли', ages: [8, 14] },
  ];
  const recommended = (age) => CATS.filter((c) => age >= c.ages[0] && age <= c.ages[1]);
  function level(cfg) {
    const a = cfg.age;
    const base = a <= 5 ? 1 : a <= 7 ? 2 : a <= 9 ? 3 : a <= 11 ? 4 : a <= 13 ? 5 : 6;
    return Math.max(1, Math.min(6, base + (cfg.diff === 'easy' ? -1 : cfg.diff === 'hard' ? 1 : 0)));
  }
  let lastQ = '';
  function makeTask(cfg) {
    const rec = recommended(cfg.age).map((c) => c.id);
    let cats = (cfg.cats || []).filter((c) => rec.includes(c));
    if (!cats.length) cats = rec;
    const L = level(cfg);
    for (let i = 0; i < 8; i++) {
      const c = pick(cats);
      try {
        const t = G[c](L);
        t.cat = c;
        if (typeof t.ans === 'number') t.ans = Math.round(t.ans * 100) / 100;
        // малките деца избират с бутони, по-големите пишат числото
        if (!t.ch && L <= 2 && typeof t.ans === 'number') t.ch = numChoices(t.ans);
        const key = t.q + (t.vis || '') + (t.memo || '');
        if (key === lastQ) continue;
        lastQ = key;
        return t;
      } catch (e) { /* следващ опит */ }
    }
    const a = rnd(2, 9), b = rnd(2, 9);
    return { q: 'Колко е ' + a + ' + ' + b + '?', ans: a + b, ch: numChoices(a + b), ex: a + ' + ' + b + ' = ' + (a + b) };
  }
  YTC.kidsTask = makeTask;   // за тестове

  // ======================================================== Настройки и дневен отчет
  const K_KEY = 'ytc-kids', D_KEY = 'ytc-kids-day';
  const DEF = { on: false, pin: '', age: 8, cats: [], diff: 'mid', every: 15, per: 2, limit: 60 };
  const cfg = () => Object.assign({}, DEF, LS.get(K_KEY, {}));
  const saveCfg = (c) => LS.set(K_KEY, c);
  function day() {
    let d = LS.get(D_KEY, null);
    if (!d || d.d !== dayKey()) d = { d: dayKey(), watched: 0, since: 0, bonus: 0, lock: d && d.lock === 'tasks' ? 'tasks' : '', ok: 0, bad: 0 };
    return d;
  }
  const saveDay = (d) => LS.set(D_KEY, d);
  YTC.kids = {
    active: () => { const c = cfg(); return !!(c.on && c.pin); },
    guard(fn) { if (this.active()) askPin(fn); else fn(); },
    openSettings: () => openSettings(),
  };

  // ======================================================== Интерфейс
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .ov{position:fixed;inset:0;z-index:2147483647;overflow-y:auto;-webkit-overflow-scrolling:touch;
    background:linear-gradient(160deg,#2b1055,#1a3a8a 60%,#0d6e8a);color:#fff;
    font:17px/1.4 -apple-system,BlinkMacSystemFont,Roboto,"Segoe UI",sans-serif;
    padding:calc(18px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center}
  .in{width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;flex:1}
  h1{font-size:24px;margin:6px 0 2px;text-align:center}
  .sub{opacity:.8;font-size:14px;text-align:center;margin-bottom:12px}
  .stars{font-size:22px;letter-spacing:4px;margin:4px 0 10px}
  .card{width:100%;background:rgba(255,255,255,.12);border-radius:22px;padding:18px 16px;text-align:center;backdrop-filter:blur(6px)}
  .vis{font-size:34px;line-height:1.45;white-space:pre-line;margin:4px 0 12px;word-break:break-word}
  .q{font-size:20px;font-weight:600;white-space:pre-line;margin:6px 0 14px}
  .ch{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
  .ch button,.kp button{border:0;border-radius:16px;background:#fff;color:#1a1a2e;font:700 22px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:14px 6px;min-height:58px}
  .ch button.big{font-size:32px}
  .ch button:active,.kp button:active{transform:scale(.96)}
  .disp{width:100%;background:#fff;color:#1a1a2e;border-radius:16px;font:700 30px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:10px;min-height:58px;margin-bottom:10px;text-align:center;letter-spacing:2px}
  .kp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}
  .kp .ok{background:#30d158;color:#fff}.kp .del{background:#ffd60a}
  .fb{width:100%;border-radius:18px;padding:14px;margin-top:14px;text-align:center;font-size:17px}
  .fb.good{background:#30d158;color:#06280f}.fb.bad{background:#ff9f0a;color:#2a1800}
  .fb b{display:block;font-size:22px;margin-bottom:4px}
  .go{border:0;border-radius:24px;background:#ff0033;color:#fff;font:700 18px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:14px 28px;margin-top:16px}
  .ghost{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:18px;font:600 14px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:9px 16px;margin-top:auto}
  .foot{margin-top:22px;display:flex;justify-content:center;width:100%}
  .memo{font-size:44px;letter-spacing:6px;line-height:1.5;margin:10px 0}
  .bar{width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,.2);overflow:hidden;margin:8px 0 4px}
  .bar i{display:block;height:100%;background:#ffd60a;transition:width linear}
  /* настройки */
  .set{background:#1c1c1e;color:#f2f2f7;align-items:stretch}
  .set .in{align-items:stretch}
  .grp{margin:18px 4px 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#8e8e93}
  .box{background:#2c2c2e;border-radius:12px;overflow:hidden}
  .row{display:flex;align-items:center;gap:12px;padding:11px 14px;min-height:48px;font-size:15px}
  .row+.row{border-top:.5px solid #3a3a3c}
  .lbl{flex:1}.lbl small{display:block;color:#8e8e93;font-size:12px;margin-top:1px}
  select{background:#3a3a3c;color:#fff;border:0;border-radius:8px;padding:7px 8px;font:15px inherit}
  .sw{position:relative;width:51px;height:31px;flex:0 0 auto}
  .sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;z-index:1}
  .sw i{position:absolute;inset:0;border-radius:16px;background:#39393d;transition:background .2s}
  .sw i:after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;transition:transform .2s}
  .sw input:checked+i{background:#30d158}.sw input:checked+i:after{transform:translateX(20px)}
  .seg{display:flex;gap:6px}
  .seg button{border:0;border-radius:8px;background:#3a3a3c;color:#fff;font:600 13px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:7px 10px}
  .seg button.on{background:#0a84ff}
  .btn{display:block;width:100%;border:0;border-radius:12px;background:#3a3a3c;color:#0a84ff;font:600 15px -apple-system,BlinkMacSystemFont,Roboto,sans-serif;padding:12px;margin-top:10px}
  .btn.main{background:#30d158;color:#000}
  .top{display:flex;justify-content:space-between;align-items:center}
  .top h1{font-size:21px;text-align:left}
  .x{border:0;background:#2c2c2e;color:#aeaeb2;width:32px;height:32px;border-radius:50%;font-size:18px;padding:0}
  .today{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .tile{background:#2c2c2e;border-radius:12px;padding:10px;text-align:center}
  .tile b{display:block;font-size:19px;color:#30d158}.tile span{font-size:11px;color:#aeaeb2}
  .pin{display:flex;gap:12px;justify-content:center;margin:14px 0}
  .pin i{width:18px;height:18px;border-radius:50%;border:2px solid #fff}
  .pin i.f{background:#fff}
  .err{color:#ff453a;text-align:center;min-height:22px;font-size:14px}
  .info{color:#8e8e93;font-size:13px;margin:10px 4px 0}
  `;
  let host = null, rootEl = null, mode = '';
  function mount(cls) {
    unmount();
    host = el('div'); host.id = 'ytc-kids';
    const r = host.attachShadow({ mode: 'open' });
    r.appendChild(el('style', null, CSS));
    rootEl = el('div', 'ov' + (cls ? ' ' + cls : ''));
    const inner = el('div', 'in');
    rootEl.appendChild(inner);
    r.appendChild(rootEl);
    (document.body || document.documentElement).appendChild(host);
    return inner;
  }
  function unmount() { if (host) host.remove(); host = null; rootEl = null; mode = ''; }
  const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

  function stopVideo() {
    const v = video();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { /* */ }
    try { if (v && v.webkitDisplayingFullscreen && v.webkitExitFullscreen) v.webkitExitFullscreen(); } catch (e) { /* */ }
    try { if (v && v.webkitPresentationMode === 'picture-in-picture') v.webkitSetPresentationMode('inline'); } catch (e) { /* */ }
    if (v && !v.paused) { window.__ytcUserPaused = true; v.pause(); }
  }

  // ---------- ПИН ----------
  function pinPad(inner, title, sub, onDone, onCancel) {
    clear(inner);
    inner.appendChild(el('h1', null, title));
    inner.appendChild(el('div', 'sub', sub));
    const dots = el('div', 'pin'); for (let i = 0; i < 4; i++) dots.appendChild(el('i'));
    inner.appendChild(dots);
    const err = el('div', 'err'); inner.appendChild(err);
    let val = '';
    const draw = () => [...dots.children].forEach((d, i) => d.classList.toggle('f', i < val.length));
    const kp = el('div', 'kp'); kp.style.maxWidth = '300px';
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✕']) {
      const b = el('button', k === '⌫' ? 'del' : '', k);
      b.addEventListener('click', () => {
        if (k === '✕') { onCancel(); return; }
        if (k === '⌫') val = val.slice(0, -1); else if (val.length < 4) val += k;
        draw();
        if (val.length === 4) { const v = val; val = ''; setTimeout(() => { draw(); onDone(v, (m) => { err.textContent = m; }); }, 120); }
      });
      kp.appendChild(b);
    }
    inner.appendChild(kp);
  }
  function askPin(fn, back) {
    const c = cfg();
    const prevMode = mode;
    const inner = mount('set');
    mode = 'pin';
    let tries = 0;
    pinPad(inner, '👤 Родител', 'Въведи ПИН', (v, err) => {
      if (v === c.pin) { unmount(); fn(); return; }
      tries++;
      err(tries >= 3 ? 'Грешен ПИН. Забравен ПИН се нулира само с изтриване и повторно инсталиране.' : 'Грешен ПИН');
    }, () => { unmount(); if (back) back(); else if (prevMode === 'tasks' || prevMode === 'limit') check(true); });
  }

  // ---------- Задачи ----------
  let state = null;   // { need, solved, wrong, task }
  function showTasks() {
    const c = cfg();
    stopVideo();
    if (mode === 'tasks' && host && host.isConnected) return;
    const inner = mount();
    mode = 'tasks';
    if (!state) state = { need: c.per, solved: 0, wrong: 0, task: null };
    nextTask(inner);
  }
  function header(inner) {
    inner.appendChild(el('h1', null, '🧠 Мисловна пауза!'));
    inner.appendChild(el('div', 'sub', 'Реши ' + (state.need === 1 ? 'задачата' : state.need + ' задачи') + ' и продължаваш да гледаш'));
    inner.appendChild(el('div', 'stars', '⭐'.repeat(state.solved) + '☆'.repeat(Math.max(0, state.need - state.solved))));
  }
  function parentBtn(inner) {
    const f = el('div', 'foot');
    const p = el('button', 'ghost', '👤 Родител');
    p.addEventListener('click', () => askPin(() => openSettings()));
    f.appendChild(p);
    inner.appendChild(f);
  }
  function nextTask(inner) {
    clear(inner);
    header(inner);
    const d = day();
    if (d.waitUntil && Date.now() < d.waitUntil) { waitScreen(inner, d.waitUntil); return; }
    const t = state.task || (state.task = makeTask(cfg()));
    const card = el('div', 'card');
    inner.appendChild(card);
    if (t.memo && !t.memoShown) {
      card.appendChild(el('div', 'q', 'Запомни какво виждаш!'));
      card.appendChild(el('div', 'memo', t.memo));
      const bar = el('div', 'bar'); const bi = el('i'); bi.style.width = '100%'; bar.appendChild(bi); card.appendChild(bar);
      requestAnimationFrame(() => { bi.style.transitionDuration = t.showMs + 'ms'; bi.style.width = '0%'; });
      setTimeout(() => { t.memoShown = true; if (mode === 'tasks') nextTask(inner); }, t.showMs);
      parentBtn(inner);
      return;
    }
    if (t.svg) card.appendChild(t.svg());
    if (t.vis) card.appendChild(el('div', 'vis', t.vis));
    card.appendChild(el('div', 'q', t.q));
    const answer = (val) => {
      const ok = typeof t.ans === 'number' ? Math.abs(Number(String(val).replace(',', '.')) - t.ans) < 1e-6 : String(val) === String(t.ans);
      const dd = day();
      if (ok) { dd.ok++; state.solved++; state.wrong = 0; } else { dd.bad++; state.wrong++; }
      saveDay(dd);
      feedback(inner, card, ok, t);
    };
    if (t.ch) {
      const g = el('div', 'ch');
      for (const o of t.ch) {
        const b = el('button', /^\p{Extended_Pictographic}/u.test(o) ? 'big' : '', o);
        b.addEventListener('click', () => answer(o));
        g.appendChild(b);
      }
      card.appendChild(g);
    } else {
      const disp = el('div', 'disp', ' ');
      card.appendChild(disp);
      let val = '';
      const kp = el('div', 'kp');
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      keys.push(typeof t.ans === 'number' && t.ans < 0 ? '−' : (typeof t.ans === 'number' && t.ans % 1 ? ',' : '⌫'), '0', '✓');
      for (const k of keys) {
        const b = el('button', k === '✓' ? 'ok' : k === '⌫' ? 'del' : '', k);
        b.addEventListener('click', () => {
          if (k === '✓') { if (val && val !== '-') answer(val); return; }
          if (k === '⌫') val = val.slice(0, -1);
          else if (k === '−') val = val.startsWith('-') ? val.slice(1) : '-' + val;
          else if (val.length < 7) val += k === ',' ? '.' : k;
          disp.textContent = val ? val.replace('-', '−').replace('.', ',') : ' ';
        });
        kp.appendChild(b);
      }
      if (keys[9] !== '⌫') { const bk = el('button', 'del', '⌫'); bk.addEventListener('click', () => { val = val.slice(0, -1); disp.textContent = val ? val.replace('-', '−') : ' '; }); bk.style.gridColumn = '1 / 4'; kp.appendChild(bk); }
      card.appendChild(kp);
    }
    parentBtn(inner);
  }
  function feedback(inner, card, ok, t) {
    clear(inner);
    header(inner);
    inner.appendChild(card);
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; if (String(b.textContent) === String(t.ans)) b.style.background = '#30d158'; });
    const fb = el('div', 'fb ' + (ok ? 'good' : 'bad'));
    fb.appendChild(el('b', null, ok ? pick(['🎉 Браво!', '🌟 Супер!', '👏 Точно така!', '🚀 Отлично!']) : '🤔 Не съвсем'));
    fb.appendChild(el('div', null, ok ? 'Правилно: ' + String(t.ans).replace('.', ',') : 'Отговорът е ' + String(t.ans).replace('.', ',') + '. ' + t.ex));
    inner.appendChild(fb);
    state.task = null;
    const done = state.solved >= state.need;
    const go = el('button', 'go', done ? '▶ Продължи гледането' : ok ? 'Следваща задача' : 'Опитай с нова задача');
    go.addEventListener('click', () => {
      if (done) { unlock(); return; }
      if (state.wrong >= 3) { const d = day(); d.waitUntil = Date.now() + 30e3; saveDay(d); state.wrong = 0; }
      nextTask(inner);
    });
    inner.appendChild(go);
    parentBtn(inner);
  }
  function waitScreen(inner, until) {
    const card = el('div', 'card');
    card.appendChild(el('div', 'vis', '😌'));
    card.appendChild(el('div', 'q', 'Почини си малко и опитай пак.'));
    const n = el('div', 'disp', ''); card.appendChild(n);
    inner.appendChild(card);
    const tm = setInterval(() => {
      const s = Math.ceil((until - Date.now()) / 1000);
      if (mode !== 'tasks') { clearInterval(tm); return; }
      if (s <= 0) { clearInterval(tm); nextTask(inner); return; }
      n.textContent = s + ' с';
    }, 250);
    parentBtn(inner);
  }
  function unlock() {
    if (state && state.test) { state = null; openSettings(); return; }
    const d = day();
    d.lock = ''; d.since = 0; d.waitUntil = 0;
    saveDay(d);
    state = null;
    unmount();
    const v = video();
    if (v && onWatch()) { window.__ytcUserPaused = false; v.play().catch(() => {}); }
    if (YTC.toast) YTC.toast('✓ Гледай още ' + cfg().every + ' мин');
  }

  // ---------- Твърд лимит ----------
  function showLimit() {
    stopVideo();
    if (mode === 'limit' && host && host.isConnected) return;
    const inner = mount();
    mode = 'limit';
    inner.appendChild(el('div', 'vis', '🌙'));
    inner.appendChild(el('h1', null, 'Времето за гледане днес свърши'));
    const d = day();
    inner.appendChild(el('div', 'sub', 'Изгледа ' + Math.round(d.watched / 60) + ' мин. Утре можеш пак! Сега е време за игра, книжка или разходка.'));
    const card = el('div', 'card');
    card.appendChild(el('div', 'q', 'Днес реши ' + d.ok + ' ' + (d.ok === 1 ? 'задача' : 'задачи') + ' ⭐'));
    inner.appendChild(card);
    const f = el('div', 'foot');
    const p = el('button', 'ghost', '👤 Родител: добави време');
    p.addEventListener('click', () => askPin(() => openSettings()));
    f.appendChild(p);
    inner.appendChild(f);
  }

  // ---------- Настройки на родителя ----------
  function openSettings() {
    let c = cfg();
    const inner = mount('set');
    mode = 'settings';
    if (!c.pin) {
      // първо – ПИН
      let first = '';
      const ask1 = () => pinPad(inner, '👨‍👩‍👧 Родителски контрол', 'Измисли ПИН от 4 цифри. Детето не бива да го знае.', (v) => { first = v; ask2(); }, unmount);
      const ask2 = () => pinPad(inner, '👨‍👩‍👧 Родителски контрол', 'Въведи ПИН-а още веднъж', (v, err) => {
        if (v !== first) { err('Не съвпада – опитай отначало'); setTimeout(ask1, 900); return; }
        c.pin = v; saveCfg(c); openSettings();
      }, unmount);
      ask1();
      return;
    }
    const top = el('div', 'top');
    top.appendChild(el('h1', null, '👨‍👩‍👧 Родителски контрол'));
    const x = el('button', 'x', '✕'); x.addEventListener('click', () => { unmount(); check(true); }); top.appendChild(x);
    inner.appendChild(top);

    const d = day();
    const today = el('div', 'today');
    for (const [v, l] of [[Math.round(d.watched / 60) + ' мин', 'гледано днес'], [String(d.ok), 'решени задачи'], [String(d.bad), 'грешни опита']]) {
      const t = el('div', 'tile'); t.appendChild(el('b', null, v)); t.appendChild(el('span', null, l)); today.appendChild(t);
    }
    inner.appendChild(today);

    const sw = (on, fn) => { const s = el('span', 'sw'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = on; cb.addEventListener('change', () => fn(cb.checked)); s.appendChild(cb); s.appendChild(el('i')); return s; };
    const row = (label, hint, ctl) => { const r = el('label', 'row'); const l = el('div', 'lbl', label); if (hint) l.appendChild(el('small', null, hint)); r.appendChild(l); r.appendChild(ctl); return r; };
    const sel = (val, opts, fn) => { const s = el('select'); for (const [v, l] of opts) { const o = el('option', null, l); o.value = String(v); if (String(v) === String(val)) o.selected = true; s.appendChild(o); } s.addEventListener('change', () => fn(s.value)); return s; };
    const upd = (k, v) => { c = cfg(); c[k] = v; saveCfg(c); };

    inner.appendChild(el('div', 'grp', 'Основно'));
    const b1 = el('div', 'box');
    b1.appendChild(row('Включи родителския контрол', 'Мисловни паузи и дневен лимит', sw(c.on, (v) => upd('on', v))));
    b1.appendChild(row('Възраст на детето', 'Задачите се подбират според нея', sel(c.age, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((a) => [a, a + ' г.']), (v) => { upd('age', +v); openSettings(); })));
    inner.appendChild(b1);

    inner.appendChild(el('div', 'grp', 'Мисловни паузи'));
    const b2 = el('div', 'box');
    b2.appendChild(row('Пауза на всеки', 'Минути гледане между задачите', sel(c.every, [5, 10, 15, 20, 30, 45, 60].map((m) => [m, m + ' мин']), (v) => upd('every', +v))));
    b2.appendChild(row('Задачи на пауза', 'Колко трябва да реши правилно', sel(c.per, [1, 2, 3, 4, 5].map((m) => [m, String(m)]), (v) => upd('per', +v))));
    const seg = el('div', 'seg');
    for (const [k, l] of [['easy', 'Лесно'], ['mid', 'Нормално'], ['hard', 'Трудно']]) {
      const b = el('button', c.diff === k ? 'on' : '', l);
      b.addEventListener('click', (e) => { e.preventDefault(); upd('diff', k); seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b)); });
      seg.appendChild(b);
    }
    b2.appendChild(row('Трудност', 'Спрямо възрастта', seg));
    inner.appendChild(b2);

    inner.appendChild(el('div', 'grp', 'Видове задачи (препоръчани за ' + c.age + ' г.)'));
    const b3 = el('div', 'box');
    const rec = recommended(c.age);
    const chosen = new Set((c.cats || []).filter((x) => rec.some((r) => r.id === x)));
    if (!chosen.size) rec.forEach((r) => chosen.add(r.id));
    for (const cat of rec) {
      b3.appendChild(row(cat.label, cat.hint, sw(chosen.has(cat.id), (v) => {
        if (v) chosen.add(cat.id); else chosen.delete(cat.id);
        upd('cats', [...chosen]);
      })));
    }
    inner.appendChild(b3);
    inner.appendChild(el('div', 'info', 'Ако изключиш всички, ще се редуват всички препоръчани.'));

    inner.appendChild(el('div', 'grp', 'Твърд дневен лимит'));
    const b4 = el('div', 'box');
    b4.appendChild(row('Най-много гледане на ден', 'След него гледането спира, каквото и да реши детето', sel(c.limit, [[0, 'Без лимит'], [15, '15 мин'], [30, '30 мин'], [45, '45 мин'], [60, '1 час'], [90, '1,5 часа'], [120, '2 часа'], [180, '3 часа']], (v) => upd('limit', +v))));
    inner.appendChild(b4);

    const btn = (t, fn, cls) => { const b = el('button', 'btn' + (cls ? ' ' + cls : ''), t); b.addEventListener('click', fn); inner.appendChild(b); return b; };
    inner.appendChild(el('div', 'grp', 'Днес'));
    for (const m of [15, 30, 60]) btn('＋ ' + m + ' мин гледане днес', () => { const dd = day(); dd.bonus = (dd.bonus || 0) + m; if (dd.lock === 'limit') dd.lock = ''; saveDay(dd); if (YTC.toast) YTC.toast('✓ Добавени ' + m + ' мин за днес'); });
    btn('Пропусни сегашната пауза', () => { const dd = day(); dd.lock = ''; dd.since = 0; saveDay(dd); state = null; if (YTC.toast) YTC.toast('✓ Паузата е пропусната'); });
    btn('🧪 Пробвай една задача', () => { state = { need: 1, solved: 0, wrong: 0, task: null, test: true }; const inn = mount(); mode = 'tasks'; nextTask(inn); });
    btn('Смени ПИН', () => { c = cfg(); c.pin = ''; saveCfg(c); openSettings(); });
    btn('✓ Готово', () => { unmount(); check(true); }, 'main');
    inner.appendChild(el('div', 'info', 'Задачите се създават на самото устройство – без интернет и без да се изпраща нищо. Докато е включен родителският контрол, настройките на YT Контрол също искат ПИН.'));
  }

  // ======================================================== Броене на времето
  let last = 0;
  function check(force) {
    const c = cfg();
    if (!c.on || !c.pin) { if (mode === 'tasks' || mode === 'limit') { unmount(); state = null; } return; }
    if (mode === 'settings' || mode === 'pin' || (state && state.test)) return;
    const d = day();
    const limitSec = c.limit ? (c.limit + (d.bonus || 0)) * 60 : 0;
    if (limitSec && d.watched >= limitSec) { showLimit(); return; }
    if (mode === 'limit') unmount();
    if (d.lock === 'tasks' || d.since >= c.every * 60) {
      if (d.lock !== 'tasks') { d.lock = 'tasks'; saveDay(d); }
      if (onWatch() || force) showTasks();
      return;
    }
  }
  function tick() {
    const now = Date.now();
    const dt = last ? Math.min(5, (now - last) / 1000) : 0;
    last = now;
    const c = cfg();
    if (!c.on || !c.pin) { if (mode === 'tasks' || mode === 'limit') check(); return; }
    const v = video();
    const blocked = mode === 'tasks' || mode === 'limit';
    if (blocked) { if (v && !v.paused) { window.__ytcUserPaused = true; v.pause(); } check(); return; }
    if (dt && v && onWatch() && !v.paused && !v.ended && v.readyState > 1) {
      const d = day();
      d.watched += dt; d.since += dt;
      saveDay(d);
    }
    check();
  }
  // пускане (вкл. от заключения екран), докато е заключено → веднага пауза
  document.addEventListener('play', (e) => {
    if ((mode === 'tasks' || mode === 'limit') && e.target && e.target.pause) { window.__ytcUserPaused = true; e.target.pause(); }
  }, true);
  setInterval(tick, 1000);
  const boot = () => setTimeout(() => check(), 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
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

      const kb = el('button', 'act', '👨‍👩‍👧 Родителски контрол' + (YTC.kids && YTC.kids.active() ? ' – включен' : ''));
      kb.style.color = '#30d158';
      kb.addEventListener('click', () => { close(); if (YTC.kids) YTC.kids.openSettings(); });
      sheet.appendChild(kb);

      note = el('div', 'note');
      note.appendChild(el('span', null, 'Някои промени важат напълно след презареждане.'));
      const rl = el('button', null, 'Презареди'); rl.addEventListener('click', () => location.reload());
      note.appendChild(rl);
      sheet.appendChild(note);

      let card = null, debounce;
      for (const f of YTC.SCHEMA) {
        if (f.key === 'captionsButton' && window.YTCApp && window.YTCApp.platform === 'ios') continue; // няма го в iOS приложението
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
    // при включен родителски контрол настройките искат ПИН (иначе детето просто би го изключило)
    function open() { if (YTC.kids) YTC.kids.guard(openNow); else openNow(); }
    function openNow() {
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
