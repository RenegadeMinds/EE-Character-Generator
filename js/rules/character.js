// =============================================================================
// js/rules/character.js
// CHARACTER — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Character-record housekeeping: save-format versions and Hero's
//   Gift checks.
//
// KEY NAMES (so you can search for them)
//   functions (3): isLegacyCharacter, scanHerosGiftRetconCompliance,
//   reconcileHerosGiftFold
//
// WHERE IT CAME FROM
//   Gathered from js/app/47-save-character.js, js/app/48-roster-and-
//   export.js when the code was regrouped by topic and page. Each function
//   and table moved whole and unchanged, with the comments above it,
//   including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function isLegacyCharacter(c) {
  return !c || (c.schemaVer || 0) < CURRENT_SCHEMA_VER;
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
  {
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
  {
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
// ========== ROSTER ==========
// v8.30.1 (Adam's Heinrix report): strip class sub-option fields whose owning
// class has no levels on the record — the backtracked-class-pick bug stamped
// orphaned Saint domains onto a Charismatic Hero at creation (fixed at the
// source in saveCharacter the same version; this heals records saved before
// the fix). Idempotent; returns true when it changed anything. NOTE: none of
// these fields are legitimately class-less — the Heritage feats deliberately
// grant BASE lists only (ruled + ratified 2026-09-23), and the Druid-variant
// Heritage pick rides the contributor's _heritageChoice, not c.druidOption.
// v9.19.0 (old-boys report #3 — the lingering Hero's Gift dot): when a
// Hero-classed character's gift is unassigned but their feat books are OVER
// the slotted budget, a conforming owned feat IS the gift in all but name —
// recognize it (Adam's ruling: "assuming the selected feats conform to the
// limitations... be considered as having effectively been selected").
// Conformity = any FEATS_DB feat that isn't class/mutation-granted, isn't
// occupation-locked, and isn't already accounted to another L1 slot (the
// herosGift slot is Heritage-ELIGIBLE, i.e. accepts any non-occupation
// feat — slotAcceptsFeat). Folds at most ONCE per record (c.hgFoldDone),
// so a later deliberate retcon to Unassigned is never fought. When the
// books are EXACTLY balanced the gift is a genuinely unclaimed bonus pick —
// no fold; the Feats tab's claim card (same version) walks the player to it.
function reconcileHerosGiftFold(c){
  if (!c || isLegacyCharacter(c) || c.hgFoldDone) return false;
  if (c.heroesGiftChoice !== null && c.heroesGiftChoice !== undefined) return false;
  if (!(c.classes || []).some(e => e.tier === 'hero')) return false;
  let fb; try { fb = getFeatBudget(c); } catch (e) { return false; }
  if (!fb || (fb.picked || 0) <= (fb.total || 0)) return false;
  const slotFilled = new Set((c.firstLevelSlots || []).map(s => s.filled).filter(Boolean));
  const cand = (c.feats || []).find(f => {
    const nm = f.name || f.n; if (!nm) return false;
    if (f.grantedBy || (f.origin && /^occupation:/.test(f.origin))) return false;
    if (slotFilled.has(nm)) return false;
    return !!getFeatData(nm);
  });
  if (!cand) return false;
  c.heroesGiftChoice = 'feat';
  c.hgFoldDone = true;
  if (!Array.isArray(c.firstLevelSlots)) c.firstLevelSlots = [];
  if (!c.firstLevelSlots.some(s => s.kind === 'herosGift')) c.firstLevelSlots.push({kind:'herosGift', filled:null, filledParam:null});
  const slot = c.firstLevelSlots.find(s => s.kind === 'herosGift');
  if (slot && slot.filled === null) { slot.filled = cand.name || cand.n; slot.filledParam = cand.param || null; }
  if (c.id === curId) logAct(`🎁 Hero's Gift recognized: ${cand.name || cand.n} counts as the Hero's Gift feat — the books balance.`);
  return true;
}
