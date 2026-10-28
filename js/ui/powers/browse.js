// =============================================================================
// js/ui/powers/browse.js
// POWERS / BROWSE — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. The Powers / Spells page: the repertoire and the
//   power browser.
//
// KEY NAMES (so you can search for them)
//   tables and state: _pwBrowseList, _pwMode, _pwBrowseOpen,
//   _pwExpandedBrowse, _pwExpandedKnown, _pwThemeSets
//   functions (10): togglePwBrowse, addPowerFromBrowse, finishAddPower,
//   removePowerAt, togglePwBrowseDetail, togglePwKnownDetail,
//   powerPrereqBadge, spellStatLine, renderPowers, renderPowersBrowse
//
// WHERE IT CAME FROM
//   Gathered from js/app/54-powers-repertoire.js, js/app/61-casting-
//   augments-and-powers-page.js, js/app/62-power-suites-feats-page-
//   proficiencies.js when the code was regrouped by topic and page. Each
//   function and table moved whole and unchanged, with the comments above
//   it, including the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// ----- add / remove (index-based handlers; spell names contain quotes) -----
let _pwBrowseList = [];
// v8.6.0 split (Adam): the powers page renders in one of two MODES — 'spells'
// (arcane/divine side: EAL/EDL, prep panel, domain powers) or 'powers'
// (psionic/super side: EPL/ESL, disciplines, super purchases). One unified
// page DOM and SPELLS_DB underneath (the HH's own Ch.IX unification); the
// mode filters presentation. showPage('spells') sets the mode.
let _pwMode = 'powers';
// v8.5.4 ergo C1: catalogue starts collapsed; render only while open (the
// 120-row list is the tab's heaviest block).
let _pwBrowseOpen = false;
function togglePwBrowse() {
  _pwBrowseOpen = !_pwBrowseOpen;
  const wrap = document.getElementById('pw-browse-wrap');
  const btn = document.getElementById('pw-browse-toggle');
  if (wrap) wrap.style.display = _pwBrowseOpen ? 'block' : 'none';
  if (btn) btn.textContent = _pwBrowseOpen ? '▴ Hide the Catalogue' : `⌕ Browse the Catalogue (${SPELLS_DB.length})`;
  const cnt = document.getElementById('pw-browse-count');
  if (cnt) cnt.textContent = `(${SPELLS_DB.length} entries)`;
  if (_pwBrowseOpen) {
    renderPowersBrowse();
    const el = document.getElementById('pw-browse-wrap');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
const _pwExpandedBrowse = new Set();
const _pwExpandedKnown = new Set();

async function addPowerFromBrowse(idx) {
  const c = currentChar(); if (!c) return;
  const spell = _pwBrowseList[idx]; if (!spell) return;
  if (!c.powers) c.powers = [];
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.6.0 split: adding from a mode's browse offers only that side's routes.
  let opts = spellPoolOptions(spell, poolsInfo).filter(o => _pwModePools().includes(o.pool));
  if (!opts.length) { toast(`No ${_pwMode === 'spells' ? 'spellcasting' : 'manifesting'} pool of this character can reach that entry.`); return; }
  // Collapse to one option per pool (best = lowest level route).
  const byPool = {};
  for (const o of opts) if (!byPool[o.pool] || o.lvl < byPool[o.pool].lvl) byPool[o.pool] = o;
  opts = Object.values(byPool).filter(o => !c.powers.some(p => p.name === spell.name && p.pool === o.pool));
  if (!opts.length) { toast(`${spell.name} is already known in every eligible pool.`); return; }
  const pick = (chosen) => finishAddPower(c, spell, chosen);
  if (opts.length === 1) { pick(opts[0]); return; }
  openChoiceModal(`${spell.name} — add to which pool?`,
    opts.map(o => {
      const nm = displayNameForRoute(spell, o);
      return `${o.pool} (${o.token} ${o.lvl}${o.lvl_max ? '-' + o.lvl_max : ''})${nm !== spell.name ? ` — as “${nm}”` : ''}`;
    }),
    (sel) => { const o = opts.find(x => sel.startsWith(x.pool)); if (o) pick(o); });
}
async function finishAddPower(c, spell, opt) {
  // Gate 1: pool max power level (min level of a ranged entry is the gate).
  const budget = getPowersBudget(c)[opt.pool] || { maxPowerLvl: 0, picked: 0, total: null };
  if (opt.lvl > budget.maxPowerLvl) {
    if (!(await confirmModal(
      `"${spell.name}" is level ${opt.lvl} (${opt.token}), but this character's ${opt.pool} pool can only cast up to level ${budget.maxPowerLvl}.\n\nAdd anyway as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `level ${opt.lvl} > ${opt.pool} max castable ${budget.maxPowerLvl}`);
  }
  // Gate 2: known-count budget (null = no limit — prepared casters, Saints).
  // v8.33.0: now covers spontaneous SPELL casters too (Sorcerer/Bard) — their
  // matrices finally feed the total (they read "no limit" since v8.5.x).
  if (budget.total !== null && budget.picked >= budget.total) {
    if (!(await confirmModal(
      `${opt.pool} powers-known budget is full (${budget.picked}/${budget.total}).\n\nAdding "${spell.name}" exceeds it. Proceed as a GM-approved exception?`))) return;
    logPowerException(c, spell.name, `powers known ${budget.picked + 1} > budget ${budget.total} (${opt.pool})`);
  }
  // Gate 2.5 (v8.34.0, Adam's ruling): the PER-SPELL-LEVEL knowns split is
  // enforced for pools with a spells-known matrix (Sorcerer / Bard — the
  // complete set: psionic classes use flat XPH-style counts by design,
  // prepared casters and Saints have no known cap at all). Five cantrips are
  // not nine free-floating picks. Skipped when Gate 1 already fired for the
  // level (no double prompt for an over-max pick).
  {
    const kbl = budget.knownByLvl || [];
    if (kbl.some(n => n > 0) && opt.lvl <= budget.maxPowerLvl) {
      const at = (knownPickedByLevel(c, opt.pool)[opt.lvl] || 0);
      const allowed = kbl[opt.lvl] || 0;
      if (at >= allowed) {
        const lvlName = opt.lvl === 0 ? 'cantrip (0-level)' : `level-${opt.lvl}`;
        if (!(await confirmModal(
          `The ${opt.pool} ${lvlName} spells-known slots are full (${at}/${allowed}).\n\nAdding "${spell.name}" at level ${opt.lvl} exceeds the printed split. Proceed as a GM-approved exception?`))) return;
        logPowerException(c, spell.name, `level-${opt.lvl} knowns ${at + 1} > split ${allowed} (${opt.pool})`);
      }
    }
  }
  // Gate 3 (v8.5.4): Saint Personal Domain — one pick at 3rd and every odd
  // Saint level after; each is a permanent, deity-approved (= GM-approved)
  // addition to the Saint's spell list.
  if (opt.personal) {
    const pools = getCasterPoolsInfo(c);
    const pb = (pools.divine && pools.divine._saintPersonalBudget) || 0;
    const used = (c.powers || []).filter(p => p.personal).length;
    if (used >= pb) {
      if (!(await confirmModal(
        `"${spell.name}" would be Personal Domain pick #${used + 1}, but this Saint has only ${pb} (one at 3rd and every odd level after).\n\nProceed as a GM-approved exception?`))) return;
      logPowerException(c, spell.name, `Personal Domain picks ${used + 1} > budget ${pb}`);
    } else if (!(await confirmModal(
      `Add "${spell.name}" as a Personal Domain spell (pick ${used + 1} of ${pb})?\n\nPersonal Domain additions are permanent once approved by your deity (the GM).`))) return;
  }
  const rec = { name: spell.name, pool: opt.pool, grantedAt: { level: c.totalLvl || 1, atDate: new Date().toLocaleDateString() } };
  if (opt.advisory) rec.advisory = opt.advisory;
  if (opt.personal) rec.personal = true;
  // v8.5.4: remember the granting route so the known list can render the
  // source-sensitive name ("Build Database" for a Technology-domain pick).
  if (opt.token) { rec.token = opt.token; rec.lvl = opt.lvl; }
  if (opt.applies) rec.applies = opt.applies;
  c.powers.push(rec);
  save(); renderPowers();
  const shown = displayNameForRoute(spell, opt);
  toast(`Added ${shown}${shown !== spell.name ? ` (${spell.name})` : ''} (${opt.pool}${opt.personal ? ' · Personal Domain' : ''}).`);
}

async function removePowerAt(idx) {
  const c = currentChar(); if (!c || !c.powers) return;
  const p = c.powers[idx]; if (!p) return;
  // v8.13.0: an Expanded Knowledge grant is 1:1 with its feat instance — the
  // reconciler would just re-add it. Remove the feat to withdraw the power.
  if (p.via === 'Expanded Knowledge') {
    toast(`${p.name} is granted by the Expanded Knowledge feat — remove that feat instance (Feats tab) to withdraw it.`);
    return;
  }
  // v8.5.3: a bought super-power may carry complimentary free children
  // (mp_note "includes X") — removing the parent removes the whole bundle.
  const children = (p.pool === 'super' && !p.free)
    ? c.powers.filter(x => x.pool === 'super' && x.free && x.via === p.name)
    : [];
  const msg = children.length
    ? `Remove ${p.name} (${p.pool})? Its ${children.length} complimentary power${children.length > 1 ? 's' : ''} (${children.map(x => x.name).join(', ')}) will be removed too.`
    : `Remove ${p.name} (${p.pool})?`;
  if (!(await confirmModal(msg))) return;
  c.powers = c.powers.filter((x, i) => i !== idx && !children.includes(x));
  save(); renderPowers();
  toast(`Removed ${p.name}${children.length ? ` (+${children.length} complimentary)` : ''}.`);
}

function togglePwBrowseDetail(idx) {
  const s = _pwBrowseList[idx]; if (!s) return;
  _pwExpandedBrowse.has(s.name) ? _pwExpandedBrowse.delete(s.name) : _pwExpandedBrowse.add(s.name);
  renderPowersBrowse();
}
function togglePwKnownDetail(key) {
  _pwExpandedKnown.has(key) ? _pwExpandedKnown.delete(key) : _pwExpandedKnown.add(key);
  renderPowers();
}


// ----- rendering -----
// v8.6.1 (Adam, 2026-09-01): scenario-gate earmark for prereq-bearing powers
// (15 carry a book "Prerequisite:" line — 13 Tech Scale 5+, 2 Tech Scale 4+;
// the Supernatural [Attribute] chain carries mutation prereqs). Tech-parsed
// prereqs render "⚙ Tech N+", turning RED when the scenario's Tech Scale is
// below N; other prereq texts get a generic ⚑ badge. Display-level advisory
// (same treatment as the skill rows' scenario gates) — not a hard block.
function powerPrereqBadge(s, c) {
  if (!s || !s.prerequisite) return '';
  const m = String(s.prerequisite).match(/Tech Scale (\d+)/i);
  if (m) {
    const need = parseInt(m[1], 10);
    const have = (c && c.sixLevels && c.sixLevels.tech) || 0;
    const ok = have >= need;
    return ` <span style="font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid ${ok ? 'rgb(var(--line-amber) / .45)' : 'rgb(var(--line-red) / .6)'};color:${ok ? 'rgb(var(--text-amber))' : 'var(--red-text)'};margin-left:4px;cursor:help;" title="Prerequisite: ${escapeHTML(s.prerequisite)}${ok ? '' : ' — this scenario is Tech Scale ' + have + ': GM exception territory'}">⚙ Tech ${need}+${ok ? '' : ' ✗'}</span>`;
  }
  return ` <span class="rounded-2 fs-9 p-1-5 ml-4 cursor-help" style="border:1px solid rgb(var(--line-amber) / .45);color:rgb(var(--text-amber));" title="Prerequisite: ${escapeHTML(s.prerequisite)}">⚑ prereq</span>`;
}

function spellStatLine(s) {
  const bits = [];
  if (s.school_raw) bits.push(escapeHTML(s.school_raw));
  if (s.prerequisite) bits.push(`<b>Prerequisite:</b> ${escapeHTML(s.prerequisite)}`);
  const lv = (s.levels || []).map(l => `${l.cls} ${l.lvl}${l.lvl_max ? '-' + l.lvl_max : ''}${l.applies ? ' (' + l.applies + ')' : ''}`).join(', ');
  if (lv) bits.push('Level: ' + escapeHTML(lv) + (s.mp ? ` (${s.mp} MP${s.mp_note ? '; ' + escapeHTML(s.mp_note) : ''})` : ''));
  for (const [label, v] of [['Components', s.components], ['Time', s.casting_time], ['Display', s.display], ['Range', s.range], ['Target', s.target], ['Area', s.area], ['Effect', s.effect], ['Duration', s.duration], ['Save', s.save], ['Resistance', s.resistance], ['PP', s.power_points], ['XP Cost', s.xp_cost]]) {
    if (v) bits.push(`<b>${label}:</b> ${escapeHTML(v)}`);
  }
  if (s.variants_note) bits.push(`<i>${escapeHTML(s.variants_note)}</i>`);
  if (s.damage) bits.push(`<b>Damage:</b> ${escapeHTML(s.damage.dice || '')} ${escapeHTML(DamageResolver.renderLabel(s.damage))}${s.damage.is_template ? ' (element chosen at cast)' : ''}`);
  return bits.join(' &nbsp;·&nbsp; ');
}

function renderPowers() {
  const prompt = document.getElementById('pw-prompt'), cont = document.getElementById('pw-content');
  if (!curId) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  const c = currentChar(); if (!c) { prompt.style.display = 'block'; cont.style.display = 'none'; return; }
  prompt.style.display = 'none'; cont.style.display = 'block';
  // v8.6.0 split: self-heal the mode if the character lacks this side but has
  // the other (e.g. tab switch after a character change).
  if (_pwMode === 'spells' && !characterIsEntitledToSpells(c) && characterIsEntitledToPowers(c)) _pwMode = 'powers';
  else if (_pwMode === 'powers' && !characterIsEntitledToPowers(c) && characterIsEntitledToSpells(c)) _pwMode = 'spells';
  const modePools = _pwModePools();
  document.getElementById('pw-hero-nm').textContent = c.name + ' — ' + _pwSideLabel(c, _pwMode);

  const budget = getPowersBudget(c);
  const mpSt = getMPState(c);
  const cStats = computeCasterStats(c);
  // v8.82.0: the ✨ Supernatural Attributes panel (Powers side, super-capables).
  renderSuAttrPanel(c);
  // v8.83.0: the 🎭 Super-Talents sibling.
  renderSuperTalentPanel(c);
  let budgetHTML = Object.keys(budget).filter(pool => modePools.includes(pool)).length
    ? Object.entries(budget).filter(([pool]) => modePools.includes(pool)).map(([pool, b]) => {
        const pp = getPoolPPState(c, pool);
        const eff = POOL_EFF_LEVEL[pool];
        const effBit = eff ? `<span title="${eff.full}" class="cursor-help">${eff.abbr} ${(cStats[pool] || {}).cl || 0}</span> · ` : '';
        // v8.31.1: ⚭ marks a Blended-Technique-united pool — the PP figure is
        // the UNITED total ("the two power point pools are added together",
        // GMG p.185), shared with the linked pool(s); the tooltip shows the
        // pool's own contribution.
        const blendBit = pp.blended
          ? ` <span style="cursor:help;color:rgb(var(--text-lavender));" title="Blended Technique (Theurge): ${pp.blended.join(' + ')} power points are ONE united pool — this figure is the shared total (this pool's own share: ${pp.ownCurrent}/${pp.ownMax}). Spend on either art; memorization draws from the union at dawn.">⚭</span>`
          : '';
        // v8.34.0 (Adam's ruling): the per-spell-level split is ENFORCED at
        // add time (Gate 2.5) for matrix pools — the tooltip shows live
        // picked/allowed per level.
        const kbl = (b.knownByLvl || []);
        const pbl = kbl.some(n => n > 0) ? knownPickedByLevel(c, pool) : [];
        const kblBits = kbl.map((n, i) => n > 0 ? `lvl ${i}: ${pbl[i] || 0}/${n}` : null).filter(Boolean);
        const knownTitle = b.total !== null
          ? `Spells/powers known budget ${b.picked}/${b.total}${kblBits.length ? ' — per-level split (printed table, enforced at add): ' + kblBits.join(' · ') : ''}`
          : 'No known-count limit (prepared casters learn freely; Saints know all their domains)';
        // v8.41.0 (Adam's Heinrix report — "I had to resort to guessing"):
        // the per-level split lived only in the hover tooltip, which is
        // invisible information. Matrix pools (Sorcerer/Bard) now show the
        // split INLINE with ⚠ on levels holding unpicked selections; flat
        // pools (psionic classes — XPH-style by design: a TOTAL, spent on
        // any mix of levels you can manifest) show remaining + the mix rule.
        const ord = (n) => n === 0 ? '0th' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
        let splitBit = '';
        if (b.total !== null) {
          if (kbl.some(n => n > 0)) {
            splitBit = ' <span class="fs-11" style="opacity:.9;">— ' + kbl.map((n, i) => n > 0
              ? `${ord(i)} ${pbl[i] || 0}/${n}${(pbl[i] || 0) < n ? ' <b style="color:rgb(var(--text-marigold));">⚠</b>' : ''}`
              : null).filter(Boolean).join(' · ') + '</span>';
          } else if (b.picked < b.total) {
            splitBit = ` <span class="fs-11" style="color:rgb(var(--text-marigold));">— ${b.total - b.picked} unpicked ⚠ <span class="op-0_75">(any mix up to ${ord(b.maxPowerLvl)})</span></span>`;
          }
        }
        return `<span class="ml-10">${pool}: <b class="cursor-help" title="${escapeHTML(knownTitle)}">${b.picked}${b.total !== null ? '/' + b.total : ''}</b> known${b.total === null ? ' (no limit)' : ''}${splitBit} · ${effBit}max ${pool === 'psionic' ? 'power' : 'spell'} lvl ${b.maxPowerLvl} · <b class="c-pb90">${pp.current}/${pp.max} PP</b>${blendBit}</span>`;
      }).join('')
    : ((_pwMode === 'powers' && getMPState(c).isSuperMutant) ? '' : `<span class="o-60 c-dim">no active ${_pwMode === 'spells' ? 'spellcasting' : 'manifesting'} pools</span>`);
  // v8.5.3: super-mutant segment — bought powers, banked MP, super-PP pool.
  // (v8.5.4 ergo: the "no active caster pools" placeholder is suppressed when
  // the super segment renders — they used to run together on one line.
  // v8.6.0 split: super lives on the Powers side only.)
  if (_pwMode === 'powers' && mpSt.isSuperMutant) {
    const spp = getSuperPPState(c);
    const owned = getCharPowers(c).filter(p => p.pool === 'super').length;
    budgetHTML += `<span class="ml-10" style="color:rgb(var(--text-lilac));">super (${mpSt.tier ? mpSt.tier.tier : '?'}): <b>${owned}</b> owned · <span title="Effective Super Level (the HH’s ‘EML’): character level + Mutant level modifier — super-powers manifest at this level" class="cursor-help">ESL ${mpSt.eml}</span> · <b>${mpSt.balance} MP</b> banked · <b>${spp.current}/${spp.max} PP</b></span>`;
  }
  // v8.5.4 Layer 4: one-click new day (all pools + super PP; AP untouched —
  // those refresh only on level-up).
  if (Object.keys(budget).length || mpSt.isSuperMutant) {
    budgetHTML += ` <button class="fs-10 ml-10 btn btn-sm" style="border-color:rgb(var(--line-khaki) / .5);color:rgb(var(--text-khaki));" title="New day: refill every PP pool, re-memorize prepared lists, refill super PP. Action Points do NOT refresh (level-up only)." onclick="fullyRested()">☀ Fully Rested</button>`;
  }
  document.getElementById('pw-budget-line').innerHTML = budgetHTML;

  // v8.5.4: Domain Granted Powers panel — the chosen Cleric/Saint/Paladin
  // domains (DOMAINS_DB) with their granted-power text. A Druid-option
  // Cleric has no domains, so its Cleric picks are skipped.
  let domHost = document.getElementById('pw-domains');
  if (!domHost) {
    domHost = document.createElement('div');
    domHost.id = 'pw-domains';
    // v8.30.1: anchored AFTER the page tutorial (it used to wedge into the
    // header row above it — Adam's Heinrix report).
    const anchor = document.getElementById('powers-tut-panel') || document.getElementById('pw-budget-line');
    anchor.parentNode.insertBefore(domHost, anchor.nextSibling);
  }
  const domSources = [];
  // v8.6.0 split: domains are divine-side — the panel renders on Spells only.
  // v8.30.1: each source additionally gated on its class being present —
  // defense in depth behind reconcileOrphanSubOptions (the Heinrix bug put
  // Saint domains on a record with no Saint levels).
  if (_pwMode === 'spells') {
    const domOwned = new Set(migrateLegacyClasses(c).filter(e => (e.level||0) > 0).map(e => e.name));
    if (!c.druidOption && domOwned.has('Cleric')) for (const d of (c.clericDomains || [])) domSources.push(['Cleric', d]);
    if (domOwned.has('Saint')) for (const d of (c.saintDomains || [])) domSources.push(['Saint', d]);
    if (domOwned.has('Paladin')) for (const d of (c.paladinDomains || [])) domSources.push(['Paladin', d]);
  }
  domHost.innerHTML = domSources.length
    ? `<div class="rounded-3 mt-8 p-7-10" style="background:rgb(var(--tint-black) / .18);border:1px solid rgb(var(--line-gold) / .18);">
        <div class="font-serif fs-10 uppercase ls-0_08em c-g70 mb-4">Domain Granted Powers</div>
        ${domSources.map(([cls, d]) => {
          const dd = DOMAINS_DB.find(x => x.name === d);
          if (!dd) return '';
          return `<div class="fs-11 c-g70 m-3-0 lh-1_45"><b class="c-gold">${escapeHTML(d)}</b> <span class="fs-9 c-g45">(${cls})</span>${dd.prerequisite ? ` <span class="fs-10" style="color:rgb(var(--text-amber));">[Prereq: ${escapeHTML(dd.prerequisite)}]</span>` : ''} — ${escapeHTML(dd.grantedPower)}</div>`;
        }).join('')}
      </div>`
    : '';

  // v8.6.0 split: the known list shows this mode's pools only, but the
  // cast/remove handlers keep the ORIGINAL repertoire indices (castPowerAt/
  // removePowerAt index into the unfiltered c.powers).
  const known = getCharPowers(c);
  const knownView = known.map((p, i) => ({ p, i })).filter(x => modePools.includes(x.p.pool));
  const byName = Object.fromEntries(SPELLS_DB.map(s => [s.name, s]));
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.57.0: the spontaneous casting surface, computed once per render —
  // decides which rows cast directly and which memorize (spells mode only;
  // psionic/super pools are always pay-at-cast).
  const npInfo = _pwMode === 'spells' ? nonPreppedPoolsInfo(c) : null;
  document.getElementById('pw-known-list').innerHTML = knownView.length
    ? knownView.map(({ p, i }) => {
        const s = byName[p.name];
        const key = p.name + '|' + p.pool;
        const open = _pwExpandedKnown.has(key);
        const adv = (p.advisory ? ` <span class="fs-10 cursor-help" style="color:rgb(var(--text-amber));" title="${escapeHTML(p.advisory)}">⚠</span>` : '')
          + (p.personal ? ` <span class="fs-10 c-vio cursor-help" title="Personal Domain spell — a permanent, deity-approved addition to this Saint’s spell list (HH).">✦ Personal</span>` : '');
        // v8.5.2 Phase D: Cast button with live PP cost; dimmed (not blocked
        // — insufficient-PP has its own GM-exception flow) when short.
        let castBtn = '';
        if (s) {
          const isSuper = p.pool === 'super';
          const routes = isSuper ? [] : spellPoolOptions(s, poolsInfo).filter(o => o.pool === p.pool);
          const lvl = routes.length ? Math.min(...routes.map(o => o.lvl)) : ((s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : 1);
          const cost = (isSuper && p.buff) ? 0 : castCostFor(c, s, p.pool, lvl);
          const pp = isSuper ? getSuperPPState(c) : getPoolPPState(c, p.pool);
          const short = cost > pp.current;
          // v8.57.0 (Adam's playtest item #4): a prepared-only entry — no
          // surviving spontaneous route — MEMORIZES here (PP at dawn); the
          // cast itself is free, from the Prepared Spells panel above.
          const prepOnly = !isSuper && npInfo && (p.pool === 'arcane' || p.pool === 'divine') && routes.length
            && !spellPoolOptions(s, npInfo).some(o => o.pool === p.pool);
          castBtn = prepOnly
            ? `<button class="btn btn-sm" style="font-size:10px;${short ? 'opacity:.55;' : 'border-color:rgb(var(--line-khaki) / .5);color:rgb(var(--text-khaki) / .95);'}" title="Prepared caster — memorize at dawn (spends the PP); cast the memorized instance from the Prepared Spells panel (no further PP)." onclick="memorizeKnownAt(${i})">🌅 Memorize ${cost} PP</button>`
            : `<button class="btn btn-sm" style="font-size:10px;${short ? 'opacity:.55;' : (p.buff ? 'border-color:var(--g55);color:rgb(var(--text-amber));' : 'border-color:rgb(var(--line-sky) / .5);color:rgb(var(--text-sky) / .95);')}" title="${short ? 'Insufficient PP — casting will prompt for a GM exception' : (p.buff ? 'Perpetual Buff — always manifested at no PP; invoke to augment for a scene (the ⏻ suppression toggle lives on the Sheet ✨ panel)' : 'Cast / manifest')}" onclick="castPowerAt(${i})">${p.buff ? '◉' : '⚡'} ${cost} PP</button>`;
        }
        return `<div class="p-6-9" style="border-bottom:1px solid rgb(var(--line-gold) / .08);">
          <div class="justify-between items-center gap-6" style="display:flex;">
            <div class="cursor-pointer flex-1" onclick="togglePwKnownDetail('${escapeHTML(key).replace(/'/g, "\\'")}')"><b>${escapeHTML((s && p.token) ? displayNameForRoute(s, {token: p.token, lvl: p.lvl, pool: p.pool, applies: p.applies}) : p.name)}</b>${(s && p.token && displayNameForRoute(s, {token: p.token, lvl: p.lvl, pool: p.pool, applies: p.applies}) !== p.name) ? ` <span class="fs-10 o-50 c-dim">(${escapeHTML(p.name)})</span>` : ''} <span class="fs-10 o-60 c-dim">(${p.pool})</span>${adv}${s ? powerPrereqBadge(s, c) : ''} <span class="fs-10 o-40 c-dim">${open ? '▾' : '▸'}</span></div>
            ${castBtn}
            <button class="fs-10 btn btn-sm btn-danger" onclick="removePowerAt(${i})">✕</button>
          </div>
          ${open && s ? `<div class="fs-11 op-0_75 mt-4 lh-1_5">${spellStatLine(s)}</div><div class="fs-11_5 mt-5 lh-1_55 c-parch">${escapeHTML(s.d)}</div>` : ''}
        </div>`;
      }).join('')
    : `<div class="p-0_9rem fs-12 c-g45 text-center">No ${_pwMode === 'spells' ? 'spells' : 'powers'} known yet — browse the catalogue below.</div>`;

  // v8.6.0 split: preparation is spell-side (every prep class is arcane/divine).
  if (_pwMode === 'spells') renderPrepPanel(c);
  else { const ph = document.getElementById('pw-prep'); if (ph) ph.innerHTML = ''; }
  renderPowersBrowse();
}

// Lazy theme sets: theme -> Set of SPELLS_DB names (variant display names
// expand to their parents, so "Wildshape" lights up Metamorphosis).
let _pwThemeSets = null;
function renderPowersBrowse() {
  if (!_pwBrowseOpen) return;  // collapsed — skip the heaviest render (C1)
  const c = currentChar(); if (!c) return;
  const el = document.getElementById('pw-browse-list'); if (!el) return;
  const q = (document.getElementById('pw-search').value || '').toLowerCase();
  const poolF = document.getElementById('pw-pool-filter').value;
  const lvlF = document.getElementById('pw-lvl-filter').value;
  const castableOnly = document.getElementById('pw-castable-only').checked;
  // v8.74.0: the Power-Type theme filter (HH Ch.XI suites). Options are
  // populated once from POWER_THEMES; each option carries its suite size.
  const thSel = document.getElementById('pw-theme-filter');
  if (thSel && thSel.options.length <= 1) {
    thSel.innerHTML = '<option value="">All themes (HH Ch.XI)</option>' +
      Object.keys(POWER_THEMES).map(th => `<option value="${escapeHTML(th)}">${escapeHTML(th)} (${POWER_THEMES[th].length})</option>`).join('');
  }
  const themeF = thSel ? thSel.value : '';
  const themeSetF = themeF ? _powerThemeSets()[themeF] : null;
  const poolsInfo = getCasterPoolsInfo(c);
  // v8.6.0 split: routes are filtered to this mode's pools; the catalogue
  // underneath stays the one unified Ch.IX listing. Rebuild the pool filter's
  // options to the mode's sides (super has no list-routes — it's purchases).
  const modePools = _pwModePools();
  const routesOf = s => spellPoolOptions(s, poolsInfo).filter(o => modePools.includes(o.pool));
  // v8.6.0 (Adam): "the psionic equivalent of cast is manifest" — the
  // castable-only label follows the mode.
  const clbl = document.getElementById('pw-castable-lbl');
  if (clbl) clbl.textContent = _pwMode === 'psionic' || _pwMode === 'powers' ? 'manifestable by this character' : 'castable by this character';
  const pfSel = document.getElementById('pw-pool-filter');
  const pfWant = _pwMode === 'spells'
    ? '<option value="">All pools</option><option value="arcane">Arcane</option><option value="divine">Divine</option>'
    : '<option value="">All pools</option><option value="psionic">Psionic</option>';
  if (pfSel && pfSel.dataset.mode !== _pwMode) {
    pfSel.innerHTML = pfWant; pfSel.dataset.mode = _pwMode;
  }
  const poolF2 = pfSel ? pfSel.value : poolF;

  // v8.74.0 (found wiring the theme filter): a PURE super-mutant with
  // "manifestable by this character" checked saw an EMPTY catalogue — super
  // purchases aren't list-routes, so nothing ever counted as available. On
  // the Powers side, an entry the character could BUY as a super-power now
  // passes the availability filter (and the label says so).
  const _mpStB = (_pwMode === 'powers') ? getMPState(c) : null;
  const superCapable = !!(_mpStB && _mpStB.isSuperMutant);
  // v8.79.0 (Adam's Rhad shopping report): the TIER gates (level band +
  // per-power MP cap, HH p.422 — keyed on TOTAL MP earned, not banked)
  // were filtering in silence. The label now states the shopping window.
  if (clbl && superCapable && _mpStB.tier) {
    const [tLo, tHi] = _mpStB.tier.spell_levels || [1, 9];
    clbl.textContent = `manifestable / ◈ buyable by this character — ${_mpStB.tier.tier} tier: power levels ${tLo}-${tHi}${_mpStB.tier.max_mp_per_power != null ? `, ≤${_mpStB.tier.max_mp_per_power} MP per power` : ''}`;
  } else if (clbl && superCapable) clbl.textContent = 'manifestable / ◈ buyable by this character';
  _pwBrowseList = SPELLS_DB.filter(s => {
    if (q && !(s.name.toLowerCase().includes(q) || s.school_raw.toLowerCase().includes(q))) return false;
    if (themeSetF && !themeSetF.has(s.name)) return false;  // v8.74.0: theme suite filter
    const opts = routesOf(s);
    if (castableOnly && !opts.some(o => !o.overMax) && !(superCapable && superBuyEligibility(c, s).ok)) return false;
    if (poolF2 && !opts.some(o => o.pool === poolF2)) return false;
    if (lvlF !== '' && !(s.levels || []).some(l => l.lvl === Number(lvlF) || (l.lvl_max && Number(lvlF) >= l.lvl && Number(lvlF) <= l.lvl_max))) return false;
    return true;
  });

  const CAP = 120;
  const shown = _pwBrowseList.slice(0, CAP);
  const knownKeys = new Set(getCharPowers(c).map(p => p.name + '|' + p.pool));
  el.innerHTML = (shown.map((s, i) => {
    const opts = routesOf(s);
    const open = _pwExpandedBrowse.has(s.name);
    // v8.5.4: source-sensitive naming — each route resolves its own display
    // name (domain-list idiom, variant subtitles, applies tags). When every
    // available route agrees on one variant name, it becomes the row title
    // with the entry's own name as the secondary; otherwise route-specific
    // names ride on their pool tags.
    const routeNames = opts.map(o => displayNameForRoute(s, o));
    const uniqueNames = [...new Set(routeNames)];
    const primaryName = (opts.length && uniqueNames.length === 1 && uniqueNames[0] !== s.name) ? uniqueNames[0] : s.name;
    const secondary = primaryName !== s.name ? ` <span class="fs-10 o-50 c-dim">(${escapeHTML(s.name)})</span>` : '';
    const tagSeen = new Set();
    const poolTags = opts.length
      ? opts.map((o, k) => {
          const nm = routeNames[k];
          const label = `${o.pool}${o.overMax ? '↑' : ''}` + (nm !== primaryName ? ` · ${nm}` : '');
          if (tagSeen.has(label)) return '';
          tagSeen.add(label);
          return `<span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgb(var(--tint-sky) / .12);border:1px solid rgb(var(--line-sky) / .3);margin-left:4px;" title="${o.overMax ? 'above this pool’s max castable level (GM exception to add)' : 'castable via this pool'}${nm !== s.name ? ' — this source knows it as “' + escapeHTML(nm) + '”' : ''}">${escapeHTML(label)}</span>`;
        }).join('')
      : `<span class="fs-9 op-0_4 ml-4">not on your lists</span>`;
    const allKnown = opts.length && opts.every(o => knownKeys.has(s.name + '|' + o.pool));
    const addBtn = opts.length
      ? (allKnown ? `<span class="fs-10" style="color:rgb(var(--text-green));">✓ known</span>` : `<button class="fs-10 btn btn-sm btn-pri" onclick="addPowerFromBrowse(${i})">+ Add</button>`)
      : '';
    // v8.5.3: super-power purchase — spend banked MP for a permanent
    // supernatural ability (HH p.422). Eligibility gated by tier caps.
    // v8.6.0 split: purchases live on the Powers side only.
    let buyBtn = '';
    if (_pwMode === 'powers') {
      if (knownKeys.has(s.name + '|super')) {
        buyBtn = `<span class="fs-10" style="color:rgb(var(--text-lilac));">◈ owned</span>`;
      } else {
        const elig = superBuyEligibility(c, s);
        // v8.75.0: the suite discount (HH p.670, Adam's ruling) shows on the
        // button itself — the player sees the real price and why.
        // v8.80.0: rung families quote the tier-legal range; the click
        // prompts which rung (HH p.424 prices — the seller's-market ladder).
        const _rLo = elig.rungs ? elig.rungs[0][1] : null, _rHi = elig.rungs ? elig.rungs[elig.rungs.length - 1][1] : null;
        const _buyLabel = elig.rungs ? (_rLo === _rHi ? `◈ Buy ${Math.max(1, _rLo - (elig.suite ? 1 : 0))} MP` : `◈ Buy ${Math.max(1, _rLo - (elig.suite ? 1 : 0))}–${Math.max(1, _rHi - (elig.suite ? 1 : 0))} MP`) : `◈ Buy ${elig.mp} MP`;
        if (elig.ok) buyBtn = `<button class="fs-10 btn btn-sm" style="border-color:rgb(var(--line-lilac) / .5);color:rgb(var(--text-lilac));" title="Buy as a permanent super-power (spends banked MP)${elig.rungs ? ` — PRICED BY RUNG (HH p.424, the seller's-market ladder): ${elig.rungs.map(r => `${r[0]} ${r[1]} MP`).join(' · ')}${elig.rungsBlocked ? ` — ${elig.rungsBlocked} higher rung${elig.rungsBlocked === 1 ? '' : 's'} beyond your tier's per-power cap` : ''}. You choose the rung when buying; the full scaling capability costs its full upfront price.` : ''}${elig.suite ? ` — SUITE DISCOUNT: you own ${elig.suiteOwned} ${escapeHTML(elig.suite)} powers, so this costs ${elig.mp} MP instead of ${elig.mpBase} (HH p.670: two powers from one suite make further suite powers 1 MP less)` : ''}${elig.via ? ` — priced as its parent power, ${elig.via}` : ''}" onclick="buySuperPower(${i})">${_buyLabel}${elig.suite ? ` <span class="op-0_85" style="font-size:8px;">(suite −1)</span>` : ''}</button>`;
        // v8.79.0 (Adam's Rhad shopping report): a blocked row now SAYS WHY
        // — a dimmed dashed chip with the gate (tier level band, per-power
        // MP cap, feat, scenario), and the tier ladder in the hover so the
        // player knows what earns the unlock. Silence was the bug.
        else if (superCapable) {
          const w = elig.why || '';
          const short = /caps single-power cost/.test(w) ? `tier cap ${(_mpStB.tier && _mpStB.tier.max_mp_per_power) || ''} MP`
            : /reaches level/.test(w) ? `tier ≤ lvl ${(_mpStB.tier && _mpStB.tier.spell_levels) ? _mpStB.tier.spell_levels[1] : ''}`
            : /Supernatural Mutation/.test(w) ? 'needs Su Mutation'
            : /Mutation Scale/.test(w) ? 'needs Mut 5 scenario'
            : 'not buyable';
          buyBtn = `<span class="rounded-2 fs-9 p-2-6 nowrap cursor-help" style="color:var(--tp55);border:1px dashed rgb(var(--line-lilac) / .3);" title="Not buyable yet — ${escapeHTML(w)}. The shopping window follows your CLASSIFICATION, which tracks TOTAL MP earned (+1 Mutant level per full 10 — Adam's unification ruling, HH p.423): Minor <10 MP (lvl 1-3, ≤6 MP/power) · Moderate 10+ (1-5, ≤10) · Major 20+ (1-9, ≤20) · Mega 30+ (1-9, uncapped). Earn MP across a threshold and the window widens automatically; the Mutation Scale caps the total (GMG pp.64-66).">◈ ${escapeHTML(short)}</span>`;
        }
      }
    }
    return `<div class="p-6-9" style="border-bottom:1px solid rgb(var(--line-gold) / .08);">
      <div class="justify-between items-center gap-6" style="display:flex;">
        <div class="cursor-pointer flex-1" onclick="togglePwBrowseDetail(${i})"><b>${escapeHTML(primaryName)}</b>${secondary}${poolTags}${powerPrereqBadge(s, c)} <span class="fs-10 o-40 c-dim">${open ? '▾' : '▸'}</span></div>
        ${buyBtn}
        ${addBtn}
      </div>
      <div class="fs-10 op-0_55">${escapeHTML(s.school_raw)} · ${escapeHTML((s.levels || []).map(l => l.cls + ' ' + l.lvl + (l.lvl_max ? '-' + l.lvl_max : '')).join(', '))}${s.mp ? ' · ' + s.mp + ' MP' : ''}</div>
      ${open ? `<div class="fs-11 op-0_75 mt-4 lh-1_5">${spellStatLine(s)}</div><div class="fs-11_5 mt-5 lh-1_55 c-parch">${escapeHTML(s.d)}</div>${(() => { const ths = _themesOfPower(s.name); if (!ths.length) return '';
        // v8.75.0: progress-aware suite tags for super-capable characters —
        // ◈−1 when the discount is live, (n/2) while building toward it.
        const _superCap = getMPState(c).isSuperMutant;
        const sets = _powerThemeSets();
        const ownedSup = (c.powers || []).filter(p => p.pool === 'super').map(p => p.name);
        const bits = ths.map(th => {
          if (!_superCap) return escapeHTML(th);
          const n = ownedSup.filter(nm => sets[th].has(nm) && nm !== s.name).length;
          if (n >= 2) return `<b title="You own ${n} ${escapeHTML(th)} powers — further ${escapeHTML(th)} purchases cost 1 MP less (HH p.670).">${escapeHTML(th)} ◈−1</b>`;
          if (n === 1) return `<span title="Own one more ${escapeHTML(th)} power to unlock the suite discount (−1 MP on further ${escapeHTML(th)} purchases, HH p.670).">${escapeHTML(th)} (1/2)</span>`;
          return escapeHTML(th);
        });
        return `<div class="fs-10 mt-4" style="color:rgb(var(--text-lilac));" title="Super-Power Suites by Theme (HH Ch.XI). Own two powers from one suite and further powers from that suite cost 1 MP less.">◈ Suites: ${bits.join(' · ')}</div>`; })()}` : ''}
    </div>`;
  }).join('') || `<div class="p-0_9rem fs-12 c-g45 text-center">Nothing matches the current filters.</div>`)
  + (_pwBrowseList.length > CAP ? `<div class="p-6-9 fs-11 c-g50 text-center">…and ${_pwBrowseList.length - CAP} more — refine the filters to see them.</div>` : '');
}
