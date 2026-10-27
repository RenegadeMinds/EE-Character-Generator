// =============================================================================
// js/data/combat.js
// COMBAT — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Energy types, super-strength talents,
//   carrying capacity, movement grants, weapon specials and the bonus types.
//
// KEY NAMES (so you can search for them)
//   tables and state: ENERGY_TYPES, STRONG_SUPER_TALENTS,
//   STRONG_PASSIVE_RIDERS, MANGLER_LADDER, CARRY_TABLE_HH, MOVEMENT_GRANTS,
//   WEAPON_SPECIALS, ENERGY_RES_TREE, ATTR_DMG_ZERO
//
// WHERE IT CAME FROM
//   Gathered from js/app/52-energy-immunity-and-spell-lists.js,
//   js/app/65-tracker-logs-and-damage.js, js/rules/14-resistances-speed-dr-
//   size.js, js/rules/15-combat-declarations-and-melee.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ============================================================================
// v8.8.0 SPEED SYSTEM (Adam's design, 2026-09-02). Base walk speed derives
// from race/size (HH: Humans 30′; Dwarf/Gnome/Halfling race lines say 20′;
// other Small races 20′ by size) — Run is ×4 of walk (HH combat movement).
// Movement TYPES: Walk / Swim / Fly / Burrow (the Foe Folio's future home
// turf). Contributions: talent speed bonuses + multipliers (Fast Hero's
// Increased Speed chain, Hyper-Speed), the Reduced Speed drawback (−5 all
// modes), Wings (fly 60′ average), and the equipped armor's speed
// limitation (worst piece; Ultralight eases +5; DWARVES ARE STOCKY — never
// slowed by armor, HH race line). All derived live.
// ============================================================================
// ============================================================================
// v8.8.0 RESISTANCES & IMMUNITIES (Adam's design, 2026-09-02). Aggregated
// from every source with provenance; per d20, same-type resistances don't
// stack — the BEST value applies — and immunity supersedes. Sources:
//   • Tough Hero Energy Resistance talents (conMod-valued channels);
//   • the Energy Immunity super-talent (immune to every type whose
//     Resistance talent is owned — the Super-Tough endgame);
//   • Energy Absorption / Diffusion mutations (types chosen at acquisition);
//   • enchanted armor/shield abilities (X Resistance 10 / Improved 20 /
//     Greater 30) on EQUIPPED pieces;
//   • the Energy Resistance ring (10, type chosen at add) while equipped.
// Universal energy resistance derives when all five main types are covered
// (the only defense that touches disintegration — DAMAGE_TYPES).
// ============================================================================
const ENERGY_TYPES = ['acid', 'cold', 'electricity', 'fire', 'sonic'];

// ----- v8.8.2 (Adam's "fully applied?" audit of the Strong super-talents) -----
// HH p.263 Supernatural Strength sidebar: EVERY Strong super-talent — Supreme
// Effort, Mangler, Super-Smash, AND Titanic Strength — carries cumulative
// riders beyond its headline effect: ×4 Carrying Capacity each (multiplicative
// — all four = ×64) and +1 effective size category each for natural attack
// damage dice, grappling, and the Jump skill. Only the headline effects were
// wired before this pass. The riders are Supernatural (super-talents) — all
// suppressed while c.nullified. Supreme Effort's ACTIVE window grants one MORE
// ×4 / +1 size on top (move-action, player-declared — manual door, noted only).
const STRONG_SUPER_TALENTS = ['Supreme Effort', 'Mangler', 'Super-Smash', 'Titanic Strength'];
// PASSIVE riders only: Supreme Effort's ×4/+1 applies solely WHILE PERFORMING
// one (its table row says so, and the book's worked example — Supreme Effort
// + one other talent = ×4 passive, ×16 during the Effort — confirms it). The
// true Titan with all four is thus ×64/Gargantuan passive, ×256/Colossal
// during a Supreme Effort, exactly as HH p.263 states.
const STRONG_PASSIVE_RIDERS = ['Mangler', 'Super-Smash', 'Titanic Strength'];
// ============================================================================
// v8.88.0 (Adam's Titanic-parity ruling, 2026-10-03): THE DEMOLITION MATH.
// Base Ignore Hardness tree (Ex, additive): 2/−1 per tier (totals 2/−1,
// 4/−2, 6/−3). Mangler (Su) REPLACES it by tier — "instead of the Ignore
// Hardness modifiers": 5/−2, 10/−5, 20/−8. TITANIC STRENGTH acts as ANOTHER
// INSTANCE of Mangler — hardness/break-DC ONLY (ruled: the ×4-carry/+1-size
// rider is already counted per talent, HH p.263): both owned = double effect
// (10/−4, 20/−10, 40/−16); a Mangler-less Titan carries the single instance
// at base Mangler values; no Ignore Hardness talent at all → the function is
// LATENT until the tree is entered. Su: Mangler/Titanic fall under NPF and
// the Ex tree values stand back up.
// ============================================================================
const MANGLER_LADDER = { 1: [5, 2], 2: [10, 5], 3: [20, 8] };
// HH p.261 Table: Carrying Capacity — [light max, medium max, heavy max] lb
// per Str score. Verbatim from the book, including the 26–29 oddities.
const CARRY_TABLE_HH = {
  1: [3, 6, 10], 2: [6, 13, 20], 3: [10, 20, 30], 4: [13, 26, 40], 5: [16, 33, 50],
  6: [20, 40, 60], 7: [23, 46, 70], 8: [26, 53, 80], 9: [30, 60, 90], 10: [33, 66, 100],
  11: [38, 76, 115], 12: [43, 86, 130], 13: [50, 100, 150], 14: [58, 116, 175], 15: [66, 133, 200],
  16: [76, 153, 230], 17: [86, 173, 260], 18: [100, 200, 300], 19: [116, 233, 350], 20: [133, 266, 400],
  21: [153, 306, 460], 22: [173, 346, 520], 23: [200, 400, 600], 24: [233, 466, 700], 25: [266, 533, 800],
  26: [306, 613, 920], 27: [346, 693, 1040], 28: [400, 800, 1200], 29: [466, 933, 1400],
};

