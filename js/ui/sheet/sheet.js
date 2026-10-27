// =============================================================================
// js/ui/sheet/sheet.js
// SHEET / SHEET — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Character Sheet page (renderSheet) and the stat
//   breakdown drilldown.
//
// KEY NAMES (so you can search for them)
//   functions (7): renderSourcedValueProvenance, showStatBreakdown,
//   closeDrilldown, applyRacialNatAC, dismissNatACBanner, renderSheet,
//   renderDrilldown
//
// WHERE IT CAME FROM
//   Gathered from js/app/49-sheet.js, js/rules/19-bonus-aggregator-and-stat-
//   block.js when the code was regrouped by topic and page. Each function
//   and table moved whole and unchanged, with the comments above it,
//   including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Render the provenance HTML for a sourced value. Used in tooltips that
// explain WHY a number is what it is (e.g., the Nat. AC stat-cell tooltip).
// Returns a plain-text or simple-HTML string suitable for a `title` attribute
// or a tooltip popover.
//
// Format:
//   "5 from Drakkin racial natural armor (natural)
//    + 3 from Barkskin (enhancement) [superseded: +2 Amulet of Natural Armor (enhancement)]"
//
// Designed for HTML attribute use (no line breaks); separate sentences with
// " · " for compact display. Caller can format as multi-line for richer UI.
function renderSourcedValueProvenance(breakdown, opts) {
  opts = opts || {};
  const lines = [];
  const applied = breakdown?.applied || [];
  const superseded = breakdown?.superseded || [];
  const inactive = breakdown?.inactive || [];
  for (const e of applied) {
    const sign = e.value >= 0 ? '+' : '';
    lines.push(`${sign}${e.value} ${e.label || e.source} (${e.type || 'untyped'})`);
  }
  let out = lines.join(' · ');
  if (superseded.length > 0) {
    const supLines = superseded.map(e => `${e.value >= 0 ? '+' : ''}${e.value} ${e.label || e.source}`);
    out += ` · [superseded by same-type stacking: ${supLines.join(', ')}]`;
  }
  if (inactive.length > 0 && opts.showInactive) {
    const inacLines = inactive.map(e => `${e.value >= 0 ? '+' : ''}${e.value} ${e.label || e.source} (req: ${e.condition})`);
    out += ` · [conditional, not active: ${inacLines.join(', ')}]`;
  }
  return out || 'no sources';
}
// ========== SHEET ==========
// ========== STAT BREAKDOWN DRILLDOWN ==========
// Open a modal showing the bonus contributions to a single stat. The character
// is taken from curId; the stat key indexes into computeStatBlock's output.
// Stat keys: 'bab', 'def', 'fort', 'ref', 'will', 'rep', 'ac'.
function showStatBreakdown(statKey){
  if(!curId)return;
  const c=chars.find(x=>x.id===curId);if(!c)return;

  // v8.1.7: T/ACtical Combat System drilldowns. AC tiers, Parry, and Dodge are
  // computed from the existing stat block plus equipment fields, not from the
  // bonus aggregator pipeline. We render their drilldowns directly.
  if (statKey === 'ac') {
    const acDisp = computeACDisplay(c);
    let body = `<div class="drilldown-head">
      <span>${acDisp.label} — Armor Class Tiers</span>
      <span class="drilldown-total">${acDisp.value}</span>
    </div>`;
    body += `<div class="drilldown-section">`;
    for (const t of acDisp.tiers) {
      body += `<div class="drilldown-row applied">
        <span class="drilldown-val">${t.val}</span>
        <span class="drilldown-src"><b>${t.name}</b><br><span style="font-size:11px;opacity:.7;">${t.formula}</span></span>
        <span></span>
      </div>`;
    }
    body += `</div>`;
    body += `<div style="font-size:11px;color:var(--g50);margin-top:.8rem;line-height:1.5;">
      T/ACtical Combat layers AC into tiers. An attack roll less than Touch misses entirely. A roll equal to Touch but less than Armor hits the character's equipment (damage resolves vs armor hardness). A roll equal to Armor but less than NatCrit hits the body but natural hardness applies. A roll equal to or greater than NatCrit (or the highest tier shown) is the threshold to confirm a critical hit, bypassing all armor including natural. (HH p.347)
    </div>`;
    body += `<button class="drilldown-close" onclick="closeDrilldown()">Close</button>`;
    document.getElementById('drilldown-panel').innerHTML = body;
    document.getElementById('drilldown-bg').classList.add('open');
    return;
  }
  if (statKey === 'parry') {
    const parry = computeParryBonus(c);
    let body = `<div class="drilldown-head">
      <span>Parry Attempt</span>
      <span class="drilldown-total">${parry.total>=0?'+':''}${parry.total}</span>
    </div>`;
    body += `<div class="drilldown-section"><div class="drilldown-section-title">Formula: BAB + Str + Defense + Shield</div>`;
    for (const p of parry.parts) {
      body += `<div class="drilldown-row applied">
        <span class="drilldown-val">${p.value>=0?'+':''}${p.value}</span>
        <span class="drilldown-src">${p.label}</span>
        <span></span>
      </div>`;
    }
    body += `</div>`;
    body += `<div style="font-size:11px;color:var(--g50);margin-top:.8rem;line-height:1.5;">
      A parry is an immediate free action (when readied) against a melee attack. Roll 1d20 + this modifier vs. the attacker's roll. Equal-or-greater parries the attack. Only a natural 20 parries a natural 20. Parry can only block melee attacks; readying a parry costs a move action (swift with Defensive Martial Arts; free with Improved Defensive Martial Arts; immediate free with Advanced Defensive Martial Arts). (HH p.377)
    </div>`;
    body += `<button class="drilldown-close" onclick="closeDrilldown()">Close</button>`;
    document.getElementById('drilldown-panel').innerHTML = body;
    document.getElementById('drilldown-bg').classList.add('open');
    return;
  }
  if (statKey === 'dodge') {
    const dodge = computeDodgeBonus(c);
    let body = `<div class="drilldown-head">
      <span>Dodge Attempt</span>
      <span class="drilldown-total">${dodge.total>=0?'+':''}${dodge.total}</span>
    </div>`;
    body += `<div class="drilldown-section"><div class="drilldown-section-title">Formula: Reflex save + Defense + dodge bonuses</div>`;
    for (const p of dodge.parts) {
      body += `<div class="drilldown-row applied">
        <span class="drilldown-val">${p.value>=0?'+':''}${p.value}</span>
        <span class="drilldown-src">${p.label}</span>
        <span></span>
      </div>`;
    }
    body += `</div>`;
    if (dodge.conditional.length) {
      body += `<div class="drilldown-section"><div class="drilldown-section-title">Conditional Dodge Bonuses (situational)</div>`;
      for (const cb of dodge.conditional) {
        body += `<div class="drilldown-row inactive">
          <span class="drilldown-val">+${cb.value}</span>
          <span class="drilldown-src">${cb.source} <span class="drilldown-cond">[when ${cb.condition}]</span></span>
          <span></span>
        </div>`;
      }
      body += `</div>`;
    }
    body += `<div style="font-size:11px;color:var(--g50);margin-top:.8rem;line-height:1.5;">
      A dodge is an immediate free action (when readied) against an incoming attack. Roll 1d20 + this modifier vs. the attacker's roll. Equal-or-greater dodges the attack. Only a natural 20 dodges a natural 20. Dodge can be used against ranged attacks as well as melee. Readying a dodge costs a move action (swift with Dodge feat; free with Improved Dodge; immediate free with Advanced Dodge). Dodge bonuses stack with each other, unlike most bonus types. (HH p.373)
    </div>`;
    body += `<button class="drilldown-close" onclick="closeDrilldown()">Close</button>`;
    document.getElementById('drilldown-panel').innerHTML = body;
    document.getElementById('drilldown-bg').classList.add('open');
    return;
  }
  if (statKey === 'natHardness') {
    // v8.6.0 (Adam's Scaly Armor question): the drilldown read the STORED
    // c.naturalAC only — mutation/item/talent NAC (Scaly Armor, Exoskeleton,
    // Amulet of Natural Armor) was missing. Now the full aggregation, with
    // per-source provenance rows.
    const natComp = computeNaturalAC(c);
    const natAC = natComp.total;
    let body = `<div class="drilldown-head">
      <span>Natural Hardness</span>
      <span class="drilldown-total">${natAC}</span>
    </div>`;
    body += `<div class="drilldown-section">`;
    for (const e of ((natComp.breakdown && natComp.breakdown.applied) || [])) {
      body += `<div class="drilldown-row applied">
        <span class="drilldown-val">+${e.value}</span>
        <span class="drilldown-src">${escapeHTML(e.label || e.source)} (${escapeHTML(e.type || 'untyped')})</span>
        <span></span>
      </div>`;
    }
    for (const e of ((natComp.breakdown && natComp.breakdown.superseded) || [])) {
      body += `<div class="drilldown-row" style="opacity:.45;">
        <span class="drilldown-val">+${e.value}</span>
        <span class="drilldown-src">${escapeHTML(e.label || e.source)} — superseded (same-type, best wins)</span>
        <span></span>
      </div>`;
    }
    body += `<div class="drilldown-row applied">
        <span class="drilldown-val">+${(natComp.permTotal ?? natAC) * 5}</span>
        <span class="drilldown-src">Bonus HP from PERMANENT natural AC (×5 HP per +1${natComp.permTotal < natAC ? ' — equipped-item NAC grants hardness but no HP: those hit points would be temporary' : ''})</span>
        <span></span>
      </div>
    </div>`;
    body += `<div style="font-size:11px;color:var(--g50);margin-top:.8rem;line-height:1.5;">
      Per HH p.347 — every +1 of natural AC modifier grants +5 HP and 1 point of natural hardness. Natural hardness applies to any physical damage (except acid damage) or any naturally-occurring damage; null energy attacks ignore hardness. When an attack lands at or above the Armor tier but below the NatCrit tier in the T/ACtical Combat System, damage hits the character's body but natural hardness applies first. (GG p.110)
    </div>`;
    body += `<button class="drilldown-close" onclick="closeDrilldown()">Close</button>`;
    document.getElementById('drilldown-panel').innerHTML = body;
    document.getElementById('drilldown-bg').classList.add('open');
    return;
  }

  const block=computeStatBlock(c, new Set(c.activeConditions||[]));
  const stat=block[statKey];
  if(!stat){closeDrilldown();return;}
  const labels={bab:'Base Attack',def:'Defense Bonus',fort:'Fortitude Save',ref:'Reflex Save',will:'Will Save',rep:'Reputation',ac:'Armor Class',init:'Initiative',hp:'Max Hit Points'};
  const label=labels[statKey]||statKey;
  const totalStr=(statKey==='ac' || stat.total>=0?'+':'')+stat.total;
  const display=statKey==='ac' ? String(stat.total) : totalStr;
  const fmtRow=(b,cls)=>{
    const valStr=(b.value>=0?'+':'')+b.value;
    const condTag=b.condition?`<span class="drilldown-cond">[when ${b.condition}]</span>`:'';
    const typeTag=b.type?`<span class="drilldown-type">${b.type}</span>`:'';
    return `<div class="drilldown-row ${cls}">
      <span class="drilldown-val">${valStr}</span>
      <span class="drilldown-src">${b.label||b.source||''}${condTag}</span>
      <span>${typeTag}</span>
    </div>`;
  };
  const applied=stat.breakdown.applied;
  const superseded=stat.breakdown.superseded;
  const inactive=stat.breakdown.inactive;
  let body=`<div class="drilldown-head">
    <span>${label}</span>
    <span class="drilldown-total">${display}</span>
  </div>`;
  if(applied.length){
    body+=`<div class="drilldown-section"><div class="drilldown-section-title">Applied</div>${applied.map(b=>fmtRow(b,'applied')).join('')}</div>`;
  }
  if(superseded.length){
    body+=`<div class="drilldown-section"><div class="drilldown-section-title">Superseded (same type, not best/worst)</div>${superseded.map(b=>fmtRow(b,'superseded')).join('')}</div>`;
  }
  if(inactive.length){
    body+=`<div class="drilldown-section"><div class="drilldown-section-title">Inactive (conditional)</div>${inactive.map(b=>fmtRow(b,'inactive')).join('')}</div>`;
  }
  if(!applied.length && !superseded.length && !inactive.length){
    body+=`<div style="color:var(--g50);font-style:italic;padding:.6rem 0;">No bonuses contribute to this stat.</div>`;
  }
  body+=`<div style="font-size:11px;color:var(--g50);margin-top:.8rem;line-height:1.5;">Bonuses follow the GM's Guide stacking rules: same-type bonuses don't stack (best positive + worst negative apply); Dodge, Circumstance, and Untyped bonuses self-stack; same-source bonuses (e.g. two castings of the same spell) collapse to one regardless of type.</div>`;
  body+=`<button class="drilldown-close" onclick="closeDrilldown()">Close</button>`;
  document.getElementById('drilldown-panel').innerHTML=body;
  document.getElementById('drilldown-bg').classList.add('open');
}
function closeDrilldown(){
  document.getElementById('drilldown-bg').classList.remove('open');
}

// v8.3.4: Apply the racial natural AC defect to the current character.
// Used by the migration banner shown on the sheet view when c.naturalAC is
// less than RACES[c.race].natAC. Increments c.naturalAC to the racial value,
// recomputes maxHP (+5 per point of NAC per HH p.347), preserves the
// HP-percent ratio for currentHP, logs the change, saves, and re-renders.
function applyRacialNatAC() {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const target = racialNatACOf(c);
  // v8.3.5: read the effective current value via the source-aware computer,
  // so legacy scalar-only characters and source-list characters are handled
  // uniformly.
  const currentEffective = computeNaturalAC(c).total;
  if (target <= currentEffective) {
    toast('No racial NAC deficit.');
    return;
  }
  const diff = target - currentEffective;
  const oldMaxHP = c.maxHP || 1;
  const oldRatio = (c.currentHP || 0) / oldMaxHP;
  const hpBonus = 5 * diff;
  // v8.3.5: add a structured racial source entry. If the character already
  // has a 'race:<X>' source, replace it (race-source dedup); otherwise add
  // a new one. The legacy c.naturalAC scalar is also updated to match the
  // new effective total for any reader that hasn't been migrated yet.
  if (!Array.isArray(c.naturalACSources)) c.naturalACSources = [];
  const racialSource = buildRacialNaturalACSource(c.race);
  if (racialSource) {
    // Remove any existing race:* entry to prevent stale duplicates
    c.naturalACSources = c.naturalACSources.filter(s => !(s.source && s.source.startsWith('race:')));
    c.naturalACSources.push(racialSource);
  }
  // Drop any stale 'legacy:naturalAC' entry now that we have structured sources
  c.naturalACSources = c.naturalACSources.filter(s => s.source !== 'legacy:naturalAC');
  // Re-cache the scalar from the effective source-aware total
  c.naturalAC = computeNaturalAC(c).total;
  c.maxHP = oldMaxHP + hpBonus;
  c.currentHP = Math.max(0, Math.min(c.maxHP, Math.round(oldRatio * c.maxHP)));
  delete c._natACDismissed;
  save();
  logAct(`Applied racial Natural AC +${diff} from ${c.race} (Nat. AC: ${currentEffective} → ${c.naturalAC}; +${hpBonus} HP).`);
  toast(`Natural AC set to ${c.naturalAC}. +${hpBonus} HP applied.`);
  renderSheet();
  renderTracker();
  renderRoster();
}

