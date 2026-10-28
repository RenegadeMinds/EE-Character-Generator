// =============================================================================
// js/ui/gear/gadgets.js
// GEAR / GADGETS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: mastercraft, gadgets and accessories on
//   items.
//
// KEY NAMES (so you can search for them)
//   tables and state: _gadgetOpen
//   functions (8): mountAccessory, toggleComputerUpgrade,
//   setItemMastercraft, addGadgetToItem, removeGadgetFromItem,
//   toggleGadgetCtl, addGadgetFromPicker, gadgetTooltip
//
// WHERE IT CAME FROM
//   Gathered from js/rules/13-armor-integrity-and-enchanting.js,
//   js/rules/18-companions.js when the code was regrouped by topic and page.
//   Each function and table moved whole and unchanged, with the comments
//   above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

async function mountAccessory(itemId) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); const ad = it && getCatalogueEntry('equipment', it.ref); if (!ad || !ad.mount) return;
  if (it.mountedOn) {   // detach
    const w = c.items.find(i => i.id === it.mountedOn);
    if (w) w.accessories = (w.accessories || []).filter(a => a.itemId !== it.id);
    logAct(`🔧 ${it.ref} detached${w ? ' from ' + w.ref : ''}.`); it.mountedOn = null;
    save(); renderGear(); renderSheet(); return;
  }
  const cand = (c.items || []).filter(w => w.catalogue === 'weapon' && accessoryFits(ad.mount.fits, getCatalogueEntry('weapon', w.ref)));
  if (!cand.length) { toast(`No weapon here takes a ${it.ref} (${ad.mount.fits === 'longarm' ? 'a longarm firearm' : ad.mount.fits === 'pistol' ? 'a handgun' : ad.mount.fits === 'firearm' ? 'a firearm' : 'a ranged weapon'}).`); return; }
  const labels = cand.map(w => `${itemDisplayName(w)} [${w.id.slice(-4)}]`);
  const pick = await new Promise(res => openChoiceModal(`${it.ref} — mount on which weapon?`, labels, res));
  if (!pick) return;
  const w = cand[labels.indexOf(pick)]; if (!w) return;
  if ((w.accessories || []).some(a => (getCatalogueEntry('equipment', a.ref) || {}).mount?.key === ad.mount.key)) { toast(`${w.ref} already carries a ${ad.mount.key} accessory — detach it first.`); return; }
  w.accessories = (w.accessories || []).concat([{ itemId: it.id, ref: it.ref }]); it.mountedOn = w.id;
  const twin = weaponAttachments(w).find(a => a.key === ad.mount.key && a.source === 'gadget');
  logAct(`🔧 ${it.ref} mounted on ${w.ref}.`);
  toast(twin ? `🔧 Mounted — but ${w.ref}'s ${twin.ref} gadget already does this; they don't stack (the gadget applies).` : `🔧 ${it.ref} mounted on ${w.ref}.`);
  save(); renderGear(); renderSheet();
}
function toggleComputerUpgrade(itemId) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  it.upgraded = !it.upgraded;
  logAct(`⬆ ${it.ref} ${it.upgraded ? 'upgraded (+1 equipment on Computer Use)' : 'upgrade removed'}.`);
  save(); renderGear(); renderSkills();
}

async function setItemMastercraft(itemId, bonus, target) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const cap = maxMastercraftBonus(scenarioTechScale(c));
  bonus = Math.max(0, Math.min(bonus, cap));
  // v8.93.1 (Adam's clarification): raising the grade charges the Purchase
  // DC DIFFERENCE through the paid-or-gift prompt; cancel backs out.
  const defU = getCatalogueEntry(it.catalogue, it.ref);
  const prevMc = it.mastercraft ? { ...it.mastercraft } : null;
  const oldDC = (defU) ? itemEffectivePDC(it, defU).dc : 0;
  if (bonus <= 0) {
    it.mastercraft = null;
  } else {
    const kind = mastercraftKindFor(it.catalogue);
    const rule = kind && MASTERCRAFT_RULES.targets_by_kind[kind];
    const resolvedTarget = (rule && rule.choose_one) ? (target || (it.mastercraft && it.mastercraft.target) || rule.choose_one[0]) : (rule ? 'defense' : null);
    it.mastercraft = { bonus, target: resolvedTarget };
  }
  if (defU) {
    const newDC = itemEffectivePDC(it, defU).dc;
    if (!(await chargeUpgradeDifference(c, it, oldDC, newDC, `Mastercraft +${bonus}`))) {
      it.mastercraft = prevMc; renderGear(); return; // backed out — nothing saved
    }
  }
  const cap2 = gadgetSlotCount(it, scenarioTechScale(c));
  if (it.gadgets && it.gadgets.length > cap2) it.gadgets = it.gadgets.slice(0, cap2);
  save(); renderGear(); renderSheet(); renderSkills();
  // v8.93.0 (Adam's task 2): the mastercraft tier carries a Purchase DC
  // modifier (HH p.275) — say what the item is now WORTH. Buying it at this
  // grade costs the new DC; upgrading an owned piece is a Craft project
  // (XP + Craft DC per the tier) or a GM-priced trade-in.
  const defMc = getCatalogueEntry(it.catalogue, it.ref);
  if (defMc) {
    const e2 = itemEffectivePDC(it, defMc);
    if (e2.parts.length) toast(`${it.ref}: effective Purchase DC ${e2.dc} (${e2.parts.join('; ')}).`);
  }
}

