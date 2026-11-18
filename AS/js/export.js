/* American Standard social post maker: the Download step, ZIP export, captions sheet and review sheet PDF. */
const campFmt = () => (state.camp && state.camp.fmt) || 'png';
const campBase = () => slug(state.camp ? state.camp.name : '') || 'AmericanStandard';
function fileName(p, s, num) { const v = (num || numbering()).get(p.id); return campBase() + '_' + pad2(v ? v.n : 1) + (v && v.g ? '-' + v.k : '') + '_' + p.tpl + '_' + s.id + '.' + campFmt(); }
function estimateMB(posts) { const k = campFmt() === 'jpg' ? 0.36 : 1.45; let b = 0; posts.forEach(p => sizesOf(p).forEach(id => { b += SIZE[id].w * SIZE[id].h * k; })); return b / 1048576; }
const mbText = mb => mb < 1 ? 'under 1 MB' : 'about ' + (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + ' MB';

function setSizeOn(p, id, on, input) {
  const cur = sizesOf(p); if (on === cur.includes(id)) return;
  if (!on && cur.length === 1) { if (input) input.checked = true; toast('Each post needs at least one size. To leave a post out, untick the box at the start of its row.'); return; }
  snap(); setPostSizes(p, on ? cur.concat(id) : cur.filter(x => x !== id)); render();
}
function toggleSizeAll(id, add) {
  snap(); let kept = 0;
  state.posts.forEach(p => { const a = sizesOf(p); if (add) { if (!a.includes(id)) setPostSizes(p, a.concat(id)); } else if (a.includes(id)) { if (a.length === 1) kept++; else setPostSizes(p, a.filter(x => x !== id)); } });
  render(); const nm = SIZE[id].name;
  withUndo(add ? nm + ' added to every post.' : kept ? nm + ' removed, except from ' + plural(kept, 'post') + ' with no other size.' : nm + ' removed from every post.');
}

function viewExport() {
  const exp = state.posts.filter(p => p.export !== false), total = imageCount(exp), allOn = exp.length === state.posts.length, num = numbering();
  const p0 = selPost() || state.posts[0];
  if (!p0) return h('div', { class: 'empty' }, h('div', { class: 'emptybox' }, h('h1', { class: 'title' }, 'Nothing to download yet'), h('p', { class: 'lede' }, 'Add some posts first.'), h('button', { class: 'btn primary', onclick: () => go(1) }, icon('left', 18), 'Back to posts')));
  const f0 = SIZE[sizesOf(p0)[0]];
  const tick = (attrs, mixed) => { const cb = h('input', Object.assign({ type: 'checkbox', class: 'cb' }, attrs)); cb.indeterminate = !!mixed; return cb; };
  const head = h('div', { class: 'mxrow mxhead' },
    h('span', { class: 'mxtick' }, tick({ 'data-fk': 'dl-all', 'aria-label': 'Download every post', checked: allOn, onchange: e => { state.posts.forEach(q => { q.export = e.target.checked; }); render(); scheduleSave(); } }, !allOn && exp.length > 0)),
    h('span', { class: 'mxhlab' }, 'Post'),
    h('div', { class: 'mxszs' }, SIZES.map(s => {
      const n = state.posts.filter(q => sizesOf(q).includes(s.id)).length;
      return h('label', { class: 'mxsz', title: sizeTip(s.id) }, h('span', { class: 'mxszl' }, shapeIcon(s.id, 13), SHORT[s.id]), h('small', null, RATIO[s.id]), tick({ 'data-fk': 'all-' + s.id, 'aria-label': s.name + ' for every post', checked: n === state.posts.length, onchange: e => toggleSizeAll(s.id, e.target.checked) }, n > 0 && n < state.posts.length));
    })),
    h('span', { class: 'mxact' }));
  const rows = state.posts.map(q => {
    const on = q.export !== false, mine = sizesOf(q), sv = SIZE[viewOf(q)], iss = checkPost(q, mine), general = iss.filter(x => !x.size), lab = postLabel(q, num);
    const c = h('canvas', { 'aria-hidden': 'true' }), sc = 64 / Math.max(sv.w, sv.h); renderPost(c, q, sv, sc * 2); c.style.width = Math.round(sv.w * sc) + 'px'; c.style.height = Math.round(sv.h * sc) + 'px';
    const open = sz => { if (sz) q.view = sz; state.sel = q.id; state.checksOpen = true; state.mode = 'post'; go(1); };
    const cells = h('div', { class: 'mxszs' }, SIZES.map(s => {
      const has = mine.includes(s.id), bad = has ? iss.filter(x => x.size === s.id) : [];
      return h('div', { class: 'mxcell' + (has ? ' on' : '') },
        h('label', { class: 'szc', title: sizeTip(s.id) }, h('input', { type: 'checkbox', checked: has, 'data-fk': 'sz-' + q.id + '-' + s.id, 'aria-label': 'Post ' + lab + ', ' + s.name, onchange: e => setSizeOn(q, s.id, e.target.checked, e.target) }), h('span', { class: 'szname' }, SHORT[s.id])),
        bad.length ? h('button', { class: 'mxwarn', title: bad.map(x => x.msg).join('\n'), 'aria-label': 'Check post ' + lab + ' in ' + s.name + '. ' + bad[0].msg, onclick: () => open(s.id) }, icon('alert', 14)) : null);
    }));
    return h('div', { class: 'mxrow' + (on ? '' : ' off') + (q.group ? ' grp' : '') },
      h('span', { class: 'mxtick' }, tick({ 'data-fk': 'dl-' + q.id, 'aria-label': 'Download post ' + lab, checked: on, onchange: e => { q.export = e.target.checked; render(); scheduleSave(); } })),
      h('button', { class: 'mxth', 'aria-label': 'Edit post ' + lab, title: 'Edit post ' + lab, onclick: () => open(null) }, c),
      h('div', { class: 'mxinfo' }, h('b', null, h('span', { class: 'pn' }, lab), h('span', { class: 'mxtpl' }, TPL[q.tpl].name), general.length ? h('button', { class: 'mxgen', title: general.map(x => x.msg).join('\n'), 'aria-label': 'Check post ' + lab + '. ' + general[0].msg, onclick: () => open(null) }, icon('alert', 14)) : null), h('small', null, (q.group ? 'Carousel slide · ' : '') + (q.date ? shortDate(q.date) + ' · ' : '') + rowText(q))),
      cells,
      h('div', { class: 'mxact' }, (q.caption || '').trim() ? ib('capcopy', 'Copy the caption of post ' + lab, () => copyText(q.caption)) : null, ib('pencil', 'Edit post ' + lab, () => open(null)), h('button', { class: 'ibtn dlbtn', 'aria-label': 'Download post ' + lab + ' only', title: 'Download this post only: ' + sizeListText(mine), onclick: () => guardedExport([q], true) }, icon('download', 18))));
  });
  const runs = redRuns(), issues = [];
  state.posts.forEach(q => { if (q.export !== false) checkPost(q, sizesOf(q)).forEach(it => issues.push({ q, it })); });
  const issueBox = h('div', { class: 'blk' }, h('span', { class: 'lab' }, 'Brand check'),
    !issues.length ? h('p', { class: 'ok' }, icon('shield', 18), 'Everything ticked follows the brand rules.') : issues.slice(0, 6).map(x => h('p', { class: 'issue ' + x.it.lvl }, icon('alert', 16), h('span', null, h('b', null, 'Post ' + postLabel(x.q, num) + '. '), x.it.msg, ' ', x.it.fix ? h('button', { class: 'link', onclick: () => { snap(); x.it.fix(); markEdited(x.q); render(); } }, 'Fix it') : h('button', { class: 'link', onclick: () => { if (x.it.size) x.q.view = x.it.size; state.sel = x.q.id; state.checksOpen = true; state.mode = 'post'; go(1); } }, 'Open')))),
    issues.length > 6 ? h('p', { class: 'small muted' }, (issues.length - 6) + ' more. Open each post to review.') : null,
    runs ? h('p', { class: 'issue warn' }, icon('alert', 16), h('span', null, 'Three or more red-bordered posts in a row. Reorder them to mix red and white borders.')) : null);
  const counts = SIZES.map(s => [s, exp.filter(q => sizesOf(q).includes(s.id)).length]).filter(x => x[1] > 0), mb = estimateMB(exp);
  const side = h('aside', { class: 'col xside', 'data-keep': 'xside' },
    h('div', { class: 'blk summary' }, h('span', { class: 'lab' }, 'Ready to download'), h('p', { class: 'big' }, plural(total, 'image')), h('p', { class: 'muted' }, 'from ' + plural(exp.length, 'post') + ', ' + mbText(mb)),
      counts.length ? h('ul', { class: 'szcount' }, counts.map(([s, n]) => h('li', null, h('span', { class: 'szi' }, shapeIcon(s.id, 13)), h('span', null, s.name), h('b', null, String(n))))) : null,
      h('p', { class: 'help' }, mb > ZIP_LIMIT_MB ? 'This is a big batch, so it comes as several ZIP files with a folder for each size. Your browser may ask you to allow several downloads.' : 'One ZIP, with a folder for each size.'), h('p', { id: 'prog', class: 'help', role: 'status' }), h('div', { id: 'donebox' })),
    h('div', { class: 'blk' }, h('span', { class: 'lab' }, 'Share for approval'), h('div', { class: 'rowbtns' }, h('button', { id: 'revBtn', class: 'btn small', onclick: () => reviewSheet(exp) }, icon('filetext', 16), 'Review sheet PDF'), h('button', { class: 'btn small', onclick: saveProjectFile }, icon('pkg', 16), 'Project file')),
      h('p', { class: 'help' }, 'The review sheet shows every ticked post with its sizes, caption and date. A project file lets a teammate open and edit this campaign.')),
    h('div', { class: 'blk' }, h('span', { class: 'lab' }, 'Files'), h('div', { class: 'seg' }, [['png', 'PNG, sharpest'], ['jpg', 'JPG, smaller']].map(([k, l]) => h('button', { class: campFmt() === k ? 'on' : '', 'aria-pressed': campFmt() === k, onclick: () => { state.camp.fmt = k; scheduleSave(); render(); } }, l))),
      h('p', { class: 'help', style: 'margin-top:12px' }, 'Files are named after the campaign, like'), h('p', { class: 'fname mono' }, fileName(p0, f0, num)),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.camp.captions !== false, onchange: e => { state.camp.captions = e.target.checked; scheduleSave(); } }), 'Add a spreadsheet of captions, alt text and dates')),
    issueBox);
  const main = h('section', { class: 'col xmain', 'data-keep': 'xmain' },
    h('div', { class: 'xhead' }, h('h1', { class: 'title' }, 'Pick sizes for each post'), h('button', { class: 'btn small mobonly', onclick: () => openBulkSizes(state.posts.map(q => q.id), 'Sizes for every post') }, icon('ratio', 16), 'Set for all')),
    h('p', { class: 'help' }, 'Tick the sizes each post needs.', h('span', { class: 'dsktxt' }, ' The boxes at the top of each column add or remove that size for every post.'), h('span', { class: 'mobtxt' }, ' Use Set for all to give every post the same sizes.'), ' Carousel slides share their sizes.'),
    h('div', { class: 'mx' }, head, rows));
  return h('div', { class: 'work s3' }, main, side);
}
function barExport() {
  const exp = state.posts.filter(p => p.export !== false), total = imageCount(exp);
  const xb = bar(h('button', { class: 'btn', onclick: () => go(1) }, icon('left', 18), h('span', null, 'Back', h('span', { class: 'bl2' }, ' to posts'))), h('span', { class: 'barinfo' }, h('b', null, plural(total, 'image')), h('span', { class: 'muted' }, 'from ' + plural(exp.length, 'post'))), h('span', { class: 'grow' }), h('button', { class: 'btn primary', id: 'dlAll', disabled: !total, onclick: () => guardedExport(exp, false) }, icon('download', 18), 'Download ' + (exp.length === 1 ? 'post' : exp.length + ' posts')));
  xb.classList.add('xbar'); return xb;
}

