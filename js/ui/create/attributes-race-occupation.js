// =============================================================================
// js/ui/create/attributes-race-occupation.js
// CREATE / ATTRIBUTES RACE OCCUPATION — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Create page: attribute generation, race and hybrid
//   choices, and starting occupations.
//
// KEY NAMES (so you can search for them)
//   tables and state: occupationsUnlocked, formOccupationPicks,
//   formOccupationPicksFor
//   functions (22): renderAttrGrid, onAC, getAttrs, rollAttributes,
//   pointBuyStart, updatePB, applyRaceAdjustments, refreshAttrModifiers,
//   renderAttrBudget, _formHybridRlm, updateHybridForm, updateRaceInfo,
//   lockOccupations, unlockOccupations, shouldShowSecondOccupation,
//   applySecondOccupationVisibility, updateOccupationDisplay,
//   renderOccupationPicker, renderOccupationPickerReadonly,
//   onOccupationPickChange, updateOccupationPicksWarning,
//   populateRaceDropdown
//
// WHERE IT CAME FROM
//   Gathered from js/app/43-create-attributes-race-occupation.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== ATTRIBUTES ==========
function renderAttrGrid(){
  const g=document.getElementById('attr-grid');
  const scores=editId?chars.find(c=>c.id===editId)?.attrs||[10,10,10,10,10,10]:[10,10,10,10,10,10];
  g.innerHTML=ATTR_NAMES.map((a,i)=>`
    <div class="attr-box"><span class="attr-nm">${a}</span>
    <input class="attr-inp" type="number" id="a${i}" value="${scores[i]}" min="1" max="100" title="Theoretical ceiling 100 (the bonus progression extrapolates: modifier = (score &minus; 10) / 2, so 100 = +45; carrying capacity rides Tremendous Strength, HH p.263)" onchange="onAC(${i})" oninput="onAC(${i})">
    <span class="attr-mod" id="am${i}">${ms(scores[i])}</span></div>`).join('');
  updateDerived();
}
function onAC(i){const v=parseInt(document.getElementById('a'+i).value)||10;document.getElementById('am'+i).textContent=ms(v);if(pbMode)updatePB();updateDerived();renderAttrBudget();}
function getAttrs(){return ATTR_NAMES.map((_,i)=>parseInt(document.getElementById('a'+i)?.value)||10)}
function rollAttributes(){
  pbMode=false;document.getElementById('pb-remain').style.display='none';
  const raceName = document.getElementById('c-race')?.value || '';
  // Reset budget — racial will be re-applied after rolling
  formBudget = { method: 'roll', baseTotal: 0, racialApplied: '' };
  let baseSum = 0;
  ATTR_NAMES.forEach((_,i)=>{const r=[1,2,3,4].map(()=>Math.floor(Math.random()*6)+1);r.sort((a,b)=>b-a);const s=r[0]+r[1]+r[2];const inp=document.getElementById('a'+i);if(inp){inp.value=s;document.getElementById('am'+i).textContent=ms(s)}baseSum+=s;});
  formBudget.baseTotal = baseSum;
  if (raceName) applyRaceAdjustments(raceName);
  updateDerived();renderAttrBudget();
  toast('Rolled 4d6 drop lowest! Base total: '+baseSum);
}
function pointBuyStart(){
  pbMode=true;
  const raceName = document.getElementById('c-race')?.value || '';
  // Point buy gives 20 points to spend; base 10 each = 60 base; + 20 spent = 80 base total.
  // racialApplied stays whatever it was; the base values are reset to 10s, then race re-applied.
  formBudget = { method: 'pointbuy', baseTotal: 80, racialApplied: '' };
  ATTR_NAMES.forEach((_,i)=>{const inp=document.getElementById('a'+i);if(inp){inp.value=10;document.getElementById('am'+i).textContent='+0'}});
  if (raceName) applyRaceAdjustments(raceName);
  updatePB();updateDerived();renderAttrBudget();
  toast('Point buy: 20 pts, base 10 each, max 18 (target base total: 80).');
}
function updatePB(){
  const a=getAttrs(),spent=a.reduce((s,v)=>s+Math.max(0,v-10),0),rem=20-spent;
  const el=document.getElementById('pb-remain');el.style.display='block';
  el.textContent=`Points remaining: ${rem}/20`;el.style.color=rem<0?'var(--red)':'var(--g60)';
}

