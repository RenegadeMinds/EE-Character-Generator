// =============================================================================
// js/rules/06-homebrew-forge-armory-monstrous.js
// HOMEBREW FORGE ARMORY MONSTROUS
// =============================================================================
//
// WHAT'S IN HERE
//   GM homebrew: the Homebrew Forge (custom feats), the Homebrew Armory
//   (custom weapons and armor), and the Monstrous Heritage lane (monster races
//   and classes built from Foe Folio creature types). All three save to the
//   browser and can be imported and exported.
//
// KEY NAMES (so you can search for them)
//   tables/objects: HBG_SUBSTANCES, MONSTROUS_CLASSES, MONSTER_TYPE_PROG
//   functions (34): hbStoreSave, hbByName, hbAdjSummary, hbOpen, hbClose,
//   hbgStoreSave, monstrousSave, buildMonstrousClass, monstrousBoot,
//   importCreatureSeed, hbGearSync, hbgOpen, hbgClose, hbgTypeChange,
//   hbgDtypeChange, hbgTechChange, hbgAutoSpeed, hbgSave, hbgDelete,
//   hbgRenderList, hbgExport, hbgImport, hbSave, hbSaveAndGrant, hbRenderList,
//   hbGrant, hbChoosePick, hbApplyGrant, hbRevoke, hbReverseEntry, hbExport,
//   hbExportAll, hbDelete, hbImportFile
//
// LOAD ORDER
//   File 6 of 68. index.html loads it after
//   js/rules/05-six-scales-and-scenarios.js and before
//   js/rules/07-prestige-classes.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 4872-5428 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 4872-5428; unchanged below this line ----
// ==== v8.55.0: 🌍 HOMEBREW FORGE — structured GM-authored feats ====
// The worlds-of-origin request. Doctrine: closed-form payloads ride EXISTING rails
// (attribute bakes like racial adj; granted feats like Monk CMA/DMA), prose
// stays annotation. Adam's rulings 2026-09-29: World-style homebrew feats are
// FREE (no slot, no budget — the entry carries grantedBy so every counter
// already excludes it) and PREREQ-WAIVED (birthright doctrine). The entry's
// _hb snapshot makes grant/revoke self-contained and courier-safe.
let homebrewFeats = [];
try { homebrewFeats = JSON.parse(localStorage.getItem('dxd20v2_homebrew') || '[]'); } catch (e) { homebrewFeats = []; }
function hbStoreSave() { try { localStorage.setItem('dxd20v2_homebrew', JSON.stringify(homebrewFeats)); } catch (e) {} }
function hbByName(n) { return homebrewFeats.find(x => x.name === n) || null; }
function hbAdjSummary(r) {
  const parts = [];
  (r.adj || []).forEach((v, i) => { if (v) parts.push(`${v > 0 ? '+' : ''}${v} ${ATTR_NAMES[i]}`); });
  if (r.choose && r.choose.n) parts.push(`+${r.choose.n} to one attribute (player's choice)`);
  if ((r.grants || []).length) parts.push(r.grants.join(' + '));
  if (r.free === false) parts.push('costs a feat selection');
  return parts.join(', ') || 'description only';
}
function hbOpen() { hbRenderList(); document.getElementById('hb-choose-panel').style.display = 'none'; document.getElementById('hb-modal').style.display = 'block'; }
function hbClose() { document.getElementById('hb-modal').style.display = 'none'; }

