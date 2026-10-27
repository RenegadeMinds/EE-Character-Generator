// =============================================================================
// js/ui/gear/magic-items.js
// GEAR / MAGIC ITEMS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: the magic item browser and magic
//   inventory.
//
// KEY NAMES (so you can search for them)
//   tables and state: _magicBrowseOpen, _magicBrowseList, _magicExpanded
//   functions (6): toggleMagicBrowse, toggleMagicDetail, renderMagicBrowse,
//   addMagicFromBrowse, renderMagicInventory, magicSlotRowsHTML
//
// WHERE IT CAME FROM
//   Gathered from js/rules/10-minds-ledger-and-magic-browser.js,
//   js/rules/18-companions.js when the code was regrouped by topic and page.
//   Each function and table moved whole and unchanged, with the comments
//   above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

let _magicBrowseOpen = false, _magicBrowseList = [];
const _magicExpanded = new Set();
function toggleMagicBrowse() {
  _magicBrowseOpen = !_magicBrowseOpen;
  const wrap = document.getElementById('magic-browse-wrap');
  const btn = document.getElementById('magic-browse-toggle');
  if (wrap) wrap.style.display = _magicBrowseOpen ? 'block' : 'none';
  if (btn) btn.textContent = _magicBrowseOpen ? '▴ Hide the Catalogue' : '⌕ Browse Enchanted & Imbued Items (706)';
  if (_magicBrowseOpen) renderMagicBrowse();
}
function toggleMagicDetail(i) {
  const nm = _magicBrowseList[i] && _magicBrowseList[i].name;
  if (!nm) return;
  _magicExpanded.has(nm) ? _magicExpanded.delete(nm) : _magicExpanded.add(nm);
  renderMagicBrowse();
}
function renderMagicBrowse() {
  if (!_magicBrowseOpen) return;
  const el = document.getElementById('magic-browse-list'); if (!el) return;
  const q = (document.getElementById('magic-search').value || '').toLowerCase();
  const typeF = document.getElementById('magic-type-filter').value;
  _magicBrowseList = MAGIC_ITEMS_DB.filter(m => {
    if (typeF && m.type !== typeF) return false;
    // v8.8.0 (Adam): weapon/armor special ABILITIES are adjectives, not
    // items — hidden from the default browse (and from searches) unless
    // their type is explicitly selected in the filter, where they serve as
    // reference reading for the ✨ Enchant builder.
    if (!typeF && MAGIC_PROPERTY_TYPES.has(m.type)) return false;
    if (q && !(m.name.toLowerCase().includes(q) || (m.d || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const propBanner = (typeF && MAGIC_PROPERTY_TYPES.has(typeF))
    ? `<div style="padding:6px 9px;font-size:10.5px;color:var(--tb85);border-bottom:1px solid rgba(200,151,30,.1);">These are PROPERTIES, not items — reference reading for the ✨ Enchant / Imbue builder on a weapon or armor inventory row. They cannot be added directly.</div>`
    : '';
  const CAP = 100;
  el.innerHTML = propBanner + _magicBrowseList.slice(0, CAP).map((m, i) => {
    const open = _magicExpanded.has(m.name);
    const isProp = MAGIC_PROPERTY_TYPES.has(m.type);
    // v9.10.1 (§264): the dropdown text — own d, or spell-derived for
    // potions/wands. A row with nothing to say loses the hand cursor.
    const desc = magicItemDesc(m);
    const addBtn = isProp
      ? `<span style="font-size:9px;color:var(--g50);">property — apply via ✨ Enchant on a weapon/armor row (Gear inventory)</span>`
      : `<button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="addMagicFromBrowse(${i})">+ Add${m.type === 'artifact' ? ' (GM)' : ''}</button>`;
    return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="${desc ? 'cursor:pointer;' : ''}flex:1;" ${desc ? `onclick="toggleMagicDetail(${i})"` : ''}><b>${escapeHTML(m.name)}</b>
          <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.3);margin-left:4px;">${MAGIC_TYPE_LABELS[m.type] || m.type}</span>
          <span style="font-size:10px;opacity:var(--o55);color:var(--dim);margin-left:5px;">${m.cl ? (m.cl_kind || 'CL') + ' ' + m.cl + ' · ' : ''}${magicPriceLabel(m)}</span>
          ${desc ? `<span style="font-size:10px;opacity:var(--o40);color:var(--dim);">${open ? '▾' : '▸'}</span>` : ''}</div>
        ${addBtn}
      </div>
      ${m.aura ? `<div style="font-size:10px;opacity:.5;">${escapeHTML(m.aura)}</div>` : ''}
      ${open && desc ? `<div style="font-size:11.5px;margin-top:4px;line-height:1.5;color:var(--parch);">${escapeHTML(desc)}</div>${m.provenance ? `<div style="font-size:10px;opacity:.55;margin-top:3px;">${escapeHTML(m.provenance)}</div>` : ''}` : ''}
    </div>`;
  }).join('') + (_magicBrowseList.length > CAP ? `<div style="padding:6px 9px;font-size:11px;color:var(--g50);text-align:center;">…and ${_magicBrowseList.length - CAP} more — refine the filters.</div>` : '')
  || `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">Nothing matches the filters.</div>`;
}
// Not converted (deliberately): Javelin of Lightning, Screaming Bolt,
// Slaying/Sleep Arrow (one-shot ammunition), Shifter's Sorrow (no two-bladed
// sword in the weapon table). Sylvan Scimitar converted as of v8.15.2 (Adam
// ruled the Scimitar into the weapon tables, 2026-09-03).

async function addMagicFromBrowse(i) {
  const m = _magicBrowseList[i]; if (!m) return;
  // v8.7.0: specific arms/armor convert to real equippable items.
  const conv = SPECIFIC_ARMS_CONVERSIONS[m.name];
  if (conv) {
    const c0 = chars.find(x => x.id === curId); if (!c0) return;
    let slot = 'main_hand';
    if (conv.cat === 'armor') {
      const adef = getCatalogueEntry('armor', conv.base);
      slot = (adef && adef.type === 'shield') ? 'off_hand' : 'armor';
    }
    // v8.7.0 wealth: gate on the MAGIC item's own price, not the base's.
    const prov = await promptProvenance(c0, m.name, m.price_gp ? m.price_gp * 100 : null);
    if (prov === null) return;
    await addItemToChar(conv.cat, conv.base, slot, { skipPurchase: true });
    const added = (c0.items || []).filter(x => x.catalogue === conv.cat && x.ref === conv.base).pop();
    if (added && prov) added.provenance = prov;
    if (added) {
      added.customName = m.name;
      added.specialNote = conv.note || '';
      const mcTarget = conv.cat === 'weapon' ? 'attack' : 'defense';
      added.mastercraft = added.mastercraft || { bonus: 1, target: mcTarget };
      if (!conv.mcOnly) added.enchant = { enh: conv.enh || 1, abilities: conv.abilities || [], imbued: false, overCap: false };
      save(); renderGear(); renderSheet();
      toast(`${m.name} added as an equippable ${conv.cat} (${conv.mcOnly ? 'special material, nonmagical' : '+' + (conv.enh || 1) + (conv.abilities && conv.abilities.length ? ' ' + conv.abilities.join(' ') : '')} ${conv.base}).`);
    }
    return;
  }
  // v9.11.0 (§265, Adam: "wiring to imbue them on the spot"): the spell/
  // power VEHICLES — a dorje, power stone, scroll, or imbued tattoo is an
  // empty vessel until its spell or power is chosen, so the add flow asks.
  // The candidate list is SPELLS_DB filtered to the vehicle's level within
  // its family (psionic classes for powers, casting classes for spells);
  // the item records what it carries and takes the traditional name.
  if (m.vehicle) {
    const c0 = chars.find(x => x.id === curId); if (!c0) return;
    const PSI_CLS = new Set(['Psi/Wld', 'War', 'Telepath', 'Nomad', 'Seer', 'Kineticist', 'Egoist', 'Shaper']);
    const famLvl = (sp) => {
      const ls = (sp.levels || []).filter(l => m.vehicle.kind === 'power' ? PSI_CLS.has(l.cls) : !PSI_CLS.has(l.cls));
      return ls.length ? Math.min(...ls.map(l => l.lvl)) : null;
    };
    let names = SPELLS_DB.filter(sp => famLvl(sp) === m.vehicle.lvl).map(sp => sp.name);
    if (!names.length) names = SPELLS_DB.filter(sp => (sp.levels || []).some(l => l.lvl === m.vehicle.lvl)).map(sp => sp.name);
    names = [...new Set(names)].sort();
    if (!names.length) { toast(`No ${m.vehicle.kind}s of that level found in the catalogue.`); return; }
    const pick = await new Promise(res => openChoiceModal(
      `${m.name} — which ${m.vehicle.kind} does it carry? (Imbued at creation; ${m.cl_kind || 'CL'} ${m.cl}, the minimum.)`, names, res));
    if (!pick) return;
    const prov = await promptProvenance(c0, `${m.vehicle.label} of ${pick}`, m.price_gp ? m.price_gp * 100 : null);
    if (prov === null) return;
    await addItemToChar('magic', m.name, magicItemDefaultSlot(m), { skipPurchase: true });
    const added = (c0.items || []).filter(it => it.catalogue === 'magic' && it.ref === m.name).pop();
    if (added) {
      added.customName = `${m.vehicle.label} of ${pick}`;
      added.imbued = { name: pick, lvl: m.vehicle.lvl, kind: m.vehicle.kind };
      if (prov) added.provenance = prov;
      save(); renderGear();
      toast(`${added.customName} added (${m.vehicle.kind} carried: ${pick}, ${m.cl_kind || 'CL'} ${m.cl}).`);
    }
    return;
  }
  // v8.6.0 firm-wire: tiered items (Amulet of Health +2/+4/+6, Ring of
  // Protection +1..+5…) pick their tier at add time — stored as it.tier.
  const fx = MAGIC_ITEM_EFFECTS[m.name];
  const doAdd = async (tier) => {
    const c = chars.find(x => x.id === curId); if (!c) return;
    await addItemToChar('magic', m.name, magicItemDefaultSlot(m));
    const added = (c.items || []).filter(it => it.catalogue === 'magic' && it.ref === m.name).pop();
    if (tier && added) { added.tier = tier; save(); renderGear(); }
    // v8.8.0 (Adam's Resistances design): the Energy Resistance ring's type
    // is chosen by its creator — pick at add; feeds the Sheet panel.
    if (added && m.name === 'Energy Resistance') {
      const pick = await new Promise(res => openChoiceModal('Energy Resistance (ring) — which energy type? (Chosen by the item’s creator.)',
        ['Acid', 'Cold', 'Electricity', 'Fire', 'Sonic'], res));
      if (pick) { added.energyType = pick.toLowerCase(); save(); renderGear(); renderSheet(); }
    }
  };
  if (fx && fx.tiers && fx.tiers.length > 1) {
    const label = fx.attr ? `${fx.attr} enhancement` : (fx.type || 'bonus');
    openChoiceModal(`${m.name} — which tier?`,
      fx.tiers.map(([v, gp]) => `+${v} ${label} (${gp.toLocaleString()} gp)`),
      (sel) => { const v = parseInt(sel.match(/\+(\d+)/)[1], 10); doAdd(v); });
    return;
  }
  await doAdd(fx && fx.tiers ? fx.tiers[0][0] : null);
}
function renderMagicInventory(c) {
  const host = document.getElementById('gear-inv-magic'); if (!host) return;
  const owned = (c.items || []).filter(it => it.catalogue === 'magic');
  host.innerHTML = owned.length ? owned.map(it => {
    const def = getCatalogueEntry('magic', it.ref) || {};
    const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
      <div><b>${escapeHTML(it.customName || it.ref)}${it.tier ? ` +${it.tier}` : ''}</b>${it.customName ? ` <span style="font-size:9px;opacity:var(--o55);color:var(--dim);">(${escapeHTML(it.ref)})</span>` : ''}${(MAGIC_ITEM_EFFECTS[it.ref] && it.equipped) ? ' <span style="font-size:9px;color:var(--pb90);" title="firm-wired: effect applies while equipped">⚡wired</span>' : ''}
        <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.3);margin-left:4px;">${MAGIC_TYPE_LABELS[def.type] || def.type || 'item'}</span>
        <span style="font-size:10px;opacity:var(--o55);color:var(--dim);margin-left:5px;">${slotDef ? slotDef.label : it.slot} · ${magicPriceLabel(def)}</span>
        ${it.equipped ? '<span style="font-size:10px;color:#6dba88;margin-left:5px;">● equipped</span>' : ''}</div>
      <div>
        ${(slotDef && slotDef.category !== 'carried') ? `<button class="btn btn-sm" style="font-size:10px;" onclick="toggleItemEquipped('${it.id}')">${it.equipped ? 'Unequip' : 'Equip'}</button>` : ''}
        <button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')" title="Give this item a custom name (flavor only)">✎</button>
        <button class="btn btn-sm" style="font-size:10px;" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (cross-scalar; HH p.257 Sale Price rule applies)">💱</button>
        <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')">✕</button>
      </div>
    </div>`;
  }).join('') : `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">None owned yet — browse the catalogue below.</div>`;
}
// v8.56.0 (playtest issue #3d): the body-slot rows, buildable for the Gear
// dashboard (interactive) OR the Sheet's read-only reference copy.
function magicSlotRowsHTML(c, interactive) {
  // v9.6.0 (§255, Adam's chart): the dashboard shows the REAL body — the
  // canonical twelve places plus the Back (house addendum), occupancy per
  // group. The finer slot names (hat vs helmet, gloves vs gauntlets) remain
  // as enchantment affinities in the hover and in the empty-row hint.
  const slotById = (id) => ITEM_SLOTS.find(s => s.id === id) || {};
  const chipOf = (it) => interactive
    ? renderEquippedItemChip(it)
    : `<span style="display:inline-flex;align-items:center;background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.25);border-radius:3px;padding:2px 7px;font-size:11px;margin-right:4px;">${escapeHTML(itemDisplayName(it))}</span>`;
  const rows = Object.keys(SLOT_GROUPS).map(gid => {
    const g = SLOT_GROUPS[gid];
    const inGroup = (i) => (i.catalogue === 'magic' && g.slots.includes(i.slot)) || (i.catalogue === 'equipment' && g.slots.includes((gearDef(i) || {}).slot));
    const equipped = c.items.filter(i => inGroup(i) && i.equipped);
    const armorWorn = g.armorShares && c.items.some(i => i.catalogue === 'armor' && i.equipped && i.slot === 'armor');
    const free = g.cap - equipped.length - (armorWorn ? 1 : 0);
    const unequipped = c.items.filter(i => inGroup(i) && !i.equipped);
    const chips = equipped.map(chipOf).join('')
      + (armorWorn ? `<span style="display:inline-flex;align-items:center;background:rgba(120,145,170,.1);border:1px solid rgba(120,145,170,.3);border-radius:3px;padding:2px 7px;font-size:11px;margin-right:4px;" title="One robe OR suit of armor on the body — the worn armor occupies this place.">🛡 suit of armor</span>` : '');
    const eqSel = (interactive && free > 0 && unequipped.length)
      ? `<select onchange="if(this.value){toggleItemEquipped(this.value);this.value='';}" style="font-size:11px;margin-left:6px;"><option value="">+ equip…</option>${unequipped.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('')}</select>`
      : '';
    const empty = (!equipped.length && !unequipped.length && !armorWorn)
      ? `<span style="opacity:.45;font-size:11px;font-style:italic;">${escapeHTML(g.slots.map(id => slotById(id).label || id).join(' / '))}</span>` : '';
    const affin = g.slots.map(id => { const s = slotById(id); return s.affinity ? `${s.label}: ${s.affinity}` : s.label; }).filter(Boolean).join(' · ');
    return `<tr><td style="color:var(--g70);${affin ? 'cursor:help;' : ''}" title="${escapeHTML(affin)}">${g.label}${g.cap > 1 ? ` <span style="opacity:.5;font-size:10px;">(×${g.cap})</span>` : ''}${g.house ? ' <span style="opacity:.5;font-size:9px;" title="House addendum — not in the canonical twelve.">†</span>' : ''}</td><td>${chips}${eqSel}${empty}</td></tr>`;
  });
  // Imbued tattoos take no body slot (temporary; bodily limit) — their row rides below the groups.
  const t = ITEM_SLOTS.find(s => s.id === 'tattoo');
  if (t) {
    const inSlot = (i) => (i.catalogue === 'magic' && i.slot === 'tattoo') || (i.catalogue === 'equipment' && (gearDef(i) || {}).slot === 'tattoo');
    const equipped = c.items.filter(i => inSlot(i) && i.equipped);
    const unequipped = c.items.filter(i => inSlot(i) && !i.equipped);
    const eqSel = (interactive && equipped.length < (t.capacity || 1) && unequipped.length)
      ? `<select onchange="if(this.value){toggleItemEquipped(this.value);this.value='';}" style="font-size:11px;margin-left:6px;"><option value="">+ equip…</option>${unequipped.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('')}</select>` : '';
    const empty = !equipped.length && !unequipped.length ? `<span style="opacity:.45;font-size:11px;font-style:italic;">${escapeHTML(t.affinity || '')}</span>` : '';
    rows.push(`<tr><td style="color:var(--g70);" title="${escapeHTML(t.note || '')}">${t.label} <span style="opacity:.5;font-size:10px;">(×${t.capacity}, temporary — takes no body slot)</span></td><td>${equipped.map(chipOf).join('')}${eqSel}${empty}</td></tr>`);
  }
  return rows.join('');
}
