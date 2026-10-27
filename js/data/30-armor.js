// =============================================================================
// js/data/30-armor.js
// ARMOR
// =============================================================================
//
// WHAT'S IN HERE
//   ARMOR_CATALOG: the full armor and shield catalog.
//
// ORIGINALLY GENERATED: READ THIS BEFORE CHANGING THE DATA
//   These tables were first built by Adam's data-build scripts
//   (equipment_substrate/build_inline_all.mjs (plus the damage_, spells_ and
//   vehicles_substrate builders)), which live in the private EE-Rulebooks
//   repository. Those scripts are NOT a working build any more: each was
//   written to patch one specific old copy of the generator (the newest
//   targets v8.49.0), and since then the data has been edited directly in the
//   generator. For most catalogs (equipment, armor, gadgets, weapons, item
//   slots, vehicles, magic items) their source JSON files are now OLDER than
//   this file, and some catalogs are missing from the combined block entirely,
//   so re-running them would silently delete newer content. Treat THIS file as
//   the source of truth. The JSON/END marker comments around each table, and
//   the BEGIN/END substrate banner lines, are kept unchanged so a future
//   script can still find the tables.
//
// KEY NAMES (so you can search for them)
//   tables/objects: ARMOR_CATALOG
//
// LOAD ORDER
//   File 30 of 68. index.html loads it after js/data/29-weapons.js and before
//   js/data/31-vehicles.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 23956-24399 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// PHASE 2 LAYOUT (tools/reformat_data.py)
//   The data tables below were re-laid-out ONE RECORD PER LINE, so a change
//   to one entry shows up in Git as a one-line change. Only line breaks and
//   spaces changed: every value, and the order of every key, is identical
//   (the tool checks this before writing). Everything else in this file,
//   including the marker comments around each table, is unchanged.
// ---- from index.html v9.19.0, lines 23956-24399; data tables re-laid-out one record per line (values unchanged) ----
const ARMOR_CATALOG = /*<<JSON:ARMOR_CATALOG>>*/ [
  {"name": "Padded", "tl": 0, "type": "light", "dc": 15, "ac_bonus": 1, "max_dex": "+8", "armor_check_penalty": "+/-0", "arcane_spell_failure": "5%", "speed": "30’/20’", "weight": "10 lb.", "scale": "character"},
  {"name": "Hide", "tl": 0, "type": "medium", "dc": 19, "ac_bonus": 3, "max_dex": "+4", "armor_check_penalty": "-3", "arcane_spell_failure": "20%", "speed": "20’/15’", "weight": "25 lb.", "scale": "character"},
  {"name": "Leather", "tl": 1, "type": "light", "dc": 18, "ac_bonus": 2, "max_dex": "+6", "armor_check_penalty": "+/-0", "arcane_spell_failure": "10%", "speed": "30’/20’", "weight": "15 lb.", "scale": "character"},
  {"name": "Studded leather", "tl": 1, "type": "light", "dc": 21, "ac_bonus": 3, "max_dex": "+5", "armor_check_penalty": "–1", "arcane_spell_failure": "15%", "speed": "30’/20’", "weight": "20 lb.", "scale": "character"},
  {"name": "Chain shirt", "tl": 1, "type": "light", "dc": 26, "ac_bonus": 4, "max_dex": "+4", "armor_check_penalty": "–2", "arcane_spell_failure": "20%", "speed": "30’/20’", "weight": "25 lb.", "scale": "character"},
  {"name": "Scale mail", "tl": 1, "type": "medium", "dc": 23, "ac_bonus": 4, "max_dex": "+3", "armor_check_penalty": "–4", "arcane_spell_failure": "25%", "speed": "20’/15’", "weight": "30 lb.", "scale": "character"},
  {"name": "Chainmail", "tl": 1, "type": "medium", "dc": 27, "ac_bonus": 5, "max_dex": "+2", "armor_check_penalty": "–5", "arcane_spell_failure": "30%", "speed": "20’/15’", "weight": "40 lb.", "scale": "character"},
  {"name": "Splint mail", "tl": 1, "type": "heavy", "dc": 28, "ac_bonus": 6, "max_dex": "+0", "armor_check_penalty": "–7", "arcane_spell_failure": "40%", "speed": "20’/15’", "weight": "45 lb.", "scale": "character"},
  {"name": "Banded mail", "tl": 1, "type": "heavy", "dc": 29, "ac_bonus": 6, "max_dex": "+1", "armor_check_penalty": "–6", "arcane_spell_failure": "35%", "speed": "20’/15’", "weight": "35 lb.", "scale": "character"},
  {"name": "Buckler", "tl": 1, "type": "shield", "dc": 19, "ac_bonus": 1, "max_dex": null, "armor_check_penalty": "–1", "arcane_spell_failure": "5%", "speed": "—/—", "weight": "5 lb.", "scale": "character"},
  {"name": "Shield, light wooden", "tl": 1, "type": "shield", "dc": 14, "ac_bonus": 1, "max_dex": null, "armor_check_penalty": "–1", "arcane_spell_failure": "5%", "speed": "—/—", "weight": "5 lb.", "scale": "character"},
  {"name": "Shield, light steel", "tl": 1, "type": "shield", "dc": 17, "ac_bonus": 1, "max_dex": null, "armor_check_penalty": "–1", "arcane_spell_failure": "5%", "speed": "—/—", "weight": "6 lb.", "scale": "character"},
  {"name": "Shield, heavy wooden", "tl": 1, "type": "shield", "dc": 16, "ac_bonus": 2, "max_dex": null, "armor_check_penalty": "–2", "arcane_spell_failure": "15%", "speed": "—/—", "weight": "10 lb.", "scale": "character"},
  {"name": "Shield, heavy steel", "tl": 1, "type": "shield", "dc": 20, "ac_bonus": 2, "max_dex": null, "armor_check_penalty": "–2", "arcane_spell_failure": "15%", "speed": "—/—", "weight": "15 lb.", "scale": "character"},
  {"name": "Shield, tower", "tl": 1, "type": "shield", "dc": 32, "ac_bonus": 4, "max_dex": "+2", "armor_check_penalty": "–10", "arcane_spell_failure": "50%", "speed": "—/—", "weight": "45 lb.", "scale": "character"},
  {"name": "Breastplate", "tl": 2, "type": "medium", "dc": 28, "ac_bonus": 5, "max_dex": "+3", "armor_check_penalty": "–4", "arcane_spell_failure": "25%", "speed": "20’/15’", "weight": "30 lb.", "scale": "character"},
  {"name": "Half-plate", "tl": 2, "type": "heavy", "dc": 32, "ac_bonus": 7, "max_dex": "+0", "armor_check_penalty": "–7", "arcane_spell_failure": "40%", "speed": "20’/15’", "weight": "50 lb.", "scale": "character"},
  {"name": "Full plate", "tl": 2, "type": "heavy", "dc": 35, "ac_bonus": 8, "max_dex": "+1", "armor_check_penalty": "–6", "arcane_spell_failure": "35%", "speed": "20’/15’", "weight": "50 lb.", "scale": "character"},
  {"name": "Light Undercover Shirt", "tl": 5, "type": "light", "dc": 13, "ac_bonus": 2, "max_dex": "+7", "armor_check_penalty": "–0", "arcane_spell_failure": "5%", "speed": "30’/20’", "weight": "2 lb.", "scale": "character"},
  {"name": "Pull-up Pouch Vest", "tl": 5, "type": "light", "dc": 13, "ac_bonus": 2, "max_dex": "+6", "armor_check_penalty": "–1", "arcane_spell_failure": "10%", "speed": "30’/20’", "weight": "2 lb.", "scale": "character"},
  {"name": "Undercover Vest", "tl": 5, "type": "light", "dc": 14, "ac_bonus": 3, "max_dex": "+5", "armor_check_penalty": "–2", "arcane_spell_failure": "15%", "speed": "30’/20’", "weight": "3 lb.", "scale": "character"},
  {"name": "Concealable Vest", "tl": 5, "type": "medium", "dc": 15, "ac_bonus": 4, "max_dex": "+4", "armor_check_penalty": "–3", "arcane_spell_failure": "20%", "speed": "30’/20’", "weight": "4 lb.", "scale": "character"},
  {"name": "Light-Duty Vest", "tl": 5, "type": "medium", "dc": 16, "ac_bonus": 5, "max_dex": "+3", "armor_check_penalty": "–4", "arcane_spell_failure": "25%", "speed": "30’/20’", "weight": "8 lb.", "scale": "character"},
  {"name": "Tactical Vest", "tl": 5, "type": "medium", "dc": 17, "ac_bonus": 6, "max_dex": "+2", "armor_check_penalty": "–5", "arcane_spell_failure": "30%", "speed": "30’/20’", "weight": "10 lb.", "scale": "character"},
  {"name": "Special Response Vest", "tl": 5, "type": "heavy", "dc": 18, "ac_bonus": 7, "max_dex": "+1", "armor_check_penalty": "–6", "arcane_spell_failure": "35%", "speed": "20’/15’", "weight": "15 lb.", "scale": "character"},
  {"name": "Space Suit", "tl": 5, "type": "heavy", "dc": 26, "ac_bonus": 7, "max_dex": "+0", "armor_check_penalty": "–10", "arcane_spell_failure": "50%", "speed": "15’/10’", "weight": "50 lb.", "scale": "character"},
  {"name": "Forced Entry Unit", "tl": 5, "type": "heavy", "dc": 19, "ac_bonus": 9, "max_dex": "+0", "armor_check_penalty": "–8", "arcane_spell_failure": "40%", "speed": "20’/15’", "weight": "20 lb.", "scale": "character"},
  {"name": "Survival Suit", "tl": 6, "type": "light", "dc": 16, "ac_bonus": 1, "max_dex": "+7", "armor_check_penalty": "+/-0", "arcane_spell_failure": "0%", "speed": "30’/20’", "weight": "3 lb.", "scale": "character"},
  {"name": "Land Warrior Power Armor", "tl": 6, "type": "power", "dc": 28, "ac_bonus": 10, "max_dex": "+0", "armor_check_penalty": "-10", "arcane_spell_failure": "50%", "speed": "20’/15’", "weight": "50 lb.", "scale": "character"},
  {"name": "Silent Suit", "tl": 7, "type": "light", "dc": 18, "ac_bonus": 1, "max_dex": "+8", "armor_check_penalty": "+/-0", "arcane_spell_failure": "5%", "speed": "30’/20’", "weight": "1 lb.", "scale": "character"},
  {"name": "Implacable Power Infantry Armor", "tl": 6, "type": "power", "dc": 38, "ac_bonus": 5, "max_dex": "+2", "armor_check_penalty": "-6", "arcane_spell_failure": "50%", "speed": "", "weight": "250 lb.", "scale": "character"},
  {"name": "Myrmidon Infantry Support Armor", "tl": 6, "type": "power", "dc": 41, "ac_bonus": 8, "max_dex": "+0", "armor_check_penalty": "-8", "arcane_spell_failure": "50%", "speed": "", "weight": "500 lb.", "scale": "character"},
  {"name": "Aries Reconnaissance Scout Armor", "tl": 7, "type": "power", "dc": 44, "ac_bonus": 5, "max_dex": "+5", "armor_check_penalty": "+/-0", "arcane_spell_failure": "50%", "speed": "", "weight": "250 lb.", "scale": "character"},
  {"name": "Taurus Mechanized Infantry Armor", "tl": 6, "type": "power", "dc": 41, "ac_bonus": 6, "max_dex": "+2", "armor_check_penalty": "-5", "arcane_spell_failure": "50%", "speed": "", "weight": "500 lb.", "scale": "character"}
] /*<<END:ARMOR_CATALOG>>*/;
