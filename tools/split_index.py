#!/usr/bin/env python3
# =============================================================================
# tools/split_index.py — the Phase 1 split of the E&E Character Generator
# =============================================================================
#
# WHAT THIS SCRIPT DOES
#   Up to v9.19.0 the whole Character Generator lived in ONE file, index.html:
#   about 4.8 MB and 55,350 lines holding the page markup, the CSS, an
#   embedded font, an embedded logo, roughly 3.3 MB of game data, and all of
#   the JavaScript. This script cuts that file into ordinary pieces:
#
#     index.html                the page markup, plus <script>/<link> tags
#     css/fonts.css             the @font-face rule (now points at a real file)
#     css/app.css               all other styles (themes, layout, print)
#     assets/fonts/epics-serif.ttf   the font, decoded from base64
#     assets/img/logo.jpg            the logo, decoded from base64
#     js/boot.js                the tiny script that must run in <head>
#     js/rules/NN-*.js          rule tables and the rules engine
#     js/data/NN-*.js           the big game catalogs (spells, gear, ...)
#     js/app/NN-*.js            the pages, modals, tracker, PDF, start-up
#
# THE ONE PROMISE IT KEEPS
#   Not one character of CSS or JavaScript is changed. Every piece is the
#   original text, cut at whole-line boundaries, with an explanatory comment
#   block added on top. The verify step proves it: it strips those comment
#   blocks back off, glues the pieces together in load order, and checks the
#   result is byte-for-byte identical to the original. The font and logo are
#   checked the same way (re-encoded to base64 and compared).
#
# WHY PLAIN <script src> TAGS (AND NOT "MODULES" OR A BUNDLER)
#   The original code is one big <script>, so every function and every
#   top-level const/let is visible to every other line, and the HTML calls
#   functions directly through onclick="..." attributes (369 of them).
#   Several ordinary (non-module) <script src> tags loaded one after another
#   behave the same way: they all share one global scope. So the split
#   needs no code changes, no build step, and no tooling to run the site.
#   GitHub Pages serves the folder exactly as it is.
#
#   The one thing that could differ: inside ONE script, a function can be
#   called at load time from ABOVE the line that defines it (JavaScript
#   "hoists" function definitions within a script). Across separate files
#   that would fail. Before writing this script we scanned the original for
#   load-time calls to later-defined functions and found none, and the
#   headless test suite boots the split app and checks it.
#
# HOW TO RUN IT (one time only; it has already been run for v9.19.0)
#     python tools/split_index.py --source path/to/original/index.html
#     python tools/split_index.py --verify-only --source path/to/original/index.html
#   --source must be the ORIGINAL single-file index.html (v9.19.0, commit
#   1c1044b). Every cut point below is a line number in that exact file, and
#   each one is double-checked against the text expected there, so running
#   it on any other version stops with an error instead of cutting in the
#   wrong place.
#
# The output is written into the repository folder (the parent of tools/).
#
# AFTER PHASE 1
#   Phase 2 deliberately changed two things this script produced:
#   tools/reformat_data.py re-laid out the js/data tables one record per line
#   (values unchanged), and tools/stamp_version.py added ?v=<version> to the
#   links in index.html. So --verify-only passes on the Phase 1 commits
#   only. Do not re-run the split on the current tree: it would overwrite
#   every file with the original v9.19.0 text.
# =============================================================================

import argparse
import base64
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VERSION = "v9.19.0"
SOURCE_COMMIT = "1c1044b"

# -----------------------------------------------------------------------------
# Fixed landmarks in the original file (1-based line numbers, inclusive).
# Each is checked against the text expected on that line before anything
# is written.
# -----------------------------------------------------------------------------
HEAD_SCRIPT = (7, 59)        # <script> ... </script> in <head>: error capture + theme
FONT_STYLE = (60, 73)        # <style> holding only the base64 @font-face
APP_STYLE = (74, 450)        # <style> holding every other CSS rule
LOGO_LINE = 456              # <img id="site-logo" src="data:image/jpeg;base64,...">
MAIN_SCRIPT = (2162, 55348)  # the one big <script> ... </script> at the end of <body>

LANDMARKS = {
    HEAD_SCRIPT[0]: "<script>",
    HEAD_SCRIPT[1]: "</script>",
    FONT_STYLE[0]: "<style>",
    FONT_STYLE[1]: "</style>",
    APP_STYLE[0]: "<style>",
    APP_STYLE[1]: "</style>",
    LOGO_LINE: '<img id="site-logo"',
    MAIN_SCRIPT[0]: "<script>",
    MAIN_SCRIPT[1]: "</script>",
}

# Where the decoded binaries go, and how the pages refer to them.
FONT_FILE = "assets/fonts/epics-serif.ttf"
LOGO_FILE = "assets/img/logo.jpg"

# The line that separates each file's explanatory header from the verbatim
# code beneath it. The verify step finds this line to strip the header off.
SENTINEL_PREFIX = "// ---- verbatim from index.html"
CSS_SENTINEL_PREFIX = "/* ---- verbatim from index.html"

# -----------------------------------------------------------------------------
# THE CUT LIST — every JavaScript file, in load order.
#
#   start   first line (in the original file) of this piece. The piece runs
#           until the line before the next piece's start. If the lines right
#           above `start` are // comments, the cut moves up to include them,
#           so a table never gets separated from the comment describing it.
#   expect  text that must appear on the `start` line (a safety check).
#   folder  rules / data / app — see js/README.md for what each holds.
#   name    file name (the NN- number is added automatically, in load order).
#   about   plain-English description, copied into the file's header.
#   generated  set for the pieces that Adam's data-build scripts produce
#           (names the script responsible).
#   lift    False turns off the "move up over comments" rule for one cut.
# -----------------------------------------------------------------------------
GEN_SUBSTRATE = ("equipment_substrate/build_inline_all.mjs (plus the damage_, "
                 "spells_ and vehicles_substrate builders)")
