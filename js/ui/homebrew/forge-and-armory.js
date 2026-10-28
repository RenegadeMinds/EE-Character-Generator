// =============================================================================
// js/ui/homebrew/forge-and-armory.js
// HOMEBREW / FORGE AND ARMORY — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Homebrew Forge (custom feats) and Homebrew Armory
//   (custom gear) dialogs.
//
// KEY NAMES (so you can search for them)
//   tables and state: _hbPendingGrant
//   functions (24): hbOpen, hbClose, hbgOpen, hbgClose, hbgTypeChange,
//   hbgDtypeChange, hbgTechChange, hbgAutoSpeed, hbgSave, hbgDelete,
//   hbgRenderList, hbgExport, hbgImport, hbSave, hbSaveAndGrant,
//   hbRenderList, hbGrant, hbChoosePick, hbApplyGrant, hbRevoke, hbExport,
//   hbExportAll, hbDelete, hbImportFile
//
// WHERE IT CAME FROM
//   Gathered from js/rules/06-homebrew-forge-armory-monstrous.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function hbOpen() { hbRenderList(); document.getElementById('hb-choose-panel').style.display = 'none'; document.getElementById('hb-modal').style.display = 'block'; }
function hbClose() { document.getElementById('hb-modal').style.display = 'none'; }
function hbgOpen() { hbgRenderList(); hbgTypeChange(); document.getElementById('hbg-modal').style.display = 'block'; }
function hbgClose() { document.getElementById('hbg-modal').style.display = 'none'; }
function hbgTypeChange() {
  const w = document.getElementById('hbg-type').value === 'weapon';
  for (const el of document.querySelectorAll('.hbg-w')) el.style.display = w ? '' : 'none';
  for (const el of document.querySelectorAll('.hbg-a')) el.style.display = w ? 'none' : '';
  // v9.13.0 (§271): the standard-feature gadget list follows the type —
  // weapon gadgets for weapons, armor gadgets for armor (GADGETS_CATALOG).
  const sel = document.getElementById('hbg-gadget');
  if (sel) {
    const keep = sel.value;
    const kind = w ? 'weapon' : 'armor';
    sel.innerHTML = '<option value="">None</option>' + GADGETS_CATALOG
      .filter(g => g.type === kind)
      .map(g => `<option${g.name === keep ? ' selected' : ''}>${escapeHTML(g.name)}</option>`).join('');
  }
}
// v9.13.0 (§271): ionic and concussion are nonlethal BY DEFINITION (HH:
// "ionization" = electrical nonlethal; concussion grenades deal "nonlethal
// concussion damage") — picking them flips the lethality select, which
// stays editable for deliberate divergence.
function hbgDtypeChange() {
  const dt = document.getElementById('hbg-dtype').value;
  if (dt === 'ionic' || dt === 'concussion') document.getElementById('hbg-leth').value = 'nonlethal';
}
// v9.14.0 (§272): the tech-upgrade interlocks — Stun Pulse IS concussion
// damage and EMP IS ionic (Adam's gavels 3-4), so checking one sets the
// damage type (and nonlethal) and unchecks the other; Heavy Crit suggests
// the ×3 multiplier into the crit field (editable).
function hbgTechChange(which) {
  const stun = document.getElementById('hbg-stun'), emp = document.getElementById('hbg-emp');
  if (which === 'stun' && stun.checked) {
    emp.checked = false;
    document.getElementById('hbg-dtype').value = 'concussion'; hbgDtypeChange();
  }
  if (which === 'emp' && emp.checked) {
    stun.checked = false;
    document.getElementById('hbg-dtype').value = 'ionic'; hbgDtypeChange();
  }
  if (which === 'hcrit' && document.getElementById('hbg-hcrit').checked) {
    const cr = document.getElementById('hbg-crit');
    cr.value = cr.value.replace(/x\d+/i, 'x3');
    if (!/x3/i.test(cr.value)) cr.value = 'x3';
  }
}
function hbgAutoSpeed() {
  const t = document.getElementById('hbg-atype').value;
  document.getElementById('hbg-speed').value = t === 'light' || t === 'shield' ? '30’/20’' : '20’/15’';
}
function hbgSave() {
  const v = (id) => (document.getElementById(id) || {}).value || '';
  const name = v('hbg-name').trim();
  if (!name) { toast('The forge needs a name.'); return; }
  const isWeapon = v('hbg-type') === 'weapon';
  const canon = (isWeapon ? WEAPONS_CATALOG : ARMOR_CATALOG).some(e => e.name === name && !e.hb);
  if (canon) { toast(`"${name}" already exists in the canon catalogue — pick another name.`); return; }
  const ts = parseInt(v('hbg-ts'), 10) || 0;
  const dc = parseInt(v('hbg-dc'), 10) || 15;
  const weight = parseFloat(v('hbg-weight')) || 0;
  const notes = v('hbg-notes').trim();
  let rec;
  if (isWeapon) {
    const range = parseInt(v('hbg-range'), 10) || 0;
    const dt = v('hbg-dtype');
    rec = {
      n: name, cat: v('hbg-cat'), tl: ts, kind: v('hbg-kind'), name, ts,
      category: 'weapon', dc: String(dc), dmg_s: v('hbg-dmgs').trim() || '—', dmg_m: v('hbg-dmgm').trim() || '1d6',
      crit: v('hbg-crit').trim() || 'x2',
      tail: `${range ? range + '’ ' : ''}${weight} lb. ${dt.charAt(0).toUpperCase() + dt.slice(1)}`,
      damage_type: [dt], lethality: v('hbg-leth'), rof: [], rof_raw: null,
      magazine_raw: null, magazine_capacity: null, scale: 'character',
      hb: true, hb_notes: notes,
    };
  } else {
    const atype = v('hbg-atype');
    rec = {
      name, tl: ts, type: atype, category: 'armor', dc,
      ac_bonus: parseInt(v('hbg-ac'), 10) || 0,
      max_dex: v('hbg-mdex').trim() || '—', armor_check_penalty: v('hbg-acp').trim() || '+/-0',
      arcane_spell_failure: v('hbg-asf').trim() || '—', speed: v('hbg-speed').trim() || '30’/20’',
      weight: `${weight} lb.`, scale: 'character', hb: true, hb_notes: notes,
    };
    const sub = v('hbg-substance');
    if (sub && HBG_SUBSTANCES[sub]) {
      const subTS = HBG_SUBSTANCES[sub];
      const row = (ARMOR_HARDNESS_BY_TS[Math.min(subTS, 8)]);
      const cat = atype === 'shield' ? 'medium' : atype;  // p.384 has no shield column; medium row, GM may adjust
      rec.hb_substance = sub;
      rec.hb_hardness = subTS <= 4 ? rec.ac_bonus : ((row && row[cat] != null) ? row[cat] : rec.ac_bonus);
    }
  }
  // v9.13.0 (§271): the standard-feature gadget travels on the record.
  const gad = v('hbg-gadget');
  if (gad) rec.hb_gadget = gad;
  // v9.14.0 (§272): the gaveled Tech Upgrades (weapons only).
  if (isWeapon) {
    const chk = (id) => !!(document.getElementById(id) || {}).checked;
    const tech = {
      aa: parseInt(v('hbg-aa'), 10) || 0,
      stun: chk('hbg-stun'), emp: chk('hbg-emp'),
      reach: chk('hbg-reach'), heavyCrit: chk('hbg-hcrit'), powerPack: chk('hbg-ppack'),
    };
    if (tech.aa || tech.stun || tech.emp || tech.reach || tech.heavyCrit || tech.powerPack) rec.hb_tech = tech;
  }
  const i = homebrewGear.findIndex(r => r.name === name && (r.category === 'weapon') === isWeapon);
  if (i >= 0) homebrewGear[i] = rec; else homebrewGear.push(rec);
  hbgStoreSave(); hbGearSync(); hbgRenderList();
  if (curId) renderGear();
  toast(`⚒ ${name} forged${rec.hb_substance ? ` in ${rec.hb_substance} (hardness ${rec.hb_hardness}, native-TS row — HH p.384)` : ''} — it now sits in the ${isWeapon ? 'weapons' : 'armor'} catalogue (TS ${ts}, DC ${dc}).`);
}
function hbgDelete(i) {
  const r = homebrewGear[i]; if (!r) return;
  homebrewGear.splice(i, 1);
  hbgStoreSave(); hbGearSync(); hbgRenderList();
  if (curId) renderGear();
  toast(`${r.name} unmade. Owned copies on characters keep their records (the dossier loses its catalogue page).`);
}
function hbgRenderList() {
  const el = document.getElementById('hbg-list'); if (!el) return;
  el.innerHTML = homebrewGear.length
    ? homebrewGear.map((r, i) => {
        const line = (r.category === 'weapon'
          ? `${r.dmg_m} · ${r.crit} · ${r.tail}`
          : `+${r.ac_bonus} AC · ${r.type}${r.hb_substance ? ` · ${r.hb_substance} (hardness ${r.hb_hardness})` : ''} · ${r.weight}`)
          + (r.hb_gadget ? ` · ⚙ ${r.hb_gadget} (standard feature)` : '')
          + (r.hb_tech ? [r.hb_tech.aa ? (r.hb_tech.aa === 4 ? ' · ⚡⛏ Power Wpn' : ` · ⛏ AA ${['','I','II','III'][r.hb_tech.aa]}`) : '', r.hb_tech.stun ? ' · Stun Pulse' : '', r.hb_tech.emp ? ' · EMP' : '', r.hb_tech.reach ? ' · Reach +5′' : '', r.hb_tech.heavyCrit ? ' · ×3' : '', r.hb_tech.powerPack ? ' · ⚡pack' : ''].join('') : '');
        return `<div class="justify-between items-center gap-6 p-4-8 fs-12" style="display:flex;border-bottom:1px solid rgb(var(--line-gold) / .08);">
          <div><b>${escapeHTML(r.name)}</b> <span class="rounded-2 fs-9 p-1-5" style="background:rgb(var(--tint-sky) / .12);border:1px solid rgb(var(--line-sky) / .3);">${r.category === 'weapon' ? '⚔' : '🛡'} TS ${r.tl} · DC ${r.dc}</span>
            <div class="fs-10_5 op-0_6">${escapeHTML(line)}${r.hb_notes ? ` — ${escapeHTML(r.hb_notes)}` : ''}</div></div>
          <button class="fs-10 btn btn-sm btn-danger" onclick="hbgDelete(${i})">✕</button>
        </div>`;
      }).join('')
    : '<div class="fs-11 o-50 c-dim" style="padding:5px 6px;">Nothing forged yet — weapons and armor you author here join the shop catalogues and export as a file for your players.</div>';
}
function hbgExport() {
  const blob = new Blob([JSON.stringify({ _kind: 'ee-homebrew-gear', v: 1, gear: homebrewGear }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_Armory.json';
  a.click(); URL.revokeObjectURL(a.href);
}
function hbgImport(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      const list = Array.isArray(data) ? data : (data.gear || []);
      let added = 0;
      for (const r of list) {
        if (!r || !r.name || !r.category) continue;
        if ((r.category === 'weapon' ? WEAPONS_CATALOG : ARMOR_CATALOG).some(e => e.name === r.name && !e.hb)) continue;
        if (homebrewGear.some(x => x.name === r.name && x.category === r.category)) continue;
        r.hb = true; homebrewGear.push(r); added++;
      }
      hbgStoreSave(); hbGearSync(); hbgRenderList();
      toast(`⬆ Armory import: ${added} added.`);
    } catch (e) { toast('Import failed — not a valid armory file.'); }
    inp.value = '';
  };
  rd.readAsText(f);
}
async function hbSave() {
  const name = (document.getElementById('hb-name').value || '').trim();
  if (!name) { toast('Name the feat first.'); return; }
  if (getFeatData(name)) { toast('That name belongs to a catalog feat — choose another (collisions confuse the budget, prereq, and compliance engines).'); return; }
  const adj = [];
  for (let i = 0; i < 6; i++) adj.push(Math.max(-5, Math.min(5, parseInt((document.getElementById('hb-adj-' + i) || {}).value, 10) || 0)));
  const chooseN = Math.max(0, Math.min(5, parseInt((document.getElementById('hb-choose-n') || {}).value, 10) || 0));
  const grants = (document.getElementById('hb-grants').value || '').split(',').map(s => s.trim()).filter(Boolean);
  const unknown = grants.filter(g => !getFeatData(g));
  if (unknown.length && !(await confirmModal(`These granted feats are not in the catalog and will be skipped when granting:\n\n${unknown.join(', ')}\n\nEstablish anyway?`))) return;
  const rec = {
    name, family: document.getElementById('hb-family').value || 'Heritage',
    desc: (document.getElementById('hb-desc').value || '').trim(),
    pre: ((document.getElementById('hb-pre') || {}).value || '').trim(),  // v8.56.0: display-text prereqs (ex-Custom Feat form)
    adj, choose: chooseN ? { n: chooseN, count: 1 } : null,
    grants, waive: true,
    free: !!(document.getElementById('hb-free') || {checked: true}).checked,  // v8.55.1: per-feat price
    createdAt: new Date().toLocaleDateString(),
  };
  const existing = hbByName(name);
  if (existing) {
    if (!(await confirmModal(`"${name}" is already in the library — overwrite it? (Heroes already carrying it keep their granted snapshot.)`))) return;
    Object.assign(existing, rec);
  } else homebrewFeats.push(rec);
  hbStoreSave(); hbRenderList();
  ['hb-name', 'hb-desc', 'hb-grants', 'hb-pre'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  for (let i = 0; i < 6; i++) document.getElementById('hb-adj-' + i).value = 0;
  document.getElementById('hb-choose-n').value = 0;
  toast(`🌍 Established: ${name} — ${hbAdjSummary(rec)}.`);
  return name;  // v8.56.0: lets hbSaveAndGrant chain
}
// v8.56.0 (playtest issue #1): the one-step path the retired Custom Feat
// form used to offer — establish in the library AND grant to the current
// hero in a single click (the chooser flow still interposes for
// player-chosen attribute bonuses).
async function hbSaveAndGrant() {
  if (!curId || !chars.find(x => x.id === curId)) { toast('Select a hero first (Roster tab) — Establish alone still saves to the library.'); return; }
  const name = await hbSave();
  if (!name) return;
  const i = homebrewFeats.findIndex(r => r.name === name);
  if (i >= 0) hbGrant(i);
}
function hbRenderList() {
  const el = document.getElementById('hb-list');
  if (!el) return;
  const c = curId ? chars.find(x => x.id === curId) : null;
  el.innerHTML = homebrewFeats.length
    ? homebrewFeats.map((r, i) => {
        const has = c && (c.feats || []).some(f => (f.name || f.n) === r.name);
        return `<div class="items-center gap-8 fs-11_5" style="display:flex;padding:4px 6px;border-top:1px solid rgb(var(--line-gold) / .12);">
          <span>🌍 <b>${escapeHTML(r.name)}</b> <span class="o-60 c-dim">[${escapeHTML(r.family)}] ${escapeHTML(hbAdjSummary(r))}</span>${r.desc ? ` <span class="op-0_45 cursor-help" title="${escapeHTML(r.desc)}">✎</span>` : ''}</span>
          <span class="ml-auto gap-5" style="display:inline-flex;">
            ${c ? (has
              ? `<button class="fs-10 p-1-7 btn btn-sm" onclick="hbRevoke(${i})" title="Remove from ${escapeHTML(c.name)} — reverses the attribute bake (and its HP effect) and withdraws the granted feats this grant added.">↩ Revoke</button>`
              : `<button class="fs-10 p-1-7 btn btn-sm btn-pri" onclick="hbGrant(${i})" title="Grant to ${escapeHTML(c.name)} — free: no slot, no budget, prereqs waived.">＋ Grant</button>`)
              : '<span class="fs-10 o-40 c-dim">select a hero</span>'}
            <button class="fs-10 p-1-7 btn btn-sm" onclick="hbExport(${i})" title="Download this feat as a file.">⬇</button>
            <button class="fs-10 p-1-7 btn btn-sm" onclick="hbDelete(${i})" title="Remove from the library. Heroes already carrying it are untouched (their snapshot is self-contained).">✕</button>
          </span></div>`;
      }).join('')
    : '<div class="fs-11 o-50 c-dim" style="padding:5px 6px;">Nothing established yet — homebrew feats you author here can be granted to any hero and exported as a file for your players.</div>';
}
let _hbPendingGrant = null;
function hbGrant(i) {
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[i];
  if (!c || !r) return;
  if ((c.feats || []).some(f => (f.name || f.n) === r.name)) { toast(`${c.name} already has ${r.name}.`); return; }
  if (r.choose && r.choose.n) {
    _hbPendingGrant = { i };
    document.getElementById('hb-choose-label').textContent = `${r.name}: +${r.choose.n} to which attribute for ${c.name}?`;
    document.getElementById('hb-choose-panel').style.display = 'block';
    return;
  }
  hbApplyGrant(c, r, null);
}
function hbChoosePick(attrIdx) {
  const p = _hbPendingGrant; _hbPendingGrant = null;
  document.getElementById('hb-choose-panel').style.display = 'none';
  if (!p) return;
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[p.i];
  if (c && r) hbApplyGrant(c, r, attrIdx);
}
function hbApplyGrant(c, r, choiceIdx) {
  const applied = (r.adj || [0,0,0,0,0,0]).slice();
  if (choiceIdx !== null && r.choose && r.choose.n) applied[choiceIdx] = (applied[choiceIdx] || 0) + r.choose.n;
  const oldConMod = am(c.attrs[2]);
  for (let k = 0; k < 6; k++) c.attrs[k] = (c.attrs[k] || 10) + (applied[k] || 0);
  // Con changes retro-adjust HP per RAW (mod delta × character level).
  const dMod = am(c.attrs[2]) - oldConMod;
  const hpDelta = dMod * (c.totalLvl || 1);
  if (hpDelta) { c.maxHP = Math.max(1, (c.maxHP || 1) + hpDelta); c.currentHP = Math.max(1, Math.min((c.currentHP || 1) + hpDelta, c.maxHP)); c.hp = c.maxHP; }
  // The homebrew entry itself. v8.55.1: the feat sets its own price — FREE
  // carries grantedBy (excluded from budget/compliance automatically); a
  // feat that COSTS A SELECTION omits grantedBy so it counts against the
  // budget like any picked feat (the reconciler's removal loop only touches
  // grantedBy entries, so paid entries are naturally safe; _hb children are
  // expected either way). Child grants are part of the feat's effect and
  // stay free in both modes.
  const grantsAdded = [];
  for (const g of (r.grants || [])) {
    if (!getFeatData(g)) continue;                          // catalog-existence guard
    if (hasFeatNamed(c, g)) continue;                       // duplicate grant does nothing (d20 convention)
    c.feats.push({ name: g, grantedBy: r.name + ' (homebrew)' });
    grantsAdded.push(g);
  }
  const isFree = r.free !== false;
  const entry = {
    name: r.name,
    _legacy: { t: r.family || 'Heritage', pre: (r.pre && r.pre.trim()) ? r.pre + ' (GM adjudicates)' : 'None — GM-approved', d: r.desc || '' },
    _hb: { adj: applied, hpDelta, grantsAdded, choice: choiceIdx !== null ? ATTR_NAMES[choiceIdx] : null, free: isFree },
  };
  if (isFree) entry.grantedBy = 'Homebrew (GM grant)';
  c.feats.push(entry);
  logAct(`🌍 ${r.name} granted (GM homebrew): ${hbAdjSummary(r)}${choiceIdx !== null ? ` — choice: ${ATTR_NAMES[choiceIdx]}` : ''}${hpDelta ? ` · HP ${hpDelta > 0 ? '+' : ''}${hpDelta} (Con modifier × level, RAW retro-adjust)` : ''}. ${isFree ? 'Free — no slot, no budget' : 'Costs a feat selection — counted against the feat budget'}; prereqs waived.`);
  save(); hbRenderList(); renderFeats(); renderSheet();
  toast(`🌍 ${r.name} → ${c.name}.`);
}
async function hbRevoke(i) {
  const c = chars.find(x => x.id === curId);
  const r = homebrewFeats[i];
  if (!c || !r) return;
  const idx = (c.feats || []).findIndex(f => (f.name || f.n) === r.name && f._hb);
  if (idx < 0) { toast('No revocable homebrew snapshot found on this hero.'); return; }
  if (!(await confirmModal(`Revoke ${r.name} from ${c.name}? Attribute adjustments (and any HP effect) reverse; granted feats this grant added are withdrawn.`))) return;
  const entry = c.feats[idx];
  hbReverseEntry(c, entry);
  // Re-locate by reference — the reversal's child splices shift indices.
  const idx2 = c.feats.indexOf(entry);
  if (idx2 >= 0) c.feats.splice(idx2, 1);
  save(); hbRenderList(); renderFeats(); renderSheet();
  toast(`↩ ${r.name} revoked from ${c.name}.`);
}
function hbExport(i) {
  const r = homebrewFeats[i]; if (!r) return;
  const blob = new Blob([JSON.stringify({ _eeHomebrew: 1, feats: [r] }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_' + r.name.replace(/[^a-z0-9]+/gi, '_') + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function hbExportAll() {
  if (!homebrewFeats.length) { toast('Library is empty.'); return; }
  const blob = new Blob([JSON.stringify({ _eeHomebrew: 1, feats: homebrewFeats }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'EE_Homebrew_Library.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`⬇ ${homebrewFeats.length} homebrew feat${homebrewFeats.length === 1 ? '' : 's'} exported.`);
}
async function hbDelete(i) {
  const r = homebrewFeats[i]; if (!r) return;
  if (!(await confirmModal(`Delete "${r.name}" from the library?\n\nHeroes already carrying it keep their grant (the snapshot on the character is self-contained) — this only removes it from the authoring list.`))) return;
  homebrewFeats.splice(i, 1); hbStoreSave(); hbRenderList();
}
function hbImportFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const x = JSON.parse(rd.result);
      const arr = Array.isArray(x) ? x : (x.feats || [x]);
      let added = 0, renamed = 0, skipped = 0;
      for (const s of arr) {
        if (!s || typeof s.name !== 'string' || !s.name.trim()) { skipped++; continue; }
        let nm = s.name.trim();
        if (getFeatData(nm)) { nm += ' (homebrew)'; renamed++; }
        if (hbByName(nm)) { const base = nm; let k = 2; while (hbByName(nm)) nm = `${base} (${k++})`; renamed++; }
        const adj = []; for (let k2 = 0; k2 < 6; k2++) adj.push(Math.max(-5, Math.min(5, Math.round((s.adj || [])[k2] || 0))));
        homebrewFeats.push({ name: nm, family: s.family || 'Heritage', desc: typeof s.desc === 'string' ? s.desc : '',
          adj, choose: (s.choose && s.choose.n) ? { n: Math.max(0, Math.min(5, Math.round(s.choose.n))), count: 1 } : null,
          grants: Array.isArray(s.grants) ? s.grants.filter(g => typeof g === 'string') : [], waive: true,
          free: s.free !== false,  // v8.55.1: price travels with the file
          createdAt: s.createdAt || new Date().toLocaleDateString() });
        added++;
      }
      hbStoreSave(); hbRenderList();
      toast(`⬆ Homebrew import: ${added} added${renamed ? `, ${renamed} renamed` : ''}${skipped ? `, ${skipped} skipped` : ''}.`);
    } catch (e) { toast('Import failed: ' + e.message); }
    inp.value = '';
  };
  rd.readAsText(f);
}
