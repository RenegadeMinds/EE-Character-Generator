// =============================================================================
// js/ui/create/scenario-and-layout.js
// CREATE / SCENARIO AND LAYOUT — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Create page: the Six Scales lock gate, scenario
//   presets and title, and the collapsible section layout.
//
// KEY NAMES (so you can search for them)
//   tables and state: gateState, _GATE_DOWNSTREAM_PANELS, CREATE_SECTIONS
//   functions (29): applyGateState, lockSixLevels, enterSandboxMode,
//   unlockSixLevels, detectLockConflicts, renderSixLevelsGrid,
//   createSectionSummary, toggleCreateSection, gotoCreateSection,
//   initCreateAccordion, expandAllCreateSections, getSixLevels,
//   applyScenarioPreset, promptScenarioPresetChange, onSixLevelChange,
//   promptSixLevelChange, cancelSixLevelChange, confirmSixLevelChange,
//   promptFirstSaveSixLevels, cancelFirstSaveSixLevels,
//   confirmFirstSaveSixLevels, updateSixLevelsSummary,
//   updateScenarioTitleDisplay, onScenarioTitleOverride,
//   onScenarioTitleSaveEdit, onScenarioTitleCancelEdit,
//   _exitScenarioTitleEditMode, onScenarioTitleRegenerate,
//   getCurrentScenarioTitle
//
// WHERE IT CAME FROM
//   Gathered from js/app/44-create-scenario-gate-and-layout.js when the code
//   was regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== SIX SCALES (SCENARIO SETTINGS) ==========
// Build the Six Scales grid as 6 select dropdowns, with current values + tier descriptions
// ========== v8.3.17: SCENARIO LOCK GATE ==========
// The Six Scales are upstream of race, class, occupation, and skill choices —
// they gate which races/classes exist, and which skills/feats Starting
// Occupation can grant. The gate enforces that the player commits to a
// scenario before making those downstream choices, OR explicitly opts into
// Sandbox Mode (exploration without validation).
//
// States: 'awaiting' (initial), 'sandbox' (exploring), 'locked' (committed).
// The state is stored on the form-scope variable `gateState`. It does NOT
// persist to the saved character — what persists is c.sixLevels (the values).
// On loading an existing character, the gate is auto-set to 'locked' since
// those characters already have committed Six Scales.
let gateState = 'awaiting';  // 'awaiting' | 'sandbox' | 'locked'

// Selectors for the downstream panels that depend on Six Scales.
// When gate is 'awaiting', these panels are visually disabled and inputs
// don't accept input. When 'sandbox' or 'locked', they're fully editable.
const _GATE_DOWNSTREAM_PANELS = ['identity-panel', 'attrs-panel', 'classes-panel', 'occupation-panel', 'derived-panel'];  // v8.5.4: occupation-panel joins the gate (relocated section)

