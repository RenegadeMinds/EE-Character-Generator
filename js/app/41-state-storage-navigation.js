// =============================================================================
// js/app/41-state-storage-navigation.js
// STATE STORAGE NAVIGATION
// =============================================================================
//
// WHAT'S IN HERE
//   App state and saving: safe localStorage access, the Backup Guardian (the
//   backup chip and its freshness colours), loading the roster (chars), the
//   create-form state, the small utilities (attribute modifiers, save(),
//   toast) and showPage(), which switches tabs.
//
// KEY NAMES (so you can search for them)
//   tables/objects: TS13_VEHICLE_MOVES
//   functions (13): storeGet, storeSet, storageBannerCheck, backupMeta,
//   backupMetaSet, backupNoteSave, backupNoteExport, renderBackupChip,
//   migrateTs13Vehicles, toast, toastAction, showPage, toggleDrill
//
// LOAD ORDER
//   File 41 of 68. index.html loads it after
//   js/rules/40-occupations-and-weapon-list.js and before
//   js/app/42-player-tools.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 37193-37421 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 37193-37421; unchanged below this line ----
// ========== STATE ==========
// v8.55.3 (Adam's Pixel 9 field report): STORAGE-SAFE BOOT. In sandboxed
// viewing contexts — Google Drive's HTML preview, sandboxed iframes, some
// file:// configurations — merely ACCESSING localStorage throws a
// SecurityError. The old naked boot line died here, taking every function
// definition after it to the grave: the page rendered, buttons animated
// (CSS survives), and nothing worked. Now storage denial degrades to an
// honest in-memory demo mode with a visible banner, instead of a silent
// corpse. (Note: Drive's preview ALSO blocks scripts outright — no code can
// survive that; the answer there is distribution guidance, not armor.)
let _storageOK = true;
function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { _storageOK = false; return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { _storageOK = false; return false; } }
function storageBannerCheck() {
  if (_storageOK) return;
  try {
    if (document.getElementById('storage-warn')) return;
    const d = document.createElement('div');
    d.id = 'storage-warn';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:600;background:#4a1a1a;color:#f0c8c8;padding:8px 14px;font-size:12.5px;line-height:1.4;text-align:center;border-top:2px solid #a05050;font-family:sans-serif;';
    d.innerHTML = '⚠ <b>Saving is unavailable in this viewer.</b> The generator is running in demo mode — characters will NOT persist. For the full experience, download the file and open it directly in your browser, or use a hosted copy. <button onclick="this.parentElement.remove()" style="margin-left:8px;font-size:11px;">✕</button>';
    document.body.appendChild(d);
  } catch (e) {}
}

