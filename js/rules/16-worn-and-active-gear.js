// =============================================================================
// js/rules/16-worn-and-active-gear.js
// WORN AND ACTIVE GEAR
// =============================================================================
//
// WHAT'S IN HERE
//   Worn and activated equipment: gear boons, quantities, one-use items,
//   Boost/Bane rolls, and equip parameters.
//
// KEY NAMES (so you can search for them)
//   tables/objects: BOOST_BANE, ONE_HANDED_RANGED
//   functions (21): gearDef, gearBoonOf, gearBoonPush, toggleGearActive,
//   gearQty, useGearItem, boostBaneRoll, wornGearOf, setEquipParam,
//   addItemToChar, removeItemFromChar, weaponHands, twoHandedEquipped,
//   toggleTwoHandGrip, equipItemToSlot, moveWeaponHand, textModal,
//   resolveTextModal, renameItem, toggleNullified, toggleRecklessOffense
//
// LOAD ORDER
//   File 16 of 68. index.html loads it after
//   js/rules/15-combat-declarations-and-melee.js and before
//   js/rules/17-per-diem-and-class-choices.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 11670-11989 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 11670-11989; unchanged below this line ----
// ============================================================================
// v9.2.0 — WORN & ACTIVE GEAR (Adam's equipment review, 2026-10-06).
//   def.slot  → wearable in that body slot (new Back slot; Belt/Eyes/Vest):
//               competes with magic items for the same capacity.
//   def.worn  → {carry, grants[], sense, immune[]} while equipped.
//   def.active→ ⚡ Activate pushes a GEAR Boon onto c.activeEffects (same
//               banner + ✕ as powers). Gear is TECHNOLOGY: Boons from gear
//               stand through a Null Power Field (a.gear passes the NPF gate).
//   def.use   → consumables: qty + Use; Boost's Bane rolls when it ends.
// ============================================================================
function gearDef(it) { return (it && it.catalogue === 'equipment') ? getCatalogueEntry('equipment', it.ref) : null; }
function gearBoonOf(c, it) { return (c.activeEffects || []).find(a => a.gearItemId === it.id) || null; }
function gearBoonPush(c, rec) {
  if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
  c.activeEffects.push(Object.assign({ id: 'ae-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pool: 'gear', gear: true, expires: 'manual', appliedAt: new Date().toLocaleString() }, rec));
}
async function toggleGearActive(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); const def = gearDef(it); if (!def || !def.active) return;
  const on = gearBoonOf(c, it);
  if (on) { c.activeEffects = c.activeEffects.filter(a => a !== on); logAct(`⏻ ${it.ref} deactivated.`); save(); renderGear(); renderSheet(); renderSkills(); return; }
  if (def.slot && !it.equipped) { toast(`Wear ${it.ref} first (${def.slot} slot), then activate it.`); return; }
  let effects = def.active.effects.map(e => ({ ...e })), label = it.ref;
  if (def.active.choice) {
    const pick = await new Promise(res => openChoiceModal(`${it.ref} — which energy type?`, def.active.choice, res));
    if (!pick) return;
    effects = effects.map(e => e.k === 'resist' ? { ...e, energy: pick } : e); label = `${it.ref} (${pick})`;
  }
  gearBoonPush(c, { name: label, gearItemId: it.id, effects, note: def.active.note || '', durText: def.active.dur || '' });
  logAct(`⚡ ${label} activated.`); toast(`⚡ ${label} active — Boon on the Sheet; ✕ or ⏻ to end.`);
  save(); renderGear(); renderSheet(); renderSkills();
}
function gearQty(itemId, d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  it.qty = Math.max(0, (it.qty || 1) + d);
  if (it.qty === 0) c.items = c.items.filter(i => i !== it);
  save(); renderGear();
}
const BOOST_BANE = 'Boost — Bane';
function useGearItem(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); const def = gearDef(it); if (!def || !def.use) return;
  const u = def.use;
  if (u.bane) {
    // HH p.319: dosing again while the penalties stand worsens them
    // (−4 Dex / −2 Fort) and extends recovery to 48 hours.
    const bane = (c.activeEffects || []).find(a => a.name === BOOST_BANE);
    if (bane && !bane.escalated) {
      bane.effects = [{ k: 'attr', attr: 'DEX', v: -4, type: 'untyped' }, { k: 'save', save: 'fort', v: -2, type: 'untyped' }];
      bane.escalated = true; bane.durText = '48 hours (re-dosed while suffering the Bane)';
      logAct(`☠ Boost taken while suffering its Bane — penalties worsen to −4 Dex / −2 Fort, recovery 48 hours.`);
    }
  }
  if ((u.effects || []).length) {
    (c.activeEffects || []).filter(a => a.name === it.ref && a.gearUse).forEach(a => { c.activeEffects.splice(c.activeEffects.indexOf(a), 1); });
    gearBoonPush(c, { name: it.ref, gearUse: true, bane: !!u.bane, effects: u.effects.map(e => ({ ...e })), note: u.note || '', durText: u.dur || '' });
  }
  logAct(`🧪 Used ${it.ref}.`); toast(`🧪 ${it.ref} used${(u.effects || []).length ? ' — Boon on the Sheet' : ''}.`);
  gearQty(itemId, -1); renderSheet(); renderSkills();
}
// The 10% Bane roll (HH p.319), made when a Boost Boon ends — dismissed,
// or cleared by rest. The roll is shown; the GM can always override.
function boostBaneRoll(c) {
  const roll = 1 + Math.floor(Math.random() * 100);
  const hit = roll <= 10 && !(c.activeEffects || []).some(a => a.name === BOOST_BANE);
  if (hit) gearBoonPush(c, { name: BOOST_BANE, bane: false, keepOnRest: true, effects: [{ k: 'attr', attr: 'DEX', v: -2, type: 'untyped' }, { k: 'save', save: 'fort', v: -1, type: 'untyped' }], note: 'Boost side effect (HH p.319) — ✕ when 24 hours have passed', durText: '24 hours' });
  logAct(`☠ Boost wears off — Bane roll d% ${roll}: ${hit ? 'SUFFERS the Bane (−2 Dex, −1 Fort, 24 h)' : 'no side effect'}.`);
  toast(`☠ Boost ends — d% ${roll}: ${hit ? 'Bane! −2 Dex, −1 Fort for 24 hours' : 'no Bane this time'}.`);
}
function wornGearOf(c) { return getCharItems(c).filter(it => it.equipped && gearDef(it) && gearDef(it).worn); }
async function setEquipParam(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const def = getCatalogueEntry('equipment', it.ref); const P = def && def.effect && def.effect.param; if (!P) return;
  const pick = await new Promise(res => openChoiceModal(`${it.ref} — ${P.label}?`, P.options, res));
  if (!pick) return;
  it.param = pick; syncOwnedAnimals(c); save(); renderGear(); renderSkills(); renderSheet();
}
async function addItemToChar(catalogue, ref, slot, opts) {
  opts = opts || {};
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.items) c.items = [];
  const entry = getCatalogueEntry(catalogue, ref);
  if (!entry) { toast('Unknown item: ' + ref); return; }
  const techScale = scenarioTechScale(c);
  const minTs = catalogue === 'equipment' ? entry.tech_scale : ((catalogue === 'vehicle' || catalogue === 'mecha') ? entry.ts : entry.tl);
  if (typeof minTs === 'number' && minTs > techScale) {
    if (!(await confirmModal(`${ref} is Tech Scale ${minTs}; this scenario is TS${techScale}. Add anyway (GM exception)?`))) return;
  }
  // v8.7.0 (Adam): every add is Purchased (deducts funds) or Acquired (free)
  // once wealth is tracked. Conversions pass skipPurchase and gate on their
  // own price (the magic item's, not the base weapon's).
  let provenance = null;
  if (!opts.skipPurchase) {
    let priceUnits = null;
    // Mundane gear charges the MARKET-ADJUSTED DC (−2/TS below the market,
    // +5/TS above — Adam's confirmation). Magic gp prices convert straight.
    if (catalogue === 'weapon' || catalogue === 'armor') priceUnits = dollarsForDC(marketAdjustedDC(parseInt(entry.dc, 10) || 0, entry.tl || 0, techScale));
    else if (catalogue === 'equipment') priceUnits = dollarsForDC(marketAdjustedDC(entry.purchase_dc || 0, entry.tech_scale || 0, techScale));
    // v8.13.x: vehicles charge the base purchase DC market-adjusted; the
    // restriction rating (Lic/Res/Mil) is a BLACK-MARKET modifier — GM
    // applies it via ± Adjust when the purchase is illicit.
    else if (catalogue === 'vehicle') priceUnits = dollarsForDC(marketAdjustedDC(entry.purchase_dc || 0, entry.ts || 0, techScale));
    // v8.17.0 Segment C: sample mecha charge their installed-package DC.
    else if (catalogue === 'mecha') priceUnits = dollarsForDC(marketAdjustedDC(entry.purchaseDC || 0, entry.ts || 0, techScale));
    else if (catalogue === 'magic' && entry.price_gp) priceUnits = entry.type === 'modern' ? entry.price_gp : entry.price_gp * 100;
    provenance = await promptProvenance(c, ref, priceUnits);
    if (provenance === null) return;
  }
  const slotDef = ITEM_SLOTS.find(s => s.id === slot);
  // Auto-equip only if the slot has a free capacity slot (e.g. off_hand
  // holds at most 1 — adding a second weapon there must NOT silently
  // dual-equip it; it lands unequipped and the player equips it explicitly,
  // same capacity check toggleItemEquipped already enforces).
  // v8.6.1: virtual off-hand claim by an equipped two-handed weapon counts
  // against capacity, and an incoming two-hander needs the off hand free too.
  // v9.6.0 (§255): body-slot occupancy counts per GROUP (the canonical
  // twelve + Back) — a Hat must not auto-don over a worn Helmet.
  const gidAdd = slotDef && slotDef.category === 'body' ? slotGroupIdOf(slot) : null;
  const occupants = gidAdd
    ? (c.items || []).filter(i => i.equipped && SLOT_GROUPS[gidAdd].slots.includes(i.catalogue === 'equipment' ? ((gearDef(i) || {}).slot || i.slot) : i.slot)).length
      + ((SLOT_GROUPS[gidAdd].armorShares && (c.items || []).some(i => i.catalogue === 'armor' && i.equipped && i.slot === 'armor')) ? 1 : 0)
    : (c.items || []).filter(i => i.slot === slot && i.equipped).length
      + ((slot === 'off_hand' && twoHandedEquipped(c)) ? 1 : 0);
  let hasFreeSlot = slotDef && (occupants < (gidAdd ? SLOT_GROUPS[gidAdd].cap : (slotDef.capacity || 1)));
  if (hasFreeSlot && catalogue === 'weapon' && weaponHands(entry) === 2
      && (c.items || []).some(i => i.slot === 'off_hand' && i.equipped)) hasFreeSlot = false;
  const item = {
    id: 'item_' + Math.random().toString(36).slice(2, 10),
    catalogue, ref, slot: slot || 'carried',
    equipped: !!(slotDef && slotDef.category !== 'carried' && catalogue !== 'equipment' && hasFreeSlot),
    ...(catalogue === 'equipment' && entry.slot ? { slot: entry.slot } : {}),
    ...(catalogue === 'equipment' && entry.use ? { qty: 1 } : {}),
    mastercraft: null,
    gadgets: [],
  };
  if (provenance) item.provenance = provenance;
  // v9.13.0 (§271): a homebrew variant forged with a STANDARD-FEATURE gadget
  // arrives with it installed — it occupies the item's base gadget slot (the
  // "one Gadget before Mastercrafting allows additional", HH pp.274-275), so
  // the 1 + mastercraft capacity math is untouched.
  if (entry.hb_gadget) item.gadgets = [{ ref: entry.hb_gadget, builtin: true }];
  // v9.1.0: parameterized gear (Masterwork tool → a Craft; instruments → a
  // Perform row) asks once on add; re-pickable from the inventory row.
  if (catalogue === 'equipment' && entry.effect && entry.effect.param) {
    const pick = await new Promise(res => openChoiceModal(`${ref} — ${entry.effect.param.label}?`, entry.effect.param.options, res));
    if (pick) item.param = pick;
  }
  c.items.push(item);
  if (catalogue === 'equipment' && entry.animal) syncOwnedAnimals(c);   // v9.4.0
  save(); renderGear(); renderSheet(); renderSkills();
  toast(`Added ${ref}.${catalogue === 'equipment' && entry.animal ? ' 🐴 Its card is on the Sheet (Companions).' : ''}`);
}

