/* Saving in this browser (IndexedDB), project files and ZIP helpers. Nothing is uploaded anywhere. */
const DB = { db: null, ok: false };
const STORE = { saveT: 0, busy: false, again: false, stored: new Set(), imgCache: new Map(), assets: [] };
const MEM = { camps: new Map(), imgs: new Map(), assets: new Map(), kv: new Map() };

function idbOpen() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('as-post-maker', 1);
      r.onupgradeneeded = () => { const d = r.result; ['camps', 'imgs', 'assets', 'kv'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
    } catch (e) { rej(e); }
  });
}
function tx(store, mode, fn) { return new Promise((res, rej) => { try { const t = DB.db.transaction(store, mode), r = fn(t.objectStore(store)); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch (e) { rej(e); } }); }
const dbGet = (s, k) => DB.ok ? tx(s, 'readonly', o => o.get(k)) : Promise.resolve(MEM[s].get(k));
const dbPut = (s, k, v) => DB.ok ? tx(s, 'readwrite', o => o.put(v, k)) : Promise.resolve(MEM[s].set(k, v));
const dbDel = (s, k) => DB.ok ? tx(s, 'readwrite', o => o.delete(k)) : Promise.resolve(MEM[s].delete(k));
const dbAll = s => DB.ok ? tx(s, 'readonly', o => o.getAll()) : Promise.resolve([...MEM[s].values()]);
const dbKeys = s => DB.ok ? tx(s, 'readonly', o => o.getAllKeys()) : Promise.resolve([...MEM[s].keys()]);
async function initStore() {
  try { DB.db = await idbOpen(); DB.ok = true; const k = await dbKeys('imgs'); k.forEach(x => STORE.stored.add(x)); } catch (e) { DB.ok = false; }
  try { const s = await dbGet('kv', 'settings'); if (s) Object.assign(SETTINGS, s); } catch (e) { }
  await loadAssetLib();
}
async function saveSettings() { try { await dbPut('kv', 'settings', JSON.parse(JSON.stringify(SETTINGS))); } catch (e) { } }

/* ===== Posts to and from storage ===== */
function imgRef(img) { if (!img) return null; if (img.sample) return { sample: true, key: img.key || 'tile' }; if (!img.id) img.id = newImgId(); return { id: img.id, name: img.name, ow: img.ow, oh: img.oh, png: !!img.png, focus: img.focus || null }; }
function serPost(p) { const q = {}; Object.keys(p).forEach(k => { if (['id', 'idx', 'img', 'img2', 'partner'].includes(k)) return; q[k] = p[k]; }); q.img = imgRef(p.img); q.img2 = imgRef(p.img2); q.partner = imgRef(p.partner); return JSON.parse(JSON.stringify(q)); }
async function imgFromRef(r) {
  if (!r) return null; if (r.sample) return sampleImg(r.key);
  if (STORE.imgCache.has(r.id)) return STORE.imgCache.get(r.id);
  try {
    const blob = await dbGet('imgs', r.id); if (!blob) return null;
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    const img = { src: c, name: r.name, sample: false, ow: r.ow, oh: r.oh, id: r.id, png: r.png, focus: r.focus || computeFocus(c) };
    STORE.imgCache.set(r.id, img); STORE.stored.add(r.id); return img;
  } catch (e) { return null; }
}
async function hydratePosts(list) {
  const out = [];
  for (const q of list || []) {
    const t = TPL[q.tpl] ? q.tpl : 'fullbleed';
    out.push(newPost(Object.assign({}, q, { tpl: t, opts: Object.assign({}, q.opts), sizes: sortSizes(q.sizes || ['square']), frames: cloneFrames(q.frames), frames2: cloneFrames(q.frames2), layers: (q.layers || []).map(l => Object.assign({}, l, { pos: cloneFrames(l.pos) })), img: await imgFromRef(q.img), img2: await imgFromRef(q.img2), partner: await imgFromRef(q.partner) })));
  }
  return out;
}
async function storeImages(posts) {
  for (const p of posts) for (const img of [p.img, p.img2, p.partner]) {
    if (!img || img.sample) continue; if (!img.id) img.id = newImgId();
    if (STORE.stored.has(img.id)) continue;
    const blob = await new Promise(r => img.src.toBlob(r, img.png ? 'image/png' : 'image/jpeg', 0.92)); if (!blob) continue;
    await dbPut('imgs', img.id, blob); STORE.stored.add(img.id); STORE.imgCache.set(img.id, img);
  }
}
function makeThumb(posts) {
  try {
    const list = posts.slice(0, 4); if (!list.length) return null;
    const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d'); x.fillStyle = '#F1F2F2'; x.fillRect(0, 0, 240, 240);
    const t = document.createElement('canvas'), n = list.length === 1 ? 1 : 2, cell = 240 / n;
    list.forEach((p, i) => { renderPost(t, p, SIZE.square, cell / 1080); x.drawImage(t, (i % n) * cell, Math.floor(i / n) * cell, cell, cell); });
    return c.toDataURL('image/jpeg', 0.72);
  } catch (e) { return null; }
}

/* ===== Campaigns ===== */
function setSaved(txt, bad) { STORE.lastSaved = txt ? [txt, bad] : null; const el = $('#savestate'); if (!el) return; el.innerHTML = ''; if (!txt) return; el.className = 'savestate' + (bad ? ' bad' : ''); el.title = bad ? 'This browser is not saving. Download or save a project file before you close the page.' : 'Saved in this browser on this computer'; el.append(icon(bad ? 'alert' : 'check', 14), h('span', null, txt)); }
function scheduleSave() { if (!state.camp) return; clearTimeout(STORE.saveT); STORE.saveT = setTimeout(saveNow, 800); }
async function saveNow() {
  clearTimeout(STORE.saveT);
  if (!state.camp) return; if (STORE.busy) { STORE.again = true; return; } STORE.busy = true;
  const camp = state.camp;
  try {
    setSaved('Saving…');
    await storeImages(state.posts);
    const rec = Object.assign({}, camp, { posts: state.posts.map(serPost), sel: state.posts.findIndex(p => p.id === state.sel), updated: Date.now(), count: state.posts.length, thumb: makeThumb(state.posts) });
    await dbPut('camps', camp.id, rec); camp.updated = rec.updated;
    setSaved(DB.ok ? 'Saved' : 'Not saved', !DB.ok);
  } catch (e) { console.warn(e); setSaved('Not saved', true); }
  STORE.busy = false; if (STORE.again) { STORE.again = false; scheduleSave(); }
}
async function listCamps() { const all = await dbAll('camps'); return all.sort((a, b) => b.updated - a.updated); }
async function createCamp(name) { const now = Date.now(); const rec = { id: uid('c'), name: (name || '').trim() || 'Untitled campaign', created: now, updated: now, posts: [], sel: 0, fmt: 'png', captions: true, count: 0, thumb: null }; await dbPut('camps', rec.id, rec); return rec; }
async function renameCamp(id, name) { const r = await dbGet('camps', id); if (!r) return; r.name = (name || '').trim() || r.name; r.updated = Date.now(); await dbPut('camps', id, r); if (state.camp && state.camp.id === id) state.camp.name = r.name; }
async function duplicateCamp(id) { const r = await dbGet('camps', id); if (!r) return null; const now = Date.now(), c = Object.assign({}, r, { id: uid('c'), name: 'Copy of ' + r.name, created: now, updated: now }); await dbPut('camps', c.id, c); return c; }
async function deleteCamp(id) { await dbDel('camps', id); await gcImages(); }
async function gcImages() {
  try {
    const camps = await dbAll('camps'), used = new Set();
    camps.forEach(c => (c.posts || []).forEach(q => [q.img, q.img2, q.partner].forEach(r => { if (r && r.id) used.add(r.id); })));
    if (state.camp) state.posts.forEach(p => [p.img, p.img2, p.partner].forEach(i => { if (i && i.id) used.add(i.id); }));
    for (const k of await dbKeys('imgs')) if (!used.has(k)) { await dbDel('imgs', k); STORE.stored.delete(k); STORE.imgCache.delete(k); }
  } catch (e) { }
}

/* ===== Sticker and logo library ===== */
async function loadAssetLib() {
  try { STORE.assets = (await dbAll('assets')).sort((a, b) => a.created - b.created); } catch (e) { STORE.assets = []; }
  for (const a of STORE.assets) { try { ASSET_IMG[a.id] = await createImageBitmap(a.blob); } catch (e) { } }
}
async function rasterSvg(f) {
  const url = URL.createObjectURL(f);
  try { const im = await loadImg(url), w = im.naturalWidth || 1000, hh = im.naturalHeight || 1000, sc = 1600 / Math.max(w, hh), c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(hh * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }
  finally { URL.revokeObjectURL(url); }
}
const guessKind = n => /logo|brand|partner/i.test(n) ? 'logo' : /badge|seal|award/i.test(n) ? 'badge' : 'sticker';
async function addAssetFiles(files, kind) {
  const added = [];
  for (const f of files) {
    if (!isImageFile(f)) { toast(f.name + ' is not an image. Use PNG, SVG, JPG or WebP.'); continue; }
    try {
      const src = /svg/i.test(f.type) || /\.svg$/i.test(f.name) ? await rasterSvg(f) : await createImageBitmap(f);
      const sc = Math.min(1, 1600 / Math.max(src.width, src.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * sc)); c.height = Math.max(1, Math.round(src.height * sc));
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const a = { id: uid('a'), name: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), kind: kind || guessKind(f.name), blob, w: c.width, h: c.height, created: Date.now() };
      await dbPut('assets', a.id, a); ASSET_IMG[a.id] = await createImageBitmap(blob); STORE.assets.push(a); added.push(a);
    } catch (e) { toast('Could not open ' + f.name + '.'); }
  }
  return added;
}
async function saveAsset(a) { await dbPut('assets', a.id, a); }
async function deleteAsset(id) { await dbDel('assets', id); STORE.assets = STORE.assets.filter(a => a.id !== id); delete ASSET_IMG[id]; }
const assetById = id => STORE.assets.find(a => a.id === id);

/* ===== ZIP files (store only for writing; reads stored or deflated entries) ===== */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/* an entry keeps only its Blob, so big batches do not hold every image twice in memory */
async function zipEntry(name, data) { const blob = data instanceof Blob ? data : new Blob([data]); const crc = crc32(new Uint8Array(await blob.arrayBuffer())); return { name, blob, crc, size: blob.size }; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), time = (d.getHours() << 11) | (d.getMinutes() << 5);
  files.forEach(f => {
    const nb = enc.encode(f.name);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, f.crc, true); lh.setUint32(18, f.size, true); lh.setUint32(22, f.size, true); lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, nb, f.blob);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, f.crc, true); ch.setUint32(20, f.size, true); ch.setUint32(24, f.size, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, nb); off += 30 + nb.length + f.size;
  });
  const csz = central.reduce((a, b) => a + b.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer); let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('This file is not a project file.');
  const n = dv.getUint16(e + 10, true), out = {}; let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen)), start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    out[name] = { method, data: buf.subarray(start, start + csize) }; p += 46 + nlen + xlen + clen;
  }
  return out;
}
async function zipData(entry) {
  if (entry.method === 0) return entry.data;
  if (entry.method === 8 && typeof DecompressionStream !== 'undefined') { const s = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
  throw new Error('This project file uses a compression this browser cannot open.');
}

/* ===== Project files: one campaign with its photos and stickers, to move between computers or hand over ===== */
async function exportProject(camp, posts) {
  const entries = [], imgs = new Map(), assetIds = new Set();
  posts.forEach(p => { [p.img, p.img2, p.partner].forEach(i => { if (i && !i.sample) { if (!i.id) i.id = newImgId(); imgs.set(i.id, i); } }); (p.layers || []).forEach(l => assetIds.add(l.asset)); });
  const assets = STORE.assets.filter(a => assetIds.has(a.id));
  const meta = { app: 'american-standard-post-maker', version: 1, saved: new Date().toISOString(), camp: { name: camp.name, fmt: camp.fmt, captions: camp.captions }, posts: posts.map(serPost), assets: assets.map(a => ({ id: a.id, name: a.name, kind: a.kind, w: a.w, h: a.h })) };
  entries.push(await zipEntry('project.json', new Blob([JSON.stringify(meta)], { type: 'application/json' })));
  for (const [id, img] of imgs) { const blob = (await dbGet('imgs', id)) || await new Promise(r => img.src.toBlob(r, img.png ? 'image/png' : 'image/jpeg', 0.92)); entries.push(await zipEntry('images/' + id + (img.png ? '.png' : '.jpg'), blob)); }
  for (const a of assets) entries.push(await zipEntry('assets/' + a.id + '.png', a.blob));
  return makeZip(entries);
}
async function importProject(file) {
  const z = await readZip(file), pj = z['project.json'];
  if (!pj) throw new Error('This file is not a post maker project file.');
  const meta = JSON.parse(new TextDecoder().decode(await zipData(pj)));
  for (const name of Object.keys(z)) {
    const m = /^images\/([^/.]+)\.(jpg|png)$/.exec(name);
    if (m && !STORE.stored.has(m[1])) { await dbPut('imgs', m[1], new Blob([await zipData(z[name])], { type: m[2] === 'png' ? 'image/png' : 'image/jpeg' })); STORE.stored.add(m[1]); }
  }
  for (const a of meta.assets || []) {
    if (assetById(a.id)) continue; const e = z['assets/' + a.id + '.png']; if (!e) continue;
    const blob = new Blob([await zipData(e)], { type: 'image/png' }), rec = Object.assign({}, a, { blob, created: Date.now() });
    await dbPut('assets', a.id, rec); STORE.assets.push(rec); try { ASSET_IMG[a.id] = await createImageBitmap(blob); } catch (er) { }
  }
  const now = Date.now(), c = meta.camp || {};
  const rec = { id: uid('c'), name: c.name || file.name.replace(/\.[a-z0-9]+$/i, ''), created: now, updated: now, posts: meta.posts || [], sel: 0, fmt: c.fmt || 'png', captions: c.captions !== false, count: (meta.posts || []).length, thumb: null };
  try { rec.thumb = makeThumb(await hydratePosts(rec.posts.slice(0, 4))); } catch (e) { }
  await dbPut('camps', rec.id, rec); return rec;
}

/* ===== Saving a file to the computer ===== */
async function saveBlob(filename, data) {
  try { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); return true; }
  catch (e) { toast('This browser could not save the file.'); return false; }
}
const saveText = (name, text, type) => saveBlob(name, new Blob([text], { type: type || 'text/csv' }));
