// =============================================================================
// js/ui/gear/cybernetics.js
// GEAR / CYBERNETICS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Gear page: the cybernetics panel.
//
// KEY NAMES (so you can search for them)
//   functions (4): toggleGearCyber, renderCybernetics, addCyberFromSel,
//   removeCyber
//
// WHERE IT CAME FROM
//   Gathered from js/rules/11-cybernetics.js when the code was regrouped by
//   topic and page. Each function and table moved whole and unchanged, with
//   the comments above it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function toggleGearCyber() {
  const w = document.getElementById('gear-cyber-wrap'), ch = document.getElementById('gear-cyber-chev');
  const open = w.style.display === 'none';
  w.style.display = open ? '' : 'none';
  ch.textContent = open ? '▾' : '▸';
}

function renderCybernetics(c) {
  const sumEl = document.getElementById('gear-cyber-summary'), body = document.getElementById('gear-cyber-body');
  if (!sumEl || !body) return;
  syncCyberFeats(c);  // v8.99.0 self-heal
  const ts = scenarioTechScale(c);
  const owned = getCyber(c);
  const max = cyberMax(c), count = cyberCount(c), excess = cyberExcess(c);
  const hasAntiShock = owned.some(r => r.n === 'Anti-Shock Implant');
  // summary line beside the section head
  if (ts < 5 && !owned.length) { sumEl.textContent = '— requires a Tech Scale 5+ scenario'; body.innerHTML = ''; return; }
  sumEl.innerHTML = `${count} of ${max} attachments` + (excess ? ` <span class="bold" style="color:rgb(var(--text-salmon));">⚠ +${excess} negative level${excess > 1 ? 's' : ''}</span>` : '');
  const bits = [];
  // doctrine strip
  const _ctN = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker').length;
  bits.push(`<div class="fs-11 mb-0_5rem" style="color:var(--tb75);">Maximum attachments = 1 + Con modifier${_ctN ? ` + Cybertaker ×${_ctN}` : ''} (${max}; supernatural Con excluded — HH p.333${_ctN ? '; Cybertaker p.209 stacks' : ''}). Each excess attachment = 1 negative level — the −1 on attack rolls, saves, grapple, and all skill checks is WIRED LIVE (v8.92.0) with provenance on each cell; the −1 on ability checks, −1 effective level on die rolls, and a caster/manifester's lost top-level spell/power stay at the table (choice-dependent). Removal without <i>Cybernetic Surgery</i>: 1d4 permanent Con drain. Implants cost −2 Purchase DC per Tech Scale above their own (scenario TS ${ts}).</div>`);
  if (owned.length && !hasAntiShock) bits.push(`<div class="fs-11 mb-0_5rem" style="color:rgb(var(--text-amber));" title="HH p.333: a creature with one or more cybernetic attachments takes 50% more damage from any attack that deals electricity damage. An Anti-Shock Implant (TS 6) negates this.">⚡ Electricity vulnerability: +50% electricity damage (no Anti-Shock Implant)</div>`);
  if (owned.length && hasAntiShock) bits.push(`<div class="fs-11 mb-0_5rem" style="color:var(--tg80);">⚡ Electricity vulnerability negated — Anti-Shock Implant.</div>`);
  if (hasLostArm(c)) {
    bits.push(hasCyberArm(c)
      ? `<div class="fs-11 mb-0_5rem" style="color:var(--tg80);">🦾 Lost Arm (drawback) — REPLACED by a cybernetic arm: off hand restored, two-handed weapons and the −2 Climb/Swim/grapple penalties lifted.</div>`
      : `<div class="fs-11 mb-0_5rem" style="color:rgb(var(--text-salmon));">🦾 Lost Arm (drawback) — no off hand, no two-handed weapons, −2 Climb/Swim/grapple. Install a Prosthetic Arm (any tier) to restore the arm; arm-mounted implants need the prosthetic first.</div>`);
  }
  // owned rows
  if (owned.length) {
    bits.push('<table class="mb-0_6rem sk-tbl"><thead><tr><th>Implant</th><th>Slot</th><th>Type</th><th>Hard/HP</th><th></th></tr></thead><tbody>');
    owned.forEach((r, i) => {
      const def = cyberDef(r.n) || {};
      const noCnt = def.cnt === 0 ? ' <span class="fs-9" style="color:var(--tg70);" title="Does not count toward the attachment maximum.">free</span>' : '';
      bits.push(`<tr><td><span style="cursor:help;border-bottom:1px dotted rgb(var(--line-sky) / .5);" title="${escapeHTML((def.d || '') + (def.rx && def.rx !== '—' ? '\nRestriction: ' + def.rx : ''))}">${escapeHTML(r.n)}</span>${r.param ? ` <span class="c-gold fs-11">(${escapeHTML(r.param)})</span>` : ''}${noCnt}</td><td class="fs-11">${CYBER_SLOTS[def.slot] || def.slot || ''}</td><td class="fs-11">${def.type || ''}</td><td class="fs-11">${escapeHTML(def.hard || '')}</td><td><button class="fs-10 btn btn-sm" onclick="removeCyber(${i})">✕</button></td></tr>`);
    });
    bits.push('</tbody></table>');
  }
  // add browser (TS-gated)
  const avail = CYBERNETICS_DB.filter(e => e.ts <= ts);
  if (avail.length) {
    bits.push(`<div class="gap-6 items-center flex-wrap" style="display:flex;"><select id="gear-cyber-sel" class="fs-11" style="max-width:330px;">` +
      avail.map((e, idx) => `<option value="${CYBERNETICS_DB.indexOf(e)}">${escapeHTML(e.n)} — TS ${e.ts} · PDC ${escapeHTML(String(cyberPDC(c, e)))}${e.rx !== '—' ? ' · ' + escapeHTML(e.rx) : ''}</option>`).join('') +
      `</select><button class="fs-10 btn btn-sm btn-pri" onclick="addCyberFromSel()">+ Install</button><span class="fs-10 o-55 c-dim">surgery assumed — Treat Injury / Cybernetic Surgery at the table</span></div>`);
  } else {
    bits.push(`<div class="fs-11 o-60 c-dim">No implants available at Tech Scale ${ts} — cybernetics begins at TS 5.</div>`);
  }
  body.innerHTML = bits.join('');
}

