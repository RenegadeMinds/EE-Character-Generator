// =============================================================================
// js/data/53-domains.js
// DOMAINS
// =============================================================================
//
// WHAT'S IN HERE
//   DOMAINS_DB (the 27 Cleric/Paladin/Saint domains, HH pp.444-451) and
//   DOMAIN_ALIASES.
//
// ORIGINALLY GENERATED: READ THIS BEFORE CHANGING THE DATA
//   These tables were first built by Adam's data-build scripts
//   (domains_substrate/build_domains.py), which live in the private
//   EE-Rulebooks repository. Those scripts are NOT a working build any more:
//   each was written to patch one specific old copy of the generator (the
//   newest targets v8.49.0), and since then the data has been edited directly
//   in the generator. For most catalogs (equipment, armor, gadgets, weapons,
//   item slots, vehicles, magic items) their source JSON files are now OLDER
//   than this file, and some catalogs are missing from the combined block
//   entirely, so re-running them would silently delete newer content. Treat
//   THIS file as the source of truth. The JSON/END marker comments around each
//   table, and the BEGIN/END substrate banner lines, are kept unchanged so a
//   future script can still find the tables.
//
// KEY NAMES (so you can search for them)
//   tables/objects: DOMAINS_DB, DOMAIN_ALIASES
//
// LOAD ORDER
//   File 53 of 68. index.html loads it after
//   js/app/52-energy-immunity-and-spell-lists.js and before
//   js/app/54-powers-repertoire.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 44554-46031 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 44554-46031; unchanged below this line ----
// ============================================================================
// v8.5.4: DOMAINS_DB — the 27 Cleric/Paladin/Saint domains (HH pp.444-451),
// extracted via domains_substrate/build_domains.py. Each: {name, grantedPower,
// prerequisite?, spells:{'1'..'9':{name,summary,...}}, footnotes[]}.
// DOMAIN_ALIASES maps the domain lists' rulebook spell names onto the
// consolidated SPELLS_DB entry names (resolved = mechanical; proposed = needs
// Adam's ruling; missing = no SPELLS_DB entry exists — see the errata file
// section G and E_E_missing_spells_powers_crossref.md).
// NOTE: spell ACCESS for chosen domains resolves through the domain tokens
// already present in SPELLS_DB levels[] (e.g. {cls:'Water',lvl:7}); this
// catalog drives the domain PICKERS, granted-power display, and the 1-9 list
// display (via the aliases where names diverge).
// ============================================================================
const DOMAINS_DB = /*<<JSON:DOMAINS_DB>>*/ [
 {
  "name": "Air",
  "grantedPower": "Turn or destroy earth creatures as a good cleric turns undead. Rebuke, command, or bolster air creatures as an evil cleric rebukes undead. Use these abilities a total number of times per day equal to 3 + your Charisma modifier. This granted power is a supernatural ability.",
  "spells": {
   "1": {
    "name": "Obscuring Mist",
    "summary": "Fog surrounds you."
   },
   "2": {
    "name": "Wind Wall",
    "summary": "Deflects arrows, smaller creatures, and gases."
   },
   "3": {
    "name": "Gaseous Form",
    "summary": "Subject becomes insubstantial and can fly slowly."
   },
   "4": {
    "name": "Overland Flight",
    "summary": "You fly at a speed of 40 ft. and can hustle over long distances."
   },
   "5": {
    "name": "Control Winds",
    "summary": "Change wind direction and speed."
   },
   "6": {
    "name": "Chain Lightning",
    "summary": "1d6/level damage; 1 secondary bolt/level each deals half damage."
   },
   "7": {
    "name": "Control Weather",
    "summary": "Changes weather in local area."
   },
   "8": {
    "name": "Whirlwind",
    "summary": "Cyclone deals damage and can pick up creatures."
   },
   "9": {
    "name": "Summon Nature’s Ally IX",
    "summary": "Summons air-based creatures and/or elementals.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as an air spell only."
  ]
 },
 {
  "name": "Animal",
  "grantedPower": "You can use Speak with Animals once per day as a spell-like ability. Add Knowledge (nature) to your list of cleric class skills.",
  "spells": {
   "1": {
    "name": "Calm Animals",
    "summary": "Calms (2d4 + level) HD of animals."
   },
   "2": {
    "name": "Hold Animal",
    "summary": "Paralyzes one animal for 1 round/level."
   },
   "3": {
    "name": "Dominate Animal",
    "summary": "Subject animal obeys silent mental commands."
   },
   "4": {
    "name": "Summon Nature’s Ally IV",
    "summary": "Calls creature to fight.",
    "footnoteRef": true
   },
   "5": {
    "name": "Commune with Nature",
    "summary": "Learn about terrain for 1 mile/level."
   },
   "6": {
    "name": "Antilife Shell",
    "summary": "10-ft. field hedges out living creatures."
   },
   "7": {
    "name": "Creeping Doom",
    "summary": "Summon a swarm of vermin to attack your enemies."
   },
   "8": {
    "name": "Summon Nature’s Ally VIII",
    "summary": "Calls creature to fight.",
    "footnoteRef": true
   },
   "9": {
    "name": "Shapechange",
    "summary": "Transforms you into any creature, and change forms once per round.",
    "components": "F"
   }
  },
  "footnotes": [
   "Can only summon animals."
  ]
 },
 {
  "name": "Artifice",
  "grantedPower": "Gain +4 bonus on Craft checks. The character casts conjuration (creation) spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Control Object",
    "summary": "You can enchant objects to move as you wish."
   },
   "2": {
    "name": "Wood Shape",
    "summary": "You can sculpt wood with your hands."
   },
   "3": {
    "name": "Stone Shape",
    "summary": "You can sculpt stone with your hands."
   },
   "4": {
    "name": "Creation, Minor",
    "summary": "You can create a simple substance for a short time out of thin air."
   },
   "5": {
    "name": "Fabricate",
    "summary": "You can quickly create more complex objects out of base resources."
   },
   "6": {
    "name": "Creation, Major",
    "summary": "You can create more complex substances for a longer period of time."
   },
   "7": {
    "name": "Hardening",
    "summary": "You can magically reinforce the hardness of an object."
   },
   "8": {
    "name": "Creation, True",
    "summary": "You can permanently create resources."
   },
   "9": {
    "name": "Prismatic Sphere",
    "summary": "You create a near-impenetrable multi-hued force field of varying effects."
   }
  },
  "footnotes": []
 },
 {
  "name": "Chaos",
  "grantedPower": "You cast chaos spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Protection from Law",
    "summary": "+2 to AC and saves, counter mind control, hedge out elementals and outsiders."
   },
   "2": {
    "name": "Shatter",
    "summary": "Sonic vibration damages objects or crystalline creatures."
   },
   "3": {
    "name": "Magic Circle against Law",
    "summary": "As protection spells, but 10-ft. radius and 10 min./level."
   },
   "4": {
    "name": "Chaos Hammer",
    "summary": "Damages and staggers lawful creatures."
   },
   "5": {
    "name": "Dispel Law",
    "summary": "+4 bonus against attacks by lawful creatures."
   },
   "6": {
    "name": "Animate Objects",
    "summary": "Objects attack your foes."
   },
   "7": {
    "name": "Word of Chaos",
    "summary": "Kills, confuses, stuns, or deafens nonchaotic subjects."
   },
   "8": {
    "name": "Cloak of Chaos",
    "summary": "+4 to AC, +4 resistance, SR 25 against lawful spells.",
    "components": "F"
   },
   "9": {
    "name": "Summon Monster IX",
    "summary": "Calls extraplanar creature to fight for you.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as a chaos spell only."
  ]
 },
 {
  "name": "Death",
  "grantedPower": "You may use a death touch once per day. Your death touch is a supernatural ability that produces a death effect. You must succeed on a melee touch attack against a living creature (using the rules for touch spells). When you touch, roll 1d6 per cleric level you possess. If the total at least equals the creature’s current hit points, it dies (no save).",
  "spells": {
   "1": {
    "name": "Cause Fear",
    "summary": "One creature of 5 HD or less flees for 1d4 rounds."
   },
   "2": {
    "name": "Death Knell",
    "summary": "Kill dying creature and gain 1d8 temporary hp, +2 to Str, and +1 caster level."
   },
   "3": {
    "name": "Animate Dead",
    "summary": "Creates undead skeletons and zombies.",
    "components": "M"
   },
   "4": {
    "name": "Death Ward",
    "summary": "Grants immunity to death spells and negative energy effects."
   },
   "5": {
    "name": "Slay Living",
    "summary": "Touch attack kills subject."
   },
   "6": {
    "name": "Create Undead",
    "summary": "Create ghouls, ghasts, mummies, or mohrgs.",
    "components": "M"
   },
   "7": {
    "name": "Destruction",
    "summary": "Kills subject and destroys remains.",
    "components": "F"
   },
   "8": {
    "name": "Create Greater Undead",
    "summary": "Create shadows, wraiths, spectres, r devourers.",
    "components": "M"
   },
   "9": {
    "name": "Wail of the Banshee",
    "summary": "Kills one creature/level."
   }
  },
  "footnotes": []
 },
 {
  "name": "Destruction",
  "grantedPower": "You gain the smite power, the supernatural ability to make a single melee attack with a +4 bonus on attack rolls and a bonus on damage rolls equal to your cleric level (if you hit). You must declare the smite before making the attack. This ability is usable once per day.",
  "spells": {
   "1": {
    "name": "Inflict Wounds (Light)",
    "summary": "Touch attack, 1d8 damage +1/level (max +5)."
   },
   "2": {
    "name": "Shatter",
    "summary": "Sonic vibration damages objects or crystalline creatures."
   },
   "3": {
    "name": "Contagion",
    "summary": "Infects subject with chosen disease."
   },
   "4": {
    "name": "Inflict Wounds (Critical)",
    "summary": "Touch attack, 4d8 damage +1/level (max +20)."
   },
   "5": {
    "name": "Inflict Wounds, Mass (Light)",
    "summary": "Deals 1d8 damage +1/level to any creatures."
   },
   "6": {
    "name": "Harm",
    "summary": "Deals 10 points/level damage to target."
   },
   "7": {
    "name": "Disintegrate",
    "summary": "Makes one creature or object vanish."
   },
   "8": {
    "name": "Earthquake",
    "summary": "Intense tremor shakes 80-ft.-radius."
   },
   "9": {
    "name": "Implosion",
    "summary": "Kills one creature/round."
   }
  },
  "footnotes": []
 },
 {
  "name": "Earth",
  "grantedPower": "Turn or destroy air creatures as a good cleric turns undead. Rebuke, command, or bolster earth creatures as an evil cleric rebukes undead. Use these abilities a total number of times per day equal to 3 + your Charisma modifier. This granted power is a supernatural ability.",
  "spells": {
   "1": {
    "name": "Grip of Iron",
    "summary": "Your iron grip gives +4 bonus on grapple checks."
   },
   "2": {
    "name": "Soften Earth and Stone",
    "summary": "Turns stone to clay or dirt to sand or mud."
   },
   "3": {
    "name": "Stone Shape",
    "summary": "Sculpts stone into any shape."
   },
   "4": {
    "name": "Spike Stones",
    "summary": "Creatures in area take 1d8 damage, may be lowed."
   },
   "5": {
    "name": "Wall of Stone",
    "summary": "Creates a stone wall that can be shaped."
   },
   "6": {
    "name": "Stoneskin",
    "summary": "Ignore 10 points of damage per attack.",
    "components": "M"
   },
   "7": {
    "name": "Earthquake",
    "summary": "Intense tremor shakes 80-ft.-radius."
   },
   "8": {
    "name": "Iron Body",
    "summary": "Your body becomes living iron."
   },
   "9": {
    "name": "Summon Nature’s Ally IX",
    "summary": "Summons earth-based creatures and/or elementals.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as an earth spell only."
  ]
 },
 {
  "name": "Evil",
  "grantedPower": "You cast evil spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Protection from Good",
    "summary": "+2 to AC and saves, counter mind control, hedge out elementals and outsiders."
   },
   "2": {
    "name": "Desecrate",
    "summary": "Fills area with negative energy, making undead stronger.",
    "components": "M"
   },
   "3": {
    "name": "Magic Circle against Good",
    "summary": "As protection spells, but 10-ft. radius and 10 min./level."
   },
   "4": {
    "name": "Unholy Blight",
    "summary": "Damages and sickens good creatures."
   },
   "5": {
    "name": "Dispel Good",
    "summary": "+4 bonus against attacks by good creatures."
   },
   "6": {
    "name": "Create Undead",
    "summary": "Create ghouls, ghasts, mummies, or mohrgs.",
    "components": "M"
   },
   "7": {
    "name": "Blasphemy",
    "summary": "Kills, paralyzes, weakens, or dazes nonevil subjects."
   },
   "8": {
    "name": "Unholy Aura",
    "summary": "+4 to AC, +4 resistance, SR 25 against good spells.",
    "components": "F"
   },
   "9": {
    "name": "Summon Monster IX",
    "summary": "Calls extraplanar creature to fight for you.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as an evil spell only."
  ]
 },
 {
  "name": "Fire",
  "grantedPower": "Turn or destroy water creatures as a good cleric turns undead. Rebuke, command, or bolster fire creatures as an evil cleric rebukes undead. Use these abilities a total number of times per day equal to 3 + your Charisma modifier. This granted power is a supernatural ability.",
  "spells": {
   "1": {
    "name": "Burning Hands",
    "summary": "1d4/level fire damage (max 5d4)."
   },
   "2": {
    "name": "Produce Flame",
    "summary": "1d6 damage +1/ level, touch or thrown."
   },
   "3": {
    "name": "Resist Energy",
    "summary": "Ignores 10 (or more) points of damage/attack from specified energy type.",
    "footnoteRef": true
   },
   "4": {
    "name": "Wall of Fire",
    "summary": "Deals 2d4 fire damage out to 10 ft. and 1d4 out to 20 ft. Passing through wall deals 2d6 damage +1/level."
   },
   "5": {
    "name": "Fire Shield",
    "summary": "Creatures attacking you take fire damage; you’re protected from heat or cold."
   },
   "6": {
    "name": "Fire Seeds",
    "summary": "Create fiery grenades and bombs."
   },
   "7": {
    "name": "Fire Storm",
    "summary": "Deals 1d6/level fire damage."
   },
   "8": {
    "name": "Incendiary Cloud",
    "summary": "Cloud deals 4d6 fire damage/round."
   },
   "9": {
    "name": "Summon Nature’s Ally IX",
    "summary": "Summons fire-based creatures and/or elementals.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Resist cold or fire only.",
   "Cast as a fire spell only."
  ]
 },
 {
  "name": "Good",
  "grantedPower": "You cast good spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Protection from Evil",
    "summary": "+2 to AC and saves, counter mind control, hedge out elementals and outsiders."
   },
   "2": {
    "name": "Aid",
    "summary": "+1 on attack rolls, +1 on saves against fear, 1d8 temporary hp +1/level (max +10)."
   },
   "3": {
    "name": "Magic Circle against Evil",
    "summary": "As protection spells, but 10-ft. radius and 10 min./level."
   },
   "4": {
    "name": "Holy Smite",
    "summary": "Damages and blinds evil creatures."
   },
   "5": {
    "name": "Dispel Evil",
    "summary": "+4 bonus against attacks by evil creatures."
   },
   "6": {
    "name": "Blade Barrier",
    "summary": "Wall of blades deals 1d6/level damage."
   },
   "7": {
    "name": "Holy Word",
    "summary": "Kills, paralyzes, slows, or deafens nongood subjects.",
    "components": "F"
   },
   "8": {
    "name": "Holy Aura",
    "summary": "+4 to AC, +4 resistance, and SR 25 against evil spells."
   },
   "9": {
    "name": "Summon Monster IX",
    "summary": "Calls extraplanar creature to fight for you.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as a good spell only."
  ]
 },
 {
  "name": "Hacking",
  "grantedPower": "You get a +2 insight bonus to Computer Use and Decipher Script checks.",
  "spells": {
   "1": {
    "name": "Mask Metal",
    "summary": "Hide metal items from metal detectors."
   },
   "2": {
    "name": "Burglar’s Buddy",
    "summary": "Alarms aren’t activated by your passage."
   },
   "3": {
    "name": "Dataread",
    "summary": "You can access data records directly."
   },
   "4": {
    "name": "Wire Walk",
    "summary": "You can teleport via physical phone line."
   },
   "5": {
    "name": "Signal Feed",
    "summary": "You determine the signal feed for one camera or sensor system."
   },
   "6": {
    "name": "Instant Connectivity",
    "summary": "You can teleport via a computer connection."
   },
   "7": {
    "name": "Holographic Image",
    "summary": "Project an illusory double."
   },
   "8": {
    "name": "Hyperalgorithm",
    "summary": "You can use supercomputer intelligence to make a deduction."
   },
   "9": {
    "name": "Virtual Reality",
    "summary": "You create an immersive video-game for target to be distracted in, forever.",
    "components": "A"
   }
  },
  "footnotes": [],
  "prerequisite": "Tech Scale 5 or greater scenario."
 },
 {
  "name": "Healing",
  "grantedPower": "You cast healing spells at +2 caster level.",
  "spells": {
   "1": {
    "name": "Cure Wounds (Moderate)",
    "summary": "Cures 2d8 damage +1/level (max +10)."
   },
   "2": {
    "name": "Cure Wounds (Serious)",
    "summary": "Cures 3d8 damage +1/level (max +15)."
   },
   "3": {
    "name": "Cure Wounds (Critical)",
    "summary": "Cures 4d8 damage +1/level (max +20)."
   },
   "4": {
    "name": "Revivify",
    "summary": "Bring a recently-dead being back to life."
   },
   "5": {
    "name": "Cure Wounds, Mass (Moderate)",
    "summary": "Cures 2d8 damage +1/level (max +30) for many creatures."
   },
   "6": {
    "name": "Heal",
    "summary": "Cures 10 points/level of damage, all diseases and mental conditions."
   },
   "7": {
    "name": "Regenerate",
    "summary": "Subject’s severed limbs grow back."
   },
   "8": {
    "name": "Cure Wounds, Mass (Critical)",
    "summary": "Cures 4d8 damage +1/level (max +40) for many creatures."
   },
   "9": {
    "name": "Heal, Mass",
    "summary": "As heal, but with several subjects."
   }
  },
  "footnotes": []
 },
 {
  "name": "Knowledge",
  "grantedPower": "Add all Knowledge skills to your list of cleric class skills. You cast divination spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Detect Secret Doors",
    "summary": "Reveals hidden doors within 60 ft."
   },
   "2": {
    "name": "Zone of Truth",
    "summary": "Creatures within the area of effect must speak the truth."
   },
   "3": {
    "name": "Clairaudience/Clairvoyance",
    "summary": "Hear or see at a distance for 1 min./level."
   },
   "4": {
    "name": "Divination",
    "summary": "Provides useful advice for specific proposed actions.",
    "components": "M"
   },
   "5": {
    "name": "True Seeing",
    "summary": "Lets you see things as they really are.",
    "components": "M"
   },
   "6": {
    "name": "Find the Path",
    "summary": "Shows most direct way to a location."
   },
   "7": {
    "name": "Legend Lore",
    "summary": "Lets you learn tales about a person, place, or thing.",
    "components": "MF"
   },
   "8": {
    "name": "Discern Location",
    "summary": "Reveals exact location of creature or object."
   },
   "9": {
    "name": "Foresight",
    "summary": "“Sixth sense” warns of impending danger."
   }
  },
  "footnotes": []
 },
 {
  "name": "Law",
  "grantedPower": "You cast law spells at +1 caster level.",
  "spells": {
   "1": {
    "name": "Protection from Chaos",
    "summary": "+2 to AC and saves, counter mind control, hedge out elementals and outsiders."
   },
   "2": {
    "name": "Calm Emotions",
    "summary": "Calms creatures, negating emotion effects."
   },
   "3": {
    "name": "Magic Circle against Chaos",
    "summary": "As Protection spells, but 10-ft. radius and 10 min./level."
   },
   "4": {
    "name": "Order’s Wrath",
    "summary": "Damages and dazes chaotic creatures."
   },
   "5": {
    "name": "Dispel Chaos",
    "summary": "+4 bonus against attacks by chaotic creatures."
   },
   "6": {
    "name": "Hold Monster",
    "summary": "As Hold Person, but any creature."
   },
   "7": {
    "name": "Dictum",
    "summary": "Kills, paralyzes, slows, or deafens nonlawful subjects."
   },
   "8": {
    "name": "Shield of Law",
    "summary": "+4 to AC, +4 resistance, and SR 25 against chaotic spells.",
    "components": "F"
   },
   "9": {
    "name": "Summon Monster IX",
    "summary": "Calls extraplanar creature to fight for you.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as a law spell only."
  ]
 },
 {
  "name": "Luck",
  "grantedPower": "You gain the power of good fortune, which is usable once per day. This extraordinary ability allows you to reroll one roll that you have just made before the DM declares whether the roll results in success or failure. You must take the result of the reroll, even if it’s worse than the original roll.",
  "spells": {
   "1": {
    "name": "Entropic Shield",
    "summary": "Ranged attacks against you have 20% miss chance."
   },
   "2": {
    "name": "Aid",
    "summary": "+1 on attack rolls, +1 against fear, 1d8 temporary hp +1/level (max +10)."
   },
   "3": {
    "name": "Protection from Energy",
    "summary": "Absorb 12 points/level of damage from one kind of energy."
   },
   "4": {
    "name": "Freedom of Movement",
    "summary": "Subject moves normally despite impediments."
   },
   "5": {
    "name": "Synchronicity",
    "summary": "You have a tendency of being in the right place at the right time."
   },
   "6": {
    "name": "Mislead",
    "summary": "Turns you invisible and creates illusory double."
   },
   "7": {
    "name": "Spell Turning",
    "summary": "Reflect 1d4+6 spell levels back at caster."
   },
   "8": {
    "name": "Moment of Prescience",
    "summary": "You gain insight bonus on single attack roll, check, or save."
   },
   "9": {
    "name": "Miracle",
    "summary": "Requests a deity’s intercession.",
    "components": "X"
   }
  },
  "footnotes": []
 },
 {
  "name": "Magic",
  "grantedPower": "Use scrolls, wands, and other devices with spell completion or spell trigger activation as a wizard of one-half your cleric level (at least 1st level). For the purpose of using a scroll or other magic device, if you are also a wizard, actual wizard levels and these effective wizard levels stack.",
  "spells": {
   "1": {
    "name": "Magic Aura",
    "summary": "Alters object’s magic aura."
   },
   "2": {
    "name": "Identify",
    "summary": "Determines properties of magic item."
   },
   "3": {
    "name": "Dispel Magic & Psionics",
    "summary": "Cancels magical spells, psionic powers, and associated effects."
   },
   "4": {
    "name": "Arcane Sight",
    "summary": "Magical auras become visible to you."
   },
   "5": {
    "name": "Spell Resistance",
    "summary": "Subject gains SR 12 + level."
   },
   "6": {
    "name": "Null Power Field",
    "summary": "Negates magic and psionics within 10 ft."
   },
   "7": {
    "name": "Spell Turning",
    "summary": "Reflect 1d4+6 spell levels back at caster."
   },
   "8": {
    "name": "Protection from Spells and Powers",
    "summary": "Confers +8 resistance bonus.",
    "components": "MF"
   },
   "9": {
    "name": "Disjunction",
    "summary": "Dispels magic, disenchants magic items. (Renamed from Mage’s Disjunction; full entry added in the 2026-09-03 HH.)"
   }
  },
  "footnotes": []
 },
 {
  "name": "Mind",
  "grantedPower": "Gain a +2 bonus on Bluff, Diplomacy, and Sense Motive checks. Gain a +2 bonus on Will saves against enchantment spells and effects.",
  "spells": {
   "1": {
    "name": "Comprehend Languages",
    "summary": "You understand all spoken and written languages."
   },
   "2": {
    "name": "Detect Thoughts",
    "summary": "Allows “listening” to surface thoughts."
   },
   "3": {
    "name": "Telepathic Bond",
    "summary": "Link with subject within 30 ft. for 10 min./level."
   },
   "4": {
    "name": "Discern Lies",
    "summary": "Reveals deliberate falsehoods."
   },
   "5": {
    "name": "Mental Pinnacle",
    "summary": "Temporarily activate psionic potential."
   },
   "6": {
    "name": "Probe Thoughts",
    "summary": "Read subject’s memories, one question/ round."
   },
   "7": {
    "name": "Brain Spider",
    "summary": "Eavesdrop on thoughts of up to eight other creatures."
   },
   "8": {
    "name": "Mind Blank",
    "summary": "Subject is immune to mental/emotional magic and scrying."
   },
   "9": {
    "name": "Weird",
    "summary": "Fearful illusion affects all within 30 ft., either killing or dealing 3d6 damage."
   }
  },
  "footnotes": []
 },
 {
  "name": "Plant",
  "grantedPower": "Rebuke or command plant creatures as an evil cleric rebukes or commands undead. Use this ability a total number of times per day equal to 3 + your Charisma modifier. This granted power is a supernatural ability.  Add Knowledge (nature) to your list of cleric class skills.",
  "spells": {
   "1": {
    "name": "Entangle",
    "summary": "Plants entangle everyone in 40-ft.-radius."
   },
   "2": {
    "name": "Barkskin",
    "summary": "Grants +2 (or higher) enhancement to natural armor."
   },
   "3": {
    "name": "Plant Growth",
    "summary": "Grows vegetation, improves crops."
   },
   "4": {
    "name": "Command Plants",
    "summary": "Sway the actions of one or more plant creatures."
   },
   "5": {
    "name": "Wall of Thorns",
    "summary": "Thorns damage anyone who tries to pass."
   },
   "6": {
    "name": "Repel Wood",
    "summary": "Pushes away wooden objects."
   },
   "7": {
    "name": "Animate Plants",
    "summary": "One or more trees animate and fight for you."
   },
   "8": {
    "name": "Control Plants",
    "summary": "Control actions of one or more plant creatures."
   },
   "9": {
    "name": "Oak Body",
    "summary": "Your body changes into solid oak."
   }
  },
  "footnotes": []
 },
 {
  "name": "Protection",
  "grantedPower": "You can generate a protective ward as a supernatural ability. Grant someone you touch a resistance bonus equal to your cleric level on their next saving throw. Activating this power is a standard action. The protective ward is an abjuration effect with a duration of 1 hour that is usable once per day.",
  "spells": {
   "1": {
    "name": "Sanctuary",
    "summary": "Opponents can’t attack you, and you can’t attack."
   },
   "2": {
    "name": "Shield Other",
    "summary": "You take half of subject’s damage.",
    "components": "F"
   },
   "3": {
    "name": "Protection from Energy",
    "summary": "Absorb 12 points/level of damage from one kind of energy."
   },
   "4": {
    "name": "Spell / Power Immunity",
    "summary": "Subject is immune to one spell or psionic power per four levels."
   },
   "5": {
    "name": "Spell Resistance",
    "summary": "Subject gains SR 12 + level."
   },
   "6": {
    "name": "Null Power Field",
    "summary": "Negates magic within 10 ft."
   },
   "7": {
    "name": "Repulsion Field",
    "summary": "Creatures can’t approach you."
   },
   "8": {
    "name": "Mind Blank",
    "summary": "Subject is immune to mental/emotional magic and scrying."
   },
   "9": {
    "name": "Prismatic Sphere",
    "summary": "As Prismatic Wall, but it surrounds on all sides."
   }
  },
  "footnotes": []
 },
 {
  "name": "Strength",
  "grantedPower": "You can perform a feat of strength as a supernatural ability. You gain an enhancement bonus to Strength equal to your cleric level. Activating the power is a free action, the power lasts 1 round, and it is usable once per day.",
  "spells": {
   "1": {
    "name": "Enlarge Person",
    "summary": "Humanoid creature doubles size."
   },
   "2": {
    "name": "Bull’s Strength",
    "summary": "Subject gains +4 to Str for 1 min./level."
   },
   "3": {
    "name": "Strength of the Enemy",
    "summary": "Siphon away your enemy’s strength and grow stronger."
   },
   "4": {
    "name": "Spell / Power Immunity",
    "summary": "Subject is immune to one spell or psionic power per four levels."
   },
   "5": {
    "name": "Righteous / Riotous Might",
    "summary": "Your size increases, and you gain combat bonuses."
   },
   "6": {
    "name": "Stoneskin",
    "summary": "Ignore 10 points of damage per attack.",
    "components": "M"
   },
   "7": {
    "name": "Grasping Hand of Force",
    "summary": "Large hand provides cover, pushes, or grapples."
   },
   "8": {
    "name": "Clenched Fist of Force",
    "summary": "Large hand provides cover, pushes, or attacks your foes."
   },
   "9": {
    "name": "Crushing Hand of Force",
    "summary": "Large hand provides cover, pushes, or crushes your foes."
   }
  },
  "footnotes": []
 },
 {
  "name": "Sun",
  "grantedPower": "Once per day, you can perform a greater turning against undead in place of a regular turning. The greater turning is like a normal turning except that the undead creatures that would be turned are destroyed instead.",
  "spells": {
   "1": {
    "name": "Endure Elements",
    "summary": "Exist comfortably in hot or cold environments."
   },
   "2": {
    "name": "Heat Metal",
    "summary": "Make metal so hot it damages those who touch it."
   },
   "3": {
    "name": "Searing Light",
    "summary": "Ray deals 1d8/two levels, more against undead."
   },
   "4": {
    "name": "Fire Shield",
    "summary": "Creatures attacking you take fire damage; you’re protected from heat or cold."
   },
   "5": {
    "name": "Flame Strike",
    "summary": "Smite foes with divine fire (1d6/level damage)."
   },
   "6": {
    "name": "Fire Seeds",
    "summary": "Create fiery grenades and bombs."
   },
   "7": {
    "name": "Sunbeam",
    "summary": "Beam blinds and deals 4d6 damage."
   },
   "8": {
    "name": "Sunburst",
    "summary": "Blinds all within 10 ft., deals 6d6 damage."
   },
   "9": {
    "name": "Prismatic Sphere",
    "summary": "As Prismatic Wall, but it surrounds on all sides."
   }
  },
  "footnotes": []
 },
 {
  "name": "Technology",
  "grantedPower": "You get a +2 insight bonus to Disable Device, and Repair checks.",
  "spells": {
   "1": {
    "name": "Power Device",
    "summary": "You can provide power to a device."
   },
   "2": {
    "name": "Make Repairs",
    "summary": "You repair 3d8+1/level damage to an object."
   },
   "3": {
    "name": "Dataread",
    "summary": "You can access data records directly."
   },
   "4": {
    "name": "Shutdown",
    "summary": "You can deactivate all devices in a small area."
   },
   "5": {
    "name": "Recharge",
    "summary": "You can use an electrical power source to alleviate negative conditions."
   },
   "6": {
    "name": "Instant Connectivity",
    "summary": "You can teleport via a computer connection."
   },
   "7": {
    "name": "Build Database",
    "summary": "Use online resources to find the answers you seek."
   },
   "8": {
    "name": "Dimensional Lock",
    "summary": "You use an interdimensional jamming signal to prevent planar passage."
   },
   "9": {
    "name": "Hyperalgorithm",
    "summary": "You can use supercomputer intelligence to make a deduction."
   }
  },
  "footnotes": [],
  "prerequisite": "Tech Scale 5 or greater scenario."
 },
 {
  "name": "Travel",
  "grantedPower": "For a total time per day of 1 round per cleric level you possess, you can act normally regardless of magical effects that impede movement as if you were affected by the spell Freedom of Movement. This effect occurs automatically as soon as it applies, lasts until it runs out or is no longer needed, and can operate multiple times per day (up to the total daily limit of rounds).  This granted power is a supernatural ability. Also, add Survival to your list of cleric class skills.",
  "spells": {
   "1": {
    "name": "Longstrider",
    "summary": "Increases your speed."
   },
   "2": {
    "name": "Locate Object",
    "summary": "Senses direction toward object (specific or type)."
   },
   "3": {
    "name": "Fly",
    "summary": "Subject flies at speed of 60 ft."
   },
   "4": {
    "name": "Dimension Door",
    "summary": "Teleports you short distance."
   },
   "5": {
    "name": "Teleport",
    "summary": "Instantly transports you as far as 100 miles/level."
   },
   "6": {
    "name": "Find the Path",
    "summary": "Shows most direct way to a location."
   },
   "7": {
    "name": "Teleport, Greater",
    "summary": "As Teleport, but no range limit and no off-target arrival."
   },
   "8": {
    "name": "Phase Step",
    "summary": "Pass through wood or stone."
   },
   "9": {
    "name": "Astral Projection",
    "summary": "Projects you and companions onto Astral Plane.",
    "components": "M"
   }
  },
  "footnotes": []
 },
 {
  "name": "Trickery",
  "grantedPower": "Add Bluff, Disguise, and Hide to your list of cleric class skills.",
  "spells": {
   "1": {
    "name": "Disguise Self",
    "summary": "Disguise own appearance."
   },
   "2": {
    "name": "Invisibility",
    "summary": "Subject invisible 1 min./level or until it attacks."
   },
   "3": {
    "name": "Nondetection",
    "summary": "Hides subject from divination, scrying.",
    "components": "M"
   },
   "4": {
    "name": "Confusion",
    "summary": "Subjects behave oddly for 1 round/level."
   },
   "5": {
    "name": "Seeming",
    "summary": "Changes appearance of one person per two levels."
   },
   "6": {
    "name": "Mislead",
    "summary": "Turns you invisible and creates illusory double."
   },
   "7": {
    "name": "Screen",
    "summary": "Illusion hides area from vision, scrying."
   },
   "8": {
    "name": "Polymorph Any Object",
    "summary": "Changes any subject into anything else."
   },
   "9": {
    "name": "Time Stop",
    "summary": "You act freely for 1d4+1 rounds."
   }
  },
  "footnotes": []
 },
 {
  "name": "War",
  "grantedPower": "Free Martial Weapon Proficiency with deity’s favored weapon (if necessary) and Weapon Focus with the deity’s favored weapon.",
  "spells": {
   "1": {
    "name": "Magic Weapon",
    "summary": "Weapon gains +1 bonus."
   },
   "2": {
    "name": "Spiritual Weapon",
    "summary": "Magical weapon attacks on its own."
   },
   "3": {
    "name": "Whitefire",
    "summary": "You create a blast of primordial energy doing 5d4 untyped energy damage."
   },
   "4": {
    "name": "Divine Power",
    "summary": "You gain attack bonus, +6 to Str, and 1 hp/level."
   },
   "5": {
    "name": "Flame Strike",
    "summary": "Smite foes with divine fire (1d6/level damage)."
   },
   "6": {
    "name": "Blade Barrier",
    "summary": "Wall of blades deals 1d6/level damage."
   },
   "7": {
    "name": "Power Word: Blind",
    "summary": "Blinds creature with 200 hp or less."
   },
   "8": {
    "name": "Power Word: Stun",
    "summary": "Stuns creature with 150 hp or less."
   },
   "9": {
    "name": "Power Word: Kill",
    "summary": "Kills creature with 100 hp or less."
   }
  },
  "footnotes": []
 },
 {
  "name": "Water",
  "grantedPower": "Turn or destroy fire creatures as a good cleric turns undead. Rebuke, command, or bolster water creatures as an evil cleric rebukes undead. Use these abilities a total number of times per day equal to 3 + your Charisma modifier. This granted power is a supernatural ability.",
  "spells": {
   "1": {
    "name": "Obscuring Mist",
    "summary": "Fog surrounds you."
   },
   "2": {
    "name": "Fog Cloud",
    "summary": "Fog obscures vision."
   },
   "3": {
    "name": "Water Breathing",
    "summary": "Subjects can breathe underwater."
   },
   "4": {
    "name": "Control Water",
    "summary": "Raises or lowers bodies of water."
   },
   "5": {
    "name": "Ice Storm",
    "summary": "Hail deals 5d6 damage in cylinder 40 ft. across."
   },
   "6": {
    "name": "Cone of Cold",
    "summary": "1d6/level cold damage."
   },
   "7": {
    "name": "Acid Fog",
    "summary": "Fog deals acid damage."
   },
   "8": {
    "name": "Horrid Wilting",
    "summary": "Deals 1d6/level damage within 30 ft."
   },
   "9": {
    "name": "Summon Nature’s Ally IX",
    "summary": "Summons water-based creatures and/or elementals.",
    "footnoteRef": true
   }
  },
  "footnotes": [
   "Cast as a water spell only."
  ]
 },
 {
  "name": "Weather",
  "grantedPower": "Survival is a class skill.",
  "spells": {
   "1": {
    "name": "Obscuring Mist",
    "summary": "You create a mist to block vision."
   },
   "2": {
    "name": "Fog Cloud",
    "summary": "You create a dense cloud of fog impossible to see through and slow to clear."
   },
   "3": {
    "name": "Call Lightning",
    "summary": "You can summon down a bolt of lightning, 3d6 damage (3d10 in a storm), 1/rd."
   },
   "4": {
    "name": "Sleet Storm",
    "summary": "Summon freezing rain to cover area in a thin sheet of ice."
   },
   "5": {
    "name": "Call Lightning Storm",
    "summary": "Summon down a bolt of lightning, 5d6 damage (5d10 in a storm), 1/rd."
   },
   "6": {
    "name": "Ice Storm",
    "summary": "Summon a vicious hailstorm that inflicts cold and bludgeoning damage."
   },
   "7": {
    "name": "Control Weather",
    "summary": "Change local weather as desired."
   },
   "8": {
    "name": "Sunbeam",
    "summary": "Beam blinds and deals 4d6 damage."
   },
   "9": {
    "name": "Tornado Blast",
    "summary": "Conjure a miniature tornado directed by you."
   }
  },
  "footnotes": []
 }
];

