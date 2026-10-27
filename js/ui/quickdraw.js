// =============================================================================
// js/ui/quickdraw.js
// QUICKDRAW — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Quickdraw dialog.
//
// KEY NAMES (so you can search for them)
//   functions (14): qdAttrModeToggle, qdMaAdj, qdManualAttrs, qdBespokeRun,
//   openQuickdraw, qdOccHint, qdScales, qdPopulatePresetSelect, qdOnPreset,
//   qdRefreshClassLists, qdHybridToggle, closeQuickdraw, qdHybridSpec, qdRun
//
// WHERE IT CAME FROM
//   Gathered from js/rules/21-quickdraw.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
