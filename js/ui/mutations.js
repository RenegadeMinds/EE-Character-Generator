// =============================================================================
// js/ui/mutations.js
// MUTATIONS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Mutations page: browser, effects, super powers,
//   supernatural attributes and super talents.
//
// KEY NAMES (so you can search for them)
//   tables and state: _muBrowseList, _muExpanded, _muBrowseOpen
//   functions (15): restSuperPPClick, buySuperPower, toggleMuBrowse,
//   renderMutationEffects, addMutationFromBrowse, removeMutationAt,
//   addMPGrantClick, setSuperMutantTier, toggleMuDetail, renderMutations,
//   renderSuAttrPanel, renderSuperTalentPanel, buySuperTalent,
//   buySuAttrStep, renderMutationsBrowse
//
// WHERE IT CAME FROM
//   Gathered from js/app/55-mutations-engine.js, js/app/56-supernatural-
//   attributes-pools-psi-focus.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function restSuperPPClick() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.superPPCurrent = getSuperPPState(c).max;
  save(); renderMutations(); renderPowers();
  toast('Super-power points restored.');
}

async function buySuperPower(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const spell = _pwBrowseList[idx]; if (!spell) return;
  if (!c.powers) c.powers = [];
  if (c.powers.some(p => p.name === spell.name && p.pool === 'super')) { toast(`${spell.name} is already a super-power.`); return; }
  const elig = superBuyEligibility(c, spell);
  if (!elig.ok) { toast(`Cannot buy: ${elig.why}.`); return; }
  // v8.8.0: variant entries buy at the PARENT's MP cost (superBuySpec).
  // v8.75.0: the price paid is elig.mp — the suite discount (HH p.670,
  // Adam's ruling) is already applied there; the record stamps the paid
  // price plus suite provenance, and the MP ledger reads the stamp.
  const spec = superBuySpec(spell);
  let payMp = elig.mp;
  // v8.80.0 (Adam's seller's-market ruling): rung families prompt WHICH
  // rung is being bought — the HH p.424 prices, tier-cap filtered; the
  // chosen rung stamps the record (the full scaling capability pays its
  // full upfront price).
  let rungLabel = null;
  if (elig.rungs) {
    const disc = elig.suite ? 1 : 0;
    const pick = await new Promise(res => openChoiceModal(
      `◈ ${spell.name} — which rung are you buying? (HH p.424 prices${disc ? '; suite discount −1 applies' : ''}${elig.rungsBlocked ? `; ${elig.rungsBlocked} higher rung(s) sit beyond your tier's per-power cap` : ''})`,
      elig.rungs.map(r => `${r[0]} — ${Math.max(1, r[1] - disc)} MP`), res));
    if (!pick) return;
    const idxR = elig.rungs.findIndex(r => pick.startsWith(r[0] + ' —'));
    if (idxR < 0) return;
    rungLabel = elig.rungs[idxR][0];
    payMp = Math.max(1, elig.rungs[idxR][1] - disc);
  }
  const st = getMPState(c);
  if (payMp > st.balance) {
    if (!(await confirmModal(
      `"${spell.name}" costs ${payMp} MP${elig.suite ? ` (suite discount −1 via ${elig.suite})` : ''} but only ${st.balance} MP is banked (earned ${st.totalEarned}, spent ${st.totalSpent}).\n\nBuy anyway as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `super-power bought at ${payMp} MP with only ${st.balance} banked`);
  }
  // v8.85.0 (Adam's perpetual-Buff rulings): the stamp regex expected a '|'
  // separator but every catalog mp_note writes "; Buff" — 1 of 83 Buff
  // powers ever stamped. Flags lie, code-reads convict. The guard still
  // excludes the four "includes Protection from X as Buff" partials.
  const isBuff = /(^|[;|])\s*Buff\b/i.test(spec.mpNote || '');
  c.powers.push({ name: spell.name, pool: 'super', mp: payMp,
    ...(rungLabel ? { rung: rungLabel } : {}),
    ...(elig.suite ? { suiteDisc: 1, suite: elig.suite } : {}),
    buff: isBuff || undefined, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } });
  const visited = new Set([spell.name]);
  grantComplimentarySuperPowers(c, spell, spell.name, visited);
  const freebies = visited.size - 1;
  save(); renderPowers();
  toast(`Bought ${spell.name}${rungLabel ? ` [${rungLabel}]` : ''} as a super-power (${payMp} MP${elig.suite ? ` — ◈ suite discount −1: ${elig.suite}, ${elig.suiteOwned} owned` : ''}${spec.via ? ` — priced as ${spec.via}` : ''}${freebies ? `, +${freebies} complimentary` : ''}).`);
}

// ----- Mutations tab -----
let _muBrowseList = [];
const _muExpanded = new Set();
// v8.6.0: catalogue starts collapsed (Adam's ergonomics note) — mirror of the
// Feats/Spells/Powers browse pattern; the list renders only while open.
let _muBrowseOpen = false;
function toggleMuBrowse() {
  _muBrowseOpen = !_muBrowseOpen;
  const wrap = document.getElementById('mu-browse-wrap');
  const btn = document.getElementById('mu-browse-toggle');
  if (wrap) wrap.style.display = _muBrowseOpen ? 'block' : 'none';
  if (btn) btn.textContent = _muBrowseOpen ? '▴ Hide the Catalogue' : '⌕ Browse Advantages & Drawbacks (65)';
  if (_muBrowseOpen) {
    renderMutationsBrowse();
    if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
// v8.6.0: live mechanical-effects panel — the wired numeric bonuses
// (skills/saves/natural AC, already flowing into the stat engines) plus the
// display-tier effects, grouped. Hidden when the character has none.
function renderMutationEffects(c) {
  const host = document.getElementById('mu-effects');
  if (!host) return;
  const fx = computeMutationEffects(c);
  const bon = buildMutationBonuses(c);
  const wired = [];
  for (const target in bon) {
    for (const b of bon[target]) {
      const label = target.startsWith('skill:') ? target.slice(6)
        : ({fort:'Fort save', ref:'Reflex save', will:'Will save', naturalAC:'Natural AC'})[target] || target;
      wired.push(`${b.value > 0 ? '+' : ''}${b.value} ${label}${b.condition ? ' (' + b.condition + ')' : ''} <span style="opacity:var(--o55);color:var(--dim);">— ${escapeHTML(b.label.replace(' (Ex)',''))}</span>`);
    }
  }
  if (!fx.length && !wired.length) { host.innerHTML = ''; return; }
  const groups = {};
  for (const e of fx) (groups[e.group] = groups[e.group] || []).push(e);
  let html = `<div style="margin-bottom:1rem;padding:7px 10px;background:rgba(0,0,0,.18);border:1px solid rgba(196,153,212,.25);border-radius:3px;">
    <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--tv80);margin-bottom:4px;">Mutation Effects</div>`;
  if (wired.length) html += `<div style="font-size:11px;color:var(--tx85);line-height:1.5;margin-bottom:3px;"><b style="color:var(--tv75);font-size:10px;">WIRED INTO STATS:</b> ${wired.join(' · ')}</div>`;
  for (const g of ['Senses & Movement', 'Natural Attacks', 'Activated', 'Notes']) {
    if (!groups[g]) continue;
    html += `<div style="font-size:11px;color:var(--g70);line-height:1.5;"><b style="color:var(--tv75);font-size:10px;">${g.toUpperCase()}:</b> ${groups[g].map(e => `${escapeHTML(e.text)} <span style="opacity:var(--o50);color:var(--dim);">(${escapeHTML(e.from)})</span>`).join(' · ')}</div>`;
  }
  html += `</div>`;
  host.innerHTML = html;
}

async function addMutationFromBrowse(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const mut = _muBrowseList[idx]; if (!mut) return;
  if (!c.mutations) c.mutations = [];
  const finish = async (attr) => {
    const dupe = c.mutations.some(m => m.name === mut.name && (m.attr || null) === (attr || null));
    if (dupe && !mut.multi) { toast(`${mut.name} is already taken${attr ? ' on ' + attr : ''}.`); return; }
    if (dupe && mut.kind === 'attribute') { toast(`${mut.name} is already taken on ${attr}.`); return; }
    const problems = mutationPrereqProblems(c, mut, attr);
    if (problems.length) {
      if (!(await confirmModal(`"${mut.name}"${attr ? ' (' + attr + ')' : ''}: ${problems.join('; ')}.\n\nTake anyway as a GM-approved exception?`))) return;
      logPowerException(c, mut.name + (attr ? ` (${attr})` : ''), problems.join('; '));
    }
    if (mut.kind !== 'drawback') {
      const st = getMPState(c);
      if ((mut.mp || 0) > st.balance) {
        if (!(await confirmModal(`"${mut.name}" costs ${mut.mp} MP but only ${st.balance} MP is banked.\n\nTake anyway as a GM-approved exception?`))) return;
        logPowerException(c, mut.name, `taken at ${mut.mp} MP with only ${st.balance} banked`);
      }
    }
    const rec = { name: mut.name, kind: mut.kind, mp: mut.mp, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } };
    if (attr) rec.attr = attr;
    // v8.8.0 (Adam's Resistances design): Energy Absorption / Diffusion pick
    // their energy type(s) at acquisition (per the entries) — feeding the
    // Sheet's Resistances panel.
    if (mut.name === 'Energy Absorption' || mut.name === 'Energy Diffusion') {
      const hi = mut.name === 'Energy Absorption' ? [20, 10] : [10, 5];
      const mode = await new Promise(res => openChoiceModal(`${mut.name} — coverage? (chosen at acquisition)`,
        [`${hi[0]} resistance to ONE energy type`, `${hi[1]} resistance to TWO energy types`], res));
      if (!mode) return;
      const one = mode.includes('ONE');
      const types = [];
      const TYPES = ['Acid', 'Cold', 'Electricity', 'Fire', 'Sonic'];
      for (let k = 0; k < (one ? 1 : 2); k++) {
        const pick = await new Promise(res => openChoiceModal(`${mut.name} — energy type ${one ? '' : (k + 1) + ' of 2'}`, TYPES.filter(t => !types.includes(t.toLowerCase())), res));
        if (!pick) return;
        types.push(pick.toLowerCase());
      }
      rec.energyTypes = types;
      rec.resistEach = one ? hi[0] : hi[1];
    }
    c.mutations.push(rec);
    refreshEclXp(c); // v8.5.4: drawback MP can cross an ML threshold (v8.12.4: also re-stamp c.ecl/xpNext — reconcile alone left the sheet's ECL stale)
    reconcileGrantedFeats(c);  // v8.8.0: mutation-granted feats (Blind-Fight, UIS)
    const attrBaked = reconcileAttributeMutations(c); // v8.6.0: bake the +4 in
    // v8.6.0: Ability Decay bakes its −2 the same way (reversal on remove is
    // generic over rec.attrApplied).
    if (mut.name === 'Ability Decay' && attr && !rec.attrApplied) {
      c.attrs[ATTR_KEY_IDX[attr]] -= 2; rec.attrApplied = -2;
    }
    save(); renderMutations();
    toast(`${mut.kind === 'drawback' ? 'Took drawback' : 'Gained'} ${mut.name}${attr ? ' (' + attr + ')' : ''} (${mut.kind === 'drawback' ? '+' : '−'}${mut.mp} MP)${attrBaked ? ` — +4 ${attr} applied (now ${c.attrs[ATTR_KEY_IDX[attr]]})` : (rec.attrApplied === -2 ? ` — −2 ${attr} applied (now ${c.attrs[ATTR_KEY_IDX[attr]]})` : '')}.`);
  };
  if (mut.kind === 'attribute') {
    openChoiceModal(`${mut.name} — which attribute?`, Object.keys(ATTR_FULL).map(k => `${k} — ${ATTR_FULL[k]}`), (sel) => finish(sel.slice(0, 3)));
    return;
  }
  // v8.6.0: Ability Decay bakes its −2 like the attribute family (the book
  // constrains the pick to your LOWEST eligible ability — the picker sorts
  // lowest-first and marks the lowest; GM adjudicates the fine print).
  if (mut.name === 'Ability Decay') {
    const order = Object.keys(ATTR_FULL).map(k => ({ k, v: (c.attrs || [10,10,10,10,10,10])[ATTR_KEY_IDX[k]] })).sort((a, b) => a.v - b.v);
    openChoiceModal('Ability Decay — which ability decreases by 2? (must be your lowest eligible)',
      order.map((o, i) => `${o.k} ${o.v}${i === 0 ? ' — lowest' : ''}`), (sel) => finish(sel.slice(0, 3)));
    return;
  }
  finish(null);
}

async function removeMutationAt(idx) {
  const c = chars.find(x => x.id === curId); if (!c || !c.mutations) return;
  const m = c.mutations[idx]; if (!m) return;
  let warn = `Remove ${m.name}${m.attr ? ' (' + m.attr + ')' : ''}?`;
  if (m.kind === 'drawback') {
    const st = getMPState(c);
    if (st.balance - (m.mp || 0) < 0) warn += `\n\nWarning: removing this drawback drops the MP balance to ${st.balance - m.mp} — spent MP will exceed earned (GM should adjudicate).`;
  }
  if (!(await confirmModal(warn))) return;
  // v8.6.0: reverse a baked attribute delta before dropping the record —
  // generic over attrApplied (covers the +4 family AND Ability Decay's −2).
  if (m.attrApplied && ATTR_KEY_IDX[m.attr] !== undefined && Array.isArray(c.attrs)) {
    c.attrs[ATTR_KEY_IDX[m.attr]] -= m.attrApplied;
  }
  c.mutations.splice(idx, 1);
  reconcileGrantedFeats(c);  // v8.8.0: mutation-granted feats leave with the mutation
  reconcileAttributeMutations(c);  // v8.6.0: reverses NAC-HP bake via the delta
  save(); renderMutations();
  toast(`Removed ${m.name}${m.attrApplied ? ` (−${m.attrApplied} ${m.attr})` : ''}.`);
}

function addMPGrantClick() {
  openChoiceModal('GM Grant — enter MP amount and reason (e.g. "3 radiation exposure at the Akron Wastes")', [], (val) => {
    const c = chars.find(x => x.id === curId); if (!c) return;
    const m = val.match(/^(-?\d+)\s*(.*)$/);
    if (!m) { toast('Enter a number first, e.g. "3 reason".'); return; }
    if (!c.mpGrants) c.mpGrants = [];
    c.mpGrants.push({ amount: Number(m[1]), reason: m[2] || 'GM grant', atDate: new Date().toLocaleDateString() });
    refreshEclXp(c); // v8.5.4: GM-granted MP can cross an ML threshold (v8.12.4: also re-stamp c.ecl/xpNext)
    save(); renderMutations();
    toast(`GM grant recorded: ${m[1]} MP.`);
  });
}

function setSuperMutantTier(key) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.superMutantTier = key;
  delete c.superPPCurrent; // pool max changed — refill to new max
  refreshEclXp(c); // v8.12.4: reconcile + re-stamp c.ecl/xpNext
  save(); renderMutations(); renderPowers();
}

function toggleMuDetail(name) {
  _muExpanded.has(name) ? _muExpanded.delete(name) : _muExpanded.add(name);
  renderMutationsBrowse();
}

function renderMutations() {
  const prompt = document.getElementById('mu-prompt'), cont = document.getElementById('mu-content');
  if (!curId) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  const c = chars.find(x => x.id === curId); if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  document.getElementById('mu-hero-nm').textContent = c.name + ' — Mutations';

  // v8.6.0: migrate any attribute mutations that predate the mechanical
  // wiring (idempotent — flagged records are skipped).
  if (reconcileAttributeMutations(c)) { save(); toast('Mutation effects synced (ability scores / natural-AC hit points).'); }
  // v8.67.0 (Mutant sync): the subtype bakes track MP/tier changes live.
  if (reconcileMutantSubtype(c)) save();

  const st = getMPState(c);
  const pp = getSuperPPState(c);
  // v8.80.0 (Adam's unification ruling): the selector now chooses the
  // STARTING PACKAGE only (HH p.249, GM permission, Scale-capped); the
  // CLASSIFICATION is derived from the Mutant level and shown as a chip —
  // crossing a 10-MP threshold promotes it automatically.
  const tierSel = st.isSuperMutant
    ? ` · <span title="HH p.423: the classification IS the Mutant racial level modifier — Minor ML 0 · Moderate +1 · Major +2 · Mega +3+ — across every MP route. It tracks your total MP (+1 per full 10) and sets the super-power shopping window (Minor: lvl 1-3, ≤6 MP/power, half PP · Moderate: 1-5, ≤10 · Major: 1-9, ≤20 · Mega: 1-9, uncapped). The Mutation Scale caps the total (GMG pp.64-66)." style="cursor:help;color:var(--vio);"><b>${st.tier.tier}</b> Super-Mutant</span>`
      + ` · package <select onchange="setSuperMutantTier(this.value)" style="font-size:10px;" title="The starting MP package chosen when Supernatural Mutation was taken (HH p.249: 'choose a mutation level with your GM's permission'; the Mutation Scale caps it). Your classification then tracks total MP — this picker only sets the grant.">${MUTATION_RULES.super_mutant_tiers.map(t => `<option value="${t.tier.toLowerCase()}" ${st.pkgKey === t.tier.toLowerCase() ? 'selected' : ''}>${t.tier} (${t.mp_grant} MP)</option>`).join('')}</select>`
    : '';
  const ppBit = st.isSuperMutant
    ? ` · <b style="color:var(--tv90);">${pp.current}/${pp.max} super-PP</b> (<span title="Effective Super Level — the HH prints this as ‘Effective Manifester Level (EML)’, p.423: character level + Mutant racial level modifier. Super-powers manifest at this level; super-PP/day = MP + ESL² + ceil(Wis mod × ESL / 2)." style="cursor:help;">ESL ${st.eml}</span>) <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;" onclick="restSuperPPClick()">Rest</button>`
    : '';
  document.getElementById('mu-ledger').innerHTML =
    `<span title="${escapeHTML(st.sources.join('\n') || 'no MP sources yet')}" style="cursor:help;">earned <b>${st.totalEarned}</b></span> · spent <b>${st.totalSpent}</b> · banked <b style="color:${st.balance < 0 ? 'var(--red-text)' : 'var(--gold)'};">${st.balance}</b> MP`
    + ` · Mutant level <b>+${st.mutantLevel}</b>${st.mutantLevel ? ' (+' + st.mutantLevel + ' ECL)' : ''}${tierSel}${ppBit}`
    + ` <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;" onclick="addMPGrantClick()">+ GM Grant</button>`
    // v8.67.0 (Mutant sync): the subtype's racial ability block — baked live.
    + (st.mutantLevel > 0 ? `<div style="margin-top:4px;font-size:10.5px;color:var(--tv85);" title="HH p.29 — the Mutant subtype's racial abilities, all EXTRAORDINARY (fundamental physiology: a Null Power Field does not suppress them). Baked live from your Mutant level: Base Attack and Defense reach the cards, rows, Grapple and iteratives; HP adjusts max; saves ride the drilldowns; the skill points join the Skills-tab budget (Tech Scale 0 skills only — table-enforced).">🧬 <b>Mutant subtype (Ex):</b> Unnatural Prowess +${Math.floor(st.mutantLevel / 2)} Base Attack · +${Math.floor(st.mutantLevel / 3)} Defense · +${2 * st.mutantLevel} skill pts (Tech-0) — Unnatural Resilience +${st.mutantLevel * (5 + am(((c.attrs) || [10,10,10,10,10,10])[2]))} HP · +${Math.floor(st.mutantLevel / 2)} all saves — wired, baked live ⓘ</div>` : '');

  const owned = getCharMutations(c);
  const gmGrantRows = ((c.mpGrants) || []).map((g, gi) =>
    `<div style="padding:4px 9px;border-bottom:1px solid rgba(200,151,30,.08);font-size:11px;opacity:.75;">GM grant: <b>${g.amount > 0 ? '+' : ''}${g.amount} MP</b> — ${escapeHTML(g.reason)} <span style="opacity:var(--o50);color:var(--dim);">(${g.atDate})</span></div>`).join('');
  document.getElementById('mu-known-list').innerHTML = (owned.length || gmGrantRows)
    ? owned.map((m, i) => {
        const def = MUTATIONS_DB.find(x => x.name === m.name);
        const sign = m.kind === 'drawback' ? '+' : '−';
        const kindTag = m.kind === 'drawback' ? 'drawback' : (m.kind === 'attribute' ? 'attribute' : (def && def.category) || 'advantage');
        const obv = def && def.obvious ? ` <span style="font-size:10px;color:#d4b870;cursor:help;" title="Obvious mutation — cumulative -2 Disguise to conceal">👁</span>` : '';
        return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div><b>${escapeHTML(m.name)}</b>${m.attr ? ` <span style="color:var(--gold);">(${m.attr})</span>` : ''} <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">${kindTag} · ${sign}${m.mp} MP</span>${obv}</div>
          <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeMutationAt(${i})">✕</button>
        </div>`;
      }).join('') + gmGrantRows
    : `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">No mutations yet — take Drawbacks below to earn MP, then spend it on Advantages.</div>`;

  renderMutationEffects(c);  // v8.6.0: live mechanical-effects panel
  renderMutationsBrowse();
}

function renderSuAttrPanel(c) {
  const el = document.getElementById('pw-su-attrs'); if (!el) return;
  const st = getMPState(c);
  if (!st || !st.isSuperMutant || _pwMode !== 'powers') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  const cum = [2, 5, 9, 14, 20];
  // v8.82.0 refinement (Adam): collapsed one-liner whose summary totals the
  // boosted stats ("Dex +12, Cha +4") — the Ex/Su split is expanded-view
  // fluff. The open state survives re-renders via _suAttrsOpen.
  const sumBits = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(a => {
    const n = SU_ATTR_LADDER.filter(nm => (c.mutations || []).some(m => m.name === nm && m.attr === a)).length;
    return n ? `${a.charAt(0) + a.slice(1).toLowerCase()} +${n * 4}` : null;
  }).filter(Boolean).join(', ');
  const rows = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(a => {
    const owned = SU_ATTR_LADDER.filter(nm => (c.mutations || []).some(m => m.name === nm && m.attr === a)).length;
    const bonus = owned * 4;
    const next = owned < 5 ? SU_ATTR_LADDER[owned] : null;
    const nextMp = next ? (MUTATIONS_DB.find(m => m.name === next) || {}).mp : null;
    const state = owned === 0 ? `<span style="opacity:.45;">—</span>`
      : `<b style="color:${owned > 1 ? '#c499d4' : 'var(--gold)'};">+${bonus}</b> <span style="font-size:9px;opacity:var(--o60);color:var(--dim);">(Ex +4${owned > 1 ? ` · Su +${(owned - 1) * 4}` : ''})</span>`;
    const btn = next
      ? `<button class="btn btn-sm" style="font-size:9px;padding:1px 6px;${owned === 0 ? '' : 'border-color:rgba(196,153,212,.5);color:var(--vio);'}" title="${owned === 0
          ? `Extraordinary [${a}] — +4 EXTRAORDINARY bonus (never suppressed; an Advantage: the record lands on the 🧬 Mutations tab and bakes into the Sheet). 2 MP.`
          : `${next} (${a}) — a further +4 SUPERNATURAL bonus (total +${bonus + 4}; suppressed by a Null Power Field). Step cost ${nextMp} MP — cumulative investment ${cum[owned]} MP (HH p.424). Requires the previous tier on the same attribute.`}" onclick="buySuAttrStep('${a}')">${owned === 0 ? `+ Ex [${a}] · 2 MP` : `◈ ${next.replace('Supernatural [Attribute] ', 'Su ')} · ${nextMp} MP`}</button>`
      : `<span style="font-size:9px;color:var(--vio);">+20 — ladder complete</span>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;border-bottom:1px solid rgba(200,151,30,.06);font-size:11.5px;"><span style="width:34px;font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);">${a}</span><span style="width:120px;">${state}</span>${btn}</div>`;
  }).join('');
  if (typeof window._suAttrsOpen === 'undefined') window._suAttrsOpen = false;
  el.innerHTML = `<details class="hy-det"${window._suAttrsOpen ? ' open' : ''} ontoggle="window._suAttrsOpen=this.open"><summary><span style="color:var(--vio);font-weight:bold;">✨ Extraordinary / Supernatural Attributes</span> <span class="cite cite-HH" title="Hero's Handbook pp.420-421 (the Extraordinary/Supernatural [Attribute] ladder) + p.669 (Supernatural [Attribute] I-IV as super-powers; the Extraordinary base is never suppressed, the Su tiers are)">HH 420</span>${sumBits ? ` <span style="color:rgba(200,200,160,.9);">— ${sumBits}</span>` : ' <span style="opacity:var(--o50);color:var(--dim);">— none yet</span>'}</summary><div style="padding:4px 0 2px 14px;">
    <div style="font-size:10px;color:var(--g55);margin-bottom:4px;">Purchases record as mutations — they appear on the 🧬 Mutations tab and bake into the Sheet. The Ex base (+4) is never suppressed; the Su tiers (+4 each, to +20 total) fall to a Null Power Field. Banked: <b style="color:var(--gold);">${st.balance} MP</b>.</div>${rows}
  </div></details>`;
}
// v8.83.0 (Adam's Rhad playtest): 🎭 SUPER-TALENTS on the Powers side — the
// Supernatural Attributes' once-stranded siblings. Populates only with the
// character's own hero classes' Super/Apex talents (Ch.XI: they require
// Supernatural Mutation, like super-powers); a ⚿ GM toggle (tucked in the
// footer) reveals every class's. Purchases route through the Talents tab's
// own addTalentFromBrowser — slot bypass, MP overdraft exceptions, HP/attr
// bakes, the single talent ledger: all unchanged consumers.
function renderSuperTalentPanel(c) {
  const el = document.getElementById('pw-su-talents'); if (!el) return;
  const st = getMPState(c);
  if (!st || !st.isSuperMutant || _pwMode !== 'powers') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  if (typeof window._suTalOpen === 'undefined') window._suTalOpen = false;
  const gmAll = !!window._suTalGmAll;
  const heroClasses = new Set(migrateLegacyClasses(c).filter(e => e.tier === 'hero' && (e.level || 0) > 0).map(e => e.name));
  const all = TALENTS_DB.filter(t => /Super-Talent/.test(t.tier || ''));
  const mine = all.filter(t => heroClasses.has(t.hero_class));
  const shown = gmAll ? all : mine;
  const ownedNames = (c.talents || []).filter(te => all.some(t => t.n === (te.name || te.n))).map(te => te.name || te.n);
  const byClass = {};
  for (const t of shown) { (byClass[t.hero_class] = byClass[t.hero_class] || []).push(t); }
  let body = '';
  for (const hc of Object.keys(byClass).sort()) {
    body += `<div style="font-size:10px;color:var(--g55);text-transform:uppercase;letter-spacing:.07em;margin-top:4px;">${escapeHTML(hc)}${heroClasses.has(hc) ? '' : ' <span style="color:var(--vio);">(⚿ off-class — GM territory)</span>'}</div>`;
    for (const t of byClass[hc]) {
      const owned = ownedNames.includes(t.n);
      const pr = checkTalentPrereqs(t.n, c);
      const apex = t.is_apex ? ` <span style="font-size:8px;color:var(--vio);border:1px solid rgba(196,153,212,.4);padding:0 4px;border-radius:2px;">APEX</span>` : '';
      const offClass = !heroClasses.has(hc);
      const buy = owned
        ? `<span style="font-size:10px;color:#6dba88;">✓ owned</span>`
        : (pr.met && !offClass)
          ? `<button class="btn btn-sm" style="font-size:9px;padding:1px 6px;border-color:rgba(196,153,212,.5);color:var(--vio);" onclick="buySuperTalent('${escapeHTML(t.n).replace(/'/g, "\\'")}')">◈ Buy ${t.mp_cost || 0} MP</button>`
          : `<button class="btn btn-sm" style="font-size:9px;padding:1px 6px;opacity:.65;" title="${escapeHTML((offClass ? 'Off-class acquisition — GM territory. ' : '') + (pr.met ? '' : 'Missing: ' + pr.missing.join('; ')))}" onclick="buySuperTalent('${escapeHTML(t.n).replace(/'/g, "\\'")}', true)">⚿ GM · ${t.mp_cost || 0} MP</button>`;
      body += `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;border-bottom:1px solid rgba(200,151,30,.06);font-size:11.5px;">
        <span style="flex:1;cursor:help;" title="${escapeHTML((t.d || '') + (t.prereqs_text ? ' — Prerequisites: ' + t.prereqs_text : ''))}"><b style="color:${owned ? '#6dba88' : 'var(--parch)'};">${escapeHTML(t.n)}</b>${apex} <span style="font-size:9px;opacity:var(--o55);color:var(--dim);">${escapeHTML(t.tree || '')}</span></span>${buy}</div>`;
    }
  }
  const ownedBits = ownedNames.length ? ownedNames.map(escapeHTML).join(', ') : null;
  el.innerHTML = `<details class="hy-det"${window._suTalOpen ? ' open' : ''} ontoggle="window._suTalOpen=this.open"><summary><span style="color:var(--vio);font-weight:bold;">🎭 Super-Talents</span> <span class="cite cite-HH" title="Hero's Handbook Ch.XI p.669 (the Hero Classes and Super-Talents table — like Super-Powers, Super-Talents require the Supernatural Mutation feat) + the talent trees, pp.63-71. MP is the whole price: no Talent selection is consumed (Adam's ruling, v8.21.1).">HH 669</span>${ownedBits ? ` <span style="color:rgba(200,200,160,.9);">— ${ownedBits}</span>` : ` <span style="opacity:var(--o50);color:var(--dim);">— none yet · ${mine.filter(t => !ownedNames.includes(t.n)).length} available to your classes</span>`}</summary><div style="padding:4px 0 2px 14px;">
    <div style="font-size:10px;color:var(--g55);margin-bottom:2px;">MP is the whole price — no Talent slot is consumed. Purchases record on the 🎭 Talents tab and bake into the Sheet. Banked: <b style="color:var(--gold);">${st.balance} MP</b>.</div>${body}
    <div style="margin-top:4px;"><span style="font-size:9px;opacity:.5;cursor:pointer;" onclick="window._suTalGmAll=!window._suTalGmAll;renderSuperTalentPanel(chars.find(x=>x.id===curId))">⚿ ${gmAll ? 'hide' : 'show'} other classes' Super-Talents (GM)</span></div>
  </div></details>`;
}
async function buySuperTalent(name, gmException) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (gmException) {
    const pr = checkTalentPrereqs(name, c);
    const heroClasses = new Set(migrateLegacyClasses(c).filter(e => e.tier === 'hero' && (e.level || 0) > 0).map(e => e.name));
    const t = TALENTS_DB.find(x => x.n === name);
    const bits = [];
    if (t && !heroClasses.has(t.hero_class)) bits.push(`${t.hero_class} talent on a non-${t.hero_class}`);
    if (!pr.met) bits.push(pr.missing.join('; '));
    if (!(await confirmModal(`"${name}" — ${bits.join(' · ') || 'GM override'}.\n\nAcquire as a GM-approved exception?`))) return;
    logPowerException(c, name, bits.join('; ') || 'GM override (Super-Talent panel)');
  }
  await addTalentFromBrowser(name);
  renderPowers(); renderSheet();
}
async function buySuAttrStep(attrKey) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.mutations) c.mutations = [];
  const owned = SU_ATTR_LADDER.filter(nm => c.mutations.some(m => m.name === nm && m.attr === attrKey)).length;
  if (owned >= 5) return;
  const mut = MUTATIONS_DB.find(m => m.name === SU_ATTR_LADDER[owned]); if (!mut) return;
  const problems = mutationPrereqProblems(c, mut, attrKey);
  if (problems.length) {
    if (!(await confirmModal(`"${mut.name}" (${attrKey}): ${problems.join('; ')}.\n\nTake anyway as a GM-approved exception?`))) return;
    logPowerException(c, `${mut.name} (${attrKey})`, problems.join('; '));
  }
  const st = getMPState(c);
  if ((mut.mp || 0) > st.balance) {
    if (!(await confirmModal(`"${mut.name}" costs ${mut.mp} MP but only ${st.balance} MP is banked.\n\nTake anyway as a GM-approved exception?`))) return;
    logPowerException(c, mut.name, `taken at ${mut.mp} MP with only ${st.balance} banked`);
  }
  c.mutations.push({ name: mut.name, kind: mut.kind, mp: mut.mp, attr: attrKey, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } });
  refreshEclXp(c);
  reconcileGrantedFeats(c);
  const baked = reconcileAttributeMutations(c);
  save(); renderPowers(); renderMutations(); renderSheet();
  toast(`Gained ${mut.name} (${attrKey}) — −${mut.mp} MP${baked ? `, +4 ${attrKey} applied (now ${c.attrs[ATTR_KEY_IDX[attrKey]]})` : ''}. Recorded on the 🧬 Mutations tab.`);
}
function renderMutationsBrowse() {
  if (!_muBrowseOpen) return;  // collapsed — skip the 65-entry render (v8.6.0)
  const c = chars.find(x => x.id === curId); if (!c) return;
  const el = document.getElementById('mu-browse-list'); if (!el) return;
  const q = (document.getElementById('mu-search').value || '').toLowerCase();
  const kindF = document.getElementById('mu-kind-filter').value;
  _muBrowseList = MUTATIONS_DB.filter(m => {
    if (kindF && m.kind !== kindF) return false;
    if (q && !(m.name.toLowerCase().includes(q) || (m.benefit || m.drawback || '').toLowerCase().includes(q))) return false;
    return true;
  });
  el.innerHTML = _muBrowseList.map((m, i) => {
    const open = _muExpanded.has(m.name);
    const sign = m.kind === 'drawback' ? '+' : '−';
    const tags = [
      m.kind === 'drawback' ? 'drawback' : (m.kind === 'attribute' ? 'attribute' : m.category),
      m.obvious ? 'obvious' : null, m.multi ? 'multi' : null, m.techMin ? 'tech-gated' : null,
    ].filter(Boolean).map(t => `<span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);margin-left:4px;">${t}</span>`).join('');
    return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="cursor:pointer;flex:1;" onclick="toggleMuDetail('${escapeHTML(m.name).replace(/'/g, "\\'")}')"><b>${escapeHTML(m.name)}</b> <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">${sign}${m.mp} MP</span>${tags} <span style="font-size:10px;opacity:var(--o40);color:var(--dim);">${open ? '▾' : '▸'}</span></div>
        ${/^Supernatural \[Attribute\]/.test(m.name)
          ? `<span style="font-size:9px;color:var(--vio);border:1px dashed rgba(196,153,212,.35);padding:2px 6px;border-radius:2px;white-space:nowrap;cursor:help;" title="v8.82.0 (Adam's taxonomy ruling): the Supernatural [Attribute] ladder is SUPERNATURAL — it shops in the ✨ Supernatural Attributes panel on the ◈ Powers tab (its records still live here and on the Sheet).">↗ ✨ Powers tab</span>`
          : `<button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="addMutationFromBrowse(${i})">+ ${m.kind === 'drawback' ? 'Take' : 'Add'}</button>`}
      </div>
      ${open ? `<div style="font-size:11.5px;margin-top:5px;line-height:1.55;color:var(--parch);">${m.flavor ? '<i>' + escapeHTML(m.flavor) + '</i><br>' : ''}${escapeHTML(m.benefit || m.drawback || '')}${m.special ? '<br><b>Special:</b> ' + escapeHTML(m.special) : ''}${m.prerequisite ? '<br><b>Prerequisite:</b> ' + escapeHTML(m.prerequisite) : ''}</div>` : ''}
    </div>`;
  }).join('') || `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">Nothing matches the filters.</div>`;
}
