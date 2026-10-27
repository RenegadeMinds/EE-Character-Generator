// =============================================================================
// js/rules/enchanting-and-armor.js
// ENCHANTING AND ARMOR — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Enchanting and imbuing arms and armor, and armor integrity
//   (hardness and hit points).
//
// KEY NAMES (so you can search for them)
//   functions (9): shieldSizeCategory, armorItemIntegrity, enchantTsCap,
//   enchantAbilityDefs, enchantInfoOf, enchantDisplayName,
//   classifiedDamageLabel, damageVsObjectsNote, trackedArmorItems
//
// WHERE IT CAME FROM
//   Gathered from js/app/57-armor-and-vehicle-integrity.js,
//   js/rules/13-armor-integrity-and-enchanting.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  const ench = enchantInfoOf(it);
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
  if (POWER_ARMOR_DB[it.ref]) {
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
// ============================================================================
// v8.13.0 (Adam's T/ACtical armor pass): Tracker Armor Integrity panel —
// hardness + HP per equipped armor/shield, the incoming-hit calculator
// ("let the generator take the math pain out"), repair, and state banners.
function trackedArmorItems(c) {
  return getCharItems(c).filter(it => it.catalogue === 'armor' && it.equipped && armorItemIntegrity(it));
}
