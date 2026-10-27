// =============================================================================
// js/rules/03-feat-slots-and-caster-progression.js
// FEAT SLOTS AND CASTER PROGRESSION
// =============================================================================
//
// WHAT'S IN HERE
//   How many feats a character gets and from where (the feat-slot breakdown
//   and its restriction filters), which classes cast (CASTER_CLASSES), and the
//   spell/power-point progression tables (CASTER_PROGRESSION, PP costs per
//   power level, pool levels) with computeCasterLevels / computeCasterStats.
//
// KEY NAMES (so you can search for them)
//   tables/objects: CASTER_CLASSES, CASTER_PROGRESSION,
//   PP_COST_BY_POWER_LEVEL, POOL_EFF_LEVEL
//   functions (8): getFeatSlotBreakdown, getRestrictionFilter,
//   getRestrictionFamily, getOpenClassBonusSlots, applyClassFeatureEffects,
//   computeCasterLevels, computeCasterStats, _emptyPoolStats
//
// LOAD ORDER
//   File 3 of 68. index.html loads it after js/rules/02-class-features.js and
//   before js/rules/04-advanced-classes.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 3410-4292 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 3410-4292; unchanged below this line ----
// ========== FEAT SLOTS (v8.3.2) ==========
//
// Feat slots come from multiple sources, each with optional restrictions:
//   - "baseline" slots — heritage feat, level-1 free feat, +1/3 levels,
//     Human bonus, Hero's Gift. No restriction.
//   - "classFeature" slots — Expert Bonus Feat, Fighter Bonus Feat,
//     Cleric Bonus Feat, etc. Restricted to a class-specific feat list.
//
// getFeatSlotBreakdown returns the structured breakdown so the renderer can:
//   1. Show baseline + class-bonus counts separately
//   2. Detect when an unfilled class-bonus slot exists, and offer a
//      slot-aware feat picker (filtered to the restriction)
//   3. Tag each picked feat with its consuming slot for transparency
//
// Schema:
//   {
//     baselineTotal: N,
//     classBonus: [{className, featureName, formula, restriction, count, label}],
//     totalCapacity: N,
//   }
function getFeatSlotBreakdown(c) {
  if (!c) return {baselineTotal: 0, classBonus: [], totalCapacity: 0};
  const heroClass = (c.classes||[]).some(e => e.tier==='hero');
  const baselineTotal = 1 + 1 + (isHumanParented(c)?1:0) + (heroClass?1:0) + Math.floor((c.totalLvl||0)/3);  // v8.70.1: Human-parent Hybrids inherit the bonus feat
  const classBonus = [];
  const features = getActiveClassFeatures(c);
  for (const f of features) {
    if (!f.effect || f.effect.type !== 'bonusFeats') continue;
    const classLvl = f.classLvl || 0;
    const count = evalBonusFeatFormula(f.effect.formula, classLvl);
    if (count <= 0) continue;
    classBonus.push({
      className: f.className,
      featureName: f.name,
      formula: f.effect.formula,
      restriction: f.effect.restriction || null,
      count: count,
      label: `${f.className} ${f.name}`,
    });
  }
  // v8.11.1 Segment B: menu picks that ARE feat slots (Archmage Arcane
  // Mastery, Metamind Bonus Power Feat, Ecclesiarch Magic Feat, Loremaster
  // Weapon trick / Applicable knowledge) surface as class-bonus slots.
  if (c.classChoices && typeof classChoiceVal === 'function') {
    const menuSlots = [];
    for (const k in c.classChoices) {
      const v = String(c.classChoices[k] || '');
      if (k.startsWith('arc_ha_') && /^Arcane Mastery/.test(v)) menuSlots.push(['Archmage', 'High Arcana (Arcane Mastery)', 'Magic feat list']);
      if (k.startsWith('mm_mm_') && /^Bonus Power Feat/.test(v)) menuSlots.push(['Metamind', 'Mental Mastery (Bonus Power Feat)', 'Power feat list']);
      if (k.startsWith('ecc_gg_') && /^Magic Feat/.test(v)) menuSlots.push(['Ecclesiarch', 'Godly Gift (Magic Feat)', 'Magic feat list']);
      if (k.startsWith('lm_sec_') && /Weapon trick/.test(v)) menuSlots.push(['Loremaster', 'Secret (Weapon trick)', ['Weapon Focus']]);
      if (k.startsWith('lm_sec_') && /Applicable knowledge/.test(v)) menuSlots.push(['Loremaster', 'Secret (Applicable knowledge)', 'any feat']);
    }
    for (const [cn, fn, restr] of menuSlots) {
      const existing = classBonus.find(b => b.className === cn && b.featureName === fn);
      if (existing) existing.count += 1;
      else classBonus.push({ className: cn, featureName: fn, formula: 'menuPick', restriction: restr, count: 1, label: `${cn} ${fn}` });
    }
  }
  // v8.11.1: "talent instead of feat" conversions consume bonus-feat capacity
  // (mirrors getTalentBudget's flexUsed math — one-directional, no cycle).
  if (typeof heroTalentFlex === 'function') {
    const flex = heroTalentFlex(c);
    if (flex.flexMax > 0) {
      const arrF = migrateLegacyClasses(c);
      const byHero = {};
      for (const e of arrF) { if (e.tier === 'hero') byHero[e.name] = Math.min(5, Math.floor(((e.level || 0) + 1) / 2)); }
      const ownedFeatsF = new Set((c.feats || []).map(f => f.name || f.n));
      let baseOwed = Object.values(byHero).reduce((s, n) => s + n, 0) + flex.base;
      if (ownedFeatsF.has('Multi-Talented')) baseOwed += 1;
      if ((c.mutations || []).some(m => m.name === 'Multi-Talented')) baseOwed += 1;
      if (arrF.some(e => e.tier === 'hero') && !isLegacyCharacter(c) && c.heroesGiftChoice === 'talent') baseOwed += 1;
      // v8.21.1: super-tier talents consume no slots — mirror getTalentBudget.
      const slotPickedF = (c.talents || []).filter(t => (typeof talentConsumesSlot === 'function') ? talentConsumesSlot(t.name) : true).length;
      const flexUsed = Math.max(0, Math.min(flex.flexMax, slotPickedF - baseOwed));
      if (flexUsed > 0) classBonus.push({ className: 'Anti-Hero/Super', featureName: 'Talent conversions', formula: 'flex', restriction: null, count: -flexUsed, label: `Slots converted to talents (−${flexUsed})` });
    }
  }
  const bonusTotal = classBonus.reduce((s, b) => s + b.count, 0);
  return {baselineTotal, classBonus, totalCapacity: baselineTotal + bonusTotal};
}

