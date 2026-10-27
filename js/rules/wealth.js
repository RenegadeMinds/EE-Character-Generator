// =============================================================================
// js/rules/wealth.js
// WEALTH — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Money: Purchase DC and dollar conversions, market prices and the
//   wealth score.
//
// KEY NAMES (so you can search for them)
//   functions (11): dollarsForDC, dcForDollars, fmtCoin, priceLabel,
//   marketAdjustedDC, itemEffectivePDC, fundsLabel, parseFundsAmount,
//   startingWealthBreakdown, wealthScoreForFunds, syncWealthScore
//
// WHERE IT CAME FROM
//   Gathered from js/rules/12-wealth-and-prices.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function dollarsForDC(dc) {
  if (!dc || dc < 1) return null;
  return WEALTH_DC_DOLLARS[Math.min(dc, WEALTH_DC_DOLLARS.length - 1)];
}
function dcForDollars(v) {
  for (let dc = 1; dc < WEALTH_DC_DOLLARS.length; dc++) if (WEALTH_DC_DOLLARS[dc] >= v) return dc;
  return WEALTH_DC_DOLLARS.length - 1;
}
function fmtCoin(n) {
  return (n >= 100 || Number.isInteger(n)) ? n.toLocaleString() : String(Math.round(n * 100) / 100);
}
function priceLabel(dc, techScale) {
  const d = dollarsForDC(dc);
  if (d == null) return '';
  const gp = d / 100;
  // v8.56.0 (playtest issue #3e): dual pricing EVERYWHERE — gold and
  // dollars/credits side by side at the standing 1 gp = $100/cr conversion.
  // The old display era-gated to one currency by Tech Scale; a cross-era
  // table (which is every E&E table) wants both at a glance.
  return `DC ${dc} (${fmtCoin(gp)} gp · $${d.toLocaleString()}/cr)`;
}
// v8.7.0 (Adam's confirmation, 2026-09-02): the market-TS modifier applies
// MECHANICALLY — an item below the prevailing market's Tech Scale is cheaper
// by −2 DC per scale (a TS1 sword: DC 19 at TS1 → 17 at TS2 → … → 7 at
// TS7); above-market costs +5 DC per scale. The prevailing market is
// typically the scenario's TS (in-scenario variation is the GM's to
// adjudicate via ± Adjust). Floor DC 1.
function marketAdjustedDC(baseDc, itemTs, marketTs) {
  if (!baseDc) return 0;
  let dc = baseDc;
  if (itemTs < marketTs) dc -= 2 * (marketTs - itemTs);
  else if (itemTs > marketTs) dc += 5 * (itemTs - marketTs);
  return Math.max(1, dc);
}

