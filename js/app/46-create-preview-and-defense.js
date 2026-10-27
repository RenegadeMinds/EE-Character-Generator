// =============================================================================
// js/app/46-create-preview-and-defense.js
// CREATE PREVIEW AND DEFENSE
// =============================================================================
//
// WHAT'S IN HERE
//   Create page: the class preview and derived stats, attribute bumps every
//   4th level, the HP mode controls, and the T/ACtical combat numbers (AC
//   display, parry, dodge).
//
// KEY NAMES (so you can search for them)
//   functions (16): updateClassPreview, renderAllPrereqChecks, applyAttrBumps,
//   bumpCountForLevel, renderAttrBumpsPanel, onAttrBumpChange, getFormHpMode,
//   setFormHpMode, onHpModeChange, rerollFormHp, renderHpRollPreview,
//   updateDerived, syncFormHpRollsLength, computeACDisplay, computeParryBonus,
//   computeDodgeBonus
//
// LOAD ORDER
//   File 46 of 68. index.html loads it after js/app/45-create-class-list.js
//   and before js/app/47-save-character.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 39635-40184 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 39635-40184; unchanged below this line ----
// ========== CLASS PREVIEW & DERIVED (operating on formClasses array) ==========
function updateClassPreview(){
  const prev=document.getElementById('class-preview');
  if(!prev)return;
  // Live preview text — list each class entry
  const sl=getSixLevels();
  const dis=disabledClassesForScenario(sl);
  let html='';
  for(const e of formClasses){
    const cls=getClassEntry(e);
    if(!cls){html+=`<span style="color:var(--red-text);">${e.name} (${e.tier}) — class data not found</span><br>`;continue;}
    const tierLabel={hero:'',basic:' (Basic)',advanced:' (Advanced)',prestige:` (Prestige, max ${cls.maxLvl||10})`}[e.tier]||'';
    const apHint=e.tier==='hero'?` · AP ${cls.apB}+½lvl`:'';
    const flag=dis.has(e.name)?' <span style="color:var(--red-text);">⚠ scenario-disallowed</span>':'';
    html+=`<span style="color:var(--gold);">${e.name}</span> Lvl ${e.level} · d${cls.hd} · ${cls.sp}+Int SP/lvl${apHint}<span style="color:var(--g50);">${tierLabel}</span>${flag}<br>`;
  }
  const totalLvl=formClasses.reduce((s,e)=>s+(e.level||0),0);
  const _eclRace=document.getElementById('c-race').value;
  const eclMod=_eclRace==='Hybrid'?(_formHybridRlm()):(RACES[_eclRace]?.ecl||0);  // v8.68.0: Hybrid-aware
  html+=`<span style="color:var(--g50);">Total Level: ${totalLvl} &nbsp;|&nbsp; ECL: ${totalLvl+eclMod}</span>`;
  prev.innerHTML=html;
  renderAllPrereqChecks();
  // v8.2.3 (Issue B): re-render the bumps panel since totalLvl may have changed.
  // This appears/disappears based on totalLvl >= 4.
  renderAttrBumpsPanel();
  updateDerived();
}
// Render prereq panels for every Advanced and Prestige class entry in the form
function renderAllPrereqChecks(){
  const root=document.getElementById('prereq-checks');
  if(!root)return;
  let skills={},feats=[];
  if(editId){
    const existing=chars.find(c=>c.id===editId);
    if(existing){skills=existing.skills||{};feats=existing.feats||[];}
  }
  const sl=getSixLevels();
  // Pull live form values for attribute / allegiance checks
  const ctx={
    attrs:getAttrs(),
    allegiance:document.getElementById('c-allegiance')?.value||'',
    align:document.getElementById('c-align')?.value||'',
  };
  const panels=[];
  for(const e of formClasses){
    // v8.3.23: check all four tiers (Hero/Basic attrMin now surfaced too).
    // Hero and Basic classes typically have no `prereqs` array, so the check
    // returns met=true unless attrMin is unmet.
    const otherEntries=formClasses.filter(x=>x!==e);
    const result=checkClassPrereqsFromArray(e.name, otherEntries, skills, feats, sl, ctx);
    const tierLabel={hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[e.tier]||e.tier;
    // Only surface a panel entry if there's a violation, OR the class is
    // Advanced/Prestige (where the all-met state is informative). For Hero/Basic
    // classes with no violation, suppress the noise.
    if(!result.met){
      panels.push(`<div style="color:var(--red-text);border:1px solid rgba(139,26,26,.3);background:rgba(139,26,26,.08);padding:7px 10px;border-radius:3px;font-size:12px;"><b>⚠ Missing prerequisites</b> for ${e.name} (${tierLabel}):<ul style="margin:4px 0 0 1.2em;padding:0;">${result.missing.map(m=>`<li>${m}</li>`).join('')}</ul><div style="font-size:11px;margin-top:4px;color:var(--g55);">Items marked "GM-verify" can't be auto-checked — confirm with your GM. Save anyway if granted an exception.</div></div>`);
    } else if(e.tier==='advanced' || e.tier==='prestige'){
      panels.push(`<div style="color:#6dba88;border:1px solid rgba(50,140,80,.3);background:rgba(50,140,80,.08);padding:7px 10px;border-radius:3px;font-size:12px;"><b>✓ Prerequisites met</b> for ${e.name} (${tierLabel}).</div>`);
    }
  }
  root.innerHTML=panels.join('');
}
// v8.2.3 (Issue B): Compute "effective" attribute scores — base + racial is
// already baked into c.attrs as stored. Then we add the attribute bumps from
// the bumps list. Returns a new array of 6 ints. Does NOT mutate the input.
function applyAttrBumps(baseAttrs, bumps) {
  const out = baseAttrs.slice();
  if (!Array.isArray(bumps)) return out;
  for (const bump of bumps) {
    if (!bump) continue;
    const idx = ATTR_NAMES.indexOf(bump);
    if (idx >= 0) out[idx] = (out[idx] || 0) + 1;
  }
  return out;
}

// v8.2.3 (Issue B): How many bumps does a character of `totalLvl` get?
// HH p.879: every 4th level → at levels 4, 8, 12, 16, 20.
function bumpCountForLevel(totalLvl) {
  return Math.floor(Math.max(0, totalLvl) / 4);
}

// v8.2.3 (Issue B): Render the bumps panel based on current totalLvl and
// formAttrBumps. The panel is shown when totalLvl >= 4 and hidden otherwise.
function renderAttrBumpsPanel() {
  const panel = document.getElementById('attr-bumps-panel');
  const rowsDiv = document.getElementById('attr-bumps-rows');
  if (!panel || !rowsDiv) return;
  const totalLvl = formClasses.reduce((s, e) => s + (e.level||0), 0);
  const need = bumpCountForLevel(totalLvl);
  if (need <= 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  // Ensure formAttrBumps is sized correctly. Preserve existing assignments
  // when growing/shrinking.
  while (formAttrBumps.length < need) formAttrBumps.push('');
  if (formAttrBumps.length > need) formAttrBumps = formAttrBumps.slice(0, need);
  // Build rows
  const rows = [];
  for (let i = 0; i < need; i++) {
    const level = (i + 1) * 4;
    const sel = formAttrBumps[i] || '';
    const opts = ['<option value="">— choose attribute —</option>'].concat(
      ATTR_NAMES.map(a => `<option value="${a}" ${a===sel?'selected':''}>${a}</option>`)
    ).join('');
    const status = sel
      ? `<span style="color:var(--g65);font-size:10px;">→ +1 ${sel}</span>`
      : `<span style="color:#d4b870;font-size:10px;">⚠ pending</span>`;
    rows.push(`<div style="display:flex;gap:8px;align-items:center;">
      <span style="font-family:'Epics Serif','Cinzel',serif;font-size:11px;color:var(--g75);min-width:75px;">Level ${level}:</span>
      <select onchange="onAttrBumpChange(${i}, this.value)" style="flex:1;max-width:160px;font-size:12px;">${opts}</select>
      ${status}
    </div>`);
  }
  rowsDiv.innerHTML = rows.join('');
}

function onAttrBumpChange(idx, value) {
  while (formAttrBumps.length <= idx) formAttrBumps.push('');
  formAttrBumps[idx] = value || '';
  renderAttrBumpsPanel();
  // Recompute derived stats since attribute mods may have changed
  updateDerived();
}

// v8.2.3 (Issue A): HP mode helpers for the create form. Reads the radio
// button group to find the current mode, regenerates formHpRolls when the
// mode changes or the player clicks re-roll, and renders a preview of the
// per-level rolls so the player sees what they got.
function getFormHpMode() {
  const radios = document.querySelectorAll('input[name="c-hp-mode"]');
  for (const r of radios) if (r.checked) return r.value;
  return 'hero';
}

function setFormHpMode(mode) {
  formHpMode = mode;
  const radios = document.querySelectorAll('input[name="c-hp-mode"]');
  for (const r of radios) r.checked = (r.value === mode);
}

function onHpModeChange() {
  formHpMode = getFormHpMode();
  // Regenerate rolls for the new mode
  formHpRolls = generateHpRolls(formClasses, formHpMode);
  renderHpRollPreview();
  updateDerived();
}

function rerollFormHp() {
  formHpMode = getFormHpMode();
  formHpRolls = generateHpRolls(formClasses, formHpMode);
  renderHpRollPreview();
  updateDerived();
  toast('HP re-rolled (' + formHpMode + ' mode).');
}

function renderHpRollPreview() {
  const el = document.getElementById('hp-roll-preview');
  if (!el) return;
  if (!formHpRolls || formHpRolls.length === 0) {
    el.textContent = '';
    return;
  }
  // Tag each roll with its class context for readability
  const tags = [];
  let rollIdx = 0;
  for (const e of formClasses) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      if (rollIdx < formHpRolls.length) {
        const isFirst = (rollIdx === 0);
        const roll = formHpRolls[rollIdx];
        tags.push(`${e.name} L${j+1}: ${roll}${isFirst ? ' (max)' : ''}/d${cls.hd}`);
      }
      rollIdx++;
    }
  }
  if (tags.length === 0) {
    el.textContent = '';
    return;
  }
  el.innerHTML = '<b>Per-level rolls:</b> ' + tags.join(' &middot; ');
}

