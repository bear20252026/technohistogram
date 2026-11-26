// Connections: pick a record and the atlas draws where it appears across the tabs as a hairline graph on the plot,
// with a ruled side index. Specimen Stage discipline: the selected record in red, linked records in ink with 1px
// leaders, everything else paled to 0.35. Stream and Columns share this module; each view supplies positions.
import { db, ensure, passes } from './data.js';
import { set, state as S } from './store.js';
import { goWhere, esc } from './ui.js';
import { DOMAIN } from './palette.js';

// the groups in the order the index lists them; patterns last because they are the broadest
export const CX_KINDS = [['th', 'Thread', 'Threads'], ['po', 'Policy', 'Policies'], ['bm', 'Benchmark', 'Benchmarks'], ['dl', 'Deal', 'Deals'], ['im', 'Measure', 'Measures'], ['pt', 'Pattern', 'Patterns']];
const WEIGHT = { th: 3, po: 3, bm: 3, dl: 3, im: 2, pt: 1 };

// links.json arrives lazily; the first look asks for it and the caller redraws when it lands
export function cxLinks(id, onReady) {
  if (!db.links) { ensure('links').then(() => onReady && onReady()); return null; } // ensure memoises the fetch, so a second caller only adds its callback
  return db.links.events[id] || null;
}
const name = (k, id) => ((db.links && db.links.names[k]) || {})[id] || id;
const year = (k, id) => ((db.links && db.links.years[k]) || {})[id];
// the reason the build wrote for a link, keyed "kind:id" as the drawer reads it; a dated link without one states its distance
const apart = (a, b) => { const d = b - a; return d === 0 ? 'the same year' : d > 0 ? `${d} year${d === 1 ? '' : 's'} later` : `${-d} year${d === -1 ? '' : 's'} earlier`; };
export const cxWhy = (L, k, id, e) => { const w = (L && (L.why || L.reasons)) || {}; const r = w[`${k}:${id}`] || (w[k] && typeof w[k] === 'object' ? w[k][id] : '') || ''; if (r) return r; const yr = year(k, id); return yr && e ? `${KIND_ONE[k]}, ${apart(e.year, yr)}` : ''; };
const KIND_ONE = { th: 'thread', po: 'rule', bm: 'benchmark', dl: 'deal', im: 'measure', pt: 'pattern' };
// the basis the build recorded: how the compilers tied the two ("rule names the event", "same organization: OpenAI", "thread step 4 of 14")
export const cxBasis = (L, k, id) => ((L && L.basis) || {})[`${k}:${id}`] || '';
// the mono line under an entry: basis first, then the reason or the time clause
export const cxLine = (L, k, id, e) => {
  const b = cxBasis(L, k, id), w = cxWhy(L, k, id, e);
  if (b && w) {
    const bl = b.toLowerCase(), wl = w.toLowerCase();
    if (bl.includes(wl)) return b; // "thread step 9 of 15" already says "step 9 of 15"
    if (wl.includes(bl)) return w;
    if (w.split(' ')[0] === b.split(' ')[0]) { const m = w.match(/, (\d{4})$/); return b + (m ? `, ${m[1]}` : ''); } // the same basis twice reads once, with the year kept
  }
  return [b, w].filter(Boolean).join('; ');
};

