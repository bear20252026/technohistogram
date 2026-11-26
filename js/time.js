// Shared time axis. The record runs from the first stone tools to 2026. The coil and every per-year table work in
// slot space: one slot per year from 1000 to 2026, one per decade from 10,000 BCE to 1000, one per millennium before
// that. A hundred slots make one turn of the coil, so a turn is a century in the record's dense millennium, a
// millennium back to 10,000 BCE, and a hundred thousand years in deep time. Years before 1 CE are negative under the
// astronomical convention (1 BCE is 0).
export const YEAR_MIN = -3310000;
export const YEAR_MAX = 2026;
export const Y_MID = -10000, Y_LATE = 1000;      // where the slot changes from a millennium to a decade, and from a decade to a year
const S_MID = 3300, S_LATE = 4400;               // the slot at Y_MID and at Y_LATE
export const SLOT_MAX = S_LATE + (YEAR_MAX - Y_LATE); // 5426, the slot of 2026
export function slotOf(y) {
  if (y >= Y_LATE) return Math.min(SLOT_MAX, S_LATE + (y - Y_LATE));
  if (y >= Y_MID) return S_LATE + Math.floor((y - Y_LATE) / 10);
  return Math.max(0, S_MID + Math.floor((y - Y_MID) / 1000));
}
// the first year of a slot (a slot's span is one year, ten, or a thousand)
export function yearOfSlot(s) {
  if (s >= S_LATE) return Y_LATE + (s - S_LATE);
  if (s >= S_MID) return Y_LATE + (s - S_LATE) * 10;
  return Y_MID + (s - S_MID) * 1000;
}
export const slotSpan = (y) => (y >= Y_LATE ? 1 : y >= Y_MID ? 10 : 1000); // years per slot at a year
// fractional slot for a fractional year, for geometry
export function slotF(y) {
  if (y >= Y_LATE) return Math.min(SLOT_MAX, S_LATE + (y - Y_LATE));
  if (y >= Y_MID) return S_LATE + (y - Y_LATE) / 10;
  return Math.max(0, S_MID + (y - Y_MID) / 1000);
}
export function yearOfSlotF(s) {
  if (s >= S_LATE) return Y_LATE + (s - S_LATE);
  if (s >= S_MID) return Y_LATE + (s - S_LATE) * 10;
  return Y_MID + (s - S_MID) * 1000;
}
// a year as the reader writes it: 2026, 44 BCE, 10,000 BCE, 300,000 BCE
export function fmtYear(y) {
  if (y == null || !Number.isFinite(y)) return '';
  if (y > 0) return String(Math.round(y));
  const b = 1 - Math.round(y);
  return `${b.toLocaleString('en-US')} BCE`;
}
// a year on an axis or a readout: a slot boundary in deep time falls a year off the round BCE figure, so the label rounds
// (1,010,001 BCE reads 1,010,000 BCE; 1,001 BCE reads 1,000 BCE). Records keep fmtYear, which is exact.
export function fmtTick(y) {
  if (y == null || !Number.isFinite(y)) return '';
  if (y > 0) return y < 1000 ? `${Math.round(y)} CE` : String(Math.round(y));
  let b = 1 - Math.round(y);
  if (b >= 20000) b = Math.round(b / 1000) * 1000; else if (b >= 100) b = Math.round(b / 10) * 10;
  return `${b.toLocaleString('en-US')} BCE`;
}
// the span a year's slot unit covers in words: a decade before 2000, a century before 1000, a millennium before 10,000 BCE
export function fmtSpan(y0, y1) {
  if (y0 > 0 && y1 > 0) return y1 - y0 <= 9 && y0 % 10 === 0 ? `The ${y0}s` : `${y0} to ${y1}`;
  return `${fmtTick(y0)} to ${fmtTick(y1)}`; // a unit's bounds are slot boundaries: 10,000 BCE to 9,001 BCE reads 10,000 BCE to 9,000 BCE
}

// knots: [year, fraction of the axis]
// the deep past takes the first sixth of the axis, 10,000 BCE to 1026 the next, then the millennium as before
const KNOTS = [[-3310000, 0], [-10000, 0.08], [1026, 0.16], [1500, 0.235], [1800, 0.33], [1900, 0.44], [1950, 0.56], [2000, 0.75], [2027, 1]];

// Fraction of the axis for a (fractional) year, under the piecewise map.
export function frac(t) {
  if (t <= KNOTS[0][0]) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [y1, f1] = KNOTS[i], [y0, f0] = KNOTS[i - 1];
    if (t <= y1) return f0 + ((t - y0) / (y1 - y0)) * (f1 - f0);
  }
  return 1;
}
export function unfrac(f) {
  if (f <= 0) return KNOTS[0][0];
  for (let i = 1; i < KNOTS.length; i++) {
    const [y1, f1] = KNOTS[i], [y0, f0] = KNOTS[i - 1];
    if (f <= f1) return y0 + ((f - f0) / (f1 - f0)) * (y1 - y0);
  }
  return KNOTS[KNOTS.length - 1][0];
}

