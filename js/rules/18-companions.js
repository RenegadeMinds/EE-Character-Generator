// =============================================================================
// js/rules/18-companions.js
// COMPANIONS
// =============================================================================
//
// WHAT'S IN HERE
//   Familiars, animal companions and mounts: species lists, progressions,
//   derived stats, and the companion panels.
//
// KEY NAMES (so you can search for them)
//   tables/objects: FAMILIAR_SPECIES, ANIMAL_COMPANION_SPECIES, MOUNT_SPECIES,
//   FAMILIAR_PERKS, ANIMAL_COMPANION_PROG, FAMILIAR_PROG
//   functions (26): companionMasterLevels, progRow, companionDerived,
//   syncOwnedAnimals, addCompanion, removeCompanion, renameCompanion,
//   buildCompanionSkillPerks, renderCompanions, setRangerCombatStyle,
//   toggleItemEquipped, setItemMastercraft, addGadgetToItem,
//   removeGadgetFromItem, toggleGearMagicSlots, toggleSheetMagicSlots,
//   toggleGadgetCtl, toggleItemCtl, magicSlotRowsHTML, addItemFromPicker,
//   addGadgetFromPicker, itemDisplayName, renderEquippedItemChip,
//   gadgetTooltip, renderInventoryList, renderGear
//
// LOAD ORDER
//   File 18 of 68. index.html loads it after
//   js/rules/17-per-diem-and-class-choices.js and before
//   js/rules/19-bonus-aggregator-and-stat-block.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 13079-13983 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 13079-13983; unchanged below this line ----
// ============================================================================
// v8.8.3 COMPANIONS (Adam's request): basic Familiar / Animal Companion /
// Special Mount records — FF base stats where extractable, HH pp.109–111
// progression by the master's effective level. Storage: c.companions =
// [{id, kind, species, name}] (lazy).
// ============================================================================
const FAMILIAR_SPECIES = ['Bat', 'Cat', 'Hawk', 'Lizard', 'Owl', 'Rat', 'Raven', 'Viper (Tiny)', 'Toad', 'Weasel'];
const ANIMAL_COMPANION_SPECIES = ['Badger', 'Camel', 'Dire Rat', 'Dog', 'Riding Dog', 'Eagle', 'Hawk', 'Horse (light)', 'Horse (heavy)', 'Owl', 'Pony', 'Viper (Small)', 'Viper (Medium)', 'Wolf', 'Crocodile', 'Porpoise', 'Shark (Medium)', 'Squid'];
const MOUNT_SPECIES = ['Warhorse (heavy)', 'Warpony', 'Warhorse (light)'];
// Master perks (HH p.110): apply while the familiar is within 1 mile
// (Alertness needs arm's reach). Skill/save perks are folded into the
// master's numbers with the condition in the label.
const FAMILIAR_PERKS = {
  'Bat': { skill: 'Listen', v: 3 }, 'Cat': { skill: 'Move Silently', v: 3 },
  'Hawk': { skill: 'Spot', v: 3, note: 'in bright light' }, 'Lizard': { skill: 'Climb', v: 3 },
  'Owl': { skill: 'Spot', v: 3, note: 'in shadows' }, 'Rat': { save: 'fort', v: 2 },
  'Raven': { skill: 'Appraise', v: 3, note: 'speaks one language (Su)' }, 'Viper (Tiny)': { skill: 'Bluff', v: 3 },
  'Toad': { hp: 3 }, 'Weasel': { save: 'ref', v: 2 },
};
// HH p.109 Animal Companion / Special Mount progression (2026-09-04 edition:
// the section is now "Animal Companions, Special Mounts, and Familiars" and
// the mount shares this chart at the parenthesized HALVED values — mhd/mnac/
// madj below, copied from print, not derived; Str/Dex +1 row is shared,
// tricks are shared, and mounts never get Improved Evasion per the chart's
// footnote). Effective level: Druid level, or Ranger/Paladin level − 3.
const ANIMAL_COMPANION_PROG = [
  { min: 1,  hd: 0,  nac: 0,  adj: 0, tricks: 1, special: 'Link, share spells',   mhd: 0, mnac: 0, madj: 0 },
  { min: 3,  hd: 2,  nac: 2,  adj: 1, tricks: 2, special: 'Evasion',              mhd: 1, mnac: 1, madj: 1 },
  { min: 6,  hd: 4,  nac: 4,  adj: 2, tricks: 3, special: 'Devotion',             mhd: 2, mnac: 2, madj: 1 },
  { min: 9,  hd: 6,  nac: 6,  adj: 3, tricks: 4, special: 'Multiattack',          mhd: 3, mnac: 3, madj: 2 },
  { min: 12, hd: 8,  nac: 8,  adj: 4, tricks: 5, special: '',                     mhd: 4, mnac: 4, madj: 2 },
  { min: 15, hd: 10, nac: 10, adj: 5, tricks: 6, special: 'Improved Evasion',     mhd: 5, mnac: 5, madj: 3 },
  { min: 18, hd: 12, nac: 12, adj: 6, tricks: 7, special: '',                     mhd: 6, mnac: 6, madj: 3 },
];
// HH p.111 Familiar progression (by master's level).
const FAMILIAR_PROG = [
  { min: 1,  nac: 1,  int: 6,  special: 'Alertness (arm’s reach), improved evasion, share spells, empathic link' },
  { min: 3,  nac: 2,  int: 7,  special: 'Deliver touch spells' },
  { min: 5,  nac: 3,  int: 8,  special: 'Speak with master' },
  { min: 7,  nac: 4,  int: 9,  special: 'Speak with animals of its kind' },
  { min: 9,  nac: 5,  int: 10, special: '' },
  { min: 11, nac: 6,  int: 11, special: 'Spell resistance = master level + 5' },
  { min: 13, nac: 7,  int: 12, special: 'Scry on familiar 1/day' },
  { min: 15, nac: 8,  int: 13, special: '' },
  { min: 17, nac: 9,  int: 14, special: '' },
  { min: 19, nac: 10, int: 15, special: '' },
];
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
function addCompanion(kind, species) {
  const c = chars.find(x => x.id === curId); if (!c || !species) return;
  if (!c.companions) c.companions = [];
  c.companions.push({ id: 'comp_' + Math.random().toString(36).slice(2, 8), kind, species, name: '' });
  logAct(`🐾 Gained a ${kind === 'familiar' ? 'familiar' : kind === 'mount' ? 'special mount' : 'animal companion'}: ${species}.`);
  save(); renderSheet(); renderSkills();
}
function removeCompanion(id) {
  const c = chars.find(x => x.id === curId); if (!c || !c.companions) return;
  const comp = c.companions.find(x => x.id === id);
  // v9.4.0: an owned animal's card and its Gear item go together (sold, lost, freed).
  if (comp && comp.kind === 'owned') { c.items = (c.items || []).filter(i => i.id !== comp.itemId); c.companions = c.companions.filter(x => x.id !== id); logAct(`🐴 ${comp.name || comp.species} — no longer owned.`); save(); renderSheet(); renderGear(); return; }
  if (comp && comp.kind === 'familiar' && !confirm('Dismissing/losing a familiar: DC 15 Fort save or lose 200 XP per level (half on success); no replacement for a year and a day (HH p.102). Remove?')) return;
  c.companions = c.companions.filter(x => x.id !== id);
  save(); renderSheet(); renderSkills();
}
function renameCompanion(id) {
  const c = chars.find(x => x.id === curId); if (!c || !c.companions) return;
  const comp = c.companions.find(x => x.id === id); if (!comp) return;
  const nm = prompt('Companion name:', comp.name || '');
  if (nm !== null) { comp.name = nm.trim(); save(); renderSheet(); }
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
function renderCompanions(c) {
  const host = document.getElementById('sh-companions');
  if (!host) return;
  if (syncOwnedAnimals(c)) save();   // v9.4.0: self-heal owned-animal cards
  const ml = companionMasterLevels(c);
  const comps = c.companions || [];
  const adders = [];
  if (ml.familiar > 0 && !comps.some(x => x.kind === 'familiar')) adders.push(['familiar', 'Familiar', FAMILIAR_SPECIES]);
  if (ml.animal > 0 && !comps.some(x => x.kind === 'animal')) adders.push(['animal', 'Animal Companion', ANIMAL_COMPANION_SPECIES]);
  if (ml.mount > 0 && !comps.some(x => x.kind === 'mount')) adders.push(['mount', 'Special Mount', MOUNT_SPECIES]);
  if (!comps.length && !adders.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const cards = comps.map(comp => {
    const base = COMPANION_BASE_STATS[comp.species] || null;
    const d = companionDerived(comp, c);
    const baseLines = base ? (base.ref
      ? `<div style="opacity:.7;">Base stats: ${escapeHTML(base.ref)}</div>`
      : `<div style="opacity:.85;">${escapeHTML(base.size)} · HD ${escapeHTML(base.hd)} · AC ${escapeHTML(base.ac)} · Spd ${escapeHTML(base.spd || '—')}<br>
         Atk ${escapeHTML(base.fatk || base.atk)} · Saves ${escapeHTML(base.saves || '—')}<br>
         ${escapeHTML(base.attrs || '')}${base.sq ? `<br>SQ: ${escapeHTML(base.sq)}` : ''}${base.carry ? `<br>Carrying: ${escapeHTML(base.carry)}` : ''}${base.sa && base.sa !== '—' && base.sa !== '-' ? ` · SA: ${escapeHTML(base.sa)}` : ''}
         <span style="opacity:var(--o55);color:var(--dim);">(FF p.${base.page}${comp.kind === 'owned' ? '' : ' — base animal, before the adjustments below'})</span></div>`)
      : `<div style="opacity:.6;">Base stats: see the Foe Folio.</div>`;
    const kindLbl = comp.kind === 'familiar' ? '🦉 Familiar' : comp.kind === 'mount' ? '🐎 Special Mount' : comp.kind === 'owned' ? '🐴 Owned animal' : '🐾 Animal Companion';
    return `<div style="border:1px solid rgba(200,151,30,.25);border-radius:3px;padding:5px 8px;margin:4px 0;font-size:11px;line-height:1.5;">
      <b style="color:rgba(120,175,205,.95);">${kindLbl}: ${escapeHTML(comp.name || comp.species)}</b>${comp.name ? ` <span style="opacity:var(--o60);color:var(--dim);">(${escapeHTML(comp.species)})</span>` : ''}
      <span style="cursor:pointer;font-size:10px;opacity:.6;margin-left:6px;" onclick="renameCompanion('${comp.id}')" title="Name this companion">✎</span>
      <span style="cursor:pointer;font-size:10px;opacity:.6;" onclick="removeCompanion('${comp.id}')" title="Remove">✕</span>
      ${baseLines}
      <div style="color:var(--g85);">${escapeHTML(d.line)}</div>
      ${d.specials ? `<div>Special: ${escapeHTML(d.specials)}</div>` : ''}
      ${d.perk ? `<div style="color:#78afcd;">${escapeHTML(d.perk)}</div>` : ''}
      ${d.magicalBeast ? `<div style="opacity:.65;">${escapeHTML(d.magicalBeast)}</div>` : ''}
    </div>`;
  }).join('');
  const adderHTML = adders.map(([kind, lbl, species]) =>
    `<span style="font-size:11px;">${lbl}: <select onchange="if(this.value){addCompanion('${kind}', this.value);this.value='';}" style="font-size:11px;"><option value="">— choose species —</option>${species.map(s => `<option>${escapeHTML(s)}</option>`).join('')}</select></span>`
  ).join(' · ');
  host.innerHTML = `<div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--bronze);margin-bottom:4px;">🐾 Companions</div>${cards}${adderHTML ? `<div style="margin-top:4px;">${adderHTML}</div>` : ''}`;
}

// v8.6.1: Ranger Combat Style choice (HH: picked at Ranger 2). Lazy field —
// legacy characters simply show the picker until a style is chosen.
function setRangerCombatStyle(v) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.rangerCombatStyle = v || null;
  save(); renderGear();
  if (v) toast(v === 'twf' ? 'Combat style: two-weapon — virtual TWF applies in light or no armor.' : 'Combat style: archery — virtual Rapid Shot in light or no armor.');
}

function toggleItemEquipped(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  if (it.catalogue === 'equipment') {
    // v9.2.0: wearable gear has a home body slot; everything else is owned.
    const gd = gearDef(it);
    if (!gd || !gd.slot) { toast('This is owned, not worn — no toggle needed.'); return; }
    it.slot = gd.slot;
    if (it.equipped) {   // taking it off ends any Boon it powers
      it.equipped = false;
      if (Array.isArray(c.activeEffects)) c.activeEffects = c.activeEffects.filter(a => a.gearItemId !== it.id);
      save(); renderGear(); renderSheet(); renderSkills(); return;
    }
  }
  const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
  if (!it.equipped && slotDef) {
    // v8.8.0 (Adam's Advantages pass): Lost Arm — one arm means no
    // two-handed weapons (the entry's own restriction, now enforced via the
    // handedness measurable) and nothing in the Off Hand at all.
    // v8.91.0 (task 3): a cybernetic Prosthetic Arm REPLACES the lost arm
    // (HH p.332 Replacements + the drawback's own Special line) — the off
    // hand and two-handed weapons return with it.
    if (slotDef.category === 'held' && typeof offHandAvailable === 'function' && !offHandAvailable(c)) {
      const defLA = it.catalogue === 'weapon' ? getCatalogueEntry('weapon', it.ref) : null;
      if (defLA && weaponHands(defLA) === 2) { toast(`${it.ref} needs two hands — Lost Arm (drawback). Install a cybernetic Prosthetic Arm (🦾 Cybernetics) to restore the arm; GM may allow improvised bracing.`); return; }
      if (it.slot === 'off_hand') { toast('Off Hand unavailable — Lost Arm (drawback). Install a cybernetic Prosthetic Arm (🦾 Cybernetics) to restore it.'); return; }
    }
    // v8.6.1: two-handed occupancy checks (see weaponHands above).
    if (slotDef.category === 'held') {
      const def = it.catalogue === 'weapon' ? getCatalogueEntry('weapon', it.ref) : null;
      if (def && weaponHands(def) === 2) {
        if (it.slot === 'off_hand') { toast(`${it.ref} needs both hands — equip it in the Main Hand.`); return; }
        if (c.items.some(i => i.slot === 'off_hand' && i.equipped && i.id !== it.id)) { toast(`${it.ref} needs both hands — free the Off Hand first.`); return; }
      }
      const th = twoHandedEquipped(c);
      if (it.slot === 'off_hand' && th) { toast(`Off Hand is claimed by the two-handed ${th.ref}. Unequip it first.`); return; }
    }
    // v9.6.0 (§255, Adam's chart): body-slot occupancy is enforced per
    // GROUP — Gloves and Gauntlets share the hands, a hat and a helmet the
    // head, a torc the neck. Two rings; the Back is the house addendum.
    const gid = slotDef.category === 'body' ? slotGroupIdOf(it.slot) : null;
    if (gid) {
      const g = SLOT_GROUPS[gid];
      const effSlotOf = (i) => i.catalogue === 'equipment' ? ((gearDef(i) || {}).slot || i.slot) : i.slot;
      const worn = c.items.filter(i => i.id !== it.id && i.equipped && g.slots.includes(effSlotOf(i)));
      if (worn.length >= g.cap) { toast(`${g.label} is occupied by ${itemDisplayName(worn[0])}${g.cap > 1 ? ` (and ${worn.length - 1} more; capacity ${g.cap})` : ''}. One item per body slot — remove it first.`); return; }
      // canon: one robe OR suit of armor on the body
      if (g.armorShares && c.items.some(i => i.catalogue === 'armor' && i.equipped && i.slot === 'armor')) { toast('The Body is occupied by a suit of armor — a robe and armor cannot be worn together (one robe OR suit of armor on the body).'); return; }
    } else {
      const sameSlot = c.items.filter(i => i.slot === it.slot && i.equipped && i.id !== it.id);
      if (sameSlot.length >= (slotDef.capacity || 1)) { toast(`${slotDef.label} slot is full (capacity ${slotDef.capacity}). Unequip something first.`); return; }
      // canon, the other direction: donning armor is blocked by a worn robe
      if (it.slot === 'armor' && c.items.some(i => i.id !== it.id && i.equipped && ((i.catalogue === 'equipment' ? ((gearDef(i) || {}).slot || i.slot) : i.slot) === 'robe'))) { toast('The Body is occupied by a robe — a robe and a suit of armor cannot be worn together.'); return; }
    }
  }
  it.equipped = !it.equipped;
  save(); renderGear(); renderSheet(); renderSkills();
}

async function setItemMastercraft(itemId, bonus, target) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const cap = maxMastercraftBonus(scenarioTechScale(c));
  bonus = Math.max(0, Math.min(bonus, cap));
  // v8.93.1 (Adam's clarification): raising the grade charges the Purchase
  // DC DIFFERENCE through the paid-or-gift prompt; cancel backs out.
  const defU = getCatalogueEntry(it.catalogue, it.ref);
  const prevMc = it.mastercraft ? { ...it.mastercraft } : null;
  const oldDC = (defU && typeof itemEffectivePDC === 'function') ? itemEffectivePDC(it, defU).dc : 0;
  if (bonus <= 0) {
    it.mastercraft = null;
  } else {
    const kind = mastercraftKindFor(it.catalogue);
    const rule = kind && MASTERCRAFT_RULES.targets_by_kind[kind];
    const resolvedTarget = (rule && rule.choose_one) ? (target || (it.mastercraft && it.mastercraft.target) || rule.choose_one[0]) : (rule ? 'defense' : null);
    it.mastercraft = { bonus, target: resolvedTarget };
  }
  if (defU && typeof chargeUpgradeDifference === 'function') {
    const newDC = itemEffectivePDC(it, defU).dc;
    if (!(await chargeUpgradeDifference(c, it, oldDC, newDC, `Mastercraft +${bonus}`))) {
      it.mastercraft = prevMc; renderGear(); return; // backed out — nothing saved
    }
  }
  const cap2 = gadgetSlotCount(it, scenarioTechScale(c));
  if (it.gadgets && it.gadgets.length > cap2) it.gadgets = it.gadgets.slice(0, cap2);
  save(); renderGear(); renderSheet(); renderSkills();
  // v8.93.0 (Adam's task 2): the mastercraft tier carries a Purchase DC
  // modifier (HH p.275) — say what the item is now WORTH. Buying it at this
  // grade costs the new DC; upgrading an owned piece is a Craft project
  // (XP + Craft DC per the tier) or a GM-priced trade-in.
  const defMc = getCatalogueEntry(it.catalogue, it.ref);
  if (defMc && typeof itemEffectivePDC === 'function') {
    const e2 = itemEffectivePDC(it, defMc);
    if (e2.parts.length) toast(`${it.ref}: effective Purchase DC ${e2.dc} (${e2.parts.join('; ')}).`);
  }
}

