// =============================================================================
// js/app/52-energy-immunity-and-spell-lists.js
// ENERGY IMMUNITY AND SPELL LISTS
// =============================================================================
//
// WHAT'S IN HERE
//   Energy-immunity talent picks, and the spell/power list tokens, schools and
//   variant names used by the Powers/Spells pages.
//
// KEY NAMES (so you can search for them)
//   tables/objects: ENERGY_RES_TREE, SPELL_LIST_TOKENS, PSIONIC_SCHOOLS,
//   VARIANT_NAMES, VARIANTS_BY_PARENT
//   functions (6): grantEnergyImmunityPick, spendTalentAP, removeTalentClick,
//   spellSchool, isPsionicSpell, displayNameForRoute
//
// LOAD ORDER
//   File 52 of 68. index.html loads it after
//   js/app/51-gm-exceptions-and-talents-page.js and before
//   js/data/53-domains.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 44352-44553 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 44352-44553; unchanged below this line ----
// ============================================================================
// v8.87.0 (Adam's intent ruling, 2026-10-03): ENERGY IMMUNITY, the two-step
// engine. The printed d: was read as conversion-only; the intent: (1) buying
// it grants ONE FREE talent from the Energy Resistance Tree — no slot, no
// MP ("Choose another Talent from the Energy Resistance Talent Tree"), THEN
// (2) immunity to every type whose Resistance talent is owned (already wired
// in computeResistances). Floor: a one-resistance buyer walks away immune to
// TWO types. Ceiling: whole tree already owned → the grant is "potentially
// extraneous" (his words) and is skipped with a note. The granted record
// carries grantedBy:'Energy Immunity' — exempt from the slot budget, and it
// cascades away if Energy Immunity itself is removed.
// ============================================================================
const ENERGY_RES_TREE = ['Acid Resistance', 'Cold Resistance', 'Electricity Resistance', 'Fire Resistance', 'Sonic/Concussion Resistance'];
function grantEnergyImmunityPick(c) {
  const owned = new Set((c.talents || []).map(t => t.name));
  const options = ENERGY_RES_TREE.filter(n => !owned.has(n));
  if (!options.length) {
    toast('◈ Energy Immunity: all five Energy Resistance talents already owned — the bonus grant is extraneous; immunity already covers the full tree.');
    return;
  }
  openChoiceModal('Energy Immunity — choose your FREE Energy Resistance talent (granted; no Talent slot, no MP)', options, (sel) => {
    if (!sel) return;
    if (addTalentToChar(c, sel)) {
      const rec = (c.talents || []).find(t => t.name === sel);
      if (rec) rec.grantedBy = 'Energy Immunity';
      logAct(`◈ ${sel} granted FREE by Energy Immunity (no Talent slot consumed) — immunity now covers every owned Resistance type.`);
      save(); filterTalents();
      renderSheet();
      toast(`◈ ${sel} granted by Energy Immunity — now immune to all owned Resistance types.`);
    }
  });
}

// v8.5.0 Layer 2: spend AP to activate an AP-SPEND talent (Defensive Roll,
// Opportunist, Second Wind, Healing Hands). Routes through adjustAPSilent so
// the spend lands in the action log with the talent as its reason; the AP
// bar on the Tracker page refreshes automatically.
function spendTalentAP(name, cost) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if ((c.ap || 0) < cost) {
    toast(`Not enough AP — ${name} costs ${cost}, you have ${c.ap || 0}.`);
    return;
  }
  adjustAPSilent(c, -cost, `Talent: ${name}`, '');
  toast(`Spent ${cost} AP on ${name} (${c.ap}/${c.apMax} AP remaining).`);
}

async function removeTalentClick(name, param) {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!(await confirmModal(`Remove ${name}${param ? ` (${param})` : ''}?`))) return;
  if (removeTalentFromChar(c, name, param)) {
    save();
    renderTalents();
    // If browser is open, refresh it too (so the Owned status updates).
    const browser = document.getElementById('talent-browser');
    if (browser && browser.style.display !== 'none') filterTalents();
    toast(`Removed ${name}.`);
  }
}

