// =============================================================================
// js/data/character.js
// CHARACTER — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Action Point and Fate Point options,
//   heroic levels, HP modes, the XP table, occupations and the save-format
//   version.
//
// KEY NAMES (so you can search for them)
//   tables and state: AP_OPTIONS, HAP_OPTIONS, FP_OPTIONS_UNIVERSAL,
//   FP_OPTIONS_BY_HERO_CLASS, HEROIC_LEVEL_NAMES, HEROIC_LEVEL_AP_PER_ROUND,
//   RESOURCE_STATE_DISPLAY, HP_MODES, XP_TBL, OCCUPATIONS_DB,
//   CURRENT_SCHEMA_VER
//
// WHERE IT CAME FROM
//   Gathered from js/app/47-save-character.js, js/rules/20-scenario-titles-
//   and-heroic-resources.js, js/rules/23-hit-points-xp-skills.js,
//   js/rules/40-occupations-and-weapon-list.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// AP options — universal, available at Heroic 1+.
const AP_OPTIONS = [
  {
    name: 'Alter a d20 roll',
    desc: 'Spend 1 AP to add a d6 bonus to any attack, skill check, ability check, or saving throw. Declare AFTER the roll but BEFORE the GM reveals the result. Cannot be used when taking 10 or taking 20.'
  },
  {
    name: 'Activate a class feature',
    desc: 'Spend 1 AP to use a class talent or feature that specifies "1 AP" as its activation cost. No d6 is rolled.'
  }
];
// HAP options — Heroic 2+, Hero-class only (HH p.55).
const HAP_OPTIONS = [
  {
    name: 'Heroic Effort — "Focus!"',
    desc: 'Spend 1 AP for the FULL +6 bonus (instead of d6) when taking a full-round action on a standard or move action that uses one of your Heroic attributes.'
  },
  {
    name: 'Heroic Dodge — "Jump for your life!"',
    desc: 'Spend 1 AP as an immediate action to get a Dodge attempt against an attack roll that would otherwise reduce you to 0 hit points or less.'
  },
  {
    name: 'Heroic Resurgence — "Just catching my breath!"',
    desc: 'Spend 1 AP as a full-round action to recover 25% of your hit points (rounded up), up to a maximum of 50% of your total HP.'
  },
  {
    name: 'Heroic Destiny — "Beat the odds!"',
    desc: 'Spend 1 AP BEFORE making a d20 roll to roll 2d20 instead, taking the better result.'
  }
];
// FP options — Heroic 5+, Hero-class only. The universal Twist of Fate is
// always available; class-specific options are filtered by the character's
// Hero class membership and require the listed Talent (player self-verifies).
const FP_OPTIONS_UNIVERSAL = [
  {
    name: 'Twist of Fate (universal)',
    desc: 'Permanently spend 1 AP as a Fate Point to FORCE A RE-ROLL of any d20 result that directly affects your character. Available to all Hero characters.'
  }
];
const FP_OPTIONS_BY_HERO_CLASS = {
  'Strong Hero': {
    name: 'Maximum Effort (Strong Hero)',
    talent: 'Extreme Effort',
    desc: 'Permanently spend 1 AP as a move-equivalent action to TAKE 20 on a Str-based check, including a melee attack roll. Requires the Extreme Effort Talent.'
  },
  'Fast Hero': {
    name: 'Nick of Time (Fast Hero)',
    talent: 'Defensive Roll',
    desc: 'Permanently spend 1 AP as an immediate action to AUTOMATICALLY SUCCEED on a Defensive Roll attempt. Requires the Defensive Roll Talent.'
  },
  'Tough Hero': {
    name: 'No Time to Bleed (Tough Hero)',
    talent: 'Second Wind',
    desc: 'Permanently spend 1 AP as an immediate action to USE SECOND WIND. Requires the Second Wind Talent.'
  },
  'Smart Hero': {
    name: 'Eureka! (Smart Hero)',
    talent: 'Linguist',
    desc: 'Permanently spend 1 AP as a full-round action to TAKE 20 on an Int-based check. Requires the Linguist Talent.'
  },
  'Dedicated Hero': {
    name: 'The Right Touch (Dedicated Hero)',
    talent: 'Healing Knack',
    desc: 'Permanently spend 1 AP as a standard action to HEAL ANOTHER CHARACTER for 25% of their total HP, up to a maximum of 50%. Requires the Healing Knack Talent.'
  },
  'Charismatic Hero': {
    name: 'Good and Lucky (Charismatic Hero)',
    talent: 'Allegiance to Good',
    desc: 'Permanently spend 1 AP as an immediate action in response to a failed saving throw to instead TAKE 20 on the saving throw (automatic success). Requires Allegiance to Good.'
  }
};

