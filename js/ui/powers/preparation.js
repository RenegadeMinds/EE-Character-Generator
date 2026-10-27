// =============================================================================
// js/ui/powers/preparation.js
// POWERS / PREPARATION — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Preparing, casting and converting prepared spells;
//   power-point recovery.
//
// KEY NAMES (so you can search for them)
//   tables and state: _pendingInstant, _prepCtrs
//   functions (13): adjustPP, restPP, snapshotPowerTextareas, instantGateOK,
//   prepPickAndAdd, memorizeKnownAt, doPrepare, unprepareAt, finishPrepCast,
//   castPreparedAt, convertPreparedAt, renderPrepPanel, renderPPRecovery
//
// WHERE IT CAME FROM
//   Gathered from js/app/50-skills-page.js, js/app/56-supernatural-
//   attributes-pools-psi-focus.js, js/app/60-starships.js,
//   js/app/64-tracker.js when the code was regrouped by topic and page. Each
//   function and table moved whole and unchanged, with the comments above
//   it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v8.2.2 (Issue 4): Real-time skill point budget tally with class/cross-class
// cost differential per HH p.541-544.
//
// COST MODEL (HH p.541-544):
//   - Class skill rank: 1 skill point per rank
//   - Cross-class skill rank: 2 skill points per rank
//
// DEFERRED for a future slice (visible-but-not-yet-painful gaps):
//   - [DONE v8.52.0] HH: cross-class max-rank cap is half the class-skill cap
//     — inputs now carry max = lvl+4 (class) / floor((lvl+4)/2) (cross-class),
//     with a visible /cap chip and an over-cap ⚠ flag. Typed-in values above
//     the cap are still ACCEPTED (browser marks them out-of-range; the chip
//     flags them) — a hard gate + GM-exception prompt remains deferred.
//   - HH p.7300+ & p.11919: half-ranks (two cross-class half-ranks = 1 whole
//     rank). Currently c.skills stores integer ranks only. Modeling halves
//     would require either floating-point storage or a separate halfRanks field.
//
// These deferrals are tracked here so the next pass on skills knows what's left.

// Recompute spent/remaining from LIVE DOM inputs (not from c.skills) so the
// tally reflects tentative changes before Save. Called from updSkTot on every
// input change, and once at the end of renderSkills() for initial display.
// v8.3.12: Adjust the current PP for a specific contributor within a pool.
// Called by +/− buttons in the Powers & Spells panel. delta is +1 or -1.
// Clamps to [0, contributor budget].
function adjustPP(ctrIdSafe, poolName, ctrKey, delta) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  const stats = computeCasterStats(c);
  const pool = stats[poolName];
  if (!pool) return;
  // Find this contributor's budget by matching ctrKey
  const ctr = pool.contributors.find(x => ((x.class || 'unknown') + ':' + (x.level || 0)) === ctrKey);
  if (!ctr) return;
  const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
  const cur = c.ppCurrent[poolName][ctrKey] ?? budget;
  const next = Math.max(0, Math.min(budget, cur + delta));
  c.ppCurrent[poolName][ctrKey] = next;
  // Update the visible counter without re-rendering the whole sheet
  const el = document.getElementById('pp-cur-' + ctrIdSafe);
  if (el) el.textContent = next;
  save();
}

