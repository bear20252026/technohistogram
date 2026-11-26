import { load, db, ensure, ensureNow, onData, markPainted, hasRecord, lean, ensureD3 } from './data.js';
import { state, set, subscribe, applyHash, readHash, canonHash, hashParams, pathLikeHash, YEAR_MIN, YEAR_MAX, VIEWS, TABS, viewOf, tabOf, moduleOf, mountOf, screenPlate, screensOf, onHover } from './store.js';
import { initFilters, syncFilters, fillTypes, fillThreads, initSearch, initDrawer, renderDrawer, initScrubber, select, tip, INDEXED, NARROW, desktopHandOff, openList, openEvidence } from './ui.js';
import { DOMAINS } from './palette.js';
import { initTour, tourHi, walkLit } from './tour.js';
import { initIntro } from './intro.js';

// reduced motion: D3 transitions finish instantly and scripted scrolling jumps
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // d3 loads on demand (data.js ensureD3): its transitions are patched the moment it arrives
  const patchD3 = () => { if (!window.d3) return; const tp = d3.transition.prototype, dur = tp.duration, del = tp.delay; tp.duration = function (v) { return arguments.length ? dur.call(this, 0) : dur.call(this); }; tp.delay = function (v) { return arguments.length ? del.call(this, 0) : del.call(this); }; };
  patchD3(); document.addEventListener('d3-ready', patchD3, { once: true });
  const st = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (a, b) { return typeof a === 'object' && a ? st.call(this, { ...a, behavior: 'auto' }) : st.call(this, a, b); };
  document.documentElement.classList.add('reduced-motion');
}
// opened from the home screen the page owns the whole screen (css/spiral.css html.standalone): the display-mode check, and Safari's own flag
try { const full = () => document.documentElement.classList.toggle('standalone', matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true); full(); matchMedia('(display-mode: standalone)').addEventListener('change', full); } catch (e) { /* no display-mode support: the page stays as laid out */ }
const stage = document.getElementById('stage');
// the top bar's height feeds the fixed layers (filter sheet, drawer, era sheet) as --top-h; measured, so no width or
// zoom leaves the stage overlapping the section views row
{
  const app = document.getElementById('app'), bar = document.querySelector('.topbar');
  // measured at every width from the bar's content (brand, page tabs, the tab row, which wraps on phones), not from the
  // bar's box, which the fixed phone grid row would clamp: the lowest child edge minus the bar's top
  const measure = () => {
    const top = bar.getBoundingClientRect().top; let h = 0;
    for (const c of bar.children) { const r = c.getBoundingClientRect(); if (r.height) h = Math.max(h, r.bottom - top); }
    h = Math.round(h) + 1; // the hairline
    if (h > 1) app.style.setProperty('--top-h', `${h}px`);
  };
  if (window.ResizeObserver) for (const c of bar.children) new ResizeObserver(measure).observe(c);
  document.addEventListener('draw-change', () => requestAnimationFrame(measure));
  if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
  window.addEventListener('resize', measure);
  measure();
}
const app = document.getElementById('app');
const mounted = new Map(); // id -> {el, api, dirty}
const DARK = new Set();
// the year locator (History only) draws with d3, which loads on demand: until History first opens, scrub is a quiet
// stand-in, and initScrubber runs once d3 is in
const NO_SCRUB = { layout() {}, draw() {}, setRange() {}, mark() {} };
let scrub = NO_SCRUB, scrubReady = null;
let filtersUp = false, upFiltersRef = () => {};  // the filter bar is built at idle (main); syncFilters runs only once it stands
const idle = (fn, ms = 2000) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: ms }) : setTimeout(fn, 200));
function wakeScrubber() {
  if (scrubReady) return scrubReady;
  scrubReady = ensureD3().then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))).then(() => { if (scrub === NO_SCRUB) scrub = initScrubber(); scrub.layout(); scrub.setRange(); return scrub; }).catch(() => scrub);
  return scrubReady;
}
// modules that draw without d3 mount without waiting for it; every other module has d3 in place before its import
const D3_FREE = new Set(['helix', 'spiral', 'spiral_ui', 'speed', 'voices', 'ai_now', 'ai_limits', 'games', 'play_first', 'play_year', 'play_beat', 'play_index']);