GEN_DOMAINS = "domains_substrate/build_domains.py"

PIECES = [
    # ---------------- rules: tables + the rules engine ----------------------
    dict(start=2163, expect="// ========== DATA ==========", folder="rules",
         name="races-and-base-classes",
         about="The six attribute names, every playable race (RACES: attribute "
               "adjustments, ECL, size, speed, structured racial traits), and the "
               "Hero, Ordinary and Basic class tables (HERO_CLASSES, "
               "ORDINARY_CLASSES, BASIC_CLASSES) with their per-level BAB, "
               "Defense, saves, Reputation and Action Point progressions."),
    dict(start=2514, expect="CLASS_FEATURES (v8.3.1)", folder="rules",
         name="class-features",
         about="CLASS_FEATURES: what every class gains at every level (bonus "
               "feats, talents, special abilities), the Druid option features, "
               "and the helpers that turn those features into bonus-feat counts."),
    dict(start=3410, expect="FEAT SLOTS (v8.3.2)", folder="rules",
         name="feat-slots-and-caster-progression",
         about="How many feats a character gets and from where (the feat-slot "
               "breakdown and its restriction filters), which classes cast "
               "(CASTER_CLASSES), and the spell/power-point progression tables "
               "(CASTER_PROGRESSION, PP costs per power level, pool levels) with "
               "computeCasterLevels / computeCasterStats."),
    dict(start=4293, expect="const ADVANCED_CLASSES", folder="rules",
         name="advanced-classes",
         about="ADVANCED_CLASSES: the advanced-tier class table (prerequisites "
               "and per-level progressions)."),
    dict(start=4538, expect="const SIX_LEVELS", folder="rules",
         name="six-scales-and-scenarios",
         about="The Six Scales (arcane, divine, heroic, mutation, psionic, tech; "
               "each rated 0-9), the built-in scenario presets, GM-made custom "
               "scenarios (stored in the browser), and the Scenario Studio "
               "dialog that names and saves them."),
    dict(start=4872, expect="HOMEBREW FORGE", folder="rules",
         name="homebrew-forge-armory-monstrous",
         about="GM homebrew: the Homebrew Forge (custom feats), the Homebrew "
               "Armory (custom weapons and armor), and the Monstrous Heritage "
               "lane (monster races and classes built from Foe Folio creature "
               "types). All three save to the browser and can be imported and "
               "exported."),
    dict(start=5435, expect="const PRESTIGE_CLASSES", folder="rules",
         name="prestige-classes",
         about="PRESTIGE_CLASSES, plus the class lookup and class-prerequisite "
               "checkers (getClassData, checkClassPrereqs, "
               "checkAdvancedPrereqs) used by the Create page and level-up."),
    dict(start=6184, expect="// ====", folder="rules",
         name="feat-prereqs-and-bonuses",
         about="Feat lookups and prerequisite checking, and the functions that "
               "turn owned feats and talents into numeric bonuses (feat bonuses, "
               "talent bonuses and effects, derived skill bonuses)."),
    dict(start=6737, expect="// ====", folder="rules",
         name="item-effects-and-buffs",
         about="Equipped-item effects: magic-item slot rules, firm-wired magic "
               "item effects, attribute bakes from talents; then active power "
               "effects (buffs and their durations), option-aware augments, and "
               "perpetual buffs."),
    dict(start=7402, expect="// ====", folder="rules",
         name="minds-ledger-and-magic-browser",
         about="The Mind's Ledger (Insanity & Horror tracking), the magic-item "
               "browser and inventory, specific magic arms conversions, and the "
               "skill descriptions shown on hover."),
    dict(start=8200, expect="// ====", folder="rules",
         name="cybernetics",
         about="Cybernetics (HH pp.332-339): body slots, the CYBERNETICS_DB "
               "catalog, install limits, lost/replaced limbs, and purchase DCs."),
    dict(start=8485, expect="// ====", folder="rules",
         name="wealth-and-prices",
         about="Money: the Wealth/Purchase DC to dollars ladder, price labels, "
               "market fluctuation, buying and upgrading gear, plus weapon "
               "finesse exceptions and which toolkits satisfy which skills."),
    dict(start=9084, expect="// ====", folder="rules",
         name="armor-integrity-and-enchanting",
         about="T/ACtical armor integrity (hardness by Tech Scale, armor damage), "
               "and the Enchant / Imbue builder for magic arms and armor."),
    dict(start=9651, expect="// ====", folder="rules",
         name="resistances-speed-dr-size",
         about="Speed, energy resistances and immunities, spell resistance, "
               "damage reduction, mutant subtypes, super-strength talents and "
               "the demolition math, size and damage-die steps, Hybrid races, "
               "carrying capacity and movement grants."),
    dict(start=10624, expect="// ====", folder="rules",
         name="combat-declarations-and-melee",
         about="Combat declarations (trade-offs such as Combat Expertise and "
               "focus spikes), weapon specials and riders, and the expanded "
               "melee options (Disarm, Trip, Feint, Bull Rush, ...)."),
    dict(start=11670, expect="// ====", folder="rules",
         name="worn-and-active-gear",
         about="Worn and activated equipment: gear boons, quantities, "
               "one-use items, Boost/Bane rolls, and equip parameters."),
    dict(start=11990, expect="// ====", folder="rules",
         name="per-diem-and-class-choices",
         about="Per-day class abilities (uses, rage, fatigue), level-accrued "
               "class choices (favored enemies, terrain mastery, rogue "
               "specials, high arcana, ...), companion base stats from the Foe "
               "Folio, and Take-10 skill-set designations."),
    dict(start=13079, expect="// ====", folder="rules",
         name="companions",
         about="Familiars, animal companions and mounts: species lists, "
               "progressions, derived stats, and the companion panels."),
    dict(start=13988, expect="// ====", folder="rules",
         name="bonus-aggregator-and-stat-block",
         about="The bonus engine: bonus types and stacking rules (GM's Guide "
               "pp.22-23), natural armor sources, racial bonuses, the full stat "
               "block (computeStatBlock, computeStatsFromClasses), and the "
               "conditions reference (CONDITIONS_DATA)."),
    dict(start=15001, expect="SCENARIO TITLE GENERATOR", folder="rules",
         name="scenario-titles-and-heroic-resources",
         about="The scenario title generator, Action Point and Fate Point "
               "options, heroic-level capabilities, resource budgets (feats, "
               "talents), and which tabs a character is entitled to see."),
    dict(start=15812, expect="// ====", folder="rules",
         name="quickdraw",
         about="Quickdraw: the one-click character generator, and Quickdraw "
               "Bespoke (qdBespokeBuild), the validated build path the test "
               "suite also uses to make characters."),
    dict(start=16796, expect="// ====", folder="rules",
         name="career-compass",
         about="Career Compass: level-up advice that works backwards from a "
               "chosen goal class."),
    dict(start=17634, expect="HIT POINTS (v8.2.3)", folder="rules",
         name="hit-points-xp-skills",
         about="Hit points (hero / random / max modes, rolls), the XP table, "
               "and the master SKILLS list."),
    dict(start=17953, expect="// ====", folder="rules",
         name="synergies-class-skills-citations",
         about="Skill synergies (SYNERGIES_DB), class skill lists, and the "
               "book-page CITATIONS table."),
    dict(start=18869, expect="// ====", folder="rules",
         name="citation-helpers-feats-talents-db",
         about="Citation helpers (getCitation, citeHTML), the FEATS_DB feat "
               "catalog and the TALENTS_DB talent catalog."),

    # ---------------- data: the big catalogs ---------------------------------
    # lift=False: the comment block just above this line describes
    # OCCUPATIONS_DB (file 40), not damage types. It was separated from its
    # table long ago when the generated block was inserted between them, so
    # it stays at the end of the previous file rather than heading this one.
    dict(start=19418, expect="BEGIN E&E Damage-Typing Substrate", folder="data",
         name="damage-types", generated=GEN_SUBSTRATE, lift=False,
         about="DAMAGE_TYPES: the canonical damage-type schema (base, derived "
               "and exotic descriptors). This file also carries the BEGIN "
               "marker of the generated 'substrate' block."),
    dict(start=19790, expect="const SPELL_DAMAGE", folder="data",
         name="spell-damage", generated=GEN_SUBSTRATE,
         about="SPELL_DAMAGE: damage atoms for every damaging spell and power, "
               "and SPELL_DAMAGE_EXCLUDED."),
    dict(start=21266, expect="const DamageResolver", folder="data",
         name="damage-resolver", generated=GEN_SUBSTRATE,
         about="DamageResolver: pure functions that turn damage atoms into "
               "labels, applicable resistances, immunity gates and alignment "
               "outcomes. Code, but generated along with the data."),
    dict(start=21397, expect="Equipment reference layer", folder="data",
         name="weapons", generated=GEN_SUBSTRATE,
         about="WEAPONS_CATALOG: the full weapon catalog."),
    dict(start=23956, expect="const ARMOR_CATALOG", folder="data",
         name="armor", generated=GEN_SUBSTRATE,
         about="ARMOR_CATALOG: the full armor and shield catalog."),
    dict(start=24400, expect="v8.13.x Segment A", folder="data",
         name="vehicles", generated=GEN_SUBSTRATE,
         about="VEHICLES_DB: vehicle stat tables (HH pp.314-315, p.325)."),
    dict(start=26395, expect="const GADGETS_CATALOG", folder="data",
         name="gadgets", generated=GEN_SUBSTRATE,
         about="GADGETS_CATALOG: gadgets and their effects."),
    dict(start=27125, expect="const MASTERCRAFT_RULES", folder="data",
         name="mastercraft", generated=GEN_SUBSTRATE,
         about="MASTERCRAFT_RULES: mastercraft upgrade rules."),
    dict(start=27208, expect="const EQUIPMENT_ITEMS", folder="data",
         name="equipment-items", generated=GEN_SUBSTRATE,
         about="EQUIPMENT_ITEMS: general equipment (adventuring gear, kits, "
               "tools). The whole table sits on one long line."),
    dict(start=27209, expect="const ITEM_SLOTS", folder="data",
         name="item-slots", generated=GEN_SUBSTRATE,
         about="ITEM_SLOTS (magic item slot affinities), followed by the "
               "hand-written SLOT_GROUPS body-slot table and slotGroupIdOf."),
    dict(start=27409, expect="Enchanted & Imbued Item catalogue", folder="data",
         name="magic-items", generated=GEN_SUBSTRATE,
         about="MAGIC_ITEMS_DB: the enchanted and imbued item catalog "
               "(GMG Ch.V pp.212-373)."),
    dict(start=35798, expect="Spells & Powers catalogue", folder="data",
         name="spells", generated=GEN_SUBSTRATE,
         about="SPELLS_DB: every spell and power (HH Ch.IX), full text. The "
               "whole table (about 1.2 MB) sits on one line."),
    dict(start=35802, expect="Mutations: Advantages", folder="data",
         name="mutations", generated=GEN_SUBSTRATE,
         about="MUTATIONS_DB: mutation advantages, drawbacks and the attribute "
               "chain."),
    dict(start=36885, expect="const MUTATION_RULES", folder="data",
         name="mutation-rules", generated=GEN_SUBSTRATE,
         about="MUTATION_RULES: the Mutation Point rules. This file also "
               "carries the END marker of the generated 'substrate' block."),

    # ---------------- rules again (hand-written tables) ----------------------
    dict(start=37017, expect="const OCCUPATIONS_DB", folder="rules",
         name="occupations-and-weapon-list",
         about="OCCUPATIONS_DB (starting occupations: skills, bonus feats, "
               "wealth) and WEAPONS, the short weapon list used by "
               "parameterized feats such as Weapon Focus."),

    # ---------------- app: pages, dialogs, tracker, start-up -----------------
    dict(start=37193, expect="// ========== STATE ==========", folder="app",
         name="state-storage-navigation",
         about="App state and saving: safe localStorage access, the Backup "
               "Guardian (the backup chip and its freshness colours), loading "
               "the roster (chars), the create-form state, the small utilities "
               "(attribute modifiers, save(), toast) and showPage(), which "
               "switches tabs."),
    dict(start=37422, expect="// ====", folder="app",
         name="player-tools",
         about="The version number (CG_VERSION), the unsaved-changes guard, "
               "the Report-a-bug dialog, and the Display settings (theme and "
               "text size)."),
    dict(start=37739, expect="// ========== ATTRIBUTES ==========", folder="app",
         name="create-attributes-race-occupation",
         about="Create page: attribute generation (4d6, point buy, manual), "
               "the attribute budget, racial adjustments, race info, and "
               "starting occupations."),
    dict(start=38462, expect="SIX SCALES (SCENARIO SETTINGS)", folder="app",
         name="create-scenario-gate-and-layout",
         about="Create page: the Six Scales lock gate (lock, sandbox, unlock), "
               "the collapsible section layout and mini-nav, scenario presets "
               "and Six Scales changes."),
    dict(start=39146, expect="MULTI-CLASS LIST", folder="app",
         name="create-class-list",
         about="Create page: the multi-class list (adding and removing classes "
               "and levels), class sub-options (wizard schools, psion "
               "disciplines, domains), and Scale-0 variants."),
    dict(start=39635, expect="CLASS PREVIEW & DERIVED", folder="app",
         name="create-preview-and-defense",
         about="Create page: the class preview and derived stats, attribute "
               "bumps every 4th level, the HP mode controls, and the T/ACtical "
               "combat numbers (AC display, parry, dodge)."),
    dict(start=40185, expect="SAVE CHARACTER", folder="app",
         name="save-character",
         about="Saving a character: legacy-record migration, schema versioning, "
               "typed 1st-level feat slots, the Hero's Gift checks, and "
               "saveCharacter itself."),
    dict(start=41271, expect="// ========== ROSTER ==========", folder="app",
         name="roster-and-export",
         about="The Roster page, and roster export/import (the 'courier' "
               "files that are the players' only real backup)."),
    dict(start=41450, expect="// ========== SHEET ==========", folder="app",
         name="sheet",
         about="The Character Sheet page (renderSheet) and the stat-breakdown "
               "drilldown that opens when a number is clicked."),
    dict(start=42747, expect="// ========== SKILLS ==========", folder="app",
         name="skills-page",
         about="The Skills page: class skills, skill families, ranks, synergy "
               "tooltips and spending skill points."),
    dict(start=43734, expect="// ========== FEATS ==========", folder="app",
         name="gm-exceptions-and-talents-page",
         about="GM exceptions (rule overrides granted at the table) and the "
               "Talents page with its talent browser."),
    dict(start=44352, expect="// ====", folder="app",
         name="energy-immunity-and-spell-lists",
         about="Energy-immunity talent picks, and the spell/power list tokens, "
               "schools and variant names used by the Powers/Spells pages."),
    dict(start=44554, expect="// ====", folder="data",
         name="domains", generated=GEN_DOMAINS,
         about="DOMAINS_DB (the 27 Cleric/Paladin/Saint domains, HH "
               "pp.444-451) and DOMAIN_ALIASES."),
    dict(start=46032, expect="", folder="app",
         name="powers-repertoire",
         about="A character's spell/power repertoire: caster pools, "
               "entitlement to the Spells and Powers tabs, and the powers "
               "budget."),
    dict(start=46503, expect="// ====", folder="app",
         name="mutations-engine",
         about="Mutations: the Mutation Point economy, super-power purchases "
               "with banked MP, and mutation mechanical effects."),
    dict(start=47260, expect="// ====", folder="app",
         name="supernatural-attributes-pools-psi-focus",
         about="Supernatural attributes, super talents, the Mutations page "
               "browser, blended power-point pools, metamagic preparation, and "
               "psionic focus."),
    dict(start=48147, expect="// ====", folder="app",
         name="armor-and-vehicle-integrity",
         about="The Tracker's armor-integrity panel, and vehicles: integrity, "
               "piloting, joint owners, hits and repairs."),
    dict(start=48443, expect="// ====", folder="app",
         name="power-armor",
         about="Power armor and Second Skin: loadouts, systems, slot damage."),
    dict(start=48930, expect="// ====", folder="app",
         name="mecha",
         about="Mecha: superstructures, armor types, weapons, and the mecha "
               "builder."),
    dict(start=49247, expect="// ====", folder="app",
         name="starships",
         about="Starships: size classes, subtypes, engines, armor, weapons, "
               "mounts and arcs, defenses, sensors, and the ship cards."),
    dict(start=50105, expect="// ====", folder="app",
         name="casting-augments-and-powers-page",
         about="Casting: augmentation and metamagic at cast time, the Mental "
               "Pinnacle picks, casting a power, and the Powers/Spells page "
               "(renderPowers)."),
    dict(start=50770, expect="// ====", folder="app",
         name="power-suites-feats-page-proficiencies",
         about="Super-power suites by theme, the Feats page (renderFeats and "
               "the feat list), and the class/race weapon proficiencies and "
               "granted-feat tables."),
    dict(start=52002, expect="// ====", folder="app",
         name="modals",
         about="The generic confirm and choice dialogs that replace the "
               "browser's confirm() and prompt()."),
    dict(start=52395, expect="// ========== TRACKER ==========", folder="app",
         name="tracker",
         about="The Tracker page: HP and power-point bars, HP mode, Action "
               "Points, talent action cards, bardic music, conditions, and the "
               "Hero's Gift panel."),
    dict(start=53228, expect="// ====", folder="app",
         name="tracker-logs-and-damage",
         about="Tracker: the AP/FP audit log, massive damage, nonlethal damage, "
               "AP/FP spend and restore dialogs, and the action log panel."),
    dict(start=53908, expect="// ====", folder="app",
         name="xp-spending-and-level-up",
         about="Spending XP (mastercrafting), and the level-up flow."),
    dict(start=54691, expect="// ========== PDF EXPORT ==========", folder="app",
         name="pdf-export",
         about="Print / PDF export of the character sheet (printSheet)."),
    dict(start=55309, expect="// ========== INIT ==========", folder="app",
         name="init",
         about="Start-up. Runs LAST, once every other file has loaded: fills "
               "the dropdowns, applies the default scenario, draws the roster, "
               "and wires keyboard handlers. If you add a new file, it must "
               "load before this one."),
]


