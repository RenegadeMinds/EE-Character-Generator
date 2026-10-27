// =============================================================================
// js/rules/combat.js
// COMBAT — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Grapple, combat declarations (Power Attack, Combat Expertise,
//   Best Defense), weapon specials and riders, maneuvers and the equipped-
//   weapon summaries.
//
// KEY NAMES (so you can search for them)
//   functions (14): computeGrapple, ownsFeatN, combatDecl, bestDefenseCap,
//   combatDeclCaps, psiFocusPathOf, weaponSpikeInfo, weaponSpecialsOf,
//   weaponSpecialRiders, meleeOptsOn, quickSkillTotal, computeManeuvers,
//   combatRiders, computeEquippedWeaponSummaries
//
// WHERE IT CAME FROM
//   Gathered from js/rules/14-resistances-speed-dr-size.js,
//   js/rules/15-combat-declarations-and-melee.js when the code was regrouped
//   by topic and page. Each function and table moved whole and unchanged,
//   with the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Grapple modifier: BAB + Str mod + 4 per size category above Medium (−4
// below) — using the EFFECTIVE size (Super-Strong riders included).
function computeGrapple(c) {
  const strM = am(effAttrs(c)[0]);
  const sizeIdx = effectiveSizeIndex(c);
  const sizeMod = (sizeIdx - 4) * 4;
  let total = (c.bab || 0) + strM + sizeMod;
  const parts = [`BAB ${c.bab || 0}`, `Str ${strM >= 0 ? '+' : ''}${strM}`];
  if (sizeMod) parts.push(`size (${SIZE_LADDER[sizeIdx]}) ${sizeMod > 0 ? '+' : ''}${sizeMod}`);
  // v8.42.0: transient wired buffs (Grip of Iron) — typed aggregation.
  const aeG = (activeBuffBonuses(c).grapple || []);
  if (aeG.length) {
    const agg = aggregateBonuses(aeG);
    if (agg.total) { total += agg.total; parts.push(`active powers +${agg.total}`); }
  }
  // v9.12.1 (§270, superseding the v8.59.3 rationale): PA/CE are penalties
  // to MELEE ATTACK ROLLS, never a spend of Base Attack — and "a grapple
  // check is like a melee attack roll" (the v8.63.1 Reckless Offense
  // precedent), so the penalty reaches the Grapple AS a roll penalty. Same
  // number as before, correct provenance: the BA component stays printed.
  const _dG = combatDecl(c);
  if (_dG.pa + _dG.ce > 0) {
    total -= (_dG.pa + _dG.ce);
    parts.push(`declared stance penalty on melee attack rolls (PA ${_dG.pa} · CE ${_dG.ce}; grapple checks ride them — the RO precedent) −${_dG.pa + _dG.ce}`);
  }
  // v8.71.0 (found wiring the Tracker's Grapple drop-down): Improved
  // Grapple's +4 is UNCONDITIONAL — "a +4 bonus on all grapple checks,
  // regardless of whether you started the grapple" (HH p.224) — so it
  // belongs in the stat, not at the table. Sheet cell, drilldown, print,
  // and the new drop-down all inherit from here.
  if ((c.feats || []).some(f => (f.name || f.n) === 'Improved Grapple')) {
    total += 4;
    parts.push('Improved Grapple +4');
  }
  // v9.2.2 (Adam's ruling 2026-10-06): the Tentacle mutation's +4 mutation
  // bonus on grapple checks is unconditional — it belongs in the stat.
  if ((c.mutations || []).some(m => m.name === 'Tentacle')) {
    total += 4;
    parts.push('Tentacle +4 (mutation)');
  }
  // v8.91.0 (task 3): Lost Arm's own −2 on grapple checks (HH drawback text)
  // was never baked — now it is, and a cybernetic Prosthetic Arm lifts it.
  if (hasLostArm(c) && !(hasCyberArm(c))) {
    total -= 2;
    parts.push('Lost Arm −2 (install a cybernetic arm to lift)');
  }
  // v8.92.0: cybernetic negative levels ride Grapple too — a grapple check
  // is like a melee attack roll (the RO doctrine), and HH p.333 hits all
  // attack rolls.
  const _cybNLg = cyberExcess(c);
  if (_cybNLg) {
    total -= _cybNLg;
    parts.push(`negative levels −${_cybNLg} (cybernetic overload)`);
  }
  // v8.63.1 (Adam's redirect): Reckless Offense RIDES Grapple — "a grapple
  // check is like a melee attack roll" and starting one "requires a
  // successful melee attack roll" (HH grapple rules), so the +2 applies.
  // What RO never does: touch ranged, or mint extra attempts (attempt count
  // keys off the iterative ladder from PRINTED Base Attack, untouched).
  if (_dG.ro) {
    total += 2;
    parts.push('Reckless Offense (declared) +2');
  }
  // v8.65.0: Best Defense is a bonus "on their melee attack rolls" — the
  // same wording the Reckless Offense redirect ruled Grapple rides.
  if (_dG.bd) {
    total += _dG.bd;
    parts.push(`Best Defense (declared) +${_dG.bd}`);
  }
  return { total, parts, sizeIdx };
}
// ============================================================================
// v8.59.0 — THE TRADE-OFF & FOCUS-SPIKE WIRING (Adam's challenge, 2026-10-02)
// Three species, three doors:
//  • DECLARED SET-POINTS (Power Attack / Combat Expertise): persistent dials
//    on the Sheet's Base Attack card — declared until re-declared (Adam's
//    ruling: no per-round reset). PA+CE total ≤ BAB (a character with both
//    may legally dial BA to 0); CE additionally caps at +5 (HH p.207). Melee
//    rows take the attack penalty; PA adds damage (×2 two-handed; light
//    weapons get NO damage bonus — unarmed/natural exempt, HH p.235); CE's
//    +N Defense is shown as an explicit tag on AC/Parry/Dodge (and reaches
//    touch AC per the book) rather than silently rewriting computed stats.
//  • ALT-MODE BRANCHES (Double Tap / Burst Fire — already wired v8.5.2):
//    ranged-only by their own text, so they never interact with PA/CE.
//  • FOCUS SPIKES (Power Fist / Psionic Weapon / Power Shot + Greaters):
//    branch rows on qualifying weapon rows. Psionic path: actionable while
//    focus is HELD (⚡ Expend Focus → focus drops, branch greys). Super-
//    mutant path (Adam's ruling): sits READIED at all times — using it
//    confirms the reminder that the momentary Super-Power focus costs the
//    character's MOVE ACTION that round (HH p.354). Greater feats silently
//    upgrade the same action 2d6 → 4d6. Greater Power Shot's Special bars
//    mutants from applying Power Shot to external ranged weapons — so the
//    ranged spike only arms through the psionic path.
function ownsFeatN(c, n) { return (c && c.feats || []).some(f => (f.name || f.n) === n); }
function combatDecl(c) {
  const d = (c && c.combatDecl) || {};
  // v8.63.0 (Adam's ruling): Reckless Offense is a declared stance too, but
  // it NEVER touches Base Attack — "+2 on melee attack rolls" is a bonus to
  // the rolls themselves: no ranged, no extra iteratives. v8.63.1 redirect:
  // Grapple DOES ride it ("a grapple check is like a melee attack roll").
  // v8.65.0 (Adam's go): Best Defense (Survivor 5) — PA's MIRROR, "right
  // down to the attendant Defense Bonus modifier": the declared points
  // SPEND Defense Bonus (so def-fed stats move) and land on melee attack
  // rolls (Grapple included, per the Reckless Offense precedent).
  return { pa: Math.max(0, d.pa || 0), ce: Math.max(0, d.ce || 0), ro: !!d.ro, bd: Math.max(0, d.bd || 0) };
}
// Best Defense's cap: the Survivor CLASS Defense Bonus at the current
// Survivor level ("the penalty cannot be greater than their Survivor class
// Defense Bonus — so +3 at 5th level", HH p.137). 0 below Survivor 5.
function bestDefenseCap(c) {
  const lvl = _cfLvlOf(c, 'Survivor');
  if (lvl < 5) return 0;
  const e = migrateLegacyClasses(c).find(x => x.name === 'Survivor');
  const cls = e && getClassEntry(e);
  return cls ? (classStatAt(cls, lvl, 'def') || 0) : 0;
}
function combatDeclCaps(c) {
  const bab = (c && c.bab) || 0;
  return { bab, ceMax: Math.min(5, bab) };
}
// Focus paths for the spike feats.
function psiFocusPathOf(c) {
  const cs = computeCasterStats(c);
  const psiCapable = !!(cs.psionic && cs.psionic.contributors.length);
  // NOTE: eml floors at 1 for everyone — the honest super-mutant test is the
  // state's own isSuperMutant flag (or the Supernatural Mutation feat).
  const superCapable = (getMPState(c).isSuperMutant === true)
    || (hasFeatNamed(c, 'Supernatural Mutation'));
  return { psiCapable, superCapable };
}
// One spike descriptor per qualifying row kind, or null.
function weaponSpikeInfo(c, rowKind, attackBonus) {
  const featBy = { unarmed: 'Power Fist', melee: 'Psionic Weapon', ranged: 'Power Shot' };
  const feat = featBy[rowKind];
  if (!feat || !ownsFeatN(c, feat)) return null;
  const greater = ownsFeatN(c, 'Greater ' + feat);
  const dice = greater ? '4d6' : '2d6';
  const dispFeat = greater ? 'Greater ' + feat : feat;
  const { psiCapable, superCapable } = psiFocusPathOf(c);
  const locked = psiFocusLocked(c);
  let path = null, state = '';
  if (c.psiFocused && !locked) { path = 'held'; state = 'focus held — ready'; }
  else if (rowKind === 'ranged' && !psiCapable) { path = null; state = 'innate powers only (mutants — Greater Power Shot, Special)'; }
  else if (superCapable) { path = 'momentary'; state = 'readied — costs your Move action'; }
  else if (psiCapable) { path = null; state = locked ? 'focus locked (Second Skin)' : '○ not focused'; }
  else { path = null; state = 'requires psionic focus'; }
  return {
    feat, dispFeat, dice, path,
    name: dispFeat, atk: attackBonus, dmgMult: 1, spike: true,
    display: `+${dice} dmg · ${state}`,
    label: `${dispFeat}: expend ${path === 'momentary' ? 'a momentary Super-Power focus (move action, HH p.354)' : 'your psionic focus'} to add +${dice} damage to this single attack. Declared BEFORE the roll — the focus is spent even if the attack misses.${greater ? '' : (ownsFeatN(c, 'Greater ' + feat) ? '' : '')}`,
  };
}
function weaponSpecialsOf(name) { return WEAPON_SPECIALS[name] || null; }
// Specials → rider-style chips for the row's sub-line.
function weaponSpecialRiders(name) {
  const sp = weaponSpecialsOf(name);
  if (!sp) return [];
  const tag = sp.proposed ? ` [${sp.src || 'OGL 3.5 SRD'} — Open Game Content; the HH's own description insert is queued on the TODO]` : (sp.src ? ` (${sp.src})` : '');
  const r = [];
  if (sp.reach) r.push([`Reach ${sp.reach}`, `This weapon strikes at ${sp.reach}.${tag}`]);
  if (sp.reachOnly) r.push([`Reach ${sp.reachOnly}`, `This weapon strikes at ${sp.reachOnly} — it cannot strike adjacent foes.${tag}`]);
  if (sp.rangedTrip) r.push(['Ranged trip', `${sp.note}${tag}`]);
  if (sp.entangle) r.push(['Entangle', `${sp.note}${tag}`]);
  if (sp.setVsCharge) r.push(['Set vs charge', `Ready (set) this weapon against a charge to deal DOUBLE damage to the charging foe.${tag}`]);
  if (sp.chargeDouble) r.push(['Mounted charge ×2', `${sp.note}${tag}`]);
  if (sp.note && !sp.rangedTrip && !sp.entangle && !sp.chargeDouble) r.push(['Special', `${sp.note}${tag}`]);
  return r;
}
function meleeOptsOn() { return storeGet('dxd20v2_ui_meleeOpts') === '1'; }
function quickSkillTotal(c, name, attrIdx) {
  try {
    const ranks = (getLiveSkillRanks(c, name) || 0);
    let misc = 0;
    {
      const m = computeSkillMiscBonuses(c)[name];
      misc = (typeof m === 'number') ? m : ((m && m.total) || 0);
    }
    return ranks + am(effAttrs(c)[attrIdx]) + misc;
  } catch (e) { return null; }
}
function computeManeuvers(c, ctx) {
  const owns = (n) => ownsFeatN(c, n);
  const strM = am(effAttrs(c)[0]);
  const szStr = (effectiveSizeIndex(c) - 4) * 4;  // maneuver checks: ±4 per size category vs Medium
  const show = meleeOptsOn();
  const fmt = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const out = [];
  {
    const iD = owns('Improved Disarm');
    if (show || iD) {
      const spD = ctx.isUnarmed ? null : weaponSpecialsOf(ctx.weaponName);
      const wB = (spD && spD.disarmBonus) || 0;
      const mod = ctx.attackBonus + (ctx.wield2H ? 4 : 0) + ((ctx.isLight || ctx.isUnarmed) ? -4 : 0) + wB;
      out.push({ n: 'Disarm', display: `${fmt(mod)} opposed${wB ? ` (incl. weapon +${wB}${spD.proposed ? '*' : ''})` : ''}${iD ? ' · no AoO' : ' · ⚠ AoO'}`,
        label: `Disarm — replaces any melee attack (any Full Attack swing, even an AoO). Opposed ATTACK rolls; your roll ${fmt(mod)}${ctx.wield2H ? ' (two-handed +4 included)' : ''}${(ctx.isLight || ctx.isUnarmed) ? ' (light weapon −4 included — an unarmed strike counts as light)' : ''}${wB ? ` (${ctx.weaponName} +${wB} on disarm rolls, including the roll to avoid being counter-disarmed${spD.proposed ? ' — OGL 3.5 SRD; HH insert queued' : ` — ${spD.src}`})` : ''}; ±4 per size-category difference at the table. ${iD ? 'Improved Disarm: you provoke NO attack of opportunity.' : '⚠ Provokes an AoO from the target — if its damage lands, your attempt fails. If you fail the opposed roll, the defender may immediately try to disarm YOU.'} Succeed unarmed: their weapon is in your hand. Succeed armed: it lands in their hex. Locked gauntlets resist at +10; spiked gauntlets can't be disarmed.` });
    }
  }
  {
    const iT = owns('Improved Trip'), cT = owns('Combat Throw'), icT = owns('Improved Combat Throw');
    const spT = ctx.isUnarmed ? null : weaponSpecialsOf(ctx.weaponName);
    const tripW = !!(spT && spT.trip);
    const tripProposed = !!(spT && spT.trip && spT.proposed);
    if (show || iT || cT || icT) {
      const strCheck = strM + szStr + (cT ? 2 : 0);
      out.push({ n: 'Trip', display: `touch ${fmt(ctx.attackBonus)} → Str ${fmt(strCheck)}${(iT || tripW) ? ' · no AoO' : ' · ⚠ AoO if unarmed'}${tripW ? ` · trip weapon${tripProposed ? '*' : ''}` : ''}`,
        label: `Trip — replaces any melee attack; only vs targets up to one size larger. Melee TOUCH attack at ${fmt(ctx.attackBonus)}, then opposed Str check at ${fmt(strCheck)}${cT ? ' (Combat Throw +2 included)' : ''} (size ${fmt(szStr)} included) vs the defender's Str OR Dex (their choice); defender +4 if more than two legs or exceptionally stable. Win: target is PRONE (standing up costs them a move action). Lose: they may immediately counter-trip you.${iT ? ' Improved Trip: no AoO, and you get a free attack of opportunity against the tripped target.' : (tripW ? ` *${ctx.weaponName} is a trip weapon (${tripProposed ? 'OGL 3.5 SRD — Open Game Content; the HH description insert is queued' : (spT.src || 'HH')}): the touch attack is made WITH the weapon, no AoO${spT.dropToAvoid ? ', and you may DROP the weapon to avoid a counter-trip' : ''}.` : ' ⚠ An unarmed trip attempt provokes an AoO.')}${icT ? ' Improved Combat Throw: when an opponent misses you in melee, you may take an AoO to attempt a trip.' : ''} Mounted targets: their Ride check may replace their opposed check; win pulls them from the mount.` });
    }
  }
  {
    const iF = owns('Improved Feint');
    if (show || iF) {
      const bluff = quickSkillTotal(c, 'Bluff', 5);
      const shown = bluff != null ? fmt(bluff + (iF ? 2 : 0)) : '(Skills tab)';
      out.push({ n: 'Feint', display: `Bluff ${shown} · ${iF ? 'move action' : 'standard action'} · no AoO`,
        label: `Feint — ${iF ? 'a MOVE action (Improved Feint; its +2 is included)' : 'a standard action'}; never provokes. Your Bluff vs the target's Sense Motive + their base attack bonus. Success: your NEXT melee attack against them (made by the end of your next turn) denies their Dex bonus to AC. −4 vs nonhumanoids, −8 vs animal Intelligence (1–2), impossible vs nonintelligent creatures.` });
    }
  }
  {
    const iB = owns('Improved Bull Rush');
    if (show || iB) out.push({ n: 'Bull Rush', display: `Str ${fmt(strM + szStr + (iB ? 4 : 0))}${iB ? ' · no AoO (defender)' : ' · ⚠ AoOs'}`,
      label: `Bull Rush — an attack (standard action) or part of a charge (+2 on the check if charging); only vs targets up to one size larger. Moving into their space ⚠ provokes AoOs from everyone threatening you${iB ? ' EXCEPT the defender (Improved Bull Rush; its +4 is included)' : ' — and stray AoOs have a 25% chance of striking the other combatant instead'}. Opposed Str checks at ${fmt(strM + szStr + (iB ? 4 : 0))} (size ${fmt(szStr)} included); stable/multi-legged defenders +4. Win: push them back 5 ft, +5 ft per 5 points of margin (move with them if you wish, within your movement). Lose: you bounce back 5 ft.` });
    const iO = owns('Improved Overrun');
    if (show || iO) out.push({ n: 'Overrun', display: `Str ${fmt(strM + szStr + (iO ? 4 : 0))}${iO ? ' · can’t avoid you' : ''} · ⚠ AoO`,
      label: `Overrun — a standard action taken DURING your move (the printed exception); one attempt per round; only vs targets up to one size larger. ⚠ Provokes an AoO from the defender. ${iO ? 'Improved Overrun (+4 included): the defender may NOT simply avoid you.' : 'The defender may simply avoid you (costs neither of you anything).'} If they block: opposed Str at ${fmt(strM + szStr + (iO ? 4 : 0))} vs their Str OR Dex (stable +4, ±4/size). Win: they're PRONE and you continue your move. Lose: they may counter-knock YOU prone; either way you fall back 5 ft.` });
    const iS = owns('Improved Sunder');
    if (show || iS) {
      const mod = ctx.attackBonus + (ctx.wield2H ? 4 : 0) + ((ctx.isLight || ctx.isUnarmed) ? -4 : 0);
      out.push({ n: 'Sunder', display: `${fmt(mod)} opposed${iS ? ' · no AoO' : ' · ⚠ AoO'}`,
        label: `Sunder — a melee attack with a slashing or bludgeoning weapon against a HELD weapon or shield. ${iS ? 'No AoO (Improved Sunder).' : '⚠ Provokes an AoO — any damage it deals becomes an equal penalty on your opposed roll.'} Opposed attack rolls at ${fmt(mod)} (two-handed +4 / light −4 included; ±4/size at the table), AND your roll must also reach the defender's Touch AC. Win: roll weapon damage against the item (blades hardness 10, hafted 5 — HH table). Worn/carried objects use a straight attack vs AC 10 + size + their Defense + Dex instead.` });
    }
  }
  return out;
}

