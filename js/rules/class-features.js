// =============================================================================
// js/rules/class-features.js
// CLASS FEATURES — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Class features by level, per-day class abilities (rage,
//   bloodlust, euphoria, ...) and level-accrued class choices.
//
// KEY NAMES (so you can search for them)
//   functions (28): getActiveClassFeatures, evalBonusFeatFormula,
//   computeBonusFeatsFromClassFeatures, applyClassFeatureEffects,
//   berserkerLvl, bloodlusterLvl, bloodlusterInstances, rageTier,
//   rageUsesPerDay, wilderLvl, euphoriacBonus, buildClassFeatureSaveBonuses,
//   _cfLvlOf, computePerDiemAbilities, abilityUsed, classChoiceVal,
//   permanentPPSpent, menuClBonus, reconcileSpliceMP, heroTalentFlex,
//   computeClassChoiceSpecs, computeFavoredEnemies,
//   buildAdvancedClassSkillBonuses, buildClassChoiceBonuses,
//   expectedClassAttrBakes, reconcileClassAttrBakes,
//   buildClassFeatureRepBonuses, warmindBattleFocusMod
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/rules/02-class-features.js,
//   js/rules/03-feat-slots-and-caster-progression.js, js/rules/09-item-
//   effects-and-buffs.js, js/rules/14-resistances-speed-dr-size.js,
//   js/rules/15-combat-declarations-and-melee.js, js/rules/17-per-diem-and-
//   class-choices.js, js/rules/19-bonus-aggregator-and-stat-block.js when
//   the code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Get all class features ACTIVE on a character (i.e., feature.lvl ≤ class
// level for the relevant class). Returns array of:
//   {className, classLvl, feature: <feature entry>, kind, ...}
// in flat order — useful for sheet display + effect application.
function getActiveClassFeatures(c) {
  const out = [];
  const classArr = (c && c.classes && c.classes.length) ? c.classes : (c ? migrateLegacyClasses(c) : []);
  for (const e of classArr) {
    let features = CLASS_FEATURES[e.name];
    if (!features) continue;
    // v8.5.4: Druid Option swap — replace the traded Cleric features with
    // the Druid set (see DRUID_OPTION_FEATURES above).
    if (e.name === 'Cleric' && c && c.druidOption) {
      const traded = new Set(['Divine Spells', 'Turn or Rebuke Undead', 'Aura', 'Spontaneous Casting']);
      features = features.filter(f => !traded.has(f.name)).concat(DRUID_OPTION_FEATURES);
    }
    for (const f of features) {
      if ((e.level || 0) >= f.lvl) {
        out.push({className: e.name, classLvl: e.level, feature: f, kind: f.kind, name: f.name, page: f.page, desc: f.desc, effect: f.effect});
      }
    }
  }
  return out;
}

// Given a character, return the total extra feat slots granted by class
// features. Currently handles 'bonusFeats' effects (Expert + future classes).
//
// Each bonusFeats effect has a formula string that maps to a computation:
//   'expertOddLevels'  — ceil(classLvl/2): 1 at L1, 1 at L3, ..., 10 at L19
//   'everyEvenLvl'     — floor(classLvl/2): 1 at L2, 2 at L4, ..., 10 at L20
//   'everyOddLvl'      — ceil(classLvl/2): 1 at L1, 1 at L3, ...
//   'every4thLvl'      — floor(classLvl/4): 1 at L4, 2 at L8, ...
//   'fighterPattern'   — 1 + floor(L/2): 1 at L1, 2 at L2, 3 at L4, ... 11 at L20
//                        (Fighter Bonus Feat at L1, then every 2 levels)
//   'psionPattern'     — 1 + floor(L/5): 1 at L1, 2 at L5, 3 at L10, ... 5 at L20
//                        (Psion Bonus Feat at L1, 5, 10, 15, 20)
//   'wilderPattern'    — max(0, floor((L-1)/4)): 0 below L5, 1 at L5, 2 at L9, ...
//                        (Wilder Bonus Feat at L5, 9, 13, 17)
//   'every5thLvl'      — floor(L/5): 1 at L5, 2 at L10, ... 4 at L20 (Wizard)
//   {milestones:[4,12,20]} — count of milestones ≤ classLvl (Cleric pattern,
//                        any other irregular per-class schedule).
//   <number>           — literal count (rare)
//
// Single source-of-truth helper used by both
// computeBonusFeatsFromClassFeatures (totals) and getFeatSlotBreakdown
// (per-source detail). Returns the count of bonus feats granted by this
// effect.formula at the given classLvl.
function evalBonusFeatFormula(formula, classLvl) {
  if (typeof formula === 'number') return formula;
  // Milestones list: count entries at-or-below classLvl
  if (formula && typeof formula === 'object' && Array.isArray(formula.milestones)) {
    return formula.milestones.filter(m => classLvl >= m).length;
  }
  if (typeof formula !== 'string') return 0;
  switch (formula) {
    case 'expertOddLevels':
    case 'everyOddLvl':       return Math.ceil(classLvl / 2);
    case 'everyEvenLvl':      return Math.floor(classLvl / 2);
    case 'every4thLvl':       return Math.floor(classLvl / 4);
    case 'every5thLvl':       return Math.floor(classLvl / 5);
    case 'fighterPattern':    return 1 + Math.floor(classLvl / 2);
    case 'psionPattern':      return 1 + Math.floor(classLvl / 5);
    case 'wilderPattern':     return Math.max(0, Math.floor((classLvl - 1) / 4));
    default:                  return 0;
  }
}

// Returns total extra-feat-slot count from all class-feature sources.
function computeBonusFeatsFromClassFeatures(c) {
  if (!c) return 0;
  let total = 0;
  const features = getActiveClassFeatures(c);
  for (const f of features) {
    if (!f.effect || f.effect.type !== 'bonusFeats') continue;
    total += evalBonusFeatFormula(f.effect.formula, f.classLvl || 0);
  }
  return total;
}



