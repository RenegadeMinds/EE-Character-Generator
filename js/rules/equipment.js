// =============================================================================
// js/rules/equipment.js
// EQUIPMENT — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Items a character owns: catalog lookups, equipped and worn gear,
//   weapon and armor rules, toolkits, proficiencies and armor check
//   penalties.
//
// KEY NAMES (so you can search for them)
//   functions (36): getCharItems, getCatalogueEntry, isRangedWeapon,
//   isFinesseEligible, finesseShieldACP, buildItemBonuses, equipParamSub,
//   toolkitSatisfaction, ownsSatisfyingToolkit, computeEquippedArmorShield,
//   wearingArmorCategory, virtualTwfFeats, twfStatus, effectiveRoF,
//   effectiveRangeIncrement, effectiveMagazine, parseMaxDex, armorMaxDexCap,
//   weaponRangeRule, gearDef, gearBoonOf, gearBoonPush, wornGearOf,
//   weaponHands, twoHandedEquipped, itemDisplayName, _normWeaponName,
//   charProficiencyGrants, proficiencyPseudoFeats, reconcileGrantedFeats,
//   isProficientWithWeapon, isProficientWithArmor, parseArmorCheckPenalty,
//   equippedACPPieces, buildArmorCheckPenaltyBonuses,
//   nonProficientArmorPenalty
//
// WHERE IT CAME FROM
//   Gathered from js/app/62-power-suites-feats-page-proficiencies.js,
//   js/rules/09-item-effects-and-buffs.js, js/rules/12-wealth-and-prices.js,
//   js/rules/13-armor-integrity-and-enchanting.js, js/rules/14-resistances-
//   speed-dr-size.js, js/rules/16-worn-and-active-gear.js,
//   js/rules/18-companions.js when the code was regrouped by topic and page.
//   Each function and table moved whole and unchanged, with the comments
//   above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

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
function isRangedWeapon(w) { return w.kind === 'ranged' || w.firearm === true; }
function isFinesseEligible(w) { return w.kind === 'light' || WEAPON_FINESSE_NAMED_EXCEPTIONS.has(w.name); }
// v9.7.0 (§257): the feat's shield rider — the equipped shield's armor check
// penalty (0 when no shield, or ACP 0). Applies only to FINESSED attacks.
function finesseShieldACP(c) {
  let acp = 0;
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const d = getCatalogueEntry('armor', it.ref);
    if (d && d.type === 'shield') acp += (parseArmorCheckPenalty(d) || 0);
  }
  return acp;  // ≤ 0
}

