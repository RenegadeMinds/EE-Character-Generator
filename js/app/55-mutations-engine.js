// =============================================================================
// js/app/55-mutations-engine.js
// MUTATIONS ENGINE
// =============================================================================
//
// WHAT'S IN HERE
//   Mutations: the Mutation Point economy, super-power purchases with banked
//   MP, and mutation mechanical effects.
//
// KEY NAMES (so you can search for them)
//   tables/objects: UNSTABLE_MP, SUPER_RUNGS, ATTR_FULL, ATTR_KEY_IDX,
//   MUTATION_EFFECTS
//   functions (26): hasFeatNamed, getCharMutations, getMPState,
//   getSuperPPState, spendSuperPP, restSuperPPClick,
//   characterIsEntitledToMutations, superBuySpec, suiteDiscountFor,
//   superBuyEligibility, grantComplimentarySuperPowers, buySuperPower,
//   toggleMuBrowse, renderMutationEffects, buildMutationBonuses,
//   computeMutationEffects, reconcileAttributeMutations,
//   mutationPrereqProblems, addMutationFromBrowse, removeMutationAt,
//   addMPGrantClick, setSuperMutantTier, reconcileMutantLevelXp, refreshEclXp,
//   toggleMuDetail, renderMutations
//
// LOAD ORDER
//   File 55 of 68. index.html loads it after js/app/54-powers-repertoire.js
//   and before js/app/56-supernatural-attributes-pools-psi-focus.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 46503-47259 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 46503-47259; unchanged below this line ----
// ============================================================================
// v8.5.3 MUTATIONS PASS — the MP economy (HH Ch.IX pp.410-424), Layer 3 live.
// Character data (all lazily defaulted, no schemaVer bump — house convention):
//   c.mutations[]      {name, kind:'advantage'|'drawback'|'attribute', mp, attr?, grantedAt}
//   c.mpGrants[]       {amount, reason, atDate}  — GM grants as discrete events
//   c.superMutantTier  'minor'|'moderate'|'major'|'mega' (with Supernatural Mutation feat)
//   c.superPPCurrent   current super-power point pool (undefined = full)
//   c.powers[] pool:'super' entries: {name, pool:'super', mp, buff?, free?, via?}
// The ledger is COMPUTED, never stored: ownership IS the spend.
// ============================================================================

const UNSTABLE_MP = { 'Unstable Mutation I': 2, 'Unstable Mutation II': 4, 'Unstable Mutation III': 6, 'Unstable Mutation IV': 8, 'Unstable Mutation V': 10 };

function hasFeatNamed(c, n) { return ((c && c.feats) || []).some(f => (f.name || f.n) === n); }
function getCharMutations(c) { return (c && c.mutations) || []; }