async function addGadgetToItem(itemId, gadgetName) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const cap = gadgetSlotCount(it, scenarioTechScale(c));
  if (!it.gadgets) it.gadgets = [];
  if (it.gadgets.length >= cap) { toast(`No free gadget slots (${it.gadgets.length}/${cap}).`); return; }
  const g = GADGETS_CATALOG.find(x => x.name === gadgetName && x.type === it.catalogue);
  if (!g) { toast('Unknown gadget.'); return; }
  if (!g.multi_select && it.gadgets.some(x => x.ref === gadgetName)) { toast(`${gadgetName} already attached (not multi-select).`); return; }
  // v8.6.1 (Adam's addendum): autofire consumes 10 rounds — flag the
  // discrepancy at module-add time when the host magazine can't hold them.
  if (gadgetName === 'Autofire Module') {
    const def = getCatalogueEntry('weapon', it.ref);
    const mag = def && effectiveMagazine(it, def);  // Expanded Magazine counts
    if (mag && mag < 10) {
      if (!(await confirmModal(`${it.ref}'s magazine holds only ${mag} rounds — autofire requires 10 loaded. Attach the Autofire Module anyway as a GM override? (The Autofire mode will carry a ⚠ magazine note.)`, { title: '⚑ Magazine too small for autofire' }))) return;
    }
  }
  // v8.6.1 (Adam): Alternate Weapon integrates a second, separately-purchased
  // weapon into the host (HH p.263: usable at any time; detachable or fixed,
  // chosen at purchase; like-type mixing is a book SUGGESTION, not enforced —
  // GM domain). Pick the weapon + the fixed/detachable choice here; the
  // integrated weapon rides the gadget record and gets its own row on the
  // combat dashboard while the host is equipped.
  if (gadgetName === 'Alternate Weapon') {
    const pick = await new Promise(res => openChoiceModal('Alternate Weapon — integrate which weapon? (Purchased separately at modified cost — GM adjudicates. The book suggests mixing like types: energy with energy, ballistic with ballistic.)',
      WEAPONS_CATALOG.filter(w => w.name !== it.ref).map(w => `${w.name} (TS${w.tl}${w.dmg_m ? ', ' + w.dmg_m : ''})`), res));
    if (!pick) return;
    const altName = pick.replace(/\s*\([^)]+\)\s*$/, '').trim();
    const mount = await new Promise(res => openChoiceModal(`${altName} — mounting? (Chosen at purchase, per the book.)`,
      ['Fixed — permanently integrated', 'Detachable — can be physically separated'], res));
    if (!mount) return;
    // v8.93.1: the Alternate Weapon gadget's own DC mod charges like any
    // other upgrade (the integrated weapon itself is still bought
    // separately at modified cost — GM adjudicates, per the book).
    const defAW = getCatalogueEntry(it.catalogue, it.ref);
    const oldDCaw = (defAW) ? itemEffectivePDC(it, defAW).dc : 0;
    it.gadgets.push({ ref: gadgetName, altWeapon: altName, detachable: mount.startsWith('Detachable') });
    if (defAW) {
      const newDCaw = itemEffectivePDC(it, defAW).dc;
      if (!(await chargeUpgradeDifference(c, it, oldDCaw, newDCaw, 'Alternate Weapon mount'))) { it.gadgets.pop(); renderGear(); return; }
    }
    save(); renderGear(); renderSheet(); renderSkills();
    toast(`${altName} integrated into ${it.ref} (${mount.startsWith('Detachable') ? 'detachable' : 'fixed'}). The ${altName} itself is purchased separately at modified cost — GM adjudicates.`);
    return;
  }
  // v8.93.1 (Adam's clarification): the gadget's Purchase DC modifier
  // CHARGES the difference — paid-or-gift prompt; cancel backs out.
  const defG = getCatalogueEntry(it.catalogue, it.ref);
  const oldDCg = (defG) ? itemEffectivePDC(it, defG).dc : 0;
  it.gadgets.push({ ref: gadgetName });
  if (defG) {
    const newDCg = itemEffectivePDC(it, defG).dc;
    if (!(await chargeUpgradeDifference(c, it, oldDCg, newDCg, gadgetName))) {
      it.gadgets.pop(); renderGear(); return; // backed out — nothing saved
    }
  }
  save(); renderGear(); renderSheet(); renderSkills();
  if (defG) {
    const eG = itemEffectivePDC(it, defG);
    if (eG.parts.length) toast(`${gadgetName} attached — ${it.ref}: effective Purchase DC ${eG.dc} (${eG.parts.join('; ')}).`);
  }
}

function removeGadgetFromItem(itemId, idx) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it || !it.gadgets) return;
  it.gadgets.splice(idx, 1);
  save(); renderGear(); renderSheet(); renderSkills();
}
const _gadgetOpen = new Set();
function toggleGadgetCtl(itemId) {
  if (_gadgetOpen.has(itemId)) _gadgetOpen.delete(itemId); else _gadgetOpen.add(itemId);
  renderGear();
}

function addGadgetFromPicker(itemId) {
  const sel = document.getElementById('gadgetsel-' + itemId);
  const name = sel && sel.value; if (!name) return;
  addGadgetToItem(itemId, name);
}

// v8.5.2: hover-tooltip text for a gadget (effect summary + restriction),
// reused for the attached-gadget chip and the "+ Gadget" picker options.
// Built from gadget_effects.json's effect.text (an authored paraphrase of
// the HH description, not verbatim rulebook text — see equipment_substrate/
// gadget_effects.json _meta and Adam's earlier copyright-caution call).
function gadgetTooltip(g) {
  const parts = [g.effect ? g.effect.text : ''];
  if (g.restriction) parts.push('Restriction: ' + g.restriction);
  return parts.filter(Boolean).join('\n\n');
}
