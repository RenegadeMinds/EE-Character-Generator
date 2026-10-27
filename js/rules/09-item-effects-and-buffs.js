// =============================================================================
// js/rules/09-item-effects-and-buffs.js
// ITEM EFFECTS AND BUFFS
// =============================================================================
//
// WHAT'S IN HERE
//   Equipped-item effects: magic-item slot rules, firm-wired magic item
//   effects, attribute bakes from talents; then active power effects (buffs
//   and their durations), option-aware augments, and perpetual buffs.
//
// KEY NAMES (so you can search for them)
//   tables/objects: MAGIC_SLOT_TYPE, MAGIC_SLOT_KEYWORDS, MAGIC_ITEM_EFFECTS,
//   TALENT_ATTR_BAKES, POWER_EFFECTS, AUGMENT_OPTIONS, PERPETUAL_NOTES
//   functions (27): getCharItems, getCatalogueEntry, magicItemDefaultSlot,
//   magicItemEffectValue, attrItemBonuses, reconcileTalentAttrBakes,
//   suBakedPerAttr, berserkerLvl, bloodlusterLvl, bloodlusterInstances,
//   rageTier, rageUsesPerDay, wilderLvl, euphoriacBonus, toggleEuphoric,
//   effAttrs, effAm, buffDurationText, perpetualBuffs, toggleBuffSuper,
//   _buffEffectSources, activeBuffBonuses, activeBuffAttrDeltas,
//   applyWiredBuff, clearActiveBuffs, dismissBuffAt, renderActiveBuffs
//
// LOAD ORDER
//   File 9 of 68. index.html loads it after
//   js/rules/08-feat-prereqs-and-bonuses.js and before
//   js/rules/10-minds-ledger-and-magic-browser.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 6737-7401 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 6737-7401; unchanged below this line ----
// ============================================================================
// v8.5.2: GEAR / EQUIPMENT — functional-equipping pass (Phase A-D).
// Reference data: WEAPONS_CATALOG, ARMOR_CATALOG, GADGETS_CATALOG,
// MASTERCRAFT_RULES, EQUIPMENT_ITEMS, ITEM_SLOTS (see the inlined substrate
// block above; source of truth + grader: equipment_substrate/run_equipment.mjs).
// Character data: c.items[] — lazily defaulted to [] wherever read/written,
// the SAME convention already used for c.feats/c.talents on older saves
// (c?.feats || []). Deliberately NOT gated by CURRENT_SCHEMA_VER /
// isLegacyCharacter() — that pair is already load-bearing for the unrelated
// v8.4.0 Hero's-Gift L1-slot system; bumping it here would silently mark
// every existing character "legacy" for THAT system too. Adam confirmed
// (2026-06-29) no migration is needed since all characters to date are test
// cases, so the lazy-default approach is sufficient and lower-risk.
// ============================================================================

function getCharItems(c) { return (c && c.items) || []; }

function getCatalogueEntry(catalogue, ref) {
  if (catalogue === 'weapon') return WEAPONS_CATALOG.find(w => w.name === ref) || null;
  if (catalogue === 'armor') return ARMOR_CATALOG.find(a => a.name === ref) || null;
  if (catalogue === 'equipment') return EQUIPMENT_ITEMS.find(e => e.name === ref) || null;
  if (catalogue === 'magic') {
    // v9.10.0 (§263): case-insensitive fallback — the title-case sweep of
    // the catalogue names must not orphan items owned under the old casing.
    // v9.10.1 (§264): one true rename — the GMG table's "Air duct
    // filtration suit" is a typo for the description head's (and Urban
    // Arcana's) "Infiltration" (it casts gaseous form to travel air ducts).
    const _aliased = String(ref).toLowerCase() === 'air duct filtration suit' ? 'Air Duct Infiltration Suit' : ref;
    return MAGIC_ITEMS_DB.find(m => m.name === _aliased)
        || MAGIC_ITEMS_DB.find(m => m.name.toLowerCase() === String(_aliased).toLowerCase())
        || null;  // v8.6.0
  }
  if (catalogue === 'vehicle') return VEHICLES_DB.find(v => v.name === ref) || null;   // v8.13.x Segment A
  if (catalogue === 'mecha') return (MECHA_UNITS[ref]) || null;  // v8.17.0 Segment C
  if (catalogue === 'starship') return (STARSHIP_SUBTYPES[ref]) || null;  // v8.18.0 Segment D
  return null;
}

// v8.6.0 magic-item catalogue: default body slot by item type, then by the
// naming idiom (Amulet of… → neck; Boots of… → boots; …). Anything
// unmatched lands in 'carried' — the player can re-slot via GM ruling later.
const MAGIC_SLOT_TYPE = {
  ring: 'ring', tattoo: 'tattoo', psicrown: 'head',
  potion: 'carried', wand: 'carried', scroll: 'carried', rod: 'carried',
  staff: 'carried', dorje: 'carried', power_stone: 'carried',
  cognizance_crystal: 'carried',
};
const MAGIC_SLOT_KEYWORDS = [
  [/amulet|necklace|periapt|scarab|medallion|brooch|pendant/i, 'neck'],
  [/\btorc\b/i, 'torc'], [/phylactery/i, 'phylactery'],
  [/boots|slippers/i, 'boots'], [/cloak|cape|mantle/i, 'shoulders'],
  [/belt|girdle/i, 'belt'], [/gauntlet/i, 'gauntlets'], [/glove/i, 'gloves'],
  [/bracers/i, 'bracers'], [/bracelet/i, 'bracelets'],
  [/helm|crown|circlet|headband|diadem/i, 'head'], [/\bhat\b|\bcap\b/i, 'hat'],
  [/goggles|lenses|eyes of/i, 'eyes'], [/robe/i, 'robe'],
  [/shirt/i, 'shirt'], [/vest\b|vestment/i, 'vest'], [/\bring\b/i, 'ring'],
  [/tattoo/i, 'tattoo'], [/armor|breastplate|plate|mail|skin of/i, 'armor'],
  [/shield/i, 'off_hand'],
];
function magicItemDefaultSlot(item) {
  if (MAGIC_SLOT_TYPE[item.type]) return MAGIC_SLOT_TYPE[item.type];
  for (const [re2, slot] of MAGIC_SLOT_KEYWORDS) if (re2.test(item.name)) return slot;
  return 'carried';
}

