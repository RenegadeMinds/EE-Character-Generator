// =============================================================================
// js/rules/magic-items.js
// MAGIC ITEMS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Magic items: default slots, wired effects, bonuses and
//   descriptions.
//
// KEY NAMES (so you can search for them)
//   functions (5): magicItemDefaultSlot, magicItemEffectValue,
//   buildMagicItemBonuses, magicPriceLabel, magicItemDesc
//
// WHERE IT CAME FROM
//   Gathered from js/rules/09-item-effects-and-buffs.js, js/rules/10-minds-
//   ledger-and-magic-browser.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function magicItemDefaultSlot(item) {
  if (MAGIC_SLOT_TYPE[item.type]) return MAGIC_SLOT_TYPE[item.type];
  for (const [re2, slot] of MAGIC_SLOT_KEYWORDS) if (re2.test(item.name)) return slot;
  return 'carried';
}
function magicItemEffectValue(it, fx) {
  return it.tier || fx.value || (fx.tiers ? fx.tiers[0][0] : 0);
}

function buildMagicItemBonuses(c) {
  const out = {};
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'magic' || !it.equipped) continue;
    const fx = MAGIC_ITEM_EFFECTS[it.ref];
    if (!fx || fx.attr) continue;
    const v = magicItemEffectValue(it, fx);
    for (const target of (fx.targets || [fx.target])) {
      if (!target) continue;
      (out[target] = out[target] || []).push({
        type: fx.type || 'enhancement', source: 'item:' + it.id,
        value: v, label: it.ref + (it.tier ? ` +${it.tier}` : ''),
      });
    }
  }
  // v9.7.0 (§257, Adam's wiring request): weapon special abilities with
  // PASSIVE wielder effects. PARRYING (imbued, GMG): +1 insight to touch AC,
  // the parry modifier, and Reflex saves whenever the wielder HOLDS the
  // weapon — even flat-footed or surprised. The 'ac' lane feeds the touch
  // tier (computeACDisplay) and 'ref' the save lanes (computeStatBlock);
  // the parry modifier reads parryingHeldBonus directly (computeParryBonus).
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    if (!(it.enchant && (it.enchant.abilities || []).includes('Parrying'))) continue;
    for (const target of ['ac', 'ref']) {
      (out[target] = out[target] || []).push({
        type: 'insight', source: 'item:' + it.id, value: 1,
        label: `Parrying (${enchantDisplayName(it)})`,
      });
    }
  }
  return out;
}
function magicPriceLabel(m) {
  if (m.price_bonus) return `+${m.price_bonus} bonus`;
  // v8.7.0: gp/$ prices carry their Purchase DC equivalent (1 gp = $100).
  if (m.price_gp) {
    const dollars = m.type === 'modern' ? m.price_gp : m.price_gp * 100;
    const base = m.type === 'modern' ? `$${m.price_gp.toLocaleString()}` : `${m.price_gp.toLocaleString()} gp`;
    return `${base} · DC ${dcForDollars(dollars)}`;
  }
  if (m.type === 'artifact') return 'priceless';
  return '—';
}
// v9.10.1 (§264): every catalogue row earns its hand cursor. An item's own
// d wins; a spell-vehicle without one (the potions, oils, and wands came
// through the build with empty descriptions) derives its text from the
// spell it carries, looked up in SPELLS_DB at render time. Returns '' when
// nothing can be said — the row then renders without pointer or chevron.
function magicItemDesc(m) {
  if (m.d) return m.d;
  if (m.type !== 'potion' && m.type !== 'wand') return '';
  const base = m.name.replace(/\s*\((?:Potion|Oil|Potion or Oil)\)\s*$/i, '').trim();
  // Legacy 3.5 item names bridge to E&E's merged spell families (§218/§219):
  // "Cure Light Wounds" → "Cure Wounds", "Cure Serious Wounds" → "Cure
  // Wounds (Serious)", "Lesser Restoration" → "Restoration, Lesser".
  const candidates = [base];
  const cw = /^(Cure|Inflict) (Light|Moderate|Serious|Critical) Wounds$/.exec(base);
  if (cw) {
    if (cw[2] !== 'Light') candidates.push(`${cw[1]} Wounds (${cw[2]})`);
    candidates.push(`${cw[1]} Wounds`);
  }
  const lg = /^(Lesser|Greater) (.+)$/.exec(base);
  if (lg) candidates.push(`${lg[2]}, ${lg[1]}`);
  let sp = null;
  {
    for (const cand of candidates) {
      sp = SPELLS_DB.find(s => s.name === cand) || SPELLS_DB.find(s => s.name.toLowerCase() === cand.toLowerCase());
      if (sp) break;
    }
  }
  const vehicle = m.type === 'potion'
    ? 'Single use — a potion (or oil) carrying the spell'
    : 'A charged wand carrying the spell';
  if (sp && sp.d) return `${vehicle} ${base}${m.cl ? ` at ${m.cl_kind || 'CL'} ${m.cl}` : ''}: ${sp.d}`;
  return `${vehicle} ${base} — see its entry in the spell catalogue.`;
}
