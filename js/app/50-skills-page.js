// =============================================================================
// js/app/50-skills-page.js
// SKILLS PAGE
// =============================================================================
//
// WHAT'S IN HERE
//   The Skills page: class skills, skill families, ranks, synergy tooltips and
//   spending skill points.
//
// KEY NAMES (so you can search for them)
//   tables/objects: SKILL_NAME_ALIASES, SKILL_SUB_ALIASES,
//   COLLAPSIBLE_FAMILIES
//   functions (23): isClassSkill, canonSkillPick, getClassSkillSources,
//   setSkillFilter, toggleSkillFamily, expandAllSkillFamilies,
//   collapseAllSkillFamilies, getLiveSkillRanks, formatSynergyMiscTooltip,
//   computeSkillSynergies, _snapshotSkillInputsToChar, renderSkills, adjustPP,
//   restPP, snapshotPowerTextareas, computeSkillPointBudget,
//   recomputeSkillBudget, parseSkillReq, meetsSkillReq,
//   checkScenarioGateOnRankChange, updSkTot, commitSkillRank, saveSkills
//
// LOAD ORDER
//   File 50 of 68. index.html loads it after js/app/49-sheet.js and before
//   js/app/51-gm-exceptions-and-talents-page.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 42747-43733 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 42747-43733; unchanged below this line ----
// ========== SKILLS ==========
// isClassSkill — determines whether a skill is a class skill for a character.
//
// Two call signatures:
//   (skillName, char)                      — preferred, uses full character record
//   (skillName, heroClassOrName, occupation) — legacy, uses just the named class
//
// Logic (v8.1.5): consult CLASS_SKILLS for every class entry on the character,
// PLUS HC_SKILLS for the named Hero class (legacy call style). If the matching
// class entry has a sentinel string ('__inherit_all_class_skills__' for
// Super-Hero/Villain, '__expert_choose_any__' for Expert, etc.), apply the
// special rule. Otherwise check the skill against the class's class-skill list
// with family-prefix matching (so a class with "Knowledge (Any)" matches any
// Knowledge sub-skill). Occupation-specific Profession skills auto-class-skill
// based on the character's Starting Occupation(s).
function isClassSkill(skillName, arg2, occupation){
  // v8.2.4 (Issue C-2): isClassSkill now delegates to getClassSkillSources()
  // and returns whether the source list is non-empty. The sources list itself
  // is used by the renderer for a "why is this a class skill?" provenance
  // tooltip, helpful for diagnosing surprises like "why is Knowledge (Tactics)
  // a class skill on my Berserker?" (answer: Gladiator's compound skill pick).
  const sources = getClassSkillSources(skillName, arg2, occupation);
  return sources.length > 0;
}

// v8.91.0 (Adam's Adventurer playtest — "Demolitions not recognizing as a
// class skill"): the occupation skill_list spellings drift from the skill
// catalog in THIRTY-TWO places ("Demolition", "Earth and Life Sciences",
// "Behavioural", "Electronic", "Nobility", "Keyboards", two Language
// spellings…) — every one of them a silently dead class-skill pick. All
// occupation picks now match through this canonicalizer. "Alchemy" maps to
// Chemical: the HH Craft skill's own category list carries no alchemy — an
// SRD vestige like "Heal" (book letter on TODO).
const SKILL_NAME_ALIASES = {
  'demolition': 'Demolitions',
  'knowledge: any': 'Knowledge (Any)',
  'read/write language': 'Read/Write/Speak Language',
  'speak language': 'Read/Write/Speak Language',
};
const SKILL_SUB_ALIASES = {
  'earth and life sciences': 'Earth & Life Sciences',
  'earth / life sciences': 'Earth & Life Sciences',
  'behavioural sciences': 'Behavioral Sciences',
  'behavioural science': 'Behavioral Sciences',
  'electronic': 'Electronics',
  'visual art': 'Visual Arts',
  'nobility': 'Nobility & Royalty',
  'current affairs': 'Current Events',
  'architecture': 'Architecture & Engineering',
  'theology and philosophy': 'Theology & Philosophy',
  'keyboards': 'Keyboard Instruments',
  'percussion': 'Percussion Instruments',
  'stringed': 'String Instruments',
  'wind': 'Wind Instruments',
  'stand-up': 'Comedy',
  'alchemy': 'Chemical',
};
function canonSkillPick(pick) {
  const whole = SKILL_NAME_ALIASES[String(pick).trim().toLowerCase()];
  if (whole) return whole;
  const m = String(pick).match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
  if (!m) return String(pick).trim();
  const subs = m[2].split(',').map(s => { const x = s.trim(); return SKILL_SUB_ALIASES[x.toLowerCase()] || x; });
  return m[1].trim() + ' (' + [...new Set(subs)].join(', ') + ')';
}

