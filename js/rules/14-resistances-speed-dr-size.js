// =============================================================================
// js/rules/14-resistances-speed-dr-size.js
// RESISTANCES SPEED DR SIZE
// =============================================================================
//
// WHAT'S IN HERE
//   Speed, energy resistances and immunities, spell resistance, damage
//   reduction, mutant subtypes, super-strength talents and the demolition
//   math, size and damage-die steps, Hybrid races, carrying capacity and
//   movement grants.
//
// KEY NAMES (so you can search for them)
//   tables/objects: ENERGY_TYPES, RACE_BASE_SPEED, STRONG_SUPER_TALENTS,
//   STRONG_PASSIVE_RIDERS, MANGLER_LADDER, SIZE_LADDER, DIE_STEP_UP,
//   CARRY_TABLE_HH, MOVEMENT_GRANTS
//   functions (29): computeResistances, computeSR,
//   buildClassFeatureSaveBonuses, computeDR, reconcileMutantSubtype,
//   buildMutantSubtypeLanes, reconcileTalentHp, strongSuperTalentsOwned,
//   hasSupremeEffort, computeHardnessIgnore, fmtCarry, hybridInfo,
//   hasHalfAgain, raceEclOf, raceKeyForSize, racialNatACOf, raceDisplayOf,
//   isHumanParented, buildRacialBonusesFor, raceSizeIndex, raceACSizeMod,
//   effectiveSizeIndex, carryTriplet, computeCarryCapacity, computeGrapple,
//   computeSpeeds, armorStatStrip, weaponStatStrip, weaponRangeRule
//
// LOAD ORDER
//   File 14 of 68. index.html loads it after
//   js/rules/13-armor-integrity-and-enchanting.js and before
//   js/rules/15-combat-declarations-and-melee.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 9651-10623 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 9651-10623; unchanged below this line ----
// ============================================================================
// v8.8.0 SPEED SYSTEM (Adam's design, 2026-09-02). Base walk speed derives
// from race/size (HH: Humans 30′; Dwarf/Gnome/Halfling race lines say 20′;
// other Small races 20′ by size) — Run is ×4 of walk (HH combat movement).
// Movement TYPES: Walk / Swim / Fly / Burrow (the Foe Folio's future home
// turf). Contributions: talent speed bonuses + multipliers (Fast Hero's
// Increased Speed chain, Hyper-Speed), the Reduced Speed drawback (−5 all
// modes), Wings (fly 60′ average), and the equipped armor's speed
// limitation (worst piece; Ultralight eases +5; DWARVES ARE STOCKY — never
// slowed by armor, HH race line). All derived live.
// ============================================================================
// ============================================================================
// v8.8.0 RESISTANCES & IMMUNITIES (Adam's design, 2026-09-02). Aggregated
// from every source with provenance; per d20, same-type resistances don't
// stack — the BEST value applies — and immunity supersedes. Sources:
//   • Tough Hero Energy Resistance talents (conMod-valued channels);
//   • the Energy Immunity super-talent (immune to every type whose
//     Resistance talent is owned — the Super-Tough endgame);
//   • Energy Absorption / Diffusion mutations (types chosen at acquisition);
//   • enchanted armor/shield abilities (X Resistance 10 / Improved 20 /
//     Greater 30) on EQUIPPED pieces;
//   • the Energy Resistance ring (10, type chosen at add) while equipped.
// Universal energy resistance derives when all five main types are covered
// (the only defense that touches disintegration — DAMAGE_TYPES).
// ============================================================================
const ENERGY_TYPES = ['acid', 'cold', 'electricity', 'fire', 'sonic'];
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
  const _hy = (typeof hybridInfo === 'function') ? hybridInfo(c) : null;
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
  for (const it of ((typeof wornGearOf === 'function') ? wornGearOf(c) : [])) for (const x of (gearDef(it).worn.immune || [])) immune[x] = immune[x] || `${it.ref} (worn)`;
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
    const eleV2 = (typeof classChoiceVal === 'function') ? classChoiceVal(c, 'ele_var_1') : null;
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
  const _hySR = (typeof hybridInfo === 'function') ? hybridInfo(c) : null;
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
  const eleVar = (typeof classChoiceVal === 'function') ? classChoiceVal(c, 'ele_var_1') : null;
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
    const p = (typeof FAMILIAR_PERKS !== 'undefined') && FAMILIAR_PERKS[comp.species];
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
    const eb = (typeof euphoriacBonus === 'function') ? euphoriacBonus(c) : 0;
    if (eb) for (const k of ['fort', 'ref', 'will']) out[k].push({ type: BONUS_TYPES.CLASS, source: 'classFeature:Euphoriac:' + k, value: eb, label: `Euphoriac +${eb} morale (Wilder — post-surge)` });
  }
  // v8.8.2: Rage's morale Will bonus while the toggle is active (Ex), plus
  // the Indomitable Intent conditional at Berserker 14+.
  if (c.raging) {
    const rt = (typeof rageTier === 'function') ? rageTier(c) : null;
    if (rt) {
      out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:RageWill', value: rt.will, label: `${rt.name} (+${rt.will} morale Will)` });
      if (lvlOf('Berserker') >= 14) out.will.push({ type: BONUS_TYPES.CLASS, source: 'classFeature:IndomitableIntent', value: 4, label: 'Indomitable Intent', condition: 'vs enchantment spells, while raging (stacks with the Rage morale bonus)' });
    }
  }
  return out;
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
  const _hyDR = (typeof hybridInfo === 'function') ? hybridInfo(c) : null;
  for (const [_rdr, _drSrc] of (_hyDR ? [[_hyDR.A.dr, _hyDR.a], [_hyDR.B.dr, _hyDR.b]] : [[(RACES[c.race] || {}).dr, c.race]])) {
    if (_rdr) entries.push({ value: _rdr.value, bypass: _rdr.bypass, source: `${_drSrc} racial`, conditional: _rdr.conditional || undefined });
  }
  // v8.86.0 (Adam's Son-of-the-Sun report): DR from the ✨/◉ lanes — the
  // k:'dr' entries of transient casts and perpetual Buffs (suppressed /
  // superseded perpetuals already filtered by _buffEffectSources). Live
  // instances, best-applicable per FF p.523; NPF suppresses the lot.
  if (typeof _buffEffectSources === 'function') {
    for (const a of _buffEffectSources(c).filter(x => !c.nullified || x.gear)) {   // v9.2.0: gear DR stands in an NPF
      for (const e of (a.effects || [])) {
        if (e.k !== 'dr') continue;
        const spec = (typeof POWER_EFFECTS !== 'undefined') ? POWER_EFFECTS[a.name] : null;
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
  if (typeof getCyber === 'function' && getCyber(c).some(r => r.n === 'Fortified Skeleton')) entries.push({ value: 4, bypass: '—', source: 'Fortified Skeleton (cybernetic)', note: 'implant x/− — does not stack with the class pool (FF p.523); best applicable applies' });
  if ((c.feats || []).some(f => (f.name || f.n) === 'Mental Resistance')) entries.push({ value: 3, bypass: '—', source: 'Mental Resistance feat', note: 'MENTAL — vs attribute damage only (not part of the physical pool)' });
  for (const it of getCharItems(c)) {
    if (!it.equipped) continue;
    if (((it.enchant && it.enchant.abilities) || []).includes('Invulnerability')) entries.push({ value: 10, bypass: 'magic', source: `Invulnerability (${enchantDisplayName(it)})` });
  }
  return entries;
}

const RACE_BASE_SPEED = { 'Dwarf': 20, 'Gnome': 20, 'Halfling': 20 };
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
  const ml = (typeof getMPState === 'function') ? (getMPState(c).mutantLevel || 0) : 0;
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
  const ml = (typeof getMPState === 'function') ? (getMPState(c).mutantLevel || 0) : 0;
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

function reconcileTalentHp(c) {
  if (!c) return false;
  const expected = (((buildTalentBonuses(c) || {}).hp) || []).reduce((s, b) => s + (b.value || 0), 0);
  const applied = c.talentHpApplied || 0;
  if (expected !== applied && isFinite(c.maxHP)) {
    c.maxHP += expected - applied;
    if (expected > applied && isFinite(c.currentHP)) c.currentHP += expected - applied;
    c.talentHpApplied = expected;
    return true;
  }
  return false;
}

// ----- v8.8.2 (Adam's "fully applied?" audit of the Strong super-talents) -----
// HH p.263 Supernatural Strength sidebar: EVERY Strong super-talent — Supreme
// Effort, Mangler, Super-Smash, AND Titanic Strength — carries cumulative
// riders beyond its headline effect: ×4 Carrying Capacity each (multiplicative
// — all four = ×64) and +1 effective size category each for natural attack
// damage dice, grappling, and the Jump skill. Only the headline effects were
// wired before this pass. The riders are Supernatural (super-talents) — all
// suppressed while c.nullified. Supreme Effort's ACTIVE window grants one MORE
// ×4 / +1 size on top (move-action, player-declared — manual door, noted only).
const STRONG_SUPER_TALENTS = ['Supreme Effort', 'Mangler', 'Super-Smash', 'Titanic Strength'];
// PASSIVE riders only: Supreme Effort's ×4/+1 applies solely WHILE PERFORMING
// one (its table row says so, and the book's worked example — Supreme Effort
// + one other talent = ×4 passive, ×16 during the Effort — confirms it). The
// true Titan with all four is thus ×64/Gargantuan passive, ×256/Colossal
// during a Supreme Effort, exactly as HH p.263 states.
const STRONG_PASSIVE_RIDERS = ['Mangler', 'Super-Smash', 'Titanic Strength'];
function strongSuperTalentsOwned(c) {
  return STRONG_PASSIVE_RIDERS.filter(n => (c.talents || []).some(t => (t.name || t.n) === n));
}
function hasSupremeEffort(c) {
  return (c.talents || []).some(t => (t.name || t.n) === 'Supreme Effort');
}
// ============================================================================
// v8.88.0 (Adam's Titanic-parity ruling, 2026-10-03): THE DEMOLITION MATH.
// Base Ignore Hardness tree (Ex, additive): 2/−1 per tier (totals 2/−1,
// 4/−2, 6/−3). Mangler (Su) REPLACES it by tier — "instead of the Ignore
// Hardness modifiers": 5/−2, 10/−5, 20/−8. TITANIC STRENGTH acts as ANOTHER
// INSTANCE of Mangler — hardness/break-DC ONLY (ruled: the ×4-carry/+1-size
// rider is already counted per talent, HH p.263): both owned = double effect
// (10/−4, 20/−10, 40/−16); a Mangler-less Titan carries the single instance
// at base Mangler values; no Ignore Hardness talent at all → the function is
// LATENT until the tree is entered. Su: Mangler/Titanic fall under NPF and
// the Ex tree values stand back up.
// ============================================================================
const MANGLER_LADDER = { 1: [5, 2], 2: [10, 5], 3: [20, 8] };
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
const SIZE_LADDER = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];
// Natural-weapon die progression for sizes past the catalogued L die
// (standard d20 step-up ladder).
const DIE_STEP_UP = { '1d2': '1d3', '1d3': '1d4', '1d4': '1d6', '1d6': '1d8', '1d8': '2d6', '2d6': '3d6', '3d6': '4d6', '4d6': '6d6', '6d6': '8d6' };
// ============================================================================
// v8.68.0 (Adam's simple model) — THE HYBRID RESOLVER. c.hybrid =
// {a, b, sizeFrom:'a'|'b', rlmOverride?, dropped?}. One resolver; the racial
// consumers each route through it: ECL/RLM, size+movement (ONE parent),
// racial bonuses/resist/immunities/SR/DR/bonusPP/feat+weapon grants (UNION
// of both parents — "all racial abilities of both"; best-wins engines
// reconcile overlaps), attribute adjustments (A + B, applied at creation).
function hybridInfo(c) {
  if (!c || c.race !== 'Hybrid' || !c.hybrid || !c.hybrid.a || !c.hybrid.b) return null;
  const h = c.hybrid;
  // v9.0.0 (the Half-Again egg): Half-Again × Half-Again is no hybrid at
  // all — refuse; and Half-Again has no size or speed of its own, so the
  // size parent is ALWAYS the real race, whichever slot the egg landed in.
  if (h.a === 'Half-Again' && h.b === 'Half-Again') return null;
  const A = RACES[h.a] || {}, B = RACES[h.b] || {};
  const auto = (A.ecl || 0) + (B.ecl || 0) + 1;
  const rlm = (h.rlmOverride === 0 || h.rlmOverride) ? h.rlmOverride : auto;
  let sizeFrom = h.sizeFrom === 'b' ? h.b : h.a;
  if (sizeFrom === 'Half-Again') sizeFrom = (h.a === 'Half-Again') ? h.b : h.a;
  return { a: h.a, b: h.b, A, B, sizeFrom, rlm, autoRlm: auto, dropped: h.dropped || '' };
}
// v9.0.0: the egg’s predicate — a Half-Again parent in either slot.
function hasHalfAgain(c) {
  const hy = hybridInfo(c);
  return !!(hy && (hy.a === 'Half-Again' || hy.b === 'Half-Again'));
}
function raceEclOf(c) { const hy = hybridInfo(c); return hy ? hy.rlm : ((RACES[(c && c.race)] || {}).ecl || 0); }
function raceKeyForSize(c) { const hy = hybridInfo(c); return hy ? hy.sizeFrom : (c && c.race); }
function racialNatACOf(c) {
  const hy = hybridInfo(c);
  if (hy) return Math.max(hy.A.natAC || 0, hy.B.natAC || 0);
  return (RACES[(c && c.race)] || {}).natAC || 0;
}
function raceDisplayOf(c) { const hy = hybridInfo(c); return hy ? `Hybrid (${hy.a} / ${hy.b})` : ((c && c.race) || ''); }
// v8.70.1 (Adam's Hero's-Gift catch exposed it): the Human racial bonuses
// (feat slot, per-level SP) belong to Human-PARENTED Hybrids too — "all
// racial abilities of both parents." One predicate, every consumer.
function isHumanParented(c) {
  if (!c) return false;
  if (c.race === 'Human') return true;
  const hy = hybridInfo(c);
  return !!(hy && (hy.a === 'Human' || hy.b === 'Human'));
}
function buildRacialBonusesFor(c) {
  const hy = hybridInfo(c);
  if (!hy) return buildRacialBonuses((c && c.race) || '');
  const A = buildRacialBonuses(hy.a) || {}, B = buildRacialBonuses(hy.b) || {};
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) out[k] = [...(A[k] || []), ...(B[k] || [])];
  return out;
}

