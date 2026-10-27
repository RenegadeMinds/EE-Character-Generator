// =============================================================================
// js/rules/22-career-compass.js
// CAREER COMPASS
// =============================================================================
//
// WHAT'S IN HERE
//   Career Compass: level-up advice that works backwards from a chosen goal
//   class.
//
// KEY NAMES (so you can search for them)
//   functions (18): classPrereqCheckOf, _compassTierOf, _compassAnnotate,
//   careerCompassState, classSkillListHas, careerNextStep, _compassExp,
//   toggleCompass, setCareerGoal, onCareerGoalSelect,
//   setCareerGoalFromLevelUp, renderCareerCompass, outstandingSelections,
//   renderNavTabs, checkTalentPrereqs, addTalentToChar, removeTalentFromChar,
//   getClassEntry
//
// LOAD ORDER
//   File 22 of 68. index.html loads it after js/rules/21-quickdraw.js and
//   before js/rules/23-hit-points-xp-skills.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 16791-17633 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 16791-17633; unchanged below this line ----
// v8.32.0 (Adam): which tabs hold an OUTSTANDING selection — unspent skill
// points, open talent/feat slots, an unassigned Hero's Gift, a feat missing
// its parameter (the ⬦ case), or unpicked spells/powers known. Returns
// {tabId: [note, ...]}. Every probe is guarded — a half-built record must
// never break nav rendering.
// ========================================================================
// CAREER COMPASS (v8.39.0) — "build your character in reverse".
// The player pledges a target class (c.careerGoal, Advanced/Prestige); the
// Sheet renders that class's prereq groups as a live checklist fed by
// checkClassPrereqsFromArray's structured `report` — the same evaluation
// the add-class and Level Up gates run, so the Compass can never disagree
// with the door it points at. On top of the checklist: best-case
// earliest-entry math and a GREEDY next-level class suggestion (one step,
// with reasons — never a whole script; quest-tracker, not auto-planner).
// Story/GM prereqs (notes, allegiances) render as ◈ GM-gate rows: always
// visible, never blocking the math, never pretended solvable.
// ========================================================================

// One canonical way to run the class-prereq check against a SAVED character
// (mirrors the Level Up dialog's call at lvlupOnNewClassName).
function classPrereqCheckOf(c, className) {
  const sl = c.sixLevels || {arcane:0, divine:0, heroic:c.heroicLevel||1, mutation:0, psionic:0, tech:5};
  const ctx = {attrs: c.attrs||[10,10,10,10,10,10], allegiance: c.allegiance||'', align: c.align||'', char: c};
  return checkClassPrereqsFromArray(
    className, c.classes||[], c.skills||{},
    (c.feats||[]).map(f => typeof f === 'string' ? f : (f.name || f.n)),
    sl, ctx);
}

function _compassTierOf(name) {
  if (ADVANCED_CLASSES[name]) return 'advanced';
  if (PRESTIGE_CLASSES[name]) return 'prestige';
  if (HERO_CLASSES[name]) return 'hero';
  if (BASIC_CLASSES[name]) return 'basic';
  if (ORDINARY_CLASSES[name]) return 'ordinary';
  if (MONSTROUS_CLASSES[name]) return 'monstrous'; // v9.15.0 §273
  return null;
}

