// =============================================================================
// js/rules/feats.js
// FEATS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Feat slots and where they come from, feat lookups and
//   prerequisites, feat bonuses, and the typed 1st-level slots.
//
// KEY NAMES (so you can search for them)
//   functions (16): getFeatSlotBreakdown, getRestrictionFilter,
//   getRestrictionFamily, getOpenClassBonusSlots, getFeatData,
//   checkFeatPrereqs, buildFeatBonuses, deriveFirstLevelSlots,
//   slotAcceptsFeat, tryFillFirstLevelSlot, clearFirstLevelSlotForFeat,
//   mergeGMExceptions, recheckGMException, migrateFeats, hasFeatNamed,
//   summarizePrereqs
//
// WHERE IT CAME FROM
//   Gathered from js/app/47-save-character.js, js/app/51-gm-exceptions-and-
//   talents-page.js, js/app/55-mutations-engine.js, js/app/62-power-suites-
//   feats-page-proficiencies.js, js/rules/03-feat-slots-and-caster-
//   progression.js, js/rules/08-feat-prereqs-and-bonuses.js when the code
//   was regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  if (c.classChoices) {
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
  {
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
      const slotPickedF = (c.talents || []).filter(t => talentConsumesSlot(t.name)).length;
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
// ========================================================================
// FEAT PREREQ CHECKER & BONUS INTEGRATION (v8.1)
// ------------------------------------------------------------------------
// Feats use the same prereq vocabulary as classes (see comment block above
// ADVANCED_CLASSES for the type list). One additional type used by feats:
//   {type:'featFamily', family:'Magic', min:N} — must have N feats of given family
//   {type:'characterLevel', min:N} — total character level ≥ N
//   {type:'classLevel', tier:'hero'|'basic'|..., name:'X', min:N} — N levels in named class
//   {type:'heritage'} — feat slot must be a Heritage slot (i.e. taken at 1st level)
// ========================================================================

// Look up a feat in FEATS_DB by name. Returns the feat data object or null.
function getFeatData(name) {
  if (!name) return null;
  return FEATS_DB.find(f => f.n === name) || null;
}

// Check whether a character meets the prereqs for a named feat.
// `char` is the full character record. Returns {met:bool, missing:[strings]}.
// `slotIsHeritage`: optional flag saying the slot being filled is a 1st-level Heritage slot.
function checkFeatPrereqs(featName, char, slotIsHeritage) {
  const feat = getFeatData(featName);
  // v8.5.4 EAL sweep — the feat tables' FOOTER gates, previously unenforced
  // (only feats with explicit sixLevel prereqs were scenario-checked; the
  // many no-prereq Magic/Power feats sailed through the early return below):
  //   HH p.199: "Magic Feats are only available in Arcane Scale 1 and/or
  //   Divine Scale 1 scenarios."
  //   HH p.200: "Power feats are only available in Psionic Scale 1 and/or
  //   Mutation Scale 5 scenarios. Feats with prerequisite 'Psionic 1' are
  //   only available to psionic characters." — that second sentence makes
  //   "Psionic 1" a CHARACTER-type gate on top of the scenario scale: the
  //   character needs a psionic pool (class levels or Psionic Heritage).
  //   Detected as a prereq group consisting solely of psionic-scale checks,
  //   so OR-groups like Aligned Attack's "Psionic 1 or Mutation 5" don't
  //   wrongly demand a psionic character from a mutation-side qualifier.
  const famMissing = [];
  if (feat && (feat.family === 'Magic' || feat.family === 'Power')) {
    const slGate = (char && char.sixLevels) || {};
    if (feat.family === 'Magic' && !((slGate.arcane || 0) >= 1 || (slGate.divine || 0) >= 1)) {
      famMissing.push('Arcane 1+ or Divine 1+ scenario (Magic feat)');
    }
    if (feat.family === 'Power') {
      if (!((slGate.psionic || 0) >= 1 || (slGate.mutation || 0) >= 5)) {
        famMissing.push('Psionic 1+ or Mutation 5+ scenario (Power feat)');
      }
      const psionicOnlyGroup = (feat.prereqs || []).some(g => g.length && g.every(p => p.type === 'sixLevel' && p.axis === 'psionic'));
      if (psionicOnlyGroup && computeCasterStats(char || {}).psionic.contributors.length === 0) {
        famMissing.push('psionic character (Psion/Wilder/Warmind levels or Psionic Heritage)');
      }
    }
  }
  if (!feat || !feat.prereqs || feat.prereqs.length === 0) return {met: famMissing.length === 0, missing: famMissing, heritageOffLevel: false};
  const classArr = migrateLegacyClasses(char || {});
  const stats = computeStatsFromClasses(classArr, (char && char.attrs && char.attrs[5]) || 10);
  const charSkills = (char && char.skills) || {};
  const charFeats = ((char && char.feats) || []).map(f => f.name || f.n)
    // v8.6.1: class-entry proficiency grants satisfy feat prereqs too (a
    // Fighter taking Tower Shield Proficiency has Shield Proficiency via
    // the class grant). Derived pseudo-names, never stored in c.feats.
    .concat(proficiencyPseudoFeats(charProficiencyGrants(char)));
  const sixLevels = (char && char.sixLevels) || {arcane:0, divine:0, heroic:0, mutation:0, psionic:0, tech:0};
  const attrs = (char && char.attrs) || [10,10,10,10,10,10];
  const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  const totalLvl = stats.totalLvl;
  const missing = famMissing.slice();  // family footer gates count as unmet prereqs (v8.5.4)
  // v8.3.31: tracks whether this feat carries a {type:'heritage'} prereq AND
  // the character is above 1st level (so the Heritage feat is "off-level" and
  // should be GM-exception-gated in the UI). See the opt.type==='heritage'
  // branch below.
  let heritageOffLevel = false;
  // Count owned feats by family
  const featsByFamily = {};
  for (const fn of charFeats) {
    const fd = getFeatData(fn);
    if (fd && fd.family) {
      featsByFamily[fd.family] = (featsByFamily[fd.family] || 0) + 1;
    }
  }
  // v8.3.34: PREREQ ENGINE SEMANTICS — within-group OR, between-group AND.
  //
  // The shape `prereqs: [G1, G2, G3]` where each G is an array of opts is
  // evaluated as: (G1) AND (G2) AND (G3), where each group itself is
  // evaluated as an OR of its options:
  //
  //   prereqs: [[A, B], [C]]   means   (A OR B) AND (C)
  //   prereqs: [[A], [B]]      means   A AND B   (two single-item groups)
  //   prereqs: [[A, B]]        means   A OR B    (one group with alternatives)
  //
  // The loop below sets groupMet=true on the FIRST satisfied opt in a group
  // (the `break`), and pushes a miss for any group that ends with no opt
  // satisfied. Final met=true requires the missing[] list to be empty —
  // every group must have been satisfied.
  //
  // Common authoring mistake: listing two REQUIRED prereqs as separate
  // multi-item groups `[[A, B]]` (which means A-OR-B) when they should be
  // `[[A], [B]]` (A-AND-B). When in doubt, default to single-item groups —
  // they're the AND case and what most handbook prereqs ("X, Y, and Z")
  // actually mean.
  for (const group of feat.prereqs) {
    let groupMet = false;
    const groupDescs = [];
    for (const opt of group) {
      let optDesc = '', optMet = false;
      if (opt.type === 'bab') {
        optDesc = `Base Attack +${opt.min}`;
        optMet = stats.bab >= opt.min;
      } else if (opt.type === 'def') {
        optDesc = `Defense Bonus +${opt.min}`;
        optMet = stats.def >= opt.min;
      } else if (opt.type === 'save') {
        // v8.3.33: BASE save bonus (class progression only) — no attribute
        // mod, no feat bonuses. The handbook prereq for Improved Natural
        // Healing reads "Base Fortitude save bonus +5"; this is the same
        // sense of "base" used by `stats.fort/ref/will` from
        // computeStatsFromClasses, which sums class progressions only.
        // Previously the prereq engine had no handler for {type:'save'} at
        // all, so the prereq silently fell through and the feat showed as
        // qualified regardless of save value — bug.
        const saveLabel = {fort:'Fortitude', ref:'Reflex', will:'Will'}[opt.save] || opt.save;
        optDesc = `Base ${saveLabel} save +${opt.min}`;
        optMet = (stats[opt.save] || 0) >= opt.min;
      } else if (opt.type === 'tierLevel') {
        // v8.3.33: at least N total levels in classes of the named tier.
        // Mirrors the handler in checkClassPrereqsFromArray. Used for prereqs
        // like Heroic Surge's "at least one level in any Hero class". The
        // class engine had this handler; the feat engine did not — bug.
        const tierLabel = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[opt.tier] || opt.tier;
        const tierLvls = classArr.reduce((s,e) => s + (e.tier===opt.tier ? (e.level||0) : 0), 0);
        optDesc = `${opt.min}+ level${opt.min===1?'':'s'} in any ${tierLabel} class`;
        optMet = tierLvls >= opt.min;
      } else if (opt.type === 'allegiance' || opt.type === 'alignment') {
        // v8.3.34: ALIGNMENT vs ALLEGIANCE — asymmetric handlers.
        //
        // The system distinguishes two related-but-distinct concepts:
        //   • ALIGNMENT is the character's *current ethical/moral state* (the
        //     runtime fact): Lawful Good, Chaotic Neutral, etc.
        //   • ALLEGIANCE is a *commitment* the character has taken on: an
        //     ideal, organization, deity, or alignment-axis pole they've
        //     dedicated themselves to.
        //
        // The two are not fully orthogonal. The rule (per design discussion):
        // alignment ESTABLISHES allegiance on its non-neutral axes. A Lawful
        // Neutral character necessarily HAS an Allegiance to Law (their
        // alignment commits them on that axis), and MAY have one further
        // ethical allegiance (Good OR Evil — not both, "no man can serve two
        // masters"), plus any number of allegiances to non-axis concepts
        // (deities, organizations, ideals). A character with alignment Good
        // cannot have an Allegiance to Evil — that would be the diametric
        // contradiction the rule prohibits.
        //
        // The handlers are therefore ASYMMETRIC:
        //   • `allegiance` accepts a match on EITHER the allegiance field OR
        //     the alignment field (alignment establishes allegiance).
        //   • `alignment` accepts a match on the alignment field ONLY
        //     (allegiance does NOT establish alignment — a character with
        //     Allegiance to Good can be alignment Neutral Good, Chaotic
        //     Good, or even Lawful/Chaotic/True Neutral with Good filling
        //     in their otherwise-neutral ethical axis).
        //
        // This asymmetry is intentional and load-bearing. Future maintainers
        // tempted to "simplify" by making the two symmetric should re-read
        // this comment first.
        const charAllegiance = (char && char.allegiance) || '';
        const charAlign = (char && char.align) || '';
        const cmp = (opt.type === 'allegiance')
          ? ((charAllegiance + ' / ' + charAlign).toLowerCase())   // loose: either field
          : (charAlign.toLowerCase());                              // strict: align only
        const has = cmp.includes(opt.value.toLowerCase());
        const fieldLabel = (opt.type === 'allegiance') ? 'allegiance' : 'alignment';
        if (opt.polarity === 'lacks') {
          optDesc = `no ${fieldLabel} to ${opt.value}`;
          optMet = !has;
        } else {
          optDesc = `${fieldLabel}: ${opt.value}`;
          optMet = has;
        }
      } else if (opt.type === 'attr') {
        optDesc = `${opt.name} ${opt.min}+`;
        const idx = ATTR_IDX[opt.name];
        optMet = idx !== undefined && (attrs[idx]||0) >= opt.min;
      } else if (opt.type === 'attrAny') {
        optDesc = `any one attribute ${opt.min}+`;
        optMet = attrs.some(a => (a||0) >= opt.min);
      } else if (opt.type === 'skill') {
        optDesc = `${opt.name} ${opt.min} ranks`;
        optMet = (charSkills[opt.name] || 0) >= opt.min;
      } else if (opt.type === 'feat') {
        optDesc = `feat: ${opt.name}`;
        optMet = charFeats.some(fn => fn.toLowerCase().startsWith(opt.name.toLowerCase()));
      } else if (opt.type === 'featParam') {
        // v8.5.0: parameterized-feat prereq ("Weapon Focus with selected
        // weapon" / "Spell Focus in the selected school"). At browse time no
        // parameter has been chosen yet, so this checks whether the character
        // owns ANY instance of the named feat; the same-parameter requirement
        // is enforced at parameter-choice time, where promptForFeatParam
        // filters the option list to qualifying parameters. Previously these
        // were authored as plain {type:'feat'} refs with names like "Weapon
        // Focus with selected weapon" — the prefix matcher above could never
        // match those against an owned feat, so Greater Weapon Focus, Weapon
        // Specialization, Greater Weapon Specialization, and Greater Spell
        // Focus were structurally unobtainable.
        optDesc = `${opt.name} (same ${feat.param?.param_label?.toLowerCase() || 'parameter'})`;
        optMet = charFeats.some(fn => fn === opt.name);
      } else if (opt.type === 'weaponProficiency') {
        // v8.5.0: "proficiency with selected weapon". Per HH, all player
        // characters are assumed to have Simple Weapon Proficiency, so at
        // browse time (no weapon chosen yet) this is met by default; the real
        // enforcement happens at parameter-choice time, where the weapon list
        // is filtered through isProficientWithWeapon().
        optDesc = 'proficiency with selected weapon';
        optMet = true;
      } else if (opt.type === 'allegianceAny') {
        // v8.5.0: at least one declared allegiance, any value (Nonlethal
        // Spell). The allegiance field is free text; any non-empty entry
        // counts. Use {type:'allegiance', value} when a SPECIFIC allegiance
        // is required.
        optDesc = 'at least one declared allegiance';
        optMet = ((char && char.allegiance) || '').trim().length > 0;
      } else if (opt.type === 'featFamily') {
        optDesc = `${opt.min} ${opt.family} feat${opt.min===1?'':'s'}`;
        optMet = (featsByFamily[opt.family] || 0) >= opt.min;
      } else if (opt.type === 'characterLevel') {
        optDesc = `Character Level ${opt.min}+`;
        optMet = totalLvl >= opt.min;
      } else if (opt.type === 'classLevel') {
        const tierLbl = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[opt.tier]||opt.tier;
        optDesc = `${opt.name||tierLbl} Lvl ${opt.min}+`;
        optMet = classArr.some(e =>
          (!opt.tier || e.tier === opt.tier) &&
          (!opt.name || e.name === opt.name) &&
          (e.level||0) >= (opt.min||1));
      } else if (opt.type === 'sixLevel') {
        optDesc = `${SIX_LEVELS[opt.axis]?.short || opt.axis} ${opt.min}+ scenario`;
        optMet = (sixLevels[opt.axis] || 0) >= opt.min;
      } else if (opt.type === 'sixLevelAny') {
        const labels = opt.axes.map(a => `${SIX_LEVELS[a]?.short || a} ${opt.min}+`);
        optDesc = labels.join(' or ') + ' scenario';
        optMet = opt.axes.some(a => (sixLevels[a] || 0) >= opt.min);
      } else if (opt.type === 'heritage') {
        // Heritage is a slot designation, not a hard prerequisite. A Heritage
        // feat must be taken in a 1st-level Heritage slot.
        //
        // v8.3.31 (stopgap): the prereq-check stays "met" (Heritage isn't an
        // UNMET prereq the way "BAB +2" is — it's a slot-eligibility rule), so
        // it never pollutes the `missing` array. But we now SIGNAL the
        // off-level state via a separate `heritageOffLevel` flag on the return,
        // so the feat browser can present these as GM-exception-gated when the
        // character is above 1st level.
        //
        // The rule: at total level 1, Heritage feats offer normally. Above
        // level 1, they are GM-exception-gated (the canonical real-world case
        // being Supernatural Mutation gained mid-campaign through an
        // exceptional in-game scenario). `slotIsHeritage === true` is an
        // explicit override that says "this slot is a designated 1st-level
        // Heritage slot" — when set, no off-level gating applies. This is
        // forward-compatible with v8.4.0's typed-slot model: the level===1
        // branch becomes the mandatory 1st-level genesis step, the level>1
        // branch becomes the Level Up flow, and the GM-exception gating
        // carries over unchanged.
        optDesc = 'Heritage feat (taken in 1st-level Heritage slot)';
        optMet = true;
        if (totalLvl > 1 && slotIsHeritage !== true) {
          heritageOffLevel = true;
        }
      } else if (opt.type === 'casterLevel') {
        // opt.pool: 'arcane'|'divine'|'any' (any = at least one of arcane/divine)
        const cl = computeCasterLevels(char || {});
        if (opt.pool === 'any') {
          optDesc = `Caster level ${opt.min}+ (EAL or EDL)`;
          optMet = (cl.arcane >= opt.min) || (cl.divine >= opt.min);
        } else {
          const effP = POOL_EFF_LEVEL[opt.pool];
          optDesc = `${effP ? effP.full + ' (' + effP.abbr + ')' : opt.pool} ${opt.min}+`;
          optMet = (cl[opt.pool] || 0) >= opt.min;
        }
      } else if (opt.type === 'manifesterLevel') {
        // v8.5.4 EAL sweep: Power feats serve BOTH manifester types — the
        // psionic-only feats are gated separately by "Psionic 1" (see the
        // family-gate block above), so a bare "Manifester Level N" prereq
        // (Split Ray, Power Specialization, Metamorphic Transfer...) is met
        // by EPL or by a super-mutant's ESL.
        const cl = computeCasterLevels(char || {});
        const mpSt = getMPState(char || {});
        const esl = mpSt.isSuperMutant ? (mpSt.eml || 0) : 0;
        optDesc = `Manifester level ${opt.min}+ (EPL or ESL)`;
        optMet = (cl.psionic || 0) >= opt.min || esl >= opt.min;
      } else if (opt.type === 'note') {
        optDesc = opt.text + ' (GM-verify)';
        optMet = false;
      }
      groupDescs.push(optDesc);
      if (optMet) { groupMet = true; break; }
    }
    if (!groupMet) missing.push(groupDescs.join(' OR '));
  }
  return {met: missing.length === 0, missing, heritageOffLevel};
}

// Build a typed bonus list from a character's feats. Each feat entry can have an
// optional `bonuses` array — entries like {type, value, target, condition?} —
// and those become typed bonus contributions tagged with source='feat:<name>'.
// Returns an object keyed by target stat: {fort:[...], will:[...], ac:[...], ...}.
function buildFeatBonuses(char) {
  const out = {};
  if (!char || !char.feats) return out;
  // v9.2.2 (Adam's ruling 2026-10-06; HH p.250): Ultra Immune System — +2 on
  // Fortitude vs poisons, diseases and radiation sickness: a CONDITIONAL row
  // under the Fortitude save. Mutation-granted, it is a mutation bonus.
  {
    const uis = char.feats.find(f => (f.name || f.n) === 'Ultra Immune System');
    if (uis) (out.fort = out.fort || []).push({ type: /\(mutation\)$/.test(uis.grantedBy || '') ? 'mutation' : 'untyped', source: 'feat:Ultra Immune System', value: 2, condition: 'vs poison, disease & radiation sickness', label: 'Ultra Immune System' + (/\(mutation\)$/.test(uis.grantedBy || '') ? ' (mutation bonus)' : '') });
  }
  for (const fe of char.feats) {
    const fname = fe.name || fe.n;
    const feat = getFeatData(fname);
    if (!feat || !feat.bonuses) continue;
    for (const b of feat.bonuses) {
      const target = b.target;
      if (!target) continue;
      (out[target] = out[target] || []).push({
        type: b.type,
        source: `feat:${fname}` + (fe.param ? ` (${fe.param})` : ''),
        value: b.value,
        condition: b.condition || null,
        label: feat.n + (fe.param ? ` (${fe.param})` : ''),
      });
    }
  }
  return out;
}

// v8.4.0: derive the typed 1st-level feat slots for a freshly-created
// character. Called from saveCharacter for new (non-Edit) saves to populate
// c.firstLevelSlots. Returns an array of slot records:
//   {kind, filled: null, filledParam: null, ...(kind-specific fields)}
//
// The slot record is the *authoritative* source of truth for "where did
// this L1 feat come from." Existing code reads c.feats with origin tags;
// v8.4.0 layers slot records on top so the player's L1 picks can be
// reconciled, displayed by source, and edited cleanly.
//
// Slot kinds and trigger rules (per plan §5):
//   • base       — always (one universal L1 feat)
//   • heritage   — always (one L1 Heritage slot)
//   • human      — iff race === 'Human'
//   • occupation — one per occupation with bonus_feat_options
//   • herosGift  — iff any class is tier:'hero' AND heroesGiftChoice === 'feat'
//
// At save time the herosGift slot is NOT yet populated (heroesGiftChoice
// starts as null on a new Hero-classed character — the player makes the
// choice on the Sheet). So this function emits only the base/heritage/
// human/occupation slots at first save; the herosGift slot is added later
// when the player commits to 'feat' on the Sheet.
function deriveFirstLevelSlots({race, classes, occupations, hybrid}) {
  const slots = [];
  slots.push({kind:'base', filled:null, filledParam:null});
  slots.push({kind:'heritage', filled:null, filledParam:null});
  // v8.70.1: Human-PARENTED Hybrids inherit the Human bonus slot ("all
  // racial abilities of both parents").
  if (race === 'Human' || (race === 'Hybrid' && hybrid && (hybrid.a === 'Human' || hybrid.b === 'Human'))) {
    slots.push({kind:'human', filled:null, filledParam:null});
  }
  // One occupation slot per occupation that has bonus_feat_options.
  for (const occName of (occupations || [])) {
    if (!occName) continue;
    const occData = getOccupationData(occName);
    if (occData && occData.bonus_feat_options && occData.bonus_feat_options.length) {
      slots.push({
        kind:'occupation',
        filled:null,
        filledParam:null,
        occupation: occName,
        options: occData.bonus_feat_options.slice(),
      });
    }
  }
  // herosGift slot is added later when the player assigns Hero's Gift to
  // 'feat' on the Sheet — not at first save.
  return slots;
}

// v8.4.0: predicate — can a feat fill a slot of the given kind?
//
// Rules (per plan §5):
//   • An occupation slot accepts ONLY feats on its `options` list.
//   • A Heritage feat (family === 'Heritage') accepts any Heritage-eligible
//     slot kind: base, heritage, human, herosGift.
//   • A general (non-Heritage) feat accepts any non-occupation slot kind:
//     base, heritage, human, herosGift. (It can fill the heritage slot if
//     no Heritage feat needs it — Heritage slots are not Heritage-feat-ONLY.)
//
// The picker downstream prefers more-restricted-first via
// SLOT_PREFERENCE_ORDER so loose slots stay open for picks that need them.
function slotAcceptsFeat(slot, featName) {
  if (!slot || slot.filled !== null) return false;  // already filled
  const data = getFeatData(featName);
  const isHeritage = data && data.family === 'Heritage';
  if (slot.kind === 'occupation') {
    // Occupation slots are hard-restricted to their options list.
    return Array.isArray(slot.options) && slot.options.includes(featName);
  }
  if (HERITAGE_ELIGIBLE_KINDS.has(slot.kind)) {
    if (isHeritage) return true;  // Heritage feats fill any Heritage-eligible slot
    // General feats can also fill Heritage-eligible slots — these slots are
    // not Heritage-ONLY, they're Heritage-ELIGIBLE.
    return true;
  }
  return false;
}

// v8.4.0: try to assign a freshly-added L1 feat to an unfilled slot.
// Mutates the slot in place; returns the slot kind that was filled (for
// downstream logging/UX), or null if no slot matched.
//
// Called from addFeatToChar AFTER the feat has been pushed to c.feats.
// Only runs for v8.4.0+ characters; legacy characters never get slot
// reconciliation (their L1 feats live in c.feats with origin tags, the
// pre-v8.4.0 mechanism).
//
// Also only fires when the character is currently at total level 1 — feats
// added at higher levels (via Level Up or Edit) don't fill L1 slots even
// for v8.4.0 characters.
//
// Slot preference: walks SLOT_PREFERENCE_ORDER (most-restricted first) and
// picks the first slot of a kind that accepts this feat. Within a kind
// (e.g. two occupation slots from primary+secondary), picks the first
// unfilled one.
function tryFillFirstLevelSlot(c, featName, featParam) {
  if (!c || isLegacyCharacter(c)) return null;
  if (!Array.isArray(c.firstLevelSlots)) return null;
  // Only L1 characters fill L1 slots. (totalLvl may not be set yet on a
  // newborn character mid-save; fall back to a class-array sum.)
  const totalLvl = c.totalLvl || (c.classes||[]).reduce((s,e)=>s+(e.level||0),0);
  if (totalLvl !== 1) return null;
  for (const preferredKind of SLOT_PREFERENCE_ORDER) {
    const slot = c.firstLevelSlots.find(s => s.kind === preferredKind && s.filled === null && slotAcceptsFeat(s, featName));
    if (slot) {
      slot.filled = featName;
      slot.filledParam = featParam || null;
      return slot.kind;
    }
  }
  return null;
}

// v8.4.0: when a feat is removed, clear whichever L1 slot was filling it
// (if any). Reverse of tryFillFirstLevelSlot. No-op for legacy characters
// or feats that weren't slot-tracked.
function clearFirstLevelSlotForFeat(c, featName, featParam) {
  if (!c || isLegacyCharacter(c)) return;
  if (!Array.isArray(c.firstLevelSlots)) return;
  const slot = c.firstLevelSlots.find(s =>
    s.filled === featName &&
    (s.filledParam || null) === (featParam || null)
  );
  if (slot) {
    slot.filled = null;
    slot.filledParam = null;
  }
}
// ========== FEATS ==========
// ========== FEATS (v8.1) ==========
// Char feats are stored as {name, param?} — minimal references into FEATS_DB.
// Legacy entries {n, t, pre, d} from v6-v8.0 are migrated on first render.

// Normalize a character's feats array to the v8.1 {name, param?} schema.
// Idempotent and lossless: legacy {n,t,pre,d} entries become {name:n, _legacy:{t,pre,d}}
// so any custom (non-FEATS_DB) entries keep their inline metadata for display.
// ========== GM EXCEPTIONS (v8.1.3) ==========
// When a user clicks "Save anyway" past a prereq warning, the override is
// recorded as a structured exception on the character. The sheet displays
// these in a small banner so the player and GM both see the audit trail.
// Each exception: {type:'class'|'feat', target:string, missing:[strings],
//                  grantedAt:dateString, resolved?:bool}
function mergeGMExceptions(prev, pending){
  // Dedupe by target. If a pending entry has the same target as a previous one,
  // we keep the previous (preserving the original grant date).
  const out = (prev || []).slice();
  for (const ex of (pending || [])) {
    if (!out.find(p => p.target === ex.target)) out.push(ex);
  }
  return out;
}

// Re-check whether the exception's prereqs are now met (e.g. the player has
// since acquired the missing feat or stat). Used to display a ✓ Resolved badge.
function recheckGMException(ex, char){
  if (!ex || !char) return false;
  if (ex.type === 'feat') {
    const featName = ex.target.replace(/^Feat:\s*/, '');
    const r = checkFeatPrereqs(featName, char);
    return r.met;
  }
  if (ex.type === 'class') {
    // For "Career Path" entries, the prereq is structural — once granted, it stays met
    // because the rule check happens at add-time, not on an ongoing basis.
    if (ex.missing && ex.missing.some(m => m.includes('Career Path'))) return true;
    // For class-prereq overrides (Advanced/Prestige), re-run the prereq check.
    // The target is "ClassName (Tier)" — extract the name.
    const targetMatch = ex.target.match(/^Class(?:\s*\([^)]+\))?:\s*(.+?)\s*\(/);
    const className = targetMatch ? targetMatch[1] : null;
    if (!className) return false;
    const classArr = migrateLegacyClasses(char);
    const other = classArr.filter(e => e.name !== className);
    const sl = char.sixLevels || {arcane:0,divine:0,heroic:0,mutation:0,psionic:0,tech:0};
    const ctx = {attrs:char.attrs||[10,10,10,10,10,10], allegiance:char.allegiance||'', align:char.align||'', char};
    const r = checkClassPrereqsFromArray(className, other, char.skills||{}, (char.feats||[]).map(f=>f.name||f.n), sl, ctx);
    return r.met;
  }
  return false;
}

function migrateFeats(c) {
  if (!c || !c.feats) return;
  let changed = false;
  c.feats = c.feats.map(f => {
    if (f.name) return f; // already migrated
    if (f.n) {
      changed = true;
      const out = {name: f.n};
      // Preserve custom-feat metadata for display when FEATS_DB lookup fails
      const inDb = FEATS_DB.some(d => d.n === f.n);
      if (!inDb) {
        out._legacy = {t: f.t||'General', pre: f.pre||'', d: f.d||''};
      }
      return out;
    }
    return f;
  });
  return changed;
}

function hasFeatNamed(c, n) { return ((c && c.feats) || []).some(f => (f.name || f.n) === n); }

// Produce a human-readable summary of a prereq array (groups joined by '·', OR-options by 'or').
function summarizePrereqs(prereqs){
  return prereqs.map(group => {
    return group.map(opt => {
      if (opt.type === 'bab') return `BAB +${opt.min}`;
      if (opt.type === 'def') return `Def +${opt.min}`;
      if (opt.type === 'attr') return `${opt.name} ${opt.min}+`;
      if (opt.type === 'attrAny') return `any attr ${opt.min}+`;
      if (opt.type === 'skill') return `${opt.name} ${opt.min} ranks`;
      if (opt.type === 'feat') return opt.name;
      if (opt.type === 'featFamily') return `${opt.min} ${opt.family} feat${opt.min===1?'':'s'}`;
      if (opt.type === 'characterLevel') return `char level ${opt.min}+`;
      if (opt.type === 'classLevel') return `${opt.name||opt.tier} ${opt.min}+`;
      if (opt.type === 'sixLevel') return `${SIX_LEVELS[opt.axis]?.short||opt.axis} ${opt.min}+`;
      if (opt.type === 'casterLevel') return opt.pool==='any' ? `EAL/EDL ${opt.min}+` : `${(POOL_EFF_LEVEL[opt.pool]||{}).abbr||opt.pool} ${opt.min}+`;
      if (opt.type === 'manifesterLevel') return `EPL/ESL ${opt.min}+`;
      if (opt.type === 'heritage') return '1st-level slot';
      if (opt.type === 'allegiance') return `${opt.polarity==='lacks'?'no ':''}allegiance to ${opt.value}`;
      if (opt.type === 'note') return opt.text;
      // v8.5.4 ergo: types below previously fell through to raw
      // JSON.stringify — visible as "Prereq: {"type":"featParam"...}" in the
      // browser rows (Greater Spell Focus, Weapon Specialization, etc.).
      if (opt.type === 'featParam') return `${opt.name} (same choice)`;
      if (opt.type === 'allegianceAny') return 'at least one declared allegiance';
      if (opt.type === 'weaponProficiency') return 'proficiency with the chosen weapon';
      if (opt.type === 'alignment') return `${opt.polarity==='lacks'?'non-':''}${opt.value} alignment`;
      if (opt.type === 'save') return `base ${({fort:'Fort',ref:'Ref',will:'Will'})[opt.save]||opt.save} save +${opt.min}`;
      if (opt.type === 'sixLevelAny') return opt.axes.map(a=>`${SIX_LEVELS[a]?.short||a} ${opt.min}+`).join(' or ');
      if (opt.type === 'sixLevelOr') return opt.options.map(o=>`${SIX_LEVELS[o.axis]?.short||o.axis} ${o.min}+`).join(' or ');
      if (opt.type === 'tierLevel') return `${opt.min}+ ${opt.tier} level${opt.min===1?'':'s'}`;
      if (opt.type === 'skillFamily') return `${opt.family} (any) ${opt.min} ranks`;
      if (opt.desc) return opt.desc;
      return JSON.stringify(opt);
    }).join(' or ');
  }).join(' · ');
}
