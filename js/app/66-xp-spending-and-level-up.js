// =============================================================================
// js/app/66-xp-spending-and-level-up.js
// XP SPENDING AND LEVEL UP
// =============================================================================
//
// WHAT'S IN HERE
//   Spending XP (mastercrafting), and the level-up flow.
//
// KEY NAMES (so you can search for them)
//   functions (24): techsmithLvl, reconcileMcReserve, spendXP, checkLevelUp,
//   lvlupCancel, lvlupRenderClassChoice, lvlupOnClassChoice,
//   lvlupRenderNewClassForm, lvlupOnNewClassTier, lvlupOnNewClassName,
//   lvlupGoToHpRoll, lvlupPrepareHpRoll, lvlupRerollHp, lvlupRenderHpRoll,
//   lvlupSetBumpChoice, lvlupBackToClassChoice, lvlupComputeOwed, lvlupCommit,
//   goToSkillsForSpending, lvlupComputeOwedAfter, addCond, rmCond, clearConds,
//   addLogEntry
//
// LOAD ORDER
//   File 66 of 68. index.html loads it after
//   js/app/65-tracker-logs-and-damage.js and before js/app/67-pdf-export.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 53908-54690 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 53908-54690; unchanged below this line ----
// ============================================================================
// v8.20.0 XP EXPENDITURE (Adam's ask, 2026-09-04): mastercrafting (HH p.275:
// 250 XP × bonus, paid BEFORE the Craft check), magic/psionic item creation
// (HH Ch.VIII: fresh builds, and mending at half XP), and spells/powers with
// an XP Cost line (Permanency, Disjunction, Miracle...). Book floor (HH,
// spells chapter + mastercraft section): "You cannot spend so much XP that
// you lose a level" — the spend is refused unless the character stays at or
// above the minimum XP for their CURRENT level (ECL-keyed, GMG p.38 table).
// Every spend lands in the action log as a typed 'xp-spend' event (notes
// editable there), so the ledger survives audits the way retcon HP does.
//
// TECHSMITH MASTERCRAFT XP RESERVE (HH p.140): 250 × class level granted at
// every Techsmith level, spendable ONLY on mastercraft items, forfeited if
// unspent when a new level is gained, mixable with real XP in any split.
// Stored as c.mcReserve = {balance, grantedFor}; reconciled on render (self-
// heal) and at lvlupCommit (authoritative forfeit + fresh grant).
function techsmithLvl(c){ return migrateLegacyClasses(c).filter(e=>e.name==='Techsmith').reduce((s,e)=>s+(e.level||0),0); }
function reconcileMcReserve(c){
  if(!c) return;
  const ts = techsmithLvl(c);
  if(!ts){ if(c.mcReserve) delete c.mcReserve; return; }
  if(!c.mcReserve || typeof c.mcReserve.grantedFor !== 'number'){
    // First sight of a Techsmith (new take, or a pre-v8.20 character): seed
    // with the current class level's grant — history can't be reconstructed.
    c.mcReserve = { balance: 250*ts, grantedFor: ts };
    logActionEvent(c,'xp-reserve',250*ts,'Mastercraft XP Reserve',`Techsmith ${ts}: reserve seeded at ${250*ts} XP (250 × class level — mastercraft only, HH p.140)`);
    return;
  }
  if(ts > c.mcReserve.grantedFor){
    const lost = c.mcReserve.balance;
    if(lost>0) logActionEvent(c,'xp-reserve',-lost,'Mastercraft XP Reserve',`Unspent reserve forfeited at level-up (${lost.toLocaleString()} XP — "must spend the extra experience points they gain at each level", HH p.140)`);
    c.mcReserve = { balance: 250*ts, grantedFor: ts };
    logActionEvent(c,'xp-reserve',250*ts,'Mastercraft XP Reserve',`Techsmith ${ts}: fresh reserve of ${250*ts} XP granted`);
  } else if(ts < c.mcReserve.grantedFor){
    // Level retcon: cap the reserve at the demoted level's grant.
    c.mcReserve = { balance: Math.min(c.mcReserve.balance, 250*ts), grantedFor: ts };
  }
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
// ========== LEVEL-UP FLOW (v8.3) ==========
// The level-up experience is the central moment of long-term play. This flow
// walks the player through it as a multi-step modal:
//
//   1. checkLevelUp()             — entry point (button click). Validates XP,
//                                   builds options, opens modal at Phase 1.
//   2. lvlupRenderClassChoice()   — Phase 1: pick which class to advance, or
//                                   add a new multiclass. Player commits via
//                                   Continue button → moves to Phase 2.
//   3. lvlupRenderHpRoll()        — Phase 2: shows the HP roll for the new
//                                   level (rolled under c.hpMode). Re-roll
//                                   button regenerates the roll. Player
//                                   commits via Confirm Level Up → calls
//                                   lvlupCommit().
//   4. lvlupCommit()              — Apply all changes: append HP roll, bump
//                                   class level, recompute derived stats,
//                                   save. Determine owed items and route
//                                   the player appropriately.
//
// Transient state during the flow lives on _pendingLevelUp. It's cleared on
// cancel or commit.
let _pendingLevelUp = null;

function checkLevelUp(){
  const c=chars.find(x=>x.id===curId);if(!c)return;
  if(c.xp<c.xpNext){toast('Not enough XP yet.');return;}
  // Ensure we're operating on the array form
  if(!Array.isArray(c.classes)) c.classes = migrateLegacyClasses(c);
  // Build advancement options: every existing class entry that hasn't hit its
  // cap, plus "add a new class".
  const opts=[];
  c.classes.forEach((e,i)=>{
    const cap=tierMaxLevel(e);
    if((e.level||0)<cap) opts.push({kind:'advance',idx:i,label:`${e.name} (Lvl ${e.level}→${e.level+1})`,classRef:e});
  });
  opts.push({kind:'new',label:'+ Add a new class (multiclass)'});
  _pendingLevelUp = {
    char: c,
    options: opts,
    choice: opts.length === 1 ? opts[0] : null,  // auto-pick if only one option
    // Newclass-specific fields filled in by the new-class sub-form:
    newClassTier: 'basic',
    newClassName: null,
    careerPathException: false,
    // HP roll fields filled in at Phase 2:
    hpRoll: null,        // the new die roll for this level
    hpDieSize: null,     // the hd of the class being advanced
    // Phase tracking:
    phase: opts.length === 1 && opts[0].kind === 'advance' ? 'hp' : 'class',
  };
  document.getElementById('level-up-modal').classList.add('open');
  if (_pendingLevelUp.phase === 'class') {
    lvlupRenderClassChoice();
  } else {
    lvlupPrepareHpRoll();
    lvlupRenderHpRoll();
  }
}

function lvlupCancel() {
  document.getElementById('level-up-modal').classList.remove('open');
  _pendingLevelUp = null;
}

function lvlupRenderClassChoice() {
  const lu = _pendingLevelUp;
  if (!lu) return;
  const c = lu.char;
  document.getElementById('lvlup-title').textContent = `⬆ ${c.name} reaches Level ${c.totalLvl + 1}`;
  const optsHtml = lu.options.map((o, i) => {
    const checked = (lu.choice === o) ? 'checked' : '';
    return `<label style="display:flex;gap:6px;align-items:center;padding:6px 8px;background:rgba(200,151,30,.04);border:1px solid rgba(200,151,30,.15);border-radius:3px;cursor:pointer;margin-bottom:4px;">
      <input type="radio" name="lvlup-choice" value="${i}" ${checked} onchange="lvlupOnClassChoice(${i})">
      <span>${escapeHTML(o.label)}</span>
    </label>`;
  }).join('');
  let newClassUI = '';
  if (lu.choice && lu.choice.kind === 'new') {
    newClassUI = lvlupRenderNewClassForm();
  }
  document.getElementById('lvlup-body').innerHTML = `
    <p style="margin:0 0 .75rem 0;">You've earned enough XP for a new level. Choose how to advance:</p>
    ${optsHtml}
    ${newClassUI}
  `;
  const canContinue = lu.choice && (lu.choice.kind === 'advance' || (lu.choice.kind === 'new' && lu.newClassName));
  document.getElementById('lvlup-actions').innerHTML = `
    <button class="btn btn-sm" onclick="lvlupCancel()">Cancel</button>
    <button class="btn btn-sm btn-pri" ${canContinue?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="lvlupGoToHpRoll()">Continue →</button>
  `;
}

function lvlupOnClassChoice(idx) {
  const lu = _pendingLevelUp;
  if (!lu) return;
  lu.choice = lu.options[idx];
  // Reset new-class fields when switching options
  lu.newClassName = null;
  lvlupRenderClassChoice();
}

function lvlupRenderNewClassForm() {
  const lu = _pendingLevelUp;
  const c = lu.char;
  const tierLow = lu.newClassTier || 'basic';
  // Show the Career Path warning if applicable
  // v8.3.32: Ordinary levels are transparent to the Career Path rule — a
  // purely-Ordinary character can still ascend to a Hero class. Only
  // Basic/Advanced/Prestige levels lock the path. hasCareerPathLockingLevel
  // encodes this. (The ascension itself is additionally gated by the
  // heroic-act note prereq — see the ascension-note injection.)
  let warn = '';
  if (tierLow === 'hero' && hasCareerPathLockingLevel(c.classes)) {
    warn = `<div style="font-size:11px;color:#d4b870;margin:4px 0;padding:5px 7px;background:rgba(212,184,112,.06);border-radius:3px;line-height:1.4;">
      ⚠ <b>Career Path rule</b> (HH): no new Hero classes after taking a non-Hero level (Ordinary levels excepted). Selecting a Hero class here will be recorded as a GM exception.
    </div>`;
  }
  // v8.3.23: attribute-prereq warning. Triggers when attrMinException is set
  // by lvlupOnNewClassName. The player can still proceed — the violation will
  // be recorded as a GM exception on commit.
  if (lu.attrMinException) {
    const ex = lu.attrMinException;
    warn += `<div style="font-size:11px;color:#e08080;margin:4px 0;padding:5px 7px;background:rgba(212,112,112,.06);border-radius:3px;line-height:1.4;">
      ⚠ <b>Attribute prerequisite unmet</b> (HH p.52): ${escapeHTML(lu.newClassName)} requires <b>${escapeHTML(ex.label)}</b>. Your character has ${escapeHTML(ex.scoreStr)}. Proceeding will be recorded as a GM exception.
    </div>`;
  }
  // v8.3.29: structured-prereq warning. Triggers when prereqMiss is set by
  // lvlupOnNewClassName for skill rank, feat, BAB, class-ability, or
  // sixLevels prereqs that aren't met. Parallels the Form's Save flow.
  if (Array.isArray(lu.prereqMiss) && lu.prereqMiss.length > 0) {
    const items = lu.prereqMiss.map(m => `<li>${escapeHTML(m)}</li>`).join('');
    warn += `<div style="font-size:11px;color:#e08080;margin:4px 0;padding:5px 7px;background:rgba(212,112,112,.06);border-radius:3px;line-height:1.4;">
      ⚠ <b>Class prerequisites unmet</b>: ${escapeHTML(lu.newClassName)} requires:
      <ul style="margin:4px 0 0 1.2em;padding:0;">${items}</ul>
      <div style="font-size:10.5px;margin-top:4px;color:var(--g55);">Items marked "GM-verify" can't be auto-checked — confirm with your GM. Proceeding will be recorded as a GM exception.</div>
      ${lu.char && lu.char.careerGoal === lu.newClassName
        ? `<div style="font-size:10.5px;margin-top:4px;color:#7daadc;">⭐ This is your current career goal — the Sheet tab tracks the path.</div>`
        : `<button class="btn btn-sm" onclick="setCareerGoalFromLevelUp('${escapeHTML(lu.newClassName).replace(/'/g, "\\'")}')" style="font-size:10px;margin-top:5px;border-color:#7daadc;color:#7daadc;" title="Pledge this class as a career goal — the Sheet's Career Compass will track the qualification path (v8.39.0)">⭐ Set as career goal instead</button>`}
    </div>`;
  }
  // v8.3.32: ASCENSION note. Triggers when an Ordinary character is taking
  // their first Hero class (lu.ascensionNote set by lvlupOnNewClassName). The
  // attribute-13 minimum is enforced separately via attrMinException above —
  // this note is the GM-adjudicated heroic-act gate. Distinct purple styling
  // marks it as the aspirant-ascension moment rather than a rules violation.
  if (lu.ascensionNote) {
    warn += `<div style="font-size:11px;color:var(--vio);margin:4px 0;padding:5px 7px;background:rgba(196,153,212,.07);border-radius:3px;line-height:1.4;">
      ⬟ <b>Ascension</b>: this character is rising from Ordinary to Hero. ${escapeHTML(lu.ascensionNote)}. The attribute minimum still applies; the heroic act is the GM's call. Proceeding records a GM exception documenting the ascension.
    </div>`;
  }
  const tbl = tierLow==='hero' ? HERO_CLASSES : tierLow==='ordinary' ? ORDINARY_CLASSES : tierLow==='basic' ? BASIC_CLASSES : tierLow==='advanced' ? ADVANCED_CLASSES : PRESTIGE_CLASSES;
  const names = Object.keys(tbl).filter(n => !c.classes.some(e => e.tier === tierLow && e.name === n));
  // v8.52.0 (Session Zero polish, Xander retrospective): eligibility badges
  // in the dropdown itself, so a player browsing classes sees at a glance
  // which doors are open BEFORE picking one and reading the red warning.
  // ✓ = every auto-checkable gate met · △N = N gate-groups outstanding
  // (structured prereqs + the attribute minimum) · ⭐ = pledged career goal.
  // GM-verify-only gates (story notes) don't count against the badge — the
  // warning panel still surfaces them after selection, as before.
  const ATTR_IDX_BADGE = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  const badgeOf = (n) => {
    let unmet = 0;
    try {
      const chk = classPrereqCheckOf(c, n);
      unmet += (chk.report || []).filter(g => !g.met && g.options.some(o => o.type !== 'note')).length;
    } catch (e) { return ''; }
    try {
      const cd = tbl[n];
      if (cd && typeof cd.attrMin === 'number') {
        const code = cd.attrMinKey || (cd.attr ? cd.attr.split('/')[0].trim() : null);
        const idx = code !== null ? ATTR_IDX_BADGE[code] : undefined;
        if (idx !== undefined && ((c.attrs || [])[idx] || 0) < cd.attrMin) unmet += 1;
      }
    } catch (e) {}
    const star = (c.careerGoal === n) ? '⭐ ' : '';
    return star + (unmet === 0 ? '✓ ' : `△${unmet} `);
  };
  const classOpts = ['<option value="">— pick a class —</option>'].concat(
    names.map(n => `<option value="${escapeHTML(n)}" ${n===lu.newClassName?'selected':''}>${badgeOf(n)}${escapeHTML(n)}</option>`)
  ).join('');
  return `
    <div style="margin-top:8px;padding:8px 10px;background:rgba(200,151,30,.04);border:1px solid rgba(200,151,30,.18);border-radius:3px;">
      <div style="font-family:'Epics Serif','Cinzel',serif;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--g70);margin-bottom:5px;">New Multiclass</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="font-size:11px;color:var(--g75);">Tier:</label>
        <select onchange="lvlupOnNewClassTier(this.value)" style="font-size:12px;">
          <option value="hero" ${tierLow==='hero'?'selected':''}>Hero</option>
          <option value="ordinary" ${tierLow==='ordinary'?'selected':''}>Ordinary</option>
          <option value="basic" ${tierLow==='basic'?'selected':''}>Basic</option>
          <option value="advanced" ${tierLow==='advanced'?'selected':''}>Advanced</option>
          <option value="prestige" ${tierLow==='prestige'?'selected':''}>Prestige</option>
        </select>
        <label style="font-size:11px;color:var(--g75);">Class:</label>
        <select onchange="lvlupOnNewClassName(this.value)" style="flex:1;min-width:140px;font-size:12px;">${classOpts}</select>
      </div>
      <div style="font-size:10px;color:var(--g50);margin-top:3px;">✓ prereqs met · △N gate-groups outstanding · ⭐ career goal — GM-adjudicated story gates aren't counted; the panel below details them once a class is picked.</div>
      ${warn}
    </div>
  `;
}

function lvlupOnNewClassTier(tier) {
  const lu = _pendingLevelUp;
  if (!lu) return;
  lu.newClassTier = tier;
  lu.newClassName = null;
  lvlupRenderClassChoice();
}

function lvlupOnNewClassName(name) {
  const lu = _pendingLevelUp;
  if (!lu) return;
  lu.newClassName = name || null;
  const c = lu.char;
  // v8.3.32: Career Path exception applies if a Hero class is being taken
  // after a CAREER-PATH-LOCKING level (Basic/Advanced/Prestige). Ordinary
  // levels are transparent — they do NOT trigger the Career Path exception.
  if (lu.newClassTier === 'hero' && hasCareerPathLockingLevel(c.classes)) {
    lu.careerPathException = true;
  } else {
    lu.careerPathException = false;
  }
  // v8.3.32: ASCENSION detection. A purely-Ordinary character (has Ordinary
  // levels, no Hero levels yet, no Career-Path-locking levels) taking their
  // first Hero class is "ascending". Ascension is gated by the normal
  // attribute-13 minimum (handled by the attrMin check below, like any Hero
  // class) PLUS a GM-adjudicated "heroic act" note. We set lu.ascensionNote
  // here; lvlupRenderNewClassForm surfaces it, and lvlupCommit records the
  // GM exception. The note is NOT in the static Hero class data — it's
  // injected only at this specific Ordinary→first-Hero transition, so a
  // fresh level-1 Hero character never spuriously sees it.
  lu.ascensionNote = null;
  if (lu.newClassTier === 'hero') {
    const hasOrdinary = (c.classes || []).some(e => e.tier === 'ordinary' && (e.level||0) > 0);
    const hasHero = (c.classes || []).some(e => e.tier === 'hero' && (e.level||0) > 0);
    const locked = hasCareerPathLockingLevel(c.classes);
    if (hasOrdinary && !hasHero && !locked) {
      lu.ascensionNote = 'Must have performed a heroic act (GM-adjudicated)';
    }
  }
  // v8.3.23: detect attrMin violation. Hero classes need 13 in their key
  // attribute; certain Basic classes (Cleric/Paladin/Saint, Psion, Sorcerer,
  // Wilder, Wizard) need 10 in theirs. If unmet, flag for GM-exception.
  lu.attrMinException = null;
  if (lu.newClassName) {
    const cls = getClassEntry({tier: lu.newClassTier, name: lu.newClassName});
    if (cls && typeof cls.attrMin === 'number') {
      const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
      // v8.3.24: use attrMinKey (single attribute code); fall back to first
      // token of `attr` for any pre-v8.3.24 entries lacking the new field.
      const code = cls.attrMinKey || (cls.attr ? cls.attr.split('/')[0].trim() : null);
      if (code) {
        const idx = ATTR_IDX[code];
        const score = idx !== undefined ? (c.attrs[idx] || 0) : 0;
        if (score < cls.attrMin) {
          const label = `${code} ${cls.attrMin}+`;
          const scoreStr = `${code} ${score}`;
          lu.attrMinException = {label, scoreStr, attrMin: cls.attrMin};
        }
      }
    }
  }
  // v8.3.29: detect structured-prereq violations (skill ranks, feats, BAB,
  // class abilities, etc.) — the same check the Form's Save flow uses. Prior
  // to v8.3.29, the Level Up dialog only checked attrMin and Career Path,
  // silently allowing Advanced/Prestige class entries to be taken without
  // meeting their stated prereqs (e.g. Assassin without the contract-killing
  // note, Investigator without the BAB / skill ranks / feat). Now the dialog
  // warns the player in-flow and records a GM exception on commit, matching
  // the Form's Save behavior.
  lu.prereqMiss = null;
  if (lu.newClassName) {
    const sl = c.sixLevels || {arcane:0, divine:0, heroic:c.heroicLevel||1, mutation:0, psionic:0, tech:5};
    const ctx = {
      attrs: c.attrs || [10,10,10,10,10,10],
      allegiance: c.allegiance || '',
      align: c.align || '',
      char: c,
    };
    // Pass the character's *existing* classes (not including the to-be-added
    // one) as `existingClasses`. Skills + feats come from the saved character.
    // checkClassPrereqsFromArray handles all four tiers (Hero/Basic/Adv/Prestige).
    // v8.5.4 FIX: feat names were mapped via `f.n`, but saved feat records use
    // {name, param} — every object-form feat mapped to undefined, silently
    // failing feat prereqs at level-up.
    const r = checkClassPrereqsFromArray(
      lu.newClassName,
      c.classes || [],
      c.skills || {},
      (c.feats || []).map(f => typeof f === 'string' ? f : (f.name || f.n)),
      sl,
      ctx
    );
    // Filter the attrMin-style miss out of `r.missing` — it's already covered
    // by `lu.attrMinException` and we don't want to double-report. The
    // attrMin message has the shape "ATTR N+" (e.g., "DEX 15+").
    const otherMisses = (r.missing || []).filter(m => !/^[A-Z]{3}\s+\d+\+$/.test(m));
    if (!r.met && otherMisses.length > 0) {
      lu.prereqMiss = otherMisses;
    }
  }
  lvlupRenderClassChoice();
}

function lvlupGoToHpRoll() {
  const lu = _pendingLevelUp;
  if (!lu) return;
  if (!lu.choice) return;
  if (lu.choice.kind === 'new' && !lu.newClassName) return;
  lu.phase = 'hp';
  lvlupPrepareHpRoll();
  lvlupRenderHpRoll();
}

function lvlupPrepareHpRoll() {
  const lu = _pendingLevelUp;
  const c = lu.char;
  // Determine the hit die size of the class being advanced
  let cls = null;
  if (lu.choice.kind === 'advance') {
    cls = getClassEntry(lu.choice.classRef);
  } else {
    cls = getClassEntry({tier: lu.newClassTier, name: lu.newClassName});
  }
  lu.hpDieSize = cls ? cls.hd : 8;
  // Roll under the character's chosen mode (default to 'hero' if missing for
  // legacy characters)
  const mode = c.hpMode || 'hero';
  lu.hpRoll = rollHitDieForMode(lu.hpDieSize, mode);
}

function lvlupRerollHp() {
  const lu = _pendingLevelUp;
  if (!lu) return;
  const c = lu.char;
  const mode = c.hpMode || 'hero';
  if (mode === 'max') {
    toast('Max mode — no re-roll. HP gain is fixed at die size.');
    return;
  }
  lu.hpRoll = rollHitDieForMode(lu.hpDieSize, mode);
  lvlupRenderHpRoll();
}

function lvlupRenderHpRoll() {
  const lu = _pendingLevelUp;
  if (!lu) return;
  const c = lu.char;
  const mode = c.hpMode || 'hero';
  const modeLabel = {hero:"Hero's Hit Die", random:'Random', max:'Maximum'}[mode] || mode;
  const conM = am(c.attrs[2]);
  const totalHpThisLevel = lu.hpRoll + conM;
  const newTotalLvl = c.totalLvl + 1;
  // Surface owed items at the new level
  const owed = lvlupComputeOwed(c, newTotalLvl);
  let owedHtml = '';
  if (owed.feats > 0 || owed.bumps > 0 || owed.skillPoints > 0) {
    const lines = [];
    if (owed.feats > 0) lines.push(`<li><b style="color:var(--gold);">${owed.feats} new feat slot${owed.feats>1?'s':''}</b> — head to the Feats tab after to pick.</li>`);
    if (owed.bumps > 0) lines.push(`<li><b style="color:var(--gold);">+1 attribute point</b> from reaching level ${newTotalLvl} (every 4th level per HH p.879). Click an attribute below to assign it now, or assign it later by editing the character.</li>`);
    if (owed.skillPoints > 0) lines.push(`<li><b style="color:var(--gold);">${owed.skillPoints} new skill points</b> — head to the Skills tab after to spend.</li>`);
    owedHtml = `
      <div style="margin-top:12px;padding:10px 12px;background:rgba(200,151,30,.06);border-left:3px solid var(--gold);border-radius:0 3px 3px 0;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin-bottom:6px;">⚜ This level also grants:</div>
        <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.55;">${lines.join('')}</ul>
      </div>
    `;
  }
  // If bump is owed, surface attribute picker inline
  let bumpUi = '';
  if (owed.bumps > 0) {
    const sel = lu.bumpChoice || '';
    bumpUi = `
      <div style="margin-top:10px;padding:8px 10px;background:rgba(200,151,30,.04);border:1px solid rgba(200,151,30,.18);border-radius:3px;">
        <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--g70);margin-bottom:6px;">Attribute Bump (Level ${newTotalLvl})</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${ATTR_NAMES.map(a => `
            <button class="btn btn-sm" onclick="lvlupSetBumpChoice('${a}')" style="${sel===a?'background:rgba(200,151,30,.25);border-color:var(--gold);':''}">${a}${sel===a?' ✓':''}</button>
          `).join('')}
        </div>
        ${sel ? `<div style="margin-top:5px;font-size:11px;color:var(--g65);">+1 ${sel} — your ${sel} score becomes ${c.attrs[ATTR_NAMES.indexOf(sel)]+1}.</div>` : '<div style="margin-top:5px;font-size:11px;color:#d4b870;">⚠ Pick an attribute to bump (or skip to defer — you can assign later).</div>'}
      </div>
    `;
  }
  const rerollDisabled = (mode === 'max') ? 'disabled style="opacity:.4;cursor:not-allowed;"' : '';
  document.getElementById('lvlup-title').textContent = `⬆ ${c.name} reaches Level ${newTotalLvl}`;
  document.getElementById('lvlup-body').innerHTML = `
    <p style="margin:0 0 .75rem 0;color:var(--g85);">
      ${lu.choice.kind === 'advance'
        ? `Advancing <b style="color:var(--gold);">${escapeHTML(lu.choice.classRef.name)}</b> from level ${lu.choice.classRef.level} to ${lu.choice.classRef.level + 1}.`
        : `Adding a new class: <b style="color:var(--gold);">${escapeHTML(lu.newClassName)}</b> (${lu.newClassTier}, level 1).`}
    </p>
    <div style="padding:10px 12px;background:rgba(200,151,30,.05);border:1px solid rgba(200,151,30,.2);border-radius:3px;">
      <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--g70);margin-bottom:6px;">HP Roll — ${escapeHTML(modeLabel)}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:22px;color:var(--gold);font-weight:600;">+${totalHpThisLevel} HP</span>
        <span style="font-size:11px;color:var(--g65);">(d${lu.hpDieSize} rolled <b>${lu.hpRoll}</b>${conM!==0?` + Con ${conM>=0?'+':''}${conM}`:''})</span>
        <button class="btn btn-sm" onclick="lvlupRerollHp()" ${rerollDisabled} style="margin-left:auto;font-size:10px;">🎲 Re-roll</button>
      </div>
      <div style="margin-top:6px;font-size:11px;color:var(--g55);font-style:italic;line-height:1.4;">
        New Max HP: <b style="color:var(--gold);">${c.maxHP + totalHpThisLevel}</b> (was ${c.maxHP})
      </div>
    </div>
    ${bumpUi}
    ${owedHtml}
  `;
  // The Confirm button is gated on bump assignment if a bump is owed (player
  // can still skip via the Skip & Save button — see below — but the primary
  // button drives them to assign now).
  const bumpReady = (owed.bumps === 0) || !!lu.bumpChoice;
  const skipBtn = (owed.bumps > 0 && !lu.bumpChoice)
    ? `<button class="btn btn-sm" onclick="lvlupCommit(true)">Skip bump &amp; Save</button>`
    : '';
  document.getElementById('lvlup-actions').innerHTML = `
    <button class="btn btn-sm" onclick="lvlupCancel()">Cancel</button>
    ${lu.options.length > 1 ? `<button class="btn btn-sm" onclick="lvlupBackToClassChoice()">← Back</button>` : ''}
    ${skipBtn}
    <button class="btn btn-sm btn-pri" ${bumpReady?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="lvlupCommit(false)">${bumpReady?'Confirm Level Up':'Pick a bump first'}</button>
  `;
}

