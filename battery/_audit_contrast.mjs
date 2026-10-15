// _audit_contrast.mjs — v9.16.0 rendered WCAG 2.2 contrast audit (§276).
// Walks every visible text-bearing element on the main pages (with a probe
// hero loaded), composites its text colour (incl. alpha and ancestor
// opacity) over the effective ancestor background, and reports AA (4.5 / 3
// large) failures grouped by colour pair. `--theme=hc` audits the High
// Contrast theme against AAA (7 / 4.5 large). `CG_FILE=path` audits another
// build (default ../index.html). Exported auditPage() is reused by the probe.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function auditPage(page, { aaa = false } = {}) {
  return page.evaluate((aaa) => {
    const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const L = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
    const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
    const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const hex = a => '#' + a.slice(0, 3).map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
    function bgOf(el) {
      const chain = [];
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.push(e);
      let bg = [255, 255, 255];
      for (let i = chain.length - 1; i >= 0; i--) {
        const c = parse(getComputedStyle(chain[i]).backgroundColor);
        if (c && c[3] > 0) bg = over(c, bg);
      }
      return bg;
    }
    function opacityOf(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 1; return o; }
    const fails = {}; let checked = 0, failed = 0;
    const els = document.querySelectorAll('body *');
    for (const el of els) {
      if (/^(SCRIPT|STYLE|OPTION|svg|path)$/i.test(el.tagName)) continue;
      // #toast animates its opacity in/out — mid-fade samples are meaningless.
      if (el.closest('#print-sheet,[aria-hidden="true"],#toast')) continue;
      const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'range' && el.type !== 'hidden';
      const txt = isField ? (el.value || '') : [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!txt || !/[A-Za-z0-9]/.test(txt)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const op = opacityOf(el);
      if (op < .05) continue;
      const fg = parse(cs.color); if (!fg) continue;
      const bg = bgOf(el);
      const eff = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
      const cr = ratio(eff, bg);
      const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight) || 400;
      const large = px >= 24 || (px >= 18.66 && w >= 700);
      const need = aaa ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
      checked++;
      if (cr + 1e-9 < need) {
        failed++;
        const key = `${hex(eff)} on ${hex(bg)} (${cs.color})`;
        const f = fails[key] || (fails[key] = { cr: +cr.toFixed(2), need, n: 0, sample: [] });
        f.n++;
        if (f.sample.length < 3) f.sample.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${txt.slice(0, 40)}"`);
      }
    }
    return { checked, failed, fails };
  }, aaa);
}

export async function makeHero(page, name) {
  return page.evaluate(async (name) => {
    window.confirmModal = async () => true;
    showPage('create');
    enterSandboxMode();
    _firstSaveConfirmed = true;
    document.getElementById('c-name').value = name;
    formClasses.length = 0;
    formClasses.push({ name: 'Charismatic Hero', tier: 'hero', level: 3 });
    await saveCharacter();
    return chars.find(x => x.name === name)?.id;
  }, name);
}

const PAGES = ['roster', 'create', 'sheet', 'skills', 'feats', 'gear', 'tracker'];

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const puppeteer = (await import('puppeteer')).default;
  const __dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'));
  const hc = process.argv.includes('--theme=hc');
  const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise(r => server.listen(8791, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8791/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof chars !== "undefined" && typeof saveCharacter === "function"', { timeout: 60000 });
  // (headless Chrome can't emulate prefers-contrast — set the persisted pref)
  if (hc) await page.evaluate(() => { localStorage.setItem('dxd20v2_display', JSON.stringify({ theme: 'hc' })); window.applyDisplayPrefs(); });
  await makeHero(page, 'Contrast Probe');
  const total = { checked: 0, failed: 0 }; const all = {};
  for (const p of PAGES) {
    // The awaiting-gate Create form is deliberately dimmed (inactive UI, exempt
    // under SC 1.4.3) — audit it in the sandbox state a player actually edits in.
    await page.evaluate(p => { showPage(p); if (p === 'create') enterSandboxMode(); }, p);
    const r = await auditPage(page, { aaa: hc });
    total.checked += r.checked; total.failed += r.failed;
    for (const [k, v] of Object.entries(r.fails)) { const a = all[k] || (all[k] = { ...v, n: 0, pages: [] }); a.n += v.n; a.pages.push(p); }
    console.log(`${p.padEnd(8)} checked ${r.checked}, failing ${r.failed}`);
  }
  console.log(`\n${hc ? 'AAA (HC theme)' : 'AA'} — ${total.failed}/${total.checked} text elements below threshold\n`);
  for (const [k, v] of Object.entries(all).sort((a, b) => b[1].n - a[1].n)) console.log(`${String(v.n).padStart(4)} × ${v.cr}:1 (need ${v.need}) ${k} [${[...new Set(v.pages)].join(',')}] e.g. ${v.sample.join(' | ')}`);
  await browser.close(); server.close();
}
