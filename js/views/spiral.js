// Page 1, the Histomap: the whole record wound as a spiral timeline on one canvas (SPIRAL_SPEC.md, SPIRAL_DIRECTION.md).
// One turn per century, 1026 at the center, 2026 at the rim, clockwise from 12 o'clock. A turn's width is its share
// of the record (the square root of its event count); inside a turn, thirteen domain rings, each as wide as the
// domain's share of that century; inside a ring, each year is a box, and the year's events fill the box as a grid of
// arc cells, so dense years read as solid walls and sparse centuries as scattered ticks. Nothing is hand-picked:
// every event is a cell. Color is a woven textile: thirteen hue families of five steps, significance as the step,
// on a deep indigo ground. Time is visible as motion: the spiral is born on the first visit, breathes at rest, and
// zoom is a dive through cell, glyph, title and summary. spiral_ui.js builds the strip, tip and record opening on top.
import { db, ym, onData, ensure } from '../data.js';
import { subscribe as subscribeStore } from '../store.js';

/* ---------- color: thirteen hue families, five steps each (1 a pale tint, 5 the deep saturated ink) ----------
   Printed-ink tints for an indigo ground, from the direction's words. Significance 1..5 is the step. The same hex
   values sit in spiral.css as --sp-<domain>-1..5 for the DOM around the canvas. */
import { SPIRAL } from '../spectrum.js';
// One spectrum for the whole site (js/spectrum.js): the coil's five era steps per domain come from it, so the globe's
// grains and the coil they land on share every hue.
export const PALETTE = SPIRAL;
export const GROUND = '#141a3d';
const INK = '#eef0fa', INK2 = '#aeb6dc';
const light = (a) => `rgba(238,240,250,${a})`; // tinted light for coil, rays and glass; never pure white hairlines
export const familyColor = (domain, step = 3) => (PALETTE[domain] || PALETTE.computing)[clamp(Math.round(step) - 1, 0, 4)];
export const colorOf = (e) => familyColor(e.domain, e.significance || 3);
export const stepsOf = (domain) => PALETTE[domain] || PALETTE.computing;

/* ---------- constants ---------- */
export const Y0 = 1026, Y1 = 2026, TURN = 100, NT = 10;
const T_END = Y1 + 0.98; // the last day of 2026: the coil's end
// the rings, inner to outer, in the frame's family order: AI, then computing's kin, life, power, people
export const LANES = ['ai', 'computing', 'semiconductors', 'software', 'internet', 'communications', 'biotech', 'health', 'agriculture', 'materials', 'energy', 'transport', 'space', 'home', 'society', 'media'];
const LANE_IX = Object.fromEntries(LANES.map((id, i) => [id, i]));
export const laneOf = (domain) => (domain in LANE_IX ? LANE_IX[domain] : -1);
const NL = LANES.length;
const SIZE_CAP = 7; // the glyph's largest radius; past that the title carries the event
const K_MIN = 1, K_MAX = 400;
const SHAPES = { invention: 'circle', discovery: 'circle', product: 'circle', person: 'circle', policy: 'square', fear: 'down', failure: 'down', incident: 'down', hope: 'up', concept: 'up', culture: 'up', milestone: 'ring', market: 'ring', era: 'ring' };
export const markOf = (type) => SHAPES[type] || 'circle';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (x, a, b) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
// the eight objects of the intro, named on leaders at the millennium (every event stays a cell; leaders are labels)
const OBJECTS = [['su-song-astronomical-clock-1092', 'Su Song\u2019s clock'], ['jikji-metal-type-1377-1377', 'Jikji'], ['gutenberg-press-1450', 'Gutenberg\u2019s press'], ['newcomen-engine-1712', 'Newcomen engine'], ['morse-telegraph-1844', 'telegraph'], ['transistor-1947', 'transistor'], ['www-public-1991', 'World Wide Web'], ['gpt-6-astra-2026', 'GPT-6 Astra']];

/* ---------- geometry (map units: CSS px at k = 1, origin at the spiral's center) ---------- */
export const geo = { R: 400, r0: 56, b: 34, bands: new Array(NT).fill(34), rStart: [], w: 800, h: 800, ox: 0, oy: 0, scale: 1 };
// the viewport's inset: the UI's panel and strip take room, the ring sits in what is free (setInset)
export const inset = { left: 0, right: 0, top: 0, bottom: 0 };
let nTurn = new Array(NT).fill(0), share = []; // events per turn; per turn, each ring's [o0, o1] fraction of the band
const turnOf = (t) => clamp(Math.floor((t - Y0) / TURN), 0, NT - 1);
function fitGeometry(w, h) {
  geo.w = w; geo.h = h;
  const phone = w < 760;
  // the strip takes the top row on desktop, the status the bottom left: the ring sits in the room between
  const top = (inset.top ? inset.top + 12 : phone ? 10 : 72), bottom = (phone ? 96 : 40) + inset.bottom;
  const left = inset.left, right = inset.right, fw = Math.max(120, w - left - right);
  geo.ox = left + fw / 2 - w / 2; geo.oy = (top - bottom) / 2;
  const margin = phone ? 20 : fw >= 1100 ? 44 : 32; // the rim's numerals sit outside the coil
  geo.R = Math.max(80, Math.min(fw - (phone ? 0 : fw >= 1000 ? 300 : 120), h - top - bottom) / 2 - margin); // room for leaders left and right
  geo.scale = geo.R < 260 ? 0.6 : 0.9;
  geo.r0 = 0.14 * geo.R;
  // turn widths: a floor plus the square root of the turn's share of the record; the rim is the last band's outer edge
  const nMax = Math.max(1, ...nTurn);
  const raw = nTurn.map((n) => 10 + 70 * Math.sqrt(n / nMax));
  const s = (geo.R - geo.r0) / (raw.reduce((a, b) => a + b, 0) + raw[NT - 1]);
  geo.bands = raw.map((x) => x * s);
  geo.b = (geo.R - geo.r0) / NT;
  geo.rStart = [geo.r0]; for (let t = 0; t < NT; t++) geo.rStart.push(geo.rStart[t] + geo.bands[t]);
}
export const thetaOf = (t) => (TAU * (t - Y0)) / TURN;
// the band's inner edge at year t, and its thickness there (the next turn starts where this one's width ends)
export const radiusOf = (t) => { const T = turnOf(t), f = (t - Y0 - T * TURN) / TURN; return geo.rStart[T] + geo.bands[T] * f; };
export const thickOf = (t) => { const T = turnOf(t), f = clamp((t - Y0 - T * TURN) / TURN, 0, 1); return T < NT - 1 ? geo.bands[T] + f * (geo.bands[T + 1] - geo.bands[T]) : geo.bands[T]; };
const outerOf = (t) => radiusOf(t) + thickOf(t);
const ringOf = (t, lane) => (share[turnOf(t)] || share[0] || [])[lane] || [lane / NL, (lane + 1) / NL];
const laneW = () => geo.b / NL; // the mean ring width, for label room
export const laneRadius = (t, lane, fan = 0) => { const [o0, o1] = ringOf(t, lane); return radiusOf(t) + thickOf(t) * (o0 + (o1 - o0) * (0.5 + fan)); };
const polar = (t, r) => { const a = thetaOf(t) - Math.PI / 2; return { x: r * Math.cos(a), y: r * Math.sin(a) }; };
export function project(t, lane, fan = 0) { return polar(t, lane == null ? outerOf(t) : laneRadius(t, lane, fan)); }
// the road camera: a year and a depth. The view rotates so the focused turn runs across the screen; at the
// millennium (depth near 1) the whole ring sits unrotated at the center, and the road takes over by depth 3
export const camera = { cx: 0, cy: 0, k: 1, rot: 0, year: Y1 - 0.25, depth: 1, center: Y1 - 0.25, altitude: 1 };
const M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; // map -> screen
const normAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const roadWeight = (k) => sm(k, 1.3, 3);
const midRadius = (t) => radiusOf(t) + thickOf(t) / 2;
// altitude: 0 at the year's page (depth 40), 1 at the whole spiral (depth 1), on a log scale between
const K_PAGE = 40;
export const altitudeOf = (k = camera.k) => clamp(Math.log(K_PAGE / k) / Math.log(K_PAGE / K_MIN), 0, 1);
export const kOfAltitude = (a) => K_PAGE * Math.pow(K_MIN / K_PAGE, clamp(a, 0, 1));
export const altitude = () => altitudeOf(camera.k);
const BACK = 0.16; // the dolly: how far behind the position the camera's center sits at full altitude, as a share of the view
function applyRoad() {
  const t = camera.year = clamp(camera.year, Y0 + 0.02, T_END);
  const k = camera.k = clamp(camera.depth, K_MIN, K_MAX);
  const f = roadWeight(k), a = altitudeOf(k);
  // the camera pulls back along the curve as it rises, so the road recedes and the position stays lit ahead
  const back = BACK * (geo.w < 760 ? 0.5 : 1) * a * (1 - pageWeight(k)) * (geo.w / Math.max(1, pxPerYear(k, t)));
  const c = camera.center = clamp(t - back, Y0 + 0.02, T_END);
  camera.altitude = a;
  const q = polar(c, midRadius(c));
  camera.cx = q.x * f; camera.cy = q.y * f;
  camera.rot = -normAngle(thetaOf(c)) * f;
  updateMatrix();
}
function updateMatrix() {
  const k = camera.k, cs = Math.cos(camera.rot) * k, sn = Math.sin(camera.rot) * k;
  M.a = cs; M.b = sn; M.c = -sn; M.d = cs;
  M.e = geo.w / 2 + geo.ox - (M.a * camera.cx + M.c * camera.cy);
  M.f = geo.h / 2 + geo.oy - (M.b * camera.cx + M.d * camera.cy);
}
export const toScreen = (x, y) => ({ x: M.a * x + M.c * y + M.e, y: M.b * x + M.d * y + M.f });
export const toMap = (sx, sy) => { const dx = sx - M.e, dy = sy - M.f, k2 = camera.k * camera.k; return { x: (M.a * dx + M.b * dy) / k2, y: (M.c * dx + M.d * dy) / k2 }; };
// pixels per year along the road at this depth
export const pageWeight = (k = camera.k) => sm(k, 24, 40); // the band straightens into the year's page across depth 24 to 40
export const pxPerYear = (k = camera.k, t = camera.year) => { const polar = (TAU * midRadius(t) * k) / TURN, g = pageWeight(k); return g > 0 ? polar * (1 - g) + yearWidth(Math.floor(t), pageFrame()) * g : polar; };
// the year under a map point, by the spiral's inversion (outside the coil: the nearest end)
function yearAtMap(x, y) {
  const r = Math.hypot(x, y);
  let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += TAU;
  const f = a / TAU;
  let turn = -1, bd = Infinity;
  for (let T = 0; T < NT; T++) { const lo = geo.rStart[T] + geo.bands[T] * f, hi = lo + thickOf(Y0 + TURN * (T + f)); const d = r < lo ? lo - r : r > hi ? r - hi : 0; if (d < bd) { bd = d; turn = T; } }
  return clamp(Y0 + TURN * (turn + f), Y0, T_END);
}
// screen px -> the year and ring under the point, by inverting the spiral
export function unproject(sx, sy) {
  const { x, y } = toMap(sx, sy);
  const r = Math.hypot(x, y);
  let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += TAU;
  const f = a / TAU;
  let turn = -1;
  for (let T = 0; T < NT; T++) { const lo = geo.rStart[T] + geo.bands[T] * f; if (r >= lo && r < lo + thickOf(Y0 + TURN * (T + f))) { turn = T; break; } }
  if (turn < 0) turn = r < geo.r0 ? -1 : NT; // inside the hole, or past the rim
  const year = Y0 + TURN * (clamp(turn, 0, NT - 1) + f);
  let lane = -1;
  if (turn >= 0 && turn < NT && year <= Y1 + 1) {
    const q = (r - radiusOf(year)) / thickOf(year);
    const rings = share[turn] || [];
    for (let i = 0; i < NL; i++) { const o = rings[i]; if (o && q >= o[0] && q < o[1]) { lane = i; break; } }
  }
  return { year, lane, x, y, turn, r, f };
}

/* ---------- the layout: one cell per event, in its year's box ---------- */
export let cells = [];
let cellById = new Map(), stacks = new Map(), byT = []; // stacks: `${turn}|${lane}|${year}` -> cells; byT: cells by date
const layoutListeners = new Set();
export const onLayout = (fn) => { layoutListeners.add(fn); return () => layoutListeners.delete(fn); };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
function dateOf(e) {
  if (e.month) return ym(`${e.year}-${String(e.month).padStart(2, '0')}${e.day ? '-' + String(e.day).padStart(2, '0') : ''}`);
  return e.year + 0.5 + (hash(e.id) - 0.5) * 0.6;
}
function layout() {
  const list = db.events.filter((e) => e.kind !== 'overlay' && e.year >= Y0 && e.year <= Y1);
  nTurn = new Array(NT).fill(0);
  const cnt = Array.from({ length: NT }, () => new Array(NL).fill(0));
  const out = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const e = list[i], lane = Math.max(0, laneOf(e.domain)), year = clamp(e.year, Y0, Y1 - 1 + (e.year >= Y1 ? 1 : 0)), T = turnOf(year);
    nTurn[T]++; cnt[T][lane]++;
    out[i] = { id: e.id, e, lane, year: Math.min(e.year, Y1), t: clamp(dateOf(e), Y0, T_END), turn: T, size: e.significance || 3, shape: markOf(e.type), color: colorOf(e), x: 0, y: 0, on: true, ta: 0, tb: 0, q0: 0, q1: 0, u: 0 };
  }
  // the rings' shares per turn, with a floor so every domain keeps a visible ring
  share = cnt.map((c) => { const tot = c.reduce((a, x) => a + x, 0) || 1; const sh = c.map((x) => Math.max(0.03, x / tot)); const s2 = sh.reduce((a, x) => a + x, 0); let acc = 0; return sh.map((x) => { const o = acc / s2; acc += x; return [o, acc / s2]; }); });
  cells = out;
  fitGeometry(geo.w, geo.h);
  stacks = new Map();
  for (const c of cells) { const key = `${c.turn}|${c.lane}|${c.year}`; const g = stacks.get(key); if (g) g.push(c); else stacks.set(key, [c]); }
  for (const g of stacks.values()) g.sort((a, b) => (b.e.significance || 0) - (a.e.significance || 0) || a.t - b.t || (a.id < b.id ? -1 : 1));
  place();
  cellById = new Map(cells.map((c) => [c.id, c]));
  pageCache.clear();
  // the birth's order: by date, each year weighted by its count plus three, so sparse centuries still take time
  byT = cells.slice().sort((a, b) => a.t - b.t);
  const perYear = new Map(); for (const c of byT) perYear.set(c.year, (perYear.get(c.year) || 0) + 1);
  let acc = 0; const total = [...perYear.values()].reduce((a, n) => a + n + 3, 0); let lastYear = -1, inYear = 0;
  for (const c of byT) { if (c.year !== lastYear) { if (lastYear >= 0) acc += perYear.get(lastYear) + 3; lastYear = c.year; inYear = 0; } c.u = (acc + 3 + inYear) / total; inYear++; }
  miniDirty = true;
  for (const fn of layoutListeners) fn(cells);
}
// each stack fills its year's box as a grid: angular columns by radial rows, no spill
function place() {
  for (const [key, L] of stacks) {
    const [T, lane, y] = key.split('|').map(Number);
    const yEnd = Math.min(y + 1, Y1 + 0.999);
    const [o0, o1] = ringOf(y + 0.5, lane);
    const thick = thickOf(y + 0.5), ringT = Math.max(1.2, thick * (o1 - o0));
    const arcPx = (thetaOf(yEnd) - thetaOf(y)) * (radiusOf(y + 0.5) + thick * (o0 + o1) / 2);
    const n = L.length, minCell = 1.1;
    const rowsFit = Math.max(1, Math.floor(ringT / minCell));
    const cols = Math.max(1, Math.min(Math.floor(arcPx / minCell) || 1, Math.ceil(n / rowsFit)));
    const rows = Math.ceil(n / cols);
    const cellQ = Math.min(3.2 / thick, (o1 - o0) / rows); // radial size as a fraction of the band
    const colT = (yEnd - y) / cols, gapT = Math.min(0.003 * TURN / TAU, colT * 0.15), gapQ = cellQ * thick > 1.6 ? 0.4 / thick : 0;
    L.forEach((c, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      c.ta = y + col * colT + gapT; c.tb = y + (col + 1) * colT - gapT;
      c.q0 = o0 + row * cellQ; c.q1 = c.q0 + cellQ - gapQ;
      const p = polar((c.ta + c.tb) / 2, radiusOf((c.ta + c.tb) / 2) + thick * (c.q0 + c.q1) / 2);
      c.x = p.x; c.y = p.y;
    });
  }
}