// v8.3.12: Reset all contributors' PP current to their budget for one pool.
// Also clears the "Prepared Today" textareas for prep casters in this pool.
function restPP(poolName) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  const stats = computeCasterStats(c);
  const pool = stats[poolName];
  if (!pool) return;
  // v8.42.0: resting ends ALL active power effects (Adam: "all effects wear
  // off at the very least when the character rests"). Idempotent — the
  // fullyRested() multi-pool sweep clears on its first pool only.
  const _aeCleared = clearActiveBuffs(c, 'rested');
  if (_aeCleared) {
    toast(`✨ ${_aeCleared} active power effect${_aeCleared === 1 ? '' : 's'} ended with the rest.`);
    renderActiveBuffs(c);
  }
  for (const ctr of pool.contributors) {
    if (ctr._isAdvancer) continue;  // heritage/feat PP refills too (v8.5.4)
    const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    c.ppCurrent[poolName][ctrKey] = budget;
    // v8.5.4 Layer 4: new dawn — re-memorize yesterday's structured prepared
    // list automatically: cast counters reset, committed PP re-deducted from
    // this contributor's fresh budget (free specialty slots cost nothing).
    // If a level-up shrank the budget below the committed total, the deficit
    // just drains to 0 — the panel shows the imbalance for the player to fix.
    const list = c.preparedSlots && c.preparedSlots[poolName] && c.preparedSlots[poolName][ctrKey];
    if (list && list.length) {
      let committed = 0;
      for (const r of list) { r.cast = 0; if (!r.free) committed += (r.cost || 0) * (r.qty || 0); }
      c.ppCurrent[poolName][ctrKey] = Math.max(0, budget - committed);
    }
  }
  // Clear prepared today for this pool (legacy free-text workflow)
  if (c.preparedToday && c.preparedToday[poolName]) {
    c.preparedToday[poolName] = {};
  }
  save();
  renderSheet(c);
  renderPowers();
}

// v8.3.12: Capture textarea changes for prepared-today and powers-known lists,
// invoked via onblur on the textareas. Snapshots into the character object.
function snapshotPowerTextareas(c) {
  if (!c) return;
  const stats = computeCasterStats(c);
  if (!c.preparedToday) c.preparedToday = {};
  if (!c.powersKnownList) c.powersKnownList = {};
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = stats[poolName];
    if (!pool) continue;
    if (!c.preparedToday[poolName]) c.preparedToday[poolName] = {};
    if (!c.powersKnownList[poolName]) c.powersKnownList[poolName] = {};
    for (const ctr of pool.contributors) {
      if (ctr._isAdvancer || ctr._fromHeritage) continue;
      const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
      const ctrIdSafe = (poolName + '_' + ctrKey).replace(/[^a-z0-9]/gi,'_');
      if (ctr.prep) {
        const el = document.getElementById('prep-' + ctrIdSafe);
        if (el) c.preparedToday[poolName][ctrKey] = el.value;
      } else {
        const el = document.getElementById('known-' + ctrIdSafe);
        if (el) c.powersKnownList[poolName][ctrKey] = el.value;
      }
    }
  }
}

// v8.57.0 (Adam): instantaneous-resolution gate. An Instantaneous effect must
// be RESOLVED at the table before the next one fires — a successive
// instantaneous cast prompts "has the last one been resolved?" first.
// Swift/immediate casting times are exempt (they legitimately interleave
// with another action — and Quicken Spell/Power is earmarked to join them).
let _pendingInstant = null; // { charId, name }
async function instantGateOK(c, spell, pool) {
  if (!_pendingInstant || !c || _pendingInstant.charId !== c.id) return true;
  if (!_isInstantSpell(spell) || _isSwiftCast(spell, pool)) return true;
  const ok = await confirmModal(`⏳ ${_pendingInstant.name} is instantaneous and still on the board.\n\nHas it been resolved? OK confirms resolution and casts ${spell.name}; Cancel holds this cast.`);
  if (ok) dismissCastResult();
  return ok;
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
    logAct(`⚭ Blended Technique: ${blendCovered} PP of that preparation drawn from the linked pool.`);
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
  logAct(`Prepared ${dispName}${free ? ' (free specialty slot)' : ` (${cost} PP${declared ? ', Magic-feat/augment costs paid at memorization' : ''})`} — ${pc.ctr.class} ${pc.ctr.level}`);
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
  logAct(`Cast prepared ${displayName}${quickened ? ' — SWIFT action (Quickened, paid at memorization)' : ''} (${pc.ctr.class} ${pc.ctr.level}) → ${rec.qty - rec.cast} of ${rec.qty} left`);
  // v8.60.1 (Adam's Animal Affinity report): PREPARED casts wire curated
  // buffs too. v8.63.0: the flagged rules question (augment at release?) is
  // ANSWERED by the B3 ruling — augment PP is paid at memorization and rides
  // the record, so the wired buff now computes from the declared spend.
  applyWiredBuff(c, spell.name, pc.poolName, rec.aug || 0, rec.augPicks || null);
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
    logAct(`Converted prepared ${rec.dispName || rec.name} → ${pick.label} (${pc.ctr.class} ${pc.ctr.level})`);
    // v8.60.1: conversion targets wire too (none curated today — future-proof).
    applyWiredBuff(c, pick.ts.name, pc.poolName, 0, null);
    save(); renderPowers();
  });
}

