// =============================================================================
// js/rules/cybernetics.js
// CYBERNETICS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Cybernetics: installed implants, limits, lost limbs, bonuses and
//   the feats implants grant.
//
// KEY NAMES (so you can search for them)
//   functions (11): getCyber, cyberDef, hasLostArm, hasCyberArm,
//   offHandAvailable, cyberMax, cyberCount, cyberExcess, cyberPDC,
//   buildCyberneticsBonuses, syncCyberFeats
//
// WHERE IT CAME FROM
//   Gathered from js/rules/11-cybernetics.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function getCyber(c) { return (c && c.cybernetics) || []; }
function cyberDef(n) { return CYBERNETICS_DB.find(e => e.n === n) || null; }
function hasLostArm(c) { return (c && c.mutations || []).some(m => m.name === 'Lost Arm'); }
function hasCyberArm(c) { return getCyber(c).some(r => (cyberDef(r.n) || {}).replaceArm); }
// The off hand exists unless Lost Arm stands UNreplaced (HH drawback Special:
// "You can replace your lost arm with a cybernetic replacement arm").
function offHandAvailable(c) { return !hasLostArm(c) || hasCyberArm(c); }
function cyberMax(c) {
  // 1 + Con modifier (minimum 0); supernatural Con modifiers excluded —
  // c.attrs holds the baked PERMANENT score, which is the right base.
  // v9.11.1 (§266, Adam's Forge World Heritage report): + Cybertaker ×N
  // (HH p.209: "maximum number of cybernetic attachments ... increases by
  // 1", stackable). The feat sat in the catalogue since the Expert list
  // landed but nothing ever read it — granted-by records count too, since
  // they live in c.feats like any other take.
  const cybertakers = (c && c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker').length;
  return Math.max(0, 1 + Math.floor((((c.attrs && c.attrs[2]) ?? 10) - 10) / 2)) + cybertakers;
}
function cyberCount(c) {
  // Plexus rule: up to FOUR Skill (or Feat) Implants ride one plexus as a
  // single attachment (the plexus's own 1). Advanced prostheses/organs and
  // the Prosthetic Enhancer count 0 by their entries.
  let skillImps = 0, featImps = 0, n = 0;
  for (const r of getCyber(c)) {
    const def = cyberDef(r.n); if (!def) { n += 1; continue; }
    if (def.n === 'Skill Implant') { skillImps++; continue; }
    if (def.n === 'Feat Implant') { featImps++; continue; }
    n += (def.cnt !== undefined ? def.cnt : 1);
  }
  const hasSP = getCyber(c).some(r => r.n === 'Skill Plexus');
  const hasFP = getCyber(c).some(r => r.n === 'Feat Plexus');
  n += hasSP ? Math.max(0, skillImps - 4) : skillImps;
  n += hasFP ? Math.max(0, featImps - 4) : featImps;
  return n;
}
function cyberExcess(c) { return Math.max(0, cyberCount(c) - cyberMax(c)); }
function cyberPDC(c, def) {
  if (!def.pdc) return def.pdcNote || 'see text';
  const steps = Math.max(0, scenarioTechScale(c) - def.ts);
  return Math.max(1, def.pdc - 2 * steps);
}
// Bonus-engine source: implants with clean always-on numbers contribute live.
function buildCyberneticsBonuses(c) {
  const out = {};
  const push = (target, value, label, type) => { (out[target] = out[target] || []).push({ type: type || BONUS_TYPES.EQUIPMENT || 'equipment', source: 'cybernetic:' + label, value, label: label + ' (cybernetic)' }); };
  for (const r of getCyber(c)) {
    const def = cyberDef(r.n); if (!def) continue;
    if (def.init) push('init', def.init, def.n);
    if (def.skill) push('skill:' + def.skill[0], def.skill[1], def.n);
    if (def.n === 'Skill Implant' && r.param) push('skill:' + r.param, 2, def.n + ' (' + r.param + ')');
    if (def.n === 'Data Archive') for (const sk of SKILLS) { if (sk.n.startsWith('Knowledge (')) push('skill:' + sk.n, 4, 'Data Archive'); }
    // v8.99.0: Mindscreen Implant (HH p.338) — +2 equipment on saves vs
    // mind-affecting attacks; a CONDITIONAL entry per save lane (shows in
    // the drilldowns like the mutations' conditional saves, never folds
    // into the headline total).
    if (def.n === 'Mindscreen Implant') for (const sv of ['fort', 'ref', 'will']) {
      (out[sv] = out[sv] || []).push({ type: BONUS_TYPES.EQUIPMENT || 'equipment', source: 'cybernetic:Mindscreen', value: 2, label: 'Mindscreen Implant (cybernetic)', condition: 'vs mind-affecting attacks' });
    }
  }
  // v8.92.0 (Adam: "wire the negative level modifier for completeness"):
  // −1 per negative level on ALL skill checks (HH p.333) — one untyped
  // entry per catalog skill; saves ride the statblock lanes, attack rolls
  // the RO lane, grapple its own compute. Ability-check −1, effective-level
  // die rolls, and the lost top spell/power remain table-adjudicated.
  const nl = cyberExcess(c);
  if (nl > 0) for (const sk of SKILLS) {
    (out['skill:' + sk.n] = out['skill:' + sk.n] || []).push({ type: BONUS_TYPES.UNTYPED, source: 'cybernetic:negative-levels', value: -nl, label: `Negative level${nl > 1 ? 's' : ''} ×${nl} (cybernetic overload — HH p.333)` });
  }
  return out;
}

// v8.99.0 (Adam's Rhad confirmation): FEAT IMPLANTS GRANT REAL FEATS. The
// implant stored its gift in c.cybernetics while every feat consumer reads
// c.feats — Improved/Advanced Dodge from Rhad's two Feat Implants were
// invisible to the whole engine. The v8.87.0 Energy Immunity pattern:
// materialize a real feat record with grantedBy (budget-exempt — getFeatBudget
// already skips grantedBy feats), self-heal idempotently on render, CASCADE
// away when the implant is removed (HH p.337: "If the feat implant is
// destroyed, the granted feat is lost as well"). Psi Implant's Wild Talent
// grant (HH p.339) rides the same rail. Plexuses grant nothing themselves —
// they consolidate the attachment COUNT (already in cyberCount).
function syncCyberFeats(c) {
  if (!c) return false;
  let changed = false;
  const wanted = [];
  for (const r of getCyber(c)) {
    if (r.n === 'Feat Implant' && r.param) wanted.push(r.param);
    if (r.n === 'Psi Implant') wanted.push('Wild Talent');
  }
  for (const nm of [...new Set(wanted)]) {
    if (!(c.feats || []).some(f => (f.name || f.n) === nm)) {
      // v9.2.2: the Psi Implant's Wild Talent names its own source.
      const src = (nm === 'Wild Talent' && getCyber(c).some(r => r.n === 'Psi Implant') && !getCyber(c).some(r => r.n === 'Feat Implant' && r.param === 'Wild Talent')) ? 'Psi Implant (cybernetic)' : 'Feat Implant (cybernetic)';
      c.feats = (c.feats || []).concat([{ name: nm, grantedBy: src }]);
      changed = true;
    }
  }
  // v9.2.2 (Adam's ruling 2026-10-06): MUTATION-granted feats ride the same
  // materialize / self-heal / cascade rail. Ultra Immune System (HH mutation
  // entry): "You gain Ultra Immune System as a bonus feat even if you don't
  // meet the feat's prerequisite" — budget-exempt via grantedBy.
  {
    const MUT_FEATS = { 'Ultra Immune System': 'Ultra Immune System' };
    const wantM = (c.mutations || []).map(m => MUT_FEATS[m.name]).filter(Boolean);
    for (const nm of wantM) if (!(c.feats || []).some(f => (f.name || f.n) === nm)) { c.feats = (c.feats || []).concat([{ name: nm, grantedBy: `${nm} (mutation)` }]); changed = true; }
    for (const f of (c.feats || []).slice()) if (/\(mutation\)$/.test(f.grantedBy || '') && !wantM.includes(f.name || f.n)) { c.feats = c.feats.filter(x => x !== f); changed = true; }
  }
  for (const f of (c.feats || []).slice()) {
    if (/cybernetic/i.test(f.grantedBy || '') && !wanted.includes(f.name || f.n)) {
      c.feats = c.feats.filter(x => x !== f);
      changed = true;
    }
  }
  // v9.11.2 (§267, Adam's ruling 2026-10-09): the Heavy's 2nd/3rd/4th/5th-
  // level "Cybertaker" class ability IS the Cybertaker feat (HH p.209) —
  // one real feat record per class level past 1st, same materialize /
  // self-heal / cascade rail as the implant grants. The records live in
  // c.feats, so cyberMax (§266) counts them with no special-casing, and
  // they stack with copies taken as feats. ("An implant that does not
  // count against the limit" and "+1 to the limit" are the same number.)
  {
    const heavyLvl = migrateLegacyClasses(c).filter(e => e.name === 'Heavy').reduce((s, e) => s + (e.level || 0), 0);
    const want = Math.min(4, Math.max(0, heavyLvl - 1));
    const SRC = 'Heavy (Cybertaker class feature)';
    const mine = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && f.grantedBy === SRC);
    for (let k = mine.length; k < want; k++) { c.feats = (c.feats || []).concat([{ name: 'Cybertaker', grantedBy: SRC }]); changed = true; }
    for (let k = mine.length; k > want; k--) { const victim = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && f.grantedBy === SRC).pop(); c.feats = c.feats.filter(x => x !== victim); changed = true; }
  }
  if (changed) { save(); logAct('🦾 Cybernetic feat grants synced — implant-granted feats materialized (budget-exempt; removed implants cascade their feats away).'); }
  return changed;
}
