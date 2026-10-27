// =============================================================================
// js/app/48-roster-and-export.js
// ROSTER AND EXPORT
// =============================================================================
//
// WHAT'S IN HERE
//   The Roster page, and roster export/import (the 'courier' files that are
//   the players' only real backup).
//
// KEY NAMES (so you can search for them)
//   functions (8): reconcileHerosGiftFold, reconcileOrphanSubOptions,
//   exportRoster, exportRosterDownload, exportCurrentHero, importRosterFile,
//   renderRoster, selChar
//
// LOAD ORDER
//   File 48 of 68. index.html loads it after js/app/47-save-character.js and
//   before js/app/49-sheet.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 41271-41449 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 41271-41449; unchanged below this line ----
// ========== ROSTER ==========
// v8.30.1 (Adam's Heinrix report): strip class sub-option fields whose owning
// class has no levels on the record — the backtracked-class-pick bug stamped
// orphaned Saint domains onto a Charismatic Hero at creation (fixed at the
// source in saveCharacter the same version; this heals records saved before
// the fix). Idempotent; returns true when it changed anything. NOTE: none of
// these fields are legitimately class-less — the Heritage feats deliberately
// grant BASE lists only (ruled + ratified 2026-09-23), and the Druid-variant
// Heritage pick rides the contributor's _heritageChoice, not c.druidOption.
// v9.19.0 (old-boys report #3 — the lingering Hero's Gift dot): when a
// Hero-classed character's gift is unassigned but their feat books are OVER
// the slotted budget, a conforming owned feat IS the gift in all but name —
// recognize it (Adam's ruling: "assuming the selected feats conform to the
// limitations... be considered as having effectively been selected").
// Conformity = any FEATS_DB feat that isn't class/mutation-granted, isn't
// occupation-locked, and isn't already accounted to another L1 slot (the
// herosGift slot is Heritage-ELIGIBLE, i.e. accepts any non-occupation
// feat — slotAcceptsFeat). Folds at most ONCE per record (c.hgFoldDone),
// so a later deliberate retcon to Unassigned is never fought. When the
// books are EXACTLY balanced the gift is a genuinely unclaimed bonus pick —
// no fold; the Feats tab's claim card (same version) walks the player to it.
function reconcileHerosGiftFold(c){
  if (!c || isLegacyCharacter(c) || c.hgFoldDone) return false;
  if (c.heroesGiftChoice !== null && c.heroesGiftChoice !== undefined) return false;
  if (!(c.classes || []).some(e => e.tier === 'hero')) return false;
  let fb; try { fb = getFeatBudget(c); } catch (e) { return false; }
  if (!fb || (fb.picked || 0) <= (fb.total || 0)) return false;
  const slotFilled = new Set((c.firstLevelSlots || []).map(s => s.filled).filter(Boolean));
  const cand = (c.feats || []).find(f => {
    const nm = f.name || f.n; if (!nm) return false;
    if (f.grantedBy || (f.origin && /^occupation:/.test(f.origin))) return false;
    if (slotFilled.has(nm)) return false;
    return !!getFeatData(nm);
  });
  if (!cand) return false;
  c.heroesGiftChoice = 'feat';
  c.hgFoldDone = true;
  if (!Array.isArray(c.firstLevelSlots)) c.firstLevelSlots = [];
  if (!c.firstLevelSlots.some(s => s.kind === 'herosGift')) c.firstLevelSlots.push({kind:'herosGift', filled:null, filledParam:null});
  const slot = c.firstLevelSlots.find(s => s.kind === 'herosGift');
  if (slot && slot.filled === null) { slot.filled = cand.name || cand.n; slot.filledParam = cand.param || null; }
  if (typeof logAct === 'function' && c.id === curId) logAct(`🎁 Hero's Gift recognized: ${cand.name || cand.n} counts as the Hero's Gift feat — the books balance.`);
  return true;
}
function reconcileOrphanSubOptions(c){
  if(!c) return false;
  const owned = new Set(migrateLegacyClasses(c).filter(e => (e.level||0) > 0).map(e => e.name));
  const OWNERS = [
    ['clericDomains','Cleric'], ['druidOption','Cleric'],
    ['saintDomains','Saint'], ['paladinDomains','Paladin'],
    ['rangerSecrets','Ranger'], ['bardStoryteller','Bard'],
    ['psionDiscipline','Psion'], ['wizardSchool','Wizard'], ['wizardProhibited','Wizard'],
  ];
  let changed = false;
  for(const [field, cls] of OWNERS){
    const v = c[field];
    const present = Array.isArray(v) ? v.length > 0 : !!v;
    if(present && !owned.has(cls)){ delete c[field]; changed = true; }
  }
  return changed;
}
// ============================================================================
// v8.51.1: ROSTER EXPORT / IMPORT — the courier (Xander build finding #5,
// prioritized ahead of the retinue builds so the whole command staff ships
// as one file). Export = the roster array as pretty JSON, plus a per-hero
// export from the Sheet. Import ADDS (never overwrites): accepts a single
// character object or an array; ID collisions receive fresh IDs; anything
// without a name and a classes/heroClass shape is refused by file.
function exportRoster() {
  if (!chars.length) { toast('Roster is empty — nothing to export.'); return; }
  const json = JSON.stringify(chars, null, 1);
  // v8.70.0 (the long-earmarked micro-fix): LOCAL date, not UTC —
  // toISOString stamped evening exports with tomorrow's date.
  const _d = new Date();
  const fname = 'EE_Roster_' + _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0') + '.json';
  // v8.58.0 Backup Guardian (c): coarse-pointer devices (phones/tablets) get
  // the native share sheet — message the roster to yourself or the GM in one
  // gesture (the sheet includes save-to-files options too). Desktop keeps
  // the classic download. A cancelled sheet earns NO backup credit; a share
  // failure that isn't a cancel falls back to the download.
  try {
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (coarse && navigator.canShare && typeof File === 'function') {
      const f = new File([json], fname, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: 'E&E Roster' }).then(() => {
          backupNoteExport();
          toast(`📤 Shared ${chars.length} hero${chars.length === 1 ? '' : 'es'} — the file imports on any browser's roster.`);
        }).catch((err) => {
          if (err && err.name === 'AbortError') return;
          exportRosterDownload(json, fname);
        });
        return;
      }
    }
  } catch (e) {}
  exportRosterDownload(json, fname);
}
function exportRosterDownload(json, fname) {
  const blob = new Blob([json], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  if (typeof backupNoteExport === 'function') backupNoteExport();
  toast(`⬇ Exported ${chars.length} hero${chars.length === 1 ? '' : 'es'} — the file imports on any browser's roster.`);
}
function exportCurrentHero() {
  const c = chars.find(x => x.id === curId);
  if (!c) { toast('No hero selected.'); return; }
  const blob = new Blob([JSON.stringify(c, null, 1)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (c.name || 'hero').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`⬇ Exported ${c.name}.`);
}
function importRosterFile(inp) {
  const file = inp.files && inp.files[0];
  inp.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      // v9.15.0 §273: a GMF creature seed takes the Monstrous Heritage lane.
      if (data && typeof data === 'object' && !Array.isArray(data) && data.seed === 'ee-creature') { importCreatureSeed(data); return; }
      const list = Array.isArray(data) ? data : [data];
      const valid = list.filter(x => x && typeof x === 'object' && x.name && (Array.isArray(x.classes) || x.heroClass !== undefined));
      if (!valid.length) { toast('⬆ Import refused: no recognizable E&E characters in that file.'); return; }
      let added = 0, renamedIds = 0;
      for (const x of valid) {
        if (!x.id || chars.some(c => c.id === x.id)) { x.id = 'imp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); renamedIds++; }
        chars.push(x); added++;
      }
      save(); renderRoster();
      toast(`⬆ Imported ${added} hero${added === 1 ? '' : 'es'}${renamedIds ? ` (${renamedIds} got fresh IDs)` : ''}${valid.length < list.length ? ` — ${list.length - valid.length} entr${list.length - valid.length === 1 ? 'y' : 'ies'} skipped as unrecognizable` : ''}.`);
    } catch (e) { toast('⬆ Import failed: ' + e.message); }
  };
  reader.readAsText(file);
}
function renderRoster(){
  if (typeof renderBackupChip === 'function') renderBackupChip();  // v8.58.0
  const el=document.getElementById('roster-list');
  if(!chars.length){el.innerHTML=`<div class="empty"><div class="empty-ico">⚔</div><div class="empty-txt">No heroes yet — forge your first character</div></div>`;return;}
  // v8.6.0 C5: self-heal any record with missing HP before rendering.
  let healed=false; for(const c of chars) if(reconcileMissingHP(c)) healed=true;
  // v8.30.1: also strip orphaned class sub-options (Heinrix pattern — a
  // backtracked class pick left its domains on the saved record).
  for(const c of chars) if(reconcileOrphanSubOptions(c)) healed=true;
  // v9.19.0 (old-boys #3): fold an over-budget conforming feat into an
  // unassigned Hero's Gift — see reconcileHerosGiftFold.
  for(const c of chars) if(reconcileHerosGiftFold(c)) healed=true;
  if(healed) save();
  el.innerHTML=`<ul class="char-list">${chars.map(c=>{
    const arr=migrateLegacyClasses(c);
    const classSummary=arr.length?arr.map(e=>e.name).join('/'):'No class';
    return`<li class="char-item ${c.id===curId?'sel':''}" onclick="selChar('${c.id}')">
      <div class="char-av">${c.name.slice(0,2).toUpperCase()}</div>
      <div class="char-info">
        <div class="char-nm">${c.name}</div>
        <div class="char-meta">${c.race} · ${classSummary} · ${c.align||''}</div>
      </div>
      <div>
        <div class="char-badge">Level ${c.totalLvl}${c.ecl!==c.totalLvl?` / ECL ${c.ecl}`:''}</div>
        <div style="font-size:11px;color:var(--g45);text-align:center;margin-top:3px;">${c.currentHP}/${c.maxHP} HP</div>
      </div>
    </li>`;
  }).join('')}</ul>`;
}
function selChar(id){
  curId=id;
  renderRoster();
  // v8.3.21: update nav-tab visibility for the newly-selected character.
  const c = chars.find(x => x.id === id);
  renderNavTabs(c);
  showPage('sheet');
}