// Set the visual + interaction state of the form to match gateState.
function applyGateState() {
  const lockBtn    = document.getElementById('six-levels-lock-btn');
  const sandboxBtn = document.getElementById('six-levels-sandbox-btn');
  const unlockBtn  = document.getElementById('six-levels-unlock-btn');
  const pill       = document.getElementById('six-levels-status-pill');
  const helpText   = document.getElementById('six-levels-gate-help');
  if (!lockBtn || !sandboxBtn || !unlockBtn || !pill) return;

  // Pill: status indicator on the Six Scales panel header.
  if (gateState === 'awaiting') {
    pill.textContent = 'Awaiting Lock or Sandbox';
    pill.style.background = 'rgba(212,184,112,.15)';
    pill.style.color = '#d4b870';
    pill.style.border = '1px solid rgba(212,184,112,.4)';
  } else if (gateState === 'sandbox') {
    pill.textContent = '⚡ Sandbox Mode';
    pill.style.background = 'rgba(196,153,212,.15)';
    pill.style.color = '#c499d4';
    pill.style.border = '1px solid rgba(196,153,212,.4)';
  } else if (gateState === 'locked') {
    pill.textContent = '🔒 Official';
    pill.style.background = 'rgba(125,170,220,.15)';
    pill.style.color = '#7daadc';
    pill.style.border = '1px solid rgba(125,170,220,.4)';
  }

  // Buttons: show Lock+Sandbox before commitment, Unlock after.
  if (gateState === 'awaiting') {
    lockBtn.style.display = '';
    sandboxBtn.style.display = '';
    unlockBtn.style.display = 'none';
    if (helpText) helpText.textContent = 'Lock to enable race, class, and occupation choices below — or use sandbox to explore.';
  } else if (gateState === 'sandbox') {
    lockBtn.style.display = '';
    sandboxBtn.style.display = 'none';
    unlockBtn.style.display = 'none';
    if (helpText) helpText.textContent = 'Sandbox mode: choices below are unvalidated. Lock to commit to a scenario.';
  } else if (gateState === 'locked') {
    lockBtn.style.display = 'none';
    sandboxBtn.style.display = 'none';
    unlockBtn.style.display = '';
    if (helpText) helpText.textContent = 'Scenario locked. Click Unlock to change scenario settings.';
  }

  // Downstream panel disable/enable. We use a wrapper overlay + pointer-events
  // disable rather than disabling every input individually, since the form has
  // many inputs spread across multiple panels.
  for (const pid of _GATE_DOWNSTREAM_PANELS) {
    const panel = document.getElementById(pid);
    if (!panel) continue;
    if (gateState === 'awaiting') {
      panel.style.opacity = '0.4';
      panel.style.pointerEvents = 'none';
      panel.style.filter = 'grayscale(40%)';
    } else {
      panel.style.opacity = '';
      panel.style.pointerEvents = '';
      panel.style.filter = '';
    }
  }

  // Sandbox banner: appears once on the first downstream panel, removed on lock.
  let banner = document.getElementById('sandbox-banner');
  if (gateState === 'sandbox') {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sandbox-banner';
      banner.style.cssText = 'background:rgba(196,153,212,.08);border:1px solid rgba(196,153,212,.35);border-radius:3px;padding:8px 12px;margin:0 0 .75rem 0;font-size:12px;color:var(--vio);font-style:italic;line-height:1.5;';
      banner.innerHTML = '⚡ <b>Sandbox Mode active.</b> Choices below are not validated against any specific scenario. When you Lock as Official, any conflicts with the locked scenario will be flagged (your selections will not be auto-modified).';
      const idPanel = document.getElementById('identity-panel');
      if (idPanel && idPanel.parentNode) {
        idPanel.parentNode.insertBefore(banner, idPanel);
      }
    }
  } else if (banner) {
    // Guard against test environments where DOM doesn't fully implement .remove()
    if (typeof banner.remove === 'function') banner.remove();
    else if (banner.parentNode && typeof banner.parentNode.removeChild === 'function') {
      try { banner.parentNode.removeChild(banner); } catch (e) {}
    }
  }
}

// Player clicked "Lock as Official". Validate current Six Scales are non-empty
// (any are valid; 0s are valid), commit, set gate to 'locked', validate any
// pre-existing downstream choices that are now in conflict.
async function lockSixLevels() {
  const sl = getSixLevels();
  // From sandbox → locked: check for conflicts against current downstream
  // choices and warn the player BEFORE committing. They can cancel.
  if (gateState === 'sandbox') {
    const conflicts = detectLockConflicts(sl);
    if (conflicts.length > 0) {
      const msg = 'The following choices conflict with the scenario you are about to lock:\n\n' +
                  conflicts.map(c => '  • ' + c).join('\n') + '\n\n' +
                  'Lock anyway? Conflicting selections will remain on the character — you can adjust them after locking. ' +
                  'Click Cancel to stay in Sandbox Mode and revise them first.';
      if (!(await confirmModal(msg))) return;
    }
  }
  gateState = 'locked';
  applyGateState();
  // Trigger re-renders of downstream panels so they reflect the locked scenario.
  // updateOccupationDisplay handles Occupation; updateClassPreview handles
  // class warnings; renderSkills (if visible) updates Six-Level-gated rows.
  try { updateOccupationDisplay(); } catch (e) {}
  try { updateClassPreview(); } catch (e) {}
  try { updateRaceInfo(); } catch (e) {}
  // v8.5.4 ergo C2: a locked scenario is "done" — collapse §I to its
  // one-line summary (title + lock pill) so the flow starts at Identity.
  try { toggleCreateSection('six-levels-panel', true); } catch (e) {}
  toast('Scenario locked. Downstream choices now validate against these Six Scales.');
}

