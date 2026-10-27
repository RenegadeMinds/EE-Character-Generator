// =============================================================================
// js/rules/08-feat-prereqs-and-bonuses.js
// FEAT PREREQS AND BONUSES
// =============================================================================
//
// WHAT'S IN HERE
//   Feat lookups and prerequisite checking, and the functions that turn owned
//   feats and talents into numeric bonuses (feat bonuses, talent bonuses and
//   effects, derived skill bonuses).
//
// KEY NAMES (so you can search for them)
//   functions (7): getFeatData, checkFeatPrereqs, buildFeatBonuses,
//   buildTalentBonuses, computeTalentEffects, buildDerivedSkillBonuses,
//   computeSkillMiscBonuses
//
// LOAD ORDER
//   File 8 of 68. index.html loads it after js/rules/07-prestige-classes.js
//   and before js/rules/09-item-effects-and-buffs.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 6184-6736 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 6184-6736; unchanged below this line ----
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

// v8.5.0 Layer 2: build typed bonus contributions from a character's talents.
// Parallels buildFeatBonuses with three extensions (see v8.5.0_Layer2_Design.md):
//   • valueFrom — derived values resolved per character:
//       'conMod' / 'wisMod'     → ability modifier
//       'smartLevelMin1'        → Smart Hero level, minimum 1 (Savant)
//       'perLevel'              → value × total character level (Robust —
//                                 retroactive to L1 per Adam, 2026-06-12; no
//                                 level-when-taken tracking)
//   • requiresTalent: 'X' — the entry fires only if the character also owns
//     talent X. This encodes the Super/Apex rider pattern (Super-Resilient's
//     Second Wind upgrade, Healing Hands' Remove Paralysis, etc.).
//   • param-targeted entries (target:'param', param_role:'skill') resolve to
//     'skill:<chosen skill>' from the talent record's param (Skill Emphasis,
//     Savant) — same convention as Skill Focus on the feat side.
// Multiplier targets (speedMult, drMult) are aggregated with a MAX rule in
// computeTalentEffects, never summed.
function buildTalentBonuses(char) {
  const out = {};
  if (!char || !char.talents) return out;
  const ownedNames = new Set(char.talents.map(x => x.name));
  const attrs = char.attrs || [10,10,10,10,10,10];
  const classArr = migrateLegacyClasses(char);
  const totalLvl = classArr.reduce((s,e) => s + (e.level||0), 0) || 1;
  const smartLvl = classArr.filter(e => e.tier==='hero' && e.name==='Smart Hero')
                           .reduce((s,e) => s + (e.level||0), 0);
  const dedicatedLvl = classArr.filter(e => e.tier==='hero' && e.name==='Dedicated Hero')
                               .reduce((s,e) => s + (e.level||0), 0);
  for (const te of char.talents) {
    const t = TALENTS_DB.find(x => x.n === te.name);
    if (!t || !t.bonuses) continue;
    for (const b of t.bonuses) {
      if (b.requiresTalent && !ownedNames.has(b.requiresTalent)) continue;
      let target = b.target;
      // v8.5.0: 'mirror' param entries target the chosen skill(s) of ANOTHER
      // owned talent — Prodigy's "+4 insight bonus to all skills in which
      // they are a Savant". One contribution per owned mirrored instance.
      if (target === 'param' && b.param_role === 'mirror') {
        for (const other of char.talents.filter(x => x.name === b.mirrorOf && x.param)) {
          const k = 'skill:' + other.param;
          (out[k] = out[k] || []).push({
            type: b.type,
            source: `talent:${te.name}:${other.param}`,
            value: b.value,
            condition: b.condition || null,
            label: `${t.n} (via ${other.name}: ${other.param})`,
          });
        }
        continue;
      }
      if (target === 'param' && b.param_role === 'skill') {
        if (!te.param) continue; // param never chosen — nothing to target
        target = 'skill:' + te.param;
      }
      if (!target) continue;
      // Resolve the entry's value. valueFrom enum:
      //   conMod/wisMod          — ability modifier
      //   smartLevelMin1 etc.    — class level, minimum 1
      //   perLevel               — value × total level (Robust, retroactive)
      //   baseWill               — base Will save, class progression only
      //                            (same "base" sense as the {type:'save'}
      //                            prereq handler; v7 compute is talent-
      //                            independent, so no recursion)
      const resolveValue = (b) => {
        if (b.valueFrom === 'conMod') return [am(attrs[2]), ' (CON mod)'];
        if (b.valueFrom === 'wisMod') return [am(attrs[4]), ' (WIS mod)'];
        if (b.valueFrom === 'smartLevelMin1') return [Math.max(1, smartLvl), ' (Smart level)'];
        if (b.valueFrom === 'dedicatedLevelMin1') return [Math.max(1, dedicatedLvl), ' (Dedicated level)'];
        if (b.valueFrom === 'perLevel') return [(b.value||1) * totalLvl, ` (${b.value||1} × ${totalLvl} levels, retroactive)`];
        if (b.valueFrom === 'baseWill') return [computeStatsFromClasses(classArr, attrs[5]).will, ' (base Will)'];
        return [b.value, ''];
      };
      const [value, labelSuffix] = resolveValue(b);
      if (typeof value !== 'number') continue;
      // 'skill:X (Any)' targets expand to every X sub-skill in the SKILLS
      // table (Empathy's Perform (Any); works for Craft/Knowledge groups
      // too) — one contribution per sub-skill.
      const anyM = /^skill:(.+) \(Any\)$/.exec(target);
      const targets = anyM
        ? SKILLS.filter(s => s.n.startsWith(anyM[1] + ' (')).map(s => 'skill:' + s.n)
        : [target];
      for (const k of targets) {
        (out[k] = out[k] || []).push({
          type: b.type,
          source: `talent:${te.name}` + (te.param ? ` (${te.param})` : '') + (anyM ? `:${k.slice(6)}` : ''),
          value,
          condition: b.condition || null,
          label: t.n + (te.param ? ` (${te.param})` : '') + labelSuffix,
        });
      }
    }
  }
  // v9.2.2 (Adam's rulings 2026-10-06; HH Charismatic Hero talents): the
  // bonus = Charismatic Hero level (minimum +1), competence (so the three
  // never stack with each other — best applies).
  //   Charm → CONDITIONAL ⚜ on the five Cha skills that influence others (v9.2.3).
  //   Fast-Talk → CONDITIONAL ⚜ on Bluff/Diplomacy/Gamble (lying/cheating).
  //   Silver Tongue → the Fast-Talk modifier on ALL Bluff, Diplomacy,
  //   Gamble, Gather Information and Intimidate checks (standing).
  {
    const chaLvl = Math.max(1, classArr.filter(e => e.name === 'Charismatic Hero').reduce((s, e) => s + (e.level || 0), 0));
    const add = (sk, src, cond) => (out['skill:' + sk] = out['skill:' + sk] || []).push({ type: 'competence', source: 'talent:' + src, value: chaLvl, condition: cond || null, label: `${src} (Charismatic ${chaLvl})` });
    // v9.2.3 (Adam 2026-10-06, back to the book): Charm is a ⚜ FLAG — "only
    // on characters with attitudes of indifferent or better", never vs
    // unfriendly or hostile. Charm = people who like you; Fast-Talk = anyone
    // you're deceiving. The two flags cover different situations.
    if (ownedNames.has('Charm')) for (const sk of ['Bluff', 'Diplomacy', 'Disguise', 'Handle Animal', 'Intimidate']) add(sk, 'Charm', 'to influence a target who is indifferent or better (never unfriendly or hostile)');
    if (ownedNames.has('Silver Tongue')) for (const sk of ['Bluff', 'Diplomacy', 'Gamble', 'Gather Information', 'Intimidate']) add(sk, 'Silver Tongue', null);
    else if (ownedNames.has('Fast-Talk')) for (const sk of ['Bluff', 'Diplomacy', 'Gamble']) add(sk, 'Fast-Talk', 'while lying, cheating, or bending the truth (any target)');
  }
  return out;
}