function removeItemFromChar(itemId) {
  const c = chars.find(x => x.id === curId); if (!c || !c.items) return;
  // v9.3.0: removing a weapon frees its accessories; removing an accessory detaches it.
  for (const i of c.items) {
    if (i.mountedOn === itemId) i.mountedOn = null;
    if (i.accessories) i.accessories = i.accessories.filter(a => a.itemId !== itemId);
  }
  c.items = c.items.filter(i => i.id !== itemId);
  syncOwnedAnimals(c);   // v9.4.0: an owned animal's card leaves with its item
  save(); renderGear(); renderSheet(); renderSkills();
}

// v8.6.1 (Adam's report, 2026-09-01 — an equipped Laser Rifle left the Off
// Hand showing empty): the HH DOES distinguish handedness for melee weapons
// (kind: light / one-handed / two-handed), but the table extraction lumped
// all ranged weapons under kind:'ranged' and defaulted most firearms to
// 'one-handed' — so ranged/firearm handedness resolves by rule here: longarms,
// bows, and crossbows take two hands (which also covers the reach polearms
// the extractor mis-kinded as 'ranged' — Glaive/Guisarme/Halberd/Lance/
// Ranseur, genuinely two-handed) EXCEPT the named thrown/one-hand list and
// the pistol family. A two-handed weapon equipped in the Main Hand claims
// the Off Hand as a VIRTUAL occupant — derived, never stored (three-door:
// firm-wire logic), so legacy characters need no migration.
const ONE_HANDED_RANGED = new Set(['Dart', 'Javelin', 'Sling (w/ 10 stones)', 'Sling (w/ 10 bullets)', 'Bolas', 'Net', 'Crossbow, hand', 'Bolts, crossbow (10)', 'Shuriken']);
function weaponHands(def) {
  if (!def || def.category !== 'weapon') return 1;
  if (def.kind === 'two-handed') return 2;
  if (def.kind === 'ranged' || def.firearm) {
    if (ONE_HANDED_RANGED.has(def.n) || /pistol|derringer|revolver/i.test(def.n)) return 1;
    return 2;
  }
  return 1;
}
// The equipped held two-handed weapon claiming the off hand, if any.
function twoHandedEquipped(c) {
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
    if (!slotDef || slotDef.category !== 'held') continue;
    const def = getCatalogueEntry('weapon', it.ref);
    if (def && weaponHands(def) === 2) return it;
    // v8.60.0 (Adam): a one-handed melee weapon held in a TWO-HANDED GRIP
    // claims the off hand exactly like a true two-hander.
    if (def && it.twoHandedGrip && def.kind === 'one-handed' && !isRangedWeapon(def)) return it;
  }
  return null;
}

