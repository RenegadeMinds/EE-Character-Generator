// =============================================================================
// js/data/skills.js
// SKILLS — GAME TABLES
// =============================================================================
//
// WHAT'S IN HERE
//   Game tables: plain data, no logic. The skill list, skill descriptions,
//   synergies, class skill lists and skill-name aliases.
//
// KEY NAMES (so you can search for them)
//   tables and state: SKILL_DESCS, SKILLS, TOOLKIT_DEPENDENT_SKILLS,
//   INSTRUMENT_PERFORMS, SYNERGIES_DB, HC_SKILLS, CLASS_SKILLS,
//   SKILL_NAME_ALIASES, SKILL_SUB_ALIASES, COLLAPSIBLE_FAMILIES
//
// WHERE IT CAME FROM
//   Gathered from js/app/50-skills-page.js, js/rules/10-minds-ledger-and-
//   magic-browser.js, js/rules/23-hit-points-xp-skills.js,
//   js/rules/24-synergies-class-skills-citations.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Loaded after js/core/ and the catalogs in js/data/catalogs/, before any
//   logic. Any code here that runs while the page loads (a few table fix-
//   ups) only uses tables loaded before it; battery/_check_load_order.mjs
//   checks that.
// =============================================================================

// v8.90.0 (Adam: "the same courtesy skills-wise" — GMF parity): HH Skill
// Descriptions (pp.150+) as hover dossiers on the Skills tab. One entry per
// BOOK skill (48 — the HH's "Heal" is a pointer stub to Treat Injury);
// parametrized families (Craft/Knowledge/Perform/Profession) share their
// base entry. Keyed by book heading; the lookup aliases the internal
// 'Decipher Code' key, so the v8.24.0 Tech-Scale display nuance rides free.
const SKILL_DESCS = {
  "Appraise": {q:"Int; Tech 1", d:"You have an eye for the value of objects on the open market.\nCheck: You can appraise common or well-known objects with a DC 12 Appraise check. Failure means that you estimate the value at 50% to 150% (2d6+3 times 10%,) of its actual value. Appraising a rare or exotic item requires a successful check against DC 15, 20, or higher. If the check is successful, you estimate the value correctly; failure means you cannot estimate the item’s value. You also use Appraise to try and find a better Sale Price for an item; make an Appraise check against the Purchase DC of the item, and if your result is equal to or greater than the Purchase DC, you get to…"},
  "Autohypnosis": {q:"Wis; Trained Only, Psionic 1", d:"Mental self-mastery enables you to perform rare feats of the mind.\nCheck: The DC and the effect of a successful check depend on the task you attempt. Ignore Caltrop Wound: If you are wounded by stepping on a caltrop, your speed is reduced to one-half normal. A successful Autohypnosis check removes this movement penalty. The wound doesn’t go away—it is just ignored through self-persuasion. Similar examples of pain causing a penalty may be applicable, GM’s adjudication. Memorize: You can attempt to memorize a long string of numbers, a long passage of verse, or some other particularly difficult piece of information (but you can’t memorize magica…"},
  "Balance": {q:"Dex; Armor Check Penalty", d:"You have trained in the art of fine balance, able to traverse narrow paths.\nCheck: You can walk on a precarious surface. A successful check lets you move at half your speed along the surface for 1 round. A failure by 4 or less means you can’t move for 1 round. A failure by 5+ means you fall. The difficulty varies with the surface, as follows: Narrow Surface Balance DC1 Difficult Surface Balance DC1 7–12 inches wide 10 Uneven flagstone 102 2–6 inches wide 15 Hewn stone floor 102 Less than 2 inches wide 20 Sloped or angled floor 102 1 Add modifiers from Narrow Surface Modifiers, below, as appropriate. 2 Only if running or charging. Failure by 4…"},
  "Bluff": {q:"Cha", d:"By a variety of means verbal and non-verbal, you can trick people into thinking what you want them to, at least for the moment.\nCheck: A Bluff check is opposed by the target’s Sense Motive check. See the accompanying table for examples of different kinds of bluffs and the modifier to the target’s Sense Motive check for each one. Favorable and unfavorable circumstances weigh heavily on the outcome of a bluff. Two circumstances can weigh against you: The bluff is hard to believe, or the action that the target is asked to take goes against its self- interest, nature, personality, orders, or the like. If it’s important, you can distinguish betwee…"},
  "Climb": {q:"Str; Armor Check Penalty", d:"You know how to travel vertical surfaces easier than others.\nCheck: With a successful Climb check, you can advance up, down, or across a slope, a wall, or some other steep incline (or even a ceiling with handholds) at one-quarter your normal speed. A slope is considered to be any incline at an angle measuring less than 60 degrees; a wall is any incline at an angle measuring 60 degrees or more. A Climb check that fails by 4 or less means that you make no progress, and one that fails by 5+ means that you fall from whatever height you have already attained. A climber’s kit gives you a +2 circumstance bonus on Climb checks. The DC of the check de…"},
  "Computer Use": {q:"Int; Tech 5", d:"You have expertise in using computers, both hardware and software.\nCheck: Most normal computer operations don’t require a Computer Use check (though a character might have to make a Research check; see the Research skill description). However, searching an unfamiliar network for a particular file, writing computer programs, altering existing programs to perform differently (better or worse), and breaking through computer security are all relatively difficult and require skill checks. Find File: This skill can be used for finding files or data on an unfamiliar system. The DC for the check and the time required are determined by the size of the…"},
  "Concentration": {q:"Con", d:"You have trained yourself in maintaining focus when circumstances are harrowing.\nCheck: You must make a Concentration check whenever you might potentially be distracted (by taking damage, by harsh weather, and so on) while engaged in some action that requires your full attention. Such actions include casting a spell or manifesting a power, concentrating on an active spell or power, directing a spell or power, using a spell-like or psi-like ability, or using a skill that would provoke an attack of opportunity. In general, if an action wouldn’t normally provoke an attack of opportunity, you need not make a Concentration check to avoid being dis…"},
  "Craft": {q:"Int; Tech 0+", d:"You have training in the crafting of a specific item type. This skill encompasses several categories, each of them treated as a separate skill (“TS” = Tech Scale): Craft (armorsmithing, TS 1), Craft (Bowmaking, TS 1), Craft (chemical, TS 1), Craft (electronics, TS 5), Craft (mechanical, TS 0 [simple only]), Craft (pharmaceutical, TS 3), Craft (structural, TS 0 [simple only]), Craft (trapmaking, TS 1), Craft (weaponsmithing, TS 1), Craft (visual arts, TS 0), and Craft (writing, TS 1). Craft skills are specifically focused on creating objects. To use a Craft skill effectively, a character must have a kit or some other set of basic tools. The pu…"},
  "Decipher Script": {q:"Int; Trained Only, Tech 1", d:"The character is educated in symbology, codebreaking, and/or cryptography.\nCheck: A character can decipher writing in an ancient language or in computer code, or interpret the meaning of an incomplete text. The base DC is 20 for the simplest messages, 25 for standard codes, and 30 or higher for intricate or complex codes or exotic messages. Helpful texts or computer programs can provide a bonus (usually a +2 circumstance bonus) on the check, provided they are applicable to the script in question. If the check succeeds, the character understands the general content of a piece of writing, reading about one page of text or its equivalent in 1 mi…"},
  "Demolitions": {q:"Int; Trained Only, Tech 3", d:"You are trained in the deployment and defusing of placed explosives.\nCheck: Setting a simple explosive to blow up at a certain spot doesn’t require a check, but connecting and setting a detonator does. Also, placing an explosive for maximum effect against a structure calls for a check, as does disarming an explosive device. Set Detonator: Most explosives require a detonator to go off. Connecting a detonator to an explosive requires a Demolitions check (DC 10). Failure means that the explosive fails to go off as planned. Failure by 10 or more means the explosive goes off as the detonator is being installed. A character can make an explosive di…"},
  "Diplomacy": {q:"Cha", d:"You are skilled in the art of engaging other beings tactfully.\nCheck: You can change the attitudes of others (nonplayer characters) with a successful Diplomacy check; see the Influencing NPC Attitudes sidebar, below, for basic DCs. In negotiations, participants roll opposed Diplomacy checks, and the winner gains the advantage. Opposed checks also resolve situations when two advocates or diplomats plead opposite cases in a hearing before a third party. A character can take 10 when making a Diplomacy check, but they can’t take 20."},
  "Disable Device": {q:"Int; Trained Only, Tech 1", d:"The character is trained in the disassembling of devices like locks and security systems.\nCheck: The Disable Device check is made secretly, so that you don’t necessarily know whether you’ve succeeded. The DC depends on how tricky the device is. Disabling (or rigging or jamming) a fairly simple device has a DC of 10; more intricate and complex devices have higher DCs. If the check succeeds, you disable the device. If it fails by 4 or less, you have failed but can try again. If you fail by 5+, something goes wrong. If the device is a trap, you spring it. If you’re attempting some sort of sabotage, you think the device is disabled, but it still …"},
  "Disguise": {q:"Cha", d:"You are trained in changing your appearance through the use of props and posture.\nCheck: Your Disguise check result determines how good the disguise is, and it is opposed by others’ Spot check results. If you don’t draw any attention to yourself, others do not get to make Spot checks. If you come to the attention of people who are suspicious (such as a guard who is watching commoners walking through a city gate), it can be assumed that such observers are taking 10 on their Spot checks. You get only one Disguise check per use of the skill, even if several people are making Spot checks against it. The Disguise check is made secretly, so that yo…"},
  "Drive": {q:"Dex; Tech 3", d:"The character knows how to control ground-based four-wheeled vehicles.\nCheck: Routine tasks, such as ordinary driving, don’t require a skill check. Make a check only when some unusual circumstance exists (such as inclement weather or an icy surface), or when the character is driving during a dramatic situation (the character is being chased or attacked, for example, or is trying to reach a destination in a limited amount of time). When driving, the character can attempt simple maneuvers or stunts. See Driving a Vehicle for more details."},
  "Escape Artist": {q:"Dex; Armor Check Penalty", d:"The character trains in being flexible and limber.\nCheck: The table below gives the DCs to escape various forms of restraints. Ropes: Your Escape Artist check is opposed by the binder’s Use Rope check. Since it’s easier to tie someone up than to escape from being tied up, the binder gets a +10 bonus on their check. Manacles, Handcuffs, and Masterwork Manacles: The DC for manacles is set by their construction. Tight Space: The DC noted on the table is for getting through a space where your head fits but your shoulders don’t. If the space is long you may need to make multiple checks. You can’t get through a space that your head does not fit thr…"},
  "Forgery": {q:"Int; Tech 1", d:"You know how to fabricate convincing documentation.\nCheck: Forgery requires materials appropriate to the document being forged, and some time. To forge a document the character needs to have seen a similar document before. The complexity of the document, the character’s degree of familiarity with it, and whether the character needs to reproduce the signature or handwriting of a specific individual, provide modifiers to the Forgery check, as shown below. Some documents require security or authorization codes, whether authentic ones or additional forgeries. The GM makes the character’s check secretly so the character is not sure how good their …"},
  "Gamble": {q:"Wis; Tech 1", d:"You’ve developed a knack for playing the odds in games of chance.\nCheck: To join or start a game, a character must first pay a stake. The character sets the stakes if they start a game, or the GM sets it if the character joins a game. Stakes run from penny-ante ($20/cp/credits) to astronomical ($5,000/cp/credits; see the Wealth Scores / Purchase DC’s and Currency Equivalent table in Chapter III). The character’s Gamble check is opposed by the Gamble checks of all other participants in the game. If playing at a reputable casino, assume the house has a Gamble skill modifier equal to the stake’s equivalent purchase DC (+4 Gamble skill for $20/cp…"},
  "Gather Information": {q:"Cha; Tech 1", d:"You know how to work a crowd.\nCheck: By succeeding at a skill check (DC 10) and spending 1d4+1 hours passing out money and buying drinks, a character can get a feel for the major news items in a neighborhood. This result assumes that no obvious reasons exist why information would be withheld. The higher the check result, the better the information. Information ranges from general to protected, and the cost and Gather Information DC increases accordingly for the type of information the character seeks to gather, as given in the table below. Type of Information DC Purchase DC / Cost in $/cp/credits General 10 5 / $30 Specific 15 10 / $120 Restr…"},
  "Handle Animal": {q:"Cha; Trained Only", d:"You have the ability to teach and guide animals.\nCheck: The DC depends on what you’re trying to do. Task Handle Animal DC Handle an animal 10 “Push” an animal 25 Teach an animal a trick 15 or 201 Train an animal for a general purpose 15 or 201 Rear a wild animal 15 + HD of animal 1 See the specific trick or purpose below. Trick Being Taught DC Time General Purpose DC Time Come 15 1 week Heavy Labor 15 2 weeks Down 15 1 week Performance 15 4 weeks Fetch 15 1 week Riding 15 3 weeks Heel 15 1 week Combat Riding 20 6 weeks Perform 15 1 week Fighting 20 3 weeks Seek 15 1 week Guarding 20 4 weeks Stay 15 1 week Hunting 20 6 weeks Work 15 1 week Att…"},
  "Hide": {q:"Dex; Armor Check Penalty", d:"You have trained in techniques to avoid detection by sight.\nCheck: Your Hide check is opposed by the Spot check of anyone who might see you. You can move up to one-half your normal speed and hide at no penalty. When moving at a speed greater than one-half but less than your normal speed, you take a –5 penalty. It’s practically impossible (–20 penalty) to hide while attacking, running or charging. A creature larger or smaller than Medium takes a size bonus or penalty on Hide checks depending on its size category: Size Modifier Size Modifier Fine +16 Large -4 Diminutive +12 Huge -8 Tiny +8 Gargantuan -12 Small +4 Colossal -16 Medium-size +0 If …"},
  "Intimidate": {q:"Cha", d:"You have a way of making offers others don’t usually refuse.\nCheck: You can change another’s behavior with a successful check. Your Intimidate check is opposed by the target’s modified level check (1d20 + character level or Hit Dice + target’s Wisdom bonus [if any] + target’s modifiers on saves against fear). If you beat your target’s check result, you may treat the target as friendly, but only for the purpose of actions taken while it remains intimidated. (That is, the target retains its normal attitude, but will chat, advise, offer limited help, or advocate on your behalf while intimidated. See the Diplomacy skill, above, for additional det…"},
  "Investigate": {q:"Int; Trained Only, Tech 1+", d:"You have training in forensic methods to “read” the scene of the crime.\nCheck: A character generally uses Search to discover clues and Investigate to analyze them. If the character has access to a crime lab, the character uses the Investigate skill to collect and prepare samples for the lab. The result of the Investigate check provides bonuses or penalties to the lab workers. Analyze Clue: The character can make an Investigate check to apply forensics knowledge to a clue. This function of the Investigate skill does not give the character clues where none existed before. It simply allows the character to extract extra information from a clue t…"},
  "Jump": {q:"Str; Armor Check Penalty", d:"You are better at leaping across and up distances than others.\nCheck: The DC and the distance you can cover vary according to the type of jump you are attempting (see below). Your Jump check is modified by your speed. If your speed is 30 feet then no modifier based on speed applies to the check. If your speed is less than 30 feet, you take a –6 penalty for every 10 feet of speed less than 30 feet. If your speed is greater than 30 feet, you gain a +4 bonus for every 10 feet beyond 30 feet. All Jump DCs given here assume that you get a running start, which requires that you move at least 20 feet in a straight line before attempting the jump. If…"},
  "Knowledge": {q:"Int; Trained Only, Tech 1+", d:"You have pursued a formal education in a chosen specialty of knowledge. This skill encompasses several categories, each of them treated as a separate skill. These categories are identified and defined below. The number of Knowledge categories is kept purposely finite. When trying to determine what Knowledge skill a particular question or field of expertise falls under, use a broad interpretation of the existing categories. Do not arbitrarily make up new categories.\nCheck: A character makes a Knowledge check to see if the character knows something. The DC for answering a question within the character’s field of study is 10 for easy questions, …"},
  "Listen": {q:"Wis", d:"You have honed your hearing with practice and training.\nCheck: Make a Listen check against a DC that reflects how quiet the noise is that a character might hear or against an opposed Move Silently check. The GM may call for a Listen check by a character who is in a position to hear something. A character can also make a Listen check voluntarily if they want to try to hear something in the character’s vicinity. The GM may make the Listen check in secret so that the character doesn’t know whether not hearing anything means that nothing is there or that the character failed the check. A successful Listen check when there isn’t anything to hear r…"},
  "Move Silently": {q:"Dex; Armor Check Penalty", d:"You have a featherlight footfall.\nCheck: Your Move Silently check is opposed by the Listen check of anyone who might hear you. You can move up to one-half your normal speed at no penalty. When moving at a speed greater than one-half but less than your full speed, you take a –5 penalty. It’s practically impossible (–20 penalty) to move silently while running or charging. Noisy surfaces, such as bogs or undergrowth, are tough to move silently across. When you try to sneak across such a surface, you take a penalty on your Move Silently check as indicated below."},
  "Navigate": {q:"Int; Tech 1", d:"You are trained in methods of navigation for long-distance travel.\nCheck: Make a Navigate check when a character is trying to find their way to a distant location without directions or other specific guidance. Generally, a character does not need to make a check to find a local street or other common urban site, or to follow an accurate map. However, the character might make a check to wind their way through a dense forest or a labyrinth of underground storm drains. For movement over a great distance, make a Navigate check. The DC depends on the length of the trip. If the character succeeds, they move via the best reasonable course toward the…"},
  "Open Lock": {q:"Dex; Trained Only, Tech 1", d:"See “Disable Device”."},
  "Perform": {q:"Cha", d:"You are practiced in some form of performance theatre. Like Craft, Knowledge, and Profession, Perform is actually a number of separate skills. You could have several Perform skills, each with its own ranks, each purchased as a separate skill. Each of the nine categories of the Perform skill includes a variety of methods, instruments, or techniques, a small list of which is provided for each category below. • Act (comedy, drama, mime) • Comedy (buffoonery, limericks, joke-telling) • Dance (ballet, waltz, jig) • Keyboard instruments (harpsichord, piano, pipe organ) • Oratory (epic, ode, storytelling) • Percussion instruments (bells, chimes, dru…"},
  "Pilot": {q:"Dex; Trained Only, Tech 3", d:"You have a honed aerodynamic sense about you.\nCheck: Typical piloting tasks don’t require checks. Checks are required during combat, for special maneuvers, or in other extreme circumstances, or when the pilot wants to attempt something outside the normal parameters of the vehicle. When flying, the character can attempt simple maneuvers and stunts (actions in which the pilot attempts to do something complex very quickly or in a limited space). Each vehicle’s description includes a maneuver modifier that applies to Pilot checks made by the operator of the vehicle. Escape Grapplers / Tractor Beam (Tech 6): The pilot of a starship can make a Pilo…"},
  "Profession": {q:"Wis; Tech 1+", d:"You have a daytime job. Like Craft, Knowledge, and Perform, Profession is actually a number of separate skills. You could have several Profession skills, each with its own ranks, each purchased as a separate skill. While a Craft skill represents ability in creating or making an item, a Profession skill represents an aptitude in a vocation requiring a broader range of less specific knowledge.\nCheck: A Profession check can be made whenever the character wishes to spend a week or more working at their Profession. A character earns half their Profession check x $100/cp/credits per week of dedicated work."},
  "Psicraft": {q:"Int; Trained Only, Psionic 1", d:"Use this skill to identify powers as they are manifest or powers already in place.\nCheck: You can identify powers and psionic effects. The DCs for Psicraft checks relating to various tasks are summarized on the table below. Psicraft DC Task 15 + power level Identify a power being manifested. (You must sense the power’s display, or see some visible effect, to identify a power.) No action required. No retry. 15 + power level When manifesting detect psionics, determine the discipline involved in the aura of a single item or creature you can see. (If the aura is not a power effect, the DC is 15 + 1/2 manifester level.) No action required. 15 + po…"},
  "Read/Write/Speak Language": {q:"None; Trained Only", d:"You are fluent in one or more additional languages. Special: The Read/Write/Speak Language skill doesn’t work like a standard skill. A character automatically knows"},
  "Repair": {q:"Int; Trained Only, Tech 1", d:"You have a knack for fixing things.\nCheck: Most Repair checks are made to fix complex electronic or mechanical devices. The DC is set by the GM. In general, simple repairs have a DC of 10 to 15 and require no more than a few minutes to accomplish. More complex repair work has a DC of 20 or higher and can require an hour or more to complete. Making repairs also involves a monetary cost when spare parts or new components are needed. Repair Task (Example) Purchase DC Repair DC Time Simple (tool, simple weapon) 4 ($20) 10 1 min. Moderate (mechanical or electronic component) 7 ($55) 15 10 min. Complex (mechanical or electronic device) 10 ($120) 20…"},
  "Research": {q:"Int; Tech 1", d:"You know how to find answers at the library. Do research when you don’t know (via Knowledge) the answer.\nCheck: Researching a topic takes time, skill, and some luck. The GM determines how obscure a particular topic is (the more obscure, the higher the DC) and what kind of information might be available depending on where the character is conducting their research. Information ranges from general to protected. Given enough time (usually 1d4 hours) and a successful skill check, the character gets a general idea about a given topic. This assumes that no obvious reasons exist why such information would be unavailable, and that the character has a…"},
  "Ride": {q:"Dex", d:"You are skilled in using another creature as a means of transportation.\nCheck: Typical riding actions don’t require checks. You can saddle, mount, ride, and dismount from a mount without a problem. The following tasks do require checks: Task Ride DC Task Ride DC Guide with knees 5 Leap 15 Stay in saddle 5 Spur mount 15 Fight with warhorse 10 Control mount in battle 20 Cover 15 Fast mount or dismount 201 Soft fall 15 1 Armor check penalty applies. Guide with Knees: You can react instantly to guide your mount with your knees so that you can use both hands in combat. Make your Ride check at the start of your turn. If you fail, you can use only o…"},
  "Search": {q:"Int", d:"You can find things others typically can’t.\nCheck: You generally must be within 10 feet of the object or surface to be searched. The table below gives DCs for typical tasks involving the Search skill. Task Search DC Ransack a chest full of junk to find a certain item 10 Notice a typical secret door or a simple trap 20 Find a difficult nonmagical trap (Rogue only)1 21 or higher Find a magic trap (Rogue only)1 25 + level of spell used to create trap Notice a well-hidden secret door 30 Find a footprint Varies2 1 Dwarves (even if they are not Rogues) can use Search to find traps built into or out of stone. 2 A successful Search check can find a f…"},
  "Sense Motive": {q:"Wis", d:"You can intuit when something is “off” or other than it seems.\nCheck: A successful check lets you avoid being bluffed (see the Bluff skill). You can also use this skill to determine when “something is up” (that is, something odd is going on) or to assess someone’s trustworthiness. Task Sense Motive DC Hunch 20 Sense enchantment 25 or 15 Discern secret message Varies Hunch: This use of the skill involves making a gut assessment of the social situation. You can get the feeling from another’s behavior that something is wrong, such as when you’re talking to an impostor. Alternatively, you can get the feeling that someone is trustworthy. Sense Enc…"},
  "Sleight of Hand": {q:"Dex; Trained Only, Armor Check Penalty", d:"You can inconspicuously conceal things with your hands.\nCheck: A DC 10 Sleight of Hand check lets you palm a coin-sized, unattended object. Performing a minor feat of legerdemain, such as making a coin disappear, also has a DC of 10 unless an observer is determined to note where the item went. When you use this skill under close observation, your skill check is opposed by the observer’s Spot check. The observer’s success doesn’t prevent you from performing the action, just from doing it unnoticed. You can hide a small object (including a light weapon or an easily concealed ranged weapon, such as a dart, sling, or hand crossbow) on your body. …"},
  "Spellcraft": {q:"Int; Trained Only, Arcane 1", d:"You have learned some of the signs and sigils of the arcane arts.\nCheck: You can identify spells and magic effects; use this skill to identify spells as they are cast or spells already in place. The DC’s for Spellcraft checks relating to various tasks are summarized below: Spellcraft DC Task 13 When using Read Magic, identify a Glyph of Warding. No action required. 15 + spell level Identify a spell being cast. (You must see or hear the spell’s verbal or somatic components.) No action required. No retry. 15 + spell level Learn a spell from a spellbook or scroll (Wizard only). No retry for that spell until you gain at least 1 rank in Spellcraft…"},
  "Spot": {q:"Wis", d:"You have an eye for seeing what’s hidden.\nCheck: The Spot skill is used primarily to detect characters or creatures who are hiding. Typically, your Spot check is opposed by the Hide check of the creature trying not to be seen. Sometimes a creature isn’t intentionally hiding but is still difficult to see, so a successful Spot check is necessary to notice it. A Spot check result higher than 20 generally lets you become aware of an invisible creature near you, though you can’t actually see it. Spot is also used to detect someone in disguise (see the Disguise skill), and to read lips when you can’t hear or understand what someone is saying. Spot …"},
  "Survival": {q:"Wis", d:"You are trained in living off the land.\nCheck: You can keep yourself and others safe and fed in the wild. The table below gives the DCs for various tasks that require Survival checks. Survival does not allow you to follow difficult tracks unless you are a Ranger or have the Track feat (see the Restriction section below). Survival DC Task 10 Get along in the wild. Move up to one-half your overland speed while hunting and foraging (no food or water supplies needed). You can provide food and water for one other person for every 2 points by which your check result exceeds 10. 15 Gain a +2 bonus on all Fortitude saves against severe weather while …"},
  "Swim": {q:"Str; Armor Check Penalty", d:"You know how to stay afloat.\nCheck: Make a Swim check once per round while you are in the water. Success means you may swim at up to one- half your speed (as a full-round action) or at one-quarter your speed (as a move action). If you fail by 4 or less, you make no progress through the water. If you fail by 5+, you go underwater. If you are underwater, either because you failed a Swim check or because you are swimming underwater intentionally, you must hold your breath. You can hold your breath for a number of rounds equal to your Constitution score, but only if you do nothing other than take move actions or free actions. If you take a standa…"},
  "Treat Injury": {q:"Wis", d:"You can patch up wounds and treat conditions.\nCheck: The DC and effect depend on the task attempted. First Aid (DC 15): With a first aid kit, if a character has lost hit points, the character who would Treat Injury can restore some of them. A successful check, as a full-round action, restores 1d4 hit points. The number restored can never exceed the character’s full normal total of hit points. This application of the skill can be used successfully on a character only once per encounter wherein the target was damaged. Revive Dazed, Stunned, or Unconscious Character (DC 15): With a first aid kit, the character can remove the dazed, stunned, or u…"},
  "Tumble": {q:"Dex; Trained Only, Armor Check Penalty", d:"You are light on your feet, knowing how to bob and weave with advanced training.\nCheck: You can’t use this skill if your speed has been reduced by armor, excess equipment, or loot. You can land softly when you fall or tumble past opponents. You can also tumble to entertain an audience (as though using the Perform skill). The DCs for various tasks involving the Tumble skill are given on the table below: Tumble DC Task 15 Treat a fall as if it were 10 feet shorter than it really is when determining damage. 15 Tumble at one-half speed as part of normal movement, provoking no attacks of opportunity while doing so. Failure means you provoke attack…"},
  "Use Magic Device": {q:"Cha; Trained Only, Arcane 1, Tech 1", d:"Use this skill to activate magic devices, also known as enchanted items, either by training or trickery.\nCheck: You can use this skill to read a spell or to activate a magic item. Use Magic Device lets you use a magic item as if you had the spell ability or class features of another class, as if you were a different race, or as if you were of a different alignment. You make a Use Magic Device check each time you activate a device such as a wand. If you are using the check to emulate an alignment or some other quality in an ongoing manner, you need to make the relevant Use Magic Device check once per hour. You must consciously choose which req…"},
  "Use Psionic Device": {q:"Cha; Trained Only, Psionic 1, Tech 1", d:"Use this skill to activate psionic devices, also known as imbued items, that otherwise you could not activate.\nCheck: You can use this skill to address a power stone (to learn what powers are encoded on it) or to activate a psionic item. This skill lets you use a psionic item as if you had the manifesting ability or class features of another class, as if you were a different race, or as if you were a different alignment. You make Use Psionic Device checks each time you activate a device such as a dorje. If you are using the check to emulate an alignment or some other quality in an ongoing manner, you need to make the relevant emulation checks…"},
  "Use Rope": {q:"Dex; Tech 1", d:"You have specialized training in tying knots for various purposes.\nCheck: Most tasks with a rope are relatively simple. The DCs for various tasks utilizing this skill are summarized on the table below: Use Rope DC Task 10 Tie a firm knot 101 Secure a grappling hook 15 Tie a special knot, such as one that slips, slides slowly, or loosens with a tug 15 Tie a rope around yourself one-handed 15 Splice two ropes together Varies Bind a character 1 Add 2 to the DC for every 10 feet the hook is thrown; see below. Secure a Grappling Hook: Securing a grappling hook requires a Use Rope check (DC 10, +2 for every 10 feet of distance the grappling hook is…"}
};
// v8.35.0 (Adam): the QUICKDRAW rows const removed with the table — the
// digital form applied its sorted rows straight down STR→CHA, biasing every
// Quickdraw hero toward Strength. The table remains in the book, where the
// player assigns the six scores freely.

