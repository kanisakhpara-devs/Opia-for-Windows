'use strict';
/* Opia for phones: the small helpers every workspace uses. Elements, icons, words, storage, sheets, saving and sharing. */

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

/* h('div', { class, onclick, style: {…} }, kids…) */
function h(tag, attrs, ...kids) {
  const el = tag === 'svg' || tag === 'path' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && !(el instanceof SVGElement) && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/* ---- icons: simple strokes on a 24 grid */
const ICONS = {
  plus: 'M12 5v14M5 12h14', back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5',
  more: 'M12 6h.01M12 12h.01M12 18h.01', heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6', save: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14', trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3', sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  crop: 'M7 3v14h14M3 7h14v14', rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4', flip: 'M12 3v18M8 7L3 17h5zM16 7l5 10h-5z', sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6', brush: 'M14.5 4.5l5 5-8 8-5-5zM6.5 12.5C4 13 3.5 16 3 20c4-.5 7-1 7.5-3.5', sticker: 'M20 12a8 8 0 11-8-8h8zM9 10h.01M15 10h.01M9 15c1.5 1.5 4.5 1.5 6 0',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0122 12a17 17 0 01-2.5 3.4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 004.4-1.1M9.9 9.9a3 3 0 004.2 4.2',
  up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', copy: 'M8 8h12v12H8zM4 16V4h12', pen: 'M3 21l3.5-1L19 7.5 16.5 5 4 17.5zM14 7.5l2.5 2.5',
  marker: 'M9 15l-4 4h6l1.5-1.5M9 15l7.5-7.5 3 3L12 18M9 15l3 3', sign: 'M3 17c3-1 4-9 6-9s-1 9 1 9 3-4 4-4 1 3 3 3 2-1 4-1M3 21h18', pages: 'M8 3h9l3 3v12H8zM4 7v14h12',
  form: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5', play: 'M7 4.5v15l12.5-7.5z', stop: 'M6 6h12v12H6z', mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  drum: 'M4 9c0-2 3.6-3.5 8-3.5S20 7 20 9v6c0 2-3.6 3.5-8 3.5S4 17 4 15zM4 9c0 2 3.6 3.5 8 3.5S20 11 20 9M14 3l-3 7', music: 'M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6', vol: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4', compare: 'M12 3v18M5 6h4M5 18h4M15 6l4 6-4 6', wand: 'M4 20L16 8M14 4v2M18 8h2M18 4l-1.5 1.5M12 6l2 2', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  minus: 'M5 12h14', erase: 'M8 20h12M5.5 14.5l8-8 5 5-6 6H9z', bars: 'M5 20V10M10 20V4M15 20v-7M20 20v-11',
};
function icon(name, fill) {
  const s = h('svg', { class: 'i' + (fill ? ' fill' : ''), viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  s.append(h('path', { d: ICONS[name] || '' })); return s;
}
/* an icon button with a spoken name */
const ib = (name, label, onclick, extra = {}) => h('button', { class: 'ib', 'aria-label': label, title: label, onclick, ...extra }, icon(name, extra.fill));

/* ---- words: English in the code, Spanish here */
const ES = {
  'Lens': 'Lens', 'Imagine': 'Imagine', 'Folio': 'Folio', 'Groove': 'Groove',
  'Settings': 'Ajustes', 'Language': 'Idioma', 'Theme': 'Tema', 'Like the phone': 'Como el teléfono', 'Dark': 'Oscuro', 'Light': 'Claro', 'About Opia': 'Acerca de Opia',
  'Cancel': 'Cancelar', 'Done': 'Hecho', 'Delete': 'Eliminar', 'Save': 'Guardar', 'Share': 'Compartir', 'Rename': 'Cambiar nombre', 'Close': 'Cerrar', 'Back': 'Atrás', 'More': 'Más', 'OK': 'Aceptar', 'Reset': 'Restablecer', 'Undo': 'Deshacer', 'Redo': 'Rehacer',
  'Saved to {where}': 'Guardado en {where}', 'Could not save the file.': 'No se pudo guardar el archivo.', 'Working…': 'Trabajando…', 'Name': 'Nombre', 'Delete for good?': '¿Eliminar para siempre?', 'This cannot be undone.': 'No se puede deshacer.',
  'Storage used': 'Almacenamiento usado', 'Everything stays on this phone.': 'Todo se queda en este teléfono.',
  // Lens
  'Your photos, sorted and developed': 'Tus fotos, ordenadas y reveladas', 'Bring in photos from your phone. Rate them, keep favourites, and develop them. The original is never changed.': 'Trae fotos de tu teléfono. Puntúalas, guarda favoritas y revélalas. El original nunca cambia.',
  'Add photos': 'Añadir fotos', 'All': 'Todas', 'Favourites': 'Favoritas', 'Rated': 'Puntuadas', 'Edited': 'Editadas', '{n} photos': '{n} fotos', '1 photo': '1 foto', 'Nothing here yet.': 'Aún no hay nada aquí.',
  'Favourite': 'Favorita', 'Rate': 'Puntuar', 'Edit': 'Editar', 'Save copy': 'Guardar copia', 'Remove from Opia': 'Quitar de Opia', 'The photo stays in your gallery; only Opia\'s copy and edits go.': 'La foto sigue en tu galería; solo se quitan la copia y los cambios de Opia.',
  'Adjust': 'Ajustar', 'Filters': 'Filtros', 'Crop': 'Recortar', 'Hold to compare': 'Mantén para comparar', 'Original': 'Original',
  'Exposure': 'Exposición', 'Contrast': 'Contraste', 'Highlights': 'Luces', 'Shadows': 'Sombras', 'Whites': 'Blancos', 'Blacks': 'Negros', 'Warmth': 'Calidez', 'Tint': 'Matiz', 'Vibrance': 'Intensidad', 'Saturation': 'Saturación', 'Fade': 'Desvanecer', 'Vignette': 'Viñeta', 'Grain': 'Grano', 'Sharpen': 'Nitidez',
  'None': 'Ninguno', 'Vivid': 'Vivo', 'Warm': 'Cálido', 'Cool': 'Frío', 'Matte': 'Mate', 'Mono': 'Mono', 'Noir': 'Noir', 'Golden': 'Dorado', 'Faded': 'Antiguo', 'Punch': 'Fuerte',
  'Free': 'Libre', 'Square': 'Cuadrado', 'Straighten': 'Enderezar', 'Rotate': 'Girar', 'Flip': 'Voltear', 'Saving the full-size photo…': 'Guardando la foto a tamaño completo…', 'Edits kept': 'Cambios guardados',
  'Reset all edits': 'Quitar todos los cambios', 'Importing…': 'Importando…', 'Some files could not be read as pictures.': 'Algunos archivos no se pudieron leer como imágenes.',
  // Imagine
  'Layers, text and stickers': 'Capas, texto y pegatinas', 'Start from a photo or a blank page, then add text, stickers and drawings on top.': 'Empieza con una foto o una página en blanco y añade texto, pegatinas y dibujos encima.',
  'New picture': 'Nueva imagen', 'From a photo': 'Desde una foto', 'Post': 'Publicación', 'Story': 'Historia', 'Wide': 'Panorámica', 'Untitled': 'Sin título',
  'Photo': 'Foto', 'Text': 'Texto', 'Sticker': 'Pegatina', 'Draw': 'Dibujar', 'Layers': 'Capas', 'Export': 'Exportar', 'Tap a layer to pick it. Drag to move, pinch to resize and turn.': 'Toca una capa para elegirla. Arrastra para mover, pellizca para cambiar tamaño y girar.',
  'Font': 'Fuente', 'Colour': 'Color', 'Size': 'Tamaño', 'Opacity': 'Opacidad', 'Label': 'Etiqueta', 'Forward': 'Adelante', 'Backward': 'Atrás', 'Duplicate': 'Duplicar', 'Your text': 'Tu texto', 'Type something': 'Escribe algo',
  'Brush': 'Pincel', 'Eraser': 'Borrador', 'Background': 'Fondo', 'Hidden': 'Oculta', 'Drawing': 'Dibujo', 'Save as PNG': 'Guardar como PNG', 'Save as JPEG': 'Guardar como JPEG', 'From Lens': 'Desde Lens', 'From the phone': 'Desde el teléfono',
  // Folio
  'Fill in, sign, rearrange': 'Rellena, firma, reordena', 'Open a PDF to fill in its form, sign it with your finger, add text and highlights, or reorder its pages.': 'Abre un PDF para rellenar su formulario, firmarlo con el dedo, añadir texto y resaltados, o reordenar sus páginas.',
  'Open PDF': 'Abrir PDF', 'Recent': 'Recientes', '{n} pages': '{n} páginas', '1 page': '1 página', 'Sign': 'Firmar', 'Highlight': 'Resaltar', 'Pages': 'Páginas', 'Form': 'Formulario', 'Fill in the form': 'Rellena el formulario',
  'Tap where the text goes.': 'Toca donde va el texto.', 'Tap where the signature goes.': 'Toca donde va la firma.', 'Drag over what to highlight.': 'Arrastra sobre lo que quieras resaltar.', 'Draw with your finger.': 'Dibuja con el dedo.',
  'Sign here': 'Firma aquí', 'Clear': 'Borrar', 'Use this signature': 'Usar esta firma', 'Saved signatures': 'Firmas guardadas', 'New signature': 'Firma nueva', 'This PDF has no form to fill in.': 'Este PDF no tiene formulario.',
  'This PDF is locked with a password, so Opia cannot change it.': 'Este PDF está protegido con contraseña, así que Opia no puede cambiarlo.', 'That file could not be opened as a PDF.': 'Ese archivo no se pudo abrir como PDF.',
  'Move': 'Mover', 'Drag the mark to where it goes.': 'Arrastra la marca a su sitio.', 'Rotate page': 'Girar página', 'Move earlier': 'Mover antes', 'Move later': 'Mover después', 'Delete page': 'Eliminar página', 'Duplicate page': 'Duplicar página', 'Page {n}': 'Página {n}', 'Bigger': 'Más grande', 'Smaller': 'Más pequeño',
  'Some letters are not in the PDF font and were left out.': 'Algunas letras no están en la fuente del PDF y se omitieron.', 'Revert to the original': 'Volver al original', 'Zoom': 'Zoom', 'Apply': 'Aplicar',
  // Groove
  'Riffs that always fit': 'Riffs que siempre encajan', 'A song here is a few short riffs that loop together. Pick a style and Opia writes the first draft; then change whatever you like.': 'Aquí una canción son unos riffs cortos que se repiten juntos. Elige un estilo y Opia escribe el primer borrador; luego cambia lo que quieras.',
  'New song': 'Canción nueva', 'Start me off': 'Empieza por mí', 'Or pick a style': 'O elige un estilo', 'Empty song': 'Canción vacía', 'Drums': 'Batería', 'Bass': 'Bajo', 'Chords': 'Acordes', 'Melody': 'Melodía', 'Voice': 'Voz',
  'New idea': 'Nueva idea', 'Instrument': 'Instrumento', 'Kit': 'Kit', 'Key': 'Tonalidad', 'Scale': 'Escala', 'Tempo': 'Tempo', 'Mute': 'Silenciar', 'Unmute': 'Activar', 'Volume': 'Volumen', 'Pan': 'Panorama', 'Echo': 'Eco', 'Room': 'Sala',
  'Riff length': 'Duración del riff', 'Note length': 'Duración de nota', '{n} bars': '{n} compases', '1 bar': '1 compás', 'Song length': 'Duración de la canción', 'Save as WAV': 'Guardar como WAV',
  'Record your voice': 'Graba tu voz', 'The song plays while you record, so you can sing along. Headphones stop the music leaking into the recording.': 'La canción suena mientras grabas para que cantes encima. Con auriculares la música no se cuela en la grabación.',
  'Record': 'Grabar', 'Stop': 'Parar', 'Opia needs the microphone to record.': 'Opia necesita el micrófono para grabar.', 'Recording': 'Grabando', 'Tap a square to add a note, tap it again to remove it.': 'Toca un cuadro para añadir una nota; tócalo otra vez para quitarla.',
  'Play': 'Reproducir', '1 recording': '1 grabación', '{n} recordings': '{n} grabaciones', 'Kick': 'Bombo', 'Snare': 'Caja', 'Hi-hat': 'Charles', 'Clap': 'Palmas', 'Open hat': 'Charles abierto', 'Tom': 'Tom', 'Rim': 'Aro', 'Shaker': 'Shaker', 'Bar': 'Compás', 'Mixing the song…': 'Mezclando la canción…', 'Add a part': 'Añadir parte', 'Remove part': 'Quitar parte', 'Bright': 'Alegre', 'Moody': 'Melancólico',
};
const I18N = { lang: 'en' };
function t(s, vars) {
  let out = I18N.lang === 'es' && ES[s] ? ES[s] : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace('{' + k + '}', v);
  return out;
}
const plural = (n, one, many) => n === 1 ? t(one) : t(many, { n });

/* ---- settings kept on the phone */
const Prefs = {
  get(k, d) { try { const v = localStorage.getItem('opia-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('opia-' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
};

/* ---- IndexedDB: photos, pictures, PDFs and songs, plus the files they point to */
const DB = {
  STORES: ['photos', 'pictures', 'docs', 'songs', 'files', 'sigs'],
  open() {
    if (!this.p) this.p = new Promise((res, rej) => {
      const r = indexedDB.open('opia', 1);
      r.onupgradeneeded = () => { for (const s of this.STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this.p;
  },
  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction(store, mode), st = tx.objectStore(store), r = fn(st); tx.oncomplete = () => res(r && 'result' in r ? r.result : undefined); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  },
  get(store, id) { return this.tx(store, 'readonly', s => s.get(id)); },
  all(store) { return this.tx(store, 'readonly', s => s.getAll()); },
  put(store, obj) { return this.tx(store, 'readwrite', s => s.put(obj)); },
  del(store, id) { return this.tx(store, 'readwrite', s => s.delete(id)); },
  /* a file (photo, PDF, recording) by id */
  async blob(id) { const r = await this.get('files', id); return r && r.blob; },
  putBlob(id, blob) { return this.put('files', { id, blob }); },
};

/* ---- saving and sharing: through the Android app when there is one, the browser otherwise */
const Native = {
  get on() { return typeof window.OpiaAndroid === 'object'; },
  /* hand a Blob to the Android side in pieces; returns the id it keeps it under */
  async send(blob, name, mime) {
    const A = window.OpiaAndroid, id = A.begin(name, mime), step = 3 * 256 * 1024;
    for (let o = 0; o < blob.size; o += step) {
      const b = new Uint8Array(await blob.slice(o, o + step).arrayBuffer()); let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      if (!A.append(id, btoa(s))) throw new Error('write failed');
    }
    return id;
  },
  /* kind: 'pictures' | 'music' | 'documents' */
  async save(blob, name, mime, kind) {
    const where = { pictures: 'Pictures/Opia', music: 'Music/Opia', documents: 'Download/Opia' }[kind] || 'Download/Opia';
    try {
      if (this.on) { const id = await this.send(blob, name, mime); const ok = window.OpiaAndroid.save(id, kind); if (!ok) throw new Error('save failed'); }
      else { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
      UI.toast(t('Saved to {where}', { where: this.on ? where : 'Downloads' }));
      return true;
    } catch (e) { console.error(e); UI.toast(t('Could not save the file.'), 'error'); return false; }
  },
  async share(blob, name, mime) {
    try {
      if (this.on) { const id = await this.send(blob, name, mime); window.OpiaAndroid.share(id); return; }
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      else await this.save(blob, name, mime);
    } catch (e) { if (e.name !== 'AbortError') UI.toast(t('Could not save the file.'), 'error'); }
  },
};
const safeName = s => (s || 'Opia').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Opia';

/* ---- sheets, menus, toasts and full screens */
const UI = {
  toast(msg, kind) {
    const el = h('div', { class: 'toast' + (kind ? ' ' + kind : '') }, msg); $('#toasts').append(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 320); }, kind === 'error' ? 4200 : 2600);
  },
  /* a bottom sheet; returns { el, close } and closes on the back button */
  sheet({ title, body, acts, onclose, wide }) {
    const scrim = h('div', { class: 'scrim' }), box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
      h('div', { class: 'grab' }), title ? h('div', { class: 'shead' }, h('h2', {}, title), ib('close', t('Close'), () => close())) : null, h('div', { class: 'body' }, body), acts ? h('div', { class: 'acts' }, acts) : null);
    const wrap = h('div', { style: { position: 'absolute', inset: 0 } }, scrim, box); let closed = false;
    const close = (fromBack) => { if (closed) return; closed = true; wrap.remove(); Nav.drop(entry, fromBack); if (onclose) onclose(); };
    const opened = Date.now(); scrim.onclick = () => { if (Date.now() - opened > 450) close(); };     // the click that follows the tap which opened it must not close it
    const entry = Nav.add(() => close(true));
    $('#layer').append(wrap); requestAnimationFrame(() => { const f = box.querySelector('input:not([type=range]), textarea'); if (f && !wide) f.focus(); });
    return { el: box, close: () => close() };
  },
  /* an action sheet: [{ label, icon, run, danger, sub }] */
  menu(title, items, onclose) {
    const s = UI.sheet({ title, onclose, body: h('div', { class: 'menu-list' }, items.filter(Boolean).map(it => h('button', { class: it.danger ? 'danger' : '', onclick: () => { s.close(); it.run(); } }, it.icon ? icon(it.icon) : null, it.label, it.sub ? h('small', {}, it.sub) : null))) });
    s.el.querySelector('.body').style.padding = '0'; return s;
  },
  confirm(title, text, yes = t('Delete'), danger = true) {
    return new Promise(res => { let ok = false; const s = UI.sheet({ title, body: h('p', { style: { margin: '0 0 6px', color: 'var(--dim)' } }, text), onclose: () => res(ok), acts: [h('button', { class: 'btn', onclick: () => s.close() }, t('Cancel')), h('button', { class: 'btn primary' + (danger ? ' danger' : ''), style: danger ? { background: 'var(--danger)', color: '#fff' } : null, onclick: () => { ok = true; s.close(); } }, yes)] }); });
  },
  ask(title, value = '', { multi, label, placeholder } = {}) {
    return new Promise(res => {
      let out = null; const f = h(multi ? 'textarea' : 'input', { value, placeholder: placeholder || '', 'aria-label': label || title, onkeydown: e => { if (e.key === 'Enter' && !multi) { out = f.value; s.close(); } } });
      const s = UI.sheet({ title, body: h('label', { class: 'field' }, label ? h('span', {}, label) : null, f), onclose: () => res(out), acts: [h('button', { class: 'btn', onclick: () => s.close() }, t('Cancel')), h('button', { class: 'btn primary', onclick: () => { out = f.value; s.close(); } }, t('Done'))] });
      setTimeout(() => { f.focus(); f.select && f.select(); }, 60);
    });
  },
  /* a full screen over the workspace: { title, actions, content, foot, dark, onclose } */
  screen({ title, actions = [], content, foot, dark, onclose }) {
    const head = h('h2', {}, title || ''), el = h('section', { class: 'screen' + (dark ? ' dark' : ''), role: 'dialog', 'aria-label': title || '' },
      h('div', { class: 'bar' }, ib('back', t('Back'), () => close()), head, ...actions), h('div', { class: 'content' }, content), foot ? h('div', { class: 'foot' }, foot) : null);
    let closed = false;
    const close = async (fromBack) => {
      if (closed) return; if (onclose && (await onclose()) === false) { if (fromBack) entry = Nav.add(() => close(true)); return; }
      closed = true; el.remove(); Nav.drop(entry, fromBack);
    };
    let entry = Nav.add(() => close(true));
    $('#layer').append(el);
    return { el, close: () => close(), setTitle: s => { head.textContent = s; el.setAttribute('aria-label', s); } };
  },
  busy(msg) {
    const el = h('div', { class: 'busy', role: 'alert', 'aria-busy': 'true' }, h('div', {}, h('span', { class: 'spin' }), msg || t('Working…'))); $('#layer').append(el);
    return () => el.remove();
  },
  /* a labelled slider whose filled part follows the thumb */
  range({ min, max, step = 1, value, oninput, onchange, label, def }) {
    const r = h('input', { type: 'range', min, max, step, value, 'aria-label': label || '' });
    const fill = () => r.style.setProperty('--fill', ((r.value - min) / (max - min) * 100) + '%'); fill();
    r.addEventListener('input', () => { fill(); oninput && oninput(+r.value); });
    if (onchange) r.addEventListener('change', () => onchange(+r.value));
    if (def != null) r.addEventListener('dblclick', () => { r.value = def; fill(); oninput && oninput(def); onchange && onchange(def); });
    r.set = v => { r.value = v; fill(); };
    return r;
  },
};

/* ---- the back button: every sheet and screen takes one history entry, so Android's back closes the top one */
const Nav = {
  stack: [],
  add(fn) { const e = { fn }; this.stack.push(e); history.pushState({ opia: this.stack.length }, ''); return e; },
  drop(e, fromBack) { const i = this.stack.indexOf(e); if (i < 0) return; this.stack.splice(i, 1); if (!fromBack) { this.skip = (this.skip || 0) + 1; history.back(); } },
  init() {
    addEventListener('popstate', () => {
      if (this.skip) { this.skip--; return; }
      const e = this.stack[this.stack.length - 1]; if (e) e.fn();
    });
  },
};

/* ---- files from the phone */
function pickFiles(accept, multiple) {
  return new Promise(res => {
    const old = $('#picker'), inp = old.cloneNode(); old.replaceWith(inp);     // a fresh input, so picking the same file twice still fires
    inp.accept = accept; inp.multiple = !!multiple;
    inp.onchange = () => res([...inp.files]);
    inp.addEventListener('cancel', () => res([]));
    inp.click();
  });
}
async function bitmapOf(blob, maxSide) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  if (!maxSide || Math.max(bmp.width, bmp.height) <= maxSide) return bmp;
  const k = maxSide / Math.max(bmp.width, bmp.height), w = Math.round(bmp.width * k), hh = Math.round(bmp.height * k);
  const small = await createImageBitmap(bmp, { resizeWidth: w, resizeHeight: hh, resizeQuality: 'high' }); bmp.close(); return small;
}
const canvasBlob = (cv, type = 'image/jpeg', q = .92) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('encode failed')), type, q));
function canvas(w, hh) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; }
const fmtDate = ts => new Date(ts).toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short', year: 'numeric' });

/* ---- touch: one finger drags, two fingers pinch and turn. Calls start/move/end with a running gesture. */
function gestures(el, { start, move, end, tap }) {
  const pts = new Map(); let g = null, moved = false, downAt = 0;
  const two = () => { const [a, b] = [...pts.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }; };
  const begin = e => {
    if (pts.size === 1) { const p = [...pts.values()][0]; g = { x0: p.x, y0: p.y, x: p.x, y: p.y, n: 1, e }; }
    else { const s = two(); g = { x0: s.cx, y0: s.cy, x: s.cx, y: s.cy, d0: s.d, a0: s.ang, scale: 1, rot: 0, n: 2, e }; }
    start && start(g);
  };
  el.addEventListener('pointerdown', e => {
    if (pts.size >= 2) return; el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = false; downAt = Date.now(); } else if (g) end && end(g, true);
    begin(e);
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !g) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.n === 1) { const p = pts.get(e.pointerId); g.x = p.x; g.y = p.y; }
    else if (pts.size === 2) { const s = two(); g.x = s.cx; g.y = s.cy; g.scale = s.d / g.d0; g.rot = s.ang - g.a0; }
    if (Math.hypot(g.x - g.x0, g.y - g.y0) > 6 || g.n === 2) moved = true;
    g.e = e; move && move(g);
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (g) { g.e = e; end && end(g, pts.size > 0); }
    if (pts.size === 1) begin(e);       // one finger lifted: carry on with the other
    else if (pts.size === 0) { if (!moved && tap && Date.now() - downAt < 450 && g) tap(g); g = null; }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
