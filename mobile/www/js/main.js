'use strict';
/* The frame: four workspaces behind a tab bar, a settings sheet, and the language and theme. */

const App = {
  spaces: [Lens, Imagine, Folio, Groove],
  cur: null,
  async start() {
    I18N.lang = Prefs.get('lang', (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'); document.documentElement.lang = I18N.lang;
    Nav.init();
    const views = $('#views');
    for (const ws of this.spaces) { ws.el = h('section', { class: 'ws', id: 'ws-' + ws.id, role: 'tabpanel', 'aria-label': ws.name }); views.append(ws.el); }
    this.tabs();
    await Promise.all(this.spaces.map(ws => ws.init(ws.el).catch(e => console.error(ws.id, e))));
    this.show(Prefs.get('ws', 'lens'));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});     // keep the library when the phone is short of space
    this.bars(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.bars());
  },
  /* the phone's status and navigation bars take the page's colour, with icons that stay readable */
  bars() {
    if (!window.OpiaAndroid || !OpiaAndroid.setBars) return;
    const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    OpiaAndroid.setBars('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), (r * 299 + g * 587 + b * 114) / 1000 > 140);
  },
  tabs() {
    $('#tabs').replaceChildren(h('div', { class: 'tablist', role: 'tablist' }, ...this.spaces.map(ws => h('button', { role: 'tab', 'aria-selected': String(this.cur === ws), 'aria-controls': 'ws-' + ws.id, onclick: () => this.show(ws.id) }, h('img', { src: ws.icon, alt: '' }), h('span', {}, t(ws.name))))));
  },
  show(id) {
    const ws = this.spaces.find(w => w.id === id) || this.spaces[0];
    if (this.cur && this.cur !== ws && this.cur.leave) this.cur.leave();
    this.cur = ws; Prefs.set('ws', ws.id); document.body.dataset.ws = ws.id;
    for (const w of this.spaces) w.el.classList.toggle('on', w === ws);
    this.tabs(); this.refreshTop();
  },
  refreshTop() {
    const ws = this.cur; if (!ws) return;
    $('#title').replaceChildren(h('img', { src: ws.icon, alt: '', class: 'logo' }), h('span', {}, t(ws.name)));
    $('#topActions').replaceChildren(...(ws.topActions ? ws.topActions() : []), ib('settings', t('Settings'), () => this.settings()));
  },
  /* language or theme changed: draw everything again */
  redraw() { document.documentElement.lang = I18N.lang; this.tabs(); for (const ws of this.spaces) ws.render && ws.render(); this.refreshTop(); },

  async settings() {
    const pick = (cur, opts, set) => h('div', { class: 'chips', role: 'radiogroup' }, opts.map(([k, label]) => h('button', { class: 'chip', role: 'radio', 'aria-checked': String(cur === k), 'aria-pressed': String(cur === k), onclick: () => { set(k); s.close(); this.settings(); } }, label)));
    let used = '';
    try { const e = await navigator.storage.estimate(); used = (e.usage / 1048576).toFixed(e.usage > 1e8 ? 0 : 1) + ' MB'; } catch (e) { /* not available */ }
    const theme = Prefs.get('theme', 'auto');
    const s = UI.sheet({ title: t('Settings'), body: h('div', {},
      h('div', { class: 'sec' }, t('Language')), pick(I18N.lang, [['en', 'English'], ['es', 'Español']], k => { I18N.lang = k; Prefs.set('lang', k); this.redraw(); }),
      h('div', { class: 'sec' }, t('Theme')), pick(theme, [['auto', t('Like the phone')], ['dark', t('Dark')], ['light', t('Light')]], k => {
        Prefs.set('theme', k); try { k === 'auto' ? localStorage.removeItem('opia-theme') : localStorage.setItem('opia-theme', k); } catch (e) { /* blocked */ }
        if (k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k;
        this.bars();
      }),
      h('div', { class: 'sec' }, t('Storage used')), h('p', { style: { margin: '0 0 6px', color: 'var(--hi)', fontWeight: 800 } }, used || '—'), h('p', { style: { margin: 0, color: 'var(--dim)' } }, t('Everything stays on this phone.')),
      h('div', { class: 'sec' }, t('About Opia')),
      h('p', { style: { margin: '0 0 8px', color: 'var(--dim)', fontSize: '14.5px' } }, 'Opia for Android ' + (window.OpiaAndroid && OpiaAndroid.version ? OpiaAndroid.version() : '(web)') + '. ',
        'PDF viewing: pdf.js (Apache 2.0). PDF editing: pdf-lib (MIT). Instrument samples: Fluid R3 GM SoundFont by Frank Wen, CC BY 3.0. Typefaces: Nunito and Caveat, SIL Open Font License.'),
      h('a', { href: 'https://kanisakhpara-devs.github.io/Opia/', style: { color: 'var(--acc-text)', fontWeight: 800 } }, 'kanisakhpara-devs.github.io/Opia'))
    });
  },
};
document.addEventListener('DOMContentLoaded', () => App.start());
