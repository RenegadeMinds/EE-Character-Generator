// =============================================================================
// js/rules/23-hit-points-xp-skills.js
// HIT POINTS XP SKILLS
// =============================================================================
//
// WHAT'S IN HERE
//   Hit points (hero / random / max modes, rolls), the XP table, and the
//   master SKILLS list.
//
// KEY NAMES (so you can search for them)
//   tables/objects: HP_MODES, XP_TBL, SKILLS, TOOLKIT_DEPENDENT_SKILLS,
//   INSTRUMENT_PERFORMS
//   functions (11): rollHitDieForMode, generateHpRolls, reconcileMissingHP,
//   computeMaxHPFromRolls, computeMaxHPFromClasses_LEGACY,
//   computeMaxHPFromClasses, computeStats, computeMaxHP, xpThreshold,
//   computeXpProgress, skillNeedsToolkit
//
// LOAD ORDER
//   File 23 of 68. index.html loads it after js/rules/22-career-compass.js and
//   before js/rules/24-synergies-class-skills-citations.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 17634-17952 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 17634-17952; unchanged below this line ----
// ========== HIT POINTS (v8.2.3) ==========
// HP generation has three modes per HH p.84-ish (and the (d_/+_) parenthetical
// in every class entry):
//   - 'random':  roll 1dHD per level (full die)
//   - 'hero':    roll 1d(HD/2) + (HD/2) per level — the "Hero's Hit Die" rule.
//                Average is half a point higher than random, variance is halved.
//                Heroes never roll a 1 on their hit die. House default.
//   - 'max':     take HD per level (no roll)
//
// The first level (the very first level of the first class taken) ALWAYS takes
// the max die value, across all three modes. This matches d20-lineage convention.
//
// Per-level rolls are stored on c.hpRolls so they don't re-randomize across
// renders. Each entry is the die-only value (Con mod added at compute time).
// hpRolls[0] = first-level max value.
const HP_MODES = ['hero', 'random', 'max'];

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
// v8.3.1: XP thresholds. The handbook table (HH p.~50) lists ECL 1-20 with
// thresholds 0, 1000, 3000, 6000, ..., 190000 — a factorial pattern where
// advancing FROM level L to L+1 costs L × 1000 XP. This pattern extends
// indefinitely for Epic levels (21+) in 3.5-lineage games:
//   L21 floor = 210,000 (band L20→L21 costs 20,000 XP)
//   L22 floor = 231,000 (band L21→L22 costs 21,000 XP)
//   L23 floor = 253,000 (band L22→L23 costs 22,000 XP)
//   ...
//
// DxD20 doesn't yet codify Epic rules but is back-compatible to 3.5, so we
// design forward: xpThreshold(L) returns the cumulative XP at which the
// character becomes level L, for any L ≥ 1.
//
// Formula: threshold(L) = 1000 × L × (L−1) / 2
//   = 1000 × triangular_number(L−1)
//
// XP_TBL is retained as a 20-entry array for any caller that indexes into
// it directly (backward-compat) but new code should call xpThreshold().
const XP_TBL=[0,1000,3000,6000,10000,15000,21000,28000,36000,45000,55000,66000,78000,91000,105000,120000,136000,153000,171000,190000];

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
// v8.35.0 (Adam): the QUICKDRAW rows const removed with the table — the
// digital form applied its sorted rows straight down STR→CHA, biasing every
// Quickdraw hero toward Strength. The table remains in the book, where the
// player assigns the six scores freely.