// SKILLS — full expanded list including subcategories
const SKILLS = [
  {n:'Appraise',k:'INT'},{n:'Autohypnosis',k:'WIS',req:'Psionic 1'},
  {n:'Balance',k:'DEX'},{n:'Bluff',k:'CHA'},{n:'Climb',k:'STR'},
  {n:'Computer Use',k:'INT',req:'Tech 5'},{n:'Concentration',k:'CON'},
  // Craft family
  {n:'Craft (Armorsmithing)',k:'INT',family:'Craft'},{n:'Craft (Bowmaking)',k:'INT',family:'Craft'},
  {n:'Craft (Chemical)',k:'INT',family:'Craft'},{n:'Craft (Electronics)',k:'INT',family:'Craft',req:'Tech 5'},
  {n:'Craft (Mechanical)',k:'INT',family:'Craft'},{n:'Craft (Pharmaceutical)',k:'INT',family:'Craft'},
  {n:'Craft (Structural)',k:'INT',family:'Craft'},{n:'Craft (Trapmaking)',k:'INT',family:'Craft'},
  {n:'Craft (Visual Arts)',k:'INT',family:'Craft'},{n:'Craft (Weaponsmithing)',k:'INT',family:'Craft'},
  {n:'Craft (Writing)',k:'INT',family:'Craft'},
  {n:'Decipher Code',k:'INT'},{n:'Demolitions',k:'INT'},{n:'Diplomacy',k:'CHA'},
  {n:'Disable Device',k:'INT'},{n:'Disguise',k:'CHA'},{n:'Drive',k:'DEX',req:'Tech 3'},
  {n:'Escape Artist',k:'DEX'},{n:'Forgery',k:'INT'},{n:'Gamble',k:'WIS'},
  {n:'Gather Information',k:'CHA'},{n:'Handle Animal',k:'CHA'},{n:'Hide',k:'DEX'},
  {n:'Intimidate',k:'CHA'},{n:'Investigate',k:'INT'},{n:'Jump',k:'STR'},
  // Knowledge family
  {n:'Knowledge (Arcane Lore)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Architecture & Engineering)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Art)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Behavioral Sciences)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Business)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Civics)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Current Events)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Dungeoneering)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Earth & Life Sciences)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Geography)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (History)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Local)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Nature)',k:'INT',family:'Knowledge',req:'Tech 0'},{n:'Knowledge (Nobility & Royalty)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Physical Sciences)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (Popular Culture)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Psionics)',k:'INT',family:'Knowledge',req:'Psionic 1'},{n:'Knowledge (Religion)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Streetwise)',k:'INT',family:'Knowledge',req:'Tech 0'},{n:'Knowledge (Tactics)',k:'INT',family:'Knowledge',req:'Tech 0'},
  {n:'Knowledge (Technology)',k:'INT',family:'Knowledge',req:'Tech 1'},{n:'Knowledge (The Planes)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Knowledge (Theology & Philosophy)',k:'INT',family:'Knowledge',req:'Tech 1'},
  {n:'Listen',k:'WIS'},{n:'Move Silently',k:'DEX'},{n:'Navigate',k:'INT'},
  // Perform family
  {n:'Perform (Act)',k:'CHA',family:'Perform'},{n:'Perform (Comedy)',k:'CHA',family:'Perform'},
  {n:'Perform (Dance)',k:'CHA',family:'Perform'},{n:'Perform (Keyboard Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Oratory)',k:'CHA',family:'Perform'},{n:'Perform (Percussion Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Sing)',k:'CHA',family:'Perform'},{n:'Perform (String Instruments)',k:'CHA',family:'Perform'},
  {n:'Perform (Wind Instruments)',k:'CHA',family:'Perform'},
  {n:'Pilot',k:'DEX',req:'Tech 3'},
  // Profession family — one entry per Starting Occupation, plus a catch-all.
  // The corresponding occupation's Profession is auto-marked as a class skill
  // via isClassSkill() based on the character's c.occ value.
  {n:'Profession (Academic)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Adventurer)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Apothecary)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Astronaut Trainee)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Athlete)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Blue Collar)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Celebrity)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Colonist)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Creative)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Criminal)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Dilettante)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Doctor)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Drifter)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Emergency Services)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Entrepreneur)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Gladiator)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Hedge Wizard)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Heir)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Investigative)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Law Enforcement)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Military)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Novitiate)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Outcast)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Psychic)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Religious)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Rural)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Scavenger)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Squire)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Student)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Technician)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Transporter)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (White Collar)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Profession (Other)',k:'WIS',family:'Profession',req:'Tech 1'},
  {n:'Psicraft',k:'INT',req:'Psionic 1'},
  {n:'Read/Write/Speak Language',k:'INT'}, // language tracking handled separately
  {n:'Repair',k:'INT',req:'Tech 1'},{n:'Research',k:'INT'},{n:'Ride',k:'DEX'},
  {n:'Search',k:'INT'},{n:'Sense Motive',k:'WIS'},{n:'Sleight of Hand',k:'DEX'},
  {n:'Spellcraft',k:'INT',req:'Arcane/Divine 1'},{n:'Spot',k:'WIS'},{n:'Survival',k:'WIS'},
  {n:'Swim',k:'STR'},{n:'Treat Injury',k:'WIS'},{n:'Tumble',k:'DEX'},
  {n:'Use Magic Device',k:'CHA',req:'Arcane/Divine 1'},{n:'Use Psionic Device',k:'CHA',req:'Psionic 1'},
  {n:'Use Rope',k:'DEX'},
];

