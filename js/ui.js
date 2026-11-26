// Shared UI: tooltip, drawer, scrubber, filters, search.
import { db, neighbors, passes, drawn, draw, registerFor, overlaysOn, census, ensureTxt, ensureD3, hasD3, fmtDate, host, modelEvents, ensure, ensureNow, ensureAll, needsFor, forecastCount } from './data.js';
import { state, set, subscribe, YEAR_MIN, YEAR_MAX, setHover } from './store.js';
import { timeScale, AGES, REGION, regionColor, slotOf, slotF, SLOT_MAX, fmtYear } from './time.js';
const clampY = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
import { recent, fmtDate as fmtDay } from './recent.js';
import { wrapMeasured } from './text.js';
import { benchDrawer, personDrawer, policyDrawer } from './aidepth.js';
import { DOMAINS, DOMAIN, TYPES, TYPE, typeColor, AI_ERA, prettyTag, threadColor } from './palette.js';
import { VERDICT_NIGHT, VERDICT_WORD, STATUS_NIGHT, STATUS_WORD, GROUNDS, heat, rgba as rgbaOf } from './spectrum.js';
const recCol = (y) => heat(slotOf(clampY(+y || 2026, YEAR_MIN, YEAR_MAX)) / SLOT_MAX); // a record is coloured by its slot along the coil: the one blend // a record is coloured by its year: the one blend, shared with the coil
// tint of the record pane: the blend at the year of what opened it (or the verdict of a claim) as a flat wash on the head,
// and --rec for its date
const tint = (col) => { const dr = document.getElementById('drawer'); if (!dr) return; const c = String(col || '#aeb6dc'); dr.style.setProperty('--rec', c); dr.style.setProperty("--rec-wash", c.startsWith("#") && c.length === 7 ? rgbaOf(c, 0.12) : c); };
const W_COL = { open: '#3f8f78', gated: '#a0661a', closed: '#121212' };
const wOf = (m) => m.weights || (m.open_weights ? 'open' : 'closed');

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

/* ---------- Tooltip ---------- */
const tipEl = () => $('#tip');
export const tip = {
  show(ev, html) {
    const t = tipEl();
    t.innerHTML = html;
    t.classList.add('on');
    tip.move(ev);
  },
  move(ev) {
    const t = tipEl();
    const x = ev.clientX ?? 0, y = ev.clientY ?? 0;
    const w = t.offsetWidth, h = t.offsetHeight;
    let L = x + 14, T = y + 14;
    if (L + w > innerWidth - 8) L = x - w - 14;
    if (T + h > innerHeight - 8) T = y - h - 14;
    t.style.left = Math.max(8, L) + 'px';
    t.style.top = Math.max(8, T) + 'px';
  },
  hide() { tipEl().classList.remove('on'); },
};
export function eventTip(e) {
  const d = DOMAIN[e.domain];
  return `<div class="k"><i style="background:${recCol(e.year)}"></i>${esc(d ? d.short : e.domain)} &middot; ${esc(e.type)} &middot; ${esc(fmtDate(e))}${e.region && REGION[e.region] ? ` &middot; <i style="background:${regionColor(e.region)};border-radius:50%"></i>${esc(REGION[e.region].label)}` : ''}</div>
  <div class="h">${esc(e.title)}</div>${e.connects.length || (db.in.get(e.id) || []).length ? `<div class="m">${neighbors(e.id).length} connections</div>` : ''}`;
}

/* ---------- Arc helper ---------- */
export function arc(a, b, bend = 0.35) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const mx = (a[0] + b[0]) / 2 - dy * bend, my = (a[1] + b[1]) / 2 + dx * bend;
  return `M${a[0]},${a[1]}Q${mx},${my} ${b[0]},${b[1]}`;
}

/* ---------- Filters ---------- */
// the thread and type options count the whole record; they are filled again when the past wave lands
export function fillTypes() {
  const ts = $('#type-sel'); if (!ts) return;
  const cur = ts.value;
  const counts = new Map();
  const pool = db.events.filter((e) => e.kind !== 'overlay'); // overlays are never events in a count (data.js census)
  pool.forEach((e) => counts.set(e.type, (counts.get(e.type) || 0) + 1));
  const groups = [
    ['', 'All types'],
    ['invention,discovery,product,milestone', 'Making: inventions, products'],
    ['concept,person', 'Ideas and people'],
    ['market', 'Money and markets'],
    ['policy', 'Policy'],
    ['culture,moment', 'Culture and moments'],
    ['hope', 'Hopes'],
    ['fear', 'Fears'],
    ['failure,incident', 'Failures and incidents'],
  ];
  ts.innerHTML = groups.map(([v, l]) => {
    const n = v ? v.split(',').reduce((a, t) => a + (counts.get(t) || 0), 0) : census().events;
    return `<option value="${v}">${esc(l)} (${n.toLocaleString('en-US')})</option>`;
  }).join('') + '<optgroup label="Single type">' + TYPES.filter((t) => counts.get(t.id)).map((t) => `<option value="${t.id}">${t.label} (${counts.get(t.id).toLocaleString('en-US')})</option>`).join('') + '</optgroup>';
  ts.value = cur;
}
export function fillThreads() {
  const th = $('#thread-sel'); if (!th) return;
  const cur = th.value;
  th.innerHTML = '<option value="">All threads</option>' + db.tags.filter((t) => t.n >= 2).slice(0, 80).map((t) => `<option value="${esc(t.tag)}">${esc(prettyTag(t.tag))} (${t.n})</option>`).join('');
  th.value = cur;
}
export function initFilters() {
  const chips = $('#chips');
  chips.innerHTML = DOMAINS.map((d) => `<button class="chip" type="button" data-d="${d.id}" style="--c:${d.color}" aria-pressed="true" title="Only this domain: double click or Shift+Enter"><i></i>${esc(d.short)}</button>`).join('');
  let clickTimer = null;
  const edge = () => chips.classList.toggle('at-end', chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 2);
  chips.addEventListener('scroll', edge, { passive: true });
  window.addEventListener('resize', edge);
  requestAnimationFrame(edge);
  chips.addEventListener('wheel', (ev) => { if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX) && chips.scrollWidth > chips.clientWidth) { chips.scrollLeft += ev.deltaY; ev.preventDefault(); } }, { passive: false });
  chips.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const id = b.dataset.d;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      const s = new Set(state.domains);
      if (s.has(id)) { s.delete(id); if (!s.size) DOMAINS.forEach((d) => s.add(d.id)); }
      else s.add(id);
      set({ domains: s });
    }, 220);
  });
  chips.addEventListener('keydown', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b || ev.key !== 'Enter' || !ev.shiftKey) return;
    ev.preventDefault();
    const id = b.dataset.d;
    const only = state.domains.size === 1 && state.domains.has(id);
    set({ domains: only ? new Set(DOMAINS.map((d) => d.id)) : new Set([id]) });
  });
  chips.addEventListener('dblclick', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    clearTimeout(clickTimer);
    const id = b.dataset.d;
    const only = state.domains.size === 1 && state.domains.has(id);
    set({ domains: only ? new Set(DOMAINS.map((d) => d.id)) : new Set([id]) });
  });

  const ts = $('#type-sel');
  fillTypes();
  ts.addEventListener('change', () => set({ types: ts.value ? new Set(ts.value.split(',')) : null }));
  // the year window by keyboard: two year fields bound to the scrubber's window (a span of at least three years)
  const yf = $('#y-from'), yt = $('#y-to');
  const commitYears = () => {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    let a = parseInt(yf.value, 10), b = parseInt(yt.value, 10);
    if (!Number.isFinite(a)) a = state.y0; if (!Number.isFinite(b)) b = state.y1;
    a = clamp(a, YEAR_MIN, YEAR_MAX - 2); b = clamp(b, a + 2, YEAR_MAX);
    yf.value = a; yt.value = b;
    if (a !== state.y0 || b !== state.y1) set({ y0: a, y1: b });
  };
  for (const inp of [yf, yt]) if (inp) { inp.addEventListener('change', commitYears); inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commitYears(); } }); }

  const th = $('#thread-sel');
  fillThreads();
  th.addEventListener('change', () => set({ thread: th.value }));

  const resetAll = () => { draw.register = 'auto'; draw.overlays = false; set({ domains: new Set(DOMAINS.map((d) => d.id)), types: null, thread: '', q: '', y0: YEAR_MIN, y1: YEAR_MAX }); drawChanged(); };
  $('#reset').addEventListener('click', resetAll);
  // the register switch (Landmarks / All) and the period overlays toggle, Vision 4 S5 and S6; the views redraw on draw-change
  $('#reg-sw').addEventListener('click', (ev) => {
    const r = ev.target.closest('[data-reg]'), o = ev.target.closest('[data-ov]');
    if (r) draw.register = r.dataset.reg; else if (o) draw.overlays = !draw.overlays; else return;
    drawChanged();
  });
  $('#fpill').addEventListener('click', (ev) => { if (ev.target.closest('#fpill-reset')) resetAll(); });

  const fab = $('#fab'), fb = $('#filterbar');
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && fb.classList.contains('open') && !state.sel) { fb.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); fab.textContent = 'Filters'; fab.focus(); }
  });
  fab.addEventListener('click', () => {
    const open = !fb.classList.contains('open');
    fb.classList.toggle('open', open);
    fab.setAttribute('aria-expanded', String(open));
    fab.textContent = open ? 'Close filters' : 'Filters';
  });
}