// SKILLS — full expanded list including subcategories
const SKILLS = [
  {n:'Appraise',k:'INT'},{n:'Autohypnosis',k:'WIS',req:'Psionic 1'},
  {n:'Balance',k:'DEX'},{n:'Bluff',k:'CHA'},{n:'Climb',k:'STR'},
  {n:'Computer Use',k:'INT',req:'Tech 5'},{n:'Concentration',k:'CON'},
  // Craft family
  {n:'Craft (Armorsmithing)',k:'INT',family:'Craft'},{n:'Craft (Bowmaking)',k:'INT',family:'Craft'},
  {n:'Craft (Chemical)',k:'INT',family:'Craft'},{n:'Craft (Electronics)',k:'INT',family:'Craft',req:'Tech 5'},
  {n:'Craft (Mechanical)',k:'INT',family:'Craft'},{n:'Craft (Pharmaceutical)',k:'INT',family:'Craft'},
  {n:'Craft (Structural)',k:'INT',family:'Craft'},{n:'Craft (Trapmaking)',k:'INT',family:'Craft'},
  {n:'Craft (Visual Arts)',k:'INT',family:'Craft'},{n:'Craft (Weaponsmithing)',k:'INT',family:'Craft'},
  {n:'Craft (Writing)',k:'INT',family:'Craft'},
  {n:'Decipher Code',k:'INT'},{n:'Demolitions',k:'INT'},{n:'Diplomacy',k:'CHA'},
  {n:'Disable Device',k:'INT'},{n:'Disguise',k:'CHA'},{n:'Drive',k:'DEX',req:'Tech 3'},
  {n:'Escape Artist',k:'DEX'},{n:'Forgery',k:'INT'},{n:'Gamble',k:'WIS'},
  {n:'Gather Information',k:'CHA'},{n:'Handle Animal',k:'CHA'},{n:'Hide',k:'DEX'},
  {n:'Intimidate',k:'CHA'},{n:'Investigate',k:'INT'},{n:'Jump',k:'STR'},
  // Knowledge family
  {n:'Knowledge (Arcane Lore)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Architecture & Engineering)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Art)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Behavioral Sciences)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Business)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Civics)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Current Events)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Dungeoneering)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Earth & Life Sciences)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Geography)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (History)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Local)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Nature)',k:'INT',family:'Knowledge',req:'Tech 0'},{n:'Knowledge (Nobility & Royalty)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Physical Sciences)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Popular Culture)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Psionics)',k:'INT',family:'Knowledge',req:'Psionic 1'},{n:'Knowledge (Religion)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Streetwise)',k:'INT',family:'Knowledge',req:'Tech 0'},{n:'Knowledge (Tactics)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Technology)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (The Planes)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Theology & Philosophy)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Listen',k:'WIS'},{n:'Move Silently',k:'DEX'},{n:'Navigate',k:'INT'},
  // Perform family
  {n:'Perform (Act)',k:'CHA',family:'Perform'},{n:'Perform (Comedy)',k:'CHA',family:'Perform'},
  {n:'Perform (Dance)',k:'CHA',family:'Perform'},{n:'Perform (Keyboard Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Oratory)',k:'CHA',family:'Perform'},{n:'Perform (Percussion Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Sing)',k:'CHA',family:'Perform'},{n:'Perform (String Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Wind Instruments)',k:'CHA',family:'Perform'},
  {n:'Pilot',k:'DEX',req:'Tech 3'},
  // Profession family — one entry per Starting Occupation, plus a catch-all.
  // The corresponding occupation's Profession is auto-marked as a class skill
  // via isClassSkill() based on the character's c.occ value.
  {n:'Profession (Academic)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Adventurer)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Apothecary)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Astronaut Trainee)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Athlete)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Blue Collar)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Celebrity)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Colonist)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Creative)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Criminal)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Dilettante)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Doctor)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Drifter)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Emergency Services)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Entrepreneur)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Gladiator)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Hedge Wizard)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Heir)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Investigative)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Law Enforcement)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Military)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Novitiate)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Outcast)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Psychic)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Religious)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Rural)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Scavenger)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Squire)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Student)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Technician)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Transporter)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (White Collar)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Other)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Psicraft',k:'INT',req:'Psionic 1'},
  {n:'Read/Write/Speak Language',k:'INT'}, // language tracking handled separately
  {n:'Repair',k:'INT',req:'Tech 1'},{n:'Research',k:'INT'},{n:'Ride',k:'DEX'},
  {n:'Search',k:'INT'},{n:'Sense Motive',k:'WIS'},{n:'Sleight of Hand',k:'DEX'},
  {n:'Spellcraft',k:'INT',req:'Arcane/Divine 1'},{n:'Spot',k:'WIS'},{n:'Survival',k:'WIS'},
  {n:'Swim',k:'STR'},{n:'Treat Injury',k:'WIS'},{n:'Tumble',k:'DEX'},
  {n:'Use Magic Device',k:'CHA',req:'Arcane/Divine 1'},{n:'Use Psionic Device',k:'CHA',req:'Psionic 1'},
  {n:'Use Rope',k:'DEX'},
];

// v8.5.1: skills that MAY suffer a penalty (up to -4) without the appropriate
// tool/skill kit, per the HH skill->kit map (p.301) and kit descriptions. This
// is an advisory marker only — the penalty is applied at play time, and the
// equipment substrate's kit catalogue (equipment_items.json "required" entries)
// is the source of truth. The Craft family is toolkit-dependent as a whole
// (artisan's tools / electrical / mechanical kits).
// v9.1.0 (Adam 2026-10-06): Demolitions joins (−4 without a demolitions
// kit); Craft (Writing) needs no kit (no HH kit exists for it — before
// v9.1.0 any Artisan's tools quietly 'satisfied' it).
const TOOLKIT_DEPENDENT_SKILLS = new Set(['Demolitions','Disable Device','Disguise','Forgery','Repair','Treat Injury']);
// v9.1.0 (Adam 2026-10-06): instrument Performs need an instrument (Sing,
// Oratory, Act, Comedy, Dance don't).
const INSTRUMENT_PERFORMS = new Set(['Perform (Keyboard Instruments)','Perform (Percussion Instruments)','Perform (String Instruments)','Perform (Wind Instruments)']);
function skillNeedsToolkit(sk){ return (sk.family === 'Craft' && sk.n !== 'Craft (Writing)') || TOOLKIT_DEPENDENT_SKILLS.has(sk.n) || INSTRUMENT_PERFORMS.has(sk.n); }

