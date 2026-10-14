// _oracle_saves.mjs — ORACLE SWEEP D2 (2026-10-13): multiclass saves.
// Book rule: HH PDF p.52 — each class taken contributes its "save
// modifiers" (and the text expects multiclassing to yield "higher-than-
// average saving throw bonuses", i.e. plain stacking — no "best good save
// once" rule); HH PDF p.349-350 — Fort adds Con mod, Ref Dex mod, Will Wis
// mod. Oracle: Σ book-table[class][lvl] + attribute modifier.
import { openCG, parseClassTables, dumpCGClasses, cgNamesFor, firstDiff, reporter, sum } from './_oracle_lib.mjs';

const BOOK = { ...parseClassTables('hh'), ...parseClassTables('gmg') };
const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D2 — save tables + multiclass stacking');
const CG = await dumpCGClasses(page);

for (const [bn, b] of Object.entries(BOOK)) {
  for (const n of cgNamesFor(bn, CG)) {
    for (const k of ['fort', 'ref', 'will']) {
      const d = firstDiff(b[k], CG[n][k], b.levels);
      if (d) R.mark(`TABLE-${k.toUpperCase()} ${n} (${b.book.toUpperCase()} PDF p.${b.page})`, false, d.all);
    }
    R.mark(`TABLE-SAVES ${n}`, ['fort', 'ref', 'will'].every(k => !firstDiff(b[k], CG[n][k], b.levels)));
  }
}

// Stacking through the live engine with non-zero attribute mods:
// Dex 12 (+1), Con 14 (+2), Wis 16 (+3). Classes chosen to carry NO
// save-granting class features (no Divine Grace / Self-Control /
// Strong Personality), so the oracle is table + attribute only.
const ATTRS = [10, 12, 14, 10, 16, 10];
const MOD = { fort: 2, ref: 1, will: 3 };
const SCEN = [
  { id: 'Strong Hero 2 / Fast Hero 1', cls: [['hero', 'Strong Hero', 2], ['hero', 'Fast Hero', 1]] },
  { id: 'Tough Hero 3 / Fighter 4 / Rogue 2', cls: [['hero', 'Tough Hero', 3], ['basic', 'Fighter', 4], ['basic', 'Rogue', 2]] },
  { id: 'Dedicated Hero 2 / Cleric 5 / Combat Medic 3', cls: [['hero', 'Dedicated Hero', 2], ['basic', 'Cleric', 5], ['advanced', 'Combat Medic', 3]] },
  { id: 'Wizard 7 / Expert 3 / Loremaster 4', cls: [['basic', 'Wizard', 7], ['basic', 'Expert', 3], ['prestige', 'Loremaster', 4]] },
];
for (const s of SCEN) {
  const exp = {};
  for (const k of ['fort', 'ref', 'will']) exp[k] = sum(s.cls.map(([, n, l]) => BOOK[n][k][l - 1])) + MOD[k];
  const obs = await page.evaluate((cls, attrs) => {
    const c = __oracleChar({ attrs, classes: cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 })) });
    const sb = computeStatBlock(c);
    return { fort: sb.fort.total, ref: sb.ref.total, will: sb.will.total, parity: verifyParity(c).match };
  }, s.cls, ATTRS);
  const ok = ['fort', 'ref', 'will'].every(k => obs[k] === exp[k]) && obs.parity;
  R.mark(`STACK-SAVES ${s.id}`, ok, `book F/R/W +${exp.fort}/+${exp.ref}/+${exp.will}; CG +${obs.fort}/+${obs.ref}/+${obs.will}; parity ${obs.parity}`);
}

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
