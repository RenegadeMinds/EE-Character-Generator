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
  const c = currentChar();
  if (c) renderCareerCompass(c);
}
function setCareerGoal(name) {
  const c = currentChar();
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
    const selHTML = `<select onchange="onCareerGoalSelect(this)" class="fs-11" style="max-width:220px;">
      <option value="">— set a goal —</option>
      ${goalable.map(([label, names]) => `<optgroup label="${label}">${names.map(n =>
        `<option value="${esc(n)}"${st && st.goal === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}
    </select>`;
    if (!st) {
      slot.innerHTML = `<div class="rounded-3 items-center gap-8 p-5-10 fs-11 c-g60" style="display:inline-flex;border:1px dashed rgb(var(--line-gold) / .3);">
        ⭐ Career Compass ${selHTML}</div>`;
      return;
    }
    if (st.invalid) {
      slot.innerHTML = `<div class="rounded-3 p-5-10 fs-11 c-red-text" style="border:1px solid rgb(var(--line-red) / .3);">
        ⭐ Career goal "${esc(st.goal)}" not found (renamed?). <button class="fs-10 btn btn-sm" onclick="setCareerGoal('')">Clear</button></div>`;
      return;
    }
    const tierLabel = {advanced:'Advanced', prestige:'Prestige', hero:'Hero', basic:'Basic', ordinary:'Ordinary'}[st.tier] || st.tier;
    let statusChip;
    if (st.owned) statusChip = `<span class="bold" style="color:rgb(var(--text-green));">🎉 ACHIEVED</span>`;
    else if (st.met) statusChip = `<span class="bold" style="color:rgb(var(--text-green));">✓ UNLOCKED — take your first level!</span>`;
    else statusChip = `<span class="c-g85">${st.metCount}/${st.totalCount} met · earliest entry ~level ${st.earliest}${st.gmGated ? ' + GM gate' : ''} <span class="o-55 c-dim">(best case)</span></span>`;
    const arrow = _compassExp() ? '▾' : '▸';
    let html = `<div class="rounded-3 fs-12" style="border:1px solid rgb(var(--line-blue) / .35);background:rgb(var(--tint-blue) / .05);">
      <div class="items-center gap-8 p-6-10 flex-wrap" style="display:flex;">
        <span onclick="toggleCompass()" class="cursor-pointer font-serif ls-0_05em" style="color:rgb(var(--text-blue));">${arrow} ⭐ Career Compass:</span>
        <b class="c-gold">${esc(st.goal)}</b>
        <span class="fs-10 uppercase ls-0_04em" style="color:var(--tk80);">${tierLabel}</span>
        ${statusChip}
        <button class="fs-10 p-2-7 ml-auto btn btn-sm" onclick="setCareerGoal('')" title="Clear the career goal">✕ Clear</button>
      </div>`;
    if (_compassExp()) {
      html += `<div class="p-8-12" style="border-top:1px solid rgb(var(--line-blue) / .2);">`;
      if (st.owned) {
        html += `<div style="color:rgb(var(--text-green));">The path is walked — <b>${esc(st.goal)}</b> is on your class list. Set a new goal whenever the next horizon calls.</div>`;
      } else {
        for (const g of st.groups) {
          if (g.met) {
            html += `<div class="p-2-0" style="color:rgb(var(--text-green));">✓ <span class="op-0_75">${esc(g.options.map(o => o.desc).join(' or '))}</span></div>`;
            continue;
          }
          const allGM = g.options.every(o => o.kind !== 'build');
          const icon = allGM ? '<span class="c-vio">◈</span>' : '<span style="color:var(--g90);">○</span>';
          const parts = g.options.map(o => esc(o.desc) + (o.prog ? ` <span class="o-65 c-dim">(${esc(o.prog)})</span>` : ''));
          // advice: from the soonest buildable option, else the first option's
          const best = g.options.filter(o => o.kind === 'build' && o.earliest !== null).sort((a, b) => a.earliest - b.earliest)[0] || g.options[0];
          html += `<div class="p-2-0">${icon} ${parts.join(' <span class="o-50 c-dim">or</span> ')}
            ${best && best.advice ? `<div class="fs-10_5 c-g55" style="margin-left:16px;">↳ ${esc(best.advice)}</div>` : ''}</div>`;
        }
        // Advisor line — greedy, one step, reasons shown.
        const adv = careerNextStep(c, st);
        if (adv && adv.top) {
          html += `<div class="mt-8 p-6-8 rounded-3 fs-11_5" style="background:rgb(var(--tint-blue) / .08);">
            <span style="color:rgb(var(--text-blue));">Suggested next step:</span> <b class="c-gold">${esc(adv.top.name)}</b>
            <span class="op-0_75">— ${esc(adv.top.reasons.join('; '))}</span>
            ${adv.runnerUp ? `<div class="fs-10_5 op-0_6 mt-2">Runner-up: ${esc(adv.runnerUp.name)} — ${esc(adv.runnerUp.reasons.join('; '))}</div>` : ''}
            <div class="fs-10 op-0_45 mt-2">Most direct progression suggestion — it optimizes your next level for the most direct route, not necessarily the most optimized one. Rarely is there only one way to build a character.</div>
          </div>`;
        } else if (!st.met) {
          html += `<div class="mt-8 fs-11 op-0_6">No class choice materially speeds this up — the remaining gates are attribute-, feat-slot-, or story-timed.</div>`;
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
