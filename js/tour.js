// Walk a thread on the map. The view the visitor is looking at stays; the window slides to each step, the
// thread's events light up one by one, and a corner caption carries a single sentence of narration (the
// step's argument). Auto-advances with Play/Pause and a speed control; arrow keys step; a progress rail
// shows where the walk is. Other views keep their per-step highlight (deal, prediction, benchmark, person,
// policy) so leaving the map mid-walk still points at something.
import { state as S, set, subscribe, VIEWS } from './store.js';
import { db, modelEvents, fmtDate } from './data.js';
import { esc, select, scrubMark } from './ui.js';
import { DOMAINS, DOMAIN } from './palette.js';

// views where a thread's events can be lit on the map; the walk starts on one of these
export const WALK_VIEWS = ['stream', 'columns', 'wheel', 'strata'];
const BASE_MS = 5600; // one step at 1x; longer sentences get a little more
const SPEEDS = [0.5, 1, 2];
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let bar = null;
let collapsed = false;
let playing = false, speed = 1, timer = null, slideRaf = null, autoStart = false;
let lastMap = 'stream'; // the map view the visitor last used; a walk started off the map opens here (in memory only)

// a thread the visitor built on the Threads page lives here in memory; its definition travels in the hash of that page
let custom = null;
export function setCustomTour(t) { custom = t && t.steps && t.steps.length ? t : null; }
export const customTour = () => custom;
const tours = () => [...((Array.isArray(db.tours) ? db.tours : db.tours?.tours) || []), ...(custom ? [custom] : [])];
export const tourById = (id) => tours().find((t) => t.id === id);
const cur = () => { const t = tourById(S.tour); return t ? { t, s: t.steps[Math.min(S.step, t.steps.length - 1)], k: Math.min(S.step, t.steps.length - 1) } : null; };

// id to highlight in the given view for the active step
export function tourHi(viewId) {
  const c = cur();
  if (!c) return null;
  if (viewId === 'genealogy') {
    const m = (db.modelList || []).find((x) => modelEvents(x)[0]?.id === c.s.event) || (db.modelList || []).find((x) => modelEvents(x).some((e) => e.id === c.s.event));
    return m ? m.id : null;
  }
  if (viewId === 'capital') return c.s.deal ? 'deal:' + c.s.deal : null;
  if (viewId === 'predictions') return c.s.pred ? 'pred:' + c.s.pred : null;
  if (viewId === 'benchmarks') return c.s.bench ? 'bench:' + c.s.bench : null;
  if (viewId === 'talent') return c.s.person ? 'person:' + c.s.person : null;
  if (viewId === 'policy') return c.s.policy ? 'policy:' + c.s.policy : null;
  return c.s.event;
}

// what the map views light: every step walked so far, the current one marked
export function walkLit() {
  const c = cur();
  if (!c) return null;
  return { ids: c.t.steps.slice(0, c.k + 1).map((st) => st.event), cur: c.s.event, color: c.t.color, index: c.k };
}

export function startTour(id, step = 0, { autoplay = true } = {}) {
  autoStart = autoplay;
  const patch = { tour: id, step, domains: new Set(DOMAINS.map((d) => d.id)), types: null, thread: '', q: '', sel: '' };
  if (!WALK_VIEWS.includes(S.view)) patch.view = lastMap;
  set(patch);
}
export function endTour() { set({ tour: '', step: 0 }); }

function go(i) {
  const c = cur();
  if (!c) return;
  if (i < 0) return;
  if (i >= c.t.steps.length) { setPlaying(false); return; }
  set({ step: i });
}

/* ---------- the window slides to each step ---------- */
function slideTo(y0, y1) {
  if (slideRaf) cancelAnimationFrame(slideRaf); slideRaf = null;
  const a0 = S.y0, a1 = S.y1;
  if ((a0 === y0 && a1 === y1)) return;
  if (RM()) { set({ y0, y1 }); return; }
  // Locator scrub (Aesthetic Systems): the window pans linearly at a steady rate, 40 years per second, no easing at
  // either end, so time feels steady; very long jumps are capped at 2.4s. The scrubber strip below moves on the same
  // emits (20 per second), and the window readout steps by decades while the pan runs, exact years once it lands.
  const dist = Math.max(Math.abs(y0 - a0), Math.abs(y1 - a1));
  const dur = Math.max(400, Math.min(2400, (dist / 40) * 1000));
  const t0 = performance.now();
  const rng = document.getElementById('rng');
  const dec = (y) => Math.round(y / 10) * 10;
  let lastEmit = t0, e0 = a0, e1 = a1;
  const frame = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    if (k >= 1) { slideRaf = null; set({ y0, y1 }); return; }
    const n0 = Math.round(a0 + (y0 - a0) * k), n1 = Math.round(a1 + (y1 - a1) * k);
    if (now - lastEmit >= 50 && (n0 !== e0 || n1 !== e1) && n1 > n0) { lastEmit = now; e0 = n0; e1 = n1; set({ y0: n0, y1: n1 }); }
    if (rng) rng.textContent = `${dec(n0)} to ${dec(n1)}`; // every frame: the store's own readout lands after the emit
    slideRaf = requestAnimationFrame(frame);
  };
  slideRaf = requestAnimationFrame(frame);
}

