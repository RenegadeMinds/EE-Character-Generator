// =============================================================================
// js/data/class-features.js
// CLASS FEATURES — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. What every class gains at each level
//   (CLASS_FEATURES) and the class-choice menus (favored enemies, terrain
//   mastery, ...).
//
// KEY NAMES (so you can search for them)
//   tables and state: CLASS_FEATURES, DRUID_OPTION_FEATURES,
//   RANGER_FE_TYPES, TERRAIN_MASTERY_DATA, ROGUE_SPECIAL_ABILITIES,
//   CLASS_CHOICE_DEFS, HIGH_ARCANA_COSTS, MENTAL_MASTERY_COSTS,
//   GODLY_GIFT_OPTIONS, ELEMENTAL_VARIANT_DATA
//
// WHERE IT CAME FROM
//   Gathered from js/rules/02-class-features.js, js/rules/17-per-diem-and-
//   class-choices.js when the code was regrouped by topic and page. Each
//   function and table moved whole and unchanged, with the comments above
//   it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ========== CLASS_FEATURES (v8.3.1) ==========
//
// Declarative class-feature data + effects framework. Each Basic class is
// listed with its feature progression in handbook order. Each entry:
//   - lvl:     minimum class level at which the feature becomes available
//   - name:    feature name (display + lookup key)
//   - page:    handbook page number for the player to reference
//   - desc:    brief description (one-line summary; full text in handbook)
//   - kind:    'passive' (numeric effect applied automatically),
//              'active' (player triggers; informational here),
//              'meta' (alters character creation/budgeting — e.g. bonus feat slot),
//              'unimplemented' (declared but not yet mechanized)
//   - effect:  optional structured effect declaration (see effect taxonomy
//              below). Required for kind='passive'|'meta' when the engine
//              should automatically apply the effect.
//
// EFFECT TAXONOMY — extensible. Each effect.type is interpreted by the
// matching handler in applyClassFeatureEffects() and related routines:
//   {type:'touchAcBonus',  source:'attr:CHA-mod'}     — adds Cha mod to Touch AC
//   {type:'acBonus',       source:..., target:'all'|'touch'|'flat', stack:'untyped'|'dodge'|'morale'|...}
//   {type:'bonusFeats',    formula:string, restriction:string} — extra feat slots
//   {type:'skillBonus',    target:'<skill>'|'<family>', amount:N, stack:'competence'|...}
//   {type:'savingThrowBonus', target:'fort'|'ref'|'will'|'all', amount:N, stack:..., condition:...}
//   {type:'damageReduction', amount:N}
//   {type:'casterLevelBonus', pool:'arcane'|'divine'|'psionic', amount:N}
//
// As more feature handlers are wired, expand this taxonomy. The framework's
// goal is: ADDING a new feature should be a single data entry, not a code
// edit, in the common case.
//
// SCOPE FOR v8.3.1: I commit to mechanizing two specific effects this slice:
//   1. Wilder L2 Elude Touch  → touchAcBonus
//   2. Expert L1+ Bonus Expert Feat → bonusFeats (every odd Expert level)
// Every other feature is captured as data with kind:'unimplemented', so it
// shows on the sheet and has a clear path to future implementation without
// being a hidden surprise.
const CLASS_FEATURES = {
  // v8.8.2 BOOK-VERIFICATION SWEEP (Adam's Basic-class pass): the v8.3.1
  // seed data for several classes was d20 Modern / 3.5 SRD content, not the
  // E&E book's. Every Basic class below is now verified line-by-line against
  // hh_text.txt (HH pp.72–109). Two book-internal table-vs-text conflicts
  // found (Expert Artisan tiers, Saint Bonus Feat level) — flagged in the
  // affected entries and on Adam's errata list.
  'Aristocrat': [
    {lvl:1, name:'Influence',           page:74, desc:'Leverage Reputation into Favors (works like the Charismatic Hero’s Favor talent using the Reputation modifier). Calling in a Favor: −1 Influence to Reputation until repaid; fulfilling public Favors: +1 Influence each (max = Cha mod); private Favors bank an auto-callable marker. Unpaid called Favors: permanent −1 Reputation (“oathbreaker”).', kind:'active'},
    {lvl:1, name:'Decorum',             page:74, desc:'Skill Focus (bonus feat) in one Charisma-based class skill of choice.', kind:'meta'},
    {lvl:2, name:'Improved Competence', page:74, desc:'+1 competence bonus to one class skill of choice at 2nd, 4th, 6th, 8th, 12th, 14th, 16th, and 18th level — a DIFFERENT skill each time.', kind:'unimplemented'},
    {lvl:3, name:'Refinement',          page:74, desc:'Skill Focus (bonus feat) in one Intelligence-based class skill of choice.', kind:'meta'},
    {lvl:5, name:'Bonus Feat',          page:74, desc:'Bonus feat from the Aristocrat list at 5th, 10th, 15th, and 20th level. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5,10,15,20]},
       restriction:['Alertness','Combat Martial Arts','Confident','Deceitful','Deceptive','Defensive Martial Arts','Educated','Investigator','Meticulous','Mounted Combat','Negotiator','Persuasive','Skill Focus','Track','Urban Tracking','Weapon Finesse','Weapon Focus']}},
    {lvl:5, name:'Mental Acuity',       page:74, desc:'+1 innate bonus to one mental attribute (Int, Wis, or Cha — player’s choice) at 5th, 10th, 15th, and 20th level.', kind:'unimplemented'},
    {lvl:7, name:'Windfall',            page:74, desc:'The Windfall feat as a bonus feat, at 7th and again at 13th level (wealth system: +3 Wealth each).', kind:'meta'},
    {lvl:9, name:'Leadership',          page:74, desc:'The Leadership feat as a bonus feat (a confidante / 2nd-in-command).', kind:'meta'},
    {lvl:11, name:'Renown',             page:75, desc:'The Renown feat as a bonus feat (+3 Reputation).', kind:'meta'},
    {lvl:19, name:'Land & Title',       page:75, desc:'Granted land (+4 Wealth score) and title (+1 Reputation) plus a Steward — a second Cohort with 1+ level of Bodyguard (domestic) or Ambassador (foreign). — the +1 Reputation is WIRED (v8.64.0); land, +4 Wealth, and the Steward are manual', kind:'meta'},
  ],
  // Bard: the v8.3.1 'Sneak Attack +1d6' entry was DRIFT — the E&E Bard has
  // no sneak attack. Real feature set verified against HH pp.75–78.
  'Bard': [
    {lvl:1, name:'Bard Spells',        page:76, desc:'Arcane spontaneous caster (Cha-based; Arcane Scale 1+; at Arcane Scale 0 the Bard instead accrues Storyteller: +1 competence to a Cha-based class skill per instance, stacking). See Powers & Spells panel for PP budget, CL, and spells known.', kind:'passive'},
    {lvl:1, name:'Bardic Knowledge',   page:77, desc:'Special check (1d20 + Bard level + Int mod) for notable people, legendary items, noteworthy places. +2 with 5+ ranks Knowledge (history). No Take 10/20. DC 10 common / 20 uncommon / 25 obscure / 30 extremely obscure.', kind:'active'},
    {lvl:1, name:'Bardic Music',       page:77, desc:'Bard level uses/day of magical performance. Each ability gates on Bard level AND Perform ranks (see below).', kind:'active'},
    {lvl:1, name:'Countersong',        page:77, desc:'(3+ Perform ranks, Su) Counter sonic/language-dependent magical attacks — allies within 30 ft may use the Perform check in place of their save; up to 10 rounds.', kind:'active'},
    {lvl:1, name:'Fascinate',          page:77, desc:'(3+ Perform ranks, Sp) Fascinate 1 creature within 90 ft (+1 per 3 Bard levels beyond 1st); Perform check sets the Will DC; up to 1 round per Bard level.', kind:'active'},
    {lvl:1, name:'Inspire Courage',    page:78, desc:'(5+ Perform ranks, Su) Allies who hear: +1 morale on saves vs charm/fear and on attack/weapon damage rolls; lasts while heard + 5 rounds. +2 at 8th, +3 at 14th, +4 at 20th.', kind:'active'},
    {lvl:3, name:'Inspire Competence', page:78, desc:'(7+ Perform ranks, Su) One ally within 30 ft: +2 competence on a skill while they hear the music, up to 2 minutes. Not on self.', kind:'active'},
    {lvl:5, name:'Bonus Feat',         page:78, desc:'Any feat the Bard qualifies for, at 5th, 11th, and 17th level.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5,11,17]}, restriction:'any feat'}},
    {lvl:6, name:'Suggestion',         page:78, desc:'(10+ Perform ranks, Sp) Suggestion (as the spell) on an already-fascinated creature; Will DC 10 + ½ Bard level + Cha mod; doesn’t count against daily music uses.', kind:'active'},
    {lvl:9, name:'Inspire Greatness',  page:78, desc:'(13+ Perform ranks, Su) Self or 1 willing ally (+1 per 3 levels beyond 9th): +2 bonus Hit Dice (d10s + Con) as temporary HP, +2 competence attack, +1 competence Fort; lasts while heard + 5 rounds.', kind:'active'},
    {lvl:12, name:'Song of Freedom',   page:78, desc:'(15+ Perform ranks, Sp) Break Enchantment (CL = Bard level) on one target within 30 ft; 1 minute of uninterrupted music. Not on self.', kind:'active'},
    {lvl:15, name:'Inspire Heroics',   page:78, desc:'(19+ Perform ranks, Su) Self or 1 willing ally (+1 per 3 levels beyond 15th): +4 morale on saves, +4 dodge AC; full-round action to start.', kind:'active'},
    {lvl:18, name:'Mass Suggestion',   page:78, desc:'(20+ Perform ranks, Sp) As Suggestion but on any number of fascinated creatures.', kind:'active'},
    {lvl:19, name:'Magnum Opus',       page:78, desc:'Equivalent of the Renown feat, plus +2 circumstance to all Cha-based skill checks with anyone who recognizes the Bard as the ballad’s author. — the +3 Reputation is WIRED (v8.64.0); the +2 circumstance is a table call', kind:'passive'},
  ],
  'Berserker': [
    {lvl:1, name:'Fast Movement',         page:79, desc:'+10 ft. land speed when wearing light/medium/no armor. — wired into Speed (v8.8.2: armor-gated, load caveat in the tooltip)', kind:'passive'},
    {lvl:1, name:'Rage',                  page:79, desc:'X/day: +4 STR, +4 CON, +2 morale Will saves, –2 AC, lasts 3+CON-mod rounds. Fatigued after.', kind:'active'},
    {lvl:2, name:'Uncanny Dodge',         page:80, desc:'Retain Dex bonus to AC when flat-footed or struck by invisible attacker. — wired as the Defense-cell tag (v8.64.0, unified sources incl. the second-class auto-upgrade)', kind:'passive'},
    {lvl:3, name:'Trap Sense',            page:80, desc:'+1 Ref save vs traps, +1 dodge AC vs trap attacks; +1 more at L6/9/12/15/18.', kind:'unimplemented'},
    {lvl:5, name:'Improved Uncanny Dodge', page:80, desc:'Cannot be flanked (Rogue must be 4+ levels higher to sneak-attack). — wired as the Defense-cell tag (v8.64.0)', kind:'passive'},
    {lvl:7, name:'Damage Reduction',      page:80, desc:'DR 1/—, +1 at L10/13/16/19 — wired into the class-level x/− pool (computeDR since v8.8.0; the flag lied until v8.86.0) and the DR dashboard cell.', kind:'passive'},
    {lvl:11, name:'Greater Rage',         page:80, desc:'Rage bonuses increase to +6 STR/CON, +3 Will. — wired (rageTier: the toggle scales automatically)', kind:'passive'},
    {lvl:14, name:'Indomitable Intent',   page:80, desc:'+4 Will vs enchantment while raging.', kind:'unimplemented'},
    {lvl:17, name:'Tireless Rage',        page:80, desc:'No longer fatigued after rage. — wired (toggleRage skips the fatigue at 17+)', kind:'passive'},
    {lvl:20, name:'Mighty Rage',          page:80, desc:'Rage bonuses increase to +8 STR/CON, +4 Will. — wired (rageTier: the toggle scales automatically)', kind:'passive'},
  ],
  'Cleric': [
    {lvl:1, name:'Divine Spells',         page:83, desc:'Divine prepared caster. See Powers & Spells panel for PP budget, CL, save DC, and prepared spells.', kind:'passive'},
    {lvl:1, name:'Turn or Rebuke Undead', page:82, desc:'Channel positive/negative energy vs undead, X/day.', kind:'active'},
    {lvl:1, name:'Aura',                  page:81, desc:'Alignment aura matching deity.', kind:'passive'},
    {lvl:1, name:'Spontaneous Casting',   page:82, desc:'Convert any uncast prepared spell into a Cure Wounds (Good) or Inflict Wounds (Evil) of the same level or lower — Neutral Clerics choose one direction at character creation. Use the ⇄ button in the Prepared Spells panel (Powers & Spells tab); leftover unallocated PP can also be held back at dawn for direct spontaneous casting.', kind:'active'},
    {lvl:2, name:'Esoteric Knowledge',    page:82, desc:'At 2nd, 6th, 10th, 14th, and 18th level: +1 competence bonus on one Knowledge skill with 1+ ranks (same or different skill each time; locked once selected).', kind:'unimplemented'},
    {lvl:4, name:'Bonus Feat',            page:82, desc:'Bonus Magic feat at L4, L12, and L20 (3 total). Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[4,12,20]}, restriction:'Magic feat list'}},
    {lvl:8, name:'Expanded Domain',       page:82, desc:'At 8th and 16th level: petition the deity for one spell/power not normally available, related to a domain (GM’s judgment) — becomes a domain spell.', kind:'active'},
    {lvl:19, name:'Additional Domain',    page:83, desc:'Gain the granted power and domain spell list of another of the god’s domains (or a bonus Magic feat if none remain).', kind:'meta'},
  ],
  'Expert': [
    // v8.3.1: MECHANIZED. The Expert gets a bonus Expert feat at every odd
    // Expert class level (1, 3, 5, ..., 19). The 'bonusFeats' effect feeds
    // computeBonusFeatsFromClassFeatures() which augments the maxFeats
    // budget used by renderFeats(). The restriction tag is informational
    // for now; until we wire feat-list filtering by tag, the player picks
    // any feat that fits and notes "from Expert bonus" in their sheet.
    {lvl:1, name:'Bonus Expert Feat', page:84, desc:'At every odd Expert level: one bonus feat from the Expert feat list (HH p.195).', kind:'meta',
     effect:{type:'bonusFeats', formula:'expertOddLevels', restriction:'Expert feat list'}},
    {lvl:2, name:'Superior Competence', page:85, desc:'At every even Expert level: +1 competence bonus to any Expert class skill — the SAME skill may be chosen repeatedly (instances stack, and stack with other competence bonuses). — wired via the Class Choices picker', kind:'meta'},
    {lvl:5, name:'Artisan',             page:85, desc:'Pick an Expert class skill (not Concentration) with 5+ ranks as the Artisan skill; roll 2d20-take-best on it.', kind:'unimplemented'},
    // BOOK CONFLICT (flagged on Adam's errata list): the level TABLE (p.84)
    // shows Renowned Artisan at 10th and Master Artisan at 15th, but the
    // feature TEXT keys Master to 10+ ranks and says Renowned is "By
    // 15th-level" with 15+ ranks. Following the TEXT (which the rank gates
    // only make sense with) until Adam rules.
    {lvl:10, name:'Master Artisan',     page:85, desc:'(10+ Artisan ranks) Always Take 10 on the Artisan skill, even under duress. RULED 2026-10-02: feature text canonical — Master at 10th, Renowned at 15th (the table row is the typo; Word doc updated). Take-10 permission, table-adjudicated.', kind:'passive'},
    {lvl:15, name:'Renowned Artisan',   page:85, desc:'(15+ Artisan ranks) Renown feat (+3 Rep) in matters of the Artisan skill, and +1 Purchase DC on all their work. RULED 2026-10-02: feature TEXT canonical (Renowned 15th / Master 10th; table row = the typo, Word doc updated). The scoped +3 is flagged on the Reputation card (v8.66.0); Purchase DC manual.', kind:'passive'},
    {lvl:20, name:'Grandmaster Artisan', page:85, desc:'(20+ Artisan ranks) Take 20 in half the time on the Artisan skill; +2 Purchase DC on their works (replaces Renowned Artisan’s +1).', kind:'unimplemented'},
  ],
  // Fighter: 'Tactical Awareness' was DRIFT (d20 Modern Soldier). Real
  // features verified against HH pp.85–86.
  'Fighter': [
    {lvl:1, name:'Bonus Feat (Fighter)', page:85, desc:'Bonus Fighter feat at L1 and every even level (2, 4, 6, ..., 20). Total: 11 by L20.', kind:'meta',
     effect:{type:'bonusFeats', formula:'fighterPattern', restriction:'Fighter feat list'}},
    {lvl:3, name:'Improved Competence',  page:86, desc:'+1 competence bonus to any Fighter class skill at 3rd, 7th, 11th, 15th, and 19th level — a DIFFERENT skill each time.', kind:'unimplemented'},
    {lvl:5, name:'Battle-Hardened',      page:86, desc:'+1 bonus to the saving throw of choice at 5th, 9th, 13th, and 17th level.', kind:'unimplemented'},
  ],
  // Monk: the v8.3.1 entry was 3.5 SRD Monk, not E&E's (no unarmed damage
  // ladder here — that's what CMA is for; no generic bonus-feat track).
  // Real progression verified against HH pp.86–88.
  'Monk': [
    {lvl:1, name:'Flurry of Blows',      page:87, desc:'Virtual Two-Weapon Fighting when using only unarmed attacks (or a quarterstaff) and unarmored — wired on the Gear tab’s unarmed row.', kind:'passive'},
    {lvl:1, name:'First Degree Belt',    page:87, desc:'Pick one of Elusive Target, Improved Grapple, Nerve Pinch, or Stunning Fist — prerequisites WAIVED.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[1]}, restriction:['Elusive Target','Improved Grapple','Nerve Pinch','Stunning Fist'], prereqsWaived:true}},
    {lvl:2, name:'Evasion',              page:87, desc:'Successful Reflex save vs a half-damage effect → no damage instead. — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:2, name:'Second Degree Belt',   page:87, desc:'Pick one of Blind-Fight, Combat Reflexes, Combat Throw, or Deflect Arrows — prerequisites WAIVED.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2]}, restriction:['Blind-Fight','Combat Reflexes','Combat Throw','Deflect Arrows'], prereqsWaived:true}},
    {lvl:3, name:'Still Mind',           page:87, desc:'+2 on saves vs mind-affecting spells and effects WHILE FOCUSED (see Concentration).', kind:'unimplemented'},
    {lvl:3, name:'Wild Talent',          page:87, desc:'(wired v9.2.2: +2 PP in the psionic pool) The Monk becomes a psionic character: 2 PP and access to the Power feat list; can psionically focus via a full-round Concentration check.', kind:'passive'},
    {lvl:4, name:'Ki Strike (Magic)',    page:87, desc:'(Su) While focused, unarmed attacks count as MAGIC vs DR and ignore 5 points of hardness. — wired: focus-aware rider on the unarmed row (v8.64.0)', kind:'passive'},
    {lvl:4, name:'Slow Fall',            page:87, desc:'Within 10 ft of a wall: reduce falling damage by 20 ft worth at 4th (2d6), +10 ft per 2 levels (30′@6, 40′@8, 50′@10, 60′@12, 70′@14, 80′@16, 90′@18); ANY distance at 20th.', kind:'unimplemented'},
    {lvl:5, name:'Purity of Body',       page:87, desc:'Immune to disease (not supernatural/magical diseases) + the Speed of Thought virtual feat.', kind:'unimplemented'},
    {lvl:6, name:'Third Degree Belt',    page:87, desc:'Pick one of Improved Disarm, Improved Trip, Sidestep Charge, or Unbalance Opponent — prerequisites WAIVED.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[6]}, restriction:['Improved Disarm','Improved Trip','Sidestep Charge','Unbalance Opponent'], prereqsWaived:true}},
    {lvl:7, name:'Wholeness of Body',    page:88, desc:'Self-heal up to 2× Monk level HP/day, divisible across applications.', kind:'active'},
    {lvl:8, name:'Power Fist',           page:88, desc:'The Power Fist feat as a bonus feat — prerequisites waived.', kind:'meta'},
    {lvl:9, name:'Improved Evasion',     page:88, desc:'As Evasion; failed save → only half damage (spend focus). — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:10, name:'Ki Strike (Lawful)',  page:87, desc:'(Su) While focused: unarmed hits deal +1d6 and count as LAWFUL vs DR. — wired: focus-aware rider on the unarmed row (v8.64.0)', kind:'passive'},
    {lvl:11, name:'Diamond Body',        page:88, desc:'(Su) Immune to poisons of all kinds.', kind:'unimplemented'},
    {lvl:11, name:'Greater Flurry',      page:88, desc:'One additional unarmed attack at highest BAB on a full attack. — wired into the Flurry alt mode (v8.64.0)', kind:'passive'},
    {lvl:12, name:'Abundant Step',       page:88, desc:'(Su) Dimension Door 1/day, CL = ½ Monk level.', kind:'active'},
    {lvl:13, name:'Diamond Soul',        page:88, desc:'(Ex) Spell Resistance = Monk level + 10.', kind:'unimplemented'},
    {lvl:14, name:'Greater Power Fist',  page:88, desc:'The Greater Power Fist feat as a bonus feat — prerequisites waived.', kind:'meta'},
    {lvl:15, name:'Quivering Palm',      page:88, desc:'(Su) 1/week, while focused, announced: on a damaging hit, may later will the target dead (Fort DC 10 + ½ Monk level + Wis mod negates) within Monk-level days.', kind:'active'},
    {lvl:16, name:'Ki Strike (Adamantine)', page:87, desc:'(Su) Unarmed blows count as ADAMANTINE vs DR/hardness; ignore the first 20 points of hardness. — wired: rider on the unarmed row (v8.64.0)', kind:'passive'},
    {lvl:17, name:'Timeless Body',       page:88, desc:'No aging penalties (bonuses still accrue); cannot be magically aged.', kind:'passive'},
    {lvl:17, name:'Tongue of the Sun and Moon', page:88, desc:'Speak with any living creature.', kind:'passive'},
    {lvl:19, name:'Empty Body',          page:88, desc:'(Su) Ethereal (as Etherealness) up to Monk-level rounds/day, divisible.', kind:'active'},
    {lvl:20, name:'Perfect Self',        page:88, desc:'Becomes a magical creature — treated as an Outsider for spells/magical effects.', kind:'passive'},
  ],
  'Paladin': [
    {lvl:1, name:'Aura of Good',         page:89, desc:'(Ex) Detectable Good aura, strength = Paladin level.', kind:'passive'},
    {lvl:1, name:'Detect Evil',          page:89, desc:'(Sp) Detect Evil at will.', kind:'active'},
    {lvl:1, name:'Smite Evil',           page:89, desc:'(Su) 1/day (2/day@5, 3@10, 4@15, 5@20): one melee attack at +Cha mod to hit, +1 damage per Paladin level vs an Evil target (wasted if the target isn’t evil).', kind:'active'},
    {lvl:2, name:'Divine Grace',         page:90, desc:'(Su) +Cha bonus (minimum +1) on ALL saving throws.', kind:'unimplemented'},
    {lvl:2, name:'Lay on Hands',         page:90, desc:'(Su) Heal (Paladin level × Cha bonus, min ×1) HP/day by touch, divisible; or spend points as damage vs undead via melee touch.', kind:'active'},
    {lvl:3, name:'Aura of Courage',      page:90, desc:'(Su) Immune to fear (magical or otherwise); allies within 10 ft: +4 morale vs fear. Only while conscious.', kind:'unimplemented'},
    {lvl:3, name:'Divine Health',        page:90, desc:'(Ex) Immune to ALL diseases, including supernatural and magical. — wired into the immunity registry', kind:'passive'},
    {lvl:4, name:'Turn Undead',          page:90, desc:'(Su) 3 + Cha mod times/day, as a Cleric of (Paladin level − 3).', kind:'active'},
    {lvl:4, name:'Paladin Spells',       page:91, desc:'Spontaneous divine caster from the god’s Domain lists (like a Saint); CL = ½ Paladin level ROUNDED UP; DC uses the better of Wis/Cha.', kind:'passive'},
    {lvl:5, name:'Special Mount',        page:90, desc:'(Sp) An unusually intelligent, strong, loyal steed (heavy warhorse / warpony typical; setting alternatives by GM). If it dies: no new mount for 30 days or a level, −1 attack/damage meanwhile.', kind:'meta'},
    {lvl:6, name:'Remove Disease',       page:90, desc:'(Sp) 1/week, +1 per 3 levels past 6th (2@9, 3@12, 4@15, 5@18). An instance may instead power a Lay on Hands for (Paladin level + Cha mod) HP.', kind:'active'},
    {lvl:7, name:'Mettle',               page:90, desc:'(Ex) A successful Fortitude or Will save vs a half/partial effect negates it entirely.', kind:'unimplemented'},
    {lvl:10, name:'Bonus Feat',          page:90, desc:'Any feat the Paladin qualifies for.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[10]}, restriction:'any feat'}},
    {lvl:13, name:'Pious Grace',         page:90, desc:'Divine Grace improves by +1 at 13th and again at 19th level.', kind:'unimplemented'},
    {lvl:16, name:'Favor of the Gods',   page:91, desc:'(Ex) 1/day: re-roll any d20 roll; the second result stands.', kind:'active'},
  ],
  'Psion': [
    {lvl:1, name:'Psionic Powers',     page:91, desc:'Psionic manifester (Int-based). See Powers & Spells panel for PP budget, ML, save DC, and powers known.', kind:'passive'},
    {lvl:1, name:'Bonus Feat',         page:92, desc:'Bonus Power feat at L1, L5, L10, L15, L20 (5 total). Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'psionPattern', restriction:'Power feat list'}},
    {lvl:1, name:'Discipline',         page:92, desc:'Choose 1 of 6 disciplines (Seer/Shaper/Kineticist/Egoist/Nomad/Telepath) — grants that discipline’s class skills and restricted powers; powers of OTHER disciplines are barred (even from items).', kind:'meta'},
    {lvl:2, name:'Mental Acumen',      page:93, desc:'+1 competence bonus to an Int-, Wis-, or Cha-based skill of choice at 2nd, 4th, 8th, and 16th level (same or different skill each time). — wired via the Class Choices picker', kind:'meta'},
    {lvl:6, name:'Profound Realization', page:93, desc:'+1 innate bonus to Intelligence at 6th, 12th, and 18th level. — wired: baked innate bonus (the attr reconciler)', kind:'meta'},
    {lvl:14, name:'Slippery Mind',     page:92, desc:'(Ex) On a failed Will save: expend psionic focus to immediately re-roll (second roll stands).', kind:'unimplemented'},
    {lvl:19, name:'Unassailable Mind', page:93, desc:'(Ex) On Int/Wis/Cha attribute damage: expend psionic focus to reduce it by Int modifier.', kind:'unimplemented'},
  ],
  // Ranger: 'Scent of the Quarry' was DRIFT (it's a 4-MP mutation power, not
  // a Ranger feature); Terrain Mastery is 7/13/19 (not 3). Verified pp.92–96.
  'Ranger': [
    {lvl:1, name:'Favored Enemy',           page:94, desc:'Pick a creature type (table p.94; Construct/Humanoid/Outsider need a subtype): +2 on Bluff, Listen, Sense Motive, Spot, Survival and weapon DAMAGE vs them. New pick at 5/10/15/20, and at each interval one existing bonus (or the new one) escalates +2. Overlapping picks: best applies, no stacking.', kind:'meta'},
    {lvl:1, name:'Track',                   page:94, desc:'Track feat as a bonus feat.', kind:'meta'},
    {lvl:1, name:'Wild Empathy',            page:94, desc:'(Ex) Improve an animal’s attitude: 1d20 + Ranger level + Cha bonus (Diplomacy-like; 30 ft, ~1 minute). Magical beasts of Int 1–2 at −4.', kind:'active'},
    {lvl:2, name:'Combat Style',            page:95, desc:'Pick ranged or two-weapon on the Gear tab (weapon-summary panel). Virtual feats while in light/no armor: TWF or Rapid Shot @2, Improved TWF or Manyshot @6, Greater TWF or Improved Precise Shot @11.', kind:'passive'},
    {lvl:3, name:'Endurance',               page:95, desc:'Endurance feat as a bonus feat.', kind:'meta'},
    {lvl:4, name:'Animal Companion',        page:95, desc:'(Ex) A companion from the Druid list (advances by effective Druid level = Ranger level − 3; see Animal Companions, HH p.109).', kind:'meta'},
    {lvl:4, name:'Ranger Spells',           page:94, desc:'Divine prepared caster from the DRUID spell list (Divine Scale 1+; at Divine Scale 0 the Ranger instead accrues Nature’s Secrets: +1 competence to a Wis-based class skill per instance, stacking). CL = ½ Ranger level rounded up. See Powers & Spells panel.', kind:'passive'},
    {lvl:7, name:'Terrain Mastery',         page:95, desc:'At 7th, 13th, and 19th level pick a terrain (must have been exposed; locked once chosen): +1 insight on ALL d20 rolls and damage vs creatures of that terrain, plus a per-terrain benefit (Aquatic +4 Swim; Desert fatigue immunity; Forest +4 Hide; Hills +4 Listen; Marsh +4 Move Silently; Mountains +4 Climb; Plains +4 Spot; Underground darkvision 60′).', kind:'meta'},
    {lvl:7, name:'Woodland Stride',         page:96, desc:'(Ex) Move through natural undergrowth at normal speed, unharmed (enchanted growth still applies).', kind:'passive'},
    {lvl:8, name:'Swift Tracker',           page:96, desc:'(Ex) Track at normal speed with no −5; only −10 (not −20) at up to double speed.', kind:'passive'},
    {lvl:9, name:'Evasion',                 page:96, desc:'(Ex) Successful Reflex vs half-damage effect → no damage. Light/no armor only. — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:12, name:'Camouflage',             page:96, desc:'(Ex) Hide in any natural terrain, even without cover/concealment.', kind:'passive'},
    {lvl:16, name:'Hide in Plain Sight',    page:96, desc:'(Ex) In natural terrain, Hide even while observed.', kind:'passive'},
    {lvl:18, name:'Undeclared Territory',   page:96, desc:'Steward of a 100+ sq-mile tract matching the 1st Terrain Mastery: DOUBLE the usual mastered-terrain bonuses there.', kind:'unimplemented'},
  ],
  'Rogue': [
    {lvl:1, name:'Sneak Attack +1d6',     page:97, desc:'+1d6 damage on attacks against flanked/flatfooted/etc.; +1d6 per 2 Rogue levels.', kind:'unimplemented'},
    {lvl:1, name:'Trapfinding',           page:98, desc:'Search for traps with DC > 20 (otherwise impossible); Disable Device on magical traps.', kind:'unimplemented'},
    {lvl:2, name:'Evasion',               page:97, desc:'On successful Ref save vs area effect for ½ damage, take none. — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:3, name:'Trap Sense',            page:98, desc:'+1 Ref save vs traps, +1 dodge AC vs trap attacks; +1 more at L6/9/12/15/18.', kind:'unimplemented'},
    {lvl:4, name:'Uncanny Dodge',         page:98, desc:'Retain Dex bonus to AC when flat-footed or struck by invisible attacker. — wired as the Defense-cell tag (v8.64.0, unified sources incl. the second-class auto-upgrade)', kind:'passive'},
    {lvl:8, name:'Improved Uncanny Dodge', page:98, desc:'Cannot be flanked (a Rogue needs 4+ more Rogue levels to sneak-attack via flanking). Uncanny Dodge from a second class upgrades to this automatically. — wired as the Defense-cell tag (v8.64.0)', kind:'passive'},
    {lvl:10, name:'Special Ability',      page:98, desc:'Pick at 10/13/16/19/20 from: Crippling Strike (sneak attacks deal 2 Str damage), Defensive Roll (1/day or 1 AP: Dodge check DC = damage to halve a would-drop blow), Improved Evasion, Opportunist (1/round AoO on a foe just struck in melee), Skill Mastery (Take 10 under stress on 3+Int-mod chosen skills; repeatable), Slippery Mind (re-roll a failed save vs mind-affecting 1 round later), or a Bonus Feat.', kind:'meta'},
    {lvl:14, name:'Improved Evasion',     page:98, desc:'Half damage even on a FAILED Reflex save for half (same limits as Evasion). — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
  ],
  // Saint: the v8.3.1 entries ('Sacred Aura', 'Lay on Hands (Greater)') were
  // DRIFT — neither exists. Real features verified pp.98–100.
  'Saint': [
    {lvl:1, name:'Divine Spells (Saint)', page:99, desc:'Spontaneous divine caster (Cha-based) drawn purely from the deity’s Domains (3–4 spells per level typical) plus the Personal Domain additions. See Powers & Spells panel.', kind:'passive'},
    {lvl:1, name:'Aura',                  page:100, desc:'(Ex) Powerful aura corresponding to the deity’s alignment.', kind:'passive'},
    // BOOK CONFLICT (errata list): the feature text says "At 2nd level...
    // select a feat from the Magic feat list", but the level table shows
    // Bonus Feat at 5th and 10th. Following the TABLE until Adam rules.
    {lvl:2, name:'Miracle',               page:100, desc:'(Su) At 2nd: a 1st-level domain-aspect spell/power as a supernatural ability 3/day (or its point cost). At 7th: a 2nd/3rd-level one, 2/day. At 13th: a 4th–6th-level one, 1/day. At 19th: perform a Miracle 1/day (no XP cost; deity/GM discretion). All manifest at character level.', kind:'active'},
    {lvl:3, name:'Personal Domain',       page:100, desc:'At 3rd and every odd level: petition one Cleric-list spell (up to max castable level) into the permanent personal spell list (GM approves; Druid/Wizard/Psion lists possible for fitting domains).', kind:'meta'},
    {lvl:5, name:'Bonus Feat',            page:100, desc:'Magic feat at 5th and 10th level. [Table/text level conflict — see errata.]', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5,10]}, restriction:'Magic feat list'}},
    {lvl:20, name:'True Sainthood (Divine Rank 0)', page:100, desc:'Ascend to Outsider (darkvision 60′, no dual nature — normal raising fails; no need to eat/sleep; simple+martial proficiency) with +4 inherent to one attribute of choice.', kind:'unimplemented'},
  ],
  'Sorcerer': [
    {lvl:1, name:'Sorcerer Spells',     page:102, desc:'Arcane spontaneous caster (Cha-based). See Powers & Spells panel for PP budget, CL, save DC, and spells known.', kind:'passive'},
    {lvl:1, name:'Familiar',            page:102, desc:'A magical-beast companion (24 hours + 100 gp to obtain; advances by master’s level, see HH p.110). Death/dismissal: DC 15 Fort or lose 200 XP/level (half on success); no replacement for a year and a day.', kind:'meta'},
    {lvl:2, name:'Strong Personality',  page:103, desc:'Cumulative +1 to Fortitude AND Will saves vs supernatural, magic, or psionic effects at 2nd, 5th, 9th, 13th, and 17th level (+5 by 17th).', kind:'unimplemented'},
    {lvl:3, name:'Bonus Feat',          page:102, desc:'Magic feat at 3rd, 7th, 11th, 15th, and 19th level. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,7,11,15,19]}, restriction:'Magic feat list'}},
    {lvl:20, name:'Innate Mastery',     page:103, desc:'Pick one: Arcane Fire (ranged-touch bolt, 1d6 + 1d6/2 PP), Arcane Reach (touch spells at 30 ft), Mastery of Counterspelling, Mastery of Elements (swap energy descriptors), or Mastery of Shaping (carve 5-ft holes in areas).', kind:'meta'},
  ],
  // Warmind: 'Psicrystal' and 'Chain of Personal Superiority' were DRIFT —
  // neither exists in the E&E Warmind. Verified pp.103–105.
  'Warmind': [
    {lvl:1, name:'Warmind Powers',     page:104, desc:'Psionic manifester (Wis-based, Warmind list; Psionic Scale 1+ — at Psionic Scale 0 the Warmind instead accrues Battle Focus: while focused, +½ the Battle Focus modifier to hit/damage/dodge/parry, or expend focus for the full modifier on one declared roll). See Powers & Spells panel.', kind:'passive'},
    {lvl:1, name:'Bonus Feat',         page:104, desc:'Combat-oriented bonus feat from the FIGHTER or POWER lists at 1st, 2nd, and every three levels after (5, 8, 11, 14, 17, 20). Prereqs apply; no Fighter-level-locked feats without the levels.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[1,2,5,8,11,14,17,20]}, restriction:'Fighter or Power feat list'}},
    {lvl:3, name:'Self-Control',       page:105, desc:'(Ex) +1 innate bonus to Wisdom AND +1 to all saving throws, at 3rd, 9th, and 15th level.', kind:'unimplemented'},
    {lvl:6, name:'Mind Over Matter',   page:105, desc:'(Ex) 1/day (2@12, 3@18): roll a second d20 on a defensive action (save, dodge, or parry) after seeing the first; take the better. Once per defensive action.', kind:'active'},
    {lvl:19, name:'Self-Mastery',      page:105, desc:'(Ex) Mettle (successful Fort/Will vs half/partial → negates) and another +1 innate Wisdom (+4 total with Self-Control). — the +1 Wis is baked (wired); Mettle is a table call', kind:'passive'},
  ],
  'Wilder': [
    {lvl:1, name:'Psionics, 2 Powers',    page:105, desc:'Psionic manifester (Wilder). See Powers & Spells panel for PP budget, ML, save DC, and powers known.', kind:'passive'},
    {lvl:1, name:'Wild Surge',            page:106, desc:'Boost manifester level on a power; risks Neuralgia. Improves at L3/7/11/15/19.', kind:'active'},
    {lvl:1, name:'Neuralgia',             page:106, desc:'After each Wild Surge, 5%/ML boost chance of being dazed and losing PP.', kind:'passive'},
    // v8.3.1: MECHANIZED. Elude Touch adds Cha mod to Touch AC at all times.
    // The effect declaration drives applyClassFeatureEffects() to inject
    // this bonus into the Touch AC component in computeACDisplay.
    {lvl:2, name:'Elude Touch',           page:106, desc:'Add Charisma bonus to Touch AC against all touch attacks (incl. rays).', kind:'passive',
     effect:{type:'touchAcBonus', source:'attr:CHA-mod', stack:'untyped'}},
    {lvl:4, name:'Euphoriac',             page:107, desc:'After a wild surge: +1 morale to attack/damage/saves for (intensity) rounds. +2 at L12, +3 at L20.', kind:'unimplemented'},
    {lvl:5, name:'Bonus Feat (Wilder)',   page:106, desc:'Bonus Power feat at L5, L9, L13, L17 (4 total). Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'wilderPattern', restriction:'Power feat list'}},
  ],
  'Wizard': [
    {lvl:1, name:'Wizard Spells',  page:108, desc:'Arcane prepared caster (Int-based). Optional School Specialization at 1st (one extra specialty-school spell per level per day free + 2 prohibited schools; Diviners give up only one). See Powers & Spells panel.', kind:'passive'},
    {lvl:1, name:'Spellbook',      page:108, desc:'Starts with all 0-level spells + 3 (+Int mod) 1st-level spells; +2 spells of castable levels per Wizard level; copying from found spellbooks allowed. Read Magic always preparable from memory.', kind:'meta'},
    {lvl:1, name:'Familiar',       page:107, desc:'As the Sorcerer’s Familiar (HH p.110).', kind:'meta'},
    {lvl:1, name:'Enchant Scroll', page:108, desc:'Enchant Scroll feat granted automatically at L1 as a bonus.', kind:'meta'},
    {lvl:2, name:'Increased Competence', page:108, desc:'+1 competence bonus in any NON-Knowledge skill at 2nd, 6th, 14th, and 18th level — once per skill, a different skill each time. — wired via the Class Choices picker', kind:'meta'},
    {lvl:4, name:'Esoteric Knowledge',   page:108, desc:'+1 competence bonus on one Knowledge skill with 1+ ranks at 4th, 8th, 12th, 16th, and 20th level (same or different; locked once selected).', kind:'unimplemented'},
    {lvl:5, name:'Bonus Feat (Magic)',   page:108, desc:'Bonus Magic feat at L5, L10, L15, L20 (4 total). Must meet prereqs incl. caster-level minimums.', kind:'meta',
     effect:{type:'bonusFeats', formula:'every5thLvl', restriction:'Magic feat list'}},
    {lvl:19, name:'Wizard Emeritus',     page:108, desc:'Followers and a cohort as if via Leadership — all with 1+ Wizard level (a bonus Magic feat instead if Leadership already held).', kind:'unimplemented'},
  ],
  // ======= v8.10.1 PRESTIGE CLASSES (Adam's pass, Segment A) — verified
  // line-by-line against GMG pp.152–188 (book: GMG, not HH — the citations
  // walker honors the per-entry book field). The permanent-PP ability MENUS
  // (Archmage High Arcana, Metamind Mental Mastery, Ecclesiarch Godly Gift)
  // are Segment B — their entries list the menus as data with the costs.
  // Variant classes share feature sets via aliases after this literal
  // (Holy=Eldritch Knight, Guildmember ×2, Theurge ×2, Trickster ×2,
  // Technopath=Technomage); Super-Villain differs textually and is separate.
  'Anti-Hero': [
    {lvl:1, book:'GMG', name:'Not a Hero',        page:152, desc:'No Hero-class levels ever; AP only pay for class-ability activations (never +d6 on a d20); Fate Points only re-roll the Anti-Hero’s own d20s. Available at Heroic Scale 0.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Personal Reasons',  page:152, desc:'1/day (or 1 AP): +⅓ class level (rounded up) morale on ALL d20 and damage rolls for 5 + class level rounds. FLIP SIDE: never benefits from others’ morale bonuses; immune to fear’s negative morale (incl. Fear itself).', kind:'active'},
    {lvl:1, book:'GMG', name:'Talent',            page:152, desc:'One Talent from any Hero class qualified for (13+ in its attribute); treat Anti-Hero level as Hero level for its variables. Add it on the Talents tab.', kind:'meta'},
    {lvl:2, book:'GMG', name:'Adaptable',         page:153, desc:'At 2nd, 6th, and 10th: pick +1 Base Attack, +1 Defense Bonus, or a cross-class skill as a permanent class skill with +1 competence (repeats stack) — pick in Class Choices.', kind:'meta'},
    {lvl:2, book:'GMG', name:'Make Your Own Luck', page:153, desc:'A natural 20 in combat may be re-rolled (forfeiting it) to gain 1 Action Point; second roll stands. Unspent AP lost at level-up.', kind:'active'},
    {lvl:3, book:'GMG', name:'Bonus Feat or Talent', page:153, desc:'At 3/5/7/9: any feat qualified for — or a Hero talent instead (add via Talents tab and leave the slot open).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,5,7,9]}, restriction:'any feat — or take a Hero talent instead'}},
    {lvl:4, book:'GMG', name:'Battle-Hardened',   page:153, desc:'+1 to a chosen saving throw at 4th and 8th (may repeat) — pick in Class Choices.', kind:'meta'},
    {lvl:4, book:'GMG', name:'Take Charge',       page:153, desc:'1/day (or 1 AP): +4 Initiative (immediate) OR an extra move action; once per round.', kind:'active'},
    {lvl:6, book:'GMG', name:'Comeback',          page:153, desc:'1/day (or 1 AP), move action: recover 25% of HP (only up to 50% total). Combos with Take Charge’s bonus move.', kind:'active'},
    {lvl:8, book:'GMG', name:'Army of One',       page:154, desc:'1/day (or 1 AP): +4 to a just-rolled save (immediate) OR an extra standard action; once per round.', kind:'active'},
    {lvl:10, book:'GMG', name:'Self-Determination', page:154, desc:'1/day (or 1 AP each): re-roll any d20 just rolled — REPEATABLE on the same roll for 1 AP per extra re-roll.', kind:'active'},
  ],
  'Archmage': [
    {lvl:1, book:'GMG', name:'Arcane Spellcasting', page:154, desc:'Every level advances an arcane class that could cast 7th-level spells (PP/day + spells known; no other class benefits). See Powers & Spells panel.', kind:'passive'},
    {lvl:1, book:'GMG', name:'High Arcana',         page:154, desc:'One pick per level, bought with PERMANENTLY spent arcane PP: Arcane Fire (17 — CL-scaled ranged-touch bolt), Arcane Mastery (0 — a Magic feat instead), Arcane Reach (13/instance — touch at 30/60 ft), Mastery of Counterspelling (13 — counterspells turn back), Mastery of Elements (15), Mastery of Shaping (11), Spell Power (9 — CL +1), Spell-Like Ability (9+, repeatable). [Menu picker + permanent-PP ledger: Segment B.]', kind:'meta'},
  ],
  'Artificer': [
    {lvl:1, book:'GMG', name:'Craft Artifice',      page:156, desc:'EVERY level: a new Item Creation feat (qualified for), plus a cumulative 200-XP buffer per level that absorbs the first (200 × class level) XP of any item’s creation cost.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[1,2,3,4,5]}, restriction:'Item Creation feats (Enchant/Imbue family — see the GMG table for required Craft skills)'}},
    {lvl:1, book:'GMG', name:'Improved Capability', page:156, desc:'At 1st, 3rd, and 5th: advance any one existing caster/manifester class (PP/day + spells/powers known only).', kind:'passive'},
    {lvl:2, book:'GMG', name:'Bonus Feat',          page:157, desc:'At 2nd and 4th, from the Expert, Magic, or Power lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2,4]}, restriction:'Expert, Magic, or Power feat list'}},
  ],
  'Assassin': [
    {lvl:1, book:'GMG', name:'Sneak Attack',       page:157, desc:'+1d6, +1d6 more at 3/5/7/9 (+5d6 total) — STACKS with sneak attack from other sources.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Assassinate',        page:157, desc:'Study 3 rounds, then a damaging melee sneak attack within 3 rounds: Fort DC 10 + class level + Int mod (+ Improved Methods) or the target dies (or is paralyzed 1d6 + level rounds — Assassin’s choice).', kind:'active'},
    {lvl:1, book:'GMG', name:'Poison Use',         page:158, desc:'Never risks self-poisoning when applying poison to a blade.', kind:'passive'},
    {lvl:2, book:'GMG', name:'Improved Methods',   page:158, desc:'At 2/4/6/8/10 — either-or per level, picked in 🎓 Class Choices as the level is attained (ruling 2026-10-02): +1 Assassinate DC per instance, OR advance an existing caster/manifester class (PP + spells/powers known).', kind:'meta'},
    {lvl:2, book:'GMG', name:'Uncanny Dodge',      page:158, desc:'Keep Dex to AC when flat-footed / vs invisible attackers; Improved (can’t be flanked) at 6th.', kind:'passive'},
    // BOOK CONFLICT (errata): the feature TEXT says Poison Resistance is
    // "gained at 2nd level, +1 per two additional levels", but the level
    // TABLE runs +1@3, +2@5, +3@7, Immunity@9. Following the TABLE.
    {lvl:3, book:'GMG', name:'Poison Resistance', page:158, desc:'+1 on saves vs poison (+2 @5, +3 @7) — wired as a conditional Fort row; Poison IMMUNITY at 9th. [Table/text level conflict — see errata.]', kind:'passive'},
    {lvl:4, book:'GMG', name:'Bonus Feat',         page:158, desc:'At 4th and 8th, from the Fighter list.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[4,8]}, restriction:'Fighter feat list'}},
    {lvl:10, book:'GMG', name:'Guildmaster',       page:158, desc:'Leadership plus a choice of Renown or Low Profile (pick in Class Choices — granted automatically).', kind:'meta'},
  ],
  'Bloodluster': [
    {lvl:1, book:'GMG', name:'Bloodlust',           page:159, desc:'Berserker: Concentration DC 20 leaving a Rage → no fatigue. Wilder: Concentration DC 20 → no Neuralgia. Both: Concentration DC 20 + power level to manifest during a Rage (no concentration-duration powers).', kind:'active'},
    {lvl:2, book:'GMG', name:'Improved Bloodlust',  page:159, desc:'At 2nd–9th: Berserkers count each as a Berserker level for Rage uses/day AND unlock one normally-barred skill per instance usable while raging; Wilders count each as a Wilder level for Wild Surge, Euphoriac, and manifesting (PP + powers).', kind:'passive'},
    {lvl:5, book:'GMG', name:'Bonus Feat',          page:159, desc:'At 5th and 10th, from the Fighter (Berserker) or Power (Wilder) list.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5,10]}, restriction:'Fighter feat list (Berserker) or Power feat list (Wilder)'}},
    {lvl:10, book:'GMG', name:'Perfect Storm',      page:159, desc:'Berserker: Greater Rage with NO fatigue. Wilder: +1 more Euphoriac morale and NO Neuralgia ever. Both: no Concentration checks to manifest while raging.', kind:'passive'},
  ],
  'Crusader': [
    {lvl:1, book:'GMG', name:'Improved Spellcaster', page:160, desc:'EVERY level advances an existing divine casting class (PP/day + spells known only).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Zeal',                page:160, desc:'Swift action: spend PP equal to any castable spell level → +that spell level as a LUCK bonus on the next d20 roll.', kind:'active'},
    {lvl:2, book:'GMG', name:'Proselytize',         page:161, desc:'+½ Crusader level (rounded up) to Diplomacy and Knowledge (religion) — wired live.', kind:'passive'},
    {lvl:3, book:'GMG', name:'Bonus Feat',          page:161, desc:'At 3/6/9, from ANY feat list qualified for.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'any feat'}},
    {lvl:4, book:'GMG', name:'Divine Appeal',       page:161, desc:'1/day (or 1 AP): roll a second d20 on any just-rolled d20 and take the better.', kind:'active'},
    {lvl:5, book:'GMG', name:'Convert',             page:161, desc:'(Su) 1/day (or 1 AP): 10 minutes + 5 PP, Diplomacy vs Will — target adopts your alignment for a day (Will DC 15 + Wis after a day or it sticks). NPCs only.', kind:'active'},
    {lvl:7, book:'GMG', name:'Mass Appeal',         page:161, desc:'As Convert: 1 + Cha mod targets, 7 PP, −2 Diplomacy per extra target.', kind:'active'},
    {lvl:8, book:'GMG', name:'Zealot',              page:161, desc:'A Leadership-style cohort (no followers); the god replaces a fallen Zealot within 7 days, no Leadership penalty.', kind:'meta'},
    {lvl:10, book:'GMG', name:'Pious Appeal',       page:161, desc:'Petition for a MIRACLE (as the spell; 0–5,000 XP at GM discretion). Unlimited attempts — flippant use costs the class its powers until Atonement.', kind:'active'},
  ],
  'Ecclesiarch': [
    {lvl:1, book:'GMG', name:'Godly Gift',          page:162, desc:'One pick per level (some class-gated): Blast Infidel (maximize negative energy vs opposed alignment), Divine Reach (touch at 30/60), Faith Healing (maximize healing on same-alignment), Gift of the Divine (Cleric — lend turn attempts), Living Incarnation (Saint — avatar self-buffs, 2× caster level PP as a swift), Mastery of Energy (Cleric — +4 turning checks/damage), Magic Feat, Power of Nature (Druid — lend class features/Wildshape), Spell Power (CL +1, stacks), Spell-Like Ability (permanent-PP, repeatable). [Menu picker: Segment B.]', kind:'meta'},
    {lvl:2, book:'GMG', name:'Divine Spellcasting', page:163, desc:'Each level after 1st advances a divine class that could cast 7th-level spells (PP/day + spells known only).', kind:'passive'},
  ],
  'Eldritch Knight': [
    {lvl:1, book:'GMG', name:'Battle Caster',        page:164, desc:'With Still Spell: Still-modified spells cost 2 fewer PP (armored casting adapted). With Combat Casting: re-roll failed casts-on-the-defensive (second stands).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Improved Spellcasting', page:164, desc:'At 1/2/4/5/7/8/10: advance the spellcasting class that could cast 3rd-level spells (PP/day + spells known only). See Powers & Spells panel.', kind:'passive'},
    {lvl:3, book:'GMG', name:'Bonus Feat',           page:165, desc:'At 3/6/9, from the Fighter or Magic lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Fighter or Magic feat list'}},
    {lvl:10, book:'GMG', name:'Knighthood',          page:165, desc:'Choose Renown or Windfall (BOTH with a formal Allegiance to the honoring organization — every Holy Knight has one) — pick in Class Choices; granted automatically.', kind:'meta'},
  ],
  'Elementalist': [
    {lvl:1, book:'GMG', name:'Elemental Focus',      page:165, desc:'Pick the element in Class Choices: Ambrian (air/electricity), Kryonian (water/cold), Vesuvian (fire/fire), or Vitrolian (earth/acid) — drives every feature below plus variant class skills.', kind:'meta'},
    {lvl:1, book:'GMG', name:'Elemental Affinity',   page:165, desc:'(Ex) +4 on saves vs the chosen element’s damage types (electricity/ionic, cold/sonic, fire/heat, or acid/disintegration) — conditional save row wired off the pick.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Elemental Fist',       page:166, desc:'(Su) Move action: unarmed counts as armed, 2d6 element damage per touch (Vitrolian: 2d6 bludgeoning + Str).', kind:'active'},
    {lvl:2, book:'GMG', name:'Elemental Adaptation', page:166, desc:'(Ex) Resistance 10 to the chosen element (wired) + a variant Advantage (Scent / Webbed Digits / Darkvision / Second Wind — add on the Mutations tab).', kind:'passive'},
    {lvl:2, book:'GMG', name:'Elemental Bolt',       page:166, desc:'(Su) 2d6 element ranged touch (15 ft) once per attack (Vitrolian: +2d6 on Fist/Slam hits). 4d6 with Greater Adaptation @7.', kind:'active'},
    {lvl:3, book:'GMG', name:'Elemental Blast',      page:166, desc:'(Su) Standard action: 1d6/level element damage — two variant delivery options each (targeted/area etc., see GMG p.166).', kind:'active'},
    {lvl:3, book:'GMG', name:'Elemental Weapon',     page:166, desc:'(Su) Move action: a held melee weapon gains +2d6 element damage (Vitrolian: +5 Hardness, +10 HP, +1 magic hit/damage) while held.', kind:'active'},
    {lvl:4, book:'GMG', name:'Bonus Feat',           page:167, desc:'At 4th and 8th, from the Expert, Fighter, or Power lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[4,8]}, restriction:'Expert, Fighter, or Power feat list'}},
    {lvl:4, book:'GMG', name:'Elemental Nimbus',     page:167, desc:'(Su) 1/day (2/day @8, or 1 AP), move action: DR 10/magic (Vitrolian 10/adamantine+magic) + element immunity, melee attackers take 2d6 element (Kryonian water option: Fast Healing 5 instead); 1 min/level — on the per-diem tracker.', kind:'active'},
    {lvl:5, book:'GMG', name:'Elemental Locomotion', page:167, desc:'Ambrian Fly 120′ perfect; Kryonian Swim 60′ + hold breath 1 min/Con; Vesuvian Fly 60′ perfect; Vitrolian Burrow 20′ + hold breath.', kind:'passive'},
    {lvl:6, book:'GMG', name:'Elemental Immunity',   page:167, desc:'(Ex) Permanently immune to the chosen element — wired to the Resist panel off the pick.', kind:'passive'},
    {lvl:7, book:'GMG', name:'Greater Elemental Adaptation', page:167, desc:'Bolt → 4d6 (Vitrolian: Fist ignores 10 hardness) + a variant Advantage / movement upgrade choice.', kind:'meta'},
    {lvl:9, book:'GMG', name:'Elemental Control',    page:167, desc:'(Su) Two at-will powers from the variant list (e.g. Vesuvian: Fireball / Heat Metal / Wall of Fire), manifested at class level.', kind:'meta'},
    {lvl:10, book:'GMG', name:'Elemental Transformation', page:167, desc:'(Su) Become a living elemental at will: Nimbus at will, DR 15/magic (Vitrolian 20/adamantine+magic), immunities per variant, plus variant powers (Greater Invisibility / Blur / Fiery Discorporation / stone-form Str +6). Full text GMG pp.167-168.', kind:'active'},
  ],
  'Elocater': [
    {lvl:1, book:'GMG', name:'Improved Psionics',    page:169, desc:'At 1/3/4/6/7/8/10: advance the prior manifesting class (PP/day + powers known + ML only).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Scorn Earth',          page:169, desc:'(Su) Float a foot above any surface: normal actions and speed (“run” ×4); above 1 foot, speed drops to 10 ft with Levitate-style attack penalties.', kind:'passive'},
    {lvl:2, book:'GMG', name:'Opportunistic Strike', page:169, desc:'(Ex) +2 insight to hit and damage (+4 @5, +6 @8) on the first attack vs a foe damaged in melee by someone else since your last action.', kind:'passive'},
    {lvl:2, book:'GMG', name:'Sidestep Charge',      page:169, desc:'Sidestep Charge as a bonus feat (prereqs waived) — granted automatically.', kind:'meta'},
    {lvl:3, book:'GMG', name:'Dimension Step',       page:169, desc:'(Su) Dimension Door 1/day (self only), ML = Elocater level — on the tracker.', kind:'active'},
    {lvl:4, book:'GMG', name:'Flanker',              page:169, desc:'(Ex) Designate any adjacent hex as your flanking origin.', kind:'passive'},
    {lvl:5, book:'GMG', name:'Bonus Feat',           page:169, desc:'At 5th, from the Fighter or Power lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5]}, restriction:'Fighter or Power feat list'}},
    {lvl:6, book:'GMG', name:'Transporter',          page:170, desc:'(Ex) Learn Teleport and Plane Shift as 3rd-level powers (5 PP each).', kind:'meta'},
    {lvl:7, book:'GMG', name:'Capricious Step',      page:170, desc:'(Ex) A second 5-ft step in any round with no other movement; no AoO.', kind:'passive'},
    {lvl:9, book:'GMG', name:'Dimensional Spring Attack', page:170, desc:'(Su) 1/day: Dimension Step + Spring Attack vs a target within 60 ft, returning to start (consumes the day’s Dimension Step).', kind:'active'},
    {lvl:10, book:'GMG', name:'Accelerated Action',  page:170, desc:'(Su) 5 rounds/day of acceleration (1-round increments): extra attack on a full attack, +30 ft speed, manifest an extra quick power, +2 dodge to attack/Reflex/AC. Not with Schism/Haste. Pool on the tracker.', kind:'active'},
  ],
  'Guildmember (Magic)': [
    {lvl:1, book:'GMG', name:'Membership',                page:170, desc:'Guild access 1/day via Sending/Correspond: borrow one spell/power of level ≤ (class level − 1) that you could normally cast — a Wizard memorizes it that day; a psionic gains it for 1d6+9 minutes. On the tracker.', kind:'active'},
    {lvl:1, book:'GMG', name:'Improved Casting / Psionics', page:171, desc:'EVERY level advances the qualifying arcane (or psionic) class (PP/day + spells/powers known only).', kind:'passive'},
    {lvl:3, book:'GMG', name:'Bonus Feat',                page:171, desc:'At 3/6/9, from the Magic (arcane) or Power (psionic) list.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Magic feat list (arcane) or Power feat list (psionic)'}},
    {lvl:10, book:'GMG', name:'Guildmaster',              page:171, desc:'No more dues (stipend instead), +4 circumstance on guild Diplomacy; Wizard: access to every non-unique arcane spell + Incantations; psionic: Metaconcert granted — 17 PP + standard action adds any power for ML minutes. Oathbreakers lose everything until a fulfilled Geas.', kind:'meta'},
  ],
  'Heavy': [
    {lvl:1, book:'GMG', name:'Reflexive Knowledge Combat Module', page:172, desc:'The RKCM implant grants the class’s starting feats and +4 EQUIPMENT Dexterity (wired — lost while the RKCM is damaged, GM adjudicates). Each level past 1st, one RKCM feat becomes innate, freeing a slot for a new Expert/Fighter feat upload.', kind:'passive'},
    {lvl:2, book:'GMG', name:'Cybertaker',      page:172, desc:'At 2/3/4/5: the Cybertaker feat (HH p.209), granted automatically — +1 maximum attachments each, stacking with any taken copies ("a new implant that does not count against the limit" is the same arithmetic; Adam ruled the class ability IS the feat, 2026-10-09).', kind:'meta'},
    {lvl:3, book:'GMG', name:'Bonus Feat',      page:172, desc:'At 3rd, from the Expert or Fighter lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3]}, restriction:'Expert or Fighter feat list'}},
    {lvl:5, book:'GMG', name:'Dreadnaught',     page:172, desc:'Immune to fear (wired), +4 equipment on Fortitude saves (wired), and redundant systems IGNORE CRITICAL HITS.', kind:'passive'},
  ],
  'Loremaster': [
    {lvl:1, book:'GMG', name:'Improved Magic / Psionics', page:173, desc:'EVERY level advances a prior casting/manifesting class (PP/day + spells/powers known only) — the pool is CHOSEN PER LEVEL in 🎓 Class Choices (ruling 2026-10-02: improve whatever means qualified you; unpicked levels default to Arcane).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Secret',        page:173, desc:'At 1/3/5/7/9 pick a Secret (tier ≤ class level + Int mod, no repeats) — in Class Choices: Instant Mastery (4 ranks in an untrained skill), Secret Health (+3 HP — baked), Inner Strength (+2 Will — wired), True Stamina (+2 Fort — wired), Avoidance (+2 Reflex — wired), Weapon Trick (Weapon Focus), Dodge Trick (Dodge, prereqs waived), Applicable Knowledge (any feat), Newfound Arcana (a 1st-level spell/power), More Newfound Arcana (2nd-level).', kind:'meta'},
    {lvl:2, book:'GMG', name:'Lore',          page:174, desc:'Bardic-knowledge-style check: 1d20 + Loremaster level + Int mod.', kind:'active'},
    {lvl:4, book:'GMG', name:'New Tongue',    page:174, desc:'Any new language at 4th and 8th.', kind:'meta'},
    {lvl:6, book:'GMG', name:'Greater Lore',  page:174, desc:'(Ex) Identify magic/psionic items at will.', kind:'passive'},
    {lvl:10, book:'GMG', name:'True Lore',    page:174, desc:'(Ex) 1/day: Legend Lore or Analyze Dweomer (or spend 1,000 XP for a Metafaculty) — on the tracker.', kind:'active'},
  ],
  'Metamind': [
    {lvl:1, book:'GMG', name:'Improved Psionics', page:174, desc:'Every level advances a psionic class that could manifest 7th-level powers (PP/day + powers known only).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Mental Mastery',    page:175, desc:'One pick per level, bought with PERMANENTLY spent psionic PP: Bonus Power Feat (0), Mental Sculptor (5), Mental Potency (5, stacks — ML +1), Mental Reach (9/instance), Monad (15, Psychoportation), Precog (15, Clairsentience — permanent Foresight, never surprised/flat-footed/flanked, +2 insight AC/Reflex), Physical Phoenix (15, Metacreativity), Telekinetic Terror (15, Psychokinesis — CL-scaled TK bolt), Telepathic Tyrant (15, Telepathy), Uncarnate (15, Psychometabolism — incorporeal being). [Menu picker + permanent-PP ledger: Segment B.]', kind:'meta'},
  ],
  'Mystic Theurge': [
    {lvl:1, book:'GMG', name:'Blended Technique', page:186, desc:'EVERY level advances BOTH qualifying classes (arcane + divine for Mystic; arcane + psionic for Psychic) — PP/day and spells/powers known; the two PP pools MERGE, spendable on either art. Already wired in the caster engine.', kind:'passive'},
    {lvl:5, book:'GMG', name:'Bonus Feat',        page:186, desc:'At 5th, from the Magic or Power lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[5]}, restriction:'Magic or Power feat list'}},
    {lvl:10, book:'GMG', name:'Perfected Technique', page:186, desc:'Casts/manifests at CHARACTER level. Mystic: cast arcane in armor with no ACP. Psychic: Concentration DC 15 + level to cast without verbal/somatic components (free Silent Still).', kind:'passive'},
  ],
  'Planestrider': [
    {lvl:1, book:'GMG', name:'Adapt Body',             page:177, desc:'Adapt Body as a 3rd-level psi/spell-like ability (5 PP), at character level.', kind:'meta'},
    {lvl:1, book:'GMG', name:'Extreme Terrain Mastery', page:177, desc:'At 1/3/5/7/9 pick an extreme terrain (in Class Choices): Aligned (ignore plane alignment penalties), Cold / Caustic / Fiery / Lightning Storms (Resistance 20 — wired to the Resist panel; +1 insight vs matching creatures), Weightless (Zero-G Training + insight vs weightless foes).', kind:'meta'},
    {lvl:2, book:'GMG', name:'Bonus Feat or Improved Capability', page:178, desc:'At 2nd and 6th: any feat — or an Improved Capability instead.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2,6]}, restriction:'any feat — or take Improved Capability instead'}},
    {lvl:3, book:'GMG', name:'Improved Capability',    page:178, desc:'At 3/4/5/7/8/9: advance the qualifying caster/manifester class; casterless Planestriders take +1 INSIGHT to a class skill instead (stacks, repeatable).', kind:'passive'},
    {lvl:4, book:'GMG', name:'Sense of Space',         page:178, desc:'(Su) Know Direction & Location at will.', kind:'passive'},
    {lvl:8, book:'GMG', name:'Sense of Time',          page:178, desc:'+2 insight to initiative — wired live.', kind:'passive'},
    {lvl:10, book:'GMG', name:'Locus Mastery',         page:178, desc:'Terrain-qualified: Touchsight + Tremorsense 30 ft (Ex). Plane-Shift-qualified: Dimension Door every 1d4 rounds as a free move-action Su at character level.', kind:'passive'},
  ],
  'Shadowjack': [
    {lvl:1, book:'GMG', name:'Read/Write Code',    page:179, desc:'Decipher Code (DC 10 + author’s Computer Use mod) reveals a program’s function and weak points (+2 insight to degrade it).', kind:'active'},
    {lvl:2, book:'GMG', name:'Bonus Feat',         page:179, desc:'At 2/4/6/8/10, from the Expert or General lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2,4,6,8,10]}, restriction:'Expert or General feat list'}},
    {lvl:2, book:'GMG', name:'Online Presence',    page:179, desc:'+class level (circumstance) on Cha-based skills used ONLINE — conditional rows wired.', kind:'passive'},
    {lvl:3, book:'GMG', name:'Electronic Empathy', page:179, desc:'+2 competence crafting/repairing/disabling electronic devices — conditional rows wired.', kind:'passive'},
    {lvl:3, book:'GMG', name:'Careful Progress',   page:179, desc:'Security admins are alerted only on failing Computer Use by 10+.', kind:'passive'},
    {lvl:5, book:'GMG', name:'False Trail',        page:179, desc:'Computer Use DC 25: −5 on traces; bad failures follow a decoy address.', kind:'active'},
    {lvl:5, book:'GMG', name:'Install Backdoor',   page:179, desc:'After a break-in, Computer Use DC 25–45 by security level: future entries need no checks.', kind:'active'},
    {lvl:7, book:'GMG', name:'Firewall Shadowdoor', page:180, desc:'Admins alerted only on a natural 1.', kind:'passive'},
    {lvl:8, book:'GMG', name:'Walking Database',   page:180, desc:'1/day (or 1 AP): substitute the Computer Use modifier for any Knowledge check (no ranks needed) — on the tracker.', kind:'active'},
    {lvl:9, book:'GMG', name:'Living Library',     page:180, desc:'+1 Intelligence (BAKED) and the Jack of All Trades feat (granted).', kind:'passive'},
    {lvl:10, book:'GMG', name:'Redundancy Protocols', page:180, desc:'Re-roll any failed Computer Use check (second stands; not with Walking Database).', kind:'passive'},
  ],
  'Soulstalker': [
    {lvl:1, book:'GMG', name:'Soulsight',           page:181, desc:'Scent of the Quarry permanently active as a Su power at no cost — but ALL Soulstalker powers fail at 0 PP (keep 1+ PP in the pool).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Detect Hostile Intent', page:181, desc:'Permanently active, no cost (Su).', kind:'passive'},
    {lvl:2, book:'GMG', name:'Object Reading',      page:181, desc:'At-will Su, no cost.', kind:'active'},
    {lvl:2, book:'GMG', name:'Psychic Sensitivity', page:181, desc:'Sensitivity to Psychic Impressions at will, no cost (Su).', kind:'active'},
    {lvl:3, book:'GMG', name:'Bonus Feat',          page:181, desc:'At 3/6/9, from the General, Fighter, or Power lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'General, Fighter, or Power feat list'}},
    {lvl:3, book:'GMG', name:'Improved Psionics',   page:181, desc:'At 3/4/6/7/9/10: advance the prior manifesting class (PP/day + powers known only).', kind:'passive'},
    {lvl:4, book:'GMG', name:'Aura Sight',          page:181, desc:'Permanently active (Su).', kind:'passive'},
    {lvl:5, book:'GMG', name:'Detect Teleport',     page:181, desc:'Permanently active (Su); Touchsight (60 ft) also permanent from 5th.', kind:'passive'},
    {lvl:7, book:'GMG', name:'Trace Teleport',      page:181, desc:'At-will Su, no cost.', kind:'active'},
    {lvl:8, book:'GMG', name:'Psychic Predator',    page:181, desc:'Gain Psychic Vampire (+ Dimensional Anchor via Dimensional Corner) as powers of the same type as the original Scent of the Quarry.', kind:'meta'},
    {lvl:10, book:'GMG', name:'Soulsearch',         page:181, desc:'Gain Mind Probe likewise.', kind:'meta'},
  ],
  'Splice': [
    {lvl:1, book:'GMG', name:'Gene Therapy',       page:182, desc:'10 Mutation Points (Major Mutant caps; Super-Powers/Su attributes only at Mutation Scale 5+; MUST all be spent before next level) + the Mutant subtype. [Record the MP grant with the GM on the Mutations tab — engine hook: Segment B.]', kind:'meta'},
    {lvl:2, book:'GMG', name:'Genetic Adaptation', page:182, desc:'An instance of the Unstable Mutation feat at 2nd and 4th (take the next tier I–V on the Feats tab).', kind:'meta'},
    {lvl:3, book:'GMG', name:'Bonus Feat',         page:182, desc:'At 3rd: any General feat, Planetary Adaptation, Supernatural Mutation, Toughness, or Unstable Mutation I–V.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3]}, restriction:'General feat list, Planetary Adaptation, Supernatural Mutation, Toughness, or Unstable Mutation I–V'}},
    {lvl:5, book:'GMG', name:'Evolutionary Leap',  page:182, desc:'Another 10 Mutation Points (same limits as Gene Therapy).', kind:'meta'},
  ],
  'Super-Hero': [
    {lvl:1, book:'GMG', name:'Heroic Purpose',      page:183, desc:'1/day (or 1 AP): declare Advantage on your next d20 (2d20 take better) — on the tracker.', kind:'active'},
    {lvl:1, book:'GMG', name:'Use Super-Power',     page:183, desc:'(Su) Class-level uses/day: manifest a Super-Power at BASE cost for 0 super-PP (or 1 AP per extra use) — on the tracker.', kind:'active'},
    {lvl:2, book:'GMG', name:'Bonus Feat or Talent', page:183, desc:'At 2nd and 4th: a General or Power feat — or a Hero talent instead (treat as Hero 1 in unowned classes).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2,4]}, restriction:'General or Power feat list — or take a Hero talent instead'}},
    {lvl:3, book:'GMG', name:'Resurgent Hero',      page:183, desc:'(Ex) 1/day (or 1 AP), standard action: recover 25% HP (up to 50% total) — on the tracker.', kind:'active'},
    {lvl:5, book:'GMG', name:'Champion',            page:183, desc:'(Ex) +2 morale on ALL d20 and damage rolls vs KNOWN-Evil beings.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Hero-Class Stacking', page:184, desc:'Super-Hero levels stack with Hero levels for Hero class abilities, and count as Hero levels for Hero’s Gift, Career Path, and Action Points.', kind:'passive'},
  ],
  'Super-Villain': [
    {lvl:1, book:'GMG', name:'Villainous Intent',   page:183, desc:'1/day (or 1 AP): within 30 ft, contest a Hero’s AP-boost d6 with your own AP + d6 — equal or higher cancels it AND refunds your AP — on the tracker.', kind:'active'},
    {lvl:1, book:'GMG', name:'Use Super-Power',     page:183, desc:'(Su) Class-level uses/day at base cost for 0 super-PP (or 1 AP per extra) — on the tracker.', kind:'active'},
    {lvl:2, book:'GMG', name:'Bonus Feat or Talent', page:183, desc:'At 2nd and 4th: a General or Power feat — or a Hero talent instead.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[2,4]}, restriction:'General or Power feat list — or take a Hero talent instead'}},
    {lvl:3, book:'GMG', name:'Recurring Villain',   page:183, desc:'(Ex) 1/day (or 1 AP): an extra END-of-turn move action (movement only) with +4 dodge vs AoOs — the getaway special.', kind:'active'},
    {lvl:5, book:'GMG', name:'Nemesis',             page:184, desc:'(Ex) +1 morale on all d20s while performing evil acts; +2 for the day after cancelling a Hero’s AP with Villainous Intent.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Hero-Class Stacking', page:184, desc:'Levels stack with Hero levels for Hero class abilities, Hero’s Gift, Career Path, and Action Points.', kind:'passive'},
  ],
  'Technomage': [
    {lvl:1, book:'GMG', name:'Technomancy',    page:184, desc:'A charge pool = (class level)² + Int mod + Wis mod + Cha mod (one-time), refilled by a night’s rest — tracked on the per-diem panel. Spell/psi-like abilities manifest at character level.', kind:'passive'},
    {lvl:1, book:'GMG', name:'Degauss & Power Device', page:185, desc:'1 charge each, standard action (added to the spell/power list if a 1st-level caster/manifester).', kind:'active'},
    {lvl:2, book:'GMG', name:'Dataread',       page:185, desc:'2 charges.', kind:'active'},
    {lvl:3, book:'GMG', name:'Bonus Feat',     page:185, desc:'At 3/6/9, from the General or Expert lists.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'General or Expert feat list'}},
    {lvl:4, book:'GMG', name:'Repair Damage',  page:185, desc:'4 charges (the psi-like form cannot be augmented).', kind:'active'},
    {lvl:5, book:'GMG', name:'Reboot',         page:185, desc:'5 charges; an IMMEDIATE-action Recharge while touching a sufficient power source.', kind:'active'},
    {lvl:7, book:'GMG', name:'Shutdown',       page:185, desc:'7 charges, standard action.', kind:'active'},
    {lvl:8, book:'GMG', name:'Ionic Bolt',     page:185, desc:'8 charges (psi-like form unaugmentable).', kind:'active'},
    {lvl:10, book:'GMG', name:'Machine Master', page:185, desc:'10 charges: Dominate a Construct by touch (Will DC 20 if it has Wis/Cha, else automatic); control while touching + 1d4 rounds after; supernatural constructs are stunned 1d4 rounds instead.', kind:'active'},
  ],
  'Arcane Trickster': [
    {lvl:1, book:'GMG', name:'Trickster',          page:187, desc:'Far Hand costs 0 PP when powering Tricks of the Trade / Trick Attack. Advances the qualifying arcane (or psionic) class at 1st and with every Improved Trickster (PP + spells/powers known).', kind:'passive'},
    {lvl:1, book:'GMG', name:'Tricks of the Trade', page:187, desc:'Disable Device / Sleight of Hand via Far Hand at 30 ft (+5 DC, no Take 10, ≤5 lb) — 1/day (2 @5, 3 @9; merged 5/day pool @10) — on the tracker.', kind:'active'},
    {lvl:2, book:'GMG', name:'Sneak Attack',       page:188, desc:'+1d6 at 2/4/6/8/10 (+5d6 total) — stacks with other sneak attack sources.', kind:'passive'},
    {lvl:2, book:'GMG', name:'Improved Trickster', page:188, desc:'At 2/3/4/6/7/8: advance the qualifying casting/manifesting class (PP + spells/powers known).', kind:'passive'},
    {lvl:3, book:'GMG', name:'Trick Attack',       page:188, desc:'1/day (2 @7; merged pool @10): declare one attack within 30 ft a sneak attack — the target loses Dex to AC vs it — on the tracker.', kind:'active'},
    {lvl:5, book:'GMG', name:'Trade Secrets',      page:188, desc:'+2 INSIGHT to a class skill at 5th and 9th (same skill stacks to +4) — pick in Class Choices, wired live.', kind:'meta'},
    {lvl:10, book:'GMG', name:'Consummate Trickster', page:188, desc:'5 total daily uses shared between Tricks of the Trade and Trick Attack; caster/manifester level = character level.', kind:'passive'},
  ],

  // v8.9.1 ADVANCED CLASSES (Adam's pass) — verified line-by-line
  // against HH pp.114–144. Every Advanced class grants Bonus Feats at 3/6/9;
  // thirteen carry tailored itemized lists (kept verbatim — entries naming
  // feats not yet in FEATS_DB, e.g. mecha/starship feats, stay listed as
  // guidance until those systems land), five draw on open lists, and three
  // lists include the parameterized "Skill Focus (any <class> skill)". =======
  'Ace Pilot': [
    {lvl:1, name:'Bonus Feat', page:115, desc:'At 1st, 3rd, 6th, and 9th level, from the Ace Pilot list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[1,3,6,9]},
       restriction:['Advanced Mecha Operation','Aircraft Operation','Armor Proficiency (powered)','Blind-Fight','Drive-By Attack','Force Stop','Gearhead','Hair Trigger','Mecha Crush','Mecha Fling','Mecha Operation','Mecha Sweep','Mecha Trample','Mecha Weapon Boost','Mecha Weapon Proficiency','Mounted Archery','Mounted Combat','Ride-By Attack','Spacer','Starship Battle Run','Skill Focus','Starship Dodge','Starship Feint','Starship Gunnery','Starship Mobility','Starship Operation','Starship Strafe','Stun Mecha','Surface Vehicle Operation','Thruster Blast','Trample','Vehicle Dodge','Vehicle Specialization','Zero-G Training']}},
    {lvl:2, name:'Evasive Maneuvers',  page:116, desc:'Defense Bonus applies to the Touch AC of piloted vehicles (with the right feats); 1/round, dodge one attack with a Drive/Pilot/Ride check (5+ ranks) vs the attack roll.', kind:'active'},
    {lvl:4, name:'Crackerjack Timing', page:116, desc:'+1 per 2 class levels on any maneuver Drive/Pilot/Ride check (5+ ranks in the skill).', kind:'passive'},
    {lvl:5, name:'Speed Demon',        page:116, desc:'Push mount/vehicle 25% faster (max ×4 → ×5), DC 20 +1/consecutive round; failure fatigues the mount or damages the vehicle 1 HD/round.', kind:'active'},
    {lvl:7, name:'Hotshot',            page:116, desc:'1/day (or 1 AP): declare the next vehicle/mount-charge attack ignores the target’s hardness on a hit.', kind:'active'},
    {lvl:8, name:'Shooting Star',      page:116, desc:'1/day (or 1 AP): declare the next vehicle/mount-charge attack an automatic threat on a hit.', kind:'active'},
    {lvl:10, name:'Aces High',         page:116, desc:'Re-roll any failed Drive/Pilot/Ride check (5+ ranks), once per check; second result stands.', kind:'passive'},
  ],
  'Ambassador': [
    {lvl:1, name:'Diplomatic Immunity', page:117, desc:'Diplomacy check vs crime severity (DC 15–35, table p.117) to escape legal penalty; consuls can be interceded for.', kind:'active'},
    {lvl:2, name:'Open Arms',           page:118, desc:'+½ Ambassador level (competence) on ALL Diplomacy checks — wired live.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',          page:117, desc:'At 3rd, 6th, and 9th level, from the Ambassador list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Attentive','Defensive Martial Arts','Dodge','Educated','Improved Initiative','Low Profile','Negotiator','Oathbound','Persuasive','Renown','Skill Focus','Studious','Trustworthy']}},
    {lvl:4, name:'Information Access',  page:118, desc:'Gather Information without Wealth checks vs non-hostile sources.', kind:'passive'},
    {lvl:5, name:'Senior Consul',       page:118, desc:'Appoint (Reputation bonus) junior consuls sharing Diplomatic Immunity; 1d4 hours to invoke/revoke.', kind:'meta'},
    {lvl:7, name:'Restricted Access',   page:118, desc:'+5 Computer Use vs security and +5 Research — wired live.', kind:'passive'},
    {lvl:8, name:'Stipend',             page:118, desc:'One-time Wealth +4 (apply manually — wealth is a snapshot).', kind:'meta'},
    {lvl:10, name:'Embassy Chief',      page:118, desc:'Appoint (Rep bonus) full consuls sharing Immunity/Information/Restricted Access, incl. an Attaché cohort (1+ Ambassador level).', kind:'meta'},
  ],
  'Bodyguard': [
    {lvl:1, name:'Harm’s Way',        page:119, desc:'(Ex) 1/round: take an adjacent ally’s incoming direct attack (declared before the roll; ally fixed per combat).', kind:'active'},
    {lvl:2, name:'Toughness',         page:119, desc:'+1 HP per character level (again at 8th, cumulative — +2 HP/level total) — BAKED into max HP, live.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',        page:119, desc:'At 3rd, 6th, and 9th level, from the Bodyguard list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Advanced Firearms Proficiency','Armor Proficiency (heavy)','Armor Proficiency (powered)','Attentive','Combat Expertise','Combat Reflexes','Defensive Martial Arts','Double Tap','Improved Brawl','Improved Damage Threshold','Improved Feint','Improved Knockout Punch','Knockout Punch','Precise Shot','Quick Draw','Quick Reload','Streetfighting','Vehicle Expert']}},
    {lvl:4, name:'Sudden Action',     page:119, desc:'1/day: at the start of any round, move up in initiative by ≤ Bodyguard level.', kind:'active'},
    {lvl:5, name:'Improved Charge',   page:119, desc:'Charge without moving in a straight line.', kind:'passive'},
    {lvl:7, name:'Defensive Strike',  page:119, desc:'When a melee attack misses via Parry or total defense: immediate counter-attack at +4.', kind:'passive'},
    {lvl:10, name:'Blanket Protection', page:119, desc:'(Ex) Full-round total defense (+4 dodge, +6 w/ 5 Tumble): up to 6 allies gain +1 insight Defense for 3 rounds.', kind:'active'},
  ],
  'Combat Medic': [
    {lvl:1, name:'Medical Specialist',    page:120, desc:'+1 competence on Treat Injury (+2 @5, +3 @8) — wired live.', kind:'passive'},
    {lvl:2, name:'Expert Healer',         page:120, desc:'+1 HP restored per Combat Medic level on medical-kit / surgery Treat Injury uses.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',            page:120, desc:'At 3rd, 6th, and 9th level, from the Combat Medic list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Armor Proficiency (light)','Armor Proficiency (medium)','Cautious','Cybernetic Surgery','Defensive Martial Arts','Dodge','Educated','Improved Initiative','Medical Expert','Personal Firearms Proficiency','Surface Vehicle Operation','Vehicle Expert','Xenomedic']}},
    {lvl:4, name:'Medical Mastery',       page:120, desc:'Take 10 on Treat Injury even under stress.', kind:'passive'},
    {lvl:7, name:'Minor Medical Miracle', page:120, desc:'(Ex) Within 3 rounds of death (≤ −Con HP): Treat Injury DC 30 (no Take 10/20), then patient Fort DC 15 → stabilized at 0 HP.', kind:'active'},
    {lvl:10, name:'Medical Miracle',      page:120, desc:'(Ex) Within 3 minutes of death: Treat Injury DC 40, patient Fort DC 20 → restored to 1d6 HP.', kind:'active'},
  ],
  'Daredevil': [
    {lvl:1, name:'Niche Specialty',     page:121, desc:'Skill Focus (granted once picked) in a Dex-based class skill.', kind:'meta'},
    {lvl:2, name:'Growing Confidence',  page:121, desc:'+½ Daredevil level on the class’s physical skills (Balance, Climb, Concentration, Drive, Escape Artist, Jump, Pilot, Ride, Swim, Tumble) — wired live.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',          page:121, desc:'At 3rd, 6th, and 9th level, from the GENERAL or EXPERT feat lists (open lists — no itemized restriction).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'General or Expert feat list'}},
    {lvl:4, name:'Tough It Out',        page:122, desc:'DR 1/− (stacks into the universal pool — already wired) + an instance of Improved Damage Threshold.', kind:'passive'},
    {lvl:5, name:'Shrug It Off',        page:122, desc:'1/day (or 1 AP): Concentration check DC = incoming damage → take half.', kind:'active'},
    {lvl:7, name:'Shut It Out',         page:122, desc:'Pick 3 + Con mod class skills: Take 10 on them under any circumstances. — wired: Take-10 designation tracker in 🎓 Class Choices (v8.66.0; capacity = 3 + BASE-Con mod, Ex bakes only, grows with the score — Adam’s ruling)', kind:'meta'},
    {lvl:8, name:'Shake It Off',        page:122, desc:'1/day (or 1 AP): on a failed Will save, Concentration check vs the same DC → save succeeds.', kind:'active'},
    {lvl:10, name:'Let It Out',         page:122, desc:'1/day (or 1 AP): roll 2d20-take-better on any Str- or Dex-based skill check.', kind:'active'},
  ],
  'Explorer': [
    {lvl:1, name:'Explorer Lore',   page:123, desc:'Lore check 1d20 + class level + Int mod (DC 10–30 table); +2 with 5 ranks Kn(history) or Kn(physical sciences) as applicable; Take 10 only. With 5 ranks Kn(theology & philosophy): 1/day (or 1 AP) re-roll at +5 DC.', kind:'active'},
    {lvl:1, name:'Survivalist',     page:123, desc:'Guide feat + any ONE Weapon Proficiency feat (the same one as the class’s starting feat — not two).', kind:'meta'},
    {lvl:2, name:'Intrepid',        page:123, desc:'+½ Explorer level (morale) on saves vs fear; fear effects reduced one tier (Shaken ignored, Frightened→Shaken, Panicked→Frightened) — conditional save row wired.', kind:'passive'},
    {lvl:2, name:'Trap Sense',      page:123, desc:'+1 Ref vs traps & +1 dodge AC vs trap attacks (+2 @5, +3 @8) — stacks with other classes’ Trap Sense, wired.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',      page:123, desc:'At 3rd, 6th, and 9th level, from the Explorer list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Action Boost','Advanced Two-Weapon Fighting','Aircraft Operation (spacecraft)','Archaic Weapons Proficiency','Armor Proficiency (light)','Armor Proficiency (medium)','Attentive','Brawl','Dodge','Educated','Endurance','Exotic Firearms Proficiency','Exotic Melee Weapon Proficiency','Heroic Surge','Improved Feint','Improved Knockout Punch','Improved Two-Weapon Fighting','Jack of All Trades','Knockout Punch','Mobility','Nimble','Open-Minded','Renown','Spacer','Streetfighting','Studious','Track','Two-Weapon Fighting','Vehicle Expert']}},
    {lvl:4, name:'Evasion',         page:124, desc:'Evasion (Improved Evasion if already owned). — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:5, name:'Extra Step',      page:124, desc:'1/day (or 1 AP): an extra 5-ft step, no AoO. At 10th: at will, free.', kind:'active'},
    {lvl:7, name:'Exceptional Find', page:124, desc:'A long-lost treasure (GM), or the equivalent of Windfall (+3 Wealth — apply manually).', kind:'meta'},
    {lvl:10, name:'Fearless',       page:123, desc:'(Ex) Effectively immune to fear; allies within 30 ft +2 morale vs fear — immunity wired.', kind:'passive'},
  ],
  'Field Officer': [
    {lvl:1, name:'Battlefield Direction', page:124, desc:'(Ex) Aid Another via Diplomacy DC 10 (no Take 10/20): ally gains competence = the better of Cha or Rep bonus.', kind:'active'},
    {lvl:2, name:'Uncanny Survival',      page:125, desc:'1/day (or 1 AP), immediate: +½ class level to Defense for 1 round.', kind:'active'},
    {lvl:3, name:'Bonus Feat',            page:124, desc:'At 3rd, 6th, and 9th level, from the Field Officer list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Advanced Firearms Proficiency','Armor Proficiency (medium)','Armor Proficiency (heavy)','Armor Proficiency (powered)','Combat Expertise','Defensive Martial Arts','Dodge','Improved Initiative','Iron Will','Jack of All Trades','Mobility','Precise Shot','Quick Draw','Renown','Shot on the Run']}},
    {lvl:4, name:'Tactical Expertise',    page:125, desc:'(Ex) Full-round: Kn(tactics) DC 15 + #allies → allies gain competence attack OR dodge Defense = Rep bonus, 1 round.', kind:'active'},
    {lvl:5, name:'Veteran Officer',       page:125, desc:'1/day (or 1 AP): re-roll any combat d20 (once per roll; second stands).', kind:'active'},
    {lvl:7, name:'Tactical Mastery',      page:125, desc:'(Ex) Tactical Expertise as a standard action.', kind:'passive'},
    {lvl:8, name:'Commanding Presence',   page:125, desc:'(Ex) Standard action: Diplomacy DC 20 clears an ally’s cowering/dazed/fatigued/nauseated/panicked/shaken/stunned; or Intimidate vs level check to shake a foe 1d6 + ½ level + Cha rounds.', kind:'active'},
    {lvl:10, name:'Unit Cohesion',        page:125, desc:'(Ex) Free action, 1/round: spend an AP to give an ally +2d6 on a d20 result; allies may donate AP to the Field Officer.', kind:'active'},
  ],
  'Infiltrator': [
    {lvl:1, name:'Set the Stage',    page:126, desc:'Search as a standard action (casually, unnoticed); Take 20 on Search in half time.', kind:'passive'},
    {lvl:2, name:'In the Wings',     page:126, desc:'+½ Infiltrator level to Hide and Move Silently — wired live.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',       page:126, desc:'At 3rd, 6th, and 9th level, from the EXPERT feat list (open list).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Expert feat list'}},
    {lvl:4, name:'Steal the Show',   page:126, desc:'+1 competence per 3 Infiltrator levels to Bluff, Decipher Script/Code, Disguise, Forgery, Sleight of Hand — wired live (v8.24.0: the Decipher bonus previously missed its key).', kind:'passive'},
    {lvl:5, name:'My Own Stuntman',  page:126, desc:'+1 competence (+2 @10) to Balance, Climb, Jump, Swim, Tumble — wired live.', kind:'passive'},
    {lvl:7, name:'Understudy',       page:127, desc:'Observe a target within 30 ft for 3+ rounds: +4 circumstance to Disguise to impersonate them for 24 hours.', kind:'active'},
    {lvl:8, name:'Method Actor',     page:127, desc:'Iron Will and Jack of All Trades as bonus feats — auto-granted.', kind:'meta'},
    {lvl:10, name:'Impromptu Improv', page:127, desc:'1/day (or 1 AP), immediate: re-roll a failed Cha-based skill check (second stands).', kind:'active'},
  ],
  'Investigator': [
    {lvl:1, name:'Profile',        page:127, desc:'Gather Info DC 15 (free) for a suspect profile; Investigate DC 15 expands it (+2 circumstance to locate/capture). Also +½ Investigator level (rounded up) to Sense Motive — wired live.', kind:'passive'},
    {lvl:2, name:'Contact',        page:127, desc:'A low-level contact (mid @5, high @8): information or one skill check per week; compensation Purchase DC 10/15/20 for street contacts.', kind:'meta'},
    {lvl:3, name:'Bonus Feat',     page:127, desc:'At 3rd, 6th, and 9th level, from the Investigator list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Advanced Firearms Proficiency','Armor Proficiency (light)','Armor Proficiency (medium)','Attentive','Brawl','Defensive Martial Arts','Dodge','Double Tap','Educated','Investigator','Knockout Punch','Personal Firearms Proficiency','Point-Blank Shot','Skill Focus','Studious']}},
    {lvl:4, name:'Nonlethal Force', page:128, desc:'Deal nonlethal with lethal melee weapons at NO −4 penalty.', kind:'passive'},
    {lvl:7, name:'Discern Lie',    page:128, desc:'Sense Motive vs Bluff (or DC 10) to tell if a watched subject knowingly lies.', kind:'active'},
    {lvl:10, name:'Sixth Sense',   page:128, desc:'1/day (or 1 AP): treat a Gather Info/Investigate/Listen/Research/Search/Sense Motive/Spot check as a natural 20.', kind:'active'},
  ],
  'Marketeer': [
    {lvl:1, name:'Shrewd Negotiator', page:129, desc:'+½ Marketeer level to Appraise, Diplomacy, and Knowledge (business) — wired live. Diplomacy DC 25/35 negotiates −1 Purchase DC on items ≤ DC 30/40.', kind:'passive'},
    {lvl:2, name:'Word on the Street', page:129, desc:'Gather Information: general/specific instantly, restricted in 1 hour (protected still 1d4+1 hours).', kind:'passive'},
    {lvl:3, name:'Bonus Feat',        page:129, desc:'At 3rd, 6th, and 9th level, from the EXPERT feat list (open list).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Expert feat list'}},
    {lvl:4, name:'Conceal Motives',   page:129, desc:'+½ Marketeer level (circumstance) on Bluff vs Sense Motive — conditional.', kind:'passive'},
    {lvl:5, name:'Discreet Inquiry',  page:129, desc:'Diplomacy check (DC 10–25+ table) to locate a person with specific skills/feats/abilities.', kind:'active'},
    {lvl:7, name:'Utterly Convincing', page:130, desc:'1/day (or with an AP): +1d6 to a Cha-based skill check (2d6 when boosting with an AP).', kind:'active'},
    {lvl:8, name:'Well-Connected',    page:130, desc:'+Reputation modifier (circumstance) on Diplomacy and Gather Information where recognized.', kind:'passive'},
    {lvl:10, name:'Networking Mogul', page:130, desc:'+4 Wealth (apply manually) and Diplomacy DC 45 to shave −1 Purchase DC off items ≤ DC 60 (+2 DC per point above).', kind:'meta'},
  ],
  'Martial Artist': [
    {lvl:1, name:'Living Weapon',  page:131, desc:'(Ex) Unarmed die 1d8 (1d10 @4, 2d6 @8) — replaces the CMA lethal die (Brawl unaffected); either fist/elbows/knees, hands full OK, NO off-hand penalty unarmed — wired on the unarmed row.', kind:'passive'},
    {lvl:2, name:'Flying Kick',    page:131, desc:'(Ex) Charge: +class level unarmed damage with a Knockback chance (Fort DC = damage dealt).', kind:'active'},
    {lvl:3, name:'Bonus Feat',     page:131, desc:'At 3rd, 6th, and 9th level, from the Martial Artist list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Acrobatic','Advanced Combat Martial Arts','Advanced Defensive Martial Arts','Agile Riposte','Archaic Weapons Proficiency','Combat Reflexes','Combat Throw','Deflect Arrows','Elusive Target','Exotic Melee Weapon Proficiency','Improved Combat Throw','Improved Combat Martial Arts','Improved Defensive Martial Arts','Nerve Pinch','Stunning Fist','Unbalance Opponent']}},
    {lvl:5, name:'Iron Fist',      page:131, desc:'(Ex) Move action, Concentration DC 20: next unarmed strike counts as a +1 MAGIC weapon (+1 hit/damage, ignores 5 hardness, beats DR/magic). At will.', kind:'active'},
    {lvl:7, name:'Flurry of Blows', page:131, desc:'(Ex) Unarmored, unarmed full attack: one extra attack at highest BAB, all attacks −2 — wired as an alt mode.', kind:'passive'},
    {lvl:10, name:'Diamond Fist',  page:131, desc:'(Su) Iron Fist upgraded: +4 hit/damage, counts as ADAMANTINE (ignores 20 hardness); base Iron Fist needs no check anymore.', kind:'active'},
  ],
  'Personality': [
    {lvl:1, name:'Eclectic Taste',   page:132, desc:'Designate a cross-class skill as a class skill (again @5) — record the picks; apply at the table.', kind:'meta'},
    {lvl:1, name:'Unlimited Access', page:132, desc:'+Personality level on Diplomacy/Bluff to access private events; Diplomacy DC 10–25 for ticket upgrades.', kind:'passive'},
    {lvl:2, name:'Winning Smile',    page:133, desc:'(Ex) Will DC 10 + class level + Cha bonus or one target regards the Personality as a trusted friend (1 min/level; mind-affecting).', kind:'active'},
    {lvl:3, name:'Bonus Feat',       page:132, desc:'At 3rd, 6th, and 9th level, from the Personality list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Acrobatic','Agile','Alertness','Animal Affinity','Combat Expertise','Confident','Creative','Deceptive','Defensive Martial Arts','Dodge','Educated','Trustworthy']}},
    {lvl:4, name:'A-Lister',         page:133, desc:'+1 Reputation and +2 Wealth (apply manually); Unlimited Access always succeeds unless rude/unrecognizable.', kind:'meta'},
    {lvl:7, name:'Compelling Performance', page:133, desc:'(Ex) 1/day (or 1 AP): full-round performance — one target Will DC 10 + level + Cha or suffer Despair (−2 morale) / gain Hope (+2) / Rage for 1d4+1 rounds.', kind:'active'},
    {lvl:8, name:'Royalty',          page:133, desc:'+2 Wealth, +1 Reputation (apply manually); entourage = Rep score shares Unlimited Access.', kind:'meta'},
    {lvl:10, name:'Ubiquitous Fame', page:133, desc:'(Ex) Reputation DC 20: Suggestion as an Ex ability 1/day (or 1 AP), Will DC 20 + Cha mod.', kind:'active'},
  ],
  'Sharpshooter': [
    {lvl:1, name:'Close-Combat Shot', page:134, desc:'Ranged attacks with Medium or smaller weapons provoke NO attacks of opportunity in threatened areas.', kind:'passive'},
    {lvl:2, name:'Signature Weapon',  page:134, desc:'Weapon Focus in a chosen RANGED personal weapon (+1 attack) — pick it in Class Choices; granted automatically.', kind:'meta'},
    {lvl:3, name:'Bonus Feat',        page:134, desc:'At 3rd, 6th, and 9th level, from the Sharpshooter list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Advanced Firearms Proficiency','Advanced Two-Weapon Fighting','Burst Fire','Dead Aim','Double Tap','Far Shot','Improved Two-Weapon Fighting','Manyshot','Precise Shot','Quick Draw','Quick Reload','Rapid Shot','Shot on the Run','Skip Shot','Strafe','Two-Weapon Fighting']}},
    {lvl:4, name:'Defensive Positioning', page:134, desc:'+2 more cover bonus to Defense and Reflex when in any cover.', kind:'passive'},
    {lvl:5, name:'Lightning Shot',    page:134, desc:'Ranged flurry: one extra attack at highest BAB, all attacks −2, full attack action — alt mode on the signature/ranged rows.', kind:'passive'},
    {lvl:7, name:'Snipe',             page:134, desc:'Targets’ cover bonus vs the Sharpshooter reduced by 2.', kind:'passive'},
    {lvl:8, name:'Signature Style',   page:134, desc:'+2 MORE attack with the Signature Weapon (total +3) — wired on the weapon row.', kind:'passive'},
    {lvl:10, name:'Bullseye',         page:134, desc:'1/day (or 1 AP): +20 to hit ignoring cover (declared before), or auto-threat +20 to confirm (after).', kind:'active'},
  ],
  'Soldier': [
    {lvl:1, name:'Weapon Focus',          page:135, desc:'Weapon Focus (class feature = the feat) in a chosen proficient weapon — pick it in Class Choices; granted automatically.', kind:'meta'},
    {lvl:2, name:'Weapon Specialization', page:135, desc:'Weapon Specialization (+2 damage) with the focused weapon — granted automatically at 2nd.', kind:'meta'},
    {lvl:3, name:'Bonus Feat',            page:135, desc:'At 3rd, 6th, and 9th level, from the Soldier list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Advanced Firearms Proficiency','Archaic Weapons Proficiency','Armor Proficiency (medium)','Armor Proficiency (heavy)','Armor Proficiency (powered)','Brawl','Burst Fire','Cleave','Combat Expertise','Combat Martial Arts','Combat Reflexes','Exotic Firearms Proficiency','Exotic Melee Weapon Proficiency','Far Shot','Great Cleave','Improved Brawl','Improved Knockout Punch','Knockout Punch','Power Attack']}},
    {lvl:4, name:'Tactical Aid',          page:136, desc:'1/day (or 1 AP), full-round: allies in sight/voice (incl. self) gain +1 competence attack for ½ class level rounds.', kind:'active'},
    {lvl:5, name:'Improved Critical',     page:136, desc:'Threat range +1 with the specialized weapon — noted on the weapon row.', kind:'passive'},
    {lvl:7, name:'Improved Reaction',     page:136, desc:'+2 competence on initiative — wired live.', kind:'passive'},
    {lvl:8, name:'Tactical Expertise',    page:136, desc:'1/day (or 1 AP), free: an additional move OR standard action this round.', kind:'active'},
    {lvl:10, name:'Walk It Off',          page:136, desc:'1/day (or 1 AP), swift: recover 25% of total HP (only while at ≤50%).', kind:'active'},
  ],
  'Survivor': [
    {lvl:1, name:'Evasion',            page:137, desc:'Evasion (Improved Evasion if already owned). — wired as the Reflex-card tag (v8.64.0, unified sources)', kind:'passive'},
    {lvl:2, name:'Gut Feeling',        page:137, desc:'+½ Survivor level to Gamble and Sense Motive — wired live.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',         page:136, desc:'At 3rd, 6th, and 9th level, from the Survivor list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Action Boost','Advanced Defensive Martial Arts','Advanced Dodge','Agile','Athletic','Combat Expertise','Combat Throw','Deceptive','Defensive Martial Arts','Deflect Arrows','Diehard','Endurance','Improved Damage Threshold','Improved Defensive Martial Arts','Improved Dodge','Improved Initiative','Jack of All Trades','Lightning Reflexes','Low Profile','Mobility','Rapid Metabolism','Run','Sidestep Charge','Skill Focus','Stealthy','Two-Weapon Defense','Unbalance Opponent']}},
    {lvl:4, name:'Fight or Flight',    page:137, desc:'1/day (or 1 AP): FIGHT (+4 to Str, Dex, or Con for 1 min) or FLIGHT (Run feat, ×5 movement, 1 min); then Fatigued 1 min. @8 (Improved): +4 to TWO attributes / Run + Fleet of Foot, and no fatigue.', kind:'active'},
    {lvl:5, name:'Best Defense',       page:137, desc:'Trade up to (Survivor Defense Bonus) points of Defense for equal melee attack bonus; adjustable as a free action.', kind:'passive'},
    {lvl:7, name:'Uncanny Instincts',  page:137, desc:'+Wis modifier (min +1) to ALL saves and initiative — wired live.', kind:'passive'},
    {lvl:10, name:'Will to Live',      page:137, desc:'1/day: delay a killing effect Wis-mod rounds, then Will DC 20 to be Dying (−Con-mod HP) instead of Dead.', kind:'active'},
  ],
  'Tactician': [
    {lvl:1, name:'Smart Defense',          page:138, desc:'(Ex) +Int bonus to Defense (lost whenever Dex to AC is lost) — wired into the AC chain.', kind:'passive',
     effect:{type:'touchAcBonus', source:'attr:INT-mod', stack:'untyped'}},
    {lvl:2, name:'Tricky Tactics',         page:138, desc:'(Ex) 1/combat, free: Kn(tactics) DC 20 → +1 circumstance (+1 per 5 over) to initiative, an attack, or Bluff/Intimidate/Sense Motive, 1 round.', kind:'active'},
    {lvl:3, name:'Bonus Feat',             page:138, desc:'At 3rd, 6th, and 9th level, from the EXPERT or FIGHTER feat lists (open lists).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Expert or Fighter feat list'}},
    {lvl:4, name:'Unorthodox Strategy',    page:138, desc:'(Ex) 1/enemy after 3 rounds engaged: opposed Kn(tactics) (+BAB each) — offense: roll 2d20-take-better attacking them; defense: they roll 2d20-take-worse vs you; Int-mod rounds.', kind:'active'},
    {lvl:5, name:'Personalized Technique', page:138, desc:'(Ex) Chosen weapon: +½ Int (down) to hit and +½ Int (up) to damage — pick it in Class Choices; wired on the weapon row.', kind:'meta'},
    {lvl:7, name:'Uncanny Dodge',          page:138, desc:'(Ex) Keep Dex to AC and Int to Defense while flat-footed / vs invisible attackers.', kind:'passive'},
    {lvl:8, name:'Proact',                 page:138, desc:'(Ex) 1/day (or 1 AP), immediate: halve the damage of an attack (not while flat-footed/surprised).', kind:'active'},
    {lvl:10, name:'Checkmate',             page:138, desc:'(Ex) Hit the same foe in 3 straight rounds → the first 4th-round hit is an automatic threat (or auto-confirmed if already one); massive-damage DC +Int mod, choose unconscious or disabled.', kind:'active'},
  ],
  'Techsmith': [
    {lvl:1, name:'Mastercraft XP Reserve', page:140, desc:'Mastercrafter feat (granted) + a reserve of 250 XP × class level per level, spendable only on mastercraft items (lost if unspent at level-up).', kind:'meta'},
    {lvl:1, name:'Upgraded Kit',           page:140, desc:'Assemble mastercraft +1 electrical/mechanical tool kits (+2 @4, +3 @7) — Tech-Scale caps waived.', kind:'active'},
    {lvl:2, name:'Quick Craft',            page:140, desc:'Scratch-built items 25% faster (@5: ordinary AND mastercraft 50% faster).', kind:'passive'},
    {lvl:2, name:'Superior Repair',        page:141, desc:'1 hour + kit + facility: repair 2d6/3d6/4d6 + class level HP by Repair result (20/30/40).', kind:'active'},
    {lvl:3, name:'Bonus Feat',             page:141, desc:'At 3rd, 6th, and 9th level, from the Techsmith list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]},
       restriction:['Aircraft Operation (spacecraft)','Armor Proficiency (light)','Armor Proficiency (medium)','Armor Proficiency (powered)','Builder','Cautious','Gearhead','Mastercrafter','Mecha Operation','Salvage','Skill Focus','Starship Operation','Surface Vehicle Operation','Vehicle Expert','Zero-G Training']}},
    {lvl:4, name:'Reconfigure Weapon',     page:141, desc:'1 hour, Repair DC 20/25: build in changed RoF, +50% ammo, +2 concealment, +10% range, or Signature Grip.', kind:'active'},
    {lvl:5, name:'Sabotage',               page:142, desc:'Disable Device DC 20/25: device users suffer −class level on checks, or a weapon misfires/breaks on next use.', kind:'active'},
    {lvl:7, name:'Quick Fix',              page:142, desc:'Repair in half time at +5 DC.', kind:'passive'},
    {lvl:8, name:'Weapon Upgrade',         page:142, desc:'1 hour + Craft (mechanical) DC 25–40: daze/prone/shaken/stun riders (handheld) or +2 dice / hardness-piercing / +1 crit mult (vehicle-scale). Counts as a gadget slot.', kind:'active'},
    {lvl:10, name:'Prototype',             page:143, desc:'Build next-Tech-Scale base items at +10 Craft DC; a Prototype Laboratory (Purchase DC 40/skill) unlocks next-TS mastercraft & gadgets.', kind:'active'},
    {lvl:10, name:'Unflustered',           page:143, desc:'Concentration DC 15 (free): use Computer Use/Craft/Demolitions/Disable Device/Repair without provoking AoO.', kind:'passive'},
  ],
  'Weaponmaster': [
    {lvl:1, name:'Weapon Control',  page:144, desc:'Chosen weapon (pick in Class Choices): +2 damage when attacking to kill (counts as AND stacks with Weapon Specialization), or nonlethal at no penalty — wired on the weapon row.', kind:'meta'},
    {lvl:2, name:'Weapon Expert',   page:144, desc:'+½ Weaponmaster level on Craft/Knowledge checks about the weapon; NO XP cost mastercrafting it.', kind:'passive'},
    {lvl:3, name:'Bonus Feat',      page:143, desc:'At 3rd, 6th, and 9th level, from the FIGHTER feat list (open list).', kind:'meta',
     effect:{type:'bonusFeats', formula:{milestones:[3,6,9]}, restriction:'Fighter feat list'}},
    {lvl:4, name:'Telling Blows',   page:144, desc:'+1d6 damage on every hit with the chosen weapon — wired on the weapon row.', kind:'passive'},
    {lvl:5, name:'Totem Weapon',    page:144, desc:'(Ex) +1 hit & damage with the chosen weapon; if mastercrafted, counts as MAGIC vs DR and ignores 5 hardness — wired.', kind:'passive'},
    {lvl:7, name:'Deft Draw',       page:144, desc:'Draw/sheathe free; +½ class level initiative when drawing it as a first-round action — conditional init row.', kind:'passive'},
    {lvl:8, name:'Precise Blow',    page:144, desc:'Threat range +1 with the chosen weapon (applied AFTER Improved Critical) — noted on the weapon row.', kind:'passive'},
    {lvl:10, name:'Living Weapon',  page:144, desc:'(Ex) Another +1 hit & damage; if self-mastercrafted, counts as magic AND adamantine, ignoring 10 hardness — wired.', kind:'passive'},
  ],

  // v8.3.6 / v8.3.7: Hero class features.
  //
  // All 6 Hero classes follow the same pattern:
  // - Talent at L1, L3, L5, L7, L9 (picked from class-specific talent trees;
  //   see HH for each tree's options). Talents are still kind:'unimplemented'
  //   because the talent system isn't mechanized yet; the player tracks
  //   talent picks manually.
  // - Bonus Feat at L2, L4, L6, L8, L10 (picked from a class-specific
  //   itemized feat list). v8.3.7 mechanizes these: ONE bonus-feat entry
  //   at lvl:2 per class with effect.formula='everyEvenLvl' (giving 5 slots
  //   over levels 2-10) and restriction:<explicit array of feat names>.
  //   The feat browser's slot-context banner shows the restriction; the
  //   feat list defaults to filtering by the allowlist when filling.
  //
  // The Hero feat lists are itemized from the handbook (Strong p.59, Fast p.61,
  // Tough p.63, Smart p.65, Dedicated p.67, Charismatic p.69). Two feats that
  // appear in the lists (Brawl, Persuasive) were missing from FEATS_DB and
  // are now added in v8.3.7.
  'Strong Hero': [
    {lvl:1, name:'Talent (L1)',         page:60, desc:'Pick one talent from a Strong Hero talent tree (Melee Smash, Ignore Hardness, Extreme Effort trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Strong)', page:60, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Strong Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Animal Affinity','Archaic Weapons Proficiency','Athletic','Blind-Fight','Brawl','Cleave','Combat Martial Arts','Combat Reflexes','Great Cleave','Greater Weapon Focus','Exotic Weapon Proficiency','Improved Brawl','Improved Bull Rush','Improved Combat Martial Arts','Improved Overrun','Improved Sunder','Power Attack','Stand Still','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Weapon Focus']}},
    {lvl:3, name:'Talent (L3)',         page:60, desc:'Another Strong Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',         page:60, desc:'Another Strong Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',         page:60, desc:'Another Strong Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',         page:60, desc:'Another Strong Hero talent.', kind:'unimplemented'},
  ],
  'Fast Hero': [
    {lvl:1, name:'Talent (L1)',       page:61, desc:'Pick one talent from a Fast Hero talent tree (Defensive, Increased Speed, Evasion trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Fast)', page:61, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Fast Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Acrobatic','Combat Expertise','Combat Reflexes','Combat Throw','Defensive Martial Arts','Dodge','Double Tap','Elusive Target','Focused','Improved Disarm','Manyshot','Mobility','Personal Firearms Proficiency','Point-Blank Shot','Sidestep Charge','Stealthy','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Vehicle Expert','Weapon Finesse']}},
    {lvl:3, name:'Talent (L3)',       page:61, desc:'Another Fast Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',       page:61, desc:'Another Fast Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',       page:61, desc:'Another Fast Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',       page:61, desc:'Another Fast Hero talent.', kind:'unimplemented'},
  ],
  'Tough Hero': [
    {lvl:1, name:'Talent (L1)',        page:63, desc:'Pick one talent from a Tough Hero talent tree (Robust, Stamina, Unbreakable trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Tough)', page:63, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Tough Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Alertness','Athletic','Brawl','Confident','Diehard','Endurance','Great Fortitude','Improved Brawl','Improved Bull Rush','Improved Feint','Investigator','Knockout Punch','Mind Over Body','Power Attack','Rapid Metabolism','Streetfighting','Toughness','Ultra Immune System','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Vehicle Expert']}},
    {lvl:3, name:'Talent (L3)',        page:63, desc:'Another Tough Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',        page:63, desc:'Another Tough Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',        page:63, desc:'Another Tough Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',        page:63, desc:'Another Tough Hero talent.', kind:'unimplemented'},
  ],
  'Smart Hero': [
    {lvl:1, name:'Talent (L1)',        page:65, desc:'Pick one talent from a Smart Hero talent tree (Research, Strategy, Savant trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Smart)', page:65, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Smart Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Builder','Cautious','Closed Mind','Combat Expertise','Diligent','Educated','Gearhead','Improved Disarm','Improved Initiative','Improved Trip','Iron Will','Jack of All Trades','Lightning Reflexes','Meticulous','Open Minded','Studious','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Vehicle Expert','Weapon Focus']}},
    {lvl:3, name:'Talent (L3)',        page:65, desc:'Another Smart Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',        page:65, desc:'Another Smart Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',        page:65, desc:'Another Smart Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',        page:65, desc:'Another Smart Hero talent.', kind:'unimplemented'},
  ],
  'Dedicated Hero': [
    {lvl:1, name:'Talent (L1)',            page:67, desc:'Pick one talent from a Dedicated Hero talent tree (Insightful, Faith, Healing, Skill Emphasis trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Dedicated)', page:67, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Dedicated Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Advanced Firearms Proficiency','Alertness','Archaic Weapons Proficiency','Attentive','Blind-Fight','Burst Fire','Deceptive','Educated','Far Shot','Force of Will','Improved Initiative','Investigator','Iron Will','Medical Expert','Mental Resistance','Meticulous','Negotiator','Surgery','Track','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Weapon Focus']}},
    {lvl:3, name:'Talent (L3)',            page:67, desc:'Another Dedicated Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',            page:67, desc:'Another Dedicated Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',            page:67, desc:'Another Dedicated Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',            page:67, desc:'Another Dedicated Hero talent.', kind:'unimplemented'},
  ],
  'Charismatic Hero': [
    {lvl:1, name:'Talent (L1)',              page:69, desc:'Pick one talent from a Charismatic Hero talent tree (Charm, Fast-Talk, Leadership trees).', kind:'unimplemented'},
    {lvl:2, name:'Bonus Feat (Charismatic)', page:69, desc:'Bonus feat at L2, L4, L6, L8, L10 (5 total) from the Charismatic Hero feat list. Must meet prereqs.', kind:'meta',
     effect:{type:'bonusFeats', formula:'everyEvenLvl',
       restriction:['Agile Riposte','Creative','Deceitful','Deceptive','Dodge','Iron Will','Jack of All Trades','Leadership','Lightning Reflexes','Low Profile','Negotiator','Persuasive','Point-Blank Shot','Renown','Trustworthy','Unstable Mutation I','Unstable Mutation II','Unstable Mutation III','Unstable Mutation IV','Unstable Mutation V','Windfall']}},
    {lvl:3, name:'Talent (L3)',              page:69, desc:'Another Charismatic Hero talent.', kind:'unimplemented'},
    {lvl:5, name:'Talent (L5)',              page:69, desc:'Another Charismatic Hero talent.', kind:'unimplemented'},
    {lvl:7, name:'Talent (L7)',              page:69, desc:'Another Charismatic Hero talent.', kind:'unimplemented'},
    {lvl:9, name:'Talent (L9)',              page:69, desc:'Another Charismatic Hero talent.', kind:'unimplemented'},
  ],
};

// v8.10.1: prestige VARIANT classes share their book section's feature set
// (GMG combines them: one Knight, one Guildmember, one Theurge, one
// Trickster, one Technomage/path section). Adam's design: variants are
// separate class entries; the features are identical text.
CLASS_FEATURES['Holy Knight'] = CLASS_FEATURES['Eldritch Knight'];
CLASS_FEATURES['Guildmember (Psionic)'] = CLASS_FEATURES['Guildmember (Magic)'];
CLASS_FEATURES['Psychic Theurge'] = CLASS_FEATURES['Mystic Theurge'];
CLASS_FEATURES['Psychic Trickster'] = CLASS_FEATURES['Arcane Trickster'];
CLASS_FEATURES['Technopath'] = CLASS_FEATURES['Technomage'];

// v8.5.4: The Druid Option feature set (HH, end of the Cleric entry). A
// Druid-option Cleric trades Turn Undead, the Aura, Cure/Inflict spontaneity
// and both Domain choices for these; unlisted Cleric features (Esoteric
// Knowledge, Bonus Feat) are retained per "anything not expressly mentioned
// is the same as the Cleric."
const DRUID_OPTION_FEATURES = [
  {lvl:1, name:'Druid Spells', page:83, desc:'Divine prepared caster on the DRUID spell list (traded: both Domain choices + Turn Undead). See Powers & Spells panel.', kind:'passive'},
  {lvl:1, name:'Spontaneous Casting (Summon Nature’s Ally)', page:82, desc:'Convert any uncast prepared spell into Summon Nature’s Ally of the same level or lower — the ⇄ button in the Prepared Spells panel (Powers & Spells tab).', kind:'active'},
  {lvl:1, name:'Animal Companion', page:83, desc:'A loyal companion from the Druid list (badger, camel, dire rat, dog, eagle, hawk, horse, owl, pony, snake, wolf; aquatic campaigns add crocodile, porpoise, Medium shark, squid).', kind:'unimplemented'},
  {lvl:1, name:'Wild Empathy', page:83, desc:'Improve an animal’s attitude: 1d20 + Druid level + Cha mod (Diplomacy-like; within 30 ft., ~1 minute). −4 vs magical beasts of Int 1–2.', kind:'active'},
  {lvl:1, name:'No Metal', page:83, desc:'No metal weapons or armor (implements of the field — sickle, scythe — excepted); violating suspends all Druid spells until the equipment is set aside and an Atonement is performed.', kind:'passive'},
  {lvl:3, name:'Woodland Stride', page:84, desc:'Move through natural undergrowth at normal speed without damage or impairment (enchanted/magically manipulated growth still applies).', kind:'passive'},
  {lvl:5, name:'Wildshape', page:84, desc:'From 5th level (3rd-level spell access): spontaneously convert any spell of 3rd level or higher into Wildshape (see Metamorphosis), as a spell-like ability at character level.', kind:'active'},
];
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
