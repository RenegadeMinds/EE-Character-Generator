// =============================================================================
// js/rules/mutations.js
// MUTATIONS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Mutation Points, super-power purchases with banked MP, and
//   mutation effects.
//
// KEY NAMES (so you can search for them)
//   functions (12): getCharMutations, getMPState, getSuperPPState,
//   spendSuperPP, superBuySpec, suiteDiscountFor, superBuyEligibility,
//   grantComplimentarySuperPowers, buildMutationBonuses,
//   computeMutationEffects, reconcileAttributeMutations,
//   mutationPrereqProblems
//
// WHERE IT CAME FROM
//   Gathered from js/app/55-mutations-engine.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
