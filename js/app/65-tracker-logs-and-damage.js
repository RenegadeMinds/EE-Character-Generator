// =============================================================================
// js/app/65-tracker-logs-and-damage.js
// TRACKER LOGS AND DAMAGE
// =============================================================================
//
// WHAT'S IN HERE
//   Tracker: the AP/FP audit log, massive damage, nonlethal damage, AP/FP
//   spend and restore dialogs, and the action log panel.
//
// KEY NAMES (so you can search for them)
//   tables/objects: ATTR_DMG_ZERO
//   functions (36): logActionEvent, editActionLogNote, clearActionLog,
//   mindHPBoutCheck, mdtThreshold, mdtPrompt, mdtRender, mdtClose, mdtResolve,
//   nlStatus, nlCheck, renderNLLine, reconcileConDamageHP, adjustAttrDmg,
//   attrDmgDailyRecovery, renderAttrDmg, adjustNL, adjustHP, adjustAP,
//   adjustAPSilent, resetAP, spendFatePoint, restoreFatePoint,
//   _buildOptionRadios, _buildAPSpendRadios, _buildFPSpendRadios,
//   openAPSpendModal, openAPRestoreModal, openFPSpendModal,
//   openFPRestoreModal, closeAPFPModal, commitAPFPModal, renderActionLog,
//   onActionLogNoteEditStart, onActionLogNoteEditSave, awardXP
//
// LOAD ORDER
//   File 65 of 68. index.html loads it after js/app/64-tracker.js and before
//   js/app/66-xp-spending-and-level-up.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 53228-53907 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 53228-53907; unchanged below this line ----
// ============================================================================
// v8.3.27: STRUCTURED AP/FP AUDIT LOG
// ============================================================================
//
// Separate from `c.log` (the free-text session journal). Where `c.log` holds
// player-authored story notes, `c.actionLog` holds structured records of
// every Action Point and Fate Point event:
//
//   entry: {
//     id:        unique id for note-edit handles
//     time:      ISO timestamp + human-readable string
//     kind:      'ap-spend' | 'ap-restore' | 'ap-reset' | 'fp-spend' | 'fp-restore'
//     delta:     numeric change (negative for spend, positive for restore)
//     balance:   resulting AP balance after the event
//     balanceMax: resulting apMax after the event (changes on FP spend/restore)
//     fpBalance: resulting fatePoints count
//     option:    canonical option name (e.g. "Heroic Effort", "Twist of Fate",
//                "Class ability activation", "Other (GM-approved)"), or null
//     note:      player's freeform annotation (may be empty)
//     level:     character.totalLvl at time of event
//   }
//
// Why two logs:
//   • `c.log` is the story journal — what the player chooses to write down.
//   • `c.actionLog` is the resource audit — what AP/FP actually moved.
// The two coexist with distinct UI panels on the Tracker. Per design call:
// AP/FP events are NOT also written to c.log to avoid duplication.
//
// Behavior:
//   • AP and FP buttons no longer call logAct (free-text journal).
//   • Bare ±1 buttons now route through prompt modals that gather a canonical
//     option (radio list) + optional note, then call logActionEvent().
//   • Restore is silent on auto-events (e.g. full-rest, level-up); on manual
//     +1 button the user gets the prompt modal.

function logActionEvent(c, kind, delta, option, note) {
  if (!c) return;
  if (!Array.isArray(c.actionLog)) c.actionLog = [];
  const now = new Date();
  c.actionLog.push({
    id: 'al-' + now.getTime() + '-' + Math.floor(Math.random() * 1000),
    time: now.toLocaleString(),
    timeIso: now.toISOString(),
    kind: kind,
    delta: delta || 0,
    balance: c.ap || 0,
    balanceMax: c.apMax || 0,
    fpBalance: c.fatePoints || 0,
    option: option || null,
    note: note || '',
    level: c.totalLvl || 1,
  });
}

// Edit the note on a previous action-log entry. Called from the inline ✎ UI.
function editActionLogNote(entryId, newNote) {
  const c = chars.find(x => x.id === curId);
  if (!c || !Array.isArray(c.actionLog)) return;
  const entry = c.actionLog.find(e => e.id === entryId);
  if (!entry) return;
  entry.note = (newNote || '').trim();
  save();
  renderActionLog(c);
}