// v8.3.4: dismiss the racial-NAC migration banner for the current character.
// Stores a per-character flag tied to the current race + racial NAC value
// so the banner doesn't reappear if nothing has changed. If the player
// later changes race or the race's natAC value changes, the flag's key
// no longer matches and the banner re-fires.
function dismissNatACBanner() {
  if (!curId) return;
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const racialNatAC = racialNatACOf(c);
  c._natACDismissed = `${c.race}:${racialNatAC}`;
  save();
  renderSheet();
}

function renderSheet(){
  const prompt=document.getElementById('sh-prompt'),cont=document.getElementById('sh-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=chars.find(x=>x.id===curId);if(!c){prompt.style.display='block';cont.style.display='none';return;}
  prompt.style.display='none';cont.style.display='block';
  // Repairs that keep older or partly-built records consistent. Each one
  // saves only if it actually changed something.
  healCharacterForSheet(c);
  // v8.3.21: refresh nav-tab visibility for this character.
  renderNavTabs(c);
  const classArr=migrateLegacyClasses(c);
  renderSheetHeader(c, classArr);
  renderGMExceptions(c);
  // v8.39.0: refresh the Career Compass panel (goal checklist + advisor).
  renderCareerCompass(c);
  // v8.42.0: refresh the active-power-effects chips.
  renderActiveBuffs(c);
  // v8.46.0: refresh the Mind's Ledger (Horror saves, sanity, the Swoon).
  renderMindsLedger(c);
  // v8.3.20: refresh the persistent condition banner on every sheet re-render.
  renderSheetConditionBanner(c);
  // v8.4.0: refresh the Hero's Gift assignment panel. Hidden for legacy /
  // non-Hero characters; shows the unassigned-or-assigned state otherwise.
  renderHerosGiftPanel(c);
  renderSheetAttributes(c);
  const cM=effAm(c,2),dM=effAm(c,1),wM=effAm(c,4);  // v8.6.0 firm-wire: effective mods
  const natComputed = computeNaturalAC(c);
  renderNatACMigrationBanner(c, natComputed);
  renderSheetCombatStats(c, natComputed, dM);
  renderSheetDefenseStrip(c);
  renderSheetStateBanners(c);
  // v8.8.3: the 🎓 Class Choices panel + 🐾 Companions.
  renderClassChoices(c);
  renderCompanions(c);
  renderSheetSaves(c, cM, dM, wM);
  renderSheetArmaments(c);
  renderSheetXP(c);
  document.getElementById('sh-features').innerHTML = sheetFeaturesHtml(c, classArr);
  renderSheetFooter(c, classArr);
  renderDrilldown(c);
}

// Sheet: self-healing repairs run every time the Sheet opens (cyber feats,
// ECL/XP, mutant subtype, legacy preset names, missing derived stats).
function healCharacterForSheet(c) {
  // v8.99.0 self-heal (Adam's Rhad confirmation): implant-granted feats
  // materialize on Sheet render too — a character opened straight to the
  // Sheet gets their Feat Implant feats without visiting Gear first.
  syncCyberFeats(c);
  // v8.12.4 self-heal (Adam's Rhad ECL-13 report): the stored c.ecl/xpNext
  // can go stale when an ML threshold is crossed by a path that skips the
  // full edit-save (or drop when MP sources are removed). refreshEclXp is
  // idempotent — the XP-compensation ratchet inside grants nothing twice —
  // so re-stamp on every Sheet render; matches the reconcileMissingHP
  // render-hook pattern.
  { const _preEcl = c.ecl; refreshEclXp(c); if (c.ecl !== _preEcl) save(); }
  // v8.67.0 (Mutant sync): Unnatural Prowess/Resilience bakes reconcile on
  // every Sheet render (idempotent — same hook pattern as reconcileMissingHP).
  if (reconcileMutantSubtype(c)) save();
  // v8.40.3 self-heal (Adam's Dutch dashboard report): records assembled
  // without the stored derived stats (v8.40.0–v8.40.2 Quickdraw skeletons)
  // rendered "Base Attack: undefined" and AP 0/0. c.bab === undefined is
  // unambiguous brokenness — every save/level-up path stamps it — so stamp
  // the whole derived block once and persist. Existing characters with a
  // defined bab are never touched.
  // v8.45.0 self-heal: pre-rename preset names on stored characters migrate
  // one-way to the Worlds family (display already normalizes; this makes
  // the stored value itself current).
  if (c.scenarioPreset && PRESET_LEGACY[c.scenarioPreset]) {
    c.scenarioPreset = PRESET_LEGACY[c.scenarioPreset];
    save();
  }
  if (c.bab === undefined && Array.isArray(c.classes) && c.classes.length) {
    try {
      // v9.15.2 (§275 F3+F12): the heal passes Cha and the AP-effective
      // Heroic Scale (the bare call granted AP for monstrous/Ordinary-only
      // records and resolved no 'cha' apB), and restamps totalLvl too —
      // ECL, skill caps and level-up math were wrong until an Edit → Save.
      const s = computeStatsFromClasses(c.classes, (c.attrs && c.attrs[5]) || 10, effectiveHeroicLevelForAP(c), c.fatePoints || 0);
      c.bab = s.bab; c.def = s.def; c.fort = s.fort; c.ref = s.ref; c.will = s.will; c.rep = s.rep;
      c.apMax = s.ap; c.ap = s.ap;
      c.totalLvl = s.totalLvl;
      // v8.67.0: the stamp rebuilt bab/def from class tables — zero the
      // Unnatural Prowess ledger halves so the reconciler re-applies.
      if (c.mutSubApplied) { c.mutSubApplied.bab = 0; c.mutSubApplied.def = 0; reconcileMutantSubtype(c); }
      if (c.currentHP === undefined && c.maxHP !== undefined) c.currentHP = c.maxHP;
      save();
    } catch (e) { /* heal is best-effort — never block the Sheet */ }
  }
}

// Sheet: the name, the race/class/occupation line and the tag chips.
function renderSheetHeader(c, classArr) {
  document.getElementById('sh-name').textContent=c.name;
  // Class summary line — joins each class with its level
  const classParts=classArr.map(e=>`${e.name} ${e.level}`);
  const occList = (c.occupations && c.occupations.length) ? c.occupations : (c.occ ? [c.occ] : []);
  const occText = occList.length === 0 ? 'No occupation' : (occList.length > 1 ? `${occList.join(' + ')} (Moonlighter)` : occList[0]);
  document.getElementById('sh-meta').textContent=`${c.sex?c.sex+' ':''}${c.race} · ${classParts.join(' + ')||'No class'} · ${occText}${c.player?' · Player: '+c.player:''}`;
  const heroicLvl=(c.sixLevels?.heroic) ?? c.heroicLevel ?? 0;
  let scenarioBadge='';
  // v8.3.24: prefer the saved scenarioTitle (auto-generated or player-overridden);
  // fall back to the preset name for legacy characters saved before v8.3.24.
  if (c.scenarioTitle) {
    scenarioBadge = `<span class="tag tb" title="Scenario Title (auto-generated or player-overridden)">${escapeHTML(c.scenarioTitle)}</span>`;
  } else if (c.scenarioPreset && c.scenarioPreset !== 'Custom') {
    scenarioBadge = `<span class="tag tb">${escapeHTML(normalizePresetName(c.scenarioPreset))}</span>`;
  }
  // v8.3.20: Heroic Scale banner row rewritten. The pre-v8.3.20 row contained
  // five unsourced/invented labels (Heroic Bonuses, Force of Will, Cinematic
  // Drama, Hubris, Iconic — none in HH or GG). Now the row shows:
  //   • the canonical Heroic Scale tier name from HEROIC_LEVEL_NAMES
  //   • Action Points availability (H1+)
  //   • Heroic Action Points availability (H2+ AND Hero class)
  //   • Fate Points availability (H5+ AND Hero class, purple-tinted)
  // HAP/FP gate on Hero class membership per HH p.55 — the pre-v8.3.20 banners
  // didn't check this, which would mistakenly suggest a Wizard at H5 has FP.
  const _cap_sh = getHeroicCapabilities(c);
  const heroicTierBadge = (heroicLvl >= 0)
    ? `<span class="tag te">Heroic ${heroicLvl} — ${escapeHTML(HEROIC_LEVEL_NAMES[heroicLvl] || '?')}</span>`
    : '';
  document.getElementById('sh-tags').innerHTML=
    `<span class="tag tg">${c.align}</span>`+
    (c.allegiance?`<span class="tag tb">${c.allegiance}</span>`:'')+
    scenarioBadge+
    heroicTierBadge+
    (_cap_sh.hasAP  ?'<span class="tag te">Action Points</span>':'')+
    (_cap_sh.hasHAP ?'<span class="tag te">Heroic Action Points</span>':'')+
    (_cap_sh.hasFP  ?'<span class="tag tr" style="background:rgba(196,153,212,.18);border-color:rgba(196,153,212,.55);color:var(--vio);">Fate Points</span>':'');
}

// Sheet: the six attribute boxes, with level bumps, mutation, item and
// active-buff annotations.
function renderSheetAttributes(c) {
  // v8.2.3 (Issue B): show a small "+1" indicator on attributes that received
  // bumps from leveling. Each box: name, effective value (already includes
  // bumps since c.attrs is effective), mod, and—if bumped—a subtle annotation.
  const bumpCountPerAttr = {};
  for (const b of (c.attrBumps || [])) {
    if (b) bumpCountPerAttr[b] = (bumpCountPerAttr[b] || 0) + 1;
  }
  // v8.6.0: sync + annotate baked attribute-mutation bonuses — same
  // effective-value convention as bumps. Adam's effect-type caveat: the
  // Extraordinary tier is an EXTRAORDINARY (Ex) effect — never negated —
  // while the Supernatural tiers are SUPERNATURAL (Su) effects, temporarily
  // negatable by Null Power Field and similar; the annotation types each
  // portion separately rather than lumping them as "mutation".
  if (reconcileAttributeMutations(c)) save();
  const mutExPerAttr = {}, mutSuPerAttr = {}, mutNamesPerAttr = {};
  for (const m of (c.mutations || [])) {
    if (m.kind === 'attribute' && m.attrApplied && m.attr) {
      const su = m.name.startsWith('Supernatural');
      const bag = su ? mutSuPerAttr : mutExPerAttr;
      bag[m.attr] = (bag[m.attr] || 0) + m.attrApplied;
      (mutNamesPerAttr[m.attr] = mutNamesPerAttr[m.attr] || []).push(m.name.replace('[Attribute]', ATTR_FULL[m.attr] || m.attr) + (su ? ' (Su)' : ' (Ex)'));
    }
  }
  // v8.6.0 firm-wire: equipped-item enhancements display as "base (effective)"
  // with a provenance tag — derived live, never written into c.attrs.
  const itemAttrB = attrItemBonuses(c);
  document.getElementById('sh-attrs').innerHTML=ATTR_NAMES.map((a,i)=>{
    const bumpCount = bumpCountPerAttr[a] || 0;
    const bumpTag = bumpCount > 0
      ? `<div style="font-family:'Epics Serif','Crimson Pro',serif;font-size:9px;color:var(--g55);font-style:italic;margin-top:2px;">+${bumpCount} level bump${bumpCount>1?'s':''}</div>`
      : '';
    const mutEx = mutExPerAttr[a] || 0, mutSu = mutSuPerAttr[a] || 0;
    const mutBits = [];
    if (mutEx > 0) mutBits.push(`+${mutEx} (Ex)`);
    if (mutSu > 0) mutBits.push(`+${mutSu} (Su)`);
    const mutTag = mutBits.length
      ? `<div style="font-family:'Epics Serif','Crimson Pro',serif;font-size:9px;color:var(--tv80);font-style:italic;margin-top:2px;cursor:help;" title="${escapeHTML(mutNamesPerAttr[a].join(' + '))} — Extraordinary (Ex) bonuses are never negated; Supernatural (Su) bonuses can be temporarily negated by effects that suppress supernatural abilities (e.g. Null Power Field).">${mutBits.join(' · ')}</div>`
      : '';
    const iB = itemAttrB.best[i] || 0;
    // v8.60.1 (Adam's Animal Affinity report): the ✨ transient-buff door
    // (activeBuffAttrDeltas) joins the card display — the ENGINES honored it
    // since v8.43.0 (effAttrs feeds attacks, skills, DCs, grapple), but the
    // ability boxes only ever showed the item door, so a wired Animal
    // Affinity was invisible exactly where the player looks first.
    const buffD = (activeBuffAttrDeltas(c)[i] || 0);
    const effV = c.attrs[i] + iB + buffD;
    const itemTag = iB > 0
      ? `<div style="font-family:'Epics Serif','Crimson Pro',serif;font-size:9px;color:var(--tb85);font-style:italic;margin-top:2px;cursor:help;" title="${escapeHTML(itemAttrB.from[i] || '')} — enhancement bonus while equipped (firm-wired: saves, skills, DCs, and attacks use the effective score; stored max HP does not follow item CON — RAW treats those hit points as temporary).">+${iB} equipped</div>`
      : '';
    const buffTag = buffD !== 0
      ? `<div style="font-family:'Epics Serif','Crimson Pro',serif;font-size:9px;color:var(--ty85);font-style:italic;margin-top:2px;cursor:help;" title="Active power effects (✨ panel below) — ${escapeHTML((c.activeEffects || []).filter(ae => (ae.effects || []).some(e => e.k === 'attr' && e.attr === a)).map(ae => ae.name).join(' + ') || 'wired buff')}. Clears on rest or the chip's ✕; suppressed while ⊘ Nullified.">${buffD > 0 ? '+' : ''}${buffD} ✨ active</div>`
      : '';
    return `<div class="attr-box"><span class="attr-nm">${a}</span>
    <span class="attr-inp" style="font-family:'Epics Serif','Cinzel',serif;font-size:21px;font-weight:600;display:block;">${c.attrs[i]}${(iB > 0 || buffD !== 0) ? ` <span style="font-size:13px;color:var(--pb90);">(${effV})</span>` : ''}</span>
    <span class="attr-mod">${ms(effV)}</span>${bumpTag}${mutTag}${itemTag}${buffTag}</div>`;
  }).join('');
}

// Sheet: the one-click banner offered when a race grants natural AC that
// the stored character lacks. natComputedForBanner = computeNaturalAC(c).
function renderNatACMigrationBanner(c, natComputedForBanner) {
  // v8.3.4: Racial NAC migration check. If the character's race grants a
  // structured natAC value that's HIGHER than what the character has stored
  // (e.g. character was created before natAC was added to the race data),
  // surface a banner with a one-click apply button. The banner is dismissable
  // and the apply is reversible (player can edit c.naturalAC back down if needed).
  // v8.3.4 / v8.3.5: Racial NAC migration check.
  // v8.3.4 fired this whenever c.naturalAC < race.natAC.
  // v8.3.5 promotes the model to source-attributed: the banner now fires
  // when the character lacks a race:<currentRace> source AND the race grants
  // natAC. This handles both pre-v8.3.4 characters (no scalar) and v8.3.4
  // characters (scalar present but no source list) cleanly. The banner does
  // NOT fire if the player has a structured racial source matching their
  // current race — the rule is "race is properly represented in your sources."
  const racialNatAC = racialNatACOf(c);
  const hasMatchingRacialSource = (c.naturalACSources || []).some(
    s => s.source === `race:${c.race}` && s.type === BONUS_TYPES.NATURAL
  );
  const charEffectiveNAC = natComputedForBanner.total;
  // Migration needed if: race grants NAC, AND the character either (a) has
  // no matching racial source entry, OR (b) effective total is less than racial.
  const needsMigration = racialNatAC > 0 && (!hasMatchingRacialSource || charEffectiveNAC < racialNatAC);
  const natACMigrationBanner = document.getElementById('sh-natac-migration');
  if (natACMigrationBanner) {
    if (needsMigration) {
      const diff = Math.max(1, racialNatAC - charEffectiveNAC);
      const currentLabel = charEffectiveNAC > 0
        ? `effective ${charEffectiveNAC} (from legacy sources)`
        : '0';
      natACMigrationBanner.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="color:var(--vio);font-size:14px;">⚜</span>
          <div style="flex:1;">
            <b style="color:var(--vio);">Racial Natural AC ${hasMatchingRacialSource ? 'incomplete' : 'missing'}.</b>
            <div style="color:var(--g75);font-size:11px;margin-top:3px;line-height:1.45;">
              ${escapeHTML(c.race)} grants <b>+${racialNatAC} Natural AC</b>, but this character has ${currentLabel}.
              Apply will ${hasMatchingRacialSource ? 'sync the racial entry' : 'add a structured racial source'} (+${diff} effective NAC),
              <b>+${5*diff} HP</b>, and <b>+${diff} natural hardness</b> per HH p.347.
            </div>
            <div style="margin-top:6px;display:flex;gap:6px;">
              <button class="btn btn-sm btn-pri" onclick="applyRacialNatAC()" style="font-size:11px;">Apply +${diff}</button>
              <button class="btn btn-sm" onclick="dismissNatACBanner()" style="font-size:11px;">Dismiss</button>
            </div>
          </div>
        </div>
      `;
      const dismissedKey = `${c.race}:${racialNatAC}`;
      if (c._natACDismissed === dismissedKey) {
        natACMigrationBanner.style.display = 'none';
      } else {
        natACMigrationBanner.style.display = 'block';
      }
    } else {
      natACMigrationBanner.style.display = 'none';
    }
  }
}

// Sheet: the Combat Statistics grid (HP, AC, Initiative, AP, Base Attack,
// Grapple, Speed, Reputation, Defense, Parry, Dodge, then any of Nat.
// Hardness, SR and DR). dM = effective Dex modifier.
function renderSheetCombatStats(c, natComputed, dM) {
  const acDisp = computeACDisplay(c, {naturalAC: natComputed});
  const parry  = computeParryBonus(c);
  const dodge  = computeDodgeBonus(c);
  // v8.3.5: natural hardness derives from the EFFECTIVE natural AC (after
  // same-type stacking resolution), not the raw sum. Tooltip shows the
  // provenance so the player can see why their effective NatAC is what it is.
  const natHardness = natComputed.total;
  const natTooltip = natHardness > 0 ? renderSourcedValueProvenance(natComputed.breakdown) : '';
  // v8.12.2 (Adam): Grapple promoted from the Carry-line footnote to a
  // first-class combat cell alongside BAB/Defense — it's a headline combat
  // modifier, not encumbrance trivia.
  const grap = computeGrapple(c);
  // v8.59.0 (Adam's trade-off challenge): the Base Attack card grows the
  // declared-stance stepper when Power Attack / Combat Expertise is owned.
  // ▼ trades a point of BA into a modifier (prompting which, when both feats
  // are owned); ▲ returns one. The declaration is a SET POINT — it holds
  // until re-declared (Adam's ruling), survives save/reload, and may legally
  // drive effective BA to 0. v8.76.0 (Adam's Hellfire report): CE's +N and
  // RO's −4 now do REAL math on AC/Parry/Dodge (ac lane + the parry/dodge
  // compute functions — Best Defense's wire); the tags remain as provenance.
  const _dcl = combatDecl(c);
  const _dclOwn = ownsFeatN(c, 'Power Attack') || ownsFeatN(c, 'Combat Expertise');
  const _dclSpent = _dcl.pa + _dcl.ce;
  const _effBA = (c.bab || 0) - _dclSpent;
  const _ceTag = _dcl.ce ? `<span style="display:block;font-size:9px;color:#78afcd;" title="Combat Expertise declared stance — this +${_dcl.ce} dodge bonus also applies to TOUCH AC (HH p.207). Lasts until re-declared.">+${_dcl.ce} CE (declared)</span>` : '';
  // v8.63.0: Reckless Offense's −4 AC rides the same display convention as
  // the CE tag (attack rolls carry the +2; BA/Grapple expressly untouched).
  const _roTag = _dcl.ro ? `<span style="display:block;font-size:9px;color:var(--red-text);" title="Reckless Offense declared — −4 AC until your next turn for +2 on melee attack rolls, Grapple included (HH p.239; a grapple check is like a melee attack roll). Base Attack and the iterative ladder untouched (Adam's ruling). Lasts until re-declared.">−4 RO (declared)</span>` : '';
  // v8.64.0 (Phase 2 sift): Uncanny Dodge tag (class features + Fast Hero
  // talents through uncannyDodgeTier) and the Sharpshooter cover advisory.
  const _ud = uncannyDodgeTier(c);
  const _udTag = _ud ? `<span style="display:block;font-size:9px;color:#9cc3da;font-style:italic;" title="${_ud.tier >= 2 ? 'Improved Uncanny Dodge: you keep your Dex bonus to AC while flat-footed or struck by an invisible attacker, AND you cannot be flanked (a Rogue needs 4+ more Rogue levels to sneak-attack you via flanking).' : 'Uncanny Dodge: you keep your Dex bonus to AC while flat-footed or struck by an invisible attacker.'} Sources: ${_ud.srcs.join(', ')}. Uncanny Dodge from a second class upgrades to Improved automatically.">${_ud.tier >= 2 ? 'Imp. Uncanny Dodge' : 'Uncanny Dodge'}</span>` : '';
  const _dpTag = (_cfLvlOf(c, 'Sharpshooter') >= 4) ? `<span style="display:block;font-size:9px;color:#d4b870;font-style:italic;" title="Defensive Positioning (Sharpshooter 4): when in ANY cover, your cover bonus to Defense and Reflex saves is +2 higher than normal.">+2 cover (conditional)</span>` : '';
  // v8.88.2 (Adam's priority re-order, 2026-10-03): the cells rank by their
  // relative importance at the table — Row 1: Max HP, AC, Initiative, Action
  // Points; Row 2: Base Attack, Grapple, Speed, Reputation; Row 3: Defense
  // Bonus, Parry, Dodge; then the as-incurred defensive cells (Nat.
  // Hardness, SR, DR, …) trail only when the character has them.
  const spd = computeSpeeds(c);
  const spdVal = `${spd.walk}′${spd.modes.map(m => ` / ${m.type} ${m.speed}′`).join('')}`;
  // v8.8.0 (Adam's Talents sweep): the Initiative CELL shows the full
  // computed total (Improved Initiative, talent init bonuses).
  const initTotal = (computeStatBlock(c).init) ? computeStatBlock(c).init.total : dM;
  const _baCell = sheetBaseAttackCell(c, _dcl, _dclOwn, _dclSpent);
  const _defCell = sheetDefenseBonusCell(c, _dcl);
  const _repCell = sheetReputationCell(c);
  const statCells = [
    // Row 1 — the vitals.
    {l:'Max HP',v:c.maxHP,k:'hp'},
    {l:acDisp.label, v:acDisp.value, k:'ac', extraHtml:_ceTag + _roTag + _udTag + _dpTag},
    {l:'Initiative',v:(initTotal>=0?'+':'')+initTotal,k:'init'},
    {l:'Action Points',v:`${c.ap||0}/${c.apMax||0}`},
    // Row 2 — the actives.
    _baCell,
    ...(grap ? [{l:'Grapple', v:(grap.total>=0?'+':'')+grap.total, tooltip: grap.parts.join(' + ') + ' — size uses the effective category (Super-Strong riders included).'}] : []),
    {l:'Speed', v: spdVal, tooltip: `Walk ${spd.walk}′ (${spd.parts.join(' · ')}) · Run ${spd.run}${spd.modes.map(m => ` · ${m.type} ${m.speed}′ — ${m.note}`).join('')}`},
    _repCell,
    // Row 3 — the defensive ladder.
    _defCell,
    // v8.97.0 (Adam's flag request): ⚡ declaration-speed tags — when a feat
    // readies the parry/dodge as a swift action or faster, the cell says so.
    {l:'Parry', v:(parry.total>=0?'+':'')+parry.total, k:'parry', extraHtml:_ceTag + _roTag
      + (parry.ready ? `<span style="font-size:9px;color:#78afcd;margin-left:3px;cursor:help;" title="${escapeHTML(`Parry readies as a ${parry.ready.speed} — ${parry.ready.by} (HH p.373). Base: an ordinary readied action.`)}">⚡ ${parry.ready.speed.split(' ')[0]}</span>` : '')
      + (parry.shieldParry ? `<span style="font-size:9px;color:#78afcd;margin-left:3px;cursor:help;" title="Shield Parry: once per round, parry ANY incoming attack that rolls to hit — ranged included — as an immediate action with your shield (feat text).">🛡⚡</span>` : '')},
    {l:'Dodge', v:(dodge.total>=0?'+':'')+dodge.total, k:'dodge', extraHtml:_ceTag + _roTag + _udTag
      + (dodge.ready ? `<span style="font-size:9px;color:#78afcd;margin-left:3px;cursor:help;" title="${escapeHTML(`Dodge readies as a ${dodge.ready.speed} — ${dodge.ready.by} (HH p.372). Base: an ordinary readied action.`)}">⚡ ${dodge.ready.speed.split(' ')[0]}</span>` : '')},
  ];
  // Nat. Hardness / SR / DR: only when the character has them.
  statCells.push(...sheetExtraDefenseCells(c, natHardness, natTooltip));
  // v8.88.2: Speed/Initiative/AP/HP/Reputation moved into the ordered array
  // above (Adam's priority re-order) — only the as-incurred defensive cells
  // (Nat. Hardness / SR / DR) append past the fixed eleven.
  document.getElementById('sh-stats').innerHTML = statCells.map(s=>{
    const drillCls=s.k?'stat-cell drillable':'stat-cell';
    const click=s.k?` onclick="showStatBreakdown('${s.k}')"`:'';
    const title=s.tooltip?` title="${escapeHTML(s.tooltip)}"`:'';
    return `<div class="${drillCls}"${click}${title}><span class="sc-lbl">${s.l}</span><span class="sc-val">${s.v}</span>${s.extraHtml || ''}</div>`;
  }).join('');
}

// Sheet: the Base Attack cell, with the Power Attack / Combat Expertise
// declaration stepper when either feat is owned.
function sheetBaseAttackCell(c, _dcl, _dclOwn, _dclSpent) {
  // v9.12.1 (§270, Adam's re-reading): the stances are penalties to MELEE
  // ATTACK ROLLS — Base Attack is never spent, so the cell always shows the
  // printed value (no effective-BA arithmetic, no lost iteratives). The
  // Defense Bonus bump is CE's engaged-flag; the chips here are PA's.
  const _paCap = (c.bab || 0), _ceCap = Math.min(5, c.bab || 0);
  // v9.17.1 (§278, Adam's Xander report #2): the headline shows the COMPUTED
  // bab total like every sibling cell — modifiers (active buffs, mutant
  // lanes, feat bonuses) reached the drilldown but the cell printed the
  // stored base. The §270 stance doctrine is untouched: PA/CE never enter
  // the bab lane — they remain attack-ROLL penalties, chipped below.
  const _baTotal = (() => { try { return computeStatBlock(c).bab.total; } catch (e) { return c.bab || 0; } })();
  const _baCell = {l:'Base Attack',
     v: (_baTotal>=0?'+':'')+_baTotal,
     k:'bab',
     tooltip: _dclOwn ? `Declared stance — holds until re-declared. Power Attack ${_dcl.pa} · Combat Expertise ${_dcl.ce}: each is a PENALTY ON MELEE ATTACK ROLLS while engaged (Grapple included — a grapple check is like a melee attack roll), never a spend of Base Attack: the printed value stands, and the iterative ladder never loses attacks. Power Attack adds the same number to melee damage (×2 two-handed, none on light weapons; caps at your Base Attack). Combat Expertise adds the same number to your Defense Bonus — AC, touch, dodge, and Parry all rise (HH p.207; caps at +5 or your Base Attack, whichever is less). ▼ declares a point; ▲ withdraws one.` : undefined,
     extraHtml: _dclOwn ? `<span style="display:block;margin-top:2px;white-space:nowrap;"><button class="btn btn-sm" style="font-size:9px;padding:0 6px;${(_dcl.pa >= _paCap && _dcl.ce >= _ceCap) ? 'opacity:.35;' : ''}" title="Declare a point of penalty on melee attack rolls (Power Attack / Combat Expertise)" onclick="event.stopPropagation();baDeclAdjust(-1)">▼</button><button class="btn btn-sm" style="font-size:9px;padding:0 6px;${_dclSpent <= 0 ? 'opacity:.35;' : ''}" title="Withdraw a declared point" onclick="event.stopPropagation();baDeclAdjust(1)">▲</button>${_dclSpent ? `<span style="font-size:9px;color:#d4b870;margin-left:4px;">PA −${_dcl.pa} · CE −${_dcl.ce} (attack rolls)</span>` : ''}</span>` : ''};
  return _baCell;
}

// Sheet: the Defense Bonus cell, with the Best Defense stepper (Survivor 5+).
function sheetDefenseBonusCell(c, _dcl) {
  // v8.65.0 (Adam's go): Best Defense stepper — the BA-card idiom mirrored
  // (Survivor 5+ only; free action to adjust, holds until re-declared).
  const _defCell = (() => {
      const _bdCap = bestDefenseCap(c);
      const _bdN = _dcl.bd || 0;
      const _effDef = (c.def || 0) - _bdN;
      return {l:'Defense Bonus',
        v: _bdN ? `${_effDef >= 0 ? '+' : ''}${_effDef}` : (c.def>=0?'+':'')+c.def,
        k:'def',
        tooltip: _bdCap ? `Best Defense (Survivor, HH p.137) — trade up to +${_bdCap} of Defense Bonus (your Survivor class Defense Bonus) for an equal bonus on melee attack rolls; adjustable as a FREE action, holds until re-declared. Currently trading ${_bdN}. The spend reaches AC, Parry, Dodge, and Grapple like Power Attack's reaches Base Attack.` : undefined,
        extraHtml: _bdCap ? `<span style="display:block;margin-top:2px;white-space:nowrap;"><button class="btn btn-sm" style="font-size:9px;padding:0 6px;${_bdN >= _bdCap ? 'opacity:.35;' : ''}" title="Trade a point of Defense Bonus for +1 on melee attack rolls (Best Defense)" onclick="event.stopPropagation();bdDeclAdjust(-1)">▼</button><button class="btn btn-sm" style="font-size:9px;padding:0 6px;${_bdN <= 0 ? 'opacity:.35;' : ''}" title="Return a point of Defense Bonus" onclick="event.stopPropagation();bdDeclAdjust(1)">▲</button>${_bdN ? `<span style="font-size:9px;color:#d4b870;margin-left:4px;">BD ${_bdN}</span>` : ''}</span>` : ''};
    })();
  return _defCell;
}

