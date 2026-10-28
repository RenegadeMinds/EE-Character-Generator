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
//   4c. Eleven "rich" characters (gear, magic items, super powers, talents,
//      Dwarf / Elf / Halfling / Hybrid races, rage / nullified / fatigued
//      states, one condition of each severity tier): every page, the print sheet, the equipped-weapon summaries
//      and an Edit -> Save round trip must match too.
//   5. Console errors: neither build may log any.
//
//   Randomness and the clock are pinned to the same fixed sequence in both
//   pages, so ids, dice rolls and timestamps come out the same.
//
// USAGE
//   OLD=path/to/old/index.html node _probe_split_parity.mjs
//   CODE_CHANGED=1 OLD=... node _probe_split_parity.mjs   (refactors: ignore function source text)
//   STYLES=1 CODE_CHANGED=1 OLD=... node _probe_split_parity.mjs
//       (styling refactors: see STYLE MODE below)
//   THEME=classic | hc   (run everything in that colour theme; default Parchment)
//
// STYLE MODE (STYLES=1)
//   For changes that rewrite the markup on purpose but must not change how
//   anything LOOKS, e.g. moving style="..." attributes into CSS classes.
//   Markup is then compared with every class and style attribute removed,
//   and, element by element, the browser's final computed style must match:
//   the ~70 visual properties in STYLE_PROPS (colours, fonts, spacing,
//   borders, sizes, flex/grid layout, visibility). Sizes are the laid-out
//   pixel values, so a layout shift anywhere shows up too. STYLE_ALL=1
//   checks all ~350 CSS properties instead (much slower).
//   The print sheet is also compared as it would print (print media).
//   Run it once per theme (no THEME, THEME=classic, THEME=hc).
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
// Style mode and theme: see the header.
const STYLES = !!process.env.STYLES;
const THEME = process.env.THEME || '';
const STYLE_PROPS = process.env.STYLE_ALL ? null : [
  'display', 'visibility', 'opacity', 'cursor', 'position', 'top', 'left', 'right', 'bottom', 'z-index',
  'color', 'background-color', 'background-image', 'box-shadow', 'text-shadow', 'filter',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-caps', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'text-decoration-line', 'text-indent', 'white-space', 'word-break', 'vertical-align',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-bottom-style', 'border-left-style', 'border-right-style',
  'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
  'border-top-left-radius', 'border-bottom-right-radius', 'outline-style',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'box-sizing', 'overflow-x', 'overflow-y',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'justify-content',
  'row-gap', 'column-gap', 'grid-template-columns', 'grid-column-start', 'grid-column-end', 'list-style-type', 'pointer-events', 'user-select',
];
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
  await page.evaluateOnNewDocument(installStyleHashes, STYLE_PROPS);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof chars !== "undefined" && typeof qdBespokeBuild === "function"', { timeout: 60000 });
  // Same switch js/boot.js makes for a saved theme choice.
  if (THEME) await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), THEME);
  // Style mode: switch off fades and animations (in both builds alike), so a
  // colour caught halfway through a transition can't look like a difference.
  if (STYLES) await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
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
//
// In style mode (STYLES=1) class and style attributes are removed too, and
// the computed style of every element is appended as one short hash per
// element (tag, id and hash; see styleHashes).
const markup = (page) => page.evaluate((STY) => {
  let hashes = '';
  if (STY) hashes = '\n' + styleHashes(document.body);
  const b = document.body.cloneNode(true);
  b.querySelectorAll('script').forEach(s => s.remove());
  const w = document.createTreeWalker(b, NodeFilter.SHOW_COMMENT); const cs = []; while (w.nextNode()) cs.push(w.currentNode); cs.forEach(c => c.remove());
  // Blank text left between the (removed) <script> tags at the top level of <body>.
  [...b.childNodes].forEach(n => { if (n.nodeType === 3 && !n.textContent.trim()) n.remove(); });
  b.querySelectorAll('#site-logo, #site-logo-r, .ps-logo').forEach(i => i.removeAttribute('src'));
  // The toast message is transient: whether it is still showing depends on timing.
  b.querySelectorAll('#toast').forEach(t => t.remove());
  if (STY) b.querySelectorAll('[class],[style]').forEach(e => { e.removeAttribute('class'); e.removeAttribute('style'); });
  return b.innerHTML + hashes;
}, STYLES);

