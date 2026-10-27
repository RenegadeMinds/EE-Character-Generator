// =============================================================================
// js/app/56-supernatural-attributes-pools-psi-focus.js
// SUPERNATURAL ATTRIBUTES POOLS PSI FOCUS
// =============================================================================
//
// WHAT'S IN HERE
//   Supernatural attributes, super talents, the Mutations page browser,
//   blended power-point pools, metamagic preparation, and psionic focus.
//
// KEY NAMES (so you can search for them)
//   tables/objects: SU_ATTR_LADDER, CURE_TIER_NAMES, ROMAN_TIERS,
//   META_PREP_PREFIX
//   functions (41): renderSuAttrPanel, renderSuperTalentPanel, buySuperTalent,
//   buySuAttrStep, renderMutationsBrowse, blendedPoolSetFor, _poolPPRaw,
//   getPoolPPState, _drainPoolLedgers, spendPoolPP, powerCastCost,
//   castCostFor, nonPreppedPoolsInfo, _isInstantSpell, _isSwiftCast,
//   instantGateOK, tierDisplayName, schoolDcBonus, prepContributorsOf,
//   prepTokensForCtr, getPreparedList, isSpecialtySpell, prepEligibleFor,
//   specialistFreeUsed, prepPickAndAdd, memorizeKnownAt, ordinalOf,
//   prepDecoratedName, prepAugFx, doPrepare, unprepareAt, finishPrepCast,
//   castPreparedAt, convertPreparedAt, isPsiFocusCapable, psiFocusLocked,
//   gainPsiFocus, expendPsiFocus, psiFocusChipHTML, fullyRested, ... and 1
//   more
//
// LOAD ORDER
//   File 56 of 68. index.html loads it after js/app/55-mutations-engine.js and
//   before js/app/57-armor-and-vehicle-integrity.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 47260-48146 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 47260-48146; unchanged below this line ----
// ============================================================================
// v8.82.0 (Adam's taxonomy tweak): ✨ SUPERNATURAL ATTRIBUTES — the ladder
// shops on the Powers side (supernatural = NPF-nullified = super in nature),
// while the records remain MUTATIONS (single source of truth: the 🧬 tab,
// the Sheet bakes, suBakedPerAttr's NPF suppression all read them as ever).
// Pricing note (the §218 sources interlock): the chapter prices each STEP
// (Ex 2 / Su I 3 / II 4 / III 5 / IV 6) and the p.424 list prints the
// CUMULATIVE investment (2/5/9/14/20) — they agree exactly.
const SU_ATTR_LADDER = ['Extraordinary [Attribute]', 'Supernatural [Attribute] I', 'Supernatural [Attribute] II', 'Supernatural [Attribute] III', 'Supernatural [Attribute] IV'];
function renderSuAttrPanel(c) {
  const el = document.getElementById('pw-su-attrs'); if (!el) return;
  const st = (typeof getMPState === 'function') ? getMPState(c) : null;
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
  const st = (typeof getMPState === 'function') ? getMPState(c) : null;
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
  save(); renderPowers(); if (typeof renderMutations === 'function') renderMutations(); renderSheet();
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

// ----- casting (v8.5.2 Phase D) -----
// PP lives per contributor: c.ppCurrent[pool]['Class:level'], undefined =
// full budget (see adjustPP). Casting drains across contributors in order.
// v8.31.1 (Adam's Blended Technique redirect, 2026-09-23): which pools are
// UNITED for spending with the given one. Any level in a blendsPools class
// (the Theurges — Blended Technique is their 1st-level feature) merges its
// two advanced pools; a double-Theurge chains the merges (arcane+divine and
// arcane+psionic unite all three through the shared arcane). Returns the
// merged pool-name set containing poolName, or null when unblended.
function blendedPoolSetFor(c, poolName) {
  const sets = [];
  for (const e of migrateLegacyClasses(c || {})) {
    const meta = CASTER_CLASSES[e.name];
    if (!meta || !meta.blendsPools || meta.tier !== e.tier || (e.level || 0) <= 0) continue;
    sets.push(Array.isArray(meta.advances) ? meta.advances.slice() : [meta.advances]);
  }
  if (!sets.length) return null;
  const merged = [];
  for (const s of sets) {
    const hit = merged.find(m => s.some(p => m.includes(p)));
    if (hit) { for (const p of s) if (!hit.includes(p)) hit.push(p); }
    else merged.push(s.slice());
  }
  for (let i = merged.length - 1; i > 0; i--) {
    const hit = merged.slice(0, i).find(m => merged[i].some(p => m.includes(p)));
    if (hit) { for (const p of merged[i]) if (!hit.includes(p)) hit.push(p); merged.splice(i, 1); }
  }
  const set = merged.find(m => m.includes(poolName));
  return (set && set.length > 1) ? set : null;
}

// One pool's OWN ledger state (pre-blend view).
function _poolPPRaw(c, poolName) {
  const pool = computeCasterStats(c)[poolName];
  if (!pool) return { current: 0, max: 0, permanentSpent: 0 };
  let current = 0, max = 0;
  for (const ctr of pool.contributors) {
    // v8.5.4 EAL pass FIX: Heritage's +2 PP and the Spellslinger / Power
    // Reservoir character-level PP are real castable points — previously
    // Heritage rows were skipped here (while the sheet's budget sum included
    // them), so the tracker and the sheet disagreed for Heritage owners.
    // Only advancers (0 PP by definition) stay excluded.
    if (ctr._isAdvancer) continue;
    const key = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    max += budget;
    current += (c.ppCurrent && c.ppCurrent[poolName] && c.ppCurrent[poolName][key]) ?? budget;
  }
  // v8.11.1 Segment B: High Arcana / Mental Mastery permanent expenditures
  // shrink the pool for good (live from the picks — clearing a pick via the
  // GM ✕ refunds it).
  const perm = (typeof permanentPPSpent === 'function') ? permanentPPSpent(c, poolName) : 0;
  if (perm) { max = Math.max(0, max - perm); current = Math.min(current, max); }
  return { current, max, permanentSpent: perm };
}

// v8.31.1: the pool state every consumer sees. Blended Technique unites the
// linked pools' totals — affordability checks, chips, sheet, and print all
// inherit the union automatically. `blended` carries the set; own* keep the
// pre-blend numbers for detail displays.
function getPoolPPState(c, poolName) {
  const raw = _poolPPRaw(c, poolName);
  const blend = blendedPoolSetFor(c, poolName);
  if (!blend) return raw;
  let current = 0, max = 0, perm = 0;
  for (const pn of blend) {
    const r = _poolPPRaw(c, pn);
    current += r.current; max += r.max; perm += r.permanentSpent || 0;
  }
  return { current, max, permanentSpent: perm, blended: blend.slice(), ownCurrent: raw.current, ownMax: raw.max };
}

// Drain one pool's contributor ledgers by up to `amount`; returns taken.
function _drainPoolLedgers(c, poolName, amount) {
  const pool = computeCasterStats(c)[poolName];
  if (!pool) return 0;
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  let remaining = amount;
  for (const ctr of pool.contributors) {
    if (remaining <= 0) break;
    if (ctr._isAdvancer) continue;  // heritage/feat PP is castable (v8.5.4)
    const key = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    const cur = c.ppCurrent[poolName][key] ?? budget;
    const take = Math.min(cur, remaining);
    c.ppCurrent[poolName][key] = cur - take;
    remaining -= take;
  }
  return amount - remaining;
}

function spendPoolPP(c, poolName, amount) {
  let spent = _drainPoolLedgers(c, poolName, amount);
  // v8.31.1 Blended Technique: the united pool pays for either art — the
  // named pool drains first, then the linked pools cover the overflow.
  if (spent < amount) {
    const blend = blendedPoolSetFor(c, poolName);
    if (blend) {
      for (const pn of blend) {
        if (pn === poolName || spent >= amount) continue;
        spent += _drainPoolLedgers(c, pn, amount - spent);
      }
    }
  }
  return spent; // actually spent
}

// PP cost: the entry's printed Power Points when cleanly numeric, else the
// HH p.404 by-level formula. Level = the known-pool's (lowest) route.
// clsName (optional): the casting class, for the half-caster capstone break —
// "the 20th level Ranger, as a 10th level spellcaster, casts 6th-level Druid
// spells for 10 power points" (the Paladin entry carries the same sentence):
// 10 PP instead of the standard 11 when a lesser caster casts at 6th.
function powerCastCost(spell, lvl, clsName) {
  const printed = parseInt(spell.power_points, 10);
  if (Number.isFinite(printed) && String(printed) === String(spell.power_points).trim()) return printed;
  if (lvl === 6 && clsName && (CASTER_CLASSES[clsName] || {}).mode === 'lesser') return 10;
  return PP_COST_BY_POWER_LEVEL[Math.max(0, Math.min(9, lvl))] ?? 1;
}

// Spontaneous-cast cost for a pool: the capstone 10-PP break applies only
// when EVERY PP-contributing class in the pool is a lesser caster (a pure
// Paladin's divine pool) — in a mixed pool the 6th-level slot is reachable
// via a full caster, so the standard cost stands.
function castCostFor(c, spell, poolName, lvl) {
  let cls6 = null;
  if (lvl === 6) {
    const ctrs = ((computeCasterStats(c)[poolName] || {}).contributors || [])
      .filter(x => !x._isAdvancer && !x._fromHeritage);
    if (ctrs.length && ctrs.every(x => (CASTER_CLASSES[x.class] || {}).mode === 'lesser')) cls6 = ctrs[0].class;
  }
  return powerCastCost(spell, lvl, cls6);
}

// ----- v8.57.0: prepared-vs-spontaneous routing (Adam's playtest item #4) -----
// The character MINUS every prepared-casting source: classes with prep:true
// (Wizard, Cleric incl. the Druid Option, Ranger) and Heritage feats whose
// chosen class preps. What survives is exactly the spontaneous casting
// surface — used to decide whether a Known entry still has a pay-at-cast
// route or is prepared-only (its row button memorizes instead of casting).
function nonPreppedPoolsInfo(c) {
  const isPrepClass = (n) => !!(CASTER_PROGRESSION[n] || {}).prep;
  const clone = Object.assign({}, c, {
    // Block migrateLegacyClasses' legacy-field rebuild when the filter
    // empties the classes array (a pure Wizard must yield NO arcane pool).
    heroClass: null, basicClass: null, advClass: null, presClass: null,
    classes: migrateLegacyClasses(c || {}).filter(e => !isPrepClass(e.name)),
    feats: ((c && c.feats) || []).filter(f => {
      const nm = typeof f === 'string' ? f : (f.name || f.n);
      if (nm !== 'Arcane Heritage' && nm !== 'Divine Heritage' && nm !== 'Psionic Heritage') return true;
      const param = (typeof f !== 'string' && f.param) ? String(f.param).replace(' (Druid Option)', '') : null;
      return !(param && isPrepClass(param));
    })
  });
  return getCasterPoolsInfo(clone);
}

// v8.57.0 (Adam): instantaneous-resolution gate. An Instantaneous effect must
// be RESOLVED at the table before the next one fires — a successive
// instantaneous cast prompts "has the last one been resolved?" first.
// Swift/immediate casting times are exempt (they legitimately interleave
// with another action — and Quicken Spell/Power is earmarked to join them).
let _pendingInstant = null; // { charId, name }
function _isInstantSpell(s) { return /^\s*instantaneous/i.test(String((s && s.duration) || '')); }
function _isSwiftCast(s, pool) {
  let ct = String((s && s.casting_time) || '');
  // "(1 swift action as Super-Power)" parentheticals exempt only SUPER casts —
  // the standard-action base casting time still queues behind the gate.
  if (pool !== 'super') ct = ct.replace(/\([^)]*\)/g, '');
  return /(swift|immediate)/i.test(ct);
}
async function instantGateOK(c, spell, pool) {
  if (!_pendingInstant || !c || _pendingInstant.charId !== c.id) return true;
  if (!_isInstantSpell(spell) || _isSwiftCast(spell, pool)) return true;
  const ok = await confirmModal(`⏳ ${_pendingInstant.name} is instantaneous and still on the board.\n\nHas it been resolved? OK confirms resolution and casts ${spell.name}; Cancel holds this cast.`);
  if (ok) dismissCastResult();
  return ok;
}

