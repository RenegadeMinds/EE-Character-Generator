// =============================================================================
// js/app/60-starships.js
// STARSHIPS
// =============================================================================
//
// WHAT'S IN HERE
//   Starships: size classes, subtypes, engines, armor, weapons, mounts and
//   arcs, defenses, sensors, and the ship cards.
//
// KEY NAMES (so you can search for them)
//   tables/objects: STARSHIP_SIZE_CLASSES, STARSHIP_SUBTYPES,
//   STARSHIP_ENGINES, STARSHIP_ARMOR, STARSHIP_WEAPONS, SHIP_MOUNT_KINDS,
//   SHIP_CUPOLA_PAIRS, SHIP_FIXED_ARCS, SHIP_SIZE_LADDER, STARSHIP_DEFENSES,
//   STARSHIP_SENSORS, STARSHIP_COMMS, STARSHIP_SYSTEM_FX,
//   STARSHIP_SUBTYPE_STATS, STARSHIP_COMBAT_REF, SHIP_SECTIONS
//   functions (20): shipWeaponTakesMount, shipMountOf, shipMountChip,
//   shipHullSizeStep, shipWeaponSizeStep, shipLinkedDice, shipThreatRange,
//   shipLinkOf, shipBatteryOf, shipHasMainCannon, shipLinkOptions,
//   shipLinkChip, shipBatteryChip, shipDefOf, shipSections,
//   openStarshipBuilder, shipIncomingHit, shipRepair, renderStarshipCards,
//   renderPrepPanel
//
// LOAD ORDER
//   File 60 of 68. index.html loads it after js/app/59-mecha.js and before
//   js/app/61-casting-augments-and-powers-page.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 49247-50104 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 49247-50104; unchanged below this line ----
// ============================================================================
// v8.18.0 SEGMENT D — STARSHIPS (first pass, 2026-09-03). FF Ch.IV
// pp.634-689: composition (capital dice D = 20 HP, divided among five
// sections: Infrastructure/Fore/Starboard/Port/Aft), engines, armor, ~40
// weapons, defense/sensor/comm tables, grappling, the d20 crit table
// (header misprints "d%"), and the per-subtype stat blocks (pp.664-683).
// GMG pp.505-515 carries combat flow. FIRST-PASS notes for Adam are marked
// ⚠BOOK in comments; defense/sensor entries are table-level pending pass 2.
const STARSHIP_SIZE_CLASSES = {
  Ultralight:   { grappleMod: '+0 (Garg) / +4 (Col)', engines: 2, sensorsMax: 2, weaponsPer: '1 per 3 HD',   space: '≤500 ft (1-polyhex)' },
  Light:        { grappleMod: '+8',  engines: 2, sensorsMax: 2, weaponsPer: '1 per 10 HD',  space: '500 ft (2-polyhex)' },
  Mediumweight: { grappleMod: '+12', engines: 2, sensorsMax: 3, weaponsPer: '1 per 25 HD',  space: '1,000 ft (3-polyhex)' },
  Heavy:        { grappleMod: '+16', engines: 2, sensorsMax: 3, weaponsPer: '1 per 50 HD',  space: '1,500 ft (4-polyhex)' },
  Superheavy:   { grappleMod: '+20', engines: 3, sensorsMax: 3, weaponsPer: '1 per 100 HD', space: '2,000+ ft (5-polyhex+)' },
};
// ⚠BOOK: the two printings of the subtype table disagree — chapter copy
// (p.634): Courier 9D, Fighter engines "1D (3D Infrastructure)"; quick-ref
// copy (p.687): Courier 8D, Fighter "1D (4D Infrastructure)". CHAPTER COPY
// used here; flagged on Adam's TODO.
const STARSHIP_SUBTYPES = {
  'Orbital Shuttle': { cls: 'Ultralight', ts: 5, D: 6,   engineD: '1D (2D Infrastructure)', weapons: 2,  defense: 2,  sensors: 2, tac: '6/10', tacTrained: '7/14', hardness: 20, hardStr: '20/4d/1D', crew: 4,    lw: '60 ft / 220,000 lb', dc: 52, restriction: 'Res (+2)' },
  'Courier':         { cls: 'Ultralight', ts: 6, D: 9,   engineD: '1D (4D Infrastructure)', weapons: 3,  defense: 3,  sensors: 2, tac: '6/10', tacTrained: '8/15', hardness: 20, hardStr: '20/4d/1D', crew: 4,    lw: '45 ft / 90,000 lb',  dc: 48, restriction: 'Lic (+1)' },
  'Escort':          { cls: 'Ultralight', ts: 6, D: 20,  engineD: '4D', weapons: 6,  defense: 6,  sensors: 2, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 8,    lw: '180 ft / 900 tons',  dc: 52, restriction: 'Res (+2)' },
  'Fast Freighter':  { cls: 'Ultralight', ts: 6, D: 16,  engineD: '3D (4D Infrastructure)', weapons: 5,  defense: 5,  sensors: 2, tac: '2/10', tacTrained: '4/15', hardness: 20, hardStr: '20/4d/1D', crew: 4,    lw: '110 ft / 450 tons',  dc: 52, restriction: 'Res (+2)' },
  'Fighter':         { cls: 'Ultralight', ts: 6, D: 8,   engineD: '1D (3D Infrastructure)', weapons: 2,  defense: 2,  sensors: 2, tac: '6/10', tacTrained: '8/15', hardness: 20, hardStr: '20/4d/1D', crew: 1,    lw: '36 ft / 20 tons',    dc: 48, restriction: 'Mil (+3)' },
  'Launch':          { cls: 'Ultralight', ts: 6, D: 5,   engineD: '1D', weapons: 1,  defense: 1,  sensors: 2, tac: '8/10', tacTrained: '10/15', hardness: 20, hardStr: '20/4d/1D', crew: 1,   lw: '24 ft / 12 tons',    dc: 40, restriction: 'Lic (+1)' },
  'Scout':           { cls: 'Ultralight', ts: 6, D: 15,  engineD: '3D', weapons: 5,  defense: 5,  sensors: 2, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 8,    lw: '150 ft / 600 tons',  dc: 52, restriction: 'Mil (+3)' },
  'Starfighter':     { cls: 'Ultralight', ts: 7, D: 12,  engineD: '2D (4D Infrastructure)', weapons: 4,  defense: 4,  sensors: 2, tac: '6/10', tacTrained: '8/15', hardness: 20, hardStr: '20/1D ballistic; 40/2D energy (Deflective)', crew: 1, lw: '32 ft / 18 tons', dc: 48, restriction: 'Mil (+3)' },
  'Corvette':        { cls: 'Light', ts: 6, D: 40,  engineD: '8D',  weapons: 4,  defense: 4,  sensors: 2, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 16,  lw: '320 ft / 3,200 tons', dc: 56, restriction: 'Mil (+3)' },
  'Destroyer':       { cls: 'Light', ts: 6, D: 80,  engineD: '16D', weapons: 8,  defense: 8,  sensors: 2, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 80,  lw: '450 ft / 8,000 tons', dc: 60, restriction: 'Mil (+3)' },
  'Frigate':         { cls: 'Light', ts: 6, D: 60,  engineD: '12D', weapons: 6,  defense: 6,  sensors: 2, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 60,  lw: '360 ft / 4,800 tons', dc: 56, restriction: 'Mil (+3)' },
  'Hauler':          { cls: 'Light', ts: 6, D: 36,  engineD: '7D (8D Infrastructure)', weapons: 3, defense: 3, sensors: 2, tac: '2/10', tacTrained: '4/15', hardness: 20, hardStr: '20/4d/1D', crew: 8, lw: '450 ft / 6,000 tons', dc: 56, restriction: 'Res (+2)' },
  'Bulk Freighter':  { cls: 'Mediumweight', ts: 6, D: 125, engineD: '25D', weapons: 5,  defense: 5,  sensors: 3, tac: '2/10', tacTrained: '4/15', hardness: 20, hardStr: '20/4d/1D', crew: 8,   lw: '800 ft / 32,000 tons', dc: 60, restriction: 'Res (+2)' },
  'Clipper':         { cls: 'Mediumweight', ts: 6, D: 150, engineD: '30D', weapons: 6,  defense: 6,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 32,  lw: '850 ft / 27,000 tons', dc: 60, restriction: 'Res (+2)' },
  'Cruiser':         { cls: 'Mediumweight', ts: 6, D: 200, engineD: '40D', weapons: 8,  defense: 8,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 120, lw: '720 ft / 28,800 tons', dc: 64, restriction: 'Mil (+3)' },
  'Strike Cruiser':  { cls: 'Mediumweight', ts: 7, D: 250, engineD: '50D', weapons: 10, defense: 10, sensors: 3, tac: '2/20', tacTrained: '4/25', hardness: 40, hardStr: '40/8d/2D', crew: 160, lw: '950 ft / 38,000 tons', dc: 68, restriction: 'Mil (+3)' },
  'Battleship':      { cls: 'Heavy', ts: 6, D: 400, engineD: '80D',  weapons: 8,  defense: 8,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 400, lw: '1,250 ft / 125,000 tons', dc: 72, restriction: 'Mil (+3)' },
  'Fleet Carrier':   { cls: 'Heavy', ts: 6, D: 300, engineD: '60D',  weapons: 6,  defense: 6,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 320, lw: '1,400 ft / 140,000 tons', dc: 72, restriction: 'Mil (+3)' },
  'Heavy Transport': { cls: 'Heavy', ts: 6, D: 350, engineD: '70D',  weapons: 7,  defense: 7,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 24,  lw: '1,320 ft / 120,000 tons', dc: 68, restriction: 'Res (+2)' },
  'Tanker':          { cls: 'Heavy', ts: 6, D: 250, engineD: '50D',  weapons: 5,  defense: 5,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 32,  lw: '1,200 ft / 120,000 tons', dc: 64, restriction: 'Res (+2)' },
  'Battle Cruiser':  { cls: 'Heavy', ts: 7, D: 500, engineD: '100D', weapons: 10, defense: 10, sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 320, lw: '1,360 ft / 140,000 tons', dc: 72, restriction: 'Mil (+3)' },
  'Liner':           { cls: 'Heavy', ts: 7, D: 250, engineD: '50D',  weapons: 5,  defense: 5,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 200, lw: '1,200 ft / 84,000 tons', dc: 72, restriction: 'Res (+2)' },
  'Colony Ship':     { cls: 'Superheavy', ts: 7, D: 600,  engineD: '120D', weapons: 6,  defense: 6,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 400,  lw: '2,000 ft / 400,000 tons', dc: 72, restriction: 'Res (+2)' },
  'Dreadnought':     { cls: 'Superheavy', ts: 7, D: 1000, engineD: '200D', weapons: 10, defense: 10, sensors: 3, tac: '2/20', tacTrained: '4/25', hardness: 40, hardStr: '40/8d/2D', crew: 2000, lw: '2,750 ft / 540,000 tons', dc: 80, restriction: 'Mil (+3)' },
  'Star Carrier':    { cls: 'Superheavy', ts: 7, D: 800,  engineD: '160D', weapons: 8,  defense: 8,  sensors: 3, tac: '2/20', tacTrained: '4/25', hardness: 40, hardStr: '40/8d/2D', crew: 2400, lw: '3,000 ft / 600,000 tons', dc: 80, restriction: 'Mil (+3)' },
  'Star Freighter':  { cls: 'Superheavy', ts: 7, D: 750,  engineD: '150D', weapons: 7,  defense: 7,  sensors: 3, tac: '2/15', tacTrained: '4/20', hardness: 30, hardStr: '30/6d/1D', crew: 40,   lw: '2,200 ft / 320,000 tons', dc: 76, restriction: 'Res (+2)' },
};
const STARSHIP_ENGINES = [
  { name: 'Thrusters', ts: 5, minSize: 'Huge', bonus: '+0 ft', dc: '10 + ½ base ship', note: 'Atmospheric-capable; refuel after every battle/orbit (fuel DC 31). Every ship carries them.' },
  { name: 'Fusion Torch', ts: 6, minSize: 'Gargantuan', bonus: '+500 ft', dc: '10 + ½ base ship', note: 'Space-only exhaust — pair with thrusters for atmosphere.' },
  { name: 'Ion Engine', ts: 6, minSize: 'Huge', bonus: '+500 ft', dc: '15 + ½ base ship' },
  { name: 'Photon Sails', ts: 6, minSize: 'Gargantuan', bonus: '+0 ft', dc: '10 + ½ base ship' },
  { name: 'Induction Engine', ts: 7, minSize: 'Huge', bonus: '+1,000 ft', dc: '15 + ½ base ship' },
  { name: 'Particle Impulse Engine', ts: 7, minSize: 'Gargantuan', bonus: '+1,000 ft', dc: '10 + ½ base ship' },
  { name: 'Gravitic Redirector', ts: 8, minSize: 'Colossal', bonus: '+1,500 ft', dc: '10 + ½ base ship' },
  { name: 'Inertial Flux Engine', ts: 8, minSize: 'Gargantuan', bonus: '+1,500 ft', dc: '15 + ½ base ship' },
  { name: 'Spatial Compressor', ts: 9, minSize: 'Colossal', bonus: '+2,000 ft', dc: '10 + ½ base ship' },
];
const STARSHIP_ARMOR = [
  { name: 'Alloy Plating', ts: 5, hardness: '20/4d/1D', speedPen: '−500 ft', weight: '⅛ ship', dc: '15 + ½ ship', restriction: '—' },
  { name: 'Polymeric', ts: 6, hardness: '20/4d/1D', speedPen: '—', weight: '1/10 ship', dc: '10 + ½ ship', restriction: 'Lic (+1)' },
  { name: 'Vanadium', ts: 6, hardness: '30/6d/1D', speedPen: '—', weight: '⅛ ship', dc: '15 + ½ ship', restriction: 'Mil (+3)' },
  { name: 'Cerametal', ts: 7, hardness: '30/6d/1D', speedPen: '—', weight: '⅛ ship', dc: '10 + ½ ship', restriction: 'Lic (+1)' },
  { name: 'Deflective', ts: 7, hardness: '20/4d/1D ballistic; 40/8d/2D energy', speedPen: '—', weight: '1/10 ship', dc: '15 + ½ ship', restriction: 'Mil (+3)' },
  { name: 'Neutronite', ts: 7, hardness: '40/8d/2D', speedPen: '−500 ft', weight: '¼ ship', dc: '15 + ½ ship', restriction: 'Mil (+3)' },
  { name: 'Ablative', ts: 8, hardness: '40/8d/2D', speedPen: '—', weight: '1/10 ship', dc: '15 + ½ ship', restriction: 'Mil (+3)' },
  { name: 'Nanofluidic', ts: 8, hardness: '50/10d/2D', speedPen: '−500 ft', weight: '¼ ship', dc: '15 + ½ ship', restriction: 'Mil (+3)' },
];
// FF pp.644-649 (09-07): every ranged weapon system — one stat string each
// (dmg [capital dice] · type · crit · range increment [stellar hexes] · RoF ·
// minimum ship size · DC · restriction). AA = ignores 1D hardness. Missile
// speed = 5K ft per MOVE action, 10K ft (40 hexes)/round (ruled 2026-09-07).
const STARSHIP_WEAPONS = [
  { name: 'Fusion Beam', ts: 6, mss: 'Gargantuan', dc: 36, stat: '10d8 [1d4D] Plasma (ignores hardness) · crit 20 · RI 2K ft [8 hx] · Single · Mil (+3)' },
  { name: 'Gauss Gun', ts: 6, mss: 'Gargantuan', dc: 34, stat: '12d6 [1d4D] Ballistic · crit 20 · RI 4K ft [16 hx] · Single · Res (+2)' },
  { name: 'Laser', ts: 6, mss: 'Huge', dc: 29, stat: '8d8 [1d3D] Laser · crit 20 · RI 5K ft [20 hx] · Single/Auto · Lic (+1)' },
  { name: 'Laser, Heavy', ts: 6, mss: 'Gargantuan', dc: 31, stat: '10d8 [1d4D] Laser · crit 20 · RI 6K ft [24 hx] · Single [S/A adv.] · Res (+2)' },
  { name: 'Mine, Fusion', ts: 6, mss: 'Colossal', dc: 34, stat: '5d100 [2d12D] Plasma · hex + adjacent · Mil (+3)' },
  { name: 'Missile, CHE', ts: 6, mss: 'Gargantuan', dc: 25, stat: '12d6 [1d3D] Energy · crit 19-20 · 5K ft/move [20 hx] · Single/Volley · Mil (+3)' },
  { name: 'Missile, KE Submunition', ts: 6, mss: 'Gargantuan', dc: 22, stat: '8d12 [1d4D] Ballistic · crit 19-20 · 5K ft/move · Single/Volley · ½ dmg vs Hardness 20+ armor · Lic (+1)' },
  { name: 'Missile, Nuclear', ts: 6, mss: 'Gargantuan', dc: 45, stat: '10d12 [1d6D] Energy · crit 19-20 · 5K ft/move · Single/Volley · Mil (+3)' },
  { name: 'Needle Driver', ts: 6, mss: 'Gargantuan', dc: 35, stat: '8d12 [1d4D] Ballistic · crit 20 · RI 4K ft [16 hx] · Single/Auto · Lic (+1)' },
  { name: 'Neutron Gun', ts: 6, mss: 'Gargantuan', dc: 28, stat: '8d8 [1d3D] AA Energy (ignores 1D hardness; ×2 vs force fields) · crit 20 · RI 3K ft [12 hx] · Single · Mil (+3)' },
  { name: 'Neutron Gun, Heavy', ts: 6, mss: 'Colossal', dc: 30, stat: '10d8 [1d4D] AA Energy · crit 20 · RI 4K ft [16 hx] · Single · Mil (+3)' },
  { name: 'Rail Cannon', ts: 6, mss: 'Gargantuan', dc: 28, stat: '6d12 [1d3D] Ballistic · crit 20 · RI 3K ft [12 hx] · Single/Auto · Lic (+1)' },
  { name: 'Antimatter Gun', ts: 7, mss: 'Colossal', dc: 38, stat: '10d8 [1d4D] Energy · crit 19-20 · RI 5K ft [20 hx] · Single · Mil (+3)' },
  { name: 'Ion Cannon', ts: 7, mss: 'Gargantuan', dc: 39, stat: '10d6 [1d3D] Ionic (nonlethal, ignores hardness, ×2 vs force fields — 09-07 amendment) · crit 20 · RI 3K ft · Single [S/A adv.] · Lic (+1)' },
  { name: 'Mass Cannon', ts: 7, mss: 'Gargantuan', dc: 37, stat: '8d12 [1d4D] Ballistic · crit 20 · RI 5K ft [20 hx] · Single/Auto · Lic (+1)' },
  { name: 'Mass Cannon, Heavy', ts: 7, mss: 'Gargantuan', dc: 40, stat: '10d12 [1d6D] Ballistic · crit 20 · RI 6K ft [24 hx] · Single/Auto · Res (+2)' },
  { name: 'Mine, Gravitic', ts: 7, mss: 'Colossal', dc: 43, stat: '10d100 [4d12D] Energy · 4-polyhex (37 hexes) · Mil (+3)' },
  { name: 'Missile, Mass Reaction', ts: 7, mss: 'Colossal', dc: 50, stat: '12d12 [2d4-1D] Energy · crit 19-20 · 5K ft/move · Single/Volley · Mil (+3)' },
  { name: 'Missile, Plasma', ts: 7, mss: 'Gargantuan', dc: 46, stat: '16d8 [1d6D] Plasma (ignores hardness) · crit 19-20 · 5K ft/move · Single/Volley · Mil (+3)' },
  { name: 'Particle Beam', ts: 7, mss: 'Gargantuan', dc: 39, stat: '12d8 [1d4D] AA Energy · crit 20 · RI 4K ft [16 hx] · Single · Res (+2)' },
  { name: 'Particle Beam, Heavy', ts: 7, mss: 'Colossal', dc: 44, stat: '16d8 [1d6D] AA Energy · crit 20 · RI 5K ft [20 hx] · Single · Mil (+3)' },
  { name: 'Plasma Cannon', ts: 7, mss: 'Gargantuan', dc: 40, stat: '14d8 [2d3-1D] Plasma (ignores hardness) · crit 20 · RI 3K ft · Single [S/A adv.] · Res (+2)' },
  { name: 'Plasma Cannon, Heavy', ts: 7, mss: 'Colossal', dc: 44, stat: '18d8 [2d4-1D] Plasma · crit 20 · RI 4K ft · Single [S/A adv.] · Mil (+3)' },
  { name: 'Quantum Cannon', ts: 7, mss: 'Gargantuan', dc: 45, stat: '12d8 [1d4D] Energy (ignores force fields; +20 to hit, no auto-miss on nat 1 — 09-07 amendment) · crit 20 · RI 6K ft [24 hx] · Single · Mil (+3)' },
  { name: 'Antimatter Cannon', ts: 8, mss: 'Colossal', dc: 40, stat: '10d12 [1d6D] Energy · crit 18-20 · RI 6K ft [24 hx] · Single · Mil (+3)' },
  { name: 'Ion Cannon, Heavy', ts: 8, mss: 'Colossal', dc: 41, stat: '16d6 [1d4D] Ionic (as Ion Cannon: nonlethal, ignores hardness, ×2 vs force fields) · crit 20 · RI 4K ft [16 hx] · Single [S/A adv.] · Res (+2)' },
  // v8.75.0 (Adam's secondary-finding rulings, 2026-10-03 — HELM-calibrated):
  // Kinetic Lance was range-starved (RI 12 hx = shortest TS-8; lost 83-98%
  // to every kinetic on the approach despite healthy mirror lethality) →
  // RI 3K → 5K ft; damage and DC untouched. Maser Cannon was strictly
  // dominated by the Antimatter Cannon at a higher price (slowest TS-8
  // mirror) → DC 42 → 40 + crit 19-20 (thermal bloom); it also inherits the
  // TS-8 fighter-gun niche from the Sliver's Colossal eviction. Book
  // letters on the TODO.
  { name: 'Kinetic Lance', ts: 8, mss: 'Colossal', dc: 42, stat: '10d12 [1d6D] Energy (×2 vs force fields) · crit 20 · RI 5K ft [20 hx] · Single · Mil (+3)' },
  { name: 'Maser Cannon', ts: 8, mss: 'Gargantuan', dc: 40, stat: '14d8 [2d3-1D] Energy · crit 19-20 · RI 6K ft [24 hx] · Single/Auto · Res (+2)' },
  // v8.76.0 (Adam's extrapolation, 2026-10-03): the Maser Cannon's §210
  // treatment carried to its heavy sibling — DC −2 (45 → 43) and thermal
  // bloom crit 19-20. Book letter on the TODO; HELM R35 addendum.
  { name: 'Maser Cannon, Heavy', ts: 8, mss: 'Colossal', dc: 43, stat: '18d8 [2d4-1D] Energy · crit 19-20 · RI 8K ft [32 hx] · Single [S/A adv.] · Mil (+3)' },
  { name: 'Mine, Zero Point', ts: 8, mss: 'Colossal', dc: 48, stat: '15d100 [6d12D] Energy · Mil (+3)' },
  { name: 'Missile, Nova Burst', ts: 8, mss: 'Gargantuan', dc: 45, stat: '20d8 [1d8D] Plasma · crit 19-20 · 5K ft/move · Single/Volley · Mil (+3)' },
  { name: 'Missile, Starload', ts: 8, mss: 'Huge', dc: 45, stat: '20d8 [1d8D] Energy · crit 18-20 · 5K ft/move · Single/Volley · Mil (+3)' },
  { name: 'Neutronium Driver', ts: 8, mss: 'Colossal', dc: 42, stat: '12d12 [2d4-1D] Ballistic · crit 20 · RI 5K ft [20 hx] · Single · Res (+2)' },
  // v8.75.0 (Adam's Sliver rebalance, 2026-10-03 — HELM-calibrated): AA capped
  // at the printed 20 (mastercrafted flechettes, R31 ladder does NOT apply);
  // lingering magnetic resonance = auto-confirm only from a rested barrel, no
  // autofire, 1 round's rest dissipates; capacitor banks demand Colossal; DC
  // 39 → 42. Book letter on the TODO; HELM R34.
  { name: 'Sliver Gun', ts: 8, mss: 'Colossal', dc: 42, stat: '8d12 [1d4D] AA Ballistic (AA capped at 20 HP / 4d / 1D — the mastercrafted flechettes never exceed the printed figure) · auto-confirms crits from a RESTED barrel only (lingering magnetic resonance: consecutive-round fire confirms normally; one round without firing dissipates it) · crit 19-20 · RI 7K ft [28 hx] · Single · Mil (+3)' },
  { name: 'Zero Bore', ts: 8, mss: 'Colossal', dc: 52, stat: '16d8 [2d4-1D] Disintegration (ignores hardness; ×2 vs force fields) · crit 20 · RI 6K ft [24 hx] · Single · Mil (+3)' },
  { name: 'Blacklaser', ts: 9, mss: 'Huge', dc: 50, stat: '16d8 [2d4-1D] Energy · crit 20 · RI 8K ft [32 hx] · Single/Auto · Mil (+3)' },
  { name: 'Mine, Null', ts: 9, mss: 'Colossal', dc: 53, stat: '20d100 [5d20D] Disintegration (ignores hardness) · 4-polyhex · Mil (+3)' },
  { name: 'Singularity Cannon', ts: 9, mss: 'Colossal', dc: 53, stat: '20d8 [1d8D] Disintegration · crit 19-20 · RI 5K ft [20 hx] · Single · Mil (+3)' },
  { name: 'String Projector', ts: 9, mss: 'Colossal', dc: 54, stat: '12d12 [2d4-1D] Energy · crit 20 · RI 6K ft [24 hx] · Single · unshielded hit damages facing flank + opposite flank + IS (×3!) · Mil (+3)' },
  { name: 'Tachyon Gun', ts: 9, mss: 'Gargantuan', dc: 52, stat: '16d8 [1d6D] Energy (ignores force fields) · crit 20 · RI 10K ft [40 hx] · Single · Mil (+3)' },
  { name: 'Grapplers', ts: 5, mss: 'Huge', dc: null, stat: 'Grappling system (counts as a weapon slot) — latch via Pilot check (DC by target size + touch AC); DC 10 + ½ base ship' },
  { name: 'Tractor Beam Emitter', ts: 7, mss: 'Colossal', dc: null, stat: 'Grappling system (counts as a weapon slot) — ranged-attack gravity tether; immobilizes smaller ships; DC 15 + ½ base ship · Lic (+1)' },
];
// v9.8.0 (§258) — THE MOUNT ECONOMY (FF p.640; GMG p.474; HELM v0.10.0 twin).
// A starship beam/projectile weapon's printed Purchase DC buys a FULL TURRET
// or bank firing in any direction. Optional mounts trade coverage for cost:
// CUPOLA = two ADJACENT arcs (Fore/Starboard, Fore/Port, Aft/Starboard,
// Aft/Port — never Port/Starboard or Fore/Aft) at −1 DC; FIXED turret = one
// arc at −2 DC. GMG p.474: a statblock printing no arc is a full turret, so
// stock FF ships are all-turret as printed. MISSILES: always omni — the FF
// prints no missile mount text; a missile mount option AWAITS ADAM'S RULING
// (proposed: omni only, no discount). Mines are deployed and grapple systems
// latch — neither takes a mount.
const SHIP_MOUNT_KINDS = {
  turret: { label: 'Turret / bank', disc: 0, icon: '⌖' },
  cupola: { label: 'Cupola', disc: -1, icon: '◧' },
  fixed: { label: 'Fixed mount', disc: -2, icon: '▮' },
};
const SHIP_CUPOLA_PAIRS = ['Fore/Starboard', 'Fore/Port', 'Aft/Starboard', 'Aft/Port'];
const SHIP_FIXED_ARCS = ['Fore', 'Starboard', 'Port', 'Aft'];
function shipWeaponTakesMount(name) { return !/^(Missile|Mine),/.test(name) && name !== 'Grapplers' && name !== 'Tractor Beam Emitter'; }
function shipMountOf(line) {
  const kind = SHIP_MOUNT_KINDS[line.mount] ? line.mount : 'turret';
  return Object.assign({ kind, arcs: line.arcs || [] }, SHIP_MOUNT_KINDS[kind]);
}
// The chip a restricted mount wears on its loadout row and the print sheet (arcs by initial: F/S/P/A).
function shipMountChip(line) {
  const m = shipMountOf(line);
  return m.kind === 'turret' ? '' : `${m.icon} ${m.kind} ${m.arcs.map(a => a[0]).join('/')} (${m.disc} DC)`;
}
// v9.9.0 (§259) — FIRE-LINKED WEAPONS, MAIN CANNONS & MISSILE BATTERIES
// (FF pp.641-642; HELM ship.ts linked/battery twin, RULINGS.md I16).
// FIRE LINKS: identical beam/projectile weapons firing as ONE weapon (one
// attack roll). Each full DOUBLING (×2, ×4, ×8…) = +½ base damage, +1 weapon
// size category, +3 Purchase DC (the FF p.642 worked example: Ion Cannon 39 →
// dual 42 → quad 45 → octo Main 48). I16 ceiling: the grown weapon must still
// fit the hull — max link = 2^(hull size step − weapon minimum size step).
// VARIABLE links (quad+): the gunner may fire singly, in pairs, or full.
// MAIN CANNON = octo-linked (×8) or higher; power demands allow ONE per ship;
// +1 threat range; may fire at 25% (dual-equiv) or 50% (quad-equiv) power;
// always a SINGLE rate of fire. MISSILE BATTERIES: up to 4 identical
// launchers as one weapon; +2 DC per launcher; +1 threat per missile past the
// first (max +3); crit multiplier +1 per extra missile; one size larger than
// the base weapon — Colossal (Light)+ hulls only; never split.
const SHIP_SIZE_LADDER = ['Huge', 'Gargantuan', 'Colossal (Ultralight)', 'Colossal (Light)', 'Colossal (Mediumweight)', 'Colossal (Heavy)', 'Colossal (Superheavy)'];
function shipHullSizeStep(cls) { return { Ultralight: 2, Light: 3, Mediumweight: 4, Heavy: 5, Superheavy: 6 }[cls] ?? 2; }
function shipWeaponSizeStep(mss) { return { Huge: 0, Gargantuan: 1, Colossal: 2 }[mss] ?? 1; }
// Leading pips dice of a stat string ("10d6 [1d3D] Ionic…"), scaled by the
// link factor (2+doublings)/2 — 10d6 ×2 → 15d6, ×4 → 20d6, ×8 → 25d6.
function shipLinkedDice(stat, link) {
  const m = /^(\d+)d(\d+)/.exec(String(stat || ''));
  if (!m) return null;
  const d = Math.round(Math.log2(link)), n = parseInt(m[1], 10) * (2 + d) / 2;
  return Number.isInteger(n) ? `${n}d${m[2]}` : `${m[1]}d${m[2]} ×${(2 + d) / 2}`;
}
// Threat range from a stat string, widened by +w (main cannon +1; battery +1
// per extra missile, max +3). "crit 20" +1 → "19-20".
function shipThreatRange(stat, w) {
  const m = /crit (\d+)/.exec(String(stat || ''));
  const lo = m ? parseInt(m[1], 10) : 20;
  const lo2 = Math.max(2, lo - (w || 0));
  return lo2 >= 20 ? '20' : `${lo2}-20`;
}
function shipLinkOf(line) { const l = parseInt(line && line.link, 10); return (l >= 2) ? l : 1; }
function shipBatteryOf(line) { const b = parseInt(line && line.battery, 10); return (b >= 2) ? Math.min(b, 4) : 1; }
// One main cannon (×8+) per ship — FF p.642's power-demand rule.
function shipHasMainCannon(it) { return paLoadout(it).some(l => shipLinkOf(l) >= 8); }
// The link ladder a weapon may climb on this hull: ×1 up to the I16 ceiling.
function shipLinkOptions(def, wep, hasMain) {
  const ceil = Math.max(0, shipHullSizeStep(def.cls) - shipWeaponSizeStep(wep.mss));
  const out = [];
  for (let d = 0; d <= ceil; d++) {
    const link = Math.pow(2, d);
    if (link >= 8 && hasMain) break; // power demands: one main cannon per ship
    out.push({
      link, doublings: d, main: link >= 8,
      dc: (wep.dc || 0) + 3 * d,
      dice: shipLinkedDice(wep.stat, link),
      size: SHIP_SIZE_LADDER[shipWeaponSizeStep(wep.mss) + d] || 'beyond Colossal (Superheavy)',
    });
  }
  return out;
}
// The chips a linked weapon / battery wears beside the mount chip.
function shipLinkChip(line) {
  const link = shipLinkOf(line);
  if (link < 2) return '';
  return link >= 8 ? `★ main cannon ×${link}` : `⛓ ×${link} link${line.variable ? ' (variable)' : ''}`;
}
function shipBatteryChip(line) {
  const n = shipBatteryOf(line);
  return n < 2 ? '' : `⧉ battery ×${n}`;
}
const STARSHIP_DEFENSES = [
  ['Autopilot System', 5, '5 + ¼ ship', '—'], ['Damage Control System', 5, 'varies', '—'], ['Sensor Jammer', 5, '5 + ½ ship', 'Mil (+3)'],
  ['Autopilot System, Improved', 6, '5 + ½ ship', '—'], ['Chaff Launcher', 6, '20', 'Lic (+1)'], ['Damage Control, Improved', 6, 'varies', 'Lic (+1)'],
  ['Decoy Drone Launcher', 6, '28', 'Res (+2)'], ['Hardened Circuitry', 6, '10 + ½ ship', '—'], ['Magnetic Field Generator', 6, '5 + ½ ship', 'Mil (+3)'],
  ['Point-Defense System', 6, 'varies', 'Lic (+1)'], ['Radiation Shielding', 6, '5 + ½ ship', '—'], ['Self-Destruct System', 6, 'varies', 'Res (+2)'],
  ['Stealth Screen', 6, '10 + ½ ship', 'Mil (+3)'], ['Autopilot, Artificially Intelligent', 7, 'varies (as Robot)', '—'], ['Displacer ECM System', 7, '10 + ½ ship', 'Mil (+3)'],
  ['Force Field Generators', 7, '15 + ½ ship', '—'], ['Light Fortification', 7, '10 + ½ ship', 'Lic (+1)'], ['Particle Field Generator', 7, '10 + ½ ship', 'Mil (+3)'],
  ['Repair Drones', 7, '15 + ½ ship', 'Mil (+3)'], ['Cloaking Screen', 8, '15 + ½ ship', 'Mil (+3)'], ['Damage Control, Advanced', 8, '10 + ½ ship', 'Mil (+3)'],
  ['Medium Fortification', 8, '10 + ½ ship', 'Lic (+1)'], ['Nanite Repair Array', 8, '10 + ½ ship', 'Res (+2)'], ['Nano-Hardened Circuitry', 8, '15 + ½ ship', 'Mil (+3)'],
  ['Point-Defense System, Improved', 8, 'varies', 'Res (+2)'], ['Heavy Fortification', 9, '10 + ½ ship', 'Lic (+1)'],
].map(([name, ts, dc, restriction]) => ({ name, ts, dc, restriction }));
const STARSHIP_SENSORS = [
  ['Class I Sensor Array', 5, '21'], ['Class II Sensor Array', 6, '27'], ['Class III Sensor Array', 6, '30'], ['Targeting System', 6, 'varies'],
  ['Class IV Sensor Array', 7, '33'], ['Class V Sensor Array', 7, '36'], ['Quantum Disentangler ECCM Suite', 7, '35'], ['Targeting System, Improved', 7, 'varies'],
  ['Class VI Sensor Array', 8, '39'], ['Class VII Sensor Array', 8, '42'], ['Achilles Targeting Software', 8, 'varies'], ['Crackerjack Neural Link (ship)', 8, '15 + ½ ship'],
  ['Class VIII Sensor Array', 9, '45'], ['Class IX Sensor Array', 9, '48'],
].map(([name, ts, dc]) => ({ name, ts, dc }));
const STARSHIP_COMMS = [
  ['Radio Transceiver', 5, 'Speed of light · LOS/omni', '21'], ['Laser Transceiver', 6, 'Speed of light · unidirectional (secure)', '23'],
  ['Drivesat Comm Array', 7, '5 ly/hr · Colossal (Med+) only', '53'], ['Mass Transceiver', 7, 'Instantaneous · 100 AU max', '25'],
  ['Drive Transceiver', 8, '5 ly/hr · 50 ly max', '28'], ['Ansible', 9, 'Instantaneous · unlimited (secure)', '33'],
].map(([name, ts, range, dc]) => ({ name, ts, range, dc }));
// ============================================================================
// v8.26.0 MECHA/STARSHIP PASS 2 (Adam's go, 2026-09-06).
// STARSHIP_SYSTEM_FX: per-system effect prose extracted from FF pp.647-663 (09-07)
// (single-column section — naive dump, table rows filtered). Retires the
// pass-1 'details FF pp.649-656 — table-level this pass' placeholder.
const STARSHIP_SYSTEM_FX = {
 "Autopilot System": "An autopilot system “kicks in” whenever the pilot is unable to fly the starship. An autopilot system isn’t as good at avoiding attacks as a living pilot, but it’s better than nothing. Larger vessels have more adaptive autopilot systems than smaller ships (although this increased sophistication doesn’t outweigh the penalties associated with the ships’ larger sizes). Note that the autopilot system is available only if the starship’s sensors are operational; a blind starship cannot rely on its autopilot system. An autopilot system provides an equipment bonus to the starship’s touch Armor Class depending on the ship’s size: Huge +3, Gargantuan +2, Colossal +1. This bonus applies only when the autopilot system is engaged. Purchase DC: 5 + one-quarter the base purchase DC of the starship. Restriction: None.",
 "Damage Control System": "A starship equipped with a damage control system can attempt damage control as a free action once per round. With a successful Repair check (DC 15), the ship regains a number of capital dice depending on its type, as shown on Table: Damage Control Systems. Damage control can only be performed on a starship with damage to its Infrastructure, and it cannot be performed if the ship has been reduced to negative hit points. Purchase DC: Varies by starship type (see Table: Damage Control Systems). Restriction: None. Ship Type Infrastructure Restored Purchase DC Ultralight 0-1(1d2-1)D 18 Light 1D 22 Mediumweight 1d2D 27 Heavy 2D 33 Superheavy 1d2+1D 40",
 "Sensor Jammer": "A sensor jammer interferes with radar and enemy sensor scans. It also confounds missile guidance systems. Sensor checks made against a ship with an active sensor jammer take a –5 penalty. In addition, the ship gains one- half concealment against missile attacks (20% miss chance). Any ship with a Class III sensor system (or better) is not subject to the effects of the sensor jammer, ignoring the penalty and miss chance. Purchase DC: 5 + one-half the base purchase DC of the starship. Restriction: Military (+3).",
 "Autopilot System, Improved": "An improved autopilot system provides an equipment bonus to the starship’s touch Armor Class depending on the ship’s size: Huge +5, Gargantuan +4, Colossal +3. This bonus applies only when the autopilot system is engaged. An improved autopilot system replaces the TS 5 autopilot system. Purchase DC: 5 + one-half the base purchase DC of the starship. Restriction: None.",
 "Chaff Launcher": "Chaff consists of a cloud of millions of tiny metal strips or particles. This detritus interferes with sensors and missiles. Deploying chaff— usually via a small bundle from the rear or underside of a starship—is a move action. The chaff fills roughly a 500-foot radius (a 2-polyhex space) with these strips or particles. Sensor scans directed at anything within the polyhex take a –10 penalty, and to scan something on the direct opposite side of the chaff field incurs a –5 penalty. Any missile that passes through the chaff field to reach its intended target suffers a 20% miss chance. Purchase DC: 20 for chaff launcher and one chaff bundle, 15 for each additional chaff bundle. Restriction: Licensed (+1).",
 "Damage Control, Improved": "A starship equipped with improved damage control repairs more damage each time damage control is performed successfully (see Damage Control System, above). Purchase DC: 5 + the purchase DC of a standard damage control system. Restriction: Licensed (+1). Ship Type Infrastructure Restored Purchase DC Ultralight 1D 18 Light 1d2D 22 Mediumweight 2D 27 Heavy 1d2+1D 33 Superheavy 1d3+1D 40",
 "Decoy Drone Launcher": "A decoy drone is a small, self-guided missile that mimics the electromagnetic and infrared signatures of the ship that launched it. Deploying a decoy drone is an attack action, and the drone occupies the same fighting space as the ship it imitates. The decoy drone negates the equipment bonus on attack rolls granted by an enemy ship’s targeting system. Launching multiple decoy drones grants no cumulative effect. A deployed and intact decoy drone can be recovered or captured with a successful grapple. It can also be targeted and destroyed. A decoy drone has a Defense of 12 and 10 hit points, and it rolls 1d20+4 on opposed grapple checks. Purchase DC: 28 for drone launcher and one drone, 25 for each additional drone. Restriction: Restricted (+2).",
 "Hardened Circuitry": "A starship completely equipped with hardened circuitry has resistance to electricity 20/1D. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: None.",
 "Magnetic Field Generator": "The magnetic field is the first primitive energy shield. It uses vast amounts of power to surround the ship with potent lines of magnetic force. Missiles and weapons that deal ballistic damage fired at a starship with a magnetic field have a 20% miss chance. A mine can be equipped with a magnetic field. Purchase DC: 5 + one-half the base purchase DC of the starship or mine. Restriction: Military (+3).",
 "Point-defense System": "A point-defense system serves two functions: It targets all incoming missiles, and it allows a starship to make at least one attack of opportunity against every enemy ship passing through its threatened area. The point-defense system consists of batteries of automated weapons programmed to fire when either of these two conditions is 653 met. The larger the ship with the point-defense system, and the larger the ship passing through its threatened area, the more turrets of the point-defense system can be brought to bear against the intruding ship (see below). A point-defense system does not fire upon mines, cannot be controlled manually by the crew, and cannot be used to make normal attacks. Only Colossal size starships can have point-defense systems. A point-defense system requires access to at least one operational sensor system to be usable. Destroy Missiles: A point-defense system has a 20% chance of destroying any incoming missile (roll once for an entire missile barrage). A destroyed missile (barrage) deals no damage to the ship. Make Attacks of Opportunity: A starship equipped with a point-defense system threatens the space it occupies as well as all adjacent 250-foot hexes. A starship with a point-defense system can get up to 5 attacks with a point- defense system, depending on the size of the ship with the point-defense system and the size of the ship incurring the attack of opportunity (see the chart below), whenever an attack of opportunity is incurred. When making an attack of opportunity, the point-defense system rolls 1d20 and adds the ship’s targeting system bonus on the roll. If the result equals or exceeds the enemy ship’s Armor Class, the point-defense weapons deal 1d12x10 (1d6D) ballistic damage based on the ship’s type, as shown in Table: Point-Defense Systems. Point-defense systems cannot score critical hits. “Broadside” Offensive Protocol: If so desired, a point-defense system’s defensive protocols can be replaced with an offensive protocol, wherein any ships that are passed by within 1 hex / 250’ are attacked by point-defense system, just as if an attack of opportunity was being incurred by the other ship. However, until the beginning of the ship’s next round, the point-defense system does not shoot down missiles, nor does it launch attacks of opportunity, as its systems are already occupied with broadside attacks. Purchase DC: Varies by starship type (see Table: Point-Defense Systems). Restriction: Licensed (+1). Starship Type # of Attacks of Opportunity (on Colossal scale) Purchase DC Ultralight 1 (doing 1d12x10 / 1d6D ballistic damage, no crits) 31 Light 1 vs. Ultralight or smaller, 2 vs. Light or larger 34 Mediumweight 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight or larger 36 Heavy 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight, 4 vs. Heavy 38 or Superheavy Superheavy 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight, 4 vs. 40 Heavy, 5 vs. Superheavy",
 "Radiation Shielding": "Radiation shielding protects a ship’s crew and passengers against the harmful radiation of neutron stars, solar flares, and other external causes. All personnel aboard the ship gain a +5 circumstance bonus on saves to resist the effects of radiation poisoning. Purchase DC: 5 + one-half the base purchase DC of the starship. Restriction: None.",
 "Self-destruct System": "A self-destruct system ensures that a starship cannot be captured, dissected for information, or used against its builders. Installing a starship self-destruct system requires a Demolitions check (DC 30) instead of a Craft check and takes an amounts of time as determined by the ship’s type: ultralight 1 hour, light 10 hours, mediumweight 30 hours, heavy 60 hours, superheavy 120 hours. If the Demolitions check fails by 10 or more, the system detonates, destroying the ship and possibly harming others nearby. A self-destruct system can be programmed to activate only under specified conditions—usually the voice authorization of the ship’s commander, and usually only after the crew has had sufficient time to evacuate (see Starship Evacuation). The self-destruct system obliterates the starship (killing all aboard) regardless of how many hit points it has remaining. A starship destroyed by its own self-destruct system has no salvageable parts. The starship’s self-destruction triggers a destructive explosion that deals is intended to not only scuttle 654 the starship but also damage any enemies in its vicinity. A self-destructing starship deals explosive (effectively bludgeoning) collateral damage to ships in all adjacent hexes equal to the self-destructing ship’s n-polyhex (so a 6- polyhex superheavy starship’s self-destruct system inflicts collateral damage out 6 hexes in all directions). Every side of any ship caught in the blast takes the damage, and similarly, any ship with a force field takes x1 damage to the force field for every flank caught in the blast, up to x4 damage if",
 "Stealth Screen": "An improved version of the sensor jammer (see above), the stealth screen is a sophisticated electromagnetic transceiver capable of detecting incoming electromagnetic energy from radars, ladars, and other sensor devices. When it detects such energy, it responds by generating an electromagnetic interference pattern. In addition, it monitors the ship’s own EM emissions and cloaks them in a similar manner. Finally, the stealth shield masks the ship’s mass signature. Sensor checks made against a ship with an active stealth screen take a –10 penalty. Additionally, a deployed mine has a 50% chance of not detecting the screened ship as it enters or leaves its detonation area. Finally, a starship with an active stealth screen gains one-half concealment against all attacks (20% miss chance). A mine can be equipped with a stealth screen. Purchase DC: 10 + one-half the base purchase DC of the starship or mine. Restriction: Military (+3).",
 "Autopilot System, Artificially Intelligent": "An artificially-intelligent (AI) autopilot system provides a perpetual pilot / co-pilot / gunner onboard the starship. Build a robot AI as per the Robots section; any investment in a body is stored on board the vessel for the AI, if necessary. The AI autopilot’s bonuses apply only when the autopilot system is engaged; however, the AI can always perform an Aid Another action for any pilot, co-pilot, or gunner controlling a system built into the starship. An AI autopilot system replaces the TS 5 or TS 6 autopilot system. Purchase DC: 10 + one-half the base purchase DC of the starship, plus the cost of the robotic AI (see above). Restriction: As Robot to be installed; see above.",
 "Displacer ECM System": "Using the same technology that will someday drive the TS 9 spatial compression engine, the displacer “blurs” the ship’s electronic and light-reflective signature, casting its image / “shadow” a few hundred yards away several times a second in a random series of short-range quantum entanglements. All enemy attacks originating from more than 500 feet away against the displacing ship have a 30% miss chance, as though it has three-quarters concealment. The displacer has no effect against enemies within 500’ of the displaced ship. A mine can be equipped with a displacer. Purchase DC: 10 + one-half the base purchase DC of the starship or mine. Restriction: Military (+3). 655",
 "Force Field Generators": "Force field generators create a protective force-field around the starship, protecting it from incoming attacks of most types. Force fields also hedge out ethereal attacks and attackers, extending into the Ethereal Plane as well. The potential strength of the force field depends on the size, engine, and restriction class of the starship. Force fields cannot suffer critical hits (although missile batteries inflict more damage; see Missile Batteries, above). Note that the Force Field Generator uses a subspace stabilizing matrix that effectively treats all the space within the shielded area as solid for purposes of teleportation or extradimensional travel; while the force field is intact, anything trying to teleport into or transdimensionally enter the shielded area will be shunted to the closest outside edge of the force field (which is typically into the void of space!). The caliber of Force Field Generators installed on a ship depend on the Restriction code of the ship (round up any fractions to the nearest capital die [D]); - Licensed starships have Force Fields equal to 10% of their total HD / capital dice at full strength; - Restricted starships have Force Fields equal to 20% of their total HD / capital dice at full strength; - Military starships have Force Fields equal to 25% of their total HD / capital dice at full strength. Force field generators also serve as Radiation Shielding (see above), but only while they are active. Force Field Regeneration Rates: A starship’s engines can recharge the ship’s force field capacitors based on how powerful the engine is. The Tech ",
 "Light Fortification": "The starship’s structural integrity is reinforced so that the ship can shake off attacks that would cripple it otherwise. Light fortification converts 25% of all critical hits into regular hits. Installing light fortification requires a Craft (structural) check instead of a Craft (mechanical) check. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: Licensed (+1).",
 "Particle Field Generator": "Generators project a field of alpha particles (helium nuclei that have been stripped of their electrons) around the ship. The field dissipates incoming energy blasts; weapons that wholly or partly deal concussion, electricity, fire, laser, plasma, or nonspecific energy damage (such as beam weapons) fired at the starship take a –4 penalty on attack rolls. A mine can be equipped with a particle field. Purchase DC: 10 + one-half the base purchase DC of the starship or mine. Restriction: Military (+3).",
 "Repair Drones": "Repair drones are Small spiderlike robots that rapidly deploy to damaged sections of a ship’s outer hull. They are programmed to repair damage quickly and efficiently. A drone has hardness equal to half the hardness of the starship that carries it, and HP equal to its hardness. An Ultralight-Colossal starship typically has 4 such drones, a Light-Colossal starship has 8, a Mediumweight-Colossal starship has 16, a Heavy-Colossal starship has 32, and a 656 Superheavy-Colossal starship typically has 64 or more repair drones. A ship with repair drones repairs 1D of damage automatically each round; these repairs stack with any repairs performed by a damage control system. A ship without a damage control system cannot be fitted with repair drones. A starship somehow reduced to less than half of its repair drone contingent only repairs 1D every other round automatically. Purchase DC: 15 + one-half the base purchase DC of the starship. Restriction: Military (+3).",
 "Cloaking Screen": "An improvement of the TS 7 stealth screen, the cloaking screen warps light and energy around the ship’s hull, rendering the ship invisible to visual and electronic sensors. A cloaked ship has total concealment. To attack a cloaked ship, an attacker must guess in which (poly)hex the ship currently is (or determine its position based on where it attacked last), and even if the guess is accurate, there is a 50% chance that the attack misses. Additionally, a deployed mine cannot detect a cloaked ship and does not detonate when the ship enters or leaves its burst area. The ship’s pilot must make a Pilot check (DC 5, +5 per additional mine adjoining hex with another mine, max DC 35) to avoid a collision with the mine if the starship enters the mine’s hex; on a failed check, the mine detonates. A cloaking screen cannot be used in conjunction with chaff, as the chaff cloud would give away the ship’s position. It also cannot operate simultaneously with any sort of field (including force fields, magnetic fields, and particle fields), as the field gives away the ship’s position. A mine can be equipped with a cloaking screen. Purchase DC: 15 + one-half the base purchase DC of the starship or mine. Restriction: Military (+3).",
 "Damage Control, Advanced": "A starship equipped with an advanced damage control system regains an additional +2d10 points / 1D of damage each time damage control is performed successfully (see Damage Control System, above). Advanced damage control stacks with improved damage control. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: Military (+3).",
 "Medium Fortification": "As light fortification (see above), except that the medium fortification system converts 75% of all critical hits into regular hits. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: Licensed (+1).",
 "Nanite Repair Array": "The final refinement of damage control systems, the nanite repair array consists of numerous nodules filled with nanites—microscopic robots—scattered throughout the ship. The nanite repair array can repair a ship with negative hit points; however, not even nanites can repair a destroyed ship. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: Restricted (+2).",
 "Nano-hardened Circuitry": "A starship equipped with nano-hardened circuitry has resistance to electricity 40/2D. Purchase DC: 15 + one-half the base purchase DC of the starship. Restriction: Military (+3).",
 "Point-defense System, Improved": "A point-defense system serves two functions: It targets all incoming missiles, and it allows a starship to make attacks of opportunity against all enemy ships passing through its threatened area. The point-defense system 657 consists of batteries of automated weapons programmed to fire when either of these two conditions is met. A point-defense system does not fire upon mines, cannot be controlled manually by the crew, and cannot be used to make normal attacks. Only Colossal size starships can have point-defense systems. Destroy Missiles: A point-defense system has a 50% chance of destroying any incoming missile (GM’s choice to either roll once for an entire missile battery or roll once for each missile in a barrage). A destroyed missile deals no damage to the ship; a destroyed missile of a battery reduces the threat range and the critical multiplier of the missile battery by one (1) each. (If rolling once for the entire battery, success indicates the whole battery of missiles was destroyed.) Make Attacks of Opportunity: A starship equipped with an improved point-defense system threatens the space it occupies as well as all adjacent 250-foot hexes. When making an attack of opportunity, the point-defense system rolls 1d20 and adds the ship’s targeting system bonus plus its Class Sensor Array rating (Class I [+1] to Class IX [+9]) on the roll. If the result equals or exceeds the enemy ship’s touch Armor Class, the point-defense weapons deal ballistic or energy damage (ship designer’s choice) based on the ship’s type, as shown in Table: Point-Defense Systems. Unlike earlier versions, improved point-defense systems can score critical hits. “Broadside” Offensive Protocol: If so desired, a point-defense system’s defensive protocols can be replaced with an offensive protocol, wherein any ships that are passed by within 1 hex / 250’ are attacked by point-defense system, just as if an attack of opportunity was being incurred by the other ship. However, until the beginning of the ship’s next round, the point-defense system does not shoot down missiles nor does it launch attacks of opportunity, as its systems are already occupied with broadside attacks. Purchase DC: Varies by starship type (see Table: Point-Defense Systems). Restriction: Restricted (+2). Starship Type # of Attacks of Opportunity (on Colossal scale) Purchase DC Ultralight 1 (doing 1d12x10 / 1d6D ballistic or energy damage, crit on 20) 32 Light 1 vs. Ultralight or smaller, 2 vs. Light or larger 35 Mediumweight 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight or larger 37 Heavy 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight, 4 vs. Heavy 39 or Superheavy Superheavy 1 vs. Ultralight or smaller, 2 vs. Light, 3 vs. Mediumweight, 4 vs. 41 Heavy, 5 vs. Superheavy",
 "Heavy Fortification": "As light fortification (see above), except that the heavy fortification system converts all critical hits into regular hits. Purchase DC: 10 + one-half the base purchase DC of the starship. Restriction: Licensed (+1). STARSHIP SENSORS A starship would be lost in the blackness of outer space without a sophisticated sensor array enabling it to perceive its surroundings. Sensor arrays allow a starship’s crew to plot safe courses through unexplored star systems, avoid comets and electromagnetic storms, navigate asteroid belts, analyze planetary surface conditions, detect other starships nearby, and analyze damage to the ship’s outer hull. Without a functional sensor array, a ship and its crew are virtually paralyzed. This section describes several standard sensor arrays. Each sensor array includes a list of functions; each function requires a move action and a successful Computer Use check (DC 15). To build a sensor system from scratch, a character must succeed at a Craft (electronic) check (DC 30) after investing 60 hours in its assembly. A character without an electrical tool kit takes a –4 penalty on the skill check. The character must spend Wealth equal to the sensor system’s base purchase DC. Installing a sensor system requires a successful Craft (electrical) check (DC 30) after investing 30 hours. A character without an electrical tool kit takes a –4 penalty on the skill check. Different types of sensor systems are detailed below. Note that some other systems (like an auto-pilot 658 and/or a point-defense system) are dependent on having a sensor system; if the sensors are",
 "Class I Sensor Array": "This array includes radar, hi-res video, and infrared heat sensor units. As a move action, a Class I sensor array can perform either of the following functions with a successful Computer Use check (DC 15): • Ascertain the location and type (ultralight, light, and so on) of all visible ships on the battlefield (maximum range: 100 miles). • Identify and ascertain the location of all visible hazards on the battlefield (such as asteroids and mines). • Analyze the chemical composition of a planet’s atmosphere (the ship must be orbiting the planet). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 100 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +1). Purchase DC: 21. Restriction: None.",
 "Class II Sensor Array": "This array incorporates hi-res video, infrared and electromagnetic sensors, and ladar detection units. (The ladar uses low-powered laser beams to locate targets.) As a move action, a Class II sensor array can perform any one of the following functions with a successful Computer Use check (DC 15): • Ascertain the location, type (ultralight, light, and so on), and subtype (fighter, destroyer, and so on) of all visible ships on the battlefield (maximum range: 1,000 miles). • Identify and ascertain the location of all visible hazards on the battlefield (such as asteroids and mines). • Identify all TS 5 or TS 6 weapons on a specific ship (number and type of weapons present), including their organization into batteries (but not fire links). • Ascertain the presence of any or all of the following systems on a specific ship: grapplers, magnetic field, point- defense system. • Identify a specific ship’s armor type (TS 5 and TS 6 armor types only). • Analyze the chemical composition of a planet’s atmosphere (the ship must be orbiting the planet). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 1,000 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +2). 659 Purchase DC: 27. Restriction: None.",
 "Class III Sensor Array": "As the Class II sensor array, except that the ship also gains a +2 equipment bonus on all initiative checks. This array is normally installed on ships built for combat (maximum range: 10,000 miles). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 10,000 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +3). Purchase DC: 30. Restriction: None.",
 "Targeting System": "A computerized targeting system helps starship gunners aim weapons and track enemy ships. A targeting system provides an equipment bonus on attack rolls depending on the ship’s size: Huge +1, Gargantuan +2, Colossal +3. The purchase DC of the targeting system depends on the size of the ship. Purchase DC: 18 (Huge), 23 (Gargantuan), or 28 (Colossal). Restriction: Licensed (+1).",
 "Class IV Sensor Array": "This array includes hi-res video, electromagnetic sensors, multiband radar, spectroanalyzers, and mass detectors. (A mass detector locates objects via their gravitational signatures.) As a move action, a Class IV sensor array can perform any one of the following functions with a successful Computer Use check (DC 15): • Ascertain the location, type (ultralight, light, and so on), subtype (fighter, destroyer, and so on), and mass of all visible ships on the battlefield (maximum range: 100,000 miles). • Identify and ascertain the location of all visible hazards on the battlefield (such as asteroids and mines). • Identify all of the TS 5, TS 6, and TS 7 weapons on a specific ship (number and type of weapons present), including their organization as fire-linked weapons and batteries. • Ascertain the presence of any or all of the following systems on a specific ship: grapplers, magnetic field, particle field, point-defense system, tractor beam. • Identify a specific ship’s armor type (TS 5, TS 6, or TS 7 armor types only). • Identify the type of engines a ship has. • Determine the number of life forms aboard a specific ship. • Analyze the chemical composition of a planet’s atmosphere (the ship must be orbiting the planet). • Analyze and chart the topography of a 1,000-square-mile area on a planet’s surface (the ship must be orbiting the planet). • Determine a planet’s prevailing meteorological conditions and weather patterns (must be orbiting the planet). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of ",
 "Class V Sensor Array": "As the Class IV sensor array, except that the ship also gains a +2 equipment bonus on all initiative checks. This array is normally installed on ships built for combat (maximum range: 1,000,000 miles). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 1,000,000 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +5). Purchase DC: 36. Restriction: None.",
 "Quantum Disentangler ECCM Sensor Suite": "A quantum disentangler can locate a starship displaced by a displacer ECM module (see Defensive Systems above), based on the false coordinates being given to its sensor system by the displacer ECM module. The ECCM sensor suite nullifies the 30% miss chance provided by a displacer ECM module with a scan that takes 1 full round to complete and a Computer Use (DC 15) check. Purchase DC: 35. Restriction: Military (+3).",
 "Targeting System, Improved": "A starship equipped with an improved targeting system gains an equipment bonus on attack rolls depending on the ship’s size: Huge +3, Gargantuan +4, Colossal +5. This system replaces the TS 6 targeting system. The purchase DC of the improved targeting system depends on the size of the ship. Purchase DC: 22 (Huge), 27 (Gargantuan), or 32 (Colossal). Restriction: Licensed (+1).",
 "Class VI Sensor Array": "This array includes hi-res video, electromagnetic sensors, spectroanalyzers, multiphase radar, and mass detectors. As a move action, a Class VI sensor array can perform any one of the following functions with a successful Computer Use check (DC 15): • Ascertain the location, type (ultralight, light, and so on), subtype (fighter, destroyer, and so on), and mass of all ships on the battlefield (maximum range: 10,000,000 miles). • Identify and ascertain the location of all hazards on the battlefield (such as asteroids and mines). • Determine a specific ship’s TS 5, TS 6, TS 7, and TS 8 design specs (engines, defensive systems, sensor systems, communication systems, and weapons, including fire-linked weapons and batteries). • Detect the presence and location of ships and mines using active cloaking screens (targets still gain the benefits of total concealment). • Determine the number and type of life forms aboard a specific ship (“type” refers to the creature type). • Analyze the chemical composition of a planet’s atmosphere (the ship must be orbiting the planet). • Determine the number and type of life forms within a 4,000-square mile region on a planet’s surface (the ship must be orbiting the planet, and “type” refers to the creature type). • Analyze and chart the topography of a 4,000-square-mile area on a planet’s surface (the ship must be orbiting the planet). • Determine a planet’s prevailing meteorological conditions and weather patterns (must be orbiting the planet). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check ",
 "Class VII Sensor Array": "As the Class VI sensor array, except that the ship also gains a +2 equipment bonus on all initiative checks. This array is normally installed on ships built for combat (maximum range: 100,000,000 miles / 1 AU). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 100,000,000 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +7). Purchase DC: 42. Restriction: None.",
 "Achilles Targeting Software": "Any starship with a targeting system can have Achilles targeting software; the software does not take up one of the starship’s sensor system slots. Achilles targeting software enables the ship to better train its weapons on an enemy’s critical systems. Achilles targeting software increases the critical threat ranges of the ship’s beam, projectile, and missile weapons by 1. This effect stacks with other systems that expand a weapon’s critical threat range, such as weapon batteries. 661 The purchase DC of Achilles targeting software depends on the size of the ship. Purchase DC: 26 (Huge), 31 (Gargantuan), or 36 (Colossal). Restriction: Restricted (+2).",
 "Crackerjack Neural Link": "This unit links the operator’s brain directly to the starship, making it feel less like a machine and more like an extension of the operator’s body. While piloting the starship, the operator gains a +2 bonus on initiative checks, and they apply their Defense Bonus to their starship’s Touch AC rather than their full AC. Note that the Crackerjack Neural Link does not occupy a slot; instead it is purchased as an add-on to a Class VII or better sensor system. Purchase DC: 15 + one-half the starship’s base purchase DC. Restriction: Restricted (+2).",
 "Class VIII Sensor Array": "This array is an amplified version of the Class VI sensor array. As a move action, a Class VIII sensor array can perform any one of the following functions with a successful Computer Use check (DC 15): • Ascertain the location, type (ultralight, light, and so on), subtype (fighter, destroyer, and so on), and mass of all ships in the star system (maximum range: 1,000,000,000 miles / 10 AU). • Identify and ascertain the location and trajectories of all hazards in the star system (such as asteroids and mines). • Determine a specific ship’s design specs (engines, defensive systems, sensor systems, communication systems, and weapons, including fire-linked weapons and batteries). • Detect the presence and exact location of ships and mines equipped with cloaking screens, and negate the effects of stealth screens, displacers, and cloaking screens. • Determine the number, type, and species of life forms aboard a specific ship (“type” refers to the creature type). • Analyze the chemical composition of a planet’s atmosphere (the ship must be in the same system as the planet). • Determine the number, type, and species of life forms on a planet’s surface (the ship must be orbiting the planet, and “type” refers to the creature type). • Analyze and chart the topography of a planet’s surface (the ship must be orbiting the planet). • Determine a planet’s prevailing meteorological conditions and weather patterns (must be in the same system as the planet). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance",
 "Class IX Sensor Array": "As the Class VIII sensor array, except that the ship also gains a +2 equipment bonus on all initiative checks. This array is normally installed on ships built for combat (maximum range: 10,000,000,000 miles / 100 AU). The sensor array also allows its operator to use a Computer Use check in lieu of a Navigate skill check for the navigation of any distance within range of the sensor (in this case, 10,000,000,000 miles). The sensor array gives a bonus to this Computer Use check equal to the rating of the sensor array (in this case, +9). Purchase DC: 48. Restriction: None. STARSHIP COMMUNICATION SYSTEMS The ability to communicate with other ships and bases is vital to starships. The more advanced a ship’s communications capabilities, the better informed its crew is, and the better they can coordinate with other ships in the same fleet. To build a communication system from scratch, a character must succeed at a Craft (electrical) check (DC 30) after investing a number of hours equal to the ship’s Hit Dice. A character without an electrical tool kit takes a –4 penalty on the skill check. The character must also spend Wealth equal to the system’s base purchase DC. Installing a comm system requires a successful Craft (mechanical) check (DC 30) and a successful Craft 662 (electrical) check (DC 30) after investing 30 hours. A character without a mechanical or electrical tool kit takes a –4 penalty on the appropriate skill check. The following section describes various ship-to-ship communication systems. Communications System (TS): The name of the communications system, as well as the",
 "Radio Transceiver": "The radio transceiver can transmit on multiple frequencies in either LOS (line of sight) or omnidirectional mode, sending messages at the speed of light. A radio transceiver can handle up to ten simultaneous two-way conversations. Purchase DC: 21.",
 "Laser Transceiver": "This system uses a beam of coherent light to transmit messages. The laser is unidirectional; the signal cannot be intercepted or jammed unless it’s beamed directly at a hostile ship or station. However, if the comm officer doesn’t know exactly where the receiving station is, the laser transceiver is a waste of effort. This has some hidden drawbacks; a character cannot use the laser transceiver for a general distress call to all stations in the area, for example. A ship can’t receive laser communications unless it is equipped with the transceiver. Lasers are limited to the speed of light (8 AU/hour), meaning it can take hours or days to get a response within a system, or even weeks to get a response at interstellar distances. Purchase DC: 23.",
 "Drivesat Comm Array": "This massive comm array provides rapid interstellar communications. The array consists of a constellation of dozens of small transmitters that transmit and receive messages through space at faster-than-light speeds, enabling communications with a range of 50 light-years. The signals travel at a rate of 5 light-years per hour. Because of the need for steady signal, the ship must remain stationary to transmit and receive messages. If the ship moves while its drivesat array is transmitting or 663 receiving, the ship’s communication officer must make a Computer Use check (DC 30) to avoid losing the signal. Only mediumweight, heavy, and superheavy ships can be equipped with a drivesat comm array. Purchase DC: 53.",
 "Mass Transceiver": "This device can transmit instantaneously to any point in the same star system, with no “lag” due to FTS limitations. However, its range is limited to about 1,000 AU, so the signal can’t cross interstellar space. Purchase DC: 25.",
 "Drive Transceiver": "The drive transceiver is the first interstellar comm system that’s truly practical for small ships or second-rate colonies. It operates like the much larger TS 7 drivesat comm array, sending a signal up to 50 lightyears distant. The signal travels at a rate of 5 light-years per hour. The target station must also be equipped with a drive transceiver. Purchase DC: 28.",
 "Ansible": "The ansible is a device that induces precise changes in the energy states of atomic nuclei, without regard to distance or time. In effect, it permits instantaneous interstellar communications—voice, video, or data transfer— to any other ship or station equipped with an ansible. Much like a radio, the receiving station has to be attentive to a particular “frequency,” so two ansible-equipped stations must have some prearranged communications protocols; an ansible cannot pick up any transmissions not intended for that specific frequency. Purchase DC: 33. CREW The quality of the crew determines how well a starship performs in and out of combat. Unless otherwise noted, every starship has a trained crew of nonheroic characters. However, situations could arise where a starship must rely on an untrained crew. Conversely, expert crews and ace crews are also available—for the right price. Table: Crew Quality compares four different qualities of crew: untrained, trained, expert, and ace. Skill Check Modifier: Apply this modifier to all skill checks made by crew. Pilot’s Dexterity Modifier: A pilot’s Dexterity modifier applies to the starship’s initiative rolls and the starship’s touch Armor Class. Pilot’s Defense Bonus: A pilot’s class bonus to Armor Class applies to the starship’s touch Armor Class, to opposed grapple checks, and to any dodge attempts. Gunner’s Attack Bonus: A gunner’s attack bonus applies to any ranged attacks made through the ship’s systems. Modifier to Starship’s Base Purchase DC: The amount by which a crew increases the base purchase DC of the ship. Crew Skill Ch"
};
// STARSHIP_SUBTYPE_STATS: the printed per-subtype statblock lines (FF
// pp.665-685, 09-07): tactical speed WITH hex count (1 stellar hex = 250 ft),
// size/space, length/weight, crew (+quality mod), passengers, cargo, the
// HD split notation, initiative. The printed speed assumes the sample
// unit's standard engine (included in the base DC).
const STARSHIP_SUBTYPE_STATS = {
 "Orbital Shuttle": {
  "space": "Gargantuan (–4 size); 125 ft. (2-microhex)",
  "speed": "2,500 ft. (10 hexes)",
  "lw": "60 feet / 220,000 lb.",
  "crew": "4 (Trained +4)",
  "passengers": "12",
  "cargo": "22,000 lb.",
  "hd": "6D (1D, 2D Infrastructure)",
  "init": "(Trained +2)"
 },
 "Courier": {
  "space": "Gargantuan (-4 size); 125 ft. (2-microhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "45 feet / 90,000 lb.",
  "crew": "4 (trained +4)",
  "passengers": "12",
  "cargo": "9,000 lb.",
  "hd": "8D (1D, 4D Infrastructure)",
  "init": "(trained +2)"
 },
 "Escort": {
  "space": "Colossal (-8 size); 250 ft. (1 hex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "180 feet / 900 tons",
  "crew": "8 (trained +4)",
  "passengers": "24",
  "cargo": "30 tons",
  "hd": "20D (4D)",
  "init": "(trained +2)"
 },
 "Fast Freighter": {
  "space": "Colossal (-8 size); 250 ft. (1 hex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "110 feet / 450 tons",
  "crew": "4 (trained +4)",
  "passengers": "4",
  "cargo": "300 tons",
  "hd": "16D (3D, 4D Infrastructure)",
  "init": "(trained +2)"
 },
 "Fighter": {
  "space": "Gargantuan (-4 size); 125 ft. (2-microhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "36 feet / 20 tons",
  "crew": "1 (trained +4)",
  "passengers": "1",
  "cargo": "1 ton",
  "hd": "8D (1D, 4D Infrastructure)",
  "init": "(sensor array +2, trained +2)"
 },
 "Launch": {
  "space": "Huge (-2 size); 64 ft. (3-microhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "24 feet / 12 tons",
  "crew": "1 (trained +4)",
  "passengers": "4",
  "cargo": "1 ton",
  "hd": "5D (1D)",
  "init": "(trained +2)"
 },
 "Scout": {
  "space": "Colossal (-8 size); 250 ft. (1 hex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "150 feet / 600 tons",
  "crew": "8 (trained +4)",
  "passengers": "8",
  "cargo": "30 tons",
  "hd": "15D (3D)",
  "init": "(trained +2)"
 },
 "Starfighter": {
  "space": "Gargantuan (-4 size); 250 ft. (2-microhex)",
  "speed": "4,000 ft. (16 hexes)",
  "lw": "32 feet / 18 tons",
  "crew": "1 (trained +4)",
  "passengers": "1",
  "cargo": "1,200 lb.",
  "hd": "12D (2D, 4D Infrastructure)",
  "init": "(sensor array +2, trained +2)"
 },
 "Corvette": {
  "space": "Colossal (-8 size) / 500 ft. (2-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "320 feet / 3,200 tons",
  "crew": "16 (trained +4)",
  "passengers": "32",
  "cargo": "150 tons",
  "hd": "40D (8D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Destroyer": {
  "space": "Colossal (-8 size) / 500 ft. (2-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "450 feet / 8,000 tons",
  "crew": "80 (trained +4)",
  "passengers": "48",
  "cargo": "400 tons",
  "hd": "80D (16D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Frigate": {
  "space": "Colossal (-8 size) / 500 ft. (2-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "360 feet / 4,800 tons",
  "crew": "60 (trained +4)",
  "passengers": "32",
  "cargo": "200 tons",
  "hd": "60D (12D)",
  "init": "(trained +2)"
 },
 "Hauler": {
  "space": "Colossal (-8 size) / 500 ft. (2-polyhex)",
  "speed": "2,500 ft. (10 hexes)",
  "lw": "450 feet / 6,000 tons",
  "crew": "8 (trained +4)",
  "passengers": "8",
  "cargo": "3,300 tons",
  "hd": "36D (7D, 8D infrastructure)",
  "init": "(trained +2)"
 },
 "Bulk Freighter": {
  "space": "Colossal (-8 size) / 1,000 ft. (3-polyhex)",
  "speed": "2,500 ft. (10 hexes)",
  "lw": "800 feet / 32,000 tons",
  "crew": "8 (trained +4)",
  "passengers": "8",
  "cargo": "20,000 tons",
  "hd": "125D (25D)",
  "init": "(trained +2)"
 },
 "Clipper": {
  "space": "Colossal (-8 size) / 1,000 ft. (3-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "850 feet / 27,000 tons",
  "crew": "32 (trained +4)",
  "passengers": "80",
  "cargo": "10,000 tons",
  "hd": "150D (30D)",
  "init": "(trained +2)"
 },
 "Cruiser": {
  "space": "Colossal (-8 size) / 1,000 ft. (3-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "720 feet / 28,800 tons",
  "crew": "120 (trained +4)",
  "passengers": "80",
  "cargo": "7,200 tons",
  "hd": "200D (40D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Strike Cruiser": {
  "space": "Colossal (-8 size) / 1,000 ft. (3-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "950 feet / 38,000 tons",
  "crew": "160 (trained +4)",
  "passengers": "40",
  "cargo": "1,200 tons",
  "hd": "250D (50D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Battleship": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "1,250 feet / 125,000 tons",
  "crew": "400 (trained +4)",
  "passengers": "200",
  "cargo": "30,000 tons",
  "hd": "400D (80D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Fleet Carrier": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "1,400 feet / 140,000 tons",
  "crew": "320 (trained +4)",
  "passengers": "80",
  "cargo": "40,000 tons",
  "hd": "300D (60D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Heavy Transport": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "3,000 ft. (12 hexes)",
  "lw": "1,320 feet / 120,000 tons",
  "crew": "24 (trained +4)",
  "passengers": "20",
  "cargo": "60,000 tons",
  "hd": "350D (70D)",
  "init": "(trained +2)"
 },
 "Tanker": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "1,200 feet / 120,000 tons",
  "crew": "32 (trained +4)",
  "passengers": "8",
  "cargo": "52,000 tons",
  "hd": "250D (50D)",
  "init": "(trained +2)"
 },
 "Battse Cruiser": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "4,000 ft. (16 hexes)",
  "lw": "1,360 feet / 140,000 tons",
  "crew": "320 (trained +4)",
  "passengers": "160",
  "cargo": "50,000 tons",
  "hd": "500D (100D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Liner": {
  "space": "Colossal (-8 size) / 1,500 ft. (4-polyhex)",
  "speed": "4,000 ft. (16 hexes)",
  "lw": "1,200 feet / 84,000 tons",
  "crew": "200 (trained +4)",
  "passengers": "800",
  "cargo": "40,000 tons",
  "hd": "250D (50D)",
  "init": "(trained +2)"
 },
 "Colony Ship": {
  "space": "Colossal (-8 size) / 2,000 ft.(5-polyhex)",
  "speed": "4,000 ft. (16 hexes)",
  "lw": "2,000 feet / 400,000 tons",
  "crew": "400 (trained +4)",
  "passengers": "2,000",
  "cargo": "100,000 tons",
  "hd": "600D (120D)",
  "init": "(trained +2)"
 },
 "Dreadnought": {
  "space": "Colossal (-8 size) / 3,000 ft. (7-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "2,750 feet / 540,000 tons",
  "crew": "2,000 (trained +4)",
  "passengers": "1,600",
  "cargo": "100,000 tons",
  "hd": "1,000D (200D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Star Carrier": {
  "space": "Colossal (-8 size) / 3,000 ft. (7-polyhex)",
  "speed": "3,500 ft. (14 hexes)",
  "lw": "3,000 feet / 600,000 tons",
  "crew": "2,400 (trained +4)",
  "passengers": "600",
  "cargo": "200,000 tons",
  "hd": "800D (160D)",
  "init": "(sensor array +2, trained +2)"
 },
 "Star Freighter": {
  "space": "Colossal (-8 size) / 2,500 ft. (6-polyhex)",
  "speed": "4,000 ft. (16 hexes)",
  "lw": "2,200 feet / 320,000 tons",
  "crew": "40 (trained +4)",
  "passengers": "24",
  "cargo": "200,000 tons",
  "hd": "750D (150D)",
  "init": "(trained +2)"
 }
};
// STARSHIP_COMBAT_REF: the GMG pp.505-516 stellar-combat distillation,
// updated to the 09-07 amendments + rulings (1/5 hardness; whole-turn round
// R26; missile speed per move; PD volley + Broadside; amended dodge).
const STARSHIP_COMBAT_REF = {
 "round": "A starship's round (GMG p.506; Adam's whole-turn ruling 2026-09-08, R26): TWO move actions + ONE attack/standard action, in any order the commander chooses (standard/move/move, move/standard/move, or move/move/standard) — or a single full-round action. Each starship takes its ENTIRE turn at its initiative slot, then the next ship acts (replaces the printed phased Steps 4-9; book edit pending). ~6 seconds per round; 1 stellar hex = 250 ft.",
 "initiative": "Stellar initiative (GMG pp.506-507): commanders of Ultralight-Colossal and SMALLER ships roll DEXTERITY checks; commanders of Light-Colossal and LARGER ships roll CHARISMA checks. Every ship starts flat-footed until it acts; surprise round = one standard action for the aware.",
 "attack": "Gunner attack roll (GMG p.507): 1d20 + gunner's ranged attack bonus + range penalty (−2 per full range increment; beams max 10 increments, projectiles unlimited) + ship size modifier (Huge −2 / Gargantuan −4 / Colossal −8) + targeting-system equipment bonus (by ship size: Huge +1 / Garg +2 / Colossal +3; TS 7 improved: +3/+4/+5). Starship Gunnery feat assumed — without it, −4. Nat 1 misses, nat 20 hits and threatens. Ballistic weapons are Tech Piercing — unlike normal piercing's half, they deal FULL damage to objects and structures.",
 "tac": "Touch AC (GMG p.508): piloted = 10 + size mod + pilot's Dex mod (transferring full Dex to the ship costs the pilot their own Dex-to-Defense that round; none while flat-footed). Autopiloted = 10 + size mod + autopilot equipment bonus (by size: Colossal +1 / Garg +2 / Huge +3; TS 7 improved +2 higher). Total AC (either way) = touch AC + pilot's Defense bonus (full — Starship Operation assumed; a 2nd-level Ace Pilot moves it to TOUCH AC instead) + ONE-FIFTH armor hardness (amended from ½ in the 09-07 GMG so crits actually land at table hardness values).",
 "crew": "Crew quality (GMG p.509): Untrained (skills +0 · pilot Def +1 · Dex +0 · gunner −4 · ship DC −4) · Trained (+5 · +3 · +2 · +2 · ±0) · Expert (+10 · +5 · +4 · +4 · +4) · Ace (+15 · +7-to-TOUCH · +6 · +8/+3 · +8). Improvement: Trained needs 6+ months; Expert 12+ months & 4+ battles; Ace 3+ years & 12+ battles.",
 "actions": "Actions by role (GMG p.510): Aid another — commander/copilot/sensor op (DC 10, +2 to the aided). Ranged attack — pilot/copilot/gunner (each weapon system fires once/round). Grapple — pilot/copilot/gunner (AoO). Operate sensors, send/jam — sensor op/pilot/copilot/engineer. Total defense, feint (Starship Feint), escape grapple — pilot. MOVE: move/pivot (AoO), ram (AoO), dodge (Starship Dodge, amended 09-07: ready as a move action taking only ½ move; Pilot check vs the incoming attack's to-hit result; up to twice per round, once per move action). FULL-ROUND: damage control (engineer), jump to cruising speed (AoO), surge forward (AoO). FREE: automated damage control, comms, fight defensively (+2 dodge AC), turning during forward movement. Only ships with point-defense systems make attacks of opportunity — resolved per the FF Point-Defense entry (amended 09-07): a turret VOLLEY at the ship's targeting-system bonus, 1-5 turrets by the size-vs-size ladder; the optional 'Broadside' protocol trades missile defense + AoOs for automatic attacks on any ship passing within 1 hex.",
 "autofire": "Autofire (FF p.640): an Auto-capable weapon targets a 1,000-ft cube (4 hexes) vs effective AC 10; on a hit, every ship inside makes a Pilot check DC 15 or takes the damage — size penalty on that check: Gargantuan −0 · Colossal Ultralight −4 · Light −8 · Medium −12 · Heavy −16 · Superheavy −20. Anti-missile mode: vs effective AC 20; each missile in the area makes an automated Pilot check DC 15 (non-AI missiles add the firing ship's sensor Class; AI missiles add Pilot skill + sensor Class).",
 "missiles": "Missiles (FF pp.640-642): tactical speed 5,000 ft per MOVE action — 10,000 ft (40 hexes) per round (ruled 2026-09-07) unless noted; blast radius = (damage dice ÷ 2) × 5 ft; hardness = launching ship's, 20 hp / 4d / 1D; guidance negates range-increment penalties; long transits give the defender a shoot-down window; racks of eight; launcher type must match missile type.",
 "wings": "Ultralight fighter wings (GMG p.505): 2-5 identical Gargantuan fighters in the same hex fight as ONE vessel under a wing commander (like a weapon battery). Section-exposure tactic: a flank at 0D exposes the Infrastructure — captains turn an undamaged flank toward the enemy."
};

const SHIP_SECTIONS = ['Infrastructure', 'Fore', 'Starboard', 'Port', 'Aft'];
function shipDefOf(it) {
  if (!it || it.catalogue !== 'starship' || !it.ship) return null;
  const sub = STARSHIP_SUBTYPES[it.ship.subtype];
  if (!sub) return null;
  return Object.assign({ subtype: it.ship.subtype, engine: it.ship.engine, armor: it.ship.armor }, sub);
}
// Capital dice: D = 20 HP (FF p.523 note). Sections split evenly, remainder
// to Infrastructure — "unless otherwise noted" (⚠BOOK: the per-subtype
// Engines/Infrastructure D notes deserve an explicit worked example).
function shipSections(it) {
  const def = shipDefOf(it); if (!def) return null;
  const per = Math.floor(def.D / 5), rem = def.D - per * 5;
  if (!it.shipDamage) it.shipDamage = {};
  return SHIP_SECTIONS.map((s, i) => {
    const D = per + (i === 0 ? rem : 0);
    const maxHP = D * 20;
    const dmg = Math.max(0, it.shipDamage[s] || 0);
    return { section: s, D, maxHP, damage: dmg, hp: maxHP - dmg, disabled: dmg >= maxHP };
  });
}
async function openStarshipBuilder() {
  const c = chars.find(x => x.id === curId); if (!c) { toast('Select a hero first.'); return; }
  const sub = await new Promise(res => openChoiceModal('Starship — subtype (FF pp.664-683; base DC includes hull + trained crew)',
    Object.keys(STARSHIP_SUBTYPES).map(n => { const s = STARSHIP_SUBTYPES[n]; return `${n} — ${s.cls}, ${s.D}D (${s.D * 20} HP), crew ${s.crew}, DC ${s.dc}`; }), res));
  if (!sub) return;
  const subName = sub.split(' — ')[0];
  const eng = await new Promise(res => openChoiceModal('Primary engine (thrusters always included; the listed figure IS the ship\'s total tactical speed per move action — Adam\'s ruling 2026-09-04)',
    STARSHIP_ENGINES.map(e => `${e.name} (TS ${e.ts}) — ${e.bonus}, min ${e.minSize}, DC ${e.dc}`), res));
  if (!eng) return;
  const ar = await new Promise(res => openChoiceModal('Armor (hardness for every section)',
    STARSHIP_ARMOR.map(a => `${a.name} (TS ${a.ts}) — ${a.hardness}${a.speedPen !== '—' ? ', ' + a.speedPen : ''}, ${a.restriction}`), res));
  if (!ar) return;
  const nm = await textModal('Name the vessel', 'e.g. "ESS Boxcars". Sections, crew stations, and systems live on its card.', '');
  if (nm === null) return;
  const ship = { name: (nm || subName).trim(), subtype: subName, engine: eng.split(' (')[0], armor: ar.split(' (')[0] };
  const sdef = STARSHIP_SUBTYPES[subName];
  const techScale = scenarioTechScale(c);
  const priceUnits = dollarsForDC(marketAdjustedDC(sdef.dc, sdef.ts, techScale));
  const provenance = await promptProvenance(c, ship.name, priceUnits);
  if (provenance === null) return;
  if (!c.items) c.items = [];
  const item = { id: 'item_' + Math.random().toString(36).slice(2, 10), catalogue: 'starship', ref: subName, customName: ship.name, ship, slot: 'carried', equipped: false, mastercraft: null, gadgets: [] };
  if (provenance) item.provenance = provenance;
  item.paLoadout = [
    { slot: 'Engines', gear: 'Thrusters', fixed: true }, { slot: 'Engines', gear: ship.engine === 'Thrusters' ? '(thrusters only)' : ship.engine, fixed: true },
    { slot: 'Armor', gear: ship.armor + ' plating (all sections)', fixed: true },
    { slot: 'Comms', gear: 'Radio Transceiver' },
  ];
  c.items.push(item);
  logAct(`🚀 ${ship.name} commissioned: ${subName} (${sdef.cls}, ${sdef.D}D), ${ship.engine}, ${ship.armor} armor — base DC ${sdef.dc} (hull + trained crew; engines/armor/systems price separately per their DC formulas).`);
  save(); renderGear(); renderVehicles(); if (typeof renderNavTabs === 'function') renderNavTabs(c);
  toast(`${ship.name} commissioned — fit her out on the 🕹 Vehicles tab.`);
}
function shipIncomingHit(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const def = shipDefOf(it); if (!def) return;
  openChoiceModal(`⚔ Hit on ${it.customName || it.ref} — which section takes it? (facing determines this at the table)`,
    SHIP_SECTIONS, (section) => {
      if (!section) return;
      openChoiceModal(`Damage to the ${section} — raw damage, optionally followed by hardness ignored (AA weapons ignore 1D = 20)`, [], (val) => {
        const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
        if (!m) { toast('Enter the damage as a number.'); return; }
        const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
        const net = Math.max(0, dmg - Math.max(0, def.hardness - ign));
        const math = `${dmg} − hardness ${def.hardness}${ign ? ` (−${ign} ignored)` : ''} = ${net}`;
        if (net <= 0) { logAct(`${it.customName || it.ref}: ${section} armor absorbs the hit (${math}).`); save(); toast(`Absorbed — ${math}.`); return; }
        if (!it.shipDamage) it.shipDamage = {};
        it.shipDamage[section] = (it.shipDamage[section] || 0) + net;
        const sec = shipSections(it).find(s => s.section === section);
        logAct(`⚔ ${it.customName || it.ref}: ${math} to the ${section} (${sec.hp}/${sec.maxHP}).${sec.disabled ? ` 🛑 ${section.toUpperCase()} DISABLED.` : ''}`);
        save(); renderVehicles();
        toast(sec.disabled ? `${section} DISABLED.` : `${section}: ${sec.hp}/${sec.maxHP}.`);
      });
    });
}
function shipRepair(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it || !it.shipDamage) { toast('Undamaged.'); return; }
  openChoiceModal('🔧 Repair which section?', SHIP_SECTIONS.filter(s => (it.shipDamage[s] || 0) > 0), (section) => {
    if (!section) return;
    openChoiceModal(`HP repaired on the ${section} (${it.shipDamage[section]} outstanding; 1 hr / Repair DC 20 / 2d6 HP — engineer's station)`, [], (val) => {
      const v = parseInt(String(val || '').trim(), 10);
      if (isNaN(v) || v <= 0) { toast('Enter a positive number.'); return; }
      it.shipDamage[section] = Math.max(0, (it.shipDamage[section] || 0) - v);
      logAct(`🔧 ${it.customName || it.ref}: repaired ${v} HP on the ${section}.`);
      save(); renderVehicles();
    });
  });
}
function renderStarshipCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'starship');
  if (!items.length) return '';
  const owns = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  const hasOp = owns('Starship Operation');
  return items.map(it => {
    const def = shipDefOf(it); if (!def) return '';
    const cls = STARSHIP_SIZE_CLASSES[def.cls] || {};
    const eng = STARSHIP_ENGINES.find(e => e.name === def.engine);
    const arm = STARSHIP_ARMOR.find(a => a.name === def.armor);
    const name = it.customName || it.ref;
    const sections = shipSections(it);
    const secBars = sections.map(s => {
      const pct = Math.max(0, Math.min(100, Math.round(s.hp / s.maxHP * 100)));
      const col = s.disabled ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
      return `<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;">
        <span style="min-width:86px;color:var(--g60);">${s.section}</span>
        <span style="min-width:70px;"><b style="color:${col};">${s.hp}</b>/${s.maxHP} <span style="opacity:var(--o50);color:var(--dim);">(${s.D}D)</span></span>
        <div class="bar-wrap" style="flex:1;height:4px;"><div class="bar-fill" style="width:${pct}%;background:${col};"></div></div>
        ${s.disabled ? '<span style="color:var(--red-text);font-size:9px;">DISABLED</span>' : ''}
      </div>`;
    }).join('');
    const critTip = 'Starship Critical Hits (FF p.648 — the table header misprints d%; it is a d20): 1-7 normal crit · 8-10 crit + crew casualties (1d10) · 11-16 damaged system (comm/targeting/weapon/defense/engines[−1,000 ft]/sensors[blind]) — repair 10 hrs DC 30 or jury-rig DC 25 · 17 defense destroyed · 18 weapon destroyed · 19 severe ×10 + casualties · 20 severe ×10 + gravity out 1d10 rds.';
    const loadout = paLoadout(it).map((l, idx) => {
      // v9.8.0 (§258, probe catch): longest name wins — "Laser, Heavy" was
      // matching the plain "Laser" row (and "…, Improved" its base) by array order.
      const longest = (rows) => rows.filter(w => l.gear.startsWith(w.name)).sort((a, b) => b.name.length - a.name.length)[0];
      const wep = longest(STARSHIP_WEAPONS);
      const dfx = longest(STARSHIP_DEFENSES);
      const sen = longest(STARSHIP_SENSORS);
      // v8.26.0 pass 2: the per-system effect prose (FF pp.646-661) reaches
      // the tooltips — the pass-1 "table-level" placeholder retires. Auto-
      // capable weapons carry the FF p.640 autofire ladder.
      const fxLookup = (nm) => {
        if (typeof STARSHIP_SYSTEM_FX === 'undefined') return '';
        const key = Object.keys(STARSHIP_SYSTEM_FX).find(k => nm.toLowerCase().startsWith(k.toLowerCase()) || k.toLowerCase().startsWith(nm.toLowerCase().replace(/ \(ship\)$/, '')));
        return key ? '\n— ' + STARSHIP_SYSTEM_FX[key] : '';
      };
      const autofireTip = (wep && /Auto/.test(wep.stat)) ? '\n✈ AUTOFIRE (FF p.640): target a 1,000-ft cube (4 hx) vs AC 10 — every ship inside: Pilot DC 15 or take the damage (size penalty: Garg −0 · C-UL −4 · C-L −8 · C-M −12 · C-H −16 · C-SH −20). Anti-missile: vs AC 20; each missile rolls automated Pilot DC 15.' : '';
      // v9.8.0 (§258): the mount rides the tooltip — turret (printed DC, any
      // direction), cupola/fixed with the discounted DC, missiles omni.
      const mnt = wep ? shipMountOf(l) : null;
      const mountTip = wep ? (shipWeaponTakesMount(wep.name)
        ? `\n⌖ Mount: ${mnt.kind === 'turret' ? `full turret/bank — fires any direction; the printed DC includes it (FF p.640; stock FF ships are all-turret, GMG p.474)` : `${mnt.kind} ${mnt.arcs.join('/')}${wep.dc ? ` — DC ${wep.dc + mnt.disc} (printed ${wep.dc} −${Math.abs(mnt.disc)} ${mnt.kind}, FF p.640)` : ` (${mnt.disc} DC, FF p.640)`}`}`
        : (/^Missile,/.test(wep.name) ? '\n⌖ Omni launcher — missiles fire any direction (FF p.641); a missile mount option awaits Adam’s ruling.' : '')) : '';
      // v9.9.0 (§259): the fire-link / main-cannon / missile-battery dossier
      // rides the tooltip (FF pp.641-642) — linked damage, grown size, the
      // stepped DC (mount discount folded in), the main cannon's power modes,
      // a battery's threat/multiplier math.
      let linkTip = '';
      if (wep) {
        const link = shipLinkOf(l), bat = shipBatteryOf(l);
        if (link >= 2) {
          const d = Math.round(Math.log2(link));
          const dice = shipLinkedDice(wep.stat, link);
          const grown = SHIP_SIZE_LADDER[shipWeaponSizeStep(wep.mss) + d] || 'beyond Colossal (Superheavy)';
          const effDC = wep.dc ? wep.dc + 3 * d + (mnt ? mnt.disc : 0) : null;
          linkTip = `\n⛓ Fire-linked ×${link} (FF p.641): ONE attack roll${dice ? ` · damage ${dice} (base ×${(2 + d) / 2}; capital dice scale alike)` : ` · damage ×${(2 + d) / 2}`} · size ${grown} (+1 category per doubling)${effDC ? ` · DC ${effDC} (printed ${wep.dc} +3 per doubling${mnt && mnt.disc ? ` ${mnt.disc} ${mnt.kind}` : ''})` : ''}`;
          if (link >= 8) linkTip += `\n★ MAIN CANNON (FF p.642): one per ship (power demands) · threat +1 — crit ${shipThreatRange(wep.stat, 1)} · may fire at 25% power (dual-equivalent) or 50% (quad-equivalent) · always a SINGLE rate of fire.`;
          else if (l.variable) linkTip += `\n⛓ Variable link (FF p.642): the gunner fires the weapons singly, in pairs, or at the full link, chosen attack to attack.`;
        }
        if (bat >= 2) {
          linkTip = `\n⧉ Missile battery ×${bat} (FF p.642): ${bat} identical launchers fire as ONE weapon (one attack roll) · threat ${shipThreatRange(wep.stat, Math.min(bat - 1, 3))} (+${Math.min(bat - 1, 3)}) · crit multiplier ×${1 + bat} (+1 per extra missile) · a non-critical hit deals ONE missile's damage${wep.dc ? ` · DC ${wep.dc + 2} per launcher (${bat}× — printed ${wep.dc} +2)` : ' · +2 DC per launcher'} · one size category above the base weapon — Colossal (Light)+ hulls only · never split: all fire or none · vs force fields: crits never confirm, but damage lands per-missile.`;
        }
      }
      const tip = wep ? `${wep.stat} · min ship ${wep.mss}${wep.dc ? ' · DC ' + wep.dc : ''}${autofireTip}${mountTip}${linkTip}` : dfx ? `Defense system · TS ${dfx.ts} · DC ${dfx.dc} · ${dfx.restriction}${fxLookup(dfx.name)}` : sen ? `Sensor system · TS ${sen.ts} · DC ${sen.dc}${fxLookup(sen.name)}` : fxLookup(l.gear);
      const mountChip = wep ? [shipMountChip(l), shipLinkChip(l), shipBatteryChip(l)].filter(Boolean).join(' · ') : '';
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? '#999' : l.state === 'damaged' ? 'var(--red-text)' : '#6dba88';
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (10 hrs, Repair DC 30; jury-rig DC 25 for the battle) → destroyed (replace) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span style="color:var(--g55);min-width:80px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:#78afcd;' : ''}${wep ? 'color:#d4865a;' : ''}" ${tip ? `title="${escapeHTML(tip)}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}${mountChip ? ` <span style="color:#78afcd;font-size:9.5px;">${escapeHTML(mountChip)}</span>` : ''}</span>
        ${l.fixed ? '' : `<button class="btn btn-sm" style="font-size:9px;padding:0 4px;" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="panel" style="margin-bottom:.8rem;border-color:rgba(150,150,220,.4);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;color:var(--gold);">🚀 ${escapeHTML(name)} <span style="font-size:10px;color:var(--g50);">${escapeHTML(def.subtype)} · ${def.cls} TS ${def.ts} · ${escapeHTML(def.armor || '')} armor</span></div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;" onclick="shipIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="shipRepair('${it.id}')">🔧 Repair</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="setJointOwners('${it.id}')">✎ Owners</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--parch);margin-top:5px;">
        <span style="cursor:help;" title="Touch/full AC; the trained-crew figures include the crew-quality modifiers (FF STARSHIP TYPES). Untrained pilots without Starship Operation apply only ⅓ Defense Bonus (GMG).">T/AC <b>${def.tac}</b> <span style="opacity:var(--o60);color:var(--dim);">(${def.tacTrained} trained)</span></span> ·
        Hardness <b style="cursor:help;" title="${escapeHTML(def.hardStr)}">${def.hardness}</b> · <b>${def.D}D</b> (${def.D * 20} HP total) ·
        crew ${def.crew} · ${escapeHTML(def.lw)} · ${escapeHTML(cls.space || '')} ·
        ${(() => {
          // v8.22.0 (Adam's ruling, 2026-09-04): despite the printed "+", the
          // engine figure IS the ship's TOTAL tactical speed — the distance of
          // ONE move action. v8.26.0 pass 2: the subtype statblock's PRINTED
          // speed (FF pp.663-684, standard engine included in the base DC)
          // displays first, with hex count (1 stellar hex = 250 ft); the
          // engine-derived figure rides the hover for refit math.
          const engFt = eng ? (parseInt(String(eng.bonus).replace(/[^\d]/g, ''), 10) || 0) : 0;
          const penFt = (arm && arm.speedPen !== '—') ? (parseInt(String(arm.speedPen).replace(/[^\d]/g, ''), 10) || 0) : 0;
          const spd = Math.max(0, engFt - penFt);
          const st = (typeof STARSHIP_SUBTYPE_STATS !== 'undefined') ? STARSHIP_SUBTYPE_STATS[def.subtype] : null;
          const printed = st && st.speed ? st.speed : null;
          const pFt = printed ? (parseInt(printed.replace(/[^\d]/g, '').slice(0, 6), 10) || 0) : 0;
          const shown = printed || `${spd.toLocaleString()} ft (${Math.floor(spd / 250)} hexes)`;
          const zeroNote = (!printed && spd === 0) ? ' ⚠ Thrusters/Photon Sails list 0 ft — a ship without a faster primary engine maneuvers at GM-adjudicated station-keeping speeds.' : '';
          return `<span style="cursor:help;" title="Tactical speed per MOVE action — 1 stellar hex = 250 ft (Adam's scales). Round economy (GMG p.506): two move actions + one standard, any order — full burn = ${((printed ? pFt : spd) * 2).toLocaleString()} ft/round.${printed ? ` Printed subtype speed (standard engine, FF statblock). Engine-derived after refit: ${eng ? eng.name : 'thrusters'} ${engFt.toLocaleString()} ft${penFt ? ` − armor ${penFt.toLocaleString()}` : ''} = ${spd.toLocaleString()} ft.` : ''}${zeroNote}">speed <b>${shown}</b>/move <span style="opacity:var(--o60);color:var(--dim);">(×2/round)</span></span> ·`;
        })()}
        grapple ${cls.grappleMod || '+0'} ·
        <span style="cursor:help;color:#d4b870;" title="${escapeHTML(critTip)}">🎲 crit table ⓘ</span>
      </div>
      <div style="margin-top:5px;">${secBars}</div>
      ${(() => {
        // v8.26.0 pass 2: the printed subtype statblock line (FF pp.663-684)
        // — space, length/weight, crew (+quality mod), passengers, cargo, the
        // HD split notation, initiative — plus the Dex-vs-Cha initiative rule.
        const st = (typeof STARSHIP_SUBTYPE_STATS !== 'undefined') ? STARSHIP_SUBTYPE_STATS[def.subtype] : null;
        if (!st) return '';
        const big = /Light|Medium|Heavy|Superheavy/.test(String(st.space || '')) && !/Ultralight/.test(String(st.space || ''));
        const initRule = big ? 'CHA check (Light-Colossal and larger — GMG p.506)' : 'DEX check (Ultralight-Colossal and smaller — GMG p.506)';
        return `<div style="font-size:10.5px;color:var(--tl80);margin-top:4px;">
          ${st.space ? `⬡ ${escapeHTML(st.space)} · ` : ''}${st.lw ? `${escapeHTML(st.lw)} · ` : ''}${st.crew ? `crew ${escapeHTML(st.crew)} · ` : ''}${st.passengers ? `passengers ${escapeHTML(st.passengers)} · ` : ''}${st.cargo ? `cargo ${escapeHTML(st.cargo)} · ` : ''}${st.hd ? `<span style="cursor:help;" title="The printed HD notation — sections split evenly, remainder to Infrastructure, unless this notes otherwise.">HD ${escapeHTML(st.hd)}</span> · ` : ''}<span style="cursor:help;" title="Stellar initiative: commander rolls a ${initRule}. Every ship starts flat-footed until it acts.">init: ${big ? 'Cha' : 'Dex'}${st.init ? ` (${escapeHTML(st.init)})` : ''}</span>
        </div>`;
      })()}
      <div style="font-size:11px;color:var(--g70);margin-top:5px;">
        ${hasOp ? '<span style="color:#6dba88;">✓ Starship Operation</span>' : '<span style="color:var(--red-text);" title="Without it: reduced Defense Bonus contribution and operation penalties — see GMG crewed-starship rules.">✗ Starship Operation</span>'}
        · Roles: pilot · copilot · gunners (${def.weapons} weapon slots) · engineer (damage control) · sensor/comm officers — FF p.662.
        · Slots: ${def.weapons} weapons (${cls.weaponsPer}) · ${def.defense} defense · ${def.sensors} sensors · engines ${escapeHTML(def.engineD)}
        · <span style="cursor:help;color:#78afcd;" title="${escapeHTML(Object.values(typeof STARSHIP_COMBAT_REF !== 'undefined' ? STARSHIP_COMBAT_REF : {}).join('\n\n'))}">📖 stellar combat ref ⓘ</span>
      </div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--g55);margin-top:7px;">Fittings <button class="btn btn-sm" style="font-size:9px;padding:0 5px;margin-left:6px;" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
      <div style="font-size:10px;color:var(--g45);margin-top:3px;">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`} · Jointly-owned by charter, most likely — the bookkeeping berths here.</div>
    </div>`;
  }).join('');
}

function renderPrepPanel(c) {
  const host = document.getElementById('pw-prep');
  if (!host) return;
  _prepCtrs = prepContributorsOf(c);
  if (!_prepCtrs.length) { host.innerHTML = ''; return; }
  let html = `<div class="sec-head sm">Prepared Spells <span style="font-weight:400;font-size:10px;opacity:var(--o60);color:var(--dim);">(memorized at dawn — PP, Magic-feat and augment costs ALL paid at preparation, per instance; casting is free)</span></div>`;
  html += `<div style="border:1px solid rgba(220,205,138,.25);border-radius:3px;margin-bottom:1rem;">`;
  _prepCtrs.forEach((pc, pi) => {
    const c2 = chars.find(x => x.id === curId);
    const list = getPreparedList(c2, pc.poolName, pc.ctrKey);
    const cur = c2.ppCurrent?.[pc.poolName]?.[pc.ctrKey] ?? pc.budget;
    const committed = list.reduce((t, r) => t + (r.free ? 0 : (r.cost || 0) * (r.qty || 0)), 0);
    const isSpec = pc.ctr.class === 'Wizard' && c2.wizardSchool;
    html += `<div style="padding:7px 10px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
        <div><b style="color:#dccd8a;">${escapeHTML(pc.ctr.class)} ${pc.ctr.level}</b>
          <span style="font-size:10px;opacity:.6;" title="${POOL_EFF_LEVEL[pc.poolName].full} contribution of this class — its spells resolve at this level">(${pc.poolName} · ${POOL_EFF_LEVEL[pc.poolName].abbr} ${pc.ctr.clContribution} · max spell lvl ${pc.ctr.classMaxPowerLvl})</span>
          <span style="font-size:11px;margin-left:8px;color:var(--tx80);">PP: <b>${cur}</b>/${pc.budget} unallocated · ${committed} committed to prep</span></div>
        <div><button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="prepPickAndAdd(${pi})">+ Prepare…</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="restPP('${pc.poolName}')" title="Refill this pool's PP and re-memorize the current list (new day)">☾ Rest pool</button></div>
      </div>`;
    if (isSpec) {
      const freeUsed = specialistFreeUsed(c2, pc);
      const lvls = [];
      for (let L = 0; L <= (pc.ctr.classMaxPowerLvl || 0); L++) lvls.push(`${L}:${freeUsed[L] ? '●' : '○'}`);
      html += `<div style="font-size:10px;color:var(--g60);margin-top:2px;">${escapeHTML(c2.wizardSchool)} specialist — one free specialty spell per level daily: ${lvls.join(' ')}</div>`;
    }
    if (pc.ctr.class === 'Cleric') {
      html += `<div style="font-size:10px;color:var(--g55);margin-top:2px;">Spontaneous conversion: any uncast prepared spell → ${(c2.druidOption || pc.ctr._heritageChoice === 'Cleric (Druid Option)') ? 'Summon Nature’s Ally' : 'Cure/Inflict Wounds'} of the same level or lower (⇄ button).</div>`;
    }
    if (pc.ctr.class !== 'Wizard') {
      html += `<div style="font-size:10px;color:var(--g45);margin-top:2px;">Divine preparation draws on the class's ENTIRE spell list — “+ Prepare…” browses it by spell level (no need to add spells to Known first).</div>`;
    }
    html += list.length
      ? list.map((r, idx) => {
          const left = (r.qty || 0) - (r.cast || 0);
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11.5px;padding:3px 0 3px 12px;${left <= 0 ? 'opacity:.45;' : ''}">
            <div><b>${escapeHTML(r.dispName || r.name)}</b> <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">lvl ${r.lvl}${r.free ? ' · FREE specialty' : ` · ${r.cost} PP`}</span>${(r.metas || []).includes('Quicken Spell') ? ' <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.4);border-radius:3px;padding:0 3px;" title="Quickened at memorization — this instance casts as a SWIFT action (no AoO, one per round).">swift</span>' : ''}
              <span style="font-size:10px;color:${left > 0 ? '#6dba88' : 'var(--red-text)'};margin-left:6px;">${left}/${r.qty} left${r.cast ? ` (${r.cast} cast)` : ''}</span></div>
            <div>
              <button class="btn btn-sm" style="font-size:10px;${left <= 0 ? 'opacity:.5;' : 'border-color:rgba(120,175,205,.5);color:rgba(120,175,205,.95);'}" title="Cast a prepared instance (no PP)" onclick="castPreparedAt(${pi},${idx})">⚡ Cast</button>
              ${pc.ctr.class === 'Cleric' ? `<button class="btn btn-sm" style="font-size:10px;${left <= 0 ? 'opacity:.5;' : ''}" title="Spontaneous conversion" onclick="convertPreparedAt(${pi},${idx})">⇄</button>` : ''}
              <button class="btn btn-sm btn-danger" style="font-size:10px;" title="Unprepare one uncast instance (refunds its PP)" onclick="unprepareAt(${pi},${idx})">−</button>
            </div>
          </div>`;
        }).join('')
      : `<div style="font-size:11px;color:var(--g45);padding:4px 0 2px 12px;font-style:italic;">Nothing prepared yet — click “+ Prepare…” at dawn.</div>`;
    html += `</div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}