function applyStep() {
  const c = cur();
  if (!c) return;
  const { s } = c;
  set({ mode: '', sel: '' });
  slideTo(s.y0, s.y1);
}

/* ---------- auto-advance ---------- */
function stepMs() { const c = cur(); const extra = c ? Math.min(3000, (c.s.argument || c.s.narration || '').length * 22) : 0; return (BASE_MS + extra) / speed; }
function schedule() {
  clearTimeout(timer); timer = null;
  if (!playing || !S.tour) return;
  const c = cur();
  if (!c) return;
  timer = setTimeout(() => { timer = null; if (S.step + 1 >= c.t.steps.length) setPlaying(false); else go(S.step + 1); }, stepMs());
}
function setPlaying(v) {
  playing = v;
  if (bar && !bar.hidden) { syncPlayUI(); }
  schedule();
}
function syncPlayUI() {
  const b = bar.querySelector('[data-a="pp"]');
  if (!b) return;
  b.setAttribute('aria-pressed', String(playing));
  b.title = playing ? 'Pause (space)' : 'Play (space)';
  b.innerHTML = playing
    ? '<svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1 1h3v10H1zM7 1h3v10H7z" fill="currentColor"/></svg><span>Pause</span>'
    : '<svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1.5 1l8.5 5-8.5 5z" fill="currentColor"/></svg><span>Play</span>';
  bar.classList.toggle('playing', playing);
  const rail = bar.querySelector('.tb-prog');
  if (rail) rail.style.setProperty('--step-ms', `${stepMs()}ms`);
}

function pins() {
  const c = cur();
  if (!c) { scrubMark('tour', null); return; }
  scrubMark('tour', c.t.steps.map((st, i) => { const e = db.byId.get(st.event); return e ? { year: e.year, month: e.month, color: i === c.k ? 'var(--ink)' : c.t.color, strong: i === c.k, dim: i > c.k } : null; }).filter(Boolean).sort((a, b) => a.strong - b.strong));
}

function renderBar() {
  const c = cur();
  if (!c) { bar.hidden = true; document.body.classList.remove('touring'); return; }
  const { t, s, k } = c;
  const e = db.byId.get(s.event);
  const n = t.steps.length;
  const onMap = WALK_VIEWS.includes(S.view);
  const vl = VIEWS.find((v) => v.id === S.view);
  bar.hidden = false;
  document.body.classList.add('touring');
  // keep the caption off the focus year on horizontal timelines
  const frac = e ? (e.year - s.y0) / Math.max(1, s.y1 - s.y0) : 1;
  bar.classList.toggle('right', S.view === 'predictions' || (S.view === 'strata' && e && e.year < 2010) || (['stream', 'strata', 'diffusion'].includes(S.view) && frac < 0.5));
  bar.style.setProperty('--tc', t.color);
  const sentence = s.argument || s.narration || '';
  bar.innerHTML = `
    <div class="tb-head"><span class="sc"><i></i>Walk <span aria-hidden="true">&middot;</span> ${esc(t.title)}</span><span class="tb-ct"><span class="lg">Step </span>${k + 1} of ${n}</span>
      <button type="button" class="tb-story" data-a="r" title="Read this thread as a story">Story</button>
      <button type="button" class="tb-x" data-a="c" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Collapse'} caption" title="${collapsed ? 'Expand' : 'Collapse'}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="${collapsed ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>
      <button type="button" class="tb-x" data-a="x" aria-label="End walk" title="End walk (Esc)"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.6"/></svg></button></div>
    <div class="tb-prog" role="progressbar" aria-label="Walk progress" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${k + 1}">${t.steps.map((st, i) => { const ee = db.byId.get(st.event); return `<button type="button" data-i="${i}" class="${i < k ? 'done' : i === k ? 'on' : ''}" aria-label="Step ${i + 1}: ${esc(ee ? ee.title : st.event)}" title="${ee ? esc(ee.year + ': ' + ee.title) : ''}"><i></i></button>`; }).join('')}</div>
    <div class="tb-body" aria-live="polite">
      <div class="tb-meta"><span class="yr">${e ? esc(fmtDate(e)) : ''}</span>${e ? `<span><i style="background:${DOMAIN[e.domain]?.color || '#888'}"></i>${esc(DOMAIN[e.domain]?.short || e.domain)}</span>` : ''}<button type="button" class="vw" data-a="o" title="Open the record">${esc(e ? e.title : s.event)}</button></div>
      <p class="tb-say">${esc(sentence)}</p>
    </div>
    <div class="tb-ctl">
      <button type="button" data-a="p" ${k === 0 ? 'disabled' : ''} aria-label="Previous step" title="Previous (left arrow)"><span aria-hidden="true">&larr;</span></button>
      <button type="button" data-a="pp" class="pri" aria-pressed="${playing}"></button>
      <button type="button" data-a="n" aria-label="${k === n - 1 ? 'Finish walk' : 'Next step'}" title="${k === n - 1 ? 'Finish' : 'Next (right arrow)'}"><span aria-hidden="true">&rarr;</span></button>
      <span class="tb-speed" role="group" aria-label="Speed">${SPEEDS.map((v) => `<button type="button" data-s="${v}" aria-pressed="${v === speed}">${v === 1 ? '1' : v}&times;</button>`).join('')}</span>
      <label class="tb-on"><span class="lg">on</span><select data-a="v" aria-label="Walk on which map">${WALK_VIEWS.map((v) => { const x = VIEWS.find((y) => y.id === v); return `<option value="${v}" ${v === S.view ? 'selected' : ''}>${esc(x ? x.label : v)}</option>`; }).join('')}${onMap ? '' : `<option value="${esc(S.view)}" selected>${esc(vl ? vl.label : S.view)}</option>`}</select></label>
    </div>`;
  syncPlayUI();
}

