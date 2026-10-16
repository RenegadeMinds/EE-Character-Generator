// _probe_playerqol.mjs — v9.16.0 targeted probe (§276): the players' four.
// (1) unsaved-changes guard — Skills + Create, Stay/Discard/Save-and-continue
//     via REAL clicks/keystrokes (the guard only counts trusted input), plus
//     the beforeunload veto; (2) 🐞 Report — context capture incl. the error
//     ring, mailto to the confirmed address, long-report clipboard handoff,
//     the local My-reports log (view/resend/storage-denied survival);
// (3) nav reflow at 320 CSS px (WCAG 2.2 SC 1.4.10 — 400% zoom) with no
//     horizontal scroll; (4) contrast — rendered AA audit of the default
//     theme, AAA audit of High Contrast, prefers-contrast auto-apply, and
//     persisted theme/text-size prefs. CG_FILE=path probes another build.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { auditPage, makeHero } from './_audit_contrast.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8792, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:8792';

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
await browser.defaultBrowserContext().overridePermissions(ORIGIN, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon|probe-boom|probe-reject|mailto/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => { if (!/probe-boom|probe-reject/.test(String(e))) consoleErrors.push('pageerror: ' + String(e).slice(0, 200)); });
// Headless Chrome can't emulate prefers-contrast; stub matchMedia for that one
// query (toggled by window.name, which survives reloads) so the <head> logic
// that reads it is exercised for real.
await page.evaluateOnNewDocument(() => {
  // NEVER let a mailto: reach the OS — even headless Chrome hands it to the
  // desktop mail client (the first runs opened real Outlook drafts on Adam's
  // machine). The app still records the href in window._lastBugMailto.
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (/^mailto:/i.test(this.href)) { window._probeMailtoBlocked = (window._probeMailtoBlocked || 0) + 1; return; } return origClick.call(this); };
  const orig = window.matchMedia.bind(window);
  window.matchMedia = q => (/prefers-contrast:\s*more/.test(q) && window.name === 'probe-more')
    ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : orig(q);
});
const boot = async () => {
  await page.goto(ORIGIN + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('typeof chars !== "undefined" && typeof saveCharacter === "function" && typeof guardedNav === "function"', { timeout: 60000 });
};
await boot();

const t = async (id, fn, arg) => { try { const r = await page.evaluate(fn, arg); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };
const tn = async (id, fn) => { try { const r = await fn(); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };
const tab = key => `.tab-btn[onclick="showPage('${key}')"]`;
const active = () => page.evaluate(() => document.querySelector('.page.active')?.id);
const modalOpen = id => page.evaluate(id => document.getElementById(id).classList.contains('open'), id);
const typeRank = async (val) => {
  const sel = '.sk-rank-inp';
  await page.click(sel);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(String(val));
  return page.$eval(sel, el => el.id);
};

await t('VERSION-STAMPED', () => (CG_VERSION === 'v9.17.0' && /v9\.17\.0/.test(document.querySelector('.site-subtitle').textContent)) || { CG_VERSION });

const heroId = await makeHero(page, 'QoL Probe');
await tn('HERO-CREATED', async () => !!heroId || { heroId });

// ---------- (1) the guard ----------
await page.evaluate(() => showPage('skills'));
let rankId;
await tn('SKILLS-CLEAN-NAV-PASSES', async () => {
  await page.click(tab('feats'));
  const a = await active(); const o = await modalOpen('unsaved-modal');
  await page.click(tab('skills'));
  return (a === 'page-feats' && !o && (await active()) === 'page-skills') || { a, o };
});
await tn('SKILLS-DIRTY-PROMPTS', async () => {
  rankId = await typeRank(2);
  const dirty = await page.evaluate(() => skillsDirty());
  await page.click(tab('feats'));
  const o = await modalOpen('unsaved-modal');
  const a = await active();
  const body = await page.$eval('#unsaved-modal-body', el => el.textContent);
  return (dirty && o && a === 'page-skills' && /Skills/.test(body)) || { dirty, o, a, body };
});
await tn('STAY-KEEPS-WORK', async () => {
  await page.click('#unsaved-stay');
  const o = await modalOpen('unsaved-modal');
  const v = await page.$eval('#' + rankId, el => el.value);
  return (!o && (await active()) === 'page-skills' && v === '2') || { o, v };
});
await tn('ESCAPE-MEANS-STAY', async () => {
  await page.click(tab('gear'));
  const o1 = await modalOpen('unsaved-modal');
  await page.keyboard.press('Escape');
  const o2 = await modalOpen('unsaved-modal');
  return (o1 && !o2 && (await active()) === 'page-skills') || { o1, o2 };
});
await tn('BEFOREUNLOAD-VETOES-WHEN-DIRTY', async () => page.evaluate(() => {
  const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev);
  return ev.defaultPrevented || { dp: ev.defaultPrevented };
}));
await tn('DISCARD-RESTORES-SAVED', async () => {
  await page.click(tab('feats'));
  await page.click('#unsaved-discard');
  return page.evaluate((rankId) => {
    const c = chars.find(x => x.id === curId);
    const nm = SKILLS.find(sk => 'skr-' + sk.n.replace(/[^a-z0-9]/gi, '_') === rankId).n;
    const inp = document.getElementById(rankId);
    const ok = document.querySelector('.page.active').id === 'page-feats' && !skillsDirty() && (c.skills[nm] || 0) === 0 && inp.value === '0' && getLiveSkillRanks(c, nm) === 0;
    return ok || { active: document.querySelector('.page.active').id, mem: c.skills[nm], dom: inp.value };
  }, rankId);
});
await tn('BEFOREUNLOAD-QUIET-WHEN-CLEAN', async () => page.evaluate(() => {
  const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev);
  return !ev.defaultPrevented || { dp: ev.defaultPrevented };
}));
await tn('SAVE-AND-CONTINUE-PERSISTS', async () => {
  await page.click(tab('skills'));
  await typeRank(3);
  await page.click(tab('tracker'));
  await page.click('#unsaved-save');
  return page.evaluate((rankId) => {
    const nm = SKILLS.find(sk => 'skr-' + sk.n.replace(/[^a-z0-9]/gi, '_') === rankId).n;
    const stored = JSON.parse(localStorage.getItem('dxd20v2_chars')).find(x => x.id === curId);
    const ok = document.querySelector('.page.active').id === 'page-tracker' && stored.skills[nm] === 3 && !skillsDirty();
    return ok || { active: document.querySelector('.page.active').id, stored: stored.skills[nm] };
  }, rankId);
});
await tn('CREATE-DIRTY-PROMPTS-AND-DISCARDS', async () => {
  await page.click(tab('create'));
  await page.evaluate(() => enterSandboxMode());
  const clean = await page.evaluate(() => !_createDirty);
  await page.click('#c-name'); await page.keyboard.type('Half-built Hero');
  await page.click(tab('roster'));
  const o = await modalOpen('unsaved-modal');
  const a1 = await active();
  await page.click('#unsaved-discard');
  const a2 = await active();
  const after = await page.evaluate(() => ({ dirty: _createDirty, name: document.getElementById('c-name').value, saved: chars.some(c => c.name === 'Half-built Hero') }));
  return (clean && o && a1 === 'page-create' && a2 === 'page-roster' && !after.dirty && !after.name && !after.saved) || { clean, o, a1, a2, after };
});
await tn('CREATE-SAVE-AND-CONTINUE', async () => {
  await page.click(tab('create'));
  await page.evaluate(() => { enterSandboxMode(); window.confirmModal = async () => true; _firstSaveConfirmed = true; });
  await page.click('#c-name'); await page.keyboard.type('Guarded Hero');
  await page.click(tab('roster'));
  await page.click('#unsaved-save');
  await page.waitForFunction(() => !document.getElementById('unsaved-modal').classList.contains('open'));
  await new Promise(r => setTimeout(r, 300));
  const s = await page.evaluate(() => ({ saved: chars.some(c => c.name === 'Guarded Hero'), dirty: _createDirty, active: document.querySelector('.page.active').id }));
  return (s.saved && !s.dirty && s.active === 'page-roster') || s;
});
await page.evaluate(() => selChar(chars.find(c => c.name === 'QoL Probe').id));

// ---------- (2) bug reports ----------
// Same-origin inline script (an evaluate()-thrown error reads "Script error.").
await page.evaluate(() => { const s = document.createElement('script'); s.textContent = "setTimeout(function(){ throw new Error('probe-boom'); }, 0); Promise.reject(new Error('probe-reject'));"; document.body.appendChild(s); });
await new Promise(r => setTimeout(r, 200));
await tn('ERROR-RING-CAPTURES', async () => page.evaluate(() => {
  const ring = window._cgErrRing.join('\n');
  return (/probe-boom/.test(ring) && /unhandled rejection.*probe-reject/.test(ring)) || { ring };
}));
await tn('REPORT-BUTTON-OPENS-WITH-CONTEXT', async () => {
  await page.click('#nav-report-btn');
  const s = await page.evaluate(() => ({ open: document.getElementById('bug-modal').classList.contains('open'), ctx: document.getElementById('bug-ctx').textContent, to: document.getElementById('bug-email').textContent }));
  const ok = s.open && /CG version: v9\.\d+\.\d+/.test(s.ctx) && /Page: /.test(s.ctx) && /Hero: QoL Probe/.test(s.ctx) && /Browser: .*Mozilla/.test(s.ctx) && /probe-boom/.test(s.ctx) && /When: 20\d\d-/.test(s.ctx) && s.to === 'admin@epicsandepochs.com';
  return ok || s;
});
await tn('SEND-REQUIRES-DESCRIPTION', async () => {
  await page.click('#bug-send');
  return page.evaluate(() => (!window._lastBugMailto && /describe/.test(document.getElementById('bug-status').textContent)) || { st: document.getElementById('bug-status').textContent });
});
await tn('SEND-OPENS-MAILTO-AND-LOGS', async () => {
  await page.click('#bug-what'); await page.keyboard.type('Ranks vanished after switching tabs.');
  await page.click('#bug-send');
  return page.evaluate(() => {
    const href = window._lastBugMailto || '';
    const list = JSON.parse(localStorage.getItem('dxd20v2_bugreports') || '[]');
    const body = decodeURIComponent((href.split('&body=')[1] || ''));
    const subj = decodeURIComponent((href.split('subject=')[1] || '').split('&')[0]);
    const ok = href.startsWith('mailto:admin@epicsandepochs.com?') && /^\[E&E CG v9\.\d+\.\d+\] Bug report: Ranks vanished/.test(subj) && /WHAT HAPPENED\nRanks vanished/.test(body) && /CG version: v9\.\d+\.\d+/.test(body)
      && list.length === 1 && list[0].sent[0].how === 'email' && !list[0].charJson && document.querySelectorAll('#bug-list button').length === 4;
    return ok || { href: href.slice(0, 160), n: list.length };
  });
});
await tn('LONG-REPORT-CLIPS-TO-CLIPBOARD', async () => {
  await page.click('#bug-what'); await page.keyboard.type('Sheet shows wrong Fort save.');
  await page.click('#bug-attach');
  await page.evaluate(() => { window._lastBugMailto = ''; });
  await page.click('#bug-send');
  await page.waitForFunction(() => !!window._lastBugMailto, { timeout: 5000 });
  const r = await page.evaluate(async () => {
    const href = window._lastBugMailto;
    const body = decodeURIComponent(href.split('&body=')[1]);
    const clip = (await navigator.clipboard.readText()).replace(/\r\n/g, '\n');
    const list = JSON.parse(localStorage.getItem('dxd20v2_bugreports'));
    return { encLen: href.length, clipped: /copied to my clipboard/.test(body), clipHasJson: /CHARACTER JSON\n\{/.test(clip) && /QoL Probe/.test(clip), stored: list.length === 2 && /QoL Probe/.test(list[1].charJson) };
  });
  return (r.encLen < 2600 && r.clipped && r.clipHasJson && r.stored) || r;
});
await tn('COPY-FALLBACK', async () => {
  await page.click('#bug-what'); await page.keyboard.type('Copy path check');
  await page.click('#bug-copy');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('dxd20v2_bugreports')).length === 3, { timeout: 5000 });
  return page.evaluate(async () => {
    const clip = (await navigator.clipboard.readText()).replace(/\r\n/g, '\n');
    const list = JSON.parse(localStorage.getItem('dxd20v2_bugreports'));
    return (/^To: admin@epicsandepochs\.com\nSubject: \[E&E CG v9\.\d+\.\d+\]/.test(clip) && /Copy path check/.test(clip) && list.length === 3 && list[2].sent[0].how === 'copy') || { clip: clip.slice(0, 120), n: list.length };
  });
});
await tn('MY-REPORTS-VIEW-AND-RESEND', async () => {
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('dxd20v2_bugreports'))[0].id);
  await page.evaluate(() => { window._lastBugMailto = ''; });
  await page.click(`button[onclick="bugView('${id}')"]`);
  await page.click(`button[onclick="bugResend('${id}')"]`);
  await page.waitForFunction(() => !!window._lastBugMailto, { timeout: 5000 });
  return page.evaluate((id) => {
    const v = document.getElementById('bug-view');
    const r = JSON.parse(localStorage.getItem('dxd20v2_bugreports')).find(x => x.id === id);
    return (v.style.display === 'block' && /Ranks vanished/.test(v.textContent) && /Ranks%20vanished/.test(window._lastBugMailto) && r.sent.length === 2 && window._probeMailtoBlocked === 3) || { view: v.style.display, sent: r.sent.length, blocked: window._probeMailtoBlocked };
  }, id);
});
await tn('STORAGE-DENIED-SURVIVES', async () => page.evaluate(async () => {
  const orig = Storage.prototype.setItem, origGet = Storage.prototype.getItem;
  Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  Storage.prototype.getItem = function () { throw new Error('SecurityError'); };
  let threw = null;
  try { document.getElementById('bug-what').value = 'denied'; await bugCopy(); renderBugList(); setDisplayPref('textsize', 'md'); } catch (e) { threw = String(e); }
  Storage.prototype.setItem = orig; Storage.prototype.getItem = origGet;
  return threw === null || { threw };
}));
await page.evaluate(() => closeBugReport());

