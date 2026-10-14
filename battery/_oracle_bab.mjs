// _oracle_bab.mjs — ORACLE SWEEP D1 (2026-10-13): multiclass Base Attack.
// Book rule (HH PDF p.52, "Multiclassing" + "Advancing a Level" p.53): each
// class contributes its own table value ("receives all the modifiers ... in
// each ... class taken, including Base Attack modifiers"), so a multiclass
// character's Base Attack = Σ table[class][classLevel]. Oracle = the book's
// "Class Statistics by Level" tables parsed straight from hh_text/gmg_text.
import { openCG, parseClassTables, dumpCGClasses, cgNamesFor, firstDiff, reporter, sum } from './_oracle_lib.mjs';

const BOOK = { ...parseClassTables('hh'), ...parseClassTables('gmg') };
const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D1 — Base Attack tables + multiclass stacking');
const CG = await dumpCGClasses(page);

// 1. Table fidelity: every book class table vs the CG's bab array.
let unmatched = [];
for (const [bn, b] of Object.entries(BOOK)) {
  const names = cgNamesFor(bn, CG);
  if (!names.length) { unmatched.push(bn); continue; }
  for (const n of names) {
    const d = firstDiff(b.bab, CG[n].bab, b.levels);
    R.mark(`TABLE-BAB ${n} (${b.book.toUpperCase()} PDF p.${b.page})`, !d, d ? d.all : '');
  }
}
if (unmatched.length) R.info('book tables with no CG class: ' + unmatched.join(', '));

// 2. Stacking through the live engine (computeStatBlock = v8 path,
//    computeStatsFromClasses = v7 path, verifyParity = their agreement).
const bk = (n, l) => BOOK[n].bab[l - 1];
const SCEN = [
  { id: '3-HERO START (Smart1/Dedicated1/Charismatic1)', cls: [['hero', 'Smart Hero', 1], ['hero', 'Dedicated Hero', 1], ['hero', 'Charismatic Hero', 1]] },
  { id: 'HERO+BASIC (Strong Hero 3 / Fighter 4)', cls: [['hero', 'Strong Hero', 3], ['basic', 'Fighter', 4]] },
  { id: 'HERO+BASIC+ADV (Fast Hero 2 / Rogue 5 / Soldier 3)', cls: [['hero', 'Fast Hero', 2], ['basic', 'Rogue', 5], ['advanced', 'Soldier', 3]] },
  { id: 'BASIC+BASIC+PRESTIGE (Wizard 6 / Cleric 4 / Loremaster 2)', cls: [['basic', 'Wizard', 6], ['basic', 'Cleric', 4], ['prestige', 'Loremaster', 2]] },
  { id: 'HERO 10 + BASIC 10 (Tough Hero 10 / Berserker 10)', cls: [['hero', 'Tough Hero', 10], ['basic', 'Berserker', 10]] },
];
for (const s of SCEN) {
  const expected = sum(s.cls.map(([, n, l]) => bk(n, l)));
  const obs = await page.evaluate((cls) => {
    const c = __oracleChar({ classes: cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 })) });
    return { v8: computeStatBlock(c).bab.total, v7: computeStatsFromClasses(c.classes).bab, parity: verifyParity(c).match };
  }, s.cls);
  R.mark(`STACK-BAB ${s.id}`, obs.v8 === expected && obs.v7 === expected && obs.parity,
    `book Σ = +${expected}; CG v8 +${obs.v8}, v7 +${obs.v7}, parity ${obs.parity}`);
}

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
