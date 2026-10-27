// =============================================================================
// js/rules/skills.js
// SKILLS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Skills: class skills, synergies, skill-point budgets, toolkit
//   needs and Take-10 skill sets.
//
// KEY NAMES (so you can search for them)
//   functions (15): buildDerivedSkillBonuses, computeSkillMiscBonuses,
//   displaySkillName, skillHoverText, baseExAttrMod, computeSkillSetSpecs,
//   skillNeedsToolkit, isClassSkill, canonSkillPick, getClassSkillSources,
//   computeSkillSynergies, computeSkillPointBudget, parseSkillReq,
//   meetsSkillReq, checkScenarioGateOnRankChange
//
// WHERE IT CAME FROM
//   Gathered from js/app/50-skills-page.js, js/rules/08-feat-prereqs-and-
//   bonuses.js, js/rules/10-minds-ledger-and-magic-browser.js,
//   js/rules/17-per-diem-and-class-choices.js, js/rules/23-hit-points-xp-
//   skills.js when the code was regrouped by topic and page. Each function
//   and table moved whole and unchanged, with the comments above it,
//   including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v8.5.0 Layer 2: aggregate every always-on skill:* bonus contribution from
// feats, occupations, AND talents for one character. This is the consumer the
// buildOccupationBonuses STATUS note (above its definition) was waiting for —
// the skills page's Misc column now folds these in alongside synergies.
// Returns {<skillName>: {total, always:[entries], cond:[entries]}}. Entries
// with a `condition` (e.g. Healing Touch's kit-only bonus) do NOT fold into
// the total — they surface in the Misc tooltip for per-roll adjudication,
// same convention as conditional synergies.
// v8.8.2 (Adam's Jump wiring): derived, always-on skill modifiers computed
// from the character's OTHER live systems rather than a picked source.
// Jump's speed modifier (HH p.172): no modifier at exactly 30 ft; −6 per
// full 10 ft below 30, +4 per full 10 ft above — fed by the live walk speed
// (armor limitation, Increased Speed talents, Hyper-Speed ×, Reduced Speed
// all already folded in by computeSpeeds). A Dwarf's 20 ft is genuinely
// Jump −6 in the book — surprising but RAW.
function buildDerivedSkillBonuses(c) {
  const out = {};
  try {
    const walk = computeSpeeds(c).walk;
    const v = walk > 30 ? Math.floor((walk - 30) / 10) * 4 : -Math.floor((30 - walk) / 10) * 6;
    if (v) out['skill:Jump'] = [{ value: v, label: `movement speed ${walk}′ (HH p.172: +4 per 10 ft over 30, −6 per 10 ft under)` }];
    // v8.16.0 Races pass: size modifier to Hide (+4 Small, −4 Large — d20
    // ±4 per step; the Strong super-talent size riders deliberately do NOT
    // shrink Hide, per the HH p.263 rider list: dice/grapple/Jump only).
    const szIdx = raceSizeIndex(c);
    if (szIdx !== 4) out['skill:Hide'] = (out['skill:Hide'] || []).concat([{ type: 'size', value: (4 - szIdx) * 4, label: `size (${SIZE_LADDER[szIdx]})` }]);
  } catch (e) {}
  return out;
}

function computeSkillMiscBonuses(c) {
  const merged = {};
  for (const src of [buildFeatBonuses(c), buildOccupationBonuses(c), buildTalentBonuses(c), buildItemBonuses(c), buildScale0VariantBonuses(c), buildMutationBonuses(c), buildMagicItemBonuses(c), buildDerivedSkillBonuses(c), buildRacialBonuses(c.race) /* v8.16.0 Races pass: skill: targets */, (buildClassChoiceBonuses(c)), (buildCompanionSkillPerks(c)), (buildAdvancedClassSkillBonuses(c)), (buildPowerArmorSkillBonuses(c)), (activeBuffBonuses(c)) /* v8.42.0: transient wired buffs */, (buildCyberneticsBonuses(c)) /* v8.91.0: implants */, (buildArmorCheckPenaltyBonuses(c)) /* v8.93.0: ACP reaches the skill table */]) {
    for (const key in src) {
      if (!key.startsWith('skill:')) continue;
      (merged[key] = merged[key] || []).push(...src[key]);
    }
  }
  const bySkill = {};
  for (const key in merged) {
    const name = key.slice(6);
    const always = merged[key].filter(e => !e.condition);
    const cond = merged[key].filter(e => e.condition);
    bySkill[name] = {total: aggregateBonuses(always).total, always, cond};
  }
  return bySkill;
}


