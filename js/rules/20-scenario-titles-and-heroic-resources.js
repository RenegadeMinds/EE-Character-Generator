// =============================================================================
// js/rules/20-scenario-titles-and-heroic-resources.js
// SCENARIO TITLES AND HEROIC RESOURCES
// =============================================================================
//
// WHAT'S IN HERE
//   The scenario title generator, Action Point and Fate Point options,
//   heroic-level capabilities, resource budgets (feats, talents), and which
//   tabs a character is entitled to see.
//
// KEY NAMES (so you can search for them)
//   tables/objects: SCENARIO_AXIS_VOCAB, AP_OPTIONS, HAP_OPTIONS,
//   FP_OPTIONS_UNIVERSAL, FP_OPTIONS_BY_HERO_CLASS, HEROIC_LEVEL_NAMES,
//   HEROIC_LEVEL_AP_PER_ROUND, RESOURCE_STATE_DISPLAY, NAV_TAB_VISIBILITY
//   functions (16): _scenarioAxisLabel, _scenarioHash, _scenarioPool1,
//   _scenarioPool2, generateScenarioTitle, getAPDice, characterHasAPClass,
//   effectiveHeroicLevelForAP, getHeroicCapabilities, computeResourceState,
//   getFeatBudget, featListComplianceOf, talentConsumesSlot, getTalentBudget,
//   characterIsEntitledToTalents, characterIsEntitledToVehicles
//
// LOAD ORDER
//   File 20 of 68. index.html loads it after
//   js/rules/19-bonus-aggregator-and-stat-block.js and before
//   js/rules/21-quickdraw.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 15001-15806 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 15001-15806; unchanged below this line ----
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

// Threshold resolver: given a value 0-9, return the *anchor* threshold's label
// from a per-axis label table. Anchors are 0/1/5/9; values 2-4 use the 1
// anchor, values 6-8 use the 5 anchor.
//
// `context` is an optional hint object used to disambiguate label choice when
// the default would collide with the Pool 1 word. Currently used only for
// heroic+Pool1-Adventures: swap "Adventurous" → "Bold" to avoid root repetition.
function _scenarioAxisLabel(axisKey, value, context) {
  const table = SCENARIO_AXIS_VOCAB[axisKey];
  if (!table) return null;
  let label;
  if (value === 0) label = table[0] || null;
  else if (value === 9) label = table[9] || null;
  else if (value >= 5) label = table[5] || null;
  else if (value >= 1) label = table[1] || null;
  else label = null;
  // Collision-avoidance for the heroic axis: when Pool 1 = "Adventures" and
  // the heroic-1 label would otherwise be "Adventurous", swap to the
  // "Bold" alternate. Same root word in lead and noun reads awkwardly.
  if (axisKey === 'heroic' && label === 'Adventurous' && context && context.pool1 === 'Adventures') {
    label = 'Bold';
  }
  return label;
}

// Hash six axis values into a small integer for stable Pool 2 selection.
// Uses position-weighted sum so each axis contributes meaningfully.
function _scenarioHash(sl) {
  const a = sl.arcane||0, d = sl.divine||0, h = sl.heroic||0,
        m = sl.mutation||0, p = sl.psionic||0, t = sl.tech||0;
  return (a * 31 + d * 37 + h * 41 + m * 43 + p * 47 + t * 53) >>> 0;
}

// Pool 1 selection: Heroic-driven, with Epics promotion when a Power axis ≥5.
function _scenarioPool1(sl) {
  const h = sl.heroic || 0;
  if (h === 0) return 'Chronicles';
  if (h >= 8) return 'Sagas';
  if (h >= 5) return 'Epics';
  // Heroic 1-4: default Tales/Adventures, promoted to Epics if any Power axis ≥5
  const anyPower5 = (sl.arcane >= 5) || (sl.divine >= 5) ||
                    (sl.mutation >= 5) || (sl.psionic >= 5);
  if (anyPower5) return 'Epics';
  return (h === 1) ? 'Tales' : 'Adventures';
}

// Pool 2 selection: enforces the **XOR dyad rule** — every title must include
// exactly one of {Epics, Epoch}. v8.3.24 had the weaker "no Epics+Epoch
// together" rule, which permitted titles with NEITHER (e.g. "Tales in a
// Modern Age"). The branding constraint is stronger: every title invokes
// "Epics & Epochs" through exactly one half of the dyad.
//
// Mechanically:
//   • Pool 1 = Epics → Pool 2 ∈ {Age, Era} (Epoch forbidden; hash picks)
//   • Pool 1 ≠ Epics → Pool 2 = Epoch (forced, no hash choice)
function _scenarioPool2(sl, pool1) {
  if (pool1 === 'Epics') {
    const allowed = ['Age', 'Era'];
    return allowed[_scenarioHash(sl) % allowed.length];
  }
  // Anything else (Chronicles, Tales, Adventures, Sagas) — Pool 2 must be Epoch
  // to fulfill the dyad. No hash choice.
  return 'Epoch';
}