// ---------- (3) reflow at 400% zoom ----------
for (const w of [320, 400]) {
  await page.setViewport({ width: w, height: 640 });
  await tn(`NAV-REFLOW-${w}PX`, async () => page.evaluate(() => {
    const W = window.innerWidth;
    const btns = [...document.querySelectorAll('nav.tabs .tab-btn, nav.tabs .nav-tool')].filter(b => getComputedStyle(b).display !== 'none');
    const off = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left < -0.5 || r.right > W + 0.5; }).map(b => b.textContent.trim());
    const rows = new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))).size;
    const nav = document.querySelector('nav.tabs');
    const ok = !off.length && document.documentElement.scrollWidth <= W && nav.scrollWidth <= nav.clientWidth + 1 && rows > 1 && getComputedStyle(nav).position === 'static';
    return ok || { W, off, rows, sw: document.documentElement.scrollWidth, navSW: nav.scrollWidth, navCW: nav.clientWidth, pos: getComputedStyle(nav).position };
  }));
}
await tn('NAV-NARROW-CLICK-REACHES-LAST-TAB', async () => {
  await page.click(tab('tracker'));
  return (await active()) === 'page-tracker';
});
await page.setViewport({ width: 1280, height: 900 });
await tn('NAV-DESKTOP-STAYS-STICKY', async () => page.evaluate(() => getComputedStyle(document.querySelector('nav.tabs')).position === 'sticky'));

