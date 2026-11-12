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
