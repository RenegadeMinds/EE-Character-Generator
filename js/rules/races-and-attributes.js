// =============================================================================
// js/rules/races-and-attributes.js
// RACES AND ATTRIBUTES — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Races, hybrids, size and effective attribute scores.
//
// KEY NAMES (so you can search for them)
//   functions (22): attrItemBonuses, reconcileTalentAttrBakes,
//   suBakedPerAttr, effAttrs, effAm, hybridInfo, hasHalfAgain, raceEclOf,
//   raceKeyForSize, racialNatACOf, raceDisplayOf, isHumanParented,
//   buildRacialBonusesFor, raceSizeIndex, raceACSizeMod, effectiveSizeIndex,
//   buildAttributeBonus, buildRacialNaturalACSource, buildRacialBonuses,
//   getRacialAdj, _hybridEligibleRaces, bumpCountForLevel
//
// WHERE IT CAME FROM
//   Gathered from js/app/43-create-attributes-race-occupation.js,
//   js/app/46-create-preview-and-defense.js, js/rules/09-item-effects-and-
//   buffs.js, js/rules/14-resistances-speed-dr-size.js, js/rules/19-bonus-
//   aggregator-and-stat-block.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Best equipped enhancement per attribute (non-stacking) + provenance labels.
function attrItemBonuses(c) {
  const best = [0, 0, 0, 0, 0, 0], from = [null, null, null, null, null, null];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'magic' || !it.equipped) continue;
    const fx = MAGIC_ITEM_EFFECTS[it.ref];
    if (!fx || !fx.attr) continue;
    const i = ATTR_KEY_IDX[fx.attr];
    const v = magicItemEffectValue(it, fx);
    if (i !== undefined && v > best[i]) { best[i] = v; from[i] = `${it.ref} +${v}`; }
  }
  return { best, from };
}
function reconcileTalentAttrBakes(c) {
  if (!c || !Array.isArray(c.attrs)) return false;
  let changed = false;
  for (const te of (c.talents || [])) {
    const spec = TALENT_ATTR_BAKES[te.name];
    if (spec && !te.attrApplied) { c.attrs[spec.idx] += spec.value; te.attrApplied = spec.value; te.attrKey = spec.attr; changed = true; }
  }
  return changed;
}
// The per-attribute SUPERNATURAL total currently baked in — what a Null
// Power Field strips: the Supernatural [Attribute] mutation chain + Su
// talent bakes. (Extraordinary bakes are never nullified.)
function suBakedPerAttr(c) {
  const out = [0, 0, 0, 0, 0, 0];
  for (const m of (c && c.mutations || [])) {
    if (m.attrApplied && /^Supernatural/.test(m.name || '') && ATTR_KEY_IDX[m.attr] !== undefined) out[ATTR_KEY_IDX[m.attr]] += m.attrApplied;
  }
  for (const te of (c && c.talents || [])) {
    const spec = TALENT_ATTR_BAKES[te.name];
    if (spec && spec.su && te.attrApplied) out[spec.idx] += te.attrApplied;
  }
  return out;
}
function effAttrs(c) {
  const base = (c && c.attrs) || [10, 10, 10, 10, 10, 10];
  const b = attrItemBonuses(c).best;
  const nullSub = (c && c.nullified) ? suBakedPerAttr(c) : null;
  const out = base.map((v, i) => (v || 10) + b[i] - (nullSub ? nullSub[i] : 0));
  // v8.43.0: transient wired-buff attribute boosts (Animal Affinity, Iron
  // Body, the size pair…) — typed against the item door inside the helper;
  // NPF-suppressed there too. Every effAttrs consumer (attack Str, skills,
  // caster DCs, sheet boxes) inherits, exactly like the item door.
  {
    const _bd = activeBuffAttrDeltas(c);
    for (let i = 0; i < 6; i++) out[i] += _bd[i];
  }
  if (c && c.raging) { const t = rageTier(c); if (t) { out[0] += t.attr; out[2] += t.attr; } }
  if (c && c.fatigued && !c.raging) { out[0] -= 2; out[1] -= 2; }
  // v8.10.1: the Heavy's RKCM implant — +4 EQUIPMENT Dexterity (tech, not
  // Su: unaffected by ⊘ Nullified; lost while the RKCM is damaged — GM
  // toggles via c.rkcmDamaged).
  if (c && !c.rkcmDamaged && migrateLegacyClasses(c).some(e => e.name === 'Heavy' && (e.level || 0) >= 1)) out[1] += 4;
  // v8.14.x Segment B (Adam's ruling; FF p.618): equipped power armor —
  // Str (Min) is a FLOOR ("the wearer uses the armor's Strength or their
  // own, whichever is greater"), Dex (Max) a CEILING ("whichever is lower").
  // Firm-wired: flows to melee, Carry, Jump, Reflex, AC, Initiative, skills.
  // Tech, not Su — unaffected by ⊘ Nullified. The Land Warrior's HH-era
  // idiom is +2 EQUIPMENT Str instead of a floor.
  if (c) {
    const _paIt = equippedPowerArmor(c);
    if (_paIt) {
      const _pa = POWER_ARMOR_DB[_paIt.ref];
      if (_pa.equipStrMod) out[0] += _pa.equipStrMod;
      if (_pa.strMin) out[0] = Math.max(out[0], _pa.strMin);
      if (_pa.dexMax) out[1] = Math.min(out[1], _pa.dexMax);
    }
  }
  // v8.50.0: GENERAL ATTRIBUTE DAMAGE (Ego Whip, a Shadow's touch, poison —
  // HH "Ability Damage" / the "Ability Damaged" condition): temporary, full
  // effect, NO half-floor (that dignity line is horror-only), heals 1 per
  // evening of rest. Applied BEFORE the horror clamp, so a frayed mind
  // floors at half of its CURRENT (damaged) normal. Ability DRAIN is
  // permanent — edit the attribute itself.
  if (c && Array.isArray(c.attrDmg)) {
    for (let i = 0; i < 6; i++) out[i] -= (c.attrDmg[i] || 0);
  }
  // v8.49.0 (Adam's HALF-FLOOR ruling, 2026-09-28): horror-born mental
  // damage frays performance but never lobotomizes — the PLAYED mental
  // attribute never falls below half its normal (post-door) value, rounded
  // up, while the full damage total still runs the break clock against the
  // base score inside the Mind's Ledger. "The mind never functions below
  // half until it breaks."
  if (c && c.mind && Array.isArray(c.mind.mdmg)) {
    for (let k = 0; k < 3; k++) {
      const d = c.mind.mdmg[k] || 0;
      if (d > 0) out[3 + k] = Math.max(out[3 + k] - d, Math.ceil(out[3 + k] / 2));
    }
  }
  return out;
}
function effAm(c, i) { return am(effAttrs(c)[i]); }
// ============================================================================
// v8.68.0 (Adam's simple model) — THE HYBRID RESOLVER. c.hybrid =
// {a, b, sizeFrom:'a'|'b', rlmOverride?, dropped?}. One resolver; the racial
// consumers each route through it: ECL/RLM, size+movement (ONE parent),
// racial bonuses/resist/immunities/SR/DR/bonusPP/feat+weapon grants (UNION
// of both parents — "all racial abilities of both"; best-wins engines
// reconcile overlaps), attribute adjustments (A + B, applied at creation).
function hybridInfo(c) {
  if (!c || c.race !== 'Hybrid' || !c.hybrid || !c.hybrid.a || !c.hybrid.b) return null;
  const h = c.hybrid;
  // v9.0.0 (the Half-Again egg): Half-Again × Half-Again is no hybrid at
  // all — refuse; and Half-Again has no size or speed of its own, so the
  // size parent is ALWAYS the real race, whichever slot the egg landed in.
  if (h.a === 'Half-Again' && h.b === 'Half-Again') return null;
  const A = RACES[h.a] || {}, B = RACES[h.b] || {};
  const auto = (A.ecl || 0) + (B.ecl || 0) + 1;
  const rlm = (h.rlmOverride === 0 || h.rlmOverride) ? h.rlmOverride : auto;
  let sizeFrom = h.sizeFrom === 'b' ? h.b : h.a;
  if (sizeFrom === 'Half-Again') sizeFrom = (h.a === 'Half-Again') ? h.b : h.a;
  return { a: h.a, b: h.b, A, B, sizeFrom, rlm, autoRlm: auto, dropped: h.dropped || '' };
}
// v9.0.0: the egg’s predicate — a Half-Again parent in either slot.
function hasHalfAgain(c) {
  const hy = hybridInfo(c);
  return !!(hy && (hy.a === 'Half-Again' || hy.b === 'Half-Again'));
}
function raceEclOf(c) { const hy = hybridInfo(c); return hy ? hy.rlm : ((RACES[(c && c.race)] || {}).ecl || 0); }
function raceKeyForSize(c) { const hy = hybridInfo(c); return hy ? hy.sizeFrom : (c && c.race); }
function racialNatACOf(c) {
  const hy = hybridInfo(c);
  if (hy) return Math.max(hy.A.natAC || 0, hy.B.natAC || 0);
  return (RACES[(c && c.race)] || {}).natAC || 0;
}
function raceDisplayOf(c) { const hy = hybridInfo(c); return hy ? `Hybrid (${hy.a} / ${hy.b})` : ((c && c.race) || ''); }
// v8.70.1 (Adam's Hero's-Gift catch exposed it): the Human racial bonuses
// (feat slot, per-level SP) belong to Human-PARENTED Hybrids too — "all
// racial abilities of both parents." One predicate, every consumer.
function isHumanParented(c) {
  if (!c) return false;
  if (c.race === 'Human') return true;
  const hy = hybridInfo(c);
  return !!(hy && (hy.a === 'Human' || hy.b === 'Human'));
}
function buildRacialBonusesFor(c) {
  const hy = hybridInfo(c);
  if (!hy) return buildRacialBonuses((c && c.race) || '');
  const A = buildRacialBonuses(hy.a) || {}, B = buildRacialBonuses(hy.b) || {};
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) out[k] = [...(A[k] || []), ...(B[k] || [])];
  return out;
}