// Player clicked "Use Sandbox Mode". No commitment yet; downstream panels
// become editable but a banner reminds them validation is off.
function enterSandboxMode() {
  gateState = 'sandbox';
  applyGateState();
  toast('Sandbox Mode: explore freely. Lock when ready to commit.');
}

// Player clicked "Unlock & Edit" from the locked state. Confirmation modal
// warns that downstream choices may need re-checking after the scenario
// changes.
async function unlockSixLevels() {
  if (gateState !== 'locked') return;
  const msg = 'Unlocking returns you to Sandbox Mode. Any downstream choices ' +
              '(race, class, occupation skills, etc.) that depended on the ' +
              'currently-locked scenario will become unvalidated and may ' +
              'become invalid if you change Six Scales. Continue?';
  if (!(await confirmModal(msg))) return;
  gateState = 'sandbox';
  applyGateState();
  try { toggleCreateSection('six-levels-panel', false); } catch (e) {}  // re-expand §I (C2)
  toast('Scenario unlocked. Sandbox Mode active — make changes as needed.');
}

// Detect downstream choices that would conflict with the about-to-be-locked
// Six Scales. Returns an array of human-readable conflict descriptions, empty
// if no conflicts.
function detectLockConflicts(sl) {
  const conflicts = [];
  // Class conflicts: any formClasses entry that the scenario disallows.
  try {
    const disallowed = disabledClassesForScenario(sl);
    for (const e of (formClasses || [])) {
      if (disallowed.has(e.name)) {
        conflicts.push(`Class "${e.name}" is not available in this scenario`);
      }
    }
  } catch (e) {}
  // Occupation skill picks: any picked skill that requires a Six Level the
  // about-to-lock scenario doesn't meet.
  try {
    for (const slot of ['primary', 'secondary']) {
      const picks = (formOccupationPicks || {})[slot];
      if (!picks || !picks.skills) continue;
      for (const skName of picks.skills) {
        if (!skName) continue;
        const sk = SKILLS.find(s => s.n === skName);
        if (sk && sk.req && !meetsSkillReq(sk, sl)) {
          conflicts.push(`Occupation skill pick "${skName}" requires ${sk.req}`);
        }
      }
    }
  } catch (e) {}
  // Feat selections on the form: defer to feat prereq machinery if available.
  // Currently the form picks feats via the Feats tab post-save, so unless the
  // player has chosen a Starting Occupation bonus feat that violates a Six
  // Level, there's nothing here yet. Bonus feat check:
  try {
    for (const slot of ['primary', 'secondary']) {
      const picks = (formOccupationPicks || {})[slot];
      if (!picks || !picks.bonusFeat) continue;
      const feat = FEATS_DB.find(f => f.n === picks.bonusFeat);
      if (!feat || !feat.prereqs) continue;
      // Quick check: any prereq group with a sixLevel requirement that fails?
      const failsSomeGroup = feat.prereqs.some(group =>
        group.some(p => p.type === 'sixLevel' && (sl[p.axis] || 0) < p.min)
      );
      if (failsSomeGroup) {
        conflicts.push(`Occupation bonus feat "${picks.bonusFeat}" has a scenario prerequisite`);
      }
    }
  } catch (e) {}
  return conflicts;
}