function lvlupSetBumpChoice(attr) {
  const lu = _pendingLevelUp;
  if (!lu) return;
  lu.bumpChoice = attr;
  lvlupRenderHpRoll();
}

function lvlupBackToClassChoice() {
  const lu = _pendingLevelUp;
  if (!lu) return;
  lu.phase = 'class';
  lvlupRenderClassChoice();
}

// Determine what the character is "owed" upon reaching newTotalLvl. This is
// the at-this-level delta: feats earned AT this level, bump earned AT this
// level, etc. — not the cumulative owed count.
function lvlupComputeOwed(c, newTotalLvl) {
  const oldLvl = c.totalLvl;
  // Feats earned at this level: floor(newL/3) − floor(oldL/3). Will be 1
  // when crossing 3, 6, 9, 12, 15, 18; 0 otherwise.
  const featDelta = Math.floor(newTotalLvl/3) - Math.floor(oldLvl/3);
  // Bumps earned at this level: floor(newL/4) − floor(oldL/4). 1 when
  // crossing 4, 8, 12, 16, 20; 0 otherwise.
  const bumpDelta = Math.floor(newTotalLvl/4) - Math.floor(oldLvl/4);
  // Skill points: derived from the class being advanced (or the new class
  // at L1). This requires _pendingLevelUp to know which class is being
  // leveled. Outside the level-up flow we can't compute this, so return 0.
  const lu = _pendingLevelUp;
  let spThisLevel = 0;
  let spComputed = false;
  if (lu) {
    let cls = null;
    if (lu.choice.kind === 'advance') {
      cls = getClassEntry(lu.choice.classRef);
    } else {
      cls = getClassEntry({tier: lu.newClassTier, name: lu.newClassName});
    }
    if (cls) {
      const intM = am(c.attrs[3]);
      // d20 lineage rule: minimum 1 skill point per level even with deeply
      // negative Int mod. Class.sp should always be a real number now (post
      // v8.3.13 audit); the `|| 4` fallback is defensive only.
      const sp = typeof cls.sp === 'number' ? cls.sp : 4;
      spThisLevel = Math.max(1, sp + intM);
      // v8.3.15: Human racial +1 SP per additional level (HH p.21). The L1
      // case (+5) is handled in computeSkillPointBudget; this is the
      // per-level addition for L2+.
      if (isHumanParented(c) && newTotalLvl > 1) {  // v8.70.1: Human-parent Hybrids too
        spThisLevel += 1;
      }
      spComputed = true;
      // Note: the L1 5× multiplier applies only to the FIRST class taken.
      // Multiclassing in at L1 gets the standard per-level amount.
    }
  }
  return {
    feats: Math.max(0, featDelta),
    bumps: Math.max(0, bumpDelta),
    skillPoints: spComputed ? spThisLevel : 0,
  };
}

