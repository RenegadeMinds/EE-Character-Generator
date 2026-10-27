// =============================================================================
// js/rules/07-prestige-classes.js
// PRESTIGE CLASSES
// =============================================================================
//
// WHAT'S IN HERE
//   PRESTIGE_CLASSES, plus the class lookup and class-prerequisite checkers
//   (getClassData, checkClassPrereqs, checkAdvancedPrereqs) used by the Create
//   page and level-up.
//
// KEY NAMES (so you can search for them)
//   tables/objects: PRESTIGE_CLASSES
//   functions (4): getClassData, checkClassPrereqsFromArray,
//   checkClassPrereqs, checkAdvancedPrereqs
//
// LOAD ORDER
//   File 7 of 68. index.html loads it after
//   js/rules/06-homebrew-forge-armory-monstrous.js and before
//   js/rules/08-feat-prereqs-and-bonuses.js.
//   All the js/ files share ONE global scope: they are plain <script src>
//   tags, not modules. Anything declared here is visible to every other file,
//   and functions here may call functions in any other file. The one rule:
//   code that runs IMMEDIATELY when this file loads (anything not inside a
//   function) may only use things from files loaded EARLIER. See js/README.md.
//
// WHERE IT CAME FROM
//   Lines 5429-6183 of the single-file index.html at v9.19.0 (commit 1c1044b),
//   moved here unchanged by tools/split_index.py. The version notes inside the
//   code ("v8.3.17 ...", "Adam's ruling ...", the section numbers) are the
//   original change history and were kept as they were.
//
// ---- verbatim from index.html v9.19.0, lines 5429-6183; unchanged below this line ----
// ==== end v8.55.0 homebrew block ====
// PRESTIGE CLASSES — Chapter IV of the GM's Guide. Like Advanced classes but with stricter
// prerequisites, often including scenario-level requirements set by the GM. Hit dice and skill
// points are noted alongside each entry. Several classes are paired (Eldritch/Holy Knight,
// Mystic/Psychic Theurge, Arcane/Psychic Trickster, Technomage/Technopath, Super-Hero/Super-Villain) —
// each pair shares the statistical progression but has different scenario prereqs.
const PRESTIGE_CLASSES = {
  'Anti-Hero':            {attr:'CHA',hd:10, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,1,1,1,2,2,2,3,3,3],
    prereqs:[
      [{type:'attrAny',min:13}],
      [{type:'note',text:'Available only at 1st level'}],
      [{type:'allegiance',value:'Good',polarity:'lacks'}],
      [{type:'allegiance',value:'Evil',polarity:'lacks'}],
    ], apB:'cha'},
  'Arcane Trickster':     {attr:'INT',hd:6, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[2,3,3,4,4,5,5,6,6,7],
    // v9.15.2 (§275 F9): DB corrected to the printed ladder (GMG p.188:
    // 1,1,1,2,2,2,3,3,3,4) — the old array ran +1 high from L3 (+2 at L9).
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'allegiance',value:'Law',polarity:'lacks'}],
      [{type:'skill',name:'Decipher Code',min:7}],
      [{type:'skill',name:'Disable Device',min:7}],
      [{type:'skill',name:'Escape Artist',min:7}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:4}],
      [{type:'classAbility',name:'Far Hand'}],
      [{type:'powerAccess',pools:['arcane'],lvl:3,desc:'Able to cast 3rd-level arcane spells'}],
      [{type:'classAbility',name:'Sneak Attack +1d6'}],
    ], apB:'cha'},
  'Archmage':             {attr:'INT',hd:4, sp:4, maxLvl:5,
    bab :[0,1,1,2,2],
    fort:[0,0,1,1,1],
    ref :[0,0,1,1,1],
    will:[2,3,3,4,4],
    def :[0,1,1,1,2],
    rep :[2,3,3,3,4],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:5}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:15}],
      [{type:'skill',name:'Spellcraft',min:15}],
      [{type:'featParamIs',name:'Skill Focus',param:'Spellcraft',desc:'Skill Focus (Spellcraft)'}],
      [{type:'featParamCount',name:'Spell Focus',min:2,desc:'Spell Focus in two different schools'}],
      [{type:'powerAccess',pools:['arcane'],lvl:7,desc:'Access to 7th-level arcane spells'}],
      [{type:'powerRepertoire',pool:'arcane',minLvl:5,distinctSchools:5,desc:'5th-level+ spells known from at least 5 different schools'}],
    // v9.15.2 (§275 F13): GMG p.155 prints Cha mod + ½ level — stamped for
    // completeness (every route in already carries a Basic apB:'cha').
    ], apB:'cha'},
  'Artificer':            {attr:'INT',hd:6, sp:6, maxLvl:5,
    bab :[0,1,1,2,2],
    fort:[0,0,1,1,1],
    ref :[0,0,1,1,1],
    will:[2,3,3,4,4],
    def :[0,1,1,1,2],
    rep :[1,2,2,2,3],
    prereqs:[
      [{type:'sixLevelAny',axes:['arcane','divine','psionic'],min:1}],
      [{type:'skill',name:'Craft (Mechanical)',min:8}],
      [{type:'skillFamily',family:'Craft',min:8}],
      [{type:'powerAccess',pools:'any',lvl:2,desc:'Able to cast or manifest 2nd-level spells/powers'}],
      [{type:'featCount',families:['Magic','Power'],min:1,desc:'Any other Magic or Power feat'}],
    ], apB:'cha'},
  'Assassin':             {attr:'DEX',hd:6, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'allegiance',value:'Evil',polarity:'has'}],
      [{type:'skill',name:'Disguise',min:4}],
      [{type:'skill',name:'Hide',min:8}],
      [{type:'skill',name:'Move Silently',min:8}],
      [{type:'note',text:'Must have successfully completed a contract killing'}],
    ], apB:'cha'},
  // v9.15.2 (§275 F6): hd 10→12 — GMG p.160 prints "d12 (d6+6)".
  'Bloodluster':          {attr:'STR',hd:12, sp:4, maxLvl:10,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,2,2,3,3,4,4,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'bab',min:4}],
      [{type:'skill',name:'Concentration',min:8}],
      [{type:'skill',name:'Intimidate',min:8}],
      [{type:'skill',name:'Survival',min:8}],
      [{type:'classAbility',name:'Rage'},{type:'classAbility',name:'Euphoriac'}],
    ], apB:'cha'},
  // v9.15.2 (§275 F6): hd 8→10 — GMG p.161 prints "d10 (d5+5)".
  'Crusader':             {attr:'WIS',hd:10, sp:4, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[1,1,1,2,2,2,3,3,3,4],
    prereqs:[
      [{type:'sixLevel',axis:'divine',min:1}],
      [{type:'bab',min:3}],
      [{type:'skill',name:'Diplomacy',min:8}],
      [{type:'skill',name:'Knowledge (Religion)',min:8}],
      [{type:'skill',name:'Knowledge (Theology & Philosophy)',min:4}],
      [{type:'classLevel',name:'Saint',min:1},{type:'classLevel',name:'Paladin',min:1},{type:'note',text:'or other GM-approved spontaneous Domain casting'}],
    ], apB:'cha'},
  'Ecclesiarch':          {attr:'WIS',hd:8, sp:4, maxLvl:5,
    bab :[0,1,1,2,2],
    fort:[2,3,3,4,4],
    ref :[0,0,1,1,1],
    will:[2,3,3,4,4],
    def :[0,1,1,1,2],
    rep :[2,3,3,3,4],
    prereqs:[
      [{type:'sixLevel',axis:'divine',min:5}],
      [{type:'skill',name:'Knowledge (Religion)',min:15}],
      [{type:'powerAccess',pools:['divine'],lvl:7,desc:'Ability to cast 7th-level divine spells'}],
      [{type:'featCount',families:['Magic'],min:2,desc:'Any two Magic feats'}],
    ], apB:'cha'},
  'Eldritch Knight':      {attr:'STR/INT',hd:8, sp:4, maxLvl:10,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,2,2,3,3,4,4,5],
    rep :[0,0,1,1,1,1,2,2,2,2],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'bab',min:3}],
      [{type:'feat',name:'Martial Weapon Proficiency'}],
      [{type:'feat',name:'Still Spell'},{type:'feat',name:'Combat Casting'}],
      [{type:'powerAccess',pools:['arcane'],lvl:3,desc:'Ability to cast 3rd-level arcane spells'}],
    ], apB:'cha'},
  'Holy Knight':          {attr:'STR/WIS',hd:8, sp:4, maxLvl:10,
    bab :[1,2,3,4,5,6,7,8,9,10],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,2,2,3,3,4,4,5],
    rep :[0,0,1,1,1,1,2,2,2,2],
    prereqs:[
      [{type:'sixLevel',axis:'divine',min:1}],
      [{type:'bab',min:3}],
      [{type:'feat',name:'Martial Weapon Proficiency'}],
      [{type:'feat',name:'Still Spell'},{type:'feat',name:'Combat Casting'}],
      [{type:'powerAccess',pools:['divine'],lvl:3,desc:'Ability to cast 3rd-level divine spells'}],
    ], apB:'cha'},
  'Elementalist':         {attr:'WIS',hd:8, sp:4, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'sixLevelOr',options:[{axis:'mutation',min:5},{axis:'psionic',min:1}]}],
      [{type:'feat',name:'Supernatural Mutation'},{type:'feat',name:'Wild Talent'}],
    ], apB:'cha'},
  'Elocater':             {attr:'DEX',hd:6, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,2,2,3,3,4,4,5,5,6],
    rep :[0,0,1,1,1,1,2,2,2,2],
    prereqs:[
      [{type:'sixLevel',axis:'psionic',min:1}],
      [{type:'bab',min:3}],
      [{type:'skill',name:'Concentration',min:8}],
      [{type:'feat',name:'Mobility'}],
      [{type:'feat',name:'Spring Attack'}],
      [{type:'powerAccess',pools:['psionic'],lvl:1,desc:'Ability to manifest 1st-level psionic powers'}],
    ], apB:'cha'},
  'Guildmember (Magic)':  {attr:'INT/CHA',hd:4, sp:4, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,1,1,1,2,2,2,3,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:10}],
      [{type:'skill',name:'Knowledge (Civics)',min:5}],
      [{type:'powerAccess',pools:['arcane'],lvl:4,desc:'Access to 4th-level arcane spells'}],
      [{type:'knowsPower',name:'Sending',desc:'Knowledge of the Sending spell'}],
    ], apB:'cha'},
  'Guildmember (Psionic)':{attr:'INT/CHA',hd:4, sp:4, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,1,1,1,2,2,2,3,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'psionic',min:1}],
      [{type:'skill',name:'Knowledge (Psionics)',min:10}],
      [{type:'skill',name:'Knowledge (Civics)',min:5}],
      [{type:'powerAccess',pools:['psionic'],lvl:4,desc:'Access to 4th-level psionic powers'}],
      [{type:'knowsPower',name:'Correspond',desc:'Knowledge of the Correspond power'}],
    ], apB:'cha'},
  'Heavy':                {attr:'CON',hd:12, sp:2, maxLvl:5,
    bab :[1,2,3,4,5],
    fort:[2,3,3,4,4],
    ref :[0,0,1,1,1],
    will:[0,0,1,1,1],
    def :[0,1,1,2,2],
    rep :[0,0,0,1,1],
    prereqs:[
      [{type:'sixLevel',axis:'tech',min:6}],
      [{type:'attr',name:'CON',min:13}],
      [{type:'note',text:'Three or more cybernetic implants'}],
      [{type:'note',text:'One implant must be Heavy Subcutaneous Body Armor'}],
    ], apB:'cha'},
  'Loremaster':           {attr:'INT',hd:6, sp:6, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,1,2,2,2,3,3,3],
    rep :[0,0,1,1,1,1,2,2,2,2],
    prereqs:[
      // v8.70.1 (Adam's ruling, 2026-10-02): the Loremaster is the one class
      // qualifiable PURELY through super-powers (the 7-Clairsentience road),
      // so Mutation Scale 5 joins the scenario gate — "or Mutation Scale 5
      // scenario" (book edit queued on the TODO for the Word pass).
      // v8.73.0 (Adam's Compass report): the Scales gate reads as ONE line
      // ("…or Mutation 5+ or…" — a single trailing "scenario"); Mutation 5
      // is the v8.70.1 super-power-road ruling (Hellfire's road). And the
      // old "Knowledge (any) 10" group was a DUPLICATE of the GMG line —
      // "Knowledge (any two) 10 ranks each" (p.173) is the only gate.
      [{type:'sixLevelOr',options:[{axis:'arcane',min:1},{axis:'divine',min:1},{axis:'mutation',min:5},{axis:'psionic',min:1}]}],
      [{type:'skillFamilyCount',family:'Knowledge',min:10,count:2,desc:'two Knowledge skills at 10 ranks each'}],
      [{type:'featCount',families:['Magic','Power'],min:3,desc:'Any 3 Magic or Power feats'}],
      [{type:'featParamIs',name:'Skill Focus',paramPrefix:'Knowledge',desc:'Skill Focus (any Knowledge)'}],
      [{type:'powerRepertoire',schools:['Divination','Clairsentience'],count:7,desc:'7 different Divination spells or Clairsentience powers known'}],
      [{type:'powerRepertoire',schools:['Divination','Clairsentience'],minLvl:3,count:1,desc:'at least one of them 3rd-level or higher'}],
    // v9.15.2 (§275 F13): GMG p.174 prints Cha mod + ½ level.
    ], apB:'cha'},
  'Metamind':             {attr:'INT',hd:4, sp:4, maxLvl:5,
    bab :[0,1,1,2,2],
    fort:[0,0,1,1,1],
    ref :[0,0,1,1,1],
    will:[2,3,3,4,4],
    def :[0,1,1,1,2],
    rep :[2,3,3,3,4],
    prereqs:[
      [{type:'sixLevel',axis:'psionic',min:5}],
      [{type:'skill',name:'Knowledge (Psionics)',min:15}],
      [{type:'skill',name:'Psicraft',min:15}],
      [{type:'featParamIs',name:'Skill Focus',param:'Psicraft',desc:'Skill Focus (Psicraft)'}],
      [{type:'featCount',families:['Power'],min:2,desc:'Any two Power feats'}],
      [{type:'powerAccess',pools:['psionic'],lvl:7,desc:'Access to 7th-level psionic powers'}],
      [{type:'powerRepertoire',pool:'psionic',minLvl:4,distinctSchools:2,desc:'4th-level+ powers known from at least 2 different disciplines'}],
    ], apB:'cha'},
  // v9.15.2 (§275 F6): hd 6→4 — GMG p.187 prints "d4 (d2+2)".
  'Mystic Theurge':       {attr:'INT/WIS',hd:4, sp:4, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,1,2,2,2,3,3,3],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'sixLevel',axis:'divine',min:1}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:6}],
      [{type:'skill',name:'Knowledge (Religion)',min:6}],
      [{type:'featParamIs',name:'Skill Focus',param:'Spellcraft',desc:'Skill Focus (Spellcraft)'}],
      [{type:'powerAccess',pools:['arcane'],lvl:2,desc:'Able to cast 2nd-level arcane spells'}],
      [{type:'powerAccess',pools:['divine'],lvl:2,desc:'Able to cast 2nd-level divine spells'}],
    // v9.15.2 (§275 F13): GMG p.187 prints Cha mod + ½ level (the Psychic
    // Theurge entry already carried it).
    ], apB:'cha'},
  'Planestrider':         {attr:'WIS',hd:8, sp:4, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[2,3,3,4,4,5,5,6,6,7],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,1,1,1,2,2,3,3,3,4],
    prereqs:[
      [{type:'skill',name:'Knowledge (The Planes)',min:10},{type:'skill',name:'Knowledge (Nature)',min:10}],
      [{type:'skill',name:'Navigate',min:10}],
      [{type:'skill',name:'Survival',min:10}],
      [{type:'classAbility',name:'Terrain Mastery'},{type:'knowsPower',name:'Plane Shift',desc:'ability to cast/manifest Plane Shift'}],
    ], apB:'cha'},
  // v9.15.2 (§275 F6): hd 6→4 — the Theurge variants share GMG p.187's "d4 (d2+2)".
  'Psychic Theurge':      {attr:'INT/WIS',hd:4, sp:4, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,1,2,2,2,3,3,3],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'sixLevel',axis:'psionic',min:1}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:6}],
      [{type:'skill',name:'Knowledge (Psionics)',min:6}],
      [{type:'featParamIs',name:'Skill Focus',param:'Spellcraft',desc:'Skill Focus (Spellcraft)'}],
      [{type:'powerAccess',pools:['arcane'],lvl:2,desc:'Able to cast 2nd-level arcane spells'}],
      [{type:'powerAccess',pools:['psionic'],lvl:2,desc:'Able to manifest 2nd-level psionic powers'}],
    ], apB:'cha'},
  'Psychic Trickster':    {attr:'INT',hd:6, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[0,0,1,1,1,2,2,2,3,3],
    ref :[2,3,3,4,4,5,5,6,6,7],
    will:[2,3,3,4,4,5,5,6,6,7],
    // v9.15.2 (§275 F9): DB corrected to the printed ladder (GMG p.188) —
    // the Trickster variants share the table.
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,0,1,1,1,2,2,2,3,3],
    prereqs:[
      [{type:'sixLevel',axis:'psionic',min:1}],
      [{type:'allegiance',value:'Law',polarity:'lacks'}],
      [{type:'skill',name:'Decipher Code',min:7}],
      [{type:'skill',name:'Disable Device',min:7}],
      [{type:'skill',name:'Escape Artist',min:7}],
      [{type:'skill',name:'Knowledge (Psionics)',min:4}],
      [{type:'classAbility',name:'Far Hand'}],
      [{type:'powerAccess',pools:['psionic','super'],lvl:3,desc:'Able to manifest 3rd-level powers'}],
      [{type:'classAbility',name:'Sneak Attack +1d6'}],
    ], apB:'cha'},
  'Shadowjack':           {attr:'INT',hd:6, sp:8, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[1,1,1,2,2,2,3,3,3,4],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'sixLevel',axis:'tech',min:5}],
      [{type:'skill',name:'Computer Use',min:6}],
      [{type:'skill',name:'Craft (Electronics)',min:6}],
      [{type:'skill',name:'Decipher Code',min:6}],
      [{type:'skill',name:'Disable Device',min:6}],
    ], apB:6},
  'Soulstalker':          {attr:'WIS',hd:8, sp:6, maxLvl:10,
    bab :[0,1,2,3,3,4,5,6,6,7],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[1,2,2,2,3,3,4,4,4,5],
    will:[1,2,2,2,3,3,4,4,4,5],
    def :[1,1,2,2,3,3,4,4,5,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'sixLevelOr',options:[{axis:'psionic',min:1},{axis:'mutation',min:5}]}],
      [{type:'bab',min:3}],
      [{type:'skill',name:'Survival',min:8}],
      [{type:'classAbility',name:'Scent of the Quarry'},{type:'knowsPower',name:'Scent of the Quarry',desc:'the Scent of the Quarry power'}],
      [{type:'feat',name:'Track'},{type:'feat',name:'Urban Tracking'}],
    ], apB:'cha'},
  'Splice':               {attr:'CON',hd:10, sp:4, maxLvl:5,
    bab :[0,1,2,3,3],
    fort:[2,3,3,4,4],
    ref :[2,3,3,4,4],
    will:[0,0,1,1,1],
    def :[1,1,2,2,3],
    rep :[0,0,0,1,1],
    prereqs:[
      [{type:'sixLevel',axis:'tech',min:6}],
      [{type:'sixLevel',axis:'mutation',min:1}],
      [{type:'attr',name:'CON',min:13}],
      [{type:'note',text:'Survived at least one cycle of gene therapy (1st level class description)'}],
      [{type:'mpTotal',min:1,desc:'has Mutation Points (from gene therapy)'}],
    ], apB:'cha'},
  'Super-Hero':           {attr:'STR/CON',hd:10, sp:4, maxLvl:5,
    bab :[1,2,3,4,5],
    fort:[1,2,2,2,3],
    ref :[1,2,2,2,3],
    will:[1,2,2,2,3],
    def :[1,2,2,3,3],
    rep :[1,2,2,2,3],
    prereqs:[
      [{type:'sixLevel',axis:'heroic',min:1}],
      [{type:'sixLevel',axis:'mutation',min:5}],
      [{type:'tierLevel',tier:'hero',min:1}],
      [{type:'feat',name:'Supernatural Mutation'}],
      [{type:'mpTotal',min:20,desc:'20 or more Mutation Points'}],
      [{type:'allegiance',value:'Good',polarity:'has'}],
    ], apB:7},
  'Super-Villain':        {attr:'STR/CON',hd:10, sp:4, maxLvl:5,
    bab :[1,2,3,4,5],
    fort:[1,2,2,2,3],
    ref :[1,2,2,2,3],
    will:[1,2,2,2,3],
    def :[1,2,2,3,3],
    rep :[1,2,2,2,3],
    prereqs:[
      [{type:'sixLevel',axis:'heroic',min:1}],
      [{type:'sixLevel',axis:'mutation',min:5}],
      [{type:'tierLevel',tier:'hero',min:1}],
      [{type:'feat',name:'Supernatural Mutation'}],
      [{type:'mpTotal',min:20,desc:'20 or more Mutation Points'}],
      [{type:'allegiance',value:'Evil',polarity:'has'}],
    ], apB:7},
  // v9.15.2 (§275 F6): hd 4→6 — GMG p.185 prints "d6 (d3+3)".
  'Technomage':           {attr:'INT',hd:6, sp:6, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,2,2,3,3,4,4,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'sixLevel',axis:'arcane',min:1}],
      [{type:'sixLevel',axis:'tech',min:5}],
      [{type:'skill',name:'Computer Use',min:6}],
      [{type:'skill',name:'Craft (Electronics)',min:6}],
      [{type:'skill',name:'Knowledge (Arcane Lore)',min:6}],
      [{type:'skill',name:'Knowledge (Technology)',min:6}],
      [{type:'skill',name:'Repair',min:6}],
      [{type:'feat',name:'Gearhead'}],
    ], apB:6},
  'Technopath':           {attr:'INT',hd:4, sp:6, maxLvl:10,
    bab :[0,1,1,2,2,3,3,4,4,5],
    fort:[1,2,2,2,3,3,4,4,4,5],
    ref :[0,0,1,1,1,2,2,2,3,3],
    will:[2,3,3,4,4,5,5,6,6,7],
    def :[0,1,1,2,2,3,3,4,4,5],
    rep :[0,0,0,1,1,1,2,2,2,3],
    prereqs:[
      [{type:'sixLevel',axis:'psionic',min:1}],
      [{type:'sixLevel',axis:'tech',min:5}],
      [{type:'skill',name:'Computer Use',min:6}],
      [{type:'skill',name:'Craft (Electronics)',min:6}],
      [{type:'skill',name:'Knowledge (Psionics)',min:6}],
      [{type:'skill',name:'Knowledge (Technology)',min:6}],
      [{type:'skill',name:'Repair',min:6}],
      [{type:'feat',name:'Gearhead'}],
    ], apB:6},
};
// Look up a class by name across all four tiers
function getClassData(name) {
  return HERO_CLASSES[name] || ORDINARY_CLASSES[name] || BASIC_CLASSES[name] || ADVANCED_CLASSES[name] || PRESTIGE_CLASSES[name] || MONSTROUS_CLASSES[name] || null;
}
// Check whether a character meets the prerequisites for a given Advanced or Prestige class.
// Returns {met: bool, missing: [string]} listing each unmet requirement-group.
// `existingClasses` is an array of {tier, name, level} entries representing classes already taken.
// `charCtx` is an optional object {attrs, allegiance, align} for attribute / allegiance checks.
// `sixLevels` is an object like {arcane:5, divine:5, heroic:1, mutation:0, psionic:0, tech:5}.
//
// v8.3.23: Function now handles Hero and Basic class lookups too (previously
// limited to Advanced/Prestige). The Hero/Basic attribute prerequisite — Hero
// classes need 13 in their key attribute, certain Basic classes (Cleric,
// Paladin, Saint, Psion, Wizard, Sorcerer, Wilder) need 10 — comes from
// data-table `attrMin` and `attr` fields. The `attr` field may be a single
// code like 'STR' or slash-separated alternatives like 'INT/CHA' (Aristocrat
// has Int/Cha as joint key attributes; for the *prereq* check we use OR
// semantics — meet either is sufficient).
function checkClassPrereqsFromArray(className, existingClasses, charSkills, charFeats, sixLevels, charCtx) {
  // v8.3.23: look across all four tiers; Hero/Basic may carry `attrMin`.
  const cls = HERO_CLASSES[className] || BASIC_CLASSES[className] || ADVANCED_CLASSES[className] || PRESTIGE_CLASSES[className];
  if (!cls) return {met:true, missing:[], report:[]};
  const missing = [];
  // v8.39.0 (Career Compass): alongside the flat `missing` strings, collect a
  // STRUCTURED report — one entry per prereq group, each option carrying its
  // desc, verdict, and the raw opt object. The Compass renders from this so
  // its checklist can never disagree with the add-class/level-up gates: same
  // function, same evaluation, one source of truth.
  const report = [];
  const stats = computeStatsFromClasses(existingClasses || []);
  charSkills = charSkills || {};
  charFeats = (charFeats || []).map(f => typeof f === 'string' ? f : (f.name || f.n));  // v8.5.4: robust to {name}-form records
  // v8.6.1: class-entry proficiency grants count toward feat prereqs (a
  // Fighter candidate for Soldier HAS Martial Weapon Proficiency — it came
  // with the class, not as a c.feats record). Derived, never stored.
  charFeats = charFeats.concat(proficiencyPseudoFeats(charProficiencyGrants((charCtx || {}).char || null, existingClasses)));
  sixLevels = sixLevels || {arcane:0, divine:0, heroic:0, mutation:0, psionic:0, tech:0};
  charCtx = charCtx || {};
  const attrs = charCtx.attrs || [10,10,10,10,10,10];
  const ATTR_IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  // v8.3.24: attrMin check up front. The class declares `attrMin` (the
  // numeric threshold) and `attrMinKey` (the single attribute code STR/DEX/
  // CON/INT/WIS/CHA the check targets). attrMinKey is the canonical prereq
  // target; the legacy `attr` field still serves as build-guidance (and may
  // be slash-separated like "INT/CHA" for joint-key class flavor) but is not
  // mechanically consulted for the prereq. For back-compat with any class
  // entries that lack attrMinKey, we fall back to `attr` and use the FIRST
  // token (in case it was a slash-separated string).
  if (typeof cls.attrMin === 'number') {
    const code = cls.attrMinKey || (cls.attr ? cls.attr.split('/')[0].trim() : null);
    if (code) {
      const idx = ATTR_IDX[code];
      if (idx !== undefined) {
        const attrOk = (attrs[idx] || 0) >= cls.attrMin;
        // v8.39.0: attrMin enters the report as a synthetic one-option group.
        report.push({met: attrOk, options: [{desc: `${code} ${cls.attrMin}+`, met: attrOk,
          opt: {type: 'attr', name: code, min: cls.attrMin}}]});
        if (!attrOk) missing.push(`${code} ${cls.attrMin}+`);
      }
    }
  }
  // If the class has no structured `prereqs` array (most Hero/Basic), the
  // attrMin check above is the only thing to evaluate. Return early.
  if (!cls.prereqs) {
    return {met: missing.length === 0, missing, report};
  }
  const hasClassAbility = (abilityName) => {
    const grants = CLASS_ABILITIES[abilityName];
    if (!grants) return false;
    return grants.some(g => (existingClasses||[]).some(e =>
      e.tier === g.tier && e.name === g.name && (e.level||0) >= g.minLvl));
  };
  const tierLevels = (tier) => (existingClasses||[]).reduce((s,e) => s + (e.tier===tier ? (e.level||0) : 0), 0);
  // v8.5.4 EAL sweep, class layer: helpers for the structured power-access /
  // repertoire / feat-detail checks that replaced the old GM-verify notes.
  // Pool power access derives from the classes+feat-names already passed in;
  // repertoire, feat-param, and MP checks need the saved character
  // (charCtx.char — threaded at the saved-character call sites). During
  // creation-form checks char is absent and those evaluate unmet, which is
  // honest: a fresh character has no repertoire, and Advanced/Prestige entry
  // happens at level-up anyway.
  const _fullChar = charCtx.char || null;
  let _psCache = null;
  const poolStats = () => _psCache || (_psCache = computeCasterStats({
    classes: existingClasses || [],
    feats: charFeats,
    totalLvl: (existingClasses || []).reduce((s, e) => s + (e.level || 0), 0),
  }));
  // Super-manifester "power access": the mutant tier's spell-level cap
  // (Minor 3 / Moderate 5 / Major 9, MUTATION_RULES).
  const superAccessLvl = () => {
    if (!_fullChar) return 0;
    const st = getMPState(_fullChar);
    return (st.isSuperMutant && st.tier && st.tier.spell_levels) ? st.tier.spell_levels[1] : 0;
  };
  const charPowers = () => ((_fullChar && _fullChar.powers) || []);
  const charFeatObjs = () => ((_fullChar && _fullChar.feats) || []).filter(f => typeof f === 'object');
  for (const group of cls.prereqs) {
    let groupMet = false;
    const groupDescs = [];
    const groupOpts = [];  // v8.39.0: per-option report rows
    for (const opt of group) {
      let optDesc = '';
      let optMet = false;
      if (opt.type === 'bab') {
        optDesc = `Base Attack +${opt.min}`;
        optMet = stats.bab >= opt.min;
      } else if (opt.type === 'def') {
        optDesc = `Defense Bonus +${opt.min}`;
        optMet = stats.def >= opt.min;
      } else if (opt.type === 'skill') {
        optDesc = `${opt.name} ${opt.min} ranks`;
        optMet = (charSkills[opt.name] || 0) >= opt.min;
      } else if (opt.type === 'skillFamily') {
        optDesc = `${opt.family} (any) ${opt.min} ranks`;
        optMet = SKILLS.some(sk => sk.family === opt.family && (charSkills[sk.n] || 0) >= opt.min);
      } else if (opt.type === 'feat') {
        optDesc = opt.desc || `feat: ${opt.name}`;  // v8.71.0: honor authored desc (book restrictions the check can't enforce)
        optMet = charFeats.some(fn => fn.toLowerCase().startsWith(opt.name.toLowerCase()));
      } else if (opt.type === 'attr') {
        optDesc = `${opt.name} ${opt.min}+`;
        const idx = ATTR_IDX[opt.name];
        optMet = idx !== undefined && (attrs[idx]||0) >= opt.min;
      } else if (opt.type === 'attrAny') {
        optDesc = `any one attribute ${opt.min}+`;
        optMet = attrs.some(a => (a||0) >= opt.min);
      } else if (opt.type === 'classAbility') {
        optDesc = `class ability: ${opt.name}`;
        optMet = hasClassAbility(opt.name);
        // v8.71.0 (Survivor's "Evasion talent / class ability"): Evasion's
        // real granting map is the unified evasionTier (class features +
        // the Rogue SA pick + Fast Hero talents, v8.64.0) — CLASS_ABILITIES
        // never listed it. Consult the unified source when a saved
        // character threads through.
        if (!optMet && opt.name === 'Evasion' && _fullChar) {
          optMet = !!evasionTier(_fullChar);
        }
      } else if (opt.type === 'tierLevel') {
        const tierLabel = {hero:'Hero',ordinary:'Ordinary',basic:'Basic',advanced:'Advanced',prestige:'Prestige'}[opt.tier]||opt.tier;
        optDesc = `${opt.min}+ level${opt.min===1?'':'s'} in any ${tierLabel} class`;
        optMet = tierLevels(opt.tier) >= opt.min;
      } else if (opt.type === 'allegiance') {
        // v8.3.34: LOOSE semantics — accepts a match on EITHER allegiance OR
        // alignment field, because alignment ESTABLISHES allegiance on its
        // non-neutral axes (a Lawful Neutral character HAS an Allegiance to
        // Law as a structural consequence of their alignment). See the
        // detailed comment in checkFeatPrereqs for the full rule and the
        // alignment-vs-allegiance asymmetry.
        const cmp = (charCtx.allegiance||'') + ' / ' + (charCtx.align||'');
        const has = cmp.toLowerCase().includes(opt.value.toLowerCase());
        if (opt.polarity === 'lacks') {
          optDesc = `no allegiance to ${opt.value}`;
          optMet = !has;
        } else {
          optDesc = `allegiance to ${opt.value}`;
          optMet = has;
        }
      } else if (opt.type === 'alignment') {
        // v8.3.34: STRICT semantics — checks the alignment field ONLY.
        // Allegiance does NOT establish alignment (a character with
        // Allegiance to Good can be Lawful/Chaotic/True Neutral aligned).
        // Use this when the handbook says "X alignment" (Chaotic Mind's
        // "Chaotic alignment"); use `allegiance` when the handbook says
        // "X allegiance" (Assassin's "Evil allegiance"). The asymmetry is
        // load-bearing — see the full comment block in checkFeatPrereqs.
        const cmp = (charCtx.align||'').toLowerCase();
        const has = cmp.includes(opt.value.toLowerCase());
        if (opt.polarity === 'lacks') {
          optDesc = `no ${opt.value} alignment`;
          optMet = !has;
        } else {
          optDesc = `${opt.value} alignment`;
          optMet = has;
        }
      } else if (opt.type === 'sixLevel') {
        optDesc = `${SIX_LEVELS[opt.axis]?.short || opt.axis} ${opt.min}+ scenario`;
        optMet = (sixLevels[opt.axis] || 0) >= opt.min;
      } else if (opt.type === 'sixLevelAny') {
        const labels = opt.axes.map(a => `${SIX_LEVELS[a]?.short || a} ${opt.min}+`);
        optDesc = labels.join(' or ') + ' scenario';
        optMet = opt.axes.some(a => (sixLevels[a] || 0) >= opt.min);
      } else if (opt.type === 'sixLevelOr') {
        const labels = opt.options.map(o => `${SIX_LEVELS[o.axis]?.short || o.axis} ${o.min}+`);
        optDesc = labels.join(' or ') + ' scenario';
        optMet = opt.options.some(o => (sixLevels[o.axis] || 0) >= o.min);
      } else if (opt.type === 'talent') {
        // v8.71.0 (Adam's Hellfire/Compass report — "FEAT: Savant"): this
        // was a never-satisfiable GM-verify stub, and six classes dodged it
        // by mistyping their talent prereqs as feats (equally unsatisfiable
        // — c.feats never contains a talent). Now a real check against the
        // saved record's talents: by name (+ exact param / paramPrefixes
        // when given), by name prefix (the Damage Reduction 1/-..3/-
        // ladder), by tree, or by hero class ("any Tough Hero talent").
        // Degrades to GM-verify when no character threads through ctx.char
        // (the creation form — talents can't exist there anyway).
        const tl = _fullChar ? (_fullChar.talents || []) : null;
        const tdOf = (nm) => TALENTS_DB.find(x => x.n === nm);
        let tMatch = () => false;
        if (opt.name || opt.namePrefix) {
          optDesc = opt.desc || `${opt.name || opt.namePrefix}${opt.param ? ` (${opt.param})` : ''} talent`;
          tMatch = (t) => (opt.name ? t.name === opt.name : (t.name || '').startsWith(opt.namePrefix))
            && (!opt.param || t.param === opt.param)
            && (!opt.paramPrefixes || opt.paramPrefixes.some(p => (t.param || '').startsWith(p)));
        } else if (opt.heroClass) {
          optDesc = opt.desc || `any ${opt.heroClass} talent`;
          tMatch = (t) => { const td = tdOf(t.name); return !!(td && td.hero_class === opt.heroClass); };
        } else if (opt.tree) {
          optDesc = opt.desc || `a talent from the ${opt.tree} tree`;
          tMatch = (t) => { const td = tdOf(t.name); return !!(td && td.tree && (td.tree === opt.tree || td.tree.startsWith(opt.tree + ' '))); };
        }
        if (tl) { optMet = tl.some(tMatch); }
        else { optDesc += ' (GM-verify)'; optMet = false; }
      } else if (opt.type === 'powerAccess') {
        // "Able to cast/manifest Nth-level spells/powers" — met when a listed
        // pool's max castable power level (derived from EAL/EDL/EPL; super
        // via the mutant tier cap) reaches opt.lvl. pools: array or 'any'.
        const pools = opt.pools === 'any' ? ['arcane', 'divine', 'psionic', 'super'] : opt.pools;
        optDesc = opt.desc || `able to cast/manifest ${opt.lvl}th-level ${pools.join('/')} spells/powers`;
        optMet = pools.some(p => p === 'super'
          ? superAccessLvl() >= opt.lvl
          : ((poolStats()[p] || {}).maxPowerLvl || 0) >= opt.lvl);
      } else if (opt.type === 'knowsPower') {
        // Named spell/power in the character's repertoire (variant display
        // names resolve to their parent entry).
        optDesc = opt.desc || `knows ${opt.name}`;
        const vn = (VARIANT_NAMES[opt.name]);
        optMet = charPowers().some(p => p.name === opt.name || p.applies === opt.name || (vn && p.name === vn.parent));
      } else if (opt.type === 'powerRepertoire') {
        // Repertoire-shape check: {count?, minLvl?, schools? (school_raw
        // prefixes), distinctSchools?, pool?} against known spells/powers.
        // v8.94.1 (the Tower probe's conviction): dual-listed entries print
        // "Metacreativity / Conjuration (Creation)" — the first-token parse
        // counted the PSIONIC DISCIPLINE as a fifth arcane school. The
        // school is read pool-aware now (schoolForPool).
        const lvlOf = (s) => (s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : 0;
        let recs = charPowers()
          .filter(p => !opt.pool || p.pool === opt.pool)
          .map(p => SPELLS_DB.find(x => x.name === p.name)).filter(Boolean);
        if (opt.minLvl) recs = recs.filter(s => lvlOf(s) >= opt.minLvl);
        if (opt.schools) recs = recs.filter(s => opt.schools.some(sc => (s.school_raw || '').startsWith(sc) || schoolForPool(s.school_raw, opt.pool) === sc));
        optDesc = opt.desc || 'repertoire requirement';
        if (opt.distinctSchools) {
          optMet = new Set(recs.map(s => schoolForPool(s.school_raw, opt.pool))).size >= opt.distinctSchools;
        } else {
          optMet = new Set(recs.map(s => s.name)).size >= (opt.count || 1);
        }
      } else if (opt.type === 'featCount') {
        // N or more owned feats from the listed families.
        const n = charFeats.filter(fn => { const fd = getFeatData(fn); return fd && opt.families.includes(fd.family); }).length;
        optDesc = opt.desc || `${opt.min}+ ${opt.families.join(' or ')} feat${opt.min === 1 ? '' : 's'}`;
        optMet = n >= opt.min;
      } else if (opt.type === 'featParamIs') {
        // Named feat taken with a specific parameter (exact or prefix match).
        // Falls back to name-only ownership when no saved character is in
        // context (creation-form checks can't see params).
        optDesc = opt.desc || `${opt.name} (${opt.param || opt.paramPrefix})`;
        const objs = charFeatObjs().filter(f => (f.name || f.n) === opt.name);
        optMet = _fullChar
          ? objs.some(f => opt.param ? f.param === opt.param : ((f.param || '').startsWith(opt.paramPrefix || '')))
          : charFeats.includes(opt.name);
      } else if (opt.type === 'featParamCount') {
        // Named feat taken with at least N DIFFERENT parameters.
        const params = new Set(charFeatObjs().filter(f => (f.name || f.n) === opt.name && f.param).map(f => f.param));
        optDesc = opt.desc || `${opt.name} in ${opt.min} different choices`;
        optMet = params.size >= opt.min;
      } else if (opt.type === 'skillFamilyCount') {
        // At least `count` skills of the family at `min`+ ranks each.
        const n = SKILLS.filter(sk => sk.family === opt.family && (charSkills[sk.n] || 0) >= opt.min).length;
        optDesc = opt.desc || `${opt.count} ${opt.family} skills at ${opt.min}+ ranks each`;
        optMet = n >= opt.count;
      } else if (opt.type === 'mpTotal') {
        optDesc = opt.desc || `${opt.min}+ Mutation Points`;
        optMet = !!_fullChar && getMPState(_fullChar).totalEarned >= opt.min;
      } else if (opt.type === 'classLevel') {
        // Mirrors the feat engine's handler (needed class-side since v8.5.4
        // for Crusader's spontaneous-Domain check).
        optDesc = `${opt.name || opt.tier} Lvl ${opt.min}+`;
        optMet = (existingClasses || []).some(e =>
          (!opt.tier || e.tier === opt.tier) &&
          (!opt.name || e.name === opt.name) &&
          (e.level || 0) >= (opt.min || 1));
      } else if (opt.type === 'note') {
        optDesc = opt.text + ' (GM-verify)';
        optMet = false;
      }
      groupDescs.push(optDesc);
      groupOpts.push({desc: optDesc, met: optMet, opt});
      // v8.39.0: no early break — ALL options are evaluated so the Compass
      // report shows every alternative's standing (met groups previously
      // short-circuited; `missing` semantics are unchanged, since it was only
      // ever built from groups where NO option met — those never broke early).
      if (optMet) groupMet = true;
    }
    report.push({met: groupMet, options: groupOpts});
    if (!groupMet) missing.push(groupDescs.join(' OR '));
  }
  return {met: missing.length === 0, missing, report};
}
// Legacy wrapper — translates the old (className, hc, hl, bc, bl, ac, al, charSkills, charFeats, sixLevels)
// signature into a class array and delegates.
// Backwards-compat alias used by older code paths
function checkClassPrereqs(className, heroClass, heroLvl, basicClass, basicLvl, advClass, advLvl, charSkills, charFeats, sixLevels) {
  const arr = [];
  if (heroClass && heroLvl > 0) arr.push({tier:'hero', name:heroClass, level:heroLvl});
  if (basicClass && basicLvl > 0) arr.push({tier:'basic', name:basicClass, level:basicLvl});
  if (advClass && advLvl > 0) arr.push({tier:'advanced', name:advClass, level:advLvl});
  return checkClassPrereqsFromArray(className, arr, charSkills, charFeats, sixLevels);
}
function checkAdvancedPrereqs(advName, heroClass, heroLvl, basicClass, basicLvl, charSkills, charFeats, sixLevels) {
  return checkClassPrereqs(advName, heroClass, heroLvl, basicClass, basicLvl, '', 0, charSkills, charFeats, sixLevels);
}

