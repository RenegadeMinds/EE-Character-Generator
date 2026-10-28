// =============================================================================
// js/ui/player-tools/unsaved-guard.js
// PLAYER TOOLS / UNSAVED GUARD — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Asking before leaving a page with unsaved changes.
//
// KEY NAMES (so you can search for them)
//   tables and state: _createDirty, _skBaseline, _cgSuppressUnload,
//   _unsavedResolve
//   functions (9): _skMarkClean, _skLiveRanks, skillsDirty, _skDiscard,
//   pageDirty, anyDirty, promptUnsaved, resolveUnsaved, guardedNav
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

var _createDirty = false;
var _skBaseline = null;           // {id, skills:{name:ranks}} — last saved/entered state
var _cgSuppressUnload = false;    // set briefly while a mailto: hands off to the mail app

function _skMarkClean() {
  const c = curId ? currentChar() : null;
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
  const c = currentChar(); if (!c) return false;
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
