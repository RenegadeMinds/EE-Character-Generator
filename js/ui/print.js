// =============================================================================
// js/ui/print.js
// PRINT — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Print / PDF export of the character sheet.
//
// KEY NAMES (so you can search for them)
//   functions (1): printSheet
//
// WHERE IT CAME FROM
//   Gathered from js/app/67-pdf-export.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ========== PDF EXPORT ==========
function printSheet(){
  if(!curId){toast('Select a character first.');return;}
  const c=currentChar();if(!c)return;
  const cM=effAm(c,2),dM=effAm(c,1),wM=effAm(c,4);  // v8.6.0 firm-wire: effective mods
  const acDisp = computeACDisplay(c);
  const parry  = computeParryBonus(c);
  const dodge  = computeDodgeBonus(c);
  // v8.6.0 PDF parity audit: the print sheet previously computed saves as
  // base+attr and skills as ranks+attr — ignoring every feat/talent/mutation/
  // synergy bonus the screen applies. It now uses the same engines the Sheet
  // does, and gains the v8.5.x-era sections it lacked entirely (spells &
  // powers with prep lists, mutations & MP, equipped gear).
  const psStats = computeStatBlock(c);
  const psSkillMisc = computeSkillMiscBonuses(c);
  // v8.96.1 print-parity fix (found during the §240 wiring): the printed
  // Initiative re-derived from feats+talents only — missing the class-
  // feature lane (Uncanny Instincts) and the cybernetic Initiative Implant.
  // The statblock's own init lane is the single truth.
  const psInit = (psStats.init && psStats.init.total != null) ? psStats.init.total : dM;
  const psSaveRow = (key, label, attrLbl, attrMod) => {
    const total = psStats[key].total;
    const other = total - (c[key]||0) - attrMod;
    return `<div class="ps-save"><span class="ps-save-nm">${label}</span><span class="ps-save-val">${total>=0?'+':''}${total}</span><div class="ps-save-detail">Base ${c[key]||0} + ${attrLbl} ${attrMod>=0?'+':''}${attrMod}${other?` ${other>0?'+':'−'} ${Math.abs(other)} other`:''}</div></div>`;
  };
  const pct=Math.min(100,Math.round(c.xp/(c.xpNext||1000)*100));
  // v8.3.1: also compute within-band progress for the PDF readout below
  const xpProg=computeXpProgress(c);
  const classArr=migrateLegacyClasses(c);
  // For the Hero level table, find the first Hero entry (if any)
  const firstHero=classArr.find(e=>e.tier==='hero');
  const hc=firstHero?HERO_CLASSES[firstHero.name]:null;

  const skillRows = printSkillRows(c, psSkillMisc);
  const featList = printFeatList(c);
  const talentList = printTalentList(c);
  const spellsBlock = printSpellsBlock(c);
  const mutBlock = printMutationsBlock(c);
  let gearBlock = printGearBlock(c);
  // ===================== v8.19.0 PRINT-PARITY PASS =====================
  // The print sheet's last parity audit was v8.6.x; the v8.7–v8.18 systems
  // (speeds, SR/DR/resistances, per-diem abilities, class choices,
  // companions, armor integrity, power armor, Second Skin, vehicles/mecha/
  // starships) existed only on screen. Print now mirrors the Sheet's
  // active-loadout dashboard and the Tracker's integrity panels.
  // Speed & SR join the combat grid; provenance rides the footnote.
  const psSpd = computeSpeeds(c);
  const psSpdCell = `<div class="ps-stat"><span class="ps-stat-lbl">Speed</span><span class="ps-stat-val">${psSpd.walk}′</span></div>`;
  const psSR = computeSR(c);
  const psSRCell = psSR ? `<div class="ps-stat"><span class="ps-stat-lbl">Spell Resist</span><span class="ps-stat-val">${psSR.total}</span></div>` : '';
  const psSpdFoot = `<div class="fs-6_5pt mt-2" style="color:#888;">Speed: ${psSpd.parts.join(' · ')} · Run ${psSpd.run}${psSpd.modes.map(m=>` · ${m.type} ${m.speed}′ (${m.note})`).join('')}${psSR?` &nbsp;·&nbsp; SR: ${psSR.note}`:''}</div>`;
  const psDefLine = printDefensesLine(c);
  const perDiemBlock = printPerDiemBlock(c);
  const psChoiceRows = printClassChoiceRows(c);
  const companionsBlock = printCompanionsBlock(c);
  gearBlock = printAddArmorIntegrity(c, gearBlock);
  const machinesBlock = printMachinesBlock(c);
  // ================== end v8.19.0 print-parity pass ==================

  // v8.6.0 parity: baked attribute-delta footnote for the ability grid,
  // plus firm-wired equipped-item enhancements (shown as "worn").
  const psAttrNotes = (c.mutations||[]).filter(m=>m.attrApplied)
    .map(m=>`${m.attr} ${m.attrApplied>0?'+':''}${m.attrApplied} (${m.name.replace('[Attribute]', ATTR_FULL[m.attr]||m.attr)}${m.name.startsWith('Supernatural')?' — Su, suppressible':m.kind==='attribute'?' — Ex, never negated':''})`);
  const psItemAttrB = attrItemBonuses(c);
  ATTR_NAMES.forEach((a,i)=>{ if (psItemAttrB.best[i] > 0) psAttrNotes.push(`${a} +${psItemAttrB.best[i]} worn (${psItemAttrB.from[i]} — item CON does not shift stored max HP)`); });

  // Hero level table (5 levels on print) — uses the first Hero entry, if any
  let lvlTable='';
  if(hc && firstHero){
    lvlTable=`<table class="mt-4 ps-skill-tbl"><thead><tr><th>Lvl</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Def</th></tr></thead><tbody>
    ${[1,2,3,4,5].map(l=>{const i=l-1;return`<tr style="${l===firstHero.level?'font-weight:bold;background:#f0ebe0;':''}""><td>${l}</td><td>+${hc.bab[i]}</td><td>+${hc.fort[i]}</td><td>+${hc.ref[i]}</td><td>+${hc.will[i]}</td><td>+${hc.def[i]}</td></tr>`}).join('')}
    </tbody></table>`;
  }
  // Class summary line for the header
  const classSummary=classArr.map(e=>`${e.name} ${e.level}`).join(' + ')||'—';
  const classDetailRows = printClassDetailRows(c, classArr);
  const psOutstanding = printOutstandingStrip(c);
  document.getElementById('print-sheet').innerHTML=`
${printHeaderHtml(c, psOutstanding, classSummary)}
  <div class="ps-body">
    <!-- LEFT COLUMN -->
    <div class="ps-col">
${printAbilityScoresHtml(c, psAttrNotes, psItemAttrB)}
${printCombatStatsHtml(c, { acDisp, parry, dodge, psInit, psSpdCell, psSRCell, psSpdFoot, psDefLine })}
${printSavesHtml(psSaveRow, cM, dM, wM)}
      ${perDiemBlock}

${printXPHtml(c, xpProg, hc, firstHero, lvlTable)}
${printFeatsAndTalentsHtml(c, featList, talentList)}      ${mutBlock}
    </div>

    <!-- RIGHT COLUMN -->
    <div class="ps-col">
${printSkillsHtml(skillRows)}
${printScenarioRaceOccupationHtml(c)}
${printClassFeaturesHtml(classDetailRows, psChoiceRows)}
      ${spellsBlock}
      ${gearBlock}
      ${machinesBlock}
      ${companionsBlock}
${printNotesTrackerLanguagesHtml(c)}    </div>
  </div>`;

  window.print();
}

// Print sheet: skill rows (ranked skills plus the key combat skills).
function printSkillRows(c, psSkillMisc) {
  // Build skill rows for print — only skills with ranks > 0, plus key combat skills
  const keyCombatSkills=['Bluff','Climb','Concentration','Diplomacy','Hide','Intimidate','Jump','Listen','Move Silently','Search','Sense Motive','Spot','Survival','Swim','Tumble'];
  const printSkills=SKILLS.filter(sk=>{
    const r=(c.skills||{})[sk.n]||0;
    return r>0||keyCombatSkills.includes(sk.n.split(' (')[0]);
  }).slice(0,50);
  const skillRows=printSkills.map(sk=>{
    const ai=ATTR_NAMES.indexOf(sk.k);const amod=effAm(c,ai);const ranks=(c.skills||{})[sk.n]||0;
    const cls=isClassSkill(sk.n, c);
    // v8.6.0 parity: fold in the same Misc bonuses the screen shows
    // (synergies, feats, talents, occupation, Scale-0 picks, mutations) plus
    // active synergies.
    const syn = computeSkillSynergies(sk.n, c).auto.reduce((s, e) => s + e.value, 0);
    const misc = (psSkillMisc[sk.n]?.total || 0) + syn;
    const total=ranks+amod+misc;
    return`<tr class="${cls?'cs':''}"><td>${(displaySkillName(c, sk.n)).replace('Knowledge ','Kn. ').replace('Craft ','Cr. ').replace('Perform ','Perf. ')}</td><td class="attr">${sk.k}</td><td class="attr">${amod>=0?'+':''}${amod}</td><td class="cls">${ranks}</td><td class="attr">${misc?((misc>0?'+':'')+misc):'—'}</td><td class="tot">${total>=0?'+':''}${total}</td></tr>`;
  }).join('');
  return skillRows;
}

// Print sheet: the feat list.
function printFeatList(c) {
  // v8.4.1: build the feat list with correct field-name resolution. Previously
  // this read `f.n`, `f.t`, `f.pre`, `f.d` — none of which exist on the
  // canonical character feat entry (which has just `{name, param?, slotSource?, l1Slot?}`).
  // We now look up the full feat data from FEATS_DB and pull display fields
  // from there. The character entry only stores name + acquisition metadata;
  // the rendering needs the full definition.
  const featList=(c.feats||[]).map(f=>{
    const data = getFeatData(f.name);
    const displayName = f.param ? `${f.name} (${f.param})` : f.name;
    const family = data?.family || 'General';
    const prereqSummary = (data?.prereqs && data.prereqs.length)
      ? summarizePrereqs(data.prereqs)
      : '';
    const desc = data?.d || '';
    return `<li><span class="ft">${displayName}</span> <span class="ftype">[${family}${prereqSummary?'; '+prereqSummary:''}]</span>${desc?'<br><span class="fs-7_5pt" style="color:#555;">'+desc+'</span>':''}</li>`;
  }).join('');
  return featList;
}

// Print sheet: the talent list.
function printTalentList(c) {
  // v8.4.1: build the talent list for print. Previously the print sheet
  // didn't render Talents at all, so any character with Talents had them
  // invisible in their PDF. We now generate a parallel list to the feats
  // section, with name, tree/tier metadata, prereq text, and description.
  const talentList=(c.talents||[]).map(t=>{
    const data = TALENTS_DB.find(x => x.n === t.name);
    if (!data) return `<li><span class="ft">${t.name}</span> <span class="ftype">[Talent]</span></li>`;
    const tree = data.tree || '';
    const tier = data.tier || 'Talent';
    const treeLabel = tree ? `${tree.replace(/\s*Tree\s*$/, '')}` : '';
    const prereqSummary = data.prereqs_text || '';
    const desc = data.d || '';
    return `<li><span class="ft">${t.name}${t.param?' ('+t.param+')':''}</span> <span class="ftype">[${tier}${treeLabel?'; '+treeLabel:''}${prereqSummary?'; '+prereqSummary:''}]</span>${desc?'<br><span class="fs-7_5pt" style="color:#555;">'+desc+'</span>':''}</li>`;
  }).join('');
  return talentList;
}

// Print sheet: the Spells & Powers block ("" when the character has none).
function printSpellsBlock(c) {
  // v8.6.0 parity: Spells & Powers block — pool chips (EAL/EDL/EPL/ESL),
  // sub-options, known lists (source-sensitive names), prepared lists, super.
  let spellsBlock = '';
  const cs = computeCasterStats(c);
  const mpSt = getMPState(c);
  const parts = [];
  for (const poolName of ['arcane','divine','psionic']) {
    const pool = cs[poolName]; if (!pool || !pool.contributors.length) continue;
    const eff = POOL_EFF_LEVEL[poolName];
    const pp = getPoolPPState(c, poolName);
    const sub = [];
    if (poolName==='arcane' && c.wizardSchool) sub.push(`${c.wizardSchool} specialist (prohibited: ${(c.wizardProhibited||[]).join(', ')||'—'})`);
    if (poolName==='divine') {
      if (c.druidOption) sub.push('Druid Option (Druid list)');
      else if ((c.clericDomains||[]).length) sub.push('Domains: '+c.clericDomains.join(', '));
      if ((c.saintDomains||[]).length) sub.push('Saint domains: '+c.saintDomains.join(', '));
      if ((c.paladinDomains||[]).length) sub.push('Paladin domains: '+c.paladinDomains.join(', '));
    }
    if (poolName==='psionic' && c.psionDiscipline) sub.push('Discipline: '+c.psionDiscipline);
    const known = getCharPowers(c).filter(p=>p.pool===poolName).map(p=>{
      const s = SPELLS_DB.find(x=>x.name===p.name);
      const nm = (s && p.token) ? displayNameForRoute(s,{token:p.token,lvl:p.lvl,pool:p.pool,applies:p.applies}) : p.name;
      return nm + (p.personal?' ✦':'');
    });
    let prepLines = '';
    const slots = c.preparedSlots && c.preparedSlots[poolName];
    if (slots) for (const key in slots) {
      if (!slots[key].length) continue;
      prepLines += `<div class="fs-7_5pt" style="color:#555;"><b>Prepared (${key.replace(':',' ')}):</b> ${slots[key].map(r=>`${r.qty}× ${r.dispName||r.name} (lvl ${r.lvl}${r.free?', free':', '+r.cost+' PP'})`).join('; ')}</div>`;
    }
    parts.push(`<div class="mb-5">
        <div class="fs-8_5pt"><b>${eff.abbr} ${pool.cl}</b> · ${poolName} · max ${poolName === 'psionic' ? 'power' : 'spell'} lvl ${pool.maxPowerLvl} · PP ${pp.max}/day${pool.saveDcBase!=null?` · base DC ${pool.saveDcBase}+lvl`:''}${sub.length?' · '+sub.join(' · '):''}</div>
        ${known.length?`<div class="fs-7_5pt" style="color:#555;"><b>Known:</b> ${known.join(', ')}</div>`:''}
        ${prepLines}
      </div>`);
  }
  if (mpSt.isSuperMutant) {
    const spp = getSuperPPState(c);
    const owned = getCharPowers(c).filter(p=>p.pool==='super').map(p=>p.name+(p.buff?' (Buff)':''));
    parts.push(`<div class="mb-5">
        <div class="fs-8_5pt"><b>ESL ${mpSt.eml}</b> · super (${mpSt.tier?mpSt.tier.tier:'?'}) · ${mpSt.balance} MP banked · super-PP ${spp.max}/day</div>
        ${owned.length?`<div class="fs-7_5pt" style="color:#555;"><b>Super-powers:</b> ${owned.join(', ')}</div>`:''}
      </div>`);
  }
  if (parts.length) spellsBlock = `<div class="ps-sec"><div class="ps-sec-head">Spells &amp; Powers</div><div class="ps-sec-body">${parts.join('')}<div class="fs-6_5pt" style="color:#888;">PP by spell level: 0/1/3/5/7/9/11/13/15/17 (HH p.404). Prepared casters pay PP at dawn; casting a prepared spell is free. ✦ = Saint Personal Domain pick.</div></div></div>`;
  return spellsBlock;
}

// Print sheet: the Mutations & MP block ("" when none).
function printMutationsBlock(c) {
  // v8.6.0 parity: Mutations & MP block (ledger + per-mutation effect lines,
  // (Ex)/(Su)-typed attribute deltas).
  let mutBlock = '';
  if (!((c.mutations||[]).length || (c.mpGrants||[]).length)) return mutBlock;
  const st = getMPState(c);
  const rows = (c.mutations||[]).map(m=>{
    const fx = MUTATION_EFFECTS[m.name] || {};
    const bits = [];
    if (m.attrApplied) bits.push(`${m.attrApplied>0?'+':''}${m.attrApplied} ${m.attr}${m.name.startsWith('Supernatural')?' (Su)':m.kind==='attribute'?' (Ex)':''}`);
    for (const sk in (fx.skills||{})) bits.push(`${fx.skills[sk]>0?'+':''}${fx.skills[sk]} ${sk}`);
    for (const sv in (fx.saves||{})) bits.push(`${fx.saves[sv]>0?'+':''}${fx.saves[sv]} ${({fort:'Fort',ref:'Ref',will:'Will'})[sv]}`);
    if (fx.naturalAC) bits.push(`+${fx.naturalAC} natural AC`);
    for (const g of ['senses','natural','active','notes']) for (const t of (fx[g]||[])) bits.push(t);
    return `<li><span class="ft">${m.name}${m.attr?' ('+m.attr+')':''}</span> <span class="ftype">[${m.kind}]</span>${bits.length?'<br><span class="fs-7_5pt" style="color:#555;">'+bits.join(' · ')+'</span>':''}</li>`;
  }).join('');
  mutBlock = `<div class="ps-sec"><div class="ps-sec-head">Mutations &amp; MP</div><div class="ps-sec-body">
      <div class="fs-8pt mb-3" style="color:#555;">MP: earned ${st.totalEarned} · spent ${st.totalSpent} · banked ${st.balance} · Mutant Level +${st.mutantLevel}${st.mutantLevel?` (ECL +${st.mutantLevel})`:''}</div>
      ${rows?`<ul class="ps-feat-list">${rows}</ul>`:''}
    </div></div>`;
  return mutBlock;
}

// Print sheet: the Equipped Gear block: weapons, worn items, carrying
// capacity, wealth and cybernetics.
function printGearBlock(c) {
  // v8.6.0 parity: Equipped Gear block (the Gear tab's attack math, reused).
  let gearBlock = '';
  const weapons = computeEquippedWeaponSummaries(c);
  const worn = getCharItems(c).filter(it=>it.equipped && it.catalogue!=='weapon').map(it=>it.ref + (it.slot?` (${it.slot})`:''));
  if (weapons.length || worn.length) {
    // v8.6.1 TWF pass: hand tags, off-hand attack sequence, and alt-fire
    // modes (Double Tap / Burst Fire) reach the print sheet too.
    const wAtk = (w) => (w.twfExtraAtks && w.twfExtraAtks.length > 1)
      ? w.twfExtraAtks.map(a=>`${a>=0?'+':''}${a}`).join('/')
      : (w.fullAttack && w.fullAttack.length > 1)
        ? `${w.fullAttack[0]>=0?'+':''}${w.fullAttack[0]} (${w.fullAttack.slice(1).map(a=>`${a>=0?'+':''}${a}`).join('/')})`
        : `${w.attackBonus>=0?'+':''}${w.attackBonus}`;
    const wAlt = (w) => (w.altModes||[]).map(m=>m.display?`${m.name}: ${m.display}`:`${m.name} ${m.atk>=0?'+':''}${m.atk}/×${m.dmgMult}`).join(', ');
    const wRows = weapons.map(w=>`<tr><td>${w.name}${w.integratedIn?` <span class="fs-6pt" style="color:#888;">(integrated in ${w.integratedIn}${w.detachable?', detachable':''})</span>`:''}${w.hand?` <span class="fs-6pt" style="color:#888;">(${w.hand==='main'?'main':'off'} hand)</span>`:''}${w.ignoreHardness?` <span class="fs-6pt" style="color:#888;">(ignores ${w.ignoreHardness} hardness${w.ihBane?', +10 bane':''}; GMG p.253)</span>`:''}${w.proficient?'':' ⚠'}${w.statStrip?`<div class="fs-6pt" style="color:#888;">${w.statStrip}</div>`:''}${wAlt(w)?`<div class="fs-6pt" style="color:#888;">${wAlt(w)}</div>`:''}</td><td class="attr">${wAtk(w)}</td><td>${w.damage||'—'}</td><td class="fs-6_5pt attr">${w.typeLabel||(w.damageTypes||[]).join('/')||'—'}</td></tr>`).join('');
    gearBlock = `<div class="ps-sec"><div class="ps-sec-head">Equipped Gear</div><div class="ps-sec-body">
        ${weapons.length?`<table class="ps-skill-tbl"><thead><tr><th>Weapon</th><th>Atk</th><th>Damage</th><th>Type</th></tr></thead><tbody>${wRows}</tbody></table><div class="fs-6_5pt" style="color:#888;">⚠ = not proficient (−4 already included). Alternate fire modes and conditional gadget bonuses: see the Gear tab.</div>`:''}
        ${worn.length?`<div class="fs-8pt mt-3"><b>Worn / held:</b> ${worn.join(', ')}</div>`:''}
      </div></div>`;
  }
  // v8.8.2 (Adam's Carry/Jump wiring): print parity for the table-relevant
  // lifting numbers — the HH's own character sheet has a Carrying Capacity
  // field, and Adam uses these for lift/move rulings (not encumbrance).
  let carryBlock = '';
  {
    const pcc = computeCarryCapacity(c);
    const pgr = computeGrapple(c);
    const pSz = SIZE_LADDER[effectiveSizeIndex(c)];
    // v8.88.0: tons past the 5-ton line (fmtCarry) + the 💥 demolition line.
    const pHi = computeHardnessIgnore(c);
    carryBlock = `<div class="fs-7_5pt mt-3"><b>Carry:</b> light ≤${fmtCarry(pcc.light)} · med ≤${fmtCarry(pcc.medium)} · heavy ≤${fmtCarry(pcc.heavy)} · lift over head ${fmtCarry(pcc.liftOverHead)} · off ground ${fmtCarry(pcc.liftOffGround)} · push/drag ${fmtCarry(pcc.pushDrag)} · <b>Grapple</b> ${pgr.total>=0?'+':''}${pgr.total}${pcc.superTalents.length?` · 🦾 ×${Math.pow(4,pcc.superTalents.length)} carry, ${pSz} for natural dice/grapple/Jump (Su)`:''}${pcc.supremeEffortOwned?' · Supreme Effort: ×4 carry &amp; +1 size while performing':''}${pHi && pHi.mode === 'mangler' ? ` · 💥 ignore ${pHi.ignore} hardness, break DC −${pHi.breakDC}${pHi.instances > 1 ? ' (Mangler ×2: Titanic echo)' : ''}` : ''}</div>`;
    gearBlock = gearBlock
      ? gearBlock.replace('</div></div>', carryBlock + '</div></div>')
      : `<div class="ps-sec"><div class="ps-sec-head">Equipped Gear</div><div class="ps-sec-body">${carryBlock}</div></div>`;
  }
  // v8.96.1 (print parity for §240 + the v8.91.0 implants): Wealth standing
  // and the cybernetics ledger on paper.
  {
    const extraLines = [];
    if (c.wealthScore != null && c.funds != null) {
      extraLines.push(`<div class="fs-7_5pt mt-3"><b>Wealth:</b> Score ${c.wealthScore} · ${escapeHTML(fundsLabel(c.funds, scenarioTechScale(c)))}${c.funds < 0 ? ' (in debt)' : ''} <span style="color:#888;">(score tracks funds — HH p.45)</span></div>`);
    }
    if (getCyber(c).length) {
      const cyb = getCyber(c).map(r => r.n + (r.param ? ` (${r.param})` : '')).join(', ');
      const exc = cyberExcess(c);
      extraLines.push(`<div class="fs-7_5pt mt-2"><b>🦾 Cybernetics:</b> ${escapeHTML(cyb)} — ${cyberCount(c)} of ${cyberMax(c)} attachments${exc ? ` · ⚠ ${exc} negative level${exc > 1 ? 's' : ''}` : ''}${getCyber(c).some(r => r.n === 'Anti-Shock Implant') ? '' : ' · ⚡ +50% electricity damage'}</div>`);
    }
    if (extraLines.length) {
      gearBlock = gearBlock
        ? gearBlock.replace('</div></div>', extraLines.join('') + '</div></div>')
        : `<div class="ps-sec"><div class="ps-sec-head">Equipped Gear</div><div class="ps-sec-body">${extraLines.join('')}</div></div>`;
    }
  }
  return gearBlock;
}

// Print sheet: the immunities / resistances / DR line.
function printDefensesLine(c) {
  // Defenses line — immunities / resistances / DR instances (best-in-situation
  // per attack; class-level x/− pools already folded by computeDR).
  let psDefLine = '';
  const ri = computeResistances(c);
  const cap = t => t.charAt(0).toUpperCase()+t.slice(1);
  const bits = [];
  const imm = Object.keys(ri.immune).sort();
  if (imm.length) bits.push(`<b>Immune:</b> ${imm.map(cap).join(', ')}`);
  const rs = Object.keys(ri.resists).sort();
  if (rs.length) bits.push(`<b>Resist:</b> ${rs.map(t=>`${cap(t)} ${ri.resists[t].value}`).join(', ')}`);
  const dr = computeDR(c);
  if (dr.length) bits.push(`<b>DR:</b> ${dr.map(d=>`${d.value}/${d.bypass}${d.conditional?'*':''} (${d.source})`).join(', ')}`);
  if (ri.universal) bits.push('◈ universal energy resistance');
  if (bits.length) psDefLine = `<div class="fs-7_5pt mt-3">${bits.join(' &nbsp;·&nbsp; ')}${dr.some(d=>d.conditional)?'<div class="fs-6_5pt" style="color:#888;">* conditional — see the Sheet for the condition. Best applicable instance applies per attack; instances never stack across sources.</div>':''}</div>`;
  return psDefLine;
}

// Print sheet: per-diem abilities with pencil-and-paper use boxes.
function printPerDiemBlock(c) {
  const psChk = (n) => Array.from({length:Math.max(0,Math.min(20,n))},()=>'<span style="display:inline-block;width:8px;height:8px;border:1px solid #888;border-radius:1px;margin-right:2px;vertical-align:middle;"></span>').join('');
  // Per-diem abilities with pencil-and-paper use boxes (weekly ones flagged).
  let perDiemBlock = '';
  const pdSpecs = computePerDiemAbilities(c);
  if (pdSpecs.length) {
    const rows = pdSpecs.map(s => `<div class="fs-8pt m-2-0"><b>${s.name}</b>${s.weekly?' <span class="fs-6_5pt" style="color:#888;">(per WEEK)</span>':''} — ${s.kind==='pool'?`pool of ${s.max} pts · spent: ________`:`${s.max}/day ${psChk(s.max)}`}${s.note?`<div class="fs-6_5pt" style="color:#888;">${s.note}</div>`:''}</div>`).join('');
    perDiemBlock = `<div class="ps-sec"><div class="ps-sec-head">Per-Diem Abilities</div><div class="ps-sec-body">${rows}</div></div>`;
  }
  return perDiemBlock;
}

// Print sheet: pending class choices and Favored Enemies.
function printClassChoiceRows(c) {
  // v8.78.0: the chosen picks now ride INLINE on the level-by-level record
  // (psClassBlock) — this strip keeps only the pending-count advisory and
  // the Favored Enemies consolidation.
  let psChoiceRows = '';
  const ccSpecs = computeClassChoiceSpecs(c);
  const ccPending = ccSpecs.filter(s => !s.chosen).length;
  const fe = computeFavoredEnemies(c);
  if (ccPending || fe.length) {
    psChoiceRows = `<div class="mt-6" style="padding-top:4px;border-top:1px solid #c8a02d;">
      ${ccPending?`<div class="fs-7_5pt" style="color:#7a5c00;"><b>⚑ ${ccPending} class choice${ccPending===1?'':'s'} pending</b> — pick in 🎓 Class Choices on the Sheet.</div>`:''}
      ${fe.length?`<div class="fs-7_5pt" style="color:#555;"><b>Favored Enemies:</b> ${fe.map(f=>`${f.type} +${f.bonus}`).join(', ')} (damage &amp; Bluff/Listen/Sense Motive/Spot/Survival vs the type)</div>`:''}</div>`;
  }
  return psChoiceRows;
}

// Print sheet: the Companions block ("" when none).
function printCompanionsBlock(c) {
  // Companions — base stats + the master-level-derived adjustments.
  let companionsBlock = '';
  if (!(c.companions||[]).length) return companionsBlock;
  const compCards = c.companions.map(comp => {
    const base = COMPANION_BASE_STATS[comp.species] || null;
    const d = companionDerived(comp, c);
    const kindLbl = comp.kind==='familiar'?'🦉 Familiar':comp.kind==='mount'?'🐎 Special Mount':'🐾 Animal Companion';
    const baseLine = base ? (base.ref ? `Base stats: ${base.ref}` : `${base.size} · HD ${base.hd} · AC ${base.ac} · Spd ${base.spd||'—'} · Atk ${base.fatk||base.atk} · Saves ${base.saves||'—'} · ${base.attrs||''}${base.sq?` · SQ: ${base.sq}`:''} (FF p.${base.page})`) : 'Base stats: see the Foe Folio.';
    return `<div class="m-3-0"><b class="fs-8_5pt">${kindLbl}: ${comp.name||comp.species}</b>${comp.name?` <span class="fs-7pt" style="color:#888;">(${comp.species})</span>`:''}
      <div class="fs-7pt" style="color:#555;">${baseLine}</div>
      <div class="fs-7_5pt">${d.line}</div>
      ${d.specials?`<div class="fs-7pt" style="color:#555;">Special: ${d.specials}</div>`:''}${d.perk?`<div class="fs-7pt" style="color:#555;">${d.perk}</div>`:''}${d.magicalBeast?`<div class="fs-7pt" style="color:#888;">${d.magicalBeast}</div>`:''}</div>`;
  }).join('');
  companionsBlock = `<div class="ps-sec"><div class="ps-sec-head">Companions</div><div class="ps-sec-body">${compCards}</div></div>`;
  return companionsBlock;
}

// Print sheet: appends worn armor & shield integrity to the gear block.
function printAddArmorIntegrity(c, gearBlock) {
  // Worn armor & shield integrity (T/ACtical, HH p.382) appended to the gear
  // section — hardness, HP, state banners, and a damage-tally blank.
  const tArm = trackedArmorItems(c);
  if (tArm.length) {
    const aRows = tArm.map(it => {
      const g = armorItemIntegrity(it);
      const nm = enchantDisplayName(it);
      const prof = isProficientWithArmor(c, it.ref);
      const state = g.destroyed?' · ☠ DESTROYED (salvage only)':g.broken?' · ⚑ BROKEN (no AC bonus; enchantment suppressed)':'';
      return `<div class="fs-7_5pt m-2-0">${g.isShield?'🛡':'⛨'} <b>${nm}</b> — Hardness ${g.hardness} · HP ${g.hp}/${g.maxHP}${g.alwaysIntercede?' · ◈ always intercedes':''}${prof?'':' · ⚠ non-proficient (ATTACKER chooses the split)'}${g.selfRepairing?' · Self-Repairing (1 HP/min; full overnight)':''}${state} · damage tally: ____________</div>`;
    }).join('');
    const integ = `<div class="mt-4" style="padding-top:3px;border-top:1px solid #ddd;"><div class="fs-7pt" style="font-weight:700;color:#6b5320;">Armor Integrity (T/ACtical — HH p.382)</div>${aRows}<div class="fs-6_5pt" style="color:#888;">Hits landing in [Touch AC, Total AC) strike the armor: hardness soaks first, the remainder splits (wearer's choice when proficient). Armor does not heal — Repair skill or services (HH p.181).</div></div>`;
    gearBlock = gearBlock ? gearBlock.replace('</div></div>', integ + '</div></div>') : `<div class="ps-sec"><div class="ps-sec-head">Equipped Gear</div><div class="ps-sec-body">${integ}</div></div>`;
  }
  return gearBlock;
}

// Print sheet: Machines & Loadouts: the piloted machine, power armor,
// Second Skin and the idle fleet.
function printMachinesBlock(c) {
  // Machines & Loadouts — the piloted machine, worn power armor, active
  // Second Skin, then the idle fleet (starships with per-section HP).
  let machinesBlock = '';
  const mParts = [];
  const loadoutLines = (it) => {
    const ll = paLoadout(it);
    return ll.length?`<div class="fs-7pt" style="color:#555;">${ll.map(l=>`${l.slot}: ${l.gear}${l.mount&&l.mount!=='turret'?` [${l.mount} ${(l.arcs||[]).map(a=>a[0]).join('/')}]`:''}${(shipLinkOf(l)>=2)?` <b>[${shipLinkOf(l)>=8?`main cannon ×${shipLinkOf(l)}`:`×${shipLinkOf(l)} link${l.variable?', variable':''}`}]</b>`:''}${(shipBatteryOf(l)>=2)?` <b>[battery ×${shipBatteryOf(l)}]</b>`:''}${l.state&&l.state!=='ok'?` <b>[${l.state.toUpperCase()}]</b>`:''}`).join(' · ')}</div>`:'';
  };
  const pv = pilotedVehicle(c);
  const pvG = (pv)?vehicleIntegrity(pv):null;
  if (pv && pvG && pv.catalogue==='mecha') {
    const mg = pvG, md = mg.def, mT = mechaTouchAC(md);
    const mName = pv.custom?pv.custom.name:(pv.customName||pv.ref);
    mParts.push(`<div class="m-3-0"><b class="fs-8_5pt">🦿 Piloting: ${mName}</b> <span class="fs-7pt" style="color:#888;">${md.size} TS ${md.ts} mecha${md.superstructure?` · ${md.superstructure}${md.armorType?' / '+md.armorType:''}`:''}</span>
      <div class="fs-7_5pt">T/AC ${mT}/${mT+(md.equipAC||0)+(paShieldBonus(pv))} · Hardness ${mg.hardness} · Hull ${mg.hp}/${mg.maxHP} · Str ${md.str} (drives melee; your BAB attacks) · your Dex caps at ${md.dexMax} · speed ${md.speed}′${md.fly?' · fly':''}</div>${loadoutLines(pv)}</div>`);
  } else if (pv && pvG) {
    const vg = pvG, vd = vg.def, vchk = vehicleOperatorCheck(c, vd);
    mParts.push(`<div class="m-3-0"><b class="fs-8_5pt">🕹 Piloting: ${enchantDisplayName(pv)}</b> <span class="fs-7pt" style="color:#888;">${vd.maneuver_class} maneuver</span>
      <div class="fs-7_5pt">T/AC ${vd.touch_ac}/${vd.total_ac} · Hardness ${vg.hardness} · HP ${vg.hp}/${vg.maxHP} · ${vd.skill} ${vchk.withManeuver>=0?'+':''}${vchk.withManeuver}${vchk.initPenalty?` · ${vchk.initPenalty} Initiative`:''} · speed ${vd.top_speed} (${vd.chase_speed})</div></div>`);
  }
  const paW = equippedPowerArmor(c);
  if (paW) {
    const paG = armorItemIntegrity(paW), paD = POWER_ARMOR_DB[paW.ref];
    mParts.push(`<div class="m-3-0"><b class="fs-8_5pt">🤖 Power Armor: ${enchantDisplayName(paW)}</b> <span class="fs-7pt" style="color:#888;">${paD.size} TS ${paD.ts} — a mecha your size (FF Ch.III)</span>
      <div class="fs-7_5pt">Hardness ${paG.hardness} · Frame HP ${paG.hp}/${paG.maxHP}${paD.strMin?` · Str floors at ${paD.strMin}`:''}${paD.equipStrMod?` · +${paD.equipStrMod} equipment Str`:''}${paD.dexMax?` · Dex caps at ${paD.dexMax}`:''}${paD.fly?` · fly ${paD.fly}`:''} · ◈ always intercedes (full AC confirms crits only)</div>${loadoutLines(paW)}</div>`);
  }
  const skW = activeSecondSkin(c);
  if (skW && !skW.destroyed) {
    mParts.push(`<div class="m-3-0"><b class="fs-8_5pt">🧿 Second Skin</b> <span class="fs-7pt" style="color:#888;">lvl ${skW.row.lvl} ectoplasmic sheath — HH p.241</span>
      <div class="fs-7_5pt">AC +${skW.row.ac} (as armor) · Hardness ${skW.row.hardness} · HP ${skW.hp}/${skW.maxHP} · slam ${skW.row.slam}${skW.row.dr?` · DR ${skW.row.dr}`:''}${(skW.state.abilities||[]).length?` · ${skW.state.abilities.join(', ')}`:''}</div>
      <div class="fs-7pt" style="color:#555;">Every hit strikes the skin first; excess carries over to you (HH p.242). Psionic focus locked; no worn armor.</div></div>`);
  }
  for (const it of getCharItems(c)) {
    if (it.catalogue==='starship') {
      const sd = shipDefOf(it);
      const secs = sd?shipSections(it):null;
      if (sd && secs) mParts.push(`<div class="m-3-0"><b class="fs-8_5pt">🚀 ${it.customName||it.ref}</b> <span class="fs-7pt" style="color:#888;">${sd.cls} ${it.ship.subtype} · ${it.ship.engine} · ${it.ship.armor} armor · crew ${sd.crew}</span>
        <div class="fs-7_5pt">${secs.map(s=>`${s.section} ${s.hp}/${s.maxHP}${s.disabled?' <b>[DISABLED]</b>':''}`).join(' · ')}</div>${loadoutLines(it)}</div>`);
    } else if ((it.catalogue==='vehicle'||it.catalogue==='mecha') && !it.piloted) {
      const g = vehicleIntegrity(it); if (!g) continue;
      const nm = it.custom?it.custom.name:(it.customName||(enchantDisplayName(it)));
      mParts.push(`<div class="fs-7_5pt m-2-0">${it.catalogue==='mecha'?'🦿':'🚗'} <b>${nm}</b> — Hardness ${g.hardness} · HP ${g.hp}/${g.maxHP}${g.destroyed?' · ☠ DESTROYED':g.broken?' · 🛑 DISABLED':''}${it.jointOwners?` · owners: ${it.jointOwners}`:''}</div>`);
    }
  }
  if (mParts.length) machinesBlock = `<div class="ps-sec"><div class="ps-sec-head">Machines &amp; Loadouts</div><div class="ps-sec-body">${mParts.join('')}<div class="fs-6_5pt" style="color:#888;">Operation math lives on the 🕹 Vehicles tab; loadout slots cycle ok → damaged → destroyed per the mecha crit table.</div></div></div>`;
  return machinesBlock;
}

// Print sheet: per-class detail rows with the level-by-level record.
function printClassDetailRows(c, classArr) {
  // v8.78.0 (Adam's print-parity ask): per-class detail rows for the Class
  // Features & Abilities block — the screen's v8.77.0 restructure on paper
  // (everything expanded by nature, compact by necessity): base line, the
  // class's tree talents, slotSource bonus feats, and the LEVEL-by-LEVEL
  // record with 🎓 picks resolved in place. Feature descriptions stay on
  // the screen — paper lists the record, the book carries the prose.
  const tierLabels={hero:'',basic:' (Basic)',advanced:' (Advanced)',prestige:' (Prestige)'};
  const psActiveFeats = getActiveClassFeatures(c);
  const psByClass = {};
  for (const f of psActiveFeats) { (psByClass[f.className] = psByClass[f.className] || []).push(f); }
  const psSpecs = computeClassChoiceSpecs(c);
  const psConsumed = new Set();
  const psRendered = new Set();
  const psClassBlock = (name, e, cls) => {
    const apHint = e ? (e.tier==='hero'?` · AP pool: ${c.apMax||0}/level`:'') : '';
    const presMax = e && e.tier==='prestige'?`, max ${cls.maxLvl||10}`:'';
    const _hiero = e && e.name === 'Ecclesiarch' && (c.druidOption || migrateLegacyClasses(c).some(x => x._heritageChoice === 'Cleric (Druid Option)'));
    let out = e
      ? `<div class="ps-class-row"><span class="ps-class-nm">${_hiero ? 'Ecclesiarch (Hierophant)' : e.name}</span><span class="ps-class-det">Lvl ${e.level} · d${cls.hd}${tierLabels[e.tier]}${presMax}</span></div><div class="fs-8pt" style="color:#555;">Key Attr: ${cls.attr} · ${cls.sp}+Int SP/lvl${apHint}</div>`
      : `<div class="ps-class-row"><span class="ps-class-nm">${escapeHTML(name)}</span><span class="ps-class-det">granted abilities</span></div>`;
    if (e && e.tier === 'hero') {
      const tl2 = (c.talents||[]).filter(t => { const td = TALENTS_DB.find(x => x.n === (t.name||t.n)); return td && td.hero_class === e.name; }).map(t => (t.name||t.n) + (t.param?` (${t.param})`:''));
      if (tl2.length) out += `<div class="fs-7_5pt" style="color:#555;">🎭 Talents (this class's trees): <b>${tl2.map(escapeHTML).join(', ')}</b></div>`;
    }
    const bf = (c.feats||[]).filter(f => typeof f.slotSource === 'string' && f.slotSource.startsWith(`classFeature:${name}:`)).map(f => f.name + (f.param?` (${f.param})`:''));
    if (bf.length) out += `<div class="fs-7_5pt" style="color:#555;">★ Bonus feats (this class's slots): <b>${bf.map(escapeHTML).join(', ')}</b></div>`;
    const byLvl = {};
    for (const f of (psByClass[name]||[])) { (byLvl[f.feature.lvl] = byLvl[f.feature.lvl] || []).push(f); }
    for (const lvl of Object.keys(byLvl).map(Number).sort((a,b)=>a-b)) {
      const bits = byLvl[lvl].map(f => {
        const myPicks = psSpecs.filter(s => !psConsumed.has(s.key) && s.className === name && s.atLvl === lvl && (s.feature === f.name || s.feature.startsWith(f.name) || f.name.startsWith(s.feature)));
        for (const s of myPicks) psConsumed.add(s.key);
        const pk = myPicks.map(s => s.chosen ? `<b>${escapeHTML(s.chosen)}</b>` : '<i>unchosen</i>').join(', ');
        return escapeHTML(f.name) + (pk ? ` — ${pk}` : '');
      });
      out += `<div class="fs-7_5pt" style="color:#555;"><span style="color:#8a6d1f;">L${lvl}:</span> ${bits.join(' · ')}</div>`;
    }
    const strays = psSpecs.filter(s => !psConsumed.has(s.key) && s.className === name);
    for (const s of strays) { psConsumed.add(s.key); out += `<div class="fs-7_5pt" style="color:#555;"><span style="color:#8a6d1f;">L${s.atLvl}:</span> ${escapeHTML(s.feature)}${s.idx>1?` #${s.idx}`:''} — ${s.chosen?`<b>${escapeHTML(s.chosen)}</b>`:'<i>unchosen</i>'}</div>`; }
    return out + `<div class="mb-4"></div>`;
  };
  let classDetailRows = classArr.map(e => {
    const cls = getClassEntry(e); if (!cls) return '';
    psRendered.add(e.name);
    return psClassBlock(e.name, e, cls);
  }).join('');
  for (const cn in psByClass) if (!psRendered.has(cn)) classDetailRows += psClassBlock(cn, null, null);
  return classDetailRows;
}

// Print sheet: the Outstanding Selections and Active Power Effects strips.
function printOutstandingStrip(c) {
  // v8.33.0 (Adam): the print sheet mirrors the nav attention dots — one
  // consolidated "Outstanding Selections" strip under the header when any
  // page still holds an unmade pick (unspent skill points, open talent/feat
  // slots, Hero's Gift, unchosen feat params, unpicked spells/powers known).
  // Renders nothing when the character is complete.
  let psOutstanding = '';
  try {
    const attn = outstandingSelections(c);
    const allNotes = [];
    for (const tab of ['skills','talents','feats','spells','powers','mutations']) {
      for (const n of (attn[tab] || [])) allNotes.push(n);
    }
    if (allNotes.length) {
      psOutstanding = `<div class="p-5-10 mb-6 fs-8_5pt" style="border:1.5px solid #b8860b;background:#faf3dd;color:#7a5c00;">
        <b>⚠ OUTSTANDING SELECTIONS</b> — ${allNotes.map(n=>escapeHTML(n)).join(' · ')}</div>`;
    }
  } catch (e) {}
  // v8.43.0: active power effects strip — the printed sheet is a table
  // artifact, so transient bonuses baked into its numbers must announce
  // themselves (and their NPF suppression state).
  try {
    const aeList = c.activeEffects || [];
    if (aeList.length) {
      const bits = aeList.map(a => `${a.name}${a.durText ? ` [${a.durText}]` : ''}${a.augSpent ? ` (+${a.augSpent} PP)` : ''}`);
      psOutstanding += `<div class="p-5-10 mb-6 fs-8_5pt" style="border:1.5px solid #78afcd;background:#eef5fa;color:#2a5a7a;">
        <b>✨ ACTIVE POWER EFFECTS${c.nullified ? ' — ⊘ SUPPRESSED (Null Power Field)' : ' (baked into the numbers below; end on rest)'}</b> — ${bits.map(escapeHTML).join(' · ')}</div>`;
    }
  } catch (e) {}
  return psOutstanding;
}

// Print sheet template: the header (name, race, class, ...).
function printHeaderHtml(c, psOutstanding, classSummary) {
  return `  ${psOutstanding}
  <div class="ps-header">
    <div class="ps-header-main">
      <img class="ps-logo" alt="" src="${(document.getElementById('site-logo')||{}).src||''}">
      <div class="ps-char-name">${c.name}</div>
      <div class="ps-game">Epics &amp; Epochs (E&amp;E) System</div>
    </div>
    <div class="ps-field"><span class="ps-lbl">Race</span><span class="ps-val">${c.race}</span></div>
    <div class="ps-field"><span class="ps-lbl">Sex / Gender</span><span class="ps-val">${c.sex||'—'}</span></div>
    <div class="ps-field"><span class="ps-lbl">Alignment</span><span class="ps-val">${c.align}</span></div>
    <div class="ps-field"><span class="ps-lbl">Occupation${(c.occupations && c.occupations.length > 1)?'s':''}</span><span class="ps-val">${(c.occupations && c.occupations.length) ? c.occupations.join(' + ') : c.occ}</span></div>
    <div class="ps-field"><span class="ps-lbl">Allegiance(s)</span><span class="ps-val">${c.allegiance||'—'}</span></div>
    <div class="ps-field"><span class="ps-lbl">Player</span><span class="ps-val">${c.player||'—'}</span></div>
    <div class="ps-field">
      <span class="ps-lbl">Class / Levels</span>
      <span class="ps-val">${classSummary}</span>
    </div>
    <div class="ps-field"><span class="ps-lbl">Total / ECL</span><span class="ps-val">${c.totalLvl} / ${c.ecl}</span></div>
    <div class="ps-field"><span class="ps-lbl">Languages</span><span class="ps-val">${c.langs||'Common'}</span></div>
  </div>
`;
}

// Print sheet template: Ability Scores.
function printAbilityScoresHtml(c, psAttrNotes, psItemAttrB) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Ability Scores</div>
        <div class="ps-sec-body">
          <div class="ps-attrs">
            ${ATTR_NAMES.map((a,i)=>{const iB=psItemAttrB.best[i]||0;const effV=c.attrs[i]+iB;return `<div class="ps-attr-box"><span class="ps-attr-nm">${a}</span><span class="ps-attr-score">${c.attrs[i]}${iB>0?` <span class="fs-8pt" style="color:#4a6d8c;">(${effV})</span>`:''}</span><span class="ps-attr-mod">${ms(effV)}</span></div>`;}).join('')}
          </div>
          ${psAttrNotes.length?`<div class="fs-6_5pt mt-2" style="color:#888;">Includes: ${psAttrNotes.join(' · ')}</div>`:''}
        </div>
      </div>
`;
}

// Print sheet template: Combat Statistics. s = the precomputed combat values.
function printCombatStatsHtml(c, s) {
  const { acDisp, parry, dodge, psInit, psSpdCell, psSRCell, psSpdFoot, psDefLine } = s;
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Combat Statistics</div>
        <div class="ps-sec-body">
          <div class="ps-stats">
            <div class="ps-stat"><span class="ps-stat-lbl">Base Attack</span><span class="ps-stat-val">${(c.bab>=0?'+':'')+c.bab}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">${acDisp.label}</span><span class="ps-stat-val">${acDisp.value}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Defense Bon.</span><span class="ps-stat-val">${(c.def>=0?'+':'')+c.def}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Grapple</span><span class="ps-stat-val">${(()=>{const g=computeGrapple(c);return (g.total>=0?'+':'')+g.total;})()}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Parry</span><span class="ps-stat-val">${parry.total>=0?'+':''}${parry.total}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Dodge</span><span class="ps-stat-val">${dodge.total>=0?'+':''}${dodge.total}</span></div>
            ${(computeNaturalAC(c).total||0)>0 ? `<div class="ps-stat"><span class="ps-stat-lbl">Nat. Hardness</span><span class="ps-stat-val">${computeNaturalAC(c).total}</span></div>` : ''}
            <div class="ps-stat"><span class="ps-stat-lbl">Initiative</span><span class="ps-stat-val">${(psInit>=0?'+':'')+psInit}</span></div>
            ${psSpdCell}
            ${psSRCell}
            <div class="ps-stat"><span class="ps-stat-lbl">Max HP</span><span class="ps-stat-val">${c.maxHP}</span></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Action Pts</span><span class="ps-stat-val">${c.apMax||0}</span></div>
          </div>
          ${psSpdFoot}
          ${psDefLine}
        </div>
      </div>
`;
}

// Print sheet template: Saving Throws.
function printSavesHtml(psSaveRow, cM, dM, wM) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Saving Throws</div>
        <div class="ps-sec-body">
          <div class="ps-saves">
            ${psSaveRow('fort','Fortitude','CON',cM)}
            ${psSaveRow('ref','Reflex','DEX',dM)}
            ${psSaveRow('will','Will','WIS',wM)}
          </div>
        </div>
      </div>
`;
}

// Print sheet template: Experience & Level (with the Hero level table).
function printXPHtml(c, xpProg, hc, firstHero, lvlTable) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Experience & Level</div>
        <div class="ps-sec-body">
          <div class="justify-between items-baseline" style="display:flex;">
            <span style="font-size:14pt;font-weight:700;">Level ${c.totalLvl}</span>
            ${c.ecl!==c.totalLvl?`<span style="font-size:9pt;color:#6b5320;">ECL ${c.ecl}</span>`:''}
          </div>
          <div class="ps-xp-bar"><div class="ps-xp-fill" style="width:${xpProg.pct}%;"></div></div>
          <div class="fs-8pt mt-2" style="color:#555;">${xpProg.inLevel.toLocaleString()} / ${xpProg.bandSize.toLocaleString()} XP this level (${xpProg.pct}%) &middot; ${c.xp.toLocaleString()} total</div>
          ${hc?`<div class="mt-6"><div class="fs-7pt uppercase ls-0_06em mb-2" style="font-family:'Cinzel',Georgia,serif;color:#6b5320;">${firstHero.name} Table (Levels 1–5)</div>${lvlTable}</div>`:''}
        </div>
      </div>
`;
}