// Apply (or re-apply) a race's adjustments to the attribute input fields.
// If formBudget.racialApplied names a different race, reverse that race's
// adjustments first to keep displayed scores consistent with the base budget.
function applyRaceAdjustments(newRaceName){
  // Step 1: reverse the previously-applied race adjustments (if any)
  if (formBudget.racialApplied && formBudget.racialApplied !== newRaceName) {
    const oldAdj = getRacialAdj(formBudget.racialApplied);
    for (let i = 0; i < 6; i++) {
      const inp = document.getElementById('a'+i);
      if (inp) inp.value = (parseInt(inp.value)||10) - oldAdj[i];
    }
  } else if (formBudget.racialApplied === newRaceName) {
    // Same race; nothing to do — EXCEPT a Hybrid whose parents changed:
    // reverse the previously-applied parent sum (snapshotted) and fall
    // through to re-apply the fresh one (v8.68.0).
    if (newRaceName === 'Hybrid') {
      const prev = formBudget.hybridAdjApplied || [0,0,0,0,0,0];
      for (let i = 0; i < 6; i++) {
        const inp = document.getElementById('a'+i);
        if (inp) inp.value = (parseInt(inp.value)||10) - prev[i];
      }
    } else {
      refreshAttrModifiers();
      renderAttrBudget();
      return;
    }
  }
  // Step 2: apply the new race's adjustments
  const newAdj = getRacialAdj(newRaceName);
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById('a'+i);
    if (inp) inp.value = (parseInt(inp.value)||10) + newAdj[i];
  }
  // v8.68.0: snapshot the applied Hybrid parent-sum so a later parent swap
  // can reverse exactly what was applied.
  if (newRaceName === 'Hybrid') formBudget.hybridAdjApplied = newAdj;
  formBudget.racialApplied = newRaceName;
  refreshAttrModifiers();
  renderAttrBudget();
}

// Recompute and re-display each attribute's modifier text.
function refreshAttrModifiers(){
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById('a'+i);
    if (!inp) continue;
    const v = parseInt(inp.value)||10;
    const span = document.getElementById('am'+i);
    if (span) span.textContent = ms(v);
  }
}

