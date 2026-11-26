// Tiny state store with URL-hash persistence.
import { DOMAINS } from './palette.js';

export { YEAR_MIN, YEAR_MAX } from './time.js';
import { YEAR_MIN, YEAR_MAX } from './time.js';

// One page (council/brief_stage4.md, stage 4d): the Histomap, the helix of the whole record with its claims and
// forecasts. The AI tab (Beliefs, Ideas, Horizons) and the Ledger retired on 2 November 2026; their modules rest under
// js/retired/ and their ids below alias to the helix so no URL breaks.
export const TABS = [
  { id: 'map', label: 'Histomap', sub: '1026 to 2026, with roots', view: 'spiral' },
];
// THE REGISTRY. One entry per tab: id is the hash (#v=<id>), tab the page, module the file under js/views/ whose default
// export is (el, ctx) => ({ render, resize?, hover?, lit?, teardown? }). `screens` lists one module per screen (screens[0]
// draws screen 1) so a tab can have more than one owner; a tab without it runs one module for every screen and reads
// state.screen itself. `mount` shares one module instance between ids. `nav: false` keeps the URL but leaves the tab row.
// `budget` is the screen budget at 1440x900 (tools/gate_budget.js). The retired pages' modules (Impact, Play, the AI
// sub tabs, History's drawings) stay in the repo; their ids alias to 'spiral' below so no URL breaks.
export const VIEWS = [
  // Histomap
  { id: 'spiral', tab: 'map', label: 'The Histomap', sh: 'Histomap', module: 'helix', budget: 1 },  // the helix frame (views/helix.js); views/spiral.js stays in the repo, not mounted
];
// the old AI page's section ids, kept as the plate names the placeholder host understands
export const PLATES = ['anatomy', 'strata', 'genealogy', 'capital', 'benchmarks', 'policy', 'lineage'];
export const VIEW = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
export const TAB = Object.fromEntries(TABS.map((t) => [t.id, t]));
// Every old URL resolves (Vision 4 Addendum): the composed AI page and its sections, the retired tab ids, the drawings
// that left the tab row under their old names. An alias may carry the screen it lands on (ALIAS_SCREEN).
// every retired id lands on the spiral (SPIRAL_SPEC.md: no URL breaks)
const RETIRED = ['now', 'anatomy', 'money', 'models', 'rules', 'stream', 'centuries', 'threads', 'findings', 'adoption', 'wheel', 'arcs',
  'millennium', 'decade', 'regions', 'shadows', 'first', 'year', 'beat',
  'today', 'moment', 'capital', 'strata', 'genealogy', 'benchmarks', 'lineage', 'talent', 'policy', 'columns', 'patterns', 'diffusion',
  'matrix', 'rates', 'impact', 'play', 'past', 'history', 'games',
  // the AI tab and the Ledger (retired 2 November 2026, stage 4d): their views, their old names and the tab ids
  'beliefs', 'ideas', 'ideahorizons', 'speed', 'ai', 'forecasts', 'aiforecasts', 'predictions', 'right', 'horizon', 'ledger'];
export const VIEW_ALIAS = {
  ...Object.fromEntries(RETIRED.map((id) => [id, 'spiral'])),
  ...Object.fromEntries(TABS.filter((t) => !VIEWS.some((v) => v.id === t.id)).map((t) => [t.id, VIEWS.find((v) => v.tab === t.id).id])),
};
export const ALIAS_SCREEN = {};
export const viewOf = (id) => VIEW[VIEW_ALIAS[id] || id] || VIEW.spiral;
export const resolveView = (id) => (VIEW[id] ? id : VIEW_ALIAS[id] && VIEW[VIEW_ALIAS[id]] ? VIEW_ALIAS[id] : null);
export const tabOf = (id) => viewOf(id).tab;
// the module file that renders a view id (today sections share one module)
// the module drawing a view's screen: the screens list when the tab has one, else the tab's module; 'today:<plate>' is
// the placeholder host with a plate name
export const screenModule = (id, screen = 1) => { const v = viewOf(id); const m = v.screens ? v.screens[Math.min(Math.max(1, screen), v.screens.length) - 1] : v.module || v.id; return m.split(':')[0]; };
export const screenPlate = (id, screen = 1) => { const v = viewOf(id); const m = v.screens ? v.screens[Math.min(Math.max(1, screen), v.screens.length) - 1] : v.module || v.id; return m.includes(':') ? m.split(':')[1] : null; };
export const screensOf = (id) => { const v = viewOf(id); return v.screens ? v.screens.length : v.budget || 1; };
export const moduleOf = (id, screen) => screenModule(id, screen);
// id used to key the mounted element (sections share the composite)
// the mount key: one element per (view, module) so a tab's screens from different owners stand side by side; the
// placeholder host and shared modules mount once under their own name
export const mountOf = (id, screen = 1) => { const v = viewOf(id); const m = screenModule(id, screen); if (m === 'today') return 'today'; if (v.mount) return v.mount; return v.screens ? `${v.id}:${m}` : v.id; };

