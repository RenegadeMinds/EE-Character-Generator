// _probe_gmf_stage.mjs — GMF v0.7.0: the Stage, the Library & the Academy.
// Checks: three tabs render with healthy counts; Stage tag filter + search;
// Library search; Academy both views (class roster incl. all four tiers,
// the 21 roles); the glossary feeds the hover layer (REFMAP has darkvision/
// energy drain, and a bestiary statblock carries an rf span for a glossary
// term); each tab keeps its own reference point (independent DOM state).
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(new URL('../../EE-GM-Familiar/gmf.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  out.counts = { environs: STAGE.environs.length, library: STAGE.library.length, classes: STAGE.academy.classes.length, roles: STAGE.academy.roles.length };
  // Stage: tag filter + search
  show('stage');
  document.getElementById('s-tag').value = 'Extreme Effects'; renderS();
  out.stageFiltered = document.getElementById('s-list').children.length;
  document.getElementById('s-tag').value = ''; document.getElementById('s-q').value = 'avalanche'; renderS();
  out.stageSearch = document.getElementById('s-list').textContent.length > 0;
  // Library: search + content
  show('library');
  document.getElementById('l-q').value = 'energy drain'; renderL();
  out.libSearch = /negative level/i.test(document.getElementById('l-list').textContent);
  // Academy: both views
  show('academy');
  document.getElementById('ac-view').value = 'class'; document.getElementById('ac-q').value = ''; renderAc();
  const tiers = new Set(STAGE.academy.classes.map(c => c.tier));
  out.tiers = ['Hero', 'Basic', 'Advanced', 'Prestige'].every(t => tiers.has(t));
  document.getElementById('ac-view').value = 'role'; renderAc();
  out.roleView = document.getElementById('ac-list').children.length === 21;
  out.roleSample = /bounty hunters/i.test(document.getElementById('ac-list').textContent);
  // Hover layer: glossary terms joined REFMAP and fire inside statblocks
  out.refDark = REFMAP.has('darkvision') && REFMAP.has('energy drain and negative levels');
  show('bestiary');
  document.getElementById('b-q').value = 'aboleth'; renderB();
  const card = document.querySelector('.card'); card.setAttribute('open', '');
  out.statblockHover = [...card.querySelectorAll('.rf')].some(x => /darkvision/i.test(x.textContent));
  // Tab-state independence: library search box keeps its value after tab trips
  show('library');
  out.stateKept = document.getElementById('l-q').value === 'energy drain';
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.counts.environs >= 25 && r.counts.library >= 100 && r.counts.classes >= 50 && r.counts.roles === 21
  && r.stageFiltered >= 10 && r.stageSearch && r.libSearch && r.tiers && r.roleView && r.roleSample
  && r.refDark && r.statblockHover && r.stateKept && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
