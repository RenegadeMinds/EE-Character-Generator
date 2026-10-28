// =============================================================================
// js/ui/tracker/damage.js
// TRACKER / DAMAGE — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: massive damage, nonlethal damage and
//   attribute damage.
//
// KEY NAMES (so you can search for them)
//   tables and state: _mdtPending
//   functions (10): mdtPrompt, mdtRender, mdtClose, mdtResolve, nlCheck,
//   renderNLLine, adjustAttrDmg, attrDmgDailyRecovery, renderAttrDmg,
//   adjustNL
//
// WHERE IT CAME FROM
//   Gathered from js/app/65-tracker-logs-and-damage.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
    ? `<div class="mb-8" style="font-size:15px;"><b class="c-red-text">Fortitude save DC ${_mdtPending.dc}</b> — ${escapeHTML(c.name)} vs massive damage (${amt} dmg, ${thrLine}${amt - t.thr >= 5 ? `; +${Math.floor((amt - t.thr) / 5)} DC for damage ${amt - t.thr} beyond it` : ''})</div>
       <div class="fs-12 mb-10" style="color:var(--tw75);">Failure: reduced to −[Con modifier] hit points (minimum −1 in all cases) and <b>Dying</b> if the source was lethal; reduced to 0 HP, <b>Unconscious but Stable</b>, if nonlethal. (HH p.348)</div>
       <button onclick="mdtResolve('made')" class="mr-8">Save MADE — still standing</button>
       ${_mdtPending.nl
         ? `<button onclick="mdtResolve('failNonlethal')" style="color:#d4b070;">FAILED — 0 HP, Unconscious but Stable</button>`
         : `<button onclick="mdtResolve('failLethal')" class="mr-8 c-red-text">FAILED (lethal) — Dying</button>
       <button onclick="mdtResolve('failNonlethal')" style="color:#d4b070;">FAILED (nonlethal) — Unconscious</button>`}`
    : `<div class="mb-6" style="font-size:15px;">⚠ <b>${amt} damage</b> meets ${escapeHTML(c.name)}'s massive damage threshold (${thrLine}).</div>
       <div class="fs-12_5 mb-10" style="color:var(--tw80);">Was this a <b>single attack</b>? Damage totaled from several smaller hits does not trigger a Massive Damage save (HH p.348).</div>
       <button onclick="mdtRender('save')" class="mr-8 c-red-text">A single attack</button>
       <button onclick="mdtResolve('aggregate')">Several smaller hits (no save)</button>
       <div class="mt-10 fs-11" style="color:var(--tw60);">Misc threshold adjustment (Healer −3, enhancements, drawbacks…): <input type="number" value="${t.adj}" style="width:56px;padding:2px 4px;" onchange="(function(v){const c=chars.find(x=>x.id===curId); if(c){c.mdtAdj=parseInt(v)||0; save(); mdtRender();}})(this.value)"> <span class="op-0_7">(persists on this character)</span></div>`;
  host.innerHTML = `<div class="items-center p-1rem" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9000;display:flex;justify-content:center;" onclick="if(event.target===this)mdtClose()">
    <div class="max-w-560 lh-1_6" style="background:#141824;border:1px solid rgba(212,112,112,.5);border-radius:4px;padding:16px 18px;">
      <div class="ls-0_05em c-red-text mb-8" style="font-family:'Cinzel',Georgia,serif;">💥 MASSIVE DAMAGE</div>
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
  el.innerHTML = `<div class="mt-5 fs-11_5" style="color:var(--tt85);">😵 Nonlethal: <b>${nl}</b> vs HP ${c.currentHP}
    ${st === 2 ? '· <b class="c-red-text">UNCONSCIOUS</b> (helpless)' : st === 1 ? '· <b style="color:#d4b070;">STAGGERED</b> (standard OR move)' : ''}
    <span class="o-60 c-dim">· heals ${lvl}/hour (1/hr/level)</span></div>`;
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
  el.innerHTML = `<div class="mt-6 fs-11" style="color:var(--tt80);">
    <span class="cursor-help" style="border-bottom:1px dotted rgba(200,180,140,.5);" title="Temporary attribute damage (Ego Whip, a Shadow's touch, poison…): modifiers change immediately, full effect. Heals 1 point per evening of rest per damaged ability. Horror-born mental strain is tracked in the Sanity panel instead (it has the half-floor); ability DRAIN is permanent — edit the attribute itself. Con damage recomputes hit points automatically: each point of Con modifier lost costs [level] HP from max and current, restored as the damage heals.">Attr damage:</span>
    ${names.map((n, i) => `<span style="margin-left:7px;white-space:nowrap;${(c.attrDmg[i] || 0) > 0 ? 'color:#d49a70;' : ''}">${n} <b class="cursor-pointer" style="color:#7dc98c;" onclick="adjustAttrDmg(${i},-1)" title="Heal 1">−</b><b>${c.attrDmg[i] || 0}</b><b class="cursor-pointer c-red-text" onclick="adjustAttrDmg(${i},1)" title="Take 1 ${n} damage">+</b>${(c.attrDmg[i] || 0) > 0 ? `<span class="fs-10"> (→${eff[3] !== undefined ? eff[i] : '?'})</span>` : ''}</span>`).join('')}
    ${any ? ` <button onclick="attrDmgDailyRecovery()" class="fs-10 ml-6" title="One evening of rest: 1 point per damaged ability (Full Rest applies this too).">🌙 evening</button>` : ''}
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
