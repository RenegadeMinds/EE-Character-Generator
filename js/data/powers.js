// =============================================================================
// js/data/powers.js
// POWERS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Caster progressions and power-point
//   costs, power effects and augments, spell-list tokens, schools, variants
//   and power themes.
//
// KEY NAMES (so you can search for them)
//   tables and state: CASTER_CLASSES, CASTER_PROGRESSION,
//   PP_COST_BY_POWER_LEVEL, POOL_EFF_LEVEL, POWER_EFFECTS, AUGMENT_OPTIONS,
//   PERPETUAL_NOTES, QD_POOL_TOKENS, MAGIC_SCHOOLS, PSI_DISCIPLINES,
//   SPELL_LIST_TOKENS, PSIONIC_SCHOOLS, VARIANT_NAMES, VARIANTS_BY_PARENT,
//   CURE_TIER_NAMES, ROMAN_TIERS, META_PREP_PREFIX, META_FEAT_DEFS,
//   SPONTANEOUS_CASTERS, MENTAL_PINNACLE_PAIRS, POWER_THEMES
//
// WHERE IT CAME FROM
//   Gathered from js/app/52-energy-immunity-and-spell-lists.js,
//   js/app/56-supernatural-attributes-pools-psi-focus.js, js/app/61-casting-
//   augments-and-powers-page.js, js/app/62-power-suites-feats-page-
//   proficiencies.js, js/rules/03-feat-slots-and-caster-progression.js,
//   js/rules/09-item-effects-and-buffs.js, js/rules/21-quickdraw.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

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
// Non-attribute firm-wired effects, bucketed for the typed-bonus engines.
// ============================================================================
// v8.42.0: ACTIVE POWER EFFECTS — the TRANSIENT-WIRED door (Adam's design,
// 2026-09-26; the fourth door beside hard-baked / firm-wired / manual).
// Manifesting a curated power writes a c.activeEffects ledger record whose
// bonus values are computed from the ACTUAL augment spend at cast time; the
// record feeds the typed bonus engine while it stands, and clears on rest
// (all of them — Adam: "all effects wear off at the very least when the
// character rests") or via the chip's ✕ (brief effects like Empty Mind are
// entrusted to the player). NPF: c.nullified suppresses ALL of these
// (Su/magical/psionic/Sp/Ps — Adam's ruling); chips grey, totals drop.
// Curation source: E_E_Buff_Census_2026-09-26.md — every entry below was
// verified against its full d: text (values, augment steps, Divine Favor's
// printed +6 cap, Mental Barrier's SINGLE-step +1-at-4-PP augment).
// `gated:true` = only-when-situational (inactive in totals, listed as
// conditional — the Thick Fur Coat pattern); a bare `cond` is an
// applies-by-default caveat carried in the label only.
// ============================================================================
const POWER_EFFECTS = {
  'Alter Self':            {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — physical qualities per the entry (manual)'},
  'Chameleon':             {eff: [{k:'skill', skill:'Hide', type:'enhancement', v:10}]},
  'Danger Sense':          {eff: [{k:'save', save:'ref', type:'insight', v:4, cond:'vs traps', gated:true}], note: 'uncanny-dodge augment options manual'},
  'Disguise Self':         {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'illusory glamer — hands-on inspection defeats it'},
  'Divine Favor':          {eff: [{k:'attack', type:'luck', v:1, scale:true}, {k:'damage', type:'luck', v:1, scale:true, cond:'weapon damage only'}], aug: {every:3, inc:1, cap:6}},
  'Elfsight':              {eff: [{k:'skill', skill:'Search', type:'untyped', v:2}, {k:'skill', skill:'Spot', type:'untyped', v:2}], note: 'low-light vision manual'},
  'Empty Mind':            {eff: [{k:'save', save:'will', type:'untyped', v:2, scale:true}], aug: {every:2, inc:1}, expires:'manual', note: 'until your next action — dismiss then'},
  'Foresight':             {eff: [{k:'ac', type:'insight', v:2}, {k:'save', save:'ref', type:'insight', v:2}], note: '"never surprised" rider manual'},
  'Glibness':              {eff: [{k:'skill', skill:'Bluff', type:'untyped', v:30, cond:'to convince others of the truth of your words', gated:true}]},
  'Grip of Iron':          {eff: [{k:'grapple', type:'enhancement', v:4, scale:true}], aug: {every:4, inc:1}},
  'Haste':                 {eff: [{k:'attack', type:'untyped', v:1}, {k:'ac', type:'dodge', v:1}, {k:'save', save:'ref', type:'dodge', v:1}], note: 'extra attack on a full attack + speed boost manual'},
  // v8.43.0 (Adam's redirect): the deflection augment is REPEATABLE (+1 per
  // 4 PP, multiple purchases — the "if you spend 4" wording confounded the
  // intent); the INDEPENDENT duration option (+1 round per 1 PP) is player-
  // tracked. Shared-stepper caveat: the wired value assumes augment PP
  // bought the bonus option.
  'Mental Barrier':        {eff: [{k:'ac', type:'deflection', v:4, scale:true}], aug: {every:4, inc:1}, expires:'manual', note: '1 round base — AC and duration purchases are itemized at cast (see the chip)'},
  'Metamorphosis':         {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — other qualities manual'},
  'Metamorphosis, Greater':{eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — other qualities manual'},
  'Metaphysical Claw':     {eff: [{k:'attack', type:'enhancement', v:1, scale:true, cond:'one natural weapon'}, {k:'damage', type:'enhancement', v:1, scale:true, cond:'one natural weapon'}], aug: {every:4, inc:1}, note: 'augment options itemized at cast'},
  'Precognition, Defensive': {eff: [{k:'ac', type:'insight', v:1, scale:true, cond:'void when Dex-denied'}, {k:'save', save:'all', type:'insight', v:1, scale:true, cond:'void when Dex-denied'}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Precognition, Offensive': {eff: [{k:'attack', type:'insight', v:1, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Prescience, Offensive': {eff: [{k:'damage', type:'insight', v:2, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Shadow Body':           {eff: [{k:'skill', skill:'Hide', type:'untyped', v:15, cond:'to remain unnoticed', gated:true}], note: 'shadow-form riders manual'},
  'Steadfast Perception':  {eff: [{k:'skill', skill:'Spot', type:'enhancement', v:6}, {k:'skill', skill:'Search', type:'enhancement', v:6}], note: 'figment/glamer immunity manual'},
  'Thicken Skin':          {eff: [{k:'nac', type:'enhancement', v:1, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'True Strike':           {eff: [{k:'attack', type:'insight', v:20, cond:'next single attack roll'}], expires:'manual', note: 'dismiss after the attack; also ignores concealment miss chance'},
  // ---- v8.43.0 Cut 2: the TRANSIENT-ATTRS door (k:'attr' entries flow
  // through effAttrs via activeBuffAttrDeltas — typed vs the item door,
  // penalties stack, size/inherent/morale ride their own types) + verified
  // Tier C conditionals. Every value transcribed from full d: text. ----
  'Animal Affinity':       {attrChoice: true, eff: [], aug: {every:5}, note: '+4 enhancement to each chosen ability (+1 more choice per 5 augment PP); no bonus PP from boosting your manifesting ability — save DCs do rise (per entry)'},
  'Compression':           {eff: [{k:'attr', attr:'DEX', type:'size', v:2}, {k:'attr', attr:'STR', type:'size', v:-2}, {k:'attack', type:'size', v:1}, {k:'ac', type:'size', v:1}], note: 'one size category smaller — space/reach per entry (manual)'},
  'Divine Power':          {eff: [{k:'attr', attr:'STR', type:'enhancement', v:6}], note: 'BAB becomes your character level (may grant extra attacks) + 1 temp HP/CL — manual'},
  'Dispel [Alignment]':    {eff: [{k:'ac', type:'deflection', v:4, cond:'vs creatures of the targeted alignment', gated:true}], note: 'banishing touch / dispelling touch — manual; discharges on use'},
  'Expansion':             {eff: [{k:'attr', attr:'STR', type:'size', v:2}, {k:'attr', attr:'DEX', type:'size', v:-2}, {k:'attack', type:'size', v:-1}, {k:'ac', type:'size', v:-1}], note: 'one size category larger — space/reach manual; further augment options player-tracked'},
  'Form of Doom':          {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}, {k:'nac', type:'natural', v:5}, {k:'attr', attr:'STR', type:'untyped', v:4}, {k:'dr', v:5, bypass:'—'}], note: 'Frightful Presence on a charge, tentacle attacks — manual (DR wired v8.86.0)'},
  'Graft Weapon':          {eff: [{k:'attack', type:'competence', v:1, cond:'grafted weapon', stacksAnyway:true}, {k:'damage', type:'competence', v:1, cond:'grafted weapon', stacksAnyway:true}], note: '24 hours; the weapon counts as BOTH natural and manufactured (printed stacks-anyway exception)'},
  'Iron Body':             {eff: [{k:'attr', attr:'STR', type:'enhancement', v:6}, {k:'attr', attr:'DEX', type:'untyped', v:-6}, {k:'dr', v:15, bypass:'adamantine'}], note: 'immunities, ½ speed, ASF 50%, ACP −8, iron-golem vulnerabilities — manual (DR wired v8.86.0)'},
  'Mental Pinnacle':       {eff: [{k:'attr', attr:'INT', type:'inherent', v:4}, {k:'attr', attr:'WIS', type:'inherent', v:4}, {k:'attr', attr:'CHA', type:'inherent', v:4}], note: 'minimum 15 each while active (check manually); +2 PP/level and the six-pick powers ride the existing Mental Pinnacle flow'},
  'Oak Body':              {eff: [{k:'attr', attr:'STR', type:'enhancement', v:4}, {k:'attr', attr:'DEX', type:'untyped', v:-2}, {k:'nac', type:'natural', v:5}, {k:'dr', v:10, bypass:'slashing'}], note: 'natural-typed NAC — overlaps (supersedes, never stacks with) existing natural armor; fire vulnerability, ½ speed, ACP −4, ASF 25% — manual (DR wired v8.86.0)'},
  'Righteous / Riotous Might': {eff: [{k:'attr', attr:'STR', type:'size', v:4}, {k:'attr', attr:'CON', type:'size', v:2}, {k:'nac', type:'enhancement', v:2}, {k:'dr', v:5, bypass:'evil-or-good'}], note: 'one size category larger (size AC/attack mods, space/reach) — manual; DR bypass is evil (positive channelers) or good (negative), and the 5 rises to 10 at CL 12 and 15 at CL 15 — apply by caster level at the table'},
  'Transformation':        {eff: [{k:'attr', attr:'STR', type:'enhancement', v:4}, {k:'attr', attr:'DEX', type:'enhancement', v:4}, {k:'attr', attr:'CON', type:'enhancement', v:4}, {k:'nac', type:'natural', v:4}, {k:'save', save:'fort', type:'competence', v:5}, {k:'skill', skill:'Intimidate', type:'competence', v:5}], note: 'BAB = character level + simple/martial proficiency — manual; NO spellcasting or manifesting while active'},
  // ---- v8.86.0 (Adam's Son-of-the-Sun report): the k:'dr' effect kind —
  // Damage Reduction from powers finally reaches computeDR (which had
  // carried "cast-time DR stays manual" since v8.8.0, before the ✨ and ◉
  // lanes existed). The typed-bonus engines ignore k:'dr'; computeDR reads
  // it from _buffEffectSources (transient casts AND perpetual Buffs). ----
  'Stoneskin':             {eff: [{k:'dr', v:10, bypass:'adamantine'}], note: 'cast route: discharges after absorbing 10 points × CL (min 70, max 150) — track at the table; the Super-Power Buff has NO absorption cap (printed: “at will for Super-Power Buff”)'},
  'Biofeedback':           {eff: [{k:'dr', v:2, bypass:'—', scale:true}], aug: {every:3, inc:1}, note: 'power x/− — does NOT stack with the class-level pool (FF p.523, the book’s own example): best applicable applies'},
};

// ============================================================================
// v8.44.0 (Cut 3, Adam's design): OPTION-AWARE AUGMENTS. Powers whose
// Augment offers independent purchases ("one or both of the following ways")
// get PER-OPTION steppers in the cast dialog — the itemized total shown
// before any PP move IS the pre-deduction confirmation Adam asked for, and
// the exact split flows to the wired chip (no more shared-stepper caveats)
// and to the cast result (Energy Current's dice-PP make dice, target-PP
// make targets, DC follows actual dice — not every PP).
// kinds: 'bonus' (feeds the wired effect's scale), 'duration' (+rounds per
// purchase, shown on the chip), 'dice' (damage dice for the result),
// 'count' (result display, e.g. secondary targets), 'flag' (once:true —
// bought or not, display-only). Every step verified against full d: text.
// ============================================================================
const AUGMENT_OPTIONS = {
  'Mental Barrier': [
    {id: 'bonus', label: '+1 deflection AC', step: 4, kind: 'bonus'},
    {id: 'dur',   label: '+1 round duration', step: 1, kind: 'duration', rounds: 1},
  ],
  'Precognition, Defensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Precognition, Offensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Prescience, Offensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Thicken Skin': [
    {id: 'bonus', label: '+1 natural AC', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Metaphysical Claw': [
    {id: 'dur',   label: 'duration becomes 1 hour/level', step: 4, kind: 'flag', once: true, durOverride: '1 hour/level'},
    {id: 'bonus', label: '+1 enhancement (attack & damage)', step: 4, kind: 'bonus'},
  ],
  'Danger Sense': [
    {id: 'ud',  label: 'uncanny dodge', step: 3, kind: 'flag', once: true},
    {id: 'iud', label: 'improved uncanny dodge (as well)', step: 6, kind: 'flag', once: true},
  ],
  'Energy Current (aka Energy Conduit)': [
    {id: 'dice',   label: '+1 die (d6) damage', step: 1, kind: 'dice', dice: {n: 1, d: 6}, dcEveryDice: 2},
    {id: 'target', label: '+1 secondary target', step: 4, kind: 'count', noun: 'secondary target'},
  ],
};

// ============================================================================
// v8.85.0: ◉ PERPETUAL BUFFS — Adam's three rulings (2026-10-03). Anything
// the catalog tags "Buff" is, as a bought super-power, PERPETUALLY in effect
// at no PP cost: (1) voluntarily suppressible (⏻ toggle — reactivation is
// free: "it would cost no PP to toggle the power back on"); (2) "in the
// strictest of terms, the power is ALWAYS manifested" — base values, at the
// character's ESL, unless the entry says otherwise (the diligence sweep found
// the book agreeing out loud: Stoneskin "at will for Super-Power Buff",
// Timeless Body "Permanent as Super-Power", Remove Disease "Mutant immune to
// disease", Freedom "cannot be affected"); (3) rung-priced families stand at
// the rung bought. COMPUTED, NEVER LEDGERED: the lane derives live from the
// owned super-pool records, so rest-clear and ✕ cannot touch it —
// constitution, not casting. SUPERSEDE RULE: invoking the power (0 PP, maybe
// augmented) writes the usual transient record, which outranks the standing
// base; rest clears the casting and the perpetual RESUMES. NPF suppresses
// the lane like every Su bake.
// ============================================================================
const PERPETUAL_NOTES = {
  'Cloak of Chaos':  'perpetual component: Protection from Law only — the full aura is a cast',
  'Holy Aura':       'perpetual component: Protection from Evil only — the full aura is a cast',
  'Shield of Law':   'perpetual component: Protection from Chaos only — the full aura is a cast',
  'Unholy Aura':     'perpetual component: Protection from Good only — the full aura is a cast',
  'Sustenance':      'standing — never needs food or water; the body manufactures its own nourishment',
  'Remove Disease':  'standing — immune to disease (printed: “Permanent; Mutant immune to disease”)',
  'Remove Paralysis':'standing — paralysis and related effects are shrugged off as they land',
  'Freedom':         'standing — cannot be affected by movement-restricting effects (printed in the entry)',
  'Regenerate':      'continuous — severed members regrow; ongoing healing per the entry',
  'Evade Burst':     'standing — the ectoplasmic shell is always ready (evasion rider per the entry)',
  'Know Direction and Location': 'standing — always knows where (and when) they are',
  'Stoneskin':       'at will (printed: “at will for Super-Power Buff”) — DR 10/adamantine; discharge per the entry',
  'Timeless Body (aka Invulnerability)': 'PERMANENT as Super-Power (printed — the GM’s permission is part of the price)',
  'Transformation':  '⚠ NO spellcasting or manifesting while active — suppress (⏻) to cast',
  'Iron Body':       '⚠ carries −6 DEX, half speed, ASF while active — suppress (⏻) to shed the iron',
  'Mental Pinnacle': 'modes chosen once, permanently — manifest the six picks as a Psion of your CL',
  'True Metabolism': 'continuous regeneration per the entry',
};

// Gate-mandated spell picks (knowsPower / powerRepertoire): minimal
// qualifying entries, alphabetical, lowest level first — filtered to the
// pool's base list tokens (levels[].cls), so a Sorcerer never "knows" a
// Cleric-only spell just because it sorted first.
const QD_POOL_TOKENS = {
  arcane:  ['Sor/Wiz', 'Sor', 'Wiz', 'Brd'],
  divine:  ['Clr', 'Drd', 'Pal', 'Rgr'],
  psionic: ['Psion', 'Wilder', 'Warmind'],
};
// v8.94.1: the POOL-AWARE school of a spell. Dual-listed entries print
// "Metacreativity / Conjuration (Creation)" — a psionic DISCIPLINE beside
// the magic SCHOOL. For an arcane/divine repertoire the school is the magic
// token; for psionic, the discipline. First token only as a last resort.
const MAGIC_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Universal'];
const PSI_DISCIPLINES = ['Clairsentience', 'Metacreativity', 'Psychokinesis', 'Psychometabolism', 'Psychoportation', 'Telepathy'];

// ============================================================================
// v8.5.2 Phase C: POWERS & SPELLS — repertoire layer.
// Character data: c.powers[] = {name, pool:'arcane'|'divine'|'psionic',
// grantedAt:{level, atDate}}. Lazily defaulted like c.items/c.feats — no
// schemaVer bump (same deliberate convention as c.items; see that comment).
// Reference data: the inlined SPELLS_DB (643 entries). Budgets come from
// computeCasterStats: powersKnownTotal is only ever contributed by the
// psionic classes (Psion/Wilder/Warmind) — E&E's design gives the other
// casters NO known-count limit, so their pools show "no limit" and only the
// maxPowerLvl gate applies. Per-day PREPARATION for prep casters is
// deliberately NOT tracked (Adam, 2026-07-11: repertoire now, prep later).
// ============================================================================

// Class → spell-list token(s). Tokens match SPELLS_DB levels[].cls. Advisory
// flags mark GM-confirm territory: Saint has no own list token in the corpus
// (mapped to the Cleric list), and Psion discipline powers depend on a chosen
// discipline the generator doesn't yet track.
// v8.5.4: class sub-options are live (Adam's rulings, 2026-08-24, verified
// against the HH class entries):
//   • Cleric — c.clericDomains (2 picks; Expanded/Additional Domain add more
//     later) put their domain tokens on the divine pool. c.druidOption swaps
//     the Cleric onto the Druid list ('Drd') and forfeits domains + Turn
//     Undead ("The Druid Option", end of the HH Cleric entry).
//   • Saint — c.saintDomains (ALL the deity's domains, typically 3-4) ARE the
//     spell list; Personal Domain picks ride through the Powers tab.
//     Unconfigured Saints keep the old Cleric-list advisory fallback.
//   • Psion — c.psionDiscipline hard-gates discipline tokens (HH: "cannot
//     learn powers that are restricted to other disciplines… can't even use
//     such powers by employing psionic items"; Expanded Knowledge is the
//     explicit bypass). Unconfigured Psions keep the GM-confirm advisory.
//   • Wizard — c.wizardProhibited hard-blocks prohibited schools ("can't
//     even cast such spells from scrolls") unless another arcane class also
//     reaches the Sor/Wiz token.
//   • 'War' token disambiguation: 'War' is BOTH the Warmind class list and
//     the War domain. Warmind routes require a psionic-discipline school;
//     divine domain routes require a magic school (see isPsionicSpell).
const SPELL_LIST_TOKENS = {
  'Wizard':   { pool: 'arcane',  tokens: ['Sor/Wiz'] },
  'Sorcerer': { pool: 'arcane',  tokens: ['Sor/Wiz'] },
  'Bard':     { pool: 'arcane',  tokens: ['Brd'] },
  'Cleric':   { pool: 'divine',  tokens: ['Clr'] },
  'Saint':    { pool: 'divine',  tokens: ['Clr'], advisory: 'Saint: choose your deity’s domains in the class options — using the Cleric list until then (GM confirm)' },
  // v8.5.4: Paladin casts spontaneously from their god's Domain lists ("like
  // a Saint", HH Paladin entry) — routed via c.paladinDomains below; the old
  // 'Pal' token matched zero spells in the corpus. Ranger draws from the
  // Druid spell list, prepared like a Cleric (HH Ranger entry) — 'Rgr' was
  // likewise dead. Both cast from 4th level via their lesser progressions.
  'Paladin':  { pool: 'divine',  tokens: [] },
  'Ranger':   { pool: 'divine',  tokens: ['Drd'] },
  'Psion':    { pool: 'psionic', tokens: ['Psi/Wld'], disciplineTokens: ['Telepath', 'Seer', 'Kineticist', 'Egoist', 'Nomad', 'Shaper'] },
  'Wilder':   { pool: 'psionic', tokens: ['Psi/Wld'] },
  'Warmind':  { pool: 'psionic', tokens: ['War'], psionicOnly: true },
};

// v8.5.4: the six psionic discipline school names as they appear in
// school_raw. Distinguishes psionic powers from magic spells — load-bearing
// for the 'War' token disambiguation and discipline gating.
const PSIONIC_SCHOOLS = ['Clairsentience', 'Metacreativity', 'Psychokinesis', 'Psychometabolism', 'Psychoportation', 'Telepathy'];

// v8.5.4: SOURCE-SENSITIVE display names (Adam, 2026-08-24). Ch.IX names many
// entries per-tradition via "Arcane/Divine/Super-Power Variant:" subtitles,
// and each DOMAIN's 1-9 list names its slots in its own idiom — the
// Technology domain's 7th is "Build Database" (= Legend Lore), the Strength
// domain's 1st is "Enlarge Person" (= Expansion). A route therefore knows its
// proper name from HOW the character reaches the spell. Census source:
// domains_substrate/domain_aliases.json (variantNames, harvest_variants.py).
const VARIANT_NAMES = {
  // v8.8.0 (Adam's report — no Buy button on Bull's Strength/Cat's Grace):
  // the Animal Affinity attribute family (recovered bare-Level G6 entries)
  // are variants of the one-size-fits-all parent; superBuySpec prices their
  // super-power purchase at Animal Affinity's 4 MP. (Their Mass versions
  // lack book MP costs entirely — errata territory, not variant-mapped.)
  // v8.16.1: the 2026-09-03 HH's Permanency carries "Psionic Variant:
  // Incarnate" — psionic routes display the variant name.
  'Incarnate':{parent:'Permanency',kind:'Psionic'},
  'Bear’s Endurance':{parent:'Animal Affinity',kind:'Arcane'}, 'Bull’s Strength':{parent:'Animal Affinity',kind:'Arcane'},
  'Cat’s Grace':{parent:'Animal Affinity',kind:'Arcane'}, 'Eagle’s Splendor':{parent:'Animal Affinity',kind:'Arcane'},
  'Fox’s Cunning':{parent:'Animal Affinity',kind:'Arcane'}, 'Owl’s Wisdom':{parent:'Animal Affinity',kind:'Arcane'},
  'Animate Rope':{parent:'Control Object',kind:'Arcane'}, 'Arcane Lock':{parent:'Lock',kind:'Arcane'},
  'Build Database':{parent:'Legend Lore',kind:'Divine'}, 'Charm Animal':{parent:'Charm Being',kind:'Arcane'},
  'Charm Monster':{parent:'Charm Being',kind:'Arcane'}, 'Charm Person':{parent:'Charm Being',kind:'Arcane'},
  'Clairaudience/Clairvoyance':{parent:'Clairvoyant Sense',kind:'Arcane'},
  'Dominate Animal':{parent:'Dominate Being',kind:'Arcane'}, 'Dominate Monster':{parent:'Dominate Being',kind:'Arcane'},
  'Dominate Person':{parent:'Dominate Being',kind:'Arcane'}, 'Enlarge Person':{parent:'Expansion',kind:'Arcane'},
  'Goodberry':{parent:'Sustenance',kind:'Divine'}, 'Hibernate':{parent:'Suspend Life',kind:'Divine'},
  'Hold Animal':{parent:'Hold Being',kind:'Arcane'}, 'Hold Monster':{parent:'Hold Being',kind:'Arcane'},
  'Hold Person':{parent:'Hold Being',kind:'Arcane'}, 'Hold Portal':{parent:'Lock',kind:'Arcane'},
  'Holographic Image':{parent:'Project Image',kind:'Divine'}, 'Hyperalgorithm':{parent:'Hypercognition',kind:'Divine'},
  'Immunity to Disease':{parent:'Remove Disease',kind:'Super-Power'}, 'Immunity to Fear':{parent:'Remove Fear',kind:'Super-Power'},
  'Immunity to Paralysis':{parent:'Remove Paralysis',kind:'Super-Power'}, 'Immunity to Poison':{parent:'Neutralize Poison',kind:'Super-Power'},
  'Instant Summons':{parent:'Retrieve',kind:'Arcane'}, 'Karmic Favor':{parent:'Divine Favor',kind:'Super-Power'},
  'Mage Armor':{parent:'Inertial Armor',kind:'Arcane'}, 'Mage Hand':{parent:'Far Hand',kind:'Arcane'},
  'Message':{parent:'Missive',kind:'Arcane'}, 'Nature’s Avenger':{parent:'Form of Doom',kind:'Divine'},
  'Obscure Object':{parent:'Escape Detection',kind:'Arcane'}, 'Polymorph':{parent:'Metamorphosis',kind:'Arcane'},
  'Reduce Animal':{parent:'Compression',kind:'Arcane'}, 'Reduce Person':{parent:'Compression',kind:'Arcane'},
  'Restore Body':{parent:'Restore Extremity',kind:'Super-Power'}, 'Shield':{parent:'Force Screen / Shield',kind:'Arcane'},
  'Shield Other':{parent:'Share Pain',kind:'Divine'}, 'Spectral Weapon':{parent:'Spiritual Weapon',kind:'Super-Power'},
  'Spell Resistance':{parent:'Power / Spell Resistance',kind:'Arcane'}, 'Telepathic Bond':{parent:'Mindlink',kind:'Arcane'},
  'Teleport Object':{parent:'Teleport, Greater',kind:'Arcane'}, 'Universal Energy Resistance':{parent:'Energy Adaptation',kind:'Super-Power'},
  'Virtual Reality':{parent:'Microcosm',kind:'Divine'}, 'Wildshape':{parent:'Metamorphosis',kind:'Divine'},
  'Zone of Discord':{parent:'Song of Discord',kind:'Super-Power'},
};
const VARIANTS_BY_PARENT = {};
for (const _v in VARIANT_NAMES) {
  const e = VARIANT_NAMES[_v];
  (VARIANTS_BY_PARENT[e.parent] = VARIANTS_BY_PARENT[e.parent] || []).push({name: _v, kind: e.kind});
}

// v8.57.0: consolidated family entries (Cure Wounds "Clr 0-8", Summon
// Nature's Ally "Drd 1-9") memorize at a SPECIFIC tier — name that tier.
const CURE_TIER_NAMES = ['Minor', 'Light', 'Moderate', 'Serious', 'Critical', 'Mass Light', 'Mass Moderate', 'Mass Serious', 'Mass Critical'];
const ROMAN_TIERS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

// v8.63.0 (Adam's B3 ruling): the decorated-name grammar — Magic-feat
// prefixes stack leftward in META_FEAT_DEFS order ("Quickened Extended
// Fireball"); Heighten wears its degree ("Heightened Fireball (to 5th)").
const META_PREP_PREFIX = { 'Enlarge Spell': 'Enlarged', 'Extend Spell': 'Extended', 'Empower Spell': 'Empowered', 'Widen Spell': 'Widened', 'Maximize Spell': 'Maximized', 'Quicken Spell': 'Quickened' };
// ============================================================================
// v8.21.0 SEGMENTS B & C — AUGMENTATION + META- FEATS AT CAST TIME
// (Adam's project, 2026-09-04). Rule sources verified in the HH text:
//   • Augment (p.403): per-entry Augment text; TOTAL PP on one power ≤
//     manifester level; augmenting happens at manifest time.
//   • Magic feats (pp.212-256, flat PP surcharges, cap = spellcaster level):
//     Enlarge +2 · Extend +2 · Empower +4 · Widen +6 · Maximize +6 ·
//     Quicken +8 (banned on spontaneous casts) · Heighten (cost of the new
//     level; DC scales). Spontaneous casters (Saint/Sor/Bard + spontaneous
//     Cure/Inflict + Signature Spells) escalate to a full-round action.
//   • Power feats (expend focus, cap = manifester level): Enlarge +0 ·
//     Extend +2 · Empower +2 · Widen +4 · Maximize +4 · Chain +6 ·
//     Quicken +6. ONE focus per manifestation, so one Power feat per cast
//     (psionic focus = held state; super focus = the move-action momentary
//     kind, logged as part of the manifestation). Opportunity Power is
//     reactive (AoO) and lives at the table, not in this proactive flow.
//   • Overchannel (p.234): +1 EPL (to +2 @EPL 8, +3 @15) for 1d8/3d8/5d8
//     damage — offered as a toggle that raises the augment cap and rolls
//     its price (Talented: expend focus to avoid on powers ≤3rd).
// 132/668 entries carry Augment text; 106 follow the standard "For every
// [N] additional power point(s)" pattern and get COMPUTED dice/DC scaling;
// the rest surface their text beside the same capped PP stepper.
const META_FEAT_DEFS = {
  spell: [
    { name: 'Enlarge Spell',  pp: 2, chk: s => /\b(close|medium|long)\b/i.test(s.range || ''), why: 'range must be close/medium/long', fx: 'range +100%' },
    { name: 'Extend Spell',   pp: 2, chk: s => !/(instantaneous|concentration|permanent)/i.test(s.duration || 'instantaneous'), why: 'no instantaneous/concentration/permanent durations', fx: 'duration ×2' },
    { name: 'Empower Spell',  pp: 4, chk: () => true, fx: 'variable numeric effects +50%' },
    { name: 'Widen Spell',    pp: 6, chk: s => /(burst|emanation|line|spread)/i.test(s.area || ''), why: 'area must be burst/emanation/line/spread', fx: 'area measurements +100%' },
    { name: 'Maximize Spell', pp: 6, chk: () => true, fx: 'variable numeric effects maximized' },
    { name: 'Quicken Spell',  pp: 8, chk: s => !/(minute|hour|day|round)/i.test(s.casting_time || '') || /1 round\b/i.test(s.casting_time || ''), why: 'casting time over 1 full round', fx: 'swift action; no AoO; one per round' },
  ],
  power: [
    { name: 'Enlarge Power',  pp: 0, chk: s => /\b(close|medium|long)\b/i.test(s.range || ''), why: 'range must be close/medium/long', fx: 'range +100%' },
    { name: 'Extend Power',   pp: 2, chk: s => !/(instantaneous|concentration|permanent)/i.test(s.duration || 'instantaneous'), why: 'no instantaneous/concentration/permanent durations', fx: 'duration ×2' },
    { name: 'Empower Power',  pp: 2, chk: () => true, fx: 'variables +50% (augment first, then ×1.5)' },
    { name: 'Widen Power',    pp: 4, chk: s => /(burst|emanation|line|spread)/i.test(s.area || ''), why: 'area must be burst/emanation/line/spread', fx: 'area measurements +100%' },
    { name: 'Maximize Power', pp: 4, chk: () => true, fx: 'variables maximized (augmented dice included)' },
    { name: 'Chain Power',    pp: 6, chk: s => !!(s.damage && !/(burst|emanation|line|spread)/i.test(s.area || '') && (s.damage.is_template || /(acid|cold|electricity|fire|sonic)/i.test(s.damage.type || ''))), why: 'single-target acid/cold/electricity/fire/sonic damage only', fx: 'arcs to ≤ML secondary targets (max 20) within 30 ft at half damage' },
    { name: 'Quicken Power',  pp: 6, chk: s => !/(minute|hour|day)/i.test(s.casting_time || ''), why: 'manifesting time over 1 round', fx: 'swift action; no AoO; one per round' },
  ],
};
const SPONTANEOUS_CASTERS = new Set(['Sorcerer', 'Bard', 'Saint']);

// ============================================================================
// v8.25.0 MENTAL PINNACLE (Adam's 09-06a rebuild, HH p.574): six picks across
// the five attack/defense OR-pairs — the 1st-edition homage ("the Five Attack
// Modes and the Five Defense Modes") — plus one floater from the remainder.
// The pairing STRUCTURALLY guarantees at least one of each kind. Spell route:
// chosen at each casting. Super-Power Buff route: permanent once chosen
// (stored as c.mentalPinnacle.picks).
const MENTAL_PINNACLE_PAIRS = [
  ['Mind Thrust', 'Empty Mind'],
  ['Ego Whip', 'Thought Shield'],
  ['Psionic Blast', 'Mental Barrier'],
  ['Id Insinuation', 'Intellect Fortress'],
  ['Psychic Crush', 'Tower of Iron Will'],
];
// ============================================================================
// v8.74.0 (Adam's mission): SUPER-POWER SUITES BY THEME — HH Ch.XI (pp.670+)
// classifies the spell/power corpus into 47 thematic suites ("a different
// perspective from which to build", esp. for super-mutants, who may buy up
// to 9th-level spells & powers at creation with GM permission). Extracted
// from the HH docx in flow order (the PDF text interleaves columns); names
// reconciled to SPELLS_DB: 618 exact + alias map (the theme list's 3.5-era
// names — Expeditious Retreat→Route, Sound Blast→Burst, Transport via
// Plants→Teleport, Greater [its Druid Variant], Energy Resistance→Resist
// Energy [the book's own "See" cross-reference], alignment-specific
// entries→their [Alignment] umbrellas, aka-suffixed psionics) + 19 variant
// display names resolved through VARIANT_NAMES parents at set-build time.
// 1,095 entries, 100% reaching a real catalogue power. SUITE RULE (p.670,
// table-side for now): own two powers from one suite and further powers
// from that suite cost 1 MP less — surfaced in the filter tooltip; wiring
// the discount into MP purchase math awaits Adam's ruling.
const POWER_THEMES = {
  'Acid': ['Acid Arrow','Acid Fog','Breath of the Black Dragon','Dissolving Touch','Dissolving Weapon','Exhalation of the Black Dragon','Storm of Vengeance'],
  'Air and Lightning': ['Call Lightning','Call Lightning Storm','Chain Lightning','Control Air','Control Electricity','Control Winds','Electromagnetic Pulse','Feather Fall','Fly','Gust of Wind','Ionic Bolt','Lightning Bolt','Overland Flight','Planar Ally','Shocking Grasp','Shutdown','Tornado Blast','Whirlwind','Whispering Wind','Wind Walk','Wind Wall'],
  'Aligned': ['Align Weapon','Detect [Alignment]','Dispel [Alignment]','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]','Undetectable Alignment'],
  'Animals': ['Animal Affinity','Animal Growth','Animal Messenger','Animal Trance','Bite of the Wolf','Catfall','Chameleon','Claws of the Beast','Creeping Doom','Detect Animals or Plants','Lion’s Charge','Magic Fang','Magic Fang, Greater','Metaphysical Claw','Mount','Poison','Repel Vermin','Scent of the Quarry','Speak with Animals','Spider Climb','Summon Nature’s Ally (I-IX)','Summon Swarm','Wildshape'],
  'Astral Savant': ['Astral Construct','Astral Projection','Bolt','Concealing Amorpha','Concealing Amorpha, Greater','Creation, Major','Creation, Minor','Crystal Shard','Crystallize','Dismiss Ectoplasm','Ecto Protection','Ectoplasmic Cocoon','Ectoplasmic Cocoon, Mass','Ectoplasmic Form','Entangling Ectoplasm','Evade Burst','Grease (aka Ectoplasmic Sheen)','Hail of Crystals','Planar Ally','Remote Viewing','Swarm of Crystals','Wall of Ectoplasm'],
  'Bane': ['Bane','Bestow Curse','Blindness/Deafness','Deceleration','Doom','Mind Fog','Poison','Ray of Enfeeblement','Ray of Exhaustion','Slow','Waves of Exhaustion','Waves of Fatigue','Web'],
  'Bazaar of the Bizarre': ['Black Tentacles','Form of Doom','Quintessence','Transformation'],
  'Boon': ['Aid','Animal Affinity','Barkskin','Biofeedback','Blur','Burst','Chameleon','Displacement','Expeditious Route','Freedom of Movement','Grip of Iron','Heroism','Heroism, Greater','Immovability','Jump','Longstrider','Prayer','Protection from [Alignment]','Regenerate','Resistance','Scent of the Quarry','See Invisibility','Synchronicity'],
  'Chaos and Luck': ['Chaos Hammer','Cloak of Chaos','Detect [Alignment]','Dispel [Alignment]','Entropic Shield','Fate of One','Freedom','Karmic Favor','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]','Synchronicity','Word of Chaos'],
  'Dimensional Traveler': ['Anchored Navigation','Astral Projection','Baleful Teleport','Banishment','Blink','Call Weaponry','Decerebrate','Detect Teleportation','Dimension Door','Dimension Slide','Dimension Swap','Dimensional Anchor','Dimensional Lock','Dissipating Touch','Divert Teleport','Ethereal Jaunt','Etherealness','Gate','Instant Reload','Maze','Phase Step','Plane Shift','Retrieve','Teleport','Teleport, Greater','Teleport Trigger','Time Hop','Time Hop, Mass','Trace Teleport','Tree Stride'],
  'Divine Faith': ['Aid','Banishment','Bless','Bless Weapon','Commune','Contact Other Plane','Divine Favor','Divine Power','Disrupting Weapon','Flame Strike','Mark of Justice','Miracle','Planar Ally','Prayer','Purify Food and Drink','Righteous / Riotous Might','Sanctuary','Shield of Faith','Spiritual Weapon','Synchronicity'],
  'Diviner': ['Clairtangent Hand','Clairvoyant Sense','Commune','Contact Other Plane','Contingency','Danger Sense','Destiny Dissonance','Detect [Alignment]','Detect Remote Viewing','Discern Lies','Discern Location','Divination','Fate Link','Fate of One','Find the Path','Find Traps','Foresight','Know Direction and Location','Legend Lore','Locate Creature','Locate Object','Moment of Prescience','Object Reading','Precognition','Precognition, Combat','Precognition, Defensive','Precognition, Greater','Precognition, Offensive','Prescience, Offensive','Prying Eyes','Prying Eyes, Greater','Read Magic','Recall Agony','Recall Death','Remote Viewing','Scrying','Scrying, Greater','Second Chance','See Invisibility','Speak with Animals','Speak with Dead','Speak with Plants','Status','Tongues','Trace Teleport','True Seeing','True Strike','Ubiquitous Vision','Vision'],
  'Dreams': ['Deep Slumber','Dream','Dream Travel','False Sensory Input','Fly','Form of Doom','Microcosm','Nightmare','Phantasmal Killer','Remote Viewing','Sleep'],
  'Earth Lord': ['Earthquake','Immovability','Iron Body','Meld into Stone','Move Earth','Planar Ally','Repel Metal or Stone','Reverse Gravity','Rusting Grasp','Soften Earth and Stone','Spike Stones','Stomp','Stone Shape','Stoneskin','Stone Tell','Transmute Mud to Rock','Transmute Rock to Mud','Wall of Stone'],
  'Empath': ['Affinity Field','Attraction','Aversion','Calm Animals','Calm Emotions','Cause Fear','Crushing Despair','Danger Sense','Detect Hostile Intent','Doom','Empathic Feedback','Empathic Transfer','Empathic Transfer, Hostile','Empathy','Fear','Good Hope','Rage','Sensitivity to Psychic Impressions','Share Pain','Share Pain, Forced','Telempathic Projection'],
  'Energy Wielders': ['Energy Blast','Energy Bolt','Energy Cone (aka Dragon’s Breath)','Energy Conversion','Energy Current (aka Energy Conduit)','Energy Missile','Energy Push (aka Energy Charge)','Energy Ray','Resist Energy','Energy Retort (aka Energy Backlash)','Energy Stun (aka Energy Overload)','Energy Wall','Energy Wave (aka Wyrm’s Breath)','Protection from Energy','Universal Energy Resistance','Whitefire'],
  'Evil and Profane': ['Animate Dead','Bane','Bestow Curse','Blasphemy','Contagion','Create Undead','Creeping Doom','Death Knell','Death Urge','Deathwatch','Detect [Alignment]','Dispel [Alignment]','Eyebite','Finger of Death','Magic Circle Against [Alignment]','Mind Seed','Nightmare','Planar Ally','Protection from [Alignment]','Unholy Aura','Unholy Blight'],
  'Fire Friend': ['Burning Hands','Control Flames','Fiery Discorporation','Fire Seeds','Fire / Chill Shield','Fire Storm','Fireball','Flame Arrow / Bullet','Flame Blade','Flame Strike','Flaming Sphere','Heat Metal','Incendiary Cloud','Matter Agitation','Meteor Swarm','Planar Ally','Produce Flame','Pyrotechnics','Scorching Ray','Wall of Fire'],
  'Force Adept': ['Blade Barrier','Clenched Fist of Force','Concussion Blast','Crushing Hand of Force','Force Screen / Shield','Forcecage','Forceful Hand of Force','Grasping Hand of Force','Inertial Armor','Interposing Hand of Force','Magic Missile','Repulsion Field','Resilient Sphere','Spiritual Weapon','Unseen Servant','Wall of Force'],
  'Gaseous Assassin': ['Acid Fog','Cloudkill','Fog Cloud','Gaseous Form','Incendiary Cloud','Mind Fog','Obscuring Mist','Solid Fog','Stinking Cloud','Wind Walk'],
  'Good': ['Detect [Alignment]','Dispel [Alignment]','Good Hope','Holy Aura','Holy Smite','Holy Word','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]'],
  'Healer': ['Body Adjustment','Body Purification','Cure Wounds','Heal','Heal, Mass','Immunity to Disease','Immunity to Poison','Psychic Chirurgery','Raise Dead','Recharge','Regenerate','Remove Blindness/Deafness','Remove Curse','Restoration','Restoration, Greater','Restoration, Lesser','Restore Body','Resurrection','True Resurrection'],
  'Ice Mastery': ['Chill Metal','Cone of Cold','Fire / Chill Shield','Freezing Sphere','Ice Storm','Matter Inertia','Polar Ray','Wall of Ice'],
  'Illusions and Shadows': ['Blur','Displacement','Glitterdust','Hallucinatory Terrain','Hypnotic Pattern','Illusory Wall','Invisibility','Invisibility, Greater','Invisibility, Mass','Machine Invisibility','Magic Aura','Major Image','Mask Metal','Minor Image','Mirage Arcana','Mirror Image','Misdirection','Mislead','Nightmare','Permanent Image','Persistent Image','Phantasmal Killer','Project Image','Rainbow Pattern','Scintillating Pattern','Seeming','Shades','Shadow Body','Shadow Conjuration','Shadow Conjuration, Greater','Shadow Evocation','Shadow Evocation, Greater','Shadow Walk','Silence','Silent Image','Veil','Ventriloquism','Weird'],
  'Law': ['Detect [Alignment]','Dictum','Dispel [Alignment]','Magic Circle Against [Alignment]','Mark of Justice','Order’s Wrath','Planar Ally','Protection from [Alignment]','Shield of Law','True Seeing','Zone of Truth'],
  'Matter Master': ['Baleful Polymorph','Bend Reality','Compression','Creation, Major','Creation, Minor','Creation, True','Fission','Flesh to Stone','Fly','Fuse Flesh','Fusion','Graft Weapon','Heal','Heat Metal','Immovability','Iron Body','Limited Wish','Matter Agitation','Matter Inertia','Matter Manipulation','Oak Body','Phantom Chopper','Phantom Steed','Polymorph Any Object','Regenerate','Repel Metal or Stone','Repel Wood','Rusting Grasp','Shades','Stone to Flesh','Stoneskin','Sustenance','Transmute Mud to Rock','Transmute Rock to Mud','Warp Wood'],
  'Machine Maester': ['Animate Objects','Burglar’s Buddy','Clean','Control Object','Creation, Major','Creation, Minor','Creation, True','Dataread','Degauss','Electromagnetic Pulse','Electronic Fog','Fabricate','Graft Weapon','Haywire','Instant Connectivity','Instant Reload','Ionic Bolt','Knock','Lock','Machine Invisibility','Make Repairs','Mask Metal','Matter Manipulation','Object Reading','Phantom Chopper','Polymorph Any Object','Power Device','Protection from Arrows / Bullets','Recharge','Relay Text','Repel Metal or Stone','Repel Wood','Rusting Grasp','Shatter','Shrink Item','Shutdown','Signal Feed','Trace Purge','Wall of Iron','White Noise','Wire Walk','Wood Shape'],
  'Metapower and Dispelling': ['Aura Alteration','Bestow Power','Break Enchantment','Detect Magic & Psionics','Dispel Magic & Psionics','Dispelling Buffer','Divert Teleport','Escape Detection','Feat Leech','Leech Field','Metaconcert','Misdirection','Nondetection','Null Power Field','Power Leech','Apopsi (aka “Power Purge”)','Catapsi (aka Power Suppression)','Protection from Spells and Powers','Remove Curse','Spell / Power Turning','Shatter Mind Blank','Spell / Power Immunity','Spell / Power Immunity, Greater'],
  'Mindkiller': ['Brain Lock','Cause Fear','Confusion','Confusion, Lesser','Crisis of Breath','Crisis of Life','Death Urge','Decerebrate','Disable','Ego Whip','Fear','Feeblemind','Hold Being','Id Insinuation','Inflict Pain','Insanity','Mental Pinnacle','Microcosm','Mind Fog','Mind Seed','Nightmare','Personality Parasite','Phantasmal Killer','Power Leech','Psionic Blast','Psychic Crush','Psychic Vampire','Recall Agony','Recall Death','Scare','Share Pain, Forced','Shatter Mind Blank','Touch of Idiocy','Ultrablast','Weird'],
  'Moon and Night': ['Darkness','Darkvision','Deep Slumber','Nightmare','Phantasmal Killer','Shades','Shadow Body','Sleep'],
  'Nature & the Natural World': ['Animal Messenger','Animate Plants','Barkskin','Blight','Call Lightning','Call Lightning Storm','Calm Animals','Commune with Nature','Contagion','Control Plants','Control Weather','Creeping Doom','Detect Animals or Plants','Detect Snares and Pits','Endure Elements','Entangle','Faerie Fire','Giant Vermin','Gust of Wind','Hide from Animals','Immunity to Poison','Insect Plague','Mount','Oak Body','Obscuring Mist','Pass without Trace','Plant Growth','Poison','Regenerate','Repel Vermin','Repel Wood','Scent of the Quarry','Sleep','Sleet Storm','Speak with Animals','Speak with Plants','Spider Climb','Spike Growth','Storm of Vengeance','Summon Nature’s Ally (I-IX)','Summon Swarm','Tornado Blast','Teleport, Greater','Tree Shape','Tree Stride','Wall of Thorns','Web','Wood Shape'],
  'Necromancy': ['Animate Dead','Antilife Shell','Blight','Chill Touch','Control Undead','Create Undead','Death Knell','Death Ward','Deathwatch','Detect Undead','Energy Drain','Enervation','Eyebite','Finger of Death','Halt Undead','Harm','Hide from Undead','Horrid Wilting','Inflict Wounds','Paralyzing Touch','Poison','Ray of Enfeeblement','Ray of Exhaustion','Scare','Slay Living','Speak with Dead','Spectral Hand','Touch of Fatigue','Vampiric Touch','Via Negativa','Wail of the Banshee','Waves of Exhaustion','Waves of Fatigue'],
  'Overpower': ['Assimilate','Bend Reality','Command','Command, Greater','Control Body (aka “Puppeteer”)','Control Object','Control Weather','Death Knell','Death Urge','Demand','Destiny Dissonance','Destruction','Disintegrate','Dissipating Touch','Dominate Being','Energy Drain','Expansion','Finger of Death','Fly','Gate','Globe of Invulnerability','Harm','Hold Being','Implosion','Limited Wish','Mental Pinnacle','Metamorphosis, Greater','Meteor Swarm','Mind Seed','Mind Thrust','Miracle','Null Power Field','Planar Ally','Polymorph Any Object','Power Word: Blind','Power Word: Kill','Power Word: Stun','Precognition, Greater','Psychic Crush','Reality Revision','Regenerate','Resurrection','Reverse Gravity','Shades','Slay Living','Storm of Vengeance','Summon Monster (I-IX)','Telekinesis (aka “TK”)','Teleport, Greater','Temporal Stasis','Time Regression','Timeless Body (aka Invulnerability)','True Metabolism','True Resurrection','True Seeing','Wish'],
  'Protective': ['Barkskin','Biofeedback','Blur','Cloak of Chaos','Concealing Amorpha','Concealing Amorpha, Greater','Death Ward','Displacement','Endure Elements','Resist Energy','Entropic Shield','Escape Detection','Evade Burst','Fire / Chill Shield','Force Screen / Shield','Globe of Invulnerability','Globe of Invulnerability, Lesser','Inertial Armor','Inertial Barrier','Interposing Hand of Force','Intellect Fortress','Iron Body','Mental Barrier','Mind Blank','Mirror Image','Misdirection','Nondetection','Null Power Field','Obscuring Mist','Power / Spell Resistance','Prayer','Prismatic Sphere','Prismatic Wall','Protection from Arrows / Bullets','Protection from [Alignment]','Protection from Energy','Protection from Spells and Powers','Sanctuary','Spell / Power Turning','Sequester','Shield of Faith','Shield of Law','Shield Other','Spell / Power Immunity','Spell / Power Immunity, Greater','Universal Energy Resistance'],
  'Resilience': ['Adapt Body','Biofeedback','Immunity to Disease','Immunity to Fear','Immunity to Paralysis','Immunity to Poison','Iron Body','Oak Body','Power / Spell Resistance','Protection from Energy','Protection from Spells and Powers','Regenerate','Remove Blindness/Deafness','Thicken Skin','True Metabolism','Universal Energy Resistance','Vigor'],
  'Self-Mastery': ['Adapt Body','Biofeedback','Body Adjustment','Body Equilibrium','Body Purification','Empty Mind','Good Hope','Heroism','Heroism, Greater','Immunity to Disease','Immunity to Fear','Immunity to Paralysis','Immunity to Poison','Mental Pinnacle','Mind Blank','Prowess','Psychofeedback','Regenerate','Scent of the Quarry','Schism','Steadfast Perception','Suspend Life','Sustenance','Thicken Skin','True Metabolism'],
  'Senses': ['Arcane Sight','Aura Sight','Clairvoyant Sense','Danger Sense','Darkvision','Deathwatch','Detect [Alignment]','Detect Animals or Plants','Detect Hostile Intent','Detect Magic & Psionics','Detect Remote Viewing','Detect Secret Doors','Detect Snares and Pits','Detect Teleportation','Detect Thoughts','Detect Undead','Elfsight','Locate Creature','Locate Object','Precognition','Precognition, Combat','Precognition, Defensive','Precognition, Greater','Precognition, Offensive','Prescience, Offensive','Remote Viewing','Scent of the Quarry','See Invisibility','Steadfast Perception','Synesthete','Touchsight','True Seeing','Ubiquitous Vision'],
  'Shapeshifter': ['Alter Self','Compression','Expansion','Fission','Fusion','Gaseous Form','Grip of Iron','Iron Body','Meld into Stone','Metamorphosis','Metamorphosis, Greater','Oak Body','Regenerate','Shadow Body','Stoneskin','Thicken Skin','Transformation','Wind Walk'],
  'Sonic Specialist': ['Blasphemy','Command','Command, Greater','Control Sound','Create Sound','Dictum','Holy Word','Power Word: Blind','Power Word: Kill','Power Word: Stun','Sculpt Sound','Shatter','Shout','Shout, Greater','Silence','Song of Discord','Sound Burst','Suggestion (Mass)','Sympathetic Vibration','Ventriloquism','Wail of the Banshee','Whispering Wind','Word of Chaos','Zone of Silence'],
  'Speed Demon': ['Burst','Expeditious Route','Fly','Haste','Hustle','Jump','Lion’s Charge','Longstrider','Overland Flight','Prowess','Skate','Temporal Acceleration','Time Stop'],
  'Sun and Spectrum': ['Color Spray','Control Light','Daylight','Fly','Glitterdust','Hypnotic Pattern','Invisibility','Invisibility, Greater','Invisibility, Mass','Invisibility Purge','Invisibility Sphere','Minor Image','Mirror Image','My Light','Prismatic Sphere','Prismatic Spray','Prismatic Wall','Rainbow Pattern','Scintillating Pattern','Searing Light','Sunbeam','Sunburst'],
  'Supra-Genius': ['Call to Mind','Comprehend Languages','Conceal Thoughts','Contingency','Detect Magic & Psionics','Detect Secret Doors','Detect Snares and Pits','Fate of One','Find the Path','Find Traps','Foresight','Glibness','Hypercognition','Identify','Know Direction and Location','Legend Lore','Locate Creature','Locate Object','Metafaculty','Mind Blank','Mind Trap','Mislead','Prying Eyes','Prying Eyes, Greater','Psychofeedback','Read Magic','Schism','Second Chance','Sense Link','Sensitivity to Psychic Impressions','Steadfast Perception','Thought Shield','Tongues','True Strike','Ubiquitous Vision'],
  'Telekinetic': ['Far Hand','Floating Disk','Fly','Force Screen / Shield','Inertial Barrier','Intellect Fortress','Knock','Levitate','Lock','Telekinesis (aka “TK”)','Telekinetic Sphere','Touchsight','Unseen Servant'],
  'Telepath': ['Attraction','Aversion','Brain Lock','Brain Spider','Cloud Mind','Cloud Mind, Mass','Conceal Thoughts','Confusion','Confusion, Lesser','Correspond','Daze Creature','Detect Thoughts','Distract','False Sensory Input','Id Insinuation','Mental Disruption','Metaconcert','Mind Blank','Mind Probe','Mind Seed','Mind Switch','Mind Switch, True','Mindlink','Mindlink, Thieving','Mindwipe','Missive','Missive, Mass','Modify Memory','Personality Parasite','Phantasmal Killer','Psionic Blast','Psychic Chirurgery','Schism','Sending','Sense Link','Sense Link, Forced','Tower of Iron Will','Ultrablast'],
  'Warrior': ['Animal Affinity','Bite of the Wolf','Call Weaponry','Claw of Energy','Claws of the Beast','Claws of the Vampire','Danger Sense','Detect Hostile Intent','Disrupting Weapon','Dissolving Touch','Dissolving Weapon','Duodimensional Claw','Float','Freedom of Movement','Ghost Shot','Graft Weapon','Grip of Iron','Hammer','Haste','Hustle','Instant Reload','Jump','Keen Edge','Lion’s Charge','Metaphysical Weapon','Painful Strike','Precognition, Combat','Precognition, Defensive','Precognition, Offensive','Prescience, Offensive','Prevenom','Prevenom Weapon','Prowess','Psychic Vampire','Rage','Stomp','Strength of the Enemy','Transformation','True Strike','Truevenom','Truevenom Weapon','Vampiric Blade','Weapon of Energy'],
  'Water Wyrd': ['Control Water','Create Water','Float','Freezing Sphere','Horrid Wilting','Ice Storm','Planar Ally','Quench','Sleet Storm','Water Breathing','Water Walk'],
  'Willbender': ['Attraction','Aversion','Charm Being','Charm Person','Command','Command, Greater','Confusion','Confusion, Lesser','Control Body (aka “Puppeteer”)','Control Plants','Control Undead','Demand','Dominate Being','Enthrall','False Sensory Input','Geas/Quest','Geas, Lesser','Glibness','Good Hope','Halt Undead','Hold Being','Hypnotic Pattern','Hypnotism','Scare','Sleep','Suggestion (Mass)','Zone of Truth'],
};