// v8.3.19: Heroic Scale capability resolver.
//
// The Hero's Handbook (p.54-56) and the GM Guide describe a tiered AP / HAP /
// FP system gated by the scenario's Heroic Scale.
//
//   Heroic 0: No AP at all. Feats/abilities requiring AP become 1/day; Talents
//             become General feats. (Defer the talent re-skin to a future release;
//             for now we just zero out AP.)
//   Heroic 1: Basic Agency. AP usable, 1/round. d6 d20 modifier or class feature
//             activation. Non-Hero characters get AP from class apB rule.
//   Heroic 2: Basic Heroic Agency. AP 1/round + HAP options (Hero-class only).
//   Heroic 3: Heroic Agency. AP 2/round + HAP.
//   Heroic 4: High Heroic Agency. AP unlimited/round + HAP.
//   Heroic 5: Fated Agency. AP 1/round + FP (universal Twist of Fate).
//             Per HH p.55, class-specific FP options also available at H5+
//             when the prerequisite Talent is held.
//   Heroic 6: Fated Heroism. AP 1/round + HAP + FP.
//   Heroic 7: Fated High Heroism. AP 2/round + HAP + FP (2 FP/round).
//   Heroic 8: Destined Heroism. 1+ Hero class mandatory. AP 2/round + HAP + FP
//             (2 FP/round). Per GM Guide reinforces class-specific FP availability.
//   Heroic 9: Destined High Heroism. As 8 but unlimited AP and FP/round.
//
// Only characters with at least one Hero-class level have access to HAP and FP
// (HH p.55, "Only characters with one or more levels in a Hero class can spend
// their Action Points as Heroic Action Points" + the parallel rule for FP).
const HEROIC_LEVEL_NAMES = {
  0:'Luck of the Die', 1:'Basic Agency', 2:'Basic Heroic Agency',
  3:'Heroic Agency', 4:'High Heroic Agency', 5:'Fated Agency',
  6:'Fated Heroism', 7:'Fated High Heroism', 8:'Destined Heroism',
  9:'Destined High Heroism'
};
// Per-round AP limit as a display-only string. "Unlimited" at H4 and H9.
const HEROIC_LEVEL_AP_PER_ROUND = {
  0:'No AP', 1:'1 AP/round', 2:'1 AP/round', 3:'2 AP/round',
  4:'Unlimited AP/round', 5:'1 AP + 1 FP/round', 6:'1 AP + 1 FP/round',
  7:'2 AP + 2 FP/round', 8:'2 AP + 2 FP/round', 9:'Unlimited AP & FP/round'
};

