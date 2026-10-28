// =============================================================================
// js/ui/create/preview.js
// CREATE / PREVIEW — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Create page: the class preview, attribute bumps and
//   the HP mode controls.
//
// KEY NAMES (so you can search for them)
//   functions (12): updateClassPreview, renderAllPrereqChecks,
//   applyAttrBumps, renderAttrBumpsPanel, onAttrBumpChange, getFormHpMode,
//   setFormHpMode, onHpModeChange, rerollFormHp, renderHpRollPreview,
//   updateDerived, syncFormHpRollsLength
//
// WHERE IT CAME FROM
//   Gathered from js/app/46-create-preview-and-defense.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== CLASS PREVIEW & DERIVED (operating on formClasses array) ==========
function updateClassPreview(){
  const prev=document.getElementById('class-preview');
  if(!prev)return;
  // Live preview text — list each class entry
  const sl=getSixLevels();
  const dis=disabledClassesForScenario(sl);
  let html='';
  for(const e of formClasses){
    const cls=getClassEntry(e);
    if(!cls){html+=`<span class="c-red-text">${e.name} (${e.tier}) — class data not found</span><br>`;continue;}
    const tierLabel={hero:'',basic:' (Basic)',advanced:' (Advanced)',prestige:` (Prestige, max ${cls.maxLvl||10})`}[e.tier]||'';
    const apHint=e.tier==='hero'?` · AP ${cls.apB}+½lvl`:'';
    const flag=dis.has(e.name)?' <span class="c-red-text">⚠ scenario-disallowed</span>':'';
    html+=`<span class="c-gold">${e.name}</span> Lvl ${e.level} · d${cls.hd} · ${cls.sp}+Int SP/lvl${apHint}<span class="c-g50">${tierLabel}</span>${flag}<br>`;
  }
  const totalLvl=formClasses.reduce((s,e)=>s+(e.level||0),0);
  const _eclRace=document.getElementById('c-race').value;
  const eclMod=_eclRace==='Hybrid'?(_formHybridRlm()):(RACES[_eclRace]?.ecl||0);  // v8.68.0: Hybrid-aware
  html+=`<span class="c-g50">Total Level: ${totalLvl} &nbsp;|&nbsp; ECL: ${totalLvl+eclMod}</span>`;
  prev.innerHTML=html;
  renderAllPrereqChecks();
  // v8.2.3 (Issue B): re-render the bumps panel since totalLvl may have changed.
  // This appears/disappears based on totalLvl >= 4.
  renderAttrBumpsPanel();
  updateDerived();
}
// Render prereq panels for every Advanced and Prestige class entry in the form
function renderAllPrereqChecks(){
  const root=document.getElementById('prereq-checks');
  if(!root)return;
  let skills={},feats=[];
  if(editId){
    const existing=chars.find(c=>c.id===editId);
    if(existing){skills=existing.skills||{};feats=existing.feats||[];}
  }
  const sl=getSixLevels();
  // Pull live form values for attribute / allegiance checks
  const ctx={
    attrs:getAttrs(),
    allegiance:document.getElementById('c-allegiance')?.value||'',
    align:document.getElementById('c-align')?.value||'',
  };
  const panels=[];
  for(const e of formClasses){
    // v8.3.23: check all four tiers (Hero/Basic attrMin now surfaced too).
    // Hero and Basic classes typically have no `prereqs` array, so the check
    // returns met=true unless attrMin is unmet.
    const otherEntries=formClasses.filter(x=>x!==e);
    const result=checkClassPrereqsFromArray(e.name, otherEntries, skills, feats, sl, ctx);
    const tierLabel={hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier]||e.tier;
    // Only surface a panel entry if there's a violation, OR the class is
    // Advanced/Prestige (where the all-met state is informative). For Hero/Basic
    // classes with no violation, suppress the noise.
    if(!result.met){
      panels.push(`<div class="rounded-3 c-red-text p-7-10 fs-12" style="border:1px solid rgb(var(--line-blood) / .3);background:rgb(var(--tint-blood) / .08);"><b>⚠ Missing prerequisites</b> for ${e.name} (${tierLabel}):<ul class="p-0" style="margin:4px 0 0 1.2em;">${result.missing.map(m=>`<li>${m}</li>`).join('')}</ul><div class="fs-11 mt-4 c-g55">Items marked "GM-verify" can't be auto-checked — confirm with your GM. Save anyway if granted an exception.</div></div>`);
    } else if(e.tier==='advanced' || e.tier==='prestige'){
      panels.push(`<div class="rounded-3 p-7-10 fs-12" style="color:rgb(var(--text-green));border:1px solid rgb(var(--line-forest) / .3);background:rgb(var(--tint-forest) / .08);"><b>✓ Prerequisites met</b> for ${e.name} (${tierLabel}).</div>`);
    }
  }
  root.innerHTML=panels.join('');
}
// v8.2.3 (Issue B): Compute "effective" attribute scores — base + racial is
// already baked into c.attrs as stored. Then we add the attribute bumps from
// the bumps list. Returns a new array of 6 ints. Does NOT mutate the input.
function applyAttrBumps(baseAttrs, bumps) {
  const out = baseAttrs.slice();
  if (!Array.isArray(bumps)) return out;
  for (const bump of bumps) {
    if (!bump) continue;
    const idx = ATTR_NAMES.indexOf(bump);
    if (idx >= 0) out[idx] = (out[idx] || 0) + 1;
  }
  return out;
}

