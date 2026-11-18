/* American Standard social post maker: home page, sticker and logo library, settings and help. */
const HOME = { camps: [], q: '' };
const PENDING = { files: null };  /* photos waiting for a new campaign to open */
async function refreshHome() { HOME.camps = await listCamps(); if (state.view === 'home') render(); }
const defaultCampName = () => 'Campaign ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function viewHome() {
  const camps = HOME.camps.filter(c => !HOME.q || c.name.toLowerCase().includes(HOME.q.toLowerCase()));
  const fileIn = h('input', { type: 'file', accept: '.asproject,.zip', class: 'sr', tabindex: '-1', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) openProjectFile(f); } });
  const photoIn = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr', tabindex: '-1', onchange: e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) startWithPhotos(fs); } });
  const hero = h('section', { class: 'hhero' },
    h('div', { class: 'hcopy' }, h('span', { class: 'lab' }, 'American Standard'), h('h1', { class: 'title' }, 'Social posts, on brand, in every size'),
      h('p', { class: 'lede' }, 'Add your photos, pick a template for each post, check the brand rules and download every size at once. One post or fifty.'),
      h('div', { class: 'rowbtns' }, h('button', { class: 'btn primary', onclick: () => newCampDialog() }, icon('plus', 18), 'New campaign'), h('label', { class: 'btn', tabindex: '0', role: 'button', onkeydown: e => { if (e.key === 'Enter') fileIn.click(); } }, icon('folder', 18), 'Open project file', fileIn))),
    h('label', { class: 'hdrop', tabindex: '0', role: 'button', onkeydown: e => { if (e.key === 'Enter') photoIn.click(); } }, h('span', { class: 'bigic' }, icon('images', 40)), h('b', null, 'Drop photos here to start'), h('span', { class: 'small muted' }, 'or click to choose them. Each photo becomes a post.'), photoIn));
  const list = h('div', { class: 'cgrid' }, camps.map(campCard));
  const empty = h('div', { class: 'cempty' }, h('p', null, HOME.camps.length ? 'No campaigns match “' + HOME.q + '”.' : 'No campaigns yet. Start one above, or open the example to see how it works.'), !HOME.camps.length ? h('button', { class: 'btn', onclick: makeExample }, icon('sparkles', 16), 'Open the example campaign') : null);
  const search = HOME.camps.length > 5 ? h('label', { class: 'search' }, icon('search', 16), h('input', { type: 'search', placeholder: 'Find a campaign', value: HOME.q, 'aria-label': 'Find a campaign', 'data-fk': 'hsearch', oninput: e => { HOME.q = e.target.value; render(); } })) : null;
  const info = h('section', { class: 'hinfo' },
    h('div', { class: 'icard' }, h('span', { class: 'lab' }, 'How it works'), h('ol', { class: 'howto' }, h('li', null, h('b', null, 'Add photos. '), 'Drop them in. Paste words from a spreadsheet if you have them.'), h('li', null, h('b', null, 'Pick templates and sizes. '), 'Each post keeps its own. Tick several posts to change them together, or group them into a carousel.'), h('li', null, h('b', null, 'Check and download. '), 'Fix anything off brand, preview the feed, then download one ZIP with every size.'))),
    h('div', { class: 'icard' }, h('span', { class: 'lab' }, 'Brand rules built in'), h('ul', { class: 'ticks' }, ['Gotham type and brand colours only', 'Logo clear space and size handled for you', 'Sentence case, with a one-click fix for capitals', 'One red underline per headline', 'Readable text on photos, Story-safe layouts', 'Balanced red and white borders in the feed'].map(t => h('li', null, icon('check', 14), t)))),
    h('div', { class: 'icard' }, h('span', { class: 'lab' }, 'Your library'), h('p', null, h('b', null, plural(STORE.assets.length, 'sticker or logo', 'stickers and logos')), ' saved in this browser. Partner logos, badges and stickers you can place on any post.'), h('a', { class: 'btn small', href: '#/assets' }, icon('sticker', 16), 'Manage stickers and logos'),
      h('p', { class: 'help', style: 'margin-top:14px' }, aiReady() ? 'Claude features are on: captions, alt text, shorter text and Filipino copies.' : 'Optional: add an Anthropic API key in Settings to let Claude draft captions and alt text.')));
  return h('div', { class: 'home' }, hero, h('section', { class: 'hcamps' }, h('div', { class: 'hsec' }, h('h2', null, 'Your campaigns'), h('span', { class: 'count' }, String(HOME.camps.length)), h('span', { class: 'grow' }), search, HOME.camps.length ? h('button', { class: 'link small', onclick: makeExample }, 'Open the example') : null), camps.length ? list : empty), info,
    h('p', { class: 'hfoot help' }, DB.ok ? 'Everything is saved in this browser on this computer. Nothing is uploaded. Save a project file to move a campaign to another computer.' : 'This browser cannot save between visits, so save project files to keep your work.'));
}
function campCard(c) {
  const more = ib('more', 'More for ' + c.name, e => { e.stopPropagation(); openMenu(e.currentTarget, [['Open', () => { location.hash = '#/c/' + c.id; }], ['Rename', () => renameDialog(c)], ['Duplicate', async () => { await duplicateCamp(c.id); await refreshHome(); toast('Campaign duplicated.'); }], ['Save project file', () => campFile(c)], ['Delete', () => deleteDialog(c), 'danger']]); });
  return h('div', { class: 'ccard', role: 'link', tabindex: '0', onclick: () => { location.hash = '#/c/' + c.id; }, onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) location.hash = '#/c/' + c.id; } },
    h('div', { class: 'cthumb' }, c.thumb ? h('img', { src: c.thumb, alt: '' }) : icon('images', 36)),
    h('div', { class: 'cmeta' }, h('b', null, c.name), h('span', { class: 'small muted' }, plural(c.count || 0, 'post') + ' · edited ' + ago(c.updated))), more);
}
async function newCampDialog(files) {
  const inp = h('input', { type: 'text', value: defaultCampName(), autofocus: true, 'aria-label': 'Campaign name' });
  const create = async () => { const rec = await createCamp(inp.value); closeModal(); if (files && files.length) PENDING.files = files; location.hash = '#/c/' + rec.id; };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ncT' }, h('h2', { id: 'ncT', class: 'title' }, 'New campaign'),
    h('div', { class: 'field' }, h('label', null, 'Name'), inp, h('p', { class: 'help' }, 'Your files are named after the campaign. You can change it later.')),
    h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: create }, 'Create'))));
  setTimeout(() => inp.select(), 40);
}
async function startWithPhotos(files) { const rec = await createCamp(defaultCampName()); PENDING.files = files; location.hash = '#/c/' + rec.id; }
function renameDialog(c) {
  const inp = h('input', { type: 'text', value: c.name, autofocus: true, 'aria-label': 'Campaign name' });
  const save = async () => { await renameCamp(c.id, inp.value); closeModal(); await refreshHome(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rnT' }, h('h2', { id: 'rnT', class: 'title' }, 'Rename campaign'), h('div', { class: 'field' }, inp), h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: save }, 'Save'))));
  setTimeout(() => inp.select(), 40);
}
function deleteDialog(c) {
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlT' }, h('h2', { id: 'dlT', class: 'title' }, 'Delete “' + c.name + '”?'),
    h('p', null, 'This removes the campaign and its ' + plural(c.count || 0, 'post') + ' from this browser. It cannot be undone. Save a project file first if you might need it again.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => campFile(c) }, icon('pkg', 16), 'Save project file'), h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn danger', onclick: async () => { await deleteCamp(c.id); closeModal(); await refreshHome(); toast('Campaign deleted.'); } }, icon('trash', 16), 'Delete'))));
}
async function campFile(c) {
  toast('Packing the project file…');
  try { const r = await dbGet('camps', c.id), posts = await hydratePosts(r.posts); await saveBlob((slug(r.name) || 'AmericanStandard') + '.asproject', await exportProject(r, posts)); toast('Project file saved.'); }
  catch (e) { console.error(e); toast('Could not make the project file.'); }
}
async function openProjectFile(f) {
  toast('Opening ' + f.name + '…');
  try { const rec = await importProject(f); location.hash = '#/c/' + rec.id; toast('Opened “' + rec.name + '”.'); }
  catch (e) { console.error(e); toast(e.message || 'Could not open that file.'); }
}
async function makeExample() {
  const rec = await createCamp('Example campaign'), S = k => sampleImg(k), g = gid(), day = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(18, 0, 0, 0); return parsePostDate(d.toISOString()); };
  const P = (tpl, sizes, k, f, opts) => serPost(Object.assign(blankPost(), { tpl, opts: Object.assign(defaultOpts(TPL[tpl]), opts || {}), sizes, img: S(k), img2: S('steel'), demo: true }, f));
  rec.posts = [
    P('fullbleed', ['square', 'story'], 'tile', { headline: 'Life is about having the right kind of pressure', keyword: 'right', caption: 'A shower that gets it just right, every morning. Find yours at American Standard. #AmericanStandard', date: day(1) }),
    P('price', ['portrait'], 'steel', { label: 'Acacia E wall-hung toilet', price: '₱18,990', was: '₱23,500', headline: 'Bathroom upgrade sale', fine: 'Promo runs until 30 Nov 2026. While stocks last.', date: day(2) }),
    P('beforeafter', ['square'], 'warm', { headline: 'A bathroom refresh in one weekend', keyword: 'one weekend', group: g, date: day(3) }),
    P('tips', ['square'], 'tile', { headline: 'Keep your new shower spotless', keyword: 'spotless', t1: 'Wipe the glass after every use.', t2: 'Rinse the shower head once a month.', t3: 'Use a soft cloth, never steel wool.', group: g }),
    P('features', ['square', 'portrait'], 'steel', { label: 'Acacia SupaSleek', headline: 'One-piece toilet', f1: 'Hygiene Rim for easier cleaning', f2: 'Soft-close seat', f3: 'Dual flush saves water', date: day(5) }),
    P('event', ['story', 'portrait'], 'warm', { day: '28–30', month: 'Nov 2026', headline: 'Visit us at the Design Week showcase', keyword: 'Design Week', sub: 'Hall B, booth 12 · 10 am to 8 pm', date: day(6) }),
    P('footer', ['portrait'], 'warm', { headline: 'Good things hide in plain sight', keyword: 'plain sight', footer: 'Every moment matters', date: day(8) })
  ];
  rec.count = rec.posts.length; await dbPut('camps', rec.id, rec); location.hash = '#/c/' + rec.id;
}

