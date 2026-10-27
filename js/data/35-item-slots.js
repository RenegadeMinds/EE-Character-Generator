// =============================================================================
// js/data/35-item-slots.js
// ITEM SLOTS
// =============================================================================
//
// WHAT'S IN HERE
//   ITEM_SLOTS (magic item slot affinities), followed by the hand-written
//   SLOT_GROUPS body-slot table and slotGroupIdOf.
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
//   tables/objects: ITEM_SLOTS, SLOT_GROUPS
//   functions (1): slotGroupIdOf
//
// LOAD ORDER
//   File 35 of 68. index.html loads it after js/data/34-equipment-items.js and
//   before js/data/36-magic-items.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 27209-27408 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 27209-27408; unchanged below this line ----
const ITEM_SLOTS = /*<<JSON:ITEM_SLOTS>>*/ [
  {
    "id": "main_hand",
    "label": "Main Hand",
    "category": "held",
    "capacity": 1,
    "accepts": [
      "weapon"
    ]
  },
  {
    "id": "off_hand",
    "label": "Off Hand",
    "category": "held",
    "capacity": 1,
    "accepts": [
      "weapon",
      "shield"
    ]
  },
  {
    "id": "armor",
    "label": "Armor",
    "category": "worn",
    "capacity": 1,
    "accepts": [
      "armor"
    ]
  },
  {
    "id": "head",
    "label": "Headband / Helmet",
    "category": "body",
    "capacity": 1,
    "affinity": "Mental improvement, ranged attacks"
  },
  {
    "id": "hat",
    "label": "Hat",
    "category": "body",
    "capacity": 1,
    "affinity": "Interaction"
  },
  {
    "id": "phylactery",
    "label": "Phylactery",
    "category": "body",
    "capacity": 1,
    "affinity": "Morale, alignment"
  },
  {
    "id": "eyes",
    "label": "Crystal mask / lenses / goggles / third eye",
    "category": "body",
    "capacity": 1,
    "affinity": "Vision, mental acuity"
  },
  {
    "id": "shoulders",
    "label": "Cloak / cape / mantle / psychoactive skin",
    "category": "body",
    "capacity": 1,
    "affinity": "Transformation, protection"
  },
  {
    "id": "back",
    "label": "Back (pack / jetpack / aquaconverter)",
    "category": "body",
    "capacity": 1,
    "affinity": "Carried systems"
  },
  {
    "id": "neck",
    "label": "Amulet / brooch / medallion / necklace / periapt / scarab",
    "category": "body",
    "capacity": 1,
    "affinity": "Protection, discernment"
  },
  {
    "id": "torc",
    "label": "Torc",
    "category": "body",
    "capacity": 1,
    "affinity": "Mental protection"
  },
  {
    "id": "robe",
    "label": "Robe",
    "category": "body",
    "capacity": 1,
    "affinity": "Multiple effects"
  },
  {
    "id": "shirt",
    "label": "Shirt",
    "category": "body",
    "capacity": 1,
    "affinity": "Physical improvement"
  },
  {
    "id": "vest",
    "label": "Vest / vestment",
    "category": "body",
    "capacity": 1,
    "affinity": "Class ability improvement"
  },
  {
    "id": "bracers",
    "label": "Bracers",
    "category": "body",
    "capacity": 1,
    "affinity": "Combat"
  },
  {
    "id": "bracelets",
    "label": "Bracelets",
    "category": "body",
    "capacity": 1,
    "affinity": "Allies"
  },
  {
    "id": "gloves",
    "label": "Gloves",
    "category": "body",
    "capacity": 1,
    "affinity": "Quickness"
  },
  {
    "id": "gauntlets",
    "label": "Gauntlets",
    "category": "body",
    "capacity": 1,
    "affinity": "Destructive power"
  },
  {
    "id": "belt",
    "label": "Belt",
    "category": "body",
    "capacity": 1,
    "affinity": "Physical improvement"
  },
  {
    "id": "boots",
    "label": "Boots",
    "category": "body",
    "capacity": 1,
    "affinity": "Movement"
  },
  {
    "id": "ring",
    "label": "Ring",
    "category": "body",
    "capacity": 2,
    "affinity": "Varied",
    "note": "Author ruling: up to 2 rings regardless of appendages. (Not in the GMG p.222 table.)"
  },
  {
    "id": "tattoo",
    "label": "Imbued Tattoo",
    "category": "body",
    "capacity": 20,
    "temporary": true,
    "affinity": "Varied",
    "note": "Author ruling: up to 20 imbued tattoos regardless of body size; temporary (psionic equivalent of potions, but with a bodily limit)."
  },
  {
    "id": "carried",
    "label": "Carried",
    "category": "carried",
    "capacity": null,
    "note": "Unslotted gear (tool kits, consumables, misc). Tool-kit skill bonuses apply by ownership (no equip needed)."
  }
] /*<<END:ITEM_SLOTS>>*/;

// v9.6.0 (§255, Adam's chart, 2026-10-07): THE REAL BODY SLOTS. The GMG
// p.222 table lists enchantment AFFINITIES (a hat and a helmet predispose
// toward different magics), but a humanoid body has only twelve places —
// plus the Back, the house addendum — one item each, two rings. OCCUPANCY
// is enforced per GROUP; the finer ITEM_SLOTS ids survive as affinity
// labels and stable save-file references. Canon: one robe OR suit of armor
// on the body; tattoos take no slot (temporary, bodily limit 20).
const SLOT_GROUPS = {
  head:      { label: 'Head',          slots: ['head', 'hat', 'phylactery'], cap: 1 },
  eyes:      { label: 'Eyes',          slots: ['eyes'],                      cap: 1 },
  neck:      { label: 'Neck',          slots: ['neck', 'torc'],              cap: 1 },
  torso:     { label: 'Torso',         slots: ['shirt', 'vest'],             cap: 1 },
  body:      { label: 'Body',          slots: ['robe'],                      cap: 1, armorShares: true },
  waist:     { label: 'Waist',         slots: ['belt'],                      cap: 1 },
  shoulders: { label: 'Shoulders',     slots: ['shoulders'],                 cap: 1 },
  back:      { label: 'Back',          slots: ['back'],                      cap: 1, house: true },
  arms:      { label: 'Arms / Wrists', slots: ['bracers', 'bracelets'],      cap: 1 },
  hands:     { label: 'Hands',         slots: ['gloves', 'gauntlets'],       cap: 1 },
  rings:     { label: 'Rings',         slots: ['ring'],                      cap: 2 },
  feet:      { label: 'Feet',          slots: ['boots'],                     cap: 1 },
};
function slotGroupIdOf(slotId) {
  for (const gid in SLOT_GROUPS) if (SLOT_GROUPS[gid].slots.includes(slotId)) return gid;
  return null;
}