// ============================================================================
// v9.12.0 (§269): THE HOMEBREW ARMORY — GM-authored weapons and armor that
// JOIN the real catalogs (hbGearSync pushes them into WEAPONS_CATALOG /
// ARMOR_CATALOG at boot and on every save), so browse, purchase, equip,
// stat strips, mastercraft/enchant, and T/AC armor integrity all ride the
// normal rails with zero special-casing. Armor may be forged from a NAMED
// SUBSTANCE (HH pp.329-331, the alloy list): its hardness follows the
// substance's native-TS row on the Armor Hardness table (HH p.384) — a
// Megatanium chain shirt is hard like Megatanium, whatever its pattern's
// age. Store is campaign-level (localStorage, like the feat Forge), with
// export/import for the players' table.
const HBG_SUBSTANCES = {  // name → native Tech Scale (HH pp.329-331)
  'Alumisteel': 5, 'Duraplastic': 5,
  'Duralloy': 6, 'Mythralloy': 6, 'Resilium': 6, 'Steelskin': 6,
  'Adamantium': 7, 'Crystal Carbon': 7, 'Neovulcanium': 7, 'Tithralium': 7,
  'Krithium': 8, 'Megatanium': 8, 'Mythandium': 8, 'Nanofluidic': 8, 'Reactive': 8,
  'Unobtanium': 9,
};
let homebrewGear = [];
try { homebrewGear = JSON.parse(localStorage.getItem('dxd20v2_homebrew_gear') || '[]'); } catch (e) { homebrewGear = []; }
function hbgStoreSave() { try { localStorage.setItem('dxd20v2_homebrew_gear', JSON.stringify(homebrewGear)); } catch (e) {} }
// ========== v9.15.0 §273: THE MONSTROUS HERITAGE LANE ==========
// The CG half of the GMF bridge (Adam's gavel, 2026-10-13): the Familiar's
// "Seed → CG" button exports a creature seed; importing it here births a
// playable character — the creature's racial Hit Dice ride as a MONSTROUS-
// tier class (progressions from the FF Creature Types chapter: good saves
// 2 + HD/2, poor HD/3, BAB by type fraction), the creature itself becomes
// a race entry (ability adjustments = listed − the 10/11 baseline, RLM =
// its printed Level Adjustment), and class levels then advance normally in
// the full engine. Monstrous classes never appear in the class picker —
// they exist only through seed import. Creatures of 1 HD or less follow
// FF p.34 (class levels REPLACE the monster level): race only, no class.
const MONSTROUS_CLASSES = {};
let monstrousStore = { classes: {}, races: {} };
try { monstrousStore = JSON.parse(localStorage.getItem('dxd20v2_monstrous') || '{"classes":{},"races":{}}'); } catch (e) { monstrousStore = { classes: {}, races: {} }; }
function monstrousSave() { try { localStorage.setItem('dxd20v2_monstrous', JSON.stringify(monstrousStore)); } catch (e) {} }
const MONSTER_TYPE_PROG = { // FF Creature Types: die, BAB fraction, good saves
  'Aberration':{d:8,b:.75,g:['will']}, 'Animal':{d:8,b:.75,g:['fort','ref']},
  'Construct':{d:10,b:.75,g:[]}, 'Dragon':{d:12,b:1,g:['fort','ref','will']},
  'Elemental':{d:8,b:.75,g:['fort']}, 'Fey':{d:6,b:.5,g:['will']},
  'Giant':{d:8,b:.75,g:['fort']}, 'Humanoid':{d:8,b:.75,g:['ref']},
  'Magical Beast':{d:10,b:1,g:['fort','ref']}, 'Monstrous Humanoid':{d:8,b:1,g:['ref','will']},
  'Ooze':{d:10,b:.75,g:[]}, 'Outsider':{d:8,b:1,g:['fort','ref','will']},
  'Plant':{d:8,b:.75,g:['fort']}, 'Undead':{d:12,b:.5,g:['will']}, 'Vermin':{d:8,b:.75,g:['fort']},
};
function buildMonstrousClass(typeName, maxHD) {
  const key = Object.keys(MONSTER_TYPE_PROG).find(k => k.toLowerCase() === String(typeName || '').trim().toLowerCase());
  const p = MONSTER_TYPE_PROG[key] || { d: 8, b: .75, g: ['fort'] };
  const n = Math.max(20, Math.min(54, maxHD || 20));
  const bab = [], fort = [], ref = [], will = [], def = [], rep = [];
  for (let i = 1; i <= n; i++) {
    bab.push(Math.floor(p.b * i));
    fort.push(p.g.includes('fort') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    ref.push(p.g.includes('ref') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    will.push(p.g.includes('will') ? 2 + Math.floor(i / 2) : Math.floor(i / 3));
    def.push(0); rep.push(0);
  }
  return { attr: 'STR', hd: p.d, bab, fort, ref, will, def, rep, sp: 2, monster: true, mType: key || 'Aberration' };
}
function monstrousBoot() {
  for (const [n, d] of Object.entries(monstrousStore.classes || {})) MONSTROUS_CLASSES[n] = d;
  for (const [n, d] of Object.entries(monstrousStore.races || {})) if (!RACES[n]) RACES[n] = d;
}
monstrousBoot();
function importCreatureSeed(seed) {
  const fam = String(seed.fam || seed.label || 'Creature');
  const nice = fam.toLowerCase().replace(/(^|[\s\-('])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const hdM = String(seed.hit_dice || '').match(/(\d+)d(\d+)/);
  const hpM = String(seed.hit_dice || '').match(/\((\d+)\s*hp\)/i);
  const hd = hdM ? +hdM[1] : 1;
  const la = (() => { const m = String(seed.level_adjustment || '').match(/[+−-]?\s*(\d+)/); return m ? +m[1] : 0; })();
  const typeName = String(seed.type || 'Aberration');
  // race entry: adjustments vs the 10/11 baseline (FF: statblocks assume average)
  const adj = {};
  for (const am of String(seed.attributes || '').matchAll(/(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)/gi)) {
    const v = +am[2]; const a = v - (v % 2 === 0 ? 10 : 11);
    if (a) adj[am[1].toUpperCase()] = a;
  }
  const raceName = nice + ' (Monstrous)';
  const sz = String(seed.size || '');
  // v9.15.1 §274: natural armor parsed from the seed's AC line (v0.6.5+
  // seeds carry touch_full_ac_t_ac; older seeds fall back to the GM note).
  const natM = String(seed.touch_full_ac_t_ac || '').match(/\+(\d+)\s*natural/i);
  const raceDef = {
    adj, ecl: la, size: /Small|Tiny|Diminutive|Fine/i.test(sz) ? 'S' : (/Large|Huge|Gargantuan|Colossal/i.test(sz) ? 'L' : undefined),
    ...(natM ? { natAC: +natM[1] } : {}),
    notes: `Monstrous Heritage (GMF seed): ${nice}, ${sz} ${typeName}. SA: ${seed.special_attacks || '—'}. SQ: ${seed.special_qualities || '—'}.${seed.t_ac_system_adj ? ' T/AC: ' + seed.t_ac_system_adj + '.' : ''} True size ${sz} (race engine treats beyond-Large as L); ${natM ? 'natural armor +' + natM[1] + ' wired from the statblock; ' : 'natural armor, '}racial abilities and their DCs are the GM's finishing touches.`,
  };
  // v9.15.1: UPSERT — a re-import refreshes the race entry (an enriched
  // seed, e.g. one carrying the AC line, must win over a stale registration).
  RACES[raceName] = raceDef;
  monstrousStore.races[raceName] = raceDef;
  const id = 'seed-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  // v9.15.1 §274: honor the seed's PLAN — the Advancer panel's advanced HD
  // and class overlay picks pre-assign here (Adam's Aasimar arrived class
  // 'Unassigned' because the v0.6.2 seed dropped them).
  const hdPlanned = Math.max(hd, +seed.hdPlan || 0);
  const classes = [];
  if (hdPlanned >= 2) {
    const advHi = Math.max(hdPlanned, ...[...String(seed.advancement || '').matchAll(/(\d+)/g)].map(m => +m[1]).filter(x => x < 60), 0);
    const clsName = 'Monstrous: ' + nice + ' (' + typeName + ')';
    const clsDef = buildMonstrousClass(typeName, advHi);
    MONSTROUS_CLASSES[clsName] = clsDef;
    monstrousStore.classes[clsName] = clsDef;
    classes.push({ tier: 'monstrous', name: clsName, level: hdPlanned, first: true });
  }
  let planNote = '';
  if (seed.classPlan && seed.classPlan.name && +seed.classPlan.levels > 0) {
    const pn = String(seed.classPlan.name), pl = Math.min(20, +seed.classPlan.levels);
    const tier = (_compassTierOf(pn)) || (getClassData(pn) ? 'basic' : null);
    if (tier && tier !== 'monstrous') {
      classes.push({ tier, name: pn, level: pl, first: classes.length === 0 });
      planNote = 'Class plan pre-assigned from the Familiar: ' + pn + ' ' + pl + ' — skill, feat and talent/spell picks for those levels are OWED (open the editor to choose; the Quickdraw auto-allocator for monstrous bases is on the roadmap).';
    } else {
      planNote = 'Seed named a class plan (' + pn + ') the CG does not recognize — add the class in the editor.';
    }
  }
  monstrousSave();
  // v9.15.2 (§275 F1): store the LISTED statblock scores. The create form
  // bakes racial adjustments into c.attrs at save time, and the Edit loader
  // sets formBudget.racialApplied = c.race (adjustments assumed applied) —
  // so the stored scores must already carry the race's adj. The old code
  // stored listed − adj (all 10s/11s) and nothing ever added adj back: the
  // Aboleth played Str 10 / Con 10, Fort +2 instead of +7 (HH p.350).
  const listedAttrs = ['STR','DEX','CON','INT','WIS','CHA'].map(k => {
    const m = String(seed.attributes || '').match(new RegExp(k.charAt(0) + k.slice(1).toLowerCase() + '\\s+(\\d+)'));
    return m ? +m[1] : 10;
  });
  const c = {
    id, name: nice, race: raceName, sex: '', align: 'Neutral', hybrid: null, allegiance: '',
    occupations: [], xp: 0, hpMode: 'hero',
    schemaVer: CURRENT_SCHEMA_VER,
    attrs: listedAttrs, attrBumps: [], racialApplied: raceName,
    sixLevels: { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 5 },
    scenarioPreset: 'Custom',
    classes, skills: {}, feats: [], powers: [], talents: [], items: [], gear: [],
    log: [
      'Monstrous Heritage import (GMF seed, v9.15.1): ' + nice + ' — ' + (seed.hit_dice || '') + ', ' + sz + ' ' + typeName + (la ? ', LA +' + la : '') + (hdPlanned > hd ? ', advanced to ' + hdPlanned + ' HD per the Familiar plan' : '') + '.',
      planNote,
      hdPlanned >= 2 ? 'Racial Hit Dice ride as the Monstrous class (' + hdPlanned + ' levels); add character classes on top — ECL = HD + classes + LA.' : 'At 1 HD or less, class levels REPLACE the monster level (FF p.34): pick a class as normal.',
      hpM ? 'Statblock prints ' + hpM[1] + ' hp; the sheet derives HP from the Hit Dice engine — GM may set hp to the printed value.' : '',
      'GM finishing touches: natural armor, special attack/quality DCs, skills and feats from the statblock; Six Scales set permissive (5s) — tune to the scenario.',
    ].filter(Boolean),
  };
  // v9.15.2 (§275 F2+F3): the import log's promise made true — max HP comes
  // from the Hit Dice engine (hero-mode rolls, max first die, Con mod per
  // die, natural-AC ×5 HP — the same recipe as the form-save path) instead
  // of the old hard-coded 10; totalLvl and the derived stat block are
  // stamped at import so ECL, skill caps and level-up math are right before
  // the first Edit → Save.
  c.hpRolls = generateHpRolls(classes, 'hero');
  const _impConM = am(c.attrs[2]);
  const _impNat = (computeNaturalAC(c).total || 0);
  c.maxHP = Math.max(1, computeMaxHPFromRolls(classes, c.hpRolls, _impConM) + _impNat * 5);
  c.hp = c.maxHP; c.currentHP = c.maxHP;
  const _impStats = computeStatsFromClasses(classes, c.attrs[5] || 10, effectiveHeroicLevelForAP(c), 0);
  c.totalLvl = _impStats.totalLvl;
  c.bab = _impStats.bab; c.def = _impStats.def; c.fort = _impStats.fort; c.ref = _impStats.ref; c.will = _impStats.will; c.rep = _impStats.rep;
  c.apMax = _impStats.ap; c.ap = _impStats.ap;
  chars.push(c);
  reconcileMissingHP(c);
  refreshEclXp(c);
  save(); renderRoster();
  selChar(id);
  toast('⬆ Monstrous Heritage: ' + nice + ' imported — ' + (hdPlanned >= 2 ? hdPlanned + ' racial HD as the Monstrous class, ' : '') + (seed.classPlan && seed.classPlan.name ? seed.classPlan.name + ' ' + seed.classPlan.levels + ' pre-assigned, ' : '') + 'RLM +' + la + '. See the log.');
}
function hbGearSync() {
  for (const arr of [WEAPONS_CATALOG, ARMOR_CATALOG]) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].hb) arr.splice(i, 1);
  }
  for (const rec of homebrewGear) {
    const arr = rec.category === 'weapon' ? WEAPONS_CATALOG : ARMOR_CATALOG;
    if (arr.some(e => e.name === rec.name && !e.hb)) continue;  // never shadow canon
    arr.push(rec);
  }
}
function hbgOpen() { hbgRenderList(); hbgTypeChange(); document.getElementById('hbg-modal').style.display = 'block'; }
function hbgClose() { document.getElementById('hbg-modal').style.display = 'none'; }
function hbgTypeChange() {
  const w = document.getElementById('hbg-type').value === 'weapon';
  for (const el of document.querySelectorAll('.hbg-w')) el.style.display = w ? '' : 'none';
  for (const el of document.querySelectorAll('.hbg-a')) el.style.display = w ? 'none' : '';
  // v9.13.0 (§271): the standard-feature gadget list follows the type —
  // weapon gadgets for weapons, armor gadgets for armor (GADGETS_CATALOG).
  const sel = document.getElementById('hbg-gadget');
  if (sel) {
    const keep = sel.value;
    const kind = w ? 'weapon' : 'armor';
    sel.innerHTML = '<option value="">None</option>' + GADGETS_CATALOG
      .filter(g => g.type === kind)
      .map(g => `<option${g.name === keep ? ' selected' : ''}>${escapeHTML(g.name)}</option>`).join('');
  }
}
// v9.13.0 (§271): ionic and concussion are nonlethal BY DEFINITION (HH:
// "ionization" = electrical nonlethal; concussion grenades deal "nonlethal
// concussion damage") — picking them flips the lethality select, which
// stays editable for deliberate divergence.
function hbgDtypeChange() {
  const dt = document.getElementById('hbg-dtype').value;
  if (dt === 'ionic' || dt === 'concussion') document.getElementById('hbg-leth').value = 'nonlethal';
}
// v9.14.0 (§272): the tech-upgrade interlocks — Stun Pulse IS concussion
// damage and EMP IS ionic (Adam's gavels 3-4), so checking one sets the
// damage type (and nonlethal) and unchecks the other; Heavy Crit suggests
// the ×3 multiplier into the crit field (editable).
function hbgTechChange(which) {
  const stun = document.getElementById('hbg-stun'), emp = document.getElementById('hbg-emp');
  if (which === 'stun' && stun.checked) {
    emp.checked = false;
    document.getElementById('hbg-dtype').value = 'concussion'; hbgDtypeChange();
  }
  if (which === 'emp' && emp.checked) {
    stun.checked = false;
    document.getElementById('hbg-dtype').value = 'ionic'; hbgDtypeChange();
  }
  if (which === 'hcrit' && document.getElementById('hbg-hcrit').checked) {
    const cr = document.getElementById('hbg-crit');
    cr.value = cr.value.replace(/x\d+/i, 'x3');
    if (!/x3/i.test(cr.value)) cr.value = 'x3';
  }
}
function hbgAutoSpeed() {
  const t = document.getElementById('hbg-atype').value;
  document.getElementById('hbg-speed').value = t === 'light' || t === 'shield' ? '30’/20’' : '20’/15’';
}
function hbgSave() {
  const v = (id) => (document.getElementById(id) || {}).value || '';
  const name = v('hbg-name').trim();
  if (!name) { toast('The forge needs a name.'); return; }
  const isWeapon = v('hbg-type') === 'weapon';
  const canon = (isWeapon ? WEAPONS_CATALOG : ARMOR_CATALOG).some(e => e.name === name && !e.hb);
  if (canon) { toast(`"${name}" already exists in the canon catalogue — pick another name.`); return; }
  const ts = parseInt(v('hbg-ts'), 10) || 0;
  const dc = parseInt(v('hbg-dc'), 10) || 15;
  const weight = parseFloat(v('hbg-weight')) || 0;
  const notes = v('hbg-notes').trim();
  let rec;
  if (isWeapon) {
    const range = parseInt(v('hbg-range'), 10) || 0;
    const dt = v('hbg-dtype');
    rec = {
      n: name, cat: v('hbg-cat'), tl: ts, kind: v('hbg-kind'), name, ts,
      category: 'weapon', dc: String(dc), dmg_s: v('hbg-dmgs').trim() || '—', dmg_m: v('hbg-dmgm').trim() || '1d6',
      crit: v('hbg-crit').trim() || 'x2',
      tail: `${range ? range + '’ ' : ''}${weight} lb. ${dt.charAt(0).toUpperCase() + dt.slice(1)}`,
      damage_type: [dt], lethality: v('hbg-leth'), rof: [], rof_raw: null,
      magazine_raw: null, magazine_capacity: null, scale: 'character',
      hb: true, hb_notes: notes,
    };
  } else {
    const atype = v('hbg-atype');
    rec = {
      name, tl: ts, type: atype, category: 'armor', dc,
      ac_bonus: parseInt(v('hbg-ac'), 10) || 0,
      max_dex: v('hbg-mdex').trim() || '—', armor_check_penalty: v('hbg-acp').trim() || '+/-0',
      arcane_spell_failure: v('hbg-asf').trim() || '—', speed: v('hbg-speed').trim() || '30’/20’',
      weight: `${weight} lb.`, scale: 'character', hb: true, hb_notes: notes,
    };
    const sub = v('hbg-substance');
    if (sub && HBG_SUBSTANCES[sub]) {
      const subTS = HBG_SUBSTANCES[sub];
      const row = (ARMOR_HARDNESS_BY_TS[Math.min(subTS, 8)]);
      const cat = atype === 'shield' ? 'medium' : atype;  // p.384 has no shield column; medium row, GM may adjust
      rec.hb_substance = sub;
      rec.hb_hardness = subTS <= 4 ? rec.ac_bonus : ((row && row[cat] != null) ? row[cat] : rec.ac_bonus);
    }
  }
  // v9.13.0 (§271): the standard-feature gadget travels on the record.
  const gad = v('hbg-gadget');
  if (gad) rec.hb_gadget = gad;
  // v9.14.0 (§272): the gaveled Tech Upgrades (weapons only).
  if (isWeapon) {
    const chk = (id) => !!(document.getElementById(id) || {}).checked;
    const tech = {
      aa: parseInt(v('hbg-aa'), 10) || 0,
      stun: chk('hbg-stun'), emp: chk('hbg-emp'),
      reach: chk('hbg-reach'), heavyCrit: chk('hbg-hcrit'), powerPack: chk('hbg-ppack'),
    };
    if (tech.aa || tech.stun || tech.emp || tech.reach || tech.heavyCrit || tech.powerPack) rec.hb_tech = tech;
  }
  const i = homebrewGear.findIndex(r => r.name === name && (r.category === 'weapon') === isWeapon);
  if (i >= 0) homebrewGear[i] = rec; else homebrewGear.push(rec);
  hbgStoreSave(); hbGearSync(); hbgRenderList();
  if (curId) renderGear();
  toast(`⚒ ${name} forged${rec.hb_substance ? ` in ${rec.hb_substance} (hardness ${rec.hb_hardness}, native-TS row — HH p.384)` : ''} — it now sits in the ${isWeapon ? 'weapons' : 'armor'} catalogue (TS ${ts}, DC ${dc}).`);
}
function hbgDelete(i) {
  const r = homebrewGear[i]; if (!r) return;
  homebrewGear.splice(i, 1);
  hbgStoreSave(); hbGearSync(); hbgRenderList();
  if (curId) renderGear();
  toast(`${r.name} unmade. Owned copies on characters keep their records (the dossier loses its catalogue page).`);
}
function hbgRenderList() {
  const el = document.getElementById('hbg-list'); if (!el) return;
  el.innerHTML = homebrewGear.length
    ? homebrewGear.map((r, i) => {
        const line = (r.category === 'weapon'
          ? `${r.dmg_m} · ${r.crit} · ${r.tail}`
          : `+${r.ac_bonus} AC · ${r.type}${r.hb_substance ? ` · ${r.hb_substance} (hardness ${r.hb_hardness})` : ''} · ${r.weight}`)
          + (r.hb_gadget ? ` · ⚙ ${r.hb_gadget} (standard feature)` : '')
          + (r.hb_tech ? [r.hb_tech.aa ? (r.hb_tech.aa === 4 ? ' · ⚡⛏ Power Wpn' : ` · ⛏ AA ${['','I','II','III'][r.hb_tech.aa]}`) : '', r.hb_tech.stun ? ' · Stun Pulse' : '', r.hb_tech.emp ? ' · EMP' : '', r.hb_tech.reach ? ' · Reach +5′' : '', r.hb_tech.heavyCrit ? ' · ×3' : '', r.hb_tech.powerPack ? ' · ⚡pack' : ''].join('') : '');
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
          <div><b>${escapeHTML(r.name)}</b> <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);">${r.category === 'weapon' ? '⚔' : '🛡'} TS ${r.tl} · DC ${r.dc}</span>
            <div style="font-size:10.5px;opacity:.6;">${escapeHTML(line)}${r.hb_notes ? ` — ${escapeHTML(r.hb_notes)}` : ''}</div></div>
          <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="hbgDelete(${i})">✕</button>
        </div>`;
      }).join('')
    : '<div style="padding:5px 6px;font-size:11px;opacity:var(--o50);color:var(--dim);">Nothing forged yet — weapons and armor you author here join the shop catalogues and export as a file for your players.</div>';
}
function hbgExport() {
  const blob = new Blob([JSON.stringify({ _kind: 'ee-homebrew-gear', v: 1, gear: homebrewGear }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_Armory.json';
  a.click(); URL.revokeObjectURL(a.href);
}
function hbgImport(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      const list = Array.isArray(data) ? data : (data.gear || []);
      let added = 0;
      for (const r of list) {
        if (!r || !r.name || !r.category) continue;
        if ((r.category === 'weapon' ? WEAPONS_CATALOG : ARMOR_CATALOG).some(e => e.name === r.name && !e.hb)) continue;
        if (homebrewGear.some(x => x.name === r.name && x.category === r.category)) continue;
        r.hb = true; homebrewGear.push(r); added++;
      }
      hbgStoreSave(); hbGearSync(); hbgRenderList();
      toast(`⬆ Armory import: ${added} added.`);
    } catch (e) { toast('Import failed — not a valid armory file.'); }
    inp.value = '';
  };
  rd.readAsText(f);
}
async function hbSave() {
  const name = (document.getElementById('hb-name').value || '').trim();
  if (!name) { toast('Name the feat first.'); return; }
  if (getFeatData(name)) { toast('That name belongs to a catalog feat — choose another (collisions confuse the budget, prereq, and compliance engines).'); return; }
  const adj = [];
  for (let i = 0; i < 6; i++) adj.push(Math.max(-5, Math.min(5, parseInt((document.getElementById('hb-adj-' + i) || {}).value, 10) || 0)));
  const chooseN = Math.max(0, Math.min(5, parseInt((document.getElementById('hb-choose-n') || {}).value, 10) || 0));
  const grants = (document.getElementById('hb-grants').value || '').split(',').map(s => s.trim()).filter(Boolean);
  const unknown = grants.filter(g => !getFeatData(g));
  if (unknown.length && !(await confirmModal(`These granted feats are not in the catalog and will be skipped when granting:\n\n${unknown.join(', ')}\n\nEstablish anyway?`))) return;
  const rec = {
    name, family: document.getElementById('hb-family').value || 'Heritage',
    desc: (document.getElementById('hb-desc').value || '').trim(),
    pre: ((document.getElementById('hb-pre') || {}).value || '').trim(),  // v8.56.0: display-text prereqs (ex-Custom Feat form)
    adj, choose: chooseN ? { n: chooseN, count: 1 } : null,
    grants, waive: true,
    free: !!(document.getElementById('hb-free') || {checked: true}).checked,  // v8.55.1: per-feat price
    createdAt: new Date().toLocaleDateString(),
  };
  const existing = hbByName(name);
  if (existing) {
    if (!(await confirmModal(`"${name}" is already in the library — overwrite it? (Heroes already carrying it keep their granted snapshot.)`))) return;
    Object.assign(existing, rec);
  } else homebrewFeats.push(rec);
  hbStoreSave(); hbRenderList();
  ['hb-name', 'hb-desc', 'hb-grants', 'hb-pre'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  for (let i = 0; i < 6; i++) document.getElementById('hb-adj-' + i).value = 0;
  document.getElementById('hb-choose-n').value = 0;
  toast(`🌍 Established: ${name} — ${hbAdjSummary(rec)}.`);
  return name;  // v8.56.0: lets hbSaveAndGrant chain
}
// v8.56.0 (playtest issue #1): the one-step path the retired Custom Feat
// form used to offer — establish in the library AND grant to the current
// hero in a single click (the chooser flow still interposes for
// player-chosen attribute bonuses).
async function hbSaveAndGrant() {
  if (!curId || !chars.find(x => x.id === curId)) { toast('Select a hero first (Roster tab) — Establish alone still saves to the library.'); return; }
  const name = await hbSave();
  if (!name) return;
  const i = homebrewFeats.findIndex(r => r.name === name);
  if (i >= 0) hbGrant(i);
}
function hbRenderList() {
  const el = document.getElementById('hb-list');
  if (!el) return;
  const c = curId ? chars.find(x => x.id === curId) : null;
  el.innerHTML = homebrewFeats.length
    ? homebrewFeats.map((r, i) => {
        const has = c && (c.feats || []).some(f => (f.name || f.n) === r.name);
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-top:1px solid rgba(200,151,30,.12);font-size:11.5px;">
          <span>🌍 <b>${escapeHTML(r.name)}</b> <span style="opacity:var(--o60);color:var(--dim);">[${escapeHTML(r.family)}] ${escapeHTML(hbAdjSummary(r))}</span>${r.desc ? ` <span style="opacity:.45;cursor:help;" title="${escapeHTML(r.desc)}">✎</span>` : ''}</span>
          <span style="margin-left:auto;display:inline-flex;gap:5px;">
            ${c ? (has
              ? `<button class="btn btn-sm" style="font-size:10px;padding:1px 7px;" onclick="hbRevoke(${i})" title="Remove from ${escapeHTML(c.name)} — reverses the attribute bake (and its HP effect) and withdraws the granted feats this grant added.">↩ Revoke</button>`
              : `<button class="btn btn-sm btn-pri" style="font-size:10px;padding:1px 7px;" onclick="hbGrant(${i})" title="Grant to ${escapeHTML(c.name)} — free: no slot, no budget, prereqs waived.">＋ Grant</button>`)
              : '<span style="font-size:10px;opacity:var(--o40);color:var(--dim);">select a hero</span>'}
            <button class="btn btn-sm" style="font-size:10px;padding:1px 7px;" onclick="hbExport(${i})" title="Download this feat as a file.">⬇</button>
            <button class="btn btn-sm" style="font-size:10px;padding:1px 7px;" onclick="hbDelete(${i})" title="Remove from the library. Heroes already carrying it are untouched (their snapshot is self-contained).">✕</button>
          </span></div>`;
      }).join('')
    : '<div style="padding:5px 6px;font-size:11px;opacity:var(--o50);color:var(--dim);">Nothing established yet — homebrew feats you author here can be granted to any hero and exported as a file for your players.</div>';
}
let _hbPendingGrant = null;
function hbGrant(i) {
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[i];
  if (!c || !r) return;
  if ((c.feats || []).some(f => (f.name || f.n) === r.name)) { toast(`${c.name} already has ${r.name}.`); return; }
  if (r.choose && r.choose.n) {
    _hbPendingGrant = { i };
    document.getElementById('hb-choose-label').textContent = `${r.name}: +${r.choose.n} to which attribute for ${c.name}?`;
    document.getElementById('hb-choose-panel').style.display = 'block';
    return;
  }
  hbApplyGrant(c, r, null);
}
function hbChoosePick(attrIdx) {
  const p = _hbPendingGrant; _hbPendingGrant = null;
  document.getElementById('hb-choose-panel').style.display = 'none';
  if (!p) return;
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[p.i];
  if (c && r) hbApplyGrant(c, r, attrIdx);
}
function hbApplyGrant(c, r, choiceIdx) {
  const applied = (r.adj || [0,0,0,0,0,0]).slice();
  if (choiceIdx !== null && r.choose && r.choose.n) applied[choiceIdx] = (applied[choiceIdx] || 0) + r.choose.n;
  const oldConMod = am(c.attrs[2]);
  for (let k = 0; k < 6; k++) c.attrs[k] = (c.attrs[k] || 10) + (applied[k] || 0);
  // Con changes retro-adjust HP per RAW (mod delta × character level).
  const dMod = am(c.attrs[2]) - oldConMod;
  const hpDelta = dMod * (c.totalLvl || 1);
  if (hpDelta) { c.maxHP = Math.max(1, (c.maxHP || 1) + hpDelta); c.currentHP = Math.max(1, Math.min((c.currentHP || 1) + hpDelta, c.maxHP)); c.hp = c.maxHP; }
  // The homebrew entry itself. v8.55.1: the feat sets its own price — FREE
  // carries grantedBy (excluded from budget/compliance automatically); a
  // feat that COSTS A SELECTION omits grantedBy so it counts against the
  // budget like any picked feat (the reconciler's removal loop only touches
  // grantedBy entries, so paid entries are naturally safe; _hb children are
  // expected either way). Child grants are part of the feat's effect and
  // stay free in both modes.
  const grantsAdded = [];
  for (const g of (r.grants || [])) {
    if (!getFeatData(g)) continue;                          // catalog-existence guard
    if (hasFeatNamed(c, g)) continue;                       // duplicate grant does nothing (d20 convention)
    c.feats.push({ name: g, grantedBy: r.name + ' (homebrew)' });
    grantsAdded.push(g);
  }
  const isFree = r.free !== false;
  const entry = {
    name: r.name,
    _legacy: { t: r.family || 'Heritage', pre: (r.pre && r.pre.trim()) ? r.pre + ' (GM adjudicates)' : 'None — GM-approved', d: r.desc || '' },
    _hb: { adj: applied, hpDelta, grantsAdded, choice: choiceIdx !== null ? ATTR_NAMES[choiceIdx] : null, free: isFree },
  };
  if (isFree) entry.grantedBy = 'Homebrew (GM grant)';
  c.feats.push(entry);
  logAct(`🌍 ${r.name} granted (GM homebrew): ${hbAdjSummary(r)}${choiceIdx !== null ? ` — choice: ${ATTR_NAMES[choiceIdx]}` : ''}${hpDelta ? ` · HP ${hpDelta > 0 ? '+' : ''}${hpDelta} (Con modifier × level, RAW retro-adjust)` : ''}. ${isFree ? 'Free — no slot, no budget' : 'Costs a feat selection — counted against the feat budget'}; prereqs waived.`);
  save(); hbRenderList(); renderFeats(); renderSheet();
  toast(`🌍 ${r.name} → ${c.name}.`);
}
async function hbRevoke(i) {
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[i];
  if (!c || !r) return;
  const idx = (c.feats || []).findIndex(f => (f.name || f.n) === r.name && f._hb);
  if (idx < 0) { toast('No revocable homebrew snapshot found on this hero.'); return; }
  if (!(await confirmModal(`Revoke ${r.name} from ${c.name}? Attribute adjustments (and any HP effect) reverse; granted feats this grant added are withdrawn.`))) return;
  const entry = c.feats[idx];
  hbReverseEntry(c, entry);
  // Re-locate by reference — the reversal's child splices shift indices.
  const idx2 = c.feats.indexOf(entry);
  if (idx2 >= 0) c.feats.splice(idx2, 1);
  save(); hbRenderList(); renderFeats(); renderSheet();
  toast(`↩ ${r.name} revoked from ${c.name}.`);
}
// Shared reversal used by hbRevoke AND the Feats-page trash can.
function hbReverseEntry(c, f) {
  const hb = f._hb || {};
  const oldConMod = am(c.attrs[2]);
  for (let k = 0; k < 6; k++) c.attrs[k] = (c.attrs[k] || 10) - ((hb.adj || [])[k] || 0);
  const dMod = am(c.attrs[2]) - oldConMod;
  const hpDelta = hb.hpDelta ? -hb.hpDelta : dMod * (c.totalLvl || 1);
  if (hpDelta) { c.maxHP = Math.max(1, (c.maxHP || 1) + hpDelta); c.currentHP = Math.max(1, Math.min(c.currentHP || 1, c.maxHP)); c.hp = c.maxHP; }
  for (const g of (hb.grantsAdded || [])) {
    const gi = c.feats.findIndex(x => (x.name || x.n) === g && x.grantedBy === (f.name || f.n) + ' (homebrew)');
    if (gi >= 0) c.feats.splice(gi, 1);
  }
  logAct(`↩ ${f.name || f.n} revoked (GM homebrew): attribute bake reversed${hb.hpDelta ? `, HP ${-hb.hpDelta > 0 ? '+' : ''}${-hb.hpDelta}` : ''}${(hb.grantsAdded || []).length ? `, withdrew ${hb.grantsAdded.join(', ')}` : ''}.`);
}
function hbExport(i) {
  const r = homebrewFeats[i]; if (!r) return;
  const blob = new Blob([JSON.stringify({ _eeHomebrew: 1, feats: [r] }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_' + r.name.replace(/[^a-z0-9]+/gi, '_') + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function hbExportAll() {
  if (!homebrewFeats.length) { toast('Library is empty.'); return; }
  const blob = new Blob([JSON.stringify({ _eeHomebrew: 1, feats: homebrewFeats }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_Library.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`⬇ ${homebrewFeats.length} homebrew feat${homebrewFeats.length === 1 ? '' : 's'} exported.`);
}
async function hbDelete(i) {
  const r = homebrewFeats[i]; if (!r) return;
  if (!(await confirmModal(`Delete "${r.name}" from the library?\n\nHeroes already carrying it keep their grant (the snapshot on the character is self-contained) — this only removes it from the authoring list.`))) return;
  homebrewFeats.splice(i, 1); hbStoreSave(); hbRenderList();
}
function hbImportFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const x = JSON.parse(rd.result);
      const arr = Array.isArray(x) ? x : (x.feats || [x]);
      let added = 0, renamed = 0, skipped = 0;
      for (const s of arr) {
        if (!s || typeof s.name !== 'string' || !s.name.trim()) { skipped++; continue; }
        let nm = s.name.trim();
        if (getFeatData(nm)) { nm += ' (homebrew)'; renamed++; }
        if (hbByName(nm)) { const base = nm; let k = 2; while (hbByName(nm)) nm = `${base} (${k++})`; renamed++; }
        const adj = []; for (let k2 = 0; k2 < 6; k2++) adj.push(Math.max(-5, Math.min(5, Math.round((s.adj || [])[k2] || 0))));
        homebrewFeats.push({ name: nm, family: s.family || 'Heritage', desc: typeof s.desc === 'string' ? s.desc : '',
          adj, choose: (s.choose && s.choose.n) ? { n: Math.max(0, Math.min(5, Math.round(s.choose.n))), count: 1 } : null,
          grants: Array.isArray(s.grants) ? s.grants.filter(g => typeof g === 'string') : [], waive: true,
          free: s.free !== false,  // v8.55.1: price travels with the file
          createdAt: s.createdAt || new Date().toLocaleDateString() });
        added++;
      }
      hbStoreSave(); hbRenderList();
      toast(`⬆ Homebrew import: ${added} added${renamed ? `, ${renamed} renamed` : ''}${skipped ? `, ${skipped} skipped` : ''}.`);
    } catch (e) { toast('Import failed: ' + e.message); }
    inp.value = '';
  };
  rd.readAsText(f);
}
