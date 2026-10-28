// =============================================================================
// js/ui/skills.js
// SKILLS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Skills page: ranks, families, filters and saving.
//
// KEY NAMES (so you can search for them)
//   tables and state: skillFilter, skillFamilyCollapsed, skillFamilyToggled
//   functions (14): addSkillSetPick, removeSkillSetPick, setSkillFilter,
//   toggleSkillFamily, expandAllSkillFamilies, collapseAllSkillFamilies,
//   getLiveSkillRanks, formatSynergyMiscTooltip, _snapshotSkillInputsToChar,
//   renderSkills, recomputeSkillBudget, updSkTot, commitSkillRank,
//   saveSkills
//
// WHERE IT CAME FROM
//   Gathered from js/app/50-skills-page.js, js/rules/17-per-diem-and-class-
//   choices.js when the code was regrouped by topic and page. Each function
//   and table moved whole and unchanged, with the comments above it,
//   including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function addSkillSetPick(key, val) {
  if (!val) return;
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.skillSets) c.skillSets = {};
  if (!c.skillSets[key]) c.skillSets[key] = [];
  if (!c.skillSets[key].includes(val)) c.skillSets[key].push(val);
  if (!window._ssOpen) window._ssOpen = {};
  window._ssOpen[key] = true;
  logAct(`🎓 ${key === 'shutItOut' ? 'Shut It Out' : 'Skill Mastery'}: ${val} designated (Take 10 even under duress).`);
  save(); renderClassChoices(c);
}
function removeSkillSetPick(key, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const arr = (c.skillSets || {})[key]; if (!arr || idx < 0 || idx >= arr.length) return;
  const gone = arr.splice(idx, 1)[0];
  logAct(`🎓 ${key === 'shutItOut' ? 'Shut It Out' : 'Skill Mastery'}: ${gone} designation removed (GM retcon).`);
  save(); renderClassChoices(c);
}
// ========== SKILLS (v8.1.3) ==========
// Filter state and collapsible-family state are session-scoped (not persisted).
// skillFilter:  'all' (default) | 'class' | 'trained'
// skillFamilyCollapsed: map from family name to bool (true = collapsed).
// Default: all four collapsible families start collapsed unless the character
// has any ranks in a skill within that family, in which case it auto-expands.
let skillFilter = 'all';
let skillFamilyCollapsed = {Craft:true, Knowledge:true, Perform:true, Profession:true};
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
        ? ` &nbsp;<span class="c-gold">(${ranksInFam} trained${skillFamilyCollapsed[fam] ? ' — shown below' : ''})</span>`
        : '';
      const arrow = skillFamilyCollapsed[fam] ? '▸' : '▾';
      rows.push(`<tr class="cursor-pointer sk-fam-header" onclick="toggleSkillFamily('${fam}')">
        <td colspan="6" class="font-serif fs-10 uppercase ls-0_1em c-g70" style="padding:6px 7px 4px;border-top:1px solid rgba(200,151,30,.15);background:rgba(200,151,30,.04);">
          ${arrow} ${fam} Skills <span class="o-55 c-dim">(${totalInFam})</span>${trainedSubset}
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
      ? `<span class="fs-10 ml-4 cursor-help" style="color:var(--tv70);" title="${escapeHTML(condNotes.join('\n'))}">⚜${condNotes.length}</span>`
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
        : `<span class="fs-10 c-tb85 ml-4 cursor-help" title="May suffer up to a -4 penalty without the appropriate tool/skill kit. Add one on the Gear tab.">⚒</span>`)
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
      ? `<span class="cursor-help" style="border-bottom:1px dotted rgba(200,151,30,.45);" title="${escapeHTML(dossier)}">${dispNm}</span>`
      : dispNm;
    rows.push(`<tr title="${escapeHTML(provTitle)}">
      <td style="${indent}">${nameHTML}${cls ? `<span class="cursor-help sk-cls" title="${escapeHTML(provTitle)}">class</span>` : ''}${reqAnnotation}${condIndicator}${toolkitIndicator}${jumpIndicator}</td>
      <td>${sk.k}</td><td>${amod>=0?'+':''}${amod}</td>
      <td><input type="number" class="sk-rank-inp" id="skr-${sk.n.replace(/[^a-z0-9]/gi,'_')}" value="${ranks}" min="0" max="${capMax}" oninput="updSkTot(this,'${sk.n.replace(/'/g,"\\'")}',${amod})" onchange="updSkTot(this,'${sk.n.replace(/'/g,"\\'")}',${amod});commitSkillRank(this,'${sk.n.replace(/'/g,"\\'")}')">${capChip}${costIndicator}</td>
      <td id="skm-${sk.n.replace(/[^a-z0-9]/gi,'_')}" title="${escapeHTML(miscTitle)}">${miscDisplay}</td>
      <td class="sk-total" id="skt-${sk.n.replace(/[^a-z0-9]/gi,'_')}">${total>=0?'+':''}${total}</td>
    </tr>`);
  }

  if (rows.length === 0) {
    rows.push(`<tr><td colspan="6" class="text-center c-g45 fs-13" style="padding:1.5rem;">No skills match the current filter.</td></tr>`);
  }
  document.getElementById('sk-tbody').innerHTML = rows.join('');
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