# -----------------------------------------------------------------------------
# Small helpers
# -----------------------------------------------------------------------------
def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def wrap(text, width=74, indent="//   "):
    """Word-wrap `text` into comment lines that start with `indent`."""
    out, line = [], ""
    for word in text.split():
        if line and len(line) + 1 + len(word) > width:
            out.append(indent + line)
            line = word
        else:
            line = (line + " " + word) if line else word
    if line:
        out.append(indent + line)
    return out


def key_names(body_lines):
    """Top-level functions and CAPITALISED tables declared in a piece.
    Used only for the 'KEY NAMES' list in the header, to help people find
    things; it has no effect on the code."""
    fns, tables = [], []
    for l in body_lines:
        m = re.match(r"(?:async )?function ([\w$]+)", l)
        if m:
            fns.append(m.group(1))
        m = re.match(r"(?:const|let|var) ([A-Z][A-Z0-9_]{2,}|DamageResolver)\b", l)
        if m:
            tables.append(m.group(1))
    return fns, tables


def load_source(path):
    text = Path(path).read_text(encoding="utf-8")
    if "\r" in text:
        fail("source has Windows (CRLF) line endings; expected the LF original")
    if not text.endswith("\n"):
        fail("source does not end with a newline; is this the original file?")
    lines = text[:-1].split("\n")  # lines[0] is line 1
    return text, lines