// v9.10.0 (§263, Adam's Tytyvyllus report): named movement powers feed the
// Speed cell. Keyed by spell/power NAME, so the same map serves (a) owned
// super-powers (pool:'super' — at-will, permanent display) and (b) active
// buff effects (c.activeEffects from casts — display while in effect).
// Every number verified against the HH dump: Fly "at a speed of 60 ft.",
// Overland Flight 40 ft., Spider Climb "climb speed of 20 feet",
// Ectoplasmic Form "20 feet (perfect)", Expeditious Route +30 ft.,
// Longstrider +10 ft., Haste "+30 feet, to a maximum of twice... normal"
// (all modes, enhancement — multiple Hastes don't stack), Levitate
// "up or down as much as 20 feet each round; doing so is a move action".
// Extend here as more movement powers come up.
const MOVEMENT_GRANTS = {
  'Fly':               { mode: { type: 'Fly', speed: 60, note: 'Fly' } },
  'Overland Flight':   { mode: { type: 'Fly', speed: 40, note: 'Overland Flight' } },
  'Spider Climb':      { mode: { type: 'Climb', speed: 20, note: 'Spider Climb' } },
  'Ectoplasmic Form':  { mode: { type: 'Fly', speed: 20, note: 'perfect (Ectoplasmic Form)' } },
  'Levitate':          { mode: { type: 'Levitate', speed: 20, note: 'up/down only, move action (Levitate)' } },
  'Expeditious Route': { walk: 30 },
  'Longstrider':       { walk: 10 },
  'Haste':             { haste: true },
};