/* ===== Stickers and logos ===== */
const KINDS = [['all', 'All'], ['logo', 'Logos'], ['badge', 'Badges'], ['sticker', 'Stickers']];
let assetKind = 'all';
function assetThumb(a, size) { const c = h('canvas', { width: size, height: size, 'aria-hidden': 'true' }), im = ASSET_IMG[a.id]; if (im) { const x = c.getContext('2d'), s = Math.min(size / im.width, size / im.height) * 0.9; x.drawImage(im, (size - im.width * s) / 2, (size - im.height * s) / 2, im.width * s, im.height * s); } return c; }
function assetUpload(label, cls, after) {
  const inp = h('input', { type: 'file', accept: 'image/png,image/svg+xml,image/webp,image/jpeg', multiple: true, class: 'sr', tabindex: '-1', onchange: async e => { const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return; const added = await addAssetFiles(fs, assetKind !== 'all' ? assetKind : null); if (added.length) toast(plural(added.length, 'file') + ' added to your library.'); if (after) after(added); } });
  return h('label', { class: cls, tabindex: '0', role: 'button', onkeydown: e => { if (e.key === 'Enter') inp.click(); } }, icon('upload', 16), label, inp);
}
function viewAssets() {
  const list = STORE.assets.filter(a => assetKind === 'all' || a.kind === assetKind), used = {};
  HOME.camps.forEach(c => (c.posts || []).forEach(q => (q.layers || []).forEach(l => { used[l.asset] = (used[l.asset] || 0) + 1; })));
  const grid = h('div', { class: 'agrid' }, list.map(a => {
    const name = h('input', { type: 'text', value: a.name, 'aria-label': 'Name', onchange: async e => { a.name = e.target.value.trim() || a.name; await saveAsset(a); } });
    const kind = h('select', { 'aria-label': 'Kind', onchange: async e => { a.kind = e.target.value; await saveAsset(a); render(); } }, KINDS.slice(1).map(([k, l]) => h('option', { value: k, selected: a.kind === k }, l.replace(/s$/, ''))));
    return h('div', { class: 'acard' }, h('div', { class: 'athumb' }, assetThumb(a, 200)), name, h('div', { class: 'arow' }, kind, h('span', { class: 'small muted' }, used[a.id] ? 'On ' + plural(used[a.id], 'post') : ''), h('span', { class: 'grow' }),
      ib('trash', 'Delete ' + a.name, () => openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true' }, h('h2', { class: 'title' }, 'Delete ' + a.name + '?'), h('p', null, used[a.id] ? 'It is on ' + plural(used[a.id], 'post') + '. Those posts will lose it.' : 'It is not on any post.'), h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn danger', onclick: async () => { await deleteAsset(a.id); closeModal(); render(); toast('Deleted.'); } }, 'Delete')))), 'sm danger')));
  }));
  return h('div', { class: 'assets' }, h('div', { class: 'ahead' }, h('div', null, h('h1', { class: 'title' }, 'Stickers and logos'), h('p', { class: 'lede' }, 'Partner logos, badges and stickers you can place on any post. PNG or SVG with a clear background works best. They are saved in this browser and travel inside project files.')), assetUpload('Upload', 'btn primary', () => render())),
    h('div', { class: 'filters' }, KINDS.map(([k, l]) => h('button', { class: 'fchip' + (assetKind === k ? ' on' : ''), 'aria-pressed': assetKind === k, onclick: () => { assetKind = k; render(); } }, l))),
    list.length ? grid : h('div', { class: 'cempty' }, h('p', null, STORE.assets.length ? 'Nothing in this group yet.' : 'Your library is empty. Drop PNG or SVG files anywhere on this page, or use Upload.')),
    h('p', { class: 'help' }, 'Only use logos and artwork you have permission to use. The American Standard logo is already built into the templates.'));
}
function openAssetPicker(onPick) {
  let kind = 'all';
  const body = h('div');
  const draw = () => {
    body.innerHTML = ''; const list = STORE.assets.filter(a => kind === 'all' || a.kind === kind);
    body.append(h('div', { class: 'filters' }, KINDS.map(([k, l]) => h('button', { class: 'fchip' + (kind === k ? ' on' : ''), onclick: () => { kind = k; draw(); } }, l))),
      list.length ? h('div', { class: 'agrid pick' }, list.map(a => h('button', { class: 'acard', title: 'Add ' + a.name, onclick: () => { closeModal(); onPick(a.id); } }, h('div', { class: 'athumb' }, assetThumb(a, 140)), h('span', { class: 'aname' }, a.name)))) : h('div', { class: 'cempty' }, h('p', null, 'Nothing here yet. Upload a PNG or SVG logo, badge or sticker.')));
  };
  draw();
  openModal(h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'apT' }, h('div', { class: 'dlghead' }, h('h2', { id: 'apT', class: 'title' }, 'Add a sticker or logo'), ib('x', 'Close', closeModal)), body,
    h('div', { class: 'actions' }, assetUpload('Upload new', 'btn', added => { if (added.length === 1) { closeModal(); onPick(added[0].id); } else draw(); }), h('span', { class: 'grow' }), h('a', { class: 'link small', href: '#/assets', onclick: () => closeModal() }, 'Manage library'))));
}

