// =============================================================================
// js/core/backup.js
// BACKUP — APP CORE
// =============================================================================
//
// WHAT'S IN HERE
//   App plumbing shared by every page. The Backup Guardian: counts changes
//   since the last roster export and shows the coloured backup chip on the
//   Roster page.
//
// KEY NAMES (so you can search for them)
//   functions (5): backupMeta, backupMetaSet, backupNoteSave,
//   backupNoteExport, renderBackupChip
//
// WHERE IT CAME FROM
//   Gathered from js/app/41-state-storage-navigation.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Loaded first. Declarations only: nothing here runs while the page loads
//   (the saved roster is restored by js/main.js).
// =============================================================================

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
    if (!chars.length) { if (chip) chip.style.display = 'none'; return; }
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
