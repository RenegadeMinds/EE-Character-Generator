// =============================================================================
// js/ui/roster.js
// ROSTER — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Roster page, and roster export and import (the
//   players' backup files).
//
// KEY NAMES (so you can search for them)
//   functions (7): reconcileOrphanSubOptions, exportRoster,
//   exportRosterDownload, exportCurrentHero, importRosterFile, renderRoster,
//   selChar
//
// WHERE IT CAME FROM
//   Gathered from js/app/48-roster-and-export.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  backupNoteExport();
  toast(`⬇ Exported ${chars.length} hero${chars.length === 1 ? '' : 'es'} — the file imports on any browser's roster.`);
}
function exportCurrentHero() {
  const c = currentChar();
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
  renderBackupChip();  // v8.58.0
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
        <div class="fs-11 c-g45 text-center mt-3">${c.currentHP}/${c.maxHP} HP</div>
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