/* ---------- filter ---------- */
let filter = null; // { domains, types, regions, ids, mode, hot }
let hot = null;
function cellPasses(c) {
  if (!filter) return true;
  const e = c.e;
  if (filter.domains && !filter.domains.has(e.domain)) return false;
  if (filter.types && !filter.types.has(e.type)) return false;
  if (filter.regions && !filter.regions.has(e.region)) return false;
  if (filter.ids && !filter.ids.has(e.id)) return false;
  return true;
}
export function setFilter(f) {
  if (f && 'hot' in f) hot = f.hot && f.hot.size ? f.hot : null;
  if (!f || (!f.domains && !f.types && !f.regions && !f.ids && !f.lit)) { if (!f || !('hot' in f) || Object.keys(f).length > 1) filter = null; }
  else {
    const ids = f.ids || f.lit || null, only = ids && !f.domains && !f.types && !f.regions;
    filter = { domains: f.domains || null, types: f.types || null, regions: f.regions || null, ids, mode: f.mode === 'hide' ? 'hide' : 'dim', dim: typeof f.dim === 'number' ? clamp(f.dim, 0, 1) : only ? 0.55 : 0.2 };
  }
  for (const c of cells) c.on = cellPasses(c);
  redraw();
}
export const getFilter = () => (filter || hot ? { ...(filter || {}), hot } : null);

/* ---------- camera: arrive and settle, along the road ---------- */
let anim = null;
const frameListeners = new Set();
export const onFrame = (fn) => { frameListeners.add(fn); return () => frameListeners.delete(fn); };
const SETTLE = 60; // ms: the arrive-and-settle curve overshoots by a hair and comes back
// ease-out cubic to 1.012 over dur, then a 60 ms settle back to 1
function arrive(now, a) {
  const u = clamp((now - a.t0) / a.dur, 0, 1);
  const over = 1 + (a.over ?? 0.012);
  if (u < 1) return over * (1 - Math.pow(1 - u, 3));
  const v = clamp((now - a.t0 - a.dur) / SETTLE, 0, 1);
  return over - (over - 1) * (1 - Math.pow(1 - v, 2));
}
const roadTarget = () => (anim ? anim.to : { year: camera.year, depth: glide.active ? restK : camera.depth }); // a glide's lift is not a chosen depth
// the flight state: listeners hear a start and an end for every animated move; an end carries settled false when a
// hand or a key interrupted it, so the UI reveals the destination only on a settle
const flightListeners = new Set();
export const onFlight = (fn) => { flightListeners.add(fn); return () => flightListeners.delete(fn); };
export const flight = () => (anim ? { from: anim.from, to: anim.to, t0: anim.t0, dur: anim.dur, peak: anim.peak } : null);
function tellFlight(phase, a, settled) {
  for (const fn of flightListeners) { try { fn({ phase, from: a.from, to: a.to, settled, peak: a.peak || null }); } catch (e) { console.error(e); } }
}
function cancelAnim() {
  if (!anim) return;
  const a = anim; anim = null;
  if (a.told) tellFlight('end', a, false);
  if (a.resolve) a.resolve({ settled: false, year: camera.year, depth: camera.depth });
}
// ease in and out, for a flight that rises: the middle of the flight carries most of the distance
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
// move the camera to a year and depth; animated moves arrive and settle. A long flight (arc) rises so the turn shows
let restK = 1; // the depth she chose; speed lifts the camera above it and the settle returns here
function setRoad(to, { animate = false, duration = 520, rest = true, arc = false, cell = null } = {}) {
  const tgt = { year: clamp(to.year ?? camera.year, Y0 + 0.02, T_END), depth: clamp(to.depth ?? (glide.active ? restK : camera.depth), K_MIN, K_MAX) };
  if (rest) { if (to.depth != null) restK = tgt.depth; if (glide.active) stopGlide(); }
  cancelAnim();
  const from = { year: camera.year, depth: camera.depth };
  if (!animate || reduced()) {
    camera.year = tgt.year; camera.depth = tgt.depth; applyRoad(); redraw();
    if (animate) { const a = { from, to: tgt }; tellFlight('start', a, null); tellFlight('end', a, true); }
    return Promise.resolve({ settled: true, year: tgt.year, depth: tgt.depth });
  }
  // the overshoot before the settle stays small on screen: under a twelfth of the view, and under two weeks on a page
  const dist = Math.abs(tgt.year - from.year), screenYears = geo.w / Math.max(1, pxPerYear(tgt.depth, tgt.year));
  const cap = Math.min(0.08 * screenYears, tgt.depth >= 24 ? 0.04 : Infinity);
  const over = dist > 0 ? Math.min(0.012, cap / dist) : 0.012;
  const peak = arc ? arcPeak(from.depth, tgt.depth, dist) : null;
  return new Promise((resolve) => {
    anim = { from, to: tgt, t0: performance.now(), dur: duration, resolve, over, peak, told: true, cell };
    tellFlight('start', anim, null);
    redraw();
  });
}
// a flight of more than forty years between deep places rises to where the turn shows: depth 3 for a century, 1 for the millennium
const ARC_YEARS = 40;
function arcPeak(d0, d1, dist) {
  if (dist <= ARC_YEARS || Math.min(d0, d1) <= DEPTHS.century * 1.3) return null;
  return Math.min(d0, d1, clamp(300 / dist, K_MIN, DEPTHS.century));
}
function stepAnim(now) {
  if (!anim) return false;
  const { from, to, peak } = anim;
  const u = clamp((now - anim.t0) / anim.dur, 0, 1);
  let s = arrive(now, anim);
  if (peak) { const over = 1 + (anim.over ?? 0.012); s = u < 1 ? over * easeInOut(u) : s; }
  let ld = Math.log(from.depth) + (Math.log(to.depth) - Math.log(from.depth)) * s;
  if (peak) { const lift = sm(u, 0, 0.3) * (1 - sm(u, 0.7, 1)); ld += (Math.log(peak) - ld) * lift; }
  camera.depth = Math.exp(ld);
  camera.year = from.year + (to.year - from.year) * s;
  if (peak) glide.header = Math.min(1, glide.header + 0.08); // a rising flight shows the running year and century
  applyRoad();
  if (now - anim.t0 >= anim.dur + SETTLE) {
    const a = anim; anim = null; camera.year = to.year; camera.depth = to.depth; applyRoad();
    tellFlight('end', a, true);
    if (a.resolve) a.resolve({ settled: true, year: to.year, depth: to.depth });
    return false;
  }
  return true;
}
// the older contract: a map point and a scale. The point's year becomes the focus
export function setCamera(c, { animate = false, duration = 520 } = {}) {
  const k = c.k ?? camera.k;
  const year = c.cx != null && c.cy != null && (c.cx || c.cy) ? yearAtMap(c.cx, c.cy) : camera.year;
  return setRoad({ year, depth: k }, { animate, duration });
}
export const setYear = (year, o = { animate: true }) => setRoad({ year: +year }, o);
export const setDepth = (depth, o = { animate: true }) => setRoad({ depth: +depth }, o);
export const resetCamera = (o = { animate: true }) => setRoad({ depth: 1 }, o);
export const kForYear = (t) => clamp(600 / ((TAU * radiusOf(t)) / TURN), K_MIN, K_MAX);
export const DEPTHS = { millennium: 1, century: 3, decade: 6, year: 14, page: 40 };
export const depthName = (k = camera.k) => (k < 1.6 ? 'millennium' : k < 4 ? 'century' : k < 10 ? 'decade' : k < 24 ? 'year' : 'page');
// fly along the spiral to an event, a year or a { year, month, depth }; resolves on arrival
export function flyTo(target, { ms = 2400, depth = null } = {}) {
  let year, d = depth;
  let cell = null;
  if (typeof target === 'string') { cell = cellById.get(target); if (!cell) return Promise.resolve(); year = cell.t; }
  else if (typeof target === 'number') year = target;
  else if (target && typeof target === 'object') { year = (target.year ?? camera.year) + (target.month ? (target.month - 0.5) / 12 : typeof target.year === 'number' && Number.isInteger(target.year) ? 0.5 : 0); if (target.depth != null) d = typeof target.depth === 'string' ? DEPTHS[target.depth] || camera.depth : target.depth; }
  else return Promise.resolve();
  if (d == null) d = Math.max(camera.depth, DEPTHS.year);
  if (cell && pageWeight(d) >= 0.5) year = cardYear(cell); // on the page the camera frames the card where it is drawn
  const dist = Math.abs(year - camera.year);
  let dur = Math.max(320, Math.min(ms, 320 + dist * 6 + Math.abs(Math.log(d / camera.depth)) * 220));
  if (arcPeak(camera.depth, d, dist)) dur = Math.min(Math.max(ms, 320), Math.max(dur, 1600)); // a rising flight takes its time
  return setRoad({ year, depth: d }, { animate: true, duration: dur, arc: true, cell: cell && pageWeight(d) >= 0.5 ? cell : null });
}
export function zoomToYear(t, { lane = null, animate = true, k = null } = {}) {
  const tt = clamp(+t || Y0, Y0, Y1);
  return setRoad({ year: Number.isInteger(tt) ? tt + 0.5 : tt, depth: k || kForYear(tt) }, { animate, duration: 640 });
}
// depth about a screen point: the year under the pointer becomes the focus, so the camera lands on a band
function zoomAbout(sx, sy, factor, animate = false, duration = 180) {
  const base = roadTarget();
  const k2 = clamp(base.depth * factor, K_MIN, K_MAX);
  const m = toMap(sx, sy);
  const year = roadWeight(base.depth) < 0.5 && k2 > base.depth ? yearAtMap(m.x, m.y) : base.year;
  setRoad({ year, depth: k2 }, { animate, duration });
}
// velocity-coupled travel: a notch adds velocity along time, friction lets a flick glide, and speed lifts the camera
// so the stream stays readable; when the velocity dies the camera settles back to the depth she chose, on the year she stopped on
// friction 0.4 s: a notch's travel is done in about half a second and eases in; after the last notch of a flick the
// glide ends within two seconds and eases the rest of the way, so nothing drifts past two and a half
const GLIDE_TAU = 0.4, GLIDE_GAIN = 1.1, GLIDE_VMAX = 170, GLIDE_C = 16, GLIDE_MAX_MS = 2000, GLIDE_EASE_MS = 200, GLIDE_REST = 0.7;
const glide = { active: false, hold: false, v: 0, s: 0, last: 0, header: 0, input: 0 };
export const velocity = () => glide.v;
function stopGlide() { glide.active = false; glide.hold = false; glide.v = 0; glide.s = 0; }
function speedDepth(speed) {
  // the depth that this speed asks for: under 0.6 years a second the page holds, 2.4 is the road, 8 the turn, 24 the whole spiral
  if (speed < 1e-6) return K_MAX;
  return clamp(GLIDE_C / speed, K_MIN, K_MAX);
}
function impulse(dir, now = performance.now()) {
  if (birth) return;
  if (reduced()) { setRoad({ year: camera.year + dir * notchStep(camera.k) * GLIDE_GAIN }, { rest: false }); return; } // reduced motion: the step, no momentum
  cancelAnim(); // a settle in progress yields to the hand
  if (!glide.active) { glide.last = now; glide.s = Math.abs(glide.v); }
  glide.active = true; glide.hold = false; glide.input = now;
  glide.v = clamp(glide.v + dir * notchStep(camera.k) * (GLIDE_GAIN / GLIDE_TAU), -GLIDE_VMAX, GLIDE_VMAX);
  redraw();
}
function stepGlide(now) {
  if (!glide.active) { if (glide.header > 0) { glide.header = Math.max(0, glide.header - 0.04); return true; } return false; }
  const dt = Math.min(0.05, Math.max(0, (now - glide.last) / 1000)); glide.last = now;
  if (!glide.hold) {
    glide.v *= Math.exp(-dt / GLIDE_TAU);
    const y = camera.year + glide.v * dt;
    if (y <= Y0 + 0.02 || y >= T_END) glide.v = 0;
    camera.year = clamp(y, Y0 + 0.02, T_END);
  }
  glide.s += (Math.abs(glide.v) - glide.s) * (1 - Math.exp(-dt / 0.12));
  const kTarget = Math.min(restK, speedDepth(glide.s));
  camera.depth = Math.exp(Math.log(camera.depth) + (Math.log(kTarget) - Math.log(camera.depth)) * (1 - Math.exp(-dt / 0.2)));
  glide.header = Math.min(1, glide.header + 0.08);
  applyRoad();
  // the end: when the rest of the glide is under six tenths of a notch, or two seconds have passed since the last input,
  // the remaining distance is eased in and the camera returns to the depth she chose
  const remain = glide.v * GLIDE_TAU;
  const still = Math.abs(remain) < GLIDE_REST * notchStep(restK) || now - glide.input > GLIDE_MAX_MS;
  if (!glide.hold && still) {
    stopGlide();
    const land = landing(clamp(camera.year + remain, Y0 + 0.02, T_END), restK);
    const far = Math.abs(Math.log(camera.depth / restK)) > 0.2 || land.depth !== restK;
    setRoad(land, { animate: true, duration: far ? GLIDE_EASE_MS + 150 : GLIDE_EASE_MS, rest: land.depth !== restK });
    return !!anim;
  }
  return true;
}
// never land on empty ground: a page settle on a year with no events moves to the nearest populated year (ties toward the past);
// when that year is more than five away, the camera settles at decade depth instead, so the decade shows
function landing(year, depth) {
  if (depth < 24) return { year, depth };
  const Y = Math.floor(year);
  const has = (y) => { for (const c of byT) { if (c.year === y) return true; } return false; };
  if (has(Y)) return { year, depth };
  for (let d = 1; d <= 5; d++) {
    for (const y of [Y - d, Y + d]) {
      if (y < Y0 || y > Y1 || !has(y)) continue;
      const L = byT.filter((c) => c.year === y);
      return { year: cardYear(L[Math.floor(L.length / 2)]), depth };
    }
  }
  return { year, depth: DEPTHS.decade };
}
export function setAltitude(a, { animate = true, duration = 520 } = {}) {
  const base = roadTarget();
  return setRoad({ year: base.year, depth: kOfAltitude(a) }, { animate, duration });
}
// the dolly: a wheel notch rises or dives along the spiral; quick successive notches gather momentum
let dollyLast = 0, dollyGain = 1;
function dolly(dNotch, now = performance.now()) {
  dollyGain = now - dollyLast < 90 ? Math.min(2.2, dollyGain * 1.12) : 1;
  dollyLast = now;
  const base = roadTarget();
  const a = clamp(altitudeOf(base.depth) + dNotch * 0.06 * dollyGain, 0, 1);
  return setRoad({ year: base.year, depth: kOfAltitude(a) }, { animate: true, duration: 520 });
}
// travel: a wheel notch is about a decade at depth 3 and about a month at the page
const travelStep = (k) => clamp(10 * Math.pow(3 / k, 1.85), 1 / 14, 80);
// a notch at page depth: its month, or the frame's breadth inside a month wider than the frame
const notchStep = (k) => (pageWeight(k) >= 0.5 ? Math.min(travelStep(k), pageStep()) : travelStep(k));
function travel(dYear, animate = true, duration = 180) {
  const base = roadTarget();
  setRoad({ year: base.year + dYear, depth: base.depth }, { animate, duration });
}
// focus: the year, month and depth under the camera, told to listeners when they change
const focusListeners = new Set();
let lastFocus = '';
export const focus = () => { const page = depthName() === 'page'; const yr = Math.floor(camera.year); return { year: yr, month: page ? Math.min(12, Math.floor((camera.year - yr) * 12) + 1) : null, depth: depthName(), t: camera.year, k: camera.k, altitude: altitudeOf(camera.k) }; };
export const onFocus = (fn) => { focusListeners.add(fn); return () => focusListeners.delete(fn); };
export const onCamera = onFocus;
function tellFocus() {
  const f = focus(), key = `${f.year}|${f.month}|${f.depth}`;
  if (key === lastFocus) return;
  lastFocus = key;
  for (const fn of focusListeners) { try { fn(f); } catch (e) { console.error(e); } }
}
// the hash carries the place (fy the focused year, z the depth) so a reload returns to it; written once the camera rests
let hashTimer = 0;
function writePlace() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    if (!ctx || birth) return;
    const p = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const y = camera.year.toFixed(2), d = camera.depth.toFixed(1);
    if (p.get('fy') === y && p.get('z') === d) return;
    p.set('fy', y); p.set('z', d);
    history.replaceState(null, '', '#' + p.toString().replace(/%2C/g, ','));
  }, 400);
}
export function visibleYears() {
  const { w, h } = geo;
  let n = 0;
  for (const c of cells) { if (!c.on) continue; const s = toScreen(c.x, c.y); if (s.x >= 0 && s.x <= w && s.y >= 0 && s.y <= h) n++; }
  if (camera.k <= 1.6) return { y0: Y0, y1: Y1, n };
  if (pageWeight() >= 0.5) { let y0 = Y0, y1 = Y1; for (const r of pageHits) { if (r.x1 < 0 || r.x0 > geo.w) continue; y0 = Math.min(y0 === Y0 ? Y1 : y0, r.c.year); y1 = Math.max(y1 === Y1 ? Y0 : y1, r.c.year); } if (y0 > y1) { y0 = y1 = Math.floor(camera.year); } return { y0, y1, n }; }
  const u = unproject(w / 2 + geo.ox, h / 2 + geo.oy);
  let tc = u.year;
  if (u.turn < 0) tc = Y0 + TURN * u.f; else if (u.turn >= NT) tc = Y0 + TURN * (NT - 1 + u.f);
  tc = clamp(tc, Y0, T_END);
  let lo = Infinity, hi = -Infinity;
  const on = (t) => { const p = polar(t, radiusOf(t) + thickOf(t) / 2), s = toScreen(p.x, p.y); return s.x >= -2 && s.x <= w + 2 && s.y >= -2 && s.y <= h + 2; };
  for (let t = Math.max(Y0, tc - 50); t <= Math.min(Y1 + 1, tc + 50); t += 0.25) if (on(t)) { lo = Math.min(lo, t); hi = Math.max(hi, t); }
  if (lo === Infinity) { lo = hi = tc; }
  return { y0: Math.max(Y0, Math.floor(lo)), y1: Math.min(Y1 + 1, Math.ceil(hi)), n };
}