// Clear the entire action log (with confirm). Player-initiated only.
async function clearActionLog() {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!Array.isArray(c.actionLog) || c.actionLog.length === 0) {
    toast('No history to clear.');
    return;
  }
  if (!(await confirmModal(`Clear ${c.actionLog.length} action-log entr${c.actionLog.length===1?'y':'ies'}? This cannot be undone.`))) return;
  c.actionLog = [];
  save();
  renderActionLog(c);
  toast('Action history cleared.');
}
// v8.46.5 (Adam): the insanity-tier HP thresholds are WIRED to the tracker.
// Crossing the tier's line (Mildly Insane: 25% or less of max HP; Severely
// Insane: 50% or less — its trigger supersedes the Mild one) pops the bout
// prompt with the DC and duration. Fires on the CROSSING only (healing back
// above the line re-arms it), so repeated hits below the line don't spam;
// the Severe tier's other trigger (a failed Will save in combat) and the
// Complete tier (always under the effect) stay with the Bout button.
function mindHPBoutCheck(c, oldHP) {
  if (!c || !c.mind || typeof c.currentHP !== 'number' || !c.maxHP) return;
  const tier = mindTier(c.mind);
  if (tier !== 1 && tier !== 2) return;
  const pct = tier === 1 ? 25 : 50;
  const thr = Math.floor(c.maxHP * pct / 100);
  if (!(oldHP > thr && c.currentHP <= thr)) return;
  const ea = effAttrs(c);
  const best = Math.max(am(ea[3]), am(ea[4]), am(ea[5]));
  const dc = tier === 2 ? 20 : 15, dur = Math.max(1, (tier === 2 ? 20 : 10) - best);
  toast(`🧠 ${c.name}'s mind is cracking! Make a Will save DC ${dc} to avoid a Bout of Insanity! (${dur} rounds on a failure — ${MIND_TIERS[tier][0]}, ${c.currentHP}/${c.maxHP} HP)`);
  logAct(`🧠 Sanity threshold crossed at ${c.currentHP}/${c.maxHP} HP (≤${pct}%): Will DC ${dc} or a ${dur}-round bout of insanity.`);
}
// ============================================================================
// v8.47.0: MASSIVE DAMAGE THRESHOLD — wired to the tracker (HH p.348,
// "Massive Damage", book-verified 2026-09-28): a SINGLE attack dealing
// damage EQUAL TO OR GREATER than the character's massive damage threshold
// (current Con score, +3 per instance of Improved Damage Threshold — the
// feat stacks, HH p.213 — plus a persisted misc adjustment for the other
// printed sources: the Healer's Con−3, the +4 enhancement, drawbacks;
// Tactician Int-to-DC is attacker-side, adjust the DC at the table) forces
// a Fortitude save, DC 15 +1 per full 5 points of damage beyond the
// threshold. FAILURE (book letter): reduced to −[Con modifier] hit points
// and Dying — Unconscious instead if the damage was nonlethal. Damage
// "from multiple attacks, no one of which dealt enough damage itself" does
// NOT trigger the rule (p.348, explicit) — players often enter
// nickel-and-dime hits as one lump sum, so the tracker ASKS which it was.
function mdtThreshold(c) {
  const con = effAttrs(c)[2];
  const idt = (c.feats || []).filter(f => (f.name || f.n) === 'Improved Damage Threshold').length;
  const adj = c.mdtAdj || 0;
  return { thr: Math.max(1, con + idt * 3 + adj), con, idt, adj };
}
let _mdtPending = null;
function mdtPrompt(c, amt, nl) {
  const t = mdtThreshold(c);
  if (amt < t.thr) return;
  _mdtPending = { cid: c.id, amt, nl: !!nl };  // v8.48.0: nonlethal entries carry their source
  mdtRender();
}
function mdtRender(stage) {
  const c = _mdtPending && chars.find(x => x.id === _mdtPending.cid);
  if (!c) return mdtClose();
  const t = mdtThreshold(c), amt = _mdtPending.amt;
  const dc = 15 + Math.floor(Math.max(0, amt - t.thr) / 5);
  _mdtPending.dc = dc;
  let host = document.getElementById('mdt-host');
  if (!host) { host = document.createElement('div'); host.id = 'mdt-host'; document.body.appendChild(host); }
  const thrLine = `threshold ${t.thr} = Con ${t.con}${t.idt ? ` + ${t.idt * 3} (Improved Damage Threshold ×${t.idt})` : ''}${t.adj ? ` ${t.adj > 0 ? '+' : ''}${t.adj} (misc)` : ''}`;
  const inner = stage === 'save'
    ? `<div style="font-size:15px;margin-bottom:8px;"><b style="color:var(--red-text);">Fortitude save DC ${_mdtPending.dc}</b> — ${escapeHTML(c.name)} vs massive damage (${amt} dmg, ${thrLine}${amt - t.thr >= 5 ? `; +${Math.floor((amt - t.thr) / 5)} DC for damage ${amt - t.thr} beyond it` : ''})</div>
       <div style="font-size:12px;color:var(--tw75);margin-bottom:10px;">Failure: reduced to −[Con modifier] hit points (minimum −1 in all cases) and <b>Dying</b> if the source was lethal; reduced to 0 HP, <b>Unconscious but Stable</b>, if nonlethal. (HH p.348)</div>
       <button onclick="mdtResolve('made')" style="margin-right:8px;">Save MADE — still standing</button>
       ${_mdtPending.nl
         ? `<button onclick="mdtResolve('failNonlethal')" style="color:#d4b070;">FAILED — 0 HP, Unconscious but Stable</button>`
         : `<button onclick="mdtResolve('failLethal')" style="margin-right:8px;color:var(--red-text);">FAILED (lethal) — Dying</button>
       <button onclick="mdtResolve('failNonlethal')" style="color:#d4b070;">FAILED (nonlethal) — Unconscious</button>`}`
    : `<div style="font-size:15px;margin-bottom:6px;">⚠ <b>${amt} damage</b> meets ${escapeHTML(c.name)}'s massive damage threshold (${thrLine}).</div>
       <div style="font-size:12.5px;color:var(--tw80);margin-bottom:10px;">Was this a <b>single attack</b>? Damage totaled from several smaller hits does not trigger a Massive Damage save (HH p.348).</div>
       <button onclick="mdtRender('save')" style="margin-right:8px;color:var(--red-text);">A single attack</button>
       <button onclick="mdtResolve('aggregate')">Several smaller hits (no save)</button>
       <div style="margin-top:10px;font-size:11px;color:var(--tw60);">Misc threshold adjustment (Healer −3, enhancements, drawbacks…): <input type="number" value="${t.adj}" style="width:56px;padding:2px 4px;" onchange="(function(v){const c=chars.find(x=>x.id===curId); if(c){c.mdtAdj=parseInt(v)||0; save(); mdtRender();}})(this.value)"> <span style="opacity:.7;">(persists on this character)</span></div>`;
  host.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)mdtClose()">
    <div style="max-width:560px;background:#141824;border:1px solid rgba(212,112,112,.5);border-radius:4px;padding:16px 18px;line-height:1.6;">
      <div style="font-family:'Cinzel',Georgia,serif;letter-spacing:.05em;color:var(--red-text);margin-bottom:8px;">💥 MASSIVE DAMAGE</div>
      ${inner}
    </div></div>`;
}
function mdtClose() { const h = document.getElementById('mdt-host'); if (h) h.innerHTML = ''; _mdtPending = null; }
function mdtResolve(kind) {
  const c = _mdtPending && chars.find(x => x.id === _mdtPending.cid);
  if (!c) return mdtClose();
  const dc = _mdtPending.dc, amt = _mdtPending.amt;
  if (kind === 'aggregate') {
    logAct(`💥 ${amt} damage was an aggregate of smaller hits — no Massive Damage save (HH p.348).`);
  } else if (kind === 'made') {
    logAct(`💥 MASSIVE DAMAGE (${amt}): Fortitude save DC ${dc} MADE — ${c.name} is still standing.`);
  } else {
    // v8.47.1 — Adam's HH amendment (2026-09-28), now the printed rule:
    // lethal source: reduced to −[Con modifier] HP, MINIMUM −1 in all cases,
    // and Dying; nonlethal source: reduced to 0 HP, Unconscious but Stable
    // (a deliberate printed override of nonlethal's no-HP-deduction rule).
    if (kind === 'failLethal') {
      const conMod = am(effAttrs(c)[2]);
      c.currentHP = -Math.max(1, conMod);
      logAct(`💥 MASSIVE DAMAGE (${amt}): Fortitude save DC ${dc} FAILED — reduced to ${c.currentHP} HP and DYING (bleeding out; stabilize with Treat Injury DC 15 or any healing).`);
      toast(`💥 ${c.name} is DYING at ${c.currentHP} HP — stabilize them!`);
    } else {
      c.currentHP = 0;
      logAct(`💥 MASSIVE DAMAGE (${amt}, nonlethal): Fortitude save DC ${dc} FAILED — reduced to 0 HP, UNCONSCIOUS but STABLE (not bleeding out).`);
      toast(`💥 ${c.name} is out cold at 0 HP — unconscious but stable.`);
    }
    save(); renderHPBar(c); renderRoster();
  }
  save();
  mdtClose();
}
// ============================================================================
// v8.48.0: NONLETHAL DAMAGE — the p.349 tally, wired (Adam, 2026-09-28).
// c.nlDmg is a separate running total, NEVER deducted from HP. Status is
// DERIVED by comparison — "it doesn't matter whether the nonlethal damage
// has gone up or your current hit points have gone down" — so both the NL
// buttons AND the HP damage/heal paths re-check. Tally = current HP →
// Staggered; tally > current HP → Unconscious (helpless; casters retain
// abilities). Heals 1 point/hour/level; magical HP healing removes an equal
// amount (manual, via NL Heal — the tracker can't tell magic from rest);
// a Full Rest clears the tally outright.
function nlStatus(c) {
  const nl = c.nlDmg || 0;
  if (!nl || typeof c.currentHP !== 'number') return 0;
  return nl > c.currentHP ? 2 : nl === c.currentHP ? 1 : 0;
}
function nlCheck(c, before) {
  const now = nlStatus(c);
  if (now === before) return;
  if (now === 2) {
    toast(`😵 ${c.name} falls UNCONSCIOUS — nonlethal tally (${c.nlDmg}) exceeds current HP (${c.currentHP}). Helpless; spellcasters/manifesters retain their abilities.`);
    logAct(`😵 UNCONSCIOUS: nonlethal (${c.nlDmg}) exceeds current HP (${c.currentHP}) — helpless until the tally drops below HP.`);
  } else if (now === 1) {
    toast(`😖 ${c.name} is STAGGERED — nonlethal tally (${c.nlDmg}) equals current HP. One standard OR move action each round.`);
    logAct(`😖 STAGGERED: nonlethal (${c.nlDmg}) equals current HP (${c.currentHP}).`);
  } else if (before) {
    logAct(`😌 ${c.name} recovers — nonlethal (${c.nlDmg || 0}) is below current HP again (no longer ${before === 2 ? 'unconscious' : 'staggered'}).`);
  }
}
function renderNLLine(c) {
  const el = document.getElementById('tr-nl-line');
  if (!el) return;
  const nl = (c && c.nlDmg) || 0;
  if (!nl) { el.innerHTML = ''; return; }
  const st = nlStatus(c);
  const lvl = c.totalLvl || (c.classes || []).reduce((s, e) => s + (e.level || 0), 0) || 1;
  el.innerHTML = `<div style="margin-top:5px;font-size:11.5px;color:var(--tt85);">😵 Nonlethal: <b>${nl}</b> vs HP ${c.currentHP}
    ${st === 2 ? '· <b style="color:var(--red-text);">UNCONSCIOUS</b> (helpless)' : st === 1 ? '· <b style="color:#d4b070;">STAGGERED</b> (standard OR move)' : ''}
    <span style="opacity:var(--o60);color:var(--dim);">· heals ${lvl}/hour (1/hr/level)</span></div>`;
}
// v8.50.0: GENERAL ATTRIBUTE DAMAGE — the tracker panel (Ego Whip, a
// Shadow's touch, poison…). c.attrDmg = [Str..Cha] temporary damage;
// modifiers change immediately (effAttrs subtracts in full — no half-floor,
// horror strain lives in the Sanity panel instead); heals 1 per evening of
// rest ("Ability Damaged", HH conditions; a feat can raise the rate).
// Ability DRAIN is permanent: edit the attribute itself. House precedent
// (v8.6.0): the max-HP snapshot uses BASE Con, so Con damage does not
// auto-shrink max HP — the GM applies that per RAW if desired.
const ATTR_DMG_ZERO = ['helpless — collapses (Str 0)', 'immobilized (effective Dex 0)', 'DEAD (Con 0)',
                       'unconscious (Int 0)', 'unconscious (Wis 0)', 'unconscious (Cha 0)'];
// v8.50.1 (Adam's override of the v8.6.0-precedent extension): Con DAMAGE
// auto-recomputes hit points per RAW — each point of Con MODIFIER lost
// costs [character level] HP from max AND current; restored symmetrically.
// Delta-reconciled (the mutation-NAC pattern): idempotent, so it can run
// on every attrDmg mutation. Known edge (commented, accepted): a maxHP
// rebuild (level-up / HP re-roll) while Con damage is active rebuilds from
// the base snapshot; the reconciler's applied-field survives, so re-taking
// or healing the damage re-converges.
function reconcileConDamageHP(c) {
  if (!c || typeof c.maxHP !== 'number' || !isFinite(c.maxHP)) return;
  const lvl = c.totalLvl || (c.classes || []).reduce((s, e) => s + (e.level || 0), 0) || 1;
  const baseCon = (c.attrs || [10, 10, 10, 10, 10, 10])[2] || 10;
  const dmg = (Array.isArray(c.attrDmg) ? c.attrDmg[2] : 0) || 0;
  const expected = Math.max(0, (am(baseCon) - am(Math.max(0, baseCon - dmg))) * lvl);
  const applied = c.conDmgHpApplied || 0;
  if (expected === applied) return;
  const delta = expected - applied;  // >0 = losing HP now; <0 = regaining
  c.maxHP = Math.max(1, c.maxHP - delta);
  if (typeof c.currentHP === 'number' && isFinite(c.currentHP)) c.currentHP = Math.min(c.currentHP - delta, c.maxHP);
  c.conDmgHpApplied = expected;
  logAct(`Con ${delta > 0 ? 'damage' : 'recovery'}: ${delta > 0 ? '−' : '+'}${Math.abs(delta)} HP (modifier ${delta > 0 ? 'lost' : 'regained'} × level ${lvl}) → ${c.currentHP}/${c.maxHP}.`);
}
function adjustAttrDmg(i, d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!Array.isArray(c.attrDmg)) c.attrDmg = [0, 0, 0, 0, 0, 0];
  const wasZero = effAttrs(c)[i] <= 0;
  c.attrDmg[i] = Math.max(0, (c.attrDmg[i] || 0) + d);
  const names = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
  const eff = effAttrs(c)[i];
  if (d > 0) logAct(`Attribute damage: ${names[i]} +${d} → ${c.attrDmg[i]} total (${names[i]} now ${eff}).`);
  else if (d < 0) logAct(`Attribute damage healed: ${names[i]} −${-d} → ${c.attrDmg[i]} remaining (${names[i]} now ${eff}).`);
  if (!wasZero && eff <= 0) {
    toast(`☠ ${c.name} — ${names[i]} has hit 0: ${ATTR_DMG_ZERO[i]} (see the HH Attributes section).`);
    logAct(`☠ ${names[i]} reduced to 0: ${ATTR_DMG_ZERO[i]}.`);
  }
  reconcileConDamageHP(c);  // v8.50.1: Con damage moves HP per RAW
  save(); renderSheet();
}
function attrDmgDailyRecovery(cArg, quiet) {
  const c = cArg || chars.find(x => x.id === curId); if (!c || !Array.isArray(c.attrDmg)) return;
  if (!c.attrDmg.some(v => v > 0)) return;
  c.attrDmg = c.attrDmg.map(v => Math.max(0, (v || 0) - 1));
  if (!quiet) logAct(`🌙 An evening of rest: attribute damage now ${['Str','Dex','Con','Int','Wis','Cha'].map((n, i) => c.attrDmg[i] ? n + ' ' + c.attrDmg[i] : null).filter(Boolean).join(' · ') || 'fully healed'}.`);
  reconcileConDamageHP(c);  // v8.50.1: recovered Con restores HP per RAW
  save(); if (c.id === curId) renderSheet();
}
function renderAttrDmg(c) {
  const el = document.getElementById('tr-attr-dmg');
  if (!el) return;
  if (!c) { el.innerHTML = ''; return; }
  if (!Array.isArray(c.attrDmg)) c.attrDmg = [0, 0, 0, 0, 0, 0];
  const names = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
  const any = c.attrDmg.some(v => v > 0);
  const eff = effAttrs(c);
  el.innerHTML = `<div style="margin-top:6px;font-size:11px;color:var(--tt80);">
    <span style="cursor:help;border-bottom:1px dotted rgba(200,180,140,.5);" title="Temporary attribute damage (Ego Whip, a Shadow's touch, poison…): modifiers change immediately, full effect. Heals 1 point per evening of rest per damaged ability. Horror-born mental strain is tracked in the Sanity panel instead (it has the half-floor); ability DRAIN is permanent — edit the attribute itself. Con damage recomputes hit points automatically: each point of Con modifier lost costs [level] HP from max and current, restored as the damage heals.">Attr damage:</span>
    ${names.map((n, i) => `<span style="margin-left:7px;white-space:nowrap;${(c.attrDmg[i] || 0) > 0 ? 'color:#d49a70;' : ''}">${n} <b style="cursor:pointer;color:#7dc98c;" onclick="adjustAttrDmg(${i},-1)" title="Heal 1">−</b><b>${c.attrDmg[i] || 0}</b><b style="cursor:pointer;color:var(--red-text);" onclick="adjustAttrDmg(${i},1)" title="Take 1 ${n} damage">+</b>${(c.attrDmg[i] || 0) > 0 ? `<span style="font-size:10px;"> (→${eff[3] !== undefined ? eff[i] : '?'})</span>` : ''}</span>`).join('')}
    ${any ? ` <button onclick="attrDmgDailyRecovery()" style="font-size:10px;margin-left:6px;" title="One evening of rest: 1 point per damaged ability (Full Rest applies this too).">🌙 evening</button>` : ''}
  </div>`;
}
function adjustNL(t) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const amt = parseInt(document.getElementById('tr-hp-adj').value) || 0;
  if (!amt) return;
  const before = nlStatus(c);
  if (t === 'dmg') {
    c.nlDmg = (c.nlDmg || 0) + amt;
    logAct(`Took ${amt} NONLETHAL → tally ${c.nlDmg} (current HP ${c.currentHP})`);
    nlCheck(c, before);
    mdtPrompt(c, amt, true);
  } else {
    c.nlDmg = Math.max(0, (c.nlDmg || 0) - amt);
    logAct(`Recovered ${amt} nonlethal → tally ${c.nlDmg}`);
    nlCheck(c, before);
  }
  save(); renderHPBar(c);
}
function adjustHP(t){
  const c=chars.find(x=>x.id===curId);if(!c)return;const amt=parseInt(document.getElementById('tr-hp-adj').value)||0;
  const _hpWas = c.currentHP;
  const _nlWas = nlStatus(c);
  if(t==='heal'){c.currentHP=Math.min(c.maxHP,c.currentHP+amt);logAct(`Healed ${amt} HP → ${c.currentHP}/${c.maxHP}`);nlCheck(c,_nlWas);}
  else if(t==='dmg'){c.currentHP=c.currentHP-amt;logAct(`Took ${amt} damage → ${c.currentHP}/${c.maxHP}`);mindHPBoutCheck(c,_hpWas);nlCheck(c,_nlWas);mdtPrompt(c,amt);}
  else if(t==='full'){
    c.currentHP=c.maxHP;
    if (c.nlDmg) { c.nlDmg = 0; logAct('Nonlethal tally cleared by the full rest.'); }
    mindDailyRecovery(c);  // a rest = a day of mental healing
    attrDmgDailyRecovery(c);  // …and an evening for attribute damage
    // v8.3.27: full rest also refreshes AP. The AP refresh is a silent
    // ap-reset entry — automatic, not player-discretionary, so it doesn't
    // prompt for a note. (Player intuition: a full rest is rules-driven and
    // doesn't merit annotation.)
    const oldAP = c.ap || 0;
    const delta = c.apMax - oldAP;
    c.ap = c.apMax;
    if (delta !== 0) {
      logActionEvent(c, 'ap-reset', delta, 'Full rest', '');
    }
    logAct('Full rest — HP & AP restored.');
  }
  save();renderHPBar(c);renderAPBar(c);renderRoster();
}

// v8.3.27: bare ±1 AP button → opens the AP spend/restore modal. Per design:
// every discretionary AP event prompts for a canonical option + optional note.
// Use adjustAPSilent() for non-discretionary events (full rest, level-up).
function adjustAP(d){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (d < 0) {
    // Spend path — open the radio-list modal.
    if ((c.ap || 0) <= 0) { toast('No AP to spend.'); return; }
    openAPSpendModal(c);
  } else if (d > 0) {
    // Restore path — open the optional-note modal.
    if ((c.ap || 0) >= (c.apMax || 0)) { toast('AP pool already full.'); return; }
    openAPRestoreModal(c);
  }
  // d === 0 is a no-op, leave it.
}

// v8.3.27: silent AP adjustment — used for automatic events (full rest,
// scenario-driven refreshes) that don't go through the modal. Logs a
// structured entry with no player-supplied annotation.
function adjustAPSilent(c, d, option, note) {
  if (!c) return;
  const newVal = Math.max(0, Math.min(c.apMax || 0, (c.ap || 0) + d));
  const actualDelta = newVal - (c.ap || 0);
  c.ap = newVal;
  if (actualDelta !== 0) {
    const kind = actualDelta > 0 ? 'ap-restore' : 'ap-spend';
    logActionEvent(c, kind, actualDelta, option || null, note || '');
  }
  save();
  renderAPBar(c);
}

function resetAP(){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const oldAP = c.ap || 0;
  const delta = (c.apMax || 0) - oldAP;
  c.ap = c.apMax;
  if (delta !== 0) {
    // v8.3.27: silent ap-reset entry. Encounter refreshes are rules-driven
    // and don't merit a modal interruption; player can scan the log later.
    logActionEvent(c, 'ap-reset', delta, 'Encounter refresh', '');
  }
  save();
  renderAPBar(c);
}

// v8.3.19: Spend 1 AP as a Fate Point — permanently expended (HH p.55).
// Requires confirmation since this PERMANENTLY reduces future AP pool
// replenishment. Each call decrements c.ap and increments c.fatePoints.
//
// v8.3.27: routed through openFPSpendModal (which collects an FP-specific
// radio list + optional note). The previous confirm() dialog is replaced by
// the modal's own commit/cancel buttons.
function spendFatePoint(){
  const c=chars.find(x=>x.id===curId);
  if(!c)return;
  if((c.ap||0)<1){toast('No AP available to spend as a Fate Point.');return;}
  const cap = getHeroicCapabilities(c);
  if(!cap.hasFP){toast('Fate Points require Heroic Scale 5+ scenarios and at least one Hero class level.');return;}
  openFPSpendModal(c);
}

// v8.3.19: GM-granted Fate Point restoration. Parallel to the "Gain" AP button:
// for genuinely heroic moments where the GM rewards a previously-spent FP.
// Each call decrements c.fatePoints (restoring 1 to the pool max) and adds 1
// to current AP (the player can immediately use it again). Requires confirmation
// since this is an unusual GM action.
//
// v8.3.27: routed through openFPRestoreModal (optional-note modal).
function restoreFatePoint(){
  const c=chars.find(x=>x.id===curId);
  if(!c)return;
  if((c.fatePoints||0)<1){toast('No Fate Points have been spent to restore.');return;}
  openFPRestoreModal(c);
}

// ============================================================================
// v8.3.27: ACTION POINT / FATE POINT SPEND-RESTORE MODALS
// ============================================================================
//
// All four modals share a layout: title strip, optional context block, a radio
// list of canonical options, a free-text note input, and Commit/Cancel buttons.
// The radio list comes from the AP_OPTIONS / HAP_OPTIONS / FP_OPTIONS_*
// constants (rules-reference data, reused as actionable choices).
//
// Per design call:
//   • Spend modals (AP and FP) include a radio list grouped under a "Rules-
//     defined options" separator, followed by "Class ability activation" and
//     "Other (GM-approved)" under a "Special / GM" separator.
//   • Restore modals omit the radio list (no canonical rules-defined restore
//     mechanism) — just an optional note.
//   • "Other (GM-approved)" pre-selected as the default radio.

function _buildOptionRadios(options, defaultValue) {
  return options.map((opt, i) => {
    const id = 'apopt-' + i + '-' + (opt.name||'opt').replace(/\W+/g, '_');
    const checked = (opt.name === defaultValue) ? 'checked' : '';
    const descText = opt.desc ? `<span style="font-size:10.5px;color:var(--g60);">${escapeHTML(opt.desc)}</span>` : '';
    return `<label for="${id}" style="display:block;margin:4px 0;padding:6px 9px;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.25);border-radius:2px;cursor:pointer;font-size:11.5px;line-height:1.4;">
      <input type="radio" name="ap-modal-opt" id="${id}" value="${escapeHTML(opt.name)}" ${checked} style="margin-right:6px;vertical-align:top;margin-top:2px;">
      <span style="font-weight:600;color:var(--gold);">${escapeHTML(opt.name)}</span>${descText ? '<br>' + descText : ''}
    </label>`;
  }).join('');
}

function _buildAPSpendRadios(c) {
  const cap = getHeroicCapabilities(c);
  let html = '';
  html += `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px;">Rules-defined Options</div>`;
  html += _buildOptionRadios(AP_OPTIONS, null);
  if (cap.hasHAP) {
    html += _buildOptionRadios(HAP_OPTIONS, null);
  }
  html += `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 4px;">Special / GM</div>`;
  // "Class ability activation" — generic for now. Future v8.3.28+ work: drill
  // down into class-specific AP-cost abilities for the character (when the
  // character has multiple class features that cost AP).
  html += _buildOptionRadios([
    {name: 'Class ability activation', desc: 'A class feature that costs Action Points to invoke.'},
    {name: 'Other (GM-approved)', desc: 'An unorthodox expenditure approved by the GM. Please explain in the note below.'},
  ], 'Other (GM-approved)');
  return html;
}

