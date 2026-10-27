// =============================================================================
// js/rules/13-armor-integrity-and-enchanting.js
// ARMOR INTEGRITY AND ENCHANTING
// =============================================================================
//
// WHAT'S IN HERE
//   T/ACtical armor integrity (hardness by Tech Scale, armor damage), and the
//   Enchant / Imbue builder for magic arms and armor.
//
// KEY NAMES (so you can search for them)
//   tables/objects: ARMOR_HARDNESS_BY_TS, ARMOR_SUBSTANCE_BY_TS,
//   ENCH_BONUS_HARDNESS, DAMAGE_CLASS_LABELS, ENCHANT_MAGICAL_DICE
//   functions (30): shieldSizeCategory, armorItemIntegrity, enchantTsCap,
//   enchantAbilityDefs, enchantInfoOf, enchantDisplayName, openEnchantBuilder,
//   closeEnchantModal, enchantSetEnh, enchantSetImbued, enchantToggleAbility,
//   renderEnchantModal, saveEnchant, clearEnchant, wearingArmorCategory,
//   virtualTwfFeats, twfStatus, classifiedDamageLabel, damageVsObjectsNote,
//   effectiveRoF, hasGadget, weaponAttachments, hasScope, accessoryFits,
//   mountAccessory, toggleComputerUpgrade, effectiveRangeIncrement,
//   effectiveMagazine, parseMaxDex, armorMaxDexCap
//
// LOAD ORDER
//   File 13 of 68. index.html loads it after js/rules/12-wealth-and-prices.js
//   and before js/rules/14-resistances-speed-dr-size.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 9084-9650 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 9084-9650; unchanged below this line ----
// ============================================================================
// v8.13.0 T/ACTICAL ARMOR INTEGRITY (Adam's armor-damage pass, 2026-09-02 —
// HH pp.382-384 "The T/ACtical Combat System", GMG p.241 enchanted hardness).
// The band rule: an attack result in [Touch AC, Total AC) strikes the ARMOR —
// its hardness reduces the damage, and the remainder is split between armor
// HP and wearer. A PROFICIENT wearer chooses the split; a non-proficient
// wearer's ATTACKER chooses (Adam's caveat) — hardness applies either way.
// Total AC or better hits the character directly (no hardness). Power armor
// and Environmental Seal armor ALWAYS intercede (full AC = crit confirms
// only). Derived stats are firm-wired from the equipped item; the ONE stored
// field is it.armorDamage (lazy 0), moved only by Tracker actions.
// Broken (0 HP): no AC bonus, penalties stay, enchant suppressed while
// flagged (book says "permanently" — Adam's ruling: reversible-state door,
// the GM adjudicates the final fate). Destroyed: damage ≥ 1.5 × max HP — the
// HH p.181 Repair-skill salvage rule ("reduced to more than half its maximum
// hp in negative HP cannot be repaired"), generalized to armor per Adam.
const ARMOR_HARDNESS_BY_TS = {   // HH p.384 Table: Armor Hardness by Tech Scale
  5: { light: 3,  medium: 8,  heavy: 10 },   // Alumisteel
  6: { light: 5,  medium: 10, heavy: 10 },   // Duralloy
  7: { light: 10, medium: 10, heavy: 15 },   // Neovulcanium
  8: { light: 10, medium: 15, heavy: 20 },   // Megatanium
};
const ARMOR_SUBSTANCE_BY_TS = { 5: 'Alumisteel', 6: 'Duralloy', 7: 'Neovulcanium', 8: 'Megatanium', 9: 'Unobtanium' };
// GMG p.241: bonus hardness by aggregate enchantment modifier (+1..+10) —
// the "×2 rounded up to the nearest 5" schedule, printed verbatim. Adam's
// ruling: keyed to the AGGREGATE modifier (enh + ability equivalents, ≤+10),
// per the table's range; +10 = +20 hardness / +100 HP (near-artifact).
const ENCH_BONUS_HARDNESS = [0, 5, 5, 10, 10, 10, 15, 15, 20, 20, 20];
// Book equivalence (HH p.384): small shield = light armor, large = medium,
// tower = heavy. Catalogue names: Buckler/light → light, heavy/riot → medium,
// tower → heavy.
function shieldSizeCategory(name) {
  if (/tower/i.test(name || '')) return 'heavy';
  if (/heavy|large|riot/i.test(name || '')) return 'medium';
  return 'light';
}
function armorItemIntegrity(it) {
  if (!it || it.catalogue !== 'armor' ) return null;
  const def = getCatalogueEntry('armor', it.ref);
  if (!def || !(def.ac_bonus > 0)) return null;
  const ts = def.tl || 0;
  const cat = def.type === 'shield' ? shieldSizeCategory(def.name)
            : def.type === 'power' ? 'heavy'   // heavy-row hardness pending the mecha pass
            : def.type;
  let hardness, hardSrc;
  // v9.12.0 (§269): a homebrew armor forged from a NAMED substance carries
  // its hardness with it — the substance's native-TS row (HH p.384), stamped
  // at forge time. A Megatanium chain shirt is hard like Megatanium.
  if (def.hb_substance && def.hb_hardness != null) {
    hardness = def.hb_hardness;
    hardSrc = `${def.hb_substance} (homebrew substance — native-TS row, HH p.384; alloy list HH pp.329-331): ${hardness}`;
  }
  else if (ts <= 4) { hardness = def.ac_bonus; hardSrc = `Steel: equipment AC bonus (${def.ac_bonus})`; }
  else {
    const row = ARMOR_HARDNESS_BY_TS[Math.min(ts, 8)];
    hardness = (row && row[cat] != null) ? row[cat] : def.ac_bonus;
    hardSrc = `${ARMOR_SUBSTANCE_BY_TS[Math.min(ts, 9)]}${ts >= 9 ? ' (TS 9 — GM plot-device territory; TS 8 row shown)' : ''}: ${cat} ${hardness}`;
  }
  const hardParts = [hardSrc];
  let maxHP = def.ac_bonus * 5;
  const hpParts = [`AC bonus ${def.ac_bonus} × 5`];
  const ench = (typeof enchantInfoOf === 'function') ? enchantInfoOf(it) : null;
  const m = ench ? Math.max(0, Math.min(10, ench.totalMod)) : 0;
  if (m > 0) {
    hardness += ENCH_BONUS_HARDNESS[m];
    hardParts.push(`enchantment +${ENCH_BONUS_HARDNESS[m]} (aggregate +${m}, GMG p.241)`);
    maxHP += m * 10;
    hpParts.push(`enchantment +${m * 10}`);
  }
  // v8.14.x Segment B: a POWER ARMOR unit carries MECHA stats — its
  // superstructure hardness and size-table HP replace the body-armor
  // conversion (FF Ch.III: the Implacable is Duralloy 15 / 50 HP, not
  // ac_bonus-derived). Enchantment durability still rides on top.
  let paUnit = null, substance = def.hb_substance || (ts <= 4 ? 'Steel' : (ARMOR_SUBSTANCE_BY_TS[Math.min(ts, 9)] || 'Steel'));
  if (typeof POWER_ARMOR_DB !== 'undefined' && POWER_ARMOR_DB[it.ref]) {
    paUnit = POWER_ARMOR_DB[it.ref];
    hardness = paUnit.hardness + (m > 0 ? ENCH_BONUS_HARDNESS[m] : 0);
    maxHP = paUnit.hp + (m > 0 ? m * 10 : 0);
    substance = paUnit.superstructure;
    hardParts.length = 0; hardParts.push(`${paUnit.superstructure} superstructure ${paUnit.hardness} (FF Ch.III)`);
    if (m > 0) hardParts.push(`enchantment +${ENCH_BONUS_HARDNESS[m]}`);
    hpParts.length = 0; hpParts.push(`${paUnit.size} mecha frame ${paUnit.hp}`);
    if (m > 0) hpParts.push(`enchantment +${m * 10}`);
  }
  const damage = Math.max(0, it.armorDamage || 0);
  const destroyThreshold = Math.ceil(maxHP * 1.5);
  const destroyed = damage >= destroyThreshold;
  const broken = !destroyed && damage >= maxHP;
  return {
    hardness, maxHP, damage, hp: maxHP - damage, broken, destroyed, destroyThreshold,
    isShield: def.type === 'shield', ts, cat,
    substance,
    alwaysIntercede: def.type === 'power' || hasGadget(it, 'Environmental Seal'),
    selfRepairing: hasGadget(it, 'Self-Repairing'),
    enchAggregate: m, hardParts, hpParts, def, paUnit,
  };
}

