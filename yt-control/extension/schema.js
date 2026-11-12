/* YT Control – описание на настройките (споделено от разширението и userscript-а) */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  YTC.VERSION = '1.0.0';

  YTC.SCHEMA = [
    { key: 'enabled', label: 'Включено', def: true },

    { group: '🚫 Shorts / Рийлс' },
    { key: 'blockShorts', label: 'Пълно блокиране на Shorts (рафтове, бутони, табове, видеа)', def: true },
    { key: 'redirectShorts', label: 'Линк към Short → отваряй го като нормално видео (иначе – към началото)', def: true },

    { group: '📺 Реклами' },
    { key: 'hideAds', label: 'Скривай рекламни блокове, банери и спонсорирано', def: true },
    { key: 'skipVideoAds', label: 'Автоматично пропускай видео рекламите (заглушава + превърта)', def: true },

    { group: '🧹 Съдържание' },
    { key: 'hideHomeFeed', label: 'Фокус режим: скрий препоръките на началната страница', def: false },
    { key: 'hideRelated', label: 'Скрий препоръките до/под видеото', def: false },
    { key: 'hideEndscreen', label: 'Скрий крайните карти и „следващи видеа“ в плейъра', def: false },
    { key: 'hideComments', label: 'Скрий коментарите', def: false },
    { key: 'hideLive', label: 'Скрий излъчвания на живо', def: false },
    { key: 'hideMixes', label: 'Скрий миксове и плейлисти', def: false },
    { key: 'hideWatched', label: 'Скрий вече гледани видеа', def: false },
    { key: 'hideShelves', label: 'Скрий тематични рафтове (новини, тенденции, „Разгледайте“)', def: false },

    { group: '🔎 Филтри' },
    { key: 'blockedWords', type: 'text', label: 'Блокирани думи в заглавието (по една на ред)', def: '' },
    { key: 'blockedChannels', type: 'text', label: 'Блокирани канали – име или @handle (по един на ред)', def: '' },
    { key: 'minDuration', type: 'number', label: 'Скрий видеа, по-кратки от N минути (0 = изключено)', def: 0 },

    { group: '⚙️ Общи' },
    { key: 'showGear', label: 'Показвай бутон ⚙ върху YouTube за бърз достъп до настройките', def: true },
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
        if (f.type === 'text') d[f.key] = String(v == null ? '' : v);
        else if (f.type === 'number') d[f.key] = Math.max(0, Number(v) || 0);
        else d[f.key] = !!v;
      }
    }
    return d;
  };
})();
