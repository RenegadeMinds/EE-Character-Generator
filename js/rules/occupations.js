// =============================================================================
// js/rules/occupations.js
// OCCUPATIONS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Starting occupations: lookups, bonuses and occupation bonus
//   feats.
//
// KEY NAMES (so you can search for them)
//   functions (3): reconcileOccupationBonusFeats, buildOccupationBonuses,
//   getOccupationData
//
// WHERE IT CAME FROM
//   Gathered from js/app/43-create-attributes-race-occupation.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Refresh the read-only display text from the underlying selects
// v8.2.1: Reconcile a character's c.feats with their occupationPicks.bonusFeat
// values. Called from saveCharacter() after the merge with prior data, so:
//   - On first save: c.feats is freshly empty, we add the picked bonus feat(s).
//   - On edit: c.feats may contain a stale occupation feat from a prior pick;
//     we strip all origin='occupation:*' feats and re-add the current picks.
// The origin tag lets the sheet's feat display distinguish granted feats from
// player-picked ones, and lets us safely round-trip across edits.
function reconcileOccupationBonusFeats(char){
  if (!char.feats) char.feats = [];
  // Strip prior occupation-origin feats
  char.feats = char.feats.filter(f => !(f.origin && /^occupation:/.test(f.origin)));
  // Add current picks back
  const slots = ['primary', 'secondary'];
  const occNames = char.occupations || (char.occ ? [char.occ] : []);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const occName = occNames[i] || null;
    const picks = (char.occupationPicks && char.occupationPicks[slot]) || null;
    if (!occName || !picks || !picks.bonusFeat) continue;
    // De-duplicate against existing entries (in case the player also picked
    // the same feat through the normal feat browser).
    const already = char.feats.some(f => (f.name||f.n) === picks.bonusFeat);
    if (!already) {
      char.feats.push({
        name: picks.bonusFeat,
        origin: 'occupation:' + occName,
      });
    } else {
      // Already on the list — tag the existing entry with the occupation
      // origin so the audit trail still reflects that it was granted (the
      // player may have picked the same feat through the browser too, but
      // it's harmless to credit the occupation as a source either way).
      const existing = char.feats.find(f => (f.name||f.n) === picks.bonusFeat);
      if (existing && !existing.origin) existing.origin = 'occupation:' + occName;
    }
  }
}

// v8.2.1: Build per-skill competence bonuses from a character's occupation picks.
//
// PER HANDBOOK (HH p.34-43): each occupation lets the player pick N skills as
// permanent class skills. If a picked skill is ALREADY a class skill via
// another route (any class on the character), it instead grants a +1
// competence bonus on checks with that skill.
//
// This function returns a {target: [bonus]} map structured the same way as
// buildFeatBonuses(char), ready to be merged into the per-skill bonus
// aggregation pipeline.
//
// STATUS: This builder is fully implemented but currently UNCONSUMED. The
// renderSkills() function shows a hardcoded `0` in the Misc column rather
// than aggregating skill:X bonuses — feat skill bonuses (Acrobatic +2 Jump,
// Athletic +2 Climb, etc.) face the same gap. When the skills renderer is
// upgraded to consume per-skill bonuses (a future polish slice), it should
// call BOTH buildFeatBonuses() and buildOccupationBonuses() and merge their
// skill:* entries. This builder produces the correct contributions today;
// it's the consumer that's missing.
function buildOccupationBonuses(char) {
  const out = {};
  if (!char || !char.occupationPicks) return out;
  const slots = ['primary', 'secondary'];
  const occNames = char.occupations || (char.occ ? [char.occ] : []);
  // We need to know whether each picked skill is ALREADY a class skill via
  // another route. The cleanest way is to temporarily zero out occupationPicks
  // on a shallow copy of the character, then ask isClassSkill — that way the
  // picks themselves don't satisfy the check. (Otherwise every pick would
  // trivially be "already a class skill via the pick itself".)
  const charSansPicks = Object.assign({}, char, {occupationPicks: null});
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const occName = occNames[i] || null;
    const picks = char.occupationPicks[slot];
    if (!occName || !picks || !picks.skills) continue;
    for (const pick of picks.skills) {
      if (!pick) continue;
      // For compound picks like "Knowledge (Arcane Lore, Streetwise, ...)",
      // we expand to each sub-skill and check that one individually. For
      // simple picks like "Computer Use", we check the pick directly.
      const compound = pick.match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
      const skillsToCheck = compound
        ? compound[2].split(',').map(s => `${compound[1].trim()} (${s.trim()})`)
        : [pick];
      for (const skill of skillsToCheck) {
        if (isClassSkill(skill, charSansPicks)) {
          // The pick overlaps with an existing class skill → grant +1 competence
          const target = 'skill:' + skill;
          (out[target] = out[target] || []).push({
            type: 'competence',
            source: `occupation:${occName}:${skill}`,
            value: 1,
            condition: null,
            label: `${occName} (Starting Occupation)`,
          });
        }
      }
    }
  }
  return out;
}

function getOccupationData(name){
  if (!name) return null;
  return OCCUPATIONS_DB.find(o => o.n === name) || null;
}
