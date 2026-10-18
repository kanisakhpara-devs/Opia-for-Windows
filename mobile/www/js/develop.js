'use strict';
/* Lens develop engine: turns a photo plus a set of edits into pixels. The edits are only numbers, so the original
   photo is never touched, and the same numbers make a small preview or the full-size copy. */

const DEV_ADJ = [
  // [key, label, min, max, group]
  ['exp', 'Exposure', -2, 2, 'light'], ['con', 'Contrast', -100, 100, 'light'], ['hi', 'Highlights', -100, 100, 'light'], ['sh', 'Shadows', -100, 100, 'light'],
  ['wh', 'Whites', -100, 100, 'light'], ['bl', 'Blacks', -100, 100, 'light'], ['warm', 'Warmth', -100, 100, 'colour'], ['tint', 'Tint', -100, 100, 'colour'],
  ['vib', 'Vibrance', -100, 100, 'colour'], ['sat', 'Saturation', -100, 100, 'colour'], ['fade', 'Fade', 0, 100, 'effects'], ['vig', 'Vignette', -100, 100, 'effects'],
  ['sharp', 'Sharpen', 0, 100, 'effects'], ['grain', 'Grain', 0, 100, 'effects'],
];
const DEV_ICON = { exp: 'sparkle', con: 'compare', hi: 'sparkle', sh: 'compare', wh: 'sparkle', bl: 'compare', warm: 'sparkle', tint: 'sparkle', vib: 'wand', sat: 'wand', fade: 'layers', vig: 'fit', sharp: 'crop', grain: 'bars' };
const DEV_FILTERS = {
  none: {}, vivid: { vib: 35, sat: 10, con: 15 }, warm: { warm: 30, vib: 10, con: 5 }, cool: { warm: -25, tint: -6, con: 5 },
  punch: { con: 35, vib: 30, sh: 15, vig: -20 }, golden: { warm: 38, exp: .1, hi: -20, sh: 20, vib: 15 }, matte: { fade: 35, con: -15, sat: -10 },
  faded: { fade: 45, sat: -25, warm: 10 }, mono: { sat: -100, con: 15 }, noir: { sat: -100, con: 45, bl: -30, vig: -35 },
};
const DEV_FILTER_NAMES = { none: 'None', vivid: 'Vivid', warm: 'Warm', cool: 'Cool', punch: 'Punch', golden: 'Golden', matte: 'Matte', faded: 'Faded', mono: 'Mono', noir: 'Noir' };