function renderSixLevelsGrid(){
  const grid=document.getElementById('six-levels-grid');
  if(!grid)return;
  const axes=['arcane','divine','heroic','mutation','psionic','tech'];
  grid.innerHTML=axes.map(axis=>{
    const def=SIX_LEVELS[axis];
    // v8.5.4 ergo: the 60-char cap used to cut labels MID-WORD with no
    // ellipsis ("…all chars ge"); now trims at a word boundary with an
    // ellipsis, and the full tier text rides on the option tooltip.
    const opts=def.tiers.map((t,i)=>{
      const full=t.split(' — ')[0].replace(/^.*?: /,'');
      const short=full.length>60?full.slice(0,59).replace(/\s+\S*$/,'')+'…':full;
      return`<option value="${i}" title="${escapeHTML(t)}">${i} — ${escapeHTML(short)}</option>`;
    }).join('');
    return`<div class="fr"><label title="${def.desc}">${def.label}</label>
      <select id="c-sl-${axis}" onchange="onSixLevelChange('${axis}')">${opts}</select></div>`;
  }).join('');
}
// ========== v8.5.4 ergo C2: create-flow accordion + sticky mini-nav ==========
// Every §I–VI header is click-to-collapse (chevron + inline one-line summary
// when closed); §I auto-collapses on Lock/Sandbox and re-expands on Unlock.
// The sticky mini-nav jumps to (and re-expands) any section. Default state is
// everything expanded — no behavior change until the player interacts.
const CREATE_SECTIONS = [
  {id:'six-levels-panel', num:'I',   label:'Scenario'},
  {id:'identity-panel',   num:'II',  label:'Identity'},
  {id:'attrs-panel',      num:'III', label:'Abilities'},
  {id:'occupation-panel', num:'IV',  label:'Occupation'},
  {id:'classes-panel',    num:'V',   label:'Classes'},
  {id:'derived-panel',    num:'VI',  label:'Derived'},
];
function createSectionSummary(id){
  try{
    if(id==='six-levels-panel'){
      const t=document.getElementById('scenario-title-display')?.textContent||'';
      const pill=document.getElementById('six-levels-status-pill')?.textContent||'';
      return [t,pill].filter(Boolean).join(' · ');
    }
    if(id==='identity-panel'){
      const bits=[document.getElementById('c-name')?.value, document.getElementById('c-race')?.value, document.getElementById('c-align')?.value];
      return bits.filter(Boolean).join(' · ');
    }
    if(id==='attrs-panel'){
      const a=getAttrs();
      return a?`STR ${a[0]} · DEX ${a[1]} · CON ${a[2]} · INT ${a[3]} · WIS ${a[4]} · CHA ${a[5]}`:'';
    }
    if(id==='occupation-panel') return document.getElementById('c-occ')?.value||'';
    if(id==='classes-panel'){
      const fc=formClasses;
      return fc.length?fc.map(e=>`${e.name} ${e.level}`).join(' / '):'no classes yet';
    }
    if(id==='derived-panel') return '';
  }catch(e){}
  return '';
}
function toggleCreateSection(id, forceCollapsed){
  const panel=document.getElementById(id); if(!panel) return;
  const collapse=(forceCollapsed!==undefined)?forceCollapsed:!panel.classList.contains('c-collapsed');
  panel.classList.toggle('c-collapsed', collapse);
  const chev=panel.querySelector('.c-chev'); if(chev) chev.textContent=collapse?'▸':'▾';
  const sum=panel.querySelector('.c-summary');
  if(sum) sum.textContent=collapse?createSectionSummary(id):'';
}
function gotoCreateSection(id){
  toggleCreateSection(id,false);
  const panel=document.getElementById(id);
  if(panel&&panel.scrollIntoView) panel.scrollIntoView({block:'start',behavior:'smooth'});
}
function initCreateAccordion(){
  for(const s of CREATE_SECTIONS){
    const panel=document.getElementById(s.id); if(!panel) continue;
    const head=panel.querySelector('.sec-head'); if(!head||head.querySelector('.c-chev')) continue;
    head.insertAdjacentHTML('beforeend','<span class="c-summary"></span><span class="c-chev">▾</span>');
    head.addEventListener('click',(ev)=>{
      // ignore clicks on interactive things living inside the header (pills are inert, but be safe)
      if(ev.target.closest('button,select,input,a')) return;
      toggleCreateSection(s.id);
    });
    head.title='Click to collapse/expand this section';
  }
  const page=document.getElementById('page-create');
  if(page&&!document.getElementById('create-mini-nav')){
    const nav=document.createElement('div');
    nav.id='create-mini-nav';
    nav.innerHTML='<span style="font-family:\'Epics Serif\',\'Cinzel\',serif;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--g55);margin-right:4px;">Sections</span>'
      +CREATE_SECTIONS.map(s=>`<button type="button" onclick="gotoCreateSection('${s.id}')" title="${s.label}">${s.num}. ${s.label}</button>`).join('');
    page.insertBefore(nav, page.firstElementChild);
  }
}
// Expand everything (used when loading a character for edit, so nothing hides).
function expandAllCreateSections(){ for(const s of CREATE_SECTIONS) toggleCreateSection(s.id,false); }

