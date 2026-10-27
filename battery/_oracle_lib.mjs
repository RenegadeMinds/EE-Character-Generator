// _oracle_lib.mjs — shared harness for the _oracle_*.mjs differential sweep
// (2026-10-13). The ORACLE side never reads CG data: it parses the rulebook
// text extractions directly (HH = Hero's Handbook, GMG = GM's Guide, FF = Foe
// Folio) so a CG table typo can't leak into its own expected values.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
export const CG_FILE = resolve(__dir, '../index.html');
export const BOOK_DIR = fileURLToPath(new URL('../../EE-Rulebooks/extraction', import.meta.url));

// ---------- book text ----------
const _cache = {};
export function bookLines(book) {
  if (_cache[book]) return _cache[book];
  const txt = readFileSync(`${BOOK_DIR}/${book}_text.txt`, 'utf8')
    .replace(/â€™/g, "'").replace(/â€œ|â€\u009d/g, '"').replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€"/g, '-');
  let page = 0;
  _cache[book] = txt.split('\n').map(text => {
    const m = text.match(/===== PAGE (\d+) =====/); if (m) page = +m[1];
    return { text: text.replace(/\r$/, ''), page };
  });
  return _cache[book];
}
const sNum = t => { const m = String(t).match(/^[+−-]?\d+/); return m ? parseInt(m[0].replace('−', '-'), 10) : NaN; };

// Every "<Class> Class Statistics by Level" table, with the Hit Die and
// Action Points lines that precede it in the class entry.
export function parseClassTables(book) {
  const L = bookLines(book);
  const out = {};
  let lastHD = null, lastAP = null;
  for (let i = 0; i < L.length; i++) {
    const t = L[i].text;
    let m;
    if ((m = t.match(/^Hit Die(?: \(of the Hero\))?:\s*d(\d+)(?:\s*\((?:1)?d(\d+)\+(\d+)\))?/))) {
      lastHD = { hd: +m[1], heroDie: m[2] ? +m[2] : null, heroAdd: m[3] ? +m[3] : null, ofTheHero: /of the Hero/.test(t), page: L[i].page };
      lastAP = null; continue;
    }
    if (/^Action Points:/.test(t)) {
      const s = t + ' ' + (L[i + 1]?.text || '');
      const n = s.match(/equal to (\d+) \+ one-half/);
      lastAP = { apB: n ? +n[1] : (/Charisma modifier/.test(s) ? 'cha' : null), page: L[i].page };
      continue;
    }
    if (!(m = t.match(/^(.+?) Class Statistics by Level$/))) continue;
    const name = m[1].trim();
    const header = L[i + 1]?.text || '';
    const hasLead = /\bPP\b|Chrgs/.test(header);
    const rows = {};
    for (let j = i + 2; j < L.length && j < i + 60; j++) {
      const r = L[j].text;
      if (/^Class Features$|Class Statistics by Level$|^Table:/.test(r)) break;
      const rm = r.match(/^(\d{1,2})(st|nd|rd|th)\s+(.*)$/);
      if (!rm) continue;
      const lvl = +rm[1];
      if (lvl !== Object.keys(rows).length + 1) break;  // rows are sequential; anything else is a wrapped feature line or the next table
      const toks = rm[3].split(/\s+/);
      let k = 0; let lead = null;
      if (hasLead) { lead = sNum(toks[k]); k++; }
      const ba = sNum(toks[k]); const fort = sNum(toks[k + 1]); const ref = sNum(toks[k + 2]); const will = sNum(toks[k + 3]);
      const signed = toks.filter(x => /^[+−-]\d+$/.test(x));
      const def = sNum(signed[signed.length - 2]); const rep = sNum(signed[signed.length - 1]);
      rows[lvl] = { lead, ba, fort, ref, will, def, rep };
    }
    const lv = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const col = k => lv.map(l => rows[l][k]);
    out[name] = {
      name, book, page: L[i].page, levels: lv.length, header,
      pp: hasLead && /\bPP\b/.test(header) ? col('lead') : null,
      bab: col('ba'), fort: col('fort'), ref: col('ref'), will: col('will'), def: col('def'), rep: col('rep'),
      hd: lastHD, ap: lastAP,
    };
    lastHD = null; lastAP = null;
  }
  return out;
}

