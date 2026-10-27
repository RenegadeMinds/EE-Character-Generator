// _probe_split_parity.mjs — proves two builds of the generator behave the same.
//
// WHY THIS EXISTS
//   Written for the Phase 1 split (tools/split_index.py), which cut the
//   single-file index.html into css/, js/ and assets/ files. The splitter
//   already proves the TEXT is identical when the pieces are glued back
//   together. This probe proves the BEHAVIOUR is identical: it boots the old
//   build and the new build side by side in headless Chrome, does exactly the
//   same things to both, and compares what comes out.
//
//   It is also reusable for any future "this should change nothing" refactor:
//   point OLD at the build before and NEW at the build after.
//
// WHAT IT COMPARES
//   1. Every top-level name in the code (all ~1,200 functions, tables and
//      variables): its type, plus its value after start-up. Tables are
//      compared as JSON and functions by their source text, so a table
//      built at load time from functions in another file would show up here
//      if load order had broken it.
//   2. The page markup after start-up (script tags and the logo's src are
//      set aside, since those are expected to differ).
//   3. The font: did 'Epics Serif' actually load in both?
//   4. Five characters built through the generator's own validated path
//      (qdBespokeBuild), then every page rendered for each of them: Sheet,
//      Skills, Feats, Gear, Powers, Spells, Mutations, Talents, Vehicles,
//      Tracker, Roster. Each page's markup must match.
//   5. Console errors: neither build may log any.
//
//   Randomness and the clock are pinned to the same fixed sequence in both
//   pages, so ids, dice rolls and timestamps come out the same.
//
// USAGE
//   OLD=path/to/old/index.html node _probe_split_parity.mjs
//   CODE_CHANGED=1 OLD=... node _probe_split_parity.mjs   (refactors: ignore function source text)
//   (NEW defaults to ../index.html; set NEW=... to compare something else)

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { appRequestHandler, readAppSource } from './_serve.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OLD = process.env.OLD;
// CODE_CHANGED=1: the change under test edits function bodies on purpose (a
// refactor), so compare functions by name and type only, not by source text.
// Data, character records and every rendered page must still match exactly.
const CODE_CHANGED = !!process.env.CODE_CHANGED;
const NEW = process.env.NEW || resolve(__dir, '../index.html');
if (!OLD) { console.error('Set OLD=path/to/the/previous/index.html'); process.exit(2); }

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

// Every top-level declaration in either build (union), found in the source text.
const names = new Set();
for (const f of [OLD, NEW]) {
  for (const m of readAppSource(f).matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
}

// Runs in the page BEFORE any of its scripts: pin Math.random and the clock.
function pinRandomAndClock() {
  let s = 0x9E3779B9;
  Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = Date.UTC(2026, 9, 27, 12, 0, 0);
  const RealDate = Date;
  const tick = () => (now += 1000);
  // Date.now() and new Date() (no arguments) both follow the pinned clock.
  window.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [tick()])); } static now() { return tick(); } };
  window.Date.UTC = RealDate.UTC; window.Date.parse = RealDate.parse;
  try { localStorage.clear(); } catch (e) {}
}

async function boot(file, port) {
  const server = createServer(appRequestHandler(readFileSync(file), file));
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  // The browser asks for /favicon.ico on its own; that 404 is not the app's.
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text() + ' ' + ((m.location() || {}).url || ''))) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.evaluateOnNewDocument(pinRandomAndClock);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof chars !== "undefined" && typeof qdBespokeBuild === "function"', { timeout: 60000 });
  return { server, browser, page, errors };
}

// Snapshot of every top-level name: its type and a short fingerprint of its value.
async function globalsSnapshot(page) {
  return page.evaluate((list, FN_SRC) => {
    const out = {};
    const seen = () => { const ws = new WeakSet(); return (k, v) => { if (typeof v === 'function') return FN_SRC ? 'fn:' + v.toString() : 'fn'; if (v instanceof Node) return 'node:' + v.nodeName + '#' + (v.id || ''); if (v instanceof Set) return { set: [...v] }; if (v instanceof Map) return { map: [...v] }; if (v && typeof v === 'object') { if (ws.has(v)) return '[cycle]'; ws.add(v); } return v; }; };
    for (const n of list) {
      let v, t;
      try { v = (0, eval)(n); t = typeof v; } catch (e) { out[n] = 'unreachable: ' + e.name; continue; }
      let s;
      try { s = t === 'function' ? (FN_SRC ? v.toString() : 'fn') : JSON.stringify(v, seen()); } catch (e) { s = 'unserializable'; }
      // A small hash keeps the report short.
      let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
      out[n] = t + ':' + s.length + ':' + h;
    }
    return out;
  }, [...names], !CODE_CHANGED);
}

// The rendered markup, minus the parts expected to differ between the builds:
// script tags, HTML comments (the split added explanatory ones), blank
// text at the top level of <body> (where the script tags were), and the
// logo's src (inline data vs. a file).
const markup = (page) => page.evaluate(() => {
  const b = document.body.cloneNode(true);
  b.querySelectorAll('script').forEach(s => s.remove());
  const w = document.createTreeWalker(b, NodeFilter.SHOW_COMMENT); const cs = []; while (w.nextNode()) cs.push(w.currentNode); cs.forEach(c => c.remove());
  // Blank text left between the (removed) <script> tags at the top level of <body>.
  [...b.childNodes].forEach(n => { if (n.nodeType === 3 && !n.textContent.trim()) n.remove(); });
  b.querySelectorAll('#site-logo, #site-logo-r, .ps-logo').forEach(i => i.removeAttribute('src'));
  return b.innerHTML;
});