// ---------- (4) contrast ----------
const AUDIT_PAGES = ['roster', 'create', 'sheet', 'skills', 'feats', 'gear', 'tracker'];
const auditAll = async (aaa) => {
  let checked = 0, failed = 0; const worst = [];
  for (const p of AUDIT_PAGES) {
    await page.evaluate(p => { showPage(p); if (p === 'create') enterSandboxMode(); }, p);
    const r = await auditPage(page, { aaa });
    checked += r.checked; failed += r.failed;
    for (const [k, v] of Object.entries(r.fails)) worst.push(`${p}: ${v.cr}:1 ${k} ${v.sample[0]}`);
  }
  return { checked, failed, worst };
};
await page.evaluate(() => { _createDirty = false; showPage('roster'); });
await tn('ROSTER-SUBTITLE-AA', async () => page.evaluate(() => {
  const el = document.querySelector('.char-meta'); const r = getComputedStyle(el).color;
  return r === 'rgb(187, 162, 115)' || { color: r };
}));
await tn('DEFAULT-THEME-AA-RENDERED', async () => {
  const r = await auditAll(false);
  return (r.checked > 500 && r.failed === 0) || { note: `${r.failed}/${r.checked} below AA: ${r.worst.slice(0, 4).join(' | ')}` };
});
await tn('DISPLAY-MENU-HC-PERSISTS', async () => {
  await page.click('#nav-display-btn');
  await page.click('input[name="disp-theme"][value="hc"]');
  await page.click('input[name="disp-size"][value="lg"]');
  const s = await page.evaluate(() => ({ th: document.documentElement.getAttribute('data-theme'), sz: document.documentElement.getAttribute('data-textsize'), p: localStorage.getItem('dxd20v2_display') }));
  await page.evaluate(() => closeDisplaySettings());
  return (s.th === 'hc' && s.sz === 'lg' && /"theme":"hc"/.test(s.p)) || s;
});
await tn('HC-THEME-AAA-RENDERED', async () => {
  await page.evaluate(() => setDisplayPref('textsize', 'md'));
  const r = await auditAll(true);
  return (r.checked > 500 && r.failed === 0) || { note: `${r.failed}/${r.checked} below AAA: ${r.worst.slice(0, 4).join(' | ')}` };
});
await tn('PREFS-SURVIVE-RELOAD', async () => {
  await page.evaluate(() => setDisplayPref('textsize', 'xl'));
  await boot();
  const s = await page.evaluate(() => ({ th: document.documentElement.getAttribute('data-theme'), sz: document.documentElement.getAttribute('data-textsize') }));
  return (s.th === 'hc' && s.sz === 'xl') || s;
});
await tn('PREFERS-CONTRAST-AUTO-APPLIES', async () => {
  await page.evaluate(() => { localStorage.removeItem('dxd20v2_display'); window.name = 'probe-more'; });
  await boot();
  const auto = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => setDisplayPref('theme', 'standard'));
  const overridden = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => { window.name = ''; setDisplayPref('theme', 'auto'); });
  const off = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  return (auto === 'hc' && overridden === null && off === null) || { auto, overridden, off };
});

