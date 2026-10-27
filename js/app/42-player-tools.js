// =============================================================================
// js/app/42-player-tools.js
// PLAYER TOOLS
// =============================================================================
//
// WHAT'S IN HERE
//   The version number (CG_VERSION), the unsaved-changes guard, the
//   Report-a-bug dialog, and the Display settings (theme and text size).
//
// KEY NAMES (so you can search for them)
//   tables/objects: CG_VERSION, BUG_REPORT_EMAIL, BUG_STORE_KEY
//   functions (35): _skMarkClean, _skLiveRanks, skillsDirty, _skDiscard,
//   pageDirty, anyDirty, promptUnsaved, resolveUnsaved, guardedNav, _bugLoad,
//   _bugStore, _bugContext, _bugCtxText, _bugText, _bugSubject, _bugMailto,
//   _bugClipboard, _bugOpenMail, _bugCurrent, _bugRecord, _bugStatus,
//   openBugReport, closeBugReport, bugSend, bugCopy, renderBugList, _bugFind,
//   bugView, bugResend, bugCopyStored, bugDelete, _renderDisplayMenu,
//   openDisplaySettings, closeDisplaySettings, setDisplayPref
//
// LOAD ORDER
//   File 42 of 68. index.html loads it after
//   js/app/41-state-storage-navigation.js and before
//   js/app/43-create-attributes-race-occupation.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 37422-37738 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 37422-37738; unchanged below this line ----
// ============================================================================
// v9.16.0 (§276) + v9.17.0 (§277): THE PLAYERS' FOUR — Adam's Rogue Trader
// table, 2026-10-15.
// (1) UNSAVED-CHANGES GUARD. Explicit Save stays the contract (no silent
//     autosave, by decision); what changes is that leaving a page with
//     unsaved work asks first. Skills: the ranks on screen (plus any already
//     mirrored into memory by _snapshotSkillInputsToChar) vs the baseline
//     taken when the page was entered or last saved. Create: any player
//     input/change on the form since it was cleared, loaded or saved. A
//     capture-phase listener on the nav intercepts the tab click before its
//     inline showPage() runs; beforeunload covers closing/refreshing.
// (2) BUG REPORTS — mailto/copy + a local "My reports" log (no backend).
// (3) DISPLAY — Parchment / Classic / High Contrast + text size (prefs
//     applied in <head>; theme tokens in the first <style> :root block).
// ============================================================================
const CG_VERSION = 'v9.19.0';
const BUG_REPORT_EMAIL = 'admin@epicsandepochs.com';  // Adam, 2026-10-15 (public in page source, by his choice)
var _createDirty = false;
var _skBaseline = null;           // {id, skills:{name:ranks}} — last saved/entered state
var _cgSuppressUnload = false;    // set briefly while a mailto: hands off to the mail app

function _skMarkClean() {
  const c = curId ? chars.find(x => x.id === curId) : null;
  _skBaseline = c ? { id: c.id, skills: Object.assign({}, c.skills || {}) } : null;
}
function _skLiveRanks(c) {
  const out = {};
  for (const sk of SKILLS) {
    const el = document.getElementById('skr-' + sk.n.replace(/[^a-z0-9]/gi, '_'));
    out[sk.n] = el ? (parseInt(el.value, 10) || 0) : ((c.skills || {})[sk.n] || 0);
  }
  return out;
}
function skillsDirty() {
  if (!_skBaseline || !curId || _skBaseline.id !== curId) return false;
  const c = chars.find(x => x.id === curId); if (!c) return false;
  const live = _skLiveRanks(c);
  return SKILLS.some(sk => (live[sk.n] || 0) !== (_skBaseline.skills[sk.n] || 0));
}
function _skDiscard() {
  const c = _skBaseline && chars.find(x => x.id === _skBaseline.id);
  if (c) c.skills = Object.assign({}, _skBaseline.skills);
  // Rebuild the (now inactive) rank inputs from the restored record —
  // getLiveSkillRanks reads the DOM, so stale edits must not linger there.
  try { renderSkills(); } catch (e) {}
  _skMarkClean();
}
function pageDirty(pageKey) {
  if (pageKey === 'skills') return skillsDirty();
  if (pageKey === 'create') return !!_createDirty;
  return false;
}
function anyDirty() { return skillsDirty() || !!_createDirty; }

