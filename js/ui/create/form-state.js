// =============================================================================
// js/ui/create/form-state.js
// CREATE / FORM STATE — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Create page: the working state of the form (budget,
//   HP mode and rolls, attribute bumps, Six Scales edits).
//
// KEY NAMES (so you can search for them)
//   tables and state: formBudget, editSavedSixLevels, pendingSixLevelChange,
//   formHpMode, formHpRolls, formAttrBumps
//
// WHERE IT CAME FROM
//   Gathered from js/app/41-state-storage-navigation.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== ATTRIBUTE BUDGET TRACKING (v8.1.1) ==========
// formBudget holds the player's chosen attribute-generation budget for the
// character being created/edited. baseTotal is the sum of base (pre-racial)
// scores produced by the chosen method (always 80 for Quickdraw, 80 for
// 20-point buy [60 base + 20 spent], and variable for 4d6 roll).
//   method:  'quickdraw' | 'pointbuy' | 'roll' | 'manual' | null
//   baseTotal: integer (the target/budget to compare against)
//   racialApplied: race name whose adj is currently baked into the displayed scores
let formBudget = { method: null, baseTotal: null, racialApplied: '' };

// ========== SIX SCALES EDIT-STATE TRACKING (v8.2.1) ==========
// When the create/edit form is opened to edit an EXISTING saved character,
// editSavedSixLevels snapshots the saved Six Scales values so onSixLevelChange()
// can detect actual divergence. pendingSixLevelChange holds the axis + old/new
// values for the confirm/cancel handlers to act on.
//
// During NEW character creation (editId === null), Six Scales changes are
// routine and don't fire the confirmation modal — the player is still
// establishing their character's scenario context.
let editSavedSixLevels = null;
let pendingSixLevelChange = null; // {axis, oldVal, newVal, sliderEl}

// ========== HP MODE FORM STATE (v8.2.3 Issue A) ==========
// formHpMode tracks the HP-generation mode chosen on the create form.
// formHpRolls is the working per-level rolls array. Both are committed to
// the character record on save.
//
// Default mode is 'hero' (Hero's Hit Die — house convention per HH p.84-ish
// and the parentheticals in every class entry).
let formHpMode = 'hero';
let formHpRolls = [];

// ========== ATTRIBUTE BUMPS FORM STATE (v8.2.3 Issue B) ==========
// HH p.879: at every 4th character level, +1 to one attribute of player's
// choice. formAttrBumps stores the working list. Each entry is the attribute
// name ('STR', 'DEX', etc.) for the bump at level (idx+1)*4. Empty string
// means "not yet assigned".
//
// Bumps are kept separate from c.attrs and applied at display time so the
// attribute-generation budget tracker (4d6 / point buy / quickdraw) stays
// clean — the bumps don't count toward the budget.
let formAttrBumps = [];