// Render the attribute budget ledger (current base sum vs. target + delta) and
// per-attribute violation badges (where displayed − racial would put base ≤ 0).
function renderAttrBudget(){
  const div = document.getElementById('attr-budget');
  const vio = document.getElementById('attr-violations');
  if (!div || !vio) return;
  const attrs = getAttrs();
  const adj = getRacialAdj(formBudget.racialApplied);
  // Base = displayed − racial. This is what should equal baseTotal.
  const baseSum = attrs.reduce((s,v,i) => s + (v - adj[i]), 0);
  const target = formBudget.baseTotal;
  const methodLabel = {quickdraw:'Quickdraw', pointbuy:'Point Buy', roll:'4d6 Drop Lowest', manual:'Manual'}[formBudget.method] || '';
  if (target == null) {
    // No method established yet — show a quiet hint
    div.style.display = 'block';
    div.innerHTML = `<span class="o-60 c-dim">No attribute budget set — pick a method above (Roll or Point Buy) to enable budget tracking.</span>`;
  } else {
    const delta = baseSum - target;
    const deltaColor = delta === 0 ? '#6dba88' : (Math.abs(delta) <= 2 ? 'var(--g85)' : 'var(--red-text)');
    const deltaText = delta === 0 ? 'Δ 0' : `Δ ${delta>0?'+':''}${delta}`;
    const racialLine = formBudget.racialApplied ? ` &nbsp;·&nbsp; <span class="op-0_7">racial (${formBudget.racialApplied}): ${adj.map((v,i) => v!==0?`${v>0?'+':''}${v} ${ATTR_NAMES[i]}`:null).filter(Boolean).join(', ')||'none'}</span>` : '';
    div.style.display = 'block';
    div.innerHTML = `<span class="op-0_7">${methodLabel} budget:</span> base total <b>${baseSum}</b> / ${target} <span style="color:${deltaColor};font-weight:bold;">${deltaText}</span>${racialLine}`;
  }
  // Per-attribute floor check: displayed − racial must be ≥ 1
  const violations = [];
  for (let i = 0; i < 6; i++) {
    const displayed = attrs[i];
    const base = displayed - adj[i];
    if (base < 1) {
      const floor = 1 + adj[i]; // minimum allowable displayed value
      violations.push(`${ATTR_NAMES[i]} must be ≥ ${floor} (racial ${adj[i]>=0?'+':''}${adj[i]} from ${formBudget.racialApplied}; base would be ${base})`);
    }
  }
  if (violations.length) {
    vio.style.display = 'block';
    vio.innerHTML = '<b>⚠ Score violations:</b><br>' + violations.map(v => '• '+v).join('<br>');
  } else {
    vio.style.display = 'none';
  }
}
function _formHybridRlm() {
  const a = document.getElementById('c-hyb-a')?.value || '';
  const b = document.getElementById('c-hyb-b')?.value || '';
  if (!a || !b) return 0;
  const ov = document.getElementById('c-hyb-rlm')?.value;
  if (ov !== '' && ov != null && !isNaN(parseInt(ov, 10))) return parseInt(ov, 10);
  return ((RACES[a] || {}).ecl || 0) + ((RACES[b] || {}).ecl || 0) + 1;
}
function updateHybridForm() {
  const a = document.getElementById('c-hyb-a')?.value || '';
  const b = document.getElementById('c-hyb-b')?.value || '';
  const info = document.getElementById('c-hyb-rlm-info');
  if (info) {
    if (a && b) {
      const auto = ((RACES[a] || {}).ecl || 0) + ((RACES[b] || {}).ecl || 0) + 1;
      const eff = _formHybridRlm();
      info.innerHTML = `RLM: <b>+${eff}</b> ${eff === auto ? `(auto: ${(RACES[a]||{}).ecl||0} + ${(RACES[b]||{}).ecl||0} + 1)` : `<span style="color:#d4b870;">(GM override — auto would be +${auto})</span>`}`;
    } else info.innerHTML = '<span style="color:#d4b870;">⚑ pick BOTH parents (HUMANOID races only, GM approval)</span>';
  // v8.68.1: legacy/GM-exception guard — a stored non-Humanoid parent flags.
  // v9.0.0: 'Half-Again' is exempt — not an ancestry, a stature (the egg).
  if (info && a && b) {
    const bad = [a, b].filter(x => !HYBRID_HUMANOID_RACES.includes(x) && x !== 'Half-Again');
    if (bad.length) info.innerHTML += ` <span class="c-red-text fs-10" title="Only Humanoid races can interbreed (Adam's ruling 2026-10-02). A non-Humanoid parent on a legacy record stands only as an explicit GM exception.">⚠ ${bad.join(' & ')}: not Humanoid — GM exception territory</span>`;
    if (a === 'Half-Again' && b === 'Half-Again') info.innerHTML += ` <span class="c-red-text fs-10">⚠ Half-Again × Half-Again is no hybrid at all — pick a real race for one parent.</span>`;
    else if (a === 'Half-Again') info.innerHTML += ` <span class="fs-10" style="color:#d4b870;">💡 Half-Again serves as Parent B — size, speed, and racial abilities follow the real parent either way.</span>`;
    else if (b === 'Half-Again') info.innerHTML += ` <span class="fs-10" style="color:var(--tg85);" title="A half-again-sized specimen of Parent A: +2 Str/+2 Con/−2 Dex, Powerful Build (one size larger where advantageous — Grapple, larger weapons, carry ×2). Formal rules in the UCS.">🥚 found it — ${escapeHTML(a || 'the parent')}, and Half-Again!</span>`;
  }
  }
  applyRaceAdjustments('Hybrid');
  updateDerived();
}
function updateRaceInfo(){
  const raceName = document.getElementById('c-race').value;
  const r = RACES[raceName] || {};
  // v8.68.0: show/hide the Hybrid parent picker; populate once.
  const hyRow = document.getElementById('hybrid-row');
  if (hyRow) {
    hyRow.style.display = raceName === 'Hybrid' ? '' : 'none';
    if (raceName === 'Hybrid') {
      const selA = document.getElementById('c-hyb-a'), selB = document.getElementById('c-hyb-b');
      if (selA && !selA.options.length) {
        const opts = '<option value="">— choose —</option>' + _hybridEligibleRaces().map(n => `<option>${escapeHTML(n)}</option>`).join('');
        selA.innerHTML = opts; selB.innerHTML = opts + '<option title="A half-again-sized specimen of Parent A (+2 Str/+2 Con/−2 Dex, Powerful Build, carry ×2); contributes +0 RLM — the Hybrid +1 does the rest. Formal rules: UCS.">Half-Again</option>';  // v9.0.0: the egg sits in Parent B only
      }
      updateHybridForm();
    }
  }
  const adjArr = getRacialAdj(raceName);
  const adjs = raceName === 'Hybrid'
    ? (ATTR_NAMES.map((n, i) => adjArr[i] ? `${adjArr[i] > 0 ? '+' : ''}${adjArr[i]} ${n}` : '').filter(Boolean).join(', ') || 'None (pick the parents)')
    : (Object.entries(r.adj||{}).map(([k,v])=>(v>0?'+':'')+v+' '+k).join(', ')||'None');
  const eclShown = raceName === 'Hybrid' ? _formHybridRlm() : (r.ecl || 0);
  const cite = citeHTML('races', raceName);
  document.getElementById('race-info').innerHTML=`<b class="c-gold font-serif fs-9 ls-0_1em">ABILITY ADJUSTMENTS</b> ${cite}<br>${adjs} &nbsp;|&nbsp; <b class="c-gold font-serif fs-9">ECL MOD</b> +${eclShown}<br><span class="fs-12">${r.notes||''}</span>`;
  // v8.1.1: apply the race's attribute adjustments to the input fields,
  // reversing any previously-applied racial mod first to keep base scores stable.
  applyRaceAdjustments(raceName);
  // v8.3.5: populate the dedicated Racial NAC field (read-only, race-derived).
  // Racial NAC is ALWAYS the race's structured natAC value — even on edit,
  // because it's a property of the race, not a player choice. If the player
  // changes race, the field follows. The Bonus NAC field is preserved
  // across edits since it represents player-chosen magic/equipment.
  const racialNAC = r.natAC || 0;
  const racialEl = document.getElementById('c-racial-nac');
  if (racialEl) racialEl.value = racialNAC;
  // Legacy c-natural-ac hidden field: keep in sync as racial + bonus until
  // all consumers are migrated. updateDerived() also writes this on each
  // field change; this race-change handler just ensures it's correct on
  // race switches.
  const bonusEl = document.getElementById('c-bonus-nac');
  const bonusNAC = bonusEl ? (parseInt(bonusEl.value) || 0) : 0;
  const legacyEl = document.getElementById('c-natural-ac');
  if (legacyEl) legacyEl.value = racialNAC + bonusNAC;
  // Re-compute derived stats now that attributes may have shifted
  updateDerived();
}
// ========== STARTING OCCUPATIONS (v8.1.4) ==========
// Starting Occupation is permanent — set at character creation. The Moonlighter
// feat (or rolling 00 on the random Occupation chart) grants a SECOND Starting
// Occupation. Both contribute their auto-class-skill effect via isClassSkill().
// On the edit-character flow, occupations are locked by default and require an
// "Edit (GM)" click to override (which logs a GM exception).
let occupationsUnlocked = false;
function lockOccupations(){
  occupationsUnlocked = false;
  document.getElementById('c-occ').style.display = 'none';
  document.getElementById('c-occ-readonly').style.display = 'block';
  updateOccupationDisplay();
}
async function unlockOccupations(){
  if (!(await confirmModal('Starting Occupation is fixed at character creation. Allow GM override to change it?\n\n(A GM exception entry will be added to the character if the value is actually changed.)'))) return;
  occupationsUnlocked = true;
  // Capture current value to detect actual change later
  document.getElementById('c-occ').dataset.original = document.getElementById('c-occ').value;
  document.getElementById('c-occ2').dataset.original = document.getElementById('c-occ2').value;
  document.getElementById('c-occ').style.display = '';
  document.getElementById('c-occ-readonly').style.display = 'none';
  // v8.2.1: re-render the picker so it switches from read-only display to
  // interactive dropdowns.
  renderOccupationPicker('primary');
  renderOccupationPicker('secondary');
  updateOccupationPicksWarning();
}