// Sheet: the Reputation cell (full computed total; Renowned Artisan flag).
function sheetReputationCell(c) {
  // v8.64.0/v8.66.0: Reputation card — full computed total, Artisan flag.
  const _repCell = (() => {
      let raTag = '';
      if (_cfLvlOf(c, 'Expert') >= 15) {
        const art = (c.classChoices || {})['exp_art_5'];
        const ranks = art ? ((c.skills || {})[art] || 0) : 0;
        if (art && ranks >= 15) raTag = `<span style="display:block;font-size:9px;color:#d4b870;font-style:italic;" title="Renowned Artisan (Expert 15; ruled 2026-10-02: feature text canonical — Renowned 15th / Master 10th, table row is the typo): the equivalent of Renown, but ONLY in matters of ${escapeHTML(art)}. Call the +3 out in real time when the audience cares about the craft — it is NOT in the headline total. Also +1 Purchase DC on your works (apply at the table).">+3 Artisan renown (conditional)</span>`;
      }
      // v9.17.0 (bug report #1): Reputation prints SIGNED like its row-mates.
      const _repV = (computeStatBlock(c).rep.total);
      return {l:'Reputation',v:(_repV>=0?'+':'')+_repV,k:'rep',extraHtml:raTag};
    })();
  return _repCell;
}

