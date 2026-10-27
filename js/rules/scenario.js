// =============================================================================
// js/rules/scenario.js
// SCENARIO — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Scenarios: presets, custom scenarios and the scenario title
//   generator.
//
// KEY NAMES (so you can search for them)
//   tables and state: customScenarios
//   functions (12): normalizePresetName, saveCustomScenarios,
//   customScenarioByName, scenarioScalesOf, scenarioSummaryStr,
//   scenarioTechScale, _scenarioAxisLabel, _scenarioHash, _scenarioPool1,
//   _scenarioPool2, generateScenarioTitle, disabledClassesForScenario
//
// WHERE IT CAME FROM
//   Gathered from js/app/44-create-scenario-gate-and-layout.js,
//   js/rules/05-six-scales-and-scenarios.js, js/rules/10-minds-ledger-and-
//   magic-browser.js, js/rules/20-scenario-titles-and-heroic-resources.js
//   when the code was regrouped by topic and page. Each function and table
//   moved whole and unchanged, with the comments above it, including the
//   original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function normalizePresetName(n) { return PRESET_LEGACY[n] || n || 'Custom'; }

// ==== v8.54.0: NAME AND ESTABLISH YOUR SCENARIO — THE SIX SCALES ====
// GM-authored scenarios as first-class data: a name, the six dials, an
// optional official lock, and notes. Saved scenarios appear beside the
// built-in presets on the Create page and in Quickdraw, inherit EVERY
// dial-keyed behavior for free (class gating, lock flow, prereq scenario
// checks), and travel between machines as small JSON files. Adam's naming
// doctrine: objective task language ("Name and Establish"), not flavor.
let customScenarios = [];
function saveCustomScenarios() { try { localStorage.setItem('dxd20v2_scenarios', JSON.stringify(customScenarios)); } catch (e) {} }
function customScenarioByName(n) { return customScenarios.find(s => s.name === n) || null; }
// The one lookup every consumer routes through: established scenarios first,
// then the built-in presets (legacy names normalized). Null = Custom/unknown.
function scenarioScalesOf(name) {
  const cs = customScenarioByName(name);
  if (cs) return cs.scales;
  return SCENARIO_PRESETS[normalizePresetName(name)] || null;
}
function scenarioSummaryStr(sc) { return 'A' + (sc.arcane||0) + ' D' + (sc.divine||0) + ' H' + (sc.heroic||0) + ' M' + (sc.mutation||0) + ' P' + (sc.psionic||0) + ' T' + (sc.tech||0); }

function scenarioTechScale(c) { return (c && c.sixLevels && c.sixLevels.tech) || 0; }

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
// Determine which classes are unavailable given the current scenario settings (returns a Set of class names)
function disabledClassesForScenario(sl){
  const dis=new Set();
  if(sl.heroic<1) Object.keys(HERO_CLASSES).forEach(n=>dis.add(n));
  if(sl.divine<1)['Cleric','Paladin','Saint'].forEach(n=>dis.add(n));
  if(sl.arcane<1)['Sorcerer','Wizard'].forEach(n=>dis.add(n));
  if(sl.psionic<1)['Psion','Wilder'].forEach(n=>dis.add(n));
  // v8.5.4: the availability table's Tech Scale 0 column was missing —
  // Aristocrat, Expert, Rogue, Wizard, and Cleric are unavailable in Tech 0
  // scenarios (HH "Class Availability Based on GM Scenario Levels"). The
  // table's footnote — "* The Druid subclass option of Cleric is available
  // in Tech 0 scenarios" — is handled by the caller (onAddClassTierChange
  // keeps Cleric selectable with a Druid-only annotation when only the Tech
  // gate blocks it).
  if((sl.tech??0)<1)['Aristocrat','Expert','Rogue','Wizard','Cleric'].forEach(n=>dis.add(n));
  return dis;
}

