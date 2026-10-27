// =============================================================================
// js/rules/career-compass.js
// CAREER COMPASS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Career Compass: works backwards from a goal class to advise the
//   next level-up.
//
// KEY NAMES (so you can search for them)
//   functions (7): classPrereqCheckOf, _compassTierOf, _compassAnnotate,
//   careerCompassState, classSkillListHas, careerNextStep, _compassExp
//
// WHERE IT CAME FROM
//   Gathered from js/rules/22-career-compass.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v8.32.0 (Adam): which tabs hold an OUTSTANDING selection — unspent skill
// points, open talent/feat slots, an unassigned Hero's Gift, a feat missing
// its parameter (the ⬦ case), or unpicked spells/powers known. Returns
// {tabId: [note, ...]}. Every probe is guarded — a half-built record must
// never break nav rendering.
// ========================================================================
// CAREER COMPASS (v8.39.0) — "build your character in reverse".
// The player pledges a target class (c.careerGoal, Advanced/Prestige); the
// Sheet renders that class's prereq groups as a live checklist fed by
// checkClassPrereqsFromArray's structured `report` — the same evaluation
// the add-class and Level Up gates run, so the Compass can never disagree
// with the door it points at. On top of the checklist: best-case
// earliest-entry math and a GREEDY next-level class suggestion (one step,
// with reasons — never a whole script; quest-tracker, not auto-planner).
// Story/GM prereqs (notes, allegiances) render as ◈ GM-gate rows: always
// visible, never blocking the math, never pretended solvable.
// ========================================================================

// One canonical way to run the class-prereq check against a SAVED character
// (mirrors the Level Up dialog's call at lvlupOnNewClassName).
function classPrereqCheckOf(c, className) {
  const sl = c.sixLevels || {arcane:0, divine:0, heroic:c.heroicLevel||1, mutation:0, psionic:0, tech:5};
  const ctx = {attrs: c.attrs||[10,10,10,10,10,10], allegiance: c.allegiance||'', align: c.align||'', char: c};
  return checkClassPrereqsFromArray(
    className, c.classes||[], c.skills||{},
    (c.feats||[]).map(f => typeof f === 'string' ? f : (f.name || f.n)),
    sl, ctx);
}

function _compassTierOf(name) {
  if (ADVANCED_CLASSES[name]) return 'advanced';
  if (PRESTIGE_CLASSES[name]) return 'prestige';
  if (HERO_CLASSES[name]) return 'hero';
  if (BASIC_CLASSES[name]) return 'basic';
  if (ORDINARY_CLASSES[name]) return 'ordinary';
  if (MONSTROUS_CLASSES[name]) return 'monstrous'; // v9.15.0 §273
  return null;
}

