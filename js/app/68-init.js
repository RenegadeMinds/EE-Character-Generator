// =============================================================================
// js/app/68-init.js
// INIT
// =============================================================================
//
// WHAT'S IN HERE
//   Start-up. Runs LAST, once every other file has loaded: fills the
//   dropdowns, applies the default scenario, draws the roster, and wires
//   keyboard handlers. If you add a new file, it must load before this one.
//
// LOAD ORDER
//   File 68 of 68. index.html loads it after js/app/67-pdf-export.js and
//   before (nothing; this is the last file).
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 55309-55347 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 55309-55347; unchanged below this line ----
// ========== INIT ==========
populateRaceDropdown();
renderSixLevelsGrid();
initCreateAccordion();  // v8.5.4 ergo C2
applyScenarioPreset(); // applies the default-selected 'The Ordinary World' preset
if (typeof hbGearSync === 'function') hbGearSync();  // v9.12.0 (§269): the Armory joins the catalogs before first render
renderAttrGrid();updateRaceInfo();renderClassList();updateClassPreview();renderRoster();
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