const DOMAIN_ALIASES = /*<<JSON:DOMAIN_ALIASES>>*/ {
 "resolved": {
  "Summon Nature’s Ally IV": {
   "name": "Summon Nature’s Ally (I-IX)",
   "param": "IV"
  },
  "Summon Nature’s Ally VIII": {
   "name": "Summon Nature’s Ally (I-IX)",
   "param": "VIII"
  },
  "Summon Nature’s Ally IX": {
   "name": "Summon Nature’s Ally (I-IX)",
   "param": "IX"
  },
  "Summon Monster IX": {
   "name": "Summon Monster (I-IX)",
   "param": "IX"
  },
  "Protection from Law": {
   "name": "Protection from [Alignment]",
   "param": "Law"
  },
  "Protection from Chaos": {
   "name": "Protection from [Alignment]",
   "param": "Chaos"
  },
  "Protection from Good": {
   "name": "Protection from [Alignment]",
   "param": "Good"
  },
  "Protection from Evil": {
   "name": "Protection from [Alignment]",
   "param": "Evil"
  },
  "Magic Circle against Law": {
   "name": "Magic Circle Against [Alignment]",
   "param": "Law"
  },
  "Magic Circle against Chaos": {
   "name": "Magic Circle Against [Alignment]",
   "param": "Chaos"
  },
  "Magic Circle against Good": {
   "name": "Magic Circle Against [Alignment]",
   "param": "Good"
  },
  "Magic Circle against Evil": {
   "name": "Magic Circle Against [Alignment]",
   "param": "Evil"
  },
  "Dispel Law": {
   "name": "Dispel [Alignment]",
   "param": "Law"
  },
  "Dispel Chaos": {
   "name": "Dispel [Alignment]",
   "param": "Chaos"
  },
  "Dispel Good": {
   "name": "Dispel [Alignment]",
   "param": "Good"
  },
  "Dispel Evil": {
   "name": "Dispel [Alignment]",
   "param": "Evil"
  },
  "Hold Animal": {
   "name": "Hold Being"
  },
  "Hold Monster": {
   "name": "Hold Being"
  },
  "Dominate Animal": {
   "name": "Dominate Being"
  },
  "Fire Shield": {
   "name": "Fire / Chill Shield"
  },
  "Spell Resistance": {
   "name": "Power / Spell Resistance"
  },
  "Spell Turning": {
   "name": "Spell / Power Turning"
  },
  "Cure Wounds (Moderate)": {
   "name": "Cure Wounds",
   "param": "Moderate"
  },
  "Cure Wounds (Serious)": {
   "name": "Cure Wounds",
   "param": "Serious"
  },
  "Cure Wounds (Critical)": {
   "name": "Cure Wounds",
   "param": "Critical"
  },
  "Cure Wounds, Mass (Moderate)": {
   "name": "Cure Wounds",
   "param": "Mass Moderate"
  },
  "Cure Wounds, Mass (Critical)": {
   "name": "Cure Wounds",
   "param": "Mass Critical"
  },
  "Inflict Wounds (Light)": {
   "name": "Inflict Wounds",
   "param": "Light"
  },
  "Inflict Wounds (Critical)": {
   "name": "Inflict Wounds",
   "param": "Critical"
  },
  "Inflict Wounds, Mass (Light)": {
   "name": "Inflict Wounds",
   "param": "Mass Light"
  }
 },
 "proposed": {
  "Shapechange": {
   "name": "Metamorphosis, Greater",
   "why": "Shapechange absent from SPELLS_DB; Metamorphosis, Greater is the XPH-side equivalent and the Druid Option's Wildshape text points at Metamorphosis. Needs Adam's ruling."
  },
  "Create Greater Undead": {
   "name": "Create Undead",
   "why": "Only consolidated Create Undead exists; assume internal scaling like Cure/Inflict. Needs Adam's ruling."
  }
 },
 "missing": [
  {
   "name": "Magic Weapon",
   "grantedBy": [
    "War 1"
   ],
   "note": "RESOLVED (Adam, 2026-09-03): alternate name for Metaphysical Weapon — its entry carries the War 1 token and 'Variants: Magic Weapon; Magic Weapon, Greater'. The War 1 slot routes and displays correctly today; never actually missing (stale audit record)."
  },
  {
   "name": "Divine Power",
   "grantedBy": [
    "War 4"
   ]
  },
  {
   "name": "Power Word: Kill",
   "grantedBy": [
    "War 9"
   ],
   "note": "Ties into the standing Power Word: Kill adjudication — the War domain grants it at 9th, so its absence from Ch.IX is now load-bearing."
  },
  {
   "name": "Hardening",
   "grantedBy": [
    "Artifice 7"
   ]
  },
  {
   "name": "Desecrate",
   "grantedBy": [
    "Evil 2"
   ]
  },
  {
   "name": "Clairaudience/Clairvoyance",
   "grantedBy": [
    "Knowledge 3"
   ],
   "note": "Psionic Clairvoyant Sense may be the consolidation target — check."
  },
  {
   "name": "Mage’s Disjunction",
   "grantedBy": [
    "Magic 9"
   ],
   "note": "RESOLVED 2026-09-03: renamed to Disjunction with a full entry in the new HH (Prismatic Wall closure, errata F1) — SPELLS_DB carries it with Sor/Wiz 9 + Magic 9 tokens. No longer missing."
  },
  {
   "name": "Telepathic Bond",
   "grantedBy": [
    "Mind 3"
   ],
   "note": "Psionic Mindlink may be the consolidation target — check."
  },
  {
   "name": "Shield Other",
   "grantedBy": [
    "Protection 2"
   ]
  },
  {
   "name": "Enlarge Person",
   "grantedBy": [
    "Strength 1"
   ],
   "note": "Standing adjudication: → Expansion?"
  },
  {
   "name": "Bull’s Strength",
   "grantedBy": [
    "Strength 2"
   ],
   "note": "Standing adjudication: → Extraordinary [Attribute] Advantage."
  },
  {
   "name": "Screen",
   "grantedBy": [
    "Trickery 7"
   ],
   "note": "Illusion (scry-block) — NOT Force Screen / Shield."
  },
  {
   "name": "Dataread",
   "grantedBy": [
    "Hacking 3",
    "Technology 3"
   ],
   "note": "E&E original with no Ch.IX entry."
  },
  {
   "name": "Build Database",
   "grantedBy": [
    "Technology 7"
   ],
   "note": "E&E original with no Ch.IX entry."
  },
  {
   "name": "Hyperalgorithm",
   "grantedBy": [
    "Hacking 8",
    "Technology 9"
   ],
   "note": "E&E original with no Ch.IX entry."
  },
  {
   "name": "Holographic Image",
   "grantedBy": [
    "Hacking 7"
   ],
   "note": "E&E original with no Ch.IX entry."
  },
  {
   "name": "Virtual Reality",
   "grantedBy": [
    "Hacking 9"
   ],
   "note": "E&E original with no Ch.IX entry."
  }
 ]
};
