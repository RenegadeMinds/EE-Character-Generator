// =============================================================================
// js/ui/career-compass.js
// CAREER COMPASS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Career Compass panel on the Sheet.
//
// KEY NAMES (so you can search for them)
//   tables and state: _compassExpanded
//   functions (5): toggleCompass, setCareerGoal, onCareerGoalSelect,
//   setCareerGoalFromLevelUp, renderCareerCompass
//
// WHERE IT CAME FROM
//   Gathered from js/rules/22-career-compass.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ---- Compass UI ----
let _compassExpanded = null;
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
