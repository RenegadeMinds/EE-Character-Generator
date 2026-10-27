// =============================================================================
// js/rules/bonuses.js
// BONUSES — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. The bonus engine: adds up typed bonuses with the stacking rules,
//   and builds the full stat block (computeStatBlock) the Sheet and the
//   tests read.
//
// KEY NAMES (so you can search for them)
//   functions (5): aggregateBonuses, buildClassBonuses, computeNaturalAC,
//   computeStatBlock, verifyParity
//
// WHERE IT CAME FROM
//   Gathered from js/rules/19-bonus-aggregator-and-stat-block.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
