// =============================================================================
// js/rules/hit-points-and-xp.js
// HIT POINTS AND XP — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Hit points (hero, random and max modes), XP thresholds and ECL
//   refreshes.
//
// KEY NAMES (so you can search for them)
//   functions (17): reconcileTalentHp, reconcileClassHp, rollHitDieForMode,
//   generateHpRolls, reconcileMissingHP, computeMaxHPFromRolls,
//   computeMaxHPFromClasses_LEGACY, computeMaxHPFromClasses, computeStats,
//   computeMaxHP, xpThreshold, computeXpProgress, reconcileMutantLevelXp,
//   refreshEclXp, reconcileConDamageHP, techsmithLvl, reconcileMcReserve
//
// WHERE IT CAME FROM
//   Gathered from js/app/55-mutations-engine.js, js/app/65-tracker-logs-and-
//   damage.js, js/app/66-xp-spending-and-level-up.js,
//   js/rules/14-resistances-speed-dr-size.js, js/rules/17-per-diem-and-
//   class-choices.js, js/rules/23-hit-points-xp-skills.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function reconcileTalentHp(c) {
  if (!c) return false;
  const expected = (((buildTalentBonuses(c) || {}).hp) || []).reduce((s, b) => s + (b.value || 0), 0);
  const applied = c.talentHpApplied || 0;
  if (expected !== applied && isFinite(c.maxHP)) {
    c.maxHP += expected - applied;
    if (expected > applied && isFinite(c.currentHP)) c.currentHP += expected - applied;
    c.talentHpApplied = expected;
    return true;
  }
  return false;
}
// v8.9.1: class-feature HP bakes — the Bodyguard's Toughness instances
// (@2, @8: +1 HP per CHARACTER level each, live-recomputed as levels grow).
// Ledger c.classHpApplied follows the talentHpApplied convention (NOT
// preserved on edit-save; re-applied onto the fresh maxHP).
function reconcileClassHp(c) {
  if (!c || !isFinite(c.maxHP)) return false;
  const bgLvl = migrateLegacyClasses(c).filter(e => e.name === 'Bodyguard').reduce((s, e) => s + (e.level || 0), 0);
  const instances = (bgLvl >= 8 ? 2 : (bgLvl >= 2 ? 1 : 0));
  let expected = instances * (c.totalLvl || 0);
  // v8.10.1: Loremaster "Secret health" pick — +3 flat HP.
  if (c.classChoices) for (const k in c.classChoices) {
    if (k.startsWith('lm_sec_') && /Secret health/.test(c.classChoices[k])) expected += 3;
  }
  const applied = c.classHpApplied || 0;
  if (expected !== applied) {
    c.maxHP += expected - applied;
    if (expected > applied && isFinite(c.currentHP)) c.currentHP += expected - applied;
    c.classHpApplied = expected;
    return true;
  }
  return false;
}


function rollHitDieForMode(hd, mode) {
  if (mode === 'max') return hd;
  if (mode === 'hero') {
    const half = Math.floor(hd / 2);
    // Hero's Hit Die: roll 1d(half) + half. Range = (half+1) .. (half+half) = hd.
    return half + Math.floor(Math.random() * half) + 1;
  }
  // 'random' (and unknown): roll 1dhd
  return Math.floor(Math.random() * hd) + 1;
}

// Generate a fresh hpRolls array for a class array at a chosen HP mode.
// Returns an array of per-level die values (Con mod added later at display time).
// rolls[0] is always max (first-level rule).
function generateHpRolls(classArr, mode) {
  classArr = classArr || [];
  const rolls = [];
  // Find which entry holds the "first level taken" flag; default to first valid entry
  let firstEntryIdx = classArr.findIndex(e => e.first && e.level > 0 && getClassEntry(e));
  if (firstEntryIdx < 0) firstEntryIdx = classArr.findIndex(e => e.level > 0 && getClassEntry(e));
  let didFirst = false;
  for (let i = 0; i < classArr.length; i++) {
    const e = classArr[i];
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      const isFirst = (i === firstEntryIdx && j === 0 && !didFirst);
      if (isFirst) {
        rolls.push(cls.hd);  // max for first level, regardless of mode
        didFirst = true;
      } else {
        rolls.push(rollHitDieForMode(cls.hd, mode));
      }
    }
  }
  return rolls;
}

// v8.6.0 C5 (Adam's ruling): a character record with missing/invalid HP data
// (imported, hand-built, or partially written — no such characters SHOULD
// exist, but the generator self-heals rather than render "undefined") gets
// AVERAGE HP assigned: the deterministic per-class formula (max first Hit
// Die, average thereafter) + BASE Con mod per level + the natural-AC ×5-HP
// rule — and is FLAGGED for GM override (c.hpAutoAssigned; the flag clears
// when the GM re-rolls via ⚙ HP Mode). Hooked into the Roster/Sheet/Tracker
// renders; idempotent (valid HP short-circuits).
function reconcileMissingHP(c) {
  if (!c) return false;
  const badMax = !(typeof c.maxHP === 'number' && isFinite(c.maxHP) && c.maxHP > 0);
  const badCur = !(typeof c.currentHP === 'number' && isFinite(c.currentHP));  // 0 is legit (dying)
  if (!badMax && !badCur) return false;
  if (badMax) {
    const classArr = migrateLegacyClasses(c);
    const conM = am((c.attrs || [10,10,10,10,10,10])[2]);
    const nac = (computeNaturalAC(c).total || 0);
    c.maxHP = Math.max(1, computeMaxHPFromClasses_LEGACY(classArr, conM) + nac * 5);
    c.hpAutoAssigned = { atDate: new Date().toLocaleDateString(), how: 'average Hit Dice + Con/level + natural AC ×5' };
  }
  if (badCur) c.currentHP = c.maxHP;
  else c.currentHP = Math.min(c.currentHP, c.maxHP);
  return true;
}

