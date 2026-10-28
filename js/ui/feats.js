// =============================================================================
// js/ui/feats.js
// FEATS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Feats page and feat browser, custom feats, feat
//   parameters and GM exceptions.
//
// KEY NAMES (so you can search for them)
//   tables and state: gmExceptionsExpanded, _activeBrowserSlot
//   functions (18): toggleGMExceptionsExpanded, clearGMException,
//   renderGMExceptions, setFeatParamAt, renderFeats, renderFeatList,
//   toggleCustomFeatForm, addCustomFeat, removeFeat, saveFeats,
//   openFeatBrowser, closeFeatBrowser, setActiveBrowserSlot,
//   renderFeatBrowser, filterFeats, pickAndAddFeat, promptForFeatParam,
//   addFeatToChar
//
// WHERE IT CAME FROM
//   Gathered from js/app/51-gm-exceptions-and-talents-page.js,
//   js/app/62-power-suites-feats-page-proficiencies.js, js/app/63-modals.js
//   when the code was regrouped by topic and page. Each function and table
//   moved whole and unchanged, with the comments above it, including the
//   original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Session-scoped flag: whether the GM Exceptions banner is currently expanded on the sheet.
let gmExceptionsExpanded = false;
function toggleGMExceptionsExpanded(){
  gmExceptionsExpanded = !gmExceptionsExpanded;
  const c = chars.find(x => x.id === curId);
  if (c) renderGMExceptions(c);
}

// Clear a single GM exception from the character record.
async function clearGMException(idx){
  const c = chars.find(x => x.id === curId);
  if (!c || !c.gmExceptions) return;
  const ex = c.gmExceptions[idx];
  if (!ex) return;
  if (!(await confirmModal(`Clear this GM exception?\n\n${ex.target}\n\nThis is permanent — the audit trail entry will be removed.`))) return;
  c.gmExceptions.splice(idx, 1);
  save();
  renderGMExceptions(c);
  toast('GM exception cleared.');
}

