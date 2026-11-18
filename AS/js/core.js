/* American Standard social post maker: shared state, helpers, the post model, sizes and brand checks. */

/* ===== State ===== */
const state = {
  view: 'home',            /* home | build | download | assets */
  camp: null,              /* the open campaign (name, dates, file settings) */
  posts: [], sel: null, picked: new Set(),
  tpl: 'fullbleed', opts: {}, newSizes: ['square'],
  mode: 'post',            /* build centre: post | feed */
  phone: false, safe: false, checksOpen: false, layerSel: null,
  oldestFirst: false, busy: false, cat: 'all', secOpen: {}
};
const SETTINGS = { apiKey: '', model: 'claude-sonnet-5-5', hashtags: [{ name: 'Brand', tags: '#AmericanStandard' }], sizes: ['square'] };
let SAMPLES = {}, nextId = 1;

/* ===== DOM helpers ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'value') n.value = v; else n.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); });
  return n;
}
const pad2 = n => String(n).padStart(2, '0');
const slug = s => (s || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function ago(t) { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); if (s < 60) return 'just now'; const m = Math.round(s / 60); if (m < 60) return plural(m, 'minute') + ' ago'; const hh = Math.round(m / 60); if (hh < 24) return plural(hh, 'hour') + ' ago'; const d = Math.round(hh / 24); if (d < 30) return plural(d, 'day') + ' ago'; return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }

function toast(msg, action) {
  const t = $('#toast'); t.textContent = msg;
  if (action) t.append(h('button', { class: 'toastbtn', onclick: () => { action.fn(); t.classList.remove('show'); } }, action.label));
  t.classList.add('show'); t.classList.toggle('act', !!action); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), action ? 7000 : 3400);
}
const withUndo = msg => toast(msg, { label: 'Undo', fn: undo });
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function openModal(node) { const m = $('#modal'); m.innerHTML = ''; m.hidden = false; m.append(node); const f = $('[autofocus]', m) || $('input,textarea,select,button.primary', m); if (f) setTimeout(() => f.focus(), 30); return m; }

/* ===== Icons (Lucide, ISC licence, https://lucide.dev) ===== */
const ICONS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  images: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', next: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  layout: '<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/>',
  paste: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M9 18h6"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  capcopy: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M16 4h2a2 2 0 0 1 2 2v4"/><path d="M21 14H11"/><path d="m15 10-4 4 4 4"/>',
  ratio: '<rect width="12" height="20" x="6" y="2" rx="2"/><rect width="20" height="12" x="2" y="6" rx="2"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  folder: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  filedown: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
  filetext: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  grid: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  sticker: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13h.01"/><path d="M16 13h.01"/><path d="M10 16s.8 1 2 1c1.3 0 2-1 2-1"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  carousel: '<path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  comment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  translate: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  pkg: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};
function icon(n, s) { const e = document.createElement('span'); e.className = 'ic'; e.setAttribute('aria-hidden', 'true'); s = s || 18; e.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>'; return e; }
function ib(name, label, onclick, cls) { return h('button', { class: 'ibtn ' + (cls || ''), type: 'button', 'aria-label': label, title: label, onclick }, icon(name, 18)); }

/* ===== Undo and redo (per campaign) ===== */
const undoStack = [], redoStack = [];
function cloneFrames(f) { const o = {}; Object.keys(f || {}).forEach(k => { o[k] = Object.assign({}, f[k]); }); return o; }
function clonePost(p) { return Object.assign({}, p, { opts: Object.assign({}, p.opts), sizes: sizesOf(p).slice(), frames: cloneFrames(p.frames), frames2: cloneFrames(p.frames2), layers: (p.layers || []).map(l => Object.assign({}, l, { pos: cloneFrames(l.pos) })) }); }
const snapshot = () => ({ posts: state.posts.map(clonePost), sel: state.sel });
function updUndo() { const u = $('#undoBtn'), r = $('#redoBtn'); if (u) u.disabled = !undoStack.length; if (r) r.disabled = !redoStack.length; }
function snap() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; updUndo(); }
function restoreSnap(z) { state.posts = z.posts; state.sel = z.sel; state.picked.clear(); state.layerSel = null; render(); scheduleSave(); }
function undo() { const z = undoStack.pop(); if (!z) { toast('Nothing to undo.'); return; } redoStack.push(snapshot()); restoreSnap(z); updUndo(); toast('Undone.'); }
function redo() { const z = redoStack.pop(); if (!z) { toast('Nothing to redo.'); return; } undoStack.push(snapshot()); restoreSnap(z); updUndo(); toast('Redone.'); }
function clearHistory() { undoStack.length = 0; redoStack.length = 0; updUndo(); }

