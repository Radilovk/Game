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
