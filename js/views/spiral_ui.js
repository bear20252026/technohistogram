// THE HISTOMAP, interaction layer (SPIRAL_SPEC.md, UI section; SPIRAL_DIRECTION.md items 4 and 6). spiral.js draws
// the spiral and owns the pointer stream; this module owns the DOM around its canvases in the indigo world: the filter
// strip (13 domain chips in their own hue, counts inside, hover lights the domain, click toggles, alt-click solos; types
// and regions behind one "More" control that opens as a glass sheet), the selected entity with its flare and its chords
// drawn in time order, the hover tip through the shared tip, click to record, the keyboard, the status sentence, the
// Millennium and Replay buttons, the phone sheet and bottom card, and the arrival selection once the spiral is born.
// Mounted by spiral.js: mountUI(el, api), api = the named exports of spiral.js plus { db, select, tip }.
// Part 2 (SPIRAL_DIRECTION.md): journeys from data/journeys.json flown stop to stop with a glass caption; the record
// panel's linked records named by the association the data carries; an event's rhymes (rhymes.json) ringed across the centuries in sequence;
// the status following the camera; the arrival on this month's newest event; the phone card following the focused year.
// Nothing hand-picked: every count is a filter over db.events; the arrival pick is the newest event of this month.
import { db, passes, census, ensure, onData, fmtDate } from '../data.js';
import { state, set, subscribe } from '../store.js';
import { DOMAINS, DOMAIN, TYPES, TYPE, prettyTag, domainColor } from '../palette.js';
import { REGIONS, REGION } from '../time.js';
import { esc, select as openRecord, tip as sharedTip, PHONE } from '../ui.js';

const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const ALL_DOMAINS = DOMAINS.map((d) => d.id);
const ALL_TYPES = TYPES.map((t) => t.id);
const ALL_REGIONS = REGIONS.map((r) => r.id);
const TYPE_ORDER = ['invention', 'discovery', 'product', 'policy', 'fear', 'failure', 'incident', 'hope', 'concept', 'culture', 'milestone', 'market', 'era', 'person'];
const isEvent = (e) => e.kind !== 'overlay';
const KIND_LABEL = { who: 'Person', person: 'Person', org: 'Organization', tag: 'Thread', policy: 'Policy', bench: 'Benchmark', deal: 'Deal', event: 'Event', thread: 'Thread' };
const MAX_CHORDS = 600;
// arrive and settle (AESTHETIC_SYSTEMS.md motion grammar): ease-out expo, cubic-bezier(.16,1,.3,1)
const settle = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const FLARE_MS = 300, CHORD_MS = 520, DRAW_MS = 2600;
const LEG_MS = 2400, STOP_MS = 4000, WORD_MS = 60, RHYME_GAP = 400, RHYME_MS = 900;
// under prefers-reduced-motion every overlay stands still: no flare, no chord growth, no ring pulse, no frame loop of ours
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RHYME_INK = '#f3d9a4';   // the rhyme ring: a warm light apart from the white chords
const num = (n) => `<span class="num">${esc(String(n))}</span>`;

// The page's own hover note: domain, type, date, place, title and the count of links. No instruction text.
function eventTip(e) {
  const d = DOMAIN[e.domain];
  const links = (e.connects ? e.connects.length : 0) + ((db.in.get(e.id) || []).length);
  const where = e.region && REGION[e.region] ? ` &middot; ${esc(REGION[e.region].label)}` : '';
  return `<div class="k"><i style="background:${domainColor(e.domain)}"></i>${esc(d ? d.short : e.domain)} &middot; ${esc(e.type || '')} &middot; ${esc(fmtDate(e))}${where}</div>
  <div class="h">${esc(e.title)}</div>${links ? `<div class="m">${links === 1 ? 'connected to 1 record' : `connected to ${links} records`}</div>` : ''}`;
}