// Map a restriction string to a feat 'family' value for filtering against
// FEATS_DB. Currently handles "<Class> feat list" patterns; returns null
// for unparseable restrictions (those become no-op filters — caller falls
// back to no restriction).
// v8.3.7: extended restriction model. Returns a discriminated union:
//   {kind:'family', value:'Fighter'}    — restriction is a family tag
//   {kind:'list',   value:['Brawl',...]} — restriction is an explicit allowlist
//   null — no recognized restriction (slot is fully open)
//
// The 'family' case existed since v8.3.1. The 'list' case is added in v8.3.7
// for Hero class bonus feats, which pull from a class-specific itemized list
// that doesn't map to a single FEATS_DB family tag (e.g., Strong Hero's list
// pulls from Fighter + Heritage + General + Power families).
//
// Backward compat: the legacy export `getRestrictionFamily(r)` is kept as a
// thin wrapper that returns the family string for family-kind restrictions
// (or null otherwise) — so any reader that hasn't migrated yet keeps working.
function getRestrictionFilter(restriction) {
  if (!restriction) return null;
  if (Array.isArray(restriction)) {
    return restriction.length > 0 ? {kind:'list', value: restriction} : null;
  }
  if (typeof restriction === 'string') {
    const m = restriction.match(/^(\w+)\s+feat\s+list$/i);
    return m ? {kind:'family', value: m[1]} : null;
  }
  return null;
}
// Legacy wrapper kept for any unmigrated reader.
function getRestrictionFamily(restriction) {
  const f = getRestrictionFilter(restriction);
  return (f && f.kind === 'family') ? f.value : null;
}

// Given the character and their current feat list, determine which class-
// bonus slots are still unfilled. Returns array of slot descriptors:
//   {className, featureName, restriction, restrictionFamily, slotIndex}
// slotIndex distinguishes multiple bonus slots from the same source (e.g.
// Expert 5 has 3 bonus feat slots: indices 0, 1, 2).
//
// The matching logic: count feats tagged slotSource:'classFeature:<Class>:<Name>'.
// If the count is less than the granted count, the remaining slots are open.
function getOpenClassBonusSlots(c) {
  if (!c) return [];
  const breakdown = getFeatSlotBreakdown(c);
  const feats = c.feats || [];
  const open = [];
  for (const bonus of breakdown.classBonus) {
    const sourceTag = `classFeature:${bonus.className}:${bonus.featureName}`;
    const consumed = feats.filter(f => f.slotSource === sourceTag).length;
    const remaining = Math.max(0, bonus.count - consumed);
    for (let i = 0; i < remaining; i++) {
      open.push({
        className: bonus.className,
        featureName: bonus.featureName,
        restriction: bonus.restriction,
        restrictionFamily: getRestrictionFamily(bonus.restriction),
        restrictionFilter: getRestrictionFilter(bonus.restriction),  // v8.3.7
        sourceTag: sourceTag,
        slotIndex: consumed + i,
      });
    }
  }
  return open;
}


// Currently handles:
//   - touchAcBonus → bumps c._touchAcBonus (used by computeACDisplay)
// The context object should be mutated in place; callers compute downstream
// values from it.
//
// The reason this is separate from computeACDisplay is to keep effect
// application orthogonal to display — same effects flow to PDF export,
// stat-breakdown tooltips, etc.
function applyClassFeatureEffects(c) {
  if (!c) return;
  const features = getActiveClassFeatures(c);
  let touchAcBonus = 0;
  for (const f of features) {
    if (!f.effect) continue;
    if (f.effect.type === 'touchAcBonus') {
      let value = 0;
      if (f.effect.source === 'attr:CHA-mod') {
        value = am(c.attrs[5] || 10);  // CHA is index 5
      } else if (f.effect.source === 'attr:DEX-mod') {
        value = am(c.attrs[1] || 10);
      } else if (f.effect.source === 'attr:INT-mod') {
        value = am(c.attrs[3] || 10);  // v8.9.1: Tactician Smart Defense
      } else if (typeof f.effect.source === 'number') {
        value = f.effect.source;
      }
      // Per HH semantics for these features (e.g. Wilder Elude Touch), the
      // bonus is meaningful only when positive — a Wilder with Cha 9 doesn't
      // gain a Touch AC bonus (and shouldn't take a penalty either).
      touchAcBonus += Math.max(0, value);
    }
  }
  c._touchAcBonus = touchAcBonus;
}