// Sheet: the defensive cells that appear only when the character has them:
// Nat. Hardness, Spell Resistance, Damage Reduction.
function sheetExtraDefenseCells(c, natHardness, natTooltip) {
  const statCells = [];
  if (natHardness > 0) statCells.push({l:'Nat. Hardness', v:natHardness, k:'natHardness', tooltip:natTooltip});
  // v8.8.2 (Adam's Basic-class pass): Spell Resistance — a caster must beat
  // this on 1d20 + caster/manifester level. Best-wins, never stacks.
  const _sr = computeSR(c);
  if (_sr) statCells.push({l:'SR', v:_sr.total, tooltip:`Spell Resistance ${_sr.total} — a spell/power affects this character only if the caster wins a caster level check (1d20 + CL) ≥ ${_sr.total}.\n${_sr.note}`});
  // v8.86.0 (Adam's Son-of-the-Sun report): DR joins the Combat Statistics
  // chart the way SR does — headline = the best UNCONDITIONAL instance,
  // tooltip itemizes every instance (conditional ones flagged); the Resist
  // strip below keeps the full per-line display. Appears only when DR exists.
  const _drCell = computeDR(c);
  const _drLive = _drCell.filter(d => !d.conditional);
  if (_drLive.length) {
    // v8.86.1 (Adam's Stoneskin-vs-Nigh-Invulnerable catch): at equal value,
    // "/—" (nothing bypasses) outranks any typed instance for the headline —
    // the old value-only sort let push order decide ties.
    const _drBest = _drLive.slice().sort((a, b) => (b.value - a.value) || ((b.bypass === '—' ? 1 : 0) - (a.bypass === '—' ? 1 : 0)))[0];
    statCells.push({l:'DR', v:`${_drBest.value}/${_drBest.bypass}`,
      tooltip:`Damage Reduction — subtract from each weapon or natural-attack hit unless the attack bypasses it (the “/X” names what gets through; “/—” = nothing does). Instances OVERLAP, never stack: the best applicable applies per attack (FF p.523; class-level x/− pooling already folded in).\n${_drCell.map(d => `${d.value}/${d.bypass} — ${d.source}${d.conditional ? ' (CONDITIONAL: ' + d.conditional + ')' : ''}${d.note ? ' · ' + d.note : ''}`).join('\n')}`});
  }
  return statCells;
}

// Sheet: the strip under the stats: immunities, resistances, DR, carrying
// capacity, and what the character is piloting or wearing.
function renderSheetDefenseStrip(c) {
  // v8.8.0 (Adam): Resistances & Immunities panel — best-wins per type,
  // immunity supersedes, provenance on hover, universal derivation flagged.
  const ri = computeResistances(c);
  const riEl = document.getElementById('sh-resist');
  if (riEl) {
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const bits = [];
    const imm = Object.keys(ri.immune).sort();
    if (imm.length) bits.push(`<b style="color:#b58fd4;">Immune:</b> ` + imm.map(t => `<span title="${escapeHTML(ri.immune[t])}" style="cursor:help;">${cap(t)}</span>`).join(', '));
    const rs = Object.keys(ri.resists).sort();
    if (rs.length) bits.push(`<b style="color:var(--gold);">Resist:</b> ` + rs.map(t => `<span title="${escapeHTML(ri.resists[t].source)}" style="cursor:help;">${cap(t)} ${ri.resists[t].value}</span>`).join(', '));
    // v8.8.0 (Adam's DR pass): Damage Reduction entries — separate lines,
    // best-in-situation per the books (no stacking across sources except
    // the folded book-explicit cases); conditional entries dimmed.
    const drEntries = computeDR(c);
    if (drEntries.length) {
      bits.push(`<b style="color:#d4865a;">DR:</b> ` + drEntries.map(d =>
        `<span title="${escapeHTML(d.source + (d.note ? ' — ' + d.note : '') + (d.conditional ? ' — CONDITIONAL: ' + d.conditional : '') + '. Best applicable DR applies per attack; instances don’t stack across sources (book-explicit stacking already folded in).')}" style="cursor:help;${d.conditional ? 'opacity:.6;font-style:italic;' : ''}">${d.value}/${d.bypass}${d.conditional ? '*' : ''}</span>`
      ).join(', '));
    }
    const unchosen = (c.mutations || []).filter(m => (m.name === 'Energy Absorption' || m.name === 'Energy Diffusion') && !m.energyTypes);
    if (unchosen.length) bits.push(`<span style="color:#d4b870;font-size:10px;">⚠ ${unchosen.map(m => m.name).join(', ')}: energy type(s) unchosen — remove &amp; re-add on the Mutations tab to pick</span>`);
    if (ri.universal) bits.push(`<span style="color:#78afcd;cursor:help;" title="Resistant or immune to all five main energy types — the derived defense that applies even against disintegration (Damage Types reference).">◈ universal energy resistance</span>`);
    // v8.8.2 (Adam's Strong-apex audit): Carrying Capacity (HH p.261 table +
    // Tremendous Strength for Str 30+) and grapple modifier, both riding the
    // effective size — the Strong super-talents' ×4-carry / +1-size riders
    // (HH p.263 Supernatural Strength sidebar) finally reach the sheet.
    bits.push(...sheetCarryAndMountBits(c));
    riEl.style.display = bits.length ? '' : 'none';
    riEl.innerHTML = bits.join(' &nbsp;·&nbsp; ');
  }
}

// Sheet: the carrying-capacity line (with Demolition), the piloted vehicle or
// mecha, worn power armor, an active Second Skin, and the Super-Strong
// riders. Returns the bits for the defense strip.
function sheetCarryAndMountBits(c) {
  const bits = [];
  const cc = computeCarryCapacity(c);
  // v8.88.0 (Adam's dramatic-effect ruling): past the 5-ton line the
  // numbers read in tons, rounding down — fmtCarry.
  const lift = `Lift over head ${fmtCarry(cc.liftOverHead)} · off ground ${fmtCarry(cc.liftOffGround)} (stagger, 5 ft) · push/drag ${fmtCarry(cc.pushDrag)}.`;
  // v8.12.2 (Adam): Grapple moved out of this line — it now sits in the
  // combat stat cells beside BAB/Defense where it belongs.
  // v8.88.1 (Adam's placement tweak): the 💥 Demolition line sits
  // UNDERNEATH Carrying Capacity, not trailing it — a block-level
  // second row nested inside the Carry bit, so the inline ·-joined
  // strip never grows stray separators around a line break.
  const _hiD = computeHardnessIgnore(c);
  let _demoRow = '';
  if (_hiD && _hiD.mode === 'mangler') {
    _demoRow = `<span style="display:block;margin-top:2px;"><b style="color:#d4865a;">💥 Demolition:</b> <span style="cursor:help;" title="${escapeHTML(`${_hiD.from}${_hiD.instances > 1 ? ' — Titanic Strength acts as a second instance of Mangler (hardness & break-DC only; the ×4/+1 riders are already counted per talent). Ruled 2026-10-03.' : ''} Keyed to the ${['','Ignore Hardness','Improved Ignore Hardness','Advanced Ignore Hardness'][_hiD.tier]} tier. Su — falls under a Null Power Field (the Ex tree values stand back up).`)}">ignore ${_hiD.ignore} hardness · break DC −${_hiD.breakDC}${_hiD.instances > 1 ? ' <span style="font-size:10px;color:var(--vio);">×2 (Titanic echo)</span>' : ''}</span></span>`;
  } else if (_hiD && _hiD.mode === 'latent') {
    _demoRow = `<span style="display:block;margin-top:2px;"><b style="color:#d4865a;">💥 Demolition:</b> <span style="cursor:help;font-style:italic;opacity:.65;" title="${escapeHTML(_hiD.from)}">Mangler function latent — enter the Ignore Hardness tree</span></span>`;
  }
  bits.push(`<b style="color:var(--g85);">Carry:</b> <span style="cursor:help;" title="${escapeHTML(cc.parts.join('\n') + '\n' + lift + '\nMedium load: max Dex +3, −3 check penalty, reduced speed. Heavy load: max Dex +1, −6, run ×3 (HH p.261–262). Tons are short tons (2,000 lb), rounded down.')}">light ≤${fmtCarry(cc.light)} · med ≤${fmtCarry(cc.medium)} · heavy ≤${fmtCarry(cc.heavy)}</span>${_demoRow}`);
  // v8.13.x Segment A (Adam's active-loadout ruling): the piloted
  // vehicle joins the combat dashboard.
  const pv = pilotedVehicle(c);
  if (pv && pv.catalogue === 'mecha') {
    // v8.17.0 Segment C: the piloted MECHA line.
    const mg = vehicleIntegrity(pv); const md = mg.def;
    const mTouch = mechaTouchAC(md);
    const mName = pv.custom ? pv.custom.name : (pv.customName || pv.ref);
    bits.push(`<b style="color:#d4865a;">🦿 Piloting:</b> <span style="cursor:help;" title="${escapeHTML(`${md.size} mecha — its Str ${md.str} drives melee, your Dex caps at ${md.dexMax}, your BAB drives attacks. Every hull hit applies hardness ${mg.hardness}; crew is reached only through crit-table results. Full card on the 🕹 Vehicles tab.`)}">${escapeHTML(mName)} — T/AC ${mTouch}/${mTouch + md.equipAC + (paShieldBonus(pv))} · Hard ${mg.hardness} · Hull ${mg.hp}/${mg.maxHP} · Str ${md.str} · speed ${md.speed} ft${md.fly ? ' · fly' : ''}</span>`);
  } else if (pv) {
    const vg = vehicleIntegrity(pv); const vd = vg.def;
    const vchk = vehicleOperatorCheck(c, vd);
    bits.push(`<b style="color:#78afcd;">🕹 Piloting:</b> <span style="cursor:help;" title="${escapeHTML(`${vd.name} — ${vd.maneuver_class} maneuver (${vd.maneuver_mod >= 0 ? '+' : ''}${vd.maneuver_mod} to ${vd.skill}${vchk.initPenalty ? ', ' + vchk.initPenalty + ' Initiative' : ''}). Vehicle T/AC excludes your modifiers; hits in its band strike the hull (hardness ${vg.hardness}). Manage on the 🕹 Vehicles tab.`)}">${escapeHTML(enchantDisplayName(pv))} — T/AC ${vd.touch_ac}/${vd.total_ac} · Hard ${vg.hardness} · HP ${vg.hp}/${vg.maxHP} · ${vd.skill} ${vchk.withManeuver >= 0 ? '+' : ''}${vchk.withManeuver} · speed ${vd.top_speed} (${vd.chase_speed})</span>`);
  }
  // v8.14.x Segment B: the worn power armor / active Second Skin lines.
  const paW = equippedPowerArmor(c);
  if (paW) {
    const paG = armorItemIntegrity(paW); const paD = POWER_ARMOR_DB[paW.ref];
    bits.push(`<b style="color:#78afcd;">🤖 Power Armor:</b> <span style="cursor:help;" title="${escapeHTML(`${paD.size} TS ${paD.ts} power armor — a mecha your size (FF Ch.III). ${paD.strMin ? `Str floors at ${paD.strMin}; ` : paD.equipStrMod ? `+${paD.equipStrMod} equipment Str; ` : ''}${paD.dexMax ? `Dex caps at ${paD.dexMax}. ` : ''}Always intercedes: every hit applies hardness ${paG.hardness}; full AC confirms crits only. Loadout on the 🕹 Vehicles tab.`)}">${escapeHTML(enchantDisplayName(paW))} — Hard ${paG.hardness} · Frame HP ${paG.hp}/${paG.maxHP}${paD.strMin ? ` · Str≥${paD.strMin}` : ''}${paD.dexMax ? ` · Dex≤${paD.dexMax}` : ''}${paD.fly ? ` · fly ${escapeHTML(paD.fly)}` : ''}</span>`);
  }
  const skW = activeSecondSkin(c);
  if (skW && !skW.destroyed) {
    bits.push(`<b style="color:var(--vio);">🧿 Second Skin:</b> <span style="cursor:help;" title="${escapeHTML(`Level ${skW.row.lvl} ectoplasmic sheath (HH p.241): every hit strikes the skin first (hardness ${skW.row.hardness}), excess carries over to you. AC +${skW.row.ac} as armor. You count as armed (slam ${skW.row.slam}). Psionic focus locked; no worn armor. Manage on the 🕹 Vehicles tab.`)}">lvl ${skW.row.lvl} — AC +${skW.row.ac} · Hard ${skW.row.hardness} · HP ${skW.hp}/${skW.maxHP} · slam ${skW.row.slam}${skW.row.dr ? ` · DR ${skW.row.dr}` : ''}</span>`);
  }
  if (cc.superTalents.length || cc.supremeEffortOwned) {
    const sz = SIZE_LADDER[effectiveSizeIndex(c)];
    const mult = Math.pow(4, cc.superTalents.length);
    bits.push(`<span style="color:#78afcd;cursor:help;" title="${escapeHTML(`${cc.superTalents.length ? `Each of Mangler, Super-Smash, and Titanic Strength owned (here: ${cc.superTalents.join(', ')}) grants ×4 Carrying Capacity and +1 effective size category for natural attack damage dice, grappling, and the Jump skill — cumulative (HH p.263). ` : ''}Supernatural: suppressed while Nullified.${cc.supremeEffortOwned ? '\nWhile PERFORMING a Supreme Effort (move action): ×4 carry and +1 size ON TOP of the above — declare at the table.' : ''}`)}">🦾 Super-Strong${cc.superTalents.length ? ` ×${mult} carry · ${sz} for natural dice, grapple &amp; Jump` : ''}${cc.supremeEffortOwned ? ` · during Supreme Effort ×${mult * 4} / ${SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, effectiveSizeIndex(c) + 1)]}` : ''}</span>`);
  }
  return bits;
}

