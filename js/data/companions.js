// =============================================================================
// js/data/companions.js
// COMPANIONS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Familiars, animal companions and
//   mounts: base stats, species and progressions.
//
// KEY NAMES (so you can search for them)
//   tables and state: COMPANION_BASE_STATS, FAMILIAR_SPECIES,
//   ANIMAL_COMPANION_SPECIES, MOUNT_SPECIES, FAMILIAR_PERKS,
//   ANIMAL_COMPANION_PROG, FAMILIAR_PROG
//
// WHERE IT CAME FROM
//   Gathered from js/rules/17-per-diem-and-class-choices.js,
//   js/rules/18-companions.js when the code was regrouped by topic and page.
//   Each function and table moved whole and unchanged, with the comments
//   above it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ============================================================================
// v8.8.3 CLASS CHOICES (Adam's Basic-class pass): level-accrued class-feature
// selections — the competence family, Battle-Hardened saves, Favored Enemies,
// Terrain Mastery, mental-attribute bakes, Artisan, Rogue Special Abilities.
// Storage: c.classChoices = {key: value} (lazy). Rendered as the Sheet's
// 🎓 Class Choices panel; consumers feed the skill/save/attr/immunity engines.
// ============================================================================
// v8.8.3 COMPANION BASE STATS — extracted verbatim from the Foe Folio
// (Animals appendix; page field = FF page). Columned multi-variant blocks
// (vipers, sharks) carry a ref pointer instead of parsed lines.
const COMPANION_BASE_STATS = {
 "Badger": {
  "page": 66,
  "size": "Small Animal",
  "hd": "1d8+2 (6 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 30 ft. (6 hexes), burrow 10 ft.",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "bab": "+0/-5",
  "atk": "Claw +4 melee (1d2-1)",
  "fatk": "2 claws +4 melee (1d2-1) and bite -1 melee (1d3-1)",
  "sa": "Rage",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +5, Will +1, Dodge +6",
  "attrs": "Str 8, Dex 17, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Bat": {
  "page": 67,
  "size": "Diminutive Animal",
  "hd": "1/4 d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 5 ft (1 hex), fly 40 ft. (good)",
  "ac": "16 (+4 size, +2 Dex), touch 16, flat-footed 14",
  "bab": "+0/-17",
  "atk": "—",
  "fatk": "—",
  "sa": "—",
  "sq": "Blindsense 20 ft., low-light vision",
  "saves": "Fort +2, Ref +4, Will +2, Dodge +8",
  "attrs": "Str 1, Dex 15, Con 10, Int 2, Wis 14, Cha 4"
 },
 "Camel": {
  "page": 70,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 50 ft. (10 hexes)",
  "ac": "12/13 (-1 size, +3 Dex, +1 natural), flat-footed 10",
  "bab": "+2/+10",
  "atk": "Bite +0 melee (1d4+2*)",
  "fatk": "Bite +0 melee* (1d4+2*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +6, Will +1, Dodge +5",
  "attrs": "Str 18, Dex 16, Con 14, Int 2, Wis 11, Cha 4"
 },
 "Cat": {
  "page": 71,
  "size": "Small Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 30 ft. (6 hexes)",
  "ac": "13/13 (+1 size, +2 Dex), flat-footed 11",
  "bab": "+0/-12",
  "atk": "Claw +4 melee (1d2-4)",
  "fatk": "2 claws +4 melee (1d2-4) and bite -1 melee (1d3-4)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 2, Wis 12, Cha 7"
 },
 "Constrictor Snake": {
  "page": 91,
  "size": "Medium Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 20 ft. (4 hexes), climb 20 ft., swim 20 ft.",
  "ac": "13/15 (+3 Dex, +2 natural), flat-footed 12",
  "bab": "+2/+5",
  "atk": "Bite +5 melee (1d3+4)",
  "fatk": "Bite +5 melee (1d3+4)",
  "sa": "Constrict 1d3+4, improved grab",
  "sq": "Scent",
  "saves": "Fort +4, Ref +6, Will +2, Dodge +6",
  "attrs": "Str 17, Dex 17, Con 13, Int 1, Wis 12, Cha 2"
 },
 "Crocodile": {
  "page": 72,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 20 ft. (4 hexes), swim 30 ft.",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+2/+6",
  "atk": "Bite +6 melee (1d8+6) or tail slap +6 melee (1d12+6)",
  "fatk": "Bite +6 melee (1d8+6) or tail slap +6 melee (1d12+6)",
  "sa": "Improved grab",
  "sq": "Hold breath, low-light vision",
  "saves": "Fort +6, Ref +4, Will +2, Dodge +4",
  "attrs": "Str 19, Dex 12, Con 17, Int 1, Wis 12, Cha 2"
 },
 "Dire Rat": {
  "page": 60,
  "size": "Small Animal",
  "hd": "1d8+1 (5 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 40 ft. (8 hexes), climb 20 ft.",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "atk": "Bite +4 melee (1d4 plus disease)",
  "fatk": "Bite +4 melee (1d4 plus disease)",
  "sa": "Disease",
  "sq": "Low-light vision, scent",
  "saves": "Fort +3, Ref +5, Will +3, Dodge +6",
  "attrs": "Str 10, Dex 17, Con 12, Int 1, Wis 12, Cha 4"
 },
 "Dog": {
  "page": 73,
  "size": "Small Animal",
  "hd": "1d8+2 (6 hp)",
  "tac": "Hardness 1; +5 HP",
  "spd": "+3; 40 ft. (8 hexes)",
  "ac": "14/15 (+1 size, +3 Dex, +1 natural), flat-footed 12",
  "bab": "+0/-3",
  "atk": "Bite +2 melee (1d4+1)",
  "fatk": "Bite +2 melee (1d4+1)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +5, Will +1, Dodge +6",
  "attrs": "Str 13, Dex 17, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Eagle": {
  "page": 75,
  "size": "Small Animal",
  "hd": "1d8+1 (5 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 10 ft. (2 hexes), fly 80 ft. (average)",
  "ac": "13/15 (+1 size, +2 Dex, +2 natural), flat-footed 13",
  "bab": "+0/-4",
  "atk": "Talons +3 melee (1d4)",
  "fatk": "2 talons +3 melee (1d4) and bite -2 melee (1d4)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +3, Ref +4, Will +2, Dodge +5",
  "attrs": "Str 10, Dex 15, Con 12, Int 2, Wis 14, Cha 6"
 },
 "Hawk": {
  "page": 77,
  "size": "Tiny Animal",
  "hd": "1d8 (4 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 10 ft. (2 hexes), fly 60 ft. (average)",
  "ac": "15/17 (+2 size, +3 Dex, +2 natural), flat-footed 14",
  "bab": "+0/-10",
  "atk": "Talons +5 melee (1d4-2)",
  "fatk": "Talons +5 melee (1d4-2)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +5, Will +2, Dodge +7",
  "attrs": "Str 6, Dex 17, Con 10, Int 2, Wis 14, Cha 6"
 },
 "Horse (heavy)": {
  "page": 77,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 50 ft. (10 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+9",
  "atk": "Hoof -1 melee (1d6+1*)",
  "fatk": "2 hooves -1 melee (1d6+1*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Horse (light)": {
  "page": 78,
  "size": "Large Animal",
  "hd": "3d8+6 (19 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 60 ft. (12 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+8",
  "atk": "Hoof -2 melee (1d4+1*)",
  "fatk": "2 hooves -2 melee (1d4+1*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 14, Dex 13, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Lizard": {
  "page": 81,
  "size": "Tiny Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 20 ft. (4 hexes), climb 20 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d4-4)",
  "fatk": "Bite +4 melee (1d4-4)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 1, Wis 12, Cha 2"
 },
 "Owl": {
  "page": 86,
  "size": "Tiny Animal",
  "hd": "1d8 (4 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; 10 ft. (2 hexes), fly 40 ft. (average)",
  "ac": "15/17 (+2 size, +3 Dex, +2 natural), flat-footed 14",
  "bab": "+0/-11",
  "atk": "Talons +5 melee (1d4-3)",
  "fatk": "Talons +5 melee (1d4-3)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +5, Will +2, Dodge +7",
  "attrs": "Str 4, Dex 17, Con 10, Int 2, Wis 14, Cha 4"
 },
 "Pony": {
  "page": 87,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 40 ft. (8 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+2",
  "atk": "Hoof -3 melee (1d3*)",
  "fatk": "2 hooves -3 melee (1d3*)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 13, Dex 13, Con 12, Int 2, Wis 11, Cha 4"
 },
 "Porpoise": {
  "page": 88,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+3; Swim 80 ft. (16 hexes)",
  "ac": "13/15 (+3 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+1",
  "atk": "Slam +4 melee (2d4)",
  "fatk": "Slam +4 melee (2d4)",
  "sa": "—",
  "sq": "Blindsight 120 ft., hold breath, low-light vision",
  "saves": "Fort +4, Ref +6, Will +1, Dodge +6",
  "attrs": "Str 11, Dex 17, Con 13, Int 2, Wis 12, Cha 6"
 },
 "Rat": {
  "page": 89,
  "size": "Tiny Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 15 ft. (3 hexes), climb 15 ft., swim 15 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d3-4)",
  "fatk": "Bite +4 melee (1d3-4)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 2, Dex 15, Con 10, Int 2, Wis 12, Cha 2"
 },
 "Raven": {
  "page": 89,
  "size": "Tiny Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+2; 10 ft. (2 hexes), fly 40 ft. (average)",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-13",
  "atk": "Claws +4 melee (1d2-5)",
  "fatk": "Claws +4 melee (1d2-5)",
  "sa": "—",
  "sq": "Low-light vision",
  "saves": "Fort +2, Ref +4, Will +2, Dodge +6",
  "attrs": "Str 1, Dex 15, Con 10, Int 2, Wis 14, Cha 6"
 },
 "Riding Dog": {
  "page": 74,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 40 ft. (8 hexes)",
  "ac": "12/14 (+2 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+3",
  "atk": "Bite +3 melee (1d6+3)",
  "fatk": "Bite +3 melee (1d6+3)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +5, Will +1, Dodge 5",
  "attrs": "Str 15, Dex 15, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Squid": {
  "page": 94,
  "size": "Medium Animal (Aquatic)",
  "hd": "3d8 (13 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+3; Swim 60 ft. (12 hexes)",
  "ac": "13/16 (+3 Dex, +3 natural), flat-footed 13",
  "bab": "+2/+8*",
  "atk": "Tentacles +4 melee (0)",
  "fatk": "Tentacles +4 melee (0) and bite -1 melee (1d6+1)",
  "sa": "Improved grab",
  "sq": "Ink cloud, jet, low-light vision",
  "saves": "Fort +3, Ref +6, Will +2, Dodge +6",
  "attrs": "Str 14, Dex 17, Con 11, Int 1, Wis 12, Cha 2"
 },
 "Toad": {
  "page": 96,
  "size": "Diminutive Animal",
  "hd": "¼ d8 (1 hp)",
  "tac": "--",
  "spd": "+1; 5 ft. (1 hex)",
  "ac": "15/15 (+4 size, +1 Dex), flat-footed 14",
  "bab": "+0/-17",
  "atk": "—",
  "fatk": "—",
  "sa": "—",
  "sq": "Amphibious, low-light vision",
  "saves": "Fort +2, Ref +3, Will +2, Dodge +7",
  "attrs": "Str 1, Dex 12, Con 11, Int 1, Wis 14, Cha 4"
 },
 "Warhorse (heavy)": {
  "page": 78,
  "size": "Large Animal",
  "hd": "4d8+12 (30 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 50 ft. (10 hexes)",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+3/+11",
  "atk": "Hoof +6 melee (1d6+4)",
  "fatk": "2 hooves +6 melee (1d6+4) and bite +1 melee (1d4+2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +7, Ref +5, Will +2",
  "attrs": "Str 18, Dex 13, Con 17, Int 2, Wis 13, Cha 6"
 },
 "Warhorse (light)": {
  "page": 79,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 4; +20 HP",
  "spd": "+1; 60 ft. (12 hexes)",
  "ac": "10/14 (-1 size, +1 Dex, +4 natural), flat-footed 13",
  "bab": "+2/+9",
  "atk": "Hoof +4 melee (1d4+3)",
  "fatk": "2 hooves +4 melee (1d4+3) and bite -1 melee (1d3+1)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +6, Ref +4, Will +2, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 17, Int 2, Wis 13, Cha 6"
 },
 "Warpony": {
  "page": 87,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 40 ft. (8 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+3",
  "atk": "Hoof +3 melee (1d3+2)",
  "fatk": "2 hooves +3 melee (1d3+2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 15, Dex 13, Con 14, Int 2, Wis 11, Cha 4"
 },
 "Weasel": {
  "page": 97,
  "size": "Tiny Animal",
  "hd": "½ d8 (2 hp)",
  "tac": "--",
  "spd": "+2; 20 ft. (4 hexes), climb 20 ft.",
  "ac": "14/14 (+2 size, +2 Dex), flat-footed 12",
  "bab": "+0/-12",
  "atk": "Bite +4 melee (1d3-4)",
  "fatk": "Bite +4 melee (1d3-4)",
  "sa": "Attach",
  "sq": "Low-light vision, scent",
  "saves": "Fort +2, Ref +4, Will +1, Dodge +6",
  "attrs": "Str 3, Dex 15, Con 10, Int 2, Wis 12, Cha 5"
 },
 "Wolf": {
  "page": 99,
  "size": "Medium Animal",
  "hd": "2d8+4 (13 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+2; 50 ft. (10 hexes)",
  "ac": "12/14 (+2 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+2",
  "atk": "Bite +3 melee (1d6+1)",
  "fatk": "Bite +3 melee (1d6+1)",
  "sa": "Trip",
  "sq": "Low-light vision, scent",
  "saves": "Fort +5, Ref +5, Will +1, Dodge +5",
  "attrs": "Str 13, Dex 15, Con 15, Int 2, Wis 12, Cha 6"
 },
 "Viper (Tiny)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Viper (Small)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Viper (Medium)": {
  "page": 91,
  "ref": "columned block - see FF Snake entry p.91"
 },
 "Shark (Medium)": {
  "page": 90,
  "ref": "columned block - see FF Shark entry p.90"
 },
 "Donkey": {
  "page": 35,
  "size": "Medium Animal",
  "hd": "2d8+2 (11 hp)",
  "tac": "Hardness 2; +10 HP",
  "spd": "+1; 30 ft. (6 hexes)",
  "ac": "11/13 (+1 Dex, +2 natural), flat-footed 12",
  "bab": "+1/+1",
  "atk": "Bite +1 melee (1d2)",
  "fatk": "Bite +1 melee (1d2)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +4, Ref +4, Will +0, Dodge +4",
  "attrs": "Str 10, Dex 13, Con 12, Int 2, Wis 11, Cha 4",
  "carry": "light 50 / medium 100 / heavy 150 lb; drags 750 lb"
 },
 "Mule": {
  "page": 35,
  "size": "Large Animal",
  "hd": "3d8+9 (22 hp)",
  "tac": "Hardness 3; +15 HP",
  "spd": "+1; 30 ft. (6 hexes)",
  "ac": "10/13 (-1 size, +1 Dex, +3 natural), flat-footed 12",
  "bab": "+2/+9",
  "atk": "Hoof +4 melee (1d4+3)",
  "fatk": "2 hooves +4 melee (1d4+3)",
  "sa": "—",
  "sq": "Low-light vision, scent",
  "saves": "Fort +6, Ref +4, Will +1, Dodge +3",
  "attrs": "Str 16, Dex 13, Con 17, Int 2, Wis 11, Cha 6",
  "carry": "light 230 / medium 460 / heavy 690 lb; drags 3,450 lb"
 }
};
// ============================================================================
// v8.8.3 COMPANIONS (Adam's request): basic Familiar / Animal Companion /
// Special Mount records — FF base stats where extractable, HH pp.109–111
// progression by the master's effective level. Storage: c.companions =
// [{id, kind, species, name}] (lazy).
// ============================================================================
const FAMILIAR_SPECIES = ['Bat', 'Cat', 'Hawk', 'Lizard', 'Owl', 'Rat', 'Raven', 'Viper (Tiny)', 'Toad', 'Weasel'];
const ANIMAL_COMPANION_SPECIES = ['Badger', 'Camel', 'Dire Rat', 'Dog', 'Riding Dog', 'Eagle', 'Hawk', 'Horse (light)', 'Horse (heavy)', 'Owl', 'Pony', 'Viper (Small)', 'Viper (Medium)', 'Wolf', 'Crocodile', 'Porpoise', 'Shark (Medium)', 'Squid'];
const MOUNT_SPECIES = ['Warhorse (heavy)', 'Warpony', 'Warhorse (light)'];
// Master perks (HH p.110): apply while the familiar is within 1 mile
// (Alertness needs arm's reach). Skill/save perks are folded into the
// master's numbers with the condition in the label.
const FAMILIAR_PERKS = {
  'Bat': { skill: 'Listen', v: 3 }, 'Cat': { skill: 'Move Silently', v: 3 },
  'Hawk': { skill: 'Spot', v: 3, note: 'in bright light' }, 'Lizard': { skill: 'Climb', v: 3 },
  'Owl': { skill: 'Spot', v: 3, note: 'in shadows' }, 'Rat': { save: 'fort', v: 2 },
  'Raven': { skill: 'Appraise', v: 3, note: 'speaks one language (Su)' }, 'Viper (Tiny)': { skill: 'Bluff', v: 3 },
  'Toad': { hp: 3 }, 'Weasel': { save: 'ref', v: 2 },
};
// HH p.109 Animal Companion / Special Mount progression (2026-09-04 edition:
// the section is now "Animal Companions, Special Mounts, and Familiars" and
// the mount shares this chart at the parenthesized HALVED values — mhd/mnac/
// madj below, copied from print, not derived; Str/Dex +1 row is shared,
// tricks are shared, and mounts never get Improved Evasion per the chart's
// footnote). Effective level: Druid level, or Ranger/Paladin level − 3.
const ANIMAL_COMPANION_PROG = [
  { min: 1,  hd: 0,  nac: 0,  adj: 0, tricks: 1, special: 'Link, share spells',   mhd: 0, mnac: 0, madj: 0 },
  { min: 3,  hd: 2,  nac: 2,  adj: 1, tricks: 2, special: 'Evasion',              mhd: 1, mnac: 1, madj: 1 },
  { min: 6,  hd: 4,  nac: 4,  adj: 2, tricks: 3, special: 'Devotion',             mhd: 2, mnac: 2, madj: 1 },
  { min: 9,  hd: 6,  nac: 6,  adj: 3, tricks: 4, special: 'Multiattack',          mhd: 3, mnac: 3, madj: 2 },
  { min: 12, hd: 8,  nac: 8,  adj: 4, tricks: 5, special: '',                     mhd: 4, mnac: 4, madj: 2 },
  { min: 15, hd: 10, nac: 10, adj: 5, tricks: 6, special: 'Improved Evasion',     mhd: 5, mnac: 5, madj: 3 },
  { min: 18, hd: 12, nac: 12, adj: 6, tricks: 7, special: '',                     mhd: 6, mnac: 6, madj: 3 },
];
// HH p.111 Familiar progression (by master's level).
const FAMILIAR_PROG = [
  { min: 1,  nac: 1,  int: 6,  special: 'Alertness (arm’s reach), improved evasion, share spells, empathic link' },
  { min: 3,  nac: 2,  int: 7,  special: 'Deliver touch spells' },
  { min: 5,  nac: 3,  int: 8,  special: 'Speak with master' },
  { min: 7,  nac: 4,  int: 9,  special: 'Speak with animals of its kind' },
  { min: 9,  nac: 5,  int: 10, special: '' },
  { min: 11, nac: 6,  int: 11, special: 'Spell resistance = master level + 5' },
  { min: 13, nac: 7,  int: 12, special: 'Scry on familiar 1/day' },
  { min: 15, nac: 8,  int: 13, special: '' },
  { min: 17, nac: 9,  int: 14, special: '' },
  { min: 19, nac: 10, int: 15, special: '' },
];