const REGISTER_VIEWS = new Set(['stream', 'columns', 'wheel']);
const drawChanged = () => { syncFilters(); document.dispatchEvent(new CustomEvent('draw-change')); };
export function syncFilters() {
  document.querySelectorAll('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(state.domains.has(b.dataset.d))));
  const ts = $('#type-sel');
  const tv = state.types ? [...state.types].join(',') : '';
  if ([...ts.options].some((o) => o.value === tv)) ts.value = tv;
  const th = $('#thread-sel');
  if (state.thread && ![...th.options].some((o) => o.value === state.thread)) {
    th.insertAdjacentHTML('beforeend', `<option value="${esc(state.thread)}">${esc(prettyTag(state.thread))}</option>`);
  }
  th.value = state.thread;
  const yf = $('#y-from'), yt = $('#y-to');
  if (yf && document.activeElement !== yf) yf.value = state.y0;
  if (yt && document.activeElement !== yt) yt.value = state.y1;
  const q = $('#q');
  if (document.activeElement !== q) q.value = state.q;
  // the census rule: an overlay (the five European period entries) is never an event; counts run over the record without them
  const n = db.events.filter((e) => e.kind !== 'overlay' && passes(e) && e.year >= state.y0 && e.year <= state.y1).length;
  const active = (state.domains.size < DOMAINS.length) + !!state.types + !!state.thread + !!state.q;
  const total = census().events.toLocaleString('en-US');
  // the millennium views draw a register: the count names it (Landmarks: one entry per episode; All: the whole record)
  const sw = $('#reg-sw'), regView = REGISTER_VIEWS.has(state.view);
  if (regView && registerFor(state) === 'landmarks') {
    const k = db.events.filter((e) => drawn(e) && e.year >= state.y0 && e.year <= state.y1).length;
    $('#count').innerHTML = `<b>${k.toLocaleString('en-US')}</b> landmarks of ${n.toLocaleString('en-US')} events`;
  } else $('#count').innerHTML = `<b>${n.toLocaleString('en-US')}</b> of ${total} events`;
  if (sw) {
    sw.hidden = !regView;
    sw.querySelectorAll('[data-reg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reg === registerFor(state))));
    const ov = sw.querySelector('[data-ov]'); ov.hidden = state.view === 'wheel'; ov.setAttribute('aria-pressed', String(overlaysOn()));
  }
  // outside History the filter row is hidden; an active filter is still shown (and resettable) as a pill on the year strip
  const pill = $('#fpill');
  pill.hidden = !active; pill.classList.toggle('show', !!active);
  pill.innerHTML = active ? `${active} filter${active === 1 ? '' : 's'} on, <b>${n}</b> events <button type="button" id="fpill-reset">Reset</button>` : '';
  $('#fab').textContent = $('#filterbar').classList.contains('open') ? 'Close filters' : active ? `Filters (${active})` : 'Filters';
}

/* ---------- Search ---------- */
export function initSearch() {
  const q = $('#q'), box = $('#search-results');
  // the list lives on body: the record panel is a fixed layer (z 20) outside the rail's stacking context (.app z 1),
  // so a list kept inside the rail renders behind an open panel and its clicks land on the panel head
  document.body.appendChild(box);
  const placeBox = () => {
    if (window.innerWidth <= 760) { box.style.cssText = ''; return; }  // phones: the sheet's own fixed rule
    const r = q.getBoundingClientRect();
    box.style.position = 'fixed'; box.style.top = `${Math.round(r.bottom + 4)}px`; box.style.right = `${Math.round(window.innerWidth - r.right)}px`;
  };
  window.addEventListener('resize', () => { if (!box.hidden) placeBox(); });
  // the search covers every dataset, so the first keystroke pulls in the ones not loaded yet (the games left with the
  // Play page: a row for one led nowhere)
  q.addEventListener('focus', () => { ensureAll(); }, { once: true });
  // on the single-row rail the field is an icon until it is focused or holds a query
  const hasQ = () => q.closest('.search').classList.toggle('has-q', !!q.value.trim());
  q.addEventListener('input', hasQ); q.addEventListener('blur', hasQ); hasQ();
  let idx = -1, items = [];
  let t = null;
  // every match as a tick on the same thousand-year axis the year rail uses; the listed twelve are the strong ticks
  const tlx = (y) => 6 + 388 * slotF(clampY(y, YEAR_MIN, YEAR_MAX)) / SLOT_MAX; // the coil's own slot axis: a year a slot from 1000, a decade before, a millennium in deep time
  const miniTimeline = (all, top) => {
    const ext = all.reduce((r, e) => [Math.min(r[0], e.year), Math.max(r[1], e.year)], [Infinity, -Infinity]);  // no d3 here: the search works before it loads
    const ticks = all.map((e) => { const i = top.indexOf(e); return `<line class="tk${i >= 0 ? ' on' : ''}"${i >= 0 ? ` data-i="${i}"` : ''} x1="${tlx(e.year + 0.5).toFixed(1)}" x2="${tlx(e.year + 0.5).toFixed(1)}" y1="${i >= 0 ? 2 : 7}" y2="20" stroke="${recCol(e.year)}"><title>${fmtYear(e.year)} ${esc(e.title)}</title></line>`; }).join('');
    return `<div class="sr-tl"><div class="sr-n"><span><b>${all.length}</b> match${all.length === 1 ? '' : 'es'}</span><span>${ext[0] === ext[1] ? fmtYear(ext[0]) : `${fmtYear(ext[0])} to ${fmtYear(ext[1])}`}</span></div>
      <svg viewBox="0 0 400 32" aria-label="Matches by year, ${fmtYear(YEAR_MIN)} to ${YEAR_MAX}"><line class="ax" x1="6" x2="394" y1="20.5" y2="20.5"/>${ticks}<text class="yr" x="6" y="30">${fmtYear(YEAR_MIN)}</text><text class="yr" x="394" y="30" text-anchor="end">${YEAR_MAX}</text></svg></div>`;
  };
  // ENTITIES. People (e.people), organizations (e.orgs) and tags (e.tags) across the record, name to event ids, built
  // once the meta file is in (people and orgs come with it) and again when the record grows. A pick sets state.sel to
  // a list key the panel reads (openList): who:<name>, org:<name>, tag:<tag>, the name exactly as the record writes it;
  // the spiral's entity filter reads the same keys.
  let ENT = null, entN = 0;
  const entities = () => {
    if (ENT && entN === db.events.length) return ENT;
    const who = new Map(), org = new Map(), tag = new Map();
    const add = (m, k, id) => { if (!k) return; const a = m.get(k); if (a) a.push(id); else m.set(k, [id]); };
    for (const e of db.events) { if (e.kind === 'overlay') continue; for (const x of e.people || []) add(who, x, e.id); for (const x of e.orgs || []) add(org, x, e.id); for (const x of e.tags || []) add(tag, x, e.id); }
    ENT = [...[...who].map(([n, ids]) => ({ k: 'who', n, ids })), ...[...org].map(([n, ids]) => ({ k: 'org', n, ids })), ...[...tag].map(([n, ids]) => ({ k: 'tag', n, ids }))]
      .map((x) => ({ ...x, lc: x.n.toLowerCase() }));
    entN = db.events.length;
    return ENT;
  };
  const ENT_WORD = { who: 'Person', org: 'Organization', tag: 'Tag' };
  let ents = [];
  const render = () => {
    const v = q.value.trim().toLowerCase();
    if (!v) { box.hidden = true; return; }
    const terms = v.split(/\s+/);
    ensureTxt();  // the search text is built here on the first search, not in the boot
    // entities whose name holds every term, the most cited first, five at most (none before the meta file lands)
    // a term matches an entity at the start of one of its words (turing: Alan Turing, not manufacturing)
    ents = db.loaded.has('meta') ? entities().filter((x) => terms.every((t) => x.lc.startsWith(t) || x.lc.includes(' ' + t) || x.lc.includes('-' + t))).sort((a, b) => b.ids.length - a.ids.length || a.n.localeCompare(b.n)).slice(0, 5) : [];
    const all = db.events
      .map((e) => {
        if (!terms.every((x) => e._txt.includes(x))) return null;
        const tl = e.title.toLowerCase(), inTitle = terms.every((x) => tl.includes(x)), phrase = terms.length > 1 && (tl.includes(v) ? 6 : e._txt.includes(v) ? 3 : 0); // the words as typed, together, outrank the words apart
        return [e, (inTitle ? 10 : 0) + (phrase || 0) + e.significance];
      })
      .filter(Boolean).sort((a, b) => b[1] - a[1] || a[0].year - b[0].year).map((d) => d[0]); // ties in time order
    items = all.slice(0, 12);
    idx = -1;
    const entRows = ents.length ? `<div class="sr-h" aria-hidden="true"><span></span><span>Events</span><span>Person, organization or tag</span><span>Kind</span></div>` + ents.map((x, i) => `<button type="button" role="option" class="sr-ent" data-ent="${i}"><span class="n"></span><span class="y"></span><span class="t">${esc(x.n)}</span><span class="d">${ENT_WORD[x.k]}</span></button>`).join('') : '';
    box.innerHTML = items.length || ents.length
      ? entRows + (items.length ? miniTimeline(all, items) + `<div class="sr-h" aria-hidden="true"><span>No.</span><span>Date</span><span>Record</span><span>Domain</span></div>` : '') + items.map((e, i) => `<button type="button" role="option" data-i="${i}" style="--rec:${recCol(e.year)}"><span class="n"></span><span class="y">${e.year}</span><span class="t"><i style="background:${recCol(e.year)}"></i>${esc(e.title)}</span><span class="d">${esc(DOMAIN[e.domain]?.short || e.domain)}</span></button>`).join('') +
        (items.length ? `<button type="button" data-all="1" class="sr-all"><span class="n"></span><span class="y">all</span><span class="t">Mark every match for "${esc(q.value.trim())}" on the coil${all.length > items.length ? ` (${all.length} records)` : ''}</span><span class="d"></span></button>` : '')
      : `<div class="empty">Nothing matches "${esc(q.value)}". A name or a word like transistor finds records.</div>`;
    placeBox(); box.hidden = false;
  };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 90); if (!q.value) set({ q: '' }); });
  q.addEventListener('focus', () => q.value && render());
  q.addEventListener('keydown', (ev) => {
    const btns = [...box.querySelectorAll('button')];
    if (ev.key === 'ArrowDown') { idx = Math.min(btns.length - 1, idx + 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { idx = Math.max(-1, idx - 1); ev.preventDefault(); }
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (idx >= 0 && btns[idx]) btns[idx].click();
      else { set({ q: q.value.trim() }); box.hidden = true; }
      return;
    } else if (ev.key === 'Escape') { box.hidden = true; q.blur(); return; } else return;
    btns.forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    btns[idx]?.scrollIntoView({ block: 'nearest' });
  });
  box.addEventListener('mousedown', (ev) => ev.preventDefault());
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button, .tk.on');
    if (!b) return;
    if (b.dataset.all) set({ q: q.value.trim() });
    else if (b.dataset.ent) { const x = ents[+b.dataset.ent]; if (x) selectEntity(x.k, x.n, x.ids); }
    else select(items[+b.dataset.i].id);
    box.hidden = true;
  });
  // a hovered row lights its tick on the strip, and a hovered tick lights its row
  box.addEventListener('mouseover', (ev) => {
    const b = ev.target.closest('[data-i]');
    box.querySelectorAll('.tk.hot').forEach((x) => x.classList.remove('hot'));
    box.querySelectorAll("button[aria-selected='true']").forEach((x) => x.setAttribute('aria-selected', 'false'));
    if (!b) return;
    const tk = box.querySelector(`.tk[data-i="${b.dataset.i}"]`); if (tk && tk !== b) tk.classList.add('hot');
    const row = box.querySelector(`button[data-i="${b.dataset.i}"]`); if (row && row !== b) row.setAttribute('aria-selected', 'true');
  });
  q.addEventListener('blur', () => setTimeout(() => (box.hidden = true), 120));
  // the mobile Filters pill steps aside while the results sheet is open
  new MutationObserver(() => document.body.classList.toggle('search-open', !box.hidden)).observe(box, { attributes: true, attributeFilter: ['hidden'] });
}

/* ---------- Selection / drawer ---------- */
export function select(id) { set({ sel: id || '' }); }
// an entity selection (who:<name>, org:<name>, tag:<tag>): the panel lists its events, oldest first; state.sel carries
// the key, so the drawing on stage can light that entity's cells. ids may be omitted: they are found in the record.
const ENT_KIND = { who: ['Person', 'people'], org: ['Organization', 'orgs'], tag: ['Tag', 'tags'] };
export function selectEntity(kind, name, ids) {
  const [word, field] = ENT_KIND[kind] || ENT_KIND.tag;
  const list = (ids || db.events.filter((e) => (e[field] || []).includes(name)).map((e) => e.id)).map((id) => db.byId.get(id)).filter(Boolean).sort((a, b) => a.year - b.year).map((e) => e.id);
  const ys = list.map((id) => db.byId.get(id).year);
  openList(`${kind}:${name}`, { title: name, kicker: `<span class="ki">${word}</span>`, ids: list, sub: ys.length ? `${Math.min(...ys)} to ${Math.max(...ys)}` : '', words: kind === 'who' ? wordsOf(name) : null });
}
// a person's words and their standing: dated and undated claims from the record, and the forecasts the helix has loaded
export function wordsOf(name) {
  const n = name.toLowerCase(), out = [];
  for (const c of db.predictions || []) if ((c.who || '').toLowerCase().includes(n)) out.push({ id: c.id, y: c.year_made, t: c.claim, v: c.outcome, when: c.predicted_for ? `by ${c.predicted_for}` : 'no deadline' });
  for (const f of db.forecasts || []) if ((f.who || '').toLowerCase().includes(n)) out.push({ id: f.id, y: f.y0, t: f.text, v: f.v, when: f.t ? `by ${f.t}` : 'no deadline' });
  return out.sort((a, b) => a.y - b.y);
}
export const entityOf = (sel) => { const m = /^(who|org|tag):(.+)$/.exec(sel || ''); return m ? { kind: m[1], name: m[2] } : null; };

// List mode: the drawer shows the exact records behind a number (a bar, a dot, a headline figure) as a dated list,
// each row opening its record. Views register the list under a key and select it like any record.
// spec: { kicker, title, sub, ids?: event ids, rows?: [{ y, t, sub }] plain rows, source?: url, note?: text }
// a record opened from a list keeps a way back to it
let listReturn = null;
// THE EVIDENCE PANEL (Vision 4 Addendum). One element, #drawer, carries every record, figure and list; the views open it
// two ways: select(id) for a record the data holds (event, model, deal, prediction, benchmark, person, policy instrument),
// or openEvidence(key, { kicker, title, html, onMount }) for the view's own content. The key lands in the hash as e=<key>
// (prefix it: 'limits:campus-gw'), so the panel reopens on a shared link while the view that registered it is mounted.
// onMount(bodyEl) runs once the html is in the panel, for anything interactive. The lists (openList) ride the same panel.
const evidenceMount = new Map();
export function openEvidence(key, spec) {
  if (!key || !spec) return;
  if (!db.pointById) db.pointById = new Map();
  const html = `${spec.title ? `<h3>${esc(spec.title)}</h3>` : ''}${spec.sub ? `<div class="date"><span>${esc(spec.sub)}</span></div>` : ''}${spec.html || ''}`;
  db.pointById.set(key, { kicker: spec.kicker || '<span class="ki">Evidence</span>', html });
  if (spec.onMount) evidenceMount.set(key, spec.onMount); else evidenceMount.delete(key);
  if (state.sel === key) renderDrawer(); else select(key);
}
export const closeEvidence = () => { if (state.sel) select(''); };
export function openList(key, spec) {
  if (!spec) return;
  listReturn = { key, title: spec.title };
  if (!db.pointById) db.pointById = new Map();
  if (spec.ids || spec.pairs) ensure('links');  // the header's Draw the links reads the focused row's links
  const evs = (spec.ids || []).map((id) => db.byId.get(id)).filter(Boolean);
  const evRow = (e, cls = '') => `<button type="button" class="${cls}" data-id="${esc(e.id)}"><i style="background:${recCol(e.year)}"></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button>`;
  // a figure counted in pairs lists pairs: the later event with the earlier one under it, both opening their record
  const pairs = (spec.pairs || []).map((d) => ({ d, a: db.byId.get(d.from), b: db.byId.get(d.to) })).filter((x) => x.a && x.b).sort((u, v) => u.b.year - v.b.year || u.a.year - v.a.year);
  const n = spec.rows ? spec.rows.length : pairs.length || evs.length;
  const unit = spec.rows ? 'row' : spec.pairs ? 'pair' : 'event';
  const count = spec.pairs ? `${n} pair${n === 1 ? '' : 's'} · ${new Set(pairs.flatMap((x) => [x.a.id, x.b.id])).size} events` : `${n} ${unit}${n === 1 ? '' : 's'}`;
  const rows = spec.rows
    ? spec.rows.map((r) => `<li><div class="ls-row"><span class="y">${esc(r.y)}</span><span><b>${esc(r.t)}</b>${r.sub ? `<span class="ls-sub">${esc(r.sub)}</span>` : ''}</span></div></li>`).join('')
    : spec.pairs
      ? pairs.map((x) => `<li class="ls-pair">${evRow(x.b)}${evRow(x.a, 'ls-from')}<span class="ls-lag">${x.d.lag === 0 ? 'the same year' : `${x.d.lag} year${x.d.lag === 1 ? '' : 's'} earlier`}</span></li>`).join('')
      : evs.map((e) => `<li>${evRow(e)}</li>`).join('');
  const html = `<h3>${esc(spec.title)}</h3>
    <div class="date"><span>${count}</span>${spec.sub ? `<span>${esc(spec.sub)}</span>` : ''}</div>
    ${spec.note ? `<p class="summary">${esc(spec.note)}</p>` : ''}
    ${spec.words && spec.words.length ? `<div class="sect-h"><span>Claims</span><span>${spec.words.length}</span></div><ul class="links ls-list ls-words">${spec.words.map((w) => `<li>${w.id ? `<button type="button" class="ls-word" data-id="${esc(w.id)}">` : '<div class="ls-row ls-word">'}<i style="background:${VERDICT_NIGHT[w.v] || VERDICT_NIGHT.unresolvable}"></i><span class="y">${esc(String(w.y))}</span><span>${esc(w.t)}<span class="ls-sub">${cap(VERDICT_WORD[w.v] || VERDICT_WORD.unresolvable)}, ${esc(w.when)}</span></span>${w.id ? '</button>' : '</div>'}</li>`).join('')}</ul>` : ''}
    <div class="sect-h where-h"><span>${spec.rows ? 'Rows' : spec.pairs ? 'Pairs' : 'Events'}</span><span>${n}</span></div>
    <ul class="links ls-list">${rows || '<li class="ls-empty">No record meets these settings.</li>'}</ul>
    ${spec.source ? `<div class="sect-h"><span>Source</span><span>1</span></div><ol class="sources"><li><a href="${esc(spec.source)}" target="_blank" rel="noopener">${esc(host(spec.source))}</a></li></ol>` : ''}`;
  db.pointById.set(key, { kicker: spec.kicker || '<span class="ki">List</span>', html });
  if (state.sel === key) renderDrawer(); else select(key);
}

