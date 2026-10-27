// =============================================================================
// js/app/64-tracker.js
// TRACKER
// =============================================================================
//
// WHAT'S IN HERE
//   The Tracker page: HP and power-point bars, HP mode, Action Points, talent
//   action cards, bardic music, conditions, and the Hero's Gift panel.
//
// KEY NAMES (so you can search for them)
//   functions (27): renderTracker, renderPPRecovery, renderHPBar,
//   toggleHpModePanel, renderSheetHpModePanel, changeSheetHpMode,
//   rerollSheetHp, applyHpModeChangeToChar, renderAPBar,
//   warmindBattleFocusMod, renderBattleFocus, toggleBattleFocus,
//   expendBattleFocus, toggleAPOpt, renderXPBar, renderTalentActions,
//   renderCombatOptions, renderBardicMusic, renderElementalist, renderConds,
//   populateConditionDropdown, renderHerosGiftPanel, assignHerosGiftAsFeat,
//   assignHerosGiftAsTalent, renderSheetConditionBanner, renderLog, logAct
//
// LOAD ORDER
//   File 64 of 68. index.html loads it after js/app/63-modals.js and before
//   js/app/65-tracker-logs-and-damage.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 52395-53227 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 52395-53227; unchanged below this line ----
// ========== TRACKER ==========
function renderTracker(){
  const prompt=document.getElementById('tr-prompt'),cont=document.getElementById('tr-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=chars.find(x=>x.id===curId);if(!c){prompt.style.display='block';cont.style.display='none';return;}
  if(reconcileMissingHP(c)){save();toast(`HP auto-assigned (${c.maxHP} — average Hit Dice); GM may override via ⚙ HP Mode.`);}  // v8.6.0 C5
  prompt.style.display='none';cont.style.display='block';
  document.getElementById('tr-nm').textContent=c.name+' — Combat Tracker';
  renderHPBar(c);renderAPBar(c);renderPPRecovery(c);renderPerDiem(c);renderArmorIntegrity(c);renderXPBar(c);renderConds(c);renderTalentActions(c);renderCombatOptions(c);renderBardicMusic(c);renderElementalist(c);renderLog(c);
  // v8.3.27: action log panel renders alongside the free-text session journal.
  renderActionLog(c);
}
// v8.5.4 ergo C4: Tracker PP-recovery panel — per-pool current/max chips
// (EAL/EDL/EPL/ESL labeled) + prepared-list counts. PP ONLY, per Adam's
// ruling: HP stays manual, AP stay level-up-only.
function renderPPRecovery(c){
  const panel = document.getElementById('tr-pp-panel');
  const host = document.getElementById('tr-pp');
  if (!panel || !host) return;
  const stats = computeCasterStats(c);
  const mpSt = getMPState(c);
  const bits = [];
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = stats[poolName];
    if (!pool || !pool.contributors.length) continue;
    const pp = getPoolPPState(c, poolName);
    const eff = POOL_EFF_LEVEL[poolName];
    const low = pp.max > 0 && pp.current / pp.max <= 0.33;
    let prepBit = '';
    const slots = c.preparedSlots && c.preparedSlots[poolName];
    if (slots) {
      let qty = 0, cast = 0;
      for (const key in slots) for (const r of slots[key]) { qty += r.qty || 0; cast += r.cast || 0; }
      if (qty) prepBit = ` · <span title="prepared instances remaining today">${qty - cast}/${qty} prepared</span>`;
    }
    const permBit = pp.permanentSpent ? ` <span style="opacity:.55;font-size:10px;cursor:help;" title="Permanently expended on High Arcana / Mental Mastery picks — the pool maximum shown is already reduced.">(−${pp.permanentSpent} permanent)</span>` : '';
    bits.push(`<div style="font-size:12px;margin:3px 0;"><span title="${eff.full}" style="cursor:help;color:var(--g75);">${eff.abbr} ${pool.cl}</span> · ${poolName}: <b style="color:${low ? 'var(--red-text)' : 'rgba(120,175,205,.95)'};">${pp.current}</b>/${pp.max} PP${permBit}${prepBit}</div>`);
  }
  if (mpSt.isSuperMutant) {
    const spp = getSuperPPState(c);
    bits.push(`<div style="font-size:12px;margin:3px 0;"><span title="Effective Super Level" style="cursor:help;color:var(--tv80);">ESL ${mpSt.eml}</span> · super: <b style="color:rgba(196,153,212,.95);">${spp.current}</b>/${spp.max} PP</div>`);
  }
  // v8.21.0 Segment A: the psionic-focus chip joins the PP panel.
  { const chip = psiFocusChipHTML(c); if (chip) bits.push(chip); }
  if (!bits.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  host.innerHTML = bits.join('');
}

function renderHPBar(c){
  renderNLLine(c);  // v8.48.0: the nonlethal tally rides every HP refresh
  renderAttrDmg(c); // v8.50.0: as does the attribute-damage row
  const pct=Math.max(0,Math.min(100,Math.round((c.currentHP/c.maxHP)*100)));
  const col=pct>66?'bar-green':pct>33?'bar-amber':'bar-red';
  // v8.2.3 (Issue A): show the HP mode as a small subtitle so the player
  // sees which mode their HP was generated under.
  const mode = c.hpMode || 'hero';
  const modeLabel = {hero:"Hero's Hit Die", random:'Random', max:'Maximum'}[mode] || mode;
  const hasRolls = Array.isArray(c.hpRolls) && c.hpRolls.length > 0;
  const legacyTag = hasRolls ? '' : ' <span style="color:#d4b870;" title="This character was created before v8.2.3 and uses the legacy HP formula. Open the HP Mode panel to regenerate.">(legacy)</span>';
  // v8.6.0 C5: self-healed HP wears its flag until the GM re-rolls.
  const autoTag = c.hpAutoAssigned ? ` <span style="color:#7daadc;cursor:help;" title="HP was missing from this record and auto-assigned on ${escapeHTML(c.hpAutoAssigned.atDate||'')} (${escapeHTML(c.hpAutoAssigned.how||'average')}). GM may override via ⚙ HP Mode — re-rolling clears this flag.">(auto-assigned)</span>` : '';
  document.getElementById('tr-hp-bar').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);">HP <span style="color:var(--g45);font-size:9px;font-weight:normal;text-transform:none;letter-spacing:0;font-family:'Epics Serif','Crimson Pro',serif;">· ${escapeHTML(modeLabel)}${legacyTag}${autoTag}</span></span>
      <span class="hp-nums">${c.currentHP} / ${c.maxHP}</span>
    </div>
    <div class="bar-wrap"><div class="bar-fill ${col}" style="width:${pct}%;"></div></div>
    <div style="font-family:'Epics Serif','Cinzel',serif;font-size:9px;text-align:center;color:var(--g50);margin-top:3px;">${pct}% · ${c.currentHP<=0?'DISABLED/DYING':pct<=25?'Critical':pct<=50?'Wounded':'Healthy'}</div>`;
  // v8.6.0 (Adam's Scaly Armor question): natural hardness belongs where the
  // damage lands — the Tracker's HP panel. Full aggregation (racial + talent
  // + mutation + equipped-item NAC), with the application rule on hover.
  const natH = computeNaturalAC(c).total || 0;
  if (natH > 0) {
    document.getElementById('tr-hp-bar').innerHTML +=
      `<div style="font-size:10px;text-align:center;color:var(--tv85);margin-top:3px;cursor:help;" title="Per HH p.347 / GG p.110: every damaging hit that reaches the body ignores the first ${natH} points of damage. Applies to physical and naturally-occurring damage — but NOT acid, and null-energy attacks ignore hardness entirely. Attacks at or above the NatCrit tier bypass it.">🛡 Natural Hardness ${natH} — first ${natH} damage of each hit ignored</div>`;
  }
}

// v8.2.3 (Issue A): Sheet-side HP mode controls. Toggle reveals an inline
// panel with radio buttons for the three modes and a re-roll button. Legacy
// characters get a "legacy" indicator and a one-click migration path.
function toggleHpModePanel() {
  const panel = document.getElementById('tr-hp-mode-panel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderSheetHpModePanel();
  } else {
    panel.style.display = 'none';
  }
}

function renderSheetHpModePanel() {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const current = c.hpMode || 'hero';
  const radios = document.getElementById('tr-hp-mode-radios');
  const note = document.getElementById('tr-hp-mode-note');
  const detail = document.getElementById('tr-hp-roll-detail');
  if (!radios) return;
  const opts = [
    {v:'hero', label:"Hero's Hit Die (default)"},
    {v:'random', label:'Random'},
    {v:'max', label:'Maximum'},
  ];
  radios.innerHTML = opts.map(o => `
    <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
      <input type="radio" name="tr-hp-mode" value="${o.v}" ${o.v===current?'checked':''} onchange="changeSheetHpMode('${o.v}')"> ${o.label}
    </label>
  `).join('');
  const hasRolls = Array.isArray(c.hpRolls) && c.hpRolls.length > 0;
  if (note) {
    if (!hasRolls) {
      note.innerHTML = '<b style="color:#d4b870;">Legacy character.</b> Click Re-roll HP to migrate to per-level rolls under the current mode.';
    } else {
      note.textContent = 'Changing mode or re-rolling will recompute Max HP. Current HP scales to match.';
    }
  }
  // Per-level roll detail
  if (detail) {
    if (!hasRolls) {
      detail.innerHTML = '<i>No per-level rolls recorded (legacy character).</i>';
    } else {
      const tags = [];
      let rollIdx = 0;
      const arr = (c.classes && c.classes.length) ? c.classes : migrateLegacyClasses(c);
      for (const e of arr) {
        const cls = getClassEntry(e);
        if (!cls) continue;
        const lvl = Math.max(0, e.level || 0);
        for (let j = 0; j < lvl; j++) {
          if (rollIdx < c.hpRolls.length) {
            const isFirst = (rollIdx === 0);
            tags.push(`${e.name} L${j+1}: ${c.hpRolls[rollIdx]}${isFirst?' (max)':''}/d${cls.hd}`);
          }
          rollIdx++;
        }
      }
      detail.innerHTML = '<b>Per-level rolls:</b> ' + tags.join(' &middot; ');
    }
  }
}

async function changeSheetHpMode(newMode) {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!(await confirmModal(`Change HP mode to "${newMode}"?\n\nMax HP will be recomputed using new per-level rolls. Current HP will scale proportionally to keep the wound percentage the same.`))) {
    // Revert radio
    renderSheetHpModePanel();
    return;
  }
  applyHpModeChangeToChar(c, newMode);
  toast('HP mode changed to ' + newMode + '.');
}

async function rerollSheetHp() {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const mode = c.hpMode || 'hero';
  if (!(await confirmModal(`Re-roll HP under "${mode}" mode?\n\nMax HP will be recomputed using fresh per-level rolls. Current HP will scale proportionally to keep the wound percentage the same.`))) return;
  applyHpModeChangeToChar(c, mode);
  delete c.hpAutoAssigned;  // v8.6.0 C5: GM has now set HP deliberately
  save();
  toast('HP re-rolled.');
}

// v8.2.3: Apply an HP mode change (or re-roll) to a saved character.
// Recomputes c.hpRolls fresh for the chosen mode. Scales c.currentHP so the
// wound percentage stays constant — this is the kindest UX for a player who
// re-rolls mid-session.
function applyHpModeChangeToChar(c, newMode) {
  const conM = am(c.attrs[2]);
  const classArr = (c.classes && c.classes.length) ? c.classes : migrateLegacyClasses(c);
  const oldMaxHP = c.maxHP || 1;
  const oldRatio = (c.currentHP || 0) / oldMaxHP;
  c.hpMode = newMode;
  c.hpRolls = generateHpRolls(classArr, newMode);
  // v8.3.5: use source-aware effective NAC (which handles same-type stacking).
  // For characters with no naturalACSources, this falls back to the legacy
  // c.naturalAC scalar via computeNaturalAC's synthesis.
  const effectiveNAC = computeNaturalAC(c).total;
  const newMaxHP = computeMaxHPFromRolls(classArr, c.hpRolls, conM) + (effectiveNAC * 5);
  c.maxHP = newMaxHP;
  c.currentHP = Math.max(0, Math.min(newMaxHP, Math.round(oldRatio * newMaxHP)));
  save();
  renderHPBar(c);
  renderSheetHpModePanel();
  renderSheet(); // refresh derived stats / drilldowns
}
// v8.3.19: AP bar with full Heroic-Level-aware UI.
//
// Layout:
//   Heroic Scale summary line: "Heroic 3 — Heroic Agency · 2 AP/round"
//     (with FP counter when applicable, e.g. "· 2 FP spent")
//   AP / max display (existing)
//   AP bar fill (existing)
//   Three collapsible option sections (collapsed by default):
//     ▶ Action Point Options       (Heroic 1+)
//     ▶ Heroic Action Point Options (Heroic 2+, Hero class)
//     ▶ Fate Point Options          (Heroic 5+, Hero class)
//   The Heroic 0 case shows a single explanatory line in place of the bar.
function renderAPBar(c){
  const cap = getHeroicCapabilities(c);
  const apDice = getAPDice(c.totalLvl||1);
  const fpSpent = c.fatePoints || 0;

  // Heroic 0: AP unavailable. Show explanatory text in place of the bar.
  if (cap.heroicLevel === 0) {
    document.getElementById('tr-ap').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);">Action Points</span>
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:14px;font-weight:600;color:var(--g45);font-style:italic;">— Unavailable —</span>
      </div>
      <div style="font-size:11px;color:var(--g55);line-height:1.5;padding:8px 10px;background:rgba(0,0,0,.2);border-left:2px solid rgba(200,151,30,.3);border-radius:2px;">
        <b style="color:#d4b870;">Heroic 0 — ${escapeHTML(cap.heroicLevelName)}.</b>
        No Action Points, Heroic Action Points, or Fate Points are available in this scenario.
        Feats or class abilities that normally require AP become usable 1/day instead.
        Talents are treated as General feats with an attribute prerequisite.
      </div>`;
    renderBattleFocus(c); // v8.5.4: Battle Focus is independent of the Heroic Scale
    return;
  }

  const pct = c.apMax>0 ? Math.round((c.ap/c.apMax)*100) : 0;
  // Heroic Scale summary line — informational, including AP-per-round limit
  // and (when applicable) the FP-spent counter.
  let fpIndicator = '';
  if (cap.hasFP || fpSpent > 0) {
    fpIndicator = ` &middot; <span style="color:var(--red-text);" title="Fate Points are permanent AP expenditures. Each FP reduces your max AP pool by 1 at every future level-up.">${fpSpent} FP spent</span>`;
  }
  const heroicCaption = `
    <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g65);margin-bottom:4px;letter-spacing:.03em;">
      Heroic ${cap.heroicLevel} &mdash; ${escapeHTML(cap.heroicLevelName)} &middot; ${escapeHTML(cap.apPerRound)} &middot; rolls ${apDice}${fpIndicator}
    </div>`;

  // Three collapsible option sections — each starts collapsed; the toggle
  // state is held in window._apOptToggle (transient per-page-load state).
  if (!window._apOptToggle) window._apOptToggle = {ap:false, hap:false, fp:false};
  const tog = window._apOptToggle;
  const optSection = (key, title, items, available, gateMsg) => {
    if (!available) {
      return `<div style="margin-top:6px;font-size:10px;color:var(--g35);font-style:italic;padding:4px 8px;">${title} &mdash; ${gateMsg}</div>`;
    }
    const arrow = tog[key] ? '▼' : '▶';
    const itemsHTML = tog[key] ? items.map(it => {
      // v8.3.21: support an optional pre-built HTML annotation that's
      // prepended to the (escaped) description. This is used by class-
      // specific FP options to show Talent-ownership status. The annotation
      // HTML is trusted (built locally from controlled values); the
      // description proper is always escaped.
      const annot = it.annotationHTML ? `${it.annotationHTML} ` : '';
      return `<div style="margin:6px 0;padding:6px 9px;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.3);border-radius:2px;">
         <div style="font-weight:600;color:var(--gold);font-size:11px;margin-bottom:2px;">${escapeHTML(it.name)}</div>
         <div style="font-size:10.5px;color:var(--g75);line-height:1.45;">${annot}${escapeHTML(it.desc)}</div>
       </div>`;
    }).join('') : '';
    return `
      <div style="margin-top:6px;">
        <div onclick="toggleAPOpt('${key}')" style="cursor:pointer;font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g70);padding:3px 6px;background:rgba(200,151,30,.03);border-radius:2px;user-select:none;letter-spacing:.04em;text-transform:uppercase;">${arrow} ${escapeHTML(title)}</div>
        <div>${itemsHTML}</div>
      </div>`;
  };

  // Assemble the FP options list filtered by the character's Hero classes.
  // v8.3.21: each class-specific option's annotation badge shows the Talent
  // ownership status: ✓ owned (clear to use) or ⚠ Talent missing (player can
  // spend FP but the Talent-gated mechanic won't activate per rules).
  const fpItems = [...FP_OPTIONS_UNIVERSAL];
  for (const heroCls of cap.heroClassNames) {
    const baseOpt = FP_OPTIONS_BY_HERO_CLASS[heroCls];
    if (!baseOpt) continue;
    const owns = cap.ownedTalentNames.has(baseOpt.talent);
    const annotationHTML = owns
      ? `<span style="color:#6dba88;font-weight:600;">[✓ ${escapeHTML(baseOpt.talent)} owned]</span>`
      : `<span style="color:var(--red-text);font-weight:600;">[⚠ Requires Talent: ${escapeHTML(baseOpt.talent)} — not owned]</span>`;
    fpItems.push({
      name: baseOpt.name,
      desc: baseOpt.desc,
      annotationHTML,
      talent: baseOpt.talent,
      talentOwned: owns,
    });
  }

  document.getElementById('tr-ap').innerHTML = `
    ${heroicCaption}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);">Action Points</span>
      <span style="font-family:'Epics Serif','Cinzel',serif;font-size:16px;font-weight:600;color:var(--gold);">${c.ap||0} / ${c.apMax||0}</span>
    </div>
    <div class="bar-wrap"><div class="bar-fill bar-purple" style="width:${pct}%;"></div></div>
    ${optSection('ap',  'Action Point Options',          AP_OPTIONS,  cap.hasAP,  'requires Heroic 1+')}
    ${optSection('hap', 'Heroic Action Point Options',  HAP_OPTIONS, cap.hasHAP, 'requires Heroic 2+ and 1+ Hero class level')}
    ${optSection('fp',  'Fate Point Options',            fpItems,     cap.hasFP,  'requires Heroic 5+ and 1+ Hero class level')}
  `;
  // v8.3.19: show the Fate Point spend/restore buttons only when relevant
  // (Heroic 5+ AND character has at least one Hero class level), OR when
  // the character has already spent at least one FP (so the GM-restore
  // button is reachable even if the scenario rules have changed).
  const fpCtrl = document.getElementById('tr-ap-fp-controls');
  if (fpCtrl) {
    fpCtrl.style.display = (cap.hasFP || fpSpent > 0) ? 'flex' : 'none';
  }
  renderBattleFocus(c); // v8.5.4
}

