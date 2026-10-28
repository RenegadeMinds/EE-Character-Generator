// =============================================================================
// js/ui/tracker/class-abilities.js
// TRACKER / CLASS ABILITIES — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: per-day class abilities, rage, battle focus,
//   bardic music and talent actions.
//
// KEY NAMES (so you can search for them)
//   functions (14): toggleEuphoric, adjustAbilityUse, renewAbility,
//   toggleRage, clearFatigue, fullyRested, renderPerDiem, renderBattleFocus,
//   toggleBattleFocus, expendBattleFocus, renderTalentActions,
//   renderCombatOptions, renderBardicMusic, renderElementalist
//
// WHERE IT CAME FROM
//   Gathered from js/app/56-supernatural-attributes-pools-psi-focus.js,
//   js/app/64-tracker.js, js/rules/09-item-effects-and-buffs.js,
//   js/rules/17-per-diem-and-class-choices.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function toggleEuphoric() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const b = euphoriacBonus(c); if (!b) return;
  c.euphoric = !c.euphoric;
  logAct(c.euphoric
    ? `⚡ EUPHORIC — wild surge rush: +${b} morale on attack, damage, and saves for (surge intensity) rounds. (Not if neuralgia struck.)`
    : '⚡ Euphoria fades.');
  save(); renderSheet(); renderGear(); renderSkills();
}
function adjustAbilityUse(key, delta) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  if (!c.abilityUses) c.abilityUses = {};
  const specs = computePerDiemAbilities(c);
  const spec = specs.find(s => s.key === key); if (!spec) return;
  const cur = abilityUsed(c, key);
  const next = Math.max(0, cur + delta);
  if (delta > 0 && cur >= spec.max) {
    if (!confirm(`${spec.name}: all ${spec.max} ${spec.kind === 'pool' ? 'points' : 'uses'} are spent. Record another anyway (GM exception)?`)) return;
  }
  c.abilityUses[key] = next;
  save(); renderPerDiem(c);
}
function renewAbility(key) {
  const c = chars.find(x => x.id === curId); if (!c || !c.abilityUses) return;
  const spec = computePerDiemAbilities(c).find(s => s.key === key);
  c.abilityUses[key] = 0;
  logAct(`↻ ${spec ? spec.name : key} renewed (GM override — partial rejuvenation).`);
  save(); renderPerDiem(c);
}

// ---- RAGE state machine (Adam: full toggle with baked modifiers) ----------
function toggleRage() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const t = rageTier(c); if (!t) return;
  if (!c.raging) {
    const spec = { max: rageUsesPerDay(c) };
    const used = abilityUsed(c, 'rage');
    if (used >= spec.max && !confirm(`Rage: all ${spec.max} daily uses are spent. Rage anyway (GM exception)?`)) return;
    c.raging = true;
    c.fatigued = false;
    if (!c.abilityUses) c.abilityUses = {};
    c.abilityUses.rage = used + 1;
    const conRaged = am(effAttrs(c)[2]);
    logAct(`🔥 ${t.name.toUpperCase()}! +${t.attr} Str/Con, +${t.will} morale Will, −2 AC — ${3 + conRaged} rounds (3 + raged Con mod).`);
  } else {
    c.raging = false;
    // Tireless @17, or Bloodluster Perfect Storm @10 (no fatigue even from
    // a Greater Rage; a lesser Bloodluster may still try Concentration DC 20).
    const tireless = berserkerLvl(c) >= 17 || (bloodlusterLvl(c) >= 10);
    if (!tireless) {
      c.fatigued = true;
      if (!c.conditions) c.conditions = [];
      if (!c.conditions.includes('Fatigued')) c.conditions.push('Fatigued');
      logAct('Rage ends — FATIGUED (−2 Str, −2 Dex, no charge/run) for the encounter.');
    } else {
      logAct('Rage ends — Tireless Rage: no fatigue.');
    }
  }
  save(); renderSheet(); renderGear(); renderSkills();
  if (curId) { const p = document.getElementById('tr-content'); if (p && p.style.display !== 'none') renderTracker(); }
}
function clearFatigue() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.fatigued = false;
  if (c.conditions) c.conditions = c.conditions.filter(x => x !== 'Fatigued');
  logAct('Fatigue recovered (encounter over / 8 hours rest).');
  save(); renderSheet(); renderGear(); renderSkills();
}