// v8.5.1: skills that MAY suffer a penalty (up to -4) without the appropriate
// tool/skill kit, per the HH skill->kit map (p.301) and kit descriptions. This
// is an advisory marker only — the penalty is applied at play time, and the
// equipment substrate's kit catalogue (equipment_items.json "required" entries)
// is the source of truth. The Craft family is toolkit-dependent as a whole
// (artisan's tools / electrical / mechanical kits).
// v9.1.0 (Adam 2026-10-06): Demolitions joins (−4 without a demolitions
// kit); Craft (Writing) needs no kit (no HH kit exists for it — before
// v9.1.0 any Artisan's tools quietly 'satisfied' it).
const TOOLKIT_DEPENDENT_SKILLS = new Set(['Demolitions','Disable Device','Disguise','Forgery','Repair','Treat Injury']);
// v9.1.0 (Adam 2026-10-06): instrument Performs need an instrument (Sing,
// Oratory, Act, Comedy, Dance don't).
const INSTRUMENT_PERFORMS = new Set(['Perform (Keyboard Instruments)','Perform (Percussion Instruments)','Perform (String Instruments)','Perform (Wind Instruments)']);
// ============================================================================
// SYNERGIES_DB — v8.3.9 skill synergy bonuses (HH "Synergy:" sections)
// ============================================================================
//
// d20-lineage skill synergy. If a character has 5+ ranks in `source`, they
// gain a synergy bonus (typically +2) to checks of `target`. Some synergies
// apply unconditionally to all uses of the target skill; others are
// context-restricted (e.g. "+2 Survival to find tracks"); some are GM-
// adjudicated and not auto-applied at all.
//
// Entry shape:
//   {
//     source: 'Skill Name',    // 5+ ranks here triggers the bonus
//     target: 'Skill Name',    // ...giving +N to checks of this skill
//     value:  2,               // bonus magnitude (HH default: +2, occasional +1)
//     kind:   'auto' | 'conditional' | 'gm',
//     context: 'descriptive string' (when kind != 'auto'),
//     page:   <handbook page>,
//   }
//
// kind semantics:
//   'auto'        — Engine adds the bonus to the target skill's total. Player
//                   sees it folded into the displayed value with a provenance
//                   tooltip (e.g. "+2 synergy from Bluff").
//   'conditional' — Bonus only applies in specific contexts. Engine does NOT
//                   add it to the displayed total; instead surfaces it as a
//                   tooltip note ("Conditional: +2 to <target> <context> from
//                   <source> 5+ ranks"). Player/GM negotiates at the table.
//   'gm'          — Pure GM-adjudicated. Tooltip note with no engine effect.
//                   Distinguished from 'conditional' because the qualifying
//                   condition itself ("a Craft skill related to the item")
//                   isn't even mechanically encodeable in our model.
//
// Note: Synergies that target non-skill effects (turning checks, Bardic
// Knowledge, dodge AC bonus from Tumble) are class-feature mechanics, not
// skill synergies in the strict d20 sense, and are tracked elsewhere (or in
// the affected feature's description).
const SYNERGIES_DB = [
  // ===== AUTO (engine adds to target total) =====
  {source:'Autohypnosis',                source_kind:'auto',  target:'Knowledge (Psionics)',  value:2, kind:'auto', page:151},
  {source:'Concentration',               source_kind:'auto',  target:'Autohypnosis',          value:2, kind:'auto', page:155},
  {source:'Tumble',                      source_kind:'auto',  target:'Balance',               value:2, kind:'auto', page:152},
  {source:'Tumble',                      source_kind:'auto',  target:'Jump',                  value:2, kind:'auto', page:171},
  {source:'Jump',                        source_kind:'auto',  target:'Tumble',                value:2, kind:'auto', page:191},
  {source:'Bluff',                       source_kind:'auto',  target:'Diplomacy',             value:2, kind:'auto', page:153},
  {source:'Bluff',                       source_kind:'auto',  target:'Intimidate',            value:2, kind:'auto', page:153},
  {source:'Bluff',                       source_kind:'auto',  target:'Sleight of Hand',       value:2, kind:'auto', page:153},
  {source:'Knowledge (Local)',           source_kind:'auto',  target:'Gather Information',    value:2, kind:'auto', page:167},
  {source:'Knowledge (Nobility & Royalty)', source_kind:'auto', target:'Diplomacy',           value:2, kind:'auto', page:160},
  {source:'Sense Motive',                source_kind:'auto',  target:'Diplomacy',             value:2, kind:'auto', page:160},
  {source:'Handle Animal',               source_kind:'auto',  target:'Ride',                  value:2, kind:'auto', page:169},
  {source:'Survival',                    source_kind:'auto',  target:'Knowledge (Nature)',    value:2, kind:'auto', page:171},
  {source:'Knowledge (Arcane Lore)',     source_kind:'auto',  target:'Spellcraft',            value:2, kind:'auto', page:189},

  // ===== CONDITIONAL (tooltip note; engine does not auto-add) =====
  {source:'Bluff',                       target:'Disguise',          value:2, kind:'conditional', context:'when you know you’re being observed and acting in character', page:166},
  {source:'Use Rope',                    target:'Climb',             value:2, kind:'conditional', context:'to climb a rope, knotted rope, or rope-and-wall combination',          page:155},
  {source:'Escape Artist',               target:'Use Rope',          value:2, kind:'conditional', context:'when binding someone',                                                  page:166},
  {source:'Use Rope',                    target:'Escape Artist',     value:2, kind:'conditional', context:'when escaping from rope bonds',                                        page:193},
  {source:'Decipher Code',               target:'Use Magic Device',  value:2, kind:'conditional', context:'involving scrolls',                                                    page:158},
  {source:'Decipher Code',               target:'Computer Use',      value:2, kind:'conditional', context:'to defeat computer/file security',                                     page:158},
  {source:'Spellcraft',                  target:'Use Magic Device',  value:2, kind:'conditional', context:'related to scrolls',                                                   page:189},
  {source:'Use Magic Device',            target:'Spellcraft',        value:2, kind:'conditional', context:'to decipher scroll spells',                                            page:192},
  {source:'Psicraft',                    target:'Use Psionic Device',value:2, kind:'conditional', context:'related to power stones',                                              page:176},
  {source:'Use Psionic Device',          target:'Psicraft',          value:2, kind:'conditional', context:'to address power stones',                                              page:193},
  {source:'Search',                      target:'Survival',          value:2, kind:'conditional', context:'to find or follow tracks',                                             page:185},
  {source:'Knowledge (Architecture & Engineering)', target:'Search', value:2, kind:'conditional', context:'to find secret doors or hidden compartments',                          page:185},
  {source:'Knowledge (Behavioral Sciences)', target:'Sense Motive',  value:2, kind:'conditional', context:'against beings of the same race',                                      page:187},
  {source:'Knowledge (Tactics)',         target:'Sense Motive',      value:2, kind:'conditional', context:'when countering a feint in combat',                                     page:187},
  {source:'Knowledge (Dungeoneering)',   target:'Survival',          value:2, kind:'conditional', context:'while underground',                                                    page:190},
  {source:'Knowledge (Nature)',          target:'Survival',          value:2, kind:'conditional', context:'in aboveground natural environments',                                  page:190},
  {source:'Knowledge (Geography)',       target:'Survival',          value:2, kind:'conditional', context:'to keep from getting lost or to avoid natural hazards',                page:190},
  {source:'Knowledge (The Planes)',      target:'Survival',          value:2, kind:'conditional', context:'while on other planes',                                                page:190},

  // ===== GM-ADJUDICATED (tooltip note only; condition itself isn't mechanically encodable) =====
  // Appraise: requires Craft OR Knowledge "related to the item being appraised" — the relatedness
  // is per-appraisal-context, not encodable as a static character flag.
  {source:'Craft or Knowledge (any, related to item)', target:'Appraise',  value:2, kind:'gm',
   context:'when appraising an item related to the source skill (e.g., Craft Weaponsmithing for weapons)', page:151},
  // Repair: +1 (note the non-standard magnitude), per-repair-type, GM's call.
  {source:'Craft (Mechanical) or Craft (Structural)', target:'Repair',     value:1, kind:'gm',
   context:'for repairs to mechanical/structural systems, at GM’s discretion',                            page:181},
  // Research: Computer Use, only when searching computer records.
  {source:'Computer Use',                            target:'Research',    value:2, kind:'gm',
   context:'when researching by searching computer records, at GM’s discretion',                          page:182},

  // ===== KNOWLEDGE CHART (HH p.175) — GM-permissive synergies =====
  // The Knowledge skill's description introduces a chart with the umbrella:
  //   "The GM may decide that having 5+ ranks in a specific Knowledge skill
  //    provides a character with a +2 synergy bonus when making a related
  //    skill check. Known synergy bonuses include: [chart]"
  //
  // Entries already present elsewhere (Arcane Lore→Spellcraft, Local→Gather
  // Info, Nobility & Royalty→Diplomacy, Behavioral Sciences→Sense Motive,
  // Dungeoneering/Nature/Geography/The Planes→Survival, Tactics→Sense Motive)
  // are NOT duplicated below — they remain auto/conditional as documented.
  //
  // v8.3.11: Chart entries with NO context restriction (i.e., the chart text
  // gives no specific condition like "to value art" or "for legal documents")
  // are promoted to kind:'auto'. They auto-apply to the target's Misc column.
  // Entries with explicit context restrictions remain kind:'gm' as tooltips.
  // Note magnitudes: most +2, Physical Sciences and Theology & Philosophy +1.
  //
  // The Business → Profession entry has a per-target predicate (the Profession
  // must have ≥1 rank). It's auto, but with target_ranks_min:1 — the engine
  // only fires it for Profession (X) skills where the character has 1+ ranks.

  // ----- AUTO-promoted chart entries (no context restriction) -----
  {source:'Knowledge (Architecture & Engineering)', target:'Craft (Structural)', value:2, kind:'auto', page:175},
  {source:'Knowledge (Business)',           target:'Profession',           value:2, kind:'auto',
   target_ranks_min: 1, page:175},
  {source:'Knowledge (Current Events)',     target:'Knowledge (Popular Culture)', value:2, kind:'auto', page:175},
  {source:'Knowledge (Earth & Life Sciences)', target:'Treat Injury',      value:2, kind:'auto', page:175},
  {source:'Knowledge (Physical Sciences)',  target:'Craft (Chemical)',     value:1, kind:'auto', page:175},
  {source:'Knowledge (Physical Sciences)',  target:'Craft (Mechanical)',   value:1, kind:'auto', page:175},
  {source:'Knowledge (Physical Sciences)',  target:'Craft (Structural)',   value:1, kind:'auto', page:175},
  {source:'Knowledge (Popular Culture)',    target:'Knowledge (Current Events)', value:2, kind:'auto', page:175},
  {source:'Knowledge (Psionics)',           target:'Psicraft',             value:2, kind:'auto', page:175},
  {source:'Knowledge (Technology)',         target:'Craft (Electronics)',  value:2, kind:'auto', page:175},
  {source:'Knowledge (Theology & Philosophy)', target:'Knowledge (Civics)', value:1, kind:'auto', page:175},
  {source:'Knowledge (Theology & Philosophy)', target:'Knowledge (Religion)', value:1, kind:'auto', page:175},

  // ----- GM-permissive chart entries (context-restricted) -----
  // These remain kind:'gm' (tooltip-only) because the engine cannot evaluate
  // the per-roll context (was the appraisal of art? was the Gather Info for
  // black market? was the Navigate to avoid getting lost?).
  {source:'Knowledge (Art)',           target:'Appraise',             value:2, kind:'gm',
   context:'to accurately value works of art, at GM’s discretion (HH Knowledge chart, p.175)', page:175},
  {source:'Knowledge (Civics)',        target:'Diplomacy',            value:2, kind:'gm',
   context:'when drafting legal documentation, at GM’s discretion (HH Knowledge chart, p.175)', page:175},
  {source:'Knowledge (Geography)',     target:'Navigate',             value:2, kind:'gm',
   context:'to avoid getting lost, at GM’s discretion (HH Knowledge chart, p.175). This is distinct from Geography→Survival.', page:175},
  {source:'Knowledge (Streetwise)',    target:'Gather Information',   value:2, kind:'gm',
   context:'when looking for grey/black market goods or contacts, at GM’s discretion (HH Knowledge chart, p.175). Distinct from Local→Gather Information.', page:175},

  // ===== EXTRA-SKILL TARGETS (notes only; these aren't skill bonuses per se) =====
  // The handbook lists these in Synergy sections, but they target non-skill mechanics.
  // We record them here so the source skill displays the tooltip note, but no auto-add
  // happens (the engine doesn't yet model these effects).
  {source:'Handle Animal', target:'Wild Empathy',                value:2, kind:'gm',
   context:'class-feature check (Druid/Ranger Wild Empathy); not a skill, applied if your class grants Wild Empathy', page:169},
  // v8.3.10: Knowledge chart entries with non-skill targets.
  {source:'Knowledge (History)', target:'Bardic Knowledge',        value:2, kind:'gm',
   context:'class-feature check (Bard); not a skill, applied if your class grants Bardic Knowledge (HH Knowledge chart, p.175)', page:175},
  {source:'Knowledge (History)', target:'Explorer Lore',           value:2, kind:'gm',
   context:'class-feature check (Explorer); not a skill, applied if your class grants Explorer Lore (HH Knowledge chart, p.175)', page:175},
  {source:'Knowledge (Religion)', target:'Turning attempts',       value:2, kind:'gm',
   context:'class-feature check (Cleric Turn Undead); not a skill, applied if your class grants Turn Undead (HH Knowledge chart, p.175)', page:175},
];