// ============================================================================
// v8.6.1: ENCHANT / IMBUE ARMS & ARMOR (Adam's rulings, 2026-09-01 — GMG
// pp.223-224, 240+). Special abilities are ADJECTIVES on an enchanted base
// item, not items in their own right:
//   • enhancement +1..+5 (minimum +1 before any ability), ability
//     bonus-equivalents up to +5 more, total aggregate modifier ≤ +10;
//   • the ITEM's own Tech Scale caps the aggregate (TS 9 → +2, TS 7-8 → +4,
//     TS 5-6 → +6, TS 3-4 → +8, TS 0-2 → +10); a GM may supersede — the
//     item is FLAGGED when the rules are exceeded;
//   • flat-gp abilities (Parrying, Manifester…) bypass the cap, any number;
//   • cost: weapons (total mod)² × 2,000 gp, armor/shields × 1,000 gp,
//     + flat-gp abilities; days to create/update = cost ÷ 1,000 (RP only);
//     upgrading later pays the DIFFERENCE in value (and time);
//   • mastercraft interplay (Adam): better bonus wins PER STAT, no stacking
//     — MC+3(attack) + enchant+1 = +3 non-magical to hit, +1 magic damage;
//     vs DR/magic only the magic enhancement counts (advisory);
//   • creation-side mechanics (feat, CL ≥ 3× bonus, XP, Craft DCs) are NOT
//     enforced — GM adjudicates; the generator just builds the item.
// Stored on the item as it.enchant = {enh, abilities:[names], imbued,
// overCap} — effects derive live (firm-wire door), value never stored.
// ============================================================================
function enchantTsCap(tl) {
  if (tl >= 9) return 2;
  if (tl >= 7) return 4;
  if (tl >= 5) return 6;
  if (tl >= 3) return 8;
  return 10;
}
function enchantAbilityDefs(catalogue) {
  const t = catalogue === 'weapon' ? 'weapon_ability' : 'armor_shield_ability';
  return MAGIC_ITEMS_DB.filter(m => m.type === t);
}
// Aggregate view of an item's enchantment: total modifier, flat gp, cost.
function enchantInfoOf(it) {
  if (!it || !it.enchant) return null;
  const e = it.enchant;
  const defs = enchantAbilityDefs(it.catalogue);
  const abilities = (e.abilities || []).map(n => {
    const d = defs.find(x => x.name === n);
    return { name: n, bonus: (d && d.price_bonus) || 0, gp: (d && !d.price_bonus && d.price_gp) || 0, def: d };
  });
  const abilityMod = abilities.reduce((s, a) => s + a.bonus, 0);
  const flatGp = abilities.reduce((s, a) => s + a.gp, 0);
  const totalMod = (e.enh || 0) + abilityMod;
  const per = it.catalogue === 'weapon' ? 2000 : 1000;
  const cost = totalMod * totalMod * per + flatGp;
  return { enh: e.enh || 0, abilities, abilityMod, flatGp, totalMod, cost, imbued: !!e.imbued, overCap: !!e.overCap };
}
// "+2 Flaming Longsword"-style display name. A converted specific item keeps
// its identity (customName: "Luck Blade", never "+2 Sword, short").
function enchantDisplayName(it) {
  if (it && it.customName) return it.customName;
  const info = enchantInfoOf(it);
  if (!info) return it.ref;
  const adj = info.abilities.map(a => a.name).join(' ');
  return `+${info.enh}${adj ? ' ' + adj : ''} ${it.ref}`;
}