// v8.5.4: Warmind Battle Focus — the Psionic Scale 0 variant (HH Warmind
// table: "Psionics or Battle Focus +N" at class levels 1/4/7/10/13/16).
// While psionically focused, the Warmind gains HALF the Battle Focus
// modifier (rounded up) to hit, damage, dodge, and parry; they may EXPEND
// the focus to apply the FULL modifier to any single roll. Combat-state
// mechanic, so it lives on the Tracker beside the AP bar; c.battleFocused
// holds the current focus state.
function warmindBattleFocusMod(c) {
  if ((((c && c.sixLevels) || {}).psionic ?? 0) !== 0) return 0;
  const lvl = migrateLegacyClasses(c || {}).filter(e => e.name === 'Warmind')
    .reduce((s, e) => s + (e.level || 0), 0);
  return [1, 4, 7, 10, 13, 16].filter(m => m <= lvl).length;
}
function renderBattleFocus(c) {
  const apEl = document.getElementById('tr-ap');
  if (!apEl) return;
  let host = document.getElementById('tr-battle-focus');
  if (!host) {
    host = document.createElement('div');
    host.id = 'tr-battle-focus';
    apEl.parentNode.insertBefore(host, apEl.nextSibling);
  }
  const mod = warmindBattleFocusMod(c);
  if (!mod) { host.innerHTML = ''; return; }
  const focused = !!c.battleFocused;
  const passive = Math.ceil(mod / 2);
  host.innerHTML = `
    <div style="margin-top:10px;padding:8px 10px;background:rgba(0,0,0,.2);border:1px solid rgba(200,151,30,.2);border-left:2px solid ${focused ? '#7daadc' : 'rgba(200,151,30,.3)'};border-radius:2px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);">Battle Focus (Psionic 0 variant) &middot; modifier +${mod}</span>
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:12px;font-weight:600;color:${focused ? '#7daadc' : 'var(--g45)'};">${focused ? '◉ FOCUSED' : '○ unfocused'}</span>
      </div>
      <div style="font-size:10.5px;color:var(--g70);line-height:1.45;margin-bottom:6px;">
        ${focused
          ? `While focused: <b style="color:var(--gold);">+${passive}</b> to hit, damage, dodge, and parry (half of +${mod}, rounded up). Expend the focus for the full <b style="color:var(--gold);">+${mod}</b> on any single roll.`
          : `Gain psionic focus (see Concentration) to receive +${passive} to hit, damage, dodge, and parry — or expend it for +${mod} on a single roll.`}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm" onclick="toggleBattleFocus()">${focused ? 'Drop Focus' : '◉ Become Focused'}</button>
        ${focused ? `<button class="btn btn-sm btn-pri" onclick="expendBattleFocus()">⚡ Expend for +${mod}</button>` : ''}
      </div>
    </div>`;
}
function toggleBattleFocus() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.battleFocused = !c.battleFocused;
  logActionEvent(c, 'battle-focus', 0, c.battleFocused ? 'Became focused' : 'Dropped focus', '');
  save(); renderBattleFocus(c);
}
function expendBattleFocus() {
  const c = chars.find(x => x.id === curId); if (!c || !c.battleFocused) return;
  const mod = warmindBattleFocusMod(c);
  c.battleFocused = false;
  logActionEvent(c, 'battle-focus', 0, 'Expended focus', `Full Battle Focus modifier (+${mod}) applied to one roll`);
  toast(`Focus expended — +${mod} to that roll. Re-focus via Concentration.`);
  save(); renderBattleFocus(c);
}
// v8.3.19: Toggle a section's collapsed state and re-render the AP bar.
function toggleAPOpt(key) {
  if (!window._apOptToggle) window._apOptToggle = {ap:false, hap:false, fp:false};
  window._apOptToggle[key] = !window._apOptToggle[key];
  const c = chars.find(x => x.id === curId);
  if (c) renderAPBar(c);
}
function renderXPBar(c){
  // v8.20.0: self-heal the Techsmith Mastercraft XP Reserve on render (the
  // ECL-bug lesson: stored derived state reconciles wherever it's displayed).
  reconcileMcReserve(c);
  // v8.3.1: progression is within the CURRENT level's XP band, not cumulative
  // from zero. See computeXpProgress() near XP_TBL for the math.
  const prog = computeXpProgress(c);
  document.getElementById('tr-xp').innerHTML=`
    <div class="xp-track" style="margin:0;">
      <div class="xp-top"><span class="xp-lvl">Level ${c.totalLvl}</span><span style="font-family:'Epics Serif','Cinzel',serif;font-size:9px;color:var(--g50);">ECL ${c.ecl}</span></div>
      <div class="bar-wrap"><div class="bar-fill bar-gold" style="width:${prog.pct}%;"></div></div>
      <div class="xp-txt">${prog.inLevel.toLocaleString()} / ${prog.bandSize.toLocaleString()} XP toward Lvl ${c.totalLvl + 1} <span style="color:var(--g45);font-size:10px;">(${c.xp.toLocaleString()} total)</span></div>
      ${c.mcReserve && techsmithLvl(c) ? `<div style="font-size:10.5px;color:#78afcd;margin-top:3px;cursor:help;" title="Techsmith class feature (HH p.140): 250 XP × class level granted at every Techsmith level. Spendable ONLY on mastercraft items (the − Spend flow draws it first); unspent reserve is FORFEITED when a new level is gained. Separate from advancement XP — it never counts toward level gain.">🔧 Mastercraft XP Reserve: <b>${c.mcReserve.balance.toLocaleString()}</b> <span style="color:var(--g45);">(use-it-or-lose-it at level-up · mastercraft only)</span></div>` : ''}
    </div>`;
}
// v8.3.20: Condition rendering with tier-styled pills and an expanding
// mechanical-effects panel directly below. The Tracker page shows the FULL
// handbook text for each active condition (since players are in tactical mode
// here); the Sheet page banner uses the shorter gloss.
//
// Forward-compatibility note: this function reads tier metadata from
// CONDITION_TIER_STYLE. Adding a new tier requires only extending that table —
// no changes here.
// ============================================================================
// v8.62.0 (Tier B) — 🎭 TALENT ACTIONS: computed reference cards for the
// at-will action talents. Book verification corrected the sift's design:
// E&E's rewrites DROPPED the d20M daily limits — Charm is an always-on
// gated bonus, Favor costs 1 ACTION POINT per use (now ap_cost:1 — the
// Layer-2 ⚡ Spend-AP button on the Talents tab picks it up as pure data),
// and Captivate/Dazzle/Taunt/Trick are AT-WILL checks. So: live numbers,
// not counters. All values transcribed from HH pp.63-71 full text.
function renderTalentActions(c) {
  const host = document.getElementById('tr-talent-actions');
  const panel = document.getElementById('tr-talent-actions-panel');
  if (!host || !panel) return;
  const owned = new Set((c.talents || []).map(t => t.name || t.n));
  const countOf = (n) => (c.talents || []).filter(t => (t.name || t.n) === n).length;
  const lvlOf = (cls) => migrateLegacyClasses(c).filter(e => e.name === cls).reduce((s, e) => s + (e.level || 0), 0);
  const chaLvl = Math.max(1, lvlOf('Charismatic Hero'));
  const smartLvl = Math.max(1, lvlOf('Smart Hero'));
  const chaM = effAm(c, 5), intM = effAm(c, 3);
  const fmt = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const cards = [];
  const card = (name, body, tip) => cards.push(`<div style="padding:4px 0;border-bottom:1px solid rgba(200,151,30,.08);" title="${escapeHTML(tip || '')}"><b style="color:rgba(212,184,112,.9);cursor:help;">${name}</b> — ${body}</div>`);
  // ---- Charisma suite ----
  if (owned.has('Charm')) card('Charm', `+${chaLvl} competence on Charisma-based checks made to INFLUENCE others`, 'Only against targets with attitudes of indifferent or better — never vs unfriendly or hostile (GM adjudicates attitude).');
  if (owned.has('Fast-Talk')) card('Fast-Talk', `+${chaLvl} competence on Bluff, Diplomacy, and Gamble while lying, cheating, or bending the truth${owned.has('Silver Tongue') ? ' — Silver Tongue extends this to Gather Information and Intimidate, and lets you spend an AP to reroll (keep the second roll)' : ''}`, 'Applies when attempting to con or deceive.');
  if (owned.has('Favor')) card('Favor', `spend 1 AP (⚡ on the Talents tab) → Favor check d20 ${fmt(chaLvl)} vs GM DC 10–30`, 'No take 10 or 20; no retry for the same favor; the GM may disallow disruptive favors.');
  if (owned.has('Captivate')) card('Captivate', `attack action: Cha check d20 ${fmt(chaLvl + chaM)} vs DC 15 → target Will save DC ${10 + chaLvl + chaM + (owned.has('Animal Magnetism') ? 4 : 0)}${owned.has('Animal Magnetism') ? ' (incl. Animal Magnetism +4)' : ''} or FASCINATED 1 round (flat-footed, sole focus)`, 'Target: Int 3+, within 30 ft, flat-footed or out of combat, must see/hear/understand you. Concentrate to extend (new save each round); breaks if the target is attacked or threatened. Mind-affecting.');
  if (owned.has('Dazzle')) { const dz = owned.has('Silver Tongue') ? Math.max(1, chaM) : countOf('Dazzle'); card('Dazzle', `attack action: Cha check d20 ${fmt(chaLvl + chaM)} vs DC 15 → Will save DC ${10 + chaLvl + chaM} or −${dz} on attacks, checks, and saves for ${Math.max(1, chaLvl)} rounds${owned.has('Silver Tongue') ? ' (Silver Tongue: penalty = your Cha modifier)' : (countOf('Dazzle') > 1 ? ` (taken ×${countOf('Dazzle')})` : '')}`, 'Target: Int 3+, 30 ft, must see/hear/understand you. Selectable multiple times — each take worsens the penalty by 1. Mind-affecting.'); }
  if (owned.has('Taunt')) card('Taunt', `${owned.has('Silver Tongue') ? 'MOVE action (Silver Tongue)' : 'standard action'}: Cha check d20 ${fmt(chaLvl + chaM)} vs DC 15 → Will save DC ${10 + chaLvl + chaM} or the target FIXATES its next action on you`, 'Target: Int 3+, 30 ft, must hear and understand you. Mind-affecting.');
  if (owned.has('Coordinate')) card('Coordinate', `full round + Cha check DC 10 (yours: d20 ${fmt(chaM)}) → ${owned.has('Inspiring Aura') ? Math.max(1, chaM) : Math.max(1, Math.floor(chaLvl / 2))} allies gain +1${owned.has('Inspiring Aura') ? ' (stacks with the Aura’s standing +1)' : ''} on attacks and skill checks for ${Math.max(1, chaM)} rounds`, `Allies within 30 ft.${owned.has('Inspiring Aura') ? ' Inspiring Aura: allies within 30 ft ALWAYS have +1 attacks/skills; Coordinate reaches Cha-mod allies.' : ''}`);
  if (owned.has('Inspiration') || owned.has('Greater Inspiration')) { const gi = owned.has('Greater Inspiration'); card(gi ? 'Inspiration (Greater)' : 'Inspiration', `full round${owned.has('Inspiring Aura') && owned.has('Inspiration') ? ' (standard action w/ Inspiring Aura)' : ''} + Cha check DC 10 → ${Math.max(1, Math.floor(chaLvl / 2))} allies gain +${gi ? (owned.has('Inspiring Aura') ? 4 : 3) : 2} morale on saves, attacks, and damage for ${Math.max(1, chaM)} rounds`, 'The ally must listen and observe for a full round. You cannot inspire yourself.'); }
  // ---- Strategy suite (Smart Hero) ----
  if (owned.has('Exploit Weakness')) card('Exploit Weakness', `after 1 round of combat — move action: Int check d20 ${fmt(smartLvl + intM)} vs DC 15 → use your INT modifier (${fmt(intM)}) on attack rolls instead of Str/Dex for the rest of the combat vs that opponent`, owned.has('Master Strategist') ? 'Master Strategist: reroll any Strategy-tree Int check (keep the better).' : '');
  if (owned.has('Plan')) card('Plan', `1 minute of prep (never when surprised) + Int check d20 ${fmt(smartLvl + intM)} vs DC 10 → +1 (10–14) / +2 (15–24) / +3 (25+) circumstance on skill checks and attacks for you and allies — full value 3 rounds, then −1/round`, `No take 10 or 20.${owned.has('Master Strategist') ? ' Master Strategist: reroll the check.' : ''}`);
  if (owned.has('Trick')) card('Trick', `full-round action: Int check d20 ${fmt(smartLvl + intM)} vs DC 15 → Will save DC ${10 + smartLvl + intM} or DAZED 1 round`, `Target: Int 3+, 30 ft, must hear and understand you. Once per target per encounter — afterwards they're wary and immune.${owned.has('Master Strategist') ? ' Master Strategist: reroll the check.' : ''}`);
  if (owned.has('Intuition')) card('Intuition', `Will save DC 15 → an honest hunch about imminent trouble (or its absence)`, 'The Dedicated Hero senses trouble in the air; the GM answers truthfully through the hunch.');
  // ---- Effort chain (Strong Hero) ----
  {
    const tiers = ['Extreme Effort', 'Improved Extreme Effort', 'Advanced Extreme Effort'].filter(n => owned.has(n)).length;
    if (tiers > 0) {
      const bonus = owned.has('Supreme Effort') ? tiers * 5 : tiers * 2;
      card(owned.has('Supreme Effort') ? 'Supreme Effort' : 'Extreme Effort', `move action (declare before rolling): +${bonus} on a Strength check or Strength-based skill check`, owned.has('Supreme Effort') ? 'Supreme Effort: +5 per Effort tier owned instead of +2.' : 'Tiers stack: +2 / +4 / +6.');
    }
  }
  panel.style.display = cards.length ? '' : 'none';
  host.innerHTML = cards.join('');
}
// v8.62.0 (Tier B): ⚔ Universal combat options — always available, no feat
// required (HH combat chapter; Tumble-rank upgrades per the skill's Special).
function renderCombatOptions(c) {
  const host = document.getElementById('tr-combat-options');
  if (!host) return;
  const tumble = (getLiveSkillRanks(c, 'Tumble') || 0);
  const t5 = tumble >= 5;
  const chip = (name, body, tip) => `<span style="display:inline-block;margin:1px 10px 1px 0;white-space:nowrap;cursor:help;" title="${escapeHTML(tip)}"><b style="color:var(--tc85);">${name}</b> <span style="opacity:.8;">${body}</span></span>`;
  host.innerHTML = [
    chip('Aid Another', 'attack vs AC 10 → ally +2', 'Standard action, in melee reach of an opponent engaging your ally: hit AC 10 to grant the ally +2 on their next attack against that opponent OR +2 AC against its next attack (before your next turn). Bonuses from multiple aiders stack. Also usable to assist skill checks.'),
    chip('Fight Defensively', `−4 attacks / +${t5 ? 3 : 2} Defense${t5 ? ' (Tumble 5+)' : ''}`, 'Declare with an attack or full attack action; lasts until your next action. With 5+ ranks of Tumble the dodge bonus is +3 instead of +2.'),
    chip('Total Defense', `+${t5 ? 6 : 4} Defense${t5 ? ' (Tumble 5+)' : ''}, no attacks`, 'Standard action: +4 dodge bonus to AC (+6 with 5+ ranks of Tumble) until your next action. You can’t combine it with attacking or with Combat Expertise.'),
    chip('Charge', '+2 attack, −2 AC, ×2 move', 'Full-round action: move at least 10 ft (up to double speed) straight to the closest attackable space; ONE melee attack at +2; −2 AC until your next turn. Set spears/tridents deal double damage against you; a mounted lance deals double damage to its target.'),
    chip('Ready Dodge / Parry', 'move action', 'Ready a dodge or parry against a declared opponent (move action; feat chains upgrade this to swift/free/immediate-free — see the 🛡 Defensive riders line on Gear). Resolve as opposed rolls using your Dodge or Parry stat.'),
    chip('Withdraw', '×2 move, safe first hex', 'Full-round action: move up to double speed; leaving your STARTING hex provokes no AoO (later hexes do).'),
    chip('Delay / Ready', 'shift initiative', 'Delay: act later in the order (your initiative changes). Ready: prepare a standard/move/swift action against a trigger; it goes off before the trigger completes.'),
    chip('5-ft Step', 'free, no AoO', 'Once per round when you move no other distance: step 5 ft without provoking. Not while using a movement-forbidding full-round action.'),
  ].join('');
  // v8.71.0 (Adam's call — "one of the most contentious parts of melee
  // combat"): the Grapple drop-down, condensed from HH pp.372-374 with the
  // load-bearing numbers verbatim; live check from computeGrapple (stances,
  // buffs, size all ride along).
  // v8.72.0 (Adam's CDO, justly triggered): Grapple REJOINS the uniform
  // chip rank — soft blue title, quick blurb — so it catches the eye like
  // its siblings; the full rules fold below as the Grappling Rules Summary.
  const gr = computeGrapple(c);
  const ownsFeat = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  const impGrap = ownsFeat('Improved Grapple');
  const eaRanks = (getLiveSkillRanks(c, 'Escape Artist') || 0);
  const gH = (t) => `<div style="margin-top:5px;color:rgba(212,184,112,.9);font-weight:bold;">${t}</div>`;
  host.innerHTML = [
    host.innerHTML,
    chip('Grapple', `d20 ${gr ? (gr.total >= 0 ? '+' : '') + gr.total : '+ mods'} — special modifiers &amp; options; see details below`, `Grapple check = d20 + BAB + Str mod + special size modifier (±4 per size step)${impGrap ? ' + Improved Grapple +4' : ''}${gr ? `. Yours: ${gr.parts.join(' · ')}.` : '.'} The full start-a-grapple sequence, in-grapple actions, pins, and multi-grappler rules are in the Grappling Rules Summary directly below.`),
  ].join('');
  host.innerHTML += `
    <details class="hy-det" style="margin-top:6px;"><summary>Grappling Rules Summary (HH pp.372–374)${gr ? ` · your check: d20 ${gr.total >= 0 ? '+' : ''}${gr.total}` : ''}</summary>
    <div style="padding:4px 0 2px 14px;line-height:1.55;font-size:11px;color:var(--tx85);">
      <b>The check:</b> 1d20 + base attack bonus + Str modifier + special size modifier — "a grapple check is like a melee attack roll." Special size modifier: Colossal +16, Gargantuan +12, Huge +8, Large +4, Medium +0, Small −4, Tiny −8, Diminutive −12, Fine −16 (±4 per step, in place of the normal attack-roll size modifier).${gr ? ` <span style="color:var(--tc85);">Yours: ${gr.parts.join(' · ')}.</span>` : ''}
      ${gH('Starting a grapple (standard action — one attempt per iterative, at successively lower BA)')}
      <b>1. AoO:</b> the target gets an attack of opportunity against you${impGrap ? ' — <span style="color:var(--tc85);">waived: you have Improved Grapple (+4 on all grapple checks, already in your total)</span>' : ' (waived by Improved Grapple)'}; if it deals damage, the attempt fails.<br>
      <b>2. Grab:</b> melee touch attack; miss = fail.<br>
      <b>3. Hold:</b> opposed grapple check (free action); win = you are grappling and deal unarmed-strike damage. You automatically lose vs a target two or more size categories larger. Ties go to the higher modifier.<br>
      <b>4. Maintain:</b> move into the target's space (free movement — provokes from OTHER threateners, never the target). Can't move in → you must let go.
      ${gH('While grappling (both of you)')}
      You threaten no hexes · you lose your Dex bonus to AC against opponents you are NOT grappling · no normal movement. Each of the following takes the place of ONE attack (iteratives apply):
      <b>Attack</b> with unarmed strike, natural weapon, or LIGHT weapon at −4 (never two weapons) · <b>Damage</b> via opposed check — unarmed-strike nonlethal (−4 on the check to make it lethal) · <b>Pin</b> via opposed check (1 round) · <b>Escape</b> via opposed check — or an Escape Artist check${eaRanks ? ` <span style="color:var(--tc85);">(your ranks: ${eaRanks})</span>` : ''} as a standard action; you must beat EVERY holder, then finish adjacent · <b>Move</b> half speed, everyone comes along (standard action, beat all; +4 to move a lone PINNED opponent) · <b>Draw a light weapon</b> (move action + check) · <b>Use the opponent's light weapon</b> (opposed check, then attack at −4; no possession) · <b>Break another's pin</b> (opposed check) · <b>Cast/manifest</b> only ≤ 1 standard action, no somatic components, materials in hand, Concentration DC 20 + spell level · activate non-spell-completion magic items and retrieve a component (full round) freely.
      ${gH('Pinned')}
      Held immobile 1 round (not helpless): −4 AC against everyone EXCEPT the pinner; the pinner may silence you. Escape the pin with an opposed check (or Escape Artist, standard action) — success leaves you still grappling. The PINNER may damage you, use your weapon, or move the grapple — but can't draw/use weapons, escape another's grapple, pin another, or break pins; releasing you is a free action; disarming your secured gear gives you +4 to resist.
      ${gH('Joining & multiples')}
      Joining an existing grapple: no AoO against you and the grab auto-succeeds — the opposed check still decides. Up to FOUR can grapple one target (a size smaller counts half; one larger counts double; two+ larger quadruple). Against several opponents you pick ONE to oppose — except escaping, which must beat them all.
    </div></details>`;
}

