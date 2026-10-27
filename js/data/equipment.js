// =============================================================================
// js/data/equipment.js
// EQUIPMENT — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Money (the Purchase DC ladder),
//   weapon and armor rule tables, enchanting tables, toolkits, proficiency
//   tables and the short weapon list.
//
// KEY NAMES (so you can search for them)
//   tables and state: WEALTH_DC_DOLLARS, PRICE_FLUX_NOTE,
//   ENERGY_DAMAGE_TYPES, WEAPON_FINESSE_NAMED_EXCEPTIONS,
//   TOOLKIT_SATISFIERS, ARMOR_HARDNESS_BY_TS, ARMOR_SUBSTANCE_BY_TS,
//   ENCH_BONUS_HARDNESS, DAMAGE_CLASS_LABELS, ENCHANT_MAGICAL_DICE,
//   BOOST_BANE, ONE_HANDED_RANGED, WEAPONS, ACP_SKILLS
//
// WHERE IT CAME FROM
//   Gathered from js/app/62-power-suites-feats-page-proficiencies.js,
//   js/rules/12-wealth-and-prices.js, js/rules/13-armor-integrity-and-
//   enchanting.js, js/rules/16-worn-and-active-gear.js,
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

// Purchase DC currency table (DC 1-80), with the universal bridge:
// 1 gp = 10 sp = 100 cp, and 1 cp = $1 = 1 credit (so DC 20 = $2,000 =
// 20 gp = 200 sp = 2,000 credits). Prices display era-keyed by the
// scenario's Tech Scale:  TS 0-3 → "DC 20 (20 gp / 200 sp)" ·
// TS 4-6 → "DC 20 ($2,000 / 2,000 credits)" · TS 7+ → "DC 20 (2,000
// credits)". Every price carries the market-fluctuation advisory pop-up.
// ============================================================================
const WEALTH_DC_DOLLARS = [0,2,5,12,20,30,40,55,70,90,120,150,200,275,350,500,650,900,1200,1500,2000,
  2750,3500,5000,6500,9000,12000,15000,20000,27500,35000,50000,65000,90000,120000,150000,200000,275000,350000,500000,
  650000,900000,1200000,1500000,2000000,2750000,3500000,5000000,6500000,9000000,12000000,15000000,20000000,27500000,35000000,
  50000000,65000000,90000000,120000000,150000000,200000000,275000000,350000000,500000000,650000000,900000000,1200000000,
  1500000000,2000000000,2750000000,3500000000,5000000000,6500000000,9000000000,12000000000,15000000000,20000000000,
  27500000000,35000000000,50000000000,65000000000];
const PRICE_FLUX_NOTE = 'Prices may fluctuate ±20% for prevailing market conditions — certain Cha-based skill checks and roleplaying Circumstance modifiers may apply (GM adjudicates). Market-Tech modifiers: −2 DC per Tech Scale the item sits below the market, +5 DC per Tech Scale above.';

// Best-effort gadget eligibility: type match (weapon/armor/equipment) + the
// scenario's Tech Scale gate + the gadget's subtype restrictions (ranged/
// melee/ballistic/energy for weapons; light/medium/heavy/power for armor).
// 'kind' on a WEAPONS_CATALOG entry encodes HANDEDNESS, not melee/ranged, so
// ranged is detected via kind==='ranged' OR firearm:true (one-handed firearms
// keep kind:'one-handed'). Flagged here rather than silently assumed correct.
const ENERGY_DAMAGE_TYPES = new Set(['laser', 'plasma', 'cryonic', 'sonic', 'disintegration']);

// v8.5.2 / v9.7.0 (§257): Weapon Finesse eligibility (HH p.255, "Weapon
// Finesse (Fighter)"): "a light weapon, rapier, whip, or spiked chain made
// for a creature of your size category" -- NOT simply kind==='light'. Whip,
// Spiked Chain, and Rapier are classified by handedness (kind), not light,
// so they ride a named exception (Rapier joined the catalogue in v8.15.3;
// this set predated it — closed in v9.7.0). Natural attacks and the unarmed
// strike ("always considered light weapons", the feat's own Note) take the
// Dex substitution on their synthesized rows, and the feat's shield clause
// — "if you carry a shield, its armor check penalty applies to your attack
// rolls" — now debits every finessed attack via finesseShieldACP.
const WEAPON_FINESSE_NAMED_EXCEPTIONS = new Set(['Whip', 'Spiked Chain', 'Rapier']);