let _enchantState = null; // {itemId, enh, abilities:Set, imbued}
function openEnchantBuilder(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
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
  const c = chars.find(x => x.id === curId); if (!c) return;
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
    return `<label style="display:flex;gap:7px;align-items:baseline;padding:3px 2px;border-bottom:1px solid rgba(200,151,30,.06);${grey ? 'opacity:.38;' : 'cursor:pointer;'}" title="${escapeHTML((d.d || '').slice(0, 400))}">
      <input type="checkbox" ${sel ? 'checked' : ''} ${grey ? 'disabled' : ''} onchange="enchantToggleAbility('${escapeHTML(d.name).replace(/'/g, "\\'")}')">
      <b style="flex:1;">${escapeHTML(d.name)}</b>
      <span style="font-size:10px;color:${d.price_bonus ? '#d4b870' : 'var(--pb90)'};">${costLbl}</span>
    </label>`;
  }).join('');
  document.getElementById('enchant-modal-body').innerHTML = `
    <div style="font-size:11.5px;line-height:1.5;color:var(--g75);margin-bottom:.6rem;">
      ${escapeHTML(it.ref)} is TS${def.tl || 0} — <b>max aggregate modifier +${cap}</b>. Mastercraft +${(it.mastercraft && it.mastercraft.bonus) || 0} (${(it.mastercraft && it.mastercraft.target) || '—'}) — the better of mastercraft vs enhancement applies per stat, no stacking.
    </div>
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:.6rem;flex-wrap:wrap;">
      <label style="font-size:12px;">Type:
        <select onchange="enchantSetImbued(this.value)" style="font-size:11px;">
          <option value="enchanted" ${!st.imbued ? 'selected' : ''}>Enchanted (arcane/divine)</option>
          <option value="imbued" ${st.imbued ? 'selected' : ''}>Imbued (psionic)</option>
        </select></label>
      <label style="font-size:12px;">Enhancement bonus:
        <select onchange="enchantSetEnh(this.value)" style="font-size:11px;">
          ${[1,2,3,4,5].map(v => `<option value="${v}" ${st.enh === v ? 'selected' : ''}>+${v}</option>`).join('')}
        </select></label>
    </div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--g60);margin-bottom:3px;">Special abilities <span style="text-transform:none;letter-spacing:0;">(bonus-equivalents ≤ +5; flat-gp abilities don't consume the budget)</span></div>
    <div style="max-height:34vh;overflow-y:auto;border:1px solid rgba(200,151,30,.15);border-radius:3px;padding:2px 6px;">${rows || '<div style="opacity:.5;font-size:11px;padding:6px;">No abilities in the catalogue for this item type.</div>'}</div>
    <div style="margin-top:.7rem;font-size:12px;line-height:1.6;">
      Aggregate modifier: <b style="color:${overCap || overAbility ? 'var(--red-text)' : 'var(--gold)'};">+${totalMod}</b> (enhancement +${st.enh} · abilities +${abilityMod}${flatGp ? ` · flat ${flatGp.toLocaleString()} gp` : ''})<br>
      ${word} value: <b>${cost.toLocaleString()} gp</b> <span style="opacity:.6;cursor:help;" title="${escapeHTML(PRICE_FLUX_NOTE)}">(${escapeHTML(priceLabel(dcForDollars(cost * 100), scenarioTechScale(c)))})</span>${prev ? ` — upgrade cost <b>${delta.toLocaleString()} gp</b> (current value ${prev.cost.toLocaleString()} gp)` : ''} · crafting time ≈ <b>${days} day${days === 1 ? '' : 's'}</b> <span style="opacity:var(--o55);color:var(--dim);">(RP only)</span>
    </div>`;
  document.getElementById('enchant-modal-warn').textContent =
    overAbility ? `Ability bonus-equivalents total +${abilityMod} — the book caps them at +5.`
    : overCap ? `Aggregate +${totalMod} exceeds this item's TS cap (+${cap}) — saving records a GM override flag.` : '';
  document.getElementById('enchant-modal-clear').style.display = it.enchant ? '' : 'none';
}
async function saveEnchant() {
  const st = _enchantState; if (!st) return;
  const c = chars.find(x => x.id === curId); if (!c) return;
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
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === st.itemId); if (!it) return;
  if (!(await confirmModal(`Remove the enchantment from ${enchantDisplayName(it)}?`))) return;
  delete it.enchant;
  closeEnchantModal();
  save(); renderGear(); renderSheet();
  toast(`${it.ref} is mundane again.`);
}