// Print sheet template: Feats and Talents.
function printFeatsAndTalentsHtml(c, featList, talentList) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Feats</div>
        <div class="ps-sec-body">
          ${(c.feats||[]).length?`<ul class="ps-feat-list">${featList}</ul>`:'<div class="fs-8_5pt" style="color:#aaa;">No feats recorded.</div>'}
        </div>
      </div>

      <div class="ps-sec">
        <div class="ps-sec-head">Talents</div>
        <div class="ps-sec-body">
          ${(c.talents||[]).length?`<ul class="ps-feat-list">${talentList}</ul>`:'<div class="fs-8_5pt" style="color:#aaa;">No talents recorded.</div>'}
        </div>
      </div>
`;
}

// Print sheet template: Skills.
function printSkillsHtml(skillRows) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Skills (ranked + key combat skills)</div>
        <div class="ps-sec-body">
          <table class="ps-skill-tbl">
            <thead><tr><th style="min-width:120px;">Skill</th><th>Key</th><th>Mod</th><th>Rnk</th><th>Misc</th><th>Total</th></tr></thead>
            <tbody>${skillRows}</tbody>
          </table>
          <div class="fs-7pt mt-4" style="color:#888;">Shaded rows = class skills. All skills shown have ranks > 0 or are key combat skills.</div>
        </div>
      </div>
`;
}