// v8.2.3 (Issue B): Render the bumps panel based on current totalLvl and
// formAttrBumps. The panel is shown when totalLvl >= 4 and hidden otherwise.
function renderAttrBumpsPanel() {
  const panel = document.getElementById('attr-bumps-panel');
  const rowsDiv = document.getElementById('attr-bumps-rows');
  if (!panel || !rowsDiv) return;
  const totalLvl = formClasses.reduce((s, e) => s + (e.level||0), 0);
  const need = bumpCountForLevel(totalLvl);
  if (need <= 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  // Ensure formAttrBumps is sized correctly. Preserve existing assignments
  // when growing/shrinking.
  while (formAttrBumps.length < need) formAttrBumps.push('');
  if (formAttrBumps.length > need) formAttrBumps = formAttrBumps.slice(0, need);
  // Build rows
  const rows = [];
  for (let i = 0; i < need; i++) {
    const level = (i + 1) * 4;
    const sel = formAttrBumps[i] || '';
    const opts = ['<option value="">— choose attribute —</option>'].concat(
      ATTR_NAMES.map(a => `<option value="${a}" ${a===sel?'selected':''}>${a}</option>`)
    ).join('');
    const status = sel
      ? `<span class="c-g65 fs-10">→ +1 ${sel}</span>`
      : `<span class="fs-10" style="color:rgb(var(--text-amber));">⚠ pending</span>`;
    rows.push(`<div class="gap-8 items-center" style="display:flex;">
      <span class="font-serif fs-11 c-g75" style="min-width:75px;">Level ${level}:</span>
      <select onchange="onAttrBumpChange(${i}, this.value)" class="flex-1 fs-12" style="max-width:160px;">${opts}</select>
      ${status}
    </div>`);
  }
  rowsDiv.innerHTML = rows.join('');
}

function onAttrBumpChange(idx, value) {
  while (formAttrBumps.length <= idx) formAttrBumps.push('');
  formAttrBumps[idx] = value || '';
  renderAttrBumpsPanel();
  // Recompute derived stats since attribute mods may have changed
  updateDerived();
}

// v8.2.3 (Issue A): HP mode helpers for the create form. Reads the radio
// button group to find the current mode, regenerates formHpRolls when the
// mode changes or the player clicks re-roll, and renders a preview of the
// per-level rolls so the player sees what they got.
function getFormHpMode() {
  const radios = document.querySelectorAll('input[name="c-hp-mode"]');
  for (const r of radios) if (r.checked) return r.value;
  return 'hero';
}

function setFormHpMode(mode) {
  formHpMode = mode;
  const radios = document.querySelectorAll('input[name="c-hp-mode"]');
  for (const r of radios) r.checked = (r.value === mode);
}

function onHpModeChange() {
  formHpMode = getFormHpMode();
  // Regenerate rolls for the new mode
  formHpRolls = generateHpRolls(formClasses, formHpMode);
  renderHpRollPreview();
  updateDerived();
}

function rerollFormHp() {
  formHpMode = getFormHpMode();
  formHpRolls = generateHpRolls(formClasses, formHpMode);
  renderHpRollPreview();
  updateDerived();
  toast('HP re-rolled (' + formHpMode + ' mode).');
}

function renderHpRollPreview() {
  const el = document.getElementById('hp-roll-preview');
  if (!el) return;
  if (!formHpRolls || formHpRolls.length === 0) {
    el.textContent = '';
    return;
  }
  // Tag each roll with its class context for readability
  const tags = [];
  let rollIdx = 0;
  for (const e of formClasses) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      if (rollIdx < formHpRolls.length) {
        const isFirst = (rollIdx === 0);
        const roll = formHpRolls[rollIdx];
        tags.push(`${e.name} L${j+1}: ${roll}${isFirst ? ' (max)' : ''}/d${cls.hd}`);
      }
      rollIdx++;
    }
  }
  if (tags.length === 0) {
    el.textContent = '';
    return;
  }
  el.innerHTML = '<b>Per-level rolls:</b> ' + tags.join(' &middot; ');
}