// Row-level COMBAT RIDERS — owned feats whose whole mechanic is one line on
// this attack row. Every line verified against the HH feat table (pp.197-199).
function combatRiders(c, kind) {
  const owns = (n) => ownsFeatN(c, n);
  const r = [];
  if (kind === 'ranged') {
    if (owns('Improved Precise Shot')) r.push(['Improved Precise Shot', 'Ignore anything less than total cover or total concealment; strike into a grapple accurately.']);
    if (owns('Skip Shot')) r.push(['Skip Shot', 'You can try to ricochet a shot into an opponent behind cover (see the feat — GM adjudicates the surface).']);
    if (owns('Shot on the Run')) r.push(['Shot on the Run', 'Attack with this ranged weapon mid-move: move, shoot, keep moving.']);
    if (owns('Manyshot')) r.push(['Manyshot', 'Bows: fire multiple arrows as a single standard action (see the feat).']);
  } else {
    if (owns('Blind-Fight')) r.push(['Blind-Fight', 'Reroll melee misses caused by concealment — the second result stands.']);
    if (owns('Spring Attack')) r.push(['Spring Attack', 'Attack with this melee weapon mid-move: move, strike, keep moving.']);
    if (owns('Reckless Offense')) r.push(['Reckless Offense', 'Take −4 AC for +2 on melee attack rolls — now a declared stance: toggle ⚡ Reckless on the Tracker Conditions shelf and the rows, Grapple, and Defense cells update live. Attack rolls only — Grapple included (a grapple check is like a melee attack roll), but never Base Attack: no ranged, no extra iterative attacks.']);
    if (owns('Cleave')) r.push(['Cleave', 'Drop a foe → one immediate free melee attack vs an adjacent foe at the same bonus, once per round. No 5-ft step first.']);
    if (owns('Great Cleave')) r.push(['Great Cleave', 'As Cleave, with no per-round limit.']);
    if (owns('Supernatural Strike')) r.push(['Supernatural Strike', 'You may threaten criticals even against targets normally immune to them.']);
    // v8.65.0 (Adam's go): Elemental Weapon — at-will rider on melee weapon
    // rows (variant detail on the 🔥 Elemental Arsenal panel).
    if (kind === 'melee' && _cfLvlOf(c, 'Elementalist') >= 3) {
      const _vnW = ((((c.classChoices || {})['ele_var_1']) || '').match(/^(Ambrian|Kryonian|Vesuvian|Vitrolian)/) || [])[1];
      r.push(['Elemental Weapon', `Move action (Su, at will): engulf this melee weapon with your element — ${_vnW === 'Vitrolian' ? '+5 Hardness, +10 HP, and a magical +1 to hit' : `+2d6 ${({ Ambrian: 'electricity', Kryonian: 'cold', Vesuvian: 'fire' })[_vnW] || 'element'} on each successful hit`}. The weapon is unharmed. GMG pp.166-167.`]);
    }
  }
  if (kind === 'unarmed') {
    // v8.64.0 (Phase 2 sift): the Monk Ki Strike ladder — focus-aware rider
    // (● focus held = active; ○ = gain focus first). Magic and Lawful are
    // focus-gated by their book text; Adamantine reads unconditional.
    const _mnkKi = _cfLvlOf(c, 'Monk');
    if (_mnkKi >= 4) {
      const kiBits = ['4th: unarmed counts as MAGIC vs DR, ignores 5 hardness (while focused)'];
      if (_mnkKi >= 10) kiBits.push('10th: +1d6 damage and LAWFUL vs DR (while focused)');
      if (_mnkKi >= 16) kiBits.push('16th: counts as ADAMANTINE vs DR/hardness, ignores the first 20 points of hardness');
      const kiOn = !!c.psiFocused;
      r.push([`Ki Strike ${kiOn ? '●' : '○'}`, `(Su, Monk) ${kiOn ? 'Psionic focus HELD — the focus-gated tiers are ACTIVE.' : 'Not psionically focused — the focus-gated tiers are dormant (gain focus first).'} ${kiBits.join(' · ')} (HH p.87)`]);
    }
    if (owns('Improved Knockout Punch')) r.push(['Improved Knockout Punch', 'Your FIRST unarmed attack against a flat-footed opponent is an automatic ×3 critical.']);
    else if (owns('Knockout Punch')) r.push(['Knockout Punch', 'Your FIRST unarmed attack against a flat-footed opponent is an automatic ×2 critical.']);
    if (owns('Nerve Pinch')) r.push(['Nerve Pinch', 'Standard action: an unarmed attack that can paralyze the target (see the feat).']);
    if (owns('Stunning Fist')) r.push(['Stunning Fist', 'Attempt to stun with an unarmed attack — 1/day per 4 character levels.']);
  }
  return r;
}