function raceSizeIndex(c) {
  // v8.16.0 Races pass: the structured size field governs ('S' Small, 'L'
  // Large); the notes regex stays as the legacy fallback.
  // v8.68.0: Hybrids read the chosen size parent.
  const r = RACES[raceKeyForSize(c)] || {};
  if (r.size === 'S') return 3;
  if (r.size === 'L') return 5;
  return /\bSmall\b/.test(r.notes || '') ? 3 : 4;
}
// AC/attack size modifier from the race's base size (+1 Small, −1 Large —
// d20 size table; larger steps are Foe Folio territory). c.sizeMod, when a
// GM sets it, overrides.
function raceACSizeMod(c) {
  const idx = raceSizeIndex(c);
  return idx === 3 ? 1 : idx === 5 ? -1 : 0;
}
// Effective size index for natural dice / grappling / Jump — race base plus
// one category per Strong super-talent owned (Su: zero while nullified).
// v9.0.0 (the Half-Again egg): Powerful Build adds one category here too —
// racial and EXTRAORDINARY, so it stands through a Null Power Field. Actual
// size (AC/attack mods, Hide, reach display) stays the size parent's.
function effectiveSizeIndex(c) {
  const steps = c.nullified ? 0 : strongSuperTalentsOwned(c).length;
  const pb = (typeof hasHalfAgain === 'function' && hasHalfAgain(c)) ? 1 : 0;
  return Math.min(SIZE_LADDER.length - 1, raceSizeIndex(c) + steps + pb);
}
// HH p.261 Table: Carrying Capacity — [light max, medium max, heavy max] lb
// per Str score. Verbatim from the book, including the 26–29 oddities.
const CARRY_TABLE_HH = {
  1: [3, 6, 10], 2: [6, 13, 20], 3: [10, 20, 30], 4: [13, 26, 40], 5: [16, 33, 50],
  6: [20, 40, 60], 7: [23, 46, 70], 8: [26, 53, 80], 9: [30, 60, 90], 10: [33, 66, 100],
  11: [38, 76, 115], 12: [43, 86, 130], 13: [50, 100, 150], 14: [58, 116, 175], 15: [66, 133, 200],
  16: [76, 153, 230], 17: [86, 173, 260], 18: [100, 200, 300], 19: [116, 233, 350], 20: [133, 266, 400],
  21: [153, 306, 460], 22: [173, 346, 520], 23: [200, 400, 600], 24: [233, 466, 700], 25: [266, 533, 800],
  26: [306, 613, 920], 27: [346, 693, 1040], 28: [400, 800, 1200], 29: [466, 933, 1400],
};
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
  if (typeof hasHalfAgain === 'function' && hasHalfAgain(c)) { triplet = triplet.map(v => v * 2); parts.push('×2 Half-Again (Powerful Build — carries as one size larger)'); }
  const owned = c.nullified ? [] : strongSuperTalentsOwned(c);
  // v9.2.0: worn carrying gear (Backpack +1, Mesh vest +2 equipment to Str
  // for carrying only; best applies) — never for the super-strong (Adam).
  const _carryGear = wornGearOf(c).map(it => ({ v: gearDef(it).worn.carry || 0, n: it.ref })).filter(x => x.v).sort((a, b) => b.v - a.v)[0];
  if (_carryGear) {
    const _su = (typeof suBakedPerAttr === 'function') ? (suBakedPerAttr(c) || [])[0] : 0;
    if (owned.length || (_su && !c.nullified)) parts.push(`${_carryGear.n}: no effect — Supernatural Strength / Strong super-talent`);
    else { const t2 = carryTriplet(str + _carryGear.v); const k = raceSizeIndex(c) === 3 ? 0.75 : 1; const h = (typeof hasHalfAgain === 'function' && hasHalfAgain(c)) ? 2 : 1; triplet = t2.map(v => v * k * h); parts.push(`${_carryGear.n} worn: carries as Str ${str + _carryGear.v} (+${_carryGear.v} equipment)`); }
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
// Grapple modifier: BAB + Str mod + 4 per size category above Medium (−4
// below) — using the EFFECTIVE size (Super-Strong riders included).
function computeGrapple(c) {
  const strM = am(effAttrs(c)[0]);
  const sizeIdx = effectiveSizeIndex(c);
  const sizeMod = (sizeIdx - 4) * 4;
  let total = (c.bab || 0) + strM + sizeMod;
  const parts = [`BAB ${c.bab || 0}`, `Str ${strM >= 0 ? '+' : ''}${strM}`];
  if (sizeMod) parts.push(`size (${SIZE_LADDER[sizeIdx]}) ${sizeMod > 0 ? '+' : ''}${sizeMod}`);
  // v8.42.0: transient wired buffs (Grip of Iron) — typed aggregation.
  const aeG = (typeof activeBuffBonuses === 'function') ? (activeBuffBonuses(c).grapple || []) : [];
  if (aeG.length) {
    const agg = aggregateBonuses(aeG);
    if (agg.total) { total += agg.total; parts.push(`active powers +${agg.total}`); }
  }
  // v9.12.1 (§270, superseding the v8.59.3 rationale): PA/CE are penalties
  // to MELEE ATTACK ROLLS, never a spend of Base Attack — and "a grapple
  // check is like a melee attack roll" (the v8.63.1 Reckless Offense
  // precedent), so the penalty reaches the Grapple AS a roll penalty. Same
  // number as before, correct provenance: the BA component stays printed.
  const _dG = (typeof combatDecl === 'function') ? combatDecl(c) : { pa: 0, ce: 0, ro: false };
  if (_dG.pa + _dG.ce > 0) {
    total -= (_dG.pa + _dG.ce);
    parts.push(`declared stance penalty on melee attack rolls (PA ${_dG.pa} · CE ${_dG.ce}; grapple checks ride them — the RO precedent) −${_dG.pa + _dG.ce}`);
  }
  // v8.71.0 (found wiring the Tracker's Grapple drop-down): Improved
  // Grapple's +4 is UNCONDITIONAL — "a +4 bonus on all grapple checks,
  // regardless of whether you started the grapple" (HH p.224) — so it
  // belongs in the stat, not at the table. Sheet cell, drilldown, print,
  // and the new drop-down all inherit from here.
  if ((c.feats || []).some(f => (f.name || f.n) === 'Improved Grapple')) {
    total += 4;
    parts.push('Improved Grapple +4');
  }
  // v9.2.2 (Adam's ruling 2026-10-06): the Tentacle mutation's +4 mutation
  // bonus on grapple checks is unconditional — it belongs in the stat.
  if ((c.mutations || []).some(m => m.name === 'Tentacle')) {
    total += 4;
    parts.push('Tentacle +4 (mutation)');
  }
  // v8.91.0 (task 3): Lost Arm's own −2 on grapple checks (HH drawback text)
  // was never baked — now it is, and a cybernetic Prosthetic Arm lifts it.
  if (typeof hasLostArm === 'function' && hasLostArm(c) && !(typeof hasCyberArm === 'function' && hasCyberArm(c))) {
    total -= 2;
    parts.push('Lost Arm −2 (install a cybernetic arm to lift)');
  }
  // v8.92.0: cybernetic negative levels ride Grapple too — a grapple check
  // is like a melee attack roll (the RO doctrine), and HH p.333 hits all
  // attack rolls.
  const _cybNLg = (typeof cyberExcess === 'function') ? cyberExcess(c) : 0;
  if (_cybNLg) {
    total -= _cybNLg;
    parts.push(`negative levels −${_cybNLg} (cybernetic overload)`);
  }
  // v8.63.1 (Adam's redirect): Reckless Offense RIDES Grapple — "a grapple
  // check is like a melee attack roll" and starting one "requires a
  // successful melee attack roll" (HH grapple rules), so the +2 applies.
  // What RO never does: touch ranged, or mint extra attempts (attempt count
  // keys off the iterative ladder from PRINTED Base Attack, untouched).
  if (_dG.ro) {
    total += 2;
    parts.push('Reckless Offense (declared) +2');
  }
  // v8.65.0: Best Defense is a bonus "on their melee attack rolls" — the
  // same wording the Reckless Offense redirect ruled Grapple rides.
  if (_dG.bd) {
    total += _dG.bd;
    parts.push(`Best Defense (declared) +${_dG.bd}`);
  }
  return { total, parts, sizeIdx };
}

// v9.10.0 (§263, Adam's Tytyvyllus report): named movement powers feed the
// Speed cell. Keyed by spell/power NAME, so the same map serves (a) owned
// super-powers (pool:'super' — at-will, permanent display) and (b) active
// buff effects (c.activeEffects from casts — display while in effect).
// Every number verified against the HH dump: Fly "at a speed of 60 ft.",
// Overland Flight 40 ft., Spider Climb "climb speed of 20 feet",
// Ectoplasmic Form "20 feet (perfect)", Expeditious Route +30 ft.,
// Longstrider +10 ft., Haste "+30 feet, to a maximum of twice... normal"
// (all modes, enhancement — multiple Hastes don't stack), Levitate
// "up or down as much as 20 feet each round; doing so is a move action".
// Extend here as more movement powers come up.
const MOVEMENT_GRANTS = {
  'Fly':               { mode: { type: 'Fly', speed: 60, note: 'Fly' } },
  'Overland Flight':   { mode: { type: 'Fly', speed: 40, note: 'Overland Flight' } },
  'Spider Climb':      { mode: { type: 'Climb', speed: 20, note: 'Spider Climb' } },
  'Ectoplasmic Form':  { mode: { type: 'Fly', speed: 20, note: 'perfect (Ectoplasmic Form)' } },
  'Levitate':          { mode: { type: 'Levitate', speed: 20, note: 'up/down only, move action (Levitate)' } },
  'Expeditious Route': { walk: 30 },
  'Longstrider':       { walk: 10 },
  'Haste':             { haste: true },
};
function computeSpeeds(c) {
  // v8.68.0: a Hybrid's size parent governs movement too (HH p.30 — size is
  // selected "by which the character's movement modes and movement rate are
  // also determined").
  const race = (typeof raceKeyForSize === 'function') ? (raceKeyForSize(c) || '') : (c.race || '');
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
      const cat = (typeof wearingArmorCategory === 'function') ? wearingArmorCategory(c) : null;
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
    const cat = (typeof wearingArmorCategory === 'function') ? wearingArmorCategory(c) : null;
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
function armorStatStrip(def, it) {
  if (!def) return '';
  const bits = [];
  if (def.ac_bonus) bits.push(`+${def.ac_bonus} AC`);
  let md = parseMaxDex(def.max_dex);
  if (md != null) {
    let bonus = 0; const why = [];
    for (const gg of ((it && it.gadgets) || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'maxDexBonus' && typeof contrib.amount === 'number') { bonus += contrib.amount; why.push('morphic'); }
      }
    }
    if (it && it.mastercraft && it.mastercraft.target === 'mobility') { bonus += it.mastercraft.bonus || 0; why.push('mastercraft'); }
    bits.push(`max Dex +${md + bonus}${why.length ? ` (${why.join('+')})` : ''}`);
  }
  let acp = parseArmorCheckPenalty(def);
  if (acp < 0) {
    let ease = (it && it.enchant) ? 1 : 0;
    for (const gg of ((it && it.gadgets) || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'armorCheckPenalty' && typeof contrib.amount === 'number') ease += contrib.amount;
      }
    }
    const eff = Math.min(0, acp + ease);
    if (eff < 0) bits.push(`ACP ${eff}${ease ? ' (eased)' : ''}`);
  }
  const sm = /(\d+)[’']\s*\/\s*(\d+)[’']/.exec(def.speed || '');
  if (sm) {
    let s30 = parseInt(sm[1], 10), s20 = parseInt(sm[2], 10);
    const ul = hasGadget(it, 'Ultralight Composition');
    if (ul) { s30 = Math.min(30, s30 + 5); s20 = Math.min(20, s20 + 5); }
    bits.push(`spd ${s30}′/${s20}′${ul ? ' (ultralight)' : ''}`);
  }
  if (def.arcane_spell_failure && def.arcane_spell_failure !== '—') bits.push(`ASF ${def.arcane_spell_failure}`);
  // v8.13.0 (Adam's T/ACtical armor pass): hardness + HP on the strip, with
  // broken/destroyed state — the Tracker's Armor Integrity panel is the
  // interactive side; this is the reference line.
  if (it && typeof armorItemIntegrity === 'function') {
    const g = armorItemIntegrity(it);
    if (g) bits.push(`Hardness ${g.hardness} · HP ${g.hp}/${g.maxHP}${g.destroyed ? ' ☠ DESTROYED' : g.broken ? ' ⚑ BROKEN (no AC)' : ''}${g.alwaysIntercede ? ' ◈ always intercedes' : ''}`);
  }
  return bits.join(' · ');
}

