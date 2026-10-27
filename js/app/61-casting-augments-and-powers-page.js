// =============================================================================
// js/app/61-casting-augments-and-powers-page.js
// CASTING AUGMENTS AND POWERS PAGE
// =============================================================================
//
// WHAT'S IN HERE
//   Casting: augmentation and metamagic at cast time, the Mental Pinnacle
//   picks, casting a power, and the Powers/Spells page (renderPowers).
//
// KEY NAMES (so you can search for them)
//   tables/objects: META_FEAT_DEFS, SPONTANEOUS_CASTERS, MENTAL_PINNACLE_PAIRS
//   functions (11): poolSpontaneity, parseAugmentSpec, rollNd8,
//   openCastOptions, chooseMentalPinnacle, castPowerAt, renderCastResult,
//   dismissCastResult, powerPrereqBadge, spellStatLine, renderPowers
//
// LOAD ORDER
//   File 61 of 68. index.html loads it after js/app/60-starships.js and before
//   js/app/62-power-suites-feats-page-proficiencies.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 50105-50769 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 50105-50769; unchanged below this line ----
// ============================================================================
// v8.21.0 SEGMENTS B & C — AUGMENTATION + META- FEATS AT CAST TIME
// (Adam's project, 2026-09-04). Rule sources verified in the HH text:
//   • Augment (p.403): per-entry Augment text; TOTAL PP on one power ≤
//     manifester level; augmenting happens at manifest time.
//   • Magic feats (pp.212-256, flat PP surcharges, cap = spellcaster level):
//     Enlarge +2 · Extend +2 · Empower +4 · Widen +6 · Maximize +6 ·
//     Quicken +8 (banned on spontaneous casts) · Heighten (cost of the new
//     level; DC scales). Spontaneous casters (Saint/Sor/Bard + spontaneous
//     Cure/Inflict + Signature Spells) escalate to a full-round action.
//   • Power feats (expend focus, cap = manifester level): Enlarge +0 ·
//     Extend +2 · Empower +2 · Widen +4 · Maximize +4 · Chain +6 ·
//     Quicken +6. ONE focus per manifestation, so one Power feat per cast
//     (psionic focus = held state; super focus = the move-action momentary
//     kind, logged as part of the manifestation). Opportunity Power is
//     reactive (AoO) and lives at the table, not in this proactive flow.
//   • Overchannel (p.234): +1 EPL (to +2 @EPL 8, +3 @15) for 1d8/3d8/5d8
//     damage — offered as a toggle that raises the augment cap and rolls
//     its price (Talented: expend focus to avoid on powers ≤3rd).
// 132/668 entries carry Augment text; 106 follow the standard "For every
// [N] additional power point(s)" pattern and get COMPUTED dice/DC scaling;
// the rest surface their text beside the same capped PP stepper.
const META_FEAT_DEFS = {
  spell: [
    { name: 'Enlarge Spell',  pp: 2, chk: s => /\b(close|medium|long)\b/i.test(s.range || ''), why: 'range must be close/medium/long', fx: 'range +100%' },
    { name: 'Extend Spell',   pp: 2, chk: s => !/(instantaneous|concentration|permanent)/i.test(s.duration || 'instantaneous'), why: 'no instantaneous/concentration/permanent durations', fx: 'duration ×2' },
    { name: 'Empower Spell',  pp: 4, chk: () => true, fx: 'variable numeric effects +50%' },
    { name: 'Widen Spell',    pp: 6, chk: s => /(burst|emanation|line|spread)/i.test(s.area || ''), why: 'area must be burst/emanation/line/spread', fx: 'area measurements +100%' },
    { name: 'Maximize Spell', pp: 6, chk: () => true, fx: 'variable numeric effects maximized' },
    { name: 'Quicken Spell',  pp: 8, chk: s => !/(minute|hour|day|round)/i.test(s.casting_time || '') || /1 round\b/i.test(s.casting_time || ''), why: 'casting time over 1 full round', fx: 'swift action; no AoO; one per round' },
  ],
  power: [
    { name: 'Enlarge Power',  pp: 0, chk: s => /\b(close|medium|long)\b/i.test(s.range || ''), why: 'range must be close/medium/long', fx: 'range +100%' },
    { name: 'Extend Power',   pp: 2, chk: s => !/(instantaneous|concentration|permanent)/i.test(s.duration || 'instantaneous'), why: 'no instantaneous/concentration/permanent durations', fx: 'duration ×2' },
    { name: 'Empower Power',  pp: 2, chk: () => true, fx: 'variables +50% (augment first, then ×1.5)' },
    { name: 'Widen Power',    pp: 4, chk: s => /(burst|emanation|line|spread)/i.test(s.area || ''), why: 'area must be burst/emanation/line/spread', fx: 'area measurements +100%' },
    { name: 'Maximize Power', pp: 4, chk: () => true, fx: 'variables maximized (augmented dice included)' },
    { name: 'Chain Power',    pp: 6, chk: s => !!(s.damage && !/(burst|emanation|line|spread)/i.test(s.area || '') && (s.damage.is_template || /(acid|cold|electricity|fire|sonic)/i.test(s.damage.type || ''))), why: 'single-target acid/cold/electricity/fire/sonic damage only', fx: 'arcs to ≤ML secondary targets (max 20) within 30 ft at half damage' },
    { name: 'Quicken Power',  pp: 6, chk: s => !/(minute|hour|day)/i.test(s.casting_time || ''), why: 'manifesting time over 1 round', fx: 'swift action; no AoO; one per round' },
  ],
};
const SPONTANEOUS_CASTERS = new Set(['Sorcerer', 'Bard', 'Saint']);
function poolSpontaneity(c, poolName) {
  if (poolName !== 'arcane' && poolName !== 'divine') return { any: false, all: false };
  const ctrs = ((computeCasterStats(c)[poolName] || {}).contributors || []).filter(x => !x._isAdvancer && !x._fromHeritage);
  const sp = ctrs.filter(x => SPONTANEOUS_CASTERS.has(x.class));
  return { any: sp.length > 0, all: ctrs.length > 0 && sp.length === ctrs.length };
}
// Parse the standard augment grammar out of an entry's Augment text.
function parseAugmentSpec(spell) {
  const d = spell.d || '';
  const at = d.indexOf('Augment:');
  if (at < 0) return null;
  const text = d.slice(at + 8).trim();
  const spec = { text, step: null, dice: null, diceLabel: null, dcEveryDice: null, dcEveryStep: false, prNote: /manifester level increases by 1 for the purpose/i.test(text) };
  const st = text.match(/For every (?:(\d+) )?additional power points? you spend/i);
  if (st) spec.step = parseInt(st[1] || '1', 10);
  const dm = text.match(/damage increases by (\d+)d(\d+)/i);
  const hm = text.match(/heals? (?:an )?additional (\d+)d(\d+)/i);
  // v8.44.0 (Cut 3, Adam's Energy Current probe): the Energy family spells
  // its step as "increases by one die (d6)" — invisible to the NdX grammar,
  // so ALL ten single-option Energy powers cast with un-computed dice.
  const dm2 = text.match(/increases by one die \(d?(\d+)\)/i);
  if (dm) { spec.dice = { n: parseInt(dm[1], 10), d: parseInt(dm[2], 10) }; spec.diceLabel = 'damage'; }
  else if (hm) { spec.dice = { n: parseInt(hm[1], 10), d: parseInt(hm[2], 10) }; spec.diceLabel = 'healing'; }
  else if (dm2) { spec.dice = { n: 1, d: parseInt(dm2[1], 10) }; spec.diceLabel = 'damage'; }
  const dcd = text.match(/For each extra (\d+)d\d+ points? of damage, this power[’']s save DC increases by 1/i);
  // v8.44.0: the word-form sibling ("For each extra two dice of damage…").
  const dcd2 = text.match(/For each extra (one|two|three|four|\d+) dice of damage, this power[’']s save DC increases by 1/i);
  const WORD_N = { one: 1, two: 2, three: 3, four: 4 };
  if (dcd) spec.dcEveryDice = parseInt(dcd[1], 10);
  else if (dcd2) spec.dcEveryDice = WORD_N[dcd2[1].toLowerCase()] || parseInt(dcd2[1], 10);
  else if (spec.step && /save DC increases by 1/i.test(text)) spec.dcEveryStep = true;
  return spec;
}
function rollNd8(n) { let t = 0, rolls = []; for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * 8); rolls.push(r); t += r; } return { total: t, rolls }; }
// The cast-options dialog. Returns a Promise resolving to the chosen options
// (or null on cancel). Built lazily; plain overlay in the house style.
function openCastOptions(ctx) {
  return new Promise((resolve) => {
    let host = document.getElementById('cast-opt-modal');
    if (!host) { host = document.createElement('div'); host.id = 'cast-opt-modal'; document.body.appendChild(host); }
    // v8.63.0 (Adam's B3 ruling): ctx.prep repurposes this dialog as the
    // MEMORIZATION declaration stage — all Magic-feat (and augment) costs
    // are paid at spell selection, per instance ("a Quickened spell is
    // memorized in the morning, and... cast as a swift action" thereafter).
    const { c, spell, pool, lvl, baseCost, cap, aug, metas, canHeighten, canOverchannel, ocMax, spont, isBuff, prep } = ctx;
    const capLabel = POOL_EFF_LEVEL[pool] ? POOL_EFF_LEVEL[pool].abbr : pool;
    const metaRows = metas.map((m, i) => {
      const ok = m.chk(spell);
      const powerKind = pool === 'psionic' || pool === 'super';
      return `<label style="display:flex;gap:6px;align-items:baseline;font-size:12px;margin:2px 0;${ok ? '' : 'opacity:.45;'}">
        <input type="${powerKind ? 'radio' : 'checkbox'}" name="co-meta${powerKind ? '-radio' : '-' + i}" data-i="${i}" ${ok ? '' : 'disabled'} onchange="__coUpdate()">
        <span>${m.name} <b style="color:var(--gold);">${m.pp ? '+' + m.pp + ' PP' : 'no PP'}</b>${powerKind ? ' <span style="color:#78afcd;font-size:10px;">+ focus</span>' : ''}
        <span style="opacity:.65;font-size:10.5px;"> — ${ok ? m.fx : '✗ ' + (m.why || 'not applicable')}</span></span></label>`;
    }).join('');
    const heightenRow = canHeighten ? `<div style="font-size:12px;margin:4px 0;">Heighten Spell to level
      <select id="co-heighten" onchange="__coUpdate()">${[0].concat(Array.from({length: 9 - lvl}, (_, k) => lvl + 1 + k)).map(v => `<option value="${v}">${v === 0 ? '— (off)' : v + ' (cost ' + Math.max(baseCost, PP_COST_BY_POWER_LEVEL[v]) + ' PP, DC scales)'}</option>`).join('')}</select></div>` : '';
    const ocRow = canOverchannel ? `<div style="font-size:12px;margin:4px 0;">Overchannel
      <select id="co-oc" onchange="__coUpdate()">${[0, 1, 2, 3].filter(v => v <= ocMax).map(v => `<option value="${v}">${v === 0 ? '— (off)' : '+' + v + ' EPL (take ' + [0, '1d8', '3d8', '5d8'][v] + ')'}</option>`).join('')}</select>
      <span style="opacity:.6;font-size:10.5px;">raises the augment cap; damage rolls on cast${(c.feats || []).some(f => f.name === 'Talented') ? ' (Talented: expend focus to avoid, powers ≤3rd)' : ''}</span></div>` : '';
    // v8.44.0 (Cut 3): option-aware augments — multi-option powers get one
    // stepper (or checkbox) PER printed option; the generic single stepper
    // survives for everything else.
    const augOpts = (AUGMENT_OPTIONS[spell.name]) || null;
    const augRow = augOpts ? `<div style="margin:4px 0;font-size:12px;"><div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:.05em;">Augment options (independent purchases)</div>
      ${augOpts.map((o, i) => o.once
        ? `<label style="display:flex;gap:6px;align-items:baseline;margin:2px 0;"><input type="checkbox" id="co-opt-${i}" onchange="__coUpdate()"> <span>${escapeHTML(o.label)} <b style="color:var(--gold);">+${o.step} PP</b></span></label>`
        : `<div style="margin:2px 0;">${escapeHTML(o.label)} <span style="opacity:var(--o65);color:var(--dim);">(per ${o.step} PP)</span> ×<input type="number" id="co-opt-${i}" value="0" min="0" style="width:56px;" oninput="__coUpdate()"></div>`).join('')}
      <div style="font-size:10.5px;color:var(--g70);max-height:60px;overflow:auto;margin-top:2px;">${escapeHTML(aug ? aug.text : '')}</div></div>`
    : aug ? `<div style="margin:4px 0;font-size:12px;">Augment: +<input type="number" id="co-aug" value="0" min="0" step="${aug.step || 1}" style="width:64px;" oninput="__coUpdate()"> PP
      ${aug.step ? `<span style="opacity:.65;font-size:10.5px;">(steps of ${aug.step})</span>` : ''}
      <div style="font-size:10.5px;color:var(--g70);max-height:70px;overflow:auto;margin-top:2px;">${escapeHTML(aug.text)}</div></div>` : '';
    host.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9000;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)__coDone(false)">
      <div style="background:#161210;border:1px solid rgba(200,151,30,.5);border-radius:6px;padding:14px 18px;max-width:520px;width:92%;max-height:82vh;overflow:auto;">
        <div style="font-family:'Epics Serif','Cinzel',serif;color:var(--gold);font-size:15px;margin-bottom:6px;">${prep ? '📜' : '⚡'} ${escapeHTML(spell.name)} — ${prep ? 'memorization options' : 'cast options'}</div>
        <div style="font-size:11.5px;color:var(--g70);margin-bottom:6px;">Base ${baseCost} PP (level ${lvl}${isBuff ? ', Buff — 0 PP unaugmented' : ''}) · cap: total ≤ ${capLabel} ${cap}<span id="co-capnote"></span></div>
        ${prep ? `<div style="font-size:10.5px;color:#d4b870;margin-bottom:6px;">Prepared casting: ALL Magic-feat and augment costs are paid NOW, at memorization — this particular instance then casts at no PP with everything baked in (a Quickened instance casts as a swift action). Other instances of the same spell memorize at their standard cost unless likewise declared.</div>` : ''}
        ${augRow}${metaRows ? `<div style="margin:4px 0;"><div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:.05em;">${pool === 'psionic' || pool === 'super' ? 'Power feats (one per manifestation — one focus)' : 'Magic feats'}</div>${metaRows}</div>` : ''}
        ${heightenRow}${ocRow}
        ${spont.any && (pool === 'arcane' || pool === 'divine') ? `<div style="font-size:10.5px;color:#d4b870;margin:4px 0;">Spontaneous casting (Saint/Sorcerer/Bard): any Magic feat escalates the cast to a full-round action; Quicken Spell is barred on spontaneous casts (HH pp.238/340).</div>` : ''}
        <div id="co-total" style="font-size:13px;margin:8px 0 4px;color:var(--gold);"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-sm" onclick="__coDone(false)">Cancel</button>
          <button class="btn btn-sm btn-pri" id="co-cast" onclick="__coDone(true)">${prep ? '📜 Memorize' : '⚡ Cast'}</button>
        </div>
      </div></div>`;
    const state = () => {
      // v8.44.0: per-option purchases (augPicks = {id: purchase count};
      // extra = the summed PP so every downstream cap/cost check is
      // unchanged). Generic stepper path preserved for single-option powers.
      let extra = 0, augPicks = null;
      if (augOpts) {
        augPicks = {};
        augOpts.forEach((o, i) => {
          const el = document.getElementById('co-opt-' + i);
          const n = o.once ? (el && el.checked ? 1 : 0) : Math.max(0, parseInt((el || {}).value, 10) || 0);
          if (n > 0) { augPicks[o.id] = n; extra += n * o.step; }
        });
      } else if (aug) {
        extra = Math.max(0, parseInt((document.getElementById('co-aug') || {}).value, 10) || 0);
      }
      const hl = canHeighten ? parseInt((document.getElementById('co-heighten') || {}).value, 10) || 0 : 0;
      const oc = canOverchannel ? parseInt((document.getElementById('co-oc') || {}).value, 10) || 0 : 0;
      const chosen = [];
      host.querySelectorAll('input[type=checkbox]:checked,input[type=radio]:checked').forEach(el => { const m = metas[parseInt(el.dataset.i, 10)]; if (m) chosen.push(m); });
      const base = hl ? Math.max(baseCost, PP_COST_BY_POWER_LEVEL[hl]) : baseCost;
      const total = base + extra + chosen.reduce((s, m) => s + m.pp, 0);
      return { extra, hl, oc, chosen, base, total, augPicks };
    };
    window.__coUpdate = () => {
      const s = state();
      const capNow = cap + s.oc;
      const over = s.total > capNow;
      let fxBits = [];
      if (augOpts && s.augPicks) {
        // v8.44.0: the itemized pre-deduction summary — each purchased
        // option with its contribution, before a single PP moves.
        for (let i = 0; i < augOpts.length; i++) {
          const o = augOpts[i], n = s.augPicks[o.id] || 0;
          if (!n) continue;
          if (o.kind === 'dice') {
            const dice = n * o.dice.n;
            fxBits.push(`+${dice}d${o.dice.d} damage (${n * o.step} PP)`);
            if (o.dcEveryDice) { const dc = Math.floor(dice / o.dcEveryDice); if (dc) fxBits.push(`save DC +${dc}`); }
          } else if (o.kind === 'bonus') fxBits.push(`+${n} ${o.label.replace(/^\+1 /, '')} (${n * o.step} PP)`);
          else if (o.kind === 'duration') fxBits.push(`+${n * (o.rounds || 1)} round${n * (o.rounds || 1) === 1 ? '' : 's'} (${n * o.step} PP)`);
          else if (o.kind === 'count') fxBits.push(`+${n} ${o.noun}${n === 1 ? '' : 's'} (${n * o.step} PP)`);
          else fxBits.push(`${o.label} (${o.step} PP)`);
        }
      } else if (aug && aug.dice && aug.step && s.extra > 0) {
        const steps = Math.floor(s.extra / aug.step);
        const dice = steps * aug.dice.n;
        fxBits.push(`+${dice}d${aug.dice.d} ${aug.diceLabel}`);
        let dc = 0;
        if (aug.dcEveryDice) dc = Math.floor(dice / aug.dcEveryDice);
        else if (aug.dcEveryStep) dc = steps;
        if (dc > 0) fxBits.push(`save DC +${dc}`);
      } else if (aug && s.extra > 0) fxBits.push('see Augment text');
      document.getElementById('co-total').innerHTML = `Total: <b>${s.total} PP</b> vs cap ${capNow}${s.oc ? ' (incl. Overchannel +' + s.oc + ')' : ''}${fxBits.length ? ' · ' + fxBits.join(' · ') : ''}${over ? ' <b style="color:var(--red-text);">— OVER CAP (GM exception required)</b>' : ''}`;
    };
    window.__coDone = (go) => {
      const s = go ? state() : null;
      host.innerHTML = '';
      delete window.__coUpdate; delete window.__coDone;
      resolve(go ? s : null);
    };
    window.__coUpdate();
  });
}

// ============================================================================
// v8.25.0 MENTAL PINNACLE (Adam's 09-06a rebuild, HH p.574): six picks across
// the five attack/defense OR-pairs — the 1st-edition homage ("the Five Attack
// Modes and the Five Defense Modes") — plus one floater from the remainder.
// The pairing STRUCTURALLY guarantees at least one of each kind. Spell route:
// chosen at each casting. Super-Power Buff route: permanent once chosen
// (stored as c.mentalPinnacle.picks).
const MENTAL_PINNACLE_PAIRS = [
  ['Mind Thrust', 'Empty Mind'],
  ['Ego Whip', 'Thought Shield'],
  ['Psionic Blast', 'Mental Barrier'],
  ['Id Insinuation', 'Intellect Fortress'],
  ['Psychic Crush', 'Tower of Iron Will'],
];
async function chooseMentalPinnacle() {
  const picks = [];
  for (let i = 0; i < MENTAL_PINNACLE_PAIRS.length; i++) {
    const [atk, def] = MENTAL_PINNACLE_PAIRS[i];
    const sel = await new Promise(res => openChoiceModal(
      `Mental Pinnacle — pair ${i + 1}/5: choose your mode`,
      [`${atk} (Attack Mode)`, `${def} (Defense Mode)`], res));
    if (!sel) return null;
    picks.push(sel.startsWith(atk) ? atk : def);
  }
  const remaining = MENTAL_PINNACLE_PAIRS.flat().filter(n => !picks.includes(n));
  const sixth = await new Promise(res => openChoiceModal(
    'Mental Pinnacle — the sixth pick: any one of the remaining modes', remaining, res));
  if (!sixth) return null;
  picks.push(sixth);
  return picks;
}

async function castPowerAt(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const p = getCharPowers(c)[idx]; if (!p) return;
  const spell = SPELLS_DB.find(s => s.name === p.name);
  if (!spell) { toast('Catalogue entry not found.'); return; }
  if (!(await instantGateOK(c, spell, p.pool))) return;  // v8.57.0 instantaneous-resolution gate
  // v8.5.3: pool 'super' manifests from the super-PP pool (MP + EML² + Wis
  // bonus); Buff super-powers cost 0 PP unaugmented (HH p.423).
  const isSuper = p.pool === 'super';
  const poolsInfo = getCasterPoolsInfo(c);
  const routes = isSuper ? [] : spellPoolOptions(spell, poolsInfo).filter(o => o.pool === p.pool);
  // v8.57.0: a prepared-only entry has no pay-at-cast route — the PP went at
  // dawn. Reroute to memorization (defense in depth behind the row-button
  // swap in renderPowers; stale DOM and scripted calls land here too).
  if (!isSuper && (p.pool === 'arcane' || p.pool === 'divine') && routes.length
      && !spellPoolOptions(spell, nonPreppedPoolsInfo(c)).some(o => o.pool === p.pool)) {
    return memorizeKnownAt(idx);
  }
  const lvl = routes.length ? Math.min(...routes.map(o => o.lvl))
    : ((spell.levels && spell.levels.length) ? Math.min(...spell.levels.map(l => l.lvl)) : 1);
  const baseCost = (isSuper && p.buff) ? 0 : castCostFor(c, spell, p.pool, lvl);

  // v8.21.0 Segments B & C: the cast-options stage — augment stepper, meta-
  // feat toggles, Heighten, Overchannel. Skipped entirely when the character
  // brings none of it to this entry (the old one-click cast survives).
  const aug = parseAugmentSpec(spell);
  const featSet = new Set((c.feats || []).map(f => f.name));
  const poolKind = (p.pool === 'psionic' || isSuper) ? 'power' : 'spell';
  const metas = META_FEAT_DEFS[poolKind].filter(m => featSet.has(m.name));
  const spont = poolSpontaneity(c, p.pool);
  // Quicken Spell is BARRED on spontaneous casts (a Magic feat on a
  // spontaneous cast is a full-round action, and Quicken cannot apply).
  const metasOffered = metas.filter(m => !(m.name === 'Quicken Spell' && spont.all));
  const cap = isSuper ? getMPState(c).eml : (computeCasterLevels(c)[p.pool] || 1);
  const canHeighten = poolKind === 'spell' && featSet.has('Heighten Spell') && lvl < 9;
  const epl = computeCasterLevels(c).psionic || 1;
  const canOverchannel = p.pool === 'psionic' && featSet.has('Overchannel');
  const ocMax = epl >= 15 ? 3 : epl >= 8 ? 2 : 1;
  let opts = { extra: 0, hl: 0, oc: 0, chosen: [], base: baseCost, total: baseCost, augPicks: null };
  if (aug || metasOffered.length || canHeighten || canOverchannel) {
    const picked = await openCastOptions({ c, spell, pool: p.pool, lvl, baseCost, cap, aug, metas: metasOffered, canHeighten, canOverchannel, ocMax, spont, isBuff: isSuper && p.buff });
    if (!picked) return;
    opts = picked;
  }
  const lvlEff = opts.hl || lvl;
  const cost = opts.total;
  const capNow = cap + opts.oc;
  const pp = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);

  if (cost > capNow) {
    if (!(await confirmModal(
      `${spell.name} would total ${cost} PP, over the ${POOL_EFF_LEVEL[p.pool].abbr} cap of ${capNow} ("you can spend only a total number of points on a power equal to your manifester level" — HH p.403).\n\nCast anyway as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `cast at ${cost} PP over the ${POOL_EFF_LEVEL[p.pool].abbr} cap of ${capNow}`);
  }
  if (cost > pp.current) {
    if (!(await confirmModal(
      `${spell.name} costs ${cost} PP, but the ${p.pool} pool has only ${pp.current}/${pp.max}.\n\nCast anyway as a GM-approved exception? (The pool drains to 0.)`))) return;
    logPowerException(c, spell.name, `cast at ${cost} PP with only ${pp.current} available (${p.pool})`);
  }
  // ONE Power feat per manifestation, one focus behind it: psionic expends
  // the held state; a super-powered character folds the momentary move-action
  // focus into the manifestation (HH p.354).
  const powerMeta = poolKind === 'power' ? opts.chosen[0] : null;
  let focusNote = null;
  if (powerMeta) {
    if (p.pool === 'psionic') {
      if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin — no Power feats until it drops.'); return; }
      if (!c.psiFocused) { toast(`○ Not psionically focused — ${powerMeta.name} requires expending your focus (gain it first: full-round action, or move with Psionic Meditation).`); return; }
      c.psiFocused = false;
      logActionEvent(c, 'psi-focus', 0, 'Focus expended', `Psionic focus expended — ${powerMeta.name} on ${spell.name}.`);
      focusNote = `psionic focus expended (${powerMeta.name})`;
    } else {
      logActionEvent(c, 'psi-focus', 0, 'Momentary focus', `Move action: momentary super-power focus gained and expended — ${powerMeta.name} on ${spell.name} (HH p.354).`);
      focusNote = `move action: momentary focus (${powerMeta.name})`;
    }
  }
  // Overchannel's price rolls now, so the table sees the number.
  let ocResult = null;
  if (opts.oc > 0) {
    const nd = [0, 1, 3, 5][opts.oc];
    ocResult = rollNd8(nd);
    logAct(`Overchannel +${opts.oc} EPL on ${spell.name}: takes ${ocResult.total} damage (${nd}d8: ${ocResult.rolls.join('+')})${(c.feats || []).some(f => f.name === 'Talented') && lvlEff <= 3 ? ' — or expend focus (Talented) to avoid it' : ''}.`);
  }
  // Augment math (the standard grammar computes; bespoke shows its text).
  // v8.44.0: option-aware powers compute from the DECLARED split — dice
  // options make dice (and only those move the DC), count/flag options
  // render as their own receipt lines. No more every-PP-moves-the-DC.
  let augFx = null;
  const augOptDefs = (AUGMENT_OPTIONS[spell.name]) || null;
  if (aug && opts.extra > 0) {
    augFx = { extra: opts.extra, text: aug.text, dice: null, dcAdd: 0, label: aug.diceLabel, optBits: null };
    if (augOptDefs && opts.augPicks) {
      augFx.optBits = [];
      for (const o of augOptDefs) {
        const n = opts.augPicks[o.id] || 0;
        if (!n) continue;
        if (o.kind === 'dice') {
          augFx.dice = { n: n * o.dice.n, d: o.dice.d };
          augFx.label = 'damage';
          if (o.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / o.dcEveryDice);
        } else if (o.kind === 'count') augFx.optBits.push(`+${n} ${o.noun}${n === 1 ? '' : 's'}`);
        else if (o.kind === 'flag') augFx.optBits.push(o.label);
        else if (o.kind === 'duration') augFx.optBits.push(`+${n * (o.rounds || 1)} round${n * (o.rounds || 1) === 1 ? '' : 's'} duration`);
        else if (o.kind === 'bonus') augFx.optBits.push(`+${n} ${o.label.replace(/^\+1 /, '')}`);
      }
    } else if (aug.dice && aug.step) {
      const steps = Math.floor(opts.extra / aug.step);
      augFx.dice = { n: steps * aug.dice.n, d: aug.dice.d };
      if (aug.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / aug.dcEveryDice);
      else if (aug.dcEveryStep) augFx.dcAdd = steps;
    }
  }

  // v8.25.0: Mental Pinnacle's six-pick flow (HH p.574 rebuild). The spell
  // route re-picks each casting; the Buff super-power route picks ONCE,
  // permanently (c.mentalPinnacle).
  let mpPicks = null;
  if (spell.name === 'Mental Pinnacle') {
    if (isSuper && p.buff && c.mentalPinnacle && Array.isArray(c.mentalPinnacle.picks)) {
      mpPicks = c.mentalPinnacle.picks;
    } else {
      mpPicks = await chooseMentalPinnacle();
      if (!mpPicks) return;
      if (isSuper && p.buff) {
        c.mentalPinnacle = { picks: mpPicks, chosenAt: new Date().toLocaleDateString() };
        logAct(`🧠 Mental Pinnacle modes chosen PERMANENTLY (Super-Power): ${mpPicks.join(', ')} (HH p.574 — choices are permanent for the Super-Power).`);
      }
    }
  }

  // Energy templates bind their element at cast time (canonical ruling:
  // 5 elements incl. acid — the spec's word over the book's 4, errata F2).
  const finish = (element) => {
    const spent = isSuper ? spendSuperPP(c, cost) : spendPoolPP(c, p.pool, Math.min(cost, pp.current === 0 ? 0 : cost));
    const after = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);
    let atom = spell.damage || null;
    let displayName = spell.name;
    if (atom && atom.is_template && element) {
      const concrete = DamageResolver.expandTemplate(atom).find(x => x.type === element);
      if (concrete) { atom = concrete; displayName = concrete.name; }
    }
    // Super-powers key off Wisdom (the super-mutant bonus-PP attribute);
    // caster pools use their best contributing attribute as before.
    const attrMod = isSuper ? am(((c.attrs) || [10, 10, 10, 10, 10, 10])[4]) : ((computeCasterStats(c)[p.pool] || {}).bestAttrMod || 0);
    const dcBonus = isSuper ? 0 : schoolDcBonus(c, spell);
    const saveDC = (spell.save && !/none/i.test(spell.save)) ? 10 + lvlEff + attrMod + dcBonus + (augFx ? augFx.dcAdd : 0) : null;
    renderCastResult({ name: displayName, baseName: spell.name, pool: p.pool, lvl: lvlEff, baseLvl: lvl, cost, spent, after, atom, saveDC, dcBonus, spell, buff: isSuper && p.buff,
      augFx, metasApplied: opts.chosen, focusNote, ocBoost: opts.oc, ocResult, spontMeta: spont.any && poolKind === 'spell' && opts.chosen.length > 0, heightened: opts.hl > 0, mpPicks });
    logAct(`${p.buff ? 'Invoked buff' : ((p.pool === 'psionic' || p.pool === 'super') ? 'Manifested' : 'Cast')} ${displayName} (${spent} PP, ${p.pool}${opts.extra ? `, +${opts.extra} augment` : ''}${opts.chosen.length ? `, ${opts.chosen.map(m => m.name).join(' + ')}` : ''}${opts.hl ? `, heightened to ${opts.hl}` : ''}) → ${after.current}/${after.max} PP`);
    // v8.42.0: transient-wired buffs — curated powers land on the sheet as
    // active effects, bonus values computed from the actual augment spend.
    applyWiredBuff(c, spell.name, p.pool, opts.extra, opts.augPicks);
    save(); renderPowers();
    renderPPRecovery(c);
  };

  if (spell.damage && spell.damage.is_template) {
    const elements = spell.damage.elements || ['acid', 'cold', 'electricity', 'fire', 'sonic'];
    openChoiceModal(`${spell.name} — choose the energy type`, elements.map(e => e[0].toUpperCase() + e.slice(1)), (sel) => finish(sel.toLowerCase()));
    return;
  }
  finish(null);
}

