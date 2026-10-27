// =============================================================================
// js/app/59-mecha.js
// MECHA
// =============================================================================
//
// WHAT'S IN HERE
//   Mecha: superstructures, armor types, weapons, and the mecha builder.
//
// KEY NAMES (so you can search for them)
//   tables/objects: MECHA_SUPERSTRUCTURES, MECHA_ARMOR_TYPES, MECHA_WEAPONS,
//   MECHA_UNITS
//   functions (4): mechaDefOf, mechaTouchAC, openMechaBuilder,
//   renderMechaCards
//
// LOAD ORDER
//   File 59 of 68. index.html loads it after js/app/58-power-armor.js and
//   before js/app/60-starships.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 48930-49246 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 48930-49246; unchanged below this line ----
// ============================================================================
// v8.17.0 SEGMENT C — MECHA (Adam's mecha/starship pass, 2026-09-03).
// FF Ch.III: weapon systems (pp.601-610), sample units (pp.620-626),
// superstructure & armor-type cost tables (pp.630-631). A mecha is a legged
// all-terrain vehicle (Tech Construct): the PILOT's BAB drives attacks, the
// MECHA's Str drives melee damage, the pilot's Dex is capped by the mecha's
// (FF p.618); T/AC bands like a vehicle (crew protected save crit results);
// crit-confirm AC = touch + ½ hardness + proficient pilot's Defense Bonus +
// shield (FF p.616). Custom builds: size frame + superstructure + armor type
// per the cost tables. Stored fields: it.vehicleDamage, it.piloted,
// it.paLoadout (shared loadout machinery), it.custom (builder designs).
const MECHA_SUPERSTRUCTURES = {   // FF p.630 — hardness + frame base DC by size
  'Alumisteel':   { ts: 5, hardness: 10, dc: { Medium: 32, Large: 36, Huge: 40, Gargantuan: 44, Colossal: 52 } },
  'Duralloy':     { ts: 6, hardness: 15, dc: { Medium: 36, Large: 40, Huge: 44, Gargantuan: 48, Colossal: 56 } },
  'Mythralloy':   { ts: 6, hardness: 30, dc: { Medium: 44, Large: 48, Huge: 52, Gargantuan: 56, Colossal: 64 } },
  'Vanadium':     { ts: 6, hardness: 20, dc: { Medium: 40, Large: 44, Huge: 48, Gargantuan: 52, Colossal: 60 } },
  'Adamantium':   { ts: 7, hardness: 40, dc: { Medium: 48, Large: 52, Huge: 56, Gargantuan: 60, Colossal: 68 } },
  'Neovulcanium': { ts: 7, hardness: 20, dc: { Medium: 36, Large: 40, Huge: 44, Gargantuan: 48, Colossal: 56 } },
  'Neutronite':   { ts: 7, hardness: 25, dc: { Medium: 40, Large: 44, Huge: 48, Gargantuan: 52, Colossal: 60 } },
  'Tithralium':   { ts: 7, hardness: 30, dc: { Medium: 44, Large: 48, Huge: 52, Gargantuan: 56, Colossal: 64 } },
  'Krithium':     { ts: 8, hardness: 20, dc: { Medium: 32, Large: 36, Huge: 40, Gargantuan: 44, Colossal: 52 } },
  'Megatanium':   { ts: 8, hardness: 30, dc: { Medium: 36, Large: 40, Huge: 44, Gargantuan: 48, Colossal: 56 } },
  'Mythandium':   { ts: 8, hardness: 40, dc: { Medium: 40, Large: 44, Huge: 48, Gargantuan: 52, Colossal: 60 } },
  'Nanofluidic':  { ts: 8, hardness: 30, dc: { Medium: 44, Large: 48, Huge: 52, Gargantuan: 56, Colossal: 64 } },
  'Metaxium':     { ts: 9, hardness: 50, dc: { Medium: 48, Large: 52, Huge: 56, Gargantuan: 60, Colossal: 68 } },
};
const MECHA_ARMOR_TYPES = {   // FF p.631 — equip AC, armor penalty, speed mod, DC formula (+N + frac × base frame DC)
  'Alumisteel':     { ts: 5, equipAC: 5,  penalty: -6,  speedMod: -5,  dcAdd: 10, dcFrac: 0.5,  restriction: 'Lic (+1)' },
  'Duraplastic':    { ts: 5, equipAC: 3,  penalty: -4,  speedMod: 0,   dcAdd: 5,  dcFrac: 0.5,  restriction: '—' },
  'Duralloy':       { ts: 6, equipAC: 8,  penalty: -8,  speedMod: -10, dcAdd: 5,  dcFrac: 0.5,  restriction: '—' },
  'Mythralloy':     { ts: 6, equipAC: 8,  penalty: -4,  speedMod: 0,   dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Resilium':       { ts: 6, equipAC: 6,  penalty: -5,  speedMod: 0,   dcAdd: 10, dcFrac: 0.5,  restriction: 'Lic (+1)' },
  'Steelskin':      { ts: 6, equipAC: 5,  penalty: 0,   speedMod: 0,   dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Adamantium':     { ts: 7, equipAC: 12, penalty: -8,  speedMod: -5,  dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Crystal Carbon': { ts: 7, equipAC: 10, penalty: -8,  speedMod: 0,   dcAdd: 15, dcFrac: 0.5,  restriction: 'Res (+2)' },
  'Neovulcanium':   { ts: 7, equipAC: 10, penalty: -10, speedMod: -5,  dcAdd: 10, dcFrac: 0.5,  restriction: 'Lic (+1)' },
  'Tithralium':     { ts: 7, equipAC: 10, penalty: -3,  speedMod: 0,   dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Krithium':       { ts: 8, equipAC: 10, penalty: -6,  speedMod: -5,  dcAdd: 5,  dcFrac: 0.5,  restriction: '—' },
  'Megatanium':     { ts: 8, equipAC: 12, penalty: -10, speedMod: -10, dcAdd: 10, dcFrac: 0.5,  restriction: 'Lic (+1)' },
  'Mythandium':     { ts: 8, equipAC: 12, penalty: -3,  speedMod: 0,   dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Nanofluidic':    { ts: 8, equipAC: 10, penalty: 0,   speedMod: 0,   dcAdd: 20, dcFrac: 0.5,  restriction: 'Mil (+3)' },
  'Reactive':       { ts: 8, equipAC: 8,  penalty: -5,  speedMod: 0,   dcAdd: 15, dcFrac: 0.5,  restriction: 'Res (+2)' },
  'Metaxium':       { ts: 9, equipAC: 15, penalty: null, speedMod: null, dcAdd: 20, dcFrac: 0.75, restriction: 'Ill (+4)', note: 'Penalty/speed: GM (Unobtanium-tier)' },
};
// FF pp.601-610 — the mecha weapon systems. dmgBySize entries are melee
// weapons whose dice scale with the wielding mecha ("Range/Die Increment"
// convention); flat dmg entries are ranged systems. `slots` counts include
// the ammo-pack notes in `special`.
const MECHA_WEAPONS = [
  { name: 'A3X Dragon Flame-Thrower', ts: 5, slots: '1', dc: '21', restriction: 'Mil (+3)', dmg: '4d6 fire', area: '30-ft cone from the mecha', save: 'Reflex half DC 13', special: '20 attacks of fuel; refuel DC 12.' },
  { name: 'M-9 Barrage Chaingun', ts: 5, slots: '1 (hand/arm/shoulders)', dc: '21', restriction: 'Res (+2)', dmg: '6d6 ballistic', range: '60 ft (600 max)', rof: 'S, A', mag: '4× 50-rd belts', special: '+6 belts per ammo slot; belt DC 8.' },
  { name: 'M-53 Firestar Rocket Launcher', ts: 5, slots: '1 (+1/6-pack)', dc: '24', restriction: 'Mil (+3)', dmg: '10d6 fire', area: '20-ft-radius blast, 200 ft', save: 'Reflex half DC 17', special: '6 rockets; +6-pack DC 12. Self-guided (mid-air detonation legal).' },
  { name: 'M-55 Crud Rocket Launcher', ts: 5, slots: '1 (+1/6-pack)', dc: '24', restriction: 'Mil (+3)', dmg: '10d6 slashing', area: '20-ft-radius blast, 200 ft', save: 'Reflex half DC 17', special: 'Shrapnel shells; +6-pack DC 12.' },
  { name: 'M-87 Talon Missile Launcher', ts: 5, slots: '1 (+1/4-missile battery)', dc: '23', restriction: 'Mil (+3)', dmg: '15d6 ballistic/fire (half each)', range: '2,000 ft or sensor range', special: 'Guidance negates range-increment penalties; +4-pack DC 21.' },
  { name: 'PS-15 Panther Claws', ts: 5, slots: '1 (hand/arm)', dc: '10 + ¼ base mecha', restriction: '—', dmgBySize: { Medium: '1d8', Large: '2d6', Huge: '2d8', Gargantuan: '4d6', Colossal: '4d10' }, dmgType: 'slashing', crit: '19–20', special: 'Converts slam to claws; retract/extend free action.' },
  { name: 'Thunderbolt Shock Rod', ts: 5, slots: '1 (hand/arm)', dc: '10 + ¼ base mecha', restriction: '—', dmgBySize: { Medium: '2d6', Large: '4d6', Huge: '6d6', Gargantuan: '8d6', Colossal: '10d6' }, dmgType: 'bludgeoning/electricity (half each)', special: 'One-handed shock rod.' },
  { name: 'Warpath Recoilless Rifle', ts: 5, slots: '1 (+1/20-rd magazine)', dc: '22', restriction: 'Mil (+3)', dmg: '10d6 ballistic', range: '40 ft (400 max)', rof: 'S, A', mag: '20', special: 'Extra magazine DC 15.' },
  { name: 'Buckshot Close-Combat Blaster', ts: 6, slots: '1 (hand only)', dc: '15 + ¼ base mecha', restriction: 'Res (+2)', dmg: '6d6 ballistic', range: '10 ft (100 max) or melee rider', mag: '10', special: 'Auto-discharges into any successful slam (no AoO as ranged-in-melee).' },
  { name: 'Corona Microwave Beam', ts: 6, slots: '1', dc: '19', restriction: 'Res (+2)', dmg: '5d6 fire', range: '15 ft (150 max)', special: 'Cheapest TS 6 energy weapon.' },
  { name: 'LK8 Armor-Piercing Pike', ts: 6, slots: '1 (hand/arm)', dc: '15 + ¼ base mecha', restriction: '—', dmgBySize: { Medium: '1d10', Large: '2d10', Huge: '4d10', Gargantuan: '6d10', Colossal: '8d10' }, dmgType: 'piercing', crit: '×3', special: 'Ignores 10 hardness; +5 ft reach; 1.5× Str two-handed; sized one step above the mecha.' },
  { name: 'M-21 Comet Autolaser', ts: 6, slots: '2 (hand/arm/shoulders)', dc: '22', restriction: 'Mil (+3)', dmg: '8d6 laser', range: '75 ft (750 max)', rof: 'S, A', special: 'Rotating laser ring.' },
  { name: 'M-70 EMP Rocket Launcher', ts: 6, slots: '1 (+1/6-pack)', dc: '27', restriction: 'Mil (+3)', dmg: '10d6 ionic (nonlethal, ignores hardness)', area: '20-ft-radius blast, 200 ft', save: 'Reflex half DC 17', special: 'Damaged mecha crews: Fort DC 15 or dazed 1 rd; +6-pack DC 15.' },
  { name: 'M-75 Cricket Rocket Launcher', ts: 6, slots: '1 (+1/6-pack)', dc: '25', restriction: 'Mil (+3)', dmg: '10d6 sonic (ignores hardness)', area: '20-ft-radius blast, 200 ft', save: 'Reflex half DC 17', special: 'Damaged mecha crews: Fort DC 15 or deafened 1d6 rds; +6-pack DC 13.' },
  { name: 'MK-40 Screwbolter Cannon', ts: 6, slots: '2 (incl. hand/arm/shoulders)', dc: '24', restriction: 'Mil (+3)', dmg: '6d8 anti-armor ballistic', range: '40 ft (400 max)', mag: '20', special: 'Ignores 10 hardness (Mythralloy screwbolts); +20 rds per ammo slot.' },
  { name: 'NKP Puma Pop-Up Turret', ts: 6, slots: '1 (any)', dc: '23', restriction: 'Mil (+3)', dmg: '8d6 laser', range: '75 ft (750 max)', special: 'Concealed pop-up laser; installs in any slot.' },
  { name: 'T-95 Cavalcade Chaingun', ts: 6, slots: '1 (hand/arm)', dc: '21', restriction: 'Res (+2)', dmg: '8d6 ballistic', range: '60 ft (600 max)', rof: 'S, A', mag: '4× 50-rd belts', special: 'Compact Barrage successor; belt DC 10.' },
  { name: 'Typhoon 240 Laser Cannon', ts: 6, slots: '2 (hand/arm/shoulders/visor)', dc: '25', restriction: 'Mil (+3)', dmg: '10d6 laser', range: '100 ft (1,000 max)', special: 'Workhorse laser cannon.' },
  { name: 'Chrysanthemum Laser Array', ts: 7, slots: '1', dc: '26', restriction: 'Mil (+3)', dmg: '16d8 laser', area: '60-ft-radius burst centered on the mecha (mecha unharmed)', save: 'Reflex half DC 25', special: 'One shot — burns out after firing; replace to reuse.' },
  { name: 'BFG-64 Borehole Gatling Cannon', ts: 7, slots: '2 (incl. hand/arm/shoulders)', dc: '27', restriction: 'Mil (+3)', dmg: '8d8 anti-armor ballistic', range: '80 ft (800 max)', rof: 'S', mag: '20', special: 'Ignores 20 hardness (tithralium screwbolts).' },
  { name: 'M-300 Rhino Mass Cannon', ts: 7, slots: '2 (incl. hand/arm/shoulders)', dc: '29', restriction: 'Mil (+3)', dmg: '8d12 ballistic', range: '100 ft (1,000 max)', special: 'Gravity-charged wrecking-ball rounds.' },
  { name: 'MC-22 Pop-Up Autolaser', ts: 7, slots: '1 (any)', dc: '24', restriction: 'Mil (+3)', dmg: '8d6 laser', range: '75 ft (750 max)', rof: 'S, A', special: 'Pop-up autolaser; pairs with the R-XI anti-missile system.' },
  { name: 'Neutralizer Ion Cannon', ts: 7, slots: '2 (incl. hand/arm/shoulders)', dc: '26', restriction: 'Res (+2)', dmg: '10d4 ionic (nonlethal electricity, ignores hardness)', range: '50 ft (500 max)', special: 'Anti-tech knockout weapon.' },
  { name: 'PS-25 Tiger Vibro Claws', ts: 7, slots: '1 (hand/arm)', dc: '15 + ½ base mecha', restriction: 'Res (+2)', dmgBySize: { Medium: '2d8', Large: '4d8', Huge: '6d8', Gargantuan: '8d8', Colossal: '10d8' }, dmgType: 'slashing (ignores hardness)', crit: '19–20', special: 'Monofilament claws; retract free action.' },
  { name: 'SW-37 Sidewinder Mini-Missile Launcher', ts: 7, slots: '2 adjoining (+1/12-pack)', dc: '25', restriction: 'Mil (+3)', dmg: '10d6 concussion', area: '5-ft hex, 2½-ft blast', range: '1 mile or sensor range', save: 'Reflex half DC 15', special: 'Smart missiles: +4 to confirm crits, threat 19–20; 12 mini-missiles.' },
  { name: 'Tsunami 480 Plasma Cannon', ts: 7, slots: '3 (hand/arm/shoulders/visor)', dc: '31', restriction: 'Mil (+3)', dmg: '12d6 plasma (ignores hardness)', range: '30 ft (300 max) focused, or 30-ft cone', save: 'Reflex half DC 19 (cone)', special: 'Aperture toggle (move action): focused beam (crit 20) or wide-angle cone (no crits).' },
  { name: 'XJ-A Python Electro-Whip', ts: 7, slots: '1 (hand/arm)', dc: '15 + ½ base mecha', restriction: 'Res (+2)', dmgBySize: { Medium: '1d10', Large: '2d10', Huge: '4d10', Gargantuan: '6d10', Colossal: '8d10' }, dmgType: 'electricity or ionic (wielder’s choice)', special: '+15 ft reach; +2 on disarm; trip via melee touch (droppable to avoid counter-trip).' },
  { name: 'Avenger Electro-Scimitar', ts: 8, slots: '1 (hand/arm)', dc: '15 + ½ base mecha', restriction: 'Res (+2)', dmgBySize: { Medium: '2d8', Large: '4d6', Huge: '8d6', Gargantuan: '12d6', Colossal: '16d6' }, dmgType: 'slashing + electricity/ionic (half each)', crit: '18–20', special: 'Mastercraft: +1 attack.' },
  { name: 'LT-5 Longshot Mass Driver', ts: 8, slots: '2 (+1/10-rd bay)', dc: '24', restriction: 'Mil (+3)', dmg: '15d6 ballistic', range: '120 ft (1,200 max)', mag: '10', special: 'Spent-uranium slugs; magazine DC 12.' },
  { name: 'Phase Cannon', ts: 8, slots: '3 (hand/arm/shoulder/visor)', dc: '36', restriction: 'Mil (+3)', dmg: '10d8 ionic OR 10d8 electricity OR 5d8 disintegration', range: '50/200/100 ft by setting', special: 'Three settings (ionic/electrical/disintegration), single shot each.' },
  { name: 'RP-91 Reaper Plasma Scythe', ts: 8, slots: '2 (hand/arm)', dc: '15 + ¼ base mecha', restriction: 'Res (+2)', dmgBySize: { Medium: '2d10', Large: '4d10', Huge: '6d10', Gargantuan: '8d10', Colossal: '10d10' }, dmgType: 'slashing + plasma (half each)', crit: '×4', special: 'Two-handed; 1.5× Str; mastercraft +1 attack; sized one step above the mecha.' },
];
// FF pp.620-626 — the sample mecha. Myrmidon and Taurus also exist as power
// armors (POWER_ARMOR_DB) — these are their MECHA configurations (a Medium
// pilot in the 2-slot cockpit).
const MECHA_UNITS = {
  'Myrmidon Infantry Support Mecha': { size: 'Large', ts: 6, hp: 100, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Duralloy', equipAC: 8, armorPenalty: -8, str: 18, dexMax: 10, speed: 20, fly: '100 ft. (clumsy — Jetpack)',
    printedTAC: '9/17', slam: '1d8', purchaseDC: 41,
    note: 'Dual-registered: also a Large power armor (see the armor catalogue).',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class II Sensor System' }, { slot: 'Back', gear: "Pilot's Cockpit (1 of 2)", fixed: true },
      { slot: 'Left Arm', gear: 'M-9 Barrage Chaingun' }, { slot: 'Right Arm', gear: 'PS-15 Panther Claws' },
      { slot: 'Shoulders', gear: '6 50-round ammo belts (Barrage)' }, { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Boots', gear: 'Jetpack' }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Life Support System' } ] },
  'Taurus Mechanized Infantry Mecha': { size: 'Large', ts: 6, hp: 100, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Resilium', equipAC: 6, armorPenalty: -5, str: 22, dexMax: 14, speed: 30, fly: null,
    printedTAC: '9/19', slam: '1d8', purchaseDC: 41,
    note: 'Dual-registered: also a Large power armor. Printed T/AC credits +4 shield (no shield in the standard loadout — GM adjudicates).',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class III Sensor System' }, { slot: 'Back', gear: "Pilot's Cockpit (1 of 2)", fixed: true },
      { slot: 'Left Arm', gear: 'LK8 Armor-Piercing Pike' }, { slot: 'Right Arm', gear: 'M-21 Comet Autolaser (1 of 2)' },
      { slot: 'Shoulders', gear: 'M-21 Comet Autolaser (2 of 2)' }, { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Boots', gear: 'Space Skin' }, { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Dexterity Upgrade (+4)' }, { slot: '(no slot)', gear: 'Strength Upgrade (+4)' } ] },
  'Scourge Assault Mecha': { size: 'Huge', ts: 6, hp: 200, superstructure: 'Vanadium', hardness: 20,
    armorType: 'Duralloy', equipAC: 8, armorPenalty: -8, str: 26, dexMax: 10, speed: 30, fly: '100 ft. (poor)',
    printedTAC: '8/16', slam: '2d6', purchaseDC: 49,
    note: 'Heavy-weapons mecha — disables enemy armor for the mop-up crews.',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Class II Sensor System' }, { slot: 'Visor', gear: 'Enigma Sensor Suite' },
      { slot: 'Back', gear: "Pilot's Cockpit (1 of 2)", fixed: true }, { slot: 'Left Arm', gear: 'Typhoon 240 Laser Cannon (1 of 2)' },
      { slot: 'Left Hand', gear: 'Typhoon 240 Laser Cannon (2 of 2)' }, { slot: 'Right Arm', gear: 'M-53 Firestar missile box (6 add.)' },
      { slot: 'Right Hand', gear: 'M-53 Firestar Rocket Launcher (6 missiles)' }, { slot: 'Shoulders', gear: 'Jet-Assist Wings' },
      { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true }, { slot: 'Belt', gear: 'LX-10 Antishock Array' },
      { slot: 'Boots', gear: 'Jetpack' }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Life Support System' } ] },
  'Manticore Close-Combat Mecha': { size: 'Huge', ts: 7, hp: 200, superstructure: 'Neovulcanium', hardness: 20,
    armorType: 'Crystal Carbon', equipAC: 10, armorPenalty: -8, str: 26, dexMax: 10, speed: 50, fly: '300 ft. (average)',
    printedTAC: '8/18', slam: '2d6', purchaseDC: 45, quad: true,
    note: 'Flying quadruped; the "tail" (belt slot) mounts a Chrysanthemum for the thick of melee.',
    defaultLoadout: [
      { slot: 'Helmet', gear: "Pilot's Cockpit (1 of 2)", fixed: true }, { slot: 'Visor', gear: 'Class IV Sensor System' },
      { slot: 'Back', gear: 'Thrusters' }, { slot: 'Left Arm', gear: 'PS-25 Tiger Vibro Claws' },
      { slot: 'Left Hand', gear: 'Quadruped frame (1 of 3)', fixed: true }, { slot: 'Right Arm', gear: 'MC-22 Pop-Up Autolaser' },
      { slot: 'Right Hand', gear: 'Quadruped frame (2 of 3)', fixed: true }, { slot: 'Shoulders', gear: 'Jet-Assist Wings' },
      { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true }, { slot: 'Belt ("Tail")', gear: 'Chrysanthemum Laser Array' },
      { slot: 'Boots', gear: 'Quadruped frame (3 of 3)', fixed: true }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Life Support System' } ] },
  'Gemini Mechanized Cavalry Mecha': { size: 'Huge', ts: 7, hp: 200, superstructure: 'Vanadium', hardness: 20,
    armorType: 'Resilium', equipAC: 6, armorPenalty: -5, str: 26, dexMax: 14, speed: 40, fly: '300 ft. (poor)',
    printedTAC: '8/14', slam: '2d6', purchaseDC: 49,
    note: 'Two-headed gunner/pilot design — extra head & visor slots host a full co-pilot cockpit.',
    defaultLoadout: [
      { slot: 'Left Helmet', gear: "Pilot's Cockpit (1 of 2)", fixed: true }, { slot: 'Left Visor', gear: 'MC-22 Pop-Up Autolaser' },
      { slot: 'Right Helmet', gear: "Co-Pilot's Cockpit (1 of 3)", fixed: true }, { slot: 'Right Visor', gear: 'Class V Sensor System' },
      { slot: 'Back', gear: "Co-Pilot's Cockpit (2 of 3)", fixed: true }, { slot: 'Left Arm', gear: 'LX-20 Antishock Array' },
      { slot: 'Left Hand', gear: 'PS-25 Tiger Vibro Claws' }, { slot: 'Right Arm', gear: 'Typhoon 240 Laser Cannon (1 of 2)' },
      { slot: 'Right Hand', gear: 'Typhoon 240 Laser Cannon (2 of 2)' }, { slot: 'Shoulders', gear: "Co-Pilot's Cockpit (3 of 3)", fixed: true },
      { slot: 'Torso', gear: "Pilot's Cockpit (2 of 2)", fixed: true }, { slot: 'Belt', gear: 'Thrusters' },
      { slot: 'Boots', gear: 'Space Skin' }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Dexterity Upgrade (+4)' } ] },
  'Cancer Utility Mecha': { size: 'Huge', ts: 7, hp: 200, superstructure: 'Duralloy', hardness: 15,
    armorType: 'Resilium', equipAC: 6, armorPenalty: -5, str: 30, dexMax: 10, speed: 50, fly: null,
    printedTAC: '8/14', slam: '2d6', purchaseDC: 49, quad: true,
    note: '"Mecha-of-all-trades" quadruped with a passenger cockpit and manipulator arms.',
    defaultLoadout: [
      { slot: 'Helmet', gear: "Pilot's Cockpit (1 of 2)", fixed: true }, { slot: 'Visor', gear: 'Class V Sensor System' },
      { slot: 'Back', gear: "Passenger's Cockpit (1 of 2)", fixed: true }, { slot: 'Left Arm', gear: 'Space Skin' },
      { slot: 'Left Hand', gear: 'Quadruped frame (1 of 3)', fixed: true }, { slot: 'Right Arm', gear: 'Advanced Diagnostics' },
      { slot: 'Right Hand', gear: 'Quadruped frame (2 of 3)', fixed: true }, { slot: 'Shoulders', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Torso', gear: "Passenger's Cockpit (2 of 2)", fixed: true }, { slot: 'Belt', gear: 'MC-22 Pop-Up Autolaser' },
      { slot: 'Boots', gear: 'Quadruped frame (3 of 3)', fixed: true }, { slot: '(no slot)', gear: 'Comm System' },
      { slot: '(no slot)', gear: 'Strength Upgrade (+4)' }, { slot: '(no slot)', gear: 'Manipulators ×2' } ] },
  'Tempest Support Mecha': { size: 'Gargantuan', ts: 7, hp: 450, superstructure: 'Neovulcanium', hardness: 20,
    armorType: 'Crystal Carbon', equipAC: 10, armorPenalty: -8, str: 34, dexMax: 10, speed: 50, fly: '300 ft. (average)',
    printedTAC: '6/20', slam: '2d8', purchaseDC: 49,
    note: 'Heavy support platform (HP includes a Structural Enhancement +50). Printed T/AC includes the Bastion shield (+4).',
    defaultLoadout: [
      { slot: 'Helmet', gear: 'Tsunami 480 Plasma Cannon (1 of 3)' }, { slot: 'Visor', gear: 'Oracle Mark III Targeting System' },
      { slot: 'Cranium', gear: 'Class IV Sensor System' }, { slot: 'Back (1)', gear: 'Jet-Assist Wings' },
      { slot: 'Back (2)', gear: 'Structural Enhancement' }, { slot: 'Left Arm', gear: 'Bastion Tactical Shield' },
      { slot: 'Left Hand', gear: 'Tsunami 480 Plasma Cannon (2 of 3)' }, { slot: 'Right Arm', gear: '4-pack Talon Missiles (M-87)' },
      { slot: 'Right Hand', gear: 'XJ-A Python Electro-Whip' }, { slot: 'Shoulders (1)', gear: 'M-87 Talon Missile Launcher' },
      { slot: 'Shoulders (2)', gear: 'Tsunami 480 Plasma Cannon (3 of 3)' }, { slot: 'Torso (1)', gear: "Pilot's Cockpit (1 of 2)", fixed: true },
      { slot: 'Torso (2)', gear: 'HV-5 Haven Escape Pod' }, { slot: 'Belt', gear: "Pilot's Cockpit (2 of 2)", fixed: true },
      { slot: 'Left Leg', gear: 'Space Skin' }, { slot: 'Right Leg', gear: 'LX-20 Antishock Array' },
      { slot: 'Boots', gear: 'Thrusters' }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Dexterity Upgrade (+2)' } ] },
  'Paragon Siege Mecha': { size: 'Colossal', ts: 8, hp: 800, superstructure: 'Megatanium', hardness: 30,
    armorType: 'Megatanium', equipAC: 12, armorPenalty: -10, str: 42, dexMax: 10, speed: 50, fly: '600 ft. (good)',
    printedTAC: '4/22', slam: '4d6', purchaseDC: 61,
    note: 'Mobile weapons platform — fights armed starships toe-to-toe. Printed T/AC includes Barricade shield (+6) and Mark II Deflection Field (+2).',
    defaultLoadout: [
      { slot: 'Helmet (1)', gear: 'Advanced Diagnostics' }, { slot: 'Helmet (2)', gear: 'Class V Sensor System' },
      { slot: 'Visor', gear: 'Oracle Mark IV Targeting System' }, { slot: 'Cranium', gear: 'Crackerjack Neural Link' },
      { slot: 'Back (1)', gear: 'Jet-Assist Wings' }, { slot: 'Back (2)', gear: 'Light Fortification' },
      { slot: 'Left Arm (1)', gear: '4-pack Talon Missiles (M-87)' }, { slot: 'Left Arm (2)', gear: '6-pack EMP Missiles (M-70)' },
      { slot: 'Left Hand', gear: 'Avenger Electro-Scimitar' }, { slot: 'Right Arm (1)', gear: 'Barricade Tactical Shield' },
      { slot: 'Right Arm (2)', gear: 'M-300 Rhino Mass Cannon (1 of 2)' }, { slot: 'Right Hand', gear: 'M-300 Rhino Mass Cannon (2 of 2)' },
      { slot: 'Shoulders (1)', gear: 'M-87 Talon Missile Launcher' }, { slot: 'Shoulders (2)', gear: 'M-70 EMP Rocket Launcher' },
      { slot: 'Torso (1)', gear: 'HV-5 Haven Escape Pod' }, { slot: 'Torso (2)', gear: 'Zero-G Stabilizer' },
      { slot: 'Torso (3)', gear: '6-pack EMP Missiles (M-70)' }, { slot: 'Torso (4)', gear: '6-pack EMP Missiles (M-70)' },
      { slot: 'Belt (1)', gear: 'Mark II Deflection Field' }, { slot: 'Belt (2)', gear: 'Space Skin' },
      { slot: 'Left Leg (1)', gear: 'LX-20 Antishock Array' }, { slot: 'Left Leg (2)', gear: 'Thrusters (1 of 2)' },
      { slot: 'Right Leg (1)', gear: 'Sandstorm ECM Module' }, { slot: 'Right Leg (2)', gear: 'Thrusters (2 of 2)' },
      { slot: 'Boots', gear: 'Ramjet Thruster Boots' }, { slot: '(no slot)', gear: 'Comm System' }, { slot: '(no slot)', gear: 'Dexterity Upgrade (+4)' } ] },
};
// Resolve a mecha item's definition — a sample unit, or a builder design
// derived live from the frame/superstructure/armor cost tables.
function mechaDefOf(it) {
  if (!it || it.catalogue !== 'mecha') return null;
  if (MECHA_UNITS[it.ref]) return MECHA_UNITS[it.ref];
  if (it.custom) {
    const cu = it.custom;
    const sz = MECHA_SIZE_STATS[cu.size] || MECHA_SIZE_STATS.Medium;
    const ss = MECHA_SUPERSTRUCTURES[cu.superstructure] || { hardness: 10, ts: 5, dc: {} };
    const ar = MECHA_ARMOR_TYPES[cu.armorType] || { equipAC: 0, penalty: 0, speedMod: 0, dcAdd: 0, dcFrac: 0, ts: 5 };
    const baseDC = ss.dc[cu.size] || sz.baseDC;
    return {
      size: cu.size, ts: Math.max(ss.ts, ar.ts, 6), hp: sz.hp, superstructure: cu.superstructure, hardness: ss.hardness,
      armorType: cu.armorType, equipAC: ar.equipAC, armorPenalty: ar.penalty || 0,
      str: sz.str, dexMax: sz.dex, speed: Math.max(5, sz.speed + (ar.speedMod || 0)), fly: null,
      printedTAC: null, slam: sz.slam, purchaseDC: baseDC + (ar.dcAdd || 0) + Math.floor((ar.dcFrac || 0) * baseDC),
      note: `Custom build — ${cu.size} ${cu.superstructure} frame (base DC ${baseDC}), ${cu.armorType} armor.`,
      defaultLoadout: (cu.size === 'Medium')
        ? [{ slot: 'Torso', gear: "Pilot's Cockpit", fixed: true }]
        : [{ slot: 'Torso', gear: "Pilot's Cockpit (1 of 2)", fixed: true }, { slot: (cu.size === 'Large' || cu.size === 'Huge') ? 'Helmet or Back' : 'Adjoining slot', gear: "Pilot's Cockpit (2 of 2)", fixed: true }],
    };
  }
  return null;
}
function mechaTouchAC(def) { const sz = MECHA_SIZE_STATS[def.size] || {}; return 10 + (sz.sizeMod || 0); }
// The custom-build flow: size → superstructure → armor type → name, priced
// from the FF pp.630-631 tables, then the standard purchase/provenance door.
async function openMechaBuilder() {
  const c = chars.find(x => x.id === curId); if (!c) { toast('Select a hero first.'); return; }
  const size = await new Promise(res => openChoiceModal('Custom mecha — frame size (sets base Str/Dex/HP/speed/slots)',
    Object.keys(MECHA_SIZE_STATS).map(s => { const z = MECHA_SIZE_STATS[s]; return `${s} — Str ${z.str}, ${z.hp} HP, ${z.speed} ft, ${z.slots} slots (${z.paSlots} as PA)`; }), res));
  if (!size) return;
  const szName = size.split(' — ')[0];
  const ss = await new Promise(res => openChoiceModal('Superstructure (sets hardness + frame base DC — FF p.630)',
    Object.keys(MECHA_SUPERSTRUCTURES).map(n => { const s = MECHA_SUPERSTRUCTURES[n]; return `${n} (TS ${s.ts}) — Hardness ${s.hardness}, base DC ${s.dc[szName]}`; }), res));
  if (!ss) return;
  const ssName = ss.split(' (')[0];
  const ar = await new Promise(res => openChoiceModal('Armor type (equip AC / penalty / speed — FF p.631)',
    Object.keys(MECHA_ARMOR_TYPES).map(n => { const a = MECHA_ARMOR_TYPES[n]; return `${n} (TS ${a.ts}) — +${a.equipAC} AC, ${a.penalty == null ? 'GM' : a.penalty} penalty${a.speedMod ? `, ${a.speedMod} ft` : ''}, ${a.restriction}`; }), res));
  if (!ar) return;
  const arName = ar.split(' (')[0];
  const nm = await textModal('Name the design', 'e.g. "Ares Custom Mk I". The stat card derives live from the frame tables.', '');
  if (nm === null) return;
  const custom = { name: (nm || `Custom ${szName} Mecha`).trim(), size: szName, superstructure: ssName, armorType: arName };
  const probe = mechaDefOf({ catalogue: 'mecha', custom });
  const techScale = scenarioTechScale(c);
  let provenance = null;
  if (!(typeof promptProvenance !== 'function')) {
    const priceUnits = dollarsForDC(marketAdjustedDC(probe.purchaseDC, probe.ts, techScale));
    provenance = await promptProvenance(c, custom.name, priceUnits);
    if (provenance === null) return;
  }
  if (!c.items) c.items = [];
  // customName carries the design name into every generic display path
  // (enchantDisplayName, logs, toasts) — ref stays the '__custom__' marker.
  const item = { id: 'item_' + Math.random().toString(36).slice(2, 10), catalogue: 'mecha', ref: '__custom__', customName: custom.name, custom, slot: 'carried', equipped: false, mastercraft: null, gadgets: [] };
  if (provenance) item.provenance = provenance;
  c.items.push(item);
  logAct(`🏗 Custom mecha commissioned: ${custom.name} (${szName} ${ssName} frame, ${arName} armor — base purchase DC ${probe.purchaseDC}). Weapons & systems install on the Vehicles tab (Craft checks & build times per FF Ch.III).`);
  save(); renderGear(); renderVehicles(); if (typeof renderNavTabs === 'function') renderNavTabs(c);
  toast(`${custom.name} commissioned — outfit it on the 🕹 Vehicles tab.`);
}
// The mecha operations card.
function renderMechaCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'mecha');
  if (!items.length) return '';
  const owns = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  const hasOp = owns('Mecha Operation'), hasWp = owns('Mecha Weapon Proficiency');
  return items.map(it => {
    const def = mechaDefOf(it); if (!def) return '';
    const g = vehicleIntegrity(it);
    const name = it.custom ? it.custom.name : (it.customName || it.ref);
    const sz = MECHA_SIZE_STATS[def.size] || {};
    const touch = mechaTouchAC(def);
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? '#555' : g.broken ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
    const pilotDexM = am(Math.min(effAttrs(c)[1], def.dexMax));
    const ranks = getLiveSkillRanks(c, 'Pilot');
    const opPen = hasOp ? 0 : -4;
    const pilotChk = ranks + pilotDexM + opPen;
    const critConfirm = touch + Math.ceil(g.hardness / 2) + (hasOp ? (c.def || 0) : 0) + paShieldBonus(it);
    const strM = am(def.str);
    const loadout = paLoadout(it).map((l, idx) => {
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? '#999' : l.state === 'damaged' ? 'var(--red-text)' : '#6dba88';
      const sys = MECHA_SYSTEMS.find(s => l.gear.startsWith(s.name.replace(/ \(\+2\)$/, '')));
      const wep = MECHA_WEAPONS.find(w => l.gear.startsWith(w.name.split(' (')[0]) || l.gear.includes(w.name));
      let tip = '';
      if (wep) {
        const dmg = wep.dmg || (wep.dmgBySize ? `${wep.dmgBySize[def.size] || '?'} + Str mod (${def.size} wielder)` : '');
        tip = `${dmg}${wep.dmgType ? ' ' + wep.dmgType : ''}${wep.crit ? ' · crit ' + wep.crit : ''}${wep.range ? ' · ' + wep.range : ''}${wep.area ? ' · ' + wep.area : ''}${wep.rof ? ' · RoF ' + wep.rof : ''}${wep.mag ? ' · mag ' + wep.mag : ''}${wep.save ? ' · ' + wep.save : ''}${wep.special ? '\n' + wep.special : ''}\nSlots: ${wep.slots} · DC ${wep.dc} · ${wep.restriction}${hasWp ? '' : '\n⚠ Without Mecha Weapon Proficiency: −4 attacks, no firearm feats.'}`;
      } else if (sys) tip = `${sys.effect} (Slots: ${sys.slots} · DC ${sys.dc})`;
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (1 hr, Repair DC 20; slot DC 25) → destroyed (replace; slot rebuild 12 hrs, Craft DC 30) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span style="color:var(--g55);min-width:98px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:#78afcd;' : ''}${wep ? 'color:#d4865a;' : ''}" ${tip ? `title="${escapeHTML(tip)}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}</span>
        ${l.fixed ? '' : `<button class="btn btn-sm" style="font-size:9px;padding:0 4px;" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="panel" style="margin-bottom:.8rem;border-color:rgba(212,140,70,.4);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;color:var(--gold);">${it.piloted ? '🕹 ' : ''}🦿 ${escapeHTML(name)} <span style="font-size:10px;color:var(--g50);">${def.size} TS ${def.ts}${def.quad ? ' Quadrupedal' : ''} Mecha · ${escapeHTML(def.superstructure)} / ${escapeHTML(def.armorType)}</span></div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;${it.piloted ? 'border-color:rgba(120,175,205,.6);color:#78afcd;' : ''}" onclick="togglePiloted('${it.id}')">${it.piloted ? '🕹 Dismount' : '🕹 Pilot'}</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="vehicleIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="vehicleRepair('${it.id}')">🔧 Repair</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="setJointOwners('${it.id}')">✎ Owners</button>
        </div>
      </div>
      ${def.note ? `<div style="font-size:10px;color:var(--g50);margin-top:3px;">${escapeHTML(def.note)}</div>` : ''}
      <div style="font-size:11px;color:var(--parch);margin-top:5px;">
        <b>Str ${def.str}</b> (${strM >= 0 ? '+' : ''}${strM} — the mecha's, FF p.618) · <b>Dex (Max) ${def.dexMax}</b> (your effective: ${Math.min(effAttrs(c)[1], def.dexMax)}) ·
        speed <b>${def.speed} ft</b> <span style="opacity:.6;cursor:help;" title="Vehicular/mecha scale: 1 hex = 50 ft (personal scale 5 ft; stellar 250 ft — Adam's three combat scales).">(${Math.floor((def.speed || 0) / 50)} hx @50′)</span>${def.fly ? ` · fly ${escapeHTML(def.fly)}` : ''} · space/reach ${sz.spaceReach || (def.size === 'Medium' ? '5/5' : def.size === 'Large' ? '10/10' : def.size === 'Huge' ? '15/10' : def.size === 'Gargantuan' ? '20/15' : '30/15')} ft ·
        <span style="cursor:help;" title="Touch ${touch} (10 ${sz.sizeMod ? (sz.sizeMod > 0 ? '+' : '') + sz.sizeMod + ' size' : ''}); total adds equip AC ${def.equipAC}${paShieldBonus(it) ? ' + shield ' + paShieldBonus(it) : ''}. Crits confirm vs ${critConfirm} (touch + ½ hardness${hasOp ? ' + your Defense Bonus' : ' — NO Defense Bonus without Mecha Operation'}${paShieldBonus(it) ? ' + shield' : ''}) — FF p.616.">T/AC <b>${touch}/${touch + def.equipAC + paShieldBonus(it)}</b>${def.printedTAC && def.printedTAC !== `${touch}/${touch + def.equipAC + paShieldBonus(it)}` ? ` <span style="opacity:var(--o55);color:var(--dim);">(book: ${def.printedTAC})</span>` : ''} · crit ≥ ${critConfirm}</span> ·
        <span style="cursor:help;" title="Slam: your BAB + mecha Str mod${sz.sizeMod ? ` ${sz.sizeMod > 0 ? '+' : ''}${sz.sizeMod} size` : ''}${hasOp ? '' : ' −4 (no Mecha Operation)'}; armor penalty ${def.armorPenalty} applies to Balance/Climb/Escape Artist/Hide/Jump/Move Silently/Tumble while piloting.">slam <b>${def.slam}${strM ? ` ${strM > 0 ? '+' : ''}${strM}` : ''}</b> (atk ${(c.bab || 0) + strM + (sz.sizeMod || 0) + opPen >= 0 ? '+' : ''}${(c.bab || 0) + strM + (sz.sizeMod || 0) + opPen})</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:11.5px;">
        <span style="cursor:help;" title="${escapeHTML(def.superstructure + ' superstructure — hardness applies to every hull hit; crew is hit only via crit-table results (FF p.616).')}">Hull <b style="color:${barColor};">${g.hp}</b>/${g.maxHP} · Hardness <b>${g.hardness}</b></span>
        <div class="bar-wrap" style="flex:1;height:6px;"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
        <span style="cursor:help;color:#d4b870;font-size:10px;" title="Mecha Critical Hits (FF p.616): d20 — 1-3 dmg+crew dazed · 4-7 equipment damaged · 8-9 crit+crew dazed · 10 equipment destroyed · 11-12 crit+prone · 13 CREW HIT · 14-16 crit+slot damaged · 17-18 crit+slot destroyed · 19-20 severe ×5. Mark results on the loadout.">🎲 crit table ⓘ</span>
      </div>
      ${g.destroyed ? '<div style="color:#999;font-size:10.5px;margin-top:3px;">☠ DESTROYED — salvage only (HH p.181).</div>' : g.broken ? '<div style="color:var(--red-text);font-size:10.5px;margin-top:3px;">🛑 DISABLED — 0 HP; repair 1 hr / DC 20 / 2d6 HP (workshop).</div>' : ''}
      <div style="font-size:11px;color:var(--g70);margin-top:5px;">
        Your Pilot check aboard: <b style="color:var(--gold);">${pilotChk >= 0 ? '+' : ''}${pilotChk}</b> <span style="opacity:var(--o60);color:var(--dim);">(${ranks} ranks ${pilotDexM >= 0 ? '+' : ''}${pilotDexM} Dex [capped]${opPen ? ' − 4 no Mecha Operation' : ''})</span>
        · ${hasOp ? '<span style="color:#6dba88;">✓ Mecha Operation</span>' : '<span style="color:var(--red-text);" title="−4 on Balance/Climb/Drive/Escape Artist/Hide/Move Silently/Pilot/Tumble aboard; no Defense Bonus to full AC; no run or charge.">✗ Mecha Operation</span>'}
        · ${hasWp ? '<span style="color:#6dba88;">✓ Mecha Weapon Proficiency</span>' : '<span style="color:var(--red-text);" title="−4 on attacks with mecha weapons; firearm feats (Double Tap, Strafe…) unusable on them.">✗ Mecha Weapon Prof</span>'}
      </div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--g55);margin-top:7px;">Equipment Slots (${sz.slots ?? '?'} total — cockpit fixed) <button class="btn btn-sm" style="font-size:9px;padding:0 5px;margin-left:6px;" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
      <div style="font-size:10px;color:var(--g45);margin-top:3px;">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`}</div>
    </div>`;
  }).join('');
}

