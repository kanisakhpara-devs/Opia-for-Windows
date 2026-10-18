'use strict';
/* Groove: the desktop app's music engine with a phone front. A song is a few short riffs that loop together, all in
   one key and scale so every note fits. Parts are written for you and changed with a tap; your voice can go on top. */

const Groove = {
  id: 'groove', name: 'Groove', icon: 'img/opia-music-icon.svg',
  songs: [], cur: null,

  async init(el) { this.el = el; await Samples.init(); this.songs = (await DB.all('songs')).sort((a, b) => b.updated - a.updated); this.render(); },
  leave() { if (Player.playing) Player.stop(); },
  topActions() { return this.songs.length ? [ib('plus', t('New song'), () => this.create())] : []; },
  render() {
    App.refreshTop();
    if (!this.songs.length) {
      this.el.replaceChildren(h('div', { class: 'empty' }, h('img', { src: this.icon, alt: '' }), h('h2', {}, t('Riffs that always fit')),
        h('p', {}, t('A song here is a few short riffs that loop together. Pick a style and Opia writes the first draft; then change whatever you like.')),
        h('button', { class: 'btn primary', onclick: () => this.make(null) }, icon('sparkle'), t('Start me off')),
        h('button', { class: 'btn', onclick: () => this.create() }, t('Or pick a style'))));
      return;
    }
    this.el.replaceChildren(h('div', { class: 'list', style: { paddingTop: '8px', paddingBottom: '90px' } }, this.songs.map(rec => h('div', { class: 'row' },
      h('button', { class: 'meta', style: { display: 'flex', alignItems: 'center', gap: '14px', border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit' }, onclick: () => this.open(rec) },
        h('span', { class: 'thumb', style: { color: 'var(--acc-text)' } }, icon('music')),
        h('span', { style: { minWidth: 0 } }, h('b', {}, rec.name), h('small', {}, `${NOTE_NAMES[rec.song.key]} ${t(SCALE_NAMES[rec.song.scale].split(' (')[0])} · ${rec.song.bpm} BPM · ${fmtDate(rec.updated)}`))),
      ib('more', t('More'), () => UI.menu(rec.name, [{ label: t('Rename'), icon: 'edit', run: async () => { const n = await UI.ask(t('Rename'), rec.name); if (n && n.trim()) { rec.name = n.trim(); await this.store(rec); this.render(); } } },
        { label: t('Save as WAV'), icon: 'save', run: () => this.export(rec, 'save') }, { label: t('Share'), icon: 'share', run: () => this.export(rec, 'share') },
        { label: t('Delete'), icon: 'trash', danger: true, run: async () => { if (await UI.confirm(t('Delete for good?'), t('This cannot be undone.'))) { await this.remove(rec); this.render(); } } }]))))),
      h('button', { class: 'fab', 'aria-label': t('New song'), onclick: () => this.create() }, icon('plus')));
  },
  async remove(rec) { for (const tr of rec.song.tracks) for (const c of tr.clips || []) await DB.del('files', c.buf); await DB.del('songs', rec.id); this.songs = this.songs.filter(s => s !== rec); },
  async store(rec) { rec.updated = Date.now(); await DB.put('songs', rec); },
  create() {
    const s = UI.sheet({ title: t('New song'), body: h('div', {},
      h('button', { class: 'btn primary wide', onclick: () => { s.close(); this.make(null); } }, icon('sparkle'), t('Start me off')),
      h('div', { class: 'sec' }, t('Or pick a style')),
      h('div', { class: 'adds' }, Object.entries(STYLES).map(([k, st]) => h('button', { class: 'btn', onclick: () => { s.close(); this.make(k); } }, st.name))),
      h('button', { class: 'btn wide', style: { marginTop: '16px' }, onclick: () => { s.close(); this.make('empty'); } }, t('Empty song'))) });
  },
  blank() { return { bpm: 100, key: 9, scale: 'minor', bars: 4, vol: .9, prog: null, tracks: [] }; },
  newTrack(song, role) {
    const R = ROLES[role], st = STYLES[song.style] || {}, n = song.tracks.filter(x => x.role === role).length, tr = { id: uid(), role, type: role === 'drums' ? 'drums' : 'synth', name: R.name + (n ? ' ' + (n + 1) : ''), vol: .8, len: 4 };
    if (role === 'drums') { tr.steps = {}; tr.kit = st.kit || 'studio'; } else { tr.preset = Samples.prefer(st[role] || R.preset); tr.notes = []; }
    Gen.fill(song, tr); song.tracks.push(tr); return tr;
  },
  async make(style) {
    const song = this.blank();
    if (style !== 'empty') { const st = STYLES[style = style || Gen.pick(Object.keys(STYLES))]; Object.assign(song, { style, bpm: st.bpm, scale: st.scale, swing: st.swing || 0, key: Math.floor(Math.random() * 12) }); Gen.prog(song, true); for (const r of ['drums', 'bass', 'chords', 'melody']) this.newTrack(song, r); }
    const rec = { id: uid(), name: style !== 'empty' ? STYLES[style].name + ' · ' + new Date().toLocaleDateString(I18N.lang, { day: 'numeric', month: 'short' }) : t('New song'), song, updated: Date.now() };
    this.songs.unshift(rec); await this.store(rec); this.render(); this.open(rec, style !== 'empty');
  },
  async loadClips(song) { for (const tr of song.tracks) for (const c of tr.clips || []) if (!Player.bufs.has(c.buf)) { const b = await DB.blob(c.buf); if (b) try { Player.bufs.set(c.buf, await Player.ready().decodeAudioData(await b.arrayBuffer())); } catch (e) { /* unreadable recording */ } } },
  label(tr) { return tr.role === 'audio' ? t('Voice') : t(ROLES[tr.role].name); },
  instName(tr) { return tr.role === 'drums' ? (KITS[tr.kit] || KITS.studio).name : tr.role === 'audio' ? plural((tr.clips || []).length, '1 recording', '{n} recordings') : (INSTR[tr.preset] || {}).name || tr.preset; },

  /* ---- a song */
  async open(rec, autoplay) {
    const song = rec.song; this.cur = rec; Player.song = song;
    const done = UI.busy(); try { Player.ready(); await Samples.need(song); await this.loadClips(song); } finally { done(); }
    let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => this.store(rec), 500); };
    const changed = () => { save(); Player.refresh(); };
    const playB = h('button', { class: 'play', 'aria-label': t('Play') }), pos = h('div', { class: 'pos' }), meter = h('i'), parts = h('div', { class: 'parts' });
    const setPlay = () => { playB.replaceChildren(icon(Player.playing ? 'stop' : 'play', true)); playB.setAttribute('aria-label', Player.playing ? t('Stop') : t('Play')); };
    playB.onclick = async () => { if (Player.playing) Player.stop(); else { await Samples.need(song); Player.play(); } setPlay(); };
    Player.onstop = setPlay;
    const info = h('button', { class: 'chip', onclick: () => this.keySheet(song, () => { changed(); draw(); info.textContent = keyText(); }) }), keyText = () => `${NOTE_NAMES[song.key]} ${t(SCALE_NAMES[song.scale].split(' (')[0])}`;
    const tempo = h('button', { class: 'chip', onclick: () => { const s = UI.sheet({ title: t('Tempo'), body: h('div', {}, h('div', { class: 'adj-val' }, h('span', { id: 'bpmv' }, song.bpm + ' BPM')), UI.range({ min: 50, max: 180, value: song.bpm, label: t('Tempo'), oninput: v => { song.bpm = v; $('#bpmv').textContent = v + ' BPM'; tempo.textContent = v + ' BPM'; }, onchange: () => changed() })) }); void s; } }, song.bpm + ' BPM');
    info.textContent = keyText();
    const transport = h('div', { class: 'transport' }, playB, pos, h('div', { style: { display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' } }, info, tempo), h('div', { class: 'meter', style: { flexBasis: '100%' } }, meter));
    const content = h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' } }, transport, h('div', { style: { flex: 1, position: 'relative' } }, parts));
    const scr = UI.screen({ title: rec.name, content, actions: [ib('save', t('Save as WAV'), () => this.export(rec, 'save')), ib('share', t('Share'), () => this.export(rec, 'share')),
      ib('more', t('More'), () => UI.menu(rec.name, [{ label: t('Rename'), icon: 'edit', run: async () => { const n = await UI.ask(t('Rename'), rec.name); if (n && n.trim()) { rec.name = n.trim(); scr.setTitle(rec.name); save(); } } },
        { label: t('Song length'), icon: 'bars', sub: plural(song.bars, '1 bar', '{n} bars'), run: () => UI.menu(t('Song length'), [1, 2, 4, 8, 16, 32].map(n => ({ label: plural(n, '1 bar', '{n} bars'), run: () => { song.bars = n; changed(); } }))) }]))],
      onclose: () => { Player.stop(); Player.onstop = null; clearTimeout(saveT); this.store(rec); this.songs.sort((a, b) => b.updated - a.updated); this.render(); cancelAnimationFrame(raf); } });
    let raf = 0;
    const tick = () => { const p = Player.now(), step = Math.floor(p / stepDur(song)); pos.replaceChildren(h('small', {}, t('Bar').toUpperCase()), `${Math.floor(step / STEPS) + 1}.${Math.floor((step % STEPS) / 4) + 1}`); meter.style.width = (Player.level() * 100) + '%'; raf = requestAnimationFrame(tick); };
    const draw = () => {
      parts.replaceChildren(...song.tracks.map(tr => this.card(song, tr, { changed, draw, edit: () => this.editPart(song, tr, changed, draw) })),
        h('div', { class: 'sec' }, t('Add a part')),
        h('div', { class: 'adds' }, ['drums', 'bass', 'chords', 'melody'].map(r => h('button', { class: 'btn', onclick: async () => { this.newTrack(song, r); await Samples.need(song); changed(); draw(); } }, '+ ' + t(ROLES[r].name))),
          h('button', { class: 'btn', onclick: () => this.record(song, () => { changed(); draw(); }) }, icon('mic'), t('Voice'))));
    };
    draw(); setPlay(); tick();
    if (autoplay && song.tracks.length) { Player.play(0); setPlay(); }
  },
  card(song, tr, { changed, draw, edit }) {
    const c = h('div', { class: 'part' + (tr.mute ? ' muted' : '') }); c.style.setProperty('--c', ROLES[tr.role].color);
    const prev = h('canvas', { class: 'prev', 'aria-hidden': 'true' });
    const head = h('div', { class: 'phead' }, h('button', { class: 'who', onclick: edit, 'aria-label': t('Edit') + ' ' + this.label(tr) }, h('b', {}, this.label(tr)), h('small', {}, this.instName(tr))),
      tr.role !== 'audio' ? ib('sparkle', t('New idea'), async () => { Gen.fill(song, tr); changed(); draw(); }) : null,
      ib(tr.mute ? 'mute' : 'vol', tr.mute ? t('Unmute') : t('Mute'), () => { tr.mute = !tr.mute; changed(); draw(); }, { 'aria-pressed': String(!!tr.mute) }),
      tr.role === 'audio' ? ib('trash', t('Remove part'), async () => { if (await UI.confirm(t('Remove part'), t('This cannot be undone.'))) { for (const cl of tr.clips) await DB.del('files', cl.buf); song.tracks.splice(song.tracks.indexOf(tr), 1); changed(); draw(); } }) : ib('edit', t('Edit'), edit));
    const vol = h('div', { class: 'vol' }, icon('vol'), UI.range({ min: 0, max: 1, step: .01, value: tr.vol ?? .8, label: t('Volume') + ' ' + this.label(tr), oninput: v => { tr.vol = v; Player.rig && Player.rig.sync(song); }, onchange: () => changed() }));
    c.append(head, prev, vol);
    requestAnimationFrame(() => this.preview(prev, song, tr));
    return c;
  },
  /* a little picture of the riff (or the recording) */
  preview(cv, song, tr) {
    const r = cv.getBoundingClientRect(), k = devicePixelRatio || 1; cv.width = r.width * k; cv.height = r.height * k; const x = cv.getContext('2d'), W = cv.width, H = cv.height, col = ROLES[tr.role].color;
    if (tr.role === 'audio') {     // each recording where it sits in the song
      const total = Math.max(songDur(song), ...(tr.clips || []).map(c => c.start + c.dur));
      for (const c of tr.clips || []) { const b = Player.bufs.get(c.buf); if (!b) continue; const part = canvas(Math.max(2, W * c.dur / total), H); drawWave(part, b, c.off, c.dur, col); x.drawImage(part, W * c.start / total, 0); }
      return;
    }
    const len = (tr.len || 1) * STEPS, sw = W / len;
    if (tr.type === 'drums') { const rows = KIT.map(k => k[0]), rh = H / rows.length; x.fillStyle = col; rows.forEach((name, i) => (tr.steps[name] || []).forEach((on, s) => { if (on) x.fillRect(s * sw + 1, i * rh + 1, Math.max(2, sw - 2), Math.max(2, rh - 2)); })); return; }
    const notes = trackNotes(song, tr), lo = notes[0], hi = notes[notes.length - 1], rh = H / (hi - lo + 1);
    x.fillStyle = col; for (const n of tr.notes) x.fillRect(n.s * sw + 1, H - (n.n - lo + 1) * rh, Math.max(2, n.d * sw - 2), Math.max(2, rh));
  },
  keySheet(song, then) {
    const s = UI.sheet({ title: t('Key'), body: h('div', {},
      h('div', { class: 'chips', style: { flexWrap: 'wrap' } }, NOTE_NAMES.map((n, i) => h('button', { class: 'chip', 'aria-pressed': String(song.key === i), onclick: () => { song.key = i; s.close(); then(); } }, n))),
      h('div', { class: 'sec' }, t('Scale')),
      h('div', { class: 'menu-list', style: { margin: '0 -20px' } }, Object.entries(SCALE_NAMES).map(([k, label]) => h('button', { 'aria-pressed': String(song.scale === k), onclick: () => { song.scale = k; s.close(); then(); } }, song.scale === k ? icon('check') : h('span', { style: { width: '24px' } }), label)))) });
  },

  /* ---- one part, full screen: the grid of steps */
  editPart(song, tr, changed, redrawSong) {
    if (tr.role === 'audio') return this.clips(song, tr, changed, redrawSong);
    let noteLen = 2;
    const roll = h('div', { class: 'roll' }), bar = h('div', { class: 'ctx' }), tip = h('p', { style: { margin: '0', padding: '6px 14px', color: 'var(--dim)', fontSize: '14px' } }, t('Tap a square to add a note, tap it again to remove it.'));
    const scr = UI.screen({ title: this.label(tr), content: h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' } }, bar, tip, h('div', { style: { flex: 1, position: 'relative' } }, roll)),
      actions: [ib(Player.playing ? 'stop' : 'play', t('Play'), function () { Player.playing ? Player.stop() : Player.play(); this.replaceChildren(icon(Player.playing ? 'stop' : 'play', true)); }, { fill: true }), ib('sparkle', t('New idea'), () => { Gen.fill(song, tr); changed(); draw(); })],
      onclose: () => { cancelAnimationFrame(raf); redrawSong(); } });
    roll.style.setProperty('--c', ROLES[tr.role].color);
    const chips = () => {
      const lens = [1, 2, 4].map(n => h('button', { class: 'chip', 'aria-pressed': String(tr.len === n), onclick: () => { if (tr.notes) tr.notes = tr.notes.filter(k => k.s < n * STEPS); if (tr.steps) for (const k of Object.keys(tr.steps)) tr.steps[k] = (tr.steps[k] || []).slice(0, n * STEPS); tr.len = n; changed(); draw(); } }, plural(n, '1 bar', '{n} bars')));
      const items = [];
      if (tr.type === 'drums') items.push(h('button', { class: 'chip', onclick: () => UI.menu(t('Kit'), Object.entries(KITS).map(([k, kit]) => ({ label: kit.name, sub: tr.kit === k ? '✓' : '', run: () => { tr.kit = k; changed(); chips(); } }))) }, icon('drum'), (KITS[tr.kit] || KITS.studio).name));
      else items.push(h('button', { class: 'chip', onclick: () => this.instruments(song, tr, () => { changed(); chips(); }) }, icon('music'), (INSTR[tr.preset] || {}).name),
        h('button', { class: 'chip', onclick: () => UI.menu(t('Note length'), [[1, '1/16'], [2, '1/8'], [4, '1/4'], [8, '1/2'], [16, '1']].map(([n, l]) => ({ label: l, sub: noteLen === n ? '✓' : '', run: () => { noteLen = n; chips(); } }))) }, t('Note length') + ' ' + ({ 1: '1/16', 2: '1/8', 4: '1/4', 8: '1/2', 16: '1' })[noteLen]));
      items.push(h('span', { class: 'hint' }, t('Riff length')), ...lens, h('button', { class: 'chip', onclick: () => this.mixer(song, tr, changed) }, icon('sliders'), t('Volume')));
      bar.replaceChildren(...items);
    };
    const CW = 34, RH = tr.type === 'drums' ? 44 : 38;
    let head = null, cols = 0;
    const draw = () => {
      cols = (tr.len || 1) * STEPS;
      const rows = tr.type === 'drums' ? KIT.map(([k, label]) => ({ key: k, label })) : trackNotes(song, tr).map((n, i) => ({ key: n, label: NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1), root: i % SCALES[song.scale].length === 0 })).reverse();
      const wrap = h('div', { class: 'gridwrap', style: { gridTemplateColumns: `68px repeat(${cols}, ${CW}px)`, gridAutoRows: RH + 'px' } });
      const on = (r, s) => tr.type === 'drums' ? !!(tr.steps[r.key] || [])[s] : tr.notes.find(n => n.n === r.key && s >= n.s && s < n.s + n.d);
      for (const r of rows) {
        wrap.append(h('button', { class: 'lab' + (r.root ? ' root' : ''), onclick: () => Player.tap(tr, r.key) }, tr.type === 'drums' ? t(r.label) : r.label));
        for (let s = 0; s < cols; s++) {
          const hit = on(r, s), cls = 'cell' + (s % STEPS === 0 ? ' bar' : s % 4 === 0 ? ' beat' : '') + (Math.floor(s / 4) % 2 ? ' alt' : '') + (hit ? ' on' : '');
          wrap.append(h('button', { class: cls, 'aria-pressed': String(!!hit), 'aria-label': `${tr.type === 'drums' ? r.label : r.label}, ${Math.floor(s / STEPS) + 1}.${s % STEPS + 1}`, onclick: () => toggle(r, s) }));
        }
      }
      head = h('div', { class: 'head' }); wrap.append(head);
      const sx = roll.scrollLeft, sy = roll.scrollTop; roll.replaceChildren(wrap); roll.scrollLeft = sx; roll.scrollTop = sy;
    };
    const toggle = (r, s) => {
      if (tr.type === 'drums') { const row = tr.steps[r.key] = tr.steps[r.key] || Array(cols).fill(false); row[s] = !row[s]; if (row[s]) Player.tap(tr, r.key); }
      else {
        const n = tr.notes.find(k => k.n === r.key && s >= k.s && s < k.s + k.d);
        if (n) tr.notes.splice(tr.notes.indexOf(n), 1);
        else { const d = Math.min(noteLen, cols - s), next = tr.notes.filter(k => k.n === r.key && k.s > s).reduce((m, k) => Math.min(m, k.s), Infinity); tr.notes.push({ s, d: Math.max(1, Math.min(d, next - s)), n: r.key }); Player.tap(tr, r.key); }
      }
      changed(); draw();
    };
    let raf = 0;
    const follow = () => { if (head) { if (Player.playing) { const step = (Player.now() / stepDur(song)) % cols; head.style.display = 'block'; head.style.left = 68 + step * CW + 'px'; } else head.style.display = 'none'; } raf = requestAnimationFrame(follow); };
    chips(); draw(); follow(); void scr;
  },
  instruments(song, tr, then) {
    const list = Object.entries(INSTR).filter(([k]) => k !== 'sample');
    UI.menu(t('Instrument'), list.map(([k, d]) => ({ label: d.name, sub: tr.preset === k ? '✓' : '', run: async () => { tr.preset = k; await Samples.need(song); Player.tap(tr, trackNotes(song, tr)[7]); then(); } })));
  },
  mixer(song, tr, changed) {
    const S = (label, key, min, max, def) => h('label', { class: 'field' }, h('span', {}, t(label)), UI.range({ min, max, step: .01, value: tr[key] ?? def, def, label: t(label), oninput: v => { tr[key] = v; Player.rig && Player.rig.sync(song); }, onchange: () => changed() }));
    UI.sheet({ title: this.label(tr), body: h('div', {}, S('Volume', 'vol', 0, 1, .8), S('Pan', 'pan', -1, 1, 0), S('Echo', 'echo', 0, .8, 0), S('Room', 'room', 0, 1, 0)) });
  },
  clips(song, tr, changed, redraw) {
    const list = h('div', { class: 'list' });
    const draw = () => list.replaceChildren(...tr.clips.map(c => { const cv = h('canvas', { 'aria-hidden': 'true' }), b = Player.bufs.get(c.buf); requestAnimationFrame(() => { const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; if (b) drawWave(cv, b, c.off, c.dur, ROLES.audio.color); });
      return h('div', { class: 'clipbar' }, h('small', { style: { width: '48px', color: 'var(--dim)', fontWeight: 800 } }, t('Bar') + ' ' + (Math.round(c.start / (stepDur(song) * STEPS)) + 1)), cv,
        ib('trash', t('Delete'), async () => { tr.clips.splice(tr.clips.indexOf(c), 1); await DB.del('files', c.buf); if (!tr.clips.length) song.tracks.splice(song.tracks.indexOf(tr), 1); changed(); s.close(); redraw(); })); }));
    draw();
    const s = UI.sheet({ title: t('Voice'), body: h('div', {}, list, h('button', { class: 'btn wide', style: { marginTop: '14px' }, onclick: () => { s.close(); this.record(song, () => { changed(); redraw(); }); } }, icon('mic'), t('Record'))) });
  },

  /* ---- your voice: record while the song plays */
  record(song, then) {
    let rec = null, stream = null, startAt = 0, chunks = [];
    const btn = h('button', { class: 'rec', 'aria-label': t('Record') }, t('Record')), state = h('p', { style: { textAlign: 'center', color: 'var(--dim)', margin: '0' } });
    const stop = async () => {
      if (!rec) return; const r = rec; rec = null; btn.classList.remove('on'); btn.textContent = t('Record');
      await new Promise(res => { r.onstop = res; r.stop(); }); Player.stop(); stream.getTracks().forEach(x => x.stop());
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' }), ctx = Player.ready();
      let buf; try { buf = await ctx.decodeAudioData(await blob.arrayBuffer()); } catch (e) { UI.toast(t('Could not save the file.'), 'error'); return; }
      const id = 'rec-' + uid(); await DB.putBlob(id, blob); Player.bufs.set(id, buf);
      const lag = clamp((ctx.baseLatency || 0) + (ctx.outputLatency || 0), 0, .4);     // what we hear is late by the output delay; line the voice up with the music
      let tr = song.tracks.find(x => x.role === 'audio');
      if (!tr) { tr = { id: uid(), role: 'audio', type: 'audio', name: t('Voice'), vol: .9, clips: [] }; song.tracks.push(tr); }
      tr.clips.push({ id: uid(), buf: id, start: startAt, off: Math.min(lag, buf.duration / 2), dur: Math.max(.1, buf.duration - lag), gain: 1 });
      const need = Math.ceil((startAt + buf.duration) / (stepDur(song) * STEPS) - 1e-6); if (need > song.bars) song.bars = Math.min(64, need);
      s.close(); then();
    };
    btn.onclick = async () => {
      if (rec) return stop();
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch (e) { UI.toast(t('Opia needs the microphone to record.'), 'error'); return; }
      chunks = []; rec = new MediaRecorder(stream); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      await Samples.need(song); Player.loop = false; Player.play(0); startAt = Player.now(); rec.start(); btn.classList.add('on'); btn.textContent = t('Stop'); state.textContent = t('Recording') + '…';
    };
    const s = UI.sheet({ title: t('Record your voice'), body: h('div', {}, h('p', { style: { marginTop: 0, color: 'var(--dim)' } }, t('The song plays while you record, so you can sing along. Headphones stop the music leaking into the recording.')), btn, state),
      onclose: () => { if (rec) { rec.stop(); stream.getTracks().forEach(x => x.stop()); Player.stop(); } Player.loop = true; } });
  },

  async export(rec, how) {
    const done = UI.busy(t('Mixing the song…')); let blob;
    try { await this.loadClips(rec.song); blob = new Blob([encodeWav(await renderSong(rec.song, Player.bufs))], { type: 'audio/wav' }); }
    catch (e) { console.error(e); UI.toast(t('Could not save the file.'), 'error'); return; } finally { done(); }
    const name = safeName(rec.name) + '.wav'; how === 'share' ? Native.share(blob, name, 'audio/wav') : Native.save(blob, name, 'audio/wav', 'music');
  },
};
