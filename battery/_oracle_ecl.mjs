// _oracle_ecl.mjs — ORACLE SWEEP D4 (2026-10-13): Effective Character Level.
// Book rules: HH PDF p.22 — "they add the levels they've earned in character
// classes to their racial level modifier to get their ECL"; table: Drow +2,
// Dromite +1, Duergar +1, others +0. HH PDF p.53 — "Table: Experience Point
// Thresholds for Effective Character Levels (ECL) 1-20" (parsed below) and
// "Keep in mind any ECL modifiers from race ... when calculating XP
// thresholds for your character's next level".
import { openCG, bookLines, reporter } from './_oracle_lib.mjs';

// Oracle XP table, parsed from the book: rows like "1 0 11 55,000 53".
const L = bookLines('hh');
const i0 = L.findIndex(l => /^Table: Experience Point Thresholds for Effective Character Levels/.test(l.text));
const XP = {};
for (let j = i0 + 1; j < i0 + 14; j++) {
  const m = L[j].text.match(/^(\d+) ([\d,]+) (\d+) ([\d,]+)/);
  if (m) { XP[+m[1]] = +m[2].replace(/,/g, ''); XP[+m[3]] = +m[4].replace(/,/g, ''); }
}
const RLM = {};
const t0 = L.findIndex(l => /^Table: Racial Ability Adjustments, Level Modifiers/.test(l.text));
for (let j = t0 + 2; j < t0 + 14; j++) {
  const m = L[j].text.match(/^(\w+) .*?([+-]\d+) (?:Common|As original)/);
  if (m) RLM[m[1]] = +m[2];
}

const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D4 — ECL = class levels + racial level modifier');

const cgXP = await page.evaluate(() => Array.from({ length: 20 }, (_, i) => xpThreshold(i + 1)));
const xpBad = Object.keys(XP).map(Number).filter(l => cgXP[l - 1] !== XP[l]);
R.mark(`XP-TABLE ECL 1-20 (HH PDF p.53; ${Object.keys(XP).length} rows parsed)`, Object.keys(XP).length === 20 && !xpBad.length,
  xpBad.map(l => `ECL ${l}: book ${XP[l]}, CG ${cgXP[l - 1]}`).join('; '));

const raceCG = await page.evaluate((names) => Object.fromEntries(names.map(n => [n, (RACES[n] || {}).ecl ?? null])), Object.keys(RLM));
const rlmBad = Object.keys(RLM).filter(n => n !== 'Mutant' && (raceCG[n] ?? 0) !== RLM[n]);
R.mark(`RLM-TABLE (HH PDF p.22; ${Object.keys(RLM).length} races)`, !rlmBad.length, rlmBad.map(n => `${n}: book +${RLM[n]}, CG ${raceCG[n]}`).join('; ') || JSON.stringify(RLM));

const ecl = (race, cls, stamp = true) => page.evaluate((race, cls, stamp) => {
  const c = __oracleChar({ race, classes: cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 })) });
  if (stamp) c.totalLvl = c.classes.reduce((s, e) => s + e.level, 0);
  refreshEclXp(c);
  return { ecl: c.ecl, xpNext: c.xpNext };
}, race, cls, stamp);

for (const [race, cls] of [['Human', [['hero', 'Strong Hero', 3]]], ['Drow', [['hero', 'Strong Hero', 3]]],
  ['Dromite', [['basic', 'Fighter', 2], ['basic', 'Rogue', 1]]], ['Duergar', [['basic', 'Fighter', 7], ['advanced', 'Soldier', 2]]]]) {
  const lv = cls.reduce((s, x) => s + x[2], 0); const exp = lv + RLM[race];
  const o = await ecl(race, cls);
  R.mark(`ECL ${race} ${cls.map(x => x[1] + ' ' + x[2]).join('/')}`, o.ecl === exp && o.xpNext === XP[exp + 1],
    `book ECL ${lv}+${RLM[race]} = ${exp}, next level at ${XP[exp + 1]} XP; CG ECL ${o.ecl}, xpNext ${o.xpNext}`);
}

// The real save path (create form → saveCharacter) for a Drow.
const saved = await page.evaluate(async () => {
  gateState = 'sandbox'; _firstSaveConfirmed = true;
  window.confirmModal = async () => true; window.promptProvenance = async () => '';
  document.getElementById('c-name').value = 'ECL Drow';
  const rs = document.getElementById('c-race'); rs.value = 'Drow'; rs.dispatchEvent(new Event('change'));
  formClasses.length = 0; formClasses.push({ name: 'Fast Hero', tier: 'hero', level: 1, first: true });
  await saveCharacter();
  const c = chars.find(x => x.name === 'ECL Drow');
  return c ? { ecl: c.ecl, xpNext: c.xpNext, totalLvl: c.totalLvl, xp: c.xp } : null;
});
R.mark('SAVE-PATH Drow Fast Hero 1 via saveCharacter()', !!saved && saved.ecl === 3 && saved.xpNext === XP[4],
  `book ECL 1+2 = 3, next at ${XP[4]}; CG ${JSON.stringify(saved)}`);

// A record without a stamped c.totalLvl (what importCreatureSeed writes).
const o = await ecl('Drow', [['basic', 'Fighter', 6]], false);
R.mark('UNSTAMPED Drow Fighter 6 (no c.totalLvl on the record)', o.ecl === 8, `book 6+2 = 8; CG ECL ${o.ecl}`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
