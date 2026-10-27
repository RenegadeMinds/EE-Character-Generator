// =============================================================================
// js/rules/19-bonus-aggregator-and-stat-block.js
// BONUS AGGREGATOR AND STAT BLOCK
// =============================================================================
//
// WHAT'S IN HERE
//   The bonus engine: bonus types and stacking rules (GM's Guide pp.22-23),
//   natural armor sources, racial bonuses, the full stat block
//   (computeStatBlock, computeStatsFromClasses), and the conditions reference
//   (CONDITIONS_DATA).
//
// KEY NAMES (so you can search for them)
//   tables/objects: BONUS_TYPES, STACKING_RULES, CONDITION_TIER_STYLE,
//   CONDITIONS_DATA, COMMON_CONDITIONS
//   functions (13): aggregateBonuses, buildClassBonuses,
//   buildClassFeatureRepBonuses, buildAttributeBonus,
//   buildRacialNaturalACSource, computeNaturalAC,
//   renderSourcedValueProvenance, buildRacialBonuses, computeStatBlock,
//   verifyParity, classStatAt, chaModClamped, computeStatsFromClasses
//
// LOAD ORDER
//   File 19 of 68. index.html loads it after js/rules/18-companions.js and
//   before js/rules/20-scenario-titles-and-heroic-resources.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 13984-15000 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 13984-15000; unchanged below this line ----
// Compute total stats for given hero+basic class+levels combination.
// Hero class entries have only 10 levels in their tables; Basic classes have 20.
// For levels beyond the table length, the highest available value is used (graceful handling
// of multiclass cases above class-specific level cap, though normally levels stay ≤10/20).
// ========================================================================
// v8 BONUS AGGREGATOR SYSTEM (Modifier Types per GM's Guide pp. 22-23)
// ------------------------------------------------------------------------
// Every computed stat (BAB, saves, AC, skill totals, etc.) is built from a
// list of typed "bonus contributions". Each contribution is:
//   {type, source, value, target?, condition?}
// where:
//   type      — one of the 18 modifier types from BONUS_TYPES below
//   source    — string identifier for the bonus's origin (e.g. 'class:Fighter:5',
//               'race:Stone Giant', 'feat:Iron Will', 'spell:Bull's Strength')
//   value     — signed integer (negative = penalty)
//   target    — optional: the stat key this bonus applies to (used when bonuses
//               are stored in a flat list rather than pre-bucketed)
//   condition — optional string; if present, the bonus only applies when that
//               condition is "active" (e.g. 'rocky terrain', 'vs poison',
//               'while raging'). Always-on bonuses have no condition.
//
// Stacking rules (GM's Guide p.22-23):
//   - Bonuses from different SOURCES of different TYPES stack
//   - Same-TYPE bonuses don't stack — only the best positive AND worst negative apply
//   - Same-SOURCE bonuses don't stack regardless of type (e.g. two castings
//     of Bull's Strength: both are enhancement type AND same source, so only
//     one applies — and the dispel-magic case is preserved because both
//     instances exist on the character, just not both contributing)
//   - Three types DO self-stack: Dodge, Circumstance, Untyped
//
// "Same source" is interpreted strictly: the source string must match exactly.
// This means two different feats both granting +1 untyped to Fort have
// different sources ('feat:Iron Will' vs 'feat:Lightning Reflexes') and both
// apply (untyped self-stacks). But two castings of Bull's Strength both have
// source 'spell:Bulls Strength' so they collapse to one.
// ========================================================================
const BONUS_TYPES = {
  ALCHEMICAL:   'alchemical',
  ARMOR:        'armor',
  CIRCUMSTANCE: 'circumstance',
  COMPETENCE:   'competence',
  DEFLECTION:   'deflection',
  DODGE:        'dodge',
  ENHANCEMENT:  'enhancement',
  EQUIPMENT:    'equipment',
  INSIGHT:      'insight',
  LUCK:         'luck',
  MORALE:       'morale',
  NATURAL:      'natural',         // natural armor
  PROFANE:      'profane',
  RACIAL:       'racial',
  RESISTANCE:   'resistance',
  SACRED:       'sacred',
  SHIELD:       'shield',
  SIZE:         'size',
  SYNERGY:      'synergy',        // v8.3.9: 5+ ranks in skill X → +2 to related skill Y. Different sources stack.
  TECH:         'tech',           // v8.92.0 (Adam's ruling): cybernetic subq body armor = a TECH bonus to Natural AC — stacks with biological natural armor, best-of-type among tech sources, and feeds the ×5-HP rule like any other permanent NAC.
  MUTATION:     'mutation',       // DEPRECATED (Adam's ruling 2026-09-01): Advantages are EXTRAORDINARY (Ex) modifiers, not a "mutation" stacking type — their bonuses are untyped-Ex (different sources stack; the book's "+N mutation bonus" phrasing names the Ex category, not a stacking type). Constant retained for data compatibility only.
  UNTYPED:      'untyped',
  // Internal types not in the GM's table but mechanically distinct in the engine:
  ABILITY:      'ability',         // attribute modifier (STR/DEX/CON/INT/WIS/CHA)
  CLASS:        'class',           // class progression contribution (effectively untyped, unique-by-source)
  BASE:         'base',            // hardcoded base values (e.g. the 10 in AC = 10 + Dex + …)
};
// Per-type stacking flags. Types not in this map default to non-stacking.
const STACKING_RULES = {
  // Self-stacking types (sum within type after source-dedupe)
  [BONUS_TYPES.CIRCUMSTANCE]: {selfStacks:true,  touchAC:'possibly'},
  [BONUS_TYPES.DODGE]:        {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.UNTYPED]:      {selfStacks:true,  touchAC:true},
  // v8.3.9: Synergy bonuses (e.g. 5+ ranks in Bluff → +2 to Diplomacy) self-stack
  // when they come from different source skills. The d20 lineage convention is
  // that you can't take the SAME synergy twice (which is automatic — each
  // source-skill entry is unique by name), but two synergies into the same
  // target skill from two different source skills both apply.
  [BONUS_TYPES.SYNERGY]:      {selfStacks:true,  touchAC:'na'},
  // Class & ability contributions are unique-by-source by construction, so
  // "self-stacking" is moot — they simply sum since each source appears once.
  [BONUS_TYPES.CLASS]:        {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.ABILITY]:      {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.BASE]:         {selfStacks:true,  touchAC:true},
  // Equipment is "possibly" — the GM's Guide notes it depends on the equipment.
  // We default to non-stacking, with override available via the Equipment subsystem (v9+).
  [BONUS_TYPES.EQUIPMENT]:    {selfStacks:false, touchAC:false},
  // The rest — non-stacking by default
  [BONUS_TYPES.ALCHEMICAL]:   {selfStacks:false, touchAC:'na'},
  [BONUS_TYPES.ARMOR]:        {selfStacks:false, touchAC:false},
  [BONUS_TYPES.COMPETENCE]:   {selfStacks:false, touchAC:true},
  [BONUS_TYPES.DEFLECTION]:   {selfStacks:false, touchAC:true},
  [BONUS_TYPES.ENHANCEMENT]:  {selfStacks:false, touchAC:false},
  [BONUS_TYPES.INSIGHT]:      {selfStacks:false, touchAC:true},
  [BONUS_TYPES.LUCK]:         {selfStacks:false, touchAC:true},
  [BONUS_TYPES.MORALE]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.NATURAL]:      {selfStacks:false, touchAC:false},
  [BONUS_TYPES.PROFANE]:      {selfStacks:false, touchAC:true},
  [BONUS_TYPES.RACIAL]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.RESISTANCE]:   {selfStacks:false, touchAC:'na'},
  [BONUS_TYPES.SACRED]:       {selfStacks:false, touchAC:true},
  [BONUS_TYPES.SHIELD]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.SIZE]:         {selfStacks:false, touchAC:true},
};