// v8.5.0 Layer 2: aggregate talent bonuses on targets the stat block doesn't
// otherwise surface (speed, DR, energy resistances, melee damage, hardness,
// AP-roll riders) into a display model for the Talents page's "Active Talent
// Effects" panel. Targets with existing stat plumbing (hp, init, naturalAC,
// skill:*) are EXCLUDED here — they flow through computeStatBlock /
// computeNaturalAC / the skill engine instead.
// Multiplier rule: speedMult/drMult entries take the HIGHEST value (they
// never stack with each other); the multiplier applies to the talent-granted
// flat bonuses of their stat per the talent text.
function computeTalentEffects(char) {
  const bon = buildTalentBonuses(char);
  const effects = [];
  const sum = (list) => aggregateBonuses(list || []).total;
  const maxOf = (list) => (list || []).reduce((m,b) => Math.max(m, b.value||0), 0);
  const labelsOf = (list) => [...new Set((list || []).map(b => b.label))].join(', ');
  // Speed: flat increase then highest multiplier (Hyper-Speed).
  const speedFlat = sum(bon.speed);
  const speedMult = maxOf(bon.speedMult);
  if (speedFlat) effects.push({stat:'Base Speed', text:`+${speedFlat} ft.`, from:labelsOf(bon.speed)});
  if (speedMult > 1) effects.push({stat:'Speed Multiplier', text:`×${speedMult}`, from:labelsOf(bon.speedMult)});
  // Damage Reduction: flat sum, highest multiplier (Bulletproof), floor
  // (Nigh-Invulnerable's "minimum DR 5/-").
  let dr = sum(bon.dr);
  const drMult = maxOf(bon.drMult);
  if (drMult > 1) dr *= drMult;
  const drFloor = maxOf(bon.drFloor);
  if (bon.drFloor && dr < drFloor) dr = drFloor;
  if (dr > 0) effects.push({stat:'Damage Reduction', text:`${dr}/—`, from:labelsOf([...(bon.dr||[]), ...(bon.drMult||[]), ...(bon.drFloor||[])])});
  // Energy resistances (per type).
  for (const key in bon) {
    if (!key.startsWith('energyResistance:')) continue;
    const v = sum(bon[key]);
    if (v > 0) effects.push({stat:`${key.split(':')[1]} Resistance`, text:`${v}`, from:labelsOf(bon[key])});
  }
  // v8.88.0 (Adam's Titanic-parity ruling): Mangler/Titanic REPLACE the base
  // hardness channels ("instead of the Ignore Hardness modifiers") —
  // computeHardnessIgnore is the single source; the additive rows fire only
  // in base mode (or under NPF, when the Su instances fall).
  const hi = (typeof computeHardnessIgnore === 'function') ? computeHardnessIgnore(char) : null;
  if (hi && hi.mode === 'mangler') {
    effects.push({stat:'Ignore Hardness', text:`${hi.ignore} points`, from: hi.from + (hi.instances > 1 ? ' — DOUBLE EFFECT (parity ruling 2026-10-03)' : '')});
    effects.push({stat:'Break DC Reduction', text:`−${hi.breakDC}`, from: hi.from});
  } else if (hi && hi.mode === 'latent') {
    effects.push({stat:'Ignore Hardness', text:'latent', from: hi.from});
  }
  // Flat one-target sums.
  const simple = [
    ['meleeDamage', 'Melee Damage', v => `+${v}`],
    ...((hi && hi.mode !== 'base') ? [] : [
      ['ignoreHardness', 'Ignore Hardness', v => `${v} points`],
      ['breakDC', 'Break DC Reduction', v => `−${v}`],
    ]),
    ['aidAnother', 'Aid Another', v => `+${v}`],
    ['apRollBonus', 'AP Roll Bonus', v => `+${v} when spending AP`],
  ];
  for (const [key, stat, fmt] of simple) {
    const v = sum(bon[key]);
    if (v) effects.push({stat, text:fmt(v), from:labelsOf(bon[key])});
  }
  return effects;
}

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
    const szIdx = (typeof raceSizeIndex === 'function') ? raceSizeIndex(c) : 4;
    if (szIdx !== 4) out['skill:Hide'] = (out['skill:Hide'] || []).concat([{ type: 'size', value: (4 - szIdx) * 4, label: `size (${SIZE_LADDER[szIdx]})` }]);
  } catch (e) {}
  return out;
}