// records in the pool that share a link with the selected one: a shared thread, policy, benchmark, deal or measure
// counts for more than a shared pattern; the nearest in time win when there are more than the cap
export function cxLinked(e, pool, cap = 40) {
  const out = cxLinkedAll(e, pool);
  const list = out.slice(0, cap).sort((a, b) => a.e.year - b.e.year);
  list.total = out.length;
  return list;
}
function cxLinkedAll(e, pool) {
  const L = db.links && db.links.events[e.id]; if (!L) return [];
  const mine = new Map();
  for (const [k] of CX_KINDS) for (const id of L[k] || []) mine.set(`${k}:${id}`, WEIGHT[k]);
  if (!mine.size) return [];
  const out = [];
  for (const o of pool) {
    if (o.id === e.id) continue;
    const M = db.links.events[o.id]; if (!M) continue;
    let score = 0; const shared = [];
    for (const [k] of CX_KINDS) for (const id of M[k] || []) { const key = `${k}:${id}`; if (mine.has(key)) { score += mine.get(key); shared.push(key); } }
    if (score >= 2 || (score === 1 && mine.size === 1)) out.push({ e: o, shared, score });
  }
  out.sort((a, b) => b.score - a.score || Math.abs(a.e.year - e.year) - Math.abs(b.e.year - e.year));
  return out;
}
// the span of a record and its linked records, padded a year each side: the brush a pick sets so the links spread
export function cxSpan(e, linked) {
  const ys = [e.year, ...linked.map((l) => l.e.year)];
  const a = Math.min(...ys), b = Math.max(...ys);
  return [Math.max(1026, a - 1), Math.min(2026, b + 1)];
}
// what a linked record shares with the picked one, as a clause: shares the thread "Hype cycles"; same deal "NVIDIA to OpenAI"
// the shared association, as links.json states it (basis), never a cause
const SHARE = { th: 'steps of the same thread', po: 'named by the same rule', bm: 'named by the same benchmark', dl: 'names a party to the same deal', im: 'milestone on the same measure', pt: 'counted in the same pattern' };
export const cxShared = (shared) => shared.slice(0, 2).map((s) => { const k = s.slice(0, 2), id = s.slice(3); return `${SHARE[k]} \u201c${name(k, id)}\u201d`; }).join('; ') + (shared.length > 2 ? `; and ${shared.length - 2} more` : '');

// the side index: one ruled block per group with its count, each row a jump into the owning view; then the linked
// records, each row a pick. The only cue is "Click a mark."
export function cxIndex(host, { e, linked = [], onPick, onExit, onJump, onAll, onOpen, all = false }) {
  const L = e ? db.links && db.links.events[e.id] : null;
  if (!e && !db.links) { const args = { e, linked, onPick, onExit, onJump, onAll, all }; ensure('links').then(() => { if (host.isConnected && !host.querySelector('.cx-sel')) cxIndex(host, args); }); }
  host.setAttribute('role', 'region'); host.setAttribute('aria-label', 'Linked records'); host.setAttribute('aria-live', 'polite');
  const parts = [`<div class="cx-h"><span class="sc">Connections</span><button type="button" class="cx-exit" data-a="exit" aria-label="Exit connections">Exit</button></div>`];
  if (!e) {
    parts.push(`<p class="cx-cue">Click a mark.</p>`);
    // keyboard path to the first pick: the most-linked records as buttons, shown only while focused (the pointer path is the plot)
    const E = (db.links && db.links.events) || {};
    const picks = Object.keys(E).map((id) => ({ id, n: Object.values(E[id]).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0) })).filter((x) => x.n && db.byId && db.byId.get(x.id)).sort((a, b) => b.n - a.n).slice(0, 12);
    if (picks.length) parts.push(`<div class="cx-picks" role="group" aria-label="Pick a record by keyboard"><ul class="cx-g">${picks.map(({ id, n }) => { const o = db.byId.get(id); return `<li><button type="button" data-pick="${esc(id)}"><span class="tt">${esc(o.title)}</span><span class="y">${o.year}</span><small class="cx-why">${n} link${n === 1 ? '' : 's'}</small></button></li>`; }).join('')}</ul></div>`);
  } else {
    const d = DOMAIN[e.domain];
    parts.push(`<div class="cx-sel"><b>${esc(e.title)}</b><span>${e.year}${d ? ` · ${esc(d.label)}` : ''}</span><button type="button" class="cx-open" data-a="open">Open the record</button></div>`); // the drawer opens from here only; clicks on the plot pick
    if (!db.links) parts.push(`<p class="cx-cue">Loading the links.</p>`);
    else if (!L) parts.push(`<p class="cx-cue">No links yet for this record.</p>`);
    const rows = [];
    for (const [k, one, many] of CX_KINDS) {
      const ids = (L && L[k]) || []; if (!ids.length) continue;
      rows.push(`<li class="cx-grp"><span class="k">${esc(many)}</span><b>${ids.length}</b></li>`);
      const order = ids.slice().sort((p, q) => cxBasis(L, k, p).localeCompare(cxBasis(L, k, q)) || (year(k, p) || 0) - (year(k, q) || 0)); // by basis, then year
      for (const id of order) {
        const yr = year(k, id), w = cxLine(L, k, id, e);
        rows.push(`<li><button type="button" data-go="${k}:${esc(id)}" title="Open in its view"><span class="tt">${esc(name(k, id))}</span>${yr ? `<span class="y">${yr}</span>` : '<span class="y"></span>'}${w ? `<small class="cx-why">${esc(w)}</small>` : ''}</button></li>`);
      }
    }
    const total = linked.total != null ? linked.total : linked.length;
    if (linked.length) {
      rows.push(`<li class="cx-grp"><span class="k">Linked records${total > linked.length ? `, ${linked.length} of ${total}` : ''}</span><b>${total}</b></li>`);
      for (const { e: o, shared } of linked) rows.push(`<li><button type="button" data-pick="${esc(o.id)}"><span class="tt">${esc(o.title)}</span><span class="y">${o.year}</span><small class="cx-why">${esc(cxShared(shared))}</small></button></li>`);
      if (total > linked.length && !all) rows.push(`<li><button type="button" class="cx-all" data-a="all"><span class="tt">Show all ${total}</span></button></li>`);
    }
    if (rows.length) parts.push(`<ul class="cx-g">${rows.join('')}</ul>`);
  }
  host.innerHTML = parts.join('');
  host.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'exit') onExit && onExit();
    else if (b.dataset.a === 'open') { if (onOpen) onOpen(e.id); else set({ sel: e.id }); }
    else if (b.dataset.a === 'all') onAll && onAll();
    else if (b.dataset.pick) onPick && onPick(b.dataset.pick);
    else if (b.dataset.go) { onJump && onJump(b.dataset.go); goWhere(b.dataset.go, e); }
  };
}