// Aggregate a bonus list into a total with introspection breakdown.
// activeConditions: optional Set of strings; entries with a `condition` only
// apply if their condition is in this set. Unconditional entries always apply.
// Returns {total, breakdown:{applied:[...], superseded:[...], inactive:[...]}}.
function aggregateBonuses(bonusList, activeConditions) {
  bonusList = bonusList || [];
  activeConditions = activeConditions || new Set();
  // Step 1: split into active vs. inactive (conditional and not currently triggered)
  const active = [];
  const inactive = [];
  for (const b of bonusList) {
    if (b.condition && !activeConditions.has(b.condition)) inactive.push(b);
    else active.push(b);
  }
  // Step 2: group active bonuses by type
  const byType = {};
  for (const b of active) {
    const t = b.type || BONUS_TYPES.UNTYPED;
    (byType[t] = byType[t] || []).push(b);
  }
  // Step 3: per-type reduction with same-source dedup
  const applied = [];
  const superseded = [];
  let total = 0;
  for (const t in byType) {
    let entries = byType[t];
    // v8.5.4: per-entry stacking override. The Scale-0 class variants
    // (Ranger's Nature's Secrets, Bard's Storyteller) grant competence
    // bonuses whose text EXPLICITLY self-stacks ("multiple instances …
    // stack with each other", "stacking with other competence bonuses") —
    // a deliberate rules exception to the same-type non-stacking rule.
    // Entries flagged stacksAnyway:true always sum (post source-dedup) and
    // never suppress — or get suppressed by — their type-mates.
    const overrides = entries.filter(e => e.stacksAnyway);
    if (overrides.length) {
      for (const e of overrides) { total += e.value; applied.push(e); }
      entries = entries.filter(e => !e.stacksAnyway);
      if (!entries.length) continue;
    }
    // Same-source dedup: within this type, keep only one entry per source
    // (use the highest-magnitude — though typically same-source-same-type is by definition the same value).
    const bySource = {};
    for (const e of entries) {
      const s = e.source || 'unknown';
      if (!bySource[s] || Math.abs(e.value) > Math.abs(bySource[s].value)) bySource[s] = e;
    }
    const deduped = Object.values(bySource);
    const rule = STACKING_RULES[t] || {selfStacks:false};
    if (rule.selfStacks) {
      // Sum all (post source-dedup)
      for (const e of deduped) { total += e.value; applied.push(e); }
    } else {
      // Best positive + worst negative both apply (per GM's Guide stacking note)
      let bestPos = null, worstNeg = null;
      for (const e of deduped) {
        if (e.value >= 0) { if (!bestPos || e.value > bestPos.value) bestPos = e; }
        else              { if (!worstNeg || e.value < worstNeg.value) worstNeg = e; }
      }
      for (const e of deduped) {
        if (e === bestPos || e === worstNeg) { total += e.value; applied.push(e); }
        else superseded.push(e);
      }
    }
  }
  return {total, breakdown:{applied, superseded, inactive}};
}

// Build a typed bonus list for the standard combat stats from a class array.
// Each class level contributes one entry per stat type, tagged as type:'class'
// with source='class:<name>:<lvl>' so each is unique-by-source and they sum cleanly.
// We bundle each class's full progression at its current level into a single bonus
// per stat — fewer entries, cleaner introspection ("Fighter Lvl 5 contributed +5 BAB").
function buildClassBonuses(classArr) {
  classArr = classArr || [];
  const out = {bab:[], def:[], fort:[], ref:[], will:[], rep:[]};
  for (const e of classArr) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    if (lvl <= 0) continue;
    const tierLabel = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier] || '?';
    const src = `class:${e.name}:${lvl}`;
    const tag = `${e.name} Lvl ${lvl} (${tierLabel})`;
    for (const k of ['bab','def','fort','ref','will','rep']) {
      const v = classStatAt(cls, lvl, k);
      if (v !== 0) out[k].push({type:BONUS_TYPES.CLASS, source:src, value:v, label:tag});
    }
  }
  return out;
}

