// The Histomap as the council's kit (council/brief_stage4.md, the reference frames council/viz/kit.html): a constant-radius
// coil, one loop per century, axial pitch 0.9 of the radius, seated camera. Everything is placed relative to the year in
// hand: the coil slides along its axis and turns about it as the year changes, so the year in hand always sits at the same
// screen point. Cells only (no lane rails): a lone event in a year and lane is a full-year cell, several share the year as
// up to eight angular slots and stack outward in layers; one pixel of ground between cells. One faint thread per century at
// the tube centre in a warm-to-cool ramp keeps sparse centuries legible. Pictures stand outside the coil at their year and
// grow near the camera. Night ground with an indigo haze behind the loop in hand, grain on the ground only.
//
// Structure. The scene canvas repaints only when the camera, the stage or the data changed: a projection pass over
// precomputed coil-space coordinates (cells, thread chunks, pictures, labels), then one paint pass in year order, far past
// first, so the loop in hand covers the loops behind. Stage 4b adds the claims as leaps along the coil and 4c the ghost
// thread past 2026: both are paint steps in that same year-ordered pass (see paintScene, where they are marked).
// The overlay canvas holds what reads at rest and during travel: the field (the decade or year in hand, its events and
// claims), the readout, the strip, the rings. Travel is quantized: a wheel notch moves the target one stop (a decade before
// 2000, a year after) and a critically damped spring follows; a fling lands on a stop through a 900ms ease.
import { db, ensure, onData, fmtDate, forecastOrder, pickForecasts, forecastCount, census } from '../data.js';
import { ORDER, VERDICT_NIGHT, VERDICT_WORD, STATUS_NIGHT, STATUS_WORD, hex, GROUNDS, heat, sunk, mix, blend, toOklab, fromOklab } from '../spectrum.js';
import { DOMAIN, domainColor } from '../palette.js';
import { REGION, YEAR_MIN, YEAR_MAX, fmtYear, fmtSpan, fmtTick } from '../time.js';
import { esc, tip, select as selectRecord, openEvidence } from '../ui.js';
import { state, hashParams } from '../store.js';
import { POSTER } from '../poster.js';

// Slot space. The coil is 1026 to 2026, a slot a year, a hundred slots to a turn (slot R + 26 is 1026, slot SPAN is 2026).
// Before it lie the roots: the R slots 0 to R - 1 carry every record before 1026, from the first stone tools, along a
// piecewise axis that gives each age the room its records need (RK). T0 and T1 bound the camera; the roots are seen from
// the coil, never seated on. sl(y) is a year's slot; slf(y) the fractional one.
const T0 = 1026, T1 = YEAR_MAX, R = 400, SPAN = R + 1026, NL = ORDER.length;
const Y_LO = YEAR_MIN; // travel runs back to the record's first year, down the roots
const RK = [[YEAR_MIN, 0], [-99999, 0.12], [-9999, 0.26], [-2999, 0.5], [1, 0.76], [1026, 1]]; // [year, share of the root]
const rootF = (y) => { if (y <= RK[0][0]) return 0; for (let i = 1; i < RK.length; i++) if (y <= RK[i][0]) { const [y0, f0] = RK[i - 1], [y1, f1] = RK[i]; return f0 + (f1 - f0) * Math.log10(1 + 9 * (y - y0) / (y1 - y0)); } return 1; };
const rootY = (f) => { let lo = YEAR_MIN, hi = 1026; for (let k = 0; k < 48; k++) { const m = (lo + hi) / 2; if (rootF(m) < f) lo = m; else hi = m; } return Math.round(lo); };
const slf = (y) => (y >= T0 ? R + Math.min(T1, y) - 1000 : rootF(y) * (R - 1e-6)), sl = (y) => Math.floor(slf(y));
const rootYMemo = new Map(); const rootYM = (f) => { let v = rootYMemo.get(f); if (v === undefined) { v = rootY(f); if (rootYMemo.size < 4096) rootYMemo.set(f, v); } return v; }; // the bisection, remembered per slot
const yearOfSlotF = (s) => (s >= R ? 1000 + s - R : rootYM(s / R)), yearOfSlot = (s) => (s >= R ? 1000 + s - R : rootYM(s / R));
const slx = (y) => (y > T1 ? SPAN + (y - T1) : slf(y)); // runs on past 2026 a slot a year, for the ghost thread
// the lineages: the record's domains gathered into eight roots, each at its own angle round the axis
const LIN = [['Stone and metal', ['materials', 'energy', 'semiconductors']], ['Farming and food', ['agriculture']], ['Shelter', ['home']], ['Boats and roads', ['transport']],
  ['Writing and number', ['media', 'computing', 'software', 'ai', 'internet']], ['Healing', ['health', 'biotech']], ['Signals and sky', ['communications', 'space']], ['Law and trade', ['society']]];
const LIN_OF = Object.fromEntries(LIN.flatMap(([, ds], i) => ds.map((d) => [d, i])));
const LANE_LIN = ORDER.map((d) => LIN_OF[d] ?? 7);
const coilY = (y, lane, lift, out, k) => coilRel(slx(y), lane, lift, out, k); // the same point, addressed by year
const INK = '#eef0fa', SOFT = '#aeb6dc', NIGHT = GROUNDS.night;
// one blend, time as its meaning (spectrum.js ELECTRIC): every mark reads its colour from its year. Three steps by depth,
// full on the loop in hand, sunk toward the night a loop back and beyond. The thread in hand carries the board's fringe:
// a white core with blue and red-orange a pixel either side, each stroke crisp. The ground is night running to a deep
// violet indigo at the foot, grain over it all.
const GROUND = ['#06081a', '#0a0c2e', '#140f3e'];
const FRINGE_BLUE = '#2f6dff', FRINGE_RED = '#ff5a2a', CORE = '#fff8ec';
const FONT_DISPLAY = '"Instrument Serif", Georgia, serif', FONT_TEXT = '"Instrument Sans", system-ui, sans-serif';
const capW = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MIN_TEXT = 15;  // support size, shared with css/scale.css; nothing drawn smaller
// the camera orbits the centre of the loop in hand: elevation, the turn in from the side toward the future, distance in radii,
// the lens (f = side * fov / depth), the loop centre on the stage; type sizes and line counts per orientation
// stage 6: the coil is the hero; the field a narrower, smaller column at the right (support text holds at 15, the scale.css floor)
const DESK = { vert: false, el: 22, az: 32, dist: 2.95, fov: 1.05, ox: 0.41, oy: 0.48, picMax: 84, lines: 6, claims: 3, head: 26, line: 15, year: 15, cent: 36, readout: 96, card: 15, colW: 400 };
// the phone is the desk's tunnel stood upright: the past descends under the loop in hand, the sky over it holds the words.
// oy is a share of the reading band (see bandOf), so the loop keeps its seat whatever the screen's height
// The loop in hand spans about 65 percent of the screen's short side, as on the desk (there the loop's height against the window's), so the coil
// stands clear of both edges and the loops under it read as one spiral
const VERT = { vert: true, el: 22, az: 32, dist: 3.5, fov: 1.15, ox: 0.5, oy: 0.56, picMax: 62, lines: 4, claims: 1, head: 22, line: 15, year: 15, cent: 24, readout: 52, card: 15, colW: 0 };
const PITCH = 0.9, LANE_W = 0.062, LAYER = 0.016, A0 = 270 * Math.PI / 180, GAP_Y = 6 / 360 * 100 / 2; // the coil in radii; the thread's gap at a boundary in years
const ROOT_LEN = 4.4 * PITCH, ROOT_X = -10 * PITCH, EMBER = '#4a1a1e'; // the root's length along the axis in radii, the 1026 loop's x, the colour at its far end
const TONE = [0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2, 1]; // the lanes as tones of the one colour (full, lifted, deepened) woven across the coil, so the dense weave keeps its complexity while the hue stays the year's
const FLOOR_PULLED = 2.6, FLOOR_FAR = 2.2; // the smallest mark in px: pulled back, and on the loops behind the one in hand, so all 3,429 records stay in view // a lane's mark as [share of its slot along the loop, half-width in lanes]: bar, dot, dash, tick, by lane
const OMEGA_PHONE = 11;               // the phone's spring: the same critical damping with more weight, so a notch or a finger's stop eases over about 570ms
// the phone's camera breathes with travel: as the coil turns faster the eye draws back by up to BREATH of its distance, so the whole spiral is
// seen turning, and it comes home as travel slows. BREATH_AT: slots a second at full breath; the two times ease it out and back
const BREATH = 0.2, BREATH_AT = 110, BREATH_OUT_S = 0.16, BREATH_HOME_S = 0.3;
// a release on the phone coasts: the coil keeps the finger's speed and sheds it evenly (COAST_TAU), reaching its stop over COAST_MS
const COAST_TAU = 0.5, COAST_K = 4, COAST_MS = COAST_TAU * COAST_K * 1000, coast = (t) => (1 - Math.exp(-COAST_K * t)) / (1 - Math.exp(-COAST_K));
const OMEGA = 15;                     // the camera spring: critically damped, a notch settles in about 420ms, a glide rather than a snap
const SPEED_MAX = 520;                // the spring never travels faster than this many years a second, so a burst of notches streams past rather than cuts
const FLING_MS = 900, RIDE_MS = 1400, SETTLE_MS = 700, REST_MS = 150, LINES_MS = 120, HOLD_SPEED = 70, GLIDE_END_MS = 240, QUICK_MS = 140, RO_DWELL_MS = 220;
const NOTCH_PX = 120, YPP = 0.16;       // trackpad pixels per notch; years per pixel of a drag
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const laneIx = Object.fromEntries(ORDER.map((d, i) => [d, i]));
// per year, three steps: 0 full, 1 a loop back, 2 beyond; a small wobble along the years keeps the blend from banding
// time keeps its one meaning in colour: the coil's blend from candle yellow at 1026 to white now; the roots cool from that yellow back into ember
const rootCol = (f) => blend(EMBER, heat(0), Math.pow(clamp(f, 0, 1), 1.5));
const colAt = (sf) => (sf < R ? rootCol(sf / R) : heat((sf - R - 26) / 1000)); // sf: a fractional slot
const uOf = (y) => (slf(y) - R - 26) / 1000;
const COLS = []; for (let si = 0; si <= SPAN; si++) { const h = si < R ? rootCol(si / R) : heat(uOf(yearOfSlot(si)) + 0.012 * Math.sin(si * 0.37) + 0.008 * Math.sin(si * 1.31)); for (const t of [h, mix(h, INK, 0.22), sunk(h, 0.22)]) COLS.push(t, sunk(t, 0.2), sunk(t, 0.42)); } // per slot: three tones, each in three depth steps; index (slot * 3 + tone) * 3 + step
const heatOf = (y) => colAt(slf(y)); // the blend at a year
// weight: a record's significance 1 to 5 on its cell. 1 to 4 keep the cell's size and lightness and step down in chroma inside the time hue; 5 is larger and lighter
const W_SIZE = [1, 1, 1, 1, 1.08], W_SAT = [0.6, 0.7, 0.85, 1, 0.95], W_LIFT = [0, 0, 0, 0.03, 0.17];
const wOf = (e) => clamp(Math.round((e && e.significance) || 3), 1, 5) - 1;
const satOf = (h, k, up = 0) => { const [L, a, b] = toOklab(h); return fromOklab(Math.min(1, L + up), a * k, b * k); }; // same hue: chroma scaled, lightness lifted
const COLW = new Array(COLS.length * 5), colW = (key) => COLW[key] || (COLW[key] = satOf(COLS[(key / 5) | 0], W_SAT[key % 5], W_LIFT[key % 5])); // key = COLS key * 5 + weight
const typeOf = (y) => mix(heatOf(y), INK, 0.32); // the same colour lifted for type, so early blue reads on the night
// the phone's type colour: the same lift, raised further where the deep roots' dark red would fall under 4.5 to 1 on the night
const lumOf = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((u) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const typeOfPhone = (y) => { const h = heatOf(y); let m = 0.32, c = mix(h, INK, m); while (m < 0.9 && (lumOf(c) + 0.05) / 0.062 < 5) { m += 0.06; c = mix(h, INK, m); } return c; };
const u = (y) => slf(y) / SPAN;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const early = (y) => y < 2000; // the field's unit is the decade before 2000 (the 1900s run thin year by year: the median year holds 10 events), the year from 2000; travel stops are their own rule (stopOf)
// A root unit is ten slots, and its bounds are years: RB[k] is unit k's first year, RB[RB.length - 1] the coil's first (1026). A year belongs to
// the unit whose bounds hold it, so a unit's name, its count, its records and the stop that seats it agree (a slot's first year is rounded, and
// a year's own slot can fall one under it: 783 named the unit above while sitting in the one below, and the last root unit ended at 999 for
// records that run to 1025).
const RB = []; for (let k = 0; k < R / 10; k++) RB.push(yearOfSlot(k * 10)); RB.push(T0);
const rootUnit = (y) => { let lo = 0, hi = RB.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (RB[m] <= y) lo = m; else hi = m - 1; } return lo; };
const decadeOf = (y) => (y < T0 ? RB[rootUnit(y)] : yearOfSlot(Math.floor(sl(y) / 10) * 10)); // the ten-slot unit's first year: a decade on the coil, a century back to 10,000 BCE, ten millennia before
const decadeEnd = (d) => (d < T0 ? RB[rootUnit(d) + 1] - 1 : yearOfSlot(Math.floor(sl(d) / 10) * 10 + 10) - 1);
// the stops of travel: 1026, then every decade to 2000, then every year to 2026
// Down the roots a stop is a unit's first year, so the unit in hand opens at the year the numeral reads, as a decade does on the coil. The coil's
// slots under 1026 hold no record (those years lie on the roots), so no stop stands there: under the 1030s the next stop is the last root unit's.
const ROOT_TOP = RB.length - 2, COIL_LO = yearOfSlot(Math.round(sl(T0) / 10) * 10); // the last root unit; the coil's first stop
const stopOf = (y) => clamp(y < T0 ? RB[Math.min(ROOT_TOP, Math.round(slf(y) / 10))] : y < 2000 ? yearOfSlot(Math.round(sl(y) / 10) * 10) : Math.round(y), Y_LO, T1);
const nextStop = (y, dir) => {
  if (y < T0) { const k = rootUnit(y); return clamp(dir > 0 ? (k < ROOT_TOP ? RB[k + 1] : COIL_LO) : (y > RB[k] ? RB[k] : RB[Math.max(0, k - 1)]), Y_LO, T1); }
  const to = dir > 0 ? (y < 2000 ? yearOfSlot(Math.floor(sl(y) / 10 + 1e-6) * 10 + 10) : Math.floor(y + 1e-6) + 1) : (y > 2000 ? Math.ceil(y - 1e-6) - 1 : yearOfSlot(Math.ceil(sl(y) / 10 - 1e-6) * 10 - 10));
  return clamp(to < T0 ? RB[ROOT_TOP] : to, Y_LO, T1);
};
const stepStops = (y, n) => { let s = stopOf(y); for (let k = 0; k < Math.abs(n); k++) s = nextStop(s, Math.sign(n)); return s; };

let host = null, cv = null, ov = null, ctx = null, octx = null, ro = null;
let W = 0, H = 0, DPR = 1;
// the camera: the year in hand follows target through the spring; zoom 0 seated, 1 the whole coil; lift the arrival's extra distance
// the camera lives in slot space (s, ts: the seat and its target, vel in slots a second), so travel feels even along the coil whatever the pitch; year and target read and write it in years
const cam = { s: SPAN, ts: SPAN, vel: 0, zoom: 0, lift: 0,
  get year() { return yearOfSlotF(this.s); }, set year(y) { this.s = slf(clamp(y, Y_LO, T1)); },
  get target() { return yearOfSlotF(this.ts); }, set target(y) { this.ts = slf(clamp(y, Y_LO, T1)); } };
let ride = null;            // { y0, y1, z0, z1, l0, l1, t0, dur, ease, then }
let pull = null;            // the pulled-back camera, fitted to the stage: { key, dist, cx, dx, dy }
let textA = 1;              // the arrival: the type's alpha
let breath = 0;
let hover = null, highlight = null, raf = 0, lastT = 0, resting = true, restTimer = 0, moved = false, settling = false;
let openAt = null;          // the camera when a record opened: { year, zoom, rode }
let pics = null, picAtlas = [], picsReady = false, picsAsked = false, picsSettled = false, fontsV = 0; // picsSettled: every sheet has loaded or failed (the arrival waits for it)
let momentPics = null, momentAsked = false; // the moments with a cleared picture, as coil thumbs (stage 5)
let forecasts = null, forecastsAsked = false;
let G = null;               // the coil's geometry, built once per data load (see layout)
let awaitingArrival = false, landingRaf = 0;
// per-frame projections, kept between frames while the camera stands
let cellQ = null, cellSX = null, cellSY = null, cellPX = null, cellOn = null, cellD = null;
let picSX = null, picSY = null, picPX = null, picD = null, picOn = null, picN = 0;
// stage 7: the pictures of the unit in hand ease to 1.3 times their size and paint last; the picture in reference grows to 1.6 with its context beside it
let picMul = null, picAnim = false, picT = 0, picOfEvent = null, picFa = null; // picFa: a picture's share of light once the camera pulls back
const UNIT_MUL = 1.3, REF_MUL = 1.6, PIC_EASE_MS = 560, REF_MS = 240, SAT_GAP = 12;
let ref = null, refA = 0, refT = 0, refAnim = false, refBox = null; const satHits = [];
// stage 8: markers of time, short labels on the coil; mkA the eased alpha per marker
let mkA = null, mkT = 0, mkAnim = false; const mkHits = []; let mkShown = 0;
const underRead = (x0, y0, x1, y1) => !!readPlate && ((x0 < readPlate.x + readPlate.w + 12 && x1 > readPlate.x - 12 && y0 < readPlate.y + readPlate.h + 12 && y1 > readPlate.y - 12) || (readPlate.on && x0 < readPlate.mx + readPlate.hw + 1 && x1 > readPlate.mx - readPlate.hw - 1 && y0 < readPlate.my + readPlate.hh + 1 && y1 > readPlate.my - readPlate.hh - 1)); // a year the reading plate would cut rests
const decPl = []; // where the phone's decade marks stand this frame, the ring's too: no highlight's label comes within 12 points of one
const MK_CAP = 14, MK_CAP_PHONE = 14, MK_PAD = 4;
const PIC_FLOOR_DESK = 112, PIC_CEIL_DESK = 58; // the strip's band at the foot and the bar at the head stay clear of pictures
// the phone's reading band in canvas pixels: one recording serves Reels and feed, so every word sits inside the centred
// 4 by 5 box and clear of the 9:16 frame's top 14 percent, bottom 35 percent and outer 6 percent; marks alone run past it
let BAND = { x0: 0, x1: 0, y0: 0, y1: 0 };
function bandOf() {
  const r = host.getBoundingClientRect(), vw = window.innerWidth || r.width, vh = window.innerHeight || r.height;
  const fw = Math.min(vw, vh * 9 / 16), fh = Math.min(vh, vw * 16 / 9), fx = (vw - fw) / 2, fy = (vh - fh) / 2, bh = Math.min(vh, vw * 1.25), by = (vh - bh) / 2;
  return { x0: Math.round(fx + fw * 0.06 - r.left), x1: Math.round(fx + fw * 0.94 - r.left), y0: Math.round(Math.max(fy + fh * 0.14, by) - r.top), y1: Math.round(Math.min(fy + fh * 0.65, by + bh) - r.top) };
}
const HEAD_H = () => 22 + 8 + Math.round(VERT.readout * 0.7) + 8; // the phone's header under the band's top: one row of strip labels, then the year in hand
const TAG_H = MIN_TEXT + 6, PLATE = 'rgba(7,9,28,0.8)'; // a phone label's height, and the night plate a word or a year stands on where the coil runs under it
const skyTop = () => BAND.y0 + HEAD_H() + 4; // where the phone's stage begins under its header
const picFloor = () => (H > W ? 6 : PIC_FLOOR_DESK), picCeil = () => (H > W ? skyTop() : PIC_CEIL_DESK);
const stageY = (P) => (P.vert ? BAND.y0 + (BAND.y1 - BAND.y0) * P.oy : H * P.oy);
// the phone's record sheet: an open record lifts the stage until its mark stands in a window under the header, and the sheet rises from the window's foot
const SHEET_WIN = 52, SHEET_MS = 380;
let shA = 0, shT = 0;
const sheetTop = () => skyTop() + SHEET_WIN, sheetI = (P) => (P.vert && state.sel && cam.zoom < 0.02 ? indexOf(state.sel) : -1);
const unitSel = () => String(state.sel || '').startsWith('unit:'), sheetUp = (P) => sheetI(P) >= 0 || (P.vert && cam.zoom < 0.02 && unitSel()); // a record's sheet, or the sheet of the unit in hand
let chunkSX = null, chunkSY = null, chunkOn = null, chunkD = null;
let sceneKey = '', grainTile = null, groundCv = null, groundKey = '', readoutText = '';
let picHits = [], lineHits = [], leapHits = [], strip = null, word = null;
let fcLeaps = null, litSet = null, litKey = '', fcHead = null, picOfCell = null, waveKey = '', waveT0 = 0; const WAVE_MS = 900; // the unit in hand and when it arrived: a wave of light runs through its cells // the future's clickable header box; cell index -> picture index     // the forecasts on the ghost thread, and the leaps a search lights
let leaps = null, leapDec = null, leapT0 = 0, tracing = false, litForce = null, litHover = null;
let difLeaps = null, cardOff = false, cardKey = '', hoverCent = null, centCounts = null; // stage 5: the diffusion leaps, the phone card's toggle, the century under the cursor when pulled back // the decade in hand's dated claims as leaps, and which one is lit
const T2 = 2076, GHOST_A = 0.5, GHOST_FROM = 1990, FC_FROM = 2020, FC_CAP = 48, FC_REACH = 2040; // the ghost thread past 2026 and the forecasts on it (stage 4c)
const TRACE_MS = 600, LEAP_W = 1.8, LEAP_LIT_W = 2.6, LEAP_DOT = 3.5, WORD_STEP = 18, LEAP_MAX_WORDS = 8, LEAP_REACH = 30;
let linesA = 1, linesT = 1; // the field's lines: their alpha and where it is going (they drop during fast travel)
let field = null;           // the unit in hand, built when the decade or year changes
let unitKey = '', unitT0 = 0, unitQuick = false; // stage 10: the unit in hand and when it arrived, for the column's entrance; quick when it arrived mid-travel
let roPrev = null, readoutYear = 2026, roT0 = 0, hoverT0 = 0, hintT0 = 0; // the big year's crossfade and when its text last changed, the hover's ease, the first hint's fade
const EASE_MS = 260, STAGGER_MS = 55; // one easing family for the column, the numeral and the rings
const unitCache = new Map(); // a unit's rows, by key
const prof = { project: 0, paint: 0, overlay: 0, total: 0, frames: 0 };

let posterP = null; // the still's parameters: the desk layout with the loop in hand placed where the poster asks
const par = () => { const P = H > W ? VERT : DESK; if (!POSTER || P.vert) return P; if (!posterP || posterP.base !== P) posterP = { ...P, base: P, ox: POSTER.ox, oy: POSTER.oy }; return posterP; };
// the camera basis for an orientation: camDir from the target to the camera, forward, right (toward the future), up
function basisOf(P) {
  const el = P.el * Math.PI / 180, az = P.az * Math.PI / 180;
  const camDir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const fwd = [-camDir[0], -camDir[1], -camDir[2]];
  let right = [-fwd[2], 0, fwd[0]]; const l = Math.hypot(right[0], right[2]); right = [right[0] / l, 0, right[2] / l];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  return { camDir, fwd, right, up };
}

// ---------- pictures: the Image World pool seated at their events (data/pictures.json, arrival/thumb*.jpg) ----------
function ensurePictures() {
  if (picsAsked) return; picsAsked = true;
  const V = window.__BUILD ? `?v=${window.__BUILD}` : '';
  // a fresh visit has the list and the sheets on their way already (index.html, window.__arr); a return visit asks here
  const A = window.__arr || null;
  const list = (A && A.pics ? A.pics.catch(() => null) : Promise.resolve(null)).then((j) => j || fetch(`data/pictures.json${V}`).then((r) => r.json()));
  list.then(async (j) => {
    pics = j.pictures;
    const nAtlas = Math.max(...pics.map((p) => p.atlas)) + 1;
    const sheets = A && A.sheets ? await A.sheets.catch(() => null) : null;
    let left = nAtlas;
    const settle = () => { if (--left === 0) { picsReady = picAtlas.some(Boolean); picsSettled = true; G = null; invalidate(); } };
    for (let i = 0; i < nAtlas; i++) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const fromUrl = () => { img.onerror = settle; img.src = `arrival/thumb${i}.jpg${V}`; };
      img.onload = () => { picAtlas[i] = img; settle(); };
      img.onerror = settle;
      if (sheets && sheets[i]) sheets[i].then((b) => { img.onerror = fromUrl; img.src = URL.createObjectURL(b); }, fromUrl); else fromUrl();
    }
  }).catch(() => { picsSettled = true; });
}
// the three moments with a picture (img/moments/) stand on the coil like the Image World pictures, with the moment's halo
function ensureMomentPics() {
  if (momentAsked || !db.loaded.has('text')) return;
  const list = db.events.filter((e) => e.type === 'moment' && e.picture && e.picture.src); if (!list.length) return;
  momentAsked = true; const V = window.__BUILD ? `?v=${window.__BUILD}` : ''; let left = list.length; const out = [];
  for (const e of list) {
    const img = new Image();
    img.onload = () => { out.push({ e, img }); if (--left === 0) { momentPics = out; G = null; invalidate(); } };
    img.onerror = () => { if (--left === 0) { momentPics = out; G = null; invalidate(); } };
    img.src = `${e.picture.src}${V}`;
  }
}
// the AI forecasts due in the 2020s (data/forecasts.json: t the year named, v the verdict, who, text, said)
function ensureForecasts() {
  if (db.forecasts) { if (!forecasts) { forecasts = db.forecasts; fcLeaps = null; } return; } // read already (a deep link to a forecast)
  if (forecastsAsked) return; forecastsAsked = true;
  ensure('forecasts'); // data.js reads the file once for the helix and the record pane alike (db.forecasts, fc:<index>)
}

// ---------- the geometry, in coil space relative to 2026: x along the axis, (cy, cz) around it ----------
// a point at year y, lane offset (in lanes) and lift (in radii): the frame turns and slides it to the year in hand
function coilRel(sy, lane, lift, out, k) { // sy: a (fractional) slot
  if (sy < R) return rootRel(sy, lane, lift, out, k);
  const t = (sy - SPAN) / 100, a = t * Math.PI * 2, r = 1 + lift;
  out[k] = t * PITCH + lane * LANE_W; out[k + 1] = Math.cos(a) * r; out[k + 2] = Math.sin(a) * r;
}
// a point on the roots: the lineage of the lane, at its angle round the axis; the trunk runs on the axis far behind 1026 and
// each root swells out to the loop's radius as it reaches 1026, so the eight together make the coil's bell
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const rootR = (t) => 0.035 + 0.965 * Math.pow(smooth((t - 0.08) / 0.92), 1.15); // the bell's radius at a share t of the root
const rootAng = (i) => A0 + Math.PI + (i / LIN.length) * Math.PI * 2; // the first root enters opposite the coil's start angle, the rest round the circle
function rootRel(sy, lane, lift, out, k) {
  const l = clamp(Math.round(lane + 6), 0, NL - 1), i = LANE_LIN[l], t = clamp(sy / R, 0, 1), f = Math.pow(smooth((t - 0.08) / 0.92), 1.15);
  const r = 0.035 + (1 - 0.035) * f + lift * (0.25 + 0.75 * f);
  const sub = (lane + 6 - l) * (LANE_W / Math.max(0.12, r)), a = rootAng(i) + sub + Math.sin(t * 9 + i) * 0.03 * (1 - f) * f; // a lane's width on the root is the coil's lane width
  out[k] = ROOT_X - ROOT_LEN * (1 - t); out[k + 1] = Math.cos(a) * r; out[k + 2] = Math.sin(a) * r;
}
function layout() {
  const n = db.events.length;
  const key = `${n}:${picsReady ? pics.length : 0}`;
  if (G && G.key === key) return;
  // the cells: a year's events on a lane share the year as up to eight angular slots, the weightiest first, then stack outward.
  // Each lane is a layer of the loop with its own mark (a bar, a dot, a thin dash, a tick across the lane), so a century
  // reads as a stack of thin patterned rings and the marks stay small beside the pictures; the lane is still the domain
  const groups = new Map();
  for (let i = 0; i < n; i++) { const e = db.events[i], k = sl(e.year) * NL + (laneIx[e.domain] ?? 6); const g = groups.get(k); if (g) g.push(i); else groups.set(k, [i]); }
  const cellG = new Float32Array(n * 12), cellYear = new Int16Array(n), cellLane = new Uint8Array(n), cellLayer = new Uint8Array(n), cellMoment = new Uint8Array(n);
  // past five layers a stack closes up, so a crowded year (2026 holds nearly 500 records) rises as a mound, not a blade
  for (const [k, g] of groups) {
    const year = Math.floor(k / NL), l = k % NL, ln = l - 6, nS = Math.min(8, g.length), sw = 1 / nS;
    g.sort((a, b) => ((db.events[b].significance || 0) - (db.events[a].significance || 0)) || (db.events[a].id < db.events[b].id ? -1 : 1));
    for (let j = 0; j < g.length; j++) {
      const i = g[j], slot = j % nS, layer = Math.floor(j / nS), lift = LAYER * (layer <= 5 ? layer : 5 + (layer - 5) * 0.4), root = year < R, sw2 = root ? sw * 2.6 : sw, y0 = root ? year - 0.8 : year, yA = root ? Math.min(R - 0.3, y0 + slot * sw2 + 0.012) : y0 + slot * sw2 + 0.012, yB = root ? Math.min(R - 0.05, y0 + (slot + 1) * sw2 - 0.012) : y0 + (slot + 1) * sw2 - 0.012; // on the roots a slot is a hundredth of the coil's arc, so a cell takes 2.6 slots to keep the coil's mark size
      coilRel(yA, ln - 0.46, lift, cellG, i * 12); coilRel(yB, ln - 0.46, lift, cellG, i * 12 + 3); coilRel(yB, ln + 0.46, lift, cellG, i * 12 + 6); coilRel(yA, ln + 0.46, lift, cellG, i * 12 + 9);
      cellYear[i] = year; cellLane[i] = l; cellLayer[i] = Math.min(255, layer); if (db.events[i].type === 'moment') cellMoment[i] = 1;
    }
  }
  // the paint order: by year, then layer, so each loop covers the loops behind it and a stack grows outward
  const order = new Int32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  const cellW = new Uint8Array(n); for (let i = 0; i < n; i++) cellW[i] = wOf(db.events[i]);
  order.sort((a, b) => (cellYear[a] - cellYear[b]) || (cellW[a] - cellW[b]) || (cellLayer[a] - cellLayer[b]) || (a - b)); // inside a year the heavier record paints later
  const yearStart = new Int32Array(SPAN + 2); { let p = 0; for (let y = 0; y <= SPAN + 1; y++) { while (p < n && cellYear[order[p]] < y) p++; yearStart[y] = p; } } // cellYear holds slots
  // the thread: one chunk per decade at the tube centre, a point every half year, a gap at each century boundary
  const chunks = [];
  for (let c0 = R; c0 < SPAN; c0 += 100) { // c0, d0, a, b are slots: a turn is a hundred slots, a chunk ten; the roots draw their own lines
    const ci = (c0 - R) / 100, lo = Math.max(R + 26, c0 + GAP_Y), hi = Math.min(SPAN, c0 + 100 - GAP_Y);
    for (let d0 = c0; d0 < c0 + 100; d0 += 10) {
      const a = Math.max(lo, d0), b = Math.min(hi, d0 + 10); if (b <= a) continue;
      const ys = []; for (let y = a; y < b - 1e-6; y += 0.5) ys.push(y); ys.push(b);
      const pts = new Float32Array(ys.length * 3); ys.forEach((y, j) => coilRel(y, 0, -0.02, pts, j * 3));
      const ym = yearOfSlotF((a + b) / 2);
      chunks.push({ ci, dec: yearOfSlot(d0), ds: d0, m: ys.length, pts, ymid: ym, col: heatOf(ym), col1: sunk(heatOf(ym), 0.25), col2: sunk(heatOf(ym), 0.45) });
    }
  }
  const chunkPts = chunks.reduce((s, c) => s + c.m, 0);
  // pictures stand outside the coil at their year, lifted 0.34 or 0.60 radii, a lane offset so neighbours do not stack
  const picList = [];
  if (picsReady && pics) for (let k = 0; k < pics.length; k++) { const pc = pics[k], e = db.byId.get(pc.id); if (!e || !picAtlas[pc.atlas]) continue; picList.push({ pc, e, i: indexOf(e.id), atl: picAtlas[pc.atlas], a: pc.a || (pc.uw && pc.vh ? (pc.uw * picAtlas[pc.atlas].naturalWidth) / (pc.vh * picAtlas[pc.atlas].naturalHeight) : 1) }); }
  if (momentPics) for (const mp of momentPics) { if (!mp.img.naturalWidth) continue; picList.push({ pc: { u: 0, v: 0, uw: 1, vh: 1 }, e: mp.e, i: indexOf(mp.e.id), atl: mp.img, a: mp.img.naturalWidth / mp.img.naturalHeight, moment: true }); }
  picList.sort((a, b) => a.e.year - b.e.year);
  const picG = new Float32Array(picList.length * 3), picGp = new Float32Array(picList.length * 3); // picGp: the same pictures laid flush on the coil's skin, where they settle when the camera pulls back
  picList.forEach((p, k) => { const y = sl(p.e.year) + 0.5; if (p.e.year < T0) { coilRel(y, (laneIx[p.e.domain] ?? 6) - 6 + (k % 2 ? 0.45 : -0.45), 0.05 + ((k * 7) % 3) * 0.05, picG, k * 3); coilRel(y, (laneIx[p.e.domain] ?? 6) - 6 + (k % 2 ? 0.45 : -0.45), 0.04, picGp, k * 3); } else { coilRel(y, (k % 5 - 2) * 2.6, 0.34 + ((k * 7) % 3) * 0.22, picG, k * 3); coilRel(y, (k % 5 - 2) * 2.6, 0.07, picGp, k * 3); } }); // five lanes and three lifts, so neighbours fan out instead of stacking; on a root a picture hugs its line, a lane either side
  rootShow.clear(); { const byLin = new Map(); for (const p of picList) { if (p.e.year >= T0) continue; const li = LIN_OF[p.e.domain] ?? 7; if (!byLin.has(li)) byLin.set(li, []); byLin.get(li).push(p.e); }
    for (const list of byLin.values()) { list.sort((a, b) => (b.significance || 0) - (a.significance || 0) || b.year - a.year); const kept = []; for (const e of list) { if (kept.length >= 8) break; if (kept.every((q) => Math.abs(slf(q.year) - slf(e.year)) > 18)) kept.push(e); } for (const e of kept) rootShow.add(e.id); } }
  const picYearStart = new Int32Array(SPAN + 2); { let p = 0; for (let y = 0; y <= SPAN + 1; y++) { while (p < picList.length && sl(picList[p].e.year) < y) p++; picYearStart[y] = p; } }
  // century numerals on the open floor inside each loop near its start; decade labels are placed per frame (the loop in hand only)
  const cents = []; for (let si = R + 100; si <= SPAN - 26; si += 100) cents.push(yearOfSlot(si)); // a numeral at the start of every turn: 1100 to 2000, then 9000 BCE, 8000 BCE and so back
  const centG = new Float32Array(cents.length * 3); cents.forEach((y, k) => coilRel(sl(y) + 5, 0, -0.42, centG, k * 3));
  // the counts per year and per decade for the readout and the field
  const perYear = new Uint16Array(SPAN + 2), perDecade = new Map();
  let decMax = 0;
  for (const e of db.events) { const y = sl(e.year); perYear[y]++; const dc = decadeOf(e.year); perDecade.set(dc, (perDecade.get(dc) || 0) + 1); }
  // stage 8: the markers, each at its picture or at the picture ring of its year
  const picK = new Map(); picList.forEach((p, k) => { if (!picK.has(p.e.id)) picK.set(p.e.id, k); });
  const mk = []; for (const m of db.markers || []) { const e = db.byId.get(m.id); const i = e ? indexOf(e.id) : -1; if (!e || i < 0) continue; const g = new Float32Array(3); coilRel(sl(e.year) + 0.5, (i % 3 - 1) * 2.4, 0.34 + (i % 2) * 0.26, g, 0); mk.push({ e, i, label: m.label, w: m.w || 1, k: picK.has(e.id) ? picK.get(e.id) : -1, g }); }
  mkA = new Float64Array(mk.length); // doubles: an eased value must land exactly on its target (0.9, 1.3) or the loop never rests
  for (const v of perDecade.values()) decMax = Math.max(decMax, v);
  G = { key, n, cellG, cellYear, cellLane, cellLayer, cellMoment, cellW, order, yearStart, chunks, chunkPts, picList, picG, picGp, picYearStart, cents, centG, perYear, perDecade, mk, decMax };
  cellQ = new Float32Array(n * 8); cellSX = new Float32Array(n); cellSY = new Float32Array(n); cellPX = new Float32Array(n); cellOn = new Uint8Array(n); cellD = new Float32Array(n);
  picN = picList.length; picSX = new Float32Array(picN); picSY = new Float32Array(picN); picPX = new Float32Array(picN); picD = new Float32Array(picN); picOn = new Uint8Array(picN);
  picMul = new Float64Array(picN).fill(1); if (H > W) picT = 0; picFa = new Float32Array(picN).fill(1); picOfEvent = new Map(); for (let k = 0; k < picN; k++) if (!picOfEvent.has(picList[k].e.id)) picOfEvent.set(picList[k].e.id, k); ref = null; refA = 0;
  chunkSX = new Float32Array(chunkPts); chunkSY = new Float32Array(chunkPts); chunkOn = new Uint8Array(chunks.length); chunkD = new Float32Array(chunks.length);
  pull = null; sceneKey = ''; field = null;
}
let idx = null, idxN = -1;
// while a record's sheet is open the big numeral reads that record's year, not the year in hand (null when no record is open)
const selYear = () => { const i = state.sel ? indexOf(state.sel) : -1; return i >= 0 ? db.events[i].year : null; };
const indexOf = (id) => { if (!idx || idxN !== db.events.length) { idx = new Map(db.events.map((e, i) => [e.id, i])); idxN = db.events.length; } const i = idx.get(id); return i == null ? -1 : i; };

