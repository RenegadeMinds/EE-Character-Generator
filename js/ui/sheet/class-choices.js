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
  const c = chars.find(x => x.id === curId); if (!c) return;
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
    const extra = s.kind === 'terrain' && s.chosen ? ` <span style="opacity:var(--o65);color:var(--dim);">— ${TERRAIN_MASTERY_DATA[s.chosen].desc}</span>`
      : s.kind === 'rogueSA' && s.chosen ? ` <span style="opacity:var(--o65);color:var(--dim);">— ${ROGUE_SPECIAL_ABILITIES[s.chosen]}</span>` : '';
    const sel = s.chosen
      ? `<b style="color:rgba(120,175,205,.95);">${escapeHTML(s.chosen)}</b>${extra} <span style="cursor:pointer;opacity:.5;font-size:10px;" title="Clear this choice (GM retcon)" onclick="setClassChoice('${s.key}','')">✕</span>`
      : `<select onchange="setClassChoice('${s.key}', this.value)" style="font-size:11px;"><option value="">— choose —</option>${s.options.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select>`;
    return `<div style="display:flex;gap:8px;align-items:center;font-size:11.5px;margin:2px 0;">
      <span style="flex:0 0 auto;cursor:help;color:var(--g75);" title="${escapeHTML(s.note)}">${s.className} — ${s.feature}${s.idx > 1 || s.kind === 'skill' || s.kind === 'save' || s.kind === 'enemy' ? ` #${s.idx}` : ''} <span style="opacity:var(--o50);color:var(--dim);">(L${s.atLvl})</span></span>
      <span style="flex:1;">${sel}</span></div>`;
  }).join('');
  const feList = computeFavoredEnemies(c);
  const feRow = feList.length ? `<div style="font-size:11px;margin-top:4px;color:var(--g80);">🎯 <b>Favored Enemies:</b> ${feList.map(f => `${escapeHTML(f.type)} +${f.bonus}`).join(', ')} <span style="opacity:var(--o60);color:var(--dim);">(damage &amp; Bluff/Listen/Sense Motive/Spot/Survival vs the type — apply at the table)</span></div>` : '';
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
      const body = open ? `<div style="margin:2px 0 4px 18px;font-size:11px;">
          ${picks.map((p, i) => `<span style="display:inline-block;margin:1px 8px 1px 0;color:rgba(120,175,205,.95);">${escapeHTML(p)} <span style="cursor:pointer;opacity:.5;font-size:10px;" title="Remove this designation (GM retcon)" onclick="removeSkillSetPick('${s.key}',${i})">✕</span></span>`).join('') || '<i style="opacity:.5;">none designated yet</i>'}
          ${slotsLeft > 0 ? `<div style="margin-top:2px;"><select onchange="addSkillSetPick('${s.key}', this.value)" style="font-size:11px;"><option value="">— designate a skill (${slotsLeft} open) —</option>${opts.map(o => `<option>${escapeHTML(o)}</option>`).join('')}</select></div>` : ''}
          ${over ? `<div style="color:var(--red-text);font-size:10px;">⚠ ${picks.length - s.cap} over capacity — the base ${s.attrName} score dropped; the GM adjudicates which designations lapse (nothing auto-deletes).</div>` : ''}
        </div>` : '';
      return `<div style="font-size:11.5px;margin:2px 0;">
        <span style="cursor:pointer;user-select:none;" onclick="window._ssOpen['${s.key}']=!window._ssOpen['${s.key}'];renderClassChoices(chars.find(x=>x.id===curId))">${open ? '▾' : '▸'}</span>
        <span style="cursor:help;color:var(--g75);" title="${escapeHTML(s.note)}">${s.className} — ${s.feature} <span style="opacity:var(--o50);color:var(--dim);">(L${s.atLvl} · Take 10)</span></span>
        <b style="color:rgba(120,175,205,.95);">${picks.length}/${s.cap} designated</b>${slotsLeft ? ` <span style="color:#d4b870;font-size:10px;">⚑ ${slotsLeft} open</span>` : ''}${over ? ' <span style="color:var(--red-text);font-size:10px;">⚠ over capacity</span>' : ''}
      </div>${body}`;
    }).join('');
  }
  const pendingAll = pending + ssPending;
  host.innerHTML = `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);margin-bottom:4px;">🎓 Class Choices${pendingAll ? ` <span style="color:#d4b870;font-size:9px;">(${pendingAll} pending)</span>` : ''}</div>${rows}${ssRows}${feRow}`;
}
