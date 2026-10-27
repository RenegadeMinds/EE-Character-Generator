// =============================================================================
// js/rules/vehicles.js
// VEHICLES — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Vehicles, power armor, mecha and starships: integrity, piloting
//   and the statistics behind the cards.
//
// KEY NAMES (so you can search for them)
//   functions (25): vehicleIntegrity, pilotedVehicle, vehicleOperatorCheck,
//   vehicleStatStripText, equippedPowerArmor, paLoadout, paActiveSystems,
//   paShieldBonus, secondSkinMaxHP, activeSecondSkin,
//   buildPowerArmorSkillBonuses, mechaDefOf, mechaTouchAC,
//   shipWeaponTakesMount, shipMountOf, shipHullSizeStep, shipWeaponSizeStep,
//   shipLinkedDice, shipThreatRange, shipLinkOf, shipBatteryOf,
//   shipHasMainCannon, shipLinkOptions, shipDefOf, shipSections
//
// WHERE IT CAME FROM
//   Gathered from js/app/57-armor-and-vehicle-integrity.js, js/app/58-power-
//   armor.js, js/app/59-mecha.js, js/app/60-starships.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ============================================================================
// v8.13.x SEGMENT A — VEHICLES (Adam's mecha/starship pass, 2026-09-02).
// HH pp.313-326 stat tables (VEHICLES_DB, 80 entries + 10 scaled TS1–3 hulls, v9.5.0), GMG pp.92-93/473+
// rules. Commerce on Gear (one economy); operation on the gated 🕹 Vehicles
// tab. Firm-wired stats; stored fields: it.vehicleDamage (lazy 0),
// it.piloted (ONE at a time — the Sheet dashboard reflects it),
// it.jointOwners (fluff — Adam's "legal record" ruling; the Gear owner is
// the bookkeeping owner). Damage ladder mirrors armor: hardness first,
// DISABLED at 0 HP, destroyed past 1.5× max (HH p.181 — explicit for
// vehicles). Repair: 1 hr / DC 20 / 2d6 HP (workshop + mechanical tool kit).
function vehicleIntegrity(it) {
  if (!it) return null;
  let def = null;
  if (it.catalogue === 'vehicle') def = getCatalogueEntry('vehicle', it.ref);
  // v8.17.0 Segment C: mecha share the hull-integrity machinery (hardness
  // from the superstructure, HP from the frame).
  else if (it.catalogue === 'mecha') def = mechaDefOf(it);
  if (!def) return null;
  const damage = Math.max(0, it.vehicleDamage || 0);
  const maxHP = def.hp;
  const destroyThreshold = Math.ceil(maxHP * 1.5);
  const destroyed = damage >= destroyThreshold;
  return { def, hardness: def.hardness, maxHP, damage, hp: maxHP - damage,
           broken: !destroyed && damage >= maxHP, destroyed, destroyThreshold };
}
function pilotedVehicle(c) {
  // v8.17.0: one piloted machine at a time — conventional vehicle OR mecha.
  return getCharItems(c).find(it => (it.catalogue === 'vehicle' || it.catalogue === 'mecha') && it.piloted) || null;
}
// The character's operating-skill total for a vehicle (same full composition
// the Skills tab shows: ranks + effective ability + misc + active synergies).
// Drive and Pilot are Dex-based (GMG p.92); v9.5.0 adds the TS1–3 hulls,
// worked with Profession (Transporter) (Wis) or Handle Animal (Cha).
function vehicleOperatorCheck(c, def) {
  const sk = def.skill || 'Drive';
  const ranks = getLiveSkillRanks(c, sk);
  const misc = ((computeSkillMiscBonuses(c) || {})[sk] || {}).total || 0;
  const syn = (computeSkillSynergies(sk, c).auto || []).reduce((s, e) => s + (e.value || 0), 0);
  const _abK = ((SKILLS.find(x => x.n === sk) || {}).k) || 'DEX';
  const _abI = Math.max(0, ['STR','DEX','CON','INT','WIS','CHA'].indexOf(_abK));
  const base = ranks + am(effAttrs(c)[_abI]) + misc + syn;
  return { skill: sk, ability: _abK, base, withManeuver: base + (def.maneuver_mod || 0), initPenalty: Math.min(0, def.maneuver_mod || 0) };
}
function vehicleStatStripText(def) {
  return `${def.skill} · ${def.maneuver_class} (${def.maneuver_mod >= 0 ? '+' : ''}${def.maneuver_mod}) · speed ${def.top_speed} (${def.chase_speed} chase) · T/AC ${def.touch_ac}/${def.total_ac} · Hard ${def.hardness} · HP ${def.hp} · ${SIZE_FULL[def.size] || def.size}${def.polyhex ? ` (${def.polyhex})` : ''} · crew ${def.crew} + ${def.passengers} pass · ${def.cargo}`;
}
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
    || (it.catalogue === 'mecha' ? mechaDefOf(it) : null);
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
  const it = equippedPowerArmor(c);
  if (!it) return out;
  const push = (skill, value, label) => (out['skill:' + skill] = out['skill:' + skill] || []).push(
    { type: 'equipment', source: 'pa:' + it.id + ':' + label, value, label });
  for (const { line, sys } of paActiveSystems(it)) {
    if (sys.wired.navSpot) { push('Navigate', sys.wired.navSpot, line.gear); push('Spot', sys.wired.navSpot, line.gear); }
    if (sys.wired.hideMs) { push('Hide', sys.wired.hideMs, line.gear); push('Move Silently', sys.wired.hideMs, line.gear); }
  }
  return out;
}
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
function shipWeaponTakesMount(name) { return !/^(Missile|Mine),/.test(name) && name !== 'Grapplers' && name !== 'Tractor Beam Emitter'; }
function shipMountOf(line) {
  const kind = SHIP_MOUNT_KINDS[line.mount] ? line.mount : 'turret';
  return Object.assign({ kind, arcs: line.arcs || [] }, SHIP_MOUNT_KINDS[kind]);
}
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
