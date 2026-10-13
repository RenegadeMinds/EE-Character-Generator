// _probe_monstrous.mjs — CG v9.15.0 §273: the Monstrous Heritage lane.
// Oracle (FF rules): Aboleth seed — Aberration (d8, BAB 3/4, good Will),
// 8 HD, LA +9, Str 26/Con 20 → race adj STR+16/CON+10/DEX+1... (listed −
// 10/11 baseline: Str 26→+16, Dex 12→+2, Con 20→+10, Int 15→+4, Wis 17→+6,
// Cha 17→+6), monstrous class at 8: bab[7]=6, will[7]=2+4=6, fort[7]=2.
// Then an Expert level stacks via the normal classes array and the resolver
// still answers. Persistence round-trips through localStorage.
import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';

const FILE = 'C:/Users/adam_/OneDrive/Desktop/E&E/EpicsAndEpochs_Character_Generator_v9.15.0.html';
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
  return out;
}, SEED);
console.log(JSON.stringify(r, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.charCount === 1 && r.name === 'Aboleth' && r.clsTier === 'monstrous' && r.clsLvl === 8
  && r.resolved && r.hd === 8 && r.bab8 === 6 && r.will8 === 6 && r.fort8 === 2
  && r.raceEcl === 9 && r.adjSTR === 16 && r.adjCON === 10
  && r.attrsBase === '10,10,10,11,11,11'
  && r.expertResolved && r.stored && r.tierOf === 'monstrous' && r.reimport && !errors.length;
console.log(ok ? 'PROBE GREEN' : 'PROBE RED');
if (!ok) process.exit(1);