function renderGMExceptions(c){
  const slot = document.getElementById('sh-gm-exceptions');
  if (!slot) return;
  const exceptions = c.gmExceptions || [];
  if (exceptions.length === 0) { slot.innerHTML = ''; return; }
  // Build re-check results once
  const recheck = exceptions.map(ex => recheckGMException(ex, c));
  const resolvedCount = recheck.filter(r => r).length;
  const openCount = exceptions.length - resolvedCount;
  const arrow = gmExceptionsExpanded ? '▾' : '▸';
  // Banner header
  let html = `<div onclick="toggleGMExceptionsExpanded()" class="cursor-pointer p-6-10 fs-12 c-red-text items-center gap-8 font-serif ls-0_05em" style="background:rgba(212,112,112,.08);border:1px solid rgba(212,112,112,.3);border-radius:3px;display:inline-flex;">
    ${arrow} ⚠ ${exceptions.length} GM exception${exceptions.length===1?'':'s'} on this character
    ${resolvedCount > 0 ? `<span class="op-0_85" style="color:#6dba88;">(${resolvedCount} now resolved)</span>` : ''}
  </div>`;
  if (gmExceptionsExpanded) {
    html += `<div class="mt-8" style="border:1px solid rgba(212,112,112,.25);border-radius:3px;background:rgba(20,15,10,.4);">`;
    exceptions.forEach((ex, i) => {
      const isResolved = recheck[i];
      const statusBadge = isResolved
        ? `<span class="fs-10 bold" style="color:#6dba88;">✓ Now Met</span>`
        : `<span class="c-red-text fs-10 bold">✗ Still Open</span>`;
      const date = ex.grantedAt || '(no date)';
      const missingList = (ex.missing || []).map(m => `<li>${escapeHTML(m)}</li>`).join('');
      html += `<div style="padding:8px 12px;border-top:${i===0?'none':'1px solid rgba(200,151,30,.08)'};font-size:12px;">
        <div class="justify-between items-start gap-8" style="display:flex;">
          <div class="flex-1">
            <div class="c-gold bold mb-3">${escapeHTML(ex.target)}</div>
            <div class="op-0_6 fs-10 mb-4">Granted ${date} &nbsp;·&nbsp; ${statusBadge}</div>
            ${missingList ? `<ul class="op-0_85 c-g85" style="margin:4px 0 0;padding-left:18px;">${missingList}</ul>` : ''}
          </div>
          <button class="fs-10 p-3-8 btn btn-sm btn-danger" onclick="clearGMException(${i})" style="flex-shrink:0;">Clear</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  slot.innerHTML = html;
}

// v8.30.0: choose (or re-key) a stored feat record's parameter after the fact.
// Used by the ⬦ button on Known Feats rows whose FEATS_DB entry defines a
// param the record predates (Heritage class picks are the motivating case).
function setFeatParamAt(i){
  const c = chars.find(x => x.id === curId); if (!c || !c.feats || !c.feats[i]) return;
  const rec = c.feats[i];
  const data = getFeatData(rec.name); if (!data || !data.param) return;
  promptForFeatParam(data, param => {
    rec.param = param;
    save(); renderFeats(); renderSheet(); renderNavTabs(c);
    toast(`${data.n} — ${param}.`);
  });
}
function renderFeats(){
  const prompt=document.getElementById('ft-prompt'),cont=document.getElementById('ft-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=chars.find(x=>x.id===curId);if(!c){prompt.style.display='block';cont.style.display='none';return;}
  prompt.style.display='none';cont.style.display='block';
  if (migrateFeats(c)) save();
  // v8.6.1: sync class-entry feat grants (covers pre-existing characters —
  // an old Monk gets CMA/DMA on first visit here, flagged grantedBy).
  if (reconcileGrantedFeats(c)) save();
  document.getElementById('ft-hero-nm').textContent=c.name+' — Feats';
  // v8.4.0: feat-budget computation extracted into getFeatBudget() — see
  // the function definition for the rules. Returns {sources, total, picked,
  // remaining}; the rendering below consumes that shape.
  const budget = getFeatBudget(c);
  const budgetSources = budget.sources;
  const maxFeats = budget.total;
  const currentCount = budget.picked;
  const remaining = budget.remaining;
  // Visual budget bar: prominent "N available" + filled/empty pip strip + small context line.
  // A player may legitimately defer feat selection with GM permission, so the "available"
  // framing is neutral — not a warning that anything is wrong.
  const pips = [];
  for (let i = 0; i < maxFeats; i++) {
    pips.push(i < currentCount
      ? `<span class="c-gold">◆</span>`
      : `<span class="c-g35">◇</span>`);
  }
  // If the user has more selected than the budget (e.g. GM exception), show overflow pips in amber
  if (currentCount > maxFeats) {
    for (let i = maxFeats; i < currentCount; i++) pips.push(`<span class="c-red-text">◆</span>`);
  }
  // v8.4.0: four-state color-coded budget display (plan §7.5). Replaces the
  // old binary "available / over" treatment with surplus / exact / warning /
  // error states keyed off the GM exception list.
  const fState = computeResourceState(currentCount, maxFeats, 'feat', c.gmExceptions || []);
  const fDisplay = RESOURCE_STATE_DISPLAY[fState];
  let fSuffix = '';
  if (fState === 'surplus') {
    fSuffix = `${remaining} feat${remaining===1?'':'s'} available`;
    // v8.4.0: if Hero's Gift is unassigned AND would have added a feat slot,
    // label it distinctly so the player knows WHY they're surplus.
    if (!isLegacyCharacter(c) && c.heroesGiftChoice === null
        && (c.classes||[]).some(e => e.tier === 'hero')) {
      fSuffix += ` (incl. unassigned Hero's Gift slot)`;
    }
  } else if (fState === 'exact') {
    fSuffix = 'budget complete';
  } else if (fState === 'warning') {
    fSuffix = `${currentCount - maxFeats} over (GM exception)`;
  } else {
    fSuffix = `${currentCount - maxFeats} over budget — reconcile or get GM approval`;
  }
  const availText = `<span title="${fDisplay.label}" style="color:${fDisplay.color};">${fDisplay.icon}</span> <b style="color:${fDisplay.color};">${fSuffix}</b>`;
  // v8.3.6: source breakdown line shows where each slot came from. Format:
  // "Free L1 +1 · Heritage +1 · Hero's Gift +1" etc.
  const sourceLine = budgetSources.map(b => `${b.label} +${b.count}`).join(' · ');
  const ftCountEl = document.getElementById('ft-count');
  ftCountEl.innerHTML =
    `${availText} &nbsp; <span class="fs-13" style="letter-spacing:.18em;">${pips.join('')}</span> &nbsp; <span class="o-55 c-dim fs-10">${currentCount} selected of ${maxFeats} at level ${c.totalLvl}</span>
     <div class="mt-6 fs-10 c-g55 lh-1_4 italic">${escapeHTML(sourceLine)}</div>`;
  ftCountEl.setAttribute('data-state', fState);
  renderFeatList(c);
}

// Render the character's known feats, with live prereq status badges for each.
function renderFeatList(c){
  const fl=document.getElementById('ft-list');
  const feats = c.feats||[];
  // v8.6.1: surface the DERIVED class-entry/racial proficiencies so the
  // player can see what came free with their classes (these live outside
  // c.feats and cost no feat slots — see CLASS_PROFICIENCIES).
  const g = charProficiencyGrants(c);
  const bits = ['Simple weapons (all characters)'];
  if (g.martial) bits.push('Martial weapons (Tech-gated)');
  for (const t of ['light', 'medium', 'heavy']) if (g.armor.has(t)) bits.push(t + ' armor');
  if (g.shield) bits.push('shields');
  if (g.towerShield) bits.push('tower shields');
  if (g.weaponsDisp.length) bits.push('specific: ' + g.weaponsDisp.join(', '));
  let grantBanner = `<div class="p-6-10 mb-6 fs-11 c-tb85" style="border:1px solid rgba(120,175,205,.25);border-radius:3px;">
    <b>Class &amp; racial proficiencies</b> <span class="o-60 c-dim">(granted on entry — no feat slots used)</span>: ${escapeHTML(bits.join(' · '))}</div>`;
  // v8.71.0 (Adam's grooming pass): the Sheet's assigned-state Gift banner
  // retired — the ⬟ honor now sits on the occupying feat itself, read off
  // the herosGift slot ledger. When the Gift is assigned to 'feat' but the
  // slot sits unfilled (picks made above 1st level never auto-fill it), a
  // one-line note keeps the +1 budget honest instead of a phantom chip.
  const _giftAssigned = !isLegacyCharacter(c) && c.heroesGiftChoice === 'feat';
  const _giftSlot = (_giftAssigned && Array.isArray(c.firstLevelSlots))
    ? c.firstLevelSlots.find(s => s.kind === 'herosGift') : null;
  // Two ways a feat wears the ⬟ chip: it fills the herosGift slot (the
  // v8.4.0 ledger), or it carries an explicit origin:"Hero's Gift" tag
  // (hand-built / imported records that never passed through the L1
  // slot-fill path — the Loreseeker Prototype's convention).
  const _giftTagged = (f) =>
    (_giftSlot && _giftSlot.filled === f.name && (_giftSlot.filledParam || null) === (f.param || null)) ||
    (typeof f.origin === 'string' && /^Hero[’']s Gift$/.test(f.origin));
  const _anyGiftTag = _giftAssigned && feats.some(_giftTagged);
  const GIFT_CHIP_TIP = "Hero's Gift — this feat fills the Hero-class Gift slot (+1 bonus feat, Hero feat list). To reassign the Gift (feat ↔ talent), retcon via ✎ Edit — downstream prereq chains may break; the GM-exception ledger records any breaks detected.";
  if (_giftAssigned && !_anyGiftTag) {
    grantBanner += `<div class="p-5-10 mb-6 fs-11 c-vio" style="border:1px solid rgba(196,153,212,.3);border-radius:3px;" title="${escapeHTML(GIFT_CHIP_TIP)} 1st-level picks fill the slot automatically; feats taken at higher levels count against the budget without a slot tag (cosmetic only).">⬟ <b>Hero's Gift (feat)</b> — +1 feat budget; no feat tagged to the slot yet.</div>`;
  }
  // v9.19.0 (old-boys #3): the UNCLAIMED Gift gets its claim card HERE — the
  // attention dot pointed at this tab, but the only chooser hid inside
  // ✎ Edit's retcon panel, so a whole table of players sat on an unclaimed
  // bonus all session. One click each way; the fold reconciler has already
  // absorbed over-budget cases before this renders.
  if (!isLegacyCharacter(c) && c.heroesGiftChoice === null && (c.classes || []).some(e => e.tier === 'hero')) {
    grantBanner += `<div class="p-7-10 mb-6 fs-11_5 c-gold" style="border:1px solid rgba(200,151,30,.45);border-radius:3px;background:rgba(200,151,30,.04);">
      🎁 <b>Hero's Gift unclaimed</b> — your Hero class owes you ONE bonus pick: a feat or a talent, chosen once (retcon later via ✎ Edit).
      <span class="nowrap"><button class="fs-10 ml-8 btn btn-sm btn-pri" onclick="assignHerosGiftAsFeat()">Claim as Feat (+1 feat slot)</button>
      <button class="fs-10 ml-4 btn btn-sm" onclick="assignHerosGiftAsTalent()">Claim as Talent (+1 talent slot)</button></span>
    </div>`;
  }
  if(!feats.length){
    fl.innerHTML=grantBanner+`<div class="p-1rem fs-13 c-g40 text-center">No feats yet — click "⌕ Browse Feats" above to add.</div>`;
    return;
  }
  fl.innerHTML = grantBanner + feats.map((f,i) => {
    // v8.71.0: ⬟ chip on the feat occupying the Hero's Gift slot.
    const _isGiftFeat = _giftAssigned && _giftTagged(f);
    const giftChip = _isGiftFeat
      ? ` <span class="fs-9 c-vio p-1-5 ml-6 cursor-help" style="border:1px solid rgba(196,153,212,.45);background:rgba(196,153,212,.1);border-radius:2px;" title="${escapeHTML(GIFT_CHIP_TIP)}">⬟ Hero's Gift</span>`
      : '';
    const data = getFeatData(f.name);
    if (!data) {
      // Unknown feat — either custom (legacy) or pre-v8.1 entry
      const leg = f._legacy || {};
      const fam = leg.t || 'Custom';
      const pre = leg.pre ? `<div class="feat-pre">Prereq: ${escapeHTML(leg.pre)}</div>` : '';
      const d = leg.d ? `<div class="feat-desc">${escapeHTML(leg.d)}</div>` : '';
      return `<div class="feat-entry">
        <div>
          <div class="feat-nm">${escapeHTML(f.name)}${f.param?' ('+escapeHTML(f.param)+')':''} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span> <span class="fs-9 c-g45 italic">custom</span>${giftChip}</div>
          ${pre}${d}
        </div>
        <button class="mt-2 btn btn-sm btn-danger" onclick="removeFeat(${i})">✕</button>
      </div>`;
    }
    // FEATS_DB feat — render with live prereq check
    const prereq = checkFeatPrereqs(f.name, c);
    let badge = '';
    if (prereq.met) {
      badge = `<span class="fs-10 ml-6" style="color:#6dba88;">✓ prereqs met</span>`;
    } else {
      const unverify = prereq.missing.every(m => m.includes('(GM-verify)'));
      const lbl = unverify ? '⚠ GM-verify' : '⚠ missing prereqs';
      const color = unverify ? 'var(--g65)' : 'var(--red-text)';
      badge = `<span style="font-size:10px;color:${color};margin-left:6px;" title="${escapeHTML(prereq.missing.join(' · '))}">${lbl}</span>`;
    }
    const paramText = f.param ? ` <span class="c-gold">(${escapeHTML(f.param)})</span>` : '';
    // v8.30.0: retrofit picker for records that predate their feat's param def
    // (the Heritage feats are the motivating case — their class choice landed
    // long after players took them). Generic: any paramful feat qualifies.
    const paramFixBtn = (data.param && !f.param && !f.grantedBy)
      ? ` <button class="fs-9 p-1-6 c-vio btn btn-sm" style="background:rgba(196,153,212,.12);border-color:rgba(196,153,212,.45);" onclick="setFeatParamAt(${i})" title="This feat needs a ${escapeHTML((data.param.param_label||'parameter').toLowerCase())} — added before the picker existed. Choose now; no re-add needed.">⬦ choose ${escapeHTML((data.param.param_label||'parameter').toLowerCase())}</button>`
      : '';
    const fam = data.family || 'General';
    // v8.3.2: surface slot source if this feat consumed a class-bonus slot.
    // Format: 'classFeature:Expert:Bonus Expert Feat' → 'Expert bonus' tag.
    let slotTag = '';
    if (f.slotSource && typeof f.slotSource === 'string') {
      const m = f.slotSource.match(/^classFeature:([^:]+):(.+)$/);
      if (m) {
        slotTag = ` <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.35);padding:1px 5px;border-radius:2px;margin-left:6px;" title="Filled the ${escapeHTML(m[1])} class-feature slot: ${escapeHTML(m[2])}">${escapeHTML(m[1])} bonus</span>`;
      }
    }
    // v8.6.1: class-entry granted feats (Monk's CMA/DMA) show provenance and
    // no remove button — removal follows the class levels, not a click
    // (reconcileGrantedFeats would re-add it on the next sync anyway).
    const grantTag = f.grantedBy
      ? ` <span style="font-size:9px;color:var(--pb90);border:1px solid rgba(120,175,205,.35);padding:1px 5px;border-radius:2px;margin-left:6px;" title="Granted on class entry — no feat slot used; removed automatically if the class goes.">granted by ${escapeHTML(f.grantedBy)}</span>`
      : '';
    return `<div class="feat-entry">
      <div>
        <div class="feat-nm">${escapeHTML(data.n)}${citeHTML('feats', data.n)}${paramText}${paramFixBtn} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span>${slotTag}${giftChip}${grantTag}${badge}</div>
        ${data.d?`<div class="feat-desc">${escapeHTML(data.d)}</div>`:''}
      </div>
      ${f.grantedBy ? '' : `<button class="mt-2 btn btn-sm btn-danger" onclick="removeFeat(${i})">✕</button>`}
    </div>`;
  }).join('');
}

// Toggle the inline custom-feat form (for homebrew / GM-approved feats not in FEATS_DB).
function toggleCustomFeatForm(){
  const f = document.getElementById('ft-custom-form');
  f.style.display = (f.style.display === 'none') ? 'block' : 'none';
}

// Add a custom (homebrew) feat from the inline form.
function addCustomFeat(){
  const name=document.getElementById('ft-new-name').value.trim();
  if(!name){toast('Enter a feat name.');return;}
  const c=chars.find(x=>x.id===curId);if(!c)return;
  if(!c.feats)c.feats=[];
  c.feats.push({
    name,
    _legacy:{
      t:document.getElementById('ft-new-type').value,
      pre:document.getElementById('ft-new-pre').value.trim(),
      d:document.getElementById('ft-new-desc').value.trim(),
    },
  });
  save();renderFeatList(c);renderFeats();
  ['ft-new-name','ft-new-pre','ft-new-desc'].forEach(id=>document.getElementById(id).value='');
  toast('Custom feat added.');
}

function removeFeat(i){
  const c=chars.find(x=>x.id===curId);if(!c)return;
  // v8.4.0: clear the L1 slot this feat was filling (if any) BEFORE removing
  // the feat. No-op for legacy characters or feats not tracked in a slot.
  const removed = c.feats[i];
  // v8.55.0: a homebrew-heritage entry carries baked attributes and child
  // grants — deleting it from the Feats page must reverse them too, or the
  // sheet desyncs. Route through the shared reversal before the splice, and
  // RE-LOCATE the entry by reference afterward: the reversal splices child
  // grants that sit BEFORE the entry, shifting its index (the reversal test
  // caught the stale-index splice missing the entry, whereupon the reconciler
  // faithfully re-granted the children — a perfect resurrection loop).
  if (removed && removed._hb) {
    hbReverseEntry(c, removed);
    i = c.feats.indexOf(removed);
    if (i < 0) { save(); renderFeats(); return; }
  }
  if (removed) {
    clearFirstLevelSlotForFeat(c, removed.name, removed.param);
  }
  c.feats.splice(i,1);
  // v8.13.0: removing an Expanded Knowledge instance withdraws its bonus
  // power known (player-learned copies are untouched by the reconciler).
  if (reconcileExpandedKnowledgePowers(c)) {
    renderPowers();
  }
  // v8.5.2 fix: removeFeat was the only feat-mutation path that didn't call
  // renderFeats() — it only re-rendered the list, leaving the budget header
  // (getFeatBudget() pips + "budget complete"/"N available" text) stale after
  // a delete. addCustomFeat and the feat-browser add path both call
  // renderFeats() (which itself calls renderFeatList), so this matches them.
  save();renderFeats();toast('Feat removed.');
}
function saveFeats(){save();toast('Feats saved.');}
// v8.3.2: tracks which slot the player is currently filling in the feat
// browser. When set, feat-add tags the picked feat with slotSource. Cleared
// when the modal closes or after a feat is added that consumed the slot.
let _activeBrowserSlot = null;

function openFeatBrowser(){
  // v8.3.2: detect open class-bonus slots and offer to fill the first one.
  // If multiple class-bonus slots are open, the player can pick which to
  // fill via the banner UI. The default behavior — and what fires here —
  // is to focus the first open slot, with a "Browse without slot context"
  // escape so the player can pick general feats too.
  const c = curId ? chars.find(x => x.id === curId) : null;
  if (c) {
    const open = getOpenClassBonusSlots(c);
    if (open.length > 0) {
      _activeBrowserSlot = open[0];
      const famFilter = _activeBrowserSlot.restrictionFamily;
      if (famFilter) {
        const sel = document.getElementById('feat-type-filter');
        if (sel) sel.value = famFilter;
      }
    } else {
      _activeBrowserSlot = null;
    }
  } else {
    _activeBrowserSlot = null;
  }
  document.getElementById('feat-modal').classList.add('open');
  renderFeatBrowser();
}
function closeFeatBrowser(){
  document.getElementById('feat-modal').classList.remove('open');
  _activeBrowserSlot = null;
}

// v8.3.2: explicitly toggle the active slot context. Called from the
// slot-context banner buttons when the player has multiple open slots
// or wants to browse without a slot context.
function setActiveBrowserSlot(idx) {
  const c = curId ? chars.find(x => x.id === curId) : null;
  if (!c) return;
  const open = getOpenClassBonusSlots(c);
  if (idx == null || idx < 0 || idx >= open.length) {
    _activeBrowserSlot = null;
    // Clear the family filter too — player chose "browse without slot"
    const sel = document.getElementById('feat-type-filter');
    if (sel) sel.value = '';
  } else {
    _activeBrowserSlot = open[idx];
    const famFilter = _activeBrowserSlot.restrictionFamily;
    const sel = document.getElementById('feat-type-filter');
    if (sel) sel.value = famFilter || '';
  }
  renderFeatBrowser();
}

// Render the feat browser with live prereq validation badges.
function renderFeatBrowser(filter='',famF='',qualF=''){
  const list=document.getElementById('feat-browser-list');
  const c = curId ? chars.find(x=>x.id===curId) : null;
  // v8.3.2: render slot-context banner. Shows when there's an active slot
  // OR there are open class-bonus slots the player could choose to fill.
  // The banner explains the restriction and offers a "browse generally"
  // escape, plus a picker if multiple slots are open.
  const banner = document.getElementById('feat-slot-banner');
  if (banner) {
    if (c) {
      const open = getOpenClassBonusSlots(c);
      if (open.length > 0) {
        let bannerHtml = '';
        if (_activeBrowserSlot) {
          // v8.3.7: format restriction descriptively. Family-restrictions
          // show their family label; list-restrictions show a short summary
          // (count + example) since enumerating 20+ feat names would be noisy.
          let restrDescription = 'no restriction';
          const rawRestr = _activeBrowserSlot.restriction;
          if (Array.isArray(rawRestr)) {
            const sample = rawRestr.slice(0, 3).join(', ');
            const more = rawRestr.length > 3 ? `, +${rawRestr.length - 3} more` : '';
            restrDescription = `${_activeBrowserSlot.className} feat list (${rawRestr.length} feats: ${sample}${more})`;
          } else if (typeof rawRestr === 'string' && rawRestr) {
            restrDescription = rawRestr;
          }
          bannerHtml += `
            <div class="items-start gap-8" style="display:flex;">
              <span class="c-vio fs-14">⚜</span>
              <div class="flex-1">
                <b class="c-vio">Filling: ${escapeHTML(_activeBrowserSlot.className)} — ${escapeHTML(_activeBrowserSlot.featureName)}</b>
                <div class="c-g65 fs-11 mt-2">Restriction: ${escapeHTML(restrDescription)}. Feats outside this list will prompt to override (GM exception).</div>
              </div>
            </div>
          `;
        } else {
          bannerHtml += `
            <div class="items-start gap-8" style="display:flex;">
              <span class="c-vio fs-14">⚜</span>
              <div class="flex-1">
                <b class="c-vio">${open.length} class-bonus feat slot${open.length>1?'s':''} open</b>
                <div class="c-g65 fs-11 mt-2">Browsing without slot context — picks count against your baseline feat slots first.</div>
              </div>
            </div>
          `;
        }
        // Switcher buttons: one per open slot + "browse without slot"
        bannerHtml += `<div class="gap-6 flex-wrap mt-8" style="display:flex;">`;
        for (let i = 0; i < open.length; i++) {
          const s = open[i];
          const isActive = _activeBrowserSlot && _activeBrowserSlot.sourceTag === s.sourceTag && _activeBrowserSlot.slotIndex === s.slotIndex;
          bannerHtml += `<button class="btn btn-sm" onclick="setActiveBrowserSlot(${i})" style="font-size:10px;padding:3px 8px;${isActive?'background:rgba(196,153,212,.25);border-color:var(--vio);':''}">${isActive?'▼ ':''}${escapeHTML(s.className)} #${s.slotIndex+1}</button>`;
        }
        const noSlotActive = !_activeBrowserSlot;
        bannerHtml += `<button class="btn btn-sm" onclick="setActiveBrowserSlot(null)" style="font-size:10px;padding:3px 8px;${noSlotActive?'background:rgba(200,151,30,.15);':''}">${noSlotActive?'▼ ':''}Browse without slot</button>`;
        bannerHtml += `</div>`;
        banner.innerHTML = bannerHtml;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
        _activeBrowserSlot = null;  // no open slots → clear any stale state
      }
    } else {
      banner.style.display = 'none';
    }
  }
  const owned = new Set((c?.feats||[]).map(f => f.name));
  const filterLow = filter.toLowerCase();
  // Pre-compute qualification status per feat so we can use it for filtering AND display
  const featStatus = new Map();
  if (c) {
    for (const f of FEATS_DB) {
      const r = checkFeatPrereqs(f.n, c);
      let status = 'qualifies';
      if (!r.met) {
        status = r.missing.every(m => m.includes('(GM-verify)')) ? 'gmverify' : 'missing';
      }
      // v8.3.31 (stopgap): a Heritage feat on an above-1st-level character is
      // "off-level" — it would need a 1st-level Heritage slot the character
      // no longer has. It is NOT a normal "qualifies" feat: it requires a GM
      // exception. We give it its own status so the "✓ Qualifies Only" filter
      // excludes it (keeping the default view clean), while it still shows in
      // the "all feats" view, visually marked + GM-exception-gated.
      if (r.heritageOffLevel) {
        status = 'heritage-offlevel';
      }
      featStatus.set(f.n, {status, result:r});
    }
  }
  // v8.3.7: when an active browser slot has a list-restriction, default-filter
  // the displayed feats to that list. The player can still browse generally
  // by clicking "browse without slot" in the slot-context banner (which sets
  // _activeBrowserSlot to null).
  let listAllowSet = null;
  if (_activeBrowserSlot) {
    const filterDescr = _activeBrowserSlot.restrictionFilter
      || (_activeBrowserSlot.restrictionFamily
          ? {kind:'family', value: _activeBrowserSlot.restrictionFamily}
          : null);
    if (filterDescr && filterDescr.kind === 'list') {
      listAllowSet = new Set(filterDescr.value);
    }
  }
  const filtered=FEATS_DB.filter(f=>{
    const matchText = !filter || (f.n||'').toLowerCase().includes(filterLow) || (f.d||'').toLowerCase().includes(filterLow);
    const matchFam = !famF || f.family === famF;
    const matchQual = !qualF || !c || (featStatus.get(f.n)?.status === qualF);
    const matchList = !listAllowSet || listAllowSet.has(f.n);
    return matchText && matchFam && matchQual && matchList;
  });
  // v8.89.0 (Adam's sorting report — root cause): the list rendered in raw
  // FEATS_DB order, which is seven sequential ingest batches each internally
  // alphabetical — "several subsets in alphabetical order, undeclared." The
  // rows now SORT: A–Z across the whole catalogue (default; with an active
  // text search, name-matches outrank description-only matches, prefix
  // matches first), or by Family with declared headers — the old implicit
  // grouping, made honest.
  const sortMode = document.getElementById('feat-sort')?.value || 'az';
  const _byName = (a, b) => (a.n || '').localeCompare(b.n || '', undefined, { sensitivity: 'base' });
  if (sortMode === 'family') {
    filtered.sort((a, b) => (a.family || 'General').localeCompare(b.family || 'General') || _byName(a, b));
  } else if (filterLow) {
    const _rank = f => { const n = (f.n || '').toLowerCase(); return n.startsWith(filterLow) ? 0 : n.includes(filterLow) ? 1 : 2; };
    filtered.sort((a, b) => _rank(a) - _rank(b) || _byName(a, b));
  } else {
    filtered.sort(_byName);
  }
  if(!filtered.length){list.innerHTML=`<div class="p-1rem fs-13 c-g40">No matching feats.</div>`;return;}
  let _lastFam = null;
  list.innerHTML = filtered.map(f => {
    const fam = f.family || 'General';
    // Family mode: a declared header whenever the family changes.
    let _famHead = '';
    if (sortMode === 'family' && fam !== _lastFam) {
      _lastFam = fam;
      _famHead = `<div class="p-5-10 font-serif fs-11 ls-0_08em uppercase c-gold" style="background:rgba(200,151,30,.1);border-top:1px solid rgba(200,151,30,.25);border-bottom:1px solid rgba(200,151,30,.18);">${escapeHTML(fam)} Feats</div>`;
    }
    let prereqStatus = '';
    let addBtn = '';
    // v8.3.31 (stopgap): off-level Heritage feat? Compute once, reuse below.
    const heritageOffLevel = c ? !!(featStatus.get(f.n)?.result?.heritageOffLevel) : false;
    if (c) {
      const r = checkFeatPrereqs(f.n, c);
      if (heritageOffLevel) {
        // Heritage feat on an above-1st-level character. Per the rules, a
        // Heritage feat occupies a 1st-level Heritage slot — a character past
        // 1st level no longer has an open one. It remains reachable only as a
        // GM exception (the canonical case being Supernatural Mutation gained
        // mid-campaign through an exceptional in-game scenario).
        prereqStatus = `<span class="fs-10 c-vio ml-6">⬟ 1st-level Heritage slot</span>
          <div class="fs-11 c-g60 mt-2 lh-1_4">Heritage feats are assigned during 1st-level creation. This character is past 1st level — adding it now requires GM approval (recorded as a GM exception). Use incremental Level Up to advance characters the canonical way.</div>`;
      } else if (r.met) {
        prereqStatus = `<span class="fs-10 ml-6" style="color:#6dba88;">✓ qualifies</span>`;
      } else {
        const unverify = r.missing.every(m => m.includes('(GM-verify)'));
        const lbl = unverify ? '⚠ GM-verify' : '✗ missing prereqs';
        const color = unverify ? 'var(--g65)' : 'var(--red-text)';
        prereqStatus = `<span style="font-size:10px;color:${color};margin-left:6px;">${lbl}</span>
          <div class="fs-11 c-g55 mt-2">${escapeHTML(r.missing.join(' · '))}</div>`;
      }
      // Already-owned check (block re-add unless takeable)
      const alreadyOwned = owned.has(f.n);
      if (alreadyOwned && f.takeable !== 'multiple') {
        addBtn = `<button class="op-0_5 btn btn-sm" disabled>Owned</button>`;
      } else if (heritageOffLevel) {
        // GM-exception override button — distinct styling so it reads as an
        // exceptional action, not a normal Add.
        const label = alreadyOwned ? 'GM Override (Add Again)' : 'GM Override';
        addBtn = `<button class="c-vio fs-10 btn btn-sm" onclick="pickAndAddFeat('${(f.n||'').replace(/'/g,"\\'")}')" style="background:rgba(196,153,212,.15);border-color:var(--vio);" title="Adds this Heritage feat above 1st level as a GM-approved exception">⬟ ${label}</button>`;
      } else {
        const label = alreadyOwned ? '+ Add Again' : '+ Add';
        addBtn = `<button class="btn btn-sm btn-pri" onclick="pickAndAddFeat('${(f.n||'').replace(/'/g,"\\'")}')">${label}</button>`;
      }
    } else {
      addBtn = `<button class="btn btn-sm" disabled>Select a hero first</button>`;
    }
    // Render prereq summary (structured for clarity)
    let preSummary = '';
    if (f.prereqs && f.prereqs.length) {
      preSummary = `<div class="feat-pre">Prereq: ${escapeHTML(summarizePrereqs(f.prereqs))}</div>`;
    }
    const paramTag = f.param ? `<span class="fs-10 c-gold ml-4">⤷ ${escapeHTML(f.param.param_label || 'parameter required')}</span>` : '';
    const grantTag = f.grants ? `<span class="fs-10 c-g60 ml-4">grants talent</span>` : '';
    const icTag = f.isItemCreation ? `<span class="fs-10 c-g60 ml-4">Item Creation</span>` : '';
    return _famHead + `<div class="feat-entry">
      <div>
        <div class="feat-nm">${escapeHTML(f.n)}${citeHTML('feats', f.n)} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span>${paramTag}${grantTag}${icTag}${prereqStatus}</div>
        ${preSummary}
        ${f.d?`<div class="feat-desc">${escapeHTML(f.d)}</div>`:''}
      </div>
      ${addBtn}
    </div>`;
  }).join('');
}

function filterFeats(){renderFeatBrowser(document.getElementById('feat-search').value,document.getElementById('feat-type-filter').value,document.getElementById('feat-qual-filter')?.value||'');}

// Add a feat from the browser. If the feat is parameterized, prompt for the parameter first.
async function pickAndAddFeat(name){
  const data = getFeatData(name);
  if (!data) {toast('Feat not found.');return;}
  const c = chars.find(x=>x.id===curId);
  if (!c) {toast('Select a hero first.');return;}
  // Prereq check — non-blocking, but warn. If user overrides, log a GM exception.
  const r = checkFeatPrereqs(name, c);
  let isException = false;
  let exceptionMissing = null;
  let exceptionTarget = null;
  if (r.heritageOffLevel) {
    // v8.3.31 (stopgap): Heritage feat being added above 1st level. Per the
    // rules a Heritage feat occupies a 1st-level Heritage slot; a character
    // past 1st level needs explicit GM approval (canonical case: Supernatural
    // Mutation gained mid-campaign through an exceptional in-game scenario).
    const msg = `"${name}" is a Heritage feat.\n\n` +
      `Heritage feats are normally assigned during 1st-level character ` +
      `creation, in a 1st-level Heritage slot. This character is past 1st ` +
      `level.\n\nAdd it anyway as a GM-approved exception? (The canonical ` +
      `case is a feat like Supernatural Mutation gained mid-campaign through ` +
      `an exceptional in-game scenario.)`;
    if (!(await confirmModal(msg))) return;
    isException = true;
    exceptionMissing = ['Heritage feat added above 1st level (normally assigned in a 1st-level Heritage slot)'];
    exceptionTarget = `Feat (Heritage, off-level): ${name}`;
  } else if (!r.met) {
    const unverify = r.missing.every(m => m.includes('(GM-verify)'));
    if (!unverify) {
      if (!(await confirmModal(`Missing prereqs:\n  · ${r.missing.join('\n  · ')}\n\nAdd anyway (will be recorded as GM exception)?`))) return;
      isException = true;
      exceptionMissing = r.missing.slice();
      exceptionTarget = `Feat: ${name}`;
    }
  }
  if (isException) {
    if (!c.gmExceptions) c.gmExceptions = [];
    if (!c.gmExceptions.find(e => e.target === exceptionTarget)) {
      c.gmExceptions.push({type:'feat', target:exceptionTarget, missing:exceptionMissing, grantedAt:new Date().toLocaleDateString()});
    }
  }
  if (data.param) {
    promptForFeatParam(data, param => addFeatToChar(name, param));
  } else {
    addFeatToChar(name);
  }
}

// Prompt the user for a parameter value (weapon, skill, school, etc.) before adding.
function promptForFeatParam(feat, callback){
  const kind = feat.param.param_kind;
  const label = feat.param.param_label || 'Parameter';
  let options = [];
  let titleNote = '';  // v8.59.1: set when a filter hid entries — the modal title explains the partial list
  // v8.59.2: one sort for every weapon-flavored picker.
  const sortWeaponPool = (pool) => {
    const catRank = { 'Simple': 0, 'Martial': 1, 'Exotic': 2 };
    return [...pool].sort((a, b) => (catRank[a.cat] ?? 9) - (catRank[b.cat] ?? 9) || (a.tl || 0) - (b.tl || 0) || a.n.localeCompare(b.n));
  };
  // v8.3.33: 'pool' is a validated enum for feats that target one of the
  // character's spellcasting power point pools (Spellslinger is the
  // canonical example; future dual-pool feats like power-pool surges or
  // resilience feats can reuse this kind). The display label is title-cased
  // for the UI dropdown ('Arcane', 'Divine'); the STORED value is lowercase
  // to match the sixLevels axis convention used elsewhere in the codebase.
  // This is a constrained enum specifically because the misspelling of a
  // pool name would orphan the param against any future downstream system
  // (power-point tracker, etc.) that keys off the stored string.
  let valueMap = null;
  if (kind === 'pool') {
    // v8.5.4: the eligible pools now come from the feat's own param def —
    // Spellslinger targets the spellcasting pools (arcane/divine, the
    // default), Power Reservoir the psionic/super pair.
    const poolNames = (feat.param.pools || ['arcane', 'divine']);
    options = poolNames.map(p => p.charAt(0).toUpperCase() + p.slice(1));
    valueMap = Object.fromEntries(options.map((o, i) => [o, poolNames[i]]));
  } else if (kind === 'weapon') {
    // v8.5.0: filter the weapon list to parameters that satisfy the feat's
    // param-aware prereqs for the current character — same-param chains
    // (featParam: Greater Weapon Focus needs Weapon Focus on the SAME
    // weapon) and weapon proficiency (weaponProficiency: Weapon Focus and
    // Improved Critical require proficiency with the chosen weapon). This is
    // where the "with selected weapon" prereqs are actually enforced; the
    // browse-time badge only checks that the prereq feats are owned at all.
    let pool = WEAPONS;
    const pc = chars.find(x => x.id === curId);
    // v8.59.1 (Adam's Weaponmaster report, §176): the proficiency filter is
    // CORRECT (Weapon Focus requires proficiency with the chosen weapon) but
    // it was SILENT — a partial list reads as missing data, and it fooled
    // the game's own author (Strong Hero → Weaponmaster carries only simple
    // weapons, so every sword vanished without a word). The picker now says
    // what it hid and why.
    const filterNotes = [];
    if (pc && Array.isArray(feat.prereqs)) {
      const pOpts = feat.prereqs.flat();
      for (const o of pOpts.filter(o => o.type === 'featParam')) {
        const before = pool.length;
        const ownedParams = new Set((pc.feats || [])
          .filter(f => (f.name || f.n) === o.name)
          .map(f => f.param).filter(Boolean));
        pool = pool.filter(w => ownedParams.has(w.n));
        if (pool.length < before) filterNotes.push(`must match your ${o.name} weapon`);
      }
      if (pOpts.some(o => o.type === 'weaponProficiency')) {
        const before = pool.length;
        pool = pool.filter(w => isProficientWithWeapon(pc, w.n));
        if (pool.length < before) filterNotes.push(`${before - pool.length} hidden — proficiency required (gain it via a Weapon Proficiency feat or a class that grants it)`);
      }
    }
    if (!pool.length) {
      toast(`No qualifying weapon — ${feat.n} requires its prerequisite feats taken on the same weapon (and proficiency with it).`);
      return;
    }
    // v8.59.2 (Adam's Greataxe-between-Taser-and-Cryonic-Grenade report):
    // the WEAPONS array keeps the book-extraction's era-block order, which a
    // FILTERED list exposes as apparent chaos. Sort every weapon picker:
    // category (Simple → Martial → Exotic), then Tech Scale, then name.
    options = sortWeaponPool(pool).map(w => `${w.n} (${w.cat}, TS${w.tl})`);
    if (filterNotes.length) titleNote = ` — ${filterNotes.join('; ')}`;
  } else if (kind === 'martial_weapon') {
    // v8.5.0: Martial Weapon Proficiency — one martial weapon type per take.
    // Firearm-flagged martial entries are excluded: guns are Personal
    // Firearms Proficiency territory.
    options = sortWeaponPool(WEAPONS.filter(w => w.cat === 'Martial' && !w.firearm)).map(w => `${w.n} (TS${w.tl})`);
  } else if (kind === 'exotic_weapon') {
    options = sortWeaponPool(WEAPONS.filter(w => w.cat === 'Exotic')).map(w => `${w.n} (TS${w.tl})`);
  } else if (kind === 'skill') {
    options = SKILLS.map(s => s.n);
  } else if (kind === 'school') {
    options = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
    // v8.5.0: same-param filtering for school-parameterized chains (Greater
    // Spell Focus requires Spell Focus in the SAME school).
    const sc = chars.find(x => x.id === curId);
    if (sc && Array.isArray(feat.prereqs)) {
      for (const o of feat.prereqs.flat().filter(o => o.type === 'featParam')) {
        const ownedParams = new Set((sc.feats || [])
          .filter(f => (f.name || f.n) === o.name)
          .map(f => f.param).filter(Boolean));
        options = options.filter(s => ownedParams.has(s));
      }
      if (!options.length) {
        toast(`No qualifying school — ${feat.n} requires its prerequisite feat taken in the same school.`);
        return;
      }
    }
  } else if (kind === 'energy') {
    options = ['Acid','Cold','Electricity','Fire','Sonic'];
  } else if (kind === 'mecha_class') {
    // v8.17.0 Segment C: Mecha Operation's "chosen mecha" = a size class.
    options = ['Medium','Large','Huge','Gargantuan','Colossal'];
  } else if (kind === 'heritage_class') {
    // v8.30.0 (Adam): Arcane/Divine/Psionic Heritage — the chosen Basic class
    // whose 1st-level casting/manifesting the feat grants (HH pp.203/210/237).
    // Options come from the feat's own param def; the stored value is the
    // class name verbatim ('Cleric (Druid Option)' is the one composite).
    options = (feat.param.classes || []).slice();
  } else if (kind === 'power') {
    // v8.13.0 (Adam's Rhad report — Astral Construct unrecognized): the
    // 'power' kind fell through to the FREE-TEXT modal, an exact-spelling
    // trap that orphaned the param against the psionic-route plumbing
    // (_expandedNames matches SPELLS_DB names verbatim). Real picker:
    // Expanded Knowledge (HH p.215) grants any PSIONIC power — any
    // discipline, any class's list — of level up to ONE BELOW the highest
    // the character can manifest.
    const ekc = chars.find(x => x.id === curId);
    const pi = ekc ? getCasterPoolsInfo(ekc).psionic : null;
    const capLvl = Math.max(1, ((pi && pi.maxPowerLvl) || 2) - 1);
    options = SPELLS_DB
      .filter(s => isPsionicSpell(s))
      .map(s => { const ls = (s.levels || []).map(l => l.lvl).filter(n => typeof n === 'number'); return { n: s.name, lvl: ls.length ? Math.min(...ls) : 1 }; })
      .filter(x => x.lvl <= capLvl)
      .sort((a, b) => a.lvl - b.lvl || a.n.localeCompare(b.n))
      .map(x => `${x.n} (lvl ${x.lvl})`);
  }
  // v8.5.2: openChoiceModal replaces prompt() (see its definition above for
  // why). weaponish kinds appended a "(Cat, TLn)" display suffix that must be
  // stripped from the chosen value before use; this is now conditioned on
  // `kind` rather than "did the player type a number" (the old prompt()-index
  // branch applied the strip whenever ANY option was number-picked, which
  // could wrongly truncate a skill name that itself ends in parens, e.g.
  // "Craft (Mechanical)" picked by number — fixed as a side effect).
  const weaponish = kind === 'weapon' || kind === 'martial_weapon' || kind === 'exotic_weapon'
    || kind === 'power';  // v8.13.0: "(lvl N)" display suffix stripped like the weapon "(Cat, TSn)" ones
  openChoiceModal(`${feat.n} — select ${label}${titleNote}`, options, (choice) => {
    let selected = weaponish ? choice.replace(/\s*\([^)]+\)\s*$/, '').trim() : choice;
    // v8.3.33: apply the value-map if this kind has one (lowercase storage for
    // 'pool', etc.). Match is case-insensitive on the display label.
    if (valueMap) {
      const mapped = valueMap[selected] || valueMap[Object.keys(valueMap).find(k => k.toLowerCase() === selected.toLowerCase())];
      if (mapped) selected = mapped;
    }
    if (selected) callback(selected);
  });
}

// Actually add a feat to the character record.
async function addFeatToChar(name, param){
  const c=chars.find(x=>x.id===curId);if(!c)return;if(!c.feats)c.feats=[];
  // Check duplicate. v8.3.30: feats explicitly marked `takeable:'multiple'`
  // (e.g. Expanded Knowledge — each instance grants a different power) are
  // NEVER rejected as duplicates; the whole point is they stack. The previous
  // logic compared (f.param||null) === (param||null), which falsely rejected
  // a second Expanded Knowledge when the feat carried no `param` field at all
  // (both instances collapsed to null === null → true). With Expanded
  // Knowledge now carrying a `param` (see FEATS list) AND this guard skipping
  // multiple-takeable feats entirely, both instances are allowed.
  const data = getFeatData(name);
  if (data?.takeable !== 'multiple') {
    const dup = c.feats.find(f => f.name===name && (f.param||null) === (param||null));
    if (dup) {toast(name+' already added with that parameter.');return;}
    if (!data?.takeable && c.feats.some(f => f.name===name && !data?.param)) {
      if (!(await confirmModal(`${name} is already on this character. Add a second instance?`))) return;
    }
  } else {
    // Multiple-takeable: only reject if the EXACT SAME param is already taken
    // (taking "Expanded Knowledge (Dominate)" twice is still nonsensical).
    if (param) {
      const exactDup = c.feats.find(f => f.name===name && (f.param||null) === param);
      if (exactDup) {toast(`${name} (${param}) is already on this character.`);return;}
    }
  }
  // v8.3.2: slot-aware feat add. If an active class-bonus slot is being
  // filled, tag the feat with slotSource so the system tracks which slot it
  // consumed. If the feat is outside the slot's restriction, prompt the
  // player: take it as a regular feat instead (no slotSource), or override
  // the restriction (slotSource set + GM exception logged).
  let slotSource = null;
  if (_activeBrowserSlot) {
    // v8.3.7: use the structured filter from getRestrictionFilter so we
    // handle both family-restrictions ("Fighter feat list") and explicit
    // allowlists (Hero class bonus feat lists). Filter shape:
    //   {kind:'family', value:'Fighter'} → match feat's data.family
    //   {kind:'list',   value:['Brawl','Cleave',...]} → match feat's name
    //   null → no restriction, anything fills
    const filter = _activeBrowserSlot.restrictionFilter
                   || (_activeBrowserSlot.restrictionFamily
                       ? {kind:'family', value: _activeBrowserSlot.restrictionFamily}
                       : null);
    const featFam = data?.family || null;
    let matches;
    if (!filter) {
      matches = true;
    } else if (filter.kind === 'family') {
      matches = featFam === filter.value;
    } else if (filter.kind === 'list') {
      matches = filter.value.includes(name);
    } else {
      matches = true;  // unknown filter kind — be permissive
    }
    if (matches) {
      slotSource = _activeBrowserSlot.sourceTag;
    } else {
      const restrLabel = _activeBrowserSlot.restriction || (filter?.kind === 'family' ? `${filter.value} feat list` : 'allowlist');
      const displayRestr = (filter?.kind === 'list')
        ? `the ${_activeBrowserSlot.className} ${_activeBrowserSlot.featureName} feat list`
        : restrLabel;
      const choice = await confirmModal(
        `"${name}" is a ${featFam || 'General'} feat, not on ${displayRestr}.\n\n` +
        `Override Restriction = GM exception logged; this slot is consumed.\n` +
        `Take as Regular Feat = your class-bonus slot stays open.`,
        { title: 'Outside Slot Restriction', okLabel: 'Override Restriction', cancelLabel: 'Take as Regular Feat' }
      );
      if (choice) {
        slotSource = _activeBrowserSlot.sourceTag;
        if (!c.gmExceptions) c.gmExceptions = [];
        const target = `Feat (slot restriction): ${name}`;
        if (!c.gmExceptions.find(e => e.target === target)) {
          c.gmExceptions.push({
            type:'feat-slot',
            target,
            missing:[`Filled ${_activeBrowserSlot.className} ${_activeBrowserSlot.featureName} slot with "${name}" (restriction: ${displayRestr})`],
            grantedAt: new Date().toLocaleDateString(),
          });
        }
      }
      // else: slotSource stays null → feat takes a baseline slot
    }
  }
  const featEntry = param ? {name, param} : {name};
  if (slotSource) featEntry.slotSource = slotSource;
  c.feats.push(featEntry);
  // v8.4.0: try to reconcile this feat against an L1 typed slot. Only fires
  // for v8.4.0+ characters at totalLvl 1; legacy and higher-level feats are
  // no-ops. The slot kind that was filled (if any) is recorded on the slot
  // record itself — it's also reflected back onto the feat entry for the
  // toast/UI to surface "[Heritage slot]" etc.
  const filledL1Slot = tryFillFirstLevelSlot(c, name, param);
  if (filledL1Slot) {
    featEntry.l1Slot = filledL1Slot;
  }
  // v8.5.4: MP-granting feats (Slightly Different, Supernatural Mutation,
  // Unstable Mutation I–V) can cross a Mutant Level threshold — apply the
  // slope-rule XP compensation. No-op for every other feat.
  // v8.12.4 (Adam's Rhad ECL-13 report): was reconcileMutantLevelXp alone —
  // it granted the XP but never re-stamped c.ecl/xpNext, so the Sheet showed
  // the pre-crossing ECL until the next full edit-save while the Mutations
  // tab (deriving live) already showed the new Mutant Level.
  refreshEclXp(c);
  // v8.13.0: an Expanded Knowledge pick lands in the repertoire immediately.
  if (reconcileExpandedKnowledgePowers(c)) {
    renderPowers();
    toast(`${param} added to powers known (Expanded Knowledge — bonus power, no slot spent).`);
  }
  // Capture slot label before clearing so the toast can show it
  const slotLabel = slotSource && _activeBrowserSlot ? `${_activeBrowserSlot.className}` : '';
  // Clear the active slot if it's now filled (a single slot is filled by a
  // single feat). The banner will re-detect remaining open slots and offer
  // the next one on the next render.
  if (slotSource) _activeBrowserSlot = null;
  // v8.2.2 (Issue 5): preserve ALL active filters when re-rendering after a pick.
  save();renderFeatList(c);renderFeats();renderFeatBrowser(
    document.getElementById('feat-search').value,
    document.getElementById('feat-type-filter').value,
    document.getElementById('feat-qual-filter')?.value || ''
  );
  const slotTag = slotLabel ? ` [${slotLabel} slot]` : '';
  toast(name + (param?` (${param})`:'') + slotTag + ' added.');
}
