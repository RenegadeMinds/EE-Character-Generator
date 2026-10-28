// =============================================================================
// js/ui/sheet/heros-gift.js
// SHEET / HEROS GIFT — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Sheet: the Hero's Gift panel.
//
// KEY NAMES (so you can search for them)
//   functions (3): renderHerosGiftPanel, assignHerosGiftAsFeat,
//   assignHerosGiftAsTalent
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

// v8.3.20: Sheet-page persistent condition banner. Rendered into
// 'sh-conditions-banner' (which lives just below sh-gm-exceptions). Lists each
// active condition with its brief gloss and tier-colored header. Players
// hopping between Tracker and Sheet see a continuous reminder of every
// condition currently in play.
//
// Forward-compatibility: terminal-tier conditions render with the stark
// inversion treatment regardless of the tier table's `stark` flag — it just
// happens to be set on the terminal tier. Any future tier with stark:true
// would render the same way.
// v8.4.0: Hero's Gift Sheet panel. Three display states:
//   1. Hidden — legacy character, non-Hero character, or no panel element
//   2. Unassigned — v8.4.0+ Hero-classed character with heroesGiftChoice null
//      Shows two assign buttons (Feat / Talent) + explanatory copy
//   3. Assigned — v8.4.0+ Hero-classed character with heroesGiftChoice set
//      Shows the current assignment + "use Edit to retcon" notice
//
// Purple aspirant tone (matching the Ordinary tier badge / ascension prompt)
// because Hero's Gift is part of the Hero class identity. The unassigned
// state is NOT presented as an error — per decision 4 of the plan, an
// unassigned slot is "latent potential" first-class state, not a violation
// to nag about.
function renderHerosGiftPanel(c){
  const el = document.getElementById('sh-heroes-gift');
  if (!el) return;
  // Hide for legacy / non-Hero
  if (isLegacyCharacter(c)) { el.style.display='none'; el.innerHTML=''; return; }
  const heroClassed = (c.classes||[]).some(e => e.tier === 'hero');
  if (!heroClassed) { el.style.display='none'; el.innerHTML=''; return; }
  el.style.display = 'block';
  const choice = c.heroesGiftChoice;
  if (choice === null || choice === undefined) {
    // Unassigned state — show the assignment buttons + latent-potential copy.
    el.innerHTML = `
      <div style="padding:9px 12px;background:rgba(196,153,212,.07);border:1px solid rgba(196,153,212,.30);border-radius:3px;border-left-width:3px;border-left-color:var(--vio);">
        <div class="font-serif fs-11 c-vio ls-0_05em uppercase mb-6">⬟ Hero's Gift — Unassigned</div>
        <div class="fs-12 c-g85 lh-1_5 mb-8">
          Your Hero's Gift slot is unassigned. When you're ready, choose how to spend it: a bonus <b>Feat</b> from your Hero class's feat list, or an extra <b>Talent</b> from your Hero class's talent trees. The choice is permanent (retconnable only via Edit, with a GM exception). You can leave it unassigned indefinitely — some GMs allow declaring the slot mid-session, at which point it's set in stone.
        </div>
        <div class="gap-8" style="display:flex;">
          <button type="button" class="c-vio btn btn-sm" onclick="assignHerosGiftAsFeat()" style="border-color:rgba(196,153,212,.50);">Assign as Feat</button>
          <button type="button" class="c-vio btn btn-sm" onclick="assignHerosGiftAsTalent()" style="border-color:rgba(196,153,212,.50);">Assign as Talent</button>
        </div>
      </div>`;
  } else {
    // v8.71.0 (Adam's grooming pass): the assigned-state panel retires — the
    // banner shouldn't linger once the Gift is spent. The honor moves to the
    // inventory of the chosen type: a ⬟ chip on the occupying feat (Feats
    // tab, via the herosGift slot ledger) or on the Sheet's Talents header.
    // The retcon copy rides those chips' pop-ups; the retcon panel itself
    // still lives in ✎ Edit.
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

// v8.4.0: assign Hero's Gift to a feat slot. Sets c.heroesGiftChoice='feat',
// adds a herosGift entry to c.firstLevelSlots so a future feat add can fill
// it, and re-renders everything that reads the budget.
async function assignHerosGiftAsFeat(){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (isLegacyCharacter(c)) return;
  if (c.heroesGiftChoice !== null && c.heroesGiftChoice !== undefined) return;  // already assigned
  if (!(await confirmModal("Assign your Hero's Gift slot as a Feat? This commits the slot — your feat budget gains +1. You can retcon this later via Edit, which will record a GM exception."))) return;
  c.heroesGiftChoice = 'feat';
  // Add the herosGift slot to firstLevelSlots if not already there. A v8.4.0
  // character's slots are populated at first save; herosGift is the one slot
  // that only gets added when the choice is made.
  if (!Array.isArray(c.firstLevelSlots)) c.firstLevelSlots = [];
  if (!c.firstLevelSlots.some(s => s.kind === 'herosGift')) {
    c.firstLevelSlots.push({kind:'herosGift', filled:null, filledParam:null});
  }
  save();
  renderSheet();
  // v9.19.0: the claim card lives on the Feats tab now — refresh it and the
  // nav dots so the claim's effect is visible where it was clicked.
  try { renderFeats(); } catch (e) {}
  renderNavTabs(c);
  toast("Hero's Gift assigned as Feat. +1 feat slot available.");
}

// v8.4.0: assign Hero's Gift to a talent slot. Sets c.heroesGiftChoice='talent'.
// No firstLevelSlots entry is added (talents don't use the L1 typed-slot model
// — they live in c.talents, and the talent budget just reads heroesGiftChoice
// directly via getTalentBudget).
async function assignHerosGiftAsTalent(){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (isLegacyCharacter(c)) return;
  if (c.heroesGiftChoice !== null && c.heroesGiftChoice !== undefined) return;  // already assigned
  if (!(await confirmModal("Assign your Hero's Gift slot as a Talent? This commits the slot — your talent budget gains +1. You can retcon this later via Edit, which will record a GM exception."))) return;
  c.heroesGiftChoice = 'talent';
  // No herosGift slot added — talents aren't in firstLevelSlots.
  save();
  renderSheet();
  try { renderFeats(); } catch (e) {}
  try { renderTalents(); } catch (e) {}
  renderNavTabs(c);
  toast("Hero's Gift assigned as Talent. +1 talent slot available.");
}
