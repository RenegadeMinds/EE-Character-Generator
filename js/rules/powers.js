// =============================================================================
// js/rules/powers.js
// POWERS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Spells and powers: caster levels and pools, the repertoire,
//   spell lists and schools, variants, casting helpers and power themes.
//
// KEY NAMES (so you can search for them)
//   functions (23): computeCasterLevels, computeCasterStats,
//   _emptyPoolStats, powerHoverText, spellSchool, isPsionicSpell,
//   displayNameForRoute, getCharPowers, getCasterPoolsInfo,
//   spellPoolOptions, reconcileExpandedKnowledgePowers, getPowersBudget,
//   _pwModePools, _pwSideLabel, knownPickedByLevel, logPowerException,
//   isPsiFocusCapable, psiFocusLocked, poolSpontaneity, parseAugmentSpec,
//   rollNd8, _powerThemeSets, _themesOfPower
//
// WHERE IT CAME FROM
//   Gathered from js/app/52-energy-immunity-and-spell-lists.js,
//   js/app/54-powers-repertoire.js, js/app/56-supernatural-attributes-pools-
//   psi-focus.js, js/app/61-casting-augments-and-powers-page.js,
//   js/app/62-power-suites-feats-page-proficiencies.js, js/rules/03-feat-
//   slots-and-caster-progression.js, js/rules/12-wealth-and-prices.js when
//   the code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
    const _effA = effAttrs(char);
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
      const attrScore = (effAttrs(char))[attrIdx[prog.attr]] || 10;
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
    const _hyPP = hybridInfo(char);
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
    if (p.contributors.length) {
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
// v8.79.0 (Adam's Rhad report): the hover dossier for Sheet power rows —
// a plain-text stat line + the full description for a title attribute.
// The house cursor:help idiom: full accessibility at zero vertical cost,
// no duplication of the Powers/Spells tabs' management surfaces.
function powerHoverText(s) {
  if (!s) return '';
  const bits = [];
  if (s.school_raw) bits.push(s.school_raw);
  if (s.casting_time) bits.push('Cast: ' + s.casting_time);
  if (s.display) bits.push('Display: ' + s.display);
  if (s.range) bits.push('Range: ' + s.range);
  if (s.target) bits.push('Target: ' + s.target);
  if (s.area) bits.push('Area: ' + s.area);
  if (s.effect) bits.push('Effect: ' + s.effect);
  if (s.duration) bits.push('Duration: ' + s.duration);
  if (s.save) bits.push('Save: ' + s.save);
  if (s.resistance) bits.push('SR/PR: ' + s.resistance);
  return bits.join(' · ') + (s.d ? '\n\n' + s.d : '');
}
function spellSchool(s) { const m = /^([A-Za-z]+)/.exec((s && s.school_raw) || ''); return m ? m[1] : null; }
function isPsionicSpell(s) { return PSIONIC_SCHOOLS.includes(spellSchool(s)); }

// Resolve the display name for one (spell, route) pair. Order:
//   1. the route's own `applies` tag (extraction-captured per-level variant,
//      e.g. Dominate Being via Drd 3 = "Dominate Animal")
//   2. the granting DOMAIN's slot name (its list's own idiom; trailing
//      component markers stripped) — never for the psionic 'War' token
//   3. the parent's single Arcane-variant name on arcane-pool routes (the
//      Sor/Wiz & Bard lists use the arcane names: Enlarge Person, Mage
//      Armor, Polymorph…). Multi-variant parents (Charm/Hold/Dominate
//      Being) keep the parent name unless an `applies` tag decides.
//   4. the entry's own name.
function displayNameForRoute(spell, opt) {
  if (opt.applies && opt.applies !== spell.name) return opt.applies;
  if (opt.pool !== 'psionic') {
    const dd = DOMAINS_DB.find(d => d.name === opt.token);
    const slot = dd && dd.spells && dd.spells[String(opt.lvl)];
    if (slot && slot.name) return slot.name.replace(/\s+[AFMX]{1,2}$/, '');
  }
  if (opt.pool === 'arcane') {
    const cands = (VARIANTS_BY_PARENT[spell.name] || []).filter(v => v.kind === 'Arcane');
    if (cands.length === 1) return cands[0].name;
  }
  // v8.16.1: psionic routes show a sole Psionic Variant name (Permanency →
  // "Incarnate", per the 2026-09-03 HH's variant subtitle).
  if (opt.pool === 'psionic') {
    const cands = (VARIANTS_BY_PARENT[spell.name] || []).filter(v => v.kind === 'Psionic');
    if (cands.length === 1) return cands[0].name;
  }
  return spell.name;
}



function getCharPowers(c) { return (c && c.powers) || []; }

// Per-pool casting info: which list tokens this character reaches, the pool's
// max castable power level, and its known-count budget (null = no limit).
function getCasterPoolsInfo(c) {
  const stats = computeCasterStats(c || {});
  const pools = {};
  const arcaneContribs = [];
  for (const e of migrateLegacyClasses(c || {})) {
    if (!e.level || e.level <= 0) continue;
    const map = SPELL_LIST_TOKENS[e.name];
    if (!map) continue;
    // v8.5.4: scenario Scale gate — casting requires the pool's Scale ≥ 1
    // (HH class-availability rules; at Scale 0 the Ranger/Bard swap to their
    // Nature's Secrets / Storyteller variants instead, and no class casts
    // from a Scale-0 pool). Pool names match the sixLevels axis names.
    if ((((c && c.sixLevels) || {})[map.pool] ?? 0) === 0) continue;
    const st = stats[map.pool] || {};
    if (!pools[map.pool]) pools[map.pool] = { tokens: new Map(), classes: [], maxPowerLvl: st.maxPowerLvl || 0, powersKnownTotal: st.powersKnownTotal || 0,
      // v8.33.0 (Adam's Heinrix Sorcerer report): spontaneous SPELL casters'
      // knowns live in spellsKnown[] (per spell level), not powersKnownTotal —
      // the pools map never carried them, so every Sorcerer/Bard pool read
      // "no limit" since v8.5.x. Carried now for the known-count budget.
      spellsKnownTotal: (st.spellsKnown || []).reduce((s, n) => s + (n || 0), 0),
      spellsKnownByLvl: (st.spellsKnown || []).slice() };
    const p = pools[map.pool];
    p.classes.push(e.name);
    // ---- v8.5.4 sub-option routing (see the SPELL_LIST_TOKENS comment) ----
    if (e.name === 'Cleric') {
      if (c && c.druidOption) {
        if (!p.tokens.has('Drd')) p.tokens.set('Drd', null);
      } else {
        if (!p.tokens.has('Clr')) p.tokens.set('Clr', null);
        for (const d of ((c && c.clericDomains) || [])) if (!p.tokens.has(d)) p.tokens.set(d, null);
      }
      continue;
    }
    if (e.name === 'Saint') {
      const sd = (c && c.saintDomains) || [];
      if (sd.length) {
        for (const d of sd) if (!p.tokens.has(d)) p.tokens.set(d, null);
        p._saintConfigured = true;
        // v8.5.4: Personal Domain — one GM-approved Cleric-list spell at 3rd
        // and every odd Saint level after (HH Saint table); permanent once
        // chosen. Budget enforced in finishAddPower gate 3.
        p._saintPersonalBudget = Math.max(0, Math.floor(((e.level || 0) - 1) / 2));
      } else if (!p.tokens.has('Clr')) {
        p.tokens.set('Clr', map.advisory);
      }
      continue;
    }
    if (e.name === 'Paladin') {
      // v8.5.4: domains-only, like the Saint — but with NO Cleric-list
      // fallback: unconfigured Paladins previously had a dead token (empty
      // list), so there's no legacy behavior to preserve; the sub-options
      // picker prompts for the deity's domains instead.
      for (const d of ((c && c.paladinDomains) || [])) if (!p.tokens.has(d)) p.tokens.set(d, null);
      continue;
    }
    if (e.name === 'Psion') {
      for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, null);
      const disc = c && c.psionDiscipline;
      if (disc && map.disciplineTokens.includes(disc)) {
        // Chosen discipline is native; the other five are hard-excluded
        // (no token = no route). Expanded Knowledge picks bypass via
        // _expandedNames below.
        if (!p.tokens.has(disc)) p.tokens.set(disc, null);
      } else {
        for (const t of map.disciplineTokens) if (!p.tokens.has(t)) p.tokens.set(t, 'discipline power — requires the matching Psion discipline (GM confirm)');
      }
      continue;
    }
    for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, map.advisory || null);
    if (map.psionicOnly) {
      p._psionicOnlyTokens = p._psionicOnlyTokens || new Set();
      for (const t of map.tokens) p._psionicOnlyTokens.add(t);
    }
    if (map.pool === 'arcane' && map.tokens.includes('Sor/Wiz')) arcaneContribs.push(e.name);
  }
  // v8.30.0 (Adam): Heritage feats — chosen-class list access at 1st level.
  // Mirrors the class loop's sub-option routing above (deliberately kept
  // separate: that loop is battle-tested; Heritage rides beside it). A feat
  // whose chosen class has real levels contributes nothing here — the class
  // rows above already carry its tokens (subsumption). No param = no tokens
  // yet (the Feats tab offers ⬦ choose). Heritage grants the BASE list of the
  // class: no Cleric domains, no Wizard school specialization, no Saint deity
  // domains or Personal Domain budget — those are class-level choices.
  {
    const HERITAGE_POOLS = { 'Arcane Heritage': 'arcane', 'Divine Heritage': 'divine', 'Psionic Heritage': 'psionic' };
    const hClassArr = migrateLegacyClasses(c || {});
    for (const f of ((c && c.feats) || [])) {
      const nm = typeof f === 'string' ? f : (f.name || f.n);
      if (!HERITAGE_POOLS[nm]) continue;
      const chosenRaw = (typeof f !== 'string' && f.param) ? f.param : null;
      if (!chosenRaw) continue;
      const druidVariant = chosenRaw === 'Cleric (Druid Option)';
      const chosen = druidVariant ? 'Cleric' : chosenRaw;
      const map = SPELL_LIST_TOKENS[chosen];
      if (!map) continue;
      if ((((c && c.sixLevels) || {})[map.pool] ?? 0) === 0) continue;  // scenario Scale gate, as for classes
      if (hClassArr.some(e => e.name === chosen && (e.level || 0) > 0)) continue;  // subsumed
      const st = stats[map.pool] || {};
      if (!pools[map.pool]) pools[map.pool] = { tokens: new Map(), classes: [], maxPowerLvl: st.maxPowerLvl || 0, powersKnownTotal: st.powersKnownTotal || 0,
      // v8.33.0 (Adam's Heinrix Sorcerer report): spontaneous SPELL casters'
      // knowns live in spellsKnown[] (per spell level), not powersKnownTotal —
      // the pools map never carried them, so every Sorcerer/Bard pool read
      // "no limit" since v8.5.x. Carried now for the known-count budget.
      spellsKnownTotal: (st.spellsKnown || []).reduce((s, n) => s + (n || 0), 0),
      spellsKnownByLvl: (st.spellsKnown || []).slice() };
      const p = pools[map.pool];
      p.classes.push(chosen);
      if (chosen === 'Cleric') {
        if (druidVariant) { if (!p.tokens.has('Drd')) p.tokens.set('Drd', null); }
        else if (!p.tokens.has('Clr')) p.tokens.set('Clr', null);
        continue;
      }
      if (chosen === 'Saint') {
        if (!p.tokens.has('Clr')) p.tokens.set('Clr', map.advisory);
        continue;
      }
      if (chosen === 'Psion') {
        for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, null);
        const disc = c && c.psionDiscipline;
        if (disc && map.disciplineTokens.includes(disc)) {
          if (!p.tokens.has(disc)) p.tokens.set(disc, null);
        } else {
          for (const t of map.disciplineTokens) if (!p.tokens.has(t)) p.tokens.set(t, 'discipline power — requires the matching Psion discipline (GM confirm)');
        }
        continue;
      }
      for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, map.advisory || null);
      if (map.psionicOnly) {
        p._psionicOnlyTokens = p._psionicOnlyTokens || new Set();
        for (const t of map.tokens) p._psionicOnlyTokens.add(t);
      }
      // Lets a Heritage-granted Sor/Wiz route (Sorcerer/Bard pick) lift a real
      // specialist Wizard's school hard-block, same as a Sorcerer class would.
      if (map.pool === 'arcane' && map.tokens.includes('Sor/Wiz')) arcaneContribs.push(chosen);
    }
  }
  // v8.5.4: specialist Wizard prohibited schools — hard-block only when no
  // OTHER class also reaches the Sor/Wiz token (a Wizard/Sorcerer multiclass
  // still reaches a prohibited school through the Sorcerer side).
  if (pools.arcane && c && (c.wizardProhibited || []).length
      && arcaneContribs.includes('Wizard')
      && !arcaneContribs.some(n => n !== 'Wizard')) {
    pools.arcane._wizProhibited = new Set(c.wizardProhibited);
  }
  // v8.5.4: Expanded Knowledge feat picks — the HH-sanctioned bypass for
  // discipline gating. Each instance's param names a specific power.
  if (pools.psionic && c) {
    const names = ((c.feats || []).filter(f => (f.name || f.n) === 'Expanded Knowledge' && f.param).map(f => f.param));
    if (names.length) pools.psionic._expandedNames = new Set(names);
  }
  return pools;
}

