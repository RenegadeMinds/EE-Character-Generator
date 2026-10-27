// _probe_cestance.mjs — v9.12.1 targeted probe (§270): PA/CE are melee
// attack-roll penalties, never Base Attack spends. The BA cell stays
// printed, the parry needs no refunds, PA no longer reaches the parry,
// grapple keeps the penalty as a roll penalty, and the caps run per feat.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { appRequestHandler, readAppSource } from './_serve.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer(appRequestHandler(html, resolve(__dir, '../index.html')));  // Phase 1 split: also serves css/, js/, assets/
await new Promise(r => server.listen(8790, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8790/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof computeParryBonus === "function" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('CREATE-DUELIST', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'Stance Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Strong Hero', tier: 'hero', level: 8 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Stance Probe');
  if (!c) return { note: 'no char' };
  c.feats = (c.feats || []).concat([{ name: 'Power Attack' }, { name: 'Combat Expertise' }]);
  return c.bab >= 6 || { bab: c.bab };
});

await t('PARRY-BASELINE-THEN-STANCES', () => {
  const c = chars.find(x => x.id === curId);
  c.combatDecl = {};
  const base = computeParryBonus(c).total;
  c.combatDecl = { pa: 3, ce: 2 };
  const under = computeParryBonus(c).total;
  // PA never reaches the parry; CE adds exactly its Defense bonus. No refunds.
  return (under === base + 2) || { base, under };
});

await t('NO-REFUND-LINES-IN-PARRY', () => {
  const c = chars.find(x => x.id === curId);
  const parts = computeParryBonus(c).parts.map(p => p.label).join(' | ');
  return (!/amendment/i.test(parts) && !/BA spent/i.test(parts) && !/Power Attack/.test(parts) && /Combat Expertise/.test(parts)) || { parts };
});

await t('GRAPPLE-KEEPS-THE-ROLL-PENALTY', () => {
  const c = chars.find(x => x.id === curId);
  c.combatDecl = {};
  const base = computeGrapple(c).total;
  c.combatDecl = { pa: 3, ce: 2 };
  const under = computeGrapple(c).total;
  return (under === base - 5) || { base, under };
});

await t('INDEPENDENT-CAPS', async () => {
  const c = chars.find(x => x.id === curId);
  const bab = c.bab;  // 8 at Strong Hero 8
  c.combatDecl = { pa: bab, ce: Math.min(5, bab) };  // both maxed simultaneously
  // the stepper's open/closed logic: one more of either must refuse
  window.openChoiceModal = (t2, opts, res) => res(opts[0]);
  const before = JSON.stringify(c.combatDecl);
  await baDeclAdjust(-1);
  const after = JSON.stringify(combatDecl(c));
  return (JSON.parse(after).pa === bab && JSON.parse(after).ce === Math.min(5, bab)) || { before, after };
});

// Node-side static check: the BA card headline is printed bab, not _effBA.
{
  // Phase 1 split: the code lives in js/ files now; search all of it.
  const src = readAppSource(resolve(__dir, '../index.html'));
  const i = src.indexOf("const _baCell = {l:'Base Attack'");
  const cell = src.slice(i, i + 400);
  mark('BA-CELL-TEMPLATE-NEVER-EFFECTIVE', i > 0 && /v: \(c\.bab>=0\?'\+':''\)\+c\.bab,/.test(cell) && !cell.includes('_effBA'), i > 0 ? '' : 'anchor missing');
}

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== CE-STANCE PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