// v8.60.0: toggle the two-handed grip on an equipped one-handed melee
// weapon (Adam's design: available only while the off hand is free).
// Grants Str ×1.5 damage and double Power Attack; costs the off hand.
function toggleTwoHandGrip(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  if (!it.twoHandedGrip) {
    const offBusy = getCharItems(c).some(o => o.id !== it.id && o.equipped && o.slot === 'off_hand');
    if (offBusy) { toast('🤲 Off hand is occupied — free it first to take a two-handed grip.'); return; }
    // v8.91.0 (task 3): no off hand to commit — Lost Arm unreplaced.
    if (typeof offHandAvailable === 'function' && !offHandAvailable(c)) { toast('🤲 No off hand to commit — Lost Arm (drawback). Install a cybernetic Prosthetic Arm to restore it.'); return; }
    it.twoHandedGrip = true;
    if (typeof logAct === 'function') logAct(`🤲 ${it.ref}: two-handed grip — Str ×1.5 to damage, Power Attack counts double; the off hand is committed.`);
  } else {
    delete it.twoHandedGrip;
    if (typeof logAct === 'function') logAct(`🤲 ${it.ref}: back to a one-handed grip.`);
  }
  save(); renderGear();
}

// v8.6.1 (TWF pass): equip an item INTO a specific slot — reassigns the
// item's slot first, then runs the normal toggle checks. This is what makes
// dual-wielding possible: weapons land in main_hand at add time, and the Off
// Hand row's picker (or the ⇄ hand swap) moves them. Also fixes the
// pre-existing quirk where the Off Hand picker equipped an item into its OWN
// stored slot (i.e. the main hand) regardless of which row was clicked.
function equipItemToSlot(itemId, slotId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const slotDef = ITEM_SLOTS.find(s => s.id === slotId); if (!slotDef) return;
  if (!it.equipped && slotDef.accepts && !slotDef.accepts.includes(it.catalogue === 'armor' ? (getCatalogueEntry('armor', it.ref) || {}).type === 'shield' ? 'shield' : 'armor' : it.catalogue)) {
    toast(`${it.ref} can't go in the ${slotDef.label}.`); return;
  }
  it.slot = slotId;
  toggleItemEquipped(itemId);
}