def check_landmarks(lines):
    for ln, want in LANDMARKS.items():
        if want not in lines[ln - 1]:
            fail(f"line {ln} should contain {want!r} but is {lines[ln - 1][:80]!r}. "
                 f"--source must be the original {VERSION} index.html.")


def resolve_pieces(lines):
    """Turn the cut list into concrete (first, last) line ranges.

    Each start is checked against its `expect` text, then moved up over any
    // comment lines directly above it, so a table keeps its description."""
    body_first, body_last = MAIN_SCRIPT[0] + 1, MAIN_SCRIPT[1] - 1
    starts = []
    for p in PIECES:
        s = p["start"]
        if p["expect"] not in lines[s - 1]:
            fail(f"cut for {p['name']}: line {s} should contain {p['expect']!r} "
                 f"but is {lines[s - 1][:80]!r}")
        while p.get("lift", True) and s - 1 > body_first and lines[s - 2].startswith("//"):
            s -= 1
        starts.append(s)
    if starts[0] != body_first:
        fail(f"first piece must start at line {body_first}, got {starts[0]}")
    if starts != sorted(starts) or len(set(starts)) != len(starts):
        fail("cut list is out of order")
    ranges = []
    for i, s in enumerate(starts):
        e = (starts[i + 1] - 1) if i + 1 < len(starts) else body_last
        ranges.append((s, e))
    return ranges