// v8.5.2: item-derived bonus contributions — tool-kit ownership (no equip
// gate; Adam's ruling 2026-06-29: owning is sufficient) + equipped-gadget
// skill bonuses. Same {target:[{type,source,value,condition,label}]} shape as
// buildFeatBonuses/buildTalentBonuses, merged the same way in
// computeSkillMiscBonuses above. Non-skill targets (armor/weapon) are read
// directly by computeEquippedArmorShield / computeEquippedWeaponSummaries
// below rather than round-tripped through this generic map, since those
// stats aren't otherwise aggregated through a typed-target pipeline yet.
function buildItemBonuses(c) {
  const out = {};
  const push = (target, entry) => { (out[target] = out[target] || []).push(entry); };
  for (const it of getCharItems(c)) {
    if (it.catalogue === 'equipment') {
      // v9.1.0 (the HH Ch.VII catalogue, Adam's equipment review 2026-10-06):
      // effects are data — effect.grants[] = {t:'skill:X'|'fort'|'ref'|'will',
      // v, type, cond?}. Every target is a REAL lane key (the v9.0.x audit
      // found 8 kits keyed 'Repair (electrical)' / 'Craft' / 'Perform' that
      // reached no Sheet row). '$param' resolves to the item's chosen skill
      // (masterwork tool / instrument); an unchosen param grants nothing.
      // Zero-value conditional grants are pure ⚜ notes (binoculars, the
      // evidence kit's collect-evidence clause).
      const def = getCatalogueEntry('equipment', it.ref);
      const eff = def && def.effect;
      const lbl = it.param ? `${it.ref} (${it.param})` : it.ref;
      for (const gr of ((eff && eff.grants) || [])) {
        const tgt = equipParamSub(gr.t, it);
        if (!tgt || tgt.includes('$')) continue;
        push(tgt, { type: gr.type || 'equipment', source: `item:${it.ref}`, value: gr.v, condition: gr.cond ? equipParamSub(gr.cond, it) : null, label: lbl });
      }
      // v9.3.0: an upgraded computer's +1 equipment on Computer Use.
      if (it.upgraded && def && def.upgrade) for (const gr of def.upgrade.grants) push(gr.t, { type: gr.type, source: `item:${it.ref}:upgrade`, value: gr.v, condition: null, label: `${it.ref} (upgraded)` });
      // v9.2.0: WORN gear (equipped in its body slot) adds its worn grants —
      // night vision goggles' −4 Spot/Search ride only while they're on.
      if (it.equipped && def && def.worn) for (const gr of (def.worn.grants || [])) {
        push(gr.t, { type: gr.type || 'equipment', source: `item:${it.ref}:worn`, value: gr.v, condition: gr.cond || null, label: `${it.ref} (worn)` });
      }
      // Mastercraft on a tool/skill kit: additional equipment bonus to each
      // skill it grants unconditionally (or, for a pure kit, each skill it
      // satisfies) — the Techsmith's upgrade path.
      if (it.mastercraft && it.mastercraft.bonus && eff) {
        const mcT = new Set(((eff.grants || []).filter(g => !g.cond && g.v && String(g.t).startsWith('skill:')).map(g => equipParamSub(g.t, it).slice(6)))
          .concat(!(eff.grants || []).length ? (eff.satisfies || []).map(x => equipParamSub(x, it)) : []));
        for (const sk of mcT) if (!sk.includes('$')) push('skill:' + sk, { type: 'equipment', source: `item:${it.ref}:mastercraft`, value: it.mastercraft.bonus, condition: null, label: `${lbl} (mastercraft +${it.mastercraft.bonus})` });
      }
    }
    if (it.equipped) {
      for (const g of (it.gadgets || [])) {
        const gd = GADGETS_CATALOG.find(x => x.name === g.ref && x.type === it.catalogue);
        if (!gd || !gd.effect || gd.effect.kind !== 'bonus') continue;
        for (const contrib of (gd.effect.contributions || [])) {
          if (contrib.kind === 'skillBonus' && typeof contrib.amount === 'number') {
            // Gated contributions (situational OR requires, e.g. HUD Vehicle's
            // "requires a linked vehicle") are NOT auto-applied — surfaced as
            // a conditional note only, same treatment as conditional synergies.
            const gate = contrib.situational || contrib.requires || null;
            for (const sk of String(contrib.target).split('|')) {
              push('skill:' + sk, { type: contrib.stack || 'equipment', source: `gadget:${g.ref}`, value: contrib.amount, condition: gate, label: g.ref });
            }
          }
        }
        // Chameleonic Surface: Hide bonus keyed to the equipped armor's class.
        if (gd.name === 'Chameleonic Surface' && it.catalogue === 'armor') {
          const armorDef = getCatalogueEntry('armor', it.ref);
          const byClass = { light: 4, medium: 6, heavy: 10, power: 10, shield: 4 };
          const amt = armorDef ? (byClass[armorDef.type] || 4) : 4;
          push('skill:Hide', { type: 'circumstance', source: `gadget:${g.ref}`, value: amt, condition: null, label: g.ref });
        }
      }
    }
  }
  return out;
}
// v9.1.0: TOOLKIT_SATISFIERS above is superseded by data — each equipment
// entry's effect.satisfies[] names the exact skill rows it equips you for
// (per-Craft now: the deluxe electrical kit satisfies Craft (Electronics),
// Artisan's tools the non-technical Crafts, the Chemical kit / Alchemist's
// lab Craft (Chemical)…). effect.partial = a minimally-sufficient tool (the
// Multipurpose tool: Repair at −2 instead of −4, Adam 2026-10-06).
function equipParamSub(str, it) {
  if (typeof str !== 'string' || !str.includes('$param')) return str;
  if (!it || !it.param) return str;
  const inner = (it.param.match(/\(([^)]+)\)/) || [, it.param])[1].toLowerCase();
  return str.replace(/\$paramtype/g, inner).replace(/\$param/g, it.param);
}
function toolkitSatisfaction(c, sk) {
  let full = false, partial = null; const by = [];
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'equipment') continue;
    const def = getCatalogueEntry('equipment', it.ref);
    const eff = def && def.effect; if (!eff || !eff.satisfies) continue;
    if (!eff.satisfies.map(x => equipParamSub(x, it)).includes(sk.n)) continue;
    if (eff.partial) { partial = partial == null ? eff.partial : Math.max(partial, eff.partial); by.push(`${it.ref} (at ${eff.partial})`); }
    else { full = true; by.push(it.param ? `${it.ref} (${it.param})` : it.ref); }
  }
  return { full, partial, by };
}
function ownsSatisfyingToolkit(c, sk) { return toolkitSatisfaction(c, sk).full; }