async function addGadgetToItem(itemId, gadgetName) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it) return;
  const cap = gadgetSlotCount(it, scenarioTechScale(c));
  if (!it.gadgets) it.gadgets = [];
  if (it.gadgets.length >= cap) { toast(`No free gadget slots (${it.gadgets.length}/${cap}).`); return; }
  const g = GADGETS_CATALOG.find(x => x.name === gadgetName && x.type === it.catalogue);
  if (!g) { toast('Unknown gadget.'); return; }
  if (!g.multi_select && it.gadgets.some(x => x.ref === gadgetName)) { toast(`${gadgetName} already attached (not multi-select).`); return; }
  // v8.6.1 (Adam's addendum): autofire consumes 10 rounds — flag the
  // discrepancy at module-add time when the host magazine can't hold them.
  if (gadgetName === 'Autofire Module') {
    const def = getCatalogueEntry('weapon', it.ref);
    const mag = def && effectiveMagazine(it, def);  // Expanded Magazine counts
    if (mag && mag < 10) {
      if (!(await confirmModal(`${it.ref}'s magazine holds only ${mag} rounds — autofire requires 10 loaded. Attach the Autofire Module anyway as a GM override? (The Autofire mode will carry a ⚠ magazine note.)`, { title: '⚑ Magazine too small for autofire' }))) return;
    }
  }
  // v8.6.1 (Adam): Alternate Weapon integrates a second, separately-purchased
  // weapon into the host (HH p.263: usable at any time; detachable or fixed,
  // chosen at purchase; like-type mixing is a book SUGGESTION, not enforced —
  // GM domain). Pick the weapon + the fixed/detachable choice here; the
  // integrated weapon rides the gadget record and gets its own row on the
  // combat dashboard while the host is equipped.
  if (gadgetName === 'Alternate Weapon') {
    const pick = await new Promise(res => openChoiceModal('Alternate Weapon — integrate which weapon? (Purchased separately at modified cost — GM adjudicates. The book suggests mixing like types: energy with energy, ballistic with ballistic.)',
      WEAPONS_CATALOG.filter(w => w.name !== it.ref).map(w => `${w.name} (TS${w.tl}${w.dmg_m ? ', ' + w.dmg_m : ''})`), res));
    if (!pick) return;
    const altName = pick.replace(/\s*\([^)]+\)\s*$/, '').trim();
    const mount = await new Promise(res => openChoiceModal(`${altName} — mounting? (Chosen at purchase, per the book.)`,
      ['Fixed — permanently integrated', 'Detachable — can be physically separated'], res));
    if (!mount) return;
    // v8.93.1: the Alternate Weapon gadget's own DC mod charges like any
    // other upgrade (the integrated weapon itself is still bought
    // separately at modified cost — GM adjudicates, per the book).
    const defAW = getCatalogueEntry(it.catalogue, it.ref);
    const oldDCaw = (defAW && typeof itemEffectivePDC === 'function') ? itemEffectivePDC(it, defAW).dc : 0;
    it.gadgets.push({ ref: gadgetName, altWeapon: altName, detachable: mount.startsWith('Detachable') });
    if (defAW && typeof chargeUpgradeDifference === 'function') {
      const newDCaw = itemEffectivePDC(it, defAW).dc;
      if (!(await chargeUpgradeDifference(c, it, oldDCaw, newDCaw, 'Alternate Weapon mount'))) { it.gadgets.pop(); renderGear(); return; }
    }
    save(); renderGear(); renderSheet(); renderSkills();
    toast(`${altName} integrated into ${it.ref} (${mount.startsWith('Detachable') ? 'detachable' : 'fixed'}). The ${altName} itself is purchased separately at modified cost — GM adjudicates.`);
    return;
  }
  // v8.93.1 (Adam's clarification): the gadget's Purchase DC modifier
  // CHARGES the difference — paid-or-gift prompt; cancel backs out.
  const defG = getCatalogueEntry(it.catalogue, it.ref);
  const oldDCg = (defG && typeof itemEffectivePDC === 'function') ? itemEffectivePDC(it, defG).dc : 0;
  it.gadgets.push({ ref: gadgetName });
  if (defG && typeof chargeUpgradeDifference === 'function') {
    const newDCg = itemEffectivePDC(it, defG).dc;
    if (!(await chargeUpgradeDifference(c, it, oldDCg, newDCg, gadgetName))) {
      it.gadgets.pop(); renderGear(); return; // backed out — nothing saved
    }
  }
  save(); renderGear(); renderSheet(); renderSkills();
  if (defG && typeof itemEffectivePDC === 'function') {
    const eG = itemEffectivePDC(it, defG);
    if (eG.parts.length) toast(`${gadgetName} attached — ${it.ref}: effective Purchase DC ${eG.dc} (${eG.parts.join('; ')}).`);
  }
}

