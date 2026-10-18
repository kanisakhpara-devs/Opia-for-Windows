'use strict';
/* Imagine: a picture made of layers. Photos, text, stickers and drawings, each moved with a finger and pinched
   to resize and turn. Pictures save themselves as you go; Export writes a PNG or JPEG to the gallery. */

const FONTS = [['Nunito', 800, 'Nunito'], ['Nunito', 1000, 'Nunito Black'], ['Caveat', 700, 'Caveat'], ['Georgia, serif', 700, 'Serif'], ['ui-monospace, monospace', 700, 'Mono']];
const COLOURS = ['#ffffff', '#1b1a17', '#e2b93b', '#ff5a3c', '#ff6b8b', '#c39bff', '#7d92ff', '#6fd0ff', '#6fcf97', '#f4f1ea', '#8a6a12', '#3d5afe'];
const STICKERS = ['😀', '😂', '🥰', '😎', '🤩', '🥳', '😮', '😢', '😡', '👍', '👏', '🙌', '❤️', '🔥', '✨', '⭐', '🌈', '☀️', '🌙', '⚡', '🎉', '🎵', '📸', '🎬', '🌸', '🌻', '🍀', '🌊', '🏔️', '🌋', '✈️', '🚗', '🍕', '☕', '🎂', '🐶', '🐱', '🦊', '🐼', '🦋', '💯', '✅', '❗', '❓', '➡️', '⬅️', '📍', '💬'];

