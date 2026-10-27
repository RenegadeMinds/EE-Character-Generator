// =============================================================================
// js/app/47-save-character.js
// SAVE CHARACTER
// =============================================================================
//
// WHAT'S IN HERE
//   Saving a character: legacy-record migration, schema versioning, typed
//   1st-level feat slots, the Hero's Gift checks, and saveCharacter itself.
//
// KEY NAMES (so you can search for them)
//   tables/objects: CURRENT_SCHEMA_VER, FIRST_LEVEL_SLOT_KINDS,
//   HERITAGE_ELIGIBLE_KINDS, SLOT_PREFERENCE_ORDER
//   functions (12): migrateLegacyClasses, isLegacyCharacter,
//   deriveFirstLevelSlots, slotAcceptsFeat, tryFillFirstLevelSlot,
//   clearFirstLevelSlotForFeat, scanHerosGiftRetconCompliance, saveCharacter,
//   cloneCurrentChar, editCurrentChar, deleteCurrentChar, clearForm
//
// LOAD ORDER
//   File 47 of 68. index.html loads it after
//   js/app/46-create-preview-and-defense.js and before
//   js/app/48-roster-and-export.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 40185-41270 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 40185-41270; unchanged below this line ----
// ========== SAVE CHARACTER ==========
// Migrate a legacy v3/v4/v5 character record (with heroClass/basicClass/advClass/presClass slots)
// into the new array model. Returns the {classes:[…]} array; non-destructive.
function migrateLegacyClasses(c){
  if(Array.isArray(c.classes) && c.classes.length>0)return c.classes;
  const arr=[];
  if(c.heroClass && (c.heroLvl||0)>0) arr.push({tier:'hero',name:c.heroClass,level:c.heroLvl,first:true});
  if(c.basicClass && (c.basicLvl||0)>0) arr.push({tier:'basic',name:c.basicClass,level:c.basicLvl,first:!arr.length});
  if(c.advClass && (c.advLvl||0)>0) arr.push({tier:'advanced',name:c.advClass,level:c.advLvl,first:!arr.length});
  if(c.presClass && (c.presLvl||0)>0) arr.push({tier:'prestige',name:c.presClass,level:c.presLvl,first:!arr.length});
  return arr;
}

// ===== v8.4.0: CHARACTER SCHEMA VERSIONING =====
//
// v8.4.0 introduces a structured 1st-level genesis flow with typed feat
// slots and an explicit Hero's Gift choice. To preserve the in-the-wild
// characters built under v8.3.x without retrofitting them, every new save
// from v8.4.0 onward stamps `c.schemaVer = 1`. The absence of this field
// marks a legacy (pre-v8.4.0) character.
//
// The legacy/v8.4.0 split affects exactly three subsystems:
//   1. getFeatBudget — legacy auto-adds +1 Hero's Gift to feats for any
//      Hero-classed character; v8.4.0 only adds it when c.heroesGiftChoice
//      === 'feat'.
//   2. getTalentBudget — legacy adds 0 for Hero's Gift; v8.4.0 adds +1
//      when c.heroesGiftChoice === 'talent'.
//   3. The Sheet's Hero's Gift panel and the Edit retcon dropdown — both
//      hide entirely for legacy characters.
//
// Everything else (feat slots, talent slots, prereqs, AP, the Six Scales
// gates, etc.) is identical across both schema versions.
const CURRENT_SCHEMA_VER = 1;

function isLegacyCharacter(c) {
  return !c || (c.schemaVer || 0) < CURRENT_SCHEMA_VER;
}

// v8.4.0: 1st-level typed-slot kinds. See §5 of the v8.4.0 plan for the
// full design. Each kind has its eligibility rules and ordering preference;
// the slot-picker prefers more-restricted-first so that loose slots stay
// open for things only they can hold.
//   • base       — universal L1 feat, accepts any general feat
//   • heritage   — L1 Heritage slot, can hold Heritage feats or any general
//   • human      — Human racial bonus slot, can hold Heritage or any general
//   • occupation — restricted to the occupation's bonus_feat_options list
//   • herosGift  — exists when c.heroesGiftChoice === 'feat'; Heritage-eligible
//
// Heritage-eligible slot kinds (those that can hold a Heritage feat) are:
// base, heritage, human, herosGift. The occupation slot is NOT
// Heritage-eligible because its option list is hard-restricted.
const FIRST_LEVEL_SLOT_KINDS = ['base', 'heritage', 'human', 'occupation', 'herosGift'];
const HERITAGE_ELIGIBLE_KINDS = new Set(['base', 'heritage', 'human', 'herosGift']);

// Picking-order preference: more-restricted-first. When a feat could fill
// multiple slots, we fill the most-constrained slot first, preserving the
// looser slots for picks that may need them.
const SLOT_PREFERENCE_ORDER = ['occupation', 'herosGift', 'human', 'heritage', 'base'];

// v8.2.1: First-save Six Scales gate. When creating a NEW character (editId
// is null), saveCharacter() will pause to show a recap modal listing all six
// scenario axes with their tier descriptors. The player confirms the scenario
// is correct, then the save proceeds. This is a one-time-per-character moment
// — once saved, subsequent Six Scales changes go through the heavier
// "Scenario Rules Change" modal.
//
// On edit (editId set), this gate is skipped; the post-creation modal already
// handles scenario changes.
let _firstSaveConfirmed = false; // Set to true by confirmFirstSaveSixLevels() to bypass the gate on the second call.

// v8.4.0: derive the typed 1st-level feat slots for a freshly-created
// character. Called from saveCharacter for new (non-Edit) saves to populate
// c.firstLevelSlots. Returns an array of slot records:
//   {kind, filled: null, filledParam: null, ...(kind-specific fields)}
//
// The slot record is the *authoritative* source of truth for "where did
// this L1 feat come from." Existing code reads c.feats with origin tags;
// v8.4.0 layers slot records on top so the player's L1 picks can be
// reconciled, displayed by source, and edited cleanly.
//
// Slot kinds and trigger rules (per plan §5):
//   • base       — always (one universal L1 feat)
//   • heritage   — always (one L1 Heritage slot)
//   • human      — iff race === 'Human'
//   • occupation — one per occupation with bonus_feat_options
//   • herosGift  — iff any class is tier:'hero' AND heroesGiftChoice === 'feat'
//
// At save time the herosGift slot is NOT yet populated (heroesGiftChoice
// starts as null on a new Hero-classed character — the player makes the
// choice on the Sheet). So this function emits only the base/heritage/
// human/occupation slots at first save; the herosGift slot is added later
// when the player commits to 'feat' on the Sheet.
function deriveFirstLevelSlots({race, classes, occupations, hybrid}) {
  const slots = [];
  slots.push({kind:'base', filled:null, filledParam:null});
  slots.push({kind:'heritage', filled:null, filledParam:null});
  // v8.70.1: Human-PARENTED Hybrids inherit the Human bonus slot ("all
  // racial abilities of both parents").
  if (race === 'Human' || (race === 'Hybrid' && hybrid && (hybrid.a === 'Human' || hybrid.b === 'Human'))) {
    slots.push({kind:'human', filled:null, filledParam:null});
  }
  // One occupation slot per occupation that has bonus_feat_options.
  for (const occName of (occupations || [])) {
    if (!occName) continue;
    const occData = (typeof getOccupationData === 'function') ? getOccupationData(occName) : null;
    if (occData && occData.bonus_feat_options && occData.bonus_feat_options.length) {
      slots.push({
        kind:'occupation',
        filled:null,
        filledParam:null,
        occupation: occName,
        options: occData.bonus_feat_options.slice(),
      });
    }
  }
  // herosGift slot is added later when the player assigns Hero's Gift to
  // 'feat' on the Sheet — not at first save.
  return slots;
}

