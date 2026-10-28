// =============================================================================
// js/ui/talents.js
// TALENTS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Talents page and talent browser.
//
// KEY NAMES (so you can search for them)
//   functions (14): addTalentToChar, removeTalentFromChar, renderTalents,
//   _populateTalentTreeFilter, openTalentBrowser, closeTalentBrowser,
//   filterTalents, onTalentClassFilterChange, renderTalentBrowser,
//   addTalentFromBrowser, grantEnergyImmunityPick, spendTalentAP,
//   removeTalentClick, promptForTalentParam
//
// WHERE IT CAME FROM
//   Gathered from js/app/51-gm-exceptions-and-talents-page.js,
//   js/app/52-energy-immunity-and-spell-lists.js, js/app/63-modals.js,
//   js/rules/22-career-compass.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Add a talent to the character. Auto-records grantedAt with the most
// natural source: prefers the Hero class the talent belongs to, falls back
// to 'Multi-Talented' if that's the only path, then 'unattributed'.
function addTalentToChar(c, talentName, param) {
  if (!c) return false;
  const t = TALENTS_DB.find(x => x.n === talentName);
  if (!t) {toast('Talent not found.'); return false;}
  if (!c.talents) c.talents = [];
  // Most talents are not re-takeable. Savant is the explicit exception (one
  // per skill). For v8.3.21 we honor a `takeable:'multiple'` flag if present
  // (parallels the Feats convention).
  // v8.5.0 Layer 2: param-aware duplicate rule — a multiple-takeable
  // parameterized talent (Savant) blocks only on the same name+param pair
  // ("each time it applies to a different skill").
  if (t.takeable === 'multiple') {
    if (param && c.talents.some(x => x.name === talentName && x.param === param)) {
      toast(`${talentName} (${param}) already owned.`);
      return false;
    }
  } else if (c.talents.some(x => x.name === talentName)) {
    toast(`${talentName} already owned.`);
    return false;
  }
  // Determine source.
  const classArr = migrateLegacyClasses(c);
  const heroClassNames = new Set(classArr.filter(e => e.tier==='hero' && (e.level||0)>0).map(e => e.name));
  let source = 'unattributed';
  if (t.hero_class && heroClassNames.has(t.hero_class)) {
    source = t.hero_class;
  } else {
    const ownedFeats = new Set((c.feats || []).map(f => f.name || f.n));
    if (ownedFeats.has('Multi-Talented')) source = 'Multi-Talented';
  }
  const rec = {
    name: talentName,
    grantedAt: {
      source,
      level: c.totalLvl || 1,
      atDate: new Date().toLocaleDateString(),
    },
  };
  if (param) rec.param = param; // v8.5.0: chosen skill for Skill Emphasis/Savant
  c.talents.push(rec);
  reconcileTalentHp(c);  // v8.8.0: Robust bakes its retroactive HP
  reconcileTalentAttrBakes(c);  // v8.8.0: Titanic Strength bakes its +10 (Su)
  return true;
}

// v8.5.0: param narrows the match for multiple-takeable parameterized talents
// (removing "Savant (Research)" leaves "Savant (Repair)" alone). Without a
// param argument, the first instance by name is removed (legacy behavior).
function removeTalentFromChar(c, talentName, param) {
  if (!c || !c.talents) return false;
  const idx = c.talents.findIndex(x => x.name === talentName && (param === undefined || x.param === param));
  if (idx < 0) return false;
  const rec = c.talents[idx];
  // v8.8.0: reverse an attr bake on removal (GM-reversible per Adam).
  if (rec.attrApplied && ATTR_KEY_IDX[rec.attrKey] !== undefined && Array.isArray(c.attrs)) c.attrs[ATTR_KEY_IDX[rec.attrKey]] -= rec.attrApplied;
  c.talents.splice(idx, 1);
  // v8.87.0: removing Energy Immunity cascades its free grant away too —
  // the granted Resistance talent exists only by the Super-Talent's grace.
  if (talentName === 'Energy Immunity') {
    const granted = c.talents.filter(t => t.grantedBy === 'Energy Immunity');
    for (const g of granted) c.talents.splice(c.talents.indexOf(g), 1);
    if (granted.length) toast(`Also removed ${granted.map(g => g.name).join(', ')} — granted by Energy Immunity.`);
  }
  reconcileTalentHp(c);  // v8.8.0: Robust's baked HP leaves with the talent
  return true;
}

