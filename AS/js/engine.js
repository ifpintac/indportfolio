/* American Standard social post maker: drawing engine.
   Brand constants follow the American Standard brand guidelines (v3, global 2.1) and the APAC social media guide. */
const BRAND = { red: '#E4002B', char: '#53565A', white: '#FFFFFF', black: '#000000', gray: '#F1F2F2' };
const FONT = '"Gotham AS", Arial, sans-serif';
const ASSETS = {
  fonts: { light: 'fonts/gotham-light.otf', book: 'fonts/gotham-book.ttf', medium: 'fonts/gotham-medium.ttf', bold: 'fonts/gotham-bold.ttf' },
  logos: { ib: 'img/inline_black.png', iw: 'img/inline_white.png', ibc: 'img/inline_brandclaim.png', iwc: 'img/inline_white_brandclaim.png' }
};

const SIZES = [
  { id: 'square', name: 'Square', where: 'Instagram and Facebook feed', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Portrait', where: 'Instagram and Facebook feed, 4:5', w: 1080, h: 1350 },
  { id: 'story', name: 'Story or Reel', where: 'Instagram, Facebook and TikTok, 9:16', w: 1080, h: 1920 },
  { id: 'landscape', name: 'Link or landscape', where: 'Facebook link, LinkedIn', w: 1200, h: 630 },
  { id: 'wide', name: 'Wide', where: 'X, YouTube, presentations, 16:9', w: 1600, h: 900 }
];
const SIZE = Object.fromEntries(SIZES.map(s => [s.id, s]));

const LOGO = {};       /* brand logos, drawn by the templates */
const ASSET_IMG = {};  /* uploaded stickers and logos, by asset id */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function loadAssets() {
  const defs = [[300, ASSETS.fonts.light], [400, ASSETS.fonts.book], [500, ASSETS.fonts.medium], [700, ASSETS.fonts.bold]];
  await Promise.all(defs.map(async ([w, src]) => { try { const f = new FontFace('Gotham AS', 'url(' + src + ')', { weight: String(w) }); await f.load(); document.fonts.add(f); } catch (e) { /* the fallback font applies */ } }));
  await Promise.all(Object.keys(ASSETS.logos).map(async k => { try { LOGO[k] = await loadImg(ASSETS.logos[k]); } catch (e) { } }));
}

/* ===== Text helpers ===== */
let CUR = null; /* the render in progress, for layout notes (text boxes, logos, readability) */
const PESO = /₱/g;
function font(ctx, wt, px) { ctx.font = wt + ' ' + (Math.round(px * 10) / 10) + 'px ' + FONT; }
/* Gotham has no peso sign, so it is measured as a P and drawn as a P with two bars. */
const mw = (ctx, s) => ctx.measureText(String(s).replace(PESO, 'P')).width;
function fillT(ctx, t, x, y, px, wt) {
  if (t.indexOf('₱') < 0) { ctx.fillText(t, x, y); return; }
  const s = t.replace(PESO, 'P'); ctx.fillText(s, x, y);
  const pw = ctx.measureText('P').width, th = Math.max(1, px * (wt >= 700 ? 0.082 : wt >= 500 ? 0.07 : wt >= 400 ? 0.06 : 0.048)), cap = px * 0.72;
  for (let i = 0; i < t.length; i++) if (t[i] === '₱') { const x0 = x + ctx.measureText(s.slice(0, i)).width; [0.76, 0.56].forEach(k => ctx.fillRect(x0 - pw * 0.12, y - cap * k - th / 2, pw * 1.0, th)); }
}

function wrap(ctx, text, wt, px, maxW) {
  const out = [];
  String(text || '').split('\n').forEach(par => {
    const words = par.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    font(ctx, wt, px);
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (!line || mw(ctx, t) <= maxW) line = t; else { out.push(line); line = w; }
    });
    out.push(line);
  });
  return out;
}

function fit(ctx, text, wt, maxW, maxH, maxPx, minPx, lh, maxLines) {
  text = (text || '').trim();
  if (!text) return { px: Math.round(maxPx), lines: [], ok: true, empty: true, h: 0, lh };
  maxPx = Math.max(maxPx, minPx);
  for (let px = Math.round(maxPx); px >= Math.round(minPx); px -= 2) {
    const lines = wrap(ctx, text, wt, px, maxW); font(ctx, wt, px);
    const w = Math.max(...lines.map(l => mw(ctx, l)));
    const h = lines.length * px * lh;
    if (h <= maxH + 0.5 && w <= maxW + 0.5 && (!maxLines || lines.length <= maxLines)) return { px, lines, ok: true, h, lh };
  }
  const px = Math.round(minPx), lines = wrap(ctx, text, wt, px, maxW);
  return { px, lines, ok: false, h: lines.length * px * lh, lh };
}

function relayout(ctx, text, wt, px, maxW, lh) { const lines = wrap(ctx, text, wt, px, maxW); return { px, lines, ok: true, h: lines.length * px * lh, lh }; }
function widest(ctx, f, wt) { font(ctx, wt, f.px); return f.lines.length ? Math.max(...f.lines.map(l => mw(ctx, l))) : 0; }
/* several short items (features, tips) sharing one font size */
function fitList(ctx, items, wt, maxW, maxH, maxPx, minPx, lh, gapK) {
  const tot = bl => bl.reduce((a, b) => a + b.h, 0) + Math.max(0, bl.length - 1) * bl[0].px * gapK;
  if (!items.length) return { px: Math.round(maxPx), blocks: [], ok: true, h: 0 };
  for (let px = Math.round(maxPx); px >= Math.round(minPx); px -= 2) {
    const bl = items.map(t => relayout(ctx, t, wt, px, maxW, lh));
    if (tot(bl) <= maxH + 0.5 && Math.max(...bl.map(b => widest(ctx, b, wt))) <= maxW + 0.5) return { px, blocks: bl, ok: true, h: tot(bl) };
  }
  const px = Math.round(minPx), bl = items.map(t => relayout(ctx, t, wt, px, maxW, lh));
  return { px, blocks: bl, ok: false, h: tot(bl) };
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function kwRegex(kw) { try { return new RegExp('(?<![\\p{L}\\p{N}])' + esc(kw.trim()) + '(?![\\p{L}\\p{N}])', 'iu'); } catch (e) { return null; } }
function kwFound(text, kw) { kw = (kw || '').trim(); if (!kw) return true; const r = kwRegex(kw); return !!(r && r.test(text || '')); }

/* Readability: how much of the background behind a line has too little contrast with the text colour. */
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function lowContrastShare(ctx, x, y, w, h, color) {
  try {
    const sc = ctx.getTransform().a, X = Math.max(0, Math.floor(x * sc)), Y = Math.max(0, Math.floor(y * sc));
    const Wd = Math.min(ctx.canvas.width - X, Math.ceil(w * sc)), Ht = Math.min(ctx.canvas.height - Y, Math.ceil(h * sc));
    if (Wd < 2 || Ht < 2) return 0;
    const d = ctx.getImageData(X, Y, Wd, Ht).data, Lt = relLum(...hexRgb(color)); let low = 0, n = 0;
    const step = Math.max(1, Math.floor(Wd * Ht / 1200)) * 4;
    for (let i = 0; i < d.length; i += step) { const L = relLum(d[i], d[i + 1], d[i + 2]); if ((Math.max(L, Lt) + 0.05) / (Math.min(L, Lt) + 0.05) < 2.2) low++; n++; }
    return n ? low / n : 0;
  } catch (e) { return 0; }
}

/* draw fitted lines. o: wt, color, align, kw, kws ('underline' | 'bold') */
function drawLines(ctx, f, x, y, o) {
  const px = f.px, lh = f.lh || o.lh || 1.2; let done = false;
  const kw = (o.kw || '').trim(), re = kw ? kwRegex(kw) : null;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let low = 0, nl = 0;
  f.lines.forEach((ln, i) => {
    const base = y + i * px * lh + (px * lh - px) / 2 + px * 0.8;
    let segs = [[ln, false]];
    if (re && !done) {
      const m = re.exec(ln);
      if (m) { segs = [[ln.slice(0, m.index), false], [m[0], true], [ln.slice(m.index + m[0].length), false]].filter(s => s[0] !== ''); done = true; }
    }
    const ws = segs.map(([t, k]) => { font(ctx, k && o.kws === 'bold' ? 700 : o.wt, px); return mw(ctx, t); });
    const tw = ws.reduce((a, b) => a + b, 0);
    let sx = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x;
    if (CUR) { CUR.texts.push({ x: sx, y: base - px * 0.8, w: tw, h: px * 1.05 }); if (CUR.measure && o.color) { low += lowContrastShare(ctx, sx, base - px * 0.75, tw, px * 0.85, o.color); nl++; } }
    segs.forEach(([t, k], j) => {
      const wt = k && o.kws === 'bold' ? 700 : o.wt;
      font(ctx, wt, px); ctx.fillStyle = o.color; fillT(ctx, t, sx, base, px, wt);
      if (k && o.kws === 'underline') { ctx.fillStyle = BRAND.red; ctx.fillRect(sx, base + px * 0.17, ws[j], Math.max(2, px * 0.06)); }
      sx += ws[j];
    });
  });
  if (CUR && nl && low / nl > 0.3) CUR.contrast.push({ color: o.color });
}
/* a line through text, for an old price */
function strike(ctx, f, x, y, wt, color) { const w = widest(ctx, f, wt); ctx.fillStyle = color; f.lines.forEach((l, i) => { const base = y + i * f.px * f.lh + (f.px * f.lh - f.px) / 2 + f.px * 0.8; font(ctx, wt, f.px); ctx.fillRect(x, base - f.px * 0.33, mw(ctx, l), Math.max(2, f.px * 0.07)); }); return w; }

/* Story or Reel: the app's own buttons cover about 13% at the top and 18% at the bottom */
const SAFE = (W, H) => H / W > 1.7 ? { t: H * 0.13, b: H * 0.18 } : { t: 0, b: 0 };
function D(W, H) { const mn = Math.min(W, H); return { u: Math.min(W, 1.25 * H) / 1080, mn, m: Math.round(mn * 0.06), wide: W / H > 1.4, tall: H / W > 1.4 }; }
const clamp01 = v => Math.min(1, Math.max(0, v));
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ===== Photo helpers ===== */
/* slot 1 is the main photo, slot 2 the second photo (before and after). With no saved position the photo centres on its subject. */
function drawPhoto(ctx, p, x, y, w, h, R, slot) {
  slot = slot || 1;
  const im = slot === 2 ? p.img2 : p.img, img = im && im.src;
  if (!img) {
    ctx.fillStyle = '#E3E5E6'; ctx.fillRect(x, y, w, h);
    if (slot === 2) R.noPhoto2 = true; else R.noPhoto = true;
    const info = { slot, x, y, w, h, s: 1, iw: 1, ih: 1, none: true }; R.photos.push(info); if (slot === 1) R.photo = info; return;
  }
  const iw = img.width, ih = img.height, z = Math.max(1, (slot === 2 ? p.zoom2 : p.zoom) || 1);
  const s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s, fo = im.focus || { x: 0.5, y: 0.5 };
  const vx = slot === 2 ? p.fx2 : p.fx, vy = slot === 2 ? p.fy2 : p.fy;
  const fx = clamp01(vx == null ? (iw - sw > 0.5 ? (fo.x * iw - sw / 2) / (iw - sw) : 0.5) : vx);
  const fy = clamp01(vy == null ? (ih - sh > 0.5 ? (fo.y * ih - sh / 2) / (ih - sh) : 0.5) : vy);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h); ctx.restore();
  const info = { slot, x, y, w, h, s, iw, ih, fx, fy }; R.photos.push(info); if (slot === 1) R.photo = info;
  R.minScale = Math.max(R.minScale || 0, s);
  if (im.sample) R.sample = true;
}

