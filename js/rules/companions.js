// =============================================================================
// js/rules/companions.js
// COMPANIONS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Familiars, animal companions and mounts: derived statistics and
//   skill perks.
//
// KEY NAMES (so you can search for them)
//   functions (5): companionMasterLevels, progRow, companionDerived,
//   syncOwnedAnimals, buildCompanionSkillPerks
//
// WHERE IT CAME FROM
//   Gathered from js/rules/18-companions.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function companionMasterLevels(c) {
  const arr = migrateLegacyClasses(c);
  const lvlOf = (n) => arr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
  return {
    // Familiar-granting classes STACK (HH p.110).
    familiar: lvlOf('Sorcerer') + lvlOf('Wizard'),
    // Animal companion: Druid-option Cleric level + (Ranger − 3), stacking.
    animal: (c.druidOption ? lvlOf('Cleric') : 0) + Math.max(0, lvlOf('Ranger') - 3),
    // v8.22.0 (2026-09-04 HH edition): the mount keys off Paladin level − 3
    // (the Ranger convention), reading the shared chart's halved column;
    // the mount itself still arrives at Paladin 5.
    mount: lvlOf('Paladin') >= 5 ? lvlOf('Paladin') - 3 : 0,
    mountPaladinLvl: lvlOf('Paladin'),
  };
}
function progRow(table, lvl) {
  let row = null;
  for (const r of table) if (lvl >= r.min) row = r;
  return row;
}
function companionDerived(comp, c) {
  if (comp.kind === 'owned') return { line: 'Owned animal — no class progression; tricks and training by Handle Animal (GM).', specials: '' };
  const ml = companionMasterLevels(c);
  if (comp.kind === 'familiar') {
    const lvl = ml.familiar;
    const row = progRow(FAMILIAR_PROG, lvl) || FAMILIAR_PROG[0];
    const specials = FAMILIAR_PROG.filter(r => lvl >= r.min && r.special).map(r => r.special).join('; ');
    const perk = FAMILIAR_PERKS[comp.species];
    return {
      line: `Master level ${lvl} — natural armor +${row.nac}, Int ${row.int}; HP = ½ master’s (${Math.floor((c.maxHP || 0) / 2)}); BAB = master’s (+${c.bab || 0}); saves = better of its own or master’s base.`,
      specials, perk: perk ? (perk.skill ? `Master: +${perk.v} ${perk.skill}${perk.note ? ' (' + perk.note + ')' : ''}` : perk.save ? `Master: +${perk.v} ${perk.save === 'fort' ? 'Fortitude' : 'Reflex'} saves` : `Master: +${perk.hp} hit points`) + ' — while within 1 mile' : '',
      magicalBeast: 'A magical beast (was an animal); abilities cumulative (HH p.110–111).',
    };
  }
  if (comp.kind === 'animal') {
    const lvl = ml.animal;
    const row = progRow(ANIMAL_COMPANION_PROG, lvl) || ANIMAL_COMPANION_PROG[0];
    const specials = ANIMAL_COMPANION_PROG.filter(r => lvl >= r.min && r.special).map(r => r.special).join('; ');
    return {
      line: `Effective druid level ${lvl} — bonus HD +${row.hd} (d8s, with Con; BAB/saves as a Cleric of its HD), natural armor +${row.nac}, Str & Dex +${row.adj}, bonus tricks ${row.tricks}.`,
      specials, perk: '', magicalBeast: '',
    };
  }
  // mount — v8.22.0: the 2026-09-04 HH folds the Special Mount into the
  // Animal Companion chart at the parenthesized halved values (HH pp.109-110);
  // the old book-gap flag retires. Mounts never gain Improved Evasion.
  {
    const lvl = ml.mount;
    const row = progRow(ANIMAL_COMPANION_PROG, lvl) || ANIMAL_COMPANION_PROG[0];
    const specials = ANIMAL_COMPANION_PROG
      .filter(r => lvl >= r.min && r.special && r.special !== 'Improved Evasion')
      .map(r => r.special).join('; ');
    return {
      line: `Effective level ${lvl} (Paladin ${ml.mountPaladinLvl} − 3) — bonus HD +${row.mhd} (d8s, with Con; BAB/saves as a Cleric of its HD), natural armor +${row.mnac}, Str & Dex +${row.madj}, bonus tricks ${row.tricks} (mount column, HH pp.109-110).`,
      specials,
      perk: '',
      magicalBeast: 'Fully trained (every Handle Animal trick). If slain: no new mount for 30 days or until a Paladin level is gained; −1 attack/damage meanwhile. Mounts do not gain Improved Evasion (chart footnote).',
    };
  }
}
// v9.4.0 (Adam's equipment review): PURCHASED animals (HH p.294 — horses,
// ponies, war-trained mounts, dogs, donkeys/mules) are OWNED companions:
// the Companions card shows their FF stat block with no class progression
// (unlike a Paladin's special mount / a Druid's animal companion). The card
// is tied to its Gear item: buying adds it, selling/removing drops it.
function syncOwnedAnimals(c) {
  if (!c) return false;
  let changed = false; c.companions = c.companions || [];
  const items = getCharItems(c).filter(it => it.catalogue === 'equipment' && (getCatalogueEntry('equipment', it.ref) || {}).animal);
  for (const it of items) {
    const def = getCatalogueEntry('equipment', it.ref);
    const sp = equipParamSub(def.animal, it);
    if (!sp || sp.includes('$')) continue;
    const comp = c.companions.find(x => x.kind === 'owned' && x.itemId === it.id);
    if (!comp) { c.companions.push({ id: 'comp_' + Math.random().toString(36).slice(2, 8), kind: 'owned', species: sp, name: '', itemId: it.id }); changed = true; }
    else if (comp.species !== sp) { comp.species = sp; changed = true; }
  }
  const ids = new Set(items.map(x => x.id));
  const before = c.companions.length;
  c.companions = c.companions.filter(x => x.kind !== 'owned' || ids.has(x.itemId));
  return changed || c.companions.length !== before;
}
// Familiar master perks → the master's skill totals (saves handled in
// buildClassFeatureSaveBonuses).
function buildCompanionSkillPerks(c) {
  const out = {};
  for (const comp of (c && c.companions) || []) {
    if (comp.kind !== 'familiar') continue;
    const p = FAMILIAR_PERKS[comp.species];
    if (p && p.skill) (out['skill:' + p.skill] = out['skill:' + p.skill] || []).push({
      type: 'untyped', source: 'companion:' + comp.id, value: p.v,
      label: `${comp.species} familiar${p.note ? ' (' + p.note + ')' : ''} — while within 1 mile`,
    });
  }
  return out;
}
