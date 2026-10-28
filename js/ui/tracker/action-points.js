// =============================================================================
// js/ui/tracker/action-points.js
// TRACKER / ACTION POINTS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: Action Points and Fate Points, and their
//   spend and restore dialogs.
//
// KEY NAMES (so you can search for them)
//   functions (16): renderAPBar, toggleAPOpt, adjustAP, adjustAPSilent,
//   resetAP, spendFatePoint, restoreFatePoint, _buildOptionRadios,
//   _buildAPSpendRadios, _buildFPSpendRadios, openAPSpendModal,
//   openAPRestoreModal, openFPSpendModal, openFPRestoreModal,
//   closeAPFPModal, commitAPFPModal
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/app/65-tracker-logs-and-damage.js
//   when the code was regrouped by topic and page. Each function and table
//   moved whole and unchanged, with the comments above it, including the
//   original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// v8.3.19: AP bar with full Heroic-Level-aware UI.
//
// Layout:
//   Heroic Scale summary line: "Heroic 3 — Heroic Agency · 2 AP/round"
//     (with FP counter when applicable, e.g. "· 2 FP spent")
//   AP / max display (existing)
//   AP bar fill (existing)
//   Three collapsible option sections (collapsed by default):
//     ▶ Action Point Options       (Heroic 1+)
//     ▶ Heroic Action Point Options (Heroic 2+, Hero class)
//     ▶ Fate Point Options          (Heroic 5+, Hero class)
//   The Heroic 0 case shows a single explanatory line in place of the bar.
function renderAPBar(c){
  const cap = getHeroicCapabilities(c);
  const apDice = getAPDice(c.totalLvl||1);
  const fpSpent = c.fatePoints || 0;

  // Heroic 0: AP unavailable. Show explanatory text in place of the bar.
  if (cap.heroicLevel === 0) {
    document.getElementById('tr-ap').innerHTML = `
      <div class="justify-between items-center mb-6" style="display:flex;">
        <span class="font-serif fs-10 c-bronze">Action Points</span>
        <span class="font-serif fs-14 fw-600 c-g45 italic">— Unavailable —</span>
      </div>
      <div class="fs-11 c-g55 lh-1_5 p-8-10 rounded-2" style="background:rgba(0,0,0,.2);border-left:2px solid rgba(200,151,30,.3);">
        <b style="color:#d4b870;">Heroic 0 — ${escapeHTML(cap.heroicLevelName)}.</b>
        No Action Points, Heroic Action Points, or Fate Points are available in this scenario.
        Feats or class abilities that normally require AP become usable 1/day instead.
        Talents are treated as General feats with an attribute prerequisite.
      </div>`;
    renderBattleFocus(c); // v8.5.4: Battle Focus is independent of the Heroic Scale
    return;
  }

  const pct = c.apMax>0 ? Math.round((c.ap/c.apMax)*100) : 0;
  // Heroic Scale summary line — informational, including AP-per-round limit
  // and (when applicable) the FP-spent counter.
  let fpIndicator = '';
  if (cap.hasFP || fpSpent > 0) {
    fpIndicator = ` &middot; <span class="c-red-text" title="Fate Points are permanent AP expenditures. Each FP reduces your max AP pool by 1 at every future level-up.">${fpSpent} FP spent</span>`;
  }
  const heroicCaption = `
    <div class="font-serif fs-10 c-g65 mb-4" style="letter-spacing:.03em;">
      Heroic ${cap.heroicLevel} &mdash; ${escapeHTML(cap.heroicLevelName)} &middot; ${escapeHTML(cap.apPerRound)} &middot; rolls ${apDice}${fpIndicator}
    </div>`;

  // Three collapsible option sections — each starts collapsed; the toggle
  // state is held in window._apOptToggle (transient per-page-load state).
  if (!window._apOptToggle) window._apOptToggle = {ap:false, hap:false, fp:false};
  const tog = window._apOptToggle;
  const optSection = (key, title, items, available, gateMsg) => {
    if (!available) {
      return `<div class="mt-6 fs-10 c-g35 italic p-4-8">${title} &mdash; ${gateMsg}</div>`;
    }
    const arrow = tog[key] ? '▼' : '▶';
    const itemsHTML = tog[key] ? items.map(it => {
      // v8.3.21: support an optional pre-built HTML annotation that's
      // prepended to the (escaped) description. This is used by class-
      // specific FP options to show Talent-ownership status. The annotation
      // HTML is trusted (built locally from controlled values); the
      // description proper is always escaped.
      const annot = it.annotationHTML ? `${it.annotationHTML} ` : '';
      return `<div class="p-6-9 rounded-2" style="margin:6px 0;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.3);">
         <div class="fw-600 c-gold fs-11 mb-2">${escapeHTML(it.name)}</div>
         <div class="fs-10_5 c-g75 lh-1_45">${annot}${escapeHTML(it.desc)}</div>
       </div>`;
    }).join('') : '';
    return `
      <div class="mt-6">
        <div onclick="toggleAPOpt('${key}')" class="cursor-pointer font-serif fs-10 c-g70 rounded-2 select-none ls-0_04em uppercase" style="padding:3px 6px;background:rgba(200,151,30,.03);">${arrow} ${escapeHTML(title)}</div>
        <div>${itemsHTML}</div>
      </div>`;
  };

  // Assemble the FP options list filtered by the character's Hero classes.
  // v8.3.21: each class-specific option's annotation badge shows the Talent
  // ownership status: ✓ owned (clear to use) or ⚠ Talent missing (player can
  // spend FP but the Talent-gated mechanic won't activate per rules).
  const fpItems = [...FP_OPTIONS_UNIVERSAL];
  for (const heroCls of cap.heroClassNames) {
    const baseOpt = FP_OPTIONS_BY_HERO_CLASS[heroCls];
    if (!baseOpt) continue;
    const owns = cap.ownedTalentNames.has(baseOpt.talent);
    const annotationHTML = owns
      ? `<span class="fw-600" style="color:#6dba88;">[✓ ${escapeHTML(baseOpt.talent)} owned]</span>`
      : `<span class="c-red-text fw-600">[⚠ Requires Talent: ${escapeHTML(baseOpt.talent)} — not owned]</span>`;
    fpItems.push({
      name: baseOpt.name,
      desc: baseOpt.desc,
      annotationHTML,
      talent: baseOpt.talent,
      talentOwned: owns,
    });
  }

  document.getElementById('tr-ap').innerHTML = `
    ${heroicCaption}
    <div class="justify-between items-center mb-6" style="display:flex;">
      <span class="font-serif fs-10 c-bronze">Action Points</span>
      <span class="font-serif fw-600 c-gold" style="font-size:16px;">${c.ap||0} / ${c.apMax||0}</span>
    </div>
    <div class="bar-wrap"><div class="bar-fill bar-purple" style="width:${pct}%;"></div></div>
    ${optSection('ap',  'Action Point Options',          AP_OPTIONS,  cap.hasAP,  'requires Heroic 1+')}
    ${optSection('hap', 'Heroic Action Point Options',  HAP_OPTIONS, cap.hasHAP, 'requires Heroic 2+ and 1+ Hero class level')}
    ${optSection('fp',  'Fate Point Options',            fpItems,     cap.hasFP,  'requires Heroic 5+ and 1+ Hero class level')}
  `;
  // v8.3.19: show the Fate Point spend/restore buttons only when relevant
  // (Heroic 5+ AND character has at least one Hero class level), OR when
  // the character has already spent at least one FP (so the GM-restore
  // button is reachable even if the scenario rules have changed).
  const fpCtrl = document.getElementById('tr-ap-fp-controls');
  if (fpCtrl) {
    fpCtrl.style.display = (cap.hasFP || fpSpent > 0) ? 'flex' : 'none';
  }
  renderBattleFocus(c); // v8.5.4
}
// v8.3.19: Toggle a section's collapsed state and re-render the AP bar.
function toggleAPOpt(key) {
  if (!window._apOptToggle) window._apOptToggle = {ap:false, hap:false, fp:false};
  window._apOptToggle[key] = !window._apOptToggle[key];
  const c = chars.find(x => x.id === curId);
  if (c) renderAPBar(c);
}

