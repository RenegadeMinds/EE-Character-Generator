// =============================================================================
// js/app/54-powers-repertoire.js
// POWERS REPERTOIRE
// =============================================================================
//
// WHAT'S IN HERE
//   A character's spell/power repertoire: caster pools, entitlement to the
//   Spells and Powers tabs, and the powers budget.
//
// KEY NAMES (so you can search for them)
//   functions (16): getCharPowers, getCasterPoolsInfo,
//   characterIsEntitledToSpells, characterIsEntitledToPowers,
//   spellPoolOptions, reconcileExpandedKnowledgePowers, getPowersBudget,
//   _pwSideLabel, togglePwBrowse, addPowerFromBrowse, knownPickedByLevel,
//   finishAddPower, logPowerException, removePowerAt, togglePwBrowseDetail,
//   togglePwKnownDetail
//
// LOAD ORDER
//   File 54 of 68. index.html loads it after js/data/53-domains.js and before
//   js/app/55-mutations-engine.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 46032-46502 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 46032-46502; unchanged below this line ----


function getCharPowers(c) { return (c && c.powers) || []; }

// Per-pool casting info: which list tokens this character reaches, the pool's
// max castable power level, and its known-count budget (null = no limit).
function getCasterPoolsInfo(c) {
  const stats = computeCasterStats(c || {});
  const pools = {};
  const arcaneContribs = [];
  for (const e of migrateLegacyClasses(c || {})) {
    if (!e.level || e.level <= 0) continue;
    const map = SPELL_LIST_TOKENS[e.name];
    if (!map) continue;
    // v8.5.4: scenario Scale gate — casting requires the pool's Scale ≥ 1
    // (HH class-availability rules; at Scale 0 the Ranger/Bard swap to their
    // Nature's Secrets / Storyteller variants instead, and no class casts
    // from a Scale-0 pool). Pool names match the sixLevels axis names.
    if ((((c && c.sixLevels) || {})[map.pool] ?? 0) === 0) continue;
    const st = stats[map.pool] || {};
    if (!pools[map.pool]) pools[map.pool] = { tokens: new Map(), classes: [], maxPowerLvl: st.maxPowerLvl || 0, powersKnownTotal: st.powersKnownTotal || 0,
      // v8.33.0 (Adam's Heinrix Sorcerer report): spontaneous SPELL casters'
      // knowns live in spellsKnown[] (per spell level), not powersKnownTotal —
      // the pools map never carried them, so every Sorcerer/Bard pool read
      // "no limit" since v8.5.x. Carried now for the known-count budget.
      spellsKnownTotal: (st.spellsKnown || []).reduce((s, n) => s + (n || 0), 0),
      spellsKnownByLvl: (st.spellsKnown || []).slice() };
    const p = pools[map.pool];
    p.classes.push(e.name);
    // ---- v8.5.4 sub-option routing (see the SPELL_LIST_TOKENS comment) ----
    if (e.name === 'Cleric') {
      if (c && c.druidOption) {
        if (!p.tokens.has('Drd')) p.tokens.set('Drd', null);
      } else {
        if (!p.tokens.has('Clr')) p.tokens.set('Clr', null);
        for (const d of ((c && c.clericDomains) || [])) if (!p.tokens.has(d)) p.tokens.set(d, null);
      }
      continue;
    }
    if (e.name === 'Saint') {
      const sd = (c && c.saintDomains) || [];
      if (sd.length) {
        for (const d of sd) if (!p.tokens.has(d)) p.tokens.set(d, null);
        p._saintConfigured = true;
        // v8.5.4: Personal Domain — one GM-approved Cleric-list spell at 3rd
        // and every odd Saint level after (HH Saint table); permanent once
        // chosen. Budget enforced in finishAddPower gate 3.
        p._saintPersonalBudget = Math.max(0, Math.floor(((e.level || 0) - 1) / 2));
      } else if (!p.tokens.has('Clr')) {
        p.tokens.set('Clr', map.advisory);
      }
      continue;
    }
    if (e.name === 'Paladin') {
      // v8.5.4: domains-only, like the Saint — but with NO Cleric-list
      // fallback: unconfigured Paladins previously had a dead token (empty
      // list), so there's no legacy behavior to preserve; the sub-options
      // picker prompts for the deity's domains instead.
      for (const d of ((c && c.paladinDomains) || [])) if (!p.tokens.has(d)) p.tokens.set(d, null);
      continue;
    }
    if (e.name === 'Psion') {
      for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, null);
      const disc = c && c.psionDiscipline;
      if (disc && map.disciplineTokens.includes(disc)) {
        // Chosen discipline is native; the other five are hard-excluded
        // (no token = no route). Expanded Knowledge picks bypass via
        // _expandedNames below.
        if (!p.tokens.has(disc)) p.tokens.set(disc, null);
      } else {
        for (const t of map.disciplineTokens) if (!p.tokens.has(t)) p.tokens.set(t, 'discipline power — requires the matching Psion discipline (GM confirm)');
      }
      continue;
    }
    for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, map.advisory || null);
    if (map.psionicOnly) {
      p._psionicOnlyTokens = p._psionicOnlyTokens || new Set();
      for (const t of map.tokens) p._psionicOnlyTokens.add(t);
    }
    if (map.pool === 'arcane' && map.tokens.includes('Sor/Wiz')) arcaneContribs.push(e.name);
  }
  // v8.30.0 (Adam): Heritage feats — chosen-class list access at 1st level.
  // Mirrors the class loop's sub-option routing above (deliberately kept
  // separate: that loop is battle-tested; Heritage rides beside it). A feat
  // whose chosen class has real levels contributes nothing here — the class
  // rows above already carry its tokens (subsumption). No param = no tokens
  // yet (the Feats tab offers ⬦ choose). Heritage grants the BASE list of the
  // class: no Cleric domains, no Wizard school specialization, no Saint deity
  // domains or Personal Domain budget — those are class-level choices.
  {
    const HERITAGE_POOLS = { 'Arcane Heritage': 'arcane', 'Divine Heritage': 'divine', 'Psionic Heritage': 'psionic' };
    const hClassArr = migrateLegacyClasses(c || {});
    for (const f of ((c && c.feats) || [])) {
      const nm = typeof f === 'string' ? f : (f.name || f.n);
      if (!HERITAGE_POOLS[nm]) continue;
      const chosenRaw = (typeof f !== 'string' && f.param) ? f.param : null;
      if (!chosenRaw) continue;
      const druidVariant = chosenRaw === 'Cleric (Druid Option)';
      const chosen = druidVariant ? 'Cleric' : chosenRaw;
      const map = SPELL_LIST_TOKENS[chosen];
      if (!map) continue;
      if ((((c && c.sixLevels) || {})[map.pool] ?? 0) === 0) continue;  // scenario Scale gate, as for classes
      if (hClassArr.some(e => e.name === chosen && (e.level || 0) > 0)) continue;  // subsumed
      const st = stats[map.pool] || {};
      if (!pools[map.pool]) pools[map.pool] = { tokens: new Map(), classes: [], maxPowerLvl: st.maxPowerLvl || 0, powersKnownTotal: st.powersKnownTotal || 0,
      // v8.33.0 (Adam's Heinrix Sorcerer report): spontaneous SPELL casters'
      // knowns live in spellsKnown[] (per spell level), not powersKnownTotal —
      // the pools map never carried them, so every Sorcerer/Bard pool read
      // "no limit" since v8.5.x. Carried now for the known-count budget.
      spellsKnownTotal: (st.spellsKnown || []).reduce((s, n) => s + (n || 0), 0),
      spellsKnownByLvl: (st.spellsKnown || []).slice() };
      const p = pools[map.pool];
      p.classes.push(chosen);
      if (chosen === 'Cleric') {
        if (druidVariant) { if (!p.tokens.has('Drd')) p.tokens.set('Drd', null); }
        else if (!p.tokens.has('Clr')) p.tokens.set('Clr', null);
        continue;
      }
      if (chosen === 'Saint') {
        if (!p.tokens.has('Clr')) p.tokens.set('Clr', map.advisory);
        continue;
      }
      if (chosen === 'Psion') {
        for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, null);
        const disc = c && c.psionDiscipline;
        if (disc && map.disciplineTokens.includes(disc)) {
          if (!p.tokens.has(disc)) p.tokens.set(disc, null);
        } else {
          for (const t of map.disciplineTokens) if (!p.tokens.has(t)) p.tokens.set(t, 'discipline power — requires the matching Psion discipline (GM confirm)');
        }
        continue;
      }
      for (const t of map.tokens) if (!p.tokens.has(t)) p.tokens.set(t, map.advisory || null);
      if (map.psionicOnly) {
        p._psionicOnlyTokens = p._psionicOnlyTokens || new Set();
        for (const t of map.tokens) p._psionicOnlyTokens.add(t);
      }
      // Lets a Heritage-granted Sor/Wiz route (Sorcerer/Bard pick) lift a real
      // specialist Wizard's school hard-block, same as a Sorcerer class would.
      if (map.pool === 'arcane' && map.tokens.includes('Sor/Wiz')) arcaneContribs.push(chosen);
    }
  }
  // v8.5.4: specialist Wizard prohibited schools — hard-block only when no
  // OTHER class also reaches the Sor/Wiz token (a Wizard/Sorcerer multiclass
  // still reaches a prohibited school through the Sorcerer side).
  if (pools.arcane && c && (c.wizardProhibited || []).length
      && arcaneContribs.includes('Wizard')
      && !arcaneContribs.some(n => n !== 'Wizard')) {
    pools.arcane._wizProhibited = new Set(c.wizardProhibited);
  }
  // v8.5.4: Expanded Knowledge feat picks — the HH-sanctioned bypass for
  // discipline gating. Each instance's param names a specific power.
  if (pools.psionic && c) {
    const names = ((c.feats || []).filter(f => (f.name || f.n) === 'Expanded Knowledge' && f.param).map(f => f.param));
    if (names.length) pools.psionic._expandedNames = new Set(names);
  }
  return pools;
}