// v8.93.0 (Adam's task 2): an item's EFFECTIVE Purchase DC — base catalog DC
// + the mastercraft tier's purchase_dc_mod (HH p.275: +1/+2/+3) + each
// installed gadget's purchase_dc_mod (tiered gadgets use the chosen tier).
function itemEffectivePDC(it, def) {
  const base = parseInt(def && def.dc, 10) || (def && def.purchase_dc) || 0;
  if (!base) return { dc: 0, base: 0, parts: [] };
  let dc = base; const parts = [];
  if (it && it.mastercraft && it.mastercraft.bonus) {
    const tier = (MASTERCRAFT_RULES.bonus_tiers || []).find(t => t.bonus === it.mastercraft.bonus);
    if (tier && tier.purchase_dc_mod) { dc += tier.purchase_dc_mod; parts.push(`mastercraft +${it.mastercraft.bonus} → +${tier.purchase_dc_mod} Purchase DC (HH p.275)`); }
  }
  for (const gg of ((it && it.gadgets) || [])) {
    const g = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === (it.catalogue === 'armor' ? 'armor' : it.catalogue));
    if (!g) continue;
    let mod = g.purchase_dc_mod;
    if (Array.isArray(mod)) mod = mod[Math.max(0, Math.min(mod.length - 1, (gg.tier || 1) - 1))];
    if (typeof mod === 'number' && mod) { dc += mod; parts.push(`${gg.ref}${gg.tier ? ' (tier ' + gg.tier + ')' : ''} → +${mod} Purchase DC`); }
  }
  return { dc, base, parts };
}
// Funds (a raw universal amount: 1 unit = 1 cp = $1 = 1 credit) rendered in
// the scenario era's currencies.
function fundsLabel(d, techScale) {
  if (d == null) return '—';
  const neg = d < 0 ? '−' : ''; const a = Math.abs(d);
  if (techScale <= 3) return `${neg}${fmtCoin(a / 100)} gp (${fmtCoin(a / 10)} sp)`;
  if (techScale <= 6) return `${neg}$${a.toLocaleString()} (${a.toLocaleString()} credits)`;
  return `${neg}${a.toLocaleString()} credits`;
}
// Parse a player-typed amount: "20gp", "150 sp", "$500", "1200", "300 credits"
// → universal units. Bare numbers are cp/$/credits.
function parseFundsAmount(s) {
  const m = String(s || '').trim().match(/^([+-]?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(gp|sp|cp|credits?|cr)?\.?$/i);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const n = parseFloat(m[2].replace(/,/g, ''));
  const mult = { gp: 100, sp: 10 }[(m[3] || '').toLowerCase()] || 1;
  return Math.round(sign * n * mult);
}

// ---- v8.7.0 WEALTH (Adam, 2026-09-02) -------------------------------------
// c.wealthScore = starting Wealth Score (HH p.44: 20 + occupation bonus(es) +
// 1 for Profession ranks + Windfall's +3 + 2d4 — rolled once, GM-editable);
// c.funds = current spendable funds in universal units, seeded from the
// score via the p.45 table. Every item add is then PURCHASED (deducts, ⚑
// GM-override below zero) or ACQUIRED (loot/gift — no impact), recorded as
// it.provenance and in the action log. Lazy fields — legacy characters see
// the roll button until they opt in; with wealth untracked, adds stay silent.
function startingWealthBreakdown(c) {
  const parts = [{ label: 'Base', v: 20 }];
  const occs = (c.occupations && c.occupations.length ? c.occupations : (c.occ ? [c.occ] : [])).filter(Boolean);
  for (const o of occs) {
    const od = getOccupationData(o);
    if (od && od.wealth != null) parts.push({ label: o, v: od.wealth });
  }
  const profRanks = Math.max(0, ...SKILLS.filter(sk => sk.family === 'Profession').map(sk => (c.skills || {})[sk.n] || 0));
  if (profRanks >= 1) parts.push({ label: 'Profession ranks', v: 1 });
  if ((c.feats || []).some(f => (f.name || f.n) === 'Windfall')) parts.push({ label: 'Windfall feat', v: 3 });
  return parts;
}
// v8.96.0 (a player's suggestion via Adam): the Wealth Score TRACKS the
// funds — the standing score is the highest threshold the current funds
// still meet (HH p.45 table). Fall below your threshold and the score
// drops; climb past the next and it rises. The starting roll (HH p.44)
// seeds it; from then on the ledger speaks.
function wealthScoreForFunds(funds) {
  if (funds == null) return null;
  if (funds <= 0) return 0;
  let score = 0;
  for (let dc = 1; dc < WEALTH_DC_DOLLARS.length; dc++) { if (WEALTH_DC_DOLLARS[dc] <= funds) score = dc; else break; }
  return score;
}
function syncWealthScore(c) {
  if (!c || c.wealthScore == null || c.funds == null) return false;
  const tracked = wealthScoreForFunds(c.funds);
  if (tracked === c.wealthScore) return false;
  const dir = tracked > c.wealthScore ? '▲ rose' : '▼ fell';
  logAct(`💰 Wealth Score ${dir}: ${c.wealthScore} → ${tracked} (funds ${fundsLabel(c.funds, scenarioTechScale(c))} ${tracked > c.wealthScore ? 'passed the next threshold' : 'fell below the old threshold'} — HH p.45).`);
  c.wealthScore = tracked;
  save();
  return true;
}
