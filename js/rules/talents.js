// =============================================================================
// js/rules/talents.js
// TALENTS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Talents: bonuses, effects and prerequisites.
//
// KEY NAMES (so you can search for them)
//   functions (3): buildTalentBonuses, computeTalentEffects,
//   checkTalentPrereqs
//
// WHERE IT CAME FROM
//   Gathered from js/rules/08-feat-prereqs-and-bonuses.js,
//   js/rules/22-career-compass.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  const hi = computeHardnessIgnore(char);
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

// Talent prereq checker — v8.5.0 Layer 1: fully structured prereqs.
// All formerly note-typed TALENTS_DB prereqs (55 entries) are now structured;
// the regex-based note parser (matchTreeCategoricalPrereqs and the token-
// matching pipeline, v8.3.22–v8.4.1) has been removed. A `note` handler
// remains as a defensive fallback for future unstructured data — it renders
// as a non-blocking GM-verify advisory, per the v8.4.1 propagation fix.
//
// Structured prereq types. Same group shape as checkFeatPrereqs: prereqs is
// an array of groups (ANDed); each group is an array of options (ORed).
//   {type:'feat',  name}                        — owns the feat
//   {type:'talent', name}                       — owns the talent
//   {type:'talentAny', names:[...], count?}     — owns ≥count of the named
//                                                 talents (default 1)
//   {type:'talentTree', tree, count?}           — owns ≥count talents from
//                                                 the tree (default 1)
//   {type:'talentTreeAny', trees:[...], count?} — owns ≥count talents from
//                                                 any of the trees, combined
//   {type:'mp', amount}                         — MP pool ≥ amount (live in
//                                                 Layer 3; defers to the tier
//                                                 gate until then)
//   {type:'langCount', min}                     — ≥min entries in Languages
//                                                 Known (Linguist only)
//   {type:'note', text}                         — GM-verify advisory fallback
//
// Tree-membership checks exclude the candidate talent itself — see
// ownedInTrees below.
//
// Returns {met:bool, missing:[string]} — same shape as checkFeatPrereqs.
function checkTalentPrereqs(talentName, c) {
  const t = TALENTS_DB.find(x => x.n === talentName);
  if (!t) return {met:false, missing:['Talent not found']};
  const missing = [];

  // Hero class membership.
  const classArr = migrateLegacyClasses(c || {});
  const heroClassNames = new Set(classArr.filter(e => e.tier==='hero' && (e.level||0)>0).map(e => e.name));
  const ownedFeats = new Set(((c && c.feats) || []).map(f => f.name || f.n));
  const hasMultiTalented = ownedFeats.has('Multi-Talented');

  // Class match: either the character has the talent's Hero class, OR they
  // have Multi-Talented and haven't yet spent the bonus on another class.
  // (For v8.3.21, presence of Multi-Talented unlocks any one cross-class
  // talent; we don't track which class the bonus is "spent on" — that's a
  // v8.3.22+ refinement.)
  // v9.9.3 (§262): the v8.11.1 flex classes open cross-class talents too.
  // Anti-Hero (Talent @1, convertible slots 3/5/7/9) and Super-Hero /
  // Super-Villain (Bonus Feat or Talent @2/@4) may take "a Talent from any
  // Hero class for which they qualify (i.e., a score of 13+ in that Hero
  // class's associated attribute)", treated as 1st level in unowned classes
  // (GMG p.152 / p.183). The budget side (getTalentBudget's flexUsed) was
  // wired in v8.11.1 but this gate never learned about it, so the talent
  // half of "Bonus Feat or Talent" was unreachable cross-class. Like
  // Multi-Talented, spend is not tracked here — the four-state budget
  // display owns the accounting.
  if (t.hero_class && !heroClassNames.has(t.hero_class)) {
    const _flexLvl = (n) => classArr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
    const hasFlexClass = _flexLvl('Anti-Hero') >= 1 || _flexLvl('Super-Hero') >= 2 || _flexLvl('Super-Villain') >= 2;
    let flexAttrOk = false, flexAttrKey = null;
    if (hasFlexClass && typeof HERO_CLASSES === 'object' && HERO_CLASSES[t.hero_class]) {
      flexAttrKey = HERO_CLASSES[t.hero_class].attr || null;
      const _ai = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5}[flexAttrKey];
      if (_ai !== undefined && c) {
        const _scores = effAttrs(c);
        flexAttrOk = ((_scores && _scores[_ai]) || 10) >= 13;
      }
    }
    if (!hasMultiTalented && !flexAttrOk) {
      missing.push(hasFlexClass && flexAttrKey
        ? `Requires a level in ${t.hero_class} — or ${flexAttrKey} 13+ to take it cross-class via your Bonus Feat or Talent flex (treated as 1st level)`
        : `Requires a level in ${t.hero_class}`);
    }
  }

  // Tier gating: Super-Talents and Apex Super-Talents cost MP (mp_cost).
  // v8.5.3 Mutations pass — LAYER 3 IS LIVE: the blanket "system pending"
  // gate (v8.3.22–v8.5.2) is replaced by a real check against the computed
  // MP ledger (getMPState — earned from Drawbacks/feat grants/GM grants,
  // spent on Advantages/super-powers/owned Super-Talents). Acquiring the
  // talent IS the spend: ownership is summed by the ledger, so this check
  // asks whether the BANKED balance covers this talent's cost. Also requires
  // the Supernatural Mutation feat (super-talents are supernatural abilities).
  if (t.tier === 'Super-Talent' || t.tier === 'Apex Super-Talent') {
    const mpState = getMPState(c);
    if (!mpState || !mpState.isSuperMutant) {
      missing.push(`Requires the Supernatural Mutation feat (super-talents are supernatural abilities)`);
    } else if ((t.mp_cost || 0) > mpState.balance) {
      missing.push(`Requires ${t.mp_cost} MP (banked: ${mpState.balance})`);
    }
  }

  // Walk prereq groups. Each group is an OR; the group passes if at least one
  // option passes. If any group fails entirely, the prereq is unmet.
  // v8.5.0 Layer 1: all TALENTS_DB prereqs are structured; the regex note
  // parser (matchTreeCategoricalPrereqs, v8.3.22–v8.4.1) is gone. A `note`
  // handler remains as a defensive fallback for future unstructured data.
  const ownedTalents = new Set((c && c.talents || []).map(x => x.name));
  // Tree-membership counter. EXCLUDES the candidate talent itself: a talent
  // never satisfies its own tree prereq. This matters for the retcon
  // compliance scan, where the talent being validated is already owned.
  // (Set semantics also mean a multiple-takeable talent like Savant counts
  // once — "another talent from the tree" means a DISTINCT talent.)
  const ownedInTrees = (trees) => {
    let n = 0;
    for (const name of ownedTalents) {
      if (name === t.n) continue;
      const ot = TALENTS_DB.find(x => x.n === name);
      if (ot && ot.tree && trees.includes(ot.tree)) n++;
    }
    return n;
  };
  if (Array.isArray(t.prereqs)) {
    for (const group of t.prereqs) {
      if (!Array.isArray(group) || group.length === 0) continue;
      let groupPassed = false;
      const groupMissingReasons = [];
      for (const opt of group) {
        if (opt.type === 'feat') {
          if (ownedFeats.has(opt.name)) { groupPassed = true; break; }
          groupMissingReasons.push(`feat ${opt.name}`);
        } else if (opt.type === 'talent') {
          // v8.5.0: owns the named talent.
          if (ownedTalents.has(opt.name)) { groupPassed = true; break; }
          groupMissingReasons.push(opt.name);
        } else if (opt.type === 'talentAny') {
          // v8.5.0: owns at least `count` (default 1) of the named talents.
          // Covers the Apex "two of either A, B, or C" prereqs.
          const need = opt.count || 1;
          const have = (opt.names || []).filter(n => ownedTalents.has(n)).length;
          if (have >= need) { groupPassed = true; break; }
          groupMissingReasons.push(`${need} of: ${(opt.names || []).join(', ')} (have ${have})`);
        } else if (opt.type === 'talentTree' || opt.type === 'talentTreeAny') {
          // v8.5.0: owns at least `count` (default 1) talents from the named
          // tree (`tree:`) or from any of the named trees combined (`trees:`).
          const trees = opt.type === 'talentTree' ? [opt.tree] : (opt.trees || []);
          const need = opt.count || 1;
          if (ownedInTrees(trees) >= need) { groupPassed = true; break; }
          groupMissingReasons.push(`${need === 1 ? 'a talent' : need + ' talents'} from the ${trees.join(' or the ')}`);
        } else if (opt.type === 'mp') {
          // v8.5.3 Mutations pass — Layer 3 live: check the computed MP
          // ledger's banked balance (was: dormant c.mp scalar that nothing
          // ever set, passing silently pre-Layer 3).
          const mpSt = getMPState(c);
          if (mpSt && mpSt.balance >= (opt.amount || 0)) { groupPassed = true; break; }
          groupMissingReasons.push(`${opt.amount || 0} MP (banked: ${mpSt ? mpSt.balance : 0})`);
        } else if (opt.type === 'langCount') {
          // v8.5.0: Linguist only. Counts entries in the free-text Languages
          // Known field (c.langs). Approximates the rulebook's "Read/Write/
          // Speak Language for each of three different languages" — the
          // generator stores languages as free text, not per-language skill
          // buys, so racial freebies also count (per Adam, 2026-06-12).
          const langs = ((c && c.langs) || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          if (langs.length >= (opt.min || 1)) { groupPassed = true; break; }
          groupMissingReasons.push(`${opt.min} languages in Languages Known (have ${langs.length})`);
        } else if (opt.type === 'note') {
          // Defensive fallback for future unstructured data. Advisory only:
          // propagate to outer missing[] so the UI renders "⚠ GM-verify"
          // (v8.4.1 advisory-propagation fix), and don't block.
          missing.push(`(GM-verify) ${opt.text || ''}`);
          groupPassed = true;
          break;
        } else {
          // Unknown prereq type — advisory, same handling as notes.
          missing.push(`(GM-verify) ${JSON.stringify(opt)}`);
          groupPassed = true;
          break;
        }
      }
      if (!groupPassed) {
        missing.push(groupMissingReasons.join(' or '));
      }
    }
  }
  return {met: missing.length === 0, missing};
}