// v8.3.27: bare ±1 AP button → opens the AP spend/restore modal. Per design:
// every discretionary AP event prompts for a canonical option + optional note.
// Use adjustAPSilent() for non-discretionary events (full rest, level-up).
function adjustAP(d){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (d < 0) {
    // Spend path — open the radio-list modal.
    if ((c.ap || 0) <= 0) { toast('No AP to spend.'); return; }
    openAPSpendModal(c);
  } else if (d > 0) {
    // Restore path — open the optional-note modal.
    if ((c.ap || 0) >= (c.apMax || 0)) { toast('AP pool already full.'); return; }
    openAPRestoreModal(c);
  }
  // d === 0 is a no-op, leave it.
}

// v8.3.27: silent AP adjustment — used for automatic events (full rest,
// scenario-driven refreshes) that don't go through the modal. Logs a
// structured entry with no player-supplied annotation.
function adjustAPSilent(c, d, option, note) {
  if (!c) return;
  const newVal = Math.max(0, Math.min(c.apMax || 0, (c.ap || 0) + d));
  const actualDelta = newVal - (c.ap || 0);
  c.ap = newVal;
  if (actualDelta !== 0) {
    const kind = actualDelta > 0 ? 'ap-restore' : 'ap-spend';
    logActionEvent(c, kind, actualDelta, option || null, note || '');
  }
  save();
  renderAPBar(c);
}

