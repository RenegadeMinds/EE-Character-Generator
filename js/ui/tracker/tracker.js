// =============================================================================
// js/ui/tracker/tracker.js
// TRACKER / TRACKER — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Tracker page itself (renderTracker), which draws
//   all the tracker panels.
//
// KEY NAMES (so you can search for them)
//   functions (1): renderTracker
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js when the code was regrouped by topic
//   and page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== TRACKER ==========
function renderTracker(){
  const prompt=document.getElementById('tr-prompt'),cont=document.getElementById('tr-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=currentChar();if(!c){prompt.style.display='block';cont.style.display='none';return;}
  if(reconcileMissingHP(c)){save();toast(`HP auto-assigned (${c.maxHP} — average Hit Dice); GM may override via ⚙ HP Mode.`);}  // v8.6.0 C5
  prompt.style.display='none';cont.style.display='block';
  document.getElementById('tr-nm').textContent=c.name+' — Combat Tracker';
  renderHPBar(c);renderAPBar(c);renderPPRecovery(c);renderPerDiem(c);renderArmorIntegrity(c);renderXPBar(c);renderConds(c);renderTalentActions(c);renderCombatOptions(c);renderBardicMusic(c);renderElementalist(c);renderLog(c);
  // v8.3.27: action log panel renders alongside the free-text session journal.
  renderActionLog(c);
}