// Generate the full scenario title from a sixLevels object.
// Returns a string like "Sorcerous, Fated Epics in a Modern Age".
function generateScenarioTitle(sl) {
  if (!sl) return '';
  sl = {arcane:sl.arcane||0, divine:sl.divine||0, heroic:sl.heroic||0,
        mutation:sl.mutation||0, psionic:sl.psionic||0, tech:sl.tech||0};
  const pool1 = _scenarioPool1(sl);
  const pool2 = _scenarioPool2(sl, pool1);

  // Spine resolution.
  //   Tech 1+ → Tech spine (uses tech vocab with Pool 2 filling {E}).
  //   Tech 0  → another non-zero axis steps up (preference: A→D→P→M).
  // Pre-empting axis: when Tech is the spine, identify a non-Tech axis whose
  // value exceeds Tech's. Promote that axis to lead modifier slot. The lead
  // modifier slot's label uses the same per-axis modifier vocabulary, so the
  // promotion is purely about position in the modifier stack.
  let spineLabel;
  let preemptingAxis = null;
  // v8.3.24: when Tech 0 forces another axis to spine duty, that axis's
  // modifier is ALREADY in the spine label — don't repeat it in the lead.
  let spineAxisFromTech0 = null;
  if (sl.tech >= 1) {
    const template = SCENARIO_AXIS_VOCAB.tech[sl.tech] || SCENARIO_AXIS_VOCAB.tech[5];
    spineLabel = template.replace('{E}', pool2);
    // Pre-emption: find a non-Tech axis with value > sl.tech. If multiple tie
    // for higher value, prefer Arcane > Divine > Psionic > Mutation.
    const candidates = [
      {axis:'arcane',   val: sl.arcane},
      {axis:'divine',   val: sl.divine},
      {axis:'psionic',  val: sl.psionic},
      {axis:'mutation', val: sl.mutation},
    ].filter(c => c.val > sl.tech);
    if (candidates.length > 0) {
      candidates.sort((a,b) => b.val - a.val);
      preemptingAxis = candidates[0].axis;
    }
  } else {
    // Tech 0 — let another axis serve as spine. Preference order matches
    // pre-emption: Arcane > Divine > Psionic > Mutation. If all are zero,
    // Tech 0's own mandatory zero-state label takes the spine slot.
    const altOrder = ['arcane','divine','psionic','mutation'];
    let usedAlt = null;
    for (const ax of altOrder) {
      if (sl[ax] > 0) { usedAlt = ax; break; }
    }
    if (usedAlt) {
      const modLabel = _scenarioAxisLabel(usedAlt, sl[usedAlt]);
      spineLabel = `${modLabel} ${pool2}`;
      spineAxisFromTech0 = usedAlt; // skip from lead modifiers
    } else {
      // All zero (or all axes zero except Tech 0) — use Tech 0's label.
      spineLabel = SCENARIO_AXIS_VOCAB.tech[0].replace('{E}', pool2);
    }
  }

  // Assemble lead modifiers (in front of the Pool 1 word).
  //
  // Order rationale: the modifier stack reads from world-shape outward to
  // character-tier:
  //   1. Pre-empting axis (if any) — most prominent world-shape signal
  //   2. World-shape modifiers (Arcane, Divine — non-empting ones)
  //   3. Heroic modifier (character tier — always present)
  //   4. Mutation 5+ and Psionic 5+ (when high enough to belong in the lead)
  // Mutation 1 and Psionic 1 go into a trailing clause instead.
  // Pool-1 word is passed as context so the heroic label can swap "Adventurous"
  // → "Bold" when Pool 1 would otherwise be "Adventures".
  const ctxHint = {pool1};
  const lead = [];
  // 1. Pre-empting axis
  if (preemptingAxis && preemptingAxis !== spineAxisFromTech0) {
    const lbl = _scenarioAxisLabel(preemptingAxis, sl[preemptingAxis], ctxHint);
    if (lbl) lead.push(lbl);
  }
  // 2. Other world-shape: Arcane & Divine (skip preempting + spine-axis)
  for (const ax of ['arcane', 'divine']) {
    if (ax === preemptingAxis) continue;
    if (ax === spineAxisFromTech0) continue;
    if (sl[ax] >= 1) {
      const lbl = _scenarioAxisLabel(ax, sl[ax], ctxHint);
      if (lbl) lead.push(lbl);
    }
  }
  // 3. Heroic — always present (mandatory zero-state at Heroic 0)
  const heroicLbl = _scenarioAxisLabel('heroic', sl.heroic, ctxHint);
  if (heroicLbl) lead.push(heroicLbl);
  // 4. Mutation 5+ and Psionic 5+ folded into lead
  for (const ax of ['mutation', 'psionic']) {
    if (ax === preemptingAxis) continue;
    if (ax === spineAxisFromTech0) continue;
    if (sl[ax] >= 5) {
      const lbl = _scenarioAxisLabel(ax, sl[ax], ctxHint);
      if (lbl) lead.push(lbl);
    }
  }

  // Trailing clauses for Mutation 1-4 and Psionic 1-4 (when not in lead).
  const trailing = [];
  if (sl.mutation >= 1 && sl.mutation < 5 && preemptingAxis !== 'mutation' && spineAxisFromTech0 !== 'mutation') {
    const lbl = _scenarioAxisLabel('mutation', sl.mutation, ctxHint);
    if (lbl) trailing.push(lbl);
  }
  if (sl.psionic >= 1 && sl.psionic < 5 && preemptingAxis !== 'psionic' && spineAxisFromTech0 !== 'psionic') {
    const lbl = _scenarioAxisLabel('psionic', sl.psionic, ctxHint);
    if (lbl) trailing.push(lbl);
  }

  // Compose the title.
  //   "[lead-modifiers, ] [Pool1] in [a/an] [spineLabel][, trailing-clauses]"
  // Choose 'a' vs 'an' by first letter of the spine.
  const leadStr = lead.length > 0 ? lead.join(', ') + ' ' : '';
  const article = /^[aeiouAEIOU]/.test(spineLabel) ? 'an' : 'a';
  const trailingStr = trailing.length > 0 ? ', ' + trailing.join(' and ') : '';
  return `${leadStr}${pool1} in ${article} ${spineLabel}${trailingStr}`;
}