function resetAP(){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const oldAP = c.ap || 0;
  const delta = (c.apMax || 0) - oldAP;
  c.ap = c.apMax;
  if (delta !== 0) {
    // v8.3.27: silent ap-reset entry. Encounter refreshes are rules-driven
    // and don't merit a modal interruption; player can scan the log later.
    logActionEvent(c, 'ap-reset', delta, 'Encounter refresh', '');
  }
  save();
  renderAPBar(c);
}

// v8.3.19: Spend 1 AP as a Fate Point — permanently expended (HH p.55).
// Requires confirmation since this PERMANENTLY reduces future AP pool
// replenishment. Each call decrements c.ap and increments c.fatePoints.
//
// v8.3.27: routed through openFPSpendModal (which collects an FP-specific
// radio list + optional note). The previous confirm() dialog is replaced by
// the modal's own commit/cancel buttons.
function spendFatePoint(){
  const c=chars.find(x=>x.id===curId);
  if(!c)return;
  if((c.ap||0)<1){toast('No AP available to spend as a Fate Point.');return;}
  const cap = getHeroicCapabilities(c);
  if(!cap.hasFP){toast('Fate Points require Heroic Scale 5+ scenarios and at least one Hero class level.');return;}
  openFPSpendModal(c);
}

// v8.3.19: GM-granted Fate Point restoration. Parallel to the "Gain" AP button:
// for genuinely heroic moments where the GM rewards a previously-spent FP.
// Each call decrements c.fatePoints (restoring 1 to the pool max) and adds 1
// to current AP (the player can immediately use it again). Requires confirmation
// since this is an unusual GM action.
//
// v8.3.27: routed through openFPRestoreModal (optional-note modal).
function restoreFatePoint(){
  const c=chars.find(x=>x.id===curId);
  if(!c)return;
  if((c.fatePoints||0)<1){toast('No Fate Points have been spent to restore.');return;}
  openFPRestoreModal(c);
}