// Get current Six Scales values from the form
function getSixLevels(){
  return {
    arcane: parseInt(document.getElementById('c-sl-arcane')?.value)||0,
    divine: parseInt(document.getElementById('c-sl-divine')?.value)||0,
    heroic: parseInt(document.getElementById('c-sl-heroic')?.value)||0,
    mutation: parseInt(document.getElementById('c-sl-mutation')?.value)||0,
    psionic: parseInt(document.getElementById('c-sl-psionic')?.value)||0,
    tech: parseInt(document.getElementById('c-sl-tech')?.value)||0,
  };
}
// Apply a preset scenario from SCENARIO_PRESETS or the Established Scenarios
// (v8.54.0: routed through scenarioScalesOf; the establish entry opens the
// studio instead of applying anything).
function applyScenarioPreset(){
  const name=document.getElementById('c-scenario-preset').value;
  if (name === '__establish__') { openScenarioStudio('create'); return; }
  const preset=scenarioScalesOf(name);
  if(!preset){ _lastScenSel.create = name; return; } // 'Custom' -> leave the values as they are
  // v8.2.1: on an existing character, a preset change is a multi-axis Six Scales
  // change — fire the same confirmation flow as a single-axis change. Compute
  // the divergence first so we can describe it; if none, apply silently.
  if (editId && editSavedSixLevels) {
    const diffs = [];
    for (const axis of Object.keys(preset)) {
      const newVal = preset[axis];
      const oldVal = editSavedSixLevels[axis]||0;
      if (newVal !== oldVal) diffs.push({axis, oldVal, newVal});
    }
    if (diffs.length) {
      // Stash the FIRST diff in pendingSixLevelChange so the existing confirm/
      // cancel handlers can revert if cancelled. The modal text will summarise
      // all changes. We don't apply the preset until the user confirms.
      promptScenarioPresetChange(name, diffs, preset);
      return;
    }
  }
  for(const axis of Object.keys(preset)){
    const el=document.getElementById('c-sl-'+axis);
    if(el)el.value=preset[axis];
  }
  _lastScenSel.create = name;
  updateSixLevelsSummary();
  updateClassPreview();
  // v8.3.17: refresh occupation picker after preset application.
  try { updateOccupationDisplay(); } catch (e) {}
  // v8.54.0: an OFFICIAL established scenario locks the Six Scales on
  // selection (fresh creation only — editing an existing character keeps
  // the manual lock flow with its confirmation).
  try {
    const cs = customScenarioByName(name);
    if (cs && cs.locked && !editId) lockSixLevels();
  } catch (e) {}
}