// "New day" across everything at once: every caster pool rests (PP refilled,
// prepared lists re-memorized), the super-PP pool refills. AP do NOT refresh
// — those only return on level-up (Adam's ruling, 2026-06).
function fullyRested() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const stats = computeCasterStats(c);
  for (const poolName of ['arcane', 'divine', 'psionic']) {
    if (stats[poolName] && stats[poolName].contributors.length) restPP(poolName);
  }
  const mpSt = getMPState(c);
  if (mpSt.isSuperMutant) c.superPPCurrent = getSuperPPState(c).max;
  // v8.8.2 (Adam's AMENDED ruling, 2026-09-02 — supersedes rest = PP only):
  // Rest also restores per-diem class-ability uses to their defaults.
  // Per-WEEK abilities (Remove Disease, Quivering Palm) keep their count —
  // renew those individually via the GM ↻. 8 hours' rest clears fatigue.
  if (c.abilityUses) {
    const weekly = new Set((computePerDiemAbilities(c)).filter(s => s.weekly).map(s => s.key));
    for (const k of Object.keys(c.abilityUses)) if (!weekly.has(k)) c.abilityUses[k] = 0;
  }
  if (c.fatigued) { c.fatigued = false; if (c.conditions) c.conditions = c.conditions.filter(x => x !== 'Fatigued'); }
  if (c.raging) c.raging = false;
  // v8.21.0: a rested psionic character trivially re-gathers their focus
  // (one quiet full-round action) — start the day focused, unless the
  // Second Skin still holds it.
  if (isPsiFocusCapable(c) && !psiFocusLocked(c) && !c.psiFocused) {
    c.psiFocused = true;
    logActionEvent(c, 'psi-focus', 0, 'Focus gained', 'Psionic focus regained with the new day (Fully Rested).');
  }
  // v8.13.0 (Adam's ruling): armor does NOT heal — except armor with the
  // Self-Repairing gadget (1 HP/min, HH p.~280), fully restored over the
  // course of the evening. Destroyed armor is past what nanites can fix.
  const selfRepaired = [];
  for (const it of getCharItems(c)) {
    const g = armorItemIntegrity(it);
    if (g && g.selfRepairing && !g.destroyed && g.damage > 0) {
      it.armorDamage = 0;
      selfRepaired.push(enchantDisplayName(it));
    }
  }
  logAct('Fully Rested — new day: all PP pools refilled, prepared spells re-memorized, daily class-ability uses restored (weekly abilities untouched), fatigue cleared.' + (selfRepaired.length ? ` Self-Repairing armor fully restored overnight: ${selfRepaired.join(', ')}.` : ''));
  save(); renderPowers();
  renderPPRecovery(c);  // Tracker panel (C4)
  renderPerDiem(c);
  renderArmorIntegrity(c);
  renderSheet();
  toast('Fully rested — new day. PP + daily ability uses restored.' + (selfRepaired.length ? ' Self-Repairing armor restored.' : ''));
}

