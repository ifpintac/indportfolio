/* American Standard social post maker: pages, header, keyboard and start-up. */
const bar = (...k) => h('div', { class: 'bar' }, h('div', { class: 'barin' }, ...k));
function barBuild() { return bar(h('span', { id: 'barstat', class: 'barinfo' }), h('span', { class: 'grow' }), h('button', { class: 'btn primary', onclick: () => go(2) }, 'Next: download', icon('next', 18))); }
function go(n) { if (!state.camp) { location.hash = '#/'; return; } if (n > 1 && !state.posts.length) { toast('Add at least one post first.'); n = 1; } const want = '#/c/' + state.camp.id + (n === 2 ? '/download' : ''); if (location.hash === want) { state.view = n === 2 ? 'download' : 'build'; render(); } else location.hash = want; }

/* ===== Pages ===== */
async function openCampaign(id) {
  if (state.camp && state.camp.id === id) return true;
  await leaveCampaign();
  const r = await dbGet('camps', id); if (!r) return false;
  STORE.imgCache.clear(); CHECKS.clear();
  state.camp = { id: r.id, name: r.name, created: r.created, updated: r.updated, fmt: r.fmt || 'png', captions: r.captions !== false };
  state.posts = await hydratePosts(r.posts); reindex(); if (!DB.ok) STORE.lastSaved = ['Not saved', true];
  state.sel = (state.posts[r.sel] || state.posts[0] || {}).id || null; state.picked = new Set(); state.layerSel = null; state.mode = 'post'; clearHistory();
  const p0 = selPost(); if (p0) { state.tpl = p0.tpl; state.opts = effOpts(p0); state.newSizes = sizesOf(p0).slice(); } else { state.tpl = 'fullbleed'; state.opts = defaultOpts(TPL.fullbleed); state.newSizes = (SETTINGS.sizes || ['square']).slice(); }
  return true;
}
async function leaveCampaign() { if (!state.camp) return; await saveNow(); state.camp = null; state.posts = []; state.sel = null; state.picked = new Set(); clearHistory(); STORE.lastSaved = null; }
/* one route at a time, so quick clicks never mix two campaigns */
let routeChain = Promise.resolve();
function route() { routeChain = routeChain.then(doRoute, doRoute); return routeChain; }
async function doRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  closeModal(); closeMenu();
  if (parts[0] === 'c' && parts[1]) {
    const ok = await openCampaign(parts[1]);
    if (!ok) { toast('That campaign is not saved in this browser.'); location.hash = '#/'; return; }
    state.view = parts[2] === 'download' && state.posts.length ? 'download' : 'build';
  } else if (parts[0] === 'assets') { await leaveCampaign(); HOME.camps = await listCamps(); state.view = 'assets'; }
  else { await leaveCampaign(); HOME.camps = await listCamps(); state.view = 'home'; }
  render(); window.scrollTo(0, 0);
  if (state.camp && PENDING.files) { const fs = PENDING.files; PENDING.files = null; await addPhotos(fs); }
}
function render() {
  const keep = {}; $$('[data-keep]').forEach(e => { keep[e.dataset.keep] = e.scrollTop; });
  const sameView = render.view === state.view && render.camp === (state.camp && state.camp.id), same = sameView && render.sel === state.sel;
  const ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null, wy = window.scrollY;
  reindex(); const p0 = selPost(); if (p0) { state.tpl = p0.tpl; state.opts = effOpts(p0); state.newSizes = sizesOf(p0).slice(); }
  renderHeader();
  const m = $('#main'); m.innerHTML = ''; document.body.dataset.view = state.view;
  if (state.view === 'home') m.append(viewHome());
  else if (state.view === 'assets') m.append(viewAssets());
  else if (state.view === 'download') m.append(viewExport(), barExport());
  else m.append(viewBuild(), state.posts.length ? barBuild() : '');
  if (sameView) { $$('[data-keep]').forEach(e => { const k = e.dataset.keep; if (keep[k] != null && (k !== 'edit' || same)) e.scrollTop = keep[k]; }); window.scrollTo(0, wy); }
  const nl = $('.plist'); if (nl && !same) { const on = $('.prow.on', nl); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  if (fk) { const el = $('[data-fk="' + fk + '"]'); if (el) el.focus({ preventScroll: true }); }
  render.view = state.view; render.sel = state.sel; render.camp = state.camp && state.camp.id; updUndo();
}
function renderHeader() {
  const hd = $('#hdr'); hd.innerHTML = '';
  hd.append(h('a', { href: '#/', class: 'brand', title: 'All campaigns' }, h('img', { class: 'brandlogo', src: ASSETS.logos.ib, alt: 'American Standard' }), h('span', { class: 'apptitle' }, 'Social post maker')));
  if (state.camp && (state.view === 'build' || state.view === 'download')) {
    const name = h('input', { class: 'campname', value: state.camp.name, 'aria-label': 'Campaign name', title: 'Rename the campaign. Files are named after it.', spellcheck: 'false', onchange: e => { const v = e.target.value.trim() || 'Untitled campaign'; state.camp.name = v; e.target.value = v; scheduleSave(); if (state.view === 'download') render(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); } });
    const steps = h('nav', { class: 'steps', 'aria-label': 'Steps' });
    [['1', 'Build posts'], ['2', 'Download']].forEach(([n, l], i) => { if (i) steps.append(h('span', { class: 'sep' }, icon('right', 16))); const cur = (state.view === 'build' ? 1 : 2) === i + 1, done = state.view === 'download' && i === 0; steps.append(h('button', { class: 'step' + (cur ? ' on' : '') + (done ? ' done' : ''), 'aria-current': cur ? 'step' : null, onclick: () => go(i + 1) }, h('span', { class: 'num' }, done ? icon('check', 14) : n), h('span', { class: 'lbl' }, l))); });
    hd.append(h('nav', { class: 'crumbs', 'aria-label': 'Campaign' }, h('a', { href: '#/', class: 'crumb', title: 'All campaigns' }, icon('left', 16), h('span', { class: 'ctext' }, 'Campaigns')), h('span', { class: 'cslash' }, '/'), name), steps,
      h('span', { id: 'savestate', class: 'savestate', 'aria-live': 'polite' }),
      h('button', { id: 'undoBtn', class: 'ibtn', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', disabled: !undoStack.length, onclick: undo }, icon('undo', 18)),
      h('button', { id: 'redoBtn', class: 'ibtn', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', disabled: !redoStack.length, onclick: redo }, icon('redo', 18)),
      ib('help', 'Help and shortcuts', openHelp, 'hhelp'));
    if (STORE.lastSaved) setSaved(STORE.lastSaved[0], STORE.lastSaved[1]);
  } else {
    hd.append(h('span', { class: 'grow' }), h('a', { href: '#/', class: 'hlink' + (state.view === 'home' ? ' on' : '') }, icon('home', 16), h('span', null, 'Campaigns')), h('a', { href: '#/assets', class: 'hlink' + (state.view === 'assets' ? ' on' : '') }, icon('sticker', 16), h('span', null, 'Stickers and logos')), ib('settings', 'Settings', () => openSettings()), ib('help', 'Help', openHelp));
  }
}

/* ===== Keyboard ===== */
function onKey(e) {
  const a = document.activeElement || document.body, tag = a.tagName || '', inField = /INPUT|TEXTAREA|SELECT/.test(tag) || a.isContentEditable, mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if ($('.menu') && e.key === 'Escape') { closeMenu(true); return; }
  if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (state.view !== 'build' && state.view !== 'download') return;
  if (mod && (key === 'y' || (key === 'z' && e.shiftKey)) && !inField) { e.preventDefault(); redo(); return; }
  if (mod && key === 'z' && !inField) { e.preventDefault(); undo(); return; }
  if (state.view !== 'build' || inField || !state.posts.length) return;
  const p = selPost(); if (!p) return;
  if (e.key === 'Escape' && state.layerSel) { state.layerSel = null; drawLayerBoxes(); syncLayerList(); return; }
  if (a.id === 'stage' && /^Arrow/.test(e.key)) {
    e.preventDefault(); const now = Date.now(); if (!onKey.t || now - onKey.t > 1500) snap(); onKey.t = now;
    const st = e.shiftKey ? 0.1 : 0.02, d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key], v = viewOf(p);
    if (state.layerSel) { const L = (p.layers || []).find(x => x.id === state.layerSel); if (L) { const c = layerCenter(p, L); L.pos = L.pos || {}; L.pos[v] = { x: clamp01(c.x + d[0] * st / 2), y: clamp01(c.y + d[1] * st / 2), s: c.s }; } }
    else if (lastR && lastR.photo && !lastR.photo.none) { const f = ownFrame(p, v, 1), ph = lastR.photo; f.fx = clamp01((f.fx == null ? ph.fx : f.fx) - d[0] * st); f.fy = clamp01((f.fy == null ? ph.fy : f.fy) - d[1] * st); }
    markEdited(p); refresh(); return;
  }
  const free = a === document.body || a.closest('.plist') || a.id === 'stage';
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !mod && free && a.id !== 'stage') { e.preventDefault(); const i = state.posts.indexOf(p), j = Math.max(0, Math.min(state.posts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); if (j !== i) { state.sel = state.posts[j].id; state.layerSel = null; render(); const r = $('.prow.on'); if (r && a !== document.body) r.focus(); } return; }
  if (mod && key === 'd') { e.preventDefault(); dupPost(p); return; }
  if (e.key === 'Delete' && !mod && free) { e.preventDefault(); if (state.layerSel) removeLayer(p, state.layerSel); else removePost(p); }
}

/* ===== Drop files anywhere ===== */
function setupDnD() {
  const over = $('#dropveil'); let n = 0;
  const isFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', e => { if (isFiles(e)) { n++; over.textContent = state.view === 'assets' ? 'Drop to add them to your library' : state.camp ? 'Drop your photos to add them' : 'Drop photos to start a new campaign'; over.hidden = false; } });
  window.addEventListener('dragleave', e => { if (isFiles(e)) { n = Math.max(0, n - 1); if (!n) over.hidden = true; } });
  window.addEventListener('dragover', e => { if (isFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', async e => {
    if (!isFiles(e)) return; e.preventDefault(); n = 0; over.hidden = true; const fs = [...e.dataTransfer.files]; if (!fs.length) return;
    const proj = fs.find(f => /\.asproject$/i.test(f.name)); if (proj) { openProjectFile(proj); return; }
    if (state.view === 'assets') { const added = await addAssetFiles(fs); if (added.length) { toast(plural(added.length, 'file') + ' added to your library.'); render(); } return; }
    if (!state.camp) { startWithPhotos(fs); return; }
    addPhotos(fs);
  });
}

/* ===== Start ===== */
async function init() {
  await loadAssets();
  SAMPLES = { tile: makeSample('tile'), warm: makeSample('warm'), steel: makeSample('steel') };
  SAMPLES.focus = { tile: computeFocus(SAMPLES.tile), warm: computeFocus(SAMPLES.warm), steel: computeFocus(SAMPLES.steel) };
  state.opts = defaultOpts(TPL.fullbleed);
  await initStore();
  setupDnD(); document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (state.view === 'build' && state.mode === 'post') fitStage(); closeMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state.camp) saveNow(); });
  window.addEventListener('beforeunload', () => { if (state.camp) saveNow(); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  await route();
  if (!DB.ok) toast('This browser is not saving between visits. Save project files to keep your work.');
}
init();