function renderCastResult(r) {
  const panel = document.getElementById('pw-cast-result');
  document.getElementById('pw-cast-title').textContent = r.prepaid
    ? `⚡ ${r.name} — cast from a prepared slot (level ${r.lvl}, no PP — paid at dawn)`
    : `⚡ ${r.name} — ${(r.pool === 'psionic' || r.pool === 'super') ? 'manifested' : 'cast'} from the ${r.pool} pool (level ${r.lvl}, ${r.spent} PP)`;
  const bits = [];
  if (r.buff) bits.push(`<b>Buff super-power</b> — Personal / You / Permanent-or-at-will; 0 PP unaugmented; variable aspects manifest at your ESL`);
  bits.push(`<b>PP:</b> ${r.after.current}/${r.after.max} remaining (${r.pool})`);
  if (r.saveDC !== null && r.saveDC !== undefined) bits.push(`<b>Save DC ${r.saveDC}</b>${r.dcBonus ? ` <span style="opacity:.7;">(incl. +${r.dcBonus} Spell Focus)</span>` : ''} — ${escapeHTML(r.spell.save)}`);
  else if (r.spell.save) bits.push(`<b>Save:</b> ${escapeHTML(r.spell.save)}`);
  if (r.spell.resistance) bits.push(`<b>SR/PR:</b> ${escapeHTML(r.spell.resistance)}`);
  // v8.21.0 Segments B & C: what this cast actually applied.
  if (r.heightened) bits.push(`<b style="color:#78afcd;">Heightened</b> to level ${r.lvl} (from ${r.baseLvl}) — DC and level-dependent effects use ${r.lvl}`);
  if (r.augFx) {
    // v8.44.0: itemized option receipt when the split was declared.
    const optTail = (r.augFx.optBits && r.augFx.optBits.length) ? ` · ${r.augFx.optBits.map(escapeHTML).join(' · ')}` : '';
    bits.push(`<b style="color:#78afcd;">Augmented +${r.augFx.extra} PP</b>${r.augFx.dice ? ` — +${r.augFx.dice.n}d${r.augFx.dice.d} ${r.augFx.label}${r.augFx.dcAdd ? `, save DC +${r.augFx.dcAdd} (already included)` : ''}${optTail}` : (optTail ? ` —${optTail}` : ` — <span style="opacity:.8;">${escapeHTML(r.augFx.text.slice(0, 160))}${r.augFx.text.length > 160 ? '…' : ''}</span>`)}`);
  }
  for (const m of (r.metasApplied || [])) bits.push(`<b style="color:var(--vio);">${m.name}</b> — ${escapeHTML(m.fx || '')}${m.pp ? ` (+${m.pp} PP, included)` : ''}`);
  // v8.25.0: Mental Pinnacle's chosen modes (HH p.574 — five attack/defense
  // pairs + one floater; the pairing guarantees at least one of each).
  if (r.mpPicks) bits.push(`<b style="color:var(--vio);">🧠 Modes (6):</b> ${r.mpPicks.map(n => escapeHTML(n)).join(', ')}${r.buff ? ' <span style="opacity:.7;">(permanent — Super-Power)</span>' : ''} · +4 inherent Int/Wis/Cha (min 15 each) · +2 bonus PP per CL · manifest the modes as a Psion of your CL · Divine variant: other spellcasting locked (Mind domain excepted)`);
  if (r.focusNote) bits.push(`<b>Focus:</b> ${escapeHTML(r.focusNote)}`);
  if (r.ocBoost) bits.push(`<b style="color:#d4865a;">Overchannel +${r.ocBoost} EPL</b> — took ${r.ocResult.total} damage (${r.ocResult.rolls.join('+')})`);
  if (r.spontMeta) bits.push(`<b style="color:#d4b870;">Casting time escalates to a full-round action</b> (Magic feat on a spontaneous cast — HH p.340)`);
  // v8.5.4 EAL pass: feat/feature riders that modify the effective level or
  // its checks at cast time — surfaced so the table can apply them.
  const cc = chars.find(x => x.id === curId);
  if (cc && r.spell) {
    const feats = new Set((cc.feats || []).map(f => f.name || f.n || f));
    if (r.spell.resistance && /yes/i.test(r.spell.resistance)) {
      if (r.pool === 'psionic' && feats.has('Power Penetration')) {
        const gp = feats.has('Greater Power Penetration');
        bits.push(`<b>vs PR:</b> +${gp ? 8 : 4} on EPL checks (expend focus${gp ? '; incl. Greater Power Penetration' : ''})`);
      } else if ((r.pool === 'arcane' || r.pool === 'divine') && feats.has('Spell Penetration')) {
        const gs = feats.has('Greater Spell Penetration');
        bits.push(`<b>vs SR:</b> +${gs ? 4 : 2} on ${POOL_EFF_LEVEL[r.pool].abbr} checks${gs ? ' (incl. Greater Spell Penetration)' : ''}`);
      }
    }
    if (r.pool === 'psionic') {
      if (feats.has('Overchannel')) {
        // Boost tier gates at 8th/15th read as manifester level (XPH lineage) — use EPL.
        const epl = computeCasterLevels(cc).psionic || 1;
        const boost = epl >= 15 ? 3 : epl >= 8 ? 2 : 1;
        bits.push(`<b>Overchannel:</b> up to +${boost} EPL for ${({1:'1d8',2:'3d8',3:'5d8'})[boost]} damage${feats.has('Talented') ? ' (Talented: expend focus to avoid the damage on powers of 3rd level or lower)' : ''}`);
      }
      const wilder = (cc.classes || []).find(e => e.name === 'Wilder');
      if (wilder) {
        const wl = wilder.level || 1;
        const surge = wl >= 19 ? 6 : wl >= 15 ? 5 : wl >= 11 ? 4 : wl >= 7 ? 3 : wl >= 3 ? 2 : 1;
        bits.push(`<b>Wild Surge:</b> up to +${surge} EPL free (surge pays the augment PP; risks Neuralgia; can’t combine with Overchannel)`);
      }
    }
  }
  if (r.atom) {
    const res = DamageResolver.resolve(r.atom);
    // Template atoms carry no dice (their seed CSV source column was empty);
    // fall back to the first NdM in the entry's own description text.
    let dice = r.atom.dice || ((r.spell.d || '').match(/\d+d\d+/) || [])[0] || '—';
    // v8.21.0: fold computed augment dice into the readout.
    if (r.augFx && r.augFx.dice && r.augFx.label === 'damage') {
      const bm = String(dice).match(/^(\d+)d(\d+)$/);
      dice = (bm && parseInt(bm[2], 10) === r.augFx.dice.d)
        ? `${parseInt(bm[1], 10) + r.augFx.dice.n}d${r.augFx.dice.d} (incl. +${r.augFx.dice.n}d${r.augFx.dice.d} augment)`
        : `${dice} + ${r.augFx.dice.n}d${r.augFx.dice.d} augment`;
    }
    bits.push(`<b>Damage:</b> ${escapeHTML(dice)} ${escapeHTML(res.label)}${r.atom.lethality === 'nonlethal' ? ' (nonlethal)' : ''}`);
    if (res.resistances.length) bits.push(`<b>Reduced by:</b> ${escapeHTML(res.resistances.join('; '))}`);
    for (const g of res.gates) bits.push(`<b>Gate:</b> ${escapeHTML(g.gate)}${g.immune ? ' — immune: ' + escapeHTML(g.immune.join(', ')) : ''}${g.rule ? ' — ' + escapeHTML(g.rule) : ''}`);
  }
  for (const [label, v] of [['Time', r.spell.casting_time], ['Range', r.spell.range], ['Target', r.spell.target], ['Area', r.spell.area], ['Duration', r.spell.duration]]) {
    if (v) bits.push(`<b>${label}:</b> ${escapeHTML(v)}`);
  }
  document.getElementById('pw-cast-body').innerHTML = bits.join(' &nbsp;·&nbsp; ');
  // v8.57.0: arm the instantaneous-resolution gate for this banner.
  if (_isInstantSpell(r.spell) && !_isSwiftCast(r.spell, r.pool)) _pendingInstant = { charId: curId, name: r.name };
  panel.style.display = 'block';
}