// v8.57.0: consolidated family entries (Cure Wounds "Clr 0-8", Summon
// Nature's Ally "Drd 1-9") memorize at a SPECIFIC tier — name that tier.
const CURE_TIER_NAMES = ['Minor', 'Light', 'Moderate', 'Serious', 'Critical', 'Mass Light', 'Mass Moderate', 'Mass Serious', 'Mass Critical'];
const ROMAN_TIERS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
function tierDisplayName(spell, opt, k) {
  const base = displayNameForRoute(spell, opt);
  if ((opt.lvl_max ?? opt.lvl) <= opt.lvl) return base;
  const m = base.match(/^(Cure|Inflict)\b/);
  if (m && CURE_TIER_NAMES[k]) return `${m[1]} ${CURE_TIER_NAMES[k]} Wounds`;
  if (/^Summon Nature/.test(base)) return `Summon Nature’s Ally ${ROMAN_TIERS[k] || k}`;
  if (/^Summon Monster/.test(base)) return `Summon Monster ${ROMAN_TIERS[k] || k}`;
  return `${base} (lvl ${k})`;
}

// v8.5.4 EAL pass: school-keyed save-DC bonus — Spell Focus +1, Greater
// Spell Focus +1 more, per chosen school (feat params), matched against the
// spell's school_raw. Static and always-on, so it bakes into the displayed
// DC. (The psionic Power Endowment pair requires EXPENDING FOCUS, so it is
// surfaced as a cast-result hint instead of baked in.) Psionic disciplines
// aren't in the school param list, so psionic casts are naturally unaffected.
function schoolDcBonus(c, spell) {
  if (!c || !spell || !spell.school_raw) return 0;
  let b = 0;
  for (const f of (c.feats || [])) {
    const nm = f.name || f.n || f;
    if ((nm === 'Spell Focus' || nm === 'Greater Spell Focus') && f.param && spell.school_raw.startsWith(f.param)) b += 1;
  }
  return b;
}

