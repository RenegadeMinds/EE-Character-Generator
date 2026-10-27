// =============================================================================
// js/app/62-power-suites-feats-page-proficiencies.js
// POWER SUITES FEATS PAGE PROFICIENCIES
// =============================================================================
//
// WHAT'S IN HERE
//   Super-power suites by theme, the Feats page (renderFeats and the feat
//   list), and the class/race weapon proficiencies and granted-feat tables.
//
// KEY NAMES (so you can search for them)
//   tables/objects: POWER_THEMES, CLASS_PROFICIENCIES,
//   RACE_WEAPON_PROFICIENCIES, CLASS_GRANTED_FEATS, MUTATION_GRANTED_FEATS,
//   CLASS_GRANTED_FEATS_LEVELED, ACP_SKILLS
//   functions (27): _powerThemeSets, _themesOfPower, renderPowersBrowse,
//   setFeatParamAt, renderFeats, renderFeatList, toggleCustomFeatForm,
//   addCustomFeat, removeFeat, saveFeats, openFeatBrowser, closeFeatBrowser,
//   setActiveBrowserSlot, renderFeatBrowser, summarizePrereqs, filterFeats,
//   pickAndAddFeat, _normWeaponName, charProficiencyGrants,
//   proficiencyPseudoFeats, reconcileGrantedFeats, isProficientWithWeapon,
//   isProficientWithArmor, parseArmorCheckPenalty, equippedACPPieces,
//   buildArmorCheckPenaltyBonuses, nonProficientArmorPenalty
//
// LOAD ORDER
//   File 62 of 68. index.html loads it after
//   js/app/61-casting-augments-and-powers-page.js and before
//   js/app/63-modals.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 50770-52001 of the single-file index.html at v9.19.0 (commit
//   1c1044b), moved here unchanged by tools/split_index.py. The version notes
//   inside the code ("v8.3.17 ...", "Adam's ruling ...", the section numbers)
//   are the original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 50770-52001; unchanged below this line ----
// ============================================================================
// v8.74.0 (Adam's mission): SUPER-POWER SUITES BY THEME — HH Ch.XI (pp.670+)
// classifies the spell/power corpus into 47 thematic suites ("a different
// perspective from which to build", esp. for super-mutants, who may buy up
// to 9th-level spells & powers at creation with GM permission). Extracted
// from the HH docx in flow order (the PDF text interleaves columns); names
// reconciled to SPELLS_DB: 618 exact + alias map (the theme list's 3.5-era
// names — Expeditious Retreat→Route, Sound Blast→Burst, Transport via
// Plants→Teleport, Greater [its Druid Variant], Energy Resistance→Resist
// Energy [the book's own "See" cross-reference], alignment-specific
// entries→their [Alignment] umbrellas, aka-suffixed psionics) + 19 variant
// display names resolved through VARIANT_NAMES parents at set-build time.
// 1,095 entries, 100% reaching a real catalogue power. SUITE RULE (p.670,
// table-side for now): own two powers from one suite and further powers
// from that suite cost 1 MP less — surfaced in the filter tooltip; wiring
// the discount into MP purchase math awaits Adam's ruling.
const POWER_THEMES = {
  'Acid': ['Acid Arrow','Acid Fog','Breath of the Black Dragon','Dissolving Touch','Dissolving Weapon','Exhalation of the Black Dragon','Storm of Vengeance'],
  'Air and Lightning': ['Call Lightning','Call Lightning Storm','Chain Lightning','Control Air','Control Electricity','Control Winds','Electromagnetic Pulse','Feather Fall','Fly','Gust of Wind','Ionic Bolt','Lightning Bolt','Overland Flight','Planar Ally','Shocking Grasp','Shutdown','Tornado Blast','Whirlwind','Whispering Wind','Wind Walk','Wind Wall'],
  'Aligned': ['Align Weapon','Detect [Alignment]','Dispel [Alignment]','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]','Undetectable Alignment'],
  'Animals': ['Animal Affinity','Animal Growth','Animal Messenger','Animal Trance','Bite of the Wolf','Catfall','Chameleon','Claws of the Beast','Creeping Doom','Detect Animals or Plants','Lion’s Charge','Magic Fang','Magic Fang, Greater','Metaphysical Claw','Mount','Poison','Repel Vermin','Scent of the Quarry','Speak with Animals','Spider Climb','Summon Nature’s Ally (I-IX)','Summon Swarm','Wildshape'],
  'Astral Savant': ['Astral Construct','Astral Projection','Bolt','Concealing Amorpha','Concealing Amorpha, Greater','Creation, Major','Creation, Minor','Crystal Shard','Crystallize','Dismiss Ectoplasm','Ecto Protection','Ectoplasmic Cocoon','Ectoplasmic Cocoon, Mass','Ectoplasmic Form','Entangling Ectoplasm','Evade Burst','Grease (aka Ectoplasmic Sheen)','Hail of Crystals','Planar Ally','Remote Viewing','Swarm of Crystals','Wall of Ectoplasm'],
  'Bane': ['Bane','Bestow Curse','Blindness/Deafness','Deceleration','Doom','Mind Fog','Poison','Ray of Enfeeblement','Ray of Exhaustion','Slow','Waves of Exhaustion','Waves of Fatigue','Web'],
  'Bazaar of the Bizarre': ['Black Tentacles','Form of Doom','Quintessence','Transformation'],
  'Boon': ['Aid','Animal Affinity','Barkskin','Biofeedback','Blur','Burst','Chameleon','Displacement','Expeditious Route','Freedom of Movement','Grip of Iron','Heroism','Heroism, Greater','Immovability','Jump','Longstrider','Prayer','Protection from [Alignment]','Regenerate','Resistance','Scent of the Quarry','See Invisibility','Synchronicity'],
  'Chaos and Luck': ['Chaos Hammer','Cloak of Chaos','Detect [Alignment]','Dispel [Alignment]','Entropic Shield','Fate of One','Freedom','Karmic Favor','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]','Synchronicity','Word of Chaos'],
  'Dimensional Traveler': ['Anchored Navigation','Astral Projection','Baleful Teleport','Banishment','Blink','Call Weaponry','Decerebrate','Detect Teleportation','Dimension Door','Dimension Slide','Dimension Swap','Dimensional Anchor','Dimensional Lock','Dissipating Touch','Divert Teleport','Ethereal Jaunt','Etherealness','Gate','Instant Reload','Maze','Phase Step','Plane Shift','Retrieve','Teleport','Teleport, Greater','Teleport Trigger','Time Hop','Time Hop, Mass','Trace Teleport','Tree Stride'],
  'Divine Faith': ['Aid','Banishment','Bless','Bless Weapon','Commune','Contact Other Plane','Divine Favor','Divine Power','Disrupting Weapon','Flame Strike','Mark of Justice','Miracle','Planar Ally','Prayer','Purify Food and Drink','Righteous / Riotous Might','Sanctuary','Shield of Faith','Spiritual Weapon','Synchronicity'],
  'Diviner': ['Clairtangent Hand','Clairvoyant Sense','Commune','Contact Other Plane','Contingency','Danger Sense','Destiny Dissonance','Detect [Alignment]','Detect Remote Viewing','Discern Lies','Discern Location','Divination','Fate Link','Fate of One','Find the Path','Find Traps','Foresight','Know Direction and Location','Legend Lore','Locate Creature','Locate Object','Moment of Prescience','Object Reading','Precognition','Precognition, Combat','Precognition, Defensive','Precognition, Greater','Precognition, Offensive','Prescience, Offensive','Prying Eyes','Prying Eyes, Greater','Read Magic','Recall Agony','Recall Death','Remote Viewing','Scrying','Scrying, Greater','Second Chance','See Invisibility','Speak with Animals','Speak with Dead','Speak with Plants','Status','Tongues','Trace Teleport','True Seeing','True Strike','Ubiquitous Vision','Vision'],
  'Dreams': ['Deep Slumber','Dream','Dream Travel','False Sensory Input','Fly','Form of Doom','Microcosm','Nightmare','Phantasmal Killer','Remote Viewing','Sleep'],
  'Earth Lord': ['Earthquake','Immovability','Iron Body','Meld into Stone','Move Earth','Planar Ally','Repel Metal or Stone','Reverse Gravity','Rusting Grasp','Soften Earth and Stone','Spike Stones','Stomp','Stone Shape','Stoneskin','Stone Tell','Transmute Mud to Rock','Transmute Rock to Mud','Wall of Stone'],
  'Empath': ['Affinity Field','Attraction','Aversion','Calm Animals','Calm Emotions','Cause Fear','Crushing Despair','Danger Sense','Detect Hostile Intent','Doom','Empathic Feedback','Empathic Transfer','Empathic Transfer, Hostile','Empathy','Fear','Good Hope','Rage','Sensitivity to Psychic Impressions','Share Pain','Share Pain, Forced','Telempathic Projection'],
  'Energy Wielders': ['Energy Blast','Energy Bolt','Energy Cone (aka Dragon’s Breath)','Energy Conversion','Energy Current (aka Energy Conduit)','Energy Missile','Energy Push (aka Energy Charge)','Energy Ray','Resist Energy','Energy Retort (aka Energy Backlash)','Energy Stun (aka Energy Overload)','Energy Wall','Energy Wave (aka Wyrm’s Breath)','Protection from Energy','Universal Energy Resistance','Whitefire'],
  'Evil and Profane': ['Animate Dead','Bane','Bestow Curse','Blasphemy','Contagion','Create Undead','Creeping Doom','Death Knell','Death Urge','Deathwatch','Detect [Alignment]','Dispel [Alignment]','Eyebite','Finger of Death','Magic Circle Against [Alignment]','Mind Seed','Nightmare','Planar Ally','Protection from [Alignment]','Unholy Aura','Unholy Blight'],
  'Fire Friend': ['Burning Hands','Control Flames','Fiery Discorporation','Fire Seeds','Fire / Chill Shield','Fire Storm','Fireball','Flame Arrow / Bullet','Flame Blade','Flame Strike','Flaming Sphere','Heat Metal','Incendiary Cloud','Matter Agitation','Meteor Swarm','Planar Ally','Produce Flame','Pyrotechnics','Scorching Ray','Wall of Fire'],
  'Force Adept': ['Blade Barrier','Clenched Fist of Force','Concussion Blast','Crushing Hand of Force','Force Screen / Shield','Forcecage','Forceful Hand of Force','Grasping Hand of Force','Inertial Armor','Interposing Hand of Force','Magic Missile','Repulsion Field','Resilient Sphere','Spiritual Weapon','Unseen Servant','Wall of Force'],
  'Gaseous Assassin': ['Acid Fog','Cloudkill','Fog Cloud','Gaseous Form','Incendiary Cloud','Mind Fog','Obscuring Mist','Solid Fog','Stinking Cloud','Wind Walk'],
  'Good': ['Detect [Alignment]','Dispel [Alignment]','Good Hope','Holy Aura','Holy Smite','Holy Word','Magic Circle Against [Alignment]','Planar Ally','Protection from [Alignment]'],
  'Healer': ['Body Adjustment','Body Purification','Cure Wounds','Heal','Heal, Mass','Immunity to Disease','Immunity to Poison','Psychic Chirurgery','Raise Dead','Recharge','Regenerate','Remove Blindness/Deafness','Remove Curse','Restoration','Restoration, Greater','Restoration, Lesser','Restore Body','Resurrection','True Resurrection'],
  'Ice Mastery': ['Chill Metal','Cone of Cold','Fire / Chill Shield','Freezing Sphere','Ice Storm','Matter Inertia','Polar Ray','Wall of Ice'],
  'Illusions and Shadows': ['Blur','Displacement','Glitterdust','Hallucinatory Terrain','Hypnotic Pattern','Illusory Wall','Invisibility','Invisibility, Greater','Invisibility, Mass','Machine Invisibility','Magic Aura','Major Image','Mask Metal','Minor Image','Mirage Arcana','Mirror Image','Misdirection','Mislead','Nightmare','Permanent Image','Persistent Image','Phantasmal Killer','Project Image','Rainbow Pattern','Scintillating Pattern','Seeming','Shades','Shadow Body','Shadow Conjuration','Shadow Conjuration, Greater','Shadow Evocation','Shadow Evocation, Greater','Shadow Walk','Silence','Silent Image','Veil','Ventriloquism','Weird'],
  'Law': ['Detect [Alignment]','Dictum','Dispel [Alignment]','Magic Circle Against [Alignment]','Mark of Justice','Order’s Wrath','Planar Ally','Protection from [Alignment]','Shield of Law','True Seeing','Zone of Truth'],
  'Matter Master': ['Baleful Polymorph','Bend Reality','Compression','Creation, Major','Creation, Minor','Creation, True','Fission','Flesh to Stone','Fly','Fuse Flesh','Fusion','Graft Weapon','Heal','Heat Metal','Immovability','Iron Body','Limited Wish','Matter Agitation','Matter Inertia','Matter Manipulation','Oak Body','Phantom Chopper','Phantom Steed','Polymorph Any Object','Regenerate','Repel Metal or Stone','Repel Wood','Rusting Grasp','Shades','Stone to Flesh','Stoneskin','Sustenance','Transmute Mud to Rock','Transmute Rock to Mud','Warp Wood'],
  'Machine Maester': ['Animate Objects','Burglar’s Buddy','Clean','Control Object','Creation, Major','Creation, Minor','Creation, True','Dataread','Degauss','Electromagnetic Pulse','Electronic Fog','Fabricate','Graft Weapon','Haywire','Instant Connectivity','Instant Reload','Ionic Bolt','Knock','Lock','Machine Invisibility','Make Repairs','Mask Metal','Matter Manipulation','Object Reading','Phantom Chopper','Polymorph Any Object','Power Device','Protection from Arrows / Bullets','Recharge','Relay Text','Repel Metal or Stone','Repel Wood','Rusting Grasp','Shatter','Shrink Item','Shutdown','Signal Feed','Trace Purge','Wall of Iron','White Noise','Wire Walk','Wood Shape'],
  'Metapower and Dispelling': ['Aura Alteration','Bestow Power','Break Enchantment','Detect Magic & Psionics','Dispel Magic & Psionics','Dispelling Buffer','Divert Teleport','Escape Detection','Feat Leech','Leech Field','Metaconcert','Misdirection','Nondetection','Null Power Field','Power Leech','Apopsi (aka “Power Purge”)','Catapsi (aka Power Suppression)','Protection from Spells and Powers','Remove Curse','Spell / Power Turning','Shatter Mind Blank','Spell / Power Immunity','Spell / Power Immunity, Greater'],
  'Mindkiller': ['Brain Lock','Cause Fear','Confusion','Confusion, Lesser','Crisis of Breath','Crisis of Life','Death Urge','Decerebrate','Disable','Ego Whip','Fear','Feeblemind','Hold Being','Id Insinuation','Inflict Pain','Insanity','Mental Pinnacle','Microcosm','Mind Fog','Mind Seed','Nightmare','Personality Parasite','Phantasmal Killer','Power Leech','Psionic Blast','Psychic Crush','Psychic Vampire','Recall Agony','Recall Death','Scare','Share Pain, Forced','Shatter Mind Blank','Touch of Idiocy','Ultrablast','Weird'],
  'Moon and Night': ['Darkness','Darkvision','Deep Slumber','Nightmare','Phantasmal Killer','Shades','Shadow Body','Sleep'],
  'Nature & the Natural World': ['Animal Messenger','Animate Plants','Barkskin','Blight','Call Lightning','Call Lightning Storm','Calm Animals','Commune with Nature','Contagion','Control Plants','Control Weather','Creeping Doom','Detect Animals or Plants','Detect Snares and Pits','Endure Elements','Entangle','Faerie Fire','Giant Vermin','Gust of Wind','Hide from Animals','Immunity to Poison','Insect Plague','Mount','Oak Body','Obscuring Mist','Pass without Trace','Plant Growth','Poison','Regenerate','Repel Vermin','Repel Wood','Scent of the Quarry','Sleep','Sleet Storm','Speak with Animals','Speak with Plants','Spider Climb','Spike Growth','Storm of Vengeance','Summon Nature’s Ally (I-IX)','Summon Swarm','Tornado Blast','Teleport, Greater','Tree Shape','Tree Stride','Wall of Thorns','Web','Wood Shape'],
  'Necromancy': ['Animate Dead','Antilife Shell','Blight','Chill Touch','Control Undead','Create Undead','Death Knell','Death Ward','Deathwatch','Detect Undead','Energy Drain','Enervation','Eyebite','Finger of Death','Halt Undead','Harm','Hide from Undead','Horrid Wilting','Inflict Wounds','Paralyzing Touch','Poison','Ray of Enfeeblement','Ray of Exhaustion','Scare','Slay Living','Speak with Dead','Spectral Hand','Touch of Fatigue','Vampiric Touch','Via Negativa','Wail of the Banshee','Waves of Exhaustion','Waves of Fatigue'],
  'Overpower': ['Assimilate','Bend Reality','Command','Command, Greater','Control Body (aka “Puppeteer”)','Control Object','Control Weather','Death Knell','Death Urge','Demand','Destiny Dissonance','Destruction','Disintegrate','Dissipating Touch','Dominate Being','Energy Drain','Expansion','Finger of Death','Fly','Gate','Globe of Invulnerability','Harm','Hold Being','Implosion','Limited Wish','Mental Pinnacle','Metamorphosis, Greater','Meteor Swarm','Mind Seed','Mind Thrust','Miracle','Null Power Field','Planar Ally','Polymorph Any Object','Power Word: Blind','Power Word: Kill','Power Word: Stun','Precognition, Greater','Psychic Crush','Reality Revision','Regenerate','Resurrection','Reverse Gravity','Shades','Slay Living','Storm of Vengeance','Summon Monster (I-IX)','Telekinesis (aka “TK”)','Teleport, Greater','Temporal Stasis','Time Regression','Timeless Body (aka Invulnerability)','True Metabolism','True Resurrection','True Seeing','Wish'],
  'Protective': ['Barkskin','Biofeedback','Blur','Cloak of Chaos','Concealing Amorpha','Concealing Amorpha, Greater','Death Ward','Displacement','Endure Elements','Resist Energy','Entropic Shield','Escape Detection','Evade Burst','Fire / Chill Shield','Force Screen / Shield','Globe of Invulnerability','Globe of Invulnerability, Lesser','Inertial Armor','Inertial Barrier','Interposing Hand of Force','Intellect Fortress','Iron Body','Mental Barrier','Mind Blank','Mirror Image','Misdirection','Nondetection','Null Power Field','Obscuring Mist','Power / Spell Resistance','Prayer','Prismatic Sphere','Prismatic Wall','Protection from Arrows / Bullets','Protection from [Alignment]','Protection from Energy','Protection from Spells and Powers','Sanctuary','Spell / Power Turning','Sequester','Shield of Faith','Shield of Law','Shield Other','Spell / Power Immunity','Spell / Power Immunity, Greater','Universal Energy Resistance'],
  'Resilience': ['Adapt Body','Biofeedback','Immunity to Disease','Immunity to Fear','Immunity to Paralysis','Immunity to Poison','Iron Body','Oak Body','Power / Spell Resistance','Protection from Energy','Protection from Spells and Powers','Regenerate','Remove Blindness/Deafness','Thicken Skin','True Metabolism','Universal Energy Resistance','Vigor'],
  'Self-Mastery': ['Adapt Body','Biofeedback','Body Adjustment','Body Equilibrium','Body Purification','Empty Mind','Good Hope','Heroism','Heroism, Greater','Immunity to Disease','Immunity to Fear','Immunity to Paralysis','Immunity to Poison','Mental Pinnacle','Mind Blank','Prowess','Psychofeedback','Regenerate','Scent of the Quarry','Schism','Steadfast Perception','Suspend Life','Sustenance','Thicken Skin','True Metabolism'],
  'Senses': ['Arcane Sight','Aura Sight','Clairvoyant Sense','Danger Sense','Darkvision','Deathwatch','Detect [Alignment]','Detect Animals or Plants','Detect Hostile Intent','Detect Magic & Psionics','Detect Remote Viewing','Detect Secret Doors','Detect Snares and Pits','Detect Teleportation','Detect Thoughts','Detect Undead','Elfsight','Locate Creature','Locate Object','Precognition','Precognition, Combat','Precognition, Defensive','Precognition, Greater','Precognition, Offensive','Prescience, Offensive','Remote Viewing','Scent of the Quarry','See Invisibility','Steadfast Perception','Synesthete','Touchsight','True Seeing','Ubiquitous Vision'],
  'Shapeshifter': ['Alter Self','Compression','Expansion','Fission','Fusion','Gaseous Form','Grip of Iron','Iron Body','Meld into Stone','Metamorphosis','Metamorphosis, Greater','Oak Body','Regenerate','Shadow Body','Stoneskin','Thicken Skin','Transformation','Wind Walk'],
  'Sonic Specialist': ['Blasphemy','Command','Command, Greater','Control Sound','Create Sound','Dictum','Holy Word','Power Word: Blind','Power Word: Kill','Power Word: Stun','Sculpt Sound','Shatter','Shout','Shout, Greater','Silence','Song of Discord','Sound Burst','Suggestion (Mass)','Sympathetic Vibration','Ventriloquism','Wail of the Banshee','Whispering Wind','Word of Chaos','Zone of Silence'],
  'Speed Demon': ['Burst','Expeditious Route','Fly','Haste','Hustle','Jump','Lion’s Charge','Longstrider','Overland Flight','Prowess','Skate','Temporal Acceleration','Time Stop'],
  'Sun and Spectrum': ['Color Spray','Control Light','Daylight','Fly','Glitterdust','Hypnotic Pattern','Invisibility','Invisibility, Greater','Invisibility, Mass','Invisibility Purge','Invisibility Sphere','Minor Image','Mirror Image','My Light','Prismatic Sphere','Prismatic Spray','Prismatic Wall','Rainbow Pattern','Scintillating Pattern','Searing Light','Sunbeam','Sunburst'],
  'Supra-Genius': ['Call to Mind','Comprehend Languages','Conceal Thoughts','Contingency','Detect Magic & Psionics','Detect Secret Doors','Detect Snares and Pits','Fate of One','Find the Path','Find Traps','Foresight','Glibness','Hypercognition','Identify','Know Direction and Location','Legend Lore','Locate Creature','Locate Object','Metafaculty','Mind Blank','Mind Trap','Mislead','Prying Eyes','Prying Eyes, Greater','Psychofeedback','Read Magic','Schism','Second Chance','Sense Link','Sensitivity to Psychic Impressions','Steadfast Perception','Thought Shield','Tongues','True Strike','Ubiquitous Vision'],
  'Telekinetic': ['Far Hand','Floating Disk','Fly','Force Screen / Shield','Inertial Barrier','Intellect Fortress','Knock','Levitate','Lock','Telekinesis (aka “TK”)','Telekinetic Sphere','Touchsight','Unseen Servant'],
  'Telepath': ['Attraction','Aversion','Brain Lock','Brain Spider','Cloud Mind','Cloud Mind, Mass','Conceal Thoughts','Confusion','Confusion, Lesser','Correspond','Daze Creature','Detect Thoughts','Distract','False Sensory Input','Id Insinuation','Mental Disruption','Metaconcert','Mind Blank','Mind Probe','Mind Seed','Mind Switch','Mind Switch, True','Mindlink','Mindlink, Thieving','Mindwipe','Missive','Missive, Mass','Modify Memory','Personality Parasite','Phantasmal Killer','Psionic Blast','Psychic Chirurgery','Schism','Sending','Sense Link','Sense Link, Forced','Tower of Iron Will','Ultrablast'],
  'Warrior': ['Animal Affinity','Bite of the Wolf','Call Weaponry','Claw of Energy','Claws of the Beast','Claws of the Vampire','Danger Sense','Detect Hostile Intent','Disrupting Weapon','Dissolving Touch','Dissolving Weapon','Duodimensional Claw','Float','Freedom of Movement','Ghost Shot','Graft Weapon','Grip of Iron','Hammer','Haste','Hustle','Instant Reload','Jump','Keen Edge','Lion’s Charge','Metaphysical Weapon','Painful Strike','Precognition, Combat','Precognition, Defensive','Precognition, Offensive','Prescience, Offensive','Prevenom','Prevenom Weapon','Prowess','Psychic Vampire','Rage','Stomp','Strength of the Enemy','Transformation','True Strike','Truevenom','Truevenom Weapon','Vampiric Blade','Weapon of Energy'],
  'Water Wyrd': ['Control Water','Create Water','Float','Freezing Sphere','Horrid Wilting','Ice Storm','Planar Ally','Quench','Sleet Storm','Water Breathing','Water Walk'],
  'Willbender': ['Attraction','Aversion','Charm Being','Charm Person','Command','Command, Greater','Confusion','Confusion, Lesser','Control Body (aka “Puppeteer”)','Control Plants','Control Undead','Demand','Dominate Being','Enthrall','False Sensory Input','Geas/Quest','Geas, Lesser','Glibness','Good Hope','Halt Undead','Hold Being','Hypnotic Pattern','Hypnotism','Scare','Sleep','Suggestion (Mass)','Zone of Truth'],
};
// Lazy theme sets: theme -> Set of SPELLS_DB names (variant display names
// expand to their parents, so "Wildshape" lights up Metamorphosis).
let _pwThemeSets = null;
function _powerThemeSets() {
  if (_pwThemeSets) return _pwThemeSets;
  _pwThemeSets = {};
  const vn = VARIANT_NAMES;
  for (const th in POWER_THEMES) {
    const s = new Set();
    for (const n of POWER_THEMES[th]) { s.add(n); if (vn[n] && vn[n].parent) s.add(vn[n].parent); }
    _pwThemeSets[th] = s;
  }
  return _pwThemeSets;
}
// Reverse lookup for the expanded browse rows: which suites claim this power?
function _themesOfPower(name) {
  const sets = _powerThemeSets(), out = [];
  for (const th in sets) if (sets[th].has(name)) out.push(th);
  return out;
}
function renderPowersBrowse() {
  if (!_pwBrowseOpen) return;  // collapsed — skip the heaviest render (C1)
  const c = chars.find(x => x.id === curId); if (!c) return;
  const el = document.getElementById('pw-browse-list'); if (!el) return;
  const q = (document.getElementById('pw-search').value || '').toLowerCase();
  const poolF = document.getElementById('pw-pool-filter').value;
  const lvlF = document.getElementById('pw-lvl-filter').value;
  const castableOnly = document.getElementById('pw-castable-only').checked;
  // v8.74.0: the Power-Type theme filter (HH Ch.XI suites). Options are
  // populated once from POWER_THEMES; each option carries its suite size.
  const thSel = document.getElementById('pw-theme-filter');
  if (thSel && thSel.options.length <= 1) {
    thSel.innerHTML = '<option value="">All themes (HH Ch.XI)</option>' +
      Object.keys(POWER_THEMES).map(th => `<option value="${escapeHTML(th)}">${escapeHTML(th)} (${POWER_THEMES[th].length})</option>`).join('');
  }
  const themeF = thSel ? thSel.value : '';
  const themeSetF = themeF ? _powerThemeSets()[themeF] : null;
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.6.0 split: routes are filtered to this mode's pools; the catalogue
  // underneath stays the one unified Ch.IX listing. Rebuild the pool filter's
  // options to the mode's sides (super has no list-routes — it's purchases).
  const modePools = _pwModePools();
  const routesOf = s => spellPoolOptions(s, poolsInfo).filter(o => modePools.includes(o.pool));
  // v8.6.0 (Adam): "the psionic equivalent of cast is manifest" — the
  // castable-only label follows the mode.
  const clbl = document.getElementById('pw-castable-lbl');
  if (clbl) clbl.textContent = _pwMode === 'psionic' || _pwMode === 'powers' ? 'manifestable by this character' : 'castable by this character';
  const pfSel = document.getElementById('pw-pool-filter');
  const pfWant = _pwMode === 'spells'
    ? '<option value="">All pools</option><option value="arcane">Arcane</option><option value="divine">Divine</option>'
    : '<option value="">All pools</option><option value="psionic">Psionic</option>';
  if (pfSel && pfSel.dataset.mode !== _pwMode) {
    pfSel.innerHTML = pfWant; pfSel.dataset.mode = _pwMode;
  }
  const poolF2 = pfSel ? pfSel.value : poolF;

  // v8.74.0 (found wiring the theme filter): a PURE super-mutant with
  // "manifestable by this character" checked saw an EMPTY catalogue — super
  // purchases aren't list-routes, so nothing ever counted as available. On
  // the Powers side, an entry the character could BUY as a super-power now
  // passes the availability filter (and the label says so).
  const _mpStB = (_pwMode === 'powers') ? getMPState(c) : null;
  const superCapable = !!(_mpStB && _mpStB.isSuperMutant);
  // v8.79.0 (Adam's Rhad shopping report): the TIER gates (level band +
  // per-power MP cap, HH p.422 — keyed on TOTAL MP earned, not banked)
  // were filtering in silence. The label now states the shopping window.
  if (clbl && superCapable && _mpStB.tier) {
    const [tLo, tHi] = _mpStB.tier.spell_levels || [1, 9];
    clbl.textContent = `manifestable / ◈ buyable by this character — ${_mpStB.tier.tier} tier: power levels ${tLo}-${tHi}${_mpStB.tier.max_mp_per_power != null ? `, ≤${_mpStB.tier.max_mp_per_power} MP per power` : ''}`;
  } else if (clbl && superCapable) clbl.textContent = 'manifestable / ◈ buyable by this character';
  _pwBrowseList = SPELLS_DB.filter(s => {
    if (q && !(s.name.toLowerCase().includes(q) || s.school_raw.toLowerCase().includes(q))) return false;
    if (themeSetF && !themeSetF.has(s.name)) return false;  // v8.74.0: theme suite filter
    const opts = routesOf(s);
    if (castableOnly && !opts.some(o => !o.overMax) && !(superCapable && superBuyEligibility(c, s).ok)) return false;
    if (poolF2 && !opts.some(o => o.pool === poolF2)) return false;
    if (lvlF !== '' && !(s.levels || []).some(l => l.lvl === Number(lvlF) || (l.lvl_max && Number(lvlF) >= l.lvl && Number(lvlF) <= l.lvl_max))) return false;
    return true;
  });

  const CAP = 120;
  const shown = _pwBrowseList.slice(0, CAP);
  const knownKeys = new Set(getCharPowers(c).map(p => p.name + '|' + p.pool));
  el.innerHTML = (shown.map((s, i) => {
    const opts = routesOf(s);
    const open = _pwExpandedBrowse.has(s.name);
    // v8.5.4: source-sensitive naming — each route resolves its own display
    // name (domain-list idiom, variant subtitles, applies tags). When every
    // available route agrees on one variant name, it becomes the row title
    // with the entry's own name as the secondary; otherwise route-specific
    // names ride on their pool tags.
    const routeNames = opts.map(o => displayNameForRoute(s, o));
    const uniqueNames = [...new Set(routeNames)];
    const primaryName = (opts.length && uniqueNames.length === 1 && uniqueNames[0] !== s.name) ? uniqueNames[0] : s.name;
    const secondary = primaryName !== s.name ? ` <span style="font-size:10px;opacity:var(--o50);color:var(--dim);">(${escapeHTML(s.name)})</span>` : '';
    const tagSeen = new Set();
    const poolTags = opts.length
      ? opts.map((o, k) => {
          const nm = routeNames[k];
          const label = `${o.pool}${o.overMax ? '↑' : ''}` + (nm !== primaryName ? ` · ${nm}` : '');
          if (tagSeen.has(label)) return '';
          tagSeen.add(label);
          return `<span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(120,175,205,.12);border:1px solid rgba(120,175,205,.3);margin-left:4px;" title="${o.overMax ? 'above this pool’s max castable level (GM exception to add)' : 'castable via this pool'}${nm !== s.name ? ' — this source knows it as “' + escapeHTML(nm) + '”' : ''}">${escapeHTML(label)}</span>`;
        }).join('')
      : `<span style="font-size:9px;opacity:.4;margin-left:4px;">not on your lists</span>`;
    const allKnown = opts.length && opts.every(o => knownKeys.has(s.name + '|' + o.pool));
    const addBtn = opts.length
      ? (allKnown ? `<span style="font-size:10px;color:#6dba88;">✓ known</span>` : `<button class="btn btn-sm btn-pri" style="font-size:10px;" onclick="addPowerFromBrowse(${i})">+ Add</button>`)
      : '';
    // v8.5.3: super-power purchase — spend banked MP for a permanent
    // supernatural ability (HH p.422). Eligibility gated by tier caps.
    // v8.6.0 split: purchases live on the Powers side only.
    let buyBtn = '';
    if (_pwMode === 'powers') {
      if (knownKeys.has(s.name + '|super')) {
        buyBtn = `<span style="font-size:10px;color:#b58fd4;">◈ owned</span>`;
      } else {
        const elig = superBuyEligibility(c, s);
        // v8.75.0: the suite discount (HH p.670, Adam's ruling) shows on the
        // button itself — the player sees the real price and why.
        // v8.80.0: rung families quote the tier-legal range; the click
        // prompts which rung (HH p.424 prices — the seller's-market ladder).
        const _rLo = elig.rungs ? elig.rungs[0][1] : null, _rHi = elig.rungs ? elig.rungs[elig.rungs.length - 1][1] : null;
        const _buyLabel = elig.rungs ? (_rLo === _rHi ? `◈ Buy ${Math.max(1, _rLo - (elig.suite ? 1 : 0))} MP` : `◈ Buy ${Math.max(1, _rLo - (elig.suite ? 1 : 0))}–${Math.max(1, _rHi - (elig.suite ? 1 : 0))} MP`) : `◈ Buy ${elig.mp} MP`;
        if (elig.ok) buyBtn = `<button class="btn btn-sm" style="font-size:10px;border-color:rgba(181,143,212,.5);color:#b58fd4;" title="Buy as a permanent super-power (spends banked MP)${elig.rungs ? ` — PRICED BY RUNG (HH p.424, the seller's-market ladder): ${elig.rungs.map(r => `${r[0]} ${r[1]} MP`).join(' · ')}${elig.rungsBlocked ? ` — ${elig.rungsBlocked} higher rung${elig.rungsBlocked === 1 ? '' : 's'} beyond your tier's per-power cap` : ''}. You choose the rung when buying; the full scaling capability costs its full upfront price.` : ''}${elig.suite ? ` — SUITE DISCOUNT: you own ${elig.suiteOwned} ${escapeHTML(elig.suite)} powers, so this costs ${elig.mp} MP instead of ${elig.mpBase} (HH p.670: two powers from one suite make further suite powers 1 MP less)` : ''}${elig.via ? ` — priced as its parent power, ${elig.via}` : ''}" onclick="buySuperPower(${i})">${_buyLabel}${elig.suite ? ` <span style="font-size:8px;opacity:.85;">(suite −1)</span>` : ''}</button>`;
        // v8.79.0 (Adam's Rhad shopping report): a blocked row now SAYS WHY
        // — a dimmed dashed chip with the gate (tier level band, per-power
        // MP cap, feat, scenario), and the tier ladder in the hover so the
        // player knows what earns the unlock. Silence was the bug.
        else if (superCapable) {
          const w = elig.why || '';
          const short = /caps single-power cost/.test(w) ? `tier cap ${(_mpStB.tier && _mpStB.tier.max_mp_per_power) || ''} MP`
            : /reaches level/.test(w) ? `tier ≤ lvl ${(_mpStB.tier && _mpStB.tier.spell_levels) ? _mpStB.tier.spell_levels[1] : ''}`
            : /Supernatural Mutation/.test(w) ? 'needs Su Mutation'
            : /Mutation Scale/.test(w) ? 'needs Mut 5 scenario'
            : 'not buyable';
          buyBtn = `<span style="font-size:9px;color:var(--tp55);border:1px dashed rgba(181,143,212,.3);padding:2px 6px;border-radius:2px;white-space:nowrap;cursor:help;" title="Not buyable yet — ${escapeHTML(w)}. The shopping window follows your CLASSIFICATION, which tracks TOTAL MP earned (+1 Mutant level per full 10 — Adam's unification ruling, HH p.423): Minor <10 MP (lvl 1-3, ≤6 MP/power) · Moderate 10+ (1-5, ≤10) · Major 20+ (1-9, ≤20) · Mega 30+ (1-9, uncapped). Earn MP across a threshold and the window widens automatically; the Mutation Scale caps the total (GMG pp.64-66).">◈ ${escapeHTML(short)}</span>`;
        }
      }
    }
    return `<div style="padding:6px 9px;border-bottom:1px solid rgba(200,151,30,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="cursor:pointer;flex:1;" onclick="togglePwBrowseDetail(${i})"><b>${escapeHTML(primaryName)}</b>${secondary}${poolTags}${powerPrereqBadge(s, c)} <span style="font-size:10px;opacity:var(--o40);color:var(--dim);">${open ? '▾' : '▸'}</span></div>
        ${buyBtn}
        ${addBtn}
      </div>
      <div style="font-size:10px;opacity:.55;">${escapeHTML(s.school_raw)} · ${escapeHTML((s.levels || []).map(l => l.cls + ' ' + l.lvl + (l.lvl_max ? '-' + l.lvl_max : '')).join(', '))}${s.mp ? ' · ' + s.mp + ' MP' : ''}</div>
      ${open ? `<div style="font-size:11px;opacity:.75;margin-top:4px;line-height:1.5;">${spellStatLine(s)}</div><div style="font-size:11.5px;margin-top:5px;line-height:1.55;color:var(--parch);">${escapeHTML(s.d)}</div>${(() => { const ths = _themesOfPower(s.name); if (!ths.length) return '';
        // v8.75.0: progress-aware suite tags for super-capable characters —
        // ◈−1 when the discount is live, (n/2) while building toward it.
        const _superCap = getMPState(c).isSuperMutant;
        const sets = _powerThemeSets();
        const ownedSup = (c.powers || []).filter(p => p.pool === 'super').map(p => p.name);
        const bits = ths.map(th => {
          if (!_superCap) return escapeHTML(th);
          const n = ownedSup.filter(nm => sets[th].has(nm) && nm !== s.name).length;
          if (n >= 2) return `<b title="You own ${n} ${escapeHTML(th)} powers — further ${escapeHTML(th)} purchases cost 1 MP less (HH p.670).">${escapeHTML(th)} ◈−1</b>`;
          if (n === 1) return `<span title="Own one more ${escapeHTML(th)} power to unlock the suite discount (−1 MP on further ${escapeHTML(th)} purchases, HH p.670).">${escapeHTML(th)} (1/2)</span>`;
          return escapeHTML(th);
        });
        return `<div style="font-size:10px;margin-top:4px;color:#b58fd4;" title="Super-Power Suites by Theme (HH Ch.XI). Own two powers from one suite and further powers from that suite cost 1 MP less.">◈ Suites: ${bits.join(' · ')}</div>`; })()}` : ''}
    </div>`;
  }).join('') || `<div style="padding:.9rem;font-size:12px;color:var(--g45);text-align:center;">Nothing matches the current filters.</div>`)
  + (_pwBrowseList.length > CAP ? `<div style="padding:6px 9px;font-size:11px;color:var(--g50);text-align:center;">…and ${_pwBrowseList.length - CAP} more — refine the filters to see them.</div>` : '');
}

