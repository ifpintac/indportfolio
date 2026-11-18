/* American Standard social post maker: the Build posts step. */
let stage = null, raf = 0, lastR = null, listEl = null, ro = null, dragId = null;

function refresh() { scheduleSave(); if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (state.mode === 'post') { drawStage(); drawChecks(); } drawRow(state.sel); barStatus(); }); }
const rowText = p => (p.headline || p.label || p.day || '').trim() || 'No words yet';
const railDate = d => { const t = new Date(d); return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); };
const shortDate = d => { const t = new Date(d); return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + (/T\d/.test(d) ? ', ' + t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''); };

/* ===== Adding posts ===== */
async function addPhotos(files) {
  files = [...files].filter(isImageFile);
  if (!files.length) { toast('Those files are not photos. Use JPG, PNG or WebP.'); return; }
  const tplName = TPL[state.tpl].name, szs = (state.newSizes || ['square']).slice(); dropDemos(); let last = null, n = 0;
  toast('Adding ' + plural(files.length, 'photo') + '…');
  for (const f of files) { try { const img = await loadFile(f); const p = newPost({ img }); state.posts.push(p); last = p; n++; } catch (e) { toast('Could not open ' + f.name); } }
  reindex(); if (last) state.sel = last.id; if (state.view !== 'build') go(1); else render();
  scheduleSave(); toast(plural(n, 'photo') + ' added as ' + tplName + ', in ' + sizeListText(szs) + '. You can change both for each post.');
}
function addBlank() { dropDemos(); const q = newPost(); state.posts.push(q); state.sel = q.id; reindex(); render(); scheduleSave(); }
function photoBtn(label, cls, replaceId, title, slot) {
  const inp = h('input', { type: 'file', accept: 'image/*', multiple: !replaceId, class: 'sr', tabindex: '-1', onchange: async e => {
    const fs = e.target.files; if (!fs.length) return;
    if (replaceId) {
      try { const img = await loadFile(fs[0]), q = getPost(replaceId); if (!q) return; snap(); if (slot === 2) Object.assign(q, { img2: img, fx2: null, fy2: null, zoom2: 1, frames2: {} }); else Object.assign(q, { img, fx: null, fy: null, zoom: 1, frames: {} }); markEdited(q); render(); }
      catch (er) { toast('Could not open that photo.'); }
    } else addPhotos(fs);
    e.target.value = '';
  } });
  return h('label', { class: cls, tabindex: '0', role: 'button', title: title || null, 'aria-label': title || null, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } } }, label, inp);
}
function dupPost(p) { snap(); const q = Object.assign(clonePost(p), { id: nextId++, demo: false }); state.posts.splice(state.posts.indexOf(p) + 1, 0, q); state.sel = q.id; normalizeGroups(); render(); scheduleSave(); withUndo('Post duplicated.'); }
function removePost(p) { snap(); const i = state.posts.indexOf(p); state.posts.splice(i, 1); state.sel = state.posts.length ? state.posts[Math.min(i, state.posts.length - 1)].id : null; normalizeGroups(); render(); scheduleSave(); withUndo('Post removed.'); }
function dupPicked() { snap(); state.posts.filter(p => state.picked.has(p.id)).forEach(p => { const q = Object.assign(clonePost(p), { id: nextId++, demo: false }); state.posts.splice(state.posts.indexOf(p) + 1, 0, q); }); state.picked.clear(); normalizeGroups(); render(); scheduleSave(); withUndo('Posts duplicated.'); }
function removePicked() { snap(); state.posts = state.posts.filter(p => !state.picked.has(p.id)); state.picked.clear(); if (!getPost(state.sel)) state.sel = state.posts.length ? state.posts[0].id : null; normalizeGroups(); render(); scheduleSave(); withUndo('Posts removed.'); }

/* ===== Order and carousels ===== */
function movePost(id, d) {
  const i = state.posts.findIndex(p => p.id === id); if (i < 0) return; const j = i + d; if (j < 0 || j >= state.posts.length) return;
  snap(); const p = state.posts[i], nb = state.posts[j];
  if (p.group) { if (nb.group === p.group) { state.posts.splice(i, 1); state.posts.splice(j, 0, p); } else p.group = null; }
  else if (nb.group) { const idx = state.posts.map((q, k) => q.group === nb.group ? k : -1).filter(k => k >= 0), at = d > 0 ? Math.max(...idx) : Math.min(...idx); state.posts.splice(i, 1); state.posts.splice(at, 0, p); }
  else { state.posts.splice(i, 1); state.posts.splice(j, 0, p); }
  normalizeGroups(); reindex(); render(); scheduleSave();
}
function movePostTo(id, targetId, after) {
  const p = getPost(id), t = getPost(targetId); if (!p || !t || p === t) return;
  snap(); state.posts.splice(state.posts.indexOf(p), 1);
  const j = state.posts.indexOf(t) + (after ? 1 : 0); state.posts.splice(j, 0, p);
  const next = state.posts[j + 1];
  if (t.group && (!after || (next && next.group === t.group))) { p.group = t.group; const sz = sizesOf(t); p.sizes = sz.slice(); if (!p.sizes.includes(p.view)) p.view = sz[0]; } else p.group = null;
  normalizeGroups(); reindex(); render(); scheduleSave();
}
function makeCarousel() {
  const moving = state.posts.filter(p => state.picked.has(p.id));
  if (moving.length < 2) { toast('Tick two or more posts to make a carousel.'); return; }
  if (moving.length > 20) { toast('A carousel can have up to 20 slides.'); return; }
  snap(); const g = gid(), first = state.posts.indexOf(moving[0]), rest = state.posts.filter(p => !state.picked.has(p.id));
  rest.splice(state.posts.slice(0, first).filter(p => !state.picked.has(p.id)).length, 0, ...moving); state.posts = rest;
  const sz = sizesOf(moving[0]).slice(); moving.forEach(p => { p.group = g; p.sizes = sz.slice(); if (!p.sizes.includes(p.view)) p.view = sz[0]; markEdited(p); });
  normalizeGroups(); state.picked.clear(); state.sel = moving[0].id; render(); scheduleSave();
  withUndo('Carousel made with ' + moving.length + ' slides. They share the sizes of the first slide.');
}
function ungroup(g) { snap(); state.posts.forEach(p => { if (p.group === g) p.group = null; }); render(); scheduleSave(); withUndo('Carousel split into single posts.'); }

/* ===== Stickers and logos on posts ===== */
function addLayerTo(ids, assetId) {
  const a = assetById(assetId); if (!a) return; snap();
  ids.forEach(id => { const p = getPost(id); if (!p) return; const L = { id: uid('l'), asset: assetId, s: a.kind === 'logo' ? 0.22 : a.kind === 'badge' ? 0.2 : 0.24, pos: {} }; (p.layers = p.layers || []).push(L); markEdited(p); if (p.id === state.sel) state.layerSel = L.id; });
  state.secOpen.stickers = true; render(); scheduleSave(); toast(ids.length === 1 ? a.name + ' added. Drag it in the preview to place it.' : a.name + ' added to ' + plural(ids.length, 'post') + '.');
}
function removeLayer(p, id) { snap(); p.layers = (p.layers || []).filter(l => l.id !== id); if (state.layerSel === id) state.layerSel = null; markEdited(p); render(); withUndo('Sticker removed.'); }
function layerCenter(p, L) { const v = viewOf(p), S = SIZE[v], pp = L.pos && L.pos[v]; if (pp) return pp; const r = lastR && lastR.layers.find(x => x.id === L.id); return r ? { x: (r.x + r.w / 2) / S.w, y: (r.y + r.h / 2) / S.h, s: L.s || 0.2 } : { x: 0.8, y: 0.2, s: L.s || 0.2 }; }
function setLayerSize(p, L, s, el) { if (!el.dataset.snapped) { snap(); el.dataset.snapped = '1'; } const v = viewOf(p), c = layerCenter(p, L); L.pos = L.pos || {}; L.pos[v] = { x: c.x, y: c.y, s }; markEdited(p); refresh(); }
function layersToAll(p) { snap(); (p.layers || []).forEach(L => { const c = layerCenter(p, L); L.pos = {}; sizesOf(p).forEach(id => { L.pos[id] = { x: c.x, y: c.y, s: c.s }; }); }); markEdited(p); refresh(); withUndo('Stickers now sit in the same spot in every size.'); }
function syncLayerList() { $$('.stkrow').forEach(r => r.classList.toggle('on', r.dataset.lid === state.layerSel)); }

/* ===== Photo position helpers ===== */
const frameNote = p => sizesOf(p).length > 1 ? 'Position and zoom apply to ' + SHORT[viewOf(p)] + ' only. Each size keeps its own.' : 'Drag the photo in the preview to move it.';
function syncPhotoControls() {
  const p = selPost(); if (!p) return; const v = viewOf(p);
  [1, 2].forEach(slot => { const z = $('#zoom' + slot); if (z) { z.value = Math.round((frameOf(p, v, slot).zoom || 1) * 100); z.setAttribute('aria-label', 'Zoom for the ' + SIZE[v].name + ' size'); } });
  $$('.zoomFor').forEach(e => { e.textContent = SHORT[v]; }); $$('.frameNote').forEach(e => { e.textContent = frameNote(p); });
}
function resetFrame(p, slot) { snap(); const f = ownFrame(p, viewOf(p), slot); f.fx = null; f.fy = null; f.zoom = 1; markEdited(p); syncPhotoControls(); refresh(); }
function frameToAll(p) {
  const v = viewOf(p), f1 = Object.assign({}, frameOf(p, v, 1)), f2 = Object.assign({}, frameOf(p, v, 2)); snap();
  Object.assign(p, { fx: f1.fx, fy: f1.fy, zoom: f1.zoom, frames: {}, fx2: f2.fx, fy2: f2.fy, zoom2: f2.zoom, frames2: {} });
  markEdited(p); syncPhotoControls(); refresh(); withUndo('All sizes of this post now use this position and zoom.');
}

