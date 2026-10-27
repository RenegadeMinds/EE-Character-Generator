// =============================================================================
// js/rules/classes.js
// CLASSES — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Class lookups, class prerequisites, per-level class statistics
//   and Scale-0 variants.
//
// KEY NAMES (so you can search for them)
//   functions (13): getClassData, checkClassPrereqsFromArray,
//   checkClassPrereqs, checkAdvancedPrereqs, classStatAt, chaModClamped,
//   computeStatsFromClasses, getClassEntry, scale0VariantBudget,
//   scale0EligibleSkills, buildScale0VariantBonuses, tierMaxLevel,
//   migrateLegacyClasses
//
// WHERE IT CAME FROM
//   Gathered from js/app/45-create-class-list.js, js/app/47-save-
//   character.js, js/rules/07-prestige-classes.js, js/rules/19-bonus-
//   aggregator-and-stat-block.js, js/rules/22-career-compass.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Look up a class by name across all four tiers
function getClassData(name) {
  return HERO_CLASSES[name] || ORDINARY_CLASSES[name] || BASIC_CLASSES[name] || ADVANCED_CLASSES[name] || PRESTIGE_CLASSES[name] || MONSTROUS_CLASSES[name] || null;
}
// Check whether a character meets the prerequisites for a given Advanced or Prestige class.
// Returns {met: bool, missing: [string]} listing each unmet requirement-group.
// `existingClasses` is an array of {tier, name, level} entries representing classes already taken.
// `charCtx` is an optional object {attrs, allegiance, align} for attribute / allegiance checks.
// `sixLevels` is an object like {arcane:5, divine:5, heroic:1, mutation:0, psionic:0, tech:5}.
//
// v8.3.23: Function now handles Hero and Basic class lookups too (previously
// limited to Advanced/Prestige). The Hero/Basic attribute prerequisite — Hero
// classes need 13 in their key attribute, certain Basic classes (Cleric,
// Paladin, Saint, Psion, Wizard, Sorcerer, Wilder) need 10 — comes from
// data-table `attrMin` and `attr` fields. The `attr` field may be a single
// code like 'STR' or slash-separated alternatives like 'INT/CHA' (Aristocrat
// has Int/Cha as joint key attributes; for the *prereq* check we use OR
// semantics — meet either is sufficient).
function checkClassPrereqsFromArray(className, existingClasses, charSkills, charFeats, sixLevels, charCtx) {
  // v8.3.23: look across all four tiers; Hero/Basic may carry `attrMin`.
  const cls = HERO_CLASSES[className] || BASIC_CLASSES[className] || ADVANCED_CLASSES[className] || PRESTIGE_CLASSES[className];
  if (!cls) return {met:true, missing:[], report:[]};
  const missing = [];
  // v8.39.0 (Career Compass): alongside the flat `missing` strings, collect a
  // STRUCTURED report — one entry per prereq group, each option carrying its
  // desc, verdict, and the raw opt object. The Compass renders from this so
  // its checklist can never disagree with the add-class/level-up gates: same
  // function, same evaluation, one source of truth.
  const report = [];
  const stats = computeStatsFromClasses(existingClasses || []);
  charSkills = charSkills || {};
  charFeats = (charFeats || []).map(f => typeof f === 'string' ? f : (f.name || f.n));  // v8.5.4: robust to {name}-form records
  // v8.6.1: class-entry proficiency grants count toward feat prereqs (a
  // Fighter candidate for Soldier HAS Martial Weapon Proficiency — it came
  // with the class, not as a c.feats record). Derived, never stored.
  charFeats = charFeats.concat(proficiencyPseudoFeats(charProficiencyGrants((charCtx || {}).char || null, existingClasses)));
  sixLevels = sixLevels || {arcane:0, divine:0, heroic:0, mutation:0, psionic:0, tech:0};
  charCtx = charCtx || {};
  const attrs = charCtx.attrs || [10,10,10,10,10,10];
  const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  // v8.3.24: attrMin check up front. The class declares `attrMin` (the
  // numeric threshold) and `attrMinKey` (the single attribute code STR/DEX/
  // CON/INT/WIS/CHA the check targets). attrMinKey is the canonical prereq
  // target; the legacy `attr` field still serves as build-guidance (and may
  // be slash-separated like "INT/CHA" for joint-key class flavor) but is not
  // mechanically consulted for the prereq. For back-compat with any class
  // entries that lack attrMinKey, we fall back to `attr` and use the FIRST
  // token (in case it was a slash-separated string).
  if (typeof cls.attrMin === 'number') {
    const code = cls.attrMinKey || (cls.attr ? cls.attr.split('/')[0].trim() : null);
    if (code) {
      const idx = ATTR_IDX[code];
      if (idx !== undefined) {
        const attrOk = (attrs[idx] || 0) >= cls.attrMin;
        // v8.39.0: attrMin enters the report as a synthetic one-option group.
        report.push({met: attrOk, options: [{desc: `${code} ${cls.attrMin}+`, met: attrOk,
          opt: {type: 'attr', name: code, min: cls.attrMin}}]});
        if (!attrOk) missing.push(`${code} ${cls.attrMin}+`);
      }
    }
  }
  // If the class has no structured `prereqs` array (most Hero/Basic), the
  // attrMin check above is the only thing to evaluate. Return early.
  if (!cls.prereqs) {
    return {met: missing.length === 0, missing, report};
  }
  const hasClassAbility = (abilityName) => {
    const grants = CLASS_ABILITIES[abilityName];
    if (!grants) return false;
    return grants.some(g => (existingClasses||[]).some(e =>
      e.tier === g.tier && e.name === g.name && (e.level||0) >= g.minLvl));
  };
  const tierLevels = (tier) => (existingClasses||[]).reduce((s,e) => s + (e.tier===tier ? (e.level||0) : 0), 0);
  // v8.5.4 EAL sweep, class layer: helpers for the structured power-access /
  // repertoire / feat-detail checks that replaced the old GM-verify notes.
  // Pool power access derives from the classes+feat-names already passed in;
  // repertoire, feat-param, and MP checks need the saved character
  // (charCtx.char — threaded at the saved-character call sites). During
  // creation-form checks char is absent and those evaluate unmet, which is
  // honest: a fresh character has no repertoire, and Advanced/Prestige entry
  // happens at level-up anyway.
  const _fullChar = charCtx.char || null;
  let _psCache = null;
  const poolStats = () => _psCache || (_psCache = computeCasterStats({
    classes: existingClasses || [],
    feats: charFeats,
    totalLvl: (existingClasses || []).reduce((s, e) => s + (e.level || 0), 0),
  }));
  // Super-manifester "power access": the mutant tier's spell-level cap
  // (Minor 3 / Moderate 5 / Major 9, MUTATION_RULES).
  const superAccessLvl = () => {
    if (!_fullChar) return 0;
    const st = getMPState(_fullChar);
    return (st.isSuperMutant && st.tier && st.tier.spell_levels) ? st.tier.spell_levels[1] : 0;
  };
  const charPowers = () => ((_fullChar && _fullChar.powers) || []);
  const charFeatObjs = () => ((_fullChar && _fullChar.feats) || []).filter(f => typeof f === 'object');
  for (const group of cls.prereqs) {
    let groupMet = false;
    const groupDescs = [];
    const groupOpts = [];  // v8.39.0: per-option report rows
    for (const opt of group) {
      let optDesc = '';
      let optMet = false;
      if (opt.type === 'bab') {
        optDesc = `Base Attack +${opt.min}`;
        optMet = stats.bab >= opt.min;
      } else if (opt.type === 'def') {
        optDesc = `Defense Bonus +${opt.min}`;
        optMet = stats.def >= opt.min;
      } else if (opt.type === 'skill') {
        optDesc = `${opt.name} ${opt.min} ranks`;
        optMet = (charSkills[opt.name] || 0) >= opt.min;
      } else if (opt.type === 'skillFamily') {
        optDesc = `${opt.family} (any) ${opt.min} ranks`;
        optMet = SKILLS.some(sk => sk.family === opt.family && (charSkills[sk.n] || 0) >= opt.min);
      } else if (opt.type === 'feat') {
        optDesc = opt.desc || `feat: ${opt.name}`;  // v8.71.0: honor authored desc (book restrictions the check can't enforce)
        optMet = charFeats.some(fn => fn.toLowerCase().startsWith(opt.name.toLowerCase()));
      } else if (opt.type === 'attr') {
        optDesc = `${opt.name} ${opt.min}+`;
        const idx = ATTR_IDX[opt.name];
        optMet = idx !== undefined && (attrs[idx]||0) >= opt.min;
      } else if (opt.type === 'attrAny') {
        optDesc = `any one attribute ${opt.min}+`;
        optMet = attrs.some(a => (a||0) >= opt.min);
      } else if (opt.type === 'classAbility') {
        optDesc = `class ability: ${opt.name}`;
        optMet = hasClassAbility(opt.name);
        // v8.71.0 (Survivor's "Evasion talent / class ability"): Evasion's
        // real granting map is the unified evasionTier (class features +
        // the Rogue SA pick + Fast Hero talents, v8.64.0) — CLASS_ABILITIES
        // never listed it. Consult the unified source when a saved
        // character threads through.
        if (!optMet && opt.name === 'Evasion' && _fullChar) {
          optMet = !!evasionTier(_fullChar);
        }
      } else if (opt.type === 'tierLevel') {
        const tierLabel = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[opt.tier]||opt.tier;
        optDesc = `${opt.min}+ level${opt.min===1?'':'s'} in any ${tierLabel} class`;
        optMet = tierLevels(opt.tier) >= opt.min;
      } else if (opt.type === 'allegiance') {
        // v8.3.34: LOOSE semantics — accepts a match on EITHER allegiance OR
        // alignment field, because alignment ESTABLISHES allegiance on its
        // non-neutral axes (a Lawful Neutral character HAS an Allegiance to
        // Law as a structural consequence of their alignment). See the
        // detailed comment in checkFeatPrereqs for the full rule and the
        // alignment-vs-allegiance asymmetry.
        const cmp = (charCtx.allegiance||'') + ' / ' + (charCtx.align||'');
        const has = cmp.toLowerCase().includes(opt.value.toLowerCase());
        if (opt.polarity === 'lacks') {
          optDesc = `no allegiance to ${opt.value}`;
          optMet = !has;
        } else {
          optDesc = `allegiance to ${opt.value}`;
          optMet = has;
        }
      } else if (opt.type === 'alignment') {
        // v8.3.34: STRICT semantics — checks the alignment field ONLY.
        // Allegiance does NOT establish alignment (a character with
        // Allegiance to Good can be Lawful/Chaotic/True Neutral aligned).
        // Use this when the handbook says "X alignment" (Chaotic Mind's
        // "Chaotic alignment"); use `allegiance` when the handbook says
        // "X allegiance" (Assassin's "Evil allegiance"). The asymmetry is
        // load-bearing — see the full comment block in checkFeatPrereqs.
        const cmp = (charCtx.align||'').toLowerCase();
        const has = cmp.includes(opt.value.toLowerCase());
        if (opt.polarity === 'lacks') {
          optDesc = `no ${opt.value} alignment`;
          optMet = !has;
        } else {
          optDesc = `${opt.value} alignment`;
          optMet = has;
        }
      } else if (opt.type === 'sixLevel') {
        optDesc = `${SIX_LEVELS[opt.axis]?.short || opt.axis} ${opt.min}+ scenario`;
        optMet = (sixLevels[opt.axis] || 0) >= opt.min;
      } else if (opt.type === 'sixLevelAny') {
        const labels = opt.axes.map(a => `${SIX_LEVELS[a]?.short || a} ${opt.min}+`);
        optDesc = labels.join(' or ') + ' scenario';
        optMet = opt.axes.some(a => (sixLevels[a] || 0) >= opt.min);
      } else if (opt.type === 'sixLevelOr') {
        const labels = opt.options.map(o => `${SIX_LEVELS[o.axis]?.short || o.axis} ${o.min}+`);
        optDesc = labels.join(' or ') + ' scenario';
        optMet = opt.options.some(o => (sixLevels[o.axis] || 0) >= o.min);
      } else if (opt.type === 'talent') {
        // v8.71.0 (Adam's Hellfire/Compass report — "FEAT: Savant"): this
        // was a never-satisfiable GM-verify stub, and six classes dodged it
        // by mistyping their talent prereqs as feats (equally unsatisfiable
        // — c.feats never contains a talent). Now a real check against the
        // saved record's talents: by name (+ exact param / paramPrefixes
        // when given), by name prefix (the Damage Reduction 1/-..3/-
        // ladder), by tree, or by hero class ("any Tough Hero talent").
        // Degrades to GM-verify when no character threads through ctx.char
        // (the creation form — talents can't exist there anyway).
        const tl = _fullChar ? (_fullChar.talents || []) : null;
        const tdOf = (nm) => TALENTS_DB.find(x => x.n === nm);
        let tMatch = () => false;
        if (opt.name || opt.namePrefix) {
          optDesc = opt.desc || `${opt.name || opt.namePrefix}${opt.param ? ` (${opt.param})` : ''} talent`;
          tMatch = (t) => (opt.name ? t.name === opt.name : (t.name || '').startsWith(opt.namePrefix))
            && (!opt.param || t.param === opt.param)
            && (!opt.paramPrefixes || opt.paramPrefixes.some(p => (t.param || '').startsWith(p)));
        } else if (opt.heroClass) {
          optDesc = opt.desc || `any ${opt.heroClass} talent`;
          tMatch = (t) => { const td = tdOf(t.name); return !!(td && td.hero_class === opt.heroClass); };
        } else if (opt.tree) {
          optDesc = opt.desc || `a talent from the ${opt.tree} tree`;
          tMatch = (t) => { const td = tdOf(t.name); return !!(td && td.tree && (td.tree === opt.tree || td.tree.startsWith(opt.tree + ' '))); };
        }
        if (tl) { optMet = tl.some(tMatch); }
        else { optDesc += ' (GM-verify)'; optMet = false; }
      } else if (opt.type === 'powerAccess') {
        // "Able to cast/manifest Nth-level spells/powers" — met when a listed
        // pool's max castable power level (derived from EAL/EDL/EPL; super
        // via the mutant tier cap) reaches opt.lvl. pools: array or 'any'.
        const pools = opt.pools === 'any' ? ['arcane', 'divine', 'psionic', 'super'] : opt.pools;
        optDesc = opt.desc || `able to cast/manifest ${opt.lvl}th-level ${pools.join('/')} spells/powers`;
        optMet = pools.some(p => p === 'super'
          ? superAccessLvl() >= opt.lvl
          : ((poolStats()[p] || {}).maxPowerLvl || 0) >= opt.lvl);
      } else if (opt.type === 'knowsPower') {
        // Named spell/power in the character's repertoire (variant display
        // names resolve to their parent entry).
        optDesc = opt.desc || `knows ${opt.name}`;
        const vn = (VARIANT_NAMES[opt.name]);
        optMet = charPowers().some(p => p.name === opt.name || p.applies === opt.name || (vn && p.name === vn.parent));
      } else if (opt.type === 'powerRepertoire') {
        // Repertoire-shape check: {count?, minLvl?, schools? (school_raw
        // prefixes), distinctSchools?, pool?} against known spells/powers.
        // v8.94.1 (the Tower probe's conviction): dual-listed entries print
        // "Metacreativity / Conjuration (Creation)" — the first-token parse
        // counted the PSIONIC DISCIPLINE as a fifth arcane school. The
        // school is read pool-aware now (schoolForPool).
        const lvlOf = (s) => (s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : 0;
        let recs = charPowers()
          .filter(p => !opt.pool || p.pool === opt.pool)
          .map(p => SPELLS_DB.find(x => x.name === p.name)).filter(Boolean);
        if (opt.minLvl) recs = recs.filter(s => lvlOf(s) >= opt.minLvl);
        if (opt.schools) recs = recs.filter(s => opt.schools.some(sc => (s.school_raw || '').startsWith(sc) || schoolForPool(s.school_raw, opt.pool) === sc));
        optDesc = opt.desc || 'repertoire requirement';
        if (opt.distinctSchools) {
          optMet = new Set(recs.map(s => schoolForPool(s.school_raw, opt.pool))).size >= opt.distinctSchools;
        } else {
          optMet = new Set(recs.map(s => s.name)).size >= (opt.count || 1);
        }
      } else if (opt.type === 'featCount') {
        // N or more owned feats from the listed families.
        const n = charFeats.filter(fn => { const fd = getFeatData(fn); return fd && opt.families.includes(fd.family); }).length;
        optDesc = opt.desc || `${opt.min}+ ${opt.families.join(' or ')} feat${opt.min === 1 ? '' : 's'}`;
        optMet = n >= opt.min;
      } else if (opt.type === 'featParamIs') {
        // Named feat taken with a specific parameter (exact or prefix match).
        // Falls back to name-only ownership when no saved character is in
        // context (creation-form checks can't see params).
        optDesc = opt.desc || `${opt.name} (${opt.param || opt.paramPrefix})`;
        const objs = charFeatObjs().filter(f => (f.name || f.n) === opt.name);
        optMet = _fullChar
          ? objs.some(f => opt.param ? f.param === opt.param : ((f.param || '').startsWith(opt.paramPrefix || '')))
          : charFeats.includes(opt.name);
      } else if (opt.type === 'featParamCount') {
        // Named feat taken with at least N DIFFERENT parameters.
        const params = new Set(charFeatObjs().filter(f => (f.name || f.n) === opt.name && f.param).map(f => f.param));
        optDesc = opt.desc || `${opt.name} in ${opt.min} different choices`;
        optMet = params.size >= opt.min;
      } else if (opt.type === 'skillFamilyCount') {
        // At least `count` skills of the family at `min`+ ranks each.
        const n = SKILLS.filter(sk => sk.family === opt.family && (charSkills[sk.n] || 0) >= opt.min).length;
        optDesc = opt.desc || `${opt.count} ${opt.family} skills at ${opt.min}+ ranks each`;
        optMet = n >= opt.count;
      } else if (opt.type === 'mpTotal') {
        optDesc = opt.desc || `${opt.min}+ Mutation Points`;
        optMet = !!_fullChar && getMPState(_fullChar).totalEarned >= opt.min;
      } else if (opt.type === 'classLevel') {
        // Mirrors the feat engine's handler (needed class-side since v8.5.4
        // for Crusader's spontaneous-Domain check).
        optDesc = `${opt.name || opt.tier} Lvl ${opt.min}+`;
        optMet = (existingClasses || []).some(e =>
          (!opt.tier || e.tier === opt.tier) &&
          (!opt.name || e.name === opt.name) &&
          (e.level || 0) >= (opt.min || 1));
      } else if (opt.type === 'note') {
        optDesc = opt.text + ' (GM-verify)';
        optMet = false;
      }
      groupDescs.push(optDesc);
      groupOpts.push({desc: optDesc, met: optMet, opt});
      // v8.39.0: no early break — ALL options are evaluated so the Compass
      // report shows every alternative's standing (met groups previously
      // short-circuited; `missing` semantics are unchanged, since it was only
      // ever built from groups where NO option met — those never broke early).
      if (optMet) groupMet = true;
    }
    report.push({met: groupMet, options: groupOpts});
    if (!groupMet) missing.push(groupDescs.join(' OR '));
  }
  return {met: missing.length === 0, missing, report};
}
// Legacy wrapper — translates the old (className, hc, hl, bc, bl, ac, al, charSkills, charFeats, sixLevels)
// signature into a class array and delegates.
// Backwards-compat alias used by older code paths
function checkClassPrereqs(className, heroClass, heroLvl, basicClass, basicLvl, advClass, advLvl, charSkills, charFeats, sixLevels) {
  const arr = [];
  if (heroClass && heroLvl > 0) arr.push({tier:'hero', name:heroClass, level:heroLvl});
  if (basicClass && basicLvl > 0) arr.push({tier:'basic', name:basicClass, level:basicLvl});
  if (advClass && advLvl > 0) arr.push({tier:'advanced', name:advClass, level:advLvl});
  return checkClassPrereqsFromArray(className, arr, charSkills, charFeats, sixLevels);
}
function checkAdvancedPrereqs(advName, heroClass, heroLvl, basicClass, basicLvl, charSkills, charFeats, sixLevels) {
  return checkClassPrereqs(advName, heroClass, heroLvl, basicClass, basicLvl, '', 0, charSkills, charFeats, sixLevels);
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

// Resolve a class entry {tier, name} to its data table row (HD, sp, progression arrays, etc.)
function getClassEntry(e) {
  if (!e || !e.name) return null;
  if (e.tier === 'hero') return HERO_CLASSES[e.name];
  if (e.tier === 'ordinary') return ORDINARY_CLASSES[e.name];
  if (e.tier === 'basic') return BASIC_CLASSES[e.name];
  if (e.tier === 'advanced') return ADVANCED_CLASSES[e.name];
  if (e.tier === 'prestige') return PRESTIGE_CLASSES[e.name];
  if (e.tier === 'monstrous') return MONSTROUS_CLASSES[e.name]; // v9.15.0 §273
  // Best-effort fallback when tier is missing — try each table
  return getClassData(e.name);
}
function scale0VariantBudget(className, classLevel) {
  const v = SCALE0_VARIANTS[className];
  return v ? v.milestones.filter(m => m <= (classLevel || 0)).length : 0;
}
// Eligible pick targets: the variant attribute's skills on the class's own
// skill list (family "(Any)" entries cover their sub-skills).
function scale0EligibleSkills(className) {
  const v = SCALE0_VARIANTS[className];
  if (!v) return [];
  const list = CLASS_SKILLS[className] || [];
  const names = SKILLS.filter(sk => sk.k === v.attrKey &&
    (list.includes(sk.n) || list.some(s => s === sk.n.split(' (')[0] + ' (Any)'))).map(sk => sk.n);
  // Profession (X) sub-skills are RAW-eligible but flood the dropdown via the
  // "(Any)" family — list the named skills first, Professions after.
  return [...names.filter(n => !n.startsWith('Profession (')), ...names.filter(n => n.startsWith('Profession ('))];
}
// v8.5.4: Scale-0 variant picks → self-stacking competence skill bonuses.
// Consumed by computeSkillMiscBonuses alongside feat/occupation/talent
// contributions.
function buildScale0VariantBonuses(c) {
  const out = {};
  if (!c) return out;
  const six = c.sixLevels || {};
  for (const e of migrateLegacyClasses(c)) {
    const v = SCALE0_VARIANTS[e.name];
    if (!v || (six[v.axis] || 0) !== 0) continue;
    const picks = (c[v.field] || []).slice(0, scale0VariantBudget(e.name, e.level));
    picks.forEach((skill, i) => {
      if (!skill) return;
      const k = 'skill:' + skill;
      (out[k] = out[k] || []).push({
        type: 'competence', stacksAnyway: true,
        source: `${e.name}:${v.feature}:${i + 1}`,
        value: 1, condition: null,
        label: `${v.feature} (pick ${i + 1})`,
      });
    });
  }
  return out;
}
// Per-tier hard-cap level
function tierMaxLevel(e){
  if(e.tier==='hero')return 10;
  if(e.tier==='basic')return 20;
  if(e.tier==='advanced')return 10;
  if(e.tier==='prestige'){
    const cls=PRESTIGE_CLASSES[e.name];
    return cls?cls.maxLvl:10;
  }
  return 20;
}
// ========== SAVE CHARACTER ==========
// Migrate a legacy v3/v4/v5 character record (with heroClass/basicClass/advClass/presClass slots)
// into the new array model. Returns the {classes:[…]} array; non-destructive.
function migrateLegacyClasses(c){
  if(Array.isArray(c.classes) && c.classes.length>0)return c.classes;
  const arr=[];
  if(c.heroClass && (c.heroLvl||0)>0) arr.push({tier:'hero',name:c.heroClass,level:c.heroLvl,first:true});
  if(c.basicClass && (c.basicLvl||0)>0) arr.push({tier:'basic',name:c.basicClass,level:c.basicLvl,first:!arr.length});
  if(c.advClass && (c.advLvl||0)>0) arr.push({tier:'advanced',name:c.advClass,level:c.advLvl,first:!arr.length});
  if(c.presClass && (c.presLvl||0)>0) arr.push({tier:'prestige',name:c.presClass,level:c.presLvl,first:!arr.length});
  return arr;
}
