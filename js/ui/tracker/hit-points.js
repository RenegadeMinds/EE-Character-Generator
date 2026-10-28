// =============================================================================
// js/ui/tracker/hit-points.js
// TRACKER / HIT POINTS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: the HP bar and HP mode controls.
//
// KEY NAMES (so you can search for them)
//   functions (7): renderHPBar, toggleHpModePanel, renderSheetHpModePanel,
//   changeSheetHpMode, rerollSheetHp, applyHpModeChangeToChar, adjustHP
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/app/65-tracker-logs-and-damage.js
//   when the code was regrouped by topic and page. Each function and table
//   moved whole and unchanged, with the comments above it, including the
//   original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
  const legacyTag = hasRolls ? '' : ' <span style="color:rgb(var(--text-amber));" title="This character was created before v8.2.3 and uses the legacy HP formula. Open the HP Mode panel to regenerate.">(legacy)</span>';
  // v8.6.0 C5: self-healed HP wears its flag until the GM re-rolls.
  const autoTag = c.hpAutoAssigned ? ` <span class="cursor-help" style="color:rgb(var(--text-blue));" title="HP was missing from this record and auto-assigned on ${escapeHTML(c.hpAutoAssigned.atDate||'')} (${escapeHTML(c.hpAutoAssigned.how||'average')}). GM may override via ⚙ HP Mode — re-rolling clears this flag.">(auto-assigned)</span>` : '';
  document.getElementById('tr-hp-bar').innerHTML=`
    <div class="justify-between items-center mb-6" style="display:flex;">
      <span class="font-serif fs-10 c-bronze">HP <span class="c-g45 fs-9 fw-normal normal-case ls-0" style="font-family:'Epics Serif','Crimson Pro',serif;">· ${escapeHTML(modeLabel)}${legacyTag}${autoTag}</span></span>
      <span class="hp-nums">${c.currentHP} / ${c.maxHP}</span>
    </div>
    <div class="bar-wrap"><div class="bar-fill ${col}" style="width:${pct}%;"></div></div>
    <div class="font-serif fs-9 text-center c-g50 mt-3">${pct}% · ${c.currentHP<=0?'DISABLED/DYING':pct<=25?'Critical':pct<=50?'Wounded':'Healthy'}</div>`;
  // v8.6.0 (Adam's Scaly Armor question): natural hardness belongs where the
  // damage lands — the Tracker's HP panel. Full aggregation (racial + talent
  // + mutation + equipped-item NAC), with the application rule on hover.
  const natH = computeNaturalAC(c).total || 0;
  if (natH > 0) {
    document.getElementById('tr-hp-bar').innerHTML +=
      `<div class="fs-10 text-center c-tv85 mt-3 cursor-help" title="Per HH p.347 / GG p.110: every damaging hit that reaches the body ignores the first ${natH} points of damage. Applies to physical and naturally-occurring damage — but NOT acid, and null-energy attacks ignore hardness entirely. Attacks at or above the NatCrit tier bypass it.">🛡 Natural Hardness ${natH} — first ${natH} damage of each hit ignored</div>`;
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
  const c = currentChar();
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
    <label class="items-center gap-4 cursor-pointer" style="display:inline-flex;">
      <input type="radio" name="tr-hp-mode" value="${o.v}" ${o.v===current?'checked':''} onchange="changeSheetHpMode('${o.v}')"> ${o.label}
    </label>
  `).join('');
  const hasRolls = Array.isArray(c.hpRolls) && c.hpRolls.length > 0;
  if (note) {
    if (!hasRolls) {
      note.innerHTML = '<b style="color:rgb(var(--text-amber));">Legacy character.</b> Click Re-roll HP to migrate to per-level rolls under the current mode.';
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
  const c = currentChar();
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
  const c = currentChar();
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
function adjustHP(t){
  const c=currentChar();if(!c)return;const amt=parseInt(document.getElementById('tr-hp-adj').value)||0;
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