/* ===== The view ===== */
function viewBuild() {
  if (!state.posts.length) {
    state.sel = null;
    return h('div', { class: 'empty' }, h('div', { class: 'emptybox' }, h('span', { class: 'bigic' }, icon('images', 44)), h('h1', { class: 'title' }, 'Add your photos'),
      h('p', { class: 'lede' }, 'Drop photos anywhere on this page, or choose them from your computer. Each photo becomes one post. You can mix templates, sizes and carousels later.'),
      h('div', { class: 'rowbtns' }, photoBtn([icon('upload', 18), 'Choose photos'], 'btn primary'), h('button', { class: 'btn', onclick: addBlank }, icon('plus', 18), 'Start without a photo'), h('button', { class: 'btn', onclick: openPaste }, icon('paste', 18), 'Paste words from a spreadsheet'))));
  }
  if (!getPost(state.sel)) state.sel = state.posts[0].id;
  const p = selPost();
  listEl = h('div', { class: 'plist', 'data-keep': 'plist' });
  const rail = h('aside', { class: 'col rail', 'aria-label': 'Your posts' },
    h('div', { class: 'railhead' }, h('h2', null, 'Posts'), h('span', { class: 'count' }, String(state.posts.length)), h('span', { class: 'grow' }), photoBtn(icon('image', 18), 'ibtn', null, 'Add photos'), ib('plus', 'Add a blank post', addBlank), ib('paste', 'Paste or import words', openPaste)),
    h('div', { class: 'railsub' }, h('button', { id: 'selall', class: 'link', onclick: toggleAll }, 'Select all'), h('span', { class: 'grow' }), h('span', { class: 'small muted' }, 'Drag to reorder')),
    listEl);
  const center = state.mode === 'feed' ? viewFeed() : viewStage(p);
  const editor = h('aside', { class: 'col edit', 'data-keep': 'edit', 'aria-label': 'Edit post' }, buildEditor(p));
  buildList();
  requestAnimationFrame(() => { buildBulk(); if (state.mode === 'post') { const sb = $('.stagebox'); if (ro) ro.disconnect(); if (sb) { ro = new ResizeObserver(() => fitStage()); ro.observe(sb); } drawStage(); drawChecks(); } barStatus(); });
  return h('div', { class: 'work s1' }, rail, center, editor);
}
function modeSwitch() { return h('div', { class: 'seg modes', role: 'tablist', 'aria-label': 'View' }, [['post', 'image', 'Post'], ['feed', 'grid', 'Feed']].map(([id, ic, l]) => h('button', { role: 'tab', class: state.mode === id ? 'on' : '', 'aria-selected': state.mode === id, title: id === 'feed' ? 'See how the posts sit together on your profile' : 'Edit one post', onclick: () => { state.mode = id; render(); } }, icon(ic, 16), h('span', { class: 'sl' }, l)))); }

/* ----- Rail ----- */
function buildList() {
  listEl.innerHTML = ''; listEl.classList.toggle('anysel', state.picked.size > 0);
  const num = numbering(); let box = null, curG = null;
  state.posts.forEach((p, i) => {
    const v = num.get(p.id);
    if (v.g && v.g !== curG) { curG = v.g; const g = v.g; box = h('div', { class: 'grpbox' }, h('div', { class: 'grphead' }, icon('carousel', 15), h('span', null, 'Carousel · ' + plural(v.total, 'slide')), h('span', { class: 'grow' }), h('button', { class: 'link small', title: 'Turn the slides back into single posts', onclick: () => ungroup(g) }, 'Split'))); listEl.append(box); }
    if (!v.g) { curG = null; box = null; }
    (box || listEl).append(postRow(p, i, v));
  });
}
function postRow(p, i, v) {
  const lab = v.g ? v.n + '·' + v.k : String(v.n), S = SIZE[viewOf(p)], c = h('canvas', { 'aria-hidden': 'true' });
  const cb = h('input', { type: 'checkbox', class: 'pcb', 'aria-label': 'Tick post ' + lab, checked: state.picked.has(p.id), onclick: e => e.stopPropagation(), onchange: e => { if (e.target.checked) state.picked.add(p.id); else state.picked.delete(p.id); listEl.classList.toggle('anysel', state.picked.size > 0); buildBulk(); } });
  const up = ib('up', 'Move post ' + lab + ' up', e => { e.stopPropagation(); movePost(p.id, -1); }, 'sm'), dn = ib('down', 'Move post ' + lab + ' down', e => { e.stopPropagation(); movePost(p.id, 1); }, 'sm');
  up.disabled = i === 0; dn.disabled = i === state.posts.length - 1;
  const pick = () => { state.sel = p.id; state.layerSel = null; render(); };
  const row = h('div', { class: 'prow' + (p.id === state.sel ? ' on' : '') + (rowBad(p) ? ' bad' : '') + (p.export === false ? ' skip' : ''), 'data-row': p.id, role: 'button', tabindex: '0', draggable: 'true', 'aria-current': p.id === state.sel ? 'true' : null, onclick: pick, onkeydown: e => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(); } } },
    h('div', { class: 'pth' }, c, cb),
    h('div', { class: 'pmeta' }, h('b', null, h('span', { class: 'pn' }, lab), h('span', { class: 'ptext' }, rowText(p))), h('span', { class: 'ptpl' }, h('span', { class: 'szg', title: sizeListText(sizesOf(p)) }, sizesOf(p).map(id => shapeIcon(id, 10))), TPL[p.tpl].name), p.date ? h('span', { class: 'pdate' }, icon('calendar', 12), railDate(p.date)) : null),
    h('div', { class: 'mv' }, up, dn));
  row.addEventListener('dragstart', e => { dragId = p.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/x-post', String(p.id)); } catch (er) { } row.classList.add('dragging'); });
  row.addEventListener('dragend', () => { dragId = null; row.classList.remove('dragging'); $$('.dropa,.dropb').forEach(r => r.classList.remove('dropa', 'dropb')); });
  row.addEventListener('dragover', e => { if (dragId == null || dragId === p.id) return; e.preventDefault(); const r = row.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; row.classList.toggle('dropa', after); row.classList.toggle('dropb', !after); });
  row.addEventListener('dragleave', () => row.classList.remove('dropa', 'dropb'));
  row.addEventListener('drop', e => { if (dragId == null) return; e.preventDefault(); e.stopPropagation(); const after = row.classList.contains('dropa'); row.classList.remove('dropa', 'dropb'); const id = dragId; dragId = null; if (id !== p.id) movePostTo(id, p.id, after); });
  const sc = 56 / Math.max(S.w, S.h); renderPost(c, p, S, sc * 2); c.style.width = Math.round(S.w * sc) + 'px'; c.style.height = Math.round(S.h * sc) + 'px';
  return row;
}
function drawRow(id) {
  const p = getPost(id), row = $('[data-row="' + id + '"]'); if (!p || !row) return;
  const c = $('canvas', row), S = SIZE[viewOf(p)], sc = 56 / Math.max(S.w, S.h); renderPost(c, p, S, sc * 2); c.style.width = Math.round(S.w * sc) + 'px'; c.style.height = Math.round(S.h * sc) + 'px';
  const t = $('.ptext', row); if (t) t.textContent = rowText(p); row.classList.toggle('bad', rowBad(p));
}
function toggleAll() { const all = state.picked.size === state.posts.length; if (all) state.picked.clear(); else state.posts.forEach(p => state.picked.add(p.id)); $$('.pcb').forEach(i => { i.checked = !all; }); listEl.classList.toggle('anysel', state.picked.size > 0); buildBulk(); }

/* ----- Several posts at once ----- */
const BULK_FIELDS = [['headline', 'Headline'], ['keyword', 'Word to underline'], ['sub', 'Second line or details'], ['label', 'Label or product name'], ['footer', 'Footer message'], ['tag', 'Small line or feature'], ['price', 'Price'], ['was', 'Old price'], ['fine', 'Fine print'], ['day', 'Event date'], ['month', 'Event month'], ['name', 'Name'], ['role', 'Role'], ['caption', 'Caption'], ['alt', 'Alt text']];
const bulkState = { field: 'headline', value: '' };
function buildBulk() {
  state.picked = new Set([...state.picked].filter(id => getPost(id)));
  const bar = $('#selbar'), n = state.picked.size, sa = $('#selall'); if (sa) sa.textContent = n === state.posts.length ? 'Clear' : 'Select all';
  if (!bar) return; bar.innerHTML = ''; bar.hidden = !n; if (!n) return;
  const sb = (ic, l, fn, tip) => h('button', { class: 'sbtn', title: tip || null, onclick: fn }, icon(ic, 16), h('span', null, l));
  const si = (ic, l, fn, cls) => h('button', { class: 'sbtn ionly' + (cls ? ' ' + cls : ''), title: l, 'aria-label': l, onclick: fn }, icon(ic, 17));
  bar.append(...[h('b', { class: 'selcount' }, n + ' selected'), sb('layout', 'Template', () => openPicker('picked'), 'Give every ticked post the same template'), sb('ratio', 'Sizes', () => openBulkSizes(), 'Give every ticked post the same sizes'), sb('sticker', 'Sticker', () => openAssetPicker(id => addLayerTo([...state.picked], id)), 'Add a sticker or logo to every ticked post'), sb('type', 'Words', openBulkWords, 'Give every ticked post the same words'),
    n >= 2 ? sb('carousel', 'Carousel', makeCarousel, 'Turn the ticked posts into one carousel') : null, h('span', { class: 'grow' }),
    aiReady() ? si('sparkles', 'Write alt text for every ticked post with Claude', () => aiAltBatch([...state.picked])) : null,
    si('copy', 'Duplicate the ticked posts', dupPicked), si('trash', 'Remove the ticked posts', removePicked, 'danger'),
    si('x', 'Clear selection', () => { state.picked.clear(); $$('.pcb').forEach(i => { i.checked = false; }); listEl.classList.remove('anysel'); buildBulk(); })].filter(Boolean));
}
function openBulkSizes(ids, title) {
  ids = (ids || [...state.picked]).filter(id => getPost(id)); if (!ids.length) return;
  const posts = ids.map(getPost);
  let sel = SIZE_ORDER.filter(id => posts.every(p => sizesOf(p).includes(id))); if (!sel.length) sel = sizesOf(posts[0]).slice();
  const holder = h('div'), note = h('p', { class: 'help' });
  const apply = h('button', { class: 'btn primary', onclick: () => { if (!sel.length) return; snap(); posts.forEach(p => setPostSizes(p, sel)); closeModal(); render(); withUndo((posts.length === 1 ? 'Post' : posts.length + ' posts') + ' set to ' + sizeListText(sel) + '.'); } }, icon('check', 18), 'Apply');
  const draw = id => {
    holder.innerHTML = ''; holder.append(sizeTiles(sel, x => { sel = sel.includes(x) ? sel.filter(y => y !== x) : sortSizes(sel.concat(x)); draw(x); }, 'bs-'));
    note.textContent = sel.length ? (posts.length === 1 ? 'This post' : 'Each of the ' + posts.length + ' posts') + ' will download in ' + sizeListText(sel) + '.' : 'Pick at least one size.';
    apply.disabled = !sel.length; const f = $('[data-fk="bs-' + (id || sel[0] || 'square') + '"]', holder); if (f) f.focus();
  };
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'bsT' }, h('h2', { id: 'bsT', class: 'title' }, title || ('Sizes for ' + plural(posts.length, 'post'))), holder, note, h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), apply)));
  draw();
}
function openBulkWords() {
  const ids = [...state.picked].filter(id => getPost(id)); if (!ids.length) return;
  const uses = k => k === 'caption' || k === 'alt' ? ids.length : ids.filter(id => TPL[getPost(id).tpl].fields.some(f => f.k === k)).length;
  const list = BULK_FIELDS.filter(([k]) => uses(k) > 0); if (!list.some(([k]) => k === bulkState.field)) bulkState.field = list[0][0];
  const note = h('p', { class: 'help' }), upd = () => { const n = uses(bulkState.field); note.textContent = n === ids.length ? 'Every ticked post shows this text.' : 'Shows on ' + n + ' of the ' + ids.length + ' ticked posts. The others use templates without it.'; };
  const fsel = h('select', { id: 'b-field', onchange: e => { bulkState.field = e.target.value; upd(); } }, list.map(([k, l]) => h('option', { value: k, selected: k === bulkState.field }, l))); upd();
  const finp = h('input', { id: 'b-value', type: 'text', value: bulkState.value, autofocus: true, placeholder: 'Same text for every selected post', oninput: e => { bulkState.value = e.target.value; } });
  const apply = () => { if (!bulkState.value.trim()) { toast('Type the text first.'); return; } snap(); ids.forEach(id => { const p = getPost(id); if (p) { p[bulkState.field] = bulkState.value; markEdited(p); } }); closeModal(); render(); withUndo('Updated ' + plural(ids.length, 'post') + '.'); };
  finp.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'bwT' }, h('h2', { id: 'bwT', class: 'title' }, 'Same words for ' + plural(ids.length, 'post')),
    h('div', { class: 'field' }, h('label', { for: 'b-field' }, 'Which text'), fsel, note), h('div', { class: 'field' }, h('label', { for: 'b-value' }, 'Text'), finp),
    h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: apply }, 'Apply'))));
}