// ============================================================================
// v8.3.27: ACTION POINT / FATE POINT SPEND-RESTORE MODALS
// ============================================================================
//
// All four modals share a layout: title strip, optional context block, a radio
// list of canonical options, a free-text note input, and Commit/Cancel buttons.
// The radio list comes from the AP_OPTIONS / HAP_OPTIONS / FP_OPTIONS_*
// constants (rules-reference data, reused as actionable choices).
//
// Per design call:
//   • Spend modals (AP and FP) include a radio list grouped under a "Rules-
//     defined options" separator, followed by "Class ability activation" and
//     "Other (GM-approved)" under a "Special / GM" separator.
//   • Restore modals omit the radio list (no canonical rules-defined restore
//     mechanism) — just an optional note.
//   • "Other (GM-approved)" pre-selected as the default radio.

function _buildOptionRadios(options, defaultValue) {
  return options.map((opt, i) => {
    const id = 'apopt-' + i + '-' + (opt.name||'opt').replace(/\W+/g, '_');
    const checked = (opt.name === defaultValue) ? 'checked' : '';
    const descText = opt.desc ? `<span class="fs-10_5 c-g60">${escapeHTML(opt.desc)}</span>` : '';
    return `<label for="${id}" class="m-4-0 p-6-9 rounded-2 cursor-pointer fs-11_5 lh-1_4" style="display:block;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.25);">
      <input type="radio" name="ap-modal-opt" id="${id}" value="${escapeHTML(opt.name)}" ${checked} class="mt-2" style="margin-right:6px;vertical-align:top;">
      <span class="fw-600 c-gold">${escapeHTML(opt.name)}</span>${descText ? '<br>' + descText : ''}
    </label>`;
  }).join('');
}

function _buildAPSpendRadios(c) {
  const cap = getHeroicCapabilities(c);
  let html = '';
  html += `<div class="font-serif fs-10 c-g55 uppercase ls-0_06em" style="margin:8px 0 4px;">Rules-defined Options</div>`;
  html += _buildOptionRadios(AP_OPTIONS, null);
  if (cap.hasHAP) {
    html += _buildOptionRadios(HAP_OPTIONS, null);
  }
  html += `<div class="font-serif fs-10 c-g55 uppercase ls-0_06em" style="margin:10px 0 4px;">Special / GM</div>`;
  // "Class ability activation" — generic for now. Future v8.3.28+ work: drill
  // down into class-specific AP-cost abilities for the character (when the
  // character has multiple class features that cost AP).
  html += _buildOptionRadios([
    {name: 'Class ability activation', desc: 'A class feature that costs Action Points to invoke.'},
    {name: 'Other (GM-approved)', desc: 'An unorthodox expenditure approved by the GM. Please explain in the note below.'},
  ], 'Other (GM-approved)');
  return html;
}

function _buildFPSpendRadios(c) {
  const cap = getHeroicCapabilities(c);
  let html = '';
  html += `<div class="font-serif fs-10 c-g55 uppercase ls-0_06em" style="margin:8px 0 4px;">Rules-defined Options</div>`;
  html += _buildOptionRadios(FP_OPTIONS_UNIVERSAL, null);
  for (const heroCls of cap.heroClassNames || []) {
    const baseOpt = FP_OPTIONS_BY_HERO_CLASS[heroCls];
    if (!baseOpt) continue;
    const owns = cap.ownedTalentNames && cap.ownedTalentNames.has(baseOpt.talent);
    const desc = owns
      ? `[✓ Talent owned] ${baseOpt.desc}`
      : `[⚠ Requires Talent: ${baseOpt.talent} — not owned] ${baseOpt.desc}`;
    html += _buildOptionRadios([{name: baseOpt.name, desc: desc}], null);
  }
  html += `<div class="font-serif fs-10 c-g55 uppercase ls-0_06em" style="margin:10px 0 4px;">Special / GM</div>`;
  html += _buildOptionRadios([
    {name: 'Class ability activation', desc: 'A class feature that costs Fate Points to invoke.'},
    {name: 'Other (GM-approved)', desc: 'An unorthodox expenditure approved by the GM. Please explain in the note below.'},
  ], 'Other (GM-approved)');
  return html;
}

function openAPSpendModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Spend 1 Action Point';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max. After: <b>${(c.ap||0)-1}</b> / ${c.apMax||0}.`;
  document.getElementById('apfp-modal-radios').innerHTML = _buildAPSpendRadios(c);
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'ap-spend';
  modal.style.display = 'flex';
}

function openAPRestoreModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Restore 1 Action Point (manual)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max. After: <b>${(c.ap||0)+1}</b> / ${c.apMax||0}.<br>` +
    `<span class="fs-11 c-g50">Manual restore — used for GM rewards or session-pacing grants. Encounter and full-rest refreshes are silent.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = '';
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'ap-restore';
  modal.style.display = 'flex';
}

function openFPSpendModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Spend 1 AP as a Fate Point (permanent)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max, <b>${c.fatePoints||0}</b> FP spent.<br>` +
    `After: <b>${(c.ap||0)-1}</b> AP / <b>${(c.apMax||0)-1}</b> max, <b>${(c.fatePoints||0)+1}</b> FP spent.<br>` +
    `<span class="fs-11 c-red-text">⚠ Permanent — your maximum AP pool will be reduced by 1 at every future level-up.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = _buildFPSpendRadios(c);
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'fp-spend';
  modal.style.display = 'flex';
}

function openFPRestoreModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Restore 1 Fate Point (GM grant)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max, <b>${c.fatePoints||0}</b> FP spent.<br>` +
    `After: <b>${(c.ap||0)+1}</b> AP / <b>${(c.apMax||0)+1}</b> max, <b>${(c.fatePoints||0)-1}</b> FP spent.<br>` +
    `<span class="fs-11 c-g50">GM grant — restores a previously-spent Fate Point. Use sparingly.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = '';
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'fp-restore';
  modal.style.display = 'flex';
}

function closeAPFPModal() {
  const modal = document.getElementById('apfp-modal');
  if (modal) modal.style.display = 'none';
}

function commitAPFPModal() {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  const c = chars.find(x => x.id === curId);
  if (!c) { closeAPFPModal(); return; }
  const mode = modal.dataset.mode;
  const radio = document.querySelector('input[name="ap-modal-opt"]:checked');
  const option = radio ? radio.value : null;
  const note = (document.getElementById('apfp-modal-note').value || '').trim();

  if (mode === 'ap-spend') {
    if ((c.ap||0) <= 0) { toast('No AP to spend.'); closeAPFPModal(); return; }
    c.ap = Math.max(0, (c.ap||0) - 1);
    logActionEvent(c, 'ap-spend', -1, option, note);
  } else if (mode === 'ap-restore') {
    if ((c.ap||0) >= (c.apMax||0)) { toast('AP pool already full.'); closeAPFPModal(); return; }
    c.ap = Math.min(c.apMax||0, (c.ap||0) + 1);
    logActionEvent(c, 'ap-restore', 1, option, note);
  } else if (mode === 'fp-spend') {
    if ((c.ap||0) < 1) { toast('No AP to spend as FP.'); closeAPFPModal(); return; }
    c.ap = Math.max(0, (c.ap||0) - 1);
    c.apMax = Math.max(0, (c.apMax||0) - 1);
    c.fatePoints = (c.fatePoints||0) + 1;
    logActionEvent(c, 'fp-spend', -1, option, note);
  } else if (mode === 'fp-restore') {
    if ((c.fatePoints||0) < 1) { toast('No spent FP to restore.'); closeAPFPModal(); return; }
    c.fatePoints = Math.max(0, (c.fatePoints||0) - 1);
    c.apMax = (c.apMax||0) + 1;
    c.ap = (c.ap||0) + 1;
    logActionEvent(c, 'fp-restore', 1, option, note);
  } else {
    closeAPFPModal();
    return;
  }
  save();
  renderAPBar(c);
  renderActionLog(c);
  closeAPFPModal();
}