function dismissCastResult() { document.getElementById('pw-cast-result').style.display = 'none'; _pendingInstant = null; }

// ----- rendering -----
// v8.6.1 (Adam, 2026-09-01): scenario-gate earmark for prereq-bearing powers
// (15 carry a book "Prerequisite:" line — 13 Tech Scale 5+, 2 Tech Scale 4+;
// the Supernatural [Attribute] chain carries mutation prereqs). Tech-parsed
// prereqs render "⚙ Tech N+", turning RED when the scenario's Tech Scale is
// below N; other prereq texts get a generic ⚑ badge. Display-level advisory
// (same treatment as the skill rows' scenario gates) — not a hard block.
function powerPrereqBadge(s, c) {
  if (!s || !s.prerequisite) return '';
  const m = String(s.prerequisite).match(/Tech Scale (\d+)/i);
  if (m) {
    const need = parseInt(m[1], 10);
    const have = (c && c.sixLevels && c.sixLevels.tech) || 0;
    const ok = have >= need;
    return ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid ${ok ? 'rgba(212,184,112,.45)' : 'rgba(212,112,112,.6)'};color:${ok ? '#d4b870' : 'var(--red-text)'};margin-left:4px;cursor:help;" title="Prerequisite: ${escapeHTML(s.prerequisite)}${ok ? '' : ' — this scenario is Tech Scale ' + have + ': GM exception territory'}">⚙ Tech ${need}+${ok ? '' : ' ✗'}</span>`;
  }
  return ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid rgba(212,184,112,.45);color:#d4b870;margin-left:4px;cursor:help;" title="Prerequisite: ${escapeHTML(s.prerequisite)}">⚑ prereq</span>`;
}

