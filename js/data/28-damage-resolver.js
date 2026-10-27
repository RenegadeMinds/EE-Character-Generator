// =============================================================================
// js/data/28-damage-resolver.js
// DAMAGE RESOLVER
// =============================================================================
//
// WHAT'S IN HERE
//   DamageResolver: pure functions that turn damage atoms into labels,
//   applicable resistances, immunity gates and alignment outcomes. Code, but
//   generated along with the data.
//
// ORIGINALLY GENERATED: READ THIS BEFORE CHANGING THE DATA
//   These tables were first built by Adam's data-build scripts
//   (equipment_substrate/build_inline_all.mjs (plus the damage_, spells_ and
//   vehicles_substrate builders)), which live in the private EE-Rulebooks
//   repository. Those scripts are NOT a working build any more: each was
//   written to patch one specific old copy of the generator (the newest
//   targets v8.49.0), and since then the data has been edited directly in the
//   generator. For most catalogs (equipment, armor, gadgets, weapons, item
//   slots, vehicles, magic items) their source JSON files are now OLDER than
//   this file, and some catalogs are missing from the combined block entirely,
//   so re-running them would silently delete newer content. Treat THIS file as
//   the source of truth. The JSON/END marker comments around each table, and
//   the BEGIN/END substrate banner lines, are kept unchanged so a future
//   script can still find the tables.
//
// KEY NAMES (so you can search for them)
//   tables/objects: DamageResolver, FIVE, PHYSICAL, ENERGY_TECH_VARIANT,
//   DERIVED_PARENT, ALIGN_LABEL, ALIGN_OPP, POLE_RIDER
//   functions (11): hasMindAffecting, alignmentPole, renderLabel,
//   isUniversalCovered, specificResistanceType, applicableResistances,
//   immunityGates, vsObjects, expandTemplate, alignmentOutcome, resolve
//
// LOAD ORDER
//   File 28 of 68. index.html loads it after js/data/27-spell-damage.js and
//   before js/data/29-weapons.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 21266-21396 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 21266-21396; unchanged below this line ----
const DamageResolver = (function () {
const canon = DAMAGE_TYPES;
// resolver.mjs — the resolution layer. Pure functions: spell/power damage
// ATOMS -> what play needs (rendered label, applicable resistances, immunity
// gates, vs-objects/hardness, energy-template expansion, alignment outcome).
//
// DOM-free by design so the grader can exercise it headlessly. Nothing here is
// stored on entries; it is all COMPUTED from the atoms + the canonical schema.
// This is the "store atoms, render the artifact" principle in code.



// Per-type metadata lookup (ignores_hardness, vs_objects, ...).
const typeMeta = {};
for (const d of [...(canon.base_descriptors || []), ...(canon.derived_descriptors || []), ...(canon.exotic_tier || [])]) typeMeta[d.id] = d;
typeMeta['untyped'] = canon.untyped || {};

const FIVE = ['acid', 'cold', 'electricity', 'fire', 'sonic'];
const PHYSICAL = ['bludgeoning', 'piercing', 'slashing'];
const ENERGY_TECH_VARIANT = ['laser', 'cryonic', 'ionic'];   // energy-class tech variants
const DERIVED_PARENT = { ballistic: 'piercing', cryonic: 'cold', laser: 'fire', ionic: 'electricity', concussion: 'force' };

const ALIGN_LABEL = { good: 'holy', evil: 'unholy', lawful: 'axiomatic', chaotic: 'anarchic' };
const ALIGN_OPP   = { good: 'evil', evil: 'good', lawful: 'chaotic', chaotic: 'lawful' };
const POLE_RIDER  = { good: 'blinded', evil: 'sickened', lawful: 'dazed', chaotic: 'slowed' };

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

function hasMindAffecting(s) { return (s.descriptors || []).includes('mind-affecting'); }
function alignmentPole(s) {
  const a = (s.descriptors || []).find(d => d && typeof d === 'object' && 'alignment' in d);
  return a ? a.alignment : null;
}

// --- (b) Derived display label — computed, never stored. ---
function renderLabel(s) {
  if (s.is_template) return 'energy (choose element at cast)';
  if (s.type === 'untyped') {
    const pole = alignmentPole(s);
    if (pole) return ALIGN_LABEL[pole];          // holy / unholy / axiomatic / anarchic
    if (hasMindAffecting(s)) return 'psychic';   // untyped + mind-affecting
    return 'untyped';
  }
  return s.type;                                  // explicit type is its own label
}

// --- (e) Which resistances reduce it. Universal energy resistance = bodily
// cohesion: covers the 5 elements (+ their energy tech variants) + force +
// disintegration + untyped; NOT physical, NOT (per current reading) exotic
// negative/positive energy. ---
function isUniversalCovered(t) {
  if (PHYSICAL.includes(t) || t === 'ballistic') return false;
  if (t === 'negative_energy' || t === 'positive_energy') return false; // FLAG: spec underspecifies; treated as not-covered
  if (['untyped', 'disintegration', 'force', 'concussion', 'plasma'].includes(t)) return true;
  if (FIVE.includes(t) || ENERGY_TECH_VARIANT.includes(t)) return true;
  return false;
}
function specificResistanceType(t) { return DERIVED_PARENT[t] || t; }

function applicableResistances(s) {
  const t = s.is_template ? null : s.type;
  const out = [];
  if (t === null) return ['(per chosen element) its elemental resistance + universal energy resistance'];
  if (PHYSICAL.includes(t)) out.push('DR (vs physical)');
  else if (t === 'ballistic') out.push('DR (vs physical; ballistic deals full vs objects)');
  else if (t === 'untyped' || t === 'disintegration') { /* no individual resistance */ }
  else if (t === 'plasma') out.push('fire AND acid resistance (both required)');
  else { const p = specificResistanceType(t); out.push(p === t ? `${t} resistance` : `${p} resistance (${t} inherits)`); }
  if (isUniversalCovered(t)) out.push('universal energy resistance');
  return out;
}

// --- (f) + (a) + (g) Immunity / targeting gates that fire. ---
function immunityGates(s) {
  const gates = [];
  if (hasMindAffecting(s)) {
    gates.push({ gate: 'mind-affecting', immune: ['mindless (no Int score)', 'constructs (incl. sentient)', 'oozes', 'vermin', 'undead (by convention)'] });
  }
  if (s.lethality === 'nonlethal') {
    gates.push({ gate: 'nonlethal-applicability', immune: ['constructs', 'undead'], exception: 'tech constructs take nonlethal only from electricity/ionic' });
  }
  const pole = alignmentPole(s);
  if (pole) {
    gates.push({ gate: 'alignment', pole, rule: `full vs ${ALIGN_OPP[pole]}, half vs neutral, none vs ${pole}`, rider: POLE_RIDER[pole], outsider: `heavier dice vs opposed (${ALIGN_OPP[pole]}) outsider` });
  }
  return gates;
}

// --- vs-objects / hardness from the canonical type entry. ---
function vsObjects(s) {
  if (s.is_template) return { ignores_hardness: null, vs_objects: '(per chosen element)' };
  const m = typeMeta[s.type] || {};
  return { ignores_hardness: !!m.ignores_hardness, vs_objects: m.vs_objects || null };
}

// --- (c) Energy-template expansion -> 5 fully-typed concretes. ---
function expandTemplate(s) {
  if (!s.is_template) return [s];
  const rest = s.name.replace(/^Energy\s+/i, '').trim();   // "Energy Bolt" -> "Bolt"
  return (s.elements || FIVE).map(el => ({
    ...s,
    name: `${cap(el)} ${rest}`.trim(),                       // -> "Fire Bolt"
    type: el, is_template: false, binding: undefined, elements: undefined,
    expanded_from: s.name,
  }));
}

// --- (g) Alignment outcome vs a target pole (good/evil/lawful/chaotic/neutral/null). ---
function alignmentOutcome(s, targetPole) {
  const pole = alignmentPole(s);
  if (!pole) return null;
  if (targetPole === pole) return { damage: 'none' };
  if (targetPole === ALIGN_OPP[pole]) return { damage: 'full', rider: POLE_RIDER[pole], outsider_bonus: true };
  return { damage: 'half' };   // neutral on the axis
}

// --- Convenience: full resolution bundle for one entry. ---
function resolve(s, targetPole = null) {
  return {
    name: s.name,
    label: renderLabel(s),
    resistances: applicableResistances(s),
    gates: immunityGates(s),
    vs_objects: vsObjects(s),
    ...(s.is_template ? { expands_to: expandTemplate(s).map(x => x.name) } : {}),
    ...(alignmentPole(s) ? { alignment_vs_target: alignmentOutcome(s, targetPole) } : {}),
  };
}
return { renderLabel, hasMindAffecting, alignmentPole, applicableResistances, immunityGates, vsObjects, expandTemplate, alignmentOutcome, resolve };
})();