// ============================================================================
// v8.3.21: TALENT UI
// ============================================================================
//
// Architecture mirrors the Feats UI (see renderFeats / openFeatBrowser below):
//   • renderTalents()       — top-level page renderer (budget, owned list)
//   • openTalentBrowser()   — show the browser modal
//   • closeTalentBrowser()  — hide the browser, refresh the Talents page
//   • renderTalentBrowser() — populate the browser list with filtering
//   • filterTalents()       — re-render when filter inputs change
//   • addTalentFromBrowser()— wire the browser's Add button to addTalentToChar
//   • removeTalentClick()   — remove a talent from the Owned list

// v8.3.22: _talentTreeFilterOptions removed — the tree-filter dropdown is now
// rebuilt per-character on each open to reflect entitlement and class-filter state.

function renderTalents(){
  const prompt = document.getElementById('tl-prompt');
  const cont   = document.getElementById('tl-content');
  if (!curId) {prompt.style.display='block';cont.style.display='none';return;}
  const c = chars.find(x => x.id === curId);
  if (!c) {prompt.style.display='block';cont.style.display='none';return;}
  // Entitlement check — should not happen since the nav-tab is hidden, but
  // defensively redirect to Sheet if somehow reached.
  if (!characterIsEntitledToTalents(c)) {
    showPage('sheet');
    return;
  }
  prompt.style.display='none';
  cont.style.display='block';
  document.getElementById('tl-hero-nm').textContent = c.name + ' — Talents';

  // Budget breakdown
  const budget = getTalentBudget(c);
  // v8.3.30: the counter now visibly flags an over-budget state. With the
  // GM-exception escape hatch, totalPicked CAN exceed totalOwed — when it
  // does, show the overage explicitly rather than just "3 / 2 picked".
  // v8.4.0: four-state color-coded budget display (plan §7.5). Replaces the
  // old binary "over = red" treatment. Also surfaces unassigned-slot count
  // distinctly when Hero's Gift is unassigned.
  const tState = computeResourceState(budget.totalPicked, budget.totalOwed, 'talent', c.gmExceptions || []);
  const tDisplay = RESOURCE_STATE_DISPLAY[tState];
  const countEl = document.getElementById('tl-count');
  // Build the count-string: "N / M picked · {state-specific suffix}".
  let suffix = '';
  if (tState === 'surplus') {
    suffix = ` · ${budget.remaining} unassigned`;
    // v8.4.0: if Hero's Gift is unassigned AND it would have added a talent
    // slot, label it distinctly so the player knows WHY they're surplus.
    if (!isLegacyCharacter(c) && c.heroesGiftChoice === null
        && (c.classes||[]).some(e => e.tier === 'hero')) {
      suffix += ` (incl. unassigned Hero's Gift)`;
    }
  } else if (tState === 'exact') {
    suffix = ` · fully spent`;
  } else if (tState === 'warning') {
    suffix = ` · ${budget.totalPicked - budget.totalOwed} over (GM exception)`;
  } else {
    suffix = ` · ${budget.totalPicked - budget.totalOwed} over budget — reconcile or get GM approval`;
  }
  countEl.innerHTML = `<span title="${tDisplay.label}" style="color:${tDisplay.color};">${tDisplay.icon}</span> ${budget.totalPicked} / ${budget.totalOwed} picked${suffix}`;
  countEl.style.color = tDisplay.color;
  countEl.setAttribute('data-state', tState);
  const budgetEl = document.getElementById('tl-budget');
  const sources = [];
  for (const heroCls in budget.byHeroClass) {
    sources.push(`<div>${escapeHTML(heroCls)}: <span class="c-gold">${budget.byHeroClass[heroCls]}</span> talent${budget.byHeroClass[heroCls]===1?'':'s'} <span class="fs-11 c-g50">(granted at L1/3/5/7/9 of this class)</span></div>`);
  }
  if (budget.bonusGrants > 0) {
    sources.push(`<div>Multi-Talented bonus: <span class="c-gold">${budget.bonusGrants}</span> talent</div>`);
  }
  // Visual pip strip. v8.3.30: when over budget, draw the excess as
  // warning-colored filled pips beyond the entitled count.
  const pips = [];
  const pipMax = Math.max(budget.totalOwed, budget.totalPicked);
  for (let i = 0; i < pipMax; i++) {
    if (i < budget.totalOwed) {
      // Within entitled budget: filled if picked, hollow if open.
      pips.push(i < budget.totalPicked
        ? `<span class="c-gold">◆</span>`
        : `<span class="c-g35">◇</span>`);
    } else {
      // Beyond entitled budget — these are GM-exception talents.
      pips.push(`<span style="color:rgb(var(--text-salmon));" title="Over budget — GM exception">◆</span>`);
    }
  }
  budgetEl.innerHTML =
    (sources.length ? sources.join('') : '<div class="c-g55 italic">No talent slots earned yet.</div>') +
    (pipMax > 0
      ? `<div class="mt-6 fs-14" style="letter-spacing:.18em;">${pips.join('')}</div>`
      : '');

  // Owned list — each talent with citation, tree, source, and Remove button
  const list = document.getElementById('tl-list');
  const owned = c.talents || [];
  if (!owned.length) {
    list.innerHTML = `<div class="p-1rem fs-13 c-g40">No talents selected yet. Click "Browse Talents" above to add one.</div>`;
  } else {
    list.innerHTML = owned.map(t => {
      const data = TALENTS_DB.find(x => x.n === t.name);
      const fam = data?.family || '';
      const tier = data?.tier || 'Talent';
      const desc = data?.d || '';
      const cit = citeHTML('talents', t.name);
      const tierColor = tier === 'Apex Super-Talent' ? 'rgb(var(--text-violet))'
                      : tier === 'Super-Talent' ? 'rgb(var(--text-blue))'
                      : 'var(--g65)';
      // v8.87.0: a grantedBy record is Energy Immunity's free pick — the tag
      // outranks the generic source label (no slot was consumed for it).
      const sourceLabel = t.grantedBy
        ? `<span class="fs-10 ml-6" style="color:rgb(var(--text-blue));" title="Granted free by ${escapeHTML(t.grantedBy)} — no Talent slot consumed; removed automatically if ${escapeHTML(t.grantedBy)} is removed.">◈ granted by ${escapeHTML(t.grantedBy)}</span>`
        : (t.grantedAt?.source
        ? `<span class="fs-10 c-g50 ml-6">from ${escapeHTML(t.grantedAt.source)}</span>`
        : '');
      // v8.5.0: parameterized talents display their chosen skill and remove
      // the specific name+param instance.
      const paramText = t.param ? ` <span class="c-gold">(${escapeHTML(t.param)})</span>` : '';
      const removeArgs = `'${t.name.replace(/'/g,"\\'")}'` + (t.param ? `, '${String(t.param).replace(/'/g,"\\'")}'` : '');
      // v8.5.0 Layer 2: Spend-AP button on AP-SPEND talents (ap_cost field),
      // wired to the existing AP pool with structured logging. A waiver from
      // another owned talent (Preternatural Reflexes' waivesApCost) replaces
      // the button with a "free" badge.
      let apButton = '';
      if (data?.ap_cost) {
        const waivedBy = owned.map(o => TALENTS_DB.find(x => x.n === o.name))
          .find(o => o && Array.isArray(o.waivesApCost) && o.waivesApCost.includes(t.name));
        apButton = waivedBy
          ? `<span class="fs-10 mr-8" style="color:rgb(var(--text-green));" title="AP cost waived by ${escapeHTML(waivedBy.n)}">⚡ free (${escapeHTML(waivedBy.n)})</span>`
          : `<button class="btn btn-sm" style="margin-right:6px;" title="Spend ${data.ap_cost} Action Point${data.ap_cost===1?'':'s'} to activate" onclick="spendTalentAP('${t.name.replace(/'/g,"\\'")}', ${data.ap_cost})">⚡ Spend ${data.ap_cost} AP</button>`;
      }
      return `<div class="feat-entry">
        <div>
          <div class="feat-nm">${escapeHTML(t.name)}${paramText}${cit} <span style="font-size:10px;color:${tierColor};margin-left:6px;text-transform:uppercase;letter-spacing:.04em;">${escapeHTML(tier)}</span>${sourceLabel}</div>
          ${fam ? `<div class="fs-11 c-g60 mt-2">${escapeHTML(fam)}</div>` : ''}
          ${desc ? `<div class="feat-desc">${escapeHTML(desc)}</div>` : ''}
        </div>
        <div class="items-center nowrap" style="display:flex;">${apButton}<button class="btn btn-sm btn-danger" onclick="removeTalentClick(${removeArgs})">✕ Remove</button></div>
      </div>`;
    }).join('');
  }

  // v8.5.0 Layer 2: Active Talent Effects panel — always-on mechanical
  // effects aggregated from owned talents (computeTalentEffects), shown above
  // the owned list. Targets with their own sheet plumbing (HP, Initiative,
  // Natural AC, skill totals) are not repeated here — they're already folded
  // into those stats. Super/Apex riders that depend on unowned prereq talents
  // are excluded by buildTalentBonuses' requiresTalent filter, so this panel
  // shows exactly what's live.
  const fx = computeTalentEffects(c);
  if (fx.length) {
    const fxRows = fx.map(e =>
      `<div class="justify-between p-2-0" style="display:flex;gap:12px;">
        <span>${escapeHTML(e.stat)}: <b class="c-gold">${escapeHTML(e.text)}</b></span>
        <span class="fs-11 c-g55" style="text-align:right;">${escapeHTML(e.from)}</span>
      </div>`).join('');
    list.innerHTML = `<div class="p-8-12 mb-10 fs-13" style="border:1px solid rgb(var(--line-gold) / .25);background:rgb(var(--tint-gold) / .05);">
      <div class="font-serif fs-10 uppercase ls-0_1em c-g70 mb-4">Active Talent Effects</div>
      ${fxRows}
    </div>` + list.innerHTML;
  }
}

