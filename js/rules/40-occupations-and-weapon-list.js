// =============================================================================
// js/rules/40-occupations-and-weapon-list.js
// OCCUPATIONS AND WEAPON LIST
// =============================================================================
//
// WHAT'S IN HERE
//   OCCUPATIONS_DB (starting occupations: skills, bonus feats, wealth) and
//   WEAPONS, the short weapon list used by parameterized feats such as Weapon
//   Focus.
//
// KEY NAMES (so you can search for them)
//   tables/objects: OCCUPATIONS_DB, WEAPONS
//
// LOAD ORDER
//   File 40 of 68. index.html loads it after js/data/39-mutation-rules.js and
//   before js/app/41-state-storage-navigation.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 37017-37192 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 37017-37192; unchanged below this line ----
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

// WEAPONS — minimal table for v8.1 (name + category + tech level + kind).
// Used by the feat picker for parameterized feats (Weapon Focus, Exotic Weapon Proficiency, etc.).
// Full equipment data (damage, range, weight, Wealth cost) deferred to v9 Equipment chapter.
// Each entry: {n, cat:"Simple"|"Martial"|"Exotic", tl:0..8, kind:"light"|"one-handed"|"two-handed"|"ranged"|"unarmed"|"special"}
const WEAPONS = [
  {n:'Club',cat:'Simple',tl:0,kind:'one-handed'},
  {n:'Dagger, Flint',cat:'Simple',tl:0,kind:'light'},
  {n:'Dart',cat:'Simple',tl:0,kind:'ranged'},
  {n:'Handaxe, Flint',cat:'Simple',tl:0,kind:'one-handed'},
  {n:'Improvised Weapon',cat:'Simple',tl:0,kind:'special'},
  {n:'Javelin',cat:'Simple',tl:0,kind:'ranged'},
  {n:'Longspear',cat:'Simple',tl:0,kind:'two-handed'},
  {n:'Quarterstaff',cat:'Simple',tl:0,kind:'two-handed'},
  {n:'Shortspear',cat:'Simple',tl:0,kind:'one-handed'},
  {n:'Sling (w/ 10 stones)',cat:'Simple',tl:0,kind:'ranged'},
  {n:'Spear',cat:'Simple',tl:0,kind:'two-handed'},
  {n:'Unarmed strike',cat:'Simple',tl:0,kind:'unarmed'},
  {n:'Dagger',cat:'Simple',tl:1,kind:'light'},
  {n:'Dagger, punching',cat:'Simple',tl:1,kind:'light'},
  {n:'Gauntlet',cat:'Simple',tl:1,kind:'unarmed'},
  {n:'Gauntlet, spiked',cat:'Simple',tl:1,kind:'light'},
  {n:'Mace, heavy',cat:'Simple',tl:1,kind:'one-handed'},
  {n:'Mace, light',cat:'Simple',tl:1,kind:'light'},
  {n:'Morningstar',cat:'Simple',tl:1,kind:'one-handed'},
  {n:'Sickle',cat:'Simple',tl:1,kind:'light'},
  {n:'Sling (w/ 10 bullets)',cat:'Simple',tl:1,kind:'ranged'},
  {n:'Bolts, crossbow (10)',cat:'Simple',tl:2,kind:'ranged'},
  {n:'Crossbow, heavy',cat:'Simple',tl:2,kind:'ranged'},
  {n:'Crossbow, light',cat:'Simple',tl:2,kind:'ranged'},
  {n:'Automatic Pistol',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Automatic Rifle',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Derringer',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Dynamite',cat:'Simple',tl:4,kind:'one-handed'},
  {n:'Flamethrower',cat:'Simple',tl:4,kind:'one-handed'},
  {n:'Hand Grenade',cat:'Simple',tl:4,kind:'one-handed'},
  {n:'Hunting Rifle',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Revolver',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Shotgun',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Sniper Rifle',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Submachine Gun',cat:'Simple',tl:4,kind:'one-handed',firearm:true},
  {n:'Automatic Sniper Rifle',cat:'Simple',tl:5,kind:'one-handed',firearm:true},
  {n:'Machine Pistol',cat:'Simple',tl:5,kind:'one-handed',firearm:true},
  {n:'Pepper Spray',cat:'Simple',tl:5,kind:'one-handed'},
  {n:'Taser',cat:'Simple',tl:5,kind:'one-handed'},
  {n:'Axe, throwing',cat:'Martial',tl:1,kind:'light'},
  {n:'Battleaxe',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Flail',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Flail, heavy',cat:'Martial',tl:1,kind:'two-handed'},
  {n:'Greataxe',cat:'Martial',tl:1,kind:'two-handed'},
  {n:'Greatclub',cat:'Martial',tl:1,kind:'two-handed'},
  {n:'Greatsword',cat:'Martial',tl:1,kind:'two-handed'},
  {n:'Hammer, light',cat:'Martial',tl:1,kind:'light'},
  {n:'Handaxe',cat:'Martial',tl:1,kind:'light'},
  {n:'Longbow',cat:'Martial',tl:1,kind:'ranged'},
  {n:'Longbow, composite',cat:'Martial',tl:1,kind:'ranged'},
  {n:'Longsword',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Pick, heavy',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Pick, light',cat:'Martial',tl:1,kind:'light'},
  {n:'Sap',cat:'Martial',tl:1,kind:'light'},
  {n:'Scythe',cat:'Martial',tl:1,kind:'two-handed'},
  {n:'Shield, heavy',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Shield, light',cat:'Martial',tl:1,kind:'light'},
  {n:'Shortbow',cat:'Martial',tl:1,kind:'ranged'},
  {n:'Shortbow, composite',cat:'Martial',tl:1,kind:'ranged'},
  {n:'Spiked armor',cat:'Martial',tl:1,kind:'light'},
  {n:'Spiked shield, heavy',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Spiked shield, light',cat:'Martial',tl:1,kind:'light'},
  {n:'Rapier',cat:'Martial',tl:2,kind:'one-handed'},  // v8.15.3: matched to Adam's printed row (2026-09-03 HH: One-Handed section, DC 20; Weapon Finesse still names it eligible)
  {n:'Scimitar',cat:'Martial',tl:1,kind:'one-handed'},  // v8.15.2: ruled in with the rapier (PHB 3.5; Adam's book edit, TS 1) — unblocks the Sylvan Scimitar conversion
  {n:'Sword, short',cat:'Martial',tl:1,kind:'light'},
  {n:'Trident',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Warhammer',cat:'Martial',tl:1,kind:'one-handed'},
  {n:'Glaive',cat:'Martial',tl:2,kind:'ranged'},
  {n:'Guisarme',cat:'Martial',tl:2,kind:'ranged'},
  {n:'Halberd',cat:'Martial',tl:2,kind:'ranged'},
  {n:'Lance',cat:'Martial',tl:2,kind:'ranged'},
  {n:'Ranseur',cat:'Martial',tl:2,kind:'ranged'},
  {n:'Bayonet',cat:'Martial',tl:3,kind:'one-handed'},
  {n:'Bomb',cat:'Martial',tl:3,kind:'one-handed'},
  {n:'Flintlock Pistol',cat:'Martial',tl:3,kind:'one-handed',firearm:true},
  {n:'Musket',cat:'Martial',tl:3,kind:'one-handed',firearm:true},
  {n:'Pistol Whip',cat:'Martial',tl:3,kind:'one-handed'},
  {n:'Rifle Butt',cat:'Martial',tl:3,kind:'one-handed'},
  {n:'Smoke Bomb',cat:'Martial',tl:3,kind:'one-handed'},
  {n:'Concussion Grenade',cat:'Martial',tl:6,kind:'one-handed'},
  {n:'EMP Grenade',cat:'Martial',tl:6,kind:'one-handed'},
  {n:'Fireflush Grenade',cat:'Martial',tl:6,kind:'one-handed'},
  {n:'High Frequency Sword',cat:'Martial',tl:6,kind:'one-handed'},
  {n:'Laser Pistol',cat:'Martial',tl:6,kind:'one-handed',firearm:true},
  {n:'Laser Sniper Rifle',cat:'Martial',tl:6,kind:'one-handed',firearm:true},
  {n:'Laser Rifle',cat:'Martial',tl:6,kind:'ranged',firearm:true},
  {n:'Mini-Grenade Launcher',cat:'Martial',tl:6,kind:'one-handed',firearm:true},
  {n:'Mini-Rocket Launcher',cat:'Martial',tl:6,kind:'one-handed',firearm:true},
  {n:'Stun Baton',cat:'Martial',tl:6,kind:'one-handed'},
  {n:'Tangler Gun',cat:'Martial',tl:6,kind:'one-handed',firearm:true},
  {n:'Concussion Rifle',cat:'Martial',tl:7,kind:'one-handed',firearm:true},
  {n:'Concussion Rod',cat:'Martial',tl:7,kind:'one-handed'},
  {n:'Dissolver Grenade',cat:'Martial',tl:7,kind:'one-handed'},
  {n:'Gravitic Grenade',cat:'Martial',tl:7,kind:'one-handed'},
  {n:'Plasma Pistol',cat:'Martial',tl:7,kind:'one-handed',firearm:true},
  {n:'Plasma Rifle',cat:'Martial',tl:7,kind:'one-handed',firearm:true},
  {n:'Railgun',cat:'Martial',tl:7,kind:'one-handed',firearm:true},
  {n:'Stun Grenade',cat:'Martial',tl:7,kind:'one-handed'},
  {n:'Vibro-Blade',cat:'Martial',tl:7,kind:'one-handed'},
  // v8.5.0: TL8 Energy Age weapons recovered from the gear-bleed cleanup. The
  // HH Equipment chapter classes the rifles under Personal Firearms, the
  // grenades under Explosives (Simple), and Plasma Sword under Exotic Melee.
  {n:'Cryonic Rifle',cat:'Martial',tl:8,kind:'ranged',firearm:true},
  {n:'Disintegrator Rifle',cat:'Martial',tl:8,kind:'ranged',firearm:true},
  {n:'Sonic Rifle',cat:'Martial',tl:8,kind:'ranged',firearm:true},
  {n:'Cryonic Grenade',cat:'Simple',tl:8,kind:'one-handed'},
  {n:'Psionic Grenade',cat:'Simple',tl:8,kind:'one-handed'},
  {n:'Singularity Grenade',cat:'Simple',tl:8,kind:'one-handed'},
  {n:'Plasma Sword',cat:'Exotic',tl:8,kind:'one-handed'},
  {n:'Bolas',cat:'Exotic',tl:1,kind:'ranged'},
  {n:'Net',cat:'Exotic',tl:1,kind:'ranged'},
  {n:'Spiked Chain',cat:'Exotic',tl:1,kind:'two-handed'},
  {n:'Sword, bastard',cat:'Exotic',tl:1,kind:'one-handed'},
  {n:'Whip',cat:'Exotic',tl:1,kind:'one-handed'},
  {n:'Crossbow, hand',cat:'Exotic',tl:2,kind:'ranged'},
  {n:'Crossbow, repeating heavy',cat:'Exotic',tl:2,kind:'ranged'},
  {n:'Crossbow, repeating light',cat:'Exotic',tl:2,kind:'ranged'},
  {n:'Machinegun',cat:'Exotic',tl:4,kind:'one-handed',firearm:true},
  {n:'Grenade Launcher',cat:'Exotic',tl:5,kind:'one-handed',firearm:true},
  {n:'Rocket Launcher',cat:'Exotic',tl:5,kind:'one-handed',firearm:true},
];

// v8.60.0 (Adam's trade-off test drive, §179): POLEARM KIND CORRECTIONS.
// The weapons extraction mis-kinded the reach polearms as 'ranged' (their
// reach lines read as range increments) — documented since v8.6.1 as
// display-only, now LOAD-BEARING: a 'ranged' kind made these five roll Dex
// to hit, earn ZERO Str damage, and hide from Power Attack entirely.
// Runtime patch (both arrays) rather than JSON surgery — sentinel-safe.
{
  const POLEARM_KIND_FIX = ['Glaive', 'Guisarme', 'Halberd', 'Ranseur', 'Lance'];
  for (const nm of POLEARM_KIND_FIX) {
    const a = WEAPONS.find(w => w.n === nm); if (a && a.kind === 'ranged') a.kind = 'two-handed';
    const b = WEAPONS_CATALOG.find(w => w.name === nm); if (b && b.kind === 'ranged') b.kind = 'two-handed';
  }
}

