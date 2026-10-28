// =============================================================================
// js/core/state.js
// STATE — APP CORE
// =============================================================================
//
// WHAT'S IN HERE
//   App plumbing shared by every page. The roster in memory (chars), the
//   current character (curId, editId), safe access to the browser's saved
//   data, save(), the version number, and small helpers used everywhere
//   (attribute modifiers, ids, escapeHTML).
//
// KEY NAMES (so you can search for them)
//   tables and state: _storageOK, chars, TS13_VEHICLE_MOVES, curId, editId,
//   pbMode, CG_VERSION
//   functions (9): storeGet, storeSet, storageBannerCheck,
//   migrateTs13Vehicles, am, ms, save, genId, escapeHTML
//
// WHERE IT CAME FROM
//   Gathered from js/app/41-state-storage-navigation.js, js/app/42-player-
//   tools.js, js/app/63-modals.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded first. Declarations only: nothing here runs while the page loads
//   (the saved roster is restored by js/main.js).
// =============================================================================

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
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:600;background:rgb(var(--tint-maroon));color:rgb(var(--text-blush));padding:8px 14px;font-size:12.5px;line-height:1.4;text-align:center;border-top:2px solid rgb(var(--line-brick));font-family:sans-serif;';
    d.innerHTML = '⚠ <b>Saving is unavailable in this viewer.</b> The generator is running in demo mode — characters will NOT persist. For the full experience, download the file and open it directly in your browser, or use a hosted copy. <button onclick="this.parentElement.remove()" class="ml-8 fs-11">✕</button>';
    document.body.appendChild(d);
  } catch (e) {}
}
let chars = [];
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
let curId = null, editId = null, pbMode = false;
// The character currently open (Sheet, Gear, Tracker, ...): the one whose id
// is curId, or undefined if none. Use this instead of writing out
// chars.find(x => x.id === curId) each time.
function currentChar() { return chars.find(x => x.id === curId); }
// The character being edited on the Create page (editId), or undefined.
function editingChar() { return chars.find(x => x.id === editId); }

// ========== UTILS ==========
const am = s=>Math.floor((s-10)/2);
const ms = s=>{const m=am(s);return(m>=0?'+':'')+m};
const save = ()=>{
  // v8.55.3: storage-safe — a denied write surfaces the demo-mode banner
  // instead of throwing out of whatever flow called save().
  if (!storeSet('dxd20v2_chars', JSON.stringify(chars))) storageBannerCheck();
  // v8.58.0 Backup Guardian: count this change toward the freshness chip.
  try { backupNoteSave(); } catch (e) {}
  // v8.32.0: refresh the nav attention dots on every persist — budgets can
  // change from any page (spend a skill point, take a talent, pick a spell).
  try {
    const c = (curId) ? currentChar() : null;
    if (c) renderNavTabs(c);
  } catch (e) {}
};
const genId = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
// ============================================================================
// v9.16.0 (§276) + v9.17.0 (§277): THE PLAYERS' FOUR — Adam's Rogue Trader
// table, 2026-10-15.
// (1) UNSAVED-CHANGES GUARD. Explicit Save stays the contract (no silent
//     autosave, by decision); what changes is that leaving a page with
//     unsaved work asks first. Skills: the ranks on screen (plus any already
//     mirrored into memory by _snapshotSkillInputsToChar) vs the baseline
//     taken when the page was entered or last saved. Create: any player
//     input/change on the form since it was cleared, loaded or saved. A
//     capture-phase listener on the nav intercepts the tab click before its
//     inline showPage() runs; beforeunload covers closing/refreshing.
// (2) BUG REPORTS — mailto/copy + a local "My reports" log (no backend).
// (3) DISPLAY — Parchment / Classic / High Contrast + text size (prefs
//     applied in <head>; theme tokens in the first <style> :root block).
// ============================================================================
const CG_VERSION = 'v9.19.0';

// Tiny HTML escape used in feat rendering
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}



