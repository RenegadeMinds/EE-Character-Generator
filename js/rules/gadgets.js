// =============================================================================
// js/rules/gadgets.js
// GADGETS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Mastercraft and gadgets: slots, eligibility and weapon
//   accessories.
//
// KEY NAMES (so you can search for them)
//   functions (8): maxMastercraftBonus, gadgetSlotCount, mastercraftKindFor,
//   eligibleGadgets, hasGadget, weaponAttachments, hasScope, accessoryFits
//
// WHERE IT CAME FROM
//   Gathered from js/rules/12-wealth-and-prices.js, js/rules/13-armor-
//   integrity-and-enchanting.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// MASTERCRAFT_RULES.tech_scale_cap.thresholds: [{min_tech_scale,max_bonus},...]
// (HH p.275: +1@TS1, +2@TS2, +3@TS4).
function maxMastercraftBonus(techScale) {
  let max = 0;
  for (const t of MASTERCRAFT_RULES.tech_scale_cap.thresholds) {
    if (techScale >= t.min_tech_scale) max = Math.max(max, t.max_bonus);
  }
  return max;
}

// Gadgets are technological (HH p.264, TS1+ only). Slot count = 1 + mastercraft
// bonus (HH p.274; Adam's ruling 2026-06-29: every item gets a base 1 slot,
// +1 per +1 of mastercraft, max 4 at +3 mastercraft).
function gadgetSlotCount(item, techScale) {
  if (techScale < 1) return 0;
  return 1 + ((item && item.mastercraft && item.mastercraft.bonus) || 0);
}

function mastercraftKindFor(catalogue) {
  if (catalogue === 'weapon') return 'weapon';
  if (catalogue === 'armor') return 'armor';
  if (catalogue === 'equipment') return 'electronic_mechanical';
  return null;
}
function eligibleGadgets(catalogue, item, techScale) {
  return GADGETS_CATALOG.filter(g => {
    if (g.type !== catalogue) return false;
    if (g.tech_scale > techScale) return false;
    // v8.6.1 (Adam's Autofire Module adjudication): the book restricts it to
    // "ranged weapon WITHOUT autofire" — hide it for already-automatic hosts.
    if (g.name === 'Autofire Module' && ((item && item.rof) || []).includes('A')) return false;
    if (!g.subtype || !g.subtype.length) return true;
    return g.subtype.every(s => {
      if (catalogue === 'weapon') {
        if (s === 'ranged') return isRangedWeapon(item);
        if (s === 'melee') return !isRangedWeapon(item);
        if (s === 'ballistic') return (item.damage_type || []).includes('ballistic');
        if (s === 'energy') return (item.damage_type || []).some(t => ENERGY_DAMAGE_TYPES.has(t));
        return true;
      }
      if (catalogue === 'armor' && ['light', 'medium', 'heavy', 'power'].includes(s)) return item.type === s;
      return true;
    });
  });
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
  const ranged = isRangedWeapon(wdef);
  const pistol = /pistol|derringer|revolver/i.test(wdef.name || wdef.n || '');
  if (fits === 'ranged') return ranged;
  if (fits === 'firearm') return !!wdef.firearm;
  if (fits === 'pistol') return !!wdef.firearm && pistol;
  if (fits === 'longarm') return !!wdef.firearm && !pistol;
  return false;
}
