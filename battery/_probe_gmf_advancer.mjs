// _probe_gmf_advancer.mjs — GMF v0.6.2: the Advancer.
// Hand-computed oracle: ABOLETH (Aberration d8, BAB 3/4, good Will;
// base 8 HD, 76 hp, Con 20, BA +6/Gr +22, F+7/R+3/W+11, Huge;
// Advancement 9-16 HD (Huge); 17-24 HD (Gargantuan)).
//   8 -> 12 HD (no size step): hp 76 + 4*4.5(floor 18) + 4 HD * Con mod 5
//     = 76+18+20 = 114; BAB +9 (floor .75*12) => delta +3 -> BA +9;
//     Will good: +6 -> +12+... wait: dWill = 6-4 = +2 -> W+13; Fort poor:
//     4-2=+2 -> F+9; Ref poor +2 -> R+5; bump at 12 HD (floor12/4-floor8/4
//     = 1) -> Str 27.
//   8 -> 17 HD: size -> Gargantuan (one step: +8 Str, +4 Con, NA +4,
//     size mod -2->-4).
// Also: the quick overlay adds Warrior levels; the seed exporter returns a
// well-formed object; Field-it pushes an advanced row into the Forge tray.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(new URL('../../EE-GM-Familiar/gmf.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  const d12 = advanceCreature('ABOLETH', 0, 12, '', 0);
  out.hp12 = d12.hp; out.bab12 = d12.bab; out.will12 = d12.will; out.fort12 = d12.fort; out.str12 = d12.str; out.size12 = d12.size;
  const d17 = advanceCreature('ABOLETH', 0, 17, '', 0);
  out.size17 = d17.size; out.str17 = d17.str; out.con17 = d17.con;
  out.model17 = d17.modelCR != null;
  const dW = advanceCreature('ABOLETH', 0, 12, 'Strong Hero', 4);
  out.warriorBab = dW.bab - d12.bab; // +4 (full BAB overlay)
  out.warriorHpUp = dW.hp > d12.hp;
  // UI: open the aboleth card, open the Advance panel
  document.getElementById('b-q').value = 'aboleth'; renderB();
  const card = document.querySelector('.card'); card.setAttribute('open', '');
  const btn = card.querySelector('button.fbtn'); btn.click();
  out.panel = !!document.querySelector('[id^="advhd-"]');
  // field an advanced foe into the Forge
  TRAY = []; saveForge();
  // v0.6.3 (the Terror of the Greymist Moors): field the FULL derived body,
  // save the encounter, wipe, reload — the stats must survive the round trip.
  forgeAddAdvanced({ fam: 'ABOLETH', d: d17 });
  out.trayed = TRAY.length === 1 && TRAY[0].vi === -1 && !!TRAY[0].d && TRAY[0].d.hp === d17.hp;
  document.getElementById('f-encname').value = 'Terror of the Greymist Moors'; forgeSave();
  TRAY = []; saveForge(); renderF();
  forgeLoad(0);
  out.terrorBack = TRAY.length === 1 && !!TRAY[0].d && TRAY[0].d.size === 'Gargantuan' && TRAY[0].d.hp === d17.hp;
  renderF(); const sb = document.querySelector('[id^="trayst-"]');
  trayStats(0);
  out.statsToggle = !!document.getElementById('trayst-0') && document.getElementById('trayst-0').innerHTML.includes('Gargantuan');
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.hp12 === 114 && r.bab12 === 9 && r.will12 === 13 && r.fort12 === 9 && r.str12 === 27 && r.size12 === 'Huge'
  && r.size17 === 'Gargantuan' && r.str17 > r.str12 && r.con17 === 24 + 0 && r.model17
  && r.warriorBab === 4 && r.warriorHpUp && r.panel && r.trayed && r.terrorBack && r.statsToggle && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
