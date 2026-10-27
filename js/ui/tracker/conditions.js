// =============================================================================
// js/ui/tracker/conditions.js
// TRACKER / CONDITIONS — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker and Sheet: conditions.
//
// KEY NAMES (so you can search for them)
//   functions (6): renderConds, populateConditionDropdown,
//   renderSheetConditionBanner, addCond, rmCond, clearConds
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/app/66-xp-spending-and-level-
//   up.js when the code was regrouped by topic and page. Each function and
//   table moved whole and unchanged, with the comments above it, including
//   the original version notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function renderConds(c){
  const el=document.getElementById('tr-conds');
  const effectsEl=document.getElementById('tr-cond-effects');
  const conds=c.conditions||[];
  // v8.60.2 (Adam): ⊘ Nullified lives with the conditions now. Rendered
  // only for Su-bearing characters (same gate as the old Sheet button);
  // lit red while active. The Sheet keeps the status banner + Restore.
  {
    const nfEl = document.getElementById('tr-nullify');
    if (nfEl) {
      const suAttrs = suBakedPerAttr(c);
      const hasSu = suAttrs.some(v => v)
        || (c.talents || []).some(t => TALENTS_DB.find(x => x.n === (t.name || t.n) && /Super-Talent/.test(x.tier || '')))
        || (c.powers || []).some(p => p.pool === 'super');
      nfEl.innerHTML = hasSu
        ? `<button class="ilbtn" style="${c.nullified ? 'border-color:rgba(212,112,112,.7);color:var(--red-text);' : 'opacity:.7;'}" title="${c.nullified ? 'Null Power Field active — all Supernatural modifiers suppressed (Su ability bakes, Bulletproof, Hyper-Speed, Energy Immunity, Super-Smash, ✨ buffs). Click to restore.' : 'Simulate a Null Power Field: suppress ALL Supernatural modifiers, reducing the character to natural + Extraordinary. Rage still works (Ex).'}" onclick="toggleNullified()">⊘ Nullified${c.nullified ? ' ✓' : '?'}</button>`
        : '';
    }
    // v8.63.0: ⚡ Reckless Offense declared stance — feat-gated, lit red
    // while active (same idiom as ⊘ Nullified). Attack rolls only (Adam).
    const roEl = document.getElementById('tr-reckless');
    if (roEl) {
      const roOn = combatDecl(c).ro;
      roEl.innerHTML = ownsFeatN(c, 'Reckless Offense')
        ? `<button class="ilbtn" style="${roOn ? 'border-color:rgba(212,112,112,.7);color:var(--red-text);' : 'opacity:.7;'}" title="${roOn ? 'Reckless Offense declared — +2 on melee attack rolls incl. Grapple (a grapple check is like a melee attack roll), −4 AC (HH p.239). Base Attack and the iterative ladder untouched. Click to withdraw the stance.' : 'Declare Reckless Offense: take −4 AC for +2 on melee attack rolls (HH p.239) — Grapple included; never ranged. A set-point stance — holds until re-declared. Never touches Base Attack (no extra iterative attacks).'}" onclick="toggleRecklessOffense()">⚡ Reckless${roOn ? ' ✓' : '?'}</button>`
        : '';
    }
    // v8.77.0 (Adam's Sheet polish): ⚡ Euphoric's TRIGGER moved here from
    // the Sheet's toggle strip — it's a transient battle state, so it lives
    // with the conditions (the ⊘ Nullified precedent); the Sheet keeps the
    // blue EUPHORIC banner as the in-effect flag.
    const euEl = document.getElementById('tr-euphoric');
    if (euEl) {
      const euB = euphoriacBonus(c);
      euEl.innerHTML = euB
        ? `<button class="ilbtn" style="${c.euphoric ? 'border-color:rgba(120,175,205,.7);color:#78afcd;' : 'opacity:.7;'}" title="${c.euphoric ? `Euphoric — +${euB} morale on attack rolls, damage rolls, and saving throws (baked into the Sheet). Lasts (wild-surge intensity) rounds. Click when it fades.` : `Euphoriac (Ex, Wilder): after invoking a wild surge without neuralgia, gain +${euB} morale on attack, damage, and saves for (surge intensity) rounds. Click to declare it.`}" onclick="toggleEuphoric()">⚡ Euphoric${c.euphoric ? ' ✓' : '?'}</button>`
        : '';
    }
  }

  if(!conds.length){
    el.innerHTML=`<span style="font-family:'Epics Serif','Cinzel',serif;font-size:11px;color:var(--g35);">No conditions</span>`;
    if(effectsEl){effectsEl.style.display='none';effectsEl.innerHTML='';}
    // Also refresh the Sheet's persistent banner (in case the player is back
    // and forth between Tracker and Sheet)
    renderSheetConditionBanner(c);
    return;
  }

  // Render each condition as a tier-styled pill.
  el.innerHTML = conds.map(co => {
    const data = CONDITIONS_DATA[co];
    const tier = (data && data.tier) || 'moderate';
    const style = CONDITION_TIER_STYLE[tier] || CONDITION_TIER_STYLE.moderate;
    // The terminal tier gets the stark inversion treatment.
    const css = style.stark
      ? `background:${style.bg};border:2px solid ${style.border};color:${style.color};font-weight:700;text-transform:uppercase;letter-spacing:.08em;`
      : `background:${style.bg};border:1px solid ${style.border};color:${style.color};`;
    return `<span class="cond-tag" style="${css}">${escapeHTML(co)} <span class="cond-rm" onclick="rmCond('${co.replace(/'/g, "\\'")}')">✕</span></span>`;
  }).join('');

  // Populate the mechanical-effects panel — one block per active condition.
  // Each block shows: condition name (tier-colored), then the full handbook
  // text. Cited at the end so the player can verify in the source if needed.
  if(effectsEl){
    effectsEl.style.display='block';
    effectsEl.innerHTML = `
      <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;">Mechanical Effects</div>
      ${conds.map(co => {
        const data = CONDITIONS_DATA[co];
        if(!data){
          // Unrecognized condition — preserve it, but flag it
          return `<div style="margin-bottom:8px;padding:8px 10px;background:rgba(200,151,30,.04);border-left:2px solid rgba(200,151,30,.3);border-radius:2px;">
            <div style="font-weight:600;color:var(--gold);font-size:12px;margin-bottom:3px;">${escapeHTML(co)}</div>
            <div style="font-size:11px;color:var(--g55);font-style:italic;">No reference data found for this condition. See the Hero's Handbook condition appendix.</div>
          </div>`;
        }
        const style = CONDITION_TIER_STYLE[data.tier] || CONDITION_TIER_STYLE.moderate;
        const titleCSS = style.stark
          ? `color:${style.color};background:${style.bg};padding:2px 8px;border-radius:2px;font-weight:700;letter-spacing:.05em;`
          : `color:${style.color};font-weight:600;`;
        // Render `desc` with paragraph breaks (the data uses \n\n).
        // v8.3.30: the per-paragraph style must be applied to EVERY paragraph,
        // not just the first. The previous code wrapped the whole desc in one
        // styled <p> but replaced internal \n\n with a BARE <p style="margin..">
        // that lacked font-size + color — so paragraphs 2+ rendered at the
        // browser default (large, stark white). Conditions with multi-paragraph
        // descriptions (Frightened, Confused, Panicked, etc.) all showed this.
        // Fix: define the paragraph style once and use it for every <p>.
        const paraCSS = 'margin:0;font-size:11.5px;color:var(--g78);line-height:1.55;';
        const paraCSSNext = 'margin:6px 0 0 0;font-size:11.5px;color:var(--g78);line-height:1.55;';
        const descHtml = escapeHTML(data.desc).replace(/\n\n/g, `</p><p style="${paraCSSNext}">`);
        const cit = data.citation ? `<span style="font-size:10px;color:var(--g40);font-style:italic;margin-left:6px;">(${data.citation.book} p.${data.citation.page})</span>` : '';
        return `
          <div style="margin-bottom:8px;padding:9px 11px;background:rgba(200,151,30,.04);border-left:3px solid ${style.border};border-radius:2px;">
            <div style="margin-bottom:5px;font-size:12px;"><span style="${titleCSS}">${escapeHTML(co)}</span> <span style="font-size:10px;color:var(--g45);text-transform:uppercase;letter-spacing:.04em;margin-left:4px;">${style.label}</span>${cit}</div>
            <p style="${paraCSS}">${descHtml}</p>
          </div>`;
      }).join('')}
    `;
  }

  // Always re-render the Sheet banner so it stays in sync if the player
  // alt-tabs back to the Sheet view.
  renderSheetConditionBanner(c);
}