// ============================================================================
// v8.6.0 FIRM-WIRED item effects (Adam's ruling, 2026-09-01). The three-tier
// effect ontology:
//   HARD-BAKED — permanent acquisitions write into c.attrs (mutations;
//     reverse on the rare removal).
//   FIRM-WIRED — equipment effects DERIVE live from the `equipped` flag,
//     never stored: nothing to reverse, nothing to drift. Enhancement
//     non-stacking falls out naturally (best-per-attribute).
//   MANUAL — cast-time effects (Animal Affinity et al.) stay display-only.
// Deliberate exclusion: SNAPSHOT values (stored max HP from CON at level-up)
// do NOT follow item attributes — RAW treats item-CON hit points as
// temporary; surfaced as a note, not silently recomputed.
// MAGIC_ITEM_EFFECTS is the curated table (names verified against
// MAGIC_ITEMS_DB); tiered items pick their tier at add time (it.tier).
const MAGIC_ITEM_EFFECTS = {
  // — attribute enhancements (firm-wired via effAttrs) —
  'Amulet of Health':        {attr:'CON', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Headband of Intellect':   {attr:'INT', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Cloak of Charisma':       {attr:'CHA', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Gloves of Dexterity':     {attr:'DEX', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Periapt of Wisdom':       {attr:'WIS', tiers:[[2,4000],[4,16000],[6,36000]]},
  'Belt of Giant Strength':  {attr:'STR', tiers:[[4,16000],[6,36000]]},
  'Gauntlets of Ogre Power': {attr:'STR', value:2},
  // — aggregator-channel effects (deflection AC, natural armor, saves, skills) —
  'Amulet of Natural Armor': {target:'naturalAC', type:'enhancement', tiers:[[1,2000],[2,8000],[3,18000],[4,32000],[5,50000]]},
  'Protection':              {target:'ac', type:'deflection', tiers:[[1,2000],[2,8000],[3,18000],[4,32000],[5,50000]]},
  'Cloak of Resistance':     {targets:['fort','ref','will'], type:'resistance', tiers:[[1,1000],[2,4000],[3,9000],[4,16000],[5,25000]]},
  'Boots of Elvenkind':      {target:'skill:Move Silently', type:'competence', value:5},
  'Eyes of the Eagle':       {target:'skill:Spot', type:'competence', value:5},
};
function magicItemEffectValue(it, fx) {
  return it.tier || fx.value || (fx.tiers ? fx.tiers[0][0] : 0);
}
// Best equipped enhancement per attribute (non-stacking) + provenance labels.
function attrItemBonuses(c) {
  const best = [0, 0, 0, 0, 0, 0], from = [null, null, null, null, null, null];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'magic' || !it.equipped) continue;
    const fx = MAGIC_ITEM_EFFECTS[it.ref];
    if (!fx || !fx.attr) continue;
    const i = ATTR_KEY_IDX[fx.attr];
    const v = magicItemEffectValue(it, fx);
    if (i !== undefined && v > best[i]) { best[i] = v; from[i] = `${it.ref} +${v}`; }
  }
  return { best, from };
}
// v8.8.0 (Adam's rulings, 2026-09-02): attribute-granting Apex Super-Talents
// BAKE into the score (permanent, GM-reversible — the Extraordinary
// [Attribute] pattern, per-record attrApplied ledger). Titanic Strength is
// the flat one; these are SUPERNATURAL (Su) effects, so they answer to
// nullification below.
const TALENT_ATTR_BAKES = { 'Titanic Strength': { attr: 'STR', idx: 0, value: 10, su: true } };
function reconcileTalentAttrBakes(c) {
  if (!c || !Array.isArray(c.attrs)) return false;
  let changed = false;
  for (const te of (c.talents || [])) {
    const spec = TALENT_ATTR_BAKES[te.name];
    if (spec && !te.attrApplied) { c.attrs[spec.idx] += spec.value; te.attrApplied = spec.value; te.attrKey = spec.attr; changed = true; }
  }
  return changed;
}
// The per-attribute SUPERNATURAL total currently baked in — what a Null
// Power Field strips: the Supernatural [Attribute] mutation chain + Su
// talent bakes. (Extraordinary bakes are never nullified.)
function suBakedPerAttr(c) {
  const out = [0, 0, 0, 0, 0, 0];
  for (const m of (c && c.mutations || [])) {
    if (m.attrApplied && /^Supernatural/.test(m.name || '') && ATTR_KEY_IDX[m.attr] !== undefined) out[ATTR_KEY_IDX[m.attr]] += m.attrApplied;
  }
  for (const te of (c && c.talents || [])) {
    const spec = TALENT_ATTR_BAKES[te.name];
    if (spec && spec.su && te.attrApplied) out[spec.idx] += te.attrApplied;
  }
  return out;
}
// v8.8.0 NULLIFIED (Adam's design): c.nullified suppresses ALL Supernatural
// modifiers — the character falls back to natural + Extraordinary. Wired
// through effAttrs (combat/casting/skills inherit), the DR pool
// (Bulletproof ×5 and Nigh-Invulnerable are Su super-talents), speed
// (Hyper-Speed), and Energy Immunity. Su effects beyond the wired systems
// (Buff super-powers, Su item effects, Ki Strike…) are the banner's GM line.
// v8.8.2 (Adam's ruling: "full toggle with baked modifiers"): RAGE. The
// Berserker's Rage is Ex — it flows through effective attributes exactly
// like item enhancements, and it is NOT suppressed by ⊘ Nullified. Tier by
// Berserker level (HH pp.79-80): +4 Str/Con (+2 Will morale, −2 AC);
// Greater @11: +6/+6/+3; Mighty @20: +8/+8/+4. Ending a Rage leaves the
// character Fatigued (−2 Str, −2 Dex, no charge/run) for the encounter —
// unless Tireless (17+). c.raging / c.fatigued are lazy flags.
function berserkerLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Berserker').reduce((s, e) => s + (e.level || 0), 0);
}
// v8.10.1: Bloodluster synergy (GMG p.159) — Improved Bloodlust instances
// (levels 2–9) count as Berserker levels for Rage uses (or as Wilder levels
// for Surge/Euphoriac/manifesting); Perfect Storm @10 grants Greater Rage
// with NO fatigue (or +1 Euphoriac and no Neuralgia).
function bloodlusterLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Bloodluster').reduce((s, e) => s + (e.level || 0), 0);
}
function bloodlusterInstances(c) { return Math.max(0, Math.min(bloodlusterLvl(c), 9) - 1); }
function rageTier(c) {
  const bsk = berserkerLvl(c);
  if (bsk <= 0) return null;
  const lvl = bsk + bloodlusterInstances(c);
  const perfectStorm = bloodlusterLvl(c) >= 10;
  return lvl >= 20 ? { attr: 8, will: 4, name: 'Mighty Rage' }
       : (lvl >= 11 || perfectStorm) ? { attr: 6, will: 3, name: 'Greater Rage' + (perfectStorm ? ' (Perfect Storm)' : '') }
       : { attr: 4, will: 2, name: 'Rage' };
}
function rageUsesPerDay(c) {
  const lvl = berserkerLvl(c);
  return lvl > 0 ? Math.min(6, 1 + Math.floor((lvl + bloodlusterInstances(c)) / 4)) : 0;
}
// v8.8.3 (Adam): EUPHORIAC (Ex, Wilder 4+, HH p.106) — after a wild surge
// (and no neuralgia), +1 morale on attack rolls, damage rolls, and saving
// throws for (surge intensity) rounds; +2 at Wilder 12, +3 at 20. Toggle
// c.euphoric — Ex, so it persists while ⊘ Nullified.
function wilderLvl(c) {
  return migrateLegacyClasses(c).filter(e => e.name === 'Wilder').reduce((s, e) => s + (e.level || 0), 0);
}
function euphoriacBonus(c) {
  const wl = wilderLvl(c);
  if (wl <= 0) return 0;
  // v8.10.1: Bloodluster instances count as Wilder levels; Perfect Storm +1.
  const lvl = wl + (bloodlusterInstances(c));
  const base = lvl >= 20 ? 3 : (lvl >= 12 ? 2 : (lvl >= 4 ? 1 : 0));
  return base + ((bloodlusterLvl(c) >= 10) ? 1 : 0);
}
function toggleEuphoric() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const b = euphoriacBonus(c); if (!b) return;
  c.euphoric = !c.euphoric;
  logAct(c.euphoric
    ? `⚡ EUPHORIC — wild surge rush: +${b} morale on attack, damage, and saves for (surge intensity) rounds. (Not if neuralgia struck.)`
    : '⚡ Euphoria fades.');
  save(); renderSheet(); renderGear(); renderSkills();
}
function effAttrs(c) {
  const base = (c && c.attrs) || [10, 10, 10, 10, 10, 10];
  const b = attrItemBonuses(c).best;
  const nullSub = (c && c.nullified) ? suBakedPerAttr(c) : null;
  const out = base.map((v, i) => (v || 10) + b[i] - (nullSub ? nullSub[i] : 0));
  // v8.43.0: transient wired-buff attribute boosts (Animal Affinity, Iron
  // Body, the size pair…) — typed against the item door inside the helper;
  // NPF-suppressed there too. Every effAttrs consumer (attack Str, skills,
  // caster DCs, sheet boxes) inherits, exactly like the item door.
  {
    const _bd = activeBuffAttrDeltas(c);
    for (let i = 0; i < 6; i++) out[i] += _bd[i];
  }
  if (c && c.raging) { const t = rageTier(c); if (t) { out[0] += t.attr; out[2] += t.attr; } }
  if (c && c.fatigued && !c.raging) { out[0] -= 2; out[1] -= 2; }
  // v8.10.1: the Heavy's RKCM implant — +4 EQUIPMENT Dexterity (tech, not
  // Su: unaffected by ⊘ Nullified; lost while the RKCM is damaged — GM
  // toggles via c.rkcmDamaged).
  if (c && !c.rkcmDamaged && migrateLegacyClasses(c).some(e => e.name === 'Heavy' && (e.level || 0) >= 1)) out[1] += 4;
  // v8.14.x Segment B (Adam's ruling; FF p.618): equipped power armor —
  // Str (Min) is a FLOOR ("the wearer uses the armor's Strength or their
  // own, whichever is greater"), Dex (Max) a CEILING ("whichever is lower").
  // Firm-wired: flows to melee, Carry, Jump, Reflex, AC, Initiative, skills.
  // Tech, not Su — unaffected by ⊘ Nullified. The Land Warrior's HH-era
  // idiom is +2 EQUIPMENT Str instead of a floor.
  if (c) {
    const _paIt = equippedPowerArmor(c);
    if (_paIt) {
      const _pa = POWER_ARMOR_DB[_paIt.ref];
      if (_pa.equipStrMod) out[0] += _pa.equipStrMod;
      if (_pa.strMin) out[0] = Math.max(out[0], _pa.strMin);
      if (_pa.dexMax) out[1] = Math.min(out[1], _pa.dexMax);
    }
  }
  // v8.50.0: GENERAL ATTRIBUTE DAMAGE (Ego Whip, a Shadow's touch, poison —
  // HH "Ability Damage" / the "Ability Damaged" condition): temporary, full
  // effect, NO half-floor (that dignity line is horror-only), heals 1 per
  // evening of rest. Applied BEFORE the horror clamp, so a frayed mind
  // floors at half of its CURRENT (damaged) normal. Ability DRAIN is
  // permanent — edit the attribute itself.
  if (c && Array.isArray(c.attrDmg)) {
    for (let i = 0; i < 6; i++) out[i] -= (c.attrDmg[i] || 0);
  }
  // v8.49.0 (Adam's HALF-FLOOR ruling, 2026-09-28): horror-born mental
  // damage frays performance but never lobotomizes — the PLAYED mental
  // attribute never falls below half its normal (post-door) value, rounded
  // up, while the full damage total still runs the break clock against the
  // base score inside the Mind's Ledger. "The mind never functions below
  // half until it breaks."
  if (c && c.mind && Array.isArray(c.mind.mdmg)) {
    for (let k = 0; k < 3; k++) {
      const d = c.mind.mdmg[k] || 0;
      if (d > 0) out[3 + k] = Math.max(out[3 + k] - d, Math.ceil(out[3 + k] / 2));
    }
  }
  return out;
}
function effAm(c, i) { return am(effAttrs(c)[i]); }
// Non-attribute firm-wired effects, bucketed for the typed-bonus engines.
// ============================================================================
// v8.42.0: ACTIVE POWER EFFECTS — the TRANSIENT-WIRED door (Adam's design,
// 2026-09-26; the fourth door beside hard-baked / firm-wired / manual).
// Manifesting a curated power writes a c.activeEffects ledger record whose
// bonus values are computed from the ACTUAL augment spend at cast time; the
// record feeds the typed bonus engine while it stands, and clears on rest
// (all of them — Adam: "all effects wear off at the very least when the
// character rests") or via the chip's ✕ (brief effects like Empty Mind are
// entrusted to the player). NPF: c.nullified suppresses ALL of these
// (Su/magical/psionic/Sp/Ps — Adam's ruling); chips grey, totals drop.
// Curation source: E_E_Buff_Census_2026-09-26.md — every entry below was
// verified against its full d: text (values, augment steps, Divine Favor's
// printed +6 cap, Mental Barrier's SINGLE-step +1-at-4-PP augment).
// `gated:true` = only-when-situational (inactive in totals, listed as
// conditional — the Thick Fur Coat pattern); a bare `cond` is an
// applies-by-default caveat carried in the label only.
// ============================================================================
const POWER_EFFECTS = {
  'Alter Self':            {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — physical qualities per the entry (manual)'},
  'Chameleon':             {eff: [{k:'skill', skill:'Hide', type:'enhancement', v:10}]},
  'Danger Sense':          {eff: [{k:'save', save:'ref', type:'insight', v:4, cond:'vs traps', gated:true}], note: 'uncanny-dodge augment options manual'},
  'Disguise Self':         {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'illusory glamer — hands-on inspection defeats it'},
  'Divine Favor':          {eff: [{k:'attack', type:'luck', v:1, scale:true}, {k:'damage', type:'luck', v:1, scale:true, cond:'weapon damage only'}], aug: {every:3, inc:1, cap:6}},
  'Elfsight':              {eff: [{k:'skill', skill:'Search', type:'untyped', v:2}, {k:'skill', skill:'Spot', type:'untyped', v:2}], note: 'low-light vision manual'},
  'Empty Mind':            {eff: [{k:'save', save:'will', type:'untyped', v:2, scale:true}], aug: {every:2, inc:1}, expires:'manual', note: 'until your next action — dismiss then'},
  'Foresight':             {eff: [{k:'ac', type:'insight', v:2}, {k:'save', save:'ref', type:'insight', v:2}], note: '"never surprised" rider manual'},
  'Glibness':              {eff: [{k:'skill', skill:'Bluff', type:'untyped', v:30, cond:'to convince others of the truth of your words', gated:true}]},
  'Grip of Iron':          {eff: [{k:'grapple', type:'enhancement', v:4, scale:true}], aug: {every:4, inc:1}},
  'Haste':                 {eff: [{k:'attack', type:'untyped', v:1}, {k:'ac', type:'dodge', v:1}, {k:'save', save:'ref', type:'dodge', v:1}], note: 'extra attack on a full attack + speed boost manual'},
  // v8.43.0 (Adam's redirect): the deflection augment is REPEATABLE (+1 per
  // 4 PP, multiple purchases — the "if you spend 4" wording confounded the
  // intent); the INDEPENDENT duration option (+1 round per 1 PP) is player-
  // tracked. Shared-stepper caveat: the wired value assumes augment PP
  // bought the bonus option.
  'Mental Barrier':        {eff: [{k:'ac', type:'deflection', v:4, scale:true}], aug: {every:4, inc:1}, expires:'manual', note: '1 round base — AC and duration purchases are itemized at cast (see the chip)'},
  'Metamorphosis':         {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — other qualities manual'},
  'Metamorphosis, Greater':{eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}], note: 'form change — other qualities manual'},
  'Metaphysical Claw':     {eff: [{k:'attack', type:'enhancement', v:1, scale:true, cond:'one natural weapon'}, {k:'damage', type:'enhancement', v:1, scale:true, cond:'one natural weapon'}], aug: {every:4, inc:1}, note: 'augment options itemized at cast'},
  'Precognition, Defensive': {eff: [{k:'ac', type:'insight', v:1, scale:true, cond:'void when Dex-denied'}, {k:'save', save:'all', type:'insight', v:1, scale:true, cond:'void when Dex-denied'}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Precognition, Offensive': {eff: [{k:'attack', type:'insight', v:1, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Prescience, Offensive': {eff: [{k:'damage', type:'insight', v:2, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'Shadow Body':           {eff: [{k:'skill', skill:'Hide', type:'untyped', v:15, cond:'to remain unnoticed', gated:true}], note: 'shadow-form riders manual'},
  'Steadfast Perception':  {eff: [{k:'skill', skill:'Spot', type:'enhancement', v:6}, {k:'skill', skill:'Search', type:'enhancement', v:6}], note: 'figment/glamer immunity manual'},
  'Thicken Skin':          {eff: [{k:'nac', type:'enhancement', v:1, scale:true}], aug: {every:3, inc:1}, note: 'augment options itemized at cast'},
  'True Strike':           {eff: [{k:'attack', type:'insight', v:20, cond:'next single attack roll'}], expires:'manual', note: 'dismiss after the attack; also ignores concealment miss chance'},
  // ---- v8.43.0 Cut 2: the TRANSIENT-ATTRS door (k:'attr' entries flow
  // through effAttrs via activeBuffAttrDeltas — typed vs the item door,
  // penalties stack, size/inherent/morale ride their own types) + verified
  // Tier C conditionals. Every value transcribed from full d: text. ----
  'Animal Affinity':       {attrChoice: true, eff: [], aug: {every:5}, note: '+4 enhancement to each chosen ability (+1 more choice per 5 augment PP); no bonus PP from boosting your manifesting ability — save DCs do rise (per entry)'},
  'Compression':           {eff: [{k:'attr', attr:'DEX', type:'size', v:2}, {k:'attr', attr:'STR', type:'size', v:-2}, {k:'attack', type:'size', v:1}, {k:'ac', type:'size', v:1}], note: 'one size category smaller — space/reach per entry (manual)'},
  'Divine Power':          {eff: [{k:'attr', attr:'STR', type:'enhancement', v:6}], note: 'BAB becomes your character level (may grant extra attacks) + 1 temp HP/CL — manual'},
  'Dispel [Alignment]':    {eff: [{k:'ac', type:'deflection', v:4, cond:'vs creatures of the targeted alignment', gated:true}], note: 'banishing touch / dispelling touch — manual; discharges on use'},
  'Expansion':             {eff: [{k:'attr', attr:'STR', type:'size', v:2}, {k:'attr', attr:'DEX', type:'size', v:-2}, {k:'attack', type:'size', v:-1}, {k:'ac', type:'size', v:-1}], note: 'one size category larger — space/reach manual; further augment options player-tracked'},
  'Form of Doom':          {eff: [{k:'skill', skill:'Disguise', type:'untyped', v:10}, {k:'nac', type:'natural', v:5}, {k:'attr', attr:'STR', type:'untyped', v:4}, {k:'dr', v:5, bypass:'—'}], note: 'Frightful Presence on a charge, tentacle attacks — manual (DR wired v8.86.0)'},
  'Graft Weapon':          {eff: [{k:'attack', type:'competence', v:1, cond:'grafted weapon', stacksAnyway:true}, {k:'damage', type:'competence', v:1, cond:'grafted weapon', stacksAnyway:true}], note: '24 hours; the weapon counts as BOTH natural and manufactured (printed stacks-anyway exception)'},
  'Iron Body':             {eff: [{k:'attr', attr:'STR', type:'enhancement', v:6}, {k:'attr', attr:'DEX', type:'untyped', v:-6}, {k:'dr', v:15, bypass:'adamantine'}], note: 'immunities, ½ speed, ASF 50%, ACP −8, iron-golem vulnerabilities — manual (DR wired v8.86.0)'},
  'Mental Pinnacle':       {eff: [{k:'attr', attr:'INT', type:'inherent', v:4}, {k:'attr', attr:'WIS', type:'inherent', v:4}, {k:'attr', attr:'CHA', type:'inherent', v:4}], note: 'minimum 15 each while active (check manually); +2 PP/level and the six-pick powers ride the existing Mental Pinnacle flow'},
  'Oak Body':              {eff: [{k:'attr', attr:'STR', type:'enhancement', v:4}, {k:'attr', attr:'DEX', type:'untyped', v:-2}, {k:'nac', type:'natural', v:5}, {k:'dr', v:10, bypass:'slashing'}], note: 'natural-typed NAC — overlaps (supersedes, never stacks with) existing natural armor; fire vulnerability, ½ speed, ACP −4, ASF 25% — manual (DR wired v8.86.0)'},
  'Righteous / Riotous Might': {eff: [{k:'attr', attr:'STR', type:'size', v:4}, {k:'attr', attr:'CON', type:'size', v:2}, {k:'nac', type:'enhancement', v:2}, {k:'dr', v:5, bypass:'evil-or-good'}], note: 'one size category larger (size AC/attack mods, space/reach) — manual; DR bypass is evil (positive channelers) or good (negative), and the 5 rises to 10 at CL 12 and 15 at CL 15 — apply by caster level at the table'},
  'Transformation':        {eff: [{k:'attr', attr:'STR', type:'enhancement', v:4}, {k:'attr', attr:'DEX', type:'enhancement', v:4}, {k:'attr', attr:'CON', type:'enhancement', v:4}, {k:'nac', type:'natural', v:4}, {k:'save', save:'fort', type:'competence', v:5}, {k:'skill', skill:'Intimidate', type:'competence', v:5}], note: 'BAB = character level + simple/martial proficiency — manual; NO spellcasting or manifesting while active'},
  // ---- v8.86.0 (Adam's Son-of-the-Sun report): the k:'dr' effect kind —
  // Damage Reduction from powers finally reaches computeDR (which had
  // carried "cast-time DR stays manual" since v8.8.0, before the ✨ and ◉
  // lanes existed). The typed-bonus engines ignore k:'dr'; computeDR reads
  // it from _buffEffectSources (transient casts AND perpetual Buffs). ----
  'Stoneskin':             {eff: [{k:'dr', v:10, bypass:'adamantine'}], note: 'cast route: discharges after absorbing 10 points × CL (min 70, max 150) — track at the table; the Super-Power Buff has NO absorption cap (printed: “at will for Super-Power Buff”)'},
  'Biofeedback':           {eff: [{k:'dr', v:2, bypass:'—', scale:true}], aug: {every:3, inc:1}, note: 'power x/− — does NOT stack with the class-level pool (FF p.523, the book’s own example): best applicable applies'},
};

// ============================================================================
// v8.44.0 (Cut 3, Adam's design): OPTION-AWARE AUGMENTS. Powers whose
// Augment offers independent purchases ("one or both of the following ways")
// get PER-OPTION steppers in the cast dialog — the itemized total shown
// before any PP move IS the pre-deduction confirmation Adam asked for, and
// the exact split flows to the wired chip (no more shared-stepper caveats)
// and to the cast result (Energy Current's dice-PP make dice, target-PP
// make targets, DC follows actual dice — not every PP).
// kinds: 'bonus' (feeds the wired effect's scale), 'duration' (+rounds per
// purchase, shown on the chip), 'dice' (damage dice for the result),
// 'count' (result display, e.g. secondary targets), 'flag' (once:true —
// bought or not, display-only). Every step verified against full d: text.
// ============================================================================
const AUGMENT_OPTIONS = {
  'Mental Barrier': [
    {id: 'bonus', label: '+1 deflection AC', step: 4, kind: 'bonus'},
    {id: 'dur',   label: '+1 round duration', step: 1, kind: 'duration', rounds: 1},
  ],
  'Precognition, Defensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Precognition, Offensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Prescience, Offensive': [
    {id: 'bonus', label: '+1 insight bonus', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Thicken Skin': [
    {id: 'bonus', label: '+1 natural AC', step: 3, kind: 'bonus'},
    {id: 'swift', label: 'manifest as a swift action', step: 6, kind: 'flag', once: true},
  ],
  'Metaphysical Claw': [
    {id: 'dur',   label: 'duration becomes 1 hour/level', step: 4, kind: 'flag', once: true, durOverride: '1 hour/level'},
    {id: 'bonus', label: '+1 enhancement (attack & damage)', step: 4, kind: 'bonus'},
  ],
  'Danger Sense': [
    {id: 'ud',  label: 'uncanny dodge', step: 3, kind: 'flag', once: true},
    {id: 'iud', label: 'improved uncanny dodge (as well)', step: 6, kind: 'flag', once: true},
  ],
  'Energy Current (aka Energy Conduit)': [
    {id: 'dice',   label: '+1 die (d6) damage', step: 1, kind: 'dice', dice: {n: 1, d: 6}, dcEveryDice: 2},
    {id: 'target', label: '+1 secondary target', step: 4, kind: 'count', noun: 'secondary target'},
  ],
};

// Human duration for a wired chip: printed duration × the pool's effective
// level at cast time, plus any purchased rounds. Falls back to the raw text.
function buffDurationText(spell, pool, c, extraRounds) {
  const raw = ((spell && spell.duration) || '').split('(')[0].trim();
  const cl = (computeCasterLevels(c)[pool] || 0);
  const xr = extraRounds || 0;
  let m;
  if ((m = raw.match(/^(\d+)\s*rounds?\/level/i))) return `${parseInt(m[1], 10) * cl + xr} rounds`;
  if ((m = raw.match(/^(\d+)\s*min(?:ute)?s?\.?\/level/i))) return `${parseInt(m[1], 10) * cl} min`;
  if ((m = raw.match(/^(\d+)\s*hours?\/level/i))) return `${parseInt(m[1], 10) * cl} hr`;
  if ((m = raw.match(/^(\d+)\s*rounds?$/i))) return `${parseInt(m[1], 10) + xr} round${parseInt(m[1], 10) + xr === 1 ? '' : 's'}`;
  if ((m = raw.match(/^(\d+)\s*min(?:ute)?s?\.?$/i))) return `${parseInt(m[1], 10)} min`;
  if (/^concentration/i.test(raw)) return raw + (xr ? ` +${xr} rounds` : '');
  return raw ? raw + (xr ? ` +${xr} rounds` : '') : '';
}

// ============================================================================
// v8.85.0: ◉ PERPETUAL BUFFS — Adam's three rulings (2026-10-03). Anything
// the catalog tags "Buff" is, as a bought super-power, PERPETUALLY in effect
// at no PP cost: (1) voluntarily suppressible (⏻ toggle — reactivation is
// free: "it would cost no PP to toggle the power back on"); (2) "in the
// strictest of terms, the power is ALWAYS manifested" — base values, at the
// character's ESL, unless the entry says otherwise (the diligence sweep found
// the book agreeing out loud: Stoneskin "at will for Super-Power Buff",
// Timeless Body "Permanent as Super-Power", Remove Disease "Mutant immune to
// disease", Freedom "cannot be affected"); (3) rung-priced families stand at
// the rung bought. COMPUTED, NEVER LEDGERED: the lane derives live from the
// owned super-pool records, so rest-clear and ✕ cannot touch it —
// constitution, not casting. SUPERSEDE RULE: invoking the power (0 PP, maybe
// augmented) writes the usual transient record, which outranks the standing
// base; rest clears the casting and the perpetual RESUMES. NPF suppresses
// the lane like every Su bake.
// ============================================================================
const PERPETUAL_NOTES = {
  'Cloak of Chaos':  'perpetual component: Protection from Law only — the full aura is a cast',
  'Holy Aura':       'perpetual component: Protection from Evil only — the full aura is a cast',
  'Shield of Law':   'perpetual component: Protection from Chaos only — the full aura is a cast',
  'Unholy Aura':     'perpetual component: Protection from Good only — the full aura is a cast',
  'Sustenance':      'standing — never needs food or water; the body manufactures its own nourishment',
  'Remove Disease':  'standing — immune to disease (printed: “Permanent; Mutant immune to disease”)',
  'Remove Paralysis':'standing — paralysis and related effects are shrugged off as they land',
  'Freedom':         'standing — cannot be affected by movement-restricting effects (printed in the entry)',
  'Regenerate':      'continuous — severed members regrow; ongoing healing per the entry',
  'Evade Burst':     'standing — the ectoplasmic shell is always ready (evasion rider per the entry)',
  'Know Direction and Location': 'standing — always knows where (and when) they are',
  'Stoneskin':       'at will (printed: “at will for Super-Power Buff”) — DR 10/adamantine; discharge per the entry',
  'Timeless Body (aka Invulnerability)': 'PERMANENT as Super-Power (printed — the GM’s permission is part of the price)',
  'Transformation':  '⚠ NO spellcasting or manifesting while active — suppress (⏻) to cast',
  'Iron Body':       '⚠ carries −6 DEX, half speed, ASF while active — suppress (⏻) to shed the iron',
  'Mental Pinnacle': 'modes chosen once, permanently — manifest the six picks as a Psion of your CL',
  'True Metabolism': 'continuous regeneration per the entry',
};
function perpetualBuffs(c) {
  const out = [];
  if (!c) return out;
  const transient = new Set((Array.isArray(c.activeEffects) ? c.activeEffects : []).map(a => a.name));
  const powers = getCharPowers(c);
  for (const p of powers) {
    if (p.pool !== 'super') continue;
    const sp = SPELLS_DB.find(s => s.name === p.name);
    const mpn = sp ? (sp.mp_note || '') : '';
    const tagged = /(^|[;|])\s*Buff\b/i.test(mpn);
    const partial = /includes .+ as Buff/i.test(mpn);
    if (!tagged && !partial) continue;
    if (tagged && !p.buff) p.buff = true;   // self-heal the pre-v8.85.0 stamp
    const spec = (!partial) ? (POWER_EFFECTS[p.name] || null) : null;
    const effects = (spec && Array.isArray(spec.eff) && !spec.attrChoice) ? spec.eff.map(e => ({...e})) : [];
    out.push({ name: p.name, rung: p.rung || null, partial: !!partial,
      suppressed: !!p.buffOff, superseded: transient.has(p.name), effects,
      note: PERPETUAL_NOTES[p.name] || (spec && spec.note) || '' });
  }
  return out;
}
function toggleBuffSuper(name) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  const p = (c.powers || []).find(x => x.pool === 'super' && x.name === name);
  if (!p) return;
  p.buffOff = !p.buffOff;
  logAct(`◉ ${name} ${p.buffOff ? 'voluntarily suppressed (⏻)' : 'reactivated — no PP, the power is always manifested'}.`);
  save(); renderSheet();
}
// The combined effect-source list both consumers iterate: the transient
// ledger plus the perpetual lane (suppressed / superseded / crunchless
// perpetuals contribute no numbers — their chips still render).
function _buffEffectSources(c) {
  const list = (c && Array.isArray(c.activeEffects)) ? c.activeEffects.slice() : [];
  for (const pb of perpetualBuffs(c)) {
    if (pb.suppressed || pb.superseded || !pb.effects.length) continue;
    list.push({ name: pb.name, effects: pb.effects, perpetual: true });
  }
  return list;
}

// Ledger → typed-bonus lists. Keys follow the house conventions so each
// consumer plugs in like an existing builder: fort/ref/will/ac/naturalAC/
// attack/damage/grapple + 'skill:<Name>'. Empty when nullified (NPF).
// v8.85.0: iterates _buffEffectSources — transient records + the perpetual lane.
function activeBuffBonuses(c) {
  const out = {};
  if (!c) return out;
  // v9.2.0: gear Boons are technology — they stand through a Null Power Field.
  const srcs = _buffEffectSources(c).filter(a => !c.nullified || a.gear);
  if (!srcs.length) return out;
  const push = (key, entry) => (out[key] = out[key] || []).push(entry);
  for (const a of srcs) {
    for (const e of a.effects) {
      const entry = { type: e.type || 'untyped', source: 'buff:' + a.name, value: e.v,
        label: `${a.name}${e.cond ? ' (' + e.cond + ')' : ''} — ${a.perpetual ? '◉ perpetual Buff' : 'active power'}` };
      if (e.gated && e.cond) entry.condition = e.cond;
      if (e.stacksAnyway) entry.stacksAnyway = true;  // Graft Weapon's printed exception
      if (e.k === 'save') { if (e.save === 'all') { push('fort', {...entry}); push('ref', {...entry}); push('will', {...entry}); } else push(e.save, entry); }
      else if (e.k === 'ac') push('ac', entry);
      else if (e.k === 'nac') push('naturalAC', entry);
      else if (e.k === 'attack') push('attack', entry);
      else if (e.k === 'damage') push('damage', entry);
      else if (e.k === 'grapple') push('grapple', entry);
      else if (e.k === 'skill') push('skill:' + e.skill, entry);
    }
  }
  return out;
}

// v8.43.0: transient-attrs door — per-attribute deltas from active effects.
// Typed rules: same-type buff bonuses take the best; ENHANCEMENT overlaps
// the item door (attrItemBonuses keeps the best item boost, enhancement-
// typed, so only the buff's excess applies); untyped bonuses and ALL
// penalties stack. NPF gate inherited (c.nullified → zero deltas).
function activeBuffAttrDeltas(c) {
  const delta = [0, 0, 0, 0, 0, 0];
  if (!c) return delta;
  const srcs = _buffEffectSources(c).filter(a => !c.nullified || a.gear);   // v8.85.0: + the perpetual lane; v9.2.0: gear passes the NPF gate
  if (!srcs.length) return delta;
  const itemBest = attrItemBonuses(c).best;
  const IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  for (let i = 0; i < 6; i++) {
    const byType = {};
    let untypedSum = 0, penalties = 0;
    for (const a of srcs) {
      for (const e of a.effects) {
        if (e.k !== 'attr' || IDX[e.attr] !== i) continue;
        if (e.v < 0) { penalties += e.v; continue; }
        const t = e.type || 'untyped';
        if (t === 'untyped') untypedSum += e.v;
        else byType[t] = Math.max(byType[t] || 0, e.v);
      }
    }
    let add = untypedSum;
    for (const t in byType) {
      add += (t === 'enhancement') ? Math.max(0, byType[t] - (itemBest[i] || 0)) : byType[t];
    }
    delta[i] = add + penalties;
  }
  return delta;
}

// Cast-time hook (called from castPowerAt's finish). Computes the augment
// increment from the actual PP spend; re-manifesting refreshes the record.
// v8.44.0: `augPicks` (from the option-aware cast dialog) carries the exact
// per-option split — bonus purchases scale the effect, duration purchases
// land on the chip, flags ride as notes. The generic every/at math remains
// the fallback for single-option powers and direct calls.
function applyWiredBuff(c, spellName, pool, extraPP, augPicks) {
  const spec = POWER_EFFECTS[spellName];
  if (!spec) return false;
  // v8.43.0: Animal Affinity's chosen-ability flow — one pick, +1 more per
  // 5 augment PP (each a DIFFERENT ability, per the printed Augment).
  if (spec.attrChoice) {
    const picks = 1 + (spec.aug && spec.aug.every ? Math.floor((extraPP || 0) / spec.aug.every) : 0);
    const chosen = [];
    const askNext = () => {
      const remaining = ATTR_NAMES.filter(a => !chosen.includes(a));
      openChoiceModal(`${spellName} — choose ability ${chosen.length + 1} of ${picks} (+4 enhancement)`, remaining, (sel) => {
        chosen.push(sel);
        if (chosen.length < picks) { askNext(); return; }
        if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
        c.activeEffects = c.activeEffects.filter(x => x.name !== spellName);
        c.activeEffects.push({ id: 'ae-' + Date.now().toString(36), name: spellName, pool: pool,
          effects: chosen.map(a => ({k: 'attr', attr: a, type: 'enhancement', v: 4})),
          note: spec.note || '', expires: spec.expires || 'rest',
          appliedAt: new Date().toLocaleString(), augSpent: extraPP || 0 });
        toast(`✨ ${spellName} wired: +4 enhancement to ${chosen.join(', ')} — active until rest or ✕.`);
        save();
        renderActiveBuffs(c);
      });
    };
    askNext();
    return true;
  }
  let inc = 0, extraRounds = 0, durOverride = null;
  const pickBits = [];
  const optDefs = (AUGMENT_OPTIONS[spellName]) || null;
  if (optDefs && augPicks) {
    // exact declared split — no estimation.
    for (const o of optDefs) {
      const n = augPicks[o.id] || 0;
      if (!n) continue;
      if (o.kind === 'bonus') inc += n * ((spec.aug && spec.aug.inc) || 1);
      else if (o.kind === 'duration') extraRounds += n * (o.rounds || 1);
      else if (o.kind === 'flag') { pickBits.push(o.label); if (o.durOverride) durOverride = o.durOverride; }
    }
  } else if (spec.aug) {
    if (spec.aug.every) inc = Math.floor((extraPP || 0) / spec.aug.every) * (spec.aug.inc || 1);
    else if (spec.aug.at) inc = (extraPP || 0) >= spec.aug.at ? (spec.aug.inc || 1) : 0;
  }
  const effects = spec.eff.map(e => {
    let v = e.v + (e.scale ? inc : 0);
    if (spec.aug && spec.aug.cap) v = Math.min(v, spec.aug.cap);
    return {...e, v};
  });
  // v8.44.0: human duration on the chip (printed duration × pool level at
  // cast + purchased rounds; flag overrides like Metaphysical Claw's
  // 1 hour/level honored).
  let durText = '';
  try {
    const spellObj = SPELLS_DB.find(s => s.name === spellName);
    durText = buffDurationText(durOverride ? {duration: durOverride} : spellObj, pool, c, extraRounds);
  } catch (e) {}
  if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
  c.activeEffects = c.activeEffects.filter(a => a.name !== spellName);
  c.activeEffects.push({ id: 'ae-' + Date.now().toString(36), name: spellName, pool: pool,
    effects, note: spec.note || '', expires: spec.expires || 'rest',
    appliedAt: new Date().toLocaleString(), augSpent: extraPP || 0,
    durText, picks: pickBits.length ? pickBits : undefined });
  toast(`✨ ${spellName} is now wired to the sheet${inc ? ` (augmented: +${inc})` : ''}${durText ? ` — ${durText}` : ''} — active until rest or ✕ on the Sheet.`);
  return true;
}

// Rest clears EVERYTHING (Adam: "all effects wear off at the very least
// when the character rests" — manual-expiry ones certainly included).
function clearActiveBuffs(c, why) {
  if (!c || !Array.isArray(c.activeEffects) || !c.activeEffects.length) return 0;
  const keep = c.activeEffects.filter(a => a.keepOnRest);   // v9.2.0: Boost's Bane outlasts a rest (24 h)
  const ending = c.activeEffects.filter(a => !a.keepOnRest);
  const n = ending.length; if (!n) return 0;
  const names = ending.map(a => a.name).join(', ');
  c.activeEffects = keep;
  for (const a of ending) if (a.bane) boostBaneRoll(c);
  if (c.id === curId) logAct(`✨ Active power effects ended (${why}): ${names}.${(perpetualBuffs(c).some(pb => !pb.suppressed)) ? ' ◉ Perpetual Buffs stand — constitution, not casting.' : ''}`);
  return n;
}
function dismissBuffAt(i) {
  const c = chars.find(x => x.id === curId);
  if (!c || !Array.isArray(c.activeEffects)) return;
  const a = c.activeEffects.splice(i, 1)[0];
  if (a) logAct(`✨ ${a.name} effect ended (dismissed).`);
  if (a && a.bane) boostBaneRoll(c);   // v9.2.0: Boost → the Bane roll
  if (a && a.gearItemId) { renderGear(); renderSkills(); }
  save(); renderSheet();
}
function renderActiveBuffs(c) {
  const slot = document.getElementById('sh-buffs');
  if (!slot) return;
  const list = (c && c.activeEffects) || [];
  const perps = perpetualBuffs(c);
  const worn = wornGearOf(c);
  if (!list.length && !perps.length && !worn.length) { slot.innerHTML = ''; slot.style.display = 'none'; return; }
  slot.style.display = 'block';
  const fmt = (e) => {
    if (e.k === 'dr') return `DR ${e.v}/${e.bypass || '—'}`;   // v8.86.0
    if (e.k === 'resist') return `resist ${e.energy || 'energy'} ${e.v}`;   // v9.2.0 gear kinds
    if (e.k === 'fly') return `fly ${e.v} ft${e.note ? ' (' + e.note + ')' : ''}`;
    if (e.k === 'speed') return `+${e.v} ft speed`;
    if (e.k === 'immune') return `immune: ${e.what}`;
    if (e.k === 'note') return e.text;
    if (e.cond) return `${e.v >= 0 ? '+' : ''}${e.v} ${e.type} ${e.k === 'save' ? e.save.toUpperCase() : e.k} (${e.cond})`;
    const tgt = e.k === 'save' ? (e.save === 'all' ? 'all saves' : e.save.toUpperCase() + ' save')
      : e.k === 'skill' ? e.skill : e.k === 'nac' ? 'natural AC' : e.k === 'ac' ? 'AC'
      : e.k === 'attr' ? e.attr : e.k;
    return `${e.v >= 0 ? '+' : ''}${e.v} ${e.type} ${tgt}`;
  };
  // v8.85.0: ◉ perpetual chips lead — gold-edged, with the ⏻ suppression
  // toggle (reactivation free per the ruling). Suppressed = dimmed ◌;
  // superseded = the invoked transient outranks the base until rest.
  const perpChip = (pb) => {
    const off = pb.suppressed, dim = off || c.nullified;
    const crunch = pb.effects.length ? pb.effects.map(fmt).join(', ') : '';
    const tip = (pb.note ? pb.note + ' · ' : '') + (off ? 'voluntarily suppressed — ⏻ reactivates at no PP ("always manifested")' : 'perpetual Buff — bought with MP, always manifested at base values (ESL); invoke it (0 PP + augment) for a boosted casting') + (pb.superseded && !off ? ' · an invoked casting currently supersedes the standing base' : '');
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid rgba(200,151,30,.45);border-radius:3px;background:rgba(200,151,30,.08);font-size:11px;${dim ? 'opacity:.45;' : ''}" title="${escapeHTML(tip)}">${off ? '◌' : '◉'} <b>${escapeHTML(pb.name)}</b>${pb.rung ? ` <span style="color:var(--vio);">[${escapeHTML(pb.rung)}]</span>` : ''}${crunch && !off ? ` ${escapeHTML(crunch)}` : ''}${off ? ' <span style="font-style:italic;color:var(--g70);">suppressed</span>' : pb.superseded ? ' <span style="font-style:italic;color:#9cc3da;">· invoked version active</span>' : ''} <b style="cursor:pointer;color:${off ? '#8fcf9a' : '#d4b870'};" data-n="${escapeHTML(pb.name)}" onclick="toggleBuffSuper(this.dataset.n)" title="${off ? 'Reactivate (no PP)' : 'Voluntarily suppress this power'}">⏻</b></span>`;
  };
  slot.innerHTML = (c.nullified ? `<div style="font-size:11px;color:var(--vio);margin-bottom:3px;">⊘ Null Power Field — active-power bonuses SUPPRESSED (shown greyed):</div>` : '')
    + perps.map(perpChip).join('')
    + worn.map(it => { const w = gearDef(it).worn; const bits = [w.carry ? `+${w.carry} Str (carrying)` : '', w.sense || '', ...(w.immune || []).map(x => 'immune: ' + x), ...(w.grants || []).map(g => `${g.v >= 0 ? '+' : ''}${g.v} ${g.t.replace('skill:', '')}`)].filter(Boolean); return `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid rgba(160,150,120,.4);border-radius:3px;background:rgba(160,150,120,.06);font-size:11px;" title="Worn gear — remove it on the Gear tab.">🎒 <b>${escapeHTML(it.ref)}</b> ${escapeHTML(bits.join(', '))}</span>`; }).join('')
    + list.map((a, i) => `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid ${a.gear ? 'rgba(140,200,150,.45)' : 'rgba(120,175,205,.4)'};border-radius:3px;background:${a.gear ? 'rgba(140,200,150,.07)' : 'rgba(120,175,205,.07)'};font-size:11px;${c.nullified && !a.gear ? 'opacity:.4;' : ''}" title="${escapeHTML(((a.picks && a.picks.length) ? a.picks.join(' · ') + ' · ' : '') + (a.note || '') + (a.gear ? ' · gear Boon (technology — stands in a Null Power Field) · ✕ to end' : (a.expires === 'manual' ? ' · brief duration — dismiss manually (✕)' : ' · clears on rest')))}">${a.gear ? (a.name === BOOST_BANE ? '☠' : '⚡') : '✨'} <b>${escapeHTML(a.name)}</b> ${escapeHTML(a.effects.map(fmt).join(', '))}${a.durText ? ` <span style="color:#9cc3da;">· ${escapeHTML(a.durText)}</span>` : ''}${a.augSpent ? ` <span style="opacity:var(--o60);color:var(--dim);">(+${a.augSpent} PP)</span>` : ''} <b style="cursor:pointer;color:var(--red-text);" onclick="dismissBuffAt(${i})" title="End this effect">✕</b></span>`).join('');
}

