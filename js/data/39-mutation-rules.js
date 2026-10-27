// =============================================================================
// js/data/39-mutation-rules.js
// MUTATION RULES
// =============================================================================
//
// WHAT'S IN HERE
//   MUTATION_RULES: the Mutation Point rules. This file also carries the END
//   marker of the generated 'substrate' block.
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
//   tables/objects: MUTATION_RULES
//
// LOAD ORDER
//   File 39 of 68. index.html loads it after js/data/38-mutations.js and
//   before js/rules/40-occupations-and-weapon-list.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 36885-37016 of the single-file index.html at v9.19.0 (commit
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
// ---- from index.html v9.19.0, lines 36885-37016; data tables re-laid-out one record per line (values unchanged) ----
const MUTATION_RULES = /*<<JSON:MUTATION_RULES>>*/ {
  "_meta": {"title": "E&E Mutation Point System Rules (reference data)", "source": "Hero's Handbook 2026-05-19, Ch.IX pp.410-424 (Mutations; Mutation Points; Extraordinary and Supernatural Attributes; Supernatural Mutations aka Super-Powers)", "prepared_by": "Claude Code, 2026-08-23"},
  "availability": {"mutation_scale_min": 1, "super_powers_mutation_scale_min": 5, "excluded_creature_types": ["Construct", "Elemental", "Outsider", "Undead"], "note": "All creatures begin play with 0 MP. A creature with 1+ MP takes on the Mutant racial subtype."},
  "economy": {"spend_rule": "Total MP spent on Advantages (and Super-Powers / attribute mutations) cannot exceed total MP gained; unspent MP is banked and spendable later.", "sources": ["Drawbacks (each grants its MP Value)", "Slightly Different feat", "Unstable Mutation feat (per instance)", "Supernatural Mutation feat (tier grant, see tiers)", "GM grants"], "gm_grants_model": "discrete logged events (Claude's ruling on open handoff Q6, 2026-08-23 — consistent with the gmExceptions audit-trail philosophy; flagged to Adam)"},
  "categories": {
    "cosmetic": {"mp": [0, 0], "note": "appearance only; possible circumstance modifiers to social skills at GM's discretion"},
    "minor_advantage": {"mp": [1, 3], "ability_type": "extraordinary", "action": "free action unless noted"},
    "major_advantage": {"mp": [4, 6], "ability_type": "extraordinary", "action": "free action unless noted"},
    "super_power": {"mp": [1, 20], "mp_open_ended": true, "ability_type": "supernatural", "action": "standard action unless noted", "note": "spells/powers purchased at their entry's listed MP cost (SPELLS_DB .mp)"},
    "drawback": {"note": "grants its MP Value"}
  },
  "obvious_rule": "Obvious Advantages/Drawbacks incur a cumulative -2 penalty to Disguise checks per obvious mutation concealed.",
  "mutant_level_modifier": {"formula": "floor(total_MP / 10)", "effect": "+1 Mutant racial level modifier (and +1 ECL) per full 10 MP"},
  "super_mutant_tiers": [
    {"tier": "Minor", "mutant_level": 0, "mp_grant": 2, "spell_levels": [1, 3], "max_mp_per_power": 6, "pp_multiplier": 0.5},
    {"tier": "Moderate", "mutant_level": 1, "mp_grant": 10, "spell_levels": [1, 5], "max_mp_per_power": 10, "pp_multiplier": 1},
    {"tier": "Major", "mutant_level": 2, "mp_grant": 20, "spell_levels": [1, 9], "max_mp_per_power": 20, "pp_multiplier": 1},
    {"tier": "Mega", "mutant_level": 3, "mp_grant": 30, "spell_levels": [1, 9], "max_mp_per_power": null, "pp_multiplier": 1}
  ],
  "tier_requires_feat": "Supernatural Mutation",
  "eml": {"formula": "character_level + mutant_level_modifier", "super_pp_per_day": "MP_total + EML^2 + bonusPP(WIS, EML)  [Minor tier: half]", "min_manifestation": "a power costing more than the whole pool may be manifested once by spending the entire pool", "min_manifester_level": "a super-power always manifests at a level at least equal to its PP cost"},
  "super_power_semantics": {"complimentary": "mp_note 'includes X (and Y)' — those spells/powers are granted FREE with the purchase, cascading recursively.", "buff": "mp_note 'Buff' — range becomes Personal, target You, duration Permanent or at-will; costs 0 PP unaugmented; variable aspects manifest at EML; never shared with familiars/companions.", "no_aoo": "Super-powers are supernatural: no attacks of opportunity, cannot be disrupted/countered, ignore spell/power resistance; suppressed by anti-supernatural effects (e.g. Null Power Field)."}
} /*<<END:MUTATION_RULES>>*/;
// ===== END E&E Damage-Typing Substrate =====

