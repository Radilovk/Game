/* YT Контрол – настройки (само мобилна версия m.youtube.com) */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});
  YTC.VERSION = '2.3.0';
  YTC.KEY = 'ytc-settings';

  YTC.SCHEMA = [
    { group: 'Shorts' },
    { key: 'blockShorts', label: 'Блокирай Shorts напълно', hint: 'Изчезват навсякъде. Линк към Short не се отваря изобщо.', def: true },

    { group: 'Реклами' },
    { key: 'hideAds', label: 'Премахвай рекламите от данните', hint: 'Най-чисто. Ако клиповете тръгват бавно – изключи го, остава прескачането', def: true },
    { key: 'skipVideoAds', label: 'Прескачай видео рекламите', hint: 'Ако мине реклама: скрита, без звук, превъртана за миг', def: true },

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