// Best-case ENTRY-level bound for "when could a class gated by this option
// be taken", plus a progress string and an advice line. All bounds are BEST
// CASE (the label says so in the UI); GM/story/scenario gates return
// earliest:null.
// DOCTRINE (Adam's correction, 2026-09-26, v8.39.1): prerequisites must be
// met BEFORE the level-up — nothing gained WITH the new level (skill ranks,
// attribute bumps, feat picks) counts toward qualifying for that same level.
// Every bound below is therefore qualify-level + 1. The Hero 2 → advanced-
// entry-at-char-3 calibration needs no same-level counting: E&E max ranks =
// character level + 4 (HH "Skills"; the generator's rank inputs enforce the
// same lvl+4 cap), so a 2nd-level character legitimately holds 6 ranks
// before the level-up. (v8.39.0 shipped with d20M's lvl+3 cap PLUS a same-
// level-counting misread — the two errors cancelled on skill bounds but left
// attr-bump and feat-slot bounds one level too optimistic.)
function _compassAnnotate(c, o, totalLvl, stats) {
  const a = {desc: o.desc, met: o.met, opt: o.opt || {}, kind: 'build', prog: '', advice: '', earliest: null};
  const opt = a.opt, t = opt.type;
  const skills = c.skills || {};
  try {
    if (t === 'skill') {
      // N ranks reachable at level N−4 (class-skill max = level+4), met
      // BEFORE the level-up → entry at N−3.
      const now = skills[opt.name] || 0;
      a.prog = `${now}/${opt.min} ranks`;
      a.earliest = Math.max(2, opt.min - 3);
      const cs = isClassSkill(opt.name, c);
      a.advice = `max ranks = level+4, met before the level-up` + (cs ? '' : ` — cross-class for your current classes (half rate, half cap)`);
    } else if (t === 'skillFamily') {
      let best = 0;
      SKILLS.forEach(sk => { if (sk.family === opt.family) best = Math.max(best, skills[sk.n] || 0); });
      a.prog = `best ${best}/${opt.min} ranks`;
      a.earliest = Math.max(2, opt.min - 3);
    } else if (t === 'skillFamilyCount') {
      const n = SKILLS.filter(sk => sk.family === opt.family && (skills[sk.n] || 0) >= opt.min).length;
      a.prog = `${n}/${opt.count} skills at ${opt.min}+`;
      a.earliest = Math.max(2, opt.min - 3);
    } else if (t === 'attr' || t === 'attrAny') {
      // The bump lands WITH its level — it qualifies you for the NEXT one.
      const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
      const attrs = c.attrs || [10,10,10,10,10,10];
      const now = t === 'attr' ? (attrs[ATTR_IDX[opt.name]] || 0) : Math.max(...attrs);
      a.prog = `now ${now}`;
      const k = Math.max(0, opt.min - now);
      a.earliest = k === 0 ? totalLvl : (Math.floor(totalLvl / 4) + k) * 4 + 1;
      a.advice = 'attribute bump every 4th level (usable from the level after), or an enhancement item';
    } else if (t === 'bab') {
      // BAB accrues from prior levels; qualify-level + 1 like everything
      // else (see the doctrine block above).
      a.prog = `now +${stats.bab}`;
      a.earliest = totalLvl + Math.max(0, opt.min - stats.bab) + 1;
      a.advice = 'best case assumes full-BAB levels (+1/level)';
    } else if (t === 'def') {
      a.prog = `now +${stats.def}`;
      a.earliest = totalLvl + Math.max(0, opt.min - stats.def) + 1;
    } else if (t === 'feat' || t === 'featParamIs') {
      // A feat picked WITH a level qualifies you for the level AFTER it; an
      // open slot can be filled at the current level → entry next level-up.
      let slotOpen = false;
      try { slotOpen = getFeatBudget(c).remaining > 0; } catch (e) {}
      const slotLvl = slotOpen ? totalLvl : 3 * (Math.floor(totalLvl / 3) + 1);
      a.earliest = slotLvl + 1;
      a.advice = slotOpen ? 'you have an open feat slot right now' : `next feat slot at level ${slotLvl} (usable from the level after)`;
      try {
        const chain = checkFeatPrereqs(opt.name, c);
        if (!chain.met && chain.missing.length) a.advice += ` · ${opt.name} itself needs: ${chain.missing.join(', ')}`;
      } catch (e) {}
    } else if (t === 'featCount' || t === 'featParamCount') {
      let rem = 0; try { rem = getFeatBudget(c).remaining; } catch (e) {}
      const now = t === 'featCount'
        ? (c.feats || []).filter(f => { const fd = getFeatData(f.name || f.n); return fd && (opt.families || []).includes(fd.family); }).length
        : new Set((c.feats || []).filter(f => (f.name || f.n) === opt.name && f.param).map(f => f.param)).size;
      a.prog = `${now}/${opt.min}`;
      const extra = Math.max(0, (opt.min - now) - rem);
      a.earliest = (extra === 0 ? totalLvl : 3 * (Math.floor(totalLvl / 3) + extra)) + 1;
    } else if (t === 'tierLevel') {
      // Prior levels only — the entry level can't count toward its own gate.
      const now = (c.classes || []).reduce((s, e) => s + (e.tier === opt.tier ? (e.level || 0) : 0), 0);
      a.prog = `${now}/${opt.min} levels`;
      a.earliest = totalLvl + Math.max(0, opt.min - now) + 1;
    } else if (t === 'classLevel') {
      const now = (c.classes || []).filter(e => (!opt.tier || e.tier === opt.tier) && (!opt.name || e.name === opt.name))
        .reduce((s, e) => Math.max(s, e.level || 0), 0);
      a.prog = `${now}/${opt.min || 1} levels`;
      a.earliest = totalLvl + Math.max(0, (opt.min || 1) - now) + 1;
    } else if (t === 'powerAccess') {
      const ps = computeCasterStats(c);
      const pools = opt.pools === 'any' ? ['arcane', 'divine', 'psionic'] : (opt.pools || []).filter(p => p !== 'super');
      const now = Math.max(0, ...pools.map(p => ((ps[p] || {}).maxPowerLvl || 0)));
      a.prog = `now ${now}/${opt.lvl} max level`;
      a.earliest = now >= opt.lvl ? totalLvl : totalLvl + Math.max(1, 2 * (opt.lvl - now) - 1) + 1;
      a.advice = 'advance a casting/manifesting class (rough best case)';
    } else if (t === 'classAbility') {
      const grants = (CLASS_ABILITIES[opt.name]) || [];
      a.advice = grants.length ? ('granted by: ' + grants.map(g => `${g.name} ${g.minLvl}`).join(' or ')) : 'see the granting class entry';
    } else if (t === 'knowsPower') {
      a.advice = 'add the named spell/power to your repertoire at a level-up';
    } else if (t === 'powerRepertoire') {
      a.advice = 'repertoire requirement — see the class entry';
    } else if (t === 'mpTotal') {
      a.advice = 'earn Mutation Points in play';
    } else if (t === 'sixLevel' || t === 'sixLevelAny' || t === 'sixLevelOr') {
      a.kind = 'scenario';
      a.advice = "scenario dial — the GM's setting, not a build choice";
    } else if (t === 'allegiance' || t === 'alignment') {
      a.kind = 'gm';
      a.advice = 'character identity — declare via ✎ Edit (GM adjudicates)';
    } else if (t === 'talent') {
      // v8.71.0 (Adam's Hellfire/Compass report): a talent is a BUILD
      // choice, not a story gate — it rode the note-handler while the
      // engine's talent check was a stub. Progress and bound now read the
      // talent budget: an open slot is pickable immediately (entry next
      // level-up); otherwise the next Hero level brings one (best case).
      let rem = 0; try { const tb = getTalentBudget(c); rem = (tb.totalOwed || 0) - (tb.totalPicked || 0); } catch (e) {}
      a.earliest = (rem > 0 ? totalLvl : totalLvl + 1) + 1;
      a.advice = rem > 0 ? 'you have an open talent slot right now' : 'pick it with your next Hero-class talent slot';
    } else if (t === 'note') {
      a.kind = 'gm';
      a.advice = 'story gate — talk to your GM';
    }
  } catch (e) { /* annotation is decorative — never let it break the check */ }
  return a;
}