function getMPState(c) {
  const sources = [];
  let drawbacks = 0, featGrants = 0, gmGrants = 0;
  for (const m of getCharMutations(c)) if (m.kind === 'drawback') drawbacks += m.mp || 0;
  if (drawbacks) sources.push(`Drawbacks +${drawbacks}`);
  if (hasFeatNamed(c, 'Slightly Different')) { featGrants += 2; sources.push('Slightly Different +2'); }
  const isSuperMutant = hasFeatNamed(c, 'Supernatural Mutation');
  // v8.80.0 (Adam's unification ruling, 2026-10-03): c.superMutantTier is
  // the STARTING MP PACKAGE chosen when the feat is taken (HH p.249's
  // "choose a mutation level with your GM's permission" — Scale-capped);
  // the CLASSIFICATION itself derives from the Mutant racial level
  // modifier below. At genesis the two coincide (the 10-MP package IS
  // ML +1); growth thereafter promotes automatically.
  const pkgKey = (c && c.superMutantTier) || 'minor';
  if (isSuperMutant) {
    const pkg = MUTATION_RULES.super_mutant_tiers.find(t => t.tier.toLowerCase() === pkgKey) || MUTATION_RULES.super_mutant_tiers[0];
    featGrants += pkg.mp_grant;
    sources.push(`Supernatural Mutation (${pkg.tier} package) +${pkg.mp_grant}`);
  }
  for (const fn in UNSTABLE_MP) if (hasFeatNamed(c, fn)) { featGrants += UNSTABLE_MP[fn]; sources.push(`${fn} +${UNSTABLE_MP[fn]}`); }
  for (const g of ((c && c.mpGrants) || [])) { gmGrants += g.amount || 0; }
  if (gmGrants) sources.push(`GM grants +${gmGrants}`);

  let mutSpent = 0, superSpent = 0, talentSpent = 0;
  for (const m of getCharMutations(c)) if (m.kind !== 'drawback') mutSpent += m.mp || 0;
  for (const p of getCharPowers(c)) if (p.pool === 'super' && !p.free) superSpent += p.mp || 0;
  for (const te of ((c && c.talents) || [])) {
    const td = TALENTS_DB.find(x => x.n === te.name);
    if (td && td.mp_cost) talentSpent += td.mp_cost;
  }
  const totalEarned = drawbacks + featGrants + gmGrants;
  const totalSpent = mutSpent + superSpent + talentSpent;
  // "Every 10 MP gives the character a +1 Mutant racial level modifier" (p.423)
  const mutantLevel = Math.floor(totalEarned / 10);
  // v8.80.0 (Adam's unification ruling): the CLASSIFICATION TRACKS THE RLM
  // — the HH p.423 tier definitions are written in the present tense of
  // the modifier (Minor = ML 0, Moderate = +1, Major = +2, Mega = +3+),
  // uniformly across all four MP routes (template, feats, Drawbacks, GM
  // grants). Mutant templating itself = the feat OR 10+ total MP (Adam:
  // the Drawback-dabbler and the Slightly Different are different, not
  // Mutants — 10 MP is where mutation becomes ontology). The Scale caps
  // the total; crossing a 10-threshold promotes the shopping window
  // automatically (the ML machinery — ECL bump, XP compensation,
  // Unnatural bakes — already rides this same floor).
  const tierKey = mutantLevel >= 3 ? 'mega' : mutantLevel === 2 ? 'major' : mutantLevel === 1 ? 'moderate' : 'minor';
  return {
    sources, drawbacks, featGrants, gmGrants, mutSpent, superSpent, talentSpent,
    totalEarned, totalSpent, balance: totalEarned - totalSpent,
    mutantLevel, eml: ((c && c.totalLvl) || 1) + mutantLevel,
    isSuperMutant, tierKey, pkgKey,
    isMutantTemplated: isSuperMutant || totalEarned >= 10,
    tier: MUTATION_RULES.super_mutant_tiers.find(t => t.tier.toLowerCase() === tierKey) || MUTATION_RULES.super_mutant_tiers[0],
  };
}

// Super-PP/day = MP + EML² + bonusPP(Wis, EML); Minor tier halves the total
// (HH p.423-424). bonusPP mirrors computeCasterStats' ceil(mod × CL / 2).
function getSuperPPState(c) {
  const st = getMPState(c);
  if (!st.isSuperMutant) return { current: 0, max: 0 };
  const wisMod = am(((c && c.attrs) || [10, 10, 10, 10, 10, 10])[4]);
  let max = st.totalEarned + st.eml * st.eml + Math.max(0, Math.ceil(wisMod * st.eml / 2));
  if (st.tier.pp_multiplier === 0.5) max = Math.floor(max / 2);
  // v8.5.4 EAL pass: Power Reservoir taken on the super pool — bonus PP equal
  // to character level (the psionic take lands in computeCasterStats). Added
  // AFTER the Minor-tier halving: the feat's PP aren't part of the tier's pool.
  if ((c && c.feats || []).some(f => (f.name || f.n || f) === 'Power Reservoir' && f.param === 'super')) {
    max += (c.totalLvl || 0);
  }
  const current = Math.min((c && c.superPPCurrent) ?? max, max);
  return { current, max };
}
function spendSuperPP(c, amount) {
  const s = getSuperPPState(c);
  const take = Math.min(s.current, amount);
  c.superPPCurrent = s.current - take;
  return take;
}
function restSuperPPClick() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.superPPCurrent = getSuperPPState(c).max;
  save(); renderMutations(); renderPowers();
  toast('Super-power points restored.');
}

function characterIsEntitledToMutations(c) {
  if (!c) return false;
  if (getCharMutations(c).length || ((c.mpGrants || []).length) || hasFeatNamed(c, 'Supernatural Mutation') || hasFeatNamed(c, 'Slightly Different')) return true;
  if (Object.keys(UNSTABLE_MP).some(fn => hasFeatNamed(c, fn))) return true;
  return ((c.sixLevels && c.sixLevels.mutation) || 0) >= MUTATION_RULES.availability.mutation_scale_min;
}