// Currently handles:
//   - touchAcBonus → bumps c._touchAcBonus (used by computeACDisplay)
// The context object should be mutated in place; callers compute downstream
// values from it.
//
// The reason this is separate from computeACDisplay is to keep effect
// application orthogonal to display — same effects flow to PDF export,
// stat-breakdown tooltips, etc.
function applyClassFeatureEffects(c) {
  if (!c) return;
  const features = getActiveClassFeatures(c);
  let touchAcBonus = 0;
  for (const f of features) {
    if (!f.effect) continue;
    if (f.effect.type === 'touchAcBonus') {
      let value = 0;
      if (f.effect.source === 'attr:CHA-mod') {
        value = am(c.attrs[5] || 10);  // CHA is index 5
      } else if (f.effect.source === 'attr:DEX-mod') {
        value = am(c.attrs[1] || 10);
      } else if (f.effect.source === 'attr:INT-mod') {
        value = am(c.attrs[3] || 10);  // v8.9.1: Tactician Smart Defense
      } else if (typeof f.effect.source === 'number') {
        value = f.effect.source;
      }
      // Per HH semantics for these features (e.g. Wilder Elude Touch), the
      // bonus is meaningful only when positive — a Wilder with Cha 9 doesn't
      // gain a Touch AC bonus (and shouldn't take a penalty either).
      touchAcBonus += Math.max(0, value);
    }
  }
  c._touchAcBonus = touchAcBonus;
}
// v8.8.0 NULLIFIED (Adam's design): c.nullified suppresses ALL Supernatural
// modifiers — the character falls back to natural + Extraordinary. Wired
// through effAttrs (combat/casting/skills inherit), the DR pool
// (Bulletproof ×5 and Nigh-Invulnerable are Su super-talents), speed
// (Hyper-Speed), and Energy Immunity. Su effects beyond the wired systems
// (Buff super-powers, Su item effects, Ki Strike…) are the banner's GM line.
// v8.8.2 (Adam's ruling: "full toggle with baked modifiers"): RAGE. The
// Berserker's Rage is Ex — it flows through effective attributes exactly
// like item enhancements, and it is NOT suppressed by ⊘ Nullified. Tier by
// Berserker level (HH pp.79-80): +4 Str/Con (+2 Will morale, −2 AC);
// Greater @11: +6/+6/+3; Mighty @20: +8/+8/+4. Ending a Rage leaves the
// character Fatigued (−2 Str, −2 Dex, no charge/run) for the encounter —
// unless Tireless (17+). c.raging / c.fatigued are lazy flags.
function berserkerLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Berserker').reduce((s, e) => s + (e.level || 0), 0);
}
// v8.10.1: Bloodluster synergy (GMG p.159) — Improved Bloodlust instances
// (levels 2–9) count as Berserker levels for Rage uses (or as Wilder levels
// for Surge/Euphoriac/manifesting); Perfect Storm @10 grants Greater Rage
// with NO fatigue (or +1 Euphoriac and no Neuralgia).
function bloodlusterLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Bloodluster').reduce((s, e) => s + (e.level || 0), 0);
}
function bloodlusterInstances(c) { return Math.max(0, Math.min(bloodlusterLvl(c), 9) - 1); }
function rageTier(c) {
  const bsk = berserkerLvl(c);
  if (bsk <= 0) return null;
  const lvl = bsk + bloodlusterInstances(c);
  const perfectStorm = bloodlusterLvl(c) >= 10;
  return lvl >= 20 ? { attr: 8, will: 4, name: 'Mighty Rage' }
       : (lvl >= 11 || perfectStorm) ? { attr: 6, will: 3, name: 'Greater Rage' + (perfectStorm ? ' (Perfect Storm)' : '') }
       : { attr: 4, will: 2, name: 'Rage' };
}
function rageUsesPerDay(c) {
  const lvl = berserkerLvl(c);
  return lvl > 0 ? Math.min(6, 1 + Math.floor((lvl + bloodlusterInstances(c)) / 4)) : 0;
}
// v8.8.3 (Adam): EUPHORIAC (Ex, Wilder 4+, HH p.106) — after a wild surge
// (and no neuralgia), +1 morale on attack rolls, damage rolls, and saving
// throws for (surge intensity) rounds; +2 at Wilder 12, +3 at 20. Toggle
// c.euphoric — Ex, so it persists while ⊘ Nullified.
function wilderLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Wilder').reduce((s, e) => s + (e.level || 0), 0);
}
function euphoriacBonus(c) {
  const wl = wilderLvl(c);
  if (wl <= 0) return 0;
  // v8.10.1: Bloodluster instances count as Wilder levels; Perfect Storm +1.
  const lvl = wl + (bloodlusterInstances(c));
  const base = lvl >= 20 ? 3 : (lvl >= 12 ? 2 : (lvl >= 4 ? 1 : 0));
  return base + ((bloodlusterLvl(c) >= 10) ? 1 : 0);
}