export function mountUI(el, api) {
  const { setFilter, onFrame, onLayout, onHover, onClick, toScreen, project, nearestCell, markOf, drawMark } = api;
  const baseTip = api.tip || sharedTip;
  const onPage = () => (api.pageWeight ? api.pageWeight() >= 0.5 : false);
  // on the year page the tip would cover cards, so it docks above the status row; elsewhere it follows the pointer
  const tip = {
    show(ev, html) {
      baseTip.show(ev, html);
      const t = document.getElementById('tip'); if (!t) return;
      if (onPage()) {
        const f = el.querySelector('.sp-foot').getBoundingClientRect();
        t.classList.add('dock');
        t.style.left = `${Math.round(f.left)}px`;
        t.style.top = `${Math.round(f.top - t.offsetHeight - 10)}px`;
      } else t.classList.remove('dock');
    },
    hide() { baseTip.hide(); const t = document.getElementById('tip'); if (t) t.classList.remove('dock'); },
  };
  const select = api.select || openRecord;
  const subs = [];
  // a cell's screen point: the builder's screenOf at any depth (the straightened page included), else the spiral point
  const P = (c) => {
    if (api.screenOf) { const r = api.screenOf(c); if (r) return { x: r.x + (r.w || 0) / 2, y: r.y + (r.h || 0) / 2 }; }
    return toScreen(c.x, c.y);
  };
  const hue = (d, step = 3) => (api.familyColor ? api.familyColor(d, step) : `var(--sp-${d}-${step}, var(--in-${d}))`);

  /* ---------- DOM ---------- */
  const ui = document.createElement('div');
  ui.className = 'sp-ui';
  ui.innerHTML = `
    <button type="button" class="sp-filterbtn" aria-expanded="false" aria-controls="sp-strip">Filter</button>
    <div class="sp-strip" id="sp-strip" role="group" aria-label="Filters">
      <div class="sp-lead">
        <div class="sp-doms" role="group" aria-label="Domains"></div>
        <button type="button" class="sp-more" aria-expanded="false" aria-controls="sp-sheet">More</button>
        <button type="button" class="sp-journeys" aria-expanded="false" aria-controls="sp-jlist" hidden>Journeys</button>
      </div>
      <div class="sp-tail">
        <div class="sp-jchip" hidden></div>
        <div class="sp-ent" hidden></div>
        <button type="button" class="sp-sheetclose" aria-label="Close filters">Close</button>
      </div>
      <div class="sp-sheet" id="sp-sheet" hidden>
        <div class="sp-row sp-types" role="group" aria-label="Types"></div>
        <div class="sp-row sp-regs" role="group" aria-label="Regions"></div>
      </div>
      <div class="sp-jlist" id="sp-jlist" role="group" aria-label="Journeys" hidden></div>
    </div>
    <div class="sp-jcap" hidden></div>
    <div class="sp-rail" role="slider" tabindex="0" aria-label="Year" aria-valuemin="1026" aria-valuemax="2026" aria-valuenow="2026"><div class="sp-ticks"><div class="sp-lit"></div></div><div class="sp-knob"><span>2026</span></div></div>
    <div class="sp-foot">
      <p class="sp-status" aria-live="polite"><span class="sp-census"></span><span class="sp-span" hidden></span></p>
      <div class="sp-btns"><button type="button" class="sp-reset" hidden>Millennium</button><button type="button" class="sp-replay" hidden>Replay</button></div>
    </div>
    <div class="sp-card" hidden></div>`;
  el.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const stripEl = $('.sp-strip'), domsEl = $('.sp-doms'), typesEl = $('.sp-types'), regsEl = $('.sp-regs'), entEl = $('.sp-ent');
  const sheetEl = $('.sp-sheet'), moreBtn = $('.sp-more'), filterBtn = $('.sp-filterbtn');
  const censusEl = $('.sp-census'), spanEl = $('.sp-span'), resetBtn = $('.sp-reset'), replayBtn = $('.sp-replay'), cardEl = $('.sp-card');
  const statusEl = $('.sp-status'), jBtn = $('.sp-journeys'), jlistEl = $('.sp-jlist'), jchipEl = $('.sp-jchip'), jcapEl = $('.sp-jcap');

  /* ---------- local state ---------- */
  let regions = null;            // Set of region ids, or null = all (local to the map; the shell has no region key)
  let ent = null;                // the lit entity: { kind, label, ids:Set, chords:[[a,b,strong]], anchor }
  let hot = null;                // the domain under the pointer in the strip
  let cellById = new Map();
  let hoverCell = null, cardCell = null;
  let cursor = null;             // keyboard cursor { year, lane }
  let lastSpan = '';
  let filterTick = 0;
  let anim = null;               // the chord animation { t0, chords, raf }
  let animKey = '';
  let journeys = [], journey = null;   // journeys from the data; the one under way { j, stops, i, paused, flying, legT0, token, timer, raf }
  let rhyme = null;              // the selected event's rhymes { ids, t0, key, raf }
  let focus = null;              // what the camera is on: { year, month, depth } from the builder, or read from the screen
  let opening = null;            // the status's opening focus (this month) until the camera moves

  const indexCells = () => { cellById = new Map(); for (const c of api.cells || []) cellById.set(c.id, c); };
  indexCells();

  /* ---------- the filter and the counts ---------- */
  const domSet = () => (state.domains && state.domains.size < ALL_DOMAINS.length ? state.domains : null);
  const typeSet = () => (state.types && state.types.size && state.types.size < ALL_TYPES.length ? state.types : null);
  const regSet = () => (regions && regions.size && regions.size < ALL_REGIONS.length ? regions : null);
  const inLit = (e) => !ent || ent.ids.has(e.id);

  function counts() {
    const dom = Object.fromEntries(ALL_DOMAINS.map((d) => [d, 0]));
    const typ = Object.fromEntries(ALL_TYPES.map((t) => [t, 0]));
    const reg = Object.fromEntries(ALL_REGIONS.map((r) => [r, 0]));
    let total = 0, visible = 0;
    const ds = domSet(), ts = typeSet(), rs = regSet();
    const open = { ...state, domains: new Set(ALL_DOMAINS), types: null };
    for (const e of db.events) {
      if (!isEvent(e)) continue;
      total++;
      // each row counts under every constraint but its own, so a chip reads what it would show
      const okD = !ds || ds.has(e.domain), okT = !ts || ts.has(e.type), okR = !rs || rs.has(e.region);
      const okQ = (!state.thread && !state.q) || passes(e, open);
      // chips read the record, never the selection's linked set; a selection shows its count in the entity pill alone
      if (okT && okR && okQ) dom[e.domain] = (dom[e.domain] || 0) + 1;
      if (okD && okR && okQ && typ[e.type] != null) typ[e.type]++;
      if (okD && okT && okQ && reg[e.region] != null) reg[e.region]++;
      if (okD && okT && okR && okQ) visible++;
    }
    return { dom, typ, reg, total, visible };
  }

  function pushFilter() {
    let ids = ent ? ent.ids : null;
    if (journey) ids = new Set([...(ids || []), ...journey.stops.map((x) => x.id)]);
    if (state.q || (state.thread && !ent)) {
      const open = { ...state, domains: new Set(ALL_DOMAINS), types: null };
      ids = new Set();
      for (const e of db.events) if (isEvent(e) && passes(e, open) && (!ent || ent.ids.has(e.id))) ids.add(e.id);
    }
    // a selection leaves the cloth awake (the flare and chords carry the emphasis); a chip filter puts the rest further back
    setFilter({ domains: domSet(), types: typeSet(), regions: regSet(), ids, hot: hot ? new Set([hot]) : null, mode: 'dim', dim: ids ? 0.55 : 0.3 });
  }
  function apply() {
    if (filterTick) return;
    filterTick = requestAnimationFrame(() => {
      filterTick = 0;
      ent = resolveEntity();
      pushFilter();
      renderChips();
      renderEntity();
      startChords();
      startRhymes();
      decoratePanel();
    });
  }

  /* ---------- chips ---------- */
  const glyphCache = new Map();
  function glyph(type) {
    if (glyphCache.has(type)) return glyphCache.get(type);
    const c = document.createElement('canvas');
    const s = 12, dpr = Math.min(3, devicePixelRatio || 1);
    c.width = s * dpr; c.height = s * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#eef0fa'; g.strokeStyle = '#eef0fa'; g.lineWidth = 1.3;
    const shape = markOf ? markOf(type) : 'circle';
    g.beginPath();
    if (drawMark) drawMark(g, shape, s / 2, s / 2, shape === 'ring' ? 3.6 : 4); else g.arc(s / 2, s / 2, 4, 0, Math.PI * 2);
    if (shape === 'ring') g.stroke(); else g.fill();
    const url = c.toDataURL();
    glyphCache.set(type, url);
    return url;
  }
  const chip = (k, id, label, n, on, lead = '', style = '') =>
    `<button type="button" class="sp-chip${on ? '' : ' off'}${n === 0 ? ' none' : ''}" data-k="${k}" data-id="${esc(id)}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${esc(label)}, ${fmtN(n)}"${style ? ` style="${style}"` : ''}>${lead}<span class="l">${esc(label)}</span>${num(fmtN(n))}</button>`;
  let lastCounts = null;
  function renderChips() {
    const C = counts();
    lastCounts = C;
    const ds = domSet(), ts = typeSet(), rs = regSet();
    domsEl.innerHTML = DOMAINS.map((d) => chip('dom', d.id, d.short, C.dom[d.id], !ds || ds.has(d.id), '', `--c:${hue(d.id, 3)};--c2:${hue(d.id, 2)}`)).join('');
    typesEl.innerHTML = TYPE_ORDER.filter((t) => TYPE[t]).map((t) => chip('type', t, TYPE[t].label, C.typ[t], !ts || ts.has(t), `<img class="gl" alt="" src="${glyph(t)}" width="12" height="12">`)).join('');
    regsEl.innerHTML = REGIONS.map((r) => chip('reg', r.id, r.short, C.reg[r.id], !rs || rs.has(r.id))).join('');
    const narrowed = !!(ts || rs);
    moreBtn.classList.toggle('live', narrowed);
    renderStatus(C);
  }
  // click toggles one chip; alt-click (or a long press on touch) keeps only it; an empty set springs back to all
  function toggle(k, id, solo) {
    const all = k === 'dom' ? ALL_DOMAINS : k === 'type' ? ALL_TYPES : ALL_REGIONS;
    const cur = k === 'dom' ? state.domains : k === 'type' ? state.types : regions;
    let next = new Set(cur && cur.size ? cur : all);
    if (solo) next = next.size === 1 && next.has(id) ? new Set(all) : new Set([id]);
    else if (next.has(id)) next.delete(id); else next.add(id);
    if (!next.size) next = new Set(all);
    if (k === 'dom') set({ domains: next });
    else if (k === 'type') set({ types: next.size === all.length ? null : next });
    else { regions = next.size === all.length ? null : next; apply(); }
  }
  let pressTimer = 0, pressed = false;
  stripEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.sp-chip'); if (!b) return;
    if (pressed) { pressed = false; return; }
    toggle(b.dataset.k, b.dataset.id, ev.altKey || ev.metaKey);
  });
  stripEl.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('.sp-chip'); if (!b || ev.pointerType === 'mouse') return; pressTimer = setTimeout(() => { pressed = true; toggle(b.dataset.k, b.dataset.id, true); }, 520); });
  stripEl.addEventListener('pointerup', () => clearTimeout(pressTimer));
  stripEl.addEventListener('pointercancel', () => clearTimeout(pressTimer));
  stripEl.addEventListener('keydown', (ev) => { const b = ev.target.closest('.sp-chip'); if (b && (ev.key === 'Enter' || ev.key === ' ') && ev.altKey) { ev.preventDefault(); toggle(b.dataset.k, b.dataset.id, true); } });
  // hover lights the domain across the spiral
  const setHot = (d) => { if (d === hot) return; hot = d; pushFilter(); };
  domsEl.addEventListener('pointerover', (ev) => { const b = ev.target.closest('.sp-chip'); if (b && ev.pointerType !== 'touch') setHot(b.dataset.id); });
  domsEl.addEventListener('pointerleave', () => setHot(null));
  domsEl.addEventListener('focusin', (ev) => { const b = ev.target.closest('.sp-chip'); if (b) setHot(b.dataset.id); });
  domsEl.addEventListener('focusout', (ev) => { if (!domsEl.contains(ev.relatedTarget)) setHot(null); });

  /* ---------- the More sheet (types and regions) ---------- */
  const showSheet = (open) => { sheetEl.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open)); moreBtn.classList.toggle('open', open); };
  moreBtn.addEventListener('click', () => showSheet(sheetEl.hidden));

  /* ---------- the selected entity: lit events and chords ---------- */
  const linksOf = (id) => (db.links && db.links.events && db.links.events[id]) || null;
  const LINK_KEYS = ['th', 'dl', 'po', 'bm'];
  function linkedTo(e) {
    const out = new Set(e.connects || []);
    for (const id of db.in.get(e.id) || []) out.add(id);
    const L = linksOf(e.id);
    if (L && db.links) {
      const want = new Map(LINK_KEYS.map((k) => [k, new Set(L[k] || [])]));
      if ([...want.values()].some((s) => s.size)) {
        for (const [oid, M] of Object.entries(db.links.events)) {
          if (oid === e.id || !db.byId.has(oid)) continue;
          for (const k of LINK_KEYS) { const s = want.get(k); if (s.size && (M[k] || []).some((x) => s.has(x))) { out.add(oid); break; } }
        }
      }
    }
    out.delete(e.id);
    return out;
  }
  // the same links, kept by kind, so the panel can name each association for what the compilers tied: a thread
  // step (tours.json), a shared deal party within two years (capital_flows.json), a rule or benchmark that names
  // both records, a model scored on the benchmark, a pattern pairing (rhymes.json), or a connects entry
  const KIND_HEAD = {
    th: ['Step of the same thread', 'Steps of the same thread'],
    dl: ['Names a party to a deal, within two years', 'Names a party to a deal, within two years'],
    po: ['Named by the same rule', 'Named by the same rules'],
    bm: ['Named by the same benchmark', 'Named by the same benchmarks'],
    bmm: ['Model scored on the same benchmark', 'Model scored on the same benchmarks'],
    rh: ['Paired in a pattern', 'Paired in a pattern'],
    cx: ['Connected record', 'Connected records'],
  };
  function linkKinds(e) {
    const out = new Map();   // id -> { kinds: Set, notes: { kind: name } }
    const add = (id, kind, note) => { if (id === e.id || !db.byId.has(id)) return; let r = out.get(id); if (!r) { r = { kinds: new Set(), notes: {} }; out.set(id, r); } r.kinds.add(kind); if (note && !r.notes[kind]) r.notes[kind] = note; };
    for (const id of e.connects || []) add(id, 'cx');
    for (const id of db.in.get(e.id) || []) add(id, 'cx');
    const L = linksOf(e.id), names = (db.links && db.links.names) || {};
    if (L && db.links) {
      const want = new Map(LINK_KEYS.map((k) => [k, new Set(L[k] || [])]));
      if ([...want.values()].some((x) => x.size)) {
        for (const [oid, M] of Object.entries(db.links.events)) {
          if (oid === e.id || !db.byId.has(oid)) continue;
          for (const k of LINK_KEYS) {
            const w = want.get(k); if (!w.size) continue;
            const hit = (M[k] || []).find((x) => w.has(x)); if (!hit) continue;
            const name = (names[k] || {})[hit] || hit;
            const mine = (L.basis || {})[`${k}:${hit}`] || '', theirs = (M.basis || {})[`${k}:${hit}`] || '';
            if (k === 'dl') add(oid, k, `${theirs || mine || 'same organization'}, ${name}`);
            else if (k === 'bm') { const model = /^model named in the event: (.+)$/.exec(theirs); add(oid, /^model named/.test(mine) ? 'bmm' : 'bm', model ? `${name}, ${model[1]}` : name); }
            else add(oid, k, name);
          }
        }
      }
    }
    for (const r of db.rhymes || []) {
      const then = (r.then && r.then.event_ids) || [], now = (r.now && r.now.event_ids) || [];
      if (then.includes(e.id)) for (const id of now) add(id, 'rh', r.title || r.id || 'pattern');
      if (now.includes(e.id)) for (const id of then) add(id, 'rh', r.title || r.id || 'pattern');
    }
    return out;
  }
  const byLink = (key, val) => { const ids = new Set(); if (!db.links) return ids; for (const [id, M] of Object.entries(db.links.events)) if ((M[key] || []).includes(val) && db.byId.has(id)) ids.add(id); return ids; };
  const byField = (field, name) => { const ids = new Set(); const low = name.toLowerCase(); for (const e of db.events) if (isEvent(e) && (e[field] || []).some((x) => x === name || String(x).toLowerCase() === low)) ids.add(e.id); return ids; };
  function resolveEntity() {
    const sel = state.sel || '';
    let kind = '', label = '', ids = null, anchor = null;
    if (sel && db.byId.has(sel)) {
      anchor = db.byId.get(sel); kind = 'event'; label = anchor.title_short || anchor.title;
      ids = linkedTo(anchor); ids.add(sel);
    } else if (sel.includes(':')) {
      const i = sel.indexOf(':'), pre = sel.slice(0, i), rest = sel.slice(i + 1);
      if (pre === 'who') { kind = 'who'; label = rest; ids = byField('people', rest); }
      else if (pre === 'org') { kind = 'org'; label = rest; ids = byField('orgs', rest); }
      else if (pre === 'tag') { kind = 'tag'; label = prettyTag(rest); ids = byField('tags', rest); }
      else if (pre === 'person') { const p = db.personById && db.personById.get(sel); if (!p) { ensure('talent'); return null; } kind = 'person'; label = p.name; ids = byField('people', p.name); }
      else if (pre === 'policy') { kind = 'policy'; label = (db.links && db.links.names.po && db.links.names.po[rest]) || rest; ids = byLink('po', rest); }
      else if (pre === 'bench') { const key = rest.split(':')[0]; kind = 'bench'; label = (db.links && db.links.names.bm && db.links.names.bm[key]) || key; ids = byLink('bm', key); }
      else if (pre === 'deal') { kind = 'deal'; label = (db.links && db.links.names.dl && db.links.names.dl[rest]) || rest; ids = byLink('dl', rest); }
    }
    if (!ids && state.thread) { kind = 'thread'; label = prettyTag(state.thread); ids = byField('tags', state.thread); }
    if (!ids || !ids.size) return null;
    return { kind, label, ids, anchor, chords: chordsFor(ids, anchor) };
  }
  // chords in time order: an event's record to each of its links; an entity's events joined as they happen and
  // wherever two of them cite each other
  function chordsFor(ids, anchor) {
    const T = (id) => (db.byId.get(id) || {}).t || 0;
    let out = [];
    if (anchor) { for (const id of ids) if (id !== anchor.id) out.push([anchor.id, id, 1]); }
    else {
      const evs = [...ids].map((id) => db.byId.get(id)).filter(Boolean).sort((a, b) => a.t - b.t);
      for (let i = 1; i < evs.length; i++) out.push([evs[i - 1].id, evs[i].id, 0]);
      const seen = new Set(out.map((c) => c[0] + '|' + c[1]));
      for (const e of evs) for (const c of e.connects || []) if (ids.has(c) && !seen.has(e.id + '|' + c) && !seen.has(c + '|' + e.id)) { out.push([e.id, c, 1]); seen.add(e.id + '|' + c); }
    }
    out.sort((a, b) => Math.max(T(a[0]), T(a[1])) - Math.max(T(b[0]), T(b[1])));
    return out.slice(0, MAX_CHORDS);
  }
  function renderEntity() {
    if (!ent) { entEl.hidden = true; entEl.innerHTML = ''; return; }
    const n = ent.ids.size;
    const what = ent.anchor ? `linked to ${num(fmtN(n - 1))} record${n - 1 === 1 ? '' : 's'}` : `${num(fmtN(n))} event${n === 1 ? '' : 's'}`;
    entEl.innerHTML = `<button type="button" class="name" aria-label="${esc(KIND_LABEL[ent.kind] || 'Selected')}: ${esc(ent.label)}">${esc(ent.label)}</button><span class="n">${what}</span><button type="button" class="x" aria-label="Clear selection">&times;</button>`;
    entEl.hidden = false;
  }
  function frameEntity() {
    if (!ent) return;
    const pts = [...ent.ids].map((id) => cellById.get(id)).filter(Boolean);
    if (!pts.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of pts) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
    const w = el.clientWidth, h = el.clientHeight;
    const openW = PHONE() ? w : w * 0.66;
    const k = Math.max(1, Math.min(12, 0.7 * Math.min(openW / Math.max(8, x1 - x0), h / Math.max(8, y1 - y0))));
    const shift = PHONE() ? 0 : (w / 2 + ((api.geo && api.geo.ox) || 0)) - openW / 2;
    const cx = (x0 + x1) / 2 + shift / k, cy = (y0 + y1) / 2;
    if (k <= 1.02) { if (api.resetCamera) api.resetCamera({ animate: true }); return; }
    api.setCamera({ cx, cy, k }, { animate: true });
  }
  entEl.addEventListener('click', (ev) => {
    if (ev.target.closest('.x')) { if (state.sel) select(''); else if (state.thread) set({ thread: '' }); return; }
    if (ev.target.closest('.name')) { if (!openHeld()) frameEntity(); }
  });

  /* ---------- links are light: the flare, then the chords in time order, then the hold ---------- */
  function startChords() {
    const key = ent ? `${state.sel}|${state.thread}|${ent.ids.size}` : '';
    if (key === animKey) return;
    animKey = key;
    if (anim && anim.raf) cancelAnimationFrame(anim.raf);
    anim = null;
    if (!ent) { api.redraw(); return; }
    anim = { t0: performance.now(), raf: 0, reduced: REDUCED() };
    if (anim.reduced) { api.redraw(); return; }
    const loop = () => { anim.raf = 0; api.redraw(); const age = performance.now() - anim.t0; if (age < FLARE_MS + DRAW_MS + CHORD_MS + 200) anim.raf = requestAnimationFrame(loop); else anim.raf = 0; };
    anim.raf = requestAnimationFrame(loop);
  }
  const ink = () => getComputedStyle(el).getPropertyValue('--sp-ink').trim() || '#eef0fa';
  // a point on the quadratic a-c-b at u, so a chord can grow from its older end
  const qpt = (a, c, b, u) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y });
  // motion: the camera's speed per frame, so the status and tip know flight from rest
  const motion = { t: 0, year: null, k: null, moving: false, calm: 0, timer: 0 };
  let pointer = null;
  el.addEventListener('pointermove', (ev) => { pointer = { x: ev.clientX, y: ev.clientY }; }, { passive: true });
  el.addEventListener('pointerleave', () => { pointer = null; });
  function readMotion(cam, view) {
    const now = performance.now();
    if (!cam || motion.year == null) { motion.t = now; motion.year = cam ? cam.year : 0; motion.k = cam ? cam.k : 1; return; }
    const dt = Math.max(1, now - motion.t) / 1000;
    const span = view && view.y0 != null ? Math.max(0.5, Math.abs(view.y1 - view.y0)) : 1000;
    const vy = Math.abs(cam.year - motion.year) / dt / span, vk = Math.abs(Math.log(Math.max(1e-6, cam.k / Math.max(1e-6, motion.k)))) / dt;
    motion.t = now; motion.year = cam.year; motion.k = cam.k;
    const vAbs = api.velocity ? Math.abs(api.velocity()) : Math.abs(cam.year - motion.year) / dt;
    const fast = vy > 0.12 || vAbs > 3 || vk > 0.25;
    if (fast) {
      motion.calm = 0; if (!motion.moving) { motion.moving = true; if (!PHONE()) tip.hide(); }
      clearTimeout(motion.timer); motion.timer = setTimeout(() => api.redraw(), 180);   // a frame after the glide ends, so rest is noticed
    }
    else if (motion.moving) {
      motion.calm += dt * 1000;
      if (motion.calm > 140) {
        motion.moving = false;
        if (pointer && !PHONE() && api.hitTest) {
          const r = el.getBoundingClientRect(), c = api.hitTest(pointer.x - r.left, pointer.y - r.top);
          hoverCell = c || null;
          if (c) tip.show({ clientX: pointer.x, clientY: pointer.y }, eventTip(c.e));
        }
      }
    }
  }
  let lastView = null;
  function drawOverlay(ctx, cam, view) {
    if (view) lastView = view;
    readMotion(cam, view);
    if (view) renderSpan(view, cam);
    if (ent && ent.chords.length) {
      const age = anim ? performance.now() - anim.t0 : Infinity;
      const instant = !anim || anim.reduced || REDUCED();
      const c0 = toScreen(0, 0);
      const N = ent.chords.length;
      const T = (id) => (db.byId.get(id) || {}).t || 0;
      ctx.save();
      ctx.lineCap = 'round';
      // on the year page: a ring on each lit card and nothing else, so the cards read
      if (api.pageWeight && api.pageWeight() >= 0.5 && api.screenOf) {
        const vw = view && view.w ? view.w : el.clientWidth, vh = view && view.h ? view.h : el.clientHeight;
        const rect = api.cardRect || api.screenOf;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.75;
        for (const id of ent.ids) {
          const r = rect(id); if (!r || !r.w) continue;
          if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > vw || r.y > vh) continue;
          const x = r.x - 2.5, y = r.y - 2.5, w = r.w + 5, h = r.h + 5, rad = 6;
          ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
        drawJourney(ctx); drawRhymes(ctx);
        return;
      }
      // the flare: a 300ms bloom on every lit cell
      if (!instant && age < FLARE_MS + 200) {
        const f = Math.min(1, age / FLARE_MS), fade = age < FLARE_MS ? 1 : 1 - (age - FLARE_MS) / 200;
        for (const id of ent.ids) {
          const c = cellById.get(id); if (!c) continue;
          const p = P(c), r = 4 + 22 * settle(f);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,255,255,${0.75 * fade})`); g.addColorStop(0.4, `rgba(255,255,255,${0.25 * fade})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      // the chords: each starts in time order, the whole set over DRAW_MS, each one arriving and settling
      const span = Math.max(1, N - 1);
      const pw = api.pageWeight ? api.pageWeight() : 0;
      const crowd = Math.min(1, Math.sqrt(24 / Math.max(24, N)));   // a hub of hundreds of links stays light at the shared end
      for (let i = 0; i < N; i++) {
        const [a0, b0, strong] = ent.chords[i];
        const a = T(a0) <= T(b0) ? a0 : b0, b = a === a0 ? b0 : a0;    // draw from the older end
        const ca = cellById.get(a), cb = cellById.get(b);
        if (!ca || !cb) continue;
        let u = 1;
        if (!instant) {
          const start = FLARE_MS + (i / span) * DRAW_MS;
          u = settle((age - start) / CHORD_MS);
          if (u <= 0) continue;
        }
        const p = P(ca), q = P(cb);
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const bend = 0.45 * Math.min(1, Math.hypot(q.x - p.x, q.y - p.y) / 320);
        const c = { x: mx + (c0.x - mx) * bend, y: my + (c0.y - my) * bend };
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        if (u >= 1) ctx.quadraticCurveTo(c.x, c.y, q.x, q.y);
        else { const steps = 14; for (let s = 1; s <= steps; s++) { const pt = qpt(p, c, q, (s / steps) * u); ctx.lineTo(pt.x, pt.y); } }
        const head = u < 1 ? 1 - u : 0;
        ctx.strokeStyle = strong ? '#ffffff' : ink();
        ctx.globalAlpha = ((strong ? 0.6 : 0.42) * crowd) + 0.35 * head;
        ctx.lineWidth = (strong ? 1.1 : 0.8) * (0.6 + 0.4 * crowd) + 0.8 * head;
        ctx.stroke();
        if (u < 1) { const tipPt = qpt(p, c, q, u); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tipPt.x, tipPt.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
    drawJourney(ctx);
    drawRhymes(ctx);
    if (cursor && project) {
      const m = project(cursor.year, cursor.lane, 0), p = P(m);
      ctx.save();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x - 7, p.y); ctx.moveTo(p.x + 7, p.y); ctx.lineTo(p.x + 11, p.y); ctx.stroke();
      ctx.restore();
    }
  }
  subs.push(onFrame(drawOverlay));
  subs.push(onLayout(() => { indexCells(); apply(); }));

  /* ---------- status: one plain sentence ---------- */
  function renderStatus(C = lastCounts) {
    const c = census();
    const n = C ? C.visible : null;
    const filtered = n != null && n !== c.events;
    censusEl.innerHTML = filtered
      ? `${num(fmtN(n))} of ${num(fmtN(c.events))} events, 3.3 million BCE to 2026`
      : `${num(fmtN(c.events))} events, 3.3 million BCE to 2026${c.partial ? ', the earlier centuries still arriving' : ''}`;
  }
  function spanOf(view) {
    const w = view.w || el.clientWidth, h = view.h || el.clientHeight;
    if (!api.unproject) return { y0: view.y0, y1: view.y1, n: view.n };
    const c = api.unproject(w / 2 + ((api.geo && api.geo.ox) || 0), h / 2 + ((api.geo && api.geo.oy) || 0));
    const mid = Math.min(2026, Math.max(1026, c.year || 1026));
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const u = api.unproject((w * i) / 8, (h * j) / 8);
      if (u.lane < 0 || Math.abs(u.year - mid) > 50) continue;
      lo = Math.min(lo, u.year); hi = Math.max(hi, u.year);
    }
    if (lo === Infinity) lo = hi = mid;
    lo = Math.max(1026, Math.floor(lo)); hi = Math.min(2026, Math.ceil(hi));
    let n = 0;
    const seen = [];
    for (const cell of api.cells || []) {
      if (cell.on === false) continue;
      const s = P(cell);
      if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
      seen.push(cell);
      if (cell.t >= lo && cell.t <= hi + 1) n++;
    }
    if (n === 0 && seen.length) {
      // The screen centre sits in the hole of the ring (an entity framed beside the record panel): read the years from what is on screen.
      lo = Infinity; hi = -Infinity;
      for (const cell of seen) { lo = Math.min(lo, cell.t); hi = Math.max(hi, cell.t); }
      lo = Math.max(1026, Math.floor(lo)); hi = Math.min(2026, Math.ceil(hi));
      n = seen.length;
    }
    return { y0: lo, y1: hi, n, mid };
  }
  // what the camera is on: the builder's focus when it has one, else read from the screen
  function focusNow(view) {
    if (api.focus) {
      const f = api.focus();
      if (f && f.depth === 'millennium') return { depth: 'millennium' };
      if (f && f.year) return { year: Math.min(2026, Math.max(1026, Math.floor(f.year))), month: f.depth === 'page' ? f.month : null, depth: f.depth };
    }
    const cam = api.camera;
    if (!cam || cam.k <= 1.05) return { depth: 'millennium' };
    const v = spanOf(view || viewNow());
    if (v.y1 - v.y0 <= 1) return { year: v.y0, month: null, depth: 'year', n: v.n };
    return { y0: v.y0, y1: v.y1, depth: v.y1 - v.y0 <= 12 ? 'decade' : 'century', n: v.n };
  }
  // the count under the chips alone: a selection dims the rest but does not take them out of the year
  function shown(e) {
    const ds = domSet(), ts = typeSet(), rs = regSet();
    if (ds && !ds.has(e.domain)) return false;
    if (ts && !ts.has(e.type)) return false;
    if (rs && !rs.has(e.region)) return false;
    if ((state.thread || state.q) && !passes(e, { ...state, domains: new Set(ALL_DOMAINS), types: null })) return false;
    return true;
  }
  const countIn = (year, month) => { let n = 0; for (const e of db.events) if (isEvent(e) && e.year === year && (!month || e.month === month) && shown(e)) n++; return n; };
  const focusText = (f) => {
    if (!f) return '';
    if (f.depth === 'millennium' || (!f.year && f.y0 == null)) return '';
    if (f.year) {
      let month = f.month || null, n = countIn(f.year, month);
      if (month && !n) { month = null; n = countIn(f.year, null); }   // an empty month reads as its year
      return `${month ? `${MONTHS[month - 1]} ` : ''}${num(f.year)}, ${num(fmtN(n))} event${n === 1 ? '' : 's'}`;
    }
    const n = f.n != null ? f.n : 0;
    return `${f.y0 === f.y1 ? num(f.y0) : `${num(f.y0)} to ${num(f.y1)}`}, ${num(fmtN(n))} event${n === 1 ? '' : 's'}`;
  };
  function renderSpan(view, cam) {
    const zoomed = cam && cam.k > 1.05;
    const f = zoomed || api.focus ? focusNow(view) : { depth: 'millennium' };
    const moved = focus && f && (f.year !== focus.year || f.month !== focus.month || f.depth !== focus.depth);
    if (opening && f && ((f.year && f.year !== opening.year) || f.depth === 'page')) opening = null;
    if (moved && f.year && focus.year !== f.year) followYear(f.year);
    focus = f;
    // the opening sentence names this month until the camera leaves it
    const txt = motion.moving && cam ? num(Math.floor(cam.year)) : (opening && (!f || !f.year || f.year === opening.year) ? focusText(opening) : focusText(f));
    const away = f && f.depth && f.depth !== 'millennium';
    if (txt !== lastSpan) { lastSpan = txt; spanEl.innerHTML = txt; spanEl.hidden = !txt; statusEl.classList.toggle('focused', !!txt); resetBtn.hidden = !(zoomed || away); }
  }
  if (api.onFocus) subs.push(api.onFocus(() => api.redraw()));
  // on phones the bottom card follows the focused year's newest event
  function followYear(year) {
    if (!PHONE() || journey || holdPanel) return;
    let best = null;
    for (const c of api.cells || []) if (c.on !== false && c.year === year && (!best || c.t > best.t || (c.t === best.t && (c.e.day || 0) > (best.e.day || 0)))) best = c;
    if (best) cardFor(best); else { cardEl.hidden = true; cardCell = null; }
  }
  resetBtn.addEventListener('click', () => { cursor = null; if (api.resetCamera) api.resetCamera({ animate: true }); else api.setCamera({ cx: 0, cy: 0, k: 1 }, { animate: true }); });

  /* ---------- born: the arrival selection and the replay ---------- */
  // On phones the map comes first: the arrival keeps its selection (flare, chords, the pill, the card's one line)
  // while the record panel stays closed until a tap on the pill or a cell.
  let holdPanel = null;   // the id of the held selection
  function closePanel() {
    const dr = document.getElementById('drawer');
    if (!dr || !dr.classList.contains('on')) return;
    dr.classList.remove('on'); dr.setAttribute('aria-hidden', 'true'); dr.inert = true;
  }
  function openHeld() {
    if (!holdPanel) return false;
    holdPanel = null;
    const dr = document.getElementById('drawer');
    if (dr) { dr.inert = false; dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); }
    return true;
  }
  const later = (a, b) => !b || a.year > b.year || (a.year === b.year && ((a.month || 0) > (b.month || 0) || ((a.month || 0) === (b.month || 0) && (a.day || 0) > (b.day || 0))));
  function arrive() {
    // the status opens on this month's events; the selection is this month's newest event, from the data, nothing picked by hand
    const now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1;
    opening = { year: Y, month: M, depth: 'page' };
    lastSpan = null; api.redraw();
    if (state.sel) return;
    let best = null;
    for (const e of db.events) if (isEvent(e) && e.year === Y && e.month === M && later(e, best)) best = e;
    if (!best) for (const e of db.events) if (isEvent(e) && later(e, best)) best = e;
    if (!best) return;
    if (PHONE()) { holdPanel = best.id; select(best.id); }
    else select(best.id);
  }
  if (api.onBorn) {
    subs.push(api.onBorn(() => { arrive(); replayBtn.hidden = false; }));
    if (api.isBorn && api.isBorn()) replayBtn.hidden = false;
  } else { setTimeout(arrive, 400); }
  replayBtn.addEventListener('click', () => { if (api.replay) { replayBtn.hidden = true; api.replay(); } });

  /* ---------- hover and click ---------- */
  function cardFor(cell) {
    const e = cell.e;
    const d = DOMAIN[e.domain];
    cardEl.innerHTML = `<div class="k"><i style="background:${hue(e.domain, 3)}"></i>${esc(d ? d.short : e.domain)}, ${esc(TYPE[e.type] ? TYPE[e.type].label.toLowerCase() : e.type)}, ${esc(fmtDate(e))}${e.region && REGION[e.region] ? `, ${esc(REGION[e.region].short)}` : ''}</div>
      <div class="h">${esc(e.title)}</div>
      <div class="r"><button type="button" class="open">Open the record</button><button type="button" class="x" aria-label="Close">&times;</button></div>`;
    cardEl.hidden = false;
    cardCell = cell;
  }
  cardEl.addEventListener('click', (ev) => {
    if (ev.target.closest('.open') && cardCell) { if (!(state.sel === cardCell.id && openHeld())) select(cardCell.id); }
    if (ev.target.closest('.x')) { cardEl.hidden = true; cardCell = null; }
  });
  subs.push(onHover((cell, ev) => {
    hoverCell = cell;
    if (PHONE()) return;
    if (motion.moving) { tip.hide(); return; }   // in flight the tip waits for the settle
    if (cell && ev) tip.show(ev, eventTip(cell.e)); else tip.hide();
  }));
  subs.push(onClick((cell, ev) => {
    if (!cell) { if (PHONE()) { cardEl.hidden = true; cardCell = null; } return; }
    if (PHONE() || (ev && ev.pointerType === 'touch')) {
      if (cardCell && cardCell.id === cell.id) { if (!(state.sel === cell.id && openHeld())) select(cell.id); } else cardFor(cell);
      return;
    }
    select(cell.id);
  }));

  /* ---------- keyboard: arrows step years and lanes at the current zoom, Enter opens the nearest cell ---------- */
  const viewNow = () => ({ w: el.clientWidth, h: el.clientHeight, y0: 1026, y1: 2026 });
  const stepYears = () => { const cam = api.camera; if (!cam || cam.k <= 1.05) return 10; const v = spanOf(viewNow()); const span = Math.max(1, v.y1 - v.y0); return Math.pow(10, Math.max(0, Math.floor(Math.log10(span / 30)))); };
  function startCursor() {
    if (cursor) return;
    const cam = api.camera;
    const v = spanOf(viewNow());
    const mid = cam && cam.k > 1.05 && v.mid ? Math.round(v.mid) : 1526;
    cursor = { year: Math.min(2026, Math.max(1026, hoverCell ? hoverCell.year : mid)), lane: hoverCell ? hoverCell.lane : 6 };
  }
  function moveCursor(dy, dl, big) {
    startCursor();
    cursor.year = Math.min(2026, Math.max(1026, cursor.year + dy * stepYears() * (big ? 10 : 1)));
    cursor.lane = Math.min(12, Math.max(0, cursor.lane + dl));
    const cam = api.camera;
    if (cam && cam.k > 1.05 && project) { const m = project(cursor.year, cursor.lane, 0); api.setCamera({ cx: m.x, cy: m.y, k: cam.k }); }
    else api.redraw();
    const c = nearestCell ? nearestCell(cursor.year, cursor.lane) : null;
    if (c && Math.abs(c.year - cursor.year) <= stepYears()) { const r = el.getBoundingClientRect(), p = P(c); hoverCell = c; if (!PHONE()) tip.show({ clientX: r.left + p.x, clientY: r.top + p.y }, eventTip(c.e)); }
    else { hoverCell = null; tip.hide(); }
  }
  const Y_LO = 1026, Y_HI = 2026.98;
  const yearNow = () => (api.camera && Number.isFinite(api.camera.year) ? api.camera.year : 2026);
  function stepYear(n) {
    const y = Math.min(Y_HI, Math.max(Y_LO, yearNow() + n));
    cursor = null; tip.hide();
    if (api.setYear) api.setYear(y, { animate: true }); else if (api.zoomToYear) api.zoomToYear(y, { animate: true });
  }
  function goToday() {
    const d = new Date();
    if (api.flyTo) api.flyTo({ year: d.getFullYear(), month: d.getMonth() + 1, depth: 'page' }, { ms: 1600 });
    else if (api.setYear) api.setYear(Y_HI - 0.2, { animate: true });
  }
  function stepAltitude(d) {
    cursor = null; tip.hide();
    if (api.setAltitude && api.altitude) { api.setAltitude(Math.min(1, Math.max(0, api.altitude() + d))); return; }
    const cam = api.camera; if (!cam) return;
    api.setCamera({ cx: cam.cx, cy: cam.cy, k: Math.min(400, Math.max(1, cam.k * (d > 0 ? 0.5 : 2))) }, { animate: true });
  }
  function goMillennium() { cursor = null; tip.hide(); if (api.resetCamera) api.resetCamera({ animate: true }); else api.setCamera({ cx: 0, cy: 0, k: 1 }, { animate: true }); }
  function onKey(ev) {
    if (ev.target !== el && !(ev.target.tagName === 'CANVAS') && ev.target !== rail) return;
    const k = ev.key;
    if (k === 'ArrowRight') { ev.preventDefault(); stepYear(ev.shiftKey ? 10 : 1); }
    else if (k === 'ArrowLeft') { ev.preventDefault(); stepYear(ev.shiftKey ? -10 : -1); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { ev.preventDefault(); stepAltitude(k === 'ArrowUp' ? 0.1 : -0.1); }
    else if (k === 'Enter') {
      const c = hoverCell || (cursor && nearestCell ? nearestCell(cursor.year, cursor.lane) : null);
      if (c) { ev.preventDefault(); tip.hide(); select(c.id); }
    } else if (k === 'Escape') { if (cursor) { cursor = null; tip.hide(); api.redraw(); ev.stopPropagation(); } }
    else if (k === 'Home') { ev.preventDefault(); goToday(); }
    else if (k === 'm' || k === 'M') { if (!ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); goMillennium(); } }
    else if (k === '+' || k === '=' || k === '-') {
      ev.preventDefault(); stepAltitude(k === '-' ? 0.12 : -0.12);
    }
  }
  /* ---------- the depth rail: a thousand years down the right edge, the camera's year as a knob ---------- */
  const rail = $('.sp-rail'), ticksEl = rail.querySelector('.sp-ticks'), knob = rail.querySelector('.sp-knob'), knobN = knob.querySelector('span');
  const railPos = (t) => (Math.min(Y_HI, Math.max(Y_LO, t)) - Y_LO) / (Y_HI - Y_LO);
  ticksEl.insertAdjacentHTML('afterbegin', Array.from({ length: 10 }, (_, i) => 1100 + i * 100).map((y) => `<i style="top:${(railPos(y) * 100).toFixed(2)}%"><b>${y}</b></i>`).join(''));
  let railYear = null;
  const litEl = rail.querySelector('.sp-lit');
  let litKey = '';
  function renderRail(view) {
    const t = yearNow(), y = Math.floor(t);
    if (railYear !== y) { railYear = y; knobN.textContent = String(y); rail.setAttribute('aria-valuenow', String(y)); }
    knob.style.top = `${(railPos(t) * 100).toFixed(3)}%`;
    // the lit span: the years in view, long from altitude, a sliver on the page, so a rise and its settle read on the rail
    if (view && view.y0 != null && view.y1 != null) {
      const a = railPos(Math.min(view.y0, view.y1)), b = railPos(Math.max(view.y0, view.y1));
      const key = `${a.toFixed(4)}:${b.toFixed(4)}`;
      if (key !== litKey) { litKey = key; litEl.style.top = `${(a * 100).toFixed(3)}%`; litEl.style.height = `${(Math.max(0.004, b - a) * 100).toFixed(3)}%`; }
    }
    const a = api.altitude ? api.altitude() : (api.camera ? 1 - Math.min(1, Math.log(Math.max(1, api.camera.k)) / Math.log(40)) : 1);
    knob.style.setProperty('--sp-alt', a.toFixed(3));
    for (const tick of ticksEl.querySelectorAll('i')) tick.classList.toggle('near', Math.abs(parseFloat(tick.style.top) - railPos(t) * 100) < 2.2);
  }
  const yearAtClient = (clientY) => { const r = ticksEl.getBoundingClientRect(); return Y_LO + Math.min(1, Math.max(0, (clientY - r.top) / Math.max(1, r.height))) * (Y_HI - Y_LO); };
  let drag = null;
  rail.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault(); rail.setPointerCapture(ev.pointerId); rail.focus({ preventScroll: true });
    drag = { id: ev.pointerId, x0: ev.clientX, a0: api.altitude ? api.altitude() : null, moved: false };
    rail.classList.add('drag'); cursor = null; tip.hide();
    if (api.setYear) api.setYear(yearAtClient(ev.clientY), { animate: false });
  });
  rail.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    drag.moved = true;
    if (api.setYear) api.setYear(yearAtClient(ev.clientY), { animate: false });
    if (drag.a0 != null && api.setAltitude) { const a = Math.min(1, Math.max(0, drag.a0 + (drag.x0 - ev.clientX) / 260)); if (Math.abs(a - drag.a0) > 0.01) api.setAltitude(a, { animate: false }); }
  });
  const dragEnd = (ev) => { if (!drag || ev.pointerId !== drag.id) return; drag = null; rail.classList.remove('drag'); renderRail(); };
  rail.addEventListener('pointerup', dragEnd); rail.addEventListener('pointercancel', dragEnd);
  rail.addEventListener('wheel', (ev) => { if (!api.setAltitude || !api.altitude) return; ev.preventDefault(); api.setAltitude(Math.min(1, Math.max(0, api.altitude() + ev.deltaY / 900)), { animate: false }); }, { passive: false });
  if (api.onCamera) subs.push(api.onCamera(renderRail)); else if (api.onFocus) subs.push(api.onFocus(renderRail));
  if (api.onFrame) subs.push(api.onFrame((ctx, cam, view) => renderRail(view)));
  renderRail();
  el.addEventListener('keydown', onKey);

  /* ---------- phone: the strip as a glass sheet behind one button ---------- */
  const sheet = (open) => { stripEl.classList.toggle('open', open); filterBtn.setAttribute('aria-expanded', String(open)); if (open) showSheet(true); if (!open && PHONE()) filterBtn.focus(); };
  filterBtn.addEventListener('click', () => sheet(!stripEl.classList.contains('open')));
  $('.sp-sheetclose').addEventListener('click', () => sheet(false));


  /* ---------- journeys: a thread from the data flown stop to stop, one line at each ---------- */
  async function loadJourneys() {
    try {
      const r = await fetch(`data/journeys.json${typeof window !== 'undefined' && window.__BUILD ? `?v=${window.__BUILD}` : ''}`);
      if (!r.ok) return;
      const j = await r.json();
      journeys = ((j && (j.journeys || (Array.isArray(j) ? j : []))) || []).filter((x) => x && x.id && x.stops && x.stops.length);
    } catch { journeys = []; }
    renderJList();
  }
  const stopsOf = (j) => (j.stops || []).map((x) => (typeof x === 'string' ? { id: x } : x)).filter((x) => x && db.byId.has(x.id));
  function renderJList() {
    const live = journeys.filter((j) => stopsOf(j).length >= 2);
    jBtn.hidden = !live.length;
    if (!live.length) { jlistEl.innerHTML = ''; return; }
    jlistEl.innerHTML = live.map((j) => {
      const st = stopsOf(j), ys = st.map((x) => db.byId.get(x.id).year);
      return `<button type="button" class="sp-j${journey && journey.j.id === j.id ? ' on' : ''}" data-j="${esc(j.id)}"><span class="t">${esc(j.title)}</span><span class="m">${num(st.length)} stops, ${num(Math.min(...ys))} to ${num(Math.max(...ys))}</span>${j.line ? `<span class="l">${esc(j.line)}</span>` : ''}</button>`;
    }).join('');
  }
  const showJList = (open) => { jlistEl.hidden = !open; jBtn.setAttribute('aria-expanded', String(open)); jBtn.classList.toggle('open', open); if (open) showSheet(false); };
  jBtn.addEventListener('click', () => showJList(jlistEl.hidden));
  jlistEl.addEventListener('click', (ev) => { const b = ev.target.closest('.sp-j'); if (b) startJourney(b.dataset.j); });
  // the camera's flight: the builder's flyTo when it is there, else the zoom to the stop's year
  function fly(id, ms = LEG_MS) {
    if (api.flyTo) return Promise.resolve(api.flyTo(id, { ms })).catch(() => {});
    const c = cellById.get(id);
    if (c && api.zoomToYear) api.zoomToYear(c.year, { animate: true });
    return new Promise((r) => setTimeout(r, Math.min(ms, 900)));
  }
  function startJourney(id) {
    const j = journeys.find((x) => x.id === id);
    const stops = j ? stopsOf(j) : [];
    if (!stops.length) return;
    endJourney();
    if (state.sel) select('');
    journey = { j, stops, i: -1, paused: false, flying: false, landed: false, held: false, legT0: 0, token: 0, timer: 0, raf: 0 };
    showJList(false);
    if (PHONE()) { sheet(false); cardEl.hidden = true; cardCell = null; }
    renderJList();
    goStop(0);
  }
  // the ring on the reached stop pulses, so the loop draws only then: not in flight (the camera's frames draw the overlay),
  // not paused, not with the page hidden, never under reduced motion, where each state change redraws once
  function journeyLoop() {
    const J = journey; if (!J) return;
    const live = J.landed && !J.flying && !J.paused && !document.hidden && !REDUCED();
    if (!live) { if (J.raf) cancelAnimationFrame(J.raf); J.raf = 0; api.redraw(); return; }
    if (J.raf) return;
    const loop = () => { const K = journey; if (!K) return; K.raf = 0; if (!(K.landed && !K.flying && !K.paused && !document.hidden && !REDUCED())) { api.redraw(); return; } api.redraw(); K.raf = requestAnimationFrame(loop); };
    J.raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', journeyLoop);
  async function goStop(i) {
    const J = journey; if (!J) return;
    i = Math.max(0, Math.min(J.stops.length - 1, i));
    const tok = ++J.token;
    clearTimeout(J.timer); J.timer = 0;
    J.i = i; J.flying = true; J.legT0 = performance.now();
    const s = J.stops[i], e = db.byId.get(s.id);
    if (api.setHighlight) api.setHighlight(s.id);
    J.landed = false;
    pushFilter(); renderJChip(); renderJCap(e, s); journeyLoop();
    const res = await Promise.race([fly(s.id, LEG_MS), new Promise((r) => setTimeout(() => r(null), LEG_MS + 800))]);
    if (!journey || journey.token !== tok) return;
    J.flying = false;
    // a flight her hand cut short leaves the stop unreached: the journey holds, the destination unclaimed, until Resume or Next
    const c = cellById.get(s.id), tol = Math.max(0.3, 0.04 * (lastView && lastView.y0 != null ? Math.abs(lastView.y1 - lastView.y0) : 10));
    J.landed = res && typeof res.settled === 'boolean' ? res.settled : (!c || !api.camera || Math.abs(api.camera.year - c.t) <= tol);
    if (!J.landed) { J.paused = true; J.held = true; renderJCap(e, s); journeyLoop(); return; }
    J.held = false; renderJCap(e, s); journeyLoop();
    const words = `${e.title} ${s.line || firstLine(e)}`.trim().split(/\s+/).length;
    const dwell = Math.max(STOP_MS, words * WORD_MS);
    if (i < J.stops.length - 1 && !J.paused) J.timer = setTimeout(() => { if (journey && journey.token === tok && !journey.paused) goStop(i + 1); }, dwell);
  }
  function pauseJourney(on) {
    const J = journey; if (!J || J.paused === on) return;
    J.paused = on;
    if (on) { clearTimeout(J.timer); J.timer = 0; }
    else if (J.held) goStop(J.i);                                   // the stop her hand cut short comes first
    else if (!J.flying && J.i < J.stops.length - 1) goStop(J.i + 1);
    const e = db.byId.get(J.stops[J.i].id); renderJCap(e, J.stops[J.i]); journeyLoop();
  }
  function endJourney() {
    const J = journey; if (!J) return;
    journey = null;
    clearTimeout(J.timer); if (J.raf) cancelAnimationFrame(J.raf);
    if (api.setHighlight) api.setHighlight(null);
    jchipEl.hidden = true; jchipEl.innerHTML = ''; jcapEl.hidden = true; jcapEl.innerHTML = '';
    renderJList(); pushFilter(); api.redraw();
  }
  function renderJChip() {
    const J = journey; if (!J) { jchipEl.hidden = true; return; }
    jchipEl.innerHTML = `<button type="button" class="name">${esc(J.j.title)}</button><span class="n">${num(J.i + 1)} of ${num(J.stops.length)}</span><button type="button" class="x" aria-label="End the journey">&times;</button>`;
    jchipEl.hidden = false;
  }
  jchipEl.addEventListener('click', (ev) => {
    if (ev.target.closest('.x')) { endJourney(); return; }
    if (ev.target.closest('.name') && journey) { pauseJourney(true); goStop(journey.i); }
  });
  function renderJCap(e, s) {
    const J = journey; if (!J || !e) { jcapEl.hidden = true; return; }
    const d = DOMAIN[e.domain], last = J.i >= J.stops.length - 1;
    const line = s.line || firstLine(e);
    const settled = !J.flying && J.landed;
    const kicker = settled ? `${num(e.year)}${d ? `, ${esc(d.short)}` : ''}${e.region && REGION[e.region] ? `, ${esc(REGION[e.region].short)}` : ''}` : J.held ? `${esc(J.j.title)}, stop ${num(J.i + 1)} held` : `${esc(J.j.title)}, toward ${num(e.year)}`;
    jcapEl.innerHTML = `<div class="k"><i style="background:${hue(e.domain, 3)}"></i><span>${kicker}</span></div>
      ${settled ? `<button type="button" class="t" data-id="${esc(e.id)}">${esc(e.title)}</button>${line ? `<p class="l">${esc(line)}</p>` : ''}` : ''}
      <div class="r">${last ? `<button type="button" class="again">Again</button>` : `<button type="button" class="pause">${J.paused ? 'Resume' : 'Pause'}</button><button type="button" class="next">Next</button>`}<span class="n">${num(J.i + 1)} of ${num(J.stops.length)}</span><button type="button" class="x" aria-label="End the journey">&times;</button></div>`;
    jcapEl.hidden = false;
    jcapEl.classList.toggle('flying', J.flying);
  }
  jcapEl.addEventListener('click', (ev) => {
    const J = journey; if (!J) return;
    if (ev.target.closest('.x')) { endJourney(); return; }
    if (ev.target.closest('.pause')) { pauseJourney(!J.paused); return; }
    if (ev.target.closest('.next')) { goStop(J.i + 1); return; }
    if (ev.target.closest('.again')) { goStop(0); return; }
    const t = ev.target.closest('.t'); if (t) { pauseJourney(true); select(t.dataset.id); }
  });
  const firstLine = (e) => { const s = (e.summary || '').trim(); if (!s) return ''; const m = /^(.+?[.!?])(\s|$)/.exec(s); return (m ? m[1] : s).slice(0, 180); };
  // the journey's light: its stops lit, the chords between stops drawn as the camera travels, a slow ring on the stop it is at
  function drawJourney(ctx) {
    const J = journey; if (!J) return;
    const now = performance.now();
    const still = REDUCED();
    const u = J.flying && !still ? settle((now - J.legT0) / LEG_MS) : 1;
    ctx.save(); ctx.lineCap = 'round';
    const c0 = toScreen(0, 0);
    for (let k = 1; k <= J.i; k++) {
      const a = cellById.get(J.stops[k - 1].id), b = cellById.get(J.stops[k].id);
      if (!a || !b) continue;
      const p = P(a), q = P(b);
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const bend = 0.45 * Math.min(1, Math.hypot(q.x - p.x, q.y - p.y) / 320);
      const c = { x: mx + (c0.x - mx) * bend, y: my + (c0.y - my) * bend };
      const uu = k === J.i ? u : 1;
      if (uu <= 0) continue;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      if (uu >= 1) ctx.quadraticCurveTo(c.x, c.y, q.x, q.y);
      else { for (let s2 = 1; s2 <= 16; s2++) { const pt = qpt(p, c, q, (s2 / 16) * uu); ctx.lineTo(pt.x, pt.y); } }
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = k === J.i ? 0.85 : 0.55; ctx.lineWidth = k === J.i ? 1.4 : 1;
      ctx.stroke();
    }
    const here = cellById.get(J.stops[J.i].id);
    if (here && !J.flying) {
      const p = P(here), ph = still || J.paused ? 0 : (now / 1800) % 1;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.85 * (1 - ph); ctx.beginPath(); ctx.arc(p.x, p.y, 8 + 18 * settle(ph), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- rhymes: the selected event's rhymes (rhymes.json) ringed across the centuries, 400ms apart ---------- */
  function startRhymes() {
    const e = state.sel && db.byId.get(state.sel);
    const key = e ? e.id : '';
    if (rhyme && rhyme.key === key) return;
    if (rhyme && rhyme.raf) cancelAnimationFrame(rhyme.raf);
    rhyme = null;
    if (!e || !db.rhymes || !db.rhymes.length) { api.redraw(); return; }
    const set = new Set();
    for (const r of db.rhymes) {
      const a = (r.then && r.then.event_ids) || [], b = (r.now && r.now.event_ids) || [];
      if (a.includes(e.id) || b.includes(e.id)) for (const id of [...a, ...b]) if (id !== e.id && db.byId.has(id)) set.add(id);
    }
    if (!set.size) { api.redraw(); return; }
    const ids = [...set].sort((x, y) => db.byId.get(x).t - db.byId.get(y).t);
    rhyme = { ids, key, t0: performance.now() + FLARE_MS, raf: 0, reduced: REDUCED() };
    if (rhyme.reduced) { api.redraw(); return; }
    const until = rhyme.t0 + ids.length * RHYME_GAP + RHYME_MS + 100;
    const loop = () => { if (!rhyme) return; api.redraw(); rhyme.raf = performance.now() < until ? requestAnimationFrame(loop) : 0; };
    rhyme.raf = requestAnimationFrame(loop);
  }
  function drawRhymes(ctx) {
    const R = rhyme; if (!R) return;
    const now = performance.now();
    ctx.save(); ctx.strokeStyle = RHYME_INK; ctx.lineWidth = 1.2;
    R.ids.forEach((id, i) => {
      const c = cellById.get(id); if (!c) return;
      const age = R.reduced || REDUCED() ? Infinity : now - (R.t0 + i * RHYME_GAP);
      if (age < 0) return;
      const p = P(c);
      if (age < RHYME_MS) { const f = settle(age / RHYME_MS); ctx.globalAlpha = 0.9 * (1 - f); ctx.beginPath(); ctx.arc(p.x, p.y, 5 + 26 * f, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.restore();
  }

  /* ---------- the record panel on this page: linked records, grouped by the association the data carries ---------- */
  const dbody = document.getElementById('db');
  let decorating = false;
  function decoratePanel() {
    if (!dbody || decorating) return;
    const e = state.sel && db.byId.get(state.sel);
    const old = dbody.querySelector('.sp-lf');
    if (!e) { if (old) old.remove(); return; }
    if (old && old.dataset.id === e.id) return;
    if (!dbody.querySelector('.summary, .dl, .sect-h')) return;   // the record has not rendered yet
    decorating = true;
    try {
      if (old) old.remove();
      const kinds = linkKinds(e);
      const near = (list, dir) => list.filter((x) => (dir === 'before' ? x.e.t < e.t : dir === 'after' ? x.e.t > e.t : true)).sort((a, b) => Math.abs(a.e.t - e.t) - Math.abs(b.e.t - e.t));
      // each linked record sits in one group, the most specific association it shares: thread step, pattern pairing,
      // rule, benchmark, model score, deal party, then a connects entry
      const ORDER = ['th', 'rh', 'po', 'bm', 'bmm', 'dl', 'cx'];
      const kindOf = (r) => ORDER.find((k) => r.kinds.has(k));
      const pick = (kind, dir) => near([...kinds.entries()].filter(([, r]) => kindOf(r) === kind).map(([id, r]) => ({ e: db.byId.get(id), note: r.notes[kind] || '' })).filter((x) => x.e), dir);
      const row = (x) => `<button type="button" class="sp-lfr" data-id="${esc(x.e.id)}"><span class="y">${num(x.e.year)}</span><span class="t">${esc(x.e.title_short || x.e.title)}${x.note ? `<span class="w"> &middot; ${esc(x.note)}</span>` : ''}</span></button>`;
      const CAP = 3;
      const head = (k, list, dir) => `${KIND_HEAD[k][list.length === 1 ? 0 : 1]}${dir ? `, ${dir}` : ''}`;
      const group = (list, k, dir) => { if (!list.length) return ''; const rows = list.slice(0, CAP).sort((a, b) => a.e.t - b.e.t); return `<h4>${esc(head(k, list, dir))}${list.length > CAP ? `<span class="n">${num(CAP)} nearest of ${num(fmtN(list.length))} records</span>` : ''}</h4>${rows.map(row).join('')}`; };
      const parts = [group(pick('th', 'before'), 'th', 'earlier'), group(pick('th', 'after'), 'th', 'later')];
      for (const k of ['rh', 'po', 'bm', 'bmm', 'dl', 'cx']) parts.push(group(pick(k, 'any'), k));
      const html = parts.join('');
      if (!html) return;
      const sec = document.createElement('div'); sec.className = 'sp-lf'; sec.dataset.id = e.id;
      sec.innerHTML = html;
      const anchor = dbody.querySelector('.dl') || dbody.querySelector('details.detail') || dbody.querySelector('p');
      if (anchor) anchor.after(sec); else dbody.appendChild(sec);
    } finally { decorating = false; }
  }
  if (dbody) dbody.addEventListener('click', (ev) => { const b = ev.target.closest('.sp-lfr'); if (!b) return; fly(b.dataset.id, LEG_MS); select(b.dataset.id); });
  const pmo = dbody ? new MutationObserver(() => { if (!decorating) requestAnimationFrame(decoratePanel); }) : null;
  if (pmo) pmo.observe(dbody, { childList: true });

  /* ---------- store and data ---------- */
  let framed = '';
  subs.push(subscribe((s, ch) => {
    if (!(ch.has('domains') || ch.has('types') || ch.has('sel') || ch.has('thread') || ch.has('q') || ch.has('*'))) return;
    if (ch.has('sel')) {
      if (journey && s.sel && journey.stops.every((x) => x.id !== s.sel)) pauseJourney(true);
      if (holdPanel && s.sel !== holdPanel) holdPanel = null;
      if (holdPanel && cellById.get(s.sel)) cardFor(cellById.get(s.sel)); else { cardEl.hidden = true; cardCell = null; }
      if (s.sel) tip.hide();
    }
    apply();
    const sel = s.sel || '';
    if (ch.has('sel') && sel.includes(':') && framed !== sel) { framed = sel; requestAnimationFrame(() => requestAnimationFrame(() => { if (ent && !ent.anchor && state.sel === sel) frameEntity(); })); }
  }));
  subs.push(onData((name) => { if (['past', 'meta', 'links', 'talent', 'rhymes'].includes(name)) apply(); if (name === 'past') renderJList(); }));
  ensure('links', 'meta', 'rhymes');
  apply();
  loadJourneys();

  // The record panel takes the right 440px on desktop; the strip and foot keep clear of it.
  const drawerEl = document.getElementById('drawer');
  const syncPanel = () => {
    if (holdPanel && drawerEl && drawerEl.classList.contains('on')) { closePanel(); return; }
    const open = !!(drawerEl && drawerEl.classList.contains('on')); ui.classList.toggle('panel', open);
    pushInset();
  };
  // the ring sits in the room the strip and the open panel leave (the builder's setInset)
  const GAP = () => parseFloat(getComputedStyle(el).getPropertyValue('--space-3')) || 16;
  function pushInset() {
    if (!api.setInset) return;
    if (PHONE()) { api.setInset({}); return; }
    const open = ui.classList.contains('panel');
    const stripH = stripEl.offsetHeight ? stripEl.getBoundingClientRect().bottom - el.getBoundingClientRect().top : 0;
    ui.style.setProperty('--sp-strip-h', `${Math.round(stripH)}px`);
    const railW = rail && rail.offsetWidth ? rail.getBoundingClientRect().width + 2 * GAP() : 0;
    api.setInset({ right: (open ? Math.min(440, el.clientWidth) : 0) + railW, top: Math.round(stripH) });
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => pushInset()) : null;
  if (ro) ro.observe(stripEl);
  const mo = drawerEl ? new MutationObserver(syncPanel) : null;
  if (mo) mo.observe(drawerEl, { attributes: true, attributeFilter: ['class'] });
  syncPanel();

  return function teardown() {
    for (const u of subs) if (typeof u === 'function') u();
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
    el.removeEventListener('keydown', onKey);
    if (filterTick) cancelAnimationFrame(filterTick);
    if (anim && anim.raf) cancelAnimationFrame(anim.raf);
    endJourney();
    if (rhyme && rhyme.raf) cancelAnimationFrame(rhyme.raf);
    if (pmo) pmo.disconnect();
    document.removeEventListener('visibilitychange', journeyLoop);
    const old = dbody && dbody.querySelector('.sp-lf'); if (old) old.remove();
    ui.remove();
  };
}

export default mountUI;