// CASTER_CLASSES — defines which classes contribute to which power pool, and how.
// Four pools exist: arcane, divine, psionic, supernatural. They are fully isolated
// per the DxD20 rules (the only inter-pool exchange is via the Theurge prestige class).
//
// Each entry: {pool: 'arcane'|'divine'|'psionic', mode: 'full'|'lesser'}
//   full:    caster level = class level (granted at 1st level)
//   lesser:  no caster level until class level 4; from 4 onwards, caster level
//            contribution = floor(class_level / 2). Paladin/Ranger only.
//
// Supernatural power is *not* a class — it derives from Mutation Points (race
// levels of Mutant, the Slightly Different / Supernatural Mutation feats, or
// Drawback purchases). It's tracked separately in computeMutationPoints.
//
// Advanced/Prestige classes that ADVANCE an existing caster level use the
// `advances` field — e.g. Mystic Theurge advances both arcane AND divine.
// `advances` can be a single string or an array.
const CASTER_CLASSES = {
  // Basic full casters
  'Bard':     {tier:'basic',    pool:'arcane',  mode:'full'},
  'Sorcerer': {tier:'basic',    pool:'arcane',  mode:'full'},
  'Wizard':   {tier:'basic',    pool:'arcane',  mode:'full'},
  'Cleric':   {tier:'basic',    pool:'divine',  mode:'full'},
  'Saint':    {tier:'basic',    pool:'divine',  mode:'full'},
  'Psion':    {tier:'basic',    pool:'psionic', mode:'full'},
  'Wilder':   {tier:'basic',    pool:'psionic', mode:'full'},
  'Warmind':  {tier:'basic',    pool:'psionic', mode:'full'},
  // Basic lesser casters (Paladin/Ranger): no CL until lvl 4, then floor(lvl/2)
  'Paladin':  {tier:'basic',    pool:'divine',  mode:'lesser'},
  'Ranger':   {tier:'basic',    pool:'divine',  mode:'lesser'},
  // Advanced/Prestige caster advancers. v8.31.0 (Adam's Theurge ruling,
  // 2026-09-23 + gauge finding #1): advancer levels boost the FEEDER basic
  // class in each advanced pool — full progression (PP, spell/power access,
  // knowns, CL as feeder-level + advancer-levels), pools staying separate
  // (Wilder 4 / Wizard 5 + Psychic Theurge 1 = ML 5 AND CL 6).
  // capstoneCharLevel: the Theurges' Perfected Technique (GMG p.186) — at
  // that class level, every advanced pool's CL floors at TOTAL character
  // level ("the equivalent of Arcane + Psionic Heritage", Adam). Archmage /
  // Loremaster have no such capstone (their text verified 2026-09-23).
  // blendsPools (v8.31.1, Adam's redirect): Blended Technique (Theurge 1,
  // GMG p.185) UNITES the two pools for SPENDING — "the two power point
  // pools are added together, capable of being spent however the Theurge
  // wishes on either art." CLs, max spell levels, and access stay per-pool.
  'Mystic Theurge': {tier:'prestige', advances:['arcane','divine'], mode:'full', apB:'cha', capstoneCharLevel:10, blendsPools:true},
  'Archmage':       {tier:'prestige', advances:'arcane',  mode:'full', apB:'cha'},
  // v8.70.0 (Adam's ruling): the Loremaster improves whatever means
  // QUALIFIED it (7 Divinations cast / 7 Clairsentience powers manifested —
  // all three pools genuinely reach the gate), chosen PER LEVEL as the
  // level is attained (the GG's "some Loremasters opt to diversify").
  // Unpicked levels default to Arcane — the pre-v8.70.0 status quo.
  'Loremaster':     {tier:'prestige', mode:'full', apB:'cha',
    advancesChoice:{base:'lm_adv_', ms:[1,2,3,4,5,6,7,8,9,10], map:{'Arcane':'arcane','Divine':'divine','Psionic':'psionic'}, defaultPool:'arcane'}},
  // v8.70.0 (Adam's ruling): Improved Methods is an either-or PER LEVEL,
  // decided when the level is attained — +1 Assassinate DC or an advance.
  'Assassin':       {tier:'prestige', mode:'full', apB:'cha',
    advancesChoice:{base:'asn_im_', ms:[2,4,6,8,10], map:{'Advance: Arcane':'arcane','Advance: Divine':'divine','Advance: Psionic':'psionic'}}},
  // v8.70.0 — THE ADVANCER COMPLETION (Adam's Epic-prereq sitrep found the
  // gap): ten classes whose advancement was display-text only. Schedules
  // from each class's own GG table (carried in its CLASS_FEATURES desc);
  // advancesAt = the class levels that advance the feeder (absent = every
  // level). Ecclesiarch per its table advances at 2nd-5th; the Knights at
  // 1/2/4/5/7/8/10; Elocater/Soulstalker at 1/3/4/6/7/8/10; the Tricksters
  // at 2/3/4/6/7/8 with the Consummate capstone (CL = character level at
  // 10th — the Theurges' Perfected Technique mechanic, reused verbatim).
  // Loremaster stays arcane-only pending Adam's multi-pool ruling (its text
  // reads "a prior casting/manifesting class"); Assassin's Improved Methods
  // is an option-based advance — also awaiting a ruling.
  'Metamind':              {tier:'prestige', advances:'psionic', mode:'full', apB:'cha'},
  'Ecclesiarch':           {tier:'prestige', advances:'divine',  mode:'full', apB:'cha', advancesAt:[2,3,4,5]},
  'Crusader':              {tier:'prestige', advances:'divine',  mode:'full', apB:'cha'},
  'Guildmember (Magic)':   {tier:'prestige', advances:'arcane',  mode:'full', apB:'cha'},
  'Guildmember (Psionic)': {tier:'prestige', advances:'psionic', mode:'full', apB:'cha'},
  'Eldritch Knight':       {tier:'prestige', advances:'arcane',  mode:'full', apB:'cha', advancesAt:[1,2,4,5,7,8,10]},
  'Holy Knight':           {tier:'prestige', advances:'divine',  mode:'full', apB:'cha', advancesAt:[1,2,4,5,7,8,10]},
  'Elocater':              {tier:'prestige', advances:'psionic', mode:'full', apB:'cha', advancesAt:[1,3,4,6,7,8,10]},
  'Soulstalker':           {tier:'prestige', advances:'psionic', mode:'full', apB:'cha', advancesAt:[1,3,4,6,7,8,10]},
  'Arcane Trickster':      {tier:'prestige', advances:'arcane',  mode:'full', apB:'cha', advancesAt:[2,3,4,6,7,8], capstoneCharLevel:10},
  'Psychic Trickster':     {tier:'prestige', advances:'psionic', mode:'full', apB:'cha', advancesAt:[2,3,4,6,7,8], capstoneCharLevel:10},
  'Cerebremancer':  {tier:'prestige', advances:['arcane','psionic'], mode:'full', capstoneCharLevel:10, blendsPools:true},  // printed alias of Psychic Theurge (GMG p.185)
  'Psychic Theurge':{tier:'prestige', advances:['arcane','psionic'], mode:'full', apB:'cha', capstoneCharLevel:10, blendsPools:true},
  // Note: more prestige classes may advance casting — see GM's Guide for full list.
  // Entries not declared here contribute zero to caster levels.
};

