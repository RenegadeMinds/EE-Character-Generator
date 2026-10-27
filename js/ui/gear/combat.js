// =============================================================================
// js/ui/gear/combat.js
// GEAR / COMBAT — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: combat declarations and melee options.
//
// KEY NAMES (so you can search for them)
//   functions (7): bdDeclAdjust, declWhichModal, baDeclAdjust,
//   weaponSpikeUse, toggleMeleeOpts, toggleNullified, toggleRecklessOffense
//
// WHERE IT CAME FROM
//   Gathered from js/rules/15-combat-declarations-and-melee.js,
//   js/rules/16-worn-and-active-gear.js when the code was regrouped by topic
//   and page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Free-action adjust, the baDeclAdjust idiom (single modifier — no modal).
function bdDeclAdjust(dir) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const cap = bestDefenseCap(c); if (cap <= 0) return;
  const d = combatDecl(c);
  if (dir > 0) {
    if (d.bd <= 0) { toast('No Defense Bonus is assigned to Best Defense.'); return; }
    d.bd -= 1;
  } else {
    if (d.bd >= cap) { toast(`Best Defense caps at your Survivor class Defense Bonus (+${cap}, HH p.137).`); return; }
    d.bd += 1;
  }
  c.combatDecl = Object.assign(c.combatDecl || {}, { bd: d.bd });
  logAct(`🛡→⚔ Best Defense declared: −${d.bd} Defense for +${d.bd} on melee attack rolls (free action to adjust; holds until re-declared).`);
  save(); renderSheet(); renderGear();
}
function declWhichModal(title, labels) {
  return new Promise(res => {
    openChoiceModal(title, labels, sel => res(sel === 'Power Attack' ? 'pa' : (sel === 'Combat Expertise' ? 'ce' : null)));
  });
}
async function baDeclAdjust(dir) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const hasPA = ownsFeatN(c, 'Power Attack'), hasCE = ownsFeatN(c, 'Combat Expertise');
  if (!hasPA && !hasCE) return;
  const d = combatDecl(c), caps = combatDeclCaps(c);
  if (dir > 0) {
    // return a point of Base Attack from a modifier
    if (d.pa + d.ce <= 0) { toast('All of your Base Attack is already unassigned.'); return; }
    let from = (d.pa > 0 && d.ce > 0) ? null : (d.pa > 0 ? 'pa' : 'ce');
    if (!from) from = await declWhichModal('Return a point of Base Attack from which modifier?', ['Power Attack', 'Combat Expertise']);
    if (!from) return;
    if (from === 'pa' && d.pa > 0) d.pa -= 1;
    else if (from === 'ce' && d.ce > 0) d.ce -= 1;
    else { toast('Nothing assigned to that modifier.'); return; }
  } else {
    // v9.12.1 (§270): the stances are attack-roll penalties, not spends —
    // there is no shared Base Attack pool. Each caps on its own feat text:
    // PA ≤ Base Attack; CE ≤ min(5, Base Attack). Both may run at once.
    const paOpen = hasPA && d.pa < caps.bab;
    const ceOpen = hasCE && d.ce < caps.ceMax;
    if (!paOpen && !ceOpen) { toast('Both stances are at their caps (PA ≤ Base Attack; CE ≤ +5 or Base Attack).'); return; }
    let to = (paOpen && ceOpen) ? null : (paOpen ? 'pa' : 'ce');
    if (to === null) to = await declWhichModal('Declare the point of penalty on which stance?', ['Power Attack', 'Combat Expertise']);
    if (!to) return;
    if (to === 'ce' && !ceOpen) { toast('Combat Expertise caps at +5 or your Base Attack, whichever is less (HH p.207).'); return; }
    if (to === 'pa' && !paOpen) { toast(hasPA ? 'Power Attack caps at your Base Attack (HH p.235).' : 'You don’t have the Power Attack feat.'); return; }
    if (to === 'pa') d.pa += 1; else d.ce += 1;
  }
  c.combatDecl = d;
  logAct(`⚔ Stance declared: −${d.pa + d.ce} on melee attack rolls (Power Attack ${d.pa} → +${d.pa} melee damage · Combat Expertise ${d.ce} → +${d.ce} Defense Bonus). Base Attack untouched — printed iteratives stand. Holds until re-declared.`);
  // v9.17.0 (bug report #1, the Xander case): a declared stance moves MELEE
  // attack lines only — a player whose equipped weapon is ranged watches the
  // pistol's numbers, sees nothing change, and reports a bug. Say where to look.
  if ((d.pa + d.ce) > 0) {
    const _melee = (c.items || []).some(it => {
      if (it.catalogue !== 'weapon' || !it.equipped) return false;
      const wd = getCatalogueEntry('weapon', it.ref);
      return wd && !isRangedWeapon(wd);
    });
    if (!_melee) toast('⚔ Stance declared — the penalty applies to MELEE attack rolls only. No melee weapon equipped: see the Unarmed strike row (⚒ Gear) for the live numbers.');
  }
  save(); renderSheet();
}
async function weaponSpikeUse(feat, dice, path) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (path === 'held') {
    if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin.'); return; }
    if (!c.psiFocused) { toast('○ Not psionically focused — gain focus first.'); return; }
    c.psiFocused = false;
    logActionEvent(c, 'psi-focus', 0, 'Focus expended', `${feat}: +${dice} damage on this attack — declared before the roll; spent even on a miss.`);
  } else if (path === 'momentary') {
    if (!(await confirmModal(`${feat} via momentary Super-Power focus:\n\nThis costs your MOVE ACTION this round — the momentary focus lasts only until your very next action, which must be this attack (HH p.354).\n\nThe +${dice} rides that single attack and is spent even on a miss. Declare it?`))) return;
    logActionEvent(c, 'psi-focus', 0, 'Momentary focus', `Move action: momentary Super-Power focus — ${feat} +${dice} on this attack (spent even on a miss).`);
  } else return;
  toast(`⚡ ${feat}: +${dice} damage on this one attack — spent even on a miss.`);
  save();
  renderGear();
}
function toggleMeleeOpts() {
  storeSet('dxd20v2_ui_meleeOpts', meleeOptsOn() ? '0' : '1');
  renderGear();
}

