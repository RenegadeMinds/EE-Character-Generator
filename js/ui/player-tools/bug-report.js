// =============================================================================
// js/ui/player-tools/bug-report.js
// PLAYER TOOLS / BUG REPORT — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The 🐞 Report dialog and the local list of sent
//   reports.
//
// KEY NAMES (so you can search for them)
//   tables and state: BUG_REPORT_EMAIL, BUG_STORE_KEY
//   functions (22): _bugLoad, _bugStore, _bugContext, _bugCtxText, _bugText,
//   _bugSubject, _bugMailto, _bugClipboard, _bugOpenMail, _bugCurrent,
//   _bugRecord, _bugStatus, openBugReport, closeBugReport, bugSend, bugCopy,
//   renderBugList, _bugFind, bugView, bugResend, bugCopyStored, bugDelete
//
// WHERE IT CAME FROM
//   Gathered from js/app/42-player-tools.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

const BUG_REPORT_EMAIL = 'admin@epicsandepochs.com';  // Adam, 2026-10-15 (public in page source, by his choice)

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
  if (!list.length) { el.innerHTML = '<div class="c-gold-mute">No reports yet. Reports you send or copy are kept here on this device.</div>'; return; }
  el.innerHTML = list.map(r => {
    const when = (r.ctx && r.ctx.timestamp || '').replace('T', ' ').slice(0, 16);
    const last = (r.sent || []).slice(-1)[0];
    return `<div class="gap-8 items-center flex-wrap p-6-0" style="display:flex;border-bottom:1px solid rgb(var(--line-gold) / .15);">
      <span class="c-gold-soft nowrap">${escapeHTML(when)}</span>
      <span class="flex-1 c-parch" style="min-width:140px;">${escapeHTML((r.what || '').split('\n')[0].slice(0, 70) || '(no description)')}</span>
      <span class="c-gold-mute fs-11">${last ? escapeHTML(last.how === 'email' ? 'sent' : 'copied') : ''}${r.charJson ? ' · +JSON' : ''}</span>
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