/* ===== Settings ===== */
function openSettings(focus) {
  const key = h('input', { type: 'password', id: 'set-key', value: SETTINGS.apiKey || '', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Anthropic API key' });
  const model = h('select', { id: 'set-model', 'aria-label': 'Claude model' }, AI_MODELS.map(([v, l]) => h('option', { value: v, selected: (SETTINGS.model || AI_MODELS[0][0]) === v }, l)));
  const status = h('p', { class: 'help' }, aiReady() ? 'A key is saved in this browser.' : 'No key yet. Everything else works without one.');
  const show = h('button', { class: 'link small', type: 'button', onclick: () => { key.type = key.type === 'password' ? 'text' : 'password'; show.textContent = key.type === 'password' ? 'Show' : 'Hide'; } }, 'Show');
  const test = h('button', { class: 'btn small', onclick: async () => { if (!key.value.trim()) { status.textContent = 'Paste a key first.'; return; } test.disabled = true; status.textContent = 'Checking…'; try { await testKey(key.value, model.value); status.textContent = 'The key works.'; } catch (e) { status.textContent = e.message; } test.disabled = false; } }, 'Test key');
  const tags = h('div', { class: 'tagsets' }); let sets = SETTINGS.hashtags.map(s => Object.assign({}, s));
  const drawTags = () => { tags.innerHTML = ''; sets.forEach((s, i) => tags.append(h('div', { class: 'tagset' }, h('input', { type: 'text', value: s.name, 'aria-label': 'Set name', placeholder: 'Name', oninput: e => { s.name = e.target.value; } }), h('input', { type: 'text', value: s.tags, 'aria-label': 'Hashtags', placeholder: '#AmericanStandard #Bathroom', oninput: e => { s.tags = e.target.value; } }), ib('trash', 'Remove this set', () => { sets.splice(i, 1); drawTags(); }, 'sm')))); tags.append(h('button', { class: 'link small', onclick: () => { sets.push({ name: 'Set ' + (sets.length + 1), tags: '' }); drawTags(); } }, '+ Add a set')); };
  drawTags();
  let defSizes = (SETTINGS.sizes || ['square']).slice(); const szBox = h('div');
  const drawSz = () => { szBox.innerHTML = ''; szBox.append(sizeTiles(defSizes, id => { defSizes = defSizes.includes(id) ? (defSizes.length > 1 ? defSizes.filter(x => x !== id) : defSizes) : sortSizes(defSizes.concat(id)); drawSz(); })); };
  drawSz();
  const save = async () => { SETTINGS.apiKey = key.value.trim(); SETTINGS.model = model.value; SETTINGS.hashtags = sets.filter(s => (s.name || s.tags || '').trim()); SETTINGS.sizes = defSizes; await saveSettings(); closeModal(); render(); toast('Settings saved.'); };
  openModal(h('div', { class: 'dlg settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'stT' }, h('div', { class: 'dlghead' }, h('h2', { id: 'stT', class: 'title' }, 'Settings'), ib('x', 'Close', closeModal)),
    h('section', { class: 'setsec', id: 'sec-ai' }, h('h3', null, icon('sparkles', 16), 'Claude (optional)'), h('p', null, 'Claude can draft captions, write alt text from your photos, shorten text that does not fit and make Filipino copies. It uses your own Anthropic API key, which stays in this browser. Use is billed to your Anthropic API account, which is separate from a Claude plan. Create a key in the ', h('a', { href: 'https://console.anthropic.com', target: '_blank', rel: 'noopener' }, 'Claude Console'), '.'),
      h('div', { class: 'field' }, h('div', { class: 'labrow' }, h('label', { for: 'set-key' }, 'API key'), show), key), h('div', { class: 'field' }, h('label', { for: 'set-model' }, 'Model'), model), h('div', { class: 'rowbtns' }, test, aiReady() ? h('button', { class: 'link small', onclick: () => { key.value = ''; status.textContent = 'The key will be removed when you save.'; } }, 'Remove key') : null), status),
    h('section', { class: 'setsec', id: 'sec-tags' }, h('h3', null, icon('hash', 16), 'Hashtag sets'), h('p', { class: 'help' }, 'Add a set to a caption with one click. The first set is used when Claude drafts a caption.'), tags),
    h('section', { class: 'setsec' }, h('h3', null, icon('ratio', 16), 'Sizes for new campaigns'), szBox, h('p', { class: 'help' }, 'New posts copy the sizes of the post you have open. These sizes are used when a campaign has no posts yet.')),
    h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: save }, 'Save'))));
  if (focus) setTimeout(() => { const s = $('#sec-' + focus); if (s) { s.scrollIntoView({ block: 'start' }); const f = $('input', s); if (f) f.focus(); } }, 60);
}

