// =============================================================================
// js/rules/11-cybernetics.js
// CYBERNETICS
// =============================================================================
//
// WHAT'S IN HERE
//   Cybernetics (HH pp.332-339): body slots, the CYBERNETICS_DB catalog,
//   install limits, lost/replaced limbs, and purchase DCs.
//
// KEY NAMES (so you can search for them)
//   tables/objects: CYBER_SLOTS, CYBERNETICS_DB
//   functions (15): getCyber, cyberDef, hasLostArm, hasCyberArm,
//   offHandAvailable, cyberMax, cyberCount, cyberExcess, cyberPDC,
//   buildCyberneticsBonuses, syncCyberFeats, toggleGearCyber,
//   renderCybernetics, addCyberFromSel, removeCyber
//
// LOAD ORDER
//   File 11 of 68. index.html loads it after
//   js/rules/10-minds-ledger-and-magic-browser.js and before
//   js/rules/12-wealth-and-prices.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 8200-8478 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 8200-8478; unchanged below this line ----
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

function getCyber(c) { return (c && c.cybernetics) || []; }
function cyberDef(n) { return CYBERNETICS_DB.find(e => e.n === n) || null; }
function hasLostArm(c) { return (c && c.mutations || []).some(m => m.name === 'Lost Arm'); }
function hasCyberArm(c) { return getCyber(c).some(r => (cyberDef(r.n) || {}).replaceArm); }
// The off hand exists unless Lost Arm stands UNreplaced (HH drawback Special:
// "You can replace your lost arm with a cybernetic replacement arm").
function offHandAvailable(c) { return !hasLostArm(c) || hasCyberArm(c); }
function cyberMax(c) {
  // 1 + Con modifier (minimum 0); supernatural Con modifiers excluded —
  // c.attrs holds the baked PERMANENT score, which is the right base.
  // v9.11.1 (§266, Adam's Forge World Heritage report): + Cybertaker ×N
  // (HH p.209: "maximum number of cybernetic attachments ... increases by
  // 1", stackable). The feat sat in the catalogue since the Expert list
  // landed but nothing ever read it — granted-by records count too, since
  // they live in c.feats like any other take.
  const cybertakers = (c && c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker').length;
  return Math.max(0, 1 + Math.floor((((c.attrs && c.attrs[2]) ?? 10) - 10) / 2)) + cybertakers;
}
function cyberCount(c) {
  // Plexus rule: up to FOUR Skill (or Feat) Implants ride one plexus as a
  // single attachment (the plexus's own 1). Advanced prostheses/organs and
  // the Prosthetic Enhancer count 0 by their entries.
  let skillImps = 0, featImps = 0, n = 0;
  for (const r of getCyber(c)) {
    const def = cyberDef(r.n); if (!def) { n += 1; continue; }
    if (def.n === 'Skill Implant') { skillImps++; continue; }
    if (def.n === 'Feat Implant') { featImps++; continue; }
    n += (def.cnt !== undefined ? def.cnt : 1);
  }
  const hasSP = getCyber(c).some(r => r.n === 'Skill Plexus');
  const hasFP = getCyber(c).some(r => r.n === 'Feat Plexus');
  n += hasSP ? Math.max(0, skillImps - 4) : skillImps;
  n += hasFP ? Math.max(0, featImps - 4) : featImps;
  return n;
}
function cyberExcess(c) { return Math.max(0, cyberCount(c) - cyberMax(c)); }
function cyberPDC(c, def) {
  if (!def.pdc) return def.pdcNote || 'see text';
  const steps = Math.max(0, scenarioTechScale(c) - def.ts);
  return Math.max(1, def.pdc - 2 * steps);
}
// Bonus-engine source: implants with clean always-on numbers contribute live.
function buildCyberneticsBonuses(c) {
  const out = {};
  const push = (target, value, label, type) => { (out[target] = out[target] || []).push({ type: type || BONUS_TYPES.EQUIPMENT || 'equipment', source: 'cybernetic:' + label, value, label: label + ' (cybernetic)' }); };
  for (const r of getCyber(c)) {
    const def = cyberDef(r.n); if (!def) continue;
    if (def.init) push('init', def.init, def.n);
    if (def.skill) push('skill:' + def.skill[0], def.skill[1], def.n);
    if (def.n === 'Skill Implant' && r.param) push('skill:' + r.param, 2, def.n + ' (' + r.param + ')');
    if (def.n === 'Data Archive') for (const sk of SKILLS) { if (sk.n.startsWith('Knowledge (')) push('skill:' + sk.n, 4, 'Data Archive'); }
    // v8.99.0: Mindscreen Implant (HH p.338) — +2 equipment on saves vs
    // mind-affecting attacks; a CONDITIONAL entry per save lane (shows in
    // the drilldowns like the mutations' conditional saves, never folds
    // into the headline total).
    if (def.n === 'Mindscreen Implant') for (const sv of ['fort', 'ref', 'will']) {
      (out[sv] = out[sv] || []).push({ type: BONUS_TYPES.EQUIPMENT || 'equipment', source: 'cybernetic:Mindscreen', value: 2, label: 'Mindscreen Implant (cybernetic)', condition: 'vs mind-affecting attacks' });
    }
  }
  // v8.92.0 (Adam: "wire the negative level modifier for completeness"):
  // −1 per negative level on ALL skill checks (HH p.333) — one untyped
  // entry per catalog skill; saves ride the statblock lanes, attack rolls
  // the RO lane, grapple its own compute. Ability-check −1, effective-level
  // die rolls, and the lost top spell/power remain table-adjudicated.
  const nl = cyberExcess(c);
  if (nl > 0) for (const sk of SKILLS) {
    (out['skill:' + sk.n] = out['skill:' + sk.n] || []).push({ type: BONUS_TYPES.UNTYPED, source: 'cybernetic:negative-levels', value: -nl, label: `Negative level${nl > 1 ? 's' : ''} ×${nl} (cybernetic overload — HH p.333)` });
  }
  return out;
}

// v8.99.0 (Adam's Rhad confirmation): FEAT IMPLANTS GRANT REAL FEATS. The
// implant stored its gift in c.cybernetics while every feat consumer reads
// c.feats — Improved/Advanced Dodge from Rhad's two Feat Implants were
// invisible to the whole engine. The v8.87.0 Energy Immunity pattern:
// materialize a real feat record with grantedBy (budget-exempt — getFeatBudget
// already skips grantedBy feats), self-heal idempotently on render, CASCADE
// away when the implant is removed (HH p.337: "If the feat implant is
// destroyed, the granted feat is lost as well"). Psi Implant's Wild Talent
// grant (HH p.339) rides the same rail. Plexuses grant nothing themselves —
// they consolidate the attachment COUNT (already in cyberCount).
function syncCyberFeats(c) {
  if (!c) return false;
  let changed = false;
  const wanted = [];
  for (const r of getCyber(c)) {
    if (r.n === 'Feat Implant' && r.param) wanted.push(r.param);
    if (r.n === 'Psi Implant') wanted.push('Wild Talent');
  }
  for (const nm of [...new Set(wanted)]) {
    if (!(c.feats || []).some(f => (f.name || f.n) === nm)) {
      // v9.2.2: the Psi Implant's Wild Talent names its own source.
      const src = (nm === 'Wild Talent' && getCyber(c).some(r => r.n === 'Psi Implant') && !getCyber(c).some(r => r.n === 'Feat Implant' && r.param === 'Wild Talent')) ? 'Psi Implant (cybernetic)' : 'Feat Implant (cybernetic)';
      c.feats = (c.feats || []).concat([{ name: nm, grantedBy: src }]);
      changed = true;
    }
  }
  // v9.2.2 (Adam's ruling 2026-10-06): MUTATION-granted feats ride the same
  // materialize / self-heal / cascade rail. Ultra Immune System (HH mutation
  // entry): "You gain Ultra Immune System as a bonus feat even if you don't
  // meet the feat's prerequisite" — budget-exempt via grantedBy.
  {
    const MUT_FEATS = { 'Ultra Immune System': 'Ultra Immune System' };
    const wantM = (c.mutations || []).map(m => MUT_FEATS[m.name]).filter(Boolean);
    for (const nm of wantM) if (!(c.feats || []).some(f => (f.name || f.n) === nm)) { c.feats = (c.feats || []).concat([{ name: nm, grantedBy: `${nm} (mutation)` }]); changed = true; }
    for (const f of (c.feats || []).slice()) if (/\(mutation\)$/.test(f.grantedBy || '') && !wantM.includes(f.name || f.n)) { c.feats = c.feats.filter(x => x !== f); changed = true; }
  }
  for (const f of (c.feats || []).slice()) {
    if (/cybernetic/i.test(f.grantedBy || '') && !wanted.includes(f.name || f.n)) {
      c.feats = c.feats.filter(x => x !== f);
      changed = true;
    }
  }
  // v9.11.2 (§267, Adam's ruling 2026-10-09): the Heavy's 2nd/3rd/4th/5th-
  // level "Cybertaker" class ability IS the Cybertaker feat (HH p.209) —
  // one real feat record per class level past 1st, same materialize /
  // self-heal / cascade rail as the implant grants. The records live in
  // c.feats, so cyberMax (§266) counts them with no special-casing, and
  // they stack with copies taken as feats. ("An implant that does not
  // count against the limit" and "+1 to the limit" are the same number.)
  {
    const heavyLvl = migrateLegacyClasses(c).filter(e => e.name === 'Heavy').reduce((s, e) => s + (e.level || 0), 0);
    const want = Math.min(4, Math.max(0, heavyLvl - 1));
    const SRC = 'Heavy (Cybertaker class feature)';
    const mine = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && f.grantedBy === SRC);
    for (let k = mine.length; k < want; k++) { c.feats = (c.feats || []).concat([{ name: 'Cybertaker', grantedBy: SRC }]); changed = true; }
    for (let k = mine.length; k > want; k--) { const victim = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && f.grantedBy === SRC).pop(); c.feats = c.feats.filter(x => x !== victim); changed = true; }
  }
  if (changed) { save(); logAct('🦾 Cybernetic feat grants synced — implant-granted feats materialized (budget-exempt; removed implants cascade their feats away).'); }
  return changed;
}