// is this cell's card or mark in view: on the page, its card inside the frame; above, its mark inside the insets at a
// depth where a mark can be found (the decade or deeper)
function onStage(c) {
  if (pageWeight() >= 0.5) { const F = pageFrame(), r = pageHits.find((h) => h.c === c); return !!r && r.x0 >= F.left - 4 && r.x1 <= F.right + 4; }
  if (camera.k < DEPTHS.decade) return false;
  const s = toScreen(c.x, c.y);
  return s.x >= inset.left && s.x <= geo.w - inset.right && s.y >= inset.top && s.y <= geo.h - inset.bottom;
}

/* ---------- hit testing ---------- */
export function hitTest(sx, sy) {
  if (pageWeight() >= 0.5) { for (let i = pageHits.length - 1; i >= 0; i--) { const r = pageHits[i]; if (sx >= r.x0 && sx <= r.x1 && sy >= r.y0 && sy <= r.y1) return r.c; } return null; }
  const u = unproject(sx, sy);
  if ((u.turn < 0 || u.turn >= NT) && camera.k > 2) return null;
  const T = clamp(u.turn, 0, NT - 1), y = Math.floor(u.year);
  const hide = filter && filter.mode === 'hide';
  const tol = Math.max(6, 2.2 * camera.k);
  let best = null, bd = Infinity, dimBest = null, dimD = Infinity;
  const lanes = u.lane < 0 ? LANES.map((_, i) => i) : [u.lane - 1, u.lane, u.lane + 1].filter((i) => i >= 0 && i < NL);
  for (const ln of lanes) for (let yy = y - 1; yy <= y + 1; yy++) {
    const L = stacks.get(`${turnOf(yy)}|${ln}|${yy}`); if (!L) continue;
    for (const c of L) {
      if (!c.on && hide) continue;
      let d;
      if (u.year >= c.ta && u.year < c.tb && u.turn === c.turn) { const q = (u.r - radiusOf(u.year)) / thickOf(u.year); d = q >= c.q0 && q < c.q1 ? -1 : Math.min(Math.abs(q - c.q0), Math.abs(q - c.q1)) * thickOf(u.year) * camera.k; }
      else { const s = toScreen(c.x, c.y); d = Math.hypot(s.x - sx, s.y - sy) - sizeAt(c, camera.k); }
      if (d > tol) continue;
      if (c.on) { if (d < bd) { bd = d; best = c; } } else if (d < dimD) { dimD = d; dimBest = c; }
    }
  }
  return best || dimBest;
}
export function nearestCell(t, lane = null) {
  let best = null, bd = Infinity;
  for (const c of cells) { if (!c.on) continue; const d = Math.abs(c.t - t) + (lane != null && c.lane !== lane ? 0.5 : 0); if (d < bd) { bd = d; best = c; } }
  return best;
}
export const cellOf = (id) => cellById.get(id) || null;

/* ---------- listeners ---------- */
const hoverListeners = new Set(), clickListeners = new Set(), bornListeners = new Set();
export const onHover = (fn) => { hoverListeners.add(fn); return () => hoverListeners.delete(fn); };
export const onClick = (fn) => { clickListeners.add(fn); return () => clickListeners.delete(fn); };
export const onBorn = (fn) => { bornListeners.add(fn); if (isBorn()) requestAnimationFrame(() => fn()); return () => bornListeners.delete(fn); };
let highlight = null;
export function setHighlight(id) { const n = id || null; if (n === highlight) return; highlight = n; redraw(); }