// the graph: hairline leaders from the selected record to each linked mark, marks in ink, the record in red
export function cxGraph(g, sel, marks, { onPick, onFocus, focus = -1 } = {}) {
  g.selectAll('*').remove();
  if (!sel) return;
  // each leader is a shallow arc from the record to the mark's own position, bowing away from the axis so neighbours separate
  const ln = g.append('g').attr('class', 'cx-leaders');
  ln.selectAll('path').data(marks).join('path').attr('class', 'cx-leader')
    .attr('d', (m, i) => { const dx = m.x - sel.x, dy = m.y - sel.y, len = Math.hypot(dx, dy) || 1; const bow = Math.min(60, len * 0.25) * (i % 2 ? 1 : -1); const cx = (sel.x + m.x) / 2 - (dy / len) * bow, cy = (sel.y + m.y) / 2 + (dx / len) * bow; return `M${sel.x},${sel.y}Q${cx},${cy} ${m.x},${m.y}`; });
  const mk = g.append('g').attr('class', 'cx-marks');
  const entry = focus >= 0 ? focus : 0; // one mark is in the tab order so the arrows have an entry from Tab
  const dot = mk.selectAll('g').data(marks).join('g').attr('class', (m, i) => `cx-mark${i === focus ? ' focus' : ''}`)
    .attr('transform', (m) => `translate(${m.x},${m.y})`).attr('role', 'button').attr('tabindex', (m, i) => (i === entry ? 0 : -1))
    .attr('aria-label', (m) => `${m.e.title}, ${m.e.year}`)
    .on('click', (ev, m) => { ev.stopPropagation(); onPick && onPick(m.e.id); })
    .on('keydown', (ev, m) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onPick && onPick(m.e.id); } })
    .on('focus', (ev, m) => { const i = marks.indexOf(m); if (onFocus && i !== focus) onFocus(i); });
  dot.append('circle').attr('class', 'cx-hit').attr('r', 12); // 24px target
  dot.append('circle').attr('class', 'cx-dot').attr('r', 3.2);
  dot.append('title').text((m) => `${m.e.title} (${m.e.year})`);
  const s = g.append('g').attr('class', 'cx-selmark').attr('transform', `translate(${sel.x},${sel.y})`);
  s.append('circle').attr('r', 6.5);
  s.append('circle').attr('r', 2.2);
  // the keyboard's place: a ring and the record's name, so arrows read without a pointer
  const f = marks[focus];
  if (f) g.append('text').attr('class', 'cx-focus-lab').attr('x', f.x + 9).attr('y', f.y - 8).text(`${f.e.title} · ${f.e.year}`);
}