function updateDerived(){
  const baseAttrs=getAttrs();
  // v8.2.3 (Issue B): apply attribute bumps before computing modifiers
  const attrs = applyAttrBumps(baseAttrs, formAttrBumps);
  const conM=am(attrs[2]),dexM=am(attrs[1]),wisM=am(attrs[4]),strM=am(attrs[0]);
  const _formHeroic = parseInt(document.getElementById('c-sl-heroic')?.value) || 0;
  const _formFP = (editId && chars.find(x=>x.id===editId)?.fatePoints) || 0;
  // v8.3.32: route the heroic level through effectiveHeroicLevelForAP so the
  // form preview correctly shows NO AP for a purely-Ordinary build. Pass a
  // synthetic {classes, sixLevels} so the helper can inspect the form's
  // current class list.
  const _formApHeroic = effectiveHeroicLevelForAP({classes: formClasses, sixLevels: {heroic: _formHeroic}});
  const s=computeStatsFromClasses(formClasses, attrs[5], _formApHeroic, _formFP);
  // v8.3.5: read the two natural-AC form fields. Racial is auto-populated
  // by updateRaceInfo from the race's structured natAC; bonus is the
  // player-editable field for magic/equipment. They compose by simple sum
  // here in the form preview (where we don't have a full source-typed
  // model yet). The hidden c-natural-ac field is synced for backward
  // compatibility with any read paths not yet migrated.
  const racialNACForm = parseInt(document.getElementById('c-racial-nac')?.value) || 0;
  const bonusNACForm  = parseInt(document.getElementById('c-bonus-nac')?.value)  || 0;
  const naturalACTotal = racialNACForm + bonusNACForm;
  const legacyNACEl = document.getElementById('c-natural-ac');
  if (legacyNACEl) legacyNACEl.value = naturalACTotal;
  // Synthesize a minimal char-shaped object for the preview helpers
  const formChar = {
    attrs, def: s.def, bab: s.bab, ref: s.ref, feats: [],
    armorAC:  parseInt(document.getElementById('c-armor-ac')?.value)  || 0,
    shieldAC: parseInt(document.getElementById('c-shield-ac')?.value) || 0,
    naturalAC: naturalACTotal,
  };
  // v8.2.3: ensure formHpRolls matches the current class array shape.
  syncFormHpRollsLength();
  // v8.2.3 (Issue A): use stored rolls for HP. +5 per natural AC (HH p.347).
  const hp=computeMaxHPFromRolls(formClasses,formHpRolls,conM) + (naturalACTotal * 5);
  const acDisp = computeACDisplay(formChar);
  const parry  = computeParryBonus(formChar);
  const dodge  = computeDodgeBonus(formChar);
  const el=document.getElementById('derived-stats');
  if(el){
    const stats = [
      {l:'Max HP',v:hp},
      {l:acDisp.label, v:acDisp.value},
      {l:'Parry', v:(parry.total>=0?'+':'')+parry.total},
      {l:'Dodge', v:(dodge.total>=0?'+':'')+dodge.total},
    ];
    // Natural Hardness only appears for characters with a natural AC modifier
    if (formChar.naturalAC > 0) {
      stats.push({l:'Nat. Hardness', v:formChar.naturalAC});
    }
    stats.push(
      {l:'Base Attack',v:(s.bab>=0?'+':'')+s.bab},
      {l:'Initiative',v:(dexM>=0?'+':'')+dexM},{l:'Def Bonus',v:(s.def>=0?'+':'')+s.def},
      {l:'Fort Save',v:(s.fort+conM>=0?'+':'')+(s.fort+conM)},{l:'Ref Save',v:(s.ref+dexM>=0?'+':'')+(s.ref+dexM)},
      {l:'Will Save',v:(s.will+wisM>=0?'+':'')+(s.will+wisM)},{l:'Action Pts',v:s.ap},{l:'Total Lvl',v:s.totalLvl},
    );
    el.innerHTML = stats.map(c=>`<div class="stat-cell"><span class="sc-lbl">${c.l}</span><span class="sc-val">${c.v}</span></div>`).join('');
  }
  // Render the HP roll preview after the rolls have been synced
  renderHpRollPreview();
}

// v8.2.3 (Issue A): keep formHpRolls aligned with formClasses' total level.
// Grows by rolling at the current mode; shrinks by truncation (preserves
// earlier rolls so removing levels doesn't re-randomize what's left).
function syncFormHpRollsLength() {
  let needed = 0;
  for (const e of formClasses) needed += Math.max(0, e.level || 0);
  if (formHpRolls.length === needed) return;
  if (formHpRolls.length > needed) {
    formHpRolls = formHpRolls.slice(0, needed);
    return;
  }
  // Need to grow. Determine which die to roll for each new level (level-by-
  // level walk of formClasses, skipping the levels we already have rolls for).
  let cursor = 0;
  for (const e of formClasses) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      if (cursor >= formHpRolls.length) {
        // Roll for this level. First-overall level gets max regardless.
        const isFirstOverall = (cursor === 0);
        formHpRolls.push(isFirstOverall ? cls.hd : rollHitDieForMode(cls.hd, formHpMode));
      }
      cursor++;
    }
  }
}