/* ---------- the birth and the breath ---------- */
const BIRTH_MS = 6000, BREATH_MS = 3600;
// the breath's period shortens with the focused century's density: twenty seconds in the thin centuries, six in the 2020s
const breathEvery = () => { const nMax = Math.max(1, ...nTurn); const d = nTurn[turnOf(camera.year)] / nMax; return 20000 - 14000 * Math.sqrt(d); };
let born = false, birth = null, census = { alpha: 0, n: 0 }, breath = null, breathTimer = 0, lastInput = 0;
let arrived = false; // true once the birth's dive has landed (or a return visit opened in place)
export const isBorn = () => born && !birth && arrived;
const hashHas = (k) => new URLSearchParams((location.hash || '').replace(/^#/, '')).get(k);
function writeBorn() {
  const p = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  if (p.get('born') === '1') return;
  p.set('born', '1');
  history.replaceState(null, '', '#' + p.toString().replace(/%2C/g, ','));
}
// today's page: the camera frames this month's newest record (the shell's opening selection follows the same rule), so
// the arrival and the selection agree and no second move follows the landing; without one, late October 2026
const TODAY_PLACE = () => {
  const now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1;
  const later = (a, b) => !b || a.year > b.year || (a.year === b.year && ((a.month || 0) > (b.month || 0) || ((a.month || 0) === (b.month || 0) && (a.day || 0) > (b.day || 0))));
  let best = null;
  for (const c of cells) if (c.year === Y && c.e.month === M && later(c.e, best && best.e)) best = c;
  if (!best) for (const c of cells) if (later(c.e, best && best.e)) best = c;
  if (!best || best.year !== Y1) return { year: Y1 + 0.79, depth: DEPTHS.page, cell: null };
  return { year: cardYear(best), depth: DEPTHS.page, cell: best };
};
export function replay() {
  if (reduced()) { birth = null; born = true; arrived = true; writeBorn(); census.alpha = 0; setRoad(TODAY_PLACE()); tellBorn(); return; } // reduced motion: the end state
  cancelAnim(); stopGlide(); camera.depth = 1; camera.year = T_END; applyRoad();
  birth = { t0: performance.now() }; born = false; census.alpha = 1;
  redraw();
}
function birthProgress(now) {
  const u = clamp((now - birth.t0) / BIRTH_MS, 0, 1);
  return 1 - Math.pow(1 - u, 1.3);
}
// the birth's last beat: the dive to today (or to the place the hash carries); listeners hear born on arrival
let arrivalPlace = null;
function endBirth() {
  birth = null; born = true; writeBorn();
  const place = arrivalPlace || TODAY_PLACE();
  arrivalPlace = null;
  setRoad(place, { animate: true, duration: 1200, cell: place.cell || null }).then(() => tellBorn());
  scheduleBreath();
}
let arrivedAt = 0;
function tellBorn() {
  arrived = true; arrivedAt = performance.now();
  for (const fn of bornListeners) { try { fn(); } catch (e) { console.error(e); } }
}
// a wave now (the UI may call it on a selection's arrival)
export function breathe() { if (!ctx || birth || reduced()) return; breath = { t0: performance.now() }; redraw(); }
function scheduleBreath() {
  clearTimeout(breathTimer);
  if (reduced()) return;
  breathTimer = setTimeout(() => { if (!ctx) return; if (!birth) { breath = { t0: performance.now() }; redraw(); } scheduleBreath(); }, breathEvery());
}

/* ---------- rendering ---------- */
let host = null, cv = null, ov = null, ctx = null, octx = null, dpr = 1, raf = 0, textAsked = false;
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let FONT_TEXT = '"Instrument Sans", system-ui, sans-serif', FONT_DISPLAY = '"Instrument Serif", Georgia, serif';
export const frameStats = { last: 0, cells: 0, labels: 0 };

export function redraw() { if (raf) return; raf = requestAnimationFrame(draw); }

export function drawMark(c, shape, x, y, r) {
  if (shape === 'square') c.rect(x - r, y - r, 2 * r, 2 * r);
  else if (shape === 'down') { c.moveTo(x - r * 1.05, y - r * 0.75); c.lineTo(x + r * 1.05, y - r * 0.75); c.lineTo(x, y + r * 1.05); c.closePath(); }
  else if (shape === 'up') { c.moveTo(x - r * 1.05, y + r * 0.75); c.lineTo(x + r * 1.05, y + r * 0.75); c.lineTo(x, y - r * 1.05); c.closePath(); }
  else { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
}
// the glyph's radius: a share of the cell's box, capped
const sizeAt = (c, k) => Math.min(SIZE_CAP, Math.max(1.5, Math.min((c.q1 - c.q0) * thickOf(c.year) * k * 0.42, (thetaOf(c.tb) - thetaOf(c.ta)) * radiusOf(c.year) * k * 0.42)));
// the dive's stages by zoom
const stages = (k) => ({ box: 1 - 0.78 * sm(k, 5, 11), glyph: sm(k, 4.5, 10) * (1 - 0.65 * sm(k, 26, 44)), title: 0, loud: sm(k, 3.4, 5.2), landmark: sm(k, 1.7, 2.6), summary: 0 });

function draw(now) {
  raf = 0;
  if (!ctx) return;
  const t0 = performance.now();
  now = now || t0;
  let moving = stepGlide(now);
  moving = stepAnim(now) || moving;
  const { w, h } = geo, k = camera.k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = GROUND; ctx.fillRect(0, 0, w, h);
  let front = Infinity, p = 1;
  if (birth) { p = birthProgress(now); front = p; moving = true; if (now - birth.t0 >= BIRTH_MS + 400) endBirth(); }
  if (breath) { if (now - breath.t0 > BREATH_MS) breath = null; else moving = true; }
  if (k >= 2) { gridReset(); markUI(); }
  const pg = birth ? 0 : pageWeight(k);
  layerAlpha = 1 - pg;
  let nCells = 0;
  if (pg < 1) {
    ctx.save(); ctx.globalAlpha = layerAlpha;
    drawRays(p);
    nCells = drawCells(now, p);
    drawPictures(p);
    ctx.restore();
  }
  if (pg > 0) nCells += drawPage(pg, now);
  if (!birth) drawPosition(now);
  if (!birth && pg < 1 && glide.header > 0) drawHeader(glide.header * (1 - pg));
  drawMini();
  const st = stages(k);
  // labels and ghost markers fade out across the first half of the page's unfolding
  ctx.save(); ctx.globalAlpha = 1 - Math.min(1, pg * 2);
  frameStats.labels = !birth && pg < 0.5 && (st.landmark > 0 || st.loud > 0) ? drawLabels(st) : 0;
  if (!birth && k < 1.6) drawLeaders(1 - sm(k, 1.15, 1.6));
  if (!birth && pg < 0.5) drawGhostMarkers(); else ghostMarks = [];
  ctx.restore();
  drawCensus(now, p);
  if (!birth) { tellFocus(); if (!moving) writePlace(); }
  drawHighlight();
  frameStats.cells = nCells;
  if (octx) {
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, w, h);
    const view = { w, h, ...visibleSpanCheap() };
    for (const fn of frameListeners) { try { fn(octx, camera, view); } catch (e) { console.error(e); } }
  }
  if (census.alpha > 0 && !birth) { census.alpha = Math.max(0, census.alpha - 0.025); moving = true; }
  frameStats.last = performance.now() - t0;
  if (moving) redraw();
}
let layerAlpha = 1;
let spanCache = { k: -1, cx: NaN, cy: NaN, v: null };
function visibleSpanCheap() {
  if (spanCache.k === camera.k && spanCache.cx === camera.cx && spanCache.cy === camera.cy && spanCache.v) return spanCache.v;
  const v = visibleYears();
  spanCache = { k: camera.k, cx: camera.cx, cy: camera.cy, v };
  return v;
}
// the year the birth's front has reached (cells arrive by their share u; the front is the first unarrived cell's date)
function frontYear(p) {
  if (p >= 1) return Y1 + 1;
  let lo = 0, hi = byT.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (byT[m].u <= p) lo = m + 1; else hi = m; }
  return lo < byT.length ? byT[lo].t : Y1 + 1;
}

function spiralPath(c, ta, tb, rOf, step) {
  let started = false;
  for (let t = ta; ; t += step) {
    const tt = Math.min(t, tb), q = polar(tt, rOf(tt)), s = toScreen(q.x, q.y);
    if (!started) { c.moveTo(s.x, s.y); started = true; } else c.lineTo(s.x, s.y);
    if (tt >= tb) break;
  }
}
function drawRays(p) {
  const { w, h } = geo, k = camera.k;
  const c0 = toScreen(0, 0);
  const tEnd = birth ? frontYear(p) : Y1 + 1;
  ctx.lineWidth = 0.75;
  // the coil: every band's inner edge, one curve from 1026 to the front, plus the rim
  ctx.strokeStyle = light(0.12);
  const step = TURN / Math.min(2400, Math.max(360, Math.round(300 * Math.sqrt(k))));
  ctx.beginPath(); spiralPath(ctx, Y0, tEnd, (t) => radiusOf(t), step); ctx.stroke();
  if (tEnd > Y1 - TURN) { ctx.beginPath(); spiralPath(ctx, Y1 - TURN, birth ? tEnd : Y1 + 1, (t) => outerOf(t), step); ctx.stroke(); }
  if (k >= 2) drawBands();
  // ring hairlines once the rings are wide enough to read
  if (k >= 6) {
    ctx.strokeStyle = light(0.07);
    const span = visibleSpanCheap();
    const ta = Math.max(Y0, span.y0 - 2), tb = Math.min(Y1, span.y1 + 2);
    for (let ln = 1; ln < NL; ln++) { ctx.beginPath(); spiralPath(ctx, ta, tb, (t) => radiusOf(t) + thickOf(t) * ringOf(t, ln)[0], 0.25); ctx.stroke(); }
  }
  // century rays: at each round century, one segment across the turn it starts; the numeral outside the coil's edge
  ctx.font = `400 ${k < 2 ? 15 : 13}px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (let y = 1100; y <= 2000; y += 100) {
    if (y > tEnd) break;
    const a = thetaOf(y) - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const r1 = radiusOf(y), r0 = Math.max(geo.r0 - 8, radiusOf(y) - thickOf(y - 1));
    const p0 = toScreen(r0 * ca, r0 * sa), p1 = toScreen(r1 * ca, r1 * sa);
    if (Math.max(p0.x, p1.x) < -40 || Math.min(p0.x, p1.x) > w + 40 || Math.max(p0.y, p1.y) < -40 || Math.min(p0.y, p1.y) > h + 40) continue;
    ctx.strokeStyle = light(0.5); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    const bw = geo.bands[turnOf(y)] * k;
    if (k >= 2 || bw < 13 || (bw < 21 && (y / 100) % 2)) continue; // tight inner turns name every other century
    const rl = r1 + 13 / k, pl = toScreen(rl * ca, rl * sa);
    ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(a + Math.PI / 2 + camera.rot); ctx.fillStyle = light(0.9); ctx.fillText(String(y), 0, 0); ctx.restore();
  }
  // 2026 at the rim's end
  if (k < 2 && tEnd >= Y1) { const e = toScreen(0, -(outerOf(Y1) + 13)); ctx.fillStyle = light(0.9); ctx.fillText('2026', e.x, e.y); }
  // decade ticks on the two outer turns, decade and year rays at zoom
  if (k < 4) {
    ctx.strokeStyle = light(0.25); ctx.lineWidth = 0.6;
    for (let y = 1830; y <= 2020; y += 10) { if (y % 100 === 0 || y > tEnd) continue; const a = thetaOf(y) - Math.PI / 2, r1 = outerOf(y), r0 = r1 - 6 / Math.sqrt(k); const p0 = toScreen(r0 * Math.cos(a), r0 * Math.sin(a)), p1 = toScreen(r1 * Math.cos(a), r1 * Math.sin(a)); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  } else {
    const span = visibleSpanCheap();
    const stepY = k >= 12 ? 1 : 10;
    const ta = Math.max(Y0, Math.floor(span.y0 / stepY) * stepY - stepY), tb = Math.min(Y1 + 1, Math.ceil(span.y1 / stepY) * stepY + stepY);
    ctx.font = `400 13px ${FONT_DISPLAY}`;
    for (let t = ta; t <= tb; t += stepY) {
      const a = thetaOf(t) - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      const rIn = radiusOf(t), rOut = rIn + thickOf(t);
      const p1 = toScreen(rIn * ca, rIn * sa), p2 = toScreen(rOut * ca, rOut * sa);
      if (Math.max(p1.x, p2.x) < -40 || Math.min(p1.x, p2.x) > w + 40 || Math.max(p1.y, p2.y) < -40 || Math.min(p1.y, p2.y) > h + 40) continue;
      const century = t % 100 === 0, decade = t % 10 === 0;
      if (century) continue;
      ctx.strokeStyle = decade ? light(0.3) : light(0.12); ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const arcPerStep = (TAU * rOut * stepY * k) / TURN;
      if (!(arcPerStep >= 44 || (decade && arcPerStep * 10 >= 44))) continue;
      const rl = rIn + 7 / k, pl = toScreen(rl * ca, rl * sa);
      ctx.save(); ctx.translate(pl.x, pl.y);
      let rot = a + camera.rot; const flip = Math.cos(rot) < 0; if (flip) rot += Math.PI;
      ctx.rotate(rot); ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillStyle = decade ? light(0.9) : light(0.6);
      ctx.fillText(String(t), 0, 0);
      ctx.restore();
    }
  }
}

// the turns told apart from k 2: alternate centuries' bands tinted, the century named at the band's inner edge
const onScreen = (s, w, h, m = 0) => s.x >= -m && s.x <= w + m && s.y >= -m && s.y <= h + m;
function drawBands() {
  const { w, h } = geo, k = camera.k;
  const span = visibleSpanCheap();
  const diag = Math.hypot(w, h) / k;
  const c0 = Math.max(1000, Math.floor((span.y0 - diag * TURN / geo.b) / TURN) * TURN), c1 = Math.min(2000, Math.ceil((span.y1 + diag * TURN / geo.b) / TURN) * TURN);
  ctx.font = `400 ${k < 8 ? 13 : 14}px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle';
  for (let c = c0; c <= c1; c += TURN) {
    const ta = Math.max(Y0, c), tb = Math.min(Y1 + 1, c + TURN), T = turnOf(ta);
    const bk = geo.bands[T] * k;
    const n = Math.max(24, Math.min(720, Math.round(1.6 * bk * (tb - ta) / TURN)));
    const odd = (c / TURN) % 2 === 1;
    let any = false; const pts = [], inner = [];
    for (let i = 0; i <= n; i++) {
      const t = ta + ((tb - ta) * i) / n, a = thetaOf(t) - Math.PI / 2, th = thickOf(t), r = radiusOf(t);
      const sm2 = toScreen((r + th / 2) * Math.cos(a), (r + th / 2) * Math.sin(a)); pts.push(sm2); if (onScreen(sm2, w, h, bk)) any = true;
      const si = toScreen(r * Math.cos(a), r * Math.sin(a)); si.a = a; inner.push(si);
    }
    if (!any) continue;
    if (odd) {
      ctx.strokeStyle = light(0.035); ctx.lineWidth = bk; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.stroke();
    }
    ctx.strokeStyle = light(0.14); ctx.lineWidth = 0.75;
    ctx.beginPath(); inner.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.stroke();
    if (bk < 16 || (bk < 34 && !odd)) continue;
    const label = `${c}s`, tw = ctx.measureText(label).width + 8;
    const free = (x, y) => gridFree(x - tw / 2 - 2, y - 9, tw + 4, 18);
    const order = (ix) => { const o = [], m = ix.length >> 1; for (let d = 0; d < ix.length; d++) { const j = d % 2 ? m - ((d + 1) >> 1) : m + (d >> 1); if (j >= 0 && j < ix.length) o.push(ix[j]); } return o; };
    const spots = [];
    const vis = []; inner.forEach((s, i) => { if (onScreen(s, w, h, -14)) vis.push(i); });
    for (const j of order(vis)) spots.push(inner[j]);
    const mid = []; pts.forEach((s, i) => { if (onScreen(s, w, h, -14)) mid.push(i); });
    for (const j of order(mid).filter((_, q) => q % 3 === 0)) {
      const a = inner[j].a; let x = pts[j].x, y = pts[j].y; const dx = -Math.cos(a) * 2, dy = -Math.sin(a) * 2;
      for (let q = 0; q < 2000 && onScreen({ x: x + dx, y: y + dy }, w, h, -14); q++) { x += dx; y += dy; }
      spots.push({ x, y, a });
    }
    if (!spots.length) continue;
    const at = spots.find((s) => free(s.x, s.y)) || spots[0];
    ctx.save(); ctx.translate(at.x, at.y);
    let rot = at.a + Math.PI / 2 + camera.rot; if (Math.sin(at.a + camera.rot) > 0) rot += Math.PI;
    ctx.rotate(rot); ctx.textAlign = 'center';
    const ga = ctx.globalAlpha; ctx.fillStyle = GROUND; ctx.globalAlpha = ga * 0.85; ctx.fillRect(-tw / 2, -8, tw, 16); ctx.globalAlpha = ga;
    ctx.fillStyle = light(0.9); ctx.fillText(label, 0, 0);
    ctx.restore();
    gridMark(at.x - tw / 2 - 4, at.y - 10, tw + 8, 20);
  }
}

// cells: arc boxes batched by color into one path each; at the dive's depth, the type glyph blooms inside the box
const groups = new Map();
const gkey = (c, bucket) => c.color + '|' + bucket;
function drawCells(now, p) {
  const { w, h } = geo, k = camera.k, { a: Ma, b: Mb, c: Mc, d: Md, e: Me, f: Mf } = M;
  const road = roadWeight(k), fy = camera.year;
  const st = stages(k);
  const m = 12;
  for (const g of groups.values()) { g.p = null; g.g = null; g.n = 0; }
  let n = 0;
  const dimMode = filter && filter.mode, dimA = filter ? filter.dim : 0.2;
  const bp = birth ? p : 2;
  const wave = breath ? Y0 + (Y1 - Y0) * sm((now - breath.t0) / BREATH_MS, 0, 1) : null;
  const seg = k < 3 ? 1 : k < 12 ? 2 : 4; // chord samples along a cell's arc
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.on && dimMode === 'hide') continue;
    if (c.u > bp) continue;
    const sx = Ma * c.x + Mc * c.y + Me; if (sx < -m || sx > w + m) continue;
    const sy = Mb * c.x + Md * c.y + Mf; if (sy < -m || sy > h + m) continue;
    // alpha: filter, hot, the birth's arrival, the breath's wave; quantized to buckets so paths batch
    let a = c.on ? 1 : dimA;
    if (hot) a *= hot.has(c.e.domain) ? 1 : 0.45;
    if (road > 0) a *= 1 - road * (1 - focusWeight(c.t, fy)); // only the focused turn at full strength
    if (birth) a *= clamp((bp - c.u) * 40, 0.15, 1);
    let glow = 0;
    if (wave != null) { const d = (c.t - wave) / 28; glow = Math.exp(-d * d) * 0.6; }
    if (hot && hot.has(c.e.domain)) glow = Math.max(glow, 0.25);
    const bucket = Math.round(a * 4) + ':' + Math.round(glow * 4);
    const key = gkey(c, bucket);
    let g = groups.get(key);
    if (!g) { g = { color: c.color, a: Math.round(a * 4) / 4, glow: Math.round(glow * 4) / 4, p: null, g: null, n: 0 }; groups.set(key, g); }
    if (st.box > 0.02) {
      if (!g.p) g.p = new Path2D();
      const th = thickOf(c.year), rIn = radiusOf(c.ta), rOut0 = rIn + th * c.q1, rIn0 = rIn + th * c.q0;
      if (seg === 1 && k < 1.5) {
        // one quad per cell at the millennium
        const a0 = thetaOf(c.ta) - Math.PI / 2, a1 = thetaOf(c.tb) - Math.PI / 2, ca0 = Math.cos(a0), sa0 = Math.sin(a0), ca1 = Math.cos(a1), sa1 = Math.sin(a1);
        const rb = rIn0 + (radiusOf(c.tb) - rIn), ro1 = rb + th * (c.q1 - c.q0);
        g.p.moveTo(Ma * (rOut0 * ca0) + Mc * (rOut0 * sa0) + Me, Mb * (rOut0 * ca0) + Md * (rOut0 * sa0) + Mf);
        g.p.lineTo(Ma * (ro1 * ca1) + Mc * (ro1 * sa1) + Me, Mb * (ro1 * ca1) + Md * (ro1 * sa1) + Mf);
        g.p.lineTo(Ma * (rb * ca1) + Mc * (rb * sa1) + Me, Mb * (rb * ca1) + Md * (rb * sa1) + Mf);
        g.p.lineTo(Ma * (rIn0 * ca0) + Mc * (rIn0 * sa0) + Me, Mb * (rIn0 * ca0) + Md * (rIn0 * sa0) + Mf);
        g.p.closePath();
      } else {
        const ts = [];
        for (let j = 0; j <= seg; j++) ts.push(c.ta + ((c.tb - c.ta) * j) / seg);
        for (let j = 0; j <= seg; j++) { const t = ts[j], r = radiusOf(t) + thickOf(t) * c.q1, a = thetaOf(t) - Math.PI / 2; const px = r * Math.cos(a), py = r * Math.sin(a), x = Ma * px + Mc * py + Me, y = Mb * px + Md * py + Mf; if (j) g.p.lineTo(x, y); else g.p.moveTo(x, y); }
        for (let j = seg; j >= 0; j--) { const t = ts[j], r = radiusOf(t) + thickOf(t) * c.q0, a = thetaOf(t) - Math.PI / 2; const px = r * Math.cos(a), py = r * Math.sin(a); g.p.lineTo(Ma * px + Mc * py + Me, Mb * px + Md * py + Mf); }
        g.p.closePath();
      }
    }
    if (st.glyph > 0.02) { if (!g.g) g.g = { fill: new Path2D(), ring: new Path2D() }; drawMark(c.shape === 'ring' ? g.g.ring : g.g.fill, c.shape, sx, sy, sizeAt(c, k)); }
    g.n++; n++;
  }
  ctx.lineWidth = Math.max(1, Math.min(2, 0.35 * k));
  for (const g of groups.values()) {
    if (!g.n) continue;
    if (g.p) { ctx.globalAlpha = g.a * st.box * layerAlpha; ctx.fillStyle = g.color; ctx.fill(g.p); }
    if (g.g) { ctx.globalAlpha = g.a * st.glyph * layerAlpha; ctx.fillStyle = g.color; ctx.strokeStyle = g.color; ctx.fill(g.g.fill); ctx.stroke(g.g.ring); }
    if (g.glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g.glow * g.a * layerAlpha; ctx.fillStyle = light(1); if (g.p) ctx.fill(g.p); if (g.g) { ctx.fill(g.g.fill); ctx.stroke(g.g.ring); } ctx.globalCompositeOperation = 'source-over'; }
  }
  ctx.globalAlpha = 1;
  return n;
}