// ---------- CG page ----------
export async function openCG() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(CG_FILE).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof computeStatBlock === "function" && typeof HERO_CLASSES !== "undefined"', { timeout: 60000 });
  await page.evaluate(() => {
    // A minimal, engine-complete test character (Human, all-10 attributes,
    // permissive scales, nothing equipped). Probes override what they test.
    window.__oracleChar = (over = {}) => Object.assign({
      id: 'oracle-' + Math.random().toString(36).slice(2, 8), name: 'Oracle', race: 'Human', sex: '', align: 'Neutral',
      hybrid: null, allegiance: '', occupations: [], xp: 0, hpMode: 'hero', attrs: [10, 10, 10, 10, 10, 10], attrBumps: [],
      sixLevels: { arcane: 5, divine: 5, heroic: 5, mutation: 0, psionic: 5, tech: 5 }, scenarioPreset: 'Custom',
      classes: [], skills: {}, feats: [], powers: [], talents: [], items: [], gear: [], mutations: [], fatePoints: 0,
    }, over);
  });
  return { browser, page, errors };
}

// The CG's class tables (read-only snapshot) keyed by name, with tier.
export async function dumpCGClasses(page) {
  return page.evaluate(() => {
    const o = {};
    const T = [['hero', HERO_CLASSES], ['ordinary', ORDINARY_CLASSES], ['basic', BASIC_CLASSES], ['advanced', ADVANCED_CLASSES], ['prestige', PRESTIGE_CLASSES]];
    for (const [tier, tab] of T) for (const [n, d] of Object.entries(tab)) {
      o[n] = { tier, bab: d.bab, fort: d.fort, ref: d.ref, will: d.will, def: d.def, rep: d.rep, hd: d.hd, apB: d.apB, sp: d.sp, maxLvl: d.maxLvl };
    }
    return o;
  });
}
// Book table title → CG class key(s). "Eldritch / Holy Knight" is one table
// for two CG classes.
export function cgNamesFor(bookName, cg) {
  if (cg[bookName]) return [bookName];
  const parts = bookName.split('/').map(s => s.trim());
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].split(' ').slice(1).join(' ');  // "Holy Knight" → "Knight"
    return parts.map(p => (p.includes(' ') ? p : p + ' ' + tail)).filter(n => cg[n]);
  }
  const k = Object.keys(cg).find(n => n.toLowerCase() === bookName.toLowerCase());
  if (k) return [k];
  // One book table, several CG variants: "Theurge" → Mystic/Psychic Theurge,
  // "Guildmember" → Guildmember (Magic)/(Psionic).
  const re = new RegExp(`\\b${bookName}\\b`, 'i');
  return Object.keys(cg).filter(n => cg[n].tier === 'prestige' && re.test(n));
}
// null when equal over the book's levels; else the first differing level
// plus `all` = "L3 book +1/CG +2, L5 …" for the report.
export function firstDiff(a = [], b = [], n) {
  const all = [];
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) all.push(`L${i + 1} book +${a[i]}/CG +${b[i]}`);
  if (!all.length) return null;
  const i = a.findIndex((v, k) => v !== b[k]);
  return { lvl: i + 1, book: a[i], cg: b[i], all: all.join(', ') };
}

// ---------- reporting ----------
export function reporter(title) {
  const results = [];
  console.log(`\n== ${title} ==`);
  return {
    results,
    mark(id, pass, note = '') { results.push({ id, pass, note }); console.log(`${pass ? '  ✓' : '  ✗ DIFF'} ${id}${note ? ' — ' + note : ''}`); },
    info(msg) { console.log('  · ' + msg); },
    finish(errors = []) {
      const fails = results.filter(r => !r.pass);
      console.log(`== ${title}: ${results.length - fails.length}/${results.length} match · ${fails.length} diff · ${errors.length} console errors`);
      if (errors.length) console.log(errors.slice(0, 5).join('\n'));
      return fails.length;
    },
  };
}
export const sum = a => a.reduce((s, x) => s + x, 0);
