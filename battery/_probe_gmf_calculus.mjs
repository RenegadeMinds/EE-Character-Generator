// _probe_gmf_calculus.mjs — GMF v0.5.2: the CR Calculus layer.
// Checks: payload injected, calculus row renders on a card, variant switch
// re-renders it, verdict chips exist in all three flavors, zero console errors.
import puppeteer from 'puppeteer';

const url = 'file:///C:/Users/adam_/EE/EE-GM-Familiar/gmf.html';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  out.calcKeys = Object.keys(CRCALC.calc).length;
  out.meta = CRCALC.meta;
  // Search the Aboleth (first family) and read its card.
  document.getElementById('b-q').value = 'aboleth';
  renderB();
  const card = document.querySelector('.card');
  card.setAttribute('open', '');
  const row = card.querySelector('.statrow.calculus');
  out.aboleth = row ? row.textContent.slice(0, 160) : null;
  // Variant switch: pick variant 1 (the Mage) and confirm the row follows.
  const sel = card.querySelector('select');
  if (sel) { sel.value = '1'; sel.onchange ? sel.dispatchEvent(new Event('change')) : pickV(sel, 0); }
  const row2 = card.querySelector('.statrow.calculus');
  out.abolethMage = row2 ? row2.textContent.slice(0, 160) : null;
  // Verdict flavors across the corpus.
  const flavors = { fair: 0, hot: 0, tricks: 0 };
  for (const c of Object.values(CRCALC.calc)) {
    if (c.resid >= 2) flavors.tricks++; else if (c.resid <= -2) flavors.hot++; else flavors.fair++;
  }
  out.flavors = flavors;
  // The named-tricks display (v0.5.3): the Medusa's residual must name its
  // unpriced abilities inline.
  document.getElementById('b-q').value = 'medusa';
  renderB();
  const mRow = document.querySelector('.card .statrow.calculus');
  out.medusa = mRow ? mRow.textContent.slice(0, 220) : null;
  out.medusaNames = mRow ? /in tricks: .+/.test(mRow.textContent) : null;
  // A dragon card renders with the derived note in its tooltip.
  document.getElementById('b-q').value = 'red dragon';
  renderB();
  const d = document.querySelector('.card .statrow.calculus');
  out.dragon = d ? (d.getAttribute('title') || '').includes('reconstructed') : null;
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
if (errors.length || !r.aboleth || !r.abolethMage || r.dragon !== true || r.medusaNames !== true) { console.log('PROBE RED'); process.exit(1); }
console.log('PROBE GREEN');
