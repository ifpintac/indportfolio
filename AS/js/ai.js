/* Optional Claude features. They call the Anthropic API from this browser with the user's own key, which is kept only in this browser. */
const aiReady = () => !!(SETTINGS.apiKey || '').trim();
const AI_MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (best writing)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (faster, lower cost)']];
const BRAND_VOICE = 'You write social media copy for American Standard, the bathroom and kitchen brand, for its Philippines and Asia Pacific pages.\n'
  + 'Voice: warm, confident, simple and helpful. Short sentences. Sentence case, never all capitals. At most one exclamation mark. No emojis unless the brief already uses them.\n'
  + 'Keep product and collection names exactly as given. Never invent prices, dates, promos, awards or claims that are not in the brief.';

async function claudeAsk({ system, content, max }) {
  if (!aiReady()) { openSettings('ai'); throw new Error('Add your Anthropic API key in Settings first.'); }
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': SETTINGS.apiKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: SETTINGS.model || AI_MODELS[0][0], max_tokens: max || 600, system, messages: [{ role: 'user', content }] }) });
  } catch (e) { throw new Error('Could not reach Claude. Check your internet connection.'); }
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) throw new Error(r.status === 401 ? 'Claude did not accept the API key. Check it in Settings.' : (j && j.error && j.error.message) || 'Claude could not answer (error ' + r.status + ').');
  return ((j && j.content) || []).map(c => c.text || '').join('').trim();
}
async function testKey(key, model) {
  const old = SETTINGS.apiKey, oldM = SETTINGS.model; SETTINGS.apiKey = key; SETTINGS.model = model;
  try { await claudeAsk({ system: 'Reply with OK.', content: 'OK?', max: 5 }); return true; } finally { SETTINGS.apiKey = old; SETTINGS.model = oldM; }
}
function imagePart(img, max) {
  const src = img.src, sc = Math.min(1, (max || 1024) / Math.max(src.width, src.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * sc)); c.height = Math.max(1, Math.round(src.height * sc)); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] } };
}
function postBrief(p) {
  const t = TPL[p.tpl], out = ['Template: ' + t.name + '. ' + t.use];
  TEXT_KEYS.filter(k => !['caption', 'alt', 'keyword'].includes(k)).forEach(k => { const v = (p[k] || '').trim(); if (v) out.push(k + ': ' + v); });
  if (state.camp) out.push('Campaign: ' + state.camp.name); if (p.date) out.push('Posting date: ' + p.date.replace('T', ' '));
  return out.join('\n');
}
const cleanAI = s => s.replace(/^["“”']+|["“”']+$/g, '').trim();
function aiBtn(label, fn) {
  const b = h('button', { class: 'aibtn', type: 'button', title: aiReady() ? label : 'Add your Anthropic API key in Settings to use Claude', onclick: async () => {
    if (!aiReady()) { openSettings('ai'); return; }
    if (b.disabled) return; const sp = b.lastChild, old = sp.textContent; b.disabled = true; sp.textContent = 'Writing…';
    try { await fn(b); } catch (e) { toast(e.message || 'Claude could not answer.'); }
    b.disabled = false; sp.textContent = old;
  } }, icon('sparkles', 14), h('span', null, label));
  return b;
}
async function aiCaption(p, ta) {
  const tags = (SETTINGS.hashtags[0] && SETTINGS.hashtags[0].tags || '').trim();
  const out = await claudeAsk({ system: BRAND_VOICE, max: 500, content: [p.img && !p.img.sample ? imagePart(p.img, 768) : null, { type: 'text', text: 'Write an Instagram and Facebook caption for this post.\n' + postBrief(p) + '\n\nRules: 2 to 4 short sentences, then one line with up to 5 relevant hashtags' + (tags ? ', including ' + tags : '') + '. The first sentence must work on its own, because only about 125 characters show before "more". Reply with the caption only.' }].filter(Boolean) });
  snap(); p.caption = cleanAI(out); markEdited(p); ta.value = p.caption; ta.dispatchEvent(new Event('input')); toast('Caption drafted. Read it through before you post.');
}
const ALT_SYS = 'You write alt text for photos on a brand’s social media posts, for people who use screen readers.';
const altPrompt = p => 'Write alt text for this photo, which is posted with this text: ' + ((p.headline || p.label || '').trim() || 'none') + '. One or two plain sentences, under 220 characters. Describe what matters: the people, the room and the product. Do not start with "Image of" or "Photo of". Reply with the alt text only.';
async function aiAlt(p, ta) {
  if (!p.img || p.img.sample) { toast('Add a real photo first.'); return; }
  const out = await claudeAsk({ system: ALT_SYS, max: 200, content: [imagePart(p.img, 1024), { type: 'text', text: altPrompt(p) }] });
  snap(); p.alt = cleanAI(out); markEdited(p); if (ta) ta.value = p.alt; toast('Alt text written.');
}
async function aiAltBatch(ids) {
  if (!aiReady()) { openSettings('ai'); return; }
  const posts = ids.map(getPost).filter(p => p && p.img && !p.img.sample); if (!posts.length) { toast('None of the ticked posts has a real photo yet.'); return; }
  snap(); let done = 0;
  for (const p of posts) {
    toast('Writing alt text ' + (done + 1) + ' of ' + posts.length + '…');
    try { const out = await claudeAsk({ system: ALT_SYS, max: 200, content: [imagePart(p.img, 900), { type: 'text', text: altPrompt(p) }] }); p.alt = cleanAI(out); markEdited(p); done++; } catch (e) { toast(e.message); break; }
  }
  render(); if (done) toast('Alt text written for ' + plural(done, 'post') + '.');
}
async function aiShorten(p, issue) {
  const m = issue.msg, field = /^(Headline|Banner text|Tab|Message|Quote|Title|Event name|Bar title)/.test(m) ? 'headline' : /^(Second line|Details|Short line|Caption)/.test(m) ? 'sub' : /^Product name/.test(m) ? 'label' : /^Footer/.test(m) ? 'footer' : /^Fine print/.test(m) ? 'fine' : /^Features/.test(m) ? 'f1' : /^Tips/.test(m) ? 't1' : 'headline';
  const cur = (p[field] || '').trim(); if (!cur) return;
  toast('Asking Claude for a shorter version…');
  try {
    const target = Math.max(12, Math.round(cur.length * 0.7));
    const out = await claudeAsk({ system: BRAND_VOICE, max: 120, content: 'Shorten this social media text to at most ' + target + ' characters and keep its meaning' + (field === 'headline' && p.keyword ? ', keeping the words "' + p.keyword + '"' : '') + '. Sentence case. Reply with the new text only.\n\n' + cur });
    snap(); p[field] = cleanAI(out); markEdited(p); render(); withUndo('Shortened to: ' + p[field]);
  } catch (e) { toast(e.message); }
}
async function aiFilipino(p) {
  const keys = TEXT_KEYS.filter(k => (p[k] || '').trim()); if (!keys.length) { toast('This post has no words to translate yet.'); return; }
  toast('Translating with Claude…');
  try {
    const src = {}; keys.forEach(k => { src[k] = p[k]; });
    const out = await claudeAsk({ system: BRAND_VOICE + '\nYou translate into natural, everyday Filipino as brands in the Philippines use it. Taglish is fine where English sounds more natural. Keep product names, brand names, prices and hashtags unchanged.', max: 1500, content: 'Translate the values of this JSON object into Filipino. Keep the same keys. For "keyword", give the word or phrase as it appears in your translated headline. Reply with JSON only.\n\n' + JSON.stringify(src) });
    const mt = out.match(/\{[\s\S]*\}/); if (!mt) throw new Error('Claude did not send back a translation.');
    const tr = JSON.parse(mt[0]); snap();
    const q = Object.assign(clonePost(p), { id: nextId++, demo: false, group: null }); keys.forEach(k => { if (typeof tr[k] === 'string') q[k] = tr[k]; });
    /* a copy of a carousel slide goes after the whole carousel, as its own post */
    let at = state.posts.indexOf(p) + 1; if (p.group) while (at < state.posts.length && state.posts[at].group === p.group) at++;
    state.posts.splice(at, 0, q); state.sel = q.id; normalizeGroups(); render(); scheduleSave(); withUndo('Filipino copy added' + (p.group ? ' after the carousel' : ' after this post') + '. Have a native speaker check it.');
  } catch (e) { toast(e.message || 'Could not translate.'); }
}
