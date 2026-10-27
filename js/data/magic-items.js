// =============================================================================
// js/data/magic-items.js
// MAGIC ITEMS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Magic item slot rules, wired magic
//   item effects and the magic browser's labels.
//
// KEY NAMES (so you can search for them)
//   tables and state: MAGIC_SLOT_TYPE, MAGIC_SLOT_KEYWORDS,
//   MAGIC_ITEM_EFFECTS, MAGIC_TYPE_LABELS, MAGIC_PROPERTY_TYPES,
//   SPECIFIC_ARMS_CONVERSIONS
//
// WHERE IT CAME FROM
//   Gathered from js/rules/09-item-effects-and-buffs.js, js/rules/10-minds-
//   ledger-and-magic-browser.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// v8.6.0 magic-item catalogue: default body slot by item type, then by the
// naming idiom (Amulet of… → neck; Boots of… → boots; …). Anything
// unmatched lands in 'carried' — the player can re-slot via GM ruling later.
const MAGIC_SLOT_TYPE = {
  ring: 'ring', tattoo: 'tattoo', psicrown: 'head',
  potion: 'carried', wand: 'carried', scroll: 'carried', rod: 'carried',
  staff: 'carried', dorje: 'carried', power_stone: 'carried',
  cognizance_crystal: 'carried',
};
const MAGIC_SLOT_KEYWORDS = [
  [/amulet|necklace|periapt|scarab|medallion|brooch|pendant/i, 'neck'],
  [/\btorc\b/i, 'torc'], [/phylactery/i, 'phylactery'],
  [/boots|slippers/i, 'boots'], [/cloak|cape|mantle/i, 'shoulders'],
  [/belt|girdle/i, 'belt'], [/gauntlet/i, 'gauntlets'], [/glove/i, 'gloves'],
  [/bracers/i, 'bracers'], [/bracelet/i, 'bracelets'],
  [/helm|crown|circlet|headband|diadem/i, 'head'], [/\bhat\b|\bcap\b/i, 'hat'],
  [/goggles|lenses|eyes of/i, 'eyes'], [/robe/i, 'robe'],
  [/shirt/i, 'shirt'], [/vest\b|vestment/i, 'vest'], [/\bring\b/i, 'ring'],
  [/tattoo/i, 'tattoo'], [/armor|breastplate|plate|mail|skin of/i, 'armor'],
  [/shield/i, 'off_hand'],
];

