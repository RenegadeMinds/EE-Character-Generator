// =============================================================================
// js/ui/vehicles/starships.js
// VEHICLES / STARSHIPS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Vehicles page: the starship builder and starship
//   cards.
//
// KEY NAMES (so you can search for them)
//   functions (7): shipMountChip, shipLinkChip, shipBatteryChip,
//   openStarshipBuilder, shipIncomingHit, shipRepair, renderStarshipCards
//
// WHERE IT CAME FROM
//   Gathered from js/app/60-starships.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// The chip a restricted mount wears on its loadout row and the print sheet (arcs by initial: F/S/P/A).
function shipMountChip(line) {
  const m = shipMountOf(line);
  return m.kind === 'turret' ? '' : `${m.icon} ${m.kind} ${m.arcs.map(a => a[0]).join('/')} (${m.disc} DC)`;
}
// The chips a linked weapon / battery wears beside the mount chip.
function shipLinkChip(line) {
  const link = shipLinkOf(line);
  if (link < 2) return '';
  return link >= 8 ? `★ main cannon ×${link}` : `⛓ ×${link} link${line.variable ? ' (variable)' : ''}`;
}
function shipBatteryChip(line) {
  const n = shipBatteryOf(line);
  return n < 2 ? '' : `⧉ battery ×${n}`;
}
async function openStarshipBuilder() {
  const c = chars.find(x => x.id === curId); if (!c) { toast('Select a hero first.'); return; }
  const sub = await new Promise(res => openChoiceModal('Starship — subtype (FF pp.664-683; base DC includes hull + trained crew)',
    Object.keys(STARSHIP_SUBTYPES).map(n => { const s = STARSHIP_SUBTYPES[n]; return `${n} — ${s.cls}, ${s.D}D (${s.D * 20} HP), crew ${s.crew}, DC ${s.dc}`; }), res));
  if (!sub) return;
  const subName = sub.split(' — ')[0];
  const eng = await new Promise(res => openChoiceModal('Primary engine (thrusters always included; the listed figure IS the ship\'s total tactical speed per move action — Adam\'s ruling 2026-09-04)',
    STARSHIP_ENGINES.map(e => `${e.name} (TS ${e.ts}) — ${e.bonus}, min ${e.minSize}, DC ${e.dc}`), res));
  if (!eng) return;
  const ar = await new Promise(res => openChoiceModal('Armor (hardness for every section)',
    STARSHIP_ARMOR.map(a => `${a.name} (TS ${a.ts}) — ${a.hardness}${a.speedPen !== '—' ? ', ' + a.speedPen : ''}, ${a.restriction}`), res));
  if (!ar) return;
  const nm = await textModal('Name the vessel', 'e.g. "ESS Boxcars". Sections, crew stations, and systems live on its card.', '');
  if (nm === null) return;
  const ship = { name: (nm || subName).trim(), subtype: subName, engine: eng.split(' (')[0], armor: ar.split(' (')[0] };
  const sdef = STARSHIP_SUBTYPES[subName];
  const techScale = scenarioTechScale(c);
  const priceUnits = dollarsForDC(marketAdjustedDC(sdef.dc, sdef.ts, techScale));
  const provenance = await promptProvenance(c, ship.name, priceUnits);
  if (provenance === null) return;
  if (!c.items) c.items = [];
  const item = { id: 'item_' + Math.random().toString(36).slice(2, 10), catalogue: 'starship', ref: subName, customName: ship.name, ship, slot: 'carried', equipped: false, mastercraft: null, gadgets: [] };
  if (provenance) item.provenance = provenance;
  item.paLoadout = [
    { slot: 'Engines', gear: 'Thrusters', fixed: true }, { slot: 'Engines', gear: ship.engine === 'Thrusters' ? '(thrusters only)' : ship.engine, fixed: true },
    { slot: 'Armor', gear: ship.armor + ' plating (all sections)', fixed: true },
    { slot: 'Comms', gear: 'Radio Transceiver' },
  ];
  c.items.push(item);
  logAct(`🚀 ${ship.name} commissioned: ${subName} (${sdef.cls}, ${sdef.D}D), ${ship.engine}, ${ship.armor} armor — base DC ${sdef.dc} (hull + trained crew; engines/armor/systems price separately per their DC formulas).`);
  save(); renderGear(); renderVehicles(); renderNavTabs(c);
  toast(`${ship.name} commissioned — fit her out on the 🕹 Vehicles tab.`);
}
function shipIncomingHit(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const def = shipDefOf(it); if (!def) return;
  openChoiceModal(`⚔ Hit on ${it.customName || it.ref} — which section takes it? (facing determines this at the table)`,
    SHIP_SECTIONS, (section) => {
      if (!section) return;
      openChoiceModal(`Damage to the ${section} — raw damage, optionally followed by hardness ignored (AA weapons ignore 1D = 20)`, [], (val) => {
        const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
        if (!m) { toast('Enter the damage as a number.'); return; }
        const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
        const net = Math.max(0, dmg - Math.max(0, def.hardness - ign));
        const math = `${dmg} − hardness ${def.hardness}${ign ? ` (−${ign} ignored)` : ''} = ${net}`;
        if (net <= 0) { logAct(`${it.customName || it.ref}: ${section} armor absorbs the hit (${math}).`); save(); toast(`Absorbed — ${math}.`); return; }
        if (!it.shipDamage) it.shipDamage = {};
        it.shipDamage[section] = (it.shipDamage[section] || 0) + net;
        const sec = shipSections(it).find(s => s.section === section);
        logAct(`⚔ ${it.customName || it.ref}: ${math} to the ${section} (${sec.hp}/${sec.maxHP}).${sec.disabled ? ` 🛑 ${section.toUpperCase()} DISABLED.` : ''}`);
        save(); renderVehicles();
        toast(sec.disabled ? `${section} DISABLED.` : `${section}: ${sec.hp}/${sec.maxHP}.`);
      });
    });
}
function shipRepair(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it || !it.shipDamage) { toast('Undamaged.'); return; }
  openChoiceModal('🔧 Repair which section?', SHIP_SECTIONS.filter(s => (it.shipDamage[s] || 0) > 0), (section) => {
    if (!section) return;
    openChoiceModal(`HP repaired on the ${section} (${it.shipDamage[section]} outstanding; 1 hr / Repair DC 20 / 2d6 HP — engineer's station)`, [], (val) => {
      const v = parseInt(String(val || '').trim(), 10);
      if (isNaN(v) || v <= 0) { toast('Enter a positive number.'); return; }
      it.shipDamage[section] = Math.max(0, (it.shipDamage[section] || 0) - v);
      logAct(`🔧 ${it.customName || it.ref}: repaired ${v} HP on the ${section}.`);
      save(); renderVehicles();
    });
  });
}
function renderStarshipCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'starship');
  if (!items.length) return '';
  const owns = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  const hasOp = owns('Starship Operation');
  return items.map(it => {
    const def = shipDefOf(it); if (!def) return '';
    const cls = STARSHIP_SIZE_CLASSES[def.cls] || {};
    const eng = STARSHIP_ENGINES.find(e => e.name === def.engine);
    const arm = STARSHIP_ARMOR.find(a => a.name === def.armor);
    const name = it.customName || it.ref;
    const sections = shipSections(it);
    const secBars = sections.map(s => {
      const pct = Math.max(0, Math.min(100, Math.round(s.hp / s.maxHP * 100)));
      const col = s.disabled ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--text-orange))' : 'rgb(var(--text-green))';
      const colFill = s.disabled ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--tint-orange))' : 'rgb(var(--tint-green))';  // the bar itself
      return `<div class="items-center gap-6 fs-10_5" style="display:flex;">
        <span class="c-g60" style="min-width:86px;">${s.section}</span>
        <span style="min-width:70px;"><b style="color:${col};">${s.hp}</b>/${s.maxHP} <span class="o-50 c-dim">(${s.D}D)</span></span>
        <div class="flex-1 bar-wrap" style="height:4px;"><div class="bar-fill" style="width:${pct}%;background:${colFill};"></div></div>
        ${s.disabled ? '<span class="c-red-text fs-9">DISABLED</span>' : ''}
      </div>`;
    }).join('');
    const critTip = 'Starship Critical Hits (FF p.648 — the table header misprints d%; it is a d20): 1-7 normal crit · 8-10 crit + crew casualties (1d10) · 11-16 damaged system (comm/targeting/weapon/defense/engines[−1,000 ft]/sensors[blind]) — repair 10 hrs DC 30 or jury-rig DC 25 · 17 defense destroyed · 18 weapon destroyed · 19 severe ×10 + casualties · 20 severe ×10 + gravity out 1d10 rds.';
    const loadout = paLoadout(it).map((l, idx) => {
      // v9.8.0 (§258, probe catch): longest name wins — "Laser, Heavy" was
      // matching the plain "Laser" row (and "…, Improved" its base) by array order.
      const longest = (rows) => rows.filter(w => l.gear.startsWith(w.name)).sort((a, b) => b.name.length - a.name.length)[0];
      const wep = longest(STARSHIP_WEAPONS);
      const dfx = longest(STARSHIP_DEFENSES);
      const sen = longest(STARSHIP_SENSORS);
      // v8.26.0 pass 2: the per-system effect prose (FF pp.646-661) reaches
      // the tooltips — the pass-1 "table-level" placeholder retires. Auto-
      // capable weapons carry the FF p.640 autofire ladder.
      const fxLookup = (nm) => {
        const key = Object.keys(STARSHIP_SYSTEM_FX).find(k => nm.toLowerCase().startsWith(k.toLowerCase()) || k.toLowerCase().startsWith(nm.toLowerCase().replace(/ \(ship\)$/, '')));
        return key ? '\n— ' + STARSHIP_SYSTEM_FX[key] : '';
      };
      const autofireTip = (wep && /Auto/.test(wep.stat)) ? '\n✈ AUTOFIRE (FF p.640): target a 1,000-ft cube (4 hx) vs AC 10 — every ship inside: Pilot DC 15 or take the damage (size penalty: Garg −0 · C-UL −4 · C-L −8 · C-M −12 · C-H −16 · C-SH −20). Anti-missile: vs AC 20; each missile rolls automated Pilot DC 15.' : '';
      // v9.8.0 (§258): the mount rides the tooltip — turret (printed DC, any
      // direction), cupola/fixed with the discounted DC, missiles omni.
      const mnt = wep ? shipMountOf(l) : null;
      const mountTip = wep ? (shipWeaponTakesMount(wep.name)
        ? `\n⌖ Mount: ${mnt.kind === 'turret' ? `full turret/bank — fires any direction; the printed DC includes it (FF p.640; stock FF ships are all-turret, GMG p.474)` : `${mnt.kind} ${mnt.arcs.join('/')}${wep.dc ? ` — DC ${wep.dc + mnt.disc} (printed ${wep.dc} −${Math.abs(mnt.disc)} ${mnt.kind}, FF p.640)` : ` (${mnt.disc} DC, FF p.640)`}`}`
        : (/^Missile,/.test(wep.name) ? '\n⌖ Omni launcher — missiles fire any direction (FF p.641); a missile mount option awaits Adam’s ruling.' : '')) : '';
      // v9.9.0 (§259): the fire-link / main-cannon / missile-battery dossier
      // rides the tooltip (FF pp.641-642) — linked damage, grown size, the
      // stepped DC (mount discount folded in), the main cannon's power modes,
      // a battery's threat/multiplier math.
      let linkTip = '';
      if (wep) {
        const link = shipLinkOf(l), bat = shipBatteryOf(l);
        if (link >= 2) {
          const d = Math.round(Math.log2(link));
          const dice = shipLinkedDice(wep.stat, link);
          const grown = SHIP_SIZE_LADDER[shipWeaponSizeStep(wep.mss) + d] || 'beyond Colossal (Superheavy)';
          const effDC = wep.dc ? wep.dc + 3 * d + (mnt ? mnt.disc : 0) : null;
          linkTip = `\n⛓ Fire-linked ×${link} (FF p.641): ONE attack roll${dice ? ` · damage ${dice} (base ×${(2 + d) / 2}; capital dice scale alike)` : ` · damage ×${(2 + d) / 2}`} · size ${grown} (+1 category per doubling)${effDC ? ` · DC ${effDC} (printed ${wep.dc} +3 per doubling${mnt && mnt.disc ? ` ${mnt.disc} ${mnt.kind}` : ''})` : ''}`;
          if (link >= 8) linkTip += `\n★ MAIN CANNON (FF p.642): one per ship (power demands) · threat +1 — crit ${shipThreatRange(wep.stat, 1)} · may fire at 25% power (dual-equivalent) or 50% (quad-equivalent) · always a SINGLE rate of fire.`;
          else if (l.variable) linkTip += `\n⛓ Variable link (FF p.642): the gunner fires the weapons singly, in pairs, or at the full link, chosen attack to attack.`;
        }
        if (bat >= 2) {
          linkTip = `\n⧉ Missile battery ×${bat} (FF p.642): ${bat} identical launchers fire as ONE weapon (one attack roll) · threat ${shipThreatRange(wep.stat, Math.min(bat - 1, 3))} (+${Math.min(bat - 1, 3)}) · crit multiplier ×${1 + bat} (+1 per extra missile) · a non-critical hit deals ONE missile's damage${wep.dc ? ` · DC ${wep.dc + 2} per launcher (${bat}× — printed ${wep.dc} +2)` : ' · +2 DC per launcher'} · one size category above the base weapon — Colossal (Light)+ hulls only · never split: all fire or none · vs force fields: crits never confirm, but damage lands per-missile.`;
        }
      }
      const tip = wep ? `${wep.stat} · min ship ${wep.mss}${wep.dc ? ' · DC ' + wep.dc : ''}${autofireTip}${mountTip}${linkTip}` : dfx ? `Defense system · TS ${dfx.ts} · DC ${dfx.dc} · ${dfx.restriction}${fxLookup(dfx.name)}` : sen ? `Sensor system · TS ${sen.ts} · DC ${sen.dc}${fxLookup(sen.name)}` : fxLookup(l.gear);
      const mountChip = wep ? [shipMountChip(l), shipLinkChip(l), shipBatteryChip(l)].filter(Boolean).join(' · ') : '';
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? 'rgb(var(--text-grey60))' : l.state === 'damaged' ? 'var(--red-text)' : 'rgb(var(--text-green))';
      return `<div class="items-center gap-6 fs-11" style="display:flex;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (10 hrs, Repair DC 30; jury-rig DC 25 for the battle) → destroyed (replace) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span class="c-g55" style="min-width:80px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:rgb(var(--text-sky));' : ''}${wep ? 'color:rgb(var(--text-orange));' : ''}" ${tip ? `title="${escapeHTML(tip)}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}${mountChip ? ` <span class="fs-9_5" style="color:rgb(var(--text-sky));">${escapeHTML(mountChip)}</span>` : ''}</span>
        ${l.fixed ? '' : `<button class="fs-9 p-0-4 btn btn-sm" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="mb-0_8rem panel" style="border-color:rgb(var(--line-iris) / .4);">
      <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
        <div class="font-serif fs-14 c-gold">🚀 ${escapeHTML(name)} <span class="fs-10 c-g50">${escapeHTML(def.subtype)} · ${def.cls} TS ${def.ts} · ${escapeHTML(def.armor || '')} armor</span></div>
        <div class="nowrap">
          <button class="fs-10 btn btn-sm" onclick="shipIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="fs-10 btn btn-sm" onclick="shipRepair('${it.id}')">🔧 Repair</button>
          <button class="fs-10 btn btn-sm" onclick="setJointOwners('${it.id}')">✎ Owners</button>
        </div>
      </div>
      <div class="fs-11 c-parch mt-5">
        <span class="cursor-help" title="Touch/full AC; the trained-crew figures include the crew-quality modifiers (FF STARSHIP TYPES). Untrained pilots without Starship Operation apply only ⅓ Defense Bonus (GMG).">T/AC <b>${def.tac}</b> <span class="o-60 c-dim">(${def.tacTrained} trained)</span></span> ·
        Hardness <b class="cursor-help" title="${escapeHTML(def.hardStr)}">${def.hardness}</b> · <b>${def.D}D</b> (${def.D * 20} HP total) ·
        crew ${def.crew} · ${escapeHTML(def.lw)} · ${escapeHTML(cls.space || '')} ·
        ${(() => {
          // v8.22.0 (Adam's ruling, 2026-09-04): despite the printed "+", the
          // engine figure IS the ship's TOTAL tactical speed — the distance of
          // ONE move action. v8.26.0 pass 2: the subtype statblock's PRINTED
          // speed (FF pp.663-684, standard engine included in the base DC)
          // displays first, with hex count (1 stellar hex = 250 ft); the
          // engine-derived figure rides the hover for refit math.
          const engFt = eng ? (parseInt(String(eng.bonus).replace(/[^\d]/g, ''), 10) || 0) : 0;
          const penFt = (arm && arm.speedPen !== '—') ? (parseInt(String(arm.speedPen).replace(/[^\d]/g, ''), 10) || 0) : 0;
          const spd = Math.max(0, engFt - penFt);
          const st = (STARSHIP_SUBTYPE_STATS[def.subtype]);
          const printed = st && st.speed ? st.speed : null;
          const pFt = printed ? (parseInt(printed.replace(/[^\d]/g, '').slice(0, 6), 10) || 0) : 0;
          const shown = printed || `${spd.toLocaleString()} ft (${Math.floor(spd / 250)} hexes)`;
          const zeroNote = (!printed && spd === 0) ? ' ⚠ Thrusters/Photon Sails list 0 ft — a ship without a faster primary engine maneuvers at GM-adjudicated station-keeping speeds.' : '';
          return `<span class="cursor-help" title="Tactical speed per MOVE action — 1 stellar hex = 250 ft (Adam's scales). Round economy (GMG p.506): two move actions + one standard, any order — full burn = ${((printed ? pFt : spd) * 2).toLocaleString()} ft/round.${printed ? ` Printed subtype speed (standard engine, FF statblock). Engine-derived after refit: ${eng ? eng.name : 'thrusters'} ${engFt.toLocaleString()} ft${penFt ? ` − armor ${penFt.toLocaleString()}` : ''} = ${spd.toLocaleString()} ft.` : ''}${zeroNote}">speed <b>${shown}</b>/move <span class="o-60 c-dim">(×2/round)</span></span> ·`;
        })()}
        grapple ${cls.grappleMod || '+0'} ·
        <span class="cursor-help" style="color:rgb(var(--text-amber));" title="${escapeHTML(critTip)}">🎲 crit table ⓘ</span>
      </div>
      <div class="mt-5">${secBars}</div>
      ${(() => {
        // v8.26.0 pass 2: the printed subtype statblock line (FF pp.663-684)
        // — space, length/weight, crew (+quality mod), passengers, cargo, the
        // HD split notation, initiative — plus the Dex-vs-Cha initiative rule.
        const st = (STARSHIP_SUBTYPE_STATS[def.subtype]);
        if (!st) return '';
        const big = /Light|Medium|Heavy|Superheavy/.test(String(st.space || '')) && !/Ultralight/.test(String(st.space || ''));
        const initRule = big ? 'CHA check (Light-Colossal and larger — GMG p.506)' : 'DEX check (Ultralight-Colossal and smaller — GMG p.506)';
        return `<div class="fs-10_5 mt-4" style="color:var(--tl80);">
          ${st.space ? `⬡ ${escapeHTML(st.space)} · ` : ''}${st.lw ? `${escapeHTML(st.lw)} · ` : ''}${st.crew ? `crew ${escapeHTML(st.crew)} · ` : ''}${st.passengers ? `passengers ${escapeHTML(st.passengers)} · ` : ''}${st.cargo ? `cargo ${escapeHTML(st.cargo)} · ` : ''}${st.hd ? `<span class="cursor-help" title="The printed HD notation — sections split evenly, remainder to Infrastructure, unless this notes otherwise.">HD ${escapeHTML(st.hd)}</span> · ` : ''}<span class="cursor-help" title="Stellar initiative: commander rolls a ${initRule}. Every ship starts flat-footed until it acts.">init: ${big ? 'Cha' : 'Dex'}${st.init ? ` (${escapeHTML(st.init)})` : ''}</span>
        </div>`;
      })()}
      <div class="fs-11 c-g70 mt-5">
        ${hasOp ? '<span style="color:rgb(var(--text-green));">✓ Starship Operation</span>' : '<span class="c-red-text" title="Without it: reduced Defense Bonus contribution and operation penalties — see GMG crewed-starship rules.">✗ Starship Operation</span>'}
        · Roles: pilot · copilot · gunners (${def.weapons} weapon slots) · engineer (damage control) · sensor/comm officers — FF p.662.
        · Slots: ${def.weapons} weapons (${cls.weaponsPer}) · ${def.defense} defense · ${def.sensors} sensors · engines ${escapeHTML(def.engineD)}
        · <span class="cursor-help" style="color:rgb(var(--text-sky));" title="${escapeHTML(Object.values(STARSHIP_COMBAT_REF).join('\n\n'))}">📖 stellar combat ref ⓘ</span>
      </div>
      <div class="fs-10 uppercase ls-0_08em c-g55 mt-7">Fittings <button class="fs-9 p-0-5 ml-6 btn btn-sm" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
      <div class="fs-10 c-g45 mt-3">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`} · Jointly-owned by charter, most likely — the bookkeeping berths here.</div>
    </div>`;
  }).join('');
}
