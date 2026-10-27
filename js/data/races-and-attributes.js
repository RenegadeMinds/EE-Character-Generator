// =============================================================================
// js/data/races-and-attributes.js
// RACES AND ATTRIBUTES — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Attribute names, every playable race,
//   hybrid-eligible races, sizes and racial speeds.
//
// KEY NAMES (so you can search for them)
//   tables and state: ATTR_NAMES, RACES, TALENT_ATTR_BAKES, RACE_BASE_SPEED,
//   SIZE_LADDER, DIE_STEP_UP, HYBRID_HUMANOID_RACES, ATTR_FULL,
//   ATTR_KEY_IDX, RACE_WEAPON_PROFICIENCIES
//
// WHERE IT CAME FROM
//   Gathered from js/app/43-create-attributes-race-occupation.js,
//   js/app/55-mutations-engine.js, js/app/62-power-suites-feats-page-
//   proficiencies.js, js/rules/01-races-and-base-classes.js,
//   js/rules/09-item-effects-and-buffs.js, js/rules/14-resistances-speed-dr-
//   size.js when the code was regrouped by topic and page. Each function and
//   table moved whole and unchanged, with the comments above it, including
//   the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ========== DATA ==========
const ATTR_NAMES = ['STR','DEX','CON','INT','WIS','CHA'];
const RACES = {
  // v8.16.0 RACES WIRING PASS (Adam's audit request, 2026-09-03): the notes
  // stay verbatim (tooltips), but the mechanical payload is now STRUCTURED —
  // traits:[{type,target,value,condition?,label?}] feed buildRacialBonuses
  // (saves/AC/init + skill: targets), size ('S'/'L') feeds the size engine,
  // speed/modes feed computeSpeeds, sr/dr/resist/immune feed their engines,
  // bonusPP feeds the psionic pool, stocky feeds the armor-speed exemption.
  // Active/per-diem racial abilities (Energy Ray, Darkness 1/day, Expansion,
  // Breath weapon, Outburst…) stay note-level — the GM-adjudicated door.
  // === Core races (Hero's Handbook) ===
  Human:{adj:{},ecl:0,notes:'Bonus feat + 5 extra skill pts at 1st, +1/lvl. Adaptable.'},
  Dromite:{adj:{CHA:2,STR:-2,WIS:-2},ecl:1,natAC:3,size:'S',
    traits:[{type:'racial',target:'skill:Spot',value:2,label:'Dromite senses'}],
    notes:'Small (+1 AC/atk, +4 Hide). Chitin +3 NAC. Energy Ray 1/day. Scent. +2 Spot.'},
  Drow:{adj:{INT:2,CHA:2},ecl:2,sr:{base:11,perLevel:true},
    traits:[{type:'racial',target:'will',value:2,condition:'vs spells & spell-like abilities',label:'Drow willpower'}],
    notes:'Darkvision 120′. SR 11+lvl. +2 Will vs spells. Darkness/Faerie Fire 1/day. Light Blindness.'},
  Duergar:{adj:{CON:2,CHA:-4},ecl:1,stocky:true,speed:20,immune:['poison','paralysis'],
    notes:'Stocky. 120′ Darkvision. Immune poison/paralysis. Expansion+Invisibility 1/day.'},
  Dwarf:{adj:{CON:2,CHA:-2},ecl:0,stocky:true,
    traits:[{type:'racial',target:'fort',value:2,condition:'vs poison',label:'Dwarven hardiness'},
            {type:'racial',target:'will',value:2,condition:'vs spells & spell-like abilities',label:'Dwarven hardiness'},
            {type:'racial',target:'fort',value:2,condition:'vs spells & spell-like abilities',label:'Dwarven hardiness'},
            {type:'racial',target:'ref',value:2,condition:'vs spells & spell-like abilities',label:'Dwarven hardiness'}],
    notes:'Stocky. 60′ Darkvision. Stonecunning. Stability +4. +2 saves vs poison/spells.'},
  Elan:{adj:{CHA:-2},ecl:0,bonusPP:2,
    notes:'Naturally Psionic (2 PP). Resistance (1PP: +4 saves). Resilience (2HP/PP). Repletion.'},
  Elf:{adj:{DEX:2,CON:-2},ecl:0,immune:['sleep'],
    traits:[{type:'racial',target:'will',value:2,condition:'vs enchantments',label:'Elven clarity'},
            {type:'racial',target:'skill:Listen',value:2,label:'Elven senses'},
            {type:'racial',target:'skill:Search',value:2,label:'Elven senses'},
            {type:'racial',target:'skill:Spot',value:2,label:'Elven senses'}],
    notes:'Low-Light Vision. Immune sleep. +2 vs enchantments. +2 Listen/Search/Spot. Weapon profs.'},
  Gnome:{adj:{CON:2,STR:-2},ecl:0,size:'S',
    traits:[{type:'racial',target:'fort',value:2,condition:'vs illusions',label:'Gnomish skepticism'},
            {type:'racial',target:'ref',value:2,condition:'vs illusions',label:'Gnomish skepticism'},
            {type:'racial',target:'will',value:2,condition:'vs illusions',label:'Gnomish skepticism'}],
    notes:'Small. 20′ speed. Low-Light Vision. +2 saves vs illusions. +1 atk vs kobolds/goblinoids.'},
  Halfling:{adj:{DEX:2,STR:-2},ecl:0,size:'S',
    traits:[{type:'racial',target:'fort',value:1,label:'Halfling luck'},
            {type:'racial',target:'ref',value:1,label:'Halfling luck'},
            {type:'racial',target:'will',value:1,label:'Halfling luck'},
            {type:'racial',target:'skill:Climb',value:2,label:'Halfling agility'},
            {type:'racial',target:'skill:Jump',value:2,label:'Halfling agility'},
            {type:'racial',target:'skill:Move Silently',value:2,label:'Halfling agility'},
            {type:'racial',target:'skill:Listen',value:2,label:'Halfling ears'}],
    notes:'Small. +1 all saves. +2 Climb/Jump/Move Silently/Listen. +1 atk thrown weapons.'},
  // === Foe Folio Tier 1 — races with explicit "AS CHARACTERS" sections ===
  // ECL is the racial Level Adjustment + any racial Hit Dice (Foe Folio rule: ECL = HD + LA + class lvls).
  // Note shows the key racial features. NAC = natural armor class bonus, SR = spell resistance, DR = damage reduction.
  Aasimar:{adj:{WIS:2,CHA:2},ecl:1,resist:{acid:5,cold:5,electricity:5},
    traits:[{type:'racial',target:'skill:Spot',value:2,label:'Celestial senses'},{type:'racial',target:'skill:Listen',value:2,label:'Celestial senses'}],
    notes:'Outsider blood. 60′ Darkvision. +2 Spot/Listen. Daylight 1/day. Resist acid/cold/electricity 5.'},
  Azer:{adj:{STR:2,DEX:2,CON:2,INT:2,WIS:2,CHA:-2},ecl:3,natAC:6,sr:{base:13,perLevel:true},immune:['fire'],
    notes:'2 HD outsider. 60′ Darkvision. +6 NAC. Heat. Immune fire. SR 13+lvl. Vulnerable to cold.'},
  Blue:{adj:{STR:-2,INT:2,CHA:-2},ecl:1,size:'S',bonusPP:1,
    traits:[{type:'racial',target:'skill:Move Silently',value:4,label:'Goblinoid stealth'},{type:'racial',target:'skill:Ride',value:4,label:'Goblinoid riding'}],
    notes:'Small psionic goblinoid. 60′ Darkvision. Naturally Psionic +1 PP. +4 Move Silently/Ride. Favored: Psion.'},
  Bugbear:{adj:{STR:4,DEX:2,CON:2,CHA:-2},ecl:3,natAC:3,
    traits:[{type:'racial',target:'skill:Move Silently',value:4,label:'Goblinoid stealth'}],
    notes:'3 HD humanoid (goblinoid). Powerful Build. 60′ Darkvision. +3 NAC. +4 Move Silently. Favored: Rogue.'},
  Centaur:{adj:{STR:8,DEX:4,CON:4,INT:-2,WIS:2},ecl:4,natAC:3,size:'L',speed:50,
    notes:'4 HD monstrous humanoid. Large. 50′ speed. 60′ Darkvision. +3 NAC. Favored: Ranger.'},
  Doppelganger:{adj:{STR:2,DEX:2,CON:2,INT:2,WIS:4,CHA:2},ecl:4,natAC:4,immune:['sleep','charm'],
    traits:[{type:'racial',target:'skill:Bluff',value:4,label:'Change shape'},{type:'racial',target:'skill:Disguise',value:4,label:'Change shape'}],
    notes:'4 HD monstrous humanoid. 60′ Darkvision. +4 NAC. Change shape. +4 Bluff/Disguise. Detect thoughts. Immune sleep/charm.'},
  Drakkin:{adj:{STR:4,DEX:2,CON:2,INT:2,WIS:-2,CHA:4},ecl:3,natAC:5,size:'S',modes:[{type:'Fly',speed:60,note:'average (Wings)'}],
    notes:'Half-dragon kobold. Small Powerful Build. 60′ Darkvision. Wings (60′ avg fly). +5 NAC. Bite/2 claws. Breath weapon.'},
  Gargoyle:{adj:{STR:4,DEX:4,CON:8,INT:-4,CHA:-4},ecl:5,natAC:5,speed:40,dr:{value:10,bypass:'magic'},modes:[{type:'Fly',speed:60,note:'average'}],
    notes:'4 HD monstrous humanoid. 40′ speed + 60′ fly. 60′ Darkvision. +5 NAC. DR 10/magic. Freeze. Favored: Fighter.'},
  Gnoll:{adj:{STR:4,CON:2,INT:-2,CHA:-2},ecl:2,natAC:1,notes:'2 HD humanoid. 60′ Darkvision. +1 NAC. Favored: Ranger.'},
  Goblin:{adj:{STR:-2,DEX:2,CHA:-2},ecl:0,size:'S',
    traits:[{type:'racial',target:'skill:Move Silently',value:4,label:'Goblinoid stealth'},{type:'racial',target:'skill:Ride',value:4,label:'Goblinoid riding'}],
    notes:'Small humanoid (goblinoid). 60′ Darkvision. +4 Move Silently/Ride. Favored: Rogue.'},
  Grimlock:{adj:{STR:4,DEX:2,CON:2,WIS:-2,CHA:-4},ecl:2,natAC:4,immune:['gaze attacks','visual illusions'],
    traits:[{type:'racial',target:'skill:Hide',value:10,condition:'in rocky or underground settings',label:'Grimlock camouflage'}],
    notes:'2 HD monstrous humanoid. 60′ Blindsight. Immune gaze/visual illusions. +4 NAC. +10 Hide (rocky/underground). Battleaxe prof.'},
  'Half-Giant':{adj:{STR:2,DEX:-2,CON:2},ecl:1,bonusPP:2,
    traits:[{type:'racial',target:'fort',value:2,condition:'vs fire effects',label:'Half-Giant heritage'},
            {type:'racial',target:'ref',value:2,condition:'vs fire effects',label:'Half-Giant heritage'},
            {type:'racial',target:'will',value:2,condition:'vs fire effects',label:'Half-Giant heritage'}],
    notes:'Medium with Powerful Build. Low-light vision. Naturally Psionic +2 PP. +2 saves vs fire. Favored: Warmind.'},
  'Half-Orc':{adj:{STR:2,INT:-2,CHA:-2},ecl:0,notes:'60′ Darkvision. Counts as orc for race effects. Favored: Berserker.'},
  'Hill Giant':{adj:{STR:14,DEX:-2,CON:8,INT:-4,CHA:-4},ecl:10,natAC:9,size:'L',speed:40,
    notes:'12 HD giant. Large (10′/10′). 40′ speed. Low-light vision. +9 NAC. Rock throwing/catching. Favored: Berserker.'},
  Hobgoblin:{adj:{DEX:2,CON:2},ecl:1,
    traits:[{type:'racial',target:'skill:Move Silently',value:4,label:'Goblinoid stealth'}],
    notes:'60′ Darkvision. +4 Move Silently. Favored: Fighter.'},
  'Hound Archon':{adj:{STR:4,CON:2,WIS:2,CHA:2},ecl:8,natAC:9,speed:40,sr:{base:16,perLevel:true},dr:{value:10,bypass:'evil'},
    notes:'6 HD outsider. 40′ speed. 60′ Darkvision/Low-light. +9 NAC. Bite (1d8) + slam. Aura of menace. DR 10/evil. SR 16+lvl. Scent.'},
  Janni:{adj:{STR:6,DEX:4,CON:2,INT:4,WIS:4,CHA:2},ecl:8,natAC:1,resist:{fire:10},modes:[{type:'Fly',speed:20,note:'perfect'}],
    notes:'6 HD outsider. 30′ speed + 20′ fly (perfect). 60′ Darkvision. +1 NAC. Plane Shift. Resist fire 10. Telepathy 100′.'},
  Kinori:{adj:{STR:2,DEX:2,CON:2},ecl:2,natAC:3,speed:20,resist:{cold:20},modes:[{type:'Swim',speed:30,note:'natural swimmer'}],
    notes:'2 HD humanoid. 20′ land/30′ swim. +3 NAC. 2 claws (1d4) + bite (1d4). Cold resist 20. Easy breathing. Favored: Expert.'},
  Kobold:{adj:{STR:-4,DEX:2,WIS:-2},ecl:0,natAC:1,size:'S',
    traits:[{type:'racial',target:'skill:Search',value:2,label:'Kobold tunnel sense'}],
    notes:'Small reptilian. 60′ Darkvision. +1 NAC. Bite (1d3). Light sensitivity. +2 Craft (trapmaking)/Profession (miner)/Search.'},
  Lizardfolk:{adj:{STR:2,CON:2,INT:-2},ecl:1,natAC:5,
    traits:[{type:'racial',target:'skill:Balance',value:4,label:'Lizardfolk agility'},
            {type:'racial',target:'skill:Jump',value:4,label:'Lizardfolk agility'},
            {type:'racial',target:'skill:Swim',value:4,label:'Lizardfolk agility'}],
    notes:'2 HD humanoid. 60′ swim hold breath. +5 NAC. 2 claws (1d4) + bite (1d4). +4 Balance/Jump/Swim.'},
  Maenad:{adj:{WIS:-2,CHA:2},ecl:0,bonusPP:2,notes:'Naturally Psionic +2 PP. Outburst (psionic). Favored: Wilder.'},
  Merfolk:{adj:{STR:2,DEX:2,CON:4,WIS:-2},ecl:1,speed:5,modes:[{type:'Swim',speed:50,note:'aquatic'}],grantsFeats:['Alertness'],
    notes:'Aquatic. 5′ land/50′ swim. Low-light vision. Amphibious. Alertness as bonus feat. Trident proficiency. Favored: Bard.'},
  Minotaur:{adj:{STR:8,CON:4,INT:-4,CHA:-2},ecl:7,natAC:5,size:'L',
    notes:'6 HD monstrous humanoid. Large (10′/10′). 60′ Darkvision. +5 NAC. Gore (1d8). Powerful charge. Natural cunning. Favored: Berserker.'},
  Ogre:{adj:{STR:10,DEX:-2,CON:4,INT:-4,CHA:-4},ecl:4,natAC:5,size:'L',speed:40,
    notes:'4 HD giant. Large (10′/10′). 40′ speed. 60′ Darkvision. +5 NAC. Martial weapon prof. Favored: Berserker.'},
  'Ogre Mage':{adj:{STR:10,CON:6,INT:4,WIS:4,CHA:6},ecl:12,natAC:5,size:'L',speed:40,sr:{base:19},modes:[{type:'Fly',speed:40,note:'good'}],
    notes:'5 HD giant. Large (10′/10′). 40′ speed + 40′ fly (good). 60′ Darkvision. +5 NAC. Spell-like abilities. Regen 5. SR 19. Favored: Sorcerer.'},
  Orc:{adj:{STR:4,INT:-2,WIS:-2,CHA:-2},ecl:0,notes:'60′ Darkvision. Light sensitivity (dazzled in sunlight). Favored: Berserker.'},
  Pixie:{adj:{STR:-4,DEX:8,INT:6,WIS:4,CHA:6},ecl:4,natAC:1,size:'S',speed:20,dr:{value:10,bypass:'cold iron'},modes:[{type:'Fly',speed:60,note:'good'}],
    notes:'1 HD fey (replaced by 1st class lvl). Small. 20′ speed + 60′ fly (good). Low-light. +1 NAC. Greater invisibility. DR 10/cold iron.'},
  Rakshasa:{adj:{STR:2,DEX:4,CON:6,INT:2,WIS:2,CHA:6},ecl:9,natAC:9,dr:{value:15,bypass:'good & piercing'},
    notes:'7 HD outsider. 60′ Darkvision. +9 NAC. Bite + 2 claws. Sorcerer 7 spells. Change shape. Detect thoughts. DR 15/good+pierce.'},
  Satyr:{adj:{DEX:2,CON:2,INT:2,WIS:2,CHA:2},ecl:7,natAC:4,dr:{value:5,bypass:'cold iron'},
    traits:[{type:'racial',target:'skill:Hide',value:4,label:'Fey grace'},
            {type:'racial',target:'skill:Listen',value:4,label:'Fey senses'},
            {type:'racial',target:'skill:Move Silently',value:4,label:'Fey grace'},
            {type:'racial',target:'skill:Spot',value:4,label:'Fey senses'}],
    notes:'5 HD fey. Low-light vision. +4 NAC. Head butt (1d6). Pipes. DR 5/cold iron. +4 Hide/Listen/Move Silently/Perform/Spot. Favored: Bard.'},
  'Stone Giant':{adj:{STR:16,DEX:4,CON:8,WIS:2},ecl:12,natAC:11,size:'L',speed:40,
    traits:[{type:'racial',target:'skill:Hide',value:8,condition:'in rocky terrain',label:'Stone camouflage'}],
    notes:'14 HD giant. Large (10′/10′). 40′ speed. 60′ Darkvision/Low-light. +11 NAC. Rock throwing/catching. +8 Hide (rocky). Favored: Berserker.'},
  Tiefling:{adj:{DEX:2,INT:2,CHA:-2},ecl:1,resist:{cold:5,electricity:5,fire:5},
    traits:[{type:'racial',target:'skill:Bluff',value:2,label:'Fiendish guile'},{type:'racial',target:'skill:Hide',value:2,label:'Fiendish guile'}],
    notes:'Outsider blood. 60′ Darkvision. +2 Bluff/Hide. Darkness 1/day. Resist cold/electricity/fire 5.'},
  Troglodyte:{adj:{DEX:-2,CON:4,INT:-2},ecl:2,natAC:6,
    traits:[{type:'racial',target:'skill:Hide',value:4,label:'Troglodyte camouflage'},
            {type:'racial',target:'skill:Hide',value:4,condition:'in rocky/underground settings (further +4)',label:'Troglodyte camouflage'}],
    notes:'2 HD humanoid (reptilian). 90′ Darkvision. +6 NAC. 2 claws (1d4) + bite. Stench. +4 Hide (+8 rocky). Multiattack bonus.'},
  Troll:{adj:{STR:12,DEX:4,CON:12,INT:-4,WIS:-2,CHA:-4},ecl:6,natAC:5,size:'L',
    notes:'6 HD giant. Large (10′/10′). 60′ Darkvision/Low-light. +5 NAC. Claw + bite (1d6 ea). Rend. Regen 5. Scent. Favored: Fighter.'},
  Unbodied:{adj:{DEX:2,CON:2,INT:4,WIS:4,CHA:4},ecl:5,modes:[{type:'Fly',speed:30,note:'good — incorporeal'}],
    notes:'Incorporeal. No Str. Fly 30′ (good). 60′ Darkvision. CHA-mod deflection. Telekinetic touch (1d6). Assume likeness.'},
  'Werewolf (Hybrid)':{adj:{STR:2,DEX:4,CON:4,WIS:2},ecl:3,dr:{value:10,bypass:'silver',conditional:'in animal or hybrid form'},
    notes:'Lycanthrope template. Low-light + scent in any form. Hybrid form animal-modified phys stats. DR 10/silver in animal/hybrid.'},
  Xeph:{adj:{STR:-2,DEX:2,WIS:2},ecl:0,bonusPP:1,
    traits:[{type:'racial',target:'fort',value:1,condition:'vs powers, spells & spell-like abilities',label:'Xeph resilience'},
            {type:'racial',target:'ref',value:1,condition:'vs powers, spells & spell-like abilities',label:'Xeph resilience'},
            {type:'racial',target:'will',value:1,condition:'vs powers, spells & spell-like abilities',label:'Xeph resilience'}],
    notes:'60′ Darkvision. Naturally Psionic +1 PP. +1 saves vs powers/spells. Burst (psionic speed boost). Favored: Warmind.'},
  // === Catch-alls ===
  'Mutant/Hybrid':{adj:{},ecl:0,notes:'LEGACY CATCH-ALL (v8.67.0, Adam’s ruling): MUTANT is a SUBTYPE, not a race — pick your TRUE base race and build the mutation on the Mutations tab (MP, tier, Mutant level, and the Unnatural Prowess/Resilience bakes all wire automatically; HH p.29). HYBRID is its own race entry with the two-parent picker. This entry remains for legacy characters and Tier-2 Foe Folio creatures (60+ playable monsters lacking AS CHARACTERS sections) derived from base stats per GM.'},
  // v8.68.0 (Adam's simple model, HH pp.29-30 "Half-[Race]"): the two-parent
  // half-blood. ALL racial abilities of BOTH parents; RLM = A + B + 1
  // (Half-Elf: 0+0+1 = +1); size & movement from ONE chosen parent. The
  // GM-tailored path (drop abilities to shave the RLM) enters its adjusted
  // RLM manually. Full per-ability itemization awaits the racial-ability
  // census (prose → structured) — flagged, not forgotten.
  'Hybrid':{adj:{},ecl:0,notes:'Half-blood of two HUMANOID parent races (GM approval — HH pp.29-30; Adam’s ruling 2026-10-02: only Humanoids interbreed — Monstrous Humanoids, Giants, Outsiders, Fey and Aberrations cannot). Gains ALL racial abilities of BOTH parents; Racial Level Modifier = parent A + parent B + 1 (a Half-Elf: 0+0+1 = +1). Size and movement follow ONE chosen parent. GM-tailored builds may drop specific abilities and enter the GM-adjusted RLM manually.'},
  // v9.0.0 (Adam’s design session, 2026-10-05 — THE EASTER EGG; formal
  // rules arrive in the UCS): HALF-AGAIN — not a race but a Hybrid Race-B
  // option, the mirror of the Halfling door: a half-again-sized specimen of
  // Parent A. Contributes +0 to the RLM; the net +1 arrives through the
  // Hybrid rule itself (A + 0 + 1). "He's a Duergar, and Half-Again!"
  'Half-Again':{adj:{STR:2,CON:2,DEX:-2},ecl:0,halfAgain:true,notes:'A half-again-sized specimen of the other parent — not an ancestry, a stature (Hybrid Parent B only; the +1 RLM arrives through the Hybrid rule: Parent A + 0 + 1). +2 Str, +2 Con, −2 Dex. POWERFUL BUILD: counts as one size category larger whenever advantageous — opposed size checks (Grapple, bull rush, trip), wielding larger weapons without penalty, and CARRYING CAPACITY ×2 (a workhorse). Actual size, speed, and all other racial abilities follow Parent A: a Half-Again Halfling stands Medium among their own and passes for a stocky human.'},
  Other:{adj:{},ecl:0,notes:'Custom race — see GM for racial details.'},
};
// v8.8.0 (Adam's rulings, 2026-09-02): attribute-granting Apex Super-Talents
// BAKE into the score (permanent, GM-reversible — the Extraordinary
// [Attribute] pattern, per-record attrApplied ledger). Titanic Strength is
// the flat one; these are SUPERNATURAL (Su) effects, so they answer to
// nullification below.
const TALENT_ATTR_BAKES = { 'Titanic Strength': { attr: 'STR', idx: 0, value: 10, su: true } };