// v8.8.2 (Adam's Basic-class pass): always-on class-feature SAVE bonuses,
// spliced into computeStatBlock's fort/ref/will lists. Conditional entries
// carry `condition` — the drilldown shows them; the total excludes them.
function buildClassFeatureSaveBonuses(c) {
  const out = { fort: [], ref: [], will: [] };
  const arr = migrateLegacyClasses(c);
  const lvlOf = (n) => arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  // Paladin Divine Grace (Su — suppressed while nullified) + Pious Grace.
  const pal = lvlOf('Paladin');
  if (pal >= 2 && !c.nullified) {
    const chaM = Math.max(1, am(effAttrs(c)[5]));
    const pious = pal >= 19 ? 2 : (pal >= 13 ? 1 : 0);
    const v = chaM + pious;
    const lbl = `Divine Grace (Cha bonus, min +1${pious ? `; +${pious} Pious Grace` : ''}) — Su`;
    for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:DivineGrace:' + k, value: v, label: lbl });
  }
  // Warmind Self-Control (Ex): +1 all saves per instance at 3/9/15.
  const wm = lvlOf('Warmind');
  const sc = wm >= 15 ? 3 : (wm >= 9 ? 2 : (wm >= 3 ? 1 : 0));
  if (sc) for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:SelfControl:' + k, value: sc, label: `Self-Control ×${sc} (Warmind — Ex)` });
  // Sorcerer Strong Personality: conditional, Fort & Will only.
  const sp = [2, 5, 9, 13, 17].filter(l => lvlOf('Sorcerer') >= l).length;
  if (sp) for (const k of ['fort', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:StrongPersonality:' + k, value: sp, label: `Strong Personality +${sp} (Sorcerer)`, condition: 'vs supernatural, magic, or psionic effects' });
  // Monk Still Mind: conditional Will.
  if (lvlOf('Monk') >= 3) out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:StillMind', value: 2, label: 'Still Mind (Monk)', condition: 'vs mind-affecting, while psionically focused' });
  // Trap Sense: conditional Ref — Rogue, Berserker, AND Explorer (v8.9.1;
  // Explorer's runs +1@2/+2@5/+3@8) instances STACK (book-explicit).
  const expL = lvlOf('Explorer');
  const expTS = expL >= 8 ? 3 : (expL >= 5 ? 2 : (expL >= 2 ? 1 : 0));
  const ts = Math.floor(lvlOf('Rogue') / 3) + Math.floor(lvlOf('Berserker') / 3) + expTS;
  if (ts) out.ref.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:TrapSense', value: ts, label: `Trap Sense +${ts}`, condition: 'vs traps (also +' + ts + ' dodge AC vs trap attacks)' });
  // v8.9.1 Advanced-class save/init features.
  out.init = out.init || [];
  if (expL >= 2) {
    const iv = Math.floor(expL / 2);
    if (iv) out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:Intrepid', value: iv, label: `Intrepid +${iv} morale (Explorer)`, condition: 'vs fear effects (also reduces fear one tier)' });
  }
  const srvL = lvlOf('Survivor');
  if (srvL >= 7) {
    const wv = Math.max(1, am(effAttrs(c)[4]));
    for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:UncannyInstincts:' + k, value: wv, label: `Uncanny Instincts +${wv} (Survivor — Wis, min +1)` });
    out.init.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:UncannyInstincts:init', value: wv, label: `Uncanny Instincts +${wv} (Survivor)` });
  }
  if (lvlOf('Soldier') >= 7) out.init.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:ImprovedReaction', value: 2, label: 'Improved Reaction +2 (Soldier — competence)' });
  const wmL2 = lvlOf('Weaponmaster');
  if (wmL2 >= 7) out.init.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:DeftDraw', value: Math.floor(wmL2 / 2), label: `Deft Draw +${Math.floor(wmL2 / 2)} (Weaponmaster)`, condition: 'when drawing the chosen weapon as a first-round action' });
  // v8.10.1 Prestige-class contributions.
  out.bab = out.bab || []; out.def = out.def || [];
  const asn = lvlOf('Assassin');
  if (asn >= 3 && asn < 9) {
    const pr = asn >= 7 ? 3 : (asn >= 5 ? 2 : 1);
    out.fort.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:PoisonResistance', value: pr, label: `Poison Resistance +${pr} (Assassin)`, condition: 'vs poison (immunity at Assassin 9)' });
  }
  if (lvlOf('Heavy') >= 5) out.fort.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:Dreadnaught', value: 4, label: 'Dreadnaught +4 (Heavy — equipment)' });
  if (lvlOf('Planestrider') >= 8) out.init.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:SenseOfTime', value: 2, label: 'Sense of Time +2 (Planestrider — insight)' });
  // Elementalist Affinity: +4 conditional vs the chosen element's types.
  const eleL = lvlOf('Elementalist');
  const eleVar = classChoiceVal(c, 'ele_var_1');
  if (eleL >= 1 && eleVar) {
    const types = { 'Ambrian (air/electricity)': 'electricity/ionic', 'Kryonian (water/cold)': 'cold/sonic', 'Vesuvian (fire/fire)': 'fire/heat', 'Vitrolian (earth/acid)': 'acid/disintegration' }[eleVar];
    for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:EleAffinity:' + k, value: 4, label: `Elemental Affinity (${eleVar.split(' ')[0]})`, condition: `vs ${types} spells and effects` });
  }
  // Loremaster Secrets: baked save picks; Anti-Hero choices: saves/BAB/Def.
  if (c.classChoices) {
    for (const k in c.classChoices) {
      const v = c.classChoices[k];
      if (k.startsWith('lm_sec_')) {
        if (/inner strength/.test(v)) out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 2, label: 'Secret: inner strength (Loremaster)' });
        if (/true stamina/.test(v)) out.fort.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 2, label: 'Secret: true stamina (Loremaster)' });
        if (/avoidance/.test(v)) out.ref.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 2, label: 'Secret: avoidance (Loremaster)' });
      }
      if (k.startsWith('ah_bh_')) {
        const sv = { 'Fortitude': 'fort', 'Reflex': 'ref', 'Will': 'will' }[v];
        if (sv) out[sv].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 1, label: `Battle-Hardened (Anti-Hero L${k.slice(6)})` });
      }
      if (k.startsWith('ah_ad_')) {
        if (v === '+1 Base Attack') out.bab.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 1, label: `Adaptable +1 BAB (Anti-Hero L${k.slice(6)})` });
        if (v === '+1 Defense Bonus') out.def.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 1, label: `Adaptable +1 Defense (Anti-Hero L${k.slice(6)})` });
      }
      // v8.11.1: Metamind Precog — +2 insight Reflex (AC note in the pick).
      if (k.startsWith('mm_mm_') && /^Precog/.test(String(v))) out.ref.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:' + k, value: 2, label: 'Precog +2 insight (Metamind — also +2 insight AC; lost with Dex to AC)' });
    }
  }
  // v8.8.3: familiar master perks — Rat +2 Fort, Weasel +2 Ref (HH p.110;
  // active while the familiar is within 1 mile — noted in the label).
  for (const comp of (c.companions || [])) {
    if (comp.kind !== 'familiar') continue;
    const p = FAMILIAR_PERKS[comp.species];
    if (p && p.save) out[p.save].push({ type: BONUS_TYPES.UNTYPED || 'untyped', source: 'companion:' + comp.id, value: p.v, label: `${comp.species} familiar — while within 1 mile` });
  }
  // v8.8.3: Fighter Battle-Hardened — +1 per instance to the PICKED save.
  if (c.classChoices) {
    const SVMAP = { 'Fortitude': 'fort', 'Reflex': 'ref', 'Will': 'will' };
    for (const k in c.classChoices) {
      if (!k.startsWith('ftr_bh_')) continue;
      const sv = SVMAP[c.classChoices[k]];
      if (sv) out[sv].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:BattleHardened:' + k, value: 1, label: `Battle-Hardened (Fighter L${k.slice(7)})` });
    }
  }
  // v8.8.3: Euphoriac's morale bonus to ALL saves while euphoric (Ex).
  if (c.euphoric) {
    const eb = euphoriacBonus(c);
    if (eb) for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:Euphoriac:' + k, value: eb, label: `Euphoriac +${eb} morale (Wilder — post-surge)` });
  }
  // v8.8.2: Rage's morale Will bonus while the toggle is active (Ex), plus
  // the Indomitable Intent conditional at Berserker 14+.
  if (c.raging) {
    const rt = rageTier(c);
    if (rt) {
      out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:RageWill', value: rt.will, label: `${rt.name} (+${rt.will} morale Will)` });
      if (lvlOf('Berserker') >= 14) out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:IndomitableIntent', value: 4, label: 'Indomitable Intent', condition: 'vs enchantment spells, while raging (stacks with the Rage morale bonus)' });
    }
  }
  return out;
}
// v8.64.0 (Phase 2 class-features sift): unified EVASION and UNCANNY DODGE
// sources — talents AND class features through one door each. Explorer 4 /
// Survivor 1 grant "Evasion (Improved if already owned)", so a second
// source upgrades them; Uncanny Dodge from a SECOND class auto-upgrades to
// Improved (HH, the Uncanny Dodge stacking rule beside the Tactician entry).
function _cfLvlOf(c, n) { return migrateLegacyClasses(c).filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0); }
// ============================================================================
// v8.8.2 PER-DIEM CLASS ABILITIES (Adam's rulings, 2026-09-02):
// use-counters per verified class feature; Tracker "☀ Fully Rested" restores
// daily defaults (per-WEEK abilities keep their count across days — renew via
// the per-ability GM ↻, for the roleplay events that rejuvenate one dimension
// without a full rest). Storage: c.abilityUses = {key: used} (lazy field).
// kind:'uses' counts activations; kind:'pool' counts points (LoH HP etc.).
// ============================================================================
function computePerDiemAbilities(c) {
  const out = [];
  const arr = migrateLegacyClasses(c);
  const lvlOf = (n) => arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  const eff = effAttrs(c);
  const chaM = am(eff[5]);
  const bsk = berserkerLvl(c);
  if (bsk >= 1) out.push({ key: 'rage', name: 'Rage', kind: 'uses', max: rageUsesPerDay(c), note: 'Once per encounter; free action on your own action (HH p.79).' });
  const pal = lvlOf('Paladin');
  if (pal >= 1) out.push({ key: 'smite', name: 'Smite Evil', kind: 'uses', max: 1 + [5, 10, 15, 20].filter(l => pal >= l).length, note: `One melee attack at +${Math.max(0, chaM)} (Cha) to hit, +${pal} damage vs an Evil target.` });
  if (pal >= 2) out.push({ key: 'layOnHands', name: 'Lay on Hands', kind: 'pool', max: pal * Math.max(1, chaM), note: 'HP pool per day — heal by touch (divisible), or damage undead via melee touch.' });
  if (pal >= 4) out.push({ key: 'turnUndeadPal', name: 'Turn Undead (Paladin)', kind: 'uses', max: 3 + chaM, note: `As a Cleric of level ${pal - 3}.` });
  if (pal >= 6) out.push({ key: 'removeDisease', name: 'Remove Disease', kind: 'uses', max: 1 + Math.floor((pal - 6) / 3), weekly: true, note: 'Per WEEK (not reset by daily rest). An instance may instead Lay on Hands for (level + Cha mod) HP.' });
  if (pal >= 16) out.push({ key: 'favorGods', name: 'Favor of the Gods', kind: 'uses', max: 1, note: 'Re-roll any d20; the second result stands.' });
  const clr = lvlOf('Cleric');
  if (clr >= 1 && !(c.druidOption)) out.push({ key: 'turnUndead', name: 'Turn or Rebuke Undead', kind: 'uses', max: 3 + chaM, note: '+2 on turning checks with 5+ ranks Knowledge (religion).' });
  const mnk = lvlOf('Monk');
  if (mnk >= 7) out.push({ key: 'wholeness', name: 'Wholeness of Body', kind: 'pool', max: mnk * 2, note: 'Self-heal HP pool per day, divisible.' });
  if (mnk >= 12) out.push({ key: 'abundantStep', name: 'Abundant Step', kind: 'uses', max: 1, note: `Dimension Door, CL ${Math.floor(mnk / 2)}.` });
  if (mnk >= 15) out.push({ key: 'quiveringPalm', name: 'Quivering Palm', kind: 'uses', max: 1, weekly: true, note: 'Per WEEK. Announce before the attack; must be focused.' });
  if (mnk >= 19) out.push({ key: 'emptyBody', name: 'Empty Body', kind: 'pool', max: mnk, note: 'Rounds of etherealness per day, divisible.' });
  const brd = lvlOf('Bard');
  if (brd >= 1) out.push({ key: 'bardicMusic', name: 'Bardic Music', kind: 'uses', max: brd, note: 'Each Countersong/Fascinate/Inspire… performance spends one (Suggestion is free).' });
  const wm = lvlOf('Warmind');
  if (wm >= 6) out.push({ key: 'mindOverMatter', name: 'Mind Over Matter', kind: 'uses', max: wm >= 18 ? 3 : (wm >= 12 ? 2 : 1), note: 'Second d20 on a defensive action, take the better; once per defensive action.' });
  // v8.8.3: the Rogue's Defensive Roll special ability, when picked.
  if (c.classChoices && Object.keys(c.classChoices).some(k => k.startsWith('rog_sa_') && c.classChoices[k] === 'Defensive Roll')) {
    out.push({ key: 'defensiveRoll', name: 'Defensive Roll', kind: 'uses', max: 1, note: 'When a blow would drop you to 0 or below: Dodge check DC = damage dealt to take half. Also usable by spending 1 AP.' });
  }
  const snt = lvlOf('Saint');
  if (snt >= 2) out.push({ key: 'miracle1', name: 'Miracle (1st-level)', kind: 'uses', max: 3, note: 'The chosen 1st-level domain spell/power as Su, or pay its point cost.' });
  if (snt >= 7) out.push({ key: 'miracle2', name: 'Miracle (2nd/3rd-level)', kind: 'uses', max: 2, note: 'The chosen 2nd/3rd-level domain spell/power as Su.' });
  if (snt >= 13) out.push({ key: 'miracle3', name: 'Miracle (4th–6th-level)', kind: 'uses', max: 1, note: 'The chosen 4th–6th-level domain spell/power as Su.' });
  if (snt >= 19) out.push({ key: 'trueMiracle', name: 'Miracle', kind: 'uses', max: 1, note: 'A true Miracle — deity/GM discretion; never costs XP.' });
  // v8.9.1 Advanced-class dailies — every "1/day, or spend an Action Point"
  // ability tracks its free daily use here (AP uses are extra, via the AP bar).
  const AP_NOTE = ' Extra uses cost 1 Action Point each.';
  const daily = (cls, min, key, name, note) => { if (lvlOf(cls) >= min) out.push({ key, name, kind: 'uses', max: 1, note: note + AP_NOTE }); };
  daily('Ace Pilot', 7, 'hotshot', 'Hotshot', 'Next vehicle/mount attack ignores hardness on a hit.');
  daily('Ace Pilot', 8, 'shootingStar', 'Shooting Star', 'Next vehicle/mount attack is an automatic threat on a hit.');
  if (lvlOf('Bodyguard') >= 4) out.push({ key: 'suddenAction', name: 'Sudden Action', kind: 'uses', max: 1, note: 'Move up in initiative by up to your Bodyguard level (declared at the start of a round).' });
  daily('Daredevil', 5, 'shrugItOff', 'Shrug It Off', 'Concentration check DC = incoming damage → take half.');
  daily('Daredevil', 8, 'shakeItOff', 'Shake It Off', 'Failed Will save → Concentration check vs the same DC to succeed instead.');
  daily('Daredevil', 10, 'letItOut', 'Let It Out', '2d20-take-better on a Str- or Dex-based skill check.');
  if (lvlOf('Explorer') >= 5 && lvlOf('Explorer') < 10) daily('Explorer', 5, 'extraStep', 'Extra Step', 'An extra 5-ft step, no AoO (at Explorer 10 this becomes at-will).');
  daily('Field Officer', 2, 'uncannySurvival', 'Uncanny Survival', '+½ class level Defense for 1 round (immediate).');
  daily('Field Officer', 5, 'veteranOfficer', 'Veteran Officer', 'Re-roll any combat d20 (second result stands).');
  daily('Infiltrator', 10, 'impromptuImprov', 'Impromptu Improv', 'Re-roll a failed Cha-based skill check.');
  daily('Investigator', 10, 'sixthSense', 'Sixth Sense', 'Treat a key investigative skill check as a natural 20.');
  daily('Marketeer', 7, 'utterlyConvincing', 'Utterly Convincing', '+1d6 on a Cha-based skill check (2d6 when stacked on an AP boost).');
  daily('Personality', 7, 'compellingPerf', 'Compelling Performance', 'One target: Despair/Hope/Rage for 1d4+1 rounds (Will negates).');
  daily('Personality', 10, 'ubiquitousFame', 'Ubiquitous Fame', 'Suggestion as an Ex ability (Reputation DC 20 first).');
  daily('Sharpshooter', 10, 'bullseye', 'Bullseye', '+20 to hit ignoring cover (before), or auto-threat +20 to confirm (after), with the Signature Weapon.');
  daily('Soldier', 4, 'tacticalAid', 'Tactical Aid', 'Allies in sight/voice (incl. you): +1 competence attack for ½ class level rounds.');
  daily('Soldier', 8, 'tacticalExpertise', 'Tactical Expertise', 'An additional move or standard action this round (free).');
  daily('Soldier', 10, 'walkItOff', 'Walk It Off', 'Swift: recover 25% of total HP (only at ≤50%).');
  daily('Survivor', 4, 'fightOrFlight', 'Fight or Flight', 'FIGHT: +4 to a physical attribute 1 min, or FLIGHT: Run ×5 movement 1 min; then Fatigued 1 min (Improved @8: two attributes / Run + Fleet of Foot, no fatigue).');
  if (lvlOf('Survivor') >= 10) out.push({ key: 'willToLive', name: 'Will to Live', kind: 'uses', max: 1, note: 'Delay a killing effect Wis-mod rounds, then Will DC 20 → Dying instead of Dead.' });
  daily('Tactician', 8, 'proact', 'Proact', 'Immediate: halve an attack’s damage (not while flat-footed/surprised).');
  // v8.10.1 Prestige-class dailies & pools.
  daily('Anti-Hero', 1, 'personalReasons', 'Personal Reasons', '+⅓ class level morale on all d20 & damage rolls, 5 + level rounds.');
  daily('Anti-Hero', 4, 'takeCharge', 'Take Charge', '+4 Initiative (immediate) or an extra move action.');
  daily('Anti-Hero', 6, 'comeback', 'Comeback', 'Move action: recover 25% HP (up to 50% total).');
  daily('Anti-Hero', 8, 'armyOfOne', 'Army of One', '+4 to a just-made save, or an extra standard action.');
  daily('Anti-Hero', 10, 'selfDetermination', 'Self-Determination', 'Re-roll any d20 (repeatable on the same roll for 1 AP each).');
  daily('Crusader', 4, 'divineAppeal', 'Divine Appeal', 'Second d20 on any roll, take the better.');
  daily('Crusader', 5, 'convert', 'Convert', '10 min + 5 PP: Diplomacy vs Will to convert an NPC.');
  const eleLpd = lvlOf('Elementalist');
  if (eleLpd >= 4) out.push({ key: 'eleNimbus', name: 'Elemental Nimbus', kind: 'uses', max: eleLpd >= 8 ? 2 : 1, note: 'DR 10/magic + element immunity + retaliation sheath, 1 min/level.' + AP_NOTE });
  daily('Elocater', 3, 'dimensionStep', 'Dimension Step', 'Dimension Door, self only (Dimensional Spring Attack @9 consumes this use).' );
  const eloL = lvlOf('Elocater');
  if (eloL >= 10) out.push({ key: 'accelAction', name: 'Accelerated Action', kind: 'pool', max: 5, note: 'Rounds of acceleration per day (extra attack / +30 ft / extra quick power; +2 dodge to attack, Reflex, AC).' });
  daily('Loremaster', 10, 'trueLore', 'True Lore', 'Legend Lore or Analyze Dweomer (1,000 XP for a Metafaculty).');
  if (lvlOf('Guildmember (Magic)') >= 1 || lvlOf('Guildmember (Psionic)') >= 1) out.push({ key: 'guildAccess', name: 'Guild Access', kind: 'uses', max: 1, note: 'Borrow one spell/power of level ≤ class level − 1 via Sending/Correspond.' });
  daily('Shadowjack', 8, 'walkingDatabase', 'Walking Database', 'Substitute the Computer Use modifier for a Knowledge check.');
  const shL = lvlOf('Super-Hero'), svL = lvlOf('Super-Villain');
  if (shL >= 1) {
    out.push({ key: 'useSuperPower', name: 'Use Super-Power', kind: 'uses', max: shL, note: 'Manifest a Super-Power at base cost for 0 super-PP.' + AP_NOTE });
    out.push({ key: 'heroicPurpose', name: 'Heroic Purpose', kind: 'uses', max: 1, note: 'Advantage (2d20 take better) on the next d20.' + AP_NOTE });
    if (shL >= 3) out.push({ key: 'resurgentHero', name: 'Resurgent Hero', kind: 'uses', max: 1, note: 'Standard action: recover 25% HP (up to 50% total).' + AP_NOTE });
  }
  if (svL >= 1) {
    out.push({ key: 'useSuperPower', name: 'Use Super-Power', kind: 'uses', max: svL, note: 'Manifest a Super-Power at base cost for 0 super-PP.' + AP_NOTE });
    out.push({ key: 'villainousIntent', name: 'Villainous Intent', kind: 'uses', max: 1, note: 'Contest a Hero’s AP d6 within 30 ft — cancel it and refund your AP on a tie or better.' + AP_NOTE });
    if (svL >= 3) out.push({ key: 'recurringVillain', name: 'Recurring Villain', kind: 'uses', max: 1, note: 'Extra end-of-turn move (movement only), +4 dodge vs AoOs.' + AP_NOTE });
  }
  const tmL = Math.max(lvlOf('Technomage'), lvlOf('Technopath'));
  if (tmL >= 1) {
    const eff2 = effAttrs(c);
    const mentals = am(eff2[3]) + am(eff2[4]) + am(eff2[5]);
    out.push({ key: 'technomancy', name: 'Technomancy Charges', kind: 'pool', max: tmL * tmL + Math.max(0, mentals), note: 'Charge pool = level² + Int/Wis/Cha mods; Degauss/Power Device 1, Dataread 2, Repair 4, Reboot 5, Shutdown 7, Ionic Bolt 8, Machine Master 10.' });
  }
  const trkL = Math.max(lvlOf('Arcane Trickster'), lvlOf('Psychic Trickster'));
  if (trkL >= 10) out.push({ key: 'tricksterPool', name: 'Trickster Pool (Consummate)', kind: 'uses', max: 5, note: 'Shared daily uses: Tricks of the Trade and/or Trick Attack in any mix.' });
  else if (trkL >= 1) {
    out.push({ key: 'tricksTrade', name: 'Tricks of the Trade', kind: 'uses', max: trkL >= 9 ? 3 : (trkL >= 5 ? 2 : 1), note: 'Disable Device / Sleight of Hand via Far Hand at 30 ft (+5 DC, ≤5 lb).' });
    if (trkL >= 3) out.push({ key: 'trickAttack', name: 'Trick Attack', kind: 'uses', max: trkL >= 7 ? 2 : 1, note: 'Declare one attack within 30 ft a sneak attack (target loses Dex to AC vs it).' });
  }
  return out;
}
function abilityUsed(c, key) { return (c.abilityUses && c.abilityUses[key]) || 0; }
function classChoiceVal(c, key) { return (c.classChoices || {})[key] || null; }
// Permanent PP spent per pool from the menu picks (live — clearing a pick
// refunds it; the GM ✕ is the retcon path).
function permanentPPSpent(c, poolName) {
  if (!c || !c.classChoices) return 0;
  let sum = 0;
  for (const k in c.classChoices) {
    // Stored values carry the " — N PP" cost suffix from the picker label.
    const v = String(c.classChoices[k] || '').replace(/ — \d+ PP$/, '');
    if (poolName === 'arcane' && k.startsWith('arc_ha_') && HIGH_ARCANA_COSTS[v] != null) sum += HIGH_ARCANA_COSTS[v];
    if (poolName === 'psionic' && k.startsWith('mm_mm_') && MENTAL_MASTERY_COSTS[v] != null) sum += MENTAL_MASTERY_COSTS[v];
  }
  return sum;
}
// Caster/manifester-level bonuses from Spell Power / Mental Potency picks.
function menuClBonus(c, poolName) {
  if (!c || !c.classChoices) return 0;
  let n = 0;
  for (const k in c.classChoices) {
    const v = c.classChoices[k] || '';
    if (poolName === 'arcane' && k.startsWith('arc_ha_') && /^Spell Power/.test(v)) n++;
    if (poolName === 'psionic' && k.startsWith('mm_mm_') && /^Mental Potency/.test(v)) n++;
    if (poolName === 'divine' && k.startsWith('ecc_gg_') && /^Spell Power/.test(v)) n++;
  }
  return n;
}
// v8.11.1: Splice Gene Therapy MP grants — reconciled into the MP economy's
// existing c.mpGrants channel (tagged; removed if the levels drop).
function reconcileSpliceMP(c) {
  if (!c) return false;
  const spl = migrateLegacyClasses(c).filter(e => e.name === 'Splice').reduce((s, e) => s + (e.level || 0), 0);
  if (!c.mpGrants) c.mpGrants = [];
  const TAGS = [[1, 'Splice 1 (Gene Therapy)'], [5, 'Splice 5 (Evolutionary Leap)']];
  let changed = false;
  for (const [lvl, tag] of TAGS) {
    const has = c.mpGrants.some(g => g.reason === tag);
    if (spl >= lvl && !has) { c.mpGrants.push({ amount: 10, reason: tag, atDate: new Date().toLocaleDateString() }); changed = true; }
    if (spl < lvl && has) { c.mpGrants = c.mpGrants.filter(g => g.reason !== tag); changed = true; }
  }
  return changed;
}
// v8.11.1: Anti-Hero / Super-Hero / Super-Villain "talent instead of feat"
// flex slots — each converted slot raises the talent budget and consumes a
// bonus-feat slot. Used only as needed to cover talent overage.
function heroTalentFlex(c) {
  const arr = migrateLegacyClasses(c);
  const lvlOf = (n) => arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  const ah = lvlOf('Anti-Hero');
  const base = ah >= 1 ? 1 : 0;  // the Anti-Hero's fixed 1st-level Talent
  let flexMax = 0;
  if (ah >= 1) flexMax += [3, 5, 7, 9].filter(m => ah >= m).length;
  for (const nm of ['Super-Hero', 'Super-Villain']) flexMax += [2, 4].filter(m => lvlOf(nm) >= m).length;
  return { base, flexMax };
}
function computeClassChoiceSpecs(c) {
  const specs = [];
  const arr = migrateLegacyClasses(c);
  const lvlOf = {};
  for (const e of arr) lvlOf[e.name] = (lvlOf[e.name] || 0) + (e.level || 0);
  const skillOpts = (filter) => SKILLS.filter(s => {
    if (filter === 'classSkill') return isClassSkill(s.n, c);
    if (filter === 'cha') return s.k === 'CHA';
    if (filter === 'int') return s.k === 'INT';
    if (filter === 'dex') return s.k === 'DEX';
    if (filter === 'knowledge') return s.family === 'Knowledge';
    if (filter === 'nonKnowledge') return s.family !== 'Knowledge';
    if (filter === 'mental') return s.k === 'INT' || s.k === 'WIS' || s.k === 'CHA';
    return true;
  }).map(s => s.n);
  for (const d of CLASS_CHOICE_DEFS) {
    const lvl = lvlOf[d.cls] || 0;
    if (lvl <= 0) continue;
    d.ms.forEach((m, i) => {
      if (lvl < m) return;
      const key = `${d.base}${m}`;
      let options;
      if (d.kind === 'pick') options = (d.options || []).slice();
      else if (d.kind === 'highArcana') options = Object.keys(HIGH_ARCANA_COSTS).map(o => `${o} — ${HIGH_ARCANA_COSTS[o]} PP`);
      else if (d.kind === 'mentalMastery') options = Object.keys(MENTAL_MASTERY_COSTS).map(o => `${o} — ${MENTAL_MASTERY_COSTS[o]} PP`);
      else if (d.kind === 'godlyGift') options = GODLY_GIFT_OPTIONS.slice();
      else if (d.kind === 'eleGA' || d.kind === 'eleEC') {
        const ev = classChoiceVal(c, 'ele_var_1');
        const vd = ev && ELEMENTAL_VARIANT_DATA[ev];
        options = vd ? (d.kind === 'eleGA' ? vd.ga.slice() : vd.ec.slice()) : [];
      }
      else if (d.kind === 'adaptable') options = ['+1 Base Attack', '+1 Defense Bonus'].concat(skillOpts('all'));
      else if (d.kind === 'skill') options = skillOpts(d.filter);
      else if (d.kind === 'weapon' || d.kind === 'weaponRanged' || d.kind === 'weaponMelee') {
        options = WEAPONS_CATALOG.filter(w => {
          if (d.kind === 'weaponRanged') return isRangedWeapon(w);
          if (d.kind === 'weaponMelee') return !isRangedWeapon(w);
          return true;
        }).map(w => w.name).sort();
      }
      else if (d.kind === 'save') options = ['Fortitude', 'Reflex', 'Will'];
      else if (d.kind === 'attr3') options = ['INT', 'WIS', 'CHA'];
      else if (d.kind === 'attr6') options = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
      else if (d.kind === 'enemy') options = RANGER_FE_TYPES;
      else if (d.kind === 'enemyEsc') options = computeFavoredEnemies(c).map(f => f.type);
      else if (d.kind === 'terrain') options = Object.keys(TERRAIN_MASTERY_DATA);
      else if (d.kind === 'rogueSA') options = Object.keys(ROGUE_SPECIAL_ABILITIES);
      else options = [];
      // distinct: exclude values already chosen by SIBLING instances.
      if (d.distinct && c.classChoices) {
        const taken = d.ms.filter(mm => mm !== m).map(mm => classChoiceVal(c, `${d.base}${mm}`)).filter(Boolean);
        options = options.filter(o => !taken.includes(o));
      }
      specs.push({ key, className: d.cls, feature: d.feature, idx: i + 1, atLvl: m, kind: d.kind,
        competence: !!d.competence, options, note: d.note, chosen: classChoiceVal(c, key) });
    });
  }
  return specs;
}
// Favored Enemy roster: types picked + 2 per escalation naming the type.
function computeFavoredEnemies(c) {
  const out = [];
  if (!c || !c.classChoices) return out;
  for (const k in c.classChoices) {
    if (k.startsWith('rgr_fe_') && c.classChoices[k]) out.push({ type: c.classChoices[k], bonus: 2 });
  }
  for (const k in c.classChoices) {
    if (k.startsWith('rgr_fesc_') && c.classChoices[k]) {
      const t = out.find(f => f.type === c.classChoices[k]);
      if (t) t.bonus += 2;
    }
  }
  return out;
}
// v8.9.1: AUTO class-level-scaled skill bonuses from verified Advanced-class
// features (no picks needed) → the skill misc pipeline. Each is a unique
// single-instance source; stacksAnyway keeps them from suppressing the
// choice-driven competence picks.
function buildAdvancedClassSkillBonuses(c) {
  const out = {};
  if (!c) return out;
  const arr = migrateLegacyClasses(c);
  const lvlOf = {};
  for (const e of arr) lvlOf[e.name] = (lvlOf[e.name] || 0) + (e.level || 0);
  const add = (skill, label, value, src, condition) => {
    if (!skill || !value) return;
    (out['skill:' + skill] = out['skill:' + skill] || []).push({ type: 'competence', stacksAnyway: true, source: src, value, label, condition: condition || null });
  };
  const amb = lvlOf['Ambassador'] || 0;
  if (amb >= 2) add('Diplomacy', 'Open Arms (Ambassador)', Math.floor(amb / 2), 'adv:openArms');
  if (amb >= 7) { add('Computer Use', 'Restricted Access (Ambassador)', 5, 'adv:restAccess1', 'vs computer security'); add('Research', 'Restricted Access (Ambassador)', 5, 'adv:restAccess2'); }
  const inf = lvlOf['Infiltrator'] || 0;
  if (inf >= 2) for (const s of ['Hide', 'Move Silently']) add(s, 'In the Wings (Infiltrator)', Math.floor(inf / 2), 'adv:wings:' + s);
  // v8.24.0 BUG FIX: 'Decipher Script' matched no skill key — the Steal the
  // Show bonus to the Decipher skill NEVER landed. The internal key is
  // 'Decipher Code' (displayed as Decipher Script at Tech Scale 0-4).
  if (inf >= 4) for (const s of ['Bluff', 'Decipher Code', 'Disguise', 'Forgery', 'Sleight of Hand']) add(s, 'Steal the Show (Infiltrator)', Math.floor(inf / 3), 'adv:sts:' + s);
  if (inf >= 5) for (const s of ['Balance', 'Climb', 'Jump', 'Swim', 'Tumble']) add(s, 'My Own Stuntman (Infiltrator)', inf >= 10 ? 2 : 1, 'adv:stunt:' + s);
  const mkt = lvlOf['Marketeer'] || 0;
  if (mkt >= 1) for (const s of ['Appraise', 'Diplomacy', 'Knowledge (Business)']) add(s, 'Shrewd Negotiator (Marketeer)', Math.floor(mkt / 2), 'adv:shrewd:' + s);
  if (mkt >= 4) add('Bluff', 'Conceal Motives (Marketeer)', Math.floor(mkt / 2), 'adv:conceal', 'vs Sense Motive');
  if (mkt >= 8 && (c.rep || 0) > 0) for (const s of ['Diplomacy', 'Gather Information']) add(s, 'Well-Connected (Marketeer — where recognized)', c.rep || 0, 'adv:wellconn:' + s);
  const inv = lvlOf['Investigator'] || 0;
  if (inv >= 1) add('Sense Motive', 'Profile (Investigator)', Math.ceil(inv / 2), 'adv:profile');
  const srv = lvlOf['Survivor'] || 0;
  if (srv >= 2) for (const s of ['Gamble', 'Sense Motive']) add(s, 'Gut Feeling (Survivor)', Math.floor(srv / 2), 'adv:gut:' + s);
  const dd = lvlOf['Daredevil'] || 0;
  if (dd >= 2) for (const s of ['Balance', 'Climb', 'Concentration', 'Drive', 'Escape Artist', 'Jump', 'Pilot', 'Ride', 'Swim', 'Tumble']) add(s, 'Growing Confidence (Daredevil)', Math.floor(dd / 2), 'adv:conf:' + s);
  const cm = lvlOf['Combat Medic'] || 0;
  if (cm >= 1) add('Treat Injury', 'Medical Specialist (Combat Medic)', cm >= 8 ? 3 : (cm >= 5 ? 2 : 1), 'adv:medspec');
  const ap = lvlOf['Ace Pilot'] || 0;
  if (ap >= 4) for (const s of ['Drive', 'Pilot', 'Ride']) add(s, 'Crackerjack Timing (Ace Pilot — maneuvers, needs 5+ ranks)', Math.floor(ap / 2), 'adv:cjt:' + s, 'maneuver checks only, 5+ ranks in the skill');
  const per = lvlOf['Personality'] || 0;
  if (per >= 1) for (const s of ['Diplomacy', 'Bluff']) add(s, 'Unlimited Access (Personality — event access)', per, 'adv:ua:' + s, 'to access private/invitation-only events');
  // v8.10.1 Prestige-class skill features.
  const cru = lvlOf['Crusader'] || 0;
  if (cru >= 2) for (const s of ['Diplomacy', 'Knowledge (Religion)']) add(s, 'Proselytize (Crusader)', Math.ceil(cru / 2), 'prs:pros:' + s);
  const sj = lvlOf['Shadowjack'] || 0;
  if (sj >= 2) for (const s of ['Bluff', 'Intimidate', 'Diplomacy', 'Gather Information']) add(s, 'Online Presence (Shadowjack)', sj, 'prs:online:' + s, 'in ONLINE interactions only');
  if (sj >= 3) for (const s of ['Computer Use', 'Disable Device', 'Repair']) add(s, 'Electronic Empathy (Shadowjack)', 2, 'prs:ee:' + s, 'crafting/repairing/disabling ELECTRONIC devices');
  return out;
}
// Competence + terrain skill bonuses from choices → the skill misc pipeline.
function buildClassChoiceBonuses(c) {
  const out = {};
  if (!c || !c.classChoices) return out;
  const add = (skill, label, value, src) => {
    if (!skill) return;
    (out['skill:' + skill] = out['skill:' + skill] || []).push({ type: 'competence', stacksAnyway: true, source: src, value, label });
  };
  for (const s of computeClassChoiceSpecs(c)) {
    if (!s.chosen) continue;
    if (s.kind === 'skill' && s.competence) add(s.chosen, `${s.feature} #${s.idx} (${s.className})`, 1, s.key);
    if (s.kind === 'terrain') { const td = TERRAIN_MASTERY_DATA[s.chosen]; if (td && td.skill) add(td.skill, `Terrain Mastery: ${s.chosen} (Ranger)`, 4, s.key); }
    // v8.10.1: Trickster Trade Secrets (+2 insight, self-stacking) and the
    // Anti-Hero's Adaptable skill option (+1 competence, self-stacking).
    if (s.key.startsWith('atk_ts_') || s.key.startsWith('ptk_ts_')) add(s.chosen, `Trade Secrets (Trickster, insight)`, 2, s.key);
    if (s.kind === 'adaptable' && s.chosen !== '+1 Base Attack' && s.chosen !== '+1 Defense Bonus') add(s.chosen, `Adaptable (Anti-Hero — now a class skill too)`, 1, s.key);
  }
  return out;
}