function raceSizeIndex(c) {
  // v8.16.0 Races pass: the structured size field governs ('S' Small, 'L'
  // Large); the notes regex stays as the legacy fallback.
  // v8.68.0: Hybrids read the chosen size parent.
  const r = RACES[raceKeyForSize(c)] || {};
  if (r.size === 'S') return 3;
  if (r.size === 'L') return 5;
  return /\bSmall\b/.test(r.notes || '') ? 3 : 4;
}
// AC/attack size modifier from the race's base size (+1 Small, −1 Large —
// d20 size table; larger steps are Foe Folio territory). c.sizeMod, when a
// GM sets it, overrides.
function raceACSizeMod(c) {
  const idx = raceSizeIndex(c);
  return idx === 3 ? 1 : idx === 5 ? -1 : 0;
}
// Effective size index for natural dice / grappling / Jump — race base plus
// one category per Strong super-talent owned (Su: zero while nullified).
// v9.0.0 (the Half-Again egg): Powerful Build adds one category here too —
// racial and EXTRAORDINARY, so it stands through a Null Power Field. Actual
// size (AC/attack mods, Hide, reach display) stays the size parent's.
function effectiveSizeIndex(c) {
  const steps = c.nullified ? 0 : strongSuperTalentsOwned(c).length;
  const pb = (hasHalfAgain(c)) ? 1 : 0;
  return Math.min(SIZE_LADDER.length - 1, raceSizeIndex(c) + steps + pb);
}