// ⇄ hand swap for an equipped one-handed weapon (main ↔ off). Runs the same
// occupancy checks by unequipping, moving, and re-equipping through the
// normal path; restores the original slot if the destination refuses.
function moveWeaponHand(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it || it.catalogue !== 'weapon') return;
  const dest = it.slot === 'main_hand' ? 'off_hand' : 'main_hand';
  const wasEquipped = it.equipped, origSlot = it.slot;
  if (wasEquipped) it.equipped = false;
  it.slot = dest;
  if (wasEquipped) {
    toggleItemEquipped(itemId);
    if (!it.equipped) { it.slot = origSlot; it.equipped = true; save(); renderGear(); return; }
  } else { save(); renderGear(); }
}

// v8.7.0: text-input modal — Promise<string|null> (null = cancelled).
let _textModalResolve = null;
function textModal(title, hint, initial) {
  return new Promise((resolve) => {
    _textModalResolve = resolve;
    document.getElementById('text-modal-title').textContent = title;
    document.getElementById('text-modal-hint').textContent = hint || '';
    const inp = document.getElementById('text-modal-input');
    inp.value = initial || '';
    document.getElementById('text-modal').classList.add('open');
    inp.focus(); inp.select();
  });
}
function resolveTextModal(ok) {
  const r = _textModalResolve; _textModalResolve = null;
  const v = document.getElementById('text-modal-input').value;
  document.getElementById('text-modal').classList.remove('open');
  if (r) r(ok ? v : null);
}