/* Where the subject of a photo is: edges and colour, weighted towards the middle. Returns 0..1 coordinates. */
function computeFocus(src) {
  try {
    const S = 72, r = src.width / src.height, w = r >= 1 ? S : Math.max(12, Math.round(S * r)), h = r >= 1 ? Math.max(12, Math.round(S / r)) : S;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h), Sa = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const a = d[i * 4], b = d[i * 4 + 1], cc = d[i * 4 + 2], mx = Math.max(a, b, cc), mn = Math.min(a, b, cc); L[i] = 0.299 * a + 0.587 * b + 0.114 * cc; Sa[i] = mx ? (mx - mn) / mx : 0; }
    const E = new Float32Array(w * h); let emax = 0;
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const i = yy * w + xx, gx = L[i + 1] - L[i - 1], gy = L[i + w] - L[i - w], cx = xx / w - 0.5, cy = yy / h - 0.5;
      const e = (Math.sqrt(gx * gx + gy * gy) + 60 * Sa[i]) * (0.3 + 0.7 * Math.exp(-(cx * cx + cy * cy) / 0.18)); E[i] = e; if (e > emax) emax = e;
    }
    const th = emax * 0.35; let sx = 0, sy = 0, sw = 0;
    for (let i = 0; i < w * h; i++) { const e = E[i] - th; if (e > 0) { sx += (i % w) * e; sy += ((i / w) | 0) * e; sw += e; } }
    if (!sw) return { x: 0.5, y: 0.5 };
    return { x: Math.min(0.92, Math.max(0.08, (sx / sw + 0.5) / w)), y: Math.min(0.92, Math.max(0.08, (sy / sw + 0.5) / h)) };
  } catch (e) { return { x: 0.5, y: 0.5 }; }
}

function scrim(ctx, W, H, pos, a) {
  const g = pos === 'top' ? ctx.createLinearGradient(0, 0, 0, H * 0.55) : ctx.createLinearGradient(0, H, 0, H * 0.45);
  g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, pos === 'top' ? 0 : H * 0.45, W, H * 0.55);
}

function drawLogo(ctx, name, x, y, w, align) {
  const im = LOGO[name]; if (!im) return { w, h: 0 };
  const h = w * im.height / im.width, dx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.drawImage(im, dx, y, w, h); if (CUR) CUR.logos.push({ x: dx, y, w, h }); return { w, h };
}
const logoH = (name, w) => LOGO[name] ? w * LOGO[name].height / LOGO[name].width : 0;

function tagBox(ctx, text, px, plate) {
  font(ctx, 500, px); const tw = mw(ctx, text), bw = Math.max(3, px * 0.13), gap = px * 0.45, bh = px * 1.35, pad = plate ? px * 0.55 : 0;
  return { w: tw + bw + gap + pad * 2, h: bh + pad * 2, tw, bw, gap, bh, pad };
}
function drawTag(ctx, text, px, x, y, o) {
  const t = tagBox(ctx, text, px, o.plate), X = o.align === 'center' ? x - t.w / 2 : o.align === 'right' ? x - t.w : x;
  if (o.plate) { ctx.fillStyle = '#fff'; ctx.fillRect(X, y, t.w, t.h); }
  ctx.fillStyle = o.bar || BRAND.red; ctx.fillRect(X + t.pad, y + t.pad, t.bw, t.bh);
  font(ctx, 500, px); ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  fillT(ctx, text, X + t.pad + t.bw + t.gap, y + t.pad + t.bh / 2 + px * 0.35, px, 500);
  if (CUR) CUR.texts.push({ x: X, y, w: t.w, h: t.h });
  return t;
}

/* Banner that bleeds in from the canvas edge, one font size only (brand rule). */
function drawBanner(ctx, W, H, b, p, o, R) {
  const { u, wide } = D(W, H);
  const maxW = (W - 2 * b) * (wide ? 0.55 : 0.74);
  const f = fit(ctx, p.headline, o.wt, maxW, H * 0.24, 60 * u, 24 * u, 1.22, 2);
  if (f.empty) return null;
  if (!f.ok) R.over.push('Banner text');
  const tw = widest(ctx, f, o.wt), padX = f.px * 0.7, padY = f.px * 0.5, bw = tw + 2 * padX, bh = f.h + 2 * padY;
  const gap = Math.round(Math.min(W, H) * 0.05);
  const right = o.side === 'r';
  const rx = right ? W - b - bw : 0, rw = bw + b;
  const sf = SAFE(W, H), y = o.vy === 'top' ? Math.max(b + gap, sf.t) : Math.min((o.bottom != null ? o.bottom : H - b) - bh - gap, H - sf.b - bh);
  ctx.fillStyle = o.bg; ctx.fillRect(rx, y, rw, bh);
  drawLines(ctx, f, right ? W - b - bw + padX : b + padX, y + padY, { wt: o.wt, color: o.fg, align: 'left', kw: o.kw, kws: 'underline' });
  return { x: rx, y, w: rw, h: bh };
}
/* small print at the bottom of an area (promo terms, permit numbers) */
function drawFine(ctx, W, H, text, x, bottom, maxW, color, R, align) {
  const { u } = D(W, H); if (!(text || '').trim()) return 0;
  const f = fit(ctx, text, 300, maxW, 26 * u * 3.2, 22 * u, 15 * u, 1.28, 3);
  drawLines(ctx, f, x, bottom - f.h, { wt: 300, color, align: align || 'left' }); if (!f.ok) R.over.push('Fine print'); return f.h;
}

/* ===== Templates ===== */
const opt = (id, name, vals) => ({ id, name, values: vals.map(v => ({ id: v[0], name: v[1] })) });

function T_fullbleed(ctx, W, H, p, o, R) {
  const { u, m, wide } = D(W, H);
  drawPhoto(ctx, p, 0, 0, W, H, R);
  const light = o.tone !== 'dark', top = o.layout === 'tl' || o.layout === 'tc';
  if (light) scrim(ctx, W, H, top ? 'top' : 'bottom', 0.42);
  const align = o.layout === 'tc' ? 'center' : o.layout === 'br' ? 'right' : 'left';
  const maxW = W * (wide ? 0.6 : 0.8) - m, col = light ? '#fff' : BRAND.char;
  const h = fit(ctx, p.headline, 400, maxW, H * 0.36, 96 * u, 32 * u, 1.14);
  const s = p.sub && p.sub.trim() ? fit(ctx, p.sub, 300, maxW, H * 0.14, Math.max(24 * u, h.px * 0.45), 18 * u, 1.3) : null;
  const gap = s ? h.px * 0.3 : 0, tot = h.h + gap + (s ? s.h : 0);
  const sf = SAFE(W, H), y = top ? Math.max(m, sf.t + m * 0.4) : H - Math.max(m, sf.b + m * 0.4) - tot, x = align === 'left' ? m : align === 'center' ? W / 2 : W - m;
  drawLines(ctx, h, x, y, { wt: 400, color: col, align, kw: p.keyword, kws: 'underline' });
  if (s) drawLines(ctx, s, x, y + h.h + gap, { wt: 300, color: col, align });
  if (!h.ok) R.over.push('Headline'); if (s && !s.ok) R.over.push('Second line');
}

function T_banner(ctx, W, H, p, o, R) {
  const { mn } = D(W, H), b = Math.round(mn * 0.065);
  const bd = o.border === 'alt' ? ((p.idx || 0) % 2 === 0 ? 'white' : 'red') : o.border;
  ctx.fillStyle = bd === 'red' ? BRAND.red : '#fff'; ctx.fillRect(0, 0, W, H);
  drawPhoto(ctx, p, b, b, W - 2 * b, H - 2 * b, R);
  const red = bd === 'white';
  drawBanner(ctx, W, H, b, p, { wt: 500, bg: red ? BRAND.red : '#fff', fg: red ? '#fff' : BRAND.char, side: o.layout.endsWith('r') ? 'r' : 'l', vy: o.layout.startsWith('t') ? 'top' : 'bot' }, R);
}

