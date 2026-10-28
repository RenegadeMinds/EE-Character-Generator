// =============================================================================
// js/ui/powers/buffs.js
// POWERS / BUFFS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Active power effects on the page: toggling and
//   dismissing buffs.
//
// KEY NAMES (so you can search for them)
//   functions (4): toggleBuffSuper, applyWiredBuff, dismissBuffAt,
//   renderActiveBuffs
//
// WHERE IT CAME FROM
//   Gathered from js/rules/09-item-effects-and-buffs.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function toggleBuffSuper(name) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const p = (c.powers || []).find(x => x.pool === 'super' && x.name === name);
  if (!p) return;
  p.buffOff = !p.buffOff;
  logAct(`◉ ${name} ${p.buffOff ? 'voluntarily suppressed (⏻)' : 'reactivated — no PP, the power is always manifested'}.`);
  save(); renderSheet();
}

// Cast-time hook (called from castPowerAt's finish). Computes the augment
// increment from the actual PP spend; re-manifesting refreshes the record.
// v8.44.0: `augPicks` (from the option-aware cast dialog) carries the exact
// per-option split — bonus purchases scale the effect, duration purchases
// land on the chip, flags ride as notes. The generic every/at math remains
// the fallback for single-option powers and direct calls.
function applyWiredBuff(c, spellName, pool, extraPP, augPicks) {
  const spec = POWER_EFFECTS[spellName];
  if (!spec) return false;
  // v8.43.0: Animal Affinity's chosen-ability flow — one pick, +1 more per
  // 5 augment PP (each a DIFFERENT ability, per the printed Augment).
  if (spec.attrChoice) {
    const picks = 1 + (spec.aug && spec.aug.every ? Math.floor((extraPP || 0) / spec.aug.every) : 0);
    const chosen = [];
    const askNext = () => {
      const remaining = ATTR_NAMES.filter(a => !chosen.includes(a));
      openChoiceModal(`${spellName} — choose ability ${chosen.length + 1} of ${picks} (+4 enhancement)`, remaining, (sel) => {
        chosen.push(sel);
        if (chosen.length < picks) { askNext(); return; }
        if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
        c.activeEffects = c.activeEffects.filter(x => x.name !== spellName);
        c.activeEffects.push({ id: 'ae-' + Date.now().toString(36), name: spellName, pool: pool,
          effects: chosen.map(a => ({k: 'attr', attr: a, type: 'enhancement', v: 4})),
          note: spec.note || '', expires: spec.expires || 'rest',
          appliedAt: new Date().toLocaleString(), augSpent: extraPP || 0 });
        toast(`✨ ${spellName} wired: +4 enhancement to ${chosen.join(', ')} — active until rest or ✕.`);
        save();
        renderActiveBuffs(c);
      });
    };
    askNext();
    return true;
  }
  let inc = 0, extraRounds = 0, durOverride = null;
  const pickBits = [];
  const optDefs = (AUGMENT_OPTIONS[spellName]) || null;
  if (optDefs && augPicks) {
    // exact declared split — no estimation.
    for (const o of optDefs) {
      const n = augPicks[o.id] || 0;
      if (!n) continue;
      if (o.kind === 'bonus') inc += n * ((spec.aug && spec.aug.inc) || 1);
      else if (o.kind === 'duration') extraRounds += n * (o.rounds || 1);
      else if (o.kind === 'flag') { pickBits.push(o.label); if (o.durOverride) durOverride = o.durOverride; }
    }
  } else if (spec.aug) {
    if (spec.aug.every) inc = Math.floor((extraPP || 0) / spec.aug.every) * (spec.aug.inc || 1);
    else if (spec.aug.at) inc = (extraPP || 0) >= spec.aug.at ? (spec.aug.inc || 1) : 0;
  }
  const effects = spec.eff.map(e => {
    let v = e.v + (e.scale ? inc : 0);
    if (spec.aug && spec.aug.cap) v = Math.min(v, spec.aug.cap);
    return {...e, v};
  });
  // v8.44.0: human duration on the chip (printed duration × pool level at
  // cast + purchased rounds; flag overrides like Metaphysical Claw's
  // 1 hour/level honored).
  let durText = '';
  try {
    const spellObj = SPELLS_DB.find(s => s.name === spellName);
    durText = buffDurationText(durOverride ? {duration: durOverride} : spellObj, pool, c, extraRounds);
  } catch (e) {}
  if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
  c.activeEffects = c.activeEffects.filter(a => a.name !== spellName);
  c.activeEffects.push({ id: 'ae-' + Date.now().toString(36), name: spellName, pool: pool,
    effects, note: spec.note || '', expires: spec.expires || 'rest',
    appliedAt: new Date().toLocaleString(), augSpent: extraPP || 0,
    durText, picks: pickBits.length ? pickBits : undefined });
  toast(`✨ ${spellName} is now wired to the sheet${inc ? ` (augmented: +${inc})` : ''}${durText ? ` — ${durText}` : ''} — active until rest or ✕ on the Sheet.`);
  return true;
}
function dismissBuffAt(i) {
  const c = chars.find(x => x.id === curId);
  if (!c || !Array.isArray(c.activeEffects)) return;
  const a = c.activeEffects.splice(i, 1)[0];
  if (a) logAct(`✨ ${a.name} effect ended (dismissed).`);
  if (a && a.bane) boostBaneRoll(c);   // v9.2.0: Boost → the Bane roll
  if (a && a.gearItemId) { renderGear(); renderSkills(); }
  save(); renderSheet();
}
function renderActiveBuffs(c) {
  const slot = document.getElementById('sh-buffs');
  if (!slot) return;
  const list = (c && c.activeEffects) || [];
  const perps = perpetualBuffs(c);
  const worn = wornGearOf(c);
  if (!list.length && !perps.length && !worn.length) { slot.innerHTML = ''; slot.style.display = 'none'; return; }
  slot.style.display = 'block';
  const fmt = (e) => {
    if (e.k === 'dr') return `DR ${e.v}/${e.bypass || '—'}`;   // v8.86.0
    if (e.k === 'resist') return `resist ${e.energy || 'energy'} ${e.v}`;   // v9.2.0 gear kinds
    if (e.k === 'fly') return `fly ${e.v} ft${e.note ? ' (' + e.note + ')' : ''}`;
    if (e.k === 'speed') return `+${e.v} ft speed`;
    if (e.k === 'immune') return `immune: ${e.what}`;
    if (e.k === 'note') return e.text;
    if (e.cond) return `${e.v >= 0 ? '+' : ''}${e.v} ${e.type} ${e.k === 'save' ? e.save.toUpperCase() : e.k} (${e.cond})`;
    const tgt = e.k === 'save' ? (e.save === 'all' ? 'all saves' : e.save.toUpperCase() + ' save')
      : e.k === 'skill' ? e.skill : e.k === 'nac' ? 'natural AC' : e.k === 'ac' ? 'AC'
      : e.k === 'attr' ? e.attr : e.k;
    return `${e.v >= 0 ? '+' : ''}${e.v} ${e.type} ${tgt}`;
  };
  // v8.85.0: ◉ perpetual chips lead — gold-edged, with the ⏻ suppression
  // toggle (reactivation free per the ruling). Suppressed = dimmed ◌;
  // superseded = the invoked transient outranks the base until rest.
  const perpChip = (pb) => {
    const off = pb.suppressed, dim = off || c.nullified;
    const crunch = pb.effects.length ? pb.effects.map(fmt).join(', ') : '';
    const tip = (pb.note ? pb.note + ' · ' : '') + (off ? 'voluntarily suppressed — ⏻ reactivates at no PP ("always manifested")' : 'perpetual Buff — bought with MP, always manifested at base values (ESL); invoke it (0 PP + augment) for a boosted casting') + (pb.superseded && !off ? ' · an invoked casting currently supersedes the standing base' : '');
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid rgba(200,151,30,.45);border-radius:3px;background:rgba(200,151,30,.08);font-size:11px;${dim ? 'opacity:.45;' : ''}" title="${escapeHTML(tip)}">${off ? '◌' : '◉'} <b>${escapeHTML(pb.name)}</b>${pb.rung ? ` <span class="c-vio">[${escapeHTML(pb.rung)}]</span>` : ''}${crunch && !off ? ` ${escapeHTML(crunch)}` : ''}${off ? ' <span class="italic c-g70">suppressed</span>' : pb.superseded ? ' <span class="italic" style="color:#9cc3da;">· invoked version active</span>' : ''} <b style="cursor:pointer;color:${off ? '#8fcf9a' : '#d4b870'};" data-n="${escapeHTML(pb.name)}" onclick="toggleBuffSuper(this.dataset.n)" title="${off ? 'Reactivate (no PP)' : 'Voluntarily suppress this power'}">⏻</b></span>`;
  };
  slot.innerHTML = (c.nullified ? `<div class="fs-11 c-vio mb-3">⊘ Null Power Field — active-power bonuses SUPPRESSED (shown greyed):</div>` : '')
    + perps.map(perpChip).join('')
    + worn.map(it => { const w = gearDef(it).worn; const bits = [w.carry ? `+${w.carry} Str (carrying)` : '', w.sense || '', ...(w.immune || []).map(x => 'immune: ' + x), ...(w.grants || []).map(g => `${g.v >= 0 ? '+' : ''}${g.v} ${g.t.replace('skill:', '')}`)].filter(Boolean); return `<span class="items-center gap-6 p-3-8 fs-11" style="display:inline-flex;margin:2px 6px 2px 0;border:1px solid rgba(160,150,120,.4);border-radius:3px;background:rgba(160,150,120,.06);" title="Worn gear — remove it on the Gear tab.">🎒 <b>${escapeHTML(it.ref)}</b> ${escapeHTML(bits.join(', '))}</span>`; }).join('')
    + list.map((a, i) => `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid ${a.gear ? 'rgba(140,200,150,.45)' : 'rgba(120,175,205,.4)'};border-radius:3px;background:${a.gear ? 'rgba(140,200,150,.07)' : 'rgba(120,175,205,.07)'};font-size:11px;${c.nullified && !a.gear ? 'opacity:.4;' : ''}" title="${escapeHTML(((a.picks && a.picks.length) ? a.picks.join(' · ') + ' · ' : '') + (a.note || '') + (a.gear ? ' · gear Boon (technology — stands in a Null Power Field) · ✕ to end' : (a.expires === 'manual' ? ' · brief duration — dismiss manually (✕)' : ' · clears on rest')))}">${a.gear ? (a.name === BOOST_BANE ? '☠' : '⚡') : '✨'} <b>${escapeHTML(a.name)}</b> ${escapeHTML(a.effects.map(fmt).join(', '))}${a.durText ? ` <span style="color:#9cc3da;">· ${escapeHTML(a.durText)}</span>` : ''}${a.augSpent ? ` <span class="o-60 c-dim">(+${a.augSpent} PP)</span>` : ''} <b class="cursor-pointer c-red-text" onclick="dismissBuffAt(${i})" title="End this effect">✕</b></span>`).join('');
}

