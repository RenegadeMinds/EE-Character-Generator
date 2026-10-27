// =============================================================================
// js/rules/10-minds-ledger-and-magic-browser.js
// MINDS LEDGER AND MAGIC BROWSER
// =============================================================================
//
// WHAT'S IN HERE
//   The Mind's Ledger (Insanity & Horror tracking), the magic-item browser and
//   inventory, specific magic arms conversions, and the skill descriptions
//   shown on hover.
//
// KEY NAMES (so you can search for them)
//   tables/objects: MIND_TIERS, MIND_SIZE_ROWS, MAGIC_TYPE_LABELS,
//   MAGIC_PROPERTY_TYPES, SPECIFIC_ARMS_CONVERSIONS, SKILL_DESCS
//   functions (34): mindOf, mindTier, mindLevelRow, mindPackage, mindDiceText,
//   mindRoll1, mindSet, mindPerToggle, mindPer, mindOutcome, mindLastDismiss,
//   mindFacedCycle, mindFacedRemove, mindZeroAttr, mindBreak, mindSwoon,
//   mindDailyRecovery, mindBout, mindInsAdj, renderMindsLedger,
//   buildMagicItemBonuses, parryingHeldBonus, togglePageTut, toggleGearTut,
//   toggleMagicBrowse, toggleMagicDetail, magicPriceLabel, magicItemDesc,
//   renderMagicBrowse, addMagicFromBrowse, renderMagicInventory,
//   scenarioTechScale, displaySkillName, skillHoverText
//
// LOAD ORDER
//   File 10 of 68. index.html loads it after
//   js/rules/09-item-effects-and-buffs.js and before
//   js/rules/11-cybernetics.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 7402-8199 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 7402-8199; unchanged below this line ----
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
// v8.46.3 (Adam's bug report): the TIER IS DERIVED from the insanity count —
// the streamlined rules make them one fact (first break = Mild, second =
// Severe, third+ = Complete), and storing them separately let them desync
// (+ moved the count only, − moved both: ins 1 with tier "sane"). One
// source of truth; m.tier is kept synced on every mutation for save files.
const MIND_TIERS = [
  ['sane', 'No insanities. Mental damage heals at 1 point per day; if a mental attribute reaches 0, the mind must Break — or Swoon, facing awe.'],
  ['Mildly Insane', 'One mental break. The insanity surfaces only under extreme pressure: at 25% or less of total HP, Will DC 15 or suffer a bout of insanity (as the Insanity spell, HH) lasting 10 − best mental modifier rounds. Each insanity also adds +1 to Horror save DCs and +1 to mental damage taken.'],
  ['Severely Insane', 'Two mental breaks. The insanity expresses itself often: at 50% or less of total HP, or on a failed Will save in combat, Will DC 20 or suffer a bout (as the Insanity spell, HH) lasting 20 − best mental modifier rounds. Each insanity adds +1 to Horror save DCs and +1 to mental damage taken.'],
  ['Completely Insane', 'Three or more breaks. Always under the effect of their Insanity (as the spell, HH) — without treatment or restraint, a threat to themselves and those around them. Curing: high magic, or 6 months of counselling (Will DC 30).'],
];
function mindTier(m) { return Math.min(3, m.ins || 0); }
const MIND_SIZE_ROWS = [
  { k: 'na',   lbl: 'no size row (spell / power / unseen)', dc: 0,  dmg: '' },
  { k: 'sm3',  lbl: '3+ sizes smaller',  dc: -4, dmg: '1' },
  { k: 'sm2',  lbl: '2 sizes smaller',   dc: -2, dmg: '1' },
  { k: 'sm1',  lbl: '1 size smaller',    dc: 0,  dmg: '1d2' },
  { k: 'same', lbl: 'same size',         dc: 2,  dmg: '1d3' },
  { k: 'lg1',  lbl: '1 size larger',     dc: 4,  dmg: '1d3+1' },
  { k: 'lg2',  lbl: '2 sizes larger',    dc: 6,  dmg: '1d4+1' },
  { k: 'lg3',  lbl: '3 sizes larger',    dc: 8,  dmg: '2d4' },
  { k: 'lg4',  lbl: '4+ sizes larger',   dc: 10, dmg: '3d4' },
];
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
function mindSet(field, val) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.calc[field] = (field === 'maim') ? !!val : val;
  save(); renderMindsLedger(c);
}
// v8.46.4 (Adam): the perceived-Scale steppers live one click deep — the
// ⚙ chip in the calculator row toggles them. The VALUE for the chosen axis
// stays on the surface (load-bearing input to the DC; the v8.41.0 law:
// hover may hold explanations, never decisions).
function mindPerToggle() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.perOpen = !m.perOpen;
  save(); renderMindsLedger(c);
}
function mindPer(axis, d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.per[axis] = Math.max(0, Math.min(6, (m.per[axis] || 0) + d));
  logAct(`🧠 Perceived ${axis} Scale is now ${m.per[axis]} (the ratchet turns).`);
  save(); renderMindsLedger(c);
}
function mindOutcome(kind) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), pk = mindPackage(c);
  const nm = (m.calc.name || '').trim();
  // v8.46.1 (Adam's field report): each outcome RESOLVES the event — the
  // result is frozen into a persistent aftermath strip (m.last), and the
  // calculator inputs reset so a stale event can't linger and mutate (the
  // post-break insanity +1 was retroactively appearing in the very event
  // that caused the break).
  if (kind === 'save') {
    if (nm) { m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'inured' }); }
    m.last = { kind: 'save', nm, dc: pk.dc };
    logAct(`🧠 Horror save MADE${nm ? ` vs ${nm}` : ''} (DC ${pk.dc}) — inured: no further saves vs that (type of) Horror.`);
  } else if (kind === 'fail') {
    const dmg = pk.dice.reduce((s, e) => s + mindRoll1(e), 0) + pk.flat;
    if (nm && !(pk.faced && pk.faced.s !== 'plus4')) {
      m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'plus4' });
    }
    // v8.49.0: the damage lands in the POOL, assigned to the lowest CURRENT
    // mental attribute (base minus existing pool damage; ties random, per
    // the printed rule). The clock runs on base scores; the half-floor
    // clamp in effAttrs handles the played value automatically.
    const names = ['Int', 'Wis', 'Cha'];
    const base = names.map((_, k) => (c.attrs || [10,10,10,10,10,10])[3 + k] || 10);
    const cur = base.map((b, k) => b - (m.mdmg[k] || 0));
    let k0 = 0; for (let k = 1; k < 3; k++) if (cur[k] < cur[k0]) k0 = k;
    const ties = [0, 1, 2].filter(k => cur[k] === cur[k0]);
    const kp = ties[Math.floor(Math.random() * ties.length)];
    m.mdmg[kp] = (m.mdmg[kp] || 0) + dmg;
    const after = cur[kp] - dmg;
    const plays = Math.max(base[kp] - m.mdmg[kp], Math.ceil(base[kp] / 2));
    m.last = { kind: 'fail', nm, dc: pk.dc, dmg, dice: mindDiceText(pk), attr: names[kp], k: kp,
               before: cur[kp], after: Math.max(0, after), plays, zero: after <= 0 };
    logAct(`🧠 Horror save FAILED${nm ? ` vs ${nm}` : ''} (DC ${pk.dc}) — ${dmg} mental damage (${m.last.dice}) → ${names[kp]} (lowest mental): clock ${cur[kp]} → ${m.last.after}${m.last.zero ? ' — BREAKING POINT: Break or Swoon' : `, plays at ${plays} (half-floor)`}${nm ? '; +4 competence on future saves vs that (type of) Horror until a save is made or it is defeated' : ''}.`);
  } else if (kind === 'defeat') {
    if (nm) { m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'immune' }); }
    m.last = { kind: 'defeat', nm };
    logAct(`🧠 Witnessed the defeat of ${nm || 'the Horror'} — no further Horror saves vs creatures of that type.`);
  }
  // The event has run its course: clear the inputs (axis kept; the named
  // Horror lives on as a registry chip, not as a stale calculation).
  m.calc.ev = ''; m.calc.hl = ''; m.calc.size = 'na'; m.calc.maim = false; m.calc.name = '';
  save(); renderSheet();  // v8.49.0: the pool moves effAttrs — full refresh
}
function mindLastDismiss() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  mindOf(c).last = null; save(); renderMindsLedger(c);
}
function mindFacedCycle(i) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), f = m.faced[i]; if (!f) return;
  f.s = f.s === 'plus4' ? 'inured' : f.s === 'inured' ? 'immune' : 'plus4';
  save(); renderMindsLedger(c);
}
function mindFacedRemove(i) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  mindOf(c).faced.splice(i, 1); save(); renderMindsLedger(c);
}
// v8.49.0: Break/Swoon act on the POOL. Which attribute? The one the last
// failure drove to zero (m.last.k), else the deepest-damaged one.
function mindZeroAttr(c, m) {
  if (m.last && typeof m.last.k === 'number') return m.last.k;
  const base = ['', '', ''].map((_, k) => (c.attrs || [10,10,10,10,10,10])[3 + k] || 10);
  let kw = 0; for (let k = 1; k < 3; k++) if (base[k] - (m.mdmg[k] || 0) < base[kw] - (m.mdmg[kw] || 0)) kw = k;
  return kw;
}
function mindBreak() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  const k = mindZeroAttr(c, m), names = ['Int', 'Wis', 'Cha'];
  m.mdmg[k] = 0;  // the break relieves the pressure: the attribute refreshes in full
  m.ins += 1; m.tier = mindTier(m);
  logAct(`🧠 THE BREAK: an insanity manifests (${m.ins} total; now ${MIND_TIERS[m.tier][0]}) — ${names[k]} refreshes in full as the mental break relieves the pressure.`);
  m.last = null;  // v8.46.1: the aftermath prompt is consumed by the choice
  save(); renderSheet();
}
function mindSwoon() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  if (m.swoonLock) { toast('😵 No second swoon — the valve works once per full recovery. The Break is the only road now.'); return; }
  const k = mindZeroAttr(c, m), names = ['Int', 'Wis', 'Cha'];
  const base = (c.attrs || [10,10,10,10,10,10])[3 + k] || 10;
  m.mdmg[k] = Math.floor(base / 2);  // wakes at half normal, rounded up
  m.swoonLock = true;
  m.last = null;
  const ea = effAttrs(c);
  const best = Math.max(am(ea[3]), am(ea[4]), am(ea[5]));
  const mins = Math.max(1, 10 - best);
  logAct(`🧠 THE SWOON (awe only): unconscious ${mins} min (ally may rouse, standard action); wakes with ${names[k]} at ${Math.max(1, Math.ceil(base / 2))} (half of ${base}, round up), no insanity; cannot swoon again until fully recovered (1/day).`);
  toast(`😵 The Swoon — ${mins} minutes down; wakes at ${names[k]} ${Math.max(1, Math.ceil(base / 2))}.`);
  save(); renderSheet();
}
// One day of natural recovery: 1 point per day per damaged ability (HH);
// the Full Rest button applies it too. The swoon valve re-arms at zero.
function mindDailyRecovery(cArg, quiet) {
  const c = cArg || chars.find(x => x.id === curId); if (!c || !c.mind) return;
  const m = mindOf(c);
  if (!m.mdmg.some(d => d > 0)) return;
  m.mdmg = m.mdmg.map(d => Math.max(0, (d || 0) - 1));
  if (!m.mdmg.some(d => d > 0)) {
    m.swoonLock = false;
    if (!quiet) logAct('🧠 Mental damage fully healed — the mind is whole (the swoon valve re-arms).');
  }
  if (!quiet) logAct(`🌙 A day of recovery: mental damage now Int ${m.mdmg[0]} / Wis ${m.mdmg[1]} / Cha ${m.mdmg[2]}.`);
  save(); if (c.id === curId) renderSheet();
}
function mindBout() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), tier = mindTier(m);
  if (!tier) { toast('No insanity tier — no bouts.'); return; }
  const ea = effAttrs(c);
  const best = Math.max(am(ea[3]), am(ea[4]), am(ea[5]));
  const dc = tier >= 2 ? 20 : 15, dur = Math.max(1, (tier >= 2 ? 20 : 10) - best);
  const trig = tier === 1 ? '≤25% HP' : tier === 2 ? '≤50% HP or a failed Will save in combat' : 'ALWAYS under the effect';
  logAct(`🧠 Bout of insanity check: Will DC ${dc} or a ${dur}-round bout (as the Insanity spell, HH). Trigger at this tier: ${trig}.`);
  save(); renderMindsLedger(c);
}
function mindInsAdj(d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  const was = mindTier(m);
  m.ins = Math.max(0, m.ins + d);
  m.tier = mindTier(m);  // tier derives from the count — one source of truth
  if (m.tier !== was) logAct(`🧠 Sanity ${d > 0 ? 'degrades' : 'improves'}: ${m.ins} insanit${m.ins === 1 ? 'y' : 'ies'} — now ${MIND_TIERS[m.tier][0]}.`);
  save(); renderMindsLedger(c);
}
function renderMindsLedger(c) {
  const slot = document.getElementById('sh-minds');
  if (!slot) return;
  if (!c) { slot.style.display = 'none'; return; }
  const m = mindOf(c), pk = mindPackage(c);
  // v8.46.2 (Adam): tri-state collapse — m.open === false COLLAPSES even a
  // ledger with live state (the old inUse check overrode the ▴, so any
  // character with a chip or an insanity was stuck expanded). The collapsed
  // banner carries the character's current sanity status.
  const inUse = m.faced.length || m.ins || m.tier || m.calc.ev !== '' || m.calc.hl !== '' || m.calc.size !== 'na' || m.calc.maim || (m.calc.name || '') !== '';
  const expanded = m.open === true || (inUse && m.open !== false);
  if (!expanded) {
    const tier = mindTier(m);
    slot.style.display = 'block';
    slot.innerHTML = `<span style="font-size:11.5px;color:var(--ts80);cursor:pointer;" onclick="(function(){const c=chars.find(x=>x.id===curId); if(c){mindOf(c).open=true; save(); renderMindsLedger(c);}})()" title="Horror saves & sanity — open the panel">🧠 ${escapeHTML(c.name)}'s Sanity: <b style="color:${tier ? '#d49a70' : 'var(--ts80)'};cursor:help;" title="${MIND_TIERS[tier][1]}">${MIND_TIERS[tier][0]}</b>${m.faced.length ? ` <span style="opacity:var(--o60);color:var(--dim);">· ${m.faced.length} faced</span>` : ''} ▸</span>`;
    return;
  }
  slot.style.display = 'block';
  const per = m.per, axes = ['arcane', 'divine', 'mutation', 'psionic', 'tech'];
  const axCap = (a) => a[0].toUpperCase() + a.slice(1);
  const stat = { plus4: ['+4', 'var(--g80)', 'failed a save: +4 competence on Horror saves vs it, until a save is made or it is defeated'],
                 inured: ['🛡', 'var(--pb90)', 'made a save: inured — no further saves vs that (type of) Horror'],
                 immune: ['✓', 'rgba(120,205,140,.9)', 'witnessed its defeat: no Horror saves vs creatures of that type'] };
  const facedNote = pk.faced
    ? (pk.faced.s === 'plus4' ? `<b style="color:var(--g90);">+4 competence applies</b> (prior failure vs ${escapeHTML(pk.faced.n)})`
       : pk.faced.s === 'inured' ? `<b style="color:rgba(120,175,205,.95);">inured</b> — no save needed vs ${escapeHTML(pk.faced.n)}`
       : `<b style="color:rgba(120,205,140,.95);">type-immune</b> — no save needed (${escapeHTML(pk.faced.n)} was defeated)`)
    : '';
  slot.innerHTML = `
  <div style="padding:7px 10px;background:rgba(14,18,26,.55);border:1px solid rgba(120,175,205,.28);border-radius:3px;font-size:11.5px;line-height:1.65;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <b style="color:#9cc3da;letter-spacing:.04em;">🧠 ${escapeHTML(c.name)}'s Sanity: <span style="color:${mindTier(m) ? '#d49a70' : '#9cc3da'};cursor:help;" title="${MIND_TIERS[mindTier(m)][1]}">${MIND_TIERS[mindTier(m)][0]}</span></b>
      <b style="cursor:pointer;color:var(--red-text);margin-left:8px;" onclick="(function(){const c=chars.find(x=>x.id===curId); if(c){mindOf(c).open=false; save(); renderMindsLedger(c);}})()" title="Collapse">▴</b>
    </div>
    <div style="font-size:10.5px;color:var(--ts60);" title="At most one row per category; categories stack; the insanity row stacks per insanity.">(Insanity and Horror rules, GMG pp.144-150; the Horror's Scale, Effective Level, Size, Gore Required for DC)</div>
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <div><span style="color:var(--ts75);">Horror Type:</span>
        <select onchange="mindSet('axis',this.value)" style="font-size:11px;">${axes.map(a => `<option value="${a}"${m.calc.axis === a ? ' selected' : ''}>${axCap(a)}</option>`).join('')}</select></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="The Scale of the witnessed power or creature on the chosen axis (a 1st-level spell ≈ Arcane Scale 1; god-tier manifestations = Scale 5+). The row computes against the witness's PERCEIVED Scale — what they believe reality allows: an event beyond a perceived Scale of 1+ adds +1 DC (1d2 damage); beyond a perceived Scale of 0 — no belief at all — adds +4 (1d4). Characters who KNOW they are in a Scale 5+ scenario are exempt. Belief ratchets upward as horror educates: after taking mental damage and recovering, the witness knows — adjust via the ⚙. Blank = no Scale row.">Horror's Scale</span> <input type="number" min="0" max="6" value="${m.calc.ev}" onchange="mindSet('ev',this.value)" style="width:54px;padding:2px 4px;font-size:11px;">
        <span style="cursor:pointer;font-size:10.5px;color:var(--ts65);" onclick="mindPerToggle()" title="What this character believes reality allows on each axis — the ratchet. Click to adjust all five.">(perceived ${per[m.calc.axis] || 0} ⚙)</span></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="How far beyond the witness's own power the being or effect stands: its level/CR (or the effect's caster level) versus this character's total level (${pk.lvl}) — as calculated, or as arbitrary as the GM desires. 1-3 levels higher: +2 DC, 1d3 damage · 4-6 higher: +4, 1d3+1 · 7-9 higher: +6, 1d4+1 · 10+ higher: +8, 2d3. At or below the witness's level: no modifier — power the mind can measure does not crack it. Blank = no Level row.">Horror's Effective Level (GM's discretion)</span> <input type="number" min="0" value="${m.calc.hl}" onchange="mindSet('hl',this.value)" style="width:62px;padding:2px 4px;font-size:11px;"></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="The Horror's size relative to the witness. Small horrors unsettle rather than shatter: 3+ / 2 categories smaller = −4 / −2 DC (1 damage); 1 smaller = +0 (1d2); same size = +2 (1d3); then each step larger climbs +4 / +6 / +8, to +10 DC (3d4) at 4+ categories larger — a Colossal Horror before a Medium witness. Choose 'no size row' for bodiless events: spells, powers, unseen manifestations.">Horror Size</span> <select onchange="mindSet('size',this.value)" style="font-size:11px;">${MIND_SIZE_ROWS.map(r => `<option value="${r.k}"${m.calc.size === r.k ? ' selected' : ''}>${r.lbl}</option>`).join('')}</select></div>
      <div style="margin-top:3px;"><label style="cursor:pointer;" title="The typical roll for witnessing a horrific, graphic scene — a maiming, a death, or an especially gory aspect of the Horror itself (GM's discretion): +5 DC, 1d3 damage."><input type="checkbox" ${m.calc.maim ? 'checked' : ''} onchange="mindSet('maim',this.checked)"> Maiming and/or Gore</label>
        · vs <input type="text" value="${escapeHTML(m.calc.name || '')}" onchange="mindSet('name',this.value)" placeholder="Horror name (registry)" style="width:130px;padding:2px 5px;font-size:11px;"></div>
    </div>
    ${m.perOpen ? `<div style="margin-top:4px;padding:3px 8px;border:1px dashed rgba(120,175,205,.25);border-radius:3px;">
      <span style="color:var(--ts75);" title="What this character BELIEVES reality allows, per axis. Horror DCs measure the gap vs belief, not fact — and belief ratchets upward as horrors educate (after damage + recovery, the witness knows).">Perceived Scales:</span>
      ${axes.map(a => `<span style="margin-left:8px;white-space:nowrap;">${a.slice(0, 3)} <b style="cursor:pointer;color:var(--red-text);" onclick="mindPer('${a}',-1)">−</b> <b style="color:#e8d9a0;">${per[a] || 0}</b> <b style="cursor:pointer;color:#7dc98c;" onclick="mindPer('${a}',1)">+</b></span>`).join('')}
      <span style="margin-left:10px;font-size:10px;color:var(--ts50);">(known 5+ on an axis = exempt from Scale modifiers)</span>
      <b style="cursor:pointer;color:var(--red-text);float:right;" onclick="mindPerToggle()" title="Close">▴</b>
    </div>` : ''}
    <div style="margin-top:5px;">
      ${pk.faced && pk.faced.s !== 'plus4'
        ? facedNote
        : `<b style="color:#e8d9a0;font-size:14px;">Will save DC ${pk.dc}</b> <span style="color:var(--ts60);font-size:10.5px;">(base 10${pk.rows.map(r => ` ${r.dc >= 0 ? '+' : ''}${r.dc} ${r.cat}`).join('')})</span>
           · mental damage on failure: <b style="color:#d49a70;">${mindDiceText(pk)}</b>
           <span style="margin-left:8px;white-space:nowrap;">
             <button onclick="mindOutcome('save')" style="font-size:10.5px;">Saved 🛡</button>
             <button onclick="mindOutcome('fail')" style="font-size:10.5px;">Failed 🎲</button>
             <button onclick="mindOutcome('defeat')" style="font-size:10.5px;">Defeated ✓</button>
           </span>`}
      ${pk.rows.length ? `<div style="font-size:10px;color:var(--ts50);margin-top:2px;">${pk.rows.map(r => `${r.cat}: ${escapeHTML(r.lbl)}`).join(' · ')}</div>` : ''}
    </div>
    ${m.last ? `<div style="margin-top:5px;padding:4px 8px;border:1px solid ${m.last.zero ? 'rgba(212,112,112,.6)' : 'rgba(120,175,205,.35)'};border-radius:3px;${m.last.zero ? 'background:rgba(212,112,112,.07);' : ''}font-size:11px;line-height:1.6;">
      <b style="cursor:pointer;color:var(--red-text);float:right;margin-left:8px;" onclick="mindLastDismiss()" title="Dismiss">✕</b>
      ${m.last.kind === 'fail'
        ? `🎲 <b>vs ${escapeHTML(m.last.nm || 'the Horror')}</b> (DC ${m.last.dc}): <b style="color:var(--red-text);">FAILED</b> — <b>${m.last.dmg}</b> mental damage (${escapeHTML(m.last.dice)}) → <b>${m.last.attr}</b> (lowest mental): clock ${m.last.before} → <b>${m.last.after}</b>. ${m.last.zero
            ? `<b style="color:var(--red-text);">THE MIND IS AT ITS BREAKING POINT</b> — resolve it below: ${m.swoonLock ? `the swoon valve is spent — <b>⚡ Break</b> is the only road.` : `<b>⚡ Break</b> (terror always breaks; facing awe, refusing to fall is allowed) or <b>😵 Swoon</b> (awe only).`}`
            : `Applied automatically — plays at <b>${m.last.plays}</b> (the half-floor: frayed, never below half until the break; heals 1/day).`}`
        : m.last.kind === 'save'
        ? `🛡 <b>vs ${escapeHTML(m.last.nm || 'the Horror')}</b> (DC ${m.last.dc}): <b style="color:#7dc98c;">SAVED</b> — inured: no further Horror saves vs that (type of) Horror.`
        : `✓ <b>${escapeHTML(m.last.nm || 'The Horror')}</b> witnessed defeated — type-immunity: no further Horror saves vs creatures of that type.`}
    </div>` : ''}
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <span style="color:var(--ts75);" title="Failed = +4 competence vs it until a made save or its defeat · Inured (made save) = no further saves vs that (type of) Horror · Type-immune (witnessed defeat). Click a chip to cycle; ✕ removes.">Faced Horrors:</span>
      ${m.faced.length ? m.faced.map((f, i) => `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 4px;padding:2px 7px;border:1px solid ${stat[f.s][1]};border-radius:3px;font-size:11px;cursor:pointer;" title="${stat[f.s][2]}" onclick="mindFacedCycle(${i})">${stat[f.s][0]} ${escapeHTML(f.n)} <b style="color:var(--red-text);" onclick="event.stopPropagation();mindFacedRemove(${i})">✕</b></span>`).join('')
        : `<span style="font-size:10.5px;color:var(--ts45);">none yet — name a Horror above and record the outcome</span>`}
    </div>
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <span style="color:var(--ts75);">Sanity:</span>
      insanities <b style="cursor:pointer;color:var(--red-text);" onclick="mindInsAdj(-1)" title="Remove an insanity (severity follows: Completely → Severely → Mildly Insane → sane). The usual road is counselling — 1/3/6 months by tier, Will DC 20/25/30, +1 per prior timeframe, a 48-hour disruption resets the clock — or high magic (Heal, Wish, Psychic Chirurgery…). Use at your GM's direction.">−</b> <b style="color:#e8d9a0;">${m.ins}</b> <b style="cursor:pointer;color:#7dc98c;" onclick="mindInsAdj(1)" title="At your GM's discretion, extraordinary circumstances may have compromised your character's mental state, degrading their mental health (severity follows: sane → Mildly → Severely → Completely Insane). Only use this button at your GM's direction — the usual road is ⚡ Break, when a mental attribute reaches 0.">+</b>
      · tier: <b style="color:${mindTier(m) ? '#d49a70' : 'var(--ts60)'};cursor:help;" title="${MIND_TIERS[mindTier(m)][1]}">${MIND_TIERS[mindTier(m)][0]}</b>
      <span style="margin-left:8px;white-space:nowrap;">
        <button onclick="mindBout()" style="font-size:10.5px;" title="Bout: Will DC 15 (Mild, at ≤25% HP) / DC 20 (Severe, at ≤50% HP or failed Will in combat); duration 10/20 − best mental mod rounds; Complete = always on">Bout check</button>
        <button onclick="mindBreak()" style="font-size:10.5px;${m.last && m.last.zero ? 'box-shadow:0 0 7px rgba(212,112,112,.85);' : ''}" title="TERROR at attribute 0 (or refusing to fall before awe): the insanity manifests, the attribute refreshes in full">⚡ Break</button>
        <button onclick="mindSwoon()" style="font-size:10.5px;${m.last && m.last.zero ? 'box-shadow:0 0 7px rgba(120,175,205,.85);' : ''}" title="AWE at attribute 0 only: faint — unconscious 10 − best mental mod minutes, wake at HALF the attribute (round up), no insanity; one swoon per full recovery">😵 Swoon</button>
      </span>
      ${m.mdmg.some(d => d > 0) ? `<div style="font-size:10.5px;color:var(--to85);margin-top:3px;">Mental damage: ${['Int', 'Wis', 'Cha'].map((n, k) => { const b = (c.attrs || [10,10,10,10,10,10])[3 + k] || 10; const d = m.mdmg[k] || 0; return d > 0 ? `${n} ${d} (clock ${Math.max(0, b - d)}/${b} · plays at ${Math.max(b - d, Math.ceil(b / 2))})` : null; }).filter(Boolean).join(' · ')}${m.swoonLock ? ' · <span style="opacity:.7;">swoon valve spent</span>' : ''}
        <button onclick="mindDailyRecovery()" style="font-size:10px;" title="One day of natural recovery: 1 point per day per damaged ability (Full Rest applies this too); magical restoration heals it like any ability damage. The swoon valve re-arms at full recovery.">🌙 +1 day</button></div>` : ''}
    </div>
  </div>`;
}

function buildMagicItemBonuses(c) {
  const out = {};
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'magic' || !it.equipped) continue;
    const fx = MAGIC_ITEM_EFFECTS[it.ref];
    if (!fx || fx.attr) continue;
    const v = magicItemEffectValue(it, fx);
    for (const target of (fx.targets || [fx.target])) {
      if (!target) continue;
      (out[target] = out[target] || []).push({
        type: fx.type || 'enhancement', source: 'item:' + it.id,
        value: v, label: it.ref + (it.tier ? ` +${it.tier}` : ''),
      });
    }
  }
  // v9.7.0 (§257, Adam's wiring request): weapon special abilities with
  // PASSIVE wielder effects. PARRYING (imbued, GMG): +1 insight to touch AC,
  // the parry modifier, and Reflex saves whenever the wielder HOLDS the
  // weapon — even flat-footed or surprised. The 'ac' lane feeds the touch
  // tier (computeACDisplay) and 'ref' the save lanes (computeStatBlock);
  // the parry modifier reads parryingHeldBonus directly (computeParryBonus).
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    if (!(it.enchant && (it.enchant.abilities || []).includes('Parrying'))) continue;
    for (const target of ['ac', 'ref']) {
      (out[target] = out[target] || []).push({
        type: 'insight', source: 'item:' + it.id, value: 1,
        label: `Parrying (${enchantDisplayName(it)})`,
      });
    }
  }
  return out;
}
// v9.7.0 (§257): +1 insight per held Parrying weapon (typed: two Parrying
// blades still grant +1 — insight does not self-stack).
function parryingHeldBonus(c) {
  return getCharItems(c).some(it => it.catalogue === 'weapon' && it.equipped && it.enchant && (it.enchant.abilities || []).includes('Parrying')) ? 1 : 0;
}

const MAGIC_TYPE_LABELS = {
  wondrous:'Wondrous', ring:'Ring', rod:'Rod', staff:'Staff', wand:'Wand',
  potion:'Potion/Oil', psicrown:'Psicrown', universal_item:'Universal',
  weapon_ability:'Weapon Property', armor_shield_ability:'Armor/Shield Property',
  specific_weapon:'Specific Weapon', specific_armor:'Specific Armor',
  specific_shield:'Specific Shield', modern:'Modern', cursed:'Cursed',
  artifact:'Artifact', tattoo:'Imbued Tattoo',
  // v9.11.0 (§265): the five ported sections (GMG pp.272-302).
  cognizance_crystal:'Cognizance Crystal', dorje:'Dorje',
  power_stone:'Power Stone', scroll:'Scroll',
};
// Property types are enchantment MODIFIERS applied to a weapon/armor (Price
// +N bonus or gp surcharge) — browsable for reference, not addable as items.
const MAGIC_PROPERTY_TYPES = new Set(['weapon_ability', 'armor_shield_ability']);
// v8.29.0→v8.30.0 (Adam): page-tutorial toggles ("ⓘ HOW THIS PAGE WORKS") —
// one per dense page (gear, powers, tracker). Collapsed by default; each
// page's open/closed choice persists per browser via localStorage (guarded —
// storage can throw in private windows etc.; the toggle works without it).
function togglePageTut(page) {
  const body = document.getElementById(page + '-tut-body');
  const chev = document.getElementById(page + '-tut-chev');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if (chev) chev.textContent = open ? '▾' : '▸';
  try { localStorage.setItem('dxd20v2_ui_' + page + 'TutOpen', open ? '1' : '0'); } catch (e) {}
}
function toggleGearTut() { togglePageTut('gear'); }  // v8.29.0 markup compatibility
// Restore remembered states once the DOM exists (script runs at end of body).
try {
  for (const pg of ['gear', 'powers', 'tracker']) {
    if (localStorage.getItem('dxd20v2_ui_' + pg + 'TutOpen') === '1') {
      const b = document.getElementById(pg + '-tut-body'), ch = document.getElementById(pg + '-tut-chev');
      if (b) b.style.display = 'block';
      if (ch) ch.textContent = '▾';
    }
  }
} catch (e) {}
let _magicBrowseOpen = false, _magicBrowseList = [];
const _magicExpanded = new Set();
function toggleMagicBrowse() {
  _magicBrowseOpen = !_magicBrowseOpen;
  const wrap = document.getElementById('magic-browse-wrap');
  const btn = document.getElementById('magic-browse-toggle');
  if (wrap) wrap.style.display = _magicBrowseOpen ? 'block' : 'none';
  if (btn) btn.textContent = _magicBrowseOpen ? '▴ Hide the Catalogue' : '⌕ Browse Enchanted & Imbued Items (706)';
  if (_magicBrowseOpen) renderMagicBrowse();
}
function toggleMagicDetail(i) {
  const nm = _magicBrowseList[i] && _magicBrowseList[i].name;
  if (!nm) return;
  _magicExpanded.has(nm) ? _magicExpanded.delete(nm) : _magicExpanded.add(nm);
  renderMagicBrowse();
}
function magicPriceLabel(m) {
  if (m.price_bonus) return `+${m.price_bonus} bonus`;
  // v8.7.0: gp/$ prices carry their Purchase DC equivalent (1 gp = $100).
  if (m.price_gp) {
    const dollars = m.type === 'modern' ? m.price_gp : m.price_gp * 100;
    const base = m.type === 'modern' ? `$${m.price_gp.toLocaleString()}` : `${m.price_gp.toLocaleString()} gp`;
    return `${base} · DC ${dcForDollars(dollars)}`;
  }
  if (m.type === 'artifact') return 'priceless';
  return '—';
}
// v9.10.1 (§264): every catalogue row earns its hand cursor. An item's own
// d wins; a spell-vehicle without one (the potions, oils, and wands came
// through the build with empty descriptions) derives its text from the
// spell it carries, looked up in SPELLS_DB at render time. Returns '' when
// nothing can be said — the row then renders without pointer or chevron.
function magicItemDesc(m) {
  if (m.d) return m.d;
  if (m.type !== 'potion' && m.type !== 'wand') return '';
  const base = m.name.replace(/\s*\((?:Potion|Oil|Potion or Oil)\)\s*$/i, '').trim();
  // Legacy 3.5 item names bridge to E&E's merged spell families (§218/§219):
  // "Cure Light Wounds" → "Cure Wounds", "Cure Serious Wounds" → "Cure
  // Wounds (Serious)", "Lesser Restoration" → "Restoration, Lesser".
  const candidates = [base];
  const cw = /^(Cure|Inflict) (Light|Moderate|Serious|Critical) Wounds$/.exec(base);
  if (cw) {
    if (cw[2] !== 'Light') candidates.push(`${cw[1]} Wounds (${cw[2]})`);
    candidates.push(`${cw[1]} Wounds`);
  }
  const lg = /^(Lesser|Greater) (.+)$/.exec(base);
  if (lg) candidates.push(`${lg[2]}, ${lg[1]}`);
  let sp = null;
  {
    for (const cand of candidates) {
      sp = SPELLS_DB.find(s => s.name === cand) || SPELLS_DB.find(s => s.name.toLowerCase() === cand.toLowerCase());
      if (sp) break;
    }
  }
  const vehicle = m.type === 'potion'
    ? 'Single use — a potion (or oil) carrying the spell'
    : 'A charged wand carrying the spell';
  if (sp && sp.d) return `${vehicle} ${base}${m.cl ? ` at ${m.cl_kind || 'CL'} ${m.cl}` : ''}: ${sp.d}`;
  return `${vehicle} ${base} — see its entry in the spell catalogue.`;
}
function renderMagicBrowse() {
  if (!_magicBrowseOpen) return;
  const el = document.getElementById('magic-browse-list'); if (!el) return;
  const q = (document.getElementById('magic-search').value || '').toLowerCase();
  const typeF = document.getElementById('magic-type-filter').value;
  _magicBrowseList = MAGIC_ITEMS_DB.filter(m => {
    if (typeF && m.type !== typeF) return false;
    // v8.8.0 (Adam): weapon/armor special ABILITIES are adjectives, not
    // items — hidden from the default browse (and from searches) unless
    // their type is explicitly selected in the filter, where they serve as
    // reference reading for the ✨ Enchant builder.
    if (!typeF && MAGIC_PROPERTY_TYPES.has(m.type)) return false;
    if (q && !(m.name.toLowerCase().includes(q) || (m.d || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const propBanner = (typeF && MAGIC_PROPERTY_TYPES.has(typeF))
    ? `<div style="padding:6px 9px;font-size:10.5px;color:var(--tb85);border-bottom:1px solid rgba(200,151,30,.1);">These are PROPERTIES, not items — reference reading for the ✨ Enchant / Imbue builder on a weapon or armor inventory row. They cannot be added directly.</div>`
    : '';
  const CAP = 100;
  el.innerHTML = propBanner + _magicBrowseList.slice(0, CAP).map((m, i) => {
    const open = _magicExpanded.has(m.name);
    const isProp = MAGIC_PROPERTY_TYPES.has(m.type);
    // v9.10.1 (§264): the dropdown text — own d, or spell-derived for
    // potions/wands. A row with nothing to say loses the hand cursor.
    const desc = magicItemDesc(m);
    const addBtn = isProp
      ? `<span style="font-size:9px;color:var(--g50);">property — apply via ✨ Enchant on a weapon/armor row (Gear inventory)</span>`
      : `<button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="addMagicFromBrowse(${i})">+ Add${m.type === 'artifact' ? ' (GM)' : ''}</button>`;
    return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="${desc ? 'cursor:pointer;' : ''}flex:1;" ${desc ? `onclick="toggleMagicDetail(${i})"` : ''}><b>${escapeHTML(m.name)}</b>
          <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.3);margin-left:4px;">${MAGIC_TYPE_LABELS[m.type] || m.type}</span>
          <span style="font-size:10px;opacity:var(--o55);color:var(--dim);margin-left:5px;">${m.cl ? (m.cl_kind || 'CL') + ' ' + m.cl + ' · ' : ''}${magicPriceLabel(m)}</span>
          ${desc ? `<span style="font-size:10px;opacity:var(--o40);color:var(--dim);">${open ? '▾' : '▸'}</span>` : ''}</div>
        ${addBtn}
      </div>
      ${m.aura ? `<div style="font-size:10px;opacity:.5;">${escapeHTML(m.aura)}</div>` : ''}
      ${open && desc ? `<div style="font-size:11.5px;margin-top:4px;line-height:1.5;color:var(--parch);">${escapeHTML(desc)}</div>${m.provenance ? `<div style="font-size:10px;opacity:.55;margin-top:3px;">${escapeHTML(m.provenance)}</div>` : ''}` : ''}
    </div>`;
  }).join('') + (_magicBrowseList.length > CAP ? `<div style="padding:6px 9px;font-size:11px;color:var(--g50);text-align:center;">…and ${_magicBrowseList.length - CAP} more — refine the filters.</div>` : '')
  || `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">Nothing matches the filters.</div>`;
}
// ============================================================================
// v8.7.0 (Adam's report: "a Luck Blade doesn't populate as an equippable
// weapon"): SPECIFIC weapons/armors/shields from the magic-item catalogue
// convert into REAL equippable items — base catalogue item + the enchant
// package (or mastercraft-only for the nonmagical special-material pieces:
// adamantine, mithral, darkwood, dragonhide, cold iron, alchemical silver).
// customName preserves the item's identity ("Luck Blade", not "+2 Sword,
// short"); specialNote carries the unique powers (GM adjudicates); the full
// book text stays readable in the magic-item catalogue browse. Items NOT in
// this table (ammunition one-shots, bases missing from the weapon table)
// keep the old magic-trinket behavior.
const SPECIFIC_ARMS_CONVERSIONS = {
  // ---- weapons ----
  'Adamantine Battleaxe':     { cat:'weapon', base:'Battleaxe', mcOnly:true, note:'Adamantine (nonmagical): ignores hardness less than 20; mastercraft +1 attack.' },
  'Adamantine Dagger':        { cat:'weapon', base:'Dagger', mcOnly:true, note:'Adamantine (nonmagical): ignores hardness less than 20; mastercraft +1 attack.' },
  'Assassin’s Dagger':        { cat:'weapon', base:'Dagger', enh:2, note:'+1 to the DC of Fortitude saves forced by your death attacks.' },
  'Dagger of Venom':          { cat:'weapon', base:'Dagger', enh:1, note:'Poison effect 1/day on command (as the spell, DC 14).' },
  'Dwarven Thrower':          { cat:'weapon', base:'Warhammer', enh:2, note:'In dwarven hands: +3, returning when thrown, ×2 dice vs giants.' },
  'Flame Tongue':             { cat:'weapon', base:'Longsword', enh:1, abilities:['Flaming Burst'], note:'Fiery ray 1/day (4d6 fire, 30 ft).' },
  'Frost Brand':              { cat:'weapon', base:'Greatsword', enh:3, abilities:['Frost'], note:'Sheds light below 0°F; extinguishes fires; +1 on saves vs fire.' },
  'Holy Avenger':             { cat:'weapon', base:'Longsword', enh:2, note:'Cold iron. In a paladin’s hands: +5 holy; grants SR 5 + paladin level; dispel magic at will (see text).' },
  'Life-Drinker':             { cat:'weapon', base:'Greataxe', enh:1, note:'Bestows negative levels on foes AND drains the wielder (see text — favored by undead).' },
  'Luck Blade':               { cat:'weapon', base:'Sword, short', enh:2, note:'+1 luck bonus on ALL saving throws; holds wishes (GM sets remaining).' },
  'Mace of Smiting':          { cat:'weapon', base:'Mace, heavy', enh:3, note:'Adamantine; +5 vs constructs (crits can destroy them); ×4 crit vs outsiders.' },
  'Mace of Terror':           { cat:'weapon', base:'Mace, heavy', enh:2, note:'Fear aura on command 3/day (as Fear, DC 16).' },
  'Masterwork Cold Iron Longsword': { cat:'weapon', base:'Longsword', mcOnly:true, note:'Cold iron (nonmagical): beats DR/cold iron; mastercraft +1 attack.' },
  'Nine Lives Stealer':       { cat:'weapon', base:'Longsword', enh:2, note:'Can draw the life force on a crit (9 charges, Fort negates — see text).' },
  'Oathbow':                  { cat:'weapon', base:'Longbow, composite', enh:2, note:'Elven make. Sworn enemy: +2 atk / +2d6 vs the oath target (see text).' },
  'Rapier of Puncturing':     { cat:'weapon', base:'Rapier', enh:2, abilities:['Wounding'], note:'Touch attack 3/day dealing 1d6 Con damage.' },
  'Shatterspike':             { cat:'weapon', base:'Longsword', enh:1, note:'With Improved Sunder: +4 atk/dmg vs objects and when sundering.' },
  'Silver Dagger, Masterwork': { cat:'weapon', base:'Dagger', mcOnly:true, note:'Alchemical silver (nonmagical): beats DR/silver; −1 damage; mastercraft +1 attack.' },
  'Sun Blade':                { cat:'weapon', base:'Sword, bastard', enh:2, note:'Wielded as a short sword (Weapon Finesse applies); +4 vs evil; sunlight blade powers (see text).' },
  'Sword of Life Stealing':   { cat:'weapon', base:'Longsword', enh:2, note:'Bestows a negative level on a crit; wielder gains 1d6 temp HP.' },
  'Sword of the Planes':      { cat:'weapon', base:'Longsword', enh:1, note:'+2 on Elemental Planes, +3 Astral/Ethereal, +4 Outer Planes.' },
  'Sword of Subtlety':        { cat:'weapon', base:'Sword, short', enh:1, note:'+4 attack AND damage on sneak attacks.' },
  'Trident of Fish Command':  { cat:'weapon', base:'Trident', enh:1, note:'Charm aquatic animals 3/day (see text); 6-ft haft.' },
  'Trident of Warning':       { cat:'weapon', base:'Trident', enh:2, note:'Detect aquatic predators within 680 ft (see text).' },
  // ---- armor ----
  'Adamantine Breastplate':   { cat:'armor', base:'Breastplate', mcOnly:true, note:'Adamantine (nonmagical): DR 2/—; Hardness 20, 100 HP.' },
  'Banded Mail of Luck':      { cat:'armor', base:'Banded mail', enh:3, note:'1/week: force a foe to reroll one successful attack against you.' },
  'Breastplate of Command':   { cat:'armor', base:'Breastplate', enh:2, note:'+2 Cha; +2 Diplomacy; allies within 30 ft get +1 morale vs fear.' },
  'Celestial Armor':          { cat:'armor', base:'Chainmail', enh:3, note:'So fine it counts as LIGHT armor (max Dex +8, ACP −2); Fly 1/day.' },
  'Demon Armor':              { cat:'armor', base:'Full plate', enh:4, note:'Demon-visaged; claw attacks 1d10 with Contagion on hit (see text).' },
  'Dragonhide Plate':         { cat:'armor', base:'Full plate', mcOnly:true, note:'Dragonhide (nonmagical): no metal — druids can wear it.' },
  'Dwarven Plate':            { cat:'armor', base:'Full plate', mcOnly:true, note:'Adamantine (nonmagical): DR 3/—.' },
  'Elven Chain':              { cat:'armor', base:'Chainmail', mcOnly:true, note:'Mithral (nonmagical): counts as LIGHT armor; speed 30 ft; ACP −2 total.' },
  'Mithral Full Plate of Speed': { cat:'armor', base:'Full plate', enh:1, note:'Mithral (counts as medium); Haste 1/day for 10 rounds on command.' },
  'Mithral Shirt':            { cat:'armor', base:'Chain shirt', mcOnly:true, note:'Mithral (nonmagical): counts as LIGHT armor; no speed reduction.' },
  'Plate Armor of the Deep':  { cat:'armor', base:'Full plate', enh:1, note:'Weightless in water; breathe underwater; speak to water-breathers.' },
  'Rhino Hide':               { cat:'armor', base:'Hide', enh:2, note:'+2d6 damage on any successful charge attack you make.' },
  // ---- shields ----
  'Absorbing Shield':         { cat:'armor', base:'Shield, heavy steel', enh:1, note:'1/2 days on command: disintegrate a touched object (see text).' },
  'Caster’s Shield':          { cat:'armor', base:'Shield, light wooden', enh:1, note:'Leather strip holds one scribed spell (see text).' },
  'Darkwood Buckler':         { cat:'armor', base:'Buckler', mcOnly:true, note:'Darkwood (nonmagical): half weight, no ACP.' },
  'Darkwood Shield':          { cat:'armor', base:'Shield, heavy wooden', mcOnly:true, note:'Darkwood (nonmagical): half weight, no ACP.' },
  'Lion’s Shield':            { cat:'armor', base:'Shield, heavy steel', enh:2, note:'Lion’s head bites 3/day as a free action (2d6, as your attack bonus).' },
  'Mithral Heavy Shield':     { cat:'armor', base:'Shield, heavy steel', mcOnly:true, note:'Mithral (nonmagical): light weight, ACP 0, 5% arcane spell failure.' },
  'Spined Shield':            { cat:'armor', base:'Shield, heavy steel', enh:1, note:'Acts as a spiked shield; fires spines 3/day (see text).' },
  'Winged Shield':            { cat:'armor', base:'Shield, heavy wooden', enh:3, note:'Fly 1/day (as the spell) carrying up to 133 lb.' },
  // v8.15.2: unblocked by Adam's book ruling adding the Scimitar (TS 1).
  'Sylvan Scimitar':          { cat:'weapon', base:'Scimitar', enh:3, note:'Outdoors in a temperate climate: wielder gains Cleave and +1d6 damage.' },
};
// Not converted (deliberately): Javelin of Lightning, Screaming Bolt,
// Slaying/Sleep Arrow (one-shot ammunition), Shifter's Sorrow (no two-bladed
// sword in the weapon table). Sylvan Scimitar converted as of v8.15.2 (Adam
// ruled the Scimitar into the weapon tables, 2026-09-03).