let drawerReturn = null, drawerBooted = false;
let lastSel = null, cameFrom = null;  // the record read before this one: its connection row carries the one red mark
let trail = [];  // the records read in this sitting, oldest first, five at most: the breadcrumb under the folio
let holdTrail = false;  // Draw the links closes the drawer on desktop but the trail is kept for when the record comes back
let recNo = null;  // event id -> position in the record (by time)
function recordNo(id) { if (!recNo) { recNo = new Map(); [...db.events].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)).forEach((e, i) => recNo.set(e.id, i + 1)); } return recNo.get(id) || 0; }
function folio(e) { const w = db.events.filter((x) => x.year >= state.y0 && x.year <= state.y1); if (!w.length || e.year < state.y0 || e.year > state.y1) return ''; const n = w.filter((x) => x.t < e.t || (x.t === e.t && x.id <= e.id)).length; return `${fmtN(n)} of ${fmtN(w.length)} in ${state.y0} to ${state.y1}`; }
const fmtN = (n) => n.toLocaleString('en-US');
// The drawer body scrolls; the title, date and domain chip hold still above it and the sources hold still below it.
// Every drawer kind renders into #db, so the fixed parts are lifted out after each render.
// the phone's sheet header: a word that ends a wrapped row drops its dot, so no row ends on a separator (the dot keeps its
// width, so the wrap holds); measured after each sheet fills, on resize and once the type is in
function kickerEnds() {
  const ks = [...document.querySelectorAll('#dk .ki')]; if (!ks.length) return;
  const tops = PHONE() ? ks.map((k) => k.getBoundingClientRect().top) : null;
  ks.forEach((k, i) => k.classList.toggle('eol', !!tops && i < ks.length - 1 && tops[i + 1] > tops[i] + 4));
}
if (typeof window !== 'undefined') { window.addEventListener('resize', kickerEnds); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kickerEnds); }
function hoistDrawer() {
  const body = $('#db'), dt = $('#dt'), df = $('#df');
  if (!dt || !df) return;
  dt.innerHTML = ''; df.innerHTML = '';
  if (listReturn && state.sel !== listReturn.key && !String(state.sel).startsWith('list:')) {
    const bk = document.createElement('button'); bk.type = 'button'; bk.className = 'ls-back'; bk.dataset.list = listReturn.key; bk.innerHTML = `<span aria-hidden="true">&larr;</span> Back to the list: ${esc(listReturn.title)}`; dt.appendChild(bk);
  }
  const pic = body.querySelector(':scope > .mo-pic'); if (pic) dt.appendChild(pic); // a moment's picture sits above its headline (stage 5)
  const h = body.querySelector(':scope > h3'); if (h) dt.appendChild(h);
  const d = body.querySelector(':scope > .date'); if (d) dt.appendChild(d);
  const sn = body.querySelector(':scope > .scales'); if (sn) dt.appendChild(sn);
  const tr = body.querySelector(':scope > .trail'); if (tr) dt.appendChild(tr);
  // the foot is one row of controls: Draw the links (moved out of the Where header) and a jump to Where this appears
  const wh = body.querySelector(':scope > .where-h');
  df.hidden = !df.children.length;
  body.scrollTop = 0;
  fadeBody();
}
// a body that still scrolls fades out over its last 24px, so a cut line reads as more below rather than an end
function fadeBody() {
  const body = $('#db'); if (!body) return;
  body.classList.toggle('more', body.scrollTop + body.clientHeight < body.scrollHeight - 2);
}
function drawerOpened(dr, wasOpen) {
  if (wasOpen) return;
  if (!drawerBooted) return; // a record opened from a shared link does not take focus on load
  const a = document.activeElement;
  drawerReturn = a && a !== document.body && !dr.contains(a) ? a : null;
  const h = $('#drawer h3');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
// "Where this appears": the record's cross-links (links.json), one ruled row per place, each a jump into that view
// with the window and the selection set. The file is lazy: the first open asks for it and the drawer redraws on arrival.
const WHERE_KINDS = [['pt', 'pattern', 'patterns'], ['th', 'thread', 'threads'], ['po', 'rule', 'rules'], ['bm', 'benchmark', 'benchmarks'], ['dl', 'deal', 'deals'], ['im', 'measure', 'measures']];
// each kind's association, as build_data.py states it in links.json (basis): a pattern counts the record (pattern pair,
// event behind the pattern); a thread has it as a step; a rule names it; a benchmark names it, or a model named in the
// record scored on it; a deal dated within two years has an organization the record names as a party; a measure has it
// as a milestone. The count line and the group heads say that association and nothing more.
const WHERE_REL = { pt: 'counted in', th: 'a step in', po: 'named by', bm: 'named by', dl: 'names a party to', im: 'a milestone on' };
const WHERE_ONE = { pt: 'Pattern', th: 'Thread', po: 'Rule', bm: 'Benchmark', dl: 'Deal', im: 'Measure' };
const WHERE_GROUP = { pt: 'Counted in patterns', th: 'Steps of the same thread', po: 'Named by rules', bm: 'Named by benchmarks', dl: 'Deals of a named organization, within two years', im: 'Milestone on measures' };
const bmHead = (L, ids) => (ids.every((id) => /^model named/.test((L.basis || {})[`bm:${id}`] || '')) ? 'Model named here, scored on benchmarks' : WHERE_GROUP.bm);
const SIG_WORD = { 1: 'minor', 2: 'modest', 3: 'notable', 4: 'major', 5: 'landmark' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const moodWord = (v) => `${Math.abs(v) >= 2 ? 'strong ' : ''}${v > 0 ? 'hope' : 'fear'}`;
// The pattern clause names the same figure and denominator as the list behind that figure: for a pair pattern, the period
// the pair falls in with that period's pair count and median, then the count over all periods. Computed here from
// patterns.json (default settings) so the two never drift apart.
function patternClause(ptId, e, fallback) {
  const pt = (db.patterns || []).find((x) => x.id === ptId);
  if (!pt) { if (!db.loaded.has('patterns')) ensure('patterns'); return fallback; }
  const pr = (pt.pairs || []).find((d) => d.from === e.id || d.to === e.id);
  if (!pr || pr.lag == null || !(pt.periods || []).length) return fallback;
  const other = db.byId.get(pr.from === e.id ? pr.to : pr.from);
  // pairing language, as build_data.py writes it: the pair and the gap, later or earlier, no answer or cause
  const when = pr.lag === 0 ? 'the same year' : `${pr.lag} year${pr.lag === 1 ? '' : 's'} ${pr.from === e.id ? 'later' : 'earlier'}`;
  // disaster periods are closed bins (from..to); invention-to-rule periods run from..to exclusive
  const per = pt.periods.find((x) => (pt.kind === 'pairs' ? pr.year >= x.from && pr.year <= x.to : pr.year >= x.from && pr.year < x.to));
  const label = per ? (per.label || `${per.from} to ${per.to}`) : null;
  const m = (v) => (v == null ? '' : `${Number.isInteger(v) ? v : Math.round(v * 10) / 10}-year`);
  const all = (pt.pairs || []).length;
  const tail = per ? `one of ${per.n} pairs counted for the ${label} ${m(per.median_lag)} median lag; ${all} pairs over all periods` : `one of ${all} pairs counted for the ${m(pt.stats && pt.stats.median_lag)} median lag over all periods`;
  return `paired with ${other ? esc(other.title_short || other.title) : 'its pair'}, ${when}; ${tail}`;
}
// Stream's Connections on one record: the window brushed to the span of the record and everything linked to it.
// On phones the drawer folds to a 96px bar, the Stream scrolls to the record's mark and the index opens as a bottom sheet.
export const PHONE = () => matchMedia('(max-width: 760px)').matches;
// a record carries one name on a surface: the phone's plate, labels and lists read the short name, so its sheet and the sheet's connections do too
const nameOf = (e) => (PHONE() && e.title_short ? e.title_short : e.title);
export function drawLinks(id) {
  const e = db.byId.get(id); if (!e) return;
  import('./connect.js').then((cx) => {
    const linked = cx.cxLinked(e, db.events.filter((o) => passes(o)), Infinity);
    const [y0, y1] = linked.length ? cx.cxSpan(e, linked) : [state.y0, state.y1];
    // two steps: the Stream takes the open record as its pick when the mode turns on, and only then; landing with the
    // mode already on would keep an older pick, so the mode goes off with the move and on once the view has drawn
    set({ view: 'stream', mode: '', sel: id, y0, y1 });
    const armed = { done: false };
    const arm = (n) => { const v = document.querySelector('.view.on[data-view="stream"]'); if ((!v || !v.clientHeight) && n > 0) { setTimeout(() => arm(n - 1), 120); return; } if (state.sel === id && state.view === 'stream') set({ mode: 'cx' }); armed.done = true; if (PHONE()) setTimeout(() => scrollStreamTo(id), 350); };  // the mode's relayout resets the column's scroll
    setTimeout(() => arm(25), 60);
    if (PHONE()) phoneSheet(id, cx, armed);
    else desktopHandOff(id);
  }).catch(() => set({ view: 'stream', mode: 'cx', sel: id }));
}
// desktop: the drawer and the Connections side index share the right column, so once the Stream has taken the record as
// its pick the drawer closes (trail kept) and the index has the column; its "Open the record" brings the drawer back
// Views with a side index of their own, and where the index names the record it holds; under 1366 the drawer would
// cover that index, so an arrival by hash with a record hands the column to the index the same way (see main.js)
export const INDEXED = { stream: '.cx-ix .cx-sel', columns: '.cx-ix .cx-sel', arcs: '.arc-ix .arc-sel' };
export const NARROW = () => matchMedia('(max-width: 1365px)').matches && !PHONE();
export function desktopHandOff(id, tries = 24) {
  const view = document.querySelector('.view.on');
  const which = view && INDEXED[view.dataset.view];
  const ix = which && view.querySelector(which);
  const e = db.byId.get(id);
  // the index must name this record before the drawer lets go (the Stream keeps an older pick until it redraws)
  const named = ix && e && [e.title, e.title_short].filter(Boolean).some((t) => ix.textContent.includes(t.slice(0, 24)));
  if (!view || !named) { if (tries > 0) setTimeout(() => desktopHandOff(id, tries - 1), 250); return; }
  if (state.sel !== id || !INDEXED[state.view]) return;  // the reader moved on meanwhile
  holdTrail = true;
  set({ sel: '' });
}
// an index's own "Open the record" (data-reopen=id) brings the drawer back
document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-reopen]'); if (b && b.dataset.reopen) select(b.dataset.reopen); });
let sheetOff = null;  // the subscription that keeps the sheet with the state while it is open
function phoneSheet(id, cx, armed = { done: true }) {
  const dr = $('#drawer');
  let sheet = $('#cx-sheet');
  if (!sheet) {
    sheet = document.createElement('section'); sheet.id = 'cx-sheet'; sheet.className = 'cx-sheet cx-ix'; sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', 'Connections');
    document.body.appendChild(sheet);
  }
  let reopen = dr.querySelector('.drawer-unfold');
  if (!reopen) {
    reopen = document.createElement('button'); reopen.type = 'button'; reopen.className = 'drawer-unfold'; reopen.textContent = 'Open the record';
    reopen.addEventListener('click', () => closeSheet({ keep: true }));
    dr.querySelector('.drawer-top').appendChild(reopen);
  }
  const fill = (eid) => {
    const e = db.byId.get(eid); if (!e) return;
    const linked = cx.cxLinked(e, db.events.filter((o) => passes(o)), 12);
    cx.cxIndex(sheet, { e, linked, onPick: (pid) => select(pid), onOpen: () => closeSheet({ keep: true }), onExit: () => { closeSheet(); set({ mode: '' }); } });
    if (!cx.cxLinks(eid, () => fill(eid))) return;  // repeats once links.json lands
  };
  dr.classList.add('folded'); sheet.hidden = false; document.body.classList.add('sheet-open');
  fill(id);
  scrollStreamTo(id);
  if (sheetOff) sheetOff();
  sheetOff = subscribe((st, ch) => {
    const cxOff = ch.has('mode') && !(st.mode || '').split('.').includes('cx') && armed.done;  // the mode is off by design until the view has drawn
    if (!st.sel || st.view !== 'stream' || cxOff) { closeSheet(); return; }
    if (ch.has('sel') && db.byId.has(st.sel)) { fill(st.sel); scrollStreamTo(st.sel); }
  });
}
export function closeSheet({ keep = false } = {}) {
  const dr = $('#drawer'), sheet = $('#cx-sheet');
  dr.classList.remove('folded'); document.body.classList.remove('sheet-open');
  if (sheet) sheet.hidden = true;
  if (sheetOff) { sheetOff(); sheetOff = null; }
  if (keep) { const h = dr.querySelector('.drawer-title h3'); if (h) h.focus?.(); }
}
// the Stream on phones is a tall scrolling column: bring the picked record's mark a third of the way down the screen
function scrollStreamTo(id, tries = 16) {
  const view = document.querySelector('.view.on[data-view="stream"]');
  if (!view || !view.clientHeight) { if (tries > 0) setTimeout(() => scrollStreamTo(id, tries - 1), 250); return; }  // the view mounts after the hash lands
  const e = db.byId.get(id);
  const svg = [...view.querySelectorAll('svg')].find((x) => x.getBoundingClientRect().height > 600);
  if (!e || !svg) { if (tries > 0) setTimeout(() => scrollStreamTo(id, tries - 1), 250); return; }
  // the scroller is whichever box holds the tall column: the plot box on phones since the Stream's flex layout, else the view
  let box = svg.parentElement, scroller = view;
  while (box && box !== view.parentElement) { if (/auto|scroll/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight + 10) { scroller = box; break; } box = box.parentElement; }
  const sr = scroller.getBoundingClientRect();
  const mark = view.querySelector('.cx-selmark');
  let top = null;
  if (mark) top = mark.getBoundingClientRect().top - sr.top + scroller.scrollTop;
  else {
    // the column draws no graph: the year axis gives the place, read off the ticks either side of the record's year
    const ticks = [...svg.querySelectorAll('text')].map((t) => [+t.textContent.trim(), t.getBoundingClientRect().top]).filter(([y]) => y >= 1000 && y <= 2100).sort((a, b) => a[0] - b[0]);
    if (ticks.length > 1) {
      let lo = ticks[0], hi = ticks[ticks.length - 1];
      for (const t of ticks) { if (t[0] <= e.year) lo = t; if (t[0] >= e.year) { hi = t; break; } }
      const y = hi[0] === lo[0] ? lo[1] : lo[1] + ((e.year - lo[0]) / (hi[0] - lo[0])) * (hi[1] - lo[1]);
      top = y - sr.top + scroller.scrollTop;
    }
  }
  if (top == null) { if (tries > 0) setTimeout(() => scrollStreamTo(id, tries - 1), 250); return; }
  // the sheet covers the lower part of the column: the year goes to the middle of the strip left showing
  const sheet = $('#cx-sheet'); const strip = sheet && !sheet.hidden ? Math.max(80, sheet.getBoundingClientRect().top - sr.top) : sr.height;
  scroller.scrollTo({ top: Math.max(0, top - strip * 0.5), behavior: 'auto' });
}
function whereBlock(e) {
  if (!db.links) { if (!db.loaded.has('links')) ensure('links'); return ''; }
  const L = db.links.events[e.id] || {};
  const why = L.why || {};
  const rows = [], counts = [];
  const orgs = (e.orgs || []).map((o) => o.toLowerCase());
  const yearsApart = (a, b) => { const d = b - a; return d === 0 ? 'the same year' : d > 0 ? `${d} year${d === 1 ? '' : 's'} later` : `${-d} year${d === -1 ? '' : 's'} earlier`; };
  for (const [k, one, many] of WHERE_KINDS) {
    const ids = L[k] || [];
    const total = k === 'dl' && L.dln ? L.dln : ids.length;
    if (total) counts.push(`${k === 'bm' && ids.length && bmHead(L, ids) !== WHERE_GROUP.bm ? 'a model named here scored on' : WHERE_REL[k]} ${total} ${total === 1 ? one : many}${k === 'dl' ? ' within two years' : ''}`);
    if (!ids.length) continue;
    const head = k === 'bm' ? bmHead(L, ids) : WHERE_GROUP[k];
    const group = esc(head);
    ids.forEach((id, i) => {
      const name = (db.links.names[k] || {})[id] || id;
      const yr = (db.links.years[k] || {})[id];
      let reason = why[`${k}:${id}`] || '';
      if (k === 'pt' && /pairs (behind|counted for)/.test(reason)) reason = patternClause(id, e, reason);
      if (k === 'dl' && !reason) {
        const shared = name.split(/ to |, /).map((x) => x.trim()).find((x) => orgs.includes(x.toLowerCase()));
        reason = `${shared ? shared + ' deal' : 'deal of the same org'}${yr ? ', ' + yearsApart(e.year, yr) : ''}`;
      }
      rows.push(`<li><span class="k">${i === 0 ? esc(WHERE_ONE[k]) : ''}</span><span class="tt">${esc(name)}</span>${yr ? `<span class="y">${yr}</span>` : ''}</li>`);  // plain rows: these records live in retired views, so nothing here is a control
    });
  }
  // the count line names each kind this record appears in, as a relation; kinds with nothing are left out
  // "Draw the links" sits on the block's rule and opens Stream's Connections on this record, the window brushed to its
  // span; absent when nothing is linked. It carries the cx-brush class so connect.js's phone fallback sees it and stands down.
  if (!rows.length) return '';
  return `<div class="sect-h where-h"><span>Where this appears</span><span>${rows.length}</span></div><ul class="where ix">${rows.join('')}</ul>`;
}
const WHERE_VIEW = { pt: 'Patterns', th: 'Threads', po: 'Policy', bm: 'Benchmarks', dl: 'Capital', im: 'Impact' };
// the jump: each kind lands in its view with the record selected (or the card scrolled to), the window widened to
// hold both years when it does not already
export function goWhere(key, e) {
  const [k, id] = [key.slice(0, 2), key.slice(3)];
  const yr = (db.links && db.links.years[k] || {})[id];
  const patch = { sel: '', at: '' };
  if (k === 'pt') { patch.view = 'patterns'; patch.at = 'p-' + id; }
  else if (k === 'im') { patch.view = 'impact'; patch.at = 'm-' + id; }
  else if (k === 'th') { patch.view = 'threads'; patch.mode = 'story-' + id; }
  else if (k === 'po') { patch.view = 'policy'; patch.sel = 'policy:' + id; }
  else if (k === 'bm') { patch.view = 'benchmarks'; patch.sel = id; }
  else if (k === 'dl') { patch.view = 'capital'; patch.sel = 'deal:' + id; }
  else return;
  if (yr && e) {
    const lo = Math.min(e.year, yr) - 2, hi = Math.max(e.year, yr) + 2;
    if (lo < state.y0 || hi > state.y1) { patch.y0 = Math.max(YEAR_MIN, Math.min(state.y0, lo)); patch.y1 = Math.min(YEAR_MAX, Math.max(state.y1, hi)); }
  }
  set(patch);
}

// the scale note opens from the word "editorial" beside the two readouts; nothing pinned, nothing stored
const SCALE_NOTE = 'Significance 1 to 5 and mood are editorial classifications of each record\u2019s reach and reception, not measurements of public opinion.';
export function renderDrawer() {
  const dr = $('#drawer');
  queueMicrotask(() => (drawerBooted = true));
  // a selection from a dataset that has not loaded yet (deep link): fetch it, then come back
  const need = needsFor(state.sel);
  if (need && !db.loaded.has(need)) { ensureNow(need).then(() => renderDrawer()); return; }
  // an event from the past wave on a deep link: the record must be complete before the drawer can find it
  if (state.sel && !db.byId.has(state.sel) && !need && !db.loaded.has('past') && !(db.pointById && db.pointById.has(state.sel))) { ensureNow('past').then(() => renderDrawer()); return; }
  // an event drawer wants the people, organizations, summary and sources, which come after first paint
  if (state.sel && db.byId.has(state.sel) && !(db.loaded.has('meta') && db.loaded.has('text'))) ensureNow('meta', 'text');
  const wasOpen = dr.classList.contains('on');
  const after = () => { hoistDrawer(); kickerEnds(); const h = $('#drawer h3'); if (h) h.setAttribute('tabindex', '-1'); drawerOpened(dr, wasOpen); };
  // a view's own records (series points registered as { kicker, html } under db.pointById) render as given
  // an entity key (who:, org:, tag:) arriving by link or from a view: its list is built here (the meta file first)
  const ent = entityOf(state.sel);
  if (ent && !(db.pointById && db.pointById.has(state.sel))) {
    if (!db.loaded.has('meta')) { ensureNow('meta').then(() => renderDrawer()); return; }
    if (!db.loaded.has('past')) { ensureNow('past').then(() => renderDrawer()); return; }
    selectEntity(ent.kind, ent.name); return;
  }
  const pt = state.sel && db.pointById && db.pointById.get(state.sel);
  if (pt) { tint(null); dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); $('#dk').innerHTML = pt.kicker; $('#db').innerHTML = pt.html; $('#db').scrollTop = 0; after(); const om = evidenceMount.get(state.sel); if (om) om($('#db')); return; }
  const mdl = state.sel && db.modelById && db.modelById.get(state.sel);
  const deal = state.sel && db.dealById && db.dealById.get(state.sel);
  const pred = state.sel && db.predById && db.predById.get(state.sel);
  const fc = state.sel && db.forecastById && db.forecastById.get(state.sel);
  const bench = state.sel && db.benchById && db.benchById.get(state.sel);
  const person = state.sel && db.personById && db.personById.get(state.sel);
  const pol = state.sel && db.policyById && db.policyById.get(state.sel);
  const openDr = () => { dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); };
  if (bench) { openDr(); benchDrawer(bench, state.sel, $); $('#db').scrollTop = 0; after(); return; }
  if (person) { openDr(); personDrawer(person, $); $('#db').scrollTop = 0; after(); return; }
  if (pol) { openDr(); policyDrawer(pol, $); $('#db').scrollTop = 0; after(); return; }
  if (pred) { dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); predDrawer(pred); after(); return; }
  if (state.sel === 'fc:all' && db.forecasts) { openDr(); forecastsDrawer(); after(); return; }
  if (fc) { openDr(); forecastDrawer(fc); after(); return; }
  if (deal) { dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); dealDrawer(deal); after(); return; }
  if (mdl) { dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); modelDrawer(mdl); after(); return; }
  const e = state.sel && db.byId.get(state.sel);
  // Impact under 1366: the drawer opens as a bottom sheet so the head and the reading columns stay in view
  const asSheet = state.view === 'impact' && NARROW();
  dr.classList.toggle('sheet', asSheet); document.body.classList.toggle('drawer-sheet', asSheet && !!state.sel);
  if (!e) {
    listReturn = null;
    if (!state.sel && !holdTrail) trail = [];
    const had = dr.contains(document.activeElement);
    dr.classList.remove('on');
    dr.setAttribute('aria-hidden', 'true');
    dr.inert = true;
    if (wasOpen && (had || document.activeElement === document.body)) {
      if (drawerReturn && drawerReturn.isConnected && !drawerReturn.closest('[inert]')) drawerReturn.focus({ preventScroll: true });
      else document.getElementById('stage').focus({ preventScroll: true });
    }
    drawerReturn = null;
    return;
  }
  dr.inert = false;
  dr.classList.add('on');
  dr.setAttribute('aria-hidden', 'false');
  const d = DOMAIN[e.domain];
  const era = e.ai_era && AI_ERA[e.ai_era];
  if (lastSel !== e.id) { cameFrom = lastSel; lastSel = e.id; }
  holdTrail = false;
  // the trail: a crumb clicked again cuts the trail back to it, so a walk can be retraced
  const ti = trail.indexOf(e.id);
  if (ti >= 0) trail = trail.slice(0, ti + 1); else { trail.push(e.id); if (trail.length > 5) trail = trail.slice(-5); }
  const crumbs = trail.map((id) => db.byId.get(id)).filter(Boolean);
  const trailHtml = crumbs.length > 1 ? `<nav class="trail" aria-label="Records read, oldest first"><ol>${crumbs.map((x, i) => `<li><button type="button" data-id="${esc(x.id)}"${x.id === e.id ? ' aria-current="true"' : ''} title="${esc(x.title)}"><span class="y">${x.year}</span> ${esc(x.title_short || x.title)}</button>${i < crumbs.length - 1 ? '<span class="sep" aria-hidden="true">&rarr;</span>' : ''}</li>`).join('')}</ol></nav>` : '';
  if (e.type === 'moment') { momentDrawer(e, trailHtml); after(); fitMoment(); return; } // stage 5: a moment is a card, not a record page
  const fo = folio(e);
  tint(recCol(e.year));
  $('#dk').innerHTML = `<span class="rhd"><span class="no">No. ${fmtN(recordNo(e.id))}</span><i style="background:${recCol(e.year)}"></i><span class="ki">${esc(d ? d.label : e.domain)}</span><span class="ki">${esc(TYPE[e.type]?.label || e.type)}</span>${era ? `<span class="ki">${esc(era.label)}</span>` : ''}</span>`;
  const out = e.connects.map((id) => db.byId.get(id)).filter(Boolean);
  const inc = (db.in.get(e.id) || []).map((id) => db.byId.get(id)).filter(Boolean);
  const linkRow = (x) => `<li${x.id === cameFrom ? ' class="mark"' : ''}><button type="button" data-id="${esc(x.id)}"${x.id === cameFrom ? ' title="Record you came from"' : ''}><span class="y">${x.year}</span><span class="tt"><i style="background:${recCol(x.year)}"></i>${esc(nameOf(x))}</span></button></li>`;
  // connects is an untyped list of record ids; both directions list under one label, no direction or cause added
  const byYear = (a, b) => a.t - b.t;
  const linkList = (label, rows, graph) => `<div class="sect-h"><span>${label}</span><span>${rows.length}</span></div>${graph ? '<svg class="minigraph" id="mg" role="img" aria-label="Graph of connected records"></svg>' : ''}<ul class="links ix">${rows.sort(byYear).map(linkRow).join('')}</ul>`;
  const people = (e.people || []).map(esc).join(', ');
  const orgs = (e.orgs || []).map(esc).join(', ');
  const tags = (e.tags || []).map((t) => `<button class="tagbtn" type="button" data-tag="${esc(t)}" title="Thread, across every view"><span style="color:${threadColor(t)}">&#9632;</span> ${esc(prettyTag(t))}</button>`).join('');
  $('#db').innerHTML = `
    <h3>${esc(nameOf(e))}</h3>
    <div class="date"><span>${esc(fmtDate(e))}</span><span>${cap(SIG_WORD[e.significance] || '')}</span><button type="button" class="scale-k" aria-expanded="false" aria-controls="scale-note">editorial</button>${fo ? `<span class="folio" title="Position in the years shown">${fo}</span>` : ''}</div>
    <p class="scales" id="scale-note" hidden>${SCALE_NOTE}</p>
    ${trailHtml}
    ${picFigure(e)}
    <p class="summary">${esc(e.summary)}</p>
    ${detailBlock(e)}
    <dl class="dl">
      ${people ? `<dt>People</dt><dd>${people}</dd>` : ''}
      ${orgs ? `<dt>Orgs</dt><dd>${orgs}</dd>` : ''}
      ${tags ? `<dt>Threads</dt><dd>${tags}</dd>` : ''}
    </dl>
    ${out.length + inc.length ? linkList('Connected records', [...out, ...inc.filter((x) => !out.includes(x))], true) : ''}
    ${whereBlock(e)}
    <div class="sect-h"><span>Sources</span><span>${e.sources.filter((s) => s.kind !== 'background').length}</span></div>
    <ol class="sources ix">${e.sources.filter((s) => s.kind !== 'background').map(sourceRow).join('')}</ol>
    ${e.sources.some((s) => s.kind === 'background') ? `<p class="bg-read"><span>Background</span> ${e.sources.filter((s) => s.kind === 'background').map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(host(s.url))}</a>`).join(', ')}</p>` : ''}
    ${verifBlock(e)}`;
  $('#db').scrollTop = 0;
  if (out.length + inc.length) { if (hasD3()) miniGraph(e, inc, out); else ensureD3().then(() => { if (state.sel === e.id && document.getElementById('mg')) miniGraph(e, inc, out); }); }
  after();
}

// A record's picture, when it carries one (the same figure the Moment card draws): licensed, credited, linked to its page.
const picFigure = (e) => { const pic = e.picture; if (!pic || !pic.src) return ''; return `<figure class="rec-pic"><div class="rec-img"><img src="${esc(pic.src)}" alt="${esc(pic.alt || '')}" width="${pic.w || ''}" height="${pic.h || ''}" loading="lazy" decoding="async"></div><figcaption>${pic.page_url ? `<a href="${esc(pic.page_url)}" target="_blank" rel="noopener">${esc(pic.credit || '')}</a>` : esc(pic.credit || '')}</figcaption></figure>`; };
// A source row. Sources added under the November 2026 standard carry author, venue, year, doi and a line on what the
// page confirms; older sources are a title and a host. The kind word names what the reader is about to open.
const KIND_WORD = { journal: 'Peer reviewed', book: 'Monograph', primary: 'Primary source', reference: 'Reference work', technical: 'Independent evaluation', news: 'Reporting', vendor: 'Company source' };
function sourceRow(s) {
  const bib = s.author || s.venue || s.year ? `<span class="bib">${[s.author, s.venue, s.year].filter(Boolean).map(esc).join(' · ')}${s.pages ? `, ${esc(s.pages)}` : ''}</span>` : '';
  const doi = s.doi ? `<a class="doi" href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">doi:${esc(s.doi)}</a>` : '';
  const kind = s.kind && KIND_WORD[s.kind] ? `<span class="kind k-${esc(s.kind)}">${KIND_WORD[s.kind]}</span>` : '';
  const says = s.confirms || s.qualifies ? `<span class="says">${s.confirms ? esc(s.confirms) : ''}${s.qualifies ? ` <em>${esc(s.qualifies)}</em>` : ''}</span>` : '';
  return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${kind}${bib}${doi}${says}<span class="host">${esc(host(s.url))}</span></li>`;
}
// Every record states where its claims stand. Four states: fact checked (claims match the cited sources), partly
// confirmed (some details did not match, note open on demand), corrected (the check contradicted the title or date;
// the note is open so the error is never hidden), and not yet fact checked (sources listed, claims not yet matched).
const noteHtml = (e) => `<p>${esc(e.verification_note || '').split(' || ').join('</p><p>')}</p>`;
export function verifBlock(e) {
  if (!db.loaded.has('meta')) return '';  // flags arrive with the meta file; until then the line stays empty rather than wrong
  if (e.verification === 'supported') return `<p class="verif ok"><span>Fact checked</span> Claims match the cited sources.</p>`;
  if (e.verification === 'partially') return `<details class="verif part"><summary><span>Partly confirmed</span> Some details did not match a source</summary>${noteHtml(e)}</details>`;
  if (e.verification === 'unsupported') return `<details class="verif bad" open><summary><span>Corrected</span> The check contradicts this record's title or date</summary>${noteHtml(e)}</details>`;
  return `<p class="verif no"><span>Not yet fact checked</span> Sources listed; claims not yet matched to them.</p>`;
}
// stage 5: a moment's card. Picture (when it has one), the headline, the fact, its source, and the other events of its year,
// as many as fit: the card never scrolls (fitMoment trims the list, then lowers the picture, then lets the list go)
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function momentDrawer(e, trailHtml) {
  const d = DOMAIN[e.domain], when = e.month ? `${e.day ? `${e.day} ` : ''}${MONTH_LONG[e.month - 1]} ${e.year}` : String(e.year);
  tint(recCol(e.year));
  $('#dk').innerHTML = `<i style="background:${recCol(e.year)}"></i><span class="ki">Moment</span><span class="ki">${esc(d ? d.label : e.domain)}</span><span class="ki">${esc(when)}</span>`;
  const pic = e.picture, contain = !!pic && /nokia_3310/.test(pic.src || ''), head = e.title.length > 48 && e.title_short ? e.title_short : e.title;
  const src = (e.sources || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join('; ');
  const also = db.events.filter((x) => x.year === e.year && x.id !== e.id && x.title_short).sort((a, b) => ((b.significance || 0) - (a.significance || 0)) || (a.id < b.id ? -1 : 1)).slice(0, 14);
  $('#db').innerHTML = `
    ${pic ? `<figure class="mo-pic${contain ? ' contain' : ''}"><div class="mo-img"><img src="${esc(pic.src)}" alt="${esc(pic.alt || '')}" width="${pic.w || ''}" height="${pic.h || ''}" decoding="async"></div><figcaption>${pic.page_url ? `<a href="${esc(pic.page_url)}" target="_blank" rel="noopener">${esc(pic.credit || '')}</a>` : esc(pic.credit || '')}</figcaption></figure>` : ''}
    <h3 class="mo-h">${esc(head)}</h3>
    ${trailHtml}
    <p class="mo-fact">${esc(e.summary || '')}</p>
    ${src ? `<p class="mo-src">Source: ${src}${e.verification === 'partially' ? ', partly confirmed' : e.verification === 'unsupported' ? ', corrected below' : e.verification ? '' : ', not yet fact checked'}</p>` : ''}
    ${e.verification === 'unsupported' ? `<p class="mo-src verif bad"><span>Corrected</span> ${esc((e.verification_note || '').split(' || ')[0])}</p>` : ''}
    ${also.length ? `<div class="mo-also"><p class="mo-also-h">Also in ${e.year}</p><ul>${also.map((x) => `<li><button type="button" data-id="${esc(x.id)}">${esc(x.title_short)}</button></li>`).join('')}</ul></div>` : ''}`;
  $('#db').scrollTop = 0;
}
function fitMoment() {
  const body = $('#db'); if (!body || !body.querySelector('.mo-fact')) return;
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const step = () => {
    if (!body.isConnected || !body.querySelector('.mo-fact') || body.clientHeight < 120) return; // not laid out yet: nothing to measure
    for (let guard = 0; guard < 40 && !fits(); guard++) {
      const items = body.querySelectorAll('.mo-also li'), pic = document.querySelector('#drawer .mo-pic'), also = body.querySelector('.mo-also');
      if (items.length > 2) items[items.length - 1].remove();
      else if (pic && !pic.classList.contains('low')) pic.classList.add('low');
      else if (also) also.remove();
      else if (pic) pic.remove();
      else break;
    }
  };
  const go = () => requestAnimationFrame(step);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  setTimeout(step, 400); setTimeout(step, 1000); // the drawer's transition settles, then another look
}
// supporting paragraphs (events_text.json "detail", blank-line separated) under a closed disclosure right after the summary
function detailBlock(e) {
  const paras = String(e.detail || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  if (!paras.length) return '';
  return `<details class="detail"><summary>Supporting detail</summary>${paras.map((x) => `<p>${esc(x)}</p>`).join('')}</details>`;
}
function verif(x) {
  if (x.verification === 'supported') return `<p class="verif ok"><span>Fact checked</span> Claims match the cited source.</p>`;
  if (x.verification === 'partially' || x.verification === 'unsupported') return `<details class="verif part"><summary><span>${x.verification === 'unsupported' ? 'Corrected' : 'Partly confirmed'}</span> The fact check changed or qualified this record</summary><p>${esc(x.verification_note || '')}</p></details>`;
  return '';
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function modelDrawer(m) {
  const pp = m.params_billion;
  const params = pp == null ? 'Not disclosed' : pp >= 1000 ? `${+(pp / 1000).toFixed(2)} trillion` : pp >= 1 ? `${+pp.toFixed(1)} billion` : `${Math.round(pp * 1000)} million`;
  tint(W_COL[wOf(m)]);
  $('#dk').innerHTML = `<i style="background:${W_COL[wOf(m)]}"></i><span class="ki">Model</span><span class="ki">${esc(m.org)}</span><span class="ki">${{ open: 'Open weights', gated: 'Gated weights', closed: 'Closed weights' }[wOf(m)]}</span>`;
  const evs = modelEvents(m);
  const msrc = [{ url: m.source_url, title: m.source_title || '' }, ...(m.more_sources || []).filter(Boolean).map((u) => ({ url: u, title: '' }))];
  const fam = (db.modelList || []).filter((x) => x !== m && x.fams && m.fams && x.fams.some((f) => m.fams.includes(f))).sort((a, b) => a.t - b.t);
  const row = (x) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:${recCol(x.year)}"></i><span class="y">${x.year}</span><span>${esc(x.title || x.name)}</span></button></li>`;
  $('#db').innerHTML = `
    <h3>${esc(m.name)}</h3>
    <div class="date"><span>${m.month ? MON[m.month - 1] + ' ' : ''}${m.year}</span><span>${esc(m.modality)}</span></div>
    <p class="summary">${esc(m.notable_for)}</p>
    <dl class="dl">
      <dt>Lab</dt><dd>${esc(m.org)}</dd>
      <dt>Parameters</dt><dd>${esc(params)}</dd>
      <dt>Weights</dt><dd>${{ open: 'Open: weights publicly downloadable', gated: 'Gated: weights released on request under a research license', closed: 'Closed: available only through the lab' }[wOf(m)]}</dd>
      ${m.aka && m.aka.length ? `<dt>Also listed as</dt><dd>${esc(m.aka.join(', '))}</dd>` : ''}
      ${m.fams && m.fams.length ? `<dt>Family</dt><dd>${esc(m.fams.join(', '))}</dd>` : ''}
    </dl>
    ${evs.length ? `<div class="sect-h"><span>Matching on the map</span><span>${evs.length}</span></div><ul class="links">${evs.slice(0, 4).map(row).join('')}</ul>` : `<div class="sect-h"><span>Matching event</span><span>0</span></div><p class="ab-small" style="font-size:13px;color:var(--ink-3);margin:0">No map event names this model in its title.</p>`}
    ${fam.length ? `<div class="sect-h"><span>Same family</span><span>${fam.length}</span></div><ul class="links">${fam.map((x) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:${W_COL[wOf(x)]};border-radius:50%"></i><span class="y">${x.year}</span><span>${esc(x.name)}</span></button></li>`).join('')}</ul>` : ''}
    <div class="sect-h"><span>Source${msrc.length > 1 ? 's' : ''}</span><span>${msrc.length}</span></div>
    <ol class="sources">${msrc.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(s.title ? host(s.url) : s.url)}</span></li>`).join('')}</ol>
    ${verif(m)}`;
  $('#db').scrollTop = 0;
}

// Prediction outcomes: label, ink color, short verdict. Shared with the ledger view.
// outcome roles share the Ledger's set (red stays reserved for annotation and selection, DESIGN_BRIEF.md)
export const OUTCOMES = [
  { id: 'came_true', label: 'Came true', color: VERDICT_NIGHT.came_true, note: 'Happened on or near the predicted horizon' },
  { id: 'came_true_late', label: 'Came true late', color: VERDICT_NIGHT.came_true_late, note: 'Happened, but well after the horizon' },
  { id: 'partly', label: 'Partly', color: VERDICT_NIGHT.partly, note: 'Some of it happened, or in a different form' },
  { id: 'wrong', label: 'Wrong', color: VERDICT_NIGHT.wrong, note: 'Did not happen by the horizon, or the reverse happened' },
  { id: 'pending', label: 'Pending', color: '#8b93c8', note: 'Horizon not yet reached or left open' },
  { id: 'misattributed', label: 'Misattributed', color: VERDICT_NIGHT.misattributed, note: 'No reliable evidence the person said it' },
  { id: 'unresolvable', label: 'Unresolvable', color: VERDICT_NIGHT.unresolvable, note: 'A judgment the record cannot weigh, not a dated forecast' },
];
export const OUTCOME = Object.fromEntries(OUTCOMES.map((o) => [o.id, o]));
// the kind each claim reads as, mirrored from claimKind in views/predictions.js (the Ledger loads lazily, so the panel keeps its own copy; change both together)
function claimKind(p) {
  const k = p.kind || '';
  if (p.predicted_for || k === 'prediction' || k === 'prophecy' || k === 'hope') return 'Prediction';
  if (k === 'warning' || k === 'fear' || (!k && p.direction === 'pessimistic')) return 'Fear';
  return 'Statement';
}
function predDrawer(p) {
  const o0 = OUTCOME[p.outcome] || OUTCOMES[4];
  // a Ledger statement checked against the record (chk, written by tools/apply_forecast_check.py) wears its check
  const c = p.chk, w0 = c ? STATUS_WORD[c.s] || STATUS_WORD.unresolvable : '';
  const o = c ? { color: STATUS_NIGHT[c.s] || STATUS_NIGHT.unresolvable, label: w0[0].toUpperCase() + w0.slice(1) } : o0;
  const mis = p.outcome === 'misattributed';
  const dom = DOMAIN[p.domain];
  const horizon = p.predicted_for ? (p.predicted_for === p.year_made ? `within ${p.year_made}` : `by ${p.predicted_for}`) : 'no date given';
  tint(o.color);
  $('#dk').innerHTML = `<i style="background:${o.color}"></i><span class="ki">${claimKind(p)}</span><span class="ki rec">${esc(o.label)}</span><span class="ki">${esc(dom ? dom.label : p.domain)}</span>`;
  const rel = (p.related_event_ids || []).map((id) => db.byId.get(id)).filter(Boolean).sort((a, b) => a.t - b.t);
  const row = (x) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:${recCol(x.year)}"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  const who = p.who.replace(/\s*\(attributed\)\s*$/i, '');
  $('#db').innerHTML = `
    <h3>${esc(p.claim)}</h3>
    <div class="date"><span>Made ${p.year_made}</span><span>Horizon ${esc(horizon)}</span><span>${p.direction === 'pessimistic' ? 'Pessimistic' : 'Optimistic'}</span>${c && c.on ? `<span>Checked ${esc(dayOf(c.on))}</span>` : ''}</div>
    ${mis ? `<p class="pr-mis"><span class="sc">Misattributed</span> The sources below find no reliable record that ${esc(who)} said it. It is kept as a myth about prediction.</p>` : ''}
    ${p.quote ? `<figure class="pr-quote${mis ? ' mis' : ''}"><blockquote><p>&ldquo;${esc(p.quote)}&rdquo;</p></blockquote><figcaption>${mis ? 'Attributed to ' : ''}${esc(who)}${p.role ? `, ${esc(p.role)}` : ''}, ${p.year_made}</figcaption></figure>
    <p class="summary">${esc(p.paraphrase)}</p>` : `<p class="pr-para"><span class="sc">Paraphrase, no exact quote on record</span>${esc(p.paraphrase)}</p><p class="pr-by">${esc(who)}${p.role ? `, ${esc(p.role)}` : ''}, ${p.year_made}</p>`}
    ${c ? `<div class="pr-verdict fc-verdict" style="--oc:${o.color}"><span class="sc"><i aria-hidden="true"></i>${esc(o.label)}</span>${c.note ? `<p>${esc(c.note)}</p>` : ''}</div>
    ${c.ev && c.ev.length ? `<div class="sect-h"><span>Read for the check</span><span>${c.ev.length}</span></div><ol class="sources">${c.ev.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || host(x.url))}</a><span class="host">${esc(host(x.url))}</span></li>`).join('')}</ol>` : ''}` : `<div class="pr-verdict" style="--oc:${o.color}"><span class="sc"><i aria-hidden="true"></i>Outcome, ${esc(o.label).toLowerCase()}</span><p>${esc(p.outcome_note)}</p></div>`}
    ${rel.length ? `<div class="sect-h"><span>Related events on the map</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>Sources</span><span>${p.sources.length}</span></div>
    <ol class="sources">${p.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || host(x.url))}</a><span class="host">${esc(host(x.url))}</span></li>`).join('')}</ol>`;
  $('#db').scrollTop = 0;
}

// a forecast from data/forecasts.json (stage 4d): what was said, when, for which year, and how it stands; then the
// person's other words from the record, each opening its own pane
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function saidWhen(said) {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(said || ''));
  if (!m) return '';
  return m[2] && MONTH[+m[2] - 1] ? `${MONTH[+m[2] - 1]} ${m[1]}` : m[1];
}
// a forecast's colour and word: the check against the record (chk, written by tools/apply_forecast_check.py) when one
// stands, else the verdict
const fcCol = (f) => (f.chk ? STATUS_NIGHT[f.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[f.v] || VERDICT_NIGHT.unresolvable);
const fcWord = (f) => (f.chk ? STATUS_WORD[f.chk.s] || STATUS_WORD.unresolvable : VERDICT_WORD[f.v] || VERDICT_WORD.unresolvable);
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const fmtV = (v) => (typeof v !== 'number' ? String(v) : Math.abs(v) >= 10000 ? COMPACT.format(v) : Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(+v.toPrecision(4)));
function dayOf(s) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(s || ''));
  if (!m) return '';
  return `${m[3] ? `${+m[3]} ` : ''}${m[2] && MONTH[+m[2] - 1] ? `${MONTH[+m[2] - 1]} ` : ''}${m[1]}`;
}
// where a checked forecast stands, in a sentence: the measure against the line, then the day the measure holds for
function checkNote(c) {
  const num = typeof c.now === 'number' && typeof c.line === 'number' ? `${fmtV(c.now)} now, ${fmtV(c.line)} forecast${c.u ? `, ${c.u}` : ''}.` : '';
  const when = c.at ? `Measure of ${dayOf(c.at)}.` : '';
  return [num, when].filter(Boolean).join(' ');
}
function forecastDrawer(f) {
  const c = f.chk, col = fcCol(f), w0 = fcWord(f), word = w0[0].toUpperCase() + w0.slice(1);
  const when = saidWhen(f.said) || String(f.y0);
  const others = wordsOf(f.who).filter((w) => w.t !== f.text);
  const row = (w) => `<li>${w.id ? `<button type="button" class="ls-word" data-id="${esc(w.id)}">` : '<div class="ls-row ls-word">'}<i style="background:${VERDICT_NIGHT[w.v] || VERDICT_NIGHT.unresolvable}"></i><span class="y">${esc(String(w.y))}</span><span>${esc(w.t)}<span class="ls-sub">${esc(w.when)}, ${esc(VERDICT_WORD[w.v] || VERDICT_WORD.unresolvable)}</span></span>${w.id ? '</button>' : '</div>'}</li>`;
  const ev = c && c.ev ? c.ev : [];
  tint(col);
  $('#dk').innerHTML = `<i style="background:${col}"></i><span class="ki">Forecast</span><span class="ki rec">${esc(word)}</span><span class="ki">For ${f.t}</span>`;
  $('#db').innerHTML = `
    <h3>${esc(f.text)}</h3>
    <div class="date"><span>Said ${esc(when)}</span><span>For ${f.t}</span>${c && c.on ? `<span>Checked ${esc(dayOf(c.on))}</span>` : ''}</div>
    <p class="fc-by"><button type="button" class="fc-who" data-id="who:${esc(f.who)}">${esc(f.who)}</button></p>
    <div class="pr-verdict fc-verdict" style="--oc:${col}"><span class="sc"><i aria-hidden="true"></i>${esc(word)}</span>${c ? `${checkNote(c) ? `<p>${esc(checkNote(c))}</p>` : ''}${c.note ? `<p>${esc(c.note)}</p>` : ''}` : `<p>${esc(standingNote(f))}</p>`}</div>
    ${ev.length ? `<div class="sect-h"><span>Read for the check</span><span>${ev.length}</span></div><ol class="sources">${ev.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || host(x.url))}</a><span class="host">${esc(host(x.url))}</span></li>`).join('')}</ol>` : ''}
    ${others.length ? `<div class="sect-h"><span>Other words from ${esc(f.who)}</span><span>${others.length}</span></div><ul class="links ls-list ls-words">${others.map(row).join('')}</ul>` : ''}`;
  $('#db').scrollTop = 0;
}
// the forecasts checked against the record, drawn: the numbered ones as bars filled from zero to the measure today on a
// track that ends at the forecast, then every dated forecast as a square under the year it names
function fcCheckHtml(fcs) {
  const checked = fcs.filter((f) => f.chk);
  if (!checked.length) return '';
  const on = checked[0].chk.on, W = Math.max(280, (($('#db') || {}).clientWidth || 392) - 48);
  const ORDER = ['came_true', 'on_track', 'behind', 'contradicted', 'too_early', 'unresolvable'];
  const cnt = (k) => checked.filter((f) => f.chk.s === k).length;
  const words = ORDER.filter(cnt).map((k) => `<b style="color:${STATUS_NIGHT[k]}">${cnt(k)} ${STATUS_WORD[k]}</b>`);
  const line = `<p class="fc-words">${checked.length} due in 2026 or 2027, checked ${esc(dayOf(on))}: ${words.slice(0, -1).join(', ')}${words.length > 1 ? ' and ' : ''}${words[words.length - 1]}.</p>`;
  // the bars
  const q = checked.filter((f) => typeof f.chk.now === 'number' && typeof f.chk.line === 'number' && f.chk.line !== 0)
    .map((f) => ({ f, pct: ((f.chk.now - f.chk.line) / Math.abs(f.chk.line)) * 100 })).sort((a, b) => a.pct - b.pct);
  // a row's bar, on its own scale: "now" filled from zero at the left over a faint track that ends at the forecast's tick, so the row's width
  // is the forecast. A forecast beaten fills the row and its tick stands in a gap in the fill, where the forecast was. Each tick carries its word.
  // Under the forecaster and the forecast, one statement: the measure, then "now" and "forecast" in that measure
  const phone = PHONE();
  const mc = (fcCheckHtml.mc = fcCheckHtml.mc || document.createElement('canvas').getContext('2d'));
  const face = getComputedStyle(document.documentElement).getPropertyValue('--font-text').trim() || 'sans-serif';
  const F3 = `${phone ? 13 : 11}px ${face}`, F2 = `600 ${phone ? 13 : 12}px ${face}`, F1 = `600 13px ${face}`, LH = phone ? 17 : 15, T = 4, TICK = 'forecast';
  const tw = (t, font) => { mc.font = font; return mc.measureText(t).width; };
  // the statement's runs wrapped by word, each word measured in its own weight
  const runsWrap = (runs, maxW) => { const lines = [[]]; let w = 0;
    for (const [text, cls, font, fill] of runs) for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const ww = tw(word, font); let ln = lines[lines.length - 1], sp = ln.length ? tw(' ', font) : 0;
      if (ln.length && w + sp + ww > maxW) { lines.push((ln = [])); w = 0; sp = 0; }
      const last = ln[ln.length - 1]; if (last && last.cls === cls) last.t += ` ${word}`; else ln.push({ t: word, cls, fill });
      w += sp + ww; }
    return lines; };
  let y = T, rows = '';
  q.forEach(({ f }) => {
    const c = f.chk, col = STATUS_NIGHT[c.s] || STATUS_NIGHT.unresolvable, word = STATUS_WORD[c.s], r = Math.max(0, c.now / c.line), xt = r > 1 ? W / r : W;
    const who = wrapMeasured(mc, f.who, W - tw(word, F2) - 14, F1, 1)[0] || '';
    const lab = wrapMeasured(mc, c.lab || f.text, W - 4, F3, phone ? 3 : 2);
    const says = runsWrap((c.u ? [[`${c.u}:`, 't3', F3, '']] : []).concat([[`${fmtV(c.now)} now, ${fmtV(c.line)} forecast`, 't2', F2, col]]), W - 4);
    y += 13;
    rows += `<text x="0" y="${y}" class="t1">${esc(who)}</text><text x="${W}" y="${y}" text-anchor="end" class="t2" fill="${col}">${esc(word)}</text>`;
    for (const l of lab) { y += LH; rows += `<text x="0" y="${y}" class="t3">${esc(l)}</text>`; }
    for (const ln of says) { y += LH; rows += `<text x="0" y="${y}">${ln.map((s, i) => `<tspan class="${s.cls}"${s.fill ? ` fill="${s.fill}"` : ''}>${i ? ' ' : ''}${esc(s.t)}</tspan>`).join('')}</text>`; }
    y += 8;
    rows += `<rect x="0" y="${y}" width="${xt.toFixed(1)}" height="8" rx="2" fill="rgba(238,240,250,0.09)"/>${r > 1 ? `<rect x="0" y="${y}" width="${(xt - 3).toFixed(1)}" height="8" rx="2" fill="${col}"/><rect x="${(xt + 1.5).toFixed(1)}" y="${y}" width="${(W - xt - 1.5).toFixed(1)}" height="8" rx="2" fill="${col}"/>` : `<rect x="0" y="${y}" width="${Math.max(2, W * r).toFixed(1)}" height="8" rx="2" fill="${col}"/>`}<line x1="${(xt - 0.75).toFixed(1)}" x2="${(xt - 0.75).toFixed(1)}" y1="${y - 3}" y2="${y + 11}" class="zl"/>`;
    const half = tw(TICK, F3) / 2, end = xt + half > W;
    y += 8 + LH; rows += `<text x="${(end ? xt : Math.max(half, xt)).toFixed(1)}" y="${y - 1}" text-anchor="${end ? 'end' : 'middle'}" class="t3">${TICK}</text>`;
    y += phone ? 20 : 14;
  });
  const bars = `<svg class="fc-bars" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img" aria-label="${q.length} forecasts with a number, each row filled to where it stands now against its forecast">${rows}</svg>`;
  // the field: a square per dated forecast, under the year named; the checked ones at the foot of their columns
  const all = db.forecasts || [];
  const bucket = (f) => (!(f.t > 0) ? 'no date' : f.t <= 2024 ? 'to 2024' : f.t <= 2030 ? String(f.t) : f.t <= 2035 ? '2031 to 35' : '2036 on');
  const keys = ['to 2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031 to 35', '2036 on', 'no date'];
  const rank = (f) => (f.chk ? ORDER.indexOf(f.chk.s) : 10 + ['came_true', 'came_true_late', 'partly', 'wrong', 'misattributed', 'unresolvable', 'pending'].indexOf(f.v));
  const colOf = (f) => (f.chk ? STATUS_NIGHT[f.chk.s] : f.v === 'pending' ? 'rgba(185,192,255,0.28)' : f.v === 'partly' ? '#b08a2e' : VERDICT_NIGHT[f.v] || VERDICT_NIGHT.unresolvable);
  const groups = keys.map((k) => { const items = all.filter((f) => bucket(f) === k).sort((a, b) => rank(a) - rank(b)); const across = items.length > 120 ? 8 : items.length > 40 ? 4 : items.length > 14 ? 3 : 2; return { k, items, across, rows: Math.ceil(items.length / across) }; });
  const GAP = 10, pitch = Math.min(8, (W - GAP * (keys.length - 1)) / groups.reduce((a, g) => a + g.across, 0)), maxRows = Math.max(...groups.map((g) => g.rows)), FT = 22, FB = phone ? 66 : 34, FH = FT + maxRows * pitch + FB;
  let field = `<svg class="fc-field" width="${W}" height="${FH}" viewBox="0 0 ${W} ${FH}" role="img" aria-label="${all.length} forecasts by the year named">`;
  let cx = 0;
  const ends = [-99, -99, -99], ticks = [];
  for (const g of groups) {
    const w = g.across * pitch;
    g.items.forEach((f, i) => { const col = i % g.across, row = Math.floor(i / g.across); field += `<rect x="${(cx + col * pitch).toFixed(1)}" y="${(FH - FB - (row + 1) * pitch + 1).toFixed(1)}" width="${(pitch - 1.5).toFixed(1)}" height="${(pitch - 1.5).toFixed(1)}" rx="1.2" fill="${colOf(f)}"/>`; });
    field += `<text x="${cx + w / 2}" y="${FH - FB - g.rows * pitch - 6}" text-anchor="middle" class="t2">${g.items.length}</text>`;
    if (phone) {
      // phone: the year under its column at 13 px, on the first of three tiers with room, a tick from column to year
      const mc = fcCheckHtml.mc, lw = (mc.font = `13px ${getComputedStyle(document.documentElement).getPropertyValue('--font-text').trim() || 'sans-serif'}`, mc.measureText(g.k).width);
      const mid = cx + w / 2, lx0 = Math.max(lw / 2, Math.min(W - lw / 2, mid));
      // room on a tier: clear of the last year set there and of every tick that runs down through it; a year may slide a few px
      const slide = ends.map((e, t) => Math.max(0, Math.max(e + 7, ...ticks.filter((k) => k.t > t).map((k) => k.x + 5)) - (lx0 - lw / 2)));
      let tier = slide.findIndex((d, t) => d <= 6 && lx0 + d + lw / 2 <= W); if (tier < 0) tier = slide.indexOf(Math.min(...slide));
      const lx = Math.min(W - lw / 2, lx0 + slide[tier]);
      ends[tier] = lx + lw / 2; if (tier) ticks.push({ x: mid, t: tier });
      const ly = FH - FB + 15 + tier * 19;
      // the tick starts under any year it would touch on a tier above
      const ty = FH - FB + 3 + ends.reduce((a, e, t) => (t < tier && mid < e + 5 ? 17 + t * 19 : a), 0);
      if (tier && ly - 13 - ty >= 4) field += `<line x1="${mid}" x2="${mid}" y1="${ty}" y2="${ly - 13}" class="tk"/>`;
      field += `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="middle" class="t3">${g.k}</text>`;
    } else {
    const parts = g.k.split(' '), split = parts.length > 1 && g.k !== 'no date' && g.k !== 'to 2024';
    const l1 = split ? parts[0] : g.k, l2 = split ? parts.slice(1).join(' ') : '';
    field += `<text x="${cx + w / 2}" y="${FH - FB + 14}" text-anchor="middle" class="t3">${l1}</text>${l2 ? `<text x="${cx + w / 2}" y="${FH - FB + 26}" text-anchor="middle" class="t3">${l2}</text>` : ''}`;
    }
    cx += w + GAP;
  }
  field += '</svg>';
  return `<div class="fc-check">${line}${bars}${field}</div>`;
}
// every dated forecast from 2026 on the ghost thread, grouped by the year named, under the check; each row opens its record
function forecastsDrawer() {
  const { all, voices } = forecastCount(); // one count, shared with the spiral's label (data.js)
  const years = [...new Set(all.map((f) => f.t))], checked = all.filter((f) => f.chk);
  const row = (f) => `<li><button type="button" class="ls-word" data-id="${esc(f.id)}"><i style="background:${fcCol(f)}"></i><span class="y">${esc(String(f.y0))}</span><span>${esc(f.text)}<span class="ls-sub">${esc(f.who)}, ${esc(fcWord(f))}</span></span></button></li>`;
  tint(null);
  $('#dk').innerHTML = `<i style="background:${VERDICT_NIGHT.pending}"></i><span class="ki">Forecasts</span><span class="ki">${years[0]} to ${years[years.length - 1]}</span>`;
  $('#db').innerHTML = `
    <h3>${all.length} dated forecasts from ${voices} voices</h3>
    <div class="date"><span>Due ${years[0]} to ${years[years.length - 1]}</span>${checked.length ? `<span>${checked.length} checked ${esc(dayOf(checked[0].chk.on))}</span>` : ''}</div>
    ${fcCheckHtml(all)}
    ${years.map((y) => { const g = all.filter((f) => f.t === y); return `<div class="sect-h"><span>${y}</span><span>${g.length}</span></div><ul class="links ls-list ls-words">${g.map(row).join('')}</ul>`; }).join('')}`;
  $('#db').scrollTop = 0;
}
// the standing of a forecast on 2 November 2026, in a sentence
function standingNote(f) {
  const y = f.t;
  switch (f.v) {
    case 'came_true': return `Happened by ${y}.`;
    case 'came_true_late': return `Happened, after ${y}.`;
    case 'partly': return `Some of it happened by ${y}, or in a different form.`;
    case 'wrong': return `Did not happen by ${y}.`;
    case 'pending': return y > 2026 ? `${y} has not come.` : y === 2026 ? '2026 is not over.' : 'Not yet settled.';
    case 'misattributed': return 'No reliable record that it was said.';
    default: return 'A judgment the record cannot weigh against a date.';
  }
}