function spellStatLine(s) {
  const bits = [];
  if (s.school_raw) bits.push(escapeHTML(s.school_raw));
  if (s.prerequisite) bits.push(`<b>Prerequisite:</b> ${escapeHTML(s.prerequisite)}`);
  const lv = (s.levels || []).map(l => `${l.cls} ${l.lvl}${l.lvl_max ? '-' + l.lvl_max : ''}${l.applies ? ' (' + l.applies + ')' : ''}`).join(', ');
  if (lv) bits.push('Level: ' + escapeHTML(lv) + (s.mp ? ` (${s.mp} MP${s.mp_note ? '; ' + escapeHTML(s.mp_note) : ''})` : ''));
  for (const [label, v] of [['Components', s.components], ['Time', s.casting_time], ['Display', s.display], ['Range', s.range], ['Target', s.target], ['Area', s.area], ['Effect', s.effect], ['Duration', s.duration], ['Save', s.save], ['Resistance', s.resistance], ['PP', s.power_points], ['XP Cost', s.xp_cost]]) {
    if (v) bits.push(`<b>${label}:</b> ${escapeHTML(v)}`);
  }
  if (s.variants_note) bits.push(`<i>${escapeHTML(s.variants_note)}</i>`);
  if (s.damage) bits.push(`<b>Damage:</b> ${escapeHTML(s.damage.dice || '')} ${escapeHTML(DamageResolver.renderLabel(s.damage))}${s.damage.is_template ? ' (element chosen at cast)' : ''}`);
  return bits.join(' &nbsp;·&nbsp; ');
}

