// =============================================================================
// js/ui/tracker/armor-integrity.js
// TRACKER / ARMOR INTEGRITY — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: the armor integrity panel.
//
// KEY NAMES (so you can search for them)
//   functions (3): renderArmorIntegrity, armorIncomingHit, armorRepair
//
// WHERE IT CAME FROM
//   Gathered from js/app/57-armor-and-vehicle-integrity.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function renderArmorIntegrity(c) {
  const host = document.getElementById('tr-armor');
  if (!host) return;
  const items = trackedArmorItems(c);
  if (!items.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const rows = items.map(it => {
    const g = armorItemIntegrity(it);
    const name = enchantDisplayName(it);
    const prof = isProficientWithArmor(c, it.ref);
    const pct = Math.max(0, Math.min(100, Math.round(g.hp / g.maxHP * 100)));
    const barColor = g.destroyed ? 'rgb(var(--text-grey33))' : g.broken ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--text-orange))' : 'rgb(var(--text-green))';
    const barFill = g.destroyed ? 'rgb(var(--tint-grey33))' : g.broken ? 'var(--red-text)' : pct <= 33 ? 'rgb(var(--tint-orange))' : 'rgb(var(--tint-green))';  // the bar itself
    const hardTip = g.hardParts.join(' + ') + ' · HP: ' + g.hpParts.join(' + ')
      + (g.alwaysIntercede ? '\nAlways intercedes: every hit applies this hardness; full AC is for confirming crits only (power armor / Environmental Seal).' : `\nHits in the band [Touch AC, Total AC) strike this ${g.isShield ? 'shield' : 'armor'} — hardness applies, remainder split between item and wearer.`)
      + (prof ? '\nProficient: the WEARER chooses how remaining damage is split.' : '\n⚠ NOT proficient: the ATTACKER chooses the split (hardness still applies first).')
      + (g.selfRepairing ? '\nSelf-Repairing gadget: 1 HP/minute; fully restored by a night’s rest.' : '\nArmor does not heal on its own — repairs need the Repair skill (tool kit; task table HH p.181) or services.');
    const state = g.destroyed
      ? `<span class="fs-10" style="color:rgb(var(--text-grey60));">☠ DESTROYED — damage ${g.damage} ≥ ${g.destroyThreshold} (1.5× max): beyond repair, salvage only (HH p.181 rule). GM may adjudicate restoration.</span>`
      : g.broken
      ? `<span class="c-red-text fs-10">⚑ BROKEN — 0 HP: no AC bonus (penalties remain); enchantment suppressed (book: lost permanently — GM adjudicates). Repairable up to ${g.destroyThreshold - 1 - g.maxHP} more damage.</span>`
      : '';
    return `<div class="p-4-0" style="margin:5px 0;border-top:1px solid rgb(var(--line-gold) / .12);">
      <div class="items-center gap-6 fs-11_5" style="display:flex;">
        <span class="flex-1 cursor-help" title="${escapeHTML(hardTip)}">${g.isShield ? '🛡' : '⛨'} ${escapeHTML(name)}${g.alwaysIntercede ? ' <span class="fs-9" style="color:rgb(var(--text-sky));" title="Power armor / Environmental Seal: always intercedes">◈</span>' : ''}${prof ? '' : ' <span class="fs-9" style="color:rgb(var(--text-amber));">⚠ non-proficient</span>'}</span>
        <span class="fs-10_5 c-g70">Hardness <b class="c-gold">${g.hardness}</b></span>
        <b style="color:${barColor};">${g.hp}</b><span class="o-55 c-dim">/${g.maxHP}</span>
        <button class="fs-10 p-0-6 btn btn-sm" title="Incoming hit — enter the damage; the generator applies hardness and offers the split" onclick="armorIncomingHit('${it.id}')">⚔ Hit</button>
        <button class="fs-10 p-0-6 btn btn-sm" title="Repair points of damage (Repair skill / services / GM)" onclick="armorRepair('${it.id}')">🔧</button>
      </div>
      <div class="mt-2 bar-wrap" style="height:5px;"><div class="bar-fill" style="width:${pct}%;background:${barFill};"></div></div>
      ${state}
    </div>`;
  }).join('');
  host.innerHTML = `<div class="sec-head sm">Armor Integrity <span class="fs-9 c-g45 normal-case ls-0">· T/ACtical (HH p.382)</span></div>` + rows;
}
// The incoming-hit calculator. Input "damage [hardness-ignored]" (a magic
// weapon ignores 5/enh point, vibro-blades all); hardness reduces first, then
// the remainder is split — wearer's choice when proficient, attacker's when
// not (either way the generator just applies whatever split is entered).
function armorIncomingHit(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = armorItemIntegrity(it); if (!g) return;
  if (g.destroyed) { toast('That armor is destroyed — it no longer intercedes.'); return; }
  const name = enchantDisplayName(it);
  openChoiceModal(`⚔ Hit on ${name} — enter the raw damage, optionally followed by points of hardness ignored (e.g. "14" or "14 5" for a +1 weapon)`, [], (val) => {
    const m = /^(\d+)(?:\s+(\d+))?$/.exec(String(val || '').trim());
    if (!m) { toast('Enter the damage as a number, e.g. "14" or "14 5".'); return; }
    const dmg = parseInt(m[1], 10), ign = parseInt(m[2] || '0', 10);
    const effHard = Math.max(0, g.hardness - ign);
    const net = Math.max(0, dmg - effHard);
    const math = `${dmg} damage − hardness ${g.hardness}${ign ? ` (−${ign} ignored = ${effHard})` : ''} = ${net}`;
    if (net <= 0) {
      logAct(`Hit absorbed by ${name}: ${math}.`);
      save(); toast(`${name} shrugs it off — ${math}.`);
      return;
    }
    const prof = isProficientWithArmor(c, it.ref);
    const who = prof ? 'You are proficient — the wearer chooses' : '⚠ Non-proficient — the ATTACKER chooses';
    const optAll = `All ${net} to ${name} (HP ${g.hp} → ${g.hp - net})`;
    const optChar = `All ${net} to ${c.name} (HP ${c.currentHP ?? '?'} → ${(c.currentHP ?? 0) - net})`;
    const optSplit = 'Split it — enter how much the armor takes';
    openChoiceModal(`${math}. ${who} how to apply the remainder:`, [optAll, optChar, optSplit], (pick) => {
      const apply = (toArmor) => {
        toArmor = Math.max(0, Math.min(net, toArmor));
        const toChar = net - toArmor;
        if (toArmor) it.armorDamage = (it.armorDamage || 0) + toArmor;
        if (toChar && typeof c.currentHP === 'number') c.currentHP = Math.max(-999, c.currentHP - toChar);
        const g2 = armorItemIntegrity(it);
        logAct(`⚔ Hit on ${name}: ${math}; ${toArmor} to the ${g.isShield ? 'shield' : 'armor'} (${g2.hp}/${g2.maxHP})${toChar ? `, ${toChar} to ${c.name}` : ''}.${g2.destroyed ? ' ☠ DESTROYED.' : g2.broken ? ' ⚑ BROKEN — no AC bonus until repaired.' : ''}`);
        save(); renderArmorIntegrity(c); renderTracker(); renderSheet();
        toast(g2.destroyed ? `${name} is DESTROYED.` : g2.broken ? `${name} is BROKEN — no AC bonus until repaired.` : `Applied: ${toArmor} to ${name}${toChar ? `, ${toChar} to ${c.name}` : ''}.`);
      };
      if (pick === optAll) apply(net);
      else if (pick === optChar) apply(0);
      else if (pick === optSplit) openChoiceModal(`How much of the ${net} does ${name} take? (rest goes to ${c.name})`, [], (n) => {
        const v = parseInt(String(n || '').trim(), 10);
        if (isNaN(v)) { toast('Enter a number.'); return; }
        apply(v);
      });
    });
  });
}
function armorRepair(itemId) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const it = getCharItems(c).find(x => x.id === itemId); if (!it) return;
  const g = armorItemIntegrity(it); if (!g) return;
  const name = enchantDisplayName(it);
  if (g.destroyed) { toast(`${name} is destroyed — beyond repair (salvage only, HH p.181). The GM may adjudicate an exceptional restoration via ± on the item's damage in a future pass.`); }
  if (!g.damage) { toast(`${name} is undamaged.`); return; }
  openChoiceModal(`🔧 Repair ${name} — enter HP repaired (${g.damage} damage outstanding; Repair skill task table HH p.181, tool kit required)`, [], (val) => {
    const v = parseInt(String(val || '').trim(), 10);
    if (isNaN(v) || v <= 0) { toast('Enter a positive number.'); return; }
    // A destroyed item reaching this point is a deliberate GM override — logged as such below.
    it.armorDamage = Math.max(0, (it.armorDamage || 0) - v);
    const g2 = armorItemIntegrity(it);
    logAct(`🔧 Repaired ${Math.min(v, g.damage)} HP on ${name} (${g2.hp}/${g2.maxHP})${g.destroyed ? ' — GM override: repaired past the destroyed threshold' : ''}.`);
    save(); renderArmorIntegrity(c); renderSheet();
    toast(`${name}: ${g2.hp}/${g2.maxHP} HP${g2.broken ? ' — still broken' : ''}.`);
  });
}