// ============================================================================
// v8.65.0 (Tier B, Adam's go) — 🎵 BARDIC MUSIC: computed performance cards,
// gated on Bard level AND Perform ranks per HH pp.77-78 ("if a Bard does not
// have the required number of ranks in at least one Perform skill, they do
// not gain the bardic music ability until they acquire the needed ranks" —
// rank-short abilities render greyed with the gap named). The daily counter
// (Bard level uses) already lives on the per-diem panel; Suggestion is free.
function renderBardicMusic(c) {
  const panel = document.getElementById('tr-bardic-panel');
  const host = document.getElementById('tr-bardic');
  if (!panel || !host) return;
  const brd = _cfLvlOf(c, 'Bard');
  if (brd <= 0) { panel.style.display = 'none'; host.innerHTML = ''; return; }
  panel.style.display = '';
  let perf = 0, perfName = '—';
  for (const k of Object.keys(c.skills || {})) {
    if (/^Perform/i.test(k) && (c.skills[k] || 0) > perf) { perf = c.skills[k] || 0; perfName = k; }
  }
  const chaM = am(effAttrs(c)[5]);
  const used = (c.abilityUses || {}).bardicMusic || 0;
  const courage = 1 + [8, 14, 20].filter(l => brd >= l).length;
  const sugDC = 10 + Math.floor(brd / 2) + chaM;
  const card = (ranksReq, name, body, tip) => {
    const ok = perf >= ranksReq;
    return `<div style="margin:3px 0;${ok ? '' : 'opacity:.45;'}cursor:help;" title="${escapeHTML(tip + (ok ? '' : ` LOCKED — needs ${ranksReq} Perform ranks (your best: ${perf}).`))}"><b style="color:rgba(156,195,218,${ok ? '.9' : '.5'});">${name}</b> <span style="opacity:.85;">${body}${ok ? '' : ` <i style="font-size:10px;">(needs ${ranksReq} ranks)</i>`}</span></div>`;
  };
  const rows = [`<div style="font-size:10.5px;color:var(--g60);margin-bottom:5px;">${brd} uses/day (${used} used — the ☀ per-diem panel tracks them) · best Perform: ${escapeHTML(perfName)} ${perf} ranks · starting a performance is a standard action; no spellcasting or spell-trigger/completion items while performing; a deaf Bard fails 20% of attempts (the use is still spent).</div>`];
  rows.push(card(3, 'Countersong', `(Su) Perform check each round — anyone within 30 ft may use it in place of their save vs sonic / language-dependent magic; up to 10 rounds.`, 'Ongoing noninstantaneous effects get a new save each round at your Perform result. No effect on save-less effects.'));
  rows.push(card(3, 'Fascinate', `(Sp) ${1 + Math.floor((brd - 1) / 3)} creature${1 + Math.floor((brd - 1) / 3) === 1 ? '' : 's'} within 90 ft — Perform check = their Will DC; up to ${brd} rounds.`, 'Targets must be able to see, hear, and attend; nearby combat prevents it. Fascinated: sits and listens, −4 on reactive Listen/Spot. New threats allow a fresh save vs a new Perform check; obvious threats break it. Mind-affecting compulsion.'));
  rows.push(card(5, 'Inspire Courage', `(Su) allies who hear: +${courage} morale on attacks & weapon damage, +${courage} on saves vs charm/fear; lasts while heard + 5 rounds.`, 'Self included. +1 base, +1 more at 8th, 14th, and 20th. Mind-affecting.'));
  if (brd >= 3) rows.push(card(7, 'Inspire Competence', `(Su) one ally within 30 ft: +2 competence on a skill while they hear you — up to 2 minutes; not on yourself.`, 'Concentration to maintain. Certain uses are infeasible (GM).'));
  if (brd >= 6) rows.push(card(10, 'Suggestion', `(Sp) on an ALREADY-fascinated creature — Will DC ${sugDC} negates; FREE (no daily use).`, 'Doesn’t break your Fascinate concentration and grants no new save against it. Enchantment (compulsion), mind-affecting, language-dependent.'));
  if (brd >= 9) rows.push(card(13, 'Inspire Greatness', `(Su) ${1 + Math.floor((brd - 9) / 3)} willing all${1 + Math.floor((brd - 9) / 3) === 1 ? 'y' : 'ies'} (self allowed): +2 bonus HD (d10s + Con) as temp HP, +2 competence on attacks, +1 competence Fort; lasts while heard + 5 rounds.`, 'The bonus Hit Dice count as regular HD for HD-dependent spells. Mind-affecting.'));
  if (brd >= 12) rows.push(card(15, 'Song of Freedom', `(Sp) Break Enchantment at CL ${brd} on one target within 30 ft — 1 minute of uninterrupted music; not on yourself.`, 'As the spell: frees from enchantments, transmutations, curses, petrification.'));
  if (brd >= 15) rows.push(card(19, 'Inspire Heroics', `(Su) ${1 + Math.floor((brd - 15) / 3)} willing all${1 + Math.floor((brd - 15) / 3) === 1 ? 'y' : 'ies'} (self allowed): +4 morale on saves, +4 dodge AC; full-round action to start; lasts while heard + 5 rounds.`, 'Mind-affecting.'));
  if (brd >= 18) rows.push(card(20, 'Mass Suggestion', `(Sp) as Suggestion (Will DC ${sugDC}) on ANY number of fascinated creatures at once.`, 'Enchantment (compulsion), mind-affecting, language-dependent.'));
  host.innerHTML = rows.join('');
}