// we render its skill choices (pick N from the list) and any bonus feat options.
// State is held on `formOccupationPicks` and committed to c.occupationPicks
// on save. Each occupation contributes:
//   - N skill choices → become class skills, or grant +1 competence if already
//     class skills via another route
//   - An optional bonus feat → added to c.feats with origin:'occupation:<Name>'
//   - Wealth Bonus and (rarely) Reputation modifiers (tracked but not yet
//     surfaced in v8.2.1 since the Wealth/Reputation tracker is v9 scope)

// v8.2.2 (Issue 1): The Second Occupation row is hidden by default, surfaced
// only when the character has the Moonlighter feat (or, for legacy chars,
// when a second occupation is already populated on the saved record).
//
// Design philosophy: Moonlighter is a "hidden gem" — the second-occupation
// option should be discovered through the Feats tab, not advertised on the
// create form. Showing the field unconditionally puts visual weight on an
// option ~95% of characters won't use, AND it spoils the surprise of finding
// Moonlighter in the feats list.
//
// On NEW character creation (editId is null): hidden, since no feats are
//   picked yet. Players must save, pick Moonlighter from the Feats tab, then
//   edit the character to access the Second Occupation field.
// On EDIT (editId set): shown if Moonlighter is in c.feats, OR if a
//   second occupation was already saved (legacy compatibility).
function shouldShowSecondOccupation(){
  const row = document.getElementById('c-occ2-row');
  if (!row) return false;
  // No edit context = new character. Never show.
  if (!editId) return false;
  const c = chars.find(x => x.id === editId);
  if (!c) return false;
  // Legacy/persisted: if a second occupation is already saved, surface it
  // so the player can see (and re-edit if Moonlighter is also present).
  if (c.occupations && c.occupations[1]) return true;
  // Otherwise: only if Moonlighter is on the character.
  return (c.feats||[]).some(f => (f.name||f.n) === 'Moonlighter');
}

