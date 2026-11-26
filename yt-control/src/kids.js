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