// Compute total max HP from a hpRolls array + a class array (for Con mod
// per level). If hpRolls is missing/empty, falls back to the deterministic
// formula used in v8.2.2 and earlier — preserves legacy character values.
function computeMaxHPFromRolls(classArr, hpRolls, conMod) {
  classArr = classArr || [];
  const hasRolls = Array.isArray(hpRolls) && hpRolls.length > 0;
  if (!hasRolls) {
    return computeMaxHPFromClasses_LEGACY(classArr, conMod);
  }
  // Sum: die-roll values from hpRolls + Con mod for each level
  let hp = 0;
  let rollIdx = 0;
  for (let i = 0; i < classArr.length; i++) {
    const e = classArr[i];
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      hp += (hpRolls[rollIdx] || 0) + conMod;
      rollIdx++;
    }
  }
  if (hp === 0) hp = 8 + conMod; // base humanoid 1d8 + Con if no class set
  return Math.max(1, hp);
}

// Legacy formula preserved for backward compat with pre-v8.2.3 characters
// that have no c.hpRolls. New characters use generateHpRolls + the rolls-aware
// computeMaxHPFromRolls above.
function computeMaxHPFromClasses_LEGACY(classArr, conMod) {
  classArr = classArr || [];
  let hp = 0;
  let firstEntryIdx = classArr.findIndex(e => e.first && e.level > 0 && getClassEntry(e));
  if (firstEntryIdx < 0) firstEntryIdx = classArr.findIndex(e => e.level > 0 && getClassEntry(e));
  let didFirst = false;
  for (let i = 0; i < classArr.length; i++) {
    const e = classArr[i];
    const cls = getClassEntry(e);
    if (!cls) continue;
    const lvl = Math.max(0, e.level || 0);
    for (let j = 0; j < lvl; j++) {
      const useMax = (i === firstEntryIdx && j === 0 && !didFirst);
      hp += useMax ? cls.hd : Math.floor(cls.hd / 2) + 1;
      hp += conMod;
      if (useMax) didFirst = true;
    }
  }
  if (hp === 0) hp = 8 + conMod;
  return Math.max(1, hp);
}

// Compute max HP given hit dice from a class array. The "first" entry's first level uses the max die;
// every subsequent level uses the class's average die value for predictability.
// `first` is determined by either the explicit {first:true} flag on an entry, or the first non-empty
// entry encountered if no flag exists.
//
// v8.2.3: This function is preserved for callers that DON'T have a hpRolls
// array available (e.g., the in-form preview before save). It uses the legacy
// formula. Saved characters route through computeMaxHPFromRolls() instead,
// which consumes the stored per-level rolls.
function computeMaxHPFromClasses(classArr, conMod) {
  return computeMaxHPFromClasses_LEGACY(classArr, conMod);
}
// LEGACY WRAPPERS — keep existing 8/9-arg call sites working until they're migrated.
// These translate the old (heroClass, heroLvl, basicClass, basicLvl, advClass, advLvl, presClass, presLvl[, conMod])
// signature into a class array and delegate.
function computeStats(heroClassName, heroLvl, basicClassName, basicLvl, advClassName, advLvl, presClassName, presLvl) {
  const arr = [];
  if (heroClassName && heroLvl > 0) arr.push({tier:'hero', name:heroClassName, level:heroLvl, first:true});
  if (basicClassName && basicLvl > 0) arr.push({tier:'basic', name:basicClassName, level:basicLvl, first:!arr.length});
  if (advClassName && advLvl > 0) arr.push({tier:'advanced', name:advClassName, level:advLvl, first:!arr.length});
  if (presClassName && presLvl > 0) arr.push({tier:'prestige', name:presClassName, level:presLvl, first:!arr.length});
  const s = computeStatsFromClasses(arr);
  // Add legacy hL/bL/aL/pL aliases for back-compat
  return Object.assign({}, s, {hL:s.heroLvl, bL:s.basicLvl, aL:s.advLvl, pL:s.presLvl});
}
function computeMaxHP(heroClassName, heroLvl, basicClassName, basicLvl, advClassName, advLvl, presClassName, presLvl, conMod) {
  const arr = [];
  if (heroClassName && heroLvl > 0) arr.push({tier:'hero', name:heroClassName, level:heroLvl, first:true});
  if (basicClassName && basicLvl > 0) arr.push({tier:'basic', name:basicClassName, level:basicLvl, first:!arr.length});
  if (advClassName && advLvl > 0) arr.push({tier:'advanced', name:advClassName, level:advLvl, first:!arr.length});
  if (presClassName && presLvl > 0) arr.push({tier:'prestige', name:presClassName, level:presLvl, first:!arr.length});
  return computeMaxHPFromClasses(arr, conMod);
}