function updateDerived(){
  const baseAttrs=getAttrs();
  // v8.2.3 (Issue B): apply attribute bumps before computing modifiers
  const attrs = applyAttrBumps(baseAttrs, formAttrBumps);
  const conM=am(attrs[2]),dexM=am(attrs[1]),wisM=am(attrs[4]),strM=am(attrs[0]);
  const _formHeroic = parseInt(document.getElementById('c-sl-heroic')?.value) || 0;
  const _formFP = (editId && chars.find(x=>x.id===editId)?.fatePoints) || 0;
  // v8.3.32: route the heroic level through effectiveHeroicLevelForAP so the
  // form preview correctly shows NO AP for a purely-Ordinary build. Pass a
  // synthetic {classes, sixLevels} so the helper can inspect the form's
  // current class list.
  const _formApHeroic = effectiveHeroicLevelForAP({classes: formClasses, sixLevels: {heroic: _formHeroic}});
  const s=computeStatsFromClasses(formClasses, attrs[5], _formApHeroic, _formFP);
  // v8.3.5: read the two natural-AC form fields. Racial is auto-populated
  // by updateRaceInfo from the race's structured natAC; bonus is the
  // player-editable field for magic/equipment. They compose by simple sum
  // here in the form preview (where we don't have a full source-typed
  // model yet). The hidden c-natural-ac field is synced for backward
  // compatibility with any read paths not yet migrated.
  const racialNACForm = parseInt(document.getElementById('c-racial-nac')?.value) || 0;
  const bonusNACForm  = parseInt(document.getElementById('c-bonus-nac')?.value)  || 0;
  const naturalACTotal = racialNACForm + bonusNACForm;
  const legacyNACEl = document.getElementById('c-natural-ac');
  if (legacyNACEl) legacyNACEl.value = naturalACTotal;
  // Synthesize a minimal char-shaped object for the preview helpers
  const formChar = {
    attrs, def: s.def, bab: s.bab, ref: s.ref, feats: [],
    armorAC:  parseInt(document.getElementById('c-armor-ac')?.value)  || 0,
    shieldAC: parseInt(document.getElementById('c-shield-ac')?.value) || 0,
    naturalAC: naturalACTotal,
  };
  // v8.2.3: ensure formHpRolls matches the current class array shape.
  syncFormHpRollsLength();
  // v8.2.3 (Issue A): use stored rolls for HP. +5 per natural AC (HH p.347).
  const hp=computeMaxHPFromRolls(formClasses,formHpRolls,conM) + (naturalACTotal * 5);
  const acDisp = computeACDisplay(formChar);
  const parry  = computeParryBonus(formChar);
  const dodge  = computeDodgeBonus(formChar);
  const el=document.getElementById('derived-stats');
  if(el){
    const stats = [
      {l:'Max HP',v:hp},
      {l:acDisp.label, v:acDisp.value},
      {l:'Parry', v:(parry.total>=0?'+':'')+parry.total},
      {l:'Dodge', v:(dodge.total>=0?'+':'')+dodge.total},
    ];
    // Natural Hardness only appears for characters with a natural AC modifier
    if (formChar.naturalAC > 0) {
      stats.push({l:'Nat. Hardness', v:formChar.naturalAC});
    }
    stats.push(
      {l:'Base Attack',v:(s.bab>=0?'+':'')+s.bab},
      {l:'Initiative',v:(dexM>=0?'+':'')+dexM},{l:'Def Bonus',v:(s.def>=0?'+':'')+s.def},
      {l:'Fort Save',v:(s.fort+conM>=0?'+':'')+(s.fort+conM)},{l:'Ref Save',v:(s.ref+dexM>=0?'+':'')+(s.ref+dexM)},
      {l:'Will Save',v:(s.will+wisM>=0?'+':'')+(s.will+wisM)},{l:'Action Pts',v:s.ap},{l:'Total Lvl',v:s.totalLvl},
    );
    el.innerHTML = stats.map(c=>`<div class="stat-cell"><span class="sc-lbl">${c.l}</span><span class="sc-val">${c.v}</span></div>`).join('');
  }
  // Render the HP roll preview after the rolls have been synced
  renderHpRollPreview();
}