// ============================================================================
// v8.5.2 Phase C: POWERS & SPELLS — repertoire layer.
// Character data: c.powers[] = {name, pool:'arcane'|'divine'|'psionic',
// grantedAt:{level, atDate}}. Lazily defaulted like c.items/c.feats — no
// schemaVer bump (same deliberate convention as c.items; see that comment).
// Reference data: the inlined SPELLS_DB (643 entries). Budgets come from
// computeCasterStats: powersKnownTotal is only ever contributed by the
// psionic classes (Psion/Wilder/Warmind) — E&E's design gives the other
// casters NO known-count limit, so their pools show "no limit" and only the
// maxPowerLvl gate applies. Per-day PREPARATION for prep casters is
// deliberately NOT tracked (Adam, 2026-07-11: repertoire now, prep later).
// ============================================================================

// Class → spell-list token(s). Tokens match SPELLS_DB levels[].cls. Advisory
// flags mark GM-confirm territory: Saint has no own list token in the corpus
// (mapped to the Cleric list), and Psion discipline powers depend on a chosen
// discipline the generator doesn't yet track.
// v8.5.4: class sub-options are live (Adam's rulings, 2026-08-24, verified
// against the HH class entries):
//   • Cleric — c.clericDomains (2 picks; Expanded/Additional Domain add more
//     later) put their domain tokens on the divine pool. c.druidOption swaps
//     the Cleric onto the Druid list ('Drd') and forfeits domains + Turn
//     Undead ("The Druid Option", end of the HH Cleric entry).
//   • Saint — c.saintDomains (ALL the deity's domains, typically 3-4) ARE the
//     spell list; Personal Domain picks ride through the Powers tab.
//     Unconfigured Saints keep the old Cleric-list advisory fallback.
//   • Psion — c.psionDiscipline hard-gates discipline tokens (HH: "cannot
//     learn powers that are restricted to other disciplines… can't even use
//     such powers by employing psionic items"; Expanded Knowledge is the
//     explicit bypass). Unconfigured Psions keep the GM-confirm advisory.
//   • Wizard — c.wizardProhibited hard-blocks prohibited schools ("can't
//     even cast such spells from scrolls") unless another arcane class also
//     reaches the Sor/Wiz token.
//   • 'War' token disambiguation: 'War' is BOTH the Warmind class list and
//     the War domain. Warmind routes require a psionic-discipline school;
//     divine domain routes require a magic school (see isPsionicSpell).
const SPELL_LIST_TOKENS = {
  'Wizard':   { pool: 'arcane',  tokens: ['Sor/Wiz'] },
  'Sorcerer': { pool: 'arcane',  tokens: ['Sor/Wiz'] },
  'Bard':     { pool: 'arcane',  tokens: ['Brd'] },
  'Cleric':   { pool: 'divine',  tokens: ['Clr'] },
  'Saint':    { pool: 'divine',  tokens: ['Clr'], advisory: 'Saint: choose your deity’s domains in the class options — using the Cleric list until then (GM confirm)' },
  // v8.5.4: Paladin casts spontaneously from their god's Domain lists ("like
  // a Saint", HH Paladin entry) — routed via c.paladinDomains below; the old
  // 'Pal' token matched zero spells in the corpus. Ranger draws from the
  // Druid spell list, prepared like a Cleric (HH Ranger entry) — 'Rgr' was
  // likewise dead. Both cast from 4th level via their lesser progressions.
  'Paladin':  { pool: 'divine',  tokens: [] },
  'Ranger':   { pool: 'divine',  tokens: ['Drd'] },
  'Psion':    { pool: 'psionic', tokens: ['Psi/Wld'], disciplineTokens: ['Telepath', 'Seer', 'Kineticist', 'Egoist', 'Nomad', 'Shaper'] },
  'Wilder':   { pool: 'psionic', tokens: ['Psi/Wld'] },
  'Warmind':  { pool: 'psionic', tokens: ['War'], psionicOnly: true },
};