/* ===== Posts ===== */
const TEXT_KEYS = ['headline', 'keyword', 'sub', 'label', 'tag', 'footer', 'name', 'role', 'caption', 'alt', 'price', 'was', 'fine', 'f1', 'f2', 'f3', 'day', 'month', 't1', 't2', 't3', 't4', 'label1', 'label2'];
function blankPost() {
  const b = { img: null, img2: null, partner: null, fx: null, fy: null, zoom: 1, fx2: null, fy2: null, zoom2: 1, tpl: state.tpl, opts: Object.assign({}, state.opts), sizes: (state.newSizes || ['square']).slice(), view: null, frames: {}, frames2: {}, layers: [], group: null, date: '', export: true, demo: false };
  TEXT_KEYS.forEach(k => { b[k] = ''; });
  return b;
}
function newPost(extra) { return Object.assign(blankPost(), { id: nextId++ }, extra); }
const getPost = id => state.posts.find(p => p.id === id);
const selPost = () => getPost(state.sel);
const effOpts = p => Object.assign(defaultOpts(TPL[p.tpl]), p.opts || {});
function reindex() { state.posts.forEach((p, i) => { p.idx = i; }); }
function sampleImg(k) { return { src: SAMPLES[k || 'tile'], name: 'sample', sample: true, key: k || 'tile', focus: SAMPLES.focus ? SAMPLES.focus[k || 'tile'] : null }; }
function samplePost(t, o, k) { return Object.assign(blankPost(), { id: -1, tpl: t.id, opts: o, img: sampleImg(k), img2: sampleImg('steel'), idx: 0 }, t.sample); }
function dropDemos() { if (state.posts.some(p => p.demo)) { state.posts = state.posts.filter(p => !p.demo); toast('Example posts removed.'); } }
function markEdited(p) { p.demo = false; scheduleSave(); }

/* ===== Sizes: every post keeps its own list ===== */
const SHORT = { square: 'Square', portrait: 'Portrait', story: 'Story', landscape: 'Link', wide: 'Wide' };
const RATIO = { square: '1:1', portrait: '4:5', story: '9:16', landscape: '1.91:1', wide: '16:9' };
const SIZE_ORDER = SIZES.map(s => s.id);
const sortSizes = a => SIZE_ORDER.filter(id => (a || []).includes(id));
function sizesOf(p) { const a = p && Array.isArray(p.sizes) ? sortSizes(p.sizes) : []; return a.length ? a : ['square']; }
function viewOf(p) { const a = sizesOf(p); return p && a.includes(p.view) ? p.view : a[0]; }
const imageCount = posts => posts.reduce((n, p) => n + sizesOf(p).length, 0);
function shapeIcon(id, max) { const s = SIZE[id], r = s.w / s.h, w = r >= 1 ? max : max * r, hh = r >= 1 ? max / r : max; return h('i', { class: 'sh', style: 'width:' + w.toFixed(1) + 'px;height:' + hh.toFixed(1) + 'px' }); }
const sizeTip = id => SIZE[id].name + ', ' + SIZE[id].w + '×' + SIZE[id].h + '. ' + SIZE[id].where;
function sizeListText(a) { const n = sortSizes(a).map(id => SHORT[id]); return n.length < 2 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; }
/* carousel slides share their sizes, as Instagram needs one shape per carousel */
function setPostSizes(p, a) {
  const s = sortSizes(a), list = s.length ? s : ['square'];
  const targets = p.group ? state.posts.filter(q => q.group === p.group) : [p];
  targets.forEach(q => { q.sizes = list.slice(); if (!q.sizes.includes(q.view)) q.view = q.sizes[0]; markEdited(q); });
}
function sizeTiles(sel, onToggle, fk) {
  return h('div', { class: 'sztiles', role: 'group', 'aria-label': 'Sizes' }, SIZES.map(s => {
    const on = sel.includes(s.id);
    return h('button', { type: 'button', class: 'sztile' + (on ? ' on' : ''), 'aria-pressed': on, title: sizeTip(s.id), 'data-fk': fk ? fk + s.id : null, onclick: () => onToggle(s.id) }, h('span', { class: 'szsh' }, shapeIcon(s.id, 22)), h('span', { class: 'szl' }, SHORT[s.id]), on ? h('span', { class: 'szck' }, icon('check', 11)) : null);
  }));
}
function parseSizes(v) {
  const s = (v || '').toLowerCase(); if (!s.trim()) return null;
  const T = [['square', /square|(?<![\d.])1\s*:\s*1(?![\d.])|1080\s*[x×]\s*1080/], ['portrait', /portrait|(?<![\d.])4\s*:\s*5(?![\d.])|1080\s*[x×]\s*1350/], ['story', /stor(y|ies)|reels?\b|(?<![\d.])9\s*:\s*16(?![\d.])|1080\s*[x×]\s*1920/], ['landscape', /link|landscape|1\.91|1200\s*[x×]\s*630/], ['wide', /wide|(?<![\d.])16\s*:\s*9(?![\d.])|1600\s*[x×]\s*900/]];
  const out = T.filter(([, re]) => re.test(s)).map(([id]) => id);
  return out.length ? out : null;
}