function applySecondOccupationVisibility(){
  const row = document.getElementById('c-occ2-row');
  if (!row) return;
  row.style.display = shouldShowSecondOccupation() ? '' : 'none';
}
// populated from c.occupationPicks on editCurrentChar(), or freshly created
// when an occupation is first chosen.
let formOccupationPicks = {primary:{skills:[], bonusFeat:null}, secondary:{skills:[], bonusFeat:null}};
// v8.2.1: track which occupation each slot's picks were made FOR. When the
// dropdown is changed to a different occupation, the picks are no longer
// valid (different skill_list) and must be reset.
let formOccupationPicksFor = {primary:null, secondary:null};

function updateOccupationDisplay(){
  const occ1 = document.getElementById('c-occ')?.value || '';
  const occ2 = document.getElementById('c-occ2')?.value || '';
  const readEl = document.getElementById('c-occ-readonly-text');
  if (readEl) {
    readEl.textContent = occ2 ? `${occ1} + ${occ2} (Moonlighter)` : occ1;
  }
  // v8.2.1: detect occupation change and reset picks for that slot. Only
  // applies when occupations are unlocked (editing locked occupations is
  // gated behind the GM unlock anyway).
  if (occupationsUnlocked) {
    if (formOccupationPicksFor.primary !== null && formOccupationPicksFor.primary !== occ1) {
      formOccupationPicks.primary = {skills:[], bonusFeat:null};
    }
    if (formOccupationPicksFor.secondary !== null && formOccupationPicksFor.secondary !== occ2) {
      formOccupationPicks.secondary = {skills:[], bonusFeat:null};
    }
    formOccupationPicksFor.primary   = occ1;
    formOccupationPicksFor.secondary = occ2;
  }
  renderOccupationPicker('primary');
  renderOccupationPicker('secondary');
  updateOccupationPicksWarning();
}