// v8.8.2: Tracker per-diem ability panel — one row per ability with use/undo
// and the per-ability GM ↻ renew (Adam's partial-rejuvenation ruling).
function renderPerDiem(c) {
  const host = document.getElementById('tr-perdiem');
  if (!host) return;
  const specs = computePerDiemAbilities(c);
  if (!specs.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  host.innerHTML = `<div class="font-serif fs-10 c-bronze mb-4">Class Abilities <span class="c-g45 fs-9 normal-case ls-0">· ☀ Fully Rested restores daily; ↻ = GM renew (single ability)</span></div>`
    + specs.map(s => {
      const used = abilityUsed(c, s.key);
      const left = Math.max(0, s.max - used);
      const low = left === 0;
      return `<div class="items-center gap-6 fs-11_5 m-2-0" style="display:flex;">
        <span class="flex-1 cursor-help" title="${escapeHTML(s.note || '')}">${s.name}${s.weekly ? ' <span class="op-0_55 fs-9">(per week)</span>' : ''}</span>
        <b style="color:${low ? 'var(--red-text)' : 'rgb(var(--text-sky) / .95)'};">${left}</b><span class="o-55 c-dim">/${s.max}${s.kind === 'pool' ? ' pts' : ''}</span>
        <button class="fs-10 p-0-6 btn btn-sm" title="Spend one ${s.kind === 'pool' ? 'point' : 'use'}" onclick="adjustAbilityUse('${s.key}',1)">−</button>
        <button class="fs-10 p-0-6 btn btn-sm" title="Undo a spent ${s.kind === 'pool' ? 'point' : 'use'}" onclick="adjustAbilityUse('${s.key}',-1)">+</button>
        <button class="fs-10 p-0-6 op-0_7 btn btn-sm" title="GM renew: reset ${s.name} alone (a rejuvenating roleplay event short of a full rest)" onclick="renewAbility('${s.key}')">↻</button>
      </div>`;
    }).join('');
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
    <div style="margin-top:10px;padding:8px 10px;background:rgb(var(--tint-black) / .2);border:1px solid rgb(var(--line-gold) / .2);border-left:2px solid ${focused ? 'rgb(var(--line-blue))' : 'rgb(var(--line-gold) / .3)'};border-radius:2px;">
      <div class="justify-between items-center mb-4" style="display:flex;">
        <span class="font-serif fs-10 c-bronze">Battle Focus (Psionic 0 variant) &middot; modifier +${mod}</span>
        <span style="font-family:'Epics Serif','Cinzel',serif;font-size:12px;font-weight:600;color:${focused ? 'rgb(var(--text-blue))' : 'var(--g45)'};">${focused ? '◉ FOCUSED' : '○ unfocused'}</span>
      </div>
      <div class="fs-10_5 c-g70 lh-1_45 mb-6">
        ${focused
          ? `While focused: <b class="c-gold">+${passive}</b> to hit, damage, dodge, and parry (half of +${mod}, rounded up). Expend the focus for the full <b class="c-gold">+${mod}</b> on any single roll.`
          : `Gain psionic focus (see Concentration) to receive +${passive} to hit, damage, dodge, and parry — or expend it for +${mod} on a single roll.`}
      </div>
      <div class="gap-6" style="display:flex;">
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
  const card = (name, body, tip) => cards.push(`<div class="p-4-0" style="border-bottom:1px solid rgb(var(--line-gold) / .08);" title="${escapeHTML(tip || '')}"><b class="cursor-help" style="color:rgb(var(--text-amber) / .9);">${name}</b> — ${body}</div>`);
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
  const chip = (name, body, tip) => `<span class="nowrap cursor-help" style="display:inline-block;margin:1px 10px 1px 0;" title="${escapeHTML(tip)}"><b class="c-tc85">${name}</b> <span class="op-0_8">${body}</span></span>`;
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
  const gH = (t) => `<div class="mt-5 bold" style="color:rgb(var(--text-amber) / .9);">${t}</div>`;
  host.innerHTML = [
    host.innerHTML,
    chip('Grapple', `d20 ${gr ? (gr.total >= 0 ? '+' : '') + gr.total : '+ mods'} — special modifiers &amp; options; see details below`, `Grapple check = d20 + BAB + Str mod + special size modifier (±4 per size step)${impGrap ? ' + Improved Grapple +4' : ''}${gr ? `. Yours: ${gr.parts.join(' · ')}.` : '.'} The full start-a-grapple sequence, in-grapple actions, pins, and multi-grappler rules are in the Grappling Rules Summary directly below.`),
  ].join('');
  host.innerHTML += `
    <details class="mt-6 hy-det"><summary>Grappling Rules Summary (HH pp.372–374)${gr ? ` · your check: d20 ${gr.total >= 0 ? '+' : ''}${gr.total}` : ''}</summary>
    <div class="lh-1_55 fs-11 c-tx85" style="padding:4px 0 2px 14px;">
      <b>The check:</b> 1d20 + base attack bonus + Str modifier + special size modifier — "a grapple check is like a melee attack roll." Special size modifier: Colossal +16, Gargantuan +12, Huge +8, Large +4, Medium +0, Small −4, Tiny −8, Diminutive −12, Fine −16 (±4 per step, in place of the normal attack-roll size modifier).${gr ? ` <span class="c-tc85">Yours: ${gr.parts.join(' · ')}.</span>` : ''}
      ${gH('Starting a grapple (standard action — one attempt per iterative, at successively lower BA)')}
      <b>1. AoO:</b> the target gets an attack of opportunity against you${impGrap ? ' — <span class="c-tc85">waived: you have Improved Grapple (+4 on all grapple checks, already in your total)</span>' : ' (waived by Improved Grapple)'}; if it deals damage, the attempt fails.<br>
      <b>2. Grab:</b> melee touch attack; miss = fail.<br>
      <b>3. Hold:</b> opposed grapple check (free action); win = you are grappling and deal unarmed-strike damage. You automatically lose vs a target two or more size categories larger. Ties go to the higher modifier.<br>
      <b>4. Maintain:</b> move into the target's space (free movement — provokes from OTHER threateners, never the target). Can't move in → you must let go.
      ${gH('While grappling (both of you)')}
      You threaten no hexes · you lose your Dex bonus to AC against opponents you are NOT grappling · no normal movement. Each of the following takes the place of ONE attack (iteratives apply):
      <b>Attack</b> with unarmed strike, natural weapon, or LIGHT weapon at −4 (never two weapons) · <b>Damage</b> via opposed check — unarmed-strike nonlethal (−4 on the check to make it lethal) · <b>Pin</b> via opposed check (1 round) · <b>Escape</b> via opposed check — or an Escape Artist check${eaRanks ? ` <span class="c-tc85">(your ranks: ${eaRanks})</span>` : ''} as a standard action; you must beat EVERY holder, then finish adjacent · <b>Move</b> half speed, everyone comes along (standard action, beat all; +4 to move a lone PINNED opponent) · <b>Draw a light weapon</b> (move action + check) · <b>Use the opponent's light weapon</b> (opposed check, then attack at −4; no possession) · <b>Break another's pin</b> (opposed check) · <b>Cast/manifest</b> only ≤ 1 standard action, no somatic components, materials in hand, Concentration DC 20 + spell level · activate non-spell-completion magic items and retrieve a component (full round) freely.
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
    return `<div style="margin:3px 0;${ok ? '' : 'opacity:.45;'}cursor:help;" title="${escapeHTML(tip + (ok ? '' : ` LOCKED — needs ${ranksReq} Perform ranks (your best: ${perf}).`))}"><b style="color:rgb(var(--text-ice) / ${ok ? '.9' : '.5'});">${name}</b> <span class="op-0_85">${body}${ok ? '' : ` <i class="fs-10">(needs ${ranksReq} ranks)</i>`}</span></div>`;
  };
  const rows = [`<div class="fs-10_5 c-g60 mb-5">${brd} uses/day (${used} used — the ☀ per-diem panel tracks them) · best Perform: ${escapeHTML(perfName)} ${perf} ranks · starting a performance is a standard action; no spellcasting or spell-trigger/completion items while performing; a deaf Bard fails 20% of attempts (the use is still spent).</div>`];
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
  if (!vn) { host.innerHTML = `<div class="fs-11" style="color:rgb(var(--text-amber));">Choose the Elemental Focus in 🎓 Class Choices (Sheet) — every attack form keys off the variant.</div>`; return; }
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
  const card = (name, body, tip) => `<div class="m-3-0 cursor-help" title="${escapeHTML(tip)}"><b style="color:rgb(var(--text-orange) / .95);">${name}</b> <span class="op-0_85">${body}</span></div>`;
  const rows = [`<div class="fs-10_5 c-g60 mb-5">${vn} · Elementalist ${ele} — all forms are AT-WILL (Su)${greater ? ' · Greater Elemental Adaptation active (7th)' : ''}. The Nimbus (1${ele >= 8 ? '-2' : ''}/day or 1 AP) is on the ☀ per-diem panel.</div>`];
  rows.push(card('Elemental Fist', `move action to invoke — ${V.fist}`, 'GMG p.165: the element engulfs your hand (harmless to you); your unarmed attack counts as ARMED. Also shown as an alt mode on the Gear tab’s unarmed row.'));
  if (ele >= 2) rows.push(card(vn === 'Vitrolian' ? 'Elemental Bolt (rider)' : 'Elemental Bolt', `${V.bolt} — usable once per attack: iteratives from high BA each carry one.`, 'GMG p.166: a full-attack Elementalist fires one bolt per attack.'));
  if (ele >= 3) rows.push(card('Elemental Blast', `standard action — ${V.blasts.join(' · OR · ')}`, 'GMG p.166: two manifestation options; pick per blast.'));
  if (ele >= 3) rows.push(card('Elemental Weapon', `move action — engulf one melee weapon: ${V.weapon}`, 'GMG pp.166-167: the weapon is unharmed. Also shown as a rider on the Gear tab’s melee weapon rows.'));
  if (ele >= 5) rows.push(card('Elemental Locomotion', ({ Ambrian: 'Fly 120′ (perfect)', Kryonian: 'Swim 60′ · hold breath 1 min/Con point', Vesuvian: 'Fly 60′ (perfect)', Vitrolian: 'Burrow (see entry)' })[vn], 'GMG p.167 — the variant movement mode.'));
  if (ele >= 10) rows.push(card('Elemental Transformation', `become a living elemental AT WILL — Nimbus at will, DR ${vn === 'Vitrolian' ? '20/adamantine+magic' : '15/magic'}, immunities per the entry`, 'GMG p.167.'));
  host.innerHTML = rows.join('');
}
