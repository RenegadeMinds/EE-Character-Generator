// =============================================================================
// js/ui/create/classes.js
// CREATE / CLASSES — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Create page: the class list, class sub-options and
//   the Add Class dialog.
//
// KEY NAMES (so you can search for them)
//   tables and state: formClasses, formSubOptions
//   functions (15): renderClassSubOptions, onSubOptChange, onScale0Pick,
//   onSubOptDomain, renderClassList, hasCareerPathLockingLevel,
//   hasNonHeroEntry, openAddClassDialog, cancelAddClass,
//   onAddClassTierChange, updateAddClassWarnings, confirmAddClass,
//   removeClassAt, onClassLevelChange, setFirstClass
//
// WHERE IT CAME FROM
//   Gathered from js/app/45-create-class-list.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== MULTI-CLASS LIST (the in-progress class array on the create form) ==========
// `formClasses` is the source of truth for the form. Entries are {tier, name, level, first}.
// On save it's stored on char.classes; on edit it's loaded from there.
let formClasses = [];
// v8.5.4: class sub-option form state (Adam's rulings, 2026-08-24). Persisted
// as character-level lazy fields; see the SPELL_LIST_TOKENS comment for how
// each gates spell access.
let formSubOptions = {clericDomains:[], druidOption:false, saintDomains:[], paladinDomains:[], psionDiscipline:null, wizardSchool:null, wizardProhibited:[], rangerSecrets:[], bardStoryteller:[]};