// v8.64.0 (Phase 2 class-features sift): class-feature REPUTATION bonuses —
// the same typed door as the Renown feat's {target:'rep', value:3}. The
// paired Wealth halves stay MANUAL by doctrine (Wealth is a snapshot).
function buildClassFeatureRepBonuses(char) {
  const L = (n) => migrateLegacyClasses(char).filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  const out = [];
  if (L('Bard') >= 19) out.push({ type: 'untyped', source: 'classFeature:Magnum Opus', value: 3, label: 'Magnum Opus (Bard 19 — Renown-equivalent; +2 circumstance on Cha skills with those who know the ballad, at the table)' });
  if (L('Aristocrat') >= 19) out.push({ type: 'untyped', source: 'classFeature:Land & Title', value: 1, label: 'Land & Title (Aristocrat 19 — the +4 Wealth and Steward are manual)' });
  if (L('Personality') >= 4) out.push({ type: 'untyped', source: 'classFeature:A-Lister', value: 1, label: 'A-Lister (Personality 4 — the +2 Wealth is manual)' });
  if (L('Personality') >= 8) out.push({ type: 'untyped', source: 'classFeature:Royalty', value: 1, label: 'Royalty (Personality 8 — the +2 Wealth and entourage are manual)' });
  return out;
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

// Compute the character's effective natural AC from c.naturalACSources,
// applying per-type stacking rules via the existing aggregator. Returns
// {total, breakdown, sources} where:
//   total:     the effective single number to use in AC calculations
//   breakdown: {applied:[...], superseded:[...], inactive:[...]} — used for
//              the provenance tooltip on the Nat. AC stat cell
//   sources:   the raw source list (for source-management operations like
//              add/remove)
//
// Legacy fallback: a character with c.naturalAC > 0 but no c.naturalACSources
// is treated as having one synthetic 'legacy:naturalAC' entry, so v8.3.4 and
// earlier characters continue to compute the same effective value.
function computeNaturalAC(c) {
  if (!c) return {total: 0, breakdown: {applied: [], superseded: [], inactive: []}, sources: []};
  let sources = (c.naturalACSources && Array.isArray(c.naturalACSources)) ? c.naturalACSources : null;
  if (!sources || sources.length === 0) {
    // Legacy synthesis
    if (c.naturalAC && c.naturalAC > 0) {
      sources = [{
        type: BONUS_TYPES.NATURAL,
        source: 'legacy:naturalAC',
        value: c.naturalAC,
        label: 'Natural AC (entered before v8.3.5)',
      }];
    } else {
      sources = [];
    }
  }
  // v8.5.0 Layer 2: talent-granted natural AC (Super-Resilient's CON-mod,
  // Nigh-Invulnerable's +5) joins the user-entered sources. Flows into both
  // the Nat. AC stat cell and the ×5-HP-per-point house rule automatically.
  const talentNat = buildTalentBonuses(c).naturalAC || [];
  // v8.6.0: mutation-granted natural armor (Exoskeleton +3, Scaly Armor +2)
  // joins the same aggregation — flows into T/ACtical + the ×5-HP rule.
  const mutNat = buildMutationBonuses(c).naturalAC || [];
  // v8.91.0: Subcutaneous Body Armor (cybernetic) — +2/+5/+8 by density
  // (HH p.336). v8.92.0 RULED (Adam): a TECH bonus to Natural AC — stacks
  // with biological natural armor and counts as PERMANENT for the ×5-HP
  // rule ("the built-in armor gives its HP to the cyborg"): the rule even
  // reproduces the implant table's own HP column exactly (+2→10, +5→25,
  // +8→40).
  const cybNat = (getCyber(c).map(r => cyberDef(r.n)).filter(d => d && d.nac).map(d => ({ type: BONUS_TYPES.TECH, source: 'cybernetic:' + d.n, value: d.nac, label: d.n + ' (cybernetic — tech bonus to Natural AC)' })));
  // v8.6.0 firm-wire: equipped Amulets of Natural Armor (enhancement type —
  // correctly superseded-by/superseding other enhancement NAC sources).
  const magNat = buildMagicItemBonuses(c).naturalAC || [];
  // v8.42.0: transient wired buffs (Thicken Skin) — join the display total,
  // excluded from permTotal exactly like item NAC (temporary = no ×5 HP).
  const buffNat = (activeBuffBonuses(c).naturalAC || []);
  const agg = aggregateBonuses(sources.concat(talentNat, mutNat, magNat, buffNat, cybNat));
  // permTotal excludes equipped-item NAC — the ×5-HP rule applies only to
  // PERMANENT natural armor (Adam's ruling: item NAC hit points would be
  // temporary; hardness counts items, HP does not). v8.92.0 RULED: subq
  // body armor (cybNat) IS permanent — "the built-in armor gives its HP to
  // the cyborg" — and ×5 reproduces the implant table's HP column exactly.
  const permAgg = aggregateBonuses(sources.concat(talentNat, mutNat, cybNat));
  return {total: agg.total, permTotal: permAgg.total, breakdown: agg.breakdown, sources: sources.concat(talentNat, mutNat, magNat, buffNat, cybNat)};
}

// Render the provenance HTML for a sourced value. Used in tooltips that
// explain WHY a number is what it is (e.g., the Nat. AC stat-cell tooltip).
// Returns a plain-text or simple-HTML string suitable for a `title` attribute
// or a tooltip popover.
//
// Format:
//   "5 from Drakkin racial natural armor (natural)
//    + 3 from Barkskin (enhancement) [superseded: +2 Amulet of Natural Armor (enhancement)]"
//
// Designed for HTML attribute use (no line breaks); separate sentences with
// " · " for compact display. Caller can format as multi-line for richer UI.
function renderSourcedValueProvenance(breakdown, opts) {
  opts = opts || {};
  const lines = [];
  const applied = breakdown?.applied || [];
  const superseded = breakdown?.superseded || [];
  const inactive = breakdown?.inactive || [];
  for (const e of applied) {
    const sign = e.value >= 0 ? '+' : '';
    lines.push(`${sign}${e.value} ${e.label || e.source} (${e.type || 'untyped'})`);
  }
  let out = lines.join(' · ');
  if (superseded.length > 0) {
    const supLines = superseded.map(e => `${e.value >= 0 ? '+' : ''}${e.value} ${e.label || e.source}`);
    out += ` · [superseded by same-type stacking: ${supLines.join(', ')}]`;
  }
  if (inactive.length > 0 && opts.showInactive) {
    const inacLines = inactive.map(e => `${e.value >= 0 ? '+' : ''}${e.value} ${e.label || e.source} (req: ${e.condition})`);
    out += ` · [conditional, not active: ${inacLines.join(', ')}]`;
  }
  return out || 'no sources';
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

// Top-level: compute every derivable stat for a character as a {total, breakdown}
// from typed bonus lists. Returns:
//   {bab:{total,breakdown,bonuses}, fort:{...}, ref:{...}, will:{...},
//    def:{...}, rep:{...}, ac:{...}, hp:{...}, totalLvl, ap:{...}, skills:{name:{...}}}
// `activeConditions`: optional Set of currently-active condition strings.
function computeStatBlock(char, activeConditions) {
  activeConditions = activeConditions || new Set();
  const classArr = migrateLegacyClasses(char);
  const attrs = char.attrs || [10,10,10,10,10,10];
  // v8.6.0 firm-wire: saves and AC use EFFECTIVE attribute mods (equipped
  // item enhancements included, derived live). HP deliberately keeps the
  // BASE Con mod — stored max HP is a level-up snapshot and item-CON hit
  // points are temporary by RAW (see the firm-wire ontology comment).
  const eff = effAttrs(char);
  const conM = am(eff[2]), dexM = am(eff[1]), wisM = am(eff[4]);
  const conMBase = am(attrs[2]);
  // Class-progression bonuses, bucketed by stat
  const classBon = buildClassBonuses(classArr);
  // Racial trait bonuses, bucketed by target stat
  // v8.68.0: Hybrids merge both parents' trait bonuses (distinct sources —
  // the typed aggregator reconciles same-type overlaps).
  const racialBon = buildRacialBonusesFor(char);
  // Feat bonus contributions, bucketed by target stat
  const featBon = buildFeatBonuses(char);
  // v8.5.0 Layer 2: talent bonus contributions. Only hp and init merge here —
  // naturalAC flows through computeNaturalAC (which also feeds the ×5 HP
  // rule), skill targets merge in the skill engine, and sheet-less targets
  // (speed, dr, resistances…) render via computeTalentEffects on the Talents
  // page. Talents contribute to NONE of bab/def/saves/rep, which keeps the
  // v7/v8 parity check (verifyParity) valid.
  const talentBon = buildTalentBonuses(char);
  // v8.6.0: mutation save modifiers (Frailty −2 Fort, Lethargy −2 Ref,
  // Mindslave −2 Will; conditional entries like Thick Fur Coat ride along
  // inactive for the drilldown). verifyParity subtracts these like featBon.
  const mutBon = buildMutationBonuses(char);
  // v8.6.0 firm-wire: equipped-item bonuses (Cloak of Resistance → saves,
  // Ring of Protection → deflection AC) — derived live, typed stacking rules.
  const mgBon = buildMagicItemBonuses(char);
  // v8.8.2: class-feature save bonuses (Divine Grace, Self-Control, and the
  // conditional Strong Personality / Still Mind / Trap Sense drilldown rows).
  const cfSaveBon = buildClassFeatureSaveBonuses(char);
  // v8.42.0: transient wired buffs (active powers — Foresight, Empty Mind,
  // Precognition Defensive…). Empty while nullified (NPF, Adam's ruling).
  const aeBon = activeBuffBonuses(char);
  // Compose per-stat lists. Order of contribution doesn't matter to the aggregator;
  // we just collect everything that targets each stat. Feat contributions are merged
  // in alongside class and racial bonuses, and the aggregator handles stacking rules.
  // v8.65.0: Best Defense (declared stance, Survivor 5) SPENDS Defense
  // Bonus — one negative untyped entry rides the def and ac lanes so the
  // cards, drilldowns, and AC all move together (PA's mirror).
  const _bdDecl = (combatDecl(char).bd || 0);
  const _bdEntry = _bdDecl ? [{ type: 'untyped', source: 'declared:bestDefense', value: -_bdDecl, label: `Best Defense (declared — +${_bdDecl} melee attack)` }] : [];
  // v8.76.0 (Adam's Hellfire report — "the defensive modifiers aren't
  // changing at all"): CE and RO were DISPLAY-ONLY on the defense side
  // (v8.59.0 wired tags, not math, while BA/Grapple moved for real). Now
  // they ride the ac lane like Best Defense: CE as a typed DODGE bonus
  // (touchAC:true in the stacking registry — the tag's HH p.207 promise —
  // and dropped when flat-footed, as dodge bonuses are); RO as an untyped
  // −4 (reaches touch too; recklessness isn't cured by being flat-footed).
  // Parry/Dodge get the same lines in their own compute functions.
  const _ceDecl = (combatDecl(char).ce || 0);
  const _ceEntry = _ceDecl ? [{ type: 'dodge', source: 'declared:combatExpertise', value: _ceDecl, label: `Combat Expertise (declared — −${_ceDecl} on melee attack rolls; Base Attack untouched)` }] : [];
  const _roDecl = (!!combatDecl(char).ro);
  const _roEntry = _roDecl ? [{ type: 'untyped', source: 'declared:recklessOffense', value: -4, label: 'Reckless Offense (declared — +2 melee attack rolls)' }] : [];
  // v8.67.0 (Mutant sync): Unnatural Prowess/Resilience lanes — the bab/def
  // entries mirror the reconciler's bakes (card/drilldown parity), the save
  // entries ARE the wire (saves aren't baked). verifyParity subtracts these.
  const msLanes = buildMutantSubtypeLanes(char);
  // v8.92.0 (Adam: "wire the negative level modifier for completeness"):
  // excess cybernetic attachments — −1 per negative level on SAVES here;
  // attack rolls ride the RO lane, skills ride the skill engine, grapple in
  // computeGrapple. Effective-level die rolls + the lost top spell/power
  // stay table-adjudicated (choice-dependent).
  const _cybNL = cyberExcess(char);
  const _cybNLEntry = _cybNL ? [{ type: 'untyped', source: 'cybernetic:negative-levels', value: -_cybNL, label: `Negative level${_cybNL > 1 ? 's' : ''} ×${_cybNL} (cybernetic overload — HH p.333)` }] : [];
  // v8.99.0: the implants' own lane entries (Mindscreen's conditional saves,
  // Initiative Implant) — computed once.
  const cybBon = buildCyberneticsBonuses(char);
  // v9.1.0: equipment save entries (Cold weather outfit, Parka, tents — all
  // CONDITIONAL today: drilldown rows, never the headline).
  const eqBon = buildItemBonuses(char);
  const lists = {
    bab:  [...classBon.bab,  ...(featBon.bab||[]), ...((cfSaveBon && cfSaveBon.bab)||[]), ...msLanes.bab],
    def:  [...classBon.def,  ...(racialBon.def||[]),  ...(featBon.def||[]), ...((cfSaveBon && cfSaveBon.def)||[]), ...msLanes.def, ..._bdEntry],
    fort: [...classBon.fort, buildAttributeBonus('CON', conM), ...(racialBon.fort||[]), ...(featBon.fort||[]), ...(mutBon.fort||[]), ...(mgBon.fort||[]), ...(cfSaveBon.fort||[]), ...(aeBon.fort||[]), ...msLanes.fort, ..._cybNLEntry, ...(cybBon.fort||[]), ...(eqBon.fort||[])],
    ref:  [...classBon.ref,  buildAttributeBonus('DEX', dexM), ...(racialBon.ref||[]),  ...(featBon.ref||[]),  ...(mutBon.ref||[]),  ...(mgBon.ref||[]),  ...(cfSaveBon.ref||[]),  ...(aeBon.ref||[]), ...msLanes.ref, ..._cybNLEntry, ...(cybBon.ref||[]), ...(eqBon.ref||[])],
    will: [...classBon.will, buildAttributeBonus('WIS', wisM), ...(racialBon.will||[]), ...(featBon.will||[]), ...(mutBon.will||[]), ...(mgBon.will||[]), ...(cfSaveBon.will||[]), ...(aeBon.will||[]), ...msLanes.will, ..._cybNLEntry, ...(cybBon.will||[]), ...(eqBon.will||[])],
    rep:  [...classBon.rep,  ...(racialBon.rep||[]),  ...(featBon.rep||[]), ...(buildClassFeatureRepBonuses(char))],
    // Armor Class: 10 base + size + DEX + def-bonus + natural + (future: armor, shield, deflection)
    ac:   [
      {type:BONUS_TYPES.BASE, source:'base:ac', value:10, label:'AC base'},
      buildAttributeBonus('DEX', dexM),
      // Class def-bonus contributes to AC; pulled from classBon.def
      ...classBon.def.map(b => ({...b, target:'ac'})),
      // v8.16.0 Races pass: size modifier (+1 Small, −1 Large).
      ...((raceACSizeMod(char)) ? [{type:'size', source:'race:size', value:raceACSizeMod(char), label:`size (${char.race})`}] : []),
      ...(racialBon.ac||[]),
      ...(featBon.ac||[]),
      ...(mgBon.ac||[]),  // v8.6.0 firm-wire: deflection rings et al.
      ...(aeBon.ac||[]),  // v8.42.0: transient wired buffs (Mental Barrier, Foresight…)
      ..._bdEntry,        // v8.65.0: Best Defense — the def spend reaches AC too
      ..._ceEntry,        // v8.76.0: Combat Expertise declared — the dodge bonus is REAL now
      ..._roEntry,        // v8.76.0: Reckless Offense declared — the −4 AC is REAL now
      ...msLanes.def.map(b => ({...b, target:'ac'})),  // v8.67.0: Unnatural Prowess Def feeds AC like class def-bonus does
    ],
    // HP — baseline = class HD sum (first die max, rest averaged) + CON per level + feat bonuses.
    // We build per-class entries so the drilldown shows "Fighter HD: 32 (level 5)" etc.
    hp: (() => {
      const entries = [];
      let firstEntryIdx = classArr.findIndex(e => e.first && e.level > 0 && getClassEntry(e));
      if (firstEntryIdx < 0) firstEntryIdx = classArr.findIndex(e => e.level > 0 && getClassEntry(e));
      let didFirst = false;
      let totalLevels = 0;
      for (let i = 0; i < classArr.length; i++) {
        const e = classArr[i];
        const cls = getClassEntry(e);
        if (!cls) continue;
        const lvl = Math.max(0, e.level || 0);
        if (lvl <= 0) continue;
        let hdSum = 0;
        for (let j = 0; j < lvl; j++) {
          const useMax = (i === firstEntryIdx && j === 0 && !didFirst);
          hdSum += useMax ? cls.hd : Math.floor(cls.hd / 2) + 1;
          if (useMax) didFirst = true;
        }
        totalLevels += lvl;
        const tierLbl = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier]||'?';
        entries.push({type:BONUS_TYPES.CLASS, source:`class:${e.name}:${lvl}:hd`,
          value:hdSum, label:`${e.name} HD (d${cls.hd} × ${lvl} levels)`});
      }
      if (totalLevels === 0) {
        entries.push({type:BONUS_TYPES.BASE, source:'base:hp', value:8, label:'Base humanoid (1d8)'});
        totalLevels = 1;
      }
      // CON contribution: conM × totalLevels (one CON modifier per character level)
      // v8.6.0: BASE Con only — item-CON is temporary by RAW (snapshot exclusion).
      const conM = conMBase;
      if (conM !== 0) {
        entries.push({type:BONUS_TYPES.ABILITY, source:'ability:CON×lvl',
          value:conM * totalLevels, label:`CON ${conM>=0?'+':''}${conM} × ${totalLevels} levels`});
      }
      // v8.3.6: Natural AC contributes +5 HP per point (HH p.347). This was
      // already folded into c.maxHP at save/level-up time, but the stat
      // breakdown was computing HP from scratch and missing this contribution
      // — so the drilldown total wouldn't match the displayed Max HP. Add it
      // explicitly so the breakdown matches reality.
      const effectiveNatAC = computeNaturalAC(char).total;
      if (effectiveNatAC > 0) {
        entries.push({type:BONUS_TYPES.NATURAL, source:'natural-ac:hp-bonus',
          value: effectiveNatAC * 5,
          label: `Natural AC bonus (×5 HP per +1 NAC, ${effectiveNatAC} NAC × 5 = ${effectiveNatAC*5})`});
      }
      return entries.concat(featBon.hp||[]).concat(talentBon.hp||[]);
    })(),
    // Initiative — base = DEX modifier; Improved Initiative adds +4 untyped.
    // v8.9.1: class-feature init bonuses (Uncanny Instincts, Improved
    // Reaction, Deft Draw conditional) join via cfSaveBon.init.
    init: [buildAttributeBonus('DEX', dexM), ...(featBon.init||[]), ...(talentBon.init||[]), ...((cfSaveBon && cfSaveBon.init)||[]), ...(cybBon.init||[]) /* v8.91.0: Initiative Implant +2 equipment; v8.99.0: shared cybBon */],
  };
  // Aggregate each
  const out = {};
  for (const k in lists) {
    const r = aggregateBonuses(lists[k], activeConditions);
    out[k] = {total:r.total, breakdown:r.breakdown, bonuses:lists[k]};
  }
  // Total level (sum of all class entries' levels)
  out.totalLvl = classArr.reduce((s,e) => s + (e.level||0), 0) || 1;
  // v8.3.18: Action Points now come from every class with an apB. Take the
  // highest apB across all classes ('cha' apB resolves to chaModClamped),
  // plus floor(totalLvl/2). See computeStatsFromClasses for the full rule
  // commentary.
  // v8.3.19: At Heroic Scale 0, AP is unavailable entirely (HH p.54-56 /
  // GM Guide). Fate Points spent permanently reduce future AP pool
  // replenishment (HH p.55).
  // v9.15.2 (§275 F12): route through effectiveHeroicLevelForAP like the v7
  // path (verifyParity) does — the raw scenario read gave Ordinary (and
  // pure-monstrous) characters AP the book denies them (HH p.42), surfacing
  // as a [v8 parity drift] warning on every such save.
  const heroicLvl = effectiveHeroicLevelForAP(char || {});
  if (heroicLvl < 1) {
    out.ap = 0;
    return out;
  }
  const _chaScore = (char && char.attrs && char.attrs[5]) || 10;
  let bestApB = 0;
  for (const e of classArr) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    let apContrib = 0;
    if (typeof cls.apB === 'number') {
      apContrib = cls.apB;
    } else if (cls.apB === 'cha') {
      apContrib = chaModClamped(_chaScore);
    }
    if (apContrib > bestApB) bestApB = apContrib;
  }
  const rawAP = bestApB + Math.floor(out.totalLvl / 2);
  // Subtract permanently-spent Fate Points; floor at 0.
  const fatePoints = (char && char.fatePoints) || 0;
  out.ap = Math.max(0, rawAP - fatePoints);
  return out;
}

