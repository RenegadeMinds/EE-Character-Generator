// =============================================================================
// js/rules/12-wealth-and-prices.js
// WEALTH AND PRICES
// =============================================================================
//
// WHAT'S IN HERE
//   Money: the Wealth/Purchase DC to dollars ladder, price labels, market
//   fluctuation, buying and upgrading gear, plus weapon finesse exceptions and
//   which toolkits satisfy which skills.
//
// KEY NAMES (so you can search for them)
//   tables/objects: WEALTH_DC_DOLLARS, PRICE_FLUX_NOTE, ENERGY_DAMAGE_TYPES,
//   WEAPON_FINESSE_NAMED_EXCEPTIONS, TOOLKIT_SATISFIERS
//   functions (34): dollarsForDC, dcForDollars, fmtCoin, priceLabel,
//   marketAdjustedDC, priceSpan, chargeUpgradeDifference, itemEffectivePDC,
//   fundsLabel, parseFundsAmount, startingWealthBreakdown, rollStartingWealth,
//   adjustFunds, setPriceCheckTs, toggleGearWealth, powerHoverText,
//   wealthScoreForFunds, syncWealthScore, wealthChartHTML, renderWealthPanel,
//   sellItem, promptProvenance, maxMastercraftBonus, gadgetSlotCount,
//   mastercraftKindFor, isRangedWeapon, isFinesseEligible, finesseShieldACP,
//   eligibleGadgets, buildItemBonuses, equipParamSub, toolkitSatisfaction,
//   ownsSatisfyingToolkit, computeEquippedArmorShield
//
// LOAD ORDER
//   File 12 of 68. index.html loads it after js/rules/11-cybernetics.js and
//   before js/rules/13-armor-integrity-and-enchanting.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 8479-9083 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 8479-9083; unchanged below this line ----
// Purchase DC currency table (DC 1-80), with the universal bridge:
// 1 gp = 10 sp = 100 cp, and 1 cp = $1 = 1 credit (so DC 20 = $2,000 =
// 20 gp = 200 sp = 2,000 credits). Prices display era-keyed by the
// scenario's Tech Scale:  TS 0-3 → "DC 20 (20 gp / 200 sp)" ·
// TS 4-6 → "DC 20 ($2,000 / 2,000 credits)" · TS 7+ → "DC 20 (2,000
// credits)". Every price carries the market-fluctuation advisory pop-up.
// ============================================================================
const WEALTH_DC_DOLLARS = [0,2,5,12,20,30,40,55,70,90,120,150,200,275,350,500,650,900,1200,1500,2000,
  2750,3500,5000,6500,9000,12000,15000,20000,27500,35000,50000,65000,90000,120000,150000,200000,275000,350000,500000,
  650000,900000,1200000,1500000,2000000,2750000,3500000,5000000,6500000,9000000,12000000,15000000,20000000,27500000,35000000,
  50000000,65000000,90000000,120000000,150000000,200000000,275000000,350000000,500000000,650000000,900000000,1200000000,
  1500000000,2000000000,2750000000,3500000000,5000000000,6500000000,9000000000,12000000000,15000000000,20000000000,
  27500000000,35000000000,50000000000,65000000000];
const PRICE_FLUX_NOTE = 'Prices may fluctuate ±20% for prevailing market conditions — certain Cha-based skill checks and roleplaying Circumstance modifiers may apply (GM adjudicates). Market-Tech modifiers: −2 DC per Tech Scale the item sits below the market, +5 DC per Tech Scale above.';
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
// Small reusable price span with the fluctuation advisory pop-up. Pass
// itemTs to apply the market adjustment (tooltip shows the math).
function priceSpan(dc, techScale, itemTs, extraNote) {
  if (!dc) return '';
  const adj = (itemTs == null) ? dc : marketAdjustedDC(dc, itemTs, techScale);
  const lbl = priceLabel(adj, techScale);
  if (!lbl) return '';
  const mathNote = (itemTs != null && adj !== dc)
    ? `Base DC ${dc} (TS${itemTs} item) ${adj < dc ? '−2 DC per Tech Scale below' : '+5 DC per Tech Scale above'} the TS${techScale} market → DC ${adj}.\n\n` : '';
  return `<span style="font-size:10px;opacity:.6;cursor:help;" title="${escapeHTML((extraNote ? extraNote + '\n\n' : '') + mathNote + PRICE_FLUX_NOTE)}">${escapeHTML(lbl)}</span>`;
}

