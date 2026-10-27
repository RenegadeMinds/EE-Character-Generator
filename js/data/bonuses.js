// =============================================================================
// js/data/bonuses.js
// BONUSES — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Bonus types and their stacking rules
//   (GM's Guide pp.22-23).
//
// KEY NAMES (so you can search for them)
//   tables and state: BONUS_TYPES, STACKING_RULES
//
// WHERE IT CAME FROM
//   Gathered from js/rules/19-bonus-aggregator-and-stat-block.js when the
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

// Compute total stats for given hero+basic class+levels combination.
// Hero class entries have only 10 levels in their tables; Basic classes have 20.
// For levels beyond the table length, the highest available value is used (graceful handling
// of multiclass cases above class-specific level cap, though normally levels stay ≤10/20).
// ========================================================================
// v8 BONUS AGGREGATOR SYSTEM (Modifier Types per GM's Guide pp. 22-23)
// ------------------------------------------------------------------------
// Every computed stat (BAB, saves, AC, skill totals, etc.) is built from a
// list of typed "bonus contributions". Each contribution is:
//   {type, source, value, target?, condition?}
// where:
//   type      — one of the 18 modifier types from BONUS_TYPES below
//   source    — string identifier for the bonus's origin (e.g. 'class:Fighter:5',
//               'race:Stone Giant', 'feat:Iron Will', 'spell:Bull's Strength')
//   value     — signed integer (negative = penalty)
//   target    — optional: the stat key this bonus applies to (used when bonuses
//               are stored in a flat list rather than pre-bucketed)
//   condition — optional string; if present, the bonus only applies when that
//               condition is "active" (e.g. 'rocky terrain', 'vs poison',
//               'while raging'). Always-on bonuses have no condition.
//
// Stacking rules (GM's Guide p.22-23):
//   - Bonuses from different SOURCES of different TYPES stack
//   - Same-TYPE bonuses don't stack — only the best positive AND worst negative apply
//   - Same-SOURCE bonuses don't stack regardless of type (e.g. two castings
//     of Bull's Strength: both are enhancement type AND same source, so only
//     one applies — and the dispel-magic case is preserved because both
//     instances exist on the character, just not both contributing)
//   - Three types DO self-stack: Dodge, Circumstance, Untyped
//
// "Same source" is interpreted strictly: the source string must match exactly.
// This means two different feats both granting +1 untyped to Fort have
// different sources ('feat:Iron Will' vs 'feat:Lightning Reflexes') and both
// apply (untyped self-stacks). But two castings of Bull's Strength both have
// source 'spell:Bulls Strength' so they collapse to one.
// ========================================================================
const BONUS_TYPES = {
  ALCHEMICAL:   'alchemical',
  ARMOR:        'armor',
  CIRCUMSTANCE: 'circumstance',
  COMPETENCE:   'competence',
  DEFLECTION:   'deflection',
  DODGE:        'dodge',
  ENHANCEMENT:  'enhancement',
  EQUIPMENT:    'equipment',
  INSIGHT:      'insight',
  LUCK:         'luck',
  MORALE:       'morale',
  NATURAL:      'natural',         // natural armor
  PROFANE:      'profane',
  RACIAL:       'racial',
  RESISTANCE:   'resistance',
  SACRED:       'sacred',
  SHIELD:       'shield',
  SIZE:         'size',
  SYNERGY:      'synergy',        // v8.3.9: 5+ ranks in skill X → +2 to related skill Y. Different sources stack.
  TECH:         'tech',           // v8.92.0 (Adam's ruling): cybernetic subq body armor = a TECH bonus to Natural AC — stacks with biological natural armor, best-of-type among tech sources, and feeds the ×5-HP rule like any other permanent NAC.
  MUTATION:     'mutation',       // DEPRECATED (Adam's ruling 2026-09-01): Advantages are EXTRAORDINARY (Ex) modifiers, not a "mutation" stacking type — their bonuses are untyped-Ex (different sources stack; the book's "+N mutation bonus" phrasing names the Ex category, not a stacking type). Constant retained for data compatibility only.
  UNTYPED:      'untyped',
  // Internal types not in the GM's table but mechanically distinct in the engine:
  ABILITY:      'ability',         // attribute modifier (STR/DEX/CON/INT/WIS/CHA)
  CLASS:        'class',           // class progression contribution (effectively untyped, unique-by-source)
  BASE:         'base',            // hardcoded base values (e.g. the 10 in AC = 10 + Dex + …)
};
// Per-type stacking flags. Types not in this map default to non-stacking.
const STACKING_RULES = {
  // Self-stacking types (sum within type after source-dedupe)
  [BONUS_TYPES.CIRCUMSTANCE]: {selfStacks:true,  touchAC:'possibly'},
  [BONUS_TYPES.DODGE]:        {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.UNTYPED]:      {selfStacks:true,  touchAC:true},
  // v8.3.9: Synergy bonuses (e.g. 5+ ranks in Bluff → +2 to Diplomacy) self-stack
  // when they come from different source skills. The d20 lineage convention is
  // that you can't take the SAME synergy twice (which is automatic — each
  // source-skill entry is unique by name), but two synergies into the same
  // target skill from two different source skills both apply.
  [BONUS_TYPES.SYNERGY]:      {selfStacks:true,  touchAC:'na'},
  // Class & ability contributions are unique-by-source by construction, so
  // "self-stacking" is moot — they simply sum since each source appears once.
  [BONUS_TYPES.CLASS]:        {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.ABILITY]:      {selfStacks:true,  touchAC:true},
  [BONUS_TYPES.BASE]:         {selfStacks:true,  touchAC:true},
  // Equipment is "possibly" — the GM's Guide notes it depends on the equipment.
  // We default to non-stacking, with override available via the Equipment subsystem (v9+).
  [BONUS_TYPES.EQUIPMENT]:    {selfStacks:false, touchAC:false},
  // The rest — non-stacking by default
  [BONUS_TYPES.ALCHEMICAL]:   {selfStacks:false, touchAC:'na'},
  [BONUS_TYPES.ARMOR]:        {selfStacks:false, touchAC:false},
  [BONUS_TYPES.COMPETENCE]:   {selfStacks:false, touchAC:true},
  [BONUS_TYPES.DEFLECTION]:   {selfStacks:false, touchAC:true},
  [BONUS_TYPES.ENHANCEMENT]:  {selfStacks:false, touchAC:false},
  [BONUS_TYPES.INSIGHT]:      {selfStacks:false, touchAC:true},
  [BONUS_TYPES.LUCK]:         {selfStacks:false, touchAC:true},
  [BONUS_TYPES.MORALE]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.NATURAL]:      {selfStacks:false, touchAC:false},
  [BONUS_TYPES.PROFANE]:      {selfStacks:false, touchAC:true},
  [BONUS_TYPES.RACIAL]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.RESISTANCE]:   {selfStacks:false, touchAC:'na'},
  [BONUS_TYPES.SACRED]:       {selfStacks:false, touchAC:true},
  [BONUS_TYPES.SHIELD]:       {selfStacks:false, touchAC:false},
  [BONUS_TYPES.SIZE]:         {selfStacks:false, touchAC:true},
};
