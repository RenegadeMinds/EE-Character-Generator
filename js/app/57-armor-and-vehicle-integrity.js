// =============================================================================
// js/app/57-armor-and-vehicle-integrity.js
// ARMOR AND VEHICLE INTEGRITY
// =============================================================================
//
// WHAT'S IN HERE
//   The Tracker's armor-integrity panel, and vehicles: integrity, piloting,
//   joint owners, hits and repairs.
//
// KEY NAMES (so you can search for them)
//   tables/objects: SIZE_FULL
//   functions (14): trackedArmorItems, renderArmorIntegrity, armorIncomingHit,
//   armorRepair, vehicleIntegrity, pilotedVehicle, vehicleOperatorCheck,
//   togglePiloted, setJointOwners, vehicleIncomingHit, vehicleRepair,
//   vehicleStatStripText, renderVehicleInventory, renderVehicles
//
// LOAD ORDER
//   File 57 of 68. index.html loads it after
//   js/app/56-supernatural-attributes-pools-psi-focus.js and before
//   js/app/58-power-armor.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 48147-48442 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 48147-48442; unchanged below this line ----
// ============================================================================
// v8.13.0 (Adam's T/ACtical armor pass): Tracker Armor Integrity panel —
// hardness + HP per equipped armor/shield, the incoming-hit calculator
// ("let the generator take the math pain out"), repair, and state banners.
function trackedArmorItems(c) {
  return getCharItems(c).filter(it => it.catalogue === 'armor' && it.equipped && armorItemIntegrity(it));
}
function renderArmorIntegrity(c) {
  const host = document.getElementById('tr-armor');
  if (!host) return;
  const items = trackedArmorItems(c);
  if (!items.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const rows = items.map(it => {
    const g = armorItemIntegrity(it);
    const name = enchantDisplayName(it);
    const prof = isProficientWithArmor(c, it.ref);
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? '#555' : g.broken ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
    const hardTip = g.hardParts.join(' + ') + ' · HP: ' + g.hpParts.join(' + ')
      + (g.alwaysIntercede ? '\nAlways intercedes: every hit applies this hardness; full AC is for confirming crits only (power armor / Environmental Seal).' : `\nHits in the band [Touch AC, Total AC) strike this ${g.isShield ? 'shield' : 'armor'} — hardness applies, remainder split between item and wearer.`)
      + (prof ? '\nProficient: the WEARER chooses how remaining damage is split.' : '\n⚠ NOT proficient: the ATTACKER chooses the split (hardness still applies first).')
      + (g.selfRepairing ? '\nSelf-Repairing gadget: 1 HP/minute; fully restored by a night’s rest.' : '\nArmor does not heal on its own — repairs need the Repair skill (tool kit; task table HH p.181) or services.');
    const state = g.destroyed
      ? `<span style="color:#999;font-size:10px;">☠ DESTROYED — damage ${g.damage} ≥ ${g.destroyThreshold} (1.5× max): beyond repair, salvage only (HH p.181 rule). GM may adjudicate restoration.</span>`
      : g.broken
      ? `<span style="color:var(--red-text);font-size:10px;">⚑ BROKEN — 0 HP: no AC bonus (penalties remain); enchantment suppressed (book: lost permanently — GM adjudicates). Repairable up to ${g.destroyThreshold - 1 - g.maxHP} more damage.</span>`
      : '';
    return `<div style="margin:5px 0;padding:4px 0;border-top:1px solid rgba(200,151,30,.12);">
      <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;">
        <span style="flex:1;cursor:help;" title="${escapeHTML(hardTip)}">${g.isShield ? '🛡' : '⛨'} ${escapeHTML(name)}${g.alwaysIntercede ? ' <span style="color:#78afcd;font-size:9px;" title="Power armor / Environmental Seal: always intercedes">◈</span>' : ''}${prof ? '' : ' <span style="color:#d4b870;font-size:9px;">⚠ non-proficient</span>'}</span>
        <span style="font-size:10.5px;color:var(--g70);">Hardness <b style="color:var(--gold);">${g.hardness}</b></span>
        <b style="color:${barColor};">${g.hp}</b><span style="opacity:var(--o55);color:var(--dim);">/${g.maxHP}</span>
        <button class="btn btn-sm" style="font-size:10px;padding:0 6px;" title="Incoming hit — enter the damage; the generator applies hardness and offers the split" onclick="armorIncomingHit('${it.id}')">⚔ Hit</button>
        <button class="btn btn-sm" style="font-size:10px;padding:0 6px;" title="Repair points of damage (Repair skill / services / GM)" onclick="armorRepair('${it.id}')">🔧</button>
      </div>
      <div class="bar-wrap" style="height:5px;margin-top:2px;"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      ${state}
    </div>`;
  }).join('');
  host.innerHTML = `<div class="sec-head sm">Armor Integrity <span style="font-size:9px;color:var(--g45);text-transform:none;letter-spacing:0;">· T/ACtical (HH p.382)</span></div>` + rows;
}
// The incoming-hit calculator. Input "damage [hardness-ignored]" (a magic
// weapon ignores 5/enh point, vibro-blades all); hardness reduces first, then
// the remainder is split — wearer's choice when proficient, attacker's when
// not (either way the generator just applies whatever split is entered).
function armorIncomingHit(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = armorItemIntegrity(it); if (!g) return;
  if (g.destroyed) { toast('That armor is destroyed — it no longer intercedes.'); return; }
  const name = enchantDisplayName(it);
  openChoiceModal(`⚔ Hit on ${name} — enter the raw damage, optionally followed by points of hardness ignored (e.g. "14" or "14 5" for a +1 weapon)`, [], (val) => {
    const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
    if (!m) { toast('Enter the damage as a number, e.g. "14" or "14 5".'); return; }
    const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
    const effHard = Math.max(0, g.hardness - ign);
    const net = Math.max(0, dmg - effHard);
    const math = `${dmg} damage − hardness ${g.hardness}${ign ? ` (−${ign} ignored = ${effHard})` : ''} = ${net}`;
    if (net <= 0) {
      logAct(`Hit absorbed by ${name}: ${math}.`);
      save(); toast(`${name} shrugs it off — ${math}.`);
      return;
    }
    const prof = isProficientWithArmor(c, it.ref);
    const who = prof ? 'You are proficient — the wearer chooses' : '⚠ Non-proficient — the ATTACKER chooses';
    const optAll = `All ${net} to ${name} (HP ${g.hp} → ${g.hp - net})`;
    const optChar = `All ${net} to ${c.name} (HP ${c.currentHP ?? '?'} → ${(c.currentHP ?? 0) - net})`;
    const optSplit = 'Split it — enter how much the armor takes';
    openChoiceModal(`${math}. ${who} how to apply the remainder:`, [optAll, optChar, optSplit], (pick) => {
      const apply = (toArmor) => {
        toArmor = Math.max(0, Math.min(net, toArmor));
        const toChar = net - toArmor;
        if (toArmor) it.armorDamage = (it.armorDamage || 0) + toArmor;
        if (toChar && typeof c.currentHP === 'number') c.currentHP = Math.max(-999, c.currentHP - toChar);
        const g2 = armorItemIntegrity(it);
        logAct(`⚔ Hit on ${name}: ${math}; ${toArmor} to the ${g.isShield ? 'shield' : 'armor'} (${g2.hp}/${g2.maxHP})${toChar ? `, ${toChar} to ${c.name}` : ''}.${g2.destroyed ? ' ☠ DESTROYED.' : g2.broken ? ' ⚑ BROKEN — no AC bonus until repaired.' : ''}`);
        save(); renderArmorIntegrity(c); renderTracker(); renderSheet();
        toast(g2.destroyed ? `${name} is DESTROYED.` : g2.broken ? `${name} is BROKEN — no AC bonus until repaired.` : `Applied: ${toArmor} to ${name}${toChar ? `, ${toChar} to ${c.name}` : ''}.`);
      };
      if (pick === optAll) apply(net);
      else if (pick === optChar) apply(0);
      else if (pick === optSplit) openChoiceModal(`How much of the ${net} does ${name} take? (rest goes to ${c.name})`, [], (n) => {
        const v = parseInt(String(n || '').trim(), 10);
        if (isNaN(v)) { toast('Enter a number.'); return; }
        apply(v);
      });
    });
  });
}
function armorRepair(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = armorItemIntegrity(it); if (!g) return;
  const name = enchantDisplayName(it);
  if (g.destroyed) { toast(`${name} is destroyed — beyond repair (salvage only, HH p.181). The GM may adjudicate an exceptional restoration via ± on the item's damage in a future pass.`); }
  if (!g.damage) { toast(`${name} is undamaged.`); return; }
  openChoiceModal(`🔧 Repair ${name} — enter HP repaired (${g.damage} damage outstanding; Repair skill task table HH p.181, tool kit required)`, [], (val) => {
    const v = parseInt(String(val || '').trim(), 10);
    if (isNaN(v) || v <= 0) { toast('Enter a positive number.'); return; }
    // A destroyed item reaching this point is a deliberate GM override — logged as such below.
    it.armorDamage = Math.max(0, (it.armorDamage || 0) - v);
    const g2 = armorItemIntegrity(it);
    logAct(`🔧 Repaired ${Math.min(v, g.damage)} HP on ${name} (${g2.hp}/${g2.maxHP})${g.destroyed ? ' — GM override: repaired past the destroyed threshold' : ''}.`);
    save(); renderArmorIntegrity(c); renderSheet();
    toast(`${name}: ${g2.hp}/${g2.maxHP} HP${g2.broken ? ' — still broken' : ''}.`);
  });
}

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
function togglePiloted(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = vehicleIntegrity(it);
  if (!it.piloted && g && (g.broken || g.destroyed)) { toast(`${enchantDisplayName(it)} is ${g.destroyed ? 'destroyed' : 'disabled (0 HP)'} — it cannot be piloted.`); return; }
  const was = !!it.piloted;
  for (const v of getCharItems(c)) if (v.catalogue === 'vehicle' || v.catalogue === 'mecha') v.piloted = false;
  it.piloted = !was;
  logAct(it.piloted ? `🕹 Now piloting ${enchantDisplayName(it)}.` : `Dismounted ${enchantDisplayName(it)}.`);
  save(); renderVehicles(); renderSheet();
}
async function setJointOwners(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const v = await textModal('✎ Registered owners', `Joint owners of ${enchantDisplayName(it)} — a "legal" record for the table (bookkeeping stays with ${c.name}). Leave blank to clear.`, it.jointOwners || '');
  if (v === null) return;
  it.jointOwners = v.trim() || undefined;
  save(); renderVehicles();
}
function vehicleIncomingHit(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = vehicleIntegrity(it); if (!g) return;
  if (g.destroyed) { toast('That vehicle is destroyed.'); return; }
  const name = enchantDisplayName(it);
  openChoiceModal(`⚔ Hit on ${name} — enter the raw damage, optionally followed by points of hardness ignored (e.g. "22" or "22 10" for a LAW rocket)`, [], (val) => {
    const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
    if (!m) { toast('Enter the damage as a number, e.g. "22" or "22 10".'); return; }
    const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
    const net = Math.max(0, dmg - Math.max(0, g.hardness - ign));
    const math = `${dmg} damage − hardness ${g.hardness}${ign ? ` (−${ign} ignored)` : ''} = ${net}`;
    if (net <= 0) { logAct(`Hit absorbed by ${name}: ${math}.`); save(); toast(`${name} shrugs it off — ${math}.`); return; }
    it.vehicleDamage = (it.vehicleDamage || 0) + net;
    const g2 = vehicleIntegrity(it);
    if (g2.destroyed && it.piloted) it.piloted = false;
    logAct(`⚔ Hit on ${name}: ${math} (${g2.hp}/${g2.maxHP}).${g2.destroyed ? ' ☠ DESTROYED.' : g2.broken ? ' 🛑 DISABLED at 0 HP.' : ''}`);
    save(); renderVehicles(); renderSheet();
    toast(g2.destroyed ? `${name} is DESTROYED.` : g2.broken ? `${name} is DISABLED.` : `${name}: ${g2.hp}/${g2.maxHP} HP.`);
  });
}
function vehicleRepair(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = vehicleIntegrity(it); if (!g) return;
  if (g.destroyed) toast(`${g.def.name} is beyond repair (HH p.181: negative HP past half max = salvage only). Repairing past that is a GM override — logged as such.`);
  if (!g.damage) { toast('Undamaged.'); return; }
  openChoiceModal(`🔧 Repair ${enchantDisplayName(it)} — enter HP repaired (${g.damage} damage outstanding; 1 hr / Repair DC 20 / 2d6 HP per attempt, mechanical tool kit & workshop — HH p.181)`, [], (val) => {
    const v = parseInt(String(val || '').trim(), 10);
    if (isNaN(v) || v <= 0) { toast('Enter a positive number.'); return; }
    it.vehicleDamage = Math.max(0, (it.vehicleDamage || 0) - v);
    const g2 = vehicleIntegrity(it);
    logAct(`🔧 Repaired ${Math.min(v, g.damage)} HP on ${enchantDisplayName(it)} (${g2.hp}/${g2.maxHP})${g.destroyed ? ' — GM override past the destroyed threshold' : ''}.`);
    save(); renderVehicles(); renderSheet();
    toast(`${enchantDisplayName(it)}: ${g2.hp}/${g2.maxHP} HP.`);
  });
}
const SIZE_FULL = { S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal' };
function vehicleStatStripText(def) {
  return `${def.skill} · ${def.maneuver_class} (${def.maneuver_mod >= 0 ? '+' : ''}${def.maneuver_mod}) · speed ${def.top_speed} (${def.chase_speed} chase) · T/AC ${def.touch_ac}/${def.total_ac} · Hard ${def.hardness} · HP ${def.hp} · ${SIZE_FULL[def.size] || def.size}${def.polyhex ? ` (${def.polyhex})` : ''} · crew ${def.crew} + ${def.passengers} pass · ${def.cargo}`;
}
// Gear inventory rows for vehicles — lighter than renderInventoryList (no
// mastercraft/gadget/equip machinery; that's the vehicle-gear pass later).
function renderVehicleInventory(c, techScale) {
  const items = getCharItems(c).filter(i => i.catalogue === 'vehicle');
  if (!items.length) return `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">None owned yet.</div>`;
  return items.map(it => {
    const def = getCatalogueEntry('vehicle', it.ref); if (!def) return '';
    const g = vehicleIntegrity(it);
    const name = enchantDisplayName(it);
    const state = g.destroyed ? ' <span style="color:#999;font-size:10px;">☠ DESTROYED</span>' : g.broken ? ' <span style="color:var(--red-text);font-size:10px;">🛑 DISABLED</span>' : (it.piloted ? ' <span style="color:#78afcd;font-size:10px;">🕹 piloted</span>' : '');
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
      <div>
        <b>${escapeHTML(name)}</b>${it.customName ? ` <span style="opacity:var(--o55);color:var(--dim);font-size:10px;">(${escapeHTML(it.ref)})</span>` : ''}${state}
        <div style="font-size:9.5px;color:var(--g55);">${escapeHTML(vehicleStatStripText(def))}${g.damage ? ` · <b style="color:#d4865a;">HP ${g.hp}/${g.maxHP}</b>` : ''}</div>
      </div>
      <div style="white-space:nowrap;">
        <button class="btn btn-sm" style="font-size:10px;" onclick="showPage('vehicles')" title="Operate on the Vehicles tab">🕹 Operate</button>
        <button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')" title="Custom name">✎</button>
        <button class="btn btn-sm" style="font-size:10px;" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (HH p.257 Sale Price rule)">💱</button>
        <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}
// The 🕹 Vehicles tab — one operations card per owned vehicle.
function renderVehicles() {
  const prompt = document.getElementById('vh-prompt'), cont = document.getElementById('vh-content');
  if (!prompt || !cont) return;
  const c = curId ? chars.find(x => x.id === curId) : null;
  if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  document.getElementById('vh-hero-nm').textContent = `${c.name} — Motor Pool`;
  const list = document.getElementById('vh-list');
  const items = getCharItems(c).filter(i => i.catalogue === 'vehicle');
  // v8.14.x Segment B FIX: power armor and Second Skin cards render even
  // with no conventional vehicles owned — build all three groups first.
  const paCards = renderPowerArmorCards(c);
  const skinCard = renderSecondSkinCard(c);
  const mechaCards = renderMechaCards(c);
  const shipCards = renderStarshipCards(c);
  if (!items.length && !paCards && !skinCard && !mechaCards && !shipCards) { list.innerHTML = `<div style="padding:1rem;font-size:13px;color:var(--g40);">Nothing pilotable owned — purchase vehicles, mecha, starships, or power armor on the ⚒ Gear tab.</div>`; return; }
  list.innerHTML = items.map(it => {
    const def = getCatalogueEntry('vehicle', it.ref); if (!def) return '';
    const g = vehicleIntegrity(it);
    const chk = vehicleOperatorCheck(c, def);
    const name = enchantDisplayName(it);
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? '#555' : g.broken ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
    const cells = [
      ['Crew / Pass', `${def.crew} / ${def.passengers}`], ['Cargo', def.cargo],
      ['Maneuver', `${def.maneuver_class} (${def.maneuver_mod >= 0 ? '+' : ''}${def.maneuver_mod})`],
      ['Top Speed', `${def.top_speed} <span style="opacity:var(--o60);color:var(--dim);">(${def.chase_speed} chase)</span>`],
      ['T/AC', `${def.touch_ac}/${def.total_ac}`], ['Hardness', def.hardness],
      ['Size', `${SIZE_FULL[def.size] || def.size}${def.polyhex ? ` (${def.polyhex})` : ''}`],
      ['Purchase', `DC ${def.purchase_dc} · ${def.restriction} (+${def.restriction_mod})`],
    ].map(([l, v]) => `<div style="border:1px solid rgba(200,151,30,.15);padding:3px 7px;border-radius:2px;"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--g55);">${l}</div><div style="font-size:12px;color:var(--parch);">${v}</div></div>`).join('');
    const stateBanner = g.destroyed
      ? `<div style="color:#999;font-size:11px;margin-top:4px;">☠ DESTROYED — damage ${g.damage} ≥ ${g.destroyThreshold} (1.5× max HP): beyond repair, salvage only (HH p.181).</div>`
      : g.broken
      ? `<div style="color:var(--red-text);font-size:11px;margin-top:4px;">🛑 DISABLED — 0 HP: inoperable until repaired (repairable up to ${g.destroyThreshold - 1 - g.maxHP} more damage before the wreck is total).</div>`
      : '';
    return `<div class="panel" style="margin-bottom:.8rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;color:var(--gold);">${it.piloted ? '🕹 ' : ''}${escapeHTML(name)} <span style="font-size:10px;color:var(--g50);">TS ${def.ts} · ${escapeHTML(def.category)}</span></div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;${it.piloted ? 'border-color:rgba(120,175,205,.6);color:#78afcd;' : ''}" onclick="togglePiloted('${it.id}')">${it.piloted ? '🕹 Dismount' : '🕹 Pilot'}</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="vehicleIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="vehicleRepair('${it.id}')">🔧 Repair</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="setJointOwners('${it.id}')" title="Joint owners — the 'legal' record; bookkeeping stays here">✎ Owners</button>
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;">${cells}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:11.5px;">
        <span>HP <b style="color:${barColor};">${g.hp}</b>/${g.maxHP}</span>
        <div class="bar-wrap" style="flex:1;height:6px;"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      </div>
      ${stateBanner}
      ${def.note ? `<div style="font-size:10.5px;opacity:.7;margin-top:4px;">${escapeHTML(def.note)}</div>` : ''}
      <div style="font-size:11px;color:var(--g70);margin-top:6px;" title="Ranks + effective ${chk.ability} + misc + synergies, then the vehicle's maneuver modifier. Maneuver penalties (not bonuses) also apply to Initiative — GMG p.92.">Your ${chk.skill} check in this vehicle: <b style="color:var(--gold);">${chk.withManeuver >= 0 ? '+' : ''}${chk.withManeuver}</b> <span style="opacity:var(--o60);color:var(--dim);">(${chk.base >= 0 ? '+' : ''}${chk.base} skill ${def.maneuver_mod >= 0 ? '+' : '−'} ${Math.abs(def.maneuver_mod)} maneuver)</span>${chk.initPenalty ? ` · Initiative ${chk.initPenalty} while piloting` : ''}</div>
      <div style="font-size:10px;color:var(--g45);margin-top:3px;">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`} · Roles: driver (move action to drive) · copilot (aid another) · gunners · passengers — GMG p.473.</div>
    </div>`;
  }).join('') + mechaCards + shipCards + paCards + skinCard;
}