// v8.2.3 (Issue A): keep formHpRolls aligned with formClasses' total level.
// Grows by rolling at the current mode; shrinks by truncation (preserves
// earlier rolls so removing levels doesn't re-randomize what's left).
function syncFormHpRollsLength() {
  let needed = 0;
  for (const e of formClasses) needed += Math.max(0, e.level || 0);
  if (formHpRolls.length === needed) return;
  if (formHpRolls.length > needed) {
    formHpRolls = formHpRolls.slice(0, needed);
    return;
  }
  // Need to grow. Determine which die to roll for each new level (level-by-
  // level walk of formClasses, skipping the levels we already have rolls for).
  let cursor = 0;
  for (const e of formClasses) {
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      if (cursor >= formHpRolls.length) {
        // Roll for this level. First-overall level gets max regardless.
        const isFirstOverall = (cursor === 0);
        formHpRolls.push(isFirstOverall ? cls.hd : rollHitDieForMode(cls.hd, formHpMode));
      }
      cursor++;
    }
  }
}

// ========== T/ACtical COMBAT SYSTEM (v8.1.7) ==========
// The T/ACtical Combat System layers Armor Class into up to four tiers, displayed
// in a compact label that scales to the character's actual defenses:
//   AC           — no equipment, no natural armor (1 number)
//   T/AC 10/13   — equipment only (2 numbers: Touch, Total)
//   T/NC 10/14   — natural armor only, no equipment (2 numbers: Touch, NatCrit)
//   T/A/NC 10/13/16 — both equipment and natural armor (3 numbers)
// Critical-confirmation threshold equals the highest existing tier.
// Per handbook (HH p.347):
//   Touch  = 10 + Dex mod + Defense bonus + Size mod
//   Total  = Touch + equipment (armor + shield)
//   Natural-Critical = Total + natural armor mod
// Per handbook (HH p.373, p.377):
//   Parry attempt = 1d20 + BAB + Str mod + Defense bonus + Shield AC bonus
//   Dodge attempt = 1d20 + Reflex save + Defense bonus + dodge AC bonus(es)
//
// computeACDisplay(c, opts) — returns the smart-compacting AC label.
// opts.armor, opts.shield, opts.natural can override the character's stored values
// (used by the create-form preview before save).
function computeACDisplay(c, opts){
  opts = opts || {};
  // v8.8.0 (Adam): the equipped armor's maximum Dex bonus caps what Dex can
  // contribute to AC (limited mobility — HH armor descriptions). Applies to
  // Touch and everything built on it; Morphic Metal Alloy raises the cap.
  // v8.12.2 (Adam's Rhad catch): EFFECTIVE Dex (equipped-item enhancements,
  // fatigue), matching computeStatBlock's firm-wire convention — was raw.
  let dexM = am(effAttrs(c)[1]);
  const _mdxCap = armorMaxDexCap(c);
  const _dexCapped = (_mdxCap != null && dexM > _mdxCap);
  if (_dexCapped) dexM = _mdxCap;
  // v8.16.0 Races pass: size derives from the race (+1 Small, −1 Large);
  // an explicit c.sizeMod (GM) overrides.
  const size = (c.sizeMod != null) ? c.sizeMod : (raceACSizeMod(c));
  const def = c.def || 0;
  // v8.5.2: equipped armor/shield item (incl. mastercraft) takes precedence
  // over the manual c.armorAC/c.shieldAC fields; those remain the fallback
  // for homebrew gear not in the catalogue, or when nothing is equipped.
  const eq = computeEquippedArmorShield(c);
  const armor   = opts.armor   ?? (eq.armor   ?? (c.armorAC   ?? 0));
  const shield  = opts.shield  ?? (eq.shield  ?? (c.shieldAC  ?? 0));
  // v8.3.5: natural AC is now a SourcedValue. computeNaturalAC reads
  // c.naturalACSources (preferred) or falls back to the legacy c.naturalAC
  // scalar. Per d20 rules, same-type natural-armor sources resolve "best
  // wins"; natural-armor enhancement (type:'enhancement') stacks with the
  // base. The aggregator handles this uniformly. The provenance breakdown
  // is exposed via opts.naturalProvenance for the caller (used by the
  // sheet's Nat. AC stat-cell tooltip).
  const natComputed = opts.naturalAC || computeNaturalAC(c);
  const natural = opts.natural ?? natComputed.total;
  applyClassFeatureEffects(c);
  const touchAcBonus = c._touchAcBonus || 0;
  // v8.8.2: Rage's −2 AC (Ex, all tiers) while the toggle is active.
  const ragePen = (c.raging && rageTier(c)) ? -2 : 0;
  // v8.76.0 (Adam's Hellfire report — the AC cell ignored declared stances):
  // this parallel composer never read combatDecl, so CE's dodge bonus, RO's
  // −4, AND Best Defense's def spend (a latent v8.65.0 gap — the lanes
  // carried it but this display reads raw c.def) all missed the T/AC
  // tiers. All three are touch-legal: CE is a dodge bonus (HH p.207), RO
  // is a flat AC penalty, BD spends the Defense Bonus that feeds touch.
  const _dclA = combatDecl(c);
  const declCE = _dclA.ce || 0, declRO = _dclA.ro ? -4 : 0, declBD = -(_dclA.bd || 0);
  const declAC = declCE + declRO + declBD;
  // v8.12.2 (Adam's Rhad catch — Ring of Protection +2 missing from T/AC):
  // typed misc AC from the aggregator channels computeStatBlock already
  // collects but this display never read — deflection items (buildMagic-
  // ItemBonuses), unconditional dodge feats (Improved/Advanced Dodge),
  // racial AC. All surviving types apply to TOUCH and everything built on
  // it; armor/shield/natural types are excluded (natural rides
  // computeNaturalAC), conditional entries stay situational.
  let miscAC = 0; const miscParts = [];
  try {
    const pool = [
      ...((buildMagicItemBonuses(c).ac) || []),
      ...((buildFeatBonuses(c).ac) || []),
      ...((buildRacialBonuses(c.race).ac) || []),
      // v9.19.0 (old-boys report #2 — Mental Barrier's deflection missing
      // from the AC headline): the activeEffects lane, the SAME channel
      // computeStatBlock's ac lane reads (v8.42.0's aeBon). §278's disease,
      // third cell: the engine computed it, this parallel composer never
      // read it. Deflection and friends are touch-legal; gated entries
      // carry .condition and fall to the filter below; NPF suppression is
      // inside activeBuffBonuses itself.
      ...((activeBuffBonuses(c).ac) || []),
    ].filter(b => !b.condition && !['armor', 'shield', 'natural'].includes(b.type));
    if (pool.length) {
      const agg = aggregateBonuses(pool);
      miscAC = agg.total || 0;
      for (const b of ((agg.breakdown && agg.breakdown.applied) || [])) miscParts.push(`${b.value >= 0 ? '+' : '−'} ${Math.abs(b.value)} ${b.type || 'misc'} (${b.label || b.source})`);
    }
  } catch (e) {}
  const touch = 10 + dexM + def + size + touchAcBonus + ragePen + miscAC + declAC;
  const total = touch + armor + shield;
  const natCrit = total + natural;
  const hasEq  = (armor + shield) > 0;
  const hasNat = natural > 0;
  // Build the Touch formula string with the class-feature bonus if any
  const touchFormula = `10 + ${dexM} Dex${_dexCapped ? ` (capped by armor's max Dex +${_mdxCap})` : ''} + ${def} Def${size?' + '+size+' size':''}${touchAcBonus?' + '+touchAcBonus+' class':''}${ragePen?' − 2 Rage':''}${declCE ? ` + ${declCE} Combat Expertise (declared)` : ''}${declRO ? ' − 4 Reckless Offense (declared)' : ''}${declBD ? ` − ${-declBD} Best Defense (declared)` : ''}${miscParts.length ? ' ' + miscParts.join(' ') : ''}`;
  // v8.13.0 (Adam's T/ACtical armor pass): the band annotation — what a hit
  // in [touch, total) actually strikes, with live hardness/HP.
  let tacNote = '';
  try {
    const gsBits = [];
    for (const it2 of getCharItems(c)) {
      if (it2.catalogue !== 'armor' || !it2.equipped) continue;
      const g = armorItemIntegrity(it2);
      if (g) gsBits.push(`${enchantDisplayName(it2)} — Hardness ${g.hardness}, HP ${g.hp}/${g.maxHP}${g.destroyed ? ' ☠ destroyed' : g.broken ? ' ⚑ broken' : ''}`);
    }
    if (gsBits.length && total > touch) tacNote = ` · results ${touch}–${total - 1} strike the armor (hardness applies, split on the Tracker): ${gsBits.join('; ')}`;
  } catch (e) {}
  let label, value, tiers;
  if (!hasEq && !hasNat) {
    label = 'AC'; value = String(touch);
    tiers = [{name:'AC', val:touch, formula:touchFormula}];
  } else if (hasEq && !hasNat) {
    label = 'T/AC'; value = `${touch}/${total}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'Armor', val:total, formula:`T${armor?' + '+armor+' armor':''}${shield?' + '+shield+' shield':''} = ${total}${tacNote}`},
    ];
  } else if (!hasEq && hasNat) {
    label = 'T/NC'; value = `${touch}/${natCrit}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'NatCrit', val:natCrit, formula:`T + ${natural} natural = ${natCrit}`},
    ];
  } else {
    label = 'T/A/NC'; value = `${touch}/${total}/${natCrit}`;
    tiers = [
      {name:'Touch', val:touch, formula:touchFormula},
      {name:'Armor', val:total, formula:`T${armor?' + '+armor+' armor':''}${shield?' + '+shield+' shield':''} = ${total}${tacNote}`},
      {name:'NatCrit', val:natCrit, formula:`A + ${natural} natural = ${natCrit}`},
    ];
  }
  return {label, value, tiers, touch, total, natCrit};
}