// the focused turn: half a turn each way at full strength, the turns a century in and out as ghost lanes
const GHOST = 0.15;
const focusWeight = (t, fy) => { const d = Math.abs(t - fy); return d <= 46 ? 1 : d >= 58 ? GHOST : 1 - (1 - GHOST) * ((d - 46) / 12); };
// one marker per ghost lane: the strongest record of that century near the focused angle; a tap jumps across
let ghostMarks = [], ghostPick = { key: '', list: [] };
function pickGhost(tc, span) {
  let best = null, bs = -Infinity;
  for (const c of cells) { const d = Math.abs(c.t - tc); if (d > span || !c.on) continue; const sc = (c.e.landmark ? 10 : 0) + (c.e.significance || 0) - d / span; if (sc > bs) { bs = sc; best = c; } }
  return best;
}
function drawGhostMarkers() {
  ghostMarks = [];
  const road = roadWeight(camera.k); if (road < 0.3) return;
  const { w, h } = geo, k = camera.k;
  const span = Math.max(3, Math.min(40, (w / 2) / pxPerYear(k) + 2));
  const key = `${Math.round(camera.year / Math.max(1, span / 2))}|${Math.round(span)}|${cells.length}|${filter ? 1 : 0}`;
  if (ghostPick.key !== key) { ghostPick = { key, list: [-1, 1].map((side) => { const tc = camera.year + side * TURN; return tc < Y0 || tc > Y1 ? null : pickGhost(tc, span); }) }; }
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const c of ghostPick.list) {
    if (!c) continue;
    const s = toScreen(c.x, c.y);
    if (s.x < 20 || s.x > w - 20 || s.y < 30 || s.y > h - 30) continue;
    const alpha = (road - 0.3) / 0.7 * 0.92;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s.x, s.y, 3.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = GROUND; ctx.lineWidth = 1.2; ctx.stroke();
    const yr = String(c.year), name = cutTo(String(c.e.title_short || c.e.title || '').replace(/^\d{4}\s+/, ''), 40);
    ctx.font = `400 13px ${FONT_DISPLAY}`; const yw = ctx.measureText(yr).width;
    ctx.font = `500 13px ${FONT_TEXT}`; const tw = ctx.measureText(name).width;
    const right = s.x + 10 + yw + 7 + tw < w - 8;
    const x0 = right ? s.x + 10 : s.x - 10 - yw - 7 - tw;
    ctx.fillStyle = GROUND; ctx.globalAlpha = alpha * 0.7; ctx.fillRect(x0 - 4, s.y - 9, yw + 7 + tw + 8, 18); ctx.globalAlpha = alpha;
    ctx.font = `400 13px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.75); ctx.fillText(yr, x0, s.y);
    ctx.font = `500 13px ${FONT_TEXT}`; ctx.fillStyle = INK; ctx.fillText(name, x0 + yw + 7, s.y);
    gridMark(x0 - 4, s.y - 9, yw + 7 + tw + 8, 18);
    ghostMarks.push({ c, x0: Math.min(x0 - 4, s.x - 8), x1: Math.max(x0 + yw + 7 + tw + 4, s.x + 8), y0: s.y - 10, y1: s.y + 10 });
  }
  ctx.restore();
}
const ghostAt = (x, y) => ghostMarks.find((g) => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1) || null;

/* ---------- the year as a page: months as columns, every event a small card ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const REGION_WORD = { africa: 'Africa', 'east-asia': 'East Asia', europe: 'Europe', global: 'Worldwide', 'latin-america': 'Latin America', 'middle-east': 'Middle East', 'north-america': 'North America', oceania: 'Oceania', 'south-asia': 'South Asia' };
const pageCache = new Map();
let pageHits = [];
// the page's frame on screen: a year spans the free width (columns at least 96 px, so a phone shows four months)
function pageFrame() {
  const { w, h } = geo, phone = w < 760;
  const left = inset.left + (phone ? 16 : 28), right = w - inset.right - (phone ? 16 : 28); // the UI's inset carries the panel and its depth rail
  const pageW = Math.max(right - left, 12 * (phone ? 96 : 140));
  const yTop = (inset.top ? inset.top + 12 : phone ? 10 : 72) + (phone ? 72 : 76);
  const yBot = h - inset.bottom - (phone ? 118 : 76);
  return { left, right, pageW, yTop, yBot, cx: w / 2 + geo.ox, cw: pageW / 12, phone };
}
// a year's cards by month, strongest first; records whose month is not on record stand in the year's own band ahead of
// January, never under a month's name; the year's mean sentiment for its ground
const bySig = (a, b) => (b.e.significance || 0) - (a.e.significance || 0) || a.t - b.t;
function pageOf(Y) {
  let pg = pageCache.get(Y);
  if (pg) return pg;
  const months = Array.from({ length: 12 }, () => []), open = [];
  let sent = 0, n = 0;
  for (const c of cells) {
    if (c.year !== Y) continue;
    if (c.e.month) months[clamp(c.e.month - 1, 0, 11)].push(c); else open.push(c);
    sent += +c.e.sentiment || 0; n++;
  }
  for (const L of months) L.sort(bySig);
  open.sort(bySig);
  pg = { months, open, maxN: Math.max(1, ...months.map((L) => L.length)), sent: n ? sent / n : 0, n };
  pageCache.set(Y, pg);
  return pg;
}
const hexRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const GROUND_RGB = hexRgb(GROUND), EMBER_RGB = hexRgb(PALETTE.ai[4]), WARM_RGB = [236, 214, 170];
// the year's mood as the strip's ground: panic toward ember, boom toward a warm light, neutral stays indigo
function moodColor(sent, alpha = 1) {
  const toward = sent < 0 ? EMBER_RGB : WARM_RGB, m = Math.min(1, Math.abs(sent) / 2) * (sent < 0 ? 0.42 : 0.3);
  const c = GROUND_RGB.map((g, i) => Math.round(g + (toward[i] - g) * m));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
// crowded months press into sub-columns so a card keeps a readable height; all cards of a year share one height, and a
// crowded month grows as wide as it needs: every card has a drawn row, none falls off the frame's foot
const cardRows = (pg, F) => {
  const gap = 3, room = F.yBot - F.yTop, maxRows = Math.max(1, Math.floor(room / (12 + gap)));
  const key = room + '|' + F.cw + '|' + F.phone + '|' + F.cx + '|' + F.left;
  if (pg.rowsKey === key) return pg.rows;
  const colsOf = (n) => Math.max(1, Math.ceil((n * 24) / room), Math.ceil(n / maxRows));
  const rows = Math.max(1, ...pg.months.map((L) => Math.ceil(L.length / colsOf(L.length))), Math.ceil(pg.open.length / colsOf(pg.open.length)));
  const ch = clamp(Math.floor(room / rows) - gap, 12, 46);
  // a crowded month grows wide: each of its sub-columns keeps room for a title
  const colBase = F.phone ? 190 : 236;
  // the band of records without a month: its card keeps clear of the frame's left edge when the camera stands on January
  const bandCol = F.phone ? clamp(F.cx - F.left - 10, 120, colBase) : colBase;
  const bandW = pg.open.length ? colsOf(pg.open.length) * bandCol + 6 : 0;
  const monthW = pg.months.map((L) => Math.max(F.cw, colsOf(L.length) * colBase + 6));
  const monthX = [bandW]; for (let m = 0; m < 12; m++) monthX.push(monthX[m] + monthW[m]);
  pg.rowsKey = key; pg.rows = { ch, gap, colsOf, monthW, monthX, bandW, yearW: monthX[12] };
  return pg.rows;
};
// a card's place on its year's page: the screen offset of its centre from the year's left edge, with its column's span
function cardPlace(c, F = pageFrame()) {
  const pg = pageOf(c.year), R = cardRows(pg, F);
  const m = c.e.month ? clamp(c.e.month - 1, 0, 11) : -1;
  const L = m < 0 ? pg.open : pg.months[m], i = Math.max(0, L.indexOf(c));
  const x0 = m < 0 ? 0 : R.monthX[m], mw = m < 0 ? R.bandW : R.monthW[m];
  const cols = R.colsOf(L.length), rows = Math.ceil(L.length / cols), col = Math.floor(i / rows), colW = (mw - 6 - (cols - 1) * 3) / cols;
  return { m, off: x0 + 3 + col * (colW + 3) + colW / 2, colW, x0, mw };
}
// the camera year whose page places this card at the frame's middle (a record without a month: the camera stands on
// January, the year's band to its left)
function cardYear(c, F = pageFrame()) {
  const R = cardRows(pageOf(c.year), F), P = cardPlace(c, F);
  const mid = (F.left + F.right) / 2;
  const W = clamp(F.cx - mid + P.off, R.bandW, R.yearW - 1e-3);
  let m = 0; while (m < 11 && W >= R.monthX[m + 1]) m++;
  return c.year + (m + (W - R.monthX[m]) / R.monthW[m]) / 12;
}
// the page's local scale: pixels per year at the camera's month (the band and January share January's scale)
function pagePxPerYear(t = camera.year, F = pageFrame()) {
  const Y = Math.floor(t);
  if (Y < Y0 || Y > Y1) return F.pageW;
  const R = cardRows(pageOf(Y), F), m = Math.min(11, Math.floor((t - Y) * 12));
  return 12 * R.monthW[m];
}
// a notch's travel on the page: its month, or inside a month wider than the frame, the frame less one card's column, so
// a column cut at one edge stands whole after the next notch
function pageStep(t = camera.year) {
  const F = pageFrame(), per = pagePxPerYear(t, F), col = (F.phone ? 190 : 236) + 3;
  return Math.min(1 / 12, Math.max(col, F.right - F.left - col - 12) / (GLIDE_GAIN * per));
}
const yearWidth = (Y, F) => (Y < Y0 || Y > Y1 ? F.pageW : cardRows(pageOf(Y), F).yearW);
// the screen x where year Y begins: years before the focused one stack leftward, years after stack rightward
function yearX(Y, F) {
  const Yc = Math.floor(camera.center), frac = camera.center - Yc;
  const R = Yc >= Y0 && Yc <= Y1 ? cardRows(pageOf(Yc), F) : null;
  const m = Math.min(11, Math.floor(frac * 12)), within = R ? R.monthX[m] + (frac * 12 - m) * R.monthW[m] : frac * F.pageW;
  let x = F.cx - within;
  if (Y > Yc) for (let y = Yc; y < Y; y++) x += yearWidth(y, F);
  else for (let y = Yc - 1; y >= Y; y--) x -= yearWidth(y, F);
  return x;
}
// the running header: the year and its century at the top left, ticking as the camera crosses centuries
function drawHeader(alpha) {
  const F = pageFrame(), Yc = Math.floor(camera.year), { w } = geo;
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${w < 760 ? 24 : 30}px ${FONT_DISPLAY}`;
  const label = String(Yc), cw0 = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(20,26,61,0.72)'; ctx.fillRect(F.left - 10, F.yTop - 78, cw0 + 90, 40);
  ctx.fillStyle = INK; ctx.fillText(label, F.left, F.yTop - 58);
  ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.6); ctx.fillText(`${Math.floor(Yc / 100) * 100}s`, F.left + cw0 + 10, F.yTop - 55);
  ctx.restore();
}
// the position: a soft light on the band at the camera's year, growing as the camera rises
function drawPosition(now) {
  const a = camera.altitude || 0;
  if (a < 0.02) return;
  const t = camera.year, q = polar(t, midRadius(t)), p = toScreen(q.x, q.y);
  const r = clamp(thickOf(t) * camera.k * 0.9, 9, 60) * (0.6 + 0.4 * a);
  const pulse = reduced() ? 1 : 0.85 + 0.15 * Math.sin(now / 900);
  const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  gr.addColorStop(0, light(0.42 * a * pulse)); gr.addColorStop(0.45, light(0.16 * a * pulse)); gr.addColorStop(1, light(0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = light(0.9 * a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.fill();
}
function drawPage(g, now) {
  const { w, h } = geo, k = camera.k, F = pageFrame();
  const Yc = Math.floor(camera.year), frac = camera.year - Yc;
  pageHits = [];
  // the strip's ground, blended between this year's mood and the next as the camera crosses
  const s0 = pageOf(Yc).sent, s1 = Yc + 1 <= Y1 ? pageOf(Yc + 1).sent : s0;
  ctx.save();
  ctx.globalAlpha = g;
  ctx.fillStyle = moodColor(s0 + (s1 - s0) * frac, 1);
  ctx.fillRect(0, F.yTop - 34, w, F.yBot - F.yTop + 34);
  ctx.strokeStyle = light(0.16); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, F.yTop - 34.5); ctx.lineTo(w, F.yTop - 34.5); ctx.moveTo(0, F.yBot + 0.5); ctx.lineTo(w, F.yBot + 0.5); ctx.stroke();
  // the years whose columns reach the screen
  let yFirst = Math.floor(camera.year), yLast = yFirst;
  while (yFirst > Y0 && yearX(yFirst, F) > -8) yFirst--;
  while (yLast < Y1 && yearX(yLast + 1, F) < w + 8) yLast++;
  const textA = g * g;
  ctx.textBaseline = 'middle';
  const wave = breath ? Y0 + (Y1 - Y0) * sm((now - breath.t0) / BREATH_MS, 0, 1) : null;
  // the columns live between the frame's edges once the page has settled; while it unfolds they may still cross the screen
  const clipL = F.left * g, clipR = w - (w - F.right) * g;
  ctx.save(); ctx.beginPath(); ctx.rect(clipL, F.yTop - 34, clipR - clipL, F.yBot - F.yTop + 34); ctx.clip();
  const names = []; // month names, drawn last over the edge fades; a cut column's name holds at the frame's edge
  let n = 0;
  for (let Y = Math.max(Y0, yFirst); Y <= Math.min(Y1, yLast); Y++) {
    const pg = pageOf(Y), { ch, gap, colsOf, monthW, monthX, bandW } = cardRows(pg, F);
    const xYear = yearX(Y, F);
    // the columns: the year's band of records without a month (when it has any), then the twelve months; each with a
    // separator and its name in the display face along the top, the year's number ahead of its first column
    for (let m = bandW ? -1 : 0; m < 12; m++) {
      const band = m < 0, x0 = band ? xYear : xYear + monthX[m], mw = band ? bandW : monthW[m];
      if (x0 + mw < -4 || x0 > w + 4) continue;
      const first = band || (m === 0 && !bandW);
      ctx.strokeStyle = light(first ? 0.3 : 0.1); ctx.lineWidth = first ? 1 : 0.75;
      ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, F.yTop - 34); ctx.lineTo(Math.round(x0) + 0.5, F.yBot); ctx.stroke();
      ctx.globalAlpha = textA * 0.85; ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.fillStyle = INK;
      names.push([band ? (mw < 150 ? 'no month' : 'month not recorded') : mw < 110 ? MONTHS[m].slice(0, 3) : MONTHS[m], Math.max(x0, clipL) + 8, x0 + mw - 8, band]);
      if (first) { ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.6); ctx.textAlign = 'right'; ctx.fillText(String(Y), x0 - 8, F.yTop - 17); }
      ctx.globalAlpha = g;
      // the cards: pressed together in crowded years, sparse in thin ones
      const L = band ? pg.open : pg.months[m], cols = colsOf(L.length), rows = Math.ceil(L.length / cols), colW = (mw - 6 - (cols - 1) * 3) / cols;
      for (let i = 0; i < L.length; i++) {
        const c = L[i];
        if (!c.on && filter && filter.mode === 'hide') continue;
        const col = Math.floor(i / rows), row = i - col * rows;
        const cx0 = x0 + 3 + col * (colW + 3), cw = colW, cy0 = F.yTop + row * (ch + gap);
        if (cy0 + ch > F.yBot + 1) continue;
        let x = cx0, y = cy0, bw = cw, bh = ch;
        if (g < 1) { const s = toScreen(c.x, c.y), r = sizeAt(c, k); x = s.x - r + (cx0 - (s.x - r)) * g; y = s.y - r + (cy0 - (s.y - r)) * g; bw = 2 * r + (cw - 2 * r) * g; bh = 2 * r + (ch - 2 * r) * g; }
        let a = c.on ? 1 : (filter ? filter.dim : 1);
        if (hot) a *= hot.has(c.e.domain) ? 1 : 0.45;
        const ink = 0.5 + 0.1 * Math.min(5, c.e.significance || 3); // significance as the card's ink depth
        ctx.globalAlpha = g * a * ink; ctx.fillStyle = c.color;
        roundRect(ctx, x, y, bw, bh, Math.min(3, bh / 3)); ctx.fill();
        if (wave != null) { const d = (c.t - wave) / 28, glow = Math.exp(-d * d) * 0.5; if (glow > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g * a * glow; ctx.fillStyle = light(1); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }
        if (g >= 0.5) pageHits.push({ c, x0: x, y0: y, x1: x + bw, y1: y + bh });
        n++;
        if (textA < 0.05 || bh < 13) continue;
        // the type glyph, the title in the text face (smaller on pressed cards), the region word when the card has room
        const deep = (c.e.significance || 0) >= 4, tight = bh < 20, ty = y + Math.min(bh / 2, 11);
        ctx.globalAlpha = textA * a;
        ctx.fillStyle = GROUND; ctx.beginPath(); drawMark(ctx, c.shape, x + (tight ? 8 : 10), ty, tight ? 2.6 : 3.2); if (c.shape === 'ring') { ctx.strokeStyle = GROUND; ctx.lineWidth = 1.2; ctx.stroke(); } else ctx.fill();
        ctx.font = tight ? `500 11px ${FONT_TEXT}` : `500 12.5px ${FONT_TEXT}`; ctx.fillStyle = deep ? GROUND : 'rgba(20,26,61,0.82)'; ctx.textAlign = 'left';
        const title = String(c.e.title_short || c.e.title || '').replace(/^\d{4}\s+/, '');
        ctx.fillText(fitText(title, bw - (tight ? 20 : 26)), x + (tight ? 15 : 20), ty);
        if (bh >= 30 && bw >= 90) { ctx.font = `400 11.5px ${FONT_TEXT}`; ctx.fillStyle = 'rgba(20,26,61,0.72)'; ctx.fillText(fitText(REGION_WORD[c.e.region] || '', bw - 26), x + 20, y + 25); }
      }
    }
  }
  ctx.restore();
  // the cut columns at the edges fade into the strip's ground
  if (g > 0) {
    const fade = Math.min(88, (F.right - F.left) / 6), mood = s0 + (s1 - s0) * frac, y0 = F.yTop - 34, hh = F.yBot - F.yTop + 34;
    const gl = ctx.createLinearGradient(clipL, 0, clipL + fade, 0); gl.addColorStop(0, moodColor(mood, g)); gl.addColorStop(1, moodColor(mood, 0));
    ctx.fillStyle = gl; ctx.fillRect(clipL, y0, fade, hh);
    const gr = ctx.createLinearGradient(clipR - fade, 0, clipR, 0); gr.addColorStop(0, moodColor(mood, 0)); gr.addColorStop(1, moodColor(mood, g));
    ctx.fillStyle = gr; ctx.fillRect(clipR - fade, y0, fade, hh);
  }
  ctx.globalAlpha = textA * 0.85; ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.fillStyle = INK;
  for (const [name, x, xMax, band] of names) { if (band) { ctx.font = `italic 400 14px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.7); } else { ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.fillStyle = INK; } if (x + ctx.measureText(name).width <= Math.min(xMax, clipR)) ctx.fillText(name, x, F.yTop - 17); }
  // the century as a running header at the strip's left
  ctx.globalAlpha = textA; ctx.textAlign = 'left';
  ctx.font = `400 ${w < 760 ? 24 : 30}px ${FONT_DISPLAY}`; ctx.fillStyle = INK; ctx.fillText(String(Yc), F.left, F.yTop - 58);
  const cw0 = ctx.measureText(String(Yc)).width;
  ctx.font = `400 14px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.6); ctx.fillText(`${Math.floor(Yc / 100) * 100}s`, F.left + cw0 + 10, F.yTop - 55);
  ctx.restore();
  return n;
}
const fitCache = new Map();
// shaping every label's text once, in each face the labels use, ahead of the first frame that draws them
let warmed = '';
function warmText() {
  if (!ctx) return;
  const key = FONT_TEXT + '|' + FONT_DISPLAY + '|' + (document.fonts ? document.fonts.status : '') + '|' + cells.length;
  if (warmed === key) return;
  warmed = key;
  ctx.save();
  const faces = [`500 13px ${FONT_TEXT}`, `400 12.5px ${FONT_TEXT}`, `500 12.5px ${FONT_TEXT}`, `500 11px ${FONT_TEXT}`, `400 13px ${FONT_DISPLAY}`, `400 14px ${FONT_DISPLAY}`, `400 30px ${FONT_DISPLAY}`];
  for (const f of faces) { ctx.font = f; ctx.measureText('1026 Yongle Encyclopedia 2026'); }
  ctx.font = `500 13px ${FONT_TEXT}`;
  for (const c of cells) if (c.e.landmark || (c.e.significance || 0) >= 4) ctx.measureText(String(c.e.title_short || c.e.title || ''));
  // the arrival page's cards at their drawn widths
  const F = pageFrame(), pg = pageOf(Y1), R = cardRows(pg, F);
  for (let m = 0; m < 12; m++) {
    const L = pg.months[m], cols = R.colsOf(L.length), colW = (R.monthW[m] - 6 - (cols - 1) * 3) / cols, tight = R.ch < 20;
    ctx.font = tight ? `500 11px ${FONT_TEXT}` : `500 12.5px ${FONT_TEXT}`;
    for (const c of L) fitText(String(c.e.title_short || c.e.title || '').replace(/^\d{4}\s+/, ''), colW - (tight ? 20 : 26));
  }
  ctx.restore();
}
function fitText(s, maxW) {
  const key = s + '|' + Math.round(maxW) + '|' + ctx.font;
  let r = fitCache.get(key); if (r != null) return r;
  if (ctx.measureText(s).width <= maxW) r = s;
  else { let lo = 0, hi = s.length; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, mid) + '\u2026').width <= maxW) lo = mid; else hi = mid - 1; } r = lo < 2 ? '' : s.slice(0, lo).replace(/\s+$/, '') + '\u2026'; }
  if (fitCache.size > 20000) fitCache.clear();
  fitCache.set(key, r);
  return r;
}