// v8.5.4: the six psionic discipline school names as they appear in
// school_raw. Distinguishes psionic powers from magic spells — load-bearing
// for the 'War' token disambiguation and discipline gating.
const PSIONIC_SCHOOLS = ['Clairsentience', 'Metacreativity', 'Psychokinesis', 'Psychometabolism', 'Psychoportation', 'Telepathy'];
function spellSchool(s) { const m = /^([A-Za-z]+)/.exec((s && s.school_raw) || ''); return m ? m[1] : null; }
function isPsionicSpell(s) { return PSIONIC_SCHOOLS.includes(spellSchool(s)); }

// v8.5.4: SOURCE-SENSITIVE display names (Adam, 2026-08-24). Ch.IX names many
// entries per-tradition via "Arcane/Divine/Super-Power Variant:" subtitles,
// and each DOMAIN's 1-9 list names its slots in its own idiom — the
// Technology domain's 7th is "Build Database" (= Legend Lore), the Strength
// domain's 1st is "Enlarge Person" (= Expansion). A route therefore knows its
// proper name from HOW the character reaches the spell. Census source:
// domains_substrate/domain_aliases.json (variantNames, harvest_variants.py).
const VARIANT_NAMES = {
  // v8.8.0 (Adam's report — no Buy button on Bull's Strength/Cat's Grace):
  // the Animal Affinity attribute family (recovered bare-Level G6 entries)
  // are variants of the one-size-fits-all parent; superBuySpec prices their
  // super-power purchase at Animal Affinity's 4 MP. (Their Mass versions
  // lack book MP costs entirely — errata territory, not variant-mapped.)
  // v8.16.1: the 2026-09-03 HH's Permanency carries "Psionic Variant:
  // Incarnate" — psionic routes display the variant name.
  'Incarnate':{parent:'Permanency',kind:'Psionic'},
  'Bear’s Endurance':{parent:'Animal Affinity',kind:'Arcane'}, 'Bull’s Strength':{parent:'Animal Affinity',kind:'Arcane'},
  'Cat’s Grace':{parent:'Animal Affinity',kind:'Arcane'}, 'Eagle’s Splendor':{parent:'Animal Affinity',kind:'Arcane'},
  'Fox’s Cunning':{parent:'Animal Affinity',kind:'Arcane'}, 'Owl’s Wisdom':{parent:'Animal Affinity',kind:'Arcane'},
  'Animate Rope':{parent:'Control Object',kind:'Arcane'}, 'Arcane Lock':{parent:'Lock',kind:'Arcane'},
  'Build Database':{parent:'Legend Lore',kind:'Divine'}, 'Charm Animal':{parent:'Charm Being',kind:'Arcane'},
  'Charm Monster':{parent:'Charm Being',kind:'Arcane'}, 'Charm Person':{parent:'Charm Being',kind:'Arcane'},
  'Clairaudience/Clairvoyance':{parent:'Clairvoyant Sense',kind:'Arcane'},
  'Dominate Animal':{parent:'Dominate Being',kind:'Arcane'}, 'Dominate Monster':{parent:'Dominate Being',kind:'Arcane'},
  'Dominate Person':{parent:'Dominate Being',kind:'Arcane'}, 'Enlarge Person':{parent:'Expansion',kind:'Arcane'},
  'Goodberry':{parent:'Sustenance',kind:'Divine'}, 'Hibernate':{parent:'Suspend Life',kind:'Divine'},
  'Hold Animal':{parent:'Hold Being',kind:'Arcane'}, 'Hold Monster':{parent:'Hold Being',kind:'Arcane'},
  'Hold Person':{parent:'Hold Being',kind:'Arcane'}, 'Hold Portal':{parent:'Lock',kind:'Arcane'},
  'Holographic Image':{parent:'Project Image',kind:'Divine'}, 'Hyperalgorithm':{parent:'Hypercognition',kind:'Divine'},
  'Immunity to Disease':{parent:'Remove Disease',kind:'Super-Power'}, 'Immunity to Fear':{parent:'Remove Fear',kind:'Super-Power'},
  'Immunity to Paralysis':{parent:'Remove Paralysis',kind:'Super-Power'}, 'Immunity to Poison':{parent:'Neutralize Poison',kind:'Super-Power'},
  'Instant Summons':{parent:'Retrieve',kind:'Arcane'}, 'Karmic Favor':{parent:'Divine Favor',kind:'Super-Power'},
  'Mage Armor':{parent:'Inertial Armor',kind:'Arcane'}, 'Mage Hand':{parent:'Far Hand',kind:'Arcane'},
  'Message':{parent:'Missive',kind:'Arcane'}, 'Nature’s Avenger':{parent:'Form of Doom',kind:'Divine'},
  'Obscure Object':{parent:'Escape Detection',kind:'Arcane'}, 'Polymorph':{parent:'Metamorphosis',kind:'Arcane'},
  'Reduce Animal':{parent:'Compression',kind:'Arcane'}, 'Reduce Person':{parent:'Compression',kind:'Arcane'},
  'Restore Body':{parent:'Restore Extremity',kind:'Super-Power'}, 'Shield':{parent:'Force Screen / Shield',kind:'Arcane'},
  'Shield Other':{parent:'Share Pain',kind:'Divine'}, 'Spectral Weapon':{parent:'Spiritual Weapon',kind:'Super-Power'},
  'Spell Resistance':{parent:'Power / Spell Resistance',kind:'Arcane'}, 'Telepathic Bond':{parent:'Mindlink',kind:'Arcane'},
  'Teleport Object':{parent:'Teleport, Greater',kind:'Arcane'}, 'Universal Energy Resistance':{parent:'Energy Adaptation',kind:'Super-Power'},
  'Virtual Reality':{parent:'Microcosm',kind:'Divine'}, 'Wildshape':{parent:'Metamorphosis',kind:'Divine'},
  'Zone of Discord':{parent:'Song of Discord',kind:'Super-Power'},
};
const VARIANTS_BY_PARENT = {};
for (const _v in VARIANT_NAMES) {
  const e = VARIANT_NAMES[_v];
  (VARIANTS_BY_PARENT[e.parent] = VARIANTS_BY_PARENT[e.parent] || []).push({name: _v, kind: e.kind});
}

