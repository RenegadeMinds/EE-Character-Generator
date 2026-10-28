// =============================================================================
// js/ui/gear/wealth.js
// GEAR / WEALTH — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: funds, starting wealth, prices and
//   selling.
//
// KEY NAMES (so you can search for them)
//   tables and state: _priceCheckTs, _wealthChartOpen
//   functions (10): priceSpan, chargeUpgradeDifference, rollStartingWealth,
//   adjustFunds, setPriceCheckTs, toggleGearWealth, wealthChartHTML,
//   renderWealthPanel, sellItem, promptProvenance
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
// v8.96.0: the HH p.45 Wealth Score / Purchase DC chart — collapsible
// reference under the Wealth display; open-state survives re-renders.
let _wealthChartOpen = false;
function wealthChartHTML(c) {
  const rows = [];
  for (let dc = 1; dc < WEALTH_DC_DOLLARS.length; dc++) {
    const d = WEALTH_DC_DOLLARS[dc];
    const cur = c.wealthScore === dc;
    rows.push(`<div style="display:flex;justify-content:space-between;gap:8px;padding:0 6px;${cur ? 'background:rgb(var(--tint-gold) / .18);border-radius:2px;font-weight:bold;color:var(--gold);' : ''}"><span>DC ${dc}${cur ? ' ◂' : ''}</span><span>${fmtCoin(d / 100)} gp · $${d.toLocaleString()}</span></div>`);
  }
  return `<details ${_wealthChartOpen ? 'open' : ''} ontoggle="_wealthChartOpen=this.open" class="mt-8 fs-11">
    <summary class="cursor-pointer c-g80">📊 Wealth Score / Purchase DC chart <span class="cite cite-HH" title="Hero's Handbook p.45 — the Score/DC currency table (1 gp = $100 = 100 credits)">HH 45</span> <span class="op-0_5 fs-9_5">— your current score is highlighted</span></summary>
    <div class="rounded-3 overflow-y-auto mt-6 lh-1_7" style="columns:3;column-gap:18px;max-height:260px;padding:6px;border:1px solid rgb(var(--line-gold) / .2);">${rows.join('')}</div>
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
      ? `<span class="o-60 c-dim">— untracked · expand to roll starting wealth</span>`
      : `— Score <b class="c-gold">${c.wealthScore}</b> · <b style="color:${c.funds < 0 ? 'var(--red-text)' : 'var(--gold)'};">${escapeHTML(fundsLabel(c.funds, ts))}</b>${c.funds < 0 ? ' <span class="fs-10 c-red-text">(in debt)</span>' : ''}`;
  }
  if (c.wealthScore == null) {
    const parts = startingWealthBreakdown(c);
    const fixed = parts.reduce((s, p) => s + p.v, 0);
    el.innerHTML = `<div class="items-center gap-10 flex-wrap fs-12" style="display:flex;">
      <span class="op-0_7">Wealth untracked — starting score would be <b>${fixed} + 2d4</b> <span class="o-60 c-dim">(${escapeHTML(parts.map(p => `${p.label} +${p.v}`).join(' · '))})</span></span>
      <button class="fs-11 btn btn-sm btn-pri" onclick="rollStartingWealth()">⚄ Roll starting wealth</button>
      <span class="fs-10 o-50 c-dim">(until rolled, item adds don’t prompt for payment)</span>
    </div>`;
    return;
  }
  const pcOpts = ['<option value="">Scenario market (TS' + ts + ')</option>']
    .concat([0,1,2,3,4,5,6,7,8,9].map(t => `<option value="${t}" ${_priceCheckTs === t ? 'selected' : ''}>TS ${t}</option>`)).join('');
  el.innerHTML = `<div class="items-center flex-wrap fs-12_5" style="display:flex;gap:14px;">
    <span title="${escapeHTML('Wealth Score TRACKS the funds (v8.96.0, HH p.45): the highest threshold your current funds meet. Fall below it and the score drops; pass the next and it rises. Starting roll (HH p.44): ' + (c.wealthBreakdown || '—') + '. Funds are GM-editable via ± Adjust; the score follows.')}" style="cursor:help;">Wealth Score <b class="c-gold">${c.wealthScore}</b></span>
    <span>Funds: <b style="color:${c.funds < 0 ? 'var(--red-text)' : 'var(--gold)'};">${escapeHTML(fundsLabel(c.funds, ts))}</b>${c.funds < 0 ? ' <span class="fs-10 c-red-text">(in debt — GM)</span>' : ''}</span>
    <button class="fs-11 btn btn-sm" onclick="adjustFunds()">± Adjust</button>
    <label class="fs-11 op-0_85" title="Display-only lens: see what gear would cost in another era's market. Purchases always charge the scenario's market.">🔍 Price check:
      <select onchange="setPriceCheckTs(this.value)" class="fs-10">${pcOpts}</select></label>
    ${_priceCheckTs != null ? `<span class="fs-10" style="color:rgb(var(--text-amber));">🔍 viewing TS ${_priceCheckTs} market prices — display only; purchases charge the scenario (TS ${ts})</span>` : ''}
    <span class="fs-10 op-0_5 cursor-help" title="${escapeHTML(PRICE_FLUX_NOTE)}">💰 Purchased deducts · 🎁 Acquired is free · list prices; the GM applies market swings via ± Adjust</span>
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
