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
    setInterval(adTick, 150);
    setInterval(() => { if (location.href !== lastHref) pass(); }, 250);
    schedule();
  };
})();