// v8.5.2: which catalogue equipment_items satisfy each toolkit-dependent
// skill, for the ownership-aware ⚒/⚒✓ marker in renderSkills (replaces the
// earlier hardcoded-list-only version). Craft (any) is satisfied by generic
// Artisan's tools (or masterwork) OR a matching tech tool kit, per HH; the
// other five map to their specific kit(s) per the skill->kit table (HH p.301).
const TOOLKIT_SATISFIERS = {
  'Repair': ["Electrical tool kit, basic", "Electrical tool kit, deluxe", "Mechanical tool kit, basic", "Mechanical tool kit, deluxe", "Multipurpose tool"],
  'Disable Device': ["Thieves' tools", "Thieves' tools, masterwork", "Lockpick set"],
  'Disguise': ["Disguise kit"],
  'Forgery': ["Forgery kit"],
  'Treat Injury': ["First aid kit", "Medical kit", "Surgery kit", "Healer's kit"],
};
// ============================================================================
// v8.13.0 T/ACTICAL ARMOR INTEGRITY (Adam's armor-damage pass, 2026-09-02 —
// HH pp.382-384 "The T/ACtical Combat System", GMG p.241 enchanted hardness).
// The band rule: an attack result in [Touch AC, Total AC) strikes the ARMOR —
// its hardness reduces the damage, and the remainder is split between armor
// HP and wearer. A PROFICIENT wearer chooses the split; a non-proficient
// wearer's ATTACKER chooses (Adam's caveat) — hardness applies either way.
// Total AC or better hits the character directly (no hardness). Power armor
// and Environmental Seal armor ALWAYS intercede (full AC = crit confirms
// only). Derived stats are firm-wired from the equipped item; the ONE stored
// field is it.armorDamage (lazy 0), moved only by Tracker actions.
// Broken (0 HP): no AC bonus, penalties stay, enchant suppressed while
// flagged (book says "permanently" — Adam's ruling: reversible-state door,
// the GM adjudicates the final fate). Destroyed: damage ≥ 1.5 × max HP — the
// HH p.181 Repair-skill salvage rule ("reduced to more than half its maximum
// hp in negative HP cannot be repaired"), generalized to armor per Adam.
const ARMOR_HARDNESS_BY_TS = {   // HH p.384 Table: Armor Hardness by Tech Scale
  5: { light: 3,  medium: 8,  heavy: 10 },   // Alumisteel
  6: { light: 5,  medium: 10, heavy: 10 },   // Duralloy
  7: { light: 10, medium: 10, heavy: 15 },   // Neovulcanium
  8: { light: 10, medium: 15, heavy: 20 },   // Megatanium
};
const ARMOR_SUBSTANCE_BY_TS = { 5: 'Alumisteel', 6: 'Duralloy', 7: 'Neovulcanium', 8: 'Megatanium', 9: 'Unobtanium' };
// GMG p.241: bonus hardness by aggregate enchantment modifier (+1..+10) —
// the "×2 rounded up to the nearest 5" schedule, printed verbatim. Adam's
// ruling: keyed to the AGGREGATE modifier (enh + ability equivalents, ≤+10),
// per the table's range; +10 = +20 hardness / +100 HP (near-artifact).
const ENCH_BONUS_HARDNESS = [0, 5, 5, 10, 10, 10, 15, 15, 20, 20, 20];

// v8.6.1 (Adam, 2026-09-01): classified damage-type labels — the old
// "N resist." column hid the useful fact. Each damage type reads as origin +
// family, straight from the DAMAGE_TYPES registry's ancestry (tech variants
// name their parent; plasma is the fire+acid composite; disintegration is
// exotic-tier). Enchantment energy dice append as Magical <element>, and an
// enchanted weapon notes that it beats DR/magic. Resistance detail moves to
// the cell tooltip.
const DAMAGE_CLASS_LABELS = {
  bludgeoning: 'Physical — Bludgeoning', piercing: 'Physical — Piercing', slashing: 'Physical — Slashing',
  ballistic: 'Tech Piercing (ballistic)',
  laser: 'Tech Fire (laser)', cryonic: 'Tech Cold (cryonic)', ionic: 'Tech Electricity (ionic)',
  plasma: 'Tech Fire + Acid (plasma)', concussion: 'Tech Force (concussion, nonlethal)',
  disintegration: 'Exotic — Disintegration',
  fire: 'Fire (energy)', cold: 'Cold (energy)', electricity: 'Electricity (energy)',
  acid: 'Acid (energy)', sonic: 'Sonic (energy)', force: 'Force (energy)', untyped: 'Untyped',
};
const ENCHANT_MAGICAL_DICE = {
  'Flaming': 'Magical Fire', 'Frost': 'Magical Cold', 'Shock': 'Magical Electricity', 'Psychokinetic': 'Magical Force',
  'Flaming Burst': 'Magical Fire', 'Icy Burst': 'Magical Cold', 'Shocking Burst': 'Magical Electricity', 'Psychokinetic Burst': 'Magical Force',
};
const BOOST_BANE = 'Boost — Bane';

// v8.6.1 (Adam's report, 2026-09-01 — an equipped Laser Rifle left the Off
// Hand showing empty): the HH DOES distinguish handedness for melee weapons
// (kind: light / one-handed / two-handed), but the table extraction lumped
// all ranged weapons under kind:'ranged' and defaulted most firearms to
// 'one-handed' — so ranged/firearm handedness resolves by rule here: longarms,
// bows, and crossbows take two hands (which also covers the reach polearms
// the extractor mis-kinded as 'ranged' — Glaive/Guisarme/Halberd/Lance/
// Ranseur, genuinely two-handed) EXCEPT the named thrown/one-hand list and
// the pistol family. A two-handed weapon equipped in the Main Hand claims
// the Off Hand as a VIRTUAL occupant — derived, never stored (three-door:
// firm-wire logic), so legacy characters need no migration.
const ONE_HANDED_RANGED = new Set(['Dart', 'Javelin', 'Sling (w/ 10 stones)', 'Sling (w/ 10 bullets)', 'Bolas', 'Net', 'Crossbow, hand', 'Bolts, crossbow (10)', 'Shuriken']);

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


// v8.93.0 (Adam's Ultralight report): ARMOR CHECK PENALTY finally reaches
// the SKILL TABLE — the "separate, not-yet-modeled rule" confessed below
// since §32. Ultralight Composition's easing had nothing to ease until now.
// Proficient wearers: ACP applies to the HH's ACP-flagged skills (the Skill
// Descriptions qualifier line). Non-proficient wearers: that piece's ACP
// applies to ALL Str-/Dex-based skill checks instead (d20 rule). E&E Swim
// takes SINGLE ACP — the book replaces 3.5's doubling with its own −1 per
// 5 lb of gear Special (absence of a 3.5 modifier is intentional).
const ACP_SKILLS = ['Balance', 'Climb', 'Escape Artist', 'Hide', 'Jump', 'Move Silently', 'Sleight of Hand', 'Swim', 'Tumble'];