// Parallel-run parity check: compare v8 computeStatBlock output against the
// v7 computeStatsFromClasses path. Returns {match:bool, diffs:{stat:[v7,v8]}}.
// Used at character-load and post-save to verify the new engine produces
// identical numbers to the proven-correct old engine.
function verifyParity(char) {
  const classArr = migrateLegacyClasses(char);
  // v8.3.18: pass Cha to v7 so its AP path resolves 'cha' apB values just
  // like v8's computeStatBlock does, allowing the AP parity check to hold
  // for non-Hero characters.
  // v8.3.32: heroicLvl routed through effectiveHeroicLevelForAP so a
  // pure-Ordinary character's AP resolves to 0 via the existing H0 guard.
  const v7 = computeStatsFromClasses(
    classArr,
    (char.attrs && char.attrs[5]) || 10,
    effectiveHeroicLevelForAP(char),
    char.fatePoints || 0
  );
  const v8 = computeStatBlock(char);
  // Compute the feat-bonus contribution to each save/etc. so we can subtract it
  // and isolate the class-progression portion for the parity check. v7's stat
  // values are class-only (no attr mod, no feat bonus); v8's totals include both.
  const featBon = buildFeatBonuses(char);
  const featContrib = (target) => {
    const list = featBon[target] || [];
    let sum = 0;
    for (const b of list) sum += (b.value || 0);
    return sum;
  };
  // v8.6.0: mutation save modifiers subtract the same way feats do, keeping
  // the class-only parity comparison valid for mutation-owning characters.
  // Only unconditional entries — conditional ones never enter the v8 total.
  const mutBonP = buildMutationBonuses(char);
  const mutContrib = (target) => (mutBonP[target] || []).filter(b => !b.condition).reduce((s, b) => s + (b.value || 0), 0);
  // v8.6.0 firm-wire: v8 save totals now use EFFECTIVE attribute mods and
  // include equipped-item bonuses — subtract both to isolate the class-only
  // portion (aggregated per type, since resistance items don't stack).
  const effP = effAttrs(char);
  const mgBonP = buildMagicItemBonuses(char);
  const mgContrib = (target) => aggregateBonuses(mgBonP[target] || []).total;
  const eqBonP = buildItemBonuses(char);
  const eqContrib = (target) => aggregateBonuses((eqBonP[target] || []).filter(b => !b.condition)).total;
  // v8.8.2: class-feature save bonuses (Divine Grace, Self-Control…) subtract
  // like feats do — v7 knows only the class PROGRESSION, not features.
  const cfBonP = buildClassFeatureSaveBonuses(char);
  const cfContrib = (target) => (cfBonP[target] || []).filter(b => !b.condition).reduce((s, b) => s + (b.value || 0), 0);
  // v8.16.0 Races pass: racial trait bonuses (Halfling +1 saves, Xeph…)
  // now reach the v8 save totals — subtract the unconditional portion the
  // same way feats/mutations/items do, keeping the class-only comparison.
  const raBonP = buildRacialBonusesFor(char);
  const raContrib = (target) => (raBonP[target] || []).filter(b => !b.condition).reduce((s, b) => s + (b.value || 0), 0);
  // v8.67.0 (Mutant sync): Unnatural Prowess/Resilience lanes subtract the
  // same way feats/racials do — v7 knows only the class progression.
  const msLanesP = buildMutantSubtypeLanes(char);
  const msContrib = (target) => (msLanesP[target] || []).reduce((s, b) => s + (b.value || 0), 0);
  const diffs = {};
  const checks = [
    ['bab',  v7.bab, v8.bab.total - featContrib('bab') - cfContrib('bab') - raContrib('bab') - msContrib('bab')],
    ['def',  v7.def, v8.def.total - featContrib('def') - cfContrib('def') - raContrib('def') - msContrib('def')],
    ['fort_class', v7.fort, v8.fort.total - am(effP[2]||10) - featContrib('fort') - mutContrib('fort') - mgContrib('fort') - eqContrib('fort') - cfContrib('fort') - raContrib('fort') - msContrib('fort')],
    ['ref_class',  v7.ref,  v8.ref.total  - am(effP[1]||10) - featContrib('ref')  - mutContrib('ref')  - mgContrib('ref')  - eqContrib('ref')  - cfContrib('ref')  - raContrib('ref') - msContrib('ref')],
    ['will_class', v7.will, v8.will.total - am(effP[4]||10) - featContrib('will') - mutContrib('will') - mgContrib('will') - eqContrib('will') - cfContrib('will') - raContrib('will') - msContrib('will')],
    ['rep',  v7.rep, v8.rep.total - featContrib('rep')],
    ['totalLvl', v7.totalLvl, v8.totalLvl],
    ['ap',   v7.ap, v8.ap],
  ];
  for (const [name, a, b] of checks) {
    if (a !== b) diffs[name] = [a, b];
  }
  return {match: Object.keys(diffs).length === 0, diffs};
}

