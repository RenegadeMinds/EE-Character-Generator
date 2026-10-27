// =============================================================================
// js/rules/buffs.js
// BUFFS — GAME RULES
// =============================================================================
//
// WHAT'S IN HERE
//   Game rules: calculations and changes to a character record. Drawing
//   pages lives in js/ui/; a few rules functions ask it to refresh after a
//   change. Active power effects (buffs) on a character: which are running,
//   what they add, and clearing them.
//
// KEY NAMES (so you can search for them)
//   functions (6): buffDurationText, perpetualBuffs, _buffEffectSources,
//   activeBuffBonuses, activeBuffAttrDeltas, clearActiveBuffs
//
// WHERE IT CAME FROM
//   Gathered from js/rules/09-item-effects-and-buffs.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

// Human duration for a wired chip: printed duration × the pool's effective
// level at cast time, plus any purchased rounds. Falls back to the raw text.
function buffDurationText(spell, pool, c, extraRounds) {
  const raw = ((spell && spell.duration) || '').split('(')[0].trim();
  const cl = (computeCasterLevels(c)[pool] || 0);
  const xr = extraRounds || 0;
  let m;
  if ((m = raw.match(/^(\d+)\s*rounds?\/level/i))) return `${parseInt(m[1], 10) * cl + xr} rounds`;
  if ((m = raw.match(/^(\d+)\s*min(?:ute)?s?\.?\/level/i))) return `${parseInt(m[1], 10) * cl} min`;
  if ((m = raw.match(/^(\d+)\s*hours?\/level/i))) return `${parseInt(m[1], 10) * cl} hr`;
  if ((m = raw.match(/^(\d+)\s*rounds?$/i))) return `${parseInt(m[1], 10) + xr} round${parseInt(m[1], 10) + xr === 1 ? '' : 's'}`;
  if ((m = raw.match(/^(\d+)\s*min(?:ute)?s?\.?$/i))) return `${parseInt(m[1], 10)} min`;
  if (/^concentration/i.test(raw)) return raw + (xr ? ` +${xr} rounds` : '');
  return raw ? raw + (xr ? ` +${xr} rounds` : '') : '';
}
function perpetualBuffs(c) {
  const out = [];
  if (!c) return out;
  const transient = new Set((Array.isArray(c.activeEffects) ? c.activeEffects : []).map(a => a.name));
  const powers = getCharPowers(c);
  for (const p of powers) {
    if (p.pool !== 'super') continue;
    const sp = SPELLS_DB.find(s => s.name === p.name);
    const mpn = sp ? (sp.mp_note || '') : '';
    const tagged = /(^|[;|])\s*Buff\b/i.test(mpn);
    const partial = /includes .+ as Buff/i.test(mpn);
    if (!tagged && !partial) continue;
    if (tagged && !p.buff) p.buff = true;   // self-heal the pre-v8.85.0 stamp
    const spec = (!partial) ? (POWER_EFFECTS[p.name] || null) : null;
    const effects = (spec && Array.isArray(spec.eff) && !spec.attrChoice) ? spec.eff.map(e => ({...e})) : [];
    out.push({ name: p.name, rung: p.rung || null, partial: !!partial,
      suppressed: !!p.buffOff, superseded: transient.has(p.name), effects,
      note: PERPETUAL_NOTES[p.name] || (spec && spec.note) || '' });
  }
  return out;
}
// The combined effect-source list both consumers iterate: the transient
// ledger plus the perpetual lane (suppressed / superseded / crunchless
// perpetuals contribute no numbers — their chips still render).
function _buffEffectSources(c) {
  const list = (c && Array.isArray(c.activeEffects)) ? c.activeEffects.slice() : [];
  for (const pb of perpetualBuffs(c)) {
    if (pb.suppressed || pb.superseded || !pb.effects.length) continue;
    list.push({ name: pb.name, effects: pb.effects, perpetual: true });
  }
  return list;
}