// For one SPELLS_DB entry: every (pool, token, level) route this character
// could take it through, gated later against maxPowerLvl at add time.
function spellPoolOptions(spell, poolsInfo) {
  const opts = [];
  for (const pool in poolsInfo) {
    const pi = poolsInfo[pool];
    for (const l of (spell.levels || [])) {
      if (!pi.tokens.has(l.cls)) continue;
      // v8.5.4: 'War' disambiguation — psionic-pool 'War' (Warmind) routes
      // require a psionic power; divine-pool 'War' (the War domain) routes
      // require a magic spell.
      if (l.cls === 'War') {
        const psionic = isPsionicSpell(spell);
        if (pool === 'psionic' && !psionic) continue;
        if (pool === 'divine' && psionic) continue;
      }
      // v8.5.4: specialist Wizard prohibited schools — no route at all (HH:
      // "can't even cast such spells from scrolls").
      if (pool === 'arcane' && pi._wizProhibited && l.cls === 'Sor/Wiz'
          && pi._wizProhibited.has(spellSchool(spell))) continue;
      const advisory = pi.tokens.get(l.cls);
      opts.push({ pool, token: l.cls, lvl: l.lvl, lvl_max: l.lvl_max, applies: l.applies, advisory, overMax: l.lvl > pi.maxPowerLvl });
    }
  }
  // v8.5.4: a configured Saint may take any Cleric-list spell as a Personal
  // Domain pick (HH: "may add one spell of their choice … from the Cleric
  // spell list", GM-approved, permanent). Surfaced only when no domain route
  // already reaches the spell; budget enforced at add time.
  if (poolsInfo.divine && poolsInfo.divine._saintConfigured) {
    const clr = (spell.levels || []).find(l => l.cls === 'Clr');
    if (clr && !opts.some(o => o.pool === 'divine')) {
      opts.push({ pool: 'divine', token: 'Clr', lvl: clr.lvl, lvl_max: clr.lvl_max, applies: clr.applies,
                  advisory: null, personal: true, overMax: clr.lvl > poolsInfo.divine.maxPowerLvl });
    }
  }
  // v8.5.4: Expanded Knowledge — a named-power pick reaches the psionic pool
  // even when discipline gating (or list membership) excludes it. Route level
  // = the spell's lowest listed level.
  if (poolsInfo.psionic && poolsInfo.psionic._expandedNames
      && poolsInfo.psionic._expandedNames.has(spell.name)
      && !opts.some(o => o.pool === 'psionic')) {
    const lvls = (spell.levels || []).map(l => l.lvl).filter(n => typeof n === 'number');
    const lvl = lvls.length ? Math.min(...lvls) : 1;
    opts.push({ pool: 'psionic', token: 'Expanded Knowledge', lvl, advisory: null, overMax: lvl > poolsInfo.psionic.maxPowerLvl });
  }
  return opts;
}