// v8.3.19: Reference data for AP, HAP, and FP options displayed in the
// sheet's Action Points panel. The options are descriptive — they're shown
// for player reference; the only mechanical buttons are the existing AP
// spend/gain controls plus the new SPEND FATE POINT / RESTORE FATE POINT.
//
// Per HH p.54-56, AP dice scale with character level:
//   1st-7th  → 1d6
//   8th-14th → 2d6
//   15th-20th → 3d6
// (Players roll all dice and take the highest result.)
function getAPDice(charLevel) {
  if (charLevel >= 15) return '3d6';
  if (charLevel >= 8) return '2d6';
  return '1d6';
}
// AP options — universal, available at Heroic 1+.
const AP_OPTIONS = [
  {
    name: 'Alter a d20 roll',
    desc: 'Spend 1 AP to add a d6 bonus to any attack, skill check, ability check, or saving throw. Declare AFTER the roll but BEFORE the GM reveals the result. Cannot be used when taking 10 or taking 20.'
  },
  {
    name: 'Activate a class feature',
    desc: 'Spend 1 AP to use a class talent or feature that specifies "1 AP" as its activation cost. No d6 is rolled.'
  }
];
// HAP options — Heroic 2+, Hero-class only (HH p.55).
const HAP_OPTIONS = [
  {
    name: 'Heroic Effort — "Focus!"',
    desc: 'Spend 1 AP for the FULL +6 bonus (instead of d6) when taking a full-round action on a standard or move action that uses one of your Heroic attributes.'
  },
  {
    name: 'Heroic Dodge — "Jump for your life!"',
    desc: 'Spend 1 AP as an immediate action to get a Dodge attempt against an attack roll that would otherwise reduce you to 0 hit points or less.'
  },
  {
    name: 'Heroic Resurgence — "Just catching my breath!"',
    desc: 'Spend 1 AP as a full-round action to recover 25% of your hit points (rounded up), up to a maximum of 50% of your total HP.'
  },
  {
    name: 'Heroic Destiny — "Beat the odds!"',
    desc: 'Spend 1 AP BEFORE making a d20 roll to roll 2d20 instead, taking the better result.'
  }
];
// FP options — Heroic 5+, Hero-class only. The universal Twist of Fate is
// always available; class-specific options are filtered by the character's
// Hero class membership and require the listed Talent (player self-verifies).
const FP_OPTIONS_UNIVERSAL = [
  {
    name: 'Twist of Fate (universal)',
    desc: 'Permanently spend 1 AP as a Fate Point to FORCE A RE-ROLL of any d20 result that directly affects your character. Available to all Hero characters.'
  }
];
const FP_OPTIONS_BY_HERO_CLASS = {
  'Strong Hero': {
    name: 'Maximum Effort (Strong Hero)',
    talent: 'Extreme Effort',
    desc: 'Permanently spend 1 AP as a move-equivalent action to TAKE 20 on a Str-based check, including a melee attack roll. Requires the Extreme Effort Talent.'
  },
  'Fast Hero': {
    name: 'Nick of Time (Fast Hero)',
    talent: 'Defensive Roll',
    desc: 'Permanently spend 1 AP as an immediate action to AUTOMATICALLY SUCCEED on a Defensive Roll attempt. Requires the Defensive Roll Talent.'
  },
  'Tough Hero': {
    name: 'No Time to Bleed (Tough Hero)',
    talent: 'Second Wind',
    desc: 'Permanently spend 1 AP as an immediate action to USE SECOND WIND. Requires the Second Wind Talent.'
  },
  'Smart Hero': {
    name: 'Eureka! (Smart Hero)',
    talent: 'Linguist',
    desc: 'Permanently spend 1 AP as a full-round action to TAKE 20 on an Int-based check. Requires the Linguist Talent.'
  },
  'Dedicated Hero': {
    name: 'The Right Touch (Dedicated Hero)',
    talent: 'Healing Knack',
    desc: 'Permanently spend 1 AP as a standard action to HEAL ANOTHER CHARACTER for 25% of their total HP, up to a maximum of 50%. Requires the Healing Knack Talent.'
  },
  'Charismatic Hero': {
    name: 'Good and Lucky (Charismatic Hero)',
    talent: 'Allegiance to Good',
    desc: 'Permanently spend 1 AP as an immediate action in response to a failed saving throw to instead TAKE 20 on the saving throw (automatic success). Requires Allegiance to Good.'
  }
};

