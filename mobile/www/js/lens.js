'use strict';
/* Lens: photos from the phone, rated, kept as favourites and developed. Opia keeps its own copy of each photo it is
   given, plus the edits as numbers; "Save copy" writes the developed photo back to the gallery. */

const Lens = {
  id: 'lens', name: 'Lens', icon: 'img/opia-icon.svg',
  photos: [], filter: 'all', urls: new Map(),

  async init(el) { this.el = el; this.photos = (await DB.all('photos')).sort((a, b) => b.added - a.added); this.render(); },
  topActions() { return this.photos.length ? [ib('plus', t('Add photos'), () => this.add())] : []; },
  url(ph) { let u = this.urls.get(ph.id + ph.v); if (!u && ph.thumb) { u = URL.createObjectURL(ph.thumb); this.urls.set(ph.id + ph.v, u); } return u; },
  shown() {
    const f = this.filter;
    return this.photos.filter(p => f === 'all' || (f === 'fav' && p.fav) || (f === 'rated' && p.rating) || (f === 'edited' && Develop.edited(p.edits)));
  },

  render() {
    App.refreshTop();
    if (!this.photos.length) {
      this.el.replaceChildren(h('div', { class: 'empty' }, h('img', { src: this.icon, alt: '' }), h('h2', {}, t('Your photos, sorted and developed')),
        h('p', {}, t('Bring in photos from your phone. Rate them, keep favourites, and develop them. The original is never changed.')),
        h('button', { class: 'btn primary', onclick: () => this.add() }, icon('plus'), t('Add photos'))));
      return;
    }
    const list = this.shown(), chip = (k, label) => h('button', { class: 'chip', 'aria-pressed': String(this.filter === k), onclick: () => { this.filter = k; this.render(); } }, label);
    this.el.replaceChildren(
      h('div', { class: 'chips', role: 'toolbar' }, chip('all', t('All')), chip('fav', t('Favourites')), chip('rated', t('Rated')), chip('edited', t('Edited'))),
      list.length ? h('div', { class: 'grid' }, list.map((ph, i) => h('button', { class: 'tile', 'aria-label': ph.name + (ph.rating ? ', ' + ph.rating + '★' : '') + (ph.fav ? ', ' + t('Favourite') : ''), onclick: () => this.view(list, i) },
        h('img', { src: this.url(ph), alt: '', loading: 'lazy', decoding: 'async' }),
        h('div', { class: 'badges' }, ph.rating ? [icon('star', true), String(ph.rating)] : null, Develop.edited(ph.edits) ? icon('sliders') : null, ph.fav ? h('span', { class: 'fav' }, icon('heart', true)) : null))))
        : h('p', { style: { color: 'var(--dim)', textAlign: 'center', marginTop: '40px' } }, t('Nothing here yet.')),
      h('p', { style: { color: 'var(--dim)', textAlign: 'center', fontSize: '14px', margin: '18px 0 70px' } }, plural(list.length, '1 photo', '{n} photos')),
      h('button', { class: 'fab', 'aria-label': t('Add photos'), onclick: () => this.add() }, icon('plus')));
  },

  async add() {
    const files = (await pickFiles('image/*', true)).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name)); if (!files.length) return;
    const done = UI.busy(t('Importing…')); let bad = 0;
    try {
      for (const f of files) {
        try {
          const bmp = await bitmapOf(f), thumb = await this.thumbOf(bmp, null), id = uid();
          await DB.putBlob(id, f);
          const ph = { id, v: 1, name: f.name, added: Date.now(), taken: f.lastModified || Date.now(), w: bmp.width, hh: bmp.height, rating: 0, fav: false, edits: null, thumb };
          bmp.close(); await DB.put('photos', ph); this.photos.unshift(ph);
        } catch (e) { console.warn(e); bad++; }
      }
    } finally { done(); }
    if (bad) UI.toast(t('Some files could not be read as pictures.'), 'error');
    this.render();
  },
  async thumbOf(src, edits) { const cv = edits ? Develop.render(src, edits, 420) : Develop.render(src, {}, 420); return canvasBlob(cv, 'image/jpeg', .82); },
  async save(ph) { ph.v = (ph.v || 1) + 1; await DB.put('photos', ph); },
  async developed(ph, maxSide) { const bmp = await bitmapOf(await DB.blob(ph.id), maxSide === Infinity ? 0 : maxSide); const cv = Develop.render(bmp, ph.edits || {}, maxSide); bmp.close(); return cv; },

  /* ---- full-screen viewer: swipe between photos, double-tap or pinch to zoom */
  view(list, index) {
    let i = index, zoom = 1, px = 0, py = 0, swipe = 0, chrome = true;
    const img = h('img', { alt: '' }), slide = h('div', { class: 'slide' }, img), strip = h('div', { class: 'strip' }, slide), viewer = h('div', { class: 'viewer' }, strip);
    const favBtn = h('button', { class: 'fav', onclick: () => this.toggleFav(list[i], favBtn) }, icon('heart', true), t('Favourite'));
    const stars = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': t('Rate') });
    const foot = h('div', {}, stars, h('div', { class: 'actbar' }, favBtn,
      h('button', { onclick: () => this.edit(list[i], () => show()) }, icon('sliders'), t('Edit')),
      h('button', { onclick: () => this.export(list[i], 'share') }, icon('share'), t('Share')),
      h('button', { onclick: () => this.export(list[i], 'save') }, icon('save'), t('Save copy')),
      h('button', { onclick: () => this.remove(list[i], () => { list.splice(i, 1); if (!list.length) return scr.close(); i = Math.min(i, list.length - 1); show(); }) }, icon('trash'), t('Delete'))));
    const scr = UI.screen({ title: '', dark: true, content: viewer, foot, onclose: () => this.render() });
    const apply = () => { img.style.transform = `translate(${px}px, ${py}px) scale(${zoom})`; strip.style.transform = `translateX(${swipe}px)`; };
    let token = 0;
    const show = async () => {
      const ph = list[i], my = ++token; zoom = 1; px = py = swipe = 0; apply();
      scr.setTitle(ph.name); favBtn.setAttribute('aria-pressed', String(!!ph.fav));
      stars.replaceChildren(...[1, 2, 3, 4, 5].map(n => h('button', { role: 'radio', 'aria-checked': String(ph.rating === n), 'data-on': String(ph.rating >= n), 'aria-label': n + ' ★', onclick: () => { ph.rating = ph.rating === n ? 0 : n; this.save(ph); show(); } }, icon('star', true))));
      img.src = this.url(ph);       // the thumbnail straight away, the real thing when it is ready
      const cv = await this.developed(ph, Math.max(1600, Math.min(2600, Math.max(innerWidth, innerHeight) * devicePixelRatio)));
      if (my !== token) return; const b = await canvasBlob(cv, 'image/jpeg', .9); if (my !== token) return;
      const old = img.dataset.full; img.src = img.dataset.full = URL.createObjectURL(b); if (old) URL.revokeObjectURL(old);
    };
    let base = null;
    gestures(viewer, {
      start: g => { base = { zoom, px, py }; strip.style.transition = img.style.transition = 'none'; },
      move: g => {
        if (g.n === 2) { zoom = clamp(base.zoom * g.scale, 1, 6); px = base.px + (g.x - g.x0); py = base.py + (g.y - g.y0); }
        else if (zoom > 1.01) { px = base.px + g.x - g.x0; py = base.py + g.y - g.y0; }
        else swipe = g.x - g.x0;
        apply();
      },
      end: (g, more) => {
        if (more) return; strip.style.transition = 'transform .22s ease-out';
        if (zoom <= 1.01 && Math.abs(swipe) > innerWidth * .22) {
          const dir = swipe < 0 ? 1 : -1;
          if (list[i + dir]) { swipe = -dir * innerWidth; apply(); setTimeout(() => { strip.style.transition = 'none'; i += dir; show(); }, 200); return; }
        }
        if (zoom <= 1.01) { zoom = 1; px = py = 0; } swipe = 0; apply();
      },
      tap: (() => { let last = 0; return g => {
        const now = Date.now();
        if (now - last < 300) { img.style.transition = 'transform .2s'; if (zoom > 1) { zoom = 1; px = py = 0; } else { zoom = 2.5; const r = viewer.getBoundingClientRect(); px = (r.width / 2 - (g.x - r.left)) * 1.5; py = (r.height / 2 - (g.y - r.top)) * 1.5; } apply(); last = 0; return; }
        last = now; setTimeout(() => { if (last === now) { chrome = !chrome; scr.el.querySelector('.bar').style.visibility = scr.el.querySelector('.foot').style.visibility = chrome ? '' : 'hidden'; } }, 310);
      }; })(),
    });
    show();
  },
  async toggleFav(ph, btn) { ph.fav = !ph.fav; btn.setAttribute('aria-pressed', String(ph.fav)); await this.save(ph); },
  async remove(ph, after) {
    if (!(await UI.confirm(t('Remove from Opia'), t('The photo stays in your gallery; only Opia\'s copy and edits go.')))) return;
    await DB.del('photos', ph.id); await DB.del('files', ph.id); this.photos = this.photos.filter(p => p !== ph); after && after();
  },
  async export(ph, how) {
    const done = UI.busy(t('Saving the full-size photo…'));
    let blob, name = safeName(ph.name.replace(/\.[^.]+$/, '')) + (Develop.edited(ph.edits) ? ' (Opia)' : '') + '.jpg';
    try {
      try { blob = await canvasBlob(await this.developed(ph, Infinity), 'image/jpeg', .94); }
      catch (e) { blob = await canvasBlob(await this.developed(ph, 6000), 'image/jpeg', .94); }     // very large photos: the biggest the phone can hold
    } catch (e) { done(); UI.toast(t('Could not save the file.'), 'error'); return; }
    done(); how === 'share' ? Native.share(blob, name, 'image/jpeg') : Native.save(blob, name, 'image/jpeg', 'pictures');
  },

  /* ---- the editor: Adjust, Filters and Crop over a preview */
  async edit(ph, after) {
    const done = UI.busy(); let base;
    try { base = await bitmapOf(await DB.blob(ph.id), Math.min(1800, Math.round(Math.max(innerWidth, innerHeight) * Math.min(2, devicePixelRatio)))); }
    catch (e) { done(); UI.toast(t('Some files could not be read as pictures.'), 'error'); return; }
    done();
    const start = JSON.stringify(ph.edits || Develop.blank()), p = JSON.parse(start), hist = [start], fut = [];
    const view = h('canvas', { 'aria-label': ph.name }), stage = h('div', { class: 'stage' }, view), tag = h('div', { class: 'compare-tag', hidden: true }, t('Original'));
    const content = h('div', { style: { position: 'absolute', inset: 0 } }, stage, tag), panel = h('div', {}), tabs = h('div', { class: 'tabrow', role: 'tablist' });
    let tab = 'adjust', sel = 'exp', comparing = false, pending = 0, cropUI = null;
    const draw = (fast) => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        if (tab === 'crop') return cropUI && cropUI.redraw();
        const cv = Develop.render(base, comparing ? {} : p, fast ? 900 : 1800); view.width = cv.width; view.height = cv.height; view.getContext('2d').drawImage(cv, 0, 0);
      });
    };
    const commit = () => { const s = JSON.stringify(p); if (s !== hist[hist.length - 1]) { hist.push(s); fut.length = 0; } refreshUndo(); };
    const restore = s => { Object.keys(p).forEach(k => delete p[k]); Object.assign(p, JSON.parse(s)); setTab(tab); draw(); };
    const undoB = ib('undo', t('Undo'), () => { if (hist.length > 1) { fut.push(hist.pop()); restore(hist[hist.length - 1]); refreshUndo(); } });
    const redoB = ib('redo', t('Redo'), () => { if (fut.length) { hist.push(fut.pop()); restore(hist[hist.length - 1]); refreshUndo(); } });
    const refreshUndo = () => { undoB.disabled = hist.length < 2; redoB.disabled = !fut.length; };
    const doneB = h('button', { class: 'btn primary', style: { minHeight: '40px', marginRight: '6px' }, onclick: async () => {
      const b = UI.busy(); try { ph.edits = Develop.edited(p) ? p : null; ph.thumb = await this.thumbOf(base, ph.edits); await this.save(ph); } finally { b(); }
      saved = true; scr.close(); UI.toast(t('Edits kept')); after && after();
    } }, t('Done'));
    let saved = false;
    const scr = UI.screen({ title: t('Edit'), dark: true, content, foot: h('div', {}, panel, tabs), actions: [undoB, redoB, ib('more', t('More'), () => UI.menu(t('More'), [{ label: t('Reset all edits'), icon: 'undo', danger: true, run: () => { restore(JSON.stringify(Develop.blank())); commit(); } }])), doneB],
      onclose: async () => saved || JSON.stringify(p) === start || await UI.confirm(t('Cancel'), t('This cannot be undone.'), t('OK')) });
    // hold the photo to see the original
    stage.addEventListener('pointerdown', () => { if (tab === 'crop') return; comparing = true; tag.hidden = false; draw(); });
    const release = () => { if (!comparing) return; comparing = false; tag.hidden = true; draw(); };
    stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release); stage.addEventListener('pointerleave', release);

    const adjust = () => {
      const def = DEV_ADJ.find(a => a[0] === sel), val = h('div', { class: 'adj-val' }), fmt = v => (def[0] === 'exp' ? (v > 0 ? '+' : '') + v.toFixed(2) : (v > 0 ? '+' : '') + Math.round(v));
      const show = () => { val.replaceChildren(h('small', {}, t(def[1])), fmt(p[sel] || 0)); };
      const r = UI.range({ min: def[2], max: def[3], step: def[0] === 'exp' ? .01 : 1, value: p[sel] || 0, def: 0, label: t(def[1]), oninput: v => { p[sel] = v; show(); draw(true); chips.querySelector(`[data-k=${sel}]`).classList.toggle('changed', !!v); }, onchange: () => { draw(); commit(); } });
      const chips = h('div', { class: 'toolchips', role: 'toolbar' }, DEV_ADJ.map(([k, label]) => h('button', { 'data-k': k, class: p[k] ? 'changed' : '', 'aria-pressed': String(k === sel), onclick: () => { sel = k; setTab('adjust'); } }, icon(DEV_ICON[k]), t(label))));
      show(); panel.replaceChildren(val, h('div', { style: { padding: '0 22px' } }, r), chips);
      requestAnimationFrame(() => { const on = chips.querySelector('[aria-pressed=true]'); on && on.scrollIntoView({ inline: 'center', block: 'nearest' }); });
    };
    const filters = () => {
      const small = Develop.render(base, { ...p, ...Object.fromEntries(DEV_ADJ.map(([k]) => [k, 0])) }, 200);
      const row = h('div', { class: 'filters', role: 'radiogroup' }, Object.entries(DEV_FILTERS).map(([k, f]) => {
        const c = Develop.render(small, f, 200); c.setAttribute('aria-hidden', 'true');
        return h('button', { role: 'radio', 'aria-checked': String(p.filter === k), 'aria-pressed': String(p.filter === k), onclick: () => { for (const [a] of DEV_ADJ) delete p[a]; Object.assign(p, f, { filter: k }); filters(); draw(); commit(); } }, c, t(DEV_FILTER_NAMES[k]));
      }));
      panel.replaceChildren(row);
    };
    const crop = () => {
      const turned = () => (p.rot || 0) % 180 !== 0, ow = () => (turned() ? base.height : base.width), oh = () => (turned() ? base.width : base.height);
      const ratios = [['free', t('Free')], ['orig', t('Original')], [1, t('Square')], [4 / 5, '4:5'], [5 / 4, '5:4'], [3 / 2, '3:2'], [2 / 3, '2:3'], [16 / 9, '16:9'], [9 / 16, '9:16']];
      let ratio = 'free';
      const ang = UI.range({ min: -45, max: 45, step: .1, value: p.ang || 0, def: 0, label: t('Straighten'), oninput: v => { p.ang = v; angVal.textContent = v.toFixed(1) + '°'; place(); }, onchange: commit });
      const angVal = h('div', { class: 'adj-val' }, (p.ang || 0).toFixed(1) + '°');
      const rchips = h('div', { class: 'chips', style: { padding: '4px 12px 8px' } }, ratios.map(([k, label]) => h('button', { class: 'chip', 'aria-pressed': String(k === ratio), onclick: () => { ratio = k; rchips.querySelectorAll('.chip').forEach((c, j) => c.setAttribute('aria-pressed', String(ratios[j][0] === k))); fitRatio(); place(); commit(); } }, label)));
      panel.replaceChildren(angVal, h('div', { style: { padding: '0 22px', display: 'flex', alignItems: 'center', gap: '6px' } },
        ib('rotate', t('Rotate'), () => { const c = p.crop; p.rot = ((p.rot || 0) + (p.flip ? 270 : 90)) % 360; if (c) p.crop = { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }; redraw(); commit(); }),
        ib('flip', t('Flip'), () => { p.flip = !p.flip; if (p.crop) p.crop.x = 1 - (p.crop.x + p.crop.w); redraw(); commit(); }), ang,
        ib('undo', t('Reset'), () => { p.crop = null; p.ang = 0; ang.set(0); angVal.textContent = '0.0°'; ratio = 'free'; redraw(); commit(); })), rchips);
      const box = h('div', { class: 'crop-box' }, h('i', { class: 'nw' }), h('i', { class: 'ne' }), h('i', { class: 'sw' }), h('i', { class: 'se' }));
      stage.append(box);
      const rect = () => { const r = view.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, w: r.width, h: r.height }; };
      const c = () => p.crop || { x: 0, y: 0, w: 1, h: 1 };
      const place = () => {
        const r = rect(), k = c(); Object.assign(box.style, { left: r.l + k.x * r.w + 'px', top: r.t + k.y * r.h + 'px', width: k.w * r.w + 'px', height: k.h * r.h + 'px' });
        const a = (p.ang || 0) * Math.PI / 180, cw = k.w * ow(), ch = k.h * oh(), cover = a ? Math.cos(Math.abs(a)) + Math.sin(Math.abs(a)) * Math.max(cw / ch, ch / cw) : 1;
        view.style.transformOrigin = `${(k.x + k.w / 2) * 100}% ${(k.y + k.h / 2) * 100}%`; view.style.transform = a ? `rotate(${p.ang}deg) scale(${cover})` : '';
      };
      const fitRatio = () => {
        if (ratio === 'free') return; const want = ratio === 'orig' ? ow() / oh() : ratio, k = c(), W = ow(), H = oh();
        let w = k.w * W, hh = w / want; if (hh > k.h * H) { hh = k.h * H; w = hh * want; }
        p.crop = { x: k.x + (k.w - w / W) / 2, y: k.y + (k.h - hh / H) / 2, w: w / W, h: hh / H };
      };
      const redraw = () => { const cv = Develop.oriented(base, p, 1800); view.width = cv.width; view.height = cv.height; view.getContext('2d').drawImage(cv, 0, 0); requestAnimationFrame(place); };
      let mode = null, k0 = null;
      gestures(box, {
        start: g => { const b = box.getBoundingClientRect(), e = 40; const L = g.x0 - b.left < e, R = b.right - g.x0 < e, T = g.y0 - b.top < e, B = b.bottom - g.y0 < e; mode = (T ? 'n' : B ? 's' : '') + (L ? 'w' : R ? 'e' : ''); if (mode.length < 2) mode = 'move'; k0 = { ...c() }; },
        move: g => {
          const r = rect(), dx = (g.x - g.x0) / r.w, dy = (g.y - g.y0) / r.h, min = .08; let { x, y, w, h: hh } = k0;
          if (mode === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - hh); }
          else {
            if (mode.includes('w')) { const nx = clamp(x + dx, 0, x + w - min); w += x - nx; x = nx; } if (mode.includes('e')) w = clamp(w + dx, min, 1 - x);
            if (mode.includes('n')) { const ny = clamp(y + dy, 0, y + hh - min); hh += y - ny; y = ny; } if (mode.includes('s')) hh = clamp(hh + dy, min, 1 - y);
            if (ratio !== 'free') {     // keep the shape: follow the width, then pull back if the height runs out
              const want = (ratio === 'orig' ? ow() / oh() : ratio) * oh() / ow(); let nh = w / want;
              if (mode.includes('n')) { y = y + hh - nh; } hh = nh;
              if (y < 0 || y + hh > 1) { const lim = y < 0 ? hh + y : 1 - y; hh = lim; const nw = hh * want; if (mode.includes('w')) x += w - nw; w = nw; if (y < 0) y = 0; }
            }
          }
          p.crop = { x, y, w, h: hh }; place();
        },
        end: (g, more) => { if (!more) commit(); },
      });
      cropUI = { redraw, place, box }; redraw();
    };
    const setTab = k => {
      if (tab === 'crop' && k !== 'crop' && cropUI) { cropUI.box.remove(); cropUI = null; view.style.transform = ''; }
      tab = k; tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k)));
      ({ adjust, filters, crop })[k](); draw();
    };
    tabs.append(...[['adjust', t('Adjust')], ['filters', t('Filters')], ['crop', t('Crop')]].map(([k, label]) => h('button', { role: 'tab', 'data-k': k, onclick: () => setTab(k) }, label)));
    refreshUndo(); setTab('adjust');
    addEventListener('resize', () => cropUI && cropUI.place());
    void scr;
  },
};
