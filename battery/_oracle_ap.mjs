// _oracle_ap.mjs — ORACLE SWEEP D9 (2026-10-13): Action Point grants.
// Book rules:
//   • every class entry prints its own grant: "gain a number of Action
//     Points equal to N + one-half their character level, rounded down, at
//     1st level and every time they attain a new level in this class" —
//     N = 5 (Strong/Fast/Tough/Smart/Dedicated Hero), 6 (Charismatic Hero,
//     every Advanced class, some Prestige), 7 (Survivor, Super-Hero), or
//     "their Charisma modifier [minimum +0, maximum +5]" (every Basic class,
//     most Prestige) — HH PDF p.56-144, GMG p.153-188 (parsed);
//   • HH PDF p.54: "Action Points (AP) are only available in Heroic Scale 1
//     and higher scenarios"; "the AP pool replenishes at each level, and any
//     unused AP are lost";
//   • HH PDF p.42: Ordinary classes have no Action Points;
//   • HH PDF p.55: a Fate Point is "the permanent expenditure of an AP".
// NOTE: the sweep brief said "hero classes only" — the book contradicts
// that (Basic/Advanced/Prestige classes all print a grant); the oracle
// follows the book.
import { openCG, parseClassTables, dumpCGClasses, cgNamesFor, reporter } from './_oracle_lib.mjs';

const BOOK = { ...parseClassTables('hh'), ...parseClassTables('gmg') };
const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D9 — Action Points');
const CG = await dumpCGClasses(page);

const apBad = [];
for (const [bn, b] of Object.entries(BOOK)) {
  if (!b.ap) continue;
  for (const n of cgNamesFor(bn, CG)) if (CG[n].apB !== b.ap.apB) apBad.push(`${n}: book ${b.ap.apB}, CG ${CG[n].apB}`);
}
R.mark(`AP-BASE per class (${Object.keys(BOOK).length} book entries)`, !apBad.length, apBad.join('; '));

const ap = (cls, over = {}) => page.evaluate((cls, over) => {
  const c = __oracleChar(Object.assign({ classes: cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 })) }, over));
  const v8 = computeStatBlock(c).ap;
  const v7 = computeStatsFromClasses(c.classes, c.attrs[5], effectiveHeroicLevelForAP(c), c.fatePoints || 0).ap;
  return { v8, v7 };
}, cls, over);
const CASES = [
  ['Strong Hero 1', [['hero', 'Strong Hero', 1]], {}, 5 + 0],
  ['Charismatic Hero 3', [['hero', 'Charismatic Hero', 3]], {}, 6 + 1],
  ['Fighter 4, Cha 14', [['basic', 'Fighter', 4]], { attrs: [10, 10, 10, 10, 10, 14] }, 2 + 2],
  ['Fighter 4, Cha 30 (mod capped +5)', [['basic', 'Fighter', 4]], { attrs: [10, 10, 10, 10, 10, 30] }, 5 + 2],
  ['Fighter 4, Cha 6 (mod floored +0)', [['basic', 'Fighter', 4]], { attrs: [10, 10, 10, 10, 10, 6] }, 0 + 2],
  ['Survivor via Tough Hero 3 / Survivor 2', [['hero', 'Tough Hero', 3], ['advanced', 'Survivor', 2]], {}, 7 + 2],
  ['Strong Hero 5 at Heroic Scale 0', [['hero', 'Strong Hero', 5]], { sixLevels: { arcane: 5, divine: 5, heroic: 0, mutation: 0, psionic: 5, tech: 5 } }, 0],
  ['Strong Ordinary 5 (no AP)', [['ordinary', 'Strong Ordinary', 5]], {}, 0],
  ['Strong Hero 4 with 2 Fate Points spent', [['hero', 'Strong Hero', 4]], { fatePoints: 2 }, 5 + 2 - 2],
];
for (const [id, cls, over, exp] of CASES) {
  const o = await ap(cls, over);
  R.mark(`AP ${id}`, o.v8 === exp && o.v7 === exp, `book ${exp}; CG v8 ${o.v8}, v7 ${o.v7}`);
}
// Multiclass: the book keys the grant to "a new level in THIS class"; a
// Strong Hero 2 / Fighter 2 (Cha 10) whose latest level was Fighter would
// replenish to 0 + 2 = 2, one whose latest level was Strong Hero to 5 + 2 = 7.
const mc = await ap([['hero', 'Strong Hero', 2], ['basic', 'Fighter', 2]]);
R.mark('AP MULTICLASS Strong Hero 2 / Fighter 2 (Cha 10), latest level = Fighter', mc.v8 === 2,
  `book (per-class grant, latest class) 2 — or 7 if latest was Strong Hero; CG ${mc.v8} (best apB across classes — order-blind)`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