// v8.5.2: equipped armor/shield item -> {armor, shield} equipment-bonus pair.
// Preferred by computeACDisplay over the manual c.armorAC/c.shieldAC fields,
// which remain the fallback for homebrew gear not in the catalogue (or a
// character with nothing equipped from it). Mastercraft on an armor-kind item
// adds directly to its bonus (armor's single mastercraft feature always
// targets Defense per MASTERCRAFT_RULES.targets_by_kind.armor).
function computeEquippedArmorShield(c) {
  let armor = null, shield = null;
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def) continue;
    // v8.6.1 (Adam's better-bonus ruling): a magic enhancement bonus and the
    // mastercraft bonus do NOT stack — the better one applies. v8.8.0
    // (Adam's amendment): armor mastercraft now chooses Defense OR mobility;
    // a mobility-targeted mastercraft adds nothing here (it raises the max
    // Dex cap instead — see armorMaxDexCap) and is never superseded by
    // enchantment, which makes the choice a real strategic fork.
    const mcT = it.mastercraft && it.mastercraft.target;
    const mc = (it.mastercraft && mcT !== 'mobility' && it.mastercraft.bonus) || 0;
    const enh = (it.enchant && it.enchant.enh) || 0;
    // v8.13.0 (Adam's T/ACtical armor pass): a BROKEN or DESTROYED item (HH
    // p.383: armor at 0 HP "no longer offers any armor bonus to AC, although
    // it still has any armor penalty") contributes nothing here — ACP, max
    // Dex, and speed limits still derive from the worn def elsewhere.
    const _integ = armorItemIntegrity(it);
    if (_integ && (_integ.broken || _integ.destroyed)) continue;
    const bonus = def.ac_bonus + Math.max(mc, enh);
    if (def.type === 'shield') shield = (shield || 0) + bonus;
    else {
      armor = (armor || 0) + bonus;
      // v8.14.x Segment B: a power armor's tactical-shield SYSTEM (Bulwark
      // +2 / Bastion +4 / Barricade +6, best undamaged one) adds shield AC.
      const paSh = (POWER_ARMOR_DB[it.ref]) ? paShieldBonus(it) : 0;
      if (paSh) shield = (shield || 0) + paSh;
    }
  }
  // v8.14.x Segment B: an ACTIVE Second Skin behaves as armor (HH p.241 —
  // its AC bonus doesn't stack with other armor; manifesting requires bare
  // armor anyway). Applies while the skin has hit points left.
  const _sk = activeSecondSkin(c);
  if (_sk && !_sk.destroyed && armor == null) armor = _sk.row.ac;
  return { armor, shield };
}


