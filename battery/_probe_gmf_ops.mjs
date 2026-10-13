// _probe_gmf_ops.mjs — GMF v0.8.0: TABLE OPS, the Chronicler-ready tracker.
// Runs a miniature session end to end and asserts the EVENT LOG caught every
// tap: seed an ogre encounter from the Forge (hp from the statblock incl.
// the hardness rider), add the party, initiative + sort, a scene, damage to
// the death event, a heal, a condition toggle, a quote, round advance —
// then round-trips autosave and checks the export document's shape.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file:///C:/Users/adam_/EE/EE-GM-Familiar/gmf.html', { waitUntil: 'load', timeout: 60000 });

const r = await page.evaluate(() => {
  const out = {};
  localStorage.clear(); OPS = null; ROSTER = [{ name: 'Valeria', ecl: 5 }, { name: 'Dax', ecl: 5 }]; TRAY = [];
  // a saved encounter to field
  const fOgre = BESTIARY.findIndex(f => f.parent === 'OGRE');
  forgeAdd(fOgre, 0); TRAY[0].n = 2; saveForge();
  document.getElementById('f-encname').value = 'Bridge Toll'; forgeSave();
  show('ops'); opsLoad(); renderOps();
  // session meta
  document.getElementById('o-campaign').value = 'The Lonely Corridor';
  document.getElementById('o-title').value = 'Session 1 — Decima';
  document.getElementById('o-registers').value = 'gothic, frontier';
  opsMeta();
  // field the encounter + the party
  document.getElementById('o-enc').value = '0'; opsSeed(); opsParty(); renderOps();
  out.railCount = OPS.combat.length; // 2 ogres + 2 PCs
  const ogreHP = OPS.combat[0].hp;
  out.ogreHP = ogreHP; // statblock hp incl. hardness rider
  // initiative, sort, scene
  opsInit(0, '12'); opsInit(1, '7'); opsInit(2, '18'); opsInit(3, '15'); opsSort();
  out.topAfterSort = OPS.combat[0].init === 18;
  document.getElementById('o-quick').value = 'The toll bridge at dusk'; opsScene();
  // damage ogre (now sorted — find it) to death
  const oi = OPS.combat.findIndex(c => c.src === 'foe');
  document.getElementById('o-amt-' + oi).value = String(ogreHP); opsHP(oi, -1);
  out.ogreDead = OPS.combat[oi].hp <= 0;
  // heal a PC (hp starts null -> 0 then heals)
  const pi = OPS.combat.findIndex(c => c.src === 'pc');
  document.getElementById('o-amt-' + pi).value = '6'; opsHP(pi, 1);
  // condition toggle via quick field
  document.getElementById('o-quick').value = 'prone'; opsCond(oi);
  out.condOn = OPS.combat[oi].cond.includes('prone');
  // quote + round
  document.getElementById('o-quick').value = 'Nobody crosses without paying!'; opsQuote();
  opsRound();
  // the log caught everything, in order, with refs
  const kinds = OPS.events.map(e => e.kind);
  out.kinds = kinds.join(',');
  out.hasAll = ['encounter', 'initiative', 'scene', 'damage', 'death', 'heal', 'condition', 'quote', 'round'].every(k => kinds.includes(k));
  const dmg = OPS.events.find(e => e.kind === 'damage');
  out.dmgShape = dmg && /^foe:OGRE/.test(dmg.target) && dmg.data.amount === ogreHP && dmg.data.remaining === 0 && typeof dmg.seq === 'number' && /T/.test(dmg.t);
  out.regs = OPS.registers.join('|') === 'gothic|frontier';
  // autosave round-trip: wipe the live object, reload from storage
  const seqBefore = OPS.seq; OPS = null; opsLoad();
  out.roundTrip = OPS.seq === seqBefore && OPS.events.length > 0 && OPS.campaign === 'The Lonely Corridor' && OPS.combat.length === 4;
  // export document shape (without clicking the download)
  out.docShape = ['id', 'campaign', 'title', 'date', 'registers', 'rosterSnapshot', 'combat', 'round', 'seq', 'events'].every(k => k in OPS);
  // archive on new session
  opsNew();
  const arc = JSON.parse(localStorage.getItem('gmf_sessions') || '[]');
  out.archived = arc.length === 1 && arc[0].title === 'Session 1 — Decima' && OPS.events.length === 0;
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.railCount === 4 && r.ogreHP > 20 && r.topAfterSort && r.ogreDead && r.condOn
  && r.hasAll && r.dmgShape && r.regs && r.roundTrip && r.docShape && r.archived && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
