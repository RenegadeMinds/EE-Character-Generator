// =============================================================================
// js/ui/tracker/action-log.js
// TRACKER / ACTION LOG — PAGE CODE
// =============================================================================
//
// WHAT'S IN HERE
//   Page code: drawing this part of the page and handling the player's
//   clicks and typing. Tracker: the action log.
//
// KEY NAMES (so you can search for them)
//   functions (9): renderLog, logAct, logActionEvent, editActionLogNote,
//   clearActionLog, renderActionLog, onActionLogNoteEditStart,
//   onActionLogNoteEditSave, addLogEntry
//
// WHERE IT CAME FROM
//   Gathered from js/app/64-tracker.js, js/app/65-tracker-logs-and-
//   damage.js, js/app/66-xp-spending-and-level-up.js when the code was
//   regrouped by topic and page. Each function and table moved whole and
//   unchanged, with the comments above it, including the original version
//   notes.
//
// LOAD ORDER
//   Declarations only: nothing in js/rules/ or js/ui/ runs while the page
//   loads, so the order of those files does not matter. js/main.js, loaded
//   last, starts everything.
// =============================================================================

function renderLog(c){
  const el=document.getElementById('tr-log');
  if(!(c.log||[]).length){el.innerHTML=`<div class="fs-12" style="color:var(--g30);padding:.75rem 0;">No entries yet.</div>`;return;}
  el.innerHTML=[...(c.log||[])].reverse().map(e=>`<div class="log-entry"><div class="log-time">${e.time}</div>${e.text}</div>`).join('');
}
function logAct(txt){const c=chars.find(x=>x.id===curId);if(!c)return;if(!c.log)c.log=[];c.log.push({time:new Date().toLocaleString(),text:txt});save();renderLog(c);}

// ============================================================================
// v8.3.27: STRUCTURED AP/FP AUDIT LOG
// ============================================================================
//
// Separate from `c.log` (the free-text session journal). Where `c.log` holds
// player-authored story notes, `c.actionLog` holds structured records of
// every Action Point and Fate Point event:
//
//   entry: {
//     id:        unique id for note-edit handles
//     time:      ISO timestamp + human-readable string
//     kind:      'ap-spend' | 'ap-restore' | 'ap-reset' | 'fp-spend' | 'fp-restore'
//     delta:     numeric change (negative for spend, positive for restore)
//     balance:   resulting AP balance after the event
//     balanceMax: resulting apMax after the event (changes on FP spend/restore)
//     fpBalance: resulting fatePoints count
//     option:    canonical option name (e.g. "Heroic Effort", "Twist of Fate",
//                "Class ability activation", "Other (GM-approved)"), or null
//     note:      player's freeform annotation (may be empty)
//     level:     character.totalLvl at time of event
//   }
//
// Why two logs:
//   • `c.log` is the story journal — what the player chooses to write down.
//   • `c.actionLog` is the resource audit — what AP/FP actually moved.
// The two coexist with distinct UI panels on the Tracker. Per design call:
// AP/FP events are NOT also written to c.log to avoid duplication.
//
// Behavior:
//   • AP and FP buttons no longer call logAct (free-text journal).
//   • Bare ±1 buttons now route through prompt modals that gather a canonical
//     option (radio list) + optional note, then call logActionEvent().
//   • Restore is silent on auto-events (e.g. full-rest, level-up); on manual
//     +1 button the user gets the prompt modal.

function logActionEvent(c, kind, delta, option, note) {
  if (!c) return;
  if (!Array.isArray(c.actionLog)) c.actionLog = [];
  const now = new Date();
  c.actionLog.push({
    id: 'al-' + now.getTime() + '-' + Math.floor(Math.random() * 1000),
    time: now.toLocaleString(),
    timeIso: now.toISOString(),
    kind: kind,
    delta: delta || 0,
    balance: c.ap || 0,
    balanceMax: c.apMax || 0,
    fpBalance: c.fatePoints || 0,
    option: option || null,
    note: note || '',
    level: c.totalLvl || 1,
  });
}

// Edit the note on a previous action-log entry. Called from the inline ✎ UI.
function editActionLogNote(entryId, newNote) {
  const c = chars.find(x => x.id === curId);
  if (!c || !Array.isArray(c.actionLog)) return;
  const entry = c.actionLog.find(e => e.id === entryId);
  if (!entry) return;
  entry.note = (newNote || '').trim();
  save();
  renderActionLog(c);
}

// Clear the entire action log (with confirm). Player-initiated only.
async function clearActionLog() {
  const c = chars.find(x => x.id === curId);
  if (!c) return;
  if (!Array.isArray(c.actionLog) || c.actionLog.length === 0) {
    toast('No history to clear.');
    return;
  }
  if (!(await confirmModal(`Clear ${c.actionLog.length} action-log entr${c.actionLog.length===1?'y':'ies'}? This cannot be undone.`))) return;
  c.actionLog = [];
  save();
  renderActionLog(c);
  toast('Action history cleared.');
}

// ============================================================================
// v8.3.27: ACTION LOG PANEL on the Tracker
// ============================================================================