// v8.5.2: per-equipped-weapon resolved attack/damage summary. Folds in the
// proficiency advisory (-4 if not proficient, via the existing
// isProficientWithWeapon), the weapon's mastercraft bonus (exclusive choice
// of attack OR damage per HH p.275), equipped attack-bonus gadgets, and the
// damage label/resistances via the inlined DamageResolver — reusing the
// damage-typing substrate this catalogue was built on top of.
// v8.6.1 Two-Weapon Fighting status (Adam, 2026-09-01 — the TWF pass). Active
// when a weapon is equipped in EACH hand (a shield in the off hand is not
// two-weapon fighting). Penalties per HH p.244 (Normal: −6 primary / −10
// off hand; light off-hand weapon — unarmed always counts light — reduces
// both by 2; the TWF feat lessens primary by 2 and off hand by 6), plus the
// HH mixed-hands rule (melee in one hand + ranged in the other: −4 on those
// attacks, reduced to −2 by Improved TWF, removed by Advanced TWF). Extra
// off-hand attacks: 1 base, 2nd at −5 with Improved, 3rd at −10 with
// Greater or Advanced. All DERIVED from equipped state — firm-wire door.
// NOT auto-applied (advisory notes only): Ranger combat-style / Monk Flurry
// virtual TWF (conditional on armor/unarmed — GM domain), and Two-Weapon
// Defense's +1 shield AC (surfaced as a note, not folded into AC).
// Heaviest equipped armor category (shields excluded), or null if unarmored.
// Drives the Ranger combat-style armor gate ("light or no armor") and the
// Monk Flurry gate ("unarmored") — both derived live from the equipped flag.
function wearingArmorCategory(c) {
  let worst = null;
  const RANK = { light: 1, medium: 2, heavy: 3, power: 4 };
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def || def.type === 'shield') continue;
    if (!worst || (RANK[def.type] || 0) > (RANK[worst] || 0)) worst = def.type;
  }
  return worst;
}

// v8.6.1 (Adam's ruling, 2026-09-01): the Ranger's Combat Style (chosen at
// 2nd level; c.rangerCombatStyle, lazy field set on the Gear combat panel)
// grants VIRTUAL feats per the feats' Special lines — both chains, both
// gated LIVE on wearing light or no armor:
//   two-weapon: TWF (2nd) · Improved TWF (6th) · Greater TWF (11th)
//   archery:    Rapid Shot (2nd) · Manyshot (6th) · Improved Precise Shot (11th)
// Rapid Shot presents as a computed alt mode on ranged weapon rows (the
// ranged mirror of Flurry of Blows — Adam's parity call); Manyshot and
// Improved Precise Shot surface as notes (bow-specific / miss-chance rules
// the engine doesn't roll).
function virtualTwfFeats(c) {
  const out = new Set();
  const rangerLvl = migrateLegacyClasses(c || {}).filter(e => e.name === 'Ranger').reduce((s, e) => s + (e.level || 0), 0);
  if (rangerLvl >= 2 && c) {
    const cat = wearingArmorCategory(c);
    if (!cat || cat === 'light') {
      if (c.rangerCombatStyle === 'twf') {
        out.add('Two-Weapon Fighting');
        if (rangerLvl >= 6) out.add('Improved Two-Weapon Fighting');
        if (rangerLvl >= 11) out.add('Greater Two-Weapon Fighting');
      } else if (c.rangerCombatStyle === 'archery') {
        out.add('Rapid Shot');
        if (rangerLvl >= 6) out.add('Manyshot');
        if (rangerLvl >= 11) out.add('Improved Precise Shot');
      }
    }
  }
  return out;
}

function twfStatus(c) {
  const held = getCharItems(c).filter(it => it.catalogue === 'weapon' && it.equipped
    && (it.slot === 'main_hand' || it.slot === 'off_hand'));
  const mainW = held.find(i => i.slot === 'main_hand');
  const offW = held.find(i => i.slot === 'off_hand');
  if (!mainW || !offW) return null;
  const mainDef = getCatalogueEntry('weapon', mainW.ref);
  const offDef = getCatalogueEntry('weapon', offW.ref);
  if (!mainDef || !offDef) return null;
  const virtuals = virtualTwfFeats(c);
  const ownsF = (n) => (c.feats || []).some(f => (f.name || f.n) === n) || virtuals.has(n);
  const offLight = offDef.kind === 'light' || offDef.kind === 'unarmed';
  const hasTWF = ownsF('Two-Weapon Fighting');
  const hasITWF = ownsF('Improved Two-Weapon Fighting');
  const hasGTWF = ownsF('Greater Two-Weapon Fighting') || ownsF('Advanced Two-Weapon Fighting');
  const hasATWF = ownsF('Advanced Two-Weapon Fighting');
  let pri = -6, off = -10;
  if (offLight) { pri += 2; off += 2; }
  if (hasTWF) { pri += 2; off += 6; }
  let mixed = 0;
  if (isRangedWeapon(mainDef) !== isRangedWeapon(offDef)) mixed = hasATWF ? 0 : (hasITWF ? -2 : -4);
  return {
    pri, off, mixed, offLight, hasTWF, hasITWF, hasGTWF,
    offAttacks: 1 + (hasITWF ? 1 : 0) + (hasGTWF ? 1 : 0),
    hasTwoWeaponDefense: ownsF('Two-Weapon Defense'),
    virtualRanger: virtuals.size > 0,
    mainName: mainW.ref, offName: offW.ref,
  };
}