const Imagine = {
  id: 'imagine', name: 'Imagine', icon: 'img/opia-image-icon.svg',
  pics: [], bmps: new Map(), urls: new Map(),

  async init(el) { this.el = el; this.pics = (await DB.all('pictures')).sort((a, b) => b.updated - a.updated); this.render(); },
  topActions() { return this.pics.length ? [ib('plus', t('New picture'), () => this.create())] : []; },
  render() {
    App.refreshTop();
    if (!this.pics.length) {
      this.el.replaceChildren(h('div', { class: 'empty' }, h('img', { src: this.icon, alt: '' }), h('h2', {}, t('Layers, text and stickers')),
        h('p', {}, t('Start from a photo or a blank page, then add text, stickers and drawings on top.')),
        h('button', { class: 'btn primary', onclick: () => this.create() }, icon('plus'), t('New picture'))));
      return;
    }
    this.el.replaceChildren(h('div', { class: 'cards', style: { paddingTop: '8px', paddingBottom: '90px' } }, this.pics.map(pic => {
      let u = this.urls.get(pic.id + pic.updated); if (!u && pic.thumb) { u = URL.createObjectURL(pic.thumb); this.urls.set(pic.id + pic.updated, u); }
      return h('button', { class: 'card', onclick: () => this.open(pic), oncontextmenu: e => { e.preventDefault(); this.more(pic); } },
        h('div', { class: 'pic', style: { backgroundImage: u ? `url(${u})` : '' } }), h('div', {}, h('b', {}, pic.name), h('small', {}, `${pic.w} × ${pic.h} · ${fmtDate(pic.updated)}`)));
    })), h('button', { class: 'fab', 'aria-label': t('New picture'), onclick: () => this.create() }, icon('plus')));
  },
  more(pic) {
    UI.menu(pic.name, [{ label: t('Rename'), icon: 'edit', run: async () => { const n = await UI.ask(t('Rename'), pic.name); if (n) { pic.name = n.trim() || pic.name; await DB.put('pictures', pic); this.render(); } } },
      { label: t('Delete'), icon: 'trash', danger: true, run: async () => { if (await UI.confirm(t('Delete for good?'), t('This cannot be undone.'))) { await this.remove(pic); this.render(); } } }]);
  },
  async remove(pic) { for (const l of pic.layers) if (l.file && !this.pics.some(p => p !== pic && p.layers.some(m => m.file === l.file))) await DB.del('files', l.file); await DB.del('pictures', pic.id); this.pics = this.pics.filter(p => p !== pic); },

  /* ---- a new picture: a page size, or a photo's own size */
  create() {
    const sizes = [[1080, 1080, 'Square'], [1080, 1350, 'Post'], [1080, 1920, 'Story'], [1920, 1080, 'Wide']];
    const s = UI.sheet({ title: t('New picture'), body: h('div', {},
      h('div', { class: 'sizes' }, sizes.map(([w, hh, label]) => h('button', { onclick: () => { s.close(); this.make(w, hh); } }, h('i', { style: { width: w / hh * 34 + 'px', height: '34px' } }), t(label), h('small', {}, `${w} × ${hh}`)))),
      h('div', { class: 'sec' }, t('From a photo')),
      h('div', { style: { display: 'flex', gap: '10px' } }, h('button', { class: 'btn', style: { flex: 1 }, onclick: async () => { s.close(); const b = await this.photoFromPhone(); if (b) this.make(0, 0, b); } }, icon('image'), t('From the phone')),
        Lens.photos.length ? h('button', { class: 'btn', style: { flex: 1 }, onclick: async () => { s.close(); const b = await this.photoFromLens(); if (b) this.make(0, 0, b); } }, h('img', { src: Lens.icon, alt: '', style: { width: '22px', borderRadius: '6px' } }), t('From Lens')) : null)) });
  },
  async photoFromPhone() { const [f] = await pickFiles('image/*'); return f || null; },
  photoFromLens() {
    return new Promise(res => {
      let out = null;
      const s = UI.sheet({ title: t('From Lens'), wide: true, onclose: () => res(out), body: h('div', { class: 'grid', style: { margin: 0 } }, Lens.photos.map(ph => h('button', { class: 'tile', 'aria-label': ph.name, onclick: async () => {
        const done = UI.busy(); try { out = await canvasBlob(await Lens.developed(ph, 2400), 'image/jpeg', .92); } finally { done(); } s.close();
      } }, h('img', { src: Lens.url(ph), alt: '' })))) });
    });
  },
  async make(w, hh, photo) {
    const pic = { id: uid(), name: t('Untitled'), w, h: hh, bg: '#ffffff', layers: [], updated: Date.now(), thumb: null };
    if (photo) {
      const bmp = await bitmapOf(photo, 2400); pic.w = bmp.width; pic.h = bmp.height; pic.bg = null; bmp.close();
      await this.addImage(pic, photo, true);
    }
    this.pics.unshift(pic); await this.store(pic); this.render(); this.open(pic);
  },
  async addImage(pic, blob, fill) {
    const file = 'img-' + uid(); await DB.putBlob(file, blob); const bmp = await bitmapOf(blob, 2400); this.bmps.set(file, bmp);
    const scale = fill ? Math.max(pic.w / bmp.width, pic.h / bmp.height) : Math.min(pic.w / bmp.width, pic.h / bmp.height) * .8;
    const l = { id: uid(), type: 'image', file, iw: bmp.width, ih: bmp.height, x: pic.w / 2, y: pic.h / 2, scale, rot: 0, opacity: 1 };
    pic.layers.push(l); return l;
  },
  async bitmap(file) { if (!this.bmps.has(file)) { const b = await DB.blob(file); this.bmps.set(file, b ? await bitmapOf(b, 2400) : null); } return this.bmps.get(file); },
  async store(pic) { pic.updated = Date.now(); await DB.put('pictures', pic); },

  /* ---- drawing a picture */
  bounds(l, x) {
    if (l.type === 'image') return [-l.iw / 2, -l.ih / 2, l.iw, l.ih];
    if (l.type === 'draw') {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const s of l.strokes) for (const [px, py] of s.pts) { a = Math.min(a, px - s.size / 2); b = Math.min(b, py - s.size / 2); c = Math.max(c, px + s.size / 2); d = Math.max(d, py + s.size / 2); }
      return a === Infinity ? [-50, -50, 100, 100] : [a, b, c - a, d - b];
    }
    x.font = this.font(l); const lines = (l.text || ' ').split('\n'), lh = l.size * 1.18, w = Math.max(...lines.map(s => x.measureText(s).width)), pad = l.bg ? l.size * .45 : l.size * .1;
    return [-w / 2 - pad, -lines.length * lh / 2 - pad * .6, w + pad * 2, lines.length * lh + pad * 1.2];
  },
  font(l) { const f = FONTS[l.font || 0] || FONTS[0]; return `${f[1]} ${l.size}px ${f[0]}`; },
  paint(x, pic, sel, drawCache) {
    x.save(); x.clearRect(0, 0, pic.w, pic.h); if (pic.bg) { x.fillStyle = pic.bg; x.fillRect(0, 0, pic.w, pic.h); }
    for (const l of pic.layers) {
      if (l.hidden) continue;
      x.save(); x.globalAlpha = l.opacity ?? 1; x.translate(l.x, l.y); x.rotate(l.rot || 0); x.scale(l.scale || 1, l.scale || 1);
      if (l.type === 'image') { const b = this.bmps.get(l.file); if (b) x.drawImage(b, -l.iw / 2, -l.ih / 2, l.iw, l.ih); }
      else if (l.type === 'draw') { const c = drawCache(l); x.drawImage(c.cv, c.ox, c.oy); }
      else {
        const [bx, by, bw, bh] = this.bounds(l, x);
        if (l.bg) { x.fillStyle = l.bg; x.beginPath(); x.roundRect(bx, by, bw, bh, l.size * .35); x.fill(); }
        x.font = this.font(l); x.fillStyle = l.color || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
        if (l.type === 'text' && !l.bg && l.shadow !== false) { x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = l.size * .12; x.shadowOffsetY = l.size * .04; }
        const lines = (l.text || '').split('\n'), lh = l.size * 1.18; lines.forEach((s, i) => x.fillText(s, 0, (i - (lines.length - 1) / 2) * lh));
      }
      x.restore();
    }
    if (sel) {
      const l = sel; x.save(); x.translate(l.x, l.y); x.rotate(l.rot || 0); const s = l.scale || 1, [bx, by, bw, bh] = this.bounds(l, x), lw = Math.max(pic.w, pic.h) / 400;
      x.strokeStyle = '#fff'; x.lineWidth = lw * 2.5; x.setLineDash([lw * 8, lw * 6]); x.strokeRect(bx * s, by * s, bw * s, bh * s);
      x.strokeStyle = '#3d5afe'; x.lineDashOffset = lw * 7; x.strokeRect(bx * s, by * s, bw * s, bh * s); x.restore();
    }
    x.restore();
  },
  /* a drawing layer's strokes on their own canvas, so the eraser only rubs out that drawing */
  drawCanvas(l, cache) {
    let c = cache.get(l.id); if (c && c.ver === l.ver) return c;
    const [bx, by, bw, bh] = this.bounds(l), cv = canvas(bw + 4, bh + 4), x = cv.getContext('2d');
    x.translate(-bx + 2, -by + 2); x.lineCap = x.lineJoin = 'round';
    for (const s of l.strokes) {
      x.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'; x.strokeStyle = s.color; x.fillStyle = s.color; x.lineWidth = s.size;
      if (s.pts.length === 1) { x.beginPath(); x.arc(s.pts[0][0], s.pts[0][1], s.size / 2, 0, 7); x.fill(); continue; }
      x.beginPath(); x.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length - 1; i++) { const [ax, ay] = s.pts[i], [bx2, by2] = s.pts[i + 1]; x.quadraticCurveTo(ax, ay, (ax + bx2) / 2, (ay + by2) / 2); }
      const last = s.pts[s.pts.length - 1]; x.lineTo(last[0], last[1]); x.stroke();
    }
    c = { cv, ox: bx - 2, oy: by - 2, ver: l.ver }; cache.set(l.id, c); return c;
  },
  async render2(pic, type = 'image/png') {
    for (const l of pic.layers) if (l.file) await this.bitmap(l.file);
    const cv = canvas(pic.w, pic.h), x = cv.getContext('2d'), cache = new Map();
    if (type === 'image/jpeg' && !pic.bg) { x.fillStyle = '#fff'; x.fillRect(0, 0, pic.w, pic.h); }
    const keep = pic.bg; this.paint(x, pic, null, l => this.drawCanvas(l, cache));
    if (type === 'image/jpeg' && !keep) { const c2 = canvas(pic.w, pic.h), x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, pic.w, pic.h); x2.drawImage(cv, 0, 0); return c2; }
    return cv;
  },

  /* ---- the editor */
  async open(pic) {
    const done = UI.busy(); try { for (const l of pic.layers) if (l.file) await this.bitmap(l.file); } finally { done(); }
    const view = h('canvas', { width: pic.w, height: pic.h, role: 'img', 'aria-label': pic.name }), art = h('div', { class: 'art' }, view), x = view.getContext('2d');
    const ctxBar = h('div', { class: 'ctx', role: 'toolbar' }), cache = new Map();
    let sel = null, mode = 'move', brush = { color: '#ff5a3c', size: 18, erase: false }, raf = 0, fit = 1, saveT = 0;
    const hist = [JSON.stringify(pic.layers)], fut = [];
    const paint = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.paint(x, pic, mode === 'move' ? sel : null, l => this.drawCanvas(l, cache))); };
    const layout = () => { const r = art.getBoundingClientRect(); fit = Math.min((r.width - 24) / pic.w, (r.height - 24) / pic.h); view.style.width = pic.w * fit + 'px'; view.style.height = pic.h * fit + 'px'; };
    const save = () => { clearTimeout(saveT); saveT = setTimeout(async () => { const cv = await this.render2(pic, 'image/jpeg'), small = canvas(cv.width * 360 / Math.max(cv.width, cv.height), cv.height * 360 / Math.max(cv.width, cv.height)); small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height); pic.thumb = await canvasBlob(small, 'image/jpeg', .8); await this.store(pic); }, 700); };
    const commit = () => { const s = JSON.stringify(pic.layers); if (s !== hist[hist.length - 1]) { hist.push(s); fut.length = 0; } undoB.disabled = hist.length < 2; redoB.disabled = !fut.length; save(); };
    const restore = s => { pic.layers = JSON.parse(s); sel = sel && pic.layers.find(l => l.id === sel.id) || null; cache.clear(); bar(); paint(); save(); undoB.disabled = hist.length < 2; redoB.disabled = !fut.length; };
    const undoB = ib('undo', t('Undo'), () => { if (hist.length > 1) { fut.push(hist.pop()); restore(hist[hist.length - 1]); } }, { disabled: true });
    const redoB = ib('redo', t('Redo'), () => { if (fut.length) { hist.push(fut.pop()); restore(hist[hist.length - 1]); } }, { disabled: true });
    const exportB = ib('save', t('Export'), () => UI.menu(t('Export'), [
      { label: t('Save as PNG'), icon: 'save', run: () => this.export(pic, 'image/png', 'save') }, { label: t('Save as JPEG'), icon: 'save', run: () => this.export(pic, 'image/jpeg', 'save') },
      { label: t('Share'), icon: 'share', run: () => this.export(pic, 'image/jpeg', 'share') },
      { label: t('Rename'), icon: 'edit', run: async () => { const n = await UI.ask(t('Rename'), pic.name); if (n && n.trim()) { pic.name = n.trim(); scr.setTitle(pic.name); save(); } } },
      { label: t('Background'), icon: 'image', run: () => this.colour(pic.bg || '#ffffff', c => { pic.bg = c; paint(); commit(); }, true) }]));
    const tools = h('div', { class: 'actbar' },
      h('button', { onclick: () => this.addPhotoTo(pic, l => { select(l); commit(); }) }, icon('image'), t('Photo')),
      h('button', { onclick: async () => { const s = await UI.ask(t('Text'), '', { multi: true, placeholder: t('Type something') }); if (!s || !s.trim()) return; const l = { id: uid(), type: 'text', text: s, font: 0, size: Math.round(Math.min(pic.w, pic.h) / 9), color: '#ffffff', x: pic.w / 2, y: pic.h / 2, scale: 1, rot: 0, opacity: 1 }; pic.layers.push(l); select(l); commit(); } }, icon('text'), t('Text')),
      h('button', { onclick: () => this.sticker(ch => { const l = { id: uid(), type: 'sticker', text: ch, font: 0, size: Math.round(Math.min(pic.w, pic.h) / 4), color: '#000', x: pic.w / 2, y: pic.h / 2, scale: 1, rot: 0, opacity: 1 }; pic.layers.push(l); select(l); commit(); }) }, icon('sticker'), t('Sticker')),
      h('button', { onclick: () => setMode(mode === 'draw' ? 'move' : 'draw'), 'aria-pressed': 'false', 'data-k': 'draw' }, icon('brush'), t('Draw')),
      h('button', { onclick: () => this.layers(pic, sel, l => { select(l); }, () => { cache.clear(); paint(); commit(); bar(); }) }, icon('layers'), t('Layers')));
    const scr = UI.screen({ title: pic.name, content: art, foot: h('div', {}, ctxBar, tools), actions: [undoB, redoB, exportB], onclose: async () => { clearTimeout(saveT); const cv = await this.render2(pic, 'image/jpeg'), small = canvas(cv.width * 360 / Math.max(cv.width, cv.height), cv.height * 360 / Math.max(cv.width, cv.height)); small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height); pic.thumb = await canvasBlob(small, 'image/jpeg', .8); await this.store(pic); this.pics.sort((a, b) => b.updated - a.updated); this.render(); } });
    const select = l => { sel = l; bar(); paint(); };
    const setMode = m => { mode = m; tools.querySelector('[data-k=draw]').setAttribute('aria-pressed', String(m === 'draw')); bar(); paint(); };
    const chip = (label, run, ic) => h('button', { class: 'chip', onclick: run }, ic ? icon(ic) : null, label);
    const bar = () => {
      if (mode === 'draw') {
        const sw = h('div', { class: 'swatches', style: { flexWrap: 'nowrap' } }, COLOURS.slice(0, 8).map(c => h('button', { class: 'swatch', style: { background: c, width: '34px', height: '34px' }, 'aria-label': c, 'aria-pressed': String(!brush.erase && brush.color === c), onclick: () => { brush.color = c; brush.erase = false; bar(); } })));
        ctxBar.replaceChildren(h('button', { class: 'chip', 'aria-pressed': String(brush.erase), onclick: () => { brush.erase = !brush.erase; bar(); } }, icon('erase'), t('Eraser')), sw,
          h('div', { style: { minWidth: '120px', flex: 1 } }, UI.range({ min: 2, max: 80, value: brush.size, label: t('Size'), oninput: v => { brush.size = v; } })), chip(t('Done'), () => setMode('move'), 'check'));
        return;
      }
      if (!sel) { ctxBar.replaceChildren(h('span', { class: 'hint' }, t('Tap a layer to pick it. Drag to move, pinch to resize and turn.'))); return; }
      const l = sel, items = [];
      if (l.type === 'text') items.push(chip(t('Edit'), async () => { const s = await UI.ask(t('Text'), l.text, { multi: true }); if (s != null && s.trim()) { l.text = s; paint(); commit(); } }, 'edit'),
        chip(t('Font'), () => UI.menu(t('Font'), FONTS.map((f, i) => ({ label: f[2], run: () => { l.font = i; paint(); commit(); } }))), 'text'),
        chip(t('Colour'), () => this.colour(l.color, c => { l.color = c; paint(); commit(); })),
        chip(t('Label'), () => this.colour(l.bg || '#1b1a17', c => { l.bg = c; paint(); commit(); }, true, () => { delete l.bg; paint(); commit(); })));
      items.push(chip(t('Opacity'), () => { const s = UI.sheet({ title: t('Opacity'), body: UI.range({ min: 5, max: 100, value: Math.round((l.opacity ?? 1) * 100), label: t('Opacity'), oninput: v => { l.opacity = v / 100; paint(); }, onchange: () => commit() }) }); void s; }),
        chip(t('Forward'), () => { const i = pic.layers.indexOf(l); if (i < pic.layers.length - 1) { pic.layers.splice(i, 1); pic.layers.splice(i + 1, 0, l); paint(); commit(); } }, 'up'),
        chip(t('Backward'), () => { const i = pic.layers.indexOf(l); if (i > 0) { pic.layers.splice(i, 1); pic.layers.splice(i - 1, 0, l); paint(); commit(); } }, 'down'),
        chip(t('Duplicate'), () => { const c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.x += pic.w * .04; c.y += pic.h * .04; pic.layers.push(c); select(c); commit(); }, 'copy'),
        chip(t('Delete'), () => { pic.layers = pic.layers.filter(m => m !== l); select(null); commit(); }, 'trash'));
      ctxBar.replaceChildren(...items);
    };
    /* finger on the picture: pick and move, or draw */
    const toDoc = (cx, cy) => { const r = view.getBoundingClientRect(); return [(cx - r.left) / fit, (cy - r.top) / fit]; };
    const hit = (px, py) => {
      for (let i = pic.layers.length - 1; i >= 0; i--) {
        const l = pic.layers[i]; if (l.hidden) continue; const s = l.scale || 1, a = -(l.rot || 0), dx = px - l.x, dy = py - l.y;
        const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / s, ly = (dx * Math.sin(a) + dy * Math.cos(a)) / s, [bx, by, bw, bh] = this.bounds(l, x), pad = 24 / fit / s;
        if (lx >= bx - pad && lx <= bx + bw + pad && ly >= by - pad && ly <= by + bh + pad) return l;
      }
      return null;
    };
    let base = null, stroke = null, layer = null;
    gestures(art, {
      start: g => {
        if (mode === 'draw') {
          if (g.n !== 1) { stroke = null; return; }
          layer = sel && sel.type === 'draw' ? sel : pic.layers.slice().reverse().find(l => l.type === 'draw' && !l.hidden);
          if (!layer) { layer = { id: uid(), type: 'draw', strokes: [], ver: 0, x: pic.w / 2, y: pic.h / 2, scale: 1, rot: 0, opacity: 1 }; pic.layers.push(layer); }
          sel = layer; const [px, py] = this.local(layer, ...toDoc(g.x, g.y));
          stroke = { color: brush.color, size: brush.size / fit / (layer.scale || 1), erase: brush.erase, pts: [[px, py]] }; layer.strokes.push(stroke); layer.ver = (layer.ver || 0) + 1; paint(); return;
        }
        if (g.n === 1) { const l = hit(...toDoc(g.x, g.y)); if (l !== sel) select(l); }
        base = sel ? { x: sel.x, y: sel.y, scale: sel.scale || 1, rot: sel.rot || 0 } : null;
      },
      move: g => {
        if (mode === 'draw') { if (!stroke) return; stroke.pts.push(this.local(layer, ...toDoc(g.x, g.y))); layer.ver++; paint(); return; }
        if (!sel || !base) return;
        sel.x = base.x + (g.x - g.x0) / fit; sel.y = base.y + (g.y - g.y0) / fit;
        if (g.n === 2) { sel.scale = clamp(base.scale * g.scale, .03, 40); sel.rot = base.rot + g.rot; const deg = sel.rot * 180 / Math.PI, snap = Math.round(deg / 90) * 90; if (Math.abs(deg - snap) < 4) sel.rot = snap * Math.PI / 180; }
        paint();
      },
      end: (g, more) => { if (mode === 'draw') { stroke = null; if (!more) commit(); return; } if (!more) { base = null; commit(); } },
      tap: async g => {
        if (mode !== 'move') return; const l = hit(...toDoc(g.x, g.y));
        if (l && l === sel && l.type === 'text' && wasSel) { const s = await UI.ask(t('Text'), l.text, { multi: true }); if (s != null && s.trim()) { l.text = s; paint(); commit(); } }
      },
    });
    // a second tap on text that is already picked opens it for editing
    let wasSel = false;
    art.addEventListener('pointerdown', e => { const l = hit(...toDoc(e.clientX, e.clientY)); wasSel = !!l && l === sel; }, true);
    new ResizeObserver(() => { layout(); paint(); }).observe(art);
    bar(); layout(); paint();
    if (!pic.layers.length) setTimeout(() => this.addPhotoTo(pic, l => { select(l); commit(); }, true), 250);
  },
  local(l, px, py) { const s = l.scale || 1, a = -(l.rot || 0), dx = px - l.x, dy = py - l.y; return [(dx * Math.cos(a) - dy * Math.sin(a)) / s, (dx * Math.sin(a) + dy * Math.cos(a)) / s]; },
  addPhotoTo(pic, then, quiet) {
    const go = async blob => { if (!blob) return; const done = UI.busy(); try { then(await this.addImage(pic, blob, false)); } catch (e) { UI.toast(t('Some files could not be read as pictures.'), 'error'); } finally { done(); } };
    if (!Lens.photos.length) { if (!quiet) this.photoFromPhone().then(go); return; }
    UI.menu(t('Photo'), [{ label: t('From the phone'), icon: 'image', run: () => this.photoFromPhone().then(go) }, { label: t('From Lens'), icon: 'image', run: () => this.photoFromLens().then(go) }]);
  },
  sticker(then) {
    const s = UI.sheet({ title: t('Sticker'), body: h('div', { class: 'stickers' }, STICKERS.map(ch => h('button', { 'aria-label': ch, onclick: () => { s.close(); then(ch); } }, ch))) });
  },
  colour(cur, then, allowAny, clear) {
    const pickr = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff', 'aria-label': t('Colour'), style: { width: '60px', height: '44px', border: 0, background: 'none', padding: 0 }, onchange: e => { s.close(); then(e.target.value); } });
    const s = UI.sheet({ title: t('Colour'), body: h('div', {}, h('div', { class: 'swatches' }, COLOURS.map(c => h('button', { class: 'swatch', style: { background: c }, 'aria-label': c, 'aria-pressed': String(c === cur), onclick: () => { s.close(); then(c); } })), pickr),
      clear ? h('button', { class: 'btn wide', style: { marginTop: '16px' }, onclick: () => { s.close(); clear(); } }, t('None')) : null) });
    void allowAny;
  },
  layers(pic, sel, pick, changed) {
    const name = l => l.type === 'image' ? t('Photo') : l.type === 'draw' ? t('Drawing') : l.type === 'sticker' ? l.text : (l.text || '').split('\n')[0].slice(0, 30);
    const draw = () => list.replaceChildren(...pic.layers.slice().reverse().map(l => h('div', { class: 'row', 'aria-current': String(l === sel) },
      h('button', { class: 'meta', style: { border: 0, background: 'none', textAlign: 'left', color: 'inherit', padding: 0 }, onclick: () => { s.close(); pick(l); } }, h('b', {}, name(l)), h('small', {}, (l.hidden ? t('Hidden') + ' · ' : '') + Math.round((l.opacity ?? 1) * 100) + '%')),
      ib(l.hidden ? 'eyeoff' : 'eye', l.hidden ? t('Hidden') : t('Layers'), () => { l.hidden = !l.hidden; changed(); draw(); }),
      ib('up', t('Forward'), () => { const i = pic.layers.indexOf(l); if (i < pic.layers.length - 1) { pic.layers.splice(i, 1); pic.layers.splice(i + 1, 0, l); changed(); draw(); } }),
      ib('down', t('Backward'), () => { const i = pic.layers.indexOf(l); if (i > 0) { pic.layers.splice(i, 1); pic.layers.splice(i - 1, 0, l); changed(); draw(); } }))));
    const list = h('div', { class: 'list layers-list' }); draw();
    const s = UI.sheet({ title: t('Layers'), body: list });
  },
  async export(pic, type, how) {
    const done = UI.busy(); let blob;
    try { blob = await canvasBlob(await this.render2(pic, type), type, .93); } catch (e) { done(); UI.toast(t('Could not save the file.'), 'error'); return; }
    done(); const name = safeName(pic.name) + (type === 'image/png' ? '.png' : '.jpg');
    how === 'share' ? Native.share(blob, name, type) : Native.save(blob, name, type, 'pictures');
  },
};