function renderPowers() {
  const prompt = document.getElementById('pw-prompt'), cont = document.getElementById('pw-content');
  if (!curId) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  const c = chars.find(x => x.id === curId); if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  // v8.6.0 split: self-heal the mode if the character lacks this side but has
  // the other (e.g. tab switch after a character change).
  if (_pwMode === 'spells' && !characterIsEntitledToSpells(c) && characterIsEntitledToPowers(c)) _pwMode = 'powers';
  else if (_pwMode === 'powers' && !characterIsEntitledToPowers(c) && characterIsEntitledToSpells(c)) _pwMode = 'spells';
  const modePools = _pwModePools();
  document.getElementById('pw-hero-nm').textContent = c.name + ' — ' + _pwSideLabel(c, _pwMode);

  const budget = getPowersBudget(c);
  const mpSt = getMPState(c);
  const cStats = computeCasterStats(c);
  // v8.82.0: the ✨ Supernatural Attributes panel (Powers side, super-capables).
  renderSuAttrPanel(c);
  // v8.83.0: the 🎭 Super-Talents sibling.
  renderSuperTalentPanel(c);
  let budgetHTML = Object.keys(budget).filter(pool => modePools.includes(pool)).length
    ? Object.entries(budget).filter(([pool]) => modePools.includes(pool)).map(([pool, b]) => {
        const pp = getPoolPPState(c, pool);
        const eff = POOL_EFF_LEVEL[pool];
        const effBit = eff ? `<span title="${eff.full}" style="cursor:help;">${eff.abbr} ${(cStats[pool] || {}).cl || 0}</span> · ` : '';
        // v8.31.1: ⚭ marks a Blended-Technique-united pool — the PP figure is
        // the UNITED total ("the two power point pools are added together",
        // GMG p.185), shared with the linked pool(s); the tooltip shows the
        // pool's own contribution.
        const blendBit = pp.blended
          ? ` <span style="cursor:help;color:#c8b3e0;" title="Blended Technique (Theurge): ${pp.blended.join(' + ')} power points are ONE united pool — this figure is the shared total (this pool's own share: ${pp.ownCurrent}/${pp.ownMax}). Spend on either art; memorization draws from the union at dawn.">⚭</span>`
          : '';
        // v8.34.0 (Adam's ruling): the per-spell-level split is ENFORCED at
        // add time (Gate 2.5) for matrix pools — the tooltip shows live
        // picked/allowed per level.
        const kbl = (b.knownByLvl || []);
        const pbl = kbl.some(n => n > 0) ? knownPickedByLevel(c, pool) : [];
        const kblBits = kbl.map((n, i) => n > 0 ? `lvl ${i}: ${pbl[i] || 0}/${n}` : null).filter(Boolean);
        const knownTitle = b.total !== null
          ? `Spells/powers known budget ${b.picked}/${b.total}${kblBits.length ? ' — per-level split (printed table, enforced at add): ' + kblBits.join(' · ') : ''}`
          : 'No known-count limit (prepared casters learn freely; Saints know all their domains)';
        // v8.41.0 (Adam's Heinrix report — "I had to resort to guessing"):
        // the per-level split lived only in the hover tooltip, which is
        // invisible information. Matrix pools (Sorcerer/Bard) now show the
        // split INLINE with ⚠ on levels holding unpicked selections; flat
        // pools (psionic classes — XPH-style by design: a TOTAL, spent on
        // any mix of levels you can manifest) show remaining + the mix rule.
        const ord = (n) => n === 0 ? '0th' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
        let splitBit = '';
        if (b.total !== null) {
          if (kbl.some(n => n > 0)) {
            splitBit = ' <span style="font-size:11px;opacity:.9;">— ' + kbl.map((n, i) => n > 0
              ? `${ord(i)} ${pbl[i] || 0}/${n}${(pbl[i] || 0) < n ? ' <b style="color:#e0a94a;">⚠</b>' : ''}`
              : null).filter(Boolean).join(' · ') + '</span>';
          } else if (b.picked < b.total) {
            splitBit = ` <span style="font-size:11px;color:#e0a94a;">— ${b.total - b.picked} unpicked ⚠ <span style="opacity:.75;">(any mix up to ${ord(b.maxPowerLvl)})</span></span>`;
          }
        }
        return `<span style="margin-left:10px;">${pool}: <b style="cursor:help;" title="${escapeHTML(knownTitle)}">${b.picked}${b.total !== null ? '/' + b.total : ''}</b> known${b.total === null ? ' (no limit)' : ''}${splitBit} · ${effBit}max ${pool === 'psionic' ? 'power' : 'spell'} lvl ${b.maxPowerLvl} · <b style="color:var(--pb90);">${pp.current}/${pp.max} PP</b>${blendBit}</span>`;
      }).join('')
    : ((_pwMode === 'powers' && getMPState(c).isSuperMutant) ? '' : `<span style="opacity:var(--o60);color:var(--dim);">no active ${_pwMode === 'spells' ? 'spellcasting' : 'manifesting'} pools</span>`);
  // v8.5.3: super-mutant segment — bought powers, banked MP, super-PP pool.
  // (v8.5.4 ergo: the "no active caster pools" placeholder is suppressed when
  // the super segment renders — they used to run together on one line.
  // v8.6.0 split: super lives on the Powers side only.)
  if (_pwMode === 'powers' && mpSt.isSuperMutant) {
    const spp = getSuperPPState(c);
    const owned = getCharPowers(c).filter(p => p.pool === 'super').length;
    budgetHTML += `<span style="margin-left:10px;color:#b58fd4;">super (${mpSt.tier ? mpSt.tier.tier : '?'}): <b>${owned}</b> owned · <span title="Effective Super Level (the HH’s ‘EML’): character level + Mutant level modifier — super-powers manifest at this level" style="cursor:help;">ESL ${mpSt.eml}</span> · <b>${mpSt.balance} MP</b> banked · <b>${spp.current}/${spp.max} PP</b></span>`;
  }
  // v8.5.4 Layer 4: one-click new day (all pools + super PP; AP untouched —
  // those refresh only on level-up).
  if (Object.keys(budget).length || mpSt.isSuperMutant) {
    budgetHTML += ` <button class="btn btn-sm" style="font-size:10px;margin-left:10px;border-color:rgba(220,205,138,.5);color:#dccd8a;" title="New day: refill every PP pool, re-memorize prepared lists, refill super PP. Action Points do NOT refresh (level-up only)." onclick="fullyRested()">☀ Fully Rested</button>`;
  }
  document.getElementById('pw-budget-line').innerHTML = budgetHTML;

  // v8.5.4: Domain Granted Powers panel — the chosen Cleric/Saint/Paladin
  // domains (DOMAINS_DB) with their granted-power text. A Druid-option
  // Cleric has no domains, so its Cleric picks are skipped.
  let domHost = document.getElementById('pw-domains');
  if (!domHost) {
    domHost = document.createElement('div');
    domHost.id = 'pw-domains';
    // v8.30.1: anchored AFTER the page tutorial (it used to wedge into the
    // header row above it — Adam's Heinrix report).
    const anchor = document.getElementById('powers-tut-panel') || document.getElementById('pw-budget-line');
    anchor.parentNode.insertBefore(domHost, anchor.nextSibling);
  }
  const domSources = [];
  // v8.6.0 split: domains are divine-side — the panel renders on Spells only.
  // v8.30.1: each source additionally gated on its class being present —
  // defense in depth behind reconcileOrphanSubOptions (the Heinrix bug put
  // Saint domains on a record with no Saint levels).
  if (_pwMode === 'spells') {
    const domOwned = new Set(migrateLegacyClasses(c).filter(e => (e.level||0) > 0).map(e => e.name));
    if (!c.druidOption && domOwned.has('Cleric')) for (const d of (c.clericDomains || [])) domSources.push(['Cleric', d]);
    if (domOwned.has('Saint')) for (const d of (c.saintDomains || [])) domSources.push(['Saint', d]);
    if (domOwned.has('Paladin')) for (const d of (c.paladinDomains || [])) domSources.push(['Paladin', d]);
  }
  domHost.innerHTML = domSources.length
    ? `<div style="margin-top:8px;padding:7px 10px;background:rgba(0,0,0,.18);border:1px solid rgba(200,151,30,.18);border-radius:3px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--g70);margin-bottom:4px;">Domain Granted Powers</div>
        ${domSources.map(([cls, d]) => {
          const dd = DOMAINS_DB.find(x => x.name === d);
          if (!dd) return '';
          return `<div style="font-size:11px;color:var(--g70);margin:3px 0;line-height:1.45;"><b style="color:var(--gold);">${escapeHTML(d)}</b> <span style="font-size:9px;color:var(--g45);">(${cls})</span>${dd.prerequisite ? ` <span style="color:#d4b870;font-size:10px;">[Prereq: ${escapeHTML(dd.prerequisite)}]</span>` : ''} — ${escapeHTML(dd.grantedPower)}</div>`;
        }).join('')}
      </div>`
    : '';

  // v8.6.0 split: the known list shows this mode's pools only, but the
  // cast/remove handlers keep the ORIGINAL repertoire indices (castPowerAt/
  // removePowerAt index into the unfiltered c.powers).
  const known = getCharPowers(c);
  const knownView = known.map((p, i) => ({ p, i })).filter(x => modePools.includes(x.p.pool));
  const byName = Object.fromEntries(SPELLS_DB.map(s => [s.name, s]));
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.57.0: the spontaneous casting surface, computed once per render —
  // decides which rows cast directly and which memorize (spells mode only;
  // psionic/super pools are always pay-at-cast).
  const npInfo = _pwMode === 'spells' ? nonPreppedPoolsInfo(c) : null;
  document.getElementById('pw-known-list').innerHTML = knownView.length
    ? knownView.map(({ p, i }) => {
        const s = byName[p.name];
        const key = p.name + '|' + p.pool;
        const open = _pwExpandedKnown.has(key);
        const adv = (p.advisory ? ` <span style="font-size:10px;color:#d4b870;cursor:help;" title="${escapeHTML(p.advisory)}">⚠</span>` : '')
          + (p.personal ? ` <span style="font-size:10px;color:var(--vio);cursor:help;" title="Personal Domain spell — a permanent, deity-approved addition to this Saint’s spell list (HH).">✦ Personal</span>` : '');
        // v8.5.2 Phase D: Cast button with live PP cost; dimmed (not blocked
        // — insufficient-PP has its own GM-exception flow) when short.
        let castBtn = '';
        if (s) {
          const isSuper = p.pool === 'super';
          const routes = isSuper ? [] : spellPoolOptions(s, poolsInfo).filter(o => o.pool === p.pool);
          const lvl = routes.length ? Math.min(...routes.map(o => o.lvl)) : ((s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : 1);
          const cost = (isSuper && p.buff) ? 0 : castCostFor(c, s, p.pool, lvl);
          const pp = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);
          const short = cost > pp.current;
          // v8.57.0 (Adam's playtest item #4): a prepared-only entry — no
          // surviving spontaneous route — MEMORIZES here (PP at dawn); the
          // cast itself is free, from the Prepared Spells panel above.
          const prepOnly = !isSuper && npInfo && (p.pool === 'arcane' || p.pool === 'divine') && routes.length
            && !spellPoolOptions(s, npInfo).some(o => o.pool === p.pool);
          castBtn = prepOnly
            ? `<button class="btn btn-sm" style="font-size:10px;${short ? 'opacity:.55;' : 'border-color:rgba(220,205,138,.5);color:rgba(220,205,138,.95);'}" title="Prepared caster — memorize at dawn (spends the PP); cast the memorized instance from the Prepared Spells panel (no further PP)." onclick="memorizeKnownAt(${i})">🌅 Memorize ${cost} PP</button>`
            : `<button class="btn btn-sm" style="font-size:10px;${short ? 'opacity:.55;' : (p.buff ? 'border-color:var(--g55);color:#d4b870;' : 'border-color:rgba(120,175,205,.5);color:rgba(120,175,205,.95);')}" title="${short ? 'Insufficient PP — casting will prompt for a GM exception' : (p.buff ? 'Perpetual Buff — always manifested at no PP; invoke to augment for a scene (the ⏻ suppression toggle lives on the Sheet ✨ panel)' : 'Cast / manifest')}" onclick="castPowerAt(${i})">${p.buff ? '◉' : '⚡'} ${cost} PP</button>`;
        }
        return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="cursor:pointer;flex:1;" onclick="togglePwKnownDetail('${escapeHTML(key).replace(/'/g, "\\'")}')"><b>${escapeHTML((s && p.token) ? displayNameForRoute(s, {token: p.token, lvl: p.lvl, pool: p.pool, applies: p.applies}) : p.name)}</b>${(s && p.token && displayNameForRoute(s, {token: p.token, lvl: p.lvl, pool: p.pool, applies: p.applies}) !== p.name) ? ` <span style="font-size:10px;opacity:var(--o50);color:var(--dim);">(${escapeHTML(p.name)})</span>` : ''} <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">(${p.pool})</span>${adv}${s ? powerPrereqBadge(s, c) : ''} <span style="font-size:10px;opacity:var(--o40);color:var(--dim);">${open ? '▾' : '▸'}</span></div>
            ${castBtn}
            <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removePowerAt(${i})">✕</button>
          </div>
          ${open && s ? `<div style="font-size:11px;opacity:.75;margin-top:4px;line-height:1.5;">${spellStatLine(s)}</div><div style="font-size:11.5px;margin-top:5px;line-height:1.55;color:var(--parch);">${escapeHTML(s.d)}</div>` : ''}
        </div>`;
      }).join('')
    : `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">No ${_pwMode === 'spells' ? 'spells' : 'powers'} known yet — browse the catalogue below.</div>`;

  // v8.6.0 split: preparation is spell-side (every prep class is arcane/divine).
  if (_pwMode === 'spells') renderPrepPanel(c);
  else { const ph = document.getElementById('pw-prep'); if (ph) ph.innerHTML = ''; }
  renderPowersBrowse();
}

