// =============================================================================
// js/rules/21-quickdraw.js
// QUICKDRAW
// =============================================================================
//
// WHAT'S IN HERE
//   Quickdraw: the one-click character generator, and Quickdraw Bespoke
//   (qdBespokeBuild), the validated build path the test suite also uses to
//   make characters.
//
// KEY NAMES (so you can search for them)
//   tables/objects: QD_POOL_TOKENS, MAGIC_SCHOOLS, PSI_DISCIPLINES
//   functions (34): qdStores, qdEntry, qdCap, qdKeyAttr, qdLegalStarts,
//   qdScoreStart, qdResolvePrereqs, qdRacialAdjArr, qdAllocWithAdj,
//   qdManualAlloc, qdAttrModeToggle, qdMaAdj, qdManualAttrs, qdAllocateAttrs,
//   qdKeyAttrsFor, schoolForPool, qdSpellPicks, qdBuild, qdBuildAttempt,
//   qdBespokeParse, qdBespokeBuild, qdBespokeRun, openQuickdraw, qdOccHint,
//   qdScales, qdPopulatePresetSelect, qdOnPreset, qdRefreshClassLists,
//   qdHybridToggle, closeQuickdraw, qdHybridSpec, qdRun, skillPointsSpentOf,
//   crossClassPremiumOf
//
// LOAD ORDER
//   File 21 of 68. index.html loads it after
//   js/rules/20-scenario-titles-and-heroic-resources.js and before
//   js/rules/22-career-compass.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 15807-16790 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 15807-16790; unchanged below this line ----
// Show or hide gated nav tabs based on the current character's entitlements.
// Tabs without an entry in NAV_TAB_VISIBILITY are always shown (the default).
// If the currently-active page becomes hidden, redirect to the Sheet.
// v8.32.0 (Adam): record-based skill-point spend (the Skills page computes
// from its DOM inputs; the nav badge needs the saved record's truth).
// ========================================================================
// ⚡ QUICKDRAW GENERATOR (v8.40.0, Adam's ask 2026-09-26) — "target class +
// level in, legal skeleton out." The generator makes ONLY the forced moves
// (class ladder, prereq skills/feats/attrs, gate-mandated spells); every
// expressive choice is left unmade, trusted to the v8.32 attention dots.
// The name resurrects the retired Quickdraw attribute table (v8.35.0) for
// a better job. Legality by construction: entry gating runs the REAL
// checker (classPrereqCheckOf) against a simulated pre-entry character, so
// the corrected before-the-level-up doctrine (§133) holds automatically.
// Starting class is a player-facing option (Adam: conscription means any
// Ordinary may find themselves on the frontline) — AUTO picks most-direct,
// MIX rotates a squad across every legal start.
// ========================================================================

function qdStores() {
  return [['ordinary', ORDINARY_CLASSES], ['hero', HERO_CLASSES], ['basic', BASIC_CLASSES],
          ['advanced', ADVANCED_CLASSES], ['prestige', PRESTIGE_CLASSES]];
}
function qdEntry(name) {
  for (const [tier, st] of qdStores()) if (st[name]) return {tier, def: st[name]};
  return null;
}
function qdCap(name) {
  const e = qdEntry(name);
  if (!e) return 20;
  return e.def.maxLvl || (Array.isArray(e.def.bab) ? e.def.bab.length : 20);
}
function qdKeyAttr(def) {
  return def.attrMinKey || (def.attr ? def.attr.split('/')[0].trim() : 'STR');
}
// L1-legal starting classes for a scenario (tiers with no structured entry
// prereqs beyond attrMin), scenario-filtered.
function qdLegalStarts(sixLevels) {
  const disabled = disabledClassesForScenario(sixLevels);
  const out = [];
  for (const [tier, st] of [['ordinary', ORDINARY_CLASSES], ['hero', HERO_CLASSES], ['basic', BASIC_CLASSES]]) {
    for (const n of Object.keys(st)) if (!disabled.has(n)) out.push({name: n, tier});
  }
  return out;
}
// Score a candidate start against the goal's needs (careerNextStep's
// heuristics, store-shaped): class skills for needed ranks, BAB slope for
// BAB gates, matching caster pool for powerAccess gates.
function qdScoreStart(cand, needs) {
  const def = qdEntry(cand.name).def;
  let score = 0;
  const csk = (CLASS_SKILLS[cand.name]) || [];
  score += needs.skills.filter(s => csk.includes(s)).length * 2 + (def.sp || 0) / 10;
  if (needs.bab > 0 && Array.isArray(def.bab) && def.bab.length) {
    const slope = (def.bab[Math.min(3, def.bab.length - 1)] || 0) / Math.min(4, def.bab.length);
    score += slope >= 0.95 ? 2 : slope >= 0.7 ? 1 : 0;
  }
  const cc = CASTER_CLASSES[cand.name];
  if (cc && cc.pool && needs.pools.has(cc.pool)) score += 4;  // caster gates dominate
  if (needs.classNames.has(cand.name)) score += 5;
  if (needs.tiers.has(cand.tier)) score += 1.5;
  return score;
}