// v8.3.19: Heroic Scale capability resolver.
//
// The Hero's Handbook (p.54-56) and the GM Guide describe a tiered AP / HAP /
// FP system gated by the scenario's Heroic Scale.
//
//   Heroic 0: No AP at all. Feats/abilities requiring AP become 1/day; Talents
//             become General feats. (Defer the talent re-skin to a future release;
//             for now we just zero out AP.)
//   Heroic 1: Basic Agency. AP usable, 1/round. d6 d20 modifier or class feature
//             activation. Non-Hero characters get AP from class apB rule.
//   Heroic 2: Basic Heroic Agency. AP 1/round + HAP options (Hero-class only).
//   Heroic 3: Heroic Agency. AP 2/round + HAP.
//   Heroic 4: High Heroic Agency. AP unlimited/round + HAP.
//   Heroic 5: Fated Agency. AP 1/round + FP (universal Twist of Fate).
//             Per HH p.55, class-specific FP options also available at H5+
//             when the prerequisite Talent is held.
//   Heroic 6: Fated Heroism. AP 1/round + HAP + FP.
//   Heroic 7: Fated High Heroism. AP 2/round + HAP + FP (2 FP/round).
//   Heroic 8: Destined Heroism. 1+ Hero class mandatory. AP 2/round + HAP + FP
//             (2 FP/round). Per GM Guide reinforces class-specific FP availability.
//   Heroic 9: Destined High Heroism. As 8 but unlimited AP and FP/round.
//
// Only characters with at least one Hero-class level have access to HAP and FP
// (HH p.55, "Only characters with one or more levels in a Hero class can spend
// their Action Points as Heroic Action Points" + the parallel rule for FP).
const HEROIC_LEVEL_NAMES = {
  0:'Luck of the Die', 1:'Basic Agency', 2:'Basic Heroic Agency',
  3:'Heroic Agency', 4:'High Heroic Agency', 5:'Fated Agency',
  6:'Fated Heroism', 7:'Fated High Heroism', 8:'Destined Heroism',
  9:'Destined High Heroism'
};
// Per-round AP limit as a display-only string. "Unlimited" at H4 and H9.
const HEROIC_LEVEL_AP_PER_ROUND = {
  0:'No AP', 1:'1 AP/round', 2:'1 AP/round', 3:'2 AP/round',
  4:'Unlimited AP/round', 5:'1 AP + 1 FP/round', 6:'1 AP + 1 FP/round',
  7:'2 AP + 2 FP/round', 8:'2 AP + 2 FP/round', 9:'Unlimited AP & FP/round'
};

// v8.3.32: AP-bearing class detection. A class confers an Action Point base if
// its data carries an `apB` (numeric, like the Hero classes' 5/6, or the
// string 'cha', like Basic/Advanced/Prestige classes). ORDINARY classes have
// NO apB key at all, so a purely-Ordinary character returns false here.
function characterHasAPClass(classArr) {
  return (classArr || []).some(e => {
    const cls = getClassEntry(e);
    return cls && (typeof cls.apB === 'number' || cls.apB === 'cha') && (e.level || 0) > 0;
  });
}

// v8.3.32: the Heroic Scale to use FOR AP-SUBSYSTEM PURPOSES ONLY. A character
// with no AP-bearing class (i.e. purely Ordinary) is treated as Heroic Scale 0
// — which routes them through the existing, tested H0 "no AP / no dashboard"
// pathway — REGARDLESS of the scenario's actual Heroic Scale. The character's
// real c.sixLevels.heroic is NEVER mutated; this is a read-time computation
// for the AP subsystem alone, and is never surfaced as a character-facing
// stat. A pure-Ordinary character simply shows no AP dashboard, exactly as any
// genuine Heroic-0 character does — silent absence.
//
// The mixed case stays correct: a Strong Ordinary 3 / Fighter 2 character HAS
// an AP-bearing class (Fighter carries apB:'cha'), so this returns the
// scenario's true Heroic Scale and AP computes normally from the Fighter
// contribution.
//
// Default-when-unset: if the character has no sixLevels.heroic and no
// heroicLevel set, we fall back to 1 — preserving the historic behavior of
// the call sites this helper replaced (which used `?? 1`). The H0 suppression
// is meant to fire ONLY when (a) the scenario is genuinely H0, or (b) the
// character has no AP-bearing class. Missing scenario data is NOT a "treat as
// H0" signal — that would over-suppress legacy/test characters and characters
// in nondescript creation states.
function effectiveHeroicLevelForAP(c) {
  const scenarioHeroic = (c && c.sixLevels && typeof c.sixLevels.heroic === 'number')
    ? c.sixLevels.heroic
    : ((c && typeof c.heroicLevel === 'number') ? c.heroicLevel : 1);
  const classArr = migrateLegacyClasses(c || {});
  return characterHasAPClass(classArr) ? scenarioHeroic : 0;
}