// v8.93.1 (Adam's clarification): an UPGRADE (mastercraft tier or gadget)
// charges the character the DIFFERENCE between the item's new effective
// price and its old one — gated by the usual provenance prompt (💰 paid /
// 🎁 gift-or-GM-grant). No silent retroactive deduction; cancelling backs
// the upgrade out. Downgrades refund nothing (selling is the Sell flow's
// business; the GM prices trade-ins). Silent no-op while wealth untracked.
async function chargeUpgradeDifference(c, it, oldDC, newDC, what) {
  if (!c || c.wealthScore == null) return true;               // wealth untracked
  if (!oldDC || !newDC || newDC <= oldDC) return true;        // no increase, no charge
  const ts = scenarioTechScale(c);
  const def = getCatalogueEntry(it.catalogue, it.ref);
  const itemTs = def ? ((def.tl != null ? def.tl : def.tech_scale) || 0) : null;
  const adjOld = itemTs == null ? oldDC : marketAdjustedDC(oldDC, itemTs, ts);
  const adjNew = itemTs == null ? newDC : marketAdjustedDC(newDC, itemTs, ts);
  const diff = Math.max(0, dollarsForDC(adjNew) - dollarsForDC(adjOld));
  if (!diff) return true;
  const pick = await new Promise(res => openChoiceModal(
    `${what} on ${it.ref} — Purchase DC ${oldDC} → ${newDC}: the upgrade is worth ${fundsLabel(diff, ts)}. How is the difference met?`,
    [`💰 Paid — deduct ${fundsLabel(diff, ts)} from funds`, '🎁 Gift / GM grant — no cost (GM approved)'], res));
  if (!pick) return false;                                    // cancelled → back out
  if (pick.startsWith('💰')) {
    if (diff > c.funds) {
      if (!(await confirmModal(`The upgrade costs ${fundsLabel(diff, ts)} but only ${fundsLabel(c.funds, ts)} is on hand. Pay anyway (funds go negative — GM adjudicates)?`, { title: '⚑ Insufficient funds' }))) return false;
    }
    c.funds -= diff;
    logAct(`💰 ${what} on ${it.ref}: paid the Purchase DC difference (${oldDC} → ${newDC}) — ${fundsLabel(diff, ts)}.`);
  } else {
    logAct(`🎁 ${what} on ${it.ref}: Purchase DC ${oldDC} → ${newDC} — difference met as a gift / GM grant.`);
  }
  return true;
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
function rollStartingWealth() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const parts = startingWealthBreakdown(c);
  const roll = (1 + Math.floor(Math.random() * 4)) + (1 + Math.floor(Math.random() * 4));
  parts.push({ label: '2d4 roll', v: roll });
  const score = parts.reduce((s, p) => s + p.v, 0);
  c.wealthScore = score;
  c.wealthBreakdown = parts.map(p => `${p.label} +${p.v}`).join(' · ');
  c.funds = dollarsForDC(score) || 0;
  logAct(`💰 Starting Wealth rolled: score ${score} (${c.wealthBreakdown}) → ${fundsLabel(c.funds, scenarioTechScale(c))}.`);
  save(); renderGear();
  toast(`Wealth Score ${score} — ${fundsLabel(c.funds, scenarioTechScale(c))} to spend.`);
}
async function adjustFunds() {
  const c = chars.find(x => x.id === curId); if (!c || c.funds == null) return;
  const v = await textModal('± Adjust funds', 'Signed amount — e.g. "+20gp", "-150 sp", "+$500", "-300" (bare numbers are $/credits/cp). GM adjudicates earnings, sales, and the ±20% market swings here.', '');
  if (v === null) return;
  const amt = parseFundsAmount(v);
  if (amt === null || !amt) { toast('Could not parse that amount.'); return; }
  c.funds += amt;
  logAct(`💰 Funds ${amt > 0 ? '+' : ''}${amt} → ${fundsLabel(c.funds, scenarioTechScale(c))}.`);
  save(); renderGear();
}
// v8.7.0 (Adam): the price checker — a transient, DISPLAY-ONLY market-TS
// lens for comparing relative value across eras. Never saved, never charged:
// purchases always bill the real scenario market.
let _priceCheckTs = null;
function setPriceCheckTs(v) {
  _priceCheckTs = v === '' ? null : parseInt(v, 10);
  renderGear();
}
// v8.72.0 (Adam): the Wealth section's expand/collapse — same idiom as the
// body-slot map. The header one-liner stays live in both states.
function toggleGearWealth() {
  const w = document.getElementById('gear-wealth-panel'), ch = document.getElementById('gear-wealth-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (ch) ch.textContent = open ? '▾' : '▸';
}
// v8.79.0 (Adam's Rhad report): the hover dossier for Sheet power rows —
// a plain-text stat line + the full description for a title attribute.
// The house cursor:help idiom: full accessibility at zero vertical cost,
// no duplication of the Powers/Spells tabs' management surfaces.
function powerHoverText(s) {
  if (!s) return '';
  const bits = [];
  if (s.school_raw) bits.push(s.school_raw);
  if (s.casting_time) bits.push('Cast: ' + s.casting_time);
  if (s.display) bits.push('Display: ' + s.display);
  if (s.range) bits.push('Range: ' + s.range);
  if (s.target) bits.push('Target: ' + s.target);
  if (s.area) bits.push('Area: ' + s.area);
  if (s.effect) bits.push('Effect: ' + s.effect);
  if (s.duration) bits.push('Duration: ' + s.duration);
  if (s.save) bits.push('Save: ' + s.save);
  if (s.resistance) bits.push('SR/PR: ' + s.resistance);
  return bits.join(' · ') + (s.d ? '\n\n' + s.d : '');
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
// v8.96.0: the HH p.45 Wealth Score / Purchase DC chart — collapsible
// reference under the Wealth display; open-state survives re-renders.
let _wealthChartOpen = false;
function wealthChartHTML(c) {
  const rows = [];
  for (let dc = 1; dc < WEALTH_DC_DOLLARS.length; dc++) {
    const d = WEALTH_DC_DOLLARS[dc];
    const cur = c.wealthScore === dc;
    rows.push(`<div style="display:flex;justify-content:space-between;gap:8px;padding:0 6px;${cur ? 'background:rgba(200,151,30,.18);border-radius:2px;font-weight:bold;color:var(--gold);' : ''}"><span>DC ${dc}${cur ? ' ◂' : ''}</span><span>${fmtCoin(d / 100)} gp · $${d.toLocaleString()}</span></div>`);
  }
  return `<details ${_wealthChartOpen ? 'open' : ''} ontoggle="_wealthChartOpen=this.open" style="margin-top:8px;font-size:11px;">
    <summary style="cursor:pointer;color:var(--g80);">📊 Wealth Score / Purchase DC chart <span class="cite cite-HH" title="Hero's Handbook p.45 — the Score/DC currency table (1 gp = $100 = 100 credits)">HH 45</span> <span style="opacity:.5;font-size:9.5px;">— your current score is highlighted</span></summary>
    <div style="columns:3;column-gap:18px;max-height:260px;overflow-y:auto;margin-top:6px;padding:6px;border:1px solid rgba(200,151,30,.2);border-radius:3px;line-height:1.7;">${rows.join('')}</div>
  </details>`;
}
function renderWealthPanel(c) {
  const el = document.getElementById('gear-wealth-panel'); if (!el) return;
  const ts = scenarioTechScale(c);
  syncWealthScore(c);  // v8.96.0: the score follows the funds, both directions
  // v8.72.0: the always-visible header summary — Score + Funds at a glance.
  const sum = document.getElementById('gear-wealth-summary');
  if (sum) {
    sum.innerHTML = c.wealthScore == null
      ? `<span style="opacity:var(--o60);color:var(--dim);">— untracked · expand to roll starting wealth</span>`
      : `— Score <b style="color:var(--gold);">${c.wealthScore}</b> · <b style="color:${c.funds < 0 ? 'var(--red-text)' : 'var(--gold)'};">${escapeHTML(fundsLabel(c.funds, ts))}</b>${c.funds < 0 ? ' <span style="font-size:10px;color:var(--red-text);">(in debt)</span>' : ''}`;
  }
  if (c.wealthScore == null) {
    const parts = startingWealthBreakdown(c);
    const fixed = parts.reduce((s, p) => s + p.v, 0);
    el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;">
      <span style="opacity:.7;">Wealth untracked — starting score would be <b>${fixed} + 2d4</b> <span style="opacity:var(--o60);color:var(--dim);">(${escapeHTML(parts.map(p => `${p.label} +${p.v}`).join(' · '))})</span></span>
      <button class="btn btn-sm btn-pri" style="font-size:11px;" onclick="rollStartingWealth()">⚄ Roll starting wealth</button>
      <span style="font-size:10px;opacity:var(--o50);color:var(--dim);">(until rolled, item adds don’t prompt for payment)</span>
    </div>`;
    return;
  }
  const pcOpts = ['<option value="">Scenario market (TS' + ts + ')</option>']
    .concat([0,1,2,3,4,5,6,7,8,9].map(t => `<option value="${t}" ${_priceCheckTs === t ? 'selected' : ''}>TS ${t}</option>`)).join('');
  el.innerHTML = `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px;">
    <span title="${escapeHTML('Wealth Score TRACKS the funds (v8.96.0, HH p.45): the highest threshold your current funds meet. Fall below it and the score drops; pass the next and it rises. Starting roll (HH p.44): ' + (c.wealthBreakdown || '—') + '. Funds are GM-editable via ± Adjust; the score follows.')}" style="cursor:help;">Wealth Score <b style="color:var(--gold);">${c.wealthScore}</b></span>
    <span>Funds: <b style="color:${c.funds < 0 ? 'var(--red-text)' : 'var(--gold)'};">${escapeHTML(fundsLabel(c.funds, ts))}</b>${c.funds < 0 ? ' <span style="font-size:10px;color:var(--red-text);">(in debt — GM)</span>' : ''}</span>
    <button class="btn btn-sm" style="font-size:11px;" onclick="adjustFunds()">± Adjust</button>
    <label style="font-size:11px;opacity:.85;" title="Display-only lens: see what gear would cost in another era's market. Purchases always charge the scenario's market.">🔍 Price check:
      <select onchange="setPriceCheckTs(this.value)" style="font-size:10px;">${pcOpts}</select></label>
    ${_priceCheckTs != null ? `<span style="font-size:10px;color:#d4b870;">🔍 viewing TS ${_priceCheckTs} market prices — display only; purchases charge the scenario (TS ${ts})</span>` : ''}
    <span style="font-size:10px;opacity:.5;cursor:help;" title="${escapeHTML(PRICE_FLUX_NOTE)}">💰 Purchased deducts · 🎁 Acquired is free · list prices; the GM applies market swings via ± Adjust</span>
  </div>${wealthChartHTML(c)}`;
}
// v8.7.0 (Adam's "Rogue Trader clause", 2026-09-02): cross-scalar sales.
// Sell an owned item into a market of ANY Tech Scale (advanced goods on a
// medieval backwater command a fortune; obsolete goods in advanced markets
// fetch scrap). Value = the item's DC market-adjusted to the CHOSEN market;
// then the HH p.257 Sale Price rule: deduct d20% from the base value — a
// successful Appraise check vs the item's Purchase DC upgrades to 2d20,
// take the better (smaller deduction). Proceeds land in funds; item is sold.
async function sellItem(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  if (c.wealthScore == null) { toast('Roll starting wealth first (Wealth panel) — selling needs a funds ledger.'); return; }
  const def = getCatalogueEntry(it.catalogue, it.ref);
  const scenTs = scenarioTechScale(c);
  // Pick the market.
  const tsPick = await new Promise(res => openChoiceModal(`💱 Sell ${enchantDisplayName(it)} — into which market? (Cross-scalar transactions are GM territory: the buyer must exist.)`,
    [`Scenario market (TS ${scenTs})`].concat([0,1,2,3,4,5,6,7,8,9].map(t => `TS ${t} market`)), res));
  if (!tsPick) return;
  const sellTs = tsPick.startsWith('Scenario') ? scenTs : parseInt(tsPick.replace(/\D+/g, ''), 10);
  // Base value in the chosen market.
  const enchInfo = enchantInfoOf(it);
  let baseUnits = null, dcUsed = null;
  if (enchInfo) { baseUnits = enchInfo.cost * 100; dcUsed = dcForDollars(baseUnits); }
  else if (it.catalogue === 'magic' && def && def.price_gp) { baseUnits = def.type === 'modern' ? def.price_gp : def.price_gp * 100; dcUsed = dcForDollars(baseUnits); }
  else if (def) {
    const baseDc = parseInt(def.dc, 10) || def.purchase_dc || 0;
    const itemTs = (def.tl != null ? def.tl : (def.ts != null ? def.ts : def.tech_scale)) || 0;  // v8.13.x: vehicles carry ts
    dcUsed = marketAdjustedDC(baseDc, itemTs, sellTs);
    baseUnits = dollarsForDC(dcUsed);
  }
  if (!baseUnits) { toast('No listed value — the GM sets a price (use ± Adjust after the deal).'); return; }
  // Sale Price rule: d20% deduction; Appraise success → 2d20 take better.
  const d20 = () => 1 + Math.floor(Math.random() * 20);
  // Full Appraise total: ranks + EFFECTIVE Int (equipped items reach it) +
  // always-on misc bonuses (feats/occupation/talents/items) + active
  // synergies — the same composition the Skills tab displays.
  const apprRanks = getLiveSkillRanks(c, 'Appraise');
  const apprMisc = ((computeSkillMiscBonuses(c) || {})['Appraise'] || {}).total || 0;
  const apprSyn = (computeSkillSynergies('Appraise', c).auto || []).reduce((s, e) => s + (e.value || 0), 0);
  const apprMod = apprRanks + am(effAttrs(c)[3]) + apprMisc + apprSyn;
  const useAppraise = await new Promise(res => openChoiceModal(`Haggling — Sale Price rule (HH p.257): deduct d20% from the base value.`,
    [`Straight sale — roll d20% deduction`, `Appraise first (+${apprMod} vs DC ${dcUsed}) — success rolls 2d20, keeps the better`], res));
  if (!useAppraise) return;
  let ded, rollNote;
  if (useAppraise.startsWith('Appraise')) {
    const check = d20(), total = check + apprMod, ok = total >= dcUsed;
    const r1 = d20(), r2 = ok ? d20() : null;
    ded = ok ? Math.min(r1, r2) : r1;
    rollNote = `Appraise ${check}+${apprMod}=${total} vs DC ${dcUsed} — ${ok ? `success: 2d20 (${r1}, ${r2}) keep ${ded}` : `failed: d20 ${r1}`}`;
  } else {
    ded = d20();
    rollNote = `d20 deduction: ${ded}`;
  }
  const proceeds = Math.round(baseUnits * (100 - ded) / 100);
  const ts = scenTs;
  if (!(await confirmModal(`Sell ${enchantDisplayName(it)} into the TS ${sellTs} market?\n\nBase value there: ${fundsLabel(baseUnits, ts)} (DC ${dcUsed})\n${rollNote} → −${ded}%\n\nProceeds: ${fundsLabel(proceeds, ts)}`, { title: '💱 Complete the sale?', okLabel: 'Sell', cancelLabel: 'Keep it' }))) return;
  c.funds += proceeds;
  c.items = c.items.filter(i => i.id !== itemId);
  logAct(`💱 Sold ${enchantDisplayName(it)} into the TS ${sellTs} market — base ${fundsLabel(baseUnits, ts)}, −${ded}% (${rollNote}) → +${fundsLabel(proceeds, ts)}; funds ${fundsLabel(c.funds, ts)}.`);
  save(); renderGear(); renderSheet();
  toast(`Sold for ${fundsLabel(proceeds, ts)}.`);
}

// The Purchased/Acquired gate. priceUnits = universal units (null = no listed
// price: provenance still recorded, nothing deducted). Returns 'purchased' |
// 'acquired' | null (cancelled). Silent no-op ('acquired', no prompt) while
// wealth is untracked.
async function promptProvenance(c, itemLabel, priceUnits) {
  if (!c || c.wealthScore == null) return 'acquired';
  const ts = scenarioTechScale(c);
  const priceTxt = priceUnits ? fundsLabel(priceUnits, ts) : 'no listed price';
  const pick = await new Promise(res => openChoiceModal(`${itemLabel} — how does it come to you? (${priceTxt})`,
    [`💰 Purchased${priceUnits ? ` — pay ${fundsLabel(priceUnits, ts)}` : ' — no listed price, GM sets any cost'}`, '🎁 Acquired — loot, gift, or GM grant (no cost)'], res));
  if (!pick) return null;
  if (pick.startsWith('💰')) {
    if (priceUnits) {
      if (priceUnits > c.funds) {
        if (!(await confirmModal(`${itemLabel} costs ${fundsLabel(priceUnits, ts)} but only ${fundsLabel(c.funds, ts)} is on hand. Purchase anyway (funds go negative — GM adjudicates)?`, { title: '⚑ Insufficient funds' }))) return null;
      }
      c.funds -= priceUnits;
      logAct(`💰 Purchased ${itemLabel} — ${fundsLabel(priceUnits, ts)} → ${fundsLabel(c.funds, ts)} remaining.`);
    } else {
      logAct(`💰 Purchased ${itemLabel} (no listed price — GM adjudicates).`);
    }
    return 'purchased';
  }
  logAct(`🎁 Acquired ${itemLabel}.`);
  return 'acquired';
}

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

// Best-effort gadget eligibility: type match (weapon/armor/equipment) + the
// scenario's Tech Scale gate + the gadget's subtype restrictions (ranged/
// melee/ballistic/energy for weapons; light/medium/heavy/power for armor).
// 'kind' on a WEAPONS_CATALOG entry encodes HANDEDNESS, not melee/ranged, so
// ranged is detected via kind==='ranged' OR firearm:true (one-handed firearms
// keep kind:'one-handed'). Flagged here rather than silently assumed correct.
const ENERGY_DAMAGE_TYPES = new Set(['laser', 'plasma', 'cryonic', 'sonic', 'disintegration']);
function isRangedWeapon(w) { return w.kind === 'ranged' || w.firearm === true; }

// v8.5.2 / v9.7.0 (§257): Weapon Finesse eligibility (HH p.255, "Weapon
// Finesse (Fighter)"): "a light weapon, rapier, whip, or spiked chain made
// for a creature of your size category" -- NOT simply kind==='light'. Whip,
// Spiked Chain, and Rapier are classified by handedness (kind), not light,
// so they ride a named exception (Rapier joined the catalogue in v8.15.3;
// this set predated it — closed in v9.7.0). Natural attacks and the unarmed
// strike ("always considered light weapons", the feat's own Note) take the
// Dex substitution on their synthesized rows, and the feat's shield clause
// — "if you carry a shield, its armor check penalty applies to your attack
// rolls" — now debits every finessed attack via finesseShieldACP.
const WEAPON_FINESSE_NAMED_EXCEPTIONS = new Set(['Whip', 'Spiked Chain', 'Rapier']);
function isFinesseEligible(w) { return w.kind === 'light' || WEAPON_FINESSE_NAMED_EXCEPTIONS.has(w.name); }
// v9.7.0 (§257): the feat's shield rider — the equipped shield's armor check
// penalty (0 when no shield, or ACP 0). Applies only to FINESSED attacks.
function finesseShieldACP(c) {
  let acp = 0;
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const d = getCatalogueEntry('armor', it.ref);
    if (d && d.type === 'shield') acp += (parseArmorCheckPenalty(d) || 0);
  }
  return acp;  // ≤ 0
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

// v8.5.2: item-derived bonus contributions — tool-kit ownership (no equip
// gate; Adam's ruling 2026-06-29: owning is sufficient) + equipped-gadget
// skill bonuses. Same {target:[{type,source,value,condition,label}]} shape as
// buildFeatBonuses/buildTalentBonuses, merged the same way in
// computeSkillMiscBonuses above. Non-skill targets (armor/weapon) are read
// directly by computeEquippedArmorShield / computeEquippedWeaponSummaries
// below rather than round-tripped through this generic map, since those
// stats aren't otherwise aggregated through a typed-target pipeline yet.
function buildItemBonuses(c) {
  const out = {};
  const push = (target, entry) => { (out[target] = out[target] || []).push(entry); };
  for (const it of getCharItems(c)) {
    if (it.catalogue === 'equipment') {
      // v9.1.0 (the HH Ch.VII catalogue, Adam's equipment review 2026-10-06):
      // effects are data — effect.grants[] = {t:'skill:X'|'fort'|'ref'|'will',
      // v, type, cond?}. Every target is a REAL lane key (the v9.0.x audit
      // found 8 kits keyed 'Repair (electrical)' / 'Craft' / 'Perform' that
      // reached no Sheet row). '$param' resolves to the item's chosen skill
      // (masterwork tool / instrument); an unchosen param grants nothing.
      // Zero-value conditional grants are pure ⚜ notes (binoculars, the
      // evidence kit's collect-evidence clause).
      const def = getCatalogueEntry('equipment', it.ref);
      const eff = def && def.effect;
      const lbl = it.param ? `${it.ref} (${it.param})` : it.ref;
      for (const gr of ((eff && eff.grants) || [])) {
        const tgt = equipParamSub(gr.t, it);
        if (!tgt || tgt.includes('$')) continue;
        push(tgt, { type: gr.type || 'equipment', source: `item:${it.ref}`, value: gr.v, condition: gr.cond ? equipParamSub(gr.cond, it) : null, label: lbl });
      }
      // v9.3.0: an upgraded computer's +1 equipment on Computer Use.
      if (it.upgraded && def && def.upgrade) for (const gr of def.upgrade.grants) push(gr.t, { type: gr.type, source: `item:${it.ref}:upgrade`, value: gr.v, condition: null, label: `${it.ref} (upgraded)` });
      // v9.2.0: WORN gear (equipped in its body slot) adds its worn grants —
      // night vision goggles' −4 Spot/Search ride only while they're on.
      if (it.equipped && def && def.worn) for (const gr of (def.worn.grants || [])) {
        push(gr.t, { type: gr.type || 'equipment', source: `item:${it.ref}:worn`, value: gr.v, condition: gr.cond || null, label: `${it.ref} (worn)` });
      }
      // Mastercraft on a tool/skill kit: additional equipment bonus to each
      // skill it grants unconditionally (or, for a pure kit, each skill it
      // satisfies) — the Techsmith's upgrade path.
      if (it.mastercraft && it.mastercraft.bonus && eff) {
        const mcT = new Set(((eff.grants || []).filter(g => !g.cond && g.v && String(g.t).startsWith('skill:')).map(g => equipParamSub(g.t, it).slice(6)))
          .concat(!(eff.grants || []).length ? (eff.satisfies || []).map(x => equipParamSub(x, it)) : []));
        for (const sk of mcT) if (!sk.includes('$')) push('skill:' + sk, { type: 'equipment', source: `item:${it.ref}:mastercraft`, value: it.mastercraft.bonus, condition: null, label: `${lbl} (mastercraft +${it.mastercraft.bonus})` });
      }
    }
    if (it.equipped) {
      for (const g of (it.gadgets || [])) {
        const gd = GADGETS_CATALOG.find(x => x.name === g.ref && x.type === it.catalogue);
        if (!gd || !gd.effect || gd.effect.kind !== 'bonus') continue;
        for (const contrib of (gd.effect.contributions || [])) {
          if (contrib.kind === 'skillBonus' && typeof contrib.amount === 'number') {
            // Gated contributions (situational OR requires, e.g. HUD Vehicle's
            // "requires a linked vehicle") are NOT auto-applied — surfaced as
            // a conditional note only, same treatment as conditional synergies.
            const gate = contrib.situational || contrib.requires || null;
            for (const sk of String(contrib.target).split('|')) {
              push('skill:' + sk, { type: contrib.stack || 'equipment', source: `gadget:${g.ref}`, value: contrib.amount, condition: gate, label: g.ref });
            }
          }
        }
        // Chameleonic Surface: Hide bonus keyed to the equipped armor's class.
        if (gd.name === 'Chameleonic Surface' && it.catalogue === 'armor') {
          const armorDef = getCatalogueEntry('armor', it.ref);
          const byClass = { light: 4, medium: 6, heavy: 10, power: 10, shield: 4 };
          const amt = armorDef ? (byClass[armorDef.type] || 4) : 4;
          push('skill:Hide', { type: 'circumstance', source: `gadget:${g.ref}`, value: amt, condition: null, label: g.ref });
        }
      }
    }
  }
  return out;
}

// v8.5.2: which catalogue equipment_items satisfy each toolkit-dependent
// skill, for the ownership-aware ⚒/⚒✓ marker in renderSkills (replaces the
// earlier hardcoded-list-only version). Craft (any) is satisfied by generic
// Artisan's tools (or masterwork) OR a matching tech tool kit, per HH; the
// other five map to their specific kit(s) per the skill->kit table (HH p.301).
const TOOLKIT_SATISFIERS = {
  'Repair': ["Electrical tool kit, basic", "Electrical tool kit, deluxe", "Mechanical tool kit, basic", "Mechanical tool kit, deluxe", "Multipurpose tool"],
  'Disable Device': ["Thieves' tools", "Thieves' tools, masterwork", "Lockpick set"],
  'Disguise': ["Disguise kit"],
  'Forgery': ["Forgery kit"],
  'Treat Injury': ["First aid kit", "Medical kit", "Surgery kit", "Healer's kit"],
};
// v9.1.0: TOOLKIT_SATISFIERS above is superseded by data — each equipment
// entry's effect.satisfies[] names the exact skill rows it equips you for
// (per-Craft now: the deluxe electrical kit satisfies Craft (Electronics),
// Artisan's tools the non-technical Crafts, the Chemical kit / Alchemist's
// lab Craft (Chemical)…). effect.partial = a minimally-sufficient tool (the
// Multipurpose tool: Repair at −2 instead of −4, Adam 2026-10-06).
function equipParamSub(str, it) {
  if (typeof str !== 'string' || !str.includes('$param')) return str;
  if (!it || !it.param) return str;
  const inner = (it.param.match(/\(([^)]+)\)/) || [, it.param])[1].toLowerCase();
  return str.replace(/\$paramtype/g, inner).replace(/\$param/g, it.param);
}
function toolkitSatisfaction(c, sk) {
  let full = false, partial = null; const by = [];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'equipment') continue;
    const def = getCatalogueEntry('equipment', it.ref);
    const eff = def && def.effect; if (!eff || !eff.satisfies) continue;
    if (!eff.satisfies.map(x => equipParamSub(x, it)).includes(sk.n)) continue;
    if (eff.partial) { partial = partial == null ? eff.partial : Math.max(partial, eff.partial); by.push(`${it.ref} (at ${eff.partial})`); }
    else { full = true; by.push(it.param ? `${it.ref} (${it.param})` : it.ref); }
  }
  return { full, partial, by };
}
function ownsSatisfyingToolkit(c, sk) { return toolkitSatisfaction(c, sk).full; }

// v8.5.2: equipped armor/shield item -> {armor, shield} equipment-bonus pair.
// Preferred by computeACDisplay over the manual c.armorAC/c.shieldAC fields,
// which remain the fallback for homebrew gear not in the catalogue (or a
// character with nothing equipped from it). Mastercraft on an armor-kind item
// adds directly to its bonus (armor's single mastercraft feature always
// targets Defense per MASTERCRAFT_RULES.targets_by_kind.armor).
function computeEquippedArmorShield(c) {
  let armor = null, shield = null;
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def) continue;
    // v8.6.1 (Adam's better-bonus ruling): a magic enhancement bonus and the
    // mastercraft bonus do NOT stack — the better one applies. v8.8.0
    // (Adam's amendment): armor mastercraft now chooses Defense OR mobility;
    // a mobility-targeted mastercraft adds nothing here (it raises the max
    // Dex cap instead — see armorMaxDexCap) and is never superseded by
    // enchantment, which makes the choice a real strategic fork.
    const mcT = it.mastercraft && it.mastercraft.target;
    const mc = (it.mastercraft && mcT !== 'mobility' && it.mastercraft.bonus) || 0;
    const enh = (it.enchant && it.enchant.enh) || 0;
    // v8.13.0 (Adam's T/ACtical armor pass): a BROKEN or DESTROYED item (HH
    // p.383: armor at 0 HP "no longer offers any armor bonus to AC, although
    // it still has any armor penalty") contributes nothing here — ACP, max
    // Dex, and speed limits still derive from the worn def elsewhere.
    const _integ = armorItemIntegrity(it);
    if (_integ && (_integ.broken || _integ.destroyed)) continue;
    const bonus = def.ac_bonus + Math.max(mc, enh);
    if (def.type === 'shield') shield = (shield || 0) + bonus;
    else {
      armor = (armor || 0) + bonus;
      // v8.14.x Segment B: a power armor's tactical-shield SYSTEM (Bulwark
      // +2 / Bastion +4 / Barricade +6, best undamaged one) adds shield AC.
      const paSh = (POWER_ARMOR_DB[it.ref]) ? paShieldBonus(it) : 0;
      if (paSh) shield = (shield || 0) + paSh;
    }
  }
  // v8.14.x Segment B: an ACTIVE Second Skin behaves as armor (HH p.241 —
  // its AC bonus doesn't stack with other armor; manifesting requires bare
  // armor anyway). Applies while the skin has hit points left.
  const _sk = activeSecondSkin(c);
  if (_sk && !_sk.destroyed && armor == null) armor = _sk.row.ac;
  return { armor, shield };
}

