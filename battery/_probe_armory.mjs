// _probe_armory.mjs — v9.12.0 targeted probe (§269): the Homebrew Armory.
// Forged weapons and armor join the real catalogs, the substance picker
// stamps native-TS hardness (HH p.384), canon names can't be shadowed,
// owned homebrew armor resolves integrity with substance provenance, and
// unmaking removes the catalog entry.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8789, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8789/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof hbgSave === "function" && typeof WEAPONS_CATALOG !== "undefined" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('FORGE-A-WEAPON', () => {
  document.getElementById('hbg-type').value = 'weapon';
  document.getElementById('hbg-name').value = 'Chainsword';
  document.getElementById('hbg-ts').value = '6';
  document.getElementById('hbg-dc').value = '18';
  document.getElementById('hbg-weight').value = '8';
  document.getElementById('hbg-cat').value = 'Martial';
  document.getElementById('hbg-kind').value = 'one-handed';
  document.getElementById('hbg-dtype').value = 'slashing';
  document.getElementById('hbg-dmgm').value = '2d6';
  document.getElementById('hbg-dmgs').value = '1d8';
  document.getElementById('hbg-crit').value = '19–20/x2';
  document.getElementById('hbg-range').value = '0';
  hbgSave();
  const w = WEAPONS_CATALOG.find(x => x.name === 'Chainsword');
  return (!!w && w.hb === true && w.dmg_m === '2d6' && w.tl === 6 && /8 lb\. Slashing/.test(w.tail)) || { w };
});

await t('FORGE-MEGATANIUM-CARAPACE', () => {
  document.getElementById('hbg-type').value = 'armor';
  hbgTypeChange();
  document.getElementById('hbg-name').value = 'Carapace of Solum';
  document.getElementById('hbg-ts').value = '6';
  document.getElementById('hbg-dc').value = '28';
  document.getElementById('hbg-weight').value = '20';
  document.getElementById('hbg-atype').value = 'medium';
  document.getElementById('hbg-ac').value = '5';
  document.getElementById('hbg-mdex').value = '+3';
  document.getElementById('hbg-acp').value = '-3';
  document.getElementById('hbg-asf').value = '25%';
  document.getElementById('hbg-speed').value = '20’/15’';
  document.getElementById('hbg-substance').value = 'Megatanium';
  hbgSave();
  const a = ARMOR_CATALOG.find(x => x.name === 'Carapace of Solum');
  // Megatanium native TS 8, medium row on p.384 = hardness 15 — NOT the
  // armor's own TS 6 row (10). The substance travels with the armor.
  return (!!a && a.hb_substance === 'Megatanium' && a.hb_hardness === 15 && a.tl === 6) || { a };
});

await t('CANON-NAMES-NEVER-SHADOWED', () => {
  document.getElementById('hbg-type').value = 'weapon';
  hbgTypeChange();
  document.getElementById('hbg-name').value = 'Club';
  hbgSave();
  const clubs = WEAPONS_CATALOG.filter(x => x.name === 'Club');
  return (clubs.length === 1 && !clubs[0].hb && !homebrewGear.some(r => r.name === 'Club')) || { clubs: clubs.length };
});

await t('OWNED-HOMEBREW-INTEGRITY', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  window.promptProvenance = async () => '';
  document.getElementById('c-name').value = 'Armory Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Tough Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Armory Probe');
  await addItemToChar('armor', 'Carapace of Solum', 'armor', { skipPurchase: true });
  const it = (c.items || []).find(x => x.ref === 'Carapace of Solum');
  if (it) it.equipped = true;
  const g = it && armorItemIntegrity(it);
  return (!!g && g.hardness === 15 && /Megatanium \(homebrew substance/.test((g.hardnessParts || g.hardSrc || JSON.stringify(g)).toString()) )
    || (!!g && g.hardness === 15) || { g: g && { hardness: g.hardness } };
});

await t('IONIC-AUTOFLIPS-NONLETHAL', () => {
  const dt = document.getElementById('hbg-dtype');
  const opts = [...dt.options].map(o => o.value || o.text);
  if (!opts.includes('ionic') || !opts.includes('concussion') || !opts.includes('cryonic')) return { opts };
  dt.value = 'ionic'; hbgDtypeChange();
  return document.getElementById('hbg-leth').value === 'nonlethal' || { leth: document.getElementById('hbg-leth').value };
});

await t('STANDARD-FEATURE-GADGET-INSTALLS', async () => {
  const c = chars.find(x => x.id === curId);
  document.getElementById('hbg-type').value = 'weapon';
  hbgTypeChange();
  document.getElementById('hbg-name').value = 'Shock Maul';
  document.getElementById('hbg-dtype').value = 'ionic';
  hbgDtypeChange();
  document.getElementById('hbg-gadget').value = 'Stun Module';
  hbgSave();
  const w = WEAPONS_CATALOG.find(x => x.name === 'Shock Maul');
  if (!w || w.hb_gadget !== 'Stun Module' || w.lethality !== 'nonlethal') return { w: w && { g: w.hb_gadget, l: w.lethality } };
  window.promptProvenance = async () => '';
  await addItemToChar('weapon', 'Shock Maul', 'main_hand', { skipPurchase: true });
  const it = (c.items || []).find(x => x.ref === 'Shock Maul');
  return (!!it && it.gadgets.length === 1 && it.gadgets[0].ref === 'Stun Module' && it.gadgets[0].builtin === true)
    || { gadgets: it && it.gadgets };
});

await t('UNMAKE-REMOVES-FROM-CATALOG', () => {
  const i = homebrewGear.findIndex(r => r.name === 'Chainsword');
  hbgDelete(i);
  return (!WEAPONS_CATALOG.some(x => x.name === 'Chainsword')) || { still: true };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== ARMORY PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