// v8.65.0 (Tier B, Adam's go) — 🔥 ELEMENTAL ARSENAL: the Elementalist's
// AT-WILL attack forms wired as attacks with live math (Adam's caveat),
// variant-resolved from the Elemental Focus pick (GMG pp.165-167). The
// Nimbus 1-2/day lives on the per-diem panel; Fist also rides the unarmed
// row as an alt mode and Elemental Weapon rides melee rows as a rider.
function renderElementalist(c) {
  const panel = document.getElementById('tr-elemental-panel');
  const host = document.getElementById('tr-elemental');
  if (!panel || !host) return;
  const ele = _cfLvlOf(c, 'Elementalist');
  if (ele <= 0) { panel.style.display = 'none'; host.innerHTML = ''; return; }
  panel.style.display = '';
  const pick = ((c.classChoices || {})['ele_var_1'] || '');
  const vn = (pick.match(/^(Ambrian|Kryonian|Vesuvian|Vitrolian)/) || [])[1] || null;
  if (!vn) { host.innerHTML = `<div style="font-size:11px;color:#d4b870;">Choose the Elemental Focus in 🎓 Class Choices (Sheet) — every attack form keys off the variant.</div>`; return; }
  const eff = effAttrs(c);
  const strM = am(eff[0]), dexM = am(eff[1]);
  const szm = (raceACSizeMod(c) || 0);
  const mTouch = (c.bab || 0) + strM + szm;
  const rTouch = (c.bab || 0) + dexM + szm;
  const fmt = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const greater = ele >= 7;
  const boltDice = greater ? '4d6' : '2d6';
  const V = {
    Ambrian:   { fist: `2d6 electricity per melee TOUCH (${fmt(mTouch)})`, bolt: `${boltDice} electricity OR ionic (nonlethal electricity), ranged touch ${fmt(rTouch)}, 15 ft`, blasts: [`Electrical Blast — ${ele}d6 electricity, ranged touch ${fmt(rTouch)}, range ${ele * 60} ft`, `Ionic Blast — ${ele}d6 ionic (nonlethal electricity), ranged touch ${fmt(rTouch)}, range ${ele * 30} ft`], weapon: '+2d6 electricity per hit' },
    Kryonian:  { fist: `2d6 cold per melee TOUCH (${fmt(mTouch)})`, bolt: `${boltDice} cold OR water (nonlethal bludgeoning), ranged touch ${fmt(rTouch)}, 15 ft`, blasts: [`Cold Blast — ${ele}d6 cold, ranged touch ${fmt(rTouch)}, range ${ele * 30} ft`, `Water Blast — ${ele}d6 water (nonlethal bludgeoning), ranged touch ${fmt(rTouch)}, range ${ele * 10} ft`], weapon: '+2d6 cold per hit' },
    Vesuvian:  { fist: `2d6 fire per melee TOUCH (${fmt(mTouch)})`, bolt: `${boltDice} fire OR heat (nonlethal fire), ranged touch ${fmt(rTouch)}, 15 ft`, blasts: [`Targeted Fire Blast — ${ele}d6 fire, ranged touch ${fmt(rTouch)}, range ${ele * 30} ft`, `Area Fire Blast — ${ele}d6 fire, ${ele * 5}′-radius area, Reflex DC ${13 + dexM} half, range ${ele * 10} ft`], weapon: '+2d6 fire per hit' },
    Vitrolian: { fist: `2d6 bludgeoning + Str (${fmt(strM)}) — a NORMAL armed unarmed attack, stone-sheathed`, bolt: `+2d6 additional bludgeoning on each successful Elemental Fist or Slam hit${greater ? ' · Fist ignores 10 hardness (Greater Adaptation)' : ''}`, blasts: [`Clap Shockwave — ${ele}d6 concussion (nonlethal sonic), ${ele * 10}′ cone, Fort DC ${13 + strM} half`, `Stomp Shockwave — ${ele}d4 nonlethal, ${ele * 10}′ radius on you (you're immune), Str check DC ${13 + strM} or knocked PRONE`], weapon: '+5 Hardness, +10 HP, and a magical +1 to hit on the engulfed weapon' },
  }[vn];
  const card = (name, body, tip) => `<div style="margin:3px 0;cursor:help;" title="${escapeHTML(tip)}"><b style="color:rgba(212,134,90,.95);">${name}</b> <span style="opacity:.85;">${body}</span></div>`;
  const rows = [`<div style="font-size:10.5px;color:var(--g60);margin-bottom:5px;">${vn} · Elementalist ${ele} — all forms are AT-WILL (Su)${greater ? ' · Greater Elemental Adaptation active (7th)' : ''}. The Nimbus (1${ele >= 8 ? '-2' : ''}/day or 1 AP) is on the ☀ per-diem panel.</div>`];
  rows.push(card('Elemental Fist', `move action to invoke — ${V.fist}`, 'GMG p.165: the element engulfs your hand (harmless to you); your unarmed attack counts as ARMED. Also shown as an alt mode on the Gear tab’s unarmed row.'));
  if (ele >= 2) rows.push(card(vn === 'Vitrolian' ? 'Elemental Bolt (rider)' : 'Elemental Bolt', `${V.bolt} — usable once per attack: iteratives from high BA each carry one.`, 'GMG p.166: a full-attack Elementalist fires one bolt per attack.'));
  if (ele >= 3) rows.push(card('Elemental Blast', `standard action — ${V.blasts.join(' · OR · ')}`, 'GMG p.166: two manifestation options; pick per blast.'));
  if (ele >= 3) rows.push(card('Elemental Weapon', `move action — engulf one melee weapon: ${V.weapon}`, 'GMG pp.166-167: the weapon is unharmed. Also shown as a rider on the Gear tab’s melee weapon rows.'));
  if (ele >= 5) rows.push(card('Elemental Locomotion', ({ Ambrian: 'Fly 120′ (perfect)', Kryonian: 'Swim 60′ · hold breath 1 min/Con point', Vesuvian: 'Fly 60′ (perfect)', Vitrolian: 'Burrow (see entry)' })[vn], 'GMG p.167 — the variant movement mode.'));
  if (ele >= 10) rows.push(card('Elemental Transformation', `become a living elemental AT WILL — Nimbus at will, DR ${vn === 'Vitrolian' ? '20/adamantine+magic' : '15/magic'}, immunities per the entry`, 'GMG p.167.'));
  host.innerHTML = rows.join('');
}