// ----- prepared casting (v8.5.4 Layer 4) -----
// HH model: Wizards, Clerics (incl. the Druid Option), and Rangers spend
// their power points at dawn to memorize specific spells; casting a prepared
// instance costs no further PP. Spontaneous casters (Sorcerer, Bard, Saint,
// Paladin, psionics) keep the Phase D pay-at-cast flow. Data lives lazily at
// c.preparedSlots[pool][ctrKey] = [{name, dispName, lvl, cost, qty, cast,
// free}] — `free` marks specialist-Wizard specialty slots (one per spell
// level per day, 0 PP, HH). PP is drawn from and refunded to the same
// per-contributor c.ppCurrent ledger the +/− buttons and Rest use.
let _prepCtrs = [];

function prepContributorsOf(c) {
  const out = [];
  const stats = computeCasterStats(c);
  for (const poolName of ['arcane', 'divine', 'psionic']) {
    const pool = stats[poolName];
    if (!pool) continue;
    for (const ctr of pool.contributors) {
      // v8.30.0: _fromHeritage no longer excluded — Heritage access rows are
      // real 1st-level class contributors now (a Heritage-Wizard prepares like
      // a Wizard 1, from the feat's 2 PP). The heritage floor/PP-only rows
      // carry prep:false, so the !ctr.prep check already skips them.
      if (!ctr.prep || ctr._isAdvancer) continue;
      const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
      // Ranger 1-3 (and any pre-casting prep class level): nothing to prepare.
      if (budget <= 0 && (ctr.classMaxPowerLvl || 0) <= 0) continue;
      out.push({ poolName, ctr, ctrKey: (ctr.class || 'unknown') + ':' + (ctr.level || 0), budget });
    }
  }
  return out;
}

// Which list tokens this contributor prepares from (the class's own routes,
// not the whole pool — an arcane pool can hold a Wizard AND a Sorcerer).
function prepTokensForCtr(c, ctr) {
  if (ctr.class === 'Wizard') return ['Sor/Wiz'];
  if (ctr.class === 'Cleric') {
    // v8.30.0: a Divine Heritage 'Cleric (Druid Option)' pick prepares from
    // the Druid list — the class-level c.druidOption flag can't carry this
    // (no Cleric levels exist), so the contributor's own choice decides.
    if (ctr._heritageChoice === 'Cleric (Druid Option)') return ['Drd'];
    return c.druidOption ? ['Drd'] : ['Clr', ...(c.clericDomains || [])];
  }
  if (ctr.class === 'Ranger') return ['Drd'];
  return [];
}

function getPreparedList(c, poolName, ctrKey) {
  if (!c.preparedSlots) c.preparedSlots = {};
  if (!c.preparedSlots[poolName]) c.preparedSlots[poolName] = {};
  if (!c.preparedSlots[poolName][ctrKey]) c.preparedSlots[poolName][ctrKey] = [];
  return c.preparedSlots[poolName][ctrKey];
}

function isSpecialtySpell(c, s) {
  return !!(c.wizardSchool && s.school_raw && s.school_raw.startsWith(c.wizardSchool));
}

// Spells this contributor can prepare: pool matches, a route uses one of the
// class's own tokens, and the route level fits the class's max.
// v8.57.0 (Adam's playtest item #4): DIVINE preparation draws on the class's
// ENTIRE list (HH — a Cleric holds the whole list and memorizes from it at
// dawn); only the Wizard preps from a personal repertoire (spellbook = the
// Known list). Family entries with a level RANGE (Cure Wounds "Clr 0-8",
// Summon Nature's Ally "Drd 1-9") expand to one row per reachable tier.
function prepEligibleFor(c, pc) {
  const poolsInfo = getCasterPoolsInfo(c);
  const tokens = new Set(prepTokensForCtr(c, pc.ctr));
  const capLvl = pc.ctr.classMaxPowerLvl || 0;
  const seen = new Set();
  const out = [];
  const source = pc.poolName === 'divine'
    ? SPELLS_DB
    : getCharPowers(c).filter(p => p.pool === pc.poolName).map(p => SPELLS_DB.find(x => x.name === p.name)).filter(Boolean);
  for (const s of source) {
    if (!s || seen.has(s.name)) continue;
    const routes = spellPoolOptions(s, poolsInfo)
      .filter(o => o.pool === pc.poolName && tokens.has(o.token) && o.lvl <= capLvl);
    if (!routes.length) continue;
    const best = routes.reduce((a, b) => (a.lvl <= b.lvl ? a : b));
    seen.add(s.name);
    const hi = Math.min(best.lvl_max ?? best.lvl, capLvl);
    for (let k = best.lvl; k <= hi; k++) {
      out.push({ spell: s, lvl: k, cost: powerCastCost(s, k, pc.ctr.class), dispName: tierDisplayName(s, best, k) });
    }
  }
  out.sort((a, b) => a.lvl - b.lvl || a.dispName.localeCompare(b.dispName));
  return out;
}