// ============================================================================
// CASTER_PROGRESSION — v8.3.12 power-point progression data
// ============================================================================
//
// One entry per casting Basic class. Each entry has level-indexed arrays
// (index 0 = level 1, index 1 = level 2, ..., index 19 = level 20).
//
// Fields:
//   pool:           'arcane' | 'divine' | 'psionic' — which PP pool the class contributes to
//   attr:           'INT' | 'WIS' | 'CHA' — casting/manifesting attribute (drives DC + bonus PP)
//   prep:           true = prepared caster (Wizard, Cleric, Ranger); false = spontaneous
//                   (Sorcerer, Bard, Saint, Paladin, all psionics — the Saint and the
//                   4th-level+ Paladin cast spontaneously per HH p.90, domains-only)
//   pp:             [array of 20] base PP/day contributed by this class at level N
//                   (a dash in the handbook is encoded as 0 — e.g., Paladin L1-L3)
//   maxPowerLvl:    [array of 20] maximum power/spell level the character can manifest from this class
//                   at level N. Used for "max power level known" and the cost cap (cost ≤ ML).
//                   In d20: cost-to-level table = 1,3,5,7,9,11,13,15,17 for levels 1-9.
//   powersKnown:    [array of 20] (psionic spontaneous casters: Psion, Wilder, Warmind)
//                   running total of known powers. Player picks N powers from class list.
//   spellsKnownMatrix: [array of 20 of arrays of 10] (arcane spontaneous casters: Sorcerer, Bard)
//                   per-spell-level matrix of known spells. spellsKnownMatrix[lvl-1][spellLvl] =
//                   count of spells of that spell level known at that class level.
//
// Prepared casters (Wizard, Cleric, Ranger) don't have a powersKnown cap — they have
// access to all spells of their list/granted spells up to maxPowerLvl, and prep daily
// from the pool. (The Saint is SPONTANEOUS — HH p.90 "like a Saint" is the Paladin's
// model too — drawing without preparation from the deity's domain lists.)
//
// Per HH p.404, the PP cost formula is: spell level 1=1, 2=3, 3=5, 4=7, 5=9, 6=11, 7=13, 8=15, 9=17.
// Bonus PP from attribute (HH p.16, 392): bonus = ceil(attr_mod × CL / 2).
// Save DC: 10 + spell/power level + casting attr modifier.
const CASTER_PROGRESSION = {
  // ----- FULL CASTERS (start at L1) -----
  'Wizard': {
    pool:'arcane',  attr:'INT', prep:true,
    pp:           [4, 6, 9, 13, 18, 26, 34, 46, 58, 74, 90, 110, 130, 154, 178, 206, 234, 266, 296, 328],
    maxPowerLvl:  [1, 1, 2,  2,  3,  3,  4,  4,  5,  5,  6,   6,   7,   7,   8,   8,   9,   9,   9,   9],
  },
  'Cleric': {
    pool:'divine',  attr:'WIS', prep:true,
    pp:           [5, 6, 13, 18, 28, 36, 54, 66, 87, 103, 131, 151, 187, 211, 255, 283, 335, 367, 406, 438],
    maxPowerLvl:  [1, 1,  2,  2,  3,  3,  4,  4,  5,   5,   6,   6,   7,   7,   8,   8,   9,   9,   9,   9],
  },
  'Saint': {
    // v9.15.2 (§275 F7): WIS→CHA — the Saint's own entry (HH p.100) says
    // Charisma three times (casting requirement, save DCs, bonus PP at Cha
    // 12+); only the p.19 Wisdom blurb disagrees (book conflict B6, letter
    // banked). Drives bonus PP AND saveDcBase.
    pool:'divine',  attr:'CHA', prep:false,  // HH: "Unlike a Cleric, a Saint need not prepare their spells"
    pp:           [8, 10, 11, 21, 24, 42, 50, 76, 88, 122, 138, 180, 200, 250, 274, 332, 364, 430, 462, 496],
    maxPowerLvl:  [1,  1,  1,  2,  2,  3,  3,  4,  4,   5,   5,   6,   6,   7,   7,   8,   8,   9,   9,   9],
  },
  'Sorcerer': {
    pool:'arcane',  attr:'CHA', prep:false,
    pp:           [8, 10, 11, 21, 24, 42, 50, 76, 88, 122, 138, 180, 200, 250, 274, 332, 364, 430, 462, 476],
    maxPowerLvl:  [1,  1,  1,  2,  2,  3,  3,  4,  4,   5,   5,   6,   6,   7,   7,   8,   8,   9,   9,   9],
    // Spells known per spell level [0,1,2,3,4,5,6,7,8,9]
    spellsKnownMatrix: [
      /* L1  */ [4, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L2  */ [5, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L3  */ [5, 4, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L4  */ [6, 4, 2, 0, 0, 0, 0, 0, 0, 0],
      /* L5  */ [6, 5, 3, 0, 0, 0, 0, 0, 0, 0],
      /* L6  */ [7, 5, 3, 2, 0, 0, 0, 0, 0, 0],
      /* L7  */ [7, 6, 4, 3, 0, 0, 0, 0, 0, 0],
      /* L8  */ [8, 6, 4, 3, 2, 0, 0, 0, 0, 0],
      /* L9  */ [8, 6, 5, 4, 3, 0, 0, 0, 0, 0],
      /* L10 */ [9, 6, 5, 4, 3, 2, 0, 0, 0, 0],
      /* L11 */ [9, 6, 6, 5, 4, 3, 0, 0, 0, 0],
      /* L12 */ [9, 6, 6, 5, 4, 3, 2, 0, 0, 0],
      /* L13 */ [9, 6, 6, 5, 5, 4, 3, 0, 0, 0],
      /* L14 */ [9, 6, 6, 5, 5, 4, 3, 2, 0, 0],
      /* L15 */ [9, 6, 6, 5, 5, 5, 4, 3, 0, 0],
      /* L16 */ [9, 6, 6, 5, 5, 5, 4, 3, 2, 0],
      /* L17 */ [9, 6, 6, 5, 5, 5, 4, 4, 3, 0],
      /* L18 */ [9, 6, 6, 5, 5, 5, 4, 4, 3, 2],
      /* L19 */ [9, 6, 6, 6, 5, 5, 5, 4, 4, 3],
      /* L20 */ [9, 6, 6, 6, 6, 5, 5, 5, 4, 3],
    ],
  },
  'Bard': {
    pool:'arcane',  attr:'CHA', prep:false,
    pp:           [2, 3, 4, 6, 9, 12, 15, 20, 25, 29, 37, 44, 49, 61, 71, 80, 99, 117, 137, 148],
    maxPowerLvl:  [0, 1, 1, 2, 2,  3,  3,  4,  4,  4,  5,  5,  5,  6,  6,  6,  6,   6,   6,   6],
    // Bard caps at 6th-level spells. Spells known [0,1,2,3,4,5,6]
    spellsKnownMatrix: [
      /* L1  */ [4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L2  */ [5, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L3  */ [6, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      /* L4  */ [6, 3, 2, 0, 0, 0, 0, 0, 0, 0],
      /* L5  */ [6, 4, 3, 0, 0, 0, 0, 0, 0, 0],
      /* L6  */ [6, 4, 3, 0, 0, 0, 0, 0, 0, 0],
      /* L7  */ [6, 4, 4, 2, 0, 0, 0, 0, 0, 0],
      /* L8  */ [6, 4, 4, 3, 0, 0, 0, 0, 0, 0],
      /* L9  */ [6, 4, 4, 3, 0, 0, 0, 0, 0, 0],
      /* L10 */ [6, 4, 4, 4, 2, 0, 0, 0, 0, 0],
      /* L11 */ [6, 4, 4, 4, 3, 0, 0, 0, 0, 0],
      /* L12 */ [6, 4, 4, 4, 3, 0, 0, 0, 0, 0],
      /* L13 */ [6, 4, 4, 4, 4, 2, 0, 0, 0, 0],
      /* L14 */ [6, 4, 4, 4, 4, 3, 0, 0, 0, 0],
      /* L15 */ [6, 4, 4, 4, 4, 3, 0, 0, 0, 0],
      /* L16 */ [6, 5, 4, 4, 4, 4, 2, 0, 0, 0],
      /* L17 */ [6, 5, 5, 4, 4, 4, 3, 0, 0, 0],
      /* L18 */ [6, 5, 5, 5, 4, 4, 3, 0, 0, 0],
      /* L19 */ [6, 5, 5, 5, 5, 4, 4, 0, 0, 0],
      /* L20 */ [6, 5, 5, 5, 5, 5, 4, 0, 0, 0],
    ],
  },
  'Psion': {
    pool:'psionic', attr:'INT', prep:false,
    pp:           [2, 6, 11, 17, 25, 35, 46, 58, 72, 88, 106, 126, 147, 170, 195, 221, 250, 280, 311, 343],
    maxPowerLvl:  [1, 1,  2,  2,  3,  3,  4,  4,  5,  5,   6,   6,   7,   7,   8,   8,   9,   9,   9,   9],
    powersKnown:  [3, 5,  7,  9, 11, 13, 15, 17, 19, 21,  22,  24,  25,  27,  28,  30,  31,  33,  35,  36],
  },
  'Wilder': {
    pool:'psionic', attr:'CHA', prep:false,
    pp:           [2, 6, 11, 17, 25, 35, 46, 58, 72, 88, 106, 126, 147, 170, 195, 221, 250, 280, 311, 343],
    maxPowerLvl:  [1, 1,  1,  2,  2,  3,  3,  4,  4,  5,   5,   6,   6,   7,   7,   8,   8,   9,   9,   9],
    powersKnown:  [2, 3,  4,  6,  7,  9, 10, 12, 13, 15,  16,  18,  19,  21,  22,  23,  24,  25,  27,  30],
  },
  'Warmind': {
    pool:'psionic', attr:'WIS', prep:false,
    pp:           [1, 2,  3,  5,  7, 11, 15, 19, 23, 27,  35,  43,  51,  59,  67,  79,  91, 103, 115, 127],
    maxPowerLvl:  [1, 1,  1,  2,  2,  2,  3,  3,  3,  4,   4,   4,   5,   5,   5,   6,   6,   6,   6,   6],
    powersKnown:  [1, 2,  3,  4,  5,  6,  7,  8,  9, 10,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20],
  },
  // ----- LESSER CASTERS (Paladin/Ranger: start at L4) -----
  // PP is 0 for L1-L3 (encoded as 0 since handbook shows "—"). PP/maxPowerLvl
  // both 0 for pre-L4 levels.
  'Paladin': {
    // v9.15.2 (§275 F8): HH p.90 — bonus PP apply "if they have a high Wisdom
    // or Charisma score, whichever is better". attrAlt marks the either-or;
    // computeCasterStats picks the better score per computation.
    pool:'divine',  attr:'WIS', attrAlt:'CHA', prep:false,  // HH: "casts their spells spontaneously, like a Saint"
    pp:           [0, 0, 0, 1, 1, 1, 1, 3, 3, 4, 8, 9, 9, 16, 17, 20, 33, 37, 42, 60],
    maxPowerLvl:  [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3,  4,  4,  4,  5,  5,  5,  6],
  },
  'Ranger': {
    pool:'divine',  attr:'WIS', prep:true,
    pp:           [0, 0, 0, 1, 1, 1, 1, 2, 2, 4, 7, 9, 9, 16, 17, 20, 33, 37, 42, 60],
    maxPowerLvl:  [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3,  4,  4,  4,  5,  5,  5,  6],
  },
};

// PP cost per spell/power level, per HH p.404. Index by spell/power level (1-9).
// Level 0 spells/powers (cantrips/orisons) cost 0 PP traditionally — confirmed
// implicit in the system since 0-level slots are tracked separately.
const PP_COST_BY_POWER_LEVEL = {0:0, 1:1, 2:3, 3:5, 4:7, 5:9, 6:11, 7:13, 8:15, 9:17};

// v8.5.4: Adam's pool-level nomenclature (ruled 2026-06) — the four PP pools'
// effective levels carry distinct EXTERNAL names: Effective Arcane Level
// (EAL), Effective Divine Level (EDL), Effective Psionic Level (EPL), and
// Effective Super Level (ESL). The HH itself prints "Effective Manifester
// Level (EML)" for the super pool (p.423: character level + Mutant racial
// level modifier) — ESL is Adam's differentiated term, since "EML" collides
// with the psionic pool's manifester language. Internal identifiers never
// change (pool.cl, st.eml, c.sixLevels — house rule).
const POOL_EFF_LEVEL = {
  arcane:  {abbr:'EAL', full:'Effective Arcane Level',  verb:'caster'},
  divine:  {abbr:'EDL', full:'Effective Divine Level',  verb:'caster'},
  psionic: {abbr:'EPL', full:'Effective Psionic Level', verb:'manifester'},
  super:   {abbr:'ESL', full:'Effective Super Level',   verb:'manifester'},
};

// Compute caster/manifester levels per pool for a character.
// Returns {arcane:N, divine:N, psionic:N} (supernatural is tracked via MP, see
// computeMutationPoints — not yet implemented as a numeric pool in v8.1).
// v8.3.16: computeCasterLevels is now a thin wrapper around computeCasterStats.
// Previously this function had its own caster-pool aggregation logic that
// duplicated (and predated) computeCasterStats. After v8.3.12 added Heritage
// feat CL floor-raising to computeCasterStats but not here, the two
// functions could disagree — leading to the user-reported bug where the
// dashboard "Caster & Manifester Levels" strip showed CL 1 while the Powers
// & Spells panel showed CL 3 for a Wizard 1/Cleric 1/Psion 1 character with
// all three Heritage feats.
//
// Unifying through computeCasterStats means:
//   1. Heritage CL floor-raising applies to prereq checks too (the other
//      remaining callers of this function), fixing a latent bug where a
//      character with Heritage but base CL too low for a CL-gated feat
//      would have been incorrectly rejected.
//   2. Single source of truth — no future divergence possible.
//
// API preserved: returns {arcane:N, divine:N, psionic:N} as integers.
function computeCasterLevels(char) {
  const stats = computeCasterStats(char || {});
  return {
    arcane:  stats.arcane.cl  || 0,
    divine:  stats.divine.cl  || 0,
    psionic: stats.psionic.cl || 0,
  };
}

// v8.3.12: Compute richer per-pool stats including PP/day, bonus PP from
// attribute, max power level, and powers known.
//
// Returns:
//   {
//     arcane:   {cl, ppBase, ppBonus, ppMax, maxPowerLvl, contributors:[{class, level, prep, attr}], ...},
//     divine:   {...},
//     psionic:  {...},
//   }
//
// Per-pool fields:
//   cl:          the pool's effective caster/manifester level — Adam's external
//                names: EAL (arcane) / EDL (divine) / EPL (psionic); see
//                POOL_EFF_LEVEL. Best basic contributor (levels do NOT stack
//                between Basic classes, HH p.53) + Prestige advancer levels,
//                Heritage floor-raised to character level.
//   ppBase:      sum of base PP/day from each contributing class at its level
//   ppBonus:     sum of bonus PP from attribute (per class, using each class's attr)
//                Formula per HH p.16: ceil(attr_mod × CL / 2) — applied per contributing
//                class (since each class has its own attr), then summed.
//   ppMax:       ppBase + ppBonus
//   maxPowerLvl: HIGHEST max-power-lvl across contributing classes (the "depth" cap)
//   contributors: array of {class, level, prep, attr, attrScore, attrMod, classPP, classBonusPP}
//                 — useful for tooltips and breakdown displays
//   powersKnown: For psionic spontaneous casters (Psion, Wilder, Warmind): total
//                running cap, summed across contributors. Each contributor picks from
//                its own class's power list. For arcane spontaneous (Sorcerer, Bard),
//                spellsKnownMatrix is exposed instead (per-spell-level grid).
//   spellsKnown: For Sorcerer + Bard contributors: an array of per-spell-level counts
//                that sums each contributor's per-class matrix. Length 10 (levels 0-9).
//   prep:        true if ANY contributing class is a prepared caster (drives UI for
//                "Prepared Today" sub-panel)
//   saveDcBase:  10 + attr_mod (highest attr mod among contributors). To get final
//                DC, add the spell/power level being cast: DC = saveDcBase + spell_level.
//   attrs:       Set of {INT, WIS, CHA} attributes used by contributing classes — for
//                display when multiple classes use different attrs.
function computeCasterStats(char) {
  const out = {
    arcane:  _emptyPoolStats(),
    divine:  _emptyPoolStats(),
    psionic: _emptyPoolStats(),
  };
  if (!char) return out;
  const classArr = migrateLegacyClasses(char);
  const attrIdx = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};

  for (const e of classArr) {
    const prog = CASTER_PROGRESSION[e.name];
    if (!prog) continue;
    const lvl = Math.max(0, Math.min(20, e.level || 0));
    if (lvl <= 0) continue;
    const lvlIdx = lvl - 1;
    const classPP = prog.pp[lvlIdx] || 0;
    const classMaxPowerLvl = prog.maxPowerLvl[lvlIdx] || 0;
    if (classPP <= 0 && classMaxPowerLvl <= 0) continue;  // pre-L4 lesser caster, contributes nothing yet

    // Bonus PP: ceil(attr_mod × CL_for_this_class / 2)
    // The CL used in bonus PP is THIS class's contribution to the pool, not the
    // aggregate. Full casters use their full class level. Lesser casters
    // (Paladin/Ranger): "At 4th level and higher, their caster level is equal
    // to one-half their [class] level, ROUNDED UP" — both HH class entries.
    // (v8.5.4 EAL/EDL/EPL pass FIX: this previously floored, under-crediting
    // odd-level half-casters by 1 — a Ranger 5 is CL 3, not 2.)
    const meta = CASTER_CLASSES[e.name];
    let clContribution = 0;
    if (meta) {
      if (meta.mode === 'full') clContribution = lvl;
      else if (meta.mode === 'lesser') clContribution = lvl >= 4 ? Math.ceil(lvl / 2) : 0;
    }
    // v8.6.0 firm-wire: casting attributes use the EFFECTIVE score (equipped
    // item enhancements included, derived live) — DCs and bonus PP follow.
    const _effA = (typeof effAttrs === 'function') ? effAttrs(char) : (char.attrs || [10,10,10,10,10,10]);
    // v9.15.2 (§275 F8): attrAlt = either-or casting attribute (Paladin's
    // "Wisdom or Charisma, whichever is better", HH p.90) — take the better
    // score; usedAttr carries the winner into the pool and contributor rows.
    let usedAttr = prog.attr;
    let attrScore = _effA[attrIdx[usedAttr]] || 10;
    if (prog.attrAlt) {
      const _altScore = _effA[attrIdx[prog.attrAlt]] || 10;
      if (_altScore > attrScore) { usedAttr = prog.attrAlt; attrScore = _altScore; }
    }
    const attrMod = Math.floor((attrScore - 10) / 2);
    const classBonusPP = clContribution > 0
      ? Math.ceil(attrMod * clContribution / 2)
      : 0;
    // Negative attrs CAN reduce bonus PP, but only down to 0 — no negative pools.
    const classBonusPPClamped = Math.max(0, classBonusPP);

    const pool = out[prog.pool];
    // v8.5.4 EAL/EDL/EPL pass FIX — HH p.53: power points of a shared type
    // "add those amounts together for one pool", BUT "caster or manifester
    // levels do not stack between Basic classes". The pool's effective level
    // is therefore the BEST basic contributor's CL, not the sum (a Wizard 5 /
    // Sorcerer 5 has EAL 5, not 10 — each casts at its own level; the
    // per-contributor rows show the breakdown). Only Prestige advancer
    // classes stack on top (second pass below), and Heritage floor-raises.
    if (clContribution > pool.cl) pool.cl = clContribution;
    pool.ppBase += classPP;
    pool.ppBonus += classBonusPPClamped;
    if (classMaxPowerLvl > pool.maxPowerLvl) pool.maxPowerLvl = classMaxPowerLvl;
    if (attrMod > pool.bestAttrMod) pool.bestAttrMod = attrMod;
    pool.attrs.add(usedAttr);
    if (prog.prep) pool.prep = true;

    // Powers known (psionic)
    if (Array.isArray(prog.powersKnown)) {
      pool.powersKnownTotal += prog.powersKnown[lvlIdx] || 0;
    }
    // Spells known (Sorcerer/Bard — accumulate per-spell-level)
    if (Array.isArray(prog.spellsKnownMatrix)) {
      const row = prog.spellsKnownMatrix[lvlIdx] || [];
      for (let i = 0; i < row.length; i++) {
        pool.spellsKnown[i] = (pool.spellsKnown[i] || 0) + row[i];
      }
    }

    pool.contributors.push({
      class: e.name,
      level: lvl,
      prep: !!prog.prep,
      attr: usedAttr,
      attrScore,
      attrMod,
      clContribution,
      classPP,
      classBonusPP: classBonusPPClamped,
      classMaxPowerLvl,
    });
  }

  // v8.31.0 REWRITE (Adam's Theurge ruling, 2026-09-23 — gauge finding #1
  // retired the v8.3.12 CL-only model). Advancer levels grant "new spells and
  // power points per day as if they had also gained a level in the [feeder]
  // class" (GMG pp.185-186 Blended/Improved Technique; Archmage's Arcane
  // Spellcasting and Loremaster's Improved Magic/Psionics use the same
  // wording): the FEEDER basic contributor in each advanced pool advances its
  // FULL progression — PP, max spell/power level, spells/powers known, bonus
  // PP, and CL = feeder class level + advancer levels. Pools stay separate
  // (Wilder 4 / Wizard 5 + Psychic Theurge 1 = ML 5 AND CL 6 — Adam's
  // worked example). Per HH p.53 the bonus "only applies to the selected
  // Basic class, chosen at the time of advancing" — per-level selection
  // isn't modeled, so the BEST basic contributor is the feeder (exact for
  // the common single-basic-per-pool case; documented approximation).
  // Stacked advancers compound onto the already-boosted feeder state.
  for (const e of classArr) {
    const meta = CASTER_CLASSES[e.name];
    if (!meta || (!meta.advances && !meta.advancesChoice)) continue;
    if (meta.tier !== e.tier) continue;
    const lvl = Math.max(0, e.level || 0);
    if (lvl <= 0) continue;
    // v8.70.0 (the Advancer Completion): partial-schedule advancers — the
    // meta's advancesAt lists WHICH class levels advance the feeder (the
    // class's own GG table column); absent = every level, the standard.
    const advLvls = Array.isArray(meta.advancesAt) ? meta.advancesAt.filter(m => lvl >= m).length : lvl;
    // v8.70.0 (Adam's either-or ruling, 2026-10-02): CHOICE advancers — the
    // Loremaster's per-level pool pick ("open to improve whatever means by
    // which it was qualified"; the GG's own "some Loremasters opt to
    // diversify") and the Assassin's Improved Methods (DC or advance) —
    // each ATTAINED milestone's pick routes that level's advance, read from
    // classChoices at the time the level is attained.
    const poolAdvance = {};  // pool → advancer levels for THIS class entry
    if (meta.advancesChoice) {
      const ch = meta.advancesChoice;
      for (const m of ch.ms) {
        if (m > lvl) continue;
        const pick = (char.classChoices || {})[ch.base + m];
        const pn = pick ? (ch.map[pick] || null) : (ch.defaultPool || null);
        if (pn) poolAdvance[pn] = (poolAdvance[pn] || 0) + 1;
      }
    } else {
      const targets = Array.isArray(meta.advances) ? meta.advances : [meta.advances];
      for (const poolName of targets) poolAdvance[poolName] = advLvls;
    }
    for (const [poolName, advN] of Object.entries(poolAdvance)) {
      if (!(poolName in out) || advN <= 0) continue;
      const pool = out[poolName];
      // the feeder: best basic contributor with progression data
      let feeder = null;
      for (const ctr of pool.contributors) {
        if (ctr._isAdvancer || ctr._fromHeritage) continue;
        if (!CASTER_PROGRESSION[ctr.class]) continue;
        if (!feeder || (ctr.clContribution || 0) > (feeder.clContribution || 0)) feeder = ctr;
      }
      if (feeder) {
        const prog = CASTER_PROGRESSION[feeder.class];
        const fMeta = CASTER_CLASSES[feeder.class];
        const prevEff = Math.min(20, feeder.level + (feeder._advancedBy || 0));
        const effLvl = Math.min(20, prevEff + advN);  // v8.70.0: schedule/choice-aware
        const oldPP = prog.pp[prevEff - 1] || 0, newPP = prog.pp[effLvl - 1] || 0;
        const newMax = prog.maxPowerLvl[effLvl - 1] || 0;
        let newCl = 0;
        if (fMeta) newCl = fMeta.mode === 'full' ? effLvl : (effLvl >= 4 ? Math.ceil(effLvl / 2) : 0);
        const oldBonus = feeder.classBonusPP || 0;
        const newBonus = Math.max(0, newCl > 0 ? Math.ceil((feeder.attrMod || 0) * newCl / 2) : 0);
        if (Array.isArray(prog.powersKnown)) {
          pool.powersKnownTotal += (prog.powersKnown[effLvl - 1] || 0) - (prog.powersKnown[prevEff - 1] || 0);
        }
        if (Array.isArray(prog.spellsKnownMatrix)) {
          const oldRow = prog.spellsKnownMatrix[prevEff - 1] || [], newRow = prog.spellsKnownMatrix[effLvl - 1] || [];
          for (let i = 0; i < newRow.length; i++) {
            pool.spellsKnown[i] = (pool.spellsKnown[i] || 0) + (newRow[i] || 0) - (oldRow[i] || 0);
          }
        }
        pool.ppBase += (newPP - oldPP);
        pool.ppBonus += (newBonus - oldBonus);
        feeder.classPP = newPP;
        feeder.classBonusPP = newBonus;
        feeder.classMaxPowerLvl = newMax;
        feeder.clContribution = newCl;
        feeder._advancedBy = (feeder._advancedBy || 0) + advN;  // v8.70.0: schedule/choice-aware
        if (newCl > pool.cl) pool.cl = newCl;
        if (newMax > pool.maxPowerLvl) pool.maxPowerLvl = newMax;
      } else {
        // no basic feeder in the pool (GM-exception build): the legacy
        // CL-only stack keeps such characters no worse off than before.
        pool.cl += advN;  // v8.70.0: schedule/choice-aware
      }
      pool.contributors.push({
        class: e.name,
        level: lvl,
        prep: false,            // advancers don't introduce their own prep workflow
        attr: null,
        attrScore: null,
        attrMod: null,
        clContribution: 0,      // the boost rides the feeder's contribution
        classPP: 0,
        classBonusPP: 0,
        classMaxPowerLvl: 0,
        _isAdvancer: true,
        _advancesFeeder: feeder ? feeder.class : null,
      });
    }
    // Perfected Technique (Theurges, class level 10 — GMG p.186): every
    // advanced pool's CL floors at TOTAL character level. "The equivalent of
    // Arcane Heritage and Psionic Heritage" (Adam, 2026-09-23) — the same
    // floor mechanic the Heritage feats use below.
    if (meta.capstoneCharLevel && lvl >= meta.capstoneCharLevel) {
      // (local char level — the Heritage block's `totalLvl` const is declared
      // later in this function; referencing it here is a TDZ error)
      const capCharLvl = char.totalLvl || classArr.reduce((s, x) => s + (x.level || 0), 0);
      // v8.93.2 (Adam's Endrin Fairchilde test case): `targets` was declared
      // inside the standard-advancer ELSE branch above — block-scoped, dead
      // here — so the capstone threw ReferenceError the moment ANY theurge
      // reached class level 10: Perfected Technique crashed the entire
      // caster computation at the exact level it was meant to crown. The
      // pools this capstone floors are the ones this class actually
      // advanced (poolAdvance), falling back to the meta's declared list.
      const capTargets = Object.keys(poolAdvance).length
        ? Object.keys(poolAdvance)
        : (Array.isArray(meta.advances) ? meta.advances : [meta.advances]).filter(Boolean);
      for (const poolName of capTargets) {
        if (poolName in out) out[poolName].cl = Math.max(out[poolName].cl, capCharLvl);
      }
    }
  }

  // v8.3.12: Heritage feat handling.
  // Arcane Heritage / Divine Heritage / Psionic Heritage grant:
  //   1. +2 flat PP to the matching pool (always, regardless of class levels)
  //   2. CL floor-raising: "your effective caster level for that class is now
  //      equal to your character level, regardless of how you may multiclass"
  //      (HH feat text). So Wizard 5 / Sorcerer 5 / Fighter 5 with Arcane
  //      Heritage has EAL 15 (vs the non-stacking default of 5), with Fighter
  //      levels finally counting.
  //   3. If the character has NO class levels in the matching pool, Heritage
  //      grants 1st-level capability of a designated class (Bard/Sorcerer/Wizard
  //      for arcane, Cleric/Saint for divine, Psion/Wilder/Warmind for psionic).
  //      The class-selection UI is deferred to v8.3.13; for now we just record
  //      CL=1 and 2 PP with no specific class.
  // Per HH p.203/210/237. Bonus PP from Heritage is NOT attribute-scaled — it's
  // just a flat +2, granted at the feat's acquisition.
  const featNames = new Set((char.feats || []).map(f => (typeof f === 'string' ? f : f.name)));
  const totalLvl = char.totalLvl || classArr.reduce((s, e) => s + (e.level || 0), 0);
  const heritageMap = {
    'Arcane Heritage':  'arcane',
    'Divine Heritage':  'divine',
    'Psionic Heritage': 'psionic',
  };
  // v8.30.0 REWRITE (Adam's spec, 2026-09-23 — the deferred v8.3.13 class
  // selection finally lands). Each Heritage feat grants TWO things:
  //   1. Pool ECL/EML floor = TOTAL character level — ALWAYS, with or without
  //      class levels ("the character casts / manifests as their character
  //      level"). NOTE: the printed Benefit gates this on taking levels in
  //      the chosen class; Adam ruled it unconditional 2026-09-23 — the
  //      matching book amendment is on his TODO.
  //   2. The 1st-level casting/manifesting capability of a CHOSEN Basic class
  //      (the feat's stored param), which stands down automatically the
  //      moment the character has real levels in that class ("subsumed").
  //   Plus the printed flat +2 PP (never attribute-scaled), in both scenarios.
  // Legacy records without a param keep floor + PP only; the Feats tab offers
  // a ⬦ choose button to pick the class after the fact.
  for (const [feat, poolName] of Object.entries(heritageMap)) {
    if (!featNames.has(feat)) continue;
    const pool = out[poolName];
    const rec = (char.feats || []).find(f => (typeof f === 'string' ? f : f.name) === feat);
    const chosenRaw = (rec && typeof rec !== 'string' && rec.param) ? rec.param : null;
    const chosenBase = chosenRaw === 'Cleric (Druid Option)' ? 'Cleric' : chosenRaw;
    const subsumed = !!(chosenBase && classArr.some(e => e.name === chosenBase && (e.level || 0) > 0));
    pool.cl = Math.max(pool.cl, totalLvl);
    pool.ppBase += 2;
    const prog = (!subsumed && chosenBase) ? CASTER_PROGRESSION[chosenBase] : null;
    if (prog) {
      const attrScore = ((typeof effAttrs === 'function') ? effAttrs(char) : (char.attrs || [10,10,10,10,10,10]))[attrIdx[prog.attr]] || 10;
      const attrMod = Math.floor((attrScore - 10) / 2);
      const cmpl = prog.maxPowerLvl[0] || 0;  // Bard L1 = 0: cantrips only, faithful to the table
      pool.maxPowerLvl = Math.max(pool.maxPowerLvl, cmpl);
      if (prog.prep) pool.prep = true;
      pool.attrs.add(prog.attr);
      if (attrMod > pool.bestAttrMod) pool.bestAttrMod = attrMod;
      if (Array.isArray(prog.powersKnown)) pool.powersKnownTotal += prog.powersKnown[0] || 0;
      if (Array.isArray(prog.spellsKnownMatrix)) {
        const row = prog.spellsKnownMatrix[0] || [];
        for (let i = 0; i < row.length; i++) pool.spellsKnown[i] = (pool.spellsKnown[i] || 0) + row[i];
      }
      pool.contributors.push({
        class: chosenBase,          // real class name — plugs into every token/prep consumer
        level: 1,                   // effective 1st-level member of the class
        prep: !!prog.prep,
        attr: prog.attr,
        attrScore,
        attrMod,
        clContribution: totalLvl,   // grant 1: casts/manifests at character level
        classPP: 2,                 // the feat's flat PP rides this row
        classBonusPP: 0,            // printed: NOT attribute-scaled
        classMaxPowerLvl: cmpl,
        _fromHeritage: true, _heritageFeat: feat, _heritageChoice: chosenRaw,
      });
    } else {
      // Subsumed by real levels in the chosen class, or class not chosen yet:
      // the floor + flat PP remain; access flows from the class itself (or
      // waits on the ⬦ choose button).
      pool.contributors.push({
        class: feat,
        level: 0,
        prep: false,
        attr: null,
        attrScore: null,
        attrMod: null,
        clContribution: 0,  // the floor-raise above carries the CL
        classPP: 2,
        classBonusPP: 0,
        classMaxPowerLvl: 0,
        _fromHeritage: true, _heritageFeat: feat, _heritageChoice: chosenRaw,
      });
    }
  }

  // v9.2.2 (Adam 2026-10-06; HH p.256 + Monk 3, p.87): WILD TALENT — "a
  // psionic character … a reserve of 2 power points" (no manifesting by
  // itself). One grant whatever the route (the feat, a Psi Implant's
  // materialized feat, or the Monk's 3rd-level feature).
  {
    const wtFeat = featNames.has('Wild Talent');
    const wtMonk = classArr.filter(e => e.name === 'Monk').reduce((s, e) => s + (e.level || 0), 0) >= 3;
    if ((wtFeat || wtMonk) && out.psionic) {
      out.psionic.ppBase += 2;
      out.psionic.contributors.push({ class: 'Wild Talent', level: 0, prep: false, attr: null, attrScore: null, attrMod: null, clContribution: 0, classPP: 2, classBonusPP: 0, classMaxPowerLvl: 0, _fromFeat: true });
    }
  }
  // v8.5.4 EAL pass: Spellslinger (arcane/divine) and Power Reservoir
  // (psionic; its 'super' take lands in getSuperPPState) — "bonus power
  // points equal to your character level", level-scaled, pool chosen at feat
  // selection (f.param). Not attribute-scaled, no CL/EAL contribution. These
  // were previously catalogue-only: the PP never reached the pools.
  for (const f of (char.feats || [])) {
    const nm = typeof f === 'string' ? f : (f.name || f.n);
    const pName = (typeof f === 'object' && f) ? f.param : null;
    if ((nm === 'Spellslinger' || nm === 'Power Reservoir') && pName && out[pName]) {
      const pool = out[pName];
      pool.ppBase += totalLvl;
      pool.contributors.push({
        class: nm, level: 0, prep: false, attr: null, attrScore: null,
        attrMod: null, clContribution: 0, classPP: totalLvl, classBonusPP: 0,
        classMaxPowerLvl: 0, _fromFeat: true,
      });
    }
  }

  // v8.16.0 Races pass: Naturally Psionic races (Elan/Maenad/Half-Giant +2
  // PP, Blue/Xeph +1 PP) add their bonus PP to the psionic pool — the racial
  // analogue of the Psionic Heritage flat grant. Contributes only when a
  // psionic pool exists (a Naturally Psionic character with no manifesting
  // class banks the reserve at the table — note-level, like the book).
  {
    // v8.68.0: a Hybrid inherits BOTH parents' Naturally-Psionic bonus PP.
    const _hyPP = (typeof hybridInfo === 'function') ? hybridInfo(char) : null;
    const _rpp = _hyPP ? ((_hyPP.A.bonusPP || 0) + (_hyPP.B.bonusPP || 0)) : ((RACES[char.race] || {}).bonusPP || 0);
    if (_rpp && out.psionic && out.psionic.contributors.length) {
      out.psionic.ppBase += _rpp;
      out.psionic.contributors.push({
        class: `${char.race} (Naturally Psionic)`, level: 0, prep: false, attr: null,
        attrScore: null, attrMod: null, clContribution: 0, classPP: _rpp, classBonusPP: 0,
        classMaxPowerLvl: 0, _fromFeat: true,
      });
    }
  }
  // Finalize: compute ppMax = ppBase + ppBonus; saveDcBase = 10 + bestAttrMod;
  // hasPrepCasters = true if any contributor is a prepared caster (drives UI).
  for (const poolName of ['arcane', 'divine', 'psionic']) {
    const p = out[poolName];
    p.ppMax = p.ppBase + p.ppBonus;
    p.saveDcBase = p.contributors.length > 0 ? (10 + p.bestAttrMod) : null;
    p.hasPrepCasters = p.contributors.some(c => c.prep === true);
    // v8.11.1 Segment B: Spell Power / Mental Potency menu picks raise the
    // pool's effective caster/manifester level (level-dependent variables
    // and caster-level checks).
    if (typeof menuClBonus === 'function' && p.contributors.length) {
      const clb = menuClBonus(char, poolName);
      if (clb) p.cl += clb;
    }
  }
  return out;
}

function _emptyPoolStats() {
  return {
    cl: 0, ppBase: 0, ppBonus: 0, ppMax: 0, maxPowerLvl: 0,
    bestAttrMod: -99, attrs: new Set(),
    hasPrepCasters: false, prep: false,  // 'prep' kept as alias for backcompat; preferred is hasPrepCasters
    powersKnownTotal: 0, spellsKnown: [],
    contributors: [], saveDcBase: null,
  };
}
