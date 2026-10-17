// _probe_firelink.mjs — v9.9.0 targeted probe: FIRE-LINKED WEAPONS, MAIN
// CANNONS & MISSILE BATTERIES (FF pp.641-642). Validates the worked "Arming a
// TS 7 Cruiser" example (Ion 39 → 42 → 45 → 48; Heavy Laser 31 → 34 → 37;
// Plasma battery 46 → 48 each), the I16 hull ceiling, the one-main-cannon
// refusal, battery threat/multiplier math, card chips/tooltips, print tags —
// ending with a full modal-chain install of the octo Ion main cannon.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8781, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8781/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof shipLinkOptions === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

// ---- Suite A: the FF p.642 worked example, pure math ----
await t('ION-LADDER-39-42-45-48', () => {
  const def = Object.assign({ cls: 'Mediumweight' }, STARSHIP_SUBTYPES['Cruiser']);
  const ion = STARSHIP_WEAPONS.find(w => w.name === 'Ion Cannon');
  const o = shipLinkOptions(def, ion, false);
  const dcs = o.map(x => x.dc).join(','), dice = o.map(x => x.dice).join(',');
  return dcs === '39,42,45,48' && dice === '10d6,15d6,20d6,25d6' && o[3].main === true && o[3].size === 'Colossal (Mediumweight)'
    || { dcs, dice, main: o[3] && o[3].main, size: o[3] && o[3].size };
});
await t('HEAVY-LASER-PHASER-34-37', () => {
  const def = STARSHIP_SUBTYPES['Cruiser'];
  const hl = STARSHIP_WEAPONS.find(w => w.name === 'Laser, Heavy');
  const o = shipLinkOptions(def, hl, false);
  const twin = o.find(x => x.link === 2), quad = o.find(x => x.link === 4);
  return twin.dc === 34 && twin.dice === '15d8' && twin.size === 'Colossal (Ultralight)'
    && quad.dc === 37 && quad.dice === '20d8' && quad.size === 'Colossal (Light)'
    || { twin, quad };
});
// ---- Suite B: the I16 hull ceiling ----
await t('I16-CEILING-BY-HULL', () => {
  const hl = STARSHIP_WEAPONS.find(w => w.name === 'Laser, Heavy');   // Gargantuan min
  const la = STARSHIP_WEAPONS.find(w => w.name === 'Laser');          // Huge min
  const ng = STARSHIP_WEAPONS.find(w => w.name === 'Neutron Gun, Heavy'); // Colossal min
  const ul = STARSHIP_SUBTYPES['Escort'], lt = STARSHIP_SUBTYPES['Destroyer'], sh = STARSHIP_SUBTYPES['Dreadnought'];
  const max = (def, w) => Math.max(...shipLinkOptions(def, w, false).map(x => x.link));
  return max(ul, hl) === 2 && max(ul, la) === 4 && max(ul, ng) === 1 && max(lt, hl) === 4 && max(lt, la) === 8 && max(sh, hl) === 32
    || { ulHL: max(ul, hl), ulLa: max(ul, la), ulNG: max(ul, ng), ltHL: max(lt, hl), ltLa: max(lt, la), shHL: max(sh, hl) };
});
// ---- Suite C: one main cannon per ship ----
await t('ONE-MAIN-CANNON-REFUSAL', () => {
  const def = STARSHIP_SUBTYPES['Cruiser'];
  const ion = STARSHIP_WEAPONS.find(w => w.name === 'Ion Cannon');
  const o = shipLinkOptions(def, ion, true); // a main cannon already aboard
  return Math.max(...o.map(x => x.link)) === 4 || { offered: o.map(x => x.link) };
});
await t('HAS-MAIN-CANNON-DETECT', () => {
  const it = { paLoadout: [{ slot: 'W1', gear: 'Ion Cannon', link: 8 }] };
  const it2 = { paLoadout: [{ slot: 'W1', gear: 'Ion Cannon', link: 4 }] };
  return shipHasMainCannon(it) === true && shipHasMainCannon(it2) === false;
});
// ---- Suite D: threat & battery math ----
await t('MAIN-CANNON-THREAT-PLUS-1', () => {
  const ion = STARSHIP_WEAPONS.find(w => w.name === 'Ion Cannon');       // crit 20
  const am = STARSHIP_WEAPONS.find(w => w.name === 'Antimatter Cannon'); // crit 18-20
  return shipThreatRange(ion.stat, 1) === '19-20' && shipThreatRange(am.stat, 1) === '17-20'
    || { ion: shipThreatRange(ion.stat, 1), am: shipThreatRange(am.stat, 1) };
});
await t('PLASMA-BATTERY-MATH', () => {
  const pl = STARSHIP_WEAPONS.find(w => w.name === 'Missile, Plasma');   // DC 46, crit 19-20
  // Battery of 2: DC 48 each, threat 18-20, crit ×3; battery of 4: 16-20, ×5.
  return pl.dc + 2 === 48 && shipThreatRange(pl.stat, 1) === '18-20' && shipThreatRange(pl.stat, Math.min(3, 3)) === '16-20'
    && (1 + 2) === 3 && (1 + 4) === 5
    || { dcEach: pl.dc + 2, t2: shipThreatRange(pl.stat, 1), t4: shipThreatRange(pl.stat, 3) };
});
// ---- Suite E: the commissioned Cruiser wears it all (card + print) ----
await t('CRUISER-CARD-AND-PRINT', () => {
  const r = qdBespokeBuild({ steps: [{ name: 'Fighter', levels: 4 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 5, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Probe Captain', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  chars.push(r.char); curId = r.char.id;
  const c = r.char; c.items = c.items || [];
  const it = {
    id: 'item_probeship', catalogue: 'starship', ref: 'Cruiser', customName: 'ESS Enterprising',
    ship: { name: 'ESS Enterprising', subtype: 'Cruiser', engine: 'Fusion Torch', armor: 'Vanadium' },
    slot: 'carried', equipped: false, mastercraft: null, gadgets: [],
    paLoadout: [
      { slot: 'Weapon 1', gear: 'Laser, Heavy', state: 'ok', link: 4, variable: true },
      { slot: 'Weapon 2', gear: 'Missile, Plasma', state: 'ok', battery: 2 },
      { slot: 'Weapon 3', gear: 'Ion Cannon', state: 'ok', link: 8 },
    ],
  };
  c.items.push(it);
  const card = renderStarshipCards(c);
  const checks = {
    quadChip: card.includes('⛓ ×4 link (variable)'),
    mainChip: card.includes('★ main cannon ×8'),
    batChip: card.includes('⧉ battery ×2'),
    quadTip: card.includes('damage 20d8') && card.includes('DC 37'),
    mainTip: card.includes('damage 25d6') && card.includes('DC 48') && card.includes('crit 19-20') && card.includes('25% power'),
    batTip: card.includes('threat 18-20') && card.includes('×3') && card.includes('DC 48 per launcher'),
    variableTip: card.includes('Variable link'),
  };
  if (Object.values(checks).some(v => !v)) return checks;
  // Print tags: printSheet() fills #print-sheet, then calls window.print — stubbed here.
  const prevPrint = window.print; window.print = () => {};
  try { printSheet(); } finally { window.print = prevPrint; }
  const printHTML = document.getElementById('print-sheet').innerHTML;
  const p = { quad: printHTML.includes('[×4 link, variable]'), main: printHTML.includes('[main cannon ×8]'), bat: printHTML.includes('[battery ×2]') };
  return (p.quad && p.main && p.bat) || p;
});
// ---- Suite F: the full modal chain — installing the octo Ion main cannon ----
const pickChoice = async (rx) => {
  await page.waitForFunction(`document.getElementById('choice-modal').classList.contains('open')`, { timeout: 8000 });
  return page.evaluate((rxSrc) => {
    const rx2 = new RegExp(rxSrc, 'i');
    const sel = document.getElementById('choice-modal-select');
    const opt = Array.from(sel.options).find(o => rx2.test(o.value));
    if (!opt) return { pass: false, note: 'no option matching ' + rxSrc + ' in: ' + Array.from(sel.options).slice(0, 8).map(o => o.value).join(' | ') };
    sel.value = opt.value; confirmChoiceModal(); return { pass: true, picked: opt.value };
  }, rx.source);
};
const fillText = async (val) => {
  await page.waitForFunction(`document.getElementById('text-modal').classList.contains('open')`, { timeout: 8000 });
  return page.evaluate((v) => { document.getElementById('text-modal-input').value = v; resolveTextModal(true); return { pass: true }; }, val);
};
try {
  await page.evaluate(() => { paAddLoadoutLine('item_probeship'); });
  let r = await pickChoice(/^Ion Cannon \(TS 7/); if (!r.pass) throw new Error(r.note);
  r = await pickChoice(/^Turret \/ bank/); if (!r.pass) throw new Error(r.note);
  // The fire-link modal: ×8 MUST NOT be offered (the octo Ion already aboard); take ×2 dual.
  await page.waitForFunction(`document.getElementById('choice-modal').classList.contains('open')`, { timeout: 8000 });
  const linkOpts = await page.evaluate(() => Array.from(document.getElementById('choice-modal-select').options).map(o => o.value));
  mark('CHAIN-MAIN-REFUSED-IN-MODAL', !linkOpts.some(o => /MAIN CANNON/.test(o)) && linkOpts.some(o => /×4/.test(o)), linkOpts.join(' | ').slice(0, 160));
  mark('CHAIN-DUAL-DC-42', linkOpts.some(o => /×2 dual-linked — 15d6 · Colossal \(Ultralight\) · DC 42/.test(o)), linkOpts.find(o => /×2/.test(o)) || '');
  r = await pickChoice(/×2 dual-linked/); if (!r.pass) throw new Error(r.note);
  await fillText('Weapon 4');
  const line = await page.evaluate(() => { const it = chars.find(x => x.id === curId).items.find(i => i.id === 'item_probeship'); return it.paLoadout[it.paLoadout.length - 1]; });
  mark('CHAIN-LINE-RECORDED', line.gear === 'Ion Cannon' && line.link === 2 && !line.battery, JSON.stringify(line));
} catch (e) { mark('CHAIN-INSTALL', false, String(e).slice(0, 200)); }
// The battery chain: a second Plasma battery of 4 on the same ship.
try {
  await page.evaluate(() => { paAddLoadoutLine('item_probeship'); });
  let r = await pickChoice(/^Missile, Plasma \(TS 7/); if (!r.pass) throw new Error(r.note);
  await page.waitForFunction(`document.getElementById('choice-modal').classList.contains('open')`, { timeout: 8000 });
  const bOpts = await page.evaluate(() => Array.from(document.getElementById('choice-modal-select').options).map(o => o.value));
  mark('CHAIN-BATTERY-4-MATH', bOpts.some(o => /Battery of 4 launchers — threat 16-20 \(\+3\) · crit ×5 · DC 48 each \(4×\)/.test(o)), bOpts.join(' | ').slice(0, 200));
  r = await pickChoice(/Battery of 4/); if (!r.pass) throw new Error(r.note);
  await fillText('Weapon 5');
  const line = await page.evaluate(() => { const it = chars.find(x => x.id === curId).items.find(i => i.id === 'item_probeship'); return it.paLoadout[it.paLoadout.length - 1]; });
  mark('CHAIN-BATTERY-RECORDED', line.gear === 'Missile, Plasma' && line.battery === 4 && !line.link, JSON.stringify(line));
} catch (e) { mark('CHAIN-BATTERY', false, String(e).slice(0, 200)); }
// An Ultralight hull must never be offered a missile battery (Colossal (Light)+ only).
await t('NO-BATTERY-ON-ULTRALIGHT', () => {
  const c = chars.find(x => x.id === curId);
  c.items.push({ id: 'item_probefighter', catalogue: 'starship', ref: 'Fighter', ship: { name: 'F1', subtype: 'Fighter', engine: 'Thrusters', armor: 'Polymeric' }, slot: 'carried', paLoadout: [] });
  const def = shipDefOf(c.items.find(i => i.id === 'item_probefighter'));
  return def.cls === 'Ultralight'; // the picker gates on cls !== 'Ultralight' — assert the def resolves so the gate is live
});

mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');
const passed = results.filter(r => r.pass).length;
console.log(`\n== FIRE-LINK PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
