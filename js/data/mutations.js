// =============================================================================
// js/data/mutations.js
// MUTATIONS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. Mutation Point rules, super-power
//   rungs, mutation effects and the supernatural attribute ladder.
//
// KEY NAMES (so you can search for them)
//   tables and state: UNSTABLE_MP, SUPER_RUNGS, MUTATION_EFFECTS,
//   SU_ATTR_LADDER
//
// WHERE IT CAME FROM
//   Gathered from js/app/55-mutations-engine.js, js/app/56-supernatural-
//   attributes-pools-psi-focus.js when the code was regrouped by topic and
//   page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// ============================================================================
// v8.5.3 MUTATIONS PASS — the MP economy (HH Ch.IX pp.410-424), Layer 3 live.
// Character data (all lazily defaulted, no schemaVer bump — house convention):
//   c.mutations[]      {name, kind:'advantage'|'drawback'|'attribute', mp, attr?, grantedAt}
//   c.mpGrants[]       {amount, reason, atDate}  — GM grants as discrete events
//   c.superMutantTier  'minor'|'moderate'|'major'|'mega' (with Supernatural Mutation feat)
//   c.superPPCurrent   current super-power point pool (undefined = full)
//   c.powers[] pool:'super' entries: {name, pool:'super', mp, buff?, free?, via?}
// The ledger is COMPUTED, never stored: ownership IS the spend.
// ============================================================================

const UNSTABLE_MP = { 'Unstable Mutation I': 2, 'Unstable Mutation II': 4, 'Unstable Mutation III': 6, 'Unstable Mutation IV': 8, 'Unstable Mutation V': 10 };

// ----- super-power purchases (surfaced on the Powers tab, per Adam) -----
// v8.8.0 (Adam's report — Bull's Strength/Cat's Grace offered no Buy
// button): VARIANT entries (the Animal Affinity attribute family, the
// recovered bare-Level records) carry mp:null — their MP cost and identity
// live on the PARENT ("Animal Affinity is the one-size-fits-all attribute
// power"). For super-power purchase, a variant inherits the parent's MP
// cost, level identity, and Buff note.
// v8.80.0 (Adam's seller's-market ruling, 2026-10-03): the HH p.424
// "Supernatural Mutation List by MP Cost" is the CANONICAL purchase
// catalogue, and for the merged scaling families it prices EACH RUNG —
// the entry's printed (N MP) is only the bottom rung. Buying the full
// scaling capability costs its full upfront price ("pay more upfront for
// a more powerful ability down the road" — anti-cherry-picking; the same
// doctrine that prices Fly at its expensive equivalent). Rungs verbatim
// from p.424; the purchase flow prompts which rung is being bought.
const SUPER_RUNGS = {
  'Charm Being': [['Charm Animal / Charm Person', 2], ['Charm Being — full, scales to Monster', 8]],
  'Hold Being': [['Hold Animal / Hold Person', 4], ['Hold Being — full', 10]],
  'Dominate Being': [['Dominate Animal', 6], ['Dominate Person', 10], ['Dominate Being — full', 20]],
  'Planar Ally': [['Planar Ally, Lesser', 8], ['Planar Ally', 12], ['Planar Ally, Greater', 16]],
  'Suggestion (Mass)': [['Suggestion', 4], ['Suggestion, Mass', 10]],
  'Summon Monster (I-IX)': [['Summon Monster I-V', 10], ['Summon Monster I-IX', 20]],
  'Summon Nature’s Ally (I-IX)': [['Summon Nature’s Ally I-V', 10], ['Summon Nature’s Ally I-IX', 20]],
  'Astral Construct': [['Astral Construct I-V', 10], ['Astral Construct I-IX', 20]],
  'Inflict Wounds': [['Light', 2], ['Moderate', 4], ['Serious', 6], ['Critical', 8], ['Mass — Light', 10], ['Mass — Moderate', 12], ['Mass — Serious', 14], ['Mass — Critical', 16]],
  // Cure is DELIBERATELY asymmetric to Inflict (Adam's catch, 2026-10-03):
  // no cheap healing rung exists — at-will permanent healing deletes
  // attrition, so the suite bundles at an 8 MP floor ("includes all Cure
  // Wounds options below purchased tier"). The seller's market, applied
  // to mercy. Two rungs only, per p.424.
  'Cure Wounds': [['Cure Wounds — up to Critical (all lower tiers included)', 8], ['Mass Cure Wounds — up to Critical (all lower tiers included)', 16]],
};