// v8.5.2: per-equipped-weapon resolved attack/damage summary. Folds in the
// proficiency advisory (-4 if not proficient, via the existing
// isProficientWithWeapon), the weapon's mastercraft bonus (exclusive choice
// of attack OR damage per HH p.275), equipped attack-bonus gadgets, and the
// damage label/resistances via the inlined DamageResolver — reusing the
// damage-typing substrate this catalogue was built on top of.
// v8.6.1 Two-Weapon Fighting status (Adam, 2026-09-01 — the TWF pass). Active
// when a weapon is equipped in EACH hand (a shield in the off hand is not
// two-weapon fighting). Penalties per HH p.244 (Normal: −6 primary / −10
// off hand; light off-hand weapon — unarmed always counts light — reduces
// both by 2; the TWF feat lessens primary by 2 and off hand by 6), plus the
// HH mixed-hands rule (melee in one hand + ranged in the other: −4 on those
// attacks, reduced to −2 by Improved TWF, removed by Advanced TWF). Extra
// off-hand attacks: 1 base, 2nd at −5 with Improved, 3rd at −10 with
// Greater or Advanced. All DERIVED from equipped state — firm-wire door.
// NOT auto-applied (advisory notes only): Ranger combat-style / Monk Flurry
// virtual TWF (conditional on armor/unarmed — GM domain), and Two-Weapon
// Defense's +1 shield AC (surfaced as a note, not folded into AC).
// Heaviest equipped armor category (shields excluded), or null if unarmored.
// Drives the Ranger combat-style armor gate ("light or no armor") and the
// Monk Flurry gate ("unarmored") — both derived live from the equipped flag.
function wearingArmorCategory(c) {
  let worst = null;
  const RANK = { light: 1, medium: 2, heavy: 3, power: 4 };
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def || def.type === 'shield') continue;
    if (!worst || (RANK[def.type] || 0) > (RANK[worst] || 0)) worst = def.type;
  }
  return worst;
}