// Compute Parry attempt modifier per handbook HH p.377.
// Formula: BAB + Str mod + Defense bonus + Shield AC bonus
function computeParryBonus(c, opts){
  opts = opts || {};
  let strM = am(c.attrs[0]);
  let strLabel = 'Str';
  // v9.7.0 (§257): Weapon Finesse — "you may use your Dexterity modifier
  // instead of your Strength modifier on attack rolls AND PARRY ATTEMPTS"
  // (HH p.255) — exercised while wielding a finesse-eligible melee weapon
  // (or bare-handed: the unarmed strike is a light weapon) and Dex wins.
  try {
    if ((c.feats || []).some(f => (f.name || f.n) === 'Weapon Finesse')) {
      const dexP = am(c.attrs[1]);
      const held = getCharItems(c).filter(i => i.catalogue === 'weapon' && i.equipped);
      const finesseWielding = held.length === 0 || held.some(i => { const d = getCatalogueEntry('weapon', i.ref); return d && !isRangedWeapon(d) && isFinesseEligible(d); });
      if (finesseWielding && dexP > strM) { strM = dexP; strLabel = 'Dex (Weapon Finesse)'; }
    }
  } catch (e) {}
  const def = c.def || 0;
  const bab = c.bab || 0;
  const shield = opts.shield ?? (c.shieldAC ?? 0);
  // v8.65.0: Best Defense SPENDS Defense Bonus — def-fed stats move (PA's
  // mirror, Adam's ruling: "right down to the attendant Defense Bonus
  // modifier").
  const _bd = (combatDecl(c).bd || 0);
  // v9.12.1 (§270, Adam's re-reading 2026-10-10, superseding v8.98.0): PA
  // and CE are penalties to MELEE ATTACK ROLLS while engaged — Base Attack
  // is never spent (both feat BODIES, HH pp.207/235; the summary table's
  // "reduce Base Attack modifier" is the book typo, letter on TODO). A
  // parry is not a melee attack roll, so neither stance's penalty reaches
  // it, no refund is needed, and the v8.98.0 CE-amendment letter is
  // WITHDRAWN. What DOES reach the Parry: CE's Defense bonus — "affects
  // the character's AC (both touch and total), dodge modifier, and PARRY
  // modifier" (HH p.207) — so CE nets +N Parry with no arithmetic contortions.
  const _dP = combatDecl(c);
  const _ceP = _dP.ce || 0;
  const _roP = _dP.ro ? 4 : 0;
  const parts = [
    {label:'BAB', value:bab},
    {label:strLabel, value:strM},
    {label:'Def', value:def},
    {label:'Shield', value:shield},
  ];
  // v9.7.0 (§257): the Parrying imbued weapon ability — +1 insight to the
  // parry modifier (and touch AC + Reflex via the item-bonus lanes)
  // whenever the wielder holds the weapon, even flat-footed (GMG).
  const _pw = parryingHeldBonus(c);
  if (_pw) parts.push({label:'Parrying weapon (insight — held, even flat-footed)', value:_pw});
  if (_ceP) parts.push({label:'Combat Expertise (declared — the Defense bonus reaches the Parry, HH p.207)', value:_ceP});
  if (_bd) parts.push({label:'Best Defense (declared)', value:-_bd});
  if (_roP) parts.push({label:'Reckless Offense (declared)', value:-_roP});
  // v8.97.0 (Adam's flag request): the declaration-speed ladder, HH p.373 —
  // Defensive Martial Arts readies a parry as a SWIFT action, Improved DMA
  // as a FREE action, Advanced DMA declares as an IMMEDIATE free action.
  // Shield Parry rides separately: 1/round immediate shield parry vs ANY
  // attack that rolls to hit, ranged included (its own feat text).
  const _ownP = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  let ready = null;
  if (_ownP('Advanced Defensive Martial Arts')) ready = { speed: 'immediate free action', by: 'Advanced Defensive Martial Arts' };
  else if (_ownP('Improved Defensive Martial Arts')) ready = { speed: 'free action', by: 'Improved Defensive Martial Arts' };
  else if (_ownP('Defensive Martial Arts')) ready = { speed: 'swift action', by: 'Defensive Martial Arts' };
  const shieldParry = _ownP('Shield Parry');
  // Amended total: BA (minus PA and CE spends) + Str + Def + Shield, the CE
  // amendment restoring +2 per CE point (+1 Parry, +1 Def Bonus) → PA costs
  // its full spend, CE nets +N defensive, exactly the ruling's intent.
  // v9.12.1 (§270): no stance spends Base Attack — PA never reaches the
  // Parry, and CE contributes only its Defense bonus (+_ceP, the p.207 flow).
  return { total: bab + strM + def + shield + _ceP - _bd - _roP + _pw, parts, ready, shieldParry };
}

