// =============================================================================
// js/main.js
// START-UP: THE ONLY CODE THAT RUNS WHILE THE PAGE LOADS
// =============================================================================
//
// WHAT'S IN HERE
//   Everything the app does on its own when the page opens, in the order it
//   has always happened. Section 1 restores the saved data (scenarios,
//   homebrew, monstrous classes, the roster) and wires page behaviour;
//   section 2 draws the first screen. Every other js/ file only declares
//   functions, tables and state.
//
// LOAD ORDER
//   Must be the LAST script in index.html: it calls functions from every
//   other file. Anything new that should happen automatically when the page
//   opens belongs here, not at the top level of another file.
//
// WHERE IT CAME FROM
//   Section 1 gathers the start-up statements that used to sit between
//   declarations in js/app/41-state-storage-navigation.js, js/app/42-player-
//   tools.js, js/app/44-create-scenario-gate-and-layout.js, js/rules/05-six-
//   scales-and-scenarios.js, js/rules/06-homebrew-forge-armory-monstrous.js,
//   js/rules/10-minds-ledger-and-magic-browser.js. Section 2 is the old
//   js/app/68-init.js. All moved unchanged and in their original order.
// =============================================================================


// ---------------------------------------------------------------------------
// 1. RESTORE SAVED DATA AND PREPARE THE PAGE
// ---------------------------------------------------------------------------
try { customScenarios = JSON.parse(localStorage.getItem('dxd20v2_scenarios') || '[]'); } catch (e) { customScenarios = []; }
try { populateScenarioSelects(); } catch (e) {}
// v8.55.1 (Adam's report — the nav banner bisected the Forge): these modals
// are authored inside div.app-body, whose position:relative + z-index:1
// creates a stacking context CAPPED at z:1 — no inner z-index can ever paint
// above the body-level sticky nav (z:100). Reparent them to <body> at
// startup so their fixed overlays genuinely cover the page, nav included.
try {
  for (const _mid of ['qd-modal', 'scen-modal', 'hb-modal']) {
    const _mel = document.getElementById(_mid);
    if (_mel && _mel.parentElement !== document.body) document.body.appendChild(_mel);
  }
} catch (e) {}
// ==== end v8.54.0 scenario block ====

try { homebrewFeats = JSON.parse(localStorage.getItem('dxd20v2_homebrew') || '[]'); } catch (e) { homebrewFeats = []; }
try { homebrewGear = JSON.parse(localStorage.getItem('dxd20v2_homebrew_gear') || '[]'); } catch (e) { homebrewGear = []; }
try { monstrousStore = JSON.parse(localStorage.getItem('dxd20v2_monstrous') || '{"classes":{},"races":{}}'); } catch (e) { monstrousStore = { classes: {}, races: {} }; }
monstrousBoot();
// Restore remembered states once the DOM exists (script runs at end of body).
try {
  for (const pg of ['gear', 'powers', 'tracker']) {
    if (localStorage.getItem('dxd20v2_ui_' + pg + 'TutOpen') === '1') {
      const b = document.getElementById(pg + '-tut-body'), ch = document.getElementById(pg + '-tut-chev');
      if (b) b.style.display = 'block';
      if (ch) ch.textContent = '▾';
    }
  }
} catch (e) {}
// Prong (a): one polite, silent request to shield the vault from automatic
// eviction. Browsers that don't support it ignore it; no UI either way.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
try { chars = JSON.parse(storeGet('dxd20v2_chars') || '[]'); } catch (e) { chars = []; }
if (!Array.isArray(chars)) chars = [];
chars.forEach(migrateTs13Vehicles);
storageBannerCheck();
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

// v8.3.26: enter inline edit mode. Hides the display span and the ✎/↻
// buttons; shows the input (pre-filled with current title) and ✓/✕ buttons.
// Snapshots the pre-edit override so Cancel can restore it cleanly even if
// blur-commits fires first (mousedown-on-Cancel races the blur).
// Snapshot the current override state so Cancel can restore it. Stored on
// `window` so the inline mousedown handler on the Cancel button can set the
// flag synchronously before the input's blur event fires.
window._scenarioTitlePreEditOverride = null;
window._scenarioTitleCancelling = false;

// ---------------------------------------------------------------------------
// 2. FIRST RENDER (formerly js/app/68-init.js)
// ---------------------------------------------------------------------------
// ========== INIT ==========
populateRaceDropdown();
renderSixLevelsGrid();
initCreateAccordion();  // v8.5.4 ergo C2
applyScenarioPreset(); // applies the default-selected 'The Ordinary World' preset
hbGearSync();  // v9.12.0 (§269): the Armory joins the catalogs before first render
renderAttrGrid();
updateRaceInfo();
renderClassList();
updateClassPreview();
renderRoster();
// v8.3.17: paint the initial gate state. Default is 'awaiting' for a fresh page;
// editCurrentChar() sets 'locked' before showing the form.
applyGateState();
// v8.3.20: populate the conditions "More…" dropdown from CONDITIONS_DATA.
populateConditionDropdown();
// v8.3.21: hide gated tabs at init since no character is yet selected.
renderNavTabs(null);
// v8.3.26: wire keyboard + blur handlers onto the inline Scenario Title input.
// Enter commits (Save); Escape cancels (revert). Blur commits — least
// surprising behavior, since the player has already typed something and
// clicking elsewhere shouldn't silently throw away their work.
(function attachScenarioTitleHandlers(){
  const inputEl = document.getElementById('scenario-title-input');
  if (!inputEl) return;
  inputEl.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter') {
      ev.preventDefault();
      onScenarioTitleSaveEdit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      onScenarioTitleCancelEdit();
    }
  });
  inputEl.addEventListener('blur', function(){
    // Only commit on blur if edit mode is still active (the input is visible).
    // Save/Cancel buttons already call _exitScenarioTitleEditMode which
    // changes display, so this guards against double-commits.
    if (inputEl.style.display !== 'none') {
      onScenarioTitleSaveEdit();
    }
  });
})();
