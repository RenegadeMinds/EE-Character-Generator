// =============================================================================
// js/rules/defenses-and-movement.js
// DEFENSES AND MOVEMENT — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Resistances, spell resistance, damage reduction, mutant
//   subtypes, evasion and uncanny dodge, AC/parry/dodge, carrying capacity,
//   speeds, massive and nonlethal damage thresholds.
//
// KEY NAMES (so you can search for them)
//   functions (21): parryingHeldBonus, computeResistances, computeSR,
//   computeDR, reconcileMutantSubtype, buildMutantSubtypeLanes,
//   strongSuperTalentsOwned, hasSupremeEffort, computeHardnessIgnore,
//   fmtCarry, carryTriplet, computeCarryCapacity, computeSpeeds,
//   evasionTier, uncannyDodgeTier, defenseRiders, computeACDisplay,
//   computeParryBonus, computeDodgeBonus, mdtThreshold, nlStatus
//
// WHERE IT CAME FROM
//   Gathered from js/app/46-create-preview-and-defense.js,
//   js/app/65-tracker-logs-and-damage.js, js/rules/10-minds-ledger-and-
//   magic-browser.js, js/rules/14-resistances-speed-dr-size.js,
//   js/rules/15-combat-declarations-and-melee.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v9.7.0 (§257): +1 insight per held Parrying weapon (typed: two Parrying
// blades still grant +1 — insight does not self-stack).
function parryingHeldBonus(c) {
  return getCharItems(c).some(it => it.catalogue === 'weapon' && it.equipped && it.enchant && (it.enchant.abilities || []).includes('Parrying')) ? 1 : 0;
}
function computeResistances(c) {
  const resists = {};  // type → {value, source}
  const immune = {};   // type → source
  const better = (t, v, src) => { if (!resists[t] || v > resists[t].value) resists[t] = { value: v, source: src }; };
  // v8.16.0 Races pass: racial energy resistances (Tiefling/Aasimar 5s,
  // Janni fire 10, Kinori cold 20) and immunities (Elf sleep, Duergar
  // poison/paralysis, Azer fire, Doppelganger sleep/charm, Grimlock gaze…)
  // — the best-wins / immunity-supersedes engine handles the rest.
  // v8.68.0: Hybrids carry BOTH parents' resistances & immunities (the
  // best-wins / immunity-supersedes engine reconciles overlaps).
  const _hy = hybridInfo(c);
  const _rrList = _hy ? [[_hy.A, _hy.a + ' racial (Hybrid)'], [_hy.B, _hy.b + ' racial (Hybrid)']] : [[RACES[(c && c.race)] || {}, `${c.race} racial`]];
  for (const [_rr, _rrSrc] of _rrList) {
    for (const t in (_rr.resist || {})) better(t, _rr.resist[t], _rrSrc);
    for (const t of (_rr.immune || [])) if (!immune[t]) immune[t] = _rrSrc;
  }
  // Talents (channels carry resolved values).
  const bon = buildTalentBonuses(c) || {};
  for (const key in bon) {
    if (!key.startsWith('energyResistance:')) continue;
    const raw = key.split(':')[1];
    const t = /sonic/i.test(raw) ? 'sonic' : raw.toLowerCase();
    const v = (bon[key] || []).reduce((m, b) => Math.max(m, b.value || 0), 0);
    if (v > 0) better(t, v, `${raw} Resistance talent`);
  }
  // Energy Immunity: immune to each type whose Resistance talent is owned.
  const talentNames = new Set((c.talents || []).map(t => t.name || t.n || t));
  // Energy Immunity is a Su super-talent — suppressed while nullified; the
  // base Resistance talents are Ex and persist.
  if (talentNames.has('Energy Immunity') && !c.nullified) {
    const MAP = { 'Acid Resistance': 'acid', 'Cold Resistance': 'cold', 'Electricity Resistance': 'electricity', 'Fire Resistance': 'fire', 'Sonic/Concussion Resistance': 'sonic' };
    for (const tn in MAP) if (talentNames.has(tn)) immune[MAP[tn]] = 'Energy Immunity (Super-Tough)';
  }
  // Mutations (types chosen at acquisition; legacy records without a choice
  // surface as a GM note via the panel).
  for (const m of (c.mutations || [])) {
    if ((m.name === 'Energy Absorption' || m.name === 'Energy Diffusion') && m.energyTypes && m.resistEach) {
      for (const t of m.energyTypes) better(t, m.resistEach, m.name);
    }
  }
  // v9.2.2 (Adam's ruling): Ultra Immune System turns ability DRAIN into
  // ability DAMAGE — flagged here so the player sees it with the defenses.
  if ((c.feats || []).some(f => (f.name || f.n) === 'Ultra Immune System')) immune['ability drain'] = immune['ability drain'] || 'Ultra Immune System — permanent ability drain is taken as temporary ability DAMAGE instead (HH p.250)';
  // v9.2.0: gear — the active Energy shield's chosen type; worn/active immunities.
  for (const a of ((c.activeEffects || []).filter(x => x.gear))) for (const e of a.effects) {
    if (e.k === 'resist' && e.energy) better(e.energy, e.v, `${a.name} (active)`);
    if (e.k === 'immune') immune[e.what] = immune[e.what] || `${a.name} (active)`;
  }
  for (const it of (wornGearOf(c))) for (const x of (gearDef(it).worn.immune || [])) immune[x] = immune[x] || `${it.ref} (worn)`;
  // Enchanted armor/shield resistance abilities on equipped pieces.
  const ABILITY_VALS = { '': 10, ', Improved': 20, ', Greater': 30 };
  for (const it of getCharItems(c)) {
    if (!it.equipped) continue;
    for (const a of ((it.enchant && it.enchant.abilities) || [])) {
      const am2 = /^(Acid|Cold|Electricity|Fire|Sonic) Resistance(, Improved|, Greater)?$/.exec(a);
      if (am2) better(am2[1].toLowerCase(), ABILITY_VALS[am2[2] || ''], `${a} (${enchantDisplayName(it)})`);
    }
    if (it.catalogue === 'magic' && it.ref === 'Energy Resistance' && it.energyType) {
      better(it.energyType, 10, 'Ring of Energy Resistance');
    }
  }
  // v8.8.2 (Adam's Basic-class pass): CONDITION immunities from verified
  // class features join the panel. Ex immunities persist while nullified;
  // Su ones (Aura of Courage's fear immunity, Diamond Body) are suppressed.
  {
    const _arr = migrateLegacyClasses(c);
    const _lvl = (n) => _arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
    const pal = _lvl('Paladin'), mnk = _lvl('Monk');
    if (pal >= 3) immune['disease'] = 'Divine Health (Paladin — ALL diseases, incl. supernatural/magical; Ex)';
    else if (mnk >= 5) immune['disease'] = 'Purity of Body (Monk — nonmagical diseases only; Ex)';
    if (pal >= 3 && !c.nullified) immune['fear'] = 'Aura of Courage (Paladin — while conscious; allies within 10 ft +4 morale vs fear; Su)';
    if (mnk >= 11 && !c.nullified) immune['poison'] = 'Diamond Body (Monk — poisons of all kinds; Su)';
    // v8.8.3: Ranger Terrain Mastery (Desert) — fatigue immunity (Ex).
    if (c.classChoices && Object.keys(c.classChoices).some(k => k.startsWith('rgr_tm_') && c.classChoices[k] === 'Desert')) {
      immune['fatigue'] = 'Terrain Mastery: Desert (Ranger — what would exhaust you fatigues you instead; Ex)';
    }
    // v8.9.1: Explorer 10 Fearless — effective fear immunity (Ex).
    if (_lvl('Explorer') >= 10) immune['fear'] = immune['fear'] || 'Fearless (Explorer — effectively immune; allies within 30 ft +2 morale vs fear; Ex)';
    // v8.10.1 Prestige-class immunities & resistances.
    if (_lvl('Anti-Hero') >= 1) immune['fear'] = immune['fear'] || 'Personal Reasons (Anti-Hero — immune to fear’s negative morale, incl. Fear itself; note: never gains others’ morale bonuses either)';
    if (_lvl('Heavy') >= 5) immune['fear'] = immune['fear'] || 'Dreadnaught (Heavy — cybernetic resolve; also ignores critical hits)';
    if (_lvl('Assassin') >= 9) immune['poison'] = immune['poison'] || 'Poison Immunity (Assassin — fully inured; Ex)';
    const eleL2 = _lvl('Elementalist');
    const eleV2 = classChoiceVal(c, 'ele_var_1');
    if (eleL2 >= 2 && eleV2) {
      const elType = { 'Ambrian (air/electricity)': 'electricity', 'Kryonian (water/cold)': 'cold', 'Vesuvian (fire/fire)': 'fire', 'Vitrolian (earth/acid)': 'acid' }[eleV2];
      if (elType) {
        if (eleL2 >= 6) immune[elType] = `Elemental Immunity (Elementalist ${eleV2.split(' ')[0]} — permanent; Ex)`;
        else better(elType, 10, `Elemental Adaptation (Elementalist ${eleV2.split(' ')[0]})`);
      }
    }
    // Planestrider Extreme Terrain resistances (20 per chosen terrain).
    if (c.classChoices && _lvl('Planestrider') >= 1) {
      const PT = { 'Cold': 'cold', 'Caustic': 'acid', 'Fiery': 'fire', 'Lightning Storms': 'electricity' };
      for (const k in c.classChoices) {
        if (k.startsWith('pls_tm_') && PT[c.classChoices[k]]) better(PT[c.classChoices[k]], 20, `Extreme Terrain Mastery: ${c.classChoices[k]} (Planestrider)`);
      }
    }
  }
  // Immunity supersedes resistance.
  for (const t in immune) delete resists[t];
  const universal = ENERGY_TYPES.every(t => immune[t] || (resists[t] && resists[t].value > 0));
  return { resists, immune, universal };
}