// v8.3.20: Populate the More… dropdown with the full condition list, excluding
// the 6 already-on-the-quick-add-row entries (which would be redundant).
// Called once at init.
function populateConditionDropdown(){
  const sel=document.getElementById('tr-cond-more');
  if(!sel) return;
  const rest=Object.keys(CONDITIONS_DATA).filter(n=>!COMMON_CONDITIONS.includes(n)).sort();
  const opts=['<option value="">More…</option>'].concat(
    rest.map(n=>`<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)
  ).join('');
  sel.innerHTML=opts;
}

function renderSheetConditionBanner(c){
  const el=document.getElementById('sh-conditions-banner');
  if(!el) return;
  const conds=c.conditions||[];
  if(!conds.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`
    <div style="font-family:'Epics Serif','Cinzel',serif;font-size:10px;color:var(--g55);letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px;">Active Conditions</div>
    ${conds.map(co=>{
      const data=CONDITIONS_DATA[co];
      const tier=(data && data.tier)||'moderate';
      const style=CONDITION_TIER_STYLE[tier]||CONDITION_TIER_STYLE.moderate;
      const gloss=data ? data.gloss : 'See Tracker for details.';
      const isStark=!!style.stark;
      const containerCSS=isStark
        ? `background:${style.sheetBg};border:2px solid ${style.sheetBorder};color:${style.sheetColor};margin-bottom:5px;padding:7px 11px;border-radius:2px;`
        : `background:${style.sheetBg};border:1px solid ${style.sheetBorder};color:${style.sheetColor};margin-bottom:5px;padding:6px 10px;border-radius:2px;border-left-width:3px;`;
      const nameCSS=isStark
        ? `font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12px;`
        : `font-weight:600;font-size:12px;`;
      return `
        <div style="${containerCSS}">
          <span style="${nameCSS}">${escapeHTML(co)}</span>
          <span style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:.04em;margin-left:6px;">${style.label}</span>
          <div style="font-size:11px;margin-top:2px;opacity:.85;line-height:1.5;">${escapeHTML(gloss)}</div>
        </div>`;
    }).join('')}
  `;
}
function addCond(co){const c=chars.find(x=>x.id===curId);if(!c)return;if(!c.conditions)c.conditions=[];if(!c.conditions.includes(co)){c.conditions.push(co);save();renderConds(c);}}
function rmCond(co){const c=chars.find(x=>x.id===curId);if(!c||!c.conditions)return;c.conditions=c.conditions.filter(x=>x!==co);save();renderConds(c);}
function clearConds(){const c=chars.find(x=>x.id===curId);if(!c)return;c.conditions=[];save();renderConds(c);}