/* ----- The stage ----- */
function viewTabs(p) {
  const a = sizesOf(p), v = viewOf(p);
  if (a.length === 1) return h('span', { class: 'onesize', title: sizeTip(v) }, shapeIcon(v, 16), h('b', null, SHORT[v]), h('span', { class: 'muted' }, SIZE[v].w + '×' + SIZE[v].h));
  return h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Preview size' }, a.map(id => h('button', { role: 'tab', 'data-size': id, class: id === v ? 'on' : '', 'aria-selected': id === v, title: sizeTip(id), onclick: () => setView(id) }, shapeIcon(id, 16), h('span', { class: 'sl' }, SHORT[id]))));
}
function setView(id) {
  const p = selPost(); if (!p) return; p.view = id; scheduleSave();
  $$('.tools .seg[aria-label="Preview size"] button').forEach(b => { const on = b.dataset.size === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  drawStage(); drawChecks(); syncPhotoControls(); const sl = $$('.stkrow input[type=range]'); (p.layers || []).forEach((L, i) => { if (sl[i]) sl[i].value = Math.round(layerCenter(p, L).s * 100); });
}
function viewStage(p) {
  stage = h('canvas', { id: 'stage', tabindex: '0', 'aria-label': 'Post preview. Drag the photo or a sticker to move it. Arrow keys nudge it.' });
  const demo = state.posts.some(q => q.demo) ? h('div', { class: 'strip' }, h('span', null, h('b', null, 'Example posts. '), 'Add your photos to replace them. Every post can use its own template and sizes.'), photoBtn([icon('image', 16), 'Add photos'], 'btn small primary')) : null;
  const phoneBtn = h('button', { class: 'btn small', 'aria-pressed': state.phone, title: 'See the post inside a phone feed or Story', onclick: e => { state.phone = !state.phone; e.currentTarget.setAttribute('aria-pressed', state.phone); drawStage(); } }, icon('phone', 16), h('span', { class: 'sl2' }, 'Phone'));
  const safeBtn = h('button', { id: 'safeBtn', class: 'btn small', 'aria-pressed': state.safe, title: 'Show the areas that apps cover', onclick: e => { state.safe = !state.safe; e.currentTarget.setAttribute('aria-pressed', state.safe); drawSafe(); } }, icon('scan', 16), h('span', { class: 'sl2' }, 'Safe zones'));
  const img = h('div', { class: 'cvimg' }, stage, h('div', { id: 'safe', class: 'safe', hidden: true }), h('div', { id: 'lyr', class: 'lyr' }), h('div', { class: 'ph-over' }));
  const stagebox = h('div', { class: 'stagebox' }, h('div', { class: 'cv' }, h('div', { class: 'ph-top' }), img, h('div', { class: 'ph-bot' })), h('span', { id: 'sampleBadge', class: 'badge', hidden: true }, 'Sample photo'));
  setupStagePointer(img);
  return h('section', { class: 'col center' }, demo,
    h('div', { class: 'tools' }, modeSwitch(), h('span', { class: 'tsep' }), viewTabs(p), h('button', { class: 'link small chg', onclick: focusSizes }, 'Change sizes'), h('span', { class: 'grow' }), phoneBtn, safeBtn),
    h('div', { id: 'selbar', class: 'selbar', hidden: true }), stagebox, h('div', { id: 'checks', class: 'checks', hidden: true }),
    h('div', { class: 'under' }, h('span', { class: 'hint' }, 'Drag the photo or a sticker to move it in this size.'), h('span', { class: 'grow' }), h('button', { id: 'chkpill', class: 'pill', onclick: () => { state.checksOpen = !state.checksOpen; drawChecks(); } })));
}
function focusSizes() { const b = $('[data-sec="sizes"]'); if (!b) return; b.open = true; state.secOpen.sizes = true; b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); const t = $('.sztile', b); if (t) t.focus({ preventScroll: true }); }
function fitStage() {
  const box = $('.stagebox'), cv = $('.cv'), img = $('.cvimg'), p = selPost(); if (!box || !cv || !img || !p) return;
  const sz = SIZE[viewOf(p)], story = sz.h / sz.w > 1.7, ph = state.phone, topH = ph && !story ? 50 : 0, botH = ph && !story ? 92 : 0;
  const aw = box.clientWidth - 40, ah = box.clientHeight - 40 - topH - botH; if (aw <= 0 || ah <= 0) return;
  let k = Math.min(aw / sz.w, ah / sz.h); if (ph) k = Math.min(k, (story ? 330 : 380) / sz.w);
  const iw = Math.floor(sz.w * k), ihh = Math.floor(sz.h * k);
  img.style.width = iw + 'px'; img.style.height = ihh + 'px'; cv.style.width = iw + 'px'; cv.style.height = (ihh + topH + botH) + 'px';
  cv.classList.toggle('phone', ph); cv.classList.toggle('story', ph && story);
  drawLayerBoxes();
}
function drawStage() {
  const p = selPost(); if (!stage || !p) return;
  lastR = renderPost(stage, p, SIZE[viewOf(p)], 1); fitStage(); drawSafe(); drawPhone(p);
  const badge = $('#sampleBadge'); if (badge) badge.hidden = !lastR.sample;
}
function drawSafe() {
  const el = $('#safe'), p = selPost(); if (!el || !p) return; el.innerHTML = ''; const v = viewOf(p), has = v === 'story' || v === 'portrait';
  el.hidden = !state.safe || !has; const sb = $('#safeBtn'); if (sb) sb.hidden = !has; if (!has) return;
  const band = (css, label) => h('div', { class: 'band', style: css }, h('span', null, label));
  if (v === 'story') el.append(band('top:0;left:0;right:0;height:13%', 'App buttons cover this area'), band('bottom:0;left:0;right:0;height:17.7%', 'Reply bar covers this area'));
  else { el.append(band('top:0;bottom:0;left:0;width:3.1%', ''), band('top:0;bottom:0;right:0;width:3.1%', '')); el.append(h('div', { class: 'safenote' }, 'The profile grid crops the sides')); }
}
function drawPhone(p) {
  const top = $('.ph-top'), bot = $('.ph-bot'), over = $('.ph-over'); if (!top) return;
  [top, bot, over].forEach(e => { e.innerHTML = ''; }); if (!state.phone) return;
  const v = viewOf(p), story = SIZE[v].h / SIZE[v].w > 1.7, name = 'American Standard', av = () => h('span', { class: 'ph-av' }, h('img', { src: ASSETS.logos.ib, alt: '' }));
  if (story) {
    over.append(h('div', { class: 'ph-st-top' }, h('div', { class: 'ph-bars' }, h('i', { class: 'on' }), h('i'), h('i')), h('div', { class: 'ph-st-id' }, av(), h('b', null, name), h('span', null, '2h'))),
      h('div', { class: 'ph-st-bot' }, h('span', { class: 'ph-reply' }, 'Send message'), icon('heart', 22), icon('send', 22)));
  } else {
    top.append(av(), h('b', null, name), h('span', { class: 'grow' }), icon('more', 18));
    const cap = (p.caption || p.headline || p.label || '').trim().replace(/\s+/g, ' '), cut = cap.length > 86;
    bot.append(h('div', { class: 'ph-acts' }, icon('heart', 22), icon('comment', 22), icon('send', 22), h('span', { class: 'grow' }), p.group ? h('span', { class: 'ph-dots' }, h('i', { class: 'on' }), h('i'), h('i')) : null, h('span', { class: 'grow' }), icon('bookmark', 22)),
      h('p', { class: 'ph-cap' }, h('b', null, name + ' '), cut ? cap.slice(0, 86).trim() + '… ' : cap, cut ? h('span', { class: 'muted' }, 'more') : null));
  }
}
function drawLayerBoxes() {
  const box = $('#lyr'), p = selPost(), img = $('.cvimg'); if (!box || !p || !lastR || !img) return; box.innerHTML = '';
  const k = img.clientWidth / SIZE[viewOf(p)].w; if (!k) return;
  lastR.layers.forEach(l => {
    const on = state.layerSel === l.id, L = (p.layers || []).find(x => x.id === l.id), a = L && assetById(L.asset);
    box.append(h('div', { class: 'lb' + (on ? ' on' : ''), 'data-id': l.id, style: 'left:' + (l.x * k) + 'px;top:' + (l.y * k) + 'px;width:' + (l.w * k) + 'px;height:' + (l.h * k) + 'px', title: (a ? a.name : 'Sticker') + '. Drag to move. Drag the corner to resize.' },
      on ? h('div', { class: 'lh', title: 'Drag to resize' }) : null,
      on ? h('button', { class: 'lx', 'aria-label': 'Remove this sticker', onclick: e => { e.stopPropagation(); removeLayer(p, l.id); } }, icon('x', 12)) : null));
  });
}
function setupStagePointer(img) {
  let drag = null;
  img.addEventListener('pointerdown', e => {
    const p = selPost(); if (!p || !lastR || e.target.closest('.lx') || e.button > 0) return;
    const sz = SIZE[viewOf(p)], rect = stage.getBoundingClientRect(), k = rect.width / sz.w, lb = e.target.closest('.lb');
    if (lb) {
      const id = lb.dataset.id, r = lastR.layers.find(x => x.id === id); if (!r) return;
      if (state.layerSel !== id) { state.layerSel = id; drawLayerBoxes(); syncLayerList(); }
      img.setPointerCapture(e.pointerId); e.preventDefault();
      drag = { type: e.target.closest('.lh') ? 'resize' : 'layer', id, x: e.clientX, y: e.clientY, k, r: Object.assign({}, r), size: sz, moved: false }; return;
    }
    if (state.layerSel) { state.layerSel = null; drawLayerBoxes(); syncLayerList(); }
    const cx = (e.clientX - rect.left) / k, cy = (e.clientY - rect.top) / k;
    const ph = lastR.photos.slice().reverse().find(q => !q.none && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h); if (!ph) return;
    img.setPointerCapture(e.pointerId);
    drag = { type: 'photo', slot: ph.slot, x: e.clientX, y: e.clientY, k, ph: Object.assign({}, ph), size: sz, moved: false }; stage.classList.add('grab');
  });
  img.addEventListener('pointermove', e => {
    if (!drag) return; const p = selPost(); if (!p) return;
    const dx = (e.clientX - drag.x) / drag.k, dy = (e.clientY - drag.y) / drag.k;
    if (!drag.moved) { if (Math.abs(dx) + Math.abs(dy) < 3 / drag.k) return; drag.moved = true; snap(); }
    if (drag.type === 'photo') {
      const ph = drag.ph, ox = ph.iw * ph.s - ph.w, oy = ph.ih * ph.s - ph.h, f = ownFrame(p, drag.size.id, drag.slot);
      if (ox > 1) f.fx = clamp01(ph.fx - dx / ox); else if (f.fx == null) f.fx = ph.fx;
      if (oy > 1) f.fy = clamp01(ph.fy - dy / oy); else if (f.fy == null) f.fy = ph.fy;
    } else {
      const L = (p.layers || []).find(x => x.id === drag.id); if (!L) return;
      const W = drag.size.w, H = drag.size.h, mn = Math.min(W, H), r = drag.r; L.pos = L.pos || {};
      if (drag.type === 'layer') {
        let cx = r.x + r.w / 2 + dx, cy = r.y + r.h / 2 + dy; const m = mn * 0.06, th = 8 / drag.k;
        [W / 2, m + r.w / 2, W - m - r.w / 2].forEach(v => { if (Math.abs(cx - v) < th) cx = v; }); [H / 2, m + r.h / 2, H - m - r.h / 2].forEach(v => { if (Math.abs(cy - v) < th) cy = v; });
        L.pos[drag.size.id] = { x: cx / W, y: cy / H, s: r.w / mn };
      } else {
        const nw = Math.max(mn * 0.04, Math.min(mn * 1.2, r.w + dx)), nh = nw * r.h / r.w;
        L.pos[drag.size.id] = { x: (r.x + nw / 2) / W, y: (r.y + nh / 2) / H, s: nw / mn };
      }
    }
    markEdited(p); refresh();
  });
  const end = () => { if (drag && drag.moved && drag.type !== 'photo') { const p = selPost(); if (p) { const L = (p.layers || []).find(x => x.id === drag.id), sl = $('.stkrow[data-lid="' + drag.id + '"] input[type=range]'); if (L && sl && L.pos[drag.size.id]) sl.value = Math.round(L.pos[drag.size.id].s * 100); } } drag = null; if (stage) stage.classList.remove('grab'); };
  img.addEventListener('pointerup', end); img.addEventListener('pointercancel', end);
}

/* ----- Brand check, under the stage and in the bottom bar ----- */
function drawChecks() {
  const box = $('#checks'), pill = $('#chkpill'), p = selPost(); if (!box || !pill || !p) return; box.innerHTML = '';
  const list = checkPost(p, sizesOf(p), { skipSample: p.demo }), v = viewOf(p), open = (state.checksOpen || list.some(i => i.lvl === 'error')) && list.length;
  pill.className = 'pill ' + (list.length ? 'warn' : 'ok'); pill.innerHTML = ''; pill.setAttribute('aria-expanded', !!open);
  pill.append(icon(list.length ? 'alert' : 'shield', 16), list.length ? plural(list.length, 'thing') + ' to check' : 'On brand', list.length ? icon(open ? 'down' : 'up', 14) : '');
  box.hidden = !open;
  list.forEach(i => box.append(h('p', { class: 'issue ' + i.lvl }, icon('alert', 16), h('span', null, i.msg, ' ',
    i.fix ? h('button', { class: 'link', onclick: () => { snap(); i.fix(); markEdited(p); render(); } }, 'Fix it') : null,
    i.size && i.size !== v ? h('button', { class: 'link', onclick: () => setView(i.size) }, 'Show it') : null,
    aiReady() && /too long to fit/.test(i.msg) ? h('button', { class: 'link', onclick: () => aiShorten(p, i) }, 'Shorten with Claude') : null))));
}
function barStatus() {
  const el = $('#barstat'); if (!el) return; let bad = 0; state.posts.forEach(p => { if (rowBad(p)) bad++; });
  el.innerHTML = ''; el.append(icon(bad ? 'alert' : 'shield', 18), bad ? plural(bad, 'post') + (bad === 1 ? ' needs' : ' need') + ' a look' : (state.posts.length === 1 ? 'Your post is on brand' : 'All ' + state.posts.length + ' posts are on brand'));
  el.className = 'barinfo ' + (bad ? 'bad' : 'good');
  if (bad) el.append(h('button', { class: 'link', onclick: () => { const i = state.posts.findIndex(p => p.id === state.sel), order = state.posts.slice(i + 1).concat(state.posts.slice(0, i + 1)), t = order.find(rowBad); if (t) { const is = checkPost(t, sizesOf(t), { skipSample: t.demo }).find(x => x.size); if (is) t.view = is.size; state.sel = t.id; state.checksOpen = true; state.mode = 'post'; render(); } } }, bad === 1 && selPost() && rowBad(selPost()) ? 'Show what to fix' : 'Show me'));
}

/* ----- Feed preview: the profile grid, newest first, with drag to reorder ----- */
function feedItems() {
  const num = numbering(), items = [], stories = [];
  state.posts.forEach(p => { const v = num.get(p.id); if (v.g && v.k > 1) return; const sz = sizesOf(p), fs = ['portrait', 'square', 'landscape', 'wide'].find(id => sz.includes(id)); if (!fs) stories.push({ p, label: String(v.n) }); else items.push({ p, size: fs, carousel: !!v.g, label: String(v.n) }); });
  return { items, stories };
}
function feedTile(p, sizeId, w) {
  const S = SIZE[sizeId], c = document.createElement('canvas'); renderPost(c, p, S, (w * 2) / S.w);
  const tw = w * 2, th = Math.round(w * 2 * 4 / 3), t = h('canvas', { width: tw, height: th, 'aria-hidden': 'true' }), x = t.getContext('2d');
  let sx = 0, sy = 0, sw = c.width, sh = c.height; if (sw / sh > 0.75) { sw = sh * 0.75; sx = (c.width - sw) / 2; } else { sh = sw / 0.75; sy = (c.height - sh) / 2; }
  x.fillStyle = '#fff'; x.fillRect(0, 0, tw, th); x.drawImage(c, sx, sy, sw, sh, 0, 0, tw, th); return t;
}
function itemPosts(id) { const p = getPost(id); if (!p) return []; return p.group ? state.posts.filter(q => q.group === p.group) : [p]; }
function moveItem(dragId0, targetId, displayAfter) {
  const moving = itemPosts(dragId0), target = itemPosts(targetId); if (!moving.length || !target.length || moving[0] === target[0]) return;
  snap(); const listAfter = state.oldestFirst ? displayAfter : !displayAfter;
  state.posts = state.posts.filter(q => !moving.includes(q));
  const j = listAfter ? state.posts.indexOf(target[target.length - 1]) + 1 : state.posts.indexOf(target[0]);
  state.posts.splice(j, 0, ...moving); normalizeGroups(); reindex(); render(); scheduleSave();
}
function viewFeed() {
  const { items, stories } = feedItems(), list = state.oldestFirst ? items : items.slice().reverse(), W = 128;
  const grid = h('div', { class: 'fp-grid' });
  list.forEach(it => {
    const tile = h('button', { class: 'fp-tile' + (it.p.id === state.sel ? ' on' : ''), draggable: 'true', title: 'Post ' + it.label + '. Click to edit, drag to reorder.', onclick: () => { state.sel = it.p.id; state.mode = 'post'; render(); } }, feedTile(it.p, it.size, W), it.carousel ? h('span', { class: 'fp-car' }, icon('carousel', 14)) : null, h('span', { class: 'fp-num' }, it.label));
    tile.addEventListener('dragstart', e => { dragId = it.p.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/x-post', String(it.p.id)); } catch (er) { } tile.classList.add('dragging'); });
    tile.addEventListener('dragend', () => { dragId = null; tile.classList.remove('dragging'); $$('.fp-tile.dropa,.fp-tile.dropb').forEach(x => x.classList.remove('dropa', 'dropb')); });
    tile.addEventListener('dragover', e => { if (dragId == null || itemPosts(dragId)[0] === it.p) return; e.preventDefault(); const r = tile.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2; tile.classList.toggle('dropa', after); tile.classList.toggle('dropb', !after); });
    tile.addEventListener('dragleave', () => tile.classList.remove('dropa', 'dropb'));
    tile.addEventListener('drop', e => { if (dragId == null) return; e.preventDefault(); e.stopPropagation(); const after = tile.classList.contains('dropa'); tile.classList.remove('dropa', 'dropb'); const id = dragId; dragId = null; moveItem(id, it.p.id, after); });
    grid.append(tile);
  });
  const st = h('div', { class: 'fp-stories' }, stories.map(s => { const c = document.createElement('canvas'), S = SIZE.story; renderPost(c, s.p, S, 120 / S.w); return h('button', { class: 'fp-story', title: 'Story ' + s.label + '. Click to edit.', onclick: () => { state.sel = s.p.id; state.mode = 'post'; render(); } }, h('span', { class: 'fp-ring' }, c), h('span', null, s.label)); }));
  const phone = h('div', { class: 'fp-phone' }, h('div', { class: 'fp-head' }, h('span', { class: 'ph-av big' }, h('img', { src: ASSETS.logos.ib, alt: '' })), h('div', null, h('b', null, state.camp ? state.camp.name : 'Campaign'), h('span', { class: 'small muted' }, plural(items.length, 'post') + (stories.length ? ' · ' + plural(stories.length, 'story', 'stories') : '')))),
    stories.length ? st : null, items.length ? grid : h('p', { class: 'fp-empty' }, 'No feed posts yet. Posts with only the Story size show as stories above.'));
  const runs = redRuns();
  const side = h('div', { class: 'fp-side' }, h('span', { class: 'lab' }, 'Feed preview'), h('p', null, state.oldestFirst ? 'Oldest first, in posting order.' : 'Newest first, like your profile. The last post in your list shows top left.'), h('p', { class: 'help' }, 'Drag tiles to change the order. A carousel moves as one. Tiles show the 3:4 crop the profile grid uses.'),
    runs ? h('p', { class: 'issue warn' }, icon('alert', 16), h('span', null, 'Three or more red-bordered posts sit together. Reorder them to keep the grid balanced.')) : h('p', { class: 'ok' }, icon('shield', 16), 'Red and white borders are balanced.'));
  return h('section', { class: 'col center feedmode' }, h('div', { class: 'tools' }, modeSwitch(), h('span', { class: 'grow' }), h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: state.oldestFirst, onchange: e => { state.oldestFirst = e.target.checked; render(); } }), 'Oldest first')), h('div', { id: 'selbar', class: 'selbar', hidden: true }), h('div', { class: 'fp-wrap', 'data-keep': 'feed' }, phone, side));
}
function resolvedBorder(p) { const t = TPL[p.tpl], o = effOpts(p); if (t.id === 'banner') return o.border === 'alt' ? ((p.idx || 0) % 2 === 0 ? 'white' : 'red') : o.border; if (t.id === 'tab') return 'red'; if (t.id === 'product' && o.panel === 'red') return 'red'; return 'other'; }
function redRuns() { let n = 0; for (const p of state.posts) { if (p.export === false) continue; if (resolvedBorder(p) === 'red') { if (++n >= 3) return true; } else n = 0; } return false; }

