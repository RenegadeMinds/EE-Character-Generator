# The Character Generator's code: a map

Up to v9.19.0 the whole generator was one 4.8 MB `index.html`. It was split
into files (`tools/split_index.py`), and then the code was **regrouped by
topic and page**, so each function lives with the things it belongs with.
Functions and tables were moved as whole, unchanged units; the comments above
each one, including the original version notes, travelled with it.

## How the pieces fit together

```
index.html          the page markup + the tags that load everything below
js/boot.js          runs first, in <head>: error capture for 🐞 Report, theme + text size
css/                styles: app.css (themes, components, print), utilities.css
                    (one-property classes like fs-10, c-gold that replaced
                    inline style="..."), colours.css (colour tokens for the
                    page code, one per hue AND job: --text-, --line-, --tint-),
                    fonts.css (the @font-face rule)
assets/             the font file and the logo

js/core/            app plumbing used everywhere: the roster in memory, saving,
                    the backup chip, switching tabs, shared dialogs
js/data/            game tables: plain data, no logic
js/data/catalogs/   the big catalogs (spells, magic items, weapons, armor, ...),
                    one record per line
js/rules/           game rules: calculations and changes to a character record,
                    one file per topic (combat, powers, feats, ...)
js/ui/              page code: drawing the page and handling clicks and typing,
                    one file or folder per page (create/, sheet/, gear/, ...)
js/main.js          start-up: the ONLY code that runs while the page loads
```

There is **no build step**. GitHub Pages serves these files as they are, and
opening `index.html` straight from disk works too, as long as the folders sit
beside it.

### Where does new code go?

| You're adding... | Put it in |
|---|---|
| a table of game data (a list of things, a lookup) | `js/data/<topic>.js` |
| a calculation or a change to a character record | `js/rules/<topic>.js` |
| something that draws part of a page or handles a click | `js/ui/<page>...` |
| something that should happen automatically when the page opens | `js/main.js` |
| a look (size, colour, spacing) for markup you're writing | a class: an existing one in `css/utilities.css`, or a component rule in `css/app.css`; not `style="..."` |
| a colour | a token, never `#abc` or `rgba(...)`: a theme token from `css/app.css`, or `rgb(var(--text-NAME))` / `rgb(var(--line-NAME) / .3)` / `rgb(var(--tint-NAME) / .1)` from `css/colours.css`, picking the job (text, line, tint) by what it colours |
| something every page needs (saving, tabs, dialogs) | `js/core/` |

If you create a new file, add a `<script src="...">` line for it to
`index.html` in its group (the groups are labelled there) and give it a header
like the existing files have.

### The one rule: nothing runs while loading, except in data/ and main.js

`index.html` loads the files with plain `<script src>` tags (not "modules"),
so they all share **one global scope**: a function in any file can call a
function in any other file. Everything has loaded before anyone can click.

The only thing that can go wrong is code that runs **while the page is still
loading** and uses something from a file that hasn't loaded yet. So:

- `js/core/`, `js/rules/` and `js/ui/` contain **declarations only**:
  functions, tables, and variables. Nothing in them runs at load time, which
  is why **the order of those files doesn't matter**.
- `js/data/` may contain a few table fix-ups that run at load. They may only
  use tables declared before them.
- `js/main.js` is loaded **last** and is where start-up happens: restoring
  the saved roster, scenarios and homebrew, then drawing the first screen.

`node battery/_check_load_order.mjs` checks all of this without running the
app, including that no name is declared twice. Run it after moving code.

### Data files that were once generated: the generator is now the source of truth

The catalogs in `js/data/catalogs/` were first built by Adam's data-build
scripts, which live in the private EE-Rulebooks repository
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

So: **edit the catalogs directly**, and treat the generator as the source of
truth. The JSON/END marker comments around each table and the BEGIN/END
banner lines are kept unchanged, so a future script can still find the
tables. (The BEGIN banner is in `catalogs/damage-types.js` and the END
banner in `catalogs/mutation-rules.js`, so any new tool should work table by
table, not by banner.)

### Finding things

Search the `js/` folder for the name: every file header lists the functions
and tables it holds. Or use the table at the bottom of this page.