// ----- super-power purchases (surfaced on the Powers tab, per Adam) -----
// v8.8.0 (Adam's report — Bull's Strength/Cat's Grace offered no Buy
// button): VARIANT entries (the Animal Affinity attribute family, the
// recovered bare-Level records) carry mp:null — their MP cost and identity
// live on the PARENT ("Animal Affinity is the one-size-fits-all attribute
// power"). For super-power purchase, a variant inherits the parent's MP
// cost, level identity, and Buff note.
// v8.80.0 (Adam's seller's-market ruling, 2026-10-03): the HH p.424
// "Supernatural Mutation List by MP Cost" is the CANONICAL purchase
// catalogue, and for the merged scaling families it prices EACH RUNG —
// the entry's printed (N MP) is only the bottom rung. Buying the full
// scaling capability costs its full upfront price ("pay more upfront for
// a more powerful ability down the road" — anti-cherry-picking; the same
// doctrine that prices Fly at its expensive equivalent). Rungs verbatim
// from p.424; the purchase flow prompts which rung is being bought.
const SUPER_RUNGS = {
  'Charm Being': [['Charm Animal / Charm Person', 2], ['Charm Being — full, scales to Monster', 8]],
  'Hold Being': [['Hold Animal / Hold Person', 4], ['Hold Being — full', 10]],
  'Dominate Being': [['Dominate Animal', 6], ['Dominate Person', 10], ['Dominate Being — full', 20]],
  'Planar Ally': [['Planar Ally, Lesser', 8], ['Planar Ally', 12], ['Planar Ally, Greater', 16]],
  'Suggestion (Mass)': [['Suggestion', 4], ['Suggestion, Mass', 10]],
  'Summon Monster (I-IX)': [['Summon Monster I-V', 10], ['Summon Monster I-IX', 20]],
  'Summon Nature’s Ally (I-IX)': [['Summon Nature’s Ally I-V', 10], ['Summon Nature’s Ally I-IX', 20]],
  'Astral Construct': [['Astral Construct I-V', 10], ['Astral Construct I-IX', 20]],
  'Inflict Wounds': [['Light', 2], ['Moderate', 4], ['Serious', 6], ['Critical', 8], ['Mass — Light', 10], ['Mass — Moderate', 12], ['Mass — Serious', 14], ['Mass — Critical', 16]],
  // Cure is DELIBERATELY asymmetric to Inflict (Adam's catch, 2026-10-03):
  // no cheap healing rung exists — at-will permanent healing deletes
  // attrition, so the suite bundles at an 8 MP floor ("includes all Cure
  // Wounds options below purchased tier"). The seller's market, applied
  // to mercy. Two rungs only, per p.424.
  'Cure Wounds': [['Cure Wounds — up to Critical (all lower tiers included)', 8], ['Mass Cure Wounds — up to Critical (all lower tiers included)', 16]],
};
function superBuySpec(spell) {
  if (spell.mp != null) return { mp: spell.mp, levels: spell.levels, mpNote: spell.mp_note, via: null, rungs: SUPER_RUNGS[spell.name] || null };
  const v = VARIANT_NAMES[spell.name];
  if (v) {
    const parent = SPELLS_DB.find(x => x.name === v.parent);
    if (parent && parent.mp != null) return { mp: parent.mp, levels: parent.levels, mpNote: parent.mp_note, via: parent.name };
  }
  return { mp: null, levels: spell.levels, mpNote: spell.mp_note, via: null };
}
// v8.75.0 (Adam's ruling): the HH p.670 SUITE DISCOUNT — "once a character
// has two powers from the same super-power suite, any further super-powers
// taken from that same suite cost 1 MP less." Flat −1 per the book's
// wording (never stacks across multiple qualifying suites); floor 1 MP (a
// power never becomes free). Ownership counts SUPER-pool records only (the
// rule is about super-powers); membership via the variant-expanded theme
// sets. Historical purchases keep their paid price — removing an anchor
// power later never retro-reprices earlier buys (GM territory).
function suiteDiscountFor(c, spell) {
  const sets = _powerThemeSets();
  const owned = (c.powers || []).filter(p => p.pool === 'super').map(p => p.name);
  let best = null;
  for (const th in sets) {
    const s = sets[th];
    if (!s.has(spell.name)) continue;
    const n = owned.filter(nm => s.has(nm) && nm !== spell.name).length;
    if (n >= 2 && (!best || n > best.count)) best = { suite: th, count: n };
  }
  return best;
}
function superBuyEligibility(c, spell) {
  const st = getMPState(c);
  if (!st.isSuperMutant) return { ok: false, why: 'requires the Supernatural Mutation feat' };
  if (((c.sixLevels && c.sixLevels.mutation) || 0) < MUTATION_RULES.availability.super_powers_mutation_scale_min)
    return { ok: false, why: 'requires a Mutation Scale 5+ scenario' };
  const spec = superBuySpec(spell);
  if (spec.mp === null || spec.mp === undefined) return { ok: false, why: 'no MP cost listed' };
  const specLevels = spec.levels;
  const minLvl = (specLevels && specLevels.length) ? Math.min(...specLevels.map(l => l.lvl)) : 1;
  const [lo, hi] = st.tier.spell_levels;
  // v8.80.0 (found via Adam's Cure Wounds question): the band's LOWER bound
  // must not gate — it blocked every 0-level purchase (and Cure Wounds,
  // whose merged entry carries its Cure Minor 0-level rung) at EVERY tier.
  // A cantrip is beneath no one's tier; only the ceiling gates.
  if (minLvl > hi) return { ok: false, why: `${st.tier.tier} tier reaches level ${lo}-${hi} only (this is level ${minLvl})` };
  // Tier cap tests the power's BASE cost (the cap is a magnitude gate — a
  // suite discount cheapens the price, not the power).
  if (st.tier.max_mp_per_power !== null && spec.mp > st.tier.max_mp_per_power)
    return { ok: false, why: `${st.tier.tier} tier caps single-power cost at ${st.tier.max_mp_per_power} MP (this costs ${spec.mp})` };
  // v8.75.0: apply the suite discount to the price actually paid.
  const disc = suiteDiscountFor(c, spell);
  const mpPay = disc ? Math.max(1, spec.mp - 1) : spec.mp;
  // v8.80.0: rung families — the button quotes the tier-legal rung range;
  // the purchase flow prompts the rung (eligibility above tested the
  // CHEAPEST rung, so a family stays visible while any rung is legal).
  const cap = st.tier.max_mp_per_power;
  const legalRungs = spec.rungs ? spec.rungs.filter(r => cap == null || r[1] <= cap) : null;
  return { ok: true, minLvl, mp: mpPay, mpBase: spec.mp, suite: disc ? disc.suite : null, suiteOwned: disc ? disc.count : 0, via: spec.via,
    rungs: legalRungs && legalRungs.length ? legalRungs : null,
    rungsBlocked: spec.rungs ? spec.rungs.length - (legalRungs ? legalRungs.length : 0) : 0 };
}