// Build attribute-modifier bonus entries. Each attribute modifier (CON, DEX, WIS, etc.)
// becomes one bonus entry with type:'ability' and source:'ability:<NAME>'. The aggregator
// will sum these (ability self-stacks since each attribute is a unique source).
function buildAttributeBonus(attrName, modValue) {
  return {type:BONUS_TYPES.ABILITY, source:`ability:${attrName}`, value:modValue, label:`${attrName} modifier`};
}

// ========== SOURCED VALUES — NATURAL AC (v8.3.5) ==========
//
// Natural AC was a scalar (`c.naturalAC`) in v8.3.4 and earlier. Per d20
// lineage rules, multiple natural-armor bonuses from different sources don't
// simply sum: same-type sources resolve "best wins" (e.g., a Drakkin's +5
// racial natural armor doesn't stack with a polymorph effect granting +7;
// you take the +7). Natural armor ENHANCEMENT (type:'enhancement') stacks
// with base natural armor (type:'natural') but not with other enhancement
// natural-armor sources (e.g., Amulet of Natural Armor +2 plus Barkskin +3
// → take the +3 enhancement, not 5).
//
// v8.3.5 promotes natural AC from a scalar to a SOURCED VALUE: a list of
// typed bonus entries, resolved via the existing aggregateBonuses() function
// which already implements the correct same-type / cross-type semantics.
//
// SourcedValue schema (a list of these, stored as c.naturalACSources):
//   {type, source, value, label, condition?}
// matching the standard bonus-list shape used throughout the engine.
//
// Backward compat: if c.naturalACSources is missing/empty but c.naturalAC > 0
// (legacy v8.3.4 character), we synthesize a single entry tagged
// 'legacy:naturalAC' so the value continues to work. Migration is handled
// at sheet-render time (offers to split the legacy scalar into racial vs.
// bonus components based on the race's natAC data).