const defaults = () => ({
  view: 'spiral',
  y0: YEAR_MIN,
  y1: YEAR_MAX,
  domains: new Set(DOMAINS.map((d) => d.id)),
  types: null, // null = all
  thread: '',
  q: '',
  sel: '',
  mode: '', // per-view sub mode (e.g. stream share/volume)
  tour: '', // active guided tour id
  step: 0,
  at: '', // a landing inside the view (an element id, or m-<id> for a record card); cleared once the view has scrolled to it
  screen: 1, // the screen within the tab (1-based, hash s=); back to 1 when the view changes
  issue: '', // Policy's subject filter (#issue=<id>); carried in the hash only when set, cleared when the view leaves Policy
});

const listeners = new Set();
export const state = defaults();
let hover = null;
const hoverListeners = new Set();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onHover(fn) { hoverListeners.add(fn); return () => hoverListeners.delete(fn); }
export function getHover() { return hover; }
export function setHover(id) {
  if (id === hover) return;
  hover = id;
  hoverListeners.forEach((f) => f(hover));
}

let pending = null;
let changedKeys = new Set();
export function set(patch, { replace = false } = {}) {
  let any = false;
  // a view named by an old id (an alias) is stored and written under its registry id, so the hash is always canonical
  if (patch.view && VIEW_ALIAS[patch.view] && !VIEW[patch.view]) patch = { ...patch, view: VIEW_ALIAS[patch.view], ...(ALIAS_SCREEN[patch.view] && !('screen' in patch) ? { screen: ALIAS_SCREEN[patch.view] } : {}) };
  else if (patch.view && !VIEW[patch.view]) patch = { ...patch, view: 'spiral' };  // an unknown id lands on the map
  if (patch.view && patch.view !== 'rules' && state.issue && !('issue' in patch)) patch = { ...patch, issue: '' };  // the subject filter belongs to Rules (Policy)
  if (patch.view && patch.view !== state.view && !('screen' in patch)) patch = { ...patch, screen: 1 };  // a new tab opens on its first screen
  for (const [k, v] of Object.entries(patch)) {
    const cur = state[k];
    const same = cur instanceof Set && v instanceof Set ? cur.size === v.size && [...v].every((x) => cur.has(x)) : cur === v;
    if (!same) { state[k] = v; changedKeys.add(k); any = true; }
  }
  if (!any) return;
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    const ch = changedKeys; changedKeys = new Set();
    writeHash(replace || !(ch.has('view') || ch.has('sel')), ch);
    listeners.forEach((f) => f(state, ch));
  });
}

