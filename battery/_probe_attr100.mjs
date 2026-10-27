// _probe_attr100.mjs — v9.11.3 targeted probe (§268): the attribute ceiling
// rises to the theoretical 100 and every downstream consumer extrapolates.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { appRequestHandler, readAppSource } from './_serve.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer(appRequestHandler(html, resolve(__dir, '../index.html')));  // Phase 1 split: also serves css/, js/, assets/
await new Promise(r => server.listen(8788, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8788/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof carryTriplet === "function" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('INPUT-MAX-IS-100', () => {
  const el = document.getElementById('a0');
  return (el && el.getAttribute('max') === '100') || { max: el && el.getAttribute('max') };
});

await t('CARRY-EXTRAPOLATES-TO-100', () => {
  // Str 100 → ones digit 0 → the Str-20 row [133,266,400] × 4^((100-20)/10) = ×65536.
  const got = carryTriplet(100);
  const want = [133 * 65536, 266 * 65536, 400 * 65536];
  return (got[0] === want[0] && got[1] === want[1] && got[2] === want[2]) || { got, want };
});

await t('SCORE-100-CHARACTER-COMPUTES', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'Limit Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Strong Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Limit Probe');
  if (!c) return { note: 'no char' };
  c.attrs = [100, 10, 100, 10, 10, 10];
  const mod = Math.floor((effAttrs(c)[0] - 10) / 2);
  const cyb = cyberMax(c);  // 1 + Con mod 45 = 46
  renderSheet();
  return (mod === 45 && cyb === 46) || { mod, cyb };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== ATTR-100 PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