// v8.4.0: predicate — can a feat fill a slot of the given kind?
//
// Rules (per plan §5):
//   • An occupation slot accepts ONLY feats on its `options` list.
//   • A Heritage feat (family === 'Heritage') accepts any Heritage-eligible
//     slot kind: base, heritage, human, herosGift.
//   • A general (non-Heritage) feat accepts any non-occupation slot kind:
//     base, heritage, human, herosGift. (It can fill the heritage slot if
//     no Heritage feat needs it — Heritage slots are not Heritage-feat-ONLY.)
//
// The picker downstream prefers more-restricted-first via
// SLOT_PREFERENCE_ORDER so loose slots stay open for picks that need them.
function slotAcceptsFeat(slot, featName) {
  if (!slot || slot.filled !== null) return false;  // already filled
  const data = (typeof getFeatData === 'function') ? getFeatData(featName) : null;
  const isHeritage = data && data.family === 'Heritage';
  if (slot.kind === 'occupation') {
    // Occupation slots are hard-restricted to their options list.
    return Array.isArray(slot.options) && slot.options.includes(featName);
  }
  if (HERITAGE_ELIGIBLE_KINDS.has(slot.kind)) {
    if (isHeritage) return true;  // Heritage feats fill any Heritage-eligible slot
    // General feats can also fill Heritage-eligible slots — these slots are
    // not Heritage-ONLY, they're Heritage-ELIGIBLE.
    return true;
  }
  return false;
}

// v8.4.0: try to assign a freshly-added L1 feat to an unfilled slot.
// Mutates the slot in place; returns the slot kind that was filled (for
// downstream logging/UX), or null if no slot matched.
//
// Called from addFeatToChar AFTER the feat has been pushed to c.feats.
// Only runs for v8.4.0+ characters; legacy characters never get slot
// reconciliation (their L1 feats live in c.feats with origin tags, the
// pre-v8.4.0 mechanism).
//
// Also only fires when the character is currently at total level 1 — feats
// added at higher levels (via Level Up or Edit) don't fill L1 slots even
// for v8.4.0 characters.
//
// Slot preference: walks SLOT_PREFERENCE_ORDER (most-restricted first) and
// picks the first slot of a kind that accepts this feat. Within a kind
// (e.g. two occupation slots from primary+secondary), picks the first
// unfilled one.
function tryFillFirstLevelSlot(c, featName, featParam) {
  if (!c || isLegacyCharacter(c)) return null;
  if (!Array.isArray(c.firstLevelSlots)) return null;
  // Only L1 characters fill L1 slots. (totalLvl may not be set yet on a
  // newborn character mid-save; fall back to a class-array sum.)
  const totalLvl = c.totalLvl || (c.classes||[]).reduce((s,e)=>s+(e.level||0),0);
  if (totalLvl !== 1) return null;
  for (const preferredKind of SLOT_PREFERENCE_ORDER) {
    const slot = c.firstLevelSlots.find(s => s.kind === preferredKind && s.filled === null && slotAcceptsFeat(s, featName));
    if (slot) {
      slot.filled = featName;
      slot.filledParam = featParam || null;
      return slot.kind;
    }
  }
  return null;
}

// v8.4.0: when a feat is removed, clear whichever L1 slot was filling it
// (if any). Reverse of tryFillFirstLevelSlot. No-op for legacy characters
// or feats that weren't slot-tracked.
function clearFirstLevelSlotForFeat(c, featName, featParam) {
  if (!c || isLegacyCharacter(c)) return;
  if (!Array.isArray(c.firstLevelSlots)) return;
  const slot = c.firstLevelSlots.find(s =>
    s.filled === featName &&
    (s.filledParam || null) === (featParam || null)
  );
  if (slot) {
    slot.filled = null;
    slot.filledParam = null;
  }
}

// v8.4.0: best-effort compliance scan for a Hero's Gift retcon.
//
// When the player retcons heroesGiftChoice (feat ↔ talent ↔ null), some
// existing picks may have been only valid under the *old* assignment.
// Specifically: a feat occupying the herosGift slot, when the slot is
// retconned away, becomes an over-budget feat; downstream feats/talents
// that listed it as a prereq are still owned but now have an unmet
// requirement.
//
// The scan walks every owned feat and talent and re-checks its prereqs
// against the *post-retcon* character state. Items that are now unmet are
// reported as broken chains. Per decision 7 of the plan, this is purely
// INFORMATIONAL — the scan does NOT auto-remove orphaned picks; the GM
// decides what to do with the results.
//
// Returns an array of break-descriptions for the GM exception's missing[]
// list. Empty array means no breaks detected.
function scanHerosGiftRetconCompliance(c) {
  const breaks = [];
  if (!c) return breaks;
  // Walk feats
  if (typeof checkFeatPrereqs === 'function') {
    for (const f of (c.feats || [])) {
      const name = f.name || f.n;
      if (!name) continue;
      try {
        const result = checkFeatPrereqs(name, c);
        if (result && !result.met) {
          const missList = (result.missing || []).map(m => m.replace(/^\s+|\s+$/g, '')).join('; ');
          breaks.push(`Feat "${name}" prereq broken: ${missList || 'see prereq engine'}`);
        }
      } catch (e) { /* defensive: skip on engine error */ }
    }
  }
  // Walk talents
  if (typeof checkTalentPrereqs === 'function') {
    for (const t of (c.talents || [])) {
      const name = t.name || t.n;
      if (!name) continue;
      try {
        const result = checkTalentPrereqs(name, c);
        if (result && !result.met) {
          // v8.4.1: skip pure GM-verify advisories — these aren't structural
          // breaks, they're acknowledgments that the parser can't evaluate the
          // prereq. The Talent browser displays them as "⚠ GM-verify" rather
          // than blocking. In the compliance scan they should not be reported
          // as breaks, since they aren't.
          const allGmVerify = (result.missing || []).every(m => /\(GM-verify\)/.test(m));
          if (!allGmVerify) {
            const missList = (result.missing || []).map(m => m.replace(/^\s+|\s+$/g, '')).join('; ');
            breaks.push(`Talent "${name}" prereq broken: ${missList || 'see prereq engine'}`);
          }
        }
      } catch (e) { /* defensive: skip on engine error */ }
    }
  }
  return breaks;
}