// hash keys the spiral owns (spiral.js writes them with replaceState); the store carries them through its own writes
export const SPIRAL_KEYS = ['born', 'fy', 'z'];
function writeHash(replace, ch = new Set()) {
  const p = new URLSearchParams();
  p.set('v', state.view);
  if (state.y0 !== YEAR_MIN || state.y1 !== YEAR_MAX) p.set('y', `${state.y0}-${state.y1}`);
  if (state.domains.size !== DOMAINS.length) p.set('d', [...state.domains].join(','));
  if (state.types) p.set('t', [...state.types].join(','));
  if (state.thread) p.set('th', state.thread);
  if (state.q) p.set('q', state.q);
  if (state.sel) p.set('e', state.sel);
  if (state.mode) p.set('m', state.mode);
  if (state.tour) p.set('tr', `${state.tour}.${state.step + 1}`);
  if (state.at) p.set('at', state.at);
  if (state.screen > 1) p.set('s', String(state.screen));
  // Policy writes #issue= itself (replaceState, no hashchange): while on Policy the hash's issue is taken as the filter's
  // current value unless this very write carries a new one, so neither side drops the other's
  if (state.view === 'rules' && !ch.has('issue')) state.issue = (hashParams().get('issue') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (state.issue) p.set('issue', state.issue);
  // the spiral's birth flag (SPIRAL_DIRECTION item 1): spiral.js writes born=1 after the first play; every later write
  // carries it, so a reload or a back step skips the birth and only a fresh visit replays it
  // ... and its camera: fy (the focused year, 2026.79) and z (the depth, 14.0), written by spiral.js once the camera
  // rests, so a reload returns to the place. Not y and d: those are the shell's year range and domain filter.
  if (state.view === 'spiral') { const hp = hashParams(); for (const k of SPIRAL_KEYS) { const val = hp.get(k); if (val) p.set(k, val); } }
  const h = '#' + p.toString().replace(/%2C/g, ',');
  if (h === location.hash) return;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
}

// THE HASH, TOTAL: every form boots the shell and lands on a tab. Key=value hashes read as they are (#v=now&s=2); a
// path-like hash with no '=' (#ai/now, #history/stream, #/history, #now, #!/play) is read as page and tab segments, each
// resolved as a tab id, a legacy alias or a page (history and past are History); nothing here throws, and an unknown or
// malformed hash leaves v unset, which readHash lands on Now.
const PAGE_WORDS = { map: 'map', histomap: 'map', spiral: 'map', history: 'map', past: 'map', impact: 'map', play: 'map', ai: 'ai', today: 'ai', ledger: 'ledger' };
export function hashParams(hash = location.hash) {
  try {
    let h = String(hash || '').replace(/^#/, '');
    if (!h.includes('=')) {
      const segs = h.replace(/^!?\/+/, '').split(/[\/&?]+/).map((x) => decodeURIComponent(x).trim().toLowerCase()).filter(Boolean);
      const p = new URLSearchParams();
      let v = null;
      for (const g of segs) {
        if (VIEWS.some((x) => x.id === g) || VIEW_ALIAS[g]) v = VIEW_ALIAS[g] || g;
        else if (PAGE_WORDS[g] && !v) { const t = TABS.find((x) => x.id === PAGE_WORDS[g]); if (t) v = t.view; }
        else if (/^[1-9]$/.test(g) && v) p.set('s', g);  // a trailing digit is the screen (#ai/rules/2)
      }
      if (v) p.set('v', v);
      return p;
    }
    return new URLSearchParams(h);
  } catch { return new URLSearchParams(); }
}
export const pathLikeHash = (hash = location.hash) => { const h = String(hash || '').replace(/^#/, ''); return h.length > 0 && !h.includes('='); };
export function readHash() {
  const p = hashParams();
  const s = defaults();
  const v = p.get('v');
  if (v && (VIEWS.some((x) => x.id === v) || VIEW_ALIAS[v])) s.view = VIEW_ALIAS[v] || v;
  const y = p.get('y');
  if (y) {
    const [a, b] = y.split('-').map(Number);
    if (a >= YEAR_MIN && b <= YEAR_MAX && a < b) { s.y0 = a; s.y1 = b; }
  }
  if (p.get('d')) s.domains = new Set(p.get('d').split(',').filter(Boolean));
  if (p.get('t')) s.types = new Set(p.get('t').split(',').filter(Boolean));
  s.thread = p.get('th') || '';
  s.q = p.get('q') || '';
  s.sel = p.get('e') || '';
  s.mode = p.get('m') || '';
  const tr = (p.get('tr') || '').match(/^([a-z0-9-]+)\.(\d+)$/);
  if (tr) { s.tour = tr[1]; s.step = Math.max(0, +tr[2] - 1); }
  s.at = (p.get('at') || '').replace(/[^a-zA-Z0-9_:.-]/g, '');
  const rawV = p.get('v') || '';
  s.screen = Math.max(1, parseInt(p.get('s'), 10) || ALIAS_SCREEN[rawV] || 1);
  s.issue = (p.get('issue') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return s;
}

export const canonHash = () => writeHash(true);
export function applyHash() {
  const s = readHash();
  const ch = new Set();
  for (const k of Object.keys(s)) {
    const a = state[k], b = s[k];
    const same = a instanceof Set && b instanceof Set ? a.size === b.size && [...b].every((x) => a.has(x)) : a === b;
    if (!same) { state[k] = b; ch.add(k); }
  }
  if (ch.size) listeners.forEach((f) => f(state, ch));
  // a legacy or unknown id in the address (#v=capital, #v=garbage, #v=) is rewritten in place to the tab it resolved to
  const raw = hashParams().get('v');
  if ((raw !== null && raw !== state.view) || pathLikeHash()) writeHash(true);
}

// Views that read a dataset the first paint did not carry call this at the top of render:
//   const db = await need(['predictions']);
// It resolves once the data is in memory (one fetch per file, cached), and at once when it already is.
export const need = (names) => import('./data.js').then((m) => m.need(names));

// a path-like address (#ai/now, #/history) is rewritten to its tab the moment the store loads, before the intro or the
// shell read it, so every module sees one form (#v=<id>)
try { if (pathLikeHash()) { const p = hashParams(); if (!p.get('v')) p.set('v', 'spiral'); history.replaceState(null, '', '#' + p.toString()); } } catch { /* no history API: readHash still lands on Now */ }