// Free specialty slots already used today, keyed by spell level.
function specialistFreeUsed(c, pc) {
  const used = {};
  for (const r of getPreparedList(c, pc.poolName, pc.ctrKey)) {
    if (r.free) used[r.lvl] = (used[r.lvl] || 0) + (r.qty || 0);
  }
  return used;
}

async function prepPickAndAdd(pi) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const pc = _prepCtrs[pi]; if (!pc) return;
  const elig = prepEligibleFor(c, pc);
  if (!elig.length) { toast(pc.poolName === 'divine' ? "No list spell is reachable at this class's castable levels yet." : 'No known spells this class can prepare — add some from the catalogue below first.'); return; }
  const isSpec = pc.ctr.class === 'Wizard' && c.wizardSchool;
  const freeUsed = isSpec ? specialistFreeUsed(c, pc) : {};
  const offer = (list, title) => {
    const byLabel = new Map();
    for (const e of list) {
      byLabel.set(`Lvl ${e.lvl} — ${e.dispName} (${e.cost} PP)`, { e, free: false });
      if (isSpec && isSpecialtySpell(c, e.spell) && !(freeUsed[e.lvl] > 0)) {
        byLabel.set(`Lvl ${e.lvl} — ${e.dispName} (FREE — ${c.wizardSchool} specialty slot)`, { e, free: true });
      }
    }
    openChoiceModal(title, [...byLabel.keys()], async (sel) => {
      const pick = byLabel.get(sel); if (!pick) return;
      await doPrepare(c, pc, pick.e, pick.free);
    });
  };
  // v8.57.0: the divine whole-list pool is big — browse by spell level first.
  const lvls = [...new Set(elig.map(e => e.lvl))].sort((a, b) => a - b);
  if (pc.poolName === 'divine' && elig.length > 24 && lvls.length > 1) {
    openChoiceModal(`Prepare a spell — ${pc.ctr.class} ${pc.ctr.level}: choose the spell level`,
      lvls.map(L => `Level ${L} — ${elig.filter(e => e.lvl === L).length} spells`), (sel) => {
        const m = String(sel).match(/Level (\d)/); if (!m) return;
        const L = parseInt(m[1], 10);
        offer(elig.filter(e => e.lvl === L), `Prepare a level-${L} spell — ${pc.ctr.class} ${pc.ctr.level}`);
      });
    return;
  }
  offer(elig, `Prepare a spell — ${pc.ctr.class} ${pc.ctr.level}`);
}

// v8.57.0 (Adam's redirect): the Known-list route into memorization. A
// prepared caster's row button MEMORIZES instead of casting — "the PP are
// spent in the memorization, the memorized spell is spent in the casting."
// Multi-tier family entries ask which tier; multi-class preps ask which class.
function memorizeKnownAt(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const p = getCharPowers(c)[idx]; if (!p) return;
  const s = SPELLS_DB.find(x => x.name === p.name); if (!s) { toast('Catalogue entry not found.'); return; }
  _prepCtrs = prepContributorsOf(c);
  const opts = [];
  _prepCtrs.forEach((pc) => {
    if (pc.poolName !== p.pool) return;
    const isSpec = pc.ctr.class === 'Wizard' && c.wizardSchool;
    const freeUsed = isSpec ? specialistFreeUsed(c, pc) : {};
    for (const e of prepEligibleFor(c, pc)) {
      if (e.spell.name !== s.name) continue;
      opts.push({ pc, e, free: false });
      if (isSpec && isSpecialtySpell(c, e.spell) && !(freeUsed[e.lvl] > 0)) opts.push({ pc, e, free: true });
    }
  });
  if (!opts.length) { toast("No preparing class of yours reaches that spell — check its level against the class's max."); return; }
  if (opts.length === 1) { doPrepare(c, opts[0].pc, opts[0].e, false); return; }
  const multiCls = new Set(opts.map(o => o.pc.ctrKey)).size > 1;
  const label = (o) => `${multiCls ? o.pc.ctr.class + ' ' + o.pc.ctr.level + ' — ' : ''}${o.e.dispName} (lvl ${o.e.lvl}${o.free ? `, FREE — ${c.wizardSchool} specialty slot` : `, ${o.e.cost} PP`})`;
  openChoiceModal(`Memorize ${s.name}`, opts.map(label), async (sel) => {
    const o = opts[opts.map(label).indexOf(sel)]; if (!o) return;
    await doPrepare(c, o.pc, o.e, o.free);
  });
}