// v8.30.0: choose (or re-key) a stored feat record's parameter after the fact.
// Used by the ⬦ button on Known Feats rows whose FEATS_DB entry defines a
// param the record predates (Heritage class picks are the motivating case).
function setFeatParamAt(i){
  const c = chars.find(x => x.id === curId); if (!c || !c.feats || !c.feats[i]) return;
  const rec = c.feats[i];
  const data = getFeatData(rec.name); if (!data || !data.param) return;
  promptForFeatParam(data, param => {
    rec.param = param;
    save(); renderFeats(); renderSheet(); renderNavTabs(c);
    toast(`${data.n} — ${param}.`);
  });
}
function renderFeats(){
  const prompt=document.getElementById('ft-prompt'),cont=document.getElementById('ft-content');
  if(!curId){prompt.style.display='block';cont.style.display='none';return;}
  const c=chars.find(x=>x.id===curId);if(!c){prompt.style.display='block';cont.style.display='none';return;}
  prompt.style.display='none';cont.style.display='block';
  if (migrateFeats(c)) save();
  // v8.6.1: sync class-entry feat grants (covers pre-existing characters —
  // an old Monk gets CMA/DMA on first visit here, flagged grantedBy).
  if (reconcileGrantedFeats(c)) save();
  document.getElementById('ft-hero-nm').textContent=c.name+' — Feats';
  // v8.4.0: feat-budget computation extracted into getFeatBudget() — see
  // the function definition for the rules. Returns {sources, total, picked,
  // remaining}; the rendering below consumes that shape.
  const budget = getFeatBudget(c);
  const budgetSources = budget.sources;
  const maxFeats = budget.total;
  const currentCount = budget.picked;
  const remaining = budget.remaining;
  // Visual budget bar: prominent "N available" + filled/empty pip strip + small context line.
  // A player may legitimately defer feat selection with GM permission, so the "available"
  // framing is neutral — not a warning that anything is wrong.
  const pips = [];
  for (let i = 0; i < maxFeats; i++) {
    pips.push(i < currentCount
      ? `<span style="color:var(--gold);">◆</span>`
      : `<span style="color:var(--g35);">◇</span>`);
  }
  // If the user has more selected than the budget (e.g. GM exception), show overflow pips in amber
  if (currentCount > maxFeats) {
    for (let i = maxFeats; i < currentCount; i++) pips.push(`<span style="color:var(--red-text);">◆</span>`);
  }
  // v8.4.0: four-state color-coded budget display (plan §7.5). Replaces the
  // old binary "available / over" treatment with surplus / exact / warning /
  // error states keyed off the GM exception list.
  const fState = computeResourceState(currentCount, maxFeats, 'feat', c.gmExceptions || []);
  const fDisplay = RESOURCE_STATE_DISPLAY[fState];
  let fSuffix = '';
  if (fState === 'surplus') {
    fSuffix = `${remaining} feat${remaining===1?'':'s'} available`;
    // v8.4.0: if Hero's Gift is unassigned AND would have added a feat slot,
    // label it distinctly so the player knows WHY they're surplus.
    if (!isLegacyCharacter(c) && c.heroesGiftChoice === null
        && (c.classes||[]).some(e => e.tier === 'hero')) {
      fSuffix += ` (incl. unassigned Hero's Gift slot)`;
    }
  } else if (fState === 'exact') {
    fSuffix = 'budget complete';
  } else if (fState === 'warning') {
    fSuffix = `${currentCount - maxFeats} over (GM exception)`;
  } else {
    fSuffix = `${currentCount - maxFeats} over budget — reconcile or get GM approval`;
  }
  const availText = `<span title="${fDisplay.label}" style="color:${fDisplay.color};">${fDisplay.icon}</span> <b style="color:${fDisplay.color};">${fSuffix}</b>`;
  // v8.3.6: source breakdown line shows where each slot came from. Format:
  // "Free L1 +1 · Heritage +1 · Hero's Gift +1" etc.
  const sourceLine = budgetSources.map(b => `${b.label} +${b.count}`).join(' · ');
  const ftCountEl = document.getElementById('ft-count');
  ftCountEl.innerHTML =
    `${availText} &nbsp; <span style="font-size:13px;letter-spacing:.18em;">${pips.join('')}</span> &nbsp; <span style="opacity:var(--o55);color:var(--dim);font-size:10px;">${currentCount} selected of ${maxFeats} at level ${c.totalLvl}</span>
     <div style="margin-top:6px;font-size:10px;color:var(--g55);line-height:1.4;font-style:italic;">${escapeHTML(sourceLine)}</div>`;
  ftCountEl.setAttribute('data-state', fState);
  renderFeatList(c);
}