// Return an array of human-readable strings explaining WHY a skill is a
// class skill for the given character. Empty array means the skill is
// cross-class. Multiple entries are possible (e.g. when two classes both
// grant the same skill).
function getClassSkillSources(skillName, arg2, occupation){
  let classArr, heroClassName, occs, occupationPicks;
  if (arg2 && typeof arg2 === 'object' && (arg2.classes || arg2.heroClass !== undefined)) {
    const c = arg2;
    classArr = (c.classes && c.classes.length) ? c.classes : migrateLegacyClasses(c);
    heroClassName = c.heroClass || '';
    occs = c.occupations || (c.occ ? [c.occ] : []);
    occupationPicks = c.occupationPicks || null;
  } else {
    classArr = [];
    heroClassName = arg2 || '';
    occs = Array.isArray(occupation) ? occupation : (occupation ? [occupation] : []);
    occupationPicks = null;
    if (heroClassName) classArr.push({tier:'hero', name:heroClassName, level:1});
  }
  const sources = [];

  // Helper: check one class's class-skill list, return source string or null
  function classMatch(className, classLevel) {
    // v9.15.2 (§275 F3): monstrous-tier classes (GMF seed imports) — FF p.47:
    // "All listed skills are class skills". The seed carries no skill list,
    // so the lane treats every skill as class; pruning is the GM's finishing
    // touch, like the rest of the statblock's skill section.
    if (MONSTROUS_CLASSES[className]) {
      return `class:${className} (monstrous — FF: a creature's listed skills are class skills)`;
    }
    const skills = CLASS_SKILLS[className];
    if (!skills) {
      // Fall back to HC_SKILLS for Hero classes if CLASS_SKILLS doesn't have them
      const hc = HC_SKILLS[className] || [];
      if (hc.includes(skillName)) return `class:${className}`;
      const fam = skillName.split(' (')[0];
      if (hc.some(s => s.startsWith(fam + '(') || s === fam + ' (Any)')) {
        return `class:${className} (via ${fam} family)`;
      }
      return null;
    }
    if (typeof skills === 'string') {
      if (skills === '__all_skills_class__') return `class:${className} (all-skills sentinel)`;
      if (skills === '__expert_choose_any__') return `class:${className} (Expert chooses any 10 — currently over-permissive, will refine)`;
      if (skills === '__inherit_arcane_divine__') {
        // Mystic Theurge: skills are union of underlying arcane+divine class skills
        for (const e2 of classArr) {
          if (e2.name === className) continue;
          const meta = CASTER_CLASSES[e2.name];
          if (meta && (meta.pool === 'arcane' || meta.pool === 'divine')) {
            const inner = classMatch(e2.name, e2.level);
            if (inner) return `class:${className} (inherited from ${e2.name})`;
          }
        }
        return null;
      }
      if (skills === '__inherit_divine_psionic__') {
        for (const e2 of classArr) {
          if (e2.name === className) continue;
          const meta = CASTER_CLASSES[e2.name];
          if (meta && (meta.pool === 'divine' || meta.pool === 'psionic')) {
            const inner = classMatch(e2.name, e2.level);
            if (inner) return `class:${className} (inherited from ${e2.name})`;
          }
        }
        return null;
      }
      return null;
    }
    // Array of skills: direct hit or family-Any match
    if (skills.includes(skillName)) return `class:${className}`;
    const fam = skillName.split(' (')[0];
    if (skills.some(s => s === fam + ' (Any)' || s === fam)) {
      return `class:${className} (via ${fam} (Any))`;
    }
    return null;
  }

  // Check every class on the character
  for (const e of classArr) {
    const src = classMatch(e.name, e.level);
    if (src) sources.push(src);
  }
  // v8.5.4: class sub-options grant class skills (Adam's rulings):
  //   • The Druid Option adds Knowledge (Nature) and Survival to the
  //     Cleric's class skills (HH, "The Druid Option": Skills).
  //   • A Psion's chosen discipline adds its associated class skills (HH
  //     Psion entry, per-discipline lists in PSION_DISCIPLINE_INFO).
  const subC = (arg2 && typeof arg2 === 'object' && (arg2.classes || arg2.heroClass !== undefined)) ? arg2 : null;
  if (subC) {
    if (subC.druidOption && classArr.some(e => e.name === 'Cleric')
        && (skillName === 'Knowledge (Nature)' || skillName === 'Survival')) {
      sources.push('class:Cleric (Druid Option)');
    }
    const disc = subC.psionDiscipline;
    if (disc && PSION_DISCIPLINE_INFO[disc] && classArr.some(e => e.name === 'Psion')
        && PSION_DISCIPLINE_INFO[disc].skills.includes(skillName)) {
      sources.push(`class:Psion (${disc} discipline)`);
    }
  }
  // Also check the legacy heroClassName arg via HC_SKILLS for backward compat
  if (heroClassName && !classArr.some(e => e.name === heroClassName)) {
    const hc = HC_SKILLS[heroClassName] || [];
    if (hc.includes(skillName)) sources.push(`hero-class:${heroClassName}`);
    else {
      const fam = skillName.split(' (')[0];
      if (hc.some(s => s.startsWith(fam + '(') || s === fam + ' (Any)')) {
        sources.push(`hero-class:${heroClassName} (via ${fam} family)`);
      }
    }
  }
  // Occupation-specific Profession
  for (const occ of occs) {
    if (occ && skillName === `Profession (${occ})`) {
      sources.push(`occupation:${occ} (Profession)`);
    }
  }
  // v8.2.1: Starting Occupation skill picks. Each occupation lets the player
  // designate N skills from the occupation's list as class skills. Compound
  // entries like "Knowledge (Streetwise, Tactics)" cover any of the listed
  // sub-skills.
  if (occupationPicks) {
    for (const slot of ['primary', 'secondary']) {
      const picks = occupationPicks[slot];
      if (!picks || !picks.skills) continue;
      const occName = occs[slot === 'primary' ? 0 : 1] || '?';
      for (const pick of picks.skills) {
        if (!pick) continue;
        // v8.91.0: match through the canonicalizer — the stored pick keeps
        // the book's spelling, the comparison speaks catalog.
        const pickC = canonSkillPick(pick);
        if (pickC === skillName) {
          sources.push(`occupation-pick:${occName} (${pick})`);
          continue;
        }
        // Compound match: "Knowledge (Streetwise, Tactics)" covers
        // "Knowledge (Streetwise)", "Knowledge (Tactics)", etc.
        const m = pickC.match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
        if (m) {
          const family = m[1].trim();
          const subs = m[2].split(',').map(s => s.trim());
          const skillM = skillName.match(/^([\w\/\- ]+)\s*\(([^)]+)\)\s*$/);
          if (skillM && skillM[1].trim().toLowerCase() === family.toLowerCase()) {
            const skillSub = skillM[2].trim().toLowerCase();
            // "(Any)" compounds (Academic's Knowledge: Any) cover the family.
            if (subs.some(s => s.toLowerCase() === skillSub || s.toLowerCase() === 'any')) {
              sources.push(`occupation-pick:${occName} (compound ${family})`);
            }
          }
        }
      }
    }
  }
  // v8.99.0 (the cybernetics wire-through): Data Archive (HH p.337) — "The
  // recipient treats ALL skills as class skills."
  if (arg2 && typeof arg2 === 'object' && getCyber(arg2).some(r => r.n === 'Data Archive')) {
    sources.push('cybernetic:Data Archive (all skills are class skills)');
  }
  return sources;
}
// ========== SKILLS (v8.1.3) ==========
// Filter state and collapsible-family state are session-scoped (not persisted).
// skillFilter:  'all' (default) | 'class' | 'trained'
// skillFamilyCollapsed: map from family name to bool (true = collapsed).
// Default: all four collapsible families start collapsed unless the character
// has any ranks in a skill within that family, in which case it auto-expands.
let skillFilter = 'all';
let skillFamilyCollapsed = {Craft:true, Knowledge:true, Perform:true, Profession:true};
const COLLAPSIBLE_FAMILIES = ['Craft','Knowledge','Perform','Profession'];
// Tracks which families the user has explicitly toggled. Used so auto-expand
// only fires on first render and doesn't override the user's choice afterward.
const skillFamilyToggled = {};

function setSkillFilter(f){
  // v8.3.6: snapshot in-flight rank changes from the DOM to c.skills (in-memory
  // only, no localStorage write) so the about-to-fire re-render preserves
  // them. Without this, toggling the filter or expanding/collapsing a family
  // would wipe any unsaved rank changes the player had typed.
  _snapshotSkillInputsToChar();
  skillFilter = f;
  renderSkills();
}
function toggleSkillFamily(fam){
  _snapshotSkillInputsToChar();
  skillFamilyToggled[fam] = true;
  skillFamilyCollapsed[fam] = !skillFamilyCollapsed[fam];
  renderSkills();
}
function expandAllSkillFamilies(){
  _snapshotSkillInputsToChar();
  for (const f of COLLAPSIBLE_FAMILIES) { skillFamilyCollapsed[f] = false; skillFamilyToggled[f] = true; }
  renderSkills();
}
function collapseAllSkillFamilies(){
  _snapshotSkillInputsToChar();
  for (const f of COLLAPSIBLE_FAMILIES) { skillFamilyCollapsed[f] = true; skillFamilyToggled[f] = true; }
  renderSkills();
}

