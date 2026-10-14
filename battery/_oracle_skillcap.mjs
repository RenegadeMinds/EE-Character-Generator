// _oracle_skillcap.mjs — ORACLE SWEEP D3 (2026-10-13): skill-rank cap + cost.
// Book rules (HH PDF p.146, Chapter V "Skills"):
//   • class skill: 1 point = 1 rank; cross-class: 1 point = ½ rank ("two ½
//     ranks make 1 rank") → 2 points per full rank;
//   • "The maximum rank in a class skill is the character's level + 4. If
//     it's a cross-class skill, the maximum rank is half of that number (do
//     not round up or down)";
//   • "if it is a class skill for ANY of your classes, your maximum rank
//     equals your total character level + 4".
// "Character level" = class levels (ECL is the XP yardstick, HH PDF p.22).
// HH PDF p.53: skill points are spent at the cost of the class just
// advanced in (noted, not probed — the CG keeps one union-based ledger).
// Oracle reads the CG's own rendered cap: the rank <input max=…> on the
// Skills page (renderSkills), which is what blocks the player.
import { openCG, reporter } from './_oracle_lib.mjs';

const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D3 — skill-rank cap (level+4; cross-class half) + cost');

const caps = (spec) => page.evaluate((spec) => {
  chars.length = 0;
  const c = __oracleChar(spec.over);
  c.classes = spec.cls.map(([tier, name, level], i) => ({ tier, name, level, first: i === 0 }));
  if (spec.stampLvl) c.totalLvl = c.classes.reduce((s, e) => s + e.level, 0);
  chars.push(c); curId = c.id;
  renderSkills();
  const out = { totalLvl: c.totalLvl };
  for (const sk of spec.skills) {
    const el = document.getElementById('skr-' + sk.replace(/[^a-z0-9]/gi, '_'));
    out[sk] = el ? +el.max : null;
    out[sk + ':class'] = isClassSkill(sk, c);
  }
  if (spec.ranks) {
    c.skills = spec.ranks;
    renderSkills(); recomputeSkillBudget(c);
    out.budgetText = document.getElementById('sk-pts-info')?.textContent || '';
    out.budget = computeSkillPointBudget(c);
  }
  return out;
}, spec);

// A. Strong Hero 1 (Int 10, Human): class Climb, cross-class Diplomacy.
let o = await caps({ cls: [['hero', 'Strong Hero', 1]], stampLvl: true, skills: ['Climb', 'Diplomacy'], ranks: { Climb: 4, Diplomacy: 2 } });
R.mark('A1 class-skill cap, Strong Hero 1 (Climb)', o.Climb === 5, `book 1+4 = 5; CG max=${o.Climb}`);
R.mark('A2 cross-class cap, Strong Hero 1 (Diplomacy)', o.Diplomacy === 2.5, `book (1+4)/2 = 2½ "do not round"; CG max=${o.Diplomacy}`);
// Cost: Climb 4 ranks = 4 pts; Diplomacy 2 ranks = 4 pts → 8 spent of
// (4+0)×5 + 5 (Human) = 25.
R.mark('A3 cost ledger (Climb 4 class + Diplomacy 2 cross)', /\b8 spent of ~25\b/.test(o.budgetText), `book 4 + 2×2 = 8 of (4+0)×5+5 = 25; CG "${o.budgetText}"`);

// B. Strong Hero 1 / Fast Hero 1: Hide is a Fast-only class skill.
o = await caps({ cls: [['hero', 'Strong Hero', 1], ['hero', 'Fast Hero', 1]], stampLvl: true, skills: ['Climb', 'Hide', 'Diplomacy'] });
R.mark('B1 union rule: Hide (Fast-only class skill) at char level 2', o.Hide === 6 && o['Hide:class'], `book 2+4 = 6; CG max=${o.Hide}`);
R.mark('B2 cross-class at level 2 (Diplomacy)', o.Diplomacy === 3, `book (2+4)/2 = 3; CG max=${o.Diplomacy}`);

// C. Drow (RLM +2): cap keys off character level, not ECL.
o = await caps({ over: { race: 'Drow' }, cls: [['hero', 'Strong Hero', 3]], stampLvl: true, skills: ['Climb'] });
R.mark('C1 Drow Strong Hero 3 — cap from class level, not ECL', o.Climb === 7, `book 3+4 = 7 (ECL 5 would give 9); CG max=${o.Climb}`);

// D. A record with no stamped totalLvl (the shape importCreatureSeed and
//    hand-built records produce) — does the cap still follow the classes?
o = await caps({ cls: [['basic', 'Fighter', 6]], stampLvl: false, skills: ['Climb'] });
R.mark('D1 Fighter 6 record without c.totalLvl', o.Climb === 10, `book 6+4 = 10; CG max=${o.Climb} (c.totalLvl=${o.totalLvl})`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