// Full Compass state for the pledged goal: annotated groups, earliest-entry
// bound, ownership. Returns null when no goal is set.
function careerCompassState(c) {
  const goal = c && c.careerGoal;
  if (!goal) return null;
  const tier = _compassTierOf(goal);
  if (!tier) return {goal, invalid: true};
  const owned = migrateLegacyClasses(c).some(e => e.name === goal && (e.level || 0) > 0);
  const r = classPrereqCheckOf(c, goal);
  const totalLvl = migrateLegacyClasses(c).reduce((s, e) => s + (e.level || 0), 0);
  const stats = computeStatsFromClasses(c.classes || []);
  const groups = (r.report || []).map(g => ({met: g.met, options: g.options.map(o => _compassAnnotate(c, o, totalLvl, stats))}));
  let earliest = totalLvl + 1, gmGated = false;
  for (const g of groups) {
    if (g.met) continue;
    if (g.options.every(o => o.kind !== 'build')) { gmGated = true; continue; }
    const bounds = g.options.filter(o => o.kind === 'build' && o.earliest !== null).map(o => o.earliest);
    if (!bounds.length) { gmGated = true; continue; }
    // A group needs only its SOONEST option. Each option's `earliest` is
    // already an ENTRY-level bound: qualify-level + 1 across the board,
    // because prerequisites must be met BEFORE the level-up (Adam's
    // correction, v8.39.1 — see the doctrine block on _compassAnnotate).
    earliest = Math.max(earliest, Math.min(...bounds), totalLvl + 1);
  }
  return {goal, tier, owned, met: r.met, groups, earliest, gmGated, totalLvl,
          metCount: groups.filter(g => g.met).length, totalCount: groups.length};
}