// v8.6.1 (Adam, 2026-09-01): compact HH weapon-statistics strip — crit
// threat/multiplier (normalized: "x3" → "20/×3", bare "20" → "20/×2"),
// range increment (leading token of the catalogue's tail field), Rate of
// Fire (S = semiautomatic, A = automatic), and magazine capacity. Rides
// under the weapon name on the Gear combat dashboard and the print sheet.
// v8.6.1 (Adam's Autofire Module adjudication): a weapon's EFFECTIVE Rate of
// Fire adds 'A' while an Autofire Module gadget is attached — derived live
// from the gadget, never written to the catalogue. Everything RoF-gated
// (Burst Fire alt mode, the Autofire spray, the stat strip) reads this.
function effectiveRoF(it, def) {
  const rof = ((def && def.rof) || []).slice();
  if (it && (it.gadgets || []).some(g => g.ref === 'Autofire Module') && !rof.includes('A')) rof.push('A');
  return rof;
}
// Scope, Rangefinding Laser: range increment ×1.5.
function effectiveRangeIncrement(it, def) {
  const m = /^(\d+)[’']/.exec((def && def.tail) || '');
  if (!m) return null;
  const base = parseInt(m[1], 10);
  return hasScope(it) ? Math.round(base * 1.5) : base;   // v9.3.0: any scope — gadget or mounted, never stacked
}
// Expanded Magazine: doubles capacity (once per weapon).
function effectiveMagazine(it, def) {
  const cap = (def && def.magazine_capacity) || null;
  if (!cap) return null;
  return hasGadget(it, 'Expanded Magazine') ? cap * 2 : cap;
}

// v8.8.0 (Adam): armor mobility penalties go mechanical. Each armor lists a
// maximum Dex bonus (the armor's limited mobility caps what Dex can add to
// AC) and a speed line ("30’/20’" — the wearer's speed for base-30 / base-20
// characters). Morphic Metal Alloy raises max Dex +1 (data-driven from its
// maxDexBonus contribution); Ultralight Composition eases speed +5 ft, up
// to normal.
function parseMaxDex(v) {
  const m = /([+-]?\d+)/.exec(String(v || ''));
  return m ? parseInt(m[1], 10) : null;
}
// The character's max-Dex cap from equipped body armor (shields impose
// none in the catalogue data). Returns null = uncapped.
function armorMaxDexCap(c) {
  let cap = null;
  // v8.8.0: Festering Sores (HH p.416) — any worn armor's max Dex drops 2.
  const sores = (c && c.mutations || []).some(m => m.name === 'Festering Sores');
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'armor' || !it.equipped) continue;
    const def = getCatalogueEntry('armor', it.ref);
    if (!def || def.type === 'shield') continue;
    let md = parseMaxDex(def.max_dex);
    if (md == null) continue;
    for (const gg of (it.gadgets || [])) {
      const gdef = GADGETS_CATALOG.find(x => x.name === gg.ref && x.type === 'armor');
      for (const contrib of ((gdef && gdef.effect && gdef.effect.contributions) || [])) {
        if (contrib.kind === 'maxDexBonus' && typeof contrib.amount === 'number') md += contrib.amount;
      }
    }
    // v8.8.0 (Adam's amendment): mobility-targeted mastercraft raises the
    // armor's max Dex bonus by the mastercraft bonus.
    if (it.mastercraft && it.mastercraft.target === 'mobility') md += it.mastercraft.bonus || 0;
    if (sores) md -= 2;
    cap = (cap == null) ? md : Math.min(cap, md);
  }
  return cap;
}