function removeGadgetFromItem(itemId, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = (c.items || []).find(i => i.id === itemId); if (!it || !it.gadgets) return;
  it.gadgets.splice(idx, 1);
  save(); renderGear(); renderSheet(); renderSkills();
}

// v8.56.0 (playtest issue #3d/#3b): section toggles + gadget-control state.
function toggleGearMagicSlots() {
  const w = document.getElementById('gear-magic-slots-wrap'), ch = document.getElementById('gear-magic-slots-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (ch) ch.textContent = open ? '▾' : '▸';
}
function toggleSheetMagicSlots() {
  const w = document.getElementById('sh-magic-slots-wrap'), ch = document.getElementById('sh-magic-slots-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (ch) ch.textContent = open ? '▾' : '▸';
}
const _gadgetOpen = new Set();
function toggleGadgetCtl(itemId) {
  if (_gadgetOpen.has(itemId)) _gadgetOpen.delete(itemId); else _gadgetOpen.add(itemId);
  if (typeof renderGear === 'function') renderGear();
}
// v9.6.0 (§255, Adam): the customization controls (Enchant / Mastercraft)
// and the provenance + Purchase DC line collapse INTO the item name — the
// name is the toggle, the decorated result ("+2 Mastercrafted (Damage)
// Plasma Pistol") is the summary.
const _itemOpen = new Set();
function toggleItemCtl(itemId) {
  if (_itemOpen.has(itemId)) _itemOpen.delete(itemId); else _itemOpen.add(itemId);
  if (typeof renderGear === 'function') renderGear();
}
// v8.56.0 (playtest issue #3d): the body-slot rows, buildable for the Gear
// dashboard (interactive) OR the Sheet's read-only reference copy.
function magicSlotRowsHTML(c, interactive) {
  // v9.6.0 (§255, Adam's chart): the dashboard shows the REAL body — the
  // canonical twelve places plus the Back (house addendum), occupancy per
  // group. The finer slot names (hat vs helmet, gloves vs gauntlets) remain
  // as enchantment affinities in the hover and in the empty-row hint.
  const slotById = (id) => ITEM_SLOTS.find(s => s.id === id) || {};
  const chipOf = (it) => interactive
    ? renderEquippedItemChip(it)
    : `<span style="display:inline-flex;align-items:center;background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.25);border-radius:3px;padding:2px 7px;font-size:11px;margin-right:4px;">${escapeHTML(itemDisplayName(it))}</span>`;
  const rows = Object.keys(SLOT_GROUPS).map(gid => {
    const g = SLOT_GROUPS[gid];
    const inGroup = (i) => (i.catalogue === 'magic' && g.slots.includes(i.slot)) || (i.catalogue === 'equipment' && g.slots.includes((gearDef(i) || {}).slot));
    const equipped = c.items.filter(i => inGroup(i) && i.equipped);
    const armorWorn = g.armorShares && c.items.some(i => i.catalogue === 'armor' && i.equipped && i.slot === 'armor');
    const free = g.cap - equipped.length - (armorWorn ? 1 : 0);
    const unequipped = c.items.filter(i => inGroup(i) && !i.equipped);
    const chips = equipped.map(chipOf).join('')
      + (armorWorn ? `<span style="display:inline-flex;align-items:center;background:rgba(120,145,170,.1);border:1px solid rgba(120,145,170,.3);border-radius:3px;padding:2px 7px;font-size:11px;margin-right:4px;" title="One robe OR suit of armor on the body — the worn armor occupies this place.">🛡 suit of armor</span>` : '');
    const eqSel = (interactive && free > 0 && unequipped.length)
      ? `<select onchange="if(this.value){toggleItemEquipped(this.value);this.value='';}" style="font-size:11px;margin-left:6px;"><option value="">+ equip…</option>${unequipped.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('')}</select>`
      : '';
    const empty = (!equipped.length && !unequipped.length && !armorWorn)
      ? `<span style="opacity:.45;font-size:11px;font-style:italic;">${escapeHTML(g.slots.map(id => slotById(id).label || id).join(' / '))}</span>` : '';
    const affin = g.slots.map(id => { const s = slotById(id); return s.affinity ? `${s.label}: ${s.affinity}` : s.label; }).filter(Boolean).join(' · ');
    return `<tr><td style="color:var(--g70);${affin ? 'cursor:help;' : ''}" title="${escapeHTML(affin)}">${g.label}${g.cap > 1 ? ` <span style="opacity:.5;font-size:10px;">(×${g.cap})</span>` : ''}${g.house ? ' <span style="opacity:.5;font-size:9px;" title="House addendum — not in the canonical twelve.">†</span>' : ''}</td><td>${chips}${eqSel}${empty}</td></tr>`;
  });
  // Imbued tattoos take no body slot (temporary; bodily limit) — their row rides below the groups.
  const t = ITEM_SLOTS.find(s => s.id === 'tattoo');
  if (t) {
    const inSlot = (i) => (i.catalogue === 'magic' && i.slot === 'tattoo') || (i.catalogue === 'equipment' && (gearDef(i) || {}).slot === 'tattoo');
    const equipped = c.items.filter(i => inSlot(i) && i.equipped);
    const unequipped = c.items.filter(i => inSlot(i) && !i.equipped);
    const eqSel = (interactive && equipped.length < (t.capacity || 1) && unequipped.length)
      ? `<select onchange="if(this.value){toggleItemEquipped(this.value);this.value='';}" style="font-size:11px;margin-left:6px;"><option value="">+ equip…</option>${unequipped.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('')}</select>` : '';
    const empty = !equipped.length && !unequipped.length ? `<span style="opacity:.45;font-size:11px;font-style:italic;">${escapeHTML(t.affinity || '')}</span>` : '';
    rows.push(`<tr><td style="color:var(--g70);" title="${escapeHTML(t.note || '')}">${t.label} <span style="opacity:.5;font-size:10px;">(×${t.capacity}, temporary — takes no body slot)</span></td><td>${equipped.map(chipOf).join('')}${eqSel}${empty}</td></tr>`);
  }
  return rows.join('');
}
function addItemFromPicker(catalogue) {
  const sel = document.getElementById('gear-add-' + catalogue + '-sel');
  const ref = sel && sel.value;
  // v8.56.0 (playtest issue #3a): pickers now default to a no-selection
  // placeholder — say so instead of silently doing nothing.
  if (!ref) { toast('Pick an item from the list first.'); return; }
  let slot = 'carried';
  if (catalogue === 'weapon') { const s = document.getElementById('gear-add-weapon-slot'); slot = s ? s.value : 'main_hand'; }
  else if (catalogue === 'armor') { const def = getCatalogueEntry('armor', ref); slot = (def && def.type === 'shield') ? 'off_hand' : 'armor'; }
  addItemToChar(catalogue, ref, slot);
}

function addGadgetFromPicker(itemId) {
  const sel = document.getElementById('gadgetsel-' + itemId);
  const name = sel && sel.value; if (!name) return;
  addGadgetToItem(itemId, name);
}

// ----- Rendering -----

// v8.7.0 (Adam): custom names ride everywhere the item shows — a player's
// "Frostbite" over "+2 Icy Burst Keen Longsword". Mechanics key off it.ref,
// so a rename is pure flavor; enchantDisplayName resolves customName first.
function itemDisplayName(it) {
  // v9.6.0 (§255, Adam): the grade is part of the NAME — "+2 Mastercrafted
  // (Damage) Plasma Pistol". A custom name stays pure flavor and overrides
  // all decoration (the base ref rides in the small note beside it).
  const base = (it.customName || it.enchant) ? enchantDisplayName(it) : it.ref;
  if (it.customName) return base;
  const mc = it.mastercraft && it.mastercraft.bonus > 0
    ? `+${it.mastercraft.bonus} Mastercrafted${it.mastercraft.target ? ` (${it.mastercraft.target.charAt(0).toUpperCase() + it.mastercraft.target.slice(1)})` : ''} `
    : '';
  return mc + base;
}

function renderEquippedItemChip(it) {
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.25);border-radius:3px;padding:2px 7px;font-size:11px;margin-right:4px;">
    ${escapeHTML(itemDisplayName(it))}
    <button class="btn btn-sm" style="padding:0 5px;font-size:9px;" onclick="toggleItemEquipped('${it.id}')" title="Unequip">✕</button>
  </span>`;
}

// v8.5.2: hover-tooltip text for a gadget (effect summary + restriction),
// reused for the attached-gadget chip and the "+ Gadget" picker options.
// Built from gadget_effects.json's effect.text (an authored paraphrase of
// the HH description, not verbatim rulebook text — see equipment_substrate/
// gadget_effects.json _meta and Adam's earlier copyright-caution call).
function gadgetTooltip(g) {
  const parts = [g.effect ? g.effect.text : ''];
  if (g.restriction) parts.push('Restriction: ' + g.restriction);
  return parts.filter(Boolean).join('\n\n');
}

function renderInventoryList(items, techScale, catalogue) {
  if (!items.length) return `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">None owned yet.</div>`;
  return items.map(it => {
    const def = getCatalogueEntry(catalogue, it.ref);
    if (!def) return '';
    const cap = maxMastercraftBonus(techScale);
    const mcOpts = Array.from({ length: cap + 1 }, (_, n) => {
      const sel = (it.mastercraft && it.mastercraft.bonus === n) || (!it.mastercraft && n === 0);
      return `<option value="${n}" ${sel ? 'selected' : ''}>${n === 0 ? 'None' : '+' + n}</option>`;
    }).join('');
    const kind = mastercraftKindFor(catalogue);
    const rule = kind && MASTERCRAFT_RULES.targets_by_kind[kind];
    const showTargetChoice = rule && rule.choose_one && it.mastercraft && it.mastercraft.bonus > 0;
    const targetHtml = showTargetChoice
      ? rule.choose_one.map(t => `<label style="font-size:10px;margin-left:6px;"><input type="radio" name="mct-${it.id}" value="${t}" ${it.mastercraft.target === t ? 'checked' : ''} onchange="setItemMastercraft('${it.id}', ${it.mastercraft.bonus}, '${t}')"> ${t}</label>`).join('')
      : '';
    const mcControl = cap > 0
      ? `Mastercraft: <select style="font-size:10px;" onchange="setItemMastercraft('${it.id}', parseInt(this.value,10), null)">${mcOpts}</select>${targetHtml}`
      : `<span style="font-size:10px;opacity:.4;" title="Scenario Tech Scale too low for mastercrafting.">mastercraft n/a</span>`;

    let gadgetHtml = '';
    let gadgetDossierCtl = '';   // v9.6.1 (§256): the 0-gadget add control rides the dossier
    if (catalogue !== 'equipment') {
      const gcap = gadgetSlotCount(it, techScale);
      const filled = (it.gadgets || []).map((g, idx) => {
        const gd = GADGETS_CATALOG.find(x => x.name === g.ref && x.type === catalogue);
        const tip = gd ? gadgetTooltip(gd) : '';
        const gLabel = g.altWeapon ? `${g.ref}: ${g.altWeapon} (${g.detachable ? 'detachable' : 'fixed'})` : g.ref;
        return `<span title="${escapeHTML(tip)}" style="font-size:10px;background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);border-radius:3px;padding:1px 5px;margin-right:3px;cursor:help;">${escapeHTML(gLabel)} <button class="btn btn-sm" style="padding:0 3px;font-size:9px;" onclick="removeGadgetFromItem('${it.id}', ${idx})">✕</button></span>`;
      }).join('');
      const elig = eligibleGadgets(catalogue, def, techScale).filter(g => g.multi_select || !(it.gadgets || []).some(x => x.ref === g.name));
      // v8.56.0 (playtest issue #3b): the gadget picker hides behind a
      // "⚙ Gadgets?" toggle per item — attached gadgets stay visible as
      // chips; the add-controls are opt-in instead of perpetual noise.
      const gOpen = _gadgetOpen.has(it.id);
      const addCtl = (it.gadgets || []).length < gcap
        ? (gOpen
          ? `<select id="gadgetsel-${it.id}" style="font-size:10px;"><option value="">— select a gadget —</option>${elig.map(g => `<option value="${escapeHTML(g.name)}" title="${escapeHTML(gadgetTooltip(g))}">${escapeHTML(g.name)} (DC ${Array.isArray(g.purchase_dc_mod) ? g.purchase_dc_mod.join('/') : g.purchase_dc_mod})</option>`).join('')}</select> <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;" onclick="addGadgetFromPicker('${it.id}')">+ Gadget</button> <button class="btn btn-sm" style="font-size:9px;padding:1px 5px;" onclick="toggleGadgetCtl('${it.id}')" title="Hide the gadget picker">▴</button>`
          : `<button class="btn btn-sm" style="font-size:9px;padding:1px 6px;" onclick="toggleGadgetCtl('${it.id}')" title="Attach technological gadgets to this item (slots: 1 + mastercraft bonus; Tech Scale gates apply)">⚙ Gadgets? (${(it.gadgets || []).length}/${gcap})</button>`)
        : '';
      // v9.3.0: mounted removable accessories ride beside the gadgets (no gadget slot used).
      const accChips = (catalogue === 'weapon' && (it.accessories || []).length) ? ` <span style="font-size:10px;opacity:.8;">🔧 ${(it.accessories || []).map(a => { const sh = weaponAttachments(it).some(x => x.ref === a.ref); return `<span title="${escapeHTML(sh ? 'Removable accessory — detach it from its own row' : 'Shadowed by an integrated gadget of the same kind — they don’t stack')}" style="background:rgba(140,200,150,.1);border:1px solid rgba(140,200,150,.35);border-radius:3px;padding:1px 5px;margin-right:3px;${sh ? '' : 'opacity:.5;text-decoration:line-through;'}">${escapeHTML(a.ref)}</span>`; }).join('')}</span>` : '';
      // v9.6.1 (§256, Adam's tweak): an item with NO installed gadgets shows
      // no gadget line on the collapsed row — the "⚙ Gadgets? (0/x)" add
      // control waits inside the dossier instead (the Enchantments idiom).
      const hasGadgets = (it.gadgets || []).length > 0;
      if (hasGadgets || accChips) gadgetHtml = `<div style="margin-top:3px;">${hasGadgets ? `Gadgets (${(it.gadgets || []).length}/${gcap}): ` : ''}${filled}${hasGadgets ? addCtl : ''}${accChips}</div>`;
      if (!hasGadgets) gadgetDossierCtl = addCtl;
    }

    const _gd = catalogue === 'equipment' ? def : null;
    const _on = _gd && _gd.active ? !!gearBoonOf(chars.find(x => x.id === curId) || {}, it) : false;
    const equipToggle = catalogue !== 'equipment'
      ? `<button class="btn btn-sm" style="font-size:10px;" onclick="toggleItemEquipped('${it.id}')">${it.equipped ? 'Unequip' : 'Equip'}</button>`
      : [ _gd && _gd.slot ? `<button class="btn btn-sm" style="font-size:10px;${it.equipped ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="toggleItemEquipped('${it.id}')" title="${it.equipped ? 'Worn in the ' : 'Wear in the '}${(ITEM_SLOTS.find(x => x.id === _gd.slot) || {}).label || _gd.slot} slot">${it.equipped ? '🎒 Remove' : '🎒 Wear'}</button>` : '',
          _gd && _gd.active ? `<button class="btn btn-sm" style="font-size:10px;${_on ? 'border-color:rgba(140,200,150,.7);color:#8cc896;' : ''}${_gd.slot && !it.equipped ? 'opacity:.5;' : ''}" onclick="toggleGearActive('${it.id}')" title="${_gd.slot && !it.equipped ? 'Wear it first' : 'Toggle the device — its Boon shows on the Sheet'}">${_on ? '⏻ Turn off' : '⚡ Activate'}</button>` : '',
          _gd && _gd.mount ? (() => { const w = it.mountedOn && (chars.find(x => x.id === curId) || {items: []}).items.find(i => i.id === it.mountedOn); return `<button class="btn btn-sm" style="font-size:10px;${w ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="mountAccessory('${it.id}')" title="${w ? 'Mounted on ' + escapeHTML(w.ref) + ' — click to detach' : 'Mount on an eligible weapon'}">🔧 ${w ? 'Mounted ✕' : 'Mount on…'}</button>`; })() : '',
          _gd && _gd.upgrade ? `<button class="btn btn-sm" style="font-size:10px;${it.upgraded ? 'border-color:rgba(140,200,150,.6);color:#8cc896;' : ''}" onclick="toggleComputerUpgrade('${it.id}')" title="Processor upgrade: +1 equipment on Computer Use (Purchase DC +${_gd.upgrade.dc}; charge it with ± Adjust if tracking wealth)">⬆ ${it.upgraded ? 'Upgraded' : 'Upgrade'}</button>` : '',
          _gd && _gd.use ? `<span style="font-size:10px;margin-right:4px;">×${it.qty || 1}</span><button class="btn btn-sm" style="font-size:9px;padding:0 5px;" onclick="gearQty('${it.id}',1)" title="Add one">+</button><button class="btn btn-sm" style="font-size:10px;" onclick="useGearItem('${it.id}')" title="Use one${(_gd.use.effects || []).length ? ' — starts its Boon' : ''}">🧪 Use</button>` : '' ].join(' ');
    // v8.6.1 TWF pass: one-handed weapons can swap hands (dual-wield lives
    // here + the Off Hand row's picker). Two-handers have no business off-hand.
    const handSwap = (catalogue === 'weapon' && weaponHands(def) === 1 && (it.slot === 'main_hand' || it.slot === 'off_hand'))
      ? `<button class="btn btn-sm" style="font-size:10px;" title="Move to the ${it.slot === 'main_hand' ? 'Off' : 'Main'} Hand" onclick="moveWeaponHand('${it.id}')">⇄ ${it.slot === 'main_hand' ? 'Off Hand' : 'Main Hand'}</button>`
      : '';
    // v8.6.1: Enchant / Imbue builder entry point (weapons + armor/shields).
    const enchInfo = enchantInfoOf(it);
    const enchantBtn = (catalogue === 'weapon' || catalogue === 'armor')
      ? `<button class="btn btn-sm" style="font-size:10px;${enchInfo ? 'border-color:rgba(196,153,212,.5);color:var(--vio);' : ''}" title="${enchInfo ? `${enchInfo.imbued ? 'Imbued' : 'Enchanted'} — aggregate +${enchInfo.totalMod}, value ${enchInfo.cost.toLocaleString()} gp. Click to upgrade.` : 'Enchant / imbue this item (GMG: enhancement +1..+5, then special abilities)'}" onclick="openEnchantBuilder('${it.id}')">✨ ${enchInfo ? `+${enchInfo.totalMod}` : 'Enchant'}</button>`
      : '';
    // v8.7.0 (Adam's display ruling): the tag shows the MECHANICAL face only
    // (+enh); the ability breakdown, aggregate modifier (cost/TS bookkeeping
    // — "doesn't need to be shown, just calculable"), and value live in the
    // tooltip.
    const enchantTags = enchInfo
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.35);margin-left:4px;color:var(--vio);" title="${escapeHTML((enchInfo.abilities.map(a => a.name + (a.bonus ? ` (+${a.bonus} equiv.)` : ` (${a.gp.toLocaleString()} gp)`)).join(' · ') || 'enhancement only') + ` — aggregate modifier +${enchInfo.totalMod} · value ${enchInfo.cost.toLocaleString()} gp`)}">${enchInfo.imbued ? '◈ imbued' : '✨ enchanted'} +${enchInfo.enh}</span>${enchInfo.overCap ? ' <span style="font-size:9px;color:var(--red-text);" title="Aggregate modifier exceeds this item’s Tech Scale cap — recorded as a GM override.">⚑ over TS cap (GM)</span>' : ''}`
      : '';
    const _eqP = (catalogue === 'equipment' && def.effect && def.effect.param)
      ? ` <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;${it.param ? '' : 'border-color:rgba(214,120,92,.6);color:#d6785c;'}" onclick="setEquipParam('${it.id}')" title="${escapeHTML(def.effect.param.label)}">${it.param ? escapeHTML(it.param) + ' ✎' : '⚠ choose ' + escapeHTML(def.effect.param.label)}</button>` : '';
    const effectNote = catalogue === 'equipment' && def.effect && def.effect.text ? `<div style="font-size:10px;opacity:.65;margin-top:2px;">${escapeHTML(def.effect.text)}${def.pending ? ` <span style="opacity:.7;">(${def.pending})</span>` : ''}</div>${_eqP ? `<div style="margin-top:2px;">${_eqP}</div>` : ''}` : (_eqP ? `<div style="margin-top:2px;">${_eqP}</div>` : '');
    // v8.5.2: hover tooltip on the item name. Tool/skill kits have a
    // description (def.effect.text) ready now; weapons/armor don't carry
    // prose yet (only crunch stats — no tooltip shown for those until a
    // separate extraction pass pulls their HH narrative text, deliberately
    // deferred per Adam, 2026-06-30).
    const nameTip = (catalogue === 'equipment' && def.effect)
      ? ` title="${escapeHTML([def.category, def.effect.text, def.page ? 'HH p.' + def.page : ''].filter(Boolean).join(' — '))}" style="cursor:help;"`
      // v8.7.0: converted specific arms carry their unique powers here.
      : (it.specialNote ? ` title="${escapeHTML((it.customName ? it.customName + ' — ' : '') + it.specialNote + ' (base: ' + it.ref + '; full text in the magic-item catalogue)')}" style="cursor:help;"` : '');

    // v8.8.0: armor mobility strip (AC / max Dex / ACP / speed / ASF —
    // gadget- and enchant-adjusted), mirroring the weapon stat strip.
    const armorStrip = (catalogue === 'armor')
      ? (() => { const s = armorStatStrip(def, it); return s ? `<div style="font-size:9.5px;color:var(--g55);margin-top:1px;" title="Max Dex caps the Dex bonus to AC while worn; speed shown for base 30′/20′ movers; ACP shown after enchantment/gadget easing.">${escapeHTML(s)}</div>` : ''; })()
      : '';
    // v8.6.1: non-proficiency flags. Weapons: −4 to attack. Armor/shields:
    // the piece's armor check penalty hits attack rolls and Str/Dex checks
    // while it is EQUIPPED (merely owning it is penalty-free).
    let profFlag = '';
    const curChar = chars.find(x => x.id === curId);
    if (curChar && catalogue === 'weapon' && !isProficientWithWeapon(curChar, it.ref)) {
      profFlag = ' <span style="color:#d4865a;font-size:10px;" title="-4 on attack rolls while not proficient">⚠ not proficient</span>';
    } else if (curChar && catalogue === 'armor' && !isProficientWithArmor(curChar, it.ref)) {
      const acp = parseArmorCheckPenalty(def);
      profFlag = ` <span style="color:#d4865a;font-size:10px;" title="Not proficient: while equipped, the armor check penalty (${acp}) applies to attack rolls and all Str- and Dex-based checks">⚠ not proficient${acp < 0 && it.equipped ? ` (${acp} atk & Str/Dex checks)` : ''}</span>`;
    }

    // v8.60.0 (Adam): 🤲 two-handed grip toggle — equipped one-handed melee
    // weapons only, and only while the off hand is free (or already gripped).
    const gripBtn = (catalogue === 'weapon' && it.equipped && def && def.kind === 'one-handed' && !isRangedWeapon(def)) ? (() => {
      const on = !!it.twoHandedGrip;
      const offBusy = curChar && getCharItems(curChar).some(o => o.id !== it.id && o.equipped && o.slot === 'off_hand');
      return `<button class="btn btn-sm" style="font-size:10px;${on ? 'border-color:rgba(220,205,138,.6);color:rgba(220,205,138,.95);' : (offBusy ? 'opacity:.4;' : '')}" onclick="toggleTwoHandGrip('${it.id}')" title="${on ? 'Wielded in BOTH hands: Str ×1.5 damage, Power Attack ×2, off hand committed. Click to return to one hand.' : (offBusy ? 'Off hand is occupied — free it to take a two-handed grip.' : 'Wield this one-handed weapon in both hands (off hand stays committed): Str ×1.5 damage, Power Attack counts double.')}">🤲</button>`;
    })() : '';
    // v9.6.0 (§255, Adam): line 1 = decorated name (the toggle) + state
    // buttons + the end-of-line trio (rename / sell / remove). Provenance +
    // Purchase DC open the collapsible; the Enchant / Mastercraft controls
    // live inside it. Enchantments get their own chip line, like Gadgets.
    const rowOpen = _itemOpen.has(it.id);
    const priceHtml = (() => { const pts = (_priceCheckTs != null) ? _priceCheckTs : techScale; if (enchInfo) return priceSpan(dcForDollars(enchInfo.cost * 100), pts); const eff = (typeof itemEffectivePDC === 'function') ? itemEffectivePDC(it, def) : { dc: parseInt(def.dc, 10) || def.purchase_dc || 0, parts: [] }; return priceSpan(eff.dc, pts, (def.tl != null ? def.tl : def.tech_scale) || 0, eff.parts.length ? `Effective Purchase DC ${eff.dc} = base ${eff.base} + ${eff.parts.join(' + ')}.` : ''); })();
    const provHtml = it.provenance
      ? `<span style="font-size:10px;cursor:help;" title="${it.provenance === 'purchased' ? 'Purchased — paid from funds' : 'Acquired — loot, gift, or GM grant'}">${it.provenance === 'purchased' ? '💰 Purchased' : '🎁 Acquired'}</span>`
      : '<span style="font-size:10px;opacity:.45;">provenance unrecorded</span>';
    const custRow = (enchantBtn || mcControl || gadgetDossierCtl) ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:10px;">${enchantBtn}<span>${mcControl}</span>${gadgetDossierCtl}</div>` : '';
    const dropdown = rowOpen
      ? `<div style="margin-top:4px;padding:5px 8px;border:1px solid rgba(200,151,30,.18);border-radius:3px;background:rgba(200,151,30,.04);">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">${provHtml} ${priceHtml}</div>${custRow}
        </div>`
      : '';
    // Enchantments / Imbuements chip line (the Gadgets line's twin): each
    // built-in ability wears its GMG description as a hover pop-up.
    const enchLine = enchInfo
      ? `<div style="margin-top:3px;font-size:10px;">Enchantments / Imbuements: <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.12);border:1px solid rgba(196,153,212,.35);margin-right:3px;color:var(--vio);" title="${escapeHTML(`Aggregate modifier +${enchInfo.totalMod} · value ${enchInfo.cost.toLocaleString()} gp`)}">${enchInfo.imbued ? '◈ imbued' : '✨ enchanted'} +${enchInfo.enh}</span>${enchInfo.abilities.map(a => `<span title="${escapeHTML((a.def && a.def.d) ? a.def.d : (a.bonus ? `+${a.bonus} bonus equivalent` : `${a.gp.toLocaleString()} gp`))}" style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.08);border:1px solid rgba(196,153,212,.25);margin-right:3px;cursor:help;color:var(--vio);">${escapeHTML(a.name)}</span>`).join('')}${enchInfo.overCap ? ' <span style="font-size:9px;color:var(--red-text);" title="Aggregate modifier exceeds this item’s Tech Scale cap — recorded as a GM override.">⚑ over TS cap (GM)</span>' : ''}${(catalogue === 'weapon' && enchInfo.enh > 0) ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.1);border:1px solid rgba(196,153,212,.3);cursor:help;color:var(--vio);" title="${escapeHTML(`Enchanted & Imbued Arms (GMG p.253): for every +1 of enhancement bonus, the weapon ignores 5 points of Hardness of anything it strikes — and whatever ignores hardness also ignores NATURAL hardness (GMG p.96).${(enchInfo.abilities || []).some(a => a.name === 'Bane') ? '\nBane (GMG p.260): +2 effective enhancement vs the designated foe — 10 more points of hardness ignored there.' : ''}`)}">⛏ ignores ${enchInfo.enh * 5} hardness</span>` : ''}</div>`
      : '';
    return `<div style="border:1px solid rgba(200,151,30,.15);border-radius:3px;padding:6px 8px;margin-bottom:5px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div><span style="cursor:pointer;font-size:10px;opacity:.7;" onclick="toggleItemCtl('${it.id}')" title="${rowOpen ? 'Hide' : 'Show'} provenance, Purchase DC, and the Enchant / Mastercraft controls">${rowOpen ? '▾' : '▸'}</span> <b${nameTip || ` style="cursor:pointer;" onclick="toggleItemCtl('${it.id}')"`}>${escapeHTML(itemDisplayName(it))}</b>${it.customName ? ` <span style="font-size:9px;opacity:var(--o55);color:var(--dim);">(${escapeHTML(it.ref)})</span>` : ''}${profFlag} <span style="font-size:10px;opacity:var(--o60);color:var(--dim);">(${catalogue}${it.equipped ? ', equipped' : ''})</span>${armorStrip}</div>
        <div style="display:flex;align-items:center;gap:6px;">${equipToggle}${handSwap}${gripBtn}<button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')" title="Give this item a custom name (flavor only)">✎</button><button class="btn btn-sm" style="font-size:10px;" onclick="sellItem('${it.id}')" title="Sell — into any market's Tech Scale (cross-scalar; HH p.257 Sale Price rule applies)">💱</button><button class="btn btn-sm" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')" title="Remove from inventory">🗑</button></div>
      </div>
      ${dropdown}${effectNote}${enchLine}${gadgetHtml}
    </div>`;
  }).join('');
}