function getHeroicCapabilities(c) {
  const heroicLevel = (c.sixLevels?.heroic) ?? c.heroicLevel ?? 0;
  const classArr = migrateLegacyClasses(c);
  const heroClasses = classArr.filter(e => e.tier === 'hero' && (e.level||0) > 0);
  const hasHeroClass = heroClasses.length > 0;
  // v8.3.21: ownedTalentNames lets downstream code (notably the renderAPBar
  // Fate Point options) check Talent prereqs against actual character data
  // instead of relying on player self-verification.
  const ownedTalentNames = new Set((c.talents || []).map(t => t.name));
  // v8.3.32: hasAP keys on the EFFECTIVE Heroic Scale, not the raw scenario
  // value. A purely-Ordinary character has effective Heroic 0 (no AP-bearing
  // class), so hasAP is false and the AP dashboard never renders — reusing
  // the existing H0 pathway. The descriptive fields below (heroicLevel,
  // heroicLevelName, apPerRound) still report the TRUE scenario value: the
  // effective-0 is internal to the hasAP decision, never surfaced as a stat.
  const apHeroicLevel = effectiveHeroicLevelForAP(c);
  return {
    heroicLevel,
    heroicLevelName: HEROIC_LEVEL_NAMES[heroicLevel] || '?',
    apPerRound: HEROIC_LEVEL_AP_PER_ROUND[heroicLevel] || '?',
    // AP is available at Heroic 1+; AT HEROIC 0 IT'S ZEROED ENTIRELY. v8.3.32:
    // pure-Ordinary characters have effective Heroic 0 here regardless of
    // scenario, so they get no AP — silent absence, no dashboard.
    hasAP: apHeroicLevel >= 1,
    // HAP options available at Heroic 2+ but only to Hero-class characters.
    // Ordinary is not a Hero class, so a pure-Ordinary character is already
    // excluded by `hasHeroClass` — but using apHeroicLevel keeps it consistent.
    hasHAP: apHeroicLevel >= 2 && hasHeroClass,
    // FP available at Heroic 5+, Hero-class only (universal Twist of Fate).
    // Class-specific FP options are gated by Talent prereq, displayed alongside
    // matching Hero classes' availability.
    hasFP: apHeroicLevel >= 5 && hasHeroClass,
    hasHeroClass,
    // Names of Hero classes the character has, used to filter class-specific FP options.
    heroClassNames: heroClasses.map(e => e.name),
    ownedTalentNames,
  };
}

// ===== v8.3.21: TALENT SYSTEM =====
// Hero classes grant Talents at character levels 1, 3, 5, 7, and 9 of that
// class — five total per Hero class taken to max level. The Multi-Talented
// Heritage feat adds an additional cross-class talent slot. Hero's Gift
// (deferred to v8.3.22+) will add a sixth slot for a Hero's first class level.
//
// Data shape on the character:
//   c.talents = [
//     {name: 'Evasion', grantedAt: {source: 'Fast Hero', level: 1, atDate: '...'}},
//     ...
//   ]
//
// Forward-compat: source can be a Hero class name OR 'Multi-Talented' OR
// 'Hero's Gift' (when implemented). Each entry remembers where it came from
// so budget bookkeeping survives class-change edits.

// Compute talent slots granted per Hero class, plus bonus grants from feats.
// Returns {byHeroClass, bonusGrants, totalOwed, totalPicked, remaining}.
//
//   byHeroClass: {'Strong Hero': 2, 'Fast Hero': 1, ...}
//   bonusGrants: number (Multi-Talented + future Hero's Gift)
//   totalOwed:   sum of byHeroClass + bonusGrants
//   totalPicked: c.talents.length
//   remaining:   totalOwed - totalPicked (floored at 0)
// v8.4.0: four-state resource display per decision 12 / plan §7.5.
//
// Returns one of: 'surplus' | 'exact' | 'warning' | 'error'
//
//   • surplus — picked < budget (unassigned slots remain; latent potential)
//   • exact   — picked === budget (fully spent)
//   • warning — picked > budget AND a covering GM exception is present
//   • error   — picked > budget AND NO covering GM exception (unsanctioned)
//
// The 'covering exception' rule is STRICT: the exception's `type` field must
// match the resource type. A type:'feat' exception covers feat overages
// only; type:'talent' covers talent overages only; type:'skill' covers
// skill overages only. Unrelated exceptions on the same character do NOT
// cover.
//
// The `c.gmExceptions[]` records are tagged by all the v8.3.x code that
// generates them (class prereq, attrMin, Heritage off-level, etc.). Each
// generator picks a `type` value that names what kind of rule was bent —
// our strict matching reads that field.
//
// Display layer in renderSheet, renderFeats, renderTalents, and renderSkills
// reads this function's result + the icon map + tooltip text to render the
// per-resource cell.
function computeResourceState(picked, budget, resourceType, gmExceptions) {
  if (picked < budget) return 'surplus';
  if (picked === budget) return 'exact';
  // picked > budget — check for a covering GM exception of the right type.
  const exTypeMatches = {
    feat:    new Set(['feat', 'feat-slot']),
    talent:  new Set(['talent']),
    skill:   new Set(['skill']),
  };
  const acceptable = exTypeMatches[resourceType] || new Set([resourceType]);
  const hasCovering = (gmExceptions || []).some(ex => ex && acceptable.has(ex.type));
  return hasCovering ? 'warning' : 'error';
}

// v8.4.0: state → display attributes mapping. Used by the renderers to
// translate a state string into the corresponding color, icon, and tooltip
// fragment for the four-state color-coded display (plan §7.5).
const RESOURCE_STATE_DISPLAY = {
  surplus: {color:'var(--state-surplus)', icon:'↑', label:'Surplus'},
  exact:   {color:'var(--state-exact)',   icon:'✓', label:'Exact'},
  warning: {color:'var(--state-warning)', icon:'⚠', label:'Over (GM exception)'},
  error:   {color:'var(--state-error)',   icon:'✗', label:'Over budget'},
};