// Resolve the display name for one (spell, route) pair. Order:
//   1. the route's own `applies` tag (extraction-captured per-level variant,
//      e.g. Dominate Being via Drd 3 = "Dominate Animal")
//   2. the granting DOMAIN's slot name (its list's own idiom; trailing
//      component markers stripped) — never for the psionic 'War' token
//   3. the parent's single Arcane-variant name on arcane-pool routes (the
//      Sor/Wiz & Bard lists use the arcane names: Enlarge Person, Mage
//      Armor, Polymorph…). Multi-variant parents (Charm/Hold/Dominate
//      Being) keep the parent name unless an `applies` tag decides.
//   4. the entry's own name.
function displayNameForRoute(spell, opt) {
  if (opt.applies && opt.applies !== spell.name) return opt.applies;
  if (opt.pool !== 'psionic') {
    const dd = DOMAINS_DB.find(d => d.name === opt.token);
    const slot = dd && dd.spells && dd.spells[String(opt.lvl)];
    if (slot && slot.name) return slot.name.replace(/\s+[AFMX]{1,2}$/, '');
  }
  if (opt.pool === 'arcane') {
    const cands = (VARIANTS_BY_PARENT[spell.name] || []).filter(v => v.kind === 'Arcane');
    if (cands.length === 1) return cands[0].name;
  }
  // v8.16.1: psionic routes show a sole Psionic Variant name (Permanency →
  // "Incarnate", per the 2026-09-03 HH's variant subtitle).
  if (opt.pool === 'psionic') {
    const cands = (VARIANTS_BY_PARENT[spell.name] || []).filter(v => v.kind === 'Psionic');
    if (cands.length === 1) return cands[0].name;
  }
  return spell.name;
}

