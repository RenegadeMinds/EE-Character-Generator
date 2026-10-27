// =============================================================================
// js/rules/17-per-diem-and-class-choices.js
// PER DIEM AND CLASS CHOICES
// =============================================================================
//
// WHAT'S IN HERE
//   Per-day class abilities (uses, rage, fatigue), level-accrued class choices
//   (favored enemies, terrain mastery, rogue specials, high arcana, ...),
//   companion base stats from the Foe Folio, and Take-10 skill-set
//   designations.
//
// KEY NAMES (so you can search for them)
//   tables/objects: COMPANION_BASE_STATS, RANGER_FE_TYPES,
//   TERRAIN_MASTERY_DATA, ROGUE_SPECIAL_ABILITIES, CLASS_CHOICE_DEFS,
//   HIGH_ARCANA_COSTS, MENTAL_MASTERY_COSTS, GODLY_GIFT_OPTIONS,
//   ELEMENTAL_VARIANT_DATA
//   functions (24): computePerDiemAbilities, abilityUsed, adjustAbilityUse,
//   renewAbility, toggleRage, clearFatigue, classChoiceVal, permanentPPSpent,
//   menuClBonus, reconcileSpliceMP, heroTalentFlex, computeClassChoiceSpecs,
//   computeFavoredEnemies, buildAdvancedClassSkillBonuses,
//   buildClassChoiceBonuses, setClassChoice, renderClassChoices,
//   baseExAttrMod, computeSkillSetSpecs, addSkillSetPick, removeSkillSetPick,
//   expectedClassAttrBakes, reconcileClassAttrBakes, reconcileClassHp
//
// LOAD ORDER
//   File 17 of 68. index.html loads it after
//   js/rules/16-worn-and-active-gear.js and before js/rules/18-companions.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 11990-13078 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 11990-13078; unchanged below this line ----
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
function adjustAbilityUse(key, delta) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.abilityUses) c.abilityUses = {};
  const specs = computePerDiemAbilities(c);
  const spec = specs.find(s => s.key === key); if (!spec) return;
  const cur = abilityUsed(c, key);
  const next = Math.max(0, cur + delta);
  if (delta > 0 && cur >= spec.max) {
    if (!confirm(`${spec.name}: all ${spec.max} ${spec.kind === 'pool' ? 'points' : 'uses'} are spent. Record another anyway (GM exception)?`)) return;
  }
  c.abilityUses[key] = next;
  save(); if (typeof renderPerDiem === 'function') renderPerDiem(c);
}
function renewAbility(key) {
  const c = chars.find(x => x.id === curId); if (!c || !c.abilityUses) return;
  const spec = computePerDiemAbilities(c).find(s => s.key === key);
  c.abilityUses[key] = 0;
  logAct(`↻ ${spec ? spec.name : key} renewed (GM override — partial rejuvenation).`);
  save(); if (typeof renderPerDiem === 'function') renderPerDiem(c);
}

// ---- RAGE state machine (Adam: full toggle with baked modifiers) ----------
function toggleRage() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const t = rageTier(c); if (!t) return;
  if (!c.raging) {
    const spec = { max: rageUsesPerDay(c) };
    const used = abilityUsed(c, 'rage');
    if (used >= spec.max && !confirm(`Rage: all ${spec.max} daily uses are spent. Rage anyway (GM exception)?`)) return;
    c.raging = true;
    c.fatigued = false;
    if (!c.abilityUses) c.abilityUses = {};
    c.abilityUses.rage = used + 1;
    const conRaged = am(effAttrs(c)[2]);
    logAct(`🔥 ${t.name.toUpperCase()}! +${t.attr} Str/Con, +${t.will} morale Will, −2 AC — ${3 + conRaged} rounds (3 + raged Con mod).`);
  } else {
    c.raging = false;
    // Tireless @17, or Bloodluster Perfect Storm @10 (no fatigue even from
    // a Greater Rage; a lesser Bloodluster may still try Concentration DC 20).
    const tireless = berserkerLvl(c) >= 17 || (typeof bloodlusterLvl === 'function' && bloodlusterLvl(c) >= 10);
    if (!tireless) {
      c.fatigued = true;
      if (!c.conditions) c.conditions = [];
      if (!c.conditions.includes('Fatigued')) c.conditions.push('Fatigued');
      logAct('Rage ends — FATIGUED (−2 Str, −2 Dex, no charge/run) for the encounter.');
    } else {
      logAct('Rage ends — Tireless Rage: no fatigue.');
    }
  }
  save(); renderSheet(); renderGear(); renderSkills();
  if (typeof renderTracker === 'function' && curId) { const p = document.getElementById('tr-content'); if (p && p.style.display !== 'none') renderTracker(); }
}
function clearFatigue() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.fatigued = false;
  if (c.conditions) c.conditions = c.conditions.filter(x => x !== 'Fatigued');
  logAct('Fatigue recovered (encounter over / 8 hours rest).');
  save(); renderSheet(); renderGear(); renderSkills();
}

