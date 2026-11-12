/* YT Control – панел с настройки (без innerHTML, заради Trusted Types в YouTube) */
(function () {
  'use strict';
  const YTC = (globalThis.YTC = globalThis.YTC || {});

  YTC.PANEL_CSS = `
  .ytc-panel{font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eee;background:#181818;
    border:1px solid #333;border-radius:12px;padding:12px 14px;box-sizing:border-box;width:100%}
  .ytc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .ytc-title{font-weight:700;font-size:16px}
  .ytc-title small{font-weight:400;color:#888;font-size:11px;margin-left:6px}
  .ytc-x{background:none;border:0;color:#aaa;font-size:22px;cursor:pointer;padding:0 4px}
  .ytc-group{margin:12px 0 4px;font-weight:700;color:#ff6b6b;font-size:13px}
  .ytc-row{display:flex;gap:10px;align-items:flex-start;padding:5px 0;cursor:pointer}
  .ytc-row input[type=checkbox]{width:18px;height:18px;flex:0 0 auto;margin:1px 0 0;accent-color:#ff3b3b}
  .ytc-col{display:block;padding:5px 0}
  .ytc-col span{display:block;margin-bottom:4px}
  .ytc-col textarea,.ytc-col input{width:100%;box-sizing:border-box;background:#0f0f0f;color:#eee;border:1px solid #444;
    border-radius:8px;padding:6px 8px;font:13px/1.4 inherit}
  .ytc-col textarea{min-height:64px;resize:vertical}
  .ytc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px}
  .ytc-btn{background:#272727;color:#eee;border:1px solid #444;border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit}
  .ytc-saved{color:#6bd46b;font-size:12px;opacity:0;transition:opacity .3s}
  .ytc-saved.on{opacity:1}
  .ytc-off .ytc-body{opacity:.45}
  `;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * Рисува панела в `root`.
   * @param {Element|ShadowRoot} root
   * @param {object} settings
   * @param {(s:object)=>void} onSave
   * @param {{onClose?:()=>void}} [opts]
   */
  YTC.buildPanel = function (root, settings, onSave, opts) {
    opts = opts || {};
    while (root.firstChild) root.removeChild(root.firstChild);
    const s = Object.assign({}, settings);

    const panel = el('div', 'ytc-panel');
    const head = el('div', 'ytc-head');
    const title = el('div', 'ytc-title', 'YouTube Контрол');
    title.appendChild(el('small', null, 'v' + YTC.VERSION));
    head.appendChild(title);
    if (opts.onClose) {
      const x = el('button', 'ytc-x', '×');
      x.title = 'Затвори';
      x.addEventListener('click', opts.onClose);
      head.appendChild(x);
    }
    panel.appendChild(head);

    const body = el('div', 'ytc-body');
    const saved = el('span', 'ytc-saved', '✓ Запазено');
    let savedTimer, debounce;
    const commit = () => {
      panel.classList.toggle('ytc-off', !s.enabled);
      onSave(Object.assign({}, s));
      saved.classList.add('on');
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => saved.classList.remove('on'), 1200);
    };

    for (const f of YTC.SCHEMA) {
      if (f.group) { body.appendChild(el('div', 'ytc-group', f.group)); continue; }
      if (f.type === 'text' || f.type === 'number') {
        const row = el('label', 'ytc-col');
        row.appendChild(el('span', null, f.label));
        const input = el(f.type === 'text' ? 'textarea' : 'input');
        if (f.type === 'number') { input.type = 'number'; input.min = '0'; input.step = '1'; }
        input.value = String(s[f.key]);
        input.addEventListener('input', () => {
          s[f.key] = f.type === 'number' ? Math.max(0, Number(input.value) || 0) : input.value;
          clearTimeout(debounce);
          debounce = setTimeout(commit, 400);
        });
        row.appendChild(input);
        body.appendChild(row);
      } else {
        const row = el('label', 'ytc-row');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.checked = !!s[f.key];
        cb.addEventListener('change', () => { s[f.key] = cb.checked; commit(); });
        row.appendChild(cb);
        row.appendChild(el('span', null, f.label));
        if (f.key === 'enabled') panel.insertBefore(row, null); else body.appendChild(row);
      }
    }
    panel.appendChild(body);

    const foot = el('div', 'ytc-foot');
    const reset = el('button', 'ytc-btn', 'Върни по подразбиране');
    reset.addEventListener('click', () => {
      if (!confirm('Да се върнат ли всички настройки по подразбиране?')) return;
      const d = YTC.defaults();
      onSave(d);
      YTC.buildPanel(root, d, onSave, opts);
    });
    foot.appendChild(reset);
    foot.appendChild(saved);
    panel.appendChild(foot);
    panel.classList.toggle('ytc-off', !s.enabled);

    const style = el('style', null, YTC.PANEL_CSS);
    root.appendChild(style);
    root.appendChild(panel);
  };
})();
