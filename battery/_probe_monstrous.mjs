// _probe_monstrous.mjs — CG v9.15.0 §273: the Monstrous Heritage lane.
// Oracle (FF rules): Aboleth seed — Aberration (d8, BAB 3/4, good Will),
// 8 HD, LA +9, Str 26/Con 20 → race adj STR+16/CON+10/DEX+1... (listed −
// 10/11 baseline: Str 26→+16, Dex 12→+2, Con 20→+10, Int 15→+4, Wis 17→+6,
// Cha 17→+6), monstrous class at 8: bab[7]=6, will[7]=2+4=6, fort[7]=2.
// Then an Expert level stacks via the normal classes array and the resolver
// still answers. Persistence round-trips through localStorage.
// v9.15.2 (§275 F1-F3, oracle sweep 2026-10-13): the import now stores the
// LISTED statblock scores (racial adj baked in, like the create form's
// save), derives max HP from the Hit Dice engine, and stamps totalLvl/ECL —
// the probe asserts the oracle-correct effective attributes
// (26/12/20/15/17/17), Fort +7 / Ref +3 / Will +9 (table + attribute, Iron
// Will is the GM's), maxHP in the 8d8+40 hero-roll range, ECL 17.
// The old attrsBase === '10,10,10,11,11,11' assertion PINNED the F1 bug.
import puppeteer from 'puppeteer';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Was a fixed path to a v9.15.2 copy on Adam's desktop; now the generator in
// this repository, like every other probe (CG_FILE=... tests another build).
const FILE = process.env.CG_FILE || fileURLToPath(new URL('../index.html', import.meta.url));
const SEED = {
  seed: 'ee-creature', from: 'GMF v0.6.2', fam: 'ABOLETH', label: 'Aboleth',
  size: 'Huge', type: 'Aberration', hit_dice: '8d8+40 (76 hp)',
  attributes: 'Str 26, Dex 12, Con 20, Int 15, Wis 17, Cha 17',
  saves: 'Fort +7, Ref +3, Will +11, Dodge +1', ba_grapple_parry: '+6/+22/+14',
  attack: 'Tentacle +12 melee (1d6+8 plus slime)', full_attack: '4 tentacles +12 melee (1d6+8 plus slime)',
  special_attacks: 'Enslave, psionics, slime', special_qualities: 'Aquatic subtype, darkvision 60 ft., mucus cloud',
  level_adjustment: '+9', advancement: '9\u201316 HD (Huge); 17\u201324 HD (Gargantuan)',
};

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(FILE).href, { waitUntil: 'load', timeout: 120000 });

const r = await page.evaluate((seed) => {
  const out = {};
  localStorage.clear(); chars.length = 0;
  importCreatureSeed(seed);
  out.charCount = chars.length;
  const c = chars[0] || {};
  out.name = c.name; out.race = c.race;
  out.clsTier = c.classes?.[0]?.tier; out.clsLvl = c.classes?.[0]?.level;
  const def = getClassEntry(c.classes?.[0]);
  out.resolved = !!def; out.hd = def?.hd; out.bab8 = def?.bab?.[7]; out.will8 = def?.will?.[7]; out.fort8 = def?.fort?.[7];
  out.raceEcl = (typeof RACES !== 'undefined' && RACES[c.race]) ? RACES[c.race].ecl : null;
  out.adjSTR = RACES[c.race]?.adj?.STR; out.adjCON = RACES[c.race]?.adj?.CON;
  out.attrsBase = (c.attrs || []).join(',');
  // v9.15.2 (§275): the oracle-correct derived state at import time.
  out.attrsEff = (typeof effAttrs === 'function' ? effAttrs(c) : c.attrs).join(',');
  out.totalLvl = c.totalLvl; out.ecl = c.ecl; out.maxHP = c.maxHP; out.ap = c.ap;
  const sb = computeStatBlock(c);
  out.fort = sb.fort.total; out.ref = sb.ref.total; out.will = sb.will.total; out.bab = sb.bab.total;
  // stack an Expert level — the normal engine path
  c.classes.push({ tier: 'basic', name: 'Expert', level: 1 });
  out.expertResolved = !!getClassEntry(c.classes[1]);
  // persistence round-trip
  out.stored = !!JSON.parse(localStorage.getItem('dxd20v2_monstrous') || '{}').classes;
  // picker hygiene: the monstrous class name must not be a pickable tier name
  out.tierOf = _compassTierOf(c.classes[0].name);
  // re-import does not crash and adds a second hero
  importCreatureSeed(seed);
  out.reimport = chars.length === 2;
  // v9.15.1 SS274: the PLAN — hdPlan advances the monstrous level, classPlan
  // pre-assigns; natural armor parses from the v0.6.5 AC line.
  importCreatureSeed({ ...seed, hdPlan: 12, classPlan: { name: 'Expert', levels: 1 },
    touch_full_ac_t_ac: '9/16 (−2 size, +1 Dex, +7 natural), flat-footed 15' });
  const p = chars[2];
  out.planHD = p.classes?.[0]?.level;
  out.planCls = p.classes?.[1]?.name + ' ' + p.classes?.[1]?.level + ' (' + p.classes?.[1]?.tier + ')';
  out.planNat = RACES[p.race]?.natAC;
  // the 1-HD case with a plan: class pre-assigned, no monstrous class
  importCreatureSeed({ seed: 'ee-creature', fam: 'AASIMARISH', label: 'Aasimarish', size: 'Medium',
    type: 'Humanoid', hit_dice: '1d8+1 (5 hp)', attributes: 'Str 13, Dex 10, Con 12, Int 10, Wis 13, Cha 14',
    level_adjustment: '+1', advancement: 'By character class', classPlan: { name: 'Expert', levels: 1 } });
  const a2 = chars[3];
  out.oneHD = (a2.classes?.length === 1) && a2.classes[0].name === 'Expert' && a2.classes[0].tier === 'basic' && a2.classes[0].first === true;
  return out;
}, SEED);
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.charCount === 1 && r.name === 'Aboleth' && r.clsTier === 'monstrous' && r.clsLvl === 8
  && r.resolved && r.hd === 8 && r.bab8 === 6 && r.will8 === 6 && r.fort8 === 2
  && r.raceEcl === 9 && r.adjSTR === 16 && r.adjCON === 10
  // v9.15.2 (§275 F1): the stored scores ARE the statblock's (adj baked in).
  && r.attrsBase === '26,12,20,15,17,17' && r.attrsEff === '26,12,20,15,17,17'
  // F1 table: Fort poor +2 + Con +5 = 7; Ref poor +2 + Dex +1 = 3; Will good
  // +6 + Wis +3 = 9 (statblock +11 carries Iron Will, the GM's); BAB +6.
  && r.fort === 7 && r.ref === 3 && r.will === 9 && r.bab === 6
  // F2: 8d8+40 through the hero-mode engine → 83..104 (first die max).
  && r.maxHP >= 83 && r.maxHP <= 104
  // F3: totalLvl stamped at import; ECL = 8 HD + LA 9 = 17.
  && r.totalLvl === 8 && r.ecl === 17
  // F12: monstrous HD alone grant no AP (no apB class → effective Heroic 0).
  && r.ap === 0
  && r.expertResolved && r.stored && r.tierOf === 'monstrous' && r.reimport
  && r.planHD === 12 && r.planCls === 'Expert 1 (basic)' && r.planNat === 7 && r.oneHD && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
