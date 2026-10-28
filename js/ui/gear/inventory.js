// =============================================================================
// js/ui/gear/inventory.js
// GEAR / INVENTORY — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: the inventory, equipping, slots, two-
//   handed grips, item controls and renderGear.
//
// KEY NAMES (so you can search for them)
//   tables and state: _itemOpen
//   functions (21): armorStatStrip, weaponStatStrip, toggleGearActive,
//   gearQty, useGearItem, boostBaneRoll, setEquipParam, addItemToChar,
//   removeItemFromChar, toggleTwoHandGrip, equipItemToSlot, moveWeaponHand,
//   renameItem, toggleItemEquipped, toggleGearMagicSlots,
//   toggleSheetMagicSlots, toggleItemCtl, addItemFromPicker,
//   renderEquippedItemChip, renderInventoryList, renderGear
//
// WHERE IT CAME FROM
//   Gathered from js/rules/14-resistances-speed-dr-size.js,
//   js/rules/16-worn-and-active-gear.js, js/rules/18-companions.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function armorStatStrip(def, it) {
  if (!def) return '';
  const bits = [];
  if (def.ac_bonus) bits.push(`+${def.ac_bonus} AC`);
  let md = parseMaxDex(def.max_dex);
  if (md != null) {
    let bonus = 0; const why = [];
    for (const gg of ((it && it.gadgets) || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'maxDexBonus' && typeof contrib.amount === 'number') { bonus += contrib.amount; why.push('morphic'); }
      }
    }
    if (it && it.mastercraft && it.mastercraft.target === 'mobility') { bonus += it.mastercraft.bonus || 0; why.push('mastercraft'); }
    bits.push(`max Dex +${md + bonus}${why.length ? ` (${why.join('+')})` : ''}`);
  }
  let acp = parseArmorCheckPenalty(def);
  if (acp < 0) {
    let ease = (it && it.enchant) ? 1 : 0;
    for (const gg of ((it && it.gadgets) || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'armorCheckPenalty' && typeof contrib.amount === 'number') ease += contrib.amount;
      }
    }
    const eff = Math.min(0, acp + ease);
    if (eff < 0) bits.push(`ACP ${eff}${ease ? ' (eased)' : ''}`);
  }
  const sm = /(\d+)[’']\s*\/\s*(\d+)[’']/.exec(def.speed || '');
  if (sm) {
    let s30 = parseInt(sm[1], 10), s20 = parseInt(sm[2], 10);
    const ul = hasGadget(it, 'Ultralight Composition');
    if (ul) { s30 = Math.min(30, s30 + 5); s20 = Math.min(20, s20 + 5); }
    bits.push(`spd ${s30}′/${s20}′${ul ? ' (ultralight)' : ''}`);
  }
  if (def.arcane_spell_failure && def.arcane_spell_failure !== '—') bits.push(`ASF ${def.arcane_spell_failure}`);
  // v8.13.0 (Adam's T/ACtical armor pass): hardness + HP on the strip, with
  // broken/destroyed state — the Tracker's Armor Integrity panel is the
  // interactive side; this is the reference line.
  if (it) {
    const g = armorItemIntegrity(it);
    if (g) bits.push(`Hardness ${g.hardness} · HP ${g.hp}/${g.maxHP}${g.destroyed ? ' ☠ DESTROYED' : g.broken ? ' ⚑ BROKEN (no AC)' : ''}${g.alwaysIntercede ? ' ◈ always intercedes' : ''}`);
  }
  return bits.join(' · ');
}

