import { fmtYear } from './time.js';
// Data loading, indexing and filtering.
import { state, viewOf, hashParams } from './store.js';

export const db = {
  events: [],
  byId: new Map(),
  in: new Map(), // id -> [ids that connect to it]
  tags: [], // [{tag, n}]
  series: [],
  models: null,
  anatomyMap: null, // id -> organ (null = excluded), curated
  tours: [],
  rhymes: [],
  flows: null,
  predictions: [],
  predById: new Map(),
  benchmarks: [], benchById: new Map(),
  talent: null, personById: new Map(), orgById: new Map(),
  policy: [], policyById: new Map(),
  patterns: [], impact: null,
  links: null,  // cross-links per event (links.json): patterns, policies, benchmarks, threads, deals, impact metrics
};
// '2023-07-14' | '2023-07' | '2023' -> fractional year at mid-month
export const ym = (d) => { if (!d) return null; const [y, m, dd] = String(d).split('-').map(Number); if (!y) return null; return y + ((m || 6.5) - 1 + (m ? ((dd || 15) - 0.5) / 31 : 0.5)) / 12; };

let VER = '';
const vurl = (path) => `data/${path}${VER ? `?v=${VER}` : ''}`;

// A request that fails (the link drops, the host answers with an error, the body does not parse) is made once more
// after a moment. A file that fails twice is named in db.missing and the shell is told (histomap:partial: js/main.js
// says the record is partial and offers a reload), so an empty fallback is never passed off as the loaded record.
db.missing = new Set();
const RETRY_MS = 700;
async function getJSON(url, fallback) {
  // versioned URLs (manifest build hash) let the browser cache every file; no revalidation round trips
  // index.html starts the first wave (manifest, events_core, ai_models) from an inline script before the modules
  // arrive; the response waits here under its URL
  const pre = typeof window !== 'undefined' && window.__pre && window.__pre[url];
  if (pre) delete window.__pre[url];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await (attempt === 0 && pre ? pre : fetch(url));
      if (r.ok) return await r.json();
    } catch { /* asked for again below */ }
    if (attempt === 0) await new Promise((res) => setTimeout(res, RETRY_MS));
  }
  db.missing.add(url.replace(/^data\//, '').replace(/\?.*$/, ''));
  if (typeof dispatchEvent === 'function' && typeof CustomEvent === 'function') dispatchEvent(new CustomEvent('histomap:partial', { detail: url }));
  return fallback;
}

// bytes fetched, by wave, for the performance report (Content-Length when the server sends it)
export const bytes = { first: 0, later: 0 };

/* ---------- per-dataset loaders: each runs when a view that needs it first opens ---------- */
db.loaded = new Set();
const listeners = new Set();
export const onData = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (name) => { for (const fn of listeners) fn(name); };

function applyBench(bench) {
  db.benchmarks = ((bench && bench.benchmarks) || []).map((b) => ({ ...b, key: b.id, id: 'bench:' + b.id, t0: ym(b.introduced), ts: ym(b.saturated_date),
    points: b.points.map((p, i) => ({ ...p, t: Math.max(ym(p.date), ym(b.introduced) || 0), i, id: `bench:${b.id}:${i}` })), _txt: [b.name, b.creator, b.metric, ...b.points.map((p) => p.model + ' ' + p.org)].join(' ').toLowerCase() }));
  db.benchMethod = bench && bench.method;
  db.benchById = new Map(db.benchmarks.flatMap((b) => [[b.id, b], ...b.points.map((p) => [p.id, b])]));
}
function applyTalent(talent) {
  db.talent = talent;
  if (!talent) return;
  db.orgById = new Map(talent.orgs.map((o) => [o.id, { ...o, t: ym(o.founded) }]));
  db.personById = new Map(talent.people.map((p) => [p.id, { ...p, key: p.id, id: 'person:' + p.id }]));
  db.moves = talent.moves.map((m) => ({ ...m, t: ym(m.date), year: +String(m.date).slice(0, 4) })).filter((m) => m.t);
  for (const p of db.personById.values()) { p.moves = db.moves.filter((m) => m.person === p.key).sort((a, b) => a.t - b.t); p._txt = [p.name, ...p.roles.map((r) => r.org + ' ' + r.title)].join(' ').toLowerCase(); }
  db.personById = new Map([...db.personById.values()].map((p) => [p.id, p]));
}
function applyPolicyText(T) {
  // summaries and sources join the instruments already in memory
  if (!T) return;
  for (const x of db.policy) { const t = T[x.key]; if (t) Object.assign(x, t); }
}
function applyPolicy(policy) {
  if (db.policy.length && Array.isArray(policy)) {
    // the full file after the core: only the text fields are new
    const byKey = new Map(policy.map((x) => [x.id, x]));
    for (const x of db.policy) { const f = byKey.get(x.key); if (f) { if (f.summary) x.summary = f.summary; if (f.sources) x.sources = f.sources; if (f.verification_note) x.verification_note = f.verification_note; } }
    return;
  }
  db.policy = (Array.isArray(policy) ? policy : []).map((x) => {
    const ti = ym(x.date_introduced), te = ym(x.date_enacted), tf = ym(x.date_in_force);
    const key = te ?? tf ?? ti;
    return { ...x, key: x.id, id: 'policy:' + x.id, ti, te, tf, t: key, year: Math.floor(key || 0), _txt: [x.title, x.jurisdiction, x.summary, x.type].join(' ').toLowerCase() };
  }).filter((x) => x.t);
  db.policyById = new Map(db.policy.map((x) => [x.id, x]));
}
function applyPreds(preds) {
  db.predictions = (Array.isArray(preds) ? preds : preds?.predictions || []).map((p) => ({ ...p, key: p.id, id: 'pred:' + p.id, _txt: [p.who, p.claim, p.quote, p.paraphrase, p.role].join(' ').toLowerCase() }));
  db.predById = new Map(db.predictions.map((p) => [p.id, p]));
}
// the AI forecasts due (data/forecasts.json: t the year named, v the verdict, who, text, said): an id each (fc:<index>)
// and the year said, so the helix can leap them and the record pane can open one
function applyForecasts(j) {
  db.forecasts = (Array.isArray(j) ? j : []).map((f, i) => ({ ...f, id: 'fc:' + i, y0: +String(f.said || '2025').slice(0, 4) || 2025 }));
  db.forecastById = new Map(db.forecasts.map((f) => [f.id, f]));
}
// the dated forecasts and their voices, counted once by one filter (a year named from 2026 to 2076): the spiral's label
// and the forecasts sheet both read this at draw time, so the two never print different counts
let fcCountOf = null, fcCount = { all: [], n: 0, voices: 0 };
export function forecastCount() {
  const src = db.forecasts || null;
  if (src !== fcCountOf) { const all = (src || []).filter((f) => f.t && f.t >= 2026 && f.t <= 2076).sort((a, b) => a.t - b.t || a.y0 - b.y0); fcCount = { all, n: all.length, voices: new Set(all.map((f) => f.who)).size }; fcCountOf = src; }
  return fcCount;
}
// a capped set of forecasts: weight first (w, 1 to 5, curated by hand), resolved verdicts before pending and unresolvable,
// then the earlier said; pickForecasts fills the slots one speaker each on a first pass, then tops up in the same order
const FC_RESOLVED = new Set(['came_true', 'came_true_late', 'wrong', 'partly']);
export const forecastOrder = (a, b) => ((b.w || 0) - (a.w || 0)) || ((FC_RESOLVED.has(b.v) ? 1 : 0) - (FC_RESOLVED.has(a.v) ? 1 : 0)) || String(a.said || '').localeCompare(String(b.said || '')) || ((a.id < b.id) ? -1 : 1);
export function pickForecasts(list, n) {
  const sorted = [...list].sort(forecastOrder), out = [], seen = new Set();
  for (const f of sorted) { if (out.length >= n) break; const who = String(f.who || '').toLowerCase(); if (seen.has(who)) continue; seen.add(who); out.push(f); }
  for (const f of sorted) { if (out.length >= n) break; if (!out.includes(f)) out.push(f); }
  return out;
}
// the culture layer (stage 5): seven decade cards, eleven century lines, ten diffusion series
function applyCards(j) { db.decadeCards = new Map(((j && j.cards) || []).map((c) => [c.decade, c])); }
function applyCenturies(j) { db.centuryLines = new Map(((j && j.lines) || []).map((l) => [l.century, l])); }
function applyHighlights(j) { db.highlights = new Map(Object.entries((j && j.units) || {})); } // stage 10: each unit's few cards for the side column
function applyDiffusion(j) { db.diffusion = (j && j.series) || []; }
function applyFlows(flows) {
  db.flows = flows;
  const fl = Array.isArray(flows) ? flows : flows?.deals || flows?.flows || flows?.links || [];
  db.flowList = fl.filter((f) => f && f.source_org && f.target_org).map((f) => {
    const [y, mo] = String(f.date || f.year || '').split('-').map(Number);
    // titles cut off upstream ("...") read as broken labels; fall back to the publisher host
    const cut = /(\.\.\.|\u2026)\s*$/.test(f.source_title || '');
    return { ...f, source_label: !f.source_title || cut ? host(f.source_url) : f.source_title, id: 'deal:' + (f.id || `${f.source_org}-${f.target_org}-${f.date}`), year: y, month: mo || null };
  }).filter((f) => f.year);
  db.dealById = new Map(db.flowList.map((f) => [f.id, f]));
}
const txtOf = (e) => [e.title, e.summary, ...(e.people || []), ...(e.orgs || []), ...(e.tags || [])].join(' ').toLowerCase();
// the search text is built on the first search, not at load (the mobile gate: no long task in the boot)
export function ensureTxt() { for (const e of db.events) if (e._txt == null) e._txt = txtOf(e); }
// hand the main thread back between chunks of decoding (a frame, or a macrotask where there is no frame)
const breathe = () => (typeof scheduler !== 'undefined' && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
const CHUNK = 250;
function applyText(text) {
  // summaries and sources arrive after first paint; merge them into the events and extend the search text
  if (!text) return;
  db._textJson = text;
  const T = text.events || text;
  for (const e of db.events) {
    const x = T[e.id];
    if (!x) continue;
    if (x.summary) e.summary = x.summary;
    if (x.sources) e.sources = x.sources;
    if (x.verification_note) e.verification_note = x.verification_note;
    if (x.detail) e.detail = x.detail;
    if (x.picture) e.picture = x.picture; // a moment's cleared picture (stage 5)
    e._txt = txtOf(e);
  }
}
function applyMeta(meta) {
  // people, organizations and verification flags arrive after first paint (events_meta.json)
  if (!meta) return;
  db._metaJson = meta;
  const M = meta.events || meta;
  for (const e of db.events) {
    const x = M[e.id];
    if (!x) continue;
    if (x.people) e.people = x.people;
    if (x.orgs) e.orgs = x.orgs;
    if (x.verification) e.verification = x.verification;
    if (x.quote) e.quote = x.quote;
    if (x.ai_precursor) e.ai_precursor = x.ai_precursor;
    e._txt = txtOf(e);
  }
  db.metaApplied = true;
}
const LOADERS = {
  past: { file: 'events_past.json', apply: (p) => mergePast(p) },
  meta: { file: 'events_meta.json', apply: applyMeta },
  text: { file: 'events_text.json', parts: /^events_text(_\d+)?\.json$/, apply: applyText },
  tours: { file: 'tours.json', apply: (t) => { db.tours = (t && (t.tours || t)) || []; } },
  rhymes: { file: 'rhymes.json', apply: (r) => { db.rhymes = (r && (Array.isArray(r) ? r : r.rhymes || r.pairs)) || []; } },
  flows: { file: 'capital_flows.json', apply: applyFlows },
  predictions: { file: 'predictions.json', apply: applyPreds },
  forecasts: { file: 'forecasts.json', apply: applyForecasts },
  cards: { file: 'decade_cards.json', apply: applyCards },
  centuries: { file: 'century_lines.json', apply: applyCenturies },
  highlights: { file: 'highlights.json', apply: applyHighlights },
  diffusion: { file: 'diffusion.json', apply: applyDiffusion },
  markers: { file: 'markers.json', apply: (j) => { db.markers = (j && j.markers) || []; } }, // stage 8: short labels on the coil
  benchmarks: { file: 'benchmarks.json', apply: applyBench },
  talent: { file: 'talent.json', apply: applyTalent },
  policy_core: { file: 'policy_core.json', apply: applyPolicy },
  // 'policy' is what views and drawers ask for: the core (dates, kinds, places) plus the summaries and sources
  policy: { file: 'policy_text.json', after: 'policy_core', apply: applyPolicyText, fallback: { file: 'policy.json', apply: applyPolicy } },
  patterns: { file: 'patterns.json', apply: (p) => { db.patterns = (p && p.patterns) || []; } },
  impact: { file: 'impact.json', apply: (i) => { db.impact = i; } },
  links: { file: 'links.json', apply: (l) => { db.links = l && l.events ? l : { events: {}, names: {}, years: {} }; } },
  // the 17 series in one file (series_all.json); an older build without it is read file by file from the index
  series: { file: 'series_all.json', apply: (arr) => { db.series = (Array.isArray(arr) ? arr : (arr && arr.series) || []).filter(Boolean); } },
};
// views that read db.series in their first render: the Today composite (the Anatomy, Strata, Models and Benchmarks
// sections read it, and a deep link to any section mounts the Anatomy), Diffusion, Patterns, Play. The views of
// the History tab, Impact and the Ledger draw from the record alone, so on those deep links the series follow
// the first marks instead of sharing the first wave with them.
// (registry ids after viewOf resolves the aliases: anatomy, money, models, rules, adoption, findings and the three Play tabs)
const SERIES_FIRST = new Set(['anatomy', 'money', 'models', 'rules', 'adoption', 'findings', 'first', 'year', 'beat']);
function initialView() {
  try { return viewOf(hashParams().get('v') || 'spiral').id; } catch { return 'spiral'; }
}
// phones (the mobile gate): speculative files leave one at a time after paint, and the summaries and sources (the
// largest file) only when something asks for them (the evidence panel, the search, a view)
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
const saveData = () => !!(typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData);
export const lean = () => narrow() || saveData();
// which optional files exist in this build (from the manifest)
let available = null;
const pending = new Map();
// The paint gate: speculative loads (a section asking for data it can draw without, the idle text prefetch) wait
// until the first view has painted, so the first marks never queue behind a megabyte of later data. A view that
// cannot draw without a dataset asks with ensureNow, which opens the gate for that file at once.
let painted = false, openGate = null;
const gate = new Promise((r) => { openGate = r; });
// The shell calls markPainted when the first view has its marks on screen or 1.2 s after it was ready. On a slow
// CPU the second case comes first (the Anatomy is still drawing), so the gate opens at the next idle moment
// instead: the later files then leave once the main thread has finished the first drawing (a 2.5 s backstop).
let paintCalled = false;
export function markPainted() {
  if (paintCalled) return;
  paintCalled = true;
  const open = () => { if (!painted) { painted = true; openGate(); if (window.performance && performance.mark) performance.mark('histomap-painted'); } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(open, { timeout: 2500 }); else setTimeout(open, 0);
}
const releases = new Map();
let queue = Promise.resolve();
function start(n, now) {
  if (db.loaded.has(n)) return Promise.resolve();
  const L = LOADERS[n];
  if (!L) return Promise.resolve();
  if (!pending.has(n)) {
    const has = (f) => !available || available.includes(f);
    // an older build without the split file: the fallback file carries everything
    const F = L.fallback && !has(L.file) && has(L.fallback.file) ? L.fallback : null;
    // a dataset written in parts (events_text.json, events_text_2.json, ...: the host redirects files over 10 MiB to
    // storage that refuses cross-origin reads) is fetched part by part and merged before apply
    const parts = L.parts ? (available || []).filter((f) => L.parts.test(f)).sort() : [];
    const fetchParts = () => Promise.all(parts.map((f) => getJSON(vurl(f), null))).then((js) => {
      const first = js.find(Boolean);
      if (!first) return null;
      const events = {};
      for (const j of js) if (j) Object.assign(events, j.events || j);
      return { ...first, events };
    });
    const fetchIt = () => (F ? getJSON(vurl(F.file), null) : parts.length > 1 ? fetchParts() : has(L.file) ? getJSON(vurl(L.file), null) : Promise.resolve(null));
    const go = () => (L.after && !F ? start(L.after, true) : Promise.resolve()).then(fetchIt).then(async (json) => {
      await (F ? F.apply : L.apply)(json);
      db.loaded.add(n);
      emit(n);
    });
    if (now || painted) pending.set(n, go());
    else {
      let release = null;
      pending.set(n, new Promise((res) => { let done = false; release = () => { if (!done) { done = true; res(go()); } }; }));
      releases.set(n, release);
      // after paint the speculative files leave in turn, one request at a time, so none of them shares a thin link
      // with the file a view is waiting for; a promotion to ensureNow still fetches at once
      gate.then(() => { queue = queue.then(() => { if (releases.has(n)) { release(); return pending.get(n).catch(() => {}); } }); });
    }
  } else if (now && releases.has(n)) releases.get(n)();  // promoted from speculative to required: fetch at once
  return pending.get(n);
}
export function ensure(...names) { return Promise.all(names.flat().filter(Boolean).map((n) => start(n, false))); }
export function ensureNow(...names) { return Promise.all(names.flat().filter(Boolean).map((n) => start(n, true))); }
// what views call at the top of render when they need a dataset: resolves to db once the data is in
export const need = (names) => ensureNow(names).then(() => db);
export const ensureAll = () => ensure(...Object.keys(LOADERS));
// a selection id names the dataset it needs
export const needsFor = (sel) => (!sel ? null : sel.startsWith('pred:') ? 'predictions' : sel.startsWith('fc:') ? 'forecasts' : sel.startsWith('bench:') ? 'benchmarks' : sel.startsWith('person:') ? 'talent' : sel.startsWith('policy:') ? 'policy' : sel.startsWith('deal:') ? 'flows' : null);

// ---- the record arrives in two waves: recent years first (what the home page draws), the rest right after paint ----
let HEAD = null;  // shared dictionaries of the encoded files
const KEY = { i: 'id', y: 'year', m: 'month', d: 'day', t: 'title', ts: 'title_short', do: 'domain', ty: 'type', s: 'significance', se: 'sentiment', r: 'region', c: 'century', a: 'ai_era', ey: 'end_year', ax: 'approximate_year', g: 'tags', k: 'connects', kd: 'kind', lm: 'landmark', dn: 'dense', db: 'dating_basis' };
function decodeEvents(pack) {
  // events_core.json / events_past.json: short keys, dictionary indexes for strings, connections as positions
  if (!pack) return [];
  if (Array.isArray(pack)) return pack;  // an older build: plain events
  HEAD = HEAD || pack;
  return (pack.events || []).map(decodeOne);
}
// the same decoding in chunks of CHUNK events across frames, shaped: no task over the 200 ms line on a 4x slower CPU
async function decodeEventsAsync(pack) {
  if (!pack) return [];
  if (Array.isArray(pack)) return pack.map(shape);
  HEAD = HEAD || pack;
  const src = pack.events || [], out = new Array(src.length);
  for (let i = 0; i < src.length; i += CHUNK) {
    const end = Math.min(src.length, i + CHUNK);
    for (let j = i; j < end; j++) out[j] = shape(decodeOne(src[j]));
    if (end < src.length) await breathe();
  }
  return out;
}
function decodeOne(o) {
  const H = HEAD;
  {
    const e = {};
    for (const k in o) {
      const K = KEY[k] || k, v = o[k];
      if (K === 'domain') e.domain = H.domains[v];
      else if (K === 'type') e.type = H.types[v];
      else if (K === 'region') e.region = H.regions[v];
      else if (K === 'ai_era') e.ai_era = H.eras[v];
      else if (K === 'tags') e.tags = v.map((i) => H.tags[i]);
      else if (K === 'connects') e._kpos = v;
      else if (K === 'approximate_year' || K === 'landmark' || K === 'dense') e[K] = !!v;
      else e[K] = v;
    }
    if (e.title_short == null) e.title_short = e.title;
    return e;
  }
}
const SHAPE = { people: [], orgs: [], tags: [], connects: [], month: null, day: null, end_year: null, ai_era: null, sentiment: 0, summary: '', sources: [] };
function shape(e) { return { ...SHAPE, ...e, t: e.year + ((e.month || 6.5) - 0.5) / 12 }; }
// positions in the full chronological list -> ids, once every event is known; until then the recent wave
// resolves what it can (connections into the past wait for the second wave)
let posToId = null;
async function index(all) {
  // all: every event known so far, in file order (chronological); the connection pass runs in chunks across frames
  db.events = all;
  all.forEach((e, i) => { e._i = i; });
  db.byId = new Map(all.map((e) => [e.id, e]));
  db.in = new Map();
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    if (e._kpos) e.connects = posToId ? e._kpos.map((p) => posToId[p]).filter((id) => id && db.byId.has(id) && id !== e.id) : e.connects || [];
    else e.connects = (e.connects || []).filter((c) => db.byId.has(c) && c !== e.id);
    for (const c of e.connects) {
      if (!db.in.has(c)) db.in.set(c, []);
      db.in.get(c).push(e.id);
    }
    if (i % (CHUNK * 2) === CHUNK * 2 - 1 && i + 1 < all.length) await breathe();
  }
  const tc = new Map();
  for (const e of all) for (const t of e.tags || []) tc.set(t, (tc.get(t) || 0) + 1);
  db.tags = [...tc].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
  db.complete = !HEAD || all.length >= (HEAD.total || 0);
}
function buildPos(recent, past) {
  // the build numbers connections by position in the full chronological list; past events come first in it
  const full = [...past, ...recent];
  posToId = full.map((e) => e.id);
  return full;
}
async function mergePast(pack) {
  if (!pack) { db.complete = true; return; }
  performance.mark('past-fetched');
  await breathe();  // the parse of the file was one task; the decode starts in the next
  const past = await decodeEventsAsync(pack);
  performance.mark('past-decoded');
  const recent = db.events;
  const all = buildPos(recent, past);
  await index(all);
  performance.mark('past-indexed');
  if (db.loaded.has('meta')) applyMeta(db._metaJson);
  if (db.loaded.has('text')) applyText(db._textJson);
  await breathe();  // the listeners (filters, the view on stage) run in a task of their own
}

export async function load() {
  // first wave: only what the home page draws. Recent events (events_core.json, encoded), series, models and
  // the anatomy map. The rest of the record (events_past.json) follows the moment the first view has painted,
  // and every other dataset when its view, drawer or search first asks for it.
  const man = await getJSON(`data/manifest.json${typeof window !== 'undefined' && window.__BUILD ? `?v=${window.__BUILD}` : ''}`, { optional: [] }); // the build stamp (index.html) defeats the proxy's hour-long cache
  VER = man.version || '';
  available = [...(man.optional || []), ...(man.core || [])];
  db.manifest = man;
  const view = initialView();
  const home = view === 'anatomy';
  // the series: one request when the build bundles them, else the index and 17 files. A view that draws without
  // them lets them follow its first marks (the paint gate); every other view takes them in the first wave.
  if (!(man.core || []).includes('series_all.json')) {
    LOADERS.series = { file: 'series_index.json', apply: () => {} };
    pending.set('series', getJSON(vurl('series_index.json'), []).then((sidx) => Promise.all(sidx.map((s) => getJSON(vurl(`series/${s.id}.json`), null)))).then((arr) => { db.series = arr.filter(Boolean); db.loaded.add('series'); emit('series'); }));
  }
  const seriesP = SERIES_FIRST.has(view) ? ensureNow('series') : ensure('series');
  const coreFile = (man.core || []).includes('events_core.json') ? 'events_core.json' : 'events.json';
  const [pack, models, amap] = await Promise.all([
    getJSON(vurl(coreFile), []),
    getJSON(vurl('ai_models.json'), null),
    home && (man.optional || []).includes('anatomy_map.json') ? getJSON(vurl('anatomy_map.json'), null) : Promise.resolve(null),
    SERIES_FIRST.has(view) ? seriesP : Promise.resolve(),
    // the home draws the Anatomy's rules flow from the policy count: its small core joins the first wave here
    // instead of going out in a round trip of its own once the shell is up
    home && (man.optional || []).includes('policy_core.json') ? ensureNow('policy_core') : Promise.resolve(),
  ]);
  db.anatomyMap = amap && amap.map ? new Map(Object.entries(amap.map)) : null;
  const mark = (n) => { if (typeof performance !== 'undefined' && performance.mark) performance.mark(n); };
  mark('core-fetched');
  const recent = await decodeEventsAsync(pack);
  mark('core-decoded');
  const twoWave = !!HEAD && (man.core || []).includes('events_past.json');
  if (!twoWave) { posToId = recent.map((e) => e.id); db.loaded.add('past'); if (coreFile === 'events.json') { db.loaded.add('text'); db.loaded.add('meta'); } }
  else {
    // recent events sit at the end of the chronological list, so their connections among themselves resolve now
    const nPast = Math.max(0, (HEAD.total || recent.length) - recent.length);
    posToId = new Array(nPast + recent.length).fill(null);
    recent.forEach((e, i) => { posToId[nPast + i] = e.id; });
  }
  await index(recent);
  mark('core-indexed');
  emit('core');  // the recent wave is indexed: the intro draws its coil now, before the first view renders
  db.models = models;
  const ml = Array.isArray(models) ? models : models?.models || [];
  db.modelList = ml.map((m) => {
    const [y, mo] = String(m.date || '').split('-').map(Number);
    const slug = (m.name + '-' + m.date).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { ...m, id: 'model:' + slug, year: y, month: mo || null, t: y + ((mo || 6.5) - 0.5) / 12 };
  });
  db.modelById = new Map(db.modelList.map((m) => [m.id, m]));
  return db;
}

export const neighbors = (id) => {
  const e = db.byId.get(id);
  if (!e) return [];
  return [...new Set([...(e.connects || []), ...(db.in.get(id) || [])])];
};

// Filter predicate excluding the year window (views decide how to treat time).
// Vision 4, S5 and S6: what the millennium views draw. `register` picks the landmark register (one entry per episode,
// landmark: true from data/landmarks.json) or the whole record; 'auto' means landmarks when the window spans more than
// 300 years and the whole record once it sits inside 1950 to 2026 (and for any window of 300 years or less). `overlays`
// shows the five European period entries (kind 'overlay'), off by default. Search, the drawer and the counts keep
// using passes(); the Stream, Columns and Wheel draw with drawn().
export const draw = { register: 'auto', overlays: false };
export const registerFor = (s = state) => (draw.register !== 'auto' ? draw.register : (s.y1 - s.y0 > 300 ? 'landmarks' : 'all'));
export const registerLabel = (s = state) => (registerFor(s) === 'landmarks' ? 'Landmarks: one entry per episode at significance 5' : 'All: the whole record');
// Overlays are never events in a census: drawn() leaves them out unless the caller asks for them (the Stream and
// Columns do, for their drawing set only); counts, the Wheel and every other view never see them. Under 600px the
// switch is hidden and overlays stay off, so the count never moves with a control the reader cannot see.
// d3 (92 KB gz) loads only for the drawings that use it: the registry's D3-free modules (Now, the limits sheet, Play)
// mount without it, and History's locator, the search timeline and the evidence panel's graph ask for it when they draw.
// Resolves once window.d3 exists; dispatches 'd3-ready' on the document the first time.
let d3P = null;
export function ensureD3() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.d3) return Promise.resolve(window.d3);
  if (!d3P) d3P = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'js/vendor/d3.min.js';
    sc.onload = () => { document.dispatchEvent(new CustomEvent('d3-ready')); res(window.d3); };
    sc.onerror = () => { d3P = null; rej(new Error('d3 failed to load')); };
    document.head.appendChild(sc);
  });
  return d3P;
}
export const hasD3 = () => typeof window !== 'undefined' && !!window.d3;
// THE ONE ARCHIVE TOTAL (council round 1): every count derives from here. Overlays (the five European period entries)
// are records but never events; landmarks are the register's events. Views name which of the two they draw.
export function census() {
  const ev = db.events.filter((e) => e.kind !== 'overlay');
  const got = { events: ev.length, landmarks: ev.filter((e) => e.landmark).length, overlays: db.events.length - ev.length, records: db.events.length };
  if (db.loaded.has('past')) return got;
  // before the past wave lands the record is partial: the manifest carries the build's totals (events counts overlays as
  // records; landmarks and overlays from the manifest when the build writes them, else from the recent wave)
  const M = db.manifest || {};
  const records = M.events || got.records, overlays = M.overlays != null ? M.overlays : got.overlays;
  return { events: records - overlays, landmarks: M.landmarks != null ? M.landmarks : got.landmarks, overlays, records, partial: true };
}
// THIN RECORD (one unit, one rule): a region with under six events in a century, counted on the whole archive, never
// on the Draw register or the filters, so the hatch means the same thing on every drawing. Cells are { region, c, n }
// for the centuries that touch the window; thinKey(e) names an event's cell.
export const THIN_UNDER = 6;
let thinCache = null;
export function thinCells(y0 = state.y0, y1 = state.y1) {
  if (!thinCache || thinCache.n !== db.events.length) {
    const m = new Map();
    for (const e of db.events) { if (e.kind === 'overlay' || !e.region) continue; const k = `${e.region}:${Math.floor(e.year / 100) * 100}`; m.set(k, (m.get(k) || 0) + 1); }
    thinCache = { n: db.events.length, m };
  }
  const out = [];
  const regions = new Set(db.events.map((e) => e.region).filter(Boolean));
  for (const r of regions) for (let c = Math.floor(y0 / 100) * 100; c <= y1; c += 100) { const n = thinCache.m.get(`${r}:${c}`) || 0; if (n < THIN_UNDER) out.push({ region: r, c, n }); }
  return out;
}
export const thinKey = (e) => `${e.region}:${Math.floor(e.year / 100) * 100}`;
export const overlaysOn = () => draw.overlays && (typeof matchMedia !== 'function' || matchMedia('(min-width: 600px)').matches);
export function drawn(e, s = state, withOverlays = false) {
  if (e.kind === 'overlay') return withOverlays && overlaysOn() && passes(e, s);
  if (registerFor(s) === 'landmarks' && !e.landmark) return false;
  return passes(e, s);
}
export function passes(e, s = state) {
  if (!s.domains.has(e.domain)) return false;
  if (s.types && !s.types.has(e.type)) return false;
  if (s.thread && !(e.tags || []).includes(s.thread)) return false;
  if (s.q) {
    const terms = s.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (e._txt == null) e._txt = txtOf(e);
    for (const t of terms) if (!e._txt.includes(t)) return false;
  }
  return true;
}
export const inYears = (e, s = state) => e.year >= s.y0 && e.year <= s.y1;