// ---- Class-feature ATTRIBUTE BAKES (Ex, permanent; ledgered like the talent
// bakes; NOT nullified-suppressed). Sources: Psion Profound Realization
// (+1 Int @6/12/18), Warmind Self-Control (+1 Wis @3/9/15) & Self-Mastery
// (+1 Wis @19), Aristocrat Mental Acuity picks, Saint True Sainthood pick.
function expectedClassAttrBakes(c) {
  const exp = [0, 0, 0, 0, 0, 0];
  const arr = migrateLegacyClasses(c);
  const lvlOf = (n) => arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  const psi = lvlOf('Psion');
  exp[3] += [6, 12, 18].filter(m => psi >= m).length;
  const wm = lvlOf('Warmind');
  exp[4] += [3, 9, 15].filter(m => wm >= m).length + (wm >= 19 ? 1 : 0);
  // v8.10.1: Shadowjack Living Library (+1 Int @9, Ex).
  if (lvlOf('Shadowjack') >= 9) exp[3] += 1;
  const IDX = { STR: 0, DEX: 1, CON: 2, INT: 3, WIS: 4, CHA: 5 };
  if (c.classChoices) {
    for (const k in c.classChoices) {
      // Milestone gate: a level DROP orphans the choice key — its bake must
      // lift with the level (the key's suffix is the granting class level).
      if (k.startsWith('ari_ma_') && IDX[c.classChoices[k]] != null && lvlOf('Aristocrat') >= parseInt(k.slice(7), 10)) exp[IDX[c.classChoices[k]]] += 1;
      if (k.startsWith('snt_ts_') && IDX[c.classChoices[k]] != null && lvlOf('Saint') >= parseInt(k.slice(7), 10)) exp[IDX[c.classChoices[k]]] += 4;
    }
  }
  return exp;
}
function reconcileClassAttrBakes(c) {
  if (!c || !c.attrs) return false;
  const exp = expectedClassAttrBakes(c);
  const applied = c.classAttrApplied || [0, 0, 0, 0, 0, 0];
  let changed = false;
  for (let i = 0; i < 6; i++) {
    if (exp[i] !== applied[i]) { c.attrs[i] += exp[i] - applied[i]; changed = true; }
  }
  if (changed) c.classAttrApplied = exp;
  return changed;
}