// ============================================================================
// v8.58.0 BACKUP GUARDIAN (Adam, 2026-09-30). Characters live in THIS
// browser's storage on THIS device — the exported courier file is the only
// true backup. Four prongs: (a) navigator.storage.persist() asks the browser
// to shield the vault from AUTOMATIC eviction (iOS Safari's 7-day reaper,
// storage-pressure cleanup — it cannot stop a deliberate clear-site-data);
// (b) a header freshness chip tracks saves since the last export and ages
// green→amber→red, one click exports; (c) exportRoster offers the phone's
// native share sheet (message the file to yourself or the GM) — gated on
// coarse-pointer devices so desktop keeps the classic download; (d) doctrine
// copy on the Roster page and in the hosted README.
function backupMeta() {
  try { const m = JSON.parse(storeGet('dxd20v2_backup_meta') || '{}') || {}; return { lastExport: m.lastExport || 0, savesSince: m.savesSince || 0 }; }
  catch (e) { return { lastExport: 0, savesSince: 0 }; }
}
function backupMetaSet(m) { storeSet('dxd20v2_backup_meta', JSON.stringify(m)); }
function backupNoteSave() {
  const m = backupMeta(); m.savesSince = (m.savesSince || 0) + 1; backupMetaSet(m);
  renderBackupChip();
}
function backupNoteExport() {
  backupMetaSet({ lastExport: Date.now(), savesSince: 0 });
  renderBackupChip();
}
function renderBackupChip() {
  try {
    let chip = document.getElementById('backup-chip');
    if (typeof chars === 'undefined' || !chars.length) { if (chip) chip.style.display = 'none'; return; }
    const m = backupMeta();
    const days = m.lastExport ? (Date.now() - m.lastExport) / 86400000 : Infinity;
    const never = !m.lastExport;
    // Freshness bands: red = 14+ days, 25+ unsaved-to-file saves, or never
    // exported despite real use; amber = 7+ days, 10+ saves, or any
    // never-exported roster; green otherwise.
    const red = (never && m.savesSince >= 5) || days >= 14 || m.savesSince >= 25;
    const amber = never || days >= 7 || m.savesSince >= 10;
    const col = red ? ['#4a1a1a', '#e0a0a0', '#a05050'] : amber ? ['#4a3a12', '#e8d49a', '#a08a40'] : ['#1d3320', '#a8d4ae', '#4a7a52'];
    const label = never ? 'no backup file yet' : days < 1 ? 'backed up today' : `backed up ${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'} ago`;
    if (!chip) {
      // v8.58.2 (Adam's final placement): the chip rides INLINE at the end of
      // the "Character Roster" heading itself — the title never changes, so
      // it hosts the live element safely, and a status light about the roster
      // belongs in the roster's own title line. renderRoster() re-renders it
      // on every visit.
      const head = document.querySelector('#page-roster .sec-head');
      if (!head) return;
      chip = document.createElement('button');
      chip.id = 'backup-chip';
      chip.onclick = () => exportRoster();
      head.appendChild(chip);
    }
    chip.style.cssText = `display:inline-block;vertical-align:middle;margin-left:12px;font-size:10.5px;text-transform:none;letter-spacing:.06em;padding:2px 10px;border-radius:10px;cursor:pointer;background:${col[0]};color:${col[1]};border:1px solid ${col[2]};font-family:sans-serif;font-weight:normal;`;
    chip.title = `Your heroes live in THIS browser on THIS device — clearing cookies/site data deletes them; the exported file is the true backup. ${m.savesSince} change${m.savesSince === 1 ? '' : 's'} since the last export. Click to export the roster now.`;
    chip.textContent = `💾 ${label}${m.savesSince ? ` · ${m.savesSince} change${m.savesSince === 1 ? '' : 's'} since` : ''}`;
    chip.style.display = 'inline-block';
  } catch (e) {}
}
// Prong (a): one polite, silent request to shield the vault from automatic
// eviction. Browsers that don't support it ignore it; no UI either way.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
let chars = [];
try { chars = JSON.parse(storeGet('dxd20v2_chars') || '[]'); } catch (e) { chars = []; }
if (!Array.isArray(chars)) chars = [];
// v9.5.0: the TS1–3 conveyances left the equipment list for the Vehicles
// catalogue (scaled hull statistics). Move any owned copies across.
const TS13_VEHICLE_MOVES = ["Rowboat", "Keelboat", "Longship", "Sailing ship", "Warship", "Galley", "Cart", "Carriage", "Wagon", "Sled"];
function migrateTs13Vehicles(c) {
  (c && Array.isArray(c.items) ? c.items : []).forEach(it => {
    if (it && it.catalogue === 'equipment' && TS13_VEHICLE_MOVES.includes(it.ref)) {
      it.catalogue = 'vehicle'; it.slot = 'carried'; it.equipped = false; delete it.qty; delete it.active;
    }
  });
  return c;
}
chars.forEach(migrateTs13Vehicles);
storageBannerCheck();
let curId = null, editId = null, pbMode = false;