// v8.8.0 (Adam): toggle the Null Power Field state.
function toggleNullified() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.nullified = !c.nullified;
  logAct(c.nullified ? '⊘ NULLIFIED — all Supernatural modifiers suppressed (Null Power Field).' : '✦ Nullification lifted — Supernatural modifiers restored.');
  save(); renderSheet(); renderGear(); renderSkills();
  try { if (document.getElementById('tr-nullify')) renderConds(c); } catch (e) {}  // v8.60.2: refresh the Tracker toggle
  toast(c.nullified ? '⊘ Supernatural modifiers suppressed.' : '✦ Supernatural modifiers restored.');
}

// v8.63.0 (Adam's ruling): toggle the Reckless Offense declared stance.
// Attack ROLLS only — Base Attack and the iterative ladder are expressly
// untouched ("in the strictest of terms it doesn't touch BA, so it
// shouldn't suffer the attendant trickle-down effects"). v8.63.1 redirect:
// Grapple rides the +2 — a grapple check is like a melee attack roll, and
// starting one requires a successful melee attack roll (HH grapple rules).
function toggleRecklessOffense() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!ownsFeatN(c, 'Reckless Offense')) { toast('Reckless Offense requires the feat.'); return; }
  if (!c.combatDecl) c.combatDecl = {};
  c.combatDecl.ro = !c.combatDecl.ro;
  logAct(c.combatDecl.ro
    ? '⚡ RECKLESS OFFENSE declared — +2 on melee attack rolls (Grapple included), −4 AC (HH p.239). Base Attack and the iterative ladder untouched. Holds until re-declared.'
    : '⚔ Reckless Offense withdrawn — the stance ends; AC and melee attack rolls return to normal.');
  save(); renderSheet(); renderGear();
  try { if (document.getElementById('tr-reckless')) renderConds(c); } catch (e) {}
  toast(c.combatDecl.ro ? '⚡ Reckless Offense: +2 melee attacks / −4 AC.' : '⚔ Reckless Offense withdrawn.');
}