// ---------- the camera: seated on the loop in hand, or pulled back to the whole coil ----------
let basisP = null, basis = null;
// the phone pulled back: the eye level with the axis and well round to its end, so the coil stands upright as a horn, 2026 widest under the header and the roots narrowing to the foot
const PULL_V = { el: 0, az: 63, c: 0.7, dist: 10 };
let basisZ = null, basisZk = -1;
function view(P) {
  if (basisP !== P) { basisP = P; basis = basisOf(P); }
  const z = cam.zoom, pb = z > 0 ? fitPull(P) : null, sY0 = slf(cam.year), rz = sY0 < R ? Math.max(0.3, Math.min(1, 0.08 + rootR(sY0 / R))) : 1; // down the roots the camera closes in as the trunk narrows, so an age's records fill the stage as a loop does
  const dist = lerp(P.dist * (1 + cam.lift) * rz * (P.vert ? 1 + BREATH * breath : 1), pb ? pb.dist : P.dist, z), tx = pb ? ((P.vert ? PULL_V.c : 0.5) * SPAN - slf(cam.year)) * PITCH / 100 * z : 0; // pulled back, the orbit centre moves to the coil's middle
  let bs = basis;
  if (P.vert && z > 0) { const zk = Math.round(z * 400); if (zk !== basisZk) { basisZk = zk; const e = z * z * (3 - 2 * z); basisZ = basisOf({ el: lerp(P.el, PULL_V.el, e), az: lerp(P.az, PULL_V.az, e) }); } bs = basisZ; } // the phone turns to its upright view as it pulls back
  const { camDir, fwd, right, up } = bs;
  const Y = cam.year, sY = slf(Y), inRoots = sY < R; // down the roots the camera stops turning (there is no helix to follow) and slides along the trunk
  const th = A0 + (SPAN - (inRoots ? R + 26 : sY)) * Math.PI * 2 / 100, xs = inRoots ? -(ROOT_X - ROOT_LEN * (1 - sY / R)) : (SPAN - sY) * PITCH / 100;
  const V = { P, fwd, right, up, tx, cp: [tx + camDir[0] * dist, camDir[1] * dist, camDir[2] * dist], xs, c: Math.cos(th), s: Math.sin(th),
    ox: W * P.ox + (pb ? pb.dx * z : 0), oy: stageY(P) + (pb ? pb.dy * z : 0), side: (P.vert ? W : H) * (pb && pb.k ? lerp(1, pb.k, z) : 1), dist, z };
  if (P.vert && shA > 0 && G) { // the stage slides until the open record's mark stands in the window, between the band's sides
    const i = sheetI(P); if (i >= 0 && i < G.n) { const k = i * 12, g = G.cellG, p = projR(V, (g[k] + g[k + 6]) / 2, (g[k + 1] + g[k + 7]) / 2, (g[k + 2] + g[k + 8]) / 2);
      if (p.d) { const e = shA * (2 - shA); V.oy += (skyTop() + SHEET_WIN * 0.5 - p.sy) * e; V.ox += (clamp(p.sx, BAND.x0 + 48, BAND.x1 - 48) - p.sx) * e; } }
  }
  return V;
}
// project a coil-space point: writes sx, sy, returns depth d (0 when behind the camera) and the focal length f
const PT = { sx: 0, sy: 0, d: 0, f: 0 };
function projR(V, xr, cy, cz) {
  const x = xr + V.xs - V.cp[0], y = cy * V.c - cz * V.s - V.cp[1], z = cy * V.s + cz * V.c - V.cp[2];
  const d = x * V.fwd[0] + y * V.fwd[1] + z * V.fwd[2];
  if (d <= 0.08) { PT.d = 0; return PT; }
  const f = V.side * V.P.fov / d, rx = x * V.right[0] + y * V.right[1] + z * V.right[2], uy = x * V.up[0] + y * V.up[1] + z * V.up[2];
  if (V.P.vert) { PT.sx = V.ox + uy * f; PT.sy = V.oy - rx * f; } else { PT.sx = V.ox + rx * f; PT.sy = V.oy - uy * f; }
  PT.d = d; PT.f = f; return PT;
}
const FIELD_INK = 0.88;
const nearOf = (V, d) => clamp((V.P.dist + 2.2 - d) / 3.2, 0, 1); // 1 on the loop in hand, 0 three loops back
const depthA = (V, d) => 0.30 + 0.70 * nearOf(V, d);              // far loops never fall below 30 percent
const ahead = (y) => { const d = slf(y) - slf(cam.year); const a = d <= 2 ? 1 : d >= 40 ? 0 : 1 - (d - 2) / 38; return lerp(a, 1, cam.zoom); }; // in slots: forty slots ahead of the year in hand the coil fades
const MARGIN = 80;
const onStage = (sx, sy) => sx >= -MARGIN && sx <= W + MARGIN && sy >= -MARGIN && sy <= H + MARGIN;
// where the whole coil fits on the stage: the orbit centre moves to the coil's middle and the distance grows until the coil sits inside the frame above the readout
function fitPull(P) {
  const key = `${W}x${H}:${P.vert}`;
  if (pull && pull.key === key) return pull;
  const b = basisOf(P.vert ? PULL_V : P), box = P.vert ? [0.03 * W, 0.97 * W, skyTop() + 10, H - 14] : [0.07 * W, 0.93 * W, 0.1 * H, 0.72 * H]; // the phone gives the coil its whole stage under the header
  const cx = (P.vert ? PULL_V.c : 0.5) * SPAN - SPAN; // the coil's middle along the axis (in slots), relative to the year in hand when that is 2026
  const pts = []; for (let y = 0; y <= SPAN + 30; y += 4) for (const lift of (P.vert ? [-0.05, 0.2] : [-0.1, 0.45])) for (const lane of (y >= R ? [-4, 4] : [0])) { const o = new Float32Array(3); coilRel(y, lane, lift, o, 0); pts.push(o); } // the coil's lanes and lifted pictures count toward its extent
  const extent = (dist) => {
    const V = { P, fwd: b.fwd, right: b.right, up: b.up, cp: [cx * PITCH / 100 + b.camDir[0] * dist, b.camDir[1] * dist, b.camDir[2] * dist], xs: 0, c: Math.cos(A0), s: Math.sin(A0), ox: W * P.ox, oy: stageY(P), side: P.vert ? W : H, dist, z: 1 };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of pts) { const p = projR(V, r[0], r[1], r[2]); if (!p.d) return null; x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx); y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy); }
    return { x0, x1, y0, y1 };
  };
  if (P.vert) { // the phone holds its eye where the horn reads best and fits by scale, so the far loops keep a body
    const ex = extent(PULL_V.dist) || { x0: 0, x1: W, y0: 0, y1: H }, ox = W * P.ox, oy = stageY(P), k = Math.min((box[1] - box[0]) / (ex.x1 - ex.x0), (box[3] - box[2]) / (ex.y1 - ex.y0));
    pull = { key, dist: PULL_V.dist, k, cx: cx * PITCH / 100, dx: (box[0] + box[1]) / 2 - (ox + ((ex.x0 + ex.x1) / 2 - ox) * k), dy: (box[2] + box[3]) / 2 - (oy + ((ex.y0 + ex.y1) / 2 - oy) * k) };
    return pull;
  }
  let lo = 2, hi = 120;
  for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2, ex = extent(mid); if (ex && ex.x1 - ex.x0 <= box[1] - box[0] && ex.y1 - ex.y0 <= box[3] - box[2]) hi = mid; else lo = mid; }
  const ex = extent(hi) || { x0: 0, x1: W, y0: 0, y1: H };
  pull = { key, dist: hi, cx: cx * PITCH / 100, dx: (box[0] + box[1]) / 2 - (ex.x0 + ex.x1) / 2, dy: (box[2] + box[3]) / 2 - (ex.y0 + ex.y1) / 2 };
  return pull;
}