/* ===== Brand guard, then export ===== */
function guardedExport(posts, onlyOne) {
  const errs = []; posts.forEach(p => checkPost(p, sizesOf(p)).forEach(i => { if (i.lvl === 'error') errs.push({ p, i }); }));
  if (!errs.length) { exportPosts(posts, onlyOne); return; }
  const n = new Set(errs.map(x => x.p.id)).size, num = numbering();
  openModal(h('div', { class: 'dlg small', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gdT' },
    h('h2', { id: 'gdT', class: 'title' }, n === 1 ? '1 post breaks a brand rule' : n + ' posts break a brand rule'),
    h('div', { class: 'gdlist' }, errs.slice(0, 5).map(x => h('p', { class: 'issue error' }, icon('alert', 16), h('span', null, h('b', null, 'Post ' + postLabel(x.p, num) + '. '), x.i.msg)))),
    h('div', { class: 'actions' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closeModal }, 'Review first'), h('button', { class: 'btn primary', onclick: () => { snap(); errs.forEach(x => { if (x.i.fix) { x.i.fix(); markEdited(x.p); } }); closeModal(); render(); toast('Fixed. Downloading now.'); setTimeout(() => exportPosts(posts, onlyOne), 60); } }, icon('check', 18), 'Fix and download'))));
}
let ZIP_LIMIT_MB = 400;  /* bigger batches are split into several ZIP files */
function setBusy(on) { state.busy = on; const b = $('#dlAll'); if (b) b.disabled = on; $$('.dlbtn').forEach(x => { x.disabled = on; }); }
function captionsCSV(posts, num) {
  const cell = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"', rows = [['post', 'file name', 'template', 'sizes', 'post date', 'headline', 'caption', 'alt text']];
  posts.forEach(p => rows.push([postLabel(p, num), fileName(p, SIZE[sizesOf(p)[0]], num).replace(/_[a-z]+\.(png|jpg)$/, ''), TPL[p.tpl].name, sizesOf(p).map(id => SIZE[id].name).join(', '), p.date ? p.date.replace('T', ' ') : '', p.headline || p.label, p.caption, p.alt]));
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}
async function exportPosts(posts, onlyOne) {
  if (state.busy || !posts.length) return;
  const prog = $('#prog'), total = imageCount(posts), single = onlyOne && total === 1, mime = campFmt() === 'jpg' ? 'image/jpeg' : 'image/png', num = numbering(), base = campBase(), LIMIT = ZIP_LIMIT_MB * 1048576;
  const zipName = (n, last) => onlyOne ? base + '_post-' + postLabel(posts[0], num).replace('·', '-') + '.zip' : base + '_social-posts' + (n > 1 || !last ? '_part-' + n : '') + '.zip';
  let files = [], bytes = 0, part = 1, k = 0, ok = true, zips = 0;
  setBusy(true);
  try {
    const c = document.createElement('canvas');
    for (const p of posts) for (const id of sizesOf(p)) {
      const s = SIZE[id]; renderPost(c, p, s, 1);
      const b = await new Promise(r => c.toBlob(r, mime, 0.93)); if (!b) throw new Error('Could not make ' + s.name);
      const name = (single ? '' : s.name + ' ' + s.w + 'x' + s.h + '/') + fileName(p, s, num); k++;
      if (single) { ok = await saveBlob(name, b); continue; }
      files.push(await zipEntry(name, b)); bytes += b.size;
      if (prog) prog.textContent = 'Making images ' + k + ' of ' + total + '…';
      if (bytes > LIMIT && !onlyOne) { ok = (await saveBlob(zipName(part, false), makeZip(files))) && ok; zips++; files = []; bytes = 0; part++; }
      await new Promise(r => setTimeout(r, 0));
    }
    if (!single) {
      if (state.camp.captions !== false && !onlyOne) files.push(await zipEntry('captions.csv', new Blob(['﻿' + captionsCSV(posts, num)], { type: 'text/csv' })));
      if (files.length) { ok = (await saveBlob(zipName(part, true), makeZip(files))) && ok; zips++; }
    }
    if (prog) prog.textContent = ok ? 'Done. ' + plural(total, 'image') + ' saved' + (zips > 1 ? ' in ' + zips + ' ZIP files.' : '.') : '';
    const db = $('#donebox'); if (ok && !onlyOne && db) { db.innerHTML = ''; db.append(h('div', { class: 'saved' }, h('b', null, 'Saved. What next?'), h('div', { class: 'rowbtns' }, h('button', { class: 'btn small', onclick: () => reviewSheet(posts) }, icon('filetext', 16), 'Review sheet'), h('button', { class: 'btn small', onclick: () => { location.hash = '#/'; } }, icon('home', 16), 'All campaigns')))); }
  } catch (e) { console.error(e); toast('Something went wrong while making the images.'); if (prog) prog.textContent = ''; }
  setBusy(false);
}
async function saveProjectFile() {
  if (!state.camp) return; toast('Packing the project file…');
  try { await saveNow(); const blob = await exportProject(state.camp, state.posts); await saveBlob(campBase() + '.asproject', blob); toast('Project file saved. Open it from the home page on any computer.'); }
  catch (e) { console.error(e); toast('Could not make the project file.'); }
}

