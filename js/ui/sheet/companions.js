// =============================================================================
// js/ui/sheet/companions.js
// SHEET / COMPANIONS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Sheet: the companions panel.
//
// KEY NAMES (so you can search for them)
//   functions (5): addCompanion, removeCompanion, renameCompanion,
//   renderCompanions, setRangerCombatStyle
//
// WHERE IT CAME FROM
//   Gathered from js/rules/18-companions.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function addCompanion(kind, species) {
  const c = chars.find(x => x.id === curId); if (!c || !species) return;
  if (!c.companions) c.companions = [];
  c.companions.push({ id: 'comp_' + Math.random().toString(36).slice(2, 8), kind, species, name: '' });
  logAct(`🐾 Gained a ${kind === 'familiar' ? 'familiar' : kind === 'mount' ? 'special mount' : 'animal companion'}: ${species}.`);
  save(); renderSheet(); renderSkills();
}
function removeCompanion(id) {
  const c = chars.find(x => x.id === curId); if (!c || !c.companions) return;
  const comp = c.companions.find(x => x.id === id);
  // v9.4.0: an owned animal's card and its Gear item go together (sold, lost, freed).
  if (comp && comp.kind === 'owned') { c.items = (c.items || []).filter(i => i.id !== comp.itemId); c.companions = c.companions.filter(x => x.id !== id); logAct(`🐴 ${comp.name || comp.species} — no longer owned.`); save(); renderSheet(); renderGear(); return; }
  if (comp && comp.kind === 'familiar' && !confirm('Dismissing/losing a familiar: DC 15 Fort save or lose 200 XP per level (half on success); no replacement for a year and a day (HH p.102). Remove?')) return;
  c.companions = c.companions.filter(x => x.id !== id);
  save(); renderSheet(); renderSkills();
}
function renameCompanion(id) {
  const c = chars.find(x => x.id === curId); if (!c || !c.companions) return;
  const comp = c.companions.find(x => x.id === id); if (!comp) return;
  const nm = prompt('Companion name:', comp.name || '');
  if (nm !== null) { comp.name = nm.trim(); save(); renderSheet(); }
}
function renderCompanions(c) {
  const host = document.getElementById('sh-companions');
  if (!host) return;
  if (syncOwnedAnimals(c)) save();   // v9.4.0: self-heal owned-animal cards
  const ml = companionMasterLevels(c);
  const comps = c.companions || [];
  const adders = [];
  if (ml.familiar > 0 && !comps.some(x => x.kind === 'familiar')) adders.push(['familiar', 'Familiar', FAMILIAR_SPECIES]);
  if (ml.animal > 0 && !comps.some(x => x.kind === 'animal')) adders.push(['animal', 'Animal Companion', ANIMAL_COMPANION_SPECIES]);
  if (ml.mount > 0 && !comps.some(x => x.kind === 'mount')) adders.push(['mount', 'Special Mount', MOUNT_SPECIES]);
  if (!comps.length && !adders.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  const cards = comps.map(comp => {
    const base = COMPANION_BASE_STATS[comp.species] || null;
    const d = companionDerived(comp, c);
    const baseLines = base ? (base.ref
      ? `<div class="op-0_7">Base stats: ${escapeHTML(base.ref)}</div>`
      : `<div class="op-0_85">${escapeHTML(base.size)} · HD ${escapeHTML(base.hd)} · AC ${escapeHTML(base.ac)} · Spd ${escapeHTML(base.spd || '—')}<br>
         Atk ${escapeHTML(base.fatk || base.atk)} · Saves ${escapeHTML(base.saves || '—')}<br>
         ${escapeHTML(base.attrs || '')}${base.sq ? `<br>SQ: ${escapeHTML(base.sq)}` : ''}${base.carry ? `<br>Carrying: ${escapeHTML(base.carry)}` : ''}${base.sa && base.sa !== '—' && base.sa !== '-' ? ` · SA: ${escapeHTML(base.sa)}` : ''}
         <span class="o-55 c-dim">(FF p.${base.page}${comp.kind === 'owned' ? '' : ' — base animal, before the adjustments below'})</span></div>`)
      : `<div class="op-0_6">Base stats: see the Foe Folio.</div>`;
    const kindLbl = comp.kind === 'familiar' ? '🦉 Familiar' : comp.kind === 'mount' ? '🐎 Special Mount' : comp.kind === 'owned' ? '🐴 Owned animal' : '🐾 Animal Companion';
    return `<div class="p-5-8 m-4-0 fs-11 lh-1_5" style="border:1px solid rgba(200,151,30,.25);border-radius:3px;">
      <b style="color:rgba(120,175,205,.95);">${kindLbl}: ${escapeHTML(comp.name || comp.species)}</b>${comp.name ? ` <span class="o-60 c-dim">(${escapeHTML(comp.species)})</span>` : ''}
      <span class="cursor-pointer fs-10 op-0_6 ml-6" onclick="renameCompanion('${comp.id}')" title="Name this companion">✎</span>
      <span class="cursor-pointer fs-10 op-0_6" onclick="removeCompanion('${comp.id}')" title="Remove">✕</span>
      ${baseLines}
      <div class="c-g85">${escapeHTML(d.line)}</div>
      ${d.specials ? `<div>Special: ${escapeHTML(d.specials)}</div>` : ''}
      ${d.perk ? `<div style="color:#78afcd;">${escapeHTML(d.perk)}</div>` : ''}
      ${d.magicalBeast ? `<div class="op-0_65">${escapeHTML(d.magicalBeast)}</div>` : ''}
    </div>`;
  }).join('');
  const adderHTML = adders.map(([kind, lbl, species]) =>
    `<span class="fs-11">${lbl}: <select onchange="if(this.value){addCompanion('${kind}', this.value);this.value='';}" class="fs-11"><option value="">— choose species —</option>${species.map(s => `<option>${escapeHTML(s)}</option>`).join('')}</select></span>`
  ).join(' · ');
  host.innerHTML = `<div class="font-serif fs-10 c-bronze mb-4">🐾 Companions</div>${cards}${adderHTML ? `<div class="mt-4">${adderHTML}</div>` : ''}`;
}

// v8.6.1: Ranger Combat Style choice (HH: picked at Ranger 2). Lazy field —
// legacy characters simply show the picker until a style is chosen.
function setRangerCombatStyle(v) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  c.rangerCombatStyle = v || null;
  save(); renderGear();
  if (v) toast(v === 'twf' ? 'Combat style: two-weapon — virtual TWF applies in light or no armor.' : 'Combat style: archery — virtual Rapid Shot in light or no armor.');
}