// ---------- the scene: a projection pass, then one paint pass in year order ----------
// where every cell of the record stands in this view: drawn, past the frame's edge, behind the eye, or ahead of the year in hand (dbg only)
function cellTally(V) {
  const { n, cellG } = G, horizon = slf(cam.year) + 40 + cam.zoom * SPAN, t = { record: n, drawn: 0, pastEdge: 0, behindEye: 0, ahead: 0 };
  for (let i = 0; i < n; i++) {
    if (G.cellYear[i] > horizon) { t.ahead++; continue; }
    let k = i * 12, cx = 0, cy = 0, ok = true; for (let c = 0; c < 4; c++, k += 3) { const p = projR(V, cellG[k], cellG[k + 1], cellG[k + 2]); if (!p.d) { ok = false; break; } cx += p.sx; cy += p.sy; }
    if (!ok) t.behindEye++; else if (!onStage(cx * 0.25, cy * 0.25)) t.pastEdge++; else t.drawn++;
  }
  return t;
}
function project(V) {
  const { n, cellG, chunks, picG, picGp, picList } = G;
  const horizon = slf(cam.year) + 40 + cam.zoom * SPAN; // in slots
  for (let i = 0; i < n; i++) {
    cellOn[i] = 0; if (G.cellYear[i] > horizon) continue;
    let k = i * 12, q = i * 8, dmin = 1e9, cx = 0, cy = 0, ok = true;
    for (let c = 0; c < 4; c++, k += 3, q += 2) { const p = projR(V, cellG[k], cellG[k + 1], cellG[k + 2]); if (!p.d) { ok = false; break; } cellQ[q] = p.sx; cellQ[q + 1] = p.sy; cx += p.sx; cy += p.sy; if (p.d < dmin) dmin = p.d; }
    if (!ok) continue;
    cx *= 0.25; cy *= 0.25; if (!onStage(cx, cy)) continue;
    q = i * 8; cellSX[i] = cx; cellSY[i] = cy; cellD[i] = dmin; cellOn[i] = 1;
    cellPX[i] = Math.max(Math.hypot(cellQ[q + 2] - cellQ[q], cellQ[q + 3] - cellQ[q + 1]), Math.hypot(cellQ[q + 6] - cellQ[q], cellQ[q + 7] - cellQ[q + 1]));
  }
  let o = 0;
  for (let c = 0; c < chunks.length; c++) {
    const ch = chunks[c]; chunkOn[c] = 0; let dsum = 0, ok = ch.ds <= horizon, any = false;
    for (let j = 0; j < ch.m; j++, o++) { if (!ok) continue; const p = projR(V, ch.pts[j * 3], ch.pts[j * 3 + 1], ch.pts[j * 3 + 2]); if (!p.d) { ok = false; continue; } chunkSX[o] = p.sx; chunkSY[o] = p.sy; dsum += p.d; if (onStage(p.sx, p.sy)) any = true; }
    if (ok && any) { chunkOn[c] = 1; chunkD[c] = dsum / ch.m; }
  }
  const phone = V.P.vert && cam.zoom < 0.5, inRoots = slf(cam.year) < R && cam.zoom < 0.5, Yd = decadeOf(clamp(Math.round(cam.year), Y_LO, T1)), big = [];
  const thin = thinOf(), un = unitOf(cam.year), now = performance.now(), step = picT && !landing && !reduced() ? Math.min(0.5, (now - picT) / PIC_EASE_MS) : 1; picT = now; picAnim = false;
  for (let k = 0; k < picN; k++) {
    picOn[k] = 0; const y = picList[k].e.year;
    const target = cam.zoom < 0.5 && y >= un.y0 && y <= un.y1 ? UNIT_MUL : 1, m = picMul[k]; // the unit in hand, eased over 300ms
    if (m !== target) { picMul[k] = m < target ? Math.min(target, m + (UNIT_MUL - 1) * step) : Math.max(target, m - (UNIT_MUL - 1) * step); if (picMul[k] !== target) picAnim = true; }
    if (slf(y) > horizon) continue;
    let rootBase = 0; // a root's pictures: only near the first loop or pulled back; its lineage lit shows them all, otherwise the weightiest
    if (y < T0 && slf(cam.year) < R) { if (cam.zoom > 0.5) rootBase = 10; } // travelling the roots: every picture, sized by its distance from the seat as on the coil
    else if (y < T0) { const e = picList[k].e, li = LIN_OF[e.domain] ?? 7; if (!rootsSeen()) continue; if (rootLit === li) { if ((e.significance || 0) < 4) continue; rootBase = cam.zoom > 0.5 ? 14 : 38; } else if (rootShow.has(e.id)) rootBase = cam.zoom > 0.5 ? 10 : V.P.vert ? 22 : 24; else continue; }
    const zf = clamp((cam.zoom - 0.25) / 0.5, 0, 1); picFa[k] = 1; // pulled back, a picture settles onto the coil's skin and only the weightiest keep their light; the rest dim to the cells' level
    if (zf > 0) { const sig = picList[k].e.significance || 0; picFa[k] = lerp(1, picList[k].moment ? 1 : sig >= 5 ? 0.85 : sig >= 4 ? 0.3 : 0, zf); if (picFa[k] < 0.03) continue; }
    const p = zf > 0 ? projR(V, lerp(picG[k * 3], picGp[k * 3], zf), lerp(picG[k * 3 + 1], picGp[k * 3 + 1], zf), lerp(picG[k * 3 + 2], picGp[k * 3 + 2], zf)) : projR(V, picG[k * 3], picG[k * 3 + 1], picG[k * 3 + 2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
    const dy = Math.abs(slf(y) - slf(cam.year)), near = nearOf(V, p.d), base = rootBase ? rootBase : cam.zoom > 0.5 ? 10 : inRoots ? (dy <= 15 ? V.P.picMax * 0.7 : dy <= 40 ? 22 : 10) : dy <= 15 ? V.P.picMax : dy <= 50 ? (V.P.vert ? 24 : V.P.picMax * 0.42) : dy <= 120 ? 22 + 6 * thin : 12 + 12 * thin;
    picSX[k] = p.sx; picSY[k] = p.sy; picD[k] = p.d; picPX[k] = Math.max(5, base * (0.45 + 0.3 * thin + (0.55 - 0.3 * thin) * near)) * (cam.zoom > 0.5 ? 1 : picMul[k]); picOn[k] = 1;
    { const hh = picPX[k] / (picList[k].a || 1) / 2; if (picMul[k] <= 1.001 && (p.sy + hh > H - picFloor() || p.sy - hh < picCeil())) { picOn[k] = 0; continue; } }
    if (V.P.vert && (p.sx - picPX[k] / 2 < 3 || p.sx + picPX[k] / 2 > W - 3)) { picOn[k] = 0; continue; } // on the phone no picture is cut by the frame's edge: it waits past the edge whole // no picture over the strip or under the top bar; the unit in hand is clamped later
    if (inRoots && !V.P.vert && picPX[k] > 12) { const c = captionRect(V); const hh = picPX[k] / (picList[k].a || 1) / 2; if (c && p.sx + picPX[k] / 2 > c.x0 && p.sx - picPX[k] / 2 < c.x1 && p.sy + hh > c.y0 - 4) { picOn[k] = 0; continue; } } // nor over the roots' caption
    // on a phone only the decade in hand carries pictures over 20px, at most ten of them; everything else is 10px dust
    if (inRoots && picPX[k] > 20) { if (decadeOf(y) === Yd) big.push(k); else picPX[k] = 10; } // on a phone, and down the roots where the lineages bundle close, only the unit in hand carries pictures over 20px
  }
  if (inRoots) {
    big.sort((a, b) => picList[b].e.significance - picList[a].e.significance || a - b);
    for (let j = 14; j < big.length; j++) picPX[big[j]] = 10;
  }
  if (phone) {
    // and no picture covers a decade label of the loop in hand: a big one shrinks to dust, dust steps aside
    const L = labelRects(V);
    for (let k = 0; k < picN; k++) {
      if (!picOn[k]) continue;
      let w = picPX[k], h = w / (picList[k].a || 1);
      if (overLabel(L, picSX[k], picSY[k], w, h)) { picPX[k] = w = 10; h = w / (picList[k].a || 1); if (overLabel(L, picSX[k], picSY[k], w, h)) picOn[k] = 0; }
    }
    if (V.P.vert && cam.year >= GHOST_FROM && cam.zoom <= 0.5) { // and the night between the sky and the ring's near decades stays clear of dust
      coilY(2030, 0, 0.27, lblO2, 0); const q = projR(V, lblO2[0], lblO2[1], lblO2[2]);
      if (q.d) { const qx = q.sx - 34, qy = q.sy + 16; for (let k = 0; k < picN; k++) if (picOn[k] && picPX[k] <= 12 && picSX[k] > qx && picSY[k] < qy) picOn[k] = 0; }
    }
  }
}
// the rectangles the decade labels of the loop in hand occupy (text and tick), in canvas pixels
const lblO1 = new Float32Array(3), lblO2 = new Float32Array(3), grO = new Float32Array(3);
function labelRects(V) {
  const out = [], Yc = Math.floor(slf(cam.year) / 100) * 100; // slots
  for (let y = Math.max(R + 30, Yc + 10); y < Yc + 100 && y <= SPAN; y += 10) {
    if (ahead(yearOfSlot(y)) <= 0) continue;
    coilRel(y, 0, -0.16, lblO1, 0); const p = projR(V, lblO1[0], lblO1[1], lblO1[2]); if (!p.d) continue; const vx = p.sx, vy = p.sy;
    coilRel(y, 0, -0.06, lblO2, 0); const q = projR(V, lblO2[0], lblO2[1], lblO2[2]); if (!q.d) continue;
    if (V.P.vert) { const dx = vx - q.sx, dy = vy - q.sy, l = Math.hypot(dx, dy) || 1, tx = vx + dx / l * 16, ty = vy + dy / l * 12; out.push({ x0: tx - 24, y0: ty - 12, x1: tx + 24, y1: ty + 12 }); continue; } // the phone's plates, where they are drawn
    const dx = p.sx - q.sx, dy = p.sy - q.sy, l = Math.hypot(dx, dy) || 1, tx = p.sx + dx / l * 16, ty = p.sy + dy / l * 12;
    out.push({ x0: Math.min(tx - 20, q.sx) - 6, y0: Math.min(ty - 9, q.sy) - 5, x1: Math.max(tx + 20, q.sx) + 6, y1: Math.max(ty + 9, q.sy) + 5 });
  }
  if (slf(cam.year) < R + 26 + 160 && cam.zoom <= 0.5) { const c = captionRect(V); if (c) out.push(c); } // the roots' caption is an obstacle too
  if (V.P.vert && cam.year >= GHOST_FROM && cam.zoom <= 0.5 && shA <= 0) { // on the phone the ring's decades and the future's name hold their ground too
    for (let y = 2030; y <= 2060; y += 10) {
      coilY(y, 0, 0.27, lblO2, 0); const q = projR(V, lblO2[0], lblO2[1], lblO2[2]); if (!q.d) continue; // where drawGhost sets the decade: at its tick's foot
      const tx = clamp(q.sx, BAND.x0 + 24, BAND.x1 - 24), ty = q.sy;
      out.push({ x0: tx - 26, y0: ty - 13, x1: tx + 26, y1: ty + 14 });
    }
    const h = cam.year >= 1990 && (octx || ctx) ? fcSeat(V, octx || ctx) : null; if (h) out.push({ x0: h.box.x, y0: h.box.y, x1: h.box.x + h.box.w, y1: h.box.y + h.box.h });
  }
  if (V.P.vert && cam.zoom <= 0.5 && G) for (let k = 0; k < G.cents.length; k++) { // and the century numerals on their plates
    const y = G.cents[k]; if (sl(y) > slf(cam.year) + 40) continue; const p = projR(V, G.centG[k * 3], G.centG[k * 3 + 1], G.centG[k * 3 + 2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
    const size = Math.max(MIN_TEXT, Math.round(V.P.cent * (0.35 + 0.65 * nearOf(V, p.d)))), hw = size * 1.25 + 6; out.push({ x0: p.sx - hw, y0: p.sy - size / 2 - 4, x1: p.sx + hw, y1: p.sy + size / 2 + 4 });
  }
  return out;
}
function overLabel(L, cx, cy, w, h) {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  for (const r of L) if (x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0) return true;
  return false;
}
// the ground, kept: night, its slow lift and the grain are painted once for a canvas size and laid down whole each frame
// (the grain fill over a whole canvas was the largest cost of a frame, on phone and desk alike)
function ground(cw, ch) {
  const k = cw + 'x' + ch + 'x' + W + 'x' + H + 'x' + DPR; if (groundCv && groundKey === k) return groundCv;
  const o = groundCv || document.createElement('canvas'); o.width = cw; o.height = ch; const g = o.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = NIGHT; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W * 0.3, H); gr.addColorStop(0, GROUND[0]); gr.addColorStop(0.55, GROUND[1]); gr.addColorStop(1, GROUND[2]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, 0, W, H);
  groundCv = o; groundKey = k; return o;
}
// the grain: a tile of faint light and dark specks laid over the ground before the coil, never on type, cells or pictures
function grain() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas'); t.width = t.height = 128; const g = t.getContext('2d'), id = g.createImageData(128, 128), d = id.data;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < d.length; i += 4) { const v = rnd() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(rnd() * 8); }
  g.putImageData(id, 0, 0); grainTile = t; return t;
}
// stage 5: a moment's halo, a radial in the blend at its year from 26 percent at the cell to nothing at three times its size, added in light
const HALO_RGB = []; for (let si = 0; si <= SPAN; si++) { const h = hex(heat(si / SPAN)); HALO_RGB.push(`${h[0]},${h[1]},${h[2]}`); }
function halo(x, cx, cy, r, year, a) {
  const R = r * 3; if (R < 2) return;
  const rgb = HALO_RGB[clamp(Math.round(sl(year)), 0, SPAN)]; // a root year lands on a fractional slot; the nearest whole one carries the colour
  const g = x.createRadialGradient(cx, cy, Math.max(0.5, r * 0.5), cx, cy, R); g.addColorStop(0, `rgba(${rgb},0.26)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.fill(); x.globalCompositeOperation = 'source-over';
}
// one picture of the coil at its projected place: the halo if it is a moment, then the image; lift 0 to 1 eases the alpha to full
// push the unit's pictures apart on screen until none overlaps, a few passes, each kept on the stage
function separate(ks, V) {
  const n = ks.length; if (n < 1) return;
  const hw = new Float32Array(n), hh = new Float32Array(n);
  for (let j = 0; j < n; j++) { const k = ks[j], w = picPX[k]; hw[j] = w / 2 + 3; hh[j] = w / (G.picList[k].a || 1) / 2 + 3; }
  const L = V ? labelRects(V) : null; let axSX = W / 2, axSY = H / 2; if (L) { coilRel(slf(cam.year), 0, -1, lblO1, 0); const ap = projR(V, lblO1[0], lblO1[1], lblO1[2]); if (ap.d) { axSX = ap.sx; axSY = ap.sy; } } // the decade labels of the loop in hand are fixed obstacles; on the phone the ring's decades and the future's name too
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    if (L) for (let a = 0; a < n; a++) { const ka = ks[a]; for (const r of L) { const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, rw = (r.x1 - r.x0) / 2, rh = (r.y1 - r.y0) / 2, dx = picSX[ka] - cx, dy = picSY[ka] - cy, ox = hw[a] + rw - Math.abs(dx), oy = hh[a] + rh - Math.abs(dy); if (ox <= 0 || oy <= 0) continue; moved = true; const ux = picSX[ka] - axSX, uy = picSY[ka] - axSY, ul = Math.hypot(ux, uy) || 1, st = Math.min(ox, oy) + 2; picSX[ka] += ux / ul * st; picSY[ka] += uy / ul * st; } } // pushed outward from the loop's axis, clear of its labels
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const ka = ks[a], kb = ks[b], dx = picSX[kb] - picSX[ka], dy = picSY[kb] - picSY[ka], ox = hw[a] + hw[b] - Math.abs(dx), oy = hh[a] + hh[b] - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue; moved = true;
      if (ox < oy) { const sx = (dx >= 0 ? 1 : -1) * ox / 2; picSX[ka] -= sx; picSX[kb] += sx; } else { const sy = (dy >= 0 ? 1 : -1) * oy / 2; picSY[ka] -= sy; picSY[kb] += sy; }
    }
    if (V && V.P.vert) for (let j = 0; j < n; j++) { const k = ks[j]; picSX[k] = clamp(picSX[k], hw[j] + 4, W - hw[j] - 4); picSY[k] = clamp(picSY[k], hh[j] + picCeil(), H - hh[j] - picFloor()); } // the phone holds its pictures under the sky as they part, so they spread along the loop instead of piling at the ceiling
    if (!moved) break;
  }
  for (let j = 0; j < n; j++) {
    const k = ks[j]; picSX[k] = clamp(picSX[k], hw[j] + 4, W - hw[j] - 4); picSY[k] = clamp(picSY[k], hh[j] + picCeil(), H - hh[j] - picFloor());
    if (V && V.P.vert) { // on the phone a picture still over a label after the passes steps left or down, whichever is nearer, toward the loop and never up into the sky
      for (let t = 0; t < 2; t++) for (const r of L) { if (picSX[k] + hw[j] <= r.x0 || picSX[k] - hw[j] >= r.x1 || picSY[k] + hh[j] <= r.y0 || picSY[k] - hh[j] >= r.y1) continue; const dl = picSX[k] + hw[j] - r.x0, dd = r.y1 - (picSY[k] - hh[j]); if (dl <= dd) picSX[k] -= dl + 2; else picSY[k] += dd + 2; }
      continue;
    }
    if (fcHead && cam.year >= FC_FROM && picSX[k] + hw[j] > fcHead.x && picSX[k] - hw[j] < fcHead.x + fcHead.w && picSY[k] + hh[j] > fcHead.y && picSY[k] - hh[j] < fcHead.y + fcHead.h) picSY[k] = fcHead.y - hh[j] - 4; // the future's header keeps its ground
  }
}
function paintPic(x, V, k, ah, lift) {
  const it = G.picList[k], w = picPX[k], h = w / (it.a || 1), a = lerp(lerp(0.3 + 0.7 * depthA(V, picD[k]), 1, thinOf() * 0.7), 1, lift) * ah * (picFa ? picFa[k] : 1);
  if (lift > 0 && lift < 1 && cellOn && cellOn[it.i] && !reduced()) { const e = easeOut(lift); picSX[k] = lerp(cellSX[it.i], picSX[k], 0.55 + 0.45 * e); picSY[k] = lerp(cellSY[it.i], picSY[k], 0.55 + 0.45 * e); } // rising from its cell along the stem
  if (it.moment) halo(x, picSX[k], picSY[k], Math.max(w, h) / 2, it.e.year, a);
  if (cellOn && cellOn[it.i] && w >= 16 && !(V && V.P.vert && (cellSX[it.i] < 2 || cellSX[it.i] > W - 2))) stem(x, picSX[k], picSY[k], w, h, cellSX[it.i], cellSY[it.i], a * 0.45); // the picture's stem to its cell
  if (w >= 20) { // a card: the night's shadow beneath, a dark edge, then the light frame, so each picture stands apart from its neighbours
    x.globalAlpha = a; x.shadowColor = 'rgba(4,6,24,0.75)'; x.shadowBlur = lift > 0.5 ? 14 : 8; x.shadowOffsetY = lift > 0.5 ? 5 : 3; x.fillStyle = NIGHT; x.fillRect(picSX[k] - w / 2 - 1.5, picSY[k] - h / 2 - 1.5, w + 3, h + 3); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
  }
  x.globalAlpha = a; drawPic(x, it, picSX[k], picSY[k], w, h);
  if (w >= 20) { x.strokeStyle = INK; x.lineWidth = 1; x.globalAlpha = a * (lift > 0.5 ? 0.85 : 0.55); x.strokeRect(picSX[k] - w / 2 + 0.5, picSY[k] - h / 2 + 0.5, w - 1, h - 1); x.globalAlpha = a; } // the light frame: a card that opens
  picHits.push({ x: picSX[k] - w / 2, y: picSY[k] - h / 2, w, h, e: it.e, i: it.i });
}
// a stem from a picture's edge to its cell, ending in a dot at the cell: the picture belongs to that block
function stem(x, px, py, w, h, cx, cy, a) {
  const dx = cx - px, dy = cy - py; if (Math.abs(dx) < w / 2 && Math.abs(dy) < h / 2) return;
  const t = Math.min(dx ? (w / 2) / Math.abs(dx) : 1e9, dy ? (h / 2) / Math.abs(dy) : 1e9), ex = px + dx * t, ey = py + dy * t;
  x.globalAlpha = a; x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(ex, ey); x.lineTo(cx, cy); x.stroke();
  x.fillStyle = INK; x.beginPath(); x.arc(cx, cy, 2, 0, 6.283); x.fill();
}
function drawPic(x, it, cx, cy, w, h) { const aw = it.atl.naturalWidth, ah2 = it.atl.naturalHeight, pc = it.pc; x.drawImage(it.atl, pc.u * aw, (1 - pc.v - pc.vh) * ah2, pc.uw * aw, pc.vh * ah2, cx - w / 2, cy - h / 2, w, h); }
// a cell's quad as a parallelogram about its centre, scaled, with `inset` pixels of ground taken from each side
let qFillKey = -1, qAlphaKey = -1;
function quad(x, i, scale, inset, colKey, alpha, floor = 0.35) {
  if (colKey !== qFillKey) { qFillKey = colKey; x.fillStyle = colW(colKey); }
  const aq = Math.round(alpha * 40); if (aq !== qAlphaKey) { qAlphaKey = aq; x.globalAlpha = aq / 40; }
  const q = i * 8, cx = cellSX[i], cy = cellSY[i];
  let ux = cellQ[q + 2] - cellQ[q], uy = cellQ[q + 3] - cellQ[q + 1], vx = cellQ[q + 6] - cellQ[q], vy = cellQ[q + 7] - cellQ[q + 1];
  const lu = Math.hypot(ux, uy) * scale, lv = Math.hypot(vx, vy) * scale;
  if (lu < floor || lv < floor) { // too small to shape: a square mark of the floor size, so every record stays a visible point
    const h = floor / 2; x.fillRect(cx - h, cy - h, floor, floor); return;
  }
  const hu = Math.max(0.35, lu - inset) / 2 / (lu / scale || 1), hv = Math.max(0.35, lv - inset) / 2 / (lv / scale || 1);
  ux *= hu; uy *= hu; vx *= hv; vy *= hv;
  x.beginPath(); x.moveTo(cx - ux - vx, cy - uy - vy); x.lineTo(cx + ux - vx, cy + uy - vy); x.lineTo(cx + ux + vx, cy + uy + vy); x.lineTo(cx - ux + vx, cy - uy + vy); x.closePath(); x.fill();
}
// a light rim on a cell of the unit in hand, so the tile reads as something to open
function rim(x, i, scale, alpha) {
  const q = i * 8, cx = cellSX[i], cy = cellSY[i];
  let ux = (cellQ[q + 2] - cellQ[q]) * scale / 2, uy = (cellQ[q + 3] - cellQ[q + 1]) * scale / 2, vx = (cellQ[q + 6] - cellQ[q]) * scale / 2, vy = (cellQ[q + 7] - cellQ[q + 1]) * scale / 2;
  x.globalAlpha = Math.min(1, alpha) * 0.42; qAlphaKey = -1; x.strokeStyle = INK; x.lineWidth = 0.9;
  x.beginPath(); x.moveTo(cx - ux - vx, cy - uy - vy); x.lineTo(cx + ux - vx, cy + uy - vy); x.lineTo(cx + ux + vx, cy + uy + vy); x.lineTo(cx - ux + vx, cy - uy + vy); x.closePath(); x.stroke();
}
// ---------- the roots: the record before 1026 as eight lineages running into the coil's first loop ----------
const ROOT_LANE = LIN.map((_, i) => LANE_LIN.indexOf(i) - 6); // a lane that belongs to each lineage, for rootRel
const ROOT_AGES = [[-999999, '1,000,000 BCE'], [-299999, '300,000 BCE'], [-99999, '100,000 BCE'], [-29999, '30,000 BCE'], [-9999, '10,000 BCE'], [-2999, '3,000 BCE'], [-999, '1,000 BCE'], [-299, '300 BCE'], [1, '1 CE'], [500, '500 CE']];
const rootO = new Float32Array(3), rootO2 = new Float32Array(3);
let rootLit = -1; // the lineage under the pointer
const rootShow = new Set(); // the pictures an unlit root carries: its eight weightiest, spread along it, chosen once the record is laid out
// the phone before 1900: the record thins, so the loops behind and the roots under them keep their light and their pictures down to the foot (0 from 1900 on, 1 by 1500)
const thinOf = () => (H > W && cam.zoom < 0.5 ? clamp((1900 - cam.year) / 400, 0, 1) : 0);
const rootsSeen = () => rootsNear() || thinOf() >= 0.5;
const rootsNear = () => cam.zoom > 0.5 || slf(cam.year) < R + 26 + 160; // from the first loop and a half, or pulled back, the roots read in full
function drawRoots(x, V, pulled) {
  const N = 96, nearRoot = rootsNear(), glow = rootGlow(), thin = thinOf(), headY = V.P.vert && !pulled ? skyTop() - 6 : 0;
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 0; i < LIN.length; i++) {
    const lane = ROOT_LANE[i], lf = i === rootLit ? 1 : glow, lit = lf > 0; let px = 0, py = 0, pd = 0, ok = false;
    for (let k = 0; k <= N; k++) {
      const t = k / N; coilRel(t * R, lane, -0.02, rootO, 0); const p = projR(V, rootO[0], rootO[1], rootO[2]);
      if (!p.d) { ok = false; continue; }
      if (ok) {
        const f = smooth((t - 0.08) / 0.92), near = nearOf(V, (p.d + pd) / 2);
        x.beginPath(); x.moveTo(px, py); x.lineTo(p.sx, p.sy);
        x.strokeStyle = lit ? mix(colAt(t * R), INK, 0.35 * lf) : pulled || thin >= 0.5 ? colAt(t * R) : near > 0.2 ? sunk(colAt(t * R), 0.2) : sunk(colAt(t * R), 0.4);
        const a0 = (0.34 + 0.4 * (1 - f)) * (pulled ? 1 : lerp(0.55 + 0.45 * near, 1, thin));
        x.lineWidth = lerp(1.1, 2.2, lf) + 1.4 * (1 - f); x.globalAlpha = lerp(a0, 0.95, lf) * (headY ? clamp(((py + p.sy) / 2 - headY) / 30, 0, 1) : 1); x.stroke(); // on the phone a root fades out under the header
      }
      px = p.sx; py = p.sy; pd = p.d; ok = true;
    }
  }
  x.globalAlpha = 1;
  if (!nearRoot) return;
  // the ages along the trunk: a tick and its year beneath, set where there is room
  x.textBaseline = 'middle'; if (headY) { x.save(); x.beginPath(); x.rect(0, headY + 6, W, H); x.clip(); } drawRootAges(x, V); if (headY) x.restore(); // the phone's dotted rings stop at its header
  x.globalAlpha = 1; x.textBaseline = 'alphabetic';
}
// the lineages named where they reach the loop, in the record's serif, set off the line, over the cells and pictures
// what the roots' words must clear: every drawn picture, every root line (sampled), the strip, the bar, the caption
let ageRects = [];
const CAP_Y = () => H - picFloor() - 16; // the caption's baseline, just over the strip
function captionRect(V) { if (V.P.vert) return null; return { x0: 16, x1: Math.min(W * 0.62, 760), y0: CAP_Y() - 44, y1: CAP_Y() + 6 }; }
function rootObstacles(V) {
  const obst = [];
  for (let k = 0; k < picN; k++) if (picOn[k] && picPX[k] >= 8) { const w = picPX[k], h = w / (G.picList[k].a || 1); obst.push({ pic: 1, x0: picSX[k] - w / 2 - 3, y0: picSY[k] - h / 2 - 3, x1: picSX[k] + w / 2 + 3, y1: picSY[k] + h / 2 + 3 }); }
  for (let i = 0; i < LIN.length; i++) for (let t = 0.3; t <= 1; t += 0.035) { coilRel(t * R, ROOT_LANE[i], 0.04, rootO, 0); const p = projR(V, rootO[0], rootO[1], rootO[2]); if (p.d) obst.push({ x0: p.sx - 5, y0: p.sy - 5, x1: p.sx + 5, y1: p.sy + 5 }); }
  obst.push({ pic: 1, bar: 1, x0: 0, y0: H - picFloor(), x1: W, y1: H }, { pic: 1, bar: 1, x0: 0, y0: 0, x1: W, y1: picCeil() }); const c = captionRect(V); if (c) obst.push(Object.assign({ pic: 1, bar: 1 }, c)); if (!V.P.vert && cam.zoom < 0.5) obst.push({ pic: 1, bar: 1, x0: W * 0.64, y0: 0, x1: W, y1: H }); else if (V.P.vert) { obst.push({ pic: 1, bar: 1, x0: 0, y0: H * 0.58, x1: W, y1: H }); if (readPlate) obst.push({ pic: 1, bar: 1, x0: readPlate.x - 6, y0: readPlate.y - 6, x1: readPlate.x + readPlate.w + 6, y1: readPlate.y + readPlate.h + 6 }); } // the field's column, or the phone's card and its reading plate
  return obst;
}
function drawRootNames(x, V, pulled) {
  if (!rootsNear() || pulled) return;
  x.textBaseline = 'middle'; x.shadowColor = 'rgba(6,8,26,0.9)'; x.shadowBlur = 10;
  // a name takes the first clear seat along its root (four stations, either side, three distances), else stands at the loop on a leader
  const obst = rootObstacles(V).concat(ageRects), pics = obst.filter((o) => o.pic), bars = obst.filter((o) => o.bar), over = (list, r) => list.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0), hitPics = (r) => over(pics, r), hitBars = (r) => over(bars, r);
  const hit = (r) => obst.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
  const placed = [];
  for (let i = 0; i < LIN.length; i++) {
    const size = Math.max(MIN_TEXT, Math.round(V.P.cent * 0.5)); x.font = `400 ${size}px ${FONT_DISPLAY}`; const w = x.measureText(LIN[i][0]).width;
    let seat = null;
    for (const t of [0.78, 0.66, 0.88, 0.56]) {
      coilRel(t * R, ROOT_LANE[i], 0.04, rootO, 0); const q = projR(V, rootO[0], rootO[1], rootO[2]); if (!q.d || !onStage(q.sx, q.sy)) continue;
      coilRel(t * R, ROOT_LANE[i], 0.5, rootO2, 0); const p = projR(V, rootO2[0], rootO2[1], rootO2[2]); if (!p.d) continue;
      let dx = p.sx - q.sx, dy = p.sy - q.sy, l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; // outward from the trunk, on screen
      for (const side of [1, -1]) for (const dist of [14, 26, 40]) {
        const tx = q.sx + dx * side * dist, ty = q.sy + dy * side * dist, align = Math.abs(dx * side) < 0.3 ? 'center' : dx * side > 0 ? 'left' : 'right';
        const x0 = align === 'left' ? tx : align === 'right' ? tx - w : tx - w / 2, rect = { x0: x0 - 4, x1: x0 + w + 4, y0: ty - size * 0.62, y1: ty + size * 0.62 };
        if (rect.x0 < 4 || rect.x1 > W - 4 || hit(rect) || placed.some((r) => rect.x0 < r.x1 + 6 && rect.x1 > r.x0 - 6 && rect.y0 < r.y1 + 2 && rect.y1 > r.y0 - 2)) continue;
        seat = { tx, ty, align, rect, d: q.d }; break;
      }
      if (seat) break;
    }
    for (let pass = 0; pass < (V.P.vert ? 0 : 3) && !seat; pass++) { // no clear seat near the loop: search the root's middle, either side, three distances, on a short leader; a second pass minds only the pictures, a third only the bars
      for (const t of [0.5, 0.42, 0.6, 0.34]) {
        coilRel(t * R, ROOT_LANE[i], 0.04, rootO, 0); const q = projR(V, rootO[0], rootO[1], rootO[2]); if (!q.d || !onStage(q.sx, q.sy)) continue;
        coilRel(t * R, ROOT_LANE[i], 0.5, rootO2, 0); const p = projR(V, rootO2[0], rootO2[1], rootO2[2]); if (!p.d) continue;
        let dx = p.sx - q.sx, dy = p.sy - q.sy, l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        for (const side of [1, -1]) for (const dist of [22, 36, 50]) {
          const tx = q.sx + dx * side * dist, ty = q.sy + dy * side * dist, align = Math.abs(dx * side) < 0.3 ? 'center' : dx * side > 0 ? 'left' : 'right';
          const x0 = align === 'left' ? tx : align === 'right' ? tx - w : tx - w / 2, rect = { x0: x0 - 4, x1: x0 + w + 4, y0: ty - size * 0.62, y1: ty + size * 0.62 };
          if (rect.x0 < 4 || rect.x1 > W - 4 || (pass === 2 ? hitBars(rect) : pass ? hitPics(rect) : hit(rect)) || placed.some((r) => rect.x0 < r.x1 + 6 && rect.x1 > r.x0 - 6 && rect.y0 < r.y1 + 2 && rect.y1 > r.y0 - 2)) continue;
          seat = { tx, ty, align, rect, d: q.d, lead: [q.sx + dx * side * 8, q.sy + dy * side * 8, q.sx + dx * side * (dist - 10), q.sy + dy * side * (dist - 10)] }; break;
        }
        if (seat) break;
      }
    }
    if (!seat) continue;
    placed.push(seat.rect);
    if (seat.lead) { x.shadowBlur = 0; x.strokeStyle = SOFT; x.lineWidth = 1; x.globalAlpha = 0.6 * depthA(V, seat.d); x.beginPath(); x.moveTo(seat.lead[0], seat.lead[1]); x.lineTo(seat.lead[2], seat.lead[3]); x.stroke(); x.shadowBlur = 10; }
    x.textAlign = seat.align; x.globalAlpha = (i === rootLit ? 1 : 0.85) * depthA(V, seat.d); x.fillStyle = i === rootLit ? INK : typeOf(yearOfSlot(Math.round(0.9 * R)));
    x.fillText(LIN[i][0], seat.tx, seat.ty);
  }
  x.shadowColor = 'transparent'; x.shadowBlur = 0; x.globalAlpha = 1; x.textBaseline = 'alphabetic';
}
// the ages as rings: at each power of ten before the coil a dotted ring circles the trunk at that age, crossing all eight
// roots, so the fan carries its own time scale (each ring ten times nearer 1026); one label rides each ring's crown
function drawRootAges(x, V) {
  x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = SOFT; x.strokeStyle = SOFT; x.lineWidth = 1.2; x.setLineDash([2, 6]);
  const placed = [], obst = rootObstacles(V), hit = (r) => obst.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
  for (const [y, lab] of ROOT_AGES) {
    const t = slf(y) / R, f = Math.pow(smooth((t - 0.08) / 0.92), 1.15), r = 0.035 + (1 - 0.035) * f, X = ROOT_X - ROOT_LEN * (1 - t);
    if (r > 0.8) continue; // the last ring would sit on the 1026 loop
    let crown = null, first = true, dSum = 0, nD = 0, xs0 = 1e9, xs1 = -1e9; x.beginPath();
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2; const p = projR(V, X, Math.cos(a) * r, Math.sin(a) * r); if (!p.d) { first = true; continue; }
      if (first) x.moveTo(p.sx, p.sy); else x.lineTo(p.sx, p.sy); first = false; dSum += p.d; nD++; xs0 = Math.min(xs0, p.sx); xs1 = Math.max(xs1, p.sx);
      if (!crown || p.sy < crown.sy) crown = { sx: p.sx, sy: p.sy, d: p.d };
    }
    if (!crown || !nD || xs1 - xs0 < 24 || !onStage(crown.sx, crown.sy)) continue;
    const dA = 0.55 + 0.45 * nearOf(V, dSum / nD); x.globalAlpha = 0.6 * dA; x.stroke();
    const w = x.measureText(lab).width; let seat = null;
    for (const [cx, cy] of [[crown.sx, crown.sy - 10], [crown.sx, crown.sy + 20], [crown.sx - w / 2 - 12, crown.sy + 6], [crown.sx + w / 2 + 12, crown.sy + 6]]) { // the crown first, then under it, then either side
      const lx = clamp(cx, 6 + w / 2, W - 6 - w / 2), rect = { x0: lx - w / 2 - 6, x1: lx + w / 2 + 6, y0: cy - MIN_TEXT, y1: cy + 4 };
      if (cy - MIN_TEXT < picCeil() + 4 || cy > H - picFloor() || hit(rect) || placed.some((q) => rect.x0 < q.x1 && rect.x1 > q.x0 && rect.y0 < q.y1 && rect.y1 > q.y0)) continue;
      seat = { lx, ly: cy, rect }; break;
    }
    if (!seat || V.P.vert) continue; // the phone seats each ring's age inside its band (drawRootStagePhone)
    placed.push(seat.rect); x.setLineDash([]); x.globalAlpha = 0.92 * dA; x.fillText(lab, seat.lx, seat.ly); x.setLineDash([2, 6]);
  }
  ageRects = placed; x.setLineDash([]); x.globalAlpha = 1;
}
// the caption that names the fan, set under the bar on the stage's left, only while the roots are in view
function drawRootCaption(x, V, pulled) {
  if (!rootsNear() || pulled || V.P.vert) return;
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  const y = CAP_Y();
  x.font = `400 ${Math.round(MIN_TEXT * 1.25)}px ${FONT_DISPLAY}`; x.fillStyle = INK; x.globalAlpha = 0.9; x.fillText('Before 1026', 24, y - 22);
  x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = SOFT; x.globalAlpha = 0.85;
  x.fillText('Eight lineages from 3.3 million BCE run into the coil at 1026. Each dotted ring is ten times nearer.', 24, y);
  x.globalAlpha = 1;
}
function paintScene(x, V) {
  const { n, order, yearStart, chunks, picList, picYearStart, cents, centG, cellYear } = G, Y = cam.year, Yd = decadeOf(clamp(Math.round(Y), Y_LO, T1)), pulled = cam.zoom > 0.5;
  const thin = thinOf(), un = unitOf(Y), nowW = performance.now(); if (un.key !== waveKey) { waveKey = un.key; waveT0 = nowW; }
  const wave = reduced() || pulled ? 1 : clamp((nowW - waveT0) / WAVE_MS, 0, 1), waveSpan = un.y1 - un.y0 + 1; if (wave < 1) schedule();
  // the ground: night, one quiet lift under the loop in hand, grain
  x.setTransform(DPR, 0, 0, DPR, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.lineCap = 'round'; x.lineJoin = 'round';
  const lc = projR(V, V.tx - V.xs, 0, 0), hx = lc.d ? lc.sx : W * V.P.ox, hy = lc.d ? lc.sy : stageY(V.P), side = Math.max(W, H);
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(ground(x.canvas.width, x.canvas.height), 0, 0); x.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawRoots(x, V, pulled); // the roots lie behind everything: eight lines from the trunk into the 1026 loop, their names and the ages along them
  // one pass in year order: the decade's thread, then its cells year by year, then their pictures. Stage 4b's leaps and 4c's ghost thread join this pass.
  qFillKey = -1; qAlphaKey = -1;
  let ci = 0, o = 0; const late = [], lateAh = [], rootPics = [];
  const Yds = sl(Yd);
  for (let dec = 0; dec <= SPAN; dec += 10) { // dec is a slot: ten slots are a decade from 1000, a century back to 10,000 BCE, ten millennia before
    // the thread of this unit
    while (ci < chunks.length && chunks[ci].ds <= dec) {
      const ch = chunks[ci], o0 = o; o += ch.m;
      if (chunkOn[ci]) {
        const near = nearOf(V, chunkD[ci]), ah = ahead(ch.ymid), own = !pulled && near > 0.66;
        if (ah > 0) {
          const path = (dx) => { x.beginPath(); x.moveTo(chunkSX[o0] + dx, chunkSY[o0]); for (let j = 1; j < ch.m; j++) x.lineTo(chunkSX[o0 + j] + dx, chunkSY[o0 + j]); };
          if (own) { // the fringe, quiet: blue a pixel left, red-orange right, a thin white core over them
            x.lineWidth = 1; x.globalAlpha = 0.45 * ah; qAlphaKey = -1;
            path(-1.1); x.strokeStyle = FRINGE_BLUE; x.stroke(); path(1.1); x.strokeStyle = FRINGE_RED; x.stroke();
            path(0); x.strokeStyle = CORE; x.globalAlpha = 0.6 * ah; x.lineWidth = 0.9; x.stroke();
          } else {
            path(0); x.strokeStyle = pulled ? ch.col : near > 0.2 ? ch.col1 : ch.col2; x.globalAlpha = (pulled ? 0.4 : 0.16 + 0.5 * near) * ah; qAlphaKey = -1; x.lineWidth = pulled ? 0.8 : 0.7 + 0.6 * near; x.stroke(); // the loop in hand carries the thread; far loops stay faint
          }
        }
      }
      ci++;
    }
    if (dec === R && rootPics.length) { separate(rootPics, V); const cR = slf(cam.year) < R && !V.P.vert && !pulled ? captionRect(V) : null; for (const k of rootPics) { if (cR) { const w = picPX[k], h = w / (picList[k].a || 1); if (picSX[k] + w / 2 > cR.x0 && picSX[k] - w / 2 < cR.x1 && picSY[k] + h / 2 > cR.y0 && picSY[k] - h / 2 < cR.y1) { picOn[k] = 0; continue; } } paintPic(x, V, k, 1, 0); qAlphaKey = -1; qFillKey = -1; } } // the roots are drawn: their pictures before the coil's first loop
    for (let yi = dec; yi < dec + 10 && yi <= SPAN; yi++) {
      const y = yearOfSlot(yi), ah = ahead(y); if (ah <= 0) continue;
      const inHand = !pulled && yi >= Yds && yi < Yds + 10, focus = pulled ? 0.92 : inHand ? 1 : 0.8, ahead6 = yi > slf(Y) + 2 ? ah * 0.6 : 1, scale = inHand ? (V.P.vert ? 1.42 : 1.22) : 1;
      for (let p = yearStart[yi]; p < yearStart[yi + 1]; p++) {
        const i = order[p]; if (!cellOn[i]) continue;
        // the step by depth: full on the loop in hand (and everywhere when pulled back), sunk a loop back, sunk further beyond
        const near = nearOf(V, cellD[i]), sIdx = pulled ? 0 : near > 0.45 * (1 - thin) ? 0 : near > 0.15 * (1 - thin) ? 1 : 2, mo = G.cellMoment[i] === 1; let ca = Math.min(1, (0.8 + 0.2 * depthA(V, cellD[i])) * focus) * ahead6;
        if (inHand && wave < 1 && y >= un.y0 && y <= un.y1) { const u = waveSpan > 1 ? (y - un.y0 + 0.5) / waveSpan : (p - yearStart[yi] + 0.5) / Math.max(1, yearStart[yi + 1] - yearStart[yi]), d = Math.abs(u - wave * 1.3 + 0.15); if (d < 0.22) ca = Math.min(1, ca * (0.6 + 0.4 * d / 0.22) + 0.55 * (1 - d / 0.22)); else if (u > wave * 1.3 - 0.15) ca *= 0.6; } // the wave: cells ahead of it wait dim, it lights them as it passes
        if (mo) { // a moment: the halo beneath in its year's blend, the full step on top
          const q = i * 8, ux = cellQ[q + 2] - cellQ[q], uy = cellQ[q + 3] - cellQ[q + 1], vx = cellQ[q + 6] - cellQ[q], vy = cellQ[q + 7] - cellQ[q + 1];
          halo(x, cellSX[i], cellSY[i], Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy)) * scale / 2, cellYear[i], ca); qFillKey = -1; qAlphaKey = -1;
        }
        const wi = G.cellW[i], ws = scale * W_SIZE[wi];
        quad(x, i, ws, 1, ((cellYear[i] * 3 + (TONE[G.cellLane[i]] ?? 0)) * 3 + (mo ? 0 : sIdx)) * 5 + wi, ca, (pulled ? FLOOR_PULLED : inHand ? 0.35 : FLOOR_FAR) * W_SIZE[wi]);
        if (inHand && cellPX[i] >= 9) rim(x, i, ws, ca); // the unit in hand: each cell a tile with a light rim, so it reads as something to open
      }
      for (let k = picYearStart[yi]; k < picYearStart[yi + 1]; k++) {
        if (!picOn[k]) continue;
        if (yi < R) { rootPics.push(k); continue; } // the roots' pictures paint together, pushed apart, before the coil
        if (picMul[k] > 1.001) { late.push(k); lateAh.push(ah); continue; } // the unit in hand paints last
        paintPic(x, V, k, ah, 0); qAlphaKey = -1; qFillKey = -1;
      }
    }
  }
  drawRootNames(x, V, pulled); drawRootCaption(x, V, pulled);
  separate(late, V); // the unit in hand: no picture sits on another, nor on a decade label
  const capR = slf(cam.year) < R && !V.P.vert && !pulled ? captionRect(V) : null;
  { const od = late.map((k, j) => j).sort((a, b) => (wOf(picList[late[a]].e) - wOf(picList[late[b]].e)) || (a - b)), l2 = od.map((j) => late[j]), a2 = od.map((j) => lateAh[j]); for (let j = 0; j < od.length; j++) { late[j] = l2[j]; lateAh[j] = a2[j]; } } // the unit's pictures paint in weight order, so the heaviest card sits on top
  for (let j = 0; j < late.length; j++) { const k = late[j]; if (capR) { const w = picPX[k], h = w / (picList[k].a || 1); if (picSX[k] + w / 2 > capR.x0 && picSX[k] - w / 2 < capR.x1 && picSY[k] + h / 2 > capR.y0 && picSY[k] - h / 2 < capR.y1) { picOn[k] = 0; continue; } } paintPic(x, V, k, lateAh[j], (picMul[k] - 1) / (UNIT_MUL - 1)); } // none over the roots' caption
  // the century numerals on the open floor inside each loop, and the decade labels of the loop in hand
  x.textAlign = 'center'; x.textBaseline = 'middle'; const centR = []; decPl.length = 0; // where the phone's century numerals stand, so no decade lands on one in a narrow frame
  const fb = V.P.vert && !pulled && Y >= 1990 && shA <= 0 ? fcSeat(V, x) : null, underFc = (x0, y0, x1, y1) => !!fb && x0 < fb.box.x + fb.box.w + 3 && x1 > fb.box.x - 3 && y0 < fb.box.y + fb.box.h + 2 && y1 > fb.box.y - 2; // the future's name keeps its ground: no century or decade of the coil stands under it
  for (let k = 0; k < cents.length; k++) {
    const y = cents[k]; if (sl(y) > slf(cam.year) + 40 && !pulled) continue; if (V.P.vert && pulled) break; // the phone pulled back sets its centuries as a ladder in the band (drawCentLadder)
    const p = projR(V, centG[k * 3], centG[k * 3 + 1], centG[k * 3 + 2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
    const near = nearOf(V, p.d), size = Math.max(MIN_TEXT, Math.round(V.P.cent * (0.35 + 0.65 * near)));
    x.globalAlpha = (0.55 + 0.45 * depthA(V, p.d)) * ahead(y); x.fillStyle = typeOf(yearOfSlotF(sl(y) + 50)); x.font = `400 ${size}px ${FONT_DISPLAY}`;
    if (V.P.vert && !pulled) { const tw = x.measureText(fmtTick(y)).width; if (p.sx - tw / 2 < 8 || p.sx + tw / 2 > W - 8 || underRead(p.sx - tw / 2 - 5, p.sy - size / 2 - 3, p.sx + tw / 2 + 5, p.sy + size / 2 + 3) || underFc(p.sx - tw / 2 - 5, p.sy - size / 2 - 3, p.sx + tw / 2 + 5, p.sy + size / 2 + 3)) continue; plate(x, p.sx - tw / 2 - 5, p.sy - size / 2 - 3, tw + 10, size + 6, ahead(y)); x.globalAlpha = ahead(y); centR.push([p.sx - tw / 2 - 7, p.sy - size / 2 - 5, p.sx + tw / 2 + 7, p.sy + size / 2 + 5]); } // a plate under each, and none cut by the frame's edge
    x.fillText(fmtTick(y), p.sx, p.sy); // each century numeral in the blend at its middle, never under 55 percent
  }
  if (!pulled) {
    const Yc = Math.floor(slf(Y) / 100) * 100, o1 = new Float32Array(3), o2 = new Float32Array(3); // slots
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.strokeStyle = SOFT; x.lineWidth = 1;
    for (let y = Math.max(R + 30, Yc + 10); y < Yc + 100 && y <= SPAN; y += 10) {
      coilRel(y, 0, -0.16, o1, 0); const p = projR(V, o1[0], o1[1], o1[2]); if (!p.d) continue; const px = p.sx, py = p.sy, near = nearOf(V, p.d);
      coilRel(y, 0, -0.06, o2, 0); const q = projR(V, o2[0], o2[1], o2[2]); if (!q.d) continue;
      const ah = ahead(yearOfSlot(y)); if (ah <= 0) continue;
      x.globalAlpha = 0.85 * (0.5 + 0.5 * near) * ah; x.beginPath(); x.moveTo(q.sx, q.sy); x.lineTo(px, py); x.stroke();
      const dx = px - q.sx, dy = py - q.sy, l = Math.hypot(dx, dy) || 1; x.fillStyle = INK;
      if (V.P.vert) { const t = fmtTick(yearOfSlot(y)), tw = x.measureText(t).width; let tx = px + dx / l * 16, ty = py + dy / l * 12; const af = clamp((ah - 0.3) / 0.25, 0, 1); if (af <= 0) continue;
        const hitC = () => centR.some((c) => tx - tw / 2 - 5 < c[2] && tx + tw / 2 + 5 > c[0] && ty - MIN_TEXT / 2 - 4 < c[3] && ty + MIN_TEXT / 2 + 3 > c[1]); const hitD = () => decPl.some((c) => tx - tw / 2 - 5 < c[2] - 4 && tx + tw / 2 + 5 > c[0] + 4 && ty - MIN_TEXT / 2 - 4 < c[3] - 4 && ty + MIN_TEXT / 2 + 2 > c[1] + 4); let step = 0; while ((hitC() || hitD()) && step < 3) { step++; tx += dx / l * 14; ty += dy / l * 14; } if (hitC() || hitD() || (step && (tx - tw / 2 < 8 || tx + tw / 2 > W - 8)) || underRead(tx - tw / 2 - 5, ty - MIN_TEXT / 2 - 4, tx + tw / 2 + 5, ty + MIN_TEXT / 2 + 2) || underFc(tx - tw / 2 - 5, ty - MIN_TEXT / 2 - 4, tx + tw / 2 + 5, ty + MIN_TEXT / 2 + 2)) continue; // a decade steps out along its tick past a century numeral or a decade already set, else rests
        plate(x, tx - tw / 2 - 5, ty - MIN_TEXT / 2 - 4, tw + 10, MIN_TEXT + 6, af); x.globalAlpha = 0.95 * af; x.fillText(t, tx, ty); decPl.push([tx - tw / 2 - 5, ty - MIN_TEXT / 2 - 4, tx + tw / 2 + 5, ty + MIN_TEXT / 2 + 2]); continue; } // a decade ahead stands at full strength or not at all
      x.fillText(fmtTick(yearOfSlot(y)), px + dx / l * 16, py + dy / l * 12);
    }
    drawGhost(x, V, Y, o1, o2);
  }
  x.globalAlpha = 1;
}
// stage 4c: from 2026 the thread continues to 2076 as a dashed ghost in soft at 28 percent, with decade labels 2030 to 2070
const fcO = new Float32Array(3);
// a night plate under a word or a year on the phone, so type keeps its own ground where the coil runs beneath
function plate(x, x0, y0, w, h, a) { const ga = x.globalAlpha, fs = x.fillStyle; x.globalAlpha = a; x.fillStyle = PLATE; x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, 4); else x.rect(x0, y0, w, h); x.fill(); x.globalAlpha = ga; x.fillStyle = fs; }
function fcSeat(V, x) { // where the future's name stands: beside the thread on the desk; on the phone flush right over the ring's near decades, a short thread down to the ring
  const size = MIN_TEXT + (V.P.vert ? 3 : 5), f0 = x.font; x.font = `500 ${size}px ${FONT_TEXT}`; const w1 = x.measureText(FC_T1).width; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; const w2 = x.measureText(fcT2()).width; x.font = f0;
  const half = Math.max(w1, w2) / 2;
  if (V.P.vert) {
    coilY(FC_AT, 0, -0.02, fcO, 0); const m = projR(V, fcO[0], fcO[1], fcO[2]); if (!m.d) return null; const mx = m.sx, my = m.sy; let ty = my;
    for (const y of [2030, 2040]) { coilY(y, 0, 0.27, fcO, 0); const q = projR(V, fcO[0], fcO[1], fcO[2]); if (q.d) ty = Math.min(ty, q.sy - 14); }
    const h = (w2 ? TAG_H * 2 : TAG_H + 6) + 2, w = half * 2 + 14, bx = BAND.x1 - w, by = clamp(ty - 8 - h, skyTop() + 2, BAND.y1 - h - (cam.year < FC_FROM ? READ.pad * 2 + READ.date + READ.name + READ.line * 3 + 8 : 0)); if (!onStage(mx, my)) return null; // before the 2020s the name stands clear above the reading plate's seat
    return { sx: BAND.x1 - 7, sy: by + TAG_H / 2 + 1, size, w1, w2, half, mx, my, box: { x: bx, y: by, w, h } };
  }
  coilY(2036, 0, 0.5, fcO, 0); const p = projR(V, fcO[0], fcO[1], fcO[2]); if (!p.d) return null; const sy = p.sy; if (!onStage(p.sx, sy)) return null;
  const sx = clamp(p.sx, half + 10, W - half - 10);
  return { sx, sy, size, w1, w2, half, box: { x: sx - half - 8, y: sy - size - 4, w: half * 2 + 16, h: size + MIN_TEXT + 18 } };
}
const FC_AT = 2037; // where the phone's thread meets the ring
// the record's size in one unit, from the archive's one total (data.js census: records without the five period overlays), counted again when a wave of data lands
let recN = 0, recKey = ''; const recCount = () => { const k = `${db.events.length}:${db.loaded.size}`; if (k !== recKey) { recKey = k; recN = census().events; } return recN ? `${recN.toLocaleString('en-US')} records` : ''; };
const FC_T1 = 'Forecasts to 2076', fcT2 = () => { const c = forecastCount(); return c.n ? `${c.n.toLocaleString('en-US')} dated, ${c.voices} voices` : ''; }; // counted from the data at draw time, the count the forecasts sheet prints (data.js forecastCount)
function drawGhost(x, V, Y, o1, o2) {
  if (Y < GHOST_FROM) { fcHead = null; return; } // past the ghost's reach the future's name is off the stage: its box holds no ground (a leap from the present by the strip or a link never passes the years that cleared it)
  // dashed white, fading toward 2076: the blend ends in white and the future runs on in it
  x.lineWidth = 1.8; x.strokeStyle = CORE; let prev = false, px = 0, py = 0;
  for (let y = T1, i = 0; y <= T2; y += 0.5, i++) {
    coilY(y, 0, -0.02, o1, 0); const p = projR(V, o1[0], o1[1], o1[2]);
    if (!p.d || !onStage(p.sx, p.sy)) { prev = false; continue; }
    if (prev && i % 3 !== 0) { x.globalAlpha = GHOST_A + 0.4 * (1 - (y - T1) / (T2 - T1)); x.beginPath(); x.moveTo(px, py); x.lineTo(p.sx, p.sy); x.stroke(); } // a dash of two steps, a gap of one
    px = p.sx; py = p.sy; prev = true;
  }
  if (V.P.vert && shA > 0) { fcHead = null; return; } // under the phone's open sheet the ring stays and its words rest: the window belongs to the open record's mark
  x.strokeStyle = SOFT; x.lineWidth = 1; x.globalAlpha = GHOST_A;
  let fcBox = null; const fs = V.P.vert ? MIN_TEXT : MIN_TEXT + 4; x.font = `400 ${fs}px ${FONT_TEXT}`; x.fillStyle = INK; // on the phone the ring's years stand at a name tag's size
  for (let y = 2030; y <= (V.P.vert ? 2060 : 2070); y += 10) { // the phone names the ring's near side; its far side carries marks alone
    coilY(y, 0, 0.34, o1, 0); const p = projR(V, o1[0], o1[1], o1[2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
    coilY(y, 0, 0.27, o2, 0); const q = projR(V, o2[0], o2[1], o2[2]); if (!q.d) continue;
    const near = nearOf(V, p.d); x.globalAlpha = 0.8 * (0.5 + 0.5 * near);
    x.beginPath(); x.moveTo(q.sx, q.sy); x.lineTo(p.sx, p.sy); x.stroke();
    const dx = p.sx - q.sx, dy = p.sy - q.sy, l = Math.hypot(dx, dy) || 1;
    if (V.P.vert) { let tx = clamp(p.sx, BAND.x0 + 24, BAND.x1 - 24), ty = p.sy; const tw = x.measureText(String(y)).width, hb = Y >= 1990 ? (fcBox || (fcBox = fcSeat(V, x))) : null, under = () => hb && tx + tw / 2 > hb.box.x - 3 && tx - tw / 2 < hb.box.x + hb.box.w + 3 && ty + fs / 2 + 2 > hb.box.y - 2 && ty - fs / 2 - 1 < hb.box.y + hb.box.h + 2;
      if (under()) { coilY(y, 0, 0.14, o1, 0); const r = projR(V, o1[0], o1[1], o1[2]); if (!r.d) continue; tx = clamp(r.sx, BAND.x0 + 24, BAND.x1 - 24); ty = r.sy; if (under()) continue; }
      if (underRead(tx - tw / 2, ty - fs / 2 - 1, tx + tw / 2, ty + fs / 2 + 2)) continue; // in a narrow frame a ring year under the future's name steps inside the ring
      plate(x, tx - tw / 2, ty - fs / 2 - 1, tw, fs + 3, 0.6); x.globalAlpha = 0.95; x.fillText(String(y), tx, ty + 1); decPl.push([tx - tw / 2, ty - fs / 2 - 1, tx + tw / 2, ty + fs / 2 + 2]); continue; } // every year on the phone's coil stands on a plate; the ring's are no wider than their numerals and lighter than the ring
    x.fillText(String(y), p.sx + dx / l * 18, p.sy + dy / l * 13);
  }
  // the future's name, once, beside the thread: text face, a rule beneath, and a box that opens all the forecasts
  fcHead = null;
  if (Y >= 1990) {
    const h = fcSeat(V, x);
    if (h) {
      const { sx, sy, size, w1 } = h;
      if (V.P.vert) { // on its plate, flush right; a thread from the plate's foot to the ring, a dot where it lands
        const b = h.box, lx = clamp(h.mx, b.x + 10, b.x + b.w - 10); plate(x, b.x, b.y, b.w, b.h, 1);
        x.strokeStyle = SOFT; x.lineWidth = 1; x.globalAlpha = 0.6; x.beginPath(); x.moveTo(lx, h.my < b.y ? b.y : b.y + b.h); x.lineTo(h.mx, h.my); x.stroke(); x.fillStyle = INK; x.globalAlpha = 0.9; x.beginPath(); x.arc(h.mx, h.my, 2.2, 0, 6.283); x.fill();
        x.textAlign = 'right'; x.font = `500 ${size}px ${FONT_TEXT}`; x.fillStyle = INK; x.globalAlpha = 0.92; x.fillText(FC_T1, sx, sy);
        x.strokeStyle = INK; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(sx - w1, sy + 6.5); x.lineTo(sx, sy + 6.5); x.stroke();
        x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = SOFT; x.globalAlpha = 0.92; x.fillText(fcT2(), sx, sy + TAG_H); x.textAlign = 'center';
      } else {
      x.font = `500 ${size}px ${FONT_TEXT}`; x.fillStyle = INK; x.globalAlpha = 0.88; x.fillText(FC_T1, sx, sy);
      x.strokeStyle = INK; x.lineWidth = 1; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(sx - w1 / 2, sy + 5.5); x.lineTo(sx + w1 / 2, sy + 5.5); x.stroke();
      x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = SOFT; x.globalAlpha = 0.75; x.fillText(fcT2(), sx, sy + MIN_TEXT + 10);
      }
      fcHead = h.box;
    }
  }
}
function draw(force = false) {
  if (!ctx || !db.events.length) return;
  layout();
  const wv = waveT0 && performance.now() - waveT0 < WAVE_MS ? Math.floor((performance.now() - waveT0) / 16) : -1; // a frame of the wave
  { const tg = sheetUp(par()) ? 1 : 0; // the sheet's lift, eased over 380 ms; a cut when motion is reduced
    if (shA !== tg) { const now = performance.now(), st = reduced() ? 1 : shT ? Math.min(0.5, (now - shT) / SHEET_MS) : 0.04; shT = now; shA = tg > shA ? Math.min(1, shA + st) : Math.max(0, shA - st); if (shA !== tg) schedule(); else shT = 0; } }
  const key = `${cam.year.toFixed(3)}|${cam.zoom.toFixed(4)}|${cam.lift.toFixed(4)}|${W}x${H}|${DPR}|${G.key}|${fontsV}|${wv}|${shA.toFixed(4)}|${breath.toFixed(4)}`;
  if (!force && key === sceneKey) { drawOverlay(); return; }
  sceneKey = key;
  const t0 = performance.now(), V = view(par());
  picHits.length = 0;
  project(V);
  const t1 = performance.now();
  paintScene(ctx, V);
  const t2 = performance.now();
  prof.project = t1 - t0; prof.paint = t2 - t1; prof.frames++;
  if (picAnim) schedule(); // stage 7: the unit's pictures still easing
  drawOverlay(V);
  prof.total = performance.now() - t0;
}

// ---------- the field: the decade or year in hand, its events, then its claims (and, in the 2020s, the forecasts due) ----------
function unitOf(Y) {
  Y = clamp(Math.round(Y), Y_LO, T1);
  return early(Y) ? { key: `d${decadeOf(Y)}`, y0: decadeOf(Y), y1: decadeEnd(Y), label: fmtSpan(decadeOf(Y), decadeEnd(Y)), count: G ? G.perDecade.get(decadeOf(Y)) || 0 : 0 } : { key: `y${Y}`, y0: Y, y1: Y, label: Y === T1 ? 'This year' : String(Y), count: G ? G.perYear[sl(Y)] : 0 };
}
// stage 9: a unit's rows. On the desk the feed carries every record of the unit, newest first (the coil's wheel runs the same way:
// down is back in time), and every claim said in it; the phone keeps the weightiest few, as stage 6 left it.
function collectUnit(un, P) {
  const ck = `${un.key}|${P.vert ? 'v' : 'd'}|${G.key}|${forecasts ? forecasts.length : -1}|${db.highlights ? 'h' : ''}`;
  const hit = unitCache.get(ck); if (hit) return hit;
  const inHand = (y) => y >= un.y0 && y <= un.y1;
  const ev = []; for (let i = 0; i < G.n; i++) { const e = db.events[i]; if (inHand(e.year) && e.title_short) ev.push({ e, i }); }
  if (P.vert) ev.sort((a, b) => ((b.e.significance || 0) - (a.e.significance || 0)) || (a.e.year - b.e.year) || (a.e.id < b.e.id ? -1 : 1));
  else ev.sort((a, b) => (b.e.year - a.e.year) || ((b.e.significance || 0) - (a.e.significance || 0)) || (a.e.id < b.e.id ? -1 : 1));
  const said = (db.predictions || []).filter((c) => c.year_made != null && inHand(c.year_made)).sort((a, b) => P.vert ? a.year_made - b.year_made : b.year_made - a.year_made);
  const due = un.y1 >= 2024 && forecasts ? forecasts.filter((f) => f.t === un.y1) : [];
  const nC = P.vert ? P.claims : 2; // the desk keeps two: a verdict teaches more than a list
  if (!P.vert) said.sort((a, b) => ((b.outcome && b.outcome !== 'unresolvable' && b.outcome !== 'pending' ? 1 : 0) - (a.outcome && a.outcome !== 'unresolvable' && a.outcome !== 'pending' ? 1 : 0)) || (b.year_made - a.year_made));
  const claims = said.slice(0, nC).map((c) => ({ kind: 'claim', id: c.id, text: c.claim || c.paraphrase || c.quote, who: `${String(c.who || '').split(',')[0]}, ${c.year_made}`, by: c.predicted_for || 0, v: c.outcome || 'unresolvable', chk: c.chk }))
    .concat(pickForecasts(due, P.vert ? Math.max(0, nC - Math.min(said.length, nC)) : due.length).map((f) => ({ kind: 'forecast', id: null, text: f.text, who: `${f.who}, said ${String(f.said || '').slice(0, 4)}`, by: f.t || 0, v: f.v || 'pending' })));
  const card = db.decadeCards ? db.decadeCards.get(un.y0) || null : null;
  const c0 = centOf(un.y0), cent = un.y0 === (c0 < T0 ? decadeOf(T0) : c0) && db.centuryLines ? db.centuryLines.get(c0) || null : null;
  // stage 10: the column's cards are the unit's highlights, at most five, picked by the build (data/highlights.json: significance
  // with the record's own signals, moments, landmark episodes, milestones on the outcome series) and reviewed by hand; until
  // that file arrives, the weightiest few by significance
  let feed = [];
  const hl = db.highlights ? db.highlights.get(un.key) : null;
  // a highlight stands only in the unit its record is dated in: a record re-dated after the list was built (two were: 1070s, 1760s) is dropped here, so a sheet lists exactly the records it counts
  if (hl) { for (const id of hl) { const i = indexOf(id); if (i >= 0 && db.events[i].title_short && inHand(db.events[i].year)) feed.push({ e: db.events[i], i }); } }
  else { const sig = (it) => it.e.significance || 0, pic = (it) => (picOfEvent && picOfEvent.has(it.e.id) ? 1 : 0); feed = ev.slice().sort((a, b) => (sig(b) - sig(a)) || (pic(b) - pic(a)) || (a.e.year - b.e.year)).slice(0, 5); }
  const out = { key: un.key, label: un.label, events: ev, feed, claims, total: un.count, card, cent, centN: cent ? centCount(c0) : 0, y0: un.y0, y1: un.y1 };
  if (unitCache.size > 40) unitCache.clear();
  unitCache.set(ck, out);
  return out;
}
// the phone's unit sheet: one press on the unit's name opens the unit in hand as a sheet. Its highlights stand first, each with its picture, date and
// opening sentence; then the century's line and the decade's card where the unit carries them; then every claim said in it and every record it holds
let unitMark = null; // where the unit's name stands on the phone: the sheet's mark
function unitOfKey(key) { const m = /^unit:([dy])(-?\d+)$/.exec(key || ''); return m ? unitOf(+m[2]) : null; }
function openUnit(un) {
  if (!G || !un) return false;
  const P = VERT, U = collectUnit(un, P), key = `unit:${un.key}`, inHand = (y) => y >= un.y0 && y <= un.y1, n = (k, w) => `${k.toLocaleString('en-US')} ${w}${k === 1 ? '' : 's'}`;
  const said = (db.predictions || []).filter((c) => c.year_made != null && inHand(c.year_made)).sort((a, b) => a.year_made - b.year_made);
  const due = un.y1 >= 2024 && forecasts ? forecasts.filter((f) => f.t === un.y1) : [];
  const top = new Set(U.feed.map((it) => it.e.id)), all = U.events.slice().sort((a, b) => (a.e.year - b.e.year) || ((b.e.significance || 0) - (a.e.significance || 0)));
  const dot = (col) => `<i style="background:${col}"></i>`, when = (e) => (un.y0 === un.y1 ? '' : `<span class="hx-uy" style="color:${typeOf(e.year)}">${esc(fmtTick(e.year))}</span>`);
  const card = (it) => { const k = picOfEvent ? picOfEvent.get(it.e.id) : undefined, a = k != null && G.picList[k] ? G.picList[k].a || 1 : 0, sum = it.e.summary ? firstSentence(it.e.summary) : '';
    return `<li><button type="button" class="hx-ucard" data-id="${esc(it.e.id)}">${a ? `<canvas class="hx-uth" data-k="${k}" style="aspect-ratio:${a.toFixed(3)}"></canvas>` : it.e.picture && it.e.picture.src ? `<img class="hx-uth" src="${esc(it.e.picture.src)}" alt="${esc(it.e.picture.alt || '')}" loading="lazy" decoding="async">` : ''}<span class="hx-ut"><b>${esc(it.e.title_short || it.e.title)}</b>${when(it.e)}${sum ? `<span class="hx-us">${esc(sum)}</span>` : ''}</span></button></li>`; };
  const line = (it) => `<li><button type="button" class="hx-uline" data-id="${esc(it.e.id)}">${dot(typeOf(it.e.year))}<span>${esc(it.e.title_short || it.e.title)}</span>${un.y0 === un.y1 ? '' : `<span class="y">${esc(fmtTick(it.e.year))}</span>`}</button></li>`;
  const claim = (id, text, who, v) => `<li><${id ? `button type="button" data-id="${esc(id)}"` : 'div'} class="hx-uline hx-uclaim">${dot(VERDICT_NIGHT[v] || VERDICT_NIGHT.unresolvable)}<span>${esc(text)}<span class="hx-us">${esc(who)}, ${esc(VERDICT_WORD[v] || VERDICT_WORD.unresolvable)}</span></span></${id ? 'button' : 'div'}></li>`;
  const claims = said.map((c) => claim(c.id, c.claim || c.paraphrase || c.quote, `${String(c.who || '').split(',')[0]}, ${c.year_made}`, c.outcome || 'unresolvable'))
    .concat(due.map((f) => claim(`fc:${forecasts.indexOf(f)}`, f.text, `${f.who}, said ${String(f.said || '').slice(0, 4)}`, f.v || 'pending')));
  const rest = all.filter((it) => !top.has(it.e.id));
  const recN = (list) => list.reduce((k, it) => k + (it.e.kind === 'overlay' ? 0 : 1), 0); // a period (the five overlays) is listed with its decade and is never a record in a count (data.js census), so the sheets add up to the record's total
  const html = `${un.y1 < T0 ? `<p class="summary">${esc(ROOTS_LINE)} Each dotted ring is ten times nearer.</p>` : U.cent ? `<p class="summary">${esc(U.cent.line)}</p>` : ''}
    ${U.feed.length ? `<ul class="hx-ulist">${U.feed.map(card).join('')}</ul>` : ''}
    ${U.card ? `<canvas class="hx-uchart"></canvas>` : ''}
    ${claims.length ? `<div class="sect-h"><span>Claims</span><span>${claims.length}</span></div><ul class="hx-ulist">${claims.join('')}</ul>` : ''}
    ${rest.length ? `<div class="sect-h"><span>Records</span><span>${recN(rest)}</span></div><ul class="hx-ulist">${rest.map(line).join('')}</ul>` : ''}`;
  openEvidence(key, { kicker: `<span class="ki">${un.y1 < T0 ? 'Before 1026' : un.y0 === un.y1 ? 'Year' : 'Decade'}</span>`, title: un.label === 'This year' ? `This year, ${T1}` : un.label, sub: `${n(recN(U.events), 'record')}${claims.length ? `, ${n(claims.length, 'claim')}` : ''}`, html,
    onMount: (el) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of el.querySelectorAll('canvas.hx-uth')) { const it = G && G.picList[+c.dataset.k]; if (!it || !it.atl || !it.atl.naturalWidth) continue; const w = 72, h = Math.round(w / (it.a || 1)); c.width = w * dpr; c.height = h * dpr; const cx = c.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0); drawPic(cx, it, w / 2, h / 2, w, h); }
      const ch = el.querySelector('canvas.hx-uchart'); if (ch && U.card) { // the decade's card, drawn as the desk draws it, at the sheet's measure
        ch.style.width = '100%'; const cw = Math.max(240, Math.floor(ch.getBoundingClientRect().width)), cx = ch.getContext('2d'), end = drawCard(cx, U.card, 0, 0, cw, P, 1e9, 16, true);
        ch.style.width = `${cw}px`; ch.style.height = `${Math.ceil(end + 26)}px`; ch.width = cw * dpr; ch.height = Math.ceil(end + 26) * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.textAlign = 'left'; cx.textBaseline = 'alphabetic'; drawCard(cx, U.card, 0, 18, cw, P, 1e9, 16, false); lineHits.pop(); // the stage keeps no hit for a source drawn in the sheet
      }
    } });
  return true;
}
function buildField(P) {
  const Y = settling ? T1 : cam.year, un = unitOf(Y);
  if (field && field.key === un.key && field.vert === P.vert && field.fc === (forecasts ? forecasts.length : -1)) return field;
  if (un.y1 >= 2020) ensureForecasts();
  const u = collectUnit(un, P), maxEv = P.vert ? P.lines : u.events.length;
  if (u.card && cardKey !== un.key) { cardKey = un.key; cardOff = false; }
  if (unitKey !== un.key) { unitKey = un.key; unitT0 = performance.now(); unitQuick = !resting; } // a new unit: its column enters card by card, or at once while the camera is travelling
  const rows = P.vert && u.feed.length ? u.feed : u.events; // the phone's rows are the same highlights as the desk's cards
  field = { key: un.key, vert: P.vert, fc: forecasts ? forecasts.length : -1, label: un.label, sub: '', events: rows.slice(0, u.card && P.vert ? Math.min(maxEv, 4) : maxEv), feed: u.feed, claims: u.claims, total: u.total, card: u.card, cent: u.cent, centN: u.centN, y0: un.y0, y1: un.y1 };
  return field;
}
// the unit before this one in the feed's reading order (older), and the one after (newer)
function unitStep(un, dir) { const y = dir < 0 ? (un.y0 < 2000 ? un.y0 - 1 : un.y0 - 1) : (un.y1 < 2000 ? un.y1 + 1 : un.y1 + 1); if (y < Y_LO || y > T1) return null; return unitOf(stopOf(y)); }
// the loop in hand's right rim on the stage, for the field's column
function rimOf(V) {
  const Yc = Math.floor(slf(cam.year) / 100) * 100, o = new Float32Array(3); let rim = 0; // slots
  for (let y = Yc; y <= Math.min(SPAN, Yc + 100, slf(cam.year) + 50); y += 2) { coilRel(y, 6, 0.3, o, 0); const p = projR(V, o[0], o[1], o[2]); if (p.d && p.sx > rim) rim = p.sx; } // the loop in hand, no further than half a turn ahead of the seat: the turn's far end swings close to the camera and would push the column off the stage
  return slf(cam.year) < R ? Math.min(rim, W * 0.5) : rim; // down the roots the trunk ahead runs off the stage; the column keeps its place
}
// ---------- stage 5: the culture layer's drawing ----------
const centOf = (y) => yearOfSlot(Math.floor(sl(y) / 100) * 100); // the turn's first year
function centCount(c) {
  if (!centCounts) { centCounts = new Map(); for (let si = 0; si <= SPAN; si++) { const k = yearOfSlot(Math.floor(si / 100) * 100); centCounts.set(k, (centCounts.get(k) || 0) + (G.perYear[si] || 0)); } }
  return centCounts.get(c) || 0;
}
const centLineText = (l) => l.line;
const firstClause = (t) => String(t).split(/[;,]/)[0].replace(/\.$/, '');
let cardHue = INK; const hueOf = () => cardHue; // a card's bars and series take the blend at the card's decade; domains stay named in plain ink
// a card's fact: its **spans** read in 500; a run is [text, bold], a line a list of runs that fits the measure
function richRuns(t) { const out = []; String(t).split('**').forEach((seg, i) => { if (seg) out.push([seg, i % 2 === 1]); }); return out; }
function wrapRuns(x, runs, size, maxW) {
  const lines = [[]]; let lw = 0;
  for (const [t, b] of runs) {
    x.font = `${b ? 500 : 400} ${size}px ${FONT_TEXT}`;
    for (const w of t.split(/(\s+)/)) {
      if (!w) continue;
      const ww = x.measureText(w).width;
      if (w.trim() && lw + ww > maxW && lw > 0) { lines.push([]); lw = 0; }
      if (!w.trim() && lw === 0) continue;
      lines[lines.length - 1].push([w, b]); lw += ww;
    }
  }
  return lines;
}
function drawRuns(x, lines, cx, cy, size, lh, col) {
  for (const ln of lines) { let px = cx; for (const [t, b] of ln) { x.font = `${b ? 500 : 400} ${size}px ${FONT_TEXT}`; x.fillStyle = col; x.fillText(t, px, cy); px += x.measureText(t).width; } cy += lh; }
  return cy;
}
// the card's chart, drawn as the kit draws it: lines over a share axis with their labels, or bars with the value at the end
function chartH(ch, h, pitch) { return ch.type === 'bars' ? ch.bars.length * pitch : h; }
function drawChart(x, ch, cx, cy, w, h, pitch) {
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  if (ch.type === 'bars') {
    const bw = w - 60, bh = pitch < 40 ? 10 : pitch < 46 ? 12 : 14;
    ch.bars.forEach((b, i) => {
      const y = cy + i * pitch, len = Math.max(2, (b.value / ch.max) * bw);
      x.fillStyle = SOFT; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillText(b.name, cx, y + 13);
      x.fillStyle = hueOf(b.domain); x.fillRect(cx, y + 18, len, bh);
      x.fillStyle = INK; x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillText(`${b.value}%`, cx + len + 10, y + 18 + bh - 2);
    });
    return;
  }
  const TOP = 18, BOT = 22, R = 128, sx = (v) => cx + ((v - ch.x0) / (ch.x1 - ch.x0)) * (w - R), sy = (v) => cy + h - BOT - (v / 100) * (h - TOP - BOT);
  x.lineWidth = 1.8; x.setLineDash([]);
  for (const sr of ch.series) {
    x.strokeStyle = x.fillStyle = hueOf(sr.domain); x.beginPath();
    sr.points.forEach(([px, pv], i) => (i ? x.lineTo(sx(px), sy(pv)) : x.moveTo(sx(px), sy(pv)))); x.stroke();
    for (const [px, pv] of sr.points) { x.beginPath(); x.arc(sx(px), sy(pv), 3.2, 0, 6.283); x.fill(); }
  }
  x.fillStyle = SOFT; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; const boxes = [];
  for (const l of ch.labels || []) { // direct labels; a label that would collide with one already placed is dropped rather than let overlap
    const tw = x.measureText(l.text).width, lx = sx(l.x) + (l.dx || 0), ly = sy(l.v) + (l.dy || 0), x0 = l.anchor === 'end' ? lx - tw : l.anchor === 'middle' ? lx - tw / 2 : lx, b = { x0, x1: x0 + tw, y0: ly - MIN_TEXT, y1: ly + 3 };
    if (boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue; boxes.push(b);
    x.textAlign = l.anchor === 'end' ? 'right' : l.anchor === 'middle' ? 'center' : 'left'; x.fillText(l.text, lx, ly);
  }
  x.textAlign = 'center'; for (const yr of ch.axis || []) x.fillText(String(yr), sx(yr), cy + h - 4);
  x.textAlign = 'left';
}
// the card under the heading: kind line, fact, chart, source. Returns the y after it, or null when it will not fit above the floor at this size
function drawCard(x, card, cx, cy, cw, P, floor, fs, dry, mode = 'full') {
  const lh = Math.round(fs * 1.35), measure = Math.min(cw, 560), chW = P.vert ? cw : Math.min(300, cw), chH = P.vert ? 84 : 90, pitch = P.vert ? 34 : 36, chart = mode === 'bare' ? null : card.chart; // stage 6: compact, chart 300 by 90 on the desk, full width by 84 on the phone; stage 10: a short form when the column is full
  const kind = wrapRuns(x, card.decade < 2000 ? [[card.subject, true]] : [[`${card.kind} · `, false], [card.subject, true]], MIN_TEXT, measure); let fact = wrapRuns(x, richRuns(mode === 'full' ? card.fact : firstSentence(card.fact)), fs, measure); if (mode !== 'full' && fact.length > 2) { fact = fact.slice(0, 2); const ln = fact[1], last = ln[ln.length - 1]; ln[ln.length - 1] = [last[0].replace(/[,;:]?\s*$/, '') + '…', last[1]]; } // the short forms keep the first sentence, two lines at most
  x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; const srcLines = wrapT(x, W < 600 && card.source_short ? card.source_short : card.source, measure), sl = Math.round(MIN_TEXT * 1.4);
  const kl = Math.round(MIN_TEXT * 1.5), total = kind.length * kl + 6 + fact.length * lh + 6 + (chart ? chartH(chart, chH, pitch) + 10 : 0) + srcLines.length * sl;
  if (cy + total > floor) return null;
  if (dry) return cy + total;
  let py = cx; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
  for (const ln of kind) { py = cx; for (const [t, b] of ln) { x.fillStyle = b ? INK : SOFT; x.font = `${b ? 500 : 400} ${MIN_TEXT}px ${FONT_TEXT}`; x.fillText(t, py, cy); py += x.measureText(t).width; } cy += kl; } // the decade in soft, its subject in ink
  cy += 6 + Math.round(fs * 0.3);
  cy = drawRuns(x, fact, cx, cy, fs, lh, INK) - lh + Math.round(fs * 0.4) + 6;
  if (chart) { cardHue = heatOf((card.decade || cam.year) + 5); drawChart(x, chart, cx, cy, chW, chH, pitch); cy += chartH(chart, chH, pitch) + 10; } cy += MIN_TEXT;
  x.fillStyle = SOFT; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; const y0 = cy; let sw = 0;
  for (const t of srcLines) { x.fillText(t, cx, cy); sw = Math.max(sw, x.measureText(t).width); cy += sl; }
  lineHits.push({ x: cx - 4, y: y0 - MIN_TEXT, w: sw + 8, h: cy - y0, src: card.source_url });
  return cy - sl + Math.round(MIN_TEXT * 0.6);
}
const wrapT = (x, t, maxW) => { const out = []; let line = ''; for (const w of String(t).split(' ')) { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > maxW && line) { out.push(line); line = w; } else line = tt; } if (line) out.push(line); return out; };
const ell = (x, t, maxW) => { if (x.measureText(t).width <= maxW) return t; let s = String(t); while (s.length > 3 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; };
// where the field's column sits, and its scrim on the desk (painted before the leaps, so their landings read over it)
// the claims and forecasts wrap whole, never cut: their lines measured, then the event lines that still fit above them (stage 6)
function claimLines(x, F, P, cw) { x.font = `400 ${P.line}px ${FONT_TEXT}`; return F.claims.map((c) => wrapT(x, c.text, cw - 16)); }
function fieldNeed(F, P, evN, cl) { const lh = Math.round(P.line * 1.55); return evN * lh + (cl.length ? Math.round(lh * 0.5) + cl.reduce((a, l) => a + l.length * lh + Math.round(lh * 0.95), 0) : 0); }
function eventsThatFit(F, P, cl, room) { let n = F.events.length; while (n > 0 && fieldNeed(F, P, n, cl) > room) n--; return n; }
const fieldFloor = (P) => (P.vert ? H - 92 - P.readout * 0.78 - 4 : H * 0.81); // the field ends above the big year on the phone
function fieldPos(V, P, Wf) {
  if (cam.zoom > 0.02 || textA <= 0) return null;
  const F = buildField(P), cardOn = !!F.card && !(P.vert && cardOff);
  if (P.vert) return { F, cardOn: false, cx: BAND.x0, cy: BAND.y0 + HEAD_H() - 8, cw: BAND.x1 - BAND.x0 }; // the phone: the unit's name stands beside the big year, its lines in the sky over the loop (drawMarkers)
  const rim = rimOf(V), cw = Math.min(P.colW, Wf - 64 - Math.max(rim + 48, Wf * 0.5)), cx = Wf - 64 - cw; // stage 6: a column of at most 400, anchored right, clear of the near end
  if (cw < 300) return null; // beside an open drawer with no room left, the record in hand stands in for the field
  return { F, cardOn, cx, cy: Math.round(H * 0.16), cw };
}
function drawScrim(x, pos, P, Wf) {
  if (!pos) return;
  if (P.vert) { // the phone's card rises into the coil's foot: a soft night scrim under it
    if (!pos.cardOn) return;
    const y0 = pos.cy - P.head - 70, sg = x.createLinearGradient(0, y0, 0, pos.cy + 10); sg.addColorStop(0, 'rgba(6,8,26,0)'); sg.addColorStop(1, 'rgba(6,8,26,0.8)');
    x.globalAlpha = textA; x.fillStyle = sg; x.fillRect(0, y0, W, H - y0); x.globalAlpha = 1; return;
  }
  const sg = x.createLinearGradient(pos.cx - 260, 0, pos.cx + 40, 0); sg.addColorStop(0, 'rgba(6,8,26,0)'); sg.addColorStop(1, 'rgba(6,8,26,0.55)');
  x.globalAlpha = textA; x.fillStyle = sg; x.fillRect(pos.cx - 260, 0, Wf - pos.cx + 260, H); x.globalAlpha = 1;
}
// The phone's heading down the roots names one span: the numeral reads the unit's first year and the name beside it runs on to its last
// ("783 CE" then "to 1025"), whatever year of that unit the camera stands at. An open record's year stands alone, as on the coil.
const headYear = (P, Y) => (P.vert && Y < T0 && selYear() == null ? unitOf(Y).y0 : Y);
const headName = (P, F) => (P.vert && F.y1 < T0 && F.label.includes(' to ') ? F.label.slice(F.label.indexOf(' to ') + 1) : F.label);
// where the phone sets the unit's name: beside the big year when it fits there, else under it at the head of the stage
function unitSeat(x, P, pos) {
  const { F, cx, cy } = pos, hs = P.head, Y = headYear(P, selYear() ?? (settling ? T1 : clamp(Math.round(cam.year), Y_LO, T1))), ro = fmtTick(Y), name = headName(P, F), rs = ro.length > 6 ? Math.round(P.readout * (ro.length > 11 ? 0.42 : 0.6)) : P.readout;
  x.font = `400 ${rs}px ${FONT_DISPLAY}`; const hx = cx + x.measureText(ro).width + 12;
  x.font = `italic 400 ${hs}px ${FONT_DISPLAY}`; const hw = x.measureText(name).width, own = hx + hw > (word ? word.x : BAND.x1) - 6, lx = own ? BAND.x0 + 8 : hx, ly = own ? skyTop() + 8 + hs : cy;
  unitMark = { x: lx - 6, y: ly - hs - 4, w: hw + 12, h: hs + 14, own };
  return { lx, ly, hw, own, name };
}
function drawField(x, V, P, Wf, pos) {
  if (!P.vert) lineHits.length = 0; // the phone's lines are set with the markers, before this
  if (!pos) return;
  const { F, cardOn } = pos; let { cx, cy, cw } = pos;
  const un = unitOf(cam.year), yearCol = typeOf((un.y0 + un.y1) / 2); // the years in the colour of the decade in hand
  const hs = P.head, ls = P.line, ys = P.year, lh = Math.round(ls * 1.55), floor = fieldFloor(P);
  x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.globalAlpha = textA;
  x.globalAlpha = textA * FIELD_INK; // stage 6: the field's ink at 88 percent, the coil the hero
  if (P.vert) { // the phone: the unit's name on the big year's baseline, a step to its right
    if (selYear() != null) return; // an open record's year stands alone: the unit in hand is not that record's
    const u = unitSeat(x, P, pos); x.fillStyle = INK; x.font = `italic 400 ${hs}px ${FONT_DISPLAY}`;
    if (u.own) plate(x, u.lx - 8, u.ly - hs - 4, u.hw + 16, hs + 14, textA); // a span too long for the year's row stands under it, on its own ground at the head of the stage
    x.fillText(u.name, u.lx, u.ly); lineHits.push({ x: u.lx - 8, y: u.ly - hs - 8, w: u.hw + 16, h: hs + 22, head: true }); // one press opens the unit's sheet
    return;
  }
  x.fillStyle = INK; x.font = `italic 400 ${hs}px ${FONT_DISPLAY}`;
  if (!P.vert) { const ageH = clamp((performance.now() - unitT0) / (unitQuick ? QUICK_MS : EASE_MS), 0, 1); x.globalAlpha = textA * FIELD_INK * easeOut(ageH); x.fillText(F.label, cx, cy - Math.round(hs * 1.1)); } // the desk's heading stands through travel
  if (linesA <= 0.01) return;
  x.globalAlpha = textA * linesA * FIELD_INK;
  cy += Math.round(hs * 1.1);
  if (P.vert) { // the phone keeps stage 6's field: the card, or the decade's few lines
    if (F.cent) {
      const cs = MIN_TEXT, cl = Math.round(cs * 1.4); x.fillStyle = SOFT; x.font = `400 ${cs}px ${FONT_TEXT}`;
      const tl = wrapT(x, centLineText(F.cent, F.centN), Math.min(cw, 560)).slice(0, 2); if (tl.length === 2) tl[1] = ell(x, tl[1], Math.min(cw, 560));
      for (const t of tl) { x.fillText(t, cx, cy); cy += cl; }
      cy += Math.round(cl * 0.3);
    }
    if (cardOn) {
      let end = null;
      for (const fs of [15, 14]) { end = drawCard(x, F.card, cx, cy, cw, P, floor, fs, false); if (end != null) break; }
      if (end == null) { const c2 = { ...F.card, chart: { type: 'bars', bars: [], max: 1 } }; drawCard(x, c2, cx, cy, cw, P, floor + 200, 14, false); }
      return;
    }
    const cl = pos.cl || claimLines(x, F, P, cw), evN = pos.evN != null ? pos.evN : eventsThatFit(F, P, cl, floor - cy + lh);
    cy = drawRows(x, F, cx, cy, cw, P, yearCol, F.events.slice(0, evN), cl, floor, 1);
    return;
  }
  // stage 10, the desk: the column is the unit's highlights. The heading, a line on how much the unit holds, the century's line
  // and the decade's card when there is one, then the cards that fit, then a claim or two. Nothing scrolls inside the column;
  // the wheel moves through time and the column keeps up, entering card by card.
  const now = performance.now(), top = cy, cy0 = top - Math.round(hs * 1.1), oneYear = F.y0 === F.y1;
  const L = feedLayout(x, F, P, cw), ageP = clamp((now - unitT0) / EASE_MS, 0, 1);
  cy = top; // the heading stood above, before the lines
  x.globalAlpha = textA * linesA * FIELD_INK;
  const cs = 16, cl2 = Math.round(cs * 1.4);
  if (F.cent) { // the century's line, under its first decade's heading
    x.font = `400 ${cs}px ${FONT_TEXT}`; const tl = wrapT(x, centLineText(F.cent, F.centN), Math.min(cw, 560)).slice(0, 2); if (tl.length === 2) tl[1] = ell(x, tl[1], Math.min(cw, 560));
    x.fillStyle = SOFT; for (const t of tl) { x.fillText(t, cx, cy); cy += cl2; }
    cy += Math.round(cl2 * 0.3);
  }
  if (cardOn) { // the decade's card in the fullest form that still leaves room for three of the cards (four when it drops its chart)
    const fits = (mode, want) => { const end = drawCard(x, F.card, cx, cy, cw, P, 1e9, P.card, true, mode); if (end == null) return false; let room = floor - (end + lh), k = 0; for (const it of L.items) { if (it.kind !== 'card') break; if (room < it.h - Math.round(lh * 0.4)) break; room -= it.h; k++; } return k >= Math.min(want, L.items.filter((it) => it.kind === 'card').length); };
    const mode = fits('full', 3) ? 'full' : fits('short', 3) ? 'short' : fits('bare', 3) ? 'bare' : null;
    if (mode) { const end = drawCard(x, F.card, cx, cy, cw, P, 1e9, P.card, false, mode); cy = (end == null ? cy : end) + lh; }
  }
  // the items that fit above the floor, whole: cards first, then the claims
  let used = 0, n = 0; for (const it of L.items) { if (cy + used + it.h - Math.round(lh * 0.4) > floor + Math.round(lh * 0.5)) break; used += it.h; n++; } // half a line of grace above the hint
  cy = drawFeedItems(x, { items: L.items.slice(0, n), h: used }, cx, cy, cw, P, yearCol, 1e9, 1, -1e9, oneYear, now);
  if (now - unitT0 < EASE_MS + STAGGER_MS * (n + 1)) schedule();
  x.globalAlpha = textA;
}
// the feed's cards. A record is its picture, its title, its year when the unit spans years, and the first sentence of its
// summary once the text has arrived; a moment carries a dot in its year's blend. A claim is its words, then the verdict word
// in the verdict's hue, the year it named and who said it. Heights are measured once per unit and kept.
const feedLayouts = new Map();
const ABBR_END = /(?:^|[\s(\u201c"])(?:[A-Z]|St|Mr|Mrs|Ms|Dr|Mt|No|Nos|Jr|Sr|vs|etc|Co|Inc|Ltd|Corp|Gen|Col|Capt|Prof|Rev|Hon|Sen|Rep|Gov|Pres|ca|approx|U\.S|U\.K|U\.N|R\.U\.R|a\.m|p\.m|Ph\.D|D\.C)\.$/;
const firstSentence = (t, whole) => { // the opening sentence: a stop counts only when it is not an abbreviation and the text goes on in a capital
  const str = String(t || '').trim(); if (!str) return '';
  const cut = (o) => { if (!whole && o.length > 230) { o = o.slice(0, 230); o = o.slice(0, o.lastIndexOf(' ')) + '…'; } return o; };
  const re = /[.!?](?=\s|$)/g; let m;
  while ((m = re.exec(str))) {
    const end = m.index + 1; if (end < 30) continue;
    const head = str.slice(0, end); if (ABBR_END.test(head)) continue;
    const next = str.slice(end).trimStart(); if (next && /^[a-z]/.test(next)) continue;
    return cut(head);
  }
  return cut(str);
};
function feedLayout(x, U, P, cw) {
  const key = `${U.key}|${cw}|${P.line}|${db._textJson ? 1 : 0}|${G ? G.key : ''}|${U.feed.length}|${U.claims.length}`;
  const hit = feedLayouts.get(key); if (hit) return hit;
  const ls = P.line, lh = Math.round(ls * 1.55), oneYear = U.y0 === U.y1, PH = 54, items = []; let h = 0;
  for (const it of U.feed) {
    const pk = picOfEvent ? picOfEvent.get(it.e.id) : undefined, pic = pk != null && G && G.picList[pk] ? G.picList[pk] : null;
    const pw = pic ? Math.round(clamp(PH * (pic.a || 1), 34, 86)) : 0, tx = pic ? pw + 14 : 0, tw = cw - tx - (oneYear ? 0 : 52);
    x.font = `400 ${ls}px ${FONT_TEXT}`; const tAll = wrapT(x, it.e.title_short || it.e.title, tw), title = tAll.slice(0, 2); if (tAll.length > 2) title[1] = ell(x, title[1] + '…', tw);
    const sAll = it.e.summary ? wrapT(x, firstSentence(it.e.summary), cw - tx) : [], sum = sAll.slice(0, 3); if (sAll.length > 3) sum[2] = ell(x, sum[2] + '…', cw - tx); // the opening sentence whole, up to three lines
    const th = (title.length + sum.length) * lh, ch = Math.max(th, pic ? PH : 0) + Math.round(lh * 0.7);
    items.push({ kind: 'card', it, pic, pw, tx, title, sum, h: ch, off: h }); h += ch;
  }
  if (U.claims.length) {
    h += Math.round(lh * 0.4);
    for (const c of U.claims) { x.font = `400 ${ls}px ${FONT_TEXT}`; const tl = wrapT(x, c.text, cw - 16).slice(0, 3); if (tl.length === 3) tl[2] = ell(x, tl[2], cw - 16); const ch = tl.length * lh + Math.round(lh * 1.1); items.push({ kind: 'claim', c, tl, h: ch, off: h }); h += ch; }
  }
  const out = { items, h };
  if (feedLayouts.size > 24) feedLayouts.clear();
  feedLayouts.set(key, out);
  return out;
}
function drawFeedItems(x, L, cx, cy, cw, P, yearCol, floor, ink, ceil, oneYear, now = 0) {
  // each line fades on its own as it nears the heading or the floor, so a row never sits under the heading and the column
  // ends in air at both edges; a picture is clipped to the band between them
  const ls = P.line, ys = P.year, lh = Math.round(ls * 1.55), a0 = textA * linesA * FIELD_INK * ink, PH = 54;
  const fadeH = lh * 1.8, fadeT = lh * 0.9, edge = (y) => clamp(Math.min((y - ceil) / fadeT, (floor - y) / fadeH), 0, 1);
  let ent = 1, rise = 0, k = 0; // stage 10: each item enters a beat after the one above, rising a little as it fades in
  const put = (t, px, py) => { const a = a0 * edge(py) * ent; if (a <= 0.01) return; x.globalAlpha = a; x.fillText(t, px, py + rise); };
  for (const item of L.items) {
    if (cy > floor + lh || cy + item.h < ceil) { cy += item.h; k++; continue; }
    if (now) { const p = clamp((now - unitT0 - (unitQuick ? 0 : STAGGER_MS) * k) / (unitQuick ? QUICK_MS : EASE_MS), 0, 1); ent = easeOut(p); rise = Math.round((1 - ent) * (unitQuick ? 3 : 8)); } k++;
    const yTop = cy - ls; // the item's top edge
    if (item.kind === 'card') {
      const { it, pic, pw, tx, title, sum } = item;
      if (pic) { const pa = a0 * edge(yTop + PH / 2) * ent; if (pa > 0.01) { x.globalAlpha = pa; drawPic(x, pic, cx + pw / 2, yTop + PH / 2 + rise, pw, PH); } }
      if (G && G.cellMoment[it.i] === 1) { const ma = a0 * edge(cy) * ent; if (ma > 0.01) { x.globalAlpha = ma; x.fillStyle = heatOf(it.e.year); x.beginPath(); x.arc(cx - 10, cy - ls * 0.35 + rise, 3, 0, 6.283); x.fill(); } }
      let ty = cy; x.fillStyle = INK; x.font = `400 ${ls}px ${FONT_TEXT}`;
      for (let k = 0; k < title.length; k++) {
        put(title[k], cx + tx, ty);
        if (k === title.length - 1 && !oneYear) { const w0 = x.measureText(title[k]).width; x.fillStyle = yearCol; x.font = `500 ${ys}px ${FONT_TEXT}`; put(fmtYear(it.e.year), cx + tx + w0 + 10, ty); x.fillStyle = INK; x.font = `400 ${ls}px ${FONT_TEXT}`; }
        ty += lh;
      }
      x.fillStyle = SOFT; for (const t of sum) { put(t, cx + tx, ty); ty += lh; }
      lineHits.push({ x: cx - 14, y: yTop, w: cw + 14, h: item.h - Math.round(lh * 0.4), e: it.e, i: it.i });
    } else {
      const { c, tl } = item, col = c.chk ? STATUS_NIGHT[c.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[c.v] || VERDICT_NIGHT.unresolvable;
      const da = a0 * edge(cy) * ent; if (da > 0.01) { x.globalAlpha = da; x.fillStyle = col; x.beginPath(); x.arc(cx + 4, cy - ls * 0.35 + rise, 3.5, 0, 6.283); x.fill(); }
      x.fillStyle = INK; x.font = `400 ${ls}px ${FONT_TEXT}`; let ty = cy;
      for (const t of tl) { put(t, cx + 16, ty); ty += lh; }
      const vw = capW(VERDICT_WORD[c.v] || c.v), ay = ty - Math.round(lh * 0.22); x.fillStyle = col; x.font = `500 ${ys}px ${FONT_TEXT}`; put(vw, cx + 16, ay); const vwW = x.measureText(vw).width;
      x.fillStyle = SOFT; x.font = `400 ${ys}px ${FONT_TEXT}`; put(ell(x, `${c.by ? ` by ${c.by}` : ''} · ${c.who}`, cw - 16 - vwW), cx + 16 + vwW, ay);
      if (c.id) lineHits.push({ x: cx - 4, y: yTop, w: cw, h: item.h - 6, pred: c.id });
    }
    cy += item.h;
  }
  x.globalAlpha = a0;
  return cy;
}
// the phone's rows: a title with its year (stage 6)
function drawRows(x, F, cx, cy, cw, P, yearCol, events, cl, floor, ink, ceil = -1e9) {
  const ls = P.line, ys = P.year, lh = Math.round(ls * 1.55), a0 = textA * linesA * FIELD_INK * ink, oneYear = F.y0 === F.y1;
  x.globalAlpha = a0;
  for (const it of events) {
    if (cy > floor) { cy += lh; continue; }
    x.fillStyle = INK; x.font = `400 ${ls}px ${FONT_TEXT}`; const t = ell(x, it.e.title_short, cw - (oneYear ? 16 : 60)); x.fillText(t, cx, cy); const tw = x.measureText(t).width;
    let yw = 0; if (!oneYear) { x.fillStyle = yearCol; x.font = `500 ${ys}px ${FONT_TEXT}`; const yl = fmtYear(it.e.year); yw = x.measureText(yl).width; x.fillText(yl, cx + tw + 10, cy); }
    lineHits.push({ x: cx - 14, y: cy - ls, w: tw + yw + 28, h: lh, e: it.e, i: it.i });
    cy += lh;
  }
  if (F.claims.length && cl.length) {
    cy += Math.round(lh * 0.5);
    F.claims.forEach((c, ci) => {
      const tl = cl[ci]; if (!tl) return;
      const hgt = tl.length * lh + Math.round(lh * 0.95);
      if (cy > floor) { cy += hgt; return; }
      const col = c.chk ? STATUS_NIGHT[c.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[c.v] || VERDICT_NIGHT.unresolvable, y0 = cy;
      x.fillStyle = col; x.beginPath(); x.arc(cx + 4, cy - ls * 0.35, 3.5, 0, 6.283); x.fill();
      x.fillStyle = INK; x.font = `400 ${ls}px ${FONT_TEXT}`;
      for (const t of tl) { x.fillText(t, cx + 16, cy); cy += lh; }
      const vw = capW(VERDICT_WORD[c.v] || c.v), ay = cy - Math.round(lh * 0.22); x.fillStyle = col; x.font = `500 ${ys}px ${FONT_TEXT}`; x.fillText(vw, cx + 16, ay); const vwW = x.measureText(vw).width;
      x.fillStyle = SOFT; x.font = `400 ${ys}px ${FONT_TEXT}`; x.fillText(ell(x, `${c.by ? ` by ${c.by}` : ''} · ${c.who}`, cw - 16 - vwW), cx + 16 + vwW, ay);
      cy += Math.round(lh * 0.95);
      if (c.id) lineHits.push({ x: cx - 4, y: y0 - ls, w: cw, h: cy - y0 - 4, pred: c.id });
    });
  }
  return cy;
}

// ---------- the overlay: the field, the year in hand, its count, the word that pulls back, the strip, the rings ----------
// the big year: its size, baseline and edge. The desk sets it flush right at the foot; the phone flush left under the strip, at the head of the band
const readoutAt = (P, Wf) => (P.vert ? { YS: P.readout, YB: BAND.y0 + HEAD_H() - 8, YR: BAND.x0, left: true } : { YS: Wf < W ? Math.round(P.readout * 0.8) : P.readout, YB: H - 56, YR: Wf - 56, left: false });
const freeW = () => (state.sel && W > 760 && H <= W ? W - Math.min(440, W) : W);
const stripFor = (P, Wf) => (P.vert ? { x0: BAND.x0, x1: BAND.x1, y: BAND.y0, every: 500, bh: clamp(BAND.y0 - 34, 18, 110) } : { x0: 64, x1: Wf - 64 - 330, y: H - 66, every: 200, bh: 28 });
// ---------- stage 4b: the decade in hand's dated claims as leaps ----------
// A leap is an arc along the coil from the year a claim was said to the year it named, lifted 0.04R plus an apex up to
// 0.5R, in the verdict hue, landing on a dot with the verdict word beside it. Only the decade in hand's leaps draw; they
// trace in over 600ms when the decade comes in hand, with a little dispersion on the stroke only while tracing.
// Pulled back, every dated claim is a 1px ghost leap. Undated claims never sit on the coil; they live in the field.
function leapsOf() {
  if (leaps) return leaps;
  if (!db.predictions || !db.predictions.length) return [];
  return (leaps = db.predictions.filter((c) => c.predicted_for && c.predicted_for !== c.year_made)
    .map((c) => ({ c, y0: c.year_made + 0.5, y1: c.predicted_for, lane: (laneIx[c.domain] ?? 6) - 6, v: c.outcome })).sort((a, b) => a.y0 - b.y0));
}
// a leap's colour and word: a claim checked against the record (chk, from tools/apply_forecast_check.py) wears its check
const leapCol = (l) => (l.c && l.c.chk ? STATUS_NIGHT[l.c.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[l.v] || VERDICT_NIGHT.unresolvable);
const leapWord = (l) => (l.c && l.c.chk ? STATUS_WORD[l.c.chk.s] || STATUS_WORD.unresolvable : VERDICT_WORD[l.v] || VERDICT_WORD.unresolvable);
// stage 5: the ten diffusion series as dashed leaps from the invention's year to the year half of American homes had it
function difOf() {
  if (difLeaps) return difLeaps;
  if (!db.diffusion || !db.diffusion.length) return [];
  return (difLeaps = db.diffusion.filter((s) => s.leap !== false && s.half_year && s.invention && s.invention.year && s.half_year > s.invention.year)
    .map((s) => ({ s, y0: s.invention.year + 0.5, y1: s.half_year, lane: (laneIx[s.lane] ?? 6) - 6 })));
}
const DIF_COL = 'rgba(174,182,220,0.55)', DIF_DASH = [3, 4];
const leapO = new Float32Array(3);
function arcPts(V, y0, y1, lane, apex) {
  y0 = slx(y0); y1 = slx(y1); // the arc runs in slot space, so it follows the coil whatever the pitch
  const n = Math.max(8, Math.min(80, Math.round(Math.abs(y1 - y0) * 1.5))), pts = new Float32Array((n + 1) * 2);
  let dmin = 1e9;
  for (let i = 0; i <= n; i++) {
    const t = i / n; coilRel(y0 + (y1 - y0) * t, lane, 0.04 + apex * Math.sin(Math.PI * t), leapO, 0);
    const p = projR(V, leapO[0], leapO[1], leapO[2]); if (!p.d) return null;
    pts[i * 2] = p.sx; pts[i * 2 + 1] = p.sy; if (p.d < dmin) dmin = p.d;
  }
  return { pts, n, dmin };
}
// stage 6: the connections of the events in hand, as 1px arcs along the coil between the two cells (lane to lane, year to year)
function arcPts2(V, y0, l0, y1, l1, apex) {
  y0 = slx(y0); y1 = slx(y1);
  const n = Math.max(8, Math.min(80, Math.round(Math.max(Math.abs(y1 - y0) * 1.5, Math.abs(l1 - l0) * 3)))), pts = new Float32Array((n + 1) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n; coilRel(y0 + (y1 - y0) * t, l0 + (l1 - l0) * t, 0.04 + apex * Math.sin(Math.PI * t), leapO, 0);
    const p = projR(V, leapO[0], leapO[1], leapO[2]); if (!p.d) return null;
    pts[i * 2] = p.sx; pts[i * 2 + 1] = p.sy;
  }
  return { pts, n };
}
const CONN_CAP = 24, CONN_A = 0.35, CONN_LIT = 0.7, CONN_DIM = 0.15;
let conn = null;
function connOf(P) {
  const F = buildField(P), key = `${F.key}|${F.events.length}|${G.key}`;
  if (conn && conn.key === key) return conn;
  const arcs = [], seen = new Set();
  for (const it of F.events) { // the field's order: weightiest first
    const e = it.e, ids = (e.connects || []).concat(db.in ? db.in.get(e.id) || [] : []);
    const others = ids.map((id) => db.byId.get(id)).filter(Boolean).sort((a, b) => (b.significance || 0) - (a.significance || 0));
    for (const o of others) {
      const j = indexOf(o.id); if (j < 0 || j === it.i) continue;
      const k = it.i < j ? `${it.i}:${j}` : `${j}:${it.i}`; if (seen.has(k)) continue; seen.add(k);
      arcs.push({ i: it.i, j, y0: e.year + 0.5, l0: (laneIx[e.domain] ?? 6) - 6, y1: o.year + 0.5, l1: (laneIx[o.domain] ?? 6) - 6 });
    }
    if (arcs.length >= CONN_CAP) break;
  }
  conn = { key, arcs: arcs.slice(0, CONN_CAP), lift: new Set(arcs.slice(0, CONN_CAP).map((a) => a.j)) };
  return conn;
}
// the lit event: a field line under the pointer, or the open record when it is in hand
function connLitI() { if (hover && hover.i != null) return hover.i; if (state.sel) { const i = indexOf(state.sel); if (i >= 0) return i; } return -1; }
function drawConns(x, V, P, pos) {
  if (!pos || cam.zoom > 0.02 || linesA <= 0 || textA <= 0 || !G) return;
  const C = connOf(P); if (!C.arcs.length) return;
  const litI = connLitI(), anyLit = litI >= 0 && C.arcs.some((a) => a.i === litI || a.j === litI), base = linesA * textA;
  if (!anyLit) return; // stage 9: nothing at rest; a record's connections draw while it is under the pointer or open
  x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 1; x.strokeStyle = INK; x.setLineDash([]);
  for (const a of C.arcs) {
    const lit = a.i === litI || a.j === litI, dy = Math.abs(a.y1 - a.y0);
    if (!lit) continue;
    if (dy < 0.5 && a.l0 === a.l1) continue;
    const g = arcPts2(V, a.y0, a.l0, a.y1, a.l1, Math.min(0.5, 0.08 + dy / 120)); if (!g) continue;
    x.globalAlpha = (anyLit ? (lit ? CONN_LIT : CONN_DIM) : CONN_A) * base; strokePts(x, g.pts, g.n);
  }
  // the connected cell lifts one palette step while its arc shows
  for (const j of C.lift) {
    if (!cellOn[j]) continue;
    if (!C.arcs.some((a) => (a.i === litI && a.j === j) || (a.j === litI && a.i === j))) continue;
    const q = j * 8, cx = cellSX[j], cy = cellSY[j], near = nearOf(V, cellD[j]), sIdx = near > 0.45 ? 0 : near > 0.15 ? 1 : 2, e = db.events[j];
    const inHand = e.year >= decadeOf(cam.year) && e.year <= decadeEnd(cam.year), scale = inHand ? 1.15 : 1;
    let ux = cellQ[q + 2] - cellQ[q], uy = cellQ[q + 3] - cellQ[q + 1], vx = cellQ[q + 6] - cellQ[q], vy = cellQ[q + 7] - cellQ[q + 1];
    const lu = Math.hypot(ux, uy) * scale, lv = Math.hypot(vx, vy) * scale, hu = Math.max(0.35, lu - 1) / 2 / (lu / scale || 1), hv = Math.max(0.35, lv - 1) / 2 / (lv / scale || 1);
    ux *= hu; uy *= hu; vx *= hv; vy *= hv;
    const lit = anyLit && C.arcs.some((a) => a.j === j && (a.i === litI || a.j === litI));
    x.globalAlpha = (anyLit && !lit ? 0.5 : 1) * base; const ck = (G.cellYear[j] * 3 + (TONE[G.cellLane[j]] ?? 0)) * 3; if (!COLS[ck]) continue; x.fillStyle = G.cellMoment[j] || sIdx === 0 ? mix(COLS[ck], INK, 0.3) : COLS[ck + sIdx - 1]; // one step up: brighter by depth, or lifted toward the ink when already full
    x.beginPath(); x.moveTo(cx - ux - vx, cy - uy - vy); x.lineTo(cx + ux - vx, cy + uy - vy); x.lineTo(cx + ux + vx, cy + uy + vy); x.lineTo(cx - ux + vx, cy - uy + vy); x.closePath(); x.fill();
  }
  x.globalAlpha = 1;
}
// stage 7: the event in reference (a field line under the pointer, or the open record) shows its picture at 1.6 with the halo,
// and gathers its context beside it: pictured connections nearest in year, filled from the decade when fewer than two, each tied to its cell
function refIdNow() {
  if (cam.zoom > 0.02 || !picOfEvent) return null;
  if (hover && hover.line && hover.i != null) return db.events[hover.i].id;
  if (state.sel && picOfEvent.has(state.sel)) return state.sel;
  return null;
}
function buildRef(id, P) {
  const e = db.byId.get(id), k = picOfEvent.get(id); if (!e || k == null) return null;
  const cap = P.vert ? 3 : 5, seen = new Set([id]), byDy = (a, b) => Math.abs(a.year - e.year) - Math.abs(b.year - e.year) || (b.significance || 0) - (a.significance || 0);
  let ctx = (e.connects || []).concat(db.in ? db.in.get(id) || [] : []).filter((x) => picOfEvent.has(x) && !seen.has(x) && seen.add(x)).map((x) => db.byId.get(x)).sort(byDy).slice(0, cap);
  if (ctx.length < 2) { const dec = decadeOf(e.year); ctx = ctx.concat(G.picList.map((it) => it.e).filter((o) => !seen.has(o.id) && decadeOf(o.year) === dec && seen.add(o.id)).sort(byDy).slice(0, cap - ctx.length)); }
  return { id, k, i: indexOf(id), sats: ctx.map((o) => ({ e: o, k: picOfEvent.get(o.id), i: indexOf(o.id) })) };
}
function drawRef(x, V, P, pos, Wf) {
  satHits.length = 0; refBox = null;
  const id = refIdNow(), now = performance.now(), step = refT && !reduced() ? Math.min(0.5, (now - refT) / REF_MS) : 1; refT = now; refAnim = false;
  if (id && (!ref || ref.id !== id)) { const r = buildRef(id, P); if (r) { ref = r; if (refA <= 0) refA = 0.001; } }
  const target = id && ref && ref.id === id ? 1 : 0;
  if (refA !== target) { refA = refA < target ? Math.min(target, refA + step) : Math.max(target, refA - step); if (refA !== target) refAnim = true; }
  if (!ref || refA <= 0) { ref = null; refA = 0; return; }
  const k = ref.k; if (!picOn[k] || (P.vert && sheetI(P) >= 0)) return; // on the phone the sheet carries the open record: its mark stays as drawn
  const it = G.picList[k], ease = refA * (2 - refA), S = lerp(picPX[k], P.picMax * REF_MUL, ease), w = S, h = S / (it.a || 1), cx = picSX[k], cy = picSY[k];
  // the context first, so the lit picture sits over its threads: thumbs on a short arc on the open side, 12px apart
  const sat = P.vert ? 40 : 48, R = Math.max(w, h) / 2 + SAT_GAP + sat / 2, dth = (sat + SAT_GAP) / R;
  const th0 = P.vert ? -Math.PI / 2 : pos ? (pos.cx > cx ? Math.PI : 0) : cx > Wf / 2 ? Math.PI : 0; // the open side: away from the field column, or from an open drawer
  const bad = (sx, sy) => sx - sat / 2 < 4 || sx + sat / 2 > Wf - 4 || sy - sat / 2 < 4 || sy + sat / 2 > H - 60 || (P.vert ? sy - sat / 2 < picCeil() : pos && sx + sat / 2 > pos.cx - 20);
  x.lineWidth = 1; x.strokeStyle = SOFT; x.setLineDash([]);
  let j = 0, tries = 0;
  for (const st of ref.sats) {
    let sx = 0, sy = 0, ok = false;
    while (tries < 14) { const off = j === 0 ? 0 : (j % 2 ? (j + 1) / 2 : -j / 2), th = th0 + off * dth; j++; tries++; sx = cx + Math.cos(th) * R; sy = cy + Math.sin(th) * R; if (!bad(sx, sy)) { ok = true; break; } }
    if (!ok) break;
    const sit = G.picList[st.k], sw = sat, sh = sat / (sit.a || 1), r = Math.max(sw, sh) / 2;
    if (st.i >= 0 && cellOn[st.i]) { // the thread to its own cell, started at the thumb's rim
      const dx = cellSX[st.i] - sx, dy = cellSY[st.i] - sy, l = Math.hypot(dx, dy) || 1;
      if (l > r + 2) { x.globalAlpha = 0.22 * ease; x.beginPath(); x.moveTo(sx + dx / l * r, sy + dy / l * r); x.lineTo(cellSX[st.i], cellSY[st.i]); x.stroke(); }
    }
    x.globalAlpha = ease; drawPic(x, sit, sx, sy, sw, sh);
    satHits.push({ x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh, e: st.e, i: st.i });
  }
  halo(x, cx, cy, Math.max(w, h) / 2, it.e.year, ease);
  x.globalAlpha = 1; drawPic(x, it, cx, cy, w, h); refBox = { id: ref.id, cx, cy, w, h };
  satHits.push({ x: cx - w / 2, y: cy - h / 2, w, h, e: it.e, i: ref.i });
  x.globalAlpha = 1;
}
// ---------- the phone's record in reading ----------
// One record is always chosen and read on a short plate tied to its mark: its date, its name as the phone's sheet prints it, whole,
// and its opening sentence, three lines at most. A sentence never ends cut: one that runs past its lines ends at its last
// clause that stands alone, and where none does the plate carries the date and the name. By rule the record is the newest of the
// unit in hand's highlights (data/highlights.json, at most five a unit), so the plate follows travel. A press on any record's mark reads that record here instead; a press on the plate, or a second on the same
// mark, opens its sheet. The plate keeps one seat at the band's foot, and stands over a mark that lies under that seat.
let readSel = null, readPlate = null, readId = '', readT0 = 0, readBox = '', readMoved = false, readA0 = 0; const readLay = new Map();
const READ = { pad: 9, date: 17, name: 22, line: 19, fs: 14, ground: 'rgba(7,9,28,0.84)', wide: 320, most: 10 }; // wide: the seat width (a 390 screen's) from which a long opening sentence may take up to `most` lines
function readPick(pos) {
  const key = unitOf(settling ? T1 : cam.year).key;
  if (readSel && (readSel.unit !== key || !cellOn[readSel.i])) readSel = null;
  if (readSel) return { e: db.events[readSel.i], i: readSel.i };
  let best = null, bk = -Infinity, any = null, ak = -Infinity; if (!pos) return null;
  for (const it of pos.F.feed) { // newest first by date; a highlight whose mark stands in view outranks one hidden under the header or the future's name
    const e = it.e, k = e.year * 1000 + (+e.month || 0) * 32 + (+e.day || 0); if (e.year < pos.F.y0 || e.year > pos.F.y1) continue; // a highlight filed under a unit its year has left is never read as that unit's record
    if (k > ak) { ak = k; any = it; }
    const pk = picOfEvent && picOfEvent.has(e.id) ? picOfEvent.get(e.id) : -1, pic = pk >= 0 && picOn[pk]; if (!pic && !cellOn[it.i]) continue;
    const mx = pic ? picSX[pk] : cellSX[it.i], my = pic ? picSY[pk] : cellSY[it.i];
    if (mx < BAND.x0 || mx > BAND.x1 || my < skyTop() + 6 || my > BAND.y1) continue;
    if (fcHead && cam.year >= FC_FROM && mx > fcHead.x - 8 && mx < fcHead.x + fcHead.w + 8 && my > fcHead.y - 8 && my < fcHead.y + fcHead.h + 8) continue;
    if (k > bk) { bk = k; best = it; }
  }
  return best || any;
}
// where a sentence may end early: a semicolon or colon, a comma that opens a clause or an aside, or a word that opens a clause of time or cause.
// What stands before must run to 30 letters, close every bracket and quotation it opened and end on a word that can end a sentence. Past a comma
// or a clause word its last stretch must hold a verb of its own (a past form that is not a describing word, so a list or a name with its aside is
// never left standing as a sentence), and an aside that closes on a comma and a verb is the sentence's subject still
const CLAUSE_AT = /(?:[;:]\s|,\s+(?=(?:which|who|whose|where|while|when|although|though|but|and|so|yet|then|later|with|a|an|the|its|his|her|their|about|far|often|now|still|each|some|[a-z]{3,}ing|[a-z]{3,}ed|cut|built|made|led|run|known|written|drawn|sold|held|set|sent|found)\b)|\s(?=(?:until|after|before|because|when|while|whereas|although|once)\s))/g;
const VERB_IRR = /\b(?:is|are|was|were|has|had|began|became|built|made|took|found|gave|ran|led|set|put|sent|won|lost|held|kept|left|wrote|drew|flew|grew|rose|fell|sold|bought|brought|went|came|saw|did|got|struck|spread|broke|met|paid|laid|stood|told|chose|cut|hit|read|shut|sank|drove|spoke|bore|cast|dug|fed|hung|lit|rang|sang|shot|spun|swept|taught|threw|wove)\b/;
const VERBISH = /\b(?:[a-z]{2,}ed|[a-z]{3,}[^s]s)\b/, DESCRIBES = /(?:-|\b(?:a|an|the|its|his|her|their|of|in|on|with|by|and|or|from|for|as|than)\s)$/;
const hasVerb = (t) => { if (VERB_IRR.test(t)) return true; const re = /\b[a-z]{2,}ed\b/g; let m; while ((m = re.exec(t))) if (!DESCRIBES.test(t.slice(0, m.index))) return true; return false; };
const HANGS = /(?:\b(?:shortly|soon|long|just|even|only|ever|well|and|or|but|than|not|named|years?|months?|weeks?|days?|decades?|centur(?:y|ies)|the|a|an|of|to|in|on|at|by|for|from|with|was|were|is|are|had|has)|[,(\u201c"-])$/;
const clauseHeads = (s) => { const out = []; let m; CLAUSE_AT.lastIndex = 0;
  while ((m = CLAUSE_AT.exec(s))) { const h = s.slice(0, m.index), rest = s.slice(m.index + m[0].length), n = (re) => (h.match(re) || []).length, hard = /[;:]/.test(m[0][0]);
    if (h.length < 30 || HANGS.test(h) || n(/\(/g) !== n(/\)/g) || n(/\u201c/g) !== n(/\u201d/g) || n(/"/g) % 2) continue;
    if (hard) { if (!hasVerb(h) && !VERBISH.test(h)) continue; }
    else { const last = h.slice(Math.max(h.lastIndexOf(','), h.lastIndexOf(';'), h.lastIndexOf(':')) + 1); if (!hasVerb(last) || (m[0][0] !== ',' && (last.length < 30 || /(?:ed|made|built|held|kept|left|taken|sent|found|begun|written|drawn|known|seen|set|put)$/.test(h)))) continue;
      if (m[0][0] === ',') { const c = /,\s+([a-z]+)/.exec(rest); if (c && (hasVerb(c[1]) || VERBISH.test(c[1])) && !/ing$/.test(c[1])) continue; } }
    out.push(`${h}.`); }
  return out.reverse(); };
// a plate's words for a seat iw wide with room for n sentence lines: end is 'whole', 'clause' or 'none'. A sentence that needs more than
// n lines takes up to m where the band has them (m > n at 390 and wider), whole first and then its longest standalone clause, so a long
// opening sentence is read on the plate and never cut
function readLayout(x, it, iw, n = 3, m = n) {
  const k = `${it.e.id}|${iw}|${n}|${m}|${it.e.summary ? 1 : 0}|${fontsV}`; let L = readLay.get(k); if (L) return L;
  x.font = `500 16px ${FONT_TEXT}`; let name = wrapT(x, it.e.title_short || it.e.title, iw); if (name.length > 3) { name = name.slice(0, 3); name[2] = ell(x, `${name[2]}…`, iw); }
  x.font = `400 ${READ.fs}px ${FONT_TEXT}`; let lines = [], end = 'none';
  if (it.e.summary && n > 0) { const s = firstSentence(it.e.summary, true), w = wrapT(x, s, iw);
    if (w.length <= n) { lines = w; end = 'whole'; } else { const heads = clauseHeads(s).map((h) => wrapT(x, h, iw));
      for (const c of heads) if (c.length <= n) { lines = c; end = 'clause'; break; }
      if (end === 'none' && m > n) { if (w.length <= m) { lines = w; end = 'whole'; } else for (const c of heads) if (c.length <= m) { lines = c; end = 'clause'; break; } } } }
  L = { name, lines, end, date: fmtDate(it.e) }; if (readLay.size > 200) readLay.clear(); readLay.set(k, L); return L;
}
// where the plate stands this frame, before the labels are seated around it
function seatRead(x, P, pos) {
  const home = !!ride && ride.coast && Math.abs(ride.s1 - cam.s) < 1.5 && unitOf(cam.year).key === unitOf(yearOfSlotF(ride.s1)).key; // a coast's last stretch, inside the unit it ends in
  const still = resting || (!ride && cam.s === cam.ts && cam.vel === 0); // at its seat, though the breath may still be easing home
  const it = (still || home) && !(hinting && !tookWheel) && cam.zoom < 0.02 && shA <= 0 && textA > 0 && db.loaded.has('highlights') && (cam.year < FC_FROM || !!forecasts) ? readPick(pos) : null; let out = null; // the plate lands once: after the highlights are in, and near the present after the future's name has taken its ground
  if (it) {
    const x0 = BAND.x0, w = BAND.x1 - BAND.x0, k = picOfEvent && picOfEvent.has(it.e.id) ? picOfEvent.get(it.e.id) : -1, pic = k >= 0 && picOn[k];
    const mx = pic ? picSX[k] : cellSX[it.i], my = pic ? picSY[k] : cellSY[it.i], hh = pic ? picPX[k] / (G.picList[k].a || 1) / 2 : Math.max(cellPX[it.i] * 0.7, 8), hw = pic ? picPX[k] / 2 : hh;
    let top = skyTop() + 2; for (const t of rootTags) top = Math.max(top, t.b.y1 + 8); // among the roots the lineages' names keep their column
    if (fcHead) top = Math.max(top, fcHead.y + fcHead.h + 6); // and the future's name keeps its ground: the sentence gives up a line before the plate stands on it
    const nl = readLayout(x, it, w - 24, 0).name.length, short = READ.pad * 2 + READ.date + READ.name * nl, room = BAND.y1 - top - short; // the sentence takes the lines the band has left under the name
    if (room >= 0) {
      const fit = Math.floor(room / READ.line), L = readLayout(x, it, w - 24, Math.min(3, fit), w - 24 >= READ.wide ? Math.min(READ.most, fit) : Math.min(3, fit)), h = short + READ.line * L.lines.length; let y0 = BAND.y1 - h;
      if (my + hh > y0 - 6 && my - hh < y0 + h + 6 && my - hh - 16 - h >= top) y0 = Math.round(my - hh - 16 - h); // the mark lies under the seat: the plate stands over it instead
      out = { x: x0, y: y0, w, h, e: it.e, i: it.i, L, mx, my, hw, hh, pic, on: cellOn[it.i] || pic, top, fit };
    }
  }
  const bk = out ? `${out.y}|${out.h}|${Math.round(out.mx)}|${Math.round(out.my)}` : '';
  if (bk !== readBox) { readBox = bk; readMoved = true; schedule(); } // the coil's own years step aside for the plate
  const id = out ? out.e.id : ''; if (id !== readId) { readId = id; readT0 = performance.now(); readA0 = 0; } // the plate stands down while the coil travels and comes back in when the view rests, so travel runs clear
  return (readPlate = out);
}
function paintRead(x, P) {
  const r = readPlate; if (!r) return;
  const a = reduced() ? 1 : readA0 + (1 - readA0) * easeOut(clamp((performance.now() - readT0) / EASE_MS, 0, 1)); if (a < 1) schedule();
  const above = r.my < r.y, lx = clamp(r.mx, r.x + 14, r.x + r.w - 14), ly = above ? r.y : r.y + r.h, ey = above ? r.my + r.hh : r.my - r.hh;
  if (r.on && (above ? ey < ly : ey > ly)) { // the tie: from the plate's edge to the mark, the mark ringed
    x.strokeStyle = INK; x.lineWidth = 1.5; x.globalAlpha = 0.85 * a * textA; x.beginPath(); x.moveTo(lx, ly); x.lineTo(r.pic ? clamp(lx, r.mx - r.hw, r.mx + r.hw) : r.mx, ey); x.stroke();
    x.globalAlpha = 0.95 * a * textA; x.beginPath(); if (r.pic) x.rect(r.mx - r.hw - 1.5, r.my - r.hh - 1.5, r.hw * 2 + 3, r.hh * 2 + 3); else x.arc(r.mx, r.my, r.hh, 0, 6.283); x.stroke();
  }
  x.globalAlpha = a * textA; x.fillStyle = READ.ground; x.beginPath(); if (x.roundRect) x.roundRect(r.x, r.y, r.w, r.h, 8); else x.rect(r.x, r.y, r.w, r.h); x.fill(); // ground and words come in together: no empty plate stands on the coil
  const tx = r.x + 12; let ty = r.y + READ.pad; x.textAlign = 'left'; x.textBaseline = 'top'; x.globalAlpha = a * textA;
  x.fillStyle = typeOf(r.e.year); x.beginPath(); x.arc(tx + 4, ty + 8, 3.6, 0, 6.283); x.fill();
  x.fillStyle = INK; x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillText(r.L.date, tx + 14, ty); ty += READ.date; // the date in the decade marks' numerals
  x.font = `500 16px ${FONT_TEXT}`; for (const ln of r.L.name) { x.fillText(ln, tx, ty + 1); ty += READ.name; }
  x.font = `400 ${READ.fs}px ${FONT_TEXT}`; for (const ln of r.L.lines) { x.fillText(ln, tx, ty + 1); ty += READ.line; }
  x.globalAlpha = 1; x.textBaseline = 'alphabetic';
}
function drawMarkers(x, V, P, pos, Wf) {
  mkHits.length = 0; mkShown = 0;
  const rd = P.vert && G && cellOn ? seatRead(x, P, pos) : (readPlate = null);
  if (!G || !G.mk.length || cam.zoom >= 0.5 || textA <= 0 || (P.vert && shA > 0.5)) { mkAnim = false; return; } // nor under the phone's open sheet
  const now = performance.now(), step = mkT ? Math.min(0.5, (now - mkT) / PIC_EASE_MS) : 1; mkT = now; mkAnim = false;
  const un = unitOf(cam.year), { YS, YB, YR } = readoutAt(P, Wf);
  x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.textAlign = 'center'; x.textBaseline = 'top';
  // the places a label may not cover: the decade labels in hand, the field column, the big year, the strip, the drawer, the stage edge
  const keep = labelRects(V);
  if (pos && !P.vert) keep.push({ x0: pos.cx - 20, y0: pos.cy - P.head - 10, x1: W, y1: H });
  if (P.vert) { keep.push({ x0: 0, y0: 0, x1: W, y1: BAND.y0 + HEAD_H() }); for (const o of phoneKeep) keep.push(o); if (rd) { keep.push({ x0: rd.x - 4, y0: rd.y - 6, x1: rd.x + rd.w + 4, y1: rd.y + rd.h + 6 }); if (rd.on) keep.push({ x0: rd.mx - rd.hw - 3, y0: rd.my - rd.hh - 3, x1: rd.mx + rd.hw + 3, y1: rd.my + rd.hh + 3 }); } } // the phone's header: the strip, its labels, the big year and its word; then the unit's name, the roots' names and caption
  else keep.push({ x0: YR - YS * 2.6, y0: YB - YS * 0.82 - 8, x1: Wf, y1: H }); // the big year and its word
  if (fcHead && cam.year >= FC_FROM) keep.push({ x0: fcHead.x - 6, y0: fcHead.y - 4, x1: fcHead.x + fcHead.w + 6, y1: fcHead.y + fcHead.h + 4 }); // the future's header keeps its ground
  if (strip && !P.vert) keep.push({ x0: 0, y0: strip.y - 22, x1: W, y1: H });
  const over = (b, o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0;
  // every drawn picture of 20px or more is an obstacle, the reference and its satellites too
  const obMin = P.vert && slf(cam.year) < R ? 40 : 20; // among the roots the phone's pictures crowd the band: a label's plate may cover a small one there
  const obst = []; for (let k = 0; k < picN; k++) if (picOn[k] && picPX[k] >= obMin) { const w = picPX[k], h = w / (G.picList[k].a || 1); obst.push({ k, x0: picSX[k] - w / 2, y0: picSY[k] - h / 2, x1: picSX[k] + w / 2, y1: picSY[k] + h / 2 }); }
  if (refBox) obst.push({ k: -1, x0: refBox.cx - refBox.w / 2, y0: refBox.cy - refBox.h / 2, x1: refBox.cx + refBox.w / 2, y1: refBox.cy + refBox.h / 2 });
  for (const t of satHits) obst.push({ k: -1, x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.h });
  for (const t of leapHits) obst.push({ k: -1, x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.h }); // the leaps' landings and their words
  // candidates: eased alpha toward the tier; beyond 15 years only the weightiest
  const cand = [];
  for (let m = 0; m < G.mk.length; m++) {
    const M = G.mk[m], dy = Math.abs(slf(M.e.year) - slf(cam.year)), inUnit = M.e.year >= un.y0 && M.e.year <= un.y1; if (rd && rd.e === M.e) { mkA[m] = 0; continue; } // the record in reading speaks on its plate
    const tier = inUnit ? 0 : dy <= 15 ? 1 : 2;
    const target = tier === 0 ? 0.9 : tier === 1 ? 0.75 : dy <= 50 && M.w >= 3 ? (P.vert ? 0.66 : 0.35) : 0, a = mkA[m]; // the phone's far tier holds 4.5 to 1
    if (a !== target) { mkA[m] = a < target ? Math.min(target, a + step) : Math.max(target, a - step); if (mkA[m] !== target) mkAnim = true; }
    if (mkA[m] <= 0.01) continue;
    let ax, ay, aw = 0, ah = 0, lift = 0, pic = false;
    if (M.k >= 0 && picOn[M.k]) { // anchored to its picture, the reference's grown picture included
      pic = true; const it = G.picList[M.k]; aw = picPX[M.k]; ah = aw / (it.a || 1); ax = picSX[M.k]; ay = picSY[M.k];
      if (refBox && refBox.id === M.e.id) { aw = refBox.w; ah = refBox.h; ax = refBox.cx; ay = refBox.cy; }
      lift = picMul[M.k] > 1.001 ? (picMul[M.k] - 1) / (UNIT_MUL - 1) : 0;
    } else { const p = projR(V, M.g[0], M.g[1], M.g[2]); if (!p.d || !onStage(p.sx, p.sy)) continue; ax = p.sx; ay = p.sy; }
    const yt = P.vert ? fmtYear(M.e.year) : '', yw = yt ? x.measureText(yt).width + 7 : 0; // the phone sets a highlight's own year before its name, in the decade marks' numerals and written as the plate and the record's sheet write it
    const axis = projR(V, M.g[0], 0, 0), tw = x.measureText(M.label).width + yw; let ux = 1, uy = 0; // outward from the coil's axis
    if (axis.d) { const dx = ax - axis.sx, dyy = ay - axis.sy, l = Math.hypot(dx, dyy); if (l > 1) { ux = dx / l; uy = dyy / l; } }
    cand.push({ M, m, ax, ay, aw, ah, ux, uy, tw, yt, yw, pic, lift, dy, a: mkA[m], e: target > 0 ? Math.min(1, mkA[m] / target) : mkA[m], inUnit, tier });
  }
  if (P.vert && pos && slf(cam.year) < R) { // among the roots the phone names the unit's highlights at their pictures, four at most
    let nF = 0;
    for (const it of pos.F.feed) {
      if (nF >= 4) break; if (cand.some((c) => c.M.e === it.e) || (rd && rd.e === it.e)) continue;
      const k = picOfEvent && picOfEvent.has(it.e.id) ? picOfEvent.get(it.e.id) : -1, label = it.e.title_short || it.e.title; let ax, ay, aw = 0, ah = 0, pic = false;
      if (k >= 0 && picOn[k]) { pic = true; aw = picPX[k]; ah = aw / (G.picList[k].a || 1); ax = picSX[k]; ay = picSY[k]; } else if (cellOn[it.i]) { ax = cellSX[it.i]; ay = cellSY[it.i]; } else continue;
      const yt = fmtYear(it.e.year), yw = x.measureText(yt).width + 7;
      cand.push({ M: { e: it.e, i: it.i, label, w: 3, k }, m: -1, ax, ay, aw, ah, ux: 1, uy: 0, tw: x.measureText(label).width + yw, yt, yw, pic, lift: 0, dy: 0, a: 0.9, e: 1, inUnit: true, tier: 0 }); nF++;
    }
  }
  cand.sort((p, q) => p.tier - q.tier || q.M.w - p.M.w || p.dy - q.dy);
  // placement: under the event's own picture, then above it, then the outer side away from the coil's axis, else dropped
  const placed = [], cap = P.vert ? MK_CAP_PHONE : MK_CAP;
  const box = (sx, sy, tw) => ({ x0: sx - tw / 2 - MK_PAD - 12, y0: sy - MK_PAD, x1: sx + tw / 2 + MK_PAD, y1: sy + MIN_TEXT + MK_PAD });
  if (P.vert) { // the phone: each label on its own night plate beside its mark, on the shortest thread that finds clear ground inside the
    // reading band: clear of pictures, years, other labels, their marks and their threads. What finds no seat waits for touch
    const top = skyTop() + 2, bx0 = BAND.x0, bx1 = BAND.x1, by1 = BAND.y1, h = TAG_H, REACH = 100;
    const inB = (qx, qy, o, g) => qx > o.x0 - g && qx < o.x1 + g && qy > o.y0 - g && qy < o.y1 + g;
    const segIn = (x0, y0, x1, y1, o, g) => { if ((x0 < x1 ? x1 : x0) <= o.x0 - g || (x0 < x1 ? x0 : x1) >= o.x1 + g || (y0 < y1 ? y1 : y0) <= o.y0 - g || (y0 < y1 ? y0 : y1) >= o.y1 + g) return false; const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6)); for (let t = 1; t < n; t++) if (inB(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n, o, g)) return true; return false; };
    const DEC_GAP = 12, free = (b, c, lx, ly, mx, my) => {
      for (const o of keep) if (over(b, o) || segIn(lx, ly, mx, my, o, 0)) return false;
      for (const d of decPl) if (b.x0 < d[2] + DEC_GAP && b.x1 > d[0] - DEC_GAP && b.y0 < d[3] + DEC_GAP && b.y1 > d[1] - DEC_GAP) return false; // 12 points of night between a label and any decade mark, so no label reads as dated by a coil behind it
      for (const o of placed) if ((b.x0 < o.b.x1 + 3 && b.x1 > o.b.x0 - 3 && b.y0 < o.b.y1 + 3 && b.y1 > o.b.y0 - 3) || inB(o.mx, o.my, b, 4) || segIn(o.lx, o.ly, o.mx, o.my, b, 2) || segIn(lx, ly, mx, my, o.b, 2)) return false;
      for (const o of obst) if (!(c.pic && o.k === c.M.k) && (over(b, o) || (o.x1 - o.x0 >= 30 && !inB(mx, my, o, 1) && segIn(lx, ly, mx, my, o, 0)))) return false; // no thread runs across a large picture either
      return true;
    };
    for (const c of cand) {
      if (placed.length >= cap) break;
      let mx = c.ax, my = c.ay; if (!c.pic && c.M.i >= 0 && cellOn[c.M.i]) { mx = cellSX[c.M.i]; my = cellSY[c.M.i]; } // the mark: the event's picture, else its cell
      if (mx < 6 || mx > W - 6 || my < top || my > by1 + 70) continue;
      if (!c.pic && ((c.tier && obst.some((o) => o.x1 - o.x0 >= 30 && inB(mx, my, o, 1))) || keep.some((o) => inB(mx, my, o, 1)))) continue; // a mark under a picture is out of view: its label waits
      const w = Math.ceil(c.tw) + 24, hw = c.pic ? c.aw / 2 : 0, hh = c.pic ? c.ah / 2 : 0; let best = null, bd = REACH;
      if (!c.pic) { const b = { x0: mx - 9, y0: my - h / 2, x1: mx - 9 + w, y1: my + h / 2 }; if (b.x0 >= bx0 && b.x1 <= bx1 && b.y0 >= top && b.y1 <= by1 && free(b, c, mx, my, mx, my)) { best = b; bd = 0; c.lx = mx; c.ly = my; } } // first choice: the label's own dot set on the mark, no thread
      if (!best)
      for (let y0 = top; y0 + h <= by1; y0 += 5) { // every seat in the band, the nearest clear one kept
        const ey = y0 > my + hh ? y0 - my - hh : y0 + h < my - hh ? my - hh - y0 - h : 0; if (ey >= bd) continue;
        for (let x0 = bx0, last = false; !last; x0 += 8) { if (x0 + w > bx1) { x0 = bx1 - w; last = true; if (x0 < bx0) break; } // the band's right edge is a seat too
          const ex = x0 > mx + hw ? x0 - mx - hw : x0 + w < mx - hw ? mx - hw - x0 - w : 0, d = Math.hypot(ex, ey); if (d >= bd || d < 7) continue;
          const b = { x0, y0, x1: x0 + w, y1: y0 + h }, lx = clamp(mx, x0 + 5, x0 + w - 5), ly = clamp(my, y0, y0 + h); if (!free(b, c, lx, ly, mx, my)) continue;
          best = b; bd = d; c.lx = lx; c.ly = ly;
        }
      }
      if (!best) continue;
      c.b = best; c.mx = c.pic ? clamp(c.lx, c.ax - hw, c.ax + hw) : mx; c.my = c.pic ? clamp(c.ly, c.ay - hh, c.ay + hh) : my; // the thread lands on the picture's near edge, or on the cell
      c.sx = best.x0 + 18 + c.tw / 2; c.sy = best.y0 + 3; placed.push(c);
    }
  } else for (const c of cand) {
    if (placed.length >= cap) break;
    const tries = [[c.ax, c.ay + c.ah / 2 + 6, true], [c.ax, c.ay - c.ah / 2 - 6 - MIN_TEXT, true]];
    const d0 = c.pic ? Math.hypot(c.aw, c.ah) / 2 + c.tw / 2 + 2 : c.tw / 2 + 6;
    for (let st = 0; st < 9; st++) tries.push([c.ax + c.ux * (d0 + st * 14), c.ay + c.uy * (d0 + st * 14) - MIN_TEXT / 2, false]);
    for (const [sx, sy, own] of tries) {
      const b = box(sx, sy, c.tw);
      if (b.x0 < 4 || b.x1 > Wf - 4 || b.y0 < 4) continue;
      if (keep.some((o) => over(b, o)) || placed.some((o) => over(b, o.b)) || obst.some((o) => !(own && c.pic && o.k === c.M.k) && over(b, o))) continue;
      c.sx = sx; c.sy = sy; c.b = b; placed.push(c); break;
    }
  }
  const hush = P.vert ? 1 - clamp(breath * 1.6, 0, 1) : 1; // the phone: highlights' names rest while the coil turns at speed, and return as it slows
  for (const c of placed) {
    const ref_ = refBox && refBox.id === c.M.e.id, ink = c.inUnit || ref_;
    x.globalAlpha = (ref_ ? 1 : c.a) * textA;
    if (P.vert) { // the phone: the thread from the plate's edge to the mark with a dot where it lands, then the plate, the year's dot and the words
      if (hush <= 0.02) continue;
      if (Math.hypot(c.lx - c.mx, c.ly - c.my) > 3) { x.strokeStyle = INK; x.lineWidth = 1; x.globalAlpha = 0.6 * c.e * hush * textA; x.beginPath(); x.moveTo(c.lx, c.ly); x.lineTo(c.mx, c.my); x.stroke(); x.fillStyle = INK; x.globalAlpha = 0.9 * c.e * hush * textA; x.beginPath(); x.arc(c.mx, c.my, 2, 0, 6.283); x.fill(); }
      plate(x, c.b.x0, c.b.y0, c.b.x1 - c.b.x0, c.b.y1 - c.b.y0, c.e * hush * textA); x.globalAlpha = (c.tier ? 0.85 : 0.95) * c.e * hush * textA; // every plate at full strength: the tiers differ in ink alone
      const tx0 = c.sx - c.tw / 2; x.textAlign = 'left'; x.fillStyle = INK; x.fillText(c.yt, tx0, c.sy); x.fillStyle = ink ? INK : SOFT; x.fillText(c.M.label, tx0 + c.yw, c.sy); x.textAlign = 'center';
      x.fillStyle = typeOf(c.M.e.year); x.beginPath(); x.arc(c.b.x0 + 9, c.sy + MIN_TEXT / 2 + 1, 3.2, 0, 6.283); x.fill();
      mkHits.push({ x: c.b.x0, y: c.b.y0, w: c.b.x1 - c.b.x0, h: c.b.y1 - c.b.y0, e: c.M.e, i: c.M.i, mark: [c.mx, c.my, c.pic ? 1 : 0] }); continue;
    } else
    if (!c.pic && c.M.i >= 0 && cellOn[c.M.i]) { // the tie to its cell: from the label's edge, a 3px dot at the cell end
      const cx = cellSX[c.M.i], cy = cellSY[c.M.i], lx = c.sx, ly = c.sy + MIN_TEXT / 2, dx = cx - lx, dy = cy - ly, l = Math.hypot(dx, dy) || 1;
      const ex = Math.min(Math.abs((c.b.x1 - c.b.x0) / 2 / (dx / l || 1e-6)), Math.abs((c.b.y1 - c.b.y0) / 2 / (dy / l || 1e-6)));
      if (l > ex + 4) { x.strokeStyle = SOFT; x.lineWidth = 1; x.globalAlpha = 0.22 * c.a * textA; x.beginPath(); x.moveTo(lx + dx / l * ex, ly + dy / l * ex); x.lineTo(cx, cy); x.stroke(); x.fillStyle = SOFT; x.beginPath(); x.arc(cx, cy, 1.5, 0, 6.283); x.fill(); x.globalAlpha = c.a * textA; }
    }
    x.shadowColor = 'rgba(6,8,26,0.6)'; x.shadowBlur = 3; x.fillStyle = ink ? INK : SOFT; x.fillText(c.M.label, c.sx, c.sy); x.shadowColor = 'transparent'; x.shadowBlur = 0;
    x.fillStyle = typeOf(c.M.e.year); x.beginPath(); x.arc(c.sx - c.tw / 2 - 8, c.sy + MIN_TEXT / 2 + 1, 3.2, 0, 6.283); x.fill(); // a dot in the year's blend: the label opens its record
    (c.line ? lineHits : mkHits).push({ x: c.b.x0, y: c.b.y0, w: c.b.x1 - c.b.x0, h: c.b.y1 - c.b.y0, e: c.M.e, i: c.M.i });
  }
  if (rd) paintRead(x, P);
  mkShown = mkHits.length; x.globalAlpha = 1; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
}
const litLeap = () => litForce || litHover || (state.sel && state.sel.startsWith('pred:') ? state.sel : null);
// a search for a name, or a person opened from the search, lights that person's leaps: claims and forecasts alike
function litNames() {
  const q = (state.q || '').trim().toLowerCase(), who = state.sel && state.sel.startsWith('who:') ? state.sel.slice(4).toLowerCase() : '';
  const key = `${q}|${who}|${forecasts ? forecasts.length : 0}|${db.predictions ? db.predictions.length : 0}`;
  if (key === litKey) return litSet;
  litKey = key; litSet = null;
  if (!q && !who) return null;
  const terms = q ? q.split(/\s+/) : [];
  const match = (name) => { const n = (name || '').toLowerCase(); if (!n) return false; if (who && n.includes(who)) return true; return terms.length > 0 && terms.every((t) => n.split(/[\s,]+/).some((w) => w.startsWith(t))); };
  litSet = new Set();
  for (const c of db.predictions || []) if (match(c.who)) litSet.add(c.id);
  for (const f of forecasts || []) if (match(f.who)) litSet.add(f.id);
  return litSet;
}
const isLit = (id, lit, set) => lit === id || (set != null && set.has(id));
// the filter: a search (state.q) or a thread (state.thread) marks its records on the coil, every loop, pulled back too
let matchKey = '', matchIdx = null, matchTxt = null;
function matchSet() {
  const q = (state.q || '').trim().toLowerCase(), th = state.thread || '';
  const key = `${q}|${th}|${db.events.length}`;
  if (key === matchKey) return matchIdx;
  matchKey = key; matchIdx = null;
  if (!q && !th) return null;
  if (!matchTxt || matchTxt.n !== db.events.length) { matchTxt = { n: db.events.length, t: db.events.map((e) => `${e.title} ${e.title_short || ''} ${e.summary || ''} ${(e.people || []).join(' ')} ${(e.orgs || []).join(' ')} ${(e.tags || []).join(' ')}`.toLowerCase()) }; }
  const terms = q ? q.split(/\s+/) : [];
  matchIdx = [];
  for (let i = 0; i < db.events.length; i++) { const e = db.events[i]; if (e.kind === 'overlay') continue; if (th && !(e.tags || []).includes(th)) continue; if (terms.length && !terms.every((t) => matchTxt.t[i].includes(t))) continue; matchIdx.push(i); }
  return matchIdx;
}
// the forecasts that leap from the year said onto the ghost thread: thin 1px leaps for the first 48 that land by 2040, marks for the rest
function fcLeapsOf() {
  if (fcLeaps) return fcLeaps;
  if (!forecasts) return [];
  let n = 0; const out = [], lane = (laneIx.ai ?? 6) - 6;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dated = forecasts.filter((f) => f.t && f.t > f.y0 && f.t <= T2), arcs = new Set(pickForecasts(dated.filter((f) => f.t <= FC_REACH), FC_CAP)); // the arcs: the weightiest, one speaker each first
  const perYear = new Map(); // the k-th forecast naming a year takes its own lane and place within the year, so the landings spread into a band instead of a stack
  for (const f of dated) {
    const k = perYear.get(f.t) || 0; perYear.set(f.t, k + 1);
    const ln = lane + ((k % 7) - 3) * 0.8, at = f.t + 0.08 + ((Math.floor(k / 7) % 6) * 0.14);
    if (arcs.has(f)) { n++; out.push({ f, kind: 'arc', y0: f.y0 + 0.5, y1: at, lane: ln, apex: Math.min(0.5, 0.1 + (f.t - f.y0) / 70), v: f.v }); }
    else out.push({ f, kind: 'mark', y: at, lane: ln, v: f.v });
  }
  return (fcLeaps = out);
}
function strokePts(x, pts, m, dx = 0) { x.beginPath(); x.moveTo(pts[0] + dx, pts[1]); for (let i = 1; i <= m; i++) x.lineTo(pts[i * 2] + dx, pts[i * 2 + 1]); x.stroke(); }
// stage 4c: dated AI forecasts leap from the year said onto the ghost thread; a lit one (hover, search, selection) is full
function drawForecasts(x, V, Y, lit, set) {
  if (Y < FC_FROM) return;
  ensureForecasts();
  const F = fcLeapsOf(); if (!F.length) return;
  const base = linesA * textA;
  for (const l of F) {
    const col = l.f.chk ? STATUS_NIGHT[l.f.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[l.v] || VERDICT_NIGHT.unresolvable, on = isLit(l.f.id, lit, set); // a forecast checked against the record wears its check
    if (l.kind === 'mark') {
      coilY(l.y, l.lane, 0.05, leapO, 0); const p = projR(V, leapO[0], leapO[1], leapO[2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
      x.fillStyle = col; x.globalAlpha = (on ? 1 : 0.85) * base; x.beginPath(); x.arc(p.sx, p.sy, on ? 4.2 : 3, 0, 6.283); x.fill();
      leapHits.push({ x: p.sx - 10, y: p.sy - 10, w: 20, h: 20, pred: l.f.id });
      continue;
    }
    if (!on) { // at rest a forecast is only its landing: a small dot on the ghost thread at the year it names, no arc
      coilY(l.y1, l.lane, 0.05, leapO, 0); const p = projR(V, leapO[0], leapO[1], leapO[2]); if (!p.d || !onStage(p.sx, p.sy)) continue;
      x.fillStyle = col; x.globalAlpha = 0.9 * base; x.beginPath(); x.arc(p.sx, p.sy, 3.4, 0, 6.283); x.fill();
      x.strokeStyle = CORE; x.lineWidth = 1; x.globalAlpha = 0.45 * base; x.beginPath(); x.arc(p.sx, p.sy, 6.5, 0, 6.283); x.stroke(); // a ring: the landing is a target that opens
      leapHits.push({ x: p.sx - 11, y: p.sy - 11, w: 22, h: 22, pred: l.f.id });
      continue;
    }
    const a = arcPts(V, l.y0, l.y1, l.lane, l.apex); if (!a) continue;
    x.strokeStyle = col; x.globalAlpha = base; x.lineWidth = LEAP_LIT_W; strokePts(x, a.pts, a.n);
    const ex = a.pts[a.n * 2], ey = a.pts[a.n * 2 + 1];
    x.fillStyle = col; x.beginPath(); x.arc(ex, ey, LEAP_DOT + 1, 0, 6.283); x.fill();
    leapHits.push({ x: ex - 11, y: ey - 11, w: 22, h: 22, pred: l.f.id });
  }
  x.globalAlpha = 1;
}
// a speaker's name short enough for a label on the coil: no parenthetical, one name of a list, and a cut at 30 letters
function shortWho(w, surname = false) {
  let t = String(w || 'Unnamed').replace(/\s*\(.*?\)/g, '').replace(/\s*via .*$/i, '').trim(), more = false;
  if (t.includes(',')) { t = t.split(',')[0].trim(); more = true; }
  else if ((surname || t.length > 30) && t.includes(' and ')) { t = t.split(' and ')[0].trim(); more = true; }
  if (surname) { const parts = t.split(/\s+/); if (parts.length > 1 && !/^(US|UK|The|General|Ford|IBM|RAND|Bell)$/i.test(parts[0])) t = parts[parts.length - 1]; } // the phone keeps the surname
  if (more) t += surname ? ' et al.' : ' and others';
  return t.length > 32 ? t.slice(0, 30).trim() + '…' : t;
}
function drawLeaps(x, V, P, pos, Wf = W) {
  leapHits.length = 0; tracing = false;
  const L = leapsOf(); if (!L.length) return;
  const Y = cam.year, Yd = decadeOf(clamp(Math.round(Y), Y_LO, T1)), pulled = cam.zoom > 0.5, now = performance.now();
  if (pulled) {
    // every dated claim as a 1px ghost leap
    x.lineWidth = 1; x.globalAlpha = 0.45 * textA;
    for (const l of L) { const yEnd = Math.min(l.y1, T1); if (yEnd <= l.y0) continue; const a = arcPts(V, l.y0, yEnd, l.lane, Math.min(0.5, 0.12 + (yEnd - l.y0) / 120)); if (!a) continue; x.strokeStyle = leapCol(l); strokePts(x, a.pts, a.n); }
    x.setLineDash(DIF_DASH); x.strokeStyle = SOFT; x.globalAlpha = 0.3 * textA; // and the ten diffusion leaps as dashed ghosts
    for (const l of difOf()) { const a = arcPts(V, l.y0, l.y1, l.lane, Math.min(0.5, 0.12 + (l.y1 - l.y0) / 120)); if (a) strokePts(x, a.pts, a.n); }
    x.setLineDash([]); x.globalAlpha = 1; return;
  }
  if (cam.zoom > 0.02 || linesA <= 0 || textA <= 0) { leapDec = null; return; }
  if (Yd !== leapDec) { leapDec = Yd; leapT0 = landing || leapWhole ? 0 : now; leapWhole = false; } // the decade came in hand: trace (drawn whole while the phone lands under the arrival's fade, or when its claims load late)
  const k = reduced() || landing ? 1 : clamp((now - leapT0) / TRACE_MS, 0, 1);
  if (k < 1) { tracing = true; schedule(); }
  const lit = litLeap(), set = litNames(), drawn = [];
  for (const l of L) {
    if (l.c.year_made < Yd || l.c.year_made >= Yd + 10) continue;
    // a leap that reaches past Y+30 leaves the frame as a stub; past 2026 it lands on the ghost thread (stage 4c)
    const ghost = Y >= GHOST_FROM, stub = l.y1 > Y + LEAP_REACH || (!ghost && l.y1 > T1), yEnd = stub ? Math.min(Y + LEAP_REACH, ghost ? T2 : T1) : l.y1;
    if (yEnd <= l.y0) continue;
    const isL = isLit(l.c.id, lit, set);
    if (!isL && (l.v === 'pending' || l.v === 'unresolvable')) continue; // stage 9: at rest only settled verdicts leap; the pale pending and unresolvable arcs wait to be pointed at
    const a = arcPts(V, l.y0, yEnd, l.lane, Math.min(0.5, 0.12 + (yEnd - l.y0) / 120)); if (!a) continue;
    drawn.push({ l, a, stub, lit: isL, ex: a.pts[a.n * 2], ey: a.pts[a.n * 2 + 1] });
  }
  drawForecasts(x, V, Y, lit, set);
  // the decade in hand's diffusion leaps: the invention or the half-way year falls in the decade
  const difs = [];
  for (const l of difOf()) {
    if (l.y1 < Yd || l.y1 >= Yd + 10) continue; // the half-way year falls in the decade; the arc shows where it came from
    const stub = l.y1 > Y + LEAP_REACH, yEnd = stub ? Y + LEAP_REACH : l.y1; if (yEnd <= l.y0) continue;
    const a = arcPts(V, l.y0, yEnd, l.lane, Math.min(0.5, 0.12 + (yEnd - l.y0) / 120)); if (!a) continue;
    const dl = litHover != null && litHover.split('|').includes(`dif:${l.s.id}`); if (!dl) continue; // the dashed diffusion arcs draw only while their series is pointed at
    difs.push({ l, a, stub, lit: dl, ex: a.pts[a.n * 2], ey: a.pts[a.n * 2 + 1] });
  }
  if (!drawn.length && !difs.length) return;
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (difs.length) {
    x.setLineDash(DIF_DASH);
    for (const d of difs) {
      const mm = Math.max(1, Math.round(k * d.a.n));
      x.strokeStyle = d.lit ? SOFT : DIF_COL; x.globalAlpha = linesA * textA; x.lineWidth = d.lit ? 2 : 1.5; strokePts(x, d.a.pts, mm);
      if (k >= 1 && !d.stub) { x.setLineDash([]); x.fillStyle = SOFT; x.beginPath(); x.arc(d.ex, d.ey, d.lit ? 4 : 3, 0, 6.283); x.fill(); x.setLineDash(DIF_DASH); leapHits.push({ x: d.ex - 9, y: d.ey - 9, w: 18, h: 18, dif: difs.filter((o) => o.l.y1 === d.l.y1).map((o) => o.l.s) }); }
    }
    x.setLineDash([]);
  }
  for (const d of drawn) {
    const col = leapCol(d.l), mm = Math.max(1, Math.round(k * d.a.n)), base = linesA * textA;
    if (k < 1) { // dispersion on the tracing stroke only: a 1 to 2px channel offset
      const off = 1 + (1 - k); x.globalCompositeOperation = 'lighter'; x.lineWidth = d.lit ? LEAP_LIT_W : LEAP_W; x.globalAlpha = 0.35 * base;
      x.strokeStyle = 'rgb(255,70,70)'; strokePts(x, d.a.pts, mm, -off); x.strokeStyle = 'rgb(70,110,255)'; strokePts(x, d.a.pts, mm, off);
      x.globalCompositeOperation = 'source-over';
    }
    if (d.lit && k >= 1) { x.globalCompositeOperation = 'lighter'; x.lineWidth = LEAP_LIT_W; x.globalAlpha = 0.28 * base; x.strokeStyle = 'rgb(255,70,70)'; strokePts(x, d.a.pts, mm, -1); x.strokeStyle = 'rgb(70,110,255)'; strokePts(x, d.a.pts, mm, 1); x.globalCompositeOperation = 'source-over'; }
    x.strokeStyle = col; x.globalAlpha = (d.lit ? 1 : 0.9) * base; x.lineWidth = d.lit ? LEAP_LIT_W : LEAP_W; strokePts(x, d.a.pts, mm);
    x.lineWidth = 1.5; x.beginPath(); x.arc(d.a.pts[0], d.a.pts[1], 3.5, 0, 6.283); x.stroke(); // a ring where it was said
    if (k >= 1 && !d.stub) { x.fillStyle = col; x.beginPath(); x.arc(d.ex, d.ey, d.lit ? LEAP_DOT + 1 : LEAP_DOT, 0, 6.283); x.fill(); leapHits.push({ x: d.ex - 9, y: d.ey - 9, w: 18, h: 18, pred: d.l.c.id }); }
  }
  // the verdict words: beside the landing dot, staggered 17px so none overlap; over four leaps only the lit one speaks
  const wk = clamp((k - 0.8) / 0.2, 0, 1); if (wk <= 0) { x.globalAlpha = 1; return; }
  let words = drawn.filter((d) => !d.stub).map((d) => ({ ...d, who: `${shortWho(d.l.c.who, P.vert)}, ${d.l.c.year_made}: `, txt: leapWord(d.l), col: leapCol(d.l), hit: { pred: d.l.c.id } }));
  if (drawn.length > (P.vert ? 5 : LEAP_MAX_WORDS)) words = words.filter((d) => d.lit);
  words.sort((a, b) => a.ey - b.ey); let last = -1e9;
  x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.textBaseline = 'middle';
  const cardTop = Infinity, stripTop = strip ? strip.y - 22 : Infinity; // on the phone a word never runs into the card or the strip
  for (const d of words) {
    const wy = Math.max(d.ey, last + WORD_STEP); if (wy + 9 > Math.min(cardTop, stripTop)) continue; last = wy;
    const ww = x.measureText(d.who).width, vw = x.measureText(d.txt).width, tw = ww + vw, right = d.ex + 10 + tw <= Wf - 8 || d.ex - 10 - tw < 8, tx = clamp(right ? d.ex + 10 : d.ex - 10 - tw, 8, Math.max(8, Wf - tw - 8)); // within the free stage, clear of the drawer
    x.globalAlpha = wk * linesA * textA * (d.lit ? 1 : 0.8); // every label reads; only the lit one is full
    if (Math.abs(wy - d.ey) > 1) { x.strokeStyle = 'rgba(238,240,250,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(d.ex + (right ? 4 : -4), d.ey); x.lineTo(d.ex + (right ? 8 : -8), wy); x.stroke(); }
    x.textAlign = 'left'; x.lineJoin = 'round'; x.strokeStyle = NIGHT; x.lineWidth = 4; // haloed in the night so it reads over the coil: the speaker and year in ink, the verdict in its color
    x.strokeText(d.who, tx, wy); x.fillStyle = INK; x.fillText(d.who, tx, wy);
    x.strokeText(d.txt, tx + ww, wy); x.fillStyle = d.col; x.fillText(d.txt, tx + ww, wy);
    leapHits.push({ x: tx - 2, y: wy - 9, w: tw + 4, h: 18, ...d.hit });
  }
  drawDifWords(x, P, pos, difs, wk);
  x.globalAlpha = 1; x.textAlign = 'left';
}
// the diffusion landings' words: one label per landing year (the tip names every series that landed), landings within
// three years stack 18px apart on one x, and a label that would cross the field's column or its heading flips left
function drawDifWords(x, P, pos, difs, wk) {
  const land = difs.filter((d) => !d.stub).sort((a, b) => a.l.y1 - b.l.y1 || a.ey - b.ey); if (!land.length) return;
  const groups = []; for (const d of land) { const g = groups[groups.length - 1]; if (g && g.year === d.l.y1) g.ds.push(d); else groups.push({ year: d.l.y1, ds: [d] }); }
  const fieldX = pos && !P.vert ? pos.cx - 12 : W + 1, headY = pos && P.vert ? [pos.cy - P.head, pos.cy + 4] : null;
  x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.textBaseline = 'middle';
  let cluster = null;
  for (const g of groups) {
    const d0 = g.ds[0], txt = `half of ${difWho(d0.l.s)}, ${g.year}`, tw = x.measureText(txt).width, lit = g.ds.some((d) => d.lit);
    if (cluster && slf(g.year) - slf(cluster.year) <= 3) { cluster.y += 18; cluster.year = g.year; } else cluster = { x: d0.ex, y: d0.ey, year: g.year, right: null };
    const wy = cluster.y, ax = cluster.x;
    let right = ax + 10 + tw <= W - 8 && ax + 10 + tw < fieldX; if (headY && wy > headY[0] && wy < headY[1]) right = false;
    if (cluster.right != null) right = cluster.right; else cluster.right = right;
    const tx = right ? ax + 10 : ax - 10;
    x.globalAlpha = wk * linesA * textA * (lit ? 1 : 0.8);
    for (const d of g.ds) if (Math.abs(wy - d.ey) > 1 || Math.abs(ax - d.ex) > 1) { x.strokeStyle = 'rgba(238,240,250,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(d.ex + (right ? 4 : -4), d.ey); x.lineTo(ax + (right ? 8 : -8), wy); x.stroke(); }
    x.fillStyle = SOFT; x.textAlign = right ? 'left' : 'right'; x.fillText(txt, tx, wy);
    leapHits.push({ x: right ? tx - 2 : tx - tw - 2, y: wy - 9, w: tw + 4, h: 18, dif: g.ds.map((d) => d.l.s) });
  }
}
// the phone among the roots: the eight lineages fold into one name at the head of the stage, so the pictures and the reading plate keep the band.
// A press on it sets the eight down the band's left, each on its own plate with a thread to its line; a press on one lights that lineage, folds
// the rest away and leaves its name standing with its thread; a press on a lit name rests it. Each dotted ring's age stands on a plate where the
// ring crosses the band. The record's labels keep clear of all of these (drawMarkers). The fan's caption stands in the span's sheet
let rootTags = [], phoneKeep = [], rootOpen = false, rootPick = -1, rootOpenKey = '';
function drawRootStagePhone(x, V, P, pos) {
  rootTags = []; phoneKeep = []; if (pos) unitSeat(x, P, pos); else unitMark = null;
  if ((rootLit >= 0 || rootPick >= 0 || rootOpen) && !rootsNear()) { rootLit = rootPick = -1; rootOpen = false; sceneKey = ''; schedule(); } // a lit lineage rests once its roots leave the stage
  if (rootOpen && rootOpenKey !== unitOf(cam.year).key) rootOpen = false; // the eight fold away when travel changes the unit in hand
  if (unitMark && unitMark.own) phoneKeep.push({ x0: unitMark.x - 2, y0: unitMark.y - 2, x1: unitMark.x + unitMark.w + 2, y1: unitMark.y + unitMark.h + 2 });
  if (!G || cam.zoom >= 0.5 || textA <= 0 || shA > 0.5 || slf(cam.year) >= R) return;
  const a = textA * (1 - shA), fs = MIN_TEXT, lh = 23, col = typeOf(yearOfSlot(Math.round(0.9 * R)));
  x.textAlign = 'left'; x.font = `400 ${fs}px ${FONT_DISPLAY}`;
  // the one name: beside the span's name where that stands on a row of its own and leaves room, else at the head of the stage
  const cName = rootPick >= 0 ? LIN[rootPick][0] : ROOTS_LINE.split(' ').slice(0, 2).join(' '), cw = x.measureText(cName).width, own = unitMark && unitMark.own, beside = own && unitMark.x + unitMark.w + 14 + cw + 26 <= BAND.x1;
  const x0 = (beside ? unitMark.x + unitMark.w + 10 : BAND.x0) + 5, cy = beside ? unitMark.y + unitMark.h / 2 : (own ? unitMark.y + unitMark.h : skyTop()) + 8 + fs / 2 + 3;
  const chip = { i: rootPick, name: cName, tw: cw, ly: cy, lit: rootPick >= 0, chip: true, x0 }, top = Math.max(cy + fs / 2 + 3, own ? unitMark.y + unitMark.h : 0) + 4, lx = BAND.x0 + 5;
  const rows = (rootOpen ? LIN.map(([name], i) => ({ i, name, tw: x.measureText(name).width, ly: top + fs / 2 + 3 + i * lh, lit: i === rootLit, x0: lx })) : []).concat(rootPick >= 0 && !rootOpen ? [chip] : []);
  // each name's thread runs to its own line where that line crosses the stage in the open, clear of the larger pictures
  const bigP = []; for (let k = 0; k < picN; k++) if (picOn[k] && picPX[k] >= 26) { const w = picPX[k] / 2 + 3, h = w / (G.picList[k].a || 1); bigP.push([picSX[k] - w, picSY[k] - h, picSX[k] + w, picSY[k] + h]); }
  for (const r of rows) {
    let best = null, bd = 1e9;
    for (let t = 0.04; t <= 1; t += 0.01) {
      coilRel(t * R, ROOT_LANE[r.i], 0.02, rootO, 0); const q = projR(V, rootO[0], rootO[1], rootO[2]); if (!q.d || q.sx < r.x0 + r.tw + 14 + (r.chip ? 16 : 0) || q.sx > W - 8 || q.sy < skyTop() + 6 || q.sy > H - 100) continue;
      if (bigP.some((o) => q.sx > o[0] && q.sx < o[2] && q.sy > o[1] && q.sy < o[3])) continue;
      const d = Math.abs(q.sy - r.ly) + 0.6 * (q.sx - r.x0 - r.tw); if (d < bd) { bd = d; best = q.sx; r.qx = q.sx; r.qy = q.sy; }
    }
    if (best === null) continue;
    x.globalAlpha = a * (r.lit ? 1 : 0.6); x.strokeStyle = r.lit ? INK : col; x.lineWidth = r.lit ? 1.6 : 1; x.beginPath(); x.moveTo(r.x0 + r.tw + 5 + (r.chip ? 16 : 0), r.ly); x.lineTo(r.qx, r.qy); x.stroke();
    x.globalAlpha = a; x.fillStyle = r.lit ? INK : col; x.beginPath(); x.arc(r.qx, r.qy, r.lit ? 3.5 : 2.5, 0, 6.283); x.fill();
  }
  x.textBaseline = 'middle'; x.font = `400 ${fs}px ${FONT_DISPLAY}`;
  for (const r of rows.filter((q) => !q.chip).concat([chip])) {
    const ex = r.chip ? 16 : 0, b = { x0: r.x0 - 5, y0: r.ly - fs / 2 - 3, x1: r.x0 + r.tw + 5 + ex, y1: r.ly + fs / 2 + 3 };
    plate(x, b.x0, b.y0, r.tw + 10 + ex, fs + 6, a); x.globalAlpha = a; x.fillStyle = r.lit ? INK : col; x.fillText(r.name, r.x0, r.ly + 1);
    if (r.chip) { const mx = r.x0 + r.tw + 10, my = r.ly + (rootOpen ? 2 : -1), up = rootOpen ? -1 : 1; x.strokeStyle = r.lit ? INK : col; x.lineWidth = 1.5; x.beginPath(); x.moveTo(mx - 4, my - 2 * up); x.lineTo(mx, my + 2 * up); x.lineTo(mx + 4, my - 2 * up); x.stroke(); } // the fold's mark: open below, or closed
    rootTags.push(r.chip ? { b, chip: true } : { b, i: r.i }); phoneKeep.push({ x0: b.x0 - 2, y0: b.y0 - 2, x1: b.x1 + 2, y1: b.y1 + 2 });
  }
  x.textBaseline = 'alphabetic';
  // each dotted ring's age, on a plate where the ring crosses the band clear of the names and the caption
  const over = (r, o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0;
  x.textAlign = 'center';
  for (const [y, lab] of ROOT_AGES) {
    const t = slf(y) / R, f = Math.pow(smooth((t - 0.08) / 0.92), 1.15), rr = 0.035 + (1 - 0.035) * f, X = ROOT_X - ROOT_LEN * (1 - t); if (rr > 0.8) continue;
    const w = x.measureText(lab).width; let seat = null, n = 0, xa = 1e9, xb = -1e9;
    for (let k = 0; k < 64; k++) {
      const an = (k / 64) * Math.PI * 2, q = projR(V, X, Math.cos(an) * rr, Math.sin(an) * rr); if (!q.d) continue; n++; xa = Math.min(xa, q.sx); xb = Math.max(xb, q.sx);
      const b = { x0: q.sx - w / 2 - 6, y0: q.sy - TAG_H / 2, x1: q.sx + w / 2 + 6, y1: q.sy + TAG_H / 2 };
      if (b.x0 < BAND.x0 || b.x1 > BAND.x1 || b.y0 < skyTop() + 4 || b.y1 > BAND.y1 || phoneKeep.some((o) => over(b, o)) || underRead(b.x0, b.y0, b.x1, b.y1)) continue; // an age of the roots never stands under the reading plate
      if (!seat || b.y0 < seat.y0) seat = b;
    }
    if (!seat || n < 40 || xb - xa < 60) continue;
    plate(x, seat.x0, seat.y0, seat.x1 - seat.x0, TAG_H, a); x.globalAlpha = a * 0.95; x.fillStyle = SOFT; x.fillText(lab, (seat.x0 + seat.x1) / 2, seat.y1 - 6);
    phoneKeep.push({ x0: seat.x0 - 3, y0: seat.y0 - 3, x1: seat.x1 + 3, y1: seat.y1 + 3 });
  }
  x.textAlign = 'left'; x.globalAlpha = textA;
}
// the phone pulled back: the centuries as a ladder down the band's left, each numeral on a plate of its own and threaded to the floor of its loop,
// the last row the roots; a touch lights one and its line stands beside the ladder
let centHits = [];
const ROOTS_KEY = -1, ROOTS_LINE = 'Eight lineages from 3.3 million BCE run into the coil at 1026.';
const centKey = (y) => (y < T0 ? ROOTS_KEY : centOf(y));
function drawCentLadder(x, V, P) {
  centHits = []; if (!G) return;
  const a = textA * clamp((cam.zoom - 0.5) * 2, 0, 1); if (a <= 0) return;
  const fs = MIN_TEXT, rows = []; let p;
  for (let k = G.cents.length - 1; k >= 0; k--) { p = projR(V, G.centG[k * 3], G.centG[k * 3 + 1], G.centG[k * 3 + 2]); if (p.d) rows.push({ y: G.cents[k], key: G.cents[k], t: fmtTick(G.cents[k]), sx: p.sx, sy: p.sy }); }
  coilRel(R + 40, 0, -0.42, rootO, 0); p = projR(V, rootO[0], rootO[1], rootO[2]); if (p.d) rows.push({ y: T0, key: centOf(T0), t: fmtTick(T0), sx: p.sx, sy: p.sy });
  p = projR(V, ROOT_X - ROOT_LEN * 0.4, 0, 0); if (p.d) rows.push({ y: yearOfSlot(Math.round(R * 0.6)), key: ROOTS_KEY, t: 'Before 1026', sx: p.sx, sy: p.sy });
  if (!rows.length) return;
  const top = skyTop() + 16, lh = Math.min(24, Math.floor((BAND.y1 - 8 - top) / Math.max(1, rows.length - 1))), x0 = BAND.x0 + 5;
  x.font = `400 ${fs}px ${FONT_DISPLAY}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.lineWidth = 1;
  rows.forEach((r, i) => { r.ly = top + i * lh; r.tw = x.measureText(r.t).width; r.lit = hoverCent === r.key; });
  for (const r of rows) { // the threads first, so no numeral sits under another's thread
    r.col = r.key === ROOTS_KEY ? typeOf(yearOfSlot(Math.round(0.9 * R))) : typeOf(yearOfSlotF(sl(r.y) + 50));
    x.globalAlpha = a * (r.lit ? 1 : 0.55); x.strokeStyle = r.lit ? INK : r.col; x.lineWidth = r.lit ? 1.6 : 1; x.beginPath(); x.moveTo(x0 + r.tw + 5, r.ly); x.lineTo(r.sx, r.sy); x.stroke();
    x.fillStyle = r.lit ? INK : r.col; x.globalAlpha = a; x.beginPath(); x.arc(r.sx, r.sy, r.lit ? 3.5 : 2.5, 0, 6.283); x.fill();
  }
  for (const r of rows) {
    plate(x, x0 - 5, r.ly - fs / 2 - 3, r.tw + 10, fs + 6, a);
    x.globalAlpha = a; x.fillStyle = r.lit ? INK : r.col; x.fillText(r.t, x0, r.ly + 1);
    centHits.push({ x: x0 - 9, y: r.ly - lh / 2, w: r.tw + 18, h: lh, year: r.y, key: r.key });
  }
  const lit = rows.find((r) => r.lit), l = !lit ? null : lit.key === ROOTS_KEY ? { label: '', line: ROOTS_LINE } : db.centuryLines ? db.centuryLines.get(lit.key < 1100 ? 1000 : lit.key) : null;
  if (l) { // the lit century's line, on its own ground beside the ladder
    const bx = x0 + Math.max(...rows.map((r) => r.tw)) + 24, bw = BAND.x1 - bx - 8, head = l.label ? `The ${l.label}` : 'Before 1026', hs = 22, bs = 16, blh = 23;
    x.font = `400 ${bs}px ${FONT_TEXT}`; const body = wrapT(x, l.line, bw).slice(0, 5), by = top - 6, bh = hs + 12 + body.length * blh;
    plate(x, bx - 12, by - 8, bw + 24, bh + 18, a * 0.96);
    x.textBaseline = 'alphabetic'; x.globalAlpha = a; x.fillStyle = INK; x.font = `400 ${hs}px ${FONT_DISPLAY}`; x.fillText(head, bx, by + hs);
    x.font = `400 ${bs}px ${FONT_TEXT}`; body.forEach((t, i) => x.fillText(t, bx, by + hs + 10 + (i + 1) * blh - 5));
  }
  x.globalAlpha = textA; x.textBaseline = 'alphabetic';
}
// stage 5, pulled back: on the desk the century under the cursor speaks its line beneath the coil; on the phone all eleven lines list under the coil
function drawCenturies(x, P, bottom) {
  if (!db.centuryLines || !db.centuryLines.size) return;
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  if (!P.vert) {
    const l = hoverCent != null ? db.centuryLines.get(hoverCent) : null; if (!l) return;
    const head = `The ${l.label}`, body = centLineText(l, centCount(hoverCent)), cy = Math.round(H * 0.72 + 40);
    x.font = `400 28px ${FONT_DISPLAY}`; const hw = x.measureText(head).width; x.font = `400 16px ${FONT_TEXT}`; const bw = x.measureText(body).width;
    if (hw + 14 + bw <= W * 0.8) { // one baseline: the century in Serif, its line in Sans
      const x0 = Math.round((W - hw - 14 - bw) / 2);
      x.fillStyle = INK; x.font = `400 28px ${FONT_DISPLAY}`; x.fillText(head, x0, cy); x.fillStyle = SOFT; x.font = `400 16px ${FONT_TEXT}`; x.fillText(body, x0 + hw + 14, cy);
    } else {
      x.fillStyle = INK; x.font = `400 28px ${FONT_DISPLAY}`; x.fillText(head, Math.round((W - hw) / 2), cy - 26);
      x.fillStyle = SOFT; x.font = `400 16px ${FONT_TEXT}`; const lines = wrapT(x, body, W * 0.8); for (let i = 0; i < Math.min(2, lines.length); i++) { const t = lines[i], tw = x.measureText(t).width; x.fillText(t, Math.round((W - tw) / 2), cy + i * 22); }
    }
    return;
  }
  const lines = [...db.centuryLines.values()].sort((a, b) => a.century - b.century), top = Math.round(H * 0.45 + 30), maxW = W - 40;
  // each century: its label in ink, the count, then the whole line if it fits, else its first clause, wrapped onto a second line rather than cut
  const rows = lines.map((l) => {
    x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; const lw = x.measureText(l.label).width + 8;
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; const nw = lw, room = maxW - nw;
    const body = x.measureText(l.line).width <= room ? [l.line] : wrapT(x, firstClause(l.line), room).slice(0, 2);
    return { l, lw, nw, body };
  });
  const count = rows.reduce((a, r) => a + r.body.length, 0), lh = Math.max(Math.round(MIN_TEXT * 1.2), Math.min(22, Math.floor((bottom - top) / count)));
  if (top + count * lh > bottom + 4) return;
  let cy = top;
  for (const r of rows) {
    x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = INK; x.fillText(r.l.label, 20, cy);
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = SOFT;
    r.body.forEach((t, i) => { x.fillText(t, 20 + r.nw, cy); if (i < r.body.length - 1) cy += lh; });
    cy += lh;
  }
}
// the roots carry light: along each lineage a slow pulse travels from the deep past into the 1026 loop, one every nine
// seconds or so, staggered, so the fan reads as history flowing into the coil rather than a diagram at rest
const FLOW_MS = 9000, FLOW_LEN = 0.2, flowO = [0, 0, 0]; let flowTimer = 0;
const rootFlowOn = () => !!G && cellOn && !(H > W) && rootsNear() && cam.zoom <= 0.5 && document.visibilityState === 'visible'; // the phone holds still at rest: nothing loops
function drawRootFlow(x, V) {
  if (!rootFlowOn()) return;
  const now = performance.now(), N = 56;
  x.lineCap = 'round'; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < LIN.length; i++) {
    const head = ((now / (FLOW_MS + i * 420)) + i * 0.37) % 1, t0 = head - FLOW_LEN;
    if (head < 0.1) continue;
    let px = 0, py = 0, ok = false;
    for (let k = 0; k <= N; k++) {
      const t = t0 + (FLOW_LEN * k) / N; if (t < 0.06 || t > 1) { ok = false; continue; }
      coilRel(t * R, ROOT_LANE[i], -0.02, flowO, 0); const p = projR(V, flowO[0], flowO[1], flowO[2]);
      if (!p.d) { ok = false; continue; }
      if (ok) {
        const f = k / N; // 0 at the tail, 1 at the head
        x.beginPath(); x.moveTo(px, py); x.lineTo(p.sx, p.sy);
        x.strokeStyle = mix(colAt(t * R), INK, 0.65); x.lineWidth = 1.4 + 2.2 * f; x.globalAlpha = 0.95 * f * f * (0.7 + 0.3 * nearOf(V, p.d)) * (i === rootLit ? 1 : 0.85); x.stroke();
      }
      px = p.sx; py = p.sy; ok = true;
    }
    if (ok) { x.globalAlpha = 0.8; x.fillStyle = mix(colAt(head * R), INK, 0.8); x.shadowColor = mix(colAt(head * R), INK, 0.4); x.shadowBlur = 10; x.beginPath(); x.arc(px, py, 1.6, 0, 6.283); x.fill(); x.shadowBlur = 0; x.shadowColor = 'transparent'; } // the head, a point of light
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
}
// the phone with a record open: night drawn over the lifted coil behind the header, so the strip and the year keep their ground,
// and a tie from the record's ringed mark down to the sheet's head, so the sheet reads as risen from that mark
function drawSheetStage(x, P) {
  if (shA <= 0) return; const i = sheetI(P), e = shA * (2 - shA), top = skyTop(), foot = sheetTop();
  x.globalAlpha = 0.94 * e; x.fillStyle = NIGHT; x.fillRect(0, 0, W, top); x.globalAlpha = 1;
  if (i < 0 && unitSel() && unitMark) { const gx = unitMark.x + 14, gy = unitMark.y + unitMark.h; x.strokeStyle = INK; x.lineWidth = 1.5; x.globalAlpha = 0.95 * e; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx, foot + 2); x.stroke(); x.globalAlpha = 1; return; } // the unit's sheet hangs from the unit's name
  if (i < 0 || !cellOn[i]) return; const gx = cellSX[i], gy = cellSY[i], r = Math.max(cellPX[i] * 0.7, 8);
  x.strokeStyle = INK; x.lineWidth = 1.5; x.globalAlpha = 0.95 * e; x.beginPath(); x.moveTo(gx, gy + r); x.lineTo(gx, foot + 2); x.stroke(); x.globalAlpha = 1;
}
function drawOverlay(V = null) {
  if (!octx || !G || !cellOn) return;
  const t0 = performance.now(), P = par(), x = octx; V = V || view(P);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  x.clearRect(0, 0, W, H);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const Wf = freeW(); strip = stripFor(P, Wf);
  const pos = fieldPos(V, P, Wf);
  drawConns(x, V, P, pos); // stage 6: the connections in hand, under the leaps
  if (P.vert) { lineHits.length = 0; drawRef(x, V, P, pos, Wf); drawLeaps(x, V, P, pos, Wf); drawRootStagePhone(x, V, P, pos); drawMarkers(x, V, P, pos, Wf); drawSheetStage(x, P); } // the phone's card rises into the loop in hand: its scrim quiets the leaps
  else { drawScrim(x, pos, P, Wf); drawRef(x, V, P, pos, Wf); drawLeaps(x, V, P, pos, Wf); drawMarkers(x, V, P, pos, Wf); } // on the desk the leaps land over the scrim, so their words read
  drawField(x, V, P, Wf, pos);
  drawRootFlow(x, V);
  const Y = headYear(P, selYear() ?? (settling ? T1 : clamp(Math.round(cam.year), Y_LO, T1))), pulled = cam.zoom > 0.5;
  const { YS, YB, YR, left } = readoutAt(P, Wf);
  x.globalAlpha = textA;
  x.fillStyle = INK; x.textAlign = left ? 'left' : 'right'; x.textBaseline = 'alphabetic';
  // stage 6: the big year stands alone, no count above it
  if (pulled) {
    readoutText = ''; // pulled back, the numeral's seat stays empty (Elise, 18 Nov 2026: no 'The record' label); the count and century ladder carry the state
    if (P.vert) drawCentLadder(x, V, P); else drawCenturies(x, P, YB - YS * 0.78 - 14); x.textAlign = left ? 'left' : 'right'; x.fillStyle = INK;
  } else {
    x.font = `400 ${YS}px ${FONT_DISPLAY}`; const nowR = performance.now();
    const roNow = fmtTick(Y), roSize = roNow.length > 6 ? Math.round(YS * (roNow.length > 11 ? 0.42 : 0.6)) : YS; // a BCE year takes more room
    x.font = `400 ${roSize}px ${FONT_DISPLAY}`;
    if (readoutText !== roNow) { if (readoutText && nowR - roT0 > RO_DWELL_MS) roPrev = { text: readoutText, y: readoutYear, t0: nowR }; else roPrev = null; roT0 = nowR; } // stage 10: a held year gives way over one beat; streaming years cut
    readoutText = roNow; readoutYear = Y;
    const rp = roPrev ? clamp((nowR - roPrev.t0) / EASE_MS, 0, 1) : 1;
    if (roPrev && rp < 1) { x.globalAlpha = textA * (1 - easeOut(rp)); x.fillStyle = left ? typeOfPhone(roPrev.y) : typeOf(roPrev.y); x.fillText(roPrev.text, YR, YB); schedule(); } else roPrev = null;
    x.globalAlpha = textA * (roPrev ? easeOut(rp) : 1); x.fillStyle = left ? typeOfPhone(Y) : typeOf(Y); x.fillText(readoutText, YR, YB); x.globalAlpha = textA; x.fillStyle = INK; // the year in hand in its own colour, standing alone (stage 6)
  }
  // the one word under the readout: out to every century, or return to the year in hand
  x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.fillStyle = SOFT;
  const wtxt = pulled ? 'Return' : 'All centuries', ww = x.measureText(wtxt).width, wy = left ? YB : YB + 22;
  if (left) { x.textAlign = 'right'; x.fillText(wtxt, BAND.x1, wy); const ct = recCount(), cw = ct ? x.measureText(ct).width : 0; if (ct) x.fillText(ct, BAND.x1, wy - 21); // the phone sets the word on the year's baseline, flush right, and the record's count over it, under the strip's full end
    word = { x: BAND.x1 - Math.max(ww, cw) - 10, y: wy - 24, w: Math.max(ww, cw) + 20, h: 36 }; }
  else { x.fillText(wtxt, YR - 2, wy); word = { x: YR - 2 - ww - 8, y: wy - 18, w: ww + 16, h: 26 }; }
  if (strip) {
    const { x0, x1, y: yb, every, bh } = strip;
    // the band: one bar per decade in the blend at that decade, its height the square root of the decade's count against
    // the fullest decade (the 2020s, 1,350 records in seven years), so the record's growth reads without the early
    // centuries vanishing: a decade of six records stands 2px, the 1950s 9px, the 2010s 15px, the 2020s the full height
    x.globalAlpha = textA;
    for (let ds = 0; ds <= SPAN; ds += 10) { // one bar per ten-slot unit
      const dec = yearOfSlot(ds), tot = G.perDecade.get(dec) || 0; if (!tot) continue;
      const cx0 = Math.max(x0, x0 + (x1 - x0) * (ds / SPAN)), cx1 = Math.min(x1, x0 + (x1 - x0) * (Math.min(SPAN, ds + 10) / SPAN)); if (cx1 <= cx0) continue;
      const h = Math.max(2, Math.round(bh * (P.vert ? Math.pow(tot / G.decMax, 0.4) : Math.sqrt(tot / G.decMax)))); // the phone's taller band takes a gentler root, so the early centuries keep a body
      x.fillStyle = heat((ds + 5) / SPAN);
      if (ds < R) { x.globalAlpha = textA * 0.55; const hh = Math.max(2, Math.round(h * 0.6)); x.fillRect(Math.round((cx0 + cx1) / 2) - 0.5, yb - hh, 1, hh); x.globalAlpha = textA; } // the roots: an index of ticks, not a road the handle travels
      else x.fillRect(cx0, yb - h, cx1 - cx0 - 0.5, h);
    }
    // a break in a scale: two leaning strokes, as on a cut axis
    const brk = (cx, ya, yz, lean, al) => { x.save(); x.globalAlpha = al; x.strokeStyle = INK; x.lineWidth = 1.5; x.lineCap = 'round'; x.beginPath(); for (const o of [-2.5, 2.5]) { x.moveTo(cx + o + lean, ya); x.lineTo(cx + o - lean, yz); } x.stroke(); x.restore(); };
    { const px = x0 + (x1 - x0) * (R / SPAN); x.globalAlpha = textA * 0.7; x.fillStyle = INK; x.fillRect(Math.round(px) - 0.5, yb - bh - 2, 1, P.vert ? bh - 8 : bh + 4); if (P.vert) brk(Math.round(px), yb - 8, yb + 5, 2, textA * 0.85); x.globalAlpha = textA; } // the stop at 1026: on the phone the band is cut there, where its scale changes
    x.globalAlpha = textA;
    x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`; x.textAlign = 'center'; x.textBaseline = 'top';
    // a tick at every turn; a label where the pitch changes and at the round years that fit
    const STRIP_LABELS = [-99999, -9999, -999, 1026, 1500, 1800, 1900, 2000];
    for (let si = 100; si <= SPAN; si += 100) { const px = x0 + (x1 - x0) * (si / SPAN); x.fillStyle = 'rgba(238,240,250,0.5)'; x.fillRect(Math.round(px), yb, 1, 5); }
    if (P.vert) { // the phone: one row under the band, each label at its tick, in rank; one that would touch a neighbour waits for touch
      const row = [], put = (t, px, al) => { const w = x.measureText(t).width; for (const a of al) { const l = clamp(a === 0 ? px - w / 2 : px - 3, x0, x1 - w); if (row.some((q) => l < q[1] + 12 && l + w > q[0] - 12)) continue; row.push([l, l + w]); x.textAlign = 'left'; x.fillStyle = SOFT; x.fillText(t, l, yb + 9); return; } };
      { const a = '3.3 million BCE', b = fmtTick(T0), wa = x.measureText(a).width, wb = x.measureText(b).width, g = 8, bw = 9; // the stretch left of the stop is named by both its ends with the band's break mark between them, so the row shows where the scale changes; it stays in the label row, under the frame's top band
        x.textAlign = 'left'; x.fillStyle = SOFT; x.fillText(a, x0, yb + 9); x.fillText(b, x0 + wa + g + bw + g, yb + 9); brk(x0 + wa + g + bw / 2, yb + 11, yb + 9 + MIN_TEXT - 1, 2, textA * 0.85); row.push([x0, x0 + wa + g + bw + g + wb]); }
      for (const y of [1500, 1900, 1800, -999]) put(fmtTick(y), x0 + (x1 - x0) * u(y), [0]);
    } else {
    const gapL = x1 - x0 < 600 ? 96 : 64; let lastPx = x0 + (x1 - x0 < 600 ? 60 : 80); for (const y of STRIP_LABELS) { const px = x0 + (x1 - x0) * u(y); if (px - lastPx < gapL || px > x1 - 24) continue; lastPx = px; x.fillStyle = SOFT; x.fillText(fmtTick(y), px, yb + 10); }
    x.fillStyle = SOFT; x.textAlign = 'left'; x.fillText('3.3 million BCE', x0, yb + 10);
    }
    const px = x0 + (x1 - x0) * u(settling ? T1 : clamp(cam.year, Y_LO, T1));
    x.fillStyle = NIGHT; x.fillRect(Math.round(px) - 1.5, yb - bh - 3, 3, bh + 6); x.fillStyle = INK; x.fillRect(Math.round(px) - 0.5, yb - bh - 3, 1.5, bh + 6); x.beginPath(); x.arc(px, yb + 1.5, 4.5, 0, 6.283); x.fill(); // the year in hand: a cut through the band and the dot under it
  }
  x.globalAlpha = 1;
  // the hovered cell and the open record, ringed
  const ring = (i, strong) => {
    if (i < 0 || !cellOn[i]) return;
    const gx = cellSX[i], gy = cellSY[i], e = db.events[i], r = Math.max(cellPX[i] * 0.7, strong ? 8 : 6.5);
    x.strokeStyle = INK; x.lineWidth = strong ? 1.5 : 1.1; x.globalAlpha = strong ? 0.95 : 0.8;
    x.beginPath(); x.arc(gx, gy, r, 0, 6.283); x.stroke();
    if (strong) { x.fillStyle = heatOf(e.year); x.beginPath(); x.arc(gx, gy, 3.2, 0, 6.283); x.fill(); }
  };
  const selI = state.sel ? indexOf(state.sel) : -1, hiI = highlight ? indexOf(highlight) : -1;
  if (hiI >= 0 && hiI !== selI) ring(hiI, false);
  if (field && field.feed && !P.vert && cam.zoom < 0.02 && textA > 0) { // stage 10: the column's cards, found on the coil as their cards enter
    const now = performance.now(); let k = 0, more = false;
    for (const it of field.feed) { const p = clamp((now - unitT0 - STAGGER_MS * k) / EASE_MS, 0, 1); k++; if (p < 1) more = true; if (it.i === selI || (hover && hover.i === it.i) || !cellOn[it.i]) continue; const e = easeOut(p); x.globalAlpha = textA * linesA * 0.42 * e; x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.arc(cellSX[it.i], cellSY[it.i], Math.max(cellPX[it.i] * 0.7, 6.5) + (1 - e) * 6, 0, 6.283); x.stroke(); }
    if (more) schedule();
  }
  if (hover && hover.i != null && cellOn[hover.i]) { // the hovered record's picture, if it has one: its stem lit, so picture and block read as one
    if (!picOfCell || picOfCell.g !== G) { picOfCell = new Map(G.picList.map((it, k) => [it.i, k])); picOfCell.g = G; }
    const k = picOfCell.get(hover.i); if (k != null && picPX[k] >= 14 && picOn[k]) { const it = G.picList[k], w = picPX[k] * 1.1, h = w / (it.a || 1); stem(x, picSX[k], picSY[k], w, h, cellSX[hover.i], cellSY[hover.i], 0.95); x.globalAlpha = 1; x.shadowColor = 'rgba(4,6,24,0.85)'; x.shadowBlur = 18; x.shadowOffsetY = 6; x.fillStyle = NIGHT; x.fillRect(picSX[k] - w / 2 - 2, picSY[k] - h / 2 - 2, w + 4, h + 4); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; drawPic(x, it, picSX[k], picSY[k], w, h); x.strokeStyle = INK; x.lineWidth = 1.5; x.strokeRect(picSX[k] - w / 2 + 0.5, picSY[k] - h / 2 + 0.5, w - 1, h - 1); } // under the pointer the picture lifts: larger, deeper shadow, full frame
  }
  if (hover && hover.i != null && hover.i !== selI && cellOn[hover.i]) { const p = clamp((performance.now() - hoverT0) / (EASE_MS * 0.6), 0, 1), e = easeOut(p); x.strokeStyle = INK; x.lineWidth = 1.1; x.globalAlpha = 0.8 * e; x.beginPath(); x.arc(cellSX[hover.i], cellSY[hover.i], Math.max(cellPX[hover.i] * 0.7, 6.5) + (1 - e) * 5, 0, 6.283); x.stroke(); if (p < 1) schedule(); }
  { const M = matchSet(); if (M && textA > 0) { // the filter's records: a ring on each that is on the stage, and the count where the coil's word sits
      x.strokeStyle = INK; x.lineWidth = 1; x.globalAlpha = 0.55 * textA; let on = 0;
      for (const i of M) { if (!cellOn[i] || i === selI) continue; on++; x.beginPath(); x.arc(cellSX[i], cellSY[i], Math.max(cellPX[i] * 0.7, cam.zoom > 0.5 ? 3.5 : 6.5), 0, 6.283); x.stroke(); }
      const q = (state.q || '').trim(), th = state.thread ? state.thread.replace(/-/g, ' ') : '';
      const line = `${M.length} record${M.length === 1 ? '' : 's'} ${q && th ? `match "${q}" on the ${th} thread` : q ? `match "${q}"` : `on the ${th} thread`}${on < M.length ? `, ${on} in view` : ''}`;
      x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`; x.textAlign = 'left'; x.textBaseline = 'top'; x.globalAlpha = 0.85 * textA; x.lineJoin = 'round'; x.strokeStyle = NIGHT; x.lineWidth = 4; x.strokeText(line, 24, 18); x.fillStyle = INK; x.fillText(line, 24, 18);
    } }
  if (selI >= 0) ring(selI, true);
  x.globalAlpha = 1;
  prof.overlay = performance.now() - t0;
  if (refAnim || mkAnim) schedule(); // stage 7 and 8: the reference or the markers still easing
}

// ---------- hit testing: the word, the field's lines, pictures, cells, then the strip ----------
function hit(mx, my, touch = false) {
  if (!G || !cellOn) return null;
  if (word && mx >= word.x && mx <= word.x + word.w && my >= word.y && my <= word.y + word.h) return { kind: 'word' };
  if (cam.zoom > 0.5) { if (H > W) for (const t of centHits) if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return { kind: 'loop', year: t.year, cent: t.key }; const y = loopAt(mx, my); return y != null ? { kind: 'loop', year: y, cent: centKey(y) } : null; }
  if (H > W && readPlate && shA <= 0 && mx >= readPlate.x && mx <= readPlate.x + readPlate.w && my >= readPlate.y && my <= readPlate.y + readPlate.h) return { kind: 'plate', e: readPlate.e, i: readPlate.i };
  if (H > W) for (const t of rootTags) if (mx >= t.b.x0 - 4 && mx <= t.b.x1 + 4 && my >= t.b.y0 - 6 && my <= t.b.y1 + 6) return t.chip ? { kind: 'root', chip: true } : { kind: 'root', i: t.i };
  if (fcHead && cam.year >= FC_FROM && mx >= fcHead.x && mx <= fcHead.x + fcHead.w && my >= fcHead.y && my <= fcHead.y + fcHead.h) return { kind: 'claim', pred: 'fc:all' };
  for (let k = lineHits.length - 1; k >= 0; k--) { const t = lineHits[k]; if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return t.pred ? { kind: 'claim', pred: t.pred } : t.src ? { kind: 'src', url: t.src } : t.head ? { kind: 'head' } : t.kind === 'unit' ? { kind: 'unit', year: t.year } : { kind: 'line', e: t.e, i: t.i }; }
  for (let k = leapHits.length - 1; k >= 0; k--) { const t = leapHits[k]; if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return t.dif ? { kind: 'dif', s: t.dif } : { kind: 'leap', pred: t.pred }; }
  for (let k = mkHits.length - 1; k >= 0; k--) { const t = mkHits[k]; if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return { kind: 'pic', e: t.e, i: t.i }; }
  for (let k = satHits.length - 1; k >= 0; k--) { const t = satHits[k]; if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return { kind: 'pic', e: t.e, i: t.i }; }
  for (let k = picHits.length - 1; k >= 0; k--) { const t = picHits[k]; if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) return { kind: 'pic', e: t.e, i: t.i }; }
  let best = -1, bd = 1e9;
  for (let i = 0; i < G.n; i++) {
    if (!cellOn[i]) continue;
    const dx = cellSX[i] - mx, dy = cellSY[i] - my, dd = dx * dx + dy * dy, rr = Math.max(cellPX[i] * 0.5 + 2, touch ? 10 : 4);
    if (dd < rr * rr && dd < bd) { bd = dd; best = i; }
  }
  if (best >= 0) return { kind: 'cell', e: db.events[best], i: best };
  if (strip && my >= strip.y - strip.bh - 10 && my <= strip.y + 30 && mx >= strip.x0 - 8 && mx <= strip.x1 + 8) {
    const year = clamp(yearOfSlotF(((mx - strip.x0) / (strip.x1 - strip.x0)) * SPAN), Y_LO, T1), dot = strip.x0 + (strip.x1 - strip.x0) * u(clamp(cam.year, Y_LO, T1));
    return { kind: 'strip', year, onDot: Math.abs(mx - dot) < 14 };
  }
  return null;
}
// pulled back: the year of the thread nearest a point on the stage
function loopAt(mx, my) {
  let best = null, bd = 30 * 30, o = 0;
  for (let c = 0; c < G.chunks.length; c++) {
    const ch = G.chunks[c];
    if (chunkOn[c]) for (let j = 0; j < ch.m; j += 2) { const dx = chunkSX[o + j] - mx, dy = chunkSY[o + j] - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = ch.dec + j * 0.5; } }
    o += ch.m;
  }
  if (best == null && cellOn) { let bc = 40 * 40; for (let i = 0; i < G.n; i++) { if (!cellOn[i]) continue; const dx = cellSX[i] - mx, dy = cellSY[i] - my, dd = dx * dx + dy * dy; if (dd < bc) { bc = dd; best = yearOfSlot(G.cellYear[i]); } } } // off the thread, the nearest record's year stands for its century
  return best == null ? null : clamp(best, Y_LO, T1);
}
// a claim by id, or a forecast (fc:<index>) shaped like one
function recordOf(id) {
  if (id.startsWith('fc:')) { const f = forecasts && forecasts[+id.slice(3)]; return f ? { id, who: f.who, year_made: f.y0, predicted_for: f.t, outcome: f.v, claim: f.text, forecast: true, chk: f.chk } : null; }
  return db.predById ? db.predById.get(id) : null;
}
function predTipHtml(c) {
  const v = c.chk ? STATUS_WORD[c.chk.s] || STATUS_WORD.unresolvable : VERDICT_WORD[c.outcome] || VERDICT_WORD.unresolvable, when = c.predicted_for ? `${c.year_made}, for ${c.predicted_for}` : `${c.year_made}, no deadline`;
  const col = c.chk ? STATUS_NIGHT[c.chk.s] || STATUS_NIGHT.unresolvable : VERDICT_NIGHT[c.outcome] || VERDICT_NIGHT.unresolvable;
  return `<div class="k"><i style="background:${col}"></i>${esc(c.who)} &middot; ${esc(when)} &middot; ${esc(v)}</div><div class="h">${esc(c.claim)}</div>`;
}
const difWho = (s) => (s.id === 'smartphone' || s.id === 'social' ? 'adults' : 'homes'); // the series counts households, adults for the smartphone and social media
function difTipHtml(ss) { return `<div class="k"><i style="background:${SOFT}"></i>${ss.map((s) => esc(s.name)).join(' and ')}</div>${ss.map((s) => `<div class="h">${esc(s.invention.label)}, ${s.invention.year}, to half of American ${difWho(s)}, ${s.half_year}</div>`).join('')}`; }
function tipHtml(e) {
  const d = DOMAIN[e.domain];
  const where = e.region && REGION[e.region] ? ` &middot; ${esc(REGION[e.region].label)}` : '';
  return `<div class="k"><i style="background:${domainColor(e.domain)}"></i>${esc(d ? d.short : e.domain)} &middot; ${esc(e.type || '')} &middot; ${esc(fmtDate(e))}${where}</div><div class="h">${esc(e.title)}</div>`;
}