// Modal flow for scenario-preset changes on existing characters.
function promptScenarioPresetChange(presetName, diffs, preset){
  // Save the prior preset selection so we can revert on cancel.
  pendingSixLevelChange = {
    isPresetChange: true,
    presetName,
    diffs,
    preset,
    priorPreset: (chars.find(c=>c.id===editId)||{}).scenarioPreset || 'Custom',
  };
  const body = document.getElementById('six-levels-confirm-body');
  const diffLines = diffs.map(d => {
    const def = SIX_LEVELS[d.axis];
    return `<div><b style="color:var(--gold);">${def?.label||d.axis}</b>: ${d.oldVal} → ${d.newVal}</div>`;
  }).join('');
  body.innerHTML = `
    <p style="margin:0 0 .75rem 0;">You're switching to the
      <b style="color:var(--gold);">${escapeHTML(presetName)}</b> scenario preset,
      which changes ${diffs.length} Six Scales axis${diffs.length===1?'':'es'}:</p>
    <div style="font-size:11.5px;padding:.5rem .75rem;background:rgba(200,151,30,.05);border-left:2px solid rgba(200,151,30,.4);margin:0 0 .75rem 0;">
      ${diffLines}
    </div>
    <p style="margin:0 0 .5rem 0;">The Six Scales axes define the scenario's
      fundamental rules. Switching scenarios after a character is created is
      normally reserved for plot-driven moments — a campaign moving from one
      setting to another, a GM retconning the scenario, or a major in-fiction
      shift.</p>
    <p style="margin:0;font-size:12px;color:var(--g70);"><b>Note:</b>
      Existing feats, classes, talents, and other choices that were gated by
      the old values won't be automatically reviewed. You (or your GM) should
      audit the character for newly-invalid choices.</p>
    <p style="margin:.75rem 0 0 0;font-size:12px;color:var(--g85);">
      Confirming will save the character immediately with the new preset.</p>
  `;
  document.getElementById('six-levels-confirm-modal').classList.add('open');
}
// When a single axis changes, drop the preset back to "Custom" and refresh.
// v8.2.1: on an EXISTING character (editId set), changing a Six Scales axis is
// a setting-level event (emergence of magic, awakening of psionics, etc.) —
// fire a confirmation modal that, on confirm, immediately saves the character
// so form-state and saved-state can't diverge (preventing the v8.2.0 bug where
// feat prereqs were evaluated against stale scenario settings).
function onSixLevelChange(axis){
  document.getElementById('c-scenario-preset').value='Custom';
  if (editId && editSavedSixLevels) {
    const sliderEl = document.getElementById('c-sl-'+axis);
    const newVal = parseInt(sliderEl.value)||0;
    const oldVal = editSavedSixLevels[axis]||0;
    if (newVal !== oldVal) {
      // Stash the pending change and show the modal. Don't run downstream
      // updates yet — if the user cancels, we want to revert cleanly.
      promptSixLevelChange({axis, oldVal, newVal, sliderEl});
      return;
    }
  }
  updateSixLevelsSummary();
  updateClassPreview();
  // v8.3.17: re-render occupation picker so its gate-blocked annotations
  // refresh with the new Six Scales values.
  try { updateOccupationDisplay(); } catch (e) {}
}

// Build and show the Six Scales change confirmation modal.
function promptSixLevelChange(change){
  pendingSixLevelChange = change;
  const def = SIX_LEVELS[change.axis];
  const oldDesc = (def?.tiers?.[change.oldVal]) || '(unknown)';
  const newDesc = (def?.tiers?.[change.newVal]) || '(unknown)';
  const body = document.getElementById('six-levels-confirm-body');
  body.innerHTML = `
    <p style="margin:0 0 .75rem 0;">You're changing the
      <b style="color:var(--gold);">${def?.label || change.axis}</b> axis from
      <b>${change.oldVal}</b> to <b>${change.newVal}</b>.</p>
    <div style="font-size:11.5px;padding:.5rem .75rem;background:rgba(200,151,30,.05);border-left:2px solid rgba(200,151,30,.4);margin:0 0 .75rem 0;">
      <div style="margin-bottom:.4rem;"><b>From ${change.oldVal}:</b> ${escapeHTML(oldDesc)}</div>
      <div><b>To ${change.newVal}:</b> ${escapeHTML(newDesc)}</div>
    </div>
    <p style="margin:0 0 .5rem 0;">The Six Scales axes define the scenario's
      fundamental rules. Changing one after a character is created is normally
      reserved for plot-driven moments — the emergence of magic, the awakening
      of psionics, a technological revolution, or a GM retconning a setting
      fact.</p>
    <p style="margin:0;font-size:12px;color:var(--g70);"><b>Note:</b>
      Existing feats, classes, talents, and other choices that were gated by
      the old value won't be automatically reviewed. You (or your GM) should
      audit the character for newly-invalid choices.</p>
    <p style="margin:.75rem 0 0 0;font-size:12px;color:var(--g85);">
      Confirming will save the character immediately with the new value.</p>
  `;
  document.getElementById('six-levels-confirm-modal').classList.add('open');
}