// v8.13.0 (Adam's Rhad report): Expanded Knowledge is "ADD to your powers
// known" (HH p.215) — the pick lands in the repertoire automatically as a
// BONUS known power, 1:1 with the feat instances. Reconciler pattern (like
// reconcileGrantedFeats): adds missing grants, removes orphans when the feat
// (or its param) goes away, leaves player-learned copies alone. Also
// self-heals free-text-era params by canonicalizing case-insensitively
// against SPELLS_DB (the picker was a text line before v8.13.0).
function reconcileExpandedKnowledgePowers(c) {
  if (!c) return false;
  let changed = false;
  const want = new Map();  // canonical name → spell
  for (const f of (c.feats || [])) {
    if ((f.name || f.n) !== 'Expanded Knowledge' || !f.param) continue;
    let sp = SPELLS_DB.find(s => s.name === f.param);
    if (!sp) {
      const low = String(f.param).trim().toLowerCase();
      sp = SPELLS_DB.find(s => s.name.toLowerCase() === low);
      if (sp) { f.param = sp.name; changed = true; }  // canonicalize the old free-text param
    }
    if (sp) want.set(sp.name, sp);
  }
  if (!c.powers) c.powers = [];
  for (const [nm, sp] of want) {
    if (!c.powers.some(p => p.pool === 'psionic' && p.name === nm)) {
      const ls = (sp.levels || []).map(l => l.lvl).filter(n => typeof n === 'number');
      c.powers.push({ name: nm, pool: 'psionic', token: 'Expanded Knowledge', lvl: ls.length ? Math.min(...ls) : 1,
                      via: 'Expanded Knowledge', grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } });
      changed = true;
    }
  }
  const before = c.powers.length;
  c.powers = c.powers.filter(p => !(p.via === 'Expanded Knowledge' && !want.has(p.name)));
  if (c.powers.length !== before) changed = true;
  return changed;
}

