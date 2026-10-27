// =============================================================================
// js/ui/homebrew/monstrous.js
// HOMEBREW / MONSTROUS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Importing a creature as a monstrous character.
//
// KEY NAMES (so you can search for them)
//   functions (1): importCreatureSeed
//
// WHERE IT CAME FROM
//   Gathered from js/rules/06-homebrew-forge-armory-monstrous.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