function classStatAt(cls, level, key) {
  if (!cls || level <= 0) return 0;
  const arr = cls[key];
  if (!arr) return 0;
  return arr[Math.min(level - 1, arr.length - 1)] || 0;
}
// Aggregate combat stats from an arbitrary array of class entries.
// Each entry is {tier:'hero'|'basic'|'advanced'|'prestige', name, level, first?:bool}.
// Each class contributes its own level-table values, which sum together (D20 OGL multiclass rule).
//
// v8.3.18: Action Points now come from EVERY class with an apB field, not just
// Hero classes. Per HH/GG, each class entry contributes its own AP base:
//   - Hero classes: apB is numeric (5 or 6)
//   - Basic classes: apB is 'cha' (Cha mod clamped 0-5)
//   - Advanced classes: apB is numeric (6, or 7 for Survivor)
//   - Prestige classes: apB is 'cha' for most; 6 (Shadowjack, Technomage,
//     Technopath) or 7 (Super-Hero, Super-Villain) for some
// A multiclass character takes the HIGHEST apB across their classes (best
// contribution wins), plus the universal floor(totalLvl/2) component. The
// chaScore parameter lets the function resolve 'cha' apB values; if omitted,
// 'cha' contributions are skipped (legacy callers without attrs).
function chaModClamped(chaScore) {
  return Math.max(0, Math.min(5, am(chaScore || 10)));
}
// v8.3.19: signature extended with heroicLvl (defaults 1, treats undefined as
// "Heroic 1+") and fatePoints (default 0). At Heroic 0, ap returns 0 regardless
// of class. Fate Points subtract from the pool (HH p.55), floored at 0.
function computeStatsFromClasses(classArr, chaScore, heroicLvl, fatePoints) {
  classArr = classArr || [];
  let bab=0, def=0, fort=0, ref=0, will=0, rep=0, totalLvl=0;
  // Keep tier subtotals so legacy display code (e.g. "AP comes from Hero levels") still works.
  let heroLvlTotal=0, basicLvlTotal=0, advLvlTotal=0, presLvlTotal=0;
  let bestApB = 0; // max apB contribution across all classes
  const chaSpecified = (typeof chaScore === 'number');
  for (const e of classArr) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    if (lvl <= 0) continue;
    bab += classStatAt(cls, lvl, 'bab');
    def += classStatAt(cls, lvl, 'def');
    fort += classStatAt(cls, lvl, 'fort');
    ref += classStatAt(cls, lvl, 'ref');
    will += classStatAt(cls, lvl, 'will');
    rep += classStatAt(cls, lvl, 'rep');
    totalLvl += lvl;
    if (e.tier === 'hero') heroLvlTotal += lvl;
    else if (e.tier === 'basic') basicLvlTotal += lvl;
    else if (e.tier === 'advanced') advLvlTotal += lvl;
    else if (e.tier === 'prestige') presLvlTotal += lvl;
    // Resolve this class's apB contribution and track the maximum
    let apContrib = 0;
    if (typeof cls.apB === 'number') {
      apContrib = cls.apB;
    } else if (cls.apB === 'cha' && chaSpecified) {
      apContrib = chaModClamped(chaScore);
    }
    if (apContrib > bestApB) bestApB = apContrib;
  }
  totalLvl = Math.max(1, totalLvl);
  // v8.3.19: At Heroic Scale 0, AP is unavailable; otherwise = best per-class
  // base + floor(totalLvl/2), reduced by any permanently-spent Fate Points,
  // floored at 0.
  let ap = 0;
  if (heroicLvl === undefined || heroicLvl >= 1) {
    ap = bestApB + Math.floor(totalLvl / 2);
    ap = Math.max(0, ap - (fatePoints || 0));
  }
  return {bab, def, fort, ref, will, rep, ap, totalLvl,
          heroLvl:heroLvlTotal, basicLvl:basicLvlTotal, advLvl:advLvlTotal, presLvl:presLvlTotal};
}
// v8.3.20: Conditions reference data.
//
// Sourced from the Hero's Handbook condition appendix (HH p.367-370). Each
// condition is a structured entry with:
//   tier   — one of 'beneficial'|'mild'|'moderate'|'severe'|'terminal'.
//            Drives both the inline visual on the Tracker and the persistent
//            Sheet banner color. Forward-compatible: adding a new tier just
//            requires extending CONDITION_TIER_STYLE below.
//   gloss  — one-line summary for the Sheet's persistent banner. Keep brief —
//            full handbook text lives in `desc` and surfaces on the Tracker.
//   desc   — full handbook description for the Tracker's mechanical-effects
//            panel. Quoted/paraphrased from HH p.367-370 verbatim where
//            possible; long passages broken into readable paragraphs.
//   citation — {book, page} envelope matching the existing citation pattern.
//   mechanicalEffects — RESERVED for v8.3.21+. Will hold structured bonus
//            entries (e.g. [{type:'penalty', target:'attack', value:-2}])
//            so the bonus-aggregator can auto-apply condition effects.
//            Currently empty arrays; do not consume.
//
// The condition list reproduces the rules text closely. Where the handbook
// uses variable text like "–[Constitution modifier]" we preserve it verbatim,
// since the player needs the rule, not a pre-computed value (the computation
// would also vary if Con shifts mid-session).
const CONDITION_TIER_STYLE = {
  beneficial: {
    // Net-positive or mixed-advantage conditions (Invisible, Incorporeal).
    // Blue palette, distinct from the warning hues.
    bg:'rgba(125,170,220,.15)', border:'rgba(125,170,220,.45)', color:'#7daadc',
    sheetBg:'rgba(125,170,220,.10)', sheetBorder:'rgba(125,170,220,.5)', sheetColor:'#9bc2e8',
    label:'Beneficial',
  },
  mild: {
    // Yellow tier: minor penalties or transitional states (incl. Stable —
    // bleeding stopped but still helpless).
    bg:'rgba(212,184,112,.15)', border:'rgba(212,184,112,.45)', color:'#d4b870',
    sheetBg:'rgba(212,184,112,.10)', sheetBorder:'rgba(212,184,112,.5)', sheetColor:'#e5cb8a',
    label:'Mild',
  },
  moderate: {
    // Orange tier: meaningful debuffs but the character can still act.
    bg:'rgba(217,142,79,.15)', border:'rgba(217,142,79,.45)', color:'#d98e4f',
    sheetBg:'rgba(217,142,79,.10)', sheetBorder:'rgba(217,142,79,.5)', sheetColor:'#eaa56d',
    label:'Moderate',
  },
  severe: {
    // Red tier: largely incapacitating.
    bg:'rgba(212,112,112,.18)', border:'rgba(212,112,112,.55)', color:'#e08080',
    sheetBg:'rgba(212,112,112,.12)', sheetBorder:'rgba(212,112,112,.6)', sheetColor:'#ec9595',
    label:'Severe',
  },
  terminal: {
    // Headstone tier: black-on-white inversion with a red border accent.
    // Singular visual treatment so it can never be confused with any other.
    bg:'#fafafa', border:'#8b1a1a', color:'#0a0a0a',
    sheetBg:'#fafafa', sheetBorder:'#8b1a1a', sheetColor:'#0a0a0a',
    label:'Terminal', stark:true,
  },
};