function loadingState() {
  stage.innerHTML = `<div class="state-msg"><div><div class="loading-bars">${DOMAINS.slice(0, 9).map((d, i) => `<span style="--c:${d.color};animation-delay:${i * 0.09}s"></span>`).join('')}</div><h2>Loading the map</h2><p>Reading events, measures and sources.</p></div></div>`;
}

// The record's first file did not arrive (asked for twice, js/data.js getJSON). On a fresh visit the arrival's cover and
// title leave, and the shell is marked ready (the stage is held at no opacity until then), so the message is what the
// page shows; its last words are the way out.
function emptyState() {
  const root = document.documentElement;
  root.classList.remove('arrive', 'arrival-mode');
  { const t = document.getElementById('ar-pre'); if (t) t.remove(); }
  root.dataset.tab = 'map'; root.dataset.view = 'spiral'; document.body.dataset.page = 'map';  // the Histomap's own ground and rail, not the bare shell (the view is not set this early)
  stage.innerHTML = `<div class="state-msg"><div><h2>Nothing loaded</h2><p>The record did not load.</p><button type="button" class="reload">Reload the page</button></div></div>`;
  stage.querySelector('.reload').addEventListener('click', () => location.reload());
  root.dataset.ready = '1';
}
// A later file that did not arrive (js/data.js keeps its name in db.missing and says so here): the page stands on what
// did load and says so, once, in the boot note's words (Map did not finish loading. Reload), with the same way out.
function partialNote() {
  if (!db.missing || !db.missing.size || !db.events.length || document.getElementById('load-note')) return;
  const n = document.createElement('p');
  n.id = 'load-note'; n.className = 'load-note'; n.setAttribute('role', 'status');
  n.innerHTML = '<span>Record did not finish loading.</span> <button type="button" class="reload">Reload</button>';
  n.querySelector('.reload').addEventListener('click', () => location.reload());
  document.body.appendChild(n);
}
addEventListener('histomap:partial', partialNote);