// The AI count, one definition wherever a sentence states it. An event is about AI when its domain is 'ai'; `from` and
// `to` bound its year, inclusive. Strata also layers events from other domains that carry an AI era or precursor tag
// (`layered: true`), which is why its count runs higher than the arrival's and Play's for the same century. Every
// event in the record carries a year, so there is no undated remainder to state.
//   arrival  aiCount()                                   events about AI, all years
//   Play     aiCount({ from: 1926 })                     events about AI, 1926 on
//   Strata   aiCount({ from: 1926, to: 2026, layered: true })  AI and AI-tagged events in the century
export function aiCount({ from = -Infinity, to = Infinity, layered = false } = {}) {
  let n = 0;
  for (const e of db.events) if ((e.domain === 'ai' || (layered && (e.ai_era || e.ai_precursor))) && e.year >= from && e.year <= to) n++;
  return n;
}

// Whether a record the hash names exists, once its dataset is in. Prefixed ids name a dataset's records; a plain id is
// an event, which may sit in the past wave; any other prefix is a view's own record (a list, a series point) that the
// view registers under db.pointById when it draws, so it is left to the view.
const RECORD_SETS = { 'pred:': ['predictions', 'predById'], 'bench:': ['benchmarks', 'benchById'], 'person:': ['talent', 'personById'], 'policy:': ['policy', 'policyById'], 'deal:': ['flows', 'dealById'], 'model:': [null, 'modelById'] };
export async function hasRecord(id) {
  if (!id) return true;
  if (db.pointById && db.pointById.has(id)) return true;  // a list or series point a view registered
  const k = Object.keys(RECORD_SETS).find((p) => id.startsWith(p));
  if (k) { const [set, map] = RECORD_SETS[k]; if (set) await ensureNow(set); return !!(db[map] && db[map].has(id)); }
  if (id.includes(':')) return true;
  if (db.byId.has(id)) return true;
  await ensureNow('past');
  return db.byId.has(id);
}
export const filtered = (s = state) => db.events.filter((e) => passes(e, s));

