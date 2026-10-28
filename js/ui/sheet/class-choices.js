// =============================================================================
// js/ui/sheet/class-choices.js
// SHEET / CLASS CHOICES — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Sheet: the class-choice panel.
//
// KEY NAMES (so you can search for them)
//   functions (2): setClassChoice, renderClassChoices
//
// WHERE IT CAME FROM
//   Gathered from js/rules/17-per-diem-and-class-choices.js when the code
//   was regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function setClassChoice(key, value) {
  const c = currentChar(); if (!c) return;
  if (!c.classChoices) c.classChoices = {};
  if (value) c.classChoices[key] = value; else delete c.classChoices[key];
  reconcileClassAttrBakes(c);
  reconcileGrantedFeats(c);
  save(); renderSheet(); renderSkills(); renderGear();
}
// The Sheet's 🎓 Class Choices panel.
function renderClassChoices(c) {
  const host = document.getElementById('sh-classchoices');
  if (!host) return;
  const specs = computeClassChoiceSpecs(c);
  // v8.66.0: the skill-set designations can exist without picker specs —
  // the empty-panel gate must consider both.
  const _ssAny = computeSkillSetSpecs(c).length > 0;
  if (!specs.length && !_ssAny) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const pending = specs.filter(s => !s.chosen).length;
  const rows = specs.map(s => {
    const extra = s.kind === 'terrain' && s.chosen ? ` <span class="o-65 c-dim">— ${TERRAIN_MASTERY_DATA[s.chosen].desc}</span>`
      : s.kind === 'rogueSA' && s.chosen ? ` <span class="o-65 c-dim">— ${ROGUE_SPECIAL_ABILITIES[s.chosen]}</span>` : '';
    const sel = s.chosen
      ? `<b style="color:rgb(var(--text-sky) / .95);">${escapeHTML(s.chosen)}</b>${extra} <span class="cursor-pointer op-0_5 fs-10" title="Clear this choice (GM retcon)" onclick="setClassChoice('${s.key}','')">✕</span>`
      : `<select onchange="setClassChoice('${s.key}', this.value)" class="fs-11"><option value="">— choose —</option>${s.options.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select>`;
    return `<div class="gap-8 items-center fs-11_5 m-2-0" style="display:flex;">
      <span class="cursor-help c-g75" style="flex:0 0 auto;" title="${escapeHTML(s.note)}">${s.className} — ${s.feature}${s.idx > 1 || s.kind === 'skill' || s.kind === 'save' || s.kind === 'enemy' ? ` #${s.idx}` : ''} <span class="o-50 c-dim">(L${s.atLvl})</span></span>
      <span class="flex-1">${sel}</span></div>`;
  }).join('');
  const feList = computeFavoredEnemies(c);
  const feRow = feList.length ? `<div class="fs-11 mt-4 c-g80">🎯 <b>Favored Enemies:</b> ${feList.map(f => `${escapeHTML(f.type)} +${f.bonus}`).join(', ')} <span class="o-60 c-dim">(damage &amp; Bluff/Listen/Sense Motive/Spot/Survival vs the type — apply at the table)</span></div>` : '';
  // v8.66.0 (Adam's design): Take-10 skill-set designations — collapsible
  // one-liners, ⚑-amber while open slots remain, red while over capacity.
  const ssSpecs = computeSkillSetSpecs(c);
  let ssRows = '', ssPending = 0;
  if (ssSpecs.length) {
    if (!window._ssOpen) window._ssOpen = {};
    ssRows = ssSpecs.map(s => {
      const picks = ((c.skillSets || {})[s.key]) || [];
      const open = !!window._ssOpen[s.key];
      const slotsLeft = Math.max(0, s.cap - picks.length);
      const over = picks.length > s.cap;
      if (slotsLeft) ssPending += slotsLeft;
      const opts = s.eligible.filter(n => !picks.includes(n));
      const body = open ? `<div class="fs-11" style="margin:2px 0 4px 18px;">
          ${picks.map((p, i) => `<span style="display:inline-block;margin:1px 8px 1px 0;color:rgb(var(--text-sky) / .95);">${escapeHTML(p)} <span class="cursor-pointer op-0_5 fs-10" title="Remove this designation (GM retcon)" onclick="removeSkillSetPick('${s.key}',${i})">✕</span></span>`).join('') || '<i class="op-0_5">none designated yet</i>'}
          ${slotsLeft > 0 ? `<div class="mt-2"><select onchange="addSkillSetPick('${s.key}', this.value)" class="fs-11"><option value="">— designate a skill (${slotsLeft} open) —</option>${opts.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select></div>` : ''}
          ${over ? `<div class="c-red-text fs-10">⚠ ${picks.length - s.cap} over capacity — the base ${s.attrName} score dropped; the GM adjudicates which designations lapse (nothing auto-deletes).</div>` : ''}
        </div>` : '';
      return `<div class="fs-11_5 m-2-0">
        <span class="cursor-pointer select-none" onclick="window._ssOpen['${s.key}']=!window._ssOpen['${s.key}'];renderClassChoices(currentChar())">${open ? '▾' : '▸'}</span>
        <span class="cursor-help c-g75" title="${escapeHTML(s.note)}">${s.className} — ${s.feature} <span class="o-50 c-dim">(L${s.atLvl} · Take 10)</span></span>
        <b style="color:rgb(var(--text-sky) / .95);">${picks.length}/${s.cap} designated</b>${slotsLeft ? ` <span class="fs-10" style="color:rgb(var(--text-amber));">⚑ ${slotsLeft} open</span>` : ''}${over ? ' <span class="c-red-text fs-10">⚠ over capacity</span>' : ''}
      </div>${body}`;
    }).join('');
  }
  const pendingAll = pending + ssPending;
  host.innerHTML = `<div class="font-serif fs-10 c-bronze mb-4">🎓 Class Choices${pendingAll ? ` <span class="fs-9" style="color:rgb(var(--text-amber));">(${pendingAll} pending)</span>` : ''}</div>${rows}${ssRows}${feRow}`;
}