function _buildFPSpendRadios(c) {
  const cap = getHeroicCapabilities(c);
  let html = '';
  html += `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px;">Rules-defined Options</div>`;
  html += _buildOptionRadios(FP_OPTIONS_UNIVERSAL, null);
  for (const heroCls of cap.heroClassNames || []) {
    const baseOpt = FP_OPTIONS_BY_HERO_CLASS[heroCls];
    if (!baseOpt) continue;
    const owns = cap.ownedTalentNames && cap.ownedTalentNames.has(baseOpt.talent);
    const desc = owns
      ? `[✓ Talent owned] ${baseOpt.desc}`
      : `[⚠ Requires Talent: ${baseOpt.talent} — not owned] ${baseOpt.desc}`;
    html += _buildOptionRadios([{name: baseOpt.name, desc: desc}], null);
  }
  html += `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 4px;">Special / GM</div>`;
  html += _buildOptionRadios([
    {name: 'Class ability activation', desc: 'A class feature that costs Fate Points to invoke.'},
    {name: 'Other (GM-approved)', desc: 'An unorthodox expenditure approved by the GM. Please explain in the note below.'},
  ], 'Other (GM-approved)');
  return html;
}

function openAPSpendModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Spend 1 Action Point';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max. After: <b>${(c.ap||0)-1}</b> / ${c.apMax||0}.`;
  document.getElementById('apfp-modal-radios').innerHTML = _buildAPSpendRadios(c);
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'ap-spend';
  modal.style.display = 'flex';
}

function openAPRestoreModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Restore 1 Action Point (manual)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max. After: <b>${(c.ap||0)+1}</b> / ${c.apMax||0}.<br>` +
    `<span style="font-size:11px;color:var(--g50);">Manual restore — used for GM rewards or session-pacing grants. Encounter and full-rest refreshes are silent.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = '';
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'ap-restore';
  modal.style.display = 'flex';
}

function openFPSpendModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Spend 1 AP as a Fate Point (permanent)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max, <b>${c.fatePoints||0}</b> FP spent.<br>` +
    `After: <b>${(c.ap||0)-1}</b> AP / <b>${(c.apMax||0)-1}</b> max, <b>${(c.fatePoints||0)+1}</b> FP spent.<br>` +
    `<span style="font-size:11px;color:var(--red-text);">⚠ Permanent — your maximum AP pool will be reduced by 1 at every future level-up.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = _buildFPSpendRadios(c);
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'fp-spend';
  modal.style.display = 'flex';
}

function openFPRestoreModal(c) {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  document.getElementById('apfp-modal-title').textContent = 'Restore 1 Fate Point (GM grant)';
  document.getElementById('apfp-modal-ctx').innerHTML =
    `Current: <b>${c.ap||0}</b> AP / ${c.apMax||0} max, <b>${c.fatePoints||0}</b> FP spent.<br>` +
    `After: <b>${(c.ap||0)+1}</b> AP / <b>${(c.apMax||0)+1}</b> max, <b>${(c.fatePoints||0)-1}</b> FP spent.<br>` +
    `<span style="font-size:11px;color:var(--g50);">GM grant — restores a previously-spent Fate Point. Use sparingly.</span>`;
  document.getElementById('apfp-modal-radios').innerHTML = '';
  document.getElementById('apfp-modal-note').value = '';
  modal.dataset.mode = 'fp-restore';
  modal.style.display = 'flex';
}

