// =============================================================================
// js/rules/04-advanced-classes.js
// ADVANCED CLASSES
// =============================================================================
//
// WHAT'S IN HERE
//   ADVANCED_CLASSES: the advanced-tier class table (prerequisites and
//   per-level progressions).
//
// KEY NAMES (so you can search for them)
//   tables/objects: ADVANCED_CLASSES
//
// LOAD ORDER
//   File 4 of 68. index.html loads it after
//   js/rules/03-feat-slots-and-caster-progression.js and before
//   js/rules/05-six-scales-and-scenarios.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 4293-4535 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 4293-4535; unchanged below this line ----
const ADVANCED_CLASSES = {
  'Ace Pilot':    {attr:'DEX',hd:8, sp:4,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,1,1,1,2,2,2,3,3,3],
    prereqs:[
      [{type:'skill',name:'Drive',min:6},{type:'skill',name:'Pilot',min:6},{type:'skill',name:'Ride',min:6}],
      [{type:'skill',name:'Navigate',min:6}],
      [{type:'feat',name:'Animal Affinity'},{type:'feat',name:'Vehicle Expert'}],
    ], apB:6},
  'Ambassador':   {attr:'CHA',hd:6, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'skill',name:'Diplomacy',min:6}],
      [{type:'skill',name:'Knowledge (Civics)',min:6}],
      [{type:'skill',name:'Knowledge (Theology & Philosophy)',min:6}],
    ], apB:6},
  'Bodyguard':    {attr:'STR/CON',hd:12, sp:4,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Concentration',min:6}],
      [{type:'skill',name:'Intimidate',min:6}],
      [{type:'feat',name:'Brawl'},{type:'feat',name:'Personal Firearms Proficiency'}],
    ], apB:6},
  'Combat Medic': {attr:'WIS',hd:8, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Treat Injury',min:6}],
      [{type:'skill',name:'Spot',min:6}],
      [{type:'feat',name:'Surgery'}],
    ], apB:6},
  'Daredevil':    {attr:'DEX/CHA',hd:8, sp:4,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Balance',min:6}],
      [{type:'skill',name:'Concentration',min:6}],
      [{type:'skill',name:'Tumble',min:6}],
      [{type:'feat',name:'Acrobatic'}],
    ], apB:6},
  'Explorer':     {attr:'INT/WIS',hd:8, sp:6,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'skill',name:'Knowledge (Earth & Life Sciences)',min:6}],
      [{type:'skill',name:'Knowledge (History)',min:4},{type:'skill',name:'Knowledge (Physical Sciences)',min:4},{type:'skill',name:'Knowledge (Theology & Philosophy)',min:4}],
      [{type:'skill',name:'Search',min:4}],
      [{type:'skill',name:'Survival',min:6}],
      [{type:'feat',name:'Alertness'},{type:'talent',name:'Aware',desc:'Aware talent (HH p.67 — the Explorer prereq line calls it “Awareness”; same talent)'}],  // v8.71.0: was feat:'Awareness' — unsatisfiable (it's the Dedicated Hero's Aware TALENT)
    ], apB:6},
  'Field Officer':{attr:'CHA',hd:8, sp:4,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Diplomacy',min:6}],
      [{type:'skill',name:'Knowledge (Tactics)',min:6}],
      [{type:'feat',name:'Skill Focus',desc:'Skill Focus (any Field Officer class skill — GM verifies the skill) feat'},{type:'talent',name:'Coordinate',desc:'Coordinate talent'}],  // v8.71.0: Coordinate is a Charismatic Hero TALENT, was typed feat (unsatisfiable)
    ], apB:6},
  'Infiltrator':  {attr:'DEX/CHA',hd:6, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,2,2,3,4,4,5,6,6,7],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Disguise',min:6}],
      [{type:'skill',name:'Hide',min:6}],
      [{type:'skill',name:'Move Silently',min:6}],
      [{type:'feat',name:'Deceptive'},{type:'feat',name:'Stealthy'}],
    ], apB:6},
  'Investigator': {attr:'INT/WIS',hd:6, sp:6,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Investigate',min:6}],
      [{type:'skill',name:'Sense Motive',min:6}],
      [{type:'feat',name:'Skill Focus',desc:'Skill Focus (any one Investigator class skill — GM verifies the skill) feat'},{type:'talent',name:'Empathy',desc:'Empathy talent'}],  // v8.71.0: Empathy is a Dedicated Hero TALENT, was typed feat (unsatisfiable)
    ], apB:6},
  'Marketeer':    {attr:'CHA',hd:6, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,1,2,2,2,3,3,3],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'skill',name:'Bluff',min:6}],
      [{type:'skill',name:'Diplomacy',min:6}],
      [{type:'skill',name:'Gather Information',min:6}],
      [{type:'skill',name:'Knowledge (Business)',min:6},{type:'skill',name:'Knowledge (Streetwise)',min:6}],
    ], apB:6},
  'Martial Artist':{attr:'STR/DEX',hd:10, sp:4,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,2,2,3,4,4,5,6,6,7],
    rep :[0,0,0,0,1,1,1,1,2,2],
    prereqs:[
      [{type:'bab',min:3}],
      [{type:'skill',name:'Concentration',min:6}],
      [{type:'feat',name:'Combat Martial Arts'},{type:'talent',name:'Melee Smash',desc:'Melee Smash talent'}],  // v8.71.0: Melee Smash is a Strong Hero TALENT, was typed feat (unsatisfiable)
      [{type:'feat',name:'Defensive Martial Arts'},{type:'talent',namePrefix:'Damage Reduction',desc:'Damage Reduction talent (any tier)'}],  // v8.71.0: was a GM-verify note — now checks the DR 1/-..3/- ladder
    ], apB:6},
  'Personality':  {attr:'CHA',hd:6, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[0,1,1,1,2,2,2,3,3,3],
    rep :[2,2,2,3,3,3,4,4,4,5],
    prereqs:[
      [{type:'skill',name:'Diplomacy',min:6}],
      [{type:'skillFamily',family:'Perform',min:6}],
      [{type:'feat',name:'Renown'}],
    ], apB:6},
  'Sharpshooter': {attr:'DEX',hd:10, sp:4,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'bab',min:2}],
      [{type:'skill',name:'Sleight of Hand',min:6}],
      [{type:'skill',name:'Tumble',min:6}],
      [{type:'feat',name:'Personal Firearms Proficiency'},{type:'feat',name:'Point-Blank Shot'}],
    ], apB:6},
  'Soldier':      {attr:'STR',hd:10, sp:4,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,0,0,1,1,1,1,2,2],
    prereqs:[
      [{type:'bab',min:3}],
      [{type:'skill',name:'Knowledge (Tactics)',min:3}],
      [{type:'feat',name:'Martial Weapon Proficiency'},{type:'feat',name:'Personal Firearms Proficiency'}],
    ], apB:6},
  'Survivor':     {attr:'CON/WIS',hd:12, sp:6,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,2,2,3,3,4,4,5,5,6],
    rep :[0,0,0,0,1,1,1,1,2,2],
    prereqs:[
      [{type:'def',min:2}],
      [{type:'skill',name:'Sense Motive',min:6}],
      [{type:'skill',name:'Survival',min:6}],
      [{type:'feat',name:'Dodge'},{type:'talent',name:'Evasion',desc:'Evasion talent'},{type:'classAbility',name:'Evasion'}],  // v8.71.0: "Dodge feat or Evasion talent / class ability" (HH) — Evasion was typed feat (unsatisfiable)
      [{type:'feat',name:'Toughness'},{type:'talent',heroClass:'Tough Hero',desc:'any Tough Hero talent'}],  // v8.71.0: the tree-stub never checked; heroClass matches the book's "any Tough Talent"
    ], apB:7},
  'Tactician':    {attr:'INT',hd:8, sp:6,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'skill',name:'Gather Information',min:6}],
      [{type:'skill',name:'Knowledge (Tactics)',min:6}],
      [{type:'skill',name:'Sense Motive',min:6}],
      // v8.71.0 (Adam's Hellfire/Compass report): the full HH p.137 entry is
      // param-specific AND types each option — "Skill Focus (Knowledge
      // [tactics]) feat or Savant (Knowledge [tactics]) talent or Skill
      // Emphasis (Knowledge [tactics]) talent." Savant was typed as a feat
      // (unsatisfiable); Skill Emphasis was an unchecked note.
      [{type:'featParamIs',name:'Skill Focus',param:'Knowledge (Tactics)',desc:'Skill Focus (Knowledge [Tactics]) feat'},
       {type:'talent',name:'Savant',param:'Knowledge (Tactics)',desc:'Savant (Knowledge [Tactics]) talent'},
       {type:'talent',name:'Skill Emphasis',param:'Knowledge (Tactics)',desc:'Skill Emphasis (Knowledge [Tactics]) talent'}],
    ], apB:6},
  'Techsmith':    {attr:'INT',hd:6, sp:6,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'skill',name:'Computer Use',min:6,note:'Tech 5+ scenarios only'}],
      [{type:'skillFamily',family:'Craft',min:6}],
      [{type:'skill',name:'Knowledge (Physical Sciences)',min:6},{type:'skill',name:'Knowledge (Technology)',min:6}],
      [{type:'feat',name:'Builder'},{type:'talent',name:'Savant',paramPrefixes:['Computer Use','Craft (','Disable Device','Knowledge (Physical Sciences)','Knowledge (Technology)','Navigate','Search'],desc:'Savant (any Techsmith class skill) talent'}],  // v8.71.0: Savant is a TALENT, was typed feat (unsatisfiable); param held to Techsmith class skills per the full HH entry
    ], apB:6},
  'Weaponmaster': {attr:'STR/DEX',hd:10, sp:4,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[0,0,1,1,1,2,2,2,3,3],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'bab',min:3}],
      [{type:'skill',name:'Knowledge (History)',min:4}],
      [{type:'feat',name:'Martial Weapon Proficiency'}],
      [{type:'feat',name:'Weapon Focus'}],
    ], apB:6},
};