function lvlupCommit(skipBump) {
  const lu = _pendingLevelUp;
  if (!lu) return;
  const c = lu.char;
  const oldLvl = c.totalLvl;
  // Apply the class advancement
  let leveledClass = null, leveledTier = null, leveledLvl = 0;
  if (lu.choice.kind === 'advance') {
    const e = lu.choice.classRef;
    e.level = (e.level || 0) + 1;
    leveledClass = e.name; leveledTier = e.tier; leveledLvl = e.level;
  } else {
    c.classes.push({tier: lu.newClassTier, name: lu.newClassName, level: 1, first: false});
    leveledClass = lu.newClassName; leveledTier = lu.newClassTier; leveledLvl = 1;
    // Record Career Path GM exception if applicable
    if (lu.careerPathException) {
      if (!c.gmExceptions) c.gmExceptions = [];
      const target = `Class (Career Path): ${leveledClass} (Hero)`;
      if (!c.gmExceptions.find(e => e.target === target)) {
        c.gmExceptions.push({
          type:'class',
          target,
          missing:['Career Path rule: new Hero class taken after non-Hero levels'],
          grantedAt: new Date().toLocaleDateString(),
        });
      }
    }
    // v8.3.23: Record attrMin GM exception if applicable. The check on
    // lu.attrMinException was set during lvlupOnNewClassName.
    if (lu.attrMinException) {
      if (!c.gmExceptions) c.gmExceptions = [];
      const target = `Class (Attribute Prereq): ${leveledClass}`;
      if (!c.gmExceptions.find(e => e.target === target)) {
        c.gmExceptions.push({
          type:'class',
          target,
          missing:[`${leveledClass} requires ${lu.attrMinException.label}; character has ${lu.attrMinException.scoreStr}`],
          grantedAt: new Date().toLocaleDateString(),
        });
      }
    }
    // v8.39.0 (Career Compass): the pledged goal just became real. One toast
    // at the moment of first entry (new-class commits only — advancing an
    // already-owned goal class would re-fire every level); the Sheet panel
    // switches to its ACHIEVED state and offers Clear.
    if (lu.choice && lu.choice.kind === 'new' && c.careerGoal && leveledClass === c.careerGoal) {
      toast('🎉 Career goal achieved: ' + c.careerGoal + '!');
    }
    // v8.3.29: Record structured-prereq GM exception if applicable.
    // lu.prereqMiss is set during lvlupOnNewClassName.
    if (Array.isArray(lu.prereqMiss) && lu.prereqMiss.length > 0) {
      if (!c.gmExceptions) c.gmExceptions = [];
      const tierLabel = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[lu.newClassTier] || lu.newClassTier;
      const target = `${leveledClass} (${tierLabel})`;
      // Dedupe by target — but if the same class is taken multiple times
      // with different misses (unlikely), the existing entry's missing list
      // would already cover the first occurrence.
      if (!c.gmExceptions.find(e => e.target === target)) {
        c.gmExceptions.push({
          type:'class',
          target,
          missing: lu.prereqMiss.slice(),
          grantedAt: new Date().toLocaleDateString(),
        });
      }
    }
    // v8.3.32: Record ASCENSION GM exception if applicable. lu.ascensionNote
    // is set during lvlupOnNewClassName when a purely-Ordinary character takes
    // their first Hero class. This documents the Ordinary→Hero transition and
    // the GM-adjudicated heroic act that justified it. Distinct target prefix
    // ("Class (Ascension)") so it reads clearly in the Sheet's GM Exceptions
    // banner alongside Career Path / Attribute Prereq exceptions.
    if (lu.ascensionNote) {
      if (!c.gmExceptions) c.gmExceptions = [];
      const target = `Class (Ascension): ${leveledClass} (Hero)`;
      if (!c.gmExceptions.find(e => e.target === target)) {
        c.gmExceptions.push({
          type:'class',
          target,
          missing:[`Ordinary→Hero ascension — ${lu.ascensionNote}`],
          grantedAt: new Date().toLocaleDateString(),
        });
      }
    }
  }
  if (!Array.isArray(c.hpRolls)) c.hpRolls = [];
  c.hpRolls.push(lu.hpRoll);
  const conMPreBump = am(c.attrs[2]);
  // Apply attribute bump if chosen — BEFORE the HP math, so a Con bump
  // reaches the new die and back-fills the earlier ones (v9.15.2 §275 F5).
  if (!skipBump && lu.bumpChoice) {
    const idx = ATTR_NAMES.indexOf(lu.bumpChoice);
    if (idx >= 0) {
      c.attrs[idx] = (c.attrs[idx] || 10) + 1;
      if (!Array.isArray(c.attrBumps)) c.attrBumps = [];
      c.attrBumps.push(lu.bumpChoice);
    }
  }
  // v9.15.2 (§275 F5): HP uses the POST-bump Con mod and, when the bump
  // raised the modifier, back-fills +1 per EXISTING level — HH p.21 ("update
  // all the associated modifiers") + HH p.350 (Con applies to each hit die).
  // The incremental form (new die + Con delta × prior levels) equals the
  // form-save path's computeMaxHPFromRolls recompute when the rolls ledger
  // is complete, and stays correct for legacy records without full rolls.
  const conM = am(c.attrs[2]);
  const hpGain = Math.max(1, lu.hpRoll + conM) + (conM - conMPreBump) * (oldLvl || 0);
  c.maxHP += hpGain;
  c.currentHP = Math.min(c.currentHP + hpGain, c.maxHP);
  // Recompute derived stats from the (possibly updated) class array
  // v8.3.19: include heroic level (zeros AP at H0) and any fate points
  // permanently spent prior to this level-up.
  // v8.3.32: heroicLvl routed through effectiveHeroicLevelForAP — a character
  // who is still purely Ordinary after this level-up resolves to AP 0 via the
  // existing H0 guard. (Once they take a Hero level, they have an AP-bearing
  // class and the scenario's true Heroic Scale applies again.)
  const s = computeStatsFromClasses(
    c.classes,
    (c.attrs && c.attrs[5]) || 10,
    effectiveHeroicLevelForAP(c),
    c.fatePoints || 0
  );
  c.totalLvl = s.totalLvl;
  // v8.5.4: ECL incorporates the Mutant Level modifier, and XP-to-next keys
  // off ECL, both per GMG p.38 ("Total Experience Points Required by
  // Effective Character Level … incorporate racial level modifiers
  // (including Mutant levels)" + the drow worked example). Previously xpNext
  // keyed off class level only — a RAW deviation that under-charged race-LA
  // characters and ignored ML entirely. refreshEclXp also settles the
  // slope-rule XP compensation for ML thresholds crossed after creation.
  refreshEclXp(c);
  // v8.20.0: level gained — the Techsmith Mastercraft XP Reserve forfeits any
  // unspent balance and grants the new class level's 250 × level (HH p.140).
  reconcileMcReserve(c);
  c.bab = s.bab; c.def = s.def; c.fort = s.fort; c.ref = s.ref; c.will = s.will; c.rep = s.rep;
  c.apMax = s.ap; c.ap = c.apMax;
  // v8.67.0: level-up rebuilt bab/def — zero the Unnatural Prowess ledger
  // halves (HP is incremental at level-up, its ledger half stands) and
  // re-apply, so Mutant characters keep the subtype bonuses through gains.
  if (c.mutSubApplied) { c.mutSubApplied.bab = 0; c.mutSubApplied.def = 0; reconcileMutantSubtype(c); }
  // Refresh legacy slot mirrors so older code paths still work
  const heroEntry = c.classes.find(e => e.tier === 'hero');
  const basicEntry = c.classes.find(e => e.tier === 'basic');
  const advEntry = c.classes.find(e => e.tier === 'advanced');
  const presEntry = c.classes.find(e => e.tier === 'prestige');
  c.heroClass = heroEntry?.name || ''; c.heroLvl = heroEntry?.level || 0;
  c.basicClass = basicEntry?.name || ''; c.basicLvl = basicEntry?.level || 0;
  c.advClass = advEntry?.name || ''; c.advLvl = advEntry?.level || 0;
  c.presClass = presEntry?.name || ''; c.presLvl = presEntry?.level || 0;
  // v8.6.1: entering a class with entry-granted feats (Monk 1 → CMA/DMA)
  // writes them now, flagged grantedBy — no feat slot consumed.
  if (reconcileGrantedFeats(c)) {
    toast(`${leveledClass} grants class-entry feats — see the Feats tab.`);
  }
  reconcileTalentHp(c);  // v8.8.0: Robust's per-level HP grows with the level
  save();
  // Close modal, clear state
  document.getElementById('level-up-modal').classList.remove('open');
  _pendingLevelUp = null;
  // Log + toast
  logAct(`⬆ LEVELED UP — ${leveledClass} is now Level ${leveledLvl} (total Lvl ${c.totalLvl}). HP +${hpGain}.`);
  toast(`⬆ ${c.name} is now Level ${c.totalLvl}!`);
  // Refresh visible parts of the UI
  renderTracker();
  renderRoster();
  renderSheet();
  // Direct the player to wherever they next have business: feats tab if a
  // slot is owed, otherwise stay on sheet.
  // v8.52.0 (Session Zero polish, Xander build wrong-turn): the skills branch
  // used to be dead code — lvlupComputeOwedAfter hardcoded skillPoints: 0, so
  // no nudge ever fired and new points sat invisible behind collapsed skill
  // families. Now the REAL unspent total comes from the owed ledger, and the
  // toast carries a deep-link button that expands the class-skill families
  // before landing on the Skills page.
  const owed = lvlupComputeOwedAfter(c, oldLvl);
  if (owed.feats > 0) {
    setTimeout(() => {
      toast(`You earned ${owed.feats} new feat slot${owed.feats>1?'s':''} — heading to Feats tab.`);
      showPage('feats');
    }, 800);
  } else {
    let spUnspent = 0;
    try { spUnspent = computeSkillPointBudget(c) - skillPointsSpentOf(c); } catch (e) {}
    if (spUnspent > 0) {
      setTimeout(() => toastAction(`📚 ${spUnspent} skill point${spUnspent===1?'':'s'} to spend`, 'Open Skills →', goToSkillsForSpending), 800);
    }
  }
}

