// =============================================================================
// js/core/navigation.js
// NAVIGATION — APP CORE
// =============================================================================
//
// WHAT'S IN HERE
//   App plumbing shared by every page. Switching tabs (showPage), the tab
//   badges for outstanding choices, which tabs a character can see, and the
//   toast messages.
//
// KEY NAMES (so you can search for them)
//   tables and state: NAV_TAB_VISIBILITY
//   functions (8): togglePageTut, toggleGearTut, outstandingSelections,
//   renderNavTabs, toast, toastAction, showPage, toggleDrill
//
// WHERE IT CAME FROM
//   Gathered from js/app/41-state-storage-navigation.js, js/rules/10-minds-
//   ledger-and-magic-browser.js, js/rules/20-scenario-titles-and-heroic-
//   resources.js, js/rules/22-career-compass.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded first. Declarations only: nothing here runs while the page loads
//   (the saved roster is restored by js/main.js).
// =============================================================================

// v8.29.0→v8.30.0 (Adam): page-tutorial toggles ("ⓘ HOW THIS PAGE WORKS") —
// one per dense page (gear, powers, tracker). Collapsed by default; each
// page's open/closed choice persists per browser via localStorage (guarded —
// storage can throw in private windows etc.; the toggle works without it).
function togglePageTut(page) {
  const body = document.getElementById(page + '-tut-body');
  const chev = document.getElementById(page + '-tut-chev');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if (chev) chev.textContent = open ? '▾' : '▸';
  try { localStorage.setItem('dxd20v2_ui_' + page + 'TutOpen', open ? '1' : '0'); } catch (e) {}
}
function toggleGearTut() { togglePageTut('gear'); }  // v8.29.0 markup compatibility

// Configuration table for forward-compatible tab gating. When the Spells and
// Powers tabs ship in v8.3.22+, they'll add their own entry here mapping to
// their own entitlement check. The renderNavTabs() controller consults this
// table on every character change.
const NAV_TAB_VISIBILITY = {
  talents: c => characterIsEntitledToTalents(c),
  // v8.6.0 split (Adam): two entitlement-gated tabs over the one unified
  // powers page — Spells (arcane/divine) and Powers (psionic/super). The
  // catalogue stays one Ch.IX listing underneath; the tabs are modes.
  spells: c => characterIsEntitledToSpells(c),
  powers: c => characterIsEntitledToPowers(c),
  // v8.5.3: MP economy — mutants (Mutation Scale ≥ 1, or MP already on the
  // ledger) see the tab; excluded types (Construct etc.) do not.
  mutations: c => characterIsEntitledToMutations(c),
  // v8.13.x Segment A (Adam's contingent-tab ruling): the Vehicles tab
  // appears once something pilotable is owned (vehicles now; power armor,
  // mecha, and starships join in later segments).
  vehicles: c => characterIsEntitledToVehicles(c),
};