function renderConds(c){
  const el=document.getElementById('tr-conds');
  const effectsEl=document.getElementById('tr-cond-effects');
  const conds=c.conditions||[];
  // v8.60.2 (Adam): ⊘ Nullified lives with the conditions now. Rendered
  // only for Su-bearing characters (same gate as the old Sheet button);
  // lit red while active. The Sheet keeps the status banner + Restore.
  {
    const nfEl = document.getElementById('tr-nullify');
    if (nfEl) {
      const suAttrs = suBakedPerAttr(c);
      const hasSu = suAttrs.some(v => v)
        || (c.talents || []).some(t => TALENTS_DB.find(x => x.n === (t.name || t.n) && /Super-Talent/.test(x.tier || '')))
        || (c.powers || []).some(p => p.pool === 'super');
      nfEl.innerHTML = hasSu
        ? `<button class="ilbtn" style="${c.nullified ? 'border-color:rgba(212,112,112,.7);color:var(--red-text);' : 'opacity:.7;'}" title="${c.nullified ? 'Null Power Field active — all Supernatural modifiers suppressed (Su ability bakes, Bulletproof, Hyper-Speed, Energy Immunity, Super-Smash, ✨ buffs). Click to restore.' : 'Simulate a Null Power Field: suppress ALL Supernatural modifiers, reducing the character to natural + Extraordinary. Rage still works (Ex).'}" onclick="toggleNullified()">⊘ Nullified${c.nullified ? ' ✓' : '?'}</button>`
        : '';
    }
    // v8.63.0: ⚡ Reckless Offense declared stance — feat-gated, lit red
    // while active (same idiom as ⊘ Nullified). Attack rolls only (Adam).
    const roEl = document.getElementById('tr-reckless');
    if (roEl) {
      const roOn = combatDecl(c).ro;
      roEl.innerHTML = ownsFeatN(c, 'Reckless Offense')
        ? `<button class="ilbtn" style="${roOn ? 'border-color:rgba(212,112,112,.7);color:var(--red-text);' : 'opacity:.7;'}" title="${roOn ? 'Reckless Offense declared — +2 on melee attack rolls incl. Grapple (a grapple check is like a melee attack roll), −4 AC (HH p.239). Base Attack and the iterative ladder untouched. Click to withdraw the stance.' : 'Declare Reckless Offense: take −4 AC for +2 on melee attack rolls (HH p.239) — Grapple included; never ranged. A set-point stance — holds until re-declared. Never touches Base Attack (no extra iterative attacks).'}" onclick="toggleRecklessOffense()">⚡ Reckless${roOn ? ' ✓' : '?'}</button>`
        : '';
    }
    // v8.77.0 (Adam's Sheet polish): ⚡ Euphoric's TRIGGER moved here from
    // the Sheet's toggle strip — it's a transient battle state, so it lives
    // with the conditions (the ⊘ Nullified precedent); the Sheet keeps the
    // blue EUPHORIC banner as the in-effect flag.
    const euEl = document.getElementById('tr-euphoric');
    if (euEl) {
      const euB = euphoriacBonus(c);
      euEl.innerHTML = euB
        ? `<button class="ilbtn" style="${c.euphoric ? 'border-color:rgba(120,175,205,.7);color:#78afcd;' : 'opacity:.7;'}" title="${c.euphoric ? `Euphoric — +${euB} morale on attack rolls, damage rolls, and saving throws (baked into the Sheet). Lasts (wild-surge intensity) rounds. Click when it fades.` : `Euphoriac (Ex, Wilder): after invoking a wild surge without neuralgia, gain +${euB} morale on attack, damage, and saves for (surge intensity) rounds. Click to declare it.`}" onclick="toggleEuphoric()">⚡ Euphoric${c.euphoric ? ' ✓' : '?'}</button>`
        : '';
    }
  }

  if(!conds.length){
    el.innerHTML=`<span style="font-family:'Epics Serif','Cinzel',serif;font-size:11px;color:var(--g35);">No conditions</span>`;
    if(effectsEl){effectsEl.style.display='none';effectsEl.innerHTML='';}
    // Also refresh the Sheet's persistent banner (in case the player is back
    // and forth between Tracker and Sheet)
    renderSheetConditionBanner(c);
    return;
  }

  // Render each condition as a tier-styled pill.
  el.innerHTML = conds.map(co => {
    const data = CONDITIONS_DATA[co];
    const tier = (data && data.tier) || 'moderate';
    const style = CONDITION_TIER_STYLE[tier] || CONDITION_TIER_STYLE.moderate;
    // The terminal tier gets the stark inversion treatment.
    const css = style.stark
      ? `background:${style.bg};border:2px solid ${style.border};color:${style.color};font-weight:700;text-transform:uppercase;letter-spacing:.08em;`
      : `background:${style.bg};border:1px solid ${style.border};color:${style.color};`;
    return `<span class="cond-tag" style="${css}">${escapeHTML(co)} <span class="cond-rm" onclick="rmCond('${co.replace(/'/g, "\\'")}')">✕</span></span>`;
  }).join('');

  // Populate the mechanical-effects panel — one block per active condition.
  // Each block shows: condition name (tier-colored), then the full handbook
  // text. Cited at the end so the player can verify in the source if needed.
  if(effectsEl){
    effectsEl.style.display='block';
    effectsEl.innerHTML = `
      <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;">Mechanical Effects</div>
      ${conds.map(co => {
        const data = CONDITIONS_DATA[co];
        if(!data){
          // Unrecognized condition — preserve it, but flag it
          return `<div style="margin-bottom:8px;padding:8px 10px;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.3);border-radius:2px;">
            <div style="font-weight:600;color:var(--gold);font-size:12px;margin-bottom:3px;">${escapeHTML(co)}</div>
            <div style="font-size:11px;color:var(--g55);font-style:italic;">No reference data found for this condition. See the Hero's Handbook condition appendix.</div>
          </div>`;
        }
        const style = CONDITION_TIER_STYLE[data.tier] || CONDITION_TIER_STYLE.moderate;
        const titleCSS = style.stark
          ? `color:${style.color};background:${style.bg};padding:2px 8px;border-radius:2px;font-weight:700;letter-spacing:.05em;`
          : `color:${style.color};font-weight:600;`;
        // Render `desc` with paragraph breaks (the data uses \n\n).
        // v8.3.30: the per-paragraph style must be applied to EVERY paragraph,
        // not just the first. The previous code wrapped the whole desc in one
        // styled <p> but replaced internal \n\n with a BARE <p style="margin..">
        // that lacked font-size + color — so paragraphs 2+ rendered at the
        // browser default (large, stark white). Conditions with multi-paragraph
        // descriptions (Frightened, Confused, Panicked, etc.) all showed this.
        // Fix: define the paragraph style once and use it for every <p>.
        const paraCSS = 'margin:0;font-size:11.5px;color:var(--g78);line-height:1.55;';
        const paraCSSNext = 'margin:6px 0 0 0;font-size:11.5px;color:var(--g78);line-height:1.55;';
        const descHtml = escapeHTML(data.desc).replace(/\n\n/g, `</p><p style="${paraCSSNext}">`);
        const cit = data.citation ? `<span style="font-size:10px;color:var(--g40);font-style:italic;margin-left:6px;">(${data.citation.book} p.${data.citation.page})</span>` : '';
        return `
          <div style="margin-bottom:8px;padding:9px 11px;background:rgba(200,151,30,.04);border-left:3px solid ${style.border};border-radius:2px;">
            <div style="margin-bottom:5px;font-size:12px;"><span style="${titleCSS}">${escapeHTML(co)}</span> <span style="font-size:10px;color:var(--g45);text-transform:uppercase;letter-spacing:.04em;margin-left:4px;">${style.label}</span>${cit}</div>
            <p style="${paraCSS}">${descHtml}</p>
          </div>`;
      }).join('')}
    `;
  }

  // Always re-render the Sheet banner so it stays in sync if the player
  // alt-tabs back to the Sheet view.
  renderSheetConditionBanner(c);
}

