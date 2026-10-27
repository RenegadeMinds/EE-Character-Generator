// =============================================================================
// js/ui/tracker/minds.js
// TRACKER / MINDS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: the Mind's Ledger panel.
//
// KEY NAMES (so you can search for them)
//   functions (14): mindSet, mindPerToggle, mindPer, mindOutcome,
//   mindLastDismiss, mindFacedCycle, mindFacedRemove, mindBreak, mindSwoon,
//   mindDailyRecovery, mindBout, mindInsAdj, renderMindsLedger,
//   mindHPBoutCheck
//
// WHERE IT CAME FROM
//   Gathered from js/app/65-tracker-logs-and-damage.js, js/rules/10-minds-
//   ledger-and-magic-browser.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function mindSet(field, val) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.calc[field] = (field === 'maim') ? !!val : val;
  save(); renderMindsLedger(c);
}
// v8.46.4 (Adam): the perceived-Scale steppers live one click deep — the
// ⚙ chip in the calculator row toggles them. The VALUE for the chosen axis
// stays on the surface (load-bearing input to the DC; the v8.41.0 law:
// hover may hold explanations, never decisions).
function mindPerToggle() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.perOpen = !m.perOpen;
  save(); renderMindsLedger(c);
}
function mindPer(axis, d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  m.per[axis] = Math.max(0, Math.min(6, (m.per[axis] || 0) + d));
  logAct(`🧠 Perceived ${axis} Scale is now ${m.per[axis]} (the ratchet turns).`);
  save(); renderMindsLedger(c);
}
function mindOutcome(kind) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), pk = mindPackage(c);
  const nm = (m.calc.name || '').trim();
  // v8.46.1 (Adam's field report): each outcome RESOLVES the event — the
  // result is frozen into a persistent aftermath strip (m.last), and the
  // calculator inputs reset so a stale event can't linger and mutate (the
  // post-break insanity +1 was retroactively appearing in the very event
  // that caused the break).
  if (kind === 'save') {
    if (nm) { m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'inured' }); }
    m.last = { kind: 'save', nm, dc: pk.dc };
    logAct(`🧠 Horror save MADE${nm ? ` vs ${nm}` : ''} (DC ${pk.dc}) — inured: no further saves vs that (type of) Horror.`);
  } else if (kind === 'fail') {
    const dmg = pk.dice.reduce((s, e) => s + mindRoll1(e), 0) + pk.flat;
    if (nm && !(pk.faced && pk.faced.s !== 'plus4')) {
      m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'plus4' });
    }
    // v8.49.0: the damage lands in the POOL, assigned to the lowest CURRENT
    // mental attribute (base minus existing pool damage; ties random, per
    // the printed rule). The clock runs on base scores; the half-floor
    // clamp in effAttrs handles the played value automatically.
    const names = ['Int', 'Wis', 'Cha'];
    const base = names.map((_, k) => (c.attrs || [10,10,10,10,10,10])[3 + k] || 10);
    const cur = base.map((b, k) => b - (m.mdmg[k] || 0));
    let k0 = 0; for (let k = 1; k < 3; k++) if (cur[k] < cur[k0]) k0 = k;
    const ties = [0, 1, 2].filter(k => cur[k] === cur[k0]);
    const kp = ties[Math.floor(Math.random() * ties.length)];
    m.mdmg[kp] = (m.mdmg[kp] || 0) + dmg;
    const after = cur[kp] - dmg;
    const plays = Math.max(base[kp] - m.mdmg[kp], Math.ceil(base[kp] / 2));
    m.last = { kind: 'fail', nm, dc: pk.dc, dmg, dice: mindDiceText(pk), attr: names[kp], k: kp,
               before: cur[kp], after: Math.max(0, after), plays, zero: after <= 0 };
    logAct(`🧠 Horror save FAILED${nm ? ` vs ${nm}` : ''} (DC ${pk.dc}) — ${dmg} mental damage (${m.last.dice}) → ${names[kp]} (lowest mental): clock ${cur[kp]} → ${m.last.after}${m.last.zero ? ' — BREAKING POINT: Break or Swoon' : `, plays at ${plays} (half-floor)`}${nm ? '; +4 competence on future saves vs that (type of) Horror until a save is made or it is defeated' : ''}.`);
  } else if (kind === 'defeat') {
    if (nm) { m.faced = m.faced.filter(f => f.n.toLowerCase() !== nm.toLowerCase()); m.faced.push({ n: nm, s: 'immune' }); }
    m.last = { kind: 'defeat', nm };
    logAct(`🧠 Witnessed the defeat of ${nm || 'the Horror'} — no further Horror saves vs creatures of that type.`);
  }
  // The event has run its course: clear the inputs (axis kept; the named
  // Horror lives on as a registry chip, not as a stale calculation).
  m.calc.ev = ''; m.calc.hl = ''; m.calc.size = 'na'; m.calc.maim = false; m.calc.name = '';
  save(); renderSheet();  // v8.49.0: the pool moves effAttrs — full refresh
}
function mindLastDismiss() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  mindOf(c).last = null; save(); renderMindsLedger(c);
}
function mindFacedCycle(i) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), f = m.faced[i]; if (!f) return;
  f.s = f.s === 'plus4' ? 'inured' : f.s === 'inured' ? 'immune' : 'plus4';
  save(); renderMindsLedger(c);
}
function mindFacedRemove(i) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  mindOf(c).faced.splice(i, 1); save(); renderMindsLedger(c);
}
function mindBreak() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  const k = mindZeroAttr(c, m), names = ['Int', 'Wis', 'Cha'];
  m.mdmg[k] = 0;  // the break relieves the pressure: the attribute refreshes in full
  m.ins += 1; m.tier = mindTier(m);
  logAct(`🧠 THE BREAK: an insanity manifests (${m.ins} total; now ${MIND_TIERS[m.tier][0]}) — ${names[k]} refreshes in full as the mental break relieves the pressure.`);
  m.last = null;  // v8.46.1: the aftermath prompt is consumed by the choice
  save(); renderSheet();
}
function mindSwoon() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  if (m.swoonLock) { toast('😵 No second swoon — the valve works once per full recovery. The Break is the only road now.'); return; }
  const k = mindZeroAttr(c, m), names = ['Int', 'Wis', 'Cha'];
  const base = (c.attrs || [10,10,10,10,10,10])[3 + k] || 10;
  m.mdmg[k] = Math.floor(base / 2);  // wakes at half normal, rounded up
  m.swoonLock = true;
  m.last = null;
  const ea = effAttrs(c);
  const best = Math.max(am(ea[3]), am(ea[4]), am(ea[5]));
  const mins = Math.max(1, 10 - best);
  logAct(`🧠 THE SWOON (awe only): unconscious ${mins} min (ally may rouse, standard action); wakes with ${names[k]} at ${Math.max(1, Math.ceil(base / 2))} (half of ${base}, round up), no insanity; cannot swoon again until fully recovered (1/day).`);
  toast(`😵 The Swoon — ${mins} minutes down; wakes at ${names[k]} ${Math.max(1, Math.ceil(base / 2))}.`);
  save(); renderSheet();
}
// One day of natural recovery: 1 point per day per damaged ability (HH);
// the Full Rest button applies it too. The swoon valve re-arms at zero.
function mindDailyRecovery(cArg, quiet) {
  const c = cArg || chars.find(x => x.id === curId); if (!c || !c.mind) return;
  const m = mindOf(c);
  if (!m.mdmg.some(d => d > 0)) return;
  m.mdmg = m.mdmg.map(d => Math.max(0, (d || 0) - 1));
  if (!m.mdmg.some(d => d > 0)) {
    m.swoonLock = false;
    if (!quiet) logAct('🧠 Mental damage fully healed — the mind is whole (the swoon valve re-arms).');
  }
  if (!quiet) logAct(`🌙 A day of recovery: mental damage now Int ${m.mdmg[0]} / Wis ${m.mdmg[1]} / Cha ${m.mdmg[2]}.`);
  save(); if (c.id === curId) renderSheet();
}
function mindBout() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c), tier = mindTier(m);
  if (!tier) { toast('No insanity tier — no bouts.'); return; }
  const ea = effAttrs(c);
  const best = Math.max(am(ea[3]), am(ea[4]), am(ea[5]));
  const dc = tier >= 2 ? 20 : 15, dur = Math.max(1, (tier >= 2 ? 20 : 10) - best);
  const trig = tier === 1 ? '≤25% HP' : tier === 2 ? '≤50% HP or a failed Will save in combat' : 'ALWAYS under the effect';
  logAct(`🧠 Bout of insanity check: Will DC ${dc} or a ${dur}-round bout (as the Insanity spell, HH). Trigger at this tier: ${trig}.`);
  save(); renderMindsLedger(c);
}
function mindInsAdj(d) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const m = mindOf(c);
  const was = mindTier(m);
  m.ins = Math.max(0, m.ins + d);
  m.tier = mindTier(m);  // tier derives from the count — one source of truth
  if (m.tier !== was) logAct(`🧠 Sanity ${d > 0 ? 'degrades' : 'improves'}: ${m.ins} insanit${m.ins === 1 ? 'y' : 'ies'} — now ${MIND_TIERS[m.tier][0]}.`);
  save(); renderMindsLedger(c);
}
function renderMindsLedger(c) {
  const slot = document.getElementById('sh-minds');
  if (!slot) return;
  if (!c) { slot.style.display = 'none'; return; }
  const m = mindOf(c), pk = mindPackage(c);
  // v8.46.2 (Adam): tri-state collapse — m.open === false COLLAPSES even a
  // ledger with live state (the old inUse check overrode the ▴, so any
  // character with a chip or an insanity was stuck expanded). The collapsed
  // banner carries the character's current sanity status.
  const inUse = m.faced.length || m.ins || m.tier || m.calc.ev !== '' || m.calc.hl !== '' || m.calc.size !== 'na' || m.calc.maim || (m.calc.name || '') !== '';
  const expanded = m.open === true || (inUse && m.open !== false);
  if (!expanded) {
    const tier = mindTier(m);
    slot.style.display = 'block';
    slot.innerHTML = `<span style="font-size:11.5px;color:var(--ts80);cursor:pointer;" onclick="(function(){const c=chars.find(x=>x.id===curId); if(c){mindOf(c).open=true; save(); renderMindsLedger(c);}})()" title="Horror saves & sanity — open the panel">🧠 ${escapeHTML(c.name)}'s Sanity: <b style="color:${tier ? '#d49a70' : 'var(--ts80)'};cursor:help;" title="${MIND_TIERS[tier][1]}">${MIND_TIERS[tier][0]}</b>${m.faced.length ? ` <span style="opacity:var(--o60);color:var(--dim);">· ${m.faced.length} faced</span>` : ''} ▸</span>`;
    return;
  }
  slot.style.display = 'block';
  const per = m.per, axes = ['arcane', 'divine', 'mutation', 'psionic', 'tech'];
  const axCap = (a) => a[0].toUpperCase() + a.slice(1);
  const stat = { plus4: ['+4', 'var(--g80)', 'failed a save: +4 competence on Horror saves vs it, until a save is made or it is defeated'],
                 inured: ['🛡', 'var(--pb90)', 'made a save: inured — no further saves vs that (type of) Horror'],
                 immune: ['✓', 'rgba(120,205,140,.9)', 'witnessed its defeat: no Horror saves vs creatures of that type'] };
  const facedNote = pk.faced
    ? (pk.faced.s === 'plus4' ? `<b style="color:var(--g90);">+4 competence applies</b> (prior failure vs ${escapeHTML(pk.faced.n)})`
       : pk.faced.s === 'inured' ? `<b style="color:rgba(120,175,205,.95);">inured</b> — no save needed vs ${escapeHTML(pk.faced.n)}`
       : `<b style="color:rgba(120,205,140,.95);">type-immune</b> — no save needed (${escapeHTML(pk.faced.n)} was defeated)`)
    : '';
  slot.innerHTML = `
  <div style="padding:7px 10px;background:rgba(14,18,26,.55);border:1px solid rgba(120,175,205,.28);border-radius:3px;font-size:11.5px;line-height:1.65;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <b style="color:#9cc3da;letter-spacing:.04em;">🧠 ${escapeHTML(c.name)}'s Sanity: <span style="color:${mindTier(m) ? '#d49a70' : '#9cc3da'};cursor:help;" title="${MIND_TIERS[mindTier(m)][1]}">${MIND_TIERS[mindTier(m)][0]}</span></b>
      <b style="cursor:pointer;color:var(--red-text);margin-left:8px;" onclick="(function(){const c=chars.find(x=>x.id===curId); if(c){mindOf(c).open=false; save(); renderMindsLedger(c);}})()" title="Collapse">▴</b>
    </div>
    <div style="font-size:10.5px;color:var(--ts60);" title="At most one row per category; categories stack; the insanity row stacks per insanity.">(Insanity and Horror rules, GMG pp.144-150; the Horror's Scale, Effective Level, Size, Gore Required for DC)</div>
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <div><span style="color:var(--ts75);">Horror Type:</span>
        <select onchange="mindSet('axis',this.value)" style="font-size:11px;">${axes.map(a => `<option value="${a}"${m.calc.axis === a ? ' selected' : ''}>${axCap(a)}</option>`).join('')}</select></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="The Scale of the witnessed power or creature on the chosen axis (a 1st-level spell ≈ Arcane Scale 1; god-tier manifestations = Scale 5+). The row computes against the witness's PERCEIVED Scale — what they believe reality allows: an event beyond a perceived Scale of 1+ adds +1 DC (1d2 damage); beyond a perceived Scale of 0 — no belief at all — adds +4 (1d4). Characters who KNOW they are in a Scale 5+ scenario are exempt. Belief ratchets upward as horror educates: after taking mental damage and recovering, the witness knows — adjust via the ⚙. Blank = no Scale row.">Horror's Scale</span> <input type="number" min="0" max="6" value="${m.calc.ev}" onchange="mindSet('ev',this.value)" style="width:54px;padding:2px 4px;font-size:11px;">
        <span style="cursor:pointer;font-size:10.5px;color:var(--ts65);" onclick="mindPerToggle()" title="What this character believes reality allows on each axis — the ratchet. Click to adjust all five.">(perceived ${per[m.calc.axis] || 0} ⚙)</span></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="How far beyond the witness's own power the being or effect stands: its level/CR (or the effect's caster level) versus this character's total level (${pk.lvl}) — as calculated, or as arbitrary as the GM desires. 1-3 levels higher: +2 DC, 1d3 damage · 4-6 higher: +4, 1d3+1 · 7-9 higher: +6, 1d4+1 · 10+ higher: +8, 2d3. At or below the witness's level: no modifier — power the mind can measure does not crack it. Blank = no Level row.">Horror's Effective Level (GM's discretion)</span> <input type="number" min="0" value="${m.calc.hl}" onchange="mindSet('hl',this.value)" style="width:62px;padding:2px 4px;font-size:11px;"></div>
      <div style="margin-top:3px;"><span style="cursor:help;border-bottom:1px dotted rgba(160,190,215,.5);" title="The Horror's size relative to the witness. Small horrors unsettle rather than shatter: 3+ / 2 categories smaller = −4 / −2 DC (1 damage); 1 smaller = +0 (1d2); same size = +2 (1d3); then each step larger climbs +4 / +6 / +8, to +10 DC (3d4) at 4+ categories larger — a Colossal Horror before a Medium witness. Choose 'no size row' for bodiless events: spells, powers, unseen manifestations.">Horror Size</span> <select onchange="mindSet('size',this.value)" style="font-size:11px;">${MIND_SIZE_ROWS.map(r => `<option value="${r.k}"${m.calc.size === r.k ? ' selected' : ''}>${r.lbl}</option>`).join('')}</select></div>
      <div style="margin-top:3px;"><label style="cursor:pointer;" title="The typical roll for witnessing a horrific, graphic scene — a maiming, a death, or an especially gory aspect of the Horror itself (GM's discretion): +5 DC, 1d3 damage."><input type="checkbox" ${m.calc.maim ? 'checked' : ''} onchange="mindSet('maim',this.checked)"> Maiming and/or Gore</label>
        · vs <input type="text" value="${escapeHTML(m.calc.name || '')}" onchange="mindSet('name',this.value)" placeholder="Horror name (registry)" style="width:130px;padding:2px 5px;font-size:11px;"></div>
    </div>
    ${m.perOpen ? `<div style="margin-top:4px;padding:3px 8px;border:1px dashed rgba(120,175,205,.25);border-radius:3px;">
      <span style="color:var(--ts75);" title="What this character BELIEVES reality allows, per axis. Horror DCs measure the gap vs belief, not fact — and belief ratchets upward as horrors educate (after damage + recovery, the witness knows).">Perceived Scales:</span>
      ${axes.map(a => `<span style="margin-left:8px;white-space:nowrap;">${a.slice(0, 3)} <b style="cursor:pointer;color:var(--red-text);" onclick="mindPer('${a}',-1)">−</b> <b style="color:#e8d9a0;">${per[a] || 0}</b> <b style="cursor:pointer;color:#7dc98c;" onclick="mindPer('${a}',1)">+</b></span>`).join('')}
      <span style="margin-left:10px;font-size:10px;color:var(--ts50);">(known 5+ on an axis = exempt from Scale modifiers)</span>
      <b style="cursor:pointer;color:var(--red-text);float:right;" onclick="mindPerToggle()" title="Close">▴</b>
    </div>` : ''}
    <div style="margin-top:5px;">
      ${pk.faced && pk.faced.s !== 'plus4'
        ? facedNote
        : `<b style="color:#e8d9a0;font-size:14px;">Will save DC ${pk.dc}</b> <span style="color:var(--ts60);font-size:10.5px;">(base 10${pk.rows.map(r => ` ${r.dc >= 0 ? '+' : ''}${r.dc} ${r.cat}`).join('')})</span>
           · mental damage on failure: <b style="color:#d49a70;">${mindDiceText(pk)}</b>
           <span style="margin-left:8px;white-space:nowrap;">
             <button onclick="mindOutcome('save')" style="font-size:10.5px;">Saved 🛡</button>
             <button onclick="mindOutcome('fail')" style="font-size:10.5px;">Failed 🎲</button>
             <button onclick="mindOutcome('defeat')" style="font-size:10.5px;">Defeated ✓</button>
           </span>`}
      ${pk.rows.length ? `<div style="font-size:10px;color:var(--ts50);margin-top:2px;">${pk.rows.map(r => `${r.cat}: ${escapeHTML(r.lbl)}`).join(' · ')}</div>` : ''}
    </div>
    ${m.last ? `<div style="margin-top:5px;padding:4px 8px;border:1px solid ${m.last.zero ? 'rgba(212,112,112,.6)' : 'rgba(120,175,205,.35)'};border-radius:3px;${m.last.zero ? 'background:rgba(212,112,112,.07);' : ''}font-size:11px;line-height:1.6;">
      <b style="cursor:pointer;color:var(--red-text);float:right;margin-left:8px;" onclick="mindLastDismiss()" title="Dismiss">✕</b>
      ${m.last.kind === 'fail'
        ? `🎲 <b>vs ${escapeHTML(m.last.nm || 'the Horror')}</b> (DC ${m.last.dc}): <b style="color:var(--red-text);">FAILED</b> — <b>${m.last.dmg}</b> mental damage (${escapeHTML(m.last.dice)}) → <b>${m.last.attr}</b> (lowest mental): clock ${m.last.before} → <b>${m.last.after}</b>. ${m.last.zero
            ? `<b style="color:var(--red-text);">THE MIND IS AT ITS BREAKING POINT</b> — resolve it below: ${m.swoonLock ? `the swoon valve is spent — <b>⚡ Break</b> is the only road.` : `<b>⚡ Break</b> (terror always breaks; facing awe, refusing to fall is allowed) or <b>😵 Swoon</b> (awe only).`}`
            : `Applied automatically — plays at <b>${m.last.plays}</b> (the half-floor: frayed, never below half until the break; heals 1/day).`}`
        : m.last.kind === 'save'
        ? `🛡 <b>vs ${escapeHTML(m.last.nm || 'the Horror')}</b> (DC ${m.last.dc}): <b style="color:#7dc98c;">SAVED</b> — inured: no further Horror saves vs that (type of) Horror.`
        : `✓ <b>${escapeHTML(m.last.nm || 'The Horror')}</b> witnessed defeated — type-immunity: no further Horror saves vs creatures of that type.`}
    </div>` : ''}
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <span style="color:var(--ts75);" title="Failed = +4 competence vs it until a made save or its defeat · Inured (made save) = no further saves vs that (type of) Horror · Type-immune (witnessed defeat). Click a chip to cycle; ✕ removes.">Faced Horrors:</span>
      ${m.faced.length ? m.faced.map((f, i) => `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 4px;padding:2px 7px;border:1px solid ${stat[f.s][1]};border-radius:3px;font-size:11px;cursor:pointer;" title="${stat[f.s][2]}" onclick="mindFacedCycle(${i})">${stat[f.s][0]} ${escapeHTML(f.n)} <b style="color:var(--red-text);" onclick="event.stopPropagation();mindFacedRemove(${i})">✕</b></span>`).join('')
        : `<span style="font-size:10.5px;color:var(--ts45);">none yet — name a Horror above and record the outcome</span>`}
    </div>
    <div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(120,175,205,.2);">
      <span style="color:var(--ts75);">Sanity:</span>
      insanities <b style="cursor:pointer;color:var(--red-text);" onclick="mindInsAdj(-1)" title="Remove an insanity (severity follows: Completely → Severely → Mildly Insane → sane). The usual road is counselling — 1/3/6 months by tier, Will DC 20/25/30, +1 per prior timeframe, a 48-hour disruption resets the clock — or high magic (Heal, Wish, Psychic Chirurgery…). Use at your GM's direction.">−</b> <b style="color:#e8d9a0;">${m.ins}</b> <b style="cursor:pointer;color:#7dc98c;" onclick="mindInsAdj(1)" title="At your GM's discretion, extraordinary circumstances may have compromised your character's mental state, degrading their mental health (severity follows: sane → Mildly → Severely → Completely Insane). Only use this button at your GM's direction — the usual road is ⚡ Break, when a mental attribute reaches 0.">+</b>
      · tier: <b style="color:${mindTier(m) ? '#d49a70' : 'var(--ts60)'};cursor:help;" title="${MIND_TIERS[mindTier(m)][1]}">${MIND_TIERS[mindTier(m)][0]}</b>
      <span style="margin-left:8px;white-space:nowrap;">
        <button onclick="mindBout()" style="font-size:10.5px;" title="Bout: Will DC 15 (Mild, at ≤25% HP) / DC 20 (Severe, at ≤50% HP or failed Will in combat); duration 10/20 − best mental mod rounds; Complete = always on">Bout check</button>
        <button onclick="mindBreak()" style="font-size:10.5px;${m.last && m.last.zero ? 'box-shadow:0 0 7px rgba(212,112,112,.85);' : ''}" title="TERROR at attribute 0 (or refusing to fall before awe): the insanity manifests, the attribute refreshes in full">⚡ Break</button>
        <button onclick="mindSwoon()" style="font-size:10.5px;${m.last && m.last.zero ? 'box-shadow:0 0 7px rgba(120,175,205,.85);' : ''}" title="AWE at attribute 0 only: faint — unconscious 10 − best mental mod minutes, wake at HALF the attribute (round up), no insanity; one swoon per full recovery">😵 Swoon</button>
      </span>
      ${m.mdmg.some(d => d > 0) ? `<div style="font-size:10.5px;color:var(--to85);margin-top:3px;">Mental damage: ${['Int', 'Wis', 'Cha'].map((n, k) => { const b = (c.attrs || [10,10,10,10,10,10])[3 + k] || 10; const d = m.mdmg[k] || 0; return d > 0 ? `${n} ${d} (clock ${Math.max(0, b - d)}/${b} · plays at ${Math.max(b - d, Math.ceil(b / 2))})` : null; }).filter(Boolean).join(' · ')}${m.swoonLock ? ' · <span style="opacity:.7;">swoon valve spent</span>' : ''}
        <button onclick="mindDailyRecovery()" style="font-size:10px;" title="One day of natural recovery: 1 point per day per damaged ability (Full Rest applies this too); magical restoration heals it like any ability damage. The swoon valve re-arms at full recovery.">🌙 +1 day</button></div>` : ''}
    </div>
  </div>`;
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