// Ledger → typed-bonus lists. Keys follow the house conventions so each
// consumer plugs in like an existing builder: fort/ref/will/ac/naturalAC/
// attack/damage/grapple + 'skill:<Name>'. Empty when nullified (NPF).
// v8.85.0: iterates _buffEffectSources — transient records + the perpetual lane.
function activeBuffBonuses(c) {
  const out = {};
  if (!c) return out;
  // v9.2.0: gear Boons are technology — they stand through a Null Power Field.
  const srcs = _buffEffectSources(c).filter(a => !c.nullified || a.gear);
  if (!srcs.length) return out;
  const push = (key, entry) => (out[key] = out[key] || []).push(entry);
  for (const a of srcs) {
    for (const e of a.effects) {
      const entry = { type: e.type || 'untyped', source: 'buff:' + a.name, value: e.v,
        label: `${a.name}${e.cond ? ' (' + e.cond + ')' : ''} — ${a.perpetual ? '◉ perpetual Buff' : 'active power'}` };
      if (e.gated && e.cond) entry.condition = e.cond;
      if (e.stacksAnyway) entry.stacksAnyway = true;  // Graft Weapon's printed exception
      if (e.k === 'save') { if (e.save === 'all') { push('fort', {...entry}); push('ref', {...entry}); push('will', {...entry}); } else push(e.save, entry); }
      else if (e.k === 'ac') push('ac', entry);
      else if (e.k === 'nac') push('naturalAC', entry);
      else if (e.k === 'attack') push('attack', entry);
      else if (e.k === 'damage') push('damage', entry);
      else if (e.k === 'grapple') push('grapple', entry);
      else if (e.k === 'skill') push('skill:' + e.skill, entry);
    }
  }
  return out;
}

// v8.43.0: transient-attrs door — per-attribute deltas from active effects.
// Typed rules: same-type buff bonuses take the best; ENHANCEMENT overlaps
// the item door (attrItemBonuses keeps the best item boost, enhancement-
// typed, so only the buff's excess applies); untyped bonuses and ALL
// penalties stack. NPF gate inherited (c.nullified → zero deltas).
function activeBuffAttrDeltas(c) {
  const delta = [0, 0, 0, 0, 0, 0];
  if (!c) return delta;
  const srcs = _buffEffectSources(c).filter(a => !c.nullified || a.gear);   // v8.85.0: + the perpetual lane; v9.2.0: gear passes the NPF gate
  if (!srcs.length) return delta;
  const itemBest = attrItemBonuses(c).best;
  const IDX = {STR:0, DEX:1, CON:2, INT:3, WIS:4, CHA:5};
  for (let i = 0; i < 6; i++) {
    const byType = {};
    let untypedSum = 0, penalties = 0;
    for (const a of srcs) {
      for (const e of a.effects) {
        if (e.k !== 'attr' || IDX[e.attr] !== i) continue;
        if (e.v < 0) { penalties += e.v; continue; }
        const t = e.type || 'untyped';
        if (t === 'untyped') untypedSum += e.v;
        else byType[t] = Math.max(byType[t] || 0, e.v);
      }
    }
    let add = untypedSum;
    for (const t in byType) {
      add += (t === 'enhancement') ? Math.max(0, byType[t] - (itemBest[i] || 0)) : byType[t];
    }
    delta[i] = add + penalties;
  }
  return delta;
}

// Rest clears EVERYTHING (Adam: "all effects wear off at the very least
// when the character rests" — manual-expiry ones certainly included).
function clearActiveBuffs(c, why) {
  if (!c || !Array.isArray(c.activeEffects) || !c.activeEffects.length) return 0;
  const keep = c.activeEffects.filter(a => a.keepOnRest);   // v9.2.0: Boost's Bane outlasts a rest (24 h)
  const ending = c.activeEffects.filter(a => !a.keepOnRest);
  const n = ending.length; if (!n) return 0;
  const names = ending.map(a => a.name).join(', ');
  c.activeEffects = keep;
  for (const a of ending) if (a.bane) boostBaneRoll(c);
  if (c.id === curId) logAct(`✨ Active power effects ended (${why}): ${names}.${(perpetualBuffs(c).some(pb => !pb.suppressed)) ? ' ◉ Perpetual Buffs stand — constitution, not casting.' : ''}`);
  return n;
}