// Style mode: one line per element under root, "TAG#id hash", where the
// hash covers every computed CSS property. Installed in each page as a
// global so markup() and the print check can both call it. Script tags and
// the transient toast are skipped, as in markup().
function installStyleHashes(PROPS) {
  window.styleHashes = (root) => {
    const out = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === 'SCRIPT' || el.closest('#toast')) continue;
      const cs = getComputedStyle(el);
      let s = '';
      if (PROPS) for (const p of PROPS) s += cs.getPropertyValue(p) + '|';
      else for (let i = 0; i < cs.length; i++) s += cs.getPropertyValue(cs[i]) + '|';
      let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
      out.push(el.tagName + (el.id ? '#' + el.id : '') + ' ' + (h >>> 0).toString(36));
    }
    return out.join('\n');
  };
  // For investigating a difference: every computed property of element i.
  window.styleDump = (root, i) => { const el = root.querySelectorAll('*')[i]; const cs = getComputedStyle(el); const o = {}; for (let k = 0; k < cs.length; k++) o[cs[k]] = cs.getPropertyValue(cs[k]); return o; };
}

// Style mode: the print sheet's computed styles as it would PRINT (the
// @media print rules apply only then).
const printStyles = async (page) => {
  await page.emulateMediaType('print');
  const h = await page.evaluate(() => styleHashes(document.getElementById('print-sheet')));
  await page.emulateMediaType('screen');
  return h;
};

const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i >= a.length && a.length === b.length ? -1 : i; };
const ctx = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 80));

console.log(`== SPLIT PARITY ==\n   OLD: ${OLD}\n   NEW: ${NEW}\n   ${names.size} top-level names` + (STYLES ? `\n   style mode, theme ${THEME || 'parchment'}` : ''));
const A = await boot(OLD, 8801);
const B = await boot(NEW, 8802);

