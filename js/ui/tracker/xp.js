// =============================================================================
// js/ui/tracker/xp.js
// TRACKER / XP — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: XP, awarding it and spending it.
//
// KEY NAMES (so you can search for them)
//   functions (3): renderXPBar, awardXP, spendXP
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/app/65-tracker-logs-and-
//   damage.js, js/app/66-xp-spending-and-level-up.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function renderXPBar(c){
  // v8.20.0: self-heal the Techsmith Mastercraft XP Reserve on render (the
  // ECL-bug lesson: stored derived state reconciles wherever it's displayed).
  reconcileMcReserve(c);
  // v8.3.1: progression is within the CURRENT level's XP band, not cumulative
  // from zero. See computeXpProgress() near XP_TBL for the math.
  const prog = computeXpProgress(c);
  document.getElementById('tr-xp').innerHTML=`
    <div class="m-0 xp-track">
      <div class="xp-top"><span class="xp-lvl">Level ${c.totalLvl}</span><span class="font-serif fs-9 c-g50">ECL ${c.ecl}</span></div>
      <div class="bar-wrap"><div class="bar-fill bar-gold" style="width:${prog.pct}%;"></div></div>
      <div class="xp-txt">${prog.inLevel.toLocaleString()} / ${prog.bandSize.toLocaleString()} XP toward Lvl ${c.totalLvl + 1} <span class="c-g45 fs-10">(${c.xp.toLocaleString()} total)</span></div>
      ${c.mcReserve && techsmithLvl(c) ? `<div style="font-size:10.5px;color:#78afcd;margin-top:3px;cursor:help;" title="Techsmith class feature (HH p.140): 250 XP × class level granted at every Techsmith level. Spendable ONLY on mastercraft items (the − Spend flow draws it first); unspent reserve is FORFEITED when a new level is gained. Separate from advancement XP — it never counts toward level gain.">🔧 Mastercraft XP Reserve: <b>${c.mcReserve.balance.toLocaleString()}</b> <span class="c-g45">(use-it-or-lose-it at level-up · mastercraft only)</span></div>` : ''}
    </div>`;
}
function awardXP(){
  const c=chars.find(x=>x.id===curId);if(!c)return;
  // v8.20.0: awards are strictly positive — deductions go through spendXP(),
  // which enforces the book's no-level-loss floor and keeps a typed ledger.
  const amt=Math.max(0,parseInt(document.getElementById('tr-xp-adj').value)||0);
  if(!amt){toast('Enter an XP amount (use − Spend for expenditures).');return;}
  c.xp+=amt;save();renderXPBar(c);logAct(`Awarded ${amt.toLocaleString()} XP → ${c.xp.toLocaleString()} total`);
  if(c.xp>=c.xpNext)toast('⬆ Level up available!');
}

function spendXP(){
  const c=chars.find(x=>x.id===curId);if(!c){toast('Select a character first.');return;}
  reconcileMcReserve(c);
  const amt=Math.max(0,parseInt(document.getElementById('tr-xp-adj').value)||0);
  if(!amt){toast('Enter the XP cost in the amount field first.');return;}
  const REASONS=[
    'Mastercraft item (250 XP × bonus — paid before the Craft check)',
    'Magic / psionic item creation (or mending at half cost)',
    'Spell or power XP Cost (Permanency, Disjunction, Miracle...)',
    'Other (GM adjudication)'
  ];
  openChoiceModal(`− Spend ${amt.toLocaleString()} XP — what for?`, REASONS, (choice)=>{
    if(!choice) return;
    const isMastercraft = choice.startsWith('Mastercraft');
    // Techsmith reserve: mastercraft spends draw reserve-first — strictly
    // optimal (the reserve is use-it-or-lose-it and mastercraft-only), and
    // the book allows any split ("pay all 500 XP out of either pool").
    let fromReserve = 0;
    if(isMastercraft && c.mcReserve && c.mcReserve.balance>0) fromReserve = Math.min(c.mcReserve.balance, amt);
    const fromXp = amt - fromReserve;
    // The floor: never below the minimum XP for the CURRENT level.
    const floor = xpThreshold(c.ecl);
    if(c.xp - fromXp < floor){
      const spendable = Math.max(0, c.xp - floor) + (isMastercraft && c.mcReserve ? c.mcReserve.balance : 0);
      toast(`✋ Refused — "you cannot spend so much XP that you lose a level" (HH). Level ${c.totalLvl} floor: ${floor.toLocaleString()} XP; spendable now: ${spendable.toLocaleString()}${isMastercraft&&c.mcReserve&&c.mcReserve.balance?` (incl. ${c.mcReserve.balance} reserve)`:''}.`);
      return;
    }
    if(fromReserve){ c.mcReserve.balance -= fromReserve; }
    if(fromXp){ c.xp -= fromXp; }
    const reasonShort = choice.split(' (')[0];
    const split = fromReserve ? (fromXp ? `${fromReserve} from the Mastercraft XP Reserve + ${fromXp.toLocaleString()} from XP` : `all ${fromReserve} from the Mastercraft XP Reserve`) : `${fromXp.toLocaleString()} XP`;
    logActionEvent(c,'xp-spend',-amt,reasonShort,`Spent ${amt.toLocaleString()} XP — ${reasonShort} (${split}) → ${c.xp.toLocaleString()} XP total${c.mcReserve?`, reserve ${c.mcReserve.balance}`:''}`);
    save();renderXPBar(c);
    toast(`− ${amt.toLocaleString()} XP (${reasonShort}): ${split}.`);
  });
}