const RACE_BASE_SPEED = { 'Dwarf': 20, 'Gnome': 20, 'Halfling': 20 };
const SIZE_LADDER = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];
// Natural-weapon die progression for sizes past the catalogued L die
// (standard d20 step-up ladder).
const DIE_STEP_UP = { '1d2': '1d3', '1d3': '1d4', '1d4': '1d6', '1d6': '1d8', '1d8': '2d6', '2d6': '3d6', '3d6': '4d6', '4d6': '6d6', '6d6': '8d6' };


// ========== RACE INFO ==========
// v8.68.0: the Hybrid form helpers — populate the parent pickers once,
// recompute the RLM line, and re-apply the summed adjustments on any change.
// v8.68.1 (Adam's correction): only HUMANOID races interbreed — Monstrous
// Humanoids are OUT (the Drow/Dromite battery example exposed the slip).
// Explicit whitelist by 3.5/XPH creature type, GM-amendable. Judgment calls
// documented: Merfolk IS Humanoid (Aquatic) per the MM — included; Bugbear/
// Hobgoblin/Goblin/Blue are Humanoid (Goblinoid); Kobold/Lizardfolk/
// Troglodyte Humanoid (Reptilian); Drakkin & Kinori are E&E humanoid
// stocks. EXCLUDED by type: Dromite/Centaur/Gargoyle/Doppelganger/Grimlock/
// Minotaur (Monstrous Humanoid), Half-Giant/Ogre/Trolls/the Giants (Giant),
// Aasimar/Tiefling/Azer/Janni/Rakshasa/Hound Archon (Outsider), Pixie/Satyr
// (Fey), Elan (Aberration), Unbodied, the Werewolf template.
const HYBRID_HUMANOID_RACES = ['Blue', 'Bugbear', 'Drakkin', 'Drow', 'Duergar', 'Dwarf', 'Elf', 'Gnoll', 'Gnome', 'Goblin', 'Half-Orc', 'Halfling', 'Hobgoblin', 'Human', 'Kinori', 'Kobold', 'Lizardfolk', 'Maenad', 'Merfolk', 'Orc', 'Troglodyte', 'Xeph'];
const ATTR_FULL = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
const ATTR_KEY_IDX = { STR: 0, DEX: 1, CON: 2, INT: 3, WIS: 4, CHA: 5 };

// Racial weapon proficiencies (HH races chapter) — specific weapons only.
const RACE_WEAPON_PROFICIENCIES = {
  'Drow': ['hand crossbow', 'rapier', 'short sword'],
  'Elf':  ['longsword', 'rapier', 'longbow', 'composite longbow', 'shortbow', 'composite shortbow'],
};