// Render the picker section for one occupation slot.
function renderOccupationPicker(slot){
  const dropdownId = slot === 'primary' ? 'c-occ' : 'c-occ2';
  const pickerId   = slot === 'primary' ? 'c-occ-picker' : 'c-occ2-picker';
  const dropdown = document.getElementById(dropdownId);
  const picker = document.getElementById(pickerId);
  if (!dropdown || !picker) return;
  const occName = dropdown.value || '';
  // Hide picker when no occupation selected (esp. secondary "— None —")
  if (!occName) {
    picker.style.display = 'none';
    picker.innerHTML = '';
    return;
  }
  const occ = getOccupationData(occName);
  if (!occ) {
    picker.style.display = 'block';
    picker.innerHTML = `<div class="fs-11 c-red-text p-6-8 rounded-3" style="background:rgba(212,112,112,.08);">No occupation data for "${escapeHTML(occName)}".</div>`;
    return;
  }
  const picks = formOccupationPicks[slot] || (formOccupationPicks[slot] = {skills:[], bonusFeat:null});

  // v8.2.1: when occupations are locked (editing a saved character), render a
  // read-only display rather than an interactive picker. Matches the existing
  // c-occ-readonly UI for the dropdown — the "⚿ Edit (GM)" button unlocks both.
  if (!occupationsUnlocked) {
    return renderOccupationPickerReadonly(slot, occ, picks);
  }

  // Build the skill picker rows. Each pick is its own <select>, populated
  // with the occupation's skill_list. Already-picked skills in other slots
  // (within the same occupation) are visually marked as taken so the player
  // doesn't pick the same one twice.
  const skillCount = occ.skill_count || 0;
  const rawSkillList  = occ.skill_list  || [];
  // v8.3.6 / v8.3.7: List entry normalization for player display.
  //
  // Handbook entries take three shapes:
  //   1. Atomic: 'Diplomacy', 'Drive' — single skill, leave as-is.
  //   2. Comma-list (v8.3.6): 'Knowledge (Civics, Earth & Life Sciences, ...)'
  //      — expand to N entries 'Knowledge (Civics)', etc.
  //   3. "Any" sentinel (v8.3.7): 'Knowledge: Any', 'Knowledge (Any)',
  //      'Craft (Any)', 'Perform (Any)' — expand to ALL SKILLS entries in
  //      that family. Used by Academic, Heir, Student, Technician.
  //
  // The picker presents each EXPANDED option distinctly so the player picks
  // one specific specialization. The handbook intent is "pick one from this
  // family," not "all of these become class skills."
  const skillList = [];
  for (const entry of rawSkillList) {
    // Shape 3: "Family: Any" or "Family (Any)" — expand to all family members
    const anyMatch = entry.match(/^([A-Za-z][A-Za-z ]*?)\s*(?::\s*Any|\(\s*Any\s*\))$/);
    if (anyMatch) {
      const family = anyMatch[1].trim();
      const familyMembers = SKILLS.filter(sk => sk.family === family).map(sk => sk.n);
      if (familyMembers.length > 0) {
        for (const member of familyMembers) skillList.push(member);
        continue;
      }
      // Fall through — keep original entry; harmless, just won't match anything
    }
    // Shape 2: "Family (Spec1, Spec2, ...)" — expand comma-list
    const parenMatch = entry.match(/^(.+?) \((.+)\)$/);
    if (parenMatch) {
      const base = parenMatch[1].trim();
      const specsRaw = parenMatch[2];
      // Skip "Any" already handled above (safety in case the anyMatch missed)
      if (/^\s*Any\s*$/i.test(specsRaw)) {
        skillList.push(entry);
        continue;
      }
      const specs = specsRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (specs.length === 1) {
        skillList.push(entry);
      } else {
        for (const spec of specs) skillList.push(`${base} (${spec})`);
      }
      continue;
    }
    // Shape 1: atomic
    skillList.push(entry);
  }
  const rows = [];
  // v8.3.17: Pull current Six Scales and gate state. In 'locked' mode we
  // strictly disable scenario-incompatible options. In 'sandbox' we annotate
  // them but allow selection. In 'awaiting' (shouldn't happen since panels
  // are disabled), treat like sandbox.
  const sl = getSixLevels();
  const enforceGate = (gateState === 'locked');
  rows.push(`<div class="fs-11 c-g70 mb-4 ls-0_04em uppercase">Choose ${skillCount} skill${skillCount===1?'':'s'} from the list <span class="c-g45 fs-10 normal-case ls-0">(if already a class skill via another route, +1 competence bonus instead)</span></div>`);
  // v8.5.4: live class-overlap annotation. With Occupation ahead of Classes
  // in the flow (Adam's chronological ordering), the picker marks options
  // that are ALREADY class skills through the currently-chosen classes
  // (sub-options included) — such picks become a +1 competence bonus rather
  // than a new class skill. renderClassList re-renders these pickers when
  // classes change, so the marks stay live in both directions.
  const overlapCtx = {classes: formClasses, occupations: [], feats: [],
    druidOption: formSubOptions.druidOption, psionDiscipline: formSubOptions.psionDiscipline};
  const overlaps = (s) => formClasses.length > 0 && getClassSkillSources(s, overlapCtx).length > 0;
  for (let i = 0; i < skillCount; i++) {
    const selected = picks.skills[i] || '';
    const taken = new Set(picks.skills.filter((s, j) => j !== i && s));
    const opts = ['<option value="">— pick skill —</option>'].concat(
      skillList.map(s => {
        const isTaken = taken.has(s);
        // v8.3.17: scenario-gate check. The SKILLS table carries an optional
        // `req` field like "Tech 3+" for Six-Level-gated skills; meetsSkillReq
        // returns false when the current Six Scales don't satisfy it.
        const skMeta = SKILLS.find(sk => sk.n === s);
        const gateBlocked = skMeta && skMeta.req && !meetsSkillReq(skMeta, sl);
        // In locked mode, gate-blocked options are disabled. In sandbox we
        // annotate but allow (player can still pick, and the conflict will
        // be flagged at lock time).
        const disabled = isTaken || (enforceGate && gateBlocked) ? 'disabled' : '';
        const sel = (s === selected) ? 'selected' : '';
        let label = s;
        if (isTaken) label += ' (taken)';
        else if (gateBlocked) label = '⊘ ' + label + ` (requires ${skMeta.req})`;
        else if (overlaps(s)) label += ' • class skill → +1 competence';
        return `<option value="${escapeHTML(s)}" ${sel} ${disabled}>${escapeHTML(label)}</option>`;
      })
    ).join('');
    rows.push(`<div class="mb-5"><select onchange="onOccupationPickChange('${slot}','skill',${i},this.value)" class="w-full fs-12">${opts}</select></div>`);
  }
  // Bonus feat picker, if applicable
  if (occ.bonus_feat_options && occ.bonus_feat_options.length) {
    const selected = picks.bonusFeat || '';
    const opts = ['<option value="">— pick bonus feat —</option>'].concat(
      occ.bonus_feat_options.map(f => {
        const sel = (f === selected) ? 'selected' : '';
        // v8.3.17: scenario-gate check on bonus feat options. Check if any
        // prereq group is fully unmet due to a sixLevel requirement.
        const featMeta = FEATS_DB.find(ft => ft.n === f);
        let gateBlocked = false;
        let gateReason = '';
        if (featMeta && featMeta.prereqs) {
          // A feat passes if AT LEAST ONE prereq group is fully met. So it
          // fails the gate ONLY if EVERY group has a sixLevel prereq that
          // isn't satisfied. (Other prereq types don't gate-block here —
          // they're checked separately at feat-application time.)
          const allGroupsFail = featMeta.prereqs.every(group => {
            return group.some(p => p.type === 'sixLevel' && (sl[p.axis] || 0) < p.min);
          });
          if (allGroupsFail) {
            gateBlocked = true;
            // Surface the first sixLevel prereq's description.
            const firstGroup = featMeta.prereqs.find(g => g.some(p => p.type === 'sixLevel'));
            const slPrereq = firstGroup && firstGroup.find(p => p.type === 'sixLevel');
            if (slPrereq) gateReason = `${slPrereq.axis} ${slPrereq.min}+`;
          }
        }
        const disabled = (enforceGate && gateBlocked) ? 'disabled' : '';
        let label = f;
        if (gateBlocked) label = '⊘ ' + label + ` (requires ${gateReason})`;
        return `<option value="${escapeHTML(f)}" ${sel} ${disabled}>${escapeHTML(label)}</option>`;
      })
    ).join('');
    rows.push(`<div class="fs-11 c-g70 ls-0_04em uppercase" style="margin:8px 0 4px 0;">Bonus Feat — pick one</div>`);
    rows.push(`<div><select onchange="onOccupationPickChange('${slot}','feat',null,this.value)" class="w-full fs-12">${opts}</select></div>`);
  }
  // Wealth + Reputation summary
  const meta = [];
  if (occ.wealth != null) meta.push(`Wealth ${occ.wealth>=0?'+':''}${occ.wealth}`);
  if (occ.reputation != null) meta.push(`Reputation ${occ.reputation>=0?'+':''}${occ.reputation}`);
  if (occ.prereq_other) meta.push(`<span class="c-g55">requires ${escapeHTML(occ.prereq_other)}</span>`);
  if (meta.length) {
    rows.push(`<div class="fs-10 c-g55 mt-6" style="letter-spacing:.02em;">${meta.join(' &middot; ')}</div>`);
  }
  picker.style.display = 'block';
  picker.innerHTML = `<div class="rounded-3 p-8-10" style="background:rgba(200,151,30,.04);border:1px solid rgba(200,151,30,.18);">${rows.join('')}</div>`;
}