const Develop = {
  blank() { return { rot: 0, flip: false, ang: 0, crop: null, filter: 'none' }; },
  /* true when the edits change anything at all */
  edited(p) { return !!p && (DEV_ADJ.some(([k]) => p[k]) || p.rot || p.flip || p.ang || !!p.crop); },
  /* size of the result before any shrinking: the crop, in the turned photo */
  outSize(src, p) {
    const turned = (p.rot || 0) % 180 !== 0, ow = turned ? src.height : src.width, oh = turned ? src.width : src.height, c = p.crop || { x: 0, y: 0, w: 1, h: 1 };
    return { ow, oh, w: c.w * ow, h: c.h * oh, c };
  },
  /* the whole photo turned and flipped, no crop: what the crop tool shows */
  oriented(src, p, maxSide) {
    const { ow, oh } = this.outSize(src, p), k = Math.min(1, maxSide / Math.max(ow, oh)), cv = canvas(ow * k, oh * k), x = cv.getContext('2d');
    x.translate(cv.width / 2, cv.height / 2); if (p.flip) x.scale(-1, 1); x.rotate((p.rot || 0) * Math.PI / 180);
    const sw = src.width * k, sh = src.height * k; x.drawImage(src, -sw / 2, -sh / 2, sw, sh); return cv;
  },
  /* src: ImageBitmap or canvas. maxSide: longest side of the result (Infinity for full size). */
  render(src, p, maxSide = Infinity, opts = {}) {
    p = p || {}; const { ow, oh, w, h: hh, c } = this.outSize(src, p), k = Math.min(1, maxSide / Math.max(w, hh));
    const cv = canvas(w * k, hh * k), x = cv.getContext('2d', { willReadFrequently: true }), a = (opts.noGeo ? 0 : p.ang || 0) * Math.PI / 180;
    const cover = a ? Math.cos(Math.abs(a)) + Math.sin(Math.abs(a)) * Math.max(w / hh, hh / w) : 1;
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingQuality = 'high';
    x.translate(cv.width / 2, cv.height / 2); x.scale(k * cover, k * cover); x.rotate(a);
    x.translate(-(c.x + c.w / 2) * ow, -(c.y + c.h / 2) * oh);
    x.translate(ow / 2, oh / 2); if (p.flip) x.scale(-1, 1); x.rotate((p.rot || 0) * Math.PI / 180);
    x.drawImage(src, -src.width / 2, -src.height / 2);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (DEV_ADJ.some(([key]) => p[key])) this.tone(x, cv.width, cv.height, p);
    return cv;
  },
  /* one pass over the pixels for light, colour and effects */
  tone(x, w, hh, p) {
    const img = x.getImageData(0, 0, w, hh), d = img.data, n = w * hh;
    const lut = new Float32Array(256), hs = new Float32Array(256);
    const e = Math.pow(2, p.exp || 0), con = (p.con || 0) / 100, wh = (p.wh || 0) / 100, bl = (p.bl || 0) / 100, fade = (p.fade || 0) / 100;
    for (let i = 0; i < 256; i++) {
      let v = i / 255;
      v = Math.pow(Math.pow(v, 2.2) * e, 1 / 2.2);                                          // exposure, in light rather than in pixel values
      if (v > .8) v = .8 + .2 * Math.tanh((v - .8) / .2);                                  // bright parts roll off instead of clipping hard
      v += wh * .25 * v * v * v; v += bl * .2 * (1 - v) * (1 - v) * (1 - v);
      v = clamp(v, 0, 1);
      const s = v * v * (3 - 2 * v); v = con >= 0 ? v + (s - v) * con * 1.3 : v + (.5 + (v - .5) * .45 - v) * -con;
      v = fade * .16 + v * (1 - fade * .24);
      lut[i] = clamp(v, 0, 1) * 255;
    }
    const hi = (p.hi || 0) / 100, sh = (p.sh || 0) / 100;
    for (let i = 0; i < 256; i++) { const L = Math.max(i / 255, 1 / 255); let L2 = L + sh * .45 * (1 - L) * (1 - L) * Math.sqrt(L) + hi * .4 * L * L * Math.sqrt(1 - L); L2 = clamp(L2, 0, 1); hs[i] = L2 / L; }
    const warm = (p.warm || 0) / 100, tint = (p.tint || 0) / 100, rM = 1 + warm * .14, bM = 1 - warm * .14, gM = 1 - tint * .1;
    const sat = 1 + (p.sat || 0) / 100, vib = (p.vib || 0) / 100, vig = (p.vig || 0) / 100, grain = (p.grain || 0) / 100 * 34;
    const cx = w / 2, cy = hh / 2, dx = new Float32Array(w); for (let i = 0; i < w; i++) dx[i] = ((i - cx) / cx) ** 2;
    let seed = 1234567;
    for (let y = 0, o = 0; y < hh; y++) {
      const dy = ((y - cy) / cy) ** 2;
      for (let xx = 0; xx < w; xx++, o += 4) {
        let r = lut[d[o]], g = lut[d[o + 1]], b = lut[d[o + 2]];
        const L = .2126 * r + .7152 * g + .0722 * b, k = hs[L | 0]; r *= k; g *= k; b *= k;
        r *= rM; g *= gM; b *= bM;
        if (sat !== 1 || vib) {
          const l2 = .2126 * r + .7152 * g + .0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), s0 = mx > 0 ? (mx - mn) / mx : 0;
          const f = sat * (1 + vib * (1 - s0) * 1.1); r = l2 + (r - l2) * f; g = l2 + (g - l2) * f; b = l2 + (b - l2) * f;
        }
        if (vig) { const dd = (dx[xx] + dy) / 2, f = 1 + vig * .85 * dd * Math.sqrt(dd); r *= f; g *= f; b *= f; }
        if (grain) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; const gr = ((seed >>> 0) / 4294967296 - .5) * grain; r += gr; g += gr; b += gr; }
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
      }
    }
    if (p.sharp) this.sharpen(d, w, hh, p.sharp / 100);
    x.putImageData(img, 0, 0);
  },
  /* unsharp mask with a small blur */
  sharpen(d, w, hh, amt) {
    const src = new Uint8ClampedArray(d), k = amt * 1.2;
    for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const i = o + c, blur = (src[i - 4] + src[i + 4] + src[i - w * 4] + src[i + w * 4] + src[i] * 4) / 8;
        d[i] = src[i] + (src[i] - blur) * k;
      }
    }
  },
};