// v8.3.9: Read live skill ranks from the DOM if available (during edits),
// otherwise fall back to c.skills (the persisted state). This is needed for
// synergy calculations during in-flight rank changes — typing a 5 in Bluff
// should immediately apply +2 to Diplomacy, Intimidate, Sleight of Hand
// without waiting for a save.
function getLiveSkillRanks(c, skillName) {
  const id = 'skr-' + skillName.replace(/[^a-z0-9]/gi,'_');
  const el = document.getElementById(id);
  if (el && el.value !== '') return parseInt(el.value, 10) || 0;
  return (c?.skills && c.skills[skillName]) || 0;
}

// v8.3.9: Compute all synergy contributions affecting `targetSkill`. Returns
// {auto:[entry...], conditional:[entry...], gm:[entry...]} where each entry
// includes the source skill, value, and (for non-auto kinds) context.
//
// The `auto` list is what the engine adds to the displayed skill total. The
// `conditional` and `gm` lists are tooltip-surfaced only — the player and GM
// negotiate at the table whether the context applies to a given roll.
//
// "Active" status is determined by live skill rank reads (DOM > c.skills) so
// the displays stay in sync mid-edit. A synergy is active iff the source
// skill has the threshold ranks (5 for HH skills) AND, for non-auto kinds,
// is annotated regardless of activation (the player may not have reached
// 5 ranks yet but should still see the eventual benefit).
// v8.3.11: Format the Misc-column tooltip describing a target skill's
// auto synergies. Handles the target_ranks_min predicate (e.g., Business →
// Profession) by appending an "AND at least 1 rank here" clause so the
// player understands why the bonus fired specifically on this row.
function formatSynergyMiscTooltip(autoEntries) {
  if (!autoEntries.length) return '';
  return 'Synergy bonuses: ' + autoEntries.map(e => {
    let extra = '';
    if (e.target_ranks_min && e.target_ranks_min > 0) {
      extra = ` AND ≥${e.target_ranks_min} rank here`;
    }
    return `+${e.value} from ${e.source} (5+ ranks${extra})`;
  }).join('; ');
}

function computeSkillSynergies(targetSkill, c) {
  if (!c) return {auto:[], conditional:[], gm:[]};
  const out = {auto:[], conditional:[], gm:[]};
  for (const entry of SYNERGIES_DB) {
    if (entry.target !== targetSkill) continue;
    // For "auto" synergies, only include if the source ranks meet the
    // threshold (5+). The target's displayed total reflects only active
    // synergies. For "conditional" and "gm", always include — these surface
    // as tooltip notes regardless of activation, since they're informational.
    if (entry.kind === 'auto') {
      const srcRanks = getLiveSkillRanks(c, entry.source);
      if (srcRanks < 5) continue;
      // v8.3.11: optional target_ranks_min predicate. Used by Knowledge
      // (Business) → Profession (X), which fires only if the character has
      // ≥1 rank in THIS Profession (X). Default (omitted) = 0 = always fires
      // once source threshold met. The predicate is checked against the
      // SPECIFIC target skill (not its family), so a character with 5 ranks
      // in K(Business) and 1 rank in Profession (Doctor) sees +2 only on
      // Profession (Doctor), not on Profession (Academic).
      if (entry.target_ranks_min && entry.target_ranks_min > 0) {
        const tgtRanks = getLiveSkillRanks(c, entry.target);
        if (tgtRanks < entry.target_ranks_min) continue;
      }
      out.auto.push({source: entry.source, value: entry.value, page: entry.page,
        target_ranks_min: entry.target_ranks_min || 0});
    } else if (entry.kind === 'conditional') {
      out.conditional.push({source: entry.source, value: entry.value, context: entry.context, page: entry.page});
    } else if (entry.kind === 'gm') {
      out.gm.push({source: entry.source, value: entry.value, context: entry.context, page: entry.page});
    }
  }
  return out;
}

// v8.3.6: Snapshot the live skill rank input values from the DOM into the
// current character's c.skills object — IN MEMORY ONLY, no localStorage
// write. This is used to preserve in-flight unsaved changes across UI
// re-renders triggered by family toggle, filter change, etc. The real
// persist-to-localStorage step still requires the player to click "Save".
//
// Only updates skill rows that are currently in the DOM (i.e., not filtered
// out and not in a collapsed family); rows not rendered are left alone.
// This is safe because any skill being edited has to be visible to be
// edited in the first place.
function _snapshotSkillInputsToChar() {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!c.skills) c.skills = {};
  for (const sk of SKILLS) {
    const id = 'skr-' + sk.n.replace(/[^a-z0-9]/gi,'_');
    const el = document.getElementById(id);
    if (!el) continue;  // Row not rendered — leave the prior c.skills value alone
    const v = parseInt(el.value, 10) || 0;
    c.skills[sk.n] = v;
  }
}

