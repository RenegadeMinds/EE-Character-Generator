// =============================================================================
// js/app/58-power-armor.js
// POWER ARMOR
// =============================================================================
//
// WHAT'S IN HERE
//   Power armor and Second Skin: loadouts, systems, slot damage.
//
// KEY NAMES (so you can search for them)
//   tables/objects: MECHA_SIZE_STATS, POWER_ARMOR_DB, MECHA_SYSTEMS,
//   SECOND_SKIN_TABLE, SECOND_SKIN_MENUS, PA_SLOT_STATES
//   functions (15): equippedPowerArmor, paLoadout, paActiveSystems,
//   paShieldBonus, secondSkinMaxHP, activeSecondSkin,
//   buildPowerArmorSkillBonuses, paCycleSlotState, paAddLoadoutLine,
//   paRemoveLoadoutLine, renderPowerArmorCards, setSecondSkinLevel,
//   toggleSecondSkin, ssIncomingHit, renderSecondSkinCard
//
// LOAD ORDER
//   File 58 of 68. index.html loads it after
//   js/app/57-armor-and-vehicle-integrity.js and before js/app/59-mecha.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 48443-48929 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 48443-48929; unchanged below this line ----
// ============================================================================
// v8.14.x SEGMENT B — POWER ARMOR & SECOND SKIN (Adam's rulings, 2026-09-02).
// FF Ch.III pp.577+: "A power armor is a mecha the same size as its pilot."
// Worn as armor (armor slot, capacity 1 — body-armor exclusivity comes free),
// but carrying MECHA stats: superstructure hardness + size-table HP override
// the body-armor conversion; Str (Min) is a FLOOR and Dex (Max) a CEILING on
// the wearer's attributes (firm-wired via effAttrs — flows everywhere);
// equipment slots minus the Pilot's Cockpit hold mecha systems, tracked with
// the crit-table damaged/destroyed states. Weapons catalog lands in Segment C
// — unit weapons appear as named loadout lines. Second Skin (HH p.241): the
// ectoplasmic power-armor analogue, self-contained table + menus; manifesting
// counts as the character's Astral Construct manifestation (cast it on the
// Powers tab for the PP), locks psionic focus, and forbids worn armor.
const MECHA_SIZE_STATS = {   // FF p.577 Table: Mecha Base Statistics by Size
  Medium:     { str: 14, dex: 10, slots: 5,  paSlots: 4,  hp: 50,  speed: 20, slam: '1d6', sizeMod: 0,  baseDC: 36 },
  Large:      { str: 18, dex: 10, slots: 7,  paSlots: 6,  hp: 100, speed: 30, slam: '1d8', sizeMod: -1, baseDC: 40 },
  Huge:       { str: 26, dex: 10, slots: 11, paSlots: 9,  hp: 200, speed: 40, slam: '2d6', sizeMod: -2, baseDC: 44 },
  Gargantuan: { str: 34, dex: 8,  slots: 17, paSlots: 13, hp: 400, speed: 50, slam: '2d8', sizeMod: -4, baseDC: 48 },
  Colossal:   { str: 42, dex: 6,  slots: 25, paSlots: 17, hp: 800, speed: 60, slam: '4d6', sizeMod: -8, baseDC: 56 },
};
// The PA units. Keys match their ARMOR_CATALOG entries (worn-armor door);
// strMin = attribute floor, dexMax = attribute ceiling (FF p.618: "whichever
// is greater"/"whichever is lower"); equipStrMod = the Land Warrior's older
// HH idiom (+N EQUIPMENT bonus to Str, like the RKCM's Dex). pilotSize is
// advisory (a Large PA fits a Large humanoid — FF Taurus note).
const POWER_ARMOR_DB = {
  'Land Warrior Power Armor': { size: 'Medium', ts: 6, hp: 50, superstructure: 'Composite', hardness: 10,
    equipStrMod: 2, strMin: null, dexMax: null, pilotSize: 'Medium', book: 'HH',
    slam: null, printedTAC: null, fly: null,
    note: 'HH-era power armor: +2 EQUIPMENT bonus to Strength (not a floor), Hardness 10 / 50 HP, integrated comm & sensor gear.',
    defaultLoadout: [
      { slot: 'Torso', gear: "Pilot's Cockpit", fixed: true },
      { slot: '(no slot)', gear: 'Comm & sensor gear' },
    ] },
  'Implacable Power Infantry Armor': { size: 'Medium', ts: 6, hp: 50, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Resilium', strMin: 18, dexMax: 14, pilotSize: 'Medium', book: 'FF', page: 619,
    slam: '1d6 + Str mod', printedTAC: '10/21', fly: '100 ft. (clumsy — Jetpack)',
    note: 'The "Imp" — common power infantry. All Imps keep the shield (it\'s what makes them "implacable").',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class II Sensor System' },
      { slot: 'Left Arm/Hand', gear: 'Bastion Tactical Shield' },
      { slot: 'Right Arm/Hand', gear: 'Space Skin' },
      { slot: 'Torso', gear: "Pilot's Cockpit", fixed: true },
      { slot: 'Boots', gear: 'Jetpack' },
      { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Dexterity Upgrade (+4)' },
    ] },
  'Myrmidon Infantry Support Armor': { size: 'Large', ts: 6, hp: 100, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Duralloy', strMin: 18, dexMax: 10, pilotSize: 'Large', book: 'FF', page: 620,
    slam: '1d8 + Str mod (−1 size to hit)', printedTAC: '9/17', fly: '100 ft. (clumsy — Jetpack)',
    note: 'Dual-registered Mecha / Power Armor — as a power armor it fits a LARGE humanoid (as a mecha, a Medium pilot rides the 2-slot cockpit).',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class II Sensor System' },
      { slot: 'Back', gear: "Pilot's Cockpit (1 of 2)", fixed: true },
      { slot: 'Left Arm', gear: 'M-9 Barrage Chaingun' },
      { slot: 'Right Arm', gear: 'PS-15 Panther Claws' },
      { slot: 'Shoulders', gear: '6 50-round ammo belts (Barrage Chaingun)' },
      { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Boots', gear: 'Jetpack' },
      { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Life Support System' },
    ] },
  'Aries Reconnaissance Scout Armor': { size: 'Medium', ts: 7, hp: 50, superstructure: 'Vanadium', hardness: 20,
    armorType: 'Steelskin', strMin: 14, dexMax: 20, pilotSize: 'Medium', book: 'FF', page: 623,
    slam: '1d6 + Str mod', printedTAC: '10/15', fly: null,
    note: 'Mercanacorp Zodiac line — armored reconnaissance; sneaks despite being a power armor.',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Space Skin' },
      { slot: 'Left Arm/Hand', gear: 'Class V Sensor System' },
      { slot: 'Right Arm/Hand', gear: 'Enigma Sensor Suite' },
      { slot: 'Torso', gear: "Pilot's Cockpit", fixed: true },
      { slot: 'Boots', gear: 'Stealth Suite' },
      { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Dexterity Upgrade (+10)' },
    ] },
  'Taurus Mechanized Infantry Armor': { size: 'Large', ts: 6, hp: 100, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Resilium', strMin: 22, dexMax: 14, pilotSize: 'Large', book: 'FF', page: 624,
    slam: '1d8 + 6 (−1 size to hit)', printedTAC: '9/19', fly: null,
    note: 'Dual-registered Mecha / Power Armor — as a power armor it fits a LARGE humanoid. Mercenary favorite; several variants on the market.',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class III Sensor System' },
      { slot: 'Back', gear: "Pilot's Cockpit (1 of 2)", fixed: true },
      { slot: 'Left Arm', gear: 'LK8 Armor-Piercing Pike' },
      { slot: 'Right Arm', gear: 'M-21 Comet Autolaser (1 of 2)' },
      { slot: 'Shoulders', gear: 'M-21 Comet Autolaser (2 of 2)' },
      { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Boots', gear: 'Space Skin' },
      { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Dexterity Upgrade (+4)' },
      { slot: '(no slot)', gear: 'Strength Upgrade (+4)' },
    ] },
};
// Curated non-weapon mecha systems (Adam's Segment B scope; weapons = Segment
// C). `wired` effects apply live while the system is present and undamaged;
// everything else is table-adjudicated via the effect text.
const MECHA_SYSTEMS = [
  // — flight (FF pp.587-589) —
  { name: 'Afterburner System', ts: 6, cat: 'flight', slots: '1 (torso/back/belt/boots)', dc: '10 + ¼ base mecha', effect: 'Doubles fly speed for 1 round (free action). One-shot at TS 6; 1/hour at TS 7; 1/minute at TS 8.' },
  { name: 'Jetpack', ts: 6, cat: 'flight', slots: '1 (back/boots) or 2 (both legs)', dc: '10 + ¼ base mecha', effect: 'Fly 100 ft. (clumsy). Fuel for 1,000 ft. total; refuel DC 16.', wired: { fly: '100 ft. (clumsy)' } },
  { name: 'Jet-Assist Wings', ts: 7, cat: 'flight', slots: '1 (2 if Garg+; back/shoulders)', dc: '5 + ¼ base mecha', effect: 'Improves flight maneuverability one category (twice at TS 8, taken twice). Does not itself grant flight.' },
  { name: 'Thrusters', ts: 7, cat: 'flight', slots: '1 (back/legs/boots)', dc: '10 + ½ base mecha', effect: 'Fly 300 ft. (poor); 600 ft. (average) at TS 8.', wired: { fly: '300 ft. (poor)' } },
  { name: 'Ramjet Thruster Boots', ts: 8, cat: 'flight', slots: '1 (boots)', dc: '10 + ¼ base mecha', effect: 'Ramjet-assisted flight (FF p.589).' },
  { name: 'VVINGS Flight System', ts: 8, cat: 'flight', slots: '2 (3 if Garg+)', dc: '15 + ½ base mecha', effect: 'Vectored-thrust flight system (FF p.589). Military (+3).' },
  // — sensors (FF pp.589-593) —
  { name: 'Class I Sensor System', ts: 6, cat: 'sensor', slots: '1', dc: '18', effect: 'Passive scan 1 mi; active scan (Computer Use DC 15): size, locomotion, trajectory. Computer Use in lieu of Navigate in range.', wired: { navSpot: 1 } },
  { name: 'Class II Sensor System', ts: 6, cat: 'sensor', slots: '1', dc: '21', effect: 'Class I + EM/IR/hi-res video: adds crew count, hull/armor composition, weapon systems to active scans.', wired: { navSpot: 2 } },
  { name: 'Class III Sensor System', ts: 6, cat: 'sensor', slots: '1', dc: '25', effect: 'Class II + night vision: operator gains darkvision 90 ft.', wired: { navSpot: 3, darkvision: 90 } },
  { name: 'Enigma Sensor Suite', ts: 6, cat: 'sensor', slots: '1', dc: '29', effect: 'See through solid objects (150-ft cone): total concealment 50%→20%; 20% concealment nullified.' },
  { name: 'Oracle Targeting System', ts: 6, cat: 'sensor', slots: '1 (helmet/visor)', dc: '18–26 by Mark', effect: '+1..+5 enhancement on attacks with ONE selected ranged weapon (move action to switch). Mark ≤ hosted Sensor Class.' },
  { name: 'Class IV Sensor System', ts: 7, cat: 'sensor', slots: '1', dc: '27', effect: 'Class III + ladar, darkvision 120 ft., 10-mi range; scans read damage taken.', wired: { navSpot: 4, darkvision: 120 } },
  { name: 'Class V Sensor System', ts: 7, cat: 'sensor', slots: '1', dc: '30', effect: 'Multiband radar, darkvision 180 ft., 10-mi range; scans read defense & sensor systems too.', wired: { navSpot: 5, darkvision: 180 } },
  { name: 'Class VI Sensor System', ts: 8, cat: 'sensor', slots: '1', dc: '32', effect: 'Multiphase radar penetrating nearly any barrier, 100-mi range; scans read HP remaining.', wired: { navSpot: 6, darkvision: 180 } },
  { name: 'Vitruvian Sphere', ts: 8, cat: 'sensor', slots: '1-2 (torso)', dc: '20 + ¼ base mecha', effect: 'Full-motion pilot mimicry (mecha 3+ sizes larger only — not power armor): pilot Dex governs (cap 30, −2/size over Medium), includes Crackerjack Neural Link.' },
  // — defense (FF pp.593-599) —
  { name: 'Bulwark Tactical Shield', ts: 5, cat: 'defense', slots: '1 (arm)', dc: '5 + ¼ base mecha', effect: '+2 shield AC; shield hardness/HP by armor substance (FF p.594 table).', wired: { shieldAC: 2 } },
  { name: 'Bastion Tactical Shield', ts: 6, cat: 'defense', slots: '1 (arm)', dc: '10 + ¼ base mecha', effect: '+4 shield AC; retracts into the arm (move action). Hardness/HP by armor substance.', wired: { shieldAC: 4 } },
  { name: 'Barricade Tactical Shield', ts: 7, cat: 'defense', slots: '1 (arm)', dc: '15 + ¼ base mecha', effect: '+6 shield AC; ceramic coating grants fire resistance 10; retractable.', wired: { shieldAC: 6 } },
  { name: 'LX-10 Antishock Array', ts: 6, cat: 'defense', slots: '1', dc: '15 + ¼ base mecha', effect: 'Electricity resistance 10.' },
  { name: 'LX-20 Antishock Array', ts: 7, cat: 'defense', slots: '1', dc: '20 + ¼ base mecha', effect: 'Improved grounding — electricity resistance 20.' },
  { name: 'R-XI Anti-Missile Targeting System', ts: 6, cat: 'defense', slots: '1 (+ Sensor System)', dc: '29', effect: 'Shoots down 1 incoming missile/round with an assigned autofire weapon (missile Reflex DC 15 + Sensor Class).' },
  { name: 'Sandstorm ECM Module', ts: 6, cat: 'defense', slots: '1 (+ Sensor System)', dc: '27', effect: '20% miss chance vs missiles; scrambles 1 missile/round per Sensor Class.' },
  { name: 'Deflection Field', ts: 7, cat: 'defense', slots: '1', dc: 'by Mark', effect: '+1..+5 deflection AC (Mark I–V); toggle 1/round as a free action.' },
  { name: 'Delphi Defense Suite', ts: 7, cat: 'defense', slots: '1-2', dc: 'by Mark', effect: '+1..+5 resistance on all saves for 1 minute (attack action).' },
  { name: 'Force Field Generator', ts: 7, cat: 'defense', slots: '4 (Garg+ only)', dc: 'see FF p.597', effect: 'Ablative energy field absorbs damage until overloaded; 6-hr partial / 24-hr full recharge.' },
  { name: 'Light Fortification', ts: 7, cat: 'defense', slots: '1 (equivalent)', dc: '10 + ½ base mecha', effect: '25% of critical hits become normal hits.' },
  { name: 'Medium Fortification', ts: 8, cat: 'defense', slots: '2 (equivalent)', dc: '10 + ½ base mecha', effect: '75% of critical hits become normal hits.' },
  { name: 'Heavy Fortification', ts: 9, cat: 'defense', slots: '3 (equivalent)', dc: '10 + ½ base mecha', effect: 'ALL critical hits become normal hits.' },
  { name: 'Cloaking Screen', ts: 8, cat: 'defense', slots: '1', dc: '20 + ½ base mecha', effect: 'Total concealment; +40 Hide immobile / +20 moving; Spot/Computer Use DC 40/20 to pinpoint.' },
  // — misc (FF pp.599, 611-614) —
  { name: 'Space Skin', ts: 6, cat: 'misc', slots: '1 (equivalent)', dc: '10 + ¼ base mecha', effect: 'Operate in vacuum; 120-hr air; radiation immunity (external sources).' },
  { name: 'Stealth Suite', ts: 6, cat: 'misc', slots: '1', dc: '10 + ½ base mecha', effect: '+10 on Hide and Move Silently checks.', wired: { hideMs: 10 } },
  { name: 'Advanced Diagnostics', ts: 7, cat: 'misc', slots: '1', dc: '15 + ¼ base mecha', effect: 'Self-repairs 1d10 HP/hour while stationary (bonus HP only, not operator damage).' },
  { name: 'Zero-G Stabilizer', ts: 7, cat: 'misc', slots: '1', dc: 'see FF p.614', effect: 'Negates the −4 zero-G penalty on attacks and skill checks (or take the Zero-G Training feat).' },
  { name: 'G/BUS AI Copilot', ts: 7, cat: 'misc', slots: '0', dc: '20 + ½ base mecha', effect: 'AI co-pilot/gunner (Int/Wis/Cha 10 base, upgradable +2 steps): aids checks, fires integrated weapons, assumes control if the pilot drops. Effectively a cohort.' },
  { name: 'Structural Enhancement', ts: 7, cat: 'misc', slots: '1 (equivalent)', dc: '15 + ½ base mecha', effect: '+50 bonus HP (+25 for Medium); repeatable Huge+ up to 2× base HP; costs one slot each.' },
  { name: 'Comm System', ts: 5, cat: 'misc', slots: '0', dc: '—', effect: '100-mile multi-frequency radio, 10 simultaneous conversations.' },
  { name: 'Life Support System', ts: 5, cat: 'misc', slots: '0 (assumed)', dc: '—', effect: 'Closed environment: ignore inhaled poisons & immersion; 24-hr air.' },
  { name: 'Strength Upgrade (+2)', ts: 6, cat: 'upgrade', slots: '0', dc: '15 + ½ base + Str mod', effect: '+2 mecha Strength (stacks; max +10 over base). Refit: 8 hrs (×2/size over Medium), Craft mech + structural DC 25.' },
  { name: 'Dexterity Upgrade (+2)', ts: 6, cat: 'upgrade', slots: '0', dc: '15 + ½ base + Dex mod', effect: '+2 mecha Dexterity (stacks; max +10 over base). Same refit procedure.' },
  // — Segment C additions (FF pp.610-614 misc table) —
  { name: 'Cockpit, Copilot', ts: 5, cat: 'misc', slots: '3 (torso/back)', dc: '20', effect: 'Copilot station: fires ranged weapons, runs active scans, aids the pilot (aid another). Operator can lock it out (move action); seizing control = Computer Use DC 25/35.' },
  { name: 'Cockpit, Passenger', ts: 5, cat: 'misc', slots: '2 (torso/back)', dc: '20', effect: 'A comfortable seat — the passenger observes only.' },
  { name: 'HV-5 Haven Escape Pod', ts: 6, cat: 'misc', slots: '1 (torso)', dc: '15 + ¼ base mecha', effect: 'Armored ejection pod for the crew — the last resort.' },
  { name: 'Crackerjack Neural Link', ts: 8, cat: 'misc', slots: '1 (helmet/cranium)', dc: '15 + ¼ base mecha', effect: '+2 Initiative for the pilot, who may use all non-mecha combat feats through the link. Restricted (+2).' },
  { name: 'Nanorepair Unit', ts: 8, cat: 'misc', slots: '1', dc: '20 + ½ base mecha', effect: 'Nanite swarm repair — the TS 8 successor to Advanced Diagnostics (FF p.614). Restricted (+2).' },
  { name: 'Quadruped frame', ts: 6, cat: 'misc', slots: '3 (hands/boots)', dc: '(structural option)', effect: 'Four-legged configuration (Manticore/Cancer pattern): trades the hand/boot slots for stability and speed — see the unit entries.' },
  { name: 'Manipulators ×2', ts: 7, cat: 'misc', slots: '0', dc: 'see Robots (Advanced Hands)', effect: 'Fine-manipulation arms, equivalent to a Robot’s Advanced Hands.' },
];
// SECOND SKIN (HH pp.241-242) — feat-gated (Concentration 5 + Astral
// Construct). The manifestation IS the character's Astral Construct.
const SECOND_SKIN_TABLE = [
  { lvl: 1, pp: 1,  ac: 5,  hardness: 5,  hp: 25,  size: 'S', picks: 1, menu: 'A', dr: null,        str: 15, slam: '1d4+2' },
  { lvl: 2, pp: 3,  ac: 6,  hardness: 6,  hp: 30,  size: 'M', picks: 1, menu: 'A', dr: null,        str: 17, slam: '1d6+3' },
  { lvl: 3, pp: 5,  ac: 8,  hardness: 8,  hp: 40,  size: 'M', picks: 1, menu: 'A', dr: null,        str: 21, slam: '1d6+5' },
  { lvl: 4, pp: 7,  ac: 10, hardness: 10, hp: 50,  size: 'M', picks: 1, menu: 'B', dr: null,        str: 25, slam: '1d6+7' },
  { lvl: 5, pp: 9,  ac: 12, hardness: 10, hp: 60,  size: 'L', picks: 1, menu: 'B', dr: '5/magic',   str: 29, slam: '1d8+9' },
  { lvl: 6, pp: 11, ac: 15, hardness: 15, hp: 75,  size: 'L', picks: 1, menu: 'B', dr: '10/magic',  str: 33, slam: '1d8+11', scale5: true },
  { lvl: 7, pp: 13, ac: 16, hardness: 15, hp: 80,  size: 'L', picks: 1, menu: 'C', dr: '10/magic',  str: 35, slam: '1d8+12', scale5: true },
  { lvl: 8, pp: 15, ac: 18, hardness: 15, hp: 90,  size: 'L', picks: 1, menu: 'C', dr: '15/magic',  str: 39, slam: '1d8+14', scale5: true },
  { lvl: 9, pp: 17, ac: 20, hardness: 20, hp: 100, size: 'H', picks: 2, menu: 'C', dr: '15/magic',  str: 43, slam: '2d6+16', scale5: true },
];
const SECOND_SKIN_MENUS = {
  A: [['Buff', '+5 hit points'], ['Celerity', '+10′ land speed'], ['Fins', 'swim speed 30′'], ['Lasting Skin', 'duration 1 min./level (was 1 rd./level)'], ['Wings', 'fly 20′ (average)'], ['Resistance', 'energy resist 5 vs one of fire/cold/acid/electricity'], ['Tail', 'Improved Trip']],
  B: [['Fast Healing', 'skin has Fast Healing 2'], ['Four Eyes', 'darkvision / low-light vision'], ['Improved Buff', '+15 hit points'], ['Improved Wings', 'fly 40′ (average)'], ['Long-Lasting Skin', 'duration 10 min./level'], ['Tentacles', 'Improved Grab'], ['Versatile', 'take 2 selections from Menu A instead']],
  C: [['Crushing Tentacles', 'Constrict (Improved Grab + Slam damage)'], ['Extra Buff', '+30 hit points'], ['Juggernaut', 'Trample (as Mecha Trample)'], ['Psychic Membrane', 'blindsight'], ['Rending Claws', 'Rend +2d6 + 1.5× Str when both claws hit'], ['Second Skin', 'duration 1 hour/level'], ['Versatile', 'take 2 selections from Menu B instead']],
};
function equippedPowerArmor(c) {
  for (const it of getCharItems(c)) {
    if (it.catalogue === 'armor' && it.equipped && POWER_ARMOR_DB[it.ref]) return it;
  }
  return null;
}
function paLoadout(it) {
  // v8.17.0 Segment C: the loadout machinery serves power armor AND mecha —
  // the default comes from whichever definition the item resolves to.
  const src = POWER_ARMOR_DB[it.ref]
    || (it.catalogue === 'mecha' && typeof mechaDefOf === 'function' ? mechaDefOf(it) : null);
  if (!src || !src.defaultLoadout) return it.paLoadout || [];
  if (!it.paLoadout) it.paLoadout = src.defaultLoadout.map(l => ({ slot: l.slot, gear: l.gear, fixed: !!l.fixed, state: 'ok' }));
  return it.paLoadout;
}
// Live systems: present in the loadout, state ok, matched to MECHA_SYSTEMS
// by name prefix (loadout lines like "Class II Sensor System" or
// "Dexterity Upgrade (+4)").
function paActiveSystems(it) {
  const out = [];
  for (const line of paLoadout(it)) {
    if (line.state !== 'ok') continue;
    const sys = MECHA_SYSTEMS.find(s => line.gear.startsWith(s.name.replace(/ \(\+2\)$/, '')));
    if (sys && sys.wired) out.push({ line, sys });
  }
  return out;
}
function paShieldBonus(it) {
  let best = 0;
  for (const { sys } of paActiveSystems(it)) if (sys.wired.shieldAC) best = Math.max(best, sys.wired.shieldAC);
  return best;
}
function secondSkinMaxHP(row, abilities) {
  let hp = row.hp;
  for (const a of (abilities || [])) {
    if (a === 'Buff') hp += 5; else if (a === 'Improved Buff') hp += 15; else if (a === 'Extra Buff') hp += 30;
  }
  return hp;
}
function activeSecondSkin(c) {
  if (!c || !c.secondSkin || !c.secondSkin.active) return null;
  const row = SECOND_SKIN_TABLE.find(r => r.lvl === c.secondSkin.level);
  if (!row) return null;
  const maxHP = secondSkinMaxHP(row, c.secondSkin.abilities);
  const damage = c.secondSkin.damage || 0;
  return { row, state: c.secondSkin, maxHP, hp: maxHP - damage, destroyed: damage >= maxHP };
}
// Sensor Navigate/Spot equipment bonuses + Stealth Suite Hide/MS, live while
// the power armor is equipped and the system undamaged.
function buildPowerArmorSkillBonuses(c) {
  const out = {};
  const it = (typeof equippedPowerArmor === 'function') ? equippedPowerArmor(c) : null;
  if (!it) return out;
  const push = (skill, value, label) => (out['skill:' + skill] = out['skill:' + skill] || []).push(
    { type: 'equipment', source: 'pa:' + it.id + ':' + label, value, label });
  for (const { line, sys } of paActiveSystems(it)) {
    if (sys.wired.navSpot) { push('Navigate', sys.wired.navSpot, line.gear); push('Spot', sys.wired.navSpot, line.gear); }
    if (sys.wired.hideMs) { push('Hide', sys.wired.hideMs, line.gear); push('Move Silently', sys.wired.hideMs, line.gear); }
  }
  return out;
}
const PA_SLOT_STATES = ['ok', 'damaged', 'destroyed'];
function paCycleSlotState(itemId, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const lines = paLoadout(it); const line = lines[idx]; if (!line) return;
  line.state = PA_SLOT_STATES[(PA_SLOT_STATES.indexOf(line.state || 'ok') + 1) % 3];
  logAct(`${enchantDisplayName(it)} — ${line.slot}: ${line.gear} marked ${line.state.toUpperCase()}${line.state === 'damaged' ? ' (repair: 1 hr, Repair DC 20; slot itself DC 25)' : line.state === 'destroyed' ? ' (replace only; destroyed slot: 12 hrs + Craft mechanical DC 30)' : ''}.`);
  save(); renderVehicles(); renderSheet(); if (typeof renderSkills === 'function') renderSkills();
}
async function paAddLoadoutLine(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  // v8.17.0 Segment C: the weapons catalog joins the systems picker.
  // v8.18.0 Segment D: starship items draw from the starship catalogs.
  const names = (it.catalogue === 'starship'
    ? [].concat(
        STARSHIP_WEAPONS.map(w => `${w.name} (TS ${w.ts} · weapon)`),
        STARSHIP_DEFENSES.map(d => `${d.name} (TS ${d.ts} · defense)`),
        STARSHIP_SENSORS.map(d => `${d.name} (TS ${d.ts} · sensor)`),
        STARSHIP_COMMS.map(d => `${d.name} (TS ${d.ts} · comms)`))
    : MECHA_SYSTEMS.map(s => `${s.name} (TS ${s.ts} · ${s.cat})`)
        .concat((typeof MECHA_WEAPONS !== 'undefined' ? MECHA_WEAPONS : []).map(w => `${w.name} (TS ${w.ts} · weapon)`)))
    .concat(['✎ Custom line (free text)']);
  openChoiceModal('Install a system or weapon (slot requirements & purchase DCs in each tooltip after install)', names, async (pick) => {
    let gear = pick ? pick.replace(/\s*\(TS \d+ · \w+\)$/, '') : null;
    if (!gear) return;
    if (gear.startsWith('✎')) {
      gear = await textModal('✎ Custom loadout line', 'Name the equipment (e.g. "M-9 Barrage Chaingun").', '');
      if (!gear) return;
    }
    // v9.8.0 (§258): the mount economy (FF p.640; GMG p.474) — a starship
    // beam/projectile weapon picks its mount at purchase: full turret (the
    // printed DC, any direction, the stock-ship default), cupola (two
    // adjacent arcs, −1 DC) or fixed (one arc, −2 DC). Missiles stay omni
    // (mount option awaits Adam's ruling); mines and grapple systems have none.
    let mountPick = null;
    const wepRow = it.catalogue === 'starship' ? STARSHIP_WEAPONS.find(w => w.name === gear) : null;
    if (wepRow && shipWeaponTakesMount(wepRow.name)) {
      const dcN = wepRow.dc;
      const mk = await new Promise(res => openChoiceModal(`Mount for the ${gear} (FF p.640 — the printed Purchase DC buys a full turret; restricted mounts discount it)`, [
        `Turret / bank — fires any direction${dcN ? ` · printed DC ${dcN}` : ''} (the default; stock FF ships are all-turret, GMG p.474)`,
        `Cupola — two ADJACENT arcs${dcN ? ` · DC ${dcN - 1}` : ''} (−1 DC)`,
        `Fixed mount — one arc${dcN ? ` · DC ${dcN - 2}` : ''} (−2 DC)`,
      ], res));
      if (!mk) return;
      if (mk.startsWith('Cupola')) {
        const pair = await new Promise(res => openChoiceModal('Cupola coverage — two adjacent arcs (Port/Starboard and Fore/Aft are not adjacent pairs, FF p.640)', SHIP_CUPOLA_PAIRS, res));
        if (!pair) return;
        mountPick = { mount: 'cupola', arcs: pair.split('/') };
      } else if (mk.startsWith('Fixed')) {
        const arc = await new Promise(res => openChoiceModal('Fixed mount — which arc does it cover?', SHIP_FIXED_ARCS, res));
        if (!arc) return;
        mountPick = { mount: 'fixed', arcs: [arc] };
      }
    }
    // v9.9.0 (§259): the FIRE-LINK picker (FF pp.641-642) — identical beam/
    // projectile weapons as ONE weapon: each doubling +½ base damage, +1 size
    // category, +3 DC; the grown size must still fit the hull (I16); octo+ =
    // the MAIN CANNON, one per ship. Missiles instead pick a BATTERY (up to 4
    // launchers, +2 DC each, Colossal (Light)+ hulls only).
    let linkPick = null;
    const shipDef = it.catalogue === 'starship' ? shipDefOf(it) : null;
    if (wepRow && shipDef && shipWeaponTakesMount(wepRow.name)) {
      const hasMain = shipHasMainCannon(it);
      const opts = shipLinkOptions(shipDef, wepRow, hasMain);
      if (opts.length > 1) {
        const labels = opts.map(o => o.link === 1
          ? `×1 single weapon — ${o.dice || 'printed damage'} · ${o.size}${wepRow.dc ? ` · printed DC ${wepRow.dc}` : ''}`
          : `×${o.link} ${o.main ? 'MAIN CANNON' : o.link === 2 ? 'dual-linked' : o.link === 4 ? 'quad-linked' : `${o.link}-linked`} — ${o.dice || `damage ×${(2 + o.doublings) / 2}`} · ${o.size}${wepRow.dc ? ` · DC ${o.dc}` : ''} (+${3 * o.doublings} DC)${o.main ? ' · one per ship' : ''}`);
        const lk = await new Promise(res => openChoiceModal(`Fire link for the ${gear} (FF p.641 — each doubling: +½ base damage, +1 size category, +3 DC; the grown weapon must still fit the ${shipDef.cls} hull${hasMain ? '; the ship’s main cannon slot is already taken' : ''})`, labels, res));
        if (!lk) return;
        const chosen = opts[labels.indexOf(lk)];
        if (chosen && chosen.link >= 2) {
          linkPick = { link: chosen.link };
          if (chosen.link >= 4 && !chosen.main) {
            const vr = await new Promise(res => openChoiceModal('Variable fire link? (FF p.642 — quad+ links may be built variable: the gunner fires singly, in pairs, or at the full link, chosen attack to attack)', [
              'Full link only (fires as one weapon every attack)',
              'Variable fire link (singly / pairs / full — gunner’s choice each attack)',
            ], res));
            if (!vr) return;
            if (vr.startsWith('Variable')) linkPick.variable = true;
          }
        }
      }
    }
    if (wepRow && shipDef && /^Missile,/.test(wepRow.name) && shipDef.cls !== 'Ultralight') {
      const bOpts = [1, 2, 3, 4].map(n => n === 1
        ? `Single launcher — ${/crit (\d+(?:-20)?)/.exec(wepRow.stat)?.[1] ? `crit ${/crit (\d+(?:-20)?)/.exec(wepRow.stat)[1]}` : 'printed crit'}${wepRow.dc ? ` · printed DC ${wepRow.dc}` : ''}`
        : `Battery of ${n} launchers — threat ${shipThreatRange(wepRow.stat, Math.min(n - 1, 3))} (+${Math.min(n - 1, 3)}) · crit ×${2 + (n - 1)}${wepRow.dc ? ` · DC ${wepRow.dc + 2} each (${n}×)` : ' · +2 DC each'}`);
      const bk = await new Promise(res => openChoiceModal(`Missile battery for the ${gear}? (FF p.642 — up to 4 identical launchers fire as ONE weapon: +2 DC per launcher, +1 threat per missile past the first [max +3], crit multiplier +1 per extra missile; non-crit hits deal one missile’s damage; never split)`, bOpts, res));
      if (!bk) return;
      const bn = bk.startsWith('Battery of') ? parseInt(bk.replace('Battery of ', ''), 10) : 1;
      if (bn >= 2) linkPick = { battery: bn };
    }
    const slot = await textModal('Which slot?', 'e.g. Helmet, Left Arm, Shoulders, Boots, (no slot). Slot capacity is GM-adjudicated in Segment B.', '');
    paLoadout(it).push(Object.assign({ slot: slot || '(no slot)', gear, state: 'ok' }, mountPick || {}, linkPick || {}));
    const mountNote = wepRow && shipWeaponTakesMount(wepRow.name)
      ? (mountPick ? ` — ${mountPick.mount} ${mountPick.arcs.join('/')} (${SHIP_MOUNT_KINDS[mountPick.mount].disc} DC${wepRow.dc ? ` → DC ${wepRow.dc + SHIP_MOUNT_KINDS[mountPick.mount].disc}` : ''}, FF p.640)` : ` — full turret (any direction${wepRow.dc ? `, printed DC ${wepRow.dc}` : ''}, FF p.640)`)
      : (wepRow && /^Missile,/.test(wepRow.name) ? ' — omni launcher (a missile mount option awaits Adam’s ruling)' : '');
    const linkNote = linkPick && linkPick.link
      ? ` — ${linkPick.link >= 8 ? `★ MAIN CANNON (×${linkPick.link}: +1 threat, 25%/50% power modes, single RoF, one per ship)` : `fire-linked ×${linkPick.link}${linkPick.variable ? ' (variable)' : ''}`}${wepRow.dc ? `, DC ${wepRow.dc + 3 * Math.round(Math.log2(linkPick.link)) + (mountPick ? SHIP_MOUNT_KINDS[mountPick.mount].disc : 0)}` : ''} (FF pp.641-642)`
      : linkPick && linkPick.battery
        ? ` — ⧉ battery of ${linkPick.battery} (threat ${shipThreatRange(wepRow.stat, linkPick.battery - 1)}, crit ×${1 + linkPick.battery}${wepRow.dc ? `, ${linkPick.battery}× DC ${wepRow.dc + 2}` : ''}, FF p.642)`
        : '';
    logAct(`${enchantDisplayName(it)} — installed ${gear}${slot ? ' (' + slot + ')' : ''}${mountNote}${linkNote}.`);
    save(); renderVehicles(); renderSheet(); if (typeof renderSkills === 'function') renderSkills();
  });
}
function paRemoveLoadoutLine(itemId, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const lines = paLoadout(it); const line = lines[idx];
  if (!line || line.fixed) return;
  lines.splice(idx, 1);
  logAct(`${enchantDisplayName(it)} — removed ${line.gear}.`);
  save(); renderVehicles(); renderSheet(); if (typeof renderSkills === 'function') renderSkills();
}
function renderPowerArmorCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'armor' && POWER_ARMOR_DB[i.ref]);
  if (!items.length) return '';
  return items.map(it => {
    const pa = POWER_ARMOR_DB[it.ref];
    const g = armorItemIntegrity(it);
    const name = enchantDisplayName(it);
    const sz = MECHA_SIZE_STATS[pa.size] || {};
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? '#555' : g.broken ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
    const critTip = 'Mecha Critical Hits (FF p.616) — crits confirm vs FULL AC (touch + ½ hardness + proficient pilot\'s Defense Bonus + shield). d20: 1-3 dmg+crew dazed · 4-7 dmg+equipment damaged · 8-9 crit+crew dazed · 10 equipment destroyed · 11-12 crit+prone · 13 CREW HIT (bypasses to pilot, hardness only) · 14-16 crit+slot damaged · 17-18 crit+slot destroyed · 19-20 severe (×5) — mark results on the loadout below.';
    const statBits = [
      pa.strMin ? `<b>Str (Min) ${pa.strMin}</b> — your Str floors here while suited` : `<b>+${pa.equipStrMod} equipment Str</b>`,
      pa.dexMax ? `<b>Dex (Max) ${pa.dexMax}</b> — your Dex caps here` : 'no Dex cap',
      `Hardness <b>${g.hardness}</b> (${escapeHTML(g.substance)})`, `HP ${g.hp}/${g.maxHP}`,
      `speed: as wearer${pa.fly ? ` · fly ${escapeHTML(pa.fly)}` : ''}`,
      pa.slam ? `slam ${escapeHTML(pa.slam)}` : null,
      pa.printedTAC ? `book T/AC ${pa.printedTAC} (your Sheet derives the live value)` : null,
      `pilot size: ${pa.pilotSize}`,
    ].filter(Boolean).join(' · ');
    const loadout = paLoadout(it).map((l, idx) => {
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? '#999' : l.state === 'damaged' ? 'var(--red-text)' : '#6dba88';
      const sys = MECHA_SYSTEMS.find(s => l.gear.startsWith(s.name.replace(/ \(\+2\)$/, '')));
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (1 hr, Repair DC 20; slot DC 25) → destroyed (replace only) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span style="color:var(--g55);min-width:88px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:#78afcd;' : ''}" ${sys ? `title="${escapeHTML(sys.effect + ' (Slots: ' + sys.slots + ' · DC ' + sys.dc + ')')}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}</span>
        ${l.fixed ? '' : `<button class="btn btn-sm" style="font-size:9px;padding:0 4px;" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="panel" style="margin-bottom:.8rem;border-color:rgba(120,175,205,.35);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;color:var(--gold);">${it.equipped ? '🤖 ' : ''}${escapeHTML(name)} <span style="font-size:10px;color:var(--g50);">${pa.size} TS ${pa.ts} Power Armor · ${escapeHTML(pa.book || 'FF')}</span></div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;${it.equipped ? 'border-color:rgba(120,175,205,.6);color:#78afcd;' : ''}" onclick="toggleItemEquipped('${it.id}');renderVehicles();" title="Worn as armor — the armor slot enforces exclusivity with body armor">${it.equipped ? '🤖 Doff' : '🤖 Don'}</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="armorIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="armorRepair('${it.id}')">🔧 Repair</button>
        </div>
      </div>
      ${pa.note ? `<div style="font-size:10px;color:var(--g50);margin-top:3px;">${escapeHTML(pa.note)}</div>` : ''}
      <div style="font-size:11px;color:var(--parch);margin-top:5px;">${statBits}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:11.5px;">
        <span style="cursor:help;" title="${escapeHTML(g.hardParts.join(' + ') + ' · HP: ' + g.hpParts.join(' + ') + '\nAlways intercedes (power armor): every hit applies hardness; full AC confirms crits only.')}">Frame HP <b style="color:${barColor};">${g.hp}</b>/${g.maxHP}</span>
        <div class="bar-wrap" style="flex:1;height:6px;"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
        <span style="cursor:help;color:#d4b870;font-size:10px;" title="${escapeHTML(critTip)}">🎲 crit table ⓘ</span>
      </div>
      ${g.destroyed ? '<div style="color:#999;font-size:10.5px;margin-top:3px;">☠ DESTROYED — beyond repair (salvage); mecha upgrades lost (HH p.383).</div>' : g.broken ? '<div style="color:var(--red-text);font-size:10.5px;margin-top:3px;">⚑ BROKEN — 0 HP: no AC bonus, and power armor at 0 HP loses access to its mecha upgrades (HH p.383) — loadout systems inoperable until repaired.</div>' : ''}
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--g55);margin-top:7px;">Equipment Slots (${sz.paSlots ?? '?'} usable of ${sz.slots ?? '?'} — Pilot's Cockpit takes the rest) <button class="btn btn-sm" style="font-size:9px;padding:0 5px;margin-left:6px;" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
    </div>`;
  }).join('');
}
async function setSecondSkinLevel(lvl) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const row = SECOND_SKIN_TABLE.find(r => r.lvl === lvl); if (!row) return;
  if (!c.secondSkin) c.secondSkin = {};
  c.secondSkin.level = lvl; c.secondSkin.abilities = []; c.secondSkin.damage = 0;
  // Menu picks: `picks` selections from the level's menu; Versatile expands
  // downward (B pick → 2×A; C pick → 2×B).
  const pickFrom = async (menu, count, chosen) => {
    for (let i = 0; i < count; i++) {
      const opts = SECOND_SKIN_MENUS[menu].map(([n, e]) => `${n} — ${e}`);
      const sel = await new Promise(res => openChoiceModal(`Second Skin lvl ${lvl} — Menu ${menu} pick ${i + 1}/${count}`, opts, res));
      if (!sel) return false;
      const nm = sel.split(' — ')[0];
      if (nm === 'Versatile') {
        const sub = menu === 'C' ? 'B' : 'A';
        if (!(await pickFrom(sub, 2, chosen))) return false;
      } else chosen.push(nm);
    }
    return true;
  };
  const chosen = [];
  if (!(await pickFrom(row.menu, row.picks, chosen))) return;
  c.secondSkin.abilities = chosen;
  save(); renderVehicles();
  toast(`Second Skin configured: level ${lvl} (${row.pp} PP) — ${chosen.join(', ') || 'no abilities'}.`);
}
function toggleSecondSkin() {
  const c = chars.find(x => x.id === curId); if (!c || !c.secondSkin || !c.secondSkin.level) { toast('Configure a Second Skin level first.'); return; }
  if (!c.secondSkin.active) {
    if (getCharItems(c).some(i => i.catalogue === 'armor' && i.equipped && getCatalogueEntry('armor', i.ref) && getCatalogueEntry('armor', i.ref).type !== 'shield')) {
      toast('Second Skin cannot be manifested while wearing armor (HH p.241) — doff it first.'); return;
    }
    const row = SECOND_SKIN_TABLE.find(r => r.lvl === c.secondSkin.level);
    c.secondSkin.active = true; c.secondSkin.damage = 0;
    logAct(`🧿 Second Skin manifested (lvl ${c.secondSkin.level}: AC +${row.ac}, Hardness ${row.hardness}, ${secondSkinMaxHP(row, c.secondSkin.abilities)} HP${row.dr ? ', DR ' + row.dr : ''}; ${row.pp} PP — counts as your Astral Construct manifestation; psionic focus locked while it lasts).`);
  } else {
    c.secondSkin.active = false; c.secondSkin.damage = 0;
    logAct('Second Skin dismissed (the ectoplasm dissipates; damage does not persist to the next manifestation).');
  }
  save(); renderVehicles(); renderSheet(); if (typeof renderArmorIntegrity === 'function') renderArmorIntegrity(c);
}
function ssIncomingHit() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const sk = activeSecondSkin(c); if (!sk) { toast('No active Second Skin.'); return; }
  openChoiceModal('⚔ Hit on the Second Skin — enter raw damage, optionally followed by hardness ignored', [], (val) => {
    const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
    if (!m) { toast('Enter the damage as a number.'); return; }
    const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
    const net = Math.max(0, dmg - Math.max(0, sk.row.hardness - ign));
    const math = `${dmg} − hardness ${sk.row.hardness}${ign ? ` (−${ign} ignored)` : ''} = ${net}`;
    if (net <= 0) { logAct(`Second Skin absorbs the hit: ${math}.`); save(); toast(`Absorbed — ${math}.`); return; }
    const toSkin = Math.min(net, sk.hp);
    const overflow = net - toSkin;
    c.secondSkin.damage = (c.secondSkin.damage || 0) + toSkin;
    if (overflow > 0 && typeof c.currentHP === 'number') c.currentHP -= overflow;
    const after = activeSecondSkin(c);
    logAct(`⚔ Second Skin hit: ${math}; ${toSkin} to the skin (${Math.max(0, after.hp)}/${after.maxHP})${overflow ? `, ${overflow} carries over to ${c.name} (HH p.242)` : ''}.${after.destroyed ? ' 🧿 The skin is DESTROYED — dismiss and re-manifest for a fresh one.' : ''}`);
    save(); renderVehicles(); renderSheet(); if (typeof renderTracker === 'function') renderTracker();
    toast(after.destroyed ? 'Second Skin destroyed — excess damage carried over.' : `Skin: ${after.hp}/${after.maxHP}${overflow ? ` · ${overflow} to you` : ''}.`);
  });
}
function renderSecondSkinCard(c) {
  if (!hasFeatNamed(c, 'Second Skin') && !(c.secondSkin && c.secondSkin.active)) return '';
  const st = c.secondSkin || {};
  const row = st.level ? SECOND_SKIN_TABLE.find(r => r.lvl === st.level) : null;
  const sk = activeSecondSkin(c);
  const scale = (c.sixLevels && c.sixLevels.psionic) || 0;
  const lvlBtns = SECOND_SKIN_TABLE.map(r => {
    const gated = r.scale5 && scale < 5;
    return `<button class="btn btn-sm" style="font-size:9px;padding:0 5px;${st.level === r.lvl ? 'border-color:var(--gold);color:var(--gold);' : ''}${gated ? 'opacity:.4;' : ''}" title="${gated ? 'Requires a Psionic Scale 5+ scenario (HH p.241 footnote). ' : ''}AC +${r.ac} · Hardness ${r.hardness} · ${r.hp} HP · ${r.size} · Str ${r.str} / slam ${r.slam}${r.dr ? ' · DR ' + r.dr : ''} · ${r.pp} PP · ${r.picks} Menu ${r.menu} pick${r.picks > 1 ? 's' : ''}" onclick="setSecondSkinLevel(${r.lvl})">${r.lvl}</button>`;
  }).join('');
  const pct = sk ? Math.max(0, Math.min(100, Math.round(sk.hp / sk.maxHP * 100))) : 0;
  return `<div class="panel" style="margin-bottom:.8rem;border-color:rgba(196,153,212,.4);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
      <div style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;color:var(--vio);">🧿 Second Skin <span style="font-size:10px;color:var(--g50);">ectoplasmic power armor · HH p.241</span></div>
      <div style="white-space:nowrap;">
        ${sk ? `<button class="btn btn-sm" style="font-size:10px;" onclick="ssIncomingHit()">⚔ Hit</button>` : ''}
        <button class="btn btn-sm" style="font-size:10px;${sk ? 'border-color:rgba(196,153,212,.6);color:var(--vio);' : ''}" onclick="toggleSecondSkin()">${sk ? '🧿 Dismiss' : '🧿 Manifest'}</button>
      </div>
    </div>
    <div style="font-size:10.5px;color:var(--g60);margin-top:4px;">Level (sets menu picks): ${lvlBtns}</div>
    ${row ? `<div style="font-size:11px;color:var(--parch);margin-top:4px;">Configured lvl ${row.lvl}: <b>AC +${row.ac}</b> (as armor — no stacking) · Hardness <b>${row.hardness}</b> · <b>${secondSkinMaxHP(row, st.abilities)}</b> HP · ${row.size} coverage · Str ${row.str} / slam <b>${row.slam}</b> (you count as armed)${row.dr ? ` · DR <b>${row.dr}</b>` : ''} · <b>${row.pp} PP</b><br><span style="color:var(--tv80);">Abilities: ${(st.abilities || []).join(', ') || '—'}</span></div>` : '<div style="font-size:11px;opacity:.6;margin-top:4px;">Pick a level to configure.</div>'}
    ${sk ? `<div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:11.5px;">
      <span>Skin HP <b style="color:${sk.destroyed ? '#999' : '#c499d4'};">${Math.max(0, sk.hp)}</b>/${sk.maxHP}</span>
      <div class="bar-wrap" style="flex:1;height:6px;"><div class="bar-fill" style="width:${pct}%;background:#c499d4;"></div></div>
    </div>
    <div style="font-size:10px;color:var(--g50);margin-top:3px;">Active: every hit strikes the skin first (hardness ${sk.row.hardness}); excess carries over to you. Counts as your Astral Construct manifestation — no separate construct, and your psionic focus stays committed. Cannot wear armor. Duration 1 rd./level unless a Lasting ability was picked.</div>` : ''}
  </div>`;
}