// Sheet: the active-state banners (NULLIFIED, raging, fatigued, euphoric)
// and the Rage button under Strength.
function renderSheetStateBanners(c) {
  // v8.8.0 (Adam's design): the Nullified? toggle — a Null Power Field (or
  // functional equivalent) suppresses ALL Supernatural modifiers; the
  // character falls back to natural + Extraordinary. Wired suppressions:
  // Su attribute bakes (Supernatural [Attribute] chain, Titanic Strength)
  // via effAttrs, Bulletproof/Nigh-Invulnerable in the DR pool,
  // Hyper-Speed, Energy Immunity, Super-Smash. The banner carries the GM
  // line for unwired Su effects.
  const nEl = document.getElementById('sh-nullify');
  if (nEl) {
    const suAttrs = suBakedPerAttr(c);
    const hasSu = suAttrs.some(v => v) || (c.talents || []).some(t => TALENTS_DB.find(x => x.n === (t.name || t.n) && /Super-Talent/.test(x.tier || ''))) || (c.powers || []).some(p => p.pool === 'super');
    // v8.8.2: the toggle strip now hosts Rage alongside Nullified, plus the
    // active-state banners (⊘ nullified / 🔥 raging / 😮‍💨 fatigued).
    const rt = rageTier(c);
    const chunks = [];
    if (c.nullified) {
      chunks.push(`<div style="padding:6px 10px;background:rgba(212,112,112,.12);border:1px solid rgba(212,112,112,.5);border-radius:3px;font-size:12px;">
              <b style="color:var(--red-text);">⊘ NULLIFIED</b> — all Supernatural modifiers suppressed (Null Power Field or equivalent): Su ability bakes${suAttrs.some(v=>v) ? ` (${suAttrs.map((v,i)=>v?`${['STR','DEX','CON','INT','WIS','CHA'][i]} −${v}`:null).filter(Boolean).join(', ')})` : ''}, Bulletproof, Nigh-Invulnerable, Hyper-Speed, Energy Immunity, Super-Smash, and the Super-Strong carry/size riders.
              <span style="opacity:.7;">Buff super-powers, Su item effects, and other unwired Su abilities: GM adjudicates. Rage is Ex — it still works.</span>
              <button class="btn btn-sm" style="font-size:10px;margin-left:8px;" onclick="toggleNullified()">Restore</button></div>`);
    }
    if (rt && c.raging) {
      const conRaged = am(effAttrs(c)[2]);
      const hpRider = (rt.attr / 2) * (c.totalLvl || 0);
      chunks.push(`<div style="padding:6px 10px;background:rgba(212,140,70,.14);border:1px solid rgba(212,140,70,.6);border-radius:3px;font-size:12px;">
              <b style="color:#d4865a;">🔥 ${rt.name.toUpperCase()}</b> — +${rt.attr} Str &amp; Con (baked into every derived number), +${rt.will} morale Will, −2 AC. Duration ${3 + conRaged} rounds (3 + raged Con mod); once per encounter.
              <span style="cursor:help;opacity:.8;" title="While raging: +${hpRider} HP (the raised Con mod × character level; these vanish when the rage ends and are NOT lost first the way temporary HP are). No Cha-, Dex-, or Int-based skills (except Balance, Escape Artist, Intimidate, Ride), no Concentration, no patience/concentration abilities, no spellcasting or command/trigger/completion items, no Combat Expertise / Magic / Power feats.">+${hpRider} HP rider &amp; restrictions ⓘ</span>
              <button class="btn btn-sm" style="font-size:10px;margin-left:8px;" onclick="toggleRage()">End Rage${berserkerLvl(c) >= 17 ? '' : ' (→ Fatigued)'}</button></div>`);
    }
    if (c.fatigued && !c.raging) {
      chunks.push(`<div style="padding:5px 10px;background:rgba(150,150,150,.1);border:1px solid rgba(180,180,180,.4);border-radius:3px;font-size:11.5px;">
              <b style="opacity:.8;">😮‍💨 FATIGUED</b> — −2 Str, −2 Dex (baked), can’t charge or run. Lasts the encounter (post-Rage) or until 8 hours’ rest.
              <button class="btn btn-sm" style="font-size:10px;margin-left:8px;" onclick="clearFatigue()">Recover</button></div>`);
    }
    // v8.8.3: Euphoriac banner (Ex — works while nullified).
    const euB = euphoriacBonus(c);
    if (euB && c.euphoric) {
      chunks.push(`<div style="padding:5px 10px;background:rgba(120,175,205,.1);border:1px solid rgba(120,175,205,.5);border-radius:3px;font-size:11.5px;">
              <b style="color:#78afcd;">⚡ EUPHORIC</b> — +${euB} morale on attack rolls, damage rolls, and saving throws (baked). Lasts (wild-surge intensity) rounds; not gained if neuralgia struck.
              <button class="btn btn-sm" style="font-size:10px;margin-left:8px;" onclick="toggleEuphoric()">Fades</button></div>`);
    }
    // v8.60.2 (Adam): the ⊘ Nullified? TRIGGER moved to the Tracker's
    // Conditions panel — it's a condition, if an extreme one (Sheet =
    // report: the red NULLIFIED banner + Restore above remain here).
    // v8.77.0 (Adam's Sheet polish): the 🔥 Rage! button moved UNDER THE
    // STRENGTH SCORE it fuels (the Mind's Ledger's physical mirror —
    // #sh-rage below), and the ⚡ Euphoric trigger moved to the Tracker's
    // Conditions panel beside ⊘ Nullified and ⚡ Reckless. The active-state
    // banners (🔥 RAGING / ⚡ EUPHORIC / 😮‍💨 FATIGUED / ⊘ NULLIFIED) remain
    // here — the Sheet reports states; triggers live at their homes.
    nEl.innerHTML = chunks.join('');
    const rageEl = document.getElementById('sh-rage');
    if (rageEl) {
      if (rt) {
        rageEl.style.display = '';
        if (!c.raging) {
          const used = abilityUsed(c, 'rage'), mx = rageUsesPerDay(c);
          rageEl.innerHTML = `<button class="btn btn-sm" style="width:100%;font-size:10px;border-color:rgba(212,140,70,.5);color:#d4865a;" title="Fly into a ${rt.name}: +${rt.attr} Str/Con, +${rt.will} morale Will, −2 AC for 3 + raged Con mod rounds. Free action on your own action; once per encounter. ${used}/${mx} used today." onclick="toggleRage()">🔥 Rage! <span style="opacity:var(--o60);color:var(--dim);">${used}/${mx} today</span></button>`;
        } else {
          rageEl.innerHTML = `<div style="text-align:center;padding:3px 6px;font-size:10px;color:#d4865a;border:1px solid rgba(212,140,70,.6);border-radius:3px;background:rgba(212,140,70,.14);" title="${rt.name} active — the banner below carries the numbers and the End Rage button.">🔥 ${rt.name.toUpperCase()} — see banner</div>`;
        }
      } else { rageEl.style.display = 'none'; rageEl.innerHTML = ''; }
    }
  }
}

// Sheet: the three saving throw cards. cM/dM/wM = effective Con/Dex/Wis mods.
function renderSheetSaves(c, cM, dM, wM) {
  // v8.6.0 (Adam's formatting report): the save cells' calc text sat flush
  // against the value ("+1base 0 + ..."); the calc now sits on its own line
  // under the modifier. Same report exposed a correctness gap: the displayed
  // value was base+attr ONLY — it now uses the full computeStatBlock total
  // (feat/mutation/equipped-item save bonuses included), with any non-base,
  // non-attr portion shown as "± N other" (the drilldown itemizes it).
  const sbSaves = computeStatBlock(c);
  document.getElementById('sh-saves').innerHTML=[
    {l:'Fortitude',base:c.fort,mod:cM,attr:'CON',k:'fort'},
    {l:'Reflex',base:c.ref,mod:dM,attr:'DEX',k:'ref'},
    {l:'Will',base:c.will,mod:wM,attr:'WIS',k:'will'},
  ].map(s=>{
    const total = sbSaves[s.k].total;
    const other = total - (s.base||0) - s.mod;
    // v8.61.0: Evasion rider on the Reflex card. v8.64.0 (Phase 2 sift):
    // unified through evasionTier — class features (Monk/Rogue/Ranger/
    // Survivor/Explorer, the Rogue SA pick) join the Fast Hero talents,
    // with the Explorer/Survivor second-source escalation.
    let evTag = '';
    if (s.k === 'ref') {
      const ev = evasionTier(c);
      if (ev) evTag = `<span style="display:block;font-size:9px;color:#9cc3da;font-style:italic;margin-top:2px;cursor:help;" title="${ev.tier >= 2 ? 'Improved Evasion: a successful Reflex save against a half-damage effect means NO damage — and a failed save means only half.' : 'Evasion: a successful Reflex save against a half-damage effect (fireball, explosions…) means NO damage instead of half. Light or no armor only.'} Sources: ${ev.srcs.join(', ')}.">${ev.tier >= 2 ? 'Improved Evasion' : 'Evasion'}</span>`;
    }
    // v9.2.2 (Adam's Ultra Immune System ruling): CONDITIONAL save bonuses
    // get a visible ⚜ line on the card (they lived only in the drilldown) —
    // racial (Dwarven hardiness), feats, implants, gear, all alike.
    const _cond = [];
    for (const e of [...(((sbSaves[s.k].breakdown || {}).inactive) || []), ...((sbSaves[s.k].bonuses || []).filter(b => b.condition && !(((sbSaves[s.k].breakdown || {}).inactive) || []).includes(b)))]) {
      if (!e || !e.condition) continue;
      const line = `${e.value >= 0 ? '+' : ''}${e.value} ${e.condition} (${e.label || e.source})`;
      if (!_cond.includes(line)) _cond.push(line);
    }
    const condTag = _cond.length ? `<span style="display:block;font-size:9px;color:var(--vio);margin-top:2px;cursor:help;" title="${escapeHTML('Conditional — applies only in the stated situation; never part of the headline total:\n' + _cond.join('\n'))}">${_cond.slice(0, 3).map(l => `⚜ ${escapeHTML(l)}`).join('<br>')}${_cond.length > 3 ? `<br>⚜ +${_cond.length - 3} more (click for the drilldown)` : ''}</span>` : '';
    return `<div class="stat-cell drillable" onclick="showStatBreakdown('${s.k}')"><span class="sc-lbl">${s.l}</span><span class="sc-val">${(total>=0?'+':'')+total}</span><span style="display:block;font-size:10px;color:var(--g50);margin-top:2px;">base ${s.base||0} + ${s.attr} ${s.mod>=0?'+':''}${s.mod}${other?` ${other>0?'+':'−'} ${Math.abs(other)} other`:''}</span>${evTag}${condTag}</div>`;
  }).join('');
}

// Sheet: the Armaments & Armor synopsis under the saves.
function renderSheetArmaments(c) {
  // v9.0.1 (Adam's Sheet tweak): ⚔ ARMAMENTS & ARMOR — the at-the-table
  // synopsis under Saving Throws. Reuses the Gear tab's own engines
  // (computeEquippedWeaponSummaries, fmtAtk, armorStatStrip,
  // armorItemIntegrity) so the numbers can never drift; renders the
  // SYNOPSIS only — attack w/ Full-Attack brackets + mods hover, damage w/
  // breakdown hover, type, the crit/range strip, armor reference lines.
  // Alt-modes, maneuvers, riders, and every button stay on Gear.
  const armEl = document.getElementById('sh-armaments');
  if (armEl) {
    const bits = [];
    // (fmtAtk is scoped inside the Gear renderer — local twin here.)
    const fA = (n) => `${n >= 0 ? '+' : ''}${n}`;
    try {
      const sums = computeEquippedWeaponSummaries(c);
      if (sums.length) {
        bits.push('<table class="sk-tbl" style="margin-bottom:.4rem;"><thead><tr><th>Weapon</th><th title="Bracketed sequence = the Full Attack action (one extra swing per 5 Base Attack, cumulative −5).">Attack (Full Atk)</th><th>Damage</th><th>Type</th></tr></thead><tbody>');
        for (const s of sums) {
          const atkTip = (s.mods || []).map(m => `${m.label}: ${m.value >= 0 ? '+' : ''}${m.value}`).join('\n');
          const atkText = (s.fullAttack && s.fullAttack.length > 1)
            ? `${fA(s.fullAttack[0])} (${s.fullAttack.slice(1).map(fA).join('/')})`
            : fA(s.attackBonus);
          const dmgTip = (s.dmgBreakdown || []).map(p => `${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}`).join('\n');
          const hand = s.hand ? ` <span style="font-size:8.5px;opacity:.6;">(${s.hand === 'main' ? 'main' : 'off'})</span>` : (s.gripBothHands ? ' <span style="font-size:8.5px;opacity:.6;" title="Wielded in both hands: Str ×1.5 damage, Power Attack ×2.">(🤲 both)</span>' : '');
          const ihSm = s.ignoreHardness ? ` <span style="font-size:8.5px;color:var(--vio);cursor:help;" title="${escapeHTML(`Every +1 of enhancement bonus ignores 5 points of Hardness — artificial AND natural (GMG pp.253, 96).${s.ihBane ? ' Bane: 10 more vs the designated foe (GMG p.260).' : ''}`)}">⛏ −${s.ignoreHardness} hardness</span>` : '';
          bits.push(`<tr><td>${escapeHTML(s.name)}${s.unarmed ? ' 🥊' : ''}${s.integratedIn ? ' 🔩' : ''}${hand}${ihSm}${s.proficient ? '' : ' <span style="color:#d4865a;font-size:9.5px;" title="−4 not proficient (already included)">⚠</span>'}${s.statStrip ? `<div style="font-size:9px;color:var(--g50);">${escapeHTML(s.statStrip)}</div>` : ''}</td>`
            + `<td style="cursor:help;white-space:nowrap;" title="${escapeHTML(atkTip)}">${atkText}</td>`
            + `<td style="cursor:help;" title="${escapeHTML(dmgTip ? 'Damage breakdown:\n' + dmgTip : '')}">${escapeHTML(s.damage)} ${escapeHTML(s.damageLabel || '')}</td>`
            + `<td style="font-size:10px;opacity:.8;">${escapeHTML(s.typeLabel || (s.damageTypes || []).join('/') || '—')}</td></tr>`);
        }
        bits.push('</tbody></table>');
      } else {
        bits.push('<div style="opacity:.5;font-size:11.5px;margin-bottom:.4rem;">No weapons equipped — unarmed only (see Gear).</div>');
      }
      const armorItems = (c.items || []).filter(i => i.catalogue === 'armor' && i.equipped);
      if (armorItems.length) {
        for (const it of armorItems) {
          const def = getCatalogueEntry('armor', it.ref);
          if (!def) continue;
          const strip = armorStatStrip(def, it);
          const nm = enchantDisplayName(it);
          const isShield = def.type === 'shield';
          bits.push(`<div style="font-size:11.5px;"><b style="color:var(--gold);">${isShield ? '🛡' : '🪖'} ${escapeHTML(nm)}</b> <span style="font-size:10px;opacity:.8;">${escapeHTML(strip)}</span></div>`);
        }
      } else {
        bits.push('<div style="opacity:var(--o50);color:var(--dim);font-size:11px;">No armor equipped.</div>');
      }
    } catch (e) { bits.push('<div style="opacity:var(--o50);color:var(--dim);font-size:11px;">—</div>'); }
    armEl.innerHTML = bits.join('');
  }
}

// Sheet: the level / XP progress bar.
function renderSheetXP(c) {
  // v8.3.16: Caster & Manifester Levels strip removed. The Powers & Spells
  // panel below shows CL/ML per pool with full context (save DC, max power
  // level, per-contributor breakdown, current/max PP). Maintaining a separate
  // dashboard strip created two functions ("computeCasterLevels" and
  // "computeCasterStats") that had to agree but didn't — leading to the
  // v8.3.16 bug where the strip ignored Heritage feats while the panel
  // applied them correctly. Removing the strip eliminates the redundancy
  // and the divergence risk.
  // v8.3.1: progression within the CURRENT level's band.
  const prog=computeXpProgress(c);
  document.getElementById('sh-xp').innerHTML=`
    <div class="xp-track">
      <div class="xp-top"><div><span class="xp-lvl">Level ${c.totalLvl}</span>${c.ecl!==c.totalLvl?`<span style="font-size:11px;color:var(--g50);margin-left:8px;">ECL ${c.ecl}</span>`:''}</div><div style="font-family:'Epics Serif','Cinzel',serif;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--g50);">Next: ${(c.xpNext||1000).toLocaleString()} XP</div></div>
      <div class="bar-wrap" style="height:8px;"><div class="bar-fill bar-gold" style="width:${prog.pct}%;"></div></div>
      <div class="xp-txt">${prog.inLevel.toLocaleString()} / ${prog.bandSize.toLocaleString()} XP this level &nbsp;·&nbsp; ${prog.pct}% <span style="color:var(--g45);">(${c.xp.toLocaleString()} total)</span></div>
    </div>`;
}

