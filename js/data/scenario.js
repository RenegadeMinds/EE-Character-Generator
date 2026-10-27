// =============================================================================
// js/data/scenario.js
// SCENARIO — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. The Six Scales, scenario presets and
//   the scenario-title vocabulary.
//
// KEY NAMES (so you can search for them)
//   tables and state: SIX_LEVELS, SCENARIO_PRESETS, PRESET_LEGACY,
//   SCEN_AXES, SCENARIO_AXIS_VOCAB
//
// WHERE IT CAME FROM
//   Gathered from js/rules/05-six-scales-and-scenarios.js,
//   js/rules/20-scenario-titles-and-heroic-resources.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// SIX SCALES OF THE SCENARIO — set by the GM, gate which DxD20 rules apply to the campaign.
// Each is rated 0 (absent) through 9 (ubiquitous). See GM's Guide Chapter II for full details.
const SIX_LEVELS = {
  arcane: {
    label: 'Arcane Scale',
    short: 'Arcane',
    desc: 'How prevalent magic is in the scenario',
    tiers: [
      'No arcane magic — Sorcerer/Wizard unavailable, Bard has no spells, no arcane skills/feats',
      'Low-powered arcane magic, max 5th-level spells, magic items rare',
      'Low-powered arcane magic, 1st-level item market exists',
      'Low-powered arcane magic, 2nd-level item market exists',
      'Low-powered arcane magic, 3rd-level item market exists',
      'High-powered arcane magic, max 9th-level spells, items rare',
      'High-powered arcane magic, 1st-level item market exists',
      'High-powered arcane magic, 2nd-level item market exists',
      'High-powered arcane magic, 3rd-level item market exists',
      'Ubiquitous arcane magic, 5th-level item market, all chars get Use Magic Device',
    ],
  },
  divine: {
    label: 'Divine Scale',
    short: 'Divine',
    desc: 'How involved the gods are in the scenario',
    tiers: [
      'No divine magic — Cleric/Paladin/Saint unavailable, Ranger has no spells, no divine skills/feats',
      'Low-powered divine magic, max 5th-level spells, divine items are rare relics',
      'Low-powered divine magic, 1st-level item market exists',
      'Low-powered divine magic, 2nd-level item market exists',
      'Low-powered divine magic, 3rd-level item market exists',
      'High-powered divine magic, max 9th-level spells, items rare',
      'High-powered divine magic, 1st-level item market exists',
      'High-powered divine magic, 2nd-level item market exists',
      'High-powered divine magic, 3rd-level item market exists',
      'Ubiquitous divine magic, 5th-level item market, all chars get Use Magic Device',
    ],
  },
  heroic: {
    label: 'Heroic Scale',
    short: 'Heroic',
    desc: 'Player agency in influencing the dice (Action Points, Fate Points)',
    tiers: [
      'Luck of the Die — no Hero classes, no Action Points, no Fate Points (grimdark)',
      'Basic Agency — Hero classes available, 1 AP/round',
      'Basic Heroic Agency — Hero classes available, 1 AP/round, Heroic APs unlocked',
      'Heroic Agency — 2 AP/round, Heroic APs',
      'High Heroic Agency — unlimited AP/round, Heroic APs',
      'Fated Agency — 1 AP/round + Fate Points (1 FP/round)',
      'Fated Heroism — 1 AP/round, Heroic APs, class-specific Fate Points',
      'Fated High Heroism — 2 AP/FP per round, Heroic APs',
      'Destined Heroism — Hero class mandatory, 2 AP/FP per round, all options',
      'Destined High Heroism — Hero class mandatory, unlimited AP/FP per round',
    ],
  },
  mutation: {
    label: 'Mutation Scale',
    short: 'Mutation',
    desc: 'How varied races are; access to Mutation Points and super-powers',
    tiers: [
      'No mutations — Slightly Different/Supernatural Mutation/Unstable Mutation feats unavailable',
      'Minimal MP via Drawbacks/Slightly Different feat, only Minor (1-3 MP) Advantages',
      'Minimal MP via Drawbacks/Slightly Different feat, all Advantages',
      'Mutant subtype +1 racial level (10 MP), Advantages only',
      'Mutant subtype up to +2 racial level (20 MP), Slightly Different as bonus feat',
      'First tier of super-powers — Supernatural Mutation feat unlocks supernatural abilities (up to 20 MP)',
      'Supernatural Mutation up to +3 racial level (30 MP), all super-powers including Reality Revision',
      'Supernatural Mutation up to +4 racial level (40 MP), 5th-level char start recommended',
      'Supernatural Mutation up to +6 racial level (60 MP), Slightly Different/Supernatural Mutation as bonus feats',
      'Supernatural Mutation up to +10 racial level (100 MP) — demi-god starting characters',
    ],
  },
  psionic: {
    label: 'Psionic Scale',
    short: 'Psionic',
    desc: 'How powerful the hidden potential of the sentient mind can be',
    tiers: [
      'No psionic powers — Psion/Wilder unavailable, Warmind has no powers, no psionic skills/feats',
      'Low-powered psionics, max 5th-level powers, psionic items rare',
      'Low-powered psionics, 1st-level item market exists',
      'Low-powered psionics, 2nd-level item market exists',
      'Low-powered psionics, 3rd-level item market exists',
      'High-powered psionics, max 9th-level powers, items rare',
      'High-powered psionics, 1st-level item market exists',
      'High-powered psionics, 2nd-level item market exists',
      'High-powered psionics, 3rd-level item market exists',
      'Ubiquitous psionics, 5th-level item market, all chars get Use Psionic Device',
    ],
  },
  tech: {
    label: 'Tech Scale',
    short: 'Tech',
    desc: 'State of technological development in the scenario',
    tiers: [
      'Stone Age — society is the extended familial unit, no organized resources, mastercrafting impossible',
      'Bronze/Iron Age — currency and marketplaces emerge, mastercrafting up to +1',
      'Middle Ages — formal society shares information, mastercrafting up to +2',
      'Age of Reason — scientific method, concept of flight, mastercrafting up to +2',
      'Industrial Age — mass production, machining, mastercrafting up to +3',
      'Information Age — electronics, computers, space travel, cybernetics, mastercrafting up to +3',
      'Fusion Age — mecha and starship warfare in infancy, simple AI robots',
      'Gravity Age — mecha and starships mainstream, advanced AI / android tech',
      'Energy Age — most advanced metallurgy, AI commonplace, advanced mecha/starships',
      'Transparent Age — technology synonymous with magic and psionics',
    ],
  },
};
// Archetypal scenario presets (from Table: Classic Scenarios in the GM's Guide).
// "*" entries in the source mean "varies — set as your scenario calls for it".
// Where the source uses "1-2", "5+", "6+", we pick a reasonable default in that range.
// v8.45.0 (Adam, 2026-09-26): the five ancestor-branded presets renamed to
// the "Worlds" family — generic yet suggestive, zero trademarks. Old names
// live forever in PRESET_LEGACY: stored characters resolve and self-heal.
const SCENARIO_PRESETS = {
  'The Elder World':            {arcane:5, divine:5, heroic:0, mutation:0, psionic:0, tech:1},
  'The Elder World, Awakened':  {arcane:5, divine:5, heroic:0, mutation:0, psionic:5, tech:1},
  'The Ordinary World':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:5},
  'The Farther Worlds':         {arcane:0, divine:0, heroic:1, mutation:1, psionic:0, tech:6},
  'The Veiled World':           {arcane:1, divine:1, heroic:1, mutation:0, psionic:1, tech:5},
  'Steampunk':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:3},
  'Cyberpunk':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:6},
  'Fated Heroes':      {arcane:1, divine:1, heroic:5, mutation:0, psionic:0, tech:5},
  'Grimdark':          {arcane:1, divine:1, heroic:0, mutation:0, psionic:0, tech:1},
  'Super-Powers':      {arcane:0, divine:0, heroic:1, mutation:5, psionic:0, tech:5},
  'Hi-Powered':        {arcane:5, divine:5, heroic:5, mutation:5, psionic:5, tech:5},
  'Low-Powered':       {arcane:1, divine:1, heroic:1, mutation:1, psionic:1, tech:1},
  'Universe City':     {arcane:5, divine:5, heroic:9, mutation:9, psionic:5, tech:7},
  'Custom':            null, // user enters values manually
};
// Legacy preset names (pre-v8.45.0 saves) → current names. Read-side
// resolution + renderSheet self-heal; never removed (old exports live long).
const PRESET_LEGACY = {
  'Classic D&D': 'The Elder World',
  'Expanded D&D': 'The Elder World, Awakened',
  'd20 Modern': 'The Ordinary World',
  'd20 Future': 'The Farther Worlds',
  'Urban Arcana': 'The Veiled World',
};
const SCEN_AXES = ['arcane', 'divine', 'heroic', 'mutation', 'psionic', 'tech'];
// ===== v8.3.24: SCENARIO TITLE GENERATOR =====
//
// Generates an evocative, classical-literary title for any Six Scales
// configuration. Replaces the "Custom" placeholder when no hand-curated
// preset matches the player's axis selections.
//
// Design contract (final):
//   • Tech 1+ is the spine; Tech 0 lets another axis step up.
//   • Pre-emption (a non-Tech axis "more ubiquitous" than Tech) is by EMPHASIS
//     (promotion to lead modifier), not by SUBSTITUTION. Tech stays the spine.
//   • Conservation: every non-zero axis contributes something. Heroic and Tech
//     ALWAYS get labeled, even at 0 (mandatory zero-state labels).
//     Arcane/Divine/Mutation/Psionic at 0 silently drop.
//   • Pool 1 (literary anchor noun) is Heroic-driven:
//       Heroic 0 → Chronicles
//       Heroic 1: Tales (default) or Epics if any Power axis (A/D/M/P) ≥5
//       Heroic 2-4: Adventures (default) or Epics if any Power axis ≥5
//       Heroic 5-7: Epics always
//       Heroic 8-9: Sagas always
//   • Pool 2 (temporal anchor word) is hash-driven from all six axes:
//       Pool 1 = Epics → Pool 2 ∈ {Age, Era} (dyad rule: no Epics+Epoch)
//       Pool 1 ≠ Epics → Pool 2 ∈ {Age, Epoch, Era}
//   • Tech vocab is fixed-string per level (e.g. "Modern Age", "Age of Wonders").
//     Pool 2 supplies a separate temporal anchor word that lives in the grammar
//     template's "in [a/an] {Pool2}" clause when Tech is the spine.
//     EXCEPTION: when the Tech label itself contains a temporal anchor word
//     ("Iron Age", "Industrial Age", "Age of Wonders"), the title uses the Tech
//     label verbatim in that slot and Pool 2's contribution is absorbed into
//     the Tech label as its second word. So "in a Modern Age" reads naturally
//     because "Modern" is Pool 2's value-replacement on the spine label.
//     Implementation detail: Tech labels are stored as templates with an {E}
//     slot that Pool 2 fills.
const SCENARIO_AXIS_VOCAB = {
  // Tech label templates. {E} = Pool 2's pick (Age|Epoch|Era).
  // Tech 9 keeps its tongue-in-cheek "Age of Wonders" form even when Pool 2
  // dictates Epoch — the slight redundancy is by design (Tech 9 scenarios are
  // philosophical-only edge cases, included for completeness).
  tech: {
    0: 'Primordial {E}',
    1: 'Iron {E}',
    2: 'Bronze {E}',
    3: 'Renaissance {E}',
    4: 'Industrial {E}',
    5: 'Modern {E}',
    6: 'Networked {E}',
    7: 'Cyber {E}',
    8: 'Star-Faring {E}',
    9: 'Wondrous {E}',
  },
  // Per-axis modifiers at threshold values. Used as lead modifiers in front
  // of the Pool 1 word, or as trailing clauses (Mutation/Psionic at 1).
  arcane: {1: 'Subtle', 5: 'Sorcerous', 9: 'Wonder-Wrought'},
  divine: {1: 'Faithful', 5: 'Miraculous', 9: 'Theocratic'},
  // Heroic axis is character-tier flavor; Heroic 0 has the mandatory "Grim"
  // label per the conservation principle.
  heroic: {0: 'Grim', 1: 'Adventurous', 5: 'Fated', 9: 'Mythic'},
  // Mutation at 1 reads as a trailing clause; at 5+ it joins the lead stack.
  mutation: {1: 'Mutation-Touched', 5: 'Mutant-Wrought', 9: 'Mutation-Drowned'},
  // Psionic — same low-vs-high distinction.
  psionic: {1: 'Psychic-Touched', 5: 'Mind-Wrought', 9: 'Mind-Saturated'},
};
