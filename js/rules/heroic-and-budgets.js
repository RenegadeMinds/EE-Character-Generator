// =============================================================================
// js/rules/heroic-and-budgets.js
// HEROIC AND BUDGETS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Action Points and Fate Points, heroic capabilities, feat and
//   talent budgets, and which tabs a character is entitled to.
//
// KEY NAMES (so you can search for them)
//   functions (14): getAPDice, characterHasAPClass,
//   effectiveHeroicLevelForAP, getHeroicCapabilities, computeResourceState,
//   getFeatBudget, featListComplianceOf, talentConsumesSlot,
//   getTalentBudget, characterIsEntitledToTalents,
//   characterIsEntitledToVehicles, characterIsEntitledToSpells,
//   characterIsEntitledToPowers, characterIsEntitledToMutations
//
// WHERE IT CAME FROM
//   Gathered from js/app/54-powers-repertoire.js, js/app/55-mutations-
//   engine.js, js/rules/20-scenario-titles-and-heroic-resources.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
function characterIsEntitledToVehicles(c) {
  if (!c) return false;
  // v8.14.x Segment B: the Second Skin feat parks its ectoplasmic exosuit in
  // the motor pool too.
  if (hasFeatNamed(c, 'Second Skin')) return true;
  return getCharItems(c).some(it =>
    it.catalogue === 'vehicle' || it.catalogue === 'mecha' || it.catalogue === 'starship'
    || (it.catalogue === 'armor' && (getCatalogueEntry('armor', it.ref) || {}).type === 'power'));
}


// v8.6.0 split (Adam): per-side entitlements. Spells = arcane/divine;
// Powers = psionic/super. Records already on the ledger always show their
// side's tab (legacy/GM-exception safety), matching the old unified rule.
function characterIsEntitledToSpells(c) {
  if (!c) return false;
  if (getCharPowers(c).some(p => p.pool === 'arcane' || p.pool === 'divine')) return true;
  const pi = getCasterPoolsInfo(c);
  return !!(pi.arcane || pi.divine);
}
function characterIsEntitledToPowers(c) {
  if (!c) return false;
  if (getCharPowers(c).some(p => p.pool === 'psionic' || p.pool === 'super')) return true;
  // v8.5.3: super-mutants browse/buy super-powers here even with no caster pool.
  if (hasFeatNamed(c, 'Supernatural Mutation')) return true;
  return !!getCasterPoolsInfo(c).psionic;
}

function characterIsEntitledToMutations(c) {
  if (!c) return false;
  if (getCharMutations(c).length || ((c.mpGrants || []).length) || hasFeatNamed(c, 'Supernatural Mutation') || hasFeatNamed(c, 'Slightly Different')) return true;
  if (Object.keys(UNSTABLE_MP).some(fn => hasFeatNamed(c, fn))) return true;
  return ((c.sixLevels && c.sixLevels.mutation) || 0) >= MUTATION_RULES.availability.mutation_scale_min;
}