// v8.6.1 (Adam's ruling, 2026-09-01): the Ranger's Combat Style (chosen at
// 2nd level; c.rangerCombatStyle, lazy field set on the Gear combat panel)
// grants VIRTUAL feats per the feats' Special lines — both chains, both
// gated LIVE on wearing light or no armor:
//   two-weapon: TWF (2nd) · Improved TWF (6th) · Greater TWF (11th)
//   archery:    Rapid Shot (2nd) · Manyshot (6th) · Improved Precise Shot (11th)
// Rapid Shot presents as a computed alt mode on ranged weapon rows (the
// ranged mirror of Flurry of Blows — Adam's parity call); Manyshot and
// Improved Precise Shot surface as notes (bow-specific / miss-chance rules
// the engine doesn't roll).
function virtualTwfFeats(c) {
  const out = new Set();
  const rangerLvl = migrateLegacyClasses(c || {}).filter(e => e.name === 'Ranger').reduce((s, e) => s + (e.level || 0), 0);
  if (rangerLvl >= 2 && c) {
    const cat = wearingArmorCategory(c);
    if (!cat || cat === 'light') {
      if (c.rangerCombatStyle === 'twf') {
        out.add('Two-Weapon Fighting');
        if (rangerLvl >= 6) out.add('Improved Two-Weapon Fighting');
        if (rangerLvl >= 11) out.add('Greater Two-Weapon Fighting');
      } else if (c.rangerCombatStyle === 'archery') {
        out.add('Rapid Shot');
        if (rangerLvl >= 6) out.add('Manyshot');
        if (rangerLvl >= 11) out.add('Improved Precise Shot');
      }
    }
  }
  return out;
}