// v8.4.0: state → display attributes mapping. Used by the renderers to
// translate a state string into the corresponding color, icon, and tooltip
// fragment for the four-state color-coded display (plan §7.5).
const RESOURCE_STATE_DISPLAY = {
  surplus: {color:'var(--state-surplus)', icon:'↑', label:'Surplus'},
  exact:   {color:'var(--state-exact)',   icon:'✓', label:'Exact'},
  warning: {color:'var(--state-warning)', icon:'⚠', label:'Over (GM exception)'},
  error:   {color:'var(--state-error)',   icon:'✗', label:'Over budget'},
};
// ========== HIT POINTS (v8.2.3) ==========
// HP generation has three modes per HH p.84-ish (and the (d_/+_) parenthetical
// in every class entry):
//   - 'random':  roll 1dHD per level (full die)
//   - 'hero':    roll 1d(HD/2) + (HD/2) per level — the "Hero's Hit Die" rule.
//                Average is half a point higher than random, variance is halved.
//                Heroes never roll a 1 on their hit die. House default.
//   - 'max':     take HD per level (no roll)
//
// The first level (the very first level of the first class taken) ALWAYS takes
// the max die value, across all three modes. This matches d20-lineage convention.
//
// Per-level rolls are stored on c.hpRolls so they don't re-randomize across
// renders. Each entry is the die-only value (Con mod added at compute time).
// hpRolls[0] = first-level max value.
const HP_MODES = ['hero', 'random', 'max'];
// v8.3.1: XP thresholds. The handbook table (HH p.~50) lists ECL 1-20 with
// thresholds 0, 1000, 3000, 6000, ..., 190000 — a factorial pattern where
// advancing FROM level L to L+1 costs L × 1000 XP. This pattern extends
// indefinitely for Epic levels (21+) in 3.5-lineage games:
//   L21 floor = 210,000 (band L20→L21 costs 20,000 XP)
//   L22 floor = 231,000 (band L21→L22 costs 21,000 XP)
//   L23 floor = 253,000 (band L22→L23 costs 22,000 XP)
//   ...
//
// DxD20 doesn't yet codify Epic rules but is back-compatible to 3.5, so we
// design forward: xpThreshold(L) returns the cumulative XP at which the
// character becomes level L, for any L ≥ 1.
//
// Formula: threshold(L) = 1000 × L × (L−1) / 2
//   = 1000 × triangular_number(L−1)
//
// XP_TBL is retained as a 20-entry array for any caller that indexes into
// it directly (backward-compat) but new code should call xpThreshold().
const XP_TBL=[0,1000,3000,6000,10000,15000,21000,28000,36000,45000,55000,66000,78000,91000,105000,120000,136000,153000,171000,190000];
const OCCUPATIONS_DB = [
  {n:'Academic',prereq_age:23,skill_count:3,skill_list:['Computer Use','Craft (Writing)','Decipher Code','Gather Information','Knowledge: Any','Research','Read/Write Language'],wealth:3,d:'Academics include librarians, archaeologists, scholars, professors, and teachers, and other education professionals.'},
  {n:'Adventurer',prereq_age:15,skill_count:2,skill_list:['Bluff','Climb','Demolition','Disable Device','Drive','Escape Artist','Intimidate','Jump','Knowledge (Arcane Lore, Dungeoneering, Streetwise, Tactics, Technology)','Move Silently','Pilot','Ride','Spot','Survival','Swim','Treat Injury','Use Rope'],bonus_feat_options:['Archaic Weapons Proficiency','Brawl','Personal Firearms Proficiency'],wealth:1,d:'Adventurers include professional daredevils, big-game hunters, relic hunters, explorers, extreme sports enthusiasts, field scientists, thrill-seekers, and others called to face danger for a variety of reasons.'},
  {n:'Apothecary',prereq_age:20,skill_count:3,skill_list:['Craft (Alchemy, Chemical, Mechanical, Pharmaceutical, Writing)','Disable Device','Knowledge (Arcane Lore, Earth and Life Sciences, History, Nature, Physical Sciences)','Repair','Research'],bonus_feat_options:['Arcane Skills','Educated'],wealth:3,d:'Apothecaries are people who study the science of mixing chemicals, elements, and naturally-occurring materials together for predictable results. They often go on to be research scientists, inventors, pharmacists, or alchemists.'},
  {n:'Astronaut Trainee',prereq_age:21,prereq_other:'Minimum Tech Scale 5 scenario',skill_count:2,skill_list:['Computer Use','Craft (Electronic, Mechanical, Pharmaceutical)','Knowledge (Earth and Life Sciences, Geography, Physical Sciences, Technology, The Planes)','Navigate','Pilot','Repair','Survival'],bonus_feat_options:['Aircraft Operation (spacecraft)','Zero-G Training'],wealth:1,d:'As scientists and pioneers, cosmonaut trainees have prepared their minds and bodies for the rigors of intergalactic and/or interdimensional travel. They are elite members of a sophisticated training program, waiting for the opportunity to explore the great unknown in order to shed light on the mysteries of the omniverse.'},
  {n:'Athlete',prereq_other:'Strength 13 or Dexterity 13 or Constitution 13',skill_count:3,skill_list:['Balance','Climb','Concentration','Drive','Jump','Knowledge (Earth / Life Sciences)','Ride','Swim','Tumble'],bonus_feat_options:['Archaic Weapon Proficiency','Brawl'],wealth:1,d:'Athletes include amateur athletes of Olympic quality and professional athletes of all types, including gymnasts, weight trainers, wrestlers, boxers, martial artists, swimmers, skaters, and those who engage in any type of competitive sport.'},
  {n:'Blue Collar',prereq_age:18,skill_count:3,skill_list:['Craft (Electronic, Mechanical, Structural)','Climb','Drive','Handle Animal','Intimidate','Repair','Ride','Use Rope'],wealth:2,d:'Blue collar occupations include factory work, food service jobs, construction, service industry jobs, taxi drivers, postal workers, and other jobs that are usually not considered to be desk jobs. In poorer conditions or under tyrannical regimes, such workers may be little more than indentured slaves.'},
  {n:'Celebrity',prereq_age:15,skill_count:2,skill_list:['Bluff','Craft (Visual Art, Writing)','Diplomacy','Disguise','Knowledge (Current Events, Popular Culture, Streetwise)','Perform (Act, Dance, Keyboards, Percussion, Sing, Stand-Up, Stringed, Wind)'],wealth:4,d:'A celebrity is anyone who, for whatever reason, has been thrust into the spotlight of the public eye. Everyone, it is said, eventually gains their 15 minutes of fame; the celebrity stretches those 15 minutes into a career. Actors, entertainers of all types, newscasters, radio and television personalities, and more fall under this starting occupation.'},
  {n:'Colonist',prereq_age:15,prereq_other:'Minimum Tech Scale 5 scenario',skill_count:2,skill_list:['Computer Use','Craft (Electronic, Mechanical, Structural)','Knowledge (Earth and Life Sciences)','Navigate','Repair','Survival','Use Rope'],bonus_feat_options:['Builder','Guide','Planetary Adaptation'],wealth:1,d:'Colonists are wayfaring pioneers who set the foundations of new societies on far-flung continents, planets, and moons. To survive in their new surroundings, they learn to live off the land and defend themselves against indigenous predatory lifeforms and hostile forces of nature.'},
  {n:'Creative',prereq_age:15,skill_count:3,skill_list:['Bluff','Computer Use','Craft (Visual Art, Writing)','Disguise','Forgery','Knowledge (Arcane Lore, Art, Business, Popular Culture, Technology)','Perform (Act, Dance, Keyboards, Percussion, Sing, Stand-Up, Stringed, Wind)','Spot'],wealth:2,d:'The creative starting occupation covers artists of all types who fan their creative spark into a career. Illustrators, copywriters, cartoonists, graphic artists, novelists, magazine columnists, actors, sculptors, game designers, musicians, screenwriters, photographers, and web designers all fall under this occupation.'},
  {n:'Criminal',prereq_age:15,skill_count:2,skill_list:['Appraise','Craft (Weaponsmithing)','Disable Device','Disguise','Forgery','Gamble','Hide','Knowledge (Nobility, Streetwise)','Move Silently','Sleight of Hand'],bonus_feat_options:['Brawl','Personal Firearms Proficiency'],wealth:1,d:'This illicit starting occupation reveals a background from the wrong side of the law. This occupation includes con artists, burglars, thieves, crime family soldiers, gang members, band robbers, and other types of career criminals.'},
  {n:'Drifter',prereq_age:15,prereq_other:'Minimum Tech Scale 0 scenario',skill_count:3,skill_list:['Appraise','Bluff','Decipher Code','Disable Device','Disguise','Forgery','Gamble','Gather Information','Hide','Knowledge (Streetwise)','Navigate','Sleight of Hand','Use Rope'],wealth:2,d:'Drifters are aimless wanderers and worldwise jacks-of-all-trades who move between cities, star systems, and/or planes, working odd jobs until boredom or fate lead them elsewhere. Along the way, they learn strange customs and pick up interesting and diverse skills.'},
  {n:'Dilettante',prereq_age:18,skill_count:1,skill_list:['Gamble','Intimidate','Knowledge (Current Affairs, Nobility, Popular Culture)','Ride','Speak Language'],wealth:6,d:'Dilettantes usually get their wealth from family holdings and trust funds. The typical dilettante has no job, few responsibilities, and at least one driving passion that occupies their day. That passion might be a charity or philanthropic foundation, and ideal or cause worth fighting for, or a lust for living a fun and carefree existence.'},
  {n:'Doctor',prereq_age:25,skill_count:3,skill_list:['Computer Use','Concentration','Craft (Pharmaceutical)','Knowledge (Behavioural Sciences, Earth and Life Sciences, Technology)','Search','Treat Injury'],wealth:4,d:'A doctor is a physician (general practitioner or specialist), a surgeon, or a psychiatrist, as opposed to someone who has simply completed their doctorate.'},
  {n:'Emergency Services',prereq_age:18,skill_count:3,skill_list:['Balance','Climb','Computer Use','Drive','Jump','Knowledge (Behavioural Sciences, Earth & Life Sciences, Geography, Technology)','Search','Treat Injury','Swim'],wealth:2,d:'Rescue workers, firefighters, paramedics, hazardous material handlers, and emergency medical technicians all fall under this category.'},
  {n:'Entrepreneur',prereq_age:18,skill_count:2,skill_list:['Appraise','Bluff','Diplomacy','Gamble','Knowledge (Business, Current Affairs, Nobility, Technology)'],wealth:4,d:'Entrepreneurs have an obsession about being their own boss. They believe in themselves, have an abundance of confidence, and the ability to acquire the funds necessary to bankroll their newest moneymaking venture. These small-to-large business owners have a knack for putting together business plans, gathering resources, and getting a new venture off the ground. They rarely want to stick around after the launch, however, as they prefer to put their energies into the next big thing.'},
  {n:'Gladiator',prereq_age:18,skill_count:2,skill_list:['Balance','Concentration','Craft (Weaponsmithing)','Intimidate','Knowledge (Streetwise, Tactics)','Ride','Survival','Tumble'],bonus_feat_options:['Archaic Weapon Proficiency','Brawl','Combat Martial Arts'],wealth:1,d:'Gladiators have been fighting all their lives, whether on the streets or in some sort of arena. They include disenchanted youths and poverty-stricken hoodlums looking to trade fists for cash, clones bred in secret labs to fight from birth, and low-ranking members of a society’s warrior caste.'},
  {n:'Hedge Wizard',prereq_other:'Intelligence 10',skill_count:3,skill_list:['Concentration','Craft (Alchemy, Chemical, Writing)','Decipher Code','Gather Information','Knowledge (Arcane Lore, Art, Earth & Life Sciences, History, Physical Sciences, The Planes)','Research','Spellcraft','Use Magic Device'],bonus_feat_options:['Arcane Heritage','Magical Affinity','Skill Focus (one of the 3 chosen Hedge Wizard skills)'],wealth:1,d:'A hedge wizard is someone who has spent a great deal of time studying the arcane arts without the benefit of having any formal training or education.'},
  {n:'Heir',prereq_age:18,prereq_other:'Educated (feat), GM’s permission',skill_count:2,skill_list:['Craft (Visual Art, Writing)','Knowledge (Art, Business, Civics, Current Events, History, Nobility)','Perform (Any)','Pilot','Ride','Sense Motive'],wealth:6,d:'Heirs are the elite sons of daughters of powerful magnates, influential nobles, and imperial monarchs. Unlike dilettantes, however, they are bound by their lineage to certain responsibilities, with the assumption that they might someday rise to learn their families into the future… assuming the stars are properly aligned and they do nothing to jeopardize their birthright.'},
  {n:'Investigative',prereq_age:23,skill_count:2,skill_list:['Computer Use','Craft (Visual Art, Writing)','Decipher Code','Forgery','Gather Information','Investigate','Knowledge (Behavioural Science, Civics, Earth & Life Sciences, Streetwise)','Research','Search','Sense Motive'],bonus_feat_options:['Brawl','Personal Firearms Proficiency'],wealth:2,d:'There are a number of jobs that fit within this occupation, including investigative reporters, photojournalists, private investigators, police detectives, criminologists, criminal profilers, espionage agents, and other who use their skills to gather evidence and analyze clues.'},
  {n:'Law Enforcement',prereq_age:20,skill_count:2,skill_list:['Diplomacy','Drive','Gather Information','Intimidate','Knowledge (Civics, Earth & Life Sciences, Nobility, Streetwise, Tactics)','Listen'],bonus_feat_options:['Combat Martial Arts','Improved Grapple','Personal Firearms Proficiency'],wealth:1,d:'Law enforcement personnel include uniformed police, state troopers, federal police, federal agents, special task force members, and military police.'},
  {n:'Military',prereq_age:18,skill_count:2,skill_list:['Climb','Craft (Trapmaking)','Demolitions','Drive','Hide','Knowledge (Dungeoneering, Geography, Tactics)','Move Silently','Navigate','Pilot','Survival','Swim'],bonus_feat_options:['Brawl','Combat Martial Arts','Light Armour Proficiency','Personal Firearms Proficiency'],wealth:1,d:'Military covers any of the branches of the armed forces, including army, navy, air force, and marines, as well as elite training units such as Seals, Rangers, and Special Forces.'},
  {n:'Novitiate',prereq_other:'Wisdom 10',skill_count:3,skill_list:['Concentration','Craft (Writing)','Decipher Code','Diplomacy','Knowledge (Arcane Lore, Art, Behavioural Sciences, History, Religion, Theology & Philosophy, The Planes)','Sense Motive'],bonus_feat_options:['Divine Heritage','Magical Affinity','Skill Focus (one of the 3 chosen Novitiate skills)'],wealth:2,d:'Novitiates draw quiet strength from their belief in a greater power. They do not necessarily have ties to a specific religion or denomination – their faith is enough. Some novitiates are lay clergy, counselors, motivational speakers, social workers, or any other position involved with helping people who have lost hope and faith.'},
  {n:'Outcast',prereq_age:15,prereq_other:'Tech Scale 0 scenario',skill_count:2,skill_list:['Disguise','Hide','Knowledge (Local, Streetwise)','Search','Survival','Treat Injury'],bonus_feat_options:['Toughness'],wealth:1,d:'Being an outcast is not so much a chosen profession as it is a forced way of life. Persecuted or exiled for being different, outcasts are lone pariahs or shunned members of a culture whose customs or characteristics society finds deviant or abhorrent. Outcasts lurk on the fringes of civilization.'},
  {n:'Psychic',prereq_age:15,skill_count:2,skill_list:['Bluff','Concentration','Diplomacy','Gather Information','Intimidate','Knowledge (Behavioural Sciences, Current Events, Popular Culture, Psionics, Streetwise)','Sense Motive'],bonus_feat_options:['Iron Will','Psionic Heritage','Wild Talent'],wealth:2,d:'Psychics can be people with innate, low-level psionic abilities or simply con-artists looking to make a buck off those gullible enough to believe their ruses. Get your GM’s approval before choosing this occupation.'},
  {n:'Religious',prereq_age:23,skill_count:3,skill_list:['Decipher Code','Knowledge (Arcane Lore, Art, Behavioural Sciences, History, Streetwise, Religion, Theology and Philosophy, The Planes)','Listen','Sense Motive'],wealth:2,d:'Ordained clergy of all persuasions, as well as theological scholars and experts on religious studies fall within the scope of this starting occupation.'},
  {n:'Rural',prereq_age:15,skill_count:2,skill_list:['Balance','Climb','Craft (Bowmaking, Trapmaking)','Drive','Handle Animal','Knowledge (Local, Nature)','Repair','Ride','Survival','Swim'],bonus_feat_options:['Brawl','Personal Firearms Proficiency'],wealth:1,d:'Farm workers, hunters, and others who make a living in rural communities fall under this category. Despite any misconceptions, they have access to a useful set of skills.'},
  {n:'Scavenger',prereq_age:15,prereq_other:'Tech Scale 0 scenario',skill_count:3,skill_list:['Appraise','Decipher Code','Disable Device','Knowledge (Technology)','Move Silently','Repair','Search','Spot','Survival'],wealth:2,d:'Scavengers turn society’s wreckage and discarded trash into useful tool and items for trade, and if they’re lucky, their endeavors might even yield one or two objects of special value. They effortlessly navigate and strip clean the most treacherous places, and their playgrounds are abandoned stations and outposts, forgotten locations, and recent battlefields.'},
  {n:'Squire',prereq_other:'Strength 13 or Dexterity 13',skill_count:3,skill_list:['Balance','Climb','Handle Animal','Jump','Ride','Tumble'],bonus_feat_options:['Archaic Weapons Proficiency','Armor Proficiency: Light'],wealth:1,d:'Squires serve as assistants to warriors in hopes of learning the skills they will need to be warriors themselves one day.'},
  {n:'Student',prereq_age:15,skill_count:3,skill_list:['Computer Use','Knowledge (Any)','Perform (Any)','Research'],wealth:1,d:'A student can be in high school, college, or graduate school. They could be in a military college or a private institution. When selecting this starting occupation, you should also pick a major field of study for the character.'},
  {n:'Technician',prereq_age:23,skill_count:3,skill_list:['Computer Use','Craft (Any)','Knowledge (Architecture, Business, Earth & Life Sciences, Physical Sciences, Technology)','Repair','Research'],wealth:3,d:'Spanning all tech levels and cultures beyond the stone age, tradesmen and engineers of all types fit within the scope of this starting occupation.'},
  {n:'Transporter',prereq_age:18,skill_count:2,skill_list:['Craft (Mechanical)','Drive','Knowledge (Current Events, Geography, Popular Culture, Streetwise)','Navigate','Pilot','Repair'],bonus_feat_options:['Spacer','Vehicle Expert'],wealth:1,d:'Skilled drivers and pilots, transporters move people, information, and precious cargo safely from one destination to another. They treat their vehicles as extensions of their bodies.'},
  {n:'White Collar',prereq_age:23,skill_count:3,skill_list:['Computer Use','Diplomacy','Knowledge (Art, Business, Civics, Earth & Life Sciences, History, Nobility, Physical Sciences, Technology)','Research'],wealth:3,d:'Office workers and desk jockeys, lawyers, accountants, insurance agents, bank personnel, financial advisors, tax preparers, clerks, sales personnel, real estate agents, and a variety of mid-level managers fall within the scope of this starting occupation.'},
];

// ===== v8.4.0: CHARACTER SCHEMA VERSIONING =====
//
// v8.4.0 introduces a structured 1st-level genesis flow with typed feat
// slots and an explicit Hero's Gift choice. To preserve the in-the-wild
// characters built under v8.3.x without retrofitting them, every new save
// from v8.4.0 onward stamps `c.schemaVer = 1`. The absence of this field
// marks a legacy (pre-v8.4.0) character.
//
// The legacy/v8.4.0 split affects exactly three subsystems:
//   1. getFeatBudget — legacy auto-adds +1 Hero's Gift to feats for any
//      Hero-classed character; v8.4.0 only adds it when c.heroesGiftChoice
//      === 'feat'.
//   2. getTalentBudget — legacy adds 0 for Hero's Gift; v8.4.0 adds +1
//      when c.heroesGiftChoice === 'talent'.
//   3. The Sheet's Hero's Gift panel and the Edit retcon dropdown — both
//      hide entirely for legacy characters.
//
// Everything else (feat slots, talent slots, prereqs, AP, the Six Scales
// gates, etc.) is identical across both schema versions.
const CURRENT_SCHEMA_VER = 1;