/* ===== Help ===== */
function openHelp() {
  const k = (...keys) => h('span', { class: 'keys' }, keys.map(x => h('kbd', null, x)));
  openModal(h('div', { class: 'dlg help-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hlT' }, h('div', { class: 'dlghead' }, h('h2', { id: 'hlT', class: 'title' }, 'How it works'), ib('x', 'Close', closeModal)),
    h('ol', { class: 'howto' },
      h('li', null, h('b', null, 'Add photos. '), 'Drop them anywhere. Each photo becomes a post. Paste words from a spreadsheet, including templates, sizes and dates.'),
      h('li', null, h('b', null, 'Pick a template and sizes for each post. '), 'Each size keeps its own photo position. Tick several posts to change them together, add a sticker, or group them into a carousel.'),
      h('li', null, h('b', null, 'Check the feed, then download. '), 'The Feed view shows your profile grid. Download one ZIP with a folder for each size, a review sheet PDF for sign-off, or a project file for a teammate.')),
    h('div', { class: 'hcols' },
      h('div', null, h('span', { class: 'lab' }, 'Brand rules built in'), h('ul', { class: 'ticks' }, ['Gotham type and brand colours only', 'Logo clear space and minimum size', 'Sentence case, with a one-click fix', 'One red underline per headline', 'Readable text on photos', 'Story-safe layouts and stickers', 'Balanced red and white borders'].map(t => h('li', null, icon('check', 14), t)))),
      h('div', null, h('span', { class: 'lab' }, 'Shortcuts'), h('ul', { class: 'shortcuts' },
        h('li', null, k('↑', '↓'), 'Previous or next post'), h('li', null, k('Ctrl', 'D'), 'Duplicate post'), h('li', null, k('Delete'), 'Remove the post or the selected sticker'), h('li', null, k('←', '→'), 'Nudge the photo or sticker (click it first)'), h('li', null, k('Ctrl', 'Z'), 'Undo'), h('li', null, k('Ctrl', 'Shift', 'Z'), 'Redo'), h('li', null, k('Esc'), 'Close a window')))),
    h('p', { class: 'help' }, DB.ok ? 'Your work saves automatically in this browser on this computer. Nothing is uploaded.' : 'This browser cannot save between visits. Save a project file before you close the page.')));
}