// ---------- motion: the frame loop runs while anything moves, then rests ----------
function schedule() { if (!raf && ctx) raf = requestAnimationFrame(frame); }
function frame(t) {
  raf = 0;
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60; lastT = t;
  let camMoved = false, anim = false, speed = 0;
  if (settling && !ride && !awaitingArrival) { settling = false; cam.lift = 0; sceneKey = ''; camMoved = true; } // the hold cannot outlive the ride that ends it
  if (ride) {
    const k = clamp((t - ride.t0) / ride.dur, 0, 1), e = ride.ease(k), s0 = cam.s;
    cam.s = lerp(ride.s0, ride.s1, e); cam.zoom = lerp(ride.z0, ride.z1, e); cam.lift = lerp(ride.l0, ride.l1, e); cam.ts = ride.s1; cam.vel = 0; camMoved = true;
    speed = Math.abs(cam.s - s0) / dt;
    if (k >= 1) { const then = ride.then; ride = null; if (then) then(); } else anim = true;
  } else {
    const dx = cam.s - cam.ts;
    if (dx !== 0 || cam.vel !== 0) {
      // the critically damped spring, in closed form: x(t) = (A + B t) e^(-w t), in slots
      const om = H > W ? OMEGA_PHONE : OMEGA, A = dx, B = cam.vel + om * dx, ex = Math.exp(-om * dt);
      let ny = cam.ts + (A + B * dt) * ex; const nv = (B - om * (A + B * dt)) * ex;
      const stepY = ny - cam.s, stepMax = SPEED_MAX * dt; if (Math.abs(stepY) > stepMax) ny = cam.s + Math.sign(stepY) * stepMax;
      speed = Math.abs(ny - cam.s) / dt;
      cam.s = ny; cam.vel = nv; camMoved = true;
      if (Math.abs(cam.s - cam.ts) < 0.003 && Math.abs(cam.vel) < 0.05) { cam.s = cam.ts; cam.vel = 0; } else anim = true;
    }
  }
  // the field's lines hold below forty years a second; faster they drop, and return within 150ms of rest
  linesT = camMoved && speed > HOLD_SPEED ? 0 : 1;
  if (linesA !== linesT) { const stepA = dt * 1000 / LINES_MS; linesA = linesA < linesT ? Math.min(linesT, linesA + stepA) : Math.max(linesT, linesA - stepA); if (linesA !== linesT) anim = true; }
  if (H > W && (breath > 0 || speed > 0)) { // the phone's breath follows the coil's speed, out sooner than home
    const want = reduced() || cam.zoom > 0.02 || settling || landing || awaitingArrival ? 0 : clamp(speed / BREATH_AT, 0, 1), nb = breath + (want - breath) * (1 - Math.exp(-dt / (want > breath ? BREATH_OUT_S : BREATH_HOME_S)));
    const b = Math.abs(nb - want) < 0.01 ? want : nb; if (b !== breath) { breath = b; camMoved = true; } if (breath > 0) anim = true;
  }
  if (camMoved && resting) { resting = false; onMotionStart(); }
  if (glowT0) { sceneKey = ''; camMoved = true; anim = true; }
  const shMove = shA !== (sheetUp(par()) ? 1 : 0); // the phone's sheet still rising or falling
  if (readMoved) { readMoved = false; sceneKey = ''; draw(picAnim); } // the plate took another seat: the coil's own years redraw around it
  else if (camMoved || picAnim || shMove) draw(picAnim); else drawOverlay();
  if (anim || tracing || picAnim || refAnim || mkAnim || shMove) { schedule(); return; }
  if (!resting) { lastT = 0; resting = true; onMotionEnd(); }
  landing = false;
  if (rootFlowOn() && !flowTimer) flowTimer = setTimeout(() => { flowTimer = 0; schedule(); }, 34); // the roots keep their slow light while the view rests near them, at thirty frames a second
}
function onMotionStart() {
  if (restTimer) { clearTimeout(restTimer); restTimer = 0; }
  if (hover) { hover = null; tip.hide(); }
}
function onMotionEnd() {
  if (H > W && ctx) { readMoved = true; schedule(); if (!hintDone && !hintTimer) hintTimer = setTimeout(travelHint, HINT_WAIT_MS); } // the phone's plate returns at rest; the first rest after a visit opens arms the coil's one show of travel
  if (restTimer) clearTimeout(restTimer);
  restTimer = setTimeout(() => { restTimer = 0; if (ctx) writeFy(); }, REST_MS);
}
let tookWheel = false, landing = false, leapWhole = false; // the reader moved before the arrival had finished settling; landing: the phone's 520ms settle under the arrival's fade
function takeWheel() { tookWheel = true; landing = false; if (settling) { settling = false; cam.lift = 0; sceneKey = ''; } } // the readout follows the camera from here on
const stop = () => { takeWheel(); ride = null; cam.ts = cam.s; cam.vel = 0; };
const cut = () => { if (resting) { resting = false; onMotionStart(); } draw(); resting = true; onMotionEnd(); };
// a ride: year, zoom and lift eased together; a cut when motion is reduced
function rideTo(year, zoom = cam.zoom, dur = RIDE_MS, ease = easeInOut, then = null, lift = 0) {
  if (!then) takeWheel(); // a ride the reader asked for (a click on the band or a loop, a fling) ends the arrival's hold
  year = clamp(year, Y_LO, T1); cam.vel = 0;
  if (reduced() || dur <= 0) { ride = null; cam.year = cam.target = year; cam.zoom = zoom; cam.lift = lift; cut(); if (then) then(); return; }
  ride = { s0: cam.s, s1: slf(year), z0: cam.zoom, z1: zoom, l0: cam.lift, l1: lift, t0: performance.now(), dur, ease, then };
  schedule();
}
// the wheel, the keys: the target moves whole stops; the camera follows through the spring (a cut when motion is reduced)
let glowT0 = 0; const GLOW_MS = 700;
function rootGlow() { if (!glowT0) return 0; const k = (performance.now() - glowT0) / GLOW_MS; if (k >= 1) { glowT0 = 0; return 0; } return Math.sin(Math.PI * k); } // one breath of light
function bounce() { // at 1026 a push further back meets the roots: the eight lineages light together for a moment, so the stop reads as the point where the record branches rather than ends
  glowT0 = performance.now(); sceneKey = ''; schedule();
}
function nudge(stops) {
  if (cam.zoom > 0.02 || !stops) return;
  moved = true; takeWheel(); ride = null;
  if (stops < 0 && cam.ts <= 0.01) { bounce(); return; }
  cam.target = stepStops(cam.target, stops);
  if (reduced()) { cam.year = cam.target; cam.vel = 0; cut(); return; }
  schedule();
}
// the phone's one show of travel: at the first rest of a visit nobody has touched, the coil rides thirty years into the past and back,
// strip handle, numeral and rings moving together, so a reader sees the record moves under a finger before touching it. Never twice,
// never under reduced motion, and any touch, wheel or key ends it where it stands
let hintDone = false, hintTimer = 0, hinting = false; const HINT_WAIT_MS = 1800, HINT_YEARS = 30, HINT_OUT_MS = 1150, HINT_HOLD_MS = 350, HINT_BACK_MS = 1250;
function travelHint() {
  hintTimer = 0;
  if (hintDone || !ctx || !(H > W) || reduced() || tookWheel || moved || awaitingArrival || settling || ride || cam.zoom > 0.02 || state.sel || shA > 0) return;
  const home = stopOf(cam.year), back = stopOf(Math.max(Y_LO, home - HINT_YEARS)); hintDone = true; if (back === home) return;
  const done = () => { hinting = false; readMoved = true; schedule(); }; hinting = true;
  rideTo(back, 0, HINT_OUT_MS, easeInOut, () => { hintTimer = setTimeout(() => { hintTimer = 0; if (!tookWheel && !moved && !ride && cam.zoom <= 0.02) rideTo(home, 0, HINT_BACK_MS, easeInOut, done); else done(); }, HINT_HOLD_MS); });
}
// a drag or a scrub: the target sits where the pointer says; on release it settles on the nearest stop
function seatAt(year) {
  takeWheel(); ride = null; cam.target = clamp(year, Y_LO, T1);
  if (reduced()) { cam.year = cam.target; cam.vel = 0; cut(); return; }
  schedule();
}
function settle() { seatAt(stopOf(cam.target)); }
// a trackpad glide: the target travels with the fingers through the spring; when the events stop, the camera seats on the nearest stop
let glideTimer = 0;
function glide(years) {
  if (cam.zoom > 0.02 || !years) return;
  moved = true; takeWheel(); ride = null; if (years < 0 && cam.ts <= 0.01) { bounce(); return; } cam.ts = clamp(cam.ts + years, 0, SPAN); // years here are slots: a stop's width; the roots are an exhibit, not a road
  if (reduced()) { cam.year = cam.target; cam.vel = 0; cut(); } else schedule();
  if (glideTimer) clearTimeout(glideTimer);
  glideTimer = setTimeout(() => { glideTimer = 0; if (ctx && cam.zoom <= 0.02 && !ride) settle(); }, GLIDE_END_MS);
}
// a pointer fling: the release velocity (years per second) carries the camera to a stop in one 900ms ease, never past it
function fling(v) {
  if (reduced()) { settle(); return; }
  const ph = H > W, travel = clamp(v * (ph ? COAST_TAU : 0.45), -400, 400), to = stopOf(yearOfSlotF(clamp(cam.s + travel, 0, SPAN))); // travel in slots
  if (to === stopOf(cam.year) && Math.abs(travel) < 2) { settle(); return; }
  if (ph) { rideTo(to, 0, COAST_MS, coast); if (ride) ride.coast = true; return; } // the phone: no leap at release, the coil sheds the speed it had
  rideTo(to, 0, FLING_MS, easeOut);
}
export function pullBack() { if (cam.zoom < 1) rideTo(stopOf(cam.year), 1); }
export function seat(year = cam.year) { hoverCent = null; rideTo(stopOf(year), 0); }

