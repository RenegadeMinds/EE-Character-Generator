// =============================================================================
// js/ui/gear/enchanting.js
// GEAR / ENCHANTING — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: the Enchant / Imbue builder dialog.
//
// KEY NAMES (so you can search for them)
//   tables and state: _enchantState
//   functions (8): openEnchantBuilder, closeEnchantModal, enchantSetEnh,
//   enchantSetImbued, enchantToggleAbility, renderEnchantModal, saveEnchant,
//   clearEnchant
//
// WHERE IT CAME FROM
//   Gathered from js/rules/13-armor-integrity-and-enchanting.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

let _enchantState = null; // {itemId, enh, abilities:Set, imbued}
function openEnchantBuilder(itemId) {
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const begin = () => {
    _enchantState = {
      itemId,
      enh: (it.enchant && it.enchant.enh) || 1,
      abilities: new Set((it.enchant && it.enchant.abilities) || []),
      imbued: !!(it.enchant && it.enchant.imbued),
    };
    document.getElementById('enchant-modal').classList.add('open');
    renderEnchantModal();
  };
  // Book requirement: the base must be mastercrafted (min +1). Not enforced
  // hard (GM domain) — offer to stamp the +1 on the way in.
  if (!it.mastercraft || !it.mastercraft.bonus) {
    confirmModal(`${it.ref} is not mastercrafted — enchanted / imbued items must be mastercrafted first (minimum +1). Apply mastercraft +1 now and continue?`, { title: '⚒ Mastercraft required', okLabel: 'Apply +1 & continue', cancelLabel: 'Cancel' })
      .then(ok => {
        if (!ok) return;
        const kind = mastercraftKindFor(it.catalogue);
        const rule = kind && MASTERCRAFT_RULES.targets_by_kind[kind];
        it.mastercraft = { bonus: 1, target: (rule && rule.choose_one) ? rule.choose_one[0] : 'defense' };
        save(); begin();
      });
    return;
  }
  begin();
}
function closeEnchantModal() { document.getElementById('enchant-modal').classList.remove('open'); _enchantState = null; }
function enchantSetEnh(v) { if (_enchantState) { _enchantState.enh = parseInt(v, 10) || 1; renderEnchantModal(); } }
function enchantSetImbued(v) { if (_enchantState) { _enchantState.imbued = v === 'imbued'; renderEnchantModal(); } }
function enchantToggleAbility(name) {
  const st = _enchantState; if (!st) return;
  if (st.abilities.has(name)) st.abilities.delete(name); else st.abilities.add(name);
  renderEnchantModal();
}
function renderEnchantModal() {
  const st = _enchantState; if (!st) return;
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === st.itemId); if (!it) return;
  const def = getCatalogueEntry(it.catalogue, it.ref) || {};
  const cap = enchantTsCap(def.tl || 0);
  const defs = enchantAbilityDefs(it.catalogue);
  const chosen = [...st.abilities].map(n => defs.find(d => d.name === n)).filter(Boolean);
  const abilityMod = chosen.reduce((s, d) => s + (d.price_bonus || 0), 0);
  const flatGp = chosen.reduce((s, d) => s + (d.price_bonus ? 0 : (d.price_gp || 0)), 0);
  const totalMod = st.enh + abilityMod;
  const per = it.catalogue === 'weapon' ? 2000 : 1000;
  const cost = totalMod * totalMod * per + flatGp;
  const prev = enchantInfoOf(it);
  const delta = prev ? Math.max(0, cost - prev.cost) : cost;
  const days = Math.ceil(delta / 1000);
  const overCap = totalMod > cap;
  const overAbility = abilityMod > 5;
  const word = st.imbued ? 'Imbued' : 'Enchanted';
  document.getElementById('enchant-modal-title').textContent = `⚒ ${word}: ${it.ref}`;
  const rows = defs.map(d => {
    const sel = st.abilities.has(d.name);
    const costLbl = d.price_bonus ? `+${d.price_bonus} bonus` : (d.price_gp ? `${d.price_gp.toLocaleString()} gp` : '—');
    // greyed when adding it would break the +5 ability cap or the TS cap
    // (flat-gp abilities never consume the budget — always available).
    const wouldMod = abilityMod + (d.price_bonus || 0);
    const grey = !sel && d.price_bonus && (wouldMod > 5 || st.enh + wouldMod > cap);
    return `<label style="display:flex;gap:7px;align-items:baseline;padding:3px 2px;border-bottom:1px solid rgb(var(--line-gold) / .06);${grey ? 'opacity:.38;' : 'cursor:pointer;'}" title="${escapeHTML((d.d || '').slice(0, 400))}">
      <input type="checkbox" ${sel ? 'checked' : ''} ${grey ? 'disabled' : ''} onchange="enchantToggleAbility('${escapeHTML(d.name).replace(/'/g, "\\'")}')">
      <b class="flex-1">${escapeHTML(d.name)}</b>
      <span style="font-size:10px;color:${d.price_bonus ? 'rgb(var(--text-amber))' : 'var(--pb90)'};">${costLbl}</span>
    </label>`;
  }).join('');
  document.getElementById('enchant-modal-body').innerHTML = `
    <div class="fs-11_5 lh-1_5 c-g75 mb-0_6rem">
      ${escapeHTML(it.ref)} is TS${def.tl || 0} — <b>max aggregate modifier +${cap}</b>. Mastercraft +${(it.mastercraft && it.mastercraft.bonus) || 0} (${(it.mastercraft && it.mastercraft.target) || '—'}) — the better of mastercraft vs enhancement applies per stat, no stacking.
    </div>
    <div class="items-center mb-0_6rem flex-wrap" style="display:flex;gap:14px;">
      <label class="fs-12">Type:
        <select onchange="enchantSetImbued(this.value)" class="fs-11">
          <option value="enchanted" ${!st.imbued ? 'selected' : ''}>Enchanted (arcane/divine)</option>
          <option value="imbued" ${st.imbued ? 'selected' : ''}>Imbued (psionic)</option>
        </select></label>
      <label class="fs-12">Enhancement bonus:
        <select onchange="enchantSetEnh(this.value)" class="fs-11">
          ${[1,2,3,4,5].map(v => `<option value="${v}" ${st.enh === v ? 'selected' : ''}>+${v}</option>`).join('')}
        </select></label>
    </div>
    <div class="fs-10 uppercase ls-0_08em c-g60 mb-3">Special abilities <span class="normal-case ls-0">(bonus-equivalents ≤ +5; flat-gp abilities don't consume the budget)</span></div>
    <div class="rounded-3 overflow-y-auto p-2-6" style="max-height:34vh;border:1px solid rgb(var(--line-gold) / .15);">${rows || '<div class="op-0_5 fs-11" style="padding:6px;">No abilities in the catalogue for this item type.</div>'}</div>
    <div class="mt-0_7rem fs-12 lh-1_6">
      Aggregate modifier: <b style="color:${overCap || overAbility ? 'var(--red-text)' : 'var(--gold)'};">+${totalMod}</b> (enhancement +${st.enh} · abilities +${abilityMod}${flatGp ? ` · flat ${flatGp.toLocaleString()} gp` : ''})<br>
      ${word} value: <b>${cost.toLocaleString()} gp</b> <span class="op-0_6 cursor-help" title="${escapeHTML(PRICE_FLUX_NOTE)}">(${escapeHTML(priceLabel(dcForDollars(cost * 100), scenarioTechScale(c)))})</span>${prev ? ` — upgrade cost <b>${delta.toLocaleString()} gp</b> (current value ${prev.cost.toLocaleString()} gp)` : ''} · crafting time ≈ <b>${days} day${days === 1 ? '' : 's'}</b> <span class="o-55 c-dim">(RP only)</span>
    </div>`;
  document.getElementById('enchant-modal-warn').textContent =
    overAbility ? `Ability bonus-equivalents total +${abilityMod} — the book caps them at +5.`
    : overCap ? `Aggregate +${totalMod} exceeds this item's TS cap (+${cap}) — saving records a GM override flag.` : '';
  document.getElementById('enchant-modal-clear').style.display = it.enchant ? '' : 'none';
}
async function saveEnchant() {
  const st = _enchantState; if (!st) return;
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === st.itemId); if (!it) return;
  const def = getCatalogueEntry(it.catalogue, it.ref) || {};
  const cap = enchantTsCap(def.tl || 0);
  const defs = enchantAbilityDefs(it.catalogue);
  const abilityMod = [...st.abilities].reduce((s, n) => { const d = defs.find(x => x.name === n); return s + ((d && d.price_bonus) || 0); }, 0);
  if (abilityMod > 5) { toast(`Ability bonus-equivalents cap at +5 (currently +${abilityMod}).`); return; }
  const totalMod = st.enh + abilityMod;
  let overCap = false;
  if (totalMod > cap) {
    if (!(await confirmModal(`Aggregate modifier +${totalMod} exceeds this TS${def.tl || 0} item's cap of +${cap}. Save anyway as a GM override? (The item will be flagged.)`, { title: '⚑ TS cap exceeded' }))) return;
    overCap = true;
  }
  // v8.7.0 wealth: the enchantment (or its upgrade delta) is Purchased or
  // Acquired like any other item.
  const defsAll = enchantAbilityDefs(it.catalogue);
  const flatGpNew = [...st.abilities].reduce((s, n) => { const d = defsAll.find(x => x.name === n); return s + ((d && !d.price_bonus && d.price_gp) || 0); }, 0);
  const per2 = it.catalogue === 'weapon' ? 2000 : 1000;
  const newCost = totalMod * totalMod * per2 + flatGpNew;
  const prevInfo = enchantInfoOf(it);
  const deltaGp = prevInfo ? Math.max(0, newCost - prevInfo.cost) : newCost;
  if (deltaGp > 0) {
    const prov = await promptProvenance(c, `${st.imbued ? 'Imbuing' : 'Enchanting'} ${enchantDisplayName(it)}`, deltaGp * 100);
    if (prov === null) return;
  }
  it.enchant = { enh: st.enh, abilities: [...st.abilities], imbued: st.imbued, overCap };
  closeEnchantModal();
  save(); renderGear(); renderSheet();
  toast(`${it.ref} is now ${enchantDisplayName(it)}${overCap ? ' ⚑ (GM override)' : ''}.`);
}
async function clearEnchant() {
  const st = _enchantState; if (!st) return;
  const c = currentChar(); if (!c) return;
  const it = (c.items || []).find(i => i.id === st.itemId); if (!it) return;
  if (!(await confirmModal(`Remove the enchantment from ${enchantDisplayName(it)}?`))) return;
  delete it.enchant;
  closeEnchantModal();
  save(); renderGear(); renderSheet();
  toast(`${it.ref} is mundane again.`);
}
