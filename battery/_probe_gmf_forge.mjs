// _probe_gmf_forge.mjs — GMF v0.6.0: the Encounter Forge.
// Checks: tab renders; manual roster → party CR math (avg, +1 beyond 4,
// attrgen, fine-tune); EL reading for Adam's ogre packs (gaveled formula);
// band vs party; threat shares; chaff exclusion; solo-boss warning;
// encounter save/load round-trip; zero console errors.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file:///C:/Users/adam_/EE/EE-GM-Familiar/gmf.html', { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  localStorage.clear(); ROSTER = []; TRAY = [];
  show('forge');
  out.tabVisible = document.getElementById('pg-forge').style.display !== 'none';
  // Party: 4 PCs at level 7 → party CR 7; add a 5th → 8; attrgen → 9; tune −1 → 8.
  for (let i = 0; i < 4; i++) { document.getElementById('f-pcname').value = 'PC' + i; document.getElementById('f-pclvl').value = 7; forgeAddPC(); }
  out.cr4 = partyCR();
  document.getElementById('f-pcname').value = 'PC5'; document.getElementById('f-pclvl').value = 7; forgeAddPC();
  out.cr5 = partyCR();
  document.getElementById('f-attrgen').checked = true; out.cr5attr = partyCR();
  document.getElementById('f-tune').value = '-1'; out.cr5tuned = partyCR();
  // reset to the clean 4-PC level-7 party
  document.getElementById('f-attrgen').checked = false; document.getElementById('f-tune').value = '0';
  forgeDropPC(4); renderF();
  // Ogre + 5 Gnolls → EL 7 (6.6 rounds to 7), Standard for party CR 7.
  const fOgre = BESTIARY.findIndex(f => f.parent === 'OGRE');
  const fGnoll = BESTIARY.findIndex(f => f.parent === 'GNOLL');
  const fGoblin = BESTIARY.findIndex(f => f.parent === 'GOBLIN');
  forgeAdd(fOgre, 0); for (let i = 0; i < 5; i++) forgeAdd(fGnoll, 0);
  out.meter1 = document.getElementById('f-meter').textContent.slice(0, 180);
  out.el7 = /Encounter Level\s*7/.test(out.meter1) && /Standard/.test(out.meter1);
  out.shares = /Ogre\s*\d+%/.test(out.meter1) && /Gnoll\s*\d+%/.test(out.meter1);
  // Save/load round-trip.
  document.getElementById('f-encname').value = 'Ogre ambush'; forgeSave();
  TRAY = []; saveForge(); renderF();
  forgeLoad(0);
  out.reload = TRAY.length === 2 && TRAY.reduce((t, x) => t + x.n, 0) === 6;
  // Chaff: 20 goblins vs a level-12 party → goblins excluded, meter empty-ish.
  TRAY = []; saveForge(); ROSTER = Array.from({ length: 4 }, (_, i) => ({ name: 'L12-' + i, ecl: 12 })); saveForge(); renderF();
  forgeAdd(fGoblin, 0); TRAY[0].n = 20; saveForge(); renderF();
  out.chaff = document.getElementById('f-tray').textContent.includes('chaff');
  // Solo boss: 1 ogre vs 4× level-5 party (ogre CR 3... need EL≈partyCR: use party level 3).
  TRAY = []; ROSTER = Array.from({ length: 4 }, (_, i) => ({ name: 'L3-' + i, ecl: 3 })); saveForge(); renderF();
  forgeAdd(fOgre, 0); renderF();
  out.solo = document.getElementById('f-meter').textContent.includes('out-acted');
  // v0.7.1 THE TS TOGGLE: arming + armoring the ogre lifts its effective CR
  // by 2 (3 -> 5) and the EL with it.
  const elBefore = +document.getElementById('f-meter').dataset.el;
  forgeTS(0, 'tsA'); forgeTS(0, 'tsD');
  out.tsEL = +document.getElementById('f-meter').dataset.el === elBefore + 2;
  out.tsChip = /↑2/.test(document.getElementById('f-tray').innerHTML);
  forgeTS(0, 'tsA'); forgeTS(0, 'tsD');
  // v0.7.1 THE TREASURE ROLLER: deterministic rng — EL-10 haul has the three
  // columns and the budget line (6,500 gp at EL 10).
  const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  let si = 0; const rnd = () => seq[si++ % seq.length];
  const lines = rollTreasure(10, 1, rnd);
  out.lootLines = lines.length === 2 && /coins:/.test(lines[0]) && /goods:/.test(lines[0]) && /items:/.test(lines[0]);
  out.lootBudget = /6,500 gp/.test(lines[1]);
  const dbl = rollTreasure(10, 2, rnd);
  out.lootDouble = dbl.length === 3 && /Roll 1:/.test(dbl[0]) && /Roll 2:/.test(dbl[1]);
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.tabVisible && r.cr4 === 7 && r.cr5 === 8 && r.cr5attr === 9 && r.cr5tuned === 8 && r.el7 && r.shares && r.reload && r.chaff && r.solo && r.tsEL && r.tsChip && r.lootLines && r.lootBudget && r.lootDouble && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