// v8.5.4: render the per-class sub-option pickers below the class list.
// Only classes present in formClasses surface their block.
function renderClassSubOptions(){
  const host = document.getElementById('class-sub-options');
  if (!host) return;
  const names = new Set(formClasses.filter(e => (e.level||0) > 0).map(e => e.name));
  const blocks = [];
  const domainOpts = (sel) => '<option value="">— none —</option>' +
    DOMAINS_DB.map(d => `<option${d.name===sel?' selected':''}>${d.name}</option>`).join('');
  if (names.has('Cleric')) {
    const so = formSubOptions;
    const alignOk = /Neutral/i.test(document.getElementById('c-align')?.value || '');
    const techZero = ((getSixLevels().tech ?? 0) < 1);
    if (techZero && !so.druidOption) {
      // v8.5.4: availability-table footnote — at Tech 0 the base Cleric is
      // unavailable; only the Druid Option qualifies.
      blocks.push(`<div class="sub-opt-block" style="border-left-color:rgb(var(--line-amber));">
        <div class="fs-11" style="color:rgb(var(--text-amber));">⚠ Tech Scale 0 scenario: the base Cleric is unavailable — only the <b>Druid Option</b> below qualifies (HH availability table). Enable it, or this will be recorded as a GM exception at save.</div>
      </div>`);
    }
    blocks.push(`<div class="sub-opt-block">
      <div class="sub-opt-head">Cleric Options</div>
      <label class="items-center gap-6 fs-12 cursor-pointer" style="display:flex;">
        <input type="checkbox" ${so.druidOption?'checked':''} onchange="onSubOptChange('druidOption', this.checked)">
        <b>The Druid Option</b> — trade Turn Undead + both Domains for the Druid spell list, Animal Companion, Wild Empathy, Woodland Stride (3rd), Wildshape (5th)
      </label>
      ${so.druidOption
        ? `<div class="fs-11 c-g60 mt-4">Adds Knowledge (Nature) &amp; Survival as class skills. No metal weapons/armor.${alignOk?'':' <span style="color:rgb(var(--text-amber));">⚠ Druids require a Neutral alignment component — current alignment doesn’t qualify (GM confirm).</span>'}</div>`
        : `<div class="gap-8 mt-6 items-center flex-wrap" style="display:flex;">
            <span class="fs-11 c-g65">Domains (choose 2):</span>
            <select onchange="onSubOptDomain('clericDomains', 0, this.value)">${domainOpts(so.clericDomains[0]||'')}</select>
            <select onchange="onSubOptDomain('clericDomains', 1, this.value)">${domainOpts(so.clericDomains[1]||'')}</select>
          </div>
          ${(so.clericDomains||[]).filter(Boolean).map(d => {
            const dd = DOMAINS_DB.find(x => x.name === d);
            return dd ? `<div class="fs-10_5 c-g50 mt-3"><b class="c-g70">${d}:</b> ${escapeHTML(dd.grantedPower.slice(0,180))}${dd.grantedPower.length>180?'…':''}${dd.prerequisite?` <span style="color:rgb(var(--text-amber));">[Prereq: ${escapeHTML(dd.prerequisite)}]</span>`:''}</div>` : '';
          }).join('')}`}
    </div>`);
  }
  if (names.has('Saint')) {
    const sd = formSubOptions.saintDomains || [];
    blocks.push(`<div class="sub-opt-block">
      <div class="sub-opt-head">Saint — Deity’s Domains</div>
      <div class="fs-11 c-g60 mb-4">A Saint gains access to ALL the domains of their god (typically 3–4). These ARE the Saint’s spell list; Personal Domain picks are added on the Powers &amp; Spells tab from 3rd level.</div>
      <div class="gap-6 flex-wrap" style="display:flex;">
        ${[0,1,2,3].map(i => `<select onchange="onSubOptDomain('saintDomains', ${i}, this.value)">${domainOpts(sd[i]||'')}</select>`).join('')}
      </div>
    </div>`);
  }
  if (names.has('Paladin')) {
    const pd = formSubOptions.paladinDomains || [];
    blocks.push(`<div class="sub-opt-block">
      <div class="sub-opt-head">Paladin — Deity’s Domains</div>
      <div class="fs-11 c-g60 mb-4">From 4th level a Paladin casts spontaneously, like a Saint, drawing ONLY from their god’s Domain lists (HH). Choose the deity’s domains to unlock spell browsing.</div>
      <div class="gap-6 flex-wrap" style="display:flex;">
        ${[0,1,2,3].map(i => `<select onchange="onSubOptDomain('paladinDomains', ${i}, this.value)">${domainOpts(pd[i]||'')}</select>`).join('')}
      </div>
    </div>`);
  }
  // v8.5.4: Scale-0 variant pickers (Nature's Secrets / Storyteller). Read
  // the form's live scenario so toggling a Scale re-shapes the block.
  const sixNow = getSixLevels();
  const scale0Block = (className) => {
    const v = SCALE0_VARIANTS[className];
    const entry = formClasses.find(e => e.name === className);
    const budget = scale0VariantBudget(className, entry?.level || 0);
    const picks = formSubOptions[v.field] || [];
    const elig = scale0EligibleSkills(className);
    const axisLabel = v.axis.charAt(0).toUpperCase() + v.axis.slice(1);
    const opts = (sel) => '<option value="">— pick skill —</option>' + elig.map(s => `<option${s===sel?' selected':''}>${s}</option>`).join('');
    return `<div class="sub-opt-block">
      <div class="sub-opt-head">${className} — ${v.feature} <span class="fw-normal fs-10 c-g50">(${axisLabel} Scale 0 variant)</span></div>
      <div class="fs-11 c-g60 mb-4">No ${v.axis} magic in this scenario — spellcasting is replaced by ${v.feature}: each pick grants +1 competence to a ${v.attrKey}-based class skill, and picks may stack on the same skill. Picks unlock at class levels ${v.milestones.join(' / ')}. ${budget ? `Available now: <b class="c-gold">${budget}</b>.` : 'None yet at this level.'}</div>
      ${budget ? `<div class="gap-6 flex-wrap" style="display:flex;">` +
        Array.from({length: budget}, (_, i) => `<select onchange="onScale0Pick('${v.field}', ${i}, this.value)">${opts(picks[i]||'')}</select>`).join('') + `</div>` : ''}
    </div>`;
  };
  if (names.has('Ranger')) {
    blocks.push((sixNow.divine || 0) === 0 ? scale0Block('Ranger') : `<div class="sub-opt-block">
      <div class="sub-opt-head">Ranger — Spellcasting <span class="fw-normal fs-10 c-g50">(informational)</span></div>
      <div class="fs-11 c-g60">From 4th level the Ranger prepares divine spells from the <b>Druid spell list</b>, Cleric-style (daily meditation); caster level is one-half Ranger level, rounded up. No configuration needed — the Powers tab routes the Druid list automatically. <span class="op-0_7">(In a Divine Scale 0 scenario this becomes the Nature’s Secrets variant.)</span></div>
    </div>`);
  }
  if (names.has('Bard') && (sixNow.arcane || 0) === 0) {
    blocks.push(scale0Block('Bard'));
  }
  if (names.has('Psion')) {
    const disc = formSubOptions.psionDiscipline;
    blocks.push(`<div class="sub-opt-block">
      <div class="sub-opt-head">Psion — Discipline</div>
      <div class="fs-11 c-g60 mb-4">Mandatory at 1st level. Grants the discipline’s class skills and its restricted powers; powers of other disciplines become unlearnable (Expanded Knowledge is the exception).</div>
      <select onchange="onSubOptChange('psionDiscipline', this.value || null)">
        <option value="">— choose —</option>
        ${Object.keys(PSION_DISCIPLINE_INFO).map(n => `<option value="${n}"${disc===n?' selected':''}>${n} (${PSION_DISCIPLINE_INFO[n].discipline})</option>`).join('')}
      </select>
      ${disc ? `<span class="fs-10_5 c-g55 ml-8">Class skills: ${PSION_DISCIPLINE_INFO[disc].skills.join(', ')}</span>` : ''}
    </div>`);
  }
  if (names.has('Wizard')) {
    const so = formSubOptions;
    const isDiviner = so.wizardSchool === 'Divination';
    const prohibitedCount = isDiviner ? 1 : 2;
    const schoolOpts = (sel, excl) => '<option value="">— none —</option>' +
      WIZARD_SCHOOLS.filter(s => s !== 'Divination' && s !== so.wizardSchool && !(excl||[]).includes(s))
        .map(s => `<option${s===sel?' selected':''}>${s}</option>`).join('');
    blocks.push(`<div class="sub-opt-block">
      <div class="sub-opt-head">Wizard — School Specialization <span class="fw-normal fs-10 c-g50">(optional)</span></div>
      <div class="gap-8 items-center flex-wrap" style="display:flex;">
        <span class="fs-11 c-g65">Specialty:</span>
        <select onchange="onSubOptChange('wizardSchool', this.value || null)">
          <option value="">— generalist —</option>
          ${WIZARD_SCHOOLS.map(s => `<option${s===so.wizardSchool?' selected':''}>${s}</option>`).join('')}
        </select>
        ${so.wizardSchool ? `<span class="fs-11 c-g65">Prohibited (${prohibitedCount}):</span>
          ${Array.from({length: prohibitedCount}, (_, i) =>
            `<select onchange="onSubOptDomain('wizardProhibited', ${i}, this.value)">${schoolOpts(so.wizardProhibited[i]||'', so.wizardProhibited.filter((_,j)=>j!==i))}</select>`).join('')}` : ''}
      </div>
      ${so.wizardSchool ? `<div class="fs-10_5 c-g50 mt-3">Specialists prepare one extra ${so.wizardSchool} spell per spell level daily (PP-free) and get +2 Spellcraft to learn ${so.wizardSchool} spells. Prohibited-school spells are unavailable — not even from scrolls or wands. Divination can never be prohibited.</div>` : ''}
    </div>`);
  }
  host.innerHTML = blocks.length
    ? `<div class="mt-0_8rem flex-col" style="display:flex;gap:.6rem;">${blocks.join('')}</div>`
    : '';
}
function onSubOptChange(key, value){
  formSubOptions[key] = value;
  if (key === 'wizardSchool') {
    // respecialization resets prohibitions (and Diviners prohibit only one)
    formSubOptions.wizardProhibited = [];
  }
  renderClassSubOptions();
}
// v8.5.4: Scale-0 variant pick handler. Duplicates are deliberately ALLOWED
// (the HH invites stacking the same skill), so no dedupe here.
function onScale0Pick(field, idx, value){
  const arr = (formSubOptions[field] || []).slice();
  arr[idx] = value || '';
  formSubOptions[field] = arr;
  renderClassSubOptions();
}
function onSubOptDomain(key, idx, value){
  const cap = (key === 'saintDomains' || key === 'paladinDomains') ? 4 : 2;
  const arr = (formSubOptions[key] || []).slice(0, cap);
  arr[idx] = value || '';
  // compact + dedupe (first occurrence wins), capped per the rule
  const seen = new Set();
  formSubOptions[key] = arr.filter(v => v && !seen.has(v) && (seen.add(v), true)).slice(0, cap);
  renderClassSubOptions();
}