await tn('V9161-TRIO (signed Rep · unarmed carries stance · no-melee hint)', async () => {
  // Bug report #1 (Adam/Xander, 2026-10-15): (1) Reputation prints signed;
  // (2) the Unarmed strike row moves when a stance is declared (it already
  // did — this pins it); (3) declaring with no melee weapon equipped raises
  // the where-to-look toast instead of silent nothing-moves confusion.
  return page.evaluate(async () => {
    let c = chars.find(x => x.id === curId) || chars[0];
    if (!c) return { noChar: true };
    curId = c.id;
    c.feats = c.feats || [];
    if (!c.feats.some(f => (f.name || f.n) === 'Combat Expertise')) c.feats.push({ name: 'Combat Expertise' });
    c.items = (c.items || []).filter(it => it.catalogue !== 'weapon'); // no melee equipped
    c.combatDecl = { pa: 0, ce: 0, ro: false, bd: 0 };
    save(); renderSheet();
    const repCell = [...document.querySelectorAll('#sh-stats *')].map(e => e.textContent).find(t => /Reputation/.test(t) && t.length < 80) || '';
    const repSigned = /\+\d/.test(repCell);
    const uaBefore = computeEquippedWeaponSummaries(c).find(r => r.name === 'Unarmed strike').attackBonus;
    await baDeclAdjust(-1); // only CE owned → routes straight to Combat Expertise 1
    const d = combatDecl(c);
    const uaAfter = computeEquippedWeaponSummaries(c).find(r => r.name === 'Unarmed strike').attackBonus;
    const hint = document.getElementById('toast').textContent;
    const ok = repSigned && d.ce === 1 && (uaBefore - uaAfter) === 1 && /MELEE attack rolls only/.test(hint) && /Unarmed strike/.test(hint);
    // leave the stance clean for any later tests
    c.combatDecl = { pa: 0, ce: 0, ro: false, bd: 0 }; save(); renderSheet();
    return ok || { repCell: repCell.slice(0, 40), repSigned, ce: d.ce, uaBefore, uaAfter, hint: hint.slice(0, 80) };
  });
});

mark('ZERO-CONSOLE-ERRORS', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