/* ===== The edit panel ===== */
function section(id, title, summary, openDefault, body) {
  const open = state.secOpen[id] != null ? state.secOpen[id] : openDefault;
  const d = h('details', { class: 'esec', open, 'data-sec': id }, h('summary', null, h('span', { class: 'esh' }, title), h('span', { class: 'ess' }, summary || ''), icon('down', 16)), h('div', { class: 'esb' }, body));
  d.addEventListener('toggle', () => { state.secOpen[id] = d.open; });
  return d;
}
function buildEditor(p) {
  const t = TPL[p.tpl], box = h('div', { class: 'editor' }), num = numbering();
  box.append(h('div', { class: 'edhead' }, h('h2', null, 'Post ' + postLabel(p, num)), p.group ? h('span', { class: 'chip' }, icon('carousel', 13), 'Carousel slide') : null, h('span', { class: 'grow' }),
    aiReady() ? ib('translate', 'Make a Filipino copy with Claude', () => aiFilipino(p)) : null, ib('copy', 'Duplicate this post (Ctrl+D)', () => dupPost(p)), ib('trash', 'Remove this post (Delete)', () => removePost(p), 'danger')));
  /* template */
  const tth = h('canvas', { class: 'tplthumb', 'aria-hidden': 'true' }); renderPost(tth, p, SIZE.square, 128 / 1080);
  box.append(section('tpl', 'Template', t.name, true, h('div', null, h('div', { class: 'tplrow' }, tth, h('div', { class: 'tplinfo' }, h('b', null, t.name), h('span', { class: 'small muted' }, variationCount(t) + ' variations')), h('button', { class: 'btn small', onclick: () => openPicker('this') }, icon('layout', 16), 'Change')),
    t.options.length ? h('div', { class: 'optgrid' }, t.options.map(g => h('div', { class: 'field' }, h('label', { for: 'o-' + g.id }, g.name), h('select', { id: 'o-' + g.id, onchange: e => { snap(); p.opts = Object.assign({}, p.opts, { [g.id]: e.target.value }); markEdited(p); render(); } }, g.values.map(v => h('option', { value: v.id, selected: effOpts(p)[g.id] === v.id }, v.name)))))) : null)));
  /* sizes */
  const mine = sizesOf(p);
  box.append(section('sizes', 'Sizes', sizeListText(mine), true, h('div', null, sizeTiles(mine, id => togglePostSize(p, id), 'tile-'), h('p', { class: 'help' }, p.group ? 'All slides of this carousel share these sizes.' : 'This post downloads in every size you pick. Other posts keep their own.'))));
  /* photos */
  const R = renderPost(document.createElement('canvas'), p, SIZE[viewOf(p)], 0.04);
  if (R.photos.length) { const slot2 = t.fields.find(f => f.image2); box.append(section('photo', slot2 ? 'Photos' : 'Photo', p.img ? (p.img.sample ? 'Sample photo' : '') : 'None yet', true, h('div', null, photoSlot(p, 1, slot2 ? 'First photo' : null), slot2 ? photoSlot(p, 2, slot2.l) : null))); }
  /* words */
  box.append(section('words', 'Words', '', true, wordsBlock(p, t)));
  /* stickers */
  box.append(section('stickers', 'Stickers and logos', (p.layers || []).length ? String((p.layers || []).length) : '', false, stickersBlock(p)));
  /* caption */
  const capLen = (p.caption || '').length;
  box.append(section('caption', 'Caption and alt text', capLen ? capLen + ' characters' : 'Empty', false, captionBlock(p)));
  /* date */
  box.append(section('date', 'Posting date', p.date ? shortDate(p.date) : 'Not set', false, h('div', null, h('div', { class: 'field' }, h('label', { for: 'f-date' }, 'Post on'), h('input', { id: 'f-date', type: 'datetime-local', value: p.date || '', onchange: e => { p.date = e.target.value; markEdited(p); render(); } })), h('p', { class: 'help' }, 'Shown in your list, the review sheet and the captions spreadsheet, to help you schedule.'))));
  return box;
}
function togglePostSize(p, id) {
  const cur = sizesOf(p);
  if (cur.includes(id)) { if (cur.length === 1) { toast('Each post needs at least one size.'); return; } snap(); setPostSizes(p, cur.filter(x => x !== id)); }
  else { snap(); setPostSizes(p, cur.concat(id)); p.view = id; }
  render();
}
function photoSlot(p, slot, label) {
  const img = slot === 2 ? p.img2 : p.img, v = viewOf(p), th = h('canvas', { class: 'pthumb', 'aria-hidden': 'true' });
  if (img) { th.width = 96; th.height = Math.max(1, Math.round(96 * img.src.height / img.src.width)); th.getContext('2d').drawImage(img.src, 0, 0, th.width, th.height); }
  const zid = 'zoom' + slot;
  const zoom = h('input', { id: zid, type: 'range', min: 100, max: 300, value: Math.round((frameOf(p, v, slot).zoom || 1) * 100), 'aria-label': 'Zoom for the ' + SIZE[v].name + ' size', oninput: e => { if (!zoom.dataset.snapped) { snap(); zoom.dataset.snapped = '1'; } ownFrame(p, viewOf(p), slot).zoom = e.target.value / 100; markEdited(p); refresh(); }, onchange: () => { zoom.dataset.snapped = ''; } });
  return h('div', { class: 'pslot' }, label ? h('span', { class: 'lab2' }, label) : null,
    h('div', { class: 'photorow' }, img ? th : h('div', { class: 'pthumb none' }, icon('image', 20)), h('div', { class: 'pinfo2' }, h('div', { class: 'fname' }, img ? (img.sample ? 'Sample photo' : img.name) : 'No photo yet'), photoBtn([icon('image', 16), img ? 'Replace' : 'Choose a photo'], 'btn small', p.id, null, slot))),
    img ? h('div', { class: 'zoomrow' }, h('label', { for: zid, class: 'zl' }, 'Zoom', sizesOf(p).length > 1 ? h('b', { class: 'zoomFor' }, SHORT[v]) : null), zoom, ib('reset', 'Back to the automatic position for this size', () => resetFrame(p, slot), 'sm')) : null,
    img && slot === 1 ? h('div', { class: 'framenote' }, h('span', { class: 'help frameNote' }, frameNote(p)), sizesOf(p).length > 1 ? h('button', { class: 'link small', onclick: () => frameToAll(p) }, 'Use for all sizes') : null) : null);
}
function wordsBlock(p, t) {
  const box = h('div'), chipsBox = h('div', { class: 'wordchips' });
  function buildChips() {
    chipsBox.innerHTML = ''; const words = (p.headline || '').split(/\s+/).map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
    if (!words.length) { chipsBox.hidden = true; return; } chipsBox.hidden = false;
    words.slice(0, 16).forEach(w => chipsBox.append(h('button', { class: 'wc' + ((p.keyword || '').toLowerCase() === w.toLowerCase() ? ' on' : ''), onclick: () => { p.keyword = (p.keyword || '').toLowerCase() === w.toLowerCase() ? '' : w; markEdited(p); const ki = $('#f-keyword'); if (ki) ki.value = p.keyword; buildChips(); refresh(); } }, w)));
  }
  t.fields.forEach(f => {
    if (f.image2) return;
    if (f.image) {
      box.append(h('div', { class: 'field' }, h('label', null, f.l), h('div', { class: 'photorow' }, h('span', { class: 'fname' + (p.partner ? '' : ' muted') }, p.partner ? p.partner.name : 'Optional'),
        h('label', { class: 'btn small', tabindex: '0', role: 'button' }, icon('upload', 16), p.partner ? 'Replace' : 'Choose logo', h('input', { type: 'file', accept: 'image/*', class: 'sr', tabindex: '-1', onchange: async e => { if (!e.target.files[0]) return; try { snap(); p.partner = await loadFile(e.target.files[0], 900); p.partner.png = true; markEdited(p); render(); } catch (er) { toast('Could not open that logo.'); } } })),
        p.partner ? ib('x', 'Remove logo', () => { snap(); p.partner = null; markEdited(p); render(); }, 'sm') : null)));
      return;
    }
    const id = 'f-' + f.k, input = f.rows ? h('textarea', { id, rows: f.rows, placeholder: f.ph || '' }) : h('input', { id, type: 'text', placeholder: f.ph || '' });
    input.value = p[f.k] || '';
    input.addEventListener('focus', () => { input.dataset.snapped = ''; });
    input.addEventListener('input', e => { if (!input.dataset.snapped) { snap(); input.dataset.snapped = '1'; } p[f.k] = e.target.value; markEdited(p); if (f.k === 'headline') buildChips(); refresh(); });
    const pesoBtn = f.peso ? h('button', { class: 'pesobtn', type: 'button', title: 'Add a peso sign', onclick: () => { const s = input.selectionStart == null ? input.value.length : input.selectionStart, en = input.selectionEnd == null ? s : input.selectionEnd; input.value = input.value.slice(0, s) + '₱' + input.value.slice(en); input.focus(); input.setSelectionRange(s + 1, s + 1); input.dispatchEvent(new Event('input')); } }, '₱') : null;
    box.append(h('div', { class: 'field' }, h('label', { for: id }, f.l), pesoBtn ? h('div', { class: 'inrow' }, input, pesoBtn) : input, f.help && f.k !== 'keyword' ? h('p', { class: 'help' }, f.help) : null, f.k === 'keyword' ? h('p', { class: 'help' }, 'Gets the one red underline. Tap a word below.') : null, f.k === 'keyword' ? chipsBox : null));
  });
  buildChips(); return box;
}
function stickersBlock(p) {
  const out = h('div', { class: 'stk' }), list = h('div', { class: 'stklist' });
  (p.layers || []).forEach(L => {
    const a = assetById(L.asset), on = state.layerSel === L.id, th = h('span', { class: 'stkth' });
    if (a && ASSET_IMG[a.id]) { const c = h('canvas', { width: 72, height: 72 }), x = c.getContext('2d'), im = ASSET_IMG[a.id], s = Math.min(72 / im.width, 72 / im.height); x.drawImage(im, (72 - im.width * s) / 2, (72 - im.height * s) / 2, im.width * s, im.height * s); th.append(c); }
    const sl = h('input', { type: 'range', min: 4, max: 100, value: Math.round(((L.pos && L.pos[viewOf(p)] ? L.pos[viewOf(p)].s : L.s) || 0.2) * 100), 'aria-label': 'Size of ' + (a ? a.name : 'the sticker'), oninput: e => setLayerSize(p, L, e.target.value / 100, sl), onchange: () => { sl.dataset.snapped = ''; } });
    list.append(h('div', { class: 'stkrow' + (on ? ' on' : ''), 'data-lid': L.id, onclick: e => { if (e.target.closest('input,button')) return; state.layerSel = L.id; drawLayerBoxes(); syncLayerList(); } }, th, h('div', { class: 'stkmeta' }, h('b', null, a ? a.name : 'Missing from your library'), h('div', { class: 'stksz' }, h('span', { class: 'small muted' }, 'Size'), sl)), ib('trash', 'Remove this sticker', () => removeLayer(p, L.id), 'sm danger')));
  });
  out.append(list, h('div', { class: 'rowbtns' }, h('button', { class: 'btn small', onclick: () => openAssetPicker(id => addLayerTo([p.id], id)) }, icon('plus', 16), 'Add sticker or logo'), (p.layers || []).length && sizesOf(p).length > 1 ? h('button', { class: 'link small', onclick: () => layersToAll(p) }, 'Same spot in all sizes') : null));
  out.append(h('p', { class: 'help' }, (p.layers || []).length ? 'Drag a sticker in the preview to move it. Each size keeps its own spot.' : 'Add partner logos, badges or stickers from your library. New ones find a free corner away from the brand logo.'));
  return out;
}
function captionBlock(p) {
  const meta = h('div', { class: 'capmeta' });
  const cap = h('textarea', { id: 'f-caption', rows: 5, placeholder: 'The text that goes with the post, including hashtags.', value: p.caption, oninput: e => { p.caption = e.target.value; markEdited(p); upd(); } });
  function upd() {
    const len = (p.caption || '').length, tags = ((p.caption || '').match(/#[\p{L}\p{N}_]+/gu) || []).length; meta.innerHTML = '';
    meta.append(h('span', { class: len > 2200 ? 'over' : '' }, len.toLocaleString() + ' / 2,200'), h('span', { class: tags > 30 ? 'over' : '' }, plural(tags, 'hashtag')), h('span', { class: 'grow' }), h('button', { class: 'link small', type: 'button', onclick: e => openHashMenu(e.currentTarget, cap, p) }, icon('hash', 14), 'Add hashtags'));
  }
  upd();
  const alt = h('textarea', { id: 'f-alt', rows: 2, placeholder: 'Describe the picture for people who cannot see it.', value: p.alt, oninput: e => { p.alt = e.target.value; markEdited(p); } });
  return h('div', null,
    h('div', { class: 'field' }, h('div', { class: 'labrow' }, h('label', { for: 'f-caption' }, 'Post caption'), h('span', { class: 'rowbtns tight' }, aiBtn('Draft with Claude', btn => aiCaption(p, cap, btn)), h('button', { class: 'link small', onclick: () => copyText(p.caption) }, 'Copy'))), cap, meta, h('p', { class: 'help' }, 'About the first 125 characters show before “more”.')),
    h('div', { class: 'field' }, h('div', { class: 'labrow' }, h('label', { for: 'f-alt' }, 'Alt text'), aiBtn('Write with Claude', btn => aiAlt(p, alt, btn))), alt),
    h('p', { class: 'help' }, 'Captions and alt text go into a spreadsheet next to your images when you download.'));
}
function openHashMenu(anchor, ta, p) {
  const sets = SETTINGS.hashtags.filter(s => (s.tags || '').trim());
  openMenu(anchor, sets.map(s => [s.name + ': ' + s.tags.slice(0, 40) + (s.tags.length > 40 ? '…' : ''), () => {
    const have = new Set(((p.caption || '').match(/#[\p{L}\p{N}_]+/gu) || []).map(x => x.toLowerCase())), add = (s.tags.match(/#[\p{L}\p{N}_]+/gu) || []).filter(x => !have.has(x.toLowerCase()));
    if (!add.length) { toast('Those hashtags are already in the caption.'); return; }
    p.caption = ((p.caption || '').trimEnd() + (p.caption ? '\n\n' : '') + add.join(' ')).trim(); ta.value = p.caption; ta.dispatchEvent(new Event('input')); markEdited(p);
  }]).concat([['Edit hashtag sets…', () => openSettings('tags')]]));
}
function openMenu(anchor, items) {
  closeMenu(); const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu' }, items.map(([l, fn, cls]) => h('button', { role: 'menuitem', class: cls || '', onclick: () => { closeMenu(); fn(); } }, l)));
  document.body.append(m);
  /* open below the button, or above it when there is no room, and keep it on screen */
  const mh = m.offsetHeight, mw = m.offsetWidth; let top = r.bottom + 4; if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.top = top + 'px'; m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + mw > window.innerWidth - 8 ? r.right - mw : r.left)) + 'px';
  m.addEventListener('keydown', e => { const bs = $$('button', m), i = bs.indexOf(document.activeElement); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); } else if (e.key === 'Tab') closeMenu(); });
  closeMenu.anchor = anchor; const first = $('button', m); if (first) first.focus();
  setTimeout(() => { document.addEventListener('pointerdown', closeMenu.out = e => { if (!m.contains(e.target)) closeMenu(); }); window.addEventListener('scroll', closeMenu.scr = () => closeMenu(), true); }, 0);
}
function closeMenu(refocus) {
  const had = $$('.menu').length; $$('.menu').forEach(m => m.remove());
  if (closeMenu.out) document.removeEventListener('pointerdown', closeMenu.out); if (closeMenu.scr) window.removeEventListener('scroll', closeMenu.scr, true); closeMenu.out = closeMenu.scr = null;
  if (had && refocus === true && closeMenu.anchor && document.contains(closeMenu.anchor)) closeMenu.anchor.focus();
}
async function copyText(t) {
  if (!t || !t.trim()) { toast('There is no caption yet.'); return; }
  try { await navigator.clipboard.writeText(t); toast('Caption copied.'); }
  catch (e) { const ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = t; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { } ta.remove(); toast(ok ? 'Caption copied.' : 'Copying is blocked here. Select the caption and copy it.'); }
}

/* ===== Template picker ===== */
const CATS = [['all', 'All', null], ['life', 'Lifestyle', ['fullbleed', 'banner', 'tab', 'quote', 'split', 'beforeafter']], ['prod', 'Products', ['product', 'caption', 'features', 'price', 'split']], ['promo', 'Promos', ['promo', 'price', 'footer', 'banner', 'header', 'event']], ['upd', 'Updates and tips', ['announce', 'textonly', 'event', 'tips', 'header']]];
const inCat = id => { const c = CATS.find(x => x[0] === state.cat); return !c || !c[2] || c[2].includes(id); };
let pk = null;
function previewPost(base, t, opts) {
  const sp = Object.assign(clonePost(base), { tpl: t.id, opts, idx: base.idx || 0, layers: [] });
  TEXT_KEYS.forEach(f => { if (!(base[f] || '').trim() && t.sample[f]) sp[f] = t.sample[f]; });
  if (!(base.headline || '').trim() && t.sample.keyword != null) sp.keyword = t.sample.keyword;
  if (!sp.img) sp.img = sampleImg('tile'); if (!sp.img2) sp.img2 = sampleImg('steel');
  return sp;
}
function openPicker(scope) { const p = selPost(); if (!p) return; pk = { tpl: p.tpl, opts: effOpts(p), scope: scope || (state.picked.size ? 'picked' : 'this') }; if (pk.scope === 'picked' && !state.picked.size) pk.scope = 'this'; drawPicker.tpl = null; drawPicker(); }
function applyTemplate() {
  const ids = pk.scope === 'this' ? [state.sel] : pk.scope === 'picked' ? [...state.picked] : state.posts.map(p => p.id); snap();
  ids.forEach(id => { const p = getPost(id); if (!p) return; p.tpl = pk.tpl; p.opts = Object.assign(defaultOpts(TPL[pk.tpl]), pk.opts); markEdited(p); });
  closeModal(); render(); const nm = TPL[pk.tpl].name; withUndo(ids.length === 1 ? 'Template changed to ' + nm + '.' : nm + ' applied to ' + plural(ids.length, 'post') + '.');
}
function drawPicker() {
  const m = $('#modal'), ol = $('.pk-left', m), orr = $('.pk-scroll', m), sl = ol ? ol.scrollTop : 0, sr = orr && drawPicker.tpl === pk.tpl ? orr.scrollTop : 0;
  const base = selPost(), t = TPL[pk.tpl], n = state.picked.size, grid = h('div', { class: 'tgrid', role: 'list' });
  TEMPLATES.filter(tp => inCat(tp.id)).forEach(tp => {
    const c = h('canvas', { 'aria-hidden': 'true' }); renderPost(c, previewPost(base, tp, tp.id === pk.tpl ? pk.opts : defaultOpts(tp)), SIZE.square, 230 / 1080);
    grid.append(h('button', { class: 'tcard' + (tp.id === pk.tpl ? ' on' : ''), role: 'listitem', 'aria-pressed': tp.id === pk.tpl, onclick: () => { pk.tpl = tp.id; pk.opts = base.tpl === tp.id ? effOpts(base) : defaultOpts(tp); drawPicker(); } }, c, h('span', { class: 'tname' }, tp.name), h('span', { class: 'tmeta' }, variationCount(tp) + ' variations')));
  });
  const prev = h('canvas', { class: 'bigprev', 'aria-label': 'Preview of ' + t.name }); renderPost(prev, previewPost(base, t, pk.opts), SIZE.square, 380 / 1080);
  const groups = t.options.map(g => h('div', { class: 'ogroup' }, h('h3', null, g.name), h('div', { class: 'ochips' }, g.values.map(v => {
    const c = h('canvas', { 'aria-hidden': 'true' }); renderPost(c, previewPost(base, t, Object.assign({}, pk.opts, { [g.id]: v.id })), SIZE.square, 104 / 1080);
    const cur = (pk.opts[g.id] || g.values[0].id) === v.id;
    return h('button', { class: 'ochip' + (cur ? ' on' : ''), 'aria-pressed': cur, onclick: () => { pk.opts = Object.assign({}, pk.opts, { [g.id]: v.id }); drawPicker(); } }, c, h('span', null, v.name));
  }))));
  const scopes = [['this', 'This post']]; if (n) scopes.push(['picked', n + ' ticked']); if (state.posts.length > 1) scopes.push(['all', 'All ' + state.posts.length]);
  if (!scopes.some(x => x[0] === pk.scope)) pk.scope = scopes[0][0];
  const seg = scopes.length > 1 ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Apply to' }, scopes.map(([id, l]) => h('button', { class: pk.scope === id ? 'on' : '', 'aria-pressed': pk.scope === id, onclick: () => { pk.scope = id; drawPicker(); } }, l))) : null;
  m.innerHTML = ''; m.hidden = false;
  m.append(h('div', { class: 'dlg picker', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pkT' },
    h('section', { class: 'pk-left' }, h('div', { class: 'dlghead' }, h('h2', { id: 'pkT', class: 'title' }, 'Choose a template'), ib('x', 'Close', closeModal)),
      h('div', { class: 'filters', role: 'group', 'aria-label': 'Template type' }, CATS.map(([id, name]) => h('button', { class: 'fchip' + (state.cat === id ? ' on' : ''), 'aria-pressed': state.cat === id, onclick: () => { state.cat = id; drawPicker(); } }, name))), grid),
    h('aside', { class: 'pk-right' }, h('div', { class: 'pk-scroll' }, prev, h('h2', { class: 'tpl-h' }, t.name), h('p', { class: 'use' }, t.use), groups),
      h('div', { class: 'pk-foot' }, seg ? h('div', { class: 'applyto' }, h('span', { class: 'lab' }, 'Apply to'), seg) : null,
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: applyTemplate }, icon('check', 18), 'Use this template'))))));
  $('.pk-left', m).scrollTop = sl; $('.pk-scroll', m).scrollTop = sr; drawPicker.tpl = pk.tpl;
}

