// =============================================================================
// js/rules/05-six-scales-and-scenarios.js
// SIX SCALES AND SCENARIOS
// =============================================================================
//
// WHAT'S IN HERE
//   The Six Scales (arcane, divine, heroic, mutation, psionic, tech; each
//   rated 0-9), the built-in scenario presets, GM-made custom scenarios
//   (stored in the browser), and the Scenario Studio dialog that names and
//   saves them.
//
// KEY NAMES (so you can search for them)
//   tables/objects: SIX_LEVELS, SCENARIO_PRESETS, PRESET_LEGACY, SCEN_AXES
//   functions (15): normalizePresetName, saveCustomScenarios,
//   customScenarioByName, scenarioScalesOf, scenarioSummaryStr,
//   populateScenarioSelects, openScenarioStudio, closeScenarioStudio,
//   scenScales, scenAnnotate, scenSave, scenRenderList, scenDelete,
//   scenExport, scenImportFile
//
// LOAD ORDER
//   File 5 of 68. index.html loads it after js/rules/04-advanced-classes.js
//   and before js/rules/06-homebrew-forge-armory-monstrous.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 4536-4871 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 4536-4871; unchanged below this line ----
// SIX SCALES OF THE SCENARIO — set by the GM, gate which DxD20 rules apply to the campaign.
// Each is rated 0 (absent) through 9 (ubiquitous). See GM's Guide Chapter II for full details.
const SIX_LEVELS = {
  arcane: {
    label: 'Arcane Scale',
    short: 'Arcane',
    desc: 'How prevalent magic is in the scenario',
    tiers: [
      'No arcane magic — Sorcerer/Wizard unavailable, Bard has no spells, no arcane skills/feats',
      'Low-powered arcane magic, max 5th-level spells, magic items rare',
      'Low-powered arcane magic, 1st-level item market exists',
      'Low-powered arcane magic, 2nd-level item market exists',
      'Low-powered arcane magic, 3rd-level item market exists',
      'High-powered arcane magic, max 9th-level spells, items rare',
      'High-powered arcane magic, 1st-level item market exists',
      'High-powered arcane magic, 2nd-level item market exists',
      'High-powered arcane magic, 3rd-level item market exists',
      'Ubiquitous arcane magic, 5th-level item market, all chars get Use Magic Device',
    ],
  },
  divine: {
    label: 'Divine Scale',
    short: 'Divine',
    desc: 'How involved the gods are in the scenario',
    tiers: [
      'No divine magic — Cleric/Paladin/Saint unavailable, Ranger has no spells, no divine skills/feats',
      'Low-powered divine magic, max 5th-level spells, divine items are rare relics',
      'Low-powered divine magic, 1st-level item market exists',
      'Low-powered divine magic, 2nd-level item market exists',
      'Low-powered divine magic, 3rd-level item market exists',
      'High-powered divine magic, max 9th-level spells, items rare',
      'High-powered divine magic, 1st-level item market exists',
      'High-powered divine magic, 2nd-level item market exists',
      'High-powered divine magic, 3rd-level item market exists',
      'Ubiquitous divine magic, 5th-level item market, all chars get Use Magic Device',
    ],
  },
  heroic: {
    label: 'Heroic Scale',
    short: 'Heroic',
    desc: 'Player agency in influencing the dice (Action Points, Fate Points)',
    tiers: [
      'Luck of the Die — no Hero classes, no Action Points, no Fate Points (grimdark)',
      'Basic Agency — Hero classes available, 1 AP/round',
      'Basic Heroic Agency — Hero classes available, 1 AP/round, Heroic APs unlocked',
      'Heroic Agency — 2 AP/round, Heroic APs',
      'High Heroic Agency — unlimited AP/round, Heroic APs',
      'Fated Agency — 1 AP/round + Fate Points (1 FP/round)',
      'Fated Heroism — 1 AP/round, Heroic APs, class-specific Fate Points',
      'Fated High Heroism — 2 AP/FP per round, Heroic APs',
      'Destined Heroism — Hero class mandatory, 2 AP/FP per round, all options',
      'Destined High Heroism — Hero class mandatory, unlimited AP/FP per round',
    ],
  },
  mutation: {
    label: 'Mutation Scale',
    short: 'Mutation',
    desc: 'How varied races are; access to Mutation Points and super-powers',
    tiers: [
      'No mutations — Slightly Different/Supernatural Mutation/Unstable Mutation feats unavailable',
      'Minimal MP via Drawbacks/Slightly Different feat, only Minor (1-3 MP) Advantages',
      'Minimal MP via Drawbacks/Slightly Different feat, all Advantages',
      'Mutant subtype +1 racial level (10 MP), Advantages only',
      'Mutant subtype up to +2 racial level (20 MP), Slightly Different as bonus feat',
      'First tier of super-powers — Supernatural Mutation feat unlocks supernatural abilities (up to 20 MP)',
      'Supernatural Mutation up to +3 racial level (30 MP), all super-powers including Reality Revision',
      'Supernatural Mutation up to +4 racial level (40 MP), 5th-level char start recommended',
      'Supernatural Mutation up to +6 racial level (60 MP), Slightly Different/Supernatural Mutation as bonus feats',
      'Supernatural Mutation up to +10 racial level (100 MP) — demi-god starting characters',
    ],
  },
  psionic: {
    label: 'Psionic Scale',
    short: 'Psionic',
    desc: 'How powerful the hidden potential of the sentient mind can be',
    tiers: [
      'No psionic powers — Psion/Wilder unavailable, Warmind has no powers, no psionic skills/feats',
      'Low-powered psionics, max 5th-level powers, psionic items rare',
      'Low-powered psionics, 1st-level item market exists',
      'Low-powered psionics, 2nd-level item market exists',
      'Low-powered psionics, 3rd-level item market exists',
      'High-powered psionics, max 9th-level powers, items rare',
      'High-powered psionics, 1st-level item market exists',
      'High-powered psionics, 2nd-level item market exists',
      'High-powered psionics, 3rd-level item market exists',
      'Ubiquitous psionics, 5th-level item market, all chars get Use Psionic Device',
    ],
  },
  tech: {
    label: 'Tech Scale',
    short: 'Tech',
    desc: 'State of technological development in the scenario',
    tiers: [
      'Stone Age — society is the extended familial unit, no organized resources, mastercrafting impossible',
      'Bronze/Iron Age — currency and marketplaces emerge, mastercrafting up to +1',
      'Middle Ages — formal society shares information, mastercrafting up to +2',
      'Age of Reason — scientific method, concept of flight, mastercrafting up to +2',
      'Industrial Age — mass production, machining, mastercrafting up to +3',
      'Information Age — electronics, computers, space travel, cybernetics, mastercrafting up to +3',
      'Fusion Age — mecha and starship warfare in infancy, simple AI robots',
      'Gravity Age — mecha and starships mainstream, advanced AI / android tech',
      'Energy Age — most advanced metallurgy, AI commonplace, advanced mecha/starships',
      'Transparent Age — technology synonymous with magic and psionics',
    ],
  },
};
// Archetypal scenario presets (from Table: Classic Scenarios in the GM's Guide).
// "*" entries in the source mean "varies — set as your scenario calls for it".
// Where the source uses "1-2", "5+", "6+", we pick a reasonable default in that range.
// v8.45.0 (Adam, 2026-09-26): the five ancestor-branded presets renamed to
// the "Worlds" family — generic yet suggestive, zero trademarks. Old names
// live forever in PRESET_LEGACY: stored characters resolve and self-heal.
const SCENARIO_PRESETS = {
  'The Elder World':            {arcane:5, divine:5, heroic:0, mutation:0, psionic:0, tech:1},
  'The Elder World, Awakened':  {arcane:5, divine:5, heroic:0, mutation:0, psionic:5, tech:1},
  'The Ordinary World':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:5},
  'The Farther Worlds':         {arcane:0, divine:0, heroic:1, mutation:1, psionic:0, tech:6},
  'The Veiled World':           {arcane:1, divine:1, heroic:1, mutation:0, psionic:1, tech:5},
  'Steampunk':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:3},
  'Cyberpunk':         {arcane:0, divine:0, heroic:1, mutation:0, psionic:0, tech:6},
  'Fated Heroes':      {arcane:1, divine:1, heroic:5, mutation:0, psionic:0, tech:5},
  'Grimdark':          {arcane:1, divine:1, heroic:0, mutation:0, psionic:0, tech:1},
  'Super-Powers':      {arcane:0, divine:0, heroic:1, mutation:5, psionic:0, tech:5},
  'Hi-Powered':        {arcane:5, divine:5, heroic:5, mutation:5, psionic:5, tech:5},
  'Low-Powered':       {arcane:1, divine:1, heroic:1, mutation:1, psionic:1, tech:1},
  'Universe City':     {arcane:5, divine:5, heroic:9, mutation:9, psionic:5, tech:7},
  'Custom':            null, // user enters values manually
};
// Legacy preset names (pre-v8.45.0 saves) → current names. Read-side
// resolution + renderSheet self-heal; never removed (old exports live long).
const PRESET_LEGACY = {
  'Classic D&D': 'The Elder World',
  'Expanded D&D': 'The Elder World, Awakened',
  'd20 Modern': 'The Ordinary World',
  'd20 Future': 'The Farther Worlds',
  'Urban Arcana': 'The Veiled World',
};
function normalizePresetName(n) { return PRESET_LEGACY[n] || n || 'Custom'; }