// v8.3.10: Expand family-targeted entries (target === 'Profession') into N
// per-specialization entries so the tooltip surfaces on every specific row.
// Without this, an entry like Knowledge (Business) → Profession (with 1+
// rank, GM-permissive) wouldn't display on any row because no SKILLS entry
// is literally named 'Profession' — they're all 'Profession (X)'.
//
// Currently only Profession needs this. If future entries say target:'Craft'
// or target:'Knowledge', the same expansion applies automatically.
(function expandFamilyTargets() {
  const FAMILIES = ['Profession', 'Craft', 'Knowledge', 'Perform'];
  const skillNames = new Set(SKILLS.map(sk => sk.n));
  const expanded = [];
  for (const e of SYNERGIES_DB) {
    if (FAMILIES.includes(e.target) && !skillNames.has(e.target)) {
      // Expand to all family members
      const members = SKILLS.filter(sk => sk.family === e.target);
      for (const m of members) {
        expanded.push({...e, target: m.n, _expandedFromFamily: e.target});
      }
    } else {
      expanded.push(e);
    }
  }
  // Replace the in-place SYNERGIES_DB contents
  SYNERGIES_DB.length = 0;
  SYNERGIES_DB.push(...expanded);
})();

// Hero class skills lookup
const HC_SKILLS = {
  'Strong Hero':['Climb','Craft (Structural)','Handle Animal','Jump','Knowledge (Current Events)','Knowledge (Popular Culture)','Knowledge (Streetwise)','Knowledge (Tactics)','Profession (Any)','Read/Write/Speak Language','Repair','Swim'],
  'Fast Hero':['Balance','Craft (Mechanical)','Drive','Escape Artist','Hide','Knowledge (Current Events)','Knowledge (Popular Culture)','Knowledge (Streetwise)','Move Silently','Pilot','Profession (Any)','Read/Write/Speak Language','Ride','Sleight of Hand','Tumble'],
  'Tough Hero':['Climb','Concentration','Craft (Mechanical)','Craft (Structural)','Drive','Intimidate','Knowledge (Current Events)','Knowledge (Popular Culture)','Knowledge (Streetwise)','Profession (Any)','Read/Write/Speak Language','Ride','Spot','Survival'],
  'Smart Hero':['Appraise','Computer Use','Craft (Armorsmithing)','Craft (Bowmaking)','Craft (Chemical)','Craft (Electronics)','Craft (Mechanical)','Craft (Pharmaceutical)','Craft (Structural)','Craft (Trapmaking)','Craft (Visual Arts)','Craft (Weaponsmithing)','Craft (Writing)','Decipher Code','Demolitions','Disable Device','Forgery','Investigate','Knowledge (Arcane Lore)','Knowledge (Architecture & Engineering)','Knowledge (Art)','Knowledge (Behavioral Sciences)','Knowledge (Business)','Knowledge (Civics)','Knowledge (Current Events)','Knowledge (Dungeoneering)','Knowledge (Earth & Life Sciences)','Knowledge (Geography)','Knowledge (History)','Knowledge (Local)','Knowledge (Nature)','Knowledge (Nobility & Royalty)','Knowledge (Physical Sciences)','Knowledge (Popular Culture)','Knowledge (Psionics)','Knowledge (Religion)','Knowledge (Streetwise)','Knowledge (Tactics)','Knowledge (Technology)','Knowledge (The Planes)','Knowledge (Theology & Philosophy)','Navigate','Profession (Any)','Read/Write/Speak Language','Repair','Research','Search'],
  'Dedicated Hero':['Craft (Pharmaceutical)','Craft (Visual Arts)','Craft (Writing)','Gamble','Investigate','Knowledge (Arcane Lore)','Knowledge (Art)','Knowledge (Behavioral Sciences)','Knowledge (Business)','Knowledge (Civics)','Knowledge (Current Events)','Knowledge (Earth & Life Sciences)','Knowledge (History)','Knowledge (Physical Sciences)','Knowledge (Popular Culture)','Knowledge (Streetwise)','Knowledge (Tactics)','Knowledge (Technology)','Knowledge (Theology & Philosophy)','Listen','Profession (Any)','Read/Write/Speak Language','Sense Motive','Spot','Survival','Treat Injury'],
  'Charismatic Hero':['Bluff','Craft (Visual Arts)','Craft (Writing)','Diplomacy','Disguise','Gather Information','Handle Animal','Intimidate','Knowledge (Arcane Lore)','Knowledge (Art)','Knowledge (Behavioral Sciences)','Knowledge (Business)','Knowledge (Civics)','Knowledge (Current Events)','Knowledge (Popular Culture)','Knowledge (Streetwise)','Knowledge (Theology & Philosophy)','Perform (Act)','Perform (Comedy)','Perform (Dance)','Perform (Keyboard Instruments)','Perform (Oratory)','Perform (Percussion Instruments)','Perform (Sing)','Perform (String Instruments)','Perform (Wind Instruments)','Profession (Any)','Read/Write/Speak Language'],
};

