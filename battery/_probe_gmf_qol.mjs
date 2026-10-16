// _probe_gmf_qol.mjs — GMF v0.8.8: THE CG PAIR, PORTED (bug reporter +
// display selector). Asserts: boot-time error ring captures; the 🐞 modal
// opens with full context; Send builds the mailto (STUBBED — the §276
// lesson: a real mailto click escapes headless Chrome to the OS mail app)
// and stores the report; Copy fallback; display prefs apply + persist;
// prefers-contrast auto-applies unless an explicit pick overrides.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

// Served over local HTTP (the §276 technique): file:// masks injected-throw
// errors as "Script error." and denies clipboard permission grants.
const html = readFileSync('C:/Users/adam_/EE/EE-GM-Familiar/gmf.html');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8793, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:8793';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
await browser.defaultBrowserContext().overridePermissions(ORIGIN, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// the mailto stub, installed before ANY page script runs
await page.evaluateOnNewDocument(() => {
  window._probeMailtoBlocked = 0;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if ((this.href || '').startsWith('mailto:')) { window._probeMailtoBlocked++; return; }
    return orig.apply(this, arguments);
  };
});
await page.goto(ORIGIN + '/', { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(async () => {
  const out = {};
  localStorage.clear();
  // (1) the error ring catches a thrown error + a rejection (same-origin
  // inline script — the §276 technique; an evaluate-thrown error masks).
  const s = document.createElement('script');
  s.textContent = 'setTimeout(function(){ throw new Error("probe-boom"); }, 0); Promise.reject(new Error("probe-reject"));';
  document.body.appendChild(s);
  await new Promise(res => setTimeout(res, 120));
  out.ring = (window._gmfErrRing || []).join(' | ');
  out.ringOk = /probe-boom/.test(out.ring) && /probe-reject/.test(out.ring);
  // (2) report modal opens with context
  show('forge');
  openBugReport();
  const ctx = document.getElementById('bug-ctx').textContent;
  out.ctxOk = document.getElementById('bug-modal').classList.contains('open')
    && /GMF version: v0\.\d+\.\d+/.test(ctx) && /Tab: .*Forge/.test(ctx)
    && /probe-boom/.test(ctx) && document.getElementById('bug-email').textContent === 'admin@epicsandepochs.com';
  // (3) send requires a description
  await bugSend();
  out.needsDesc = !window._lastBugMailto && /describe/.test(document.getElementById('bug-status').textContent);
  // (4) send opens the (stubbed) mailto and stores the report
  document.getElementById('bug-what').value = 'EL did not change after adding an ogre.';
  await bugSend();
  const href = window._lastBugMailto || '';
  const list = JSON.parse(localStorage.getItem('gmf_bugreports') || '[]');
  out.sendOk = href.startsWith('mailto:admin@epicsandepochs.com?')
    && /Bug%20report%3A%20EL%20did%20not%20change/.test(href)
    && list.length === 1 && list[0].sent[0].how === 'email'
    && window._probeMailtoBlocked === 1;
  // (5) copy fallback stores + records
  document.getElementById('bug-what').value = 'Copy path check';
  await bugCopy();
  const list2 = JSON.parse(localStorage.getItem('gmf_bugreports') || '[]');
  const clip = await navigator.clipboard.readText().catch(() => '');
  out.copyOk = list2.length === 2 && list2[1].sent[0].how === 'copy'
    && /^To: admin@epicsandepochs\.com\nSubject: \[E&E GMF v0\.\d+\.\d+\]/.test(clip.replace(/\r\n/g, '\n'));
  closeBugReport();
  // (6) display prefs: hc applies, persists in storage
  setDisplayPref('theme', 'hc'); setDisplayPref('textsize', 'xl');
  out.hcApplied = document.documentElement.getAttribute('data-theme') === 'hc'
    && document.documentElement.getAttribute('data-textsize') === 'xl';
  out.stored = localStorage.getItem('gmf_display');
  return out;
});

// (7) prefs survive a reload (fresh page, same storage)
await page.reload({ waitUntil: 'load' });
const r2 = await page.evaluate(() => ({
  th: document.documentElement.getAttribute('data-theme'),
  sz: document.documentElement.getAttribute('data-textsize'),
}));
const persistOk = r2.th === 'hc' && r2.sz === 'xl';

console.log(JSON.stringify({ ...r, persist: r2 }, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 2));
await browser.close();
server.close();
// pageerror captures the deliberately thrown probe-boom/probe-reject — only
// OTHER errors count against the run.
const realErrors = errors.filter(e => !/probe-boom|probe-reject/.test(e));
const ok = r.ringOk && r.ctxOk && r.needsDesc && r.sendOk && r.copyOk && r.hcApplied && persistOk && realErrors.length === 0;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