// ---------- the camera year: a state value, default 2026; fy in the hash sets it and the strip or a ride moves it ----------
export function setYear(y, { write = true } = {}) {
  stop(); cam.year = cam.target = clamp(Math.round(+y), Y_LO, T1); cam.zoom = 0; cam.vel = 0; cam.lift = 0; linesA = 1;
  draw();
  if (write) writeFy();
}
export const year = () => cam.year;
function writeFy() {
  try {
    const p = hashParams(), Y = Math.round(cam.year);
    if (!p.get('v')) p.set('v', 'spiral');
    if (Y === T1 || cam.zoom > 0.5) p.delete('fy'); else p.set('fy', String(Y));
    p.delete('z');
    const h = '#' + p.toString().replace(/%2C/g, ',');
    if (h !== location.hash) history.replaceState(null, '', h);
  } catch { /* no history API */ }
}
function invalidate() { if (!ctx) return; draw(true); }

function size() {
  if (!host || !cv) return;
  const r = host.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (w !== W || h !== H || dpr !== DPR) {
    W = w; H = h; DPR = dpr;
    for (const c of [cv, ov]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); c.style.width = `${W}px`; c.style.height = `${H}px`; }
    pull = null; field = null;
  }
  { const b = bandOf(); if (b.x0 !== BAND.x0 || b.x1 !== BAND.x1 || b.y0 !== BAND.y0 || b.y1 !== BAND.y1) { BAND = b; pull = null; sceneKey = ''; } }
  { const v = H > W ? `${Math.round(host.getBoundingClientRect().top + sheetTop())}px` : '', st = document.documentElement.style; if (st.getPropertyValue('--hx-sheet-top') !== v) { if (v) st.setProperty('--hx-sheet-top', v); else st.removeProperty('--hx-sheet-top'); } } // where the phone's record sheet begins
  invalidate();
}

