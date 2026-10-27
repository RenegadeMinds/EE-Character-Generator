// _probe_gmf_lens.mjs — GMF v0.6.7: THE RULES LENS + the Tantalize Doctrine.
// Oracle: the Aboleth card under each dialect.
//   Classic: 'Base Attack / Grapple: +6/+22' (Parry stripped to a gold delta),
//     'Armor Class: 16 …, touch 9, flat-footed 15', Saves without Dodge +
//     a Dodge delta, the hardness rider as a tantalize line, lens note shown.
//   Modern: label 'Defense', MD chip speaks d20M.
//   Native: NO deltas, no lens note, original labels — untouched.
//   Persistence: gmf_lens round-trips localStorage.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(new URL('../../EE-GM-Familiar/gmf.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  localStorage.clear();
  document.getElementById('b-q').value = 'aboleth'; renderB();
  const card = () => document.querySelector('.card');
  card().setAttribute('open', '');
  const txt = () => card().querySelector('.statline').textContent;
  // native first
  setLens('ee'); card().setAttribute('open', '');
  out.nativeParry = /BA \/ Grapple \/ Parry/.test(txt()) && !/⚜/.test(txt()) && !/lens —/.test(txt());
  // classic
  setLens('classic'); card().setAttribute('open', '');
  const t = txt();
  out.classicBA = /Base Attack \/ Grapple:\s*\+6\/\+22/.test(t) && !/Parry:\s*\+6/.test(t);
  out.classicParryDelta = /PARRY defense: \+14/.test(t);
  out.classicAC = /Armor Class:\s*16/.test(t) && /touch 9/.test(t);
  out.classicDodgeDelta = /DODGE save: \+1/.test(t);
  out.classicHardness = /Hardness 5\/1d/.test(t) && /borrow it/.test(t);
  out.classicNote = /Classic SRD lens/.test(t);
  out.calcStays = /Calculus/.test(t); // premium layer survives every lens
  // modern
  setLens('modern'); card().setAttribute('open', '');
  out.modernDefense = /Defense:\s*16/.test(txt());
  // MD chip dialects: find a heavy hitter (Kraken) under each lens
  document.getElementById('b-q').value = 'kraken'; renderB(); card().setAttribute('open', '');
  out.modernMD = /MD check/.test(card().textContent);
  setLens('classic'); card().setAttribute('open', '');
  out.classicMD = /massive damage \(50\+\)|MD under E&E/.test(card().textContent);
  // persistence
  out.stored = localStorage.getItem('gmf_lens') === 'classic';
  // v0.6.8 (Adam's Chemical Toxyderm catch): clean drop-down labels + the
  // lens backs out ONLY the MD-attributable CR delta.
  setLens('ee');
  document.getElementById('b-q').value = 'toxyderm'; renderB();
  const ctf = BESTIARY.find(f => f.parent === 'CHEMICAL TOXYDERM');
  const ctv = ctf.variants[0];
  out.cleanLabel = !/errata|prints/i.test(document.getElementById('b-list').innerHTML.match(/<option[^>]*>[^<]*Toxyderm[^<]*<\/option>/i)?.[0] || '');
  out.eeCR = lensCR(ctv);
  setLens('modern');
  out.modernCR = lensCR(ctv);
  const kr = BESTIARY.find(f => f.parent === 'KRAKEN').variants[0];
  out.krakenModern = lensCR(kr);
  // the tantalize CR line renders on a lensed MD-errata card
  document.getElementById('b-q').value = 'chemical toxyderm'; renderB();
  const cc = document.querySelector('.card'); cc.setAttribute('open', '');
  out.crDelta = /E&E rates this creature CR 17/.test(cc.textContent);
  setLens('ee');
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.nativeParry && r.classicBA && r.classicParryDelta && r.classicAC && r.classicDodgeDelta
  && r.classicHardness && r.classicNote && r.calcStays && r.modernDefense && r.modernMD && r.classicMD
  && r.stored && r.cleanLabel && r.eeCR === 17 && r.modernCR === 15 && r.krakenModern === 13 && r.crDelta && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