// Print sheet template: Scenario, racial features and Starting Occupation.
function printScenarioRaceOccupationHtml(c) {
  return `      <!-- v8.78.0 (Adam's print-parity ask): the v8.77.0 screen restructure
           on paper — Scenario leads, race follows (Hybrid parents included),
           then the conflated Class Features & Abilities with the
           level-by-level record. -->
      <div class="ps-sec">
        <div class="ps-sec-head">Scenario, Racial Features, &amp; Starting Occupation</div>
        <div class="ps-sec-body ps-classes">
          ${c.sixLevels?`<div class="mb-5"><div class="fs-7pt uppercase ls-0_06em mb-2" style="font-family:'Cinzel',Georgia,serif;color:#6b5320;">Scenario: ${normalizePresetName(c.scenarioPreset||'Custom')}</div><div class="fs-8pt" style="color:#555;">${['arcane','divine','heroic','mutation','psionic','tech'].map(a=>`${SIX_LEVELS[a].short} ${c.sixLevels[a]||0}`).join(' · ')}</div></div>`:''}
          ${(() => { const mpP = getMPState(c);
            const templ = !!(mpP && mpP.isMutantTemplated);
            const rn = (raceDisplayOf(c)) + (templ ? ' Mutant' : '');
            return `<div class="ps-class-row"><span class="ps-class-nm">${rn}</span><span class="ps-class-det">${(hybridInfo(c))?'RLM':'ECL'} +${raceEclOf(c)}${templ && mpP.mutantLevel ? ` (+${mpP.mutantLevel} Mutant)` : ''}</span></div>`; })()}
          ${(() => { const hy = hybridInfo(c);
            if (!hy) return `<div class="fs-8pt" style="color:#555;">${RACES[c.race]?.notes||''}</div>`;
            return `<div class="fs-7_5pt" style="color:#555;"><b>${escapeHTML(hy.a)}:</b> ${hy.A.notes||'—'}</div><div class="fs-7_5pt" style="color:#555;"><b>${escapeHTML(hy.b)}:</b> ${hy.B.notes||'—'}</div>`; })()}
          ${(() => { const mpP = getMPState(c);
            if (!mpP || !mpP.isMutantTemplated) return '';
            const ml = mpP.mutantLevel, conM = am(((c.attrs)||[10,10,10,10,10,10])[2]);
            const spp = mpP.isSuperMutant ? getSuperPPState(c) : null;
            return `<div class="fs-7_5pt" style="color:#555;">🧬 <b>${mpP.tier.tier} ${mpP.isSuperMutant ? 'Super-Mutant' : 'Mutant'}</b> (RLM +${ml} · ${mpP.totalEarned} MP): Unnatural Prowess +${Math.floor(ml/2)} BA / +${Math.floor(ml/3)} Def / +${2*ml} SP (Tech-0) · Resilience +${ml*(5+conM)} HP / +${Math.floor(ml/2)} saves${mpP.isSuperMutant ? ` · ESL ${mpP.eml} · ${spp?spp.max:'—'} super-PP/day` : ''}</div>`; })()}
          ${(() => { // v8.96.1 (print parity for §240): the Starting Occupation on paper.
            const pOccs = (c.occupations && c.occupations.length ? c.occupations : (c.occ ? [c.occ] : [])).filter(Boolean);
            if (!pOccs.length) return '';
            return pOccs.map((o, oi) => {
              const od = getOccupationData(o);
              const picks = (c.occupationPicks || {})[oi === 0 ? 'primary' : 'secondary'] || {};
              const sk = (picks.skills || []).filter(Boolean);
              const bits = [];
              bits.push(sk.length ? `class skills: ${sk.join(', ')}` : `class skills unchosen (pick ${od ? od.skill_count : '?'})`);
              if (picks.feat) bits.push(`bonus feat: ${picks.feat}`);
              else if (od && od.bonus_feat_options && od.bonus_feat_options.length) bits.push('bonus feat unchosen');
              if (od && od.wealth != null) bits.push(`Wealth +${od.wealth}`);
              return `<div class="fs-7_5pt mt-2" style="color:#555;">💼 <b>${escapeHTML(o)}</b>${oi === 1 ? ' (2nd)' : ''} — ${escapeHTML(bits.join(' · '))}</div>`;
            }).join('');
          })()}
        </div>
      </div>
`;
}