function renderActionLog(c) {
  const el = document.getElementById('tr-action-log');
  if (!el) return;
  const entries = (c.actionLog || []).slice().reverse(); // newest first
  if (entries.length === 0) {
    el.innerHTML = `<div class="fs-11 c-g35 italic" style="padding:.5rem 0;">No AP/FP events logged yet. Spends and manual restores will appear here.</div>`;
    return;
  }
  el.innerHTML = entries.map(e => {
    const kindLabel = ({
      'ap-spend':   { text: 'AP Spend',   color: 'var(--gold)',         sign: '−'},
      'ap-restore': { text: 'AP Restore', color: '#6dba88',             sign: '+'},
      'ap-reset':   { text: 'AP Reset',   color: 'var(--g60)', sign: '↻'},
      'fp-spend':   { text: 'FP Spend',   color: '#c499d4',             sign: '−'},
      'fp-restore': { text: 'FP Restore', color: '#c499d4',             sign: '+'},
      // v8.20.0 XP-expenditure ledger kinds.
      'xp-grant':   { text: 'XP Grant',   color: '#6dba88',             sign: '+'},
      'xp-spend':   { text: 'XP Spend',   color: '#d4865a',             sign: '−'},
      'xp-reserve': { text: 'MC Reserve', color: '#78afcd',             sign: '🔧'},
    })[e.kind] || { text: e.kind, color: 'var(--g70)', sign: '·'};
    const isFP = e.kind === 'fp-spend' || e.kind === 'fp-restore';
    const isXP = e.kind && e.kind.startsWith('xp-');
    const balanceText = isXP
      ? `${Math.abs(e.delta || 0).toLocaleString()} XP`
      : isFP
      ? `${e.balance}/${e.balanceMax} AP, ${e.fpBalance} FP spent`
      : `${e.balance}/${e.balanceMax} AP`;
    const optionTag = e.option
      ? `<span style="font-size:10.5px;color:${kindLabel.color};font-weight:600;">${escapeHTML(e.option)}</span>`
      : '';
    const noteText = e.note
      ? `<span class="fs-10_5 c-g65 italic">"${escapeHTML(e.note)}"</span>`
      : `<button type="button" class="border-none c-g45 fs-10 cursor-pointer p-0" style="background:none;text-decoration:underline;" onclick="onActionLogNoteEditStart('${escapeHTML(e.id)}')">✎ add note</button>`;
    const editBtn = e.note
      ? `<button type="button" class="border-none c-g40 fs-10 cursor-pointer" style="background:none;padding:0 0 0 4px;" onclick="onActionLogNoteEditStart('${escapeHTML(e.id)}')" title="Edit note">✎</button>`
      : '';
    const bgTint = isFP ? 'rgba(196,153,212,.04)' : 'rgba(200,151,30,.03)';
    const borderTint = isFP ? 'rgba(196,153,212,.3)' : 'rgba(200,151,30,.2)';
    const deltaAbs = Math.abs(e.delta || 1);
    return `<div class="al-entry" data-entry-id="${escapeHTML(e.id)}" style="margin:5px 0;padding:6px 9px;background:${bgTint};border-left:2px solid ${borderTint};border-radius:2px;">
      <div class="justify-between items-baseline fs-10_5 c-g55" style="display:flex;">
        <span>${escapeHTML(e.time)} <span class="c-g40">· L${e.level||1}</span></span>
        <span style="font-weight:600;color:${kindLabel.color};">${kindLabel.sign}${deltaAbs} ${kindLabel.text}</span>
      </div>
      <div class="justify-between items-baseline mt-3 gap-8 flex-wrap" style="display:flex;">
        <div class="flex-1" style="min-width:120px;">${optionTag}</div>
        <div class="fs-10_5 c-g45">${balanceText}</div>
      </div>
      <div class="mt-3 items-center gap-4 flex-wrap al-note-row" style="display:flex;">
        ${noteText}${editBtn}
      </div>
    </div>`;
  }).join('');
}

function onActionLogNoteEditStart(entryId) {
  const entryEl = document.querySelector(`.al-entry[data-entry-id="${entryId}"]`);
  if (!entryEl) return;
  const noteRow = entryEl.querySelector('.al-note-row');
  if (!noteRow) return;
  const c = chars.find(x => x.id === curId);
  const existing = (c && (c.actionLog || []).find(e => e.id === entryId)?.note) || '';
  noteRow.innerHTML = `
    <input type="text" class="rounded-2 flex-1 min-w-160 fs-11 c-gold p-2-6 al-note-input" value="${escapeHTML(existing)}" placeholder="Type a note (or leave blank to clear)" maxlength="240" style="background:rgba(0,0,0,.35);border:1px solid rgba(200,151,30,.4);">
    <button type="button" onclick="onActionLogNoteEditSave('${entryId}')" class="rounded-2 p-2-6 fs-10 cursor-pointer" style="background:rgba(125,180,135,.15);color:#6dba88;border:1px solid rgba(125,180,135,.5);">✓</button>
    <button type="button" onclick="renderActionLog(chars.find(x=>x.id===curId))" style="background:rgba(200,151,30,.06);color:var(--g70);border:1px solid rgba(200,151,30,.3);padding:2px 6px;font-size:10px;cursor:pointer;border-radius:2px;">✕</button>
  `;
  const inp = noteRow.querySelector('input');
  if (inp) {
    inp.focus();
    inp.select();
    inp.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter') { ev.preventDefault(); onActionLogNoteEditSave(entryId); }
      else if (ev.key === 'Escape') { ev.preventDefault(); renderActionLog(chars.find(x => x.id === curId)); }
    });
  }
}
function onActionLogNoteEditSave(entryId) {
  const entryEl = document.querySelector(`.al-entry[data-entry-id="${entryId}"]`);
  if (!entryEl) return;
  const inp = entryEl.querySelector('.al-note-input');
  if (!inp) return;
  editActionLogNote(entryId, inp.value);
}
function addLogEntry(){const inp=document.getElementById('tr-log-inp'),t=inp.value.trim();if(!t)return;logAct(t);inp.value='';}