function T_tab(ctx, W, H, p, o, R) {
  const { mn } = D(W, H), b = Math.round(mn * 0.065);
  ctx.fillStyle = BRAND.red; ctx.fillRect(0, 0, W, H);
  drawPhoto(ctx, p, b, b, W - 2 * b, H - 2 * b, R);
  drawBanner(ctx, W, H, b, p, { wt: 400, bg: '#fff', fg: BRAND.char, side: o.layout.endsWith('r') ? 'r' : 'l', vy: o.layout.startsWith('t') ? 'top' : 'bot', kw: o.text === 'ul' ? p.keyword : '' }, R);
}

function T_product(ctx, W, H, p, o, R) {
  const { u, mn, wide } = D(W, H), b = Math.round(mn * 0.07), pan = o.panel;
  ctx.fillStyle = pan === 'gray' ? BRAND.gray : pan === 'red' ? BRAND.red : '#fff'; ctx.fillRect(0, 0, W, H);
  const col = pan === 'red' ? '#fff' : BRAND.char, kws = pan === 'red' ? 'bold' : 'underline';
  const centre = o.layout !== 'al', below = o.layout === 'bc';
  let ph, tx, ty, tw, f;
  if (wide) {
    const colW = W * 0.38; tw = colW - b;
    f = fit(ctx, p.headline, 400, tw, H - 2 * b, 62 * u, 26 * u, 1.15);
    ph = { x: colW + b * 0.4, y: b, w: W - colW - b * 1.4, h: H - 2 * b };
    tx = b; ty = b + ((H - 2 * b) - f.h) / 2;
  } else {
    tw = W - 2 * b;
    f = fit(ctx, p.headline, 400, tw, H * 0.2, 66 * u, 26 * u, 1.15, 2);
    const th = f.empty ? 0 : f.h, g = f.empty ? 0 : b * 0.5;
    if (below) { ph = { x: b, y: b, w: W - 2 * b, h: H - 2 * b - th - g }; ty = ph.y + ph.h + g; }
    else { ty = b; ph = { x: b, y: b + th + g, w: W - 2 * b, h: H - 2 * b - th - g }; }
    tx = b;
  }
  drawPhoto(ctx, p, ph.x, ph.y, ph.w, ph.h, R);
  const al = (!wide && centre) ? 'center' : 'left';
  drawLines(ctx, f, al === 'center' ? W / 2 : tx, ty, { wt: 400, color: col, align: al, kw: p.keyword, kws });
  if (!f.ok) R.over.push('Headline');
  if ((p.label || '').trim()) {
    const px = 40 * u, pad = Math.round(mn * 0.03);
    drawTag(ctx, p.label.trim(), px, (centre && !wide) ? ph.x + ph.w / 2 : ph.x + pad, ph.y + pad, { plate: true, color: BRAND.char, align: (centre && !wide) ? 'center' : 'left' });
  }
}

function T_caption(ctx, W, H, p, o, R) {
  const { u, m, wide } = D(W, H);
  drawPhoto(ctx, p, 0, 0, W, H, R);
  const light = o.tone !== 'dark', top = o.layout === 'tl';
  if (light) scrim(ctx, W, H, top ? 'top' : 'bottom', 0.42);
  const col = light ? '#fff' : BRAND.char, maxW = W * (wide ? 0.5 : 0.68) - m;
  const longer = (p.label || '').length >= (p.sub || '').length ? p.label : p.sub;
  const base = fit(ctx, longer, 500, maxW, H * 0.3, 66 * u, 26 * u, 1.18);
  const px = base.px, a = relayout(ctx, p.label, 500, px, maxW, 1.18), c = relayout(ctx, p.sub, 300, px, maxW, 1.18);
  if (!base.ok) R.over.push('Product name');
  const tot = a.h + c.h, align = o.layout === 'bc' ? 'center' : o.layout === 'br' ? 'right' : 'left';
  const x = align === 'left' ? m : align === 'center' ? W / 2 : W - m, y = top ? m : H - m - tot;
  drawLines(ctx, a, x, y, { wt: 500, color: col, align }); drawLines(ctx, c, x, y + a.h, { wt: 300, color: col, align });
  if ((p.tag || '').trim()) {
    const tp = Math.max(18 * u, px * 0.55), onRight = o.layout !== 'br';
    drawTag(ctx, p.tag.trim(), tp, onRight ? W - m : m, H - m - tp * 1.35, { color: col, align: onRight ? 'right' : 'left', bar: BRAND.red });
  }
}

function T_announce(ctx, W, H, p, o, R) {
  const { u, mn, wide } = D(W, H), b = Math.round(mn * 0.07);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const hc = o.tone === 'char' ? BRAND.char : BRAND.red;
  let tx, ty, tw, th, ph = null;
  if (o.layout === 'to') { tx = b; tw = W - 2 * b; th = H - 2 * b; ty = b; }
  else if (wide) { ph = { x: b, y: b, w: W * 0.46, h: H - 2 * b }; tx = ph.x + ph.w + b; tw = W - tx - b; ty = b; th = H - 2 * b; }
  else {
    const ph0 = Math.round((H - 2 * b) * (D(W, H).tall ? 0.5 : 0.56)), gap = b * 0.8;
    if (o.layout === 'pt') { ph = { x: b, y: b, w: W - 2 * b, h: ph0 }; ty = b + ph0 + gap; }
    else { ph = { x: b, y: H - b - ph0, w: W - 2 * b, h: ph0 }; ty = b; }
    tx = b; tw = W - 2 * b; th = H - 2 * b - ph0 - gap;
  }
  if (ph) drawPhoto(ctx, p, ph.x, ph.y, ph.w, ph.h, R);
  const f = fit(ctx, p.headline, 400, tw, th * (p.sub ? 0.62 : 1), 78 * u, 28 * u, 1.15);
  const s = p.sub && p.sub.trim() ? fit(ctx, p.sub, 300, tw, th * 0.34, Math.max(24 * u, f.px * 0.5), 18 * u, 1.3) : null;
  const gap = s ? f.px * 0.35 : 0, tot = f.h + gap + (s ? s.h : 0);
  const center = o.layout === 'to', al = center ? 'center' : 'left';
  const y = (center || wide) ? ty + (th - tot) / 2 : ty + (ph && o.layout === 'pt' ? 0 : (th - tot) / 2);
  const x = al === 'center' ? tx + tw / 2 : tx;
  drawLines(ctx, f, x, o.layout === 'pt' && !wide ? ty : y, { wt: 400, color: hc, align: al });
  if (s) drawLines(ctx, s, x, (o.layout === 'pt' && !wide ? ty : y) + f.h + gap, { wt: 300, color: BRAND.char, align: al });
  if (!f.ok) R.over.push('Message'); if (s && !s.ok) R.over.push('Details');
}

function T_footer(ctx, W, H, p, o, R) {
  const { u, mn, m } = D(W, H), fh = Math.round(mn * 0.125), red = o.footer !== 'white';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  let py = 0;
  const maxW = W - 2 * m;
  if (o.layout === 'st') {
    const f = fit(ctx, p.headline, 400, maxW, H * 0.16, 60 * u, 26 * u, 1.15, 2);
    const sh = f.empty ? 0 : f.h + m * 1.1; py = sh;
    if (!f.empty) { drawLines(ctx, f, m, m * 0.55, { wt: 400, color: BRAND.char, align: 'left', kw: p.keyword, kws: 'underline' }); if (!f.ok) R.over.push('Headline'); }
  }
  drawPhoto(ctx, p, 0, py, W, H - fh - py, R);
  if (o.layout === 'ov') {
    scrim(ctx, W, H - fh, 'top', 0.4);
    const f = fit(ctx, p.headline, 400, W * 0.8 - m, H * 0.3, 80 * u, 30 * u, 1.14);
    drawLines(ctx, f, m, m, { wt: 400, color: '#fff', align: 'left', kw: p.keyword, kws: 'underline' }); if (!f.ok) R.over.push('Headline');
  }
  ctx.fillStyle = red ? BRAND.red : BRAND.gray; ctx.fillRect(0, H - fh, W, fh);
  const lw = Math.max(W * 0.22, 200), lname = red ? 'iw' : 'ib', lh = logoH(lname, lw);
  drawLogo(ctx, lname, W - m, H - fh + (fh - lh) / 2, lw, 'right');
  const tcol = red ? '#fff' : BRAND.char, tmax = W - lw - 3 * m;
  const ft = fit(ctx, p.footer, 700, tmax, fh * 0.5, fh * 0.3, 18 * u, 1.1, 1);
  const hasTag = (p.tag || '').trim();
  if (!ft.empty) {
    const tot = ft.h + (hasTag ? fh * 0.2 : 0), y0 = H - fh + (fh - tot) / 2;
    drawLines(ctx, ft, m, y0, { wt: 700, color: tcol, align: 'left' });
    if (hasTag) { const tg = fit(ctx, p.tag, 300, tmax, fh * 0.2, fh * 0.17, 14 * u, 1.1, 1); drawLines(ctx, tg, m, y0 + ft.h + fh * 0.04, { wt: 300, color: tcol, align: 'left' }); }
    if (!ft.ok) R.over.push('Footer message');
  }
}