// ============================================================================
// v8.8.3 CLASS CHOICES (Adam's Basic-class pass): level-accrued class-feature
// selections — the competence family, Battle-Hardened saves, Favored Enemies,
// Terrain Mastery, mental-attribute bakes, Artisan, Rogue Special Abilities.
// Storage: c.classChoices = {key: value} (lazy). Rendered as the Sheet's
// 🎓 Class Choices panel; consumers feed the skill/save/attr/immunity engines.
// ============================================================================
// v8.8.3 COMPANION BASE STATS — extracted verbatim from the Foe Folio
// (Animals appendix; page field = FF page). Columned multi-variant blocks
// (vipers, sharks) carry a ref pointer instead of parsed lines.
const COMPANION_BASE_STATS = {
 "Badger": {
  "page": 66,
  "size": "Small Animal",
  "hd": "1d8+2 (6 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 30 ft. (6 hexes), burrow 10 ft.",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "bab": "+0/-5",
  "atk": "Claw +4 melee (1d2-1)",
  "fatk": "2 claws +4 melee (1d2-1) and bite -1 melee (1d3-1)",
  "sa": "Rage",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +5, Will +1, Dodge +6",
  "attrs": "Str 8, Dex 17, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Bat": {
  "page": 67,
  "size": "Diminutive Animal",
  "hd": "1/4 d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 5 ft (1 hex), fly 40 ft. (good)",
  "ac": "16 (+4 size, +2 Dex), touch 16, flat-footed 14",
  "bab": "+0/-17",
  "atk": "—",
  "fatk": "—",
  "sa": "—",
  "sq": "Blindsense 20 ft., low-light vision",
  "saves": "Fort +2, Ref +4, Will +2, Dodge +8",
  "attrs": "Str 1, Dex 15, Con 10, Int 2, Wis 14, Cha 4"
 },
 "Camel": {
  "page": 70,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 50 ft. (10 hexes)",
  "ac": "12/13 (-1 size, +3 Dex, +1 natural), flat-footed 10",
  "bab": "+2/+10",
  "atk": "Bite +0 melee (1d4+2*)",
  "fatk": "Bite +0 melee* (1d4+2*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +6, Will +1, Dodge +5",
  "attrs": "Str 18, Dex 16, Con 14, Int 2, Wis 11, Cha 4"
 },
 "Cat": {
  "page": 71,
  "size": "Small Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 30 ft. (6 hexes)",
  "ac": "13/13 (+1 size, +2 Dex), flat-footed 11",
  "bab": "+0/-12",
  "atk": "Claw +4 melee (1d2-4)",
  "fatk": "2 claws +4 melee (1d2-4) and bite -1 melee (1d3-4)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 2, Wis 12, Cha 7"
 },
 "Constrictor Snake": {
  "page": 91,
  "size": "Medium Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 20 ft. (4 hexes), climb 20 ft., swim 20 ft.",
  "ac": "13/15 (+3 Dex, +2 natural), flat-footed 12",
  "bab": "+2/+5",
  "atk": "Bite +5 melee (1d3+4)",
  "fatk": "Bite +5 melee (1d3+4)",
  "sa": "Constrict 1d3+4, improved grab",
  "sq": "Scent",
  "saves": "Fort +4, Ref +6, Will +2, Dodge +6",
  "attrs": "Str 17, Dex 17, Con 13, Int 1, Wis 12, Cha 2"
 },
 "Crocodile": {
  "page": 72,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 20 ft. (4 hexes), swim 30 ft.",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+2/+6",
  "atk": "Bite +6 melee (1d8+6) or tail slap +6 melee (1d12+6)",
  "fatk": "Bite +6 melee (1d8+6) or tail slap +6 melee (1d12+6)",
  "sa": "Improved grab",
  "sq": "Hold breath, low-light vision",
  "saves": "Fort +6, Ref +4, Will +2, Dodge +4",
  "attrs": "Str 19, Dex 12, Con 17, Int 1, Wis 12, Cha 2"
 },
 "Dire Rat": {
  "page": 60,
  "size": "Small Animal",
  "hd": "1d8+1 (5 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 40 ft. (8 hexes), climb 20 ft.",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "atk": "Bite +4 melee (1d4 plus disease)",
  "fatk": "Bite +4 melee (1d4 plus disease)",
  "sa": "Disease",
  "sq": "Low-light vision, scent",
  "saves": "Fort +3, Ref +5, Will +3, Dodge +6",
  "attrs": "Str 10, Dex 17, Con 12, Int 1, Wis 12, Cha 4"
 },
 "Dog": {
  "page": 73,
  "size": "Small Animal",
  "hd": "1d8+2 (6 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 40 ft. (8 hexes)",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "bab": "+0/-3",
  "atk": "Bite +2 melee (1d4+1)",
  "fatk": "Bite +2 melee (1d4+1)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +5, Will +1, Dodge +6",
  "attrs": "Str 13, Dex 17, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Eagle": {
  "page": 75,
  "size": "Small Animal",
  "hd": "1d8+1 (5 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 10 ft. (2 hexes), fly 80 ft. (average)",
  "ac": "13/15 (+1 size, +2 Dex, +2 natural), flat-footed 13",
  "bab": "+0/-4",
  "atk": "Talons +3 melee (1d4)",
  "fatk": "2 talons +3 melee (1d4) and bite -2 melee (1d4)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +3, Ref +4, Will +2, Dodge +5",
  "attrs": "Str 10, Dex 15, Con 12, Int 2, Wis 14, Cha 6"
 },
 "Hawk": {
  "page": 77,
  "size": "Tiny Animal",
  "hd": "1d8 (4 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 10 ft. (2 hexes), fly 60 ft. (average)",
  "ac": "15/17 (+2 size, +3 Dex, +2 natural), flat-footed 14",
  "bab": "+0/-10",
  "atk": "Talons +5 melee (1d4-2)",
  "fatk": "Talons +5 melee (1d4-2)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +5, Will +2, Dodge +7",
  "attrs": "Str 6, Dex 17, Con 10, Int 2, Wis 14, Cha 6"
 },
 "Horse (heavy)": {
  "page": 77,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 50 ft. (10 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+9",
  "atk": "Hoof -1 melee (1d6+1*)",
  "fatk": "2 hooves -1 melee (1d6+1*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Horse (light)": {
  "page": 78,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 60 ft. (12 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+8",
  "atk": "Hoof -2 melee (1d4+1*)",
  "fatk": "2 hooves -2 melee (1d4+1*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 14, Dex 13, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Lizard": {
  "page": 81,
  "size": "Tiny Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 20 ft. (4 hexes), climb 20 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d4-4)",
  "fatk": "Bite +4 melee (1d4-4)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 1, Wis 12, Cha 2"
 },
 "Owl": {
  "page": 86,
  "size": "Tiny Animal",
  "hd": "1d8 (4 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 10 ft. (2 hexes), fly 40 ft. (average)",
  "ac": "15/17 (+2 size, +3 Dex, +2 natural), flat-footed 14",
  "bab": "+0/-11",
  "atk": "Talons +5 melee (1d4-3)",
  "fatk": "Talons +5 melee (1d4-3)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +5, Will +2, Dodge +7",
  "attrs": "Str 4, Dex 17, Con 10, Int 2, Wis 14, Cha 4"
 },
 "Pony": {
  "page": 87,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 40 ft. (8 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+2",
  "atk": "Hoof -3 melee (1d3*)",
  "fatk": "2 hooves -3 melee (1d3*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 13, Dex 13, Con 12, Int 2, Wis 11, Cha 4"
 },
 "Porpoise": {
  "page": 88,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; Swim 80 ft. (16 hexes)",
  "ac": "13/15 (+3 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+1",
  "atk": "Slam +4 melee (2d4)",
  "fatk": "Slam +4 melee (2d4)",
  "sa": "—",
  "sq": "Blindsight 120 ft., hold breath, low-light vision",
  "saves": "Fort +4, Ref +6, Will +1, Dodge +6",
  "attrs": "Str 11, Dex 17, Con 13, Int 2, Wis 12, Cha 6"
 },
 "Rat": {
  "page": 89,
  "size": "Tiny Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 15 ft. (3 hexes), climb 15 ft., swim 15 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d3-4)",
  "fatk": "Bite +4 melee (1d3-4)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 2, Dex 15, Con 10, Int 2, Wis 12, Cha 2"
 },
 "Raven": {
  "page": 89,
  "size": "Tiny Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 10 ft. (2 hexes), fly 40 ft. (average)",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-13",
  "atk": "Claws +4 melee (1d2-5)",
  "fatk": "Claws +4 melee (1d2-5)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +4, Will +2, Dodge +6",
  "attrs": "Str 1, Dex 15, Con 10, Int 2, Wis 14, Cha 6"
 },
 "Riding Dog": {
  "page": 74,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 40 ft. (8 hexes)",
  "ac": "12/14 (+2 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+3",
  "atk": "Bite +3 melee (1d6+3)",
  "fatk": "Bite +3 melee (1d6+3)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +5, Will +1, Dodge 5",
  "attrs": "Str 15, Dex 15, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Squid": {
  "page": 94,
  "size": "Medium Animal (Aquatic)",
  "hd": "3d8 (13 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+3; Swim 60 ft. (12 hexes)",
  "ac": "13/16 (+3 Dex, +3 natural), flat-footed 13",
  "bab": "+2/+8*",
  "atk": "Tentacles +4 melee (0)",
  "fatk": "Tentacles +4 melee (0) and bite -1 melee (1d6+1)",
  "sa": "Improved grab",
  "sq": "Ink cloud, jet, low-light vision",
  "saves": "Fort +3, Ref +6, Will +2, Dodge +6",
  "attrs": "Str 14, Dex 17, Con 11, Int 1, Wis 12, Cha 2"
 },
 "Toad": {
  "page": 96,
  "size": "Diminutive Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+1; 5 ft. (1 hex)",
  "ac": "15/15 (+4 size, +1 Dex), flat-footed 14",
  "bab": "+0/-17",
  "atk": "—",
  "fatk": "—",
  "sa": "—",
  "sq": "Amphibious, low-light vision",
  "saves": "Fort +2, Ref +3, Will +2, Dodge +7",
  "attrs": "Str 1, Dex 12, Con 11, Int 1, Wis 14, Cha 4"
 },
 "Warhorse (heavy)": {
  "page": 78,
  "size": "Large Animal",
  "hd": "4d8+12 (30 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 50 ft. (10 hexes)",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+3/+11",
  "atk": "Hoof +6 melee (1d6+4)",
  "fatk": "2 hooves +6 melee (1d6+4) and bite +1 melee (1d4+2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +7, Ref +5, Will +2",
  "attrs": "Str 18, Dex 13, Con 17, Int 2, Wis 13, Cha 6"
 },
 "Warhorse (light)": {
  "page": 79,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 60 ft. (12 hexes)",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+2/+9",
  "atk": "Hoof +4 melee (1d4+3)",
  "fatk": "2 hooves +4 melee (1d4+3) and bite -1 melee (1d3+1)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +6, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 17, Int 2, Wis 13, Cha 6"
 },
 "Warpony": {
  "page": 87,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 40 ft. (8 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+3",
  "atk": "Hoof +3 melee (1d3+2)",
  "fatk": "2 hooves +3 melee (1d3+2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 15, Dex 13, Con 14, Int 2, Wis 11, Cha 4"
 },
 "Weasel": {
  "page": 97,
  "size": "Tiny Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 20 ft. (4 hexes), climb 20 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d3-4)",
  "fatk": "Bite +4 melee (1d3-4)",
  "sa": "Attach",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 2, Wis 12, Cha 5"
 },
 "Wolf": {
  "page": 99,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 50 ft. (10 hexes)",
  "ac": "12/14 (+2 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+2",
  "atk": "Bite +3 melee (1d6+1)",
  "fatk": "Bite +3 melee (1d6+1)",
  "sa": "Trip",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +5, Will +1, Dodge +5",
  "attrs": "Str 13, Dex 15, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Viper (Tiny)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Viper (Small)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Viper (Medium)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Shark (Medium)": {
  "page": 90,
  "ref": "columned block - see FF Shark entry p.90"
 },
 "Donkey": {
  "page": 35,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 30 ft. (6 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+1",
  "atk": "Bite +1 melee (1d2)",
  "fatk": "Bite +1 melee (1d2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 10, Dex 13, Con 12, Int 2, Wis 11, Cha 4",
  "carry": "light 50 / medium 100 / heavy 150 lb; drags 750 lb"
 },
 "Mule": {
  "page": 35,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 30 ft. (6 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+9",
  "atk": "Hoof +4 melee (1d4+3)",
  "fatk": "2 hooves +4 melee (1d4+3)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +6, Ref +4, Will +1, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 17, Int 2, Wis 11, Cha 6",
  "carry": "light 230 / medium 460 / heavy 690 lb; drags 3,450 lb"
 }
};
const RANGER_FE_TYPES = ['Aberration','Animal','Construct (Magic)','Construct (Tech)','Dragon','Elemental','Fey','Giant','Humanoid (aquatic)','Humanoid (dwarf)','Humanoid (elf)','Humanoid (gnome)','Humanoid (goblinoid)','Humanoid (halfling)','Humanoid (human)','Humanoid (mutant)','Humanoid (orc)','Humanoid (reptilian)','Magical Beast','Monstrous Humanoid','Ooze','Outsider (air)','Outsider (chaotic)','Outsider (earth)','Outsider (evil)','Outsider (fire)','Outsider (good)','Outsider (lawful)','Outsider (native)','Outsider (water)','Plant','Undead','Vermin'];
const TERRAIN_MASTERY_DATA = {
  'Aquatic':     { skill: 'Swim',          desc: '+4 competence Swim (or +10 ft swim speed); +1 insight on d20 rolls & damage vs aquatic creatures.' },
  'Desert':      { skill: null,            desc: 'Immune to fatigue (what would exhaust you fatigues you instead); +1 insight vs desert creatures.' },
  'Forest':      { skill: 'Hide',          desc: '+4 competence Hide; +1 insight vs forest creatures.' },
  'Hills':       { skill: 'Listen',        desc: '+4 competence Listen; +1 insight vs hills creatures.' },
  'Marsh':       { skill: 'Move Silently', desc: '+4 competence Move Silently; +1 insight vs marsh creatures.' },
  'Mountains':   { skill: 'Climb',         desc: '+4 competence Climb (or +10 ft climb speed); +1 insight vs mountain creatures.' },
  'Plains':      { skill: 'Spot',          desc: '+4 competence Spot; +1 insight vs plains creatures.' },
  'Underground': { skill: null,            desc: 'Darkvision 60 ft (120 ft if already had); +1 insight vs underground creatures.' },
};
const ROGUE_SPECIAL_ABILITIES = {
  'Crippling Strike': 'Sneak attacks also deal 2 points of Strength damage.',
  'Defensive Roll': '1/day (or 1 AP): when a blow would drop you to 0 or below, Dodge check DC = damage dealt to take half. Needs your Dex bonus to AC.',
  'Improved Evasion': 'Half damage even on a FAILED Reflex save for half.',
  'Opportunist': '1/round: attack of opportunity vs a foe just struck in melee by someone else.',
  'Skill Mastery': 'Take 10 under stress on 3 + Int mod chosen skills (repeatable pick).',
  'Slippery Mind': 'Re-roll a failed save vs mind-affecting 1 round later (once).',
  'Bonus Feat': 'Any feat you qualify for, instead of a special ability.',
};
function classChoiceVal(c, key) { return (c.classChoices || {})[key] || null; }
// Choice definitions: milestones gate instance count by class level. kind:
// 'skill' (opts by filter), 'save', 'attr3'/'attr6', 'enemy', 'enemyEsc',
// 'terrain', 'rogueSA'. competence:true = feeds +1 (stacking) into the skill.
const CLASS_CHOICE_DEFS = [
  { cls:'Fighter',    feature:'Improved Competence', base:'ftr_ic_',  ms:[3,7,11,15,19], kind:'skill', filter:'classSkill', competence:true, distinct:true, note:'+1 competence to a Fighter class skill — a different skill each instance.' },
  { cls:'Fighter',    feature:'Battle-Hardened',     base:'ftr_bh_',  ms:[5,9,13,17],    kind:'save', note:'+1 to the chosen saving throw (instances may repeat a save).' },
  { cls:'Aristocrat', feature:'Improved Competence', base:'ari_ic_',  ms:[2,4,6,8,12,14,16,18], kind:'skill', filter:'classSkill', competence:true, distinct:true, note:'+1 competence to a class skill — a different skill each instance.' },
  { cls:'Aristocrat', feature:'Decorum',             base:'ari_dec_', ms:[1],  kind:'skill', filter:'cha', note:'Skill Focus (granted automatically once picked) in a Cha-based class skill.' },
  { cls:'Aristocrat', feature:'Refinement',          base:'ari_ref_', ms:[3],  kind:'skill', filter:'int', note:'Skill Focus (granted automatically once picked) in an Int-based class skill.' },
  { cls:'Aristocrat', feature:'Mental Acuity',       base:'ari_ma_',  ms:[5,10,15,20], kind:'attr3', note:'+1 innate to Int, Wis, or Cha — BAKED into the attribute (Ex, permanent).' },
  { cls:'Expert',     feature:'Superior Competence', base:'exp_sc_',  ms:[2,4,6,8,10,12,14,16,18,20], kind:'skill', filter:'classSkill', competence:true, note:'+1 competence to an Expert class skill — the SAME skill may repeat (stacks).' },
  { cls:'Expert',     feature:'Artisan',             base:'exp_art_', ms:[5],  kind:'skill', filter:'classSkill', note:'The Artisan skill (5+ ranks, not Concentration): 2d20-take-best. Master @10 (Take 10 under duress), Renowned @15 (+Renown, +1 Purchase DC), Grandmaster @20 ride this pick.' },
  { cls:'Cleric',     feature:'Esoteric Knowledge',  base:'clr_ek_',  ms:[2,6,10,14,18], kind:'skill', filter:'knowledge', competence:true, note:'+1 competence on a Knowledge skill with 1+ ranks (repeats stack; locked once chosen).' },
  { cls:'Wizard',     feature:'Increased Competence', base:'wiz_inc_', ms:[2,6,14,18], kind:'skill', filter:'nonKnowledge', competence:true, distinct:true, note:'+1 competence to a non-Knowledge skill — a different skill each instance.' },
  { cls:'Wizard',     feature:'Esoteric Knowledge',  base:'wiz_ek_',  ms:[4,8,12,16,20], kind:'skill', filter:'knowledge', competence:true, note:'+1 competence on a Knowledge skill with 1+ ranks (repeats stack).' },
  { cls:'Psion',      feature:'Mental Acumen',       base:'psi_ma_',  ms:[2,4,8,16], kind:'skill', filter:'mental', competence:true, note:'+1 competence to an Int-, Wis-, or Cha-based skill (repeats allowed).' },
  { cls:'Ranger',     feature:'Favored Enemy',       base:'rgr_fe_',  ms:[1,5,10,15,20], kind:'enemy', note:'+2 on Bluff, Listen, Sense Motive, Spot, Survival and weapon damage vs the chosen type.' },
  { cls:'Ranger',     feature:'Favored Enemy escalation', base:'rgr_fesc_', ms:[5,10,15,20], kind:'enemyEsc', note:'+2 MORE against one already-chosen favored enemy (may be the new one).' },
  { cls:'Ranger',     feature:'Terrain Mastery',     base:'rgr_tm_',  ms:[7,13,19], kind:'terrain', distinct:true, note:'Per-terrain benefit + insight bonuses; must have been exposed; locked once chosen.' },
  { cls:'Rogue',      feature:'Special Ability',     base:'rog_sa_',  ms:[10,13,16,19,20], kind:'rogueSA', note:'Pick from the Rogue special-ability list (Skill Mastery may repeat).' },
  { cls:'Saint',      feature:'True Sainthood',      base:'snt_ts_',  ms:[20], kind:'attr6', note:'+4 inherent to one attribute of choice — BAKED (Ex, permanent).' },
  // v8.9.1 Advanced-class choices.
  { cls:'Daredevil',    feature:'Niche Specialty',        base:'dd_ns_',   ms:[1], kind:'skill', filter:'dex', note:'Skill Focus (granted automatically once picked) in a Dex-based class skill.' },
  { cls:'Soldier',      feature:'Weapon Focus',           base:'sol_wf_',  ms:[1], kind:'weapon', note:'The Soldier’s focused weapon (+1 attack; +2 damage from Weapon Specialization at 2nd; Improved Critical at 5th). Must be proficient.' },
  { cls:'Sharpshooter', feature:'Signature Weapon',       base:'shs_sw_',  ms:[2], kind:'weaponRanged', note:'The Signature RANGED weapon: Weapon Focus granted (+1 attack); +2 more at 8th (Signature Style); Bullseye targets it.' },
  { cls:'Weaponmaster', feature:'Chosen Weapon',          base:'wpm_cw_',  ms:[1], kind:'weaponMelee', note:'The mastered MELEE weapon — Weapon Control/Telling Blows/Totem/Precise Blow/Living Weapon all key to it.' },
  { cls:'Tactician',    feature:'Personalized Technique', base:'tct_pt_',  ms:[5], kind:'weapon', note:'+½ Int (down) to hit and +½ Int (up) to damage with the chosen weapon.' },
  { cls:'Personality',  feature:'Eclectic Taste',         base:'per_et_',  ms:[1,5], kind:'skill', filter:'all', distinct:true, note:'Designate a cross-class skill as a Personality class skill (apply to skill costs at the table).' },
  // v8.10.1 Prestige-class choices (Segment A).
  { cls:'Anti-Hero',       feature:'Adaptable',        base:'ah_ad_',  ms:[2,6,10], kind:'adaptable', note:'+1 Base Attack, +1 Defense Bonus, or a skill made a class skill with +1 competence (repeats stack).' },
  { cls:'Anti-Hero',       feature:'Battle-Hardened',  base:'ah_bh_',  ms:[4,8], kind:'save', note:'+1 to the chosen saving throw (may repeat).' },
  { cls:'Assassin',        feature:'Guildmaster perk', base:'asn_gm_', ms:[10], kind:'pick', options:['Renown','Low Profile'], note:'Leadership is granted automatically; choose the companion feat.' },
  { cls:'Eldritch Knight', feature:'Knighthood',       base:'ek_kh_',  ms:[10], kind:'pick', options:['Renown','Windfall','Both (formal Allegiance declared)'], note:'Renown or Windfall — BOTH with a formal Allegiance to the honoring organization.' },
  { cls:'Holy Knight',     feature:'Knighthood',       base:'hk_kh_',  ms:[10], kind:'pick', options:['Both (Allegiance to the god/church)'], note:'Every Holy Knight has an official Allegiance — both feats.' },
  { cls:'Elementalist',    feature:'Elemental Focus',  base:'ele_var_', ms:[1], kind:'pick', options:['Ambrian (air/electricity)','Kryonian (water/cold)','Vesuvian (fire/fire)','Vitrolian (earth/acid)'], note:'Drives Affinity saves, Adaptation resistance, Immunity, and every variant feature.' },
  // v8.70.0 (Adam's rulings): the per-level either-or advancers.
  { cls:'Loremaster',      feature:'Improved Magic / Psionics', base:'lm_adv_', ms:[1,2,3,4,5,6,7,8,9,10], kind:'pick',
    options:['Arcane','Divine','Psionic'],
    note:'Which pool THIS Loremaster level improves — decided as the level is attained (GG p.173; ruling 2026-10-02: any pool that could have QUALIFIED you — the 7-Divination / 7-Clairsentience gate — may be improved; “some Loremasters opt to diversify”). Unpicked levels default to Arcane (the pre-v8.70.0 behavior).' },
  { cls:'Assassin',        feature:'Improved Methods', base:'asn_im_', ms:[2,4,6,8,10], kind:'pick',
    options:['Assassinate DC +1','Advance: Arcane','Advance: Divine','Advance: Psionic'],
    note:'Either-or per level, decided when the level is attained (ruling 2026-10-02): +1 to the Assassinate save DC, OR advance an existing casting/manifesting class (PP + spells/powers known only). DC picks apply to the Assassinate feature at the table; Advance picks route the pool engine live.' },
  { cls:'Loremaster',      feature:'Secret',           base:'lm_sec_', ms:[1,3,5,7,9], kind:'pick', distinct:true,
    options:['Instant mastery (4 ranks, untrained skill)','Secret health (+3 HP)','Secrets of inner strength (+2 Will)','The lore of true stamina (+2 Fort)','Secret knowledge of avoidance (+2 Reflex)','Weapon trick (Weapon Focus)','Dodge trick (Dodge, prereqs waived)','Applicable knowledge (any feat)','Newfound arcana (1st-level spell/power)','More newfound arcana (2nd-level spell/power)'],
    note:'Tier must be ≤ Loremaster level + Int modifier (1–10 in list order; GM enforces); no repeats. HP/save picks bake live.' },
  { cls:'Planestrider',    feature:'Extreme Terrain Mastery', base:'pls_tm_', ms:[1,3,5,7,9], kind:'pick', distinct:true,
    options:['Aligned','Cold','Caustic','Fiery','Lightning Storms','Weightless'],
    note:'Resistance 20 terrains reach the Resist panel; each also grants +1 insight vs matching creatures (apply at the table).' },
  { cls:'Arcane Trickster', feature:'Trade Secrets',   base:'atk_ts_', ms:[5,9], kind:'skill', filter:'classSkill', note:'+2 INSIGHT to the chosen class skill (same skill twice = +4) — wired live.' },
  { cls:'Psychic Trickster', feature:'Trade Secrets',  base:'ptk_ts_', ms:[5,9], kind:'skill', filter:'classSkill', note:'+2 INSIGHT to the chosen class skill (same skill twice = +4) — wired live.' },
  // v8.11.1 SEGMENT B: the specialized-power menus. Archmage/Metamind picks
  // PERMANENTLY reduce the matching PP pool's maximum (the ledger reads
  // these picks live — clear a pick and the PP return, GM retcon).
  { cls:'Archmage',    feature:'High Arcana',    base:'arc_ha_', ms:[1,2,3,4,5], kind:'highArcana',
    note:'One per Archmage level, bought with PERMANENTLY spent arcane PP (shown per option; deducted live from the arcane pool max). No repeats except Arcane Reach (×2) and Spell-Like Ability; extra SLA frequency/feat infusions cost more PP — record with the GM.' },
  { cls:'Metamind',    feature:'Mental Mastery', base:'mm_mm_',  ms:[1,2,3,4,5], kind:'mentalMastery',
    note:'One per Metamind level, bought with PERMANENTLY spent psionic PP (deducted live). Mental Potency and Mental Reach may repeat; the 15-point masteries carry discipline requirements (GM verifies).' },
  { cls:'Ecclesiarch', feature:'Godly Gift',     base:'ecc_gg_', ms:[1,2,3,4,5], kind:'godlyGift',
    note:'One per Ecclesiarch level; free picks (only Spell-Like Ability spends permanent PP — record its spell-level cost with the GM). Class-gated options (Cleric/Saint/Druid) — GM verifies.' },
  { cls:'Elementalist', feature:'Greater Adaptation', base:'ele_ga_', ms:[7], kind:'eleGA', note:'The variant’s choice: an Advantage (add it on the Mutations tab at 0 MP — class-granted) or the movement upgrade.' },
  { cls:'Elementalist', feature:'Elemental Control (1st)', base:'ele_ec1_', ms:[9], kind:'eleEC', note:'First of two at-will powers from the variant’s list, manifested at class level.' },
  { cls:'Elementalist', feature:'Elemental Control (2nd)', base:'ele_ec2_', ms:[9], kind:'eleEC', note:'Second at-will power (pick a different one).' },
];
// Menu option costs (permanent PP; 0 = free / feat-instead options).
const HIGH_ARCANA_COSTS = {
  'Arcane Fire (CL-scaled bolt)': 17, 'Arcane Mastery (bonus Magic feat)': 0, 'Arcane Reach (touch at 30/60 ft)': 13,
  'Mastery of Counterspelling (turns spells back)': 13, 'Mastery of Elements': 15, 'Mastery of Shaping': 11,
  'Spell Power (+1 caster level)': 9, 'Spell-Like Ability (a spell 2/day)': 9,
};
const MENTAL_MASTERY_COSTS = {
  'Bonus Power Feat': 0, 'Mental Sculptor': 5, 'Mental Potency (+1 manifester level, stacks)': 5,
  'Mental Reach (touch at 30/60 ft)': 9, 'Monad (Psychoportation)': 15, 'Precog (Clairsentience — permanent Foresight)': 15,
  'Physical Phoenix (Metacreativity)': 15, 'Telekinetic Terror (Psychokinesis)': 15,
  'Telepathic Tyrant (Telepathy)': 15, 'Uncarnate (Psychometabolism — incorporeal)': 15,
};
const GODLY_GIFT_OPTIONS = ['Blast Infidel (maximize negative energy vs opposed alignment)', 'Divine Reach (touch at 30/60 ft)', 'Faith Healing (maximize healing on same alignment)', 'Gift of the Divine (Cleric — lend turn attempts)', 'Living Incarnation (Saint — avatar self-buffs)', 'Mastery of Energy (Cleric — +4 turning)', 'Magic Feat (bonus)', 'Power of Nature (Druid — lend class features)', 'Spell Power (+1 caster level, stacks)', 'Spell-Like Ability (permanent PP by spell level)'];
const ELEMENTAL_VARIANT_DATA = {
  'Ambrian (air/electricity)':  { ga: ['Echolocator Advantage', '+60′ Fly (180′ Perfect)'], ec: ['Control Winds', 'Lightning Bolt', 'Wind Wall'] },
  'Kryonian (water/cold)':      { ga: ['Elasticity Advantage', '+30′ Swim + Gills Advantage'], ec: ['Cone of Cold', 'Fog Cloud', 'Sleet Storm'] },
  'Vesuvian (fire/fire)':       { ga: ['X-Ray Vision Advantage', '+60′ Fly (120′ Perfect)'], ec: ['Fireball', 'Heat Metal', 'Wall of Fire'] },
  'Vitrolian (earth/acid)':     { ga: ['Enlarged Form Advantage', 'Skeletal Reinforcement Advantage'], ec: ['Grip of Iron', 'Immovability', 'Stomp'] },
};
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
function setClassChoice(key, value) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.classChoices) c.classChoices = {};
  if (value) c.classChoices[key] = value; else delete c.classChoices[key];
  if (typeof reconcileClassAttrBakes === 'function') reconcileClassAttrBakes(c);
  if (typeof reconcileGrantedFeats === 'function') reconcileGrantedFeats(c);
  save(); renderSheet(); renderSkills(); renderGear();
}
// The Sheet's 🎓 Class Choices panel.
function renderClassChoices(c) {
  const host = document.getElementById('sh-classchoices');
  if (!host) return;
  const specs = computeClassChoiceSpecs(c);
  // v8.66.0: the skill-set designations can exist without picker specs —
  // the empty-panel gate must consider both.
  const _ssAny = (typeof computeSkillSetSpecs === 'function') && computeSkillSetSpecs(c).length > 0;
  if (!specs.length && !_ssAny) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const pending = specs.filter(s => !s.chosen).length;
  const rows = specs.map(s => {
    const extra = s.kind === 'terrain' && s.chosen ? ` <span style="opacity:var(--o65);color:var(--dim);">— ${TERRAIN_MASTERY_DATA[s.chosen].desc}</span>`
      : s.kind === 'rogueSA' && s.chosen ? ` <span style="opacity:var(--o65);color:var(--dim);">— ${ROGUE_SPECIAL_ABILITIES[s.chosen]}</span>` : '';
    const sel = s.chosen
      ? `<b style="color:rgba(120,175,205,.95);">${escapeHTML(s.chosen)}</b>${extra} <span style="cursor:pointer;opacity:.5;font-size:10px;" title="Clear this choice (GM retcon)" onclick="setClassChoice('${s.key}','')">✕</span>`
      : `<select onchange="setClassChoice('${s.key}', this.value)" style="font-size:11px;"><option value="">— choose —</option>${s.options.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select>`;
    return `<div style="display:flex;gap:8px;align-items:center;font-size:11.5px;margin:2px 0;">
      <span style="flex:0 0 auto;cursor:help;color:var(--g75);" title="${escapeHTML(s.note)}">${s.className} — ${s.feature}${s.idx > 1 || s.kind === 'skill' || s.kind === 'save' || s.kind === 'enemy' ? ` #${s.idx}` : ''} <span style="opacity:var(--o50);color:var(--dim);">(L${s.atLvl})</span></span>
      <span style="flex:1;">${sel}</span></div>`;
  }).join('');
  const feList = computeFavoredEnemies(c);
  const feRow = feList.length ? `<div style="font-size:11px;margin-top:4px;color:var(--g80);">🎯 <b>Favored Enemies:</b> ${feList.map(f => `${escapeHTML(f.type)} +${f.bonus}`).join(', ')} <span style="opacity:var(--o60);color:var(--dim);">(damage &amp; Bluff/Listen/Sense Motive/Spot/Survival vs the type — apply at the table)</span></div>` : '';
  // v8.66.0 (Adam's design): Take-10 skill-set designations — collapsible
  // one-liners, ⚑-amber while open slots remain, red while over capacity.
  const ssSpecs = (typeof computeSkillSetSpecs === 'function') ? computeSkillSetSpecs(c) : [];
  let ssRows = '', ssPending = 0;
  if (ssSpecs.length) {
    if (!window._ssOpen) window._ssOpen = {};
    ssRows = ssSpecs.map(s => {
      const picks = ((c.skillSets || {})[s.key]) || [];
      const open = !!window._ssOpen[s.key];
      const slotsLeft = Math.max(0, s.cap - picks.length);
      const over = picks.length > s.cap;
      if (slotsLeft) ssPending += slotsLeft;
      const opts = s.eligible.filter(n => !picks.includes(n));
      const body = open ? `<div style="margin:2px 0 4px 18px;font-size:11px;">
          ${picks.map((p, i) => `<span style="display:inline-block;margin:1px 8px 1px 0;color:rgba(120,175,205,.95);">${escapeHTML(p)} <span style="cursor:pointer;opacity:.5;font-size:10px;" title="Remove this designation (GM retcon)" onclick="removeSkillSetPick('${s.key}',${i})">✕</span></span>`).join('') || '<i style="opacity:.5;">none designated yet</i>'}
          ${slotsLeft > 0 ? `<div style="margin-top:2px;"><select onchange="addSkillSetPick('${s.key}', this.value)" style="font-size:11px;"><option value="">— designate a skill (${slotsLeft} open) —</option>${opts.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select></div>` : ''}
          ${over ? `<div style="color:var(--red-text);font-size:10px;">⚠ ${picks.length - s.cap} over capacity — the base ${s.attrName} score dropped; the GM adjudicates which designations lapse (nothing auto-deletes).</div>` : ''}
        </div>` : '';
      return `<div style="font-size:11.5px;margin:2px 0;">
        <span style="cursor:pointer;user-select:none;" onclick="window._ssOpen['${s.key}']=!window._ssOpen['${s.key}'];renderClassChoices(chars.find(x=>x.id===curId))">${open ? '▾' : '▸'}</span>
        <span style="cursor:help;color:var(--g75);" title="${escapeHTML(s.note)}">${s.className} — ${s.feature} <span style="opacity:var(--o50);color:var(--dim);">(L${s.atLvl} · Take 10)</span></span>
        <b style="color:rgba(120,175,205,.95);">${picks.length}/${s.cap} designated</b>${slotsLeft ? ` <span style="color:#d4b870;font-size:10px;">⚑ ${slotsLeft} open</span>` : ''}${over ? ' <span style="color:var(--red-text);font-size:10px;">⚠ over capacity</span>' : ''}
      </div>${body}`;
    }).join('');
  }
  const pendingAll = pending + ssPending;
  host.innerHTML = `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);margin-bottom:4px;">🎓 Class Choices${pendingAll ? ` <span style="color:#d4b870;font-size:9px;">(${pendingAll} pending)</span>` : ''}</div>${rows}${ssRows}${feRow}`;
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
  const su = (typeof suBakedPerAttr === 'function') ? (suBakedPerAttr(c) || [0, 0, 0, 0, 0, 0]) : [0, 0, 0, 0, 0, 0];
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
function addSkillSetPick(key, val) {
  if (!val) return;
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.skillSets) c.skillSets = {};
  if (!c.skillSets[key]) c.skillSets[key] = [];
  if (!c.skillSets[key].includes(val)) c.skillSets[key].push(val);
  if (!window._ssOpen) window._ssOpen = {};
  window._ssOpen[key] = true;
  if (typeof logAct === 'function') logAct(`🎓 ${key === 'shutItOut' ? 'Shut It Out' : 'Skill Mastery'}: ${val} designated (Take 10 even under duress).`);
  save(); renderClassChoices(c);
}
function removeSkillSetPick(key, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const arr = (c.skillSets || {})[key]; if (!arr || idx < 0 || idx >= arr.length) return;
  const gone = arr.splice(idx, 1)[0];
  if (typeof logAct === 'function') logAct(`🎓 ${key === 'shutItOut' ? 'Shut It Out' : 'Skill Mastery'}: ${gone} designation removed (GM retcon).`);
  save(); renderClassChoices(c);
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
// v8.9.1: class-feature HP bakes — the Bodyguard's Toughness instances
// (@2, @8: +1 HP per CHARACTER level each, live-recomputed as levels grow).
// Ledger c.classHpApplied follows the talentHpApplied convention (NOT
// preserved on edit-save; re-applied onto the fresh maxHP).
function reconcileClassHp(c) {
  if (!c || !isFinite(c.maxHP)) return false;
  const bgLvl = migrateLegacyClasses(c).filter(e => e.name === 'Bodyguard').reduce((s, e) => s + (e.level || 0), 0);
  const instances = (bgLvl >= 8 ? 2 : (bgLvl >= 2 ? 1 : 0));
  let expected = instances * (c.totalLvl || 0);
  // v8.10.1: Loremaster "Secret health" pick — +3 flat HP.
  if (c.classChoices) for (const k in c.classChoices) {
    if (k.startsWith('lm_sec_') && /Secret health/.test(c.classChoices[k])) expected += 3;
  }
  const applied = c.classHpApplied || 0;
  if (expected !== applied) {
    c.maxHP += expected - applied;
    if (expected > applied && isFinite(c.currentHP)) c.currentHP += expected - applied;
    c.classHpApplied = expected;
    return true;
  }
  return false;
}