// In refactor mode, names that exist in only ONE build are new or retired
// helpers: report them, don't fail on them. Everything both builds share
// must still match.
const onlyOne = (x, y) => (x || '').startsWith('unreachable') !== (y || '').startsWith('unreachable');
const globalsDiff = (ga, gb) => [...names].filter(n => ga[n] !== gb[n] && !(CODE_CHANGED && onlyOne(ga[n], gb[n])));
const addedRemoved = (ga, gb) => { const add = [...names].filter(n => (ga[n] || '').startsWith('unreachable') && !(gb[n] || '').startsWith('unreachable')); const rem = [...names].filter(n => !(ga[n] || '').startsWith('unreachable') && (gb[n] || '').startsWith('unreachable')); return (add.length ? ` · ${add.length} new: ${add.join(', ')}` : '') + (rem.length ? ` · ${rem.length} retired: ${rem.join(', ')}` : ''); };
// 1. Globals after start-up.
{
  const ga = await globalsSnapshot(A.page), gb = await globalsSnapshot(B.page);
  const diff = globalsDiff(ga, gb);
  mark('GLOBALS-IDENTICAL-AFTER-BOOT', diff.length === 0, diff.length ? `${diff.length} differ: ` + diff.slice(0, 8).map(n => `${n} (${ga[n]} vs ${gb[n]})`).join('; ') : `${names.size} names` + (CODE_CHANGED ? addedRemoved(ga, gb) : ''));
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
// 4c. Rich characters: gear, magic, super powers, talents, odd races and
// state flags, so far more of the Sheet, Gear, print and save code runs.
// For each one, compare: the decorated record, every page, the print sheet,
// the equipped-weapon summaries, and an Edit -> Save round trip.
{
  const RICH = [
    { spec: { steps: [{ name: 'Strong Hero', levels: 3 }, { name: 'Fighter', levels: 4 }], race: 'Human', name: 'Rich Bruiser' }, extras: { talents: ['Mangler'], flags: { raging: false }, enchant: true, weaponFocus: true } },
    { spec: { steps: [{ name: 'Rogue', levels: 5 }], race: 'Dwarf', name: 'Rich Dwarf Rogue' }, extras: { flags: { fatigued: true }, conditions: true } },
    { spec: { steps: [{ name: 'Sorcerer', levels: 6 }], race: 'Elf', name: 'Rich Elf Sorcerer' }, extras: {} },
    { spec: { steps: [{ name: 'Fast Hero', levels: 4 }, { name: 'Soldier', levels: 3 }], race: 'Human', name: 'Rich Super' }, extras: { powers: [{ name: 'Stoneskin', pool: 'super', mp: 10 }], flags: { nullified: true } } },
    { spec: { steps: [{ name: 'Ranger', levels: 4 }], race: 'Hybrid', hybrid: { a: 'Human', b: 'Elf', sizeFrom: 'Human' }, name: 'Rich Hybrid Ranger' }, extras: {} },
    { spec: { steps: [{ name: 'Wilder', levels: 5 }], race: 'Human', name: 'Rich Wilder' }, extras: { flags: { euphoric: true } } },
    { spec: { steps: [{ name: 'Berserker', levels: 4 }], race: 'Human', name: 'Rich Berserker' }, extras: { flags: { raging: true } } },
    { spec: { steps: [{ name: 'Monk', levels: 5 }], race: 'Human', name: 'Rich Monk' }, extras: {} },
    { spec: { steps: [{ name: 'Monk', levels: 6 }], race: 'Human', name: 'Rich Unarmed Monk' }, extras: { noGear: true } },
    { spec: { steps: [{ name: 'Fighter', levels: 4 }], race: 'Human', name: 'Rich Clawed Fighter' }, extras: { noGear: true, natural: true } },
    { spec: { steps: [{ name: 'Bard', levels: 4 }], race: 'Halfling', name: 'Rich Bard' }, extras: {} },
  ];
  const decorate = async ([spec, extras]) => {
    // Answer every dialog the same way in both builds, and make printing silent.
    window.confirmModal = async () => true;
    window.openChoiceModal = (title, opts, cb) => cb((opts || [])[0]);
    window.textModal = async (t, d) => d || 'x';
    window.print = () => {};
    try {
      const r = qdBespokeBuild(spec);
      if (!r.ok) return { ok: false, reason: r.reason };
      chars.push(r.char); curId = r.char.id; save();
      const c = r.char;
      const ts = 5;
      const melee = WEAPONS_CATALOG.filter(w => (w.tl || 0) <= ts && w.kind !== 'ranged').slice(0, 2);
      const ranged = WEAPONS_CATALOG.filter(w => (w.tl || 0) <= ts && w.kind === 'ranged').slice(0, 1);
      if (!extras.noGear) {
      for (const w of melee) await addItemToChar('weapon', w.name, 'main_hand', { skipPurchase: true });
      for (const w of ranged) await addItemToChar('weapon', w.name, 'off_hand', { skipPurchase: true });
      const armor = ARMOR_CATALOG.find(a => a.type !== 'shield' && (a.tl || 0) <= ts);
      if (armor) await addItemToChar('armor', armor.name, 'armor', { skipPurchase: true });
      const ring = MAGIC_ITEMS_DB.find(m => /^Ring of Protection/.test(m.name));
      if (ring) await addItemToChar('magic', ring.name, magicItemDefaultSlot(ring), { skipPurchase: true });
      }
      // An enchanted (+2 Flaming) and mastercrafted first weapon, Weapon Focus in it.
      const w0 = (c.items || []).find(i => i.catalogue === 'weapon');
      if (extras.enchant && w0) { w0.enchant = { enh: 2, abilities: ['Flaming'] }; w0.mastercraft = { bonus: 1, target: 'damage' }; }
      if (extras.weaponFocus && w0) c.feats = (c.feats || []).concat([{ name: 'Weapon Focus', param: w0.ref }]);
      // A mutation that grants a natural weapon (claws, bite, ...).
      if (extras.natural) { const nm = Object.keys(MUTATION_EFFECTS).find(n => (MUTATION_EFFECTS[n].natural || []).some(s => /: S \dd\d+ \/ M/.test(s))); if (nm) c.mutations = (c.mutations || []).concat([{ name: nm, kind: 'advantage' }]); }
      if (extras.powers) c.powers = (c.powers || []).concat(extras.powers);
      if (extras.talents) for (const t of extras.talents) { try { addTalentToChar(c, t); } catch (e) {} }
      if (extras.flags) Object.assign(c, extras.flags);
      // One condition from each severity tier (beneficial ... terminal), so the
      // tier-coloured condition pills on the Tracker and Sheet get drawn.
      if (extras.conditions) { const seen = new Set(); c.conditions = Object.keys(CONDITIONS_DATA).filter(k => { const tr = CONDITIONS_DATA[k].tier; if (seen.has(tr)) return false; seen.add(tr); return true; }); }
      save();
      return { ok: true, json: JSON.stringify(c) };
    } catch (e) { return { ok: false, reason: String(e) }; }
  };
  // (the test server's address differs between the two builds: strip it)
  // In style mode class and style attributes are compared through printStyles instead.
  const printOut = (STY) => { try { printSheet(); const ps = document.getElementById('print-sheet').cloneNode(true); if (STY) ps.querySelectorAll('[class],[style]').forEach(e => { e.removeAttribute('class'); e.removeAttribute('style'); }); return ps.innerHTML.split(location.origin).join(''); } catch (e) { return 'THREW ' + e; } };
  const weaponSums = () => { try { return JSON.stringify(computeEquippedWeaponSummaries(chars.find(x => x.id === curId))); } catch (e) { return 'THREW ' + e; } };
  const editSave = async () => {
    try { editCurrentChar(); await saveCharacter(); return JSON.stringify(chars.find(x => x.id === curId)); }
    catch (e) { return 'THREW ' + e; }
  };
  let richBuilt = 0, richChecks = 0, richFails = 0;
  const same = (id, a, b) => {
    richChecks++;
    // A crash in BOTH builds would compare equal and prove nothing: fail it.
    if (/^THREW /.test(a) || /^THREW /.test(b)) { richFails++; mark(`  ${id}`, false, `threw: OLD ${a.slice(0, 120)} | NEW ${b.slice(0, 120)}`); return; }
    const i = firstDiff(a, b);
    if (i !== -1) { richFails++; mark(`  ${id}`, false, `differs at ${i}: OLD ${ctx(a, i)} NEW ${ctx(b, i)}`); }
  };
  for (const { spec: s, extras } of RICH) {
    const spec = Object.assign({ sixLevels: SCALES, presetName: 'Custom', hybrid: null, occupation: '' }, s);
    const ra = await A.page.evaluate(decorate, [spec, extras]), rb = await B.page.evaluate(decorate, [spec, extras]);
    if (!ra.ok || !rb.ok) { same(`${s.name}: build outcome`, String(ra.reason), String(rb.reason)); console.log(`   (${s.name} not built in either: ${ra.reason})`); continue; }
    richBuilt++;
    same(`${s.name}: decorated record`, ra.json, rb.json);
    for (const pg of PAGES) {
      await A.page.evaluate((n) => { try { showPage(n); } catch (e) {} }, pg);
      await B.page.evaluate((n) => { try { showPage(n); } catch (e) {} }, pg);
      same(`${s.name} / ${pg}`, await markup(A.page), await markup(B.page));
    }
    same(`${s.name}: print sheet`, await A.page.evaluate(printOut, STYLES), await B.page.evaluate(printOut, STYLES));
    if (STYLES) same(`${s.name}: print sheet styles (print media)`, await printStyles(A.page), await printStyles(B.page));
    same(`${s.name}: weapon summaries`, await A.page.evaluate(weaponSums), await B.page.evaluate(weaponSums));
    same(`${s.name}: Edit -> Save`, await A.page.evaluate(editSave), await B.page.evaluate(editSave));
  }
  // A brand-new character saved through the Create page form (the path
  // qdBespokeBuild and Edit -> Save don't take): sandbox gate, a race, two
  // classes, the first-save confirmation, then saveCharacter().
  const formSave = async () => {
    window.confirmModal = async () => true;
    try {
      showPage('create'); clearForm();
      document.getElementById('c-name').value = 'Form Hero';
      const raceSel = document.getElementById('c-race'); raceSel.value = 'Dwarf'; raceSel.dispatchEvent(new Event('change'));
      enterSandboxMode();
      formClasses.push({ tier: 'basic', name: 'Fighter', level: 2, first: true }, { tier: 'basic', name: 'Expert', level: 1, first: false });
      renderClassList(); updateClassPreview();
      _firstSaveConfirmed = true;
      await saveCharacter();
      return JSON.stringify(chars[chars.length - 1]);
    } catch (e) { return 'THREW ' + e; }
  };
  same('New character via the Create form', await A.page.evaluate(formSave), await B.page.evaluate(formSave));
  for (const pg of ['sheet', 'gear', 'tracker']) {
    await A.page.evaluate((n) => { try { showPage(n); } catch (e) {} }, pg);
    await B.page.evaluate((n) => { try { showPage(n); } catch (e) {} }, pg);
    same(`Form Hero / ${pg}`, await markup(A.page), await markup(B.page));
  }
  mark('RICH-CHARACTERS-IDENTICAL', richFails === 0 && richBuilt > 0, `${richChecks} comparisons across ${richBuilt} decorated characters (pages, print sheet, weapon summaries, Edit -> Save)`);
}
// 4b. Globals again, after all that activity.
{
  const ga = await globalsSnapshot(A.page), gb = await globalsSnapshot(B.page);
  const diff = globalsDiff(ga, gb);
  mark('GLOBALS-IDENTICAL-AFTER-USE', diff.length === 0, diff.length ? `${diff.length} differ: ` + diff.slice(0, 8).join(', ') : '');
}
// 5. Console silence.
mark('NO-CONSOLE-ERRORS', A.errors.length === 0 && B.errors.length === 0, [...A.errors.map(e => 'OLD ' + e), ...B.errors.map(e => 'NEW ' + e)].slice(0, 4).join(' | '));

for (const x of [A, B]) { await x.browser.close(); x.server.close(); }
const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} green` + (fails.length ? ` — ${fails.length} FAIL` : ''));
process.exit(fails.length ? 1 : 0);