// Best-case ENTRY-level bound for "when could a class gated by this option
// be taken", plus a progress string and an advice line. All bounds are BEST
// CASE (the label says so in the UI); GM/story/scenario gates return
// earliest:null.
// DOCTRINE (Adam's correction, 2026-09-26, v8.39.1): prerequisites must be
// met BEFORE the level-up — nothing gained WITH the new level (skill ranks,
// attribute bumps, feat picks) counts toward qualifying for that same level.
// Every bound below is therefore qualify-level + 1. The Hero 2 → advanced-
// entry-at-char-3 calibration needs no same-level counting: E&E max ranks =
// character level + 4 (HH "Skills"; the generator's rank inputs enforce the
// same lvl+4 cap), so a 2nd-level character legitimately holds 6 ranks
// before the level-up. (v8.39.0 shipped with d20M's lvl+3 cap PLUS a same-
// level-counting misread — the two errors cancelled on skill bounds but left
// attr-bump and feat-slot bounds one level too optimistic.)
function _compassAnnotate(c, o, totalLvl, stats) {
  const a = {desc: o.desc, met: o.met, opt: o.opt || {}, kind: 'build', prog: '', advice: '', earliest: null};
  const opt = a.opt, t = opt.type;
  const skills = c.skills || {};
  try {
    if (t === 'skill') {
      // N ranks reachable at level N−4 (class-skill max = level+4), met
      // BEFORE the level-up → entry at N−3.
      const now = skills[opt.name] || 0;
      a.prog = `${now}/${opt.min} ranks`;
      a.earliest = Math.max(2, opt.min - 3);
      const cs = isClassSkill(opt.name, c);
      a.advice = `max ranks = level+4, met before the level-up` + (cs ? '' : ` — cross-class for your current classes (half rate, half cap)`);
    } else if (t === 'skillFamily') {
      let best = 0;
      SKILLS.forEach(sk => { if (sk.family === opt.family) best = Math.max(best, skills[sk.n] || 0); });
      a.prog = `best ${best}/${opt.min} ranks`;
      a.earliest = Math.max(2, opt.min - 3);
    } else if (t === 'skillFamilyCount') {
      const n = SKILLS.filter(sk => sk.family === opt.family && (skills[sk.n] || 0) >= opt.min).length;
      a.prog = `${n}/${opt.count} skills at ${opt.min}+`;
      a.earliest = Math.max(2, opt.min - 3);
    } else if (t === 'attr' || t === 'attrAny') {
      // The bump lands WITH its level — it qualifies you for the NEXT one.
      const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
      const attrs = c.attrs || [10,10,10,10,10,10];
      const now = t === 'attr' ? (attrs[ATTR_IDX[opt.name]] || 0) : Math.max(...attrs);
      a.prog = `now ${now}`;
      const k = Math.max(0, opt.min - now);
      a.earliest = k === 0 ? totalLvl : (Math.floor(totalLvl / 4) + k) * 4 + 1;
      a.advice = 'attribute bump every 4th level (usable from the level after), or an enhancement item';
    } else if (t === 'bab') {
      // BAB accrues from prior levels; qualify-level + 1 like everything
      // else (see the doctrine block above).
      a.prog = `now +${stats.bab}`;
      a.earliest = totalLvl + Math.max(0, opt.min - stats.bab) + 1;
      a.advice = 'best case assumes full-BAB levels (+1/level)';
    } else if (t === 'def') {
      a.prog = `now +${stats.def}`;
      a.earliest = totalLvl + Math.max(0, opt.min - stats.def) + 1;
    } else if (t === 'feat' || t === 'featParamIs') {
      // A feat picked WITH a level qualifies you for the level AFTER it; an
      // open slot can be filled at the current level → entry next level-up.
      let slotOpen = false;
      try { slotOpen = getFeatBudget(c).remaining > 0; } catch (e) {}
      const slotLvl = slotOpen ? totalLvl : 3 * (Math.floor(totalLvl / 3) + 1);
      a.earliest = slotLvl + 1;
      a.advice = slotOpen ? 'you have an open feat slot right now' : `next feat slot at level ${slotLvl} (usable from the level after)`;
      try {
        const chain = checkFeatPrereqs(opt.name, c);
        if (!chain.met && chain.missing.length) a.advice += ` · ${opt.name} itself needs: ${chain.missing.join(', ')}`;
      } catch (e) {}
    } else if (t === 'featCount' || t === 'featParamCount') {
      let rem = 0; try { rem = getFeatBudget(c).remaining; } catch (e) {}
      const now = t === 'featCount'
        ? (c.feats || []).filter(f => { const fd = getFeatData(f.name || f.n); return fd && (opt.families || []).includes(fd.family); }).length
        : new Set((c.feats || []).filter(f => (f.name || f.n) === opt.name && f.param).map(f => f.param)).size;
      a.prog = `${now}/${opt.min}`;
      const extra = Math.max(0, (opt.min - now) - rem);
      a.earliest = (extra === 0 ? totalLvl : 3 * (Math.floor(totalLvl / 3) + extra)) + 1;
    } else if (t === 'tierLevel') {
      // Prior levels only — the entry level can't count toward its own gate.
      const now = (c.classes || []).reduce((s, e) => s + (e.tier === opt.tier ? (e.level || 0) : 0), 0);
      a.prog = `${now}/${opt.min} levels`;
      a.earliest = totalLvl + Math.max(0, opt.min - now) + 1;
    } else if (t === 'classLevel') {
      const now = (c.classes || []).filter(e => (!opt.tier || e.tier === opt.tier) && (!opt.name || e.name === opt.name))
        .reduce((s, e) => Math.max(s, e.level || 0), 0);
      a.prog = `${now}/${opt.min || 1} levels`;
      a.earliest = totalLvl + Math.max(0, (opt.min || 1) - now) + 1;
    } else if (t === 'powerAccess') {
      const ps = computeCasterStats(c);
      const pools = opt.pools === 'any' ? ['arcane', 'divine', 'psionic'] : (opt.pools || []).filter(p => p !== 'super');
      const now = Math.max(0, ...pools.map(p => ((ps[p] || {}).maxPowerLvl || 0)));
      a.prog = `now ${now}/${opt.lvl} max level`;
      a.earliest = now >= opt.lvl ? totalLvl : totalLvl + Math.max(1, 2 * (opt.lvl - now) - 1) + 1;
      a.advice = 'advance a casting/manifesting class (rough best case)';
    } else if (t === 'classAbility') {
      const grants = (CLASS_ABILITIES[opt.name]) || [];
      a.advice = grants.length ? ('granted by: ' + grants.map(g => `${g.name} ${g.minLvl}`).join(' or ')) : 'see the granting class entry';
    } else if (t === 'knowsPower') {
      a.advice = 'add the named spell/power to your repertoire at a level-up';
    } else if (t === 'powerRepertoire') {
      a.advice = 'repertoire requirement — see the class entry';
    } else if (t === 'mpTotal') {
      a.advice = 'earn Mutation Points in play';
    } else if (t === 'sixLevel' || t === 'sixLevelAny' || t === 'sixLevelOr') {
      a.kind = 'scenario';
      a.advice = "scenario dial — the GM's setting, not a build choice";
    } else if (t === 'allegiance' || t === 'alignment') {
      a.kind = 'gm';
      a.advice = 'character identity — declare via ✎ Edit (GM adjudicates)';
    } else if (t === 'talent') {
      // v8.71.0 (Adam's Hellfire/Compass report): a talent is a BUILD
      // choice, not a story gate — it rode the note-handler while the
      // engine's talent check was a stub. Progress and bound now read the
      // talent budget: an open slot is pickable immediately (entry next
      // level-up); otherwise the next Hero level brings one (best case).
      let rem = 0; try { const tb = getTalentBudget(c); rem = (tb.totalOwed || 0) - (tb.totalPicked || 0); } catch (e) {}
      a.earliest = (rem > 0 ? totalLvl : totalLvl + 1) + 1;
      a.advice = rem > 0 ? 'you have an open talent slot right now' : 'pick it with your next Hero-class talent slot';
    } else if (t === 'note') {
      a.kind = 'gm';
      a.advice = 'story gate — talk to your GM';
    }
  } catch (e) { /* annotation is decorative — never let it break the check */ }
  return a;
}

// Full Compass state for the pledged goal: annotated groups, earliest-entry
// bound, ownership. Returns null when no goal is set.
function careerCompassState(c) {
  const goal = c && c.careerGoal;
  if (!goal) return null;
  const tier = _compassTierOf(goal);
  if (!tier) return {goal, invalid: true};
  const owned = migrateLegacyClasses(c).some(e => e.name === goal && (e.level || 0) > 0);
  const r = classPrereqCheckOf(c, goal);
  const totalLvl = migrateLegacyClasses(c).reduce((s, e) => s + (e.level || 0), 0);
  const stats = computeStatsFromClasses(c.classes || []);
  const groups = (r.report || []).map(g => ({met: g.met, options: g.options.map(o => _compassAnnotate(c, o, totalLvl, stats))}));
  let earliest = totalLvl + 1, gmGated = false;
  for (const g of groups) {
    if (g.met) continue;
    if (g.options.every(o => o.kind !== 'build')) { gmGated = true; continue; }
    const bounds = g.options.filter(o => o.kind === 'build' && o.earliest !== null).map(o => o.earliest);
    if (!bounds.length) { gmGated = true; continue; }
    // A group needs only its SOONEST option. Each option's `earliest` is
    // already an ENTRY-level bound: qualify-level + 1 across the board,
    // because prerequisites must be met BEFORE the level-up (Adam's
    // correction, v8.39.1 — see the doctrine block on _compassAnnotate).
    earliest = Math.max(earliest, Math.min(...bounds), totalLvl + 1);
  }
  return {goal, tier, owned, met: r.met, groups, earliest, gmGated, totalLvl,
          metCount: groups.filter(g => g.met).length, totalCount: groups.length};
}