// v8.4.0: feat-budget computation, extracted from the inline body of
// renderFeats so it's callable from the validator suite, the four-state
// color display, and any other consumer. Returns the same shape as the
// previous inline computation produced for the renderer.
//
// Returns {sources, total, picked, remaining}.
//
//   sources: [{label, count, source}, ...]  — each contributor with its label/count
//   total:   sum of all sources' counts
//   picked:  c.feats.length
//   remaining: max(0, total - picked)
//
// Source rules:
//   1 base L1 feat (always)
//   1 heritage feat slot (always, but Heritage feats are the typical fillers)
//   1 human bonus (Human race only)
//   1 Hero's Gift — dual code path:
//     • Legacy characters (no schemaVer): auto-grants +1 for any Hero-classed
//       character. Preserves v8.3.x behavior exactly.
//     • v8.4.0+ characters: +1 ONLY if c.heroesGiftChoice === 'feat'.
//   1 occupation bonus per occupation that has bonus_feat_options
//   floor(totalLvl/3) level-based bonus feats (L3+, every 3 levels)
//   class-feature bonus feats (e.g. Fighter's bonus feat track)
//
// This is the architectural fix that makes Hero's Gift assignment visible.
// Pre-v8.4.0, the silent +1 Hero's Gift in the feat budget meant a player
// who treated Hero's Gift as a talent was over-budget on talents without
// any signal — the four-state color display (§7.5) surfaces that as red.
function getFeatBudget(c) {
  if (!c) return {sources:[], total:0, picked:0, remaining:0};
  const sources = [];
  sources.push({label:'Free L1 feat', count:1, source:'l1-base'});
  sources.push({label:'Heritage feat', count:1, source:'heritage'});
  if (isHumanParented(c)) sources.push({label:'Human bonus' + (c.race === 'Hybrid' ? ' (Hybrid — Human parent)' : ''), count:1, source:'human'});  // v8.70.1
  const heroClass = (c.classes||[]).some(e => e.tier==='hero');
  if (heroClass) {
    if (isLegacyCharacter(c)) {
      sources.push({label:"Hero's Gift", count:1, source:'hero-gift'});
    } else if (c.heroesGiftChoice === 'feat') {
      sources.push({label:"Hero's Gift (feat)", count:1, source:'hero-gift'});
    }
    // else (v8.4.0+ unassigned or assigned to talent): no feat-side grant.
  }
  const occNamesForBudget = c.occupations || (c.occ ? [c.occ] : []);
  for (const occName of occNamesForBudget) {
    if (!occName) continue;
    const occData = getOccupationData(occName);
    if (occData && occData.bonus_feat_options && occData.bonus_feat_options.length) {
      sources.push({label: `${occName} bonus feat`, count: 1, source: `occ:${occName}`});
    }
  }
  const levelBonus = Math.floor((c.totalLvl||0)/3);
  if (levelBonus > 0) sources.push({label:`Lvl ${c.totalLvl} bonus (L3+, every 3 lvls)`, count:levelBonus, source:'lvl-bonus'});
  // Class-feature bonus feats (Fighter's bonus feat track, etc.)
  {
    const classFeatureBonusFeats = computeBonusFeatsFromClassFeatures(c);
    if (classFeatureBonusFeats > 0) {
      const cfFeatures = getActiveClassFeatures(c).filter(f => f.effect && f.effect.type === 'bonusFeats');
      for (const f of cfFeatures) {
        const cnt = evalBonusFeatFormula(f.effect.formula, f.classLvl || 0);
        if (cnt > 0) sources.push({label:`${f.className} ${f.name}`, count:cnt, source:`cf:${f.className}`});
      }
    }
  }
  const total = sources.reduce((s, b) => s + b.count, 0);
  // v8.6.1: class-entry granted feats (grantedBy — Monk's CMA/DMA) came free
  // with the class and consume no slot from this budget.
  const picked = (c.feats||[]).filter(f => !f.grantedBy).length;
  return {sources, total, picked, remaining: Math.max(0, total - picked)};
}