// Populate the tree filter dropdown once we know what trees exist.
// v8.3.22: Build the Tree filter dropdown options for the current character
// and current class-filter selection. Tree labels include their Hero class
// for clarity (e.g. "Research Tree (Smart Hero)"). Only trees the character
// has access to are shown:
//   • If a specific class is selected in the class filter → only that class's trees
//   • If "All Hero Classes" is selected:
//     - Character with Hero classes → trees from those classes
//     - Character with Multi-Talented → trees from all Hero classes
//     - Otherwise (defensive recovery case) → all trees
// Apex trees are always hidden from the filter dropdown since they're
// individual end-points, not browsable categories.
function _populateTalentTreeFilter() {
  const sel = document.getElementById('talent-tree-filter');
  if (!sel) return;
  // Find the current character (caller may invoke before curId is set on
  // fresh page, in which case fall back to "show all").
  const c = curId ? chars.find(x => x.id === curId) : null;
  const classFilter = (document.getElementById('talent-class-filter')?.value) || '';

  // Resolve which Hero classes' trees should appear.
  let allowedHeroClasses;
  if (classFilter) {
    allowedHeroClasses = new Set([classFilter]);
  } else if (c) {
    const classArr = migrateLegacyClasses(c);
    const heroClasses = new Set(classArr.filter(e => e.tier==='hero' && (e.level||0)>0).map(e => e.name));
    const ownedFeats = new Set((c.feats || []).map(f => f.name || f.n));
    if (ownedFeats.has('Multi-Talented')) {
      // Multi-Talented unlocks any one cross-class talent — show all six Hero
      // classes' trees so the player can plan.
      allowedHeroClasses = new Set(['Strong Hero','Fast Hero','Tough Hero','Smart Hero','Dedicated Hero','Charismatic Hero']);
    } else if (heroClasses.size > 0) {
      allowedHeroClasses = heroClasses;
    } else {
      // Defensive recovery (character has orphan talents but no Hero class
      // and no Multi-Talented) → show all six so they can see what was used.
      allowedHeroClasses = new Set(['Strong Hero','Fast Hero','Tough Hero','Smart Hero','Dedicated Hero','Charismatic Hero']);
    }
  } else {
    allowedHeroClasses = new Set(['Strong Hero','Fast Hero','Tough Hero','Smart Hero','Dedicated Hero','Charismatic Hero']);
  }

  // Collect {tree, hero_class} pairs from TALENTS_DB, deduped.
  const seen = new Set();
  const pairs = [];
  for (const t of TALENTS_DB) {
    if (!t.tree || !t.hero_class) continue;
    // Skip Apex trees — they're individual capstones, not browsable categories.
    if (/^Apex:/.test(t.tree)) continue;
    if (!allowedHeroClasses.has(t.hero_class)) continue;
    const key = `${t.hero_class}||${t.tree}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({hero_class: t.hero_class, tree: t.tree});
  }
  // Sort: by hero class (in our canonical order), then by tree name.
  const heroOrder = ['Strong Hero','Fast Hero','Tough Hero','Smart Hero','Dedicated Hero','Charismatic Hero'];
  pairs.sort((a,b) => {
    const ai = heroOrder.indexOf(a.hero_class), bi = heroOrder.indexOf(b.hero_class);
    if (ai !== bi) return ai - bi;
    return a.tree.localeCompare(b.tree);
  });

  const opts = ['<option value="">All Trees</option>']
    .concat(pairs.map(p =>
      `<option value="${escapeHTML(p.tree)}">${escapeHTML(p.tree)} (${escapeHTML(p.hero_class)})</option>`
    )).join('');
  sel.innerHTML = opts;
}

function openTalentBrowser() {
  if (!curId) {toast('Select a hero first.'); return;}
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  _populateTalentTreeFilter();
  // Hide all other pages; show the browser as a faux-page.
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const browser = document.getElementById('talent-browser');
  browser.style.display = 'block';
  browser.classList.add('active');
  // Banner: show budget context.
  const budget = getTalentBudget(c);
  const banner = document.getElementById('talent-browser-banner');
  if (budget.remaining > 0) {
    banner.style.display = 'block';
    banner.innerHTML = `<b>${budget.remaining}</b> talent slot${budget.remaining===1?'':'s'} available. Default filter shows only Talents you qualify for; switch the rightmost dropdown to see others. Super-Talents consume no selection — prerequisites + banked MP are their whole price.`;
  } else if (budget.totalOwed > 0) {
    banner.style.display = 'block';
    banner.innerHTML = `All ${budget.totalOwed} talent slot${budget.totalOwed===1?' is':'s are'} filled. You can still browse for reference or remove an existing talent to free a slot — and Super-Talents remain acquirable regardless (they consume no selection; prerequisites + banked MP are their whole price).`;
  } else {
    banner.style.display = 'block';
    banner.innerHTML = `No talent slots earned yet. You can browse the catalog for reference, but cannot add talents until you take a Hero class level or the Multi-Talented Heritage feat.`;
  }
  filterTalents();
}

function closeTalentBrowser() {
  const browser = document.getElementById('talent-browser');
  browser.style.display = 'none';
  browser.classList.remove('active');
  showPage('talents');
}

function filterTalents() {
  renderTalentBrowser(
    document.getElementById('talent-search')?.value || '',
    document.getElementById('talent-class-filter')?.value || '',
    document.getElementById('talent-tree-filter')?.value || '',
    document.getElementById('talent-qual-filter')?.value || ''
  );
}

// v8.3.22: When the class filter changes, rebuild the tree-filter dropdown so
// its options reflect the new constraint. Preserve the user's tree selection
// if it's still valid; otherwise reset to "All Trees".
function onTalentClassFilterChange() {
  const treeSel = document.getElementById('talent-tree-filter');
  const prevTree = treeSel?.value || '';
  _populateTalentTreeFilter();
  // If the previously-selected tree is still in the dropdown, keep it.
  if (prevTree && treeSel) {
    const matches = Array.from(treeSel.options).some(o => o.value === prevTree);
    treeSel.value = matches ? prevTree : '';
  }
  filterTalents();
}

function renderTalentBrowser(searchText, classFilter, treeFilter, qualFilter) {
  const list = document.getElementById('talent-browser-list');
  if (!list) return;
  const c = curId ? chars.find(x => x.id === curId) : null;
  const owned = new Set((c?.talents || []).map(t => t.name));
  const searchLow = (searchText || '').toLowerCase();

  // Pre-compute qualification per talent.
  const status = new Map();
  if (c) {
    for (const t of TALENTS_DB) {
      const r = checkTalentPrereqs(t.n, c);
      let s = 'qualifies';
      if (!r.met) {
        s = r.missing.every(m => /\(GM-verify\)/.test(m)) ? 'gmverify' : 'missing';
      }
      if (owned.has(t.n)) s = 'owned';
      status.set(t.n, {status:s, result:r});
    }
  }

  // Filter
  const filtered = TALENTS_DB.filter(t => {
    const matchText = !searchText
      || (t.n||'').toLowerCase().includes(searchLow)
      || (t.d||'').toLowerCase().includes(searchLow);
    const matchClass = !classFilter || t.hero_class === classFilter;
    const matchTree  = !treeFilter  || t.tree === treeFilter;
    let matchQual = true;
    if (qualFilter && c) {
      const cur = status.get(t.n)?.status;
      if (qualFilter === 'owned')     matchQual = (cur === 'owned');
      else if (qualFilter === 'qualifies') matchQual = (cur === 'qualifies' || cur === 'gmverify');
      else if (qualFilter === 'missing')   matchQual = (cur === 'missing');
    }
    return matchText && matchClass && matchTree && matchQual;
  });

  // v8.12.1 (Adam's catch: Super-Talents were undiscoverable): the default
  // "Qualifies Only" filter hides the ENTIRE Super/Apex tier for a character
  // without Supernatural Mutation — with no trace they exist. When that
  // happens, append a footer row saying how many are hidden and how the
  // purchase path works, with a one-click switch to "All Talents".
  let hiddenSuper = 0;
  if (qualFilter === 'qualifies' && c) {
    hiddenSuper = TALENTS_DB.filter(t => {
      if (!/Super-Talent/.test(t.tier || '')) return false;
      const matchText = !searchText || (t.n||'').toLowerCase().includes(searchLow) || (t.d||'').toLowerCase().includes(searchLow);
      const matchClass = !classFilter || t.hero_class === classFilter;
      const matchTree  = !treeFilter  || t.tree === treeFilter;
      return matchText && matchClass && matchTree && status.get(t.n)?.status === 'missing';
    }).length;
  }
  const superNote = hiddenSuper
    ? `<div class="p-8-12 fs-12" style="color:var(--tk85);border-bottom:1px solid rgb(var(--line-gold) / .15);background:rgb(var(--tint-blue) / .05);">
        <b>${hiddenSuper}</b> Super-Talent${hiddenSuper===1?'':'s'} hidden by the "Qualifies Only" filter. Super-Talents are purchased right here — they require the <b>Supernatural Mutation</b> feat and enough banked MP (adding one spends the MP automatically).
        <button class="ml-8 btn btn-sm" onclick="const q=document.getElementById('talent-qual-filter'); if(q){q.value='';} filterTalents();">Show them</button>
      </div>`
    : '';

  if (!filtered.length) {
    list.innerHTML = `<div class="p-1rem fs-13 c-g40">No matching talents. Adjust filters or search.</div>` + superNote;
    return;
  }

  list.innerHTML = superNote + filtered.map(t => {
    const fam = t.family || '';
    const tier = t.tier || 'Talent';
    const desc = t.d || '';
    const prereqText = t.prereqs_text || '';
    const cur = status.get(t.n)?.status || 'qualifies';
    const r = status.get(t.n)?.result || {met:true, missing:[]};

    // Status indicator + add button state
    let statusBadge, addBtn;
    if (cur === 'owned') {
      statusBadge = `<span class="fs-10 c-g65 ml-6">⚿ owned</span>`;
      addBtn = t.takeable === 'multiple'
        ? `<button class="btn btn-sm btn-pri" onclick="addTalentFromBrowser('${t.n.replace(/'/g,"\\'")}')">+ Add Again</button>`
        : `<button class="op-0_5 btn btn-sm" disabled>Owned</button>`;
    } else if (cur === 'qualifies') {
      statusBadge = `<span class="fs-10 ml-6" style="color:rgb(var(--text-green));">✓ qualifies</span>`;
      addBtn = `<button class="btn btn-sm btn-pri" onclick="addTalentFromBrowser('${t.n.replace(/'/g,"\\'")}')">+ Add</button>`;
    } else if (cur === 'gmverify') {
      statusBadge = `<span class="fs-10 c-g65 ml-6">⚠ GM-verify</span>
        <div class="fs-11 c-g55 mt-2">${escapeHTML(r.missing.join(' · '))}</div>`;
      addBtn = `<button class="btn btn-sm btn-pri" onclick="addTalentFromBrowser('${t.n.replace(/'/g,"\\'")}')">+ Add</button>`;
    } else {
      statusBadge = `<span class="fs-10 c-red-text ml-6">✗ missing prereqs</span>
        <div class="fs-11 c-g55 mt-2">${escapeHTML(r.missing.join(' · '))}</div>`;
      addBtn = `<button class="op-0_5 btn btn-sm" disabled>Locked</button>`;
    }

    const tierColor = tier === 'Apex Super-Talent' ? 'rgb(var(--text-violet))'
                    : tier === 'Super-Talent' ? 'rgb(var(--text-blue))'
                    : 'var(--g65)';
    const tierTag = `<span style="font-size:10px;color:${tierColor};margin-left:6px;text-transform:uppercase;letter-spacing:.04em;">${escapeHTML(tier)}</span>`;
    const mpTag = t.mp_cost ? `<span class="fs-10 ml-4" style="color:var(--tv70);">${t.mp_cost} MP</span>` : '';
    const prereqLine = prereqText
      ? `<div class="fs-11 c-g60 mt-2 feat-pre">Prereq: ${escapeHTML(prereqText)}</div>`
      : '';

    return `<div class="feat-entry">
      <div>
        <div class="feat-nm">${escapeHTML(t.n)}${citeHTML('talents', t.n)}${tierTag}${mpTag}${statusBadge}</div>
        ${fam ? `<div class="fs-11 c-g55 mt-2">${escapeHTML(fam)}</div>` : ''}
        ${prereqLine}
        ${desc ? `<div class="feat-desc">${escapeHTML(desc)}</div>` : ''}
      </div>
      ${addBtn}
    </div>`;
  }).join('');
}