// v8.63.0 (Adam's B3 ruling): the decorated-name grammar — Magic-feat
// prefixes stack leftward in META_FEAT_DEFS order ("Quickened Extended
// Fireball"); Heighten wears its degree ("Heightened Fireball (to 5th)").
const META_PREP_PREFIX = { 'Enlarge Spell': 'Enlarged', 'Extend Spell': 'Extended', 'Empower Spell': 'Empowered', 'Widen Spell': 'Widened', 'Maximize Spell': 'Maximized', 'Quicken Spell': 'Quickened' };
function ordinalOf(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
function prepDecoratedName(base, decl) {
  let n = base;
  if (decl.hl) n = `Heightened ${n} (to ${ordinalOf(decl.hl)})`;
  for (const m of (decl.chosen || [])) { const p = META_PREP_PREFIX[m.name]; if (p) n = `${p} ${n}`; }
  return n;
}
// The cast-time receipt for a memorized augment spend — mirrors the live
// path's v8.44.0 math exactly; the PP themselves moved at dawn.
function prepAugFx(spell, extra, augPicks) {
  if (!extra) return null;
  const aug = parseAugmentSpec(spell);
  if (!aug) return null;
  const augFx = { extra, text: aug.text, dice: null, dcAdd: 0, label: aug.diceLabel, optBits: null };
  const defs = (typeof AUGMENT_OPTIONS !== 'undefined' && AUGMENT_OPTIONS[spell.name]) || null;
  if (defs && augPicks) {
    augFx.optBits = [];
    for (const o of defs) {
      const n = augPicks[o.id] || 0;
      if (!n) continue;
      if (o.kind === 'dice') { augFx.dice = { n: n * o.dice.n, d: o.dice.d }; augFx.label = 'damage'; if (o.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / o.dcEveryDice); }
      else if (o.kind === 'count') augFx.optBits.push(`+${n} ${o.noun}${n === 1 ? '' : 's'}`);
      else if (o.kind === 'flag') augFx.optBits.push(o.label);
      else if (o.kind === 'duration') augFx.optBits.push(`+${n * (o.rounds || 1)} round${n * (o.rounds || 1) === 1 ? '' : 's'} duration`);
      else if (o.kind === 'bonus') augFx.optBits.push(`+${n} ${o.label.replace(/^\+1 /, '')}`);
    }
  } else if (aug.dice && aug.step) {
    const steps = Math.floor(extra / aug.step);
    augFx.dice = { n: steps * aug.dice.n, d: aug.dice.d };
    if (aug.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / aug.dcEveryDice);
    else if (aug.dcEveryStep) augFx.dcAdd = steps;
  }
  return augFx;
}

async function doPrepare(c, pc, e, free) {
  // v8.63.0 (Adam's B3 ruling): the declaration stage — "any further costs
  // accrued from applying known Magic feats need to be paid at the time of
  // spell selection." Heighten, metamagic and augment PP all land HERE, per
  // instance; the cast later releases everything pre-paid (a Quickened
  // instance as a swift action). Free specialty slots stay plain — the free
  // slot is the school's standard spell.
  const featSet = new Set((c.feats || []).map(f => f.name));
  const metas = META_FEAT_DEFS.spell.filter(m => featSet.has(m.name));
  const canHeighten = featSet.has('Heighten Spell') && e.lvl < 9;
  const aug = parseAugmentSpec(e.spell);
  const cap = computeCasterLevels(c)[pc.poolName] || 1;
  let decl = { extra: 0, hl: 0, oc: 0, chosen: [], base: e.cost, total: e.cost, augPicks: null };
  if (!free && (metas.length || canHeighten || aug)) {
    const picked = await openCastOptions({ c, spell: e.spell, pool: pc.poolName, lvl: e.lvl, baseCost: e.cost, cap, aug, metas, canHeighten, canOverchannel: false, ocMax: 0, spont: { any: false, all: false }, isBuff: false, prep: true });
    if (!picked) return;
    decl = picked;
  }
  const declared = !!(decl.chosen.length || decl.hl || decl.extra);
  const dispName = declared ? prepDecoratedName(e.dispName, decl) : e.dispName;
  const cost = free ? 0 : decl.total;
  // The caster-level PP cap governs the memorized total ("as long as the
  // caster has the PP limit via their caster level to pay the total cost of
  // the multi-augmented spell" — Adam; stacking to the cap is legal).
  if (!free && cost > cap) {
    if (!(await confirmModal(`${dispName} would memorize at ${cost} PP total, over the ${POOL_EFF_LEVEL[pc.poolName].abbr} cap of ${cap} ("you can spend only a total number of points on a power equal to your manifester level" — HH p.403).\n\nMemorize anyway as a GM-approved exception?`))) return;
    logPowerException(c, e.spell.name, `memorized at ${cost} PP over the ${POOL_EFF_LEVEL[pc.poolName].abbr} cap of ${cap}`);
  }
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[pc.poolName]) c.ppCurrent[pc.poolName] = {};
  const cur = c.ppCurrent[pc.poolName][pc.ctrKey] ?? pc.budget;
  // v8.31.1 Blended Technique (Adam's redirect): "the Theurge must choose how
  // many spells to memorize, and how much power to save for spontaneous
  // abilities" — dawn memorization may draw its shortfall from the LINKED
  // pools' ledgers (own contributor first; own pool's other contributors keep
  // the standing per-contributor prep discipline). Only if the united pool
  // still can't cover it does the GM-exception path fire.
  let blendCovered = 0;
  if (cost > cur) {
    const blend = blendedPoolSetFor(c, pc.poolName);
    if (blend) {
      let avail = 0;
      for (const pn of blend) if (pn !== pc.poolName) avail += _poolPPRaw(c, pn).current;
      blendCovered = Math.min(cost - cur, avail);
    }
  }
  if (cost > cur + blendCovered) {
    if (!(await confirmModal(
      `Preparing ${dispName} costs ${cost} PP, but ${pc.ctr.class} ${pc.ctr.level} has only ${cur} PP unallocated${blendCovered ? ` (+${blendCovered} drawable from the blended pool)` : ''}.\n\nPrepare anyway as a GM-approved exception? (Available PP drains to 0.)`))) return;
    logPowerException(c, e.spell.name, `prepared at ${cost} PP with only ${cur + blendCovered} available (${pc.ctr.class} ${pc.ctr.level}${blendCovered ? ', blended' : ''})`);
  }
  c.ppCurrent[pc.poolName][pc.ctrKey] = Math.max(0, cur - cost);
  if (blendCovered > 0) {
    const blend = blendedPoolSetFor(c, pc.poolName);
    let deficit = Math.min(blendCovered, Math.max(0, cost - cur));
    for (const pn of (blend || [])) {
      if (pn === pc.poolName || deficit <= 0) continue;
      deficit -= _drainPoolLedgers(c, pn, deficit);
    }
    if (typeof logAct === 'function') logAct(`⚭ Blended Technique: ${blendCovered} PP of that preparation drawn from the linked pool.`);
  }
  // NOTE: unprepare refunds to this contributor's own ledger, capped at its
  // budget — blend-drawn PP past the cap is not re-routed (rest restores all).
  const list = getPreparedList(c, pc.poolName, pc.ctrKey);
  // v8.63.0: instances stack only with IDENTICAL declarations — a plain
  // Fireball and a Quickened Fireball are separate rows, per instance.
  const declKey = declared ? `${decl.hl || 0}|${decl.extra || 0}|${decl.chosen.map(m => m.name).join('+')}|${decl.augPicks ? JSON.stringify(decl.augPicks) : ''}` : '';
  const existing = list.find(r => r.name === e.spell.name && !!r.free === !!free && (r.declKey || '') === declKey);
  if (existing) existing.qty = (existing.qty || 0) + 1;
  else list.push({ name: e.spell.name, dispName, lvl: decl.hl || e.lvl, baseLvl: e.lvl, cost: free ? e.cost : cost, qty: 1, cast: 0, free: !!free,
    declKey, metas: decl.chosen.map(m => m.name), hl: decl.hl || 0, aug: decl.extra || 0, augPicks: decl.augPicks || null });
  if (typeof logAct === 'function') logAct(`Prepared ${dispName}${free ? ' (free specialty slot)' : ` (${cost} PP${declared ? ', Magic-feat/augment costs paid at memorization' : ''})`} — ${pc.ctr.class} ${pc.ctr.level}`);
  save(); renderPowers();
}

