// =============================================================================
// js/ui/vehicles/vehicles.js
// VEHICLES / VEHICLES — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Vehicles page: vehicle inventory, piloting, hits
//   and repairs.
//
// KEY NAMES (so you can search for them)
//   functions (6): togglePiloted, setJointOwners, vehicleIncomingHit,
//   vehicleRepair, renderVehicleInventory, renderVehicles
//
// WHERE IT CAME FROM
//   Gathered from js/app/57-armor-and-vehicle-integrity.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
// Gear inventory rows for vehicles — lighter than renderInventoryList (no
// mastercraft/gadget/equip machinery; that's the vehicle-gear pass later).
function renderVehicleInventory(c, techScale) {
  const items = getCharItems(c).filter(i => i.catalogue === 'vehicle');
  if (!items.length) return `<div class="o-50 c-dim fs-11 p-6-0">None owned yet.</div>`;
  return items.map(it => {
    const def = getCatalogueEntry('vehicle', it.ref); if (!def) return '';
    const g = vehicleIntegrity(it);
    const name = enchantDisplayName(it);
    const state = g.destroyed ? ' <span class="fs-10" style="color:#999;">☠ DESTROYED</span>' : g.broken ? ' <span class="c-red-text fs-10">🛑 DISABLED</span>' : (it.piloted ? ' <span class="fs-10" style="color:#78afcd;">🕹 piloted</span>' : '');
    return `<div class="justify-between items-center gap-8 p-4-0 fs-12" style="display:flex;border-bottom:1px solid rgba(200,151,30,.08);">
      <div>
        <b>${escapeHTML(name)}</b>${it.customName ? ` <span class="o-55 c-dim fs-10">(${escapeHTML(it.ref)})</span>` : ''}${state}
        <div class="fs-9_5 c-g55">${escapeHTML(vehicleStatStripText(def))}${g.damage ? ` · <b style="color:#d4865a;">HP ${g.hp}/${g.maxHP}</b>` : ''}</div>
      </div>
      <div class="nowrap">
        <button class="fs-10 btn btn-sm" onclick="showPage('vehicles')" title="Operate on the Vehicles tab">🕹 Operate</button>
        <button class="fs-10 btn btn-sm" onclick="renameItem('${it.id}')" title="Custom name">✎</button>
        <button class="fs-10 btn btn-sm" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (HH p.257 Sale Price rule)">💱</button>
        <button class="fs-10 btn btn-sm btn-danger" onclick="removeItemFromChar('${it.id}')">✕</button>
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
  if (!items.length && !paCards && !skinCard && !mechaCards && !shipCards) { list.innerHTML = `<div class="p-1rem fs-13 c-g40">Nothing pilotable owned — purchase vehicles, mecha, starships, or power armor on the ⚒ Gear tab.</div>`; return; }
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
      ['Top Speed', `${def.top_speed} <span class="o-60 c-dim">(${def.chase_speed} chase)</span>`],
      ['T/AC', `${def.touch_ac}/${def.total_ac}`], ['Hardness', def.hardness],
      ['Size', `${SIZE_FULL[def.size] || def.size}${def.polyhex ? ` (${def.polyhex})` : ''}`],
      ['Purchase', `DC ${def.purchase_dc} · ${def.restriction} (+${def.restriction_mod})`],
    ].map(([l, v]) => `<div class="rounded-2" style="border:1px solid rgba(200,151,30,.15);padding:3px 7px;"><div class="fs-8_5 uppercase ls-0_06em c-g55">${l}</div><div class="fs-12 c-parch">${v}</div></div>`).join('');
    const stateBanner = g.destroyed
      ? `<div class="fs-11 mt-4" style="color:#999;">☠ DESTROYED — damage ${g.damage} ≥ ${g.destroyThreshold} (1.5× max HP): beyond repair, salvage only (HH p.181).</div>`
      : g.broken
      ? `<div class="c-red-text fs-11 mt-4">🛑 DISABLED — 0 HP: inoperable until repaired (repairable up to ${g.destroyThreshold - 1 - g.maxHP} more damage before the wreck is total).</div>`
      : '';
    return `<div class="mb-0_8rem panel">
      <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
        <div class="font-serif fs-14 c-gold">${it.piloted ? '🕹 ' : ''}${escapeHTML(name)} <span class="fs-10 c-g50">TS ${def.ts} · ${escapeHTML(def.category)}</span></div>
        <div class="nowrap">
          <button class="btn btn-sm" style="font-size:10px;${it.piloted ? 'border-color:rgba(120,175,205,.6);color:#78afcd;' : ''}" onclick="togglePiloted('${it.id}')">${it.piloted ? '🕹 Dismount' : '🕹 Pilot'}</button>
          <button class="fs-10 btn btn-sm" onclick="vehicleIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="fs-10 btn btn-sm" onclick="vehicleRepair('${it.id}')">🔧 Repair</button>
          <button class="fs-10 btn btn-sm" onclick="setJointOwners('${it.id}')" title="Joint owners — the 'legal' record; bookkeeping stays here">✎ Owners</button>
        </div>
      </div>
      <div class="gap-5 flex-wrap mt-6" style="display:flex;">${cells}</div>
      <div class="items-center gap-8 mt-6 fs-11_5" style="display:flex;">
        <span>HP <b style="color:${barColor};">${g.hp}</b>/${g.maxHP}</span>
        <div class="flex-1 h-6 bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      </div>
      ${stateBanner}
      ${def.note ? `<div class="fs-10_5 op-0_7 mt-4">${escapeHTML(def.note)}</div>` : ''}
      <div class="fs-11 c-g70 mt-6" title="Ranks + effective ${chk.ability} + misc + synergies, then the vehicle's maneuver modifier. Maneuver penalties (not bonuses) also apply to Initiative — GMG p.92.">Your ${chk.skill} check in this vehicle: <b class="c-gold">${chk.withManeuver >= 0 ? '+' : ''}${chk.withManeuver}</b> <span class="o-60 c-dim">(${chk.base >= 0 ? '+' : ''}${chk.base} skill ${def.maneuver_mod >= 0 ? '+' : '−'} ${Math.abs(def.maneuver_mod)} maneuver)</span>${chk.initPenalty ? ` · Initiative ${chk.initPenalty} while piloting` : ''}</div>
      <div class="fs-10 c-g45 mt-3">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`} · Roles: driver (move action to drive) · copilot (aid another) · gunners · passengers — GMG p.473.</div>
    </div>`;
  }).join('') + mechaCards + shipCards + paCards + skinCard;
}

