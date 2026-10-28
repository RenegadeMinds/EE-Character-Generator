// =============================================================================
// js/ui/scenario-studio.js
// SCENARIO STUDIO — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Scenario Studio dialog and the scenario
//   dropdowns.
//
// KEY NAMES (so you can search for them)
//   tables and state: _lastScenSel, _scenCtx, _scenarioTitleOverride,
//   _scenarioGateAcknowledged
//   functions (10): populateScenarioSelects, openScenarioStudio,
//   closeScenarioStudio, scenScales, scenAnnotate, scenSave, scenRenderList,
//   scenDelete, scenExport, scenImportFile
//
// WHERE IT CAME FROM
//   Gathered from js/app/44-create-scenario-gate-and-layout.js,
//   js/app/50-skills-page.js, js/rules/05-six-scales-and-scenarios.js when
//   the code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Last successfully-applied selection per context, so choosing the establish
// entry (and cancelling) can restore the dropdown instead of stranding it.
const _lastScenSel = { create: null, qd: null };

// (Re)build the Create page's scenario select: static built-ins stay in the
// HTML; the Established optgroup + the establish entry are dynamic. DOM
// construction (no innerHTML) so this can run at parse time without helpers.
function populateScenarioSelects() {
  const cSel = document.getElementById('c-scenario-preset');
  if (!cSel) return;
  const prev = cSel.value;
  cSel.querySelectorAll('.scen-dyn').forEach(el => el.remove());
  if (customScenarios.length) {
    const og = document.createElement('optgroup');
    og.label = 'Established Scenarios'; og.className = 'scen-dyn';
    for (const s of customScenarios) {
      const o = document.createElement('option');
      o.value = s.name;
      o.textContent = (s.locked ? '🔒 ' : '') + s.name + ' (' + scenarioSummaryStr(s.scales) + ')';
      og.appendChild(o);
    }
    cSel.appendChild(og);
  }
  const est = document.createElement('option');
  est.value = '__establish__'; est.className = 'scen-dyn';
  est.textContent = '✦ Name and Establish Your Scenario…';
  cSel.appendChild(est);
  if (prev && prev !== '__establish__') cSel.value = prev;
}