// v8.56.0 (playtest issue #2): class-skill lists carry '(Any)' families and
// compound '(A, B, C)' entries — the advisor's literal includes() check
// missed them. One matcher, three forms: exact, family-(Any), compound
// sub-list. Mirrors the isClassSkill machinery's semantics for LIST data.
function classSkillListHas(csk, skillName) {
  if (!Array.isArray(csk)) return false;
  if (csk.includes(skillName)) return true;
  const m = skillName.match(/^([^(]+)\((.+)\)\s*$/);
  const fam = (m ? m[1] : skillName).trim();
  const sub = m ? m[2].trim().toLowerCase() : null;
  return csk.some(entry => {
    const em = String(entry).match(/^([^(]+)\((.+)\)\s*$/);
    if (!em || em[1].trim() !== fam) return false;
    const inner = em[2].trim();
    if (/^any$/i.test(inner)) return true;
    return !!sub && inner.split(',').map(s => s.trim().toLowerCase()).includes(sub);
  });
}
// Greedy next-level advisor: of the classes the character could take a level
// in RIGHT NOW, which most advances the goal's outstanding buildable gaps?
// Returns {top, runnerUp} or null when no class choice materially helps.
function careerNextStep(c, state) {
  if (!state || state.invalid || state.met || state.owned) return null;
  const skillGaps = new Set(), famGaps = new Set(), wantPools = new Set(),
        wantTiers = new Set(), wantClasses = new Set();
  let wantBab = false;
  for (const g of state.groups) {
    if (g.met) continue;
    for (const o of g.options) {
      const t = o.opt.type;
      if (t === 'skill') skillGaps.add(o.opt.name);
      else if (t === 'skillFamily' || t === 'skillFamilyCount') famGaps.add(o.opt.family);
      else if (t === 'bab') wantBab = true;
      else if (t === 'powerAccess') (o.opt.pools === 'any' ? ['arcane','divine','psionic'] : (o.opt.pools || [])).forEach(p => wantPools.add(p));
      else if (t === 'tierLevel') wantTiers.add(o.opt.tier);
      else if (t === 'classLevel' && o.opt.name) wantClasses.add(o.opt.name);
    }
  }
  const stores = [];
  stores.push(['ordinary', ORDINARY_CLASSES]);
  stores.push(['hero', HERO_CLASSES], ['basic', BASIC_CLASSES], ['advanced', ADVANCED_CLASSES], ['prestige', PRESTIGE_CLASSES]);
  const lvlOf = (n) => { const e = migrateLegacyClasses(c).find(x => x.name === n); return e ? (e.level || 0) : 0; };
  const results = [];
  for (const [tier, store] of stores) {
    for (const K of Object.keys(store)) {
      if (K === state.goal) continue;
      const ownedLvl = lvlOf(K);
      if (tier === 'hero' && ownedLvl >= 10) continue;  // hero tier caps at 10
      let chk; try { chk = classPrereqCheckOf(c, K); } catch (e) { continue; }
      if (!chk.met) continue;  // can't take a level you don't qualify for
      const def = store[K];
      let score = 0; const reasons = [];
      const csk = (CLASS_SKILLS[K]) || [];
      const skHits = [...skillGaps].filter(s => classSkillListHas(csk, s));
      const famHits = [...famGaps].filter(fam => SKILLS.some(sk => sk.family === fam && classSkillListHas(csk, sk.n)));
      if (skHits.length || famHits.length) {
        // v8.56.0: the sp/8 rider is gone from THIS branch — any class-skill
        // route reaches rank targets at 1 pt/rank, and the rider let raw
        // skill points outvote full-vs-partial casting (Paladin above
        // Cleric for an Ecclesiarch goal — the playtest's issue #2).
        score += 2 * (skHits.length + famHits.length);
        const names = skHits.concat(famHits.map(f => f + ' (family)'));
        reasons.push(`${names.join(', ')} ${names.length === 1 ? 'is a class skill' : 'are class skills'} (${def.sp || 0}+Int pts/level)`);
      } else if ((skillGaps.size || famGaps.size) && (def.sp || 0) >= 6) {
        score += 0.5;
        reasons.push(`${def.sp}+Int skill points/level (though cross-class for the needed skills)`);
      }
      if (wantBab && Array.isArray(def.bab) && def.bab.length) {
        const slope = (def.bab[Math.min(3, def.bab.length - 1)] || 0) / Math.min(4, def.bab.length);
        if (slope >= 0.95) { score += 2; reasons.push('full Base Attack progression'); }
        else if (slope >= 0.7) { score += 1; reasons.push('¾ Base Attack progression'); }
      }
      const cc = CASTER_CLASSES[K];
      // v8.56.0 (playtest issue #2): FULL casters outrank partial ones — a
      // Paladin "advances divine casting" but can never reach the 7th-level
      // spells an Ecclesiarch goal demands; the old flat +2 let sp/level
      // tiebreak Paladin ABOVE Cleric. Directness is the doctrine.
      if (cc && cc.pool && wantPools.has(cc.pool)) {
        const full = (cc.mode === 'full');
        score += full ? 2 : 1;
        reasons.push(`advances ${cc.pool} casting/manifesting${full ? ' (full progression)' : ' (partial progression)'}`);
      }
      if (wantTiers.has(tier)) { score += 1.5; reasons.push(`counts toward the ${tier}-tier level requirement`); }
      if (wantClasses.has(K)) { score += 3; reasons.push('is itself the required class'); }
      if (score > 0 && ownedLvl > 0) { score += 0.25; }  // continuity nudge
      // v8.56.0: key-attribute affinity — "most direct" means for THIS
      // character. A Wis-built Dedicated Hero fits the Wis-keyed Cleric
      // over the Cha-keyed Saint; a half-point settles same-road ties.
      try {
        const AIX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
        const code = def.attrMinKey || (def.attr ? String(def.attr).split('/')[0].trim() : null);
        const ai = code !== null ? AIX[code] : undefined;
        if (ai !== undefined && score > 0 && am((c.attrs || [])[ai] || 10) >= 1) {
          score += 0.5; reasons.push(`${code}-keyed — plays to this character's strengths`);
        }
      } catch (e) {}
      if (score > 0) results.push({name: K, tier, score, reasons});
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.length ? {top: results[0], runnerUp: results[1] || null} : null;
}

// ---- Compass UI ----
let _compassExpanded = null;
function _compassExp() {
  if (_compassExpanded === null) {
    try { _compassExpanded = localStorage.getItem('dxd20v2_ui_compassOpen') !== '0'; } catch (e) { _compassExpanded = true; }
  }
  return _compassExpanded;
}
function toggleCompass() {
  _compassExpanded = !_compassExp();
  try { localStorage.setItem('dxd20v2_ui_compassOpen', _compassExpanded ? '1' : '0'); } catch (e) {}
  const c = chars.find(x => x.id === curId);
  if (c) renderCareerCompass(c);
}
function setCareerGoal(name) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (name) { c.careerGoal = name; toast('⭐ Career goal set: ' + name); }
  else { delete c.careerGoal; }
  save();
  renderCareerCompass(c);
  renderNavTabs(c);
}
function onCareerGoalSelect(sel) { setCareerGoal(sel.value || ''); }
// ⭐ from the Level Up dialog's "prereqs unmet" warning — pledge and carry on.
function setCareerGoalFromLevelUp(name) {
  const lu = _pendingLevelUp;
  if (!lu || !lu.char) return;
  lu.char.careerGoal = name;
  save();
  toast('⭐ Career goal set: ' + name + ' — the Sheet tab now tracks your path.');
  lvlupRenderClassChoice();
}

function renderCareerCompass(c) {
  const slot = document.getElementById('sh-career-compass');
  if (!slot) return;
  try {
    const goalable = [];
    for (const [label, store] of [['Advanced', ADVANCED_CLASSES], ['Prestige', PRESTIGE_CLASSES]]) {
      goalable.push([label, Object.keys(store).sort()]);
    }
    const st = careerCompassState(c);
    const esc = escapeHTML;
    const selHTML = `<select onchange="onCareerGoalSelect(this)" style="font-size:11px;max-width:220px;">
      <option value="">— set a goal —</option>
      ${goalable.map(([label, names]) => `<optgroup label="${label}">${names.map(n =>
        `<option value="${esc(n)}"${st && st.goal === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}
    </select>`;
    if (!st) {
      slot.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border:1px dashed rgba(200,151,30,.3);border-radius:3px;font-size:11px;color:var(--g60);">
        ⭐ Career Compass ${selHTML}</div>`;
      return;
    }
    if (st.invalid) {
      slot.innerHTML = `<div style="padding:5px 10px;border:1px solid rgba(212,112,112,.3);border-radius:3px;font-size:11px;color:var(--red-text);">
        ⭐ Career goal "${esc(st.goal)}" not found (renamed?). <button class="btn btn-sm" onclick="setCareerGoal('')" style="font-size:10px;">Clear</button></div>`;
      return;
    }
    const tierLabel = {advanced:'Advanced', prestige:'Prestige', hero:'Hero', basic:'Basic', ordinary:'Ordinary'}[st.tier] || st.tier;
    let statusChip;
    if (st.owned) statusChip = `<span style="color:#6dba88;font-weight:bold;">🎉 ACHIEVED</span>`;
    else if (st.met) statusChip = `<span style="color:#6dba88;font-weight:bold;">✓ UNLOCKED — take your first level!</span>`;
    else statusChip = `<span style="color:var(--g85);">${st.metCount}/${st.totalCount} met · earliest entry ~level ${st.earliest}${st.gmGated ? ' + GM gate' : ''} <span style="opacity:var(--o55);color:var(--dim);">(best case)</span></span>`;
    const arrow = _compassExp() ? '▾' : '▸';
    let html = `<div style="border:1px solid rgba(125,170,220,.35);border-radius:3px;background:rgba(125,170,220,.05);font-size:12px;">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;flex-wrap:wrap;">
        <span onclick="toggleCompass()" style="cursor:pointer;color:#7daadc;font-family:'Epics Serif','Cinzel',serif;letter-spacing:.05em;">${arrow} ⭐ Career Compass:</span>
        <b style="color:var(--gold);">${esc(st.goal)}</b>
        <span style="font-size:10px;color:var(--tk80);text-transform:uppercase;letter-spacing:.04em;">${tierLabel}</span>
        ${statusChip}
        <button class="btn btn-sm" onclick="setCareerGoal('')" title="Clear the career goal" style="font-size:10px;padding:2px 7px;margin-left:auto;">✕ Clear</button>
      </div>`;
    if (_compassExp()) {
      html += `<div style="border-top:1px solid rgba(125,170,220,.2);padding:8px 12px;">`;
      if (st.owned) {
        html += `<div style="color:#6dba88;">The path is walked — <b>${esc(st.goal)}</b> is on your class list. Set a new goal whenever the next horizon calls.</div>`;
      } else {
        for (const g of st.groups) {
          if (g.met) {
            html += `<div style="padding:2px 0;color:#6dba88;">✓ <span style="opacity:.75;">${esc(g.options.map(o => o.desc).join(' or '))}</span></div>`;
            continue;
          }
          const allGM = g.options.every(o => o.kind !== 'build');
          const icon = allGM ? '<span style="color:var(--vio);">◈</span>' : '<span style="color:var(--g90);">○</span>';
          const parts = g.options.map(o => esc(o.desc) + (o.prog ? ` <span style="opacity:var(--o65);color:var(--dim);">(${esc(o.prog)})</span>` : ''));
          // advice: from the soonest buildable option, else the first option's
          const best = g.options.filter(o => o.kind === 'build' && o.earliest !== null).sort((a, b) => a.earliest - b.earliest)[0] || g.options[0];
          html += `<div style="padding:2px 0;">${icon} ${parts.join(' <span style="opacity:var(--o50);color:var(--dim);">or</span> ')}
            ${best && best.advice ? `<div style="font-size:10.5px;color:var(--g55);margin-left:16px;">↳ ${esc(best.advice)}</div>` : ''}</div>`;
        }
        // Advisor line — greedy, one step, reasons shown.
        const adv = careerNextStep(c, st);
        if (adv && adv.top) {
          html += `<div style="margin-top:8px;padding:6px 8px;background:rgba(125,170,220,.08);border-radius:3px;font-size:11.5px;">
            <span style="color:#7daadc;">Suggested next step:</span> <b style="color:var(--gold);">${esc(adv.top.name)}</b>
            <span style="opacity:.75;">— ${esc(adv.top.reasons.join('; '))}</span>
            ${adv.runnerUp ? `<div style="font-size:10.5px;opacity:.6;margin-top:2px;">Runner-up: ${esc(adv.runnerUp.name)} — ${esc(adv.runnerUp.reasons.join('; '))}</div>` : ''}
            <div style="font-size:10px;opacity:.45;margin-top:2px;">Most direct progression suggestion — it optimizes your next level for the most direct route, not necessarily the most optimized one. Rarely is there only one way to build a character.</div>
          </div>`;
        } else if (!st.met) {
          html += `<div style="margin-top:8px;font-size:11px;opacity:.6;">No class choice materially speeds this up — the remaining gates are attribute-, feat-slot-, or story-timed.</div>`;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;
    slot.innerHTML = html;
  } catch (e) {
    // The Compass is decorative navigation — never let it break the Sheet.
    slot.innerHTML = '';
  }
}

function outstandingSelections(c) {
  const out = {};
  try {
    const rem = computeSkillPointBudget(c) - skillPointsSpentOf(c);
    if (rem > 0) out.skills = [`${rem} skill point${rem === 1 ? '' : 's'} unspent`];
  } catch (e) {}
  try {
    const tb = getTalentBudget(c);
    if ((tb.remaining || 0) > 0) out.talents = [`${tb.remaining} talent slot${tb.remaining === 1 ? '' : 's'} open`];
  } catch (e) {}
  try {
    const fb = getFeatBudget(c); const notes = [];
    if ((fb.remaining || 0) > 0) {
      // v8.51.0 (Xander build finding #3): name the budget's composition so
      // an open slot is never anonymous — the player sees WHICH grants exist
      // (and the class-list restrictions those labels imply).
      let comp = '';
      try { comp = ' — budget: ' + fb.sources.map(s => s.count > 1 ? `${s.label} ×${s.count}` : s.label).join(', '); } catch (e) {}
      notes.push(`${fb.remaining} feat slot${fb.remaining === 1 ? '' : 's'} open${comp}`);
    }
    if (!isLegacyCharacter(c) && c.heroesGiftChoice === null
        && migrateLegacyClasses(c).some(e => e.tier === 'hero')) notes.push(`Hero's Gift unclaimed — a FREE bonus pick (feat or talent) is owed; claim it with one click at the top of the Feats tab`);
    for (const f of (c.feats || [])) {
      const d = getFeatData(f.name || f.n);
      if (d && d.param && !f.param && !f.grantedBy) notes.push(`${d.n}: ${(d.param.param_label || 'parameter').toLowerCase()} not chosen`);
    }
    // v8.52.0 (Xander build finding #4): aggregate feat-list compliance — a
    // feat added outside the slot-targeted browser can strand a restricted
    // class-bonus slot. Name the stuck feats and the lists still owed.
    try {
      const flc = featListComplianceOf(c);
      if (flc && flc.unplaced.length) {
        notes.push(`⚖ Feat-list check: ${flc.unplaced.map(n => `"${n}"`).join(', ')} ${flc.unplaced.length === 1 ? 'fits' : 'fit'} no remaining open slot — the unfilled slot${flc.openLabels.length === 1 ? ' is' : 's are'} restricted (${flc.openLabels.join('; ') || 'see Feats tab'}). Swap a pick, refill via the slot's own ➕ browser, or record a GM exception.`);
      }
    } catch (e) {}
    if (notes.length) out.feats = notes;
  } catch (e) {}
  try {
    const pb = getPowersBudget(c);
    const spellNotes = [], powerNotes = [];
    for (const [pool, b] of Object.entries(pb || {})) {
      if (b.total !== null && b.total !== undefined && (b.picked || 0) < b.total) {
        const n = b.total - (b.picked || 0);
        // v8.41.0 (Adam's Heinrix report): itemize WHICH levels are owed.
        // Matrix pools (Sorcerer/Bard) list per-level shortfalls ("0th ×1,
        // 2nd ×2"); flat psionic pools state the any-mix rule so the count
        // reads as a choice, not a hidden quota.
        const ord = (v) => v === 0 ? '0th' : v === 1 ? '1st' : v === 2 ? '2nd' : v === 3 ? '3rd' : v + 'th';
        let detail = '';
        try {
          const kbl = b.knownByLvl || [];
          if (kbl.some(x => x > 0)) {
            const pbl = knownPickedByLevel(c, pool);
            const owed = kbl.map((cap, i) => cap > 0 && (pbl[i] || 0) < cap ? `${ord(i)} ×${cap - (pbl[i] || 0)}` : null).filter(Boolean);
            if (owed.length) detail = ` — ${owed.join(', ')}`;
          } else {
            detail = ` (any mix up to ${ord(b.maxPowerLvl)})`;
          }
        } catch (e) {}
        (pool === 'psionic' ? powerNotes : spellNotes)
          .push(`${n} ${pool} ${pool === 'psionic' ? 'power' : 'spell'}${n === 1 ? '' : 's'} known unpicked${detail}`);
      }
    }
    if (spellNotes.length) out.spells = spellNotes;
    if (powerNotes.length) out.powers = powerNotes;
  } catch (e) {}
  // v8.36.0 (the Quickdraw audit's one finding): class SUB-OPTION choices are
  // prompted only in the create/edit form — a Psion or Saint taken via Level
  // Up ends up silently unconfigured (advisory/fallback behavior, never an
  // auto-pick, but nothing told the player a decision was owed). Mandatory
  // picks flag on the Sheet tab (where ✎ Edit lives); the Ranger's combat
  // style points at its own Gear picker. Wizard school specialization is
  // deliberately NOT flagged — a generalist Wizard is a legitimate choice.
  try {
    const notes = [];
    const lvlOfCls = (n) => { const e = migrateLegacyClasses(c).find(x => x.name === n); return e ? (e.level || 0) : 0; };
    if (lvlOfCls('Psion') > 0 && !c.psionDiscipline) notes.push('Psion discipline unchosen (mandatory at 1st) — ✎ Edit to pick');
    if (lvlOfCls('Cleric') > 0 && !c.druidOption && !(c.clericDomains || []).length) notes.push('Cleric domains unchosen (two) — ✎ Edit to pick');
    if (lvlOfCls('Saint') > 0 && !(c.saintDomains || []).length) notes.push("Saint deity domains unchosen (they ARE the spell list) — ✎ Edit to pick");
    if (lvlOfCls('Paladin') >= 4 && !(c.paladinDomains || []).length) notes.push("Paladin deity domains unchosen (casting starts at 4th) — ✎ Edit to pick");
    if (notes.length) out.sheet = (out.sheet || []).concat(notes);
    if (lvlOfCls('Ranger') >= 2 && !c.rangerCombatStyle) {
      out.gear = (out.gear || []).concat(['Ranger combat style unchosen (2nd level) — 🏹 picker on this page']);
    }
  } catch (e) {}
  // v8.40.0 (Quickdraw): a skeleton character ships without an occupation —
  // flag it as an owed pick, but ONLY on Quickdraw-born records (legacy
  // characters without occupations must not sprout retroactive dots).
  // v8.51.0 (Xander build finding #1): EMPTY OCCUPATION PICKS previously
  // passed save and ledger silently — the two permanent class skills then
  // quietly cost cross-class on the skills page (the two ledgers appear to
  // disagree until the picks exist). Enrolled here exactly like Hero's Gift.
  try {
    const occList = c.occupations || (c.occ ? [c.occ] : []);
    const slotNames = ['primary', 'secondary'];
    occList.forEach((occName, i) => {
      if (!occName || i > 1) return;
      const od = getOccupationData(occName);
      if (!od) return;
      const picks = (c.occupationPicks && c.occupationPicks[slotNames[i]]) || {skills: [], bonusFeat: null};
      const want = od.skill_count || 0;
      const have = (picks.skills || []).filter(Boolean).length;
      const bits = [];
      if (have < want) bits.push(`${want - have} class-skill pick${want - have === 1 ? '' : 's'}`);
      const l1occ = (c.firstLevelSlots || []).find(s => s.kind === 'occupation' && (!s.occupation || s.occupation === occName));
      if (od.bonus_feat_options && od.bonus_feat_options.length && !picks.bonusFeat && !(l1occ && l1occ.filled)) bits.push('bonus feat');
      if (bits.length) (out.sheet = out.sheet || []).push(`${occName} occupation picks unchosen (${bits.join(' + ')}) — ✎ Edit; unpicked skills cost cross-class`);
    });
  } catch (e) {}
  try {
    if (c._quickdraw && !(c.occupations || []).length && !c.occ) {
      out.sheet = (out.sheet || []).concat(['Occupation unchosen (Quickdraw skeleton) — ✎ Edit to pick']);
    }
  } catch (e) {}
  // v8.39.0 (Career Compass): deliberately INVERTED dot semantics — no dot
  // while the journey is in progress (a goal is not a pick owed), but when
  // every prerequisite goes green and the class isn't taken yet, that IS an
  // outstanding selection: the door is open.
  try {
    if (c.careerGoal) {
      const st = careerCompassState(c);
      if (st && !st.invalid && !st.owned && st.met) {
        out.sheet = (out.sheet || []).concat([`Career goal unlocked: ${st.goal} — take your first level!`]);
      }
    }
  } catch (e) {}
  return out;
}
function renderNavTabs(c) {
  // v8.32.0: attention dots — computed once per render, guarded.
  let attn = {};
  try { if (c) attn = outstandingSelections(c); } catch (e) {}
  for (const tabId in NAV_TAB_VISIBILITY) {
    const isVisible = !!(c && NAV_TAB_VISIBILITY[tabId](c));
    // Tab button (in the navbar)
    const btn = document.querySelector(`button[onclick="showPage('${tabId}')"]`);
    if (btn) btn.style.display = isVisible ? '' : 'none';
    // v8.6.0: context-specific labels (Adam) — the tabs name the character's
    // actual sides: "✨ Arcane / Divine Spells", "◈ Psionic / Super Powers".
    if (btn && isVisible && (tabId === 'spells' || tabId === 'powers')) {
      btn.textContent = (tabId === 'spells' ? '✨ ' : '◈ ') + _pwSideLabel(c, tabId);
    }
  }
  // v8.32.0: the amber dot + itemized tooltip — over ALL character-scoped
  // tabs, not just the gated ones (NAV_TAB_VISIBILITY only lists tabs that
  // can hide; Skills/Feats/Gear/etc. are always-visible and never enter the
  // loop above — the first battery run caught exactly that).
  for (const tabId of ['sheet','skills','talents','feats','mutations','powers','spells','gear','tracker']) {
    const btn = document.querySelector(`button[onclick="showPage('${tabId}')"]`);
    if (!btn) continue;
    const gated = NAV_TAB_VISIBILITY[tabId];
    const isVisible = !!(c && (!gated || gated(c)));
    const notes = isVisible ? attn[tabId] : null;
    btn.classList.toggle('nav-attn', !!(notes && notes.length));
    btn.title = (notes && notes.length) ? ('Outstanding: ' + notes.join(' · ')) : '';
  }
  // If the active page is now hidden, redirect to Sheet. Defensively guard
  // against stub DOMs (test environments) where activePage.id may not be a
  // proper string.
  try {
    const activePage = document.querySelector('.page.active');
    if (activePage && typeof activePage.id === 'string') {
      const pageName = activePage.id.replace(/^page-/, '');
      // v8.56.0 (playtest issue #5): the Spells and Powers TABS share the one
      // page-powers DOM. The old check gated the shared page by the PSIONIC
      // entitlement alone — so a divine-only caster (the first Divine
      // Heritage build through the tool) was kicked to Sheet on EVERY save,
      // including each spell added from the catalogue. The shared page is
      // legitimate if EITHER side's entitlement holds.
      const gates = (pageName === 'powers' || pageName === 'spells')
        ? [NAV_TAB_VISIBILITY.powers, NAV_TAB_VISIBILITY.spells]
        : [NAV_TAB_VISIBILITY[pageName]];
      if (gates[0] && c && !gates.some(g => g && g(c))) {
        showPage('sheet');
      }
    }
  } catch (e) { /* swallow — defensive */ }
}

// Talent prereq checker — v8.5.0 Layer 1: fully structured prereqs.
// All formerly note-typed TALENTS_DB prereqs (55 entries) are now structured;
// the regex-based note parser (matchTreeCategoricalPrereqs and the token-
// matching pipeline, v8.3.22–v8.4.1) has been removed. A `note` handler
// remains as a defensive fallback for future unstructured data — it renders
// as a non-blocking GM-verify advisory, per the v8.4.1 propagation fix.
//
// Structured prereq types. Same group shape as checkFeatPrereqs: prereqs is
// an array of groups (ANDed); each group is an array of options (ORed).
//   {type:'feat',  name}                        — owns the feat
//   {type:'talent', name}                       — owns the talent
//   {type:'talentAny', names:[...], count?}     — owns ≥count of the named
//                                                 talents (default 1)
//   {type:'talentTree', tree, count?}           — owns ≥count talents from
//                                                 the tree (default 1)
//   {type:'talentTreeAny', trees:[...], count?} — owns ≥count talents from
//                                                 any of the trees, combined
//   {type:'mp', amount}                         — MP pool ≥ amount (live in
//                                                 Layer 3; defers to the tier
//                                                 gate until then)
//   {type:'langCount', min}                     — ≥min entries in Languages
//                                                 Known (Linguist only)
//   {type:'note', text}                         — GM-verify advisory fallback
//
// Tree-membership checks exclude the candidate talent itself — see
// ownedInTrees below.
//
// Returns {met:bool, missing:[string]} — same shape as checkFeatPrereqs.
function checkTalentPrereqs(talentName, c) {
  const t = TALENTS_DB.find(x => x.n === talentName);
  if (!t) return {met:false, missing:['Talent not found']};
  const missing = [];

  // Hero class membership.
  const classArr = migrateLegacyClasses(c || {});
  const heroClassNames = new Set(classArr.filter(e => e.tier==='hero' && (e.level||0)>0).map(e => e.name));
  const ownedFeats = new Set(((c && c.feats) || []).map(f => f.name || f.n));
  const hasMultiTalented = ownedFeats.has('Multi-Talented');

  // Class match: either the character has the talent's Hero class, OR they
  // have Multi-Talented and haven't yet spent the bonus on another class.
  // (For v8.3.21, presence of Multi-Talented unlocks any one cross-class
  // talent; we don't track which class the bonus is "spent on" — that's a
  // v8.3.22+ refinement.)
  // v9.9.3 (§262): the v8.11.1 flex classes open cross-class talents too.
  // Anti-Hero (Talent @1, convertible slots 3/5/7/9) and Super-Hero /
  // Super-Villain (Bonus Feat or Talent @2/@4) may take "a Talent from any
  // Hero class for which they qualify (i.e., a score of 13+ in that Hero
  // class's associated attribute)", treated as 1st level in unowned classes
  // (GMG p.152 / p.183). The budget side (getTalentBudget's flexUsed) was
  // wired in v8.11.1 but this gate never learned about it, so the talent
  // half of "Bonus Feat or Talent" was unreachable cross-class. Like
  // Multi-Talented, spend is not tracked here — the four-state budget
  // display owns the accounting.
  if (t.hero_class && !heroClassNames.has(t.hero_class)) {
    const _flexLvl = (n) => classArr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
    const hasFlexClass = _flexLvl('Anti-Hero') >= 1 || _flexLvl('Super-Hero') >= 2 || _flexLvl('Super-Villain') >= 2;
    let flexAttrOk = false, flexAttrKey = null;
    if (hasFlexClass && typeof HERO_CLASSES === 'object' && HERO_CLASSES[t.hero_class]) {
      flexAttrKey = HERO_CLASSES[t.hero_class].attr || null;
      const _ai = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5}[flexAttrKey];
      if (_ai !== undefined && c) {
        const _scores = effAttrs(c);
        flexAttrOk = ((_scores && _scores[_ai]) || 10) >= 13;
      }
    }
    if (!hasMultiTalented && !flexAttrOk) {
      missing.push(hasFlexClass && flexAttrKey
        ? `Requires a level in ${t.hero_class} — or ${flexAttrKey} 13+ to take it cross-class via your Bonus Feat or Talent flex (treated as 1st level)`
        : `Requires a level in ${t.hero_class}`);
    }
  }

  // Tier gating: Super-Talents and Apex Super-Talents cost MP (mp_cost).
  // v8.5.3 Mutations pass — LAYER 3 IS LIVE: the blanket "system pending"
  // gate (v8.3.22–v8.5.2) is replaced by a real check against the computed
  // MP ledger (getMPState — earned from Drawbacks/feat grants/GM grants,
  // spent on Advantages/super-powers/owned Super-Talents). Acquiring the
  // talent IS the spend: ownership is summed by the ledger, so this check
  // asks whether the BANKED balance covers this talent's cost. Also requires
  // the Supernatural Mutation feat (super-talents are supernatural abilities).
  if (t.tier === 'Super-Talent' || t.tier === 'Apex Super-Talent') {
    const mpState = getMPState(c);
    if (!mpState || !mpState.isSuperMutant) {
      missing.push(`Requires the Supernatural Mutation feat (super-talents are supernatural abilities)`);
    } else if ((t.mp_cost || 0) > mpState.balance) {
      missing.push(`Requires ${t.mp_cost} MP (banked: ${mpState.balance})`);
    }
  }

  // Walk prereq groups. Each group is an OR; the group passes if at least one
  // option passes. If any group fails entirely, the prereq is unmet.
  // v8.5.0 Layer 1: all TALENTS_DB prereqs are structured; the regex note
  // parser (matchTreeCategoricalPrereqs, v8.3.22–v8.4.1) is gone. A `note`
  // handler remains as a defensive fallback for future unstructured data.
  const ownedTalents = new Set((c && c.talents || []).map(x => x.name));
  // Tree-membership counter. EXCLUDES the candidate talent itself: a talent
  // never satisfies its own tree prereq. This matters for the retcon
  // compliance scan, where the talent being validated is already owned.
  // (Set semantics also mean a multiple-takeable talent like Savant counts
  // once — "another talent from the tree" means a DISTINCT talent.)
  const ownedInTrees = (trees) => {
    let n = 0;
    for (const name of ownedTalents) {
      if (name === t.n) continue;
      const ot = TALENTS_DB.find(x => x.n === name);
      if (ot && ot.tree && trees.includes(ot.tree)) n++;
    }
    return n;
  };
  if (Array.isArray(t.prereqs)) {
    for (const group of t.prereqs) {
      if (!Array.isArray(group) || group.length === 0) continue;
      let groupPassed = false;
      const groupMissingReasons = [];
      for (const opt of group) {
        if (opt.type === 'feat') {
          if (ownedFeats.has(opt.name)) { groupPassed = true; break; }
          groupMissingReasons.push(`feat ${opt.name}`);
        } else if (opt.type === 'talent') {
          // v8.5.0: owns the named talent.
          if (ownedTalents.has(opt.name)) { groupPassed = true; break; }
          groupMissingReasons.push(opt.name);
        } else if (opt.type === 'talentAny') {
          // v8.5.0: owns at least `count` (default 1) of the named talents.
          // Covers the Apex "two of either A, B, or C" prereqs.
          const need = opt.count || 1;
          const have = (opt.names || []).filter(n => ownedTalents.has(n)).length;
          if (have >= need) { groupPassed = true; break; }
          groupMissingReasons.push(`${need} of: ${(opt.names || []).join(', ')} (have ${have})`);
        } else if (opt.type === 'talentTree' || opt.type === 'talentTreeAny') {
          // v8.5.0: owns at least `count` (default 1) talents from the named
          // tree (`tree:`) or from any of the named trees combined (`trees:`).
          const trees = opt.type === 'talentTree' ? [opt.tree] : (opt.trees || []);
          const need = opt.count || 1;
          if (ownedInTrees(trees) >= need) { groupPassed = true; break; }
          groupMissingReasons.push(`${need === 1 ? 'a talent' : need + ' talents'} from the ${trees.join(' or the ')}`);
        } else if (opt.type === 'mp') {
          // v8.5.3 Mutations pass — Layer 3 live: check the computed MP
          // ledger's banked balance (was: dormant c.mp scalar that nothing
          // ever set, passing silently pre-Layer 3).
          const mpSt = getMPState(c);
          if (mpSt && mpSt.balance >= (opt.amount || 0)) { groupPassed = true; break; }
          groupMissingReasons.push(`${opt.amount || 0} MP (banked: ${mpSt ? mpSt.balance : 0})`);
        } else if (opt.type === 'langCount') {
          // v8.5.0: Linguist only. Counts entries in the free-text Languages
          // Known field (c.langs). Approximates the rulebook's "Read/Write/
          // Speak Language for each of three different languages" — the
          // generator stores languages as free text, not per-language skill
          // buys, so racial freebies also count (per Adam, 2026-06-12).
          const langs = ((c && c.langs) || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          if (langs.length >= (opt.min || 1)) { groupPassed = true; break; }
          groupMissingReasons.push(`${opt.min} languages in Languages Known (have ${langs.length})`);
        } else if (opt.type === 'note') {
          // Defensive fallback for future unstructured data. Advisory only:
          // propagate to outer missing[] so the UI renders "⚠ GM-verify"
          // (v8.4.1 advisory-propagation fix), and don't block.
          missing.push(`(GM-verify) ${opt.text || ''}`);
          groupPassed = true;
          break;
        } else {
          // Unknown prereq type — advisory, same handling as notes.
          missing.push(`(GM-verify) ${JSON.stringify(opt)}`);
          groupPassed = true;
          break;
        }
      }
      if (!groupPassed) {
        missing.push(groupMissingReasons.join(' or '));
      }
    }
  }
  return {met: missing.length === 0, missing};
}

// Add a talent to the character. Auto-records grantedAt with the most
// natural source: prefers the Hero class the talent belongs to, falls back
// to 'Multi-Talented' if that's the only path, then 'unattributed'.
function addTalentToChar(c, talentName, param) {
  if (!c) return false;
  const t = TALENTS_DB.find(x => x.n === talentName);
  if (!t) {toast('Talent not found.'); return false;}
  if (!c.talents) c.talents = [];
  // Most talents are not re-takeable. Savant is the explicit exception (one
  // per skill). For v8.3.21 we honor a `takeable:'multiple'` flag if present
  // (parallels the Feats convention).
  // v8.5.0 Layer 2: param-aware duplicate rule — a multiple-takeable
  // parameterized talent (Savant) blocks only on the same name+param pair
  // ("each time it applies to a different skill").
  if (t.takeable === 'multiple') {
    if (param && c.talents.some(x => x.name === talentName && x.param === param)) {
      toast(`${talentName} (${param}) already owned.`);
      return false;
    }
  } else if (c.talents.some(x => x.name === talentName)) {
    toast(`${talentName} already owned.`);
    return false;
  }
  // Determine source.
  const classArr = migrateLegacyClasses(c);
  const heroClassNames = new Set(classArr.filter(e => e.tier==='hero' && (e.level||0)>0).map(e => e.name));
  let source = 'unattributed';
  if (t.hero_class && heroClassNames.has(t.hero_class)) {
    source = t.hero_class;
  } else {
    const ownedFeats = new Set((c.feats || []).map(f => f.name || f.n));
    if (ownedFeats.has('Multi-Talented')) source = 'Multi-Talented';
  }
  const rec = {
    name: talentName,
    grantedAt: {
      source,
      level: c.totalLvl || 1,
      atDate: new Date().toLocaleDateString(),
    },
  };
  if (param) rec.param = param; // v8.5.0: chosen skill for Skill Emphasis/Savant
  c.talents.push(rec);
  reconcileTalentHp(c);  // v8.8.0: Robust bakes its retroactive HP
  reconcileTalentAttrBakes(c);  // v8.8.0: Titanic Strength bakes its +10 (Su)
  return true;
}

// v8.5.0: param narrows the match for multiple-takeable parameterized talents
// (removing "Savant (Research)" leaves "Savant (Repair)" alone). Without a
// param argument, the first instance by name is removed (legacy behavior).
function removeTalentFromChar(c, talentName, param) {
  if (!c || !c.talents) return false;
  const idx = c.talents.findIndex(x => x.name === talentName && (param === undefined || x.param === param));
  if (idx < 0) return false;
  const rec = c.talents[idx];
  // v8.8.0: reverse an attr bake on removal (GM-reversible per Adam).
  if (rec.attrApplied && ATTR_KEY_IDX[rec.attrKey] !== undefined && Array.isArray(c.attrs)) c.attrs[ATTR_KEY_IDX[rec.attrKey]] -= rec.attrApplied;
  c.talents.splice(idx, 1);
  // v8.87.0: removing Energy Immunity cascades its free grant away too —
  // the granted Resistance talent exists only by the Super-Talent's grace.
  if (talentName === 'Energy Immunity') {
    const granted = c.talents.filter(t => t.grantedBy === 'Energy Immunity');
    for (const g of granted) c.talents.splice(c.talents.indexOf(g), 1);
    if (granted.length) toast(`Also removed ${granted.map(g => g.name).join(', ')} — granted by Energy Immunity.`);
  }
  reconcileTalentHp(c);  // v8.8.0: Robust's baked HP leaves with the talent
  return true;
}

// Resolve a class entry {tier, name} to its data table row (HD, sp, progression arrays, etc.)
function getClassEntry(e) {
  if (!e || !e.name) return null;
  if (e.tier === 'hero') return HERO_CLASSES[e.name];
  if (e.tier === 'ordinary') return ORDINARY_CLASSES[e.name];
  if (e.tier === 'basic') return BASIC_CLASSES[e.name];
  if (e.tier === 'advanced') return ADVANCED_CLASSES[e.name];
  if (e.tier === 'prestige') return PRESTIGE_CLASSES[e.name];
  if (e.tier === 'monstrous') return MONSTROUS_CLASSES[e.name]; // v9.15.0 §273
  // Best-effort fallback when tier is missing — try each table
  return getClassData(e.name);
}