// Complimentary super-powers ("includes X and Y" MP notes) cascade for free,
// recursively (HH p.423). Visited-set guards cycles.
function grantComplimentarySuperPowers(c, spell, via, visited) {
  const notes = (spell.mp_note || '').split(' | ');
  for (const note of notes) {
    const m = note.match(/includes\s+(.+)$/i);
    if (!m) continue;
    for (const raw of m[1].split(/,| and |\//).map(s => s.trim()).filter(s => s.length > 2)) {
      // '&' ↔ 'and' must compare equal: mp_notes write "Know Direction &
      // Location" (ampersand dodges the list-splitter) but the SPELLS_DB
      // entry is "Know Direction and Location".
      const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
      const child = SPELLS_DB.find(x => norm(x.name) === norm(raw) || norm(x.name).startsWith(norm(raw)));
      if (!child || visited.has(child.name)) continue;
      visited.add(child.name);
      if (!c.powers.some(p => p.name === child.name && p.pool === 'super')) {
        c.powers.push({ name: child.name, pool: 'super', mp: 0, free: true, via, buff: /(^|[;|])\s*Buff\b/i.test(child.mp_note || '') || undefined, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } });
      }
      grantComplimentarySuperPowers(c, child, child.name, visited);
    }
  }
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
const ATTR_FULL = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
const ATTR_KEY_IDX = { STR: 0, DEX: 1, CON: 2, INT: 3, WIS: 4, CHA: 5 };

// ============================================================================
// v8.6.0 MUTATION MECHANICAL EFFECTS (Adam's audit directive) — the full
// Advantage/Drawback catalog classified: always-on numeric effects wire into
// the typed-bonus engine (skills Misc column, saves, natural AC — the same
// channels feats/talents/items use); conditional numbers ride as condition
// entries (tooltip adjudication, the Layer-2 convention); everything else
// (senses, natural attacks, activated abilities, narrative burdens) surfaces
// as display strings via computeMutationEffects. Positive entries carry the
// book's "mutation bonus" type (non-stacking within type); penalties are
// untyped (d20: penalties stack).
// Attribute-family (+4 tiers) is handled separately by
// reconcileAttributeMutations (bake-into-c.attrs); Ability Decay's −2 bakes
// the same way via the add-flow picker.
const MUTATION_EFFECTS = {
  // — wired: skills —
  'Elasticity':           {skills:{'Escape Artist':10}, notes:['can squeeze through openings 1/10 your height/width (see entry)']},
  'Extra Arms':           {skills:{'Climb':4}, notes:['+4 mutation bonus on grapple checks', 'extra arms can hold (not fight with) items']},
  'Gazing Eye':           {skills:{'Search':2,'Spot':2}, active:['gaze attack (free action, see entry)']},
  'Hypersensitivity':     {skills:{'Listen':2,'Search':2,'Spot':2}, notes:['Blind-Fight as a bonus feat']},
  'Leaper':               {skills:{'Jump':10}},
  'Prehensile Tail':      {skills:{'Balance':2}, notes:['tail can grasp/manipulate a simple object one size smaller than you']},
  'Tail':                 {skills:{'Balance':2}, natural:['tail slam — bludgeoning: S 1d4 / M 1d6 / L 1d8']},
  'Wall Crawler':         {skills:{'Climb':4}, notes:['climbs perfectly smooth vertical surfaces bare-handed']},
  'Webbed Digits':        {skills:{'Swim':4}},
  'Lost Arm':             {skills:{'Climb':-2,'Swim':-2}, notes:['cannot wield two-handed weapons (see entry)']},
  'Pheromone Attraction': {condSkills:{'Bluff':[4,'vs creatures within 30 ft'],'Diplomacy':[4,'vs creatures within 30 ft'],'Handle Animal':[4,'vs creatures within 30 ft'],'Intimidate':[4,'vs creatures within 30 ft']}},
  'Pheromone Repulsion':  {condSkills:{'Diplomacy':[-4,'vs creatures within 30 ft'],'Handle Animal':[-4,'vs creatures within 30 ft']}},
  'Light Sensitivity':    {condSkills:{'Search':[-1,'in bright light'],'Spot':[-1,'in bright light']}, notes:['blinded 1 round by abrupt bright light; −1 on attacks in bright light']},
  'Tentacle':             {notes:['+4 mutation bonus on grapple checks','tentacle can grasp/manipulate objects of your size or smaller']},
  // — wired: saves —
  'Frailty':              {saves:{fort:-2}},
  'Lethargy':             {saves:{ref:-2}},
  'Mindslave':            {saves:{will:-2}},
  'Thick Fur Coat':       {condSaves:{fort:[4,'vs extreme cold']}},
  'Weak Immune System':   {condSaves:{fort:[-2,'vs poison, disease, radiation sickness']}},
  // — wired: natural armor (flows into T/ACtical + the ×5-HP rule) —
  'Exoskeleton':          {naturalAC:3},
  'Scaly Armor':          {naturalAC:2},
  // — natural attacks (display) —
  'Claws':                {natural:['claw — slashing: S 1d4 / M 1d6 / L 1d8']},
  'Fangs':                {natural:['bite — piercing: S 1d4 / M 1d6 / L 1d8']},
  'Great Horns':          {natural:['gore — bludgeoning or piercing: S 1d4 / M 1d6 / L 1d8']},
  'Stinger':              {natural:['sting — piercing: S 1d4 / M 1d6 / L 1d8']},
  'Acidic Saliva':        {natural:['bite rider — +1d4 acid on successful bite hits']},
  'Prickly Pear':         {natural:['1d4 piercing to grapplers and unarmed attackers (see entry)']},
  'Venomous Bite':        {natural:['bite venom — Fort DC 10 + ½ level + Con mod (see entry)']},
  // — senses & movement (display) —
  'Darkvision':           {senses:['darkvision 60 ft']},
  'Echolocator':          {senses:['blindsight 60 ft']},
  'Scent':                {senses:['scent']},
  'X-Ray Vision':         {senses:['x-ray vision (materials/thickness per entry)']},
  'Gills':                {senses:['amphibious — breathes air and water']},
  'Wings':                {senses:['fly 60 ft, average maneuverability (wired — Sheet Speed cell)']},
  'Reduced Speed':        {notes:['speed −5 ft, all movement modes (wired — Sheet Speed cell)']},
  // — defenses & thresholds (display; DR/MDT are table-adjudicated) —
  'Energy Absorption':    {notes:['energy resistance 10 to two types OR 20 to one (chosen at acquisition — wired to the Sheet Resistances panel)']},
  'Energy Diffusion':     {notes:['energy resistance 5 to two types OR 10 to one (chosen at acquisition — wired to the Sheet Resistances panel)']},
  'Force Barrier':        {active:['DR 3/– vs weapon attacks while the barrier is up (free action)']},
  'Skeletal Reinforcement': {notes:['DR 3/bludgeoning','massive damage threshold +3','falling damage reduced (see entry)']},
  'Brittle Bones':        {notes:['massive damage threshold −3','+1d6 damage from falls']},
  'Thin Skin':            {notes:['+1 damage each time you are wounded']},
  // v8.8.0 correction (HH p.416 verbatim): the drawback hits MOBILITY in
  // armor, not the armor bonus — max Dex −2 and armor check penalty +4
  // while wearing any armor. Wired mechanically via armorMaxDexCap and
  // nonProficientArmorPenalty now that both are measurables.
  'Festering Sores':      {notes:['while wearing any armor: its maximum Dex bonus −2 and its armor check penalty worsens by 4 (wired)']},
  'Heat/Cold Susceptibility': {notes:['double damage from prolonged extreme heat or cold']},
  'Enlarged Form':        {notes:['functions as the next-larger size category in several respects (see entry)']},
  // — activated abilities (display) —
  'Adrenaline Jolt':      {active:['1/day free action: +1d4+1 STR or DEX (duration per entry)']},
  'Second Wind':          {active:['1/day free action: heal Con mod + character level HP']},
  'Telekinetic Mind':     {active:['move a ≤5 lb object 15 ft as a move action']},
  'Telepathy':            {active:['telepathic link with a creature within 100 ft (see entry)']},
  'Vexing Voice':         {active:['voice-borne vex attack within 30 ft (see entry)']},
  'Radioactive':          {notes:['immune to mild/low/moderate radiation; body stores radiation (see entry)']},
  'Ultra Immune System':  {notes:['Ultra Immune System as a bonus feat (prereqs waived)']},
  'Multi-Talented':       {notes:['+1 cross-class Hero talent (counted in the Talent budget)']},
  // — narrative burdens (display) —
  'Blood Hunger':         {notes:['must drain a pint of blood every 24 h (see entry)']},
  'Neutrad Dependency':   {notes:['daily neutrad dose or Fort DC 15 (see entry)']},
  'Poisonous Blood':      {notes:['daily antitox dose or Fort DC 15 vs Con damage (see entry)']},
  'Cyber-Dependency':     {notes:['requires a body repair weave to heal naturally (see entry)']},
  'Rapid Aging':          {notes:['effective age = double actual (penalties only; no aging benefits)']},
  'Ultraviolet Allergy':  {notes:['2d6 fire per round in UV light / direct sunlight (see entry)']},
  'Combat Fear':          {notes:['Will DC 15 when combat starts or shaken (see entry)']},
  'Ability Decay':        {notes:['−2 to the chosen (lowest) ability — baked into the score on add']},
};

// Typed-bonus contributions from owned mutations, keyed by target — merged
// into the same engine feats/talents/items feed. Adam's ruling (2026-09-01):
// Advantage bonuses are EXTRAORDINARY (Ex) modifiers, not a "mutation"
// stacking type — so they carry UNTYPED (different sources stack: Tail +
// Prehensile Tail = +4 Balance; Scaly Armor + Exoskeleton NAC stack, matching
// Exoskeleton's "improves by 3" text). Penalties are untyped too (d20:
// penalties stack). Unique-by-source dedup still applies.
function buildMutationBonuses(c) {
  const out = {};
  if (!c || !c.mutations) return out;
  const push = (target, value, label, condition) => {
    (out[target] = out[target] || []).push({
      type: BONUS_TYPES.UNTYPED,
      source: 'mutation:' + label, value, label: label + ' (Ex)',
      ...(condition ? { condition } : {}),
    });
  };
  for (const m of c.mutations) {
    const fx = MUTATION_EFFECTS[m.name];
    if (!fx) continue;
    // v8.91.0 (task 3): a cybernetic Prosthetic Arm replaces the lost arm —
    // the −2 Climb/Swim (and grapple) penalties lift with the replacement
    // (HH p.332: replacements duplicate the biological counterpart).
    if (m.name === 'Lost Arm' && hasCyberArm(c)) continue;
    for (const sk in (fx.skills || {})) push('skill:' + sk, fx.skills[sk], m.name);
    for (const sk in (fx.condSkills || {})) push('skill:' + sk, fx.condSkills[sk][0], m.name, fx.condSkills[sk][1]);
    for (const sv in (fx.saves || {})) push(sv, fx.saves[sv], m.name);
    for (const sv in (fx.condSaves || {})) push(sv, fx.condSaves[sv][0], m.name, fx.condSaves[sv][1]);
    if (fx.naturalAC) push('naturalAC', fx.naturalAC, m.name);
  }
  return out;
}

// Display-tier effect lines for the Mutations tab panel + sheet block.
// Returns [{group, text, from}] grouped as senses/natural/active/notes.
function computeMutationEffects(c) {
  const out = [];
  for (const m of ((c && c.mutations) || [])) {
    const fx = MUTATION_EFFECTS[m.name];
    if (!fx) continue;
    for (const [group, list] of [['Senses & Movement', fx.senses], ['Natural Attacks', fx.natural], ['Activated', fx.active], ['Notes', fx.notes]]) {
      for (const text of (list || [])) out.push({ group, text, from: m.name + (m.attr ? ` (${m.attr})` : '') });
    }
  }
  return out;
}

// v8.6.0 (Adam's report — Rhad's Extraordinary Dexterity): the Extraordinary/
// Supernatural [Attribute] mutation family now applies MECHANICALLY. Same
// convention as level bumps: c.attrs IS the effective array — each
// attribute-kind mutation bakes its +4 in when gained (rec.attrApplied
// stores the applied delta) and reverses when removed, so every downstream
// consumer (saves, AC, init, skills, caster DCs, bonus PP) is automatically
// correct. This reconciler also migrates already-owned records that predate
// the wiring — idempotent via the attrApplied flag. The sheet annotates the
// bonus per attribute (supernatural tiers noted as suppressible).
function reconcileAttributeMutations(c) {
  // v9.9.1 (§260): the old guard bounced mutation-less characters before the
  // cybernetic NAC bake could run — a pure-tech cyborg (Adam's Smart Hero)
  // never reached it. Only a missing character bounces now.
  if (!c) return false;
  let changed = false;
  for (const m of (c.mutations || [])) {
    if (m.kind !== 'attribute' || m.attrApplied || !m.attr) continue;
    const i = ATTR_KEY_IDX[m.attr];
    if (i === undefined) continue;
    if (!Array.isArray(c.attrs)) c.attrs = [10, 10, 10, 10, 10, 10];
    c.attrs[i] = (c.attrs[i] || 10) + 4;
    m.attrApplied = 4;
    changed = true;
  }
  // v8.6.0 (Adam's ruling, the Scaly Armor HP question): permanent
  // mutation-granted natural armor bakes its ×5 HP into max HP (hard-baked
  // door — mutations are permanent). Delta-reconciled against
  // c.mutNacHpApplied so add, remove, migration, AND the edit-save maxHP
  // recompute (which zeroes the field before re-reconciling) all converge.
  // Equipped-item NAC deliberately grants NO HP (firm-wired door; temporary).
  const expected = (c.mutations || []).reduce((s, m) =>
    s + ((MUTATION_EFFECTS[m.name] && MUTATION_EFFECTS[m.name].naturalAC) || 0) * 5, 0);
  const applied = c.mutNacHpApplied || 0;
  if (expected !== applied && typeof c.maxHP === 'number' && isFinite(c.maxHP)) {
    const delta = expected - applied;
    c.maxHP = Math.max(1, c.maxHP + delta);
    if (typeof c.currentHP === 'number' && isFinite(c.currentHP)) {
      c.currentHP = Math.max(0, Math.min(c.maxHP, c.currentHP + delta));
    }
    c.mutNacHpApplied = expected;
    changed = true;
  }
  // v9.9.1 (§260, Adam's Smart Hero report — subq armor hardness showed, its
  // HP didn't): CYBERNETIC natural armor is an IMPLANT — permanent, so it
  // bakes its ×5 HP exactly like mutation NAC (Adam's subcutaneous-body-armor
  // ruling, the hard-baked door), on its own delta ledger c.cybNacHpApplied
  // (NOT edit-preserved, same convention as mutNacHpApplied). Equipped-ITEM
  // NAC still deliberately grants no HP (firm-wired door; removable).
  const expectedCyb = (getCyber(c)).reduce((s, r) => {
    const d = cyberDef(r.n);
    return s + ((d && d.nac) || 0) * 5;
  }, 0);
  const appliedCyb = c.cybNacHpApplied || 0;
  if (expectedCyb !== appliedCyb && typeof c.maxHP === 'number' && isFinite(c.maxHP)) {
    const deltaCyb = expectedCyb - appliedCyb;
    c.maxHP = Math.max(1, c.maxHP + deltaCyb);
    if (typeof c.currentHP === 'number' && isFinite(c.currentHP)) {
      c.currentHP = Math.max(0, Math.min(c.maxHP, c.currentHP + deltaCyb));
    }
    c.cybNacHpApplied = expectedCyb;
    changed = true;
  }
  return changed;
}

function mutationPrereqProblems(c, mut, attr) {
  const problems = [];
  if (mut.kind === 'attribute') {
    const owned = getCharMutations(c);
    const has = (n) => owned.some(m => m.name === n && m.attr === attr);
    if (mut.name.startsWith('Supernatural') && !hasFeatNamed(c, 'Supernatural Mutation')) problems.push('requires the Supernatural Mutation feat');
    if (mut.name === 'Supernatural [Attribute] I' && !has('Extraordinary [Attribute]')) problems.push(`requires Extraordinary [Attribute] on ${attr}`);
    for (const [tier, prev] of [['II', 'I'], ['III', 'II'], ['IV', 'III']]) {
      if (mut.name === `Supernatural [Attribute] ${tier}` && !has(`Supernatural [Attribute] ${prev}`)) problems.push(`requires Supernatural [Attribute] ${prev} on ${attr}`);
    }
  }
  if (mut.techMin) problems.push(`has a minimum Tech Scale requirement (see text — GM confirm)`);
  return problems;
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

// v8.5.4: ML → ECL XP compensation (Adam's slope-only ruling, 2026-08-24).
// GMG p.38 keys XP thresholds off ECL — "incorporate racial level modifiers
// (including Mutant levels)" — which would make a mid-career Mutant Level
// gain an instant cliff: the next class level suddenly costs a full ECL-step
// more. Ruling: each ML threshold crossed AFTER character creation grants
// the immediate threshold gap (1,000 × (ECL+1) XP — the quadratic step),
// converting the cliff into the gentle career-long slope the p.38 drow
// example describes. Creation-time ML is the uncompensated baseline (chosen
// knowingly, like a drow's race LA). No clawback: if MP sources are later
// removed, granted XP stays — c.mlXpCompensatedTo only ratchets up.
function reconcileMutantLevelXp(c) {
  if (!c) return;
  const ml = getMPState(c).mutantLevel;
  if (typeof c.mlXpCompensatedTo !== 'number') {
    // First reconcile for this character (creation save, or first touch of a
    // pre-v8.5.4 character): current ML becomes the baseline, no grant.
    c.mlXpCompensatedTo = ml;
    return;
  }
  if (ml <= c.mlXpCompensatedTo) return;
  const raceEcl = raceEclOf(c);  // v8.68.0: Hybrid-aware
  let grant = 0;
  for (let k = c.mlXpCompensatedTo + 1; k <= ml; k++) {
    const eclBefore = (c.totalLvl || 1) + raceEcl + (k - 1);
    grant += xpThreshold(eclBefore + 2) - xpThreshold(eclBefore + 1); // = 1000 × (eclBefore + 1)
  }
  c.xp = (c.xp || 0) + grant;
  c.mlXpCompensatedTo = ml;
  logActionEvent(c, 'xp-grant', grant, 'Mutation milestone',
    `Mutant Level rose to +${ml} — ECL increased; +${grant.toLocaleString()} XP compensation (slope rule, GMG p.38)`);
  toast(`Mutation milestone: Mutant Level +${ml} — ECL rises, +${grant.toLocaleString()} XP granted.`);
}

// v8.5.4: the canonical ECL/XP refresh — single source for every site that
// recomputes a character's level-derived fields. Settles ML compensation
// first (so any threshold crossing is granted before ECL is read), then keys
// ECL and XP-to-next off the full GMG p.38 formula.
function refreshEclXp(c) {
  if (!c) return;
  reconcileMutantLevelXp(c);
  // v9.15.2 (§275 F3): records without a stamped c.totalLvl (imports,
  // hand-built) derive it from the class array — HH p.22 keys ECL off class
  // levels earned, not off whether a save path has run yet.
  const _lvl = c.totalLvl || migrateLegacyClasses(c).reduce((s, e) => s + (e.level || 0), 0) || 1;
  c.ecl = _lvl + (raceEclOf(c)) + getMPState(c).mutantLevel;  // v8.68.0: Hybrid RLM (A+B+1, or the GM override)
  c.xpNext = xpThreshold(c.ecl + 1);
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