function closeAPFPModal() {
  const modal = document.getElementById('apfp-modal');
  if (modal) modal.style.display = 'none';
}

function commitAPFPModal() {
  const modal = document.getElementById('apfp-modal');
  if (!modal) return;
  const c = chars.find(x => x.id === curId);
  if (!c) { closeAPFPModal(); return; }
  const mode = modal.dataset.mode;
  const radio = document.querySelector('input[name="ap-modal-opt"]:checked');
  const option = radio ? radio.value : null;
  const note = (document.getElementById('apfp-modal-note').value || '').trim();

  if (mode === 'ap-spend') {
    if ((c.ap||0) <= 0) { toast('No AP to spend.'); closeAPFPModal(); return; }
    c.ap = Math.max(0, (c.ap||0) - 1);
    logActionEvent(c, 'ap-spend', -1, option, note);
  } else if (mode === 'ap-restore') {
    if ((c.ap||0) >= (c.apMax||0)) { toast('AP pool already full.'); closeAPFPModal(); return; }
    c.ap = Math.min(c.apMax||0, (c.ap||0) + 1);
    logActionEvent(c, 'ap-restore', 1, option, note);
  } else if (mode === 'fp-spend') {
    if ((c.ap||0) < 1) { toast('No AP to spend as FP.'); closeAPFPModal(); return; }
    c.ap = Math.max(0, (c.ap||0) - 1);
    c.apMax = Math.max(0, (c.apMax||0) - 1);
    c.fatePoints = (c.fatePoints||0) + 1;
    logActionEvent(c, 'fp-spend', -1, option, note);
  } else if (mode === 'fp-restore') {
    if ((c.fatePoints||0) < 1) { toast('No spent FP to restore.'); closeAPFPModal(); return; }
    c.fatePoints = Math.max(0, (c.fatePoints||0) - 1);
    c.apMax = (c.apMax||0) + 1;
    c.ap = (c.ap||0) + 1;
    logActionEvent(c, 'fp-restore', 1, option, note);
  } else {
    closeAPFPModal();
    return;
  }
  save();
  renderAPBar(c);
  renderActionLog(c);
  closeAPFPModal();
}