// Read-only display of an occupation's picks. Used when the occupation is
// locked (editing a saved character). Shows the same info but as plain text.
function renderOccupationPickerReadonly(slot, occ, picks){
  const pickerId = slot === 'primary' ? 'c-occ-picker' : 'c-occ2-picker';
  const picker = document.getElementById(pickerId);
  const rows = [];
  const skillsPicked = (picks.skills||[]).filter(s => !!s);
  if (skillsPicked.length) {
    rows.push(`<div class="fs-11 c-g65"><b class="c-gold">Class Skills:</b> ${escapeHTML(skillsPicked.join(', '))}</div>`);
  } else if (occ.skill_count) {
    rows.push(`<div class="fs-11" style="color:#d4b870;"><b>⚠ Skill picks pending</b> — ${occ.skill_count} skill${occ.skill_count===1?'':'s'} not yet selected from the ${occ.n} occupation list. Unlock with ⚿ Edit (GM) to fill them in.</div>`);
  }
  if (picks.bonusFeat) {
    rows.push(`<div class="fs-11 c-g65 mt-4"><b class="c-gold">Bonus Feat:</b> ${escapeHTML(picks.bonusFeat)}</div>`);
  } else if (occ.bonus_feat_options && occ.bonus_feat_options.length) {
    rows.push(`<div class="fs-11 mt-4" style="color:#d4b870;"><b>⚠ Bonus feat pending</b> — pick one from: ${occ.bonus_feat_options.map(escapeHTML).join(', ')}. Unlock with ⚿ Edit (GM) to choose.</div>`);
  }
  if (!rows.length) {
    picker.style.display = 'none';
    picker.innerHTML = '';
    return;
  }
  picker.style.display = 'block';
  picker.innerHTML = `<div class="rounded-3 p-7-10" style="background:rgba(200,151,30,.04);border:1px solid rgba(200,151,30,.18);">${rows.join('')}</div>`;
}