// v8.8.2 (Adam's Basic-class pass): SPELL RESISTANCE — a battle-dashboard
// metric. Best-wins across sources (SR doesn't stack). Diamond Soul is Ex
// (persists while nullified); the Mantle is a worn magic item.
function computeSR(c) {
  const entries = [];
  const _arr = migrateLegacyClasses(c);
  const mnk = _arr.filter(e => e.name === 'Monk').reduce((s, e) => s + (e.level || 0), 0);
  if (mnk >= 13) entries.push({ value: mnk + 10, source: `Diamond Soul (Monk ${mnk} + 10; Ex)` });
  // v8.16.0 Races pass: racial SR (Drow 11+level, Azer 13+level, Hound
  // Archon 16+level, Ogre Mage flat 19) — best-wins like every SR source.
  // v8.68.0: Hybrids carry both parents' SR — best-wins resolves.
  const _hySR = hybridInfo(c);
  for (const [_rsr, _srSrc] of (_hySR ? [[_hySR.A.sr, _hySR.a], [_hySR.B.sr, _hySR.b]] : [[(RACES[c.race] || {}).sr, c.race]])) {
    if (_rsr) {
      const v = _rsr.base + (_rsr.perLevel ? (c.totalLvl || 1) : 0);
      entries.push({ value: v, source: `${_srSrc} racial SR ${_rsr.base}${_rsr.perLevel ? ' + level' : ''}` });
    }
  }
  for (const it of getCharItems(c)) {
    if (it.equipped && it.catalogue === 'magic' && it.ref === 'Mantle of Spell Resistance') {
      entries.push({ value: 21, source: 'Mantle of Spell Resistance (SR 21)' });
    }
  }
  if (!entries.length) return null;
  entries.sort((a, b) => b.value - a.value);
  return { total: entries[0].value, source: entries[0].source,
    note: entries.length > 1 ? `Best of: ${entries.map(e => `${e.value} (${e.source})`).join('; ')} — SR never stacks.` : entries[0].source };
}