function renderSkills(){
  const prompt=document.getElementById('sk-prompt'),cont=document.getElementById('sk-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=chars.find(x=>x.id===curId);if(!c){prompt.style.display='block';cont.style.display='none';return;}
  prompt.style.display='none';cont.style.display='block';
  document.getElementById('sk-hero-nm').textContent=c.name+' — Skills';
  // v8.3.15: use the shared budget helper instead of the broken old formula
  // (which was using HERO_CLASSES[c.heroClass] only, fell back to 4 for
  // non-Hero builds, and ignored Human racial bonus entirely).
  const totalSP = computeSkillPointBudget(c);
  // v8.3.15 hotfix: `lvl` is still used later in the row-building loop to
  // compute the max-rank cap (`max="${lvl+4}"`). It was previously declared
  // inline with the broken budget formula; preserve it here standalone.
  // v9.15.2 (§275 F3): unstamped records derive character level from the
  // class array — the skill cap (HH p.146: level + 4) must not collapse to
  // 0+4 just because no save path has stamped c.totalLvl yet.
  const lvl = c.totalLvl || migrateLegacyClasses(c).reduce((s, e) => s + (e.level || 0), 0);
  // v8.2.2 (Issue 4): correct cost-differential calc per HH p.541-544.
  // Class skills: 1 pt/rank. Cross-class: 2 pts/rank. Reads c.skills (the
  // saved record) here for the initial render; recomputeSkillBudget() reads
  // live DOM after that for real-time updates.
  // v8.5.0 Layer 2: per-skill always-on bonuses (feats + occupations +
  // talents), computed once per render and consumed in the row loop below.
  const skillMiscBon = computeSkillMiscBonuses(c);
  let spent = 0;
  for (const skName of Object.keys(c.skills||{})) {
    const ranks = c.skills[skName] || 0;
    if (ranks <= 0) continue;
    const isClass = isClassSkill(skName, c);
    spent += isClass ? ranks : ranks * 2;
  }
  const remaining = totalSP - spent;
  const ptsInfoEl = document.getElementById('sk-pts-info');
  // v8.4.0: four-state color-coded budget display. For skill points, the
  // "picked" count is spent points; the "budget" is totalSP. Overspending
  // is possible via GM-exception edits (e.g. class swap that reduces budget
  // below already-spent ranks).
  const sState = computeResourceState(spent, totalSP, 'skill', c.gmExceptions || []);
  const sDisplay = RESOURCE_STATE_DISPLAY[sState];
  let sSuffix = '';
  if (sState === 'surplus') {
    sSuffix = ` (${remaining} unassigned — latent potential)`;
  } else if (sState === 'exact') {
    sSuffix = ` (fully spent)`;
  } else if (sState === 'warning') {
    sSuffix = ` (${-remaining} over — GM exception)`;
  } else {
    sSuffix = ` (${-remaining} over budget — reconcile or get GM approval)`;
  }
  // v8.70.1 (Adam's condense request): the budget line had grown a run-on
  // of "incl." clauses (cross-class premium + Unnatural Prowess + its
  // restriction). ONE compact line now; the itemized breakdown moves to a
  // hover ⓘ, the house idiom. Nothing is lost — only folded.
  let bkBits = [];
  try { const cc = crossClassPremiumOf(c); if (cc.prem > 0) bkBits.push(`+${cc.prem} cross-class premium (${cc.items.join(', ')})`); } catch (e) {}
  try { const _mlN = (getMPState(c).mutantLevel || 0); if (_mlN > 0) bkBits.push(`+${2 * _mlN} skill points from Unnatural Prowess (Mutant +${_mlN}) — HH p.29: these bonus points may only buy TECH SCALE 0 skills (no Computer Use, Drive, Pilot, Repair and kin); the table enforces the restriction`); } catch (e) {}
  const bkNote = bkBits.length ? ` <span style="cursor:help;opacity:.8;color:var(--g90);" title="${escapeHTML('Budget breakdown — ' + bkBits.join('  ·  '))}">ⓘ</span>` : '';
  ptsInfoEl.innerHTML = `<span title="${sDisplay.label}" style="color:${sDisplay.color};">${sDisplay.icon}</span> Skill Points: ${spent} spent of ~${totalSP} total${sSuffix}${bkNote}`;
  ptsInfoEl.style.color = sDisplay.color;
  ptsInfoEl.setAttribute('data-state', sState);

  // Update filter-button active states
  document.querySelectorAll('.sk-filter-btn').forEach(btn => {
    const active = btn.getAttribute('data-filter') === skillFilter;
    btn.style.background = active ? 'var(--filter-on-bg)' : '';
    btn.style.color = active ? 'var(--gold)' : '';
    btn.style.fontWeight = active ? 'bold' : '';
  });

  const charSkills = c.skills || {};
  // v8.6.0 (Adam's request): sub-skills with invested ranks stay on the main
  // list even while their family is collapsed (see the skip-condition below).
  // The old "auto-expand families that already have ranks" pass is therefore
  // retired — it existed only because collapsing used to hide trained
  // sub-skills. Collapsed-with-ranks now shows exactly the trained ones,
  // which is the cleaner default; expanding reveals the untrained rest.

  // Apply filter and group by family
  // Trained = ≥1 rank. Class = isClassSkill returns truthy for this character.
  const passesFilter = sk => {
    if (skillFilter === 'class') return isClassSkill(sk.n, c);
    if (skillFilter === 'trained') return (charSkills[sk.n] || 0) > 0;
    return true;
  };

  // Build rows. Collapsible families: a single family-header row that toggles, plus
  // child rows shown only when the family is expanded.
  const rows = [];
  let prevFam = '';
  // First, group entries by family while preserving SKILLS array order
  for (const sk of SKILLS) {
    const fam = sk.family;
    const isCollapsible = COLLAPSIBLE_FAMILIES.includes(fam);

    if (isCollapsible && fam !== prevFam) {
      // Family header row
      const totalInFam = SKILLS.filter(s => s.family === fam).length;
      const ranksInFam = SKILLS.filter(s => s.family === fam && (charSkills[s.n]||0) > 0).length;
      // Collapsed families keep their trained sub-skills visible below the
      // header (v8.6.0) — say so, so the rows underneath aren't a surprise.
      const trainedSubset = ranksInFam > 0
        ? ` &nbsp;<span style="color:var(--gold);">(${ranksInFam} trained${skillFamilyCollapsed[fam] ? ' — shown below' : ''})</span>`
        : '';
      const arrow = skillFamilyCollapsed[fam] ? '▸' : '▾';
      rows.push(`<tr class="sk-fam-header" onclick="toggleSkillFamily('${fam}')" style="cursor:pointer;">
        <td colspan="6" style="padding:6px 7px 4px;font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--g70);border-top:1px solid rgba(200,151,30,.15);background:rgba(200,151,30,.04);">
          ${arrow} ${fam} Skills <span style="opacity:var(--o55);color:var(--dim);">(${totalInFam})</span>${trainedSubset}
        </td>
      </tr>`);
      prevFam = fam;
    } else if (!isCollapsible) {
      prevFam = '';
    }

    // Skip skill row entirely if filter rejects it
    if (!passesFilter(sk)) continue;
    // Skip skill row if it belongs to a collapsed family — UNLESS the
    // character has invested ranks in it (v8.6.0, Adam's request: trained
    // sub-skills stay on the main list regardless of the family's state).
    if (isCollapsible && skillFamilyCollapsed[fam] && !((charSkills[sk.n] || 0) > 0)) continue;

    const ai = ATTR_NAMES.indexOf(sk.k);
    const amod = effAm(c, ai);  // v8.6.0 firm-wire: equipped-item attr enhancements included
    const ranks = (charSkills[sk.n]) || 0;
    // v8.3.9: compute synergies targeting this skill. `auto` synergies are
    // currently active (source has 5+ ranks) and fold into the displayed
    // total. `conditional` and `gm` synergies are surfaced as tooltip notes
    // — the player and GM negotiate per-roll whether the context applies.
    const syn = computeSkillSynergies(sk.n, c);
    const synBonus = syn.auto.reduce((s, e) => s + e.value, 0);
    // v8.5.0 Layer 2: always-on skill bonuses from feats, occupations, and
    // talents (Skill Focus, Skill Emphasis, Savant, Healing Knack…) join the
    // synergy bonus in the Misc column. Conditional entries (kit-only
    // bonuses) show in the tooltip but don't fold into the total.
    const mb = skillMiscBon[sk.n] || null;
    const flatBonus = mb ? mb.total : 0;
    const miscTotal = synBonus + flatBonus;
    const total = ranks + amod + miscTotal;
    // v8.8.2: Misc can now be NEGATIVE (Jump's speed modifier on slow races)
    // — the old `> 0 ? + : '0'` display silently hid penalties.
    const miscDisplay = miscTotal ? `${miscTotal > 0 ? '+' : ''}${miscTotal}` : '0';
    // Build a tooltip for the Misc cell explaining where the bonus came from
    let miscTitle = formatSynergyMiscTooltip(syn.auto);
    if (mb) {
      const parts = mb.always.map(e => `${e.value >= 0 ? '+' : ''}${e.value} from ${e.label}`);
      for (const e of mb.cond) parts.push(e.value ? `Conditional: ${e.value > 0 ? '+' : ''}${e.value} from ${e.label} (${e.condition})` : `Note — ${e.label}: ${e.condition}`);
      if (parts.length) miscTitle = (miscTitle ? miscTitle + '\n' : '') + parts.join('\n');
    }
    // v8.2.4 (Issue C-2): use getClassSkillSources to compute BOTH the
    // boolean (for the 'class' badge + cost calc) AND a provenance string
    // (for the badge's tooltip). The tooltip lets players investigate
    // surprises like "why is Knowledge (Tactics) a class skill on my
    // Berserker?" by hovering — they'll see the source(s).
    const skSources = getClassSkillSources(sk.n, c);
    const cls = skSources.length > 0;
    // v8.3.9: extend the row tooltip to mention conditional and GM synergies
    // when present. The player sees a hint that more bonuses are available
    // in specific contexts — they can hover to read the full conditions.
    const baseTitle = cls
      ? `Class skill source${skSources.length>1?'s':''}: ${skSources.join('; ')}`
      : 'Cross-class skill (2 pts/rank, HH p.542)';
    const condNotes = [];
    for (const e of syn.conditional) {
      condNotes.push(`Conditional: +${e.value} ${e.context} (from ${e.source} 5+ ranks)`);
    }
    for (const e of syn.gm) {
      condNotes.push(`GM-adjudicated: +${e.value} ${e.context} (from ${e.source})`);
    }
    // v9.1.0: gear/feat/talent conditionals earn the ⚜ chip too (they lived
    // only in the Misc tooltip — a +10 metal-detector bonus deserves a flag).
    for (const e of ((mb && mb.cond) || [])) {
      condNotes.push(e.value ? `Conditional: ${e.value > 0 ? '+' : ''}${e.value} ${e.condition} (from ${e.label})` : `Note — ${e.label}: ${e.condition}`);
    }
    const provTitle = condNotes.length > 0
      ? `${baseTitle}\n\n${condNotes.join('\n')}`
      : baseTitle;
    const condIndicator = condNotes.length > 0
      ? `<span style="font-size:10px;color:var(--tv70);margin-left:4px;cursor:help;" title="${escapeHTML(condNotes.join('\n'))}">⚜${condNotes.length}</span>`
      : '';
    // v8.5.1/v8.5.2: toolkit-dependency advisory marker. v8.5.2 makes it
    // ownership-aware via the Gear tab's c.items (⚒✓ = satisfying kit owned,
    // no penalty; ⚒ = no kit found, may suffer up to -4 at the table).
    const _tkSat = skillNeedsToolkit(sk) ? toolkitSatisfaction(c, sk) : null;
    const toolkitIndicator = skillNeedsToolkit(sk)
      ? (_tkSat.full
        ? `<span style="font-size:10px;color:rgba(120,200,140,.9);margin-left:4px;cursor:help;" title="${escapeHTML('Satisfied by: ' + _tkSat.by.join(', ') + ' — no penalty.')}">⚒✓</span>`
        : _tkSat.partial != null
        ? `<span style="font-size:10px;color:rgba(214,184,92,.9);margin-left:4px;cursor:help;" title="${escapeHTML('Minimally equipped: ' + _tkSat.by.join(', ') + ' — the penalty drops to ' + _tkSat.partial + ' instead of −4.')}">⚒${_tkSat.partial}</span>`
        : `<span style="font-size:10px;color:var(--tb85);margin-left:4px;cursor:help;" title="May suffer up to a -4 penalty without the appropriate tool/skill kit. Add one on the Gear tab.">⚒</span>`)
      : '';
    // v8.8.2 (Adam's Jump wiring): vertical-reach chip on the Jump row —
    // reach follows the EFFECTIVE size (HH p.173 table), so the Strong
    // super-talents' +1-size-per-talent riders (HH p.263, Su) land here.
    let jumpIndicator = '';
    if (sk.n === 'Jump') {
      const szIdx = effectiveSizeIndex(c);
      const REACH_FT = ['½', '1', '2½', '5', '7½', '15', '30', '60', '120'];
      const superSized = szIdx !== raceSizeIndex(c);
      const seNote = (!c.nullified && hasSupremeEffort(c))
        ? ` During a Supreme Effort (move action): one size category larger again — ${SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, szIdx + 1)]}, reach ${REACH_FT[Math.min(REACH_FT.length - 1, szIdx + 1)]} ft.` : '';
      jumpIndicator = `<span style="font-size:10px;color:${superSized ? '#78afcd' : 'var(--g45)'};margin-left:4px;cursor:help;" title="${escapeHTML(`Vertical reach ${REACH_FT[szIdx]} ft (${SIZE_LADDER[szIdx]}${superSized ? ' — Super-Strong size riders, Su, suppressed while Nullified' : ''}) — height reachable without jumping; high jumps add to it (HH p.173). Speed above/below 30 ft modifies Jump checks via the Misc column.${seNote}`)}">${superSized ? '🦾 ' : ''}↕${REACH_FT[szIdx]}′</span>`;
    }
    const indent = isCollapsible ? 'padding-left:18px;' : '';
    const costIndicator = cls ? '' : '<span style="font-size:10px;color:var(--g40);margin-left:4px;" title="Cross-class skill: 2 points per rank (HH p.542)">2×</span>';
    // v8.52.0 (Session Zero polish): the max-rank cap, VISIBLE. Class skills
    // cap at level+4 (E&E's cap, not d20M's +3); cross-class at half that,
    // rounded down (HH). The input's max now honors the split too — spinners
    // stop at the cap, and a stored over-cap value (pre-v8.52.0 builds)
    // renders in the browser's out-of-range style as a visual flag without
    // being touched.
    const capMax = cls ? (lvl + 4) : Math.floor((lvl + 4) / 2);
    const overCap = ranks > capMax;
    const capChip = `<span style="font-size:10px;color:${overCap ? '#e08080' : 'var(--g38)'};margin-left:3px;cursor:help;${overCap ? 'font-weight:bold;' : ''}" title="${overCap
      ? `OVER CAP: max ranks at level ${lvl} is ${capMax} for this ${cls ? 'class' : 'cross-class'} skill (${cls ? 'level+4' : 'half of level+4, rounded down'}). Reduce ranks or record a GM exception.`
      : `Max ranks: ${capMax} (${cls ? 'class skill: level+4' : 'cross-class: half of level+4, rounded down'})`}">/${capMax}${overCap ? '⚠' : ''}</span>`;
    const gateMet = meetsSkillReq(sk, c.sixLevels);
    const reqColor = sk.req ? (gateMet ? 'var(--g55)' : '#d4b870') : '';
    const reqAnnotation = sk.req
      ? `<span class="sk-sub" style="color:${reqColor};${!gateMet?'font-weight:bold;':''}" title="${gateMet?'Scenario meets this requirement.':'Scenario does not meet this requirement — taking ranks will prompt for GM exception.'}">${sk.req}</span>`
      : '';
    // v8.90.0 (GMF parity — "the same courtesy skills-wise"): the skill name
    // wears its HH dossier (qualifier line + description + Check) as a hover,
    // dotted-gold underlined per the house idiom. The row's provenance title
    // still answers everywhere else on the row.
    const dispNm = displaySkillName(c, sk.n);
    const dossier = skillHoverText(c, sk);
    const nameHTML = dossier
      ? `<span style="cursor:help;border-bottom:1px dotted rgba(200,151,30,.45);" title="${escapeHTML(dossier)}">${dispNm}</span>`
      : dispNm;
    rows.push(`<tr title="${escapeHTML(provTitle)}">
      <td style="${indent}">${nameHTML}${cls ? `<span class="sk-cls" title="${escapeHTML(provTitle)}" style="cursor:help;">class</span>` : ''}${reqAnnotation}${condIndicator}${toolkitIndicator}${jumpIndicator}</td>
      <td>${sk.k}</td><td>${amod>=0?'+':''}${amod}</td>
      <td><input type="number" class="sk-rank-inp" id="skr-${sk.n.replace(/[^a-z0-9]/gi,'_')}" value="${ranks}" min="0" max="${capMax}" oninput="updSkTot(this,'${sk.n.replace(/'/g,"\\'")}',${amod})" onchange="updSkTot(this,'${sk.n.replace(/'/g,"\\'")}',${amod});commitSkillRank(this,'${sk.n.replace(/'/g,"\\'")}')">${capChip}${costIndicator}</td>
      <td id="skm-${sk.n.replace(/[^a-z0-9]/gi,'_')}" title="${escapeHTML(miscTitle)}">${miscDisplay}</td>
      <td class="sk-total" id="skt-${sk.n.replace(/[^a-z0-9]/gi,'_')}">${total>=0?'+':''}${total}</td>
    </tr>`);
  }

  if (rows.length === 0) {
    rows.push(`<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:var(--g45);font-size:13px;">No skills match the current filter.</td></tr>`);
  }
  document.getElementById('sk-tbody').innerHTML = rows.join('');
}

// v8.2.2 (Issue 4): Real-time skill point budget tally with class/cross-class
// cost differential per HH p.541-544.
//
// COST MODEL (HH p.541-544):
//   - Class skill rank: 1 skill point per rank
//   - Cross-class skill rank: 2 skill points per rank
//
// DEFERRED for a future slice (visible-but-not-yet-painful gaps):
//   - [DONE v8.52.0] HH: cross-class max-rank cap is half the class-skill cap
//     — inputs now carry max = lvl+4 (class) / floor((lvl+4)/2) (cross-class),
//     with a visible /cap chip and an over-cap ⚠ flag. Typed-in values above
//     the cap are still ACCEPTED (browser marks them out-of-range; the chip
//     flags them) — a hard gate + GM-exception prompt remains deferred.
//   - HH p.7300+ & p.11919: half-ranks (two cross-class half-ranks = 1 whole
//     rank). Currently c.skills stores integer ranks only. Modeling halves
//     would require either floating-point storage or a separate halfRanks field.
//
// These deferrals are tracked here so the next pass on skills knows what's left.

// Recompute spent/remaining from LIVE DOM inputs (not from c.skills) so the
// tally reflects tentative changes before Save. Called from updSkTot on every
// input change, and once at the end of renderSkills() for initial display.
// v8.3.12: Adjust the current PP for a specific contributor within a pool.
// Called by +/− buttons in the Powers & Spells panel. delta is +1 or -1.
// Clamps to [0, contributor budget].
function adjustPP(ctrIdSafe, poolName, ctrKey, delta) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  const stats = computeCasterStats(c);
  const pool = stats[poolName];
  if (!pool) return;
  // Find this contributor's budget by matching ctrKey
  const ctr = pool.contributors.find(x => ((x.class || 'unknown') + ':' + (x.level || 0)) === ctrKey);
  if (!ctr) return;
  const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
  const cur = c.ppCurrent[poolName][ctrKey] ?? budget;
  const next = Math.max(0, Math.min(budget, cur + delta));
  c.ppCurrent[poolName][ctrKey] = next;
  // Update the visible counter without re-rendering the whole sheet
  const el = document.getElementById('pp-cur-' + ctrIdSafe);
  if (el) el.textContent = next;
  save();
}