export function fmtDate(e) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let s = '';
  if (e.month) s += (e.day ? e.day + ' ' : '') + M[e.month - 1] + ' ';
  if (/^(radiocarbon|typological|stratigraphy|luminescence|mixed)$/.test(e.dating_basis || '')) s += 'c. '; // a scientific date carries its range; the record's note gives the method
  s += fmtYear(e.year);
  if (e.end_year && e.end_year !== e.year) s += ' to ' + fmtYear(e.end_year);
  return s;
}
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// Events that describe a model release: name match on a word boundary, same or adjacent year, closest month first.
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUFFIX = /[- ](?:\d+(?:\.\d+)?[BMT]|Large|mini|Maverick|Preview|Exp|Opus|Sonnet|Ultra|Pro|A\d+B|\d+x\d+B|base\/big)$/i;
function modelNames(m) {
  const raw = m.name.replace(/^OpenAI /, '');
  const out = new Set([raw, raw.replace(/\s*\(.*?\)\s*/g, ' ').trim()]);
  (raw.match(/\(([^)]+)\)/) || []).slice(1).forEach((s) => out.add(s));
  for (const n of [...out]) { let b = n; for (let i = 0; i < 3 && SUFFIX.test(b); i++) { b = b.replace(SUFFIX, '').trim(); if (b.length >= 3) out.add(b); } }
  return [...out].filter((s) => s.length > 1 && !/^(Transformer|Claude|Gemini|Mistral|GPT|Llama)$/i.test(s) || s === raw);
}
export function modelEvents(m) {
  if (!m) return [];
  if (m._ev) return m._ev;
  const names = modelNames(m);
  const res = names.map((n) => new RegExp(`(^|[^A-Za-z0-9.])${escRe(n)}(?![A-Za-z0-9]|\\.\\d)`, 'i'));
  // "DeepSeek-R1" also matches "DeepSeek releases R1"
  const pm = m.name.match(/^([A-Z][A-Za-z]+)-([A-Z]\d[\w.]*)$/);
  const pre = pm ? [new RegExp(escRe(pm[1]), 'i'), new RegExp(`(^|[^A-Za-z0-9.])${escRe(pm[2])}(?![A-Za-z0-9]|\\.\\d)`)] : null;
  const out = [];
  for (const e of db.events) {
    if (Math.abs(e.year - m.year) > 1) continue;
    if (!(e.domain === 'ai' || e.domain === 'semiconductors' || e.domain === 'software')) continue;
    const t = e.title.replace(/\u00b7/g, '-');
    let hit = null, exact = false;
    res.forEach((r, i) => { const mm = r.exec(t); if (mm && (!hit || names[i].length > hit.n.length)) hit = { n: names[i], at: mm.index + mm[0].length }; });
    if (!hit && pre && pre[0].test(t) && pre[1].test(t)) hit = { n: pm[2], at: t.search(pre[1]) + pm[2].length + 1 };
    if (!hit) continue;
    exact = hit.n.length >= m.name.replace(/^OpenAI /, '').replace(/\s*\(.*?\)\s*/g, ' ').trim().length;
    const after = t.slice(hit.at);
    const cont = /^[\s-]+(?:[A-Z0-9]|mini\b|pro\b|turbo\b)/.test(after) || /^o\b/.test(after);
    const dm = e.year === m.year && e.month && m.month ? Math.abs(e.month - m.month) : 6 + Math.abs(e.year - m.year) * 12;
    out.push([e, dm + (cont ? 4 : 0) + (exact ? 0 : 2) - (e.type === 'product' ? 0.5 : 0)]);
  }
  m._ev = out.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  return m._ev;
}

// Normalize any multi-line series shape into [{name, points}]
export function seriesLines(s) {
  if (!s) return [];
  if (s.technologies) return Object.entries(s.technologies).map(([name, pts]) => ({ name, points: pts }));
  if (s.groups && typeof s.groups === 'object' && !Array.isArray(s.groups)) {
    const g = Object.entries(s.groups).filter(([, p]) => Array.isArray(p)).map(([name, points]) => ({ name, points }));
    if (g.length) return g;
  }
  const out = [{ name: s.title, points: s.points || [] }];
  if (s.secondary && s.secondary.points) out.push({ name: s.secondary.title || 'secondary', points: s.secondary.points, secondary: true });
  if (s.data_center_points) out.push({ name: 'Data Center revenue', points: s.data_center_points, secondary: true });
  return out;
}
export const seriesById = (id) => db.series.find((x) => x.id === id);