function getPowersBudget(c) {
  const pools = getCasterPoolsInfo(c);
  const out = {};
  for (const pool in pools) {
    // v8.13.0: Expanded Knowledge grants are BONUS powers known — they never
    // consume the class's powers-known budget.
    const picked = getCharPowers(c).filter(p => p.pool === pool && p.via !== 'Expanded Knowledge').length;
    // v8.33.0 (Heinrix's Sorcerer): the known cap = psionic powersKnown PLUS
    // spontaneous-caster spells known (Sorcerer/Bard matrices) — the latter
    // was never counted, so arcane pools read "no limit". Prepared casters
    // (Wizard/Cleric/Ranger) contribute no matrix and correctly stay
    // unlimited; Saints know all their domains' spells — also no cap.
    const knownCap = (pools[pool].powersKnownTotal || 0) + (pools[pool].spellsKnownTotal || 0);
    const total = knownCap > 0 ? knownCap : null; // null = no limit
    out[pool] = { picked, total, maxPowerLvl: pools[pool].maxPowerLvl, classes: pools[pool].classes,
                  knownByLvl: pools[pool].spellsKnownByLvl || [] };
  }
  return out;
}
const _pwModePools = () => _pwMode === 'spells' ? ['arcane', 'divine'] : ['psionic', 'super'];
// Context label parts, alphabetical like the Scales themselves (Adam's
// ruling): "Arcane / Divine Spells", "Psionic / Super Powers".
function _pwSideLabel(c, mode) {
  const parts = [];
  try {
    const pi = getCasterPoolsInfo(c);
    if (mode === 'spells') {
      if (pi.arcane) parts.push('Arcane');
      if (pi.divine) parts.push('Divine');
    } else {
      if (pi.psionic) parts.push('Psionic');
      if (getMPState(c).isSuperMutant) parts.push('Super');
    }
  } catch (e) {}
  const noun = mode === 'spells' ? 'Spells' : 'Powers';
  return parts.length ? parts.join(' / ') + ' ' + noun : noun;
}

