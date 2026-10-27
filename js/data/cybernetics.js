// =============================================================================
// js/data/cybernetics.js
// CYBERNETICS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Cybernetic body slots and the
//   cybernetics catalog.
//
// KEY NAMES (so you can search for them)
//   tables and state: CYBER_SLOTS, CYBERNETICS_DB
//
// WHERE IT CAME FROM
//   Gathered from js/rules/11-cybernetics.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ============================================================================
// v8.91.0 🦾 CYBERNETICS (Adam's commission, 2026-10-04). HH pp.332-339:
// implants = a body-slot gear system beside Equipped Items. Core rules wired:
// max attachments = 1 + Con modifier (supernatural Con excluded, HH p.333);
// excess → 1 negative level each (advisory chip — the full −1-everything
// cascade is GM-applied); electricity vulnerability +50% unless Anti-Shock;
// PDC −2 per Tech Scale step above the implant's own TS (HH p.334);
// removal without Cybernetic Surgery = 1d4 permanent Con drain (toast).
// LOST ARM interlock (task 3): the drawback removes the off hand until a
// Prosthetic Arm replacement is installed; arm-mounted implants need the
// prosthetic first (HH: "the recipient's prosthetic arm ends in a weapon").
// ============================================================================
const CYBER_SLOTS = { neural: '🧠 Neural', eyes: '👁 Eyes', torso: '🫀 Torso', skin: '🩹 Skin', skeleton: '🦴 Skeleton', arm: '💪 Arm', leg: '🦵 Leg', limb: '🦾 Limb (arm or leg)' };
const CYBERNETICS_DB = [
  { n: 'Artificial Organ', ts: 5, type: 'Internal', hard: '–/2', pdc: 19, rx: '—', slot: 'torso', d: 'Fully replaces a defective or destroyed biological organ (heart, lung, eye, ear…). Duplicates the function of its biological counterpart; no special game benefits.' },
  { n: 'Prosthetic Arm', ts: 5, type: 'External', hard: '3/5', pdc: 17, rx: '—', slot: 'arm', replaceArm: true, d: 'Fully replaces a lost or destroyed biological arm (from shoulder, elbow, or wrist). Duplicates its biological counterpart; no special game benefits. RESTORES the off hand lost to the Lost Arm drawback.' },
  { n: 'Prosthetic Leg', ts: 5, type: 'External', hard: '3/7', pdc: 17, rx: '—', slot: 'leg', replaceLeg: true, d: 'Fully replaces a lost or destroyed biological leg (from thigh, knee, or ankle). Duplicates its biological counterpart; no special game benefits.' },
  { n: 'Artificial Organ Upgrade', ts: 6, type: 'Internal', hard: '–/4', pdc: 21, rx: '—', slot: 'torso', d: 'Upgraded TS 5 artificial organ — more resilient; cannot be disabled by massive damage effects.' },
  { n: 'Prosthetic Arm Upgrade', ts: 6, type: 'External', hard: '5/10', pdc: 19, rx: '—', slot: 'arm', replaceArm: true, d: 'Upgraded TS 5 prosthetic arm — greater hardness and HP. RESTORES the off hand lost to the Lost Arm drawback.' },
  { n: 'Prosthetic Leg Upgrade', ts: 6, type: 'External', hard: '5/15', pdc: 19, rx: '—', slot: 'leg', replaceLeg: true, d: 'Upgraded TS 5 prosthetic leg — greater hardness and HP.' },
  { n: 'Anti-Shock Implant', ts: 6, type: 'Internal', hard: '–/1', pdc: 15, rx: '—', slot: 'neural', d: 'Embedded near the brain stem; protects itself and other cybernetic hardware. NEGATES the recipient’s electricity vulnerability from cybernetics — and renders the character’s cybernetics IMMUNE to ionic damage (ionization, the nonlethal electrical type; ordinary electricity still applies — Adam’s EMP ruling, 2026-10-11).' },
  { n: 'External Weapon Mount', ts: 6, type: 'External', hard: '10/5', pdc: 0, pdcNote: 'melee 15 / ranged 17 (+arm, +weapon)', rx: 'Mil (+3)', slot: 'arm', needsArm: true, d: 'The prosthetic arm ends in a weapon instead of a hand. Disarm attempts automatically fail (the weapon can still be attacked). Base PDC: melee mount 15, ranged mount 17 — prosthetic arm and weapon not included. REQUIRES a prosthetic arm.' },
  { n: 'Identity Chip', ts: 6, type: 'Internal', hard: '–/1', pdc: 5, rx: '—', slot: 'torso', d: 'Subcutaneous legal ID + credit card; use your Wealth even when separated from your funds.' },
  { n: 'Injector Unit', ts: 6, type: 'External', hard: '2/5', pdc: 15, rx: 'Lic (+1)', slot: 'limb', d: 'Forearm/thigh unit with three hypo-syringes (antitox, boost, neutrad, sporekill [TS 6], or biocort [TS 7]). Inject any or all as a FREE action; replacing a drained hypo is a full-round action.' },
  { n: 'Nightvision Optics', ts: 6, type: 'Internal', hard: '–/2 (per eye)', pdc: 19, rx: '—', slot: 'eyes', d: 'All eyes replaced with ocular implants: darkvision 60 ft.' },
  { n: 'Skill Implant', ts: 6, type: 'Internal', hard: '–/1', pdc: 20, rx: '—', slot: 'neural', param: 'skill', d: '+2 competence bonus on one CLASS skill of your choice. Each skill needs its own implant (each a separate attachment; see Skill Plexus).' },
  { n: 'Stabilizer', ts: 6, type: 'Internal', hard: '–/3', pdc: 22, rx: '—', slot: 'torso', d: 'Installed near the heart: if reduced to negative hit points, you automatically stabilize.' },
  { n: 'Subcutaneous Body Armor (Light)', ts: 6, type: 'Internal', hard: '10/10', pdc: 15, rx: 'Mil (+3)', slot: 'skin', cnt: 1, nac: 2, d: 'Flexible armor plates under the skin: +2 natural armor bonus to AC. Counts as 1 implant.' },
  { n: 'Subcutaneous Body Armor (Medium)', ts: 6, type: 'Internal', hard: '10/25', pdc: 20, rx: 'Mil (+3)', slot: 'skin', cnt: 2, nac: 5, d: 'Flexible armor plates under the skin: +5 natural armor bonus to AC. Counts as 2 implants.' },
  { n: 'Subcutaneous Body Armor (Heavy)', ts: 6, type: 'Internal', hard: '10/40', pdc: 25, rx: 'Mil (+3)', slot: 'skin', cnt: 3, nac: 8, d: 'Flexible armor plates under the skin: +8 natural armor bonus to AC. Counts as 3 implants.' },
  { n: 'Subcutaneous Cell Phone', ts: 6, type: 'Internal', hard: '–/2', pdc: 16, rx: '—', slot: 'skin', d: 'Throat transceiver + ear speaker: converse without raising your voice above a whisper (Listen checks to overhear at −4); only you hear the other side.' },
  { n: 'Telescopic Optics', ts: 6, type: 'Internal', hard: '–/2 (per eye)', pdc: 15, rx: '—', slot: 'eyes', d: 'All eyes replaced: Spot range penalty becomes −1 per 30 ft (instead of −1 per 10 ft).' },
  { n: 'Voice Stress Analyzer', ts: 6, type: 'Internal', hard: '–/4', pdc: 17, rx: '—', slot: 'neural', skill: ['Sense Motive', 4], d: 'Optic/inner-ear sensors read pulse and galvanic response: +4 equipment bonus on Sense Motive checks.' },
  { n: 'Advanced Artificial Organ', ts: 7, type: 'Internal', hard: '–/4', pdc: 24, rx: '—', slot: 'torso', cnt: 0, d: 'Replaces a defective organ; cannot be disabled by massive damage; does NOT count toward the maximum number of attachments.' },
  { n: 'Advanced Prosthetic Arm', ts: 7, type: 'External', hard: '10/10', pdc: 22, rx: '—', slot: 'arm', replaceArm: true, cnt: 0, d: 'Replaces a lost arm; does NOT count toward the maximum number of attachments. RESTORES the off hand lost to the Lost Arm drawback.' },
  { n: 'Advanced Prosthetic Leg', ts: 7, type: 'External', hard: '10/15', pdc: 22, rx: '—', slot: 'leg', replaceLeg: true, cnt: 0, d: 'Replaces a lost leg; does NOT count toward the maximum number of attachments.' },
  { n: 'Anti-Flare Implants', ts: 7, type: 'Internal', hard: '–/1 (per eye)', pdc: 14, rx: '—', slot: 'eyes', d: 'Artificial corneas with flare suppressors: blinding effects from bright lights have no effect on you.' },
  { n: 'Anti-Stun Implant', ts: 7, type: 'Internal', hard: '–/4', pdc: 24, rx: 'Mil (+3)', slot: 'neural', d: 'Spine-embedded nervous-system shield: you cannot be stunned.' },
  { n: 'Body Repair Weave', ts: 7, type: 'Internal', hard: '–/4', pdc: 21, rx: 'Lic (+1)', slot: 'skin', d: 'Subdermal biowire weave: you heal naturally at TWICE the normal rate.' },
  { n: 'Data Archive', ts: 7, type: 'Internal', hard: '–/2', pdc: 27, rx: '—', slot: 'neural', d: 'Skull microcomputer with biochip database: ALL skills are class skills for you, and +4 equipment bonus on all Knowledge checks.' },
  { n: 'Feat Implant', ts: 7, type: 'Internal', hard: '–/5', pdc: 25, rx: 'Mil (+3)', slot: 'neural', param: 'feat', d: 'Grants one feat (prerequisites must be met; not metamagic or psionic feats). If the implant is destroyed, the feat is lost.' },
  { n: 'Fortified Skeleton', ts: 7, type: 'Internal', hard: '–/–', pdc: 32, rx: 'Mil (+3)', slot: 'skeleton', dr: 4, d: 'High-impact polymer skeletal fortification: damage reduction 4/—.' },
  { n: 'Initiative Implant', ts: 7, type: 'Internal', hard: '–/10', pdc: 20, rx: 'Mil (+3)', slot: 'neural', init: 2, d: 'Spinal wire lattice stimulating faster response times: +2 equipment bonus on Initiative checks.' },
  { n: 'Internal Weapon Mount', ts: 7, type: 'Internal', hard: '10/5', pdc: 0, pdcNote: 'melee 17 / ranged 19 (+prosthesis, +weapon)', rx: 'Mil (+3)', slot: 'arm', needsArm: true, d: 'Subcutaneous weapon in a prosthetic forearm/hand; extend/retract as a free action. Disarm fails automatically; hidden (Spot vs your Sleight of Hand). Base PDC: melee 17, ranged 19 — prosthesis and weapon not included. REQUIRES a prosthetic arm.' },
  { n: 'Laser Optics', ts: 7, type: 'Internal', hard: '–/2 (per eye)', pdc: 28, rx: 'Mil (+3)', slot: 'eyes', d: 'Ocular implants firing thin lasers: attack action, no AoO; 2d6 fire, crit on natural 20, range increment 20 ft; +2 damage per additional eye (a pair deals 2d6+2, fired together at one target).' },
  { n: 'Luminous Skin', ts: 7, type: 'Internal', hard: '–/–', pdc: 6, rx: '—', slot: 'skin', d: 'Luminous skin grafts (brightness controlled as a free action; can illuminate your hex and adjacent hexes) + built-in chronometer.' },
  { n: 'Microcomputer', ts: 7, type: 'Internal', hard: '–/4', pdc: 36, rx: 'Res (+2)', slot: 'neural', d: 'Nervous-system computer at the skull base: Computer Use checks as a MOVE action (not full-round); remote operation time halved; data port for interface cable (PDC 5).' },
  { n: 'Mindscreen Implant', ts: 7, type: 'Internal', hard: '–/2', pdc: 28, rx: 'Mil (+3)', slot: 'neural', d: '+2 equipment bonus on saving throws against mind-affecting attacks.' },
  { n: 'Prosthetic Enhancer', ts: 7, type: 'Internal', hard: '–/2', pdc: 22, rx: '—', slot: 'limb', needsProsthetic: true, cnt: 0, d: 'Attaches to a prosthetic limb. Leg: +5 ft base speed, +1 unarmed damage with that leg. Arm: +2 on Str- and Dex-based ability/skill checks, +1 unarmed damage with that arm. Does NOT count toward the attachment maximum. REQUIRES a prosthetic arm or leg.' },
  { n: 'Rage Implant', ts: 7, type: 'Internal', hard: '–/3', pdc: 24, rx: 'Res (+2)', slot: 'neural', d: '1/day free action: +4 Str, +4 Con, +2 morale on Will saves, −2 Defense for 3 + (new Con mod) rounds; no patience/concentration abilities while raging; fatigued after (as a Barbarian-style rage).' },
  { n: 'Skill Plexus', ts: 7, type: 'Internal', hard: '–/4', pdc: 25, rx: '—', slot: 'neural', d: 'Brain unit letting up to FOUR skill implants count together as a single attachment (their PDCs not included). If the plexus is destroyed, the attached skill implants are destroyed too.' },
  { n: 'Targeting Optics', ts: 7, type: 'Internal', hard: '–/2 (per eye)', pdc: 17, rx: 'Mil (+3)', slot: 'eyes', d: 'All eyes replaced; projected targeting reticle: +1 bonus on all RANGED attack rolls.' },
  { n: 'Feat Plexus', ts: 8, type: 'Internal', hard: '–/4', pdc: 25, rx: 'Mil (+3)', slot: 'neural', d: 'Brain unit letting up to FOUR feat implants count together as a single attachment (their PDCs not included). If the plexus is destroyed, the attached feat implants are destroyed too.' },
  { n: 'Invisiware', ts: 8, type: 'External', hard: '4/20', pdc: 35, rx: 'Mil (+3)', slot: 'skin', d: 'Crystalline skin refractors: turn invisible (free action) — +40 Hide immobile / +20 moving; pinpointing you is Spot DC 40/20; 50% concealment even when pinpointed. 10 rounds of use, then 1 hour of solar recharge.' },
  { n: 'Psi Implant', ts: 8, type: 'Internal', hard: '–/2', pdc: 31, rx: 'Mil (+3)', slot: 'neural', d: 'Stimulates latent psionic regions of the brain: you gain the Wild Talent feat.' },
];