// Sheet, Features section: assembled from its parts in reading order:
// Scenario, race (and Mutant subtype), Starting Occupation, class
// features, spells & powers, talents, mutations.
function sheetFeaturesHtml(c, classArr) {
  // The racial block is built first; the Scenario line then goes in front.
  let html = sheetRacialHtml(c);
  html = sheetScenarioLineHtml(c) + html;
  html += sheetOccupationHtml(c);
  html += sheetClassFeaturesHtml(c, classArr);
  html += sheetPowersHtml(c);
  html += sheetTalentsHtml(c);
  html += sheetMutationsHtml(c);
  return html;
}

// Sheet, Features: the racial block (Hybrids as drop-downs) and the
// Mutant-subtype row.
function sheetRacialHtml(c) {
  const race=RACES[c.race]||{};
  // v8.68.0: Hybrids headline both parents, the effective RLM, the combined
  // adjustments, and both parents' notes after the Hybrid framework note.
  // v8.71.0 (Adam's grooming pass — the run-on "read like a dog's
  // breakfast"): the Hybrid block is now a tidy headline + three drop-downs.
  // The framework exposition demotes to a hover pop-up on the title; the
  // technicalese (net adjustments, RLM, size & movement) and each parent's
  // racial abilities fold into collapsed-by-default .hy-det rows.
  const _hyS = hybridInfo(c);
  const radj = _hyS
    ? (ATTR_NAMES.map((n, i) => { const v = ((_hyS.A.adj||{})[n]||0) + ((_hyS.B.adj||{})[n]||0); return v ? `${v>0?'+':''}${v} ${n}` : ''; }).filter(Boolean).join(', ') || 'None')
    : (Object.entries(race.adj||{}).map(([k,v])=>(v>0?'+':'')+v+' '+k).join(', ')||'None');
  // v8.81.0 (Adam's "Human Mutant" weave): a TEMPLATED Mutant (the feat or
  // 10+ total MP — the §220 unification) carries the subtype in the race
  // headline itself ("Human Mutant", "Hybrid (Human / Dwarf) Mutant") and
  // gains a 🧬 drop-down among the racial rows. Below the template line
  // (Slightly Different, sub-10 dabblers): nothing — different, not Mutants.
  const _mpS = getMPState(c);
  const _mutTempl = !!(_mpS && _mpS.isMutantTemplated);
  const _mutSuffix = _mutTempl ? ' Mutant' : '';
  let featuresHtml;
  if (_hyS) {
    const hyBlurb = 'The child of two Humanoid parent races, blended with the GM’s approval. A Hybrid inherits ALL the racial abilities of both parents, while size and movement follow ONE chosen parent. Racial Level Modifier = parent A’s + parent B’s + 1 — the classic Half-Elf is 0 + 0 + 1 = +1. GM-tailored builds may trade away specific abilities for a GM-adjusted RLM. (HH pp.29–30)';
    const _szIdx = raceSizeIndex(c);
    const _szName = _szIdx === 3 ? 'Small' : _szIdx === 5 ? 'Large' : 'Medium';
    const _szDef = RACES[_hyS.sizeFrom] || {};
    const _walk = _szDef.speed != null ? _szDef.speed
      : (RACE_BASE_SPEED[_hyS.sizeFrom] != null) ? RACE_BASE_SPEED[_hyS.sizeFrom]
      : (_szIdx === 3 ? 20 : 30);
    const _modes = (_szDef.modes || []).map(m => `${m.type} ${m.speed}′${m.note ? ' (' + m.note + ')' : ''}`).join(' · ');
    // v8.84.0 (Adam's noise report — Rhad's "Human Mutant" display still
    // "noisy"): the whole racial block folds behind a gold .race-det banner.
    // Adj/ECL/granted abilities are creation-time facts, "not worthy of
    // constant dashboard real estate"; the 🧬 subtype row stays outside.
    featuresHtml = `<details class="race-det"><summary><b style="color:var(--gold);cursor:help;" title="${escapeHTML(hyBlurb)}">${raceDisplayOf(c)}${_mutSuffix}</b>${citeHTML('races', c.race)}</summary><div style="padding:4px 2px 2px 10px;">
      <details class="hy-det"><summary>Hybrid mechanics — adjustments, RLM, size &amp; movement</summary><div style="padding:3px 0 2px 14px;line-height:1.65;">
        Ability Adj.: ${radj} <span style="font-size:10px;color:var(--g50);">(both parents combined, applied at creation)</span><br>
        RLM: +${_hyS.rlm}${_hyS.rlm !== _hyS.autoRlm ? ` <span style="font-size:10px;color:#d4b870;">(GM-tailored — auto would be +${_hyS.autoRlm}${_hyS.dropped ? '; dropped: ' + escapeHTML(_hyS.dropped) : ''})</span>` : ` <span style="font-size:10px;color:var(--g50);">(${_hyS.a} ${_hyS.A.ecl || 0} + ${_hyS.b} ${_hyS.B.ecl || 0} + 1)</span>`}<br>
        Size &amp; movement (from ${escapeHTML(_hyS.sizeFrom)}): ${_szName}, base speed ${_walk}′${_modes ? ' · ' + escapeHTML(_modes) : ''} <span style="font-size:10px;color:var(--g50);">— final speed with talents &amp; armor reads off the Speed card</span>
      </div></details>
      <details class="hy-det"><summary>${escapeHTML(_hyS.a)} — racial abilities</summary><div style="padding:3px 0 2px 14px;line-height:1.55;font-size:12px;">${_hyS.A.notes || '—'}</div></details>
      <details class="hy-det"><summary>${escapeHTML(_hyS.b)} — racial abilities</summary><div style="padding:3px 0 2px 14px;line-height:1.55;font-size:12px;">${_hyS.B.notes || '—'}</div></details>
    </div></details>`;
  } else {
    // v8.84.0: same gold banner for the plain races. The unconfigured-Hybrid
    // ⚑ prompt rides the SUMMARY line — a flag that hides is no flag.
    const _hyFlag = c.race === 'Hybrid' ? ' <span style="color:#d4b870;font-size:11px;font-family:inherit;">⚑ parents not chosen — ✎ Edit and pick BOTH Humanoid parents</span>' : '';
    featuresHtml = `<details class="race-det"><summary><b style="color:var(--gold);">${c.race}${_mutSuffix}</b>${citeHTML('races', c.race)}${_hyFlag}</summary><div style="padding:4px 2px 2px 14px;line-height:1.6;">Ability Adj.: ${radj} &nbsp;|&nbsp; ECL Mod: +${race.ecl||0}<br>${race.notes||''}</div></details>`;
  }
  // The 🧬 Mutant subtype drop-down — one more racial row, the hy-det idiom.
  if (_mutTempl) {
    const ml = _mpS.mutantLevel, conM = am(((c.attrs) || [10,10,10,10,10,10])[2]);
    const clsLabel = `${_mpS.tier.tier} ${_mpS.isSuperMutant ? 'Super-Mutant' : 'Mutant'}`;
    const spp = _mpS.isSuperMutant ? getSuperPPState(c) : null;
    const nextMP = (ml + 1) * 10;
    const nextTier = MUTATION_RULES.super_mutant_tiers[Math.min(3, ml + 1)];
    const promoLine = ml >= 3
      ? `Classification tracks total MP: already Mega — each further 10 MP adds +1 RLM (and ECL).`
      : `Classification tracks total MP: next promotion at ${nextMP} MP (${nextTier.tier}${_mpS.isSuperMutant ? ` — power levels ${nextTier.spell_levels[0]}-${nextTier.spell_levels[1]}, ${nextTier.max_mp_per_power != null ? '≤' + nextTier.max_mp_per_power + ' MP/power' : 'uncapped'}` : ''}).`;
    featuresHtml += `
      <details class="hy-det"><summary><span style="cursor:help;" title="The Mutant racial subtype (HH p.29) — templated via the Supernatural Mutation feat or 10+ total MP (Adam's unification, 2026-10-03). Its racial abilities are EXTRAORDINARY — fundamental physiology; a Null Power Field does not suppress them.">🧬 Mutant subtype — <b style="color:var(--vio);">${clsLabel}</b> · RLM +${ml} · ${_mpS.totalEarned} MP total</span></summary><div style="padding:3px 0 2px 14px;line-height:1.65;font-size:12px;">
        <b style="color:var(--gold);">Unnatural Prowess (Ex):</b> +${Math.floor(ml / 2)} Base Attack · +${Math.floor(ml / 3)} Defense · +${2 * ml} skill points <span style="font-size:10px;color:var(--g50);">(Tech Scale 0 skills only — table-enforced)</span><br>
        <b style="color:var(--gold);">Unnatural Resilience (Ex):</b> +${ml * (5 + conM)} HP · +${Math.floor(ml / 2)} all saves <span style="font-size:10px;color:var(--g50);">(baked live — cards, rows, and drilldowns already include them)</span><br>
        ${_mpS.isSuperMutant ? `<b style="color:var(--gold);">ESL ${_mpS.eml}</b> <span style="font-size:10px;color:var(--g50);">(character level ${c.totalLvl || 1} + RLM ${ml})</span> · super-PP ${spp ? spp.current + '/' + spp.max : '—'}/day · ` : ''}<b style="color:var(--gold);">ECL +${ml}</b><br>
        <span style="font-size:11px;font-style:italic;color:var(--tv85);">${promoLine}</span>
      </div></details>`;
  }
  return featuresHtml;
}

// Sheet, Features: the Scenario line ("" for characters without Six Scales).
function sheetScenarioLineHtml(c) {
  // v8.77.0 (Adam's Sheet restructure): the section reads SCENARIO →
  // RACIAL → per-class collapsibles. The Scenario synopsis leads (it
  // frames everything beneath it); the old separate per-class header
  // lines and the "Class Abilities" list are CONFLATED into one "Class
  // Features & Abilities" area — a .hy-det drop-down per class whose
  // summary carries the base line (Hit Die / Key / SP / AP) and whose
  // body gives the level-by-level record of what the class has actually
  // granted, with chosen options resolved in place: 🎓 class-choice picks
  // by className+level, bonus feats by slotSource provenance, and the
  // class's own tree talents — no more informationless "pick one talent"
  // placeholder rows.
  if(c.sixLevels){
    const slLine=['arcane','divine','heroic','mutation','psionic','tech'].map(a=>`${SIX_LEVELS[a].short} ${c.sixLevels[a]||0}`).join(' · ');
    return `<b style="color:var(--gold);">Scenario:</b> ${normalizePresetName(c.scenarioPreset||'Custom')} <span style="font-size:12px;color:var(--g65);">— ${slLine}</span><br><br>`;
  }
  return '';
}

// Sheet, Features: the Starting Occupation block.
function sheetOccupationHtml(c) {
  // v9.2.1 (Adam's order ruling): placed RIGHT AFTER the racial block so the
  // section reads Scenario → Racial → Starting Occupation → Class Features,
  // matching its title (it had trailed the classes, talents and mutations).
  // v8.96.0 (Adam's dig for a character's occupation choices): the Starting
  // Occupation block — collapsible per occupation, the house .hy-det idiom:
  // description, the DESIGNATED class skills (the picks), the bonus feat,
  // wealth bonus, and the full offered list for reference.
  const occs = (c.occupations && c.occupations.length ? c.occupations : (c.occ ? [c.occ] : [])).filter(Boolean);
  let occHtml = `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(200,151,30,.2);"><b style="color:var(--gold);font-family:'Epics Serif','Cinzel',serif;">Starting Occupation</b>`;
  if (!occs.length) {
    occHtml += ` <span style="opacity:.55;font-size:12px;">— none chosen (set on the Create tab; free class skills, maybe a feat — HH p.34)</span></div>`;
  } else {
    occHtml += '</div>';
    occs.forEach((o, oi) => {
      const od = getOccupationData(o);
      const picks = (c.occupationPicks || {})[oi === 0 ? 'primary' : 'secondary'] || {};
      const pickedSkills = (picks.skills || []).filter(Boolean);
      const pickedFeat = picks.feat || null;
      const rows = [];
      if (od && od.d) rows.push(`<div style="font-size:11.5px;color:var(--tx75);line-height:1.5;">${escapeHTML(od.d)}</div>`);
      rows.push(`<div style="font-size:12px;"><b style="color:var(--g85);">Class skills designated:</b> ${pickedSkills.length ? escapeHTML(pickedSkills.join(', ')) : `<span style="color:#d4b870;">unchosen — pick ${od ? od.skill_count : '?'} from the list below (amber-dot ledger)</span>`}</div>`);
      if (od && od.bonus_feat_options && od.bonus_feat_options.length) rows.push(`<div style="font-size:12px;"><b style="color:var(--g85);">Bonus feat:</b> ${pickedFeat ? escapeHTML(pickedFeat) : `<span style="color:#d4b870;">unchosen</span> <span style="opacity:var(--o60);color:var(--dim);">(options: ${escapeHTML(od.bonus_feat_options.join(', '))})</span>`}</div>`);
      if (od && od.wealth != null) rows.push(`<div style="font-size:12px;"><b style="color:var(--g85);">Wealth bonus:</b> +${od.wealth} to the starting Wealth Score (HH p.44)</div>`);
      if (od && od.prereq_age) rows.push(`<div style="font-size:11px;opacity:var(--o60);color:var(--dim);">Minimum age: ${od.prereq_age}</div>`);
      if (od && od.skill_list) rows.push(`<div style="font-size:11px;opacity:var(--o60);color:var(--dim);line-height:1.5;">Offered list (choose ${od.skill_count}): ${escapeHTML(od.skill_list.join(' · '))}</div>`);
      occHtml += `<details class="hy-det" style="margin-top:4px;"><summary style="cursor:pointer;font-size:12.5px;color:var(--gold);">💼 ${escapeHTML(o)}${oi === 1 ? ' <span style="font-size:9px;opacity:var(--o60);color:var(--dim);">(second occupation)</span>' : ''}</summary><div style="padding:4px 0 4px 14px;border-left:2px solid rgba(200,151,30,.35);margin-top:3px;display:flex;flex-direction:column;gap:4px;">${rows.join('')}</div></details>`;
    });
  }
  return occHtml;
}