function T_header(ctx, W, H, p, o, R) {
  const { u, mn, m } = D(W, H), hb = Math.round(mn * 0.115), left = o.layout === 'll';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const hasCap = o.caption === 'on' && (p.sub || '').trim();
  let capH = 0, cf = null;
  if (hasCap) { cf = fit(ctx, p.sub, 300, W - 2 * m, H * 0.2, 44 * u, 20 * u, 1.3, 3); capH = cf.h + m * 1.1; }
  drawPhoto(ctx, p, 0, hb, W, H - hb - capH, R);
  ctx.fillStyle = BRAND.red; ctx.fillRect(0, 0, W, hb);
  const lw = Math.max(W * 0.22, 200), lh = logoH('iw', lw);
  drawLogo(ctx, 'iw', left ? m : W - m, (hb - lh) / 2, lw, left ? 'left' : 'right');
  const tw = W - lw - 3 * m, f = fit(ctx, p.headline, 500, tw, hb * 0.78, hb * 0.34, 16 * u, 1.15, 2);
  if (!f.empty) { drawLines(ctx, f, left ? W - m : m, (hb - f.h) / 2, { wt: 500, color: '#fff', align: left ? 'right' : 'left' }); if (!f.ok) R.over.push('Bar title'); }
  if (cf) { drawLines(ctx, cf, m, H - capH + m * 0.55, { wt: 300, color: BRAND.char, align: 'left' }); if (!cf.ok) R.over.push('Caption'); }
}

function T_promo(ctx, W, H, p, o, R) {
  const { u, mn, m } = D(W, H), fh = Math.round(mn * 0.15);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  drawPhoto(ctx, p, 0, 0, W, H - fh, R);
  drawBanner(ctx, W, H, 0, p, { wt: 500, bg: BRAND.red, fg: '#fff', side: 'l', vy: o.layout === 'bt' ? 'top' : 'bot', bottom: H - fh }, R);
  ctx.fillStyle = BRAND.red; ctx.fillRect(0, H - fh, W, fh);
  const lw = Math.max(W * 0.22, 200), lh = logoH('iw', lw);
  drawLogo(ctx, 'iw', W - m, H - fh + (fh - lh) / 2, lw, 'right');
  const pad = fh * 0.2;
  if (o.footer === 'partner' && p.partner && p.partner.src) {
    const im = p.partner.src, bh = fh - 2 * pad, bw = Math.min(W * 0.34, bh * im.width / im.height * 1.0 + 0.01), sc = Math.min(bw / im.width, bh / im.height);
    const dw = im.width * sc, dh = im.height * sc; ctx.drawImage(im, m, H - fh + (fh - dh) / 2, dw, dh);
    ctx.fillStyle = '#fff'; ctx.fillRect(W - m - lw - m * 0.8, H - fh + pad, 2, fh - 2 * pad);
  } else if ((p.footer || '').trim()) {
    const ft = fit(ctx, p.footer, 700, W - lw - 3 * m, fh * 0.5, fh * 0.3, 18 * u, 1.1, 1);
    drawLines(ctx, ft, m, H - fh + (fh - ft.h) / 2, { wt: 700, color: '#fff', align: 'left' }); if (!ft.ok) R.over.push('Footer message');
  }
}

function T_quote(ctx, W, H, p, o, R) {
  const { u, mn, m, wide, tall } = D(W, H);
  const tone = o.tone === 'gray' ? BRAND.gray : '#fff';
  function textBlock(x, y, w, h, red, centerV) {
    const col = red ? '#fff' : BRAND.char, qm = red ? '#fff' : BRAND.red;
    const q = fit(ctx, p.headline, 400, w, h * 0.7, 54 * u, 22 * u, 1.25);
    const hasN = (p.name || '').trim(), hasR = (p.role || '').trim();
    const np = Math.max(20 * u, q.px * 0.5), markH = q.px * 1.1;
    const nameH = hasN ? np * 1.4 : 0, roleH = hasR ? np * 1.3 : 0;
    const tot = markH + q.h + (hasN || hasR ? q.px * 0.5 : 0) + nameH + roleH;
    let yy = centerV ? y + Math.max(0, (h - tot) / 2) : y;
    font(ctx, 700, q.px * 1.7); ctx.fillStyle = qm; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillText('“', x, yy + q.px * 1.25);
    yy += markH; drawLines(ctx, q, x, yy, { wt: 400, color: col, align: 'left' }); yy += q.h + (hasN || hasR ? q.px * 0.5 : 0);
    if (hasN) { drawLines(ctx, fit(ctx, p.name, 700, w, nameH, np, 14 * u, 1.4, 1), x, yy, { wt: 700, color: col, align: 'left' }); yy += nameH; }
    if (hasR) drawLines(ctx, fit(ctx, p.role, 300, w, roleH, np, 14 * u, 1.3, 1), x, yy, { wt: 300, color: col, align: 'left' });
    if (!q.ok) R.over.push('Quote');
  }
  if (o.layout === 'card') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); drawPhoto(ctx, p, 0, 0, W, H, R);
    const cw = Math.round(W * (wide ? 0.5 : 0.84)), pad = Math.round(mn * 0.05), ch = Math.round(H * (wide ? 0.78 : tall ? 0.4 : 0.52));
    const cx = m, cy = H - m - ch; ctx.fillStyle = tone; ctx.fillRect(cx, cy, cw, ch);
    textBlock(cx + pad, cy + pad, cw - 2 * pad, ch - 2 * pad, false, true);
  } else if (o.layout === 'red') {
    ctx.fillStyle = BRAND.red; ctx.fillRect(0, 0, W, H);
    const b = Math.round(mn * 0.07);
    if (wide) { drawPhoto(ctx, p, b, b, W * 0.42, H - 2 * b, R); textBlock(W * 0.42 + 2 * b, b, W * 0.58 - 3 * b, H - 2 * b, true, true); }
    else { const phH = Math.round((H - 2 * b) * 0.44); drawPhoto(ctx, p, b, b, W - 2 * b, phH, R); textBlock(b, b + phH + b * 0.6, W - 2 * b, H - 2 * b - phH - b * 0.6, true, true); }
  } else {
    ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H);
    const stack = H / W > 1.1;
    if (stack) { const phH = Math.round(H * 0.46); drawPhoto(ctx, p, 0, 0, W, phH, R); textBlock(m, phH + m * 0.8, W - 2 * m, H - phH - 1.6 * m, false, true); }
    else { const pw = Math.round(W * 0.48); drawPhoto(ctx, p, 0, 0, pw, H, R); textBlock(pw + m, m, W - pw - 2 * m, H - 2 * m, false, true); }
  }
}

function T_textonly(ctx, W, H, p, o, R) {
  const { u, m } = D(W, H), red = o.bg === 'red';
  ctx.fillStyle = red ? BRAND.red : o.bg === 'gray' ? BRAND.gray : '#fff'; ctx.fillRect(0, 0, W, H);
  const centre = o.layout === 'c', al = centre ? 'center' : 'left', col = red ? '#fff' : BRAND.char;
  const lname = (red ? 'iw' : 'ib') + (o.logo === 'claim' ? 'c' : ''), lw = Math.max(W * (o.logo === 'claim' ? 0.26 : 0.3), 220), lh = logoH(lname, lw);
  const m2 = Math.round(Math.min(W, H) * 0.09), areaH = H - 2 * m2 - lh - m2 * 0.6, tw = W - 2 * m2;
  const f = fit(ctx, p.headline, 400, tw, areaH * (p.sub ? 0.75 : 1), 124 * u, 36 * u, 1.12);
  const s = p.sub && p.sub.trim() ? fit(ctx, p.sub, 300, tw, areaH * 0.3, Math.max(26 * u, f.px * 0.38), 20 * u, 1.3) : null;
  const gap = s ? f.px * 0.35 : 0, tot = f.h + gap + (s ? s.h : 0), y = m2 + (areaH - tot) / 2, x = centre ? W / 2 : m2;
  drawLines(ctx, f, x, y, { wt: 400, color: col, align: al, kw: p.keyword, kws: red ? 'bold' : 'underline' });
  if (s) drawLines(ctx, s, x, y + f.h + gap, { wt: 300, color: col, align: al });
  drawLogo(ctx, lname, centre ? W / 2 : m2, H - m2 - lh, lw, centre ? 'center' : 'left');
  if (!f.ok) R.over.push('Headline'); if (s && !s.ok) R.over.push('Second line');
}

function T_split(ctx, W, H, p, o, R) {
  const { u, mn, wide } = D(W, H), stack = H / W > 1.1 && !wide, pan = o.panel, red = pan === 'red';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const first = o.layout === 'a';
  let ph, pn;
  if (stack) { const hh = Math.round(H * 0.5); ph = first ? { x: 0, y: 0, w: W, h: hh } : { x: 0, y: H - hh, w: W, h: hh }; pn = first ? { x: 0, y: hh, w: W, h: H - hh } : { x: 0, y: 0, w: W, h: H - hh }; }
  else { const pw = Math.round(W * (wide ? 0.5 : 0.5)); ph = first ? { x: 0, y: 0, w: pw, h: H } : { x: W - pw, y: 0, w: pw, h: H }; pn = first ? { x: pw, y: 0, w: W - pw, h: H } : { x: 0, y: 0, w: W - pw, h: H }; }
  drawPhoto(ctx, p, ph.x, ph.y, ph.w, ph.h, R);
  ctx.fillStyle = red ? BRAND.red : pan === 'gray' ? BRAND.gray : '#fff'; ctx.fillRect(pn.x, pn.y, pn.w, pn.h);
  const pad = Math.round(mn * 0.07), col = red ? '#fff' : BRAND.char, kws = red ? 'bold' : 'underline';
  const lname = red ? 'iw' : 'ib', lw = Math.max(Math.min(pn.w * 0.5, 320 * u), 170), lh = logoH(lname, lw);
  const x = pn.x + pad, w = pn.w - 2 * pad, top = pn.y + pad, avail = pn.h - 2 * pad - lh - pad * 0.5;
  const hasL = (p.label || '').trim(), tp = Math.max(20 * u, 30 * u), tagH = hasL ? tp * 1.35 + tp * 0.9 : 0;
  const f = fit(ctx, p.headline, 400, w, (avail - tagH) * (p.sub ? 0.72 : 1), 78 * u, 28 * u, 1.14);
  const s = p.sub && p.sub.trim() ? fit(ctx, p.sub, 300, w, (avail - tagH) * 0.34, Math.max(22 * u, f.px * 0.45), 18 * u, 1.3) : null;
  const gap = s ? f.px * 0.3 : 0, tot = tagH + f.h + gap + (s ? s.h : 0), y0 = top + Math.max(0, (avail - tot) / 2);
  if (hasL) drawTag(ctx, p.label.trim(), tp, x, y0, { color: col, bar: red ? '#fff' : BRAND.red, align: 'left' });
  drawLines(ctx, f, x, y0 + tagH, { wt: 400, color: col, align: 'left', kw: p.keyword, kws });
  if (s) drawLines(ctx, s, x, y0 + tagH + f.h + gap, { wt: 300, color: col, align: 'left' });
  drawLogo(ctx, lname, x, pn.y + pn.h - pad - lh, lw, 'left');
  if (!f.ok) R.over.push('Headline'); if (s && !s.ok) R.over.push('Second line');
}