async function addTalentFromBrowser(name) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  // v8.3.30: enforce the Talent budget. Previously the Talents screen showed
  // a counter ("3/2 picked") but the Add action wasn't gated on it — the
  // player could take unlimited Talents. Now, if the character is already at
  // or over budget, adding another requires explicit GM approval, logged as a
  // GM exception (parallel to the feat-prereq and class-prereq override flow).
  //
  // Talent budget rules (HH): each Hero class grants 5 Talents over levels
  // 1/3/5/7/9; the Multi-Talented Heritage feat grants +1. Exceeding that is
  // not a rules-legal state, but per design we allow a GM-approved override
  // for the rare exceptional case.
  const budget = getTalentBudget(c);
  // v8.21.1 (Adam's ruling): Super-Talents and Apex Super-Talents bypass the
  // slot budget entirely — prerequisites + banked MP are the whole price
  // (the acquisition is the MP spend; the ledger sums ownership). The
  // qualification badge (checkTalentPrereqs) still reports missing MP.
  if (!talentConsumesSlot(name)) {
    const tD = TALENTS_DB.find(x => x.n === name);
    const mpSt = getMPState(c);
    const cost = (tD && tD.mp_cost) || 0;
    if (mpSt && cost > mpSt.balance) {
      if (!(await confirmModal(`${name} costs ${cost} MP but only ${mpSt.balance} MP is banked.\n\nAcquire anyway as a GM-approved exception? (The ledger will show the overdraft.)`))) return;
      if (!c.gmExceptions) c.gmExceptions = [];
      const target = `Super-Talent (MP overdraft): ${name}`;
      if (!c.gmExceptions.find(e => e.target === target)) {
        c.gmExceptions.push({ type: 'talent', target, missing: [`${cost} MP required, ${mpSt.balance} banked`], grantedAt: new Date().toLocaleDateString() });
      }
    }
    if (addTalentToChar(c, name)) {
      save();
      filterTalents();
      toast(`Added ${name} — ${cost} MP spent (no Talent selection consumed).`);
      // v8.87.0 (Adam's intent ruling): Energy Immunity is a TWO-STEP engine.
      if (name === 'Energy Immunity') grantEnergyImmunityPick(c);
    }
    return;
  }
  if (budget.remaining <= 0) {
    const overBy = budget.totalPicked - budget.totalOwed + 1; // +1 for the one being added
    const msg = `Talent budget exceeded.\n\n` +
      `This character is entitled to ${budget.totalOwed} Talent${budget.totalOwed===1?'':'s'} ` +
      `(${Object.entries(budget.byHeroClass).map(([cls,n])=>`${cls}: ${n}`).join(', ')||'none from Hero classes'}` +
      `${budget.bonusGrants?`, +${budget.bonusGrants} from feats`:''}) ` +
      `and already has ${budget.totalPicked}.\n\n` +
      `Adding "${name}" would put them ${overBy} over budget. This is not a ` +
      `rules-legal state. Proceed anyway as a GM-approved exception?`;
    if (!(await confirmModal(msg))) return;
    // Record the GM exception.
    if (!c.gmExceptions) c.gmExceptions = [];
    const target = `Talent (over budget): ${name}`;
    if (!c.gmExceptions.find(e => e.target === target)) {
      c.gmExceptions.push({
        type: 'talent',
        target,
        missing: [`Character has ${budget.totalPicked} Talents but is entitled to only ${budget.totalOwed}`],
        grantedAt: new Date().toLocaleDateString(),
      });
    }
  }
  // v8.5.0 Layer 2: parameterized talents (Skill Emphasis, Savant) prompt for
  // their skill before the record is created — mirrors the feat param flow.
  const tData = TALENTS_DB.find(x => x.n === name);
  if (tData && tData.param) {
    promptForTalentParam(tData, (param) => {
      if (addTalentToChar(c, name, param)) {
        save();
        filterTalents();
        toast(`Added ${name} (${param}).`);
      }
    });
    return;
  }
  if (addTalentToChar(c, name)) {
    save();
    filterTalents();   // refresh browser
    toast(`Added ${name}.`);
  }
}