/* ===== Review sheet PDF, for sign-off ===== */
function makePDF(pages) {
  const enc = new TextEncoder(), chunks = [], offsets = []; let pos = 0;
  const add = c => { const b = typeof c === 'string' ? enc.encode(c) : c; chunks.push(b); pos += b.length; };
  add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const obj = (i, body) => { offsets[i] = pos; add(i + ' 0 obj\n'); body(); add('\nendobj\n'); }, n = pages.length;
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => add('<< /Type /Pages /Kids [' + pages.map((_, k) => (3 + 3 * k) + ' 0 R').join(' ') + '] /Count ' + n + ' >>'));
  pages.forEach((pg, k) => {
    const P = 3 + 3 * k, cs = 'q 842 0 0 595 0 0 cm /Im' + k + ' Do Q';
    obj(P, () => add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im' + k + ' ' + (P + 2) + ' 0 R >> >> /Contents ' + (P + 1) + ' 0 R >>'));
    obj(P + 1, () => add('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream'));
    obj(P + 2, () => { add('<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.data.length + ' >>\nstream\n'); add(pg.data); add('\nendstream'); });
  });
  const xref = pos, count = 3 + 3 * n; let x = 'xref\n0 ' + count + '\n0000000000 65535 f \n';
  for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + 'trailer\n<< /Size ' + count + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(chunks, { type: 'application/pdf' });
}
async function reviewSheet(posts) {
  if (!posts.length) { toast('Tick at least one post.'); return; }
  const btn = $('#revBtn'); if (btn) btn.disabled = true; toast('Making the review sheet…');
  try {
    const num = numbering(), items = [];
    posts.forEach(p => { const v = num.get(p.id), last = items[items.length - 1]; if (v.g && last && last.g === v.g) last.posts.push(p); else items.push({ g: v.g, n: v.n, posts: [p] }); });
    const PW = 1754, PH = 1240, M = 70, headH = 150, rowH = 345, per = 3, pagesN = Math.ceil(items.length / per), pages = [], date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const tmp = document.createElement('canvas');
    for (let pi = 0; pi < pagesN; pi++) {
      const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH); x.textBaseline = 'alphabetic';
      x.fillStyle = BRAND.char; font(x, 500, 36); fillT(x, state.camp.name, M, 84, 36, 500);
      font(x, 300, 20); fillT(x, 'Review sheet · ' + date + ' · page ' + (pi + 1) + ' of ' + pagesN, M, 118, 20, 300);
      if (LOGO.ib) { const lw = 300; x.drawImage(LOGO.ib, PW - M - lw, 64, lw, lw * LOGO.ib.height / LOGO.ib.width); }
      x.fillStyle = BRAND.red; x.fillRect(M, headH - 10, 56, 5);
      items.slice(pi * per, pi * per + per).forEach((it, ri) => {
        const y0 = headH + 18 + ri * rowH, p = it.posts[0], thumbX = M + 270, capX = PW - M - 500, thH = rowH - 70;
        if (ri) { x.fillStyle = '#D6D8D9'; x.fillRect(M, y0 - 12, PW - 2 * M, 1); }
        x.fillStyle = BRAND.red; font(x, 700, 46); fillT(x, String(it.n), M, y0 + 46, 46, 700);
        x.fillStyle = BRAND.char; font(x, 500, 21); const info = [[500, 21, it.g ? 'Carousel · ' + plural(it.posts.length, 'slide') : TPL[p.tpl].name], [300, 18, sizeListText(sizesOf(p))], [300, 18, p.date ? shortDate(p.date) : 'No date set']];
        let iy = y0 + 84; info.forEach(([wt, px, t]) => { const f = fit(x, t, wt, 240, px * 2.6, px, 12, 1.25, 2); drawLines(x, f, M, iy, { wt, color: BRAND.char, align: 'left' }); iy += f.h + 8; });
        const iss = it.posts.reduce((a, q) => a + checkPost(q, sizesOf(q)).length, 0);
        x.fillStyle = iss ? BRAND.red : BRAND.char; font(x, 500, 17); fillT(x, iss ? plural(iss, 'thing') + ' to check' : 'On brand', M, iy + 22, 17, 500);
        const thumbs = it.g ? it.posts.map(q => [q, viewOf(q)]) : sizesOf(p).map(id => [p, id]), gap = 18;
        let ws = thumbs.map(([, id]) => thH * SIZE[id].w / SIZE[id].h); const avail = capX - 40 - thumbX, sum = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1), k = Math.min(1, avail / sum); let tx = thumbX;
        thumbs.forEach(([q, id], ti) => { const S = SIZE[id], w = ws[ti] * k, hh = thH * k; renderPost(tmp, q, S, (w * 1.5) / S.w); x.drawImage(tmp, tx, y0, w, hh); x.strokeStyle = '#D6D8D9'; x.lineWidth = 1; x.strokeRect(tx + 0.5, y0 + 0.5, w - 1, hh - 1); x.fillStyle = BRAND.char; font(x, 300, 15); fillT(x, it.g ? 'Slide ' + (ti + 1) : SHORT[id], tx, y0 + hh + 22, 15, 300); tx += w + gap * k; });
        const cap = (p.caption || '').trim(), alt = (p.alt || '').trim();
        x.fillStyle = BRAND.char; font(x, 500, 17); fillT(x, 'Caption', capX, y0 + 18, 17, 500);
        const lines = cap ? wrap(x, cap, 300, 17, 500) : ['No caption yet.']; font(x, 300, 17); const maxL = alt ? 9 : 12;
        lines.slice(0, maxL).forEach((l, li) => { let t = l; if (li === maxL - 1 && lines.length > maxL) t = l.replace(/\s+\S*$/, '') + '…'; fillT(x, t, capX, y0 + 46 + li * 23, 17, 300); });
        if (alt) { const ay = y0 + 46 + Math.min(lines.length, maxL) * 23 + 12; font(x, 500, 15); fillT(x, 'Alt text', capX, ay, 15, 500); font(x, 300, 15); wrap(x, alt, 300, 15, 500).slice(0, 2).forEach((l, li) => fillT(x, l, capX, ay + 22 + li * 20, 15, 300)); }
      });
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88)); pages.push({ data: new Uint8Array(await blob.arrayBuffer()), w: PW, h: PH });
      await new Promise(r => setTimeout(r, 0));
    }
    await saveBlob(campBase() + '_review-sheet.pdf', makePDF(pages)); toast('Review sheet saved: ' + plural(pages.length, 'page') + '.');
  } catch (e) { console.error(e); toast('Could not make the review sheet.'); }
  if (btn) btn.disabled = false;
}