## Checking a change

- `node battery/_check_load_order.mjs`: the load-order rules above (a few
  seconds, no browser).
- `OLD=<previous index.html> node battery/_probe_split_parity.mjs` boots the
  old and new builds side by side in headless Chrome and checks they behave
  identically: every global value, the page markup, five built characters,
  and every page rendered for each of them. Add `CODE_CHANGED=1` when the
  change edits function bodies on purpose (a refactor), so functions are
  compared by behaviour rather than source text.
- `cd battery && npm test` runs the rules oracle and fuzzing battery.
- `python tools/split_index.py --verify-only --source <original index.html>`
  re-checks the original Phase 1 split. It applies to the Phase 1 commits
  only; later changes are covered by the checks above.

## Running it locally

From the repository folder:

```
python -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` directly also works.
A local server just matches how the live site behaves.)

## Releasing a new version

1. Change `CG_VERSION` in `js/core/state.js`.
2. Change the version at the end of the subtitle in `index.html` (search
   for `site-subtitle`).
3. Run `python tools/stamp_version.py`.

Step 3 puts `?v=<version>` on every script and stylesheet link in
`index.html`. Browsers cache files, and without the tag a player could get
the new `index.html` with old cached copies of some `js/` files and see
strange breakage. A changed tag makes every browser fetch fresh copies. The
tool also stops you if the subtitle and `CG_VERSION` disagree.
`python tools/stamp_version.py --check` only reports.

## The catalog layout

Every catalog in `js/data/catalogs/` has **one record per line**: one spell,
one weapon, one magic item per line, so changing an entry shows up in Git as
a one-line change. Keep new entries on one line too.
`python tools/reformat_data.py` re-lays out any table that has drifted, and
checks that no value changes. `--check` only reports.

## A single-file copy (for offline use or emailing)

`python tools/build_standalone.py` writes
`dist/EpicsAndEpochs_Character_Generator_v<version>.html`: one ~5 MB file with
every stylesheet, script, font and image inlined, which opens with a
double-click and no folders. It is a build product (`dist/` is not in Git):
edit the real files, then rebuild. To confirm a build behaves like the
folder version:
`OLD=index.html NEW=dist/<file> node battery/_probe_split_parity.mjs`.

## Every file

`js/boot.js` loads first, in `<head>`. Then, in `index.html` order:

### App core

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/core/state.js` | 107 | 6 KB | `_storageOK`, `chars`, `TS13_VEHICLE_MOVES`, `curId`, `editId`, `pbMode` … +9 |
| `js/core/backup.js` | 82 | 5 KB | `backupMeta`, `backupMetaSet`, `backupNoteSave`, `backupNoteExport`, `renderBackupChip` |
| `js/core/navigation.js` | 306 | 17 KB | `NAV_TAB_VISIBILITY togglePageTut`, `toggleGearTut`, `outstandingSelections`, `renderNavTabs`, `toast`, `toastAction` … +2 |
| `js/core/modals.js` | 132 | 6 KB | `_textModalResolve`, `_confirmModalResolve`, `_choiceModalCb`, `_choiceModalAllOptions`, `_choiceModalFreeText textModal`, `resolveTextModal` … +8 |

### Game catalogs

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/data/catalogs/damage-types.js` | 98 | 17 KB | `DAMAGE_TYPES` |
| `js/data/catalogs/spell-damage.js` | 177 | 41 KB | `SPELL_DAMAGE`, `SPELL_DAMAGE_EXCLUDED` |
| `js/data/catalogs/damage-resolver.js` | 175 | 9 KB | `FIVE`, `PHYSICAL`, `ENERGY_TECH_VARIANT`, `DERIVED_PARENT`, `ALIGN_LABEL` |
| `js/data/catalogs/weapons.js` | 157 | 43 KB | `WEAPONS_CATALOG` |
| `js/data/catalogs/armor.js` | 80 | 10 KB | `ARMOR_CATALOG` |
| `js/data/catalogs/vehicles.js` | 139 | 39 KB | `VEHICLES_DB` |
| `js/data/catalogs/gadgets.js` | 96 | 19 KB | `GADGETS_CATALOG` |
| `js/data/catalogs/mastercraft.js` | 62 | 4 KB | `MASTERCRAFT_RULES` |
| `js/data/catalogs/equipment-items.js` | 358 | 85 KB | `EQUIPMENT_ITEMS` |
| `js/data/catalogs/item-slots.js` | 98 | 7 KB | `ITEM_SLOTS`, `SLOT_GROUPS` |
| `js/data/catalogs/magic-items.js` | 795 | 514 KB | `MAGIC_ITEMS_DB` |
| `js/data/catalogs/spells.js` | 804 | 1,162 KB | `SPELLS_DB` |
| `js/data/catalogs/mutations.js` | 112 | 44 KB | `MUTATIONS_DB` |
| `js/data/catalogs/mutation-rules.js` | 70 | 6 KB | `MUTATION_RULES` |
| `js/data/catalogs/domains.js` | 144 | 38 KB | `DOMAINS_DB`, `DOMAIN_ALIASES` |