// ============================================================================
// v8.61.0 — ⚔ EXPANDED MELEE OPTIONS + COMBAT RIDERS (Adam's Tier A, §182).
// The HH's special attacks are MELEE-ATTACK SUBSTITUTES (Table: Actions in
// Combat, footnote 4): Disarm, Trip, and Grapple replace any melee attack —
// any swing of the Full Attack ladder, even an AoO. Feint is a standard
// action (move with Improved Feint); Bull Rush an attack or charge part;
// Overrun a standard action taken during the move (the printed exception);
// Sunder a melee attack. Anyone may attempt any of them — the uninitiated's
// tax is the ⚠ tags (AoOs, counter-attempts). Visibility (Adam's design):
// the global "Expanded Melee Options" toggle shows every maneuver on every
// melee row; toggled off, a maneuver persists only where its Improved feat
// (or Combat Throw) is owned.
// WEAPON SPECIAL PROPERTIES (v8.61.1 — Adam's pp.280-282 pointer). The HH
// DOES carry property prose, in the per-Tech-Scale weapon description
// blocks: the TS1 exotics are fully specified (Bolas, Spiked Chain, Net,
// Whip, bastard sword — pp.280-282), and the Charge rules (p.371) canonize
// set-vs-charge for spears/tridents and the lance's mounted double. The
// MARTIAL POLEARMS and flails have NO description lines — that narrower
// book gap stays flagged for the Word pass; their 3.5-canon properties are
// carried here marked `proposed` per house doctrine (3.5 fills E&E silence).
const WEAPON_SPECIALS = {
  // ---- BOOK-CANON ----
  'Bolas':          { rangedTrip: true, src: 'HH p.280', note: 'Ranged TRIP attack — and you can’t be counter-tripped during your own attempt.' },
  'Spiked Chain':   { trip: true, dropToAvoid: true, disarmBonus: 2, reach: '10 ft AND adjacent foes', finesse: true, src: 'HH p.280' },
  'Net':            { entangle: true, src: 'HH pp.280-281', note: 'Ranged TOUCH attack (max 10 ft, targets within one size category): hit = ENTANGLED (−2 attacks, −4 Dex, half speed, no charge/run; spellcasting needs Concentration DC 15). Control the trailing rope with an opposed Str check to limit their movement. Escape: Escape Artist DC 20 or burst Str DC 25 (full-round; net has 5 HP). Must be folded to throw well — unfolded throws take −4; refolding takes 2 rounds (4 unproficient).' },
  'Whip':           { trip: true, dropToAvoid: true, disarmBonus: 2, reach: '15 ft (does NOT threaten; usable adjacent)', finesse: true, src: 'HH p.282', note: 'Nonlethal damage; deals NO damage to targets with armor bonus +1 or natural armor +3 or higher. Using a whip provokes an AoO, like a ranged weapon.' },
  'Sword, bastard': { src: 'HH p.281', note: 'Exotic one-handed — but usable TWO-HANDED as a martial weapon (no exotic proficiency needed that way).' },
  'Spear':          { setVsCharge: true, src: 'HH p.371' },
  'Trident':        { setVsCharge: true, src: 'HH p.371' },
  'Longspear':      { setVsCharge: true, reachOnly: '10 ft — not adjacent', src: 'HH p.371 (charge); reach proposed' },
  'Lance':          { chargeDouble: true, src: 'HH p.371', note: 'Double damage when used by a MOUNTED character in a charge.' },
  // ---- OGL-VERIFIED (3.5 SRD Equipment — Open Game Content; the HH's own
  // description inserts are queued on Adam's TODO [v8.61.2]. The `proposed`
  // flag here means "not yet PRINTED in the HH", and keeps the asterisk.) ----
  'Guisarme':       { trip: true, dropToAvoid: true, reachOnly: '10 ft — not adjacent', proposed: true, src: 'OGL 3.5 SRD' },
  'Halberd':        { trip: true, dropToAvoid: true, setVsCharge: true, proposed: true, src: 'OGL 3.5 SRD' },
  'Glaive':         { reachOnly: '10 ft — not adjacent', proposed: true, src: 'OGL 3.5 SRD' },
  'Ranseur':        { disarmBonus: 2, reachOnly: '10 ft — not adjacent', proposed: true, src: 'OGL 3.5 SRD' },
  'Flail':          { trip: true, dropToAvoid: true, disarmBonus: 2, proposed: true, src: 'OGL 3.5 SRD' },
  'Flail, heavy':   { trip: true, dropToAvoid: true, disarmBonus: 2, proposed: true, src: 'OGL 3.5 SRD ("Flail or Heavy Flail" — one shared entry)' },
  'Scythe':         { trip: true, dropToAvoid: true, proposed: true, src: 'OGL 3.5 SRD' },
  'Sickle':         { trip: true, dropToAvoid: true, proposed: true, src: 'OGL 3.5 SRD' },
  'Quarterstaff':   { proposed: true, src: 'OGL 3.5 SRD', note: 'Double weapon: fight as if with two weapons (one-handed + light, all TWF penalties). One-handed, only one end can strike.' },
  'Sling':          { proposed: true, src: 'OGL 3.5 SRD', note: 'Your Strength modifier applies to damage. Fire (not load) one-handed; loading is a move action needing two hands and provokes AoOs.' },
};
// v8.61.2 amendments to canon entries: the SRD adds Lance reach + the
// one-handed-while-mounted clause on top of the HH p.371 charge double.
WEAPON_SPECIALS['Lance'].reachOnly = '10 ft — not adjacent';
WEAPON_SPECIALS['Lance'].note = 'Double damage when used by a MOUNTED character in a charge. While mounted, you can wield a lance one-handed. (Reach clause: OGL 3.5 SRD — HH insert queued.)';
// ============================================================================
// v8.87.0 (Adam's intent ruling, 2026-10-03): ENERGY IMMUNITY, the two-step
// engine. The printed d: was read as conversion-only; the intent: (1) buying
// it grants ONE FREE talent from the Energy Resistance Tree — no slot, no
// MP ("Choose another Talent from the Energy Resistance Talent Tree"), THEN
// (2) immunity to every type whose Resistance talent is owned (already wired
// in computeResistances). Floor: a one-resistance buyer walks away immune to
// TWO types. Ceiling: whole tree already owned → the grant is "potentially
// extraneous" (his words) and is skipped with a note. The granted record
// carries grantedBy:'Energy Immunity' — exempt from the slot budget, and it
// cascades away if Energy Immunity itself is removed.
// ============================================================================
const ENERGY_RES_TREE = ['Acid Resistance', 'Cold Resistance', 'Electricity Resistance', 'Fire Resistance', 'Sonic/Concussion Resistance'];
// v8.50.0: GENERAL ATTRIBUTE DAMAGE — the tracker panel (Ego Whip, a
// Shadow's touch, poison…). c.attrDmg = [Str..Cha] temporary damage;
// modifiers change immediately (effAttrs subtracts in full — no half-floor,
// horror strain lives in the Sanity panel instead); heals 1 per evening of
// rest ("Ability Damaged", HH conditions; a feat can raise the rate).
// Ability DRAIN is permanent: edit the attribute itself. House precedent
// (v8.6.0): the max-HP snapshot uses BASE Con, so Con damage does not
// auto-shrink max HP — the GM applies that per RAW if desired.
const ATTR_DMG_ZERO = ['helpless — collapses (Str 0)', 'immobilized (effective Dex 0)', 'DEAD (Con 0)',
                       'unconscious (Int 0)', 'unconscious (Wis 0)', 'unconscious (Cha 0)'];