const nav = document.getElementById('views');
const sub = document.getElementById('subnav');
nav.innerHTML = TABS.map((t) => `<button type="button" data-tab="${t.id}" title="${t.label}: ${t.sub}"><span class="lg">${t.label}</span><span class="sub">${t.sub}</span></button>`).join('') + '<i class="tab-ind" aria-hidden="true"></i>';
// the active-tab mark slides to the chosen tab instead of disappearing and reappearing
const tabInd = nav.querySelector('.tab-ind');
function placeTabInd() {
  const b = nav.querySelector("button[aria-current='page']");
  if (!b) return;
  const pad = parseFloat(getComputedStyle(b).paddingLeft) || 0;
  tabInd.style.left = `${b.offsetLeft + pad}px`;
  tabInd.style.width = `${Math.max(0, b.offsetWidth - 2 * pad)}px`;
  nav.classList.add('has-ind');
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeTabInd);
nav.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  const t = TABS.find((x) => x.id === b.dataset.tab);
  // clicking the active tab returns to its first view (or the top of the Today page)
  set({ view: t.view, mode: '' });
});
// the digit keys open the pages in order (1 Histomap); not while typing, not with a modifier, not inside the intro
nav.querySelectorAll('button[data-tab]').forEach((b, i) => b.setAttribute('aria-keyshortcuts', String(i + 1)));
document.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.key.length !== 1 || ev.key < '1' || ev.key > String(TABS.length)) return;
  if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable], [role=slider]')) return;
  if (document.body.classList.contains('intro-open')) return;
  const t = TABS[+ev.key - 1];
  if (t) { ev.preventDefault(); set({ view: t.view, mode: '' }); }
});
// sub navigation: HISTORY lists Stream, Columns and Findings with the other drawings behind one menu; AI lists Now and
// its plates (one plate at a time)
const subBtn = (v, cur) => `<button type="button" data-v="${v.id}" aria-label="${v.label}" aria-current="${v.id === cur ? 'page' : 'false'}"><span class="lg">${v.label}</span><span class="sh" aria-hidden="true">${v.sh}</span></button>`;
// the tab row of the page (Vision 4 Addendum): every page has one; a view with nav false (Wheel, Arcs) keeps its URL
// and shows as the current item while open, without a place in the row otherwise
const screensEl = document.getElementById('screens');
function drawSubnav() {
  const tab = tabOf(state.view);
  const cur = viewOf(state.view);
  const items = VIEWS.filter((v) => v.tab === tab && (v.nav !== false || v.id === cur.id));
  sub.hidden = !items.length;
  sub.innerHTML = items.map((v) => subBtn(v, cur.id)).join('');
  placeScreens(); // the stepper rides at the end of the tab row, or in its own row on phones
  sub.dataset.tab = tab;
  drawScreens();
  fitSubnav();
}
// the screen stepper: a tab with more than one screen shows "Screen 1 of 3" with its neighbours, under the tab row
function drawScreens() {
  if (!screensEl) return;
  const n = screensOf(state.view);
  screensEl.hidden = n < 2;
  if (n < 2) { screensEl.innerHTML = ''; return; }  // one screen: an empty, hidden pager (no stale count from an earlier tab)
  const titles = (current && current.titles) || null;
  const k = Math.min(Math.max(1, state.screen), n);
  const t = titles && titles[k - 1] ? titles[k - 1].title : '';
  placeScreens();
  if (PHONE.matches) {
    // the phone pager: one full-width row under the tabs, 44px buttons that say what they do, the count between them
    screensEl.innerHTML = `<button type="button" data-sc="${k - 1}" ${k <= 1 ? 'disabled' : ''} aria-label="Previous screen">\u2190 Previous</button><span class="sc-n" aria-live="polite">${t ? `${t} \u00b7 ` : ''}${k} of ${n}</span><button type="button" data-sc="${k + 1}" ${k >= n ? 'disabled' : ''} aria-label="Next screen">Next \u2192</button>`;
    return;
  }
  screensEl.innerHTML = `<button type="button" data-sc="${k - 1}" ${k <= 1 ? 'disabled' : ''} aria-label="Previous screen">\u2190</button><span class="sc-n" aria-live="polite">${t ? `${t} \u00b7 ` : ''}${k} of ${n}</span><button type="button" data-sc="${k + 1}" ${k >= n ? 'disabled' : ''} aria-label="Next screen">\u2192</button>`;
}
// on phones the stepper leaves the tab row (which scrolls sideways) for a row of its own after it; on wider screens it sits
// at the end of the tab row
const PHONE = matchMedia('(max-width: 760px)');
function placeScreens() {
  if (!screensEl) return;
  const sub = document.querySelector('.subnav');
  if (!sub) return;
  if (PHONE.matches) { if (screensEl.parentElement === sub) sub.parentElement.insertBefore(screensEl, sub.nextSibling); }
  else if (screensEl.parentElement !== sub) sub.appendChild(screensEl);
}
PHONE.addEventListener('change', () => drawScreens());
if (screensEl) screensEl.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-sc]'); if (b && !b.disabled) set({ screen: +b.dataset.sc }); });
// the subnav must show every item: above 1380 the rail stacks into the two-row form when the row would not fit
// (nine Today sections at 1440); a row that still scrolls fades at the edge it runs past
const topbar = document.querySelector('.topbar');
function fitSubnav() {
  topbar.classList.remove('stacked');
  if (!sub.hidden && innerWidth > 1380 && sub.scrollWidth > sub.clientWidth + 1) topbar.classList.add('stacked');
  fadeSubnav();
}
function fadeSubnav() {
  const over = sub.scrollWidth > sub.clientWidth + 1;
  sub.classList.toggle('more', over && sub.scrollLeft + sub.clientWidth < sub.scrollWidth - 2);
  sub.classList.toggle('more-l', over && sub.scrollLeft > 2);
}
sub.addEventListener('scroll', fadeSubnav, { passive: true });
addEventListener('resize', fitSubnav);
sub.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-v]'); // the screen stepper rides in the row with its own handler
  if (b) set({ view: b.dataset.v, mode: '' });
});
export function markSubnav(id) { sub.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', b.dataset.v === id ? 'page' : 'false')); }

// datasets a view needs before it can draw; everything else loads when its view opens
const VIEW_NEEDS = { patterns: ['patterns'], impact: ['impact'], predictions: ['predictions'], wheel: ['text'], threads: ['tours', 'rhymes'], arcs: ['links', 'patterns'], moment: ['benchmarks'] };
async function ensureView(id, screen = 1) {
  const key = mountOf(id, screen);
  if (mounted.has(key)) return mounted.get(key);
  const el = document.createElement('section');
  el.className = 'view';
  el.dataset.view = key;
  el.setAttribute('aria-label', viewOf(id).label);
  el.inert = true;  // out of the tab order and the accessibility tree until it is the view on stage
  stage.appendChild(el);
  // the home page draws from the recent wave alone; every other view reads the whole record, so it waits for the
  // past wave (a hairline on the stage marks the wait; it is one frame on a warm cache)
  const home = key === 'today' && id === 'anatomy';
  // the home draws the Anatomy's rules flow from the policy count, so the small policy core is part of its first wave
  const name = moduleOf(id, screen);
  // Now draws its wall from the recent wave at once and adds the earlier columns itself when the past wave lands
  const recentFirst = name === 'ai_now';
  const needs = [...(VIEW_NEEDS[name] || []), ...(home ? ['policy_core'] : recentFirst ? [] : ['past'])];
  if (needs.some((n) => !db.loaded.has(n))) stage.classList.add('waiting');
  // d3 before the module for every drawing that uses it (the import of a module whose top level touches d3 would throw)
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const [mod] = await Promise.all([(D3_FREE.has(name) ? Promise.resolve() : ensureD3().then(frame)).then(() => import(`./views/${name}.js`)), ensureNow(needs)]);
  stage.classList.remove('waiting');
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));  // the data's arrival and the mount are two tasks
  if (mounted.has(key)) { el.remove(); return mounted.get(key); }  // a second call mounted it during the wait
  const t0 = performance.now();
  const api = mod.default(el, { db, select, tip, markSubnav, openList, openEvidence });
  performance.measure(`view-mount-${key}`, { start: t0 });
  const m = { el, api, dirty: true, titles: mod.SCREENS || null, selfPast: recentFirst };  // selfPast: the module takes the past wave itself
  mounted.set(key, m);
  return m;
}