// v8.64.0 (Phase 2 class-features sift): class-feature REPUTATION bonuses —
// the same typed door as the Renown feat's {target:'rep', value:3}. The
// paired Wealth halves stay MANUAL by doctrine (Wealth is a snapshot).
function buildClassFeatureRepBonuses(char) {
  const L = (n) => migrateLegacyClasses(char).filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  const out = [];
  if (L('Bard') >= 19) out.push({ type: 'untyped', source: 'classFeature:Magnum Opus', value: 3, label: 'Magnum Opus (Bard 19 — Renown-equivalent; +2 circumstance on Cha skills with those who know the ballad, at the table)' });
  if (L('Aristocrat') >= 19) out.push({ type: 'untyped', source: 'classFeature:Land & Title', value: 1, label: 'Land & Title (Aristocrat 19 — the +4 Wealth and Steward are manual)' });
  if (L('Personality') >= 4) out.push({ type: 'untyped', source: 'classFeature:A-Lister', value: 1, label: 'A-Lister (Personality 4 — the +2 Wealth is manual)' });
  if (L('Personality') >= 8) out.push({ type: 'untyped', source: 'classFeature:Royalty', value: 1, label: 'Royalty (Personality 8 — the +2 Wealth and entourage are manual)' });
  return out;
}

// v8.5.4: Warmind Battle Focus — the Psionic Scale 0 variant (HH Warmind
// table: "Psionics or Battle Focus +N" at class levels 1/4/7/10/13/16).
// While psionically focused, the Warmind gains HALF the Battle Focus
// modifier (rounded up) to hit, damage, dodge, and parry; they may EXPEND
// the focus to apply the FULL modifier to any single roll. Combat-state
// mechanic, so it lives on the Tracker beside the AP bar; c.battleFocused
// holds the current focus state.
function warmindBattleFocusMod(c) {
  if ((((c && c.sixLevels) || {}).psionic ?? 0) !== 0) return 0;
  const lvl = migrateLegacyClasses(c || {}).filter(e => e.name === 'Warmind')
    .reduce((s, e) => s + (e.level || 0), 0);
  return [1, 4, 7, 10, 13, 16].filter(m => m <= lvl).length;
}