// CLASS_SKILLS — auto-extracted from Hero's Handbook and GM's Guide for v8.1.5.
// Sentinel string values indicate inherited/special-case handling resolved at runtime.
//   __all_skills_class__      : every skill is a class skill (Super-Hero, Super-Villain)
//   __expert_choose_any__     : Expert chooses any 10 skills as class skills
//   __inherit_arcane_divine__ : Mystic Theurge — class skills of underlying arcane+divine classes
//   __inherit_divine_psionic__: Psychic Theurge — class skills of underlying divine+psionic classes
const CLASS_SKILLS = {
  "Ace Pilot": ["Balance","Bluff","Computer Use","Concentration","Craft (Electronics)","Craft (Mechanical)","Drive","Handle Animal","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Technology)","Navigate","Pilot","Profession (Any)","Read/Write/Speak Language","Repair","Ride","Tumble"],
  "Ambassador": ["Bluff","Computer Use","Diplomacy","Gather Information","Intimidate","Knowledge (Behavioural Science)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (History)","Knowledge (Theology & Philosophy)","Profession (Any)","Read/Write/Speak Language","Research","Sense Motive"],
  "Anti-Hero": ["Bluff","Concentration","Craft (Any)","Drive","Gather Information","Intimidate","Knowledge (Any)","Navigate","Pilot","Read/Write/Speak Language","Research","Sense Motive","Survival","Treat Injury"],
  "Arcane Trickster": ["Appraise","Balance","Bluff","Climb","Concentration","Craft (Any)","Decipher Code","Diplomacy","Disable Device","Disguise","Escape Artist","Gamble","Gather Information","Hide","Jump","Knowledge (Any)","Listen","Move Silently","Profession (Any)","Psicraft","Read/Write/Speak Language","Search","Sense Motive","Sleight of Hand","Spellcraft","Spot","Swim","Tumble","Use Magic Device","Use Psionic Device","Use Rope"],
  "Archmage": ["Concentration","Craft (Chemical)","Decipher Code","Knowledge (Any)","Profession (Any)","Read/Write/Speak Language","Research","Search","Spellcraft"],
  "Aristocrat": ["Appraise","Bluff","Diplomacy","Disguise","Forgery","Gamble","Gather Information","Handle Animal","Intimidate","Knowledge (Any)","Listen","Perform (Any)","Profession (Any)","Read/Write/Speak Language","Ride","Sense Motive","Spot","Survival","Swim"],
  "Artificer": ["Computer Use","Concentration","Craft (Any)","Decipher Code","Disable Device","Drive","Forgery","Knowledge (Any)","Profession (Any)","Read/Write/Speak Language","Repair","Research","Search","Use Magic Device","Use Psionic Device"],
  "Assassin": ["Autohypnosis","Balance","Bluff","Climb","Computer Use","Craft (Any)","Decipher Code","Diplomacy","Disable Device","Disguise","Escape Artist","Forgery","Gather Information","Hide","Intimidate","Jump","Knowledge (Any)","Listen","Move Silently","Read/Write/Speak Language","Research","Search","Sense Motive","Sleight of Hand","Spot","Swim","Tumble","Use Magic Device","Use Psionic Device","Use Rope"],
  "Bard": ["Appraise","Balance","Bluff","Climb","Concentration","Craft (Any)","Decipher Code","Diplomacy","Disguise","Drive","Escape Artist","Gamble","Gather Information","Hide","Jump","Knowledge (Any)","Listen","Move Silently","Perform (Any)","Profession (Any)","Read/Write/Speak Language","Sense Motive","Sleight of Hand","Spellcraft","Swim","Tumble","Use Magic Device"],
  "Berserker": ["Climb","Craft (Any)","Drive","Handle Animal","Intimidate","Jump","Listen","Ride","Survival","Swim"],
  "Bloodluster": ["Autohypnosis","Balance","Bluff","Climb","Concentration","Escape Artist","Intimidate","Jump","Listen","Profession (Any)","Read/Write/Speak Language","Sense Motive","Spot","Survival","Swim","Tumble"],
  "Bodyguard": ["Concentration","Disguise","Drive","Forgery","Gather Information","Intimidate","Knowledge (Behavioural Science)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Streetwise)","Listen","Profession (Any)","Read/Write/Speak Language","Search","Sense Motive","Spot"],
  "Charismatic Hero": ["Bluff","Craft (Visual Arts)","Craft (Writing)","Diplomacy","Disguise","Gather Information","Handle Animal","Intimidate","Knowledge (Arcane Lore)","Knowledge (Art)","Knowledge (Behavioral Sciences)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Theology & Philosophy)","Perform (Act)","Perform (Dance)","Perform (Keyboard Instruments)","Perform (Percussion Instruments)","Perform (Sing)","Perform (Stand-Up)","Perform (Stringed Instruments)","Perform (Wind Instruments)","Profession (Any)"],
  "Cleric": ["Concentration","Craft (Any)","Diplomacy","Knowledge (Arcane Lore)","Knowledge (History)","Knowledge (Religion)","Knowledge (The Planes)","Knowledge (Theology & Philosophy)","Profession (Any)","Spellcraft","Treat Injury"],
  "Combat Medic": ["Computer Use","Concentration","Craft (Pharmaceutical)","Diplomacy","Drive","Knowledge (Behavioral Science)","Knowledge (Current Events)","Knowledge (Earth & Life Sciences)","Knowledge (Popular Culture)","Knowledge (Technology)","Listen","Pilot","Profession (Any)","Read/Write/Speak Language","Research","Spot","Treat Injury"],
  "Crusader": ["Concentration","Craft (Any)","Diplomacy","Handle Animal","Knowledge (Any)","Listen","Profession (Any)","Read/Write/Speak Language","Ride","Sense Motive","Treat Injury"],
  "Daredevil": ["Balance","Climb","Concentration","Demolitions","Drive","Escape Artist","Gamble","Intimidate","Jump","Knowledge (Current Events)","Knowledge (Popular Culture)","Perform (Act)","Pilot","Profession (Any)","Read/Write/Speak Language","Ride","Spot","Swim","Tumble"],
  "Dedicated Hero": ["Craft (Pharmaceutical)","Craft (Visual Arts)","Craft (Writing)","Gamble","Investigate","Knowledge (Arcane Lore)","Knowledge (Art)","Knowledge (Behavioral Sciences)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Earth & Life Sciences)","Knowledge (History)","Knowledge (Physical Sciences)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Tactics)","Knowledge (Technology)","Knowledge (Theology & Philosophy)","Listen","Profession (Any)","Read/Write/Speak Language","Sense Motive","Spot","Survival","Treat Injury (Wis)"],
  "Druid": ["Concentration","Craft (Any)","Diplomacy","Knowledge (Arcane Lore)","Knowledge (History)","Knowledge (Nature)","Knowledge (Religion)","Knowledge (The Planes)","Knowledge (Theology & Philosophy)","Profession (Any)","Spellcraft","Treat Injury"],
  "Ecclesiarch": ["Concentration","Craft (Any)","Diplomacy","Knowledge (Arcane Lore)","Knowledge (History)","Knowledge (Religion)","Knowledge (Theology & Philosophy)","Profession (Any)","Read/Write/Speak Language","Spellcraft","Treat Injury"],
  "Eldritch Knight": ["Concentration","Craft (Any)","Decipher Code","Diplomacy","Drive","Jump","Knowledge (Arcane Lore)","Knowledge (History)","Knowledge (Nobility & Royalty)","Knowledge (Religion)","Knowledge (Tactics)","Read/Write/Speak Language","Research","Ride","Sense Motive","Spellcraft","Swim"],
  "Elementalist": ["Bluff","Concentration","Craft (Any)","Diplomacy","Gather Information","Hide","Intimidate","Jump","Knowledge (Any)","Move Silently","Navigate","Profession (Any)","Read/Write/Speak Language","Sense Motive","Spellcraft","Survival","Swim"],
  "Elocater": ["Autohypnosis","Balance","Climb","Concentration","Craft (Any)","Disable Device","Escape Artist","Gather Information","Hide","Jump","Knowledge (Local)","Knowledge (Psionics)","Knowledge (Streetwise)","Listen","Move Silently","Perform (Any)","Profession (Any)","Psicraft","Read/Write/Speak Language","Search","Sense Motive","Sleight of Hand","Spot","Swim","Tumble","Use Psionic Device","Use Rope"],
  "Expert": "__expert_choose_any__",
  "Explorer": ["Balance","Bluff","Climb","Decipher Code","Disable Device","Drive","Gather Information","Handle Animal","Investigate","Jump","Knowledge (Any)","Listen","Navigate","Pilot","Profession (Any)","Read/Write/Speak Language","Research","Ride","Search","Sense Motive","Spot","Survival","Swim","Treat Injury"],
  "Fast Hero": ["Balance","Craft (Mechanical)","Drive","Escape Artist","Hide","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Move Silently","Pilot","Profession (Any)","Read/Write/Speak Language","Ride","Sleight of Hand","Tumble"],
  "Field Officer": ["Bluff","Computer Use","Diplomacy","Gather Information","Intimidate","Knowledge (Behavioural Science)","Knowledge (Civics)","Knowledge (History)","Knowledge (Physical Sciences)","Knowledge (Tactics)","Knowledge (Theology & Philosophy)","Read/Write/Speak Language","Search","Sense Motive"],
  "Fighter": ["Balance","Bluff","Climb","Craft (Any)","Drive","Handle Animal","Intimidate","Jump","Knowledge (Tactics)","Navigate","Pilot","Ride","Sense Motive","Swim","Tumble"],
  "Guildmember": ["Autohypnosis","Concentration","Craft (Any)","Decipher Code","Diplomacy","Gather Information","Knowledge (Any)","Psicraft","Read/Write/Speak Language","Research","Search","Spellcraft"],
  "Heavy": ["Climb","Drive","Intimidate","Jump","Knowledge (Technology)","Pilot","Read/Write/Speak Language","Repair"],
  "Holy Knight": ["Concentration","Craft (Any)","Decipher Code","Diplomacy","Drive","Jump","Knowledge (Arcane Lore)","Knowledge (History)","Knowledge (Nobility & Royalty)","Knowledge (Religion)","Knowledge (Tactics)","Read/Write/Speak Language","Research","Ride","Sense Motive","Spellcraft","Swim"],
  "Infiltrator": ["Balance","Bluff","Climb","Computer Use","Decipher Code","Disable Device","Disguise","Drive","Forgery","Gather Information","Hide","Jump","Knowledge (Art)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Streetwise)","Knowledge (Technology)","Listen","Move Silently","Perform (Act)","Read/Write/Speak Language","Search","Sleight of Hand","Spot","Tumble","Use Rope"],
  "Investigator": ["Bluff","Computer Use","Disable Device","Drive","Forgery","Gather Information","Intimidate","Investigate","Knowledge (Any)","Knowledge (Behavioural Sciences)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Streetwise)","Listen","Profession (Any)","Read/Write/Speak Language","Research","Search","Sense Motive","Spot"],
  "Loremaster": ["Appraise","Autohypnosis","Concentration","Craft (Chemical)","Decipher Code","Gather Information","Handle Animal","Knowledge (Any)","Navigate","Perform (Any)","Profession (Any)","Psicraft","Read/Write/Speak Language","Research","Spellcraft","Treat Injury","Use Magic Device","Use Psionic Device"],
  "Marketeer": ["Appraise","Bluff","Computer Use","Decipher Code","Diplomacy","Forgery","Gamble","Gather Information","Intimidate","Knowledge (Art)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Technology)","Profession (Any)","Read/Write/Speak Language","Repair","Research","Sense Motive"],
  "Martial Artist": ["Autohypnosis","Balance","Climb","Escape Artist","Hide","Intimidate","Jump","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Tactics)","Knowledge (Theology & Philosophy)","Move Silently","Perform (Dance)","Profession (Any)","Read/Write/Speak Language","Sense Motive","Spot","Tumble"],
  "Metamind": ["Autohypnosis","Concentration","Craft (Any)","Knowledge (Any)","Psicraft","Read/Write/Speak Language"],
  "Monk": ["Autohypnosis","Balance","Climb","Concentration","Craft (Any)","Diplomacy","Escape Artist","Hide","Jump","Knowledge (Arcane Lore)","Knowledge (Psionics)","Knowledge (Religion)","Knowledge (Theology & Philosophy)","Listen","Move Silently","Perform (Any)","Profession (Any)","Sense Motive","Spot","Swim","Tumble"],
  "Mystic Theurge": "__inherit_arcane_divine__",
  "Paladin": ["Concentration","Craft (Any)","Diplomacy","Handle Animal","Knowledge (Nobility And Royalty)","Knowledge (Religion)","Knowledge (Theology & Philosophy)","Profession (Any)","Ride","Sense Motive","Treat Injury"],
  "Personality": ["Bluff","Craft (Visual Arts)","Craft (Writing)","Diplomacy","Knowledge (Art)","Knowledge (Behavioral Sciences)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Popular Culture)","Perform (Act)","Perform (Dance)","Perform (Sing)","Perform (Stand-Up)","Profession (Any)","Read/Write/Speak Language"],
  "Planestrider": ["Balance","Climb","Concentration","Craft (Any)","Diplomacy","Gather Information","Hide","Knowledge (Any)","Listen","Move Silently","Navigate","Profession (Any)","Read/Write/Speak Language","Search","Sense Motive","Spellcraft","Spot","Survival","Swim"],
  "Psion": ["Autohypnosis","Balance","Bluff","Climb","Concentration","Craft (Any)","Diplomacy","Disable Device","Disguise","Gather Information","Intimidate","Jump","Knowledge (Any)","Listen","Navigate","Profession (Any)","Psicraft","Research","Ride","Sense Motive","Spot","Survival","Swim","Treat Injury","Use Psionic Device"],
  "Psychic Theurge": "__inherit_divine_psionic__",
  "Psychic Trickster": ["Appraise","Balance","Bluff","Climb","Concentration","Craft (Any)","Decipher Code","Diplomacy","Disable Device","Disguise","Escape Artist","Gamble","Gather Information","Hide","Jump","Knowledge (Any)","Listen","Move Silently","Profession (Any)","Psicraft","Read/Write/Speak Language","Search","Sense Motive","Sleight of Hand","Spellcraft","Spot","Swim","Tumble","Use Magic Device","Use Psionic Device","Use Rope"],
  "Ranger": ["Balance","Climb","Concentration","Craft (Any)","Drive","Handle Animal","Hide","Jump","Knowledge (Dungeoneering)","Knowledge (Geography)","Knowledge (Nature)","Listen","Move Silently","Navigate","Pilot","Profession (Any)","Ride","Search","Spot","Survival","Swim","Treat Injury","Tumble","Use Rope"],
  "Rogue": ["Appraise","Balance","Bluff","Climb","Craft (Any)","Decipher Code","Diplomacy","Disable Device","Disguise","Escape Artist","Forgery","Gamble","Gather Information","Hide","Intimidate","Jump","Knowledge (Local)","Knowledge (Streetwise)","Listen","Move Silently","Perform (Any)","Profession (Any)","Search","Sense Motive","Sleight of Hand","Spot","Swim","Tumble","Use Magic Device","Use Psionic Device","Use Rope"],
  "Saint": ["Concentration","Craft (Any)","Diplomacy","Knowledge (Religion)","Knowledge (The Planes)","Knowledge (Theology & Philosophy)","Profession (Any)","Sense Motive","Spellcraft","Treat Injury"],
  "Shadowjack": ["Computer Use","Craft (Electronics)","Craft (Mechanical)","Craft (Writing)","Decipher Code","Disable Device","Forgery","Gamble","Gather Information","Intimidate","Knowledge (Current Events)","Knowledge (History)","Knowledge (Popular Culture)","Knowledge (Technology)","Profession (Any)","Read/Write/Speak Language","Repair","Research","Search"],
  "Sharpshooter": ["Balance","Bluff","Demolitions","Drive","Escape Artist","Gamble","Intimidate","Knowledge (Current Affairs)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Move Silently","Profession (Any)","Read/Write/Speak Language","Ride","Sleight of Hand","Spot","Survival","Tumble","Use Rope"],
  "Smart Hero": ["Appraise","Computer Use","Craft (Armorsmithing)","Craft (Bowmaking)","Craft (Chemical)","Craft (Electronics)","Craft (Mechanical)","Craft (Pharmaceutical)","Craft (Structural)","Craft (Trapmaking)","Craft (Visual Arts)","Craft (Weaponsmithing)","Craft (Writing)","Decipher Code","Demolitions","Disable Device","Forgery","Investigate","Knowledge (Arcane Lore)","Knowledge (Architecture & Engineering)","Knowledge (Art)","Knowledge (Behavioral Sciences)","Knowledge (Business)","Knowledge (Civics)","Knowledge (Current Events)","Knowledge (Dungeoneering)","Knowledge (Earth & Life Sciences)","Knowledge (Geography)","Knowledge (History)","Knowledge (Local)","Knowledge (Nature)","Knowledge (Nobility & Royalty)","Knowledge (Physical Sciences)","Knowledge (Popular Culture)","Knowledge (Psionics)","Knowledge (Religion)","Knowledge (Streetwise)","Knowledge (Tactics)","Knowledge (Technology)","Knowledge (The Planes)","Knowledge (Theology & Philosophy)","Navigate","Profession (Any)","Read/Write/Speak Language","Repair","Research","Search (Int)"],
  "Soldier": ["Autohypnosis","Balance","Climb","Escape Artist","Hide","Intimidate","Jump","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Tactics)","Knowledge (Theology & Philosophy)","Move Silently","Perform (Dance)","Profession (Any)","Read/Write/Speak Language","Sense Motive","Spot","Tumble"],
  "Sorcerer": ["Bluff","Concentration","Craft (Any)","Knowledge (Arcane Lore)","Profession (Any)","Spellcraft"],
  "Soulstalker": ["Autohypnosis","Balance","Climb","Concentration","Hide","Jump","Knowledge (Psionics)","Knowledge (Streetwise)","Listen","Move Silently","Profession (Any)","Read/Write/Speak Language","Search","Sense Motive","Spot","Survival","Swim","Tumble"],
  "Splice": ["Balance","Climb","Computer Use","Craft (Any)","Diplomacy","Drive","Hide","Jump","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Technology)","Listen","Move Silently","Navigate","Pilot","Profession (Any)","Read/Write/Speak Language","Ride","Search","Spot","Survival","Swim","Tumble"],
  "Strong Hero": ["Climb","Craft (Structural)","Handle Animal","Jump","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Knowledge (Tactics)","Profession (Any)","Read/Write/Speak Language","Repair","Swim"],
  "Super-Hero": "__all_skills_class__",
  "Super-Villain": "__all_skills_class__",
  "Survivor": ["Balance","Bluff","Climb","Diplomacy","Disguise","Escape Artist","Gamble","Gather Information","Hide","Jump","Knowledge (Nature & Life Sciences)","Knowledge (Physical Sciences)","Knowledge (Streetwise)","Knowledge (Tactics)","Listen","Move Silently","Read/Write/Speak Language","Repair","Search","Sense Motive","Spot","Survival","Swim","Treat Injury"],
  "Tactician": ["Appraise","Computer Use","Craft (Any)","Decipher Code","Demolitions","Diplomacy","Disable Device","Drive","Forgery","Gather Information","Investigate","Knowledge (Behavioral Sciences)","Knowledge (Earth & Life Sciences)","Knowledge (Physical Sciences)","Knowledge (Technology)","Navigate","Pilot","Profession (Any)","Read/Write/Speak Language","Research","Search","Sense Motive","Use Rope"],
  "Technomage": ["Computer Use","Concentration","Craft (Chemical)","Craft (Electronics)","Craft (Mechanical)","Craft (Structural)","Decipher Code","Demolitions","Disable Device","Drive","Investigate","Knowledge (Arcane Lore)","Knowledge (Art)","Knowledge (Current Events)","Knowledge (History)","Knowledge (Popular Culture)","Knowledge (Psionics)","Knowledge (Streetwise)","Knowledge (Technology)","Navigate","Pilot","Psicraft","Read/Write/Speak Language","Repair","Research","Spellcraft","Use Magic Device","Use Psionic Device"],
  "Technopath": ["Computer Use","Concentration","Craft (Chemical)","Craft (Electronics)","Craft (Mechanical)","Craft (Structural)","Decipher Code","Demolitions","Disable Device","Drive","Investigate","Knowledge (Arcane Lore)","Knowledge (Art)","Knowledge (Current Events)","Knowledge (History)","Knowledge (Popular Culture)","Knowledge (Psionics)","Knowledge (Streetwise)","Knowledge (Technology)","Navigate","Pilot","Psicraft","Read/Write/Speak Language","Repair","Research","Spellcraft","Use Magic Device","Use Psionic Device"],
  "Techsmith": ["Computer Use","Craft (Armorsmithing)","Craft (Bowmaking)","Craft (Electronics)","Craft (Mechanical)","Craft (Structural)","Disable Device","Drive","Knowledge (Physical Sciences)","Knowledge (Technology)","Navigate","Pilot","Profession (Any)","Read/Write/Speak Language","Research","Search","Use Rope"],
  "Tough Hero": ["Climb","Concentration","Craft (Mechanical)","Craft (Structural)","Drive","Intimidate","Knowledge (Current Events)","Knowledge (Popular Culture)","Knowledge (Streetwise)","Profession (Any)","Read/Write/Speak Language","Ride","Spot","Survival"],
  "Warmind": ["Autohypnosis","Balance","Bluff","Climb","Concentration","Craft (Any)","Drive","Intimidate","Jump","Knowledge (Psionics)","Knowledge (Tactics)","Profession (Any)","Ride","Search","Sense Motive","Swim","Tumble"],
  "Weaponmaster": ["Balance","Bluff","Climb","Craft (Bowmaking)","Craft (Mechanical)","Craft (Structural)","Craft (Visual Arts)","Craft (Weaponsmithing)","Craft (Writing)","Handle Animal","Jump","Knowledge (Art)","Knowledge (History)","Knowledge (Tactics)","Knowledge (Theology & Philosophy)","Profession (Any)","Research","Ride","Sense Motive","Swim","Tumble"],
  "Wilder": ["Autohypnosis","Balance","Bluff","Climb","Concentration","Craft (Any)","Escape Artist","Intimidate","Jump","Knowledge (Psionics)","Listen","Profession (Any)","Psicraft","Sense Motive","Spot","Swim","Tumble"],
  "Wizard": ["Concentration","Craft (Any)","Decipher Code","Knowledge (Any)","Profession (Any)","Spellcraft"],
};