let current = null;
// keep the active tour step highlighted after renders
function reHi(ch) {
  if (!current) return;
  if (current.api.lit) current.api.lit(walkLit());
  if (!current.api.hover) return;
  if (state.tour) current.api.hover(tourHi(state.view));
  else if (ch && ch.has('tour')) current.api.hover(null);
}
// a deep link with at=<id> (or at=m-<record id>) lands on that element once the view has drawn it: scrolled into view,
// focused, marked for a moment; then the parameter is cleared so a later hash change does not land again
let landing = 0;
function landAt(root) {
  const key = state.at; if (!key) return;
  const t0 = performance.now(); const my = ++landing;
  const find = () => (key.startsWith('m-') ? root.querySelector(`[data-m="${CSS.escape(key.slice(2))}"]`)
    : key.startsWith('g-') ? root.querySelector(`[data-g="${CSS.escape(key.slice(2))}"], [data-game="${CSS.escape(key.slice(2))}"]`)
    : root.querySelector(`#${CSS.escape(key)}`));
  const tick = () => {
    if (my !== landing || state.at !== key) return;
    const el = find();
    if (!el) { if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else set({ at: '' }, { replace: true }); return; }
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (el.tabIndex < 0) el.tabIndex = -1;
    el.focus({ preventScroll: true });
    el.classList.add('landed'); setTimeout(() => el.classList.remove('landed'), 2400);
    set({ at: '' }, { replace: true });
  };
  requestAnimationFrame(tick);
}