async function saveCharacter(){
  const name=document.getElementById('c-name').value.trim();
  if(!name){toast('Enter a character name.');return;}
  // v8.3.17: Gate enforcement. Player must commit a scenario (Lock as Official
  // or Use Sandbox Mode) before saving. We allow sandbox saves since the
  // first-save Six Scales modal acts as a final scenario-confirmation, but
  // 'awaiting' is the blocking state — the player has interacted with nothing
  // downstream and shouldn't proceed.
  if (gateState === 'awaiting' && !editId) {
    toast('Choose Lock as Official or Use Sandbox Mode in the Scenario Settings panel first.');
    return;
  }
  // First-save Six Scales gate (v8.2.1). New character, gate not yet cleared
  // for this save attempt — show the recap modal and abort. The modal's
  // Confirm button will set _firstSaveConfirmed=true and re-invoke
  // saveCharacter().
  if (!editId && !_firstSaveConfirmed) {
    promptFirstSaveSixLevels();
    return;
  }
  // Clear the gate immediately after consumption so subsequent saves (e.g.
  // saving an existing character) don't carry it forward.
  _firstSaveConfirmed = false;
  // v8.2.3 (Issue B): keep two attribute arrays during save:
  //   baseAttrs — stored on c.attrs (pre-bumps). Preserves the
  //               attribute-generation budget tracker so re-editing the
  //               character doesn't double-count bumps as budget points.
  //   effAttrs  — base + bumps. Used for HP / saves / other derived stats.
  const baseAttrs=getAttrs();
  const race=document.getElementById('c-race').value;
  const effAttrs = applyAttrBumps(baseAttrs, formAttrBumps);
  const sixLevels=getSixLevels();
  const conM=am(effAttrs[2]);
  // Validate that at least one class is set (or warn the user)
  if(formClasses.length===0){
    if(!(await confirmModal('No classes have been added. Save anyway as a "no class" character?')))return;
  }
  // Soft-warn: collect all unmet prereqs across every Advanced + Prestige entry.
  let warnings=[];
  let skills={},feats=[];
  let prevExceptions=[]; // GM exceptions previously recorded on this character (preserved across edits)
  if(editId){const ex=chars.find(c=>c.id===editId);if(ex){skills=ex.skills||{};feats=ex.feats||[];prevExceptions=ex.gmExceptions||[];}}
  const ctx={
    attrs:effAttrs,  // v8.2.3: effective attrs (base + bumps) for prereq checks
    allegiance:document.getElementById('c-allegiance')?.value||'',
    align:document.getElementById('c-align')?.value||'',
  };
  // Collect prereq-fail records for all class entries so we can both
  // warn the user AND persist them as GM exceptions if they choose to override.
  // v8.3.23: extended to Hero and Basic tiers so attrMin violations (Hero
  // class without 13 in key attr; certain Basic classes without 10) get
  // surfaced at save time too.
  const pendingExceptions = []; // {type, target, missing:[...]}
  for(const e of formClasses){
    const otherEntries=formClasses.filter(x=>x!==e);
    const r=checkClassPrereqsFromArray(e.name, otherEntries, skills, feats, sixLevels, ctx);
    if(!r.met){
      const tierLabel={hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier]||e.tier;
      warnings.push(`${e.name} (${tierLabel}):\n  • `+r.missing.join('\n  • '));
      pendingExceptions.push({type:'class', target:`${e.name} (${tierLabel})`, missing:r.missing.slice(), grantedAt:new Date().toLocaleDateString()});
    }
  }
  if(warnings.length){
    const ok=await confirmModal(`Prerequisites not yet met:\n\n${warnings.join('\n\n')}\n\nSave anyway (will be recorded as GM exception)?`);
    if(!ok)return;
  }
  // Detect Starting Occupation change on an existing character (GM override).
  // Only logs if the user actually unlocked the lock AND changed a value.
  if (editId && occupationsUnlocked) {
    const occEl = document.getElementById('c-occ');
    const occ2El = document.getElementById('c-occ2');
    const origOcc = occEl.dataset.original;
    const origOcc2 = occ2El.dataset.original;
    if (origOcc !== undefined && (occEl.value !== origOcc || occ2El.value !== origOcc2)) {
      const fromText = origOcc2 ? `${origOcc} + ${origOcc2}` : origOcc;
      const toText = occ2El.value ? `${occEl.value} + ${occ2El.value}` : occEl.value;
      pendingExceptions.push({
        type:'occupation',
        target:'Starting Occupation override',
        missing:[`Changed from "${fromText}" to "${toText}" (Starting Occupation is normally fixed at character creation)`],
        grantedAt:new Date().toLocaleDateString(),
      });
    }
  }
  // v8.3.19: pass heroic level (zeroes AP at H0) and existing fatePoints
  // (preserved across edits — Fate Point expenditures are permanent).
  // v8.3.32: route through effectiveHeroicLevelForAP so a purely-Ordinary
  // character is saved with AP 0 (via the existing H0 guard) regardless of
  // the scenario's Heroic Scale. formClasses + sixLevels.heroic feed the
  // synthetic object the helper inspects.
  const _saveHeroic = sixLevels.heroic || 0;
  const _existingFP = (editId && chars.find(x=>x.id===editId)?.fatePoints) || 0;
  const _saveApHeroic = effectiveHeroicLevelForAP({classes: formClasses, sixLevels: {heroic: _saveHeroic}});
  const s=computeStatsFromClasses(formClasses, effAttrs[5], _saveApHeroic, _existingFP);
  // v8.1.7: per HH p.347, every +1 natural AC modifier grants +5 HP and +1 natural hardness.
  // The HP bonus is folded into maxHP here; natural hardness is surfaced on the combat dashboard.
  // v8.3.5: read both NAC fields and sum. Same composition logic as updateDerived
  // so the saved character matches the form preview.
  const racialNACSave = parseInt(document.getElementById('c-racial-nac')?.value) || 0;
  const bonusNACSave  = parseInt(document.getElementById('c-bonus-nac')?.value)  || 0;
  const naturalACForm = racialNACSave + bonusNACSave;
  // v8.2.3 (Issue A): ensure formHpRolls is sized correctly before computing.
  // Use stored rolls so HP matches what was shown on the form.
  syncFormHpRollsLength();
  formHpMode = getFormHpMode();
  const maxHP=computeMaxHPFromRolls(formClasses,formHpRolls,conM) + (naturalACForm * 5);
  // v8.68.0: Hybrid RLM from the form (refreshEclXp re-stamps post-merge).
  const _raceEclForm = race === 'Hybrid' ? ((typeof _formHybridRlm === 'function') ? _formHybridRlm() : 0) : (RACES[race]?.ecl||0);
  const ecl=s.totalLvl+_raceEclForm;
  // Deep-copy the form classes array so mutations don't leak back
  const classesCopy=formClasses.map(e=>Object.assign({},e));
  // Compute legacy slot mirrors so older code paths (sheet, roster, drilldown, print) keep working
  // until they're fully migrated. Each slot mirrors the FIRST entry of its tier.
  const heroEntry=classesCopy.find(e=>e.tier==='hero');
  const basicEntry=classesCopy.find(e=>e.tier==='basic');
  const advEntry=classesCopy.find(e=>e.tier==='advanced');
  const presEntry=classesCopy.find(e=>e.tier==='prestige');
  // v8.1.4: support up to two Starting Occupations (primary + optional Moonlighter).
  // c.occupations is the canonical array; c.occ is kept synced with the first entry
  // for any legacy code path that still reads it.
  const occ1 = document.getElementById('c-occ').value;
  const occ2 = document.getElementById('c-occ2').value;
  const occupations = [occ1, occ2].filter(o => o && o.trim());
  // v8.2.1: snapshot the occupation picker state. Deep-clone the slot arrays
  // so the saved record can't be mutated by subsequent form edits without a
  // re-save.
  const occupationPicks = {
    primary:   { skills: (formOccupationPicks.primary?.skills||[]).slice(),
                 bonusFeat: formOccupationPicks.primary?.bonusFeat || null },
    secondary: { skills: (formOccupationPicks.secondary?.skills||[]).slice(),
                 bonusFeat: formOccupationPicks.secondary?.bonusFeat || null },
  };
  // v8.4.0: derive schemaVer, heroesGiftChoice, firstLevelSlots.
  //
  // Three cases for legacy/v8.4.0 status:
  //   (1) NEW character (!editId): always stamp schemaVer:1, initialize
  //       firstLevelSlots from current form state, set heroesGiftChoice:null
  //       if Hero-classed (the Sheet will prompt the player to choose).
  //   (2) EDIT of v8.4.0 character (existing record has schemaVer:1): preserve
  //       existing v8.4.0 fields. firstLevelSlots are NOT re-derived on Edit
  //       (they're set once at genesis); heroesGiftChoice carries through.
  //   (3) EDIT of legacy character (existing record has no schemaVer): HARD
  //       LINE per decision 9 — do NOT silently upgrade. The character stays
  //       legacy; no schemaVer set, no firstLevelSlots, no heroesGiftChoice.
  //       getFeatBudget and getTalentBudget continue to use the legacy path.
  const existingChar = editId ? chars.find(x=>x.id===editId) : null;
  const existingIsLegacy = existingChar ? isLegacyCharacter(existingChar) : false;
  let v840_schemaVer, v840_heroesGiftChoice, v840_firstLevelSlots;
  // v8.70.1: the Hybrid parent pair for the Human-bonus slot derivation —
  // read from the FORM (the char literal doesn't exist yet at this point).
  const _hybSlots = race === 'Hybrid' ? { a: document.getElementById('c-hyb-a')?.value || '', b: document.getElementById('c-hyb-b')?.value || '' } : null;
  // v8.4.0: track retcon for case (2). When set, saveCharacter runs the
  // compliance scan and records a GM exception after the char record is
  // built. Three fields: oldChoice (what was there before), newChoice
  // (what's being set), and didRetcon (whether to actually run the flow).
  let v840_retconOld = null;
  let v840_retconNew = null;
  let v840_didRetcon = false;
  if (!editId) {
    // Case (1): new character — fresh v8.4.0
    v840_schemaVer = CURRENT_SCHEMA_VER;
    const heroClassed = classesCopy.some(e => e.tier === 'hero');
    v840_heroesGiftChoice = heroClassed ? null : undefined;
    v840_firstLevelSlots = deriveFirstLevelSlots({race, classes: classesCopy, occupations, hybrid: _hybSlots});
  } else if (existingIsLegacy) {
    // Case (3): legacy stays legacy
    v840_schemaVer = undefined;
    v840_heroesGiftChoice = undefined;
    v840_firstLevelSlots = undefined;
  } else {
    // Case (2): edit of v8.4.0 — preserve, except for explicit Hero's Gift retcon
    v840_schemaVer = existingChar.schemaVer || CURRENT_SCHEMA_VER;
    v840_heroesGiftChoice = existingChar.heroesGiftChoice ?? null;
    v840_firstLevelSlots = existingChar.firstLevelSlots
      ? existingChar.firstLevelSlots.map(s => Object.assign({}, s))
      : deriveFirstLevelSlots({race, classes: classesCopy, occupations, hybrid: _hybSlots});
    // Detect Hero's Gift retcon — only if the user explicitly picked a new
    // value from the dropdown. The dropdown's "" value means "no change".
    const heroClassed = classesCopy.some(e => e.tier === 'hero');
    if (heroClassed) {
      const retconSelect = document.getElementById('edit-hg-choice');
      const rawNewChoice = retconSelect ? retconSelect.value : '';
      if (rawNewChoice) {
        const newChoice = rawNewChoice === 'null' ? null : rawNewChoice;
        const oldChoice = v840_heroesGiftChoice;
        if (newChoice !== oldChoice) {
          // Apply the retcon.
          v840_retconOld = oldChoice;
          v840_retconNew = newChoice;
          v840_didRetcon = true;
          v840_heroesGiftChoice = newChoice;
          // Slot bookkeeping: if retconning AWAY FROM feat, remove the
          // herosGift slot (and unfill it first if filled — the filled feat
          // becomes orphaned, which the compliance scan will flag).
          // If retconning TO feat, add the herosGift slot (empty).
          if (oldChoice === 'feat' && newChoice !== 'feat') {
            v840_firstLevelSlots = v840_firstLevelSlots.filter(s => s.kind !== 'herosGift');
          }
          if (newChoice === 'feat' && oldChoice !== 'feat') {
            if (!v840_firstLevelSlots.some(s => s.kind === 'herosGift')) {
              v840_firstLevelSlots.push({kind:'herosGift', filled:null, filledParam:null});
            }
          }
        }
      }
    }
  }
  // v8.30.1 (Adam's Heinrix report): sub-options persist ONLY when their
  // owning class is still on the character. A backtracked class pick (Saint
  // chosen with 4 domains, then deleted for Charismatic Hero) left the picker
  // hidden but formSubOptions populated — save then stamped the orphan
  // domains onto the record, and the Domain Granted Powers panel showed them.
  const _soClasses = new Set(classesCopy.filter(e => (e.level||0) > 0).map(e => e.name));
  const char={
    id:editId||genId(),name,player:document.getElementById('c-player').value,
    sex:document.getElementById('c-sex').value,race,
    // v8.68.0: the Hybrid parent record (null for every other race).
    hybrid: race === 'Hybrid' ? {
      a: document.getElementById('c-hyb-a')?.value || '',
      b: document.getElementById('c-hyb-b')?.value || '',
      sizeFrom: document.getElementById('c-hyb-size')?.value || 'a',
      rlmOverride: (() => { const v = document.getElementById('c-hyb-rlm')?.value; return (v !== '' && v != null && !isNaN(parseInt(v, 10))) ? parseInt(v, 10) : null; })(),
      dropped: document.getElementById('c-hyb-dropped')?.value || '',
    } : null,
    occ:occ1, occupations, occupationPicks,
    align:document.getElementById('c-align').value,
    allegiance:document.getElementById('c-allegiance').value,
    classes:classesCopy, // ← the new authoritative class data
    // v8.5.4: class sub-options (persisted only when meaningful — absent
    // fields keep legacy/unconfigured behavior, incl. the Saint/Psion
    // advisory fallbacks). v8.30.1: each additionally gated on class presence.
    ...(_soClasses.has('Cleric') && formSubOptions.clericDomains.length ? {clericDomains: formSubOptions.clericDomains.slice()} : {}),
    ...(_soClasses.has('Cleric') && formSubOptions.druidOption ? {druidOption: true} : {}),
    ...(_soClasses.has('Saint') && formSubOptions.saintDomains.length ? {saintDomains: formSubOptions.saintDomains.slice()} : {}),
    ...(_soClasses.has('Paladin') && formSubOptions.paladinDomains.length ? {paladinDomains: formSubOptions.paladinDomains.slice()} : {}),
    ...(_soClasses.has('Ranger') && formSubOptions.rangerSecrets.filter(Boolean).length ? {rangerSecrets: formSubOptions.rangerSecrets.slice()} : {}),
    ...(_soClasses.has('Bard') && formSubOptions.bardStoryteller.filter(Boolean).length ? {bardStoryteller: formSubOptions.bardStoryteller.slice()} : {}),
    ...(_soClasses.has('Psion') && formSubOptions.psionDiscipline ? {psionDiscipline: formSubOptions.psionDiscipline} : {}),
    ...(_soClasses.has('Wizard') && formSubOptions.wizardSchool ? {wizardSchool: formSubOptions.wizardSchool, wizardProhibited: formSubOptions.wizardProhibited.slice()} : {}),
    // v8.4.0: schemaVer / heroesGiftChoice / firstLevelSlots — only set on
    // v8.4.0+ characters. Legacy characters (case 3 above) get NONE of these
    // fields stamped, preserving their pre-v8.4.0 record shape exactly.
    ...(v840_schemaVer !== undefined ? {schemaVer: v840_schemaVer} : {}),
    ...(v840_heroesGiftChoice !== undefined ? {heroesGiftChoice: v840_heroesGiftChoice} : {}),
    ...(v840_firstLevelSlots !== undefined ? {firstLevelSlots: v840_firstLevelSlots} : {}),
    // Legacy slot mirrors (first entry of each tier) — kept for compat with not-yet-migrated render code
    heroClass:heroEntry?.name||'',basicClass:basicEntry?.name||'',advClass:advEntry?.name||'',presClass:presEntry?.name||'',
    heroLvl:heroEntry?.level||0,basicLvl:basicEntry?.level||0,advLvl:advEntry?.level||0,presLvl:presEntry?.level||0,
    totalLvl:s.totalLvl,ecl,
    sixLevels,
    scenarioPreset:document.getElementById('c-scenario-preset').value,
    // v8.3.24: snapshot the displayed Scenario Title (either auto-generated
    // from axes or player-overridden) for use on the Sheet and elsewhere.
    scenarioTitle: getCurrentScenarioTitle(),
    // v8.3.27: structured AP/FP audit log. Preserved across edits — saveCharacter
    // doesn't mutate it. Tracker writes to it via logActionEvent() when the
    // player spends/restores AP or FP via the AP Bar buttons.
    actionLog: ((editId && chars.find(x=>x.id===editId)?.actionLog) || []).slice(),
    heroicLevel:sixLevels.heroic, // older code references this directly
    // v8.2.3 (Issue B): c.attrs stores the EFFECTIVE attributes (base + bumps).
    // All downstream readers (HP, saves, skill mods, AC, etc.) use these.
    // c.attrsBase stores the pre-bump values so editing the character on the
    // form correctly repopulates the original input scores. c.attrBumps stores
    // the per-level bump assignments; together they let us reconstruct the
    // effective values without drift.
    attrs:effAttrs,
    attrsBase:baseAttrs.slice(),
    attrBumps:formAttrBumps.slice(),
    // v8.2.3 (Issue A): HP generation mode + per-level rolls.
    hpMode:formHpMode,
    hpRolls:formHpRolls.slice(),
    maxHP,currentHP:maxHP,
    bab:s.bab,def:s.def,fort:s.fort,ref:s.ref,will:s.will,rep:s.rep,
    ap:s.ap,apMax:s.ap,
    // v8.3.19: Fate Points = permanent AP expenditures (HH p.55). Preserved
    // across edits — once spent, they reduce future AP pool replenishment.
    // The existing fatePoints (if any) is preserved by the assignment below.
    fatePoints: ((editId && chars.find(x=>x.id===editId)?.fatePoints) || 0),
    // v8.3.21: c.talents preserved across edits. The Talents tab/page is the
    // canonical authoring surface; saveCharacter does not modify the list,
    // just carries it through.
    talents: ((editId && chars.find(x=>x.id===editId)?.talents) || []).slice(),
    // v8.3.28: XP at save respects the character's level floor. Previously
    // hardcoded to 0, which made wholecloth high-level characters appear to
    // need ALL their cumulative XP to reach the next level (e.g. a Level 10
    // generated character would show 0/55,000 XP, when really they should
    // be at the floor 45,000 needing only 10,000 more to advance).
    //
    // Rule: `xp = max(existingXp, xpThreshold(totalLvl))`. For new characters
    // (editId null), existingXp is 0 so result is the floor of their starting
    // level. For edit-mode characters whose level is unchanged, their existing
    // xp is preserved. For edit-mode characters whose level was raised via the
    // form, xp is bumped to the new level's floor (preserving in-band progress
    // would yield xp < floor, which is incoherent).
    xp: (function(){
      const existingXp = (editId && chars.find(x=>x.id===editId)?.xp) || 0;
      // v8.5.4: LA-aware floor per GMG p.38 — reaching class level L with a
      // race Level Adjustment means having crossed the T(L + LA) threshold
      // (the drow example: a wholecloth class-2 drow has ≥ 6,000 XP).
      const levelFloor = xpThreshold(s.totalLvl + _raceEclForm);  // v8.68.0: Hybrid-aware
      return Math.max(existingXp, levelFloor);
    })(),
    // v8.5.4: refreshed ECL-aware (incl. Mutant Level) by refreshEclXp() after
    // the edit-merge below — this assembly value is the pre-merge baseline.
    xpNext:xpThreshold(s.totalLvl + 1),
    langs:document.getElementById('c-langs').value,notes:document.getElementById('c-notes').value,
    // v8.1.1: persist attribute budget so the delta is preserved across edits
    attrMethod: formBudget.method,
    baseTotal: formBudget.baseTotal,
    racialApplied: formBudget.racialApplied,
    // v8.1.3: persist GM exceptions. New entries from this save are merged with
    // previously-recorded entries; duplicates (same target) are not re-added.
    gmExceptions: mergeGMExceptions(prevExceptions, pendingExceptions),
    // v8.1.7: T/ACtical Combat System equipment AC modifiers. Default to 0; player
    // edits these on the sheet until the full equipment chapter ships in v9+.
    armorAC: parseInt(document.getElementById('c-armor-ac')?.value) || 0,
    shieldAC: parseInt(document.getElementById('c-shield-ac')?.value) || 0,
    naturalAC: naturalACForm,  // v8.3.5: synced with racial+bonus from form
    // v8.3.5: build the source-attributed natural AC list. Racial NAC from
    // the race's structured natAC; Bonus NAC as a generic enhancement entry.
    // Same-type stacking semantics resolve at compute time via the bonus
    // aggregator. The legacy c.naturalAC scalar is kept as the effective
    // total (cached for backward compat with any reader not yet migrated).
    naturalACSources: (function() {
      const out = [];
      const racial = buildRacialNaturalACSource(race);
      if (racial) out.push(racial);
      const bonusNAC = parseInt(document.getElementById('c-bonus-nac')?.value) || 0;
      if (bonusNAC > 0) {
        out.push({
          type: BONUS_TYPES.ENHANCEMENT,
          source: 'manual:bonus',
          value: bonusNAC,
          label: 'Magic/equipment natural armor',
        });
      }
      return out;
    })(),
    skills:{},feats:[],conditions:[],log:[],created:new Date().toLocaleDateString(),
  };
  if(editId){
    const idx=chars.findIndex(c=>c.id===editId);
    if(idx>=0){
      // Normal edit-save: merge runtime state from prior record and replace.
      char.currentHP=chars[idx].currentHP;
      char.xp=chars[idx].xp;
      char.skills=chars[idx].skills||{};
      char.feats=chars[idx].feats||[];
      char.log=chars[idx].log||[];
      char.conditions=chars[idx].conditions||[];
      // v8.5.4 FIX: the v8.5.2/v8.5.3 subsystems (gear, powers repertoire,
      // mutations/MP economy, per-pool PP tallies, the sheet's powers-known
      // notes) were added without extending this merge list — an Edit-save
      // silently WIPED all of them. Preserve every runtime subsystem field
      // the assembly above doesn't rebuild:
      for (const k of ['items','powers','mutations','mpGrants','superMutantTier',
                       'superPPCurrent','ppCurrent','powersKnownList','mlXpCompensatedTo',
                       'preparedSlots','preparedToday','nullified','wealthScore','wealthBreakdown','funds','rangerCombatStyle',
                       'abilityUses','raging','fatigued','euphoric','classChoices','classAttrApplied','companions','rkcmDamaged',
                       'skillSets',  // v8.66.0: Take-10 designations survive edit-saves // conditions handled above
                       // v9.9.1 (§260): the v8.90+/v9.2 subsystems had re-walked into the
                       // v8.5.4 wipe trap — an edit-save silently dropped every implant
                       // and active gear Boon. (cybNacHpApplied deliberately NOT
                       // preserved — the reconciler re-bakes onto the fresh maxHP.)
                       'cybernetics','activeEffects',
                       // v9.9.2 (§261, 2026-10-09): the SYSTEMATIC AUDIT — after the trap
                       // bit twice (v8.5.4, §260), every `c.<field> =` site in the file
                       // was enumerated and classified. These thirteen runtime fields had
                       // accumulated since v8.3.x–v9.x with no preservation line; an
                       // edit-save wiped each one. The Mind's Ledger (c.mind), ability
                       // damage (c.attrDmg), the nonlethal tally, declared combat stances,
                       // psionic/battle focus, the Techsmith mastercraft reserve, the MDT
                       // adjustment, Mental Pinnacle picks, Second Skin, the career goal,
                       // the HP-auto-assign flag and the NAC-banner dismissal all live
                       // ONLY on the saved record — nothing re-derives them.
                       // (conDmgHpApplied deliberately NOT preserved — ledger convention;
                       // reconcileConDamageHP below re-debits onto the fresh maxHP.
                       // actionLog, fatePoints and talents need no line here — the
                       // assembly literal above pre-merges them from the prior record.
                       // ap/apMax deliberately restamped fresh: the AP pool replenishes,
                       // and fatePoints preservation already carries the permanent spend.)
                       'attrDmg','nlDmg','battleFocused','psiFocused','combatDecl',
                       'mdtAdj','mcReserve','careerGoal','mentalPinnacle','mind',
                       'secondSkin','hpAutoAssigned','_natACDismissed']) {
        // (talentHpApplied deliberately NOT preserved — reconcileTalentHp
        // re-applies onto the assembly's fresh maxHP, like mutNacHpApplied.)
        if (chars[idx][k] !== undefined) char[k] = chars[idx][k];
      }
      // v8.6.1 FIX (Adam's Rhad retcon report, 2026-09-01): the edit form
      // populates the attribute inputs from c.attrsBase (pure pre-bump
      // point-buy values — mutation bakes live only in c.attrs), so the
      // assembly above rebuilt char.attrs WITHOUT the baked attribute-
      // mutation deltas — while the preserved mutation records still carry
      // their attrApplied flags, so the idempotent reconciler (correctly)
      // declined to re-bake. Net effect: every edit-save silently dropped
      // the ±attr bakes (Rhad's Dex 24 → 16 with the +4/+4 tags still
      // showing). Re-apply every attrApplied delta onto the fresh array —
      // generic over the ±4 chain AND Ability Decay's −2 (which the
      // reconciler never re-applies; it was baked at add time). Gated on the
      // pre-edit record having attrsBase: a legacy character's form was
      // populated from c.attrs (bakes INCLUDED), so re-applying there would
      // double-count.
      if (chars[idx].attrsBase && chars[idx].attrsBase.length === 6 && Array.isArray(char.attrs)) {
        for (const m of (char.mutations || [])) {
          if (m.attrApplied && ATTR_KEY_IDX[m.attr] !== undefined) {
            char.attrs[ATTR_KEY_IDX[m.attr]] += m.attrApplied;
          }
        }
        // v8.8.0: talent attr bakes (Titanic Strength) re-apply the same way.
        for (const te of (char.talents || [])) {
          if (te.attrApplied && ATTR_KEY_IDX[te.attrKey] !== undefined) {
            char.attrs[ATTR_KEY_IDX[te.attrKey]] += te.attrApplied;
          }
        }
        // v8.8.3: class-feature attr bakes (Mental Acuity, Profound
        // Realization, Self-Control/Mastery, True Sainthood) — the ledger is
        // zeroed so reconcileClassAttrBakes (inside reconcileGrantedFeats
        // below) re-applies the full expected set onto the fresh attrs.
        char.classAttrApplied = [0, 0, 0, 0, 0, 0];
      }
      // v8.6.0: mutNacHpApplied is deliberately NOT preserved — the assembly
      // just recomputed maxHP from the form (without mutation NAC HP), so the
      // reconciler re-applies the ×5-HP bake onto the fresh value here.
      reconcileAttributeMutations(char);
      reconcileGrantedFeats(char);  // v8.6.1: class-entry feat grants (Monk CMA/DMA) sync with the edited class array
      reconcileTalentHp(char);  // v8.8.0: Robust HP re-applies onto the fresh maxHP (talentHpApplied not preserved — same convention as mutNacHpApplied)
      if (typeof reconcileMutantSubtype === 'function') reconcileMutantSubtype(char);  // v8.67.0: Unnatural Prowess/Resilience re-apply onto the fresh bab/def/maxHP (mutSubApplied not preserved — same convention)
      // v9.9.2 (§261): attrDmg is now preserved above, but its HP ledger
      // (conDmgHpApplied) follows the not-preserved convention — and its
      // reconciler otherwise runs only on damage/heal events, which left the
      // rebuilt maxHP un-debited until the next hit. Re-debit here, like the
      // other ledgers. The preserved currentHP already carries the debit from
      // the live damage event, so only maxHP needs it back: snapshot current
      // around the call (the ledger was wiped, so the reconciler would debit
      // BOTH and double-charge current); the v8.12.3 clamp below still rules.
      if (typeof reconcileConDamageHP === 'function') {
        const _curSnap = char.currentHP;
        reconcileConDamageHP(char);
        if (typeof _curSnap === 'number' && isFinite(_curSnap)) char.currentHP = _curSnap;
      }
      // v8.12.3 (Adam's Rhad retcon report): a class retcon can legitimately
      // SHRINK the recomputed maxHP (a d10 level traded for a d6 one) while
      // currentHP is preserved verbatim above — leaving impossibilities like
      // 98/94 on the Tracker. Current hit points never exceed the new max.
      if (typeof char.currentHP === 'number' && typeof char.maxHP === 'number' && char.currentHP > char.maxHP) char.currentHP = char.maxHP;
      chars[idx]=char;
      // v8.4.0: if this save retconned Hero's Gift, run the compliance scan
      // against the committed character (which has the new heroesGiftChoice
      // and updated firstLevelSlots) and record the GM exception.
      if (v840_didRetcon) {
        const oldLabel = v840_retconOld === 'feat' ? 'Feat'
                       : v840_retconOld === 'talent' ? 'Talent'
                       : 'Unassigned';
        const newLabel = v840_retconNew === 'feat' ? 'Feat'
                       : v840_retconNew === 'talent' ? 'Talent'
                       : 'Unassigned';
        const breaks = scanHerosGiftRetconCompliance(char);
        if (!char.gmExceptions) char.gmExceptions = [];
        const target = `Class (Hero's Gift Retcon): ${oldLabel} → ${newLabel}`;
        const missing = breaks.length > 0
          ? breaks
          : ['No prereq breaks detected by the compliance scan. The retcon is informational; the GM may still wish to review character build for soft inconsistencies the engine cannot detect.'];
        char.gmExceptions.push({
          type: 'heroes-gift-retcon',
          target,
          missing,
          grantedAt: new Date().toLocaleDateString(),
        });
      }
    } else {
      // v8.2.2 defensive: editId was set, but the referenced character is
      // gone (deleted from roster mid-edit, or stale state from a prior
      // session). Push as new instead of silently dropping the save.
      console.warn('[saveCharacter] editId='+editId+' set but character not found; treating as new creation.');
      chars.push(char);
    }
    editId=null;
  }
  else chars.push(char);
  // v8.2.1: reconcile occupation bonus feats with c.feats. Any prior feat
  // tagged with origin:'occupation:*' is removed; the currently-picked bonus
  // feats (if any) are then added back with fresh origin tags. This handles
  // first creation, subsequent edits that change the bonus feat pick, and
  // changes to the underlying occupation itself.
  reconcileOccupationBonusFeats(char);
  // v8.5.4: with runtime fields merged (feats, mutations, MP grants all
  // visible to getMPState), settle any ML thresholds and refresh the
  // ECL-keyed XP fields per GMG p.38.
  refreshEclXp(char);
  // v8 parity check — compare the new bonus aggregator against the proven v7 path.
  // If they diverge, log to console (but don't block the save). This is our regression
  // tripwire: in development any drift becomes immediately visible without breaking
  // existing functionality.
  try {
    const parity=verifyParity(char);
    if(!parity.match){
      console.warn('[v8 parity drift] Character "'+char.name+'" has computed-stat divergence between v7 and v8 engines:', parity.diffs);
    }
  } catch(err) {
    console.warn('[v8 parity check error]', err);
  }
  curId=char.id;save();renderRoster();clearForm();toast('Saved: '+name);
  // v8.3.21: refresh nav-tab visibility for the saved character.
  renderNavTabs(char);
  showPage('sheet');
}
// v8.28.0 (Adam): character cloning. Creates a full working copy of the
// selected character — for exploring build options without risking the
// original, or for keeping a per-level snapshot ("Rhad — Level 7") as often
// as desired. Records are pure JSON (localStorage), so a JSON round-trip is a
// complete deep copy: classes, gear, spells, mutations, ledgers, logs — all
// of it. The copy gets a fresh id and a provenance line in its story log,
// then becomes the SELECTED character, so any experimenting that follows
// lands on the copy — the original is never the one under the knife.
async function cloneCurrentChar(){
  if(!curId){toast('Select a character to clone.');return;}
  const src=chars.find(x=>x.id===curId); if(!src)return;
  const suggested=`${src.name} — L${src.totalLvl} copy`;
  const v=await textModal('⧉ Clone Character',
    `Name for the copy of ${src.name}. Use a snapshot label ("${src.name} — Level ${src.totalLvl}") to archive this version, or a what-if tag ("${src.name} (grenadier build)") to experiment freely. Cancel aborts.`,
    suggested);
  if(v===null)return;
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=genId();
  copy.name=v.trim()||suggested;
  if(!Array.isArray(copy.log))copy.log=[];
  copy.log.push({time:new Date().toLocaleString(),text:`⧉ Cloned from "${src.name}" (Level ${src.totalLvl}${src.ecl!==src.totalLvl?`, ECL ${src.ecl}`:''}).`});
  chars.push(copy);
  save();
  selChar(copy.id);
  toast(`⧉ "${copy.name}" created — now viewing the copy. The original is safe in the roster.`);
}
function editCurrentChar(){
  if(!curId)return;const c=chars.find(x=>x.id===curId);if(!c)return;
  editId=c.id;
  _createDirty=false;  // v9.16.0 (§276): the loaded form matches the saved hero
  // v8.5.4 ergo C2: never hide populated sections when editing.
  try { expandAllCreateSections(); } catch (e) {}
  // v8.4.0: show the Edit advisory banner — pure advisory, no friction.
  const banner = document.getElementById('edit-advisory-banner');
  if (banner) banner.style.display = '';
  // v8.4.0: populate the Hero's Gift retcon panel — visible only for
  // v8.4.0+ Hero-classed characters.
  const retconPanel = document.getElementById('edit-heroes-gift-retcon');
  const retconSelect = document.getElementById('edit-hg-choice');
  const retconCurrent = document.getElementById('edit-hg-current');
  if (retconPanel) {
    const heroClassed = (c.classes||[]).some(e => e.tier === 'hero');
    const showRetcon = !isLegacyCharacter(c) && heroClassed;
    retconPanel.style.display = showRetcon ? '' : 'none';
    if (showRetcon) {
      const current = c.heroesGiftChoice;
      const currentLabel = current === 'feat' ? 'Feat'
                         : current === 'talent' ? 'Talent'
                         : 'Unassigned';
      if (retconCurrent) retconCurrent.textContent = currentLabel;
      if (retconSelect) retconSelect.value = '';  // default to "No change"
    }
  }
  document.getElementById('c-name').value=c.name;
  document.getElementById('c-player').value=c.player||'';
  document.getElementById('c-sex').value=c.sex||'';
  document.getElementById('c-langs').value=c.langs||'';
  document.getElementById('c-notes').value=c.notes||'';
  // v8.68.2: a legacy race ('Mutant/Hybrid') is creation-barred but must
  // still EDIT — re-add its option dynamically when the record carries it.
  { const _rs = document.getElementById('c-race');
    if (_rs && c.race && ![..._rs.options].some(o => o.value === c.race)) {
      _rs.innerHTML += `<optgroup label="Legacy (this character only)"><option value="${escapeHTML(c.race)}">${escapeHTML(c.race)}</option></optgroup>`;
    } }
  document.getElementById('c-race').value=c.race;
  // v8.68.0: repopulate the Hybrid parent picker from the record BEFORE the
  // race-info refresh (which reads the selects for the adj sum).
  if (c.race === 'Hybrid' && c.hybrid) {
    updateRaceInfo();  // shows + populates the row's selects
    const _h = c.hybrid;
    const _sa = document.getElementById('c-hyb-a'), _sb = document.getElementById('c-hyb-b');
    if (_sa) _sa.value = _h.a || ''; if (_sb) _sb.value = _h.b || '';
    const _ss = document.getElementById('c-hyb-size'); if (_ss) _ss.value = _h.sizeFrom || 'a';
    const _sr2 = document.getElementById('c-hyb-rlm'); if (_sr2) _sr2.value = (_h.rlmOverride === 0 || _h.rlmOverride) ? _h.rlmOverride : '';
    const _sd = document.getElementById('c-hyb-dropped'); if (_sd) _sd.value = _h.dropped || '';
  }
  // v8.1.4: occupations as array; if legacy char has only c.occ, treat as single
  const occs = c.occupations && c.occupations.length ? c.occupations : (c.occ ? [c.occ] : []);
  document.getElementById('c-occ').value = occs[0] || 'Academic';
  document.getElementById('c-occ2').value = occs[1] || '';
  // Lock occupations on edit (Starting Occupation is fixed; "Edit (GM)" override available)
  lockOccupations();
  // v8.2.1: restore occupation picks from the saved record. Legacy characters
  // without picks (pre-v8.2.1 saves) get empty arrays so the picker renders
  // blank slots, prompting the player to fill them in.
  if (c.occupationPicks) {
    formOccupationPicks = {
      primary:   { skills: (c.occupationPicks.primary?.skills||[]).slice(),
                   bonusFeat: c.occupationPicks.primary?.bonusFeat || null },
      secondary: { skills: (c.occupationPicks.secondary?.skills||[]).slice(),
                   bonusFeat: c.occupationPicks.secondary?.bonusFeat || null },
    };
  } else {
    formOccupationPicks = {primary:{skills:[], bonusFeat:null}, secondary:{skills:[], bonusFeat:null}};
  }
  // v8.2.1: seed the picksFor tracker with the current dropdown values so a
  // re-render doesn't spuriously reset (we only reset when the dropdown
  // actually changes to a different occupation).
  formOccupationPicksFor = {
    primary: document.getElementById('c-occ').value,
    secondary: document.getElementById('c-occ2').value,
  };
  // Render the picker with restored state. Note: occupationsUnlocked is false
  // here (set by lockOccupations()), so the picker shows but the dropdown is
  // hidden behind the readonly UI. The "⚿ Edit (GM)" button unlocks both.
  renderOccupationPicker('primary');
  renderOccupationPicker('secondary');
  updateOccupationPicksWarning();
  // v8.2.2 (Issue 1): Second Occupation visibility depends on Moonlighter (or
  // legacy data). On edit, check the loaded character; on create form fall-
  // through, the row stays hidden.
  applySecondOccupationVisibility();
  document.getElementById('c-align').value=c.align;
  document.getElementById('c-allegiance').value=c.allegiance||'';
  // Restore the class array (migrating from legacy slots if needed)
  formClasses = migrateLegacyClasses(c).map(e=>Object.assign({},e));
  // Ensure exactly one entry has first=true
  if(formClasses.length && !formClasses.some(e=>e.first)) formClasses[0].first=true;
  // v8.5.4: restore class sub-options from the record
  formSubOptions = {
    clericDomains: (c.clericDomains||[]).slice(),
    druidOption: !!c.druidOption,
    saintDomains: (c.saintDomains||[]).slice(),
    paladinDomains: (c.paladinDomains||[]).slice(),
    rangerSecrets: (c.rangerSecrets||[]).slice(),
    bardStoryteller: (c.bardStoryteller||[]).slice(),
    psionDiscipline: c.psionDiscipline||null,
    wizardSchool: c.wizardSchool||null,
    wizardProhibited: (c.wizardProhibited||[]).slice(),
  };
  // Restore Six Scales (with legacy fallback for v3/v4 saves that only had heroicLevel)
  const sl=c.sixLevels || {arcane:0,divine:0,heroic:c.heroicLevel||1,mutation:0,psionic:0,tech:5};
  document.getElementById('c-scenario-preset').value=normalizePresetName(c.scenarioPreset||'Custom');
  for(const axis of ['arcane','divine','heroic','mutation','psionic','tech']){
    const el=document.getElementById('c-sl-'+axis);
    if(el)el.value=sl[axis]||0;
  }
  // v8.2.1: snapshot the saved Six Scales values so onSixLevelChange() can
  // detect actual divergence from the saved state (vs. routine slider clicks
  // that happen to land on the existing value). A shallow copy is enough —
  // we'll compare numeric values.
  editSavedSixLevels = {
    arcane: sl.arcane||0, divine: sl.divine||0, heroic: sl.heroic||0,
    mutation: sl.mutation||0, psionic: sl.psionic||0, tech: sl.tech||0,
  };
  // v8.3.24: restore scenario title override IF the saved title differs from
  // what generateScenarioTitle() would produce now (signals a player override).
  // Otherwise leave _scenarioTitleOverride null so the display tracks live axes.
  if (c.scenarioTitle) {
    const fresh = generateScenarioTitle(sl);
    _scenarioTitleOverride = (c.scenarioTitle !== fresh) ? c.scenarioTitle : null;
  } else {
    _scenarioTitleOverride = null;
  }
  updateSixLevelsSummary();
  // v8.2.3 (Issue B): when editing, populate the attribute input fields with
  // the BASE (pre-bumps) values. Legacy characters before v8.2.3 don't have
  // c.attrsBase, so we fall back to c.attrs (the legacy semantics treated it
  // as base-with-racial-baked-in, which still works in this populate step).
  const baseForForm = (c.attrsBase && c.attrsBase.length === 6) ? c.attrsBase : c.attrs;
  renderAttrGrid();
  baseForForm.forEach((s,i) => {
    const inp=document.getElementById('a'+i);
    if(inp){inp.value=s;document.getElementById('am'+i).textContent=ms(s)}
  });
  // v8.2.3 (Issue B): restore attribute bumps onto form state. Legacy chars
  // without bumps get an empty array; renderAttrBumpsPanel() will compute the
  // expected size from totalLvl and show empty rows ("pending").
  formAttrBumps = (c.attrBumps && Array.isArray(c.attrBumps)) ? c.attrBumps.slice() : [];
  // v8.2.3 (Issue A): restore HP mode + per-level rolls. Legacy chars without
  // hpRolls keep their stored c.maxHP — no rolls means computeMaxHPFromRolls
  // falls back to the legacy formula, which matches what they were saved with.
  formHpMode = c.hpMode || 'hero';
  setFormHpMode(formHpMode);
  formHpRolls = (c.hpRolls && Array.isArray(c.hpRolls)) ? c.hpRolls.slice() : [];
  // v8.1.1: restore budget state, migrating from legacy characters that lack it.
  // For legacy chars we assume their stored attrs already include racial adj
  // (since that's how the old workflow had them manually entering scores),
  // so racialApplied = their race and baseTotal = sum(attrs) − sum(racial).
  // v8.2.3: when c.attrsBase is available (v8.2.3+ saves), prefer that —
  // it's already pre-bumps and pre-racial-stripping is correct semantics.
  const attrsForBudget = (c.attrsBase && c.attrsBase.length === 6) ? c.attrsBase : c.attrs;
  if (c.attrMethod && c.baseTotal != null) {
    formBudget = { method: c.attrMethod, baseTotal: c.baseTotal, racialApplied: c.racialApplied || '' };
  } else {
    const adj = getRacialAdj(c.race);
    const baseTotal = attrsForBudget.reduce((sum, v, i) => sum + (v - adj[i]), 0);
    formBudget = { method: 'manual', baseTotal, racialApplied: c.race || '' };
  }
  // v8.71.0 (Adam's Hellfire report — the Hybrid adj STACKED on edit-save):
  // the applyRaceAdjustments same-race branch carries a Hybrid exception
  // (reverse the snapshotted parent sum, re-apply the fresh one, so parent
  // swaps work). But this edit-populate path never snapshotted — the
  // updateRaceInfo() below reversed hybridAdjApplied of NULL (zeros) and
  // applied the parent sum AGAIN on top of attrsBase, which already bakes
  // it in. One extra +2 Con/−2 Cha per edit session. Seed the ledger with
  // the parent sum the saved record already carries (the selects were
  // repopulated above, so getRacialAdj reads the real pair); the same-race
  // reverse/re-apply then nets to zero, while parent swaps still work.
  // Non-Hybrids were always safe behind the same-race early-return.
  formBudget.hybridAdjApplied = (c.race === 'Hybrid') ? getRacialAdj('Hybrid') : null;
  // Same hardening, second branch: a record missing c.racialApplied (older
  // saves, imports) restored racialApplied:'' — applyRaceAdjustments would
  // then take the different-race path (reverse '' = zeros, apply on top:
  // the same stack). The inputs were just populated from attrsBase, which
  // by the v8.1.1 convention bakes the race's adj in — so what's applied
  // is, always and exactly, the record's race.
  if (c.race) formBudget.racialApplied = c.race;
  updateRaceInfo();
  renderAttrBudget();
  renderClassList();
  updateClassPreview();
  // v8.1.7 / v8.3.5: restore T/ACtical equipment AC fields. Natural AC is now
  // split into two visible fields (racial / bonus). We reconstruct them from
  // c.naturalACSources if present (v8.3.5+ schema), or fall back to legacy
  // c.naturalAC scalar split-by-race-membership (v8.3.4 and earlier characters).
  const armEl = document.getElementById('c-armor-ac');
  const shEl = document.getElementById('c-shield-ac');
  const ntEl = document.getElementById('c-natural-ac');
  const racialEl = document.getElementById('c-racial-nac');
  const bonusEl = document.getElementById('c-bonus-nac');
  if (armEl) armEl.value = c.armorAC || 0;
  if (shEl) shEl.value = c.shieldAC || 0;
  // Natural AC reconstruction:
  // Preferred (v8.3.5+): walk c.naturalACSources, separate racial (type:'natural')
  // from bonus (type:'enhancement') sources. Racial sum → c-racial-nac;
  // enhancement sum → c-bonus-nac.
  // Legacy (v8.3.4-): racial = RACES[c.race]?.natAC (whatever the race grants);
  // bonus = max(0, c.naturalAC - racial). The migration banner offers to
  // canonicalize this on demand.
  let racialNACEdit = 0, bonusNACEdit = 0;
  if (Array.isArray(c.naturalACSources) && c.naturalACSources.length > 0) {
    for (const s of c.naturalACSources) {
      if (s.type === BONUS_TYPES.NATURAL) racialNACEdit += s.value;
      else if (s.type === BONUS_TYPES.ENHANCEMENT) bonusNACEdit += s.value;
    }
  } else {
    racialNACEdit = racialNatACOf(c);
    bonusNACEdit = Math.max(0, (c.naturalAC || 0) - racialNACEdit);
  }
  if (racialEl) racialEl.value = racialNACEdit;
  if (bonusEl) bonusEl.value = bonusNACEdit;
  // Sync hidden legacy field
  if (ntEl) ntEl.value = racialNACEdit + bonusNACEdit;
  // v8.3.17: existing characters are already committed — gate starts 'locked'.
  // Player can unlock via the Six Scales panel if they want to change scenarios.
  gateState = 'locked';
  applyGateState();
  showPage('create');
}
async function deleteCurrentChar(){
  if(!curId)return;const c=chars.find(x=>x.id===curId);if(!c||!(await confirmModal('Delete '+c.name+'?')))return;
  chars=chars.filter(x=>x.id!==curId);curId=null;save();renderRoster();showPage('roster');toast('Deleted.');
}
function clearForm(){
  editId=null;pbMode=false;
  _createDirty=false;  // v9.16.0 (§276): a fresh form holds nothing unsaved
  try { expandAllCreateSections(); } catch (e) {}  // v8.5.4 ergo C2: fresh start, all sections open
  // v8.4.0: hide the Edit advisory banner — we're back to new-character mode.
  const banner = document.getElementById('edit-advisory-banner');
  if (banner) banner.style.display = 'none';
  // v8.4.0: also hide the Hero's Gift retcon panel.
  const retconPanel = document.getElementById('edit-heroes-gift-retcon');
  if (retconPanel) retconPanel.style.display = 'none';
  formBudget = { method: null, baseTotal: null, racialApplied: '' };
  // v8.2.1: clear the Six Scales snapshot when leaving edit mode. New character
  // creation (editId === null) won't fire the change-confirmation modal.
  editSavedSixLevels = null;
  pendingSixLevelChange = null;
  // v8.3.24: reset scenario-title override so a fresh character starts with
  // an auto-generated title.
  _scenarioTitleOverride = null;
  // v8.2.1: reset occupation picks so a new character starts fresh.
  formOccupationPicks = {primary:{skills:[], bonusFeat:null}, secondary:{skills:[], bonusFeat:null}};
  formOccupationPicksFor = {primary:null, secondary:null};
  // v8.2.3 (Issue A + B): reset HP mode/rolls and attribute bumps.
  formHpMode = 'hero';
  formHpRolls = [];
  setFormHpMode('hero');
  formAttrBumps = [];
  ['c-name','c-player','c-sex','c-allegiance','c-langs','c-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('c-race').value='Human';
  // v8.68.0: clear the Hybrid picker remnants.
  { const _hr = document.getElementById('hybrid-row'); if (_hr) _hr.style.display = 'none';
    for (const hid of ['c-hyb-a','c-hyb-b','c-hyb-rlm','c-hyb-dropped']) { const el = document.getElementById(hid); if (el) el.value = ''; }
    const _hs = document.getElementById('c-hyb-size'); if (_hs) _hs.value = 'a';
    if (typeof formBudget === 'object' && formBudget) formBudget.hybridAdjApplied = null; }
  document.getElementById('c-occ').value='Academic';
  document.getElementById('c-occ2').value='';
  // New characters: occupations are editable (no lock); only an existing edit locks them
  occupationsUnlocked = true;
  document.getElementById('c-occ').style.display = '';
  document.getElementById('c-occ-readonly').style.display = 'none';
  formClasses=[];
  formSubOptions = {clericDomains:[], druidOption:false, saintDomains:[], paladinDomains:[], psionDiscipline:null, wizardSchool:null, wizardProhibited:[], rangerSecrets:[], bardStoryteller:[]}; // v8.5.4
  document.getElementById('c-scenario-preset').value='The Ordinary World';
  applyScenarioPreset();
  document.getElementById('pb-remain').style.display='none';  // (quickdraw-area reset removed with the table, v8.35.0)
  cancelAddClass();
  // v8.1.7 / v8.3.5: reset T/ACtical equipment fields including the split NAC fields
  ['c-armor-ac','c-shield-ac','c-natural-ac','c-racial-nac','c-bonus-nac'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 0;
  });
  renderAttrGrid();updateRaceInfo();renderClassList();updateClassPreview();renderAttrBudget();
  // v8.2.1: re-render picker to show the freshly-defaulted occupation
  renderOccupationPicker('primary');
  renderOccupationPicker('secondary');
  updateOccupationPicksWarning();
  // v8.2.2 (Issue 1): hide Second Occupation row on fresh form (no Moonlighter yet)
  applySecondOccupationVisibility();
  // v8.2.3 (Issue A + B): refresh HP roll preview (will be empty) and attribute
  // bumps panel (will be hidden since formClasses is empty).
  renderHpRollPreview();
  renderAttrBumpsPanel();
  // v8.3.17: Reset gate to 'awaiting' for new characters. Existing characters
  // loaded via the edit flow get gateState='locked' set separately.
  gateState = 'awaiting';
  applyGateState();
}