// v8.56.0 (playtest issue #2): class-skill lists carry '(Any)' families and
// compound '(A, B, C)' entries — the advisor's literal includes() check
// missed them. One matcher, three forms: exact, family-(Any), compound
// sub-list. Mirrors the isClassSkill machinery's semantics for LIST data.
function classSkillListHas(csk, skillName) {
  if (!Array.isArray(csk)) return false;
  if (csk.includes(skillName)) return true;
  const m = skillName.match(/^([^(]+)\((.+)\)\s*$/);
  const fam = (m ? m[1] : skillName).trim();
  const sub = m ? m[2].trim().toLowerCase() : null;
  return csk.some(entry => {
    const em = String(entry).match(/^([^(]+)\((.+)\)\s*$/);
    if (!em || em[1].trim() !== fam) return false;
    const inner = em[2].trim();
    if (/^any$/i.test(inner)) return true;
    return !!sub && inner.split(',').map(s => s.trim().toLowerCase()).includes(sub);
  });
}
// Greedy next-level advisor: of the classes the character could take a level
// in RIGHT NOW, which most advances the goal's outstanding buildable gaps?
// Returns {top, runnerUp} or null when no class choice materially helps.
function careerNextStep(c, state) {
  if (!state || state.invalid || state.met || state.owned) return null;
  const skillGaps = new Set(), famGaps = new Set(), wantPools = new Set(),
        wantTiers = new Set(), wantClasses = new Set();
  let wantBab = false;
  for (const g of state.groups) {
    if (g.met) continue;
    for (const o of g.options) {
      const t = o.opt.type;
      if (t === 'skill') skillGaps.add(o.opt.name);
      else if (t === 'skillFamily' || t === 'skillFamilyCount') famGaps.add(o.opt.family);
      else if (t === 'bab') wantBab = true;
      else if (t === 'powerAccess') (o.opt.pools === 'any' ? ['arcane','divine','psionic'] : (o.opt.pools || [])).forEach(p => wantPools.add(p));
      else if (t === 'tierLevel') wantTiers.add(o.opt.tier);
      else if (t === 'classLevel' && o.opt.name) wantClasses.add(o.opt.name);
    }
  }
  const stores = [];
  stores.push(['ordinary', ORDINARY_CLASSES]);
  stores.push(['hero', HERO_CLASSES], ['basic', BASIC_CLASSES], ['advanced', ADVANCED_CLASSES], ['prestige', PRESTIGE_CLASSES]);
  const lvlOf = (n) => { const e = migrateLegacyClasses(c).find(x => x.name === n); return e ? (e.level || 0) : 0; };
  const results = [];
  for (const [tier, store] of stores) {
    for (const K of Object.keys(store)) {
      if (K === state.goal) continue;
      const ownedLvl = lvlOf(K);
      if (tier === 'hero' && ownedLvl >= 10) continue;  // hero tier caps at 10
      let chk; try { chk = classPrereqCheckOf(c, K); } catch (e) { continue; }
      if (!chk.met) continue;  // can't take a level you don't qualify for
      const def = store[K];
      let score = 0; const reasons = [];
      const csk = (CLASS_SKILLS[K]) || [];
      const skHits = [...skillGaps].filter(s => classSkillListHas(csk, s));
      const famHits = [...famGaps].filter(fam => SKILLS.some(sk => sk.family === fam && classSkillListHas(csk, sk.n)));
      if (skHits.length || famHits.length) {
        // v8.56.0: the sp/8 rider is gone from THIS branch — any class-skill
        // route reaches rank targets at 1 pt/rank, and the rider let raw
        // skill points outvote full-vs-partial casting (Paladin above
        // Cleric for an Ecclesiarch goal — the playtest's issue #2).
        score += 2 * (skHits.length + famHits.length);
        const names = skHits.concat(famHits.map(f => f + ' (family)'));
        reasons.push(`${names.join(', ')} ${names.length === 1 ? 'is a class skill' : 'are class skills'} (${def.sp || 0}+Int pts/level)`);
      } else if ((skillGaps.size || famGaps.size) && (def.sp || 0) >= 6) {
        score += 0.5;
        reasons.push(`${def.sp}+Int skill points/level (though cross-class for the needed skills)`);
      }
      if (wantBab && Array.isArray(def.bab) && def.bab.length) {
        const slope = (def.bab[Math.min(3, def.bab.length - 1)] || 0) / Math.min(4, def.bab.length);
        if (slope >= 0.95) { score += 2; reasons.push('full Base Attack progression'); }
        else if (slope >= 0.7) { score += 1; reasons.push('¾ Base Attack progression'); }
      }
      const cc = CASTER_CLASSES[K];
      // v8.56.0 (playtest issue #2): FULL casters outrank partial ones — a
      // Paladin "advances divine casting" but can never reach the 7th-level
      // spells an Ecclesiarch goal demands; the old flat +2 let sp/level
      // tiebreak Paladin ABOVE Cleric. Directness is the doctrine.
      if (cc && cc.pool && wantPools.has(cc.pool)) {
        const full = (cc.mode === 'full');
        score += full ? 2 : 1;
        reasons.push(`advances ${cc.pool} casting/manifesting${full ? ' (full progression)' : ' (partial progression)'}`);
      }
      if (wantTiers.has(tier)) { score += 1.5; reasons.push(`counts toward the ${tier}-tier level requirement`); }
      if (wantClasses.has(K)) { score += 3; reasons.push('is itself the required class'); }
      if (score > 0 && ownedLvl > 0) { score += 0.25; }  // continuity nudge
      // v8.56.0: key-attribute affinity — "most direct" means for THIS
      // character. A Wis-built Dedicated Hero fits the Wis-keyed Cleric
      // over the Cha-keyed Saint; a half-point settles same-road ties.
      try {
        const AIX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
        const code = def.attrMinKey || (def.attr ? String(def.attr).split('/')[0].trim() : null);
        const ai = code !== null ? AIX[code] : undefined;
        if (ai !== undefined && score > 0 && am((c.attrs || [])[ai] || 10) >= 1) {
          score += 0.5; reasons.push(`${code}-keyed — plays to this character's strengths`);
        }
      } catch (e) {}
      if (score > 0) results.push({name: K, tier, score, reasons});
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.length ? {top: results[0], runnerUp: results[1] || null} : null;
}
function _compassExp() {
  if (_compassExpanded === null) {
    try { _compassExpanded = localStorage.getItem('dxd20v2_ui_compassOpen') !== '0'; } catch (e) { _compassExpanded = true; }
  }
  return _compassExpanded;
}
