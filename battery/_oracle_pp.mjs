// _oracle_pp.mjs — ORACLE SWEEP D10 (2026-10-13): single-class caster pools.
// Book rules:
//   • base PP/day = the "PP" column of each caster's "Class Statistics by
//     Level" table (HH PDF p.75-108; "--" = 0), parsed;
//   • bonus PP: HH PDF p.393 "Table: Bonus Power Points by Attribute Score"
//     (rows = character level 1-20, columns = score bands 12-13 … 34-35),
//     footnote: "(Attribute modifier x character level)/2, rounded up";
//     HH PDF p.21 restates it per "Manifester Lvl" (+0.5 per point of mod);
//   • the key attribute per class is named in its own "Power Points/Day" /
//     "Spells" paragraph (parsed: "bonus power points … high <Attr> score").
// Pool = base + bonus. Single-class only (multiclass pooling is HH p.53).
import { openCG, bookLines, parseClassTables, reporter } from './_oracle_lib.mjs';

const BOOK = parseClassTables('hh');
const L = bookLines('hh');
// Bonus PP table.
const t0 = L.findIndex(l => /^Table: Bonus Power Points by Attribute Score/.test(l.text));
const BON = {};
for (let j = t0 + 1; j < t0 + 30; j++) {
  const m = L[j].text.match(/^(\d{1,2})((?: \d+){12})/);
  if (m && +m[1] === Object.keys(BON).length + 1) BON[+m[1]] = m[2].trim().split(' ').map(Number);
}
// Key attribute per caster class, from the class's own text.
const KEY = {};
const ATTR = { Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
for (const [n, b] of Object.entries(BOOK)) {
  if (!b.pp) continue;
  const i = L.findIndex(l => l.text === `${n} Class Statistics by Level`);
  {
    const s = L.slice(i, i + 120).map(l => l.text).filter(t => !/===== PAGE/.test(t)).join(' ');
    const m = s.match(/receives? bonus (?:psionic )?(?:power|spell)\s+points\s+per day if they have (?:an? )?(?:high )?(Intelligence|Wisdom|Charisma)(?: or (Intelligence|Wisdom|Charisma))? score/i);
    if (m) KEY[n] = ATTR[m[1]] + (m[2] ? '/' + ATTR[m[2]] : '');
  }
}

const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D10 — power-point pools (single-class casters)');

R.mark(`BONUS-TABLE parsed (HH PDF p.393): ${Object.keys(BON).length} rows`, Object.keys(BON).length === 20);
// Book-internal check: the printed table vs its own footnote formula.
const internal = [];
for (let lv = 1; lv <= 20; lv++) for (let c = 0; c < 12; c++) {
  const mod = c + 1, f = Math.ceil(mod * lv / 2);
  if (BON[lv][c] !== f) internal.push(`L${lv} ${12 + 2 * c}-${13 + 2 * c}: table ${BON[lv][c]}, formula ${f}`);
}
R.mark('BOOK-INTERNAL table vs "(mod × level)/2, rounded up" footnote', !internal.length, internal.join('; '));

// v9.15.2 (§275 F8): an either-or caster (Paladin's "Wisdom or Charisma,
// whichever is better") carries attr + attrAlt — composed here to match the
// book's "Wisdom or Charisma" parse.
const cg = await page.evaluate(() => Object.fromEntries(Object.entries(CASTER_PROGRESSION).map(([n, p]) => [n, { pp: p.pp, attr: p.attr + (p.attrAlt ? '/' + p.attrAlt : ''), pool: p.pool }])));
for (const [n, b] of Object.entries(BOOK)) {
  if (!b.pp) continue;
  const bookPP = b.pp.map(v => (Number.isNaN(v) || v == null ? 0 : v));
  const c = cg[n];
  if (!c) { R.mark(`PP-TABLE ${n}`, false, 'no CASTER_PROGRESSION entry'); continue; }
  const bad = bookPP.map((v, i) => (v !== c.pp[i] ? `L${i + 1} book ${v}/CG ${c.pp[i]}` : null)).filter(Boolean);
  R.mark(`PP-TABLE ${n} (HH PDF p.${b.page})`, !bad.length, bad.join(', '));
  R.mark(`KEY-ATTR ${n}`, KEY[n] === c.attr, `book ${KEY[n] || '?'}, CG ${c.attr}`);
}

// Engine: the full bonus grid through computeCasterStats for a single-class
// full caster (Wizard: CL = class level = character level, so both book
// phrasings agree), plus base-table spot checks for three casters.
const grid = await page.evaluate(() => {
  const out = {};
  for (let lv = 1; lv <= 20; lv++) for (let c = 0; c < 12; c++) {
    const ch = __oracleChar({ attrs: [10, 10, 10, 12 + 2 * c, 10, 10], classes: [{ tier: 'basic', name: 'Wizard', level: lv, first: true }] });
    out[`${lv}:${c}`] = computeCasterStats(ch).arcane.ppBonus;
  }
  return out;
});
const vsTable = [], vsFormula = [];
for (let lv = 1; lv <= 20; lv++) for (let c = 0; c < 12; c++) {
  const v = grid[`${lv}:${c}`];
  if (v !== BON[lv][c]) vsTable.push(`L${lv} Int ${12 + 2 * c}: table ${BON[lv][c]}, CG ${v}`);
  if (v !== Math.ceil((c + 1) * lv / 2)) vsFormula.push(`L${lv} Int ${12 + 2 * c}`);
}
R.mark('ENGINE bonus PP vs printed table (Wizard 1-20 × Int 12-35)', !vsTable.length, vsTable.join('; '));
R.mark('ENGINE bonus PP vs footnote formula', !vsFormula.length, vsFormula.join('; '));

const chk = (id, got, exp, why) => R.mark(id, got.slice(0, 3).join() === exp.join(), `book ${why} = ${exp[2]}; CG base ${got[0]} + bonus ${got[1]} = ${got[2]}`);
const pools = await page.evaluate(() => {
  const mk = (name, lvl, attrs) => computeCasterStats(__oracleChar({ attrs, classes: [{ tier: 'basic', name, level: lvl, first: true }] }));
  const w = mk('Wizard', 5, [10, 10, 10, 16, 10, 10]).arcane;
  const p = mk('Psion', 7, [10, 10, 10, 18, 10, 10]).psionic;
  const c = mk('Cleric', 1, [10, 10, 10, 10, 12, 10]).divine;
  const r = mk('Ranger', 5, [10, 10, 10, 10, 14, 10]).divine;
  const pa = mk('Paladin', 6, [10, 10, 10, 10, 10, 18]).divine;
  const sa = mk('Saint', 3, [10, 10, 10, 10, 10, 16]).divine;
  return { w: [w.ppBase, w.ppBonus, w.ppMax], p: [p.ppBase, p.ppBonus, p.ppMax], c: [c.ppBase, c.ppBonus, c.ppMax], r: [r.ppBase, r.ppBonus, r.ppMax, r.cl],
    pa: [pa.ppBase, pa.ppBonus, pa.ppMax, pa.cl], sa: [sa.ppBase, sa.ppBonus, sa.ppMax] };
});
// Paladin 6 (CL ⌈6/2⌉ = 3), Wis 10, Cha 18: "a high Wisdom or Charisma
// score, whichever is better" → ⌈4×3/2⌉ = 6 bonus.
chk('POOL Paladin 6, Wis 10 / Cha 18 ("whichever is better")', pools.pa, [1, 6, 7], '1 + ⌈4×3/2⌉=6');
// Saint 3, Wis 10, Cha 16: the Saint entry names Charisma (HH PDF p.99);
// HH PDF p.19 lists the Saint under WISDOM bonus PP. Oracle = class entry.
chk('POOL Saint 3, Wis 10 / Cha 16 (class entry says Charisma)', pools.sa, [BOOK.Saint.pp[2], 5, BOOK.Saint.pp[2] + 5], `${BOOK.Saint.pp[2]} + ⌈3×3/2⌉=5`);
chk('POOL Wizard 5, Int 16', pools.w, [18, 8, 26], '18 + ⌈3×5/2⌉=8');
chk('POOL Psion 7, Int 18', pools.p, [46, 14, 60], '46 + ⌈4×7/2⌉=14');
chk('POOL Cleric 1, Wis 12', pools.c, [5, 1, 6], '5 + ⌈1×1/2⌉=1');
// Ranger: lesser caster, CL = ⌈5/2⌉ = 3 (HH Ranger entry). p.393 says
// "character level" (⌈2×5/2⌉ = 5); p.21 says "per Manifester Lvl" (⌈2×3/2⌉ = 3).
R.mark('POOL Ranger 5, Wis 14 (lesser caster — which level drives bonus PP?)', pools.r[1] === 3 || pools.r[1] === 5,
  `book p.393 (character level) → 1 + 5 = 6; book p.21 (manifester level ${pools.r[3]}) → 1 + 3 = 4; CG base ${pools.r[0]} + bonus ${pools.r[1]} = ${pools.r[2]}`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
