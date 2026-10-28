// =============================================================================
// js/ui/vehicles/power-armor.js
// VEHICLES / POWER ARMOR — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Vehicles page: power armor and Second Skin cards.
//
// KEY NAMES (so you can search for them)
//   functions (8): paCycleSlotState, paAddLoadoutLine, paRemoveLoadoutLine,
//   renderPowerArmorCards, setSecondSkinLevel, toggleSecondSkin,
//   ssIncomingHit, renderSecondSkinCard
//
// WHERE IT CAME FROM
//   Gathered from js/app/58-power-armor.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function paCycleSlotState(itemId, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const lines = paLoadout(it); const line = lines[idx]; if (!line) return;
  line.state = PA_SLOT_STATES[(PA_SLOT_STATES.indexOf(line.state || 'ok') + 1) % 3];
  logAct(`${enchantDisplayName(it)} — ${line.slot}: ${line.gear} marked ${line.state.toUpperCase()}${line.state === 'damaged' ? ' (repair: 1 hr, Repair DC 20; slot itself DC 25)' : line.state === 'destroyed' ? ' (replace only; destroyed slot: 12 hrs + Craft mechanical DC 30)' : ''}.`);
  save(); renderVehicles(); renderSheet(); renderSkills();
}
async function paAddLoadoutLine(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  // v8.17.0 Segment C: the weapons catalog joins the systems picker.
  // v8.18.0 Segment D: starship items draw from the starship catalogs.
  const names = (it.catalogue === 'starship'
    ? [].concat(
        STARSHIP_WEAPONS.map(w => `${w.name} (TS ${w.ts} · weapon)`),
        STARSHIP_DEFENSES.map(d => `${d.name} (TS ${d.ts} · defense)`),
        STARSHIP_SENSORS.map(d => `${d.name} (TS ${d.ts} · sensor)`),
        STARSHIP_COMMS.map(d => `${d.name} (TS ${d.ts} · comms)`))
    : MECHA_SYSTEMS.map(s => `${s.name} (TS ${s.ts} · ${s.cat})`)
        .concat(MECHA_WEAPONS.map(w => `${w.name} (TS ${w.ts} · weapon)`)))
    .concat(['✎ Custom line (free text)']);
  openChoiceModal('Install a system or weapon (slot requirements & purchase DCs in each tooltip after install)', names, async (pick) => {
    let gear = pick ? pick.replace(/\s*\(TS \d+ · \w+\)$/, '') : null;
    if (!gear) return;
    if (gear.startsWith('✎')) {
      gear = await textModal('✎ Custom loadout line', 'Name the equipment (e.g. "M-9 Barrage Chaingun").', '');
      if (!gear) return;
    }
    // v9.8.0 (§258): the mount economy (FF p.640; GMG p.474) — a starship
    // beam/projectile weapon picks its mount at purchase: full turret (the
    // printed DC, any direction, the stock-ship default), cupola (two
    // adjacent arcs, −1 DC) or fixed (one arc, −2 DC). Missiles stay omni
    // (mount option awaits Adam's ruling); mines and grapple systems have none.
    let mountPick = null;
    const wepRow = it.catalogue === 'starship' ? STARSHIP_WEAPONS.find(w => w.name === gear) : null;
    if (wepRow && shipWeaponTakesMount(wepRow.name)) {
      const dcN = wepRow.dc;
      const mk = await new Promise(res => openChoiceModal(`Mount for the ${gear} (FF p.640 — the printed Purchase DC buys a full turret; restricted mounts discount it)`, [
        `Turret / bank — fires any direction${dcN ? ` · printed DC ${dcN}` : ''} (the default; stock FF ships are all-turret, GMG p.474)`,
        `Cupola — two ADJACENT arcs${dcN ? ` · DC ${dcN - 1}` : ''} (−1 DC)`,
        `Fixed mount — one arc${dcN ? ` · DC ${dcN - 2}` : ''} (−2 DC)`,
      ], res));
      if (!mk) return;
      if (mk.startsWith('Cupola')) {
        const pair = await new Promise(res => openChoiceModal('Cupola coverage — two adjacent arcs (Port/Starboard and Fore/Aft are not adjacent pairs, FF p.640)', SHIP_CUPOLA_PAIRS, res));
        if (!pair) return;
        mountPick = { mount: 'cupola', arcs: pair.split('/') };
      } else if (mk.startsWith('Fixed')) {
        const arc = await new Promise(res => openChoiceModal('Fixed mount — which arc does it cover?', SHIP_FIXED_ARCS, res));
        if (!arc) return;
        mountPick = { mount: 'fixed', arcs: [arc] };
      }
    }
    // v9.9.0 (§259): the FIRE-LINK picker (FF pp.641-642) — identical beam/
    // projectile weapons as ONE weapon: each doubling +½ base damage, +1 size
    // category, +3 DC; the grown size must still fit the hull (I16); octo+ =
    // the MAIN CANNON, one per ship. Missiles instead pick a BATTERY (up to 4
    // launchers, +2 DC each, Colossal (Light)+ hulls only).
    let linkPick = null;
    const shipDef = it.catalogue === 'starship' ? shipDefOf(it) : null;
    if (wepRow && shipDef && shipWeaponTakesMount(wepRow.name)) {
      const hasMain = shipHasMainCannon(it);
      const opts = shipLinkOptions(shipDef, wepRow, hasMain);
      if (opts.length > 1) {
        const labels = opts.map(o => o.link === 1
          ? `×1 single weapon — ${o.dice || 'printed damage'} · ${o.size}${wepRow.dc ? ` · printed DC ${wepRow.dc}` : ''}`
          : `×${o.link} ${o.main ? 'MAIN CANNON' : o.link === 2 ? 'dual-linked' : o.link === 4 ? 'quad-linked' : `${o.link}-linked`} — ${o.dice || `damage ×${(2 + o.doublings) / 2}`} · ${o.size}${wepRow.dc ? ` · DC ${o.dc}` : ''} (+${3 * o.doublings} DC)${o.main ? ' · one per ship' : ''}`);
        const lk = await new Promise(res => openChoiceModal(`Fire link for the ${gear} (FF p.641 — each doubling: +½ base damage, +1 size category, +3 DC; the grown weapon must still fit the ${shipDef.cls} hull${hasMain ? '; the ship’s main cannon slot is already taken' : ''})`, labels, res));
        if (!lk) return;
        const chosen = opts[labels.indexOf(lk)];
        if (chosen && chosen.link >= 2) {
          linkPick = { link: chosen.link };
          if (chosen.link >= 4 && !chosen.main) {
            const vr = await new Promise(res => openChoiceModal('Variable fire link? (FF p.642 — quad+ links may be built variable: the gunner fires singly, in pairs, or at the full link, chosen attack to attack)', [
              'Full link only (fires as one weapon every attack)',
              'Variable fire link (singly / pairs / full — gunner’s choice each attack)',
            ], res));
            if (!vr) return;
            if (vr.startsWith('Variable')) linkPick.variable = true;
          }
        }
      }
    }
    if (wepRow && shipDef && /^Missile,/.test(wepRow.name) && shipDef.cls !== 'Ultralight') {
      const bOpts = [1, 2, 3, 4].map(n => n === 1
        ? `Single launcher — ${/crit (\d+(?:-20)?)/.exec(wepRow.stat)?.[1] ? `crit ${/crit (\d+(?:-20)?)/.exec(wepRow.stat)[1]}` : 'printed crit'}${wepRow.dc ? ` · printed DC ${wepRow.dc}` : ''}`
        : `Battery of ${n} launchers — threat ${shipThreatRange(wepRow.stat, Math.min(n - 1, 3))} (+${Math.min(n - 1, 3)}) · crit ×${2 + (n - 1)}${wepRow.dc ? ` · DC ${wepRow.dc + 2} each (${n}×)` : ' · +2 DC each'}`);
      const bk = await new Promise(res => openChoiceModal(`Missile battery for the ${gear}? (FF p.642 — up to 4 identical launchers fire as ONE weapon: +2 DC per launcher, +1 threat per missile past the first [max +3], crit multiplier +1 per extra missile; non-crit hits deal one missile’s damage; never split)`, bOpts, res));
      if (!bk) return;
      const bn = bk.startsWith('Battery of') ? parseInt(bk.replace('Battery of ', ''), 10) : 1;
      if (bn >= 2) linkPick = { battery: bn };
    }
    const slot = await textModal('Which slot?', 'e.g. Helmet, Left Arm, Shoulders, Boots, (no slot). Slot capacity is GM-adjudicated in Segment B.', '');
    paLoadout(it).push(Object.assign({ slot: slot || '(no slot)', gear, state: 'ok' }, mountPick || {}, linkPick || {}));
    const mountNote = wepRow && shipWeaponTakesMount(wepRow.name)
      ? (mountPick ? ` — ${mountPick.mount} ${mountPick.arcs.join('/')} (${SHIP_MOUNT_KINDS[mountPick.mount].disc} DC${wepRow.dc ? ` → DC ${wepRow.dc + SHIP_MOUNT_KINDS[mountPick.mount].disc}` : ''}, FF p.640)` : ` — full turret (any direction${wepRow.dc ? `, printed DC ${wepRow.dc}` : ''}, FF p.640)`)
      : (wepRow && /^Missile,/.test(wepRow.name) ? ' — omni launcher (a missile mount option awaits Adam’s ruling)' : '');
    const linkNote = linkPick && linkPick.link
      ? ` — ${linkPick.link >= 8 ? `★ MAIN CANNON (×${linkPick.link}: +1 threat, 25%/50% power modes, single RoF, one per ship)` : `fire-linked ×${linkPick.link}${linkPick.variable ? ' (variable)' : ''}`}${wepRow.dc ? `, DC ${wepRow.dc + 3 * Math.round(Math.log2(linkPick.link)) + (mountPick ? SHIP_MOUNT_KINDS[mountPick.mount].disc : 0)}` : ''} (FF pp.641-642)`
      : linkPick && linkPick.battery
        ? ` — ⧉ battery of ${linkPick.battery} (threat ${shipThreatRange(wepRow.stat, linkPick.battery - 1)}, crit ×${1 + linkPick.battery}${wepRow.dc ? `, ${linkPick.battery}× DC ${wepRow.dc + 2}` : ''}, FF p.642)`
        : '';
    logAct(`${enchantDisplayName(it)} — installed ${gear}${slot ? ' (' + slot + ')' : ''}${mountNote}${linkNote}.`);
    save(); renderVehicles(); renderSheet(); renderSkills();
  });
}
function paRemoveLoadoutLine(itemId, idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const lines = paLoadout(it); const line = lines[idx];
  if (!line || line.fixed) return;
  lines.splice(idx, 1);
  logAct(`${enchantDisplayName(it)} — removed ${line.gear}.`);
  save(); renderVehicles(); renderSheet(); renderSkills();
}
function renderPowerArmorCards(c) {
  const items = getCharItems(c).filter(i => i.catalogue === 'armor' && POWER_ARMOR_DB[i.ref]);
  if (!items.length) return '';
  return items.map(it => {
    const pa = POWER_ARMOR_DB[it.ref];
    const g = armorItemIntegrity(it);
    const name = enchantDisplayName(it);
    const sz = MECHA_SIZE_STATS[pa.size] || {};
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? '#555' : g.broken ? 'var(--red-text)' : pct <= 33 ? '#d4865a' : '#6dba88';
    const critTip = 'Mecha Critical Hits (FF p.616) — crits confirm vs FULL AC (touch + ½ hardness + proficient pilot\'s Defense Bonus + shield). d20: 1-3 dmg+crew dazed · 4-7 dmg+equipment damaged · 8-9 crit+crew dazed · 10 equipment destroyed · 11-12 crit+prone · 13 CREW HIT (bypasses to pilot, hardness only) · 14-16 crit+slot damaged · 17-18 crit+slot destroyed · 19-20 severe (×5) — mark results on the loadout below.';
    const statBits = [
      pa.strMin ? `<b>Str (Min) ${pa.strMin}</b> — your Str floors here while suited` : `<b>+${pa.equipStrMod} equipment Str</b>`,
      pa.dexMax ? `<b>Dex (Max) ${pa.dexMax}</b> — your Dex caps here` : 'no Dex cap',
      `Hardness <b>${g.hardness}</b> (${escapeHTML(g.substance)})`, `HP ${g.hp}/${g.maxHP}`,
      `speed: as wearer${pa.fly ? ` · fly ${escapeHTML(pa.fly)}` : ''}`,
      pa.slam ? `slam ${escapeHTML(pa.slam)}` : null,
      pa.printedTAC ? `book T/AC ${pa.printedTAC} (your Sheet derives the live value)` : null,
      `pilot size: ${pa.pilotSize}`,
    ].filter(Boolean).join(' · ');
    const loadout = paLoadout(it).map((l, idx) => {
      const sIcon = l.state === 'destroyed' ? '☠' : l.state === 'damaged' ? '⚑' : '●';
      const sColor = l.state === 'destroyed' ? '#999' : l.state === 'damaged' ? 'var(--red-text)' : '#6dba88';
      const sys = MECHA_SYSTEMS.find(s => l.gear.startsWith(s.name.replace(/ \(\+2\)$/, '')));
      return `<div class="items-center gap-6 fs-11" style="display:flex;padding:1px 0;">
        <button class="btn btn-sm" style="font-size:9px;padding:0 4px;color:${sColor};" title="Cycle: ok → damaged (1 hr, Repair DC 20; slot DC 25) → destroyed (replace only) → ok" onclick="paCycleSlotState('${it.id}',${idx})">${sIcon}</button>
        <span class="c-g55" style="min-width:88px;">${escapeHTML(l.slot)}</span>
        <span style="flex:1;${l.state !== 'ok' ? 'opacity:.5;text-decoration:line-through;' : ''}${l.fixed ? 'color:#78afcd;' : ''}" ${sys ? `title="${escapeHTML(sys.effect + ' (Slots: ' + sys.slots + ' · DC ' + sys.dc + ')')}" style="cursor:help;"` : ''}>${escapeHTML(l.gear)}</span>
        ${l.fixed ? '' : `<button class="fs-9 p-0-4 btn btn-sm" onclick="paRemoveLoadoutLine('${it.id}',${idx})">✕</button>`}
      </div>`;
    }).join('');
    return `<div class="mb-0_8rem panel" style="border-color:rgba(120,175,205,.35);">
      <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
        <div class="font-serif fs-14 c-gold">${it.equipped ? '🤖 ' : ''}${escapeHTML(name)} <span class="fs-10 c-g50">${pa.size} TS ${pa.ts} Power Armor · ${escapeHTML(pa.book || 'FF')}</span></div>
        <div class="nowrap">
          <button class="btn btn-sm" style="font-size:10px;${it.equipped ? 'border-color:rgba(120,175,205,.6);color:#78afcd;' : ''}" onclick="toggleItemEquipped('${it.id}');renderVehicles();" title="Worn as armor — the armor slot enforces exclusivity with body armor">${it.equipped ? '🤖 Doff' : '🤖 Don'}</button>
          <button class="fs-10 btn btn-sm" onclick="armorIncomingHit('${it.id}')">⚔ Hit</button>
          <button class="fs-10 btn btn-sm" onclick="armorRepair('${it.id}')">🔧 Repair</button>
        </div>
      </div>
      ${pa.note ? `<div class="fs-10 c-g50 mt-3">${escapeHTML(pa.note)}</div>` : ''}
      <div class="fs-11 c-parch mt-5">${statBits}</div>
      <div class="items-center gap-8 mt-5 fs-11_5" style="display:flex;">
        <span style="cursor:help;" title="${escapeHTML(g.hardParts.join(' + ') + ' · HP: ' + g.hpParts.join(' + ') + '\nAlways intercedes (power armor): every hit applies hardness; full AC confirms crits only.')}">Frame HP <b style="color:${barColor};">${g.hp}</b>/${g.maxHP}</span>
        <div class="flex-1 h-6 bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
        <span class="cursor-help fs-10" style="color:#d4b870;" title="${escapeHTML(critTip)}">🎲 crit table ⓘ</span>
      </div>
      ${g.destroyed ? '<div class="fs-10_5 mt-3" style="color:#999;">☠ DESTROYED — beyond repair (salvage); mecha upgrades lost (HH p.383).</div>' : g.broken ? '<div class="c-red-text fs-10_5 mt-3">⚑ BROKEN — 0 HP: no AC bonus, and power armor at 0 HP loses access to its mecha upgrades (HH p.383) — loadout systems inoperable until repaired.</div>' : ''}
      <div class="fs-10 uppercase ls-0_08em c-g55 mt-7">Equipment Slots (${sz.paSlots ?? '?'} usable of ${sz.slots ?? '?'} — Pilot's Cockpit takes the rest) <button class="fs-9 p-0-5 ml-6 btn btn-sm" onclick="paAddLoadoutLine('${it.id}')">+ Install</button></div>
      ${loadout}
    </div>`;
  }).join('');
}
async function setSecondSkinLevel(lvl) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const row = SECOND_SKIN_TABLE.find(r => r.lvl === lvl); if (!row) return;
  if (!c.secondSkin) c.secondSkin = {};
  c.secondSkin.level = lvl; c.secondSkin.abilities = []; c.secondSkin.damage = 0;
  // Menu picks: `picks` selections from the level's menu; Versatile expands
  // downward (B pick → 2×A; C pick → 2×B).
  const pickFrom = async (menu, count, chosen) => {
    for (let i = 0; i < count; i++) {
      const opts = SECOND_SKIN_MENUS[menu].map(([n, e]) => `${n} — ${e}`);
      const sel = await new Promise(res => openChoiceModal(`Second Skin lvl ${lvl} — Menu ${menu} pick ${i + 1}/${count}`, opts, res));
      if (!sel) return false;
      const nm = sel.split(' — ')[0];
      if (nm === 'Versatile') {
        const sub = menu === 'C' ? 'B' : 'A';
        if (!(await pickFrom(sub, 2, chosen))) return false;
      } else chosen.push(nm);
    }
    return true;
  };
  const chosen = [];
  if (!(await pickFrom(row.menu, row.picks, chosen))) return;
  c.secondSkin.abilities = chosen;
  save(); renderVehicles();
  toast(`Second Skin configured: level ${lvl} (${row.pp} PP) — ${chosen.join(', ') || 'no abilities'}.`);
}
function toggleSecondSkin() {
  const c = chars.find(x => x.id === curId); if (!c || !c.secondSkin || !c.secondSkin.level) { toast('Configure a Second Skin level first.'); return; }
  if (!c.secondSkin.active) {
    if (getCharItems(c).some(i => i.catalogue === 'armor' && i.equipped && getCatalogueEntry('armor', i.ref) && getCatalogueEntry('armor', i.ref).type !== 'shield')) {
      toast('Second Skin cannot be manifested while wearing armor (HH p.241) — doff it first.'); return;
    }
    const row = SECOND_SKIN_TABLE.find(r => r.lvl === c.secondSkin.level);
    c.secondSkin.active = true; c.secondSkin.damage = 0;
    logAct(`🧿 Second Skin manifested (lvl ${c.secondSkin.level}: AC +${row.ac}, Hardness ${row.hardness}, ${secondSkinMaxHP(row, c.secondSkin.abilities)} HP${row.dr ? ', DR ' + row.dr : ''}; ${row.pp} PP — counts as your Astral Construct manifestation; psionic focus locked while it lasts).`);
  } else {
    c.secondSkin.active = false; c.secondSkin.damage = 0;
    logAct('Second Skin dismissed (the ectoplasm dissipates; damage does not persist to the next manifestation).');
  }
  save(); renderVehicles(); renderSheet(); renderArmorIntegrity(c);
}
function ssIncomingHit() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const sk = activeSecondSkin(c); if (!sk) { toast('No active Second Skin.'); return; }
  openChoiceModal('⚔ Hit on the Second Skin — enter raw damage, optionally followed by hardness ignored', [], (val) => {
    const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
    if (!m) { toast('Enter the damage as a number.'); return; }
    const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
    const net = Math.max(0, dmg - Math.max(0, sk.row.hardness - ign));
    const math = `${dmg} − hardness ${sk.row.hardness}${ign ? ` (−${ign} ignored)` : ''} = ${net}`;
    if (net <= 0) { logAct(`Second Skin absorbs the hit: ${math}.`); save(); toast(`Absorbed — ${math}.`); return; }
    const toSkin = Math.min(net, sk.hp);
    const overflow = net - toSkin;
    c.secondSkin.damage = (c.secondSkin.damage || 0) + toSkin;
    if (overflow > 0 && typeof c.currentHP === 'number') c.currentHP -= overflow;
    const after = activeSecondSkin(c);
    logAct(`⚔ Second Skin hit: ${math}; ${toSkin} to the skin (${Math.max(0, after.hp)}/${after.maxHP})${overflow ? `, ${overflow} carries over to ${c.name} (HH p.242)` : ''}.${after.destroyed ? ' 🧿 The skin is DESTROYED — dismiss and re-manifest for a fresh one.' : ''}`);
    save(); renderVehicles(); renderSheet(); renderTracker();
    toast(after.destroyed ? 'Second Skin destroyed — excess damage carried over.' : `Skin: ${after.hp}/${after.maxHP}${overflow ? ` · ${overflow} to you` : ''}.`);
  });
}
function renderSecondSkinCard(c) {
  if (!hasFeatNamed(c, 'Second Skin') && !(c.secondSkin && c.secondSkin.active)) return '';
  const st = c.secondSkin || {};
  const row = st.level ? SECOND_SKIN_TABLE.find(r => r.lvl === st.level) : null;
  const sk = activeSecondSkin(c);
  const scale = (c.sixLevels && c.sixLevels.psionic) || 0;
  const lvlBtns = SECOND_SKIN_TABLE.map(r => {
    const gated = r.scale5 && scale < 5;
    return `<button class="btn btn-sm" style="font-size:9px;padding:0 5px;${st.level === r.lvl ? 'border-color:var(--gold);color:var(--gold);' : ''}${gated ? 'opacity:.4;' : ''}" title="${gated ? 'Requires a Psionic Scale 5+ scenario (HH p.241 footnote). ' : ''}AC +${r.ac} · Hardness ${r.hardness} · ${r.hp} HP · ${r.size} · Str ${r.str} / slam ${r.slam}${r.dr ? ' · DR ' + r.dr : ''} · ${r.pp} PP · ${r.picks} Menu ${r.menu} pick${r.picks > 1 ? 's' : ''}" onclick="setSecondSkinLevel(${r.lvl})">${r.lvl}</button>`;
  }).join('');
  const pct = sk ? Math.max(0, Math.min(100, Math.round(sk.hp / sk.maxHP * 100))) : 0;
  return `<div class="mb-0_8rem panel" style="border-color:rgba(196,153,212,.4);">
    <div class="justify-between items-center flex-wrap gap-6" style="display:flex;">
      <div class="font-serif fs-14 c-vio">🧿 Second Skin <span class="fs-10 c-g50">ectoplasmic power armor · HH p.241</span></div>
      <div class="nowrap">
        ${sk ? `<button class="fs-10 btn btn-sm" onclick="ssIncomingHit()">⚔ Hit</button>` : ''}
        <button class="btn btn-sm" style="font-size:10px;${sk ? 'border-color:rgba(196,153,212,.6);color:var(--vio);' : ''}" onclick="toggleSecondSkin()">${sk ? '🧿 Dismiss' : '🧿 Manifest'}</button>
      </div>
    </div>
    <div class="fs-10_5 c-g60 mt-4">Level (sets menu picks): ${lvlBtns}</div>
    ${row ? `<div class="fs-11 c-parch mt-4">Configured lvl ${row.lvl}: <b>AC +${row.ac}</b> (as armor — no stacking) · Hardness <b>${row.hardness}</b> · <b>${secondSkinMaxHP(row, st.abilities)}</b> HP · ${row.size} coverage · Str ${row.str} / slam <b>${row.slam}</b> (you count as armed)${row.dr ? ` · DR <b>${row.dr}</b>` : ''} · <b>${row.pp} PP</b><br><span class="c-tv80">Abilities: ${(st.abilities || []).join(', ') || '—'}</span></div>` : '<div class="fs-11 op-0_6 mt-4">Pick a level to configure.</div>'}
    ${sk ? `<div class="items-center gap-8 mt-5 fs-11_5" style="display:flex;">
      <span>Skin HP <b style="color:${sk.destroyed ? '#999' : '#c499d4'};">${Math.max(0, sk.hp)}</b>/${sk.maxHP}</span>
      <div class="flex-1 h-6 bar-wrap"><div class="bar-fill" style="width:${pct}%;background:#c499d4;"></div></div>
    </div>
    <div class="fs-10 c-g50 mt-3">Active: every hit strikes the skin first (hardness ${sk.row.hardness}); excess carries over to you. Counts as your Astral Construct manifestation — no separate construct, and your psionic focus stays committed. Cannot wear armor. Duration 1 rd./level unless a Lasting ability was picked.</div>` : ''}
  </div>`;
}

