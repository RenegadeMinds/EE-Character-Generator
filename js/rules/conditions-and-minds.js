// =============================================================================
// js/rules/conditions-and-minds.js
// CONDITIONS AND MINDS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. The Mind's Ledger (insanity and horror): tiers, packages and
//   rolls.
//
// KEY NAMES (so you can search for them)
//   functions (7): mindOf, mindTier, mindLevelRow, mindPackage,
//   mindDiceText, mindRoll1, mindZeroAttr
//
// WHERE IT CAME FROM
//   Gathered from js/rules/10-minds-ledger-and-magic-browser.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ============================================================================
// v8.46.0: 🧠 THE MIND'S LEDGER — tooling for the printed Insanity & Horror
// system, built against the 2026-09-28 synthesis (GMG pp.144-150 / FF
// pp.529-532): base DC 10; five categories (Scale belief / Character Level
// gap / Size / Trauma / Insanities), AT MOST ONE ROW PER CATEGORY, categories
// stack, the insanity row stacks per insanity; known-Scale-5 exemption;
// perceived-Scale RATCHET (horror educates); made save = inured vs that
// (type of) Horror; failed save = one-time +4 COMPETENCE until a save or the
// Horror's defeat; witnessed defeat = inured; Shock (the Swoon): awe-lane
// attribute-zero may faint instead of breaking — wake at half score (round
// up), no insanity, one faint per full recovery.
function mindOf(c) {
  if (!c.mind || typeof c.mind !== 'object') c.mind = {};
  const m = c.mind;
  if (!m.per || typeof m.per !== 'object') {
    // Perceived Scales default to the scenario's actual Scales — most
    // characters know their own world; the ratchet exists for the naive
    // and for cross-world travel (the gap is measured vs BELIEF, not fact).
    const sl = c.sixLevels || {};
    m.per = { arcane: sl.arcane || 0, divine: sl.divine || 0,
              mutation: sl.mutation || 0, psionic: sl.psionic || 0,
              tech: sl.tech || 0 };
  }
  // v8.48.1 (Adam): the Tech axis joins the Horror types — self-heal saves
  // from before it existed (a medieval mind watching a mecha drop from
  // orbit is an incomprehension event like any other).
  if (typeof m.per.tech !== 'number') m.per.tech = (c.sixLevels || {}).tech || 0;
  if (!Array.isArray(m.faced)) m.faced = [];
  // v8.49.0 (Adam's half-floor ruling): the mental-damage POOL — [Int, Wis,
  // Cha] damage totals. The CLOCK runs against the full base attribute
  // (c.attrs; item/buff boosts don't extend sanity); the PLAYED value is
  // clamped in effAttrs at half normal (round up) — frayed, not broken —
  // until the clock hits zero and the mind must Break or Swoon.
  if (!Array.isArray(m.mdmg)) m.mdmg = [0, 0, 0];
  if (typeof m.swoonLock !== 'boolean') m.swoonLock = false;
  if (typeof m.ins !== 'number') m.ins = 0;
  // v8.46.3 self-heal: tier is DERIVED from the count — resync any state
  // saved by the pre-fix build (where + and − could desync them).
  m.tier = Math.min(3, m.ins);
  if (!m.calc || typeof m.calc !== 'object') m.calc = { axis: 'arcane', ev: '', hl: '', size: 'na', maim: false, name: '' };
  return m;
}
function mindTier(m) { return Math.min(3, m.ins || 0); }
function mindLevelRow(gap) {
  if (gap >= 10) return { dc: 8, dmg: '2d3', lbl: '10+ levels higher' };
  if (gap >= 7)  return { dc: 6, dmg: '1d4+1', lbl: '7-9 levels higher' };
  if (gap >= 4)  return { dc: 4, dmg: '1d3+1', lbl: '4-6 levels higher' };
  if (gap >= 1)  return { dc: 2, dmg: '1d3', lbl: '1-3 levels higher' };
  return null;
}
// The whole package for the current calculator inputs — one place computes,
// the render and the outcome buttons both consume it.
function mindPackage(c) {
  const m = mindOf(c), q = m.calc;
  const rows = [], dice = [];
  // SCALE (belief) category — vs the witness's PERCEIVED Scale on the axis.
  const per = m.per[q.axis] || 0;
  const ev = q.ev === '' ? null : parseInt(q.ev, 10);
  if (ev !== null && !isNaN(ev)) {
    if (per >= 5) rows.push({ cat: 'Scale', lbl: `known Scale-5+ (${q.axis}) — exempt`, dc: 0, dmg: '' });
    else if (ev > per) {
      const r = per === 0 ? { dc: 4, dmg: '1d4', lbl: 'beyond perceived Scale 0' }
                          : { dc: 1, dmg: '1d2', lbl: 'beyond perceived Scale 1+' };
      rows.push({ cat: 'Scale', lbl: `${r.lbl} (${q.axis} ${per} vs event ${ev})`, dc: r.dc, dmg: r.dmg });
      if (r.dmg) dice.push(r.dmg);
    }
  }
  // CHARACTER LEVEL category.
  const lvl = c.totalLvl || (c.classes || []).reduce((s, e) => s + (e.level || 0), 0) || 1;
  const hl = q.hl === '' ? null : parseInt(q.hl, 10);
  if (hl !== null && !isNaN(hl)) {
    const r = mindLevelRow(hl - lvl);
    if (r) { rows.push({ cat: 'Level', lbl: `${r.lbl} (their ${hl} vs level ${lvl})`, dc: r.dc, dmg: r.dmg }); dice.push(r.dmg); }
  }
  // SIZE category.
  const sr = MIND_SIZE_ROWS.find(r => r.k === q.size) || MIND_SIZE_ROWS[0];
  if (sr.k !== 'na') { rows.push({ cat: 'Size', lbl: sr.lbl, dc: sr.dc, dmg: sr.dmg }); if (sr.dmg) dice.push(sr.dmg); }
  // TRAUMA category.
  if (q.maim) { rows.push({ cat: 'Trauma', lbl: 'graphic maiming / death witnessed', dc: 5, dmg: '1d3' }); dice.push('1d3'); }
  // INSANITIES (always stacks, +1 DC and +1 damage per insanity).
  if (m.ins > 0) rows.push({ cat: 'Insanities', lbl: `${m.ins} insanit${m.ins === 1 ? 'y' : 'ies'}`, dc: m.ins, dmg: `+${m.ins}` });
  // Familiarity: the faced-Horror registry. v8.46.2 (Adam): a prior failure's
  // +4 competence joins the calculus as a plain modifier row (-4 on the DC as
  // displayed — nothing in practice impedes a competence bonus), rather than
  // a separate explanatory note.
  const nm = (q.name || '').trim().toLowerCase();
  const faced = nm ? m.faced.find(f => f.n.toLowerCase() === nm) : null;
  if (faced && faced.s === 'plus4') rows.push({ cat: 'Competence', lbl: `+4 competence vs ${faced.n} (prior failure)`, dc: -4, dmg: '' });
  const dc = 10 + rows.reduce((s, r) => s + r.dc, 0);
  return { rows, dice, flat: m.ins, dc, faced, lvl };
}
function mindDiceText(pk) {
  return pk.dice.length || pk.flat
    ? pk.dice.join(' + ') + (pk.flat ? (pk.dice.length ? ' + ' : '') + pk.flat : '')
    : '—';
}
function mindRoll1(expr) {
  const mt = /^(\d+)d(\d+)([+-]\d+)?$/.exec(expr);
  if (!mt) return parseInt(expr, 10) || 0;
  let t = parseInt(mt[3] || '0', 10);
  for (let i = 0; i < +mt[1]; i++) t += 1 + Math.floor(Math.random() * +mt[2]);
  return t;
}
// v8.49.0: Break/Swoon act on the POOL. Which attribute? The one the last
// failure drove to zero (m.last.k), else the deepest-damaged one.
function mindZeroAttr(c, m) {
  if (m.last && typeof m.last.k === 'number') return m.last.k;
  const base = ['', '', ''].map((_, k) => (c.attrs || [10,10,10,10,10,10])[3 + k] || 10);
  let kw = 0; for (let k = 1; k < 3; k++) if (base[k] - (m.mdmg[k] || 0) < base[kw] - (m.mdmg[kw] || 0)) kw = k;
  return kw;
}