// v8.91.0 (Adam's Adventurer playtest — "Demolitions not recognizing as a
// class skill"): the occupation skill_list spellings drift from the skill
// catalog in THIRTY-TWO places ("Demolition", "Earth and Life Sciences",
// "Behavioural", "Electronic", "Nobility", "Keyboards", two Language
// spellings…) — every one of them a silently dead class-skill pick. All
// occupation picks now match through this canonicalizer. "Alchemy" maps to
// Chemical: the HH Craft skill's own category list carries no alchemy — an
// SRD vestige like "Heal" (book letter on TODO).
const SKILL_NAME_ALIASES = {
  'demolition': 'Demolitions',
  'knowledge: any': 'Knowledge (Any)',
  'read/write language': 'Read/Write/Speak Language',
  'speak language': 'Read/Write/Speak Language',
};
const SKILL_SUB_ALIASES = {
  'earth and life sciences': 'Earth & Life Sciences',
  'earth / life sciences': 'Earth & Life Sciences',
  'behavioural sciences': 'Behavioral Sciences',
  'behavioural science': 'Behavioral Sciences',
  'electronic': 'Electronics',
  'visual art': 'Visual Arts',
  'nobility': 'Nobility & Royalty',
  'current affairs': 'Current Events',
  'architecture': 'Architecture & Engineering',
  'theology and philosophy': 'Theology & Philosophy',
  'keyboards': 'Keyboard Instruments',
  'percussion': 'Percussion Instruments',
  'stringed': 'String Instruments',
  'wind': 'Wind Instruments',
  'stand-up': 'Comedy',
  'alchemy': 'Chemical',
};
const COLLAPSIBLE_FAMILIES = ['Craft','Knowledge','Perform','Profession'];