// Construct a bonus entry for a race's racial natural AC. Used during
// character creation and during racial-NAC migration. Returns null if the
// race has no natural AC. The bonus is type:'natural' (best-of-type stacking),
// source-tagged by race name.
function buildRacialNaturalACSource(raceName) {
  const r = RACES[raceName];
  const v = r?.natAC || 0;
  if (v <= 0) return null;
  return {
    type: BONUS_TYPES.NATURAL,
    source: `race:${raceName}`,
    value: v,
    label: `${raceName} racial natural armor`,
  };
}

// Build racial-trait bonus entries from a race name. Currently this taps the
// existing RACES table's `adj` (ability adjustments) and `traits` (if present, an
// optional structured array for conditional bonuses, populated in v8.0+ as we
// transcribe race trait text). Ability adjustments don't go here — they apply
// to the raw attribute scores at character creation, not as derived-stat bonuses.
// `traits` entries: {type, value, target, condition?} — produces typed bonuses
// targeted at a specific stat key.
function buildRacialBonuses(raceName) {
  const r = RACES[raceName];
  const out = {};  // keyed by target stat
  if (!r || !r.traits) return out;
  for (const t of r.traits) {
    const target = t.target;
    if (!target) continue;
    (out[target] = out[target] || []).push({
      type:t.type, source:`race:${raceName}`, value:t.value,
      condition:t.condition || null, label:t.label || `${raceName} racial`,
    });
  }
  return out;
}
// v8.35.0 (Adam): quickdrawToggle/applyQD RETIRED with the table (see the
// §III markup note). The 'quickdraw' method label survives below so records
// created under it keep displaying their provenance.

// ========== ATTRIBUTE BUDGET & RACIAL ADJUSTMENT (v8.1.1) ==========

// Get the currently-applied racial adjustment map for the named race.
// Returns an array of 6 ints (one per attribute), all zero if race has no adj.
function getRacialAdj(raceName){
  // v8.68.0: a Hybrid's adjustments are the SUM of both parents' (all
  // racial abilities of both — Adam's simple model), read from the form.
  if (raceName === 'Hybrid') {
    const a = document.getElementById('c-hyb-a')?.value || '';
    const b = document.getElementById('c-hyb-b')?.value || '';
    const aj = (RACES[a] || {}).adj || {}, bj = (RACES[b] || {}).adj || {};
    return ATTR_NAMES.map(n => (aj[n] || 0) + (bj[n] || 0));
  }
  const r = RACES[raceName];
  const adj = (r && r.adj) || {};
  return ATTR_NAMES.map(n => adj[n] || 0);
}
function _hybridEligibleRaces() {
  return HYBRID_HUMANOID_RACES.filter(n => RACES[n]).sort();
}

// v8.2.3 (Issue B): How many bumps does a character of `totalLvl` get?
// HH p.879: every 4th level → at levels 4, 8, 12, 16, 20.
function bumpCountForLevel(totalLvl) {
  return Math.floor(Math.max(0, totalLvl) / 4);
}