let _unsavedResolve = null;
function promptUnsaved(pageKey) {
  const what = pageKey === 'skills' ? 'skill ranks on the Skills page' : 'changes on the Create form';
  document.getElementById('unsaved-modal-body').textContent =
    `You have unsaved ${what}. Save them before leaving, discard them, or stay on this page?`;
  document.getElementById('unsaved-modal').classList.add('open');
  document.getElementById('unsaved-save').focus();
  return new Promise(r => { _unsavedResolve = r; });
}
function resolveUnsaved(choice) {
  document.getElementById('unsaved-modal').classList.remove('open');
  const r = _unsavedResolve; _unsavedResolve = null;
  if (r) r(choice);
}
async function guardedNav(fromKey, target) {
  const choice = await promptUnsaved(fromKey);
  if (choice === 'stay') return false;
  if (choice === 'save') {
    if (fromKey === 'skills') saveSkills();
    else if (fromKey === 'create') {
      await saveCharacter();
      // saveCharacter clears the form on success; anything else (validation
      // toast, the first-save Six Scales recap) means the save isn't done.
      if (_createDirty) { toast('Not saved yet — finish saving on the Create page first.'); return false; }
    }
  } else if (choice === 'discard') {
    if (fromKey === 'skills') _skDiscard();
    else if (fromKey === 'create') clearForm();
  }
  showPage(target);
  return true;
}
(function wireUnsavedGuard() {
  const create = document.getElementById('page-create');
  if (create) {
    const mark = e => { if (e.isTrusted && !e.target.closest('#create-mini-nav')) _createDirty = true; };
    create.addEventListener('input', mark, true);
    create.addEventListener('change', mark, true);
    create.addEventListener('click', e => {
      if (e.isTrusted && e.target.closest('.btn') && !e.target.closest('#create-mini-nav')) _createDirty = true;
    }, true);
  }
  const nav = document.querySelector('nav.tabs');
  if (nav) nav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    const m = (btn.getAttribute('onclick') || '').match(/showPage\('([^']+)'\)/); if (!m) return;
    const fromKey = (document.querySelector('.page.active')?.id || '').replace(/^page-/, '');
    if (!pageDirty(fromKey)) return;
    e.preventDefault(); e.stopPropagation();
    guardedNav(fromKey, m[1]);
  }, true);
  window.addEventListener('beforeunload', e => {
    if (_cgSuppressUnload || !anyDirty()) return;
    e.preventDefault(); e.returnValue = '';
    return '';
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('unsaved-modal')?.classList.contains('open')) resolveUnsaved('stay');
    else if (document.getElementById('bug-modal')?.classList.contains('open')) closeBugReport();
    else if (document.getElementById('display-modal')?.classList.contains('open')) closeDisplaySettings();
  });
})();