// A d3-like scale: scale(t) -> pixel, scale.invert(px) -> year, scale.ticks(n) -> good year ticks.
// domain is [y0, y1] in years; the piecewise shape is applied inside that window so a brushed window
// keeps the same relative emphasis (brushing 1500 to 1900 still expands its late end a little).
// mode: 'warp' (piecewise, default) | 'linear' | 'log' (log of years before 2037: the last quarter century takes about a quarter of the axis, 1026 to 1900 a bit under half)
export function timeScale({ domain = [YEAR_MIN, YEAR_MAX + 1], range = [0, 1], mode = 'warp' } = {}) {
  let [d0, d1] = domain;
  let [r0, r1] = range;
  const tf = mode === 'linear' ? (t) => t : mode === 'log' ? (t) => -Math.log(Math.max(1, 2037 - t)) : frac;
  const inv = mode === 'linear' ? (f) => f : mode === 'log' ? (f) => 2037 - Math.exp(-f) : unfrac;
  let f0 = tf(d0), f1 = tf(d1);
  const s = (t) => r0 + ((tf(t) - f0) / (f1 - f0 || 1)) * (r1 - r0);
  s.invert = (px) => inv(f0 + ((px - r0) / (r1 - r0 || 1)) * (f1 - f0));
  s.domain = (v) => { if (!v) return [d0, d1]; [d0, d1] = v; f0 = tf(d0); f1 = tf(d1); return s; };
  s.range = (v) => { if (!v) return [r0, r1]; [r0, r1] = v; return s; };
  s.copy = () => timeScale({ domain: [d0, d1], range: [r0, r1], mode });
  s.mode = mode;
  // ticks: years whose labels fit. `minPx` is the wanted spacing; `labelPx` the width of a four-digit label
  // (default 10px mono), and no two ticks are ever closer than labelPx + 8. Round years win: domain ends first,
  // then 500s, 100s, 50s, 25s, 10s, 5s, 2s, 1s, each added only where it clears everything already placed.
  s.ticks = (minPx = 56, labelPx = 26) => {
    const gap = Math.max(minPx, labelPx + 8);
    const lo = Math.ceil(d0), hi = Math.floor(Math.min(d1, YEAR_MAX));
    const placed = [];
    const fits = (y) => { const px = s(y); return placed.every((q) => Math.abs(q.px - px) >= gap); };
    const add = (y) => { if (y >= lo && y <= hi && !placed.some((q) => q.y === y) && fits(y)) placed.push({ y, px: s(y) }); };
    // ends: the last year of the record when the window reaches it, and the first visible round year
    if (hi === YEAR_MAX) add(YEAR_MAX);
    for (const step of [1000000, 100000, 10000, 1000, 500, 100, 50, 25, 10, 5, 2, 1]) {
      // a finer year only subdivides a short interval between ticks already placed (or the domain ends),
      // so a lone 1960 never appears between 1900 and 2000
      const anchors = () => [lo, ...placed.map((q) => q.y), hi].sort((u, v) => u - v);
      const cands = [];
      for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) cands.push(y);
      for (const y of cands) {
        const an = anchors();
        const p1 = Math.max(...an.filter((v) => v < y)), p2 = Math.min(...an.filter((v) => v > y));
        if (step < 100 && y !== lo && y !== hi && (!Number.isFinite(p1) || !Number.isFinite(p2) || p2 - p1 > step * 4)) continue;
        if (step >= 500 && y < 1000 && y % (step * 2) !== 0 && step < 1000000 && placed.length > 3) continue; // before 1000 only the rounder years, so deep time reads 1,000,000 BCE, 100,000 BCE, 10,000 BCE
        add(y);
      }
    }
    if (!placed.length) add(lo);
    return placed.map((q) => q.y).sort((u, v) => u - v);
  };
  // major ticks are centuries (or 50s, 10s when zoomed in)
  s.major = (y) => { const span = d1 - d0; return span > 400 ? y % 100 === 0 : span > 120 ? y % 50 === 0 : y % 10 === 0; };
  return s;
}

// Eras of the millennium used as faint bands on long axes (names are conventional, not events).
export const AGES = [
  // Vision 4, S6 and council round 1: periods named by materials and techniques, never civilizations or movements; `short`
  // is the years. A drawing prints the technique line once ("1026 TO 1450 · PAPER, TYPE, WATER CLOCKS", council round 8: one line per span); the
  // History locator shows years only. The ids stay for links and tours.
  { id: 'medieval', label: 'Paper, type, water clocks', short: '1026 to 1450', start: 1026, end: 1450 },
  { id: 'print', label: 'Press, cannon, silver', short: '1450 to 1760', start: 1450, end: 1760 },
  { id: 'industrial', label: 'Coal, steam, telegraph', short: '1760 to 1914', start: 1760, end: 1914 },
  { id: 'electric', label: 'Electronics and the transistor', short: '1914 to 1990', start: 1914, end: 1990 },
  { id: 'network', label: 'The web', short: '1990 to 2017', start: 1990, end: 2017 },
  { id: 'ai', label: 'Transformer models', short: '2017 to 2026', start: 2017, end: 2027 },
];
export const ageForYear = (y) => AGES.find((a) => y >= a.start && y < a.end) || AGES[AGES.length - 1];

// Regions used by the millennium data (events_millennium.json) and the Wheel.
export const REGIONS = [
  { id: 'europe', label: 'Europe', short: 'Europe', color: '#2d5a88' },
  { id: 'middle-east', label: 'Middle East and North Africa', short: 'MENA', color: '#c99a1e' },
  { id: 'east-asia', label: 'East Asia', short: 'E Asia', color: '#b8282e' },
  { id: 'south-asia', label: 'South Asia', short: 'S Asia', color: '#d8603c' },
  { id: 'africa', label: 'Sub-Saharan Africa', short: 'Africa', color: '#6f8f4a' },
  { id: 'latin-america', label: 'Latin America and the Caribbean', short: 'Lat America', color: '#7a9a3a' },
  { id: 'north-america', label: 'North America', short: 'N America', color: '#3c4180' },
  { id: 'oceania', label: 'Oceania and the Pacific', short: 'Oceania', color: '#2f8a9a' },
  { id: 'global', label: 'Global', short: 'Global', color: '#8f6aa0' },
];
export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
// legacy id kept for any old record or hash that still says 'americas'
REGION.americas = REGION['north-america'];
export const regionColor = (id) => (REGION[id] ? REGION[id].color : '#a59a83');