// ============================================================================
// v8.3.27: ACTION LOG PANEL on the Tracker
// ============================================================================

function renderActionLog(c) {
  const el = document.getElementById('tr-action-log');
  if (!el) return;
  const entries = (c.actionLog || []).slice().reverse(); // newest first
  if (entries.length === 0) {
    el.innerHTML = `<div style="font-size:11px;color:var(--g35);padding:.5rem 0;font-style:italic;">No AP/FP events logged yet. Spends and manual restores will appear here.</div>`;
    return;
  }
  el.innerHTML = entries.map(e => {
    const kindLabel = ({
      'ap-spend':   { text: 'AP Spend',   color: 'var(--gold)',         sign: '−'},
      'ap-restore': { text: 'AP Restore', color: '#6dba88',             sign: '+'},
      'ap-reset':   { text: 'AP Reset',   color: 'var(--g60)', sign: '↻'},
      'fp-spend':   { text: 'FP Spend',   color: '#c499d4',             sign: '−'},
      'fp-restore': { text: 'FP Restore', color: '#c499d4',             sign: '+'},
      // v8.20.0 XP-expenditure ledger kinds.
      'xp-grant':   { text: 'XP Grant',   color: '#6dba88',             sign: '+'},
      'xp-spend':   { text: 'XP Spend',   color: '#d4865a',             sign: '−'},
      'xp-reserve': { text: 'MC Reserve', color: '#78afcd',             sign: '🔧'},
    })[e.kind] || { text: e.kind, color: 'var(--g70)', sign: '·'};
    const isFP = e.kind === 'fp-spend' || e.kind === 'fp-restore';
    const isXP = e.kind && e.kind.startsWith('xp-');
    const balanceText = isXP
      ? `${Math.abs(e.delta || 0).toLocaleString()} XP`
      : isFP
      ? `${e.balance}/${e.balanceMax} AP, ${e.fpBalance} FP spent`
      : `${e.balance}/${e.balanceMax} AP`;
    const optionTag = e.option
      ? `<span style="font-size:10.5px;color:${kindLabel.color};font-weight:600;">${escapeHTML(e.option)}</span>`
      : '';
    const noteText = e.note
      ? `<span style="font-size:10.5px;color:var(--g65);font-style:italic;">"${escapeHTML(e.note)}"</span>`
      : `<button type="button" style="background:none;border:none;color:var(--g45);font-size:10px;cursor:pointer;padding:0;text-decoration:underline;" onclick="onActionLogNoteEditStart('${escapeHTML(e.id)}')">✎ add note</button>`;
    const editBtn = e.note
      ? `<button type="button" style="background:none;border:none;color:var(--g40);font-size:10px;cursor:pointer;padding:0 0 0 4px;" onclick="onActionLogNoteEditStart('${escapeHTML(e.id)}')" title="Edit note">✎</button>`
      : '';
    const bgTint = isFP ? 'rgba(196,153,212,.04)' : 'rgba(200,151,30,.03)';
    const borderTint = isFP ? 'rgba(196,153,212,.3)' : 'rgba(200,151,30,.2)';
    const deltaAbs = Math.abs(e.delta || 1);
    return `<div class="al-entry" data-entry-id="${escapeHTML(e.id)}" style="margin:5px 0;padding:6px 9px;background:${bgTint};border-left:2px solid ${borderTint};border-radius:2px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:10.5px;color:var(--g55);">
        <span>${escapeHTML(e.time)} <span style="color:var(--g40);">· L${e.level||1}</span></span>
        <span style="font-weight:600;color:${kindLabel.color};">${kindLabel.sign}${deltaAbs} ${kindLabel.text}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:3px;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;">${optionTag}</div>
        <div style="font-size:10.5px;color:var(--g45);">${balanceText}</div>
      </div>
      <div class="al-note-row" style="margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        ${noteText}${editBtn}
      </div>
    </div>`;
  }).join('');
}