function renderClassList(){
  const list=document.getElementById('class-list');
  if(!list)return;
  // v8.4.0: L1 GENESIS GATE. New characters (no editId) are constrained to
  // exactly one class entry at level 1 — the typed-slot model + Hero's Gift
  // assignment + first-level skill-point dump all key off the 1st-level
  // genesis flow. Multi-class characters and higher levels are reached via
  // Level Up (canonical) or Edit (GM power tool). When in this mode:
  //   • the per-row level inputs are disabled at value=1
  //   • the "+ Add Class" button hides once one class is added
  //   • a brief inline note explains the constraint
  // The gate is OFF for Edit mode (editId !== null) — Edit stays fully
  // versatile per decision 5.
  const isL1Genesis = editId === null;
  if(formClasses.length===0){
    list.innerHTML=`<div class="rounded-3 p-1rem text-center c-g40 italic" style="border:1px dashed rgb(var(--line-gold) / .2);">No classes added yet — click "+ Add Class" to begin.</div>`;
  } else {
    list.innerHTML=formClasses.map((e,i)=>{
      const cls=getClassEntry(e);
      const hd=cls?cls.hd:'?';
      const sp=cls?cls.sp:'?';
      const tierLabel={hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier]||'?';
      const maxLvl=isL1Genesis ? 1 : tierMaxLevel(e);
      const lvlInpAttrs = isL1Genesis ? 'disabled' : '';
      const lvlInpTitle = isL1Genesis
        ? '1st-level genesis: new characters start at level 1. Use Level Up after saving.'
        : `max ${maxLvl}`;
      const isFirst=!!e.first;
      return`<div class="cls-row ${isFirst?'first':''}">
        <span class="cls-tier-badge cls-tier-${e.tier}">${tierLabel}</span>
        <span class="cls-name">${e.name}${citeHTML('classes', e.name)} <span class="fs-10 c-g45">d${hd} · ${sp}+Int SP</span></span>
        <input type="number" class="cls-lvl-inp" value="${e.level}" min="1" max="${maxLvl}" ${lvlInpAttrs} onchange="onClassLevelChange(${i}, this.value)" title="${lvlInpTitle}">
        <label class="cls-first-lbl" title="The 'first' class is the one whose 1st level uses the maximum die value for HP. Only one class can be marked first.">
          <input type="radio" name="cls-first-radio" ${isFirst?'checked':''} onchange="setFirstClass(${i})">1st
        </label>
        <button type="button" class="cls-rm-btn" onclick="removeClassAt(${i})" title="Remove this class">✕</button>
      </div>`;
    }).join('');
  }
  // v8.5.4: refresh the per-class sub-option pickers alongside the list, and
  // re-render the occupation pickers so their class-overlap annotations
  // track the current class selection.
  renderClassSubOptions();
  renderOccupationPicker('primary');
  renderOccupationPicker('secondary');
  // v8.4.0: hide/show the "+ Add Class" button based on the L1 genesis gate.
  const addBtn = document.getElementById('add-class-btn');
  if (addBtn) {
    if (isL1Genesis && formClasses.length >= 1) {
      addBtn.style.display = 'none';
    } else {
      addBtn.style.display = '';
    }
  }
  // Hint text below the list
  const hintEl=document.getElementById('class-list-hint');
  if(hintEl){
    const total=formClasses.reduce((s,e)=>s+(e.level||0),0);
    if (isL1Genesis) {
      if (formClasses.length === 0) {
        hintEl.innerHTML = `<span class="c-tv85">⬟ 1st-level genesis: pick ONE starting class. Use Level Up after saving to advance, or Edit (GM) to construct higher-level characters.</span>`;
      } else {
        hintEl.innerHTML = `<span class="c-tv85">⬟ 1st-level genesis active. The character will be saved at Level 1; use Level Up or Edit afterward.</span>`;
      }
    } else if(total===0) {
      hintEl.textContent='';
    } else {
      hintEl.textContent=`${formClasses.length} class${formClasses.length===1?'':'es'}, total Level ${total}`;
    }
  }
}
// v8.3.32: Career Path rule predicate. The handbook rule is "no NEW Hero
// classes may be picked up after a non-Hero level" — but Ordinary is the one
// non-Hero tier that is TRANSPARENT to this rule. Ordinary is the aspirant
// tier: a purely-Ordinary character (any mix of Ordinary classes, any levels)
// can still ascend to a Hero class. Only Basic / Advanced / Prestige levels
// lock the Career Path. This predicate is recomputed from the class list
// every time — no persistent flag — so the ascension door automatically
// reflects the current state and closes the moment a locking level is added.
function hasCareerPathLockingLevel(classArr){
  return (classArr||[]).some(e => e.tier!=='hero' && e.tier!=='ordinary' && (e.level||0)>0);
}
// Form-scoped convenience: does the Create form's current class list contain a
// Career-Path-locking level? Retained under the original name because other
// call sites still reference hasNonHeroEntry(); it now delegates to the
// v8.3.32 predicate so Ordinary levels no longer count as locking.
function hasNonHeroEntry(){
  return hasCareerPathLockingLevel(formClasses);
}

