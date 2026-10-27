// =============================================================================
// js/data/32-gadgets.js
// GADGETS
// =============================================================================
//
// WHAT'S IN HERE
//   GADGETS_CATALOG: gadgets and their effects.
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
//   tables/objects: GADGETS_CATALOG
//
// LOAD ORDER
//   File 32 of 68. index.html loads it after js/data/31-vehicles.js and before
//   js/data/33-mastercraft.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 26395-27124 of the single-file index.html at v9.19.0 (commit
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
// ---- from index.html v9.19.0, lines 26395-27124; data tables re-laid-out one record per line (values unchanged) ----
const GADGETS_CATALOG = /*<<JSON:GADGETS_CATALOG>>*/ [
  {"name": "Alternate Weapon", "type": "weapon", "purchase_dc_mod": 4, "tech_scale": 1, "multi_select": true, "restriction": "Must purchase the alternate weapon at modified cost as well.", "effect": {"kind": "ability", "category": "integration", "text": "Integrates a second (separately purchased) weapon, usable at any time; detachable or fixed (chosen at purchase). Multi-select."}},
  {"name": "Autofire Module", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 3, "subtype": ["ranged"], "restriction": "Ranged weapon without autofire.", "effect": {"kind": "ability", "category": "firing-mode", "text": "Lets a weapon that lacks autofire fire on autofire."}},
  {"name": "Autoloader Module", "type": "weapon", "purchase_dc_mod": 3, "tech_scale": 3, "subtype": ["ranged"], "restriction": "Ranged weapon using a clip or magazine.", "effect": {"kind": "ability", "category": "reload", "text": "Auto-reloads as a free action when a magazine/power pack is expended. Keyed to the weapon; not transferable."}},
  {"name": "Booby Trapped (Barbs)", "type": "weapon", "purchase_dc_mod": 4, "tech_scale": 1, "effect": {"kind": "ability", "category": "trap", "text": "Unauthorized user takes 1d6 damage each round the weapon is held."}},
  {"name": "Booby Trapped (Electric Shock)", "type": "weapon", "purchase_dc_mod": 6, "tech_scale": 3, "effect": {"kind": "ability", "category": "trap", "text": "Unauthorized user takes 1d6 electricity damage."}},
  {"name": "Booby Trapped (Stun Bolt)", "type": "weapon", "purchase_dc_mod": 6, "tech_scale": 5, "effect": {"kind": "ability", "category": "trap", "text": "Discharges a stun shock (Fortitude DC 15) at an unauthorized user; see Stun Module."}},
  {"name": "Booby Trapped (Trigger Integrated Weapon)", "type": "weapon", "purchase_dc_mod": 6, "tech_scale": 6, "effect": {"kind": "ability", "category": "trap", "text": "Fires an integrated weapon at an unauthorized user. Requires the Alternate Weapon gadget."}},
  {"name": "Collapsible", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 1, "effect": {"kind": "ability", "category": "concealment", "text": "Disassemble/reassemble as a full-round action each; disassembled form needs a Knowledge (technology) DC 17 to identify."}},
  {"name": "Compact", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 1, "subtype": ["ranged"], "restriction": "Ranged weapons only.", "effect": {"kind": "ability", "category": "size", "text": "Weapon is one size category smaller (min Diminutive). Ranged only."}},
  {"name": "Expanded Magazine", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 3, "subtype": ["ranged"], "restriction": "Ranged weapons only.", "effect": {"kind": "ability", "category": "capacity", "text": "Doubles the weapon's magazine capacity. Once per weapon."}},
  {"name": "Genetic Tags", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 6, "subtype": ["ranged", "ballistic"], "restriction": "Ranged ballistic weapons only.", "effect": {"kind": "ability", "category": "forensic", "text": "Each round fired bears a unique tag identifying the assigned user to forensic analysis."}},
  {"name": "Heads-Up Display Software, Targeting", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 6, "restriction": "Heads-up display with linked weapon only.", "effect": {"kind": "bonus", "category": "targeting", "text": "+1 equipment bonus on ranged attacks with the linked weapon; fire around corners via its video scope. Requires a weapon with the Video Scope gadget.", "contributions": [{"kind": "attackBonus", "target": "ranged", "amount": 1, "stack": "equipment", "requires": "linked weapon w/ video scope"}]}},
  {"name": "Integrated Equipment", "type": "weapon", "purchase_dc_mod": 1, "tech_scale": 1, "restriction": "Must purchase the integrated equipment at modified cost as well.", "effect": {"kind": "ability", "category": "integration", "text": "Integrates a (separately purchased) piece of equipment, usable any time; detachable or fixed. Multi-select."}},
  {"name": "Miniaturized", "type": "weapon", "purchase_dc_mod": 5, "tech_scale": 5, "subtype": ["ranged"], "restriction": "Ranged weapons only.", "effect": {"kind": "ability", "category": "size", "text": "Weapon is two size categories smaller (min Diminutive); requires miniaturized ammunition. Ranged only."}},
  {"name": "Multiphasic Chamber", "type": "weapon", "purchase_dc_mod": 4, "tech_scale": 8, "subtype": ["ballistic"], "restriction": "Ballistic weapons only.", "effect": {"kind": "ability", "category": "special", "text": "Ballistic rounds ignore the 50% miss chance from an incorporeal target."}},
  {"name": "Scope, Rangefinding Laser", "type": "weapon", "purchase_dc_mod": 1, "tech_scale": 5, "subtype": ["ranged"], "restriction": "Ranged weapons only.", "effect": {"kind": "bonus", "category": "targeting", "text": "Range increment ×1.5. Two wielders with this scope targeting the same foe: the second gains +1 equipment on their first attack (triangulation).", "contributions": [{"kind": "rangeIncrementMult", "amount": 1.5}, {"kind": "attackBonus", "target": "ranged", "amount": 1, "stack": "equipment", "situational": "ally also targeting same foe with this scope"}]}, "mountKey": "scope"},
  {"name": "Scope, Video", "type": "weapon", "purchase_dc_mod": 3, "tech_scale": 6, "subtype": ["ranged"], "restriction": "Ranged weapons only.", "effect": {"kind": "ability", "category": "utility", "text": "Rear viewscreen with zoom, freeze-frame, image enhancement, and optional video comms. No combat bonus by itself (see HUD Targeting)."}},
  {"name": "Sensor Baffling", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 5, "restriction": "See text.", "effect": {"kind": "ability", "category": "concealment", "text": "+4 on checks to conceal the weapon from sensors of equal or lower Tech Scale (no benefit vs higher-TS sensors)."}},
  {"name": "Sound Suppressor", "type": "weapon", "purchase_dc_mod": 3, "tech_scale": 7, "effect": {"kind": "ability", "category": "concealment", "text": "+10 to the DC of others' Listen checks to hear the weapon firing. Ranged only."}, "mountKey": "suppressor", "suppressRank": 2},
  {"name": "Spring Loaded", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 1, "restriction": "Spring-loaded weapon must be 1 size category smaller than the bearer.", "effect": {"kind": "grant", "category": "draw", "text": "Grants the Quick Draw benefit with this weapon (even concealed). Weapons of size Small or smaller only.", "grants_feat": "Quick Draw"}},
  {"name": "Stun Module", "type": "weapon", "purchase_dc_mod": [2, 4, 6], "tech_scale": 6, "subtype": ["energy"], "restriction": "Energy weapons only.", "effect": {"kind": "ability", "category": "stun", "text": "Adds a nonlethal stun firing mode (free action to toggle); on a hit the target makes a Fortitude save (DC 12/15/18 by tier) or is stunned 1d4 rounds. Energy weapons only."}},
  {"name": "Techno-Organic Makeup", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 7, "effect": {"kind": "ability", "category": "self-repair", "text": "Weapon self-heals 1 hp/hour; vulnerable to bio-targeted diseases/poisons."}},
  {"name": "Teleporting Magazine", "type": "weapon", "purchase_dc_mod": 6, "tech_scale": 8, "effect": {"kind": "ability", "category": "reload", "text": "Auto-reloads by teleporting a fresh magazine in when empty; requires spare magazines on hand."}},
  {"name": "Variable Ammunition", "type": "weapon", "purchase_dc_mod": 4, "tech_scale": 3, "subtype": ["ranged", "ballistic"], "restriction": "Ranged ballistic weapons only.", "effect": {"kind": "ability", "category": "capacity", "text": "Loads a second ammo type; switch as a free action (effectively doubles capacity). Multi-select. Ranged ballistic only."}},
  {"name": "Variable Charge", "type": "weapon", "purchase_dc_mod": 6, "tech_scale": 6, "subtype": ["ranged", "energy"], "restriction": "Ranged energy weapons only.", "effect": {"kind": "ability", "category": "damage", "text": "Prime as an attack action for +50% damage on the next shot (max 3 rounds; a 4th round forces a fire or the weapon explodes for +200% on the user). Energy only."}},
  {"name": "Voice Recognition System", "type": "weapon", "purchase_dc_mod": 1, "tech_scale": 6, "effect": {"kind": "ability", "category": "security", "text": "Will not fire/activate without the owner's (or designated group's) spoken command word."}},
  {"name": "Chameleonic Surface", "type": "armor", "purchase_dc_mod": 6, "tech_scale": 7, "restriction": "See description.", "effect": {"kind": "bonus", "category": "concealment", "text": "Hide bonus by armor class: +4 light, +6 medium, +10 heavy/powered/sealed.", "contributions": [{"kind": "skillBonus", "target": "Hide", "amount": "4|6|10 by armor class", "stack": "equipment"}]}},
  {"name": "Environmental Seal", "type": "armor", "purchase_dc_mod": 4, "tech_scale": 4, "subtype": ["medium", "heavy", "power"], "restriction": "Medium, heavy, or power armor only.", "effect": {"kind": "ability", "category": "life-support", "text": "Sealed life support for up to 8 hours (deep sea/space). Also always interposes its Hardness on successful hits under the T/ACtical Combat System. TS4+ (medium/heavy/powered); TS6+ for light."}},
  {"name": "Gravity Anchor", "type": "armor", "purchase_dc_mod": 4, "tech_scale": 8, "effect": {"kind": "ability", "category": "movement", "text": "Negates low-/zero-gravity effects on the wearer (full-gravity benefits anywhere)."}},
  {"name": "Integrated Equipment", "type": "armor", "purchase_dc_mod": 2, "tech_scale": 1, "restriction": "Must purchase the integrated equipment at modified cost as well.", "effect": {"kind": "ability", "category": "integration", "text": "Integrates a (separately purchased) piece of equipment into the armor, usable any time. Multi-select."}},
  {"name": "Integrated Weapon", "type": "armor", "purchase_dc_mod": 2, "tech_scale": 1, "per_unit": "weapon", "multi_select": true, "restriction": "Must purchase the integrated weapon at modified cost as well.", "effect": {"kind": "ability", "category": "integration", "text": "Integrates a (separately purchased) weapon into the armor, usable any time. Multi-select (+2 DC per weapon)."}},
  {"name": "Morphic Metal Alloy", "type": "armor", "purchase_dc_mod": 6, "tech_scale": 8, "effect": {"kind": "bonus", "category": "mobility", "text": "Reduces armor check penalty by 1 and increases maximum Dexterity bonus by 1.", "contributions": [{"kind": "armorCheckPenalty", "amount": 1, "note": "reduces penalty by 1"}, {"kind": "maxDexBonus", "amount": 1}]}},
  {"name": "Prehensile Appendage", "type": "armor", "purchase_dc_mod": 6, "tech_scale": 6, "effect": {"kind": "ability", "category": "utility", "text": "Adds a grasping limb: grapple at +2 Str using the wearer's BAB, and pick up/drop/manipulate once per round as a free action. Cannot make normal melee/ranged attacks."}},
  {"name": "Self-Repairing", "type": "armor", "purchase_dc_mod": 6, "tech_scale": 6, "effect": {"kind": "ability", "category": "self-repair", "text": "Nanites repair 1 point of armor damage per minute."}},
  {"name": "Sound Suppressor", "type": "armor", "purchase_dc_mod": 3, "tech_scale": 7, "effect": {"kind": "ability", "category": "concealment", "text": "+10 to the DC of others' Listen checks to hear the wearer moving."}},
  {"name": "Storage Compartment", "type": "armor", "purchase_dc_mod": 1, "tech_scale": 1, "multi_select": true, "restriction": "Holds 1 item up to 1 size category smaller than the armor.", "effect": {"kind": "ability", "category": "storage", "text": "Built-in compartment carries two Small-or-smaller items. Multi-select."}},
  {"name": "Techno-Organic Makeup", "type": "armor", "purchase_dc_mod": 4, "tech_scale": 7, "effect": {"kind": "ability", "category": "self-repair", "text": "Armor self-heals 1 hp/hour; vulnerable to bio-targeted diseases/poisons."}},
  {"name": "Ultralight Composition", "type": "armor", "purchase_dc_mod": 4, "tech_scale": 1, "effect": {"kind": "bonus", "category": "mobility", "text": "Reduces armor check penalty by 1 and increases the speed limitation by 5 ft (up to normal speed).", "contributions": [{"kind": "armorCheckPenalty", "amount": 1, "note": "reduces penalty by 1"}, {"kind": "speed", "amount": 5}]}},
  {"name": "Compact", "type": "equipment", "purchase_dc_mod": 1, "tech_scale": 1, "effect": {"kind": "ability", "category": "size", "text": "Equipment is one size category smaller (min Diminutive)."}},
  {"name": "Heads-Up Display Software, Biosensor", "type": "equipment", "purchase_dc_mod": 4, "tech_scale": 8, "restriction": "Heads-up display only.", "effect": {"kind": "ability", "category": "sensor", "text": "Full-round scan reads a target's current hit points. TS8; HUD only."}},
  {"name": "Heads-Up Display Software, Vehicle", "type": "equipment", "purchase_dc_mod": 2, "tech_scale": 6, "restriction": "Heads-up display only.", "effect": {"kind": "bonus", "category": "vehicle", "text": "+1 equipment bonus on Drive or Pilot checks for a linked vehicle. TS6; HUD only.", "contributions": [{"kind": "skillBonus", "target": "Drive|Pilot", "amount": 1, "stack": "equipment", "requires": "linked vehicle w/ onboard computer"}]}},
  {"name": "Heads-Up Display Software, Sensor Link", "type": "equipment", "purchase_dc_mod": 1, "tech_scale": 6, "restriction": "Heads-up display only.", "table_omission": "described HH p.272 but absent from the Purchase-DC table; DC per the description text.", "effect": {"kind": "ability", "category": "sensor", "text": "Links any computer sensor on your person to the HUD for hands-free use as a free action. TS6; HUD only."}},
  {"name": "Miniaturized", "type": "equipment", "purchase_dc_mod": 3, "tech_scale": 5, "effect": {"kind": "ability", "category": "size", "text": "Equipment is two size categories smaller (min Diminutive)."}},
  {"name": "Multiple-Use Item", "type": "equipment", "purchase_dc_mod": 1, "tech_scale": 1, "multi_select": true, "restriction": "Must purchase the alternate item at modified cost as well.", "effect": {"kind": "ability", "category": "integration", "text": "Integrates a second (separately purchased) item's function into one device. Multi-select."}},
  {"name": "Paint-On LCD", "type": "equipment", "purchase_dc_mod": 2, "tech_scale": 6, "effect": {"kind": "ability", "category": "display", "text": "Turns almost any surface into a display for computer/comms gear (weapons/armor gain display only, no combat benefit)."}},
  {"name": "Satellite Datalink", "type": "equipment", "purchase_dc_mod": 1, "tech_scale": 5, "restriction": "Only usable with gear containing computerized communications equipment.", "effect": {"kind": "ability", "category": "comms", "text": "Connects gear to a global/galactic satellite network. Requires computerized comms equipment."}},
  {"name": "Storage Compartment", "type": "equipment", "purchase_dc_mod": 1, "tech_scale": 1, "multi_select": true, "restriction": "Holds 1 item up to 1 size category smaller than the equipment.", "effect": {"kind": "ability", "category": "storage", "text": "Built-in compartment carries two items one size category smaller than the equipment. Multi-select."}},
  {"name": "Laser Sight", "type": "weapon", "purchase_dc_mod": 1, "tech_scale": 5, "subtype": ["ranged"], "mountKey": "laser", "restriction": "Firearms; can't be used outdoors in daylight.", "effect": {"kind": "bonus", "category": "targeting", "text": "+1 equipment on attack rolls vs targets within 30 ft (not outdoors in daylight). The integrated twin of the removable laser sight — they don't stack.", "contributions": [{"kind": "attackBonus", "target": "ranged", "amount": 1, "stack": "equipment", "situational": "target within 30 ft (not outdoors in daylight)"}]}},
  {"name": "Illuminator", "type": "weapon", "purchase_dc_mod": 1, "tech_scale": 4, "subtype": ["ranged"], "mountKey": "illuminator", "restriction": "Firearms.", "effect": {"kind": "ability", "category": "utility", "text": "Integrated flashlight (30-ft beam); frees a hand. The integrated twin of the removable illuminator — they don't stack."}},
  {"name": "Scope, Electro-Optical", "type": "weapon", "purchase_dc_mod": 2, "tech_scale": 5, "subtype": ["ranged"], "mountKey": "scope", "restriction": "Ranged weapons only.", "effect": {"kind": "bonus", "category": "targeting", "text": "Range increment ×1.5; in darkness, darkvision through the scope. Doesn't stack with another scope.", "contributions": [{"kind": "rangeIncrementMult", "amount": 1.5}]}}
] /*<<END:GADGETS_CATALOG>>*/;
