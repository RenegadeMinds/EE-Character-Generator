// =============================================================================
// js/ui/player-tools/display-settings.js
// PLAYER TOOLS / DISPLAY SETTINGS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The ⚙ Display dialog: colour theme and text size.
//
// KEY NAMES (so you can search for them)
//   functions (4): _renderDisplayMenu, openDisplaySettings,
//   closeDisplaySettings, setDisplayPref
//
// WHERE IT CAME FROM
//   Gathered from js/app/42-player-tools.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ---------- (3) display settings ----------
function _renderDisplayMenu() {
  const s = window.applyDisplayPrefs();
  const sz = s.textsize;
  document.querySelectorAll('input[name="disp-theme"]').forEach(i => { i.checked = i.value === s.theme; });
  document.querySelectorAll('input[name="disp-size"]').forEach(i => { i.checked = i.value === sz; });
  const note = document.getElementById('disp-theme-note');
  if (note) note.textContent = s.explicit
    ? 'Your choice is saved in this browser and overrides your device\'s contrast setting.'
    : (s.theme === 'hc' ? 'High Contrast is on because your device asks for more contrast. Pick a theme to override it.'
                        : 'Default. High Contrast turns on by itself if your device asks for more contrast, unless you pick a theme here.');
}
function openDisplaySettings() {
  _renderDisplayMenu();
  document.getElementById('display-modal').classList.add('open');
  document.querySelector('input[name="disp-theme"]:checked')?.focus();
}
function closeDisplaySettings() { document.getElementById('display-modal').classList.remove('open'); }
function setDisplayPref(key, val) {
  const p = window.readDisplayPrefs(); p[key] = val;
  try { localStorage.setItem('dxd20v2_display', JSON.stringify(p)); } catch (e) {}
  const s = window.applyDisplayPrefs();
  if (document.getElementById('display-modal')?.classList.contains('open')) _renderDisplayMenu();
  if (key === 'theme') toast(s.theme === 'hc' ? 'High Contrast theme.' : s.theme === 'classic' ? 'Classic theme (original colours).' : 'Parchment theme.');
}