// Add Class dialog: open, populate, confirm, cancel
function openAddClassDialog(){
  document.getElementById('add-class-dialog').style.display='block';
  // Default to Basic if a non-Hero exists already (since Career Path locks out new Hero classes)
  document.getElementById('add-cls-tier').value=hasNonHeroEntry()?'basic':'hero';
  // v8.2.1: Always reset the level input to 1 when opening the dialog.
  // Previously the input retained its value from a prior class addition,
  // which led to surprises like "I wanted Investigator 2, got Investigator 3
  // because I'd added Dedicated Hero 3 earlier".
  document.getElementById('add-cls-lvl').value=1;
  // v8.4.0: lock the level input to 1 in L1-genesis mode (new character,
  // !editId). Edit mode leaves it freely editable.
  const lvlInp = document.getElementById('add-cls-lvl');
  const isL1Genesis = editId === null;
  if (lvlInp) {
    lvlInp.disabled = isL1Genesis;
    lvlInp.max = isL1Genesis ? 1 : lvlInp.max;
    lvlInp.title = isL1Genesis
      ? '1st-level genesis: starting classes are taken at level 1.'
      : '';
  }
  onAddClassTierChange();
}
function cancelAddClass(){
  document.getElementById('add-class-dialog').style.display='none';
  document.getElementById('add-cls-warn').textContent='';
}
// When the tier dropdown changes, repopulate the class-name dropdown with the right list
function onAddClassTierChange(){
  const tier=document.getElementById('add-cls-tier').value;
  const sel=document.getElementById('add-cls-name');
  let names=[];
  if(tier==='hero')names=Object.keys(HERO_CLASSES);
  else if(tier==='ordinary')names=Object.keys(ORDINARY_CLASSES);
  else if(tier==='basic')names=Object.keys(BASIC_CLASSES);
  else if(tier==='advanced')names=Object.keys(ADVANCED_CLASSES);
  else if(tier==='prestige')names=Object.keys(PRESTIGE_CLASSES);
  const sl=getSixLevels();
  const dis=disabledClassesForScenario(sl);
  // Filter out names already taken (one entry per class — adding the same class twice doesn't make sense)
  const taken=new Set(formClasses.filter(e=>e.tier===tier).map(e=>e.name));
  // v8.5.4: the Druid exception — when Cleric is blocked ONLY by the Tech 0
  // gate (Divine 1+), it stays selectable, annotated as Druid-Option-only
  // (HH availability table footnote).
  const clericDruidException = (sl.tech??0)<1 && (sl.divine??0)>=1;
  sel.innerHTML=names.map(n=>{
    const isTaken=taken.has(n);
    let isDis=dis.has(n);
    let label=n;
    if(n==='Cleric' && isDis && clericDruidException){
      isDis=false;
      label=label+' (Druid Option only — Tech 0)';
    }
    if(isDis)label='⊘ '+label+' (scenario disallows)';
    if(isTaken)label='✓ '+label+' (already taken)';
    return`<option value="${n}" ${isDis||isTaken?'disabled':''}>${label}</option>`;
  }).join('');
  // Update the level cap on the level input. v8.3.32: ordinary classes cap
  // at level 10, mirroring their Hero counterparts. v8.4.0: in L1-genesis
  // mode the cap is hard-1 regardless of tier.
  const tierMaxes={hero:10,ordinary:10,basic:20,advanced:10,prestige:10};
  const isL1Genesis = editId === null;
  const effectiveMax = isL1Genesis ? 1 : (tierMaxes[tier]||20);
  document.getElementById('add-cls-lvl').max = effectiveMax;
  if(parseInt(document.getElementById('add-cls-lvl').value) > effectiveMax)
    document.getElementById('add-cls-lvl').value = 1;
  updateAddClassWarnings();
}