// v8.24.0 (Adam's ruling, 2026-09-05): the Decipher skill's DISPLAY name
// follows the scenario's Tech Scale — "Decipher Script" in Tech Scale 0-4
// (parchment, glyphs, dead languages), "Decipher Code" in Tech Scale 5-9
// (ciphers, encryption, source). One skill, one internal key ('Decipher
// Code' — ranks/synergies/prereqs unchanged), world-responsive label.
function displaySkillName(c, name) {
  if (name === 'Decipher Code' && scenarioTechScale(c) <= 4) return 'Decipher Script';
  return name;
}

function skillHoverText(c, sk) {
  const ALIAS = { 'Decipher Code': 'Decipher Script' };
  const base = ALIAS[sk.n] || sk.n.replace(/\s*\(.*$/, '');
  const e = SKILL_DESCS[sk.n] || SKILL_DESCS[base];
  if (!e) return '';
  const nm = displaySkillName(c, sk.n);
  return nm + ' (' + e.q + ')\n\n' + e.d;
}

// ============================================================================
// v8.66.0 (Adam's design, 2026-10-02): TAKE-10 SKILL-SET DESIGNATIONS —
// Shut It Out (Daredevil 7) and Skill Mastery (Rogue SA) share one chassis:
// a one-liner in 🎓 Class Choices with a collapsible designation list,
// amber-⚑ while slots sit unselected (the standing pending idiom).
// CAPACITY RULING: 3 + the attribute modifier of the BASE score — only
// EXTRAORDINARY bakes count (Su bakes subtracted, item enhancements never
// included), and the set GROWS live as the base score permanently rises.
// A base-score drop leaves the set over capacity — flagged red, GM
// adjudicates which designations lapse (no auto-delete).
function baseExAttrMod(c, i) {
  const su = (suBakedPerAttr(c) || [0, 0, 0, 0, 0, 0]);
  return am((((c.attrs) || [10, 10, 10, 10, 10, 10])[i] || 10) - (su[i] || 0));
}
function computeSkillSetSpecs(c) {
  const out = [];
  const dd = _cfLvlOf(c, 'Daredevil');
  if (dd >= 7) {
    const list = CLASS_SKILLS['Daredevil'] || [];
    const eligible = SKILLS.map(s => s.n).filter(n => {
      if (list.includes(n)) return true;
      const fam = n.split(' (')[0];
      return list.some(x => x === fam + ' (Any)' || x === fam);
    });
    out.push({ key: 'shutItOut', className: 'Daredevil', feature: 'Shut It Out', atLvl: 7, attrIdx: 2, attrName: 'Con',
      cap: Math.max(0, 3 + baseExAttrMod(c, 2)), eligible,
      note: 'Take 10 with the designated Daredevil class skills even when circumstances would prevent it (HH p.122). Capacity = 3 + Con modifier of the BASE score — Extraordinary bakes only; Su bakes and item enhancements never count (Adam’s ruling 2026-10-02). The set grows as the base score permanently rises.' });
  }
  const smTakes = Object.keys(c.classChoices || {}).filter(k => k.startsWith('rog_sa_') && c.classChoices[k] === 'Skill Mastery').length;
  if (smTakes > 0) {
    out.push({ key: 'skillMastery', className: 'Rogue', feature: `Skill Mastery${smTakes > 1 ? ` ×${smTakes}` : ''}`, atLvl: 10, attrIdx: 3, attrName: 'Int',
      cap: smTakes * Math.max(0, 3 + baseExAttrMod(c, 3)),
      eligible: SKILLS.map(s => s.n).filter(n => ((c.skills || {})[n] || 0) > 0),
      note: 'Take 10 with the designated skills even when stress would prevent it (HH p.98). Capacity = (3 + Int modifier) per take, BASE score — Extraordinary bakes only (Adam’s ruling 2026-10-02). Eligible: skills you have ranks in.' });
  }
  return out;
}
function skillNeedsToolkit(sk){ return (sk.family === 'Craft' && sk.n !== 'Craft (Writing)') || TOOLKIT_DEPENDENT_SKILLS.has(sk.n) || INSTRUMENT_PERFORMS.has(sk.n); }

// ========== SKILLS ==========
// isClassSkill — determines whether a skill is a class skill for a character.
//
// Two call signatures:
//   (skillName, char)                      — preferred, uses full character record
//   (skillName, heroClassOrName, occupation) — legacy, uses just the named class
//
// Logic (v8.1.5): consult CLASS_SKILLS for every class entry on the character,
// PLUS HC_SKILLS for the named Hero class (legacy call style). If the matching
// class entry has a sentinel string ('__inherit_all_class_skills__' for
// Super-Hero/Villain, '__expert_choose_any__' for Expert, etc.), apply the
// special rule. Otherwise check the skill against the class's class-skill list
// with family-prefix matching (so a class with "Knowledge (Any)" matches any
// Knowledge sub-skill). Occupation-specific Profession skills auto-class-skill
// based on the character's Starting Occupation(s).
function isClassSkill(skillName, arg2, occupation){
  // v8.2.4 (Issue C-2): isClassSkill now delegates to getClassSkillSources()
  // and returns whether the source list is non-empty. The sources list itself
  // is used by the renderer for a "why is this a class skill?" provenance
  // tooltip, helpful for diagnosing surprises like "why is Knowledge (Tactics)
  // a class skill on my Berserker?" (answer: Gladiator's compound skill pick).
  const sources = getClassSkillSources(skillName, arg2, occupation);
  return sources.length > 0;
}
function canonSkillPick(pick) {
  const whole = SKILL_NAME_ALIASES[String(pick).trim().toLowerCase()];
  if (whole) return whole;
  const m = String(pick).match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
  if (!m) return String(pick).trim();
  const subs = m[2].split(',').map(s => { const x = s.trim(); return SKILL_SUB_ALIASES[x.toLowerCase()] || x; });
  return m[1].trim() + ' (' + [...new Set(subs)].join(', ') + ')';
}

// Return an array of human-readable strings explaining WHY a skill is a
// class skill for the given character. Empty array means the skill is
// cross-class. Multiple entries are possible (e.g. when two classes both
// grant the same skill).
function getClassSkillSources(skillName, arg2, occupation){
  let classArr, heroClassName, occs, occupationPicks;
  if (arg2 && typeof arg2 === 'object' && (arg2.classes || arg2.heroClass !== undefined)) {
    const c = arg2;
    classArr = (c.classes && c.classes.length) ? c.classes : migrateLegacyClasses(c);
    heroClassName = c.heroClass || '';
    occs = c.occupations || (c.occ ? [c.occ] : []);
    occupationPicks = c.occupationPicks || null;
  } else {
    classArr = [];
    heroClassName = arg2 || '';
    occs = Array.isArray(occupation) ? occupation : (occupation ? [occupation] : []);
    occupationPicks = null;
    if (heroClassName) classArr.push({tier:'hero', name:heroClassName, level:1});
  }
  const sources = [];

  // Helper: check one class's class-skill list, return source string or null
  function classMatch(className, classLevel) {
    // v9.15.2 (§275 F3): monstrous-tier classes (GMF seed imports) — FF p.47:
    // "All listed skills are class skills". The seed carries no skill list,
    // so the lane treats every skill as class; pruning is the GM's finishing
    // touch, like the rest of the statblock's skill section.
    if (MONSTROUS_CLASSES[className]) {
      return `class:${className} (monstrous — FF: a creature's listed skills are class skills)`;
    }
    const skills = CLASS_SKILLS[className];
    if (!skills) {
      // Fall back to HC_SKILLS for Hero classes if CLASS_SKILLS doesn't have them
      const hc = HC_SKILLS[className] || [];
      if (hc.includes(skillName)) return `class:${className}`;
      const fam = skillName.split(' (')[0];
      if (hc.some(s => s.startsWith(fam + '(') || s === fam + ' (Any)')) {
        return `class:${className} (via ${fam} family)`;
      }
      return null;
    }
    if (typeof skills === 'string') {
      if (skills === '__all_skills_class__') return `class:${className} (all-skills sentinel)`;
      if (skills === '__expert_choose_any__') return `class:${className} (Expert chooses any 10 — currently over-permissive, will refine)`;
      if (skills === '__inherit_arcane_divine__') {
        // Mystic Theurge: skills are union of underlying arcane+divine class skills
        for (const e2 of classArr) {
          if (e2.name === className) continue;
          const meta = CASTER_CLASSES[e2.name];
          if (meta && (meta.pool === 'arcane' || meta.pool === 'divine')) {
            const inner = classMatch(e2.name, e2.level);
            if (inner) return `class:${className} (inherited from ${e2.name})`;
          }
        }
        return null;
      }
      if (skills === '__inherit_divine_psionic__') {
        for (const e2 of classArr) {
          if (e2.name === className) continue;
          const meta = CASTER_CLASSES[e2.name];
          if (meta && (meta.pool === 'divine' || meta.pool === 'psionic')) {
            const inner = classMatch(e2.name, e2.level);
            if (inner) return `class:${className} (inherited from ${e2.name})`;
          }
        }
        return null;
      }
      return null;
    }
    // Array of skills: direct hit or family-Any match
    if (skills.includes(skillName)) return `class:${className}`;
    const fam = skillName.split(' (')[0];
    if (skills.some(s => s === fam + ' (Any)' || s === fam)) {
      return `class:${className} (via ${fam} (Any))`;
    }
    return null;
  }

  // Check every class on the character
  for (const e of classArr) {
    const src = classMatch(e.name, e.level);
    if (src) sources.push(src);
  }
  // v8.5.4: class sub-options grant class skills (Adam's rulings):
  //   • The Druid Option adds Knowledge (Nature) and Survival to the
  //     Cleric's class skills (HH, "The Druid Option": Skills).
  //   • A Psion's chosen discipline adds its associated class skills (HH
  //     Psion entry, per-discipline lists in PSION_DISCIPLINE_INFO).
  const subC = (arg2 && typeof arg2 === 'object' && (arg2.classes || arg2.heroClass !== undefined)) ? arg2 : null;
  if (subC) {
    if (subC.druidOption && classArr.some(e => e.name === 'Cleric')
        && (skillName === 'Knowledge (Nature)' || skillName === 'Survival')) {
      sources.push('class:Cleric (Druid Option)');
    }
    const disc = subC.psionDiscipline;
    if (disc && PSION_DISCIPLINE_INFO[disc] && classArr.some(e => e.name === 'Psion')
        && PSION_DISCIPLINE_INFO[disc].skills.includes(skillName)) {
      sources.push(`class:Psion (${disc} discipline)`);
    }
  }
  // Also check the legacy heroClassName arg via HC_SKILLS for backward compat
  if (heroClassName && !classArr.some(e => e.name === heroClassName)) {
    const hc = HC_SKILLS[heroClassName] || [];
    if (hc.includes(skillName)) sources.push(`hero-class:${heroClassName}`);
    else {
      const fam = skillName.split(' (')[0];
      if (hc.some(s => s.startsWith(fam + '(') || s === fam + ' (Any)')) {
        sources.push(`hero-class:${heroClassName} (via ${fam} family)`);
      }
    }
  }
  // Occupation-specific Profession
  for (const occ of occs) {
    if (occ && skillName === `Profession (${occ})`) {
      sources.push(`occupation:${occ} (Profession)`);
    }
  }
  // v8.2.1: Starting Occupation skill picks. Each occupation lets the player
  // designate N skills from the occupation's list as class skills. Compound
  // entries like "Knowledge (Streetwise, Tactics)" cover any of the listed
  // sub-skills.
  if (occupationPicks) {
    for (const slot of ['primary', 'secondary']) {
      const picks = occupationPicks[slot];
      if (!picks || !picks.skills) continue;
      const occName = occs[slot === 'primary' ? 0 : 1] || '?';
      for (const pick of picks.skills) {
        if (!pick) continue;
        // v8.91.0: match through the canonicalizer — the stored pick keeps
        // the book's spelling, the comparison speaks catalog.
        const pickC = canonSkillPick(pick);
        if (pickC === skillName) {
          sources.push(`occupation-pick:${occName} (${pick})`);
          continue;
        }
        // Compound match: "Knowledge (Streetwise, Tactics)" covers
        // "Knowledge (Streetwise)", "Knowledge (Tactics)", etc.
        const m = pickC.match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
        if (m) {
          const family = m[1].trim();
          const subs = m[2].split(',').map(s => s.trim());
          const skillM = skillName.match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
          if (skillM && skillM[1].trim().toLowerCase() === family.toLowerCase()) {
            const skillSub = skillM[2].trim().toLowerCase();
            // "(Any)" compounds (Academic's Knowledge: Any) cover the family.
            if (subs.some(s => s.toLowerCase() === skillSub || s.toLowerCase() === 'any')) {
              sources.push(`occupation-pick:${occName} (compound ${family})`);
            }
          }
        }
      }
    }
  }
  // v8.99.0 (the cybernetics wire-through): Data Archive (HH p.337) — "The
  // recipient treats ALL skills as class skills."
  if (arg2 && typeof arg2 === 'object' && getCyber(arg2).some(r => r.n === 'Data Archive')) {
    sources.push('cybernetic:Data Archive (all skills are class skills)');
  }
  return sources;
}

function computeSkillSynergies(targetSkill, c) {
  if (!c) return {auto:[], conditional:[], gm:[]};
  const out = {auto:[], conditional:[], gm:[]};
  for (const entry of SYNERGIES_DB) {
    if (entry.target !== targetSkill) continue;
    // For "auto" synergies, only include if the source ranks meet the
    // threshold (5+). The target's displayed total reflects only active
    // synergies. For "conditional" and "gm", always include — these surface
    // as tooltip notes regardless of activation, since they're informational.
    if (entry.kind === 'auto') {
      const srcRanks = getLiveSkillRanks(c, entry.source);
      if (srcRanks < 5) continue;
      // v8.3.11: optional target_ranks_min predicate. Used by Knowledge
      // (Business) → Profession (X), which fires only if the character has
      // ≥1 rank in THIS Profession (X). Default (omitted) = 0 = always fires
      // once source threshold met. The predicate is checked against the
      // SPECIFIC target skill (not its family), so a character with 5 ranks
      // in K(Business) and 1 rank in Profession (Doctor) sees +2 only on
      // Profession (Doctor), not on Profession (Academic).
      if (entry.target_ranks_min && entry.target_ranks_min > 0) {
        const tgtRanks = getLiveSkillRanks(c, entry.target);
        if (tgtRanks < entry.target_ranks_min) continue;
      }
      out.auto.push({source: entry.source, value: entry.value, page: entry.page,
        target_ranks_min: entry.target_ranks_min || 0});
    } else if (entry.kind === 'conditional') {
      out.conditional.push({source: entry.source, value: entry.value, context: entry.context, page: entry.page});
    } else if (entry.kind === 'gm') {
      out.gm.push({source: entry.source, value: entry.value, context: entry.context, page: entry.page});
    }
  }
  return out;
}

// v8.3.15: Shared skill point budget calculator. Walks per-class per-level
// allocation, applies the L1 ×5 multiplier ONLY to the very first level of
// the very first class, enforces the d20 min-1-per-level rule, and adds
// racial skill point bonuses where applicable (currently just Human: +5
// at L1, +1 at each additional level — HH p.21).
//
// Returns the total skill point budget the character has earned across
// their career. Used both by renderSkills() at initial paint and by
// recomputeSkillBudget() on live DOM updates — guaranteeing the two paths
// agree on the math.
function computeSkillPointBudget(c) {
  if (!c || !c.attrs) return 0;
  const intM = am(c.attrs[3]);
  const classArr = (c.classes && c.classes.length > 0)
    ? c.classes
    : migrateLegacyClasses(c);
  // Order classes such that the {first:true} class comes first; preserve the
  // rest in their declared order. This gives a deterministic L1..LN walk.
  const ordered = [...classArr].sort((a, b) => {
    if (a.first && !b.first) return -1;
    if (b.first && !a.first) return 1;
    return 0;
  });
  let totalSP = 0;
  let levelCounter = 0;
  for (const e of ordered) {
    const cls = getClassEntry(e);
    // d20 lineage rule: minimum 1 skill point per level even with deeply
    // negative Int mod. If a class somehow has no .sp, the fallback is the
    // legacy 4 (preserves pre-v8.3.13 behavior for unknown classes).
    const sp = cls && typeof cls.sp === 'number' ? cls.sp : 4;
    const perLvl = Math.max(1, sp + intM);
    const lvl = e.level || 0;
    for (let i = 0; i < lvl; i++) {
      levelCounter++;
      // L1 (only the very first level of the very first class) gets ×5
      const multiplier = (levelCounter === 1) ? 5 : 1;
      totalSP += perLvl * multiplier;
    }
  }
  // v8.3.15: Human racial skill point bonus (HH p.21).
  //   "5 extra skill points at 1st level, and 1 extra skill point at each
  //    additional level, demonstrating the human's natural versatility."
  // Note this is the only race with a skill-point-budget contribution in HH
  // and FF; if future races gain similar bonuses they go here.
  // v8.67.0 (Mutant sync): Unnatural Prowess — 2 bonus skill points per +1
  // Mutant level (HH p.29). Budget-integrated per Adam; the Tech Scale 0
  // restriction is TABLE-ENFORCED (the first typed SP pool — the budget
  // tracker stays one number, the restriction rides the advisory line on
  // the Mutations tab and the budget note).
  const _mlSP = (getMPState(c).mutantLevel || 0);
  if (_mlSP > 0 && levelCounter >= 1) totalSP += 2 * _mlSP;
  // v8.68.0: a Human-parent Hybrid inherits the Human SP bonus ("all racial
  // abilities of both parents" — Adam's simple model).
  const _hySPh = hybridInfo(c);
  const _isHumanish = c.race === 'Human' || (_hySPh && (_hySPh.a === 'Human' || _hySPh.b === 'Human'));
  if (_isHumanish && levelCounter >= 1) {
    totalSP += 5;                         // L1 bonus
    if (levelCounter > 1) {
      totalSP += (levelCounter - 1);      // +1 per additional level
    }
  }
  return totalSP;
}

// v8.2.4 (Issue C-1): Skill req parsing and scenario-gate warnings.
//
// Each skill in the SKILLS array may have a `req` field like "Tech 5" or
// "Psionic 1" or "Arcane 1" indicating the minimum Six Scales axis tier at
// which the skill is available. The data is documented in the handbook but
// was not previously enforced — players could put ranks in Computer Use in
// a Tech 1 scenario without any warning.
//
// Per the player's design choice (v8.2.4): "Show with warning — row appears
// normal but warns when trying to put ranks in it (GM can override)."

function parseSkillReq(reqString) {
  // "Tech 5" → {axis:'tech', min:5}. Returns null if unparseable.
  if (!reqString || typeof reqString !== 'string') return null;
  const m = reqString.match(/^([A-Za-z]+)\s+(\d+)$/);
  if (!m) return null;
  const axisName = m[1].toLowerCase();
  // Map handbook axis names to sixLevels keys
  const axisMap = {tech:'tech', arcane:'arcane', divine:'divine',
                   psionic:'psionic', heroic:'heroic', mutation:'mutation'};
  const axis = axisMap[axisName];
  if (!axis) return null;
  return {axis, min: parseInt(m[2], 10)};
}

function meetsSkillReq(skill, sixLevels) {
  // Returns true if the scenario's Six Scales are sufficient. Skills with no
  // req or unparseable req are always available.
  const req = parseSkillReq(skill.req);
  if (!req) return true;
  const have = (sixLevels && sixLevels[req.axis]) || 0;
  return have >= req.min;
}

async function checkScenarioGateOnRankChange(skill, ranks, c) {
  // Called from updSkTot when a skill's rank input changes. If the skill is
  // scenario-gated and the player is taking 1+ ranks for the first time in
  // this session, warn them. If they accept, record a gmException; if they
  // decline, revert the input to the prior value (we treat 0 as the safe
  // fallback since the warning fires on transitions to ranks ≥ 1).
  if (!c || !skill || !skill.req) return true;
  if (ranks <= 0) return true; // nothing to warn about
  if (meetsSkillReq(skill, c.sixLevels)) return true; // req satisfied
  // Already acknowledged this session — let it through silently
  if (_scenarioGateAcknowledged.has(skill.n)) return true;
  const req = parseSkillReq(skill.req);
  const have = (c.sixLevels && c.sixLevels[req.axis]) || 0;
  const axisDef = (SIX_LEVELS[req.axis]) || {};
  const axisLabel = axisDef.label || req.axis;
  const ok = await confirmModal(
    `"${skill.n}" requires ${axisLabel} ≥ ${req.min}, but this scenario has ${axisLabel} ${have}.\n\n` +
    `Per HH p.42-ish, this skill is not normally available at this scenario's tier. ` +
    `Take ranks anyway as a GM-acknowledged exception?\n\n` +
    `(A GM exception entry will be recorded on this character.)`
  );
  if (!ok) return false; // caller will revert
  // Mark as acknowledged so we don't pop the dialog again on every keystroke
  _scenarioGateAcknowledged.add(skill.n);
  // Record on the character. Idempotent — if there's already an entry for
  // this skill, don't duplicate.
  if (!c.gmExceptions) c.gmExceptions = [];
  const already = c.gmExceptions.some(ex => ex.type === 'skill' && ex.target === skill.n);
  if (!already) {
    c.gmExceptions.push({
      type:'skill',
      target: skill.n,
      missing: [`${axisLabel} ${have} < required ${req.min}`],
      grantedAt: new Date().toLocaleDateString(),
    });
    save();
  }
  return true;
}
