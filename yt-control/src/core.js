/* YT Control – основна логика, работи върху www.youtube.com и m.youtube.com */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  const CACHE_KEY = 'ytc-cache';
  const IN_FRAME = window.top !== window;

  // ---------- Селектори ----------
  // Отделни "карти" на видеа (десктоп + мобилна версия)
  const ITEM_SEL = [
    'ytd-rich-grid-media', 'ytd-video-renderer', 'ytd-compact-video-renderer', 'ytd-grid-video-renderer',
    'ytd-reel-item-renderer', 'ytd-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-radio-renderer',
    'ytd-compact-radio-renderer', 'yt-lockup-view-model',
    'ytm-video-with-context-renderer', 'ytm-compact-video-renderer', 'ytm-media-item', 'ytm-reel-item-renderer',
    'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2', 'ytm-video-card-renderer',
    'ytm-compact-playlist-renderer', 'ytm-compact-radio-renderer', 'ytm-playlist-renderer',
  ].join(',');
  // Външна обвивка, която трябва да се скрие, за да не остава празно място
  const OUTER_SEL = 'ytd-rich-item-renderer, ytm-rich-item-renderer';

  const CSS = {
    blockShorts: [
      'ytd-reel-shelf-renderer', 'ytm-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
      'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
      'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
      'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2)',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)',
      'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
      'ytd-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
      'yt-tab-shape[tab-title="Shorts"]',
      'ytd-reel-video-renderer', 'ytd-shorts',
    ],
    hideAds: [
      '#masthead-ad', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
      'ytd-statement-banner-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer',
      'ytd-display-ad-renderer', 'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer',
      'ytd-player-legacy-desktop-watch-ads-renderer', '#player-ads', 'ytd-search-pyv-renderer',
      'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)', 'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
      'ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer)', 'ytd-brand-video-singleton-renderer',
      'ytd-brand-video-shelf-renderer', 'ytd-merch-shelf-renderer', 'ytd-primetime-promo-renderer',
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
      'ytd-mealbar-promo-renderer', 'yt-mealbar-promo-renderer',
      '.ytp-ad-overlay-container', '.ytp-ad-overlay-slot', '.ytp-ad-image-overlay', '.ytp-suggested-action',
      '.ytp-featured-product', '.ytp-paid-content-overlay', 'ytd-video-masthead-ad-v3-renderer',
      'ad-slot-renderer', 'ytm-rich-item-renderer:has(ad-slot-renderer)', 'ytm-promoted-sparkles-web-renderer',
      'ytm-promoted-video-renderer', 'ytm-companion-ad-renderer', 'ytm-companion-slot', 'ytm-promoted-sparkles-text-search-renderer',
      'ytm-item-section-renderer:has(> lazy-list > ad-slot-renderer)',
    ],
    hideRelated: [
      '#related', 'ytd-watch-next-secondary-results-renderer',
      'ytm-item-section-renderer[section-identifier="related-items"]',
      'ytm-item-section-renderer[data-content-type="related"]',
      'ytm-single-column-watch-next-results-renderer ytm-item-section-renderer:has(ytm-video-with-context-renderer)',
    ],
    hideEndscreen: [
      '.ytp-endscreen-content', '.ytp-ce-element', '.videowall-endscreen', '.ytp-fullscreen-grid',
      '.ytp-fullscreen-grid-peeking', '.ytp-autonav-endscreen-countdown-overlay', '.ytp-pause-overlay',
    ],
    hideComments: [
      'ytd-comments', '#comments', 'ytm-comment-section-renderer', 'ytm-comments-entry-point-header-renderer',
      'ytd-item-section-renderer[section-identifier="comment-item-section"]',
      'ytm-item-section-renderer[section-identifier="comments-entry-point"]',
    ],
    hideShelves: [
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer)',
      'ytm-rich-section-renderer:has(ytm-rich-shelf-renderer)',
      'ytd-guide-section-renderer:has(a[href="/feed/trending"])',
      'ytd-guide-section-renderer:has(a[href^="/feed/explore"])',
      'ytd-shelf-renderer', 'ytd-horizontal-card-list-renderer',
    ],
  };
  // Скриване на началния фийд (само когато сме на "/")
  const HOME_CSS = [
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
    'ytd-browse[page-subtype="home"] #chips-wrapper',
    'ytm-browse ytm-rich-grid-renderer', 'ytm-browse ytm-section-list-renderer', 'ytm-feed-filter-chip-bar-renderer',
  ];

  const SKIP_SEL = [
    '.ytp-skip-ad-button', '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button', '.ytp-ad-skip-button-container button', 'button.ytp-ad-skip-button-text',
  ].join(',');

  // ---------- Състояние ----------
  let S = YTC.defaults();
  let words = [], channels = [];
  let styleEl = null, scheduled = false, lastHref = '';
  const ad = { active: false, muted: false };

  function readCache() {
    try { return YTC.normalize(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); } catch (e) { return YTC.defaults(); }
  }
  function writeCache(s) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  function lines(txt) {
    return String(txt || '').split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  }
  function normChannel(x) {
    const m = x.match(/@([^/?#\s]+)/);
    return (m ? m[1] : x).toLowerCase().trim();
  }

  // ---------- CSS слой ----------
  function buildCSS() {
    if (!S.enabled) return '';
    const rules = ['[data-ytc-hidden]{display:none!important}'];
    for (const k in CSS) if (S[k]) for (const sel of CSS[k]) rules.push(sel + '{display:none!important}');
    if (S.hideHomeFeed) for (const sel of HOME_CSS) rules.push('html.ytc-home ' + sel + '{display:none!important}');
    // Всяко правило е отделно, за да не "счупи" цялото ако браузърът не познава някой селектор
    return rules.join('\n');
  }
  function applyCSS() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'ytc-style'; }
    const css = buildCSS();
    if (styleEl.textContent !== css) styleEl.textContent = css;
    const parent = document.head || document.documentElement;
    if (parent && styleEl.parentNode !== parent) parent.appendChild(styleEl);
  }

  // ---------- Анализ на една карта ----------
  function texts(item, sel) {
    const out = [];
    item.querySelectorAll(sel).forEach((e) => { const t = (e.textContent || '').trim(); if (t) out.push(t); });
    return out;
  }
  const BADGE_SEL = 'ytd-thumbnail-overlay-time-status-renderer, .badge-shape-wiz__text, .yt-badge-shape__text, ' +
    'ytm-thumbnail-overlay-time-status-renderer, .thumbnail-overlay-time-status-renderer, badge-shape';
  const TITLE_SEL = '#video-title, .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model-wiz__title, ' +
    'h3, .media-item-headline, .compact-media-item-headline, .shortsLockupViewModelHostMetadataTitle';
  const BYLINE_SEL = 'ytd-channel-name #text, ytd-channel-name a, .yt-content-metadata-view-model__metadata-text, ' +
    '.yt-content-metadata-view-model-wiz__metadata-text, .ytm-badge-and-byline-item-byline, .media-item-byline, ' +
    '.compact-media-item-byline';

  function durationSec(badges) {
    for (const t of badges) {
      const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
      if (m) return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
    }
    return null;
  }
  function isWatched(item) {
    const p = item.querySelector('ytd-thumbnail-overlay-resume-playback-renderer #progress, ' +
      '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, ' +
      '.thumbnail-overlay-resume-playback-progress, yt-thumbnail-overlay-progress-bar-view-model [style*="width"]');
    if (!p) return false;
    const w = parseFloat(p.style && p.style.width);
    return isNaN(w) ? true : w >= 80;
  }
  function titleOf(item) {
    const t = item.querySelector(TITLE_SEL);
    if (!t) return '';
    return ((t.textContent || '') + ' ' + (t.getAttribute('title') || '')).toLowerCase();
  }
  function channelsOf(item) {
    const out = new Set();
    item.querySelectorAll('a[href*="/@"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/\/@([^/?#]+)/);
      if (m) { try { out.add(decodeURIComponent(m[1]).toLowerCase()); } catch (e) { out.add(m[1].toLowerCase()); } }
      const t = (a.textContent || '').trim().toLowerCase();
      if (t) out.add(t.replace(/^@/, ''));
    });
    for (const t of texts(item, BYLINE_SEL)) {
      const low = t.toLowerCase();
      out.add(low);
      out.add(low.split('•')[0].trim());
    }
    return out;
  }

  function reasonFor(item) {
    const tag = item.tagName.toLowerCase();
    if (S.blockShorts && (/reel-item|shorts-lockup/.test(tag) ||
        item.querySelector('a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'))) return 'shorts';
    if (S.hideMixes && (/radio|playlist/.test(tag) ||
        item.querySelector('a[href*="start_radio="], a[href*="&list="], a[href*="?list="], a[href^="/playlist?"], ' +
          'yt-collection-thumbnail-view-model, yt-collections-stack'))) return 'mix';
    const badges = (S.hideLive || S.minDuration > 0) ? texts(item, BADGE_SEL) : [];
    if (S.hideLive && (item.querySelector('.badge-style-type-live-now-alpha, .badge-style-type-live-now, ' +
        '[overlay-style="LIVE"], .yt-badge-shape--thumbnail-live, .badge-shape-wiz--thumbnail-live') ||
        badges.some((t) => /^(live|на живо)$/i.test(t)))) return 'live';
    if (S.hideWatched && isWatched(item)) return 'watched';
    if (S.minDuration > 0) {
      const d = durationSec(badges);
      if (d != null && d < S.minDuration * 60) return 'duration';
    }
    if (words.length) {
      const t = titleOf(item);
      if (t && words.some((w) => t.includes(w))) return 'word';
    }
    if (channels.length) {
      const c = channelsOf(item);
      if (channels.some((x) => c.has(x))) return 'channel';
    }
    return null;
  }

  function mark(el, reason) {
    if (reason) { if (el.getAttribute('data-ytc-hidden') !== reason) el.setAttribute('data-ytc-hidden', reason); }
    else if (el.hasAttribute('data-ytc-hidden')) el.removeAttribute('data-ytc-hidden');
  }

  // ---------- Shorts: URL и навигация ----------
  function checkUrl() {
    if (!S.enabled || !S.blockShorts) return false;
    const p = location.pathname;
    const m = p.match(/^\/shorts\/([\w-]{5,})/);
    if (m) {
      document.querySelectorAll('video').forEach((v) => { try { v.pause(); v.muted = true; } catch (e) { /* */ } });
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
    e.preventDefault();
    e.stopImmediatePropagation();
    if (m && S.redirectShorts) location.href = '/watch?v=' + m[1];
  }

  // ---------- Основен проход ----------
  function pass() {
    scheduled = false;
    if (!S.enabled) return;
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (checkUrl()) return;
    }
    if (!document.documentElement) return;
    applyCSS();
    document.documentElement.classList.toggle('ytc-home', location.pathname === '/');

    const items = document.querySelectorAll(ITEM_SEL);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const target = it.closest(OUTER_SEL) || it;
      mark(target, reasonFor(it));
    }

    if (S.blockShorts) {
      // Бутони/чипове/табове с надпис "Shorts" (менюта, филтри в търсенето, долна лента на мобилно)
      document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytm-pivot-bar-item-renderer, ' +
        'yt-chip-cloud-chip-renderer, ytm-chip-cloud-chip-renderer, yt-tab-shape, tp-yt-paper-tab, ' +
        'ytd-rich-shelf-renderer, ytm-rich-shelf-renderer').forEach((e) => {
        if (e.hasAttribute('data-ytc-hidden')) return;
        const label = (e.getAttribute('aria-label') || e.getAttribute('tab-title') || '').trim();
        const head = e.querySelector('#title, .yt-core-attributed-string, .pivot-bar-item-title, a[title]');
        const t = (head ? (head.getAttribute('title') || head.textContent) : e.textContent || '').trim();
        if (label === 'Shorts' || t === 'Shorts' || (/rich-shelf/.test(e.tagName.toLowerCase()) && /^shorts$/i.test(t))) {
          mark(e.closest('ytd-rich-section-renderer, ytm-rich-section-renderer') || e, 'shorts');
        }
      });
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(pass, 150);
  }

  function resetMarks() {
    document.querySelectorAll('[data-ytc-hidden]').forEach((e) => e.removeAttribute('data-ytc-hidden'));
  }

  // ---------- Видео реклами ----------
  function adTick() {
    if (!S.enabled || !S.skipVideoAds) return;
    const p = document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');
    const v = p && p.querySelector('video');
    if (p && v) {
      if (!ad.active) { ad.active = true; ad.muted = v.muted; }
      v.muted = true;
      try { if (v.playbackRate < 16) v.playbackRate = 16; } catch (e) { /* */ }
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) {
        try { v.currentTime = v.duration - 0.1; } catch (e) { /* */ }
      }
      p.querySelectorAll(SKIP_SEL).forEach((b) => { try { b.click(); } catch (e) { /* */ } });
    } else if (ad.active) {
      ad.active = false;
      const mv = document.querySelector('.html5-video-player video');
      if (mv) {
        mv.muted = ad.muted;
        if (mv.playbackRate >= 16) mv.playbackRate = 1;
      }
    }
  }

  // ---------- Бутон ⚙ и панел върху страницата ----------
  let gearHost = null, adapterRef = null;
  function ensureGear() {
    if (IN_FRAME || !document.body) return;
    if (!S.showGear) { if (gearHost) { gearHost.remove(); gearHost = null; } return; }
    if (gearHost && gearHost.isConnected) return;
    gearHost = document.createElement('div');
    gearHost.id = 'ytc-gear-host';
    gearHost.style.cssText = 'position:fixed;left:10px;bottom:70px;z-index:2147483647;';
    const root = gearHost.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = `
      .g{width:38px;height:38px;border-radius:50%;border:1px solid #444;background:rgba(24,24,24,.85);color:#fff;
         font-size:20px;cursor:pointer;opacity:.55;transition:opacity .2s;display:flex;align-items:center;justify-content:center}
      .g:hover{opacity:1}
      .wrap{position:absolute;left:0;bottom:46px;width:min(380px,92vw);max-height:75vh;overflow:auto;border-radius:12px;
         box-shadow:0 8px 30px rgba(0,0,0,.6)}
      .wrap[hidden]{display:none}`;
    const btn = document.createElement('button');
    btn.className = 'g'; btn.textContent = '⚙'; btn.title = 'YouTube Контрол – настройки';
    const wrap = document.createElement('div');
    wrap.className = 'wrap'; wrap.hidden = true;
    const close = () => { wrap.hidden = true; };
    btn.addEventListener('click', () => {
      wrap.hidden = !wrap.hidden;
      if (!wrap.hidden) YTC.buildPanel(wrap, S, (ns) => update(ns, true), { onClose: close });
    });
    root.appendChild(st); root.appendChild(wrap); root.appendChild(btn);
    document.body.appendChild(gearHost);
  }

  // ---------- Прилагане на настройки ----------
  function update(ns, persist) {
    S = YTC.normalize(ns);
    words = lines(S.blockedWords);
    channels = lines(S.blockedChannels).map(normChannel);
    writeCache(S);
    if (persist && adapterRef) adapterRef.save(S);
    applyCSS();
    resetMarks();
    lastHref = '';
    if (!S.enabled && document.documentElement) document.documentElement.classList.remove('ytc-home');
    pass();
    ensureGear();
  }

  YTC.start = function (adapter) {
    adapterRef = adapter;
    update(readCache(), false); // мигновено, още преди страницата да се зареди
    Promise.resolve(adapter.load()).then((v) => { if (v && Object.keys(v).length) update(v, false); }).catch(() => {});
    if (adapter.onChange) adapter.onChange((v) => update(v, false));

    document.addEventListener('click', onClick, true);
    ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'state-navigateend', 'popstate']
      .forEach((ev) => window.addEventListener(ev, schedule, true));
    document.addEventListener('yt-navigate-finish', schedule, true);

    // Наблюдаваме самия document – работи дори преди да съществува <html>
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
    schedule();
    document.addEventListener('DOMContentLoaded', () => { applyCSS(); ensureGear(); schedule(); });

    setInterval(adTick, 250);
    setInterval(() => { if (location.href !== lastHref) schedule(); ensureGear(); }, 1000);
  };
})();