// v8.3.23: combined warning resolver for the Add Class form. Surfaces both
// the Career Path warning (Hero class after non-Hero levels) and the
// attribute-prereq warning (Hero needs 13 in key attr; certain Basic classes
// need 10). Re-runs whenever tier or class-name selection changes.
function updateAddClassWarnings(){
  const tier=document.getElementById('add-cls-tier').value;
  const name=document.getElementById('add-cls-name').value;
  const warnEl=document.getElementById('add-cls-warn');
  if(!warnEl) return;
  const warnings=[];
  // Career Path. v8.3.32: warning text now reflects that Ordinary levels are
  // transparent — they do NOT trigger the Career Path lock. hasNonHeroEntry
  // already delegates to hasCareerPathLockingLevel so this fires only when a
  // Basic/Advanced/Prestige level is present, never for pure-Ordinary.
  if(tier==='hero' && hasNonHeroEntry()){
    warnings.push(`<span style="color:rgb(var(--text-amber));">⚠ Career Path rule: per the handbook, no NEW Hero classes can be picked up after taking a non-Hero level (Ordinary levels excepted). You can still save with this — flag the GM if they're granting an exception.</span>`);
  }
  // Attribute prereq — Hero classes need 13; Basic classes Cleric/Paladin/Saint/
  // Psion/Wizard/Sorcerer/Wilder need 10 in their key attribute (handbook
  // table p.52). v8.3.32: Ordinary classes carry attrMin:13 (mechanically
  // identical to Hero on the attribute floor — see plan §4.2), so the
  // prereq-display gate extends to them too.
  if(name && (tier==='hero' || tier==='ordinary' || tier==='basic')){
    const cls = tier==='hero' ? HERO_CLASSES[name] : tier==='ordinary' ? ORDINARY_CLASSES[name] : BASIC_CLASSES[name];
    if (cls && typeof cls.attrMin === 'number') {
      const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
      const baseAttrs = getAttrs();
      const effAttrs = applyAttrBumps(baseAttrs, formAttrBumps);
      // v8.3.24: use attrMinKey (single attribute code); fall back to first
      // token of `attr` for any pre-v8.3.24 entries lacking the new field.
      const code = cls.attrMinKey || (cls.attr ? cls.attr.split('/')[0].trim() : null);
      if (code) {
        const idx = ATTR_IDX[code];
        const score = idx !== undefined ? (effAttrs[idx] || 0) : 0;
        if (score < cls.attrMin) {
          const label = `${code} ${cls.attrMin}+`;
          const scoreStr = `${code} ${score}`;
          warnings.push(`<span style="color:rgb(var(--text-salmon));">⚠ Attribute prereq unmet (HH p.52): ${escapeHTML(name)} requires <b>${escapeHTML(label)}</b>; you have ${escapeHTML(scoreStr)}. You can still save — this will be recorded as a GM exception.</span>`);
        }
      }
    }
  }
  warnEl.innerHTML = warnings.join('<br>');
}