/* ===== Photo position and zoom, kept for each size. A missing position means: centre on the subject. ===== */
const FK = slot => slot === 2 ? 'frames2' : 'frames';
function frameOf(p, id, slot) {
  const f = p[FK(slot)] && p[FK(slot)][id]; if (f) return f;
  return slot === 2 ? { fx: p.fx2 == null ? null : p.fx2, fy: p.fy2 == null ? null : p.fy2, zoom: p.zoom2 || 1 } : { fx: p.fx == null ? null : p.fx, fy: p.fy == null ? null : p.fy, zoom: p.zoom || 1 };
}
function ownFrame(p, id, slot) { const k = FK(slot); if (!p[k]) p[k] = {}; if (!p[k][id]) p[k][id] = Object.assign({}, frameOf(p, id, slot)); return p[k][id]; }

/* ===== Carousels and numbering ===== */
const gid = () => uid('g');
function normalizeGroups() {
  let prevG = null, curNew = null; const seen = new Set();
  state.posts.forEach(p => {
    if (!p.group) { prevG = null; curNew = null; return; }
    if (p.group === prevG) { if (curNew) p.group = curNew; return; }
    prevG = p.group;
    if (seen.has(p.group)) { curNew = gid(); p.group = curNew; } else { curNew = null; seen.add(p.group); }
  });
  const count = {}; state.posts.forEach(p => { if (p.group) count[p.group] = (count[p.group] || 0) + 1; });
  state.posts.forEach(p => { if (p.group && count[p.group] < 2) p.group = null; });
}
/* feed numbers: a carousel counts as one post, its slides are 3·1, 3·2 and so on */
function numbering() {
  const map = new Map(), count = {}; let n = 0, k = 0, lastG = null;
  state.posts.forEach(p => { if (p.group) count[p.group] = (count[p.group] || 0) + 1; });
  state.posts.forEach(p => { if (p.group && p.group === lastG) k++; else { n++; k = 1; lastG = p.group || null; } map.set(p.id, { n, k, g: p.group || null, total: p.group ? count[p.group] : 1 }); });
  return map;
}
function postLabel(p, num) { const v = (num || numbering()).get(p.id); if (!v) return '?'; return v.g ? v.n + '·' + v.k : String(v.n); }