// ---------- the arrival (js/arrival.js): where the grains and pictures land; then the camera eases onto the loop in hand ----------
export function arrivalTargets() {
  if (!cv || !db.loaded.has('past') || !G || !cellOn) return { ok: false };
  const rect = cv.getBoundingClientRect(); if (rect.width < 10) return { ok: false };
  const n = G.n, dots = new Float32Array(n * 2), pat = new Float32Array(n * 2); pat.fill(NaN);
  if (POSTER) {
    // the still: every cell and picture gets its seat whether or not it is drawn yet, since the ones in flight land past the horizon
    const V = view(par());
    for (let i = 0; i < n; i++) {
      let k = i * 12, sx = 0, sy = 0, ok = true;
      for (let c = 0; c < 4; c++, k += 3) { const p = projR(V, G.cellG[k], G.cellG[k + 1], G.cellG[k + 2]); if (!p.d) { ok = false; break; } sx += p.sx; sy += p.sy; }
      dots[i * 2] = ok ? sx / 4 + rect.left : NaN; dots[i * 2 + 1] = ok ? sy / 4 + rect.top : NaN;
    }
    for (let k = 0; k < picN; k++) { const i = G.picList[k].i; if (i < 0) continue; const p = projR(V, G.picG[k * 3], G.picG[k * 3 + 1], G.picG[k * 3 + 2]); if (p.d) { pat[i * 2] = p.sx + rect.left; pat[i * 2 + 1] = p.sy + rect.top; } }
    const yb = POSTER.year + 40 + POSTER.ahead; // the globe hangs on the coil's axis, past the formed edge
    const c = projR(V, ((yb - T1) / 100) * PITCH, 0, 0); if (!c.d) return { ok: false };
    const cx = c.sx, cy = c.sy; // projR hands back one shared point, so take the centre before projecting the rim
    const xa = ((yb - T1) / 100) * PITCH; let Rpx = 0, m = 0; // the loop's radius on screen: the mean reach of four rim points about the axis
    for (const [ry, rz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const e = projR(V, xa, ry, rz); if (e.d) { Rpx += Math.hypot(e.sx - cx, e.sy - cy); m++; } }
    Rpx = m ? Rpx / m : Math.min(W, H) * 0.3;
    return { ok: true, dots, picAt: pat, cx: cx + rect.left, cy: cy + rect.top - POSTER.rise * Rpx, R: Rpx, pic: 12 };
  }
  for (let i = 0; i < n; i++) { dots[i * 2] = cellSX[i] + rect.left; dots[i * 2 + 1] = cellSY[i] + rect.top; }
  for (let k = 0; k < picN; k++) { const i = G.picList[k].i; if (i >= 0 && picOn[k]) { pat[i * 2] = picSX[k] + rect.left; pat[i * 2 + 1] = picSY[k] + rect.top; } }
  const V = view(par()), c = projR(V, 0, 0, 0), cx = c.d ? c.sx : W * 0.5, cy = c.d ? c.sy : H * 0.5;
  const o = new Float32Array(3); coilY(cam.year, 0, 0, o, 0); const e = projR(V, o[0], o[1], o[2]);
  const Rpx = e.d ? Math.hypot(e.sx - cx, e.sy - cy) : Math.min(W, H) * 0.3;
  return { ok: true, dots, picAt: pat, cx: cx + rect.left, cy: cy + rect.top, R: Rpx, pic: 12 };
}
// the arrival's clock starts once this holds: the record laid out and the pictures seated (or given up on), so the redraw
// that seats them never lands in the middle of the globe's fall
export function arrivalReady() { return !!(cv && db.loaded.has('past') && G && cellOn && picsSettled); }
function prepareForArrival() {
  awaitingArrival = true;
  if (reduced() && !POSTER) return;
  cam.year = cam.target = POSTER ? POSTER.year : T1 - 3; cam.lift = POSTER ? POSTER.lift : 0.3; textA = 0; settling = true; // the still holds its own year in hand
  if (ctx) draw();
}
// the overlay begins its fade: the type arrives with it
export function onReveal() {
  if (!awaitingArrival) return;
  if (reduced()) { textA = 1; invalidate(); return; }
  const phone = H > W, t0 = performance.now(), DUR = phone ? 520 : 700;
  if (phone && !tookWheel && !(cam.year >= T1 && cam.lift === 0)) { landing = true; rideTo(T1, 0, 520, easeOut, () => { settling = false; }, 0); } // landing ends at the frame loop's rest, after the ride's last frame has drawn // the phone's camera settles under the fade, so its arrival ends inside three seconds
  const tick = () => {
    if (!ctx) return;
    const k = clamp((performance.now() - t0) / DUR, 0, 1);
    textA = k;
    if (!ride) drawOverlay();
    if (k < 1) landingRaf = requestAnimationFrame(tick); else { landingRaf = 0; textA = 1; drawOverlay(); }
  };
  landingRaf = requestAnimationFrame(tick);
}
// the overlay is gone: the camera eases onto the loop in hand over 700ms, and a reload is a return visit
export function afterArrival() {
  if (!awaitingArrival) return;
  awaitingArrival = false;
  if (landing && ride) { /* the phone's settle is already under way and ends by its own ride */ } else if (reduced() || tookWheel || (cam.year >= T1 && cam.lift === 0)) { settling = false; textA = 1; cam.lift = 0; sceneKey = ''; invalidate(); } else rideTo(T1, 0, SETTLE_MS, easeOut, () => { settling = false; }, 0);
  if (!ride) landing = false;
  try { const p = hashParams(); if (!p.get('v')) p.set('v', 'spiral'); p.set('born', '1'); const h = '#' + p.toString().replace(/%2C/g, ','); if (h !== location.hash) history.replaceState(null, '', h); } catch { /* no history API */ }
}

export default function helix(el, shell = {}) {
  host = el;
  el.classList.add('hx-host');
  el.innerHTML = '<canvas class="hx-canvas" tabindex="0" aria-label="Histomap: 1026 to 2026 on a coil, one loop per century, with roots back to 3.3 million BCE, the year in hand beside its list. Scroll or drag to travel, arrow keys step a stop."></canvas><canvas class="hx-over" aria-hidden="true"></canvas>';
  cv = el.querySelector('.hx-canvas'); ov = el.querySelector('.hx-over');
  ctx = cv.getContext('2d'); octx = ov.getContext('2d');
  const open = shell.select || selectRecord;
  // the camera year from the hash (fy), else 2026
  const fy = parseFloat(hashParams().get('fy'));
  cam.year = cam.target = Number.isFinite(fy) ? clamp(Math.round(fy), Y_LO, T1) : T1; cam.zoom = 0; cam.vel = 0; cam.lift = 0; ride = null; textA = 1; resting = true; sceneKey = ''; field = null; linesA = linesT = 1;
  if (!db.loaded.has('past')) ensure('past');
  if (!db.predictions || !db.predictions.length) ensure('predictions');
  ensurePictures();
  for (const k of ['cards', 'centuries', 'diffusion', 'markers', 'highlights']) if (!db.loaded.has(k)) ensure(k); // stage 5: the culture layer; stage 8: the markers; stage 10: the highlights
  if (!db.loaded.has('text')) ensure('text'); else ensureMomentPics();
  if (window.__ARRIVAL && !hashParams().get('born')) prepareForArrival();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load(`400 20px ${FONT_DISPLAY}`), document.fonts.load(`italic 400 20px ${FONT_DISPLAY}`), document.fonts.load(`400 14px ${FONT_TEXT}`), document.fonts.load(`500 14px ${FONT_TEXT}`)]).then(() => { fontsV++; invalidate(); }).catch(() => {});
  const offData = onData((name) => { if (name === 'past' || name === 'core') { G = null; invalidate(); } else if (name === 'predictions') { field = null; if (H > W) leapWhole = true; drawOverlay(); } else if (name === 'text') { feedLayouts.clear(); drawOverlay(); } else if (name === 'highlights') { unitCache.clear(); field = null; drawOverlay(); } else if (name === 'forecasts') { forecasts = db.forecasts || []; field = null; fcLeaps = null; sceneKey = ''; draw(); } else if (name === 'cards' || name === 'centuries' || name === 'diffusion') { field = null; difLeaps = null; drawOverlay(); } else if (name === 'text') ensureMomentPics(); else if (name === 'markers') { G = null; invalidate(); } });
  // a unit's sheet opened before the claims or the forecasts had landed counted the ones in memory then: it is built again as they arrive, so its counts are the record's
  const offUnit = onData((name) => {
    if (!((name === 'predictions' || name === 'forecasts' || name === 'past') && unitSel() && db.pointById && db.pointById.has(state.sel))) return;
    // the pane is drawn again in place: the reader keeps the row in focus and the place scrolled to
    const dr = document.getElementById('drawer'), body = document.getElementById('db'), a = document.activeElement;
    const held = dr && a && dr.contains(a) ? ((a.dataset && a.dataset.id) || '') : null, top = body ? body.scrollTop : 0;
    openUnit(unitOfKey(state.sel));
    if (body) body.scrollTop = top;
    if (held != null) { const t = held ? [...dr.querySelectorAll('button[data-id]')].find((b) => b.dataset.id === held) : dr.querySelector('h3'); if (t) { if (!held) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
  });
  size();
  if (H > W && !hintDone && !hintTimer) hintTimer = setTimeout(travelHint, HINT_WAIT_MS + 800); // a visit that opens at rest

  // pointer: hover names the event in the shared tip; a click opens its record; a drag along the axis travels; the strip scrubs or rides
  const axis = () => (par().vert ? 1 : 0), dragSign = () => (par().vert ? -1 : 1); // on the phone the past lies under the thumb: a push up travels back, as a page scrolls
  const pos = (ev) => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  let down = null, dragging = false, scrubbing = false, samples = [], pinch = null, lastV = null, wheelAcc = 0;
  const pointers = new Map();
  const onMove = (ev) => {
    const [mx, my] = pos(ev);
    // the map holds the pointers that are down: a mouse or a pen passing over (no button) is not one of them, and one
    // let go outside the stage (its release never arrived here) leaves on its next move. It used to count every
    // pointer that moved, so a finger put down after the mouse had crossed the coil read as the second of a pinch
    if (pointers.has(ev.pointerId)) { if (ev.pointerType !== 'touch' && ev.buttons === 0) { pointers.delete(ev.pointerId); if (!pointers.size) pinch = null; if (down && !dragging && !scrubbing) down = null; } else pointers.set(ev.pointerId, [mx, my]); }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), ratio = d / pinch.d0;
      if (par().vert) { // on the phone two fingers closing draw the eye back to the whole record, and opening bring it home
        if (!pinch.done && ratio < 0.78 && cam.zoom < 0.5) { pinch.done = true; pullBack(); }
        if (!pinch.done && ratio > 1.28 && cam.zoom > 0.5) { pinch.done = true; seat(); }
        return;
      }
      if (!pinch.done && ratio > 1.3 && cam.zoom < 0.5) { pinch.done = true; pullBack(); }
      if (!pinch.done && ratio < 0.75 && cam.zoom > 0.5) { pinch.done = true; seat(); }
      return;
    }
    if (down) {
      const d = [mx - down[0], my - down[1]];
      if (scrubbing) { seatAt(yearOfSlotF(((mx - strip.x0) / (strip.x1 - strip.x0)) * SPAN)); moved = true; return; }
      if (par().vert && cam.zoom > 0.5) { if (!ride && Math.hypot(d[0], d[1]) > 5) { down[3] = 1; const h = hit(mx, my, true), c = h && h.kind === 'loop' ? h.cent : null; if (c != null && c !== hoverCent) { hoverCent = c; drawOverlay(); } } return; } // on the phone a finger moving over the whole record reads its centuries
      if (!dragging && Math.hypot(d[0], d[1]) > 5 && cam.zoom > 0.02 && !ride) { down = null; seat(); return; } // a pull on the whole record brings the camera home
      if (!dragging && Math.hypot(d[0], d[1]) > 5 && cam.zoom < 0.02) { dragging = true; stop(); try { cv.setPointerCapture(ev.pointerId); } catch { /* no capture */ } tip.hide(); hover = null; }
      if (dragging) {
        const now = performance.now(); samples.push([now, d[axis()]]); while (samples.length > 2 && now - samples[0][0] > 90) samples.shift();
        seatAt(yearOfSlotF(clamp(down[2] - dragSign() * d[axis()] * YPP, 0, SPAN))); moved = true; // YPP: slots a pixel
      }
      return;
    }
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
    if (!resting) return;
    const h = hit(mx, my), vt = par().vert; // the phone's composition reads on its plate: a mouse there gets no floating tip over it, as a finger gets none
    cv.style.cursor = h ? 'pointer' : (cam.zoom < 0.02 ? 'grab' : '');
    if (h && h.e) { const same = hover && hover.i === h.i && !!hover.line === (h.kind === 'line'); hover = { i: h.i, line: h.kind === 'line' }; litHover = null; if (!same) { hoverT0 = performance.now(); if (!vt) tip.show(ev, tipHtml(h.e)); drawOverlay(); } else if (!vt) tip.move(ev); }
    else if (h && h.pred) { const same = litHover === h.pred; hover = null; litHover = h.pred; if (!same && vt) drawOverlay(); else if (!same) { const c = recordOf(h.pred); if (c) tip.show(ev, predTipHtml(c)); else if (h.pred === 'fc:all' && forecastCount().n) tip.show(ev, `<div class="h">All ${forecastCount().n} dated forecasts${(forecasts || []).some((f) => f.chk) ? ', the ones due soon checked against the record' : ''}</div>`); drawOverlay(); } else if (!vt) tip.move(ev); }
    else if (h && h.kind === 'dif') { const key = h.s.map((s) => `dif:${s.id}`).join('|'), same = litHover === key; hover = null; litHover = key; if (!same) { if (!vt) tip.show(ev, difTipHtml(h.s)); drawOverlay(); } else if (!vt) tip.move(ev); }
    else if (hover || litHover) { hover = null; litHover = null; tip.hide(); drawOverlay(); }
    const hc = h && h.kind === 'loop' ? centOf(h.year) : null; if (hc !== hoverCent) { hoverCent = hc; drawOverlay(); } // pulled back, the century under the cursor speaks its line
    const rl = h && h.kind === 'root' ? h.i : h && h.e && h.e.year < T0 ? (LIN_OF[h.e.domain] ?? -1) : -1; if (rl !== rootLit) { rootLit = rl; sceneKey = ''; draw(); } // a record on a root lights its whole lineage
  };
  const onLeave = (ev) => { if (ev && ev.pointerType === 'touch' && par().vert) return; if (rootLit >= 0) { rootLit = -1; sceneKey = ''; draw(); } if (hover || litHover || hoverCent != null) { hover = null; litHover = null; hoverCent = null; drawOverlay(); } tip.hide(); cv.style.cursor = ''; };
  const onDown = (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    const [mx, my] = pos(ev); pointers.set(ev.pointerId, [mx, my]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), done: false }; down = null; dragging = false; return; }
    const h = hit(mx, my, ev.pointerType === 'touch');
    down = [mx, my, cam.ts]; dragging = false; scrubbing = !!(h && h.kind === 'strip' && h.onDot && cam.zoom < 0.02); samples = [];
    if (scrubbing) { stop(); try { cv.setPointerCapture(ev.pointerId); } catch { /* no capture */ } }
    else if (ride && cam.zoom < 0.02 && ride.z1 === 0) { takeWheel(); ride = null; cam.ts = cam.s; } // a touch stops a fling where it is
  };
  const onUp = (ev) => {
    pointers.delete(ev.pointerId);
    if (pinch) { if (pointers.size === 0) pinch = null; down = null; return; }
    if (!down) return;
    const [mx, my] = pos(ev); const d0 = down; down = null;
    if (scrubbing) {
      scrubbing = false;
      const hs = par().vert && Math.hypot(mx - d0[0], my - d0[1]) <= 6 ? hit(mx, my, ev.pointerType === 'touch') : null; // the phone's strip is short: a press beside the dot is still a press on a year
      if (hs && hs.kind === 'strip' && stopOf(hs.year) !== stopOf(cam.year)) { moved = true; rideTo(stopOf(hs.year), 0); return; }
      settle(); return;
    }
    if (dragging) {
      dragging = false;
      const now = performance.now(), s0 = samples[0], s1 = samples[samples.length - 1]; // the last ~90ms of the drag; a pause before release cancels the fling
      let v = 0; if (s0 && s1 && s1 !== s0 && s1[0] > s0[0] && now - s1[0] < 150) { v = -dragSign() * ((s1[1] - s0[1]) / ((s1[0] - s0[0]) / 1000)) * YPP; lastV = { v, n: samples.length, dt: s1[0] - s0[0] }; }
      if (Math.abs(v) > 30) fling(v); else settle();
      return;
    }
    if (d0[3] || Math.hypot(mx - d0[0], my - d0[1]) > 6) return;
    const h = hit(mx, my, ev.pointerType === 'touch');
    if (par().vert && cam.zoom > 0.5 && (!h || h.kind === 'loop')) { // the phone pulled back: a press lights a century and its line; a press on the lit one travels there
      const c = h ? h.cent : null; if (c == null || c !== hoverCent) { hoverCent = c; drawOverlay(); return; }
      hoverCent = null; moved = true; rideTo(stopOf(h.year), 0); return;
    }
    if (!h) return;
    if (h.kind === 'word') { tip.hide(); if (cam.zoom > 0.5) seat(); else pullBack(); return; }
    if (h.kind === 'strip') { tip.hide(); hover = null; moved = true; rideTo(stopOf(h.year), 0); return; }
    if (h.kind === 'loop') { moved = true; rideTo(stopOf(h.year), 0); return; }
    if (h.kind === 'src') { tip.hide(); window.open(h.url, '_blank', 'noopener'); return; } // the card's source, in its own tab
    if (h.kind === 'root' && par().vert) { // the phone: the one name unfolds the eight; a press on one lights it and folds the rest, a press on a lit one rests it
      if (h.chip) { rootOpen = !rootOpen; rootOpenKey = unitOf(cam.year).key; } else { rootPick = rootPick === h.i ? -1 : h.i; rootOpen = false; }
      rootLit = rootPick; sceneKey = ''; draw(); return; }
    if (h.kind === 'root') { rootLit = rootLit === h.i && ev.pointerType === 'touch' ? -1 : h.i; sceneKey = ''; draw(); return; } // a press on a lineage's name lights its line and brings out its pictures; a second press rests it
    if (h.kind === 'head' && par().vert) { tip.hide(); openUnit(unitOf(cam.year)); return; } // the phone: the unit in hand as a sheet
    if (h.kind === 'head') { cardOff = !cardOff; field = null; drawOverlay(); return; } // the phone heading: the card, or the decade's lines
    if (h.kind === 'dif') { tip.hide(); litHover = null; moved = true; rideTo(stopOf(h.s[0].invention.year), 0); return; } // a diffusion landing rides to the invention's year
    if (h.kind === 'claim' || h.kind === 'leap') { tip.hide(); open(h.pred); return; } // a claim or a forecast opens its record (stage 4d: fc:<index> has a pane of its own)
    if (h.e && par().vert && h.kind !== 'plate' && !(readPlate && readPlate.i === h.i)) { tip.hide(); readSel = { i: h.i, unit: unitOf(cam.year).key }; drawOverlay(); return; } // the phone: a first press reads the record on the plate
    if (h.e) { tip.hide(); open(h.e.id); }
  };
  const onWheel = (ev) => {
    ev.preventDefault();
    if (ev.ctrlKey) { if (ev.deltaY < 0) pullBack(); else seat(); return; } // a trackpad pinch
    if (cam.zoom > 0.02) { if (!ride) seat(); return; } // pulled back, a scroll is the way home: the camera seats at the year in hand, and the next scroll travels
    if (ev.deltaMode === 1 || ev.deltaMode === 2) { const dy = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? -ev.deltaX : ev.deltaY; nudge(-Math.sign(dy)); return; } // a line or page is a notch
    const dy = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? -ev.deltaX : ev.deltaY;
    if (Math.abs(dy) >= 50) { nudge(-Math.sign(dy)); return; } // a wheel notch is one stop; down or left is back in time
    glide(-dy * (cam.target < 2000 ? 10 : 1) / NOTCH_PX); // a trackpad glides: a stop's width per NOTCH_PX, seating on the nearest stop when the fingers stop
  };
  const onKey = (ev) => {
    if (!host || !host.isConnected || state.view !== 'spiral') return;
    const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || a.closest('#drawer, .drawer, [role=dialog]'))) return;
    const k = ev.key;
    if (k === '-' || k === '_') { ev.preventDefault(); pullBack(); return; }
    if (k === '=' || k === '+') { ev.preventDefault(); if (cam.zoom > 0.5) seat(); return; }
    // Enter opens the year or decade in hand as its sheet (the phone's unit sheet, the same pane a shared unit link
    // opens): every record in it is a button there, so the arrows and Enter reach any record without a pointer
    if (k === 'Enter' && !ev.metaKey && !ev.ctrlKey && !ev.altKey && (!a || a === document.body) && cam.zoom < 0.02 && !ride) { if (openUnit(unitOf(cam.year))) ev.preventDefault(); return; }
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    ev.preventDefault();
    // right is forward, and so is up: the past lies left and far on the desk, and underneath on a phone
    const dir = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowUp' ? 1 : -1;
    if (cam.zoom > 0.02) return;
    nudge(dir * (ev.shiftKey ? 10 : 1));
  };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', onLeave);
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', (ev) => { pointers.delete(ev.pointerId); down = null; dragging = false; scrubbing = false; pinch = null; });
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.style.touchAction = 'none';
  window.addEventListener('keydown', onKey);
  // a hash the page did not write (a link followed, the back button): its fy rides the camera there
  const onHashYear = () => { const y = parseFloat(hashParams().get('fy')); if (!Number.isFinite(y) || !ctx) return; const Y = clamp(Math.round(y), Y_LO, T1); if (Y !== Math.round(cam.year) || cam.zoom > 0.5) rideTo(Y, 0); };
  window.addEventListener('hashchange', onHashYear);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); });
  ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => size()) : null;
  if (ro) ro.observe(el);

  // a record opening stops travel; one whose cell is not on the stage brings the camera to it, and closing returns
  const onSel = () => {
    if (state.sel && unitSel() && !(db.pointById && db.pointById.has(state.sel))) { if (!openUnit(unitOfKey(state.sel))) selectRecord(''); return; } // a unit's sheet on a shared link is built here
    if (state.sel) {
      stop(); moved = false;
      const i = indexOf(state.sel), e = i >= 0 ? db.events[i] : null;
      const far = e && (cam.zoom > 0.5 || !(cellOn && i >= 0 && cellOn[i]));
      openAt = { year: cam.year, zoom: cam.zoom, rode: !!far };
      if (far) rideTo(stopOf(e.year), 0); else { field = null; if (par().vert) draw(); else drawOverlay(); }
    } else {
      if (openAt && openAt.rode && !moved) rideTo(openAt.year, openAt.zoom);
      openAt = null; field = null; if (par().vert) draw(); else drawOverlay();
    }
  };

  const api = { hit: (x, y) => hit(x, y), setYear, year, pullBack, seat, arrivalTargets, afterArrival, onReveal, rideTo, nudge, fling, settle, stopOf, dbg: () => { const V = view(par()); const Wf = freeW(); let rp = 0, rpOn = 0; for (let k = 0; k < picN; k++) if (G.picList[k].e.year < T0) { rp++; if (picOn[k]) rpOn++; } return { cells: cellTally(V), pointers: pointers.size, pinch: !!pinch, down: !!down, resting, ride: !!ride, picAnim, refAnim, mkAnim, tracing, glowT0, raf: !!raf, flowTimer: !!flowTimer, rim: rimOf(V), Wf, pos: fieldPos(V, V.P, Wf) ? 'on' : 'off', zoom: cam.zoom, textA, picN, rootPics: rp, rootPicsOn: rpOn, rootLit, picsReady, pics: pics ? pics.length : -1, momentPics: momentPics ? momentPics.length : -1 }; },
    get cam() { return { year: cam.year, target: cam.target, zoom: cam.zoom, vel: cam.vel, lift: cam.lift, resting, riding: !!ride }; },
    hitAt: (x, y) => { const h = hit(x, y); return h ? { kind: h.kind, id: h.e ? h.e.id : h.pred || null, year: h.year } : null; },
    cells: () => { const out = []; for (let i = 0; i < G.n && out.length < 5; i++) if (cellOn[i] && Math.abs(db.events[i].year - cam.year) < 30) out.push({ x: cellSX[i], y: cellSY[i], px: cellPX[i], id: db.events[i].id }); return out; },
    titles: () => lineHits.filter((t) => t.e).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h, id: t.e.id })),
    list: () => (field ? { key: field.key, label: field.label, sub: field.sub, items: field.events.map((it) => `${it.e.year} ${it.e.title_short}`), claims: field.claims.map((c) => `${c.who}: ${c.text}`) } : null),
    pics: () => picHits.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, id: p.e.id })),
    cellPx: () => { const out = []; for (let i = 0; i < G.n; i++) if (cellOn[i] && Math.abs(db.events[i].year - cam.year) <= 3) out.push(+cellPX[i].toFixed(2)); out.sort((a, b) => a - b); return { n: out.length, min: out[0], med: out[out.length >> 1], max: out[out.length - 1] }; },
    word: () => word, readout: () => readoutText, light: (id) => { litForce = id || null; drawOverlay(); }, lit: () => litLeap(), litCount: () => { const z = litNames(); return z ? z.size : 0; }, leaps: () => leapHits.map((t) => ({ ...t })), fit: () => fitPull(par()), get lastV() { return lastV; }, get linesA() { return linesA; },
    conns: () => (conn ? { key: conn.key, arcs: conn.arcs.length, lift: conn.lift.size } : null),
    read: () => (readPlate ? { id: readPlate.e.id, box: [readPlate.x, readPlate.y, readPlate.w, readPlate.h].map(Math.round), mark: [readPlate.mx, readPlate.my].map(Math.round), date: readPlate.L.date, name: readPlate.L.name.join(' '), nameLines: readPlate.L.name.length, lines: readPlate.L.lines, end: readPlate.L.end, top: Math.round(readPlate.top), fit: readPlate.fit } : null),
    plates: (iw, n = 3, list = false, m = n) => { const c = { records: 0, whole: 0, clause: 0, none: 0, cut: 0, nameLines: [0, 0, 0, 0], nameCut: 0 }, out = []; // every record's plate at one seat width: how each sentence ends
      for (let i = 0; i < G.n; i++) { const e = db.events[i]; if (!e.summary || e.kind === 'overlay') continue; const L = readLayout(octx, { e }, iw, n, m); c.records++; c.most = Math.max(c.most || 0, L.lines.length); c[L.end]++; c.nameLines[L.name.length]++;
        if (L.name.some((t) => t.endsWith('…'))) c.nameCut++; if (L.lines.some((t) => t.endsWith('…'))) c.cut++; if (list && L.end !== 'whole') out.push([e.id, L.end, L.lines.join(' ')]); }
      return list ? { ...c, list: out } : c; },
    touch: () => { const out = []; for (let i = 0; i < G.n; i++) if (cellOn[i] && cellSX[i] >= 0 && cellSX[i] <= W && cellSY[i] >= 0 && cellSY[i] <= H) out.push([+cellSX[i].toFixed(1), +cellSY[i].toFixed(1), +cellPX[i].toFixed(1), db.events[i].id]); return out; },
    hitAt: (mx, my, touch = true) => { const h = hit(mx, my, touch); return h ? { kind: h.kind, id: h.e ? h.e.id : null } : null; },
    markers: () => ({ shown: mkShown, decades: decPl.map((d) => d.map(Math.round)), labels: mkHits.map((h) => h.e.id), seats: mkHits.map((h) => [h.x, h.y, h.w, h.h].concat(h.mark || []).map(Math.round)) }),
    unit: () => { const u = unitOf(cam.year); return { key: u.key, y0: u.y0, y1: u.y1, label: u.label }; },
    roots: () => ({ open: rootOpen, pick: rootPick, tags: rootTags.map((t) => ({ box: [t.b.x0, t.b.y0, t.b.x1 - t.b.x0, t.b.y1 - t.b.y0].map(Math.round), fold: !!t.chip, i: t.chip ? -1 : t.i })) }),
    ref: () => (ref ? { id: ref.id, a: refA, sats: ref.sats.map((s) => s.e.id), hits: satHits.length } : null),
    redraw: () => { draw(true); return { ...prof }; },
    get prof() { return { ...prof }; }, get drawMs() { return prof.total; },
    get hits() { let cells = 0; if (cellOn) for (let i = 0; i < G.n; i++) cells += cellOn[i]; return { cells, pics: picHits.length, titles: lineHits.length }; },
    get ready() { return !!G && picsReady && db.loaded.has('past') && !!cellOn && !!(db.predictions && db.predictions.length); } };
  if (typeof window !== 'undefined') window.__helix = api;
  return {
    render(s, ch) { if (ch && (ch.has('*') || ch.has('y0') || ch.has('y1'))) size(); else if (ch && ch.has('sel')) onSel(); else if (ch && (ch.has('q') || ch.has('thread'))) drawOverlay(); },
    resize() { size(); },
    hover(id) { highlight = id || null; drawOverlay(); },
    teardown() {
      offData(); offUnit(); if (ro) ro.disconnect(); if (landingRaf) cancelAnimationFrame(landingRaf); if (raf) cancelAnimationFrame(raf); raf = 0; if (restTimer) clearTimeout(restTimer); restTimer = 0;
      cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('wheel', onWheel);
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; } window.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', onHashYear);
      ctx = octx = null; cv = ov = null; host = null; ride = null; cam.vel = 0; sceneKey = ''; groundCv = null; groundKey = ''; if (glideTimer) { clearTimeout(glideTimer); glideTimer = 0; }
      if (window.__helix === api) delete window.__helix;
      el.innerHTML = '';
    },
  };
}
