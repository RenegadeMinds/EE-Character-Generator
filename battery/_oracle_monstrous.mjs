// _oracle_monstrous.mjs — ORACLE SWEEP D8 (2026-10-13): Monstrous-tier math.
// Book rules (Foe Folio, "CREATURE TYPES", FF PDF p.18-26):
//   • "Table: Creature Saves and Base Attack Bonuses" (HD 1-20; Good / Fair /
//     Poor save; Good (A) / Fair (B) / Poor (C) base attack) — parsed;
//   • per type: "Hit Die: dN", "Base Attack Bonus: Total | 3/4 | 1/2 of
//     total Hit Dice", "Good Saving Throws: …" — parsed;
//   • HH PDF p.22 (ECL = class levels + RLM) and the CG's own import log
//     ("ECL = HD + classes + LA");
//   • HH PDF p.350: HP = Hit Dice + Con mod per die.
// Seed = the GMF Aboleth (8d8+40, Str 26 Dex 12 Con 20 Int 15 Wis 17 Cha 17,
// Fort +7 Ref +3 Will +11, BA +6, LA +9) — same seed as _probe_monstrous.
import { openCG, bookLines, reporter } from './_oracle_lib.mjs';

const FF = bookLines('ff');
const t0 = FF.findIndex(l => /^Table: Creature Saves and Base Attack Bonuses/.test(l.text));
const TAB = {};
for (let j = t0 + 3; j < t0 + 30; j++) {
  const m = FF[j].text.match(/^(\d+)(?: or less)? ([+]\d+) ([+]\d+) ([+]\d+) ([+]\d+)\S* ([+]\d+)\S* ([+]\d+)/);
  if (m) TAB[+m[1]] = { good: +m[2], fair: +m[3], poor: +m[4], A: +m[5], B: +m[6], C: +m[7] };
}
const TYPES = {};
const NAMES = ['Aberration', 'Animal', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Giant', 'Humanoid', 'Magical Beast', 'Monstrous Humanoid', 'Ooze', 'Outsider', 'Plant', 'Undead', 'Vermin'];
for (const n of NAMES) {
  const i = FF.findIndex((l, k) => k > t0 && l.text === n);
  const blk = FF.slice(i, i + 12).map(l => l.text).join('\n');
  const hd = +(blk.match(/Hit Die: d(\d+)/) || [])[1];
  const ba = (blk.match(/Base Attack Bonus: (Total|3\/4|1\/2)/) || [])[1];
  const gs = (blk.match(/Good Saving Throws: ([^\n]*)/) || [])[1] || '';
  TYPES[n] = { hd, col: { Total: 'A', '3/4': 'B', '1/2': 'C' }[ba], frac: { Total: 1, '3/4': 0.75, '1/2': 0.5 }[ba],
    // "Choose one (usually Reflex)" → the book's default pick; "Varies by
    // element: Fortitude (earth, water) or Reflex (air, fire)" → the first.
    good: ['Fortitude', 'Reflex', 'Will'].filter(s => new RegExp(s).test(/^Choose one \(usually/.test(gs) ? gs : gs.split('(')[0])).map(s => s.slice(0, 4).toLowerCase().replace('refl', 'ref')), gs, page: FF[i].page };
}

const { browser, page, errors } = await openCG();
const R = reporter('ORACLE D8 — Monstrous tier (FF creature-type progressions)');
R.mark(`FF-TABLE parsed (FF PDF p.${FF[t0].page}): ${Object.keys(TAB).length} HD rows, ${Object.values(TYPES).filter(t => t.hd).length} types`, Object.keys(TAB).length === 20);

// Book-internal: the printed table vs the type text's stated fractions.
const colBad = [];
for (let hd = 1; hd <= 20; hd++) {
  if (TAB[hd].A !== hd) colBad.push(`A@${hd}: ${TAB[hd].A} vs ${hd}`);
  if (TAB[hd].B !== Math.floor(hd * 0.75)) colBad.push(`B@${hd}: ${TAB[hd].B} vs ⌊3/4⌋ ${Math.floor(hd * 0.75)}`);
  if (TAB[hd].C !== Math.floor(hd * 0.5)) colBad.push(`C@${hd}: ${TAB[hd].C} vs ⌊1/2⌋ ${Math.floor(hd * 0.5)}`);
  if (TAB[hd].good !== 2 + Math.floor(hd / 2)) colBad.push(`good@${hd}`);
  if (TAB[hd].poor !== Math.floor(hd / 3)) colBad.push(`poor@${hd}`);
}
R.mark('BOOK-INTERNAL FF table columns vs "Total / 3/4 / 1/2 of total Hit Dice" text', !colBad.length, colBad.join('; '));
R.info(`FF "Fair Save" column (${[1, 4, 8, 12, 20].map(h => `HD${h} +${TAB[h].fair}`).join(', ')}) is printed but no creature type references it`);

// Every type × HD 1-20: buildMonstrousClass vs the printed table.
const built = await page.evaluate((names) => Object.fromEntries(names.map(n => [n, buildMonstrousClass(n, 20)])), NAMES);
for (const n of NAMES) {
  const t = TYPES[n], b = built[n];
  const bad = [];
  if (b.hd !== t.hd) bad.push(`HD book d${t.hd} / CG d${b.hd}`);
  for (let hd = 1; hd <= 20; hd++) {
    const row = TAB[hd];
    if (b.bab[hd - 1] !== row[t.col]) bad.push(`BAB@${hd} table +${row[t.col]} / CG +${b.bab[hd - 1]}`);
    for (const s of ['fort', 'ref', 'will']) {
      const exp = t.good.includes(s) ? row.good : row.poor;
      if (b[s][hd - 1] !== exp) bad.push(`${s}@${hd} book +${exp} / CG +${b[s][hd - 1]}`);
    }
  }
  R.mark(`TYPE ${n} (FF PDF p.${t.page}; good: ${t.gs.slice(0, 40)})`, !bad.length, bad.slice(0, 6).join('; ') + (bad.length > 6 ? ` … (+${bad.length - 6})` : ''));
}

// The Aboleth import, end to end.
const SEED = {
  seed: 'ee-creature', from: 'GMF v0.6.2', fam: 'ABOLETH', label: 'Aboleth', size: 'Huge', type: 'Aberration',
  hit_dice: '8d8+40 (76 hp)', attributes: 'Str 26, Dex 12, Con 20, Int 15, Wis 17, Cha 17',
  saves: 'Fort +7, Ref +3, Will +11, Dodge +1', ba_grapple_parry: '+6/+22/+14', level_adjustment: '+9',
  advancement: '9–16 HD (Huge); 17–24 HD (Gargantuan)',
};
const ab = await page.evaluate((seed) => {
  localStorage.clear(); chars.length = 0;
  importCreatureSeed(seed);
  const c = chars[0];
  const at0 = { attrs: c.attrs.slice(), totalLvl: c.totalLvl, ecl: c.ecl, maxHP: c.maxHP };
  try { selChar(c.id); } catch (e) {}
  try { renderSheet(); } catch (e) {}
  const sb = computeStatBlock(c);
  let capClimb = null;
  try { curId = c.id; renderSkills(); capClimb = +document.getElementById('skr-Climb').max; } catch (e) {}
  return { at0, attrs: c.attrs, eff: effAttrs(c), totalLvl: c.totalLvl, ecl: c.ecl, maxHP: c.maxHP, ap: c.ap, bab: sb.bab.total,
    fort: sb.fort.total, ref: sb.ref.total, will: sb.will.total, sbHP: sb.hp.total, capClimb, raceAdj: RACES[c.race].adj };
}, SEED);
R.info('Aboleth after import: ' + JSON.stringify(ab));
R.mark('ABOLETH BAB (fair column @8 HD)', ab.bab === 6, `book +6 (statblock +6); CG +${ab.bab}`);
// Saves: table + the creature's REAL attribute mods (Con 20 +5, Dex 12 +1,
// Wis 17 +3). The statblock's Will +11 also carries Iron Will (+2, a feat
// the import leaves to the GM) — the oracle counts table + attribute only.
R.mark('ABOLETH Fort = poor +2 + Con 20 (+5)', ab.fort === 7, `book +7 (statblock +7); CG +${ab.fort}`);
R.mark('ABOLETH Ref = poor +2 + Dex 12 (+1)', ab.ref === 3, `book +3 (statblock +3); CG +${ab.ref}`);
R.mark('ABOLETH Will = good +6 + Wis 17 (+3)', ab.will === 9, `book +9 before Iron Will (statblock +11); CG +${ab.will}`);
R.mark('ABOLETH attributes carry the racial adjustment (Str 26 … Cha 17)', ab.eff.join() === '26,12,20,15,17,17',
  `statblock 26,12,20,15,17,17; CG effective ${ab.eff.join(',')} (stored ${ab.attrs.join(',')}; race adj ${JSON.stringify(ab.raceAdj)})`);
R.mark('ABOLETH max HP from 8d8 + Con +5/HD', ab.maxHP >= 8 + 7 * 1 + 40 && ab.maxHP <= 64 + 40,
  `book range 55-104, statblock 76 (avg engine: 8 + 7×5 + 40 = 83); CG maxHP ${ab.maxHP} (import-time ${ab.at0.maxHP})`);
R.mark('ABOLETH c.totalLvl stamped (8 HD)', ab.totalLvl === 8, `CG ${ab.totalLvl} (import-time ${ab.at0.totalLvl})`);
R.mark('ABOLETH ECL = 8 HD + LA 9 = 17', ab.ecl === 17, `CG ${ab.ecl} (import-time ${ab.at0.ecl})`);
R.mark('ABOLETH class-skill cap = 8 + 4 = 12', ab.capClimb === 12, `CG max=${ab.capClimb}`);

// Does a player-side Edit → Save round trip heal the record?
const healed = await page.evaluate(async () => {
  const c = chars[0]; curId = c.id;
  gateState = 'sandbox'; window.confirmModal = async () => true; window.promptProvenance = async () => '';
  try { editCurrentChar(); await saveCharacter(); } catch (e) { return { err: String(e).slice(0, 160) }; }
  const d = chars.find(x => x.id === c.id) || {};
  const sb = computeStatBlock(d);
  return { attrs: d.attrs, maxHP: d.maxHP, totalLvl: d.totalLvl, ecl: d.ecl, fort: sb.fort.total, will: sb.will.total };
});
R.info('Aboleth after Edit → Save: ' + JSON.stringify(healed));
R.mark('ABOLETH Edit→Save heals totalLvl/ECL', healed.totalLvl === 8 && healed.ecl === 17, `CG totalLvl ${healed.totalLvl}, ECL ${healed.ecl}`);
R.mark('ABOLETH Edit→Save heals attributes', (healed.attrs || []).join() === '26,12,20,15,17,17', `CG attrs ${healed.attrs}, Fort +${healed.fort}, maxHP ${healed.maxHP}`);

await browser.close();
process.exit(R.finish(errors) ? 1 : 0);