/* ----- New templates ----- */

/* Price tag: product name, price, optional old price, short line and fine print. */
function T_price(ctx, W, H, p, o, R) {
  const { u, mn, m, wide, tall } = D(W, H), sf = SAFE(W, H), redAccent = o.accent !== 'char';
  const label = (p.label || '').trim(), price = (p.price || '').trim(), was = (p.was || '').trim(), head = (p.headline || '').trim(), fine = (p.fine || '').trim();
  if (o.layout === 'panel') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    let pn;
    if (wide) { const pw = Math.round(W * 0.42); drawPhoto(ctx, p, 0, 0, W - pw, H, R); pn = { x: W - pw, y: 0, w: pw, h: H }; }
    else { const ph = Math.round(H * (tall ? 0.42 : 0.38)); drawPhoto(ctx, p, 0, 0, W, H - ph, R); pn = { x: 0, y: H - ph, w: W, h: ph }; }
    const pad = Math.round(mn * 0.07), x = pn.x + pad, w = pn.w - 2 * pad;
    const top = Math.max(pn.y + pad, sf.t), bottom = Math.min(pn.y + pn.h - pad, H - sf.b - pad * 0.3);
    const lw = Math.max(Math.min(w * 0.34, 260 * u), 160), lh = logoH('ib', lw);
    const fineH = fine ? Math.min(26 * u * 3.2, (bottom - top) * 0.22) : 0, avail = bottom - top - Math.max(lh, fineH) - pad * 0.5;
    const lab = fit(ctx, label, 500, w, avail * 0.3, 52 * u, 22 * u, 1.12, 2);
    const hd = head ? fit(ctx, head, 300, w, avail * 0.18, Math.max(26 * u, lab.px * 0.6), 18 * u, 1.2, 1) : null;
    const used = lab.h + (hd ? hd.h + lab.px * 0.15 : 0), gap = lab.px * 0.45;
    const pr = fit(ctx, price || ' ', 700, w * (was ? 0.62 : 1), avail - used - gap, 118 * u, 40 * u, 1.0, 1);
    const wf = was ? fit(ctx, was, 300, w - widest(ctx, pr, 700) - pr.px * 0.4, pr.px, Math.max(26 * u, pr.px * 0.36), 18 * u, 1.1, 1) : null;
    let y = top + Math.max(0, (avail - used - gap - pr.h) / 2);
    drawLines(ctx, lab, x, y, { wt: 500, color: BRAND.char, align: 'left' }); y += lab.h;
    if (hd) { y += lab.px * 0.15; drawLines(ctx, hd, x, y, { wt: 300, color: BRAND.char, align: 'left' }); y += hd.h; }
    y += gap;
    if (price) drawLines(ctx, pr, x, y, { wt: 700, color: redAccent ? BRAND.red : BRAND.char, align: 'left' });
    if (wf) { const wx = x + widest(ctx, pr, 700) + pr.px * 0.35, wy = y + pr.px * 0.8 - wf.px * 0.85; drawLines(ctx, wf, wx, wy, { wt: 300, color: BRAND.char, align: 'left' }); strike(ctx, wf, wx, wy, 300, BRAND.char); }
    drawLogo(ctx, 'ib', x + w, bottom - lh, lw, 'right');
    if (fine) drawFine(ctx, W, H, fine, x, bottom, w - lw - pad * 0.6, BRAND.char, R);
    if (!lab.ok) R.over.push('Product name'); if (!pr.ok) R.over.push('Price');
    return;
  }
  /* price box on the photo */
  drawPhoto(ctx, p, 0, 0, W, H, R);
  const red = o.accent !== 'char', bg = red ? BRAND.red : '#fff', fg = red ? '#fff' : BRAND.char, prc = red ? '#fff' : BRAND.red;
  const pad = Math.round(34 * u), boxMax = W * (wide ? 0.44 : 0.68), cw = boxMax - 2 * pad;
  const hd = head ? fit(ctx, head, 400, cw, H * 0.08, 34 * u, 18 * u, 1.2, 1) : null;
  const lab = label ? fit(ctx, label, 500, cw, H * 0.12, 46 * u, 22 * u, 1.15, 2) : null;
  const pr = fit(ctx, price || ' ', 700, cw, H * 0.15, 112 * u, 40 * u, 1.0, 1);
  const wf = was ? fit(ctx, was, 300, cw, H * 0.06, Math.max(26 * u, pr.px * 0.32), 18 * u, 1.15, 1) : null;
  const ff = fine ? fit(ctx, fine, 300, cw, H * 0.09, 20 * u, 15 * u, 1.28, 3) : null;
  const g = 14 * u, parts = [hd, lab, pr, wf, ff].filter(Boolean);
  const boxH = parts.reduce((a, f) => a + f.h, 0) + g * (parts.length - 1) + 2 * pad;
  const ws = [hd && widest(ctx, hd, 400), lab && widest(ctx, lab, 500), widest(ctx, pr, 700), wf && widest(ctx, wf, 300), ff && widest(ctx, ff, 300)].filter(Boolean);
  const boxW = Math.min(boxMax, Math.max(W * 0.32, Math.max(...ws) + 2 * pad));
  const bx = m, by = H - Math.max(m, sf.b + m * 0.4) - boxH;
  ctx.fillStyle = bg; ctx.fillRect(bx, by, boxW, boxH);
  let y = by + pad; const x = bx + pad;
  if (hd) { drawLines(ctx, hd, x, y, { wt: 400, color: fg, align: 'left' }); y += hd.h + g; }
  if (lab) { drawLines(ctx, lab, x, y, { wt: 500, color: fg, align: 'left' }); y += lab.h + g; }
  if (price) drawLines(ctx, pr, x, y, { wt: 700, color: prc, align: 'left' }); y += pr.h + g;
  if (wf) { drawLines(ctx, wf, x, y, { wt: 300, color: fg, align: 'left' }); strike(ctx, wf, x, y, 300, fg); y += wf.h + g; }
  if (ff) drawLines(ctx, ff, x, y, { wt: 300, color: fg, align: 'left' });
  if (lab && !lab.ok) R.over.push('Product name'); if (!pr.ok) R.over.push('Price'); if (ff && !ff.ok) R.over.push('Fine print');
}

/* Feature callouts: product name and up to three features, each with a red bar. */
function T_features(ctx, W, H, p, o, R) {
  const { u, mn, wide, tall } = D(W, H), sf = SAFE(W, H);
  const feats = [p.f1, p.f2, p.f3].map(s => (s || '').trim()).filter(Boolean);
  ctx.fillStyle = o.panel === 'gray' ? BRAND.gray : '#fff'; ctx.fillRect(0, 0, W, H);
  const side = wide || (o.layout === 'side' && !tall);
  let ph, pn;
  if (side) { const pw = Math.round(W * (wide ? 0.52 : 0.5)); ph = { x: 0, y: 0, w: pw, h: H }; pn = { x: pw, y: 0, w: W - pw, h: H }; }
  else { const hh = Math.round(H * (tall ? 0.46 : 0.5)); ph = { x: 0, y: 0, w: W, h: hh }; pn = { x: 0, y: hh, w: W, h: H - hh }; }
  drawPhoto(ctx, p, ph.x, ph.y, ph.w, ph.h, R);
  const pad = Math.round(mn * 0.07), x = pn.x + pad, w = pn.w - 2 * pad;
  const top = Math.max(pn.y + pad, sf.t + (pn.y === 0 ? pad * 0.3 : 0)), bottom = Math.min(pn.y + pn.h - pad, H - sf.b - pad * 0.3);
  const lw = Math.max(Math.min(w * 0.42, 260 * u), 160), lh = logoH('ib', lw), avail = bottom - top - lh - pad * 0.6;
  const lab = fit(ctx, p.label, 500, w, avail * 0.3, (tall ? 68 : 56) * u, 24 * u, 1.12, 2);
  const hd = (p.headline || '').trim() ? fit(ctx, p.headline, 300, w, avail * 0.16, Math.max(26 * u, lab.px * 0.55), 18 * u, 1.25, 2) : null;
  const headH = lab.h + (hd ? hd.h + lab.px * 0.15 : 0), gap = lab.px * 0.55, barW = Math.max(3, 6 * u), barGap = 20 * u;
  const L = fitList(ctx, feats, 400, w - barW - barGap, avail - headH - gap, (tall ? 52 : 42) * u, 18 * u, 1.22, 0.6);
  let y = top + Math.max(0, (avail - headH - gap - L.h) / 2);
  drawLines(ctx, lab, x, y, { wt: 500, color: BRAND.char, align: 'left' }); y += lab.h;
  if (hd) { y += lab.px * 0.15; drawLines(ctx, hd, x, y, { wt: 300, color: BRAND.char, align: 'left' }); y += hd.h; }
  y += gap;
  L.blocks.forEach(b => {
    const inset = (b.px * b.lh - b.px) / 2 + b.px * 0.05;
    ctx.fillStyle = BRAND.red; ctx.fillRect(x, y + inset, barW, b.h - 2 * inset);
    drawLines(ctx, b, x + barW + barGap, y, { wt: 400, color: BRAND.char, align: 'left' }); y += b.h + L.px * 0.6;
  });
  drawLogo(ctx, 'ib', x, bottom - lh, lw, 'left');
  if (!lab.ok) R.over.push('Product name'); if (hd && !hd.ok) R.over.push('Short line'); if (!L.ok) R.over.push('Features');
}

