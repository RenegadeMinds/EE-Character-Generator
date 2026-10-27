// =============================================================================
// js/rules/homebrew.js
// HOMEBREW — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Homebrew feats and armory gear, and monstrous classes built from
//   creature types: storage and catalog syncing.
//
// KEY NAMES (so you can search for them)
//   tables and state: homebrewFeats, homebrewGear, monstrousStore
//   functions (9): hbStoreSave, hbByName, hbAdjSummary, hbgStoreSave,
//   monstrousSave, buildMonstrousClass, monstrousBoot, hbGearSync,
//   hbReverseEntry
//
// WHERE IT CAME FROM
//   Gathered from js/rules/06-homebrew-forge-armory-monstrous.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ==== v8.55.0: 🌍 HOMEBREW FORGE — structured GM-authored feats ====
// The worlds-of-origin request. Doctrine: closed-form payloads ride EXISTING rails
// (attribute bakes like racial adj; granted feats like Monk CMA/DMA), prose
// stays annotation. Adam's rulings 2026-09-29: World-style homebrew feats are
// FREE (no slot, no budget — the entry carries grantedBy so every counter
// already excludes it) and PREREQ-WAIVED (birthright doctrine). The entry's
// _hb snapshot makes grant/revoke self-contained and courier-safe.
let homebrewFeats = [];
function hbStoreSave() { try { localStorage.setItem('dxd20v2_homebrew', JSON.stringify(homebrewFeats)); } catch (e) {} }
function hbByName(n) { return homebrewFeats.find(x => x.name === n) || null; }
function hbAdjSummary(r) {
  const parts = [];
  (r.adj || []).forEach((v, i) => { if (v) parts.push(`${v > 0 ? '+' : ''}${v} ${ATTR_NAMES[i]}`); });
  if (r.choose && r.choose.n) parts.push(`+${r.choose.n} to one attribute (player's choice)`);
  if ((r.grants || []).length) parts.push(r.grants.join(' + '));
  if (r.free === false) parts.push('costs a feat selection');
  return parts.join(', ') || 'description only';
}
let homebrewGear = [];
function hbgStoreSave() { try { localStorage.setItem('dxd20v2_homebrew_gear', JSON.stringify(homebrewGear)); } catch (e) {} }
let monstrousStore = { classes: {}, races: {} };
function monstrousSave() { try { localStorage.setItem('dxd20v2_monstrous', JSON.stringify(monstrousStore)); } catch (e) {} }
function buildMonstrousClass(typeName, maxHD) {
  const key = Object.keys(MONSTER_TYPE_PROG).find(k => k.toLowerCase() === String(typeName || '').trim().toLowerCase());
  const p = MONSTER_TYPE_PROG[key] || { d: 8, b: .75, g: ['fort'] };
  const n = Math.max(20, Math.min(54, maxHD || 20));
  const bab = [], fort = [], ref = [], will = [], def = [], rep = [];
  for (let i = 1; i <= n; i++) {
    bab.push(Math.floor(p.b * i));
    fort.push(p.g.includes('fort') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    ref.push(p.g.includes('ref') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    will.push(p.g.includes('will') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    def.push(0); rep.push(0);
  }
  return { attr: 'STR', hd: p.d, bab, fort, ref, will, def, rep, sp: 2, monster: true, mType: key || 'Aberration' };
}
function monstrousBoot() {
  for (const [n, d] of Object.entries(monstrousStore.classes || {})) MONSTROUS_CLASSES[n] = d;
  for (const [n, d] of Object.entries(monstrousStore.races || {})) if (!RACES[n]) RACES[n] = d;
}
function hbGearSync() {
  for (const arr of [WEAPONS_CATALOG, ARMOR_CATALOG]) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].hb) arr.splice(i, 1);
  }
  for (const rec of homebrewGear) {
    const arr = rec.category === 'weapon' ? WEAPONS_CATALOG : ARMOR_CATALOG;
    if (arr.some(e => e.name === rec.name && !e.hb)) continue;  // never shadow canon
    arr.push(rec);
  }
}
// Shared reversal used by hbRevoke AND the Feats-page trash can.
function hbReverseEntry(c, f) {
  const hb = f._hb || {};
  const oldConMod = am(c.attrs[2]);
  for (let k = 0; k < 6; k++) c.attrs[k] = (c.attrs[k] || 10) - ((hb.adj || [])[k] || 0);
  const dMod = am(c.attrs[2]) - oldConMod;
  const hpDelta = hb.hpDelta ? -hb.hpDelta : dMod * (c.totalLvl || 1);
  if (hpDelta) { c.maxHP = Math.max(1, (c.maxHP || 1) + hpDelta); c.currentHP = Math.max(1, Math.min(c.currentHP || 1, c.maxHP)); c.hp = c.maxHP; }
  for (const g of (hb.grantsAdded || [])) {
    const gi = c.feats.findIndex(x => (x.name || x.n) === g && x.grantedBy === (f.name || f.n) + ' (homebrew)');
    if (gi >= 0) c.feats.splice(gi, 1);
  }
  logAct(`↩ ${f.name || f.n} revoked (GM homebrew): attribute bake reversed${hb.hpDelta ? `, HP ${-hb.hpDelta > 0 ? '+' : ''}${-hb.hpDelta}` : ''}${(hb.grantsAdded || []).length ? `, withdrew ${hb.grantsAdded.join(', ')}` : ''}.`);
}