const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i >= a.length && a.length === b.length ? -1 : i; };
const ctx = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 80));

console.log(`== SPLIT PARITY ==\n   OLD: ${OLD}\n   NEW: ${NEW}\n   ${names.size} top-level names`);
const A = await boot(OLD, 8801);
const B = await boot(NEW, 8802);

// 1. Globals after start-up.
{
  const ga = await globalsSnapshot(A.page), gb = await globalsSnapshot(B.page);
  const diff = [...names].filter(n => ga[n] !== gb[n]);
  mark('GLOBALS-IDENTICAL-AFTER-BOOT', diff.length === 0, diff.length ? `${diff.length} differ: ` + diff.slice(0, 8).map(n => `${n} (${ga[n]} vs ${gb[n]})`).join('; ') : `${names.size} names`);
}
// 2. Markup after start-up.
{
  const ma = await markup(A.page), mb = await markup(B.page);
  const i = firstDiff(ma, mb);
  mark('MARKUP-IDENTICAL-AFTER-BOOT', i === -1, i === -1 ? `${ma.length.toLocaleString()} chars` : `first difference at ${i}: OLD ${ctx(ma, i)} NEW ${ctx(mb, i)}`);
}
// 3. Font.
{
  const fa = await A.page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Epics Serif"'); });
  const fb = await B.page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Epics Serif"'); });
  mark('FONT-LOADED-IN-BOTH', fa && fb, `old ${fa}, new ${fb}`);
}
// 4. Characters and every page.
const SCALES = { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 5 };
const SPECS = [
  { steps: [{ name: 'Fighter', levels: 4 }, { name: 'Expert', levels: 2 }], sixLevels: SCALES, presetName: 'Custom', race: 'Human', hybrid: null, occupation: '', name: 'Parity Fighter' },
  { steps: [{ name: 'Strong Hero', levels: 3 }], sixLevels: SCALES, presetName: 'Custom', race: 'Human', hybrid: null, occupation: '', name: 'Parity Strong' },
  { steps: [{ name: 'Wizard', levels: 5 }], sixLevels: SCALES, presetName: 'Custom', race: 'Human', hybrid: null, occupation: '', name: 'Parity Wizard' },
  { steps: [{ name: 'Cleric', levels: 4 }], sixLevels: SCALES, presetName: 'Custom', race: 'Human', hybrid: null, occupation: '', name: 'Parity Cleric' },
  { steps: [{ name: 'Psion', levels: 3 }], sixLevels: SCALES, presetName: 'Custom', race: 'Human', hybrid: null, occupation: '', name: 'Parity Psion' },
];
const PAGES = ['sheet', 'skills', 'feats', 'gear', 'powers', 'spells', 'mutations', 'talents', 'vehicles', 'tracker', 'roster'];
let built = 0, compared = 0;
for (const spec of SPECS) {
  const mk = (p) => p.evaluate((s) => { try { const r = qdBespokeBuild(s); if (!r.ok) return { ok: false, reason: r.reason }; chars.push(r.char); curId = r.char.id; save(); return { ok: true, json: JSON.stringify(r.char) }; } catch (e) { return { ok: false, reason: String(e) }; } }, spec);
  const ra = await mk(A.page), rb = await mk(B.page);
  if (!ra.ok || !rb.ok) { mark(`BUILD ${spec.name}`, ra.ok === rb.ok && ra.reason === rb.reason, `both refused the same way: ${ra.reason}`); continue; }
  built++;
  const i = firstDiff(ra.json, rb.json);
  mark(`BUILD ${spec.name}: character record`, i === -1, i === -1 ? '' : `differs at ${i}: OLD ${ctx(ra.json, i)} NEW ${ctx(rb.json, i)}`);
  for (const pg of PAGES) {
    const go = (p) => p.evaluate((n) => { try { showPage(n); return true; } catch (e) { return String(e); } }, pg);
    const oa = await go(A.page), ob = await go(B.page);
    const ma = await markup(A.page), mb = await markup(B.page);
    const j = firstDiff(ma, mb);
    compared++;
    if (j !== -1 || oa !== ob) mark(`  ${spec.name} / ${pg}`, false, oa !== ob ? `showPage: OLD ${oa} NEW ${ob}` : `differs at ${j}: OLD ${ctx(ma, j)} NEW ${ctx(mb, j)}`);
  }
}
const pageFails = results.filter(r => r.id.startsWith('  ') && !r.pass).length;
mark('EVERY-PAGE-IDENTICAL', pageFails === 0 && compared > 0, `${compared} page renders across ${built} characters`);
// 4b. Globals again, after all that activity.
{
  const ga = await globalsSnapshot(A.page), gb = await globalsSnapshot(B.page);
  const diff = [...names].filter(n => ga[n] !== gb[n]);
  mark('GLOBALS-IDENTICAL-AFTER-USE', diff.length === 0, diff.length ? `${diff.length} differ: ` + diff.slice(0, 8).join(', ') : '');
}
// 5. Console silence.
mark('NO-CONSOLE-ERRORS', A.errors.length === 0 && B.errors.length === 0, [...A.errors.map(e => 'OLD ' + e), ...B.errors.map(e => 'NEW ' + e)].slice(0, 4).join(' | '));

for (const x of [A, B]) { await x.browser.close(); x.server.close(); }
const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} green` + (fails.length ? ` — ${fails.length} FAIL` : ''));
process.exit(fails.length ? 1 : 0);