// v8.52.0 (Xander build finding #4): AGGREGATE feat-list compliance. The
// slot-targeted browse path has enforced restrictions since v8.3.7, but a
// feat added through the generic browser or the level-up flow lands with no
// slotSource and silently consumes restricted class-bonus capacity in the
// budget count. This check asks the only question that matters at the end:
// does ANY legal assignment of this character's feats to their slots exist?
// Slots: the budget's open sources take any feat; occupation sources take
// their options list; class-feature sources take their restriction (family
// tag or explicit allowlist — combination strings like "Fighter or Power
// feat list" don't parse and stay permissive, matching the browse path).
// Feats already pinned (slotSource, occupation origin) consume their slot
// unquestioned — their legality was settled (or GM-excepted) at add time.
// The rest are matched by augmenting paths (Kuhn's algorithm — slots are
// few). Infeasibility surfaces as an owed-ledger note, never a hard block:
// the E&E way is to name the problem and let the GM adjudicate.
function featListComplianceOf(c) {
  const fb = getFeatBudget(c);
  const groups = [];
  for (const s of (fb.sources || [])) {
    const src = s.source || '';
    if (src.indexOf('cf:') === 0) continue;   // re-derived below with restrictions
    if (src.indexOf('occ:') === 0) {
      const occName = src.slice(4);
      let list = null;
      try { const od = getOccupationData(occName); if (od && od.bonus_feat_options && od.bonus_feat_options.length) list = od.bonus_feat_options; } catch (e) {}
      groups.push({label: s.label, cap: s.count, filter: list ? {kind:'list', value:list} : null, occ: occName});
    } else {
      groups.push({label: s.label, cap: s.count, filter: null});
    }
  }
  try {
    const cfFeatures = getActiveClassFeatures(c).filter(f => f.effect && f.effect.type === 'bonusFeats');
    for (const f of cfFeatures) {
      const cnt = evalBonusFeatFormula(f.effect.formula, f.classLvl || 0);
      if (cnt <= 0) continue;
      const filter = getRestrictionFilter(f.effect.restriction);
      groups.push({label: `${f.className} ${f.name}`, cap: cnt, filter,
        tag: `classFeature:${f.className}:${f.name}`,
        restrLabel: typeof f.effect.restriction === 'string' ? f.effect.restriction
                  : (Array.isArray(f.effect.restriction) ? `the ${f.className} list` : null)});
    }
  } catch (e) {}
  const feats = (c.feats || []).filter(f => !f.grantedBy);
  const free = [];
  for (const f of feats) {
    if (f.slotSource) {
      const g = groups.find(g => g.tag === f.slotSource);
      if (g && g.cap > 0) { g.cap--; continue; }
    }
    if (f.origin && /^occupation:/.test(f.origin)) {
      const occName = f.origin.slice('occupation:'.length);
      const g = groups.find(g => g.occ === occName);
      if (g && g.cap > 0) { g.cap--; continue; }
    }
    free.push(f);
  }
  const nameOf = (f) => f.name || f.n;
  const fits = (f, g) => {
    if (!g.filter) return true;
    const nm = (nameOf(f) || '').toLowerCase();
    if (g.filter.kind === 'list') return g.filter.value.some(x => {
      const e = String(x).toLowerCase();
      return e === nm || e.indexOf(nm + ' (') === 0;
    });
    if (g.filter.kind === 'family') {
      let d = null; try { d = getFeatData(nameOf(f)); } catch (e) {}
      return !!d && d.family === g.filter.value;
    }
    return true;
  };
  const slots = [];
  groups.forEach((g, gi) => { for (let i = 0; i < g.cap; i++) slots.push(gi); });
  const matchOfSlot = new Array(slots.length).fill(-1);
  const tryPlace = (fi, seen) => {
    for (let si = 0; si < slots.length; si++) {
      if (seen[si] || !fits(free[fi], groups[slots[si]])) continue;
      seen[si] = true;
      if (matchOfSlot[si] === -1 || tryPlace(matchOfSlot[si], seen)) { matchOfSlot[si] = fi; return true; }
    }
    return false;
  };
  const unplaced = [];
  for (let fi = 0; fi < free.length; fi++) {
    if (!tryPlace(fi, new Array(slots.length).fill(false))) unplaced.push(nameOf(free[fi]));
  }
  // Raw over-budget (more feats than slots of any kind) is the budget line's
  // story, not this check's — only restriction-DRIVEN failures are reported.
  const overBudget = Math.max(0, free.length - slots.length);
  const violations = unplaced.length > overBudget ? unplaced : [];
  const openLabels = [];
  slots.forEach((gi, si) => {
    if (matchOfSlot[si] !== -1) return;
    const g = groups[gi];
    if (!g.filter) return;
    const lbl = g.label + (g.restrLabel ? ` — ${g.restrLabel}` : (g.filter.kind === 'family' ? ` — ${g.filter.value} feat list` : ''));
    if (!openLabels.includes(lbl)) openLabels.push(lbl);
  });
  return {ok: violations.length === 0, unplaced: violations, openLabels};
}