export function initTour() {
  bar = document.createElement('section');
  bar.className = 'tourbar';
  bar.hidden = true;
  bar.setAttribute('aria-label', 'Thread walk');
  document.getElementById('app').appendChild(bar);
  bar.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.i) go(+b.dataset.i);
    if (b.dataset.s) { speed = +b.dataset.s; bar.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.s === speed))); syncPlayUI(); schedule(); return; }
    const a = b.dataset.a;
    if (a === 'x') endTour();
    if (a === 'c') { collapsed = !collapsed; bar.classList.toggle('min', collapsed); renderBar(); }
    if (a === 'p') { go(S.step - 1); schedule(); }
    if (a === 'n') { if (S.step + 1 >= (cur()?.t.steps.length || 0)) endTour(); else { go(S.step + 1); schedule(); } }
    if (a === 'pp') setPlaying(!playing);
    if (a === 'o') { setPlaying(false); const c = cur(); if (c) select(c.s.pred && db.predById.has('pred:' + c.s.pred) ? 'pred:' + c.s.pred : c.s.event); }
    if (a === 'r') { const c = cur(); if (c) { setPlaying(false); set({ tour: '', step: 0, view: 'threads', mode: 'story-' + c.t.id }); } }
  });
  bar.addEventListener('change', (ev) => {
    const sel = ev.target.closest('select[data-a="v"]');
    if (sel) set({ view: sel.value });
  });
  addEventListener('keydown', (ev) => {
    if (!S.tour || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]')) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); go(S.step + 1); schedule(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(S.step - 1); schedule(); }
    else if (ev.key === ' ' && (ev.target.closest('.tourbar') || !ev.target.closest('button, a'))) { ev.preventDefault(); setPlaying(!playing); }
    else if (ev.key === 'Escape' && !S.sel) endTour();
  });
  // the walk waits while the tab is hidden and while a record is open
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); timer = null; } else schedule(); });
  subscribe((s, ch) => {
    if (WALK_VIEWS.includes(s.view)) lastMap = s.view;
    if (ch.has('tour') || ch.has('step')) {
      if (s.tour && !tourById(s.tour)) { set({ tour: '', step: 0 }); return; }
      if (ch.has('tour')) { playing = s.tour ? autoStart : false; autoStart = false; }
      if (!s.tour) { clearTimeout(timer); timer = null; if (slideRaf) cancelAnimationFrame(slideRaf); slideRaf = null; }
      applyStep();
      renderBar();
      pins();
      schedule();
    } else if (s.tour && ch.has('view')) renderBar();
    if (s.tour && ch.has('sel')) { if (s.sel) { clearTimeout(timer); timer = null; } else schedule(); }
  });
  // a walk opened from a shared link starts paused; without a view in the link it opens on the Stream
  if (S.tour && tourById(S.tour)) { playing = false; if (!WALK_VIEWS.includes(S.view) && !/(^|[#&])v=/.test(location.hash)) set({ view: lastMap }); applyStep(); renderBar(); pins(); }
  else if (S.tour) set({ tour: '', step: 0 });
}