function twfStatus(c) {
  const held = getCharItems(c).filter(it => it.catalogue === 'weapon' && it.equipped
    && (it.slot === 'main_hand' || it.slot === 'off_hand'));
  const mainW = held.find(i => i.slot === 'main_hand');
  const offW = held.find(i => i.slot === 'off_hand');
  if (!mainW || !offW) return null;
  const mainDef = getCatalogueEntry('weapon', mainW.ref);
  const offDef = getCatalogueEntry('weapon', offW.ref);
  if (!mainDef || !offDef) return null;
  const virtuals = virtualTwfFeats(c);
  const ownsF = (n) => (c.feats || []).some(f => (f.name || f.n) === n) || virtuals.has(n);
  const offLight = offDef.kind === 'light' || offDef.kind === 'unarmed';
  const hasTWF = ownsF('Two-Weapon Fighting');
  const hasITWF = ownsF('Improved Two-Weapon Fighting');
  const hasGTWF = ownsF('Greater Two-Weapon Fighting') || ownsF('Advanced Two-Weapon Fighting');
  const hasATWF = ownsF('Advanced Two-Weapon Fighting');
  let pri = -6, off = -10;
  if (offLight) { pri += 2; off += 2; }
  if (hasTWF) { pri += 2; off += 6; }
  let mixed = 0;
  if (isRangedWeapon(mainDef) !== isRangedWeapon(offDef)) mixed = hasATWF ? 0 : (hasITWF ? -2 : -4);
  return {
    pri, off, mixed, offLight, hasTWF, hasITWF, hasGTWF,
    offAttacks: 1 + (hasITWF ? 1 : 0) + (hasGTWF ? 1 : 0),
    hasTwoWeaponDefense: ownsF('Two-Weapon Defense'),
    virtualRanger: virtuals.size > 0,
    mainName: mainW.ref, offName: offW.ref,
  };
}

