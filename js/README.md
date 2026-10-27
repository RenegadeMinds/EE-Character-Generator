# The Character Generator's code: a map

Up to v9.19.0 the whole generator was one 4.8 MB `index.html`. The **Phase 1
split** (`tools/split_index.py`) cut it into the files described here.
**No code was changed**: every file is the original text, cut between whole
statements, with an explanatory comment block on top.

## How the pieces fit together

```
index.html            the page markup + the tags that load everything below
js/boot.js            runs first, in <head>: error capture for 🐞 Report, theme + text size
css/fonts.css         the @font-face rule  →  assets/fonts/epics-serif.ttf
css/app.css           every other style (three themes, layout, print)
assets/img/logo.jpg   the Pair o' Dice logo
js/rules/NN-*.js      rule tables (races, classes, feats, ...) and the engine
js/data/NN-*.js       the big game catalogs (spells, magic items, weapons, ...)
js/app/NN-*.js        the pages, dialogs, saving, tracker, PDF, and start-up
```

There is **no build step**. GitHub Pages serves these files as they are, and
opening `index.html` straight from disk works too, as long as the folders sit
beside it.

### The one rule: load order

`index.html` loads the `js/` files with plain `<script src>` tags, **in
number order** (the `NN-` prefix is each file's position in that list).
Plain script tags (not "modules") all share **one global scope**, exactly as
when the code was a single `<script>`. So:

- A function in any file can call a function in any other file. By the time
  anyone clicks anything, every file has loaded.
- Code that runs **immediately when its file loads** (anything not inside a
  function, such as building a table from another table) can only use things
  from files with a **lower number**.
- `68-init.js` must stay last: it starts the app once everything is loaded.

### Adding a new file

1. Put it in the folder that fits (`rules`, `data` or `app`).
2. Add a `<script src="...">` line to `index.html` in the right place:
   after anything its load-time code needs, and before `68-init.js`.
3. Give it a header comment like the existing files have.

Numbers don't have to stay contiguous. If a new file goes between `21-` and
`22-`, call it `21b-...` rather than renumbering everything.

### Data files that were once generated: the generator is now the source of truth

The files marked **once generated** below were first built by Adam's
data-build scripts, which live in the private EE-Rulebooks repository
(`equipment_substrate/build_inline_all.mjs`, `damage_substrate/`,
`spells_substrate/`, `vehicles_substrate/`, `magic_items_substrate/`,
`mutations_substrate/`, `domains_substrate/build_domains.py`).

**Those scripts are not a working build any more, and must not be re-run as
they are.** A check against v9.19.0 (October 2026) found:

- Each splice script was written to patch **one specific old copy** of the
  generator (`EpicsAndEpochs_Character_Generator_v8.x.html`). The newest
  one targets v8.49.0. None of them points at `index.html`.
- Since then the data has been edited **directly in the generator**, so the
  source JSON files are now **older** than the generator for most catalogs:
  equipment items (22 in the source vs 312 in the generator), armor (30 vs
  34), gadgets (47 vs 50), weapons (108 vs 110), item slots (22 vs 23),
  vehicles (80 vs 90), magic items, spell damage and domains. Spells,
  mutations, mutation rules and damage types still match.
- The main splicer (`equipment_substrate/inline_into_generator.mjs`)
  replaces **everything** between the BEGIN and END "Damage-Typing
  Substrate" banner lines with `inline_block_all.js`. That block has no
  vehicles or magic items and predates the hand-written `SLOT_GROUPS` table
  that now sits inside the banners. Running it would silently delete all of
  that.

So: **edit the data in these files directly**, and treat the generator as
the source of truth. The JSON/END marker comments around each table and the
BEGIN/END banner lines are kept unchanged, so a future script can still
find the tables. (Since the split, the BEGIN banner is in
`26-damage-types.js` and the END banner is in `39-mutation-rules.js`, 14
files apart, so any new tool should work table by table, not by banner.)

### Finding things

Search the `js/` folder for the name (every file header lists the main
functions and tables it holds), or use the table below. The original code
comments, including the version notes ("v8.3.17 ...", "Adam's ruling ...",
the § numbers), are the change history and were kept as they were.

## Checking the split (and any future "should change nothing" edit)

- `python tools/split_index.py --verify-only --source <original index.html>`
  glues the pieces back together and checks they are byte-for-byte identical
  to the original v9.19.0 file (commit `1c1044b`).
- `OLD=<original index.html> node battery/_probe_split_parity.mjs` boots the
  old and new builds side by side in headless Chrome and checks they behave
  identically: every global value, the page markup, five built characters,
  and every page rendered for each of them.

## Running it locally

From the repository folder:

```
python -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` directly also works.
A local server just matches how the live site behaves.)

