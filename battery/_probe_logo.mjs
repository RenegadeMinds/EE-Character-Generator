// _probe_logo.mjs — v9.18.0 targeted probe: THE PAIR O' DICE MASTHEAD.
// Asserts: twin bookend plaques sharing ONE base64 blob (the right borrows
// the left's src at boot); the printed sheet's letterhead carries the same
// blob; NO favicon (Adam's ruling — masthead + print only); version stamped.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8794, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8794/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof printSheet === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await t('BOOKENDS-PRESENT', () => {
  const l = document.getElementById('site-logo'), r = document.getElementById('site-logo-r');
  return (!!l && !!r && l.classList.contains('site-logo') && r.classList.contains('site-logo'))
    || { l: !!l, r: !!r };
});
await t('ONE-BLOB-SHARED', () => {
  const l = document.getElementById('site-logo'), r = document.getElementById('site-logo-r');
  return (l.src.startsWith('data:image/jpeg;base64,') && r.src === l.src && l.src.length > 10000)
    || { lPrefix: l.src.slice(0, 30), same: r.src === l.src, len: l.src.length };
});
await t('RIGHT-BOOKEND-DECORATIVE', () => {
  const r = document.getElementById('site-logo-r');
  return (r.getAttribute('aria-hidden') === 'true' && r.getAttribute('alt') === '') || { hidden: r.getAttribute('aria-hidden'), alt: r.getAttribute('alt') };
});
await t('TITLE-CENTERED-BETWEEN', () => {
  const brand = document.querySelector('.site-brand');
  const kids = Array.from(brand.children).map(e => e.id || e.tagName.toLowerCase());
  return (kids.length === 3 && kids[0] === 'site-logo' && kids[2] === 'site-logo-r'
    && !!brand.querySelector('.site-title')) || { kids };
});
await t('NO-FAVICON', () => !document.querySelector('link[rel*="icon"]') || { found: document.querySelector('link[rel*="icon"]').outerHTML.slice(0, 120) });
await t('VERSION-STAMPED', () => (/^v9\.\d+\.\d+$/.test(CG_VERSION) && document.querySelector('.site-subtitle').textContent.includes(CG_VERSION)) || { CG_VERSION, sub: document.querySelector('.site-subtitle').textContent.slice(0, 80) });
await t('PRINT-LETTERHEAD', () => {
  const r = qdBespokeBuild({ steps: [{ name: 'Fighter', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 5, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Letterhead Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  chars.push(r.char); curId = r.char.id;
  const prevPrint = window.print; window.print = () => {};
  try { printSheet(); } finally { window.print = prevPrint; }
  const ps = document.querySelector('#print-sheet .ps-logo');
  const l = document.getElementById('site-logo');
  return (!!ps && ps.src === l.src && ps.closest('.ps-header-main') !== null)
    || { present: !!ps, same: ps && ps.src === l.src };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== LOGO PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
