// =============================================================================
// js/ui/vehicles/mecha.js
// VEHICLES / MECHA — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Vehicles page: the mecha builder and mecha cards.
//
// KEY NAMES (so you can search for them)
//   functions (2): openMechaBuilder, renderMechaCards
//
// WHERE IT CAME FROM
//   Gathered from js/app/59-mecha.js when the code was regrouped by topic
//   and page. Each function and table moved whole and unchanged, with the
//   comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// The custom-build flow: size → superstructure → armor type → name, priced
// from the FF pp.630-631 tables, then the standard purchase/provenance door.
async function openMechaBuilder() {
  const c = currentChar(); if (!c) { toast('Select a hero first.'); return; }
  const size = await new Promise(res => openChoiceModal('Custom mecha — frame size (sets base Str/Dex/HP/speed/slots)',
    Object.keys(MECHA_SIZE_STATS).map(s => { const z = MECHA_SIZE_STATS[s]; return `${s} — Str ${z.str}, ${z.hp} HP, ${z.speed} ft, ${z.slots} slots (${z.paSlots} as PA)`; }), res));
  if (!size) return;
  const szName = size.split(' — ')[0];
  const ss = await new Promise(res => openChoiceModal('Superstructure (sets hardness + frame base DC — FF p.630)',
    Object.keys(MECHA_SUPERSTRUCTURES).map(n => { const s = MECHA_SUPERSTRUCTURES[n]; return `${n} (TS ${s.ts}) — Hardness ${s.hardness}, base DC ${s.dc[szName]}`; }), res));
  if (!ss) return;
  const ssName = ss.split(' (')[0];
  const ar = await new Promise(res => openChoiceModal('Armor type (equip AC / penalty / speed — FF p.631)',
    Object.keys(MECHA_ARMOR_TYPES).map(n => { const a = MECHA_ARMOR_TYPES[n]; return `${n} (TS ${a.ts}) — +${a.equipAC} AC, ${a.penalty == null ? 'GM' : a.penalty} penalty${a.speedMod ? `, ${a.speedMod} ft` : ''}, ${a.restriction}`; }), res));
  if (!ar) return;
  const arName = ar.split(' (')[0];
  const nm = await textModal('Name the design', 'e.g. "Ares Custom Mk I". The stat card derives live from the frame tables.', '');
  if (nm === null) return;
  const custom = { name: (nm || `Custom ${szName} Mecha`).trim(), size: szName, superstructure: ssName, armorType: arName };
  const probe = mechaDefOf({ catalogue: 'mecha', custom });
  const techScale = scenarioTechScale(c);
  let provenance = null;
  {
    const priceUnits = dollarsForDC(marketAdjustedDC(probe.purchaseDC, probe.ts, techScale));
    provenance = await promptProvenance(c, custom.name, priceUnits);
    if (provenance === null) return;
  }
  if (!c.items) c.items = [];
  // customName carries the design name into every generic display path
  // (enchantDisplayName, logs, toasts) — ref stays the '__custom__' marker.
  const item = { id: 'item_' + Math.random().toString(36).slice(2, 10), catalogue: 'mecha', ref: '__custom__', customName: custom.name, custom, slot: 'carried', equipped: false, mastercraft: null, gadgets: [] };
  if (provenance) item.provenance = provenance;
  c.items.push(item);
  logAct(`🏗 Custom mecha commissioned: ${custom.name} (${szName} ${ssName} frame, ${arName} armor — base purchase DC ${probe.purchaseDC}). Weapons & systems install on the Vehicles tab (Craft checks & build times per FF Ch.III).`);
  save(); renderGear(); renderVehicles(); renderNavTabs(c);
  toast(`${custom.name} commissioned — outfit it on the 🕹 Vehicles tab.`);
}
// The mecha operations card.
function renderMechaCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'mecha');
  if (!items.length) return '';
  const owns = (n) => (c.feats || []).some(f => (f.name || f.n) === n);
  const hasOp = owns('Mecha Operation'), hasWp = owns('Mecha Weapon Proficiency');
  return items.map(it => {
    const def = mechaDefOf(it); if (!def) return '';
    const g = vehicleIntegrity(it);
    const name = it.custom ? it.custom.name : (it.customName || it.ref);
    const sz = MECHA_SIZE_STATS[def.size] || {};
    const touch = mechaTouchAC(def);
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? 'rgb(var(--text-grey33))' : g.broken ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--text-orange))' : 'rgb(var(--text-green))';
    const barFill = g.destroyed ? 'rgb(var(--tint-grey33))' : g.broken ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--tint-orange))' : 'rgb(var(--tint-green))';  // the bar itself
    const pilotDexM = am(Math.min(effAttrs(c)[1], def.dexMax));
    const ranks = getLiveSkillRanks(c, 'Pilot');
    const opPen = hasOp ? 0 : -4;
    const pilotChk = ranks + pilotDexM + opPen;
    const critConfirm = touch + Math.ceil(g.hardness / 2) + (hasOp ? (c.def || 0) : 0) + paShieldBonus(it);
    const strM = am(def.str);
    const loadout = paLoadout(it).map((l, idx) => {
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? 'rgb(var(--text-grey60))' : l.state === 'damaged' ? 'var(--red-text)' : 'rgb(var(--text-green))';
      const sys = MECHA_SYSTEMS.find(s => l.gear.startsWith(s.name.replace(/ \(\+2\)$/, '')));
      const wep = MECHA_WEAPONS.find(w => l.gear.startsWith(w.name.split(' (')[0]) || l.gear.includes(w.name));
      let tip = '';
      if (wep) {
        const dmg = wep.dmg || (wep.dmgBySize ? `${wep.dmgBySize[def.size] || '?'} + Str mod (${def.size} wielder)` : '');
        tip = `${dmg}${wep.dmgType ? ' ' + wep.dmgType : ''}${wep.crit ? ' · crit ' + wep.crit : ''}${wep.range ? ' · ' + wep.range : ''}${wep.area ? ' · ' + wep.area : ''}${wep.rof ? ' · RoF ' + wep.rof : ''}${wep.mag ? ' · mag ' + wep.mag : ''}${wep.save ? ' · ' + wep.save : ''}${wep.special ? '\n' + wep.special : ''}\nSlots: ${wep.slots} · DC ${wep.dc} · ${wep.restriction}${hasWp ? '' : '\n⚠ Without Mecha Weapon Proficiency: −4 attacks, no firearm feats.'}`;
      } else if (sys) tip = `${sys.effect} (Slots: ${sys.slots} · DC ${sys.dc})`;
      return `<div class="items-center gap-6 fs-11" style="display:flex;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (1 hr, Repair DC 20; slot DC 25) → destroyed (replace; slot rebuild 12 hrs, Craft DC 30) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span class="c-g55" style="min-width:98px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:rgb(var(--text-sky));' : ''}${wep ? 'color:rgb(var(--text-orange));' : ''}" ${tip ? `title="${escapeHTML(tip)}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}</span>
        ${l.fixed ? '' : `<button class="fs-9 p-0-4 btn btn-sm" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="mb-0_8rem panel" style="border-color:rgb(var(--line-copper) / .4);">
      <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
        <div class="font-serif fs-14 c-gold">${it.piloted ? '🕹 ' : ''}🦿 ${escapeHTML(name)} <span class="fs-10 c-g50">${def.size} TS ${def.ts}${def.quad ? ' Quadrupedal' : ''} Mecha · ${escapeHTML(def.superstructure)} / ${escapeHTML(def.armorType)}</span></div>
        <div class="nowrap">
          <button class="btn btn-sm" style="font-size:10px;${it.piloted ? 'border-color:rgb(var(--line-sky) / .6);color:rgb(var(--text-sky));' : ''}" onclick="togglePiloted('${it.id}')">${it.piloted ? '🕹 Dismount' : '🕹 Pilot'}</button>
          <button class="fs-10 btn btn-sm" onclick="vehicleIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="fs-10 btn btn-sm" onclick="vehicleRepair('${it.id}')">🔧 Repair</button>
          <button class="fs-10 btn btn-sm" onclick="setJointOwners('${it.id}')">✎ Owners</button>
        </div>
      </div>
      ${def.note ? `<div class="fs-10 c-g50 mt-3">${escapeHTML(def.note)}</div>` : ''}
      <div class="fs-11 c-parch mt-5">
        <b>Str ${def.str}</b> (${strM >= 0 ? '+' : ''}${strM} — the mecha's, FF p.618) · <b>Dex (Max) ${def.dexMax}</b> (your effective: ${Math.min(effAttrs(c)[1], def.dexMax)}) ·
        speed <b>${def.speed} ft</b> <span class="op-0_6 cursor-help" title="Vehicular/mecha scale: 1 hex = 50 ft (personal scale 5 ft; stellar 250 ft — Adam's three combat scales).">(${Math.floor((def.speed || 0) / 50)} hx @50′)</span>${def.fly ? ` · fly ${escapeHTML(def.fly)}` : ''} · space/reach ${sz.spaceReach || (def.size === 'Medium' ? '5/5' : def.size === 'Large' ? '10/10' : def.size === 'Huge' ? '15/10' : def.size === 'Gargantuan' ? '20/15' : '30/15')} ft ·
        <span style="cursor:help;" title="Touch ${touch} (10 ${sz.sizeMod ? (sz.sizeMod > 0 ? '+' : '') + sz.sizeMod + ' size' : ''}); total adds equip AC ${def.equipAC}${paShieldBonus(it) ? ' + shield ' + paShieldBonus(it) : ''}. Crits confirm vs ${critConfirm} (touch + ½ hardness${hasOp ? ' + your Defense Bonus' : ' — NO Defense Bonus without Mecha Operation'}${paShieldBonus(it) ? ' + shield' : ''}) — FF p.616.">T/AC <b>${touch}/${touch + def.equipAC + paShieldBonus(it)}</b>${def.printedTAC && def.printedTAC !== `${touch}/${touch + def.equipAC + paShieldBonus(it)}` ? ` <span class="o-55 c-dim">(book: ${def.printedTAC})</span>` : ''} · crit ≥ ${critConfirm}</span> ·
        <span style="cursor:help;" title="Slam: your BAB + mecha Str mod${sz.sizeMod ? ` ${sz.sizeMod > 0 ? '+' : ''}${sz.sizeMod} size` : ''}${hasOp ? '' : ' −4 (no Mecha Operation)'}; armor penalty ${def.armorPenalty} applies to Balance/Climb/Escape Artist/Hide/Jump/Move Silently/Tumble while piloting.">slam <b>${def.slam}${strM ? ` ${strM > 0 ? '+' : ''}${strM}` : ''}</b> (atk ${(c.bab || 0) + strM + (sz.sizeMod || 0) + opPen >= 0 ? '+' : ''}${(c.bab || 0) + strM + (sz.sizeMod || 0) + opPen})</span>
      </div>
      <div class="items-center gap-8 mt-5 fs-11_5" style="display:flex;">
        <span style="cursor:help;" title="${escapeHTML(def.superstructure + ' superstructure — hardness applies to every hull hit; crew is hit only via crit-table results (FF p.616).')}">Hull <b style="color:${barColor};">${g.hp}</b>/${g.maxHP} · Hardness <b>${g.hardness}</b></span>
        <div class="flex-1 h-6 bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${barFill};"></div></div>
        <span class="cursor-help fs-10" style="color:rgb(var(--text-amber));" title="Mecha Critical Hits (FF p.616): d20 — 1-3 dmg+crew dazed · 4-7 equipment damaged · 8-9 crit+crew dazed · 10 equipment destroyed · 11-12 crit+prone · 13 CREW HIT · 14-16 crit+slot damaged · 17-18 crit+slot destroyed · 19-20 severe ×5. Mark results on the loadout.">🎲 crit table ⓘ</span>
      </div>
      ${g.destroyed ? '<div class="fs-10_5 mt-3" style="color:rgb(var(--text-grey60));">☠ DESTROYED — salvage only (HH p.181).</div>' : g.broken ? '<div class="c-red-text fs-10_5 mt-3">🛑 DISABLED — 0 HP; repair 1 hr / DC 20 / 2d6 HP (workshop).</div>' : ''}
      <div class="fs-11 c-g70 mt-5">
        Your Pilot check aboard: <b class="c-gold">${pilotChk >= 0 ? '+' : ''}${pilotChk}</b> <span class="o-60 c-dim">(${ranks} ranks ${pilotDexM >= 0 ? '+' : ''}${pilotDexM} Dex [capped]${opPen ? ' − 4 no Mecha Operation' : ''})</span>
        · ${hasOp ? '<span style="color:rgb(var(--text-green));">✓ Mecha Operation</span>' : '<span class="c-red-text" title="−4 on Balance/Climb/Drive/Escape Artist/Hide/Move Silently/Pilot/Tumble aboard; no Defense Bonus to full AC; no run or charge.">✗ Mecha Operation</span>'}
        · ${hasWp ? '<span style="color:rgb(var(--text-green));">✓ Mecha Weapon Proficiency</span>' : '<span class="c-red-text" title="−4 on attacks with mecha weapons; firearm feats (Double Tap, Strafe…) unusable on them.">✗ Mecha Weapon Prof</span>'}
      </div>
      <div class="fs-10 uppercase ls-0_08em c-g55 mt-7">Equipment Slots (${sz.slots ?? '?'} total — cockpit fixed) <button class="fs-9 p-0-5 ml-6 btn btn-sm" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
      <div class="fs-10 c-g45 mt-3">Registered owners: ${it.jointOwners ? escapeHTML(it.jointOwners) : `${escapeHTML(c.name)} (sole)`}</div>
    </div>`;
  }).join('');
}

