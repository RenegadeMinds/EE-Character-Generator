// _oracle_hp.mjs — ORACLE SWEEP D5 (2026-10-13): hit points & HP modes.
// Book text available to the oracle:
//   • every class entry: "Hit Die (of the Hero): dN (d(N/2)+N/2)" — the
//     parenthetical is the Hero's Hit Die (HH PDF p.56ff, GMG p.153ff);
//   • HH PDF p.350 "Hit Points": "based on the character's class hit die and
//     level, and the character's Constitution modifier applies to each hit
//     die" (+5 HP per +1 natural AC);
//   • HH PDF p.21: on an attribute increase, "If it causes an increase in
//     your attribute modifier, then be sure to update all the associated
//     modifiers accordingly" — a Con-mod rise reaches every hit die.
// NOT in the book text (probed as CG convention, flagged as a book gap):
// the random / hero / max mode menu and "first level always max".
import { openCG, parseClassTables, dumpCGClasses, cgNamesFor, reporter } from './_oracle_lib.mjs';

const BOOK = { ...parseClassTables('hh'), ...parseClassTables('gmg') };
const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D5 — Hit Dice, Hero\'s Hit Die, HP modes');
const CG = await dumpCGClasses(page);

// 1. Hit Die per class, and the printed Hero's-HD parenthetical's shape.
const hdBad = [], heroBad = [], noParen = [];
for (const [bn, b] of Object.entries(BOOK)) {
  if (!b.hd) continue;
  if (b.hd.heroDie == null) noParen.push(`${bn} (${b.book.toUpperCase()} PDF p.${b.hd.page})`);
  else if (b.hd.heroDie * 2 !== b.hd.hd || b.hd.heroAdd * 2 !== b.hd.hd) heroBad.push(`${bn}: d${b.hd.hd} (d${b.hd.heroDie}+${b.hd.heroAdd})`);
  for (const n of cgNamesFor(bn, CG)) if (CG[n].hd !== b.hd.hd) hdBad.push(`${n}: book d${b.hd.hd}, CG d${CG[n].hd}`);
}
R.mark(`HD-TABLE class Hit Die (${Object.keys(BOOK).length} book entries)`, !hdBad.length, hdBad.join('; '));
R.mark('HERO-HD parenthetical is always d(N/2)+N/2', !heroBad.length, heroBad.join('; '));
if (noParen.length) R.info('entries printing NO Hero\'s-HD parenthetical: ' + noParen.join(', '));

// 2. The three roll modes, by simulation (6000 rolls per die per mode).
const sim = await page.evaluate(() => {
  const o = {};
  for (const hd of [4, 6, 8, 10, 12]) for (const mode of ['random', 'hero', 'max']) {
    let mn = 99, mx = 0, s = 0; const N = 6000;
    for (let i = 0; i < N; i++) { const r = rollHitDieForMode(hd, mode); mn = Math.min(mn, r); mx = Math.max(mx, r); s += r; }
    o[`${hd}:${mode}`] = { mn, mx, mean: s / N };
  }
  return o;
});
for (const hd of [4, 6, 8, 10, 12]) {
  const h = hd / 2;
  const r = sim[`${hd}:random`], e = sim[`${hd}:hero`], m = sim[`${hd}:max`];
  R.mark(`MODE random d${hd}`, r.mn === 1 && r.mx === hd && Math.abs(r.mean - (hd + 1) / 2) < 0.15, `range ${r.mn}-${r.mx}, mean ${r.mean.toFixed(2)} (expect 1-${hd}, ${(hd + 1) / 2})`);
  R.mark(`MODE hero d${hd} = d${h}+${h}`, e.mn === h + 1 && e.mx === hd && Math.abs(e.mean - (h + (h + 1) / 2)) < 0.12, `range ${e.mn}-${e.mx}, mean ${e.mean.toFixed(2)} (expect ${h + 1}-${hd}, ${h + (h + 1) / 2})`);
  R.mark(`MODE max d${hd}`, m.mn === hd && m.mx === hd, `always ${m.mn}`);
}

// 3. Assembly: first level max (CG convention), Con mod on every die.
const asm = await page.evaluate(() => {
  const cls = [{ tier: 'hero', name: 'Tough Hero', level: 2, first: true }, { tier: 'basic', name: 'Fighter', level: 3 }];
  const rolls = generateHpRolls(cls, 'max');
  const heroRolls = generateHpRolls(cls, 'hero');
  return { rolls, heroFirst: heroRolls[0], hp: computeMaxHPFromRolls(cls, rolls, 2), avg: computeMaxHPFromClasses(cls, 2) };
});
// Tough Hero d10 ×2 + Fighter d10 ×3, all max = 50, + Con +2 × 5 = 60.
R.mark('ASSEMBLY max mode: Tough Hero 2 / Fighter 3, Con +2', asm.hp === 60 && asm.rolls.join() === '10,10,10,10,10', `book 5×10 + 5×2 = 60; CG ${asm.hp} (rolls ${asm.rolls})`);
R.mark('ASSEMBLY first level takes the max die in hero mode (CG convention — not in book text)', asm.heroFirst === 10, `rolls[0]=${asm.heroFirst}`);
// Legacy/auto-assign average: max first + (floor(N/2)+1) thereafter.
R.mark('AVERAGE fallback (reconcileMissingHP formula)', asm.avg === 10 + 4 * 6 + 10, `10 + 4×6 + 5×2 = 44; CG ${asm.avg}`);

// 4. Level-up with a Con bump that raises the Con modifier (HH PDF p.21).
const lu = await page.evaluate(() => {
  chars.length = 0;
  const c = __oracleChar({ name: 'HP Bump', attrs: [10, 10, 13, 10, 10, 10], hpMode: 'max',
    classes: [{ tier: 'hero', name: 'Tough Hero', level: 3, first: true }] });
  c.totalLvl = 3; c.hpRolls = [10, 10, 10]; c.maxHP = 33; c.currentHP = 33;  // 3×10 + 3×(+1)
  c.xp = 6000; c.xpNext = 6000; c.ecl = 3;
  chars.push(c); curId = c.id;
  const errs = [];
  try { checkLevelUp(); } catch (e) { errs.push('check: ' + e); }
  try { const i = _pendingLevelUp.options.findIndex(o => o.kind === 'advance'); lvlupOnClassChoice(i); lvlupGoToHpRoll(); } catch (e) { errs.push('choose: ' + e); }
  try { lvlupSetBumpChoice('CON'); } catch (e) { errs.push('bump: ' + e); }
  try { lvlupCommit(false); } catch (e) { errs.push('commit: ' + String(e).slice(0, 120)); }
  const afterCommit = c.maxHP;
  try { renderSheet(); } catch (e) {}
  const rec = computeMaxHPFromRolls(c.classes, c.hpRolls, am(c.attrs[2]));
  return { con: c.attrs[2], lvl: c.totalLvl, afterCommit, afterSheet: c.maxHP, recomputed: rec, rolls: c.hpRolls, errs };
});
// Book: 4 dice × 10 + 4 × (+2) = 48. Without retro: 33 + 10 + 1 = 44.
R.mark('LEVEL-UP Con 13→14 at L4 back-fills +1 HP on every earlier die', lu.afterCommit === 48 && lu.afterSheet === 48,
  `book 4×10 + 4×(+2) = 48; CG after commit ${lu.afterCommit}, after sheet render ${lu.afterSheet}; CG's own rolls-recompute gives ${lu.recomputed}; Con ${lu.con}, L${lu.lvl}${lu.errs.length ? ' · errs: ' + lu.errs.join(' | ') : ''}`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
