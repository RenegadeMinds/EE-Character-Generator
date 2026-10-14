// _oracle_bumps.mjs — ORACLE SWEEP D6 (2026-10-13): attribute increases.
// Book rule (HH PDF p.21, "About Attribute Scores"): "Increasing an
// attribute occurs naturally at every 4th character level; whenever your
// character reaches such a level (ie. at 4th level, 8th level, 12th level,
// etc.), you get to assign a +1 bonus to one attribute of your choice."
// Character level = class levels (racial level modifiers are ECL/XP only,
// HH PDF p.22), so a Drow Fighter 3 (ECL 5) has not earned one yet.
import { openCG, reporter } from './_oracle_lib.mjs';

const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D6 — +1 attribute every 4th character level');

const r = await page.evaluate(() => {
  const counts = Array.from({ length: 24 }, (_, i) => bumpCountForLevel(i + 1));
  // Level-up ledger: the bump owed AT each new level (old → new).
  const owed = Array.from({ length: 20 }, (_, i) => lvlupComputeOwedAfter({ totalLvl: i + 2 }, i + 1).bumps);
  // Create form: the bump panel offers one picker per earned bump.
  formClasses.length = 0; formClasses.push({ tier: 'basic', name: 'Fighter', level: 8, first: true });
  formAttrBumps = [];
  renderAttrBumpsPanel();
  const panelRows = formAttrBumps.length;
  formClasses.length = 0; formClasses.push({ tier: 'basic', name: 'Fighter', level: 3, first: true });
  document.getElementById('c-race').value = 'Drow';
  formAttrBumps = []; renderAttrBumpsPanel();
  const drowRows = formAttrBumps.length;
  return { counts, owed, panelRows, drowRows };
});
const expCount = Array.from({ length: 24 }, (_, i) => Math.floor((i + 1) / 4));
R.mark('COUNT bumpCountForLevel(1..24) = ⌊L/4⌋', r.counts.join() === expCount.join(), `CG ${r.counts.join(',')}`);
const expOwed = Array.from({ length: 20 }, (_, i) => ((i + 2) % 4 === 0 ? 1 : 0));
R.mark('LEVEL-UP owes exactly one bump on reaching 4, 8, 12, 16, 20 (L2..L21)', r.owed.join() === expOwed.join(), `CG ${r.owed.join(',')}`);
R.mark('FORM panel: Fighter 8 offers 2 pickers', r.panelRows === 2, `CG ${r.panelRows}`);
R.mark('FORM panel: Drow Fighter 3 (ECL 5) offers 0 pickers', r.drowRows === 0, `CG ${r.drowRows}`);

// Save path: base 15 Str + an L4 STR bump → stored Str 16 (mod +3) and the
// bump reaches derived stats (Fort via Con check below uses Con bump).
const s = await page.evaluate(async () => {
  gateState = 'sandbox'; _firstSaveConfirmed = true;
  window.confirmModal = async () => true; window.promptProvenance = async () => '';
  document.getElementById('c-name').value = 'Bump Save';
  const rs = document.getElementById('c-race'); rs.value = 'Human'; rs.dispatchEvent(new Event('change'));
  const base = [15, 10, 13, 10, 10, 10];
  base.forEach((v, i) => { document.getElementById('a' + i).value = v; });
  formClasses.length = 0; formClasses.push({ name: 'Fighter', tier: 'basic', level: 4, first: true });
  formAttrBumps = ['CON'];
  await saveCharacter();
  const c = chars.find(x => x.name === 'Bump Save');
  return c ? { attrs: c.attrs, base: c.attrsBase, bumps: c.attrBumps, fort: computeStatBlock(c).fort.total } : null;
});
// Fighter 4 Fort +4 (HH PDF p.86) + Con 14 → +2 = +6.
R.mark('SAVE-PATH Fighter 4, Con 13 + L4 CON bump → Con 14, Fort +6', !!s && s.attrs[2] === 14 && s.fort === 6,
  `CG attrs ${s && s.attrs}, base ${s && s.base}, bumps ${s && JSON.stringify(s.bumps)}, Fort +${s && s.fort}`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
