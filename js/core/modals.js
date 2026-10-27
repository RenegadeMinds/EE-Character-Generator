// =============================================================================
// js/core/modals.js
// MODALS — APP CORE
// =============================================================================
//
// WHAT'S IN HERE
//   App plumbing shared by every page. The shared confirm, choice and text
//   dialogs that replace the browser's own pop-ups.
//
// KEY NAMES (so you can search for them)
//   tables and state: _textModalResolve, _confirmModalResolve,
//   _choiceModalCb, _choiceModalAllOptions, _choiceModalFreeText
//   functions (10): textModal, resolveTextModal, confirmModal,
//   resolveConfirmModal, openChoiceModal, renderChoiceModalOptions,
//   filterChoiceModal, confirmChoiceModal, cancelChoiceModal,
//   closeChoiceModal
//
// WHERE IT CAME FROM
//   Gathered from js/app/63-modals.js, js/rules/16-worn-and-active-gear.js
//   when the code was regrouped by topic and page. Each function and table
//   moved whole and unchanged, with the comments above it, including the
//   original version notes.
//
// LOAD ORDER
//   Loaded first. Declarations only: nothing here runs while the page loads
//   (the saved roster is restored by js/main.js).
// =============================================================================

// v8.7.0: text-input modal — Promise<string|null> (null = cancelled).
let _textModalResolve = null;
function textModal(title, hint, initial) {
  return new Promise((resolve) => {
    _textModalResolve = resolve;
    document.getElementById('text-modal-title').textContent = title;
    document.getElementById('text-modal-hint').textContent = hint || '';
    const inp = document.getElementById('text-modal-input');
    inp.value = initial || '';
    document.getElementById('text-modal').classList.add('open');
    inp.focus(); inp.select();
  });
}
function resolveTextModal(ok) {
  const r = _textModalResolve; _textModalResolve = null;
  const v = document.getElementById('text-modal-input').value;
  document.getElementById('text-modal').classList.remove('open');
  if (r) r(ok ? v : null);
}
// ============================================================================
// v8.5.2: Generic confirm modal — replaces window.confirm() (see the
// "CONFIRM MODAL" HTML comment for why). confirmModal(message, opts) returns
// a Promise<boolean>; callers become `if (!(await confirmModal(...))) return;`.
// ============================================================================
let _confirmModalResolve = null;

function confirmModal(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    _confirmModalResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = opts.title || 'Confirm';
    document.getElementById('confirm-modal-body').textContent = message;
    document.getElementById('confirm-modal-ok').textContent = opts.okLabel || 'Yes';
    document.getElementById('confirm-modal-cancel').textContent = opts.cancelLabel || 'No';
    document.getElementById('confirm-modal').classList.add('open');
    document.getElementById('confirm-modal-ok').focus();
  });
}

function resolveConfirmModal(value) {
  document.getElementById('confirm-modal').classList.remove('open');
  const r = _confirmModalResolve;
  _confirmModalResolve = null;
  if (r) r(value);
}

// ============================================================================
// v8.5.2: Generic choice modal — replaces window.prompt() as the parameter-
// selection UI for feats/talents (see the "CHOICE MODAL" comment on its HTML
// block for why). openChoiceModal(title, options, callback) is the only
// entry point callers need; cancelling never calls back (matches prompt()'s
// null-on-Cancel contract). Empty options[] switches to free-text mode.
// ============================================================================
let _choiceModalCb = null;
let _choiceModalAllOptions = [];
let _choiceModalFreeText = false;

function openChoiceModal(title, options, callback) {
  _choiceModalCb = callback;
  _choiceModalAllOptions = options || [];
  _choiceModalFreeText = _choiceModalAllOptions.length === 0;
  document.getElementById('choice-modal-title').textContent = title;
  const input = document.getElementById('choice-modal-input');
  const sel = document.getElementById('choice-modal-select');
  input.value = '';
  input.placeholder = _choiceModalFreeText ? 'Type a value…' : 'Type to filter…';
  sel.style.display = _choiceModalFreeText ? 'none' : '';
  renderChoiceModalOptions('');
  document.getElementById('choice-modal').classList.add('open');
  input.focus();
}

function renderChoiceModalOptions(filterText) {
  const sel = document.getElementById('choice-modal-select');
  const f = (filterText || '').toLowerCase();
  const filtered = f ? _choiceModalAllOptions.filter(o => o.toLowerCase().includes(f)) : _choiceModalAllOptions;
  sel.innerHTML = filtered.map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');
  if (filtered.length === 1) sel.value = filtered[0]; // sole match pre-selected, Enter confirms it
}

function filterChoiceModal() {
  if (_choiceModalFreeText) return;
  renderChoiceModalOptions(document.getElementById('choice-modal-input').value);
}

function confirmChoiceModal() {
  const cb = _choiceModalCb;
  let value;
  if (_choiceModalFreeText) {
    value = document.getElementById('choice-modal-input').value.trim();
  } else {
    const sel = document.getElementById('choice-modal-select');
    value = sel.value || (sel.options.length === 1 ? sel.options[0].value : '');
  }
  closeChoiceModal();
  if (value && cb) cb(value);
}

function cancelChoiceModal() { closeChoiceModal(); }

function closeChoiceModal() {
  document.getElementById('choice-modal').classList.remove('open');
  _choiceModalCb = null;
}
