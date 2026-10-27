// =============================================================================
// js/app/63-modals.js
// MODALS
// =============================================================================
//
// WHAT'S IN HERE
//   The generic confirm and choice dialogs that replace the browser's
//   confirm() and prompt().
//
// KEY NAMES (so you can search for them)
//   functions (12): confirmModal, resolveConfirmModal, openChoiceModal,
//   renderChoiceModalOptions, filterChoiceModal, confirmChoiceModal,
//   cancelChoiceModal, closeChoiceModal, promptForFeatParam,
//   promptForTalentParam, addFeatToChar, escapeHTML
//
// LOAD ORDER
//   File 63 of 68. index.html loads it after
//   js/app/62-power-suites-feats-page-proficiencies.js and before
//   js/app/64-tracker.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 52002-52394 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 52002-52394; unchanged below this line ----
// ============================================================================
// v8.5.2: Generic confirm modal — replaces window.confirm() (see the
// "CONFIRM MODAL" HTML comment for why). confirmModal(message, opts) returns
// a Promise<boolean>; callers become `if (!(await confirmModal(...))) return;`.
// ============================================================================
let _confirmModalResolve = null;

function confirmModal(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    _confirmModalResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = opts.title || 'Confirm';
    document.getElementById('confirm-modal-body').textContent = message;
    document.getElementById('confirm-modal-ok').textContent = opts.okLabel || 'Yes';
    document.getElementById('confirm-modal-cancel').textContent = opts.cancelLabel || 'No';
    document.getElementById('confirm-modal').classList.add('open');
    document.getElementById('confirm-modal-ok').focus();
  });
}

function resolveConfirmModal(value) {
  document.getElementById('confirm-modal').classList.remove('open');
  const r = _confirmModalResolve;
  _confirmModalResolve = null;
  if (r) r(value);
}

// ============================================================================
// v8.5.2: Generic choice modal — replaces window.prompt() as the parameter-
// selection UI for feats/talents (see the "CHOICE MODAL" comment on its HTML
// block for why). openChoiceModal(title, options, callback) is the only
// entry point callers need; cancelling never calls back (matches prompt()'s
// null-on-Cancel contract). Empty options[] switches to free-text mode.
// ============================================================================
let _choiceModalCb = null;
let _choiceModalAllOptions = [];
let _choiceModalFreeText = false;

function openChoiceModal(title, options, callback) {
  _choiceModalCb = callback;
  _choiceModalAllOptions = options || [];
  _choiceModalFreeText = _choiceModalAllOptions.length === 0;
  document.getElementById('choice-modal-title').textContent = title;
  const input = document.getElementById('choice-modal-input');
  const sel = document.getElementById('choice-modal-select');
  input.value = '';
  input.placeholder = _choiceModalFreeText ? 'Type a value…' : 'Type to filter…';
  sel.style.display = _choiceModalFreeText ? 'none' : '';
  renderChoiceModalOptions('');
  document.getElementById('choice-modal').classList.add('open');
  input.focus();
}

function renderChoiceModalOptions(filterText) {
  const sel = document.getElementById('choice-modal-select');
  const f = (filterText || '').toLowerCase();
  const filtered = f ? _choiceModalAllOptions.filter(o => o.toLowerCase().includes(f)) : _choiceModalAllOptions;
  sel.innerHTML = filtered.map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');
  if (filtered.length === 1) sel.value = filtered[0]; // sole match pre-selected, Enter confirms it
}

function filterChoiceModal() {
  if (_choiceModalFreeText) return;
  renderChoiceModalOptions(document.getElementById('choice-modal-input').value);
}

function confirmChoiceModal() {
  const cb = _choiceModalCb;
  let value;
  if (_choiceModalFreeText) {
    value = document.getElementById('choice-modal-input').value.trim();
  } else {
    const sel = document.getElementById('choice-modal-select');
    value = sel.value || (sel.options.length === 1 ? sel.options[0].value : '');
  }
  closeChoiceModal();
  if (value && cb) cb(value);
}

function cancelChoiceModal() { closeChoiceModal(); }

function closeChoiceModal() {
  document.getElementById('choice-modal').classList.remove('open');
  _choiceModalCb = null;
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

// Tiny HTML escape used in feat rendering
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}