// ==== v8.54.0: NAME AND ESTABLISH YOUR SCENARIO — THE SIX SCALES ====
// GM-authored scenarios as first-class data: a name, the six dials, an
// optional official lock, and notes. Saved scenarios appear beside the
// built-in presets on the Create page and in Quickdraw, inherit EVERY
// dial-keyed behavior for free (class gating, lock flow, prereq scenario
// checks), and travel between machines as small JSON files. Adam's naming
// doctrine: objective task language ("Name and Establish"), not flavor.
let customScenarios = [];
try { customScenarios = JSON.parse(localStorage.getItem('dxd20v2_scenarios') || '[]'); } catch (e) { customScenarios = []; }
function saveCustomScenarios() { try { localStorage.setItem('dxd20v2_scenarios', JSON.stringify(customScenarios)); } catch (e) {} }
function customScenarioByName(n) { return customScenarios.find(s => s.name === n) || null; }
// The one lookup every consumer routes through: established scenarios first,
// then the built-in presets (legacy names normalized). Null = Custom/unknown.
function scenarioScalesOf(name) {
  const cs = customScenarioByName(name);
  if (cs) return cs.scales;
  return SCENARIO_PRESETS[normalizePresetName(name)] || null;
}
const SCEN_AXES = ['arcane', 'divine', 'heroic', 'mutation', 'psionic', 'tech'];
function scenarioSummaryStr(sc) { return 'A' + (sc.arcane||0) + ' D' + (sc.divine||0) + ' H' + (sc.heroic||0) + ' M' + (sc.mutation||0) + ' P' + (sc.psionic||0) + ' T' + (sc.tech||0); }
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
    el.innerHTML = `<span style="color:#d4b870;">◌ ${dis.length} class${dis.length === 1 ? ' is' : 'es are'} unavailable under these dials:</span> <span style="opacity:.75;">${dis.join(', ')}</span>`;
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
    ? customScenarios.map((s, i) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-top:1px solid rgba(200,151,30,.12);font-size:11.5px;">
        <span>${s.locked ? '🔒 ' : ''}<b>${escapeHTML(s.name)}</b> <span style="opacity:var(--o60);color:var(--dim);">${scenarioSummaryStr(s.scales)}</span>${s.notes ? ` <span style="opacity:.45;cursor:help;" title="${escapeHTML(s.notes)}">✎</span>` : ''}</span>
        <span style="margin-left:auto;display:inline-flex;gap:5px;">
          <button class="btn btn-sm" style="font-size:10px;padding:1px 7px;" onclick="scenExport(${i})" title="Download this scenario as a small JSON file — hand it to your players; they Import it and their Create page carries your dials.">⬇</button>
          <button class="btn btn-sm" style="font-size:10px;padding:1px 7px;" onclick="scenDelete(${i})" title="Remove this scenario from the list. Characters already created under it keep their dials and scenario title.">✕</button>
        </span></div>`).join('')
    : '<div style="padding:5px 6px;font-size:11px;opacity:var(--o50);color:var(--dim);">None established yet — the scenarios you save here appear in the Create page and Quickdraw dropdowns, and export as files your players can import.</div>';
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
try { populateScenarioSelects(); } catch (e) {}
// v8.55.1 (Adam's report — the nav banner bisected the Forge): these modals
// are authored inside div.app-body, whose position:relative + z-index:1
// creates a stacking context CAPPED at z:1 — no inner z-index can ever paint
// above the body-level sticky nav (z:100). Reparent them to <body> at
// startup so their fixed overlays genuinely cover the page, nav included.
try {
  for (const _mid of ['qd-modal', 'scen-modal', 'hb-modal']) {
    const _mel = document.getElementById(_mid);
    if (_mel && _mel.parentElement !== document.body) document.body.appendChild(_mel);
  }
} catch (e) {}
// ==== end v8.54.0 scenario block ====