function renderGear() {
  const prompt = document.getElementById('gear-prompt'), cont = document.getElementById('gear-content');
  if (!curId) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  const c = chars.find(x => x.id === curId); if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  document.getElementById('gear-hero-nm').textContent = c.name + ' — Gear';
  if (!c.items) c.items = [];
  const techScale = scenarioTechScale(c);
  renderWealthPanel(c);  // v8.7.0

  const heldWorn = ITEM_SLOTS.filter(s => s.category === 'held' || s.category === 'worn');
  // v8.6.1: a two-handed weapon in the Main Hand claims the Off Hand as a
  // virtual occupant (derived, never stored — see weaponHands).
  const thWeapon = twoHandedEquipped(c);
  const rows = heldWorn.map(slotDef => {
    // v8.91.0 (Adam's task 3): Lost Arm REMOVES the Off Hand row's availability
    // visibly — until a cybernetic Prosthetic Arm replaces the arm (HH p.332
    // Replacements; the drawback's own Special line). The equip guard in
    // toggleItemEquipped already blocked it; now the slot SAYS so.
    if (slotDef.id === 'off_hand' && typeof offHandAvailable === 'function' && !offHandAvailable(c)) {
      return `<tr><td style="font-family:'Epics Serif','Cinzel',serif;color:var(--g45);">${slotDef.label}</td><td><span style="color:#e08080;font-size:11px;" title="Lost Arm (drawback): one arm is gone — no off hand, no two-handed weapons, −2 on Climb, Swim, and grapple checks. Install a cybernetic Prosthetic Arm (🦾 Cybernetics, below) to restore it.">✕ unavailable — Lost Arm (install a cybernetic arm to restore)</span></td></tr>`;
    }
    const equippedItems = c.items.filter(i => i.slot === slotDef.id && i.equipped);
    const virtualClaim = (slotDef.id === 'off_hand' && thWeapon) ? 1 : 0;
    const free = (slotDef.capacity || 1) - equippedItems.length - virtualClaim;
    const itemsHtml = equippedItems.length
      ? equippedItems.map(it => renderEquippedItemChip(it)).join('')
      : (virtualClaim
        ? `<span style="opacity:.65;font-size:11px;font-style:italic;">— ${escapeHTML(thWeapon.ref)} (two-handed) —</span>`
        : `<span style="opacity:var(--o50);color:var(--dim);font-size:11px;">— empty —</span>`);
    const eligible = c.items.filter(i => {
      if (i.equipped) return false;
      if (i.catalogue !== 'armor') {
        if (!slotDef.accepts.includes(i.catalogue)) return false;
        // v8.6.1: a two-handed weapon can't sit in the Off Hand.
        if (slotDef.id === 'off_hand' && i.catalogue === 'weapon' && weaponHands(getCatalogueEntry('weapon', i.ref)) === 2) return false;
        return true;
      }
      const def = getCatalogueEntry('armor', i.ref);
      if (slotDef.id === 'off_hand') return def && def.type === 'shield';
      if (slotDef.id === 'armor') return def && def.type !== 'shield';
      return false;
    });
    const eqOpts = eligible.map(i => `<option value="${i.id}">${escapeHTML(i.ref)}</option>`).join('');
    // v8.6.1: the picker equips into THIS row's slot (equipItemToSlot) — the
    // Off Hand picker previously equipped an item into its own stored slot.
    const equipSel = free > 0 && eligible.length
      ? `<select onchange="if(this.value){equipItemToSlot(this.value,'${slotDef.id}');this.value='';}" style="font-size:11px;margin-left:6px;"><option value="">+ equip…</option>${eqOpts}</select>`
      : '';
    return `<tr><td style="font-family:'Epics Serif','Cinzel',serif;color:var(--g85);">${slotDef.label}</td><td>${itemsHtml}${equipSel}</td></tr>`;
  });
  document.getElementById('gear-equipped-rows').innerHTML = rows.join('');

  // v8.91.0: 🦾 Cybernetics shelf (implant body slots, HH pp.332-339).
  if (typeof renderCybernetics === 'function') renderCybernetics(c);

  // v8.6.0: the body-slot dashboard is LIVE — equipped magic items render in
  // their slots (chips + an equip picker for unequipped same-slot items),
  // with the affinity kept as the empty-state hint.
  // v8.56.0 (playtest issue #3d): builder extracted to magicSlotRowsHTML so
  // the Sheet's read-only reference copy renders from the same source.
  document.getElementById('gear-magic-slots').innerHTML = magicSlotRowsHTML(c, true);
  try { const sh = document.getElementById('sheet-magic-slots'); if (sh) sh.innerHTML = magicSlotRowsHTML(c, false); } catch (e) {}
  renderMagicInventory(c);
  renderMagicBrowse();

  const summaries = computeEquippedWeaponSummaries(c);
  // v8.6.1 TWF pass: hand chips on dual-wielded rows, the off-hand attack
  // sequence (Improved/Greater TWF extra attacks), and a status row spelling
  // out the penalty math + Two-Weapon Defense note.
  const twfNow = twfStatus(c);
  const fmtAtk = (n) => `${n >= 0 ? '+' : ''}${n}`;
  // v8.6.1: Ranger Combat Style picker (HH: chosen at Ranger 2; stored as the
  // lazy field c.rangerCombatStyle) + live armor-gate status.
  const rangerLvlNow = migrateLegacyClasses(c).filter(e => e.name === 'Ranger').reduce((s, e) => s + (e.level || 0), 0);
  const rangerRow = rangerLvlNow >= 2 ? (() => {
    const style = c.rangerCombatStyle || '';
    const cat = wearingArmorCategory(c);
    const armorOK = !cat || cat === 'light';
    const sel = `<select onchange="setRangerCombatStyle(this.value)" style="font-size:10px;"><option value=""${!style ? ' selected' : ''}>— choose —</option><option value="twf"${style === 'twf' ? ' selected' : ''}>Two-weapon combat</option><option value="archery"${style === 'archery' ? ' selected' : ''}>Ranged (archery)</option></select>`;
    let note = '';
    if (style === 'twf') {
      note = armorOK
        ? `virtual Two-Weapon Fighting active${rangerLvlNow >= 6 ? ' + Improved (Ranger 6)' : ''}${rangerLvlNow >= 11 ? ' + Greater (Ranger 11)' : ''}`
        : `SUPPRESSED — wearing ${cat} armor (light or none required)`;
    } else if (style === 'archery') {
      note = armorOK
        ? `virtual Rapid Shot active — shown as an alt mode on ranged weapon rows${rangerLvlNow >= 6 ? ' + Manyshot (Ranger 6: 2 arrows as one standard-action attack at −4, bows only)' : ''}${rangerLvlNow >= 11 ? ' + Improved Precise Shot (Ranger 11: ignore anything less than total cover/concealment)' : ''}`
        : `SUPPRESSED — wearing ${cat} armor (light or none required)`;
    }
    return `<tr><td colspan="5" style="font-size:10.5px;color:var(--g75);padding:4px 8px;">🏹 <b>Ranger Combat Style</b> (2nd-level class feature): ${sel}${note ? ` <span style="color:${note.startsWith('SUPPRESSED') ? '#d4865a' : 'rgba(120,175,205,.85)'};">${escapeHTML(note)}</span>` : ''}</td></tr>`;
  })() : '';
  const twfRow = twfNow ? (() => {
    const why = [`primary ${fmtAtk(twfNow.pri)} / off-hand ${fmtAtk(twfNow.off)}`];
    why.push(twfNow.offLight ? 'light off-hand weapon' : 'off-hand weapon not light');
    why.push(twfNow.hasTWF ? (twfNow.virtualRanger ? 'TWF (Ranger combat style, virtual)' : 'TWF feat') : 'no TWF feat — take it to ease the penalties');
    if (twfNow.mixed) why.push(`melee + ranged in two hands ${fmtAtk(twfNow.mixed)}`);
    const extras = `off-hand attacks: ${twfNow.offAttacks}${twfNow.offAttacks > 1 ? ' (2nd at −5' + (twfNow.offAttacks > 2 ? ', 3rd at −10' : '') + ')' : ''}`;
    const twd = twfNow.hasTwoWeaponDefense ? ' · Two-Weapon Defense: +1 shield bonus to AC while dual-wielding (apply manually)' : '';
    return `<tr><td colspan="5" style="font-size:10.5px;color:var(--tb85);padding:4px 8px;">⚔⚔ <b>Two-weapon fighting</b> — ${escapeHTML(why.join(' · '))} · ${escapeHTML(extras)}${escapeHTML(twd)} <span style="opacity:var(--o55);color:var(--dim);">(off-hand melee damage adds ½ Str bonus)</span></td></tr>`;
  })() : '';
  // v8.61.0: toggle label state + the defensive-riders footer row.
  { const mb = document.getElementById('melee-opts-btn');
    if (mb) { const on = meleeOptsOn(); mb.textContent = `⚔ Expanded Melee Options: ${on ? 'ON' : 'OFF'}`; mb.style.borderColor = on ? 'rgba(212,184,112,.6)' : ''; mb.style.color = on ? 'rgba(212,184,112,.95)' : ''; } }
  const defR = defenseRiders(c);
  const defRow = defR.length
    ? `<tr><td colspan="5" style="font-size:10.5px;color:var(--tc80);padding:4px 8px;">🛡 <b>Defensive riders</b> — ${defR.map(d => `<span title="${escapeHTML(d[1])}" style="cursor:help;white-space:nowrap;">${escapeHTML(d[0])}</span>`).join(' · ')}</td></tr>`
    : '';
  document.getElementById('gear-weapon-summary').innerHTML = summaries.length
    ? summaries.map(s => {
        const atkTip = s.mods.map(m => `${m.label}: ${m.value >= 0 ? '+' : ''}${m.value}`).join('\n');
        // v8.8.1 (Adam): the damage cell shows die + ONE summed modifier
        // (extra dice like +1d6 cold stay distinct); the ⓘ itemizes the sum.
        const dmgTip = (s.dmgBreakdown || []).map(p => `${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}`).join('\n');
        const dmgInfo = dmgTip ? ` <span style="cursor:help;color:var(--tb75);font-size:10px;" title="${escapeHTML('Damage modifier breakdown:\n' + dmgTip)}">ⓘ</span>` : '';
        const handChip = s.hand ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);">${s.hand === 'main' ? 'main hand' : 'off hand'}</span>` : (s.gripBothHands ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(220,205,138,.12);border:1px solid rgba(220,205,138,.35);" title="One-handed weapon wielded in both hands: Str ×1.5 damage, Power Attack ×2. Toggle with 🤲 on the inventory row.">🤲 both hands</span>` : '');
        // v8.60.0: Full Attack brackets — "+12 (+7)" per Adam's spec; TWF
        // off-hand rows keep their own extra-attack sequence display.
        const atkText = (s.twfExtraAtks && s.twfExtraAtks.length > 1)
          ? s.twfExtraAtks.map(fmtAtk).join(' / ')
          : (s.fullAttack && s.fullAttack.length > 1)
            ? `${fmtAtk(s.fullAttack[0])} (${s.fullAttack.slice(1).map(fmtAtk).join('/')})`
            : fmtAtk(s.attackBonus);
        const atkIterTip = (s.fullAttack && s.fullAttack.length > 1)
          ? `\n\nFull Attack: ${s.fullAttack.map(fmtAtk).join(' / ')} — one extra swing per 5 points of Base Attack (max 5), each at a cumulative −5.` : '';
        const unarmedTag = s.unarmed ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(200,151,30,.1);border:1px solid rgba(200,151,30,.3);cursor:help;" title="${escapeHTML(s.unarmedNote || '')}">🥊 unarmed</span>` : '';
        const capFlag = s.enchantOverCap ? ' <span style="color:var(--red-text);font-size:10px;" title="Aggregate enchantment exceeds this item’s Tech Scale cap — GM override recorded.">⚑</span>' : '';
        // v9.6.1 (§256): the enchanted/imbued hardness-piercing rider.
        const ihTag = s.ignoreHardness ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(196,153,212,.1);border:1px solid rgba(196,153,212,.3);cursor:help;color:var(--vio);" title="${escapeHTML(`Enchanted & Imbued Arms (GMG p.253): for every +1 of enhancement bonus, the weapon ignores 5 points of Hardness of anything it strikes — and whatever ignores hardness also ignores NATURAL hardness (GMG p.96).${s.ihBane ? '\nBane (GMG p.260): +2 effective enhancement vs the designated foe — 10 more points of hardness ignored there.' : ''}\nA monk’s ki strike stacks through a Ki Focus weapon (+5 ignored per +1).`)}">⛏ ignores ${s.ignoreHardness} hardness${s.ihBane ? ' (+10 bane)' : ''}</span>` : '';
        const integTag = s.integratedIn ? ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(200,151,30,.08);border:1px solid rgba(200,151,30,.3);" title="Alternate Weapon gadget — integrated into the host, usable at any time while it is equipped.${s.detachable ? ' Detachable (can be physically separated).' : ' Fixed mounting.'}">🔩 in ${escapeHTML(s.integratedIn)}${s.detachable ? ' · detachable' : ''}</span>` : '';
        const statStrip = s.statStrip ? `<div style="font-size:9.5px;color:var(--g55);margin-top:1px;cursor:help;" title="crit threat/multiplier · range increment · Rate of Fire (S = semiautomatic, A = automatic) · magazine${s.rangeRule ? escapeHTML('\n\n' + s.rangeRule) : ''}">${escapeHTML(s.statStrip)}</div>` : '';
        return `<tr><td>${escapeHTML(s.name)}${unarmedTag}${integTag}${handChip}${capFlag}${ihTag}${s.proficient ? '' : ' <span style="color:#d4865a;font-size:10px;" title="-4 not proficient">⚠ not proficient</span>'}${statStrip}</td>`
      + `<td style="cursor:help;" title="${escapeHTML(atkTip + atkIterTip)}">${atkText}</td><td>${escapeHTML(s.damage)} ${escapeHTML(s.damageLabel)}${dmgInfo}</td>`
      + `<td style="font-size:10px;opacity:.8;cursor:help;" title="Resisted by: ${escapeHTML(s.resistances.join('; ') || '—')}${s.vsObjects ? escapeHTML('\nVs objects: ' + s.vsObjects) : ''}">${escapeHTML(s.typeLabel || (s.damageTypes || []).join('/') || '—')}</td>`
      + `<td style="font-size:10px;">${s.altModes.length ? s.altModes.map(m => m.spike
          ? `<div title="${escapeHTML(m.label)}" style="color:${m.path ? 'rgba(220,205,138,.95)' : 'rgba(220,205,138,.4)'};white-space:nowrap;cursor:help;">↳ ⚡ ${escapeHTML(m.name)}: ${escapeHTML(m.display)}${m.path ? ` <button class="btn btn-sm" style="font-size:9px;padding:0 5px;margin-left:4px;" onclick="weaponSpikeUse('${escapeHTML(m.dispFeat)}','${m.dice}','${m.path}')">Expend Focus</button>` : ''}</div>`
          : `<div title="${escapeHTML(m.label)}" style="color:var(--pb90);cursor:help;white-space:nowrap;">↳ ${escapeHTML(m.name)}: ${m.display ? escapeHTML(m.display) : `${m.atk >= 0 ? '+' : ''}${m.atk} atk / ×${m.dmgMult} dmg${m.roundsCost ? ` <span style="opacity:var(--o55);color:var(--dim);">(${m.roundsCost} rds)</span>` : ''}`}</div>`).join('') : '<span style="opacity:.4;">—</span>'}</td></tr>`
      // v8.61.0: the maneuvers + riders sub-row (Expanded Melee Options).
      + (((s.maneuvers && s.maneuvers.length) || (s.riders && s.riders.length))
          ? `<tr><td colspan="5" style="padding:2px 8px 7px 20px;font-size:10px;border-bottom:1px solid rgba(200,151,30,.08);line-height:1.9;">`
            + (s.maneuvers || []).map(m => `<span title="${escapeHTML(m.label)}" style="cursor:help;color:rgba(212,184,112,.9);margin-right:12px;white-space:nowrap;">⚔ ${m.n}: ${escapeHTML(m.display)}</span>`).join('')
            + (s.riders || []).map(r => `<span title="${escapeHTML(r[1])}" style="cursor:help;color:var(--tb65);margin-right:12px;white-space:nowrap;">• ${escapeHTML(r[0])}</span>`).join('')
            + `</td></tr>`
          : '');
      }).join('') + twfRow + defRow + rangerRow
    : `<tr><td colspan="5" style="opacity:.5;text-align:center;">No weapons equipped.</td></tr>` + defRow + rangerRow;

  document.getElementById('gear-inv-weapons').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'weapon'), techScale, 'weapon');
  document.getElementById('gear-inv-armor').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'armor'), techScale, 'armor');
  document.getElementById('gear-inv-tools').innerHTML = renderInventoryList(c.items.filter(i => i.catalogue === 'equipment'), techScale, 'equipment');
  // v8.13.x Segment A: vehicles — dedicated light rows (no mastercraft/gadget
  // machinery; vehicle gear is a later slice). Operation lives on 🕹 Vehicles.
  const vhInvEl = document.getElementById('gear-inv-vehicles');
  if (vhInvEl) vhInvEl.innerHTML = renderVehicleInventory(c, techScale);
  // v8.17.0 Segment C: mecha inventory rows.
  const mhInvEl = document.getElementById('gear-inv-mecha');
  if (mhInvEl) {
    const mItems = getCharItems(c).filter(i => i.catalogue === 'mecha');
    mhInvEl.innerHTML = mItems.length ? mItems.map(it => {
      const def = (typeof mechaDefOf === 'function') ? mechaDefOf(it) : null; if (!def) return '';
      const g = vehicleIntegrity(it);
      const nm = it.custom ? it.custom.name : (it.customName || it.ref);
      const state = g.destroyed ? ' <span style="color:#999;font-size:10px;">☠ DESTROYED</span>' : g.broken ? ' <span style="color:var(--red-text);font-size:10px;">🛑 DISABLED</span>' : (it.piloted ? ' <span style="color:#78afcd;font-size:10px;">🕹 piloted</span>' : '');
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
        <div><b>🦿 ${escapeHTML(nm)}</b>${state}
          <div style="font-size:9.5px;color:var(--g55);">${def.size} TS ${def.ts} · ${escapeHTML(def.superstructure)}/${escapeHTML(def.armorType)} · Str ${def.str} · Hull ${g.hp}/${g.maxHP} · Hard ${g.hardness}</div>
        </div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;" onclick="showPage('vehicles')">🕹 Operate</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')">✎</button>
          <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')">✕</button>
        </div>
      </div>`;
    }).join('') : `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">None owned yet.</div>`;
  }
  // v8.18.0 Segment D: starship inventory rows.
  const shInvEl = document.getElementById('gear-inv-starships');
  if (shInvEl) {
    const sItems = getCharItems(c).filter(i => i.catalogue === 'starship');
    shInvEl.innerHTML = sItems.length ? sItems.map(it => {
      const def = (typeof shipDefOf === 'function') ? shipDefOf(it) : null; if (!def) return '';
      const secs = shipSections(it);
      const worst = secs.filter(s => s.disabled).map(s => s.section);
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(200,151,30,.08);font-size:12px;">
        <div><b>🚀 ${escapeHTML(it.customName || it.ref)}</b>${worst.length ? ` <span style="color:var(--red-text);font-size:10px;">🛑 ${worst.join('/')}</span>` : ''}
          <div style="font-size:9.5px;color:var(--g55);">${escapeHTML(def.subtype)} · ${def.cls} TS ${def.ts} · ${def.D}D · crew ${def.crew} · Hard ${def.hardness}</div>
        </div>
        <div style="white-space:nowrap;">
          <button class="btn btn-sm" style="font-size:10px;" onclick="showPage('vehicles')">🕹 Operate</button>
          <button class="btn btn-sm" style="font-size:10px;" onclick="renameItem('${it.id}')">✎</button>
          <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="removeItemFromChar('${it.id}')">✕</button>
        </div>
      </div>`;
    }).join('') : `<div style="opacity:var(--o50);color:var(--dim);font-size:11px;padding:6px 0;">No vessels registered.</div>`;
  }
  if (typeof renderNavTabs === 'function') renderNavTabs(c);  // a purchase can summon the Vehicles tab

  // v8.6.1 (Adam): "TL" was a vestige of the pre-Scales conversion — the tl
  // field IS the Tech Scale gate (compared against sixLevels.tech everywhere),
  // so the label reads TS like the Tools & Skill Kits list already did.
  // v8.6.1 (Adam's tidy-up request): the flat add-item dropdowns were
  // "disheveled" — each is now grouped into per-Tech-Scale <optgroup> shelves
  // (labeled with the SIX_LEVELS tech tier names, alphabetical within), with
  // scales ABOVE the scenario's Tech Scale still offered but shelved under a
  // "⚑ above scenario — GM approval" banner (the existing addItemToChar
  // over-TS confirm remains the actual gate).
  const tsGroupedOptions = (items, tsOf, optionHtml) => {
    const byTs = new Map();
    for (const it of items) {
      const ts = tsOf(it) || 0;
      if (!byTs.has(ts)) byTs.set(ts, []);
      byTs.get(ts).push(it);
    }
    return [...byTs.keys()].sort((a, b) => a - b).map(ts => {
      const tierName = ((SIX_LEVELS.tech.tiers[ts] || '').split('—')[0] || '').trim();
      const over = ts > techScale;
      const label = `TS ${ts}${tierName ? ' · ' + tierName : ''}${over ? ' — ⚑ above scenario (GM approval)' : ''}`;
      const opts = byTs.get(ts).sort((x, y) => (x.name || '').localeCompare(y.name || '')).map(optionHtml).join('');
      return `<optgroup label="${escapeHTML(label)}">${opts}</optgroup>`;
    }).join('');
  };
  // v8.7.0: each option carries its Purchase DC (full era-keyed price + the
  // ±20% market-fluctuation advisory ride the option tooltip).
  // v8.7.0: options show the MARKET-ADJUSTED DC (−2/TS below the scenario's
  // market, +5/TS above — Adam's ruling); the tooltip shows the math when
  // adjusted, plus the era-keyed price and the ±20% advisory.
  // v8.7.0: the price-checker lens (display-only) swaps the MARKET the
  // prices render against; the shelves' availability flags and all charging
  // stay on the real scenario TS.
  const priceTs = (_priceCheckTs != null) ? _priceCheckTs : techScale;
  const mdc = (dc, its) => marketAdjustedDC(dc, its, priceTs);
  const optPrice = (dc, its) => dc ? ` · DC ${mdc(dc, its)}` : '';
  const optTip = (dc, its, extra) => {
    const adj = mdc(dc, its);
    const math = (dc && adj !== dc) ? `Base DC ${dc} (TS${its}) → DC ${adj} in this TS${priceTs} market${_priceCheckTs != null ? ' (🔍 price-check view)' : ''}. ` : '';
    return ` title="${escapeHTML((extra ? extra + '\n\n' : '') + (dc ? math + priceLabel(adj, priceTs) + ' — ' + PRICE_FLUX_NOTE : ''))}"`;
  };
  // v8.56.0 (playtest issue #3a): every shelf opens on a no-selection
  // placeholder — auto-populating "Club"/"Hide"/"Alchemist's Kit" invited
  // accidental adds and read as pre-chosen to new players.
  const PICKER_PLACEHOLDER = '<option value="" selected>— select an item —</option>';
  document.getElementById('gear-add-weapon-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(WEAPONS_CATALOG, w => w.tl,
    w => `<option value="${escapeHTML(w.name)}"${optTip(parseInt(w.dc, 10) || 0, w.tl || 0)}>${escapeHTML(w.name)}${w.dmg_m ? ' (' + escapeHTML(w.dmg_m) + ')' : ''}${optPrice(parseInt(w.dc, 10) || 0, w.tl || 0)}</option>`);
  document.getElementById('gear-add-armor-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(ARMOR_CATALOG, a => a.tl,
    a => `<option value="${escapeHTML(a.name)}"${optTip(parseInt(a.dc, 10) || 0, a.tl || 0)}>${escapeHTML(a.name)} (+${a.ac_bonus} ${a.type})${optPrice(parseInt(a.dc, 10) || 0, a.tl || 0)}</option>`);
  document.getElementById('gear-add-equipment-sel').innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(EQUIPMENT_ITEMS, e => e.tech_scale,
    e => `<option value="${escapeHTML(e.name)}"${optTip(e.purchase_dc || 0, e.tech_scale || 0, [e.category, e.effect ? e.effect.text : ''].filter(Boolean).join(' — '))}>${escapeHTML(e.name)}${e.effect && (e.effect.kind === 'bonus') ? ' ✦' : (e.effect && e.effect.kind === 'kit' ? ' ⚒' : '')}${optPrice(e.purchase_dc || 0, e.tech_scale || 0)}</option>`);
  // v8.13.x Segment A: the vehicles shelf — restriction rating rides the tooltip.
  const vSel = document.getElementById('gear-add-vehicle-sel');
  if (vSel && typeof VEHICLES_DB !== 'undefined') vSel.innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(VEHICLES_DB, v => v.ts,
    v => `<option value="${escapeHTML(v.name)}"${optTip(v.purchase_dc || 0, v.ts || 0, `${v.category} · ${v.skill} skill · ${v.maneuver_class} (${v.maneuver_mod >= 0 ? '+' : ''}${v.maneuver_mod}) · Restriction: ${v.restriction} (+${v.restriction_mod} black-market DC)`)}>${escapeHTML(v.name)}${optPrice(v.purchase_dc || 0, v.ts || 0)}</option>`);
  // v8.17.0 Segment C: the sample-mecha shelf.
  const mSel = document.getElementById('gear-add-mecha-sel');
  if (mSel && typeof MECHA_UNITS !== 'undefined') {
    const arr = Object.keys(MECHA_UNITS).map(n => Object.assign({ name: n }, MECHA_UNITS[n]));
    mSel.innerHTML = PICKER_PLACEHOLDER + tsGroupedOptions(arr, m => m.ts,
      m => `<option value="${escapeHTML(m.name)}"${optTip(m.purchaseDC || 0, m.ts || 0, `${m.size} · ${m.superstructure} frame (Hardness ${m.hardness}) · ${m.armorType} armor +${m.equipAC} · Str ${m.str} / Dex ${m.dexMax} · ${m.hp} HP · Mil (+3) when armed`)}>${escapeHTML(m.name)}${optPrice(m.purchaseDC || 0, m.ts || 0)}</option>`);
  }
}
