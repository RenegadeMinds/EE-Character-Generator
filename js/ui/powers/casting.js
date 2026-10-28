// =============================================================================
// js/ui/powers/casting.js
// POWERS / CASTING — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Casting: the cast-options dialog, Mental Pinnacle and
//   the cast result.
//
// KEY NAMES (so you can search for them)
//   functions (5): openCastOptions, chooseMentalPinnacle, castPowerAt,
//   renderCastResult, dismissCastResult
//
// WHERE IT CAME FROM
//   Gathered from js/app/61-casting-augments-and-powers-page.js when the
//   code was regrouped by topic and page. Each function and table moved
//   whole and unchanged, with the comments above it, including the original
//   version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// The cast-options dialog. Returns a Promise resolving to the chosen options
// (or null on cancel). Built lazily; plain overlay in the house style.
function openCastOptions(ctx) {
  return new Promise((resolve) => {
    let host = document.getElementById('cast-opt-modal');
    if (!host) { host = document.createElement('div'); host.id = 'cast-opt-modal'; document.body.appendChild(host); }
    // v8.63.0 (Adam's B3 ruling): ctx.prep repurposes this dialog as the
    // MEMORIZATION declaration stage — all Magic-feat (and augment) costs
    // are paid at spell selection, per instance ("a Quickened spell is
    // memorized in the morning, and... cast as a swift action" thereafter).
    const { c, spell, pool, lvl, baseCost, cap, aug, metas, canHeighten, canOverchannel, ocMax, spont, isBuff, prep } = ctx;
    const capLabel = POOL_EFF_LEVEL[pool] ? POOL_EFF_LEVEL[pool].abbr : pool;
    const metaRows = metas.map((m, i) => {
      const ok = m.chk(spell);
      const powerKind = pool === 'psionic' || pool === 'super';
      return `<label style="display:flex;gap:6px;align-items:baseline;font-size:12px;margin:2px 0;${ok ? '' : 'opacity:.45;'}">
        <input type="${powerKind ? 'radio' : 'checkbox'}" name="co-meta${powerKind ? '-radio' : '-' + i}" data-i="${i}" ${ok ? '' : 'disabled'} onchange="__coUpdate()">
        <span>${m.name} <b class="c-gold">${m.pp ? '+' + m.pp + ' PP' : 'no PP'}</b>${powerKind ? ' <span class="fs-10" style="color:rgb(var(--text-sky));">+ focus</span>' : ''}
        <span class="op-0_65 fs-10_5"> — ${ok ? m.fx : '✗ ' + (m.why || 'not applicable')}</span></span></label>`;
    }).join('');
    const heightenRow = canHeighten ? `<div class="fs-12 m-4-0">Heighten Spell to level
      <select id="co-heighten" onchange="__coUpdate()">${[0].concat(Array.from({length: 9 - lvl}, (_, k) => lvl + 1 + k)).map(v => `<option value="${v}">${v === 0 ? '— (off)' : v + ' (cost ' + Math.max(baseCost, PP_COST_BY_POWER_LEVEL[v]) + ' PP, DC scales)'}</option>`).join('')}</select></div>` : '';
    const ocRow = canOverchannel ? `<div class="fs-12 m-4-0">Overchannel
      <select id="co-oc" onchange="__coUpdate()">${[0, 1, 2, 3].filter(v => v <= ocMax).map(v => `<option value="${v}">${v === 0 ? '— (off)' : '+' + v + ' EPL (take ' + [0, '1d8', '3d8', '5d8'][v] + ')'}</option>`).join('')}</select>
      <span class="op-0_6 fs-10_5">raises the augment cap; damage rolls on cast${(c.feats || []).some(f => f.name === 'Talented') ? ' (Talented: expend focus to avoid, powers ≤3rd)' : ''}</span></div>` : '';
    // v8.44.0 (Cut 3): option-aware augments — multi-option powers get one
    // stepper (or checkbox) PER printed option; the generic single stepper
    // survives for everything else.
    const augOpts = (AUGMENT_OPTIONS[spell.name]) || null;
    const augRow = augOpts ? `<div class="m-4-0 fs-12"><div class="fs-10 c-bronze uppercase ls-0_05em">Augment options (independent purchases)</div>
      ${augOpts.map((o, i) => o.once
        ? `<label class="gap-6 items-baseline m-2-0" style="display:flex;"><input type="checkbox" id="co-opt-${i}" onchange="__coUpdate()"> <span>${escapeHTML(o.label)} <b class="c-gold">+${o.step} PP</b></span></label>`
        : `<div class="m-2-0">${escapeHTML(o.label)} <span class="o-65 c-dim">(per ${o.step} PP)</span> ×<input type="number" id="co-opt-${i}" value="0" min="0" style="width:56px;" oninput="__coUpdate()"></div>`).join('')}
      <div class="fs-10_5 c-g70 mt-2" style="max-height:60px;overflow:auto;">${escapeHTML(aug ? aug.text : '')}</div></div>`
    : aug ? `<div class="m-4-0 fs-12">Augment: +<input type="number" id="co-aug" value="0" min="0" step="${aug.step || 1}" style="width:64px;" oninput="__coUpdate()"> PP
      ${aug.step ? `<span class="op-0_65 fs-10_5">(steps of ${aug.step})</span>` : ''}
      <div class="fs-10_5 c-g70 mt-2" style="max-height:70px;overflow:auto;">${escapeHTML(aug.text)}</div></div>` : '';
    host.innerHTML = `<div class="items-center" style="position:fixed;inset:0;background:rgb(var(--tint-black) / .72);z-index:9000;display:flex;justify-content:center;" onclick="if(event.target===this)__coDone(false)">
      <div class="rounded-6" style="background:rgb(var(--tint-night2));border:1px solid rgb(var(--line-gold) / .5);padding:14px 18px;max-width:520px;width:92%;max-height:82vh;overflow:auto;">
        <div class="font-serif c-gold mb-6" style="font-size:15px;">${prep ? '📜' : '⚡'} ${escapeHTML(spell.name)} — ${prep ? 'memorization options' : 'cast options'}</div>
        <div class="fs-11_5 c-g70 mb-6">Base ${baseCost} PP (level ${lvl}${isBuff ? ', Buff — 0 PP unaugmented' : ''}) · cap: total ≤ ${capLabel} ${cap}<span id="co-capnote"></span></div>
        ${prep ? `<div class="fs-10_5 mb-6" style="color:rgb(var(--text-amber));">Prepared casting: ALL Magic-feat and augment costs are paid NOW, at memorization — this particular instance then casts at no PP with everything baked in (a Quickened instance casts as a swift action). Other instances of the same spell memorize at their standard cost unless likewise declared.</div>` : ''}
        ${augRow}${metaRows ? `<div class="m-4-0"><div class="fs-10 c-bronze uppercase ls-0_05em">${pool === 'psionic' || pool === 'super' ? 'Power feats (one per manifestation — one focus)' : 'Magic feats'}</div>${metaRows}</div>` : ''}
        ${heightenRow}${ocRow}
        ${spont.any && (pool === 'arcane' || pool === 'divine') ? `<div class="fs-10_5 m-4-0" style="color:rgb(var(--text-amber));">Spontaneous casting (Saint/Sorcerer/Bard): any Magic feat escalates the cast to a full-round action; Quicken Spell is barred on spontaneous casts (HH pp.238/340).</div>` : ''}
        <div id="co-total" class="fs-13" style="margin:8px 0 4px;color:var(--gold);"></div>
        <div class="gap-8 justify-end" style="display:flex;">
          <button class="btn btn-sm" onclick="__coDone(false)">Cancel</button>
          <button class="btn btn-sm btn-pri" id="co-cast" onclick="__coDone(true)">${prep ? '📜 Memorize' : '⚡ Cast'}</button>
        </div>
      </div></div>`;
    const state = () => {
      // v8.44.0: per-option purchases (augPicks = {id: purchase count};
      // extra = the summed PP so every downstream cap/cost check is
      // unchanged). Generic stepper path preserved for single-option powers.
      let extra = 0, augPicks = null;
      if (augOpts) {
        augPicks = {};
        augOpts.forEach((o, i) => {
          const el = document.getElementById('co-opt-' + i);
          const n = o.once ? (el && el.checked ? 1 : 0) : Math.max(0, parseInt((el || {}).value, 10) || 0);
          if (n > 0) { augPicks[o.id] = n; extra += n * o.step; }
        });
      } else if (aug) {
        extra = Math.max(0, parseInt((document.getElementById('co-aug') || {}).value, 10) || 0);
      }
      const hl = canHeighten ? parseInt((document.getElementById('co-heighten') || {}).value, 10) || 0 : 0;
      const oc = canOverchannel ? parseInt((document.getElementById('co-oc') || {}).value, 10) || 0 : 0;
      const chosen = [];
      host.querySelectorAll('input[type=checkbox]:checked,input[type=radio]:checked').forEach(el => { const m = metas[parseInt(el.dataset.i, 10)]; if (m) chosen.push(m); });
      const base = hl ? Math.max(baseCost, PP_COST_BY_POWER_LEVEL[hl]) : baseCost;
      const total = base + extra + chosen.reduce((s, m) => s + m.pp, 0);
      return { extra, hl, oc, chosen, base, total, augPicks };
    };
    window.__coUpdate = () => {
      const s = state();
      const capNow = cap + s.oc;
      const over = s.total > capNow;
      let fxBits = [];
      if (augOpts && s.augPicks) {
        // v8.44.0: the itemized pre-deduction summary — each purchased
        // option with its contribution, before a single PP moves.
        for (let i = 0; i < augOpts.length; i++) {
          const o = augOpts[i], n = s.augPicks[o.id] || 0;
          if (!n) continue;
          if (o.kind === 'dice') {
            const dice = n * o.dice.n;
            fxBits.push(`+${dice}d${o.dice.d} damage (${n * o.step} PP)`);
            if (o.dcEveryDice) { const dc = Math.floor(dice / o.dcEveryDice); if (dc) fxBits.push(`save DC +${dc}`); }
          } else if (o.kind === 'bonus') fxBits.push(`+${n} ${o.label.replace(/^\+1 /, '')} (${n * o.step} PP)`);
          else if (o.kind === 'duration') fxBits.push(`+${n * (o.rounds || 1)} round${n * (o.rounds || 1) === 1 ? '' : 's'} (${n * o.step} PP)`);
          else if (o.kind === 'count') fxBits.push(`+${n} ${o.noun}${n === 1 ? '' : 's'} (${n * o.step} PP)`);
          else fxBits.push(`${o.label} (${o.step} PP)`);
        }
      } else if (aug && aug.dice && aug.step && s.extra > 0) {
        const steps = Math.floor(s.extra / aug.step);
        const dice = steps * aug.dice.n;
        fxBits.push(`+${dice}d${aug.dice.d} ${aug.diceLabel}`);
        let dc = 0;
        if (aug.dcEveryDice) dc = Math.floor(dice / aug.dcEveryDice);
        else if (aug.dcEveryStep) dc = steps;
        if (dc > 0) fxBits.push(`save DC +${dc}`);
      } else if (aug && s.extra > 0) fxBits.push('see Augment text');
      document.getElementById('co-total').innerHTML = `Total: <b>${s.total} PP</b> vs cap ${capNow}${s.oc ? ' (incl. Overchannel +' + s.oc + ')' : ''}${fxBits.length ? ' · ' + fxBits.join(' · ') : ''}${over ? ' <b class="c-red-text">— OVER CAP (GM exception required)</b>' : ''}`;
    };
    window.__coDone = (go) => {
      const s = go ? state() : null;
      host.innerHTML = '';
      delete window.__coUpdate; delete window.__coDone;
      resolve(go ? s : null);
    };
    window.__coUpdate();
  });
}
async function chooseMentalPinnacle() {
  const picks = [];
  for (let i = 0; i < MENTAL_PINNACLE_PAIRS.length; i++) {
    const [atk, def] = MENTAL_PINNACLE_PAIRS[i];
    const sel = await new Promise(res => openChoiceModal(
      `Mental Pinnacle — pair ${i + 1}/5: choose your mode`,
      [`${atk} (Attack Mode)`, `${def} (Defense Mode)`], res));
    if (!sel) return null;
    picks.push(sel.startsWith(atk) ? atk : def);
  }
  const remaining = MENTAL_PINNACLE_PAIRS.flat().filter(n => !picks.includes(n));
  const sixth = await new Promise(res => openChoiceModal(
    'Mental Pinnacle — the sixth pick: any one of the remaining modes', remaining, res));
  if (!sixth) return null;
  picks.push(sixth);
  return picks;
}