// Compute Dodge attempt modifier per handbook HH p.373.
// Formula: Reflex save + Defense bonus + dodge AC bonuses (from feats)
// Reflex save itself already includes Dex mod and class-progression bonus.
function computeDodgeBonus(c){
  const dexM = am(c.attrs[1]);
  const def = c.def || 0;
  // v8.97.0 (Adam's Rhad report): the Reflex component re-derived as
  // base + Dex ONLY — dropping every other Reflex bonus (Unnatural
  // Resilience's racial +1, Lightning Reflexes, item resistance, buffs,
  // negative levels…). HH p.372: "Dodge attempt = 1d20 + Reflex save
  // modifier + Defense bonus + dodge AC bonus(es)" — the SAVE CELL's own
  // total is the single truth.
  const refTotal = (computeStatBlock(c).ref)
    ? computeStatBlock(c).ref.total
    : (c.ref || 0) + dexM;
  // Dodge bonuses from feats: aggregate via the existing bonus pipeline.
  // For now, sum any 'dodge' bonus on the character. Conditional dodge bonuses
  // (Dodge feat's "designated target", Mobility's "moving through threatened squares")
  // are situational; players can choose whether to apply them per the situation,
  // so we list them out as separate items rather than rolling into the base.
  let unconditional = 0;
  const conditional = [];
  for (const f of (c.feats || [])) {
    const data = getFeatData(f.name);
    if (!data || !data.bonuses) continue;
    for (const b of data.bonuses) {
      if (b.type === 'dodge' && b.target === 'ac') {
        if (b.condition) conditional.push({source:f.name, value:b.value, condition:b.condition});
        else unconditional += b.value;
      }
    }
  }
  // v8.65.0: Best Defense spends Defense Bonus — the dodge roll's Def
  // component drops with it (PA's mirror).
  const _bd = (combatDecl(c).bd || 0);
  const parts = [
    {label:'Ref', value:refTotal},
    {label:'Def', value:def},
    {label:'Dodge', value:unconditional},
  ];
  if (_bd) parts.push({label:'Best Defense (declared)', value:-_bd});
  // v8.76.0 (Adam's Hellfire report): the declared CE/RO tags on the Dodge
  // card now carry real math — CE joins the dodge-bonus pool this function
  // already aggregates; RO's recklessness costs the roll its −4.
  const _ceD = (combatDecl(c).ce || 0);
  const _roD = (combatDecl(c).ro ? 4 : 0);
  if (_ceD) parts.push({label:'Combat Expertise (declared)', value:_ceD});
  if (_roD) parts.push({label:'Reckless Offense (declared)', value:-_roD});
  // v8.97.0 (Adam's flag request): the declaration-speed ladder, HH p.372 —
  // Dodge readies as a SWIFT action, Improved Dodge as a FREE action,
  // Advanced Dodge declares as an IMMEDIATE free action (even off-turn).
  const _own = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  let ready = null;
  if (_own('Advanced Dodge')) ready = { speed: 'immediate free action', by: 'Advanced Dodge' };
  else if (_own('Improved Dodge')) ready = { speed: 'free action', by: 'Improved Dodge' };
  else if (_own('Dodge')) ready = { speed: 'swift action', by: 'Dodge' };
  return {
    total: refTotal + def + unconditional - _bd + _ceD - _roD,
    parts,
    conditional,
    ready,
  };
}