/* ===== Paste or import words from a spreadsheet ===== */
function parseTable(text) {
  const d = text.includes('\t') ? '\t' : ','; const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === d) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; } else cur += ch;
  }
  row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row); return rows;
}
const COLS = { headline: ['headline', 'title', 'message', 'banner', 'quote', 'text', 'event'], keyword: ['keyword', 'key word', 'underline'], sub: ['sub', 'subline', 'subheadline', 'details', 'description', 'place', 'venue'], label: ['label', 'product', 'collection', 'product name'], tag: ['tag', 'feature'], footer: ['footer'], name: ['name', 'author'], role: ['role', 'position'], caption: ['caption', 'post caption', 'copy'], alt: ['alt', 'alt text'], price: ['price'], was: ['was', 'old price', 'original price'], fine: ['fine', 'fine print', 'terms', 'small print'], day: ['day', 'date number'], month: ['month'], f1: ['feature 1', 'f1'], f2: ['feature 2', 'f2'], f3: ['feature 3', 'f3'], t1: ['tip 1', 't1'], t2: ['tip 2', 't2'], t3: ['tip 3', 't3'], t4: ['tip 4', 't4'], label1: ['before label', 'label 1'], label2: ['after label', 'label 2'], date: ['post date', 'posting date', 'date', 'schedule'], photo: ['photo', 'image', 'file', 'filename'], template: ['template', 'layout', 'style'], sizes: ['sizes', 'size', 'format', 'formats'] };
function mapRows(rows) {
  const first = rows[0].map(c => c.trim().toLowerCase()), idx = {}; let header = false;
  Object.entries(COLS).forEach(([k, names]) => { const i = first.findIndex(c => names.includes(c)); if (i >= 0) { idx[k] = i; header = true; } });
  if (!header) { ['headline', 'keyword', 'sub', 'label', 'caption'].forEach((k, i) => { idx[k] = i; }); return { idx, data: rows }; }
  return { idx, data: rows.slice(1) };
}
function findTpl(v) { const s = (v || '').trim().toLowerCase(); if (!s) return null; return TEMPLATES.find(t => t.id === s || t.name.toLowerCase() === s) || TEMPLATES.find(t => t.name.toLowerCase().startsWith(s)) || TEMPLATES.find(t => t.name.toLowerCase().includes(s)) || null; }
function parsePostDate(v) { if (!v) return ''; v = String(v).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += 'T12:00'; const t = new Date(v.replace(' ', 'T')); if (isNaN(t)) return ''; const z = n => String(n).padStart(2, '0'); return t.getFullYear() + '-' + z(t.getMonth() + 1) + '-' + z(t.getDate()) + 'T' + z(t.getHours()) + ':' + z(t.getMinutes()); }
function applyRows(rows, mode) {
  const { idx, data } = mapRows(rows), stem = s => (s || '').trim().toLowerCase().replace(/\.[a-z0-9]+$/, ''), get = (r, k) => idx[k] != null ? (r[idx[k]] || '').trim() : '';
  let used = new Set(), n = 0; const targets = mode === 'fill' ? state.posts.filter(p => !p.demo) : [];
  data.forEach(r => {
    let p = null;
    if (mode === 'fill') { const pf = get(r, 'photo'); if (pf) p = targets.find(x => !used.has(x.id) && x.img && stem(x.img.name) === stem(pf)); if (!p) p = targets.find(x => !used.has(x.id)); }
    if (!p) { dropDemos(); p = newPost(); state.posts.push(p); }
    used.add(p.id);
    TEXT_KEYS.forEach(k => { const v = get(r, k); if (v) p[k] = v; });
    const tv = findTpl(get(r, 'template')); if (tv && tv.id !== p.tpl) { p.tpl = tv.id; p.opts = defaultOpts(tv); }
    const sz = parseSizes(get(r, 'sizes')); if (sz) { p.sizes = sz; p.view = sz[0]; }
    const dt = parsePostDate(get(r, 'date')); if (dt) p.date = dt;
    markEdited(p); n++;
  });
  reindex(); if (!getPost(state.sel) && state.posts.length) state.sel = state.posts[0].id; return n;
}
function openPaste() {
  const ta = h('textarea', { id: 'pasteTa', rows: 9, autofocus: true, placeholder: 'headline\tkey word\ttemplate\tsizes\tcaption\nLife is about having the right kind of pressure\tright\tPhoto with headline\tSquare, Story\tOur shower range puts the pressure where it matters.' });
  const fileIn = h('input', { type: 'file', accept: '.csv,.tsv,.txt', class: 'sr', onchange: async e => { const f = e.target.files[0]; if (f) { ta.value = await f.text(); upd(); } } });
  const info = h('p', { class: 'help' }), hasPosts = state.posts.some(p => !p.demo);
  const r1 = h('input', { type: 'radio', name: 'pm', id: 'pm1', value: 'fill', checked: hasPosts }), r2 = h('input', { type: 'radio', name: 'pm', id: 'pm2', value: 'add', checked: !hasPosts });
  function upd() { const rows = ta.value.trim() ? parseTable(ta.value) : [], { data } = rows.length ? mapRows(rows) : { data: [] }; info.textContent = data.length ? plural(data.length, 'row') + ' found.' : 'Paste rows from Excel or Google Sheets, or import a CSV file.'; }
  ta.addEventListener('input', upd); upd();
  const sheet = 'headline,key word,template,sizes,post date,label,price,footer,caption,alt text,photo\n"Life is about having the right kind of pressure",right,Photo with headline,"Square, Story",2026-12-01 18:00,,,,"Caption goes here #AmericanStandard",A rain shower over a bright bathroom,photo-001.jpg\n"Bathroom upgrade sale",,Price tag,Portrait,2026-12-03 12:00,Acacia E wall-hung toilet,"₱18,990",,"Second caption",A white wall-hung toilet,photo-002.jpg\n';
  openModal(h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlgT' },
    h('div', { class: 'dlghead' }, h('h2', { id: 'dlgT', class: 'title' }, 'Paste or import words'), ib('x', 'Close', closeModal)),
    h('p', { class: 'help' }, 'One row per post. Copy rows from Excel or Google Sheets and paste them here. With headings in the first row, these columns are understood: headline, key word, subline, label, price, old price, fine print, footer, caption, alt text, post date, photo (matches your photo file names), template (any template name) and sizes (such as Square, Story).'),
    ta, info, h('div', { class: 'radios' }, h('label', { for: 'pm1' }, r1, ' Fill my existing posts in order'), h('label', { for: 'pm2' }, r2, ' Add as new posts')),
    h('div', { class: 'actions' }, h('label', { class: 'btn', tabindex: '0' }, icon('upload', 16), 'Import a CSV file', fileIn), h('button', { class: 'btn', onclick: () => saveText('AmericanStandard_copy_template.csv', '﻿' + sheet) }, icon('filedown', 16), 'Get a blank spreadsheet'), h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { const rows = ta.value.trim() ? parseTable(ta.value) : []; if (!rows.length) { toast('Nothing to add yet.'); return; } snap(); const n = applyRows(rows, $('input[name=pm]:checked').value); closeModal(); toast(plural(n, 'post') + ' filled.'); if (state.view !== 'build') go(1); else render(); scheduleSave(); } }, 'Add words'))));
}