### Game tables

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/data/races-and-attributes.js` | 228 | 21 KB | `ATTR_NAMES`, `RACES`, `TALENT_ATTR_BAKES`, `RACE_BASE_SPEED`, `SIZE_LADDER`, `DIE_STEP_UP` … +4 |
| `js/data/classes.js` | 1,033 | 54 KB | `HERO_CLASSES`, `ORDINARY_CLASSES`, `BASIC_CLASSES`, `CLASS_ABILITIES`, `ADVANCED_CLASSES`, `PRESTIGE_CLASSES` … +7 |
| `js/data/class-features.js` | 946 | 128 KB | `CLASS_FEATURES`, `DRUID_OPTION_FEATURES`, `RANGER_FE_TYPES`, `TERRAIN_MASTERY_DATA`, `ROGUE_SPECIAL_ABILITIES`, `CLASS_CHOICE_DEFS` … +4 |
| `js/data/powers.js` | 693 | 67 KB | `CASTER_CLASSES`, `CASTER_PROGRESSION`, `PP_COST_BY_POWER_LEVEL`, `POOL_EFF_LEVEL`, `POWER_EFFECTS`, `AUGMENT_OPTIONS` … +15 |
| `js/data/scenario.js` | 226 | 12 KB | `SIX_LEVELS`, `SCENARIO_PRESETS`, `PRESET_LEGACY`, `SCEN_AXES`, `SCENARIO_AXIS_VOCAB` |
| `js/data/homebrew.js` | 64 | 4 KB | `HBG_SUBSTANCES`, `MONSTROUS_CLASSES`, `MONSTER_TYPE_PROG` |
| `js/data/magic-items.js` | 156 | 13 KB | `MAGIC_SLOT_TYPE`, `MAGIC_SLOT_KEYWORDS`, `MAGIC_ITEM_EFFECTS`, `MAGIC_TYPE_LABELS`, `MAGIC_PROPERTY_TYPES`, `SPECIFIC_ARMS_CONVERSIONS` |
| `js/data/conditions-and-minds.js` | 352 | 25 KB | `MIND_TIERS`, `MIND_SIZE_ROWS`, `CONDITION_TIER_STYLE`, `CONDITIONS_DATA`, `COMMON_CONDITIONS` |
| `js/data/skills.js` | 485 | 81 KB | `SKILL_DESCS`, `SKILLS`, `TOOLKIT_DEPENDENT_SKILLS`, `INSTRUMENT_PERFORMS`, `SYNERGIES_DB`, `HC_SKILLS` … +4 |
| `js/data/cybernetics.js` | 80 | 13 KB | `CYBER_SLOTS`, `CYBERNETICS_DB` |
| `js/data/equipment.js` | 294 | 19 KB | `WEALTH_DC_DOLLARS`, `PRICE_FLUX_NOTE`, `ENERGY_DAMAGE_TYPES`, `WEAPON_FINESSE_NAMED_EXCEPTIONS`, `TOOLKIT_SATISFIERS`, `ARMOR_HARDNESS_BY_TS` … +8 |
| `js/data/combat.js` | 190 | 14 KB | `ENERGY_TYPES`, `STRONG_SUPER_TALENTS`, `STRONG_PASSIVE_RIDERS`, `MANGLER_LADDER`, `CARRY_TABLE_HH`, `MOVEMENT_GRANTS` … +3 |
| `js/data/companions.js` | 523 | 19 KB | `COMPANION_BASE_STATS`, `FAMILIAR_SPECIES`, `ANIMAL_COMPANION_SPECIES`, `MOUNT_SPECIES`, `FAMILIAR_PERKS`, `ANIMAL_COMPANION_PROG` … +1 |
| `js/data/bonuses.js` | 126 | 7 KB | `BONUS_TYPES`, `STACKING_RULES` |
| `js/data/character.js` | 239 | 26 KB | `AP_OPTIONS`, `HAP_OPTIONS`, `FP_OPTIONS_UNIVERSAL`, `FP_OPTIONS_BY_HERO_CLASS`, `HEROIC_LEVEL_NAMES`, `HEROIC_LEVEL_AP_PER_ROUND` … +5 |
| `js/data/citations.js` | 728 | 32 KB | `CITATIONS` |
| `js/data/feats.js` | 371 | 67 KB | `FEATS_DB`, `FIRST_LEVEL_SLOT_KINDS`, `HERITAGE_ELIGIBLE_KINDS`, `SLOT_PREFERENCE_ORDER` |
| `js/data/talents.js` | 153 | 53 KB | `TALENTS_DB` |
| `js/data/mutations.js` | 168 | 13 KB | `UNSTABLE_MP`, `SUPER_RUNGS`, `MUTATION_EFFECTS`, `SU_ATTR_LADDER` |
| `js/data/vehicles.js` | 906 | 119 KB | `SIZE_FULL`, `MECHA_SIZE_STATS`, `POWER_ARMOR_DB`, `MECHA_SYSTEMS`, `SECOND_SKIN_TABLE`, `SECOND_SKIN_MENUS` … +21 |

### Game rules

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/rules/bonuses.js` | 450 | 26 KB | `aggregateBonuses`, `buildClassBonuses`, `computeNaturalAC`, `computeStatBlock`, `verifyParity` |
| `js/rules/buffs.js` | 150 | 7 KB | `buffDurationText`, `perpetualBuffs`, `_buffEffectSources`, `activeBuffBonuses`, `activeBuffAttrDeltas`, `clearActiveBuffs` |
| `js/rules/career-compass.js` | 324 | 18 KB | `classPrereqCheckOf`, `_compassTierOf`, `_compassAnnotate`, `careerCompassState`, `classSkillListHas`, `careerNextStep` … +1 |
| `js/rules/character.js` | 133 | 7 KB | `isLegacyCharacter`, `scanHerosGiftRetconCompliance`, `reconcileHerosGiftFold` |
| `js/rules/citations.js` | 68 | 3 KB | `citationDomainCounts`, `getCitation`, `formatCitation`, `citeHTML` |
| `js/rules/class-features.js` | 696 | 46 KB | `getActiveClassFeatures`, `evalBonusFeatFormula`, `computeBonusFeatsFromClassFeatures`, `applyClassFeatureEffects`, `berserkerLvl`, `bloodlusterLvl` … +22 |
| `js/rules/classes.js` | 492 | 27 KB | `getClassData`, `checkClassPrereqsFromArray`, `checkClassPrereqs`, `checkAdvancedPrereqs`, `classStatAt`, `chaModClamped` … +7 |
| `js/rules/combat.js` | 955 | 66 KB | `computeGrapple`, `ownsFeatN`, `combatDecl`, `bestDefenseCap`, `combatDeclCaps`, `psiFocusPathOf` … +8 |
| `js/rules/companions.js` | 122 | 6 KB | `companionMasterLevels`, `progRow`, `companionDerived`, `syncOwnedAnimals`, `buildCompanionSkillPerks` |
| `js/rules/conditions-and-minds.js` | 138 | 7 KB | `mindOf`, `mindTier`, `mindLevelRow`, `mindPackage`, `mindDiceText`, `mindRoll1` … +1 |
| `js/rules/cybernetics.js` | 158 | 9 KB | `getCyber`, `cyberDef`, `hasLostArm`, `hasCyberArm`, `offHandAvailable`, `cyberMax` … +5 |
| `js/rules/defenses-and-movement.js` | 895 | 56 KB | `parryingHeldBonus`, `computeResistances`, `computeSR`, `computeDR`, `reconcileMutantSubtype`, `buildMutantSubtypeLanes` … +15 |
| `js/rules/enchanting-and-armor.js` | 191 | 10 KB | `shieldSizeCategory`, `armorItemIntegrity`, `enchantTsCap`, `enchantAbilityDefs`, `enchantInfoOf`, `enchantDisplayName` … +3 |
| `js/rules/equipment.js` | 756 | 41 KB | `getCharItems`, `getCatalogueEntry`, `isRangedWeapon`, `isFinesseEligible`, `finesseShieldACP`, `buildItemBonuses` … +30 |
| `js/rules/feats.js` | 751 | 39 KB | `getFeatSlotBreakdown`, `getRestrictionFilter`, `getRestrictionFamily`, `getOpenClassBonusSlots`, `getFeatData`, `checkFeatPrereqs` … +10 |
| `js/rules/gadgets.js` | 109 | 5 KB | `maxMastercraftBonus`, `gadgetSlotCount`, `mastercraftKindFor`, `eligibleGadgets`, `hasGadget`, `weaponAttachments` … +2 |
| `js/rules/heroic-and-budgets.js` | 481 | 24 KB | `getAPDice`, `characterHasAPClass`, `effectiveHeroicLevelForAP`, `getHeroicCapabilities`, `computeResourceState`, `getFeatBudget` … +8 |
| `js/rules/hit-points-and-xp.js` | 356 | 18 KB | `reconcileTalentHp`, `reconcileClassHp`, `rollHitDieForMode`, `generateHpRolls`, `reconcileMissingHP`, `computeMaxHPFromRolls` … +11 |
| `js/rules/homebrew.js` | 93 | 5 KB | `homebrewFeats`, `homebrewGear`, `monstrousStore hbStoreSave`, `hbByName`, `hbAdjSummary`, `hbgStoreSave` … +5 |
| `js/rules/magic-items.js` | 113 | 5 KB | `magicItemDefaultSlot`, `magicItemEffectValue`, `buildMagicItemBonuses`, `magicPriceLabel`, `magicItemDesc` |
| `js/rules/mutations.js` | 319 | 17 KB | `getCharMutations`, `getMPState`, `getSuperPPState`, `spendSuperPP`, `superBuySpec`, `suiteDiscountFor` … +6 |
| `js/rules/occupations.js` | 132 | 6 KB | `reconcileOccupationBonusFeats`, `buildOccupationBonuses`, `getOccupationData` |
| `js/rules/powers.js` | 928 | 47 KB | `computeCasterLevels`, `computeCasterStats`, `_emptyPoolStats`, `powerHoverText`, `spellSchool`, `isPsionicSpell` … +17 |
| `js/rules/quickdraw.js` | 790 | 47 KB | `qdStores`, `qdEntry`, `qdCap`, `qdKeyAttr`, `qdLegalStarts`, `qdScoreStart` … +14 |
| `js/rules/races-and-attributes.js` | 304 | 15 KB | `attrItemBonuses`, `reconcileTalentAttrBakes`, `suBakedPerAttr`, `effAttrs`, `effAm`, `hybridInfo` … +16 |
| `js/rules/scenario.js` | 252 | 12 KB | `customScenarios normalizePresetName`, `saveCustomScenarios`, `customScenarioByName`, `scenarioScalesOf`, `scenarioSummaryStr`, `scenarioTechScale` … +6 |
| `js/rules/skills.js` | 505 | 25 KB | `buildDerivedSkillBonuses`, `computeSkillMiscBonuses`, `displaySkillName`, `skillHoverText`, `baseExAttrMod`, `computeSkillSetSpecs` … +9 |
| `js/rules/spell-preparation.js` | 343 | 16 KB | `blendedPoolSetFor`, `_poolPPRaw`, `getPoolPPState`, `_drainPoolLedgers`, `spendPoolPP`, `powerCastCost` … +15 |
| `js/rules/talents.js` | 374 | 21 KB | `buildTalentBonuses`, `computeTalentEffects`, `checkTalentPrereqs` |
| `js/rules/vehicles.js` | 228 | 12 KB | `vehicleIntegrity`, `pilotedVehicle`, `vehicleOperatorCheck`, `vehicleStatStripText`, `equippedPowerArmor`, `paLoadout` … +19 |
| `js/rules/wealth.js` | 145 | 7 KB | `dollarsForDC`, `dcForDollars`, `fmtCoin`, `priceLabel`, `marketAdjustedDC`, `itemEffectivePDC` … +5 |