function addCyberFromSel() {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const sel = document.getElementById('gear-cyber-sel'); if (!sel) return;
  const def = CYBERNETICS_DB[Number(sel.value)]; if (!def) return;
  // Lost Arm interlock: arm-mounted implants need the prosthetic arm first.
  if (def.needsArm && !hasCyberArm(c)) { toast(`${def.n} mounts IN a prosthetic arm — install a Prosthetic Arm first (HH p.335${hasLostArm(c) ? '; Lost Arm: the prosthetic also restores the off hand' : ''}).`); return; }
  if (def.needsProsthetic && !hasCyberArm(c) && !getCyber(c).some(r => (cyberDef(r.n) || {}).replaceLeg)) { toast(`${def.n} attaches to a prosthetic limb — install a Prosthetic Arm or Leg first.`); return; }
  const finish = (param) => {
    c.cybernetics = getCyber(c).concat([{ n: def.n, ...(param ? { param } : {}), at: new Date().toLocaleDateString() }]);
    syncCyberFeats(c);  // v8.99.0: feat grants materialize immediately
    const exc = cyberExcess(c);
    save(); renderGear(); renderSheet(); renderSkills();
    logAct(`🦾 Installed ${def.n}${param ? ' (' + param + ')' : ''} — PDC ${cyberPDC(c, def)}${def.rx !== '—' ? ', ' + def.rx : ''}.${exc ? ` ⚠ ${exc} attachment${exc > 1 ? 's' : ''} over the maximum — ${exc} negative level${exc > 1 ? 's' : ''} until removed or Con rises.` : ''}`);
    toast(`${def.n} installed${exc ? ` — ⚠ over the attachment maximum (${exc} negative level${exc > 1 ? 's' : ''})` : ''}.`);
  };
  if (def.param === 'skill') {
    const classSkills = SKILLS.filter(sk => isClassSkill(sk.n, c)).map(sk => sk.n);
    openChoiceModal('Skill Implant — choose one CLASS skill (+2 competence)', classSkills, v => { if (v) finish(v); });
    return;
  }
  if (def.param === 'feat') {
    // v9.2.2 (Adam 2026-10-06; HH p.337 "cannot duplicate a metamagic or
    // psionic feat"): Magic and Power feats are not offered — the Psi
    // Implant is the one route to a Power feat (Wild Talent).
    openChoiceModal('Feat Implant — name the granted feat (prerequisites must be met; no Magic or Power feats)', (FEATS_DB.filter(f => f.family !== 'Magic' && f.family !== 'Power').map(f => f.n)), v => { if (v) finish(v); });
    return;
  }
  finish(null);
}

function removeCyber(idx) {
  const c = chars.find(x => x.id === curId); if (!c) return;
  const r = getCyber(c)[idx]; if (!r) return;
  c.cybernetics = getCyber(c).filter((_, i) => i !== idx);
  syncCyberFeats(c);  // v8.99.0: granted feats cascade away (HH p.337)
  save(); renderGear(); renderSheet(); renderSkills();
  logAct(`🦾 Removed ${r.n}. Without Cybernetic Surgery, removal deals 1d4 permanent Con drain (HH p.333) — adjudicate at the table.`);
  toast(`${r.n} removed — 1d4 permanent Con drain unless removed with Cybernetic Surgery.`);
}