let _scenCtx = 'create';
function openScenarioStudio(ctx) {
  _scenCtx = (ctx === 'qd') ? 'qd' : 'create';
  // Restore the invoking dropdown off the establish entry immediately.
  const sel = document.getElementById(_scenCtx === 'qd' ? 'qd-preset' : 'c-scenario-preset');
  if (sel && sel.value === '__establish__') sel.value = _lastScenSel[_scenCtx] || 'Custom';
  // Seed the dials from wherever the GM already was — their work travels in.
  let cur = {};
  try { cur = (_scenCtx === 'qd') ? qdScales() : getSixLevels(); } catch (e) {}
  for (const ax of SCEN_AXES) { const el = document.getElementById('scen-sl-' + ax); if (el) el.value = cur[ax] || 0; }
  document.getElementById('scen-name').value = '';
  document.getElementById('scen-notes').value = '';
  document.getElementById('scen-lock').checked = false;
  scenAnnotate(); scenRenderList();
  document.getElementById('scen-modal').style.display = 'block';
}
function closeScenarioStudio() { document.getElementById('scen-modal').style.display = 'none'; }
function scenScales() {
  const o = {};
  for (const ax of SCEN_AXES) o[ax] = Math.max(0, Math.min(9, parseInt((document.getElementById('scen-sl-' + ax) || {}).value, 10) || 0));
  return o;
}
// The guidance layer: the dials explain their consequences WHILE the GM
// turns them — the Compass philosophy applied to worldbuilding.
function scenAnnotate() {
  const el = document.getElementById('scen-annot');
  if (!el) return;
  const sl = scenScales();
  let dis = [];
  try { dis = [...disabledClassesForScenario(sl)].sort(); } catch (e) {}
  if (!dis.length) {
    el.innerHTML = '<span style="color:#6dba88;">✓ Every class in the catalogue is available under these dials.</span>';
  } else {
    el.innerHTML = `<span style="color:#d4b870;">◌ ${dis.length} class${dis.length === 1 ? ' is' : 'es are'} unavailable under these dials:</span> <span class="op-0_75">${dis.join(', ')}</span>`;
  }
}
async function scenSave() {
  const name = (document.getElementById('scen-name').value || '').trim();
  if (!name) { toast('Name your scenario first — the name appears on every character sheet created under it.'); return; }
  if (SCENARIO_PRESETS[name] !== undefined || PRESET_LEGACY[name] || name === '__establish__' || name === 'Custom') {
    toast('That name belongs to a built-in preset — choose another.'); return;
  }
  const rec = {
    name, scales: scenScales(),
    locked: !!document.getElementById('scen-lock').checked,
    notes: (document.getElementById('scen-notes').value || '').trim(),
    createdAt: new Date().toLocaleDateString(),
  };
  const existing = customScenarioByName(name);
  if (existing) {
    if (!(await confirmModal(`"${name}" is already established — overwrite it with these dials?`))) return;
    Object.assign(existing, rec);
  } else {
    customScenarios.push(rec);
  }
  saveCustomScenarios();
  populateScenarioSelects();
  closeScenarioStudio();
  _lastScenSel[_scenCtx] = name;
  // Select + apply in the context that invoked the studio.
  if (_scenCtx === 'qd') {
    const s = document.getElementById('qd-preset');
    if (s) { qdPopulatePresetSelect(name); qdOnPreset(); }
  } else {
    const s = document.getElementById('c-scenario-preset');
    if (s) { s.value = name; applyScenarioPreset(); }
  }
  toast(`✦ Scenario established: ${name} (${scenarioSummaryStr(rec.scales)})${rec.locked ? ' — official; the Create page locks these dials on selection.' : ''}`);
}
function scenRenderList() {
  const el = document.getElementById('scen-list');
  if (!el) return;
  el.innerHTML = customScenarios.length
    ? customScenarios.map((s, i) => `<div class="items-center gap-8 fs-11_5" style="display:flex;padding:4px 6px;border-top:1px solid rgba(200,151,30,.12);">
        <span>${s.locked ? '🔒 ' : ''}<b>${escapeHTML(s.name)}</b> <span class="o-60 c-dim">${scenarioSummaryStr(s.scales)}</span>${s.notes ? ` <span class="op-0_45 cursor-help" title="${escapeHTML(s.notes)}">✎</span>` : ''}</span>
        <span class="ml-auto gap-5" style="display:inline-flex;">
          <button class="fs-10 p-1-7 btn btn-sm" onclick="scenExport(${i})" title="Download this scenario as a small JSON file — hand it to your players; they Import it and their Create page carries your dials.">⬇</button>
          <button class="fs-10 p-1-7 btn btn-sm" onclick="scenDelete(${i})" title="Remove this scenario from the list. Characters already created under it keep their dials and scenario title.">✕</button>
        </span></div>`).join('')
    : '<div class="fs-11 o-50 c-dim" style="padding:5px 6px;">None established yet — the scenarios you save here appear in the Create page and Quickdraw dropdowns, and export as files your players can import.</div>';
}
async function scenDelete(i) {
  const s = customScenarios[i];
  if (!s) return;
  if (!(await confirmModal(`Delete the established scenario "${s.name}"?\n\nCharacters already created under it are untouched — they keep their dials and scenario title.`))) return;
  customScenarios.splice(i, 1);
  saveCustomScenarios(); populateScenarioSelects(); scenRenderList();
  toast(`Scenario "${s.name}" removed.`);
}
function scenExport(i) {
  const s = customScenarios[i];
  if (!s) return;
  const blob = new Blob([JSON.stringify(Object.assign({ _eeScenario: 1 }, s), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'EE_Scenario_' + s.name.replace(/[^a-z0-9]+/gi, '_') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`⬇ ${s.name} exported — hand the file to your players.`);
}
function scenImportFile(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const x = JSON.parse(rd.result);
      const arr = Array.isArray(x) ? x : [x];
      let added = 0, renamed = 0, skipped = 0;
      for (const s of arr) {
        if (!s || typeof s.name !== 'string' || !s.name.trim() || !s.scales
            || SCEN_AXES.some(ax => typeof s.scales[ax] !== 'number')) { skipped++; continue; }
        let nm = s.name.trim();
        if (SCENARIO_PRESETS[nm] !== undefined || PRESET_LEGACY[nm] || nm === 'Custom') { nm += ' (imported)'; renamed++; }
        if (customScenarioByName(nm)) {
          const base = nm; let k = 2;
          while (customScenarioByName(nm)) nm = `${base} (${k++})`;
          renamed++;
        }
        const scales = {};
        for (const ax of SCEN_AXES) scales[ax] = Math.max(0, Math.min(9, Math.round(s.scales[ax] || 0)));
        customScenarios.push({ name: nm, scales, locked: !!s.locked, notes: typeof s.notes === 'string' ? s.notes : '', createdAt: s.createdAt || new Date().toLocaleDateString() });
        added++;
      }
      saveCustomScenarios(); populateScenarioSelects(); scenRenderList();
      toast(`⬆ Scenario import: ${added} added${renamed ? `, ${renamed} renamed` : ''}${skipped ? `, ${skipped} skipped (not scenario files)` : ''}.`);
    } catch (e) {
      toast('Import failed: ' + e.message);
    }
    inp.value = '';
  };
  rd.readAsText(f);
}

// v8.3.24: Scenario Title state. Three modes:
//   • Auto-generated (default): the live title comes from generateScenarioTitle.
//   • Player-overridden: _scenarioTitleOverride holds the user's custom text;
//     it persists until they click ↻ Regenerate.
//   • Editing (v8.3.26): the row toggles into edit mode, hiding the display
//     span and showing an inline input. Enter or ✓ Save commits; Escape or
//     ✕ Cancel reverts; blur commits (least surprising — typed text persists).
// On save, whichever is currently displayed becomes c.scenarioTitle.
let _scenarioTitleOverride = null;

// Track which scenario-gated skills the player has acknowledged as
// GM exceptions during this session (avoid repeating warnings on every
// keystroke for the same skill).
let _scenarioGateAcknowledged = new Set();