function toggleGearCyber() {
  const w = document.getElementById('gear-cyber-wrap'), ch = document.getElementById('gear-cyber-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? '' : 'none';
  ch.textContent = open ? '▾' : '▸';
}

function renderCybernetics(c) {
  const sumEl = document.getElementById('gear-cyber-summary'), body = document.getElementById('gear-cyber-body');
  if (!sumEl || !body) return;
  syncCyberFeats(c);  // v8.99.0 self-heal
  const ts = scenarioTechScale(c);
  const owned = getCyber(c);
  const max = cyberMax(c), count = cyberCount(c), excess = cyberExcess(c);
  const hasAntiShock = owned.some(r => r.n === 'Anti-Shock Implant');
  // summary line beside the section head
  if (ts < 5 && !owned.length) { sumEl.textContent = '— requires a Tech Scale 5+ scenario'; body.innerHTML = ''; return; }
  sumEl.innerHTML = `${count} of ${max} attachments` + (excess ? ` <span style="color:#e08080;font-weight:bold;">⚠ +${excess} negative level${excess > 1 ? 's' : ''}</span>` : '');
  const bits = [];
  // doctrine strip
  const _ctN = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker').length;
  bits.push(`<div style="font-size:11px;color:var(--tb75);margin-bottom:.5rem;">Maximum attachments = 1 + Con modifier${_ctN ? ` + Cybertaker ×${_ctN}` : ''} (${max}; supernatural Con excluded — HH p.333${_ctN ? '; Cybertaker p.209 stacks' : ''}). Each excess attachment = 1 negative level — the −1 on attack rolls, saves, grapple, and all skill checks is WIRED LIVE (v8.92.0) with provenance on each cell; the −1 on ability checks, −1 effective level on die rolls, and a caster/manifester's lost top-level spell/power stay at the table (choice-dependent). Removal without <i>Cybernetic Surgery</i>: 1d4 permanent Con drain. Implants cost −2 Purchase DC per Tech Scale above their own (scenario TS ${ts}).</div>`);
  if (owned.length && !hasAntiShock) bits.push(`<div style="font-size:11px;color:#d4b870;margin-bottom:.5rem;" title="HH p.333: a creature with one or more cybernetic attachments takes 50% more damage from any attack that deals electricity damage. An Anti-Shock Implant (TS 6) negates this.">⚡ Electricity vulnerability: +50% electricity damage (no Anti-Shock Implant)</div>`);
  if (owned.length && hasAntiShock) bits.push(`<div style="font-size:11px;color:var(--tg80);margin-bottom:.5rem;">⚡ Electricity vulnerability negated — Anti-Shock Implant.</div>`);
  if (hasLostArm(c)) {
    bits.push(hasCyberArm(c)
      ? `<div style="font-size:11px;color:var(--tg80);margin-bottom:.5rem;">🦾 Lost Arm (drawback) — REPLACED by a cybernetic arm: off hand restored, two-handed weapons and the −2 Climb/Swim/grapple penalties lifted.</div>`
      : `<div style="font-size:11px;color:#e08080;margin-bottom:.5rem;">🦾 Lost Arm (drawback) — no off hand, no two-handed weapons, −2 Climb/Swim/grapple. Install a Prosthetic Arm (any tier) to restore the arm; arm-mounted implants need the prosthetic first.</div>`);
  }
  // owned rows
  if (owned.length) {
    bits.push('<table class="sk-tbl" style="margin-bottom:.6rem;"><thead><tr><th>Implant</th><th>Slot</th><th>Type</th><th>Hard/HP</th><th></th></tr></thead><tbody>');
    owned.forEach((r, i) => {
      const def = cyberDef(r.n) || {};
      const noCnt = def.cnt === 0 ? ' <span style="font-size:9px;color:var(--tg70);" title="Does not count toward the attachment maximum.">free</span>' : '';
      bits.push(`<tr><td><span style="cursor:help;border-bottom:1px dotted rgba(120,175,205,.5);" title="${escapeHTML((def.d || '') + (def.rx && def.rx !== '—' ? '\nRestriction: ' + def.rx : ''))}">${escapeHTML(r.n)}</span>${r.param ? ` <span style="color:var(--gold);font-size:11px;">(${escapeHTML(r.param)})</span>` : ''}${noCnt}</td><td style="font-size:11px;">${CYBER_SLOTS[def.slot] || def.slot || ''}</td><td style="font-size:11px;">${def.type || ''}</td><td style="font-size:11px;">${escapeHTML(def.hard || '')}</td><td><button class="btn btn-sm" style="font-size:10px;" onclick="removeCyber(${i})">✕</button></td></tr>`);
    });
    bits.push('</tbody></table>');
  }
  // add browser (TS-gated)
  const avail = CYBERNETICS_DB.filter(e => e.ts <= ts);
  if (avail.length) {
    bits.push(`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><select id="gear-cyber-sel" style="font-size:11px;max-width:330px;">` +
      avail.map((e, idx) => `<option value="${CYBERNETICS_DB.indexOf(e)}">${escapeHTML(e.n)} — TS ${e.ts} · PDC ${escapeHTML(String(cyberPDC(c, e)))}${e.rx !== '—' ? ' · ' + escapeHTML(e.rx) : ''}</option>`).join('') +
      `</select><button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="addCyberFromSel()">+ Install</button><span style="font-size:10px;opacity:var(--o55);color:var(--dim);">surgery assumed — Treat Injury / Cybernetic Surgery at the table</span></div>`);
  } else {
    bits.push(`<div style="font-size:11px;opacity:var(--o60);color:var(--dim);">No implants available at Tech Scale ${ts} — cybernetics begins at TS 5.</div>`);
  }
  body.innerHTML = bits.join('');
}

function addCyberFromSel() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const sel = document.getElementById('gear-cyber-sel'); if (!sel) return;
  const def = CYBERNETICS_DB[Number(sel.value)]; if (!def) return;
  // Lost Arm interlock: arm-mounted implants need the prosthetic arm first.
  if (def.needsArm && !hasCyberArm(c)) { toast(`${def.n} mounts IN a prosthetic arm — install a Prosthetic Arm first (HH p.335${hasLostArm(c) ? '; Lost Arm: the prosthetic also restores the off hand' : ''}).`); return; }
  if (def.needsProsthetic && !hasCyberArm(c) && !getCyber(c).some(r => (cyberDef(r.n) || {}).replaceLeg)) { toast(`${def.n} attaches to a prosthetic limb — install a Prosthetic Arm or Leg first.`); return; }
  const finish = (param) => {
    c.cybernetics = getCyber(c).concat([{ n: def.n, ...(param ? { param } : {}), at: new Date().toLocaleDateString() }]);
    syncCyberFeats(c);  // v8.99.0: feat grants materialize immediately
    const exc = cyberExcess(c);
    save(); renderGear(); renderSheet(); renderSkills();
    logAct(`🦾 Installed ${def.n}${param ? ' (' + param + ')' : ''} — PDC ${cyberPDC(c, def)}${def.rx !== '—' ? ', ' + def.rx : ''}.${exc ? ` ⚠ ${exc} attachment${exc > 1 ? 's' : ''} over the maximum — ${exc} negative level${exc > 1 ? 's' : ''} until removed or Con rises.` : ''}`);
    toast(`${def.n} installed${exc ? ` — ⚠ over the attachment maximum (${exc} negative level${exc > 1 ? 's' : ''})` : ''}.`);
  };
  if (def.param === 'skill') {
    const classSkills = SKILLS.filter(sk => isClassSkill(sk.n, c)).map(sk => sk.n);
    openChoiceModal('Skill Implant — choose one CLASS skill (+2 competence)', classSkills, v => { if (v) finish(v); });
    return;
  }
  if (def.param === 'feat') {
    // v9.2.2 (Adam 2026-10-06; HH p.337 "cannot duplicate a metamagic or
    // psionic feat"): Magic and Power feats are not offered — the Psi
    // Implant is the one route to a Power feat (Wild Talent).
    openChoiceModal('Feat Implant — name the granted feat (prerequisites must be met; no Magic or Power feats)', (FEATS_DB.filter(f => f.family !== 'Magic' && f.family !== 'Power').map(f => f.n)), v => { if (v) finish(v); });
    return;
  }
  finish(null);
}

function removeCyber(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const r = getCyber(c)[idx]; if (!r) return;
  c.cybernetics = getCyber(c).filter((_, i) => i !== idx);
  syncCyberFeats(c);  // v8.99.0: granted feats cascade away (HH p.337)
  save(); renderGear(); renderSheet(); renderSkills();
  logAct(`🦾 Removed ${r.n}. Without Cybernetic Surgery, removal deals 1d4 permanent Con drain (HH p.333) — adjudicate at the table.`);
  toast(`${r.n} removed — 1d4 permanent Con drain unless removed with Cybernetic Surgery.`);
}