/* ===== Brand checks ===== */
function isAllCaps(s) { const l = (s || '').replace(/[^A-Za-z]/g, ''); return l.length >= 4 && l === l.toUpperCase(); }
function toSentence(s) { return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); }
const NEED_MSG = { headline: 'a headline', label: 'a product name', footer: 'a footer message', price: 'a price', f1: 'at least one feature', day: 'a date', t1: 'at least one tip' };
const CHECKS = new Map();
function checkSig(p) {
  const im = x => x ? (x.sample ? 's:' + (x.key || '') : (x.id || x.name || '?')) : '-';
  return JSON.stringify([p.tpl, p.opts, TEXT_KEYS.map(k => p[k]), im(p.img), im(p.img2), im(p.partner), p.zoom, p.zoom2, p.fx, p.fy, p.frames, p.frames2, p.layers, Object.keys(ASSET_IMG).length]);
}
function checkPost(p, sizeIds, o) {
  o = o || {}; const key = p.id + '|' + sizeIds.join(',') + '|' + (o.skipSample ? 1 : 0), sig = checkSig(p), hitc = CHECKS.get(key);
  if (hitc && hitc.obj === p && hitc.sig === sig) return hitc.res;
  if (CHECKS.size > 800) CHECKS.clear();
  const res = checkPostRaw(p, sizeIds, o); CHECKS.set(key, { obj: p, sig, res }); return res;
}
function checkPostRaw(p, sizeIds, o) {
  const t = TPL[p.tpl], out = [], seen = new Set();
  const add = (lvl, msg, fix, size) => { if (!seen.has(msg)) { seen.add(msg); out.push({ lvl, msg, fix, size }); } };
  const c = document.createElement('canvas'), toneOpt = t.options.find(g => g.id === 'tone' && g.values.some(v => v.id === 'dark'));
  sizeIds.forEach(id => {
    const S = SIZE[id], nm = S.name.toLowerCase(), R = renderPost(c, p, S, 0.16, { measure: true }), sf = SAFE(S.w, S.h);
    R.over.forEach(w => add('warn', w + ' is too long to fit the ' + nm + ' size. Shorten it.', null, id));
    if (R.minScale > 1.7 && !R.sample) add('warn', 'The photo is small for the ' + nm + ' size and may look soft. Use a larger photo or zoom out.', null, id);
    if (R.noPhoto) add('warn', 'This template needs a photo.');
    if (R.noPhoto2) add('warn', 'Add the second photo.');
    if (R.contrast.length) add('warn', 'Some text may be hard to read on the photo in the ' + nm + ' size.' + (toneOpt ? '' : ' Move the photo or try another layout.'), toneOpt ? () => { const cur = effOpts(p).tone; p.opts = Object.assign({}, p.opts, { tone: cur === 'dark' ? 'light' : 'dark' }); } : null, id);
    R.layers.forEach(l => {
      if (l.x < -1 || l.y < -1 || l.x + l.w > S.w + 1 || l.y + l.h > S.h + 1) add('warn', 'A sticker or logo is cut off at the edge of the ' + nm + ' size.', null, id);
      if (R.logos.some(g => hit(l, g))) add('warn', 'A sticker covers the American Standard logo in the ' + nm + ' size.', null, id);
      else if (R.texts.some(x => hit(l, x))) add('warn', 'A sticker covers text in the ' + nm + ' size.', null, id);
      if (sf.t && (l.y < sf.t || l.y + l.h > S.h - sf.b)) add('warn', 'A sticker sits where the Story buttons cover it.', null, id);
    });
    if (R.missingAsset) add('warn', 'A sticker or logo on this post is missing from your library.', () => { p.layers = (p.layers || []).filter(l => ASSET_IMG[l.asset]); });
  });
  const fields = ['headline', 'sub', 'label', 'footer', 'tag', 'name', 'role', 'f1', 'f2', 'f3', 't1', 't2', 't3', 't4', 'month', 'label1', 'label2'];
  const caps = fields.filter(k => isAllCaps(p[k]));
  if (caps.length) add('error', 'Text is in all capitals. The brand uses sentence case.', () => { caps.forEach(k => { p[k] = toSentence(p[k]); }); });
  if (t.fields.some(f => f.k === 'keyword') && p.keyword && p.keyword.trim() && !kwFound(p.headline, p.keyword)) add('warn', 'The underline word is not in the headline.');
  t.needs.forEach(k => { if (!(p[k] || '').trim()) add('warn', 'Add ' + (NEED_MSG[k] || 'the ' + k) + '.'); });
  if (['banner', 'promo'].includes(t.id) && (p.headline || '').length > 48) add('warn', 'Banners are for short key messages. Try fewer words.');
  if (((p.img && p.img.sample) || (t.fields.some(f => f.image2) && p.img2 && p.img2.sample)) && !o.skipSample) add('warn', 'This post still uses a sample photo.');
  if ((p.caption || '').length > 2200) add('warn', 'The caption is over Instagram’s 2,200 character limit.');
  if (((p.caption || '').match(/#[\p{L}\p{N}_]+/gu) || []).length > 30) add('warn', 'The caption has more than 30 hashtags. Instagram allows 30.');
  return out;
}
const rowBad = p => checkPost(p, sizesOf(p), { skipSample: p.demo }).length > 0;

/* ===== Images ===== */
function newImgId() { return uid('i'); }
async function loadFile(file, max) {
  max = max || 2400;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) {
    bmp = await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  }
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
  return { src: c, name: file.name, sample: false, ow: bmp.width, oh: bmp.height, id: newImgId(), focus: computeFocus(c) };
}
const isImageFile = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(f.name);