// v8.3.12: Reset all contributors' PP current to their budget for one pool.
// Also clears the "Prepared Today" textareas for prep casters in this pool.
function restPP(poolName) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  const stats = computeCasterStats(c);
  const pool = stats[poolName];
  if (!pool) return;
  // v8.42.0: resting ends ALL active power effects (Adam: "all effects wear
  // off at the very least when the character rests"). Idempotent — the
  // fullyRested() multi-pool sweep clears on its first pool only.
  const _aeCleared = clearActiveBuffs(c, 'rested');
  if (_aeCleared) {
    toast(`✨ ${_aeCleared} active power effect${_aeCleared === 1 ? '' : 's'} ended with the rest.`);
    renderActiveBuffs(c);
  }
  for (const ctr of pool.contributors) {
    if (ctr._isAdvancer) continue;  // heritage/feat PP refills too (v8.5.4)
    const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const budget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    c.ppCurrent[poolName][ctrKey] = budget;
    // v8.5.4 Layer 4: new dawn — re-memorize yesterday's structured prepared
    // list automatically: cast counters reset, committed PP re-deducted from
    // this contributor's fresh budget (free specialty slots cost nothing).
    // If a level-up shrank the budget below the committed total, the deficit
    // just drains to 0 — the panel shows the imbalance for the player to fix.
    const list = c.preparedSlots && c.preparedSlots[poolName] && c.preparedSlots[poolName][ctrKey];
    if (list && list.length) {
      let committed = 0;
      for (const r of list) { r.cast = 0; if (!r.free) committed += (r.cost || 0) * (r.qty || 0); }
      c.ppCurrent[poolName][ctrKey] = Math.max(0, budget - committed);
    }
  }
  // Clear prepared today for this pool (legacy free-text workflow)
  if (c.preparedToday && c.preparedToday[poolName]) {
    c.preparedToday[poolName] = {};
  }
  save();
  renderSheet(c);
  renderPowers();
}