// ============================================================================
// v8.6.0 FIRM-WIRED item effects (Adam's ruling, 2026-09-01). The three-tier
// effect ontology:
//   HARD-BAKED — permanent acquisitions write into c.attrs (mutations;
//     reverse on the rare removal).
//   FIRM-WIRED — equipment effects DERIVE live from the `equipped` flag,
//     never stored: nothing to reverse, nothing to drift. Enhancement
//     non-stacking falls out naturally (best-per-attribute).
//   MANUAL — cast-time effects (Animal Affinity et al.) stay display-only.
// Deliberate exclusion: SNAPSHOT values (stored max HP from CON at level-up)
// do NOT follow item attributes — RAW treats item-CON hit points as
// temporary; surfaced as a note, not silently recomputed.
// MAGIC_ITEM_EFFECTS is the curated table (names verified against
// MAGIC_ITEMS_DB); tiered items pick their tier at add time (it.tier).
const MAGIC_ITEM_EFFECTS = {
  // — attribute enhancements (firm-wired via effAttrs) —
  'Amulet of Health':        {attr:'CON', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Headband of Intellect':   {attr:'INT', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Cloak of Charisma':       {attr:'CHA', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Gloves of Dexterity':     {attr:'DEX', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Periapt of Wisdom':       {attr:'WIS', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Belt of Giant Strength':  {attr:'STR', tiers:[[4,16000],[6,36000]]},
  'Gauntlets of Ogre Power': {attr:'STR', value:2},
  // — aggregator-channel effects (deflection AC, natural armor, saves, skills) —
  'Amulet of Natural Armor': {target:'naturalAC', type:'enhancement', tiers:[[1,2000],[2,8000],[3,18000],[4,32000],[5,50000]]},
  'Protection':              {target:'ac', type:'deflection', tiers:[[1,2000],[2,8000],[3,18000],[4,32000],[5,50000]]},
  'Cloak of Resistance':     {targets:['fort','ref','will'], type:'resistance', tiers:[[1,1000],[2,4000],[3,9000],[4,16000],[5,25000]]},
  'Boots of Elvenkind':      {target:'skill:Move Silently', type:'competence', value:5},
  'Eyes of the Eagle':       {target:'skill:Spot', type:'competence', value:5},
};

const MAGIC_TYPE_LABELS = {
  wondrous:'Wondrous', ring:'Ring', rod:'Rod', staff:'Staff', wand:'Wand',
  potion:'Potion/Oil', psicrown:'Psicrown', universal_item:'Universal',
  weapon_ability:'Weapon Property', armor_shield_ability:'Armor/Shield Property',
  specific_weapon:'Specific Weapon', specific_armor:'Specific Armor',
  specific_shield:'Specific Shield', modern:'Modern', cursed:'Cursed',
  artifact:'Artifact', tattoo:'Imbued Tattoo',
  // v9.11.0 (§265): the five ported sections (GMG pp.272-302).
  cognizance_crystal:'Cognizance Crystal', dorje:'Dorje',
  power_stone:'Power Stone', scroll:'Scroll',
};
// Property types are enchantment MODIFIERS applied to a weapon/armor (Price
// +N bonus or gp surcharge) — browsable for reference, not addable as items.
const MAGIC_PROPERTY_TYPES = new Set(['weapon_ability', 'armor_shield_ability']);
// ============================================================================
// v8.7.0 (Adam's report: "a Luck Blade doesn't populate as an equippable
// weapon"): SPECIFIC weapons/armors/shields from the magic-item catalogue
// convert into REAL equippable items — base catalogue item + the enchant
// package (or mastercraft-only for the nonmagical special-material pieces:
// adamantine, mithral, darkwood, dragonhide, cold iron, alchemical silver).
// customName preserves the item's identity ("Luck Blade", not "+2 Sword,
// short"); specialNote carries the unique powers (GM adjudicates); the full
// book text stays readable in the magic-item catalogue browse. Items NOT in
// this table (ammunition one-shots, bases missing from the weapon table)
// keep the old magic-trinket behavior.
const SPECIFIC_ARMS_CONVERSIONS = {
  // ---- weapons ----
  'Adamantine Battleaxe':     { cat:'weapon', base:'Battleaxe', mcOnly:true, note:'Adamantine (nonmagical): ignores hardness less than 20; mastercraft +1 attack.' },
  'Adamantine Dagger':        { cat:'weapon', base:'Dagger', mcOnly:true, note:'Adamantine (nonmagical): ignores hardness less than 20; mastercraft +1 attack.' },
  'Assassin’s Dagger':        { cat:'weapon', base:'Dagger', enh:2, note:'+1 to the DC of Fortitude saves forced by your death attacks.' },
  'Dagger of Venom':          { cat:'weapon', base:'Dagger', enh:1, note:'Poison effect 1/day on command (as the spell, DC 14).' },
  'Dwarven Thrower':          { cat:'weapon', base:'Warhammer', enh:2, note:'In dwarven hands: +3, returning when thrown, ×2 dice vs giants.' },
  'Flame Tongue':             { cat:'weapon', base:'Longsword', enh:1, abilities:['Flaming Burst'], note:'Fiery ray 1/day (4d6 fire, 30 ft).' },
  'Frost Brand':              { cat:'weapon', base:'Greatsword', enh:3, abilities:['Frost'], note:'Sheds light below 0°F; extinguishes fires; +1 on saves vs fire.' },
  'Holy Avenger':             { cat:'weapon', base:'Longsword', enh:2, note:'Cold iron. In a paladin’s hands: +5 holy; grants SR 5 + paladin level; dispel magic at will (see text).' },
  'Life-Drinker':             { cat:'weapon', base:'Greataxe', enh:1, note:'Bestows negative levels on foes AND drains the wielder (see text — favored by undead).' },
  'Luck Blade':               { cat:'weapon', base:'Sword, short', enh:2, note:'+1 luck bonus on ALL saving throws; holds wishes (GM sets remaining).' },
  'Mace of Smiting':          { cat:'weapon', base:'Mace, heavy', enh:3, note:'Adamantine; +5 vs constructs (crits can destroy them); ×4 crit vs outsiders.' },
  'Mace of Terror':           { cat:'weapon', base:'Mace, heavy', enh:2, note:'Fear aura on command 3/day (as Fear, DC 16).' },
  'Masterwork Cold Iron Longsword': { cat:'weapon', base:'Longsword', mcOnly:true, note:'Cold iron (nonmagical): beats DR/cold iron; mastercraft +1 attack.' },
  'Nine Lives Stealer':       { cat:'weapon', base:'Longsword', enh:2, note:'Can draw the life force on a crit (9 charges, Fort negates — see text).' },
  'Oathbow':                  { cat:'weapon', base:'Longbow, composite', enh:2, note:'Elven make. Sworn enemy: +2 atk / +2d6 vs the oath target (see text).' },
  'Rapier of Puncturing':     { cat:'weapon', base:'Rapier', enh:2, abilities:['Wounding'], note:'Touch attack 3/day dealing 1d6 Con damage.' },
  'Shatterspike':             { cat:'weapon', base:'Longsword', enh:1, note:'With Improved Sunder: +4 atk/dmg vs objects and when sundering.' },
  'Silver Dagger, Masterwork': { cat:'weapon', base:'Dagger', mcOnly:true, note:'Alchemical silver (nonmagical): beats DR/silver; −1 damage; mastercraft +1 attack.' },
  'Sun Blade':                { cat:'weapon', base:'Sword, bastard', enh:2, note:'Wielded as a short sword (Weapon Finesse applies); +4 vs evil; sunlight blade powers (see text).' },
  'Sword of Life Stealing':   { cat:'weapon', base:'Longsword', enh:2, note:'Bestows a negative level on a crit; wielder gains 1d6 temp HP.' },
  'Sword of the Planes':      { cat:'weapon', base:'Longsword', enh:1, note:'+2 on Elemental Planes, +3 Astral/Ethereal, +4 Outer Planes.' },
  'Sword of Subtlety':        { cat:'weapon', base:'Sword, short', enh:1, note:'+4 attack AND damage on sneak attacks.' },
  'Trident of Fish Command':  { cat:'weapon', base:'Trident', enh:1, note:'Charm aquatic animals 3/day (see text); 6-ft haft.' },
  'Trident of Warning':       { cat:'weapon', base:'Trident', enh:2, note:'Detect aquatic predators within 680 ft (see text).' },
  // ---- armor ----
  'Adamantine Breastplate':   { cat:'armor', base:'Breastplate', mcOnly:true, note:'Adamantine (nonmagical): DR 2/—; Hardness 20, 100 HP.' },
  'Banded Mail of Luck':      { cat:'armor', base:'Banded mail', enh:3, note:'1/week: force a foe to reroll one successful attack against you.' },
  'Breastplate of Command':   { cat:'armor', base:'Breastplate', enh:2, note:'+2 Cha; +2 Diplomacy; allies within 30 ft get +1 morale vs fear.' },
  'Celestial Armor':          { cat:'armor', base:'Chainmail', enh:3, note:'So fine it counts as LIGHT armor (max Dex +8, ACP −2); Fly 1/day.' },
  'Demon Armor':              { cat:'armor', base:'Full plate', enh:4, note:'Demon-visaged; claw attacks 1d10 with Contagion on hit (see text).' },
  'Dragonhide Plate':         { cat:'armor', base:'Full plate', mcOnly:true, note:'Dragonhide (nonmagical): no metal — druids can wear it.' },
  'Dwarven Plate':            { cat:'armor', base:'Full plate', mcOnly:true, note:'Adamantine (nonmagical): DR 3/—.' },
  'Elven Chain':              { cat:'armor', base:'Chainmail', mcOnly:true, note:'Mithral (nonmagical): counts as LIGHT armor; speed 30 ft; ACP −2 total.' },
  'Mithral Full Plate of Speed': { cat:'armor', base:'Full plate', enh:1, note:'Mithral (counts as medium); Haste 1/day for 10 rounds on command.' },
  'Mithral Shirt':            { cat:'armor', base:'Chain shirt', mcOnly:true, note:'Mithral (nonmagical): counts as LIGHT armor; no speed reduction.' },
  'Plate Armor of the Deep':  { cat:'armor', base:'Full plate', enh:1, note:'Weightless in water; breathe underwater; speak to water-breathers.' },
  'Rhino Hide':               { cat:'armor', base:'Hide', enh:2, note:'+2d6 damage on any successful charge attack you make.' },
  // ---- shields ----
  'Absorbing Shield':         { cat:'armor', base:'Shield, heavy steel', enh:1, note:'1/2 days on command: disintegrate a touched object (see text).' },
  'Caster’s Shield':          { cat:'armor', base:'Shield, light wooden', enh:1, note:'Leather strip holds one scribed spell (see text).' },
  'Darkwood Buckler':         { cat:'armor', base:'Buckler', mcOnly:true, note:'Darkwood (nonmagical): half weight, no ACP.' },
  'Darkwood Shield':          { cat:'armor', base:'Shield, heavy wooden', mcOnly:true, note:'Darkwood (nonmagical): half weight, no ACP.' },
  'Lion’s Shield':            { cat:'armor', base:'Shield, heavy steel', enh:2, note:'Lion’s head bites 3/day as a free action (2d6, as your attack bonus).' },
  'Mithral Heavy Shield':     { cat:'armor', base:'Shield, heavy steel', mcOnly:true, note:'Mithral (nonmagical): light weight, ACP 0, 5% arcane spell failure.' },
  'Spined Shield':            { cat:'armor', base:'Shield, heavy steel', enh:1, note:'Acts as a spiked shield; fires spines 3/day (see text).' },
  'Winged Shield':            { cat:'armor', base:'Shield, heavy wooden', enh:3, note:'Fly 1/day (as the spell) carrying up to 133 lb.' },
  // v8.15.2: unblocked by Adam's book ruling adding the Scimitar (TS 1).
  'Sylvan Scimitar':          { cat:'weapon', base:'Scimitar', enh:3, note:'Outdoors in a temperate climate: wielder gains Cleave and +1d6 damage.' },
};