function weaponStatStrip(def, it) {
  if (!def) return '';
  const bits = [];
  let crit = (def.crit || '').replace(/x(\d)/i, '×$1').trim();
  if (crit && crit !== '—') {
    if (!crit.includes('/')) crit = /^×/.test(crit) ? '20/' + crit : crit + '/×2';
    // v8.7.0 (Adam's Frostbite confirmation): Keen doubles the threat range
    // (20 → 19–20; 19–20 → 17–20; 18–20 → 15–20).
    if (it && it.enchant && (it.enchant.abilities || []).includes('Keen')) {
      const km = crit.match(/^(?:(\d+)–)?(\d+)\/(.+)$/);
      if (km) {
        const low = parseInt(km[1] || km[2], 10);
        crit = `${2 * low - 21}–20/${km[3]} (Keen)`;
      }
    }
    bits.push(`crit ${crit}`);
  }
  const effRng = effectiveRangeIncrement(it, def);
  if (effRng != null) bits.push(`rng ${effRng}′${hasScope(it) ? ' (scope ×1.5)' : ''}`);
  const effRof = effectiveRoF(it, def);
  if (effRof.length) bits.push(`RoF ${effRof.join('/')}${effRof.includes('A') && !((def.rof || []).includes('A')) ? ' (module)' : ''}`);
  const effMag = effectiveMagazine(it, def);
  if (effMag != null) bits.push(`mag ${hasGadget(it, 'Expanded Magazine') ? `${effMag} (expanded)` : def.magazine_raw || effMag}`);
  else if (def.magazine_raw) bits.push(`mag ${def.magazine_raw}`);
  if (hasGadget(it, 'Spring Loaded')) bits.push('Quick Draw (spring-loaded)');
  // v9.14.0 (§272, Adam's tech-upgrade gavels): homebrew Tech Upgrades wear
  // their chips on every strip surface — display riders, table-adjudicated
  // (the ⛏ convention: damage math untouched).
  const _ht = def.hb_tech;
  if (_ht) {
    if (_ht.aa === 4) bits.push('⚡⛏ Power Weapon — ignores ALL hardness (natural incl.)');
    else if (_ht.aa) bits.push(`⛏ Anti-Armor ${['','I','II','III'][_ht.aa]} — ignores the first ${[0,5,10,20][_ht.aa]} hardness (natural incl.)`);
    if (_ht.stun) bits.push('Stun Pulse — concussion (nonlethal); Fort DC 10 + damage dealt or stunned 1 rd');
    if (_ht.emp) bits.push('EMP — ionic (nonlethal electrical); vs cyborgs it strikes ONLY the tech implants (usually disabling them); an Anti-Shock Implant makes cybernetics immune to ionic');
    if (_ht.reach) bits.push('reach +5′ (Extended Reach)');
    if (_ht.heavyCrit) bits.push('Heavy Crit (×3)');
    if (_ht.powerPack) bits.push('power pack: 50 uses per pack (HF-Sword economy)');
  }
  return bits.join(' · ');
}

// v8.6.1 (Adam, 2026-09-01): the range-increment rule as a pop-up note —
// cumulative −2 to hit per increment beyond the first; THROWN weapons reach
// 5 increments (−8 at the limit), projectile weapons 10 (−18 at the limit).
// Thrown = melee-kind weapons with a range (thrown use), non-firearm hand
// explosives (grenades, dynamite), and the named thrown-ranged family;
// anything with a trigger, string, or sling is projectile.
function weaponRangeRule(def, it) {
  if (!def) return null;
  const inc = effectiveRangeIncrement(it, def);
  if (inc == null) return null;
  const THROWN_RANGED = new Set(['Dart', 'Javelin', 'Bolas', 'Net', 'Shuriken']);
  const thrown = THROWN_RANGED.has(def.n)
    || (def.kind !== 'ranged' && !def.firearm && !(def.rof || []).length && !/launcher|taser/i.test(def.n || ''));
  const maxInc = thrown ? 5 : 10;
  return `Range increment ${inc}′ — cumulative −2 to hit for each increment beyond the first. ${thrown ? 'Thrown' : 'Projectile'} weapon: maximum ${maxInc} increments (${(inc * maxInc).toLocaleString()}′), −${(maxInc - 1) * 2} to hit at that limit.`;
}