// v8.21.1 (Adam's ruling, 2026-09-04): Super-Talents and Apex Super-Talents
// do NOT consume Talent selections. Their price is the MP (the acquisition IS
// the MP spend, summed by the getMPState ledger) plus meeting the prereqs —
// a Hero with the prerequisites and the banked MP simply gains access. Only
// regular Talents count against the L1/3/5/7/9 slot budget.
function talentConsumesSlot(name) {
  const t = TALENTS_DB.find(x => x.n === name);
  return !(t && (t.tier === 'Super-Talent' || t.tier === 'Apex Super-Talent'));
}
function getTalentBudget(c) {
  const classArr = migrateLegacyClasses(c);
  const byHeroClass = {};
  for (const e of classArr) {
    if (e.tier !== 'hero') continue;
    const lvl = e.level || 0;
    // Talents granted at L1, 3, 5, 7, 9 → count = floor((lvl+1)/2) capped at 5.
    const slots = Math.min(5, Math.floor((lvl + 1) / 2));
    if (slots > 0) byHeroClass[e.name] = slots;
  }
  // Bonus grants from feats. Multi-Talented gives 1 talent against any one
  // Hero class tree, treated as that class's 1st-level talents.
  let bonusGrants = 0;
  const ownedFeats = new Set((c.feats || []).map(f => f.name || f.n));
  if (ownedFeats.has('Multi-Talented')) bonusGrants += 1;
  // v8.6.0: the Multi-Talented MUTATION (2 MP advantage) grants a Hero-class
  // talent too — previously catalogue-only, never counted here.
  if ((c.mutations || []).some(m => m.name === 'Multi-Talented')) bonusGrants += 1;
  // v8.4.0: Hero's Gift dual code path (the paired fix to getFeatBudget).
  //   • Legacy characters (no schemaVer): contribute 0 — Hero's Gift went to
  //     feats under v8.3.x. Preserves in-the-wild character budgets exactly.
  //   • v8.4.0+ characters: contribute +1 when c.heroesGiftChoice === 'talent'.
  //     When null (unassigned) or 'feat', the talent budget does NOT include
  //     this slot.
  //
  // The asymmetry between the two paths is intentional: legacy characters
  // continue to operate under the v8.3.x silent-default, while v8.4.0+
  // characters route Hero's Gift to whichever side the player chose.
  const hasHeroClass = classArr.some(e => e.tier === 'hero');
  if (hasHeroClass && !isLegacyCharacter(c) && c.heroesGiftChoice === 'talent') {
    bonusGrants += 1;
  }
  // v8.11.1 Segment B: Anti-Hero (fixed Talent @1 + convertible slots at
  // 3/5/7/9) and Super-Hero/Villain (@2/@4) "talent instead of feat" — flex
  // slots consumed only as needed to cover talent overage; each consumed
  // slot is one bonus-feat slot the character must leave unfilled
  // (getFeatSlotBreakdown subtracts the same count).
  // v8.21.1: only slot-consuming (non-super-tier) talents count as picked.
  // v8.87.0: grantedBy records (Energy Immunity's free Energy Resistance
  // pick) are a GRANT, not a selection — exempt from the budget.
  const slotPicked = (c.talents || []).filter(t => talentConsumesSlot(t.name) && !t.grantedBy).length;
  const superOwned = (c.talents || []).length - slotPicked;
  let flexUsed = 0, flexMax = 0;
  {
    const flex = heroTalentFlex(c);
    bonusGrants += flex.base;
    flexMax = flex.flexMax;
    const baseOwed = Object.values(byHeroClass).reduce((s, n) => s + n, 0) + bonusGrants;
    flexUsed = Math.max(0, Math.min(flexMax, slotPicked - baseOwed));
    bonusGrants += flexUsed;
  }
  const totalOwed = Object.values(byHeroClass).reduce((s, n) => s + n, 0) + bonusGrants;
  const totalPicked = slotPicked;
  return {
    byHeroClass,
    bonusGrants,
    totalOwed,
    totalPicked,
    superOwned,
    remaining: Math.max(0, totalOwed - totalPicked),
  };
}

// Entitlement check: when does a character get the Talents tab on the nav?
// Permissive interpretation — orphaned talents (from edits or class swaps)
// still need to be visible so the player can manage them. So the tab shows if:
//   • The character has at least one Hero class level, OR
//   • The character owns the Multi-Talented Heritage feat, OR
//   • The character already has any talents on record (defensive recovery).
function characterIsEntitledToTalents(c) {
  if (!c) return false;
  const classArr = migrateLegacyClasses(c);
  if (classArr.some(e => e.tier === 'hero' && (e.level || 0) > 0)) return true;
  const ownedFeats = new Set((c.feats || []).map(f => f.name || f.n));
  if (ownedFeats.has('Multi-Talented')) return true;
  if ((c.mutations || []).some(m => m.name === 'Multi-Talented')) return true;  // v8.6.0: the mutation version
  if ((c.talents || []).length > 0) return true;
  return false;
}

// Configuration table for forward-compatible tab gating. When the Spells and
// Powers tabs ship in v8.3.22+, they'll add their own entry here mapping to
// their own entitlement check. The renderNavTabs() controller consults this
// table on every character change.
const NAV_TAB_VISIBILITY = {
  talents: c => characterIsEntitledToTalents(c),
  // v8.6.0 split (Adam): two entitlement-gated tabs over the one unified
  // powers page — Spells (arcane/divine) and Powers (psionic/super). The
  // catalogue stays one Ch.IX listing underneath; the tabs are modes.
  spells: c => characterIsEntitledToSpells(c),
  powers: c => characterIsEntitledToPowers(c),
  // v8.5.3: MP economy — mutants (Mutation Scale ≥ 1, or MP already on the
  // ledger) see the tab; excluded types (Construct etc.) do not.
  mutations: c => characterIsEntitledToMutations(c),
  // v8.13.x Segment A (Adam's contingent-tab ruling): the Vehicles tab
  // appears once something pilotable is owned (vehicles now; power armor,
  // mecha, and starships join in later segments).
  vehicles: c => characterIsEntitledToVehicles(c),
};
function characterIsEntitledToVehicles(c) {
  if (!c) return false;
  // v8.14.x Segment B: the Second Skin feat parks its ectoplasmic exosuit in
  // the motor pool too.
  if (hasFeatNamed(c, 'Second Skin')) return true;
  return getCharItems(c).some(it =>
    it.catalogue === 'vehicle' || it.catalogue === 'mecha' || it.catalogue === 'starship'
    || (it.catalogue === 'armor' && (getCatalogueEntry('armor', it.ref) || {}).type === 'power'));
}

