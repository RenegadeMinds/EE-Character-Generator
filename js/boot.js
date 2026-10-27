// =============================================================================
// js/boot.js
// BOOT: RUNS IN <head>, BEFORE THE PAGE IS DRAWN
// =============================================================================
//
// WHAT'S IN HERE
//   (1) A small ring buffer that records the last few errors (window errors,
//   unhandled promise rejections, console.error) so the Report-a-bug dialog
//   can attach them. (2) The Display preferences (colour theme and text size),
//   applied before the first paint so a High Contrast player never sees a
//   flash of the default theme.
//
// LOAD ORDER
//   Loaded by a plain <script src> tag in <head>, so it runs before the page
//   body exists and before every other js/ file. It must stay in <head> and
//   must not be marked defer or async; either would let the page paint first.
//
// WHERE IT CAME FROM
//   Lines 8-58 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py.
//
// ---- verbatim from index.html v9.19.0, lines 8-58; unchanged below this line ----
// v9.16.0 (§276) / v9.17.0 (§277): boot-time capture + display prefs, ahead
// of everything else.
// (1) A small ring buffer of recent errors for the 🐞 Report dialog — window
//     errors, unhandled promise rejections, and console.error calls.
// (2) The ⚙ Display preferences (theme + text size) applied before first
//     paint so a High Contrast player never sees a low-contrast flash.
//     Themes: parchment (default) / classic (v9.15.2 original colours) / hc.
//     No explicit choice → High Contrast if the device asks for more
//     contrast, else Parchment; an explicit choice always wins.
window._cgErrRing = [];
window._cgPushErr = function (s) {
  try {
    window._cgErrRing.push('[' + new Date().toISOString().slice(11, 19) + '] ' + String(s).slice(0, 300));
    if (window._cgErrRing.length > 10) window._cgErrRing.shift();
  } catch (e) {}
};
window.addEventListener('error', function (e) {
  window._cgPushErr((e.message || 'error') + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno + ':' + e.colno : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  window._cgPushErr('unhandled rejection: ' + (r && (r.stack || r.message) || r));
});
(function () {
  var orig = console.error;
  console.error = function () {
    try { window._cgPushErr('console.error: ' + Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack : (typeof a === 'object' ? JSON.stringify(a) : String(a)); }).join(' ')); } catch (e) {}
    return orig.apply(console, arguments);
  };
})();
window.readDisplayPrefs = function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem('dxd20v2_display') || '{}') || {}; } catch (e) {}
  // v9.16.0 stored 'standard'/'auto' — 'standard' was the AA palette (= Parchment).
  if (p.theme === 'standard') p.theme = 'parchment';
  if (p.theme !== 'parchment' && p.theme !== 'classic' && p.theme !== 'hc') delete p.theme;
  return p;
};
window.applyDisplayPrefs = function () {
  var p = window.readDisplayPrefs();
  var wantsMore = false;
  try { wantsMore = window.matchMedia('(prefers-contrast: more)').matches; } catch (e) {}
  var theme = p.theme || (wantsMore ? 'hc' : 'parchment');
  if (theme === 'parchment') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  if (p.textsize === 'lg' || p.textsize === 'xl') document.documentElement.setAttribute('data-textsize', p.textsize);
  else document.documentElement.removeAttribute('data-textsize');
  return { theme: theme, explicit: !!p.theme, textsize: p.textsize || 'md' };
};
window.applyDisplayPrefs();
try { window.matchMedia('(prefers-contrast: more)').addEventListener('change', window.applyDisplayPrefs); } catch (e) {}