async function castPowerAt(idx) {
  const c = currentChar(); if (!c) return;
  const p = getCharPowers(c)[idx]; if (!p) return;
  const spell = SPELLS_DB.find(s => s.name === p.name);
  if (!spell) { toast('Catalogue entry not found.'); return; }
  if (!(await instantGateOK(c, spell, p.pool))) return;  // v8.57.0 instantaneous-resolution gate
  // v8.5.3: pool 'super' manifests from the super-PP pool (MP + EML² + Wis
  // bonus); Buff super-powers cost 0 PP unaugmented (HH p.423).
  const isSuper = p.pool === 'super';
  const poolsInfo = getCasterPoolsInfo(c);
  const routes = isSuper ? [] : spellPoolOptions(spell, poolsInfo).filter(o => o.pool === p.pool);
  // v8.57.0: a prepared-only entry has no pay-at-cast route — the PP went at
  // dawn. Reroute to memorization (defense in depth behind the row-button
  // swap in renderPowers; stale DOM and scripted calls land here too).
  if (!isSuper && (p.pool === 'arcane' || p.pool === 'divine') && routes.length
      && !spellPoolOptions(spell, nonPreppedPoolsInfo(c)).some(o => o.pool === p.pool)) {
    return memorizeKnownAt(idx);
  }
  const lvl = routes.length ? Math.min(...routes.map(o => o.lvl))
    : ((spell.levels && spell.levels.length) ? Math.min(...spell.levels.map(l => l.lvl)) : 1);
  const baseCost = (isSuper && p.buff) ? 0 : castCostFor(c, spell, p.pool, lvl);

  // v8.21.0 Segments B & C: the cast-options stage — augment stepper, meta-
  // feat toggles, Heighten, Overchannel. Skipped entirely when the character
  // brings none of it to this entry (the old one-click cast survives).
  const aug = parseAugmentSpec(spell);
  const featSet = new Set((c.feats || []).map(f => f.name));
  const poolKind = (p.pool === 'psionic' || isSuper) ? 'power' : 'spell';
  const metas = META_FEAT_DEFS[poolKind].filter(m => featSet.has(m.name));
  const spont = poolSpontaneity(c, p.pool);
  // Quicken Spell is BARRED on spontaneous casts (a Magic feat on a
  // spontaneous cast is a full-round action, and Quicken cannot apply).
  const metasOffered = metas.filter(m => !(m.name === 'Quicken Spell' && spont.all));
  const cap = isSuper ? getMPState(c).eml : (computeCasterLevels(c)[p.pool] || 1);
  const canHeighten = poolKind === 'spell' && featSet.has('Heighten Spell') && lvl < 9;
  const epl = computeCasterLevels(c).psionic || 1;
  const canOverchannel = p.pool === 'psionic' && featSet.has('Overchannel');
  const ocMax = epl >= 15 ? 3 : epl >= 8 ? 2 : 1;
  let opts = { extra: 0, hl: 0, oc: 0, chosen: [], base: baseCost, total: baseCost, augPicks: null };
  if (aug || metasOffered.length || canHeighten || canOverchannel) {
    const picked = await openCastOptions({ c, spell, pool: p.pool, lvl, baseCost, cap, aug, metas: metasOffered, canHeighten, canOverchannel, ocMax, spont, isBuff: isSuper && p.buff });
    if (!picked) return;
    opts = picked;
  }
  const lvlEff = opts.hl || lvl;
  const cost = opts.total;
  const capNow = cap + opts.oc;
  const pp = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);

  if (cost > capNow) {
    if (!(await confirmModal(
      `${spell.name} would total ${cost} PP, over the ${POOL_EFF_LEVEL[p.pool].abbr} cap of ${capNow} ("you can spend only a total number of points on a power equal to your manifester level" — HH p.403).\n\nCast anyway as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `cast at ${cost} PP over the ${POOL_EFF_LEVEL[p.pool].abbr} cap of ${capNow}`);
  }
  if (cost > pp.current) {
    if (!(await confirmModal(
      `${spell.name} costs ${cost} PP, but the ${p.pool} pool has only ${pp.current}/${pp.max}.\n\nCast anyway as a GM-approved exception? (The pool drains to 0.)`))) return;
    logPowerException(c, spell.name, `cast at ${cost} PP with only ${pp.current} available (${p.pool})`);
  }
  // ONE Power feat per manifestation, one focus behind it: psionic expends
  // the held state; a super-powered character folds the momentary move-action
  // focus into the manifestation (HH p.354).
  const powerMeta = poolKind === 'power' ? opts.chosen[0] : null;
  let focusNote = null;
  if (powerMeta) {
    if (p.pool === 'psionic') {
      if (psiFocusLocked(c)) { toast('🧿 Focus is locked sustaining the Second Skin — no Power feats until it drops.'); return; }
      if (!c.psiFocused) { toast(`○ Not psionically focused — ${powerMeta.name} requires expending your focus (gain it first: full-round action, or move with Psionic Meditation).`); return; }
      c.psiFocused = false;
      logActionEvent(c, 'psi-focus', 0, 'Focus expended', `Psionic focus expended — ${powerMeta.name} on ${spell.name}.`);
      focusNote = `psionic focus expended (${powerMeta.name})`;
    } else {
      logActionEvent(c, 'psi-focus', 0, 'Momentary focus', `Move action: momentary super-power focus gained and expended — ${powerMeta.name} on ${spell.name} (HH p.354).`);
      focusNote = `move action: momentary focus (${powerMeta.name})`;
    }
  }
  // Overchannel's price rolls now, so the table sees the number.
  let ocResult = null;
  if (opts.oc > 0) {
    const nd = [0, 1, 3, 5][opts.oc];
    ocResult = rollNd8(nd);
    logAct(`Overchannel +${opts.oc} EPL on ${spell.name}: takes ${ocResult.total} damage (${nd}d8: ${ocResult.rolls.join('+')})${(c.feats || []).some(f => f.name === 'Talented') && lvlEff <= 3 ? ' — or expend focus (Talented) to avoid it' : ''}.`);
  }
  // Augment math (the standard grammar computes; bespoke shows its text).
  // v8.44.0: option-aware powers compute from the DECLARED split — dice
  // options make dice (and only those move the DC), count/flag options
  // render as their own receipt lines. No more every-PP-moves-the-DC.
  let augFx = null;
  const augOptDefs = (AUGMENT_OPTIONS[spell.name]) || null;
  if (aug && opts.extra > 0) {
    augFx = { extra: opts.extra, text: aug.text, dice: null, dcAdd: 0, label: aug.diceLabel, optBits: null };
    if (augOptDefs && opts.augPicks) {
      augFx.optBits = [];
      for (const o of augOptDefs) {
        const n = opts.augPicks[o.id] || 0;
        if (!n) continue;
        if (o.kind === 'dice') {
          augFx.dice = { n: n * o.dice.n, d: o.dice.d };
          augFx.label = 'damage';
          if (o.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / o.dcEveryDice);
        } else if (o.kind === 'count') augFx.optBits.push(`+${n} ${o.noun}${n === 1 ? '' : 's'}`);
        else if (o.kind === 'flag') augFx.optBits.push(o.label);
        else if (o.kind === 'duration') augFx.optBits.push(`+${n * (o.rounds || 1)} round${n * (o.rounds || 1) === 1 ? '' : 's'} duration`);
        else if (o.kind === 'bonus') augFx.optBits.push(`+${n} ${o.label.replace(/^\+1 /, '')}`);
      }
    } else if (aug.dice && aug.step) {
      const steps = Math.floor(opts.extra / aug.step);
      augFx.dice = { n: steps * aug.dice.n, d: aug.dice.d };
      if (aug.dcEveryDice) augFx.dcAdd = Math.floor(augFx.dice.n / aug.dcEveryDice);
      else if (aug.dcEveryStep) augFx.dcAdd = steps;
    }
  }

  // v8.25.0: Mental Pinnacle's six-pick flow (HH p.574 rebuild). The spell
  // route re-picks each casting; the Buff super-power route picks ONCE,
  // permanently (c.mentalPinnacle).
  let mpPicks = null;
  if (spell.name === 'Mental Pinnacle') {
    if (isSuper && p.buff && c.mentalPinnacle && Array.isArray(c.mentalPinnacle.picks)) {
      mpPicks = c.mentalPinnacle.picks;
    } else {
      mpPicks = await chooseMentalPinnacle();
      if (!mpPicks) return;
      if (isSuper && p.buff) {
        c.mentalPinnacle = { picks: mpPicks, chosenAt: new Date().toLocaleDateString() };
        logAct(`🧠 Mental Pinnacle modes chosen PERMANENTLY (Super-Power): ${mpPicks.join(', ')} (HH p.574 — choices are permanent for the Super-Power).`);
      }
    }
  }

  // Energy templates bind their element at cast time (canonical ruling:
  // 5 elements incl. acid — the spec's word over the book's 4, errata F2).
  const finish = (element) => {
    const spent = isSuper ? spendSuperPP(c, cost) : spendPoolPP(c, p.pool, Math.min(cost, pp.current === 0 ? 0 : cost));
    const after = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);
    let atom = spell.damage || null;
    let displayName = spell.name;
    if (atom && atom.is_template && element) {
      const concrete = DamageResolver.expandTemplate(atom).find(x => x.type === element);
      if (concrete) { atom = concrete; displayName = concrete.name; }
    }
    // Super-powers key off Wisdom (the super-mutant bonus-PP attribute);
    // caster pools use their best contributing attribute as before.
    const attrMod = isSuper ? am(((c.attrs) || [10, 10, 10, 10, 10, 10])[4]) : ((computeCasterStats(c)[p.pool] || {}).bestAttrMod || 0);
    const dcBonus = isSuper ? 0 : schoolDcBonus(c, spell);
    const saveDC = (spell.save && !/none/i.test(spell.save)) ? 10 + lvlEff + attrMod + dcBonus + (augFx ? augFx.dcAdd : 0) : null;
    renderCastResult({ name: displayName, baseName: spell.name, pool: p.pool, lvl: lvlEff, baseLvl: lvl, cost, spent, after, atom, saveDC, dcBonus, spell, buff: isSuper && p.buff,
      augFx, metasApplied: opts.chosen, focusNote, ocBoost: opts.oc, ocResult, spontMeta: spont.any && poolKind === 'spell' && opts.chosen.length > 0, heightened: opts.hl > 0, mpPicks });
    logAct(`${p.buff ? 'Invoked buff' : ((p.pool === 'psionic' || p.pool === 'super') ? 'Manifested' : 'Cast')} ${displayName} (${spent} PP, ${p.pool}${opts.extra ? `, +${opts.extra} augment` : ''}${opts.chosen.length ? `, ${opts.chosen.map(m => m.name).join(' + ')}` : ''}${opts.hl ? `, heightened to ${opts.hl}` : ''}) → ${after.current}/${after.max} PP`);
    // v8.42.0: transient-wired buffs — curated powers land on the sheet as
    // active effects, bonus values computed from the actual augment spend.
    applyWiredBuff(c, spell.name, p.pool, opts.extra, opts.augPicks);
    save(); renderPowers();
    renderPPRecovery(c);
  };

  if (spell.damage && spell.damage.is_template) {
    const elements = spell.damage.elements || ['acid', 'cold', 'electricity', 'fire', 'sonic'];
    openChoiceModal(`${spell.name} — choose the energy type`, elements.map(e => e[0].toUpperCase() + e.slice(1)), (sel) => finish(sel.toLowerCase()));
    return;
  }
  finish(null);
}

function renderCastResult(r) {
  const panel = document.getElementById('pw-cast-result');
  document.getElementById('pw-cast-title').textContent = r.prepaid
    ? `⚡ ${r.name} — cast from a prepared slot (level ${r.lvl}, no PP — paid at dawn)`
    : `⚡ ${r.name} — ${(r.pool === 'psionic' || r.pool === 'super') ? 'manifested' : 'cast'} from the ${r.pool} pool (level ${r.lvl}, ${r.spent} PP)`;
  const bits = [];
  if (r.buff) bits.push(`<b>Buff super-power</b> — Personal / You / Permanent-or-at-will; 0 PP unaugmented; variable aspects manifest at your ESL`);
  bits.push(`<b>PP:</b> ${r.after.current}/${r.after.max} remaining (${r.pool})`);
  if (r.saveDC !== null && r.saveDC !== undefined) bits.push(`<b>Save DC ${r.saveDC}</b>${r.dcBonus ? ` <span class="op-0_7">(incl. +${r.dcBonus} Spell Focus)</span>` : ''} — ${escapeHTML(r.spell.save)}`);
  else if (r.spell.save) bits.push(`<b>Save:</b> ${escapeHTML(r.spell.save)}`);
  if (r.spell.resistance) bits.push(`<b>SR/PR:</b> ${escapeHTML(r.spell.resistance)}`);
  // v8.21.0 Segments B & C: what this cast actually applied.
  if (r.heightened) bits.push(`<b style="color:rgb(var(--text-sky));">Heightened</b> to level ${r.lvl} (from ${r.baseLvl}) — DC and level-dependent effects use ${r.lvl}`);
  if (r.augFx) {
    // v8.44.0: itemized option receipt when the split was declared.
    const optTail = (r.augFx.optBits && r.augFx.optBits.length) ? ` · ${r.augFx.optBits.map(escapeHTML).join(' · ')}` : '';
    bits.push(`<b style="color:rgb(var(--text-sky));">Augmented +${r.augFx.extra} PP</b>${r.augFx.dice ? ` — +${r.augFx.dice.n}d${r.augFx.dice.d} ${r.augFx.label}${r.augFx.dcAdd ? `, save DC +${r.augFx.dcAdd} (already included)` : ''}${optTail}` : (optTail ? ` —${optTail}` : ` — <span class="op-0_8">${escapeHTML(r.augFx.text.slice(0, 160))}${r.augFx.text.length > 160 ? '…' : ''}</span>`)}`);
  }
  for (const m of (r.metasApplied || [])) bits.push(`<b class="c-vio">${m.name}</b> — ${escapeHTML(m.fx || '')}${m.pp ? ` (+${m.pp} PP, included)` : ''}`);
  // v8.25.0: Mental Pinnacle's chosen modes (HH p.574 — five attack/defense
  // pairs + one floater; the pairing guarantees at least one of each).
  if (r.mpPicks) bits.push(`<b class="c-vio">🧠 Modes (6):</b> ${r.mpPicks.map(n => escapeHTML(n)).join(', ')}${r.buff ? ' <span class="op-0_7">(permanent — Super-Power)</span>' : ''} · +4 inherent Int/Wis/Cha (min 15 each) · +2 bonus PP per CL · manifest the modes as a Psion of your CL · Divine variant: other spellcasting locked (Mind domain excepted)`);
  if (r.focusNote) bits.push(`<b>Focus:</b> ${escapeHTML(r.focusNote)}`);
  if (r.ocBoost) bits.push(`<b style="color:rgb(var(--text-orange));">Overchannel +${r.ocBoost} EPL</b> — took ${r.ocResult.total} damage (${r.ocResult.rolls.join('+')})`);
  if (r.spontMeta) bits.push(`<b style="color:rgb(var(--text-amber));">Casting time escalates to a full-round action</b> (Magic feat on a spontaneous cast — HH p.340)`);
  // v8.5.4 EAL pass: feat/feature riders that modify the effective level or
  // its checks at cast time — surfaced so the table can apply them.
  const cc = currentChar();
  if (cc && r.spell) {
    const feats = new Set((cc.feats || []).map(f => f.name || f.n || f));
    if (r.spell.resistance && /yes/i.test(r.spell.resistance)) {
      if (r.pool === 'psionic' && feats.has('Power Penetration')) {
        const gp = feats.has('Greater Power Penetration');
        bits.push(`<b>vs PR:</b> +${gp ? 8 : 4} on EPL checks (expend focus${gp ? '; incl. Greater Power Penetration' : ''})`);
      } else if ((r.pool === 'arcane' || r.pool === 'divine') && feats.has('Spell Penetration')) {
        const gs = feats.has('Greater Spell Penetration');
        bits.push(`<b>vs SR:</b> +${gs ? 4 : 2} on ${POOL_EFF_LEVEL[r.pool].abbr} checks${gs ? ' (incl. Greater Spell Penetration)' : ''}`);
      }
    }
    if (r.pool === 'psionic') {
      if (feats.has('Overchannel')) {
        // Boost tier gates at 8th/15th read as manifester level (XPH lineage) — use EPL.
        const epl = computeCasterLevels(cc).psionic || 1;
        const boost = epl >= 15 ? 3 : epl >= 8 ? 2 : 1;
        bits.push(`<b>Overchannel:</b> up to +${boost} EPL for ${({1:'1d8',2:'3d8',3:'5d8'})[boost]} damage${feats.has('Talented') ? ' (Talented: expend focus to avoid the damage on powers of 3rd level or lower)' : ''}`);
      }
      const wilder = (cc.classes || []).find(e => e.name === 'Wilder');
      if (wilder) {
        const wl = wilder.level || 1;
        const surge = wl >= 19 ? 6 : wl >= 15 ? 5 : wl >= 11 ? 4 : wl >= 7 ? 3 : wl >= 3 ? 2 : 1;
        bits.push(`<b>Wild Surge:</b> up to +${surge} EPL free (surge pays the augment PP; risks Neuralgia; can’t combine with Overchannel)`);
      }
    }
  }
  if (r.atom) {
    const res = DamageResolver.resolve(r.atom);
    // Template atoms carry no dice (their seed CSV source column was empty);
    // fall back to the first NdM in the entry's own description text.
    let dice = r.atom.dice || ((r.spell.d || '').match(/\d+d\d+/) || [])[0] || '—';
    // v8.21.0: fold computed augment dice into the readout.
    if (r.augFx && r.augFx.dice && r.augFx.label === 'damage') {
      const bm = String(dice).match(/^(\d+)d(\d+)$/);
      dice = (bm && parseInt(bm[2], 10) === r.augFx.dice.d)
        ? `${parseInt(bm[1], 10) + r.augFx.dice.n}d${r.augFx.dice.d} (incl. +${r.augFx.dice.n}d${r.augFx.dice.d} augment)`
        : `${dice} + ${r.augFx.dice.n}d${r.augFx.dice.d} augment`;
    }
    bits.push(`<b>Damage:</b> ${escapeHTML(dice)} ${escapeHTML(res.label)}${r.atom.lethality === 'nonlethal' ? ' (nonlethal)' : ''}`);
    if (res.resistances.length) bits.push(`<b>Reduced by:</b> ${escapeHTML(res.resistances.join('; '))}`);
    for (const g of res.gates) bits.push(`<b>Gate:</b> ${escapeHTML(g.gate)}${g.immune ? ' — immune: ' + escapeHTML(g.immune.join(', ')) : ''}${g.rule ? ' — ' + escapeHTML(g.rule) : ''}`);
  }
  for (const [label, v] of [['Time', r.spell.casting_time], ['Range', r.spell.range], ['Target', r.spell.target], ['Area', r.spell.area], ['Duration', r.spell.duration]]) {
    if (v) bits.push(`<b>${label}:</b> ${escapeHTML(v)}`);
  }
  document.getElementById('pw-cast-body').innerHTML = bits.join(' &nbsp;·&nbsp; ');
  // v8.57.0: arm the instantaneous-resolution gate for this banner.
  if (_isInstantSpell(r.spell) && !_isSwiftCast(r.spell, r.pool)) _pendingInstant = { charId: curId, name: r.name };
  panel.style.display = 'block';
}

function dismissCastResult() { document.getElementById('pw-cast-result').style.display = 'none'; _pendingInstant = null; }