### Page code

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/ui/career-compass.js` | 132 | 8 KB | `_compassExpanded toggleCompass`, `setCareerGoal`, `onCareerGoalSelect`, `setCareerGoalFromLevelUp`, `renderCareerCompass` |
| `js/ui/create/attributes-race-occupation.js` | 612 | 33 KB | `occupationsUnlocked`, `formOccupationPicks`, `formOccupationPicksFor renderAttrGrid`, `onAC`, `getAttrs`, `rollAttributes` … +18 |
| `js/ui/create/classes.js` | 444 | 25 KB | `formClasses`, `formSubOptions renderClassSubOptions`, `onSubOptChange`, `onScale0Pick`, `onSubOptDomain`, `renderClassList` … +10 |
| `js/ui/create/form-state.js` | 68 | 3 KB | `formBudget`, `editSavedSixLevels`, `pendingSixLevelChange`, `formHpMode`, `formHpRolls`, `formAttrBumps` |
| `js/ui/create/preview.js` | 301 | 14 KB | `updateClassPreview`, `renderAllPrereqChecks`, `applyAttrBumps`, `renderAttrBumpsPanel`, `onAttrBumpChange`, `getFormHpMode` … +6 |
| `js/ui/create/save.js` | 864 | 51 KB | `_firstSaveConfirmed saveCharacter`, `cloneCurrentChar`, `editCurrentChar`, `deleteCurrentChar`, `clearForm` |
| `js/ui/create/scenario-and-layout.js` | 683 | 32 KB | `gateState`, `_GATE_DOWNSTREAM_PANELS`, `CREATE_SECTIONS applyGateState`, `lockSixLevels`, `enterSandboxMode`, `unlockSixLevels` … +25 |
| `js/ui/feats.js` | 918 | 51 KB | `gmExceptionsExpanded`, `_activeBrowserSlot toggleGMExceptionsExpanded`, `clearGMException`, `renderGMExceptions`, `setFeatParamAt`, `renderFeats` … +13 |
| `js/ui/gear/combat.js` | 138 | 8 KB | `bdDeclAdjust`, `declWhichModal`, `baDeclAdjust`, `weaponSpikeUse`, `toggleMeleeOpts`, `toggleNullified` … +1 |
| `js/ui/gear/cybernetics.js` | 114 | 9 KB | `toggleGearCyber`, `renderCybernetics`, `addCyberFromSel`, `removeCyber` |
| `js/ui/gear/enchanting.js` | 165 | 10 KB | `_enchantState openEnchantBuilder`, `closeEnchantModal`, `enchantSetEnh`, `enchantSetImbued`, `enchantToggleAbility`, `renderEnchantModal` … +2 |
| `js/ui/gear/gadgets.js` | 188 | 11 KB | `_gadgetOpen mountAccessory`, `toggleComputerUpgrade`, `setItemMastercraft`, `addGadgetToItem`, `removeGadgetFromItem`, `toggleGadgetCtl` … +2 |
| `js/ui/gear/inventory.js` | 837 | 68 KB | `_itemOpen armorStatStrip`, `weaponStatStrip`, `toggleGearActive`, `gearQty`, `useGearItem`, `boostBaneRoll` … +15 |
| `js/ui/gear/magic-items.js` | 237 | 17 KB | `_magicBrowseOpen`, `_magicBrowseList`, `_magicExpanded toggleMagicBrowse`, `toggleMagicDetail`, `renderMagicBrowse`, `addMagicFromBrowse` … +2 |
| `js/ui/gear/wealth.js` | 246 | 16 KB | `_priceCheckTs`, `_wealthChartOpen priceSpan`, `chargeUpgradeDifference`, `rollStartingWealth`, `adjustFunds`, `setPriceCheckTs` … +5 |
| `js/ui/homebrew/forge-and-armory.js` | 376 | 22 KB | `_hbPendingGrant hbOpen`, `hbClose`, `hbgOpen`, `hbgClose`, `hbgTypeChange`, `hbgDtypeChange` … +18 |
| `js/ui/homebrew/monstrous.js` | 126 | 8 KB | `importCreatureSeed` |
| `js/ui/level-up.js` | 735 | 37 KB | `_pendingLevelUp checkLevelUp`, `lvlupCancel`, `lvlupRenderClassChoice`, `lvlupOnClassChoice`, `lvlupRenderNewClassForm`, `lvlupOnNewClassTier` … +11 |
| `js/ui/mutations.js` | 447 | 33 KB | `_muBrowseList`, `_muExpanded`, `_muBrowseOpen restSuperPPClick`, `buySuperPower`, `toggleMuBrowse`, `renderMutationEffects` … +11 |
| `js/ui/player-tools/bug-report.js` | 202 | 10 KB | `BUG_REPORT_EMAIL`, `BUG_STORE_KEY _bugLoad`, `_bugStore`, `_bugContext`, `_bugCtxText`, `_bugText` … +17 |
| `js/ui/player-tools/display-settings.js` | 50 | 3 KB | `_renderDisplayMenu`, `openDisplaySettings`, `closeDisplaySettings`, `setDisplayPref` |
| `js/ui/player-tools/unsaved-guard.js` | 95 | 4 KB | `_createDirty`, `_skBaseline`, `_cgSuppressUnload`, `_unsavedResolve _skMarkClean`, `_skLiveRanks`, `skillsDirty` … +6 |
| `js/ui/powers/browse.js` | 521 | 38 KB | `_pwBrowseList`, `_pwMode`, `_pwBrowseOpen`, `_pwExpandedBrowse`, `_pwExpandedKnown`, `_pwThemeSets togglePwBrowse` … +9 |
| `js/ui/powers/buffs.js` | 152 | 10 KB | `toggleBuffSuper`, `applyWiredBuff`, `dismissBuffAt`, `renderActiveBuffs` |
| `js/ui/powers/casting.js` | 402 | 28 KB | `openCastOptions`, `chooseMentalPinnacle`, `castPowerAt`, `renderCastResult`, `dismissCastResult` |
| `js/ui/powers/preparation.js` | 513 | 31 KB | `_pendingInstant`, `_prepCtrs adjustPP`, `restPP`, `snapshotPowerTextareas`, `instantGateOK`, `prepPickAndAdd` … +8 |
| `js/ui/powers/psionic-focus.js` | 59 | 4 KB | `gainPsiFocus`, `expendPsiFocus`, `psiFocusChipHTML` |
| `js/ui/print.js` | 641 | 46 KB | `printSheet` |
| `js/ui/quickdraw.js` | 232 | 12 KB | `qdAttrModeToggle`, `qdMaAdj`, `qdManualAttrs`, `qdBespokeRun`, `openQuickdraw`, `qdOccHint` … +8 |
| `js/ui/roster.js` | 161 | 8 KB | `reconcileOrphanSubOptions`, `exportRoster`, `exportRosterDownload`, `exportCurrentHero`, `importRosterFile`, `renderRoster` … +1 |
| `js/ui/scenario-studio.js` | 208 | 11 KB | `_lastScenSel`, `_scenCtx`, `_scenarioTitleOverride`, `_scenarioGateAcknowledged populateScenarioSelects`, `openScenarioStudio`, `closeScenarioStudio` … +7 |
| `js/ui/sheet/class-choices.js` | 83 | 6 KB | `setClassChoice`, `renderClassChoices` |
| `js/ui/sheet/companions.js` | 94 | 7 KB | `addCompanion`, `removeCompanion`, `renameCompanion`, `renderCompanions`, `setRangerCombatStyle` |
| `js/ui/sheet/heros-gift.js` | 125 | 7 KB | `renderHerosGiftPanel`, `assignHerosGiftAsFeat`, `assignHerosGiftAsTalent` |
| `js/ui/sheet/sheet.js` | 1,356 | 106 KB | `renderSourcedValueProvenance`, `showStatBreakdown`, `closeDrilldown`, `applyRacialNatAC`, `dismissNatACBanner`, `renderSheet` … +1 |
| `js/ui/skills.js` | 509 | 28 KB | `skillFilter`, `skillFamilyCollapsed`, `skillFamilyToggled addSkillSetPick`, `removeSkillSetPick`, `setSkillFilter`, `toggleSkillFamily` … +10 |
| `js/ui/talents.js` | 661 | 33 KB | `addTalentToChar`, `removeTalentFromChar`, `renderTalents`, `_populateTalentTreeFilter`, `openTalentBrowser`, `closeTalentBrowser` … +8 |
| `js/ui/tracker/action-log.js` | 204 | 10 KB | `renderLog`, `logAct`, `logActionEvent`, `editActionLogNote`, `clearActionLog`, `renderActionLog` … +3 |
| `js/ui/tracker/action-points.js` | 399 | 20 KB | `renderAPBar`, `toggleAPOpt`, `adjustAP`, `adjustAPSilent`, `resetAP`, `spendFatePoint` … +10 |
| `js/ui/tracker/armor-integrity.js` | 125 | 9 KB | `renderArmorIntegrity`, `armorIncomingHit`, `armorRepair` |
| `js/ui/tracker/class-abilities.js` | 398 | 36 KB | `toggleEuphoric`, `adjustAbilityUse`, `renewAbility`, `toggleRage`, `clearFatigue`, `fullyRested` … +8 |
| `js/ui/tracker/conditions.js` | 177 | 11 KB | `renderConds`, `populateConditionDropdown`, `renderSheetConditionBanner`, `addCond`, `rmCond`, `clearConds` |
| `js/ui/tracker/damage.js` | 171 | 11 KB | `_mdtPending mdtPrompt`, `mdtRender`, `mdtClose`, `mdtResolve`, `nlCheck`, `renderNLLine` … +4 |
| `js/ui/tracker/hit-points.js` | 194 | 10 KB | `renderHPBar`, `toggleHpModePanel`, `renderSheetHpModePanel`, `changeSheetHpMode`, `rerollSheetHp`, `applyHpModeChangeToChar` … +1 |
| `js/ui/tracker/minds.js` | 280 | 24 KB | `mindSet`, `mindPerToggle`, `mindPer`, `mindOutcome`, `mindLastDismiss`, `mindFacedCycle` … +8 |
| `js/ui/tracker/tracker.js` | 36 | 2 KB | `renderTracker` |
| `js/ui/tracker/xp.js` | 86 | 5 KB | `renderXPBar`, `awardXP`, `spendXP` |
| `js/ui/vehicles/mecha.js` | 132 | 13 KB | `openMechaBuilder`, `renderMechaCards` |
| `js/ui/vehicles/power-armor.js` | 284 | 23 KB | `paCycleSlotState`, `paAddLoadoutLine`, `paRemoveLoadoutLine`, `renderPowerArmorCards`, `setSecondSkinLevel`, `toggleSecondSkin` … +2 |
| `js/ui/vehicles/starships.js` | 243 | 21 KB | `shipMountChip`, `shipLinkChip`, `shipBatteryChip`, `openStarshipBuilder`, `shipIncomingHit`, `shipRepair` … +1 |
| `js/ui/vehicles/vehicles.js` | 166 | 12 KB | `togglePiloted`, `setJointOwners`, `vehicleIncomingHit`, `vehicleRepair`, `renderVehicleInventory`, `renderVehicles` |

### Start-up

| File | Lines | Size | Holds |
|---|---|---|---|
| `js/main.js` | 154 | 8 KB | `restore saved data`, `first render` |