// v8.6.0 split (Adam): per-side entitlements. Spells = arcane/divine;
// Powers = psionic/super. Records already on the ledger always show their
// side's tab (legacy/GM-exception safety), matching the old unified rule.
function characterIsEntitledToSpells(c) {
  if (!c) return false;
  if (getCharPowers(c).some(p => p.pool === 'arcane' || p.pool === 'divine')) return true;
  const pi = getCasterPoolsInfo(c);
  return !!(pi.arcane || pi.divine);
}
function characterIsEntitledToPowers(c) {
  if (!c) return false;
  if (getCharPowers(c).some(p => p.pool === 'psionic' || p.pool === 'super')) return true;
  // v8.5.3: super-mutants browse/buy super-powers here even with no caster pool.
  if (hasFeatNamed(c, 'Supernatural Mutation')) return true;
  return !!getCasterPoolsInfo(c).psionic;
}

// For one SPELLS_DB entry: every (pool, token, level) route this character
// could take it through, gated later against maxPowerLvl at add time.
function spellPoolOptions(spell, poolsInfo) {
  const opts = [];
  for (const pool in poolsInfo) {
    const pi = poolsInfo[pool];
    for (const l of (spell.levels || [])) {
      if (!pi.tokens.has(l.cls)) continue;
      // v8.5.4: 'War' disambiguation — psionic-pool 'War' (Warmind) routes
      // require a psionic power; divine-pool 'War' (the War domain) routes
      // require a magic spell.
      if (l.cls === 'War') {
        const psionic = isPsionicSpell(spell);
        if (pool === 'psionic' && !psionic) continue;
        if (pool === 'divine' && psionic) continue;
      }
      // v8.5.4: specialist Wizard prohibited schools — no route at all (HH:
      // "can't even cast such spells from scrolls").
      if (pool === 'arcane' && pi._wizProhibited && l.cls === 'Sor/Wiz'
          && pi._wizProhibited.has(spellSchool(spell))) continue;
      const advisory = pi.tokens.get(l.cls);
      opts.push({ pool, token: l.cls, lvl: l.lvl, lvl_max: l.lvl_max, applies: l.applies, advisory, overMax: l.lvl > pi.maxPowerLvl });
    }
  }
  // v8.5.4: a configured Saint may take any Cleric-list spell as a Personal
  // Domain pick (HH: "may add one spell of their choice … from the Cleric
  // spell list", GM-approved, permanent). Surfaced only when no domain route
  // already reaches the spell; budget enforced at add time.
  if (poolsInfo.divine && poolsInfo.divine._saintConfigured) {
    const clr = (spell.levels || []).find(l => l.cls === 'Clr');
    if (clr && !opts.some(o => o.pool === 'divine')) {
      opts.push({ pool: 'divine', token: 'Clr', lvl: clr.lvl, lvl_max: clr.lvl_max, applies: clr.applies,
                  advisory: null, personal: true, overMax: clr.lvl > poolsInfo.divine.maxPowerLvl });
    }
  }
  // v8.5.4: Expanded Knowledge — a named-power pick reaches the psionic pool
  // even when discipline gating (or list membership) excludes it. Route level
  // = the spell's lowest listed level.
  if (poolsInfo.psionic && poolsInfo.psionic._expandedNames
      && poolsInfo.psionic._expandedNames.has(spell.name)
      && !opts.some(o => o.pool === 'psionic')) {
    const lvls = (spell.levels || []).map(l => l.lvl).filter(n => typeof n === 'number');
    const lvl = lvls.length ? Math.min(...lvls) : 1;
    opts.push({ pool: 'psionic', token: 'Expanded Knowledge', lvl, advisory: null, overMax: lvl > poolsInfo.psionic.maxPowerLvl });
  }
  return opts;
}