function computeEquippedWeaponSummaries(c) {
  const out = [];
  const twf = twfStatus(c);
  const styleVirtuals = virtualTwfFeats(c);  // v8.6.1: Ranger combat-style virtual feats
  // v8.8.0 (Adam's Talents sweep): the Strong Hero's Melee Smash chain —
  // flat bonus to MELEE damage (weapon melee rows, unarmed, naturals).
  // Super-Smash (Su super-talent) REPLACES the +1/tier with +5/tier —
  // suppressed back to the Ex chain while nullified.
  const _msTiers = (((buildTalentBonuses(c) || {}).meleeDamage) || []).reduce((s, b) => s + (b.value || 0), 0);
  const _hasSuperSmash = (c.talents || []).some(t => (t.name || t.n) === 'Super-Smash') && !c.nullified;
  const meleeDmgBonus = _hasSuperSmash ? _msTiers * 5 : _msTiers;
  // v8.6.1 (Adam): Alternate Weapon gadgets — each integrated weapon rides
  // its host as a synthesized row (full per-weapon math: its own proficiency,
  // ability mod, Weapon Focus, stat strip) while the host is equipped. It
  // occupies no hand of its own (it IS the host, physically), so TWF
  // penalties never trigger from it. No mastercraft/enchant of its own —
  // upgrade an integrated weapon by owning it as a separate item instead.
  const iterItems = [...getCharItems(c)];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    for (const gd of (it.gadgets || [])) {
      if (gd.ref === 'Alternate Weapon' && gd.altWeapon) {
        iterItems.push({
          id: `${it.id}_alt_${gd.altWeapon}`, catalogue: 'weapon', ref: gd.altWeapon,
          slot: it.slot, equipped: true, gadgets: [], mastercraft: null,
          _integratedIn: enchantDisplayName(it), _detachable: !!gd.detachable,
        });
      }
    }
  }
  for (const it of iterItems) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    const def = getCatalogueEntry('weapon', it.ref);
    if (!def) continue;
    const proficient = isProficientWithWeapon(c, it.ref);
    // v8.5.2 fix (Adam, 2026-06-30): the attack roll formula is BAB + ability
    // mod + proficiency penalty — this was missing the ability mod entirely.
    // Ranged weapons use Dex, melee use Str, UNLESS Weapon Finesse applies
    // (HH p.255: light weapon / Rapier / Whip / Spiked Chain, melee only — a
    // ranged weapon already uses Dex so Finesse is a no-op there).
    // v9.7.0 (§257): "you MAY use your Dexterity modifier" — the option is
    // exercised only when Dex beats Str; and the feat's shield clause now
    // debits the equipped shield's armor check penalty from FINESSED attacks.
    const bab = c.bab || 0;
    // v8.6.0 firm-wire: attack ability mods use effective attributes
    // (Belt of Giant Strength reaches the attack roll while worn).
    const _eff = effAttrs(c);
    const strM = am(_eff[0]), dexM = am(_eff[1]);
    const hasFinesse = (c.feats || []).some(f => (f.name || f.n) === 'Weapon Finesse');
    const finesseApplies = !isRangedWeapon(def) && isFinesseEligible(def) && hasFinesse && dexM > strM;
    const useDex = isRangedWeapon(def) || finesseApplies;
    const abilityMod = useDex ? dexM : strM;
    const abilityLabel = useDex ? (finesseApplies ? 'Dex (Weapon Finesse)' : 'Dex') : 'Str';
    const _fsACP = finesseApplies ? finesseShieldACP(c) : 0;
    let attackBonus = bab + abilityMod + (proficient ? 0 : -4) + _fsACP;
    // v8.8.1 (Adam's ease-of-use call): flat damage modifiers accumulate as
    // LABELED parts (dmgParts) and collapse into ONE summed number on the
    // dashboard — the ⓘ tooltip itemizes them. Only additional DICE (energy
    // abilities, bite riders) stay distinct in the string (dmgExtras): you
    // can't pre-sum a die.
    const dmgBase = def.dmg_m || def.dmg_s || '';
    const dmgParts = [];   // {label, value} — flat, summable
    const dmgExtras = [];  // dice riders / non-numeric, appended verbatim
    // v8.8.0 (Adam's catch): the ability DAMAGE modifier — omitted from the
    // damage column since its creation. Melee: full Str (×1.5 two-handed,
    // ½ off-hand while dual-wielding); thrown (Dart/Javelin): full Str;
    // projectile/firearm: none (composite bows' Str ratings = GM note).
    // v8.60.0 (Adam): wield2H = a true two-hander OR a one-handed melee
    // weapon in the two-handed grip (off hand free, not dual-wielding).
    // Drives Str ×1.5 and Power Attack ×2 identically for both.
    const wield2H = def.kind === 'two-handed'
      || (!!it.twoHandedGrip && def.kind === 'one-handed' && !isRangedWeapon(def) && !twf && !it._integratedIn);
    {
      const isOffhand = twf && !it._integratedIn && it.slot === 'off_hand';
      let dmgAbility = 0, dmgAbilityLabel = 'Str modifier';
      if (!isRangedWeapon(def)) {
        if (wield2H) { dmgAbility = Math.floor(strM * 1.5); dmgAbilityLabel = def.kind === 'two-handed' ? 'Str ×1.5 (two-handed)' : 'Str ×1.5 (wielded in both hands)'; }
        else if (isOffhand) { dmgAbility = Math.floor(strM / 2); dmgAbilityLabel = '½ Str (off hand)'; }
        else dmgAbility = strM;
      } else if (def.n === 'Dart' || def.n === 'Javelin') { dmgAbility = strM; dmgAbilityLabel = 'Str modifier (thrown)'; }
      if (dmgAbility) dmgParts.push({ label: dmgAbilityLabel, value: dmgAbility });
    }
    // mods[] is the full itemized breakdown of attackBonus — every entry
    // here (plus altModes below) is shown as a tooltip on the Attack cell.
    const mods = [
      { label: `Base Attack Bonus`, value: bab },
      { label: `${abilityLabel} modifier`, value: abilityMod },
    ];
    if (!proficient) mods.push({ label: 'Not proficient', value: -4 });
    if (_fsACP < 0) mods.push({ label: 'Shield armor check penalty (Weapon Finesse, HH p.255 — applies while finessing with a shield carried)', value: _fsACP });
    // v8.16.0 Races pass: size modifier to attack rolls (+1 Small, −1 Large).
    {
      const szm = raceACSizeMod(c);
      if (szm) { attackBonus += szm; mods.push({ label: `Size (${SIZE_LADDER[raceSizeIndex(c)]})`, value: szm }); }
    }
    // v8.8.3: Euphoriac (Ex) — morale on ALL attack and damage rolls while up.
    {
      const eb = (c.euphoric) ? euphoriacBonus(c) : 0;
      if (eb) { attackBonus += eb; mods.push({ label: `Euphoriac morale (post-surge)`, value: eb }); dmgParts.push({ label: 'Euphoriac morale (post-surge)', value: eb }); }
    }
    // v8.6.1: non-proficient ARMOR/shields drag on every attack roll — the
    // offending piece's armor check penalty applies (d20 non-proficiency
    // rule). Derived live from equipped items, same firm-wire logic as the
    // ability mods above.
    const armorPen = nonProficientArmorPenalty(c);
    if (armorPen.total < 0) {
      attackBonus += armorPen.total;
      for (const p of armorPen.parts) mods.push({ label: `${p.name} (not proficient — armor check penalty)`, value: p.acp });
    }
    // v8.6.1: two-weapon fighting penalties (see twfStatus above) — applied
    // to BOTH hands' rows while a weapon is equipped in each hand.
    const twfHand = (twf && !it._integratedIn) ? (it.slot === 'main_hand' ? 'main' : (it.slot === 'off_hand' ? 'off' : null)) : null;
    if (twfHand) {
      const pen = twfHand === 'main' ? twf.pri : twf.off;
      const why = [twfHand === 'main' ? 'primary hand' : 'off hand'];
      if (twf.offLight) why.push('light off-hand weapon');
      if (twf.hasTWF) why.push('TWF feat');
      attackBonus += pen;
      mods.push({ label: `Two-weapon fighting (${why.join(', ')})`, value: pen });
      if (twf.mixed) { attackBonus += twf.mixed; mods.push({ label: `Melee + ranged in two hands${twf.hasITWF ? ' (reduced by Improved TWF)' : ''}`, value: twf.mixed }); }
    }
    // v8.5.2: Weapon Focus tree (HH p.218-219) — each tier is scoped to the
    // EXACT weapon chosen as the feat's param (matched against this item's
    // ref, same as WEAPONS_CATALOG.name) and stacks with the tier below it:
    // Weapon Focus +1 atk, Greater Weapon Focus +1 MORE atk (not exclusive);
    // Weapon Specialization +2 dmg, Greater Weapon Specialization +2 MORE dmg.
    const hasFeatFor = (name) => (c.feats || []).some(f => (f.name || f.n) === name && f.param === it.ref);
    if (hasFeatFor('Weapon Focus')) { attackBonus += 1; mods.push({ label: 'Weapon Focus', value: 1 }); }
    if (hasFeatFor('Greater Weapon Focus')) { attackBonus += 1; mods.push({ label: 'Greater Weapon Focus', value: 1 }); }
    if (hasFeatFor('Weapon Specialization')) dmgParts.push({ label: 'Weapon Specialization', value: 2 });
    if (hasFeatFor('Greater Weapon Specialization')) dmgParts.push({ label: 'Greater Weapon Specialization', value: 2 });
    // v8.9.1: Advanced-class CHOSEN-WEAPON features (picked in Class Choices).
    {
      const cw = c.classChoices || {};
      const lvlA = (n) => migrateLegacyClasses(c).filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
      const wmL = lvlA('Weaponmaster');
      if (wmL >= 1 && cw.wpm_cw_1 === it.ref) {
        dmgParts.push({ label: 'Weapon Control (Weaponmaster — attacking to kill; counts as AND stacks with Weapon Spec; or nonlethal at no penalty)', value: 2 });
        if (wmL >= 4) dmgExtras.push('+1d6 (Telling Blows)');
        const tw = (wmL >= 5 ? 1 : 0) + (wmL >= 10 ? 1 : 0);
        if (tw) { attackBonus += tw; mods.push({ label: `Totem${wmL >= 10 ? ' + Living' : ''} Weapon (Weaponmaster)`, value: tw }); dmgParts.push({ label: `Totem${wmL >= 10 ? ' + Living' : ''} Weapon`, value: tw }); }
        if (wmL >= 5) mods.push({ label: `If mastercrafted: counts as MAGIC vs DR, ignores 5 hardness${wmL >= 10 ? '; self-built: + ADAMANTINE, ignores 10' : ''} (Totem/Living Weapon)`, value: 0 });
        if (wmL >= 8) mods.push({ label: 'Precise Blow: threat range +1 (applied after Improved Critical)', value: 0 });
      }
      if (lvlA('Sharpshooter') >= 8 && cw.shs_sw_2 === it.ref) { attackBonus += 2; mods.push({ label: 'Signature Style (Sharpshooter — stacks with Signature Weapon’s Weapon Focus)', value: 2 }); }
      if (lvlA('Soldier') >= 5 && cw.sol_wf_1 === it.ref) mods.push({ label: 'Improved Critical (Soldier): threat range +1', value: 0 });
      const tcL = lvlA('Tactician');
      if (tcL >= 5 && cw.tct_pt_5 === it.ref) {
        const intM = am(effAttrs(c)[3]);
        const hitB = Math.floor(intM / 2), dmgB = Math.ceil(intM / 2);
        if (hitB) { attackBonus += hitB; mods.push({ label: 'Personalized Technique (½ Int, Tactician)', value: hitB }); }
        if (dmgB) dmgParts.push({ label: 'Personalized Technique (½ Int rounded up)', value: dmgB });
      }
      // v8.10.1: conditional prestige advisories (tooltip-only, not folded in).
      const eloL = lvlA('Elocater');
      if (eloL >= 2) { const ob = eloL >= 8 ? 6 : (eloL >= 5 ? 4 : 2); mods.push({ label: `Opportunistic Strike +${ob} hit & damage (Elocater) — first attack vs a foe someone else damaged in melee since your last action`, value: 0 }); }
      // Sneak Attack dice — Rogue + Assassin + Trickster ladders STACK
      // (book-explicit); shown as the long-pending conditional chip.
      const sneakD = Math.ceil(lvlA('Rogue') / 2) + Math.ceil(lvlA('Assassin') / 2) + Math.floor(Math.max(lvlA('Arcane Trickster'), lvlA('Psychic Trickster')) / 2);
      if (sneakD > 0) mods.push({ label: `Sneak Attack +${sneakD}d6 (conditional — target denied Dex to AC or flanked; ranged only within 30 ft; not vs crit-immune)`, value: 0 });
      // v8.64.0 (Phase 2 sift): Champion / Nemesis conditional morale — the
      // Opportunistic Strike idiom (tooltip advisory, never folded in).
      if (lvlA('Super-Hero') >= 5) mods.push({ label: 'Champion +2 morale on ALL d20 rolls & damage vs KNOWN-Evil beings (Super-Hero 5, Ex)', value: 0 });
      if (lvlA('Super-Villain') >= 5) mods.push({ label: 'Nemesis +1 morale on all d20s while performing evil acts; +2 for the day after cancelling a Hero’s AP via Villainous Intent (Super-Villain 5, Ex)', value: 0 });
    }
    // v8.6.1 (Adam's better-bonus ruling): magic enhancement (+N to attack
    // AND damage) vs mastercraft (+N to attack OR damage) — the better bonus
    // wins PER STAT, never stacking. When the non-magical mastercraft wins
    // the damage stat, a DR advisory rides along (vs damage reduction that
    // needs magic, only the enhancement counts).
    {
      const enh = (it.enchant && it.enchant.enh) || 0;
      const mcB = (it.mastercraft && it.mastercraft.bonus) || 0;
      const mcAtk = (it.mastercraft && it.mastercraft.target === 'attack') ? mcB : 0;
      const mcDmg = (it.mastercraft && it.mastercraft.target !== 'attack') ? mcB : 0;
      const atkBest = Math.max(enh, mcAtk);
      if (atkBest > 0) {
        attackBonus += atkBest;
        mods.push({ label: enh >= mcAtk
          ? `+${enh} enhancement (magic)${mcAtk ? ` — supersedes mastercraft +${mcAtk}` : ''}`
          : `Mastercraft +${mcAtk} (attack, non-magical)${enh ? ` — supersedes the +${enh} enhancement` : ''}`, value: atkBest });
      }
      const dmgBest = Math.max(enh, mcDmg);
      if (dmgBest > 0) {
        dmgParts.push({ label: enh >= mcDmg
          ? `Enhancement (magic)${mcDmg ? ` — supersedes mastercraft +${mcDmg}` : ''}`
          : `Mastercraft (non-magical)${enh ? ` — vs DR/magic only the +${enh} enhancement applies` : ''}`, value: dmgBest });
      }
      if (meleeDmgBonus > 0 && !isRangedWeapon(def)) {
        dmgParts.push({ label: `Melee Smash talents${_hasSuperSmash ? ' (Super-Smash)' : ''}`, value: meleeDmgBonus });
      }
      // Always-on energy-dice abilities fold into the damage note. Burst
      // variants (Adam's Frostbite confirmation) work as their base energy
      // ability on every hit PLUS +1d10 of that energy on a critical.
      const ENERGY_DICE = {
        'Flaming': ['+1d6 fire', false], 'Frost': ['+1d6 cold', false], 'Shock': ['+1d6 electricity', false], 'Psychokinetic': ['+1d6 force', false],
        'Flaming Burst': ['+1d6 fire', true], 'Icy Burst': ['+1d6 cold', true],
        'Shocking Burst': ['+1d6 electricity', true], 'Psychokinetic Burst': ['+1d6 force', true],
      };
      for (const a of ((it.enchant && it.enchant.abilities) || [])) {
        const ed = ENERGY_DICE[a];
        if (ed) dmgExtras.push(`${ed[0]} (${a}${ed[1] ? ', +1d10 on crit' : ''})`);
      }
    }
    // v9.3.0: gadgets AND mounted accessories, one per mountKey.
    for (const g of weaponAttachments(it)) {
      const gd = g.gd;
      if (g.note) mods.push({ label: `${g.ref} — ${g.note}`, value: 0, conditional: true });
      if (!gd || !gd.effect || gd.effect.kind !== 'bonus') continue;
      for (const contrib of (gd.effect.contributions || [])) {
        if (contrib.kind === 'attackBonus' && typeof contrib.amount === 'number') {
          // Gated contributions (situational OR requires) are listed as an
          // advisory note only, NOT folded into the baseline attack bonus —
          // the engine can't verify "an ally is also targeting this foe" or
          // "a video-scope-equipped weapon is linked" automatically.
          const gate = contrib.situational || contrib.requires || null;
          if (!gate) attackBonus += contrib.amount;
          mods.push({ label: `${g.ref} ${gate ? '(conditional) ' : ''}+${contrib.amount}${gate ? ' — ' + gate : ''}`, value: gate ? 0 : contrib.amount, conditional: !!gate });
        }
      }
    }
    // v8.59.0: declared set-point stances — melee rows only (PA and CE are
    // melee-only by their own text, so ranged rows and DT/BF never interact).
    const _decl = combatDecl(c);
    if (!isRangedWeapon(def) && (_decl.pa + _decl.ce) > 0) {
      attackBonus -= (_decl.pa + _decl.ce);
      if (_decl.pa) mods.push({ label: 'Power Attack (declared stance)', value: -_decl.pa });
      if (_decl.ce) mods.push({ label: `Combat Expertise (declared — Defense +${_decl.ce})`, value: -_decl.ce });
      if (_decl.pa) {
        if (def.kind === 'light') dmgParts.push({ label: 'Power Attack — light weapon: penalty applies, NO damage bonus (HH p.235)', value: 0 });
        else if (wield2H) dmgParts.push({ label: `Power Attack ×2 (${def.kind === 'two-handed' ? 'two-handed' : 'wielded in both hands'}, declared)`, value: _decl.pa * 2 });
        else dmgParts.push({ label: 'Power Attack (declared)', value: _decl.pa });
      }
    }
    // v8.63.0 (Adam's ruling): Reckless Offense — +2 on melee ATTACK ROLLS,
    // −4 AC, never Base Attack (no extra iteratives; Grapple rides it in
    // computeGrapple — a grapple check is like a melee attack roll).
    if (!isRangedWeapon(def) && _decl.ro) {
      attackBonus += 2;
      mods.push({ label: 'Reckless Offense (declared — AC −4)', value: 2 });
    }
    // v8.65.0 (Adam's go): Best Defense — the declared Defense spend lands
    // on melee attack rolls (Survivor 5+, PA's mirror).
    if (!isRangedWeapon(def) && _decl.bd) {
      attackBonus += _decl.bd;
      mods.push({ label: `Best Defense (declared — Defense −${_decl.bd})`, value: _decl.bd });
    }
    // v8.92.0 (Adam's completeness ruling): cybernetic negative levels —
    // −1 per excess attachment on ALL attack rolls (HH p.333), melee and
    // ranged alike (attack ROLLS, never Base Attack — the RO doctrine).
    const _cybNLw = cyberExcess(c);
    if (_cybNLw) {
      attackBonus -= _cybNLw;
      mods.push({ label: `Negative level${_cybNLw > 1 ? 's' : ''} ×${_cybNLw} (cybernetic overload — HH p.333)`, value: -_cybNLw });
    }
    // v8.99.0: Targeting Optics (cybernetic, HH p.338) — +1 on all RANGED
    // attack rolls via the projected reticle.
    if (isRangedWeapon(def) && getCyber(c).some(r => r.n === 'Targeting Optics')) {
      attackBonus += 1;
      mods.push({ label: 'Targeting Optics (cybernetic — HH p.338)', value: 1 });
    }
    // v8.5.2: alternate-attack-mode feats (Burst Fire, Double Tap) — gated on
    // owning the feat AND the equipped weapon's parsed rof[] supporting it
    // (Burst Fire needs 'A', Double Tap needs 'S'; see build_weapons.mjs).
    // Shown as available options, NOT folded into the baseline attackBonus —
    // it's the player's per-attack choice, same treatment as the conditional
    // gadget mods above. roundsCost is informational only (ammo untracked).
    const altModes = [];
    const effRof = effectiveRoF(it, def);
    for (const fe of (c.feats || [])) {
      const fd = getFeatData(fe.name);
      if (!fd || !fd.combatMod) continue;
      const cm = fd.combatMod;
      if (!effRof.includes(cm.requiresRoF)) continue;
      altModes.push({
        name: fd.n, atk: attackBonus + cm.atkPenalty, dmgMult: cm.dmgMult, roundsCost: cm.roundsCost,
        label: `${fd.n}: ${cm.atkPenalty} atk, ×${cm.dmgMult} dmg (costs ${cm.roundsCost} rounds)`,
      });
    }
    // v8.6.1: Rapid Shot — the ranged mirror of Flurry of Blows, presented
    // the same way (Adam's parity call): one extra ranged attack per round
    // at highest BAB, every attack that round at −2, full attack action.
    // From the feat itself or the Ranger archery style (virtual, armor-gated).
    if (isRangedWeapon(def)) {
      const rsVirtual = styleVirtuals.has('Rapid Shot');
      const hasRS = (c.feats || []).some(f => (f.name || f.n) === 'Rapid Shot') || rsVirtual;
      if (hasRS) {
        altModes.push({
          name: 'Rapid Shot', atk: attackBonus - 2, dmgMult: 1,
          display: `extra attack, all at ${(attackBonus - 2) >= 0 ? '+' : ''}${attackBonus - 2}`,
          label: `One extra ranged attack per round at your highest base attack bonus; every attack you make that round takes −2. Requires the full attack action.${rsVirtual ? ' (Ranger combat style, virtual — light or no armor only.)' : ''}`,
        });
      }
    }
    // v8.6.1 (Adam's Autofire adjudication): the spray is available to ANYONE
    // wielding an effectively-automatic weapon — HH Autofire (combat ch.):
    // one attack roll vs the 10×10 ft area's effective AC 10; on a hit
    // (v9.19.0, old-boys report #1: "Def 10" was a vestigial d20M usage —
    // E&E canon is AC; the HH's own Autofire paragraph still prints
    // "effective Defense of 10" — book letter filed)
    // every creature inside takes weapon damage, Reflex DC 15 negates; uses
    // 10 rounds. Advanced Firearms Proficiency is NOT required — without it
    // the attack takes −4 (the feat's Normal line). Strafe reshapes the area.
    if (effRof.includes('A')) {
      const ownsFt = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
      const hasAFP = ownsFt('Advanced Firearms Proficiency');
      const afAtk = attackBonus + (hasAFP ? 0 : -4);
      const effMagAf = effectiveMagazine(it, def);
      const magShort = effMagAf && effMagAf < 10;
      altModes.push({
        name: 'Autofire', atk: afAtk, dmgMult: 1, roundsCost: 10,
        display: `${afAtk >= 0 ? '+' : ''}${afAtk} vs area (AC 10)${magShort ? ' ⚠' : ''}`,
        label: `Spray a 10×10 ft area: one attack roll against the area's effective AC 10${hasAFP ? '' : ' (includes −4 — no Advanced Firearms Proficiency)'}. On a hit, every creature in the area takes the weapon's damage; Reflex save DC 15 negates. Uses 10 rounds (weapon must have 10 loaded).${magShort ? ` ⚠ Magazine holds only ${effMagAf} — GM override territory.` : ''} Cannot be aimed at a specific target — that's Burst Fire.${ownsFt('Strafe') ? ' Strafe: you may instead shape the area as four contiguous 5-ft hexes in a line.' : ''}`,
      });
    }
    // v8.8.0 gadget firing modes (Adam's wiring sweep): Stun Module adds a
    // nonlethal stun mode; Variable Charge adds the primed overcharge shot.
    if (hasGadget(it, 'Stun Module')) {
      altModes.push({
        name: 'Stun', atk: attackBonus, dmgMult: 1,
        display: `${attackBonus >= 0 ? '+' : ''}${attackBonus} nonlethal · Fort or stunned`,
        label: 'Stun Module: free action to toggle. On a hit the target makes a Fortitude save (DC 12/15/18 by module tier) or is stunned 1d4 rounds; damage is nonlethal.',
      });
    }
    if (hasGadget(it, 'Variable Charge')) {
      altModes.push({
        name: 'Charged Shot', atk: attackBonus, dmgMult: 1.5,
        display: `${attackBonus >= 0 ? '+' : ''}${attackBonus} atk / ×1.5 dmg (primed)`,
        label: 'Variable Charge: prime as an attack action for +50% damage on the next shot. Max 3 rounds primed — a 4th round forces the shot or the weapon explodes for +200% on the user. Energy weapons only.',
      });
    }
    // v8.59.0: focus-spike branch for this row (Psionic Weapon on armed
    // melee, Power Shot on ranged — Power Fist lives on the unarmed/natural
    // rows below). Rendered as a branch with an ⚡ Expend Focus button.
    {
      const sp = weaponSpikeInfo(c, isRangedWeapon(def) ? 'ranged' : 'melee', attackBonus);
      if (sp) altModes.push(sp);
    }
    // v8.61.0: Dead Aim (ranged) and Whirlwind Attack (melee) as alt modes.
    if (isRangedWeapon(def) && ownsFeatN(c, 'Dead Aim')) {
      altModes.push({ name: 'Aimed Shot', atk: attackBonus + 2, dmgMult: 1,
        display: `${attackBonus + 2 >= 0 ? '+' : ''}${attackBonus + 2} after a full-round aim`,
        label: 'Dead Aim: spend a full-round action drawing a bead to gain +2 on your NEXT single ranged attack with this weapon.' });
    }
    if (!isRangedWeapon(def) && ownsFeatN(c, 'Whirlwind Attack')) {
      altModes.push({ name: 'Whirlwind Attack', atk: attackBonus, dmgMult: 1,
        display: `${attackBonus >= 0 ? '+' : ''}${attackBonus} vs EVERY adjacent foe`,
        label: 'Whirlwind Attack (full attack action): one melee attack at your full base attack bonus against every opponent you threaten. You forgo your iterative attacks to strike everyone at once.' });
    }
    // v8.61.0: Expanded Melee Options (maneuver branches) + combat riders.
    const maneuvers = isRangedWeapon(def) ? [] : computeManeuvers(c, {
      attackBonus, wield2H, isLight: def.kind === 'light', isUnarmed: false, weaponName: def.n || it.ref });
    const riders = [...combatRiders(c, isRangedWeapon(def) ? 'ranged' : 'melee'),
      ...weaponSpecialRiders(def.n || it.ref)];  // v8.61.1: book-canon weapon properties
    // v8.6.1: off-hand attack sequence (1 base; 2nd at −5 with Improved TWF;
    // 3rd at −10 with Greater/Advanced) + the half-Str damage reminder for
    // melee off-hand hits (d20: off-hand adds only ½ the Str bonus).
    let twfExtraAtks = null;
    if (twfHand === 'off') {
      twfExtraAtks = [attackBonus];
      if (twf.offAttacks >= 2) twfExtraAtks.push(attackBonus - 5);
      if (twf.offAttacks >= 3) twfExtraAtks.push(attackBonus - 10);
    }
    // Collapse: die + ONE summed flat modifier (breakdown via the ⓘ tooltip),
    // then any extra dice riders verbatim.
    const dmgSum = dmgParts.reduce((s, p) => s + (p.value || 0), 0);
    const damageNote = dmgBase + (dmgSum ? `${dmgSum > 0 ? '+' : ''}${dmgSum}` : '') + dmgExtras.map(e => ' ' + e).join('');
    const pseudo = { type: (def.damage_type && def.damage_type[0]) || 'untyped', lethality: def.lethality || 'lethal', pool: 'hit_points', descriptors: [] };
    // v8.60.0 (Adam): the E&E iterative ladder — one extra Full-Attack swing
    // per 5 points of BASE attack (+5/+0 at BA 5 … five swings at BA 20, the
    // cap; the GMG's own deity rule echoes the five-attack ceiling). The
    // COUNT keys off printed BA; each swing's total rides attackBonus (so
    // declared stances, proficiency, and TWF penalties carry through). Off-
    // hand rows don't iterate — their extra attacks are the TWF chain's.
    const fullAttack = [];
    if (twfHand !== 'off') {
      const nAtk = Math.min(5, 1 + Math.floor((c.bab || 0) / 5));
      for (let i = 0; i < nAtk; i++) fullAttack.push(attackBonus - 5 * i);
    } else fullAttack.push(attackBonus);
    out.push({
      itemId: it.id, name: enchantDisplayName(it), slot: it.slot, hand: twfHand,
      fullAttack, gripBothHands: wield2H && def.kind !== 'two-handed',
      maneuvers, riders,
      enchantOverCap: !!(it.enchant && it.enchant.overCap),
      // v9.6.1 (§256, Adam's rules lookup): Enchanted & Imbued Arms — every
      // +1 of enhancement bonus ignores 5 points of Hardness of anything the
      // weapon strikes (GMG p.253); whatever ignores hardness also ignores
      // NATURAL hardness (GMG p.96); Bane = +2 effective enhancement vs the
      // designated foe, 10 more points ignored there (GMG p.260).
      ignoreHardness: (it.enchant && (it.enchant.enh || 0) > 0) ? it.enchant.enh * 5 : 0,
      ihBane: !!(it.enchant && (it.enchant.abilities || []).includes('Bane')),
      typeLabel: classifiedDamageLabel(it, def),
      vsObjects: damageVsObjectsNote(def),
      statStrip: weaponStatStrip(def, it),
      rangeRule: weaponRangeRule(def, it),
      integratedIn: it._integratedIn || null,
      detachable: !!it._detachable,
      twfExtraAtks,
      attackBonus, damage: damageNote.trim(), dmgBreakdown: dmgParts, damageTypes: def.damage_type || [],
      damageLabel: DamageResolver.renderLabel(pseudo), resistances: DamageResolver.applicableResistances(pseudo),
      proficient, mods, altModes,
    });
  }
  // v8.6.1 (Adam's ruling, 2026-09-01): with NO weapon equipped, the unarmed
  // strike auto-populates. Baseline per Adam + the Foe Folio slam-by-size
  // table: 1d3 bludgeoning nonlethal for Medium (1d2 Small — size read from
  // the race notes), a light weapon that can't be disarmed; provokes AoO
  // unless a martial-arts feat makes it count as armed. Feat ladder:
  //   Brawl +1 competence, 1d6 nonlethal · Improved Brawl +2, 1d8 nonlethal
  //   Combat Martial Arts: 1d4 lethal OR nonlethal, counts as armed
  //   ("Improved Unarmed Strike" is the book's cross-reference to CMA)
  //   Improved CMA: threat 19–20 · Advanced CMA: crit ×3
  // Monk Flurry of Blows (virtual TWF, unarmed + UNARMORED — checked live):
  // alt-mode granting an extra unarmed attack, both at −2 (light off-hand +
  // virtual TWF feat = −2/−2).
  // v8.8.0 (Adam's Advantages pass): NATURAL WEAPONS from mutations get
  // their own rows, always shown (they're the character's body). Parsed from
  // the MUTATION_EFFECTS natural strings ("claw — slashing: S 1d4 / M 1d6 /
  // L 1d8" → Medium die). Riders attach to the bite (Acidic Saliva +1d4
  // acid; Venomous Bite's Fort venom noted); Prickly Pear is defensive (no
  // row). When wielding manufactured weapons, natural attacks are SECONDARY
  // (−5, ½ Str) — advisory in the tooltip, not auto-applied.
  {
    const hasBiteRider = { acid: (c.mutations || []).some(m => m.name === 'Acidic Saliva'), venom: (c.mutations || []).some(m => m.name === 'Venomous Bite') };
    const wieldingWeapons = out.length > 0;
    for (const m of (c.mutations || [])) {
      const fx = MUTATION_EFFECTS[m.name];
      for (const nat of ((fx && fx.natural) || [])) {
        const pm = /^([a-z ]+?)(?: slam)? — ([a-z]+(?: or [a-z]+)?): S (\dd\d+) \/ M (\dd\d+) \/ L (\dd\d+)/i.exec(nat);
        if (!pm) continue;  // riders/defensive entries don't match the row format
        const natName = pm[1].trim(), natType = pm[2].split(' ')[0].trim();
        // v8.8.2: the die follows the EFFECTIVE size — race base (Small races
        // finally get their S die, previously M unconditionally) stepped up
        // one category per Strong super-talent (Su rider, HH p.263). Beyond
        // the catalogued L die, the standard step-up ladder continues.
        const szIdx = effectiveSizeIndex(c);
        let die;
        if (szIdx <= 3) die = pm[3];
        else if (szIdx === 4) die = pm[4];
        else {
          die = pm[5];
          for (let s = 5; s < szIdx; s++) die = DIE_STEP_UP[die] || die;
        }
        const szNote = szIdx !== raceSizeIndex(c) ? ` Damage die reads as ${SIZE_LADDER[szIdx]} — Super-Strong size riders (Su).` : '';
        const _effN = effAttrs(c);
        const strMN = am(_effN[0]);
        // v9.7.0 (§257): "natural attacks are always considered light
        // weapons" (Weapon Finesse's own Note, HH p.255) — the Dex
        // substitution reaches these rows, shield clause included.
        const dexMN = am(_effN[1]);
        const finN = (c.feats || []).some(f => (f.name || f.n) === 'Weapon Finesse') && dexMN > strMN;
        const abilN = finN ? dexMN : strMN;
        let atkN = (c.bab || 0) + abilN;
        const modsN = [{ label: 'Base Attack Bonus', value: c.bab || 0 }, { label: finN ? 'Dex modifier (Weapon Finesse — natural attacks count as light)' : 'Str modifier', value: abilN }];
        if (finN) { const aN = finesseShieldACP(c); if (aN < 0) { atkN += aN; modsN.push({ label: 'Shield armor check penalty (Weapon Finesse, HH p.255)', value: aN }); } }
        { const szmN = raceACSizeMod(c);
          if (szmN) { atkN += szmN; modsN.push({ label: `Size (${SIZE_LADDER[raceSizeIndex(c)]})`, value: szmN }); } }
        const apN = nonProficientArmorPenalty(c);
        if (apN.total < 0) { atkN += apN.total; for (const p of apN.parts) modsN.push({ label: `${p.name} (not proficient — armor check penalty)`, value: p.acp }); }
        const dmgPartsN = [];
        if (strMN) dmgPartsN.push({ label: 'Str modifier', value: strMN });
        if (meleeDmgBonus > 0) dmgPartsN.push({ label: `Melee Smash talents${_hasSuperSmash ? ' (Super-Smash)' : ''}`, value: meleeDmgBonus });
        const ebN = (c.euphoric) ? euphoriacBonus(c) : 0;
        if (ebN) { atkN += ebN; modsN.push({ label: 'Euphoriac morale (post-surge)', value: ebN }); dmgPartsN.push({ label: 'Euphoriac morale (post-surge)', value: ebN }); }
        // v8.59.0: declared stances — natural weapons are melee and EXEMPT
        // from the light-weapon exclusion (HH p.235: full PA bonus applies).
        const _declN = combatDecl(c);
        if (_declN.pa + _declN.ce > 0) {
          atkN -= (_declN.pa + _declN.ce);
          if (_declN.pa) { modsN.push({ label: 'Power Attack (declared stance)', value: -_declN.pa }); dmgPartsN.push({ label: 'Power Attack (declared — natural weapon, full bonus)', value: _declN.pa }); }
          if (_declN.ce) modsN.push({ label: `Combat Expertise (declared — Defense +${_declN.ce})`, value: -_declN.ce });
        }
        // v8.63.0: Reckless Offense — natural weapons are melee attacks too.
        if (_declN.ro) { atkN += 2; modsN.push({ label: 'Reckless Offense (declared — AC −4)', value: 2 }); }
        if (_declN.bd) { atkN += _declN.bd; modsN.push({ label: `Best Defense (declared — Defense −${_declN.bd})`, value: _declN.bd }); }
        const dmgSumN = dmgPartsN.reduce((s, p) => s + p.value, 0);
        let dmgN = die + (dmgSumN ? `${dmgSumN > 0 ? '+' : ''}${dmgSumN}` : '');
        const isBite = /bite/i.test(natName) || m.name === 'Fangs';
        if (isBite && hasBiteRider.acid) dmgN += ' +1d4 acid (Acidic Saliva)';
        if (isBite && hasBiteRider.venom) dmgN += ' + venom (Fort, Venomous Bite)';
        const pseudoN = { type: natType, lethality: 'lethal', pool: 'hit_points', descriptors: [] };
        out.push({
          itemId: null, name: `${natName.charAt(0).toUpperCase() + natName.slice(1)} (${m.name})`, slot: null, hand: null, twfExtraAtks: null,
          typeLabel: `Physical — ${natType.charAt(0).toUpperCase() + natType.slice(1)} · natural weapon`,
          statStrip: 'crit 20/×2',
          attackBonus: atkN, damage: dmgN, dmgBreakdown: dmgPartsN, damageTypes: [natType],
          damageLabel: DamageResolver.renderLabel(pseudoN), resistances: DamageResolver.applicableResistances(pseudoN),
          proficient: true, mods: modsN, altModes: (() => { const sp = weaponSpikeInfo(c, 'unarmed', atkN); return sp ? [sp] : []; })(), unarmed: true,
          unarmedNote: `Natural weapon (${m.name}). Always armed — no attack of opportunity.${szNote}${wieldingWeapons ? ' While wielding manufactured weapons, natural attacks are SECONDARY: −5 to hit and ½ Str to damage (apply at the table).' : ''}`,
        });
      }
    }
  }
  if (!out.length) {
    const ownsF = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
    const _eff = effAttrs(c);
    const strM = am(_eff[0]);
    const bab = c.bab || 0;
    const small = raceSizeIndex(c) === 3;  // v8.68.0: routed through the size resolver (Hybrid-aware)
    // v9.7.0 (§257): the unarmed strike is a light weapon — Weapon Finesse's
    // Dex substitution (and its shield clause) reaches it (HH p.255).
    const dexMU = am(_eff[1]);
    const finU = ownsF('Weapon Finesse') && dexMU > strM;
    let attackBonus = bab + (finU ? dexMU : strM);
    const mods = [
      { label: 'Base Attack Bonus', value: bab },
      { label: finU ? 'Dex modifier (Weapon Finesse — unarmed strike is a light weapon)' : 'Str modifier', value: finU ? dexMU : strM },
    ];
    if (finU) { const aU = finesseShieldACP(c); if (aU < 0) { attackBonus += aU; mods.push({ label: 'Shield armor check penalty (Weapon Finesse, HH p.255)', value: aU }); } }
    const comp = ownsF('Improved Brawl') ? 2 : (ownsF('Brawl') ? 1 : 0);
    if (comp) { attackBonus += comp; mods.push({ label: `${comp === 2 ? 'Improved ' : ''}Brawl (competence)`, value: comp }); }
    const wfP = (n) => (c.feats || []).some(f => (f.name || f.n) === n && f.param === 'Unarmed strike');
    if (wfP('Weapon Focus')) { attackBonus += 1; mods.push({ label: 'Weapon Focus', value: 1 }); }
    if (wfP('Greater Weapon Focus')) { attackBonus += 1; mods.push({ label: 'Greater Weapon Focus', value: 1 }); }
    const armorPen = nonProficientArmorPenalty(c);
    if (armorPen.total < 0) {
      attackBonus += armorPen.total;
      for (const p of armorPen.parts) mods.push({ label: `${p.name} (not proficient — armor check penalty)`, value: p.acp });
    }
    const hasCMA = ownsF('Combat Martial Arts');
    const baseDie = small ? '1d2' : '1d3';
    const nlDie = ownsF('Improved Brawl') ? '1d8' : (ownsF('Brawl') ? '1d6' : baseDie);
    // v8.9.1: Martial Artist Living Weapon (Ex) — the CMA lethal die becomes
    // 1d8 (1d10 @4, 2d6 @8); Brawl's nonlethal ladder is expressly unaffected.
    const maLvl = migrateLegacyClasses(c).filter(e => e.name === 'Martial Artist').reduce((s, e) => s + (e.level || 0), 0);
    const cmaDie = maLvl >= 8 ? '2d6' : (maLvl >= 4 ? '1d10' : (maLvl >= 1 ? '1d8' : '1d4'));
    const dmgParts = [];
    if (strM) dmgParts.push({ label: 'Str modifier', value: strM });
    if (wfP('Weapon Specialization')) dmgParts.push({ label: 'Weapon Specialization', value: 2 });
    if (wfP('Greater Weapon Specialization')) dmgParts.push({ label: 'Greater Weapon Specialization', value: 2 });
    if (meleeDmgBonus > 0) dmgParts.push({ label: `Melee Smash talents${_hasSuperSmash ? ' (Super-Smash)' : ''}`, value: meleeDmgBonus });
    const ebU = (c.euphoric) ? euphoriacBonus(c) : 0;
    if (ebU) { attackBonus += ebU; mods.push({ label: 'Euphoriac morale (post-surge)', value: ebU }); dmgParts.push({ label: 'Euphoriac morale (post-surge)', value: ebU }); }
    // v8.59.0: declared stances — the unarmed strike is melee and EXEMPT
    // from the light-weapon exclusion (HH p.235: full PA bonus applies).
    const _declU = combatDecl(c);
    if (_declU.pa + _declU.ce > 0) {
      attackBonus -= (_declU.pa + _declU.ce);
      if (_declU.pa) { mods.push({ label: 'Power Attack (declared stance)', value: -_declU.pa }); dmgParts.push({ label: 'Power Attack (declared — unarmed, full bonus)', value: _declU.pa }); }
      if (_declU.ce) mods.push({ label: `Combat Expertise (declared — Defense +${_declU.ce})`, value: -_declU.ce });
    }
    // v8.63.0: Reckless Offense — the unarmed strike is a melee attack.
    if (_declU.ro) { attackBonus += 2; mods.push({ label: 'Reckless Offense (declared — AC −4)', value: 2 }); }
    if (_declU.bd) { attackBonus += _declU.bd; mods.push({ label: `Best Defense (declared — Defense −${_declU.bd})`, value: _declU.bd }); }
    const dmgSum = dmgParts.reduce((s, p) => s + p.value, 0);
    const sumSufx = dmgSum ? `${dmgSum > 0 ? '+' : ''}${dmgSum}` : '';
    let damage = `${nlDie}${sumSufx} nonlethal` + (hasCMA ? ` / ${cmaDie}${sumSufx} lethal (CMA${maLvl >= 1 ? ' — Living Weapon' : ''})` : '');
    const threat = ownsF('Improved Combat Martial Arts') ? '19–20' : '20';
    const critMult = ownsF('Advanced Combat Martial Arts') ? '×3' : '×2';
    if (threat !== '20' || critMult !== '×2') damage += ` · crit ${threat}/${critMult}`;
    const altModes = [];
    // v8.59.0: Power Fist spike on the unarmed row (Monk's granted copies at
    // 8th/14th arrive as real feat records, so they qualify automatically).
    { const spU = weaponSpikeInfo(c, 'unarmed', attackBonus); if (spU) altModes.push(spU); }
    // v8.61.0: Whirlwind rides the unarmed row too (it's a melee attack).
    if (ownsFeatN(c, 'Whirlwind Attack')) {
      altModes.push({ name: 'Whirlwind Attack', atk: attackBonus, dmgMult: 1,
        display: `${attackBonus >= 0 ? '+' : ''}${attackBonus} vs EVERY adjacent foe`,
        label: 'Whirlwind Attack (full attack action): one melee attack at your full base attack bonus against every opponent you threaten.' });
    }
    // v8.65.0 (Adam's go): Elemental Fist — the Elementalist's at-will
    // attack form as an unarmed alt mode (GMG p.165; full math on the
    // 🔥 Elemental Arsenal panel).
    {
      const _eleL = _cfLvlOf(c, 'Elementalist');
      if (_eleL >= 1) {
        const _vn = ((((c.classChoices || {})['ele_var_1']) || '').match(/^(Ambrian|Kryonian|Vesuvian|Vitrolian)/) || [])[1];
        const _em = { Ambrian: 'electricity', Kryonian: 'cold', Vesuvian: 'fire' }[_vn];
        altModes.push({ name: 'Elemental Fist', atk: attackBonus, dmgMult: 1,
          display: _vn === 'Vitrolian' ? '2d6 bludgeoning + Str (stone fist)' : `2d6 ${_em || 'element'} per TOUCH`,
          label: `Elemental Fist (Su, move action to invoke): your element engulfs your hand — unarmed counts as ARMED${_vn === 'Vitrolian' ? ', 2d6 bludgeoning + Str per hit' : `, 2d6 ${_em || '(choose the Elemental Focus in Class Choices)'} per successful melee TOUCH attack`}. At-will; full math on the 🔥 Elemental Arsenal panel (Tracker). GMG p.165.` });
      }
    }
    const monkLvl = migrateLegacyClasses(c).filter(e => e.name === 'Monk').reduce((s, e) => s + (e.level || 0), 0);
    if (monkLvl > 0 && !wearingArmorCategory(c)) {
      // v8.64.0 (Phase 2 sift): Greater Flurry at Monk 11 — a SECOND extra
      // attack at the highest bonus on the same full attack (HH p.87).
      const gfl = monkLvl >= 11;
      altModes.push({
        name: gfl ? 'Greater Flurry' : 'Flurry of Blows', atk: attackBonus - 2, dmgMult: 1,
        display: `${gfl ? 'TWO extra attacks' : 'extra attack'}, all at ${(attackBonus - 2) >= 0 ? '+' : ''}${attackBonus - 2}`,
        label: `Virtual Two-Weapon Fighting while using only unarmed attacks and unarmored: one extra unarmed attack per round, all unarmed attacks that round at −2. Requires the full attack action.${gfl ? ' GREATER FLURRY (11th): the flurry comes even faster — one ADDITIONAL attack at your highest attack bonus on the same full attack.' : ''}`,
      });
    }
    // v8.9.1: Martial Artist 7+ Flurry of Blows (Ex) — same shape, its own
    // source; also surface the Iron/Diamond Fist strike and no-off-hand note.
    if (maLvl >= 7 && monkLvl <= 0 && !wearingArmorCategory(c)) {
      altModes.push({
        name: 'Flurry of Blows', atk: attackBonus - 2, dmgMult: 1,
        display: `extra attack, all at ${(attackBonus - 2) >= 0 ? '+' : ''}${attackBonus - 2}`,
        label: 'Martial Artist: unarmored, unarmed full attack — one extra attack at highest BAB, every attack that round at −2 (AoOs included).',
      });
    }
    if (maLvl >= 5) {
      const dfx = maLvl >= 10;
      altModes.push({
        name: dfx ? 'Diamond Fist' : 'Iron Fist', atk: attackBonus + (dfx ? 4 : 1), dmgMult: 1,
        display: `${dfx ? '+4' : '+1'} hit/dmg strike${dfx ? ' (adamantine)' : ' (magic)'}`,
        label: dfx
          ? 'Diamond Fist (Su): move action to focus — next unarmed strike at +4 hit/damage, counts as ADAMANTINE (ignores 20 hardness). Base Iron Fist now needs no check.'
          : 'Iron Fist (Ex): move action, Concentration DC 20 — next unarmed strike counts as a +1 MAGIC weapon (+1 hit/damage, ignores 5 hardness, beats DR/magic). Usable at will.',
      });
    }
    const pseudo = { type: 'bludgeoning', lethality: hasCMA ? 'lethal' : 'nonlethal', pool: 'hit_points', descriptors: [] };
    out.push({
      itemId: null, name: 'Unarmed strike', slot: 'main_hand', hand: null, twfExtraAtks: null,
      typeLabel: `Physical — Bludgeoning${hasCMA ? '' : ' (nonlethal)'}`,
      statStrip: `crit ${threat}/${critMult}`,
      attackBonus, damage, dmgBreakdown: dmgParts, damageTypes: ['bludgeoning'],
      damageLabel: DamageResolver.renderLabel(pseudo), resistances: DamageResolver.applicableResistances(pseudo),
      // v8.60.0: the unarmed strike iterates like any weapon attack.
      fullAttack: (() => { const fa = []; const nAtk = Math.min(5, 1 + Math.floor((c.bab || 0) / 5)); for (let i = 0; i < nAtk; i++) fa.push(attackBonus - 5 * i); return fa; })(),
      // v8.61.0: unarmed maneuvers (counts light; trips provoke) + riders.
      maneuvers: computeManeuvers(c, { attackBonus, wield2H: false, isLight: true, isUnarmed: true, weaponName: 'Unarmed strike' }),
      riders: [...combatRiders(c, 'melee'), ...combatRiders(c, 'unarmed')],
      proficient: true, mods, altModes, unarmed: true,
      unarmedNote: `Light weapon; can't be disarmed. ${hasCMA ? 'Counts as ARMED (Combat Martial Arts) — no attack of opportunity.' : 'Unarmed attacks provoke attacks of opportunity (no martial-arts feat).'}`,
    });
  }
  // v8.42.0: transient wired buffs (Divine Favor, Precognition Offensive,
  // Prescience Offensive, True Strike…) — ONE post-pass over every row
  // (equipped, natural, unarmed) so no attack surface is missed. Typed
  // aggregation first (two insight sources don't stack), then each applied
  // entry lands in the mods/dmgBreakdown lists with its caveat label.
  try {
    const aeWB = activeBuffBonuses(c);
    const atkApplied = (aeWB.attack && aeWB.attack.length) ? aggregateBonuses(aeWB.attack) : null;
    const dmgApplied = (aeWB.damage && aeWB.damage.length) ? aggregateBonuses(aeWB.damage) : null;
    if ((atkApplied && atkApplied.total) || (dmgApplied && dmgApplied.total)) {
      for (const row of out) {
        if (atkApplied && atkApplied.total) {
          row.attackBonus += atkApplied.total;
          for (const b of (atkApplied.breakdown && atkApplied.breakdown.applied) || []) (row.mods = row.mods || []).push({ label: b.label, value: b.value });
        }
        if (dmgApplied && dmgApplied.total) {
          row.damage = `${row.damage}+${dmgApplied.total}`;
          for (const b of (dmgApplied.breakdown && dmgApplied.breakdown.applied) || []) (row.dmgBreakdown = row.dmgBreakdown || []).push({ label: b.label, value: b.value });
        }
      }
    }
  } catch (e) { /* buffs are decorative on top of weapon math — never break the Gear page */ }
  return out;
}

// ----- Item mutation (mirrors addFeatToChar's chars/curId/save() idiom) -----