// v8.6.1 (Adam, 2026-09-01): the range-increment rule as a pop-up note —
// cumulative −2 to hit per increment beyond the first; THROWN weapons reach
// 5 increments (−8 at the limit), projectile weapons 10 (−18 at the limit).
// Thrown = melee-kind weapons with a range (thrown use), non-firearm hand
// explosives (grenades, dynamite), and the named thrown-ranged family;
// anything with a trigger, string, or sling is projectile.
function weaponRangeRule(def, it) {
  if (!def) return null;
  const inc = effectiveRangeIncrement(it, def);
  if (inc == null) return null;
  const THROWN_RANGED = new Set(['Dart', 'Javelin', 'Bolas', 'Net', 'Shuriken']);
  const thrown = THROWN_RANGED.has(def.n)
    || (def.kind !== 'ranged' && !def.firearm && !(def.rof || []).length && !/launcher|taser/i.test(def.n || ''));
  const maxInc = thrown ? 5 : 10;
  return `Range increment ${inc}′ — cumulative −2 to hit for each increment beyond the first. ${thrown ? 'Thrown' : 'Projectile'} weapon: maximum ${maxInc} increments (${(inc * maxInc).toLocaleString()}′), −${(maxInc - 1) * 2} to hit at that limit.`;
}

// ============================================================================
// v9.2.0 — WORN & ACTIVE GEAR (Adam's equipment review, 2026-10-06).
//   def.slot  → wearable in that body slot (new Back slot; Belt/Eyes/Vest):
//               competes with magic items for the same capacity.
//   def.worn  → {carry, grants[], sense, immune[]} while equipped.
//   def.active→ ⚡ Activate pushes a GEAR Boon onto c.activeEffects (same
//               banner + ✕ as powers). Gear is TECHNOLOGY: Boons from gear
//               stand through a Null Power Field (a.gear passes the NPF gate).
//   def.use   → consumables: qty + Use; Boost's Bane rolls when it ends.
// ============================================================================
function gearDef(it) { return (it && it.catalogue === 'equipment') ? getCatalogueEntry('equipment', it.ref) : null; }
function gearBoonOf(c, it) { return (c.activeEffects || []).find(a => a.gearItemId === it.id) || null; }
function gearBoonPush(c, rec) {
  if (!Array.isArray(c.activeEffects)) c.activeEffects = [];
  c.activeEffects.push(Object.assign({ id: 'ae-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pool: 'gear', gear: true, expires: 'manual', appliedAt: new Date().toLocaleString() }, rec));
}
function wornGearOf(c) { return getCharItems(c).filter(it => it.equipped && gearDef(it) && gearDef(it).worn); }
function weaponHands(def) {
  if (!def || def.category !== 'weapon') return 1;
  if (def.kind === 'two-handed') return 2;
  if (def.kind === 'ranged' || def.firearm) {
    if (ONE_HANDED_RANGED.has(def.n) || /pistol|derringer|revolver/i.test(def.n)) return 1;
    return 2;
  }
  return 1;
}
// The equipped held two-handed weapon claiming the off hand, if any.
function twoHandedEquipped(c) {
  for (const it of getCharItems(c)) {
    if (it.catalogue !== 'weapon' || !it.equipped) continue;
    const slotDef = ITEM_SLOTS.find(s => s.id === it.slot);
    if (!slotDef || slotDef.category !== 'held') continue;
    const def = getCatalogueEntry('weapon', it.ref);
    if (def && weaponHands(def) === 2) return it;
    // v8.60.0 (Adam): a one-handed melee weapon held in a TWO-HANDED GRIP
    // claims the off hand exactly like a true two-hander.
    if (def && it.twoHandedGrip && def.kind === 'one-handed' && !isRangedWeapon(def)) return it;
  }
  return null;
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

