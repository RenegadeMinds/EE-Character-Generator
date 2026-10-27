// =============================================================================
// js/data/homebrew.js
// HOMEBREW — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Homebrew armory substances and the
//   monstrous creature-type tables.
//
// KEY NAMES (so you can search for them)
//   tables and state: HBG_SUBSTANCES, MONSTROUS_CLASSES, MONSTER_TYPE_PROG
//
// WHERE IT CAME FROM
//   Gathered from js/rules/06-homebrew-forge-armory-monstrous.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ============================================================================
// v9.12.0 (§269): THE HOMEBREW ARMORY — GM-authored weapons and armor that
// JOIN the real catalogs (hbGearSync pushes them into WEAPONS_CATALOG /
// ARMOR_CATALOG at boot and on every save), so browse, purchase, equip,
// stat strips, mastercraft/enchant, and T/AC armor integrity all ride the
// normal rails with zero special-casing. Armor may be forged from a NAMED
// SUBSTANCE (HH pp.329-331, the alloy list): its hardness follows the
// substance's native-TS row on the Armor Hardness table (HH p.384) — a
// Megatanium chain shirt is hard like Megatanium, whatever its pattern's
// age. Store is campaign-level (localStorage, like the feat Forge), with
// export/import for the players' table.
const HBG_SUBSTANCES = {  // name → native Tech Scale (HH pp.329-331)
  'Alumisteel': 5, 'Duraplastic': 5,
  'Duralloy': 6, 'Mythralloy': 6, 'Resilium': 6, 'Steelskin': 6,
  'Adamantium': 7, 'Crystal Carbon': 7, 'Neovulcanium': 7, 'Tithralium': 7,
  'Krithium': 8, 'Megatanium': 8, 'Mythandium': 8, 'Nanofluidic': 8, 'Reactive': 8,
  'Unobtanium': 9,
};
// ========== v9.15.0 §273: THE MONSTROUS HERITAGE LANE ==========
// The CG half of the GMF bridge (Adam's gavel, 2026-10-13): the Familiar's
// "Seed → CG" button exports a creature seed; importing it here births a
// playable character — the creature's racial Hit Dice ride as a MONSTROUS-
// tier class (progressions from the FF Creature Types chapter: good saves
// 2 + HD/2, poor HD/3, BAB by type fraction), the creature itself becomes
// a race entry (ability adjustments = listed − the 10/11 baseline, RLM =
// its printed Level Adjustment), and class levels then advance normally in
// the full engine. Monstrous classes never appear in the class picker —
// they exist only through seed import. Creatures of 1 HD or less follow
// FF p.34 (class levels REPLACE the monster level): race only, no class.
const MONSTROUS_CLASSES = {};
const MONSTER_TYPE_PROG = { // FF Creature Types: die, BAB fraction, good saves
  'Aberration':{d:8,b:.75,g:['will']}, 'Animal':{d:8,b:.75,g:['fort','ref']},
  'Construct':{d:10,b:.75,g:[]}, 'Dragon':{d:12,b:1,g:['fort','ref','will']},
  'Elemental':{d:8,b:.75,g:['fort']}, 'Fey':{d:6,b:.5,g:['will']},
  'Giant':{d:8,b:.75,g:['fort']}, 'Humanoid':{d:8,b:.75,g:['ref']},
  'Magical Beast':{d:10,b:1,g:['fort','ref']}, 'Monstrous Humanoid':{d:8,b:1,g:['ref','will']},
  'Ooze':{d:10,b:.75,g:[]}, 'Outsider':{d:8,b:1,g:['fort','ref','will']},
  'Plant':{d:8,b:.75,g:['fort']}, 'Undead':{d:12,b:.5,g:['will']}, 'Vermin':{d:8,b:.75,g:['fort']},
};