// v8.6.1 (Adam, 2026-09-01): classified damage-type labels — the old
// "N resist." column hid the useful fact. Each damage type reads as origin +
// family, straight from the DAMAGE_TYPES registry's ancestry (tech variants
// name their parent; plasma is the fire+acid composite; disintegration is
// exotic-tier). Enchantment energy dice append as Magical <element>, and an
// enchanted weapon notes that it beats DR/magic. Resistance detail moves to
// the cell tooltip.
const DAMAGE_CLASS_LABELS = {
  bludgeoning: 'Physical — Bludgeoning', piercing: 'Physical — Piercing', slashing: 'Physical — Slashing',
  ballistic: 'Tech Piercing (ballistic)',
  laser: 'Tech Fire (laser)', cryonic: 'Tech Cold (cryonic)', ionic: 'Tech Electricity (ionic)',
  plasma: 'Tech Fire + Acid (plasma)', concussion: 'Tech Force (concussion, nonlethal)',
  disintegration: 'Exotic — Disintegration',
  fire: 'Fire (energy)', cold: 'Cold (energy)', electricity: 'Electricity (energy)',
  acid: 'Acid (energy)', sonic: 'Sonic (energy)', force: 'Force (energy)', untyped: 'Untyped',
};
const ENCHANT_MAGICAL_DICE = {
  'Flaming': 'Magical Fire', 'Frost': 'Magical Cold', 'Shock': 'Magical Electricity', 'Psychokinetic': 'Magical Force',
  'Flaming Burst': 'Magical Fire', 'Icy Burst': 'Magical Cold', 'Shocking Burst': 'Magical Electricity', 'Psychokinetic Burst': 'Magical Force',
};
function classifiedDamageLabel(it, def) {
  const types = (def && def.damage_type) || [];
  const bits = types.map(t => DAMAGE_CLASS_LABELS[t] || t);
  for (const a of ((it && it.enchant && it.enchant.abilities) || [])) {
    if (ENCHANT_MAGICAL_DICE[a]) bits.push(`${ENCHANT_MAGICAL_DICE[a]} (${a})`);
  }
  let label = bits.join(' + ') || '—';
  if (it && it.enchant) label += ' · magic weapon (beats DR/magic)';
  // v8.8.0: Multiphasic Chamber — ballistic rounds ignore the incorporeal
  // 50% miss chance.
  if (hasGadget(it, 'Multiphasic Chamber')) label += ' · ignores incorporeal miss (Multiphasic)';
  return label;
}
// v8.6.1 (Adam's ruling): the Tech distinction exists to restore FULL object
// damage to the natural energies that lack it (fire ½, cold ¼, electricity ½
// vs objects); acid and sonic already ignore hardness, so they get no Tech
// variant. The registry's vs_objects notes surface in the cell tooltip so
// the label explains its own mechanical purpose.
function damageVsObjectsNote(def) {
  const notes = [];
  for (const t of ((def && def.damage_type) || [])) {
    for (const list of [DAMAGE_TYPES.base_descriptors, DAMAGE_TYPES.derived_descriptors, DAMAGE_TYPES.exotic_tier]) {
      const d = (list || []).find(x => x.id === t);
      if (d && d.vs_objects) notes.push(`${t}: ${d.vs_objects}`);
    }
  }
  return notes.join(' · ');
}