// v8.3.12: Capture textarea changes for prepared-today and powers-known lists,
// invoked via onblur on the textareas. Snapshots into the character object.
function snapshotPowerTextareas(c) {
  if (!c) return;
  const stats = computeCasterStats(c);
  if (!c.preparedToday) c.preparedToday = {};
  if (!c.powersKnownList) c.powersKnownList = {};
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = stats[poolName];
    if (!pool) continue;
    if (!c.preparedToday[poolName]) c.preparedToday[poolName] = {};
    if (!c.powersKnownList[poolName]) c.powersKnownList[poolName] = {};
    for (const ctr of pool.contributors) {
      if (ctr._isAdvancer || ctr._fromHeritage) continue;
      const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
      const ctrIdSafe = (poolName + '_' + ctrKey).replace(/[^a-z0-9]/gi,'_');
      if (ctr.prep) {
        const el = document.getElementById('prep-' + ctrIdSafe);
        if (el) c.preparedToday[poolName][ctrKey] = el.value;
      } else {
        const el = document.getElementById('known-' + ctrIdSafe);
        if (el) c.powersKnownList[poolName][ctrKey] = el.value;
      }
    }
  }
}

// v8.3.15: Shared skill point budget calculator. Walks per-class per-level
// allocation, applies the L1 ×5 multiplier ONLY to the very first level of
// the very first class, enforces the d20 min-1-per-level rule, and adds
// racial skill point bonuses where applicable (currently just Human: +5
// at L1, +1 at each additional level — HH p.21).
//
// Returns the total skill point budget the character has earned across
// their career. Used both by renderSkills() at initial paint and by
// recomputeSkillBudget() on live DOM updates — guaranteeing the two paths
// agree on the math.
function computeSkillPointBudget(c) {
  if (!c || !c.attrs) return 0;
  const intM = am(c.attrs[3]);
  const classArr = (c.classes && c.classes.length > 0)
    ? c.classes
    : migrateLegacyClasses(c);
  // Order classes such that the {first:true} class comes first; preserve the
  // rest in their declared order. This gives a deterministic L1..LN walk.
  const ordered = [...classArr].sort((a, b) => {
    if (a.first && !b.first) return -1;
    if (b.first && !a.first) return 1;
    return 0;
  });
  let totalSP = 0;
  let levelCounter = 0;
  for (const e of ordered) {
    const cls = getClassEntry(e);
    // d20 lineage rule: minimum 1 skill point per level even with deeply
    // negative Int mod. If a class somehow has no .sp, the fallback is the
    // legacy 4 (preserves pre-v8.3.13 behavior for unknown classes).
    const sp = cls && typeof cls.sp === 'number' ? cls.sp : 4;
    const perLvl = Math.max(1, sp + intM);
    const lvl = e.level || 0;
    for (let i = 0; i < lvl; i++) {
      levelCounter++;
      // L1 (only the very first level of the very first class) gets ×5
      const multiplier = (levelCounter === 1) ? 5 : 1;
      totalSP += perLvl * multiplier;
    }
  }
  // v8.3.15: Human racial skill point bonus (HH p.21).
  //   "5 extra skill points at 1st level, and 1 extra skill point at each
  //    additional level, demonstrating the human's natural versatility."
  // Note this is the only race with a skill-point-budget contribution in HH
  // and FF; if future races gain similar bonuses they go here.
  // v8.67.0 (Mutant sync): Unnatural Prowess — 2 bonus skill points per +1
  // Mutant level (HH p.29). Budget-integrated per Adam; the Tech Scale 0
  // restriction is TABLE-ENFORCED (the first typed SP pool — the budget
  // tracker stays one number, the restriction rides the advisory line on
  // the Mutations tab and the budget note).
  const _mlSP = (getMPState(c).mutantLevel || 0);
  if (_mlSP > 0 && levelCounter >= 1) totalSP += 2 * _mlSP;
  // v8.68.0: a Human-parent Hybrid inherits the Human SP bonus ("all racial
  // abilities of both parents" — Adam's simple model).
  const _hySPh = hybridInfo(c);
  const _isHumanish = c.race === 'Human' || (_hySPh && (_hySPh.a === 'Human' || _hySPh.b === 'Human'));
  if (_isHumanish && levelCounter >= 1) {
    totalSP += 5;                         // L1 bonus
    if (levelCounter > 1) {
      totalSP += (levelCounter - 1);      // +1 per additional level
    }
  }
  return totalSP;
}

