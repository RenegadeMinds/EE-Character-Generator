// =============================================================================
// js/data/33-mastercraft.js
// MASTERCRAFT
// =============================================================================
//
// WHAT'S IN HERE
//   MASTERCRAFT_RULES: mastercraft upgrade rules.
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
//   tables/objects: MASTERCRAFT_RULES
//
// LOAD ORDER
//   File 33 of 68. index.html loads it after js/data/32-gadgets.js and before
//   js/data/34-equipment-items.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 27125-27207 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 27125-27207; unchanged below this line ----
const MASTERCRAFT_RULES = /*<<JSON:MASTERCRAFT_RULES>>*/ {
  "_meta": {
    "title": "E&E Mastercrafting Rules (reference data)",
    "source": "Hero's Handbook 2026-05-19, pp.274-275 (Mastercrafting Objects)",
    "prepared_by": "Claude Code (Opus 4.8), 2026-06-29",
    "principle": "Static reference. The per-character pass enforces these against an owned item's kind + the scenario Tech Scale."
  },
  "max_bonus": 3,
  "gadget_slots_formula": "1 + mastercraft_bonus",
  "single_feature_per_item": true,
  "tech_scale_cap": {
    "note": "Max mastercraft bonus permitted by the scenario's Tech Scale (HH p.275 table). TS0 = none.",
    "thresholds": [
      {
        "min_tech_scale": 1,
        "max_bonus": 1
      },
      {
        "min_tech_scale": 2,
        "max_bonus": 2
      },
      {
        "min_tech_scale": 4,
        "max_bonus": 3
      }
    ]
  },
  "targets_by_kind": {
    "weapon": {
      "choose_one": [
        "attack",
        "damage"
      ],
      "exclusive": true,
      "note": "Never both (HH p.275)."
    },
    "armor": {
      "choose_one": [
        "defense",
        "mobility"
      ],
      "exclusive": true,
      "note": "Adam's amendment 2026-09-02 (HH p.275 book edit on the TODO): improves the armor's equipment bonus to Defense OR its mobility (raises the armor's maximum Dex bonus by the mastercraft bonus). Never both."
    },
    "electronic_mechanical": {
      "target": "skill_check",
      "note": "Equipment bonus on the skill check to use the object."
    },
    "vehicle": {
      "target": "skill_check",
      "skills": [
        "Drive",
        "Pilot"
      ]
    }
  },
  "bonus_tiers": [
    {
      "bonus": 1,
      "xp": 250,
      "craft_dc_mod": 3,
      "purchase_dc_mod": 1,
      "total_gadget_slots": 2,
      "min_tech_scale": 1
    },
    {
      "bonus": 2,
      "xp": 500,
      "craft_dc_mod": 5,
      "purchase_dc_mod": 2,
      "total_gadget_slots": 3,
      "min_tech_scale": 2
    },
    {
      "bonus": 3,
      "xp": 750,
      "craft_dc_mod": 10,
      "purchase_dc_mod": 3,
      "total_gadget_slots": 4,
      "min_tech_scale": 4
    }
  ]
} /*<<END:MASTERCRAFT_RULES>>*/;