def piece_path(i, p):
    return f"js/{p['folder']}/{i + 1:02d}-{p['name']}.js"


# -----------------------------------------------------------------------------
# Header writers — the "verbose comments" at the top of every file
# -----------------------------------------------------------------------------
def js_header(i, p, first, last, body, paths):
    n = len(PIECES)
    path = paths[i]
    title = p["name"].replace("-", " ")
    h = ["// " + "=" * 77,
         f"// {path}",
         f"// {title.upper()}",
         "// " + "=" * 77,
         "//",
         "// WHAT'S IN HERE"]
    h += wrap(p["about"])
    if p.get("generated"):
        # NOTE: this text deliberately never spells out the marker syntax
        # itself; scripts find tables by searching for those markers, and a
        # copy of one in a comment could be mistaken for the real thing.
        h += ["//",
              "// ORIGINALLY GENERATED: READ THIS BEFORE CHANGING THE DATA"]
        h += wrap("These tables were first built by Adam's data-build scripts "
                  f"({p['generated']}), which live in the private EE-Rulebooks "
                  "repository. Those scripts are NOT a working build any more: "
                  "each was written to patch one specific old copy of the "
                  "generator (the newest targets v8.49.0), and since then the "
                  "data has been edited directly in the generator. For most "
                  "catalogs (equipment, armor, gadgets, weapons, item slots, "
                  "vehicles, magic items) their source JSON files are now OLDER "
                  "than this file, and some catalogs are missing from the "
                  "combined block entirely, so re-running them would silently "
                  "delete newer content. Treat THIS file as the source of "
                  "truth. The JSON/END marker comments around each table, and "
                  "the BEGIN/END substrate banner lines, are kept unchanged so "
                  "a future script can still find the tables.")
    fns, tables = key_names(body)
    if tables or fns:
        h += ["//", "// KEY NAMES (so you can search for them)"]
        if tables:
            h += wrap("tables/objects: " + ", ".join(tables[:40]) +
                      (f", ... and {len(tables) - 40} more" if len(tables) > 40 else ""))
        if fns:
            h += wrap(f"functions ({len(fns)}): " + ", ".join(fns[:40]) +
                      (f", ... and {len(fns) - 40} more" if len(fns) > 40 else ""))
    before = paths[i - 1] if i > 0 else "js/boot.js (in <head>)"
    after = paths[i + 1] if i + 1 < n else "(nothing; this is the last file)"
    h += ["//",
          "// LOAD ORDER"]
    h += wrap(f"File {i + 1} of {n}. index.html loads it after {before} and "
              f"before {after}.")
    h += wrap("All the js/ files share ONE global scope: they are plain "
              "<script src> tags, not modules. Anything declared here is "
              "visible to every other file, and functions here may call "
              "functions in any other file. The one rule: code that runs "
              "IMMEDIATELY when this file loads (anything not inside a "
              "function) may only use things from files loaded EARLIER. "
              "See js/README.md.")
    h += ["//",
          "// WHERE IT CAME FROM"]
    h += wrap(f"Lines {first}-{last} of the single-file index.html at {VERSION} "
              f"(commit {SOURCE_COMMIT}), moved here unchanged by "
              "tools/split_index.py. The version notes inside the code "
              "(\"v8.3.17 ...\", \"Adam's ruling ...\", the section numbers) "
              "are the original change history and were kept as they were.")
    h += ["//",
          f"{SENTINEL_PREFIX} {VERSION}, lines {first}-{last}; "
          "unchanged below this line ----"]
    return h