function recomputeSkillBudget(c){
  if (!c) return;
  let spent = 0;
  for (const sk of SKILLS) {
    const id = 'skr-' + sk.n.replace(/[^a-z0-9]/gi,'_');
    const el = document.getElementById(id);
    if (!el) continue; // Skill row not currently rendered (filtered out)
    const ranks = parseInt(el.value, 10) || 0;
    if (ranks <= 0) continue;
    const isClass = isClassSkill(sk.n, c);
    spent += isClass ? ranks : ranks * 2;
  }
  const totalSP = computeSkillPointBudget(c);
  const remaining = totalSP - spent;
  const info = document.getElementById('sk-pts-info');
  if (info) {
    const overspent = remaining < 0;
    let ccNote = '';
    try { const cc = crossClassPremiumOf(c); if (cc.prem > 0) ccNote = ` · incl. +${cc.prem} cross-class premium (${cc.items.join(', ')})`; } catch (e) {}
    info.textContent = `Skill Points: ${spent} spent of ~${totalSP} total (${remaining} remaining${overspent ? ' — OVER BUDGET' : ''})${ccNote}`;
    info.style.color = overspent ? 'var(--red-text)' : '';
  }
}

// v8.2.4 (Issue C-1): Skill req parsing and scenario-gate warnings.
//
// Each skill in the SKILLS array may have a `req` field like "Tech 5" or
// "Psionic 1" or "Arcane 1" indicating the minimum Six Scales axis tier at
// which the skill is available. The data is documented in the handbook but
// was not previously enforced — players could put ranks in Computer Use in
// a Tech 1 scenario without any warning.
//
// Per the player's design choice (v8.2.4): "Show with warning — row appears
// normal but warns when trying to put ranks in it (GM can override)."

function parseSkillReq(reqString) {
  // "Tech 5" → {axis:'tech', min:5}. Returns null if unparseable.
  if (!reqString || typeof reqString !== 'string') return null;
  const m = reqString.match(/^([A-Za-z]+)\s+(\d+)$/);
  if (!m) return null;
  const axisName = m[1].toLowerCase();
  // Map handbook axis names to sixLevels keys
  const axisMap = {tech:'tech', arcane:'arcane', divine:'divine',
                   psionic:'psionic', heroic:'heroic', mutation:'mutation'};
  const axis = axisMap[axisName];
  if (!axis) return null;
  return {axis, min: parseInt(m[2], 10)};
}

function meetsSkillReq(skill, sixLevels) {
  // Returns true if the scenario's Six Scales are sufficient. Skills with no
  // req or unparseable req are always available.
  const req = parseSkillReq(skill.req);
  if (!req) return true;
  const have = (sixLevels && sixLevels[req.axis]) || 0;
  return have >= req.min;
}