/* Event and date: a date block, the event name and the details. */
function T_event(ctx, W, H, p, o, R) {
  const { u, mn, wide, tall } = D(W, H), sf = SAFE(W, H), blk = o.tone === 'char' ? BRAND.char : BRAND.red, plain = o.layout === 'plain';
  ctx.fillStyle = plain && o.bg === 'gray' ? BRAND.gray : '#fff'; ctx.fillRect(0, 0, W, H);
  let area = { x: 0, y: 0, w: W, h: H };
  if (!plain) {
    if (wide) { const pw = Math.round(W * 0.5); drawPhoto(ctx, p, 0, 0, pw, H, R); area = { x: pw, y: 0, w: W - pw, h: H }; }
    else { const hh = Math.round(H * (tall ? 0.5 : 0.55)); drawPhoto(ctx, p, 0, 0, W, hh, R); area = { x: 0, y: hh, w: W, h: H - hh }; }
  }
  const pad = Math.round(mn * (plain ? 0.09 : 0.07)), x = area.x + pad, w = area.w - 2 * pad;
  const top = Math.max(area.y + pad, area.y === 0 ? sf.t + pad * 0.3 : 0), bottom = Math.min(area.y + area.h - pad, H - sf.b - pad * 0.3);
  const lw = Math.max(Math.min(w * 0.34, 260 * u), 160), lh = logoH('ib', lw), avail = bottom - top - lh - pad * 0.6;
  const beside = !plain && !wide && !tall;
  const bs = Math.round(Math.min(plain || tall ? 320 * u : 250 * u, avail * (beside ? 0.95 : plain ? 0.42 : 0.4), w * (beside ? 0.34 : 0.5)));
  ctx.fillStyle = blk; ctx.fillRect(x, top, bs, bs);
  const dayF = fit(ctx, (p.day || '').trim() || ' ', 700, bs * 0.84, bs * 0.5, bs * 0.46, bs * 0.16, 1.0, 1);
  const monF = (p.month || '').trim() ? fit(ctx, p.month, 500, bs * 0.84, bs * 0.24, bs * 0.16, bs * 0.08, 1.1, 2) : null;
  const inner = dayF.h + (monF ? monF.h + bs * 0.04 : 0), iy = top + (bs - inner) / 2;
  drawLines(ctx, dayF, x + bs / 2, iy, { wt: 700, color: '#fff', align: 'center' });
  if (monF) drawLines(ctx, monF, x + bs / 2, iy + dayF.h + bs * 0.04, { wt: 500, color: '#fff', align: 'center' });
  const tx = beside ? x + bs + pad * 0.6 : x, tw = beside ? w - bs - pad * 0.6 : w, ty = beside ? top : top + bs + pad * 0.6, th = beside ? avail : avail - bs - pad * 0.6;
  const hf = fit(ctx, p.headline, 400, tw, th * (p.sub ? 0.64 : 1), (plain || tall ? 84 : 64) * u, 24 * u, 1.14);
  const sb = (p.sub || '').trim() ? fit(ctx, p.sub, 300, tw, th * 0.34, Math.max(24 * u, hf.px * 0.5), 18 * u, 1.3) : null;
  const tot = hf.h + (sb ? sb.h + hf.px * 0.3 : 0), y0 = beside ? ty + Math.max(0, (Math.min(th, bs) - tot) / 2) : ty;
  drawLines(ctx, hf, tx, y0, { wt: 400, color: BRAND.char, align: 'left', kw: p.keyword, kws: 'underline' });
  if (sb) drawLines(ctx, sb, tx, y0 + hf.h + hf.px * 0.3, { wt: 300, color: BRAND.char, align: 'left' });
  drawLogo(ctx, 'ib', x + w, bottom - lh, lw, 'right');
  if ((p.fine || '').trim()) drawFine(ctx, W, H, p.fine, x, bottom, w - lw - pad * 0.6, BRAND.char, R);
  if (!dayF.ok) R.over.push('Date'); if (!hf.ok) R.over.push('Event name'); if (sb && !sb.ok) R.over.push('Details');
}

/* Tips list: a title and up to four numbered tips. */
function T_tips(ctx, W, H, p, o, R) {
  const { u, mn, wide, tall } = D(W, H), sf = SAFE(W, H);
  ctx.fillStyle = o.bg === 'gray' ? BRAND.gray : '#fff'; ctx.fillRect(0, 0, W, H);
  const tips = [p.t1, p.t2, p.t3, p.t4].map(s => (s || '').trim()).filter(Boolean);
  let area = { x: 0, y: 0, w: W, h: H };
  if (o.layout === 'photo') {
    if (wide || H / W < 1.1) { const pw = Math.round(W * 0.42); drawPhoto(ctx, p, 0, 0, pw, H, R); area = { x: pw, y: 0, w: W - pw, h: H }; }
    else { const hh = Math.round(H * (tall ? 0.34 : 0.32)); drawPhoto(ctx, p, 0, 0, W, hh, R); area = { x: 0, y: hh, w: W, h: H - hh }; }
  }
  const pad = Math.round(mn * 0.08), x = area.x + pad, w = area.w - 2 * pad;
  const top = Math.max(area.y + pad, area.y === 0 ? sf.t + pad * 0.3 : 0), bottom = Math.min(area.y + area.h - pad, H - sf.b - pad * 0.3);
  const lw = Math.max(Math.min(w * 0.36, 260 * u), 160), lh = logoH('ib', lw), avail = bottom - top - lh - pad * 0.6;
  const t = fit(ctx, p.headline, 400, w, avail * 0.3, (tall ? 86 : 72) * u, 28 * u, 1.14, 3), gap = t.px * 0.6;
  const numW = (tall ? 74 : 64) * u, L = fitList(ctx, tips, 400, w - numW, avail - t.h - gap, (tall ? 50 : 40) * u, 18 * u, 1.25, 0.65);
  let y = top + Math.max(0, (avail - t.h - gap - L.h) / 2);
  drawLines(ctx, t, x, y, { wt: 400, color: BRAND.char, align: 'left', kw: p.keyword, kws: 'underline' }); y += t.h + gap;
  L.blocks.forEach((b, i) => {
    const n = fit(ctx, String(i + 1), 700, numW, b.px * 1.6, b.px * 1.5, b.px, 1.0, 1);
    drawLines(ctx, n, x, y + (b.px * b.lh - b.px) / 2 - b.px * 0.32, { wt: 700, color: BRAND.red, align: 'left' });
    drawLines(ctx, b, x + numW, y, { wt: 400, color: BRAND.char, align: 'left' }); y += b.h + L.px * 0.65;
  });
  drawLogo(ctx, 'ib', x, bottom - lh, lw, 'left');
  if (!t.ok) R.over.push('Title'); if (!L.ok) R.over.push('Tips');
}

