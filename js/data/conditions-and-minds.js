// =============================================================================
// js/data/conditions-and-minds.js
// CONDITIONS AND MINDS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. The conditions reference and the
//   Mind's Ledger (insanity and horror) tables.
//
// KEY NAMES (so you can search for them)
//   tables and state: MIND_TIERS, MIND_SIZE_ROWS, CONDITION_TIER_STYLE,
//   CONDITIONS_DATA, COMMON_CONDITIONS
//
// WHERE IT CAME FROM
//   Gathered from js/rules/10-minds-ledger-and-magic-browser.js,
//   js/rules/19-bonus-aggregator-and-stat-block.js when the code was
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

// v8.46.3 (Adam's bug report): the TIER IS DERIVED from the insanity count —
// the streamlined rules make them one fact (first break = Mild, second =
// Severe, third+ = Complete), and storing them separately let them desync
// (+ moved the count only, − moved both: ins 1 with tier "sane"). One
// source of truth; m.tier is kept synced on every mutation for save files.
const MIND_TIERS = [
  ['sane', 'No insanities. Mental damage heals at 1 point per day; if a mental attribute reaches 0, the mind must Break — or Swoon, facing awe.'],
  ['Mildly Insane', 'One mental break. The insanity surfaces only under extreme pressure: at 25% or less of total HP, Will DC 15 or suffer a bout of insanity (as the Insanity spell, HH) lasting 10 − best mental modifier rounds. Each insanity also adds +1 to Horror save DCs and +1 to mental damage taken.'],
  ['Severely Insane', 'Two mental breaks. The insanity expresses itself often: at 50% or less of total HP, or on a failed Will save in combat, Will DC 20 or suffer a bout (as the Insanity spell, HH) lasting 20 − best mental modifier rounds. Each insanity adds +1 to Horror save DCs and +1 to mental damage taken.'],
  ['Completely Insane', 'Three or more breaks. Always under the effect of their Insanity (as the spell, HH) — without treatment or restraint, a threat to themselves and those around them. Curing: high magic, or 6 months of counselling (Will DC 30).'],
];
const MIND_SIZE_ROWS = [
  { k: 'na',   lbl: 'no size row (spell / power / unseen)', dc: 0,  dmg: '' },
  { k: 'sm3',  lbl: '3+ sizes smaller',  dc: -4, dmg: '1' },
  { k: 'sm2',  lbl: '2 sizes smaller',   dc: -2, dmg: '1' },
  { k: 'sm1',  lbl: '1 size smaller',    dc: 0,  dmg: '1d2' },
  { k: 'same', lbl: 'same size',         dc: 2,  dmg: '1d3' },
  { k: 'lg1',  lbl: '1 size larger',     dc: 4,  dmg: '1d3+1' },
  { k: 'lg2',  lbl: '2 sizes larger',    dc: 6,  dmg: '1d4+1' },
  { k: 'lg3',  lbl: '3 sizes larger',    dc: 8,  dmg: '2d4' },
  { k: 'lg4',  lbl: '4+ sizes larger',   dc: 10, dmg: '3d4' },
];
// v8.3.20: Conditions reference data.
//
// Sourced from the Hero's Handbook condition appendix (HH p.367-370). Each
// condition is a structured entry with:
//   tier   — one of 'beneficial'|'mild'|'moderate'|'severe'|'terminal'.
//            Drives both the inline visual on the Tracker and the persistent
//            Sheet banner color. Forward-compatible: adding a new tier just
//            requires extending CONDITION_TIER_STYLE below.
//   gloss  — one-line summary for the Sheet's persistent banner. Keep brief —
//            full handbook text lives in `desc` and surfaces on the Tracker.
//   desc   — full handbook description for the Tracker's mechanical-effects
//            panel. Quoted/paraphrased from HH p.367-370 verbatim where
//            possible; long passages broken into readable paragraphs.
//   citation — {book, page} envelope matching the existing citation pattern.
//   mechanicalEffects — RESERVED for v8.3.21+. Will hold structured bonus
//            entries (e.g. [{type:'penalty', target:'attack', value:-2}])
//            so the bonus-aggregator can auto-apply condition effects.
//            Currently empty arrays; do not consume.
//
// The condition list reproduces the rules text closely. Where the handbook
// uses variable text like "–[Constitution modifier]" we preserve it verbatim,
// since the player needs the rule, not a pre-computed value (the computation
// would also vary if Con shifts mid-session).
const CONDITION_TIER_STYLE = {
  beneficial: {
    // Net-positive or mixed-advantage conditions (Invisible, Incorporeal).
    // Blue palette, distinct from the warning hues.
    bg:'rgb(var(--tint-blue) / .15)', border:'rgb(var(--line-blue) / .45)', color:'rgb(var(--text-blue))',
    sheetBg:'rgb(var(--tint-blue) / .10)', sheetBorder:'rgb(var(--line-blue) / .5)', sheetColor:'rgb(var(--text-cornflower))',
    label:'Beneficial',
  },
  mild: {
    // Yellow tier: minor penalties or transitional states (incl. Stable —
    // bleeding stopped but still helpless).
    bg:'rgb(var(--tint-amber) / .15)', border:'rgb(var(--line-amber) / .45)', color:'rgb(var(--text-amber))',
    sheetBg:'rgb(var(--tint-amber) / .10)', sheetBorder:'rgb(var(--line-amber) / .5)', sheetColor:'rgb(var(--text-wheat))',
    label:'Mild',
  },
  moderate: {
    // Orange tier: meaningful debuffs but the character can still act.
    bg:'rgb(var(--tint-tangerine) / .15)', border:'rgb(var(--line-tangerine) / .45)', color:'rgb(var(--text-tangerine))',
    sheetBg:'rgb(var(--tint-tangerine) / .10)', sheetBorder:'rgb(var(--line-tangerine) / .5)', sheetColor:'rgb(var(--text-apricot))',
    label:'Moderate',
  },
  severe: {
    // Red tier: largely incapacitating.
    bg:'rgb(var(--tint-red) / .18)', border:'rgb(var(--line-red) / .55)', color:'rgb(var(--text-salmon))',
    sheetBg:'rgb(var(--tint-red) / .12)', sheetBorder:'rgb(var(--line-red) / .6)', sheetColor:'rgb(var(--text-pink))',
    label:'Severe',
  },
  terminal: {
    // Headstone tier: black-on-white inversion with a red border accent.
    // Singular visual treatment so it can never be confused with any other.
    bg:'rgb(var(--tint-paper))', border:'rgb(var(--line-blood))', color:'rgb(var(--text-jet))',
    sheetBg:'rgb(var(--tint-paper))', sheetBorder:'rgb(var(--line-blood))', sheetColor:'rgb(var(--text-jet))',
    label:'Terminal', stark:true,
  },
};