// Remove one UNcast instance and refund its PP (never past the budget cap).
// v8.57.0 (Adam): "in the strictest of terms no, but on an exceptional basis
// ('GM exception?') let's make it theoretically possible" — dawn memorization
// is RAW-fixed until the next rest, so unpreparing confirms as a GM exception.
async function unprepareAt(pi, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const pc = _prepCtrs[pi]; if (!pc) return;
  const list = getPreparedList(c, pc.poolName, pc.ctrKey);
  const rec = list[idx]; if (!rec) return;
  if ((rec.qty || 0) - (rec.cast || 0) <= 0) { toast('All instances of that spell are already cast — nothing to unprepare.'); return; }
  if (!(await confirmModal(`RAW: dawn memorization is fixed until the next rest — a prepared spell cannot normally be handed back.\n\nUnprepare one ${rec.dispName || rec.name}${rec.free ? '' : ` and refund ${rec.cost} PP`} as a GM-approved exception?`))) return;
  logPowerException(c, rec.name, `unprepared after dawn (GM exception${rec.free ? '' : `, ${rec.cost} PP refunded`})`);
  rec.qty -= 1;
  if (!rec.free && rec.cost) {
    const cur = c.ppCurrent?.[pc.poolName]?.[pc.ctrKey] ?? pc.budget;
    c.ppCurrent[pc.poolName][pc.ctrKey] = Math.min(pc.budget, cur + rec.cost);
  }
  if (rec.qty <= 0) list.splice(idx, 1);
  save(); renderPowers();
}

function finishPrepCast(c, pc, rec, spell, element) {
  rec.cast = (rec.cast || 0) + 1;
  let atom = spell.damage || null;
  let displayName = rec.dispName || spell.name;
  if (atom && atom.is_template && element) {
    const concrete = DamageResolver.expandTemplate(atom).find(x => x.type === element);
    if (concrete) { atom = concrete; displayName = concrete.name; }
  }
  // v8.63.0 (Adam's B3 ruling): the cast releases everything PRE-PAID at
  // memorization — metamagic, Heighten and augment all ride the record.
  const metasApplied = (rec.metas || []).map(n => META_FEAT_DEFS.spell.find(m => m.name === n)).filter(Boolean);
  const quickened = (rec.metas || []).includes('Quicken Spell');
  const augFx = prepAugFx(spell, rec.aug || 0, rec.augPicks || null);
  const attrMod = pc.ctr.attrMod ?? ((computeCasterStats(c)[pc.poolName] || {}).bestAttrMod || 0);
  const dcBonus = schoolDcBonus(c, spell);
  const saveDC = (spell.save && !/none/i.test(spell.save)) ? 10 + rec.lvl + attrMod + dcBonus + (augFx ? augFx.dcAdd : 0) : null;
  const after = getPoolPPState(c, pc.poolName);
  renderCastResult({ name: displayName, baseName: spell.name, pool: pc.poolName, lvl: rec.lvl, baseLvl: rec.baseLvl ?? rec.lvl, cost: 0, spent: 0, after, atom, saveDC, dcBonus, spell, buff: false, prepaid: true,
    metasApplied, augFx, heightened: (rec.hl || 0) > 0 });
  if (typeof logAct === 'function') logAct(`Cast prepared ${displayName}${quickened ? ' — SWIFT action (Quickened, paid at memorization)' : ''} (${pc.ctr.class} ${pc.ctr.level}) → ${rec.qty - rec.cast} of ${rec.qty} left`);
  // v8.60.1 (Adam's Animal Affinity report): PREPARED casts wire curated
  // buffs too. v8.63.0: the flagged rules question (augment at release?) is
  // ANSWERED by the B3 ruling — augment PP is paid at memorization and rides
  // the record, so the wired buff now computes from the declared spend.
  if (typeof applyWiredBuff === 'function') applyWiredBuff(c, spell.name, pc.poolName, rec.aug || 0, rec.augPicks || null);
  save(); renderPowers();
}

async function castPreparedAt(pi, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const pc = _prepCtrs[pi]; if (!pc) return;
  const list = getPreparedList(c, pc.poolName, pc.ctrKey);
  const rec = list[idx]; if (!rec) return;
  if ((rec.cast || 0) >= (rec.qty || 0)) { toast('All prepared instances of that spell are spent for today.'); return; }
  const spell = SPELLS_DB.find(s => s.name === rec.name);
  if (!spell) { toast('Catalogue entry not found.'); return; }
  // v8.63.0: a QUICKENED instance casts as a swift action (paid at
  // memorization), so it passes the instantaneous-resolution gate the same
  // way any swift cast does — everything else still queues behind it.
  const quickened = (rec.metas || []).includes('Quicken Spell');
  if (!quickened && !(await instantGateOK(c, spell, pc.poolName))) return;  // v8.57.0 instantaneous-resolution gate
  if (spell.damage && spell.damage.is_template) {
    const elements = spell.damage.elements || ['acid', 'cold', 'electricity', 'fire', 'sonic'];
    openChoiceModal(`${rec.dispName || spell.name} — choose the energy type`, elements.map(x => x[0].toUpperCase() + x.slice(1)), (sel) => finishPrepCast(c, pc, rec, spell, sel.toLowerCase()));
    return;
  }
  finishPrepCast(c, pc, rec, spell, null);
}