// v8.13.0 (Adam's Rhad report): Expanded Knowledge is "ADD to your powers
// known" (HH p.215) — the pick lands in the repertoire automatically as a
// BONUS known power, 1:1 with the feat instances. Reconciler pattern (like
// reconcileGrantedFeats): adds missing grants, removes orphans when the feat
// (or its param) goes away, leaves player-learned copies alone. Also
// self-heals free-text-era params by canonicalizing case-insensitively
// against SPELLS_DB (the picker was a text line before v8.13.0).
function reconcileExpandedKnowledgePowers(c) {
  if (!c) return false;
  let changed = false;
  const want = new Map();  // canonical name → spell
  for (const f of (c.feats || [])) {
    if ((f.name || f.n) !== 'Expanded Knowledge' || !f.param) continue;
    let sp = SPELLS_DB.find(s => s.name === f.param);
    if (!sp) {
      const low = String(f.param).trim().toLowerCase();
      sp = SPELLS_DB.find(s => s.name.toLowerCase() === low);
      if (sp) { f.param = sp.name; changed = true; }  // canonicalize the old free-text param
    }
    if (sp) want.set(sp.name, sp);
  }
  if (!c.powers) c.powers = [];
  for (const [nm, sp] of want) {
    if (!c.powers.some(p => p.pool === 'psionic' && p.name === nm)) {
      const ls = (sp.levels || []).map(l => l.lvl).filter(n => typeof n === 'number');
      c.powers.push({ name: nm, pool: 'psionic', token: 'Expanded Knowledge', lvl: ls.length ? Math.min(...ls) : 1,
                      via: 'Expanded Knowledge', grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } });
      changed = true;
    }
  }
  const before = c.powers.length;
  c.powers = c.powers.filter(p => !(p.via === 'Expanded Knowledge' && !want.has(p.name)));
  if (c.powers.length !== before) changed = true;
  return changed;
}