/* Before and after: two photos with labels, and an optional headline strip. */
function T_beforeafter(ctx, W, H, p, o, R) {
  const { u, mn } = D(W, H), sf = SAFE(W, H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  let top = 0;
  if (o.head !== 'none' && (p.headline || '').trim()) {
    const pad = Math.round(mn * 0.055), f = fit(ctx, p.headline, 400, W - 2 * pad, H * 0.14, 60 * u, 24 * u, 1.15, 2), y0 = Math.max(pad * 0.9, sf.t + pad * 0.3);
    drawLines(ctx, f, pad, y0, { wt: 400, color: BRAND.char, align: 'left', kw: p.keyword, kws: 'underline' });
    top = y0 + f.h + pad * 0.8; if (!f.ok) R.over.push('Headline');
  }
  const stack = o.layout === 'stack' || (o.layout !== 'side' && H / W > 1.15), g = Math.max(4, Math.round(8 * u));
  let a, b;
  if (stack) { const hh = Math.round((H - top - g) / 2); a = { x: 0, y: top, w: W, h: hh }; b = { x: 0, y: top + hh + g, w: W, h: H - top - hh - g }; }
  else { const ww = Math.round((W - g) / 2); a = { x: 0, y: top, w: ww, h: H - top }; b = { x: ww + g, y: top, w: W - ww - g, h: H - top }; }
  drawPhoto(ctx, p, a.x, a.y, a.w, a.h, R, 1); drawPhoto(ctx, p, b.x, b.y, b.w, b.h, R, 2);
  const tp = 32 * u, pd = Math.round(mn * 0.035);
  drawTag(ctx, (p.label1 || '').trim() || 'Before', tp, a.x + pd, Math.max(a.y + pd, sf.t + pd * 0.3), { plate: true, color: BRAND.char });
  drawTag(ctx, (p.label2 || '').trim() || 'After', tp, b.x + pd, Math.max(b.y + pd, stack ? 0 : sf.t + pd * 0.3), { plate: true, color: BRAND.char });
}

const fld = (k, l, o) => Object.assign({ k, l }, o || {});
const HEAD_HELP = 'Sentence case, not all capitals.';
const KW = fld('keyword', 'Word to underline', { ph: 'One word or short phrase from the headline', help: 'Optional. It gets the one red underline. Tap a word below.' });

const TEMPLATES = [
  { id: 'fullbleed', name: 'Photo with headline', guide: 'Layout 1', use: 'Lifestyle, brand and collection posts. The headline sits right on a full photo, with one red underline.',
    needs: ['headline'], fields: [fld('headline', 'Headline', { rows: 2, ph: 'Life is about having the right kind of pressure', help: HEAD_HELP }), KW, fld('sub', 'Second line (optional)', { ph: 'A softer shower for life with pets' })],
    options: [opt('layout', 'Text position', [['tl', 'Top left'], ['bl', 'Bottom left'], ['tc', 'Top centre'], ['br', 'Bottom right']]), opt('tone', 'Text colour', [['light', 'White text'], ['dark', 'Charcoal text']])],
    sample: { headline: 'Life is about having the right kind of pressure', keyword: 'right' }, draw: T_fullbleed },
  { id: 'banner', name: 'Red banner frame', guide: 'Layout 2', use: 'Lifestyle, collection or product messages. A short key message sits in a banner on a framed photo.',
    needs: ['headline'], fields: [fld('headline', 'Banner message', { rows: 2, ph: 'Bad dog. Great bathroom!', help: 'Keep it short. Banners are for key messages and product or collection names, not notices.' })],
    options: [opt('layout', 'Banner position', [['bl', 'Bottom left'], ['tl', 'Top left'], ['br', 'Bottom right'], ['tr', 'Top right']]), opt('border', 'Border', [['white', 'White border, red banner'], ['red', 'Red border, white banner'], ['alt', 'Alternate red and white']])],
    sample: { headline: 'Bad dog. Great bathroom!' }, draw: T_banner },
  { id: 'tab', name: 'White tab on red', guide: 'Layout 2', use: 'Occasions, seasonal moments and short lifestyle lines on a red border.',
    needs: ['headline'], fields: [fld('headline', 'Tab text', { rows: 2, ph: 'Splash into vacation!', help: HEAD_HELP }), KW],
    options: [opt('layout', 'Tab position', [['tl', 'Top left'], ['bl', 'Bottom left'], ['br', 'Bottom right'], ['tr', 'Top right']]), opt('text', 'Key word', [['plain', 'Plain text'], ['ul', 'Underline a key word']])],
    sample: { headline: 'Luck flows where water flows.', keyword: 'water' }, draw: T_tab },
  { id: 'product', name: 'Product spotlight', guide: 'Layout 3', use: 'Product shots, features and awards. A clean panel, a product label and one headline.',
    needs: ['label'], fields: [fld('label', 'Product or collection name', { ph: 'Acacia SupaSleek', help: 'Shown in a small label on the photo.' }), fld('headline', 'Headline (optional)', { rows: 2, ph: 'Control your comfort', help: HEAD_HELP }), KW],
    options: [opt('layout', 'Headline', [['al', 'Above, left'], ['ac', 'Above, centred'], ['bc', 'Below, centred']]), opt('panel', 'Panel colour', [['white', 'White'], ['gray', 'Light grey'], ['red', 'Red']])],
    sample: { label: 'WizFlo Flex', headline: 'Control your comfort', keyword: 'comfort' }, draw: T_product },
  { id: 'caption', name: 'Product caption', guide: 'Product imagery', use: 'Room and product photos that only need a name and a type, plus one optional feature.',
    needs: ['label'], fields: [fld('label', 'Product name', { ph: 'Acacia SupaSleek' }), fld('sub', 'Product type', { ph: 'One-piece toilet' }), fld('tag', 'Feature (optional)', { ph: 'Hygiene Rim' })],
    options: [opt('layout', 'Text position', [['bl', 'Bottom left'], ['bc', 'Bottom centre'], ['tl', 'Top left'], ['br', 'Bottom right']]), opt('tone', 'Text colour', [['light', 'White text'], ['dark', 'Charcoal text']])],
    sample: { label: 'Loven', sub: 'One-piece toilet', tag: 'Hygiene Rim' }, draw: T_caption },
  { id: 'announce', name: 'Announcement', guide: 'Layout 4', use: 'Store closures, new outlets, schedules and other updates. The message is plain text, never in a red banner.',
    needs: ['headline'], fields: [fld('headline', 'Message', { rows: 3, ph: 'We are closed from 23 to 25 Oct.', help: HEAD_HELP }), fld('sub', 'Details (optional)', { ph: 'We resume operations on 26 Oct. Thank you.', rows: 2 })],
    options: [opt('layout', 'Layout', [['pt', 'Photo on top'], ['pb', 'Photo at the bottom'], ['to', 'Text only']]), opt('tone', 'Message colour', [['red', 'Red text'], ['char', 'Charcoal text']])],
    sample: { headline: 'We are closed from 23 to 25 Oct.', sub: 'We resume operations on 26 Oct.' }, draw: T_announce },
  { id: 'footer', name: 'Photo with footer bar', guide: 'Campaign posts', use: 'Campaign and tagline posts. A footer bar carries your tagline and the logo.',
    needs: ['footer'], fields: [fld('headline', 'Headline (optional)', { rows: 2, ph: 'Good things hide in plain sight', help: HEAD_HELP }), KW, fld('footer', 'Footer message', { ph: 'Every moment matters' }), fld('tag', 'Small line under it (optional)', { ph: 'Raffle promo' })],
    options: [opt('layout', 'Headline', [['st', 'In a white strip above'], ['ov', 'On the photo'], ['po', 'No headline']]), opt('footer', 'Footer colour', [['red', 'Red'], ['white', 'Light grey']])],
    sample: { headline: 'Good things hide in plain sight', keyword: 'plain sight', footer: 'Every moment matters' }, draw: T_footer },
  { id: 'header', name: 'Photo with header bar', guide: 'Campaign posts', use: 'Events, talks and partner news. A red header carries the logo and a short title.',
    needs: ['headline'], fields: [fld('headline', 'Header title', { rows: 2, ph: 'People-first design', help: 'Two short lines at most.' }), fld('sub', 'Caption below photo (optional)', { rows: 2, ph: 'Our designers on balancing experience, form and function.' })],
    options: [opt('layout', 'Logo position', [['ll', 'Logo left, title right'], ['lr', 'Title left, logo right']]), opt('caption', 'Caption', [['off', 'Photo only'], ['on', 'Photo with caption']])],
    sample: { headline: 'Elevate your space. Win an upgrade!', sub: '' }, draw: T_header },
  { id: 'promo', name: 'Promo with partner', guide: 'Layout 2', use: 'Giveaways and retail promos. A banner on the photo and a footer with a partner logo.',
    needs: ['headline'], fields: [fld('headline', 'Banner message', { rows: 2, ph: 'Win a P5,000 shopping spree!', help: 'Short and positive. One font size.' }), fld('partner', 'Partner logo', { image: true }), fld('footer', 'Footer message (when no partner logo)', { ph: 'Every moment matters' })],
    options: [opt('layout', 'Banner position', [['bt', 'Top left'], ['bb', 'Bottom left']]), opt('footer', 'Footer', [['partner', 'Partner logo and brand logo'], ['text', 'Message and brand logo']])],
    sample: { headline: 'Win a ₱5,000 shopping spree!', footer: 'Every moment matters' }, draw: T_promo },
  { id: 'quote', name: 'Quote', guide: 'Brand voice', use: 'Customer words, designer quotes and testimonials, with a name and role.',
    needs: ['headline'], fields: [fld('headline', 'Quote', { rows: 4, ph: 'We are constantly balancing designing for people visually and functionally.' }), fld('name', 'Name', { ph: 'Antoine Besseyre des Horts' }), fld('role', 'Role (optional)', { ph: 'Leader, Global Design, Asia' })],
    options: [opt('layout', 'Layout', [['card', 'Card on the photo'], ['split', 'Photo beside the quote'], ['red', 'Red background']]), opt('tone', 'Card colour', [['white', 'White'], ['gray', 'Light grey']])],
    sample: { headline: 'We are constantly balancing designing for people visually and functionally.', name: 'Antoine Besseyre des Horts', role: 'Leader, Global Design, Asia' }, draw: T_quote },
  { id: 'textonly', name: 'Text only', guide: 'Announcements', use: 'Greetings, reminders and bold statements with no photo.',
    needs: ['headline'], fields: [fld('headline', 'Headline', { rows: 3, ph: 'Happy Father’s Day', help: HEAD_HELP }), KW, fld('sub', 'Second line (optional)', { ph: 'Thank you for building our homes.' })],
    options: [opt('bg', 'Background', [['white', 'White'], ['gray', 'Light grey'], ['red', 'Red']]), opt('layout', 'Alignment', [['l', 'Left'], ['c', 'Centred']]), opt('logo', 'Logo', [['plain', 'Logo only'], ['claim', 'Logo with brand claim']])],
    sample: { headline: 'A quiet reset for Dad', keyword: 'Dad', sub: 'Happy Father’s Day' }, draw: T_textonly },
  { id: 'split', name: 'Photo and text panel', guide: 'Product and brand stories', use: 'Stories with a little more to say. Photo on one side, label, headline and details on the other.',
    needs: ['headline'], fields: [fld('label', 'Small label (optional)', { ph: 'EasyClean' }), fld('headline', 'Headline', { rows: 3, ph: 'Rimless design for effortless cleaning', help: HEAD_HELP }), KW, fld('sub', 'Details (optional)', { rows: 3, ph: 'No hidden corners where dirt can hide.' })],
    options: [opt('layout', 'Photo position', [['a', 'First (left or top)'], ['b', 'Second (right or bottom)']]), opt('panel', 'Panel colour', [['white', 'White'], ['gray', 'Light grey'], ['red', 'Red']])],
    sample: { label: 'Hygiene Rim', headline: 'Rimless design for effortless cleaning', keyword: 'effortless cleaning', sub: 'No hidden corners where dirt can hide.' }, draw: T_split },
  { id: 'price', name: 'Price tag', guide: 'Retail promos', use: 'Sale and retail posts. A product name, the price and an optional old price, with room for fine print.',
    needs: ['label', 'price'], fields: [fld('label', 'Product name', { ph: 'Acacia E wall-hung toilet' }), fld('price', 'Price', { ph: '₱18,990', peso: true, help: 'Tap ₱ to add the peso sign. It is drawn in the brand font.' }), fld('was', 'Old price (optional)', { ph: '₱23,500', peso: true }), fld('headline', 'Short line (optional)', { ph: 'Bathroom upgrade sale', help: HEAD_HELP }), fld('fine', 'Fine print (optional)', { rows: 2, ph: 'Promo runs until 30 Nov 2026. While stocks last.' })],
    options: [opt('layout', 'Layout', [['box', 'Price box on the photo'], ['panel', 'Price panel below']]), opt('accent', 'Colour', [['red', 'Red'], ['char', 'Charcoal and white']])],
    sample: { label: 'Acacia E wall-hung toilet', price: '₱18,990', was: '₱23,500', headline: 'Bathroom upgrade sale', fine: 'Promo runs until 30 Nov 2026. While stocks last.' }, draw: T_price },
  { id: 'features', name: 'Feature callouts', guide: 'Product imagery', use: 'Product education. The product name with up to three features, each marked with a red bar.',
    needs: ['label', 'f1'], fields: [fld('label', 'Product name', { ph: 'Acacia SupaSleek' }), fld('headline', 'Short line (optional)', { ph: 'One-piece toilet' }), fld('f1', 'Feature 1', { ph: 'Hygiene Rim for easier cleaning' }), fld('f2', 'Feature 2 (optional)', { ph: 'Soft-close seat' }), fld('f3', 'Feature 3 (optional)', { ph: 'Dual flush saves water' })],
    options: [opt('layout', 'Layout', [['side', 'Features beside the photo'], ['below', 'Features below the photo']]), opt('panel', 'Panel colour', [['white', 'White'], ['gray', 'Light grey']])],
    sample: { label: 'Acacia SupaSleek', headline: 'One-piece toilet', f1: 'Hygiene Rim for easier cleaning', f2: 'Soft-close seat', f3: 'Dual flush saves water' }, draw: T_features },
  { id: 'event', name: 'Event and date', guide: 'Layout 4', use: 'Store events, expos, launches and talks. A date block with the event name and details.',
    needs: ['day', 'headline'], fields: [fld('day', 'Date (big)', { ph: '28–30' }), fld('month', 'Month or day', { ph: 'Nov 2026' }), fld('headline', 'Event name', { rows: 2, ph: 'Visit us at the Design Week showcase', help: HEAD_HELP }), KW, fld('sub', 'Place and time (optional)', { rows: 2, ph: 'Hall B, booth 12 · 10 am to 8 pm' }), fld('fine', 'Fine print (optional)', { rows: 2, ph: 'Free entry. Registration required.' })],
    options: [opt('layout', 'Layout', [['photo', 'Photo with date'], ['plain', 'No photo']]), opt('tone', 'Date block', [['red', 'Red'], ['char', 'Charcoal']])],
    sample: { day: '28–30', month: 'Nov 2026', headline: 'Visit us at the Design Week showcase', keyword: 'Design Week', sub: 'Hall B, booth 12 · 10 am to 8 pm' }, draw: T_event },
  { id: 'tips', name: 'Tips list', guide: 'Brand voice', use: 'Care tips, how-tos and quick guides. A title with up to four numbered tips.',
    needs: ['headline', 't1'], fields: [fld('headline', 'Title', { rows: 2, ph: 'Keep your shower spotless', help: HEAD_HELP }), KW, fld('t1', 'Tip 1', { rows: 2, ph: 'Wipe the glass after every use.' }), fld('t2', 'Tip 2 (optional)', { rows: 2, ph: 'Rinse the shower head once a month.' }), fld('t3', 'Tip 3 (optional)', { rows: 2, ph: 'Use a soft cloth, never steel wool.' }), fld('t4', 'Tip 4 (optional)', { rows: 2 })],
    options: [opt('layout', 'Layout', [['photo', 'Photo and tips'], ['plain', 'Tips only']]), opt('bg', 'Background', [['white', 'White'], ['gray', 'Light grey']])],
    sample: { headline: 'Keep your shower spotless', keyword: 'spotless', t1: 'Wipe the glass after every use.', t2: 'Rinse the shower head once a month.', t3: 'Use a soft cloth, never steel wool.' }, draw: T_tips },
  { id: 'beforeafter', name: 'Before and after', guide: 'Product imagery', use: 'Bathroom makeovers and product swaps. Two photos with labels and an optional headline.',
    needs: [], fields: [fld('img2', 'After photo', { image2: true }), fld('headline', 'Headline (optional)', { rows: 2, ph: 'A bathroom refresh in one weekend', help: HEAD_HELP }), KW, fld('label1', 'First label', { ph: 'Before' }), fld('label2', 'Second label', { ph: 'After' })],
    options: [opt('layout', 'Layout', [['auto', 'Side by side, or stacked when tall'], ['side', 'Always side by side'], ['stack', 'Always stacked']]), opt('head', 'Headline', [['top', 'Headline on top'], ['none', 'Photos only']])],
    sample: { headline: 'A bathroom refresh in one weekend', keyword: 'one weekend', label1: 'Before', label2: 'After' }, draw: T_beforeafter }
];
const TPL = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
const defaultOpts = t => Object.fromEntries(t.options.map(g => [g.id, g.values[0].id]));
const variationCount = t => t.options.reduce((a, g) => a * g.values.length, 1);

/* ===== Stickers and logos uploaded by the user, drawn on top of the template ===== */
/* A sticker with no saved spot for a size takes the first free corner, away from the brand logo and the text. */
function freeSpot(W, H, w, h, R) {
  const mn = Math.min(W, H), m = Math.round(mn * 0.06), sf = SAFE(W, H), top = Math.max(m, sf.t + m * 0.3), bot = H - Math.max(m, sf.b + m * 0.3);
  const C = [[W - m - w / 2, top + h / 2], [m + w / 2, top + h / 2], [W - m - w / 2, bot - h / 2], [m + w / 2, bot - h / 2], [W - m - w / 2, H / 2], [m + w / 2, H / 2]];
  const busy = R.logos.concat(R.texts, R.layers);
  for (const [x, y] of C) { const r = { x: x - w / 2, y: y - h / 2, w, h }; if (!busy.some(b => hit(r, b))) return { x, y }; }
  return { x: C[0][0], y: C[0][1] };
}
function drawLayers(ctx, size, p, R) {
  const W = size.w, H = size.h, mn = Math.min(W, H);
  (p.layers || []).forEach(L => {
    const im = ASSET_IMG[L.asset]; if (!im) { R.missingAsset = true; return; }
    const ar = im.height / im.width, pp = L.pos && L.pos[size.id];
    let w = (pp ? pp.s : (L.s || 0.2)) * mn, h = w * ar; if (h > mn * 0.7) { h = mn * 0.7; w = h / ar; }
    const c = pp ? { x: pp.x * W, y: pp.y * H } : freeSpot(W, H, w, h, R);
    ctx.drawImage(im, c.x - w / 2, c.y - h / 2, w, h);
    R.layers.push({ id: L.id, x: c.x - w / 2, y: c.y - h / 2, w, h, auto: !pp });
  });
}

/* ===== Rendering ===== */
/* each size keeps its own photo position and zoom (frames for the main photo, frames2 for the second photo) */
function renderPost(canvas, post, size, scale, how) {
  scale = scale || 1;
  const fr = post.frames && post.frames[size.id], fr2 = post.frames2 && post.frames2[size.id];
  if (fr || fr2) post = Object.assign({}, post, fr ? { fx: fr.fx, fy: fr.fy, zoom: fr.zoom } : null, fr2 ? { fx2: fr2.fx, fy2: fr2.fy, zoom2: fr2.zoom } : null);
  const t = TPL[post.tpl] || TPL.fullbleed, o = Object.assign(defaultOpts(t), post.opts || {});
  canvas.width = Math.max(1, Math.round(size.w * scale)); canvas.height = Math.max(1, Math.round(size.h * scale));
  const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.w, size.h);
  const R = { over: [], minScale: 0, photos: [], layers: [], logos: [], texts: [], contrast: [], measure: !!(how && how.measure) };
  CUR = R;
  try { t.draw(ctx, size.w, size.h, post, o, R); drawLayers(ctx, size, post, R); } catch (e) { R.error = String(e); console.error(e); }
  CUR = null;
  return R;
}