// the view on stage is the one the latest change named: a view whose mount resolves after a later change (a tab tapped
// while the earlier view's module or data was still on its way) does not take the stage
let showToken = 0;
async function showView(id, changed) {
  const my = ++showToken;
  const v = viewOf(id), tab = v.tab;
  nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  placeTabInd();
  drawSubnav();
  app.dataset.tab = tab;
  document.documentElement.dataset.tab = tab;
  document.documentElement.dataset.view = id; // the AI forecasts screen keeps the dark shell inside the Ledger (style.css)
  document.body.dataset.page = tab; // the page's ground, inks and accent (style.css body[data-page])
  // outside History the filters and the year scrubber are gone (Vision 4, S7); in History the scrubber is a thin locator
  const sc = document.querySelector('.scrubber'); const off = tab !== 'past';
  if (sc.hidden !== off) { sc.hidden = off; requestAnimationFrame(() => { if (!off) wakeScrubber().then(() => { scrub.layout(); scrub.setRange(); }); }); }
  else if (!off && scrub === NO_SCRUB) wakeScrubber();
  app.classList.toggle('dark', DARK.has(id));
  if (!PAGE_SHEETS.has(tab)) { await pageSheet(tab); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); if (my !== showToken) return; }  // a page's first opening: its view sheet, then a frame for the style pass
  else await pageSheet(tab);
  const m = await ensureView(id, state.screen);
  if (my !== showToken) return;  // a later change took the stage while this view was mounting
  const switching = current !== m;
  // the mount (module, data, constructor) was one task; the first render of a switched-in view runs in the next frame
  if (switching) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); if (my !== showToken) return; }
  const prev = current;
  current = m;
  drawScreens();
  // render before fading in
  const t0 = performance.now();
  if (switching || m.dirty) { m.api.render(state, switching ? new Set(['*']) : changed); m.dirty = false; }
  else m.api.render(state, changed);
  performance.measure(`view-render-${m.el.dataset.view}`, { start: t0 });
  // a placeholder screen: the old AI page shows the one plate the registry names
  const plate = screenPlate(id, state.screen);
  if (plate && m.api.show) m.api.show(plate);

  // hard cut: the old view leaves and the new one lands in the same frame
  if (prev && prev !== m) { prev.el.classList.remove('on'); prev.el.inert = true; }
  m.el.classList.add('on'); m.el.inert = false;
  if (state.at && (switching || changed.has('at') || changed.has('view'))) landAt(m.el);
  reHi();
  for (const [k, o] of mounted) if (o !== m) o.dirty = true;
}


// A record id the hash names but the record does not hold (a typo, a stale link): rather than a view with nothing open,
// the reader lands on Today at rest with one line where the drawer would be. Ids a view registers itself are left to it.
let noteEl = null, noteT = 0;
function noteSel(text) {
  clearTimeout(noteT);
  if (!text) { if (noteEl) noteEl.remove(); noteEl = null; return; }
  if (!noteEl) { noteEl = document.createElement('p'); noteEl.className = 'drawer-note'; noteEl.setAttribute('role', 'status'); document.body.appendChild(noteEl); }
  noteEl.textContent = text;
  noteT = setTimeout(() => noteSel(null), 9000);
}
// Arrival by hash on a view with its own side index (Connections, Arcs) under 1366: the drawer would cover the index,
// so the record goes to the index and the drawer closes, trail kept; the index's "Open the record" brings it back.
function indexArrival() {
  const s = state;
  if (!s.sel || !INDEXED[s.view] || !NARROW()) return;
  if (s.view !== 'arcs' && !(s.mode || '').split('.').includes('cx')) return;
  desktopHandOff(s.sel);
}
function checkSel(id) {
  if (!id) return;
  hasRecord(id).then((ok) => {
    if (ok || state.sel !== id) return;
    set({ view: 'spiral', sel: '', mode: '', at: '' });
    noteSel('No record by that name.');
  }).catch(() => {});
}

