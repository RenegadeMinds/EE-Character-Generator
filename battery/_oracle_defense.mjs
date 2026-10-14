// _oracle_defense.mjs — ORACLE SWEEP D7 (2026-10-13): Defense Bonus.
// Book rules: HH PDF p.52 — each class taken contributes its "Defense Bonus
// modifier" (stacking); HH PDF p.14 — "Defense Bonus is applied to a
// character's Armour Class, as well as to their Parry and Dodge modifiers";
// HH PDF p.42 — Ordinary classes are "the functional equivalent of the Hero
// classes, except with no Class Features, Defense Bonus, Reputation Bonus,
// or Action Points". Oracle: Σ book DB column (Ordinary tiers contribute 0),
// AC = 10 + Dex mod + ΣDB for an unarmored Medium Human.
import { openCG, parseClassTables, dumpCGClasses, cgNamesFor, firstDiff, reporter, sum } from './_oracle_lib.mjs';

const BOOK = { ...parseClassTables('hh'), ...parseClassTables('gmg') };
const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D7 — Defense Bonus tables + stacking');
const CG = await dumpCGClasses(page);

for (const [bn, b] of Object.entries(BOOK)) {
  for (const n of cgNamesFor(bn, CG)) {
    const d = firstDiff(b.def, CG[n].def, b.levels);
    const dr = firstDiff(b.rep, CG[n].rep, b.levels);
    R.mark(`TABLE-DB ${n} (${b.book.toUpperCase()} PDF p.${b.page})`, !d, d ? d.all : '');
    if (dr) R.mark(`TABLE-REP ${n}`, false, dr.all);
  }
}

// Ordinary tier: the book grants NO Defense Bonus and NO Reputation.
for (const n of Object.keys(CG).filter(n => CG[n].tier === 'ordinary')) {
  const nz = CG[n].def.some(v => v) || CG[n].rep.some(v => v);
  R.mark(`ORDINARY-NO-DB/REP ${n} (HH PDF p.42)`, !nz, nz ? `CG def[0..9]=${JSON.stringify(CG[n].def)} rep=${JSON.stringify(CG[n].rep)}` : '');
}
const ord = await page.evaluate(() => {
  const c = __oracleChar({ attrs: [10, 14, 10, 10, 10, 10], classes: [{ tier: 'ordinary', name: 'Fast Ordinary', level: 5, first: true }] });
  const sb = computeStatBlock(c);
  return { def: sb.def.total, ac: sb.ac.total, rep: sb.rep.total };
});
R.mark('ORDINARY-ENGINE Fast Ordinary 5, Dex 14', ord.def === 0 && ord.ac === 12 && ord.rep === 0,
  `book DB +0, AC 12, Rep +0; CG DB +${ord.def}, AC ${ord.ac}, Rep +${ord.rep}`);

// Stacking + AC through the live engine (Dex 14 → +2).
const SCEN = [
  { id: 'Fast Hero 3 / Charismatic Hero 1', cls: [['hero', 'Fast Hero', 3], ['hero', 'Charismatic Hero', 1]] },
  { id: 'Strong Hero 2 / Monk 6 / Martial Artist 3', cls: [['hero', 'Strong Hero', 2], ['basic', 'Monk', 6], ['advanced', 'Martial Artist', 3]] },
  { id: 'Rogue 8 / Infiltrator 4 / Assassin 3', cls: [['basic', 'Rogue', 8], ['advanced', 'Infiltrator', 4], ['prestige', 'Assassin', 3]] },
];
for (const s of SCEN) {
  const db = sum(s.cls.map(([, n, l]) => BOOK[n].def[l - 1]));
  const obs = await page.evaluate((cls) => {
    const c = __oracleChar({ attrs: [10, 14, 10, 10, 10, 10], classes: cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 })) });
    const sb = computeStatBlock(c);
    return { def: sb.def.total, ac: sb.ac.total };
  }, s.cls);
  R.mark(`STACK-DB ${s.id}`, obs.def === db && obs.ac === 10 + 2 + db,
    `book ΣDB +${db}, AC ${12 + db}; CG DB +${obs.def}, AC ${obs.ac}`);
}

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