const CONDITIONS_DATA = {
  // ===== BENEFICIAL =====
  'Invisible': {
    tier:'beneficial',
    gloss:'+2 attacks vs sighted opponents; opponents lose Dex bonus to AC against you.',
    desc:'Visually undetectable. An invisible creature gains a +2 bonus on attack rolls against sighted opponents, and ignores its opponents\' Dexterity bonuses to AC (if any).',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Incorporeal': {
    tier:'beneficial',
    gloss:'Immune to all nonmagical attacks. Vulnerable only to magic / spell effects or other incorporeal creatures.',
    desc:'Having no physical body. Incorporeal creatures are immune to all nonmagical attack forms. They can be harmed only by other incorporeal creatures, +1 or better magic weapons, spells, spell-like effects, or supernatural effects.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },

  // ===== MILD =====
  'Shaken': {
    tier:'mild',
    gloss:'–2 to attack rolls, saving throws, and skill checks.',
    desc:'A shaken character takes a –2 penalty on attack rolls, saving throws, and skill checks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Sickened': {
    tier:'mild',
    gloss:'–2 to attack rolls, weapon damage, saves, skill checks, and ability checks.',
    desc:'A sickened character takes a –2 penalty on all attack rolls, weapon damage rolls, saving throws, skill checks, and ability checks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Dazzled': {
    tier:'mild',
    gloss:'–1 on attack rolls, Search checks, and Spot checks (overstimulated eyes).',
    desc:'The creature is unable to see well because of overstimulation of the eyes. A dazzled creature takes a –1 penalty on attack rolls, Search checks, and Spot checks.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Fatigued': {
    tier:'mild',
    gloss:'Can\'t run or charge; –2 to Str and Dex. 8 hours\' rest removes the condition.',
    desc:'Characters who are fatigued can\'t run or charge and take a penalty of –2 to Strength and Dexterity. After 8 hours of complete, uninterrupted rest, a fatigued character is no longer fatigued.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Flat-Footed': {
    tier:'mild',
    gloss:'Loses Dex bonus to AC, can\'t make attacks of opportunity. Until first action in combat.',
    desc:'A character who has not yet acted during a combat is flat-footed, not reacting normally to the situation. A flat-footed character loses their Dexterity bonus to Armor Class and cannot make attacks of opportunity.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Prone': {
    tier:'mild',
    gloss:'–4 melee attacks; can\'t use bows/thrown weapons. +4 AC vs ranged, –4 AC vs melee.',
    desc:'An attacker who is prone (lying on the ground) takes a –4 penalty on melee attack rolls and can\'t use bows or thrown ranged weapons. The character gains a +4 bonus to Armor Class against ranged attacks, but takes a –4 penalty to Armor Class against melee attacks.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Entangled': {
    tier:'mild',
    gloss:'–2 to attack, –4 to Dex. If anchored: can\'t move. Otherwise: half speed, no run/charge.',
    desc:'An entangled character takes a –2 penalty on attack rolls in addition to a –4 penalty to Dexterity. If the entangling bonds are anchored to an immobile object, the entangled hero can\'t move. Otherwise, the character can move at half speed, but can\'t run or charge.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Frightened': {
    tier:'mild',
    gloss:'Must flee source of fear. –2 to attacks, saves, skill checks, ability checks while frightened.',
    desc:'A frightened creature flees from the source of its fear as best it can. If unable to flee, it may fight. A frightened creature takes a –2 penalty on all attack rolls, saving throws, skill checks, and ability checks. A frightened creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape.\n\nFrightened is like Shaken, except that the creature must flee if possible. Panicked is a more extreme state of fear.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Stable': {
    tier:'mild',
    gloss:'No longer dying, but still unconscious. Bleeding stopped.',
    desc:'A stable character is no longer dying, but is still unconscious. Stable characters do not lose hit points each round, but they remain helpless until they regain consciousness.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },

  // ===== MODERATE =====
  'Dazed': {
    tier:'moderate',
    gloss:'Can take no actions, but retains normal AC. Typically lasts 1 round.',
    desc:'Unable to act, a dazed character can take no actions, but still gets the benefit of their normal Armor Class. This condition typically lasts 1 round.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Disabled': {
    tier:'moderate',
    gloss:'Between 0 and –[Con mod] HP. One move OR standard action per round; take 1 dmg per action.',
    desc:'The character has between 0 and –[Constitution modifier] hit points. The character can take only a single move action or standard action, and they take 1 point of damage after any action.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Exhausted': {
    tier:'moderate',
    gloss:'Half speed; no run/charge; –6 to Str and Dex. 1 hour rest → Fatigued.',
    desc:'Heroes who are exhausted move at half speed and cannot run or charge. Furthermore, they take a –6 penalty to Strength and Dexterity. After 1 hour of complete, uninterrupted rest, an exhausted character becomes fatigued.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Fascinated': {
    tier:'moderate',
    gloss:'Entranced; takes no actions; –4 on reactive skill checks. Obvious threats break the effect.',
    desc:'A fascinated creature is entranced by a supernatural or spell effect. The creature stands or sits quietly, taking no actions other than to pay attention to the fascinating effect, for as long as the effect lasts. It takes a –4 penalty on skill checks made as reactions, such as Listen and Spot checks. Any potential threat, such as a hostile creature approaching, allows the fascinated creature a new saving throw against the fascinating effect. Any obvious threat, such as someone drawing a weapon, casting a spell, or aiming a ranged weapon at the fascinated creature, automatically breaks the effect. A fascinated creature\'s ally may shake it free of the spell as a standard action.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Grappled': {
    tier:'moderate',
    gloss:'Can only attack bare-handed, with light weapon, or escape. Loses Dex bonus to AC vs others.',
    desc:'When grappled, a hero can\'t undertake any action other than attacking with their bare hands, attacking with a light weapon, or attempting to break free from their opponent. The character loses their Dexterity bonus to Armor Class versus any other attackers, except on attacks from characters with whom they are grappling.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Nauseated': {
    tier:'moderate',
    gloss:'Cannot attack or do anything requiring focus. Single move action per turn only.',
    desc:'Characters who are nauseated are unable to attack or do anything else requiring attention or concentration. The only action such a character can take is a single move action per turn.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Pinned': {
    tier:'moderate',
    gloss:'Held immobile in a grapple. –4 AC vs melee; loses Dex bonus to AC.',
    desc:'A pinned character is held immobile (but not helpless) in a grapple. The character takes a –4 penalty to Armor Class against melee attacks and loses their Dexterity bonus to AC.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Staggered': {
    tier:'moderate',
    gloss:'Single move OR standard action per round; no full-round actions.',
    desc:'A character whose nonlethal damage exactly equals their current hit points is staggered. A staggered character may take a single move action or standard action each round (but not both, nor can she take full-round actions). A character whose current hit points exceed their nonlethal damage is no longer staggered; a character whose nonlethal damage exceeds their hit points becomes unconscious.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Checked': {
    tier:'moderate',
    gloss:'Prevented from forward motion by external force (e.g., wind). Ground: stops. Flying: blown back.',
    desc:'Prevented from achieving forward motion by an applied force, such as wind. Checked creatures on the ground merely stop. Checked flying creatures move back a distance specified in the description of the effect.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Turned': {
    tier:'moderate',
    gloss:'(Undead only) Flees for 10 rounds. If cannot flee, cowers.',
    desc:'Affected by a Turn Undead attempt. Turned undead flee for 10 rounds (1 minute) by the best and fastest means available to them. If they cannot flee, they cower.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Knocked Down': {
    tier:'moderate',
    gloss:'Knocked prone by wind force. Flying creatures blown back 1d6 × 10 feet instead.',
    desc:'Depending on their size, creatures can be knocked down by winds of high velocity. Creatures on the ground are knocked prone by the force of the wind. Flying creatures are instead blown back 1d6 x 10 feet.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Blown Away': {
    tier:'moderate',
    gloss:'Ground: knocked down, roll 1d4 × 10 ft, 1d4 nonlethal/10ft. Flying: blown 2d6 × 10 ft, 2d6 nonlethal.',
    desc:'Depending on its size, a creature can be blown away by winds of high velocity. A creature on the ground that is blown away is knocked down and rolls 1d4 x 10 feet, taking 1d4 points of nonlethal damage per 10 feet. A flying creature that is blown away is blown back 2d6 x 10 feet and takes 2d6 points of nonlethal damage due to battering and buffering.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Ability Damaged': {
    tier:'moderate',
    gloss:'Lost 1+ attribute points. Temporary — returns 1 per evening of rest.',
    desc:'The character has lost 1 or more attribute points. The loss is temporary, and these points return at a rate of 1 per evening of rest. This differs from "effective" ability loss, which is an effect that goes away when the condition causing it goes away.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Energy Drained': {
    tier:'moderate',
    gloss:'Gains negative level(s). –1 attack/saves/checks, –5 HP, –1 effective level, –PP per negative level.',
    desc:'The character gains one or more negative levels, which might permanently drain the character\'s levels. If the subject has at least as many negative levels as Hit Dice, he dies. Each negative level gives a creature the following penalties: –1 penalty on attack rolls, saving throws, skill checks, ability checks; loss of 5 hit points; and –1 to effective level (for determining the power, duration, DC, and other details of spells or special abilities). In addition, a spellcaster/manifester loses power points equal to the power points required to cast/manifest their highest level spell/power.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Cowering': {
    tier:'moderate',
    gloss:'Frozen in fear. Loses Dex bonus, takes no actions, –2 AC. Typically lasts 10 rounds.',
    desc:'The hero is frozen in fear, loses their Dexterity bonus, and can take no actions. In addition, the character takes a –2 penalty to their Armor Class. The condition typically lasts 10 rounds.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Confused': {
    tier:'moderate',
    gloss:'Roll d% each turn: 01-10 attack caster, 11-20 normal, 21-50 babble, 51-70 flee, 71-100 attack nearest.',
    desc:'A confused character\'s actions are determined by rolling d% at the beginning of their turn: 01–10, attack caster with melee or ranged weapons (or close with caster if attacking is not possible); 11–20, act normally; 21–50, do nothing but babble incoherently; 51–70, flee away from caster at top possible speed; 71–100, attack nearest creature (for this purpose, a familiar counts as part of the subject\'s self). A confused character who can\'t carry out the indicated action does nothing but babble incoherently.\n\nAttackers are not at any special advantage when attacking a confused character. Any confused character who is attacked automatically attacks its attackers on its next turn, as long as it is still confused when its turn comes. A confused character does not make attacks of opportunity against any creature that it is not already devoted to attacking.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Deafened': {
    tier:'moderate',
    gloss:'–4 on initiative; cannot make Listen checks. Long-term deaf characters can overcome some drawbacks.',
    desc:'The hero can\'t hear and takes a –4 penalty on initiative checks. The character can\'t make Listen checks. Heroes who are deafened long-term (from birth or early in life) grow accustomed to these drawbacks and can overcome some of them (at the GM\'s discretion).',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },

  // ===== SEVERE =====
  'Stunned': {
    tier:'severe',
    gloss:'Loses Dex bonus, drops held items, no attack or move actions, –2 AC. Typically 1 round.',
    desc:'A character who becomes stunned loses their Dexterity bonus, drops what they are holding, and can take no attack or move actions. In addition, the character takes a –2 penalty to Armor Class. The condition typically lasts 1 round.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Blinded': {
    tier:'severe',
    gloss:'50% miss chance; effective Dex 3; –4 to Str/Dex skills, Search. Cannot Spot or read.',
    desc:'The hero can\'t see at all, and thus everything has total concealment to them. The character has a 50% chance to miss in combat. Furthermore, the blinded character has an effective Dexterity of 3, along with a –4 penalty on the use of Strength-based and Dexterity-based skills. This –4 penalty also applies to Search checks and any other skill checks for which the GM deems sight to be important. The character can\'t make Spot checks or perform any other activity (such as reading) that requires vision. Heroes who are blind long-term (from birth or early in life) grow accustomed to these drawbacks and can overcome some of them (at the GM\'s discretion).',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },
  'Panicked': {
    tier:'severe',
    gloss:'Flees at top speed. If cornered: cowers, no actions. –2 to all saves, skill, ability checks.',
    desc:'A panicked character flees as fast as possible and cowers (see Cowering) if unable to get away. They can\'t take any other actions. In addition, the character takes a –2 penalty on all saving throws, skill checks, and ability checks.\n\nIf cornered, a panicked creature cowers and does not attack, typically using the total defense action in combat. A panicked creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape.\n\nPanicked is a more extreme state of fear than Shaken or Frightened.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Paralyzed': {
    tier:'severe',
    gloss:'Falls prone, helpless. Effective Dex and Str of 0.',
    desc:'Heroes who are paralyzed fall to the ground, unable to move (they have an effective, but not actual, Dexterity and Strength of 0). They are helpless.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Petrified': {
    tier:'severe',
    gloss:'Turned to stone, treated as unconscious. Broken pieces lost on restoration cause permanent HP loss.',
    desc:'A petrified character has been turned to stone and is considered unconscious. If a petrified character cracks or breaks, but the broken pieces are joined with the body as he returns to flesh, he is unharmed. If the character\'s petrified body is incomplete when it returns to flesh, the body is likewise incomplete and there is some amount of permanent hit point loss and/or debilitation.',
    citation:{book:'HH', page:369}, mechanicalEffects:[],
  },
  'Helpless': {
    tier:'severe',
    gloss:'Effective AC 5 + size mod (Dex 0). Vulnerable to coup de grace.',
    desc:'Paralyzed, sleeping, or unconscious characters are helpless. A helpless character has an effective Armor Class of 5 + size modifier, thanks to an effective Dexterity of 0. An attacker can attempt a coup de grace against a helpless character.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Unconscious': {
    tier:'severe',
    gloss:'Unable to defend. Helpless and typically prone. From HP between –[Con mod] and –[Con] or excess nonlethal.',
    desc:'Unconsciousness can result from having current hit points between –[Constitution modifier] and –[Constitution score], or from nonlethal damage in excess of current hit points. An unconscious character is unable to defend themselves. The character is helpless and typically falls prone.',
    citation:{book:'HH', page:370}, mechanicalEffects:[],
  },
  'Dying': {
    tier:'severe',
    gloss:'Below –[Con mod] HP but above –[Con score]. No actions. Lose 1 HP per round until stable or dead.',
    desc:'The character is near death and unconscious, possessing below –[Constitution modifier] hit points but still having above –[Constitution score] hit points. The character can take no actions, and each round a dying character loses 1 hit point until they die or become stable.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
  'Ability Drained': {
    tier:'severe',
    gloss:'Lost 1+ ability score points. The loss is PERMANENT.',
    desc:'The character has lost 1 or more ability score points. The loss is permanent.',
    citation:{book:'HH', page:367}, mechanicalEffects:[],
  },

  // ===== TERMINAL =====
  'Dead': {
    tier:'terminal',
    gloss:'HP at or below –[Con score], or Con score at 0.',
    desc:'A character dies when their hit points drop to –[Constitution score] or lower, or when their Constitution drops to 0.',
    citation:{book:'HH', page:368}, mechanicalEffects:[],
  },
};

// Quick-add conditions for the Tracker panel (the 6 most common). The rest
// are reachable via the "More…" dropdown.
const COMMON_CONDITIONS = ['Prone','Stunned','Blinded','Frightened','Unconscious','Disabled'];