// Resolve the goal's prereq groups into concrete forced picks. Returns
// {skills:{name:need}, feats:[{name,param?}], attrNeeds:{KEY:min}, bab, def,
//  pools:Set, spellPicks:[...], allegiance, align, gmNotes:[], choices:[],
//  refuse:reason|null, classNames:Set, tiers:Set(tier->minLevels)}
function qdResolvePrereqs(goal, spec) {
  const e = qdEntry(goal);
  const res = {skills: {}, feats: [], attrNeeds: {}, bab: 0, def: 0, pools: new Set(),
               spellReqs: [], allegiance: '', align: '', gmNotes: [], choices: [],
               classNames: new Set(), tierNeeds: {}, refuse: null};
  const def = e.def;
  if (typeof def.attrMin === 'number') {
    const k = qdKeyAttr(def);
    res.attrNeeds[k] = Math.max(res.attrNeeds[k] || 0, def.attrMin);
  }
  for (const group of (def.prereqs || [])) {
    // Preference order for the "most direct" option within an OR-group.
    const rank = (o) => o.type === 'sixLevel' || o.type === 'sixLevelAny' || o.type === 'sixLevelOr' ? 0
      : o.type === 'skill' || o.type === 'skillFamily' ? 1 : o.type === 'feat' || o.type === 'featParamIs' ? 2
      : o.type === 'attr' || o.type === 'attrAny' ? 3 : o.type === 'bab' || o.type === 'def' ? 4
      : o.type === 'allegiance' || o.type === 'alignment' ? 5 : 6;
    const opts = [...group].sort((a, b) => rank(a) - rank(b));
    let taken = false;
    for (const opt of opts) {
      const t = opt.type;
      if (t === 'sixLevel') { if ((spec.sixLevels[opt.axis] || 0) >= opt.min) { taken = true; break; } continue; }
      if (t === 'sixLevelAny') { if (opt.axes.some(a => (spec.sixLevels[a] || 0) >= opt.min)) { taken = true; break; } continue; }
      if (t === 'sixLevelOr') { if (opt.options.some(o => (spec.sixLevels[o.axis] || 0) >= o.min)) { taken = true; break; } continue; }
      if (t === 'skill') {
        res.skills[opt.name] = Math.max(res.skills[opt.name] || 0, opt.min);
        if (group.length > 1) res.choices.push(`${opt.name} ${opt.min} ranks (from: ${group.map(o => o.name || o.type).join(' / ')})`);
        taken = true; break;
      }
      if (t === 'skillFamily') {
        // Pick the family's alphabetically-first skill (player can retrain).
        const sk = SKILLS.filter(s => s.family === opt.family).map(s => s.n).sort()[0];
        if (sk) { res.skills[sk] = Math.max(res.skills[sk] || 0, opt.min); res.choices.push(`${sk} for the ${opt.family}-family requirement`); taken = true; break; }
        continue;
      }
      if (t === 'skillFamilyCount') {
        const names = SKILLS.filter(s => s.family === opt.family).map(s => s.n).sort().slice(0, opt.count);
        names.forEach(n => { res.skills[n] = Math.max(res.skills[n] || 0, opt.min); });
        res.choices.push(`${opt.family} skills auto-picked: ${names.join(', ')}`);
        taken = true; break;
      }
      if (t === 'feat') { res.feats.push({name: opt.name}); taken = true; break; }
      if (t === 'featParamIs') { res.feats.push({name: opt.name, param: opt.param || opt.paramPrefix}); taken = true; break; }
      if (t === 'featParamCount') {
        // e.g. Spell Focus in two schools — deterministic picks, logged.
        const schools = ['Evocation', 'Transmutation', 'Conjuration', 'Abjuration'];
        for (let i = 0; i < opt.min; i++) res.feats.push({name: opt.name, param: schools[i % schools.length]});
        res.choices.push(`${opt.name} ×${opt.min}: ${schools.slice(0, opt.min).join(', ')} (swap freely)`);
        taken = true; break;
      }
      if (t === 'attr') { res.attrNeeds[opt.name] = Math.max(res.attrNeeds[opt.name] || 0, opt.min); taken = true; break; }
      if (t === 'attrAny') { const k = 'STR'; res.attrNeeds[k] = Math.max(res.attrNeeds[k] || 0, opt.min); res.choices.push(`any-attribute ${opt.min}+ assigned to STR`); taken = true; break; }
      if (t === 'bab') { res.bab = Math.max(res.bab, opt.min); taken = true; break; }
      if (t === 'def') { res.def = Math.max(res.def, opt.min); taken = true; break; }
      if (t === 'powerAccess') {
        (opt.pools === 'any' ? ['arcane', 'divine', 'psionic'] : opt.pools).forEach(p => { if (p !== 'super') res.pools.add(p); });
        res.spellReqs.push({kind: 'access', lvl: opt.lvl, pools: opt.pools});
        taken = true; break;
      }
      if (t === 'knowsPower') { res.spellReqs.push({kind: 'named', name: opt.name}); taken = true; break; }
      if (t === 'powerRepertoire') { res.spellReqs.push({kind: 'repertoire', opt}); taken = true; break; }
      if (t === 'allegiance' && opt.polarity !== 'lacks') { res.allegiance = opt.value; res.choices.push(`allegiance set to ${opt.value}`); taken = true; break; }
      if (t === 'alignment' && opt.polarity !== 'lacks') { res.align = 'Neutral ' + opt.value; res.choices.push(`alignment set to Neutral ${opt.value}`); taken = true; break; }
      if (t === 'classLevel' && opt.name) { res.classNames.add(opt.name); res.tierNeeds[opt.name] = opt.min || 1; taken = true; break; }
      if (t === 'tierLevel') { res.tierNeeds['tier:' + opt.tier] = opt.min; taken = true; break; }
      if (t === 'featCount') {
        // v8.52.1 (Adam's theurge-tower repro): "any N feats from family X"
        // gates — Metamind's "Any two Power feats" was the first featCount
        // Bespoke ever met, and the resolver refused the whole ladder for
        // want of a handler. Force-pick the family's prereq-free, param-free
        // feats first (alphabetical for determinism), counting any feats the
        // resolution has already queued from that family; the player swaps
        // freely, like every other Bespoke auto-pick.
        const fams = opt.families || (opt.family ? [opt.family] : []);
        const already = res.feats.filter(f => { const d = getFeatData(f.name); return d && fams.includes(d.family); }).length;
        const need = Math.max(0, (opt.min || 1) - already);
        const pool = FEATS_DB.filter(f => fams.includes(f.family) && !f.param && !res.feats.some(x => x.name === f.n))
          .sort((a, b) => (((a.prereqs && a.prereqs.length) ? 1 : 0) - ((b.prereqs && b.prereqs.length) ? 1 : 0)) || a.n.localeCompare(b.n));
        if (pool.length < need) continue;  // can't fill from this option — try the group's next
        const picks = pool.slice(0, need);
        picks.forEach(p => res.feats.push({name: p.n}));
        if (picks.length) res.choices.push(`${opt.desc || (fams.join('/') + ' feats ×' + (opt.min || 1))}: ${picks.map(p => p.n).join(', ')} (swap freely)`);
        taken = true; break;
      }
      if (t === 'note' || t === 'talent' || t === 'classAbility' || t === 'mpTotal') {
        res.gmNotes.push(opt.text || opt.name || opt.type); taken = true; break;
      }
      // allegiance/alignment 'lacks' polarity: default Neutral/no-allegiance
      // already satisfies — treat as met.
      if ((t === 'allegiance' || t === 'alignment') && opt.polarity === 'lacks') { taken = true; break; }
    }
    if (!taken) { res.refuse = 'a prerequisite group cannot be satisfied under this scenario: ' + group.map(o => o.type + (o.name ? ':' + o.name : '')).join(' / '); return res; }
  }
  // Feat-chain closure: each chosen feat's own feat/skill/attr prereqs.
  const seen = new Set(res.feats.map(f => f.name));
  const queue = [...res.feats];
  while (queue.length) {
    const f = queue.shift();
    const fd = getFeatData(f.name);
    if (!fd || !fd.prereqs) continue;
    for (const g of fd.prereqs) {
      const featOpt = g.find(o => o.type === 'feat');
      const skOpt = g.find(o => o.type === 'skill');
      const atOpt = g.find(o => o.type === 'attr');
      if (featOpt && !seen.has(featOpt.name)) { seen.add(featOpt.name); const nf = {name: featOpt.name}; res.feats.push(nf); queue.push(nf); }
      else if (!featOpt && skOpt) res.skills[skOpt.name] = Math.max(res.skills[skOpt.name] || 0, skOpt.min);
      else if (!featOpt && !skOpt && atOpt) res.attrNeeds[atOpt.name] = Math.max(res.attrNeeds[atOpt.name] || 0, atOpt.min);
      // bab/sixLevel feat gates surface at final validation.
    }
  }
  return res;
}

// Point-buy attrs: 20 points over base 10s (target sum 80, cap 18), gates
// first, then the goal's key attribute, then round-robin. Returns null when
// gates exceed the budget even with every level-bump conscripted.
// v8.69.0 (Adam's option (a)): Quickdraw/Bespoke now apply RACIAL ATTRIBUTE
// ADJUSTMENTS exactly as the Create form does — on top of the point-buy,
// the moment the race is known. The allocator aims at (need − adj), so the
// ADJUSTED score still meets every prerequisite target (a −2 racial would
// otherwise quietly break the very gate the build was engineered to pass);
// a +adj means the allocator spends less to get there, exactly like a
// player would at the table. Hybrids sum both parents' adjustments.
function qdRacialAdjArr(spec) {
  const AN = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  if (spec && spec.race === 'Hybrid' && spec.hybrid && !spec.hybrid.invalid) {
    const aj = (RACES[spec.hybrid.a] || {}).adj || {}, bj = (RACES[spec.hybrid.b] || {}).adj || {};
    return AN.map(n => (aj[n] || 0) + (bj[n] || 0));
  }
  const adj = (RACES[(spec && spec.race) || ''] || {}).adj || {};
  return AN.map(n => adj[n] || 0);
}
// v8.94.0 (Adam's Endrin advisory, deemed preferable): the allocator keyed
// on ONE attribute — the last class's first attr token — so a theurge
// ladder walked out with Int 20 / Wis 14, capping divine CASTS at
// 4th-level spells despite EDL 17. The optimization hinges on the key
// attributes of the PRIMARY classes involved: keyAttr now accepts a LIST
// (every distinct casting attribute among the ladder's feeder caster
// classes, plus ALL of the final class's attr tokens — 'INT/WIS' means
// both), and the spare points, 14-caps, and level bumps are raised in
// BALANCE across them (lowest first). Single-string callers unchanged.
function qdAllocWithAdj(needs, keyAttr, bumpsAvail, adjArr) {
  const idx = { STR: 0, DEX: 1, CON: 2, INT: 3, WIS: 4, CHA: 5 };
  const comp = {};
  for (const k of Object.keys(needs)) comp[k] = needs[k] - ((adjArr || [])[idx[k]] || 0);
  const alloc = qdAllocateAttrs(comp, keyAttr, bumpsAvail);
  if (!alloc) return null;
  return { attrs: alloc.attrs.map((v, i) => v + ((adjArr || [])[i] || 0)), bumps: alloc.bumps };
}