function getPowersBudget(c) {
  const pools = getCasterPoolsInfo(c);
  const out = {};
  for (const pool in pools) {
    // v8.13.0: Expanded Knowledge grants are BONUS powers known — they never
    // consume the class's powers-known budget.
    const picked = getCharPowers(c).filter(p => p.pool === pool && p.via !== 'Expanded Knowledge').length;
    // v8.33.0 (Heinrix's Sorcerer): the known cap = psionic powersKnown PLUS
    // spontaneous-caster spells known (Sorcerer/Bard matrices) — the latter
    // was never counted, so arcane pools read "no limit". Prepared casters
    // (Wizard/Cleric/Ranger) contribute no matrix and correctly stay
    // unlimited; Saints know all their domains' spells — also no cap.
    const knownCap = (pools[pool].powersKnownTotal || 0) + (pools[pool].spellsKnownTotal || 0);
    const total = knownCap > 0 ? knownCap : null; // null = no limit
    out[pool] = { picked, total, maxPowerLvl: pools[pool].maxPowerLvl, classes: pools[pool].classes,
                  knownByLvl: pools[pool].spellsKnownByLvl || [] };
  }
  return out;
}

// ----- add / remove (index-based handlers; spell names contain quotes) -----
let _pwBrowseList = [];
// v8.6.0 split (Adam): the powers page renders in one of two MODES — 'spells'
// (arcane/divine side: EAL/EDL, prep panel, domain powers) or 'powers'
// (psionic/super side: EPL/ESL, disciplines, super purchases). One unified
// page DOM and SPELLS_DB underneath (the HH's own Ch.IX unification); the
// mode filters presentation. showPage('spells') sets the mode.
let _pwMode = 'powers';
const _pwModePools = () => _pwMode === 'spells' ? ['arcane', 'divine'] : ['psionic', 'super'];
// Context label parts, alphabetical like the Scales themselves (Adam's
// ruling): "Arcane / Divine Spells", "Psionic / Super Powers".
function _pwSideLabel(c, mode) {
  const parts = [];
  try {
    const pi = getCasterPoolsInfo(c);
    if (mode === 'spells') {
      if (pi.arcane) parts.push('Arcane');
      if (pi.divine) parts.push('Divine');
    } else {
      if (pi.psionic) parts.push('Psionic');
      if (getMPState(c).isSuperMutant) parts.push('Super');
    }
  } catch (e) {}
  const noun = mode === 'spells' ? 'Spells' : 'Powers';
  return parts.length ? parts.join(' / ') + ' ' + noun : noun;
}
// v8.5.4 ergo C1: catalogue starts collapsed; render only while open (the
// 120-row list is the tab's heaviest block).
let _pwBrowseOpen = false;
function togglePwBrowse() {
  _pwBrowseOpen = !_pwBrowseOpen;
  const wrap = document.getElementById('pw-browse-wrap');
  const btn = document.getElementById('pw-browse-toggle');
  if (wrap) wrap.style.display = _pwBrowseOpen ? 'block' : 'none';
  if (btn) btn.textContent = _pwBrowseOpen ? '▴ Hide the Catalogue' : `⌕ Browse the Catalogue (${SPELLS_DB.length})`;
  const cnt = document.getElementById('pw-browse-count');
  if (cnt) cnt.textContent = `(${SPELLS_DB.length} entries)`;
  if (_pwBrowseOpen) {
    renderPowersBrowse();
    const el = document.getElementById('pw-browse-wrap');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
const _pwExpandedBrowse = new Set();
const _pwExpandedKnown = new Set();

async function addPowerFromBrowse(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const spell = _pwBrowseList[idx]; if (!spell) return;
  if (!c.powers) c.powers = [];
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.6.0 split: adding from a mode's browse offers only that side's routes.
  let opts = spellPoolOptions(spell, poolsInfo).filter(o => _pwModePools().includes(o.pool));
  if (!opts.length) { toast(`No ${_pwMode === 'spells' ? 'spellcasting' : 'manifesting'} pool of this character can reach that entry.`); return; }
  // Collapse to one option per pool (best = lowest level route).
  const byPool = {};
  for (const o of opts) if (!byPool[o.pool] || o.lvl < byPool[o.pool].lvl) byPool[o.pool] = o;
  opts = Object.values(byPool).filter(o => !c.powers.some(p => p.name === spell.name && p.pool === o.pool));
  if (!opts.length) { toast(`${spell.name} is already known in every eligible pool.`); return; }
  const pick = (chosen) => finishAddPower(c, spell, chosen);
  if (opts.length === 1) { pick(opts[0]); return; }
  openChoiceModal(`${spell.name} — add to which pool?`,
    opts.map(o => {
      const nm = displayNameForRoute(spell, o);
      return `${o.pool} (${o.token} ${o.lvl}${o.lvl_max ? '-' + o.lvl_max : ''})${nm !== spell.name ? ` — as “${nm}”` : ''}`;
    }),
    (sel) => { const o = opts.find(x => sel.startsWith(x.pool)); if (o) pick(o); });
}

// v8.34.0 (Adam): how many known picks the character holds at each spell
// level in a pool — Gate 2.5's counterpart to the matrix split. Records store
// their route level since v8.5.4 (rec.lvl); older records fall back to the
// entry's lowest printed level. Expanded Knowledge grants are bonus knowns
// and never count against the split.
function knownPickedByLevel(c, pool) {
  const out = [];
  for (const p of getCharPowers(c)) {
    if (p.pool !== pool || p.via === 'Expanded Knowledge') continue;
    let lvl = (typeof p.lvl === 'number') ? p.lvl : null;
    if (lvl === null) {
      const s = SPELLS_DB.find(x => x.name === p.name);
      const ls = s ? (s.levels || []).map(l => l.lvl).filter(n => typeof n === 'number') : [];
      lvl = ls.length ? Math.min(...ls) : 0;
    }
    out[lvl] = (out[lvl] || 0) + 1;
  }
  return out;
}
async function finishAddPower(c, spell, opt) {
  // Gate 1: pool max power level (min level of a ranged entry is the gate).
  const budget = getPowersBudget(c)[opt.pool] || { maxPowerLvl: 0, picked: 0, total: null };
  if (opt.lvl > budget.maxPowerLvl) {
    if (!(await confirmModal(
      `"${spell.name}" is level ${opt.lvl} (${opt.token}), but this character's ${opt.pool} pool can only cast up to level ${budget.maxPowerLvl}.\n\nAdd anyway as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `level ${opt.lvl} > ${opt.pool} max castable ${budget.maxPowerLvl}`);
  }
  // Gate 2: known-count budget (null = no limit — prepared casters, Saints).
  // v8.33.0: now covers spontaneous SPELL casters too (Sorcerer/Bard) — their
  // matrices finally feed the total (they read "no limit" since v8.5.x).
  if (budget.total !== null && budget.picked >= budget.total) {
    if (!(await confirmModal(
      `${opt.pool} powers-known budget is full (${budget.picked}/${budget.total}).\n\nAdding "${spell.name}" exceeds it. Proceed as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `powers known ${budget.picked + 1} > budget ${budget.total} (${opt.pool})`);
  }
  // Gate 2.5 (v8.34.0, Adam's ruling): the PER-SPELL-LEVEL knowns split is
  // enforced for pools with a spells-known matrix (Sorcerer / Bard — the
  // complete set: psionic classes use flat XPH-style counts by design,
  // prepared casters and Saints have no known cap at all). Five cantrips are
  // not nine free-floating picks. Skipped when Gate 1 already fired for the
  // level (no double prompt for an over-max pick).
  {
    const kbl = budget.knownByLvl || [];
    if (kbl.some(n => n > 0) && opt.lvl <= budget.maxPowerLvl) {
      const at = (knownPickedByLevel(c, opt.pool)[opt.lvl] || 0);
      const allowed = kbl[opt.lvl] || 0;
      if (at >= allowed) {
        const lvlName = opt.lvl === 0 ? 'cantrip (0-level)' : `level-${opt.lvl}`;
        if (!(await confirmModal(
          `The ${opt.pool} ${lvlName} spells-known slots are full (${at}/${allowed}).\n\nAdding "${spell.name}" at level ${opt.lvl} exceeds the printed split. Proceed as a GM-approved exception?`))) return;
        logPowerException(c, spell.name, `level-${opt.lvl} knowns ${at + 1} > split ${allowed} (${opt.pool})`);
      }
    }
  }
  // Gate 3 (v8.5.4): Saint Personal Domain — one pick at 3rd and every odd
  // Saint level after; each is a permanent, deity-approved (= GM-approved)
  // addition to the Saint's spell list.
  if (opt.personal) {
    const pools = getCasterPoolsInfo(c);
    const pb = (pools.divine && pools.divine._saintPersonalBudget) || 0;
    const used = (c.powers || []).filter(p => p.personal).length;
    if (used >= pb) {
      if (!(await confirmModal(
        `"${spell.name}" would be Personal Domain pick #${used + 1}, but this Saint has only ${pb} (one at 3rd and every odd level after).\n\nProceed as a GM-approved exception?`))) return;
      logPowerException(c, spell.name, `Personal Domain picks ${used + 1} > budget ${pb}`);
    } else if (!(await confirmModal(
      `Add "${spell.name}" as a Personal Domain spell (pick ${used + 1} of ${pb})?\n\nPersonal Domain additions are permanent once approved by your deity (the GM).`))) return;
  }
  const rec = { name: spell.name, pool: opt.pool, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } };
  if (opt.advisory) rec.advisory = opt.advisory;
  if (opt.personal) rec.personal = true;
  // v8.5.4: remember the granting route so the known list can render the
  // source-sensitive name ("Build Database" for a Technology-domain pick).
  if (opt.token) { rec.token = opt.token; rec.lvl = opt.lvl; }
  if (opt.applies) rec.applies = opt.applies;
  c.powers.push(rec);
  save(); renderPowers();
  const shown = displayNameForRoute(spell, opt);
  toast(`Added ${shown}${shown !== spell.name ? ` (${spell.name})` : ''} (${opt.pool}${opt.personal ? ' · Personal Domain' : ''}).`);
}

function logPowerException(c, name, why) {
  if (!c.gmExceptions) c.gmExceptions = [];
  const target = `Power/Spell: ${name}`;
  if (!c.gmExceptions.find(e => e.target === target)) {
    c.gmExceptions.push({ type: 'power', target, missing: [why], grantedAt: new Date().toLocaleDateString() });
  }
}

async function removePowerAt(idx) {
  const c = chars.find(x => x.id === curId); if (!c || !c.powers) return;
  const p = c.powers[idx]; if (!p) return;
  // v8.13.0: an Expanded Knowledge grant is 1:1 with its feat instance — the
  // reconciler would just re-add it. Remove the feat to withdraw the power.
  if (p.via === 'Expanded Knowledge') {
    toast(`${p.name} is granted by the Expanded Knowledge feat — remove that feat instance (Feats tab) to withdraw it.`);
    return;
  }
  // v8.5.3: a bought super-power may carry complimentary free children
  // (mp_note "includes X") — removing the parent removes the whole bundle.
  const children = (p.pool === 'super' && !p.free)
    ? c.powers.filter(x => x.pool === 'super' && x.free && x.via === p.name)
    : [];
  const msg = children.length
    ? `Remove ${p.name} (${p.pool})? Its ${children.length} complimentary power${children.length > 1 ? 's' : ''} (${children.map(x => x.name).join(', ')}) will be removed too.`
    : `Remove ${p.name} (${p.pool})?`;
  if (!(await confirmModal(msg))) return;
  c.powers = c.powers.filter((x, i) => i !== idx && !children.includes(x));
  save(); renderPowers();
  toast(`Removed ${p.name}${children.length ? ` (+${children.length} complimentary)` : ''}.`);
}

function togglePwBrowseDetail(idx) {
  const s = _pwBrowseList[idx]; if (!s) return;
  _pwExpandedBrowse.has(s.name) ? _pwExpandedBrowse.delete(s.name) : _pwExpandedBrowse.add(s.name);
  renderPowersBrowse();
}
function togglePwKnownDetail(key) {
  _pwExpandedKnown.has(key) ? _pwExpandedKnown.delete(key) : _pwExpandedKnown.add(key);
  renderPowers();
}