def write(path, text, binary=False):
    full = REPO / path
    full.parent.mkdir(parents=True, exist_ok=True)
    if binary:
        full.write_bytes(text)
    else:
        # newline="\n": keep LF endings on Windows too, same as the original.
        with open(full, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)


def strip_header(text, sentinel_prefix):
    """Inverse of the header: everything after the sentinel line."""
    lines = text.split("\n")
    hits = [k for k, l in enumerate(lines) if l.startswith(sentinel_prefix)]
    if len(hits) != 1:
        fail(f"expected exactly one sentinel line, found {len(hits)}")
    return "\n".join(lines[hits[0] + 1:])


# -----------------------------------------------------------------------------
# The split
# -----------------------------------------------------------------------------
def split(lines):
    ranges = resolve_pieces(lines)
    paths = [piece_path(i, p) for i, p in enumerate(PIECES)]
    total = len(PIECES)

    # --- JavaScript pieces --------------------------------------------------
    for i, p in enumerate(PIECES):
        first, last = ranges[i]
        body = lines[first - 1:last]
        header = js_header(i, p, first, last, body, paths)
        write(paths[i], "\n".join(header + body) + "\n")

    # --- js/boot.js (the <head> script) --------------------------------------
    hs, he = HEAD_SCRIPT
    boot_body = lines[hs:he - 1]
    boot_hdr = ["// " + "=" * 77,
                "// js/boot.js",
                "// BOOT: RUNS IN <head>, BEFORE THE PAGE IS DRAWN",
                "// " + "=" * 77,
                "//",
                "// WHAT'S IN HERE"]
    boot_hdr += wrap("(1) A small ring buffer that records the last few errors "
                     "(window errors, unhandled promise rejections, "
                     "console.error) so the Report-a-bug dialog can attach "
                     "them. (2) The Display preferences (colour theme and text "
                     "size), applied before the first paint so a High Contrast "
                     "player never sees a flash of the default theme.")
    boot_hdr += ["//", "// LOAD ORDER"]
    boot_hdr += wrap("Loaded by a plain <script src> tag in <head>, so it runs "
                     "before the page body exists and before every other js/ "
                     "file. It must stay in <head> and must not be marked "
                     "defer or async; either would let the page paint first.")
    boot_hdr += ["//", "// WHERE IT CAME FROM"]
    boot_hdr += wrap(f"Lines {hs + 1}-{he - 1} of the single-file index.html at "
                     f"{VERSION} (commit {SOURCE_COMMIT}), moved here unchanged "
                     "by tools/split_index.py.")
    boot_hdr += ["//", f"{SENTINEL_PREFIX} {VERSION}, lines {hs + 1}-{he - 1}; "
                       "unchanged below this line ----"]
    write("js/boot.js", "\n".join(boot_hdr + boot_body) + "\n")

    # --- css/app.css -----------------------------------------------------------
    cs, ce = APP_STYLE
    css_body = lines[cs:ce - 1]
    css_hdr = ["/* " + "=" * 74,
               "   css/app.css",
               "   EVERY STYLE RULE EXCEPT THE FONT",
               "   " + "=" * 74,
               "",
               "   WHAT'S IN HERE",
               "     The colour tokens for the three themes (Parchment, the default;",
               "     Classic; High Contrast), page layout, every component, the",
               "     text-size steps, and the print styles. Themes switch by setting",
               "     data-theme on <html> (js/boot.js does that before first paint).",
               "",
               "   WHERE IT CAME FROM",
               f"     Lines {cs + 1}-{ce - 1} of the single-file index.html at {VERSION}",
               f"     (commit {SOURCE_COMMIT}), moved here unchanged by",
               "     tools/split_index.py.",
               "   " + "=" * 74 + " */",
               f"{CSS_SENTINEL_PREFIX} {VERSION}, lines {cs + 1}-{ce - 1}; "
               "unchanged below this line ---- */"]
    write("css/app.css", "\n".join(css_hdr + css_body) + "\n")

    # --- the font: decode the base64 into a real file; css/fonts.css points at it
    fs, fe = FONT_STYLE
    font_lines = lines[fs:fe - 1]
    font_re = re.compile(r"url\(data:font/ttf;base64,([A-Za-z0-9+/=]+)\)")
    hits = [k for k, l in enumerate(font_lines) if font_re.search(l)]
    if len(hits) != 1:
        fail("could not find exactly one embedded font")
    k = hits[0]
    font_b64 = font_re.search(font_lines[k]).group(1)
    write(FONT_FILE, base64.b64decode(font_b64), binary=True)
    font_lines = list(font_lines)
    font_lines[k] = font_re.sub(f"url('../{FONT_FILE}')", font_lines[k])
    fonts_hdr = ["/* " + "=" * 74,
                 "   css/fonts.css",
                 "   THE 'Epics Serif' FONT",
                 "   " + "=" * 74,
                 "",
                 "   WHAT'S IN HERE",
                 "     One @font-face rule. The font file used to be embedded right",
                 "     here as about 89 KB of base64 text; it is now a real file,",
                 f"     {FONT_FILE}. The path below is relative to this",
                 "     css/ folder, hence the '../'.",
                 "",
                 "   WHERE IT CAME FROM",
                 f"     Lines {fs + 1}-{fe - 1} of the single-file index.html at {VERSION}",
                 f"     (commit {SOURCE_COMMIT}). The only change: the base64 data: URL",
                 "     became the file path. The font bytes are identical.",
                 "   " + "=" * 74 + " */",
                 f"{CSS_SENTINEL_PREFIX} {VERSION}, lines {fs + 1}-{fe - 1}; "
                 "only the font url() differs ---- */"]
    write("css/fonts.css", "\n".join(fonts_hdr + font_lines) + "\n")

    # --- the logo: decode it; the <img> now points at the file ---------------
    logo_re = re.compile(r'src="data:image/jpeg;base64,([A-Za-z0-9+/=]+)"')
    m = logo_re.search(lines[LOGO_LINE - 1])
    if not m:
        fail("could not find the embedded logo")
    write(LOGO_FILE, base64.b64decode(m.group(1)), binary=True)
    logo_line = logo_re.sub(f'src="{LOGO_FILE}"', lines[LOGO_LINE - 1])

    # --- index.html ------------------------------------------------------------
    out = []
    out += lines[0:hs - 1]                       # <!DOCTYPE> ... <title>
    out += [
        "<!-- ======================================================================",
        "     HOW THIS PAGE IS PUT TOGETHER (since the Phase 1 split, " + VERSION + ")",
        "",
        "     Until " + VERSION + " everything (styles, font, logo, data and code) was",
        "     inside this one file. It now lives in ordinary files next to it:",
        "       js/boot.js        error capture + theme; must run here, in <head>",
        "       css/fonts.css     the @font-face rule (font file: " + FONT_FILE + ")",
        "       css/app.css       every other style rule",
        "       " + LOGO_FILE + "  the logo",
        "       js/rules, js/data, js/app   the app itself (" + str(total) + " files), loaded",
        "                         at the bottom of <body>, in order",
        "     There is no build step: GitHub Pages serves these files as they are.",
        "     Opening this file straight from disk (file://) also works, as long as",
        "     the folders sit next to it. See js/README.md for the full map.",
        "     ====================================================================== -->",
        '<script src="js/boot.js"></script>',
        '<link rel="stylesheet" href="css/fonts.css">',
        '<link rel="stylesheet" href="css/app.css">',
    ]
    out += lines[APP_STYLE[1]:LOGO_LINE - 1]     # </head> <body> ... up to the logo
    out.append(logo_line)
    out += lines[LOGO_LINE:MAIN_SCRIPT[0] - 1]   # rest of the markup
    out += [
        "",
        "<!-- ======================================================================",
        "     THE APP'S JAVASCRIPT: " + str(total) + " files, loaded IN THIS EXACT ORDER.",
        "",
        "     These are plain <script src> tags (not modules), so all the files",
        "     share ONE global scope, exactly as when they were one big <script>.",
        "     A function in any file can call a function in any other file. But",
        "     code that runs immediately at load time (not inside a function)",
        "     can only use things from files ABOVE it, so the order matters.",
        "     The NN- number in each file name is its position in this list.",
        "",
        "     js/rules  rule tables (races, classes, feats, ...) and the engine",
        "               that turns a character into numbers",
        "     js/data   the big game catalogs (spells, magic items, weapons, ...).",
        "               Most were first built by data-build scripts that are now",
        "               out of date; read a file's header before editing it.",
        "     js/app    the pages (Create, Sheet, Skills, Gear, Tracker, ...),",
        "               dialogs, saving, and start-up (the last file, init.js)",
        "     ====================================================================== -->",
    ]
    last_folder = None
    for i, p in enumerate(PIECES):
        if p["folder"] != last_folder:
            label = {"rules": "rules + engine", "data": "game catalogs",
                     "app": "pages, dialogs, tracker, start-up"}[p["folder"]]
            out.append(f"<!-- js/{p['folder']}: {label} -->")
            last_folder = p["folder"]
        out.append(f'<script src="{paths[i]}"></script>')
    out += lines[MAIN_SCRIPT[1]:]                # </body> </html>
    write("index.html", "\n".join(out) + "\n")

    print(f"Wrote {total} JavaScript files, js/boot.js, css/app.css, "
          f"css/fonts.css, {FONT_FILE}, {LOGO_FILE} and a new index.html.")
    for i, (s, e) in enumerate(ranges):
        print(f"  {paths[i]:58} lines {s:>5}-{e:<5} ({e - s + 1:>5} lines)")