// ============================================================================
// v8.8.0 DAMAGE REDUCTION (Adam's pass, 2026-09-02). Semantics per the books:
// DR reads value/bypass — the bypass names what IGNORES it ("—" = nothing
// does; "magic", "bludgeoning", "psionics"…). DR from different sources does
// NOT stack: the best applicable instance applies per attack (GMG states
// the principle; each entry displays separately with provenance). Explicit
// STACKING exceptions per book text are folded in: the Daredevil's Tough It
// Out "+1, stacks with any instances of Damage Reduction from Tough Hero".
// Sources wired:
//   • Tough Hero DR talent tree (1..3/−, cumulative) ×5 with Bulletproof,
//     then Nigh-Invulnerable's +5 (minimum 5/−) — one pooled entry,
//     vs melee & ranged weapons;
//   • + Daredevil 4+ Tough It Out (+1, stacks into that pool);
//   • Berserker class feature: 1/− at 7th, +1 at 10/13/16/19 — its own
//     entry (vs weapons & natural attacks; best-wins vs the talent pool);
//   • Skeletal Reinforcement mutation: 3/bludgeoning;
//   • Mental Resistance feat: mental DR 3/− vs attribute damage (special);
//   • Invulnerability armor ability (equipped): 10/magic;
//   • converted specifics (Dwarven Plate 3/—, Adamantine Breastplate 2/—);
//   • Force Barrier mutation: 3/− vs weapons — ACTIVATED, listed as
//     conditional. Cast-time DR (Biofeedback, Stoneskin…) stays manual.
// ============================================================================
// v8.8.0 AMENDMENT (Adam's ruling, 2026-09-02 — HH book edit on the TODO):
// UNIVERSAL Damage Reduction (x/− — never ignored) STACKS across ALL
// sources into one pool. Bulletproof multiplies the SUMMED pool ×5 (all
// singular modifiers added first); Nigh-Invulnerable's +5 adds AFTER the
// multiplier (never add-then-multiply). Keeps the math in multiples of 5
// past the first 10 — aligned with Resistances/Hardness and the Dice &
// Capital Dice combat-resolution ladder. Typed DR (x/bludgeoning, x/magic,
// mental) stays separate, best-per-attack.
function computeDR(c) {
  const entries = [];
  const bon = buildTalentBonuses(c) || {};
  // v8.15.4 — REFINED per Adam's PRINTED amendment (FF p.523, 2026-09-03
  // edition): "The only exception is Universal Damage Reduction … gained
  // through class levels; all sources of Universal Damage Reduction earned
  // through class level progression stack." The pool therefore takes ONLY
  // class-level sources (Hero talent tiers — talents are class abilities —
  // Berserker, Daredevil; Bulletproof/Nigh-Invulnerable are class-earned
  // super-talents). Item, mutation, and POWER x/− (the book's own example:
  // Biofeedback) are separate best-in-situation instances.
  let pool = 0; const srcs = [];
  // Tough Hero DR tiers (excluding Nigh-Invulnerable's +5 — it applies post-mult).
  const tierSum = (bon.dr || []).filter(b => !/Nigh/i.test(b.label || '')).reduce((s, b) => s + (b.value || 0), 0);
  if (tierSum) { pool += tierSum; srcs.push(`Tough Hero DR tiers +${tierSum}`); }
  const ddLvl = migrateLegacyClasses(c).filter(e => e.name === 'Daredevil').reduce((s, e) => s + (e.level || 0), 0);
  if (ddLvl >= 4) { pool += 1; srcs.push('Tough It Out +1 (Daredevil)'); }
  const bLvl = migrateLegacyClasses(c).filter(e => e.name === 'Berserker').reduce((s, e) => s + (e.level || 0), 0);
  if (bLvl >= 7) { const v = 1 + Math.floor((bLvl - 7) / 3); pool += v; srcs.push(`Berserker ${bLvl} +${v}`); }
  // Bulletproof multiplies the summed pool; Nigh-Invulnerable adds after.
  // Both are Su super-talents — NULLIFIED suppresses them (Adam's design).
  const mult = (c.nullified) ? 0 : (bon.drMult || []).reduce((m, b) => Math.max(m, b.value || 0), 0);
  if (mult > 1 && pool > 0) { pool *= mult; srcs.push(`summed ×${mult} (Bulletproof)`); }
  const nigh = (c.nullified) ? 0 : (bon.dr || []).filter(b => /Nigh/i.test(b.label || '')).reduce((s, b) => s + (b.value || 0), 0);
  if (nigh) { pool += nigh; srcs.push(`+${nigh} after the multiplier (Nigh-Invulnerable)`); }
  if (c.nullified) srcs.push('⊘ Su components suppressed (nullified)');
  if (pool > 0) entries.push({ value: pool, bypass: '—', source: srcs.join(' · '), note: 'UNIVERSAL class-level pool — x/− from class progression stacks (FF p.523); non-class x/− sources below are best-in-situation instead' });
  // v8.15.4: item x/− is NOT class-level progression — separate instances,
  // best applicable per attack (FF p.523).
  for (const it of getCharItems(c)) {
    if (!it.equipped) continue;
    if (it.customName === 'Dwarven Plate') entries.push({ value: 3, bypass: '—', source: 'Dwarven Plate', note: 'item x/− — does not stack with the class pool (FF p.523); best applicable applies' });
    if (it.customName === 'Adamantine Breastplate') entries.push({ value: 2, bypass: '—', source: 'Adamantine Breastplate', note: 'item x/− — does not stack with the class pool (FF p.523); best applicable applies' });
  }
  // v8.16.0 Races pass: racial DR (Gargoyle 10/magic, Pixie 10/cold iron,
  // Satyr 5/cold iron, Rakshasa 15/good & piercing, Werewolf 10/silver in
  // hybrid form…) — typed instances, best-per-attack; never part of the
  // class-level x/− pool (FF p.523).
  // v8.68.0: Hybrids carry both parents' DR instances (best-applicable rules).
  const _hyDR = hybridInfo(c);
  for (const [_rdr, _drSrc] of (_hyDR ? [[_hyDR.A.dr, _hyDR.a], [_hyDR.B.dr, _hyDR.b]] : [[(RACES[c.race] || {}).dr, c.race]])) {
    if (_rdr) entries.push({ value: _rdr.value, bypass: _rdr.bypass, source: `${_drSrc} racial`, conditional: _rdr.conditional || undefined });
  }
  // v8.86.0 (Adam's Son-of-the-Sun report): DR from the ✨/◉ lanes — the
  // k:'dr' entries of transient casts and perpetual Buffs (suppressed /
  // superseded perpetuals already filtered by _buffEffectSources). Live
  // instances, best-applicable per FF p.523; NPF suppresses the lot.
  {
    for (const a of _buffEffectSources(c).filter(x => !c.nullified || x.gear)) {   // v9.2.0: gear DR stands in an NPF
      for (const e of (a.effects || [])) {
        if (e.k !== 'dr') continue;
        const spec = (POWER_EFFECTS[a.name]);
        entries.push({ value: e.v, bypass: e.bypass || '—',
          source: `${a.name} ${a.perpetual ? '(◉ perpetual Buff)' : (a.gear ? '(⚡ active gear — item x/−)' : '(✨ active power)')}`,
          note: (spec && spec.note) || undefined });
      }
    }
  }
  // v8.15.4: Biofeedback — the book's OWN non-stacking example. Shown as a
  // conditional instance when the power is in a CASTING repertoire (the
  // super-pool route stands perpetually via the ◉ lane above, v8.86.0).
  if (getCharPowers(c).some(p => p.name === 'Biofeedback' && p.pool !== 'super') && !(c.activeEffects || []).some(a => a.name === 'Biofeedback')) entries.push({ value: 2, bypass: '—', source: 'Biofeedback (manifested)', conditional: 'while manifested — DR 2/− (+1 per 3 extra PP augmented); does NOT stack with the class-level pool (FF p.523): the best applicable applies' });
  // Conditional universal from a mutation — likewise NOT class progression:
  // a separate instance while active (was "stacks into the pool" pre-v8.15.4).
  if ((c.mutations || []).some(m => m.name === 'Force Barrier')) entries.push({ value: 3, bypass: '—', source: 'Force Barrier', conditional: 'while the barrier is up (free action, 3/day, Con-mod rounds; vs weapon attacks & force effects) — mutation x/−: does not stack with the class pool (FF p.523), best applicable applies' });
  // Typed / special DR: separate entries, best-per-attack.
  if ((c.mutations || []).some(m => m.name === 'Skeletal Reinforcement')) entries.push({ value: 3, bypass: 'bludgeoning', source: 'Skeletal Reinforcement' });
  // v8.91.0: Fortified Skeleton (cybernetic implant, HH p.337) — DR 4/—.
  // An implant instance: does not stack with the class pool (FF p.523).
  if (getCyber(c).some(r => r.n === 'Fortified Skeleton')) entries.push({ value: 4, bypass: '—', source: 'Fortified Skeleton (cybernetic)', note: 'implant x/− — does not stack with the class pool (FF p.523); best applicable applies' });
  if ((c.feats || []).some(f => (f.name || f.n) === 'Mental Resistance')) entries.push({ value: 3, bypass: '—', source: 'Mental Resistance feat', note: 'MENTAL — vs attribute damage only (not part of the physical pool)' });
  for (const it of getCharItems(c)) {
    if (!it.equipped) continue;
    if (((it.enchant && it.enchant.abilities) || []).includes('Invulnerability')) entries.push({ value: 10, bypass: 'magic', source: `Invulnerability (${enchantDisplayName(it)})` });
  }
  return entries;
}
// v8.8.0 (Adam's Talents sweep): Robust's retroactive +1 HP/level bakes into
// maxHP via a delta ledger (c.talentHpApplied — the mutNacHpApplied pattern:
// NOT preserved across edit-saves; the assembly recomputes maxHP from the
// form and this reconciler re-applies onto the fresh value). Called from
// talent add/remove, level-up, the edit-save path, and a renderSheet guard.
// v8.67.0 (MUTANT SYNC — Adam's rulings, 2026-10-02): the Mutant subtype's
// UNNATURAL PROWESS and UNNATURAL RESILIENCE (HH p.29), previously entirely
// unwired. All Extraordinary (racial physiology — Null Power Field proof).
// Per +1 Mutant level: +2 skill points (Tech-0, budget-integrated) and
// +(5 + Con mod) HP. Per +2: +1 Base Attack (REAL printed BA — it mints
// iteratives at thresholds, ruled book-intended) and +1 ALL saves. Per +3:
// +1 Defense Bonus. BA/Def/HP BAKE via this delta ledger (the
// mutNacHpApplied convention: NOT edit-preserved, re-applies onto fresh
// assembly values); saves ride computeStatBlock lanes; drilldown parity via
// buildMutantSubtypeLanes below.
function reconcileMutantSubtype(c) {
  if (!c) return false;
  const ml = (getMPState(c).mutantLevel || 0);
  const conM = am((((c.attrs) || [10, 10, 10, 10, 10, 10])[2]) || 10);
  const exp = { bab: Math.floor(ml / 2), def: Math.floor(ml / 3), hp: ml * (5 + conM) };
  const app = c.mutSubApplied || { bab: 0, def: 0, hp: 0 };
  let changed = false;
  if (exp.bab !== app.bab && isFinite(c.bab)) { c.bab += exp.bab - app.bab; changed = true; }
  if (exp.def !== app.def && isFinite(c.def)) { c.def += exp.def - app.def; changed = true; }
  if (exp.hp !== app.hp && isFinite(c.maxHP)) {
    c.maxHP += exp.hp - app.hp;
    if (exp.hp > app.hp && isFinite(c.currentHP)) c.currentHP += exp.hp - app.hp;
    if (isFinite(c.currentHP)) c.currentHP = Math.min(c.currentHP, c.maxHP);
    changed = true;
  }
  if (changed || !c.mutSubApplied) c.mutSubApplied = exp;
  return changed;
}
// The drilldown/parity lanes — ONE builder consumed by computeStatBlock
// (entries) and verifyParity (symmetric subtraction). The bab/def entries
// mirror the baked values so card and drilldown agree.
function buildMutantSubtypeLanes(c) {
  const ml = (getMPState(c).mutantLevel || 0);
  if (ml <= 0) return { bab: [], def: [], fort: [], ref: [], will: [] };
  const half = Math.floor(ml / 2), third = Math.floor(ml / 3);
  const prow = (v) => ({ type: 'racial', source: 'mutant:unnaturalProwess', value: v, label: `Unnatural Prowess (Mutant +${ml}, Ex — HH p.29)` });
  const resl = (v) => ({ type: 'racial', source: 'mutant:unnaturalResilience', value: v, label: `Unnatural Resilience (Mutant +${ml}, Ex — HH p.29)` });
  return {
    bab: half ? [prow(half)] : [],
    def: third ? [prow(third)] : [],
    fort: half ? [resl(half)] : [], ref: half ? [resl(half)] : [], will: half ? [resl(half)] : [],
  };
}
function strongSuperTalentsOwned(c) {
  return STRONG_PASSIVE_RIDERS.filter(n => (c.talents || []).some(t => (t.name || t.n) === n));
}
function hasSupremeEffort(c) {
  return (c.talents || []).some(t => (t.name || t.n) === 'Supreme Effort');
}
function computeHardnessIgnore(c) {
  const owned = new Set((c.talents || []).map(t => t.name || t.n));
  const tier = owned.has('Advanced Ignore Hardness') ? 3 : owned.has('Improved Ignore Hardness') ? 2 : owned.has('Ignore Hardness') ? 1 : 0;
  const su = !c.nullified;
  const mangler = su && owned.has('Mangler'), titanic = su && owned.has('Titanic Strength');
  const instances = (mangler ? 1 : 0) + (titanic ? 1 : 0);
  const from = [mangler ? 'Mangler' : null, titanic ? 'Titanic Strength (echo instance)' : null].filter(Boolean).join(' + ');
  if (instances && tier) {
    const [ig, dc] = MANGLER_LADDER[tier];
    return { ignore: ig * instances, breakDC: dc * instances, mode: 'mangler', instances, tier, from };
  }
  if (instances && !tier) return { ignore: 0, breakDC: 0, mode: 'latent', instances, tier: 0, from: from + ' — latent: no Ignore Hardness talent owned (the function wakes when the tree is entered)' };
  let ig = 0, dc = 0;
  if (owned.has('Ignore Hardness')) { ig += 2; dc += 1; }
  if (owned.has('Improved Ignore Hardness')) { ig += 2; dc += 1; }
  if (owned.has('Advanced Ignore Hardness')) { ig += 2; dc += 1; }
  return (ig || dc) ? { ignore: ig, breakDC: dc, mode: 'base', instances: 0, tier, from: 'Ignore Hardness tree (Ex)' } : null;
}
// v8.88.0 (Adam's dramatic-effect ruling): beyond the 5-ton line, carrying
// numbers list in TONS, rounding down (short ton, 2,000 lb).
function fmtCarry(lb) {
  return lb >= 10000 ? `${Math.floor(lb / 2000).toLocaleString()} tons` : `${Math.floor(lb).toLocaleString()} lb`;
}
// Tremendous Strength (HH p.263): for Str 30+, take the 20–29 row with the
// same ones digit and multiply ×4 per full 10 above it (30s ×4, 40s ×16, …).
function carryTriplet(str) {
  if (!isFinite(str) || str < 1) return [0, 0, 0];
  if (str <= 29) return CARRY_TABLE_HH[Math.floor(str)].slice();
  const ones = Math.floor(str) % 10;
  const row = CARRY_TABLE_HH[20 + ones];
  const mult = Math.pow(4, Math.floor((Math.floor(str) - (20 + ones)) / 10));
  return row.map(v => v * mult);
}
function computeCarryCapacity(c) {
  const str = effAttrs(c)[0];
  let triplet = carryTriplet(str);
  const parts = [`Str ${str} — light ${triplet[0]} / medium ${triplet[1]} / heavy ${triplet[2]} lb`];
  // Bigger and Smaller Creatures (HH p.263): Small bipeds carry ×¾.
  if (raceSizeIndex(c) === 3) { triplet = triplet.map(v => v * 0.75); parts.push('Small ×¾'); }
  // v9.0.0 (the Half-Again egg, Adam's sweetener): Powerful Build counts
  // one size larger for CARRYING CAPACITY — ×2, the Large bipeds' rate
  // (HH p.263). Racial Ex: stands through a Null Power Field. "He's a
  // workhorse."
  if (hasHalfAgain(c)) { triplet = triplet.map(v => v * 2); parts.push('×2 Half-Again (Powerful Build — carries as one size larger)'); }
  const owned = c.nullified ? [] : strongSuperTalentsOwned(c);
  // v9.2.0: worn carrying gear (Backpack +1, Mesh vest +2 equipment to Str
  // for carrying only; best applies) — never for the super-strong (Adam).
  const _carryGear = wornGearOf(c).map(it => ({ v: gearDef(it).worn.carry || 0, n: it.ref })).filter(x => x.v).sort((a, b) => b.v - a.v)[0];
  if (_carryGear) {
    const _su = ((suBakedPerAttr(c) || [])[0]);
    if (owned.length || (_su && !c.nullified)) parts.push(`${_carryGear.n}: no effect — Supernatural Strength / Strong super-talent`);
    else { const t2 = carryTriplet(str + _carryGear.v); const k = raceSizeIndex(c) === 3 ? 0.75 : 1; const h = (hasHalfAgain(c)) ? 2 : 1; triplet = t2.map(v => v * k * h); parts.push(`${_carryGear.n} worn: carries as Str ${str + _carryGear.v} (+${_carryGear.v} equipment)`); }
  }
  if (owned.length) {
    const mult = Math.pow(4, owned.length);
    triplet = triplet.map(v => v * mult);
    parts.push(`×${mult} Super-Strong (Su: ${owned.join(', ')} — ×4 each)`);
  }
  triplet = triplet.map(v => Math.floor(v));
  return {
    light: triplet[0], medium: triplet[1], heavy: triplet[2], parts,
    superTalents: owned,
    // Lifting and Dragging (HH p.262): over-head = max load; off-ground = ×2
    // (stagger, 5 ft); push/drag = ×5.
    liftOverHead: triplet[2], liftOffGround: triplet[2] * 2, pushDrag: triplet[2] * 5,
    supremeEffortOwned: !c.nullified && hasSupremeEffort(c),
  };
}
function computeSpeeds(c) {
  // v8.68.0: a Hybrid's size parent governs movement too (HH p.30 — size is
  // selected "by which the character's movement modes and movement rate are
  // also determined").
  const race = (raceKeyForSize(c) || '');
  const rdef = RACES[race] || {};
  const notes = rdef.notes || '';
  // v8.16.0 Races pass: the structured speed field governs (Centaur 50′,
  // giants 40′, Merfolk 5′…); RACE_BASE_SPEED and the Small default remain
  // as fallbacks.
  let walk = rdef.speed != null ? rdef.speed
           : RACE_BASE_SPEED[race] != null ? RACE_BASE_SPEED[race]
           : (raceSizeIndex(c) === 3 ? 20 : 30);
  const baseWalk = walk;
  const parts = [`base ${walk}′ (${race || 'Medium'})`];
  // Talent contributions (Increased Speed chain — flat, then multiplier).
  const bon = buildTalentBonuses(c);
  const flat = ((bon && bon.speed) || []).reduce((s, b) => s + (b.value || 0), 0);
  if (flat) { walk += flat; parts.push(`+${flat}′ talents`); }
  // v8.8.2 (Adam's Basic-class pass): Berserker Fast Movement (Ex, HH p.79)
  // — +10 ft land speed in no/light/medium armor (not heavy). Applied before
  // the armor limitation per the book's ordering note. The "not carrying a
  // heavy load" proviso rides the Carry line (gear weight isn't summed).
  {
    const bsk = migrateLegacyClasses(c).filter(e => e.name === 'Berserker').reduce((s, e) => s + (e.level || 0), 0);
    if (bsk >= 1) {
      const cat = wearingArmorCategory(c);
      if (!cat || cat === 'light' || cat === 'medium') { walk += 10; parts.push('+10′ Fast Movement (Berserker — no heavy armor; also requires no heavy load, see Carry)'); }
      else parts.push('Fast Movement suppressed (heavy armor)');
    }
  }
  // Reduced Speed drawback: −5 to ALL movement modes.
  const reduced = (c.mutations || []).some(m => m.name === 'Reduced Speed') ? 5 : 0;
  if (reduced) parts.push('−5′ Reduced Speed');
  // Armor speed limitation (worst equipped body armor). The table figure is
  // the armored speed for a BASE-30/BASE-20 mover — a remap of base speed,
  // not a cap on the final number. v8.12.1 (Adam's catch: Increased Speed
  // was being clamped back to the table figure by cap logic): applied as a
  // DELTA — penalty = base-column figure minus the armor's figure — so
  // talent/class speed bonuses ride on top. Ultralight Composition eases the
  // penalty by 5′ (never past 0 — "up to normal"). Dwarves ignore it
  // entirely (stocky).
  if (!rdef.stocky) {
    let worstPen = 0, worstSrc = null, worstEased = false;
    for (const it of getCharItems(c)) {
      if (it.catalogue !== 'armor' || !it.equipped) continue;
      const def = getCatalogueEntry('armor', it.ref);
      const sm = def && /(\d+)[’']\s*\/\s*(\d+)[’']/.exec(def.speed || '');
      if (!sm) continue;
      let pen = baseWalk >= 30 ? (30 - parseInt(sm[1], 10)) : (20 - parseInt(sm[2], 10));
      let eased = false;
      if (pen > 0 && hasGadget(it, 'Ultralight Composition')) { pen = Math.max(0, pen - 5); eased = true; }
      if (pen > worstPen) { worstPen = pen; worstSrc = it.ref; worstEased = eased; }
    }
    if (worstPen > 0) { walk -= worstPen; parts.push(`−${worstPen}′ armor (${worstSrc}${worstEased ? ', Ultralight-eased' : ''})`); }
  } else {
    // v8.16.0: the stocky flag (Dwarf, Duergar) replaces the name check.
    if (getCharItems(c).some(it => it.catalogue === 'armor' && it.equipped)) parts.push(`armor ignored (${race} — stocky)`);
  }
  walk -= reduced;
  // Multiplier talents (Hyper-Speed — a Su super-talent: suppressed while
  // nullified) — highest wins, applied last.
  const mult = (c.nullified) ? 0 : ((bon && bon.speedMult) || []).reduce((m, b) => Math.max(m, b.value || 0), 0);
  if (mult > 1) { walk *= mult; parts.push(`×${mult} (talent)`); }
  if (c.nullified && ((bon && bon.speedMult) || []).length) parts.push('⊘ Hyper-Speed suppressed (nullified)');
  // v8.8.0 (Adam's catch): the speed FEATS. The Run feat lifts the run
  // multiplier to ×5 (×4 stays in heavy armor / heavy load — noted); Speed
  // of Thought grants +10′ insight WHILE psionically focused and out of
  // heavy armor — a condition the engine can't verify, so it rides the
  // provenance as a conditional line, not folded into the number. (The
  // Monk's Purity of Body grants Speed of Thought as a virtual feat — that
  // class feature remains note-level pending class-feature grants.)
  const ownsFt = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  let run = '×4';
  if (ownsFt('Run')) { run = '×5'; parts.push('Run feat: ×5 running (×4 in heavy armor/load); +4 running jumps; keep Dex to AC while running'); }
  // v8.21.0 Segment A: Speed of Thought goes LIVE off the tracked focus state
  // — +10′ insight while psionically focused and out of heavy armor.
  if (ownsFt('Speed of Thought')) {
    const cat = wearingArmorCategory(c);
    if (c.psiFocused && cat !== 'heavy') { walk += 10; parts.push('+10′ insight (Speed of Thought — psionically focused)'); }
    else parts.push(`Speed of Thought inactive (${cat === 'heavy' ? 'heavy armor' : 'not focused'}) — +10′ insight while focused & out of heavy armor`);
  }
  // v9.2.0: active gear Boons — Boost's +10 ft; the jetpack's flight.
  for (const a of ((c.activeEffects || []).filter(x => x.gear))) for (const e of a.effects) {
    if (e.k === 'speed') { walk += e.v; parts.push(`+${e.v}′ ${a.name} (active)`); }
  }
  // v9.10.0 (§263): named movement BUFFS — walk bonuses while in effect
  // (gear Boons keep their own k:'speed' channel above).
  let _hasted = false;
  for (const a of (c.activeEffects || [])) {
    if (a.gear) continue;
    const g = MOVEMENT_GRANTS[a.name];
    if (!g) continue;
    if (g.walk) { walk += g.walk; parts.push(`+${g.walk}′ ${a.name} (active)`); }
    if (g.haste) _hasted = true;
  }
  if (_hasted) { const hb = Math.min(30, walk); walk += hb; parts.push(`+${hb}′ Haste (active — all modes +30′, max ×2, enhancement; multiple Hastes don't stack)`); }
  const out = { walk: Math.max(0, walk), run, parts, modes: [] };
  for (const a of ((c.activeEffects || []).filter(x => x.gear))) for (const e of a.effects) {
    if (e.k === 'fly') out.modes.push({ type: 'Fly', speed: e.v, note: `${e.note || ''} (${a.name} — active)` });
  }
  // v8.16.0 Races pass: racial movement modes (Merfolk swim 50′, Pixie fly
  // 60′, Gargoyle fly, Janni fly…) join the list.
  for (const m of (rdef.modes || [])) out.modes.push({ type: m.type, speed: Math.max(0, m.speed - reduced), note: m.note || `${race} racial` });
  // Other movement modes from mutations.
  if ((c.mutations || []).some(m => m.name === 'Wings') && !out.modes.some(m => m.type === 'Fly')) out.modes.push({ type: 'Fly', speed: Math.max(0, 60 - reduced), note: 'average maneuverability (Wings)' });
  // v9.10.0 (§263, Adam's Tytyvyllus report): alternate locomotion joins the
  // Speed cell. (a) Named movement BUFFS grant their mode while active;
  // (b) owned SUPER-POWERS (pool:'super') grant theirs permanently — at
  // will, so they belong on the dashboard (Su: suppressed while nullified,
  // the Hyper-Speed treatment). A super mode is skipped when an equal-or-
  // faster mode of the same type is already listed (racial Fly outruns the
  // power; no duplicate rows).
  for (const a of (c.activeEffects || [])) {
    if (a.gear) continue;
    const g = MOVEMENT_GRANTS[a.name];
    if (g && g.mode) out.modes.push({ type: g.mode.type, speed: g.mode.speed, note: `${g.mode.note} — active` });
  }
  for (const p of (c.powers || [])) {
    if (p.pool !== 'super') continue;
    const g = MOVEMENT_GRANTS[p.name];
    if (!g || !g.mode) continue;
    if (c.nullified) { parts.push(`⊘ ${p.name} suppressed (nullified)`); continue; }
    if (!out.modes.some(m => m.type === g.mode.type && m.speed >= g.mode.speed)) {
      out.modes.push({ type: g.mode.type, speed: g.mode.speed, note: `${g.mode.note} — super-power, at will` });
    }
  }
  // Haste reaches every mode: +30′ each, capped at twice that mode's speed.
  if (_hasted) for (const m of out.modes) {
    const hb = Math.min(30, m.speed);
    if (hb > 0) { m.speed += hb; m.note = `${m.note} · Haste +${hb}′`; }
  }
  return out;
}
function evasionTier(c) {
  const hasT = (n) => (c.talents || []).some(x => (x.name || x.n) === n);
  const srcs = [];
  if (hasT('Evasion') || hasT('Improved Evasion')) srcs.push('Evasion talent (Fast Hero tree)');
  if (_cfLvlOf(c, 'Monk') >= 2) srcs.push('Monk 2');
  if (_cfLvlOf(c, 'Rogue') >= 2) srcs.push('Rogue 2');
  if (_cfLvlOf(c, 'Ranger') >= 9) srcs.push('Ranger 9 (light/no armor)');
  if (_cfLvlOf(c, 'Survivor') >= 1) srcs.push('Survivor 1');
  if (_cfLvlOf(c, 'Explorer') >= 4) srcs.push('Explorer 4');
  if (!srcs.length) return null;
  const saIE = !!(c.classChoices && Object.keys(c.classChoices).some(k => k.startsWith('rog_sa_') && c.classChoices[k] === 'Improved Evasion'));
  // v9.0.2 (Adam's ruling, 2026-10-06): instances of Evasion STACK — ANY
  // second distinct source grants Improved Evasion (Monk 2 + Rogue 2, the
  // Fast Hero talent + Rogue 2, …), not only Explorer 4 / Survivor 1's
  // "Improved if already owned" clause. Mirrors Uncanny Dodge's rule.
  const escalator = srcs.length >= 2;
  const improved = hasT('Improved Evasion') || _cfLvlOf(c, 'Monk') >= 9 || _cfLvlOf(c, 'Rogue') >= 14 || saIE || escalator;
  return { tier: improved ? 2 : 1, srcs };
}
function uncannyDodgeTier(c) {
  const hasT = (n) => (c.talents || []).some(x => (x.name || x.n) === n);
  const srcs = [];
  if (hasT('Uncanny Dodge 1') || hasT('Uncanny Dodge 2')) srcs.push('Uncanny Dodge talent (Fast Hero tree)');
  if (_cfLvlOf(c, 'Berserker') >= 2) srcs.push('Berserker 2');
  if (_cfLvlOf(c, 'Rogue') >= 4) srcs.push('Rogue 4');
  if (_cfLvlOf(c, 'Assassin') >= 2) srcs.push('Assassin 2');
  if (_cfLvlOf(c, 'Tactician') >= 7) srcs.push('Tactician 7');
  if (!srcs.length) return null;
  let improved = hasT('Uncanny Dodge 2') || _cfLvlOf(c, 'Berserker') >= 5 || _cfLvlOf(c, 'Rogue') >= 8 || _cfLvlOf(c, 'Assassin') >= 6;
  if (!improved && srcs.length >= 2) improved = true;  // second-source auto-upgrade
  return { tier: improved ? 2 : 1, srcs };
}
// DEFENSE RIDERS — one footer line on the combat dashboard (the ⚔⚔ TWF-row
// idiom): owned defensive feats and the parry/dodge ready-action ladders.
function defenseRiders(c) {
  const owns = (n) => ownsFeatN(c, n);
  const r = [];
  if (owns('Deflect Arrows')) r.push(['Deflect Arrows', 'Free parry vs one ranged non-ballistic attack per round (one hand free).']);
  if (owns('Snatch Arrows')) r.push(['Snatch Arrows', 'Catch a deflected thrown weapon — and you may counterattack with it.']);
  if (owns('Elusive Target')) r.push(['Elusive Target', '+4 AC vs ranged attacks while you are engaged in melee.']);
  if (owns('Sidestep Charge')) r.push(['Sidestep Charge', '+4 dodge AC vs charging foes.']);
  if (owns('Stand Still')) r.push(['Stand Still', 'Your attack of opportunity can STOP an opponent’s movement through your threatened area.']);
  if (owns('Unbalance Opponent')) r.push(['Unbalance Opponent', 'One opponent per round loses their Str modifier on melee attacks against you.']);
  if (owns('Mobility')) r.push(['Mobility', '+4 dodge AC vs attacks of opportunity provoked by your movement.']);
  if (owns('Combat Reflexes')) r.push(['Combat Reflexes', `Up to ${am(effAttrs(c)[1]) + 1} attacks of opportunity per round (Dex mod + 1), even while flat-footed.`]);
  if (owns('Improved Combat Throw')) r.push(['Improved Combat Throw', 'When an opponent misses you in melee, take an AoO to attempt a trip.']);
  if (owns('Shield Parry')) r.push(['Shield Parry', 'Parry one attack with your shield as an immediate action.']);
  const pTier = owns('Advanced Defensive Martial Arts') ? 'immediate free action' : owns('Improved Defensive Martial Arts') ? 'free action' : owns('Defensive Martial Arts') ? 'swift action' : null;
  if (pTier) r.push(['Parry ready', `Ready a parry as a ${pTier} — the opposed roll uses your Parry stat.`]);
  const dTier = owns('Advanced Dodge') ? 'immediate free action' : owns('Improved Dodge') ? 'free action' : owns('Dodge') ? 'swift action' : null;
  if (dTier) r.push(['Dodge ready', `Ready a dodge as a ${dTier} — the opposed Reflex uses your Dodge stat.`]);
  return r;
}