// THE VIEW SHEETS COME PER PAGE (tools/bundle_css.py writes css/views-<page>.css and views-shared.css from the list in
// index.html). The page on stage gets its sheet linked as soon as this module runs (before the data arrives), a page
// opened later gets its sheet before its first view mounts, and on a desktop link the other pages' sheets follow at idle
// so a record opened from any page has its panel styles. Nothing waits longer than the timeout.
const PAGE_SHEETS = new Map();
function pageSheet(page) {
  if (!page) return Promise.resolve();
  if (!PAGE_SHEETS.has(page)) {
    PAGE_SHEETS.set(page, new Promise((r) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = `css/views-${page}.css${window.__BUILD ? `?v=${window.__BUILD}` : ''}`; l.dataset.page = page;
      const t = setTimeout(r, 2500);
      l.onload = l.onerror = () => { clearTimeout(t); r(); };
      document.head.appendChild(l);
    }));
  }
  return PAGE_SHEETS.get(page);
}
pageSheet('shared');
pageSheet(tabOf(readHash().view));
function prefetchSheets() { if (lean()) return; for (const t of TABS) pageSheet(t.id); }
// the deferred stylesheets of index.html (media="print" until they load), when any remain, or the timeout
function sheetsReady(ms) {
  const links = [...document.querySelectorAll('link[rel="stylesheet"][media="print"][href^="css/"]')];
  const wait = links.length ? new Promise((r) => { const t = setTimeout(r, ms); const check = () => { if (links.every((l) => l.media !== 'print' || l.sheet)) { clearTimeout(t); r(); } }; for (const l of links) { l.addEventListener('load', check, { once: true }); l.addEventListener('error', check, { once: true }); } check(); }) : Promise.resolve();
  return Promise.all([wait, pageSheet(tabOf(state.view))]);
}
// The arrival (js/arrival.js) replaces the intro on a fresh visit: the image globe drops onto black and breaks open,
// its pictures and the record's grains land on the helix, the overlay fades and the helix frame settles on 2026 in a
// 900ms ease (views/helix.js arrivalTargets, onReveal, afterArrival). No dive into any card page.
async function startArrival() {
  const intro = document.getElementById('intro'); if (intro) intro.remove();
  try {
    const [{ runArrival }, hx] = await Promise.all([import('./arrival.js'), import('./views/helix.js')]);
    document.documentElement.classList.remove('arrive');
    runArrival({
      targets: () => hx.arrivalTargets(),
      ready: () => hx.arrivalReady(),
      onReveal: () => hx.onReveal(),
      onDone: () => { hx.afterArrival(); dispatchEvent(new Event('histomap:intro-closed')); },
    });
  } catch (e) {
    console.error('arrival failed', e);
    document.documentElement.classList.remove('arrive', 'arrival-mode');
    { const t = document.getElementById('ar-pre'); if (t) t.remove(); }
    try { const hx = await import('./views/helix.js'); hx.onReveal(); hx.afterArrival(); } catch (e2) { /* the helix stands as drawn */ }
  }
}
// The open pane is drawn again in place when a file lands (its summary, people or links have arrived), when the window
// is resized, and when the selection's own notice arrives a frame after the pane was already built for it (a file
// landing in that frame builds the pane first). The reader keeps the row in focus, and with keep the place scrolled
// to: a redraw used to drop both, which sent a keyboard reader back to the top of the page.
function redrawDrawer(keep = true) {
  const dr = document.getElementById('drawer'), body = document.getElementById('db'), a = document.activeElement;
  const inside = !!(dr && a && a !== document.body && dr.contains(a)), id = inside && a.dataset ? a.dataset.id || '' : '', top = keep && body ? body.scrollTop : 0;
  renderDrawer();
  if (body && top) body.scrollTop = top;
  const now = document.activeElement;
  if (inside && state.sel && dr.classList.contains('on') && (!now || now === document.body)) {
    const t = (id && [...dr.querySelectorAll('[data-id]')].find((b) => b.dataset.id === id)) || dr.querySelector('h3');
    if (t) { if (t.tagName === 'H3') t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
}
async function main() {
  loadingState();
  await load();
  if (!db.events.length) { emptyState(); return; }
  partialNote();  // a first-wave file other than the record itself (the models, the manifest) that did not arrive
  stage.innerHTML = '';
  Object.assign(state, readHash());
  // a legacy id in the opening address is rewritten to the tab it resolved to (#v=strata becomes #v=money&s=2)
  { const p = hashParams(); if ((p.has('v') && p.get('v') !== state.view) || pathLikeHash()) canonHash(); }
  performance.mark('m-loaded');
  // the landing view's module graph (Now: five files in a chain) comes down now, while the intro is up and the recent
  // wave is in, so the first view starts the moment the reader taps Start instead of a second later
  { const nm = moduleOf(state.view, state.screen); if (nm) { if (!D3_FREE.has(nm)) ensureD3(); import(`./views/${nm}.js`).catch(() => {}); } }
  { const f = document.getElementById('fonts'); if (f) f.media = 'all'; }  // the faces load now, behind the first wave
  // the filter bar (chips, type and thread lists, the count) is hidden on every tab now and none of it is needed for the
  // first view: it is built at idle after the first view, or at once when the opening address carries a filter
  const filtered = state.types || state.thread || state.q || (state.domains && state.domains.size < DOMAINS.length) || state.y0 !== YEAR_MIN || state.y1 !== YEAR_MAX;
  // two idle steps: the bar's controls (chips, the type and thread lists), then their state and the count
  const upFilters = (now) => { if (filtersUp) return; filtersUp = true; initFilters(); performance.mark('m-filters'); if (now) syncFilters(); else idle(() => syncFilters(), 2000); };
  upFiltersRef = upFilters;
  if (filtered) upFilters(true);
  initSearch(); performance.mark('m-search');
  initDrawer(); performance.mark('m-drawer');
  const qEl = document.getElementById('q'), mq = matchMedia('(max-width: 1100px)');
  // the map page names what the search finds; the other pages keep the short form
  // a field under 200px wide only has room for the one word
  const ph = () => (qEl.placeholder = qEl.getBoundingClientRect().width < 200 ? 'Search' : tabOf(state.view) === 'map' ? 'Search people, companies, ideas' : mq.matches ? 'Search' : 'Search the record');
  ph(); mq.addEventListener('change', ph); subscribe((s, ch) => { if (ch.has('view')) ph(); });
  if (window.ResizeObserver) new ResizeObserver(ph).observe(qEl); else addEventListener('resize', ph);
  performance.mark('m-scrubber');  // the locator itself wakes with History (wakeScrubber)
  performance.mark('m-sync');
  // when a dataset lands, a view drawn without it gets a fresh render (registered before the first view, which may
  // itself wait for the past wave)
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  // the landing view's module graph (Now: five files in a chain) comes down while the intro is up, right after the
  // recent wave, so the first view starts the moment the reader taps Start instead of a second later
  onData(async (name) => {
    if (name === 'past') {
      // the record is complete: the scrubber histogram, the filter counts and the view on stage redraw once, each
      // in a frame of its own so no single task on a slow phone runs past the budget
      idle(() => { scrub.draw(); if (filtersUp) { fillTypes(); idle(() => { fillThreads(); syncFilters(); performance.mark('past-shell'); }); } else performance.mark('past-shell'); });
      await frame();
      // the home page's first section draws from the recent wave and keeps its arrival; other views redraw in full
      // Now (recentFirst) takes the past wave itself (its ensure('past') adds the earlier columns): no second full render here
      if (current && !current.selfPast) { const home = current.el.dataset.view === 'today' && state.view === 'anatomy'; current.api.render(state, new Set(home ? ['events'] : ['*'])); reHi(); }
      performance.mark('past-view');
      for (const o of mounted.values()) if (o !== current) o.dirty = true;
      await frame();
    }
    if ((name === 'text' || name === 'meta' || name === 'past' || name === 'links') && state.sel) redrawDrawer();
    if (current && current.api.onData) { const t = performance.now(); current.api.onData(name); performance.measure(`view-ondata-${name}`, { start: t });  }
    if (name === 'past') performance.mark('past-ondata');
  });
  renderDrawer();
  // the mobile gate: the view sheets load without blocking the paint (index.html media="print"), so the first view waits
  // for them (2.5 s at most); on a phone with the intro open it also waits for the reader to tap through (or 8 s), so
  // the intro's one draw does not share a slow CPU with the first drawing
  await sheetsReady(2500);
  if (lean() && document.body.classList.contains('intro-open')) await new Promise((r) => { const t = setTimeout(r, 8000); addEventListener('histomap:intro-closed', () => { clearTimeout(t); r(); }, { once: true }); });
  performance.mark('first-view-start');
  await showView(state.view, new Set(['*']));
  performance.mark('first-view-done');
  idle(() => { upFiltersRef(); }, 3000);
  idle(prefetchSheets, 6000);
  subscribe(async (s, ch) => {
    if (filtersUp) syncFilters(); else if (ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q') || ch.has('y0') || ch.has('y1')) upFilters(true);
    if (ch.has('sel')) checkSel(s.sel);
    else if (ch.has('view') || ch.has('mode')) noteSel(null);
    // the mobile Filters pill steps aside while a drawer or a story is open, so it never sits on their controls
    document.body.classList.toggle('drawer-open', !!s.sel);
    document.body.classList.toggle('story-on', /^story-/.test(s.mode || ''));
    if (ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q')) scrub.draw();
    if (ch.has('y0') || ch.has('y1')) scrub.setRange();
    if (ch.has('sel')) redrawDrawer(false);
    // the evidence panel never follows the reader to another tab: a tab or page change closes it unless the same change
    // named a record (a deep link with v and e); a view's default selection may light a mark without opening it
    if (ch.has('view') && !ch.has('sel') && s.sel) { select(''); }
    if (ch.has('view') || ch.has('screen')) { tip.hide(); await showView(s.view, ch); }
    else if (current) { current.api.render(s, ch); reHi(ch); if (ch.has('at') && s.at) landAt(current.el); }
    for (const o of mounted.values()) if (o !== current) o.dirty = true;
  });
  // the register switch or the period overlays changed (ui.js): the shown view redraws as for a new window, the others on return
  document.addEventListener('draw-change', () => {
    if (current) { current.api.render(state, new Set(['y0', 'y1'])); reHi(new Set(['y0'])); }
    for (const o of mounted.values()) if (o !== current) o.dirty = true;
  });
  checkSel(state.sel);  // after the subscribers are on, so a bad id in the opening hash can move the view
  addEventListener('resize', () => { if (state.sel) redrawDrawer(); });  // the Impact sheet and the side drawer trade places at 1366
  onHover((id) => current && current.api.hover && current.api.hover(id || tourHi(state.view)));
  initTour(); performance.mark('m-tour');
  addEventListener('hashchange', () => { applyHash(); indexArrival(); });
  addEventListener('popstate', () => { applyHash(); indexArrival(); });
  indexArrival();
  let rt = null;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      scrub.layout();
      scrub.setRange();
      placeTabInd();
      if (current) { current.api.resize ? current.api.resize() : current.api.render(state, new Set(['*'])); reHi(); }
      for (const o of mounted.values()) if (o !== current) o.dirty = true;
    }, 120);
  });
  performance.mark('m-resize');
  if (window.__ARRIVAL) startArrival(); else initIntro();
  performance.mark('m-intro');
  window.__histomap = { db, state, set, ensure };
  document.documentElement.dataset.ready = '1';
  // the first view has painted: open the gate for the rest of the record (the past wave first, then the
  // people and organizations, then the summaries and sources), and for anything a section asked for meanwhile
  // "painted" means the first view has its marks on screen (or 1.2 s have passed), so the first drawing never
  // shares the network with the rest of the record
  const t0 = performance.now();
  const drawn = () => document.querySelectorAll('.view.on svg path, .view.on svg circle, .view.on svg rect, .view.on canvas').length > 20;
  // after paint the past wave follows (the record completes), then the series; the people and organizations, the
  // summaries and sources (the largest file) load when something asks: the evidence panel, the search, a view (on a
  // desktop link they still follow at idle, so the panel opens at once)
  const gate = () => { if (drawn() || performance.now() - t0 > 1200) { markPainted(); ensure('past').then(() => ensure('series')).then(() => { if (!lean()) ensure('meta').then(() => ensure('text')); }); } else requestAnimationFrame(gate); };
  requestAnimationFrame(() => requestAnimationFrame(gate));
}
// the boot never leaves a blank page: a failure shows the shell with a note and the address lands on Now
main().catch((err) => {
  console.error('boot failed', err);
  document.documentElement.dataset.ready = '1';
  const st = document.getElementById('stage');
  if (st && !st.querySelector('.view.on')) st.innerHTML = '<section class="view on boot-fail"><p class="boot-note">Map did not finish loading. <a href="#v=spiral" onclick="location.reload()">Reload</a></p></section>';
});