function outstandingSelections(c) {
  const out = {};
  try {
    const rem = computeSkillPointBudget(c) - skillPointsSpentOf(c);
    if (rem > 0) out.skills = [`${rem} skill point${rem === 1 ? '' : 's'} unspent`];
  } catch (e) {}
  try {
    const tb = getTalentBudget(c);
    if ((tb.remaining || 0) > 0) out.talents = [`${tb.remaining} talent slot${tb.remaining === 1 ? '' : 's'} open`];
  } catch (e) {}
  try {
    const fb = getFeatBudget(c); const notes = [];
    if ((fb.remaining || 0) > 0) {
      // v8.51.0 (Xander build finding #3): name the budget's composition so
      // an open slot is never anonymous — the player sees WHICH grants exist
      // (and the class-list restrictions those labels imply).
      let comp = '';
      try { comp = ' — budget: ' + fb.sources.map(s => s.count > 1 ? `${s.label} ×${s.count}` : s.label).join(', '); } catch (e) {}
      notes.push(`${fb.remaining} feat slot${fb.remaining === 1 ? '' : 's'} open${comp}`);
    }
    if (!isLegacyCharacter(c) && c.heroesGiftChoice === null
        && migrateLegacyClasses(c).some(e => e.tier === 'hero')) notes.push(`Hero's Gift unclaimed — a FREE bonus pick (feat or talent) is owed; claim it with one click at the top of the Feats tab`);
    for (const f of (c.feats || [])) {
      const d = getFeatData(f.name || f.n);
      if (d && d.param && !f.param && !f.grantedBy) notes.push(`${d.n}: ${(d.param.param_label || 'parameter').toLowerCase()} not chosen`);
    }
    // v8.52.0 (Xander build finding #4): aggregate feat-list compliance — a
    // feat added outside the slot-targeted browser can strand a restricted
    // class-bonus slot. Name the stuck feats and the lists still owed.
    try {
      const flc = featListComplianceOf(c);
      if (flc && flc.unplaced.length) {
        notes.push(`⚖ Feat-list check: ${flc.unplaced.map(n => `"${n}"`).join(', ')} ${flc.unplaced.length === 1 ? 'fits' : 'fit'} no remaining open slot — the unfilled slot${flc.openLabels.length === 1 ? ' is' : 's are'} restricted (${flc.openLabels.join('; ') || 'see Feats tab'}). Swap a pick, refill via the slot's own ➕ browser, or record a GM exception.`);
      }
    } catch (e) {}
    if (notes.length) out.feats = notes;
  } catch (e) {}
  try {
    const pb = getPowersBudget(c);
    const spellNotes = [], powerNotes = [];
    for (const [pool, b] of Object.entries(pb || {})) {
      if (b.total !== null && b.total !== undefined && (b.picked || 0) < b.total) {
        const n = b.total - (b.picked || 0);
        // v8.41.0 (Adam's Heinrix report): itemize WHICH levels are owed.
        // Matrix pools (Sorcerer/Bard) list per-level shortfalls ("0th ×1,
        // 2nd ×2"); flat psionic pools state the any-mix rule so the count
        // reads as a choice, not a hidden quota.
        const ord = (v) => v === 0 ? '0th' : v === 1 ? '1st' : v === 2 ? '2nd' : v === 3 ? '3rd' : v + 'th';
        let detail = '';
        try {
          const kbl = b.knownByLvl || [];
          if (kbl.some(x => x > 0)) {
            const pbl = knownPickedByLevel(c, pool);
            const owed = kbl.map((cap, i) => cap > 0 && (pbl[i] || 0) < cap ? `${ord(i)} ×${cap - (pbl[i] || 0)}` : null).filter(Boolean);
            if (owed.length) detail = ` — ${owed.join(', ')}`;
          } else {
            detail = ` (any mix up to ${ord(b.maxPowerLvl)})`;
          }
        } catch (e) {}
        (pool === 'psionic' ? powerNotes : spellNotes)
          .push(`${n} ${pool} ${pool === 'psionic' ? 'power' : 'spell'}${n === 1 ? '' : 's'} known unpicked${detail}`);
      }
    }
    if (spellNotes.length) out.spells = spellNotes;
    if (powerNotes.length) out.powers = powerNotes;
  } catch (e) {}
  // v8.36.0 (the Quickdraw audit's one finding): class SUB-OPTION choices are
  // prompted only in the create/edit form — a Psion or Saint taken via Level
  // Up ends up silently unconfigured (advisory/fallback behavior, never an
  // auto-pick, but nothing told the player a decision was owed). Mandatory
  // picks flag on the Sheet tab (where ✎ Edit lives); the Ranger's combat
  // style points at its own Gear picker. Wizard school specialization is
  // deliberately NOT flagged — a generalist Wizard is a legitimate choice.
  try {
    const notes = [];
    const lvlOfCls = (n) => { const e = migrateLegacyClasses(c).find(x => x.name === n); return e ? (e.level || 0) : 0; };
    if (lvlOfCls('Psion') > 0 && !c.psionDiscipline) notes.push('Psion discipline unchosen (mandatory at 1st) — ✎ Edit to pick');
    if (lvlOfCls('Cleric') > 0 && !c.druidOption && !(c.clericDomains || []).length) notes.push('Cleric domains unchosen (two) — ✎ Edit to pick');
    if (lvlOfCls('Saint') > 0 && !(c.saintDomains || []).length) notes.push("Saint deity domains unchosen (they ARE the spell list) — ✎ Edit to pick");
    if (lvlOfCls('Paladin') >= 4 && !(c.paladinDomains || []).length) notes.push("Paladin deity domains unchosen (casting starts at 4th) — ✎ Edit to pick");
    if (notes.length) out.sheet = (out.sheet || []).concat(notes);
    if (lvlOfCls('Ranger') >= 2 && !c.rangerCombatStyle) {
      out.gear = (out.gear || []).concat(['Ranger combat style unchosen (2nd level) — 🏹 picker on this page']);
    }
  } catch (e) {}
  // v8.40.0 (Quickdraw): a skeleton character ships without an occupation —
  // flag it as an owed pick, but ONLY on Quickdraw-born records (legacy
  // characters without occupations must not sprout retroactive dots).
  // v8.51.0 (Xander build finding #1): EMPTY OCCUPATION PICKS previously
  // passed save and ledger silently — the two permanent class skills then
  // quietly cost cross-class on the skills page (the two ledgers appear to
  // disagree until the picks exist). Enrolled here exactly like Hero's Gift.
  try {
    const occList = c.occupations || (c.occ ? [c.occ] : []);
    const slotNames = ['primary', 'secondary'];
    occList.forEach((occName, i) => {
      if (!occName || i > 1) return;
      const od = getOccupationData(occName);
      if (!od) return;
      const picks = (c.occupationPicks && c.occupationPicks[slotNames[i]]) || {skills: [], bonusFeat: null};
      const want = od.skill_count || 0;
      const have = (picks.skills || []).filter(Boolean).length;
      const bits = [];
      if (have < want) bits.push(`${want - have} class-skill pick${want - have === 1 ? '' : 's'}`);
      const l1occ = (c.firstLevelSlots || []).find(s => s.kind === 'occupation' && (!s.occupation || s.occupation === occName));
      if (od.bonus_feat_options && od.bonus_feat_options.length && !picks.bonusFeat && !(l1occ && l1occ.filled)) bits.push('bonus feat');
      if (bits.length) (out.sheet = out.sheet || []).push(`${occName} occupation picks unchosen (${bits.join(' + ')}) — ✎ Edit; unpicked skills cost cross-class`);
    });
  } catch (e) {}
  try {
    if (c._quickdraw && !(c.occupations || []).length && !c.occ) {
      out.sheet = (out.sheet || []).concat(['Occupation unchosen (Quickdraw skeleton) — ✎ Edit to pick']);
    }
  } catch (e) {}
  // v8.39.0 (Career Compass): deliberately INVERTED dot semantics — no dot
  // while the journey is in progress (a goal is not a pick owed), but when
  // every prerequisite goes green and the class isn't taken yet, that IS an
  // outstanding selection: the door is open.
  try {
    if (c.careerGoal) {
      const st = careerCompassState(c);
      if (st && !st.invalid && !st.owned && st.met) {
        out.sheet = (out.sheet || []).concat([`Career goal unlocked: ${st.goal} — take your first level!`]);
      }
    }
  } catch (e) {}
  return out;
}
function renderNavTabs(c) {
  // v8.32.0: attention dots — computed once per render, guarded.
  let attn = {};
  try { if (c) attn = outstandingSelections(c); } catch (e) {}
  for (const tabId in NAV_TAB_VISIBILITY) {
    const isVisible = !!(c && NAV_TAB_VISIBILITY[tabId](c));
    // Tab button (in the navbar)
    const btn = document.querySelector(`button[onclick="showPage('${tabId}')"]`);
    if (btn) btn.style.display = isVisible ? '' : 'none';
    // v8.6.0: context-specific labels (Adam) — the tabs name the character's
    // actual sides: "✨ Arcane / Divine Spells", "◈ Psionic / Super Powers".
    if (btn && isVisible && (tabId === 'spells' || tabId === 'powers')) {
      btn.textContent = (tabId === 'spells' ? '✨ ' : '◈ ') + _pwSideLabel(c, tabId);
    }
  }
  // v8.32.0: the amber dot + itemized tooltip — over ALL character-scoped
  // tabs, not just the gated ones (NAV_TAB_VISIBILITY only lists tabs that
  // can hide; Skills/Feats/Gear/etc. are always-visible and never enter the
  // loop above — the first battery run caught exactly that).
  for (const tabId of ['sheet','skills','talents','feats','mutations','powers','spells','gear','tracker']) {
    const btn = document.querySelector(`button[onclick="showPage('${tabId}')"]`);
    if (!btn) continue;
    const gated = NAV_TAB_VISIBILITY[tabId];
    const isVisible = !!(c && (!gated || gated(c)));
    const notes = isVisible ? attn[tabId] : null;
    btn.classList.toggle('nav-attn', !!(notes && notes.length));
    btn.title = (notes && notes.length) ? ('Outstanding: ' + notes.join(' · ')) : '';
  }
  // If the active page is now hidden, redirect to Sheet. Defensively guard
  // against stub DOMs (test environments) where activePage.id may not be a
  // proper string.
  try {
    const activePage = document.querySelector('.page.active');
    if (activePage && typeof activePage.id === 'string') {
      const pageName = activePage.id.replace(/^page-/, '');
      // v8.56.0 (playtest issue #5): the Spells and Powers TABS share the one
      // page-powers DOM. The old check gated the shared page by the PSIONIC
      // entitlement alone — so a divine-only caster (the first Divine
      // Heritage build through the tool) was kicked to Sheet on EVERY save,
      // including each spell added from the catalogue. The shared page is
      // legitimate if EITHER side's entitlement holds.
      const gates = (pageName === 'powers' || pageName === 'spells')
        ? [NAV_TAB_VISIBILITY.powers, NAV_TAB_VISIBILITY.spells]
        : [NAV_TAB_VISIBILITY[pageName]];
      if (gates[0] && c && !gates.some(g => g && g(c))) {
        showPage('sheet');
      }
    }
  } catch (e) { /* swallow — defensive */ }
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
// v8.52.0 (Session Zero polish): action toast — a toast carrying one button.
// Used for the post-level-up deep link ("Open Skills →"). Longer dwell than
// the plain toast because the player is being offered a choice, not told a
// fact. The handler is stashed on window so the inline onclick can reach it.
function toastAction(msg, btnLabel, fn){
  const t = document.getElementById('toast');
  window._toastActionFn = () => { try { fn(); } catch(e){} t.classList.remove('show'); };
  t.innerHTML = `${escapeHTML(msg)} <button class="ml-8 fs-11 c-gold btn btn-sm" onclick="window._toastActionFn()" style="padding:2px 9px;border-color:var(--gold);">${escapeHTML(btnLabel)}</button>`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 7000);
}
function showPage(n){
  // v8.2.2 (Issue 2 + 3): when navigating to the create form without an
  // active edit, clear the form so prior-character state doesn't leak in.
  // Also defensively clear a stale editId — if the character it referenced
  // was deleted, the next save would otherwise try to overwrite a phantom.
  // This fix has data-safety implications: prior to this, going from a
  // saved sheet → Create tab without explicitly clicking "New Hero" would
  // leave editId set, and clicking "Save Hero" would overwrite the prior
  // character with whatever was on the form.
  if (n === 'create') {
    if (editId !== null) {
      const stillExists = chars.some(c => c.id === editId);
      if (!stillExists) {
        // The character we were editing no longer exists. Treat as fresh
        // creation.
        clearForm();
      }
      // else: legitimate mid-edit; leave the form alone.
    } else {
      // No active edit → clean form for a new character.
      clearForm();
    }
  }
  // v8.6.0 spells/powers split: 'spells' is a MODE of the powers page —
  // same DOM, filtered to the arcane/divine side ('powers' = psionic/super).
  const navKey = n;
  if (n === 'spells') { _pwMode = 'spells'; n = 'powers'; }
  else if (n === 'powers') { _pwMode = 'powers'; }
  // v8.6.0 FIX (Adam's report): the Talent Catalog faux-page is shown via an
  // inline display:block (openTalentBrowser) that survives the class-based
  // page switch below — leaving the catalog pinned under every tab. Any
  // navigation now dismisses it. (Dismissed directly rather than via
  // closeTalentBrowser, which itself calls showPage('talents').)
  const _tb = document.getElementById('talent-browser');
  if (_tb && _tb.style.display === 'block') { _tb.style.display = 'none'; _tb.classList.remove('active'); }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+n).classList.add('active');
  // v8.6.0 FIX (latent since the nav reorder): the active button was picked
  // by index into a hardcoded OLD tab order — select by onclick attribute.
  document.querySelector(`.tab-btn[onclick="showPage('${navKey}')"]`)?.classList.add('active');
  if(n==='sheet')renderSheet();
  if(n==='skills'){renderSkills();_skMarkClean();}
  if(n==='feats')renderFeats();
  if(n==='gear')renderGear();
  if(n==='vehicles')renderVehicles();
  if(n==='powers')renderPowers();
  if(n==='mutations')renderMutations();
  if(n==='talents')renderTalents();
  if(n==='tracker')renderTracker();
  if(n==='roster')renderRoster();
}
function toggleDrill(id){const el=document.getElementById(id);el.classList.toggle('open')}