// v8.6.1 (Adam, 2026-09-01): compact HH weapon-statistics strip — crit
// threat/multiplier (normalized: "x3" → "20/×3", bare "20" → "20/×2"),
// range increment (leading token of the catalogue's tail field), Rate of
// Fire (S = semiautomatic, A = automatic), and magazine capacity. Rides
// under the weapon name on the Gear combat dashboard and the print sheet.
// v8.6.1 (Adam's Autofire Module adjudication): a weapon's EFFECTIVE Rate of
// Fire adds 'A' while an Autofire Module gadget is attached — derived live
// from the gadget, never written to the catalogue. Everything RoF-gated
// (Burst Fire alt mode, the Autofire spray, the stat strip) reads this.
function effectiveRoF(it, def) {
  const rof = ((def && def.rof) || []).slice();
  if (it && (it.gadgets || []).some(g => g.ref === 'Autofire Module') && !rof.includes('A')) rof.push('A');
  return rof;
}
// v8.8.0 gadget wiring sweep (Adam, 2026-09-02): the measurable-affecting
// gadgets derive live from attachment, like everything on the equipped flag.
function hasGadget(it, name) { return !!(it && (it.gadgets || []).some(g => g.ref === name)); }
// v9.3.0 (Adam's equipment review): WEAPON ATTACHMENTS = integrated gadgets
// + mounted removable accessories (HH pp.310-311). One per mountKey (scope /
// laser / suppressor / illuminator): a gadget and its removable twin never
// stack — the gadget is kept (suppressors: the better one, the gadget's +10).
// Accessories ride the weapon as it.accessories [{itemId, ref}] — derived
// views read them from the weapon alone (no character lookup needed).
function weaponAttachments(it) {
  const out = [], seen = new Map();
  for (const g of ((it && it.gadgets) || [])) {
    const gd = GADGETS_CATALOG.find(x => x.name === g.ref && x.type === 'weapon');
    const key = gd && gd.mountKey; const rec = { ref: g.ref, gd, source: 'gadget', key };
    if (key) { if (seen.has(key)) continue; seen.set(key, rec); }
    out.push(rec);
  }
  for (const a of ((it && it.accessories) || [])) {
    const ad = getCatalogueEntry('equipment', a.ref); const m = ad && ad.mount; if (!m) continue;
    if (seen.has(m.key)) { seen.get(m.key).shadowed = (seen.get(m.key).shadowed || []).concat([a.ref]); continue; }
    const gd = m.as ? GADGETS_CATALOG.find(x => x.name === m.as && x.type === 'weapon') : null;
    const rec = { ref: a.ref, gd, source: 'accessory', key: m.key, note: m.note || '' };
    seen.set(m.key, rec); out.push(rec);
  }
  return out;
}
function hasScope(it) { return weaponAttachments(it).some(a => a.key === 'scope'); }
function accessoryFits(fits, wdef) {
  if (!wdef) return false;
  const ranged = (typeof isRangedWeapon === 'function') ? isRangedWeapon(wdef) : (wdef.kind === 'ranged' || wdef.firearm);
  const pistol = /pistol|derringer|revolver/i.test(wdef.name || wdef.n || '');
  if (fits === 'ranged') return ranged;
  if (fits === 'firearm') return !!wdef.firearm;
  if (fits === 'pistol') return !!wdef.firearm && pistol;
  if (fits === 'longarm') return !!wdef.firearm && !pistol;
  return false;
}
async function mountAccessory(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
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
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  it.upgraded = !it.upgraded;
  logAct(`⬆ ${it.ref} ${it.upgraded ? 'upgraded (+1 equipment on Computer Use)' : 'upgrade removed'}.`);
  save(); renderGear(); renderSkills();
}
// Scope, Rangefinding Laser: range increment ×1.5.
function effectiveRangeIncrement(it, def) {
  const m = /^(\d+)[’']/.exec((def && def.tail) || '');
  if (!m) return null;
  const base = parseInt(m[1], 10);
  return hasScope(it) ? Math.round(base * 1.5) : base;   // v9.3.0: any scope — gadget or mounted, never stacked
}
// Expanded Magazine: doubles capacity (once per weapon).
function effectiveMagazine(it, def) {
  const cap = (def && def.magazine_capacity) || null;
  if (!cap) return null;
  return hasGadget(it, 'Expanded Magazine') ? cap * 2 : cap;
}

// v8.8.0 (Adam): armor mobility penalties go mechanical. Each armor lists a
// maximum Dex bonus (the armor's limited mobility caps what Dex can add to
// AC) and a speed line ("30’/20’" — the wearer's speed for base-30 / base-20
// characters). Morphic Metal Alloy raises max Dex +1 (data-driven from its
// maxDexBonus contribution); Ultralight Composition eases speed +5 ft, up
// to normal.
function parseMaxDex(v) {
  const m = /([+-]?\d+)/.exec(String(v || ''));
  return m ? parseInt(m[1], 10) : null;
}
// The character's max-Dex cap from equipped body armor (shields impose
// none in the catalogue data). Returns null = uncapped.
function armorMaxDexCap(c) {
  let cap = null;
  // v8.8.0: Festering Sores (HH p.416) — any worn armor's max Dex drops 2.
  const sores = (c && c.mutations || []).some(m => m.name === 'Festering Sores');
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def || def.type === 'shield') continue;
    let md = parseMaxDex(def.max_dex);
    if (md == null) continue;
    for (const gg of (it.gadgets || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'maxDexBonus' && typeof contrib.amount === 'number') md += contrib.amount;
      }
    }
    // v8.8.0 (Adam's amendment): mobility-targeted mastercraft raises the
    // armor's max Dex bonus by the mastercraft bonus.
    if (it.mastercraft && it.mastercraft.target === 'mobility') md += it.mastercraft.bonus || 0;
    if (sores) md -= 2;
    cap = (cap == null) ? md : Math.min(cap, md);
  }
  return cap;
}