async function addMagicFromBrowse(i) {
  const m = _magicBrowseList[i]; if (!m) return;
  // v8.7.0: specific arms/armor convert to real equippable items.
  const conv = SPECIFIC_ARMS_CONVERSIONS[m.name];
  if (conv) {
    const c0 = chars.find(x => x.id === curId); if (!c0) return;
    let slot = 'main_hand';
    if (conv.cat === 'armor') {
      const adef = getCatalogueEntry('armor', conv.base);
      slot = (adef && adef.type === 'shield') ? 'off_hand' : 'armor';
    }
    // v8.7.0 wealth: gate on the MAGIC item's own price, not the base's.
    const prov = await promptProvenance(c0, m.name, m.price_gp ? m.price_gp * 100 : null);
    if (prov === null) return;
    await addItemToChar(conv.cat, conv.base, slot, { skipPurchase: true });
    const added = (c0.items || []).filter(x => x.catalogue === conv.cat && x.ref === conv.base).pop();
    if (added && prov) added.provenance = prov;
    if (added) {
      added.customName = m.name;
      added.specialNote = conv.note || '';
      const mcTarget = conv.cat === 'weapon' ? 'attack' : 'defense';
      added.mastercraft = added.mastercraft || { bonus: 1, target: mcTarget };
      if (!conv.mcOnly) added.enchant = { enh: conv.enh || 1, abilities: conv.abilities || [], imbued: false, overCap: false };
      save(); renderGear(); renderSheet();
      toast(`${m.name} added as an equippable ${conv.cat} (${conv.mcOnly ? 'special material, nonmagical' : '+' + (conv.enh || 1) + (conv.abilities && conv.abilities.length ? ' ' + conv.abilities.join(' ') : '')} ${conv.base}).`);
    }
    return;
  }
  // v9.11.0 (§265, Adam: "wiring to imbue them on the spot"): the spell/
  // power VEHICLES — a dorje, power stone, scroll, or imbued tattoo is an
  // empty vessel until its spell or power is chosen, so the add flow asks.
  // The candidate list is SPELLS_DB filtered to the vehicle's level within
  // its family (psionic classes for powers, casting classes for spells);
  // the item records what it carries and takes the traditional name.
  if (m.vehicle) {
    const c0 = chars.find(x => x.id === curId); if (!c0) return;
    const PSI_CLS = new Set(['Psi/Wld', 'War', 'Telepath', 'Nomad', 'Seer', 'Kineticist', 'Egoist', 'Shaper']);
    const famLvl = (sp) => {
      const ls = (sp.levels || []).filter(l => m.vehicle.kind === 'power' ? PSI_CLS.has(l.cls) : !PSI_CLS.has(l.cls));
      return ls.length ? Math.min(...ls.map(l => l.lvl)) : null;
    };
    let names = SPELLS_DB.filter(sp => famLvl(sp) === m.vehicle.lvl).map(sp => sp.name);
    if (!names.length) names = SPELLS_DB.filter(sp => (sp.levels || []).some(l => l.lvl === m.vehicle.lvl)).map(sp => sp.name);
    names = [...new Set(names)].sort();
    if (!names.length) { toast(`No ${m.vehicle.kind}s of that level found in the catalogue.`); return; }
    const pick = await new Promise(res => openChoiceModal(
      `${m.name} — which ${m.vehicle.kind} does it carry? (Imbued at creation; ${m.cl_kind || 'CL'} ${m.cl}, the minimum.)`, names, res));
    if (!pick) return;
    const prov = await promptProvenance(c0, `${m.vehicle.label} of ${pick}`, m.price_gp ? m.price_gp * 100 : null);
    if (prov === null) return;
    await addItemToChar('magic', m.name, magicItemDefaultSlot(m), { skipPurchase: true });
    const added = (c0.items || []).filter(it => it.catalogue === 'magic' && it.ref === m.name).pop();
    if (added) {
      added.customName = `${m.vehicle.label} of ${pick}`;
      added.imbued = { name: pick, lvl: m.vehicle.lvl, kind: m.vehicle.kind };
      if (prov) added.provenance = prov;
      save(); renderGear();
      toast(`${added.customName} added (${m.vehicle.kind} carried: ${pick}, ${m.cl_kind || 'CL'} ${m.cl}).`);
    }
    return;
  }
  // v8.6.0 firm-wire: tiered items (Amulet of Health +2/+4/+6, Ring of
  // Protection +1..+5…) pick their tier at add time — stored as it.tier.
  const fx = MAGIC_ITEM_EFFECTS[m.name];
  const doAdd = async (tier) => {
    const c = chars.find(x => x.id === curId); if (!c) return;
    await addItemToChar('magic', m.name, magicItemDefaultSlot(m));
    const added = (c.items || []).filter(it => it.catalogue === 'magic' && it.ref === m.name).pop();
    if (tier && added) { added.tier = tier; save(); renderGear(); }
    // v8.8.0 (Adam's Resistances design): the Energy Resistance ring's type
    // is chosen by its creator — pick at add; feeds the Sheet panel.
    if (added && m.name === 'Energy Resistance') {
      const pick = await new Promise(res => openChoiceModal('Energy Resistance (ring) — which energy type? (Chosen by the item’s creator.)',
        ['Acid', 'Cold', 'Electricity', 'Fire', 'Sonic'], res));
      if (pick) { added.energyType = pick.toLowerCase(); save(); renderGear(); renderSheet(); }
    }
  };
  if (fx && fx.tiers && fx.tiers.length > 1) {
    const label = fx.attr ? `${fx.attr} enhancement` : (fx.type || 'bonus');
    openChoiceModal(`${m.name} — which tier?`,
      fx.tiers.map(([v, gp]) => `+${v} ${label} (${gp.toLocaleString()} gp)`),
      (sel) => { const v = parseInt(sel.match(/\+(\d+)/)[1], 10); doAdd(v); });
    return;
  }
  await doAdd(fx && fx.tiers ? fx.tiers[0][0] : null);
}
function renderMagicInventory(c) {
  const host = document.getElementById('gear-inv-magic'); if (!host) return;
  const owned = (c.items || []).filter(it => it.catalogue === 'magic');
  host.innerHTML = owned.length ? owned.map(it => {
    const def = getCatalogueEntry('magic', it.ref) || {};
    const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
      <div><b>${escapeHTML(it.customName || it.ref)}${it.tier ? ` +${it.tier}` : ''}</b>${it.customName ? ` <span style="font-size:9px;opacity:var(--o55);color:var(--dim);">(${escapeHTML(it.ref)})</span>` : ''}${(MAGIC_ITEM_EFFECTS[it.ref] && it.equipped) ? ' <span style="font-size:9px;color:var(--pb90);" title="firm-wired: effect applies while equipped">⚡wired</span>' : ''}
        <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.3);margin-left:4px;">${MAGIC_TYPE_LABELS[def.type] || def.type || 'item'}</span>
        <span style="font-size:10px;opacity:var(--o55);color:var(--dim);margin-left:5px;">${slotDef ? slotDef.label : it.slot} · ${magicPriceLabel(def)}</span>
        ${it.equipped ? '<span style="font-size:10px;color:#6dba88;margin-left:5px;">● equipped</span>' : ''}</div>
      <div>
        ${(slotDef && slotDef.category !== 'carried') ? `<button class="btn btn-sm" style="font-size:10px;" onclick="toggleItemEquipped('${it.id}')">${it.equipped ? 'Unequip' : 'Equip'}</button>` : ''}
        <button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')" title="Give this item a custom name (flavor only)">✎</button>
        <button class="btn btn-sm" style="font-size:10px;" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (cross-scalar; HH p.257 Sale Price rule applies)">💱</button>
        <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')">✕</button>
      </div>
    </div>`;
  }).join('') : `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">None owned yet — browse the catalogue below.</div>`;
}

function scenarioTechScale(c) { return (c && c.sixLevels && c.sixLevels.tech) || 0; }

// v8.24.0 (Adam's ruling, 2026-09-05): the Decipher skill's DISPLAY name
// follows the scenario's Tech Scale — "Decipher Script" in Tech Scale 0-4
// (parchment, glyphs, dead languages), "Decipher Code" in Tech Scale 5-9
// (ciphers, encryption, source). One skill, one internal key ('Decipher
// Code' — ranks/synergies/prereqs unchanged), world-responsive label.
function displaySkillName(c, name) {
  if (name === 'Decipher Code' && scenarioTechScale(c) <= 4) return 'Decipher Script';
  return name;
}

// v8.90.0 (Adam: "the same courtesy skills-wise" — GMF parity): HH Skill
// Descriptions (pp.150+) as hover dossiers on the Skills tab. One entry per
// BOOK skill (48 — the HH's "Heal" is a pointer stub to Treat Injury);
// parametrized families (Craft/Knowledge/Perform/Profession) share their
// base entry. Keyed by book heading; the lookup aliases the internal
// 'Decipher Code' key, so the v8.24.0 Tech-Scale display nuance rides free.
const SKILL_DESCS = {
  "Appraise": {q:"Int; Tech 1", d:"You have an eye for the value of objects on the open market.\nCheck: You can appraise common or well-known objects with a DC 12 Appraise check. Failure means that you estimate the value at 50% to 150% (2d6+3 times 10%,) of its actual value. Appraising a rare or exotic item requires a successful check against DC 15, 20, or higher. If the check is successful, you estimate the value correctly; failure means you cannot estimate the item’s value. You also use Appraise to try and find a better Sale Price for an item; make an Appraise check against the Purchase DC of the item, and if your result is equal to or greater than the Purchase DC, you get to…"},
  "Autohypnosis": {q:"Wis; Trained Only, Psionic 1", d:"Mental self-mastery enables you to perform rare feats of the mind.\nCheck: The DC and the effect of a successful check depend on the task you attempt. Ignore Caltrop Wound: If you are wounded by stepping on a caltrop, your speed is reduced to one-half normal. A successful Autohypnosis check removes this movement penalty. The wound doesn’t go away—it is just ignored through self-persuasion. Similar examples of pain causing a penalty may be applicable, GM’s adjudication. Memorize: You can attempt to memorize a long string of numbers, a long passage of verse, or some other particularly difficult piece of information (but you can’t memorize magica…"},
  "Balance": {q:"Dex; Armor Check Penalty", d:"You have trained in the art of fine balance, able to traverse narrow paths.\nCheck: You can walk on a precarious surface. A successful check lets you move at half your speed along the surface for 1 round. A failure by 4 or less means you can’t move for 1 round. A failure by 5+ means you fall. The difficulty varies with the surface, as follows: Narrow Surface Balance DC1 Difficult Surface Balance DC1 7–12 inches wide 10 Uneven flagstone 102 2–6 inches wide 15 Hewn stone floor 102 Less than 2 inches wide 20 Sloped or angled floor 102 1 Add modifiers from Narrow Surface Modifiers, below, as appropriate. 2 Only if running or charging. Failure by 4…"},
  "Bluff": {q:"Cha", d:"By a variety of means verbal and non-verbal, you can trick people into thinking what you want them to, at least for the moment.\nCheck: A Bluff check is opposed by the target’s Sense Motive check. See the accompanying table for examples of different kinds of bluffs and the modifier to the target’s Sense Motive check for each one. Favorable and unfavorable circumstances weigh heavily on the outcome of a bluff. Two circumstances can weigh against you: The bluff is hard to believe, or the action that the target is asked to take goes against its self- interest, nature, personality, orders, or the like. If it’s important, you can distinguish betwee…"},
  "Climb": {q:"Str; Armor Check Penalty", d:"You know how to travel vertical surfaces easier than others.\nCheck: With a successful Climb check, you can advance up, down, or across a slope, a wall, or some other steep incline (or even a ceiling with handholds) at one-quarter your normal speed. A slope is considered to be any incline at an angle measuring less than 60 degrees; a wall is any incline at an angle measuring 60 degrees or more. A Climb check that fails by 4 or less means that you make no progress, and one that fails by 5+ means that you fall from whatever height you have already attained. A climber’s kit gives you a +2 circumstance bonus on Climb checks. The DC of the check de…"},
  "Computer Use": {q:"Int; Tech 5", d:"You have expertise in using computers, both hardware and software.\nCheck: Most normal computer operations don’t require a Computer Use check (though a character might have to make a Research check; see the Research skill description). However, searching an unfamiliar network for a particular file, writing computer programs, altering existing programs to perform differently (better or worse), and breaking through computer security are all relatively difficult and require skill checks. Find File: This skill can be used for finding files or data on an unfamiliar system. The DC for the check and the time required are determined by the size of the…"},
  "Concentration": {q:"Con", d:"You have trained yourself in maintaining focus when circumstances are harrowing.\nCheck: You must make a Concentration check whenever you might potentially be distracted (by taking damage, by harsh weather, and so on) while engaged in some action that requires your full attention. Such actions include casting a spell or manifesting a power, concentrating on an active spell or power, directing a spell or power, using a spell-like or psi-like ability, or using a skill that would provoke an attack of opportunity. In general, if an action wouldn’t normally provoke an attack of opportunity, you need not make a Concentration check to avoid being dis…"},
  "Craft": {q:"Int; Tech 0+", d:"You have training in the crafting of a specific item type. This skill encompasses several categories, each of them treated as a separate skill (“TS” = Tech Scale): Craft (armorsmithing, TS 1), Craft (Bowmaking, TS 1), Craft (chemical, TS 1), Craft (electronics, TS 5), Craft (mechanical, TS 0 [simple only]), Craft (pharmaceutical, TS 3), Craft (structural, TS 0 [simple only]), Craft (trapmaking, TS 1), Craft (weaponsmithing, TS 1), Craft (visual arts, TS 0), and Craft (writing, TS 1). Craft skills are specifically focused on creating objects. To use a Craft skill effectively, a character must have a kit or some other set of basic tools. The pu…"},
  "Decipher Script": {q:"Int; Trained Only, Tech 1", d:"The character is educated in symbology, codebreaking, and/or cryptography.\nCheck: A character can decipher writing in an ancient language or in computer code, or interpret the meaning of an incomplete text. The base DC is 20 for the simplest messages, 25 for standard codes, and 30 or higher for intricate or complex codes or exotic messages. Helpful texts or computer programs can provide a bonus (usually a +2 circumstance bonus) on the check, provided they are applicable to the script in question. If the check succeeds, the character understands the general content of a piece of writing, reading about one page of text or its equivalent in 1 mi…"},
  "Demolitions": {q:"Int; Trained Only, Tech 3", d:"You are trained in the deployment and defusing of placed explosives.\nCheck: Setting a simple explosive to blow up at a certain spot doesn’t require a check, but connecting and setting a detonator does. Also, placing an explosive for maximum effect against a structure calls for a check, as does disarming an explosive device. Set Detonator: Most explosives require a detonator to go off. Connecting a detonator to an explosive requires a Demolitions check (DC 10). Failure means that the explosive fails to go off as planned. Failure by 10 or more means the explosive goes off as the detonator is being installed. A character can make an explosive di…"},
  "Diplomacy": {q:"Cha", d:"You are skilled in the art of engaging other beings tactfully.\nCheck: You can change the attitudes of others (nonplayer characters) with a successful Diplomacy check; see the Influencing NPC Attitudes sidebar, below, for basic DCs. In negotiations, participants roll opposed Diplomacy checks, and the winner gains the advantage. Opposed checks also resolve situations when two advocates or diplomats plead opposite cases in a hearing before a third party. A character can take 10 when making a Diplomacy check, but they can’t take 20."},
  "Disable Device": {q:"Int; Trained Only, Tech 1", d:"The character is trained in the disassembling of devices like locks and security systems.\nCheck: The Disable Device check is made secretly, so that you don’t necessarily know whether you’ve succeeded. The DC depends on how tricky the device is. Disabling (or rigging or jamming) a fairly simple device has a DC of 10; more intricate and complex devices have higher DCs. If the check succeeds, you disable the device. If it fails by 4 or less, you have failed but can try again. If you fail by 5+, something goes wrong. If the device is a trap, you spring it. If you’re attempting some sort of sabotage, you think the device is disabled, but it still …"},
  "Disguise": {q:"Cha", d:"You are trained in changing your appearance through the use of props and posture.\nCheck: Your Disguise check result determines how good the disguise is, and it is opposed by others’ Spot check results. If you don’t draw any attention to yourself, others do not get to make Spot checks. If you come to the attention of people who are suspicious (such as a guard who is watching commoners walking through a city gate), it can be assumed that such observers are taking 10 on their Spot checks. You get only one Disguise check per use of the skill, even if several people are making Spot checks against it. The Disguise check is made secretly, so that yo…"},
  "Drive": {q:"Dex; Tech 3", d:"The character knows how to control ground-based four-wheeled vehicles.\nCheck: Routine tasks, such as ordinary driving, don’t require a skill check. Make a check only when some unusual circumstance exists (such as inclement weather or an icy surface), or when the character is driving during a dramatic situation (the character is being chased or attacked, for example, or is trying to reach a destination in a limited amount of time). When driving, the character can attempt simple maneuvers or stunts. See Driving a Vehicle for more details."},
  "Escape Artist": {q:"Dex; Armor Check Penalty", d:"The character trains in being flexible and limber.\nCheck: The table below gives the DCs to escape various forms of restraints. Ropes: Your Escape Artist check is opposed by the binder’s Use Rope check. Since it’s easier to tie someone up than to escape from being tied up, the binder gets a +10 bonus on their check. Manacles, Handcuffs, and Masterwork Manacles: The DC for manacles is set by their construction. Tight Space: The DC noted on the table is for getting through a space where your head fits but your shoulders don’t. If the space is long you may need to make multiple checks. You can’t get through a space that your head does not fit thr…"},
  "Forgery": {q:"Int; Tech 1", d:"You know how to fabricate convincing documentation.\nCheck: Forgery requires materials appropriate to the document being forged, and some time. To forge a document the character needs to have seen a similar document before. The complexity of the document, the character’s degree of familiarity with it, and whether the character needs to reproduce the signature or handwriting of a specific individual, provide modifiers to the Forgery check, as shown below. Some documents require security or authorization codes, whether authentic ones or additional forgeries. The GM makes the character’s check secretly so the character is not sure how good their …"},
  "Gamble": {q:"Wis; Tech 1", d:"You’ve developed a knack for playing the odds in games of chance.\nCheck: To join or start a game, a character must first pay a stake. The character sets the stakes if they start a game, or the GM sets it if the character joins a game. Stakes run from penny-ante ($20/cp/credits) to astronomical ($5,000/cp/credits; see the Wealth Scores / Purchase DC’s and Currency Equivalent table in Chapter III). The character’s Gamble check is opposed by the Gamble checks of all other participants in the game. If playing at a reputable casino, assume the house has a Gamble skill modifier equal to the stake’s equivalent purchase DC (+4 Gamble skill for $20/cp…"},
  "Gather Information": {q:"Cha; Tech 1", d:"You know how to work a crowd.\nCheck: By succeeding at a skill check (DC 10) and spending 1d4+1 hours passing out money and buying drinks, a character can get a feel for the major news items in a neighborhood. This result assumes that no obvious reasons exist why information would be withheld. The higher the check result, the better the information. Information ranges from general to protected, and the cost and Gather Information DC increases accordingly for the type of information the character seeks to gather, as given in the table below. Type of Information DC Purchase DC / Cost in $/cp/credits General 10 5 / $30 Specific 15 10 / $120 Restr…"},
  "Handle Animal": {q:"Cha; Trained Only", d:"You have the ability to teach and guide animals.\nCheck: The DC depends on what you’re trying to do. Task Handle Animal DC Handle an animal 10 “Push” an animal 25 Teach an animal a trick 15 or 201 Train an animal for a general purpose 15 or 201 Rear a wild animal 15 + HD of animal 1 See the specific trick or purpose below. Trick Being Taught DC Time General Purpose DC Time Come 15 1 week Heavy Labor 15 2 weeks Down 15 1 week Performance 15 4 weeks Fetch 15 1 week Riding 15 3 weeks Heel 15 1 week Combat Riding 20 6 weeks Perform 15 1 week Fighting 20 3 weeks Seek 15 1 week Guarding 20 4 weeks Stay 15 1 week Hunting 20 6 weeks Work 15 1 week Att…"},
  "Hide": {q:"Dex; Armor Check Penalty", d:"You have trained in techniques to avoid detection by sight.\nCheck: Your Hide check is opposed by the Spot check of anyone who might see you. You can move up to one-half your normal speed and hide at no penalty. When moving at a speed greater than one-half but less than your normal speed, you take a –5 penalty. It’s practically impossible (–20 penalty) to hide while attacking, running or charging. A creature larger or smaller than Medium takes a size bonus or penalty on Hide checks depending on its size category: Size Modifier Size Modifier Fine +16 Large -4 Diminutive +12 Huge -8 Tiny +8 Gargantuan -12 Small +4 Colossal -16 Medium-size +0 If …"},
  "Intimidate": {q:"Cha", d:"You have a way of making offers others don’t usually refuse.\nCheck: You can change another’s behavior with a successful check. Your Intimidate check is opposed by the target’s modified level check (1d20 + character level or Hit Dice + target’s Wisdom bonus [if any] + target’s modifiers on saves against fear). If you beat your target’s check result, you may treat the target as friendly, but only for the purpose of actions taken while it remains intimidated. (That is, the target retains its normal attitude, but will chat, advise, offer limited help, or advocate on your behalf while intimidated. See the Diplomacy skill, above, for additional det…"},
  "Investigate": {q:"Int; Trained Only, Tech 1+", d:"You have training in forensic methods to “read” the scene of the crime.\nCheck: A character generally uses Search to discover clues and Investigate to analyze them. If the character has access to a crime lab, the character uses the Investigate skill to collect and prepare samples for the lab. The result of the Investigate check provides bonuses or penalties to the lab workers. Analyze Clue: The character can make an Investigate check to apply forensics knowledge to a clue. This function of the Investigate skill does not give the character clues where none existed before. It simply allows the character to extract extra information from a clue t…"},
  "Jump": {q:"Str; Armor Check Penalty", d:"You are better at leaping across and up distances than others.\nCheck: The DC and the distance you can cover vary according to the type of jump you are attempting (see below). Your Jump check is modified by your speed. If your speed is 30 feet then no modifier based on speed applies to the check. If your speed is less than 30 feet, you take a –6 penalty for every 10 feet of speed less than 30 feet. If your speed is greater than 30 feet, you gain a +4 bonus for every 10 feet beyond 30 feet. All Jump DCs given here assume that you get a running start, which requires that you move at least 20 feet in a straight line before attempting the jump. If…"},
  "Knowledge": {q:"Int; Trained Only, Tech 1+", d:"You have pursued a formal education in a chosen specialty of knowledge. This skill encompasses several categories, each of them treated as a separate skill. These categories are identified and defined below. The number of Knowledge categories is kept purposely finite. When trying to determine what Knowledge skill a particular question or field of expertise falls under, use a broad interpretation of the existing categories. Do not arbitrarily make up new categories.\nCheck: A character makes a Knowledge check to see if the character knows something. The DC for answering a question within the character’s field of study is 10 for easy questions, …"},
  "Listen": {q:"Wis", d:"You have honed your hearing with practice and training.\nCheck: Make a Listen check against a DC that reflects how quiet the noise is that a character might hear or against an opposed Move Silently check. The GM may call for a Listen check by a character who is in a position to hear something. A character can also make a Listen check voluntarily if they want to try to hear something in the character’s vicinity. The GM may make the Listen check in secret so that the character doesn’t know whether not hearing anything means that nothing is there or that the character failed the check. A successful Listen check when there isn’t anything to hear r…"},
  "Move Silently": {q:"Dex; Armor Check Penalty", d:"You have a featherlight footfall.\nCheck: Your Move Silently check is opposed by the Listen check of anyone who might hear you. You can move up to one-half your normal speed at no penalty. When moving at a speed greater than one-half but less than your full speed, you take a –5 penalty. It’s practically impossible (–20 penalty) to move silently while running or charging. Noisy surfaces, such as bogs or undergrowth, are tough to move silently across. When you try to sneak across such a surface, you take a penalty on your Move Silently check as indicated below."},
  "Navigate": {q:"Int; Tech 1", d:"You are trained in methods of navigation for long-distance travel.\nCheck: Make a Navigate check when a character is trying to find their way to a distant location without directions or other specific guidance. Generally, a character does not need to make a check to find a local street or other common urban site, or to follow an accurate map. However, the character might make a check to wind their way through a dense forest or a labyrinth of underground storm drains. For movement over a great distance, make a Navigate check. The DC depends on the length of the trip. If the character succeeds, they move via the best reasonable course toward the…"},
  "Open Lock": {q:"Dex; Trained Only, Tech 1", d:"See “Disable Device”."},
  "Perform": {q:"Cha", d:"You are practiced in some form of performance theatre. Like Craft, Knowledge, and Profession, Perform is actually a number of separate skills. You could have several Perform skills, each with its own ranks, each purchased as a separate skill. Each of the nine categories of the Perform skill includes a variety of methods, instruments, or techniques, a small list of which is provided for each category below. • Act (comedy, drama, mime) • Comedy (buffoonery, limericks, joke-telling) • Dance (ballet, waltz, jig) • Keyboard instruments (harpsichord, piano, pipe organ) • Oratory (epic, ode, storytelling) • Percussion instruments (bells, chimes, dru…"},
  "Pilot": {q:"Dex; Trained Only, Tech 3", d:"You have a honed aerodynamic sense about you.\nCheck: Typical piloting tasks don’t require checks. Checks are required during combat, for special maneuvers, or in other extreme circumstances, or when the pilot wants to attempt something outside the normal parameters of the vehicle. When flying, the character can attempt simple maneuvers and stunts (actions in which the pilot attempts to do something complex very quickly or in a limited space). Each vehicle’s description includes a maneuver modifier that applies to Pilot checks made by the operator of the vehicle. Escape Grapplers / Tractor Beam (Tech 6): The pilot of a starship can make a Pilo…"},
  "Profession": {q:"Wis; Tech 1+", d:"You have a daytime job. Like Craft, Knowledge, and Perform, Profession is actually a number of separate skills. You could have several Profession skills, each with its own ranks, each purchased as a separate skill. While a Craft skill represents ability in creating or making an item, a Profession skill represents an aptitude in a vocation requiring a broader range of less specific knowledge.\nCheck: A Profession check can be made whenever the character wishes to spend a week or more working at their Profession. A character earns half their Profession check x $100/cp/credits per week of dedicated work."},
  "Psicraft": {q:"Int; Trained Only, Psionic 1", d:"Use this skill to identify powers as they are manifest or powers already in place.\nCheck: You can identify powers and psionic effects. The DCs for Psicraft checks relating to various tasks are summarized on the table below. Psicraft DC Task 15 + power level Identify a power being manifested. (You must sense the power’s display, or see some visible effect, to identify a power.) No action required. No retry. 15 + power level When manifesting detect psionics, determine the discipline involved in the aura of a single item or creature you can see. (If the aura is not a power effect, the DC is 15 + 1/2 manifester level.) No action required. 15 + po…"},
  "Read/Write/Speak Language": {q:"None; Trained Only", d:"You are fluent in one or more additional languages. Special: The Read/Write/Speak Language skill doesn’t work like a standard skill. A character automatically knows"},
  "Repair": {q:"Int; Trained Only, Tech 1", d:"You have a knack for fixing things.\nCheck: Most Repair checks are made to fix complex electronic or mechanical devices. The DC is set by the GM. In general, simple repairs have a DC of 10 to 15 and require no more than a few minutes to accomplish. More complex repair work has a DC of 20 or higher and can require an hour or more to complete. Making repairs also involves a monetary cost when spare parts or new components are needed. Repair Task (Example) Purchase DC Repair DC Time Simple (tool, simple weapon) 4 ($20) 10 1 min. Moderate (mechanical or electronic component) 7 ($55) 15 10 min. Complex (mechanical or electronic device) 10 ($120) 20…"},
  "Research": {q:"Int; Tech 1", d:"You know how to find answers at the library. Do research when you don’t know (via Knowledge) the answer.\nCheck: Researching a topic takes time, skill, and some luck. The GM determines how obscure a particular topic is (the more obscure, the higher the DC) and what kind of information might be available depending on where the character is conducting their research. Information ranges from general to protected. Given enough time (usually 1d4 hours) and a successful skill check, the character gets a general idea about a given topic. This assumes that no obvious reasons exist why such information would be unavailable, and that the character has a…"},
  "Ride": {q:"Dex", d:"You are skilled in using another creature as a means of transportation.\nCheck: Typical riding actions don’t require checks. You can saddle, mount, ride, and dismount from a mount without a problem. The following tasks do require checks: Task Ride DC Task Ride DC Guide with knees 5 Leap 15 Stay in saddle 5 Spur mount 15 Fight with warhorse 10 Control mount in battle 20 Cover 15 Fast mount or dismount 201 Soft fall 15 1 Armor check penalty applies. Guide with Knees: You can react instantly to guide your mount with your knees so that you can use both hands in combat. Make your Ride check at the start of your turn. If you fail, you can use only o…"},
  "Search": {q:"Int", d:"You can find things others typically can’t.\nCheck: You generally must be within 10 feet of the object or surface to be searched. The table below gives DCs for typical tasks involving the Search skill. Task Search DC Ransack a chest full of junk to find a certain item 10 Notice a typical secret door or a simple trap 20 Find a difficult nonmagical trap (Rogue only)1 21 or higher Find a magic trap (Rogue only)1 25 + level of spell used to create trap Notice a well-hidden secret door 30 Find a footprint Varies2 1 Dwarves (even if they are not Rogues) can use Search to find traps built into or out of stone. 2 A successful Search check can find a f…"},
  "Sense Motive": {q:"Wis", d:"You can intuit when something is “off” or other than it seems.\nCheck: A successful check lets you avoid being bluffed (see the Bluff skill). You can also use this skill to determine when “something is up” (that is, something odd is going on) or to assess someone’s trustworthiness. Task Sense Motive DC Hunch 20 Sense enchantment 25 or 15 Discern secret message Varies Hunch: This use of the skill involves making a gut assessment of the social situation. You can get the feeling from another’s behavior that something is wrong, such as when you’re talking to an impostor. Alternatively, you can get the feeling that someone is trustworthy. Sense Enc…"},
  "Sleight of Hand": {q:"Dex; Trained Only, Armor Check Penalty", d:"You can inconspicuously conceal things with your hands.\nCheck: A DC 10 Sleight of Hand check lets you palm a coin-sized, unattended object. Performing a minor feat of legerdemain, such as making a coin disappear, also has a DC of 10 unless an observer is determined to note where the item went. When you use this skill under close observation, your skill check is opposed by the observer’s Spot check. The observer’s success doesn’t prevent you from performing the action, just from doing it unnoticed. You can hide a small object (including a light weapon or an easily concealed ranged weapon, such as a dart, sling, or hand crossbow) on your body. …"},
  "Spellcraft": {q:"Int; Trained Only, Arcane 1", d:"You have learned some of the signs and sigils of the arcane arts.\nCheck: You can identify spells and magic effects; use this skill to identify spells as they are cast or spells already in place. The DC’s for Spellcraft checks relating to various tasks are summarized below: Spellcraft DC Task 13 When using Read Magic, identify a Glyph of Warding. No action required. 15 + spell level Identify a spell being cast. (You must see or hear the spell’s verbal or somatic components.) No action required. No retry. 15 + spell level Learn a spell from a spellbook or scroll (Wizard only). No retry for that spell until you gain at least 1 rank in Spellcraft…"},
  "Spot": {q:"Wis", d:"You have an eye for seeing what’s hidden.\nCheck: The Spot skill is used primarily to detect characters or creatures who are hiding. Typically, your Spot check is opposed by the Hide check of the creature trying not to be seen. Sometimes a creature isn’t intentionally hiding but is still difficult to see, so a successful Spot check is necessary to notice it. A Spot check result higher than 20 generally lets you become aware of an invisible creature near you, though you can’t actually see it. Spot is also used to detect someone in disguise (see the Disguise skill), and to read lips when you can’t hear or understand what someone is saying. Spot …"},
  "Survival": {q:"Wis", d:"You are trained in living off the land.\nCheck: You can keep yourself and others safe and fed in the wild. The table below gives the DCs for various tasks that require Survival checks. Survival does not allow you to follow difficult tracks unless you are a Ranger or have the Track feat (see the Restriction section below). Survival DC Task 10 Get along in the wild. Move up to one-half your overland speed while hunting and foraging (no food or water supplies needed). You can provide food and water for one other person for every 2 points by which your check result exceeds 10. 15 Gain a +2 bonus on all Fortitude saves against severe weather while …"},
  "Swim": {q:"Str; Armor Check Penalty", d:"You know how to stay afloat.\nCheck: Make a Swim check once per round while you are in the water. Success means you may swim at up to one- half your speed (as a full-round action) or at one-quarter your speed (as a move action). If you fail by 4 or less, you make no progress through the water. If you fail by 5+, you go underwater. If you are underwater, either because you failed a Swim check or because you are swimming underwater intentionally, you must hold your breath. You can hold your breath for a number of rounds equal to your Constitution score, but only if you do nothing other than take move actions or free actions. If you take a standa…"},
  "Treat Injury": {q:"Wis", d:"You can patch up wounds and treat conditions.\nCheck: The DC and effect depend on the task attempted. First Aid (DC 15): With a first aid kit, if a character has lost hit points, the character who would Treat Injury can restore some of them. A successful check, as a full-round action, restores 1d4 hit points. The number restored can never exceed the character’s full normal total of hit points. This application of the skill can be used successfully on a character only once per encounter wherein the target was damaged. Revive Dazed, Stunned, or Unconscious Character (DC 15): With a first aid kit, the character can remove the dazed, stunned, or u…"},
  "Tumble": {q:"Dex; Trained Only, Armor Check Penalty", d:"You are light on your feet, knowing how to bob and weave with advanced training.\nCheck: You can’t use this skill if your speed has been reduced by armor, excess equipment, or loot. You can land softly when you fall or tumble past opponents. You can also tumble to entertain an audience (as though using the Perform skill). The DCs for various tasks involving the Tumble skill are given on the table below: Tumble DC Task 15 Treat a fall as if it were 10 feet shorter than it really is when determining damage. 15 Tumble at one-half speed as part of normal movement, provoking no attacks of opportunity while doing so. Failure means you provoke attack…"},
  "Use Magic Device": {q:"Cha; Trained Only, Arcane 1, Tech 1", d:"Use this skill to activate magic devices, also known as enchanted items, either by training or trickery.\nCheck: You can use this skill to read a spell or to activate a magic item. Use Magic Device lets you use a magic item as if you had the spell ability or class features of another class, as if you were a different race, or as if you were of a different alignment. You make a Use Magic Device check each time you activate a device such as a wand. If you are using the check to emulate an alignment or some other quality in an ongoing manner, you need to make the relevant Use Magic Device check once per hour. You must consciously choose which req…"},
  "Use Psionic Device": {q:"Cha; Trained Only, Psionic 1, Tech 1", d:"Use this skill to activate psionic devices, also known as imbued items, that otherwise you could not activate.\nCheck: You can use this skill to address a power stone (to learn what powers are encoded on it) or to activate a psionic item. This skill lets you use a psionic item as if you had the manifesting ability or class features of another class, as if you were a different race, or as if you were a different alignment. You make Use Psionic Device checks each time you activate a device such as a dorje. If you are using the check to emulate an alignment or some other quality in an ongoing manner, you need to make the relevant emulation checks…"},
  "Use Rope": {q:"Dex; Tech 1", d:"You have specialized training in tying knots for various purposes.\nCheck: Most tasks with a rope are relatively simple. The DCs for various tasks utilizing this skill are summarized on the table below: Use Rope DC Task 10 Tie a firm knot 101 Secure a grappling hook 15 Tie a special knot, such as one that slips, slides slowly, or loosens with a tug 15 Tie a rope around yourself one-handed 15 Splice two ropes together Varies Bind a character 1 Add 2 to the DC for every 10 feet the hook is thrown; see below. Secure a Grappling Hook: Securing a grappling hook requires a Use Rope check (DC 10, +2 for every 10 feet of distance the grappling hook is…"}
};

function skillHoverText(c, sk) {
  const ALIAS = { 'Decipher Code': 'Decipher Script' };
  const base = ALIAS[sk.n] || sk.n.replace(/\s*\(.*$/, '');
  const e = SKILL_DESCS[sk.n] || SKILL_DESCS[base];
  if (!e) return '';
  const nm = displaySkillName(c, sk.n);
  return nm + ' (' + e.q + ')\n\n' + e.d;
}