// Cancel: revert the slider (single-axis) or preset selector (multi-axis)
// to the saved value(s), dismiss modal, no save.
function cancelSixLevelChange(){
  if (pendingSixLevelChange) {
    if (pendingSixLevelChange.isPresetChange) {
      // Revert the preset dropdown to its prior value
      document.getElementById('c-scenario-preset').value =
        pendingSixLevelChange.priorPreset;
      // Slider values were never updated (we modal-gate before applying),
      // so no slider revert is needed for the preset path.
    } else {
      pendingSixLevelChange.sliderEl.value = pendingSixLevelChange.oldVal;
    }
    // After revert, the form is back in sync with the saved state. Refresh
    // dependent displays so any preview state matches.
    updateSixLevelsSummary();
    updateClassPreview();
  }
  pendingSixLevelChange = null;
  document.getElementById('six-levels-confirm-modal').classList.remove('open');
}

// Confirm: apply the change to the form, refresh displays, dismiss modal,
// and immediately save the character.
function confirmSixLevelChange(){
  if (!pendingSixLevelChange) {
    document.getElementById('six-levels-confirm-modal').classList.remove('open');
    return;
  }
  // For preset changes, NOW is when we actually apply the slider values.
  // Single-axis changes already had the new slider value at modal-open time.
  if (pendingSixLevelChange.isPresetChange) {
    for (const axis of Object.keys(pendingSixLevelChange.preset)) {
      const el = document.getElementById('c-sl-'+axis);
      if (el) el.value = pendingSixLevelChange.preset[axis];
    }
  }
  pendingSixLevelChange = null;
  document.getElementById('six-levels-confirm-modal').classList.remove('open');
  updateSixLevelsSummary();
  updateClassPreview();
  // Trigger the existing save flow. saveCharacter() reads from the form, so
  // the new Six Scales value is captured naturally. saveCharacter() also
  // navigates to the sheet, which is the most appropriate place to land
  // after a scenario-level commit.
  saveCharacter();
}

// v8.2.1: First-save Six Scales recap modal. Fires from saveCharacter() when
// creating a new character (editId is null). Lists all six axes with their
// tier descriptors so the player can confirm the scenario before commit.
function promptFirstSaveSixLevels(){
  const sl = getSixLevels();
  const axes = ['arcane','divine','heroic','mutation','psionic','tech'];
  const recap = axes.map(a => {
    const def = SIX_LEVELS[a];
    const lvl = sl[a]||0;
    const desc = def?.tiers?.[lvl] || '(unknown)';
    return `<div style="margin-bottom:.35rem;">
      <b style="color:var(--gold);">${def?.label || a} ${lvl}</b>
      <span style="color:var(--g70);"> — ${escapeHTML(desc)}</span>
    </div>`;
  }).join('');
  document.getElementById('six-levels-firstsave-recap').innerHTML = recap;
  document.getElementById('six-levels-firstsave-modal').classList.add('open');
}

// Cancel the first-save: dismiss the modal, leave the player on the form to
// adjust their Six Scales.
function cancelFirstSaveSixLevels(){
  document.getElementById('six-levels-firstsave-modal').classList.remove('open');
  // _firstSaveConfirmed remains false — the gate is still in place. If the
  // player clicks Save again, the recap will fire again.
}