// Cleric spontaneous conversion: burn an uncast prepared instance to cast
// Cure/Inflict Wounds (Druid Option: Summon Nature's Ally) at ≤ its level.
function convertPreparedAt(pi, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const pc = _prepCtrs[pi]; if (!pc) return;
  const list = getPreparedList(c, pc.poolName, pc.ctrKey);
  const rec = list[idx]; if (!rec) return;
  if ((rec.cast || 0) >= (rec.qty || 0)) { toast('All prepared instances of that spell are spent for today.'); return; }
  // v8.57.0: a Heritage 'Cleric (Druid Option)' contributor is Druid-side too
  // (the class-level c.druidOption flag can't carry it — no Cleric levels).
  const druidSide = c.druidOption || pc.ctr._heritageChoice === 'Cleric (Druid Option)';
  const targets = druidSide ? ['Summon Nature’s Ally (I-IX)'] : ['Cure Wounds', 'Inflict Wounds'];
  const token = druidSide ? 'Drd' : 'Clr';
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const byLabel = new Map();
  for (const tn of targets) {
    const ts = SPELLS_DB.find(s => s.name === tn);
    if (!ts) continue;
    const range = (ts.levels || []).find(l => l.cls === token);
    if (!range) continue;
    const lo = range.lvl, hi = Math.min(rec.lvl, range.lvl_max ?? range.lvl);
    for (let k = lo; k <= hi; k++) {
      const label = druidSide ? `Summon Nature’s Ally ${ROMAN[k] || k}` : `${tn} — level ${k}`;
      byLabel.set(label, { ts, k, label });
    }
  }
  if (!byLabel.size) { toast('No conversion target reachable at that spell level.'); return; }
  openChoiceModal(`Convert ${rec.dispName || rec.name} (lvl ${rec.lvl}) into…`, [...byLabel.keys()], async (sel) => {
    const pick = byLabel.get(sel); if (!pick) return;
    if (!(await instantGateOK(c, pick.ts, pc.poolName))) return;  // v8.57.0 instantaneous-resolution gate
    rec.cast = (rec.cast || 0) + 1;
    const attrMod = pc.ctr.attrMod ?? 0;
    const dcBonus = schoolDcBonus(c, pick.ts);
    const saveDC = (pick.ts.save && !/none/i.test(pick.ts.save)) ? 10 + pick.k + attrMod + dcBonus : null;
    renderCastResult({ name: pick.label, baseName: pick.ts.name, pool: pc.poolName, lvl: pick.k, cost: 0, spent: 0, after: getPoolPPState(c, pc.poolName), atom: pick.ts.damage || null, saveDC, dcBonus, spell: pick.ts, buff: false, prepaid: true });
    if (typeof logAct === 'function') logAct(`Converted prepared ${rec.dispName || rec.name} → ${pick.label} (${pc.ctr.class} ${pc.ctr.level})`);
    // v8.60.1: conversion targets wire too (none curated today — future-proof).
    if (typeof applyWiredBuff === 'function') applyWiredBuff(c, pick.ts.name, pc.poolName, 0, null);
    save(); renderPowers();
  });
}

// ============================================================================
// v8.21.0 SEGMENT A — PSIONIC FOCUS (Adam's augmentation project, 2026-09-04).
// Two focus mechanics, per the HH's own synthesis:
//   • PSIONIC focus (HH p.354 "Gain Psionic Focus" + Concentration skill):
//     a full-round action (move action with Psionic Meditation, HH p.237) to
//     gain, then HELD as a persistent state until expended. Power feats,
//     Power Penetration, Slippery Mind, Monk ki features, Still Mind and
//     Speed of Thought all key off it.
//   • SUPER focus (HH p.354 "Gain Super-Power Focus"): a move action that
//     lasts only until the very next action, which must be the manifestation
//     it modifies — otherwise wasted. NEVER stored: it is a cast-time
//     declaration, not a state (which is also why Opportunity Power's
//     immediate-action trick is closed to mutants, HH p.234 Special).
// Only the psionic kind is persistent, so only it gets character state:
// c.psiFocused (boolean). The Second Skin LOCKS the focus while manifested
// (HH p.241) — neither gain nor expend until it drops.
function isPsiFocusCapable(c) {
  if (!c) return false;
  const cs = computeCasterStats(c);
  if (cs.psionic && cs.psionic.contributors.length) return true;
  if (migrateLegacyClasses(c).some(e => e.name === 'Monk' && (e.level || 0) >= 3)) return true; // Still Mind et al.
  const powerFeats = new Set((c.feats || []).map(f => f.name).filter(n => (getFeatData(n) || {}).family === 'Power'));
  return powerFeats.size > 0;
}
function psiFocusLocked(c) {
  const sk = (typeof activeSecondSkin === 'function') ? activeSecondSkin(c) : null;
  return !!(sk && !sk.destroyed);
}
function gainPsiFocus() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin (HH p.241) — dismiss it first.'); return; }
  if (c.psiFocused) { toast('Already psionically focused.'); return; }
  const medit = (c.feats || []).some(f => f.name === 'Psionic Meditation');
  c.psiFocused = true;
  logActionEvent(c, 'psi-focus', 0, 'Focus gained', `Psionic focus gained (${medit ? 'move action — Psionic Meditation' : 'full-round action'}; Concentration DC 20, see the skill for taking the action defensively).`);
  save(); if (typeof renderPPRecovery === 'function') renderPPRecovery(c); renderPowers(); renderSheet();
  toast(`● Psionically focused (${medit ? 'move action' : 'full-round action'}, Concentration DC 20).`);
}
function expendPsiFocus(why) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin — it cannot be expended.'); return; }
  if (!c.psiFocused) { toast('Not currently focused — gaining focus is a full-round action (move with Psionic Meditation).'); return; }
  c.psiFocused = false;
  logActionEvent(c, 'psi-focus', 0, 'Focus expended', `Psionic focus expended${why ? ` — ${why}` : ''}.`);
  save(); if (typeof renderPPRecovery === 'function') renderPPRecovery(c); renderPowers(); renderSheet();
  toast('○ Focus expended.');
}
// The Tracker/Powers chip: state + gain/expend controls (Warmind Battle Focus
// at Psionic Scale 0 keeps its own separate panel — different feature).
function psiFocusChipHTML(c) {
  if (!isPsiFocusCapable(c)) return '';
  const locked = psiFocusLocked(c);
  const medit = (c.feats || []).some(f => f.name === 'Psionic Meditation');
  const state = locked
    ? `<b style="color:var(--vio);">🧿 locked</b> <span style="opacity:var(--o60);color:var(--dim);">(sustaining the Second Skin)</span>`
    : c.psiFocused
    ? `<b style="color:#6dba88;">● focused</b>`
    : `<b style="opacity:.6;">○ unfocused</b>`;
  const btn = locked ? '' : c.psiFocused
    ? `<button class="btn btn-sm" style="font-size:10px;padding:0 6px;" onclick="expendPsiFocus('manual (declared at the table)')" title="Expend the focus (Power feats, Power Penetration, Slippery Mind, ki features...)">Expend</button>`
    : `<button class="btn btn-sm" style="font-size:10px;padding:4px 8px;min-height:24px;" onclick="gainPsiFocus()" title="${medit ? 'Move action (Psionic Meditation)' : 'Full-round action'} — Concentration DC 20">Gain focus</button>`;
  return `<div style="font-size:11.5px;margin:3px 0;display:flex;align-items:center;gap:6px;"><span style="cursor:help;" title="Psionic focus (HH p.354): a full-round action to gain (move action with Psionic Meditation), held until expended. While focused: Still Mind (+2 Will vs mind-affecting, Monk 3+), Speed of Thought (+10′ out of heavy armor), Up the Wall... Expending powers Power feats, Power Penetration, Slippery Mind, and the Monk's ki riders.">Psionic focus:</span> ${state} ${btn}</div>`;
}