function renderPrepPanel(c) {
  const host = document.getElementById('pw-prep');
  if (!host) return;
  _prepCtrs = prepContributorsOf(c);
  if (!_prepCtrs.length) { host.innerHTML = ''; return; }
  let html = `<div class="sec-head sm">Prepared Spells <span style="font-weight:400;font-size:10px;opacity:var(--o60);color:var(--dim);">(memorized at dawn — PP, Magic-feat and augment costs ALL paid at preparation, per instance; casting is free)</span></div>`;
  html += `<div style="border:1px solid rgba(220,205,138,.25);border-radius:3px;margin-bottom:1rem;">`;
  _prepCtrs.forEach((pc, pi) => {
    const c2 = chars.find(x => x.id === curId);
    const list = getPreparedList(c2, pc.poolName, pc.ctrKey);
    const cur = c2.ppCurrent?.[pc.poolName]?.[pc.ctrKey] ?? pc.budget;
    const committed = list.reduce((t, r) => t + (r.free ? 0 : (r.cost || 0) * (r.qty || 0)), 0);
    const isSpec = pc.ctr.class === 'Wizard' && c2.wizardSchool;
    html += `<div style="padding:7px 10px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
        <div><b style="color:#dccd8a;">${escapeHTML(pc.ctr.class)} ${pc.ctr.level}</b>
          <span style="font-size:10px;opacity:.6;" title="${POOL_EFF_LEVEL[pc.poolName].full} contribution of this class — its spells resolve at this level">(${pc.poolName} · ${POOL_EFF_LEVEL[pc.poolName].abbr} ${pc.ctr.clContribution} · max spell lvl ${pc.ctr.classMaxPowerLvl})</span>
          <span style="font-size:11px;margin-left:8px;color:var(--tx80);">PP: <b>${cur}</b>/${pc.budget} unallocated · ${committed} committed to prep</span></div>
        <div><button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="prepPickAndAdd(${pi})">+ Prepare…</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="restPP('${pc.poolName}')" title="Refill this pool's PP and re-memorize the current list (new day)">☾ Rest pool</button></div>
      </div>`;
    if (isSpec) {
      const freeUsed = specialistFreeUsed(c2, pc);
      const lvls = [];
      for (let L = 0; L <= (pc.ctr.classMaxPowerLvl || 0); L++) lvls.push(`${L}:${freeUsed[L] ? '●' : '○'}`);
      html += `<div style="font-size:10px;color:var(--g60);margin-top:2px;">${escapeHTML(c2.wizardSchool)} specialist — one free specialty spell per level daily: ${lvls.join(' ')}</div>`;
    }
    if (pc.ctr.class === 'Cleric') {
      html += `<div style="font-size:10px;color:var(--g55);margin-top:2px;">Spontaneous conversion: any uncast prepared spell → ${(c2.druidOption || pc.ctr._heritageChoice === 'Cleric (Druid Option)') ? 'Summon Nature’s Ally' : 'Cure/Inflict Wounds'} of the same level or lower (⇄ button).</div>`;
    }
    if (pc.ctr.class !== 'Wizard') {
      html += `<div style="font-size:10px;color:var(--g45);margin-top:2px;">Divine preparation draws on the class's ENTIRE spell list — “+ Prepare…” browses it by spell level (no need to add spells to Known first).</div>`;
    }
    html += list.length
      ? list.map((r, idx) => {
          const left = (r.qty || 0) - (r.cast || 0);
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11.5px;padding:3px 0 3px 12px;${left <= 0 ? 'opacity:.45;' : ''}">
            <div><b>${escapeHTML(r.dispName || r.name)}</b> <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">lvl ${r.lvl}${r.free ? ' · FREE specialty' : ` · ${r.cost} PP`}</span>${(r.metas || []).includes('Quicken Spell') ? ' <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.4);border-radius:3px;padding:0 3px;" title="Quickened at memorization — this instance casts as a SWIFT action (no AoO, one per round).">swift</span>' : ''}
              <span style="font-size:10px;color:${left > 0 ? '#6dba88' : 'var(--red-text)'};margin-left:6px;">${left}/${r.qty} left${r.cast ? ` (${r.cast} cast)` : ''}</span></div>
            <div>
              <button class="btn btn-sm" style="font-size:10px;${left <= 0 ? 'opacity:.5;' : 'border-color:rgba(120,175,205,.5);color:rgba(120,175,205,.95);'}" title="Cast a prepared instance (no PP)" onclick="castPreparedAt(${pi},${idx})">⚡ Cast</button>
              ${pc.ctr.class === 'Cleric' ? `<button class="btn btn-sm" style="font-size:10px;${left <= 0 ? 'opacity:.5;' : ''}" title="Spontaneous conversion" onclick="convertPreparedAt(${pi},${idx})">⇄</button>` : ''}
              <button class="btn btn-sm btn-danger" style="font-size:10px;" title="Unprepare one uncast instance (refunds its PP)" onclick="unprepareAt(${pi},${idx})">−</button>
            </div>
          </div>`;
        }).join('')
      : `<div style="font-size:11px;color:var(--g45);padding:4px 0 2px 12px;font-style:italic;">Nothing prepared yet — click “+ Prepare…” at dawn.</div>`;
    html += `</div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}

// v8.5.4 ergo C4: Tracker PP-recovery panel — per-pool current/max chips
// (EAL/EDL/EPL/ESL labeled) + prepared-list counts. PP ONLY, per Adam's
// ruling: HP stays manual, AP stay level-up-only.
function renderPPRecovery(c){
  const panel = document.getElementById('tr-pp-panel');
  const host = document.getElementById('tr-pp');
  if (!panel || !host) return;
  const stats = computeCasterStats(c);
  const mpSt = getMPState(c);
  const bits = [];
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = stats[poolName];
    if (!pool || !pool.contributors.length) continue;
    const pp = getPoolPPState(c, poolName);
    const eff = POOL_EFF_LEVEL[poolName];
    const low = pp.max > 0 && pp.current / pp.max <= 0.33;
    let prepBit = '';
    const slots = c.preparedSlots && c.preparedSlots[poolName];
    if (slots) {
      let qty = 0, cast = 0;
      for (const key in slots) for (const r of slots[key]) { qty += r.qty || 0; cast += r.cast || 0; }
      if (qty) prepBit = ` · <span title="prepared instances remaining today">${qty - cast}/${qty} prepared</span>`;
    }
    const permBit = pp.permanentSpent ? ` <span style="opacity:.55;font-size:10px;cursor:help;" title="Permanently expended on High Arcana / Mental Mastery picks — the pool maximum shown is already reduced.">(−${pp.permanentSpent} permanent)</span>` : '';
    bits.push(`<div style="font-size:12px;margin:3px 0;"><span title="${eff.full}" style="cursor:help;color:var(--g75);">${eff.abbr} ${pool.cl}</span> · ${poolName}: <b style="color:${low ? 'var(--red-text)' : 'rgba(120,175,205,.95)'};">${pp.current}</b>/${pp.max} PP${permBit}${prepBit}</div>`);
  }
  if (mpSt.isSuperMutant) {
    const spp = getSuperPPState(c);
    bits.push(`<div style="font-size:12px;margin:3px 0;"><span title="Effective Super Level" style="cursor:help;color:var(--tv80);">ESL ${mpSt.eml}</span> · super: <b style="color:rgba(196,153,212,.95);">${spp.current}</b>/${spp.max} PP</div>`);
  }
  // v8.21.0 Segment A: the psionic-focus chip joins the PP panel.
  { const chip = psiFocusChipHTML(c); if (chip) bits.push(chip); }
  if (!bits.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  host.innerHTML = bits.join('');
}