function computeSkillMiscBonuses(c) {
  const merged = {};
  for (const src of [buildFeatBonuses(c), buildOccupationBonuses(c), buildTalentBonuses(c), buildItemBonuses(c), buildScale0VariantBonuses(c), buildMutationBonuses(c), buildMagicItemBonuses(c), buildDerivedSkillBonuses(c), buildRacialBonuses(c.race) /* v8.16.0 Races pass: skill: targets */, (typeof buildClassChoiceBonuses === 'function' ? buildClassChoiceBonuses(c) : {}), (typeof buildCompanionSkillPerks === 'function' ? buildCompanionSkillPerks(c) : {}), (typeof buildAdvancedClassSkillBonuses === 'function' ? buildAdvancedClassSkillBonuses(c) : {}), (typeof buildPowerArmorSkillBonuses === 'function' ? buildPowerArmorSkillBonuses(c) : {}), (typeof activeBuffBonuses === 'function' ? activeBuffBonuses(c) : {}) /* v8.42.0: transient wired buffs */, (typeof buildCyberneticsBonuses === 'function' ? buildCyberneticsBonuses(c) : {}) /* v8.91.0: implants */, (typeof buildArmorCheckPenaltyBonuses === 'function' ? buildArmorCheckPenaltyBonuses(c) : {}) /* v8.93.0: ACP reaches the skill table */]) {
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