/* ===== Sample photos (clearly placeholders) ===== */
function makeSample(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 1800; const x = c.getContext('2d');
  const pal = { tile: ['#BDD3E8', '#A9C4DD', '#E6E1D8', '#CFC9C0'], warm: ['#E8D9C6', '#DCC7AE', '#F2EEE8', '#B9A892'], steel: ['#D5D9DC', '#C3C9CD', '#EEF0F1', '#9AA3A8'] }[kind];
  for (let i = 0; i < 20; i++) { x.fillStyle = i % 2 ? pal[0] : pal[1]; x.fillRect(i * 90, 0, 90, 1150); }
  const fg = x.createLinearGradient(0, 1150, 0, 1800); fg.addColorStop(0, pal[3]); fg.addColorStop(1, '#8E8A84'); x.fillStyle = fg; x.fillRect(0, 1150, 1800, 650);
  x.fillStyle = pal[2]; x.fillRect(250, 900, 1300, 160); x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(250, 1060, 1300, 26);
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(900, 900, 330, 70, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#EDEFF0'; x.beginPath(); x.ellipse(900, 900, 280, 46, 0, 0, Math.PI * 2); x.fill();
  const mg = x.createLinearGradient(850, 0, 950, 0); mg.addColorStop(0, '#9AA1A6'); mg.addColorStop(0.5, '#F4F6F7'); mg.addColorStop(1, '#8A9297');
  x.fillStyle = mg; x.fillRect(868, 560, 64, 320); x.beginPath(); x.moveTo(868, 560); x.quadraticCurveTo(900, 470, 1010, 500); x.lineTo(1010, 548); x.quadraticCurveTo(930, 540, 932, 600); x.closePath(); x.fill();
  const rg = x.createRadialGradient(1400, 120, 40, 1400, 120, 1200); rg.addColorStop(0, 'rgba(255,250,235,0.65)'); rg.addColorStop(1, 'rgba(255,250,235,0)'); x.fillStyle = rg; x.fillRect(0, 0, 1800, 1800);
  return c;
}