// arrows move along the linked marks by year; Enter picks the focused one; Escape leaves the mode
export function cxKey(ev, cx, { onPick, onExit, onFocus }) {
  const k = ev.key;
  if (k === 'Escape') { ev.preventDefault(); onExit(); return true; }
  if (!cx.marks || !cx.marks.length) return false;
  if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); cx.focus = (cx.focus + 1) % cx.marks.length; onFocus(cx.focus); cxFocusMark(ev.currentTarget, cx.focus); return true; }
  if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); cx.focus = (cx.focus - 1 + cx.marks.length) % cx.marks.length; onFocus(cx.focus); cxFocusMark(ev.currentTarget, cx.focus); return true; }
  if (k === 'Enter' && cx.focus >= 0) { ev.preventDefault(); onPick(cx.marks[cx.focus].e.id); return true; }
  return false;
}
// after an arrow, the focused mark takes DOM focus too, so a screen reader names it
function cxFocusMark(root, i) { const n = root && root.querySelectorAll ? root.querySelectorAll('.cx-mark')[i] : null; if (n && n.focus) n.focus({ preventScroll: true }); }

// under 760px the mode folds into the drawer: the Where-this-appears list is the index, and one button brushes the
// window to the span of the record and its linked records on Stream. Called by a view when the selection changes.
// phones with the mode on: the connections list is the drawer's first block for the picked record
let foldWatch = null;
export function cxFoldList(id, { onExit, onPick } = {}) {
  const e = db.byId.get(id); if (!e) return;
  const body = document.getElementById('db'); if (!body) return;
  const place = () => {
    if (S.sel !== id) return;
    let host = body.querySelector('.cx-fold');
    if (!host) { host = document.createElement('section'); host.className = 'cx-fold cx-ix'; body.prepend(host); }
    const linked = cxLinked(e, db.events.filter((o) => passes(o)), 12);
    cxIndex(host, { e, linked, onExit, onPick: (pid) => (onPick ? onPick(pid) : set({ sel: pid })) });
  };
  // the drawer redraws itself as its datasets arrive, so the block is put back whenever the body is rebuilt without it
  if (foldWatch) foldWatch.disconnect();
  foldWatch = new MutationObserver(() => { if (S.sel === id && !body.querySelector('.cx-fold')) place(); });
  foldWatch.observe(body, { childList: true });
  if (!cxLinks(id, place) && !db.links) { place(); return; }
  place();
}
export function cxFoldStop() { if (foldWatch) { foldWatch.disconnect(); foldWatch = null; } const f = document.querySelector('#db .cx-fold'); if (f) f.remove(); }
export function cxFold(id) {
  const e = db.byId.get(id); if (!e) return;
  const tryIt = (n) => {
    const where = document.querySelector('.drawer .where-checked, #drawer .where-checked, .where-checked');
    if (!where) { if (n > 0) setTimeout(() => tryIt(n - 1), 250); return; }
    if (where.parentNode.querySelector('.cx-brush')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cx-brush'; b.textContent = 'Draw the links';
    b.title = 'Open Stream with the years set to this record and its linked records';
    b.onclick = () => { const linked = cxLinked(e, db.events.filter((o) => passes(o)), Infinity); const [y0, y1] = cxSpan(e, linked); set({ view: 'stream', y0, y1, sel: '' }); };
    where.after(b);
  };
  tryIt(6);
}