const CONDITIONS_DATA = {
  // ===== BENEFICIAL =====
  'Invisible': {
    tier:'beneficial',
    gloss:'+2 attacks vs sighted opponents; opponents lose Dex bonus to AC against you.',
    desc:'Visually undetectable. An invisible creature gains a +2 bonus on attack rolls against sighted opponents, and ignores its opponents\' Dexterity bonuses to AC (if any).',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Incorporeal': {
    tier:'beneficial',
    gloss:'Immune to all nonmagical attacks. Vulnerable only to magic / spell effects or other incorporeal creatures.',
    desc:'Having no physical body. Incorporeal creatures are immune to all nonmagical attack forms. They can be harmed only by other incorporeal creatures, +1 or better magic weapons, spells, spell-like effects, or supernatural effects.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },

  // ===== MILD =====
  'Shaken': {
    tier:'mild',
    gloss:'–2 to attack rolls, saving throws, and skill checks.',
    desc:'A shaken character takes a –2 penalty on attack rolls, saving throws, and skill checks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Sickened': {
    tier:'mild',
    gloss:'–2 to attack rolls, weapon damage, saves, skill checks, and ability checks.',
    desc:'A sickened character takes a –2 penalty on all attack rolls, weapon damage rolls, saving throws, skill checks, and ability checks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Dazzled': {
    tier:'mild',
    gloss:'–1 on attack rolls, Search checks, and Spot checks (overstimulated eyes).',
    desc:'The creature is unable to see well because of overstimulation of the eyes. A dazzled creature takes a –1 penalty on attack rolls, Search checks, and Spot checks.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Fatigued': {
    tier:'mild',
    gloss:'Can\'t run or charge; –2 to Str and Dex. 8 hours\' rest removes the condition.',
    desc:'Characters who are fatigued can\'t run or charge and take a penalty of –2 to Strength and Dexterity. After 8 hours of complete, uninterrupted rest, a fatigued character is no longer fatigued.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Flat-Footed': {
    tier:'mild',
    gloss:'Loses Dex bonus to AC, can\'t make attacks of opportunity. Until first action in combat.',
    desc:'A character who has not yet acted during a combat is flat-footed, not reacting normally to the situation. A flat-footed character loses their Dexterity bonus to Armor Class and cannot make attacks of opportunity.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Prone': {
    tier:'mild',
    gloss:'–4 melee attacks; can\'t use bows/thrown weapons. +4 AC vs ranged, –4 AC vs melee.',
    desc:'An attacker who is prone (lying on the ground) takes a –4 penalty on melee attack rolls and can\'t use bows or thrown ranged weapons. The character gains a +4 bonus to Armor Class against ranged attacks, but takes a –4 penalty to Armor Class against melee attacks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Entangled': {
    tier:'mild',
    gloss:'–2 to attack, –4 to Dex. If anchored: can\'t move. Otherwise: half speed, no run/charge.',
    desc:'An entangled character takes a –2 penalty on attack rolls in addition to a –4 penalty to Dexterity. If the entangling bonds are anchored to an immobile object, the entangled hero can\'t move. Otherwise, the character can move at half speed, but can\'t run or charge.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Frightened': {
    tier:'mild',
    gloss:'Must flee source of fear. –2 to attacks, saves, skill checks, ability checks while frightened.',
    desc:'A frightened creature flees from the source of its fear as best it can. If unable to flee, it may fight. A frightened creature takes a –2 penalty on all attack rolls, saving throws, skill checks, and ability checks. A frightened creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape.\n\nFrightened is like Shaken, except that the creature must flee if possible. Panicked is a more extreme state of fear.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Stable': {
    tier:'mild',
    gloss:'No longer dying, but still unconscious. Bleeding stopped.',
    desc:'A stable character is no longer dying, but is still unconscious. Stable characters do not lose hit points each round, but they remain helpless until they regain consciousness.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },

  // ===== MODERATE =====
  'Dazed': {
    tier:'moderate',
    gloss:'Can take no actions, but retains normal AC. Typically lasts 1 round.',
    desc:'Unable to act, a dazed character can take no actions, but still gets the benefit of their normal Armor Class. This condition typically lasts 1 round.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Disabled': {
    tier:'moderate',
    gloss:'Between 0 and –[Con mod] HP. One move OR standard action per round; take 1 dmg per action.',
    desc:'The character has between 0 and –[Constitution modifier] hit points. The character can take only a single move action or standard action, and they take 1 point of damage after any action.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Exhausted': {
    tier:'moderate',
    gloss:'Half speed; no run/charge; –6 to Str and Dex. 1 hour rest → Fatigued.',
    desc:'Heroes who are exhausted move at half speed and cannot run or charge. Furthermore, they take a –6 penalty to Strength and Dexterity. After 1 hour of complete, uninterrupted rest, an exhausted character becomes fatigued.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Fascinated': {
    tier:'moderate',
    gloss:'Entranced; takes no actions; –4 on reactive skill checks. Obvious threats break the effect.',
    desc:'A fascinated creature is entranced by a supernatural or spell effect. The creature stands or sits quietly, taking no actions other than to pay attention to the fascinating effect, for as long as the effect lasts. It takes a –4 penalty on skill checks made as reactions, such as Listen and Spot checks. Any potential threat, such as a hostile creature approaching, allows the fascinated creature a new saving throw against the fascinating effect. Any obvious threat, such as someone drawing a weapon, casting a spell, or aiming a ranged weapon at the fascinated creature, automatically breaks the effect. A fascinated creature\'s ally may shake it free of the spell as a standard action.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Grappled': {
    tier:'moderate',
    gloss:'Can only attack bare-handed, with light weapon, or escape. Loses Dex bonus to AC vs others.',
    desc:'When grappled, a hero can\'t undertake any action other than attacking with their bare hands, attacking with a light weapon, or attempting to break free from their opponent. The character loses their Dexterity bonus to Armor Class versus any other attackers, except on attacks from characters with whom they are grappling.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Nauseated': {
    tier:'moderate',
    gloss:'Cannot attack or do anything requiring focus. Single move action per turn only.',
    desc:'Characters who are nauseated are unable to attack or do anything else requiring attention or concentration. The only action such a character can take is a single move action per turn.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Pinned': {
    tier:'moderate',
    gloss:'Held immobile in a grapple. –4 AC vs melee; loses Dex bonus to AC.',
    desc:'A pinned character is held immobile (but not helpless) in a grapple. The character takes a –4 penalty to Armor Class against melee attacks and loses their Dexterity bonus to AC.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Staggered': {
    tier:'moderate',
    gloss:'Single move OR standard action per round; no full-round actions.',
    desc:'A character whose nonlethal damage exactly equals their current hit points is staggered. A staggered character may take a single move action or standard action each round (but not both, nor can she take full-round actions). A character whose current hit points exceed their nonlethal damage is no longer staggered; a character whose nonlethal damage exceeds their hit points becomes unconscious.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Checked': {
    tier:'moderate',
    gloss:'Prevented from forward motion by external force (e.g., wind). Ground: stops. Flying: blown back.',
    desc:'Prevented from achieving forward motion by an applied force, such as wind. Checked creatures on the ground merely stop. Checked flying creatures move back a distance specified in the description of the effect.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Turned': {
    tier:'moderate',
    gloss:'(Undead only) Flees for 10 rounds. If cannot flee, cowers.',
    desc:'Affected by a Turn Undead attempt. Turned undead flee for 10 rounds (1 minute) by the best and fastest means available to them. If they cannot flee, they cower.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Knocked Down': {
    tier:'moderate',
    gloss:'Knocked prone by wind force. Flying creatures blown back 1d6 × 10 feet instead.',
    desc:'Depending on their size, creatures can be knocked down by winds of high velocity. Creatures on the ground are knocked prone by the force of the wind. Flying creatures are instead blown back 1d6 x 10 feet.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Blown Away': {
    tier:'moderate',
    gloss:'Ground: knocked down, roll 1d4 × 10 ft, 1d4 nonlethal/10ft. Flying: blown 2d6 × 10 ft, 2d6 nonlethal.',
    desc:'Depending on its size, a creature can be blown away by winds of high velocity. A creature on the ground that is blown away is knocked down and rolls 1d4 x 10 feet, taking 1d4 points of nonlethal damage per 10 feet. A flying creature that is blown away is blown back 2d6 x 10 feet and takes 2d6 points of nonlethal damage due to battering and buffering.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Ability Damaged': {
    tier:'moderate',
    gloss:'Lost 1+ attribute points. Temporary — returns 1 per evening of rest.',
    desc:'The character has lost 1 or more attribute points. The loss is temporary, and these points return at a rate of 1 per evening of rest. This differs from "effective" ability loss, which is an effect that goes away when the condition causing it goes away.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Energy Drained': {
    tier:'moderate',
    gloss:'Gains negative level(s). –1 attack/saves/checks, –5 HP, –1 effective level, –PP per negative level.',
    desc:'The character gains one or more negative levels, which might permanently drain the character\'s levels. If the subject has at least as many negative levels as Hit Dice, he dies. Each negative level gives a creature the following penalties: –1 penalty on attack rolls, saving throws, skill checks, ability checks; loss of 5 hit points; and –1 to effective level (for determining the power, duration, DC, and other details of spells or special abilities). In addition, a spellcaster/manifester loses power points equal to the power points required to cast/manifest their highest level spell/power.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Cowering': {
    tier:'moderate',
    gloss:'Frozen in fear. Loses Dex bonus, takes no actions, –2 AC. Typically lasts 10 rounds.',
    desc:'The hero is frozen in fear, loses their Dexterity bonus, and can take no actions. In addition, the character takes a –2 penalty to their Armor Class. The condition typically lasts 10 rounds.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Confused': {
    tier:'moderate',
    gloss:'Roll d% each turn: 01-10 attack caster, 11-20 normal, 21-50 babble, 51-70 flee, 71-100 attack nearest.',
    desc:'A confused character\'s actions are determined by rolling d% at the beginning of their turn: 01–10, attack caster with melee or ranged weapons (or close with caster if attacking is not possible); 11–20, act normally; 21–50, do nothing but babble incoherently; 51–70, flee away from caster at top possible speed; 71–100, attack nearest creature (for this purpose, a familiar counts as part of the subject\'s self). A confused character who can\'t carry out the indicated action does nothing but babble incoherently.\n\nAttackers are not at any special advantage when attacking a confused character. Any confused character who is attacked automatically attacks its attackers on its next turn, as long as it is still confused when its turn comes. A confused character does not make attacks of opportunity against any creature that it is not already devoted to attacking.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Deafened': {
    tier:'moderate',
    gloss:'–4 on initiative; cannot make Listen checks. Long-term deaf characters can overcome some drawbacks.',
    desc:'The hero can\'t hear and takes a –4 penalty on initiative checks. The character can\'t make Listen checks. Heroes who are deafened long-term (from birth or early in life) grow accustomed to these drawbacks and can overcome some of them (at the GM\'s discretion).',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },

  // ===== SEVERE =====
  'Stunned': {
    tier:'severe',
    gloss:'Loses Dex bonus, drops held items, no attack or move actions, –2 AC. Typically 1 round.',
    desc:'A character who becomes stunned loses their Dexterity bonus, drops what they are holding, and can take no attack or move actions. In addition, the character takes a –2 penalty to Armor Class. The condition typically lasts 1 round.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Blinded': {
    tier:'severe',
    gloss:'50% miss chance; effective Dex 3; –4 to Str/Dex skills, Search. Cannot Spot or read.',
    desc:'The hero can\'t see at all, and thus everything has total concealment to them. The character has a 50% chance to miss in combat. Furthermore, the blinded character has an effective Dexterity of 3, along with a –4 penalty on the use of Strength-based and Dexterity-based skills. This –4 penalty also applies to Search checks and any other skill checks for which the GM deems sight to be important. The character can\'t make Spot checks or perform any other activity (such as reading) that requires vision. Heroes who are blind long-term (from birth or early in life) grow accustomed to these drawbacks and can overcome some of them (at the GM\'s discretion).',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Panicked': {
    tier:'severe',
    gloss:'Flees at top speed. If cornered: cowers, no actions. –2 to all saves, skill, ability checks.',
    desc:'A panicked character flees as fast as possible and cowers (see Cowering) if unable to get away. They can\'t take any other actions. In addition, the character takes a –2 penalty on all saving throws, skill checks, and ability checks.\n\nIf cornered, a panicked creature cowers and does not attack, typically using the total defense action in combat. A panicked creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape.\n\nPanicked is a more extreme state of fear than Shaken or Frightened.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Paralyzed': {
    tier:'severe',
    gloss:'Falls prone, helpless. Effective Dex and Str of 0.',
    desc:'Heroes who are paralyzed fall to the ground, unable to move (they have an effective, but not actual, Dexterity and Strength of 0). They are helpless.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Petrified': {
    tier:'severe',
    gloss:'Turned to stone, treated as unconscious. Broken pieces lost on restoration cause permanent HP loss.',
    desc:'A petrified character has been turned to stone and is considered unconscious. If a petrified character cracks or breaks, but the broken pieces are joined with the body as he returns to flesh, he is unharmed. If the character\'s petrified body is incomplete when it returns to flesh, the body is likewise incomplete and there is some amount of permanent hit point loss and/or debilitation.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Helpless': {
    tier:'severe',
    gloss:'Effective AC 5 + size mod (Dex 0). Vulnerable to coup de grace.',
    desc:'Paralyzed, sleeping, or unconscious characters are helpless. A helpless character has an effective Armor Class of 5 + size modifier, thanks to an effective Dexterity of 0. An attacker can attempt a coup de grace against a helpless character.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Unconscious': {
    tier:'severe',
    gloss:'Unable to defend. Helpless and typically prone. From HP between –[Con mod] and –[Con] or excess nonlethal.',
    desc:'Unconsciousness can result from having current hit points between –[Constitution modifier] and –[Constitution score], or from nonlethal damage in excess of current hit points. An unconscious character is unable to defend themselves. The character is helpless and typically falls prone.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Dying': {
    tier:'severe',
    gloss:'Below –[Con mod] HP but above –[Con score]. No actions. Lose 1 HP per round until stable or dead.',
    desc:'The character is near death and unconscious, possessing below –[Constitution modifier] hit points but still having above –[Constitution score] hit points. The character can take no actions, and each round a dying character loses 1 hit point until they die or become stable.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Ability Drained': {
    tier:'severe',
    gloss:'Lost 1+ ability score points. The loss is PERMANENT.',
    desc:'The character has lost 1 or more ability score points. The loss is permanent.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },

  // ===== TERMINAL =====
  'Dead': {
    tier:'terminal',
    gloss:'HP at or below –[Con score], or Con score at 0.',
    desc:'A character dies when their hit points drop to –[Constitution score] or lower, or when their Constitution drops to 0.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
};

// Quick-add conditions for the Tracker panel (the 6 most common). The rest
// are reachable via the "More…" dropdown.
const COMMON_CONDITIONS = ['Prone','Stunned','Blinded','Frightened','Unconscious','Disabled'];