// the census beside the center, ticking up through the birth, then fading
function drawCensus(now, p) {
  if (census.alpha <= 0 && !birth) return;
  const n = birth ? cells.reduce((s, c) => s + (c.u <= p ? 1 : 0), 0) : cells.length;
  census.n = n;
  const c0 = toScreen(0, 0), k = camera.k;
  const size = Math.min(34, Math.max(16, geo.r0 * k * 0.55));
  ctx.save(); ctx.globalAlpha = birth ? 1 : census.alpha;
  ctx.font = `400 ${size}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = light(0.95);
  ctx.fillText(n.toLocaleString('en-US'), c0.x, c0.y - size * 0.18);
  ctx.font = `400 ${Math.max(11, size * 0.42)}px ${FONT_TEXT}`; ctx.fillStyle = light(0.7);
  ctx.fillText(birth ? String(Math.min(Y1, Math.floor(frontYear(p)))) : 'events', c0.x, c0.y + size * 0.55);
  ctx.restore();
}

// the label grid: 6 px cells
let grid = null, gw = 0, gh = 0;
const GS = 6;
function gridReset() { gw = Math.ceil(geo.w / GS) + 1; gh = Math.ceil(geo.h / GS) + 1; if (!grid || grid.length < gw * gh) grid = new Uint8Array(gw * gh); else grid.fill(0); }
function gridFree(x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x / GS)), y0 = Math.max(0, Math.floor(y / GS)), x1 = Math.min(gw - 1, Math.floor((x + w) / GS)), y1 = Math.min(gh - 1, Math.floor((y + h) / GS));
  if (x1 < 0 || y1 < 0 || x0 >= gw || y0 >= gh) return false;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (grid[j * gw + i]) return false;
  return true;
}
function gridMark(x, y, w, h) {
  if (!grid) return;
  const x0 = Math.max(0, Math.floor(x / GS)), y0 = Math.max(0, Math.floor(y / GS)), x1 = Math.min(gw - 1, Math.floor((x + w) / GS)), y1 = Math.min(gh - 1, Math.floor((y + h) / GS));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) grid[j * gw + i] = 1;
}
function markUI() {
  if (!host) return;
  const { w, h } = geo, b0 = cv.getBoundingClientRect();
  for (const n of host.querySelectorAll('.sp-ui > *, .sp-ui > * > *')) {
    if (n.hidden || n === cv || n === ov) continue;
    const b = n.getBoundingClientRect();
    if (b.width < 2 || b.height < 2 || (b.width >= w - 4 && b.height >= h - 4)) continue;
    gridMark(b.left - b0.left - 4, b.top - b0.top - 4, b.width + 8, b.height + 8);
  }
}
const firstSentence = (s) => { const m = /^(.*?[.!?])(\s|$)/.exec(String(s || '').trim()); return (m ? m[1] : String(s || '').trim()).slice(0, 180); };
const cutTo = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : s);
const labelCache = new Map();
// titles in the text face beside the glyph: landmarks first, then every title; the summary's first line at depth
function drawLabels(st) {
  const { w, h } = geo, k = camera.k;
  if (k < 2) { gridReset(); markUI(); }
  const all = st.title > 0, summary = st.summary > 0;
  if (summary && !textAsked) { textAsked = true; ensure('text').then(() => redraw()); }
  const cand = [];
  const road = roadWeight(k), fy = camera.year;
  for (const c of cells) {
    if (!c.on) continue;
    if (!all && !c.e.landmark && !(st.loud > 0 && (c.e.significance || 0) >= 4)) continue;
    if (road > 0.5 && focusWeight(c.t, fy) < 0.6) continue;
    const s = toScreen(c.x, c.y);
    if (s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) continue;
    cand.push([c, s.x, s.y]);
  }
  cand.sort((A, B) => (B[0].e.landmark ? 1 : 0) - (A[0].e.landmark ? 1 : 0) || (B[0].e.significance || 0) - (A[0].e.significance || 0) || A[0].t - B[0].t);
  for (const [c, sx, sy] of cand) { const r = sizeAt(c, k); gridMark(sx - r, sy - r, 2 * r, 2 * r); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const fontT = `500 13px ${FONT_TEXT}`, fontS = `400 12.5px ${FONT_TEXT}`;
  let n = 0;
  for (const [c, sx, sy] of cand) {
    const r = sizeAt(c, k), e = c.e;
    const alpha = e.landmark ? Math.max(st.landmark, st.loud, st.title) : Math.max(st.loud, st.title);
    if (alpha <= 0.02) continue;
    let title = labelCache.get(c.id);
    if (!title) { title = cutTo(e.title_short || e.title || '', all ? 48 : 36); labelCache.set(c.id, title); }
    ctx.font = fontT;
    const tw = ctx.measureText(title).width;
    const lines = [];
    if (summary && e.summary) {
      ctx.font = fontS; let line = firstSentence(e.summary); const maxW = Math.max(200, laneW() * k - 10);
      if (ctx.measureText(line).width > maxW) { let lo = 4, hi = line.length; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(line.slice(0, mid) + '\u2026').width <= maxW) lo = mid; else hi = mid - 1; } line = line.slice(0, lo).replace(/\s+$/, '') + '\u2026'; }
      lines.push(line);
    }
    const bw = Math.max(tw, ...lines.map((l) => { ctx.font = fontS; return ctx.measureText(l).width; })) + 6;
    const bh = 16 + lines.length * 16;
    const places = [[sx + r + 6, sy - 8], [sx - r - 6 - bw, sy - 8], [sx - bw / 2, sy - r - 6 - bh], [sx - bw / 2, sy + r + 6]];
    let put = null;
    for (const [x, y] of places) { if (x < 2 || x + bw > w - 2 || y < 2 || y + bh > h - 2) continue; if (gridFree(x, y, bw, bh)) { put = [x, y]; break; } }
    if (!put) continue;
    gridMark(put[0], put[1], bw, bh);
    ctx.globalAlpha = alpha;
    ctx.font = fontT; ctx.fillStyle = e.landmark || (e.significance || 0) >= 4 ? INK : INK2;
    ctx.fillText(title, put[0] + 3, put[1] + 8);
    if (lines.length) { ctx.globalAlpha = alpha * st.summary; ctx.font = fontS; ctx.fillStyle = INK2; ctx.fillText(lines[0], put[0] + 3, put[1] + 24); }
    n++;
  }
  ctx.globalAlpha = 1;
  return n;
}

// leaders at the millennium: the intro's eight objects and the strongest sig-5 landmarks, named outside the rim
let leaderSet = null;
function leaders() {
  if (leaderSet) return leaderSet;
  const have = new Set(OBJECTS.map(([id]) => id));
  const list = OBJECTS.map(([id, name]) => { const c = cellById.get(id); return c ? { c, name, object: true } : null; }).filter(Boolean);
  const strong = cells.filter((c) => (c.e.significance || 0) >= 5 && c.e.landmark && !have.has(c.id)).sort((a, b) => a.t - b.t);
  const every = Math.max(1, Math.floor(strong.length / 12));
  strong.filter((_, i) => i % every === 0).slice(0, 12).forEach((c) => list.push({ c, name: cutTo(String(c.e.title_short || c.e.title).replace(/^\d{4}\s+/, ''), 34), object: false }));
  leaderSet = list; // objects first: they take their places before the landmarks
  return list;
}
// each label sits where its line leaves the rim into free ground; a label that would cross the ring, another label
// or the viewport's edge is dropped at that width
let leaderPlan = { key: '', items: [] };
function planLeaders() {
  const { w, h } = geo, k = camera.k;
  const key = [w, h, k.toFixed(3), camera.cx.toFixed(1), camera.cy.toFixed(1), camera.rot.toFixed(3), inset.left, inset.right, inset.top, inset.bottom, cells.length].join('|');
  if (leaderPlan.key === key) return leaderPlan.items;
  const c0 = toScreen(0, 0);
  const Rrim = (outerOf(Y1) + 3) * k, Ro = (outerOf(Y1) + 24) * k;
  const xMin = inset.left + 8, xMax = w - inset.right - 8, yMin = Math.max(14, inset.top ? inset.top + 10 : 84), yMax = h - inset.bottom - 52; // the status sits in the bottom row
  const boxes = [];
  const items = [];
  const outside = (b) => { const nx = clamp(c0.x, b.x0, b.x1), ny = clamp(c0.y, b.y0, b.y1); return Math.hypot(nx - c0.x, ny - c0.y) > Rrim; };
  const clear = (b) => b.x0 >= xMin && b.x1 <= xMax && b.y0 >= yMin && b.y1 <= yMax && outside(b) && !boxes.some((o) => b.x0 < o.x1 + 6 && b.x1 > o.x0 - 6 && b.y0 < o.y1 + 4 && b.y1 > o.y0 - 4);
  ctx.save();
  for (const { c, name } of leaders()) {
    const a0 = (((thetaOf(c.t) - Math.PI / 2 + Math.PI) % TAU) + TAU) % TAU - Math.PI; let a = a0; const s = toScreen(c.x, c.y); // the rim's angle in (-pi, pi]
    const e0 = { x: c0.x + Ro * Math.cos(a0), y: c0.y + Ro * Math.sin(a0) };
    // the top is where the coil ends and begins: those records step aside to sixty degrees
    if (Math.abs(Math.cos(a)) < 0.34 && Math.sin(a) < 0) a = Math.cos(a) >= 0 ? -Math.PI / 3 : (-2 * Math.PI) / 3;
    const right = Math.cos(a) >= 0, side = right ? 1 : -1;
    const ex = c0.x + Ro * Math.cos(a), ey = c0.y + Ro * Math.sin(a);
    ctx.font = `400 13px ${FONT_DISPLAY}`; const yr = String(c.year), yw = ctx.measureText(yr).width;
    ctx.font = `500 13px ${FONT_TEXT}`; const tw = ctx.measureText(name).width;
    const tx = ex + side * 10, nx = tx + side * (yw + 7);
    let label = name, lw = tw;
    const room = right ? xMax - nx : nx - xMin;
    if (tw > room) continue; // a label without room is dropped, never clipped
    const x0 = right ? tx : tx - yw - 7 - lw, x1 = right ? nx + lw : tx;
    let ly = ey, placed = null;
    const away = Math.sin(a) < 0 ? -18 : 18;
    for (let step = 0; step < 4; step++) { const b = { x0, x1, y0: ly - 8, y1: ly + 8 }; if (clear(b)) { placed = b; break; } ly += away; }
    if (!placed) continue;
    boxes.push(placed);
    items.push({ c, s, e0, a0, a, ex, ly, tx, nx, side, right, yr, label });
  }
  ctx.restore();
  leaderPlan = { key, items };
  return items;
}
function drawLeaders(alpha) {
  if (alpha <= 0.02 || geo.w < 760 || !cells.length) return;
  const c0 = toScreen(0, 0), Ro = (outerOf(Y1) + 24) * camera.k;
  ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'middle';
  for (const it of planLeaders()) {
    const { c, s, e0, a0, a, ex, ly, tx, nx, side, right, yr, label } = it;
    ctx.strokeStyle = light(0.7); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e0.x, e0.y);
    if (a !== a0) ctx.arc(c0.x, c0.y, Ro, a0, a, a < a0); // along the outside of the rim to the label's exit
    ctx.lineTo(tx - side * 4, ly); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, TAU); ctx.fill(); ctx.strokeStyle = GROUND; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = right ? 'left' : 'right';
    ctx.font = `400 13px ${FONT_DISPLAY}`; ctx.fillStyle = light(0.7); ctx.fillText(yr, tx, ly);
    ctx.font = `500 13px ${FONT_TEXT}`; ctx.fillStyle = INK; ctx.fillText(label, nx, ly);
  }
  ctx.restore();
}

// the mini map: the whole spiral in tinted light at the bottom right, the viewport's footprint, click to jump
let mini = null, miniRect = null, miniDirty = true;
const miniSize = () => (geo.w < 760 ? 90 : 120);
const miniVisible = () => {
  if (camera.k <= 1.2 || geo.w < 320 || geo.h < 320 || birth) return false;
  if (geo.w < 760 && host) { const card = host.querySelector('.sp-card'); if (card && !card.hidden && card.getBoundingClientRect().height > 0) return false; }
  return true;
};
function miniRender() {
  const M = miniSize(), px = Math.round(M * dpr);
  if (!mini) mini = document.createElement('canvas');
  mini.width = px; mini.height = px;
  const c = mini.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sc = (M - 10) / (2 * (geo.R + 2)), o = M / 2;
  c.strokeStyle = light(0.22); c.lineWidth = 0.75;
  c.beginPath();
  for (let i = 0; i <= 1200; i++) { const t = Y0 + ((Y1 - Y0) * i) / 1200, p = polar(t, radiusOf(t)); const x = o + p.x * sc, y = o + p.y * sc; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.stroke();
  for (const cell of cells) { if (cell.e.significance >= 4 || cell.e.landmark) { c.fillStyle = cell.color; c.globalAlpha = 0.55; c.fillRect(o + cell.x * sc - 0.5, o + cell.y * sc - 0.5, 1, 1); } }
  c.globalAlpha = 1;
  miniDirty = false;
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawMini() {
  if (!miniVisible()) { miniRect = null; return; }
  const { w, h } = geo, M = miniSize();
  if (miniDirty || !mini || mini.width !== Math.round(M * dpr)) miniRender();
  const x0 = w - inset.right - M - 16, y0 = h - inset.bottom - M - (w < 760 ? 72 : 16);
  miniRect = { x: x0, y: y0, M, sc: (M - 10) / (2 * (geo.R + 2)) };
  roundRect(ctx, x0, y0, M, M, 6);
  ctx.fillStyle = light(0.08); ctx.fill();
  ctx.strokeStyle = light(0.35); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.drawImage(mini, x0, y0, M, M);
  const o = M / 2, sc = miniRect.sc;
  const quad = [toMap(0, 0), toMap(w, 0), toMap(w, h), toMap(0, h)].map((q) => [x0 + o + q.x * sc, y0 + o + q.y * sc]);
  ctx.save(); roundRect(ctx, x0 + 1, y0 + 1, M - 2, M - 2, 5); ctx.clip();
  ctx.strokeStyle = light(0.95); ctx.lineWidth = 1.25;
  if (camera.k > 60) { const cx = (quad[0][0] + quad[2][0]) / 2, cy = (quad[0][1] + quad[2][1]) / 2; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.stroke(); }
  else { ctx.beginPath(); quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  if (camera.k >= 2) gridMark(x0 - 6, y0 - 6, M + 12, M + 12);
}
const inMini = (x, y) => miniRect && x >= miniRect.x && x <= miniRect.x + miniRect.M && y >= miniRect.y && y <= miniRect.y + miniRect.M;
function miniJump(x, y) {
  const { M, sc } = miniRect, o = M / 2;
  setRoad({ year: yearAtMap((x - miniRect.x - o) / sc, (y - miniRect.y - o) / sc) }, { animate: true, duration: 640 });
}

function drawHighlight() {
  if (!highlight) return;
  const c = cellById.get(highlight); if (!c) return;
  const s = toScreen(c.x, c.y), r = sizeAt(c, camera.k) + 3.5;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU);
  ctx.strokeStyle = light(0.95); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(s.x, s.y, r + 2, 0, TAU);
  ctx.strokeStyle = GROUND; ctx.lineWidth = 1; ctx.stroke();
}

/* ---------- sizing ---------- */
function size() {
  if (!host || !cv) return;
  const w = Math.max(200, host.clientWidth || innerWidth), h = Math.max(200, host.clientHeight || innerHeight);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [cv, ov]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
  const oldR = geo.R;
  fitGeometry(w, h);
  applyRoad();
  place();
  miniDirty = true;
  spanCache.k = -1;
  redraw();
}
// the UI's panel and strip: the ring, the leaders and the mini map keep to the free rectangle
export function setInset(i) {
  const next = { left: i && i.left ? +i.left : 0, right: i && i.right ? +i.right : 0, top: i && i.top ? +i.top : 0, bottom: i && i.bottom ? +i.bottom : 0 };
  if (next.left === inset.left && next.right === inset.right && next.top === inset.top && next.bottom === inset.bottom) return;
  Object.assign(inset, next);
  const atRest = !anim && camera.k < 1.6;
  size();
  if (atRest) { camera.depth = 1; applyRoad(); redraw(); }
  if (anim && anim.cell) anim.to.year = cardYear(anim.cell); // a flight to a card follows the frame as the panel opens
  for (const fn of layoutListeners) fn(geo);
}

/* ---------- the view module ---------- */
// ---------- the arrival (js/arrival.js): the globe breaks open onto the coil ----------
// On a fresh visit the shell runs the globe arrival instead of the birth. The spiral lays out beneath the overlay in
// its born state at the millennium view, tells the arrival where every event and picture lands, and when the overlay
// has faded it makes the birth's last move: the dive to today.
let awaitingArrival = false;
export function arrivalTargets() {
  if (!cv || !cells.length || !db.loaded.has('past')) return { ok: false };
  const rect = cv.getBoundingClientRect();
  if (rect.width < 10) return { ok: false };
  const ox = rect.left + geo.w / 2 + geo.ox, oy = rect.top + geo.h / 2 + geo.oy;
  const n = db.events.length, dots = new Float32Array(n * 2);
  dots.fill(NaN);
  for (let i = 0; i < n; i++) { const c = cellById.get(db.events[i].id); if (!c) continue; dots[i * 2] = ox + c.x; dots[i * 2 + 1] = oy + c.y; }
  return { ok: true, dots, cx: ox, cy: oy, R: geo.R, pic: picSize(1) };
}
export function afterArrival() {
  if (!awaitingArrival) return;
  awaitingArrival = false;
  born = true; writeBorn();
  const place = arrivalPlace || TODAY_PLACE();
  arrivalPlace = null;
  setRoad(place, { animate: true, duration: 1600, cell: place.cell || null }).then(() => tellBorn());
  scheduleBreath();
}
function prepareForArrival() {
  cancelAnim(); stopGlide();
  camera.depth = 1; camera.year = T_END; applyRoad();
  birth = null; born = true; census.alpha = 0; awaitingArrival = true;
  redraw();
}

// ---------- pictures: the Image World pool (342 photographs) seated at their events ----------
let pics = null, picAtlas = [], picsReady = false, picsAsked = false;
const PIC_BASE = 'arrival/';
const picSize = (k) => { const base = geo.w < 760 ? 9 : 12; return clamp(base * Math.pow(k, 0.55), base, 64); };
export function ensurePictures() {
  if (picsAsked) return; picsAsked = true;
  const V = window.__BUILD ? `?v=${window.__BUILD}` : '';
  fetch(`data/pictures.json${V}`).then((r) => r.json()).then((j) => {
    pics = j.pictures;
    const nAtlas = Math.max(...pics.map((p) => p.atlas)) + 1;
    let left = nAtlas;
    for (let i = 0; i < nAtlas; i++) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { picAtlas[i] = img; if (--left === 0) { picsReady = true; redraw(); } };
      img.onerror = () => { if (--left === 0) { picsReady = picAtlas.some(Boolean); redraw(); } };
      img.src = `${PIC_BASE}thumb${i}.jpg${V}`;
    }
  }).catch(() => {});
}
function drawPictures(p) {
  if (!picsReady || !pics) return 0;
  const { w, h } = geo, k = camera.k, { a: Ma, b: Mb, c: Mc, d: Md, e: Me, f: Mf } = M;
  const s = picSize(k), half = s / 2, m = s;
  const bp = birth ? p : 2;
  const dimMode = filter && filter.mode, dimA = filter ? filter.dim : 0.2;
  let n = 0;
  ctx.save();
  for (const pc of pics) {
    const c = cellById.get(pc.id); if (!c) continue;
    if (!c.on && dimMode === 'hide') continue;
    if (c.u > bp) continue;
    const sx = Ma * c.x + Mc * c.y + Me; if (sx < -m || sx > w + m) continue;
    const sy = Mb * c.x + Md * c.y + Mf; if (sy < -m || sy > h + m) continue;
    const img = picAtlas[pc.atlas]; if (!img) continue;
    let u = pc.u, v = pc.v, uw = pc.uw, vh = pc.vh;
    if (pc.a > 1) { const nw = uw / pc.a; u += (uw - nw) / 2; uw = nw; } else { const nh = vh * pc.a; v += (vh - nh) / 2; vh = nh; }
    const aw = img.naturalWidth, ah = img.naturalHeight;
    let a = c.on ? 1 : dimA;
    if (hot) a *= hot.has(c.e.domain) ? 1 : 0.45;
    ctx.globalAlpha = a;
    ctx.drawImage(img, u * aw, (1 - v - vh) * ah, uw * aw, vh * ah, k >= 2.5 ? sx - s - 2 : sx - half, sy - half, s, s);
    n++;
  }
  ctx.restore();
  return n;
}

export default function spiral(el, ctxShell = {}) {
  host = el;
  el.classList.add('sp-host');
  el.innerHTML = '<canvas class="sp-canvas" tabindex="0" aria-label="Histomap: every event, 1026 to 2026, one turn per century"></canvas><canvas class="sp-over" aria-hidden="true"></canvas>';
  cv = el.querySelector('.sp-canvas'); ov = el.querySelector('.sp-over');
  ctx = cv.getContext('2d'); octx = ov.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  FONT_TEXT = cs.getPropertyValue('--font-text').trim() || FONT_TEXT;
  FONT_DISPLAY = cs.getPropertyValue('--font-display').trim() || FONT_DISPLAY;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { warmText(); redraw(); });
  size();
  layout();
  warmText();
  leaderSet = null;
  const offData = onData((name) => { if (name === 'past' || name === 'core' || name === 'meta') { layout(); leaderSet = null; leaderPlan.key = ''; for (const c of cells) c.on = cellPasses(c); redraw(); } });
  if (!db.loaded.has('past')) ensure('past');
  ensurePictures();
  // the birth: on a fresh visit, once the full record is in; a return visit (born=1 in the hash) skips it
  born = hashHas('born') === '1';
  const hy = parseFloat(hashHas('fy')), hd = parseFloat(hashHas('z'));
  const place = Number.isFinite(hy) ? { year: clamp(hy, Y0, T_END), depth: Number.isFinite(hd) ? clamp(hd, K_MIN, K_MAX) : DEPTHS.year } : null;
  if (born) { setRoad(place || TODAY_PLACE()); arrived = true; arrivedAt = performance.now(); scheduleBreath(); }
  else {
    arrivalPlace = place;
    const start = () => { if (host !== el || birth || born) return; if (window.__ARRIVAL) { prepareForArrival(); return; } if (reduced()) { born = true; writeBorn(); setRoad(arrivalPlace || TODAY_PLACE()); arrivalPlace = null; tellBorn(); return; } replay(); };
    if (db.loaded.has('past')) setTimeout(start, 150); else { const off = onData((name) => { if (name === 'past') { off(); setTimeout(start, 150); } }); }
  }

  // a selection made elsewhere (the search, a list, a record's links) flies the camera to the record when it is not on
  // stage; a click on the drawing selects in place, and the arrival's own selection stays put
  let clickSel = { id: '', t: 0 };
  const offStore = subscribeStore((s, ch) => {
    if (!ch.has('sel') || !s.sel || birth || !arrived) return;
    const c = cellById.get(s.sel); if (!c) return;
    const now = performance.now();
    if (clickSel.id === s.sel && now - clickSel.t < 800) return; // her own click on a card: the card is already in view
    if (anim && (anim.cell === c || Math.abs(anim.to.year - c.t) < 0.01)) return;
    if (onStage(c)) return;
    // a selection in the first second after the arrival (the shell's own, or a quick search) moves in a short flight
    flyTo(c.id, now - arrivedAt < 1200 ? { ms: 700 } : {});
  });

  // pointer stream
  const ptrs = new Map();
  let drag = null, pinch0 = null, moved = false, lastTap = 0, lastHover = null, clickT = 0, miniDown = false;
  const pos = (ev) => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  const emitHover = (c, ev) => { if (c === lastHover) return; lastHover = c; for (const fn of hoverListeners) fn(c, ev); };
  const onDown = (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    const [mx, my] = pos(ev);
    if (ptrs.size === 0 && inMini(mx, my)) { miniDown = true; emitHover(null, ev); return; }
    try { cv.setPointerCapture(ev.pointerId); } catch { /* synthetic pointers have no capture */ }
    ptrs.set(ev.pointerId, [mx, my]);
    moved = false; cancelAnim();
    lastInput = performance.now();
    if (ptrs.size === 1) { drag = { x: mx, y: my, year: camera.year, lx: mx, lt: performance.now(), v: 0 }; pinch0 = null; if (glide.active) { glide.hold = true; glide.v = 0; } }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: camera.depth }; drag = null; }
  };
  const onMove = (ev) => {
    const [x, y] = pos(ev);
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, [x, y]);
    if (pinch0 && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const k2 = clamp(pinch0.k * (d / Math.max(1, pinch0.d)), K_MIN, K_MAX);
      setRoad({ depth: k2 }); // depth about the focus: the camera stays on its band
      moved = true; return;
    }
    if (drag && ptrs.size === 1) {
      const dx = x - drag.x, dy = y - drag.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true; cv.classList.add('dragging');
      // a swipe travels along time: the road slides under the finger; its speed lifts the camera as a fling would
      const now = performance.now(), ddx = x - drag.lx, dt = Math.max(1, now - drag.lt) / 1000;
      const dYear = -ddx / (pageWeight() >= 0.5 ? pagePxPerYear() : pxPerYear(camera.k, camera.year));
      camera.year = clamp(camera.year + dYear, Y0 + 0.02, T_END);
      const vInst = dYear / dt; drag.v = drag.v * 0.4 + vInst * 0.6; drag.lx = x; drag.lt = now;
      if (!reduced()) { // reduced motion: the finger moves the road, nothing lifts or glides
        if (!glide.active) { glide.active = true; glide.last = now; glide.s = 0; }
        glide.hold = true; glide.v = clamp(drag.v, -GLIDE_VMAX, GLIDE_VMAX); glide.input = now;
      }
      applyRoad(); redraw();
      emitHover(null, ev);
      return;
    }
    if (inMini(x, y)) { cv.classList.add('over-mini'); emitHover(null, ev); return; }
    cv.classList.remove('over-mini');
    if (ev.pointerType === 'mouse' || ev.pointerType === 'pen') emitHover(hitTest(x, y), ev);
  };
  const onUp = (ev) => {
    if (miniDown) { miniDown = false; const [x, y] = pos(ev); if (inMini(x, y)) miniJump(x, y); return; }
    const had = ptrs.has(ev.pointerId);
    ptrs.delete(ev.pointerId);
    cv.classList.remove('dragging');
    if (ptrs.size < 2) pinch0 = null;
    if (ptrs.size === 1) { const [p] = [...ptrs.values()]; drag = { x: p[0], y: p[1], year: camera.year, lx: p[0], lt: performance.now(), v: 0 }; moved = true; return; }
    const wasDrag = drag; drag = null;
    if (wasDrag && moved && glide.active) {
      // release: a quick swipe keeps gliding, a held finger stops where it is
      const stale = performance.now() - wasDrag.lt > 90;
      glide.hold = false; glide.v = stale ? 0 : clamp(wasDrag.v * 1.5, -GLIDE_VMAX, GLIDE_VMAX); glide.last = glide.input = performance.now(); redraw();
    }
    if (!had || moved || !wasDrag) return;
    const [x, y] = pos(ev);
    const now = performance.now();
    if (ev.pointerType !== 'mouse' && now - lastTap < 320) { lastTap = 0; zoomAbout(x, y, 4, true, 520); return; }
    lastTap = now;
    const g = ghostAt(x, y);
    if (g) { setRoad({ year: g.c.t }, { animate: true, duration: 900 }); return; }
    const c = hitTest(x, y);
    const tell = () => { clickSel = { id: c ? c.id : '', t: performance.now() }; for (const fn of clickListeners) fn(c, ev); };
    if (ev.pointerType === 'mouse') { clearTimeout(clickT); clickT = setTimeout(tell, 240); }
    else tell();
  };
  const onWheel = (ev) => {
    ev.preventDefault();
    const [x, y] = pos(ev);
    lastInput = performance.now();
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dy = clamp(ev.deltaY * unit, -200, 200), dx = clamp(ev.deltaX * unit, -200, 200);
    // the wheel travels along time with momentum, down into the past; with shift, ctrl or meta it is the dolly.
    // One event is at most one notch, whatever pixel count a mouse reports; a trackpad's small deltas add up
    const notch = (px) => Math.sign(px) * Math.min(1, Math.abs(px) / 100);
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { if (Math.abs(dy) > 0.5) dolly(notch(dy), lastInput); }
    else { const d = notch(Math.abs(dx) > Math.abs(dy) * 1.4 ? dx : -dy); if (Math.abs(d) > 1e-4) impulse(d, lastInput); }
    emitHover(hitTest(x, y), ev);
  };
  const onDbl = (ev) => { ev.preventDefault(); clearTimeout(clickT); const [x, y] = pos(ev); zoomAbout(x, y, 4, true, 520); };
  // keys: arrows step a year (a decade with shift) and rise or dive; Home returns to today, M to the millennium
  const onKey = (ev) => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (birth) return;
    const step = ev.shiftKey ? 10 : 1;
    switch (ev.key) {
      case 'ArrowRight': travel(step, true, 420); break;
      case 'ArrowLeft': travel(-step, true, 420); break;
      case 'ArrowUp': dolly(-1); break;
      case 'ArrowDown': dolly(1); break;
      case 'Home': { const t = TODAY_PLACE(); setRoad(t, { animate: true, duration: 1400, cell: t.cell }); break; }
      case 'm': case 'M': setAltitude(1, { duration: 1400 }); break;
      default: return;
    }
    ev.preventDefault(); lastInput = performance.now();
  };
  window.addEventListener('keydown', onKey);
  const onLeave = (ev) => emitHover(null, ev);
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', onLeave);
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('dblclick', onDbl);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => size()) : null;
  if (ro) ro.observe(el);

  const api = {
    LANES, laneOf, project, unproject, toScreen, toMap, camera, setCamera, zoomToYear, resetCamera, kForYear, get cells() { return cells; }, onLayout, onFrame, redraw, visibleYears,
    setYear, setDepth, flyTo, onFocus, onCamera, focus, depthName, DEPTHS, pxPerYear, roadWeight, pageWeight, altitude, altitudeOf, kOfAltitude, setAltitude, velocity, impulse, onFlight, flight, miniBox: () => (miniRect ? { x: miniRect.x, y: miniRect.y, size: miniRect.M } : null),
    cardRect: (id) => { const h = pageHits.find((r) => r.c.id === id); return h ? { x: h.x0, y: h.y0, w: h.x1 - h.x0, h: h.y1 - h.y0 } : null; },
    pageFrame, pageCells: () => { const F = pageFrame(); return pageHits.filter((r) => r.x0 >= F.left - 1 && r.x1 <= F.right + 1 && r.y0 >= F.yTop - 1 && r.y1 <= F.yBot + 1).map((r) => r.c.id); },
    cardYear: (id) => { const c = cellById.get(id); return c ? cardYear(c) : null; }, monthOf: (id) => { const c = cellById.get(id); return c && c.e.month ? c.e.month : null; },
    notchStep: () => notchStep(camera.k), pagePxPerYear: () => pagePxPerYear(), todayPlace: () => { const t = TODAY_PLACE(); return { year: t.year, depth: t.depth, id: t.cell ? t.cell.id : null }; },
    pageCards: () => pageHits.map((r) => ({ id: r.c.id, year: r.c.year, month: r.c.e.month || 0, x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 })),
    // the page column under a screen x: its year and month index (the band of records without a month is -1)
    columnAt: (sx) => {
      const F = pageFrame();
      for (let Y = Math.max(Y0, Math.floor(camera.year) - 3); Y <= Math.min(Y1, Math.floor(camera.year) + 3); Y++) {
        const R = cardRows(pageOf(Y), F), x = yearX(Y, F);
        if (sx < x || sx >= x + R.yearW) continue;
        if (sx < x + R.bandW) return { year: Y, m: -1 };
        for (let m = 0; m < 12; m++) if (sx < x + R.monthX[m + 1]) return { year: Y, m };
      }
      return null;
    },
    // the drawn mark or card's screen rectangle at the current depth, for overlays that must meet the drawing
    screenOf: (cOrId) => {
      const c = typeof cOrId === 'string' ? cellById.get(cOrId) : cOrId;
      if (!c) return null;
      if (pageWeight() >= 0.5) { const h = pageHits.find((r) => r.c === c); if (h) return { x: h.x0, y: h.y0, w: h.x1 - h.x0, h: h.y1 - h.y0 }; }
      const p = toScreen(c.x, c.y), r = sizeAt(c, camera.k);
      return { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
    },
    setFilter, getFilter, setInset, inset, hitTest, nearestCell, cellOf, onHover, onClick, onBorn, isBorn, replay, breathe, markOf, colorOf, stepsOf, familyColor, PALETTE, GROUND, drawMark, setHighlight, geo, frameStats, canvas: cv, overlay: ov, Y0, Y1,
    db: ctxShell.db || db, select: ctxShell.select, tip: ctxShell.tip, openEvidence: ctxShell.openEvidence,
  };
  let uiDown = null;
  import('./spiral_ui.js').then((m) => { if (host !== el) return; const r = m.mountUI && m.mountUI(el, api); uiDown = typeof r === 'function' ? r : r && r.teardown; }).catch((e) => { if (!/Failed to fetch|Cannot find|Loading|404|import/i.test(String(e && e.message))) console.error(e); });
  if (typeof window !== 'undefined') window.__spiral = api;

  return {
    render() { size(); },
    resize() { size(); },
    hover(id) { setHighlight(id); },
    teardown() {
      offData(); offStore(); if (ro) ro.disconnect();
      cv.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey);
      clearTimeout(breathTimer); clearTimeout(hashTimer); birth = null; breath = null;
      if (uiDown) try { uiDown(); } catch { /* the UI's own cleanup */ }
      if (raf) cancelAnimationFrame(raf); raf = 0;
      ctx = octx = null; host = null;
      if (window.__spiral === api) delete window.__spiral;
      el.innerHTML = '';
    },
  };
}