// Confirm the first-save: dismiss the modal, set the bypass flag, and re-invoke
// saveCharacter() to complete the save flow.
function confirmFirstSaveSixLevels(){
  document.getElementById('six-levels-firstsave-modal').classList.remove('open');
  _firstSaveConfirmed = true;
  saveCharacter();
}
// Render the descriptive summary of the current Six Scales selection
function updateSixLevelsSummary(){
  const sl=getSixLevels();
  const axes=['arcane','divine','heroic','mutation','psionic','tech'];
  const lines=axes.map(a=>{
    const def=SIX_LEVELS[a];
    const lvl=sl[a];
    return`<b style="color:var(--gold);">${def.short} ${lvl}</b>: ${def.tiers[lvl]}`;
  });
  document.getElementById('six-levels-summary').innerHTML=lines.join('<br>');
  // v8.3.24: also refresh the Scenario Title display from current axes.
  updateScenarioTitleDisplay();
}
function updateScenarioTitleDisplay() {
  const displayEl = document.getElementById('scenario-title-display');
  if (!displayEl) return;
  if (_scenarioTitleOverride) {
    displayEl.textContent = _scenarioTitleOverride;
    displayEl.title = 'Custom override — click ↻ Regenerate to revert to auto-generated.';
  } else {
    const sl = getSixLevels();
    displayEl.textContent = generateScenarioTitle(sl);
    displayEl.title = 'Auto-generated from your Six Scales.';
  }
}
function onScenarioTitleOverride() {
  const displayEl = document.getElementById('scenario-title-display');
  const inputEl   = document.getElementById('scenario-title-input');
  const editBtn   = document.getElementById('scenario-title-edit-btn');
  const saveBtn   = document.getElementById('scenario-title-save-btn');
  const cancelBtn = document.getElementById('scenario-title-cancel-btn');
  const regenBtn  = document.getElementById('scenario-title-regen-btn');
  if (!displayEl || !inputEl) return;
  // Snapshot the current override state so Cancel can restore it.
  window._scenarioTitlePreEditOverride = _scenarioTitleOverride;
  window._scenarioTitleCancelling = false;
  inputEl.value = displayEl.textContent || '';
  displayEl.style.display = 'none';
  inputEl.style.display = '';
  editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
  if (cancelBtn) cancelBtn.style.display = '';
  // ↻ stays visible but is greyed out during edit (still functional but
  // distracting to click while editing). Keep enabled for muscle-memory ease.
  if (regenBtn) regenBtn.style.opacity = '0.5';
  // Focus + select-all so the player can immediately type to replace.
  inputEl.focus();
  inputEl.select();
}

// v8.3.26: commit the inline edit. Empty input clears the override (revert
// to auto-generated). Otherwise the typed value becomes the new override.
function onScenarioTitleSaveEdit() {
  // Guard against blur+cancel race: if cancel was just initiated, ignore.
  if (window._scenarioTitleCancelling) return;
  const inputEl = document.getElementById('scenario-title-input');
  if (!inputEl) return;
  const typed = (inputEl.value || '').trim();
  if (typed === '') {
    // Empty input = "revert to auto-generated" (equivalent to ↻ Regenerate)
    _scenarioTitleOverride = null;
  } else {
    _scenarioTitleOverride = typed;
  }
  _exitScenarioTitleEditMode();
  updateScenarioTitleDisplay();
}

// v8.3.26: cancel the inline edit. Restores the pre-edit override state
// (in case blur-commits already mutated it, which can happen when the user
// clicks the ✕ Cancel button — mousedown fires blur on the input before the
// click handler fires here).
function onScenarioTitleCancelEdit() {
  window._scenarioTitleCancelling = true;
  _scenarioTitleOverride = window._scenarioTitlePreEditOverride;
  _exitScenarioTitleEditMode();
  updateScenarioTitleDisplay();
  // Reset the cancelling flag after the current event tick so future
  // edit→cancel cycles work cleanly.
  setTimeout(() => { window._scenarioTitleCancelling = false; }, 0);
}

// v8.3.26: shared exit-edit-mode helper. Hides input/save/cancel; restores
// display/edit/regen.
function _exitScenarioTitleEditMode() {
  const displayEl = document.getElementById('scenario-title-display');
  const inputEl   = document.getElementById('scenario-title-input');
  const editBtn   = document.getElementById('scenario-title-edit-btn');
  const saveBtn   = document.getElementById('scenario-title-save-btn');
  const cancelBtn = document.getElementById('scenario-title-cancel-btn');
  const regenBtn  = document.getElementById('scenario-title-regen-btn');
  if (displayEl) displayEl.style.display = '';
  if (inputEl)   inputEl.style.display = 'none';
  if (editBtn)   editBtn.style.display = '';
  if (saveBtn)   saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (regenBtn)  regenBtn.style.opacity = '';
}

function onScenarioTitleRegenerate() {
  _scenarioTitleOverride = null;
  // If we're currently in edit mode, exit it before regenerating.
  _exitScenarioTitleEditMode();
  updateScenarioTitleDisplay();
}
function getCurrentScenarioTitle() {
  // Read the current display text — the source of truth for save. If edit
  // mode is somehow still active at save time, read from the input instead.
  const inputEl = document.getElementById('scenario-title-input');
  if (inputEl && inputEl.style.display !== 'none') {
    return (inputEl.value || '').trim();
  }
  return document.getElementById('scenario-title-display')?.textContent || '';
}