// v8.3.20: Populate the More… dropdown with the full condition list, excluding
// the 6 already-on-the-quick-add-row entries (which would be redundant).
// Called once at init.
function populateConditionDropdown(){
  const sel=document.getElementById('tr-cond-more');
  if(!sel) return;
  const rest=Object.keys(CONDITIONS_DATA).filter(n=>!COMMON_CONDITIONS.includes(n)).sort();
  const opts=['<option value="">More…</option>'].concat(
    rest.map(n=>`<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)
  ).join('');
  sel.innerHTML=opts;
}

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
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:11px;color:var(--vio);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;">⬟ Hero's Gift — Unassigned</div>
        <div style="font-size:12px;color:var(--g85);line-height:1.5;margin-bottom:8px;">
          Your Hero's Gift slot is unassigned. When you're ready, choose how to spend it: a bonus <b>Feat</b> from your Hero class's feat list, or an extra <b>Talent</b> from your Hero class's talent trees. The choice is permanent (retconnable only via Edit, with a GM exception). You can leave it unassigned indefinitely — some GMs allow declaring the slot mid-session, at which point it's set in stone.
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-sm" onclick="assignHerosGiftAsFeat()" style="border-color:rgba(196,153,212,.50);color:var(--vio);">Assign as Feat</button>
          <button type="button" class="btn btn-sm" onclick="assignHerosGiftAsTalent()" style="border-color:rgba(196,153,212,.50);color:var(--vio);">Assign as Talent</button>
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

function renderSheetConditionBanner(c){
  const el=document.getElementById('sh-conditions-banner');
  if(!el) return;
  const conds=c.conditions||[];
  if(!conds.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`
    <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px;">Active Conditions</div>
    ${conds.map(co=>{
      const data=CONDITIONS_DATA[co];
      const tier=(data && data.tier)||'moderate';
      const style=CONDITION_TIER_STYLE[tier]||CONDITION_TIER_STYLE.moderate;
      const gloss=data ? data.gloss : 'See Tracker for details.';
      const isStark=!!style.stark;
      const containerCSS=isStark
        ? `background:${style.sheetBg};border:2px solid ${style.sheetBorder};color:${style.sheetColor};margin-bottom:5px;padding:7px 11px;border-radius:2px;`
        : `background:${style.sheetBg};border:1px solid ${style.sheetBorder};color:${style.sheetColor};margin-bottom:5px;padding:6px 10px;border-radius:2px;border-left-width:3px;`;
      const nameCSS=isStark
        ? `font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12px;`
        : `font-weight:600;font-size:12px;`;
      return `
        <div style="${containerCSS}">
          <span style="${nameCSS}">${escapeHTML(co)}</span>
          <span style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:.04em;margin-left:6px;">${style.label}</span>
          <div style="font-size:11px;margin-top:2px;opacity:.85;line-height:1.5;">${escapeHTML(gloss)}</div>
        </div>`;
    }).join('')}
  `;
}
function renderLog(c){
  const el=document.getElementById('tr-log');
  if(!(c.log||[]).length){el.innerHTML=`<div style="font-size:12px;color:var(--g30);padding:.75rem 0;">No entries yet.</div>`;return;}
  el.innerHTML=[...(c.log||[])].reverse().map(e=>`<div class="log-entry"><div class="log-time">${e.time}</div>${e.text}</div>`).join('');
}
function logAct(txt){const c=chars.find(x=>x.id===curId);if(!c)return;if(!c.log)c.log=[];c.log.push({time:new Date().toLocaleString(),text:txt});save();renderLog(c);}

