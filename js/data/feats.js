// =============================================================================
// js/data/feats.js
// FEATS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. The feat catalog (FEATS_DB) and the
//   typed 1st-level feat slots.
//
// KEY NAMES (so you can search for them)
//   tables and state: FEATS_DB, FIRST_LEVEL_SLOT_KINDS,
//   HERITAGE_ELIGIBLE_KINDS, SLOT_PREFERENCE_ORDER
//
// WHERE IT CAME FROM
//   Gathered from js/app/47-save-character.js, js/rules/25-citation-helpers-
//   feats-talents-db.js when the code was regrouped by topic and page. Each
//   function and table moved whole and unchanged, with the comments above
//   it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// FEAT DATABASE — v8.1: 285 feats hand-curated from the DxD20 Hero's Handbook
// Each entry: {n, family, prereqs?, bonuses?, param?, grants?, takeable?, isItemCreation?, d}
// See the prereq-checker and buildFeatBonuses functions for how each field is consumed.
const FEATS_DB = [

  // === Heritage ===
  {n:'Arcane Heritage',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'arcane',min:1}]],d:'There is magic in your bloodline.',param:{param_kind:'heritage_class',param_label:'Heritage class',classes:['Bard','Sorcerer','Wizard']}},
  {n:'Divine Heritage',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'divine',min:1}]],d:'You have a link to the divine.',param:{param_kind:'heritage_class',param_label:'Heritage class',classes:['Cleric','Cleric (Druid Option)','Saint']}},
  {n:'Multi-Talented',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'heroic',min:1}],[{type:'note',text:'a minimum attribute score of 13 in the Talent’s associated Hero class'}]],grants:{type:'talent',tree:'any',count:1,special:'treated as 1st-level Hero of chosen class'},d:'You have more than one talent.'},
  {n:'Planetary Adaptation',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'tech',min:6}]],d:'Your physiology has been altered by life on a planet with a harsh climate or adverse environmental conditions.'},
  {n:'Psionic Heritage',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'psionic',min:1}]],d:'You have always had innate psychic power.',param:{param_kind:'heritage_class',param_label:'Heritage class',classes:['Psion','Warmind','Wilder']}},
  {n:'Slightly Different',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'mutation',min:1}]],d:'You are… slightly different.'},
  {n:'Supernatural Mutation',family:'Heritage',prereqs:[[{type:'heritage'}],[{type:'sixLevel',axis:'mutation',min:5}],[{type:'note',text:'non-Construct'}],[{type:'note',text:'non-Elemental'}],[{type:'note',text:'non-Outsider'}],[{type:'note',text:'non-Undead character'}]],d:'You have super-powers, born of some exceptional circumstance.'},
  {n:'Toughness',family:'Heritage',prereqs:[[{type:'heritage'}]],bonuses:[{type:'untyped',target:'hp',value:3}],takeable:'multiple',d:'You are tougher than most.'},

  // === General ===
  {n:'Action Boost',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}]],bonuses:[{type:'note',text:'Roll d8 instead of d6 when spending Action Point'}],d:'You have the ability to alter your luck drastically in dire circumstances.'},
  {n:'Archaic Weapons Proficiency',family:'General'},
  {n:'Charismatic Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Charismatic Hero',min:1}]],grants:{type:'talent',tree:'Charismatic',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly charismatic hero.'},
  {n:'Dedicated Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Dedicated Hero',min:1}]],grants:{type:'talent',tree:'Dedicated',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly dedicated hero.'},
  {n:'Diehard',family:'General',prereqs:[[{type:'feat',name:'Endurance'}]],bonuses:[{type:'note',text:'Auto-stabilize when Dying'}],d:'You refuse to die.'},
  {n:'Endurance',family:'General',bonuses:[{type:'note',text:'+4 on Fort vs adverse conditions; check Endurance feat description'}],d:'You are inured to the threats of nature.'},
  {n:'Fast Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Fast Hero',min:1}]],grants:{type:'talent',tree:'Fast',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly dexterous hero.'},
  {n:'Fleet of Foot',family:'General',prereqs:[[{type:'feat',name:'Run'}]],d:'You can turn on a dime.'},
  {n:'Force of Will',family:'General',prereqs:[[{type:'feat',name:'Iron Will'}]],bonuses:[{type:'note',text:'Re-roll a failed Will save 1/day'}],d:'You are able to resist mental attacks with extreme force of will.'},
  {n:'Great Fortitude',family:'General',bonuses:[{type:'untyped',target:'fort',value:2}],d:'You have a greater fortitude than most.'},
  {n:'Heroic Surge',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'tierLevel',tier:'hero',min:1}]],bonuses:[{type:'note',text:'Take an additional standard action; uses/day = char level/4'}],d:'You are able to push yourself that little bit further when it matters most.'},
  {n:'Improved Damage Threshold',family:'General',bonuses:[{type:'note',text:'Massive damage threshold +3 (tracked manually)'}],takeable:'multiple',d:'You are able to stay on your feet where others would be felled.'},
  {n:'Improved Natural Healing',family:'General',prereqs:[[{type:'save',save:'fort',min:5}]],d:'You recover from wounds and injury faster than normal.'},
  {n:'Iron Will',family:'General',bonuses:[{type:'untyped',target:'will',value:2}],d:'You have a will of iron.'},
  {n:'Jack of All Trades',family:'General',prereqs:[[{type:'characterLevel',min:8}]],d:'You have an amateur’s knowledge of all skills, even ones that require training.'},
  {n:'Leadership',family:'General',prereqs:[[{type:'characterLevel',min:6}]],d:'Your exploits have attracted a cohort and followers.'},
  {n:'Lightning Reflexes',family:'General',bonuses:[{type:'untyped',target:'ref',value:2}],d:'You have faster than normal reflexes.'},
  {n:'Low Profile',family:'General',bonuses:[{type:'untyped',target:'rep',value:-3}],takeable:'multiple',d:'You’ve kept your head down in the public eye.'},
  {n:'Martial Weapon Proficiency',family:'General',param:{param_kind:'martial_weapon',param_label:'Martial Weapon'},takeable:'multiple',d:'Choose a type of martial weapon. You understand how to use that type of martial weapon in combat.'},
  {n:'Moonlighter',family:'General',grants:{type:'occupation',count:1},d:'Select a second Starting Occupation; both grant their class skills and benefits. (Equivalent to rolling 00 on the random Starting Occupation chart.) Pick the second occupation via ✎ Edit after taking this feat.'},  // (v8.36.1: moved out of d — prose-only rule) Once this feat is on your hero, the "Second Occupation" field becomes available on the character's edit form — save the hero, add Moonlighter from the Feats tab, then re-open the create form via "Edit" to pick the second occupation.
  {n:'Open Minded',family:'General',takeable:'multiple',d:'You are naturally able to reroute your memory, mind, and skill expertise.'},
  {n:'Rapid Metabolism',family:'General',prereqs:[[{type:'attr',name:'CON',min:13}]],d:'Your wounds heal rapidly.'},
  {n:'Renown',family:'General',bonuses:[{type:'untyped',target:'rep',value:3}],takeable:'multiple',d:'You have established a name for yourself.'},
  {n:'Run',family:'General',d:'You have an extra gear.'},
  {n:'Shield Proficiency',family:'General',d:'You are proficient with bucklers, small shields, and large shields.'},
  {n:'Simple Weapon Proficiency',family:'General',d:'You make attack rolls with simple weapons normally.'},
  {n:'Smart Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Smart Hero',min:1}]],grants:{type:'talent',tree:'Smart',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly intelligent hero.'},
  {n:'Strong Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Strong Hero',min:1}]],grants:{type:'talent',tree:'Strong',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly strong hero.'},
  {n:'Tough Plus',family:'General',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'classLevel',tier:'hero',name:'Tough Hero',min:1}]],grants:{type:'talent',tree:'Tough',count:2},takeable:'multiple',d:'Your drive to excel enables you to progress faster toward becoming a truly tough hero.'},
  {n:'Ultra Immune System',family:'General',prereqs:[[{type:'attr',name:'CON',min:13}]],d:'You are less susceptible to the ravages of poison, disease, and radiation poisoning.'},
  {n:'Wild Talent',family:'General',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],bonuses:[{type:'note',text:'Gain 2 power points; considered psionic'}],d:'Your mind wakes to a previously unrealized talent for psionics.'},
  {n:'Windfall',family:'General',bonuses:[{type:'note',text:'Wealth score +3 (tracked manually)'}],takeable:'multiple',d:'You come into money unexpectedly.'},

  // === Expert ===
  {n:'Acrobatic',family:'Expert',bonuses:[{type:'untyped',target:'skill:Jump',value:2},{type:'untyped',target:'skill:Tumble',value:2}],d:'You have an excellent sense of coordination.'},
  {n:'Advanced Mecha Operation',family:'Expert',prereqs:[[{type:'feat',name:'Mecha Operation'}],[{type:'sixLevel',axis:'tech',min:6}]],param:{param_kind:'mecha_class',param_label:'Mecha Class'},d:'You have received advanced training or extensive practice in mecha movement.'},
  {n:'Agile',family:'Expert',bonuses:[{type:'untyped',target:'skill:Balance',value:2},{type:'untyped',target:'skill:Escape Artist',value:2}],d:'Your sense of balance and flexibility is better than most.'},
  {n:'Aircraft Operation',family:'Expert',prereqs:[[{type:'skill',name:'Pilot',min:4}],[{type:'sixLevel',axis:'tech',min:5}]],param:{param_kind:'aircraft_class',param_label:'Aircraft Class'},takeable:'multiple',d:'Select a class of aircraft (heavy aircraft, helicopters, jet fighters, or spacecraft). The character is proficient at operating that class of aircraft. The heavy aircraft class includes jumbo passenger airplanes, large cargo planes, heavy bombers, and any other aircraft with three or more engines. Helicopters include transport and combat helicopters of all types. Jet fighters include military fighter and ground attack jets. Spacecraft are vehicles such as the space shuttle and the lunar lander.'},
  {n:'Alertness',family:'Expert',bonuses:[{type:'untyped',target:'skill:Spot',value:2},{type:'untyped',target:'skill:Listen',value:2}],d:'You are acutely aware of your surroundings.'},
  {n:'Animal Affinity',family:'Expert',bonuses:[{type:'untyped',target:'skill:Handle Animal',value:2},{type:'untyped',target:'skill:Ride',value:2}],d:'You have a way with animals.'},
  {n:'Athletic',family:'Expert',bonuses:[{type:'untyped',target:'skill:Climb',value:2},{type:'untyped',target:'skill:Swim',value:2}],d:'You have a natural inclination for swimming and climbing.'},
  {n:'Attentive',family:'Expert',bonuses:[{type:'untyped',target:'skill:Investigate',value:2},{type:'untyped',target:'skill:Sense Motive',value:2}],d:'You are intuitively observant.'},
  {n:'Builder',family:'Expert',d:'You are knowledgeable in the applied sciences.'},
  {n:'Cautious',family:'Expert',bonuses:[{type:'untyped',target:'skill:Demolitions',value:2},{type:'untyped',target:'skill:Disable Device',value:2}],d:'You always check twice.'},
  {n:'Cloak Dance',family:'Expert',prereqs:[[{type:'skill',name:'Hide',min:10}],[{type:'skill',name:'Perform (dance)',min:2}]],d:'You are skilled at using optical tricks to make yourself seem to be where you are not.'},
  {n:'Confident',family:'Expert',bonuses:[{type:'untyped',target:'skill:Gamble',value:2},{type:'untyped',target:'skill:Intimidate',value:2}],d:'You have a swagger than can give others pause.'},
  {n:'Craft Cybernetics',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Craft (Electronics)',min:10}],[{type:'skill',name:'Craft (mechanical)',min:10}],[{type:'skill',name:'Knowledge (life sciences)',min:5}]],d:'You can construct cybernetic attachments.'},
  {n:'Creative',family:'Expert',takeable:'multiple',d:'You are a natural artist.'},
  {n:'Cybernetic Surgery',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Treat Injury',min:8}],[{type:'feat',name:'Surgery'}]],d:'You can graft cybernetic attachments onto living tissue as well as safely remove them.'},
  {n:'Cybertaker',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}]],takeable:'multiple',d:'You can have more cybernetic attachments than normal without suffering ill effects.'},
  {n:'Deceitful',family:'Expert',bonuses:[{type:'untyped',target:'skill:Disguise',value:2},{type:'untyped',target:'skill:Forgery',value:2}],d:'You are good at presenting façade as fact.'},
  {n:'Deceptive',family:'Expert',bonuses:[{type:'untyped',target:'skill:Bluff',value:2},{type:'untyped',target:'skill:Disguise',value:2}],d:'You are a natural actor.'},
  {n:'Deft Hands',family:'Expert',bonuses:[{type:'untyped',target:'skill:Sleight of Hand',value:2},{type:'untyped',target:'skill:Use Rope',value:2}],d:'You have some fancy fingerwork.'},
  {n:'Diligent',family:'Expert',bonuses:[{type:'untyped',target:'skill:Appraise',value:2},{type:'untyped',target:'skill:Decipher Code',value:2}],d:'You have an eye for value and discernment.'},
  {n:'Educated',family:'Expert',takeable:'multiple',d:'You have pursued a formal education.'},
  {n:'Focused',family:'Expert',bonuses:[{type:'untyped',target:'skill:Balance',value:2},{type:'untyped',target:'skill:Concentration',value:2}],d:'You maintain your focus even under difficult circumstances.'},
  {n:'Force Stop',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:3}],[{type:'skill',name:'Drive',min:4}],[{type:'feat',name:'Vehicle Expert'}]],d:'You are versed in vehicle-to-vehicle arrest techniques.'},
  {n:'Gearhead',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:5}]],bonuses:[{type:'untyped',target:'skill:Computer Use',value:2},{type:'untyped',target:'skill:Repair',value:2}],d:'You get along better with machines than people.'},
  {n:'Guide',family:'Expert',bonuses:[{type:'untyped',target:'skill:Navigate',value:2},{type:'untyped',target:'skill:Survival',value:2}],d:'You know how to get around and stay alive in the wild.'},
  {n:'Hair Trigger',family:'Expert',prereqs:[[{type:'bab',min:6}]],d:'You have developed a delicate sense of timing, and your area attacks hit your foes when they’re ill-prepared to defend against them.'},
  {n:'Investigator',family:'Expert',bonuses:[{type:'untyped',target:'skill:Gather Information',value:2},{type:'untyped',target:'skill:Search',value:2}],d:'You know how to find clues and leads.'},
  {n:'Mastercrafter',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:1}],[{type:'skill',name:'appropriate Craft (any)',min:8}]],d:'You are adept at creating mastercrafted items according to your craft (including tools, vehicles, weapons, and armor as the scenario’s Tech Scale allows).'},
  {n:'Mecha Crush',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Mecha Operation'}]],d:'You can hurl your mecha’s body onto opponents to deal tremendous damage.'},
  {n:'Mecha Fling',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Mecha Operation'}],[{type:'note',text:'at least one free hand slot'}]],d:'You can pick up an opponent with your mecha and fling it.'},
  {n:'Mecha Operation',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}]],param:{param_kind:'mecha_class',param_label:'Mecha Class'},d:'You know how to operate a mecha.'},
  {n:'Mecha Sweep',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Mecha Operation'}],[{type:'feat',name:'Power Attack'}],[{type:'note',text:'two free hand slots'}]],d:'You can use your mecha to wield improvised weapons and attack several spaces at once.'},
  {n:'Mecha Trample',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Mecha Operation'}],[{type:'bab',min:4}]],d:'Your mecha can knock down and crush opponents.'},
  {n:'Mecha Weapon Boost',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'bab',min:8}],[{type:'skill',name:'Repair',min:6}]],d:'By disabling safeguards and shunting auxiliary power into your weapons, you can attain greater destructive power at the cost of weapon accuracy.'},
  {n:'Mecha Weapon Proficiency',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Mecha Operation'}]],d:'You know how to acquire targets and fire your mecha’s weapons using onboard computers and sensors.'},
  {n:'Medical Expert',family:'Expert',bonuses:[{type:'untyped',target:'skill:Craft (Pharmaceutical)',value:2},{type:'untyped',target:'skill:Treat Injury',value:2}],d:'You have training in helping the sick and injured.'},
  {n:'Meticulous',family:'Expert',bonuses:[{type:'untyped',target:'skill:Forgery',value:2},{type:'untyped',target:'skill:Search',value:2}],d:'You have exceptional attention to detail.'},
  {n:'Negotiator',family:'Expert',bonuses:[{type:'untyped',target:'skill:Diplomacy',value:2},{type:'untyped',target:'skill:Sense Motive',value:2}],d:'You are good at gauging and swaying attitudes.'},
  {n:'Nimble',family:'Expert',bonuses:[{type:'untyped',target:'skill:Escape Artist',value:2},{type:'untyped',target:'skill:Sleight of Hand',value:2}],d:'You have exceptional flexibility and manual dexterity.'},
  {n:'Nimble Fingers',family:'Expert',bonuses:[{type:'untyped',target:'skill:Disable Device',value:2},{type:'untyped',target:'skill:Repair',value:2}],d:'You are adept at manipulating small tools and delicate objects.'},
  {n:'Persuasive',family:'Expert',bonuses:[{type:'untyped',target:'skill:Bluff',value:2},{type:'untyped',target:'skill:Intimidate',value:2}],d:'You have a way with words and body language.'},
  {n:'Salvage',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:5}],[{type:'skill',name:'Craft (Electrical) 5 ranks and Craft (Mechanical)',min:5}]],d:'You can salvage parts from destroyed vehicles, mecha, starships, robots, and cybernetic attachments.'},
  {n:'Skill Focus',family:'Expert',bonuses:[{type:'untyped',target:'param',value:3,param_role:'skill'}],param:{param_kind:'skill',param_label:'Skill'},takeable:'multiple',d:'Choose a skill; you are exceptionally well-versed in that skill.'},
  {n:'Spacer',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:5}]],d:'You have a special affinity for spacecraft and space travel.'},
  {n:'Starship Battle Run',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Starship Dodge'}],[{type:'feat',name:'Starship Mobility'}]],d:'You are skilled at starship skirmish tactics, zipping in and out of an enemy’s sights.'},
  {n:'Starship Dodge',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'attr',name:'DEX',min:13}],[{type:'skill',name:'Pilot',min:6}],[{type:'feat',name:'Starship Operation'}]],d:'You are adept at dodging attacks while piloting starships.'},
  {n:'Starship Feint',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Pilot',min:9}],[{type:'feat',name:'Starship Operation'}]],d:'You are skilled at misleading your enemy in starship combat.'},
  {n:'Starship Gunnery',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}]],d:'You are proficient with starship weapon systems.'},
  {n:'Starship Mobility',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Starship Dodge'}]],d:'You are adept at dodging attacks while piloting starships.'},
  {n:'Starship Operation',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Pilot',min:2}]],param:{param_kind:'starship_class',param_label:'Starship Class'},takeable:'multiple',d:'Select one of the following types of starships: ultralight, light, mediumweight, heavy, or superheavy. You are proficient at operating starships of that type.'},
  {n:'Stealthy',family:'Expert',bonuses:[{type:'untyped',target:'skill:Hide',value:2},{type:'untyped',target:'skill:Move Silently',value:2}],d:'You are quiet on your feet and shadowed in your step.'},
  {n:'Studious',family:'Expert',bonuses:[{type:'untyped',target:'skill:Decipher Code',value:2},{type:'untyped',target:'skill:Research',value:2}],d:'You are a productive bookworm.'},
  {n:'Stun Mecha',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'bab',min:8}],[{type:'feat',name:'Mecha Operation'}],[{type:'feat',name:'Precise Shot'}]],d:'By channeling electricity into an enemy mecha’s control system, you can temporarily short it out.'},
  {n:'Surface Vehicle Operation',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:3}]],param:{param_kind:'vehicle_class',param_label:'Vehicle Class'},d:'Select a class of surface vehicle (heavy wheeled, powerboat, sailboat, ship, or tracked). The character is proficient at operating that class of vehicle.'},
  {n:'Surgery',family:'Expert',prereqs:[[{type:'skill',name:'Treat Injury',min:4}]],d:'You are formally trained in medical methods.'},
  {n:'Thruster Blast',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Pilot',min:10}],[{type:'note',text:'flight system (jetpack, thruster boots, or ramjet thruster boots)'}]],d:'By directing your vectored thrusters all around your mecha, you can kick up a cloud of dust and debris that obscures the battlefield.'},
  {n:'Track',family:'Expert',d:'You know how to follow tracks in the wild.'},
  {n:'Trustworthy',family:'Expert',d:'You have an honest face.'},
  {n:'Urban Tracking',family:'Expert',d:'You can track down the location of missing persons or wanted individuals.'},
  {n:'Vehicle Dodge',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:3}],[{type:'attr',name:'DEX',min:13}],[{type:'skill',name:'Drive 6 ranks or Pilot',min:6}],[{type:'feat',name:'Vehicle Expert'}]],d:'You are adept at dodging while piloting a vehicle.'},
  {n:'Vehicle Expert',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:3}]],bonuses:[{type:'untyped',target:'skill:Drive',value:2},{type:'untyped',target:'skill:Pilot',value:2}],d:'You have a way with vehicles.'},
  {n:'Vehicle Specialization',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:3}]],d:'You are proficient with one type of vehicle.'},
  {n:'Xenomedic',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'skill',name:'Knowledge (earth and life sciences)',min:6}],[{type:'skill',name:'Treat Injury',min:6}],[{type:'feat',name:'Surgery'}]],d:'You know how to provide safe medical treatment to alien life forms.'},
  {n:'Zero-G Training',family:'Expert',prereqs:[[{type:'sixLevel',axis:'tech',min:5}],[{type:'attr',name:'DEX',min:13}],[{type:'skill',name:'Tumble',min:4}]],d:'You can function normally in low gravity or zero gravity.'},

  // === Fighter ===
  {n:'Advanced Combat Martial Arts',family:'Fighter',prereqs:[[{type:'feat',name:'Combat Martial Arts'}],[{type:'feat',name:'Improved Combat Martial Arts'}],[{type:'bab',min:8}]],d:'You have advanced training in multiple offensive martial arts forms.'},
  {n:'Advanced Defensive Martial Arts',family:'Fighter',prereqs:[[{type:'feat',name:'Defensive Martial Arts'}],[{type:'feat',name:'Improved Defensive Martial Arts'}],[{type:'bab',min:8}]],bonuses:[{type:'competence',target:'def',value:1}],d:'You have advanced training in multiple defensive martial arts forms.'},
  {n:'Advanced Dodge',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:17}],[{type:'feat',name:'Dodge'}],[{type:'feat',name:'Improved Dodge'}]],bonuses:[{type:'dodge',target:'ac',value:1}],d:'You have advanced training in avoiding your enemy’s attacks.'},
  {n:'Advanced Firearms Proficiency',family:'Fighter',prereqs:[[{type:'feat',name:'Personal Firearms Proficiency'}],[{type:'sixLevel',axis:'tech',min:3}]],d:'You are able to use automatic firearms competently.'},
  {n:'Advanced Two-Weapon Fighting',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:17}],[{type:'feat',name:'Two-Weapon Fighting'}],[{type:'feat',name:'Improved Two-Weapon Fighting'}],[{type:'bab',min:11}]],d:'You are an expert at wielding two weapons simultaneously.'},
  {n:'Agile Riposte',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}]],d:'Once per round, if the opponent the character has designated as their dodge target makes a melee attack or melee touch attack against the character and misses, the character may make an attack of oppo'},
  {n:'Alien Weapon Proficiency',family:'Fighter',d:'Choose an alien weapon to which you have access; you are proficient with that style of alien weapon.'},
  {n:'Armor Proficiency (Heavy)',family:'Fighter',prereqs:[[{type:'feat',name:'Armor Proficiency'}],[{type:'feat',name:'Armor Proficiency'}]],d:'You can operate effectively in heavy armor.'},
  {n:'Armor Proficiency (Light)',family:'Fighter',d:'You can operate effectively in light armor.'},
  {n:'Armor Proficiency (Medium)',family:'Fighter',prereqs:[[{type:'feat',name:'Armor Proficiency'}]],d:'You can operate effectively in medium armor.'},
  {n:'Armor Proficiency (Powered)',family:'Fighter',prereqs:[[{type:'sixLevel',axis:'tech',min:6}],[{type:'feat',name:'Armor Proficiency'}],[{type:'feat',name:'Armor Proficiency'}]],d:'You can operate effectively in powered armor.'},
  {n:'Blind-Fight',family:'Fighter',d:'You are skilled in anticipating an unseen foe’s moves.'},
  {n:'Brawl',family:'Fighter',d:'You are experienced in fisticuffs. +1 competence bonus on unarmed attack rolls; deal 1d6 + Str modifier nonlethal damage instead of 1d3 + Str modifier.'},
  {n:'Burst Fire',family:'Fighter',prereqs:[[{type:'attr',name:'WIS',min:13}],[{type:'feat',name:'Personal Firearms Proficiency'}],[{type:'feat',name:'Advanced Firearms Proficiency'}],[{type:'sixLevel',axis:'tech',min:3}]],
    // v8.5.2: combatMod surfaces this as an alternate-attack-mode option in
    // the Gear tab's equipped-weapon summary (computeEquippedWeaponSummaries)
    // whenever the character owns the feat AND the equipped weapon's rof[]
    // includes requiresRoF. roundsCost is informational only — ammo state is
    // NOT tracked (Adam, 2026-06-30: left to the player).
    combatMod:{kind:'burstFire', requiresRoF:'A', atkPenalty:-4, dmgMult:2, roundsCost:5},
    d:'You have a tempered trigger finger. With an automatic firearm loaded with at least 5 rounds, you may fire a short burst at a single target as one attack: -4 to hit, but double damage on a hit. Costs 5 rounds from the magazine per use (3 if the weapon has a three-round-burst setting — GM-adjudicated, not tracked here). Without this feat, autofire only targets a 10-by-10-foot area, not a specific creature. Stacks additively with a critical hit (Burst Fire x2 + critical x2 = x3, not x4).'},
  {n:'Cleave',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Attack'}]],d:'Dropping an enemy heartens you to strike at the next one.'},
  {n:'Combat Expertise',family:'Fighter',prereqs:[[{type:'attr',name:'INT',min:13}]],d:'The best offense is a good defense according to you.'},
  {n:'Combat Martial Arts',family:'Fighter',prereqs:[[{type:'bab',min:1}]],d:'You are trained in offensive martial arts techniques.'},
  {n:'Combat Reflexes',family:'Fighter',d:'You know how to pounce on opportunities in combat.'},
  {n:'Combat Throw',family:'Fighter',prereqs:[[{type:'feat',name:'Defensive Martial Arts'}]],d:'Your studies in defensive martial arts allow you to leverage an enemy’s position in combat.'},
  {n:'Dead Aim',family:'Fighter',prereqs:[[{type:'attr',name:'WIS',min:13}],[{type:'feat',name:'Far Shot'}]],d:'With a moment to draw a bead, you can shoot more accurately than most.'},
  {n:'Defensive Martial Arts',family:'Fighter',bonuses:[{type:'competence',target:'def',value:1}],d:'You have training in defensive martial arts techniques.'},
  {n:'Deflect Arrows',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Defensive Martial Arts'}]],d:'You can knock aside incoming arrows and thrown weapons.'},
  {n:'Dodge',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}]],bonuses:[{type:'dodge',target:'ac',value:1}],d:'You receive a +1 dodge bonus to Armor Class. Also, you can ready a dodge as a swift action.'},
  // v8.97.0 (Adam's Rhad report): the condition:'designated target' above was
  // an SRD VESTIGE — the HH's Dodge (p.240) is UNCONDITIONAL (+1 dodge AC,
  // dodge readies as a swift action). It parked the feat in the conditional
  // bucket, so Rhad's Dodge never reached the Dodge modifier or his AC.
  {n:'Double Tap',family:'Fighter',prereqs:[[{type:'sixLevel',axis:'tech',min:3}],[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Point-Blank Shot'}]],
    // v8.5.2: see Burst Fire's combatMod comment — same surfacing mechanism.
    combatMod:{kind:'doubleTap', requiresRoF:'S', atkPenalty:-2, dmgMult:1.5, roundsCost:2},
    d:'Just to be sure. With a semiautomatic firearm loaded with at least 2 rounds, you may fire twice at a single target as one attack: -2 to hit, but +50% damage on a hit. Costs 2 rounds from the magazine per use. Stacks additively with a critical hit, same as Burst Fire.'},
  {n:'Drive-By Attack',family:'Fighter',prereqs:[[{type:'sixLevel',axis:'tech',min:3}]],d:'You are skilled at attacking accurately from a moving vehicle.'},
  {n:'Elusive Target',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Defensive Martial Arts'}]],d:'You know how to use your enemies for cover.'},
  {n:'Exotic Firearm Proficiency',family:'Fighter',prereqs:[[{type:'feat',name:'Personal Firearms Proficiency'}],[{type:'feat',name:'Advanced Firearms Proficiency'}]],param:{param_kind:'exotic_weapon',param_label:'Exotic Firearm'},d:'Choose a weapon type from the following list; cannon, heavy machine gun, grenade launchers, or rocket launchers. You understand how to use all weapons within that group.'},
  {n:'Exotic Weapon Proficiency',family:'Fighter',prereqs:[[{type:'bab',min:1}],[{type:'attr',name:'STR',min:13}],[{type:'note',text:'like a bastard sword'}]],param:{param_kind:'exotic_weapon',param_label:'Exotic Weapon'},takeable:'multiple',d:'Choose a type of weapon exotic to you; you understand how to use that weapon in combat.'},
  {n:'Far Shot',family:'Fighter',prereqs:[[{type:'feat',name:'Point-Blank Shot'}]],d:'You can get better range on thrown and non-ballistic ranged weapons.'},
  {n:'Great Cleave',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Cleave'}],[{type:'feat',name:'Power Attack'}],[{type:'bab',min:4}]],d:'When you start dropping opponents, you don’t stop.'},
  {n:'Greater Two-Weapon Fighting',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:19}],[{type:'feat',name:'Improved Two-Weapon Fighting'}],[{type:'feat',name:'Two-Weapon Fighting'}],[{type:'bab',min:11}]],d:'You are a master of wielding two weapons simultaneously.'},
  {n:'Greater Weapon Focus',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'featParam',name:'Weapon Focus'}],[{type:'classLevel',tier:'basic',name:'Fighter',min:8}]],param:{param_kind:'weapon',param_label:'Weapon'},takeable:'multiple',d:'Choose one type of weapon for which you have already selected Weapon Focus. You can also choose unarmed strike or grapple as your weapon for purposes of this feat. You gain a further +1 bonus on attack rolls with the selected weapon — stacks with Weapon Focus’s +1 (total +2).'},
  {n:'Greater Weapon Specialization',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'featParam',name:'Greater Weapon Focus'}],[{type:'featParam',name:'Weapon Focus'}],[{type:'featParam',name:'Weapon Specialization'}],[{type:'classLevel',tier:'basic',name:'Fighter',min:12}]],param:{param_kind:'weapon',param_label:'Weapon'},takeable:'multiple',d:'Choose one type of weapon for which you have already selected Weapon Specialization. You can also choose unarmed strike or grapple as your weapon for purposes of this feat.'},
  {n:'Improved Brawl',family:'Fighter',prereqs:[[{type:'feat',name:'Brawl'}],[{type:'bab',min:3}]],d:'You really know how to give a beating in a fight.'},
  {n:'Improved Bull Rush',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Attack'}]],d:'You know how to push people around in a fight.'},
  {n:'Improved Combat Martial Arts',family:'Fighter',prereqs:[[{type:'feat',name:'Combat Martial Arts'}],[{type:'bab',min:4}]],d:'You have studied one or more offensive martial arts techniques extensively.'},
  {n:'Improved Combat Throw',family:'Fighter',prereqs:[[{type:'feat',name:'Defensive Martial Arts'}],[{type:'feat',name:'Combat Throw'}],[{type:'bab',min:3}]],d:'You know how to use your opponent’s force against them.'},
  {n:'Improved Critical',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'bab',min:8}]],takeable:'multiple',d:'You know how to find your opponent’s weak spots with the chosen weapon.'},
  {n:'Improved Defensive Martial Arts',family:'Fighter',prereqs:[[{type:'feat',name:'Defensive Martial Arts'}],[{type:'bab',min:4}]],bonuses:[{type:'competence',target:'def',value:1}],d:'You have training in multiple defensive martial arts techniques.'},
  {n:'Improved Disarm',family:'Fighter',prereqs:[[{type:'attr',name:'INT',min:13}],[{type:'feat',name:'Combat Expertise'}]],d:'You are adept at disarming your opponents in combat.'},
  {n:'Improved Dodge',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:15}],[{type:'feat',name:'Dodge'}]],bonuses:[{type:'dodge',target:'ac',value:1}],d:'You have improved your training in avoiding blows.'},
  {n:'Improved Feint',family:'Fighter',prereqs:[[{type:'attr',name:'INT',min:13}],[{type:'feat',name:'Combat Expertise'}]],d:'You know how to lure your opponent into exposing themselves to attack while in combat.'},
  {n:'Improved Grapple',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Brawl'}],[{type:'note',text:'and Combat Martial Arts'}]],d:'You know how to wrestle.'},
  {n:'Improved Initiative',family:'Fighter',bonuses:[{type:'untyped',target:'init',value:4}],d:'Your reaction time is better than most.'},
  {n:'Improved Knockout Punch',family:'Fighter',prereqs:[[{type:'feat',name:'Brawl'}],[{type:'feat',name:'Knockout Punch'}],[{type:'bab',min:6}]],d:'You know where that glass jaw is.'},
  {n:'Improved Overrun',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Attack'}]],d:'Once you line someone up, they’re getting run over.'},
  {n:'Improved Precise Shot',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:19}],[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Precise Shot'}],[{type:'bab',min:11}]],d:'Your ranged attacks are so accurate as to ignore cover and concealment.'},
  {n:'Improved Shield Bash',family:'Fighter',prereqs:[[{type:'feat',name:'Shield Proficiency'}]],d:'You can use your shield for both offense and defense.'},
  {n:'Improved Sunder',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Attack'}]],d:'You have an eye for the weak points in objects, including weapons and armor.'},
  {n:'Improved Trip',family:'Fighter',prereqs:[[{type:'attr',name:'INT',min:13}],[{type:'feat',name:'Combat Expertise'}]],d:'You know techniques in tripping your enemy.'},
  {n:'Improved Two-Weapon Fighting',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:17}],[{type:'feat',name:'Two-Weapon Fighting'}],[{type:'bab',min:6}]],d:'You have trained extensively in wielding two weapons simultaneously.'},
  {n:'Improved Unarmed Strike',family:'Fighter'},
  {n:'Knockout Punch',family:'Fighter',prereqs:[[{type:'feat',name:'Brawl'}],[{type:'bab',min:3}]],d:'You know how to cold-cock someone.'},
  {n:'Manyshot',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:17}],[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Rapid Shot'}],[{type:'bab',min:6}]],d:'You can fire two arrows at once.'},
  {n:'Mobility',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}]],bonuses:[{type:'dodge',target:'ac',value:4,condition:'moving through threatened squares'}],d:'You move deftly through combat.'},
  {n:'Mounted Archery',family:'Fighter',prereqs:[[{type:'skill',name:'Ride',min:1}],[{type:'feat',name:'Mounted Combat'}]],d:'You are experienced at firing from the back of a mount.'},
  {n:'Mounted Combat',family:'Fighter',prereqs:[[{type:'skill',name:'Ride',min:1}]],d:'You are experienced in fighting from the back of a mount.'},
  {n:'Nerve Pinch',family:'Fighter',prereqs:[[{type:'feat',name:'Combat Martial Arts'}],[{type:'bab',min:4}]],d:'You can incapacitate foes with a vicelike pinch.'},
  {n:'Personal Firearms Proficiency',family:'Fighter',prereqs:[[{type:'sixLevel',axis:'tech',min:3}]],d:'You are competent with personal firearms.'},
  {n:'Point-Blank Shot',family:'Fighter',d:'You use ranged weapons with greater accuracy at close range.'},
  {n:'Power Attack',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}]],d:'You can deliver more damage in your melee attacks by sacrificing accuracy.'},
  {n:'Power Crit',family:'Fighter',prereqs:[[{type:'sixLevel',axis:'heroic',min:1}],[{type:'bab',min:10}],[{type:'note',text:'proficiency with weapon'}]],d:'You may threaten a critical hit if you succeed in hitting an opponent.'},
  {n:'Precise Shot',family:'Fighter',prereqs:[[{type:'feat',name:'Point-Blank Shot'}]],d:'You know how to place your shot in tight quarters.'},  // v8.75.0: Overpenetration rider REVERSED (Adam, 2026-10-03 — the rule is withdrawn; ballistic = Tech Piercing, full damage to objects, nothing more)
  {n:'Quick Draw',family:'Fighter',prereqs:[[{type:'bab',min:1}]],d:'You are quick on the draw.'},
  {n:'Quick Reload',family:'Fighter',prereqs:[[{type:'bab',min:1}],[{type:'note',text:'proficiency with the weapon to be reloaded'}]],d:'You are adept at quickly reloading firearms, including crossbows.'},
  {n:'Rapid Shot',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Point-Blank Shot'}]],d:'You can make a barrage of ranged attacks at the cost of accuracy.'},
  {n:'Reckless Offense',family:'Fighter',prereqs:[[{type:'bab',min:1}]],d:'You can shift your focus from defense to offense.'},
  {n:'Ride-By Attack',family:'Fighter',prereqs:[[{type:'skill',name:'Ride',min:1}],[{type:'feat',name:'Mounted Combat'}]],d:'You can perform hit-and-run attacks from the back of a mount.'},
  {n:'Shield Parry',family:'Fighter',prereqs:[[{type:'attr',name:'WIS',min:13}],[{type:'bab',min:1}],[{type:'feat',name:'Shield Proficiency'}]],d:'Your awareness of the battlefield and your proficiency with a shield allow you to carefully time a parry against an incoming attack.'},
  {n:'Shot on the Run',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}],[{type:'feat',name:'Mobility'}],[{type:'feat',name:'Point-Blank Shot'}],[{type:'bab',min:4}]],d:'You know how to draw a bead while running.'},
  {n:'Sidestep Charge',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}]],d:'You are skilled at dodging past charging opponents and taking advantage when they miss.'},
  {n:'Skip Shot',family:'Fighter',prereqs:[[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Precise Shot'}]],d:'You can ricochet shots around corners and behind cover.'},
  {n:'Snatch Arrow',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:15}],[{type:'feat',name:'Combat Martial Arts'}],[{type:'feat',name:'Deflect Arrows'}]],d:'It’s all in the reflexes.'},
  {n:'Spring Attack',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}],[{type:'feat',name:'Mobility'}],[{type:'bab',min:4}]],d:'You have a fluidity in combat that allows you to weave in and out while striking.'},
  {n:'Stand Still',family:'Fighter',prereqs:[[{type:'attr',name:'STR',min:13}]],d:'You can prevent foes from fleeing or closing.'},
  {n:'Strafe',family:'Fighter',prereqs:[[{type:'feat',name:'Personal Firearms Proficiency'}],[{type:'feat',name:'Advanced Firearms Proficiency'}]],d:'You can use an automatic firearm to spread out fire.'},
  {n:'Streetfighting',family:'Fighter',prereqs:[[{type:'feat',name:'Brawl'}],[{type:'bab',min:2}]],d:'All’s fair in love and war.'},
  {n:'Stunning Fist',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'attr',name:'WIS',min:13}],[{type:'feat',name:'Combat Martial Arts'}],[{type:'bab',min:8}]],d:'You strike at the very core of an enemy’s being.'},
  {n:'Supernatural Strike',family:'Fighter',prereqs:[[{type:'bab',min:2}],[{type:'note',text:'GM’s permission'}]],d:'You have an unnatural ability to score critical hits against creatures that are normally unaffected by critical hits.'},
  {n:'Tower Shield Proficiency',family:'Fighter',prereqs:[[{type:'feat',name:'Shield Proficiency'}]],d:'You know how to use a tower shield competently.'},
  {n:'Trample',family:'Fighter',prereqs:[[{type:'skill',name:'Ride',min:1}],[{type:'feat',name:'Mounted Combat'}]],d:'You can run down enemies with your mount.'},
  {n:'Two-Weapon Defense',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:15}],[{type:'feat',name:'Two-Weapon Fighting'}]],d:'You are able to use your weapons to defend yourself as well.'},
  {n:'Two-Weapon Fighting',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:15}]],d:'You can fight with a weapon in each hand. You can make one extra attack each round with the second weapon.'},
  {n:'Unbalance Opponent',family:'Fighter',prereqs:[[{type:'feat',name:'Defensive Martial Arts'}],[{type:'bab',min:6}]],d:'You know how to keep your enemy off-balance.'},
  {n:'Weapon Finesse',family:'Fighter',prereqs:[[{type:'bab',min:1}]],d:'You have learned to favor grace over power in wielding light weapons. With a light weapon, Rapier, Whip, or Spiked Chain sized for you, you may use your Dexterity modifier instead of Strength on attack rolls and Parry attempts (applied automatically wherever Dex beats Str — weapon rows, unarmed strike, natural attacks, and the Parry modifier). Natural attacks and the unarmed strike always count as light weapons for this purpose. If you carry a shield, its armor check penalty applies to your finessed attack rolls (wired).'},
  {n:'Weapon Focus',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'bab',min:1}]],param:{param_kind:'weapon',param_label:'Weapon'},takeable:'multiple',d:'Choose one type of weapon. You can also choose unarmed strike, grapple, or ray as your weapon for purposes of this feat. You gain a +1 bonus on all attack rolls with the selected weapon. Multiple instances apply to different weapons; the effect does not stack for the same weapon.'},
  {n:'Weapon Specialization',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'featParam',name:'Weapon Focus'}],[{type:'classLevel',tier:'basic',name:'Fighter',min:4}]],param:{param_kind:'weapon',param_label:'Weapon'},takeable:'multiple',d:'Choose one type of weapon for which you have already selected the Weapon Focus feat. You can also choose unarmed strike or grapple as your weapon for purposes of this feat. You gain a +2 bonus on damage rolls with the selected weapon.'},
  {n:'Greater Weapon Specialization',family:'Fighter',prereqs:[[{type:'weaponProficiency'}],[{type:'featParam',name:'Greater Weapon Focus'}],[{type:'featParam',name:'Weapon Focus'}],[{type:'featParam',name:'Weapon Specialization'}],[{type:'classLevel',tier:'basic',name:'Fighter',min:12}]],param:{param_kind:'weapon',param_label:'Weapon'},takeable:'multiple',d:'Choose one type of weapon for which you have already selected Weapon Specialization. You can also choose unarmed strike or grapple as your weapon for purposes of this feat. You gain a further +2 bonus on damage rolls with the selected weapon — stacks with Weapon Specialization’s +2 (total +4).'},  // (v8.36.1: moved out of d — prose-only rule) v8.5.2: added to FEATS_DB — previously had a citation entry (HH p.218) but no actual feat data, making it structurally unobtainable.
  {n:'Whirlwind Attack',family:'Fighter',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'attr',name:'INT',min:13}],[{type:'feat',name:'Combat Expertise'}],[{type:'feat',name:'Dodge'}],[{type:'feat',name:'Mobility'}],[{type:'feat',name:'Spring Attack'}],[{type:'bab',min:4}]],d:'You can strike all opponents within melee in a dazzling display of offense.'},

  // === Magic ===
  {n:'Augment Summoning',family:'Magic',d:'Creatures you summon are stronger and tougher.'},
  {n:'Combat Casting',family:'Magic',bonuses:[{type:'untyped',target:'skill:Concentration',value:4,condition:'casting defensively in combat'}],d:'You are experienced in keeping your concentration on your magicks even while under duress.'},
  {n:'Enchant Arms & Armor',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:5}]],d:'You can create enchanted weapons, armor, and/or shields.'},
  {n:'Enchant Construct',family:'Magic',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'divine',min:1}],[{type:'feat',name:'Enchant Arms & Armor'}],[{type:'feat',name:'Enchant Wondrous Item'}]],d:'You can infuse your power into Constructs to serve you.'},
  {n:'Enchant Potion',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:3}]],d:'You can brew potions.'},
  {n:'Enchant Ring',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:10}]],d:'You can forge enchanted rings.'},  // (v8.36.1: moved out of d — prose-only rule) (Adam's pairs ruling 2026-09-01: table row "Caster Level 10" is authoritative — the Magic-family scenario gate covers the rest; the cross-type body shared with Imbue Ring is a drafting remnant, errata H3.)
  {n:'Enchant Rod',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:9}]],d:'You can create magical rods and scepters.'},
  {n:'Enchant Scroll',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:1}]],d:'You can scribe magical scrolls.'},
  {n:'Enchant Staff',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:10}]],d:'You can create magical staffs, which have multiple magical effects.'},
  {n:'Enchant Wand',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:5}]],d:'You can create magical wands.'},
  {n:'Enchant Wondrous Item',family:'Magic',isItemCreation:true,prereqs:[[{type:'casterLevel',pool:'any',min:3}]],d:'You can create magical items of a miscellaneous nature.'},
  {n:'Enlarge Spell',family:'Magic',d:'You can cast spells farther than normal.'},
  {n:'Eschew Materials',family:'Magic',d:'Your mastery of magic allows you to preclude the need for material components in many cases.'},
  {n:'Extend Spell',family:'Magic',d:'You can cast spells that last longer than normal.'},
  {n:'Extra Turning',family:'Magic',prereqs:[[{type:'sixLevel',axis:'divine',min:1}],[{type:'note',text:'ability to turn or rebuke creatures'}]],takeable:'multiple',d:'You are more attuned to your connection with positive (or negative) energy.'},
  {n:'Greater Spell Focus',family:'Magic',prereqs:[[{type:'featParam',name:'Spell Focus'}]],param:{param_kind:'school',param_label:'School of Magic'},takeable:'multiple',d:'Choose a school of magic to which you already have applied the Spell Focus feat; your spells in that school are even more difficult to resist.'},
  {n:'Greater Spell Penetration',family:'Magic',prereqs:[[{type:'feat',name:'Spell Penetration'}]],bonuses:[{type:'untyped',target:'note:SR',value:2,condition:'caster level check vs Spell Resistance (stacks with Spell Penetration)'}],d:'Your spells are able to better penetrate the magic resistance of opponents.'},
  {n:'Heighten Spell',family:'Magic',d:'You are able to augment your spells, increasing their power.'},
  {n:'Improved Counterspell',family:'Magic',d:'You are adaptable when it comes to countering an opponent’s spells.'},
  {n:'Improved Familiar',family:'Magic',prereqs:[[{type:'sixLevel',axis:'arcane',min:1}],[{type:'note',text:'ability to acquire a new familiar'}],[{type:'note',text:'compatible alignment'}],[{type:'note',text:'sufficiently high level (see below)'}]],d:'You have a familiar beyond the usual ken.'},
  {n:'Improved Turning',family:'Magic',prereqs:[[{type:'sixLevel',axis:'divine',min:1}],[{type:'note',text:'ability to turn or rebuke creatures'}]],d:'You are better at turning than most of your caliber.'},
  {n:'Magical Aptitude',family:'Magic',bonuses:[{type:'untyped',target:'skill:Spellcraft',value:2},{type:'untyped',target:'skill:Use Magic Device',value:2}],d:'You have a knack for magical endeavors.'},
  {n:'Maximize Spell',family:'Magic',d:'You can cast spells to maximum effect.'},
  {n:'Nonlethal Spell',family:'Magic',prereqs:[[{type:'allegianceAny'}]],d:'You can modify a spell to subdue enemies.'},
  {n:'Quicken Spell',family:'Magic',d:'You can cast a spell with but a thought.'},
  {n:'Reach Spell',family:'Magic',d:'You can cast touch spells without touching the spell recipient.'},
  {n:'Sacred Spell',family:'Magic',prereqs:[[{type:'casterLevel',pool:'divine',min:1}]],d:'You can cast spells imbued with divine energy.'},  // (v8.36.1: moved out of d — prose-only rule) Prereq "1st-level divine spellcaster" = EDL 1+ — structured check, was GM-verify.
  {n:'Signature Spell',family:'Magic',prereqs:[[{type:'feat',name:'Spell Mastery'}]],takeable:'multiple',d:'You are so familiar with a mastered spell that you can spontaneously cast it, converting other prepared spells into that spell.'},
  {n:'Silent Spell',family:'Magic',d:'You don’t have to use verbal components for spells if you don’t wish to.'},
  {n:'Spell Focus',family:'Magic',param:{param_kind:'school',param_label:'School of Magic'},takeable:'multiple',d:'Choose a school of magic; your spells from that school are especially effective.'},
  {n:'Spell Mastery',family:'Magic',prereqs:[[{type:'classLevel',tier:'basic',name:'Wizard',min:1}]],d:'You have a few spells committed permanently to memory.'},
  {n:'Spell Penetration',family:'Magic',bonuses:[{type:'untyped',target:'note:SR',value:2,condition:'caster level check vs Spell Resistance'}],d:'Your spells are better are piercing spell resistance.'},
  {n:'Spellslinger',family:'Magic',prereqs:[],takeable:'multiple',param:{param_kind:'pool',param_label:'Power Pool'},d:'You have a gift for magic that allows you to cast more spells than normal. Gain bonus power points equal to your character level (whenever character level increases, so does the pool). If you have multiple spellcasting pools, choose which to apply this to. Special: may be taken twice, once for each spellcasting power point pool.'},  // (v8.36.1: moved out of d — prose-only rule) (v8.3.33: prereq list was previously inherited from Spirited Charge — the feat that follows Spellslinger in the handbook — via an off-by-one data entry error. Handbook lists NO prereqs for Spellslinger; only the implicit "Magic feats require Arcane 1 or Divine 1 scenarios" global gate applies.)
  {n:'Still Spell',family:'Magic',d:'You need not gesticulate when casting spells with somatic components.'},
  {n:'Widen Spell',family:'Magic',d:'You can increase the area of effect of your spells.'},

  // === Power ===
  {n:'Aligned Attack',family:'Power',prereqs:[[{type:'bab',min:6}],[{type:'sixLevel',axis:'psionic',min:1},{type:'sixLevel',axis:'mutation',min:5}]],d:'You can focus to infuse your attack with power and purpose.'},  // (v8.36.1: moved out of d — prose-only rule) (Body prereq: BAB +6, Psionic Scale 1 OR Mutation Scale 5 scenario; the feat table prints "Divine 1" instead — body implemented, errata H2.)
  {n:'Body Fuel',family:'Power',d:'You can expand your power point total at the expense of your health.'},
  {n:'Boost Construct',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],d:'Your astral constructs have more abilities.'},  // (v8.36.1: moved out of d — prose-only rule) (Table prereq "Psionic 1" was missing from the data — added v8.5.4.)
  {n:'Burrowing Power',family:'Power',d:'Your powers sometimes bypass barriers.'},
  {n:'Chain Power',family:'Power',d:'You can make your energy powers arc to additional targets.'},
  {n:'Chaotic Mind',family:'Power',prereqs:[[{type:'alignment',value:'Chaotic'}],[{type:'attr',name:'CHA',min:15}],[{type:'sixLevel',axis:'psionic',min:1}]],d:'The turbulence of your thoughts prevents others from gaining insight into your actions.'},  // (v8.36.1: moved out of d — prose-only rule) (v8.3.34: prereq type changed from allegiance to alignment — handbook says "Chaotic alignment", which is the strict alignment-field check. The previous allegiance type would have qualified a character with explicit Allegiance to Chaos despite alignment Lawful/Neutral, which is not what the handbook intends.)
  {n:'Closed Mind',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],d:'Your mind is better able to resist psionics than normal.'},
  {n:'Combat Manifestation',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],bonuses:[{type:'untyped',target:'skill:Concentration',value:4,condition:'manifesting in combat'}],d:'You are experienced in keeping your concentration on your psionics even while under duress.'},
  {n:'Deep Impact',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Psionic Weapon'}],[{type:'bab',min:5}]],d:'When you focus you can strike your foe with a melee weapon with a greater chance of scoring a critical hit.'},
  {n:'Empower Power',family:'Power',d:'You can manifest powers to greater effect.'},
  {n:'Enlarge Power',family:'Power',d:'You can manifest powers farther than normal.'},
  {n:'Expanded Knowledge',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:3}]],takeable:'multiple',param:{param_kind:'power',param_label:'Power'},d:'You have access to powers beyond others of your discipline.'},
  {n:'Extend Power',family:'Power',d:'You can manifest powers that last longer than normal.'},
  {n:'Fell Shot',family:'Power',prereqs:[[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Power Shot'}],[{type:'bab',min:5}]],d:'When you focus you can strike your foes at range with greater chances of scoring a critical hit.'},
  {n:'Greater Power Endowment',family:'Power',prereqs:[[{type:'feat',name:'Power Endowment'}]],d:'You can infuse your powers with even greater potency, making them more difficult to resist.'},
  {n:'Greater Power Fist',family:'Power',prereqs:[[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Fist'}],[{type:'bab',min:5}]],d:'You can charge your unarmed strike or natural weapon with additional damage potential.'},
  {n:'Greater Power Penetration',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'feat',name:'Power Penetration'}]],d:'Your powers are especially potent at breaking through others’ resistance.'},
  {n:'Greater Power Shot',family:'Power',prereqs:[[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Power Shot'}],[{type:'bab',min:5}]],d:'You can charge your ranged attacks with additional damage potential.'},
  {n:'Greater Power Specialization',family:'Power',prereqs:[[{type:'feat',name:'Power Specialization'}],[{type:'feat',name:'Weapon Focus'}],[{type:'manifesterLevel',min:10}]],d:'You deal more damage with your powers.'},
  {n:'Greater Psionic Weapon',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Psionic Weapon'}],[{type:'bab',min:5}]],d:'You can charge your melee weapon with additional damage potential.'},
  {n:'Hostile Mind',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'CHA',min:15}]],d:'Your mind recoils violently against those who use psionics against you.'},
  {n:'Imbue Arms & Armor',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:5}]],d:'You can create psionic weapons, armor, and shields.'},
  {n:'Imbue Cognizance Crystal',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:3}]],d:'You can create psionic cognizance crystals that store power points.'},
  {n:'Imbue Construct',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'feat',name:'Imbue Arms & Armor'}],[{type:'feat',name:'Imbue Universal Item'}]],d:'You can infuse your power into Constructs to serve you.'},
  {n:'Imbue Dorje',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:5}]],d:'You can create slender crystal wands called dorjes than manifest powers when charges are expended.'},
  {n:'Imbue Power Stone',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:1}]],d:'You can imprint power stones.'},
  {n:'Imbue Psicrown',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:10}]],d:'You can imbue crystalline crowns with multiple psionic effects, known as psicrowns.'},
  {n:'Imbue Ring',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:10}]],d:'You can imbue psionic rings.'},  // (v8.36.1: moved out of d — prose-only rule) (Adam's pairs ruling 2026-09-01: table row "Psionic 1, Manifester Level 10" is authoritative, mirroring every other Enchant/Imbue pair — Wand↔Dorje, Potion↔Tattoo, Staff↔Psicrown; the cross-type body shared with Enchant Ring is a drafting remnant, errata H3.)
  {n:'Imbue Tattoo',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:3}]],d:'You can create imbued tattoos, which store psionic powers within their designs.'},
  {n:'Imbue Universal Item',family:'Power',isItemCreation:true,prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'manifesterLevel',min:3}]],d:'You can create psionic items of a miscellaneous nature.'},
  {n:'Inquisitor',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'WIS',min:13}]],param:{param_kind:'opposite_alignment',param_label:'Opposing Alignment'},d:'You can tell when someone is lying.'},
  {n:'Maximize Power',family:'Power',d:'You can manifest powers to maximum effect.'},
  {n:'Mental Resistance',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'save',save:'will',min:2}]],d:'Your mind is armored against mental intrusion.'},
  {n:'Metamorphic Transfer',family:'Power',prereqs:[[{type:'attr',name:'WIS',min:13}],[{type:'manifesterLevel',min:5}]],takeable:'multiple',d:'You can gain a supernatural ability of a metamorphed form.'},
  {n:'Mind Over Body',family:'Power',prereqs:[[{type:'attr',name:'CON',min:13}]],d:'Your ability damage heals more rapidly.'},
  {n:'Narrow Mind',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'WIS',min:13}]],d:'Your ability to concentrate is as keen as an arrowhead, allowing you to gain your focus even in the most turbulent situations.'},
  {n:'Opportunity Power',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],d:'You can make power-enhanced attacks of opportunity.'},
  {n:'Overchannel',family:'Power',d:'You can expend your life force to strengthen your powers.'},
  {n:'Power Endowment',family:'Power',d:'You can endow your manifestations with more concentrated focus.'},
  {n:'Power Fist',family:'Power',prereqs:[[{type:'attr',name:'STR',min:13}]],d:'You can charge your unarmed strike or natural weapon with additional damage potential.'},
  {n:'Power Penetration',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],d:'Your powers are especially potent, breaking through power resistance more readily than normal.'},
  {n:'Power Reservoir',family:'Power',takeable:'multiple',param:{param_kind:'pool',param_label:'Power Pool',pools:['psionic','super']},d:'You have access to hidden reserves of power. Gain bonus power points equal to your character level (whenever character level increases, so does the pool). If you have multiple power point pools (psionic and super), choose which to apply this to. Special: may be taken twice, once for each power point pool.'},
  {n:'Power Shot',family:'Power',prereqs:[[{type:'feat',name:'Point-Blank Shot'}]],d:'You can charge your ranged attacks with additional damage potential.'},
  {n:'Power Specialization',family:'Power',prereqs:[[{type:'feat',name:'Weapon Focus'}],[{type:'manifesterLevel',min:4}]],d:'You deal more damage with your powers.'},
  {n:'Psionic Affinity',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],bonuses:[{type:'untyped',target:'skill:Psicraft',value:2},{type:'untyped',target:'skill:Use Psionic Device',value:2}],d:'You have a knack for psionic endeavors.'},  // (v8.36.1: moved out of d — prose-only rule) (Table prereq "Psionic 1" was missing from the data — added v8.5.4.)
  {n:'Psionic Body',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],bonuses:[{type:'note',text:'+5 HP per psionic feat owned (computed when spells/powers ship)'}],d:'Your mind reinforces your body.'},  // (v8.36.1: moved out of d — prose-only rule) (H4 superseded by Adam's 2026-09-03 book edit: the class-list prereq was dropped entirely — Psionic Scale 1 scenario only; the p.200 psionic-characters footer still applies via the family gate.)
  {n:'Psionic Charge',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Speed of Thought'}]],d:'You can charge in a crooked line.'},
  {n:'Psionic Dodge',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'DEX',min:13}],[{type:'feat',name:'Dodge'}]],d:'You are psychically sensitive to enemy attacks, making you preternaturally competent at dodging blows.'},
  {n:'Psionic Meditation',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'WIS',min:13}],[{type:'skill',name:'Concentration',min:7}]],d:'You can focus your mind faster than normal, even under duress.'},
  {n:'Psionic Weapon',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'STR',min:13}]],d:'You can charge your melee weapon with additional damage potential.'},
  {n:'Quicken Power',family:'Power',d:'You can manifest a power with a moment’s thought.'},
  {n:'Return Shot',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'feat',name:'Point-Blank Shot'}],[{type:'feat',name:'Power Shot'}],[{type:'feat',name:'Fell Shot'}],[{type:'bab',min:3}]],d:'You can return incoming arrows, as well as crossbow bolts, spears, and other projectile or thrown weapons.'},
  {n:'Second Skin',family:'Power',prereqs:[[{type:'skill',name:'Concentration',min:5}],[{type:'note',text:'Knows the Astral Construct power'}]],d:'You can create an ectoplasmic sheath around your body that moves with you.'},
  {n:'Speed of Thought',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'WIS',min:13}]],d:'The energy of your mind energizes the alacrity of your body.'},
  {n:'Split Ray',family:'Power',prereqs:[[{type:'manifesterLevel',min:5}]],d:'You can affect two targets with a single ray attack.'},
  {n:'Talented',family:'Power',prereqs:[[{type:'feat',name:'Overchannel'}]],d:'You can overchannel your powers with less cost to yourself.'},
  {n:'Unavoidable Strike',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}],[{type:'attr',name:'STR',min:13}],[{type:'feat',name:'Power Fist'}],[{type:'bab',min:5}]],d:'When you focus you can strike your foe with a natural weapon and a greater chance of scoring a critical hit.'},
  {n:'Unconditional Power',family:'Power',prereqs:[[{type:'sixLevel',axis:'psionic',min:1}]],d:'Disabling conditions cannot hold your mind in check.'},
  {n:'Unstable Mutation I',family:'Power',prereqs:[[{type:'sixLevel',axis:'mutation',min:5}],[{type:'feat',name:'Supernatural Mutation'}]],d:'Your powers continue to evolve. Gain +2 MP for the purchase of new super-powers or to upgrade existing ones (Super-Talents count as super-powers). First of five tiered feats; each tier grants additional Mutation Points. (HH p.252)'},
  {n:'Unstable Mutation II',family:'Power',prereqs:[[{type:'sixLevel',axis:'mutation',min:5}],[{type:'feat',name:'Supernatural Mutation'}],[{type:'feat',name:'Unstable Mutation I'}]],d:'Second tier; gain +4 MP. (Cumulative total from tiers I–II: 6 MP.) (HH p.252)'},
  {n:'Unstable Mutation III',family:'Power',prereqs:[[{type:'sixLevel',axis:'mutation',min:5}],[{type:'feat',name:'Supernatural Mutation'}],[{type:'feat',name:'Unstable Mutation II'}]],d:'Third tier; gain +6 MP. (Cumulative total from tiers I–III: 12 MP.) (HH p.252)'},
  {n:'Unstable Mutation IV',family:'Power',prereqs:[[{type:'sixLevel',axis:'mutation',min:5}],[{type:'feat',name:'Supernatural Mutation'}],[{type:'feat',name:'Unstable Mutation III'}]],d:'Fourth tier; gain +8 MP. (Cumulative total from tiers I–IV: 20 MP.) (HH p.252)'},
  {n:'Unstable Mutation V',family:'Power',prereqs:[[{type:'sixLevel',axis:'mutation',min:5}],[{type:'feat',name:'Supernatural Mutation'}],[{type:'feat',name:'Unstable Mutation IV'}]],d:'Fifth and final tier; gain +10 MP. (Cumulative total from all five tiers: 30 MP.) Special (HH p.252): with GM permission, when taking an Unstable Mutation feat the character may trade 10 MP from their accumulated total for +1 Mutant Level (ML). The trade is a flat 10 MP per +1 ML, regardless of which tier is being taken — at tier V this is parity with the +10 MP grant, which is why the option is most meaningfully exercised here. (HH p.252)'},
  {n:'Widen Power',family:'Power',d:'You can increase the area of your powers.'},
  {n:'Wounding Attack',family:'Power',prereqs:[[{type:'bab',min:8}]],d:'Your vicious attacks wound your foe.'},
];