// v8.7.0 (Adam): name your sword. Stores it.customName (blank clears back to
// the mechanical name); the mechanical identity stays visible beside it and
// in every tooltip — pure flavor, zero mechanical effect.
async function renameItem(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const mech = it.enchant ? (() => { const cn = it.customName; delete it.customName; const n = enchantDisplayName(it); if (cn) it.customName = cn; return n; })() : it.ref;
  const v = await textModal(`✎ Name this item`, `Custom name for your ${mech} — shown everywhere it appears (the mechanical identity stays visible beside it). Leave blank to clear.`, it.customName || '');
  if (v === null) return;
  const name = v.trim();
  if (name) it.customName = name; else delete it.customName;
  save(); renderGear(); renderSheet();
  toast(name ? `${name} — so named.` : `Name cleared — back to ${mech}.`);
}

// v8.8.0 (Adam): toggle the Null Power Field state.
function toggleNullified() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.nullified = !c.nullified;
  logAct(c.nullified ? '⊘ NULLIFIED — all Supernatural modifiers suppressed (Null Power Field).' : '✦ Nullification lifted — Supernatural modifiers restored.');
  save(); renderSheet(); renderGear(); renderSkills();
  try { if (typeof renderConds === 'function' && document.getElementById('tr-nullify')) renderConds(c); } catch (e) {}  // v8.60.2: refresh the Tracker toggle
  toast(c.nullified ? '⊘ Supernatural modifiers suppressed.' : '✦ Supernatural modifiers restored.');
}

// v8.63.0 (Adam's ruling): toggle the Reckless Offense declared stance.
// Attack ROLLS only — Base Attack and the iterative ladder are expressly
// untouched ("in the strictest of terms it doesn't touch BA, so it
// shouldn't suffer the attendant trickle-down effects"). v8.63.1 redirect:
// Grapple rides the +2 — a grapple check is like a melee attack roll, and
// starting one requires a successful melee attack roll (HH grapple rules).
function toggleRecklessOffense() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!ownsFeatN(c, 'Reckless Offense')) { toast('Reckless Offense requires the feat.'); return; }
  if (!c.combatDecl) c.combatDecl = {};
  c.combatDecl.ro = !c.combatDecl.ro;
  logAct(c.combatDecl.ro
    ? '⚡ RECKLESS OFFENSE declared — +2 on melee attack rolls (Grapple included), −4 AC (HH p.239). Base Attack and the iterative ladder untouched. Holds until re-declared.'
    : '⚔ Reckless Offense withdrawn — the stance ends; AC and melee attack rolls return to normal.');
  save(); renderSheet(); renderGear();
  try { if (typeof renderConds === 'function' && document.getElementById('tr-reckless')) renderConds(c); } catch (e) {}
  toast(c.combatDecl.ro ? '⚡ Reckless Offense: +2 melee attacks / −4 AC.' : '⚔ Reckless Offense withdrawn.');
}