// ========== ATTRIBUTE BUDGET TRACKING (v8.1.1) ==========
// formBudget holds the player's chosen attribute-generation budget for the
// character being created/edited. baseTotal is the sum of base (pre-racial)
// scores produced by the chosen method (always 80 for Quickdraw, 80 for
// 20-point buy [60 base + 20 spent], and variable for 4d6 roll).
//   method:  'quickdraw' | 'pointbuy' | 'roll' | 'manual' | null
//   baseTotal: integer (the target/budget to compare against)
//   racialApplied: race name whose adj is currently baked into the displayed scores
let formBudget = { method: null, baseTotal: null, racialApplied: '' };

// ========== SIX SCALES EDIT-STATE TRACKING (v8.2.1) ==========
// When the create/edit form is opened to edit an EXISTING saved character,
// editSavedSixLevels snapshots the saved Six Scales values so onSixLevelChange()
// can detect actual divergence. pendingSixLevelChange holds the axis + old/new
// values for the confirm/cancel handlers to act on.
//
// During NEW character creation (editId === null), Six Scales changes are
// routine and don't fire the confirmation modal — the player is still
// establishing their character's scenario context.
let editSavedSixLevels = null;
let pendingSixLevelChange = null; // {axis, oldVal, newVal, sliderEl}

// ========== HP MODE FORM STATE (v8.2.3 Issue A) ==========
// formHpMode tracks the HP-generation mode chosen on the create form.
// formHpRolls is the working per-level rolls array. Both are committed to
// the character record on save.
//
// Default mode is 'hero' (Hero's Hit Die — house convention per HH p.84-ish
// and the parentheticals in every class entry).
let formHpMode = 'hero';
let formHpRolls = [];

// ========== ATTRIBUTE BUMPS FORM STATE (v8.2.3 Issue B) ==========
// HH p.879: at every 4th character level, +1 to one attribute of player's
// choice. formAttrBumps stores the working list. Each entry is the attribute
// name ('STR', 'DEX', etc.) for the bump at level (idx+1)*4. Empty string
// means "not yet assigned".
//
// Bumps are kept separate from c.attrs and applied at display time so the
// attribute-generation budget tracker (4d6 / point buy / quickdraw) stays
// clean — the bumps don't count toward the budget.
let formAttrBumps = [];

// ========== UTILS ==========
const am = s=>Math.floor((s-10)/2);
const ms = s=>{const m=am(s);return(m>=0?'+':'')+m};
const save = ()=>{
  // v8.55.3: storage-safe — a denied write surfaces the demo-mode banner
  // instead of throwing out of whatever flow called save().
  if (!storeSet('dxd20v2_chars', JSON.stringify(chars))) storageBannerCheck();
  // v8.58.0 Backup Guardian: count this change toward the freshness chip.
  try { if (typeof backupNoteSave === 'function') backupNoteSave(); } catch (e) {}
  // v8.32.0: refresh the nav attention dots on every persist — budgets can
  // change from any page (spend a skill point, take a talent, pick a spell).
  try {
    const c = (typeof curId !== 'undefined' && curId) ? chars.find(x => x.id === curId) : null;
    if (c && typeof renderNavTabs === 'function') renderNavTabs(c);
  } catch (e) {}
};
const genId = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
// v8.52.0 (Session Zero polish): action toast — a toast carrying one button.
// Used for the post-level-up deep link ("Open Skills →"). Longer dwell than
// the plain toast because the player is being offered a choice, not told a
// fact. The handler is stashed on window so the inline onclick can reach it.
function toastAction(msg, btnLabel, fn){
  const t = document.getElementById('toast');
  window._toastActionFn = () => { try { fn(); } catch(e){} t.classList.remove('show'); };
  t.innerHTML = `${escapeHTML(msg)} <button class="btn btn-sm" onclick="window._toastActionFn()" style="margin-left:8px;font-size:11px;padding:2px 9px;border-color:var(--gold);color:var(--gold);">${escapeHTML(btnLabel)}</button>`;
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