function grantEnergyImmunityPick(c) {
  const owned = new Set((c.talents || []).map(t => t.name));
  const options = ENERGY_RES_TREE.filter(n => !owned.has(n));
  if (!options.length) {
    toast('◈ Energy Immunity: all five Energy Resistance talents already owned — the bonus grant is extraneous; immunity already covers the full tree.');
    return;
  }
  openChoiceModal('Energy Immunity — choose your FREE Energy Resistance talent (granted; no Talent slot, no MP)', options, (sel) => {
    if (!sel) return;
    if (addTalentToChar(c, sel)) {
      const rec = (c.talents || []).find(t => t.name === sel);
      if (rec) rec.grantedBy = 'Energy Immunity';
      logAct(`◈ ${sel} granted FREE by Energy Immunity (no Talent slot consumed) — immunity now covers every owned Resistance type.`);
      save(); filterTalents();
      renderSheet();
      toast(`◈ ${sel} granted by Energy Immunity — now immune to all owned Resistance types.`);
    }
  });
}

// v8.5.0 Layer 2: spend AP to activate an AP-SPEND talent (Defensive Roll,
// Opportunist, Second Wind, Healing Hands). Routes through adjustAPSilent so
// the spend lands in the action log with the talent as its reason; the AP
// bar on the Tracker page refreshes automatically.
function spendTalentAP(name, cost) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if ((c.ap || 0) < cost) {
    toast(`Not enough AP — ${name} costs ${cost}, you have ${c.ap || 0}.`);
    return;
  }
  adjustAPSilent(c, -cost, `Talent: ${name}`, '');
  toast(`Spent ${cost} AP on ${name} (${c.ap}/${c.apMax} AP remaining).`);
}