const DEAL_KIND = { equity: ['Equity investment', '#d9a21e'], acquisition: ['Acquisition', '#b0457a'], licensing: ['Licensing and hiring', '#7a5aa6'], cloud: ['Cloud contract', '#5b8fd0'], compute: ['Compute and data centers', '#2d5a88'], chips: ['Chip purchase', '#3c4180'], energy: ['Power deal', '#8a4e2c'] };
function dealDrawer(f) {
  const [kl, kc] = DEAL_KIND[f.kind] || [f.kind, '#888'];
  const amt = f.amount_usd_billion == null ? 'Not disclosed' : f.amount_usd_billion >= 1 ? `$${+f.amount_usd_billion.toFixed(2)} billion` : `$${Math.round(f.amount_usd_billion * 1000)} million`;
  $('#dk').innerHTML = `<i style="background:${kc}"></i><span class="ki">Deal</span><span class="ki">${esc(kl)}</span>`;
  const key = (s) => s.replace(/\s*\(.*?\)/g, '').replace(/^(Investors( incl\.)?|The Walt )/, '').split(/,| and /)[0].trim().split(' ')[0].toLowerCase();
  const a = key(f.source_org), b = key(f.target_org);
  const rel = a.length > 2 && b.length > 2 ? db.events.filter((e) => e.year === f.year).map((e) => {
    const t = e.title.toLowerCase(), s = (e.summary || '').toLowerCase();
    const inT = (t.includes(a) ? 1 : 0) + (t.includes(b) ? 1 : 0);
    if (!inT || !(t.includes(a) || s.includes(a)) || !(t.includes(b) || s.includes(b))) return null;
    return [e, (2 - inT) * 12 + (e.month && f.month ? Math.abs(e.month - f.month) : 6)];
  }).filter(Boolean).sort((x, y) => x[1] - y[1]).slice(0, 3).map((x) => x[0]) : [];
  const row = (x) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:${recCol(x.year)}"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  $('#db').innerHTML = `
    <h3>${esc(f.source_org)} to ${esc(f.target_org)}</h3>
    <div class="date"><span>${f.month ? MON[f.month - 1] + ' ' : ''}${f.year}</span><span>${esc(kl)}</span></div>
    <p class="summary">${esc(f.note)}</p>
    <dl class="dl"><dt>From</dt><dd>${esc(f.source_org)}</dd><dt>To</dt><dd>${esc(f.target_org)}</dd><dt>Amount</dt><dd>${esc(amt)}</dd></dl>
    ${rel.length ? `<div class="sect-h"><span>Related on the map</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>Source${f.alt_source && f.alt_source.url ? 's' : ''}</span><span>${f.alt_source && f.alt_source.url ? 2 : 1}</span></div>
    <ol class="sources"><li><a href="${esc(f.source_url)}" target="_blank" rel="noopener">${esc(f.source_label)}</a>${f.source_label !== host(f.source_url) ? `<span class="host">${esc(host(f.source_url))}</span>` : ''}</li>${f.alt_source && f.alt_source.url ? `<li><a href="${esc(f.alt_source.url)}" target="_blank" rel="noopener">${esc(f.alt_source.title || host(f.alt_source.url))}</a><span class="host">${esc(host(f.alt_source.url))}</span></li>` : ''}</ol>
    ${verif(f)}`;
  $('#db').scrollTop = 0;
}

function miniGraph(e, inc, out) {
  const svg = d3.select('#mg');
  const W = svg.node().clientWidth || 380, H = 200;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  // second-degree neighbours give the graph some texture
  const nodes = new Map([[e.id, { e, lvl: 0 }]]);
  [...inc, ...out].forEach((x) => nodes.set(x.id, { e: x, lvl: 1 }));
  [...inc, ...out].forEach((x) => neighbors(x.id).slice(0, 4).forEach((id) => { if (!nodes.has(id) && nodes.size < 40) nodes.set(id, { e: db.byId.get(id), lvl: 2 }); }));
  const arr = [...nodes.values()];
  const ys = d3.extent(arr, (n) => n.e.t);
  const pad = 22;
  const x = d3.scaleLinear().domain(ys[0] === ys[1] ? [ys[0] - 1, ys[1] + 1] : ys).range([pad, W - pad]);
  // vertical: center at middle, level 1 and 2 spread above/below
  let k = 0;
  arr.forEach((n) => {
    n.x = x(n.e.t);
    if (n.lvl === 0) n.y = H / 2;
    else { k++; n.y = H / 2 + (k % 2 ? -1 : 1) * (n.lvl === 1 ? 26 + (k % 5) * 12 : 52 + (k % 4) * 10); }
  });
  const links = [];
  arr.forEach((n) => (n.e.connects || []).forEach((c) => nodes.has(c) && links.push([n, nodes.get(c)])));
  svg.selectAll('*').remove();
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - 18})`)  // 10.5px labels sit inside the box
    .call(d3.axisBottom(x).tickValues((() => { const [a, b] = x.domain(); const yrs = d3.range(Math.ceil(a), Math.floor(b) + 1); return yrs.length <= 6 ? yrs : x.ticks(5).filter((v) => Number.isInteger(v)); })()).tickFormat(d3.format('d')).tickSize(3)).select('.domain').remove();
  svg.append('g').selectAll('path').data(links).join('path')
    .attr('d', ([a, b]) => arc([a.x, a.y], [b.x, b.y], 0.25)).attr('fill', 'none')
    .attr('stroke', ([a, b]) => (a.lvl === 0 || b.lvl === 0 ? '#121212' : 'rgba(28,26,23,.25)'))
    .attr('stroke-width', ([a, b]) => (a.lvl === 0 || b.lvl === 0 ? 1.2 : 0.7));
  const g = svg.append('g').selectAll('g').data(arr).join('g').attr('transform', (n) => `translate(${n.x},${n.y})`)
    .style('cursor', (n) => (n.lvl ? 'pointer' : 'default'))
    .on('click', (_, n) => n.lvl && select(n.e.id))
    .on('mouseenter', (ev, n) => tip.show(ev, eventTip(n.e))).on('mousemove', tip.move).on('mouseleave', tip.hide);
  g.append('circle').attr('r', (n) => (n.lvl === 0 ? 7 : n.lvl === 1 ? 4.5 : 3))
    .attr('fill', (n) => recCol(n.e.year)).attr('stroke', GROUNDS.night).attr('stroke-width', (n) => (n.lvl === 0 ? 1.5 : 0.6))
    .attr('opacity', (n) => (n.lvl === 2 ? 0.6 : 1));
  g.filter((n) => n.lvl === 0).append('text').attr('y', -11).attr('text-anchor', 'middle').text((n) => n.e.year);
}

export function initDrawer() {
  $('#db').addEventListener('scroll', fadeBody, { passive: true });
  addEventListener('resize', fadeBody);
  $('#dclose').addEventListener('click', () => select(''));
  $('#drawer').addEventListener('click', (ev) => { const b = ev.target.closest('[data-list]'); if (b && db.pointById && db.pointById.has(b.dataset.list)) select(b.dataset.list); });
  // the scale note: the word "editorial" beside the readouts opens and closes the one-sentence classification note
  $('#drawer').addEventListener('click', (ev) => {
    const k = ev.target.closest('.scale-k'); if (!k) return;
    const note = document.getElementById('scale-note'); if (!note) return;
    note.hidden = !note.hidden; k.setAttribute('aria-expanded', String(!note.hidden));
  });
  $('#drawer').addEventListener('click', (ev) => {
    const d = ev.target.closest('[data-draw]');
    if (d) { ev.stopPropagation(); if (d.dataset.draw) drawLinks(d.dataset.draw); return; }
    const b = ev.target.closest('[data-go]'); if (b) { ev.stopPropagation(); goWhere(b.dataset.go, db.byId.get(state.sel)); }
  }, true);
  // list mode: the header's Draw the links follows the focused row (keyboard or pointer) and shows when that record has links
  const followRow = (row) => {
    const btn = row.closest('#db') && document.querySelector('#df [data-draw], #db .where-h [data-draw]'); if (!btn) return;  // the button sits in the foot row since the Sources moved into the body
    if (!db.links) { btn.hidden = true; ensure('links').then(() => { const again = document.querySelector(`#db .ls-list button[data-id="${CSS.escape(row.dataset.id)}"]`); if (again) followRow(again); }); return; }
    const L = db.links.events[row.dataset.id];
    const n = L ? ['pt', 'th', 'po', 'bm', 'dl', 'im'].reduce((a, k) => a + ((L[k] || []).length), 0) : 0;
    btn.dataset.draw = n ? row.dataset.id : ''; btn.hidden = !n;
  };
  $('#drawer').addEventListener('focusin', (ev) => { const row = ev.target.closest('.ls-list button[data-id]'); if (row) followRow(row); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && state.sel && !document.body.classList.contains('intro-open')) { ev.stopPropagation(); select(''); }
  });
  // keep Tab inside the open drawer; Escape or the close button leaves it
  const dr = $('#drawer');
  dr.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || !dr.classList.contains('on')) return;
    const f = [...dr.querySelectorAll('button, a[href], summary, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.getClientRects().length);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
  });
  $('#dt').addEventListener('click', (ev) => { const b = ev.target.closest('.trail button[data-id]'); if (b && b.dataset.id !== state.sel) select(b.dataset.id); });
  $('#db').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-id]');
    if (b) { select(b.dataset.id); return; }
    const t = ev.target.closest('[data-tag]');
    if (t) set({ thread: t.dataset.tag });
  });
  $('#db').addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-id]'); setHover(b ? b.dataset.id : null); });
  $('#db').addEventListener('mouseleave', () => setHover(null));
}