// ============================================================================
// v8.6.0 MUTATION MECHANICAL EFFECTS (Adam's audit directive) — the full
// Advantage/Drawback catalog classified: always-on numeric effects wire into
// the typed-bonus engine (skills Misc column, saves, natural AC — the same
// channels feats/talents/items use); conditional numbers ride as condition
// entries (tooltip adjudication, the Layer-2 convention); everything else
// (senses, natural attacks, activated abilities, narrative burdens) surfaces
// as display strings via computeMutationEffects. Positive entries carry the
// book's "mutation bonus" type (non-stacking within type); penalties are
// untyped (d20: penalties stack).
// Attribute-family (+4 tiers) is handled separately by
// reconcileAttributeMutations (bake-into-c.attrs); Ability Decay's −2 bakes
// the same way via the add-flow picker.
const MUTATION_EFFECTS = {
  // — wired: skills —
  'Elasticity':           {skills:{'Escape Artist':10}, notes:['can squeeze through openings 1/10 your height/width (see entry)']},
  'Extra Arms':           {skills:{'Climb':4}, notes:['+4 mutation bonus on grapple checks', 'extra arms can hold (not fight with) items']},
  'Gazing Eye':           {skills:{'Search':2,'Spot':2}, active:['gaze attack (free action, see entry)']},
  'Hypersensitivity':     {skills:{'Listen':2,'Search':2,'Spot':2}, notes:['Blind-Fight as a bonus feat']},
  'Leaper':               {skills:{'Jump':10}},
  'Prehensile Tail':      {skills:{'Balance':2}, notes:['tail can grasp/manipulate a simple object one size smaller than you']},
  'Tail':                 {skills:{'Balance':2}, natural:['tail slam — bludgeoning: S 1d4 / M 1d6 / L 1d8']},
  'Wall Crawler':         {skills:{'Climb':4}, notes:['climbs perfectly smooth vertical surfaces bare-handed']},
  'Webbed Digits':        {skills:{'Swim':4}},
  'Lost Arm':             {skills:{'Climb':-2,'Swim':-2}, notes:['cannot wield two-handed weapons (see entry)']},
  'Pheromone Attraction': {condSkills:{'Bluff':[4,'vs creatures within 30 ft'],'Diplomacy':[4,'vs creatures within 30 ft'],'Handle Animal':[4,'vs creatures within 30 ft'],'Intimidate':[4,'vs creatures within 30 ft']}},
  'Pheromone Repulsion':  {condSkills:{'Diplomacy':[-4,'vs creatures within 30 ft'],'Handle Animal':[-4,'vs creatures within 30 ft']}},
  'Light Sensitivity':    {condSkills:{'Search':[-1,'in bright light'],'Spot':[-1,'in bright light']}, notes:['blinded 1 round by abrupt bright light; −1 on attacks in bright light']},
  'Tentacle':             {notes:['+4 mutation bonus on grapple checks','tentacle can grasp/manipulate objects of your size or smaller']},
  // — wired: saves —
  'Frailty':              {saves:{fort:-2}},
  'Lethargy':             {saves:{ref:-2}},
  'Mindslave':            {saves:{will:-2}},
  'Thick Fur Coat':       {condSaves:{fort:[4,'vs extreme cold']}},
  'Weak Immune System':   {condSaves:{fort:[-2,'vs poison, disease, radiation sickness']}},
  // — wired: natural armor (flows into T/ACtical + the ×5-HP rule) —
  'Exoskeleton':          {naturalAC:3},
  'Scaly Armor':          {naturalAC:2},
  // — natural attacks (display) —
  'Claws':                {natural:['claw — slashing: S 1d4 / M 1d6 / L 1d8']},
  'Fangs':                {natural:['bite — piercing: S 1d4 / M 1d6 / L 1d8']},
  'Great Horns':          {natural:['gore — bludgeoning or piercing: S 1d4 / M 1d6 / L 1d8']},
  'Stinger':              {natural:['sting — piercing: S 1d4 / M 1d6 / L 1d8']},
  'Acidic Saliva':        {natural:['bite rider — +1d4 acid on successful bite hits']},
  'Prickly Pear':         {natural:['1d4 piercing to grapplers and unarmed attackers (see entry)']},
  'Venomous Bite':        {natural:['bite venom — Fort DC 10 + ½ level + Con mod (see entry)']},
  // — senses & movement (display) —
  'Darkvision':           {senses:['darkvision 60 ft']},
  'Echolocator':          {senses:['blindsight 60 ft']},
  'Scent':                {senses:['scent']},
  'X-Ray Vision':         {senses:['x-ray vision (materials/thickness per entry)']},
  'Gills':                {senses:['amphibious — breathes air and water']},
  'Wings':                {senses:['fly 60 ft, average maneuverability (wired — Sheet Speed cell)']},
  'Reduced Speed':        {notes:['speed −5 ft, all movement modes (wired — Sheet Speed cell)']},
  // — defenses & thresholds (display; DR/MDT are table-adjudicated) —
  'Energy Absorption':    {notes:['energy resistance 10 to two types OR 20 to one (chosen at acquisition — wired to the Sheet Resistances panel)']},
  'Energy Diffusion':     {notes:['energy resistance 5 to two types OR 10 to one (chosen at acquisition — wired to the Sheet Resistances panel)']},
  'Force Barrier':        {active:['DR 3/– vs weapon attacks while the barrier is up (free action)']},
  'Skeletal Reinforcement': {notes:['DR 3/bludgeoning','massive damage threshold +3','falling damage reduced (see entry)']},
  'Brittle Bones':        {notes:['massive damage threshold −3','+1d6 damage from falls']},
  'Thin Skin':            {notes:['+1 damage each time you are wounded']},
  // v8.8.0 correction (HH p.416 verbatim): the drawback hits MOBILITY in
  // armor, not the armor bonus — max Dex −2 and armor check penalty +4
  // while wearing any armor. Wired mechanically via armorMaxDexCap and
  // nonProficientArmorPenalty now that both are measurables.
  'Festering Sores':      {notes:['while wearing any armor: its maximum Dex bonus −2 and its armor check penalty worsens by 4 (wired)']},
  'Heat/Cold Susceptibility': {notes:['double damage from prolonged extreme heat or cold']},
  'Enlarged Form':        {notes:['functions as the next-larger size category in several respects (see entry)']},
  // — activated abilities (display) —
  'Adrenaline Jolt':      {active:['1/day free action: +1d4+1 STR or DEX (duration per entry)']},
  'Second Wind':          {active:['1/day free action: heal Con mod + character level HP']},
  'Telekinetic Mind':     {active:['move a ≤5 lb object 15 ft as a move action']},
  'Telepathy':            {active:['telepathic link with a creature within 100 ft (see entry)']},
  'Vexing Voice':         {active:['voice-borne vex attack within 30 ft (see entry)']},
  'Radioactive':          {notes:['immune to mild/low/moderate radiation; body stores radiation (see entry)']},
  'Ultra Immune System':  {notes:['Ultra Immune System as a bonus feat (prereqs waived)']},
  'Multi-Talented':       {notes:['+1 cross-class Hero talent (counted in the Talent budget)']},
  // — narrative burdens (display) —
  'Blood Hunger':         {notes:['must drain a pint of blood every 24 h (see entry)']},
  'Neutrad Dependency':   {notes:['daily neutrad dose or Fort DC 15 (see entry)']},
  'Poisonous Blood':      {notes:['daily antitox dose or Fort DC 15 vs Con damage (see entry)']},
  'Cyber-Dependency':     {notes:['requires a body repair weave to heal naturally (see entry)']},
  'Rapid Aging':          {notes:['effective age = double actual (penalties only; no aging benefits)']},
  'Ultraviolet Allergy':  {notes:['2d6 fire per round in UV light / direct sunlight (see entry)']},
  'Combat Fear':          {notes:['Will DC 15 when combat starts or shaken (see entry)']},
  'Ability Decay':        {notes:['−2 to the chosen (lowest) ability — baked into the score on add']},
};
// ============================================================================
// v8.82.0 (Adam's taxonomy tweak): ✨ SUPERNATURAL ATTRIBUTES — the ladder
// shops on the Powers side (supernatural = NPF-nullified = super in nature),
// while the records remain MUTATIONS (single source of truth: the 🧬 tab,
// the Sheet bakes, suBakedPerAttr's NPF suppression all read them as ever).
// Pricing note (the §218 sources interlock): the chapter prices each STEP
// (Ex 2 / Su I 3 / II 4 / III 5 / IV 6) and the p.424 list prints the
// CUMULATIVE investment (2/5/9/14/20) — they agree exactly.
const SU_ATTR_LADDER = ['Extraordinary [Attribute]', 'Supernatural [Attribute] I', 'Supernatural [Attribute] II', 'Supernatural [Attribute] III', 'Supernatural [Attribute] IV'];
