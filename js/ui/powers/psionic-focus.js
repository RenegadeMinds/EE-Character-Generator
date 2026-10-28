// =============================================================================
// js/ui/powers/psionic-focus.js
// POWERS / PSIONIC FOCUS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gaining and expending psionic focus.
//
// KEY NAMES (so you can search for them)
//   functions (3): gainPsiFocus, expendPsiFocus, psiFocusChipHTML
//
// WHERE IT CAME FROM
//   Gathered from js/app/56-supernatural-attributes-pools-psi-focus.js when
//   the code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function gainPsiFocus() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin (HH p.241) — dismiss it first.'); return; }
  if (c.psiFocused) { toast('Already psionically focused.'); return; }
  const medit = (c.feats || []).some(f => f.name === 'Psionic Meditation');
  c.psiFocused = true;
  logActionEvent(c, 'psi-focus', 0, 'Focus gained', `Psionic focus gained (${medit ? 'move action — Psionic Meditation' : 'full-round action'}; Concentration DC 20, see the skill for taking the action defensively).`);
  save(); renderPPRecovery(c); renderPowers(); renderSheet();
  toast(`● Psionically focused (${medit ? 'move action' : 'full-round action'}, Concentration DC 20).`);
}
function expendPsiFocus(why) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin — it cannot be expended.'); return; }
  if (!c.psiFocused) { toast('Not currently focused — gaining focus is a full-round action (move with Psionic Meditation).'); return; }
  c.psiFocused = false;
  logActionEvent(c, 'psi-focus', 0, 'Focus expended', `Psionic focus expended${why ? ` — ${why}` : ''}.`);
  save(); renderPPRecovery(c); renderPowers(); renderSheet();
  toast('○ Focus expended.');
}
// The Tracker/Powers chip: state + gain/expend controls (Warmind Battle Focus
// at Psionic Scale 0 keeps its own separate panel — different feature).
function psiFocusChipHTML(c) {
  if (!isPsiFocusCapable(c)) return '';
  const locked = psiFocusLocked(c);
  const medit = (c.feats || []).some(f => f.name === 'Psionic Meditation');
  const state = locked
    ? `<b class="c-vio">🧿 locked</b> <span class="o-60 c-dim">(sustaining the Second Skin)</span>`
    : c.psiFocused
    ? `<b style="color:#6dba88;">● focused</b>`
    : `<b class="op-0_6">○ unfocused</b>`;
  const btn = locked ? '' : c.psiFocused
    ? `<button class="fs-10 p-0-6 btn btn-sm" onclick="expendPsiFocus('manual (declared at the table)')" title="Expend the focus (Power feats, Power Penetration, Slippery Mind, ki features...)">Expend</button>`
    : `<button class="fs-10 p-4-8 btn btn-sm" style="min-height:24px;" onclick="gainPsiFocus()" title="${medit ? 'Move action (Psionic Meditation)' : 'Full-round action'} — Concentration DC 20">Gain focus</button>`;
  return `<div class="fs-11_5 m-3-0 items-center gap-6" style="display:flex;"><span class="cursor-help" title="Psionic focus (HH p.354): a full-round action to gain (move action with Psionic Meditation), held until expended. While focused: Still Mind (+2 Will vs mind-affecting, Monk 3+), Speed of Thought (+10′ out of heavy armor), Up the Wall... Expending powers Power feats, Power Penetration, Slippery Mind, and the Monk's ki riders.">Psionic focus:</span> ${state} ${btn}</div>`;
}