function onActionLogNoteEditStart(entryId) {
  const entryEl = document.querySelector(`.al-entry[data-entry-id="${entryId}"]`);
  if (!entryEl) return;
  const noteRow = entryEl.querySelector('.al-note-row');
  if (!noteRow) return;
  const c = chars.find(x => x.id === curId);
  const existing = (c && (c.actionLog || []).find(e => e.id === entryId)?.note) || '';
  noteRow.innerHTML = `
    <input type="text" class="al-note-input" value="${escapeHTML(existing)}" placeholder="Type a note (or leave blank to clear)" maxlength="240" style="flex:1;min-width:160px;font-size:11px;background:rgba(0,0,0,.35);color:var(--gold);border:1px solid rgba(200,151,30,.4);border-radius:2px;padding:2px 6px;">
    <button type="button" onclick="onActionLogNoteEditSave('${entryId}')" style="background:rgba(125,180,135,.15);color:#6dba88;border:1px solid rgba(125,180,135,.5);padding:2px 6px;font-size:10px;cursor:pointer;border-radius:2px;">✓</button>
    <button type="button" onclick="renderActionLog(chars.find(x=>x.id===curId))" style="background:rgba(200,151,30,.06);color:var(--g70);border:1px solid rgba(200,151,30,.3);padding:2px 6px;font-size:10px;cursor:pointer;border-radius:2px;">✕</button>
  `;
  const inp = noteRow.querySelector('input');
  if (inp) {
    inp.focus();
    inp.select();
    inp.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter') { ev.preventDefault(); onActionLogNoteEditSave(entryId); }
      else if (ev.key === 'Escape') { ev.preventDefault(); renderActionLog(chars.find(x => x.id === curId)); }
    });
  }
}
function onActionLogNoteEditSave(entryId) {
  const entryEl = document.querySelector(`.al-entry[data-entry-id="${entryId}"]`);
  if (!entryEl) return;
  const inp = entryEl.querySelector('.al-note-input');
  if (!inp) return;
  editActionLogNote(entryId, inp.value);
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