function confirmAddClass(){
  const tier=document.getElementById('add-cls-tier').value;
  const name=document.getElementById('add-cls-name').value;
  const lvl=parseInt(document.getElementById('add-cls-lvl').value)||1;
  if(!name){toast('Pick a class.');return;}
  // Cap to per-class max
  const fakeEntry={tier,name,level:lvl};
  const cap=tierMaxLevel(fakeEntry);
  // v8.4.0: L1-genesis hard cap. Defense in depth — even if the UI's
  // disabled input is bypassed, the level is forced to 1 here.
  const isL1Genesis = editId === null;
  const effectiveCap = isL1Genesis ? 1 : cap;
  const finalLvl=Math.min(Math.max(1,lvl),effectiveCap);
  // First-class flag: if no entry currently has it, this one gets it
  const isFirst=!formClasses.some(e=>e.first);
  formClasses.push({tier,name,level:finalLvl,first:isFirst});
  // v8.3.23: attrMin violations are detected at save time by the broader
  // prereq loop in saveCharacter (which now walks all four tiers). The
  // warning shown by updateAddClassWarnings() before this confirm gives the
  // player advance notice; the GM exception is materialized on save.
  cancelAddClass();
  renderClassList();
  updateClassPreview();
}
function removeClassAt(i){
  if(i<0||i>=formClasses.length)return;
  const wasFirst=formClasses[i].first;
  formClasses.splice(i,1);
  // If the "first" entry was just removed, promote the new first entry to first
  if(wasFirst && formClasses.length){
    formClasses[0].first=true;
  }
  renderClassList();
  updateClassPreview();
}
function onClassLevelChange(i, val){
  if(i<0||i>=formClasses.length)return;
  const e=formClasses[i];
  const cap=tierMaxLevel(e);
  // v8.4.0: L1-genesis hard cap. Defense in depth.
  const isL1Genesis = editId === null;
  const effectiveCap = isL1Genesis ? 1 : cap;
  e.level=Math.min(Math.max(1,parseInt(val)||1),effectiveCap);
  renderClassList();
  updateClassPreview();
}
function setFirstClass(i){
  formClasses.forEach((e,idx)=>{e.first=(idx===i)});
  renderClassList();
  updateDerived();
}