// ========== T/ACtical COMBAT SYSTEM (v8.1.7) ==========
// The T/ACtical Combat System layers Armor Class into up to four tiers, displayed
// in a compact label that scales to the character's actual defenses:
//   AC           — no equipment, no natural armor (1 number)
//   T/AC 10/13   — equipment only (2 numbers: Touch, Total)
//   T/NC 10/14   — natural armor only, no equipment (2 numbers: Touch, NatCrit)
//   T/A/NC 10/13/16 — both equipment and natural armor (3 numbers)
// Critical-confirmation threshold equals the highest existing tier.
// Per handbook (HH p.347):
//   Touch  = 10 + Dex mod + Defense bonus + Size mod
//   Total  = Touch + equipment (armor + shield)
//   Natural-Critical = Total + natural armor mod
// Per handbook (HH p.373, p.377):
//   Parry attempt = 1d20 + BAB + Str mod + Defense bonus + Shield AC bonus
//   Dodge attempt = 1d20 + Reflex save + Defense bonus + dodge AC bonus(es)
//
// computeACDisplay(c, opts) — returns the smart-compacting AC label.
// opts.armor, opts.shield, opts.natural can override the character's stored values
// (used by the create-form preview before save).
function computeACDisplay(c, opts){
  opts = opts || {};
  // v8.8.0 (Adam): the equipped armor's maximum Dex bonus caps what Dex can
  // contribute to AC (limited mobility — HH armor descriptions). Applies to
  // Touch and everything built on it; Morphic Metal Alloy raises the cap.
  // v8.12.2 (Adam's Rhad catch): EFFECTIVE Dex (equipped-item enhancements,
  // fatigue), matching computeStatBlock's firm-wire convention — was raw.
  let dexM = am(effAttrs(c)[1]);
  const _mdxCap = armorMaxDexCap(c);
  const _dexCapped = (_mdxCap != null && dexM > _mdxCap);
  if (_dexCapped) dexM = _mdxCap;
  // v8.16.0 Races pass: size derives from the race (+1 Small, −1 Large);
  // an explicit c.sizeMod (GM) overrides.
  const size = (c.sizeMod != null) ? c.sizeMod : (raceACSizeMod(c));
  const def = c.def || 0;
  // v8.5.2: equipped armor/shield item (incl. mastercraft) takes precedence
  // over the manual c.armorAC/c.shieldAC fields; those remain the fallback
  // for homebrew gear not in the catalogue, or when nothing is equipped.
  const eq = computeEquippedArmorShield(c);
  const armor   = opts.armor   ?? (eq.armor   ?? (c.armorAC   ?? 0));
  const shield  = opts.shield  ?? (eq.shield  ?? (c.shieldAC  ?? 0));
  // v8.3.5: natural AC is now a SourcedValue. computeNaturalAC reads
  // c.naturalACSources (preferred) or falls back to the legacy c.naturalAC
  // scalar. Per d20 rules, same-type natural-armor sources resolve "best
  // wins"; natural-armor enhancement (type:'enhancement') stacks with the
  // base. The aggregator handles this uniformly. The provenance breakdown
  // is exposed via opts.naturalProvenance for the caller (used by the
  // sheet's Nat. AC stat-cell tooltip).
  const natComputed = opts.naturalAC || computeNaturalAC(c);
  const natural = opts.natural ?? natComputed.total;
  applyClassFeatureEffects(c);
  const touchAcBonus = c._touchAcBonus || 0;
  // v8.8.2: Rage's −2 AC (Ex, all tiers) while the toggle is active.
  const ragePen = (c.raging && rageTier(c)) ? -2 : 0;
  // v8.76.0 (Adam's Hellfire report — the AC cell ignored declared stances):
  // this parallel composer never read combatDecl, so CE's dodge bonus, RO's
  // −4, AND Best Defense's def spend (a latent v8.65.0 gap — the lanes
  // carried it but this display reads raw c.def) all missed the T/AC
  // tiers. All three are touch-legal: CE is a dodge bonus (HH p.207), RO
  // is a flat AC penalty, BD spends the Defense Bonus that feeds touch.
  const _dclA = combatDecl(c);
  const declCE = _dclA.ce || 0, declRO = _dclA.ro ? -4 : 0, declBD = -(_dclA.bd || 0);
  const declAC = declCE + declRO + declBD;
  // v8.12.2 (Adam's Rhad catch — Ring of Protection +2 missing from T/AC):
  // typed misc AC from the aggregator channels computeStatBlock already
  // collects but this display never read — deflection items (buildMagic-
  // ItemBonuses), unconditional dodge feats (Improved/Advanced Dodge),
  // racial AC. All surviving types apply to TOUCH and everything built on
  // it; armor/shield/natural types are excluded (natural rides
  // computeNaturalAC), conditional entries stay situational.
  let miscAC = 0; const miscParts = [];
  try {
    const pool = [
      ...((buildMagicItemBonuses(c).ac) || []),
      ...((buildFeatBonuses(c).ac) || []),
      ...((buildRacialBonuses(c.race).ac) || []),
      // v9.19.0 (old-boys report #2 — Mental Barrier's deflection missing
      // from the AC headline): the activeEffects lane, the SAME channel
      // computeStatBlock's ac lane reads (v8.42.0's aeBon). §278's disease,
      // third cell: the engine computed it, this parallel composer never
      // read it. Deflection and friends are touch-legal; gated entries
      // carry .condition and fall to the filter below; NPF suppression is
      // inside activeBuffBonuses itself.
      ...((activeBuffBonuses(c).ac) || []),
    ].filter(b => !b.condition && !['armor', 'shield', 'natural'].includes(b.type));
    if (pool.length) {
      const agg = aggregateBonuses(pool);
      miscAC = agg.total || 0;
      for (const b of ((agg.breakdown && agg.breakdown.applied) || [])) miscParts.push(`${b.value >= 0 ? '+' : '−'} ${Math.abs(b.value)} ${b.type || 'misc'} (${b.label || b.source})`);
    }
  } catch (e) {}
  const touch = 10 + dexM + def + size + touchAcBonus + ragePen + miscAC + declAC;
  const total = touch + armor + shield;
  const natCrit = total + natural;
  const hasEq  = (armor + shield) > 0;
  const hasNat = natural > 0;
  // Build the Touch formula string with the class-feature bonus if any
  const touchFormula = `10 + ${dexM} Dex${_dexCapped ? ` (capped by armor's max Dex +${_mdxCap})` : ''} + ${def} Def${size?' + '+size+' size':''}${touchAcBonus?' + '+touchAcBonus+' class':''}${ragePen?' − 2 Rage':''}${declCE ? ` + ${declCE} Combat Expertise (declared)` : ''}${declRO ? ' − 4 Reckless Offense (declared)' : ''}${declBD ? ` − ${-declBD} Best Defense (declared)` : ''}${miscParts.length ? ' ' + miscParts.join(' ') : ''}`;
  // v8.13.0 (Adam's T/ACtical armor pass): the band annotation — what a hit
  // in [touch, total) actually strikes, with live hardness/HP.
  let tacNote = '';
  try {
    const gsBits = [];
    for (const it2 of getCharItems(c)) {
      if (it2.catalogue !== 'armor' || !it2.equipped) continue;
      const g = armorItemIntegrity(it2);
      if (g) gsBits.push(`${enchantDisplayName(it2)} — Hardness ${g.hardness}, HP ${g.hp}/${g.maxHP}${g.destroyed ? ' ☠ destroyed' : g.broken ? ' ⚑ broken' : ''}`);
    }
    if (gsBits.length && total > touch) tacNote = ` · results ${touch}–${total - 1} strike the armor (hardness applies, split on the Tracker): ${gsBits.join('; ')}`;
  } catch (e) {}
  let label, value, tiers;
  if (!hasEq && !hasNat) {
    label = 'AC'; value = String(touch);
    tiers = [{name:'AC', val:touch, formula:touchFormula}];
  } else if (hasEq && !hasNat) {
    label = 'T/AC'; value = `${touch}/${total}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'Armor', val:total, formula:`T${armor?' + '+armor+' armor':''}${shield?' + '+shield+' shield':''} = ${total}${tacNote}`},
    ];
  } else if (!hasEq && hasNat) {
    label = 'T/NC'; value = `${touch}/${natCrit}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'NatCrit', val:natCrit, formula:`T + ${natural} natural = ${natCrit}`},
    ];
  } else {
    label = 'T/A/NC'; value = `${touch}/${total}/${natCrit}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'Armor', val:total, formula:`T${armor?' + '+armor+' armor':''}${shield?' + '+shield+' shield':''} = ${total}${tacNote}`},
      {name:'NatCrit', val:natCrit, formula:`A + ${natural} natural = ${natCrit}`},
    ];
  }
  return {label, value, tiers, touch, total, natCrit};
}

// Compute Parry attempt modifier per handbook HH p.377.
// Formula: BAB + Str mod + Defense bonus + Shield AC bonus
function computeParryBonus(c, opts){
  opts = opts || {};
  let strM = am(c.attrs[0]);
  let strLabel = 'Str';
  // v9.7.0 (§257): Weapon Finesse — "you may use your Dexterity modifier
  // instead of your Strength modifier on attack rolls AND PARRY ATTEMPTS"
  // (HH p.255) — exercised while wielding a finesse-eligible melee weapon
  // (or bare-handed: the unarmed strike is a light weapon) and Dex wins.
  try {
    if ((c.feats || []).some(f => (f.name || f.n) === 'Weapon Finesse')) {
      const dexP = am(c.attrs[1]);
      const held = getCharItems(c).filter(i => i.catalogue === 'weapon' && i.equipped);
      const finesseWielding = held.length === 0 || held.some(i => { const d = getCatalogueEntry('weapon', i.ref); return d && !isRangedWeapon(d) && isFinesseEligible(d); });
      if (finesseWielding && dexP > strM) { strM = dexP; strLabel = 'Dex (Weapon Finesse)'; }
    }
  } catch (e) {}
  const def = c.def || 0;
  const bab = c.bab || 0;
  const shield = opts.shield ?? (c.shieldAC ?? 0);
  // v8.65.0: Best Defense SPENDS Defense Bonus — def-fed stats move (PA's
  // mirror, Adam's ruling: "right down to the attendant Defense Bonus
  // modifier").
  const _bd = (combatDecl(c).bd || 0);
  // v9.12.1 (§270, Adam's re-reading 2026-10-10, superseding v8.98.0): PA
  // and CE are penalties to MELEE ATTACK ROLLS while engaged — Base Attack
  // is never spent (both feat BODIES, HH pp.207/235; the summary table's
  // "reduce Base Attack modifier" is the book typo, letter on TODO). A
  // parry is not a melee attack roll, so neither stance's penalty reaches
  // it, no refund is needed, and the v8.98.0 CE-amendment letter is
  // WITHDRAWN. What DOES reach the Parry: CE's Defense bonus — "affects
  // the character's AC (both touch and total), dodge modifier, and PARRY
  // modifier" (HH p.207) — so CE nets +N Parry with no arithmetic contortions.
  const _dP = combatDecl(c);
  const _ceP = _dP.ce || 0;
  const _roP = _dP.ro ? 4 : 0;
  const parts = [
    {label:'BAB', value:bab},
    {label:strLabel, value:strM},
    {label:'Def', value:def},
    {label:'Shield', value:shield},
  ];
  // v9.7.0 (§257): the Parrying imbued weapon ability — +1 insight to the
  // parry modifier (and touch AC + Reflex via the item-bonus lanes)
  // whenever the wielder holds the weapon, even flat-footed (GMG).
  const _pw = parryingHeldBonus(c);
  if (_pw) parts.push({label:'Parrying weapon (insight — held, even flat-footed)', value:_pw});
  if (_ceP) parts.push({label:'Combat Expertise (declared — the Defense bonus reaches the Parry, HH p.207)', value:_ceP});
  if (_bd) parts.push({label:'Best Defense (declared)', value:-_bd});
  if (_roP) parts.push({label:'Reckless Offense (declared)', value:-_roP});
  // v8.97.0 (Adam's flag request): the declaration-speed ladder, HH p.373 —
  // Defensive Martial Arts readies a parry as a SWIFT action, Improved DMA
  // as a FREE action, Advanced DMA declares as an IMMEDIATE free action.
  // Shield Parry rides separately: 1/round immediate shield parry vs ANY
  // attack that rolls to hit, ranged included (its own feat text).
  const _ownP = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  let ready = null;
  if (_ownP('Advanced Defensive Martial Arts')) ready = { speed: 'immediate free action', by: 'Advanced Defensive Martial Arts' };
  else if (_ownP('Improved Defensive Martial Arts')) ready = { speed: 'free action', by: 'Improved Defensive Martial Arts' };
  else if (_ownP('Defensive Martial Arts')) ready = { speed: 'swift action', by: 'Defensive Martial Arts' };
  const shieldParry = _ownP('Shield Parry');
  // Amended total: BA (minus PA and CE spends) + Str + Def + Shield, the CE
  // amendment restoring +2 per CE point (+1 Parry, +1 Def Bonus) → PA costs
  // its full spend, CE nets +N defensive, exactly the ruling's intent.
  // v9.12.1 (§270): no stance spends Base Attack — PA never reaches the
  // Parry, and CE contributes only its Defense bonus (+_ceP, the p.207 flow).
  return { total: bab + strM + def + shield + _ceP - _bd - _roP + _pw, parts, ready, shieldParry };
}

// Compute Dodge attempt modifier per handbook HH p.373.
// Formula: Reflex save + Defense bonus + dodge AC bonuses (from feats)
// Reflex save itself already includes Dex mod and class-progression bonus.
function computeDodgeBonus(c){
  const dexM = am(c.attrs[1]);
  const def = c.def || 0;
  // v8.97.0 (Adam's Rhad report): the Reflex component re-derived as
  // base + Dex ONLY — dropping every other Reflex bonus (Unnatural
  // Resilience's racial +1, Lightning Reflexes, item resistance, buffs,
  // negative levels…). HH p.372: "Dodge attempt = 1d20 + Reflex save
  // modifier + Defense bonus + dodge AC bonus(es)" — the SAVE CELL's own
  // total is the single truth.
  const refTotal = (computeStatBlock(c).ref)
    ? computeStatBlock(c).ref.total
    : (c.ref || 0) + dexM;
  // Dodge bonuses from feats: aggregate via the existing bonus pipeline.
  // For now, sum any 'dodge' bonus on the character. Conditional dodge bonuses
  // (Dodge feat's "designated target", Mobility's "moving through threatened squares")
  // are situational; players can choose whether to apply them per the situation,
  // so we list them out as separate items rather than rolling into the base.
  let unconditional = 0;
  const conditional = [];
  for (const f of (c.feats || [])) {
    const data = getFeatData(f.name);
    if (!data || !data.bonuses) continue;
    for (const b of data.bonuses) {
      if (b.type === 'dodge' && b.target === 'ac') {
        if (b.condition) conditional.push({source:f.name, value:b.value, condition:b.condition});
        else unconditional += b.value;
      }
    }
  }
  // v8.65.0: Best Defense spends Defense Bonus — the dodge roll's Def
  // component drops with it (PA's mirror).
  const _bd = (combatDecl(c).bd || 0);
  const parts = [
    {label:'Ref', value:refTotal},
    {label:'Def', value:def},
    {label:'Dodge', value:unconditional},
  ];
  if (_bd) parts.push({label:'Best Defense (declared)', value:-_bd});
  // v8.76.0 (Adam's Hellfire report): the declared CE/RO tags on the Dodge
  // card now carry real math — CE joins the dodge-bonus pool this function
  // already aggregates; RO's recklessness costs the roll its −4.
  const _ceD = (combatDecl(c).ce || 0);
  const _roD = (combatDecl(c).ro ? 4 : 0);
  if (_ceD) parts.push({label:'Combat Expertise (declared)', value:_ceD});
  if (_roD) parts.push({label:'Reckless Offense (declared)', value:-_roD});
  // v8.97.0 (Adam's flag request): the declaration-speed ladder, HH p.372 —
  // Dodge readies as a SWIFT action, Improved Dodge as a FREE action,
  // Advanced Dodge declares as an IMMEDIATE free action (even off-turn).
  const _own = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  let ready = null;
  if (_own('Advanced Dodge')) ready = { speed: 'immediate free action', by: 'Advanced Dodge' };
  else if (_own('Improved Dodge')) ready = { speed: 'free action', by: 'Improved Dodge' };
  else if (_own('Dodge')) ready = { speed: 'swift action', by: 'Dodge' };
  return {
    total: refTotal + def + unconditional - _bd + _ceD - _roD,
    parts,
    conditional,
    ready,
  };
}

// ============================================================================
// v8.47.0: MASSIVE DAMAGE THRESHOLD — wired to the tracker (HH p.348,
// "Massive Damage", book-verified 2026-09-28): a SINGLE attack dealing
// damage EQUAL TO OR GREATER than the character's massive damage threshold
// (current Con score, +3 per instance of Improved Damage Threshold — the
// feat stacks, HH p.213 — plus a persisted misc adjustment for the other
// printed sources: the Healer's Con−3, the +4 enhancement, drawbacks;
// Tactician Int-to-DC is attacker-side, adjust the DC at the table) forces
// a Fortitude save, DC 15 +1 per full 5 points of damage beyond the
// threshold. FAILURE (book letter): reduced to −[Con modifier] hit points
// and Dying — Unconscious instead if the damage was nonlethal. Damage
// "from multiple attacks, no one of which dealt enough damage itself" does
// NOT trigger the rule (p.348, explicit) — players often enter
// nickel-and-dime hits as one lump sum, so the tracker ASKS which it was.
function mdtThreshold(c) {
  const con = effAttrs(c)[2];
  const idt = (c.feats || []).filter(f => (f.name || f.n) === 'Improved Damage Threshold').length;
  const adj = c.mdtAdj || 0;
  return { thr: Math.max(1, con + idt * 3 + adj), con, idt, adj };
}
// ============================================================================
// v8.48.0: NONLETHAL DAMAGE — the p.349 tally, wired (Adam, 2026-09-28).
// c.nlDmg is a separate running total, NEVER deducted from HP. Status is
// DERIVED by comparison — "it doesn't matter whether the nonlethal damage
// has gone up or your current hit points have gone down" — so both the NL
// buttons AND the HP damage/heal paths re-check. Tally = current HP →
// Staggered; tally > current HP → Unconscious (helpless; casters retain
// abilities). Heals 1 point/hour/level; magical HP healing removes an equal
// amount (manual, via NL Heal — the tracker can't tell magic from rest);
// a Full Rest clears the tally outright.
function nlStatus(c) {
  const nl = c.nlDmg || 0;
  if (!nl || typeof c.currentHP !== 'number') return 0;
  return nl > c.currentHP ? 2 : nl === c.currentHP ? 1 : 0;
}