// v8.52.0: the deep-link target. Expands every collapsible family that holds
// at least one CLASS skill for the current character (where the fresh points
// most likely land — the Xander build's Knowledge-family wrong-turn), then
// opens the Skills page. Families the player has no class skills in keep
// their current state; nothing is force-collapsed.
function goToSkillsForSpending(){
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  try {
    for (const fam of COLLAPSIBLE_FAMILIES) {
      if (SKILLS.some(sk => sk.family === fam && isClassSkill(sk.n, c))) {
        skillFamilyCollapsed[fam] = false;
        skillFamilyToggled[fam] = true;
      }
    }
  } catch (e) {}
  showPage('skills');
  renderSkills();
}

// Post-commit version of lvlupComputeOwed that uses c.totalLvl (already
// advanced) and oldLvl. Lighter than the pre-commit version since we no
// longer need the per-class sp calc.
function lvlupComputeOwedAfter(c, oldLvl) {
  const featDelta = Math.floor(c.totalLvl/3) - Math.floor(oldLvl/3);
  const bumpDelta = Math.floor(c.totalLvl/4) - Math.floor(oldLvl/4);
  return {
    feats: Math.max(0, featDelta),
    bumps: Math.max(0, bumpDelta),
    skillPoints: 0,  // hard to recompute; surfaced via toast in commit instead
  };
}
function addCond(co){const c=chars.find(x=>x.id===curId);if(!c)return;if(!c.conditions)c.conditions=[];if(!c.conditions.includes(co)){c.conditions.push(co);save();renderConds(c);}}
function rmCond(co){const c=chars.find(x=>x.id===curId);if(!c||!c.conditions)return;c.conditions=c.conditions.filter(x=>x!==co);save();renderConds(c);}
function clearConds(){const c=chars.find(x=>x.id===curId);if(!c)return;c.conditions=[];save();renderConds(c);}
function addLogEntry(){const inp=document.getElementById('tr-log-inp'),t=inp.value.trim();if(!t)return;logAct(t);inp.value='';}