function weaponStatStrip(def, it) {
  if (!def) return '';
  const bits = [];
  let crit = (def.crit || '').replace(/x(\d)/i, '×$1').trim();
  if (crit && crit !== '—') {
    if (!crit.includes('/')) crit = /^×/.test(crit) ? '20/' + crit : crit + '/×2';
    // v8.7.0 (Adam's Frostbite confirmation): Keen doubles the threat range
    // (20 → 19–20; 19–20 → 17–20; 18–20 → 15–20).
    if (it && it.enchant && (it.enchant.abilities || []).includes('Keen')) {
      const km = crit.match(/^(?:(\d+)–)?(\d+)\/(.+)$/);
      if (km) {
        const low = parseInt(km[1] || km[2], 10);
        crit = `${2 * low - 21}–20/${km[3]} (Keen)`;
      }
    }
    bits.push(`crit ${crit}`);
  }
  const effRng = effectiveRangeIncrement(it, def);
  if (effRng != null) bits.push(`rng ${effRng}′${hasScope(it) ? ' (scope ×1.5)' : ''}`);
  const effRof = effectiveRoF(it, def);
  if (effRof.length) bits.push(`RoF ${effRof.join('/')}${effRof.includes('A') && !((def.rof || []).includes('A')) ? ' (module)' : ''}`);
  const effMag = effectiveMagazine(it, def);
  if (effMag != null) bits.push(`mag ${hasGadget(it, 'Expanded Magazine') ? `${effMag} (expanded)` : def.magazine_raw || effMag}`);
  else if (def.magazine_raw) bits.push(`mag ${def.magazine_raw}`);
  if (hasGadget(it, 'Spring Loaded')) bits.push('Quick Draw (spring-loaded)');
  // v9.14.0 (§272, Adam's tech-upgrade gavels): homebrew Tech Upgrades wear
  // their chips on every strip surface — display riders, table-adjudicated
  // (the ⛏ convention: damage math untouched).
  const _ht = def.hb_tech;
  if (_ht) {
    if (_ht.aa === 4) bits.push('⚡⛏ Power Weapon — ignores ALL hardness (natural incl.)');
    else if (_ht.aa) bits.push(`⛏ Anti-Armor ${['','I','II','III'][_ht.aa]} — ignores the first ${[0,5,10,20][_ht.aa]} hardness (natural incl.)`);
    if (_ht.stun) bits.push('Stun Pulse — concussion (nonlethal); Fort DC 10 + damage dealt or stunned 1 rd');
    if (_ht.emp) bits.push('EMP — ionic (nonlethal electrical); vs cyborgs it strikes ONLY the tech implants (usually disabling them); an Anti-Shock Implant makes cybernetics immune to ionic');
    if (_ht.reach) bits.push('reach +5′ (Extended Reach)');
    if (_ht.heavyCrit) bits.push('Heavy Crit (×3)');
    if (_ht.powerPack) bits.push('power pack: 50 uses per pack (HF-Sword economy)');
  }
  return bits.join(' · ');
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
    if (!offHandAvailable(c)) { toast('🤲 No off hand to commit — Lost Arm (drawback). Install a cybernetic Prosthetic Arm to restore it.'); return; }
    it.twoHandedGrip = true;
    logAct(`🤲 ${it.ref}: two-handed grip — Str ×1.5 to damage, Power Attack counts double; the off hand is committed.`);
  } else {
    delete it.twoHandedGrip;
    logAct(`🤲 ${it.ref}: back to a one-handed grip.`);
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

function toggleItemEquipped(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  if (it.catalogue === 'equipment') {
    // v9.2.0: wearable gear has a home body slot; everything else is owned.
    const gd = gearDef(it);
    if (!gd || !gd.slot) { toast('This is owned, not worn — no toggle needed.'); return; }
    it.slot = gd.slot;
    if (it.equipped) {   // taking it off ends any Boon it powers
      it.equipped = false;
      if (Array.isArray(c.activeEffects)) c.activeEffects = c.activeEffects.filter(a => a.gearItemId !== it.id);
      save(); renderGear(); renderSheet(); renderSkills(); return;
    }
  }
  const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
  if (!it.equipped && slotDef) {
    // v8.8.0 (Adam's Advantages pass): Lost Arm — one arm means no
    // two-handed weapons (the entry's own restriction, now enforced via the
    // handedness measurable) and nothing in the Off Hand at all.
    // v8.91.0 (task 3): a cybernetic Prosthetic Arm REPLACES the lost arm
    // (HH p.332 Replacements + the drawback's own Special line) — the off
    // hand and two-handed weapons return with it.
    if (slotDef.category === 'held' && !offHandAvailable(c)) {
      const defLA = it.catalogue === 'weapon' ? getCatalogueEntry('weapon', it.ref) : null;
      if (defLA && weaponHands(defLA) === 2) { toast(`${it.ref} needs two hands — Lost Arm (drawback). Install a cybernetic Prosthetic Arm (🦾 Cybernetics) to restore the arm; GM may allow improvised bracing.`); return; }
      if (it.slot === 'off_hand') { toast('Off Hand unavailable — Lost Arm (drawback). Install a cybernetic Prosthetic Arm (🦾 Cybernetics) to restore it.'); return; }
    }
    // v8.6.1: two-handed occupancy checks (see weaponHands above).
    if (slotDef.category === 'held') {
      const def = it.catalogue === 'weapon' ? getCatalogueEntry('weapon', it.ref) : null;
      if (def && weaponHands(def) === 2) {
        if (it.slot === 'off_hand') { toast(`${it.ref} needs both hands — equip it in the Main Hand.`); return; }
        if (c.items.some(i => i.slot === 'off_hand' && i.equipped && i.id !== it.id)) { toast(`${it.ref} needs both hands — free the Off Hand first.`); return; }
      }
      const th = twoHandedEquipped(c);
      if (it.slot === 'off_hand' && th) { toast(`Off Hand is claimed by the two-handed ${th.ref}. Unequip it first.`); return; }
    }
    // v9.6.0 (§255, Adam's chart): body-slot occupancy is enforced per
    // GROUP — Gloves and Gauntlets share the hands, a hat and a helmet the
    // head, a torc the neck. Two rings; the Back is the house addendum.
    const gid = slotDef.category === 'body' ? slotGroupIdOf(it.slot) : null;
    if (gid) {
      const g = SLOT_GROUPS[gid];
      const effSlotOf = (i) => i.catalogue === 'equipment' ? ((gearDef(i) || {}).slot || i.slot) : i.slot;
      const worn = c.items.filter(i => i.id !== it.id && i.equipped && g.slots.includes(effSlotOf(i)));
      if (worn.length >= g.cap) { toast(`${g.label} is occupied by ${itemDisplayName(worn[0])}${g.cap > 1 ? ` (and ${worn.length - 1} more; capacity ${g.cap})` : ''}. One item per body slot — remove it first.`); return; }
      // canon: one robe OR suit of armor on the body
      if (g.armorShares && c.items.some(i => i.catalogue === 'armor' && i.equipped && i.slot === 'armor')) { toast('The Body is occupied by a suit of armor — a robe and armor cannot be worn together (one robe OR suit of armor on the body).'); return; }
    } else {
      const sameSlot = c.items.filter(i => i.slot === it.slot && i.equipped && i.id !== it.id);
      if (sameSlot.length >= (slotDef.capacity || 1)) { toast(`${slotDef.label} slot is full (capacity ${slotDef.capacity}). Unequip something first.`); return; }
      // canon, the other direction: donning armor is blocked by a worn robe
      if (it.slot === 'armor' && c.items.some(i => i.id !== it.id && i.equipped && ((i.catalogue === 'equipment' ? ((gearDef(i) || {}).slot || i.slot) : i.slot) === 'robe'))) { toast('The Body is occupied by a robe — a robe and a suit of armor cannot be worn together.'); return; }
    }
  }
  it.equipped = !it.equipped;
  save(); renderGear(); renderSheet(); renderSkills();
}

// v8.56.0 (playtest issue #3d/#3b): section toggles + gadget-control state.
function toggleGearMagicSlots() {
  const w = document.getElementById('gear-magic-slots-wrap'), ch = document.getElementById('gear-magic-slots-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (ch) ch.textContent = open ? '▾' : '▸';
}
function toggleSheetMagicSlots() {
  const w = document.getElementById('sh-magic-slots-wrap'), ch = document.getElementById('sh-magic-slots-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (ch) ch.textContent = open ? '▾' : '▸';
}
// v9.6.0 (§255, Adam): the customization controls (Enchant / Mastercraft)
// and the provenance + Purchase DC line collapse INTO the item name — the
// name is the toggle, the decorated result ("+2 Mastercrafted (Damage)
// Plasma Pistol") is the summary.
const _itemOpen = new Set();
function toggleItemCtl(itemId) {
  if (_itemOpen.has(itemId)) _itemOpen.delete(itemId); else _itemOpen.add(itemId);
  renderGear();
}
function addItemFromPicker(catalogue) {
  const sel = document.getElementById('gear-add-' + catalogue + '-sel');
  const ref = sel && sel.value;
  // v8.56.0 (playtest issue #3a): pickers now default to a no-selection
  // placeholder — say so instead of silently doing nothing.
  if (!ref) { toast('Pick an item from the list first.'); return; }
  let slot = 'carried';
  if (catalogue === 'weapon') { const s = document.getElementById('gear-add-weapon-slot'); slot = s ? s.value : 'main_hand'; }
  else if (catalogue === 'armor') { const def = getCatalogueEntry('armor', ref); slot = (def && def.type === 'shield') ? 'off_hand' : 'armor'; }
  addItemToChar(catalogue, ref, slot);
}

function renderEquippedItemChip(it) {
  return `<span class="rounded-3 items-center gap-4 p-2-7 fs-11 mr-4" style="display:inline-flex;background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.25);">
    ${escapeHTML(itemDisplayName(it))}
    <button class="p-0-5 fs-9 btn btn-sm" onclick="toggleItemEquipped('${it.id}')" title="Unequip">✕</button>
  </span>`;
}

function renderInventoryList(items, techScale, catalogue) {
  if (!items.length) return `<div class="o-50 c-dim fs-11 p-6-0">None owned yet.</div>`;
  return items.map(it => {
    const def = getCatalogueEntry(catalogue, it.ref);
    if (!def) return '';
    const cap = maxMastercraftBonus(techScale);
    const mcOpts = Array.from({ length: cap + 1 }, (_, n) => {
      const sel = (it.mastercraft && it.mastercraft.bonus === n) || (!it.mastercraft && n === 0);
      return `<option value="${n}" ${sel ? 'selected' : ''}>${n === 0 ? 'None' : '+' + n}</option>`;
    }).join('');
    const kind = mastercraftKindFor(catalogue);
    const rule = kind && MASTERCRAFT_RULES.targets_by_kind[kind];
    const showTargetChoice = rule && rule.choose_one && it.mastercraft && it.mastercraft.bonus > 0;
    const targetHtml = showTargetChoice
      ? rule.choose_one.map(t => `<label class="fs-10 ml-6"><input type="radio" name="mct-${it.id}" value="${t}" ${it.mastercraft.target === t ? 'checked' : ''} onchange="setItemMastercraft('${it.id}', ${it.mastercraft.bonus}, '${t}')"> ${t}</label>`).join('')
      : '';
    const mcControl = cap > 0
      ? `Mastercraft: <select class="fs-10" onchange="setItemMastercraft('${it.id}', parseInt(this.value,10), null)">${mcOpts}</select>${targetHtml}`
      : `<span class="fs-10 op-0_4" title="Scenario Tech Scale too low for mastercrafting.">mastercraft n/a</span>`;

    let gadgetHtml = '';
    let gadgetDossierCtl = '';   // v9.6.1 (§256): the 0-gadget add control rides the dossier
    if (catalogue !== 'equipment') {
      const gcap = gadgetSlotCount(it, techScale);
      const filled = (it.gadgets || []).map((g, idx) => {
        const gd = GADGETS_CATALOG.find(x => x.name === g.ref && x.type === catalogue);
        const tip = gd ? gadgetTooltip(gd) : '';
        const gLabel = g.altWeapon ? `${g.ref}: ${g.altWeapon} (${g.detachable ? 'detachable' : 'fixed'})` : g.ref;
        return `<span title="${escapeHTML(tip)}" class="rounded-3 fs-10 p-1-5 cursor-help" style="background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);margin-right:3px;">${escapeHTML(gLabel)} <button class="fs-9 btn btn-sm" style="padding:0 3px;" onclick="removeGadgetFromItem('${it.id}', ${idx})">✕</button></span>`;
      }).join('');
      const elig = eligibleGadgets(catalogue, def, techScale).filter(g => g.multi_select || !(it.gadgets || []).some(x => x.ref === g.name));
      // v8.56.0 (playtest issue #3b): the gadget picker hides behind a
      // "⚙ Gadgets?" toggle per item — attached gadgets stay visible as
      // chips; the add-controls are opt-in instead of perpetual noise.
      const gOpen = _gadgetOpen.has(it.id);
      const addCtl = (it.gadgets || []).length < gcap
        ? (gOpen
          ? `<select id="gadgetsel-${it.id}" class="fs-10"><option value="">— select a gadget —</option>${elig.map(g => `<option value="${escapeHTML(g.name)}" title="${escapeHTML(gadgetTooltip(g))}">${escapeHTML(g.name)} (DC ${Array.isArray(g.purchase_dc_mod) ? g.purchase_dc_mod.join('/') : g.purchase_dc_mod})</option>`).join('')}</select> <button class="fs-9 p-1-6 btn btn-sm" onclick="addGadgetFromPicker('${it.id}')">+ Gadget</button> <button class="fs-9 p-1-5 btn btn-sm" onclick="toggleGadgetCtl('${it.id}')" title="Hide the gadget picker">▴</button>`
          : `<button class="fs-9 p-1-6 btn btn-sm" onclick="toggleGadgetCtl('${it.id}')" title="Attach technological gadgets to this item (slots: 1 + mastercraft bonus; Tech Scale gates apply)">⚙ Gadgets? (${(it.gadgets || []).length}/${gcap})</button>`)
        : '';
      // v9.3.0: mounted removable accessories ride beside the gadgets (no gadget slot used).
      const accChips = (catalogue === 'weapon' && (it.accessories || []).length) ? ` <span class="fs-10 op-0_8">🔧 ${(it.accessories || []).map(a => { const sh = weaponAttachments(it).some(x => x.ref === a.ref); return `<span title="${escapeHTML(sh ? 'Removable accessory — detach it from its own row' : 'Shadowed by an integrated gadget of the same kind — they don’t stack')}" style="background:rgba(140,200,150,.1);border:1px solid rgba(140,200,150,.35);border-radius:3px;padding:1px 5px;margin-right:3px;${sh ? '' : 'opacity:.5;text-decoration:line-through;'}">${escapeHTML(a.ref)}</span>`; }).join('')}</span>` : '';
      // v9.6.1 (§256, Adam's tweak): an item with NO installed gadgets shows
      // no gadget line on the collapsed row — the "⚙ Gadgets? (0/x)" add
      // control waits inside the dossier instead (the Enchantments idiom).
      const hasGadgets = (it.gadgets || []).length > 0;
      if (hasGadgets || accChips) gadgetHtml = `<div class="mt-3">${hasGadgets ? `Gadgets (${(it.gadgets || []).length}/${gcap}): ` : ''}${filled}${hasGadgets ? addCtl : ''}${accChips}</div>`;
      if (!hasGadgets) gadgetDossierCtl = addCtl;
    }

    const _gd = catalogue === 'equipment' ? def : null;
    const _on = _gd && _gd.active ? !!gearBoonOf(chars.find(x => x.id === curId) || {}, it) : false;
    const equipToggle = catalogue !== 'equipment'
      ? `<button class="fs-10 btn btn-sm" onclick="toggleItemEquipped('${it.id}')">${it.equipped ? 'Unequip' : 'Equip'}</button>`
      : [ _gd && _gd.slot ? `<button class="btn btn-sm" style="font-size:10px;${it.equipped ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="toggleItemEquipped('${it.id}')" title="${it.equipped ? 'Worn in the ' : 'Wear in the '}${(ITEM_SLOTS.find(x => x.id === _gd.slot) || {}).label || _gd.slot} slot">${it.equipped ? '🎒 Remove' : '🎒 Wear'}</button>` : '',
          _gd && _gd.active ? `<button class="btn btn-sm" style="font-size:10px;${_on ? 'border-color:rgba(140,200,150,.7);color:#8cc896;' : ''}${_gd.slot && !it.equipped ? 'opacity:.5;' : ''}" onclick="toggleGearActive('${it.id}')" title="${_gd.slot && !it.equipped ? 'Wear it first' : 'Toggle the device — its Boon shows on the Sheet'}">${_on ? '⏻ Turn off' : '⚡ Activate'}</button>` : '',
          _gd && _gd.mount ? (() => { const w = it.mountedOn && (chars.find(x => x.id === curId) || {items: []}).items.find(i => i.id === it.mountedOn); return `<button class="btn btn-sm" style="font-size:10px;${w ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="mountAccessory('${it.id}')" title="${w ? 'Mounted on ' + escapeHTML(w.ref) + ' — click to detach' : 'Mount on an eligible weapon'}">🔧 ${w ? 'Mounted ✕' : 'Mount on…'}</button>`; })() : '',
          _gd && _gd.upgrade ? `<button class="btn btn-sm" style="font-size:10px;${it.upgraded ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="toggleComputerUpgrade('${it.id}')" title="Processor upgrade: +1 equipment on Computer Use (Purchase DC +${_gd.upgrade.dc}; charge it with ± Adjust if tracking wealth)">⬆ ${it.upgraded ? 'Upgraded' : 'Upgrade'}</button>` : '',
          _gd && _gd.use ? `<span class="fs-10 mr-4">×${it.qty || 1}</span><button class="fs-9 p-0-5 btn btn-sm" onclick="gearQty('${it.id}',1)" title="Add one">+</button><button class="fs-10 btn btn-sm" onclick="useGearItem('${it.id}')" title="Use one${(_gd.use.effects || []).length ? ' — starts its Boon' : ''}">🧪 Use</button>` : '' ].join(' ');
    // v8.6.1 TWF pass: one-handed weapons can swap hands (dual-wield lives
    // here + the Off Hand row's picker). Two-handers have no business off-hand.
    const handSwap = (catalogue === 'weapon' && weaponHands(def) === 1 && (it.slot === 'main_hand' || it.slot === 'off_hand'))
      ? `<button class="fs-10 btn btn-sm" title="Move to the ${it.slot === 'main_hand' ? 'Off' : 'Main'} Hand" onclick="moveWeaponHand('${it.id}')">⇄ ${it.slot === 'main_hand' ? 'Off Hand' : 'Main Hand'}</button>`
      : '';
    // v8.6.1: Enchant / Imbue builder entry point (weapons + armor/shields).
    const enchInfo = enchantInfoOf(it);
    const enchantBtn = (catalogue === 'weapon' || catalogue === 'armor')
      ? `<button class="btn btn-sm" style="font-size:10px;${enchInfo ? 'border-color:rgba(196,153,212,.5);color:var(--vio);' : ''}" title="${enchInfo ? `${enchInfo.imbued ? 'Imbued' : 'Enchanted'} — aggregate +${enchInfo.totalMod}, value ${enchInfo.cost.toLocaleString()} gp. Click to upgrade.` : 'Enchant / imbue this item (GMG: enhancement +1..+5, then special abilities)'}" onclick="openEnchantBuilder('${it.id}')">✨ ${enchInfo ? `+${enchInfo.totalMod}` : 'Enchant'}</button>`
      : '';
    // v8.7.0 (Adam's display ruling): the tag shows the MECHANICAL face only
    // (+enh); the ability breakdown, aggregate modifier (cost/TS bookkeeping
    // — "doesn't need to be shown, just calculable"), and value live in the
    // tooltip.
    const enchantTags = enchInfo
      ? `<span class="rounded-2 fs-9 p-1-5 ml-4 c-vio" style="background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.35);" title="${escapeHTML((enchInfo.abilities.map(a => a.name + (a.bonus ? ` (+${a.bonus} equiv.)` : ` (${a.gp.toLocaleString()} gp)`)).join(' · ') || 'enhancement only') + ` — aggregate modifier +${enchInfo.totalMod} · value ${enchInfo.cost.toLocaleString()} gp`)}">${enchInfo.imbued ? '◈ imbued' : '✨ enchanted'} +${enchInfo.enh}</span>${enchInfo.overCap ? ' <span class="fs-9 c-red-text" title="Aggregate modifier exceeds this item’s Tech Scale cap — recorded as a GM override.">⚑ over TS cap (GM)</span>' : ''}`
      : '';
    const _eqP = (catalogue === 'equipment' && def.effect && def.effect.param)
      ? ` <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;${it.param ? '' : 'border-color:rgba(214,120,92,.6);color:#d6785c;'}" onclick="setEquipParam('${it.id}')" title="${escapeHTML(def.effect.param.label)}">${it.param ? escapeHTML(it.param) + ' ✎' : '⚠ choose ' + escapeHTML(def.effect.param.label)}</button>` : '';
    const effectNote = catalogue === 'equipment' && def.effect && def.effect.text ? `<div class="fs-10 op-0_65 mt-2">${escapeHTML(def.effect.text)}${def.pending ? ` <span class="op-0_7">(${def.pending})</span>` : ''}</div>${_eqP ? `<div class="mt-2">${_eqP}</div>` : ''}` : (_eqP ? `<div class="mt-2">${_eqP}</div>` : '');
    // v8.5.2: hover tooltip on the item name. Tool/skill kits have a
    // description (def.effect.text) ready now; weapons/armor don't carry
    // prose yet (only crunch stats — no tooltip shown for those until a
    // separate extraction pass pulls their HH narrative text, deliberately
    // deferred per Adam, 2026-06-30).
    const nameTip = (catalogue === 'equipment' && def.effect)
      ? ` title="${escapeHTML([def.category, def.effect.text, def.page ? 'HH p.' + def.page : ''].filter(Boolean).join(' — '))}" style="cursor:help;"`
      // v8.7.0: converted specific arms carry their unique powers here.
      : (it.specialNote ? ` title="${escapeHTML((it.customName ? it.customName + ' — ' : '') + it.specialNote + ' (base: ' + it.ref + '; full text in the magic-item catalogue)')}" style="cursor:help;"` : '');

    // v8.8.0: armor mobility strip (AC / max Dex / ACP / speed / ASF —
    // gadget- and enchant-adjusted), mirroring the weapon stat strip.
    const armorStrip = (catalogue === 'armor')
      ? (() => { const s = armorStatStrip(def, it); return s ? `<div class="fs-9_5 c-g55" style="margin-top:1px;" title="Max Dex caps the Dex bonus to AC while worn; speed shown for base 30′/20′ movers; ACP shown after enchantment/gadget easing.">${escapeHTML(s)}</div>` : ''; })()
      : '';
    // v8.6.1: non-proficiency flags. Weapons: −4 to attack. Armor/shields:
    // the piece's armor check penalty hits attack rolls and Str/Dex checks
    // while it is EQUIPPED (merely owning it is penalty-free).
    let profFlag = '';
    const curChar = chars.find(x => x.id === curId);
    if (curChar && catalogue === 'weapon' && !isProficientWithWeapon(curChar, it.ref)) {
      profFlag = ' <span class="fs-10" style="color:#d4865a;" title="-4 on attack rolls while not proficient">⚠ not proficient</span>';
    } else if (curChar && catalogue === 'armor' && !isProficientWithArmor(curChar, it.ref)) {
      const acp = parseArmorCheckPenalty(def);
      profFlag = ` <span class="fs-10" style="color:#d4865a;" title="Not proficient: while equipped, the armor check penalty (${acp}) applies to attack rolls and all Str- and Dex-based checks">⚠ not proficient${acp < 0 && it.equipped ? ` (${acp} atk & Str/Dex checks)` : ''}</span>`;
    }

    // v8.60.0 (Adam): 🤲 two-handed grip toggle — equipped one-handed melee
    // weapons only, and only while the off hand is free (or already gripped).
    const gripBtn = (catalogue === 'weapon' && it.equipped && def && def.kind === 'one-handed' && !isRangedWeapon(def)) ? (() => {
      const on = !!it.twoHandedGrip;
      const offBusy = curChar && getCharItems(curChar).some(o => o.id !== it.id && o.equipped && o.slot === 'off_hand');
      return `<button class="btn btn-sm" style="font-size:10px;${on ? 'border-color:rgba(220,205,138,.6);color:rgba(220,205,138,.95);' : (offBusy ? 'opacity:.4;' : '')}" onclick="toggleTwoHandGrip('${it.id}')" title="${on ? 'Wielded in BOTH hands: Str ×1.5 damage, Power Attack ×2, off hand committed. Click to return to one hand.' : (offBusy ? 'Off hand is occupied — free it to take a two-handed grip.' : 'Wield this one-handed weapon in both hands (off hand stays committed): Str ×1.5 damage, Power Attack counts double.')}">🤲</button>`;
    })() : '';
    // v9.6.0 (§255, Adam): line 1 = decorated name (the toggle) + state
    // buttons + the end-of-line trio (rename / sell / remove). Provenance +
    // Purchase DC open the collapsible; the Enchant / Mastercraft controls
    // live inside it. Enchantments get their own chip line, like Gadgets.
    const rowOpen = _itemOpen.has(it.id);
    const priceHtml = (() => { const pts = (_priceCheckTs != null) ? _priceCheckTs : techScale; if (enchInfo) return priceSpan(dcForDollars(enchInfo.cost * 100), pts); const eff = itemEffectivePDC(it, def); return priceSpan(eff.dc, pts, (def.tl != null ? def.tl : def.tech_scale) || 0, eff.parts.length ? `Effective Purchase DC ${eff.dc} = base ${eff.base} + ${eff.parts.join(' + ')}.` : ''); })();
    const provHtml = it.provenance
      ? `<span class="fs-10 cursor-help" title="${it.provenance === 'purchased' ? 'Purchased — paid from funds' : 'Acquired — loot, gift, or GM grant'}">${it.provenance === 'purchased' ? '💰 Purchased' : '🎁 Acquired'}</span>`
      : '<span class="fs-10 op-0_45">provenance unrecorded</span>';
    const custRow = (enchantBtn || mcControl || gadgetDossierCtl) ? `<div class="items-center gap-8 flex-wrap mt-4 fs-10" style="display:flex;">${enchantBtn}<span>${mcControl}</span>${gadgetDossierCtl}</div>` : '';
    const dropdown = rowOpen
      ? `<div class="rounded-3 mt-4 p-5-8" style="border:1px solid rgba(200,151,30,.18);background:rgba(200,151,30,.04);">
          <div class="items-center gap-10 flex-wrap" style="display:flex;">${provHtml} ${priceHtml}</div>${custRow}
        </div>`
      : '';
    // Enchantments / Imbuements chip line (the Gadgets line's twin): each
    // built-in ability wears its GMG description as a hover pop-up.
    const enchLine = enchInfo
      ? `<div class="mt-3 fs-10">Enchantments / Imbuements: <span class="rounded-2 fs-9 p-1-5 c-vio" style="background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.35);margin-right:3px;" title="${escapeHTML(`Aggregate modifier +${enchInfo.totalMod} · value ${enchInfo.cost.toLocaleString()} gp`)}">${enchInfo.imbued ? '◈ imbued' : '✨ enchanted'} +${enchInfo.enh}</span>${enchInfo.abilities.map(a => `<span title="${escapeHTML((a.def && a.def.d) ? a.def.d : (a.bonus ? `+${a.bonus} bonus equivalent` : `${a.gp.toLocaleString()} gp`))}" class="rounded-2 fs-9 p-1-5 cursor-help c-vio" style="background:rgba(196,153,212,.08);border:1px solid rgba(196,153,212,.25);margin-right:3px;">${escapeHTML(a.name)}</span>`).join('')}${enchInfo.overCap ? ' <span class="fs-9 c-red-text" title="Aggregate modifier exceeds this item’s Tech Scale cap — recorded as a GM override.">⚑ over TS cap (GM)</span>' : ''}${(catalogue === 'weapon' && enchInfo.enh > 0) ? ` <span class="rounded-2 fs-9 p-1-5 cursor-help c-vio" style="background:rgba(196,153,212,.1);border:1px solid rgba(196,153,212,.3);" title="${escapeHTML(`Enchanted & Imbued Arms (GMG p.253): for every +1 of enhancement bonus, the weapon ignores 5 points of Hardness of anything it strikes — and whatever ignores hardness also ignores NATURAL hardness (GMG p.96).${(enchInfo.abilities || []).some(a => a.name === 'Bane') ? '\nBane (GMG p.260): +2 effective enhancement vs the designated foe — 10 more points of hardness ignored there.' : ''}`)}">⛏ ignores ${enchInfo.enh * 5} hardness</span>` : ''}</div>`
      : '';
    return `<div class="rounded-3 p-6-8 mb-5" style="border:1px solid rgba(200,151,30,.15);">
      <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
        <div><span class="cursor-pointer fs-10 op-0_7" onclick="toggleItemCtl('${it.id}')" title="${rowOpen ? 'Hide' : 'Show'} provenance, Purchase DC, and the Enchant / Mastercraft controls">${rowOpen ? '▾' : '▸'}</span> <b${nameTip || ` class="cursor-pointer" onclick="toggleItemCtl('${it.id}')"`}>${escapeHTML(itemDisplayName(it))}</b>${it.customName ? ` <span class="fs-9 o-55 c-dim">(${escapeHTML(it.ref)})</span>` : ''}${profFlag} <span class="fs-10 o-60 c-dim">(${catalogue}${it.equipped ? ', equipped' : ''})</span>${armorStrip}</div>
        <div class="items-center gap-6" style="display:flex;">${equipToggle}${handSwap}${gripBtn}<button class="fs-10 btn btn-sm" onclick="renameItem('${it.id}')" title="Give this item a custom name (flavor only)">✎</button><button class="fs-10 btn btn-sm" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (cross-scalar; HH p.257 Sale Price rule applies)">💱</button><button class="fs-10 btn btn-sm" onclick="removeItemFromChar('${it.id}')" title="Remove from inventory">🗑</button></div>
      </div>
      ${dropdown}${effectNote}${enchLine}${gadgetHtml}
    </div>`;
  }).join('');
}

function renderGear() {
  const prompt = document.getElementById('gear-prompt'), cont = document.getElementById('gear-content');
  if (!curId) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  const c = chars.find(x => x.id === curId); if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  document.getElementById('gear-hero-nm').textContent = c.name + ' — Gear';
  if (!c.items) c.items = [];
  const techScale = scenarioTechScale(c);
  renderWealthPanel(c);  // v8.7.0

  const heldWorn = ITEM_SLOTS.filter(s => s.category === 'held' || s.category === 'worn');
  // v8.6.1: a two-handed weapon in the Main Hand claims the Off Hand as a
  // virtual occupant (derived, never stored — see weaponHands).
  const thWeapon = twoHandedEquipped(c);
  const rows = heldWorn.map(slotDef => {
    // v8.91.0 (Adam's task 3): Lost Arm REMOVES the Off Hand row's availability
    // visibly — until a cybernetic Prosthetic Arm replaces the arm (HH p.332
    // Replacements; the drawback's own Special line). The equip guard in
    // toggleItemEquipped already blocked it; now the slot SAYS so.
    if (slotDef.id === 'off_hand' && !offHandAvailable(c)) {
      return `<tr><td class="font-serif c-g45">${slotDef.label}</td><td><span class="fs-11" style="color:#e08080;" title="Lost Arm (drawback): one arm is gone — no off hand, no two-handed weapons, −2 on Climb, Swim, and grapple checks. Install a cybernetic Prosthetic Arm (🦾 Cybernetics, below) to restore it.">✕ unavailable — Lost Arm (install a cybernetic arm to restore)</span></td></tr>`;
    }
    const equippedItems = c.items.filter(i => i.slot === slotDef.id && i.equipped);
    const virtualClaim = (slotDef.id === 'off_hand' && thWeapon) ? 1 : 0;
    const free = (slotDef.capacity || 1) - equippedItems.length - virtualClaim;
    const itemsHtml = equippedItems.length
      ? equippedItems.map(it => renderEquippedItemChip(it)).join('')
      : (virtualClaim
        ? `<span class="op-0_65 fs-11 italic">— ${escapeHTML(thWeapon.ref)} (two-handed) —</span>`
        : `<span class="o-50 c-dim fs-11">— empty —</span>`);
    const eligible = c.items.filter(i => {
      if (i.equipped) return false;
      if (i.catalogue !== 'armor') {
        if (!slotDef.accepts.includes(i.catalogue)) return false;
        // v8.6.1: a two-handed weapon can't sit in the Off Hand.
        if (slotDef.id === 'off_hand' && i.catalogue === 'weapon' && weaponHands(getCatalogueEntry('weapon', i.ref)) === 2) return false;
        return true;
      }
      const def = getCatalogueEntry('armor', i.ref);
      if (slotDef.id === 'off_hand') return def && def.type === 'shield';
      if (slotDef.id === 'armor') return def && def.type !== 'shield';
      return false;
    });
    const eqOpts = eligible.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('');
    // v8.6.1: the picker equips into THIS row's slot (equipItemToSlot) — the
    // Off Hand picker previously equipped an item into its own stored slot.
    const equipSel = free > 0 && eligible.length
      ? `<select onchange="if(this.value){equipItemToSlot(this.value,'${slotDef.id}');this.value='';}" class="fs-11 ml-6"><option value="">+ equip…</option>${eqOpts}</select>`
      : '';
    return `<tr><td class="font-serif c-g85">${slotDef.label}</td><td>${itemsHtml}${equipSel}</td></tr>`;
  });
  document.getElementById('gear-equipped-rows').innerHTML = rows.join('');

  // v8.91.0: 🦾 Cybernetics shelf (implant body slots, HH pp.332-339).
  renderCybernetics(c);

  // v8.6.0: the body-slot dashboard is LIVE — equipped magic items render in
  // their slots (chips + an equip picker for unequipped same-slot items),
  // with the affinity kept as the empty-state hint.
  // v8.56.0 (playtest issue #3d): builder extracted to magicSlotRowsHTML so
  // the Sheet's read-only reference copy renders from the same source.
  document.getElementById('gear-magic-slots').innerHTML = magicSlotRowsHTML(c, true);
  try { const sh = document.getElementById('sheet-magic-slots'); if (sh) sh.innerHTML = magicSlotRowsHTML(c, false); } catch (e) {}
  renderMagicInventory(c);
  renderMagicBrowse();

  const summaries = computeEquippedWeaponSummaries(c);
  // v8.6.1 TWF pass: hand chips on dual-wielded rows, the off-hand attack
  // sequence (Improved/Greater TWF extra attacks), and a status row spelling
  // out the penalty math + Two-Weapon Defense note.
  const twfNow = twfStatus(c);
  const fmtAtk = (n) => `${n >= 0 ? '+' : ''}${n}`;
  // v8.6.1: Ranger Combat Style picker (HH: chosen at Ranger 2; stored as the
  // lazy field c.rangerCombatStyle) + live armor-gate status.
  const rangerLvlNow = migrateLegacyClasses(c).filter(e => e.name === 'Ranger').reduce((s, e) => s + (e.level || 0), 0);
  const rangerRow = rangerLvlNow >= 2 ? (() => {
    const style = c.rangerCombatStyle || '';
    const cat = wearingArmorCategory(c);
    const armorOK = !cat || cat === 'light';
    const sel = `<select onchange="setRangerCombatStyle(this.value)" class="fs-10"><option value=""${!style ? ' selected' : ''}>— choose —</option><option value="twf"${style === 'twf' ? ' selected' : ''}>Two-weapon combat</option><option value="archery"${style === 'archery' ? ' selected' : ''}>Ranged (archery)</option></select>`;
    let note = '';
    if (style === 'twf') {
      note = armorOK
        ? `virtual Two-Weapon Fighting active${rangerLvlNow >= 6 ? ' + Improved (Ranger 6)' : ''}${rangerLvlNow >= 11 ? ' + Greater (Ranger 11)' : ''}`
        : `SUPPRESSED — wearing ${cat} armor (light or none required)`;
    } else if (style === 'archery') {
      note = armorOK
        ? `virtual Rapid Shot active — shown as an alt mode on ranged weapon rows${rangerLvlNow >= 6 ? ' + Manyshot (Ranger 6: 2 arrows as one standard-action attack at −4, bows only)' : ''}${rangerLvlNow >= 11 ? ' + Improved Precise Shot (Ranger 11: ignore anything less than total cover/concealment)' : ''}`
        : `SUPPRESSED — wearing ${cat} armor (light or none required)`;
    }
    return `<tr><td colspan="5" class="fs-10_5 c-g75 p-4-8">🏹 <b>Ranger Combat Style</b> (2nd-level class feature): ${sel}${note ? ` <span style="color:${note.startsWith('SUPPRESSED') ? '#d4865a' : 'rgba(120,175,205,.85)'};">${escapeHTML(note)}</span>` : ''}</td></tr>`;
  })() : '';
  const twfRow = twfNow ? (() => {
    const why = [`primary ${fmtAtk(twfNow.pri)} / off-hand ${fmtAtk(twfNow.off)}`];
    why.push(twfNow.offLight ? 'light off-hand weapon' : 'off-hand weapon not light');
    why.push(twfNow.hasTWF ? (twfNow.virtualRanger ? 'TWF (Ranger combat style, virtual)' : 'TWF feat') : 'no TWF feat — take it to ease the penalties');
    if (twfNow.mixed) why.push(`melee + ranged in two hands ${fmtAtk(twfNow.mixed)}`);
    const extras = `off-hand attacks: ${twfNow.offAttacks}${twfNow.offAttacks > 1 ? ' (2nd at −5' + (twfNow.offAttacks > 2 ? ', 3rd at −10' : '') + ')' : ''}`;
    const twd = twfNow.hasTwoWeaponDefense ? ' · Two-Weapon Defense: +1 shield bonus to AC while dual-wielding (apply manually)' : '';
    return `<tr><td colspan="5" class="fs-10_5 c-tb85 p-4-8">⚔⚔ <b>Two-weapon fighting</b> — ${escapeHTML(why.join(' · '))} · ${escapeHTML(extras)}${escapeHTML(twd)} <span class="o-55 c-dim">(off-hand melee damage adds ½ Str bonus)</span></td></tr>`;
  })() : '';
  // v8.61.0: toggle label state + the defensive-riders footer row.
  { const mb = document.getElementById('melee-opts-btn');
    if (mb) { const on = meleeOptsOn(); mb.textContent = `⚔ Expanded Melee Options: ${on ? 'ON' : 'OFF'}`; mb.style.borderColor = on ? 'rgba(212,184,112,.6)' : ''; mb.style.color = on ? 'rgba(212,184,112,.95)' : ''; } }
  const defR = defenseRiders(c);
  const defRow = defR.length
    ? `<tr><td colspan="5" class="fs-10_5 p-4-8" style="color:var(--tc80);">🛡 <b>Defensive riders</b> — ${defR.map(d => `<span title="${escapeHTML(d[1])}" class="cursor-help nowrap">${escapeHTML(d[0])}</span>`).join(' · ')}</td></tr>`
    : '';
  document.getElementById('gear-weapon-summary').innerHTML = summaries.length
    ? summaries.map(s => {
        const atkTip = s.mods.map(m => `${m.label}: ${m.value >= 0 ? '+' : ''}${m.value}`).join('\n');
        // v8.8.1 (Adam): the damage cell shows die + ONE summed modifier
        // (extra dice like +1d6 cold stay distinct); the ⓘ itemizes the sum.
        const dmgTip = (s.dmgBreakdown || []).map(p => `${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}`).join('\n');
        const dmgInfo = dmgTip ? ` <span style="cursor:help;color:var(--tb75);font-size:10px;" title="${escapeHTML('Damage modifier breakdown:\n' + dmgTip)}">ⓘ</span>` : '';
        const handChip = s.hand ? ` <span class="rounded-2 fs-9 p-1-5" style="background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);">${s.hand === 'main' ? 'main hand' : 'off hand'}</span>` : (s.gripBothHands ? ` <span class="rounded-2 fs-9 p-1-5" style="background:rgba(220,205,138,.12);border:1px solid rgba(220,205,138,.35);" title="One-handed weapon wielded in both hands: Str ×1.5 damage, Power Attack ×2. Toggle with 🤲 on the inventory row.">🤲 both hands</span>` : '');
        // v8.60.0: Full Attack brackets — "+12 (+7)" per Adam's spec; TWF
        // off-hand rows keep their own extra-attack sequence display.
        const atkText = (s.twfExtraAtks && s.twfExtraAtks.length > 1)
          ? s.twfExtraAtks.map(fmtAtk).join(' / ')
          : (s.fullAttack && s.fullAttack.length > 1)
            ? `${fmtAtk(s.fullAttack[0])} (${s.fullAttack.slice(1).map(fmtAtk).join('/')})`
            : fmtAtk(s.attackBonus);
        const atkIterTip = (s.fullAttack && s.fullAttack.length > 1)
          ? `\n\nFull Attack: ${s.fullAttack.map(fmtAtk).join(' / ')} — one extra swing per 5 points of Base Attack (max 5), each at a cumulative −5.` : '';
        const unarmedTag = s.unarmed ? ` <span class="rounded-2 fs-9 p-1-5 cursor-help" style="background:rgba(200,151,30,.1);border:1px solid rgba(200,151,30,.3);" title="${escapeHTML(s.unarmedNote || '')}">🥊 unarmed</span>` : '';
        const capFlag = s.enchantOverCap ? ' <span class="c-red-text fs-10" title="Aggregate enchantment exceeds this item’s Tech Scale cap — GM override recorded.">⚑</span>' : '';
        // v9.6.1 (§256): the enchanted/imbued hardness-piercing rider.
        const ihTag = s.ignoreHardness ? ` <span class="rounded-2 fs-9 p-1-5 cursor-help c-vio" style="background:rgba(196,153,212,.1);border:1px solid rgba(196,153,212,.3);" title="${escapeHTML(`Enchanted & Imbued Arms (GMG p.253): for every +1 of enhancement bonus, the weapon ignores 5 points of Hardness of anything it strikes — and whatever ignores hardness also ignores NATURAL hardness (GMG p.96).${s.ihBane ? '\nBane (GMG p.260): +2 effective enhancement vs the designated foe — 10 more points of hardness ignored there.' : ''}\nA monk’s ki strike stacks through a Ki Focus weapon (+5 ignored per +1).`)}">⛏ ignores ${s.ignoreHardness} hardness${s.ihBane ? ' (+10 bane)' : ''}</span>` : '';
        const integTag = s.integratedIn ? ` <span class="rounded-2 fs-9 p-1-5" style="background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.3);" title="Alternate Weapon gadget — integrated into the host, usable at any time while it is equipped.${s.detachable ? ' Detachable (can be physically separated).' : ' Fixed mounting.'}">🔩 in ${escapeHTML(s.integratedIn)}${s.detachable ? ' · detachable' : ''}</span>` : '';
        const statStrip = s.statStrip ? `<div style="font-size:9.5px;color:var(--g55);margin-top:1px;cursor:help;" title="crit threat/multiplier · range increment · Rate of Fire (S = semiautomatic, A = automatic) · magazine${s.rangeRule ? escapeHTML('\n\n' + s.rangeRule) : ''}">${escapeHTML(s.statStrip)}</div>` : '';
        return `<tr><td>${escapeHTML(s.name)}${unarmedTag}${integTag}${handChip}${capFlag}${ihTag}${s.proficient ? '' : ' <span class="fs-10" style="color:#d4865a;" title="-4 not proficient">⚠ not proficient</span>'}${statStrip}</td>`
      + `<td class="cursor-help" title="${escapeHTML(atkTip + atkIterTip)}">${atkText}</td><td>${escapeHTML(s.damage)} ${escapeHTML(s.damageLabel)}${dmgInfo}</td>`
      + `<td style="font-size:10px;opacity:.8;cursor:help;" title="Resisted by: ${escapeHTML(s.resistances.join('; ') || '—')}${s.vsObjects ? escapeHTML('\nVs objects: ' + s.vsObjects) : ''}">${escapeHTML(s.typeLabel || (s.damageTypes || []).join('/') || '—')}</td>`
      + `<td class="fs-10">${s.altModes.length ? s.altModes.map(m => m.spike
          ? `<div title="${escapeHTML(m.label)}" style="color:${m.path ? 'rgba(220,205,138,.95)' : 'rgba(220,205,138,.4)'};white-space:nowrap;cursor:help;">↳ ⚡ ${escapeHTML(m.name)}: ${escapeHTML(m.display)}${m.path ? ` <button class="fs-9 p-0-5 ml-4 btn btn-sm" onclick="weaponSpikeUse('${escapeHTML(m.dispFeat)}','${m.dice}','${m.path}')">Expend Focus</button>` : ''}</div>`
          : `<div title="${escapeHTML(m.label)}" class="c-pb90 cursor-help nowrap">↳ ${escapeHTML(m.name)}: ${m.display ? escapeHTML(m.display) : `${m.atk >= 0 ? '+' : ''}${m.atk} atk / ×${m.dmgMult} dmg${m.roundsCost ? ` <span class="o-55 c-dim">(${m.roundsCost} rds)</span>` : ''}`}</div>`).join('') : '<span class="op-0_4">—</span>'}</td></tr>`
      // v8.61.0: the maneuvers + riders sub-row (Expanded Melee Options).
      + (((s.maneuvers && s.maneuvers.length) || (s.riders && s.riders.length))
          ? `<tr><td colspan="5" class="fs-10 lh-1_9" style="padding:2px 8px 7px 20px;border-bottom:1px solid rgba(200,151,30,.08);">`
            + (s.maneuvers || []).map(m => `<span title="${escapeHTML(m.label)}" class="cursor-help nowrap" style="color:rgba(212,184,112,.9);margin-right:12px;">⚔ ${m.n}: ${escapeHTML(m.display)}</span>`).join('')
            + (s.riders || []).map(r => `<span title="${escapeHTML(r[1])}" class="cursor-help nowrap" style="color:var(--tb65);margin-right:12px;">• ${escapeHTML(r[0])}</span>`).join('')
            + `</td></tr>`
          : '');
      }).join('') + twfRow + defRow + rangerRow
    : `<tr><td colspan="5" class="op-0_5 text-center">No weapons equipped.</td></tr>` + defRow + rangerRow;

  document.getElementById('gear-inv-weapons').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'weapon'), techScale, 'weapon');
  document.getElementById('gear-inv-armor').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'armor'), techScale, 'armor');
  document.getElementById('gear-inv-tools').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'equipment'), techScale, 'equipment');
  // v8.13.x Segment A: vehicles — dedicated light rows (no mastercraft/gadget
  // machinery; vehicle gear is a later slice). Operation lives on 🕹 Vehicles.
  const vhInvEl = document.getElementById('gear-inv-vehicles');
  if (vhInvEl) vhInvEl.innerHTML = renderVehicleInventory(c, techScale);
  // v8.17.0 Segment C: mecha inventory rows.
  const mhInvEl = document.getElementById('gear-inv-mecha');
  if (mhInvEl) {
    const mItems = getCharItems(c).filter(i => i.catalogue === 'mecha');
    mhInvEl.innerHTML = mItems.length ? mItems.map(it => {
      const def = mechaDefOf(it); if (!def) return '';
      const g = vehicleIntegrity(it);
      const nm = it.custom ? it.custom.name : (it.customName || it.ref);
      const state = g.destroyed ? ' <span class="fs-10" style="color:#999;">☠ DESTROYED</span>' : g.broken ? ' <span class="c-red-text fs-10">🛑 DISABLED</span>' : (it.piloted ? ' <span class="fs-10" style="color:#78afcd;">🕹 piloted</span>' : '');
      return `<div class="justify-between items-center gap-8 p-4-0 fs-12" style="display:flex;border-bottom:1px solid rgba(200,151,30,.08);">
        <div><b>🦿 ${escapeHTML(nm)}</b>${state}
          <div class="fs-9_5 c-g55">${def.size} TS ${def.ts} · ${escapeHTML(def.superstructure)}/${escapeHTML(def.armorType)} · Str ${def.str} · Hull ${g.hp}/${g.maxHP} · Hard ${g.hardness}</div>
        </div>
        <div class="nowrap">
          <button class="fs-10 btn btn-sm" onclick="showPage('vehicles')">🕹 Operate</button>
          <button class="fs-10 btn btn-sm" onclick="renameItem('${it.id}')">✎</button>
          <button class="fs-10 btn btn-sm btn-danger" onclick="removeItemFromChar('${it.id}')">✕</button>
        </div>
      </div>`;
    }).join('') : `<div class="o-50 c-dim fs-11 p-6-0">None owned yet.</div>`;
  }
  // v8.18.0 Segment D: starship inventory rows.
  const shInvEl = document.getElementById('gear-inv-starships');
  if (shInvEl) {
    const sItems = getCharItems(c).filter(i => i.catalogue === 'starship');
    shInvEl.innerHTML = sItems.length ? sItems.map(it => {
      const def = shipDefOf(it); if (!def) return '';
      const secs = shipSections(it);
      const worst = secs.filter(s => s.disabled).map(s => s.section);
      return `<div class="justify-between items-center gap-8 p-4-0 fs-12" style="display:flex;border-bottom:1px solid rgba(200,151,30,.08);">
        <div><b>🚀 ${escapeHTML(it.customName || it.ref)}</b>${worst.length ? ` <span class="c-red-text fs-10">🛑 ${worst.join('/')}</span>` : ''}
          <div class="fs-9_5 c-g55">${escapeHTML(def.subtype)} · ${def.cls} TS ${def.ts} · ${def.D}D · crew ${def.crew} · Hard ${def.hardness}</div>
        </div>
        <div class="nowrap">
          <button class="fs-10 btn btn-sm" onclick="showPage('vehicles')">🕹 Operate</button>
          <button class="fs-10 btn btn-sm" onclick="renameItem('${it.id}')">✎</button>
          <button class="fs-10 btn btn-sm btn-danger" onclick="removeItemFromChar('${it.id}')">✕</button>
        </div>
      </div>`;
    }).join('') : `<div class="o-50 c-dim fs-11 p-6-0">No vessels registered.</div>`;
  }
  renderNavTabs(c);  // a purchase can summon the Vehicles tab

  // v8.6.1 (Adam): "TL" was a vestige of the pre-Scales conversion — the tl
  // field IS the Tech Scale gate (compared against sixLevels.tech everywhere),
  // so the label reads TS like the Tools & Skill Kits list already did.
  // v8.6.1 (Adam's tidy-up request): the flat add-item dropdowns were
  // "disheveled" — each is now grouped into per-Tech-Scale <optgroup> shelves
  // (labeled with the SIX_LEVELS tech tier names, alphabetical within), with
  // scales ABOVE the scenario's Tech Scale still offered but shelved under a
  // "⚑ above scenario — GM approval" banner (the existing addItemToChar
  // over-TS confirm remains the actual gate).
  const tsGroupedOptions = (items, tsOf, optionHtml) => {
    const byTs = new Map();
    for (const it of items) {
      const ts = tsOf(it) || 0;
      if (!byTs.has(ts)) byTs.set(ts, []);
      byTs.get(ts).push(it);
    }
    return [...byTs.keys()].sort((a, b) => a - b).map(ts => {
      const tierName = ((SIX_LEVELS.tech.tiers[ts] || '').split('—')[0] || '').trim();
      const over = ts > techScale;
      const label = `TS ${ts}${tierName ? ' · ' + tierName : ''}${over ? ' — ⚑ above scenario (GM approval)' : ''}`;
      const opts = byTs.get(ts).sort((x, y) => (x.name || '').localeCompare(y.name || '')).map(optionHtml).join('');
      return `<optgroup label="${escapeHTML(label)}">${opts}</optgroup>`;
    }).join('');
  };
  // v8.7.0: each option carries its Purchase DC (full era-keyed price + the
  // ±20% market-fluctuation advisory ride the option tooltip).
  // v8.7.0: options show the MARKET-ADJUSTED DC (−2/TS below the scenario's
  // market, +5/TS above — Adam's ruling); the tooltip shows the math when
  // adjusted, plus the era-keyed price and the ±20% advisory.
  // v8.7.0: the price-checker lens (display-only) swaps the MARKET the
  // prices render against; the shelves' availability flags and all charging
  // stay on the real scenario TS.
  const priceTs = (_priceCheckTs != null) ? _priceCheckTs : techScale;
  const mdc = (dc, its) => marketAdjustedDC(dc, its, priceTs);
  const optPrice = (dc, its) => dc ? ` · DC ${mdc(dc, its)}` : '';
  const optTip = (dc, its, extra) => {
    const adj = mdc(dc, its);
    const math = (dc && adj !== dc) ? `Base DC ${dc} (TS${its}) → DC ${adj} in this TS${priceTs} market${_priceCheckTs != null ? ' (🔍 price-check view)' : ''}. ` : '';
    return ` title="${escapeHTML((extra ? extra + '\n\n' : '') + (dc ? math + priceLabel(adj, priceTs) + ' — ' + PRICE_FLUX_NOTE : ''))}"`;
  };
  // v8.56.0 (playtest issue #3a): every shelf opens on a no-selection
  // placeholder — auto-populating "Club"/"Hide"/"Alchemist's Kit" invited
  // accidental adds and read as pre-chosen to new players.
  const PICKER_PLACEHOLDER = '<option value="" selected>— select an item —</option>';
  document.getElementById('gear-add-weapon-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(WEAPONS_CATALOG, w => w.tl,
    w => `<option value="${escapeHTML(w.name)}"${optTip(parseInt(w.dc, 10) || 0, w.tl || 0)}>${escapeHTML(w.name)}${w.dmg_m ? ' (' + escapeHTML(w.dmg_m) + ')' : ''}${optPrice(parseInt(w.dc, 10) || 0, w.tl || 0)}</option>`);
  document.getElementById('gear-add-armor-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(ARMOR_CATALOG, a => a.tl,
    a => `<option value="${escapeHTML(a.name)}"${optTip(parseInt(a.dc, 10) || 0, a.tl || 0)}>${escapeHTML(a.name)} (+${a.ac_bonus} ${a.type})${optPrice(parseInt(a.dc, 10) || 0, a.tl || 0)}</option>`);
  document.getElementById('gear-add-equipment-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(EQUIPMENT_ITEMS, e => e.tech_scale,
    e => `<option value="${escapeHTML(e.name)}"${optTip(e.purchase_dc || 0, e.tech_scale || 0, [e.category, e.effect ? e.effect.text : ''].filter(Boolean).join(' — '))}>${escapeHTML(e.name)}${e.effect && (e.effect.kind === 'bonus') ? ' ✦' : (e.effect && e.effect.kind === 'kit' ? ' ⚒' : '')}${optPrice(e.purchase_dc || 0, e.tech_scale || 0)}</option>`);
  // v8.13.x Segment A: the vehicles shelf — restriction rating rides the tooltip.
  const vSel = document.getElementById('gear-add-vehicle-sel');
  if (vSel) vSel.innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(VEHICLES_DB, v => v.ts,
    v => `<option value="${escapeHTML(v.name)}"${optTip(v.purchase_dc || 0, v.ts || 0, `${v.category} · ${v.skill} skill · ${v.maneuver_class} (${v.maneuver_mod >= 0 ? '+' : ''}${v.maneuver_mod}) · Restriction: ${v.restriction} (+${v.restriction_mod} black-market DC)`)}>${escapeHTML(v.name)}${optPrice(v.purchase_dc || 0, v.ts || 0)}</option>`);
  // v8.17.0 Segment C: the sample-mecha shelf.
  const mSel = document.getElementById('gear-add-mecha-sel');
  if (mSel) {
    const arr = Object.keys(MECHA_UNITS).map(n => Object.assign({ name: n }, MECHA_UNITS[n]));
    mSel.innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(arr, m => m.ts,
      m => `<option value="${escapeHTML(m.name)}"${optTip(m.purchaseDC || 0, m.ts || 0, `${m.size} · ${m.superstructure} frame (Hardness ${m.hardness}) · ${m.armorType} armor +${m.equipAC} · Str ${m.str} / Dex ${m.dexMax} · ${m.hp} HP · Mil (+3) when armed`)}>${escapeHTML(m.name)}${optPrice(m.purchaseDC || 0, m.ts || 0)}</option>`);
  }
}