function xpThreshold(level) {
  const L = Math.max(1, Math.floor(level));
  return 1000 * L * (L - 1) / 2;
}

// v8.3.1 (Issue 1 fix): XP progress within the CURRENT level's band, not
// cumulative from zero. The character at totalLvl L is currently in the band
// [xpThreshold(L) .. xpThreshold(L+1)). Returns:
//   - pct:      percentage progress within the band (0-100)
//   - inLevel:  XP earned since becoming this level
//   - bandSize: total XP needed for this level (xpNext − xpFloor)
//   - xpFloor:  lower threshold (XP at which they became this level)
//   - xpNext:   upper threshold (XP needed to reach the next level)
//
// Designed for Epic-level compatibility (level 21+) — no hard ceiling.
function computeXpProgress(c) {
  // v8.5.4: bands key off ECL, not class level (GMG p.38 — thresholds are by
  // Effective Character Level, incl. race LA and Mutant Level). A character
  // whose XP sits below the current-ECL floor (a fresh LA/Mutant character
  // starts at 0 XP inside a wider first band, per the p.38 drow example)
  // gets the floor slid down to their XP so the bar renders continuous
  // progress toward the next threshold.
  const ecl = Math.max(1, c.ecl || c.totalLvl || 1);
  const xpNext = xpThreshold(ecl + 1);
  const xpFloor = Math.min(xpThreshold(ecl), c.xp || 0);
  const bandSize = Math.max(0, xpNext - xpFloor);
  const inLevel = Math.max(0, (c.xp || 0) - xpFloor);
  const pct = bandSize > 0 ? Math.max(0, Math.min(100, Math.round(inLevel / bandSize * 100))) : 100;
  return {pct, inLevel, bandSize, xpFloor, xpNext};
}

// v8.5.4: ML → ECL XP compensation (Adam's slope-only ruling, 2026-08-24).
// GMG p.38 keys XP thresholds off ECL — "incorporate racial level modifiers
// (including Mutant levels)" — which would make a mid-career Mutant Level
// gain an instant cliff: the next class level suddenly costs a full ECL-step
// more. Ruling: each ML threshold crossed AFTER character creation grants
// the immediate threshold gap (1,000 × (ECL+1) XP — the quadratic step),
// converting the cliff into the gentle career-long slope the p.38 drow
// example describes. Creation-time ML is the uncompensated baseline (chosen
// knowingly, like a drow's race LA). No clawback: if MP sources are later
// removed, granted XP stays — c.mlXpCompensatedTo only ratchets up.
function reconcileMutantLevelXp(c) {
  if (!c) return;
  const ml = getMPState(c).mutantLevel;
  if (typeof c.mlXpCompensatedTo !== 'number') {
    // First reconcile for this character (creation save, or first touch of a
    // pre-v8.5.4 character): current ML becomes the baseline, no grant.
    c.mlXpCompensatedTo = ml;
    return;
  }
  if (ml <= c.mlXpCompensatedTo) return;
  const raceEcl = raceEclOf(c);  // v8.68.0: Hybrid-aware
  let grant = 0;
  for (let k = c.mlXpCompensatedTo + 1; k <= ml; k++) {
    const eclBefore = (c.totalLvl || 1) + raceEcl + (k - 1);
    grant += xpThreshold(eclBefore + 2) - xpThreshold(eclBefore + 1); // = 1000 × (eclBefore + 1)
  }
  c.xp = (c.xp || 0) + grant;
  c.mlXpCompensatedTo = ml;
  logActionEvent(c, 'xp-grant', grant, 'Mutation milestone',
    `Mutant Level rose to +${ml} — ECL increased; +${grant.toLocaleString()} XP compensation (slope rule, GMG p.38)`);
  toast(`Mutation milestone: Mutant Level +${ml} — ECL rises, +${grant.toLocaleString()} XP granted.`);
}

// v8.5.4: the canonical ECL/XP refresh — single source for every site that
// recomputes a character's level-derived fields. Settles ML compensation
// first (so any threshold crossing is granted before ECL is read), then keys
// ECL and XP-to-next off the full GMG p.38 formula.
function refreshEclXp(c) {
  if (!c) return;
  reconcileMutantLevelXp(c);
  // v9.15.2 (§275 F3): records without a stamped c.totalLvl (imports,
  // hand-built) derive it from the class array — HH p.22 keys ECL off class
  // levels earned, not off whether a save path has run yet.
  const _lvl = c.totalLvl || migrateLegacyClasses(c).reduce((s, e) => s + (e.level || 0), 0) || 1;
  c.ecl = _lvl + (raceEclOf(c)) + getMPState(c).mutantLevel;  // v8.68.0: Hybrid RLM (A+B+1, or the GM override)
  c.xpNext = xpThreshold(c.ecl + 1);
}
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
