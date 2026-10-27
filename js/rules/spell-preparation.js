// =============================================================================
// js/rules/spell-preparation.js
// SPELL PREPARATION — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Power-point pools and spell preparation: costs, prepared lists,
//   specialists and metamagic decoration.
//
// KEY NAMES (so you can search for them)
//   functions (21): blendedPoolSetFor, _poolPPRaw, getPoolPPState,
//   _drainPoolLedgers, spendPoolPP, powerCastCost, castCostFor,
//   nonPreppedPoolsInfo, _isInstantSpell, _isSwiftCast, tierDisplayName,
//   schoolDcBonus, prepContributorsOf, prepTokensForCtr, getPreparedList,
//   isSpecialtySpell, prepEligibleFor, specialistFreeUsed, ordinalOf,
//   prepDecoratedName, prepAugFx
//
// WHERE IT CAME FROM
//   Gathered from js/app/56-supernatural-attributes-pools-psi-focus.js when
//   the code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  const perm = permanentPPSpent(c, poolName);
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
function _isInstantSpell(s) { return /^\s*instantaneous/i.test(String((s && s.duration) || '')); }
function _isSwiftCast(s, pool) {
  let ct = String((s && s.casting_time) || '');
  // "(1 swift action as Super-Power)" parentheticals exempt only SUPER casts —
  // the standard-action base casting time still queues behind the gate.
  if (pool !== 'super') ct = ct.replace(/\([^)]*\)/g, '');
  return /(swift|immediate)/i.test(ct);
}
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
  const defs = (AUGMENT_OPTIONS[spell.name]) || null;
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