// Render the character's known feats, with live prereq status badges for each.
function renderFeatList(c){
  const fl=document.getElementById('ft-list');
  const feats = c.feats||[];
  // v8.6.1: surface the DERIVED class-entry/racial proficiencies so the
  // player can see what came free with their classes (these live outside
  // c.feats and cost no feat slots — see CLASS_PROFICIENCIES).
  const g = charProficiencyGrants(c);
  const bits = ['Simple weapons (all characters)'];
  if (g.martial) bits.push('Martial weapons (Tech-gated)');
  for (const t of ['light', 'medium', 'heavy']) if (g.armor.has(t)) bits.push(t + ' armor');
  if (g.shield) bits.push('shields');
  if (g.towerShield) bits.push('tower shields');
  if (g.weaponsDisp.length) bits.push('specific: ' + g.weaponsDisp.join(', '));
  let grantBanner = `<div style="padding:6px 10px;margin-bottom:6px;font-size:11px;color:var(--tb85);border:1px solid rgba(120,175,205,.25);border-radius:3px;">
    <b>Class &amp; racial proficiencies</b> <span style="opacity:var(--o60);color:var(--dim);">(granted on entry — no feat slots used)</span>: ${escapeHTML(bits.join(' · '))}</div>`;
  // v8.71.0 (Adam's grooming pass): the Sheet's assigned-state Gift banner
  // retired — the ⬟ honor now sits on the occupying feat itself, read off
  // the herosGift slot ledger. When the Gift is assigned to 'feat' but the
  // slot sits unfilled (picks made above 1st level never auto-fill it), a
  // one-line note keeps the +1 budget honest instead of a phantom chip.
  const _giftAssigned = !isLegacyCharacter(c) && c.heroesGiftChoice === 'feat';
  const _giftSlot = (_giftAssigned && Array.isArray(c.firstLevelSlots))
    ? c.firstLevelSlots.find(s => s.kind === 'herosGift') : null;
  // Two ways a feat wears the ⬟ chip: it fills the herosGift slot (the
  // v8.4.0 ledger), or it carries an explicit origin:"Hero's Gift" tag
  // (hand-built / imported records that never passed through the L1
  // slot-fill path — the Loreseeker Prototype's convention).
  const _giftTagged = (f) =>
    (_giftSlot && _giftSlot.filled === f.name && (_giftSlot.filledParam || null) === (f.param || null)) ||
    (typeof f.origin === 'string' && /^Hero[’']s Gift$/.test(f.origin));
  const _anyGiftTag = _giftAssigned && feats.some(_giftTagged);
  const GIFT_CHIP_TIP = "Hero's Gift — this feat fills the Hero-class Gift slot (+1 bonus feat, Hero feat list). To reassign the Gift (feat ↔ talent), retcon via ✎ Edit — downstream prereq chains may break; the GM-exception ledger records any breaks detected.";
  if (_giftAssigned && !_anyGiftTag) {
    grantBanner += `<div style="padding:5px 10px;margin-bottom:6px;font-size:11px;color:var(--vio);border:1px solid rgba(196,153,212,.3);border-radius:3px;" title="${escapeHTML(GIFT_CHIP_TIP)} 1st-level picks fill the slot automatically; feats taken at higher levels count against the budget without a slot tag (cosmetic only).">⬟ <b>Hero's Gift (feat)</b> — +1 feat budget; no feat tagged to the slot yet.</div>`;
  }
  // v9.19.0 (old-boys #3): the UNCLAIMED Gift gets its claim card HERE — the
  // attention dot pointed at this tab, but the only chooser hid inside
  // ✎ Edit's retcon panel, so a whole table of players sat on an unclaimed
  // bonus all session. One click each way; the fold reconciler has already
  // absorbed over-budget cases before this renders.
  if (!isLegacyCharacter(c) && c.heroesGiftChoice === null && (c.classes || []).some(e => e.tier === 'hero')) {
    grantBanner += `<div style="padding:7px 10px;margin-bottom:6px;font-size:11.5px;color:var(--gold);border:1px solid rgba(200,151,30,.45);border-radius:3px;background:rgba(200,151,30,.04);">
      🎁 <b>Hero's Gift unclaimed</b> — your Hero class owes you ONE bonus pick: a feat or a talent, chosen once (retcon later via ✎ Edit).
      <span style="white-space:nowrap;"><button class="btn btn-sm btn-pri" style="font-size:10px;margin-left:8px;" onclick="assignHerosGiftAsFeat()">Claim as Feat (+1 feat slot)</button>
      <button class="btn btn-sm" style="font-size:10px;margin-left:4px;" onclick="assignHerosGiftAsTalent()">Claim as Talent (+1 talent slot)</button></span>
    </div>`;
  }
  if(!feats.length){
    fl.innerHTML=grantBanner+`<div style="padding:1rem;font-size:13px;color:var(--g40);text-align:center;">No feats yet — click "⌕ Browse Feats" above to add.</div>`;
    return;
  }
  fl.innerHTML = grantBanner + feats.map((f,i) => {
    // v8.71.0: ⬟ chip on the feat occupying the Hero's Gift slot.
    const _isGiftFeat = _giftAssigned && _giftTagged(f);
    const giftChip = _isGiftFeat
      ? ` <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.45);background:rgba(196,153,212,.1);padding:1px 5px;border-radius:2px;margin-left:6px;cursor:help;" title="${escapeHTML(GIFT_CHIP_TIP)}">⬟ Hero's Gift</span>`
      : '';
    const data = getFeatData(f.name);
    if (!data) {
      // Unknown feat — either custom (legacy) or pre-v8.1 entry
      const leg = f._legacy || {};
      const fam = leg.t || 'Custom';
      const pre = leg.pre ? `<div class="feat-pre">Prereq: ${escapeHTML(leg.pre)}</div>` : '';
      const d = leg.d ? `<div class="feat-desc">${escapeHTML(leg.d)}</div>` : '';
      return `<div class="feat-entry">
        <div>
          <div class="feat-nm">${escapeHTML(f.name)}${f.param?' ('+escapeHTML(f.param)+')':''} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span> <span style="font-size:9px;color:var(--g45);font-style:italic;">custom</span>${giftChip}</div>
          ${pre}${d}
        </div>
        <button class="btn btn-sm btn-danger" onclick="removeFeat(${i})" style="margin-top:2px;">✕</button>
      </div>`;
    }
    // FEATS_DB feat — render with live prereq check
    const prereq = checkFeatPrereqs(f.name, c);
    let badge = '';
    if (prereq.met) {
      badge = `<span style="font-size:10px;color:#6dba88;margin-left:6px;">✓ prereqs met</span>`;
    } else {
      const unverify = prereq.missing.every(m => m.includes('(GM-verify)'));
      const lbl = unverify ? '⚠ GM-verify' : '⚠ missing prereqs';
      const color = unverify ? 'var(--g65)' : 'var(--red-text)';
      badge = `<span style="font-size:10px;color:${color};margin-left:6px;" title="${escapeHTML(prereq.missing.join(' · '))}">${lbl}</span>`;
    }
    const paramText = f.param ? ` <span style="color:var(--gold);">(${escapeHTML(f.param)})</span>` : '';
    // v8.30.0: retrofit picker for records that predate their feat's param def
    // (the Heritage feats are the motivating case — their class choice landed
    // long after players took them). Generic: any paramful feat qualifies.
    const paramFixBtn = (data.param && !f.param && !f.grantedBy)
      ? ` <button class="btn btn-sm" style="font-size:9px;padding:1px 6px;background:rgba(196,153,212,.12);border-color:rgba(196,153,212,.45);color:var(--vio);" onclick="setFeatParamAt(${i})" title="This feat needs a ${escapeHTML((data.param.param_label||'parameter').toLowerCase())} — added before the picker existed. Choose now; no re-add needed.">⬦ choose ${escapeHTML((data.param.param_label||'parameter').toLowerCase())}</button>`
      : '';
    const fam = data.family || 'General';
    // v8.3.2: surface slot source if this feat consumed a class-bonus slot.
    // Format: 'classFeature:Expert:Bonus Expert Feat' → 'Expert bonus' tag.
    let slotTag = '';
    if (f.slotSource && typeof f.slotSource === 'string') {
      const m = f.slotSource.match(/^classFeature:([^:]+):(.+)$/);
      if (m) {
        slotTag = ` <span style="font-size:9px;color:var(--vio);border:1px solid rgba(196,153,212,.35);padding:1px 5px;border-radius:2px;margin-left:6px;" title="Filled the ${escapeHTML(m[1])} class-feature slot: ${escapeHTML(m[2])}">${escapeHTML(m[1])} bonus</span>`;
      }
    }
    // v8.6.1: class-entry granted feats (Monk's CMA/DMA) show provenance and
    // no remove button — removal follows the class levels, not a click
    // (reconcileGrantedFeats would re-add it on the next sync anyway).
    const grantTag = f.grantedBy
      ? ` <span style="font-size:9px;color:var(--pb90);border:1px solid rgba(120,175,205,.35);padding:1px 5px;border-radius:2px;margin-left:6px;" title="Granted on class entry — no feat slot used; removed automatically if the class goes.">granted by ${escapeHTML(f.grantedBy)}</span>`
      : '';
    return `<div class="feat-entry">
      <div>
        <div class="feat-nm">${escapeHTML(data.n)}${citeHTML('feats', data.n)}${paramText}${paramFixBtn} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span>${slotTag}${giftChip}${grantTag}${badge}</div>
        ${data.d?`<div class="feat-desc">${escapeHTML(data.d)}</div>`:''}
      </div>
      ${f.grantedBy ? '' : `<button class="btn btn-sm btn-danger" onclick="removeFeat(${i})" style="margin-top:2px;">✕</button>`}
    </div>`;
  }).join('');
}

// Toggle the inline custom-feat form (for homebrew / GM-approved feats not in FEATS_DB).
function toggleCustomFeatForm(){
  const f = document.getElementById('ft-custom-form');
  f.style.display = (f.style.display === 'none') ? 'block' : 'none';
}

// Add a custom (homebrew) feat from the inline form.
function addCustomFeat(){
  const name=document.getElementById('ft-new-name').value.trim();
  if(!name){toast('Enter a feat name.');return;}
  const c=chars.find(x=>x.id===curId);if(!c)return;
  if(!c.feats)c.feats=[];
  c.feats.push({
    name,
    _legacy:{
      t:document.getElementById('ft-new-type').value,
      pre:document.getElementById('ft-new-pre').value.trim(),
      d:document.getElementById('ft-new-desc').value.trim(),
    },
  });
  save();renderFeatList(c);renderFeats();
  ['ft-new-name','ft-new-pre','ft-new-desc'].forEach(id=>document.getElementById(id).value='');
  toast('Custom feat added.');
}

function removeFeat(i){
  const c=chars.find(x=>x.id===curId);if(!c)return;
  // v8.4.0: clear the L1 slot this feat was filling (if any) BEFORE removing
  // the feat. No-op for legacy characters or feats not tracked in a slot.
  const removed = c.feats[i];
  // v8.55.0: a homebrew-heritage entry carries baked attributes and child
  // grants — deleting it from the Feats page must reverse them too, or the
  // sheet desyncs. Route through the shared reversal before the splice, and
  // RE-LOCATE the entry by reference afterward: the reversal splices child
  // grants that sit BEFORE the entry, shifting its index (the reversal test
  // caught the stale-index splice missing the entry, whereupon the reconciler
  // faithfully re-granted the children — a perfect resurrection loop).
  if (removed && removed._hb) {
    hbReverseEntry(c, removed);
    i = c.feats.indexOf(removed);
    if (i < 0) { save(); renderFeats(); return; }
  }
  if (removed) {
    clearFirstLevelSlotForFeat(c, removed.name, removed.param);
  }
  c.feats.splice(i,1);
  // v8.13.0: removing an Expanded Knowledge instance withdraws its bonus
  // power known (player-learned copies are untouched by the reconciler).
  if (reconcileExpandedKnowledgePowers(c)) {
    renderPowers();
  }
  // v8.5.2 fix: removeFeat was the only feat-mutation path that didn't call
  // renderFeats() — it only re-rendered the list, leaving the budget header
  // (getFeatBudget() pips + "budget complete"/"N available" text) stale after
  // a delete. addCustomFeat and the feat-browser add path both call
  // renderFeats() (which itself calls renderFeatList), so this matches them.
  save();renderFeats();toast('Feat removed.');
}
function saveFeats(){save();toast('Feats saved.');}
// v8.3.2: tracks which slot the player is currently filling in the feat
// browser. When set, feat-add tags the picked feat with slotSource. Cleared
// when the modal closes or after a feat is added that consumed the slot.
let _activeBrowserSlot = null;

function openFeatBrowser(){
  // v8.3.2: detect open class-bonus slots and offer to fill the first one.
  // If multiple class-bonus slots are open, the player can pick which to
  // fill via the banner UI. The default behavior — and what fires here —
  // is to focus the first open slot, with a "Browse without slot context"
  // escape so the player can pick general feats too.
  const c = curId ? chars.find(x => x.id === curId) : null;
  if (c) {
    const open = getOpenClassBonusSlots(c);
    if (open.length > 0) {
      _activeBrowserSlot = open[0];
      const famFilter = _activeBrowserSlot.restrictionFamily;
      if (famFilter) {
        const sel = document.getElementById('feat-type-filter');
        if (sel) sel.value = famFilter;
      }
    } else {
      _activeBrowserSlot = null;
    }
  } else {
    _activeBrowserSlot = null;
  }
  document.getElementById('feat-modal').classList.add('open');
  renderFeatBrowser();
}
function closeFeatBrowser(){
  document.getElementById('feat-modal').classList.remove('open');
  _activeBrowserSlot = null;
}

// v8.3.2: explicitly toggle the active slot context. Called from the
// slot-context banner buttons when the player has multiple open slots
// or wants to browse without a slot context.
function setActiveBrowserSlot(idx) {
  const c = curId ? chars.find(x => x.id === curId) : null;
  if (!c) return;
  const open = getOpenClassBonusSlots(c);
  if (idx == null || idx < 0 || idx >= open.length) {
    _activeBrowserSlot = null;
    // Clear the family filter too — player chose "browse without slot"
    const sel = document.getElementById('feat-type-filter');
    if (sel) sel.value = '';
  } else {
    _activeBrowserSlot = open[idx];
    const famFilter = _activeBrowserSlot.restrictionFamily;
    const sel = document.getElementById('feat-type-filter');
    if (sel) sel.value = famFilter || '';
  }
  renderFeatBrowser();
}

// Render the feat browser with live prereq validation badges.
function renderFeatBrowser(filter='',famF='',qualF=''){
  const list=document.getElementById('feat-browser-list');
  const c = curId ? chars.find(x=>x.id===curId) : null;
  // v8.3.2: render slot-context banner. Shows when there's an active slot
  // OR there are open class-bonus slots the player could choose to fill.
  // The banner explains the restriction and offers a "browse generally"
  // escape, plus a picker if multiple slots are open.
  const banner = document.getElementById('feat-slot-banner');
  if (banner) {
    if (c) {
      const open = getOpenClassBonusSlots(c);
      if (open.length > 0) {
        let bannerHtml = '';
        if (_activeBrowserSlot) {
          // v8.3.7: format restriction descriptively. Family-restrictions
          // show their family label; list-restrictions show a short summary
          // (count + example) since enumerating 20+ feat names would be noisy.
          let restrDescription = 'no restriction';
          const rawRestr = _activeBrowserSlot.restriction;
          if (Array.isArray(rawRestr)) {
            const sample = rawRestr.slice(0, 3).join(', ');
            const more = rawRestr.length > 3 ? `, +${rawRestr.length - 3} more` : '';
            restrDescription = `${_activeBrowserSlot.className} feat list (${rawRestr.length} feats: ${sample}${more})`;
          } else if (typeof rawRestr === 'string' && rawRestr) {
            restrDescription = rawRestr;
          }
          bannerHtml += `
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:var(--vio);font-size:14px;">⚜</span>
              <div style="flex:1;">
                <b style="color:var(--vio);">Filling: ${escapeHTML(_activeBrowserSlot.className)} — ${escapeHTML(_activeBrowserSlot.featureName)}</b>
                <div style="color:var(--g65);font-size:11px;margin-top:2px;">Restriction: ${escapeHTML(restrDescription)}. Feats outside this list will prompt to override (GM exception).</div>
              </div>
            </div>
          `;
        } else {
          bannerHtml += `
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:var(--vio);font-size:14px;">⚜</span>
              <div style="flex:1;">
                <b style="color:var(--vio);">${open.length} class-bonus feat slot${open.length>1?'s':''} open</b>
                <div style="color:var(--g65);font-size:11px;margin-top:2px;">Browsing without slot context — picks count against your baseline feat slots first.</div>
              </div>
            </div>
          `;
        }
        // Switcher buttons: one per open slot + "browse without slot"
        bannerHtml += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">`;
        for (let i = 0; i < open.length; i++) {
          const s = open[i];
          const isActive = _activeBrowserSlot && _activeBrowserSlot.sourceTag === s.sourceTag && _activeBrowserSlot.slotIndex === s.slotIndex;
          bannerHtml += `<button class="btn btn-sm" onclick="setActiveBrowserSlot(${i})" style="font-size:10px;padding:3px 8px;${isActive?'background:rgba(196,153,212,.25);border-color:var(--vio);':''}">${isActive?'▼ ':''}${escapeHTML(s.className)} #${s.slotIndex+1}</button>`;
        }
        const noSlotActive = !_activeBrowserSlot;
        bannerHtml += `<button class="btn btn-sm" onclick="setActiveBrowserSlot(null)" style="font-size:10px;padding:3px 8px;${noSlotActive?'background:rgba(200,151,30,.15);':''}">${noSlotActive?'▼ ':''}Browse without slot</button>`;
        bannerHtml += `</div>`;
        banner.innerHTML = bannerHtml;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
        _activeBrowserSlot = null;  // no open slots → clear any stale state
      }
    } else {
      banner.style.display = 'none';
    }
  }
  const owned = new Set((c?.feats||[]).map(f => f.name));
  const filterLow = filter.toLowerCase();
  // Pre-compute qualification status per feat so we can use it for filtering AND display
  const featStatus = new Map();
  if (c) {
    for (const f of FEATS_DB) {
      const r = checkFeatPrereqs(f.n, c);
      let status = 'qualifies';
      if (!r.met) {
        status = r.missing.every(m => m.includes('(GM-verify)')) ? 'gmverify' : 'missing';
      }
      // v8.3.31 (stopgap): a Heritage feat on an above-1st-level character is
      // "off-level" — it would need a 1st-level Heritage slot the character
      // no longer has. It is NOT a normal "qualifies" feat: it requires a GM
      // exception. We give it its own status so the "✓ Qualifies Only" filter
      // excludes it (keeping the default view clean), while it still shows in
      // the "all feats" view, visually marked + GM-exception-gated.
      if (r.heritageOffLevel) {
        status = 'heritage-offlevel';
      }
      featStatus.set(f.n, {status, result:r});
    }
  }
  // v8.3.7: when an active browser slot has a list-restriction, default-filter
  // the displayed feats to that list. The player can still browse generally
  // by clicking "browse without slot" in the slot-context banner (which sets
  // _activeBrowserSlot to null).
  let listAllowSet = null;
  if (_activeBrowserSlot) {
    const filterDescr = _activeBrowserSlot.restrictionFilter
      || (_activeBrowserSlot.restrictionFamily
          ? {kind:'family', value: _activeBrowserSlot.restrictionFamily}
          : null);
    if (filterDescr && filterDescr.kind === 'list') {
      listAllowSet = new Set(filterDescr.value);
    }
  }
  const filtered=FEATS_DB.filter(f=>{
    const matchText = !filter || (f.n||'').toLowerCase().includes(filterLow) || (f.d||'').toLowerCase().includes(filterLow);
    const matchFam = !famF || f.family === famF;
    const matchQual = !qualF || !c || (featStatus.get(f.n)?.status === qualF);
    const matchList = !listAllowSet || listAllowSet.has(f.n);
    return matchText && matchFam && matchQual && matchList;
  });
  // v8.89.0 (Adam's sorting report — root cause): the list rendered in raw
  // FEATS_DB order, which is seven sequential ingest batches each internally
  // alphabetical — "several subsets in alphabetical order, undeclared." The
  // rows now SORT: A–Z across the whole catalogue (default; with an active
  // text search, name-matches outrank description-only matches, prefix
  // matches first), or by Family with declared headers — the old implicit
  // grouping, made honest.
  const sortMode = document.getElementById('feat-sort')?.value || 'az';
  const _byName = (a, b) => (a.n || '').localeCompare(b.n || '', undefined, { sensitivity: 'base' });
  if (sortMode === 'family') {
    filtered.sort((a, b) => (a.family || 'General').localeCompare(b.family || 'General') || _byName(a, b));
  } else if (filterLow) {
    const _rank = f => { const n = (f.n || '').toLowerCase(); return n.startsWith(filterLow) ? 0 : n.includes(filterLow) ? 1 : 2; };
    filtered.sort((a, b) => _rank(a) - _rank(b) || _byName(a, b));
  } else {
    filtered.sort(_byName);
  }
  if(!filtered.length){list.innerHTML=`<div style="padding:1rem;font-size:13px;color:var(--g40);">No matching feats.</div>`;return;}
  let _lastFam = null;
  list.innerHTML = filtered.map(f => {
    const fam = f.family || 'General';
    // Family mode: a declared header whenever the family changes.
    let _famHead = '';
    if (sortMode === 'family' && fam !== _lastFam) {
      _lastFam = fam;
      _famHead = `<div style="padding:5px 10px;background:rgba(200,151,30,.1);border-top:1px solid rgba(200,151,30,.25);border-bottom:1px solid rgba(200,151,30,.18);font-family:'Epics Serif','Cinzel',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);">${escapeHTML(fam)} Feats</div>`;
    }
    let prereqStatus = '';
    let addBtn = '';
    // v8.3.31 (stopgap): off-level Heritage feat? Compute once, reuse below.
    const heritageOffLevel = c ? !!(featStatus.get(f.n)?.result?.heritageOffLevel) : false;
    if (c) {
      const r = checkFeatPrereqs(f.n, c);
      if (heritageOffLevel) {
        // Heritage feat on an above-1st-level character. Per the rules, a
        // Heritage feat occupies a 1st-level Heritage slot — a character past
        // 1st level no longer has an open one. It remains reachable only as a
        // GM exception (the canonical case being Supernatural Mutation gained
        // mid-campaign through an exceptional in-game scenario).
        prereqStatus = `<span style="font-size:10px;color:var(--vio);margin-left:6px;">⬟ 1st-level Heritage slot</span>
          <div style="font-size:11px;color:var(--g60);margin-top:2px;line-height:1.4;">Heritage feats are assigned during 1st-level creation. This character is past 1st level — adding it now requires GM approval (recorded as a GM exception). Use incremental Level Up to advance characters the canonical way.</div>`;
      } else if (r.met) {
        prereqStatus = `<span style="font-size:10px;color:#6dba88;margin-left:6px;">✓ qualifies</span>`;
      } else {
        const unverify = r.missing.every(m => m.includes('(GM-verify)'));
        const lbl = unverify ? '⚠ GM-verify' : '✗ missing prereqs';
        const color = unverify ? 'var(--g65)' : 'var(--red-text)';
        prereqStatus = `<span style="font-size:10px;color:${color};margin-left:6px;">${lbl}</span>
          <div style="font-size:11px;color:var(--g55);margin-top:2px;">${escapeHTML(r.missing.join(' · '))}</div>`;
      }
      // Already-owned check (block re-add unless takeable)
      const alreadyOwned = owned.has(f.n);
      if (alreadyOwned && f.takeable !== 'multiple') {
        addBtn = `<button class="btn btn-sm" disabled style="opacity:.5;">Owned</button>`;
      } else if (heritageOffLevel) {
        // GM-exception override button — distinct styling so it reads as an
        // exceptional action, not a normal Add.
        const label = alreadyOwned ? 'GM Override (Add Again)' : 'GM Override';
        addBtn = `<button class="btn btn-sm" onclick="pickAndAddFeat('${(f.n||'').replace(/'/g,"\\'")}')" style="background:rgba(196,153,212,.15);border-color:var(--vio);color:var(--vio);font-size:10px;" title="Adds this Heritage feat above 1st level as a GM-approved exception">⬟ ${label}</button>`;
      } else {
        const label = alreadyOwned ? '+ Add Again' : '+ Add';
        addBtn = `<button class="btn btn-sm btn-pri" onclick="pickAndAddFeat('${(f.n||'').replace(/'/g,"\\'")}')">${label}</button>`;
      }
    } else {
      addBtn = `<button class="btn btn-sm" disabled>Select a hero first</button>`;
    }
    // Render prereq summary (structured for clarity)
    let preSummary = '';
    if (f.prereqs && f.prereqs.length) {
      preSummary = `<div class="feat-pre">Prereq: ${escapeHTML(summarizePrereqs(f.prereqs))}</div>`;
    }
    const paramTag = f.param ? `<span style="font-size:10px;color:var(--gold);margin-left:4px;">⤷ ${escapeHTML(f.param.param_label || 'parameter required')}</span>` : '';
    const grantTag = f.grants ? `<span style="font-size:10px;color:var(--g60);margin-left:4px;">grants talent</span>` : '';
    const icTag = f.isItemCreation ? `<span style="font-size:10px;color:var(--g60);margin-left:4px;">Item Creation</span>` : '';
    return _famHead + `<div class="feat-entry">
      <div>
        <div class="feat-nm">${escapeHTML(f.n)}${citeHTML('feats', f.n)} <span class="feat-type ft-${fam.toLowerCase()}">${fam}</span>${paramTag}${grantTag}${icTag}${prereqStatus}</div>
        ${preSummary}
        ${f.d?`<div class="feat-desc">${escapeHTML(f.d)}</div>`:''}
      </div>
      ${addBtn}
    </div>`;
  }).join('');
}

// Produce a human-readable summary of a prereq array (groups joined by '·', OR-options by 'or').
function summarizePrereqs(prereqs){
  return prereqs.map(group => {
    return group.map(opt => {
      if (opt.type === 'bab') return `BAB +${opt.min}`;
      if (opt.type === 'def') return `Def +${opt.min}`;
      if (opt.type === 'attr') return `${opt.name} ${opt.min}+`;
      if (opt.type === 'attrAny') return `any attr ${opt.min}+`;
      if (opt.type === 'skill') return `${opt.name} ${opt.min} ranks`;
      if (opt.type === 'feat') return opt.name;
      if (opt.type === 'featFamily') return `${opt.min} ${opt.family} feat${opt.min===1?'':'s'}`;
      if (opt.type === 'characterLevel') return `char level ${opt.min}+`;
      if (opt.type === 'classLevel') return `${opt.name||opt.tier} ${opt.min}+`;
      if (opt.type === 'sixLevel') return `${SIX_LEVELS[opt.axis]?.short||opt.axis} ${opt.min}+`;
      if (opt.type === 'casterLevel') return opt.pool==='any' ? `EAL/EDL ${opt.min}+` : `${(POOL_EFF_LEVEL[opt.pool]||{}).abbr||opt.pool} ${opt.min}+`;
      if (opt.type === 'manifesterLevel') return `EPL/ESL ${opt.min}+`;
      if (opt.type === 'heritage') return '1st-level slot';
      if (opt.type === 'allegiance') return `${opt.polarity==='lacks'?'no ':''}allegiance to ${opt.value}`;
      if (opt.type === 'note') return opt.text;
      // v8.5.4 ergo: types below previously fell through to raw
      // JSON.stringify — visible as "Prereq: {"type":"featParam"...}" in the
      // browser rows (Greater Spell Focus, Weapon Specialization, etc.).
      if (opt.type === 'featParam') return `${opt.name} (same choice)`;
      if (opt.type === 'allegianceAny') return 'at least one declared allegiance';
      if (opt.type === 'weaponProficiency') return 'proficiency with the chosen weapon';
      if (opt.type === 'alignment') return `${opt.polarity==='lacks'?'non-':''}${opt.value} alignment`;
      if (opt.type === 'save') return `base ${({fort:'Fort',ref:'Ref',will:'Will'})[opt.save]||opt.save} save +${opt.min}`;
      if (opt.type === 'sixLevelAny') return opt.axes.map(a=>`${SIX_LEVELS[a]?.short||a} ${opt.min}+`).join(' or ');
      if (opt.type === 'sixLevelOr') return opt.options.map(o=>`${SIX_LEVELS[o.axis]?.short||o.axis} ${o.min}+`).join(' or ');
      if (opt.type === 'tierLevel') return `${opt.min}+ ${opt.tier} level${opt.min===1?'':'s'}`;
      if (opt.type === 'skillFamily') return `${opt.family} (any) ${opt.min} ranks`;
      if (opt.desc) return opt.desc;
      return JSON.stringify(opt);
    }).join(' or ');
  }).join(' · ');
}

function filterFeats(){renderFeatBrowser(document.getElementById('feat-search').value,document.getElementById('feat-type-filter').value,document.getElementById('feat-qual-filter')?.value||'');}

// Add a feat from the browser. If the feat is parameterized, prompt for the parameter first.
async function pickAndAddFeat(name){
  const data = getFeatData(name);
  if (!data) {toast('Feat not found.');return;}
  const c = chars.find(x=>x.id===curId);
  if (!c) {toast('Select a hero first.');return;}
  // Prereq check — non-blocking, but warn. If user overrides, log a GM exception.
  const r = checkFeatPrereqs(name, c);
  let isException = false;
  let exceptionMissing = null;
  let exceptionTarget = null;
  if (r.heritageOffLevel) {
    // v8.3.31 (stopgap): Heritage feat being added above 1st level. Per the
    // rules a Heritage feat occupies a 1st-level Heritage slot; a character
    // past 1st level needs explicit GM approval (canonical case: Supernatural
    // Mutation gained mid-campaign through an exceptional in-game scenario).
    const msg = `"${name}" is a Heritage feat.\n\n` +
      `Heritage feats are normally assigned during 1st-level character ` +
      `creation, in a 1st-level Heritage slot. This character is past 1st ` +
      `level.\n\nAdd it anyway as a GM-approved exception? (The canonical ` +
      `case is a feat like Supernatural Mutation gained mid-campaign through ` +
      `an exceptional in-game scenario.)`;
    if (!(await confirmModal(msg))) return;
    isException = true;
    exceptionMissing = ['Heritage feat added above 1st level (normally assigned in a 1st-level Heritage slot)'];
    exceptionTarget = `Feat (Heritage, off-level): ${name}`;
  } else if (!r.met) {
    const unverify = r.missing.every(m => m.includes('(GM-verify)'));
    if (!unverify) {
      if (!(await confirmModal(`Missing prereqs:\n  · ${r.missing.join('\n  · ')}\n\nAdd anyway (will be recorded as GM exception)?`))) return;
      isException = true;
      exceptionMissing = r.missing.slice();
      exceptionTarget = `Feat: ${name}`;
    }
  }
  if (isException) {
    if (!c.gmExceptions) c.gmExceptions = [];
    if (!c.gmExceptions.find(e => e.target === exceptionTarget)) {
      c.gmExceptions.push({type:'feat', target:exceptionTarget, missing:exceptionMissing, grantedAt:new Date().toLocaleDateString()});
    }
  }
  if (data.param) {
    promptForFeatParam(data, param => addFeatToChar(name, param));
  } else {
    addFeatToChar(name);
  }
}

// v8.5.0: weapon proficiency resolver, per the HH proficiency-feat coverage:
//   • firearm-flagged weapons (firearm:true in WEAPONS) require Personal
//     Firearms Proficiency regardless of their Simple/Martial table category
//     (per Adam, 2026-06-12 — otherwise PFP is pointless). Exotic-cat
//     firearms (Machinegun, launchers) fall under the Exotic branch instead.
//   • cat Exotic — Exotic Weapon Proficiency taken with this weapon as its
//     parameter; for firearm-flagged exotics, Exotic Firearm Proficiency
//     also qualifies (its parameter is a weapon GROUP — cannon, heavy
//     machine gun, grenade launchers, rocket launchers — so we accept any
//     instance rather than mapping groups; the GM verifies the group fits).
//   • cat Martial — Archaic Weapons Proficiency, which per HH covers ALL
//     martial weapons up to the scenario's Tech Scale and is an automatic
//     class-entry grant (see CLASS_PROFICIENCIES); or Martial Weapon
//     Proficiency taken with this weapon as its parameter; or a class/racial
//     SPECIFIC weapon grant naming exactly this weapon (Bard/Rogue lists,
//     Drow/Elf racial weapon proficiencies).
//   • cat Simple — Simple Weapon Proficiency; per HH "all player characters
//     are assumed to have this feat", so simple weapons resolve proficient.
// Unknown weapon names (GM custom entries) resolve proficient — GM domain.
//
// v8.6.1 class-entry proficiency grants (Adam, 2026-09-01): every class's
// "Starting Feats" line from HH (Basic + Advanced) and GMG (Prestige),
// modeled as DERIVED proficiency — never written into c.feats (a class grant
// vanishes if the class levels are ever removed; deriving keeps that true
// automatically, same single-source-of-truth logic as the firm-wired items).
// Per Adam's clarification: GROUP feats resolve by the HH weapon category
// (Simple/Martial/Exotic on each WEAPONS entry); named grants cover ONLY the
// specific weapon. Choice-based grants ("gains any one Weapon Proficiency" —
// Explorer, Assassin, Tactician, Anti-Hero, Eldritch/Holy Knight,
// Weaponmaster, the Heavy's Martial-or-Firearms pick, Saint/Cleric War-domain
// riders) are NOT auto-granted: the player records the chosen feat on the
// Feats tab and the resolvers read owned feats first. Monk's CMA/DMA are
// combat feats, not proficiencies — outside this table (flagged to Adam).
// martial:true = the blanket Martial Weapons Proficiency grant (the Archaic
// resolver branch — tech-gated per Adam's 2026-06 ruling). armor uses
// ARMOR_CATALOG type keys: light/medium/heavy (power is feat-only).
const CLASS_PROFICIENCIES = {
  // ---- Basic classes (HH; all also grant Simple — assumed for all PCs) ----
  'Aristocrat':  { martial: true, armor: ['light', 'medium', 'heavy'], shield: true },
  'Bard':        { armor: ['light'], shield: true, weapons: ['longsword', 'rapier', 'sap', 'shortsword', 'shortbow', 'whip'] },
  'Berserker':   { martial: true, armor: ['light', 'medium'], shield: true },
  'Cleric':      { armor: ['light', 'medium', 'heavy'], shield: true },
  'Expert':      { armor: ['light'] },
  'Fighter':     { martial: true, armor: ['light', 'medium', 'heavy'], shield: true, towerShield: true },
  'Paladin':     { martial: true, armor: ['light', 'medium', 'heavy'], shield: true },
  'Ranger':      { martial: true, armor: ['light'], shield: true },
  'Rogue':       { armor: ['light'], shield: true, weapons: ['hand crossbow', 'longsword', 'rapier', 'sap', 'shortsword', 'shortbow'] },
  'Saint':       { armor: ['light'] },
  'Warmind':     { martial: true, armor: ['light', 'medium', 'heavy'], shield: true },
  'Wilder':      { armor: ['light'], shield: true },
  // Monk, Psion, Sorcerer, Wizard, the six Hero classes: Simple only.
  // ---- Advanced classes (HH) ----
  'Bodyguard':     { armor: ['light', 'medium'] },
  'Daredevil':     { armor: ['light'] },
  'Field Officer': { armor: ['light'] },
  'Soldier':       { armor: ['light'] },
  'Survivor':      { armor: ['light'] },
  // ---- Prestige classes (GMG) ----
  'Assassin': { armor: ['light'] },   // + one weapon proficiency of choice
  'Elocater': { armor: ['light'] },
  'Heavy':    { armor: ['light', 'medium', 'heavy'] }, // + Martial-or-Firearms pick
};

// Racial weapon proficiencies (HH races chapter) — specific weapons only.
const RACE_WEAPON_PROFICIENCIES = {
  'Drow': ['hand crossbow', 'rapier', 'short sword'],
  'Elf':  ['longsword', 'rapier', 'longbow', 'composite longbow', 'shortbow', 'composite shortbow'],
};

// WEAPONS names are comma-inverted ("Crossbow, hand"; "Sword, short") while
// the book's grant lists read naturally ("hand crossbow", "shortsword") —
// normalize both sides: lowercase, un-invert around the comma, strip
// non-letters. "Crossbow, hand"→"handcrossbow"; "Sword, short"→"shortsword".
function _normWeaponName(n) {
  const parts = String(n || '').toLowerCase().split(',').map(s => s.trim());
  if (parts.length === 2) parts.reverse();
  return parts.join(' ').replace(/[^a-z]/g, '');
}

// Aggregate the derived class + racial grants for a character. The optional
// classArrOverride serves the class-prereq engine, which evaluates candidate
// class arrays that aren't saved on a character yet.
function charProficiencyGrants(c, classArrOverride) {
  const g = { martial: false, armor: new Set(), shield: false, towerShield: false, weapons: new Set(), weaponsDisp: [] };
  const classArr = classArrOverride || migrateLegacyClasses(c || {});
  for (const e of classArr) {
    const p = CLASS_PROFICIENCIES[e.name];
    if (!p || !((e.level || 0) > 0)) continue;
    if (p.martial) g.martial = true;
    if (p.shield) g.shield = true;
    if (p.towerShield) g.towerShield = true;
    for (const a of (p.armor || [])) g.armor.add(a);
    for (const w of (p.weapons || [])) {
      if (!g.weapons.has(_normWeaponName(w))) g.weaponsDisp.push(w);
      g.weapons.add(_normWeaponName(w));
    }
  }
  // v8.68.0: Hybrids union both parents' racial weapon proficiencies.
  const _hyWP = hybridInfo(c);
  for (const rk of (_hyWP ? [_hyWP.a, _hyWP.b] : [(c && c.race) || ''])) {
    for (const w of (RACE_WEAPON_PROFICIENCIES[rk] || [])) {
      if (!g.weapons.has(_normWeaponName(w))) g.weaponsDisp.push(w + ` (racial${_hyWP ? ' — ' + rk : ''})`);
      g.weapons.add(_normWeaponName(w));
    }
  }
  return g;
}

// The class grants expressed as feat NAMES, so prereq engines that match on
// owned-feat names (checkFeatPrereqs, checkClassPrereqsFromArray) see a
// Fighter as satisfying "feat: Shield Proficiency" or a Soldier candidate's
// "Martial Weapon Proficiency" without a redundant record in c.feats. The
// blanket martial grant answers to both its book name and the generator's
// Archaic blanket feat. Specific weapon grants (Bard/Rogue/racial lists) are
// deliberately NOT emitted — a named grant covers only that weapon, never a
// group prereq (Adam, 2026-09-01).
function proficiencyPseudoFeats(grants) {
  const names = [];
  if (grants.martial) names.push('Martial Weapon Proficiency', 'Martial Weapons Proficiency', 'Archaic Weapons Proficiency');
  const ARMOR_FEAT = { light: 'Armor Proficiency (Light)', medium: 'Armor Proficiency (Medium)', heavy: 'Armor Proficiency (Heavy)' };
  for (const t of grants.armor) if (ARMOR_FEAT[t]) names.push(ARMOR_FEAT[t]);
  if (grants.shield) names.push('Shield Proficiency');
  if (grants.towerShield) names.push('Tower Shield Proficiency');
  return names;
}

// v8.6.1 (Adam's ruling, 2026-09-01): some classes grant real COMBAT feats on
// entry — the Monk's Combat Martial Arts + Defensive Martial Arts. Unlike the
// derived proficiencies above, these ARE written into c.feats (they carry
// mechanical wiring the feat system reads — unarmed lethality, AC bonus) but
// with a `grantedBy` provenance flag ("Monk 1"): they cost no feat slot
// (getFeatBudget excludes grantedBy records) and are auto-removed when the
// granting class's levels are gone. A copy the player already picked stays
// untouched — no second record, no slot refund (d20 convention: a duplicate
// grant simply does nothing).
const CLASS_GRANTED_FEATS = {
  'Monk': ['Combat Martial Arts', 'Defensive Martial Arts'],
};
// v8.8.0 (Adam's Advantages wire-ability pass): mutations that grant bonus
// feats use the same grantedBy machinery — no slot consumed, auto-removed
// with the mutation (Hypersensitivity's Blind-Fight; the Ultra Immune
// System advantage's same-named feat, prereqs waived per the entry).
const MUTATION_GRANTED_FEATS = {
  'Hypersensitivity': ['Blind-Fight'],
  'Ultra Immune System': ['Ultra Immune System'],
};
// v8.8.3 (Adam's Basic-class pass): LEVELED class feat grants — awarded at
// the named class level, auto-removed if levels drop. Windfall appears twice
// for the Aristocrat (7th and 13th — the reconciler now counts duplicates).
// Wealth note: each granted Windfall implies +3 Wealth — the wealth score is
// a creation-time snapshot, so the GM applies the +3 manually (flagged in
// the provenance label).
const CLASS_GRANTED_FEATS_LEVELED = {
  'Ranger':     [{ lvl: 1, feat: 'Track' }, { lvl: 3, feat: 'Endurance' }],
  'Aristocrat': [{ lvl: 7, feat: 'Windfall', why: 'apply +3 Wealth manually' }, { lvl: 9, feat: 'Leadership' }, { lvl: 11, feat: 'Renown' }, { lvl: 13, feat: 'Windfall', why: 'apply +3 Wealth manually' }],
  'Monk':       [{ lvl: 5, feat: 'Speed of Thought', why: 'Purity of Body — virtual feat' }, { lvl: 8, feat: 'Power Fist', waived: true }, { lvl: 14, feat: 'Greater Power Fist', waived: true }],
  'Wizard':     [{ lvl: 1, feat: 'Enchant Scroll' }],
  // v8.9.1 Advanced classes (verified HH pp.114–144). Grants naming feats
  // not yet in FEATS_DB are skipped by the existence guard below.
  'Explorer':   [{ lvl: 1, feat: 'Guide', why: 'Survivalist' }],
  'Infiltrator': [{ lvl: 8, feat: 'Iron Will', why: 'Method Actor' }, { lvl: 8, feat: 'Jack of All Trades', why: 'Method Actor' }],
  'Techsmith':  [{ lvl: 1, feat: 'Mastercrafter', why: 'Mastercraft XP Reserve' }],
  // v8.10.1 Prestige classes (GMG pp.152–188).
  'Elocater':   [{ lvl: 2, feat: 'Sidestep Charge', waived: true }],
  'Shadowjack': [{ lvl: 9, feat: 'Jack of All Trades', why: 'Living Library' }],
  'Assassin':   [{ lvl: 10, feat: 'Leadership', why: 'Guildmaster' }],
};
function reconcileGrantedFeats(c) {
  if (!c) return false;
  if (!c.feats) c.feats = [];
  const classArr = migrateLegacyClasses(c);
  const expected = [];  // {name, param?, by}
  for (const e of classArr) {
    if (!((e.level || 0) > 0)) continue;
    for (const n of (CLASS_GRANTED_FEATS[e.name] || [])) expected.push({ name: n, by: e.name + ' 1' });
    for (const g of (CLASS_GRANTED_FEATS_LEVELED[e.name] || [])) {
      if ((e.level || 0) >= g.lvl) expected.push({ name: g.feat, by: `${e.name} ${g.lvl}${g.why ? ' — ' + g.why : ''}${g.waived ? ' (prereqs waived)' : ''}` });
    }
  }
  // Choice-parameterized grants (gated on the granting level still held).
  {
    const lvlG = (n) => classArr.filter(e => e.name === n).reduce((s, e) => s + (e.level || 0), 0);
    const dec = classChoiceVal(c, 'ari_dec_1'), ref = classChoiceVal(c, 'ari_ref_3');
    if (dec && lvlG('Aristocrat') >= 1) expected.push({ name: 'Skill Focus', param: dec, by: 'Aristocrat 1 (Decorum)' });
    if (ref && lvlG('Aristocrat') >= 3) expected.push({ name: 'Skill Focus', param: ref, by: 'Aristocrat 3 (Refinement)' });
    // v8.9.1 Advanced-class choice grants.
    const dns = classChoiceVal(c, 'dd_ns_1');
    if (dns && lvlG('Daredevil') >= 1) expected.push({ name: 'Skill Focus', param: dns, by: 'Daredevil 1 (Niche Specialty)' });
    const swf = classChoiceVal(c, 'sol_wf_1');
    if (swf && lvlG('Soldier') >= 1) {
      expected.push({ name: 'Weapon Focus', param: swf, by: 'Soldier 1 (class feature)' });
      if (lvlG('Soldier') >= 2) expected.push({ name: 'Weapon Specialization', param: swf, by: 'Soldier 2 (class feature — no Fighter-level prereq)' });
    }
    const ssw = classChoiceVal(c, 'shs_sw_2');
    if (ssw && lvlG('Sharpshooter') >= 2) expected.push({ name: 'Weapon Focus', param: ssw, by: 'Sharpshooter 2 (Signature Weapon)' });
    // v8.10.1 prestige choice grants.
    const agm = classChoiceVal(c, 'asn_gm_10');
    if (agm && lvlG('Assassin') >= 10) expected.push({ name: agm, by: 'Assassin 10 (Guildmaster)' });
    const ekh = classChoiceVal(c, 'ek_kh_10');
    if (ekh && lvlG('Eldritch Knight') >= 10) {
      if (/Both/.test(ekh)) { expected.push({ name: 'Renown', by: 'Eldritch Knight 10 (Knighthood — Allegiance)' }); expected.push({ name: 'Windfall', by: 'Eldritch Knight 10 (Knighthood — apply +3 Wealth manually)' }); }
      else expected.push({ name: ekh, by: 'Eldritch Knight 10 (Knighthood)' + (ekh === 'Windfall' ? ' — apply +3 Wealth manually' : '') });
    }
    if (classChoiceVal(c, 'hk_kh_10') && lvlG('Holy Knight') >= 10) {
      expected.push({ name: 'Renown', by: 'Holy Knight 10 (Knighthood — church Allegiance)' });
      expected.push({ name: 'Windfall', by: 'Holy Knight 10 (Knighthood — apply +3 Wealth manually)' });
    }
    // Loremaster secret feat picks.
    for (const k in (c.classChoices || {})) {
      if (!k.startsWith('lm_sec_')) continue;
      const v = c.classChoices[k];
      if (/Dodge trick/.test(v)) expected.push({ name: 'Dodge', by: 'Loremaster (Secret — prereqs waived)' });
    }
  }
  for (const m of (c.mutations || [])) {
    for (const n of (MUTATION_GRANTED_FEATS[m.name] || [])) expected.push({ name: n, by: m.name + ' (mutation)' });
  }
  // v8.16.0 Races pass: racial bonus feats (Merfolk's Alertness).
  // v8.68.0: Hybrids inherit both parents' racial feat grants (union).
  { const _hyGF = hybridInfo(c);
    for (const rk of (_hyGF ? [_hyGF.a, _hyGF.b] : [c.race])) {
      for (const n of ((RACES[rk] || {}).grantsFeats || [])) if (!expected.some(e => e.name === n)) expected.push({ name: n, by: rk + ' (racial)' });
    } }
  // v8.55.0: homebrew-heritage child grants — the _hb-bearing entry on the
  // character is the source of truth (courier-safe: travels with the JSON,
  // independent of the GM's library). Without this, the count-aware removal
  // below would garbage-collect World Heritage grants at the next level-up.
  for (const f of c.feats) {
    if (f._hb && Array.isArray(f._hb.grantsAdded)) {
      for (const g of f._hb.grantsAdded) expected.push({ name: g, by: (f.name || f.n) + ' (homebrew)' });
    }
  }
  // Count-aware reconcile (duplicate grants like Windfall ×2 supported).
  const keyOf = (n, p) => n + '::' + (p || '');
  const expByKey = {};
  for (const x of expected) (expByKey[keyOf(x.name, x.param)] = expByKey[keyOf(x.name, x.param)] || []).push(x);
  let changed = false;
  // Remove granted records beyond (or absent from) the expected counts.
  const seenGranted = {};
  for (let i = c.feats.length - 1; i >= 0; i--) {
    const f = c.feats[i];
    if (!f.grantedBy) continue;
    if (f._hb) continue;  // v8.55.0: the homebrew entry itself is self-authorized — only its grant/revoke flow touches it
    const k = keyOf(f.name || f.n, f.param);
    seenGranted[k] = (seenGranted[k] || 0) + 1;
    if (seenGranted[k] > ((expByKey[k] || []).length)) { c.feats.splice(i, 1); changed = true; }
  }
  // Add missing grants — manual copies count toward the total (a duplicate
  // grant does nothing, d20 convention). v8.9.1: existence guard — a grant
  // naming a feat not in FEATS_DB is skipped (mecha/starship-era feats).
  for (const k in expByKey) {
    const want = expByKey[k];
    if (!getFeatData(want[0].name)) continue;
    const haveAny = c.feats.filter(f => keyOf(f.name || f.n, f.param) === k).length;
    for (let i = haveAny; i < want.length; i++) {
      const w = want[i];
      const rec = { name: w.name, grantedBy: w.by };
      if (w.param) rec.param = w.param;
      c.feats.push(rec); changed = true;
    }
  }
  // v8.8.3: class attribute bakes ride the same reconcile moments.
  if (reconcileClassAttrBakes(c)) changed = true;
  // v8.9.1: class-feature HP bakes (Bodyguard Toughness) likewise.
  if (reconcileClassHp(c)) changed = true;
  // v8.11.1 Segment B: Splice Gene Therapy MP grants.
  if (reconcileSpliceMP(c)) changed = true;
  // v8.13.0: Expanded Knowledge bonus powers known (Adam's Rhad report).
  if (reconcileExpandedKnowledgePowers(c)) changed = true;
  return changed;
}

function isProficientWithWeapon(c, weaponName) {
  const w = WEAPONS.find(x => x.n === weaponName);
  if (!w) return true;
  const feats = (c && c.feats) || [];
  const owns = (n) => feats.some(f => (f.name || f.n) === n);
  const ownsParam = (n, p) => feats.some(f => (f.name || f.n) === n && f.param === p);
  const grants = charProficiencyGrants(c);
  // Specific named grants (Bard/Rogue lists, Drow/Elf racial) — exact weapon
  // only, never widened to the group (Adam, 2026-09-01) — but they DO cover
  // that weapon whatever its group: the Rogue's hand crossbow and the Bard's
  // whip are Exotic-category weapons, granted by name.
  if (grants.weapons.has(_normWeaponName(w.n))) return true;
  if (w.cat === 'Exotic') {
    if (w.firearm && owns('Exotic Firearm Proficiency')) return true;
    return ownsParam('Exotic Weapon Proficiency', w.n);
  }
  if (w.firearm) return owns('Personal Firearms Proficiency');
  if (w.cat === 'Martial') {
    const hasArchaic = owns('Archaic Weapons Proficiency') || grants.martial;
    const tech = (c && c.sixLevels && c.sixLevels.tech) || 0;
    if (hasArchaic && w.tl <= tech) return true;
    return ownsParam('Martial Weapon Proficiency', w.n);
  }
  return true; // Simple — SWP assumed for all PCs per HH
}

// v8.6.1: armor/shield proficiency resolver + the non-proficiency penalty.
// ARMOR_CATALOG types: light/medium/heavy → the matching Armor Proficiency
// feat or a class grant; power → Armor Proficiency (Powered), feat-only (no
// class grants powered armor); shield → Shield Proficiency or a class shield
// grant, EXCEPT "Shield, tower" which needs Tower Shield Proficiency or the
// Fighter's entry grant. Unknown armor names resolve proficient — GM domain.
function isProficientWithArmor(c, armorName) {
  const a = ARMOR_CATALOG.find(x => x.name === armorName);
  if (!a) return true;
  const feats = (c && c.feats) || [];
  const owns = (n) => feats.some(f => (f.name || f.n) === n);
  const grants = charProficiencyGrants(c);
  if (a.type === 'shield') {
    if (/tower/i.test(a.name)) return owns('Tower Shield Proficiency') || grants.towerShield;
    return owns('Shield Proficiency') || grants.shield;
  }
  if (a.type === 'power') return owns('Armor Proficiency (Powered)');
  const FEAT_BY_TYPE = { light: 'Armor Proficiency (Light)', medium: 'Armor Proficiency (Medium)', heavy: 'Armor Proficiency (Heavy)' };
  return owns(FEAT_BY_TYPE[a.type]) || grants.armor.has(a.type);
}

// Armor check penalty as a signed int. The catalogue strings are messy:
// "+/-0", "-3", "–1" (en-dash) — any digit run counts, dash-family = minus.
function parseArmorCheckPenalty(a) {
  const m = String((a && a.armor_check_penalty) || '').match(/[-–−]?\s*(\d+)\s*$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return /[-–−]\s*\d+\s*$/.test(String(a.armor_check_penalty)) ? -n : 0;
}

// v8.93.0 (Adam's Ultralight report): ARMOR CHECK PENALTY finally reaches
// the SKILL TABLE — the "separate, not-yet-modeled rule" confessed below
// since §32. Ultralight Composition's easing had nothing to ease until now.
// Proficient wearers: ACP applies to the HH's ACP-flagged skills (the Skill
// Descriptions qualifier line). Non-proficient wearers: that piece's ACP
// applies to ALL Str-/Dex-based skill checks instead (d20 rule). E&E Swim
// takes SINGLE ACP — the book replaces 3.5's doubling with its own −1 per
// 5 lb of gear Special (absence of a 3.5 modifier is intentional).
const ACP_SKILLS = ['Balance', 'Climb', 'Escape Artist', 'Hide', 'Jump', 'Move Silently', 'Sleight of Hand', 'Swim', 'Tumble'];
function equippedACPPieces(c) {
  const parts = [];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def) continue;
    let acp = parseArmorCheckPenalty(def);
    const eased = [];
    // GMG p.240: mastercraft armor (and enchanted/imbued armor, which is
    // mastercrafted by definition) eases the armor check penalty by 1.
    if (acp < 0 && (it.enchant || it.mastercraft)) { acp = Math.min(0, acp + 1); eased.push('mastercraft +1'); }
    if (acp < 0) {
      for (const gg of (it.gadgets || [])) {
        const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
        for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
          if (contrib.kind === 'armorCheckPenalty' && typeof contrib.amount === 'number') { acp = Math.min(0, acp + contrib.amount); eased.push(gg.ref + ' +' + contrib.amount); }
        }
      }
    }
    if ((c.mutations || []).some(m => m.name === 'Festering Sores')) acp -= 4;
    if (acp < 0) parts.push({ name: it.ref, acp, eased, proficient: isProficientWithArmor(c, it.ref) });
  }
  return parts;
}
function buildArmorCheckPenaltyBonuses(c) {
  const out = {};
  const strDex = SKILLS.filter(sk => sk.k === 'STR' || sk.k === 'DEX').map(sk => sk.n);
  for (const p of equippedACPPieces(c)) {
    const targets = p.proficient ? ACP_SKILLS : strDex;
    const label = `${p.name} armor check penalty${p.eased.length ? ' (eased: ' + p.eased.join(', ') + ')' : ''}${p.proficient ? '' : ' — NON-PROFICIENT: all Str/Dex checks'}`;
    for (const sk of targets) {
      (out['skill:' + sk] = out['skill:' + sk] || []).push({ type: BONUS_TYPES.UNTYPED, source: 'acp:' + p.name, value: p.acp, label });
    }
  }
  return out;
}

