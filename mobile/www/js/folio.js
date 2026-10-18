'use strict';
/* Folio: PDFs on the phone. pdf.js shows the pages; pdf-lib writes the changes. Marks you add (text, signatures,
   highlights, drawing) stay editable on top of the page until you save or share, when they are written into a copy.
   Filling in the form and changing pages rewrite Opia's working copy straight away; the original is kept for Revert. */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
const PDF_OPTS = { isEvalSupported: false, standardFontDataUrl: 'vendor/pdfjs/standard_fonts/', disableAutoFetch: true };

const Folio = {
  id: 'folio', name: 'Folio', icon: 'img/opia-pdf-icon.svg',
  docs: [],

  async init(el) { this.el = el; this.docs = (await DB.all('docs')).sort((a, b) => b.updated - a.updated); this.render(); },
  topActions() { return this.docs.length ? [ib('plus', t('Open PDF'), () => this.add())] : []; },
  render() {
    App.refreshTop();
    if (!this.docs.length) {
      this.el.replaceChildren(h('div', { class: 'empty' }, h('img', { src: this.icon, alt: '' }), h('h2', {}, t('Fill in, sign, rearrange')),
        h('p', {}, t('Open a PDF to fill in its form, sign it with your finger, add text and highlights, or reorder its pages.')),
        h('button', { class: 'btn primary', onclick: () => this.add() }, icon('file'), t('Open PDF'))));
      return;
    }
    this.el.replaceChildren(h('div', { class: 'sec' }, t('Recent')), h('div', { class: 'list', style: { paddingBottom: '90px' } }, this.docs.map(d => h('div', { class: 'row' },
      h('button', { class: 'meta', style: { display: 'flex', alignItems: 'center', gap: '14px', border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit' }, onclick: () => this.open(d) },
        h('span', { class: 'thumb' }, d.thumb ? h('img', { src: URL.createObjectURL(d.thumb), alt: '' }) : icon('file')),
        h('span', { style: { minWidth: 0 } }, h('b', {}, d.name), h('small', {}, plural(d.pages, '1 page', '{n} pages') + ' · ' + fmtDate(d.updated)))),
      ib('more', t('More'), () => UI.menu(d.name, [{ label: t('Share'), icon: 'share', run: () => this.output(d, 'share') }, { label: t('Save'), icon: 'save', run: () => this.output(d, 'save') },
        { label: t('Delete'), icon: 'trash', danger: true, run: async () => { if (await UI.confirm(t('Delete for good?'), t('This cannot be undone.'))) { await this.remove(d); this.render(); } } }]))))),
      h('button', { class: 'fab', 'aria-label': t('Open PDF'), onclick: () => this.add() }, icon('plus')));
  },
  async remove(d) { await DB.del('files', d.file); if (d.orig !== d.file) await DB.del('files', d.orig); await DB.del('docs', d.id); this.docs = this.docs.filter(x => x !== d); },

  async add() {
    const [f] = await pickFiles('application/pdf,.pdf'); if (!f) return;
    const done = UI.busy(); let d;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer()), pdf = await pdfjsLib.getDocument({ ...PDF_OPTS, data: bytes.slice() }).promise;
      const id = uid(), file = 'pdf-' + id; await DB.putBlob(file, new Blob([bytes], { type: 'application/pdf' }));
      d = { id, name: f.name.replace(/\.pdf$/i, ''), file, orig: file, pages: pdf.numPages, updated: Date.now(), ann: {}, thumb: await this.thumb(pdf) };
      pdf.destroy(); await DB.put('docs', d); this.docs.unshift(d);
    } catch (e) { console.warn(e); UI.toast(t('That file could not be opened as a PDF.'), 'error'); return; } finally { done(); }
    this.render(); this.open(d);
  },
  async thumb(pdf) { const p = await pdf.getPage(1), v = p.getViewport({ scale: 1 }), k = 160 / v.width, vp = p.getViewport({ scale: k }), cv = canvas(vp.width, vp.height); await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; return canvasBlob(cv, 'image/jpeg', .8); },
  async bytes(d) { return new Uint8Array(await (await DB.blob(d.file)).arrayBuffer()); },
  async lib(bytes) {
    try { return await PDFLib.PDFDocument.load(bytes); }
    catch (e) { if (/encrypt/i.test(String(e))) { UI.toast(t('This PDF is locked with a password, so Opia cannot change it.'), 'error'); return null; } throw e; }
  },

  /* ---- the reader */
  async open(d) {
    let pdf, zoom = 1, tool = null, moving = null;
    const pages = h('div', { class: 'pages' }), hint = h('span', { class: 'hint' }), ctx = h('div', { class: 'ctx' }, hint);
    const toolBtn = (k, ic, label) => h('button', { 'data-k': k, 'aria-pressed': 'false', onclick: () => setTool(tool === k ? null : k) }, icon(ic), label);
    const tools = h('div', { class: 'actbar' }, toolBtn('text', 'text', t('Text')), toolBtn('sign', 'sign', t('Sign')), toolBtn('hl', 'marker', t('Highlight')), toolBtn('ink', 'pen', t('Draw')),
      h('button', { onclick: () => this.form(d, reload) }, icon('form'), t('Form')), h('button', { onclick: () => this.pagesView(d, reload) }, icon('pages'), t('Pages')));
    const scr = UI.screen({ title: d.name, content: pages, foot: h('div', {}, ctx, tools), actions: [
      ib('fit', t('Zoom'), () => UI.menu(t('Zoom'), [1, 1.5, 2, 3].map(z => ({ label: Math.round(z * 100) + '%', run: () => { zoom = z; layout(); } })))),
      ib('share', t('Share'), () => this.output(d, 'share')), ib('save', t('Save'), () => this.output(d, 'save')),
      ib('more', t('More'), () => UI.menu(d.name, [{ label: t('Rename'), icon: 'edit', run: async () => { const n = await UI.ask(t('Rename'), d.name); if (n && n.trim()) { d.name = n.trim(); scr.setTitle(d.name); await this.store(d); } } },
        d.orig !== d.file || Object.keys(d.ann).length ? { label: t('Revert to the original'), icon: 'undo', danger: true, run: async () => { if (!(await UI.confirm(t('Revert to the original'), t('This cannot be undone.'), t('OK')))) return; if (d.file !== d.orig) await DB.del('files', d.file); d.file = d.orig; d.ann = {}; await this.store(d); reload(); } } : null]))],
      onclose: () => { pdf && pdf.destroy(); this.render(); } });
    const setTool = k => {
      tool = k; moving = null; pages.classList.toggle('tool', !!k);
      tools.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      hint.textContent = { text: t('Tap where the text goes.'), sign: t('Tap where the signature goes.'), hl: t('Drag over what to highlight.'), ink: t('Draw with your finger.') }[k] || '';
    };
    let views = [];
    const layout = () => {
      const W = (pages.clientWidth - 24) * zoom;
      for (const v of views) { const w = W, hh = w * v.ph / v.pw; Object.assign(v.el.style, { width: w + 'px', height: hh + 'px' }); v.k = w / v.pw; v.drawn = 0; v.paintAnn(); }
      io && views.forEach(v => { io.unobserve(v.el); io.observe(v.el); });
    };
    let io = null;
    const reload = async () => {
      const done = UI.busy();
      try {
        if (pdf) pdf.destroy();
        pdf = await pdfjsLib.getDocument({ ...PDF_OPTS, data: await this.bytes(d) }).promise; d.pages = pdf.numPages;
        views = []; pages.replaceChildren();
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1), vp = page.getViewport({ scale: 1 }), cv = h('canvas', { class: 'pdf', 'aria-hidden': 'true' }), ann = canvas(10, 10), annBox = h('div', { class: 'ann' }, ann);
          const el = h('div', { class: 'page', role: 'img', 'aria-label': t('Page {n}', { n: i + 1 }) }, cv, annBox, h('span', { class: 'num' }, String(i + 1)));
          const v = { i, page, vp, pw: vp.width, ph: vp.height, el, cv, ann, k: 1, drawn: 0 };
          v.paintAnn = () => this.paintAnn(v, d.ann[i] || []);
          this.pageInput(annBox, v, d, () => tool, () => moving, (k) => setTool(k), m => { moving = m; }, () => this.store(d));
          views.push(v); pages.append(el);
        }
        io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const v = views.find(x => x.el === e.target); if (v) this.paintPage(v); } }), { root: pages, rootMargin: '600px 0px' });
        layout();
      } catch (e) { console.error(e); UI.toast(t('That file could not be opened as a PDF.'), 'error'); } finally { done(); }
    };
    new ResizeObserver(() => views.length && layout()).observe(pages);
    setTool(null); await reload();
  },
  async paintPage(v) {
    const w = Math.round(v.pw * v.k * Math.min(2.5, devicePixelRatio || 1)); if (v.drawn === w || v.busy) return; v.busy = true;
    try {
      const vp = v.page.getViewport({ scale: w / v.pw }), off = canvas(vp.width, vp.height);
      await v.page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
      v.cv.width = off.width; v.cv.height = off.height; v.cv.getContext('2d').drawImage(off, 0, 0); v.drawn = w;
    } catch (e) { /* page went away while drawing */ } finally { v.busy = false; }
    if (v.drawn !== Math.round(v.pw * v.k * Math.min(2.5, devicePixelRatio || 1))) this.paintPage(v);
  },
  /* marks are kept in page points, top-left origin, as the page is shown */
  paintAnn(v, list) {
    const dpr = Math.min(2.5, devicePixelRatio || 1), k = v.k * dpr, cv = v.ann; cv.width = Math.round(v.pw * k); cv.height = Math.round(v.ph * k);
    const x = cv.getContext('2d'); x.scale(k, k);
    for (const a of list) {
      if (a.type === 'hl') { x.fillStyle = 'rgba(255, 221, 0, .38)'; x.fillRect(a.x, a.y, a.w, a.h); }
      else if (a.type === 'ink') { x.strokeStyle = a.color; x.lineWidth = a.width; x.lineCap = x.lineJoin = 'round'; x.beginPath(); a.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); }
      else if (a.type === 'text') { x.fillStyle = a.color || '#000'; x.font = `${a.size}px Helvetica, Arial, sans-serif`; x.textBaseline = 'top'; (a.text || '').split('\n').forEach((s, i) => x.fillText(s, a.x, a.y + i * a.size * 1.2)); }
      else if (a.type === 'sig') { if (!a._img) { a._img = new Image(); a._img.onload = () => v.paintAnn(); a._img.src = a.png; } else if (a._img.complete) x.drawImage(a._img, a.x, a.y, a.w, a.h); }
      if (a._sel) { x.strokeStyle = '#3d5afe'; x.lineWidth = 1.2; x.setLineDash([4, 3]); const b = this.box(a, x); x.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); x.setLineDash([]); }
    }
  },
  box(a, x) {
    if (a.type === 'text') { const ctx = x || canvas(1, 1).getContext('2d'); ctx.font = `${a.size}px Helvetica, Arial, sans-serif`; const lines = (a.text || '').split('\n'); return { x: a.x, y: a.y, w: Math.max(...lines.map(s => ctx.measureText(s).width)), h: lines.length * a.size * 1.2 }; }
    if (a.type === 'ink') { const xs = a.pts.map(p => p[0]), ys = a.pts.map(p => p[1]), mx = Math.min(...xs), my = Math.min(...ys); return { x: mx, y: my, w: Math.max(...xs) - mx, h: Math.max(...ys) - my }; }
    return { x: a.x, y: a.y, w: a.w, h: a.h };
  },
  /* fingers on a page: place, draw, pick or move marks */
  pageInput(box, v, d, getTool, getMoving, setTool, setMoving, persist) {
    const pt = (cx, cy) => { const r = box.getBoundingClientRect(); return [(cx - r.left) / v.k, (cy - r.top) / v.k]; };
    const list = () => (d.ann[v.i] = d.ann[v.i] || []);
    const changed = () => { v.paintAnn(); persist(); };
    const at = (px, py) => { for (const a of list().slice().reverse()) { const b = this.box(a); if (px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 8) return a; } return null; };
    let cur = null, start = null;
    box.addEventListener('pointerdown', async e => {
      const tool = getTool(), mv = getMoving(); if (!tool && !mv) return;
      const [px, py] = pt(e.clientX, e.clientY); box.setPointerCapture(e.pointerId);
      if (mv) { const a = list().find(x => x === mv); if (a) { start = { px, py, a: JSON.parse(JSON.stringify({ ...a, _img: null })) }; cur = a; } return; }
      if (tool === 'hl') { cur = { type: 'hl', x: px, y: py, w: 0, h: 0 }; start = { px, py }; list().push(cur); }
      else if (tool === 'ink') { cur = { type: 'ink', color: '#1d3ec9', width: 1.6, pts: [[px, py]] }; list().push(cur); }
    });
    box.addEventListener('pointermove', e => {
      if (!cur) return; const [px, py] = pt(e.clientX, e.clientY);
      if (start && start.a) { const dx = px - start.px, dy = py - start.py; if (cur.type === 'ink') cur.pts = start.a.pts.map(([a, b]) => [a + dx, b + dy]); else { cur.x = start.a.x + dx; cur.y = start.a.y + dy; } }
      else if (cur.type === 'hl') { cur.x = Math.min(px, start.px); cur.y = Math.min(py, start.py); cur.w = Math.abs(px - start.px); cur.h = Math.abs(py - start.py); }
      else if (cur.type === 'ink') cur.pts.push([px, py]);
      v.paintAnn();
    });
    const up = async e => {
      const tool = getTool(), mv = getMoving();
      if (cur) { if (cur.type === 'hl' && (cur.w < 3 || cur.h < 3) && !mv) list().splice(list().indexOf(cur), 1); cur = null; start = null; if (mv) { mv._sel = false; setMoving(null); setTool(null); } changed(); return; }
      if (e.type === 'pointercancel') return;
      const [px, py] = pt(e.clientX, e.clientY);
      if (tool === 'text') { setTool(null); const s = await UI.ask(t('Text'), '', { multi: true, placeholder: t('Type something') }); if (s && s.trim()) { list().push({ type: 'text', x: px, y: py - 6, size: 12, color: '#000000', text: s }); changed(); } }
      else if (tool === 'sign') { setTool(null); const png = await this.signature(); if (png) { const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = png; }); const w = Math.min(160, v.pw * .45), hh = w * img.height / img.width; list().push({ type: 'sig', x: px - w / 2, y: py - hh / 2, w, h: hh, png }); changed(); } }
    };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    // with no tool, a tap on a mark offers to change it
    box.addEventListener('click', e => {
      if (getTool() || getMoving()) return; const a = at(...pt(e.clientX, e.clientY)); if (!a) return;
      a._sel = true; v.paintAnn();
      const unsel = () => { a._sel = false; v.paintAnn(); };
      const resize = f => { if (a.type === 'text') a.size = clamp(a.size * f, 5, 96); else if (a.type !== 'ink') { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; a.w *= f; a.h *= f; a.x = cx - a.w / 2; a.y = cy - a.h / 2; } changed(); };
      UI.menu('', [a.type === 'text' ? { label: t('Edit'), icon: 'edit', run: async () => { unsel(); const s = await UI.ask(t('Text'), a.text, { multi: true }); if (s != null && s.trim()) { a.text = s; changed(); } } } : null,
        { label: t('Move'), icon: 'fit', run: () => { setTool(null); setMoving(a); box.closest('.pages').classList.add('tool'); UI.toast(t('Drag the mark to where it goes.')); } },
        a.type !== 'ink' && a.type !== 'hl' ? { label: t('Bigger'), icon: 'plus', run: () => { unsel(); resize(1.2); } } : null,
        a.type !== 'ink' && a.type !== 'hl' ? { label: t('Smaller'), icon: 'minus', run: () => { unsel(); resize(1 / 1.2); } } : null,
        { label: t('Delete'), icon: 'trash', danger: true, run: () => { list().splice(list().indexOf(a), 1); changed(); } }], () => { if (getMoving() !== a) unsel(); });
    });
  },

  /* ---- signatures: draw one, keep it for next time */
  signature() {
    return new Promise(async res => {
      let out = null; const saved = await DB.all('sigs');
      const pad = h('canvas', { class: 'sigpad', 'aria-label': t('Sign here') }), x = pad.getContext('2d');
      const size = () => { const r = pad.getBoundingClientRect(), k = devicePixelRatio || 1; pad.width = r.width * k; pad.height = r.height * k; x.scale(k, k); x.lineCap = x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = '#111'; };
      let last = null, inked = false;
      pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); last = [e.clientX - r.left, e.clientY - r.top]; x.beginPath(); x.arc(last[0], last[1], 1.5, 0, 7); x.fillStyle = '#111'; x.fill(); inked = true; });
      pad.addEventListener('pointermove', e => { if (!last) return; const r = pad.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top]; x.beginPath(); x.moveTo(...last); x.lineTo(...p); x.stroke(); last = p; });
      pad.addEventListener('pointerup', () => { last = null; });
      const use = async () => {
        if (!inked) return; const png = this.trim(pad); out = png; const id = uid(); await DB.put('sigs', { id, png, added: Date.now() }); s.close();
      };
      const s = UI.sheet({ title: t('Sign'), wide: true, onclose: () => res(out), body: h('div', {},
        saved.length ? [h('div', { class: 'sec' }, t('Saved signatures')), h('div', { class: 'sigs' }, saved.sort((a, b) => b.added - a.added).map(sg => h('button', { 'aria-label': t('Use this signature'), onclick: () => { out = sg.png; s.close(); }, oncontextmenu: async e => { e.preventDefault(); await DB.del('sigs', sg.id); e.currentTarget.remove(); } }, h('img', { src: sg.png, alt: '' })))), h('div', { class: 'sec' }, t('New signature'))] : null,
        pad), acts: [h('button', { class: 'btn', onclick: () => { x.clearRect(0, 0, pad.width, pad.height); inked = false; } }, t('Clear')), h('button', { class: 'btn primary', onclick: use }, t('Use this signature'))] });
      requestAnimationFrame(size);
    });
  },
  trim(cv) {
    const x = cv.getContext('2d'), { width: w, height: hh } = cv, d = x.getImageData(0, 0, w, hh).data; let a = w, b = hh, c = 0, e = 0;
    for (let y = 0; y < hh; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 10) { a = Math.min(a, i); b = Math.min(b, y); c = Math.max(c, i); e = Math.max(e, y); }
    if (c <= a) return cv.toDataURL(); const pad = 6, out = canvas(c - a + pad * 2, e - b + pad * 2); out.getContext('2d').drawImage(cv, a - pad, b - pad, out.width, out.height, 0, 0, out.width, out.height); return out.toDataURL('image/png');
  },

  /* ---- the form */
  async form(d, reload) {
    const lib = await this.lib(await this.bytes(d)); if (!lib) return;
    let fields; try { fields = lib.getForm().getFields(); } catch (e) { fields = []; }
    if (!fields.length) { UI.toast(t('This PDF has no form to fill in.')); return; }
    const inputs = [];
    const body = h('div', {}, fields.map(f => {
      const name = f.getName(), label = name.split('.').pop().replace(/[_]+/g, ' '), kind = f.constructor.name;
      let inp;
      try {
        if (f instanceof PDFLib.PDFTextField) inp = h(f.isMultiline() ? 'textarea' : 'input', { value: f.getText() || '' });
        else if (f instanceof PDFLib.PDFCheckBox) inp = h('input', { type: 'checkbox', checked: f.isChecked(), style: { width: '28px', minHeight: '28px' } });
        else if (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList) { const sel = f.getSelected()[0]; inp = h('select', {}, h('option', { value: '' }, '—'), f.getOptions().map(o => h('option', { value: o, selected: o === sel }, o))); }
        else if (f instanceof PDFLib.PDFRadioGroup) { const sel = f.getSelected(); inp = h('select', {}, h('option', { value: '' }, '—'), f.getOptions().map(o => h('option', { value: o, selected: o === sel }, o))); }
      } catch (e) { inp = null; }
      if (!inp) return null; inputs.push([f, inp, kind]);
      return h('label', { class: 'field' }, h('span', {}, label), inp);
    }));
    const s = UI.sheet({ title: t('Fill in the form'), wide: true, body, acts: [h('button', { class: 'btn', onclick: () => s.close() }, t('Cancel')), h('button', { class: 'btn primary', onclick: async () => {
      const done = UI.busy();
      try {
        for (const [f, inp] of inputs) {
          if (f instanceof PDFLib.PDFTextField) f.setText(inp.value); else if (f instanceof PDFLib.PDFCheckBox) inp.checked ? f.check() : f.uncheck();
          else if (inp.value) f.select(inp.value); else if (f.clear) f.clear();
        }
        await this.rewrite(d, await lib.save());
      } catch (e) { console.error(e); UI.toast(t('Could not save the file.'), 'error'); } finally { done(); }
      s.close(); reload();
    } }, t('Apply'))] });
  },
  /* a new working copy; the original stays for Revert */
  async rewrite(d, bytes) {
    const file = 'pdf-' + uid(); await DB.putBlob(file, new Blob([bytes], { type: 'application/pdf' }));
    if (d.file !== d.orig) await DB.del('files', d.file); d.file = file; await this.store(d);
  },
  async store(d) { d.updated = Date.now(); await DB.put('docs', { ...d, ann: JSON.parse(JSON.stringify(d.ann, (k, v) => (k.startsWith('_') ? undefined : v))) }); },

  /* ---- pages: turn, reorder, copy, remove */
  async pagesView(d, reload) {
    if (Object.values(d.ann).some(l => l.length)) {     // the marks are tied to where they are on the page, so write them in first
      const lib = await this.lib(await this.bytes(d)); if (!lib) return; await this.flatten(lib, d); await this.rewrite(d, await lib.save()); d.ann = {}; await this.store(d);
    }
    let pdf, picked = 0;
    const grid = h('div', { class: 'thumbs' });
    const draw = async () => {
      if (pdf) pdf.destroy(); pdf = await pdfjsLib.getDocument({ ...PDF_OPTS, data: await this.bytes(d) }).promise; d.pages = pdf.numPages; grid.replaceChildren();
      for (let i = 0; i < pdf.numPages; i++) {
        const cv = h('canvas', { 'aria-hidden': 'true' }), b = h('button', { 'aria-pressed': String(i === picked), 'aria-label': t('Page {n}', { n: i + 1 }), onclick: () => act(i) }, cv, String(i + 1)); grid.append(b);
        pdf.getPage(i + 1).then(async p => { const v = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: 300 / v.width }); cv.width = vp.width; cv.height = vp.height; await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; });
      }
    };
    const op = async fn => {
      const done = UI.busy();
      try { const lib = await this.lib(await this.bytes(d)); if (!lib) return; await fn(lib); await this.rewrite(d, await lib.save()); await draw(); }
      catch (e) { console.error(e); UI.toast(t('Could not save the file.'), 'error'); } finally { done(); }
    };
    const act = i => {
      picked = i; grid.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      const n = d.pages;
      UI.menu(t('Page {n}', { n: i + 1 }), [
        { label: t('Rotate page'), icon: 'rotate', run: () => op(lib => { const p = lib.getPage(i); p.setRotation(PDFLib.degrees((p.getRotation().angle + 90) % 360)); }) },
        i > 0 ? { label: t('Move earlier'), icon: 'up', run: () => op(lib => { const p = lib.getPage(i); lib.removePage(i); lib.insertPage(i - 1, p); picked = i - 1; }) } : null,
        i < n - 1 ? { label: t('Move later'), icon: 'down', run: () => op(lib => { const p = lib.getPage(i); lib.removePage(i); lib.insertPage(i + 1, p); picked = i + 1; }) } : null,
        { label: t('Duplicate page'), icon: 'copy', run: () => op(async lib => { const [c] = await lib.copyPages(lib, [i]); lib.insertPage(i + 1, c); }) },
        n > 1 ? { label: t('Delete page'), icon: 'trash', danger: true, run: () => op(lib => { lib.removePage(i); picked = Math.max(0, i - 1); }) } : null]);
    };
    UI.screen({ title: t('Pages'), content: h('div', { style: { position: 'absolute', inset: 0, overflow: 'auto', padding: '14px 16px' } }, grid), onclose: () => { pdf && pdf.destroy(); reload(); } });
    await draw();
  },

  /* ---- writing the marks into the PDF */
  async flatten(lib, d) {
    const font = await lib.embedFont(PDFLib.StandardFonts.Helvetica), pages = lib.getPages(); let dropped = false;
    const ok = new Map(), keep = s => [...s].filter(ch => { if (ch === '\n') return true; if (!ok.has(ch)) { try { font.encodeText(ch); ok.set(ch, true); } catch (e) { ok.set(ch, false); } } if (!ok.get(ch)) dropped = true; return ok.get(ch); }).join('');
    const rgb = hex => { const n = parseInt(hex.slice(1), 16); return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
    const pdf = await pdfjsLib.getDocument({ ...PDF_OPTS, data: await lib.save() }).promise;
    for (const [i, list] of Object.entries(d.ann)) {
      const page = pages[+i]; if (!page || !list.length) continue;
      const vp = (await pdf.getPage(+i + 1)).getViewport({ scale: 1 }), P = (x, y) => vp.convertToPdfPoint(x, y), rot = PDFLib.degrees(page.getRotation().angle || 0);
      for (const a of list) {
        if (a.type === 'hl') { const [x, y] = P(a.x, a.y + a.h); page.drawRectangle({ x, y, width: a.w, height: a.h, color: PDFLib.rgb(1, .87, 0), opacity: .38, rotate: rot }); }
        else if (a.type === 'ink') { for (let j = 1; j < a.pts.length; j++) { const [x1, y1] = P(...a.pts[j - 1]), [x2, y2] = P(...a.pts[j]); page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: a.width, color: rgb(a.color), lineCap: PDFLib.LineCapStyle.Round }); } }
        else if (a.type === 'text') { (a.text || '').split('\n').forEach((s, j) => { const [x, y] = P(a.x, a.y + (j + .82) * a.size * 1.2); page.drawText(keep(s), { x, y, size: a.size, font, color: rgb(a.color || '#000000'), rotate: rot }); }); }
        else if (a.type === 'sig') { const img = await lib.embedPng(a.png), [x, y] = P(a.x, a.y + a.h); page.drawImage(img, { x, y, width: a.w, height: a.h, rotate: rot }); }
      }
    }
    pdf.destroy();
    if (dropped) UI.toast(t('Some letters are not in the PDF font and were left out.'));
  },
  async output(d, how) {
    const done = UI.busy(); let blob;
    try {
      const bytes = await this.bytes(d);
      if (Object.values(d.ann).some(l => l.length)) { const lib = await this.lib(bytes); if (!lib) return; await this.flatten(lib, d); blob = new Blob([await lib.save()], { type: 'application/pdf' }); }
      else blob = new Blob([bytes], { type: 'application/pdf' });
    } catch (e) { console.error(e); UI.toast(t('Could not save the file.'), 'error'); return; } finally { done(); }
    const name = safeName(d.name) + (d.file !== d.orig || Object.values(d.ann).some(l => l.length) ? ' (Opia)' : '') + '.pdf';
    how === 'share' ? Native.share(blob, name, 'application/pdf') : Native.save(blob, name, 'application/pdf', 'documents');
  },
};