// Sheet, Features: "Class Features & Abilities", one drop-down per class with
// its level-by-level record, choices resolved in place.
function sheetClassFeaturesHtml(c, classArr) {
  const activeFeatures = getActiveClassFeatures(c);
  const byClass = {};
  for (const f of activeFeatures) { (byClass[f.className] = byClass[f.className] || []).push(f); }
  const chSpecs = computeClassChoiceSpecs(c);
  const consumedSpecs = new Set();
  const tagColor = { active:'#7daadc', passive:'var(--gold)', meta:'#c499d4', unimplemented:'var(--g40)' };
  const tagLabel = { active:'active', passive:'passive · automated', meta:'character build', unimplemented:'not yet automated' };
  const featureRow = (className, f) => {
    const tc = tagColor[f.kind] || 'var(--g55)';
    const tl = tagLabel[f.kind] || f.kind;
    const cit = getCitation('classFeatures', className + '::' + f.name) || (f.page ? {book:'HH', page:f.page} : null);
    const citStr = cit ? `${cit.book} p.${cit.approx ? '~' : ''}${cit.page}` : '';
    // 🎓 picks resolved for this feature at this level (loose name match —
    // the choice specs sometimes carry a qualified feature name).
    const myPicks = chSpecs.filter(s => !consumedSpecs.has(s.key) && s.className === className && s.atLvl === f.feature.lvl && (s.feature === f.name || s.feature.startsWith(f.name) || f.name.startsWith(s.feature)));
    for (const s of myPicks) consumedSpecs.add(s.key);
    const pickBits = myPicks.map(s => s.chosen
      ? `<b style="color:rgba(120,175,205,.95);">${escapeHTML(s.chosen)}</b>`
      : `<span style="color:#d4b870;">⚑ unchosen — pick in 🎓 Class Choices</span>`);
    return `<div style="font-size:12px;line-height:1.45;padding:1px 0 1px 10px;border-left:2px solid ${tc};margin-top:2px;">
          <b style="color:var(--gold);">${escapeHTML(f.name)}</b>
          <span style="font-size:9px;color:${tc};text-transform:uppercase;letter-spacing:.06em;margin-left:5px;cursor:help;" title="${escapeHTML((f.desc || '') + (citStr ? ' — ' + citStr : ''))}">[${tl}]</span>
          ${pickBits.length ? `<span style="font-size:11px;"> — ${pickBits.join(', ')}</span>` : ''}
          <br><span style="color:var(--tx70);font-size:11px;">${escapeHTML(f.desc||'')}</span>
        </div>`;
  };
  let cfa = `<br><br><b style="color:var(--gold);">Class Features &amp; Abilities</b> <span style="font-size:10px;color:var(--g55);">(${activeFeatures.length} active — expand a class for its level-by-level record)</span>`;
  const renderedClasses = new Set();
  for (const e of classArr) {
    const cls = getClassEntry(e); if (!cls) continue;
    renderedClasses.add(e.name);
    const tierLabel = {hero:'Hero Class', basic:'Basic Class', advanced:'Advanced Class', prestige:`Prestige Class, max ${cls.maxLvl||10}`}[e.tier] || '';
    const apHint = e.tier === 'hero' ? ` · AP ${c.apMax}/lvl` : '';
    // v8.70.0 (GG p.161): the Druid-side Ecclesiarch answers to Hierophant.
    const _hiero = (e.name === 'Ecclesiarch' && (c.druidOption || migrateLegacyClasses(c).some(x => x._heritageChoice === 'Cleric (Druid Option)')));
    const feats = byClass[e.name] || [];
    // The class's own tree talents (hero classes) — attribution per exact
    // level isn't stored, so the chosen set rides the class header area.
    let extras = '';
    if (e.tier === 'hero') {
      const tl2 = (c.talents || []).filter(t => { const td = TALENTS_DB.find(x => x.n === (t.name || t.n)); return td && td.hero_class === e.name; })
        .map(t => (t.name || t.n) + (t.param ? ` (${t.param})` : ''));
      extras += `<div style="font-size:11px;margin:2px 0;color:var(--tx85);">🎭 <b style="color:var(--gold);">Talents chosen</b> (this class's trees): ${tl2.length ? `<b style="color:rgba(120,175,205,.95);">${tl2.map(escapeHTML).join(', ')}</b>` : '<i style="opacity:var(--o60);color:var(--dim);">none yet — the Talents tab awaits</i>'}</div>`;
    }
    const bf = (c.feats || []).filter(f => typeof f.slotSource === 'string' && f.slotSource.startsWith(`classFeature:${e.name}:`))
      .map(f => f.name + (f.param ? ` (${f.param})` : ''));
    if (bf.length) extras += `<div style="font-size:11px;margin:2px 0;color:var(--tx85);">★ <b style="color:var(--gold);">Bonus feats taken</b> (this class's slots): <b style="color:rgba(120,175,205,.95);">${bf.map(escapeHTML).join(', ')}</b></div>`;
    // Level-by-level record.
    const byLvl = {};
    for (const f of feats) { (byLvl[f.feature.lvl] = byLvl[f.feature.lvl] || []).push(f); }
    let body = `<div style="padding:3px 0 2px 12px;">${extras}`;
    for (const lvl of Object.keys(byLvl).map(Number).sort((a, b) => a - b)) {
      body += `<div style="margin-top:4px;"><span style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);letter-spacing:.08em;">LEVEL ${lvl}</span>`;
      for (const f of byLvl[lvl]) body += featureRow(e.name, f);
      body += `</div>`;
    }
    // Choice specs for this class that matched no feature row (defensive —
    // nothing a player picked should ever vanish from the record).
    const strays = chSpecs.filter(s => !consumedSpecs.has(s.key) && s.className === e.name);
    for (const s of strays) { consumedSpecs.add(s.key); body += `<div style="font-size:11px;margin-top:3px;">L${s.atLvl} · ${escapeHTML(s.feature)}${s.idx > 1 ? ` #${s.idx}` : ''}: ${s.chosen ? `<b style="color:rgba(120,175,205,.95);">${escapeHTML(s.chosen)}</b>` : '<span style="color:#d4b870;">⚑ unchosen — 🎓 Class Choices</span>'}</div>`; }
    body += `</div>`;
    cfa += `<details class="cls-det"><summary><b style="color:var(--gold);">${_hiero ? 'Ecclesiarch (Hierophant)' : escapeHTML(e.name)} ${e.level}</b>${citeHTML('classes', e.name)} <span style="font-size:10px;color:var(--g50);">${tierLabel}</span> <span style="font-size:10.5px;color:var(--tx75);font-family:Georgia,serif;letter-spacing:0;">— Hit Die d${cls.hd} · Key ${cls.attr} · ${cls.sp}+Int SP/lvl${apHint}${feats.length ? ` · ${feats.length} feature${feats.length === 1 ? '' : 's'}` : ''}</span>${_hiero ? ' <span style="font-size:9px;" title="GG p.161: the Ecclesiarch is ‘known sometimes as a Hierophant’ — the Druid-rooted ones answer to it.">ⓘ</span>' : ''}</summary>${body}</details>`;
  }
  // Feature groups whose class isn't a current class entry (Heritage
  // grants and kin) — rendered so nothing active ever disappears.
  for (const cn in byClass) {
    if (renderedClasses.has(cn)) continue;
    let body = `<div style="padding:3px 0 2px 12px;">`;
    for (const f of byClass[cn]) body += featureRow(cn, f);
    body += `</div>`;
    cfa += `<details class="cls-det"><summary><b style="color:var(--gold);">${escapeHTML(cn)}</b> <span style="font-size:10px;color:var(--g50);">granted abilities</span> <span style="font-size:10.5px;color:var(--tx75);font-family:Georgia,serif;letter-spacing:0;">· ${byClass[cn].length} feature${byClass[cn].length === 1 ? '' : 's'}</span></summary>${body}</details>`;
  }
  return cfa;
}

// Sheet, Features: the Powers & Spells panels, one per caster pool.
function sheetPowersHtml(c) {
  // v8.3.12: Powers & Spells panel — per-pool sub-panels for arcane/divine/psionic.
  // Shows pool aggregate header (CL, save DC base, total PP max + current) and
  // per-contributor sub-blocks with the contributor's PP budget and prep workflow.
  const casterStats = computeCasterStats(c);
  let powersHtml = '';
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = casterStats[poolName];
    if (!pool || pool.contributors.length === 0) continue;
    powersHtml += sheetCasterPoolHtml(c, poolName, pool);
  }
  return powersHtml ? '<br><br>' + powersHtml.replace(/^<br><br>/, '') : '';
}

// Sheet, Features: one caster pool (arcane, divine or psionic): level, max
// spell level, save DC, PP, and each contributing class with its prepared
// or known list. Also starts PP tracking for new contributors.
function sheetCasterPoolHtml(c, poolName, pool) {
  const POOL_LABELS = {arcane:'Arcane', divine:'Divine', psionic:'Psionic'};
  const POOL_COLORS = {arcane:'#8aa6dc', divine:'#dccd8a', psionic:'#c499d4'};
  let poolHtml = '';
  const color = POOL_COLORS[poolName];
  // Initialize PP-current tracking on the character if missing (one entry per
  // contributor key). Stored as c.ppCurrent[pool][contributorKey] = number,
  // with a flat sum displayed at pool header.
  if (!c.ppCurrent) c.ppCurrent = {};
  if (!c.ppCurrent[poolName]) c.ppCurrent[poolName] = {};
  let ppCurrentSum = 0;
  let ppBudgetSum = 0;
  for (const ctr of pool.contributors) {
    const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const ctrBudget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    ppBudgetSum += ctrBudget;
    if (c.ppCurrent[poolName][ctrKey] === undefined) {
      c.ppCurrent[poolName][ctrKey] = ctrBudget;
    }
    ppCurrentSum += c.ppCurrent[poolName][ctrKey];
  }
  const attrList = Array.from(pool.attrs).join(', ') || '—';
  poolHtml += `<br><br><b style="color:${color};">${POOL_LABELS[poolName]} Powers</b>`;
  poolHtml += `<div style="font-size:12px;line-height:1.5;margin-top:2px;padding-left:8px;border-left:2px solid ${color};">`;
  // v8.5.4: EAL/EDL/EPL nomenclature (Adam's ruling) — the pool's effective
  // caster/manifester level, best-basic (+advancers/Heritage), NOT a sum.
  const eff = POOL_EFF_LEVEL[poolName];
  poolHtml += `<span style="color:var(--g65);cursor:help;" title="${eff.full} — the ${poolName} pool’s effective ${eff.verb} level: the best contributing class’s level (Basic-class levels don’t stack, HH p.53), plus Prestige advancer levels; Heritage floor-raises to character level. Half-casters count half their class level, rounded up, from 4th.">${eff.abbr} ${pool.cl}</span>`;
  const poolNoun = poolName === 'psionic' ? 'Power' : 'Spell';  // v8.6.0 (Adam): name the thing
  poolHtml += ` &nbsp;|&nbsp; <span style="color:var(--g65);">Max ${poolNoun} Lvl: ${pool.maxPowerLvl}</span>`;
  // v8.3.13: reformat Save DC line. Bake the actual attribute modifier(s) into
  // the formula so the player can read off the per-roll DC directly: just
  // add the power's level. Multi-attribute pools (e.g. arcane with both INT
  // Wizard and CHA Sorcerer contributors) show each attr separately so the
  // player knows which casting attr governs which contributor's powers.
  if (pool.saveDcBase != null) {
    // pool.bestAttrMod is the modifier of the contributor with the highest
    // casting attribute, used for saveDcBase. For mixed-attr pools, we
    // surface this honestly — the player can compute per-contributor DCs
    // from the per-contributor sub-block.
    const sign = pool.bestAttrMod >= 0 ? '+' : '';
    const sum = 10 + pool.bestAttrMod;
    poolHtml += ` &nbsp;|&nbsp; <span style="color:var(--g65);">Base Save DC: 10 + ${attrList} mod (${sign}${pool.bestAttrMod}) = ${sum} + ${poolNoun} Lvl</span>`;
    // v8.5.4 EAL pass: Spell Focus school riders (spell pools only —
    // psionic disciplines aren't schools). +1 per Focus, +1 more per Greater.
    if (poolName !== 'psionic') {
      const sfBySchool = {};
      for (const f of (c.feats || [])) {
        const nm = f.name || f.n || f;
        if ((nm === 'Spell Focus' || nm === 'Greater Spell Focus') && f.param) sfBySchool[f.param] = (sfBySchool[f.param] || 0) + 1;
      }
      const sfList = Object.entries(sfBySchool).map(([s, n]) => `${s} +${n}`).join(', ');
      if (sfList) poolHtml += ` <span style="color:var(--g50);font-size:10px;">(Spell Focus: ${sfList} DC)</span>`;
    }
  } else {
    poolHtml += ` &nbsp;|&nbsp; <span style="color:var(--g65);">Base Save DC: 10 + casting attr mod + ${poolNoun} Lvl</span>`;
  }
  poolHtml += `<br><span style="color:var(--tx85);font-size:12px;">PP Pool: <b>${ppCurrentSum}</b> / ${ppBudgetSum}</span>`;
  // v8.6.0 C8 (final half): the Sheet REPORTS — management moved to its
  // homes (casting/prep on the Spells & Powers tabs, daily recovery on the
  // Tracker's Power Point Recovery panel).
  poolHtml += ` <span style="font-size:10px;color:var(--g50);">— ${poolName === 'psionic' ? 'manifest on the ◈ Powers tab' : 'cast &amp; prepare on the ✨ Spells tab'} · rest on the Tracker</span>`;
  // Per-contributor sub-blocks
  for (const ctr of pool.contributors) {
    const ctrKey = (ctr.class || 'unknown') + ':' + (ctr.level || 0);
    const ctrBudget = (ctr.classPP || 0) + (ctr.classBonusPP || 0);
    const ctrCurrent = c.ppCurrent[poolName][ctrKey];
    const tag = ctr._isAdvancer ? 'advancer' : ctr._fromHeritage ? 'heritage' : ctr._fromFeat ? 'feat' : (ctr.prep ? 'prepared' : 'spontaneous');
    const tagColor = ctr._isAdvancer ? 'var(--g50)' :
                     ctr._fromHeritage ? '#c499d4' :
                     ctr._fromFeat ? '#7daadc' :
                     (ctr.prep ? '#dccd8a' : '#8aa6dc');
    const ctrLabel = ctr.level > 0 ? `${ctr.class} ${ctr.level}` : ctr.class;
    poolHtml += `<br><span style="font-size:11px;color:${tagColor};text-transform:uppercase;letter-spacing:.06em;">${escapeHTML(ctrLabel)}</span>`;
    poolHtml += ` <span style="font-size:9px;color:${tagColor};">[${tag}]</span>`;
    if (ctr._isAdvancer) {
      poolHtml += `<br><span style="color:var(--tx65);font-size:11px;padding-left:12px;">Advancer class: contributes +${ctr.level} ${eff.abbr} only, no PP budget.</span>`;
      continue;
    }
    if (ctr._fromHeritage) {
      poolHtml += `<br><span style="color:var(--tx65);font-size:11px;padding-left:12px;">Heritage feat: +2 PP flat${pool.contributors.filter(x=>!x._isAdvancer && !x._fromHeritage && !x._fromFeat).length===0 ? ', 1st-level capability (class selection deferred to a future release)' : ', floor-raises '+eff.abbr+' to character level ('+(c.totalLvl||0)+')'}.</span>`;
      continue;
    }
    if (ctr._fromFeat) {
      // v8.5.4: Spellslinger / Power Reservoir — character-level bonus PP.
      poolHtml += `<br><span style="color:var(--tx65);font-size:11px;padding-left:12px;">${escapeHTML(ctr.class)} feat: +${ctr.classPP} PP (equal to character level — grows on level-up). No ${eff.abbr} contribution.</span>`;
      continue;
    }
    // Standard caster contributor — v8.6.0 C8 (final half): one compact
    // read-only line per class. The old two-line block with per-contributor
    // ± PP buttons and Rest buttons is retired — adjustment happens where
    // the workflows live (Spells/Powers tabs + the Tracker's PP panel);
    // the Sheet reports.
    const ctrIdSafe = (poolName + '_' + ctrKey).replace(/[^a-z0-9]/gi,'_');
    poolHtml += `<br><span style="font-size:11px;color:var(--tx80);padding-left:12px;">`;
    poolHtml += `<span title="This class’s own ${eff.verb} level — what its spells/powers resolve at.">${eff.abbr} ${ctr.clContribution}</span> · `;
    poolHtml += `${ctr.attr} ${ctr.attrScore} (${ctr.attrMod>=0?'+':''}${ctr.attrMod}) · max ${poolNoun.toLowerCase()} lvl ${ctr.classMaxPowerLvl} · `;
    poolHtml += `PP <b>${ctrCurrent}</b>/${ctrBudget}</span>`;
    // Workflow sub-list
    if (ctr.prep) {
      // v8.5.4 Layer 4: structured prepared list (managed on the Powers &
      // Spells tab) supersedes the free-text textarea; the textarea remains
      // only for characters with no structured data yet.
      const prepList = c.preparedSlots && c.preparedSlots[poolName] && c.preparedSlots[poolName][ctrKey];
      if (prepList && prepList.length) {
        poolHtml += `<br><span style="font-size:11px;color:var(--tx65);padding-left:12px;">Prepared today (memorized at dawn — manage on the Powers &amp; Spells tab):</span>`;
        for (const r of prepList) {
          const left = (r.qty || 0) - (r.cast || 0);
          const hovP = powerHoverText(SPELLS_DB.find(x => x.name === r.name));  // v8.79.0: hover dossier on prepared rows too
          poolHtml += `<br><span style="font-size:11px;padding-left:24px;${left <= 0 ? 'opacity:.45;text-decoration:line-through;' : 'color:#cccca0;'}${hovP ? 'cursor:help;' : ''}" ${hovP ? `title="${escapeHTML(hovP)}"` : ''}>${r.qty}× ${escapeHTML(r.dispName || r.name)} <span style="font-size:9px;opacity:var(--o60);color:var(--dim);">(lvl ${r.lvl}${r.free ? ', free specialty' : ', ' + r.cost + ' PP'})</span>${r.cast ? ` <span style="font-size:9px;color:#d4b870;">${left}/${r.qty} left</span>` : ''}</span>`;
        }
      } else {
        poolHtml += `<br><span style="font-size:11px;color:var(--tx65);padding-left:12px;">Prepared today (memorized at morning prep, PP-cost deducted from budget):</span>`;
        poolHtml += `<br><textarea id="prep-${ctrIdSafe}" placeholder="e.g. 4× Magic Missile (4 PP), 2× Fireball (10 PP), 1× Mage Armor (1 PP)... — or use the structured Prepared Spells panel on the Powers & Spells tab" rows="3" onblur="snapshotPowerTextareas(chars.find(x=>x.id===curId));save();" style="width:95%;margin-left:12px;font-size:11px;background:rgba(0,0,0,.2);color:#cccca0;border:1px solid rgba(200,151,30,.2);padding:4px;">${escapeHTML((c.preparedToday && c.preparedToday[poolName] && c.preparedToday[poolName][ctrKey]) || '')}</textarea>`;
        poolHtml += `<br><span style="font-size:10px;color:var(--g50);padding-left:12px;">During play, cross off instances as they’re cast. PP budget stays empty until next Rest.</span>`;
      }
    } else {
      // Spontaneous — v8.6.0 (Adam's Rhad report, closing proposal C8's
      // spontaneous half): the structured repertoire (c.powers, managed on
      // the Spells/Powers tabs) supersedes the v8.3.12 free-text textarea,
      // which remains only for characters with no structured records in
      // this pool. Records are per-POOL, so the list renders on the first
      // spontaneous contributor of each pool (not repeated per class).
      const poolKnownRecs = getCharPowers(c).filter(p => p.pool === poolName);
      if (poolKnownRecs.length) {
        if (!poolHtml.includes(`data-known-pool="${poolName}"`)) {
          const nounSp = poolName === 'psionic' ? 'Powers' : 'Spells';
          poolHtml += `<br><span data-known-pool="${poolName}" style="font-size:11px;color:var(--tx65);padding-left:12px;">${nounSp} Known (manage on the ${poolName === 'psionic' ? 'Powers' : 'Spells'} tab):</span>`;
          const byName = Object.fromEntries(SPELLS_DB.map(s => [s.name, s]));
          // v8.79.0 (Adam's Rhad report): the known rows carried only
          // level + PP while the Talents above showed full prose — the
          // descriptions now ride a hover dossier (the house cursor:help
          // idiom: stat line + full text at zero vertical cost; the
          // Powers/Spells tabs remain the management surface).
          for (const p of poolKnownRecs) {
            const s = byName[p.name];
            const nm = (s && p.token) ? displayNameForRoute(s, {token: p.token, lvl: p.lvl, pool: p.pool, applies: p.applies}) : p.name;
            const lvlBit = (p.lvl !== undefined && p.lvl !== null) ? ` <span style="font-size:9px;opacity:var(--o60);color:var(--dim);">(lvl ${p.lvl}${s ? ', ' + powerCastCost(s, p.lvl) + ' PP' : ''})</span>` : '';
            const hov = powerHoverText(s);
            poolHtml += `<br><span style="font-size:11px;padding-left:24px;color:#cccca0;${hov ? 'cursor:help;' : ''}" ${hov ? `title="${escapeHTML(hov)}"` : ''}>${escapeHTML(nm)}${nm !== p.name ? ` <span style="font-size:9px;opacity:.5;">(${escapeHTML(p.name)})</span>` : ''}${lvlBit}${p.personal ? ' <span style="font-size:9px;color:var(--vio);">✦</span>' : ''}</span>`;
          }
        }
      } else {
        const knownList = (c.powersKnownList && c.powersKnownList[poolName] && c.powersKnownList[poolName][ctrKey]) || '';
        poolHtml += `<br><span style="font-size:11px;color:var(--tx65);padding-left:12px;">${ctr.class} ${ctr.class === 'Sorcerer' || ctr.class === 'Bard' ? 'Spells' : 'Powers'} Known:</span>`;
        poolHtml += `<br><textarea id="known-${ctrIdSafe}" placeholder="Type your known ${ctr.class === 'Sorcerer' || ctr.class === 'Bard' ? 'spells' : 'powers'} here, one per line... — or use the structured catalogue on the Spells/Powers tab" rows="3" onblur="snapshotPowerTextareas(chars.find(x=>x.id===curId));save();" style="width:95%;margin-left:12px;font-size:11px;background:rgba(0,0,0,.2);color:#cccca0;border:1px solid rgba(200,151,30,.2);padding:4px;">${escapeHTML(knownList)}</textarea>`;
      }
      poolHtml += `<br><span style="font-size:10px;color:var(--g50);padding-left:12px;">Spend PP from this budget when ${poolName === 'psionic' ? 'manifesting' : 'casting'} (1/3/5/7/9/11/13/15/17 by ${poolNoun.toLowerCase()} level, HH p.404).</span>`;
    }
  }
  poolHtml += `</div>`;
  return poolHtml;
}