// v8.34.0 (Adam): how many known picks the character holds at each spell
// level in a pool — Gate 2.5's counterpart to the matrix split. Records store
// their route level since v8.5.4 (rec.lvl); older records fall back to the
// entry's lowest printed level. Expanded Knowledge grants are bonus knowns
// and never count against the split.
function knownPickedByLevel(c, pool) {
  const out = [];
  for (const p of getCharPowers(c)) {
    if (p.pool !== pool || p.via === 'Expanded Knowledge') continue;
    let lvl = (typeof p.lvl === 'number') ? p.lvl : null;
    if (lvl === null) {
      const s = SPELLS_DB.find(x => x.name === p.name);
      const ls = s ? (s.levels || []).map(l => l.lvl).filter(n => typeof n === 'number') : [];
      lvl = ls.length ? Math.min(...ls) : 0;
    }
    out[lvl] = (out[lvl] || 0) + 1;
  }
  return out;
}

function logPowerException(c, name, why) {
  if (!c.gmExceptions) c.gmExceptions = [];
  const target = `Power/Spell: ${name}`;
  if (!c.gmExceptions.find(e => e.target === target)) {
    c.gmExceptions.push({ type: 'power', target, missing: [why], grantedAt: new Date().toLocaleDateString() });
  }
}

// ============================================================================
// v8.21.0 SEGMENT A — PSIONIC FOCUS (Adam's augmentation project, 2026-09-04).
// Two focus mechanics, per the HH's own synthesis:
//   • PSIONIC focus (HH p.354 "Gain Psionic Focus" + Concentration skill):
//     a full-round action (move action with Psionic Meditation, HH p.237) to
//     gain, then HELD as a persistent state until expended. Power feats,
//     Power Penetration, Slippery Mind, Monk ki features, Still Mind and
//     Speed of Thought all key off it.
//   • SUPER focus (HH p.354 "Gain Super-Power Focus"): a move action that
//     lasts only until the very next action, which must be the manifestation
//     it modifies — otherwise wasted. NEVER stored: it is a cast-time
//     declaration, not a state (which is also why Opportunity Power's
//     immediate-action trick is closed to mutants, HH p.234 Special).
// Only the psionic kind is persistent, so only it gets character state:
// c.psiFocused (boolean). The Second Skin LOCKS the focus while manifested
// (HH p.241) — neither gain nor expend until it drops.
function isPsiFocusCapable(c) {
  if (!c) return false;
  const cs = computeCasterStats(c);
  if (cs.psionic && cs.psionic.contributors.length) return true;
  if (migrateLegacyClasses(c).some(e => e.name === 'Monk' && (e.level || 0) >= 3)) return true; // Still Mind et al.
  const powerFeats = new Set((c.feats || []).map(f => f.name).filter(n => (getFeatData(n) || {}).family === 'Power'));
  return powerFeats.size > 0;
}
function psiFocusLocked(c) {
  const sk = activeSecondSkin(c);
  return !!(sk && !sk.destroyed);
}
function poolSpontaneity(c, poolName) {
  if (poolName !== 'arcane' && poolName !== 'divine') return { any: false, all: false };
  const ctrs = ((computeCasterStats(c)[poolName] || {}).contributors || []).filter(x => !x._isAdvancer && !x._fromHeritage);
  const sp = ctrs.filter(x => SPONTANEOUS_CASTERS.has(x.class));
  return { any: sp.length > 0, all: ctrs.length > 0 && sp.length === ctrs.length };
}
// Parse the standard augment grammar out of an entry's Augment text.
function parseAugmentSpec(spell) {
  const d = spell.d || '';
  const at = d.indexOf('Augment:');
  if (at < 0) return null;
  const text = d.slice(at + 8).trim();
  const spec = { text, step: null, dice: null, diceLabel: null, dcEveryDice: null, dcEveryStep: false, prNote: /manifester level increases by 1 for the purpose/i.test(text) };
  const st = text.match(/For every (?:(\d+) )?additional power points? you spend/i);
  if (st) spec.step = parseInt(st[1] || '1', 10);
  const dm = text.match(/damage increases by (\d+)d(\d+)/i);
  const hm = text.match(/heals? (?:an )?additional (\d+)d(\d+)/i);
  // v8.44.0 (Cut 3, Adam's Energy Current probe): the Energy family spells
  // its step as "increases by one die (d6)" — invisible to the NdX grammar,
  // so ALL ten single-option Energy powers cast with un-computed dice.
  const dm2 = text.match(/increases by one die \(d?(\d+)\)/i);
  if (dm) { spec.dice = { n: parseInt(dm[1], 10), d: parseInt(dm[2], 10) }; spec.diceLabel = 'damage'; }
  else if (hm) { spec.dice = { n: parseInt(hm[1], 10), d: parseInt(hm[2], 10) }; spec.diceLabel = 'healing'; }
  else if (dm2) { spec.dice = { n: 1, d: parseInt(dm2[1], 10) }; spec.diceLabel = 'damage'; }
  const dcd = text.match(/For each extra (\d+)d\d+ points? of damage, this power[’']s save DC increases by 1/i);
  // v8.44.0: the word-form sibling ("For each extra two dice of damage…").
  const dcd2 = text.match(/For each extra (one|two|three|four|\d+) dice of damage, this power[’']s save DC increases by 1/i);
  const WORD_N = { one: 1, two: 2, three: 3, four: 4 };
  if (dcd) spec.dcEveryDice = parseInt(dcd[1], 10);
  else if (dcd2) spec.dcEveryDice = WORD_N[dcd2[1].toLowerCase()] || parseInt(dcd2[1], 10);
  else if (spec.step && /save DC increases by 1/i.test(text)) spec.dcEveryStep = true;
  return spec;
}
function rollNd8(n) { let t = 0, rolls = []; for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * 8); rolls.push(r); t += r; } return { total: t, rolls }; }
function _powerThemeSets() {
  if (_pwThemeSets) return _pwThemeSets;
  _pwThemeSets = {};
  const vn = VARIANT_NAMES;
  for (const th in POWER_THEMES) {
    const s = new Set();
    for (const n of POWER_THEMES[th]) { s.add(n); if (vn[n] && vn[n].parent) s.add(vn[n].parent); }
    _pwThemeSets[th] = s;
  }
  return _pwThemeSets;
}
// Reverse lookup for the expanded browse rows: which suites claim this power?
function _themesOfPower(name) {
  const sets = _powerThemeSets(), out = [];
  for (const th in sets) if (sets[th].has(name)) out.push(th);
  return out;
}