// "New day" across everything at once: every caster pool rests (PP refilled,
// prepared lists re-memorized), the super-PP pool refills. AP do NOT refresh
// — those only return on level-up (Adam's ruling, 2026-06).
function fullyRested() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const stats = computeCasterStats(c);
  for (const poolName of ['arcane', 'divine', 'psionic']) {
    if (stats[poolName] && stats[poolName].contributors.length) restPP(poolName);
  }
  const mpSt = getMPState(c);
  if (mpSt.isSuperMutant) c.superPPCurrent = getSuperPPState(c).max;
  // v8.8.2 (Adam's AMENDED ruling, 2026-09-02 — supersedes rest = PP only):
  // Rest also restores per-diem class-ability uses to their defaults.
  // Per-WEEK abilities (Remove Disease, Quivering Palm) keep their count —
  // renew those individually via the GM ↻. 8 hours' rest clears fatigue.
  if (c.abilityUses) {
    const weekly = new Set((typeof computePerDiemAbilities === 'function' ? computePerDiemAbilities(c) : []).filter(s => s.weekly).map(s => s.key));
    for (const k of Object.keys(c.abilityUses)) if (!weekly.has(k)) c.abilityUses[k] = 0;
  }
  if (c.fatigued) { c.fatigued = false; if (c.conditions) c.conditions = c.conditions.filter(x => x !== 'Fatigued'); }
  if (c.raging) c.raging = false;
  // v8.21.0: a rested psionic character trivially re-gathers their focus
  // (one quiet full-round action) — start the day focused, unless the
  // Second Skin still holds it.
  if (typeof isPsiFocusCapable === 'function' && isPsiFocusCapable(c) && !psiFocusLocked(c) && !c.psiFocused) {
    c.psiFocused = true;
    logActionEvent(c, 'psi-focus', 0, 'Focus gained', 'Psionic focus regained with the new day (Fully Rested).');
  }
  // v8.13.0 (Adam's ruling): armor does NOT heal — except armor with the
  // Self-Repairing gadget (1 HP/min, HH p.~280), fully restored over the
  // course of the evening. Destroyed armor is past what nanites can fix.
  const selfRepaired = [];
  for (const it of getCharItems(c)) {
    const g = (typeof armorItemIntegrity === 'function') ? armorItemIntegrity(it) : null;
    if (g && g.selfRepairing && !g.destroyed && g.damage > 0) {
      it.armorDamage = 0;
      selfRepaired.push((typeof enchantDisplayName === 'function') ? enchantDisplayName(it) : it.ref);
    }
  }
  if (typeof logAct === 'function') logAct('Fully Rested — new day: all PP pools refilled, prepared spells re-memorized, daily class-ability uses restored (weekly abilities untouched), fatigue cleared.' + (selfRepaired.length ? ` Self-Repairing armor fully restored overnight: ${selfRepaired.join(', ')}.` : ''));
  save(); renderPowers();
  if (typeof renderPPRecovery === 'function') renderPPRecovery(c);  // Tracker panel (C4)
  if (typeof renderPerDiem === 'function') renderPerDiem(c);
  if (typeof renderArmorIntegrity === 'function') renderArmorIntegrity(c);
  renderSheet();
  toast('Fully rested — new day. PP + daily ability uses restored.' + (selfRepaired.length ? ' Self-Repairing armor restored.' : ''));
}

// v8.8.2: Tracker per-diem ability panel — one row per ability with use/undo
// and the per-ability GM ↻ renew (Adam's partial-rejuvenation ruling).
function renderPerDiem(c) {
  const host = document.getElementById('tr-perdiem');
  if (!host) return;
  const specs = (typeof computePerDiemAbilities === 'function') ? computePerDiemAbilities(c) : [];
  if (!specs.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  host.innerHTML = `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);margin-bottom:4px;">Class Abilities <span style="color:var(--g45);font-size:9px;text-transform:none;letter-spacing:0;">· ☀ Fully Rested restores daily; ↻ = GM renew (single ability)</span></div>`
    + specs.map(s => {
      const used = abilityUsed(c, s.key);
      const left = Math.max(0, s.max - used);
      const low = left === 0;
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:2px 0;">
        <span style="flex:1;cursor:help;" title="${escapeHTML(s.note || '')}">${s.name}${s.weekly ? ' <span style="opacity:.55;font-size:9px;">(per week)</span>' : ''}</span>
        <b style="color:${low ? 'var(--red-text)' : 'rgba(120,175,205,.95)'};">${left}</b><span style="opacity:var(--o55);color:var(--dim);">/${s.max}${s.kind === 'pool' ? ' pts' : ''}</span>
        <button class="btn btn-sm" style="font-size:10px;padding:0 6px;" title="Spend one ${s.kind === 'pool' ? 'point' : 'use'}" onclick="adjustAbilityUse('${s.key}',1)">−</button>
        <button class="btn btn-sm" style="font-size:10px;padding:0 6px;" title="Undo a spent ${s.kind === 'pool' ? 'point' : 'use'}" onclick="adjustAbilityUse('${s.key}',-1)">+</button>
        <button class="btn btn-sm" style="font-size:10px;padding:0 6px;opacity:.7;" title="GM renew: reset ${s.name} alone (a rejuvenating roleplay event short of a full rest)" onclick="renewAbility('${s.key}')">↻</button>
      </div>`;
    }).join('');
}