// v8.4.0: 1st-level typed-slot kinds. See §5 of the v8.4.0 plan for the
// full design. Each kind has its eligibility rules and ordering preference;
// the slot-picker prefers more-restricted-first so that loose slots stay
// open for things only they can hold.
//   • base       — universal L1 feat, accepts any general feat
//   • heritage   — L1 Heritage slot, can hold Heritage feats or any general
//   • human      — Human racial bonus slot, can hold Heritage or any general
//   • occupation — restricted to the occupation's bonus_feat_options list
//   • herosGift  — exists when c.heroesGiftChoice === 'feat'; Heritage-eligible
//
// Heritage-eligible slot kinds (those that can hold a Heritage feat) are:
// base, heritage, human, herosGift. The occupation slot is NOT
// Heritage-eligible because its option list is hard-restricted.
const FIRST_LEVEL_SLOT_KINDS = ['base', 'heritage', 'human', 'occupation', 'herosGift'];
const HERITAGE_ELIGIBLE_KINDS = new Set(['base', 'heritage', 'human', 'herosGift']);

// Picking-order preference: more-restricted-first. When a feat could fill
// multiple slots, we fill the most-constrained slot first, preserving the
// looser slots for picks that may need them.
const SLOT_PREFERENCE_ORDER = ['occupation', 'herosGift', 'human', 'heritage', 'base'];