// v8.95.0 (Adam's dice-roller addendum): the MANUAL lane — the player's
// entered set is taken as FINAL scores (level bumps assumed included),
// racial adjustment applied on top; attribute prerequisites still check
// honestly and a shortfall refuses with the gap named.
function qdManualAlloc(manual, needs, adjArr) {
  const idx = { STR: 0, DEX: 1, CON: 2, INT: 3, WIS: 4, CHA: 5 };
  const attrs = manual.map((v, i) => (Number(v) || 10) + ((adjArr || [])[i] || 0));
  for (const [k, v] of Object.entries(needs || {})) {
    if ((attrs[idx[k]] ?? 10) < v) return { err: `manual attributes: ${k} ${attrs[idx[k]]} (after racial adjustment) is below the required ${v} — raise it or re-tick Automatic Attribute Generation` };
  }
  return { attrs, bumps: [] };
}
function qdAttrModeToggle() {
  const on = !document.getElementById('qd-auto-attrs').checked;
  document.getElementById('qd-manual-attrs').style.display = on ? '' : 'none';
}
function qdMaAdj(i, d) {
  const el = document.getElementById('qd-ma-' + i);
  el.textContent = Math.max(1, Math.min(30, (parseInt(el.textContent, 10) || 10) + d));
}
function qdManualAttrs() {
  const auto = document.getElementById('qd-auto-attrs');
  if (!auto || auto.checked) return null;
  return [0, 1, 2, 3, 4, 5].map(i => parseInt(document.getElementById('qd-ma-' + i).textContent, 10) || 10);
}
function qdAllocateAttrs(needs, keyAttr, bumpsAvail) {
  const idx = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  const attrs = [10, 10, 10, 10, 10, 10];
  let pts = 20;
  const bumps = [];
  for (const k of Object.keys(needs)) {
    const need = Math.min(needs[k], 18 + bumpsAvail);
    let base = Math.min(need, 18);
    let cost = base - 10;
    if (cost > pts) { base = 10 + pts; cost = pts; }
    attrs[idx[k]] = base; pts -= cost;
    let short = need - base;
    while (short > 0 && bumps.length < bumpsAvail) { bumps.push(k); attrs[idx[k]]++; short--; }
    if (attrs[idx[k]] < needs[k]) return null;  // unreachable even with bumps
  }
  // v8.94.0: key attributes as an ordered, deduped index list.
  const keys = (Array.isArray(keyAttr) ? keyAttr : [keyAttr])
    .map(k => idx[k]).filter(i => i !== undefined);
  const kIdxs = [...new Set(keys.length ? keys : [0])];
  const lowestKey = () => kIdxs.reduce((a, b) => (attrs[b] < attrs[a] ? b : a), kIdxs[0]);
  // Remaining points: raise the key attributes to 16 in balance, lowest first.
  while (pts > 0 && kIdxs.some(i => attrs[i] < 16)) {
    const lo = kIdxs.filter(i => attrs[i] < 16).reduce((a, b) => (attrs[b] < attrs[a] ? b : a));
    attrs[lo]++; pts--;
  }
  const order = [...new Set([2, ...kIdxs, 1, 4, 3, 5, 0])];
  let guard = 60;
  while (pts > 0 && guard--) {
    for (const i of order) { if (pts > 0 && attrs[i] < 14) { attrs[i]++; pts--; } }
  }
  // Remaining bumps → key attributes in balance (use-it-or-lose-it).
  while (bumps.length < bumpsAvail) { const lo = lowestKey(); bumps.push(ATTR_NAMES[lo]); attrs[lo]++; }
  return {attrs, bumps};
}
// v8.94.0: the key-attribute LIST for a ladder — the casting attribute of
// every feeder caster class (the classes a prestige advancer extends), then
// ALL attr tokens of the goal/final class ('INT/WIS' → both), deduped in
// ladder order.
function qdKeyAttrsFor(classNames, lastDef) {
  const out = [];
  for (const nm of (classNames || [])) {
    if (CASTER_PROGRESSION[nm]) {
      const e = qdEntry(nm);
      if (e) { const k = qdKeyAttr(e.def); if (!out.includes(k)) out.push(k); }
    }
  }
  for (const tok of String((lastDef && lastDef.attr) || '').split('/').map(s => s.trim()).filter(Boolean)) {
    const k = tok.toUpperCase();
    if (['STR','DEX','CON','INT','WIS','CHA'].includes(k) && !out.includes(k)) out.push(k);
  }
  if (!out.length) out.push(qdKeyAttr(lastDef || {}));
  return out;
}