// ---------- (2) bug reports ----------
const BUG_STORE_KEY = 'dxd20v2_bugreports';
function _bugLoad() { try { const a = JSON.parse(localStorage.getItem(BUG_STORE_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function _bugStore(list) {
  try { localStorage.setItem(BUG_STORE_KEY, JSON.stringify(list.slice(-50))); return true; }
  catch (e) {
    // Quota: keep the reports, drop the bulky character attachments.
    try { localStorage.setItem(BUG_STORE_KEY, JSON.stringify(list.slice(-50).map(r => Object.assign({}, r, { charJson: r.charJson ? '[omitted — storage full]' : '' })))); return true; } catch (e2) { return false; }
  }
}
function _bugContext() {
  const c = curId ? chars.find(x => x.id === curId) : null;
  const pageKey = (document.querySelector('.page.active')?.id || '').replace(/^page-/, '');
  const tab = (document.querySelector('.tab-btn.active')?.textContent || '').trim();
  const theme = document.documentElement.getAttribute('data-theme') || 'parchment';
  const textsize = document.documentElement.getAttribute('data-textsize') || 'md';
  return {
    version: CG_VERSION,
    page: pageKey + (tab ? ` (${tab})` : ''),
    hero: c ? `${c.name}${c.totalLvl ? ' · level ' + c.totalLvl : ''}` : '(none selected)',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    display: `${theme} theme, text ${textsize}`,
    errors: (window._cgErrRing || []).slice(),
  };
}
function _bugCtxText(ctx) {
  return [
    `CG version: ${ctx.version}`,
    `Page: ${ctx.page}`,
    `Hero: ${ctx.hero}`,
    `When: ${ctx.timestamp}`,
    `Browser: ${ctx.userAgent}`,
    `Screen: ${ctx.viewport} · ${ctx.display}`,
    `Recent errors: ${ctx.errors.length ? '\n  ' + ctx.errors.join('\n  ') : 'none captured'}`,
  ].join('\n');
}
function _bugText(r, withJson) {
  let t = `WHAT HAPPENED\n${r.what || '(no description)'}\n\nCONTEXT\n${_bugCtxText(r.ctx)}`;
  if (withJson && r.charJson) t += `\n\nCHARACTER JSON\n${r.charJson}`;
  return t;
}
function _bugSubject(r) {
  const first = (r.what || '').split('\n')[0].slice(0, 60);
  return `[E&E CG ${r.ctx.version}] Bug report${first ? ': ' + first : ''}`;
}
// mailto: bodies are capped by mail clients (~2k chars is the safe floor) —
// a long report rides the clipboard and the mail body says so.
function _bugMailto(r) {
  const full = _bugText(r, true);
  let body = full, clipped = false;
  if (encodeURIComponent(full).length > 1800) {
    clipped = true;
    body = _bugText(r, false);
    if (encodeURIComponent(body).length > 1600) body = body.slice(0, 900) + '\n…';
    body += '\n\n[The full report' + (r.charJson ? ' incl. character JSON' : '') + ' was copied to my clipboard — pasting it below.]\n';
  }
  return { href: `mailto:${BUG_REPORT_EMAIL}?subject=${encodeURIComponent(_bugSubject(r))}&body=${encodeURIComponent(body)}`, full, clipped };
}
async function _bugClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
function _bugOpenMail(href) {
  _cgSuppressUnload = true;
  const a = document.createElement('a'); a.href = href; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { _cgSuppressUnload = false; }, 1500);
  window._lastBugMailto = href;  // probe hook
}
function _bugCurrent() {
  const what = document.getElementById('bug-what').value.trim();
  const ctx = _bugContext();
  let charJson = '';
  if (document.getElementById('bug-attach').checked) {
    const c = curId ? chars.find(x => x.id === curId) : null;
    if (c) { try { charJson = JSON.stringify(c); } catch (e) { charJson = '[could not serialize]'; } }
  }
  return { id: 'bug-' + Date.now().toString(36), what, ctx, charJson, sent: [] };
}
function _bugRecord(r, how) {
  const list = _bugLoad();
  const i = list.findIndex(x => x.id === r.id);
  r.sent = (r.sent || []).concat([{ how, at: new Date().toISOString() }]);
  if (i >= 0) list[i] = r; else list.push(r);
  _bugStore(list);
  renderBugList();
}
function _bugStatus(msg) { const s = document.getElementById('bug-status'); if (s) s.textContent = msg; }
function openBugReport() {
  document.getElementById('bug-email').textContent = BUG_REPORT_EMAIL;
  document.getElementById('bug-ctx').textContent = _bugCtxText(_bugContext());
  document.getElementById('bug-attach').disabled = !curId;
  _bugStatus('');
  document.getElementById('bug-view').style.display = 'none';
  renderBugList();
  document.getElementById('bug-modal').classList.add('open');
  document.getElementById('bug-what').focus();
}
function closeBugReport() { document.getElementById('bug-modal').classList.remove('open'); }
async function bugSend() {
  const r = _bugCurrent();
  if (!r.what) { _bugStatus('Please describe what happened first.'); document.getElementById('bug-what').focus(); return; }
  const m = _bugMailto(r);
  let copied = false;
  if (m.clipped) copied = await _bugClipboard(m.full);
  _bugRecord(r, 'email');
  _bugOpenMail(m.href);
  document.getElementById('bug-what').value = '';
  document.getElementById('bug-attach').checked = false;
  _bugStatus(m.clipped
    ? (copied ? 'Your mail app should open. The report is long, so the full text is on your clipboard: paste it into the email.'
              : 'Your mail app should open. The report is long; use Copy in My reports below to grab the full text.')
    : 'Your mail app should open with the report filled in. It is also saved under My reports.');
}
async function bugCopy() {
  const r = _bugCurrent();
  if (!r.what) { _bugStatus('Please describe what happened first.'); document.getElementById('bug-what').focus(); return; }
  const ok = await _bugClipboard(`To: ${BUG_REPORT_EMAIL}\nSubject: ${_bugSubject(r)}\n\n` + _bugText(r, true));
  _bugRecord(r, 'copy');
  _bugStatus(ok ? `Copied. Paste it into an email to ${BUG_REPORT_EMAIL} (or a message to your GM). Also saved under My reports.`
                : 'Copy was blocked by the browser. The report is saved under My reports: click View and copy the text by hand.');
}
function renderBugList() {
  const el = document.getElementById('bug-list'); if (!el) return;
  const list = _bugLoad().slice().reverse();
  if (!list.length) { el.innerHTML = '<div style="color:var(--gold-mute);">No reports yet. Reports you send or copy are kept here on this device.</div>'; return; }
  el.innerHTML = list.map(r => {
    const when = (r.ctx && r.ctx.timestamp || '').replace('T', ' ').slice(0, 16);
    const last = (r.sent || []).slice(-1)[0];
    return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid rgba(200,151,30,.15);">
      <span style="color:var(--gold-soft);white-space:nowrap;">${escapeHTML(when)}</span>
      <span style="flex:1;min-width:140px;color:var(--parch);">${escapeHTML((r.what || '').split('\n')[0].slice(0, 70) || '(no description)')}</span>
      <span style="color:var(--gold-mute);font-size:11px;">${last ? escapeHTML(last.how === 'email' ? 'sent' : 'copied') : ''}${r.charJson ? ' · +JSON' : ''}</span>
      <button type="button" class="btn btn-sm" onclick="bugView('${r.id}')">View</button>
      <button type="button" class="btn btn-sm" onclick="bugResend('${r.id}')">Resend</button>
      <button type="button" class="btn btn-sm" onclick="bugCopyStored('${r.id}')">Copy</button>
      <button type="button" class="btn btn-sm btn-danger" onclick="bugDelete('${r.id}')" aria-label="Delete this report">✕</button>
    </div>`;
  }).join('');
}
function _bugFind(id) { return _bugLoad().find(r => r.id === id); }
function bugView(id) {
  const r = _bugFind(id); if (!r) return;
  const v = document.getElementById('bug-view');
  v.textContent = _bugText(r, true); v.style.display = 'block';
}
async function bugResend(id) {
  const r = _bugFind(id); if (!r) return;
  const m = _bugMailto(r);
  if (m.clipped) await _bugClipboard(m.full);
  _bugRecord(r, 'email');
  _bugOpenMail(m.href);
  _bugStatus(m.clipped ? 'Mail app opening; the full report is on your clipboard to paste.' : 'Mail app opening with the report filled in.');
}
async function bugCopyStored(id) {
  const r = _bugFind(id); if (!r) return;
  const ok = await _bugClipboard(`To: ${BUG_REPORT_EMAIL}\nSubject: ${_bugSubject(r)}\n\n` + _bugText(r, true));
  _bugStatus(ok ? 'Copied to the clipboard.' : 'Copy was blocked; use View and copy by hand.');
}
async function bugDelete(id) {
  if (!(await confirmModal('Delete this saved report from this device?', { okLabel: 'Delete', cancelLabel: 'Keep' }))) return;
  _bugStore(_bugLoad().filter(r => r.id !== id));
  document.getElementById('bug-view').style.display = 'none';
  renderBugList();
}

// ---------- (3) display settings ----------
function _renderDisplayMenu() {
  const s = window.applyDisplayPrefs();
  const sz = s.textsize;
  document.querySelectorAll('input[name="disp-theme"]').forEach(i => { i.checked = i.value === s.theme; });
  document.querySelectorAll('input[name="disp-size"]').forEach(i => { i.checked = i.value === sz; });
  const note = document.getElementById('disp-theme-note');
  if (note) note.textContent = s.explicit
    ? 'Your choice is saved in this browser and overrides your device\'s contrast setting.'
    : (s.theme === 'hc' ? 'High Contrast is on because your device asks for more contrast. Pick a theme to override it.'
                        : 'Default. High Contrast turns on by itself if your device asks for more contrast, unless you pick a theme here.');
}
function openDisplaySettings() {
  _renderDisplayMenu();
  document.getElementById('display-modal').classList.add('open');
  document.querySelector('input[name="disp-theme"]:checked')?.focus();
}
function closeDisplaySettings() { document.getElementById('display-modal').classList.remove('open'); }
function setDisplayPref(key, val) {
  const p = window.readDisplayPrefs(); p[key] = val;
  try { localStorage.setItem('dxd20v2_display', JSON.stringify(p)); } catch (e) {}
  const s = window.applyDisplayPrefs();
  if (document.getElementById('display-modal')?.classList.contains('open')) _renderDisplayMenu();
  if (key === 'theme') toast(s.theme === 'hc' ? 'High Contrast theme.' : s.theme === 'classic' ? 'Classic theme (original colours).' : 'Parchment theme.');
}

