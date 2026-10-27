// _probe_finegrit.mjs — v9.18.1 targeted probe: THE FINE GRIT.
// Census F1 (revised): the §276-era inline colour literals (#c499d4 violet,
// the .9-alpha violet/pool-blue families, the Fate Point button pair) were
// theme-immune, leaving HC at 5.57–6.95:1 on pages the §276 audit never
// rendered. Fixed by tokenizing (--vio/--tv90/--pb90/--fp-dmg/--fp-heal;
// :root keeps today's values exactly, only html[data-theme="hc"] brightens)
// + HC overrides for the never-overridden --tv70..85 family.
// Census F3: Gain focus / Clear History tap targets raised to ≥24px.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { appRequestHandler, readAppSource } from './_serve.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer(appRequestHandler(html, process.env.CG_FILE || resolve(__dir, '../index.html')));  // Phase 1 split: also serves css/, js/, assets/
await new Promise(r => server.listen(8796, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

// 1) Source level: the audited literal families are gone as text colours.
// (Phase 1 split: search index.html plus every css/js file it loads.)
const appSource = readAppSource(process.env.CG_FILE || resolve(__dir, '../index.html'));
mark('SOURCE-NO-VIOLET-LITERAL', !/color:#c499d4/.test(appSource), (appSource.match(/color:#c499d4/g) || []).length + ' remain');
mark('SOURCE-NO-PB90-LITERAL', !/rgba\(120,175,205,\.9\)/.test(appSource), '');
mark('SOURCE-NO-TV90-LITERAL', !/rgba\(196,153,212,\.9\)/.test(appSource), '');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8796/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof setDisplayPref === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 220))); } catch (e) { mark(id, false, String(e).slice(0, 220)); } };

// Shared in-page helpers (WCAG relative luminance + effective composited bg).
await page.evaluate(() => {
  window.__fg = {
    parse: (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; },
    lum: ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); },
    ratio(a, b) { const [l1, l2] = [this.lum(a), this.lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); },
    effBg(el) { let node = el; const stack = []; while (node && node !== document.documentElement) { const p = this.parse(getComputedStyle(node).backgroundColor); if (p && p[3] > 0) stack.push(p); node = node.parentElement; } stack.push(this.parse(getComputedStyle(document.body).backgroundColor) || [0, 0, 0, 1]); let out = stack[stack.length - 1].slice(0, 3); for (let i = stack.length - 2; i >= 0; i--) { const [r, g, b, a] = stack[i]; out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)]; } return out; },
    elRatio(el) { const cs = getComputedStyle(el); const fg = this.parse(cs.color); const bg = this.effBg(el); const fgc = fg[3] < 1 ? [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3])] : fg.slice(0, 3); return this.ratio(fgc, bg); },
  };
});

// 2) Parchment (default) and Classic keep today's values exactly.
await t('PARCHMENT-VIO-UNCHANGED', () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--vio').trim();
  return v === '#c499d4' || { vio: v };
});
await t('CLASSIC-VIO-UNCHANGED', () => {
  document.documentElement.setAttribute('data-theme', 'classic');
  const v = getComputedStyle(document.documentElement).getPropertyValue('--vio').trim();
  document.documentElement.removeAttribute('data-theme');
  return v === '#c499d4' || { vio: v };
});

// 3) HC: brightened tokens land, and clear AAA against the census's WORST
//    measured ground (the Fate Points tag's chip, rgb(44,34,41)).
await t('HC-TOKENS-AAA', () => {
  document.documentElement.setAttribute('data-theme', 'hc');
  const cs = getComputedStyle(document.documentElement);
  const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const worst = { vio: [44, 34, 41], tv70: [44, 34, 41], tv90: [44, 34, 41], pb90: [40, 36, 20], 'fp-dmg': [42, 28, 22], 'fp-heal': [28, 34, 44] };
  const bad = [];
  for (const [tok, bg] of Object.entries(worst)) {
    const raw = cs.getPropertyValue('--' + tok).trim();
    const rgb = raw.startsWith('#') ? hex2rgb(raw) : window.__fg.parse(raw);
    if (!rgb) { bad.push(tok + ':unparsed:' + raw); continue; }
    const r = window.__fg.ratio(rgb.slice(0, 3), bg);
    if (r < 7) bad.push(`${tok}=${raw}@${r.toFixed(2)}`);
  }
  return bad.length === 0 || { bad };
});

// 4) Live HC measurement of the Fate Point buttons on a seeded hero's Tracker.
await t('HC-FP-BUTTONS-LIVE', () => {
  // Hero class levels + Heroic 5 are required for the FP controls to show
  // (tr-ap-fp-controls, toggled in renderAPBar); Psion levels put a psionic
  // focus panel (Gain focus) on the Tracker for the tap-target test.
  const r = qdBespokeBuild({ steps: [{ name: 'Smart Hero', levels: 1 }, { name: 'Psion', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Fine Grit Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  chars.push(r.char); curId = r.char.id; renderNavTabs(r.char);
  showPage('tracker');
  const spend = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Spend Fate Point/.test(b.textContent));
  const rest = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Restore FP/.test(b.textContent));
  if (!spend || !rest) return { spend: !!spend, rest: !!rest };
  const rs = window.__fg.elRatio(spend), rr = window.__fg.elRatio(rest);
  return (rs >= 7 && rr >= 7) || { spend: +rs.toFixed(2), restore: +rr.toFixed(2) };
});

// 5) Tap targets ≥24px (census F3) — Gain focus (psionic Tracker) + Clear History.
await t('TAP-TARGETS-24', () => {
  const gain = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Gain focus/i.test(b.textContent));
  const clear = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Clear History/i.test(b.textContent));
  if (!gain || !clear) return { gain: !!gain, clear: !!clear };
  const g = gain.getBoundingClientRect(), c = clear.getBoundingClientRect();
  return (g.height >= 24 && c.height >= 24) || { gain: Math.round(g.height), clear: Math.round(c.height) };
});

// 6) Parchment look preserved live: the Spend FP button still renders #e08080.
await t('PARCHMENT-FP-UNCHANGED', () => {
  document.documentElement.removeAttribute('data-theme');
  const spend = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Spend Fate Point/.test(b.textContent));
  const col = getComputedStyle(spend).color;
  return col === 'rgb(224, 128, 128)' || { col };
});

await t('VERSION-STAMPED', () => (/^v9\.\d+\.\d+$/.test(CG_VERSION) && document.querySelector('.site-subtitle').textContent.includes(CG_VERSION)) || { CG_VERSION });
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== FINE GRIT PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