async function removeTalentClick(name, param) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!(await confirmModal(`Remove ${name}${param ? ` (${param})` : ''}?`))) return;
  if (removeTalentFromChar(c, name, param)) {
    save();
    renderTalents();
    // If browser is open, refresh it too (so the Owned status updates).
    const browser = document.getElementById('talent-browser');
    if (browser && browser.style.display !== 'none') filterTalents();
    toast(`Removed ${name}.`);
  }
}

// v8.5.0 Layer 2: prompt for a talent's parameter (mirrors promptForFeatParam).
// Skill Emphasis takes any skill; Savant has a restricted options list on its
// param field. Options of the form "Craft (Any)" / "Knowledge (Any)" expand to
// the actual SKILLS sub-skills at prompt time, per the talent text's "any
// single skill" wording.
function promptForTalentParam(talent, callback){
  const kind = talent.param.param_kind;
  const label = talent.param.param_label || 'Parameter';
  let options = [];
  if (Array.isArray(talent.param.options)) {
    for (const o of talent.param.options) {
      const anyM = /^(.+) \(Any\)$/.exec(o);
      if (anyM) {
        options.push(...SKILLS.filter(s => s.n.startsWith(anyM[1] + ' (')).map(s => s.n));
      } else {
        options.push(o);
      }
    }
  } else if (kind === 'skill') {
    options = SKILLS.map(s => s.n);
  }
  // v8.5.2: openChoiceModal replaces prompt() — see the matching comment in
  // promptForFeatParam (this was the exact bug behind the "+ Add doesn't add
  // Savant" report, 2026-06-30: prompt() failing silently with no toast/error).
  openChoiceModal(`${talent.n} — select ${label}`, options, (choice) => {
    if (choice) callback(choice);
  });
}