// Sheet, Features: the Talents list, grouped by tree ("" if not entitled).
function sheetTalentsHtml(c) {
  // v8.3.21: Talents section on the Sheet. Gated by entitlement — only shown
  // for characters who can have talents (any Hero class, Multi-Talented, or
  // already-owned talents per the permissive recovery rule).
  if (!characterIsEntitledToTalents(c)) return '';
  const tBudget = getTalentBudget(c);
  const ownedTalents = c.talents || [];
  // v8.71.0 (Adam's grooming pass): the Gift's retired Sheet banner lives
  // on as a chip here when assigned to 'talent'. The model never records
  // WHICH talent is the Gift (the budget just carries +1), so the chip
  // crowns the section, not a specific pick.
  const _giftTalentChip = (!isLegacyCharacter(c) && c.heroesGiftChoice === 'talent')
    ? ` <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.45);background:rgba(196,153,212,.1);padding:1px 5px;border-radius:2px;margin-left:4px;cursor:help;" title="Hero's Gift — assigned as a Talent: +1 talent in this budget. Which specific talent is the Gift isn't tracked; the budget carries it. To reassign (feat ↔ talent), retcon via ✎ Edit — downstream prereq chains may break; the GM-exception ledger records any breaks detected.">⬟ incl. Hero's Gift</span>`
    : '';
  let talentsHtml = `<br><br><b style="color:var(--gold);">Talents</b> <span style="font-size:10px;color:var(--g55);">(${tBudget.totalPicked} / ${tBudget.totalOwed})</span>${_giftTalentChip}`;
  if (!ownedTalents.length) {
    talentsHtml += `<br><span style="font-size:11px;color:var(--g45);font-style:italic;">None selected. Use the Talents tab to add.</span>`;
  } else {
    // Group by tree for clarity.
    const byTree = {};
    for (const t of ownedTalents) {
      const data = TALENTS_DB.find(x => x.n === t.name);
      const tree = data?.tree || 'Unattributed';
      if (!byTree[tree]) byTree[tree] = [];
      byTree[tree].push({entry:t, data});
    }
    for (const tree in byTree) {
      talentsHtml += `<br><span style="font-size:11px;color:var(--g55);text-transform:uppercase;letter-spacing:.06em;">${escapeHTML(tree)}</span>`;
      for (const {entry, data} of byTree[tree]) {
        const tier = data?.tier || 'Talent';
        const tierColor = tier === 'Apex Super-Talent' ? '#c499d4'
                        : tier === 'Super-Talent' ? '#7daadc'
                        : 'var(--gold)';
        talentsHtml += `
            <div style="font-size:12px;line-height:1.45;padding:2px 0 2px 12px;border-left:2px solid ${tierColor};margin-top:2px;">
              <b style="color:var(--gold);">${escapeHTML(entry.name)}</b>${citeHTML('talents', entry.name)}
              <span style="font-size:9px;color:${tierColor};text-transform:uppercase;letter-spacing:.06em;margin-left:6px;">[${escapeHTML(tier)}]</span>
              ${data?.d ? `<br><span style="color:var(--tx70);font-size:11px;">${escapeHTML(data.d)}</span>` : ''}
            </div>`;
      }
    }
  }
  return talentsHtml;
}

// Sheet, Features: owned mutations with their effect lines ("" if none).
function sheetMutationsHtml(c) {
  // v8.6.0 mutation audit: owned mutations on the sheet with their effect
  // lines — numeric effects already flow into the stats above; this block is
  // the table-play reference for the rest (senses, natural attacks, activated
  // abilities, burdens).
  if (!(c.mutations || []).length) return '';
  let muHtml = `<br><br><b style="color:var(--vio);">Mutations</b>`;
  for (const m of c.mutations) {
    const fx = MUTATION_EFFECTS[m.name] || {};
    const bits = [];
    if (m.attrApplied) bits.push(`${m.attrApplied > 0 ? '+' : ''}${m.attrApplied} ${m.attr}${m.name.startsWith('Supernatural') ? ' (Su)' : m.kind === 'attribute' ? ' (Ex)' : ''}`);
    for (const sk in (fx.skills || {})) bits.push(`${fx.skills[sk] > 0 ? '+' : ''}${fx.skills[sk]} ${sk}`);
    for (const sv in (fx.saves || {})) bits.push(`${fx.saves[sv] > 0 ? '+' : ''}${fx.saves[sv]} ${({fort:'Fort',ref:'Ref',will:'Will'})[sv]}`);
    if (fx.naturalAC) bits.push(`+${fx.naturalAC} natural AC`);
    for (const g of ['senses', 'natural', 'active', 'notes']) for (const t of (fx[g] || [])) bits.push(t);
    for (const sk in (fx.condSkills || {})) bits.push(`${fx.condSkills[sk][0] > 0 ? '+' : ''}${fx.condSkills[sk][0]} ${sk} ${fx.condSkills[sk][1]}`);
    for (const sv in (fx.condSaves || {})) bits.push(`${fx.condSaves[sv][0] > 0 ? '+' : ''}${fx.condSaves[sv][0]} ${({fort:'Fort',ref:'Ref',will:'Will'})[sv]} ${fx.condSaves[sv][1]}`);
    muHtml += `
        <div style="font-size:12px;line-height:1.45;padding:2px 0 2px 12px;border-left:2px solid rgba(196,153,212,.5);margin-top:2px;">
          <b style="color:var(--gold);">${escapeHTML(m.name)}${m.attr ? ' (' + m.attr + ')' : ''}</b>
          <span style="font-size:9px;color:var(--vio);text-transform:uppercase;letter-spacing:.06em;margin-left:6px;">[${m.kind}]</span>
          ${bits.length ? `<br><span style="color:var(--tx70);font-size:11px;">${escapeHTML(bits.join(' · '))}</span>` : ''}
        </div>`;
  }
  return muHtml;
}

// Sheet: languages, allegiances, notes and the class summary.
function renderSheetFooter(c, classArr) {
  document.getElementById('sh-langs').innerHTML=`<b style="color:var(--gold);">Languages:</b> ${c.langs||'Common'}<br><b style="color:var(--gold);">Allegiances:</b> ${c.allegiance||'—'}`;
  document.getElementById('sh-notes').textContent=c.notes||'None.';
  // Class level drilldown summary — one row per entry
  const tierLabels={hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'};
  const summary=classArr.map(e=>`<div><b style="color:var(--gold);">${e.name}</b> Lvl ${e.level} <span style="font-size:11px;color:var(--g55);">(${tierLabels[e.tier]||'?'} Class)</span></div>`).join('');
  // v8.39.2 (Adam's catch): the in-list "▾ Class Tables" button duplicated
  // the section header's toggle (both called toggleDrill('sh-drill')) —
  // removed; the header button now carries the "Class Tables" label.
  document.getElementById('sh-classes').innerHTML=
    summary+
    `<div style="color:var(--g55);font-size:12px;margin-top:4px;">Total Level: ${c.totalLvl} &nbsp;|&nbsp; ECL: ${c.ecl}</div>`;
}
function renderDrilldown(c){
  const d=document.getElementById('sh-drill');
  const classArr=migrateLegacyClasses(c);
  let html='';
  const drawTbl=(name,cls,curLvl,kind)=>{
    if(!cls)return'';
    const cap=cls.bab.length;
    const rows=[];
    // v8.3.32: Ordinary classes have no per-level features (no Talents, no
    // bonus feats, no Hero's Gift) — treat them like Basic classes in this
    // table (em-dash, and the Features column is omitted entirely).
    const showFeatures = kind!=='basic' && kind!=='ordinary';
    for(let l=1;l<=cap;l++){
      const i=l-1;
      const feat=kind==='hero'?(l%2===0?'Bonus Feat':'Talent'):(l%3===0?'Bonus Feat':'Class Feature');
      rows.push(`<tr class="${l===curLvl?'cur-lvl':''}"><td>${l}</td><td>+${cls.bab[i]}</td><td>+${cls.fort[i]}</td><td>+${cls.ref[i]}</td><td>+${cls.will[i]}</td><td>+${cls.def[i]}</td><td>+${cls.rep[i]}</td>${showFeatures?`<td>${feat}</td>`:''}</tr>`);
    }
    const label={hero:'',ordinary:' (Ordinary Class)',basic:' (Basic Class)',advanced:' (Advanced Class)',prestige:' (Prestige Class)'}[kind]||'';
    return`<div style="font-family:'Epics Serif','Cinzel',serif;font-size:11px;color:var(--gold);margin:.75rem 0 .5rem;">${name} — Level Progression${label}</div>
    <table class="lvl-tbl"><thead><tr><th>Lvl</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Def</th><th>Rep</th>${showFeatures?'<th>Features</th>':''}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  };
  for(const e of classArr){
    const cls=getClassEntry(e);
    html+=drawTbl(e.name,cls,e.level,e.tier);
  }
  d.innerHTML=html||'<div style="color:var(--g40);font-size:13px;">No class data to display.</div>';
}