// Gate-mandated spell picks (knowsPower / powerRepertoire): minimal
// qualifying entries, alphabetical, lowest level first — filtered to the
// pool's base list tokens (levels[].cls), so a Sorcerer never "knows" a
// Cleric-only spell just because it sorted first.
const QD_POOL_TOKENS = {
  arcane:  ['Sor/Wiz', 'Sor', 'Wiz', 'Brd'],
  divine:  ['Clr', 'Drd', 'Pal', 'Rgr'],
  psionic: ['Psion', 'Wilder', 'Warmind'],
};
// v8.94.1: the POOL-AWARE school of a spell. Dual-listed entries print
// "Metacreativity / Conjuration (Creation)" — a psionic DISCIPLINE beside
// the magic SCHOOL. For an arcane/divine repertoire the school is the magic
// token; for psionic, the discipline. First token only as a last resort.
const MAGIC_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Universal'];
const PSI_DISCIPLINES = ['Clairsentience', 'Metacreativity', 'Psychokinesis', 'Psychometabolism', 'Psychoportation', 'Telepathy'];
function schoolForPool(schoolRaw, pool) {
  const toks = String(schoolRaw || '').split('/').map(t => t.trim().split(/[\s(\[]/)[0]).filter(Boolean);
  const want = (pool === 'psionic') ? PSI_DISCIPLINES : MAGIC_SCHOOLS;
  for (const t of toks) if (want.includes(t)) return t;
  return toks[0] || '';
}
function qdSpellPicks(spellReqs, pool) {
  const picks = [];
  const toks = (p) => QD_POOL_TOKENS[p] || QD_POOL_TOKENS.arcane;
  const poolLevels = (s, p) => (s.levels || []).filter(l => toks(p).some(t => (l.cls || '').startsWith(t))).map(l => l.lvl);
  const inPool = (s, p) => poolLevels(s, p).length > 0;
  const lvlOf = (s, p) => { const ls = poolLevels(s, p); return ls.length ? Math.min(...ls) : 1; };
  for (const req of spellReqs) {
    if (req.kind === 'named') {
      const s = SPELLS_DB.find(x => x.name === req.name);
      picks.push({name: req.name, pool: pool, lvl: s ? lvlOf(s, pool) : 1});
    } else if (req.kind === 'repertoire') {
      const o = req.opt;
      const p = o.pool || pool;
      // minLvl must use the CHECKER's metric (min across ALL class rows,
      // not just the pool's) or picks that satisfy us fail the gate.
      const checkerLvl = (s) => (s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : 0;
      let cands = SPELLS_DB.filter(s => inPool(s, p) && (!o.schools || o.schools.some(sc => (s.school_raw || '').startsWith(sc))));
      if (o.minLvl) cands = cands.filter(s => checkerLvl(s) >= o.minLvl);
      cands.sort((a, b) => lvlOf(a, p) - lvlOf(b, p) || a.name.localeCompare(b.name));
      if (o.distinctSchools) {
        // v8.94.1: pool-aware school (dual-listed "Metacreativity /
        // Conjuration" entries counted their psionic discipline as a
        // distinct arcane school — the Tower probe's fifth school was fake).
        const bySchool = new Map();
        for (const s of cands) { const k = schoolForPool(s.school_raw, p); if (!bySchool.has(k)) bySchool.set(k, s); if (bySchool.size >= o.distinctSchools) break; }
        for (const s of bySchool.values()) picks.push({name: s.name, pool: p, lvl: lvlOf(s, p)});
      } else {
        for (const s of cands.slice(0, o.count || 1)) picks.push({name: s.name, pool: p, lvl: lvlOf(s, p)});
      }
    }
  }
  // dedupe by name
  const seen = new Set();
  return picks.filter(p => !seen.has(p.name) && seen.add(p.name));
}

// The solver: returns {ok:true, char, summary} or {ok:false, reason}.
function qdBuild(spec) {
  try {
    const goalE = qdEntry(spec.goal);
    if (!goalE) return {ok: false, reason: `unknown class "${spec.goal}"`};
    const disabled = disabledClassesForScenario(spec.sixLevels);
    if (disabled.has(spec.goal)) return {ok: false, reason: `${spec.goal} is unavailable under this scenario's Six Scales`};
    const N = spec.level;
    const needsPrereqs = !!(goalE.def.prereqs && goalE.def.prereqs.length) || typeof goalE.def.attrMin === 'number';
    const res = qdResolvePrereqs(spec.goal, spec);
    if (res.refuse) return {ok: false, reason: res.refuse};

    // ---- starting class candidates ----
    // AUTO doesn't just take the top-scored start: it trials the best few
    // and keeps whichever enters the goal EARLIEST — "most direct" measured
    // in levels, not heuristics (a Wizard reaches 7th-level arcane a caster
    // level before a Sorcerer, so Archmage-via-Wizard should win).
    const isEntryFree = ['ordinary', 'hero', 'basic'].includes(goalE.tier);
    let candidates;
    if (spec.startClass) candidates = [spec.startClass];
    else if (isEntryFree) candidates = [spec.goal];
    else if (res.classNames.size) candidates = [[...res.classNames][0]];  // classLevel gate names the feeder
    else {
      const starts = qdLegalStarts(spec.sixLevels);
      const needs = {skills: Object.keys(res.skills), bab: res.bab, pools: res.pools,
                     classNames: res.classNames, tiers: new Set(Object.keys(res.tierNeeds).filter(k => k.startsWith('tier:')).map(k => k.slice(5)))};
      const ranked = starts.map(s => ({s, sc: qdScoreStart(s, needs)})).sort((a, b) => b.sc - a.sc);
      if (!ranked.length) return {ok: false, reason: 'no legal starting class under this scenario'};
      candidates = ranked.slice(0, 3).map(r => r.s.name);
    }
    let best = null, firstFail = null;
    for (const cand of candidates) {
      const attempt = qdBuildAttempt(spec, res, cand, goalE, isEntryFree);
      if (attempt.ok) { if (!best || (attempt.entryLvl || 0) < (best.entryLvl || 0)) best = attempt; }
      else if (!firstFail) firstFail = attempt;
    }
    return best || firstFail || {ok: false, reason: 'no viable start found'};
  } catch (err) {
    return {ok: false, reason: 'Quickdraw solver error: ' + (err && err.message || err)};
  }
}

// One concrete attempt with a FIXED starting class. Kept separate so AUTO
// can race candidates on entry level.
function qdBuildAttempt(spec, res, startName, goalE, isEntryFree) {
  try {
    const N = spec.level;
    const disabled = disabledClassesForScenario(spec.sixLevels);
    const startE = qdEntry(startName);
    if (!startE) return {ok: false, reason: `unknown starting class "${startName}"`};
    if (disabled.has(startName)) return {ok: false, reason: `${startName} is unavailable under this scenario's Six Scales`};
    if (res.pools.size) {
      const cc = CASTER_CLASSES[startName];
      if (!cc || !res.pools.has(cc.pool)) return {ok: false, reason: `${spec.goal} needs a ${[...res.pools].join('/')} caster ladder — ${startName} can't supply it (try AUTO)`};
    }
    // starting-class attrMin joins the needs — on a LOCAL copy, so one
    // candidate's attrMin never leaks into the next AUTO trial.
    const attrNeeds = {...res.attrNeeds};
    if (typeof startE.def.attrMin === 'number') {
      const k = qdKeyAttr(startE.def);
      attrNeeds[k] = Math.max(attrNeeds[k] || 0, startE.def.attrMin);
    }

    // ---- attributes ----
    // `let`, not `const`: the bridge race (below) may re-run the allocation
    // with a bridge's attrMin folded in — the budget chases the best ladder.
    const _adjArr = qdRacialAdjArr(spec);  // v8.69.0: racial adj, Create-form parity
    let alloc;
    if (spec.manualAttrs) {  // v8.95.0: the dice-roller lane
      const m = qdManualAlloc(spec.manualAttrs, attrNeeds, _adjArr);
      if (m.err) return {ok: false, reason: m.err};
      alloc = m;
    } else {
      alloc = qdAllocWithAdj(attrNeeds, qdKeyAttrsFor([startE.name, goalE.name], goalE.def), Math.floor(N / 4), _adjArr);  // v8.94.0: multi-key
      if (!alloc) return {ok: false, reason: 'attribute prerequisites exceed the 20-point buy even with every level bump'};
    }

    // ---- assembly scaffold shared by gate-sim and final ----
    const spellPool = res.pools.size ? [...res.pools][0] : 'arcane';
    const powers = qdSpellPicks(res.spellReqs.filter(r => r.kind !== 'access'), spellPool);
    const mkChar = (classes, id, nm) => ({
      id, name: nm, race: spec.race || 'Human', sex: '', align: res.align || 'Neutral',
      hybrid: (spec.race === 'Hybrid' && spec.hybrid && !spec.hybrid.invalid) ? {...spec.hybrid} : null,  // v8.68.2
      allegiance: res.allegiance || '', occupations: [], xp: 0, hpMode: 'hero',
      schemaVer: CURRENT_SCHEMA_VER,
      attrs: alloc.attrs.slice(), attrBumps: alloc.bumps.slice(),
      sixLevels: {...spec.sixLevels}, scenarioPreset: spec.presetName || 'Custom',
      classes: classes.map(c => ({...c})),
      skills: {...res.skills}, feats: res.feats.map(f => ({...f})),
      powers: powers.map(p => ({...p})), talents: [], items: [], gear: [],
      maxHP: 10, hp: 10, log: [], _quickdraw: true,
      heroesGiftChoice: classes.some(c => c.tier === 'hero') ? null : undefined,
    });

    // ---- ladder: find the earliest entry level with the REAL checker ----
    let ladder = null, entryLvl = null, bridgeAllocNote = null;
    if (isEntryFree && startName === spec.goal) {
      const cap = qdCap(spec.goal);
      if (N > cap) return {ok: false, reason: `${spec.goal} caps at level ${cap} — pick a lower level or an Advanced/Prestige goal to grow into`};
      ladder = [{tier: goalE.tier, name: spec.goal, level: N, first: true}];
    } else {
      const startCap = qdCap(startName);
      const gates = (sim) => {
        // v8.54.1 (the §158 latent flag, closed): CAP-AWARE like Bespoke.
        // The checker takes claimed ranks at face value, so the sim's
        // force-picked skills are clamped to the entry doctrine's max
        // (level+4 at the level BEFORE the level-up) — otherwise a
        // skill-gated goal like Ambassador walked in at character level 2
        // carrying three 6-rank skills that cannot exist before level 3.
        const lvl = (sim.classes || []).reduce((s, e) => s + (e.level || 0), 0);
        const capped = {};
        for (const [sk, v] of Object.entries(sim.skills || {})) capped[sk] = Math.min(v, Math.max(0, lvl + 4));
        sim.skills = capped;
        sim.totalLvl = lvl;
        const r = classPrereqCheckOf(sim, spec.goal);
        return (r.missing || []).filter(m => !res.gmNotes.some(gn => m.includes(gn)) && !m.includes('(GM-verify)'));
      };
      // Pass 1 — pure ladder: start feeder → goal.
      for (let E = 2; E <= N; E++) {
        if (E - 1 > startCap) break;
        const sim = mkChar([{tier: startE.tier, name: startName, level: E - 1, first: true}], '__qdsim__', 'sim');
        if (gates(sim).length === 0) { entryLvl = E; break; }
      }
      let bridge = null;
      if (entryLvl) {
        const goalLvls = Math.min(N - entryLvl + 1, qdCap(spec.goal));
        const leftover = N - (entryLvl - 1) - goalLvls;
        const feederLvls = (entryLvl - 1) + Math.min(leftover, startCap - (entryLvl - 1));
        if ((entryLvl - 1) + goalLvls + (feederLvls - (entryLvl - 1)) < N) return {ok: false, reason: `level ${N} overflows both ${startName} and ${spec.goal} caps — split classes by hand via Create/Edit`};
        ladder = [{tier: startE.tier, name: startName, level: feederLvls, first: true},
                  {tier: goalE.tier, name: spec.goal, level: goalLvls}];
      } else if (N >= 3) {
        // Pass 2 — BRIDGE ladder (v8.40.2, Adam's Dutch report): the chosen
        // start keeps its identity 1st level, then multiclasses into a
        // bridge class that CAN carry the gates (a Charismatic Ordinary who
        // immediately goes Warrior: Cha Ord 1 / Fighter 3 / Soldier 1).
        // Bridge candidates are the scenario's other legal starts, scored
        // against the goal's needs and raced on entry, exactly like AUTO.
        const needs = {skills: Object.keys(res.skills), bab: res.bab, pools: res.pools,
                       classNames: res.classNames, tiers: new Set(Object.keys(res.tierNeeds).filter(k => k.startsWith('tier:')).map(k => k.slice(5)))};
        const cands = qdLegalStarts(spec.sixLevels).filter(s => s.name !== startName)
          .map(s => ({s, sc: qdScoreStart(s, needs)})).sort((a, b) => b.sc - a.sc).slice(0, 4);
        for (const {s} of cands) {
          const bE = qdEntry(s.name);
          const savedAlloc = alloc;
          let candNote = null;
          if (typeof bE.def.attrMin === 'number') {
            // v8.40.4 (Adam: "close the seam"): a bridge's attrMin no longer
            // just filters — the point buy is RE-RUN with the bridge's gate
            // folded into the needs, so the budget chases the best ladder.
            // Only if even the re-budget can't reach it (past 18 + bumps, or
            // gates already saturate the 20 points) is the bridge skipped.
            const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
            const code = qdKeyAttr(bE.def);
            if ((alloc.attrs[ATTR_IDX[code]] || 0) < bE.def.attrMin) {
              const needsB = {...attrNeeds};
              needsB[code] = Math.max(needsB[code] || 0, bE.def.attrMin);
              const allocB = spec.manualAttrs
                ? (() => { const m = qdManualAlloc(spec.manualAttrs, needsB, _adjArr); return m.err ? null : m; })()  // v8.95.0: manual lane
                : qdAllocWithAdj(needsB, qdKeyAttrsFor([startE.name, goalE.name], goalE.def), Math.floor(N / 4), _adjArr);  // v8.69.0 adj-compensated; v8.94.0 multi-key
              if (!allocB) continue;  // genuinely unreachable — skip this bridge
              alloc = allocB;  // mkChar closes over `alloc` — sims below see it
              candNote = `point buy re-balanced to cover the ${s.name} bridge's ${code} ${bE.def.attrMin} entry gate`;
            }
          }
          for (let E = 3; E <= N; E++) {
            if (E - 2 > qdCap(s.name)) break;
            const sim = mkChar([{tier: startE.tier, name: startName, level: 1, first: true},
                                {tier: bE.tier, name: s.name, level: E - 2}], '__qdsim__', 'sim');
            if (gates(sim).length === 0) { entryLvl = E; bridge = {tier: bE.tier, name: s.name, bridgeLvls: E - 2}; break; }
          }
          if (bridge) { bridgeAllocNote = candNote; break; }  // score-ordered; first hit wins
          alloc = savedAlloc;  // this candidate lost — restore the budget
        }
        if (bridge) {
          const goalLvls = Math.min(N - entryLvl + 1, qdCap(spec.goal));
          let leftover = N - (entryLvl - 1) - goalLvls;
          const bridgeLvls = bridge.bridgeLvls + Math.min(leftover, qdCap(bridge.name) - bridge.bridgeLvls);
          leftover -= (bridgeLvls - bridge.bridgeLvls);
          if (leftover > 0) return {ok: false, reason: `level ${N} overflows the ${startName}/${bridge.name}/${spec.goal} ladder's caps — split classes by hand via Create/Edit`};
          ladder = [{tier: startE.tier, name: startName, level: 1, first: true},
                    {tier: bridge.tier, name: bridge.name, level: bridgeLvls},
                    {tier: goalE.tier, name: spec.goal, level: goalLvls}];
        }
      }
      if (!ladder) {
        const sim = mkChar([{tier: startE.tier, name: startName, level: Math.min(N - 1, startCap), first: true}], '__qdsim__', 'sim');
        // v8.54.1: the diagnostic runs through the same cap-aware gates, so
        // the "still missing" list is honest about rank-cap impossibilities.
        const missing = gates(sim);
        return {ok: false, reason: `${spec.goal} can't be entered by level ${N} via ${startName}, even with a 1-level start + bridge-class ladder — still missing at best: ${missing.join(' · ') || '(rank caps at this level)'}`};
      }
    }

    // ---- final character ----
    const c = mkChar(ladder, 'qd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), spec.name);
    c.totalLvl = N;
    // HP: L1 max die + Con, later levels the deterministic hero-mode average
    // (half + midpoint), re-rollable via the Tracker's ⚙ HP Mode.
    const conM = am(c.attrs[2]);
    let hp = 0, lvlIdx = 0;
    for (const e of ladder) {
      const hd = qdEntry(e.name).def.hd || 8;
      for (let i = 0; i < e.level; i++) {
        lvlIdx++;
        hp += (lvlIdx === 1 ? hd : Math.floor((Math.floor(hd / 2) + 1 + hd) / 2)) + conM;
      }
    }
    c.maxHP = Math.max(1, hp); c.currentHP = c.maxHP; c.hp = c.maxHP;
    c.xp = xpThreshold(N);
    // v8.40.3 (Adam's Dutch dashboard report): the Sheet's combat dashboard
    // reads STORED derived stats (c.bab/def/saves/rep, c.ap/apMax) that the
    // save and level-up flows stamp via computeStatsFromClasses — a directly
    // assembled record must stamp the same block or "Base Attack" renders
    // literally "undefined" and Hero AP sits at 0. Legacy slot mirrors and
    // class-entry granted feats (Monk's CMA/DMA pattern) come along for the
    // same reason the level-up commit refreshes them.
    const s = computeStatsFromClasses(ladder);
    c.bab = s.bab; c.def = s.def; c.fort = s.fort; c.ref = s.ref; c.will = s.will; c.rep = s.rep;
    c.apMax = s.ap; c.ap = c.apMax;
    const heroEntry = ladder.find(e => e.tier === 'hero');
    const basicEntry = ladder.find(e => e.tier === 'basic');
    const advEntry = ladder.find(e => e.tier === 'advanced');
    const presEntry = ladder.find(e => e.tier === 'prestige');
    c.heroClass = heroEntry ? heroEntry.name : ''; c.heroLvl = heroEntry ? heroEntry.level : 0;
    c.basicClass = basicEntry ? basicEntry.name : ''; c.basicLvl = basicEntry ? basicEntry.level : 0;
    c.advClass = advEntry ? advEntry.name : ''; c.advLvl = advEntry ? advEntry.level : 0;
    c.presClass = presEntry ? presEntry.name : ''; c.presLvl = presEntry ? presEntry.level : 0;
    try { reconcileGrantedFeats(c); } catch (e) {}
    // GM-gated prereqs: recorded honestly as exceptions, exactly like a
    // manual entry past the warning.
    if (res.gmNotes.length) {
      c.gmExceptions = [{type: 'class', target: `${spec.goal} (${goalE.tier})`,
        missing: res.gmNotes.map(n => n + ' (GM-verify)'), grantedAt: new Date().toLocaleDateString()}];
    }
    // Provenance + auto-pick log.
    const stamp = new Date().toLocaleString();
    const ladderTxt = ladder.map(e => `${e.name} ${e.level}`).join(' / ');
    c.log.push({time: stamp, text: `⚡ Quickdraw: ${spec.goal} @ level ${N} → ${ladderTxt}. Forced picks only — the amber dots mark everything still yours to choose.`});
    if (res.choices.length) c.log.push({time: stamp, text: `⚡ Auto-resolved (swap freely): ${res.choices.join(' · ')}`});
    if (bridgeAllocNote) c.log.push({time: stamp, text: `⚡ ${bridgeAllocNote}.`});
    if (alloc.bumps.length) c.log.push({time: stamp, text: `⚡ Level bumps (${alloc.bumps.length}) assigned: ${alloc.bumps.join(', ')} — use-it-or-lose-it, so none were left on the table.`});
    refreshEclXp(c);
    // Final validation with the real gates — the build must stand on its own.
    const finalCheck = classPrereqCheckOf({...c, classes: ladder.filter(e => e.name !== spec.goal)}, spec.goal);
    const residual = (finalCheck.missing || []).filter(m => !res.gmNotes.some(gn => m.includes(gn)) && !m.includes('(GM-verify)'));
    return {ok: true, char: c, summary: `${ladderTxt}`, residual, entryLvl};
  } catch (err) {
    return {ok: false, reason: 'Quickdraw attempt error: ' + (err && err.message || err)};
  }
}

// ============================================================================
// v8.51.0: ⚡ QUICKDRAW BESPOKE (the Xander build's structural finding, Adam's
// greenlight 2026-09-29): the GM lane. Hand it an EXACT multi-class ladder
// ("Dedicated Hero 2, Aristocrat 2, …") and it assembles the character in one
// pass with the same legality-by-construction the goal-seeking Quickdraw
// uses: qdResolvePrereqs force-picks each gated class's minimum skills/feats
// (merged across steps), qdAllocateAttrs covers every attrMin under the
// 20-point buy, and EVERY entry beyond the first is validated with the real
// checker against the partial ladder at its actual entry level — the entry
// doctrine, mechanized. Expressive choices stay owed (amber dots), exactly
// like classic Quickdraw. Eleven ceremonies become one.
function qdBespokeParse(text) {
  const steps = [];
  for (const raw of String(text || '').split(/[,\n;]+/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const m = tok.match(/^(.+?)\s+(\d+)$/);
    if (!m) return {err: `can't parse step "${tok}" — use "Class N"`};
    const want = m[1].trim().toLowerCase();
    let found = null;
    for (const dict of [HERO_CLASSES, ORDINARY_CLASSES, BASIC_CLASSES, ADVANCED_CLASSES, PRESTIGE_CLASSES]) {
      for (const n of Object.keys(dict)) if (n.toLowerCase() === want) { found = n; break; }
      if (found) break;
    }
    if (!found) return {err: `unknown class "${m[1].trim()}"`};
    steps.push({name: found, levels: parseInt(m[2], 10)});
  }
  if (!steps.length) return {err: 'no steps given'};
  return {steps};
}
function qdBespokeBuild(spec) {
  try {
    const disabled = disabledClassesForScenario(spec.sixLevels);
    const steps = [];
    for (const st of spec.steps) {
      const e = qdEntry(st.name);
      if (!e) return {ok: false, reason: `unknown class "${st.name}"`};
      if (disabled.has(st.name)) return {ok: false, reason: `${st.name} is unavailable under this scenario's Six Scales`};
      const cap = qdCap(st.name);
      // v8.89.1 (the headless battery's first conviction, 2026-10-04): a step
      // with UNDEFINED levels slipped the gate (undefined < 1 is false) and
      // built NaN-grade characters. Non-finite now refuses like any illegal ladder.
      if (!Number.isFinite(st.levels) || st.levels < 1 || st.levels > cap) return {ok: false, reason: `${st.name} takes 1–${cap} levels (asked for ${st.levels})`};
      steps.push({tier: e.tier, name: st.name, level: st.levels, first: steps.length === 0});
    }
    const N = steps.reduce((s, e) => s + e.level, 0);
    if (N > 20) return {ok: false, reason: `ladder totals level ${N} — cap is 20`};
    // Merge every step's forced prerequisite picks (skills at max-of, feats
    // deduped, attrMins at max-of) so the entry sims below can pass.
    const merged = {skills: {}, feats: [], attrNeeds: {}, gmNotes: [], choices: [], pools: new Set(), spellReqs: []};
    for (const st of steps) {
      const res = qdResolvePrereqs(st.name, spec);
      if (res.refuse) return {ok: false, reason: `${st.name}: ${res.refuse}`};
      for (const [k, v] of Object.entries(res.skills)) merged.skills[k] = Math.max(merged.skills[k] || 0, v);
      for (const f of res.feats) if (!merged.feats.some(x => x.name === f.name && x.param === f.param)) merged.feats.push({...f});
      for (const [k, v] of Object.entries(res.attrNeeds)) merged.attrNeeds[k] = Math.max(merged.attrNeeds[k] || 0, v);
      merged.gmNotes.push(...res.gmNotes); merged.choices.push(...res.choices);
      res.pools.forEach(p => merged.pools.add(p)); merged.spellReqs.push(...res.spellReqs);
    }
    const lastDef = qdEntry(steps[steps.length - 1].name).def;
    let alloc;
    if (spec.manualAttrs) {  // v8.95.0: the dice-roller lane
      const m = qdManualAlloc(spec.manualAttrs, merged.attrNeeds, qdRacialAdjArr(spec));
      if (m.err) return {ok: false, reason: m.err};
      alloc = m;
    } else {
      alloc = qdAllocWithAdj(merged.attrNeeds, qdKeyAttrsFor(steps.map(st => st.name), lastDef), Math.floor(N / 4), qdRacialAdjArr(spec));  // v8.69.0 racial adj; v8.94.0 multi-key — the primary classes' key attributes in balance
      if (!alloc) return {ok: false, reason: 'attribute prerequisites exceed the 20-point buy even with every level bump'};
    }
    const spellPool = merged.pools.size ? [...merged.pools][0] : 'arcane';
    const powers = qdSpellPicks(merged.spellReqs.filter(r => r.kind !== 'access'), spellPool);
    const mk = (classes, id, nm) => ({
      id, name: nm, race: spec.race || 'Human', sex: '', align: 'Neutral',
      hybrid: (spec.race === 'Hybrid' && spec.hybrid && !spec.hybrid.invalid) ? {...spec.hybrid} : null,  // v8.68.2
      allegiance: '', occupations: [], xp: 0, hpMode: 'hero',
      schemaVer: CURRENT_SCHEMA_VER,
      attrs: alloc.attrs.slice(), attrBumps: alloc.bumps.slice(),
      sixLevels: {...spec.sixLevels}, scenarioPreset: spec.presetName || 'Custom',
      classes: classes.map(c => ({...c})),
      skills: {...merged.skills}, feats: merged.feats.map(f => ({...f})),
      powers: powers.map(p => ({...p})), talents: [], items: [], gear: [],
      maxHP: 10, hp: 10, log: [], _quickdraw: true,
      heroesGiftChoice: classes.some(c => c.tier === 'hero') ? null : undefined,
    });
    // Sequential entry validation: each step beyond the first (and a gated
    // first step) must pass the REAL checker against the ladder so far.
    // CAP-AWARE (the negative test caught it): the checker takes claimed
    // ranks at face value, so the sim's force-picked skills are clamped to
    // the entry doctrine's max (level+4 at the level BEFORE the level-up) —
    // otherwise "Ambassador 2, Fighter 2" would walk in the front door with
    // 6 impossible ranks at character level 0.
    let partial = [], lvlCount = 0;
    const owedPowerGates = [];
    for (let k = 0; k < steps.length; k++) {
      const st = steps[k];
      const sim = mk(partial, '__qdsim__', 'sim');
      const cappedSkills = {};
      for (const [sk, v] of Object.entries(merged.skills)) cappedSkills[sk] = Math.min(v, Math.max(0, lvlCount + 4));
      sim.skills = cappedSkills;
      sim.totalLvl = lvlCount;
      const r = classPrereqCheckOf(sim, st.name);
      // v8.52.1 (Adam's theurge-tower repro): repertoire gates (specific
      // powers/spells KNOWN — Metamind's "4th-level+ powers from 2
      // disciplines", Archmage's "5th-level+ spells from 5 schools") test
      // picks a skeleton deliberately leaves owed, so on a sim with zero
      // powers they refused ladders a real character satisfies with their
      // owed selections. Level ACCESS gates (powerAccess) still refuse hard
      // — those are ladder math, not expression. Repertoire misses become
      // owed-notes on the build log, and the Compass keeps them amber until
      // the powers are actually picked.
      const powerOnlyDescs = [];
      try {
        for (const g of (qdEntry(st.name).def.prereqs || [])) {
          if (g.length && g.every(o => o.type === 'powerRepertoire' || o.type === 'knowsPower')) {
            g.forEach(o => powerOnlyDescs.push(o.desc || o.name || o.type));
          }
        }
      } catch (e) {}
      const missing = (r.missing || []).filter(m => !merged.gmNotes.some(gn => m.includes(gn)) && !m.includes('(GM-verify)')
        && !powerOnlyDescs.some(d => m.includes(d)));
      if (missing.length) return {ok: false, reason: `step ${k + 1} — ${st.name} cannot be entered at character level ${lvlCount + 1}: ${missing.join(' · ')}`};
      const owedHere = powerOnlyDescs.filter(d => (r.missing || []).some(m => m.includes(d)));
      if (owedHere.length) owedPowerGates.push(`${st.name}: ${owedHere.join('; ')}`);
      partial = partial.concat([{...st}]); lvlCount += st.level;
    }
    // Final character — the same stamping block classic Quickdraw uses.
    const c = mk(steps, 'qb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), spec.name);
    c.totalLvl = N;
    const conM = am(c.attrs[2]);
    let hp = 0, li = 0;
    for (const e of steps) {
      const hd = qdEntry(e.name).def.hd || 8;
      for (let i = 0; i < e.level; i++) { li++; hp += (li === 1 ? hd : Math.floor((Math.floor(hd / 2) + 1 + hd) / 2)) + conM; }
    }
    c.maxHP = Math.max(1, hp); c.currentHP = c.maxHP; c.hp = c.maxHP;
    c.xp = xpThreshold(N);
    const s = computeStatsFromClasses(steps);
    c.bab = s.bab; c.def = s.def; c.fort = s.fort; c.ref = s.ref; c.will = s.will; c.rep = s.rep;
    c.apMax = s.ap; c.ap = c.apMax;
    const by = (t) => steps.find(e => e.tier === t);
    c.heroClass = by('hero') ? by('hero').name : ''; c.heroLvl = by('hero') ? by('hero').level : 0;
    c.basicClass = by('basic') ? by('basic').name : ''; c.basicLvl = by('basic') ? by('basic').level : 0;
    c.advClass = by('advanced') ? by('advanced').name : ''; c.advLvl = by('advanced') ? by('advanced').level : 0;
    c.presClass = by('prestige') ? by('prestige').name : ''; c.presLvl = by('prestige') ? by('prestige').level : 0;
    try { reconcileGrantedFeats(c); } catch (e) {}
    // v8.53.0: build-time occupation (optional). Sets the occupation only —
    // the perk picks stay owed; the ledger's picks-unchosen note takes over.
    if (spec.occupation) c.occupations = [spec.occupation];
    if (merged.gmNotes.length) {
      c.gmExceptions = [{type: 'class', target: 'Bespoke ladder', missing: merged.gmNotes.map(n => n + ' (GM-verify)'), grantedAt: new Date().toLocaleDateString()}];
    }
    const stamp = new Date().toLocaleString();
    const ladderTxt = steps.map(e => `${e.name} ${e.level}`).join(' / ');
    c.log.push({time: stamp, text: `⚡ Quickdraw Bespoke: ${ladderTxt} (level ${N}). Every entry validated at its own level; forced picks only — the amber dots mark everything still yours to choose.`});
    if (merged.choices.length) c.log.push({time: stamp, text: `⚡ Auto-resolved (swap freely): ${merged.choices.join(' · ')}`});
    if (owedPowerGates.length) c.log.push({time: stamp, text: `⚡ OWED to qualify (fill via Psionic Powers/Spells tab): ${owedPowerGates.join(' · ')} — these repertoire gates ride on the powers you pick; the class stands admitted on the ladder's math.`});
    if (alloc.bumps.length) c.log.push({time: stamp, text: `⚡ Level bumps (${alloc.bumps.length}) assigned: ${alloc.bumps.join(', ')}.`});
    refreshEclXp(c);
    return {ok: true, char: c, summary: ladderTxt};
  } catch (err) {
    return {ok: false, reason: 'Bespoke build error: ' + (err && err.message || err)};
  }
}
function qdBespokeRun() {
  const parsed = qdBespokeParse((document.getElementById('qd-bespoke') || {}).value);
  if (parsed.err) { toast('⚡ Bespoke: ' + parsed.err); return; }
  const six = {};
  for (const a of ['arcane', 'divine', 'heroic', 'mutation', 'psionic', 'tech']) six[a] = parseInt((document.getElementById('qd-sl-' + a) || {}).value, 10) || 0;
  // v8.68.2: Bespoke shares the QD Hybrid parent row — validate up front.
  const _bspHyb = qdHybridSpec();
  if (_bspHyb && _bspHyb.invalid) { toast('⚗ Hybrid: pick BOTH Humanoid parents first.'); return; }
  const spec = {
    steps: parsed.steps, sixLevels: six,
    presetName: (document.getElementById('qd-preset') || {}).value || 'Custom',
    race: (document.getElementById('qd-race') || {}).value || 'Human',
    hybrid: _bspHyb,
    name: ((document.getElementById('qd-stem') || {}).value || '').trim() || 'Bespoke Hero',
    occupation: (document.getElementById('qd-occ') || {}).value || '',
    manualAttrs: qdManualAttrs(),  // v8.95.0: dice-roller lane
  };
  const r = qdBespokeBuild(spec);
  if (!r.ok) { toast('⚡ Bespoke refused: ' + r.reason); return; }
  chars.push(r.char); curId = r.char.id;
  save();
  closeQuickdraw();
  showPage('sheet'); renderSheet(); renderRoster();
  toast(`⚡ Bespoke built: ${r.char.name} — ${r.summary}. The amber dots hold everything still to choose.`);
}

// ---- Quickdraw UI ----
function openQuickdraw() {
  const m = document.getElementById('qd-modal');
  if (!m) return;
  // preset select
  qdPopulatePresetSelect(_lastScenSel.qd || 'The Ordinary World');
  // v8.53.0: occupation offered at build time — options mirror the create
  // page's list, with a choose-later default that keeps the old owed path.
  const oSel = document.getElementById('qd-occ');
  if (oSel && !oSel.options.length) {
    const src = document.getElementById('c-occ');
    const names = src ? [...src.options].map(o => o.value).filter(Boolean) : [];
    oSel.innerHTML = ['<option value="">— choose later (✎ Edit on the Sheet) —</option>']
      .concat(names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)).join('');
    qdOccHint();
  }
  qdOnPreset();
  m.style.display = 'block';
}
// v8.53.0: the gentle nudge — what this occupation is worth, before the
// player waves it off. Perks only; the picks themselves stay owed.
function qdOccHint() {
  const el = document.getElementById('qd-occ-hint');
  if (!el) return;
  const name = (document.getElementById('qd-occ') || {}).value || '';
  if (!name) {
    el.innerHTML = `An occupation is free value — permanent class skills, sometimes a bonus feat, a Wealth bump. Skippable now, but the sheet will keep a gentle amber reminder.`;
    return;
  }
  let od = null;
  try { od = getOccupationData(name); } catch (e) {}
  if (!od) { el.textContent = ''; return; }
  const bits = [];
  if (od.skill_count) bits.push(`<b>${od.skill_count}</b> permanent class-skill pick${od.skill_count === 1 ? '' : 's'} (from ${ (od.skill_list || []).length } options)`);
  if (od.bonus_feat_options && od.bonus_feat_options.length) bits.push(`bonus feat: ${od.bonus_feat_options.join(' / ')}`);
  if (od.wealth) bits.push(`Wealth +${od.wealth}`);
  const gates = [];
  if (od.prereq_age) gates.push(`age ${od.prereq_age}+`);
  if (od.prereq_other) gates.push(od.prereq_other);
  el.innerHTML = `🎁 ${bits.join(' · ') || 'see the book entry'}${gates.length ? ` <span style="opacity:var(--o60);color:var(--dim);">(requires: ${escapeHTML(gates.join(', '))} — GM confirms)</span>` : ''} — the picks stay yours, flagged on the sheet.`;
}
function qdScales() {
  const sl = {};
  for (const ax of ['arcane', 'divine', 'heroic', 'mutation', 'psionic', 'tech']) {
    sl[ax] = Math.max(0, Math.min(9, parseInt(document.getElementById('qd-sl-' + ax).value, 10) || 0));
  }
  return sl;
}
// v8.54.0: the Quickdraw preset select now carries the Established Scenarios
// optgroup + the establish entry alongside the built-ins.
function qdPopulatePresetSelect(selected) {
  const pSel = document.getElementById('qd-preset');
  if (!pSel) return;
  pSel.innerHTML = Object.keys(SCENARIO_PRESETS).map(n => `<option${n === selected ? ' selected' : ''}>${n}</option>`).join('')
    + (customScenarios.length
        ? `<optgroup label="Established Scenarios">${customScenarios.map(s => `<option value="${escapeHTML(s.name)}"${s.name === selected ? ' selected' : ''}>${s.locked ? '🔒 ' : ''}${escapeHTML(s.name)}</option>`).join('')}</optgroup>`
        : '')
    + '<option value="__establish__">✦ Name and Establish Your Scenario…</option>';
}
function qdOnPreset() {
  const name = document.getElementById('qd-preset').value;
  if (name === '__establish__') { openScenarioStudio('qd'); return; }
  const p = scenarioScalesOf(name);   // v8.54.0: established scenarios first, then built-ins
  if (p) for (const ax of Object.keys(p)) { const el = document.getElementById('qd-sl-' + ax); if (el) el.value = p[ax]; }
  _lastScenSel.qd = name;
  qdRefreshClassLists();
}
function qdRefreshClassLists() {
  const sl = qdScales();
  const disabled = disabledClassesForScenario(sl);
  const gSel = document.getElementById('qd-goal');
  const prev = gSel.value;
  const tiers = [['Ordinary', ORDINARY_CLASSES], ['Hero', HERO_CLASSES], ['Basic', BASIC_CLASSES], ['Advanced', ADVANCED_CLASSES], ['Prestige', PRESTIGE_CLASSES]];
  gSel.innerHTML = tiers.map(([label, st]) => {
    const names = Object.keys(st).filter(n => !disabled.has(n)).sort();
    return names.length ? `<optgroup label="${label}">${names.map(n => `<option${n === prev ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>` : '';
  }).join('');
  const sSel = document.getElementById('qd-start');
  const sPrev = sSel.value;
  const starts = qdLegalStarts(sl);
  sSel.innerHTML = `<option value="AUTO">— most direct (auto) —</option><option value="MIX">— varied squad (mix) —</option>` +
    starts.map(s => `<option value="${escapeHTML(s.name)}"${s.name === sPrev ? ' selected' : ''}>${escapeHTML(s.name)}</option>`).join('');
  // race list (Human default). v8.68.2: the legacy 'Mutant/Hybrid' catch-all
  // is creation-barred (legacy records only); Hybrid stays and prompts for
  // its parents via the row below the select.
  const rSel = document.getElementById('qd-race');
  if (!rSel.options.length) {
    const names = (Array.isArray(RACES) ? RACES.map(r => r.name || r.n || r).filter(Boolean) : Object.keys(RACES))
      .filter(n => n !== 'Mutant/Hybrid');
    rSel.innerHTML = names.sort().map(n => `<option${n === 'Human' ? ' selected' : ''}>${escapeHTML(n)}</option>`).join('');
  }
  qdHybridToggle();
}
// v8.68.2: show the Hybrid parent row when the QD race is Hybrid; the
// parent pool is the same Humanoid whitelist the Create form uses.
function qdHybridToggle() {
  const row = document.getElementById('qd-hyb-row');
  const rSel = document.getElementById('qd-race');
  if (!row || !rSel) return;
  const on = rSel.value === 'Hybrid';
  row.style.display = on ? '' : 'none';
  if (on) {
    const a = document.getElementById('qd-hyb-a'), b = document.getElementById('qd-hyb-b');
    if (a && !a.options.length) {
      const opts = '<option value="">— choose —</option>' + _hybridEligibleRaces().map(n => `<option>${escapeHTML(n)}</option>`).join('');
      a.innerHTML = opts; b.innerHTML = opts + '<option title="A half-again-sized specimen of Parent A (+2 Str/+2 Con/−2 Dex, Powerful Build, carry ×2); contributes +0 RLM — the Hybrid +1 does the rest. Formal rules: UCS.">Half-Again</option>';  // v9.0.0: the egg sits in Parent B only
    }
  }
}
function closeQuickdraw() { const m = document.getElementById('qd-modal'); if (m) m.style.display = 'none'; }
// v8.68.2: the QD/Bespoke Hybrid parent record (null = not a Hybrid;
// {invalid:true} = Hybrid chosen but parents unset — the caller toasts).
function qdHybridSpec() {
  const rSel = document.getElementById('qd-race');
  if (!rSel || rSel.value !== 'Hybrid') return null;
  const a = document.getElementById('qd-hyb-a')?.value || '';
  const b = document.getElementById('qd-hyb-b')?.value || '';
  if (!a || !b) return { invalid: true };
  if (a === 'Half-Again' && b === 'Half-Again') return { invalid: true };  // v9.0.0: no hybrid at all
  return { a, b, sizeFrom: document.getElementById('qd-hyb-size')?.value || 'a', rlmOverride: null, dropped: '' };
}
function qdRun() {
  const sl = qdScales();
  const goal = document.getElementById('qd-goal').value;
  const level = Math.max(1, Math.min(20, parseInt(document.getElementById('qd-level').value, 10) || 1));
  const startVal = document.getElementById('qd-start').value;
  const race = document.getElementById('qd-race').value || 'Human';
  // v8.68.2: a Hybrid build needs its parents declared up front.
  const hyb = qdHybridSpec();
  if (hyb && hyb.invalid) { toast('⚗ Hybrid: pick BOTH Humanoid parents first.'); return; }
  const count = Math.max(1, Math.min(10, parseInt(document.getElementById('qd-count').value, 10) || 1));
  const stem = (document.getElementById('qd-stem').value || '').trim() || goal;
  const presetName = document.getElementById('qd-preset').value;
  const starts = qdLegalStarts(sl);
  const built = [], failed = [];
  for (let i = 0; i < count; i++) {
    const name = count > 1 ? `${stem} ${i + 1}` : stem;
    let r = null;
    if (startVal === 'MIX' && starts.length) {
      // Rotate starts for squad variety; when a start honestly can't reach
      // the goal (a Smart Ordinary can't make Soldier's BAB +3 by level 5),
      // fall through to the next one so the squad still fills.
      for (let k = 0; k < starts.length; k++) {
        r = qdBuild({goal, level, startClass: starts[(i + k) % starts.length].name, sixLevels: sl, presetName, race, name, hybrid: hyb, manualAttrs: qdManualAttrs()});
        if (r.ok) break;
      }
    } else {
      const startClass = (startVal === 'AUTO' || startVal === 'MIX') ? null : startVal;
      r = qdBuild({goal, level, startClass, sixLevels: sl, presetName, race, name, hybrid: hyb, manualAttrs: qdManualAttrs()});
    }
    if (r && r.ok) {
      // v8.53.0: build-time occupation — sets the occupation only; the perk
      // picks stay owed, and the ledger's picks-unchosen note takes over.
      const occV = (document.getElementById('qd-occ') || {}).value || '';
      if (occV) r.char.occupations = [occV];
      built.push(r); chars.push(r.char);
    }
    else failed.push(r ? r.reason : 'no result');
  }
  if (built.length) {
    curId = built[built.length - 1].char.id;
    save(); renderRoster(); closeQuickdraw(); showPage('roster');
    const residuals = built.filter(b => b.residual && b.residual.length);
    toast(`⚡ Quickdraw: ${built.length} built (${built[0].summary})${failed.length ? ` · ${failed.length} failed: ${failed[0]}` : ''}${residuals.length ? ' · ⚠ residual gaps logged' : ''} — follow the amber dots to finish them.`);
  } else {
    toast(`⚡ Quickdraw refused: ${failed[0] || 'unknown error'}`);
  }
}

function skillPointsSpentOf(c) {
  let spent = 0;
  for (const name in (c.skills || {})) {
    const r = c.skills[name] || 0;
    if (r <= 0) continue;
    spent += isClassSkill(name, c) ? r : r * 2;
  }
  return spent;
}
// v8.51.0 (Xander build finding #2): when the budget line runs hot, SAY WHY.
// Itemizes the cross-class surcharge (the doubled half of each 2×-cost rank)
// so a mysterious overage becomes a pointer at the exact skills — and, via
// the occupation-picks owed note, at the unmade pick usually causing it.
function crossClassPremiumOf(c) {
  const items = []; let prem = 0;
  for (const name in (c.skills || {})) {
    const r = c.skills[name] || 0;
    if (r > 0 && !isClassSkill(name, c)) { prem += r; items.push(`${name} ×${r}`); }
  }
  return {prem, items};
}
