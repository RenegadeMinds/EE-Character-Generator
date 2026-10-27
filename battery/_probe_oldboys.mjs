// _probe_oldboys.mjs — v9.19.0 targeted probe: THE OLD BOYS' SESSION.
// Field reports from the inaugural live table (2026-10-24):
//   #1 Autofire's "(Def 10)" was a vestigial d20M usage — E&E canon is AC.
//   #2 Mental Barrier's deflection reached computeStatBlock's ac lane but
//      the AC headline (computeACDisplay) never read the activeEffects
//      channel — §278's disease, third cell. Fixed by adding aeBon to the
//      display's misc pool (touch-legal, condition-filtered, NPF-aware).
//   #3 The Hero's Gift dot lingered with no visible chooser (it hid in
//      ✎ Edit's retcon panel): over-budget conforming feats now FOLD into
//      the gift (reconcileHerosGiftFold, once per record); balanced books
//      get a one-click claim card atop the Feats tab.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { appRequestHandler, readAppSource } from './_serve.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer(appRequestHandler(html, process.env.CG_FILE || resolve(__dir, '../index.html')));  // Phase 1 split: also serves css/, js/, assets/
await new Promise(r => server.listen(8797, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

// #1 at the source level. (Phase 1 split: the code is no longer inside
// index.html, so search index.html plus every css/js file it loads.)
const appSource = readAppSource(process.env.CG_FILE || resolve(__dir, '../index.html'));
mark('SOURCE-NO-DEF10', !appSource.includes('(Def 10)') && !/effective Defense (of )?10/.test(appSource.replace(/effective Defense of 10" — book letter/, '')), '');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8797/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof qdBespokeBuild === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 220))); } catch (e) { mark(id, false, String(e).slice(0, 220)); } };

// Seed the probe cast: window.print stubbed per the §276/§280 protocol-handoff doctrine.
await page.evaluate(() => { window.print = () => {}; });

// #1 live: an automatic weapon's Autofire alt-mode reads AC 10.
await t('AUTOFIRE-AC10-LIVE', () => {
  localStorage.clear(); chars = []; curId = null;
  const r = qdBespokeBuild({ steps: [{ name: 'Strong Hero', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 0, tech: 6 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Autofire Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  const c = r.char; chars.push(c); curId = c.id;
  c.items = c.items || [];
  c.items.push({ id: 'it-af', catalogue: 'weapon', ref: 'Automatic Rifle', slot: 'main_hand', equipped: true, mastercraft: null, gadgets: [] });
  save();
  const sums = computeEquippedWeaponSummaries(c);
  const af = (sums[0] && (sums[0].altModes || []).find(m => m.name === 'Autofire')) || null;
  if (!af) return { note: 'no Autofire alt-mode; modes: ' + JSON.stringify(sums[0] && sums[0].altModes) };
  return (af.display.includes('AC 10') && !af.display.includes('Def 10') && af.label.includes('AC 10'))
    || { display: af.display, labelHasAC10: af.label.includes('AC 10') };
});

// #2: Mental Barrier's +4 deflection reaches the AC headline — and leaves on dismiss.
await t('MB-AC-HEADLINE', () => {
  localStorage.clear(); chars = []; curId = null;
  const r = qdBespokeBuild({ steps: [{ name: 'Smart Hero', levels: 1 }, { name: 'Psion', levels: 4 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Barrier Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  const c = r.char; chars.push(c); curId = c.id; renderNavTabs(c);
  const before = computeACDisplay(c);
  applyWiredBuff(c, 'Mental Barrier', 'psionic', 0); save();
  const after = computeACDisplay(c);
  showPage('sheet');
  const cellAfter = document.getElementById('sh-stats').innerText.replace(/\s+/g, ' ').match(/AC\D{0,4}(\d+)/);
  const i = (c.activeEffects || []).findIndex(a => a.name === 'Mental Barrier');
  dismissBuffAt(i);
  const dismissed = computeACDisplay(c);
  const t0 = Number(before.value.split('/')[0]), t1 = Number(after.value.split('/')[0]), t2 = Number(dismissed.value.split('/')[0]);
  return (t1 === t0 + 4 && t2 === t0 && cellAfter && Number(cellAfter[1]) === t1)
    || { before: before.value, after: after.value, dismissed: dismissed.value, cell: cellAfter && cellAfter[0] };
});

// #2 guard: a GATED buff (condition-carrying) must NOT move the headline.
await t('MB-GATED-EXCLUDED', () => {
  const c = chars.find(x => x.name === 'Barrier Probe');
  const before = computeACDisplay(c);
  c.activeEffects = [{ id: 'ae-t', name: 'Dispel [Alignment]', pool: 'psionic', effects: [{ k: 'ac', type: 'deflection', v: 4, cond: 'vs creatures of the targeted alignment', gated: true }], expires: 'manual', appliedAt: 'probe' }];
  const after = computeACDisplay(c);
  c.activeEffects = [];
  return (after.value === before.value) || { before: before.value, after: after.value };
});

// #3a: over-budget + conforming feat ⇒ the fold (once, slot filled, dot dead).
await t('GIFT-FOLD-OVERBUDGET', () => {
  localStorage.clear(); chars = []; curId = null;
  const r = qdBespokeBuild({ steps: [{ name: 'Smart Hero', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 0, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Fold Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  const c = r.char; chars.push(c); curId = c.id;
  c.heroesGiftChoice = null;
  c.feats = c.feats || [];
  const fb0 = getFeatBudget(c);
  const POOLF = ['Dodge', 'Mobility', 'Combat Reflexes', 'Great Fortitude', 'Iron Will', 'Lightning Reflexes', 'Toughness', 'Alertness'];
  let k = 0;
  while (getFeatBudget(c).picked <= getFeatBudget(c).total && k < POOLF.length) c.feats.push({ name: POOLF[k++] });
  if (getFeatBudget(c).picked <= getFeatBudget(c).total) return { note: 'could not overfill budget', fb0 };
  save(); renderRoster();   // the heal loop runs the fold
  const fb1 = getFeatBudget(c);
  const slot = (c.firstLevelSlots || []).find(s => s.kind === 'herosGift');
  const dot = (outstandingSelections(c).feats || []).join(' ');
  return (c.heroesGiftChoice === 'feat' && c.hgFoldDone === true && slot && slot.filled
    && fb1.total === fb0.total + 1 && !/Gift/.test(dot))
    || { choice: c.heroesGiftChoice, folded: c.hgFoldDone, slotFilled: slot && slot.filled, dot };
});

// #3b: balanced books ⇒ NO fold; the claim card renders; dot text points to it.
await t('GIFT-CARD-BALANCED', () => {
  localStorage.clear(); chars = []; curId = null;
  const r = qdBespokeBuild({ steps: [{ name: 'Fast Hero', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 0, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Card Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  const c = r.char; chars.push(c); curId = c.id;
  c.heroesGiftChoice = null;
  save(); renderRoster(); renderNavTabs(c);
  if (c.heroesGiftChoice !== null) return { note: 'fold fired on balanced books!', choice: c.heroesGiftChoice };
  showPage('feats');
  // innerText arrives through .btn's text-transform:uppercase — compare
  // case-insensitively (the GMF v0.8.9 subtitle lesson, same trap).
  const ft = document.getElementById('ft-content').innerText.toLowerCase();
  const dot = (outstandingSelections(c).feats || []).join(' ');
  return (ft.includes("hero's gift unclaimed") && ft.includes('claim as feat') && ft.includes('claim as talent') && /feats tab/i.test(dot))
    || { cardShown: ft.includes("hero's gift unclaimed"), claimFeat: ft.includes('claim as feat'), dot: dot.slice(-80) };
});

// #3c: the claim click works from the card (confirm stubbed) and the card retires.
await t('GIFT-CLAIM-FLOW', async () => {
  const real = window.confirmModal; window.confirmModal = async () => true;
  try {
    const c = chars.find(x => x.name === 'Card Probe');
    const t0 = getFeatBudget(c).total;
    await assignHerosGiftAsFeat();
    const ft = document.getElementById('ft-content').innerText.toLowerCase();
    return (c.heroesGiftChoice === 'feat' && getFeatBudget(c).total === t0 + 1 && !ft.includes("hero's gift unclaimed"))
      || { choice: c.heroesGiftChoice, total: getFeatBudget(c).total, t0, cardGone: !ft.includes("hero's gift unclaimed") };
  } finally { window.confirmModal = real; }
});

await t('VERSION-STAMPED', () => (/^v9\.\d+\.\d+$/.test(CG_VERSION) && document.querySelector('.site-subtitle').textContent.includes(CG_VERSION)) || { CG_VERSION });
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== OLD BOYS PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