// Called by each pick-select's onchange.
function onOccupationPickChange(slot, kind, idx, value){
  const picks = formOccupationPicks[slot] || (formOccupationPicks[slot] = {skills:[], bonusFeat:null});
  if (kind === 'skill') {
    // Ensure picks.skills is sized correctly
    while (picks.skills.length <= idx) picks.skills.push('');
    picks.skills[idx] = value || '';
  } else if (kind === 'feat') {
    picks.bonusFeat = value || null;
  }
  // Re-render the picker so "taken" labels update on neighboring dropdowns.
  renderOccupationPicker(slot);
  updateOccupationPicksWarning();
}

// Show a "⚠ skill picks pending" indicator next to each occupation label when
// the current picks are incomplete (fewer non-empty skills than required).
function updateOccupationPicksWarning(){
  const checkSlot = (slot, occId, warnId) => {
    const dropdown = document.getElementById(occId);
    const warn = document.getElementById(warnId);
    if (!dropdown || !warn) return;
    const occName = dropdown.value || '';
    if (!occName) { warn.style.display = 'none'; return; }
    const occ = getOccupationData(occName);
    if (!occ) { warn.style.display = 'none'; return; }
    const picks = formOccupationPicks[slot] || {skills:[], bonusFeat:null};
    const need = occ.skill_count || 0;
    const have = (picks.skills || []).filter(s => !!s).length;
    const needFeat = !!(occ.bonus_feat_options && occ.bonus_feat_options.length);
    const haveFeat = !!picks.bonusFeat;
    if (have < need || (needFeat && !haveFeat)) {
      warn.style.display = 'inline';
    } else {
      warn.style.display = 'none';
    }
  };
  checkSlot('primary',   'c-occ',  'c-occ-picks-warn');
  checkSlot('secondary', 'c-occ2', 'c-occ2-picks-warn');
}

// Populate the race <select> from the RACES table. Groups races into Core / Foe Folio / Catch-all
// optgroups so the long combined list is easier to scan.
function populateRaceDropdown(){
  const sel=document.getElementById('c-race');
  if(!sel)return;
  // The 9 core races from the Hero's Handbook (those defined first in the RACES table)
  const coreNames = new Set(['Human','Dromite','Drow','Duergar','Dwarf','Elan','Elf','Gnome','Halfling']);
  // v8.68.2 (Adam's field report): 'Mutant/Hybrid' is LEGACY-ONLY — new
  // characters never see it (Mutant = base race + the Mutations tab; the
  // edit flow re-adds the option dynamically for records that carry it).
  // 'Hybrid' moves out of the Foe Folio shelf into its own group.
  const legacyOnly = new Set(['Mutant/Hybrid']);
  const catchAll  = new Set(['Hybrid','Other']);
  const allNames  = Object.keys(RACES);
  const ff        = allNames.filter(n => !coreNames.has(n) && !catchAll.has(n) && !legacyOnly.has(n)).sort();
  const mkOpt = n => `<option value="${n}">${n}</option>`;
  sel.innerHTML =
    `<optgroup label="Core (Hero's Handbook)">${[...coreNames].map(mkOpt).join('')}</optgroup>`+
    `<optgroup label="Foe Folio (Tier 1)">${ff.map(mkOpt).join('')}</optgroup>`+
    `<optgroup label="Half-Blood &amp; Custom">${[...catchAll].map(mkOpt).join('')}</optgroup>`;
}