/* ---------- Scrubber ---------- */
let scrub = null;
export function initScrubber() {
  const host = d3.select('#scrub');
  const svg = host.append('svg').attr('role', 'group').attr('aria-label', 'Timeline scrubber: events by period from 3.3 million BCE to 2026; brush the years to set the span, or move its two handles with the arrow keys');
  const gHist = svg.append('g').attr('class', 'hist');
  const gAxis = svg.append('g').attr('class', 'axis');
  const gBrush = svg.append('g').attr('class', 'brush');
  const gMarks = svg.append('g').attr('class', 'scrub-marks').attr('pointer-events', 'none');
  const gNow = svg.append('g').attr('class', 'scrub-now').attr('pointer-events', 'none');
  const gWin = svg.append('g').attr('class', 'scrub-win').attr('pointer-events', 'none').style('display', 'none');
  gWin.append('rect').attr('height', 16).attr('y', 0);
  const winText = gWin.append('text').attr('y', 11.5).attr('text-anchor', 'middle');
  let marks = [];
  const x = timeScale({ domain: [YEAR_MIN, YEAR_MAX + 1] });
  const gAges = svg.insert('g', ':first-child').attr('class', 'scrub-ages').attr('pointer-events', 'none');
  const brush = d3.brushX().on('brush', brushed).on('end', ended);
  let W = 0, H = 0, silent = false;
  // the window's years ride on the brush itself, centered and kept inside the rail
  function winLabel(sel) {
    if (!sel || H < 44) { gWin.style('display', 'none'); return; }
    const [a, b] = sel.map(x.invert);
    winText.text(`${fmtYear(Math.round(a))} to ${fmtYear(Math.round(b) - 1)}`);
    const tw = Math.ceil((winText.node().getComputedTextLength ? winText.node().getComputedTextLength() : 60) + 12);
    const cx = Math.min(W - 10 - tw / 2, Math.max(10 + tw / 2, (sel[0] + sel[1]) / 2));
    gWin.style('display', null).attr('transform', `translate(${Math.round(cx)},${T + 1})`);
    gWin.select('rect').attr('x', -Math.round(tw / 2) + 0.5).attr('width', tw);
  }
  function brushed(ev) {
    if (!ev.selection || silent) return;
    const [a, b] = ev.selection.map(x.invert);
    d3.select('#rng').text(`${fmtYear(Math.round(a))} to ${fmtYear(Math.round(b) - 1)}`);
    winLabel(ev.selection);
  }
  function ended(ev) {
    if (silent) return;
    if (!ev.selection) { set({ y0: YEAR_MIN, y1: YEAR_MAX }); return; }
    let [a, b] = ev.selection.map(x.invert).map(Math.round);
    if (b - a < 3) b = a + 3;
    set({ y0: Math.max(YEAR_MIN, a), y1: Math.min(YEAR_MAX, b - 1) });
  }
  const footer = host.node().closest('.scrubber');
  let B = 16, T = 4;
  function layout() {
    const r = host.node().getBoundingClientRect();
    // hidden (outside History, or under the intro): nothing to lay out; main.js calls layout() again when History opens
    if (r.width < 40 || r.height < 8) { W = 0; H = 0; return; }
    W = r.width; H = r.height;
    // the compact strip (outside History) has no axis row; the histogram uses the whole height
    // the thin locator (24px, History only): no axis row, no age labels; the brush is the one amber window
    B = 2; T = 2;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    x.range([10, W - 10]);
    brush.extent([[10, T], [W - 10, H - B]]);
    gBrush.call(brush);
    // the two brush handles are sliders for the keyboard: arrows step a year, Shift or Page keys a decade, Home and End the limits
    gBrush.selectAll('.handle').attr('tabindex', 0).attr('role', 'slider').attr('aria-valuemin', YEAR_MIN).attr('aria-valuemax', YEAR_MAX)
      .attr('aria-label', (d) => (d.type === 'w' ? 'Start year' : 'End year'));
    gBrush.on('keydown', (ev) => {
      const h = ev.target.closest && ev.target.closest('.handle'); if (!h) return;
      const west = h.classList.contains('handle--w');
      const big = ev.shiftKey || ev.key === 'PageUp' || ev.key === 'PageDown' ? 10 : 1;
      let d = 0;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' || ev.key === 'PageDown') d = -big;
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'PageUp') d = big;
      else if (ev.key === 'Home') d = west ? YEAR_MIN - state.y0 : state.y0 + 2 - state.y1;
      else if (ev.key === 'End') d = west ? state.y1 - 2 - state.y0 : YEAR_MAX - state.y1;
      else return;
      ev.preventDefault(); ev.stopPropagation();
      let y0 = state.y0, y1 = state.y1;
      if (west) y0 = Math.min(y1 - 2, Math.max(YEAR_MIN, y0 + d)); else y1 = Math.max(y0 + 2, Math.min(YEAR_MAX, y1 + d));
      if (y0 !== state.y0 || y1 !== state.y1) set({ y0, y1 });
    });
    // the thin locator (under 44px) shows no axis and no age labels (style.css hides them): nothing to build
    if (H >= 44) {
    const ticks = x.ticks(W < 500 ? 44 : 60);
    gAxis.attr('transform', `translate(0,${H - 16})`).selectAll('g.t').data(ticks, (d) => d).join((en) => { const g = en.append('g').attr('class', 't'); g.append('line').attr('y2', 3); g.append('text').attr('y', 6).attr('dy', '0.71em').attr('text-anchor', 'middle'); return g; })
      .attr('transform', (d) => `translate(${x(d)},0)`)
      .select('text').text((d) => fmtYear(d)).attr('font-weight', (d) => (x.major(d) ? 500 : 400)).attr('fill', (d) => (x.major(d) ? 'var(--ink-2)' : 'var(--ink-3)'));
    gAxis.selectAll('g.t line').attr('stroke', 'var(--rule-strong)');
    // faint age bands under the histogram, labeled where there is room
    gAges.selectAll('g.age').data(AGES, (d) => d.id).join((en) => { const g = en.append('g').attr('class', 'age'); g.append('rect'); g.append('text'); return g; })
      .each(function (d, i) {
        const g = d3.select(this), a = x(d.start), b = x(Math.min(YEAR_MAX + 1, d.end));
        g.select('rect').attr('x', a).attr('width', Math.max(0, b - a)).attr('y', 2).attr('height', Math.max(0, H - B - 2)).attr('fill', i % 2 ? 'rgba(28,26,23,.035)' : 'transparent');
        g.select('text').attr('x', a + 4).attr('y', 10).attr('font-family', 'Instrument Sans, monospace').attr('font-size', 8.5).attr('letter-spacing', '0.08em').attr('fill', 'rgba(28,26,23,.68)')
          .text(b - a > d.label.length * 5.6 + 8 ? d.label.toUpperCase() : b - a > d.short.length * 5.6 + 8 ? d.short.toUpperCase() : '');
      });
    }
    draw();
    drawMarks();
    drawNow();
  }
  // pins for tour steps and rhyme pairs: [{year, month, color, strong}]
  function drawMarks() {
    const mx = (m) => x(Math.min(YEAR_MAX, Math.max(YEAR_MIN, m.year)) + ((m.month || 6) - 0.5) / 12);
    const g = gMarks.selectAll('g.pin').data(marks).join((en) => { const g = en.append('g').attr('class', 'pin'); g.append('line'); g.append('path'); return g; })
      .attr('transform', (m) => `translate(${mx(m)},0)`);
    g.select('line').attr('y1', 7).attr('y2', H - B).attr('stroke', (m) => m.color || 'var(--ink)').attr('stroke-width', (m) => (m.strong ? 2 : 1.2)).attr('stroke-opacity', (m) => (m.strong ? 1 : m.dim ? 0.3 : 0.8));
    g.select('path').attr('d', (m) => (m.strong ? 'M-5,1H5L0,8Z' : 'M-3.5,2H3.5L0,7Z')).attr('fill', (m) => m.color || 'var(--ink)').attr('fill-opacity', (m) => (m.dim ? 0.45 : 1)).attr('stroke', 'var(--paper)').attr('stroke-width', 1);
  }
  function mark(list) { marks = list || []; drawMarks(); }
  // this week: a pulsing tick where the record ends (its newest fully dated event)
  function drawNow() {
    gNow.selectAll('*').remove();
    const R = recent();
    if (!R.latest) return;
    const px = x(Math.min(YEAR_MAX + 1, R.t));
    const g = gNow.attr('transform', `translate(${px},0)`);
    g.append('line').attr('class', 'tick').attr('y1', 1).attr('y2', H - B);
    g.append('circle').attr('class', 'halo').attr('cy', 4).attr('r', 3.5);
    g.append('circle').attr('class', 'dot').attr('cy', 4).attr('r', 2.2);
    g.append('title').text(`This week: ${R.week.length} new record${R.week.length === 1 ? '' : 's'}, dated up to ${fmtDay(R.latest, { year: 'numeric' })}`);
  }
  function draw() {
    if (!W) return;  // not laid out yet (the first layout waits for idle); layout() draws
    const years = d3.range(YEAR_MIN, YEAR_MAX + 1);
    const ev = db.events.filter((e) => passes(e));
    const m = new Map(years.map((y) => [y, {}]));
    ev.forEach((e) => { const r = m.get(e.year); if (r) r[e.domain] = (r[e.domain] || 0) + 1; });
    const keys = DOMAINS.map((d) => d.id);
    const rows = years.map((y) => ({ y, ...m.get(y) }));
    const st = d3.stack().keys(keys).value((d, k) => d[k] || 0)(rows);
    const max = d3.max(rows, (r) => keys.reduce((a, k) => a + (r[k] || 0), 0)) || 1;
    const yy = d3.scaleSqrt().domain([0, max]).range([H - B, B > 10 ? 12 : 3]);
    // one path per domain layer (14 nodes) instead of a rect per year and domain (13,000 nodes): the same bars, each
    // a closed subpath, and the histogram draws in a few milliseconds on a phone
    const bars = (layer) => { let d = ''; for (const p of layer) { const h = yy(p[0]) - yy(p[1]); if (h <= 0) continue; const x0 = x(p.data.y), w = Math.max(0.5, x(p.data.y + 1) - x0 - 0.3); d += `M${x0.toFixed(1)},${yy(p[1]).toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}z`; } return d; };
    gHist.selectAll('path').data(st, (d) => d.key).join('path').attr('data-k', (d) => d.key).attr('d', bars);
  }
  function setRange() {
    if (!W) return;  // not laid out (hidden): layout() sets the range when History opens
    silent = true;
    if (state.y0 === YEAR_MIN && state.y1 === YEAR_MAX) { gBrush.call(brush.move, null); winLabel(null); }
    else { const sel = [x(state.y0), x(state.y1 + 1)]; gBrush.call(brush.move, sel); winLabel(sel); }
    gBrush.select('.handle--w').attr('aria-valuenow', state.y0).attr('aria-valuetext', `from ${state.y0}`);
    gBrush.select('.handle--e').attr('aria-valuenow', state.y1).attr('aria-valuetext', `to ${state.y1}`);
    silent = false;
    d3.select('#rng').html(state.y0 === YEAR_MIN && state.y1 === YEAR_MAX ? `${fmtYear(YEAR_MIN)} to ${YEAR_MAX}` : `<button type="button" title="Reset the years">${fmtYear(state.y0)} to ${fmtYear(state.y1)}</button>`);
  }
  d3.select('#rng').on('click', (ev) => { if (ev.target.closest('button')) set({ y0: YEAR_MIN, y1: YEAR_MAX }); });
  // compact strip: expands while hovered or focused, then settles back
  let hoverT = null;
  const expand = (on) => {
    clearTimeout(hoverT);
    if (!footer.classList.contains('compact')) return;
    if (on) { footer.classList.add('expanded'); }
    else hoverT = setTimeout(() => { if (!footer.matches(':focus-within')) footer.classList.remove('expanded'); }, 260);
  };
  footer.addEventListener('mouseenter', () => expand(true));
  footer.addEventListener('mouseleave', () => expand(false));
  footer.addEventListener('focusin', () => expand(true));
  footer.addEventListener('focusout', () => expand(false));
  // only the strip's own height transition relays out; under reduced motion every descendant fires transitionend
  // (the 0.01ms rule applies to all properties) and relaying those would redraw in a loop
  footer.addEventListener('transitionend', (ev) => { if (ev.target === footer && ev.propertyName === 'height') { layout(); setRange(); } });
  scrub = { layout, draw, setRange, mark };
  // the first layout waits for an idle moment after the first view (the mobile gate: the boot has no task over 200 ms);
  // main.js lays the locator out again when History opens, so a hidden scrubber costs nothing at boot
  const first = () => { layout(); setRange(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(first, { timeout: 3000 }); else setTimeout(first, 300);
  return scrub;
}

// Scrubber pins grouped by owner ('tour', 'rhyme') so features do not clear each other.
const pinSets = new Map();
export function scrubMark(owner, list) {
  if (list && list.length) pinSets.set(owner, list); else pinSets.delete(owner);
  if (scrub) scrub.mark([...pinSets.values()].flat());
}

// Roving tabindex for chart marks: one Tab stop per SVG, arrows (and Home/End) move between its marks. Views call it once
// on their root; a MutationObserver keeps redrawn marks in the scheme (idempotent, so it settles after one frame).
export function roving(root, selector = 'svg [role="button"]') {
  const groups = () => {
    const m = new Map();
    for (const n of root.querySelectorAll(selector)) { const k = n.closest('svg') || root; if (!m.has(k)) m.set(k, []); m.get(k).push(n); }
    return m;
  };
  let raf = 0;
  const apply = () => {
    raf = 0;
    for (const [, list] of groups()) {
      const cur = list.find((n) => n === document.activeElement) || list.find((n) => n.dataset.rvCur === '1') || list[0];
      for (const n of list) {
        const t = n === cur ? '0' : '-1';
        if (n.getAttribute('tabindex') !== t) n.setAttribute('tabindex', t);
        if (n === cur) n.dataset.rvCur = '1'; else if (n.dataset.rvCur) delete n.dataset.rvCur;
      }
    }
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex'] });
  root.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const n = ev.target.closest && ev.target.closest(selector); if (!n) return;
    const list = (groups().get(n.closest('svg') || root) || []).filter((x) => x === n || x.getBoundingClientRect().width > 0);
    const i = list.indexOf(n); if (i < 0) return;
    let j = i;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = Math.min(list.length - 1, i + 1);
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = list.length - 1;
    else return;
    ev.preventDefault(); ev.stopPropagation();
    const t = list[j]; if (t === n) return;
    delete n.dataset.rvCur; n.setAttribute('tabindex', '-1'); t.dataset.rvCur = '1'; t.setAttribute('tabindex', '0'); t.focus();
  });
  root.addEventListener('focusin', (ev) => { if (ev.target.closest && ev.target.closest(selector)) schedule(); });
  schedule();
}