// Print sheet template: Class Features & Abilities.
function printClassFeaturesHtml(classDetailRows, psChoiceRows) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Class Features &amp; Abilities</div>
        <div class="ps-sec-body ps-classes">
          ${classDetailRows}
          ${psChoiceRows}
        </div>
      </div>
`;
}

// Print sheet template: Notes, the HP / Condition Tracker, Languages.
function printNotesTrackerLanguagesHtml(c) {
  return `      <div class="ps-sec">
        <div class="ps-sec-head">Notes &amp; Backstory</div>
        <div class="ps-sec-body"><div class="ps-notes">${c.notes||'—'}</div></div>
      </div>

      <div class="ps-sec">
        <div class="ps-sec-head">HP / Condition Tracker</div>
        <div class="ps-sec-body">
          <div class="gap-4 mb-6" style="display:grid;grid-template-columns:repeat(4,1fr);">
            ${[1,2,3,4,5,6,7,8].map(()=>'<div class="rounded-2" style="height:14px;border:1px solid #888;"></div>').join('')}
          </div>
          <div class="fs-8pt">Current HP: _______ / ${c.maxHP} &nbsp;&nbsp; Conditions: _______________________</div>
        </div>
      </div>

      <div class="ps-sec">
        <div class="ps-sec-head">Languages &amp; Allegiances</div>
        <div class="ps-sec-body">
          <div style="font-size:9pt;"><b>Languages:</b> ${c.langs||'Common'}</div>
          <div class="mt-3" style="font-size:9pt;"><b>Allegiances:</b> ${c.allegiance||'—'}</div>
        </div>
      </div>
`;
}