# -----------------------------------------------------------------------------
# The proof: put the pieces back together and compare with the original
# -----------------------------------------------------------------------------
def verify(lines):
    ok = True
    ranges = resolve_pieces(lines)
    paths = [piece_path(i, p) for i, p in enumerate(PIECES)]

    # 1. All JS pieces, headers stripped, glued in order == the original <script>.
    glued = "".join(strip_header((REPO / pth).read_text(encoding="utf-8"),
                                 SENTINEL_PREFIX) for pth in paths)
    orig = "\n".join(lines[MAIN_SCRIPT[0]:MAIN_SCRIPT[1] - 1]) + "\n"
    same = glued == orig
    ok &= same
    print(f"  main script: {len(paths)} files reassemble to the original "
          f"({len(orig):,} chars): {'IDENTICAL' if same else 'DIFFERENT'}")

    # 2. js/boot.js == the <head> script.
    hs, he = HEAD_SCRIPT
    same = strip_header((REPO / "js/boot.js").read_text(encoding="utf-8"),
                        SENTINEL_PREFIX) == "\n".join(lines[hs:he - 1]) + "\n"
    ok &= same
    print(f"  js/boot.js: {'IDENTICAL' if same else 'DIFFERENT'}")

    # 3. css/app.css == the main <style>.
    cs, ce = APP_STYLE
    same = strip_header((REPO / "css/app.css").read_text(encoding="utf-8"),
                        CSS_SENTINEL_PREFIX) == "\n".join(lines[cs:ce - 1]) + "\n"
    ok &= same
    print(f"  css/app.css: {'IDENTICAL' if same else 'DIFFERENT'}")

    # 4. css/fonts.css with the font re-embedded == the font <style>.
    fs, fe = FONT_STYLE
    b64 = base64.b64encode((REPO / FONT_FILE).read_bytes()).decode()
    rebuilt = strip_header((REPO / "css/fonts.css").read_text(encoding="utf-8"),
                           CSS_SENTINEL_PREFIX).replace(
        f"url('../{FONT_FILE}')", f"url(data:font/ttf;base64,{b64})")
    same = rebuilt == "\n".join(lines[fs:fe - 1]) + "\n"
    ok &= same
    print(f"  css/fonts.css + {FONT_FILE}: {'IDENTICAL' if same else 'DIFFERENT'}")

    # 5. The logo bytes.
    b64 = base64.b64encode((REPO / LOGO_FILE).read_bytes()).decode()
    same = f"base64,{b64}\"" in lines[LOGO_LINE - 1]
    ok &= same
    print(f"  {LOGO_FILE}: {'IDENTICAL' if same else 'DIFFERENT'}")

    # 6. index.html loads every piece, once, in order.
    idx = (REPO / "index.html").read_text(encoding="utf-8")
    srcs = re.findall(r'<script src="(js/[^"]+)"></script>', idx)
    same = srcs == ["js/boot.js"] + paths
    ok &= same
    print(f"  index.html loads {len(srcs)} scripts in the right order: "
          f"{'YES' if same else 'NO'}")

    # 7. Outside the extracted blocks, index.html's markup is unchanged.
    markup_orig = (lines[0:hs - 1] + lines[APP_STYLE[1]:LOGO_LINE - 1] +
                   lines[LOGO_LINE:MAIN_SCRIPT[0] - 1] + lines[MAIN_SCRIPT[1]:])
    idx_lines = idx[:-1].split("\n")
    pos, missing = 0, 0
    for l in markup_orig:            # every original markup line, in order
        try:
            pos = idx_lines.index(l, pos) + 1
        except ValueError:
            missing += 1
    ok &= missing == 0
    print(f"  index.html keeps all {len(markup_orig):,} original markup lines "
          f"in order: {'YES' if missing == 0 else f'NO ({missing} missing)'}")

    print("VERIFY: " + ("PASSED" if ok else "FAILED"))
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True,
                    help=f"the ORIGINAL single-file index.html ({VERSION})")
    ap.add_argument("--verify-only", action="store_true",
                    help="only check the already-split files against --source")
    a = ap.parse_args()
    _, lines = load_source(a.source)
    check_landmarks(lines)
    if not a.verify_only:
        split(lines)
    sys.exit(0 if verify(lines) else 1)


if __name__ == "__main__":
    main()