// Track which scenario-gated skills the player has acknowledged as
// GM exceptions during this session (avoid repeating warnings on every
// keystroke for the same skill).
let _scenarioGateAcknowledged = new Set();

async function checkScenarioGateOnRankChange(skill, ranks, c) {
  // Called from updSkTot when a skill's rank input changes. If the skill is
  // scenario-gated and the player is taking 1+ ranks for the first time in
  // this session, warn them. If they accept, record a gmException; if they
  // decline, revert the input to the prior value (we treat 0 as the safe
  // fallback since the warning fires on transitions to ranks ≥ 1).
  if (!c || !skill || !skill.req) return true;
  if (ranks <= 0) return true; // nothing to warn about
  if (meetsSkillReq(skill, c.sixLevels)) return true; // req satisfied
  // Already acknowledged this session — let it through silently
  if (_scenarioGateAcknowledged.has(skill.n)) return true;
  const req = parseSkillReq(skill.req);
  const have = (c.sixLevels && c.sixLevels[req.axis]) || 0;
  const axisDef = (SIX_LEVELS[req.axis]) || {};
  const axisLabel = axisDef.label || req.axis;
  const ok = await confirmModal(
    `"${skill.n}" requires ${axisLabel} ≥ ${req.min}, but this scenario has ${axisLabel} ${have}.\n\n` +
    `Per HH p.42-ish, this skill is not normally available at this scenario's tier. ` +
    `Take ranks anyway as a GM-acknowledged exception?\n\n` +
    `(A GM exception entry will be recorded on this character.)`
  );
  if (!ok) return false; // caller will revert
  // Mark as acknowledged so we don't pop the dialog again on every keystroke
  _scenarioGateAcknowledged.add(skill.n);
  // Record on the character. Idempotent — if there's already an entry for
  // this skill, don't duplicate.
  if (!c.gmExceptions) c.gmExceptions = [];
  const already = c.gmExceptions.some(ex => ex.type === 'skill' && ex.target === skill.n);
  if (!already) {
    c.gmExceptions.push({
      type:'skill',
      target: skill.n,
      missing: [`${axisLabel} ${have} < required ${req.min}`],
      grantedAt: new Date().toLocaleDateString(),
    });
    save();
  }
  return true;
}

function updSkTot(inp, name, amod){
  // Update this row's total display (called on EVERY keystroke via oninput;
  // also called from onchange — but that's a no-op repeat that's harmless).
  const id = name.replace(/[^a-z0-9]/gi,'_');
  const ranks = parseInt(inp.value, 10) || 0;
  // v8.3.9: synergies. If THIS skill itself has any auto synergy contributions
  // FEEDING IT (sources at 5+ ranks), fold those into its total.
  // v8.5.0 Layer 2: also fold in the always-on feat/occupation/talent skill
  // bonuses, mirroring renderSkills' Misc-column computation.
  let selfSyn = 0, selfFlat = 0;
  if (curId) {
    const cc = chars.find(x => x.id === curId);
    if (cc) {
      const s = computeSkillSynergies(name, cc);
      selfSyn = s.auto.reduce((a, e) => a + e.value, 0);
      const mb = computeSkillMiscBonuses(cc)[name];
      selfFlat = mb ? mb.total : 0;
    }
  }
  const t = ranks + amod + selfSyn + selfFlat;
  document.getElementById('skt-'+id).textContent = (t >= 0 ? '+' : '') + t;
  // v8.3.9: if THIS skill is a synergy SOURCE for any other skill, those
  // targets need their totals re-computed too. This handles the case where
  // the player types '5' into Bluff and we need to immediately bump
  // Diplomacy, Intimidate, and Sleight of Hand. We walk SYNERGIES_DB once,
  // collect affected targets, and refresh their displays.
  if (curId) {
    const cc = chars.find(x => x.id === curId);
    if (cc) {
      const affectedTargets = new Set(
        SYNERGIES_DB.filter(e => e.source === name && e.kind === 'auto').map(e => e.target)
      );
      for (const target of affectedTargets) {
        const tid = target.replace(/[^a-z0-9]/gi,'_');
        const totalEl = document.getElementById('skt-' + tid);
        const miscEl  = document.getElementById('skm-' + tid);
        if (!totalEl) continue;  // target row not currently visible (filtered or collapsed)
        const tsk = SKILLS.find(sk => sk.n === target);
        if (!tsk) continue;
        const tai = ATTR_NAMES.indexOf(tsk.k);
        const tmod = am(cc.attrs[tai]);
        const tranks = getLiveSkillRanks(cc, target);
        const tsyn = computeSkillSynergies(target, cc);
        // v8.5.0 Layer 2: include the always-on feat/occupation/talent skill
        // bonuses in the refreshed target row, matching renderSkills.
        const tmb = computeSkillMiscBonuses(cc)[target];
        const tFlat = tmb ? tmb.total : 0;
        const tBonus = tsyn.auto.reduce((a, e) => a + e.value, 0) + tFlat;
        const tTotal = tranks + tmod + tBonus;
        totalEl.textContent = (tTotal >= 0 ? '+' : '') + tTotal;
        if (miscEl) {
          miscEl.textContent = tBonus > 0 ? '+' + tBonus : '0';
          miscEl.setAttribute('title', formatSynergyMiscTooltip(tsyn.auto));
        }
      }
    }
  }
  // v8.2.2 (Issue 4): also recompute the running budget tally from live DOM.
  if (curId) {
    const c = chars.find(x => x.id === curId);
    if (c) recomputeSkillBudget(c);
  }
}

// v8.2.4 (Issue C-1): On the input's onchange (firing only when the player
// commits a value by tabbing away or pressing Enter), check the scenario gate.
// If the skill requires a higher tier than the scenario has and the player is
// taking 1+ ranks, prompt for GM exception. Decline → revert to 0.
async function commitSkillRank(inp, name) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const skill = SKILLS.find(sk => sk.n === name);
  if (!skill) return;
  const ranks = parseInt(inp.value, 10) || 0;
  const okay = await checkScenarioGateOnRankChange(skill, ranks, c);
  if (!okay) {
    // Player declined GM exception — revert to 0 and refresh the displays
    inp.value = 0;
    const id = name.replace(/[^a-z0-9]/gi,'_');
    const ai = ATTR_NAMES.indexOf(skill.k);
    const amod = effAm(c, ai);  // v8.6.0 firm-wire
    document.getElementById('skt-'+id).textContent = (amod >= 0 ? '+' : '') + amod;
    recomputeSkillBudget(c);
  }
}
function saveSkills(){
  if(!curId)return;const c=chars.find(x=>x.id===curId);if(!c)return;
  c.skills={};SKILLS.forEach(sk=>{const el=document.getElementById('skr-'+sk.n.replace(/[^a-z0-9]/gi,'_'));if(el)c.skills[sk.n]=parseInt(el.value)||0});
  save();_skMarkClean();toast('Skills saved!');
}