## Every file, in load order

`js/boot.js` loads first, in `<head>`. Then:

| # | File | Lines | Size | Once generated | What's in it |
|---|---|---|---|---|---|
| 1 | `js/rules/01-races-and-base-classes.js` | 351 | 31 KB |  | The six attribute names, every playable race (RACES: attribute adjustments, ECL, size, speed, structured racial traits), and the Hero, Ordinary and Basic class tables (HERO_CLASSES, ORDINARY_CLASSES, BASIC_CLASSES) with their per-level BAB, Defense, saves, Reputation and Action Point progressions. |
| 2 | `js/rules/02-class-features.js` | 896 | 117 KB |  | CLASS_FEATURES: what every class gains at every level (bonus feats, talents, special abilities), the Druid option features, and the helpers that turn those features into bonus-feat counts. |
| 3 | `js/rules/03-feat-slots-and-caster-progression.js` | 883 | 49 KB |  | How many feats a character gets and from where (the feat-slot breakdown and its restriction filters), which classes cast (CASTER_CLASSES), and the spell/power-point progression tables (CASTER_PROGRESSION, PP costs per power level, pool levels) with computeCasterLevels / computeCasterStats. |
| 4 | `js/rules/04-advanced-classes.js` | 243 | 12 KB |  | ADVANCED_CLASSES: the advanced-tier class table (prerequisites and per-level progressions). |
| 5 | `js/rules/05-six-scales-and-scenarios.js` | 336 | 20 KB |  | The Six Scales (arcane, divine, heroic, mutation, psionic, tech; each rated 0-9), the built-in scenario presets, GM-made custom scenarios (stored in the browser), and the Scenario Studio dialog that names and saves them. |
| 6 | `js/rules/06-homebrew-forge-armory-monstrous.js` | 557 | 37 KB |  | GM homebrew: the Homebrew Forge (custom feats), the Homebrew Armory (custom weapons and armor), and the Monstrous Heritage lane (monster races and classes built from Foe Folio creature types). |
| 7 | `js/rules/07-prestige-classes.js` | 755 | 40 KB |  | PRESTIGE_CLASSES, plus the class lookup and class-prerequisite checkers (getClassData, checkClassPrereqs, checkAdvancedPrereqs) used by the Create page and level-up. |
| 8 | `js/rules/08-feat-prereqs-and-bonuses.js` | 553 | 33 KB |  | Feat lookups and prerequisite checking, and the functions that turn owned feats and talents into numeric bonuses (feat bonuses, talent bonuses and effects, derived skill bonuses). |
| 9 | `js/rules/09-item-effects-and-buffs.js` | 665 | 48 KB |  | Equipped-item effects: magic-item slot rules, firm-wired magic item effects, attribute bakes from talents; then active power effects (buffs and their durations), option-aware augments, and perpetual buffs. |
| 10 | `js/rules/10-minds-ledger-and-magic-browser.js` | 798 | 90 KB |  | The Mind's Ledger (Insanity & Horror tracking), the magic-item browser and inventory, specific magic arms conversions, and the skill descriptions shown on hover. |
| 11 | `js/rules/11-cybernetics.js` | 279 | 29 KB |  | Cybernetics (HH pp.332-339): body slots, the CYBERNETICS_DB catalog, install limits, lost/replaced limbs, and purchase DCs. |
| 12 | `js/rules/12-wealth-and-prices.js` | 605 | 39 KB |  | Money: the Wealth/Purchase DC to dollars ladder, price labels, market fluctuation, buying and upgrading gear, plus weapon finesse exceptions and which toolkits satisfy which skills. |
| 13 | `js/rules/13-armor-integrity-and-enchanting.js` | 567 | 35 KB |  | T/ACtical armor integrity (hardness by Tech Scale, armor damage), and the Enchant / Imbue builder for magic arms and armor. |
| 14 | `js/rules/14-resistances-speed-dr-size.js` | 973 | 64 KB |  | Speed, energy resistances and immunities, spell resistance, damage reduction, mutant subtypes, super-strength talents and the demolition math, size and damage-die steps, Hybrid races, carrying capacity and movement grants. |
| 15 | `js/rules/15-combat-declarations-and-melee.js` | 1,046 | 78 KB |  | Combat declarations (trade-offs such as Combat Expertise and focus spikes), weapon specials and riders, and the expanded melee options (Disarm, Trip, Feint, Bull Rush, ...). |
| 16 | `js/rules/16-worn-and-active-gear.js` | 320 | 21 KB |  | Worn and activated equipment: gear boons, quantities, one-use items, Boost/Bane rolls, and equip parameters. |
| 17 | `js/rules/17-per-diem-and-class-choices.js` | 1,089 | 69 KB |  | Per-day class abilities (uses, rage, fatigue), level-accrued class choices (favored enemies, terrain mastery, rogue specials, high arcana, ...), companion base stats from the Foe Folio, and Take-10 skill-set designations. |
| 18 | `js/rules/18-companions.js` | 905 | 78 KB |  | Familiars, animal companions and mounts: species lists, progressions, derived stats, and the companion panels. |
| 19 | `js/rules/19-bonus-aggregator-and-stat-block.js` | 1,017 | 65 KB |  | The bonus engine: bonus types and stacking rules (GM's Guide pp.22-23), natural armor sources, racial bonuses, the full stat block (computeStatBlock, computeStatsFromClasses), and the conditions reference (CONDITIONS_DATA). |
| 20 | `js/rules/20-scenario-titles-and-heroic-resources.js` | 806 | 41 KB |  | The scenario title generator, Action Point and Fate Point options, heroic-level capabilities, resource budgets (feats, talents), and which tabs a character is entitled to see. |
| 21 | `js/rules/21-quickdraw.js` | 984 | 60 KB |  | Quickdraw: the one-click character generator, and Quickdraw Bespoke (qdBespokeBuild), the validated build path the test suite also uses to make characters. |
| 22 | `js/rules/22-career-compass.js` | 843 | 50 KB |  | Career Compass: level-up advice that works backwards from a chosen goal class. |
| 23 | `js/rules/23-hit-points-xp-skills.js` | 319 | 20 KB |  | Hit points (hero / random / max modes, rolls), the XP table, and the master SKILLS list. |
| 24 | `js/rules/24-synergies-class-skills-citations.js` | 916 | 69 KB |  | Skill synergies (SYNERGIES_DB), class skill lists, and the book-page CITATIONS table. |
| 25 | `js/rules/25-citation-helpers-feats-talents-db.js` | 549 | 122 KB |  | Citation helpers (getCitation, citeHTML), the FEATS_DB feat catalog and the TALENTS_DB talent catalog. |
| 26 | `js/data/26-damage-types.js` | 372 | 19 KB | yes | DAMAGE_TYPES: the canonical damage-type schema (base, derived and exotic descriptors). |
| 27 | `js/data/27-spell-damage.js` | 1,476 | 46 KB | yes | SPELL_DAMAGE: damage atoms for every damaging spell and power, and SPELL_DAMAGE_EXCLUDED. |
| 28 | `js/data/28-damage-resolver.js` | 131 | 8 KB | yes | DamageResolver: pure functions that turn damage atoms into labels, applicable resistances, immunity gates and alignment outcomes. |
| 29 | `js/data/29-weapons.js` | 2,559 | 53 KB | yes | WEAPONS_CATALOG: the full weapon catalog. |
| 30 | `js/data/30-armor.js` | 444 | 11 KB | yes | ARMOR_CATALOG: the full armor and shield catalog. |
| 31 | `js/data/31-vehicles.js` | 1,995 | 42 KB | yes | VEHICLES_DB: vehicle stat tables (HH pp.314-315, p.325). |
| 32 | `js/data/32-gadgets.js` | 730 | 20 KB | yes | GADGETS_CATALOG: gadgets and their effects. |
| 33 | `js/data/33-mastercraft.js` | 83 | 4 KB | yes | MASTERCRAFT_RULES: mastercraft upgrade rules. |
| 34 | `js/data/34-equipment-items.js` | 1 | 84 KB | yes | EQUIPMENT_ITEMS: general equipment (adventuring gear, kits, tools). |
| 35 | `js/data/35-item-slots.js` | 200 | 7 KB | yes | ITEM_SLOTS (magic item slot affinities), followed by the hand-written SLOT_GROUPS body-slot table and slotGroupIdOf. |
| 36 | `js/data/36-magic-items.js` | 8,389 | 529 KB | yes | MAGIC_ITEMS_DB: the enchanted and imbued item catalog (GMG Ch.V pp.212-373). |
| 37 | `js/data/37-spells.js` | 4 | 1,160 KB | yes | SPELLS_DB: every spell and power (HH Ch.IX), full text. |
| 38 | `js/data/38-mutations.js` | 1,083 | 46 KB | yes | MUTATIONS_DB: mutation advantages, drawbacks and the attribute chain. |
| 39 | `js/data/39-mutation-rules.js` | 132 | 6 KB | yes | MUTATION_RULES: the Mutation Point rules. |
| 40 | `js/rules/40-occupations-and-weapon-list.js` | 176 | 26 KB |  | OCCUPATIONS_DB (starting occupations: skills, bonus feats, wealth) and WEAPONS, the short weapon list used by parameterized feats such as Weapon Focus. |
| 41 | `js/app/41-state-storage-navigation.js` | 229 | 15 KB |  | App state and saving: safe localStorage access, the Backup Guardian (the backup chip and its freshness colours), loading the roster (chars), the create-form state, the small utilities (attribute modifiers, save(), toast) and showPage(), which switches tabs. |
| 42 | `js/app/42-player-tools.js` | 317 | 18 KB |  | The version number (CG_VERSION), the unsaved-changes guard, the Report-a-bug dialog, and the Display settings (theme and text size). |
| 43 | `js/app/43-create-attributes-race-occupation.js` | 723 | 41 KB |  | Create page: attribute generation (4d6, point buy, manual), the attribute budget, racial adjustments, race info, and starting occupations. |
| 44 | `js/app/44-create-scenario-gate-and-layout.js` | 684 | 35 KB |  | Create page: the Six Scales lock gate (lock, sandbox, unlock), the collapsible section layout and mini-nav, scenario presets and Six Scales changes. |
| 45 | `js/app/45-create-class-list.js` | 489 | 30 KB |  | Create page: the multi-class list (adding and removing classes and levels), class sub-options (wizard schools, psion disciplines, domains), and Scale-0 variants. |
| 46 | `js/app/46-create-preview-and-defense.js` | 550 | 30 KB |  | Create page: the class preview and derived stats, attribute bumps every 4th level, the HP mode controls, and the T/ACtical combat numbers (AC display, parry, dodge). |
| 47 | `js/app/47-save-character.js` | 1,086 | 63 KB |  | Saving a character: legacy-record migration, schema versioning, typed 1st-level feat slots, the Hero's Gift checks, and saveCharacter itself. |
| 48 | `js/app/48-roster-and-export.js` | 179 | 11 KB |  | The Roster page, and roster export/import (the 'courier' files that are the players' only real backup). |
| 49 | `js/app/49-sheet.js` | 1,297 | 106 KB |  | The Character Sheet page (renderSheet) and the stat-breakdown drilldown that opens when a number is clicked. |
| 50 | `js/app/50-skills-page.js` | 987 | 53 KB |  | The Skills page: class skills, skill families, ranks, synergy tooltips and spending skill points. |
| 51 | `js/app/51-gm-exceptions-and-talents-page.js` | 618 | 33 KB |  | GM exceptions (rule overrides granted at the table) and the Talents page with its talent browser. |
| 52 | `js/app/52-energy-immunity-and-spell-lists.js` | 202 | 15 KB |  | Energy-immunity talent picks, and the spell/power list tokens, schools and variant names used by the Powers/Spells pages. |
| 53 | `js/data/53-domains.js` | 1,478 | 42 KB | yes | DOMAINS_DB (the 27 Cleric/Paladin/Saint domains, HH pp.444-451) and DOMAIN_ALIASES. |
| 54 | `js/app/54-powers-repertoire.js` | 471 | 26 KB |  | A character's spell/power repertoire: caster pools, entitlement to the Spells and Powers tabs, and the powers budget. |
| 55 | `js/app/55-mutations-engine.js` | 757 | 51 KB |  | Mutations: the Mutation Point economy, super-power purchases with banked MP, and mutation mechanical effects. |
| 56 | `js/app/56-supernatural-attributes-pools-psi-focus.js` | 887 | 59 KB |  | Supernatural attributes, super talents, the Mutations page browser, blended power-point pools, metamagic preparation, and psionic focus. |
| 57 | `js/app/57-armor-and-vehicle-integrity.js` | 296 | 25 KB |  | The Tracker's armor-integrity panel, and vehicles: integrity, piloting, joint owners, hits and repairs. |
| 58 | `js/app/58-power-armor.js` | 487 | 44 KB |  | Power armor and Second Skin: loadouts, systems, slot damage. |
| 59 | `js/app/59-mecha.js` | 317 | 38 KB |  | Mecha: superstructures, armor types, weapons, and the mecha builder. |
| 60 | `js/app/60-starships.js` | 858 | 105 KB |  | Starships: size classes, subtypes, engines, armor, weapons, mounts and arcs, defenses, sensors, and the ship cards. |
| 61 | `js/app/61-casting-augments-and-powers-page.js` | 665 | 52 KB |  | Casting: augmentation and metamagic at cast time, the Mental Pinnacle picks, casting a power, and the Powers/Spells page (renderPowers). |
| 62 | `js/app/62-power-suites-feats-page-proficiencies.js` | 1,232 | 93 KB |  | Super-power suites by theme, the Feats page (renderFeats and the feat list), and the class/race weapon proficiencies and granted-feat tables. |
| 63 | `js/app/63-modals.js` | 393 | 22 KB |  | The generic confirm and choice dialogs that replace the browser's confirm() and prompt(). |
| 64 | `js/app/64-tracker.js` | 833 | 66 KB |  | The Tracker page: HP and power-point bars, HP mode, Action Points, talent action cards, bardic music, conditions, and the Hero's Gift panel. |
| 65 | `js/app/65-tracker-logs-and-damage.js` | 680 | 40 KB |  | Tracker: the AP/FP audit log, massive damage, nonlethal damage, AP/FP spend and restore dialogs, and the action log panel. |
| 66 | `js/app/66-xp-spending-and-level-up.js` | 783 | 43 KB |  | Spending XP (mastercrafting), and the level-up flow. |
| 67 | `js/app/67-pdf-export.js` | 618 | 48 KB |  | Print / PDF export of the character sheet (printSheet). |
| 68 | `js/app/68-init.js` | 39 | 3 KB |  | Start-up. |