// d20 non-proficiency rule: wearing armor (or bearing a shield) without the
// matching proficiency applies its armor check penalty to attack rolls and
// to all Str-/Dex-based checks. Summed across every equipped offender —
// consumed by computeEquippedWeaponSummaries and flagged on the Gear tab.
// (The skill-side application lives in buildArmorCheckPenaltyBonuses above
// as of v8.93.0 — this function keeps the ATTACK-ROLL side.)
function nonProficientArmorPenalty(c) {
  const parts = [];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def || isProficientWithArmor(c, it.ref)) continue;
    let acp = parseArmorCheckPenalty(def);
    // v8.6.1: enchanted/imbued armor is mastercrafted by definition, easing
    // the armor check penalty by 1 (GMG p.240).
    if (acp < 0 && (it.enchant || it.mastercraft)) acp = Math.min(0, acp + 1); // v8.93.0: mastercraft itself eases 1 (GMG p.240) — parity with the skill-side pass
    // v8.8.0 gadget wiring: Morphic Metal Alloy / Ultralight Composition
    // each ease the armor check penalty by 1 (data-driven from their
    // armorCheckPenalty contributions).
    if (acp < 0) {
      for (const gg of (it.gadgets || [])) {
        const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
        for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
          if (contrib.kind === 'armorCheckPenalty' && typeof contrib.amount === 'number') acp = Math.min(0, acp + contrib.amount);
        }
      }
    }
    // v8.8.0: Festering Sores worsens any worn armor's check penalty by 4
    // (HH p.416) — it can push an otherwise penalty-free armor negative.
    if ((c.mutations || []).some(m => m.name === 'Festering Sores')) acp -= 4;
    if (acp < 0) parts.push({ name: it.ref, acp });
  }
  return { total: parts.reduce((s, p) => s + p.acp, 0), parts };
}

