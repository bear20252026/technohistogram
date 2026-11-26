// A. THE STREAM: relative dominance of technology domains, Histomap style.
import { placeLabels } from '../labels.js';
import { DOMAINS, DOMAIN, domainColor } from '../palette.js';
import * as DATA from '../data.js';
import { passes, drawn, neighbors, draw as DRAW, registerFor } from '../data.js';
import { set, state as S, setHover } from '../store.js';
import { eventTip, esc } from '../ui.js';
import { timeScale, frac, unfrac, AGES, REGIONS, REGION, regionColor, YEAR_MAX, YEAR_MIN } from '../time.js';
import { recent } from '../recent.js';
import { drawLit, inPolygon } from '../lit.js';
import { popover } from '../hp_pop.js';
import { ATLAS, atlasLocator, locatorWidth } from '../atlas.js';
import { cxLinks, cxLinked, cxIndex, cxGraph, cxKey, cxSpan, cxFold, cxFoldList, cxFoldStop } from '../connect.js';

const STACKS = ['share', 'silhouette', 'wiggle', 'zero'];
// the hash keeps stack and weight in `m=`: '' share, 'wiggle', 'zero.count', 'count' ...; 'volume' from old links reads as wiggle
// Vision 4 addendum: five display families built from the 13 domain ids; one tap splits a family into its domains
export const FAMILIES = [
  { id: 'f-signal', label: 'Signal', short: 'Signal', long: 'Signal: computing, chips, internet, communications', domains: ['computing', 'semiconductors', 'internet', 'communications'], hue: 'signal' },
  { id: 'f-knowledge', label: 'Knowledge', short: 'Knowledge', long: 'Knowledge: media, society, software, home', domains: ['media', 'society', 'software', 'home'], hue: 'knowledge' },
  { id: 'f-power', label: 'Power', short: 'Power', long: 'Power: energy, materials', domains: ['energy', 'materials'], hue: 'power' },
  { id: 'f-movement', label: 'Movement', short: 'Movement', long: 'Movement: transport, space', domains: ['transport', 'space'], hue: 'movement' },
  { id: 'f-life', label: 'Life', short: 'Life', long: 'Life: biotech, health, agriculture', domains: ['biotech', 'health', 'agriculture'], hue: 'life' },
  { id: 'f-ai', label: 'Artificial intelligence', short: 'AI', long: 'Artificial intelligence', domains: ['ai'], hue: 'ai' },
];
// provisional steps per hue family, light to dark, after the 1931 poster; the tokens --h-<hue>-1..5 in palette.css replace them when present
const HUE_FALLBACK = {
  signal: ['#CFDDE8', '#9DBBD2', '#6B95B8', '#3F6F99', '#244C70'],
  knowledge: ['#E3D3E3', '#C7A6C9', '#A877AC', '#86508D', '#5F3268'],
  power: ['#F2D5C2', '#E6A982', '#D77B4B', '#BF5327', '#8E3815'],
  movement: ['#F1E3BF', '#E3CB84', '#D1AE4C', '#B48E2A', '#866515'],
  life: ['#D3E0CF', '#A9C4A3', '#7FA878', '#578A52', '#386536'],
  ai: ['#EBC7C9', '#D8909A', '#C25A66', '#A6303F', '#7A1824'],
};
const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
const famOf = Object.fromEntries(FAMILIES.flatMap((f) => f.domains.map((d) => [d, f.id])));
const DISP = (k) => FAM[k] || DOMAIN[k] || { label: k, short: k };
const parseMode = () => { const p = (S.mode || '').split('.'); const st = p[0] === 'volume' ? 'wiggle' : STACKS.includes(p[0]) ? p[0] : 'share'; return { stack: st, count: p.includes('count'), cx: p.includes('cx') }; };
const modeStr = (stack, count, cx) => [stack === 'share' ? '' : stack, count ? 'count' : '', cx ? 'cx' : ''].filter(Boolean).join('.');

// motion: the bands draw in left to right on first view, an isolated band morphs in place, lasso hits fly to the list;
// all of it is skipped under reduced motion (the static state carries the same information)
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduced-motion');
// where the piecewise time axis changes slope (time.js KNOTS); each one is marked on the axis
const BREAKS = [1500, 1800, 1900, 1950, 2000];
const INK = (a) => `rgba(18,18,18,${a})`;

// WCAG contrast between two colours (relative luminance on linearised sRGB)
function relLum(c) { const r = d3.rgb(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r.r) + 0.7152 * f(r.g) + 0.0722 * f(r.b); }
function contrast(a, b) { const la = relLum(a), lb = relLum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
function lum(hex) {
  const c = d3.rgb(hex);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

performance.mark('stream-module'); // the module has been evaluated (imports included)
export default function stream(el, { db, select, tip }) {
  const mountT0 = performance.now();
  el.innerHTML = `
    <div class="view-head st-cart"><h2>Technology Histomap <span class="st-span">1026 to 2026</span></h2>
      <p>What the record talks about most, century by century.</p>
      <div class="atlas-loc-host"></div>
    </div>
    <div class="view-ctl st-ctl hp-bar">
      <label class="st-range"><span class="sc">From</span><input class="st-y0" type="number" min="1026" max="2026" step="1" inputmode="numeric" aria-label="Start year"></label>
      <label class="st-range"><span class="sc">To</span><input class="st-y1" type="number" min="1026" max="2026" step="1" inputmode="numeric" aria-label="End year"></label>
      <label class="st-famwrap"><span class="sc">Family</span><select class="st-fam" aria-label="Domain family"><option value="">All five</option>${FAMILIES.map((f) => `<option value="${f.id}">${f.long}</option>`).join('')}</select></label>
      <button type="button" class="hp-act hp-popbtn" data-a="pop" aria-expanded="false" aria-controls="st-pop">Chart options</button>
      <div class="hp-pop" id="st-pop" role="group" aria-label="Chart options" hidden>
      <div class="hp-grp"><span class="sc">Stack</span>
        <div class="toggle" role="group" aria-label="Stack"><button type="button" data-st="share">Share</button><button type="button" data-st="silhouette">Silhouette</button><button type="button" data-st="wiggle">Wiggle</button><button type="button" data-st="zero">Zero</button></div></div>
      <div class="hp-grp"><span class="sc">Weight</span>
        <div class="toggle" role="group" aria-label="Weight"><button type="button" data-w="sig">Significance</button><button type="button" data-w="count">Count</button></div></div>
      <div class="hp-grp"><span class="sc">Draw</span>
        <div class="toggle" role="group" aria-label="Draw"><button type="button" data-reg="landmarks">Landmarks</button><button type="button" data-reg="all">All events</button></div>
        <button type="button" class="hp-act" data-ov aria-pressed="false">Period overlays</button></div>
      <div class="hp-grp"><span class="sc">Drag</span>
        <div class="toggle" role="group" aria-label="Drag"><button type="button" data-dg="reorder">Reorder bands</button><button type="button" data-dg="lasso">Lasso events</button></div>
        <button type="button" class="hp-act st-cx cx-draw" data-a="cx" aria-pressed="false">Connections</button></div>
      </div>
      <button type="button" class="hp-act st-all" data-a="all" hidden>Show all bands</button>
      <button type="button" class="hp-act st-back" data-a="back" hidden>&larr; All bands</button>
    </div>
    <div class="st-plot"><button type="button" class="st-earlier" hidden aria-label="Scroll up to the earlier centuries, from 1026">\u2191 Earlier, from 1026</button></div>`;
  // on phones the plot scrolls inside .st-plot while the head, toolbar and key stay; on desktop the wrapper is display: contents
  const plot = el.querySelector('.st-plot');
  const svg = d3.select(plot).append('svg').attr('role', 'group').attr('aria-label', 'Streamgraph of technology domains by year');
  const defs = svg.append('defs');
  // the camera moves gCam (the picture, not the axis or the margin notes); its frame clips the move to the plot so the picture never rides over the notes or the ticks
  const camClip = defs.append('clipPath').attr('id', 'st-camclip').append('rect');
  const gCam = svg.append('g').attr('clip-path', 'url(#st-camclip)').append('g').attr('class', 'st-cam');
  const gGrid = gCam.append('g');
  const gAreas = gCam.append('g');
  const gEdges = gCam.append('g');
  const gCuts = gCam.append('g').attr('class', 'st-cuts').style('pointer-events', 'none'); // full-height slanted cuts where the time scale changes
  const gOverlay = gCam.append('g').attr('class', 'st-overlay').style('pointer-events', 'none'); // period overlays, Vision 4 S6
  const gHover = gCam.append('g').attr('class', 'st-hover').style('pointer-events', 'none');
  const gRail = gCam.append('g').attr('class', 'st-rail');
  const gLasso = gCam.append('g').attr('class', 'st-lasso').style('pointer-events', 'none');
  const gNow = gCam.append('g').attr('class', 'st-now').style('pointer-events', 'none');
  const gLabels = gCam.append('g').style('pointer-events', 'none');
  const gTicks = gCam.append('g').style('pointer-events', 'none');
  const gArcs = gCam.append('g').style('pointer-events', 'none');
  const gLit = gCam.append('g').style('pointer-events', 'none');
  const gAxis = svg.append('g').attr('class', 'axis');
  const gAxis2 = svg.append('g').attr('class', 'axis');
  const hit = svg.append('rect').attr('class', 'st-hit').attr('fill', 'transparent');
  const gCx = svg.append('g').attr('class', 'cx-layer'); // the connections graph sits above the hit surface so its marks take the click
  const gSolo = svg.append('g').attr('class', 'st-solo').style('pointer-events', 'none');
  const gGhost = gCam.append('g').style('pointer-events', 'none');

  // first view: a clip that opens along the time axis, so the record arrives in date order
  const clipRect = defs.append('clipPath').attr('id', 'st-reveal').append('rect');
  [gAreas, gEdges, gLabels].forEach((g) => g.attr('clip-path', 'url(#st-reveal)'));
  let revealed = false, revealing = false, waitingIntro = false;
  function revealFull() { clipRect.interrupt().attr('x', -2).attr('y', -2).attr('width', W + 4).attr('height', H + 4); gGhost.select('.st-front').remove(); }
  // the one camera move: after the grow-in the view pushes toward the 2000 cut, holds, and settles back to the whole; then rest
  let cameraDone = false;
  function camera() {
    if (cameraDone || RM() || vertical || whereKey || S.y0 > 2000 || S.y1 < 2000) return;
    cameraDone = true;
    const node = gCam.node(), base = H - (vertical ? 30 : 48) - RB;
    node.style.transformBox = 'view-box'; node.style.transformOrigin = `${X(2000)}px ${(TOP + base) / 2}px`;
    node.style.transition = 'transform 900ms cubic-bezier(.4,0,.2,1)';
    requestAnimationFrame(() => { node.style.transform = 'scale(1.07)'; });
    setTimeout(() => { node.style.transition = 'transform 700ms cubic-bezier(.4,0,.2,1)'; node.style.transform = 'scale(1)'; }, 1300);
    setTimeout(() => { node.style.transition = ''; node.style.transform = ''; node.style.transformOrigin = ''; }, 2100);
  }
  function reveal() {
    if (revealed) { if (!revealing) revealFull(); return; }
    if (RM() || vertical) { revealed = true; revealFull(); return; } // phones and reduced motion: the river is simply there
    const [a] = U.range();
    // hold the closed clip while the introduction covers the map; start when it closes
    const closed = () => (vertical ? clipRect.attr('x', -2).attr('width', W + 4).attr('y', -2).attr('height', a + 2) : clipRect.attr('y', -2).attr('height', H + 4).attr('x', -2).attr('width', a + 2));
    if (document.body.classList.contains('intro-open')) {
      closed();
      if (!waitingIntro) { waitingIntro = true; addEventListener('histomap:intro-closed', () => { waitingIntro = false; reveal(); }, { once: true }); }
      return;
    }
    // the shell marks the view on stage a frame after its first render; the draw starts then
    if (!el.classList.contains('on')) { closed(); if (!waitingIntro) { waitingIntro = true; let n = 0; const tick = () => { if (el.classList.contains('on') || ++n > 90) { waitingIntro = false; reveal(); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); } return; }
    revealed = true; revealing = true;
    closed();
    const front = gGhost.append('line').attr('class', 'st-front');
    // Correlated Atlas: lanes grow left to right over 3s on an ease-out cubic; the names appear as the lanes reach their end
    const ends = gLabels.selectAll('.st-end').attr('opacity', 0);
    const T = clipRect.transition().duration(3000).ease(d3.easeCubicOut);
    const u1 = U.range()[1];
    if (vertical) T.attr('height', H + 4).tween('front', () => (k) => { const y = a + (H - a) * k; front.attr('x1', 44).attr('x2', W - 12).attr('y1', y).attr('y2', y); });
    else T.attrTween('width', () => (k) => `${a + (u1 - a) * k + 2}`).tween('front', () => (k) => { const x = a + (u1 - a) * k; front.attr('x1', x).attr('x2', x).attr('y1', TOP - 4).attr('y2', H - (vertical ? 30 : 48) - RB); });
    T.on('end interrupt', () => { revealing = false; front.remove(); clipRect.attr('width', W + 4).attr('height', H + 4); ends.transition().delay((d, i) => i * 90).duration(300).attr('opacity', 1); camera(); });
  }

  // in-memory agency: band order, one isolated band, drag mode and the lasso selection
  let order = null, solo = null, dragMode = 'reorder', lassoPoly = null;
  const split = new Set(); // families opened into their domains
  let whereKey = null, whereCensus = null; // after a band tap the region strip for that band stands in place of the chart
  const ctl = el.querySelector('.st-ctl');
  popover(ctl.querySelector('.hp-popbtn'), ctl.querySelector('.hp-pop'));
  const keyEl = document.createElement('p'); // the encoding sentence lives in the cartouche now; this element is never attached
  // the three controls in one row: year range, family, Chart options
  const y0In = ctl.querySelector('.st-y0'), y1In = ctl.querySelector('.st-y1'), famSel = ctl.querySelector('.st-fam');
  const applyRange = () => { let a = Math.round(+y0In.value), b = Math.round(+y1In.value); if (!Number.isFinite(a) || !Number.isFinite(b)) return; a = Math.max(YEAR_MIN, Math.min(YEAR_MAX, a)); b = Math.max(YEAR_MIN, Math.min(YEAR_MAX, b)); if (b < a) [a, b] = [b, a]; if (a !== S.y0 || b !== S.y1) set({ y0: a, y1: b }); else { y0In.value = a; y1In.value = b; } };
  y0In.addEventListener('change', applyRange); y1In.addEventListener('change', applyRange);
  famSel.addEventListener('change', () => { const f = famSel.value || null; if (f && split.has(f)) { split.delete(f); } solo = f; whereKey = null; render(S, new Set(['mode'])); });
  const locHost = el.querySelector('.atlas-loc-host');
  const loc = atlasLocator(locHost, { width: 260 });
  ctl.addEventListener('click', (ev) => {
    if (ev.target.closest('.st-all')) { solo = null; applySolo(); syncCtl(); return; }
    if (ev.target.closest('.st-back')) { leaveWhere(); return; }
    if (ev.target.closest('.st-cx')) { const m = parseMode(); if (!m.cx && S.sel) cx.sel = S.sel; set(m.cx || !S.sel ? { mode: modeStr(m.stack, m.count, !m.cx) } : { mode: modeStr(m.stack, m.count, true), sel: '' }); return; } // starting the mode with a record open picks it
    if (ev.target.closest('[data-ov]')) { DRAW.overlays = !DRAW.overlays; document.dispatchEvent(new CustomEvent('draw-change')); syncCtl(); return; }
    const b = ev.target.closest('.toggle button');
    if (!b) return;
    if (b.dataset.reg) { DRAW.register = b.dataset.reg; document.dispatchEvent(new CustomEvent('draw-change')); syncCtl(); return; }
    const m = parseMode();
    if (b.dataset.st) set({ mode: modeStr(b.dataset.st, m.count, m.cx) });
    else if (b.dataset.w) set({ mode: modeStr(m.stack, b.dataset.w === 'count', m.cx) });
    else if (b.dataset.dg) { dragMode = b.dataset.dg; syncCtl(); }
  });
  // the band names at the line ends are the isolate control; the filter row above is the only colour key
  const toggleSolo = (id) => { solo = solo === id ? null : id; applySolo(); syncCtl(); };
  const gutterRow = (ev) => { if (vertical || !GUT) return null; const [mx, my] = d3.pointer(ev, svg.node()); if (mx <= U.range()[1] + 2) return null; let best = null, bd = 8; for (const q of endRowsNow) { const dd = Math.abs(q.y - my); if (dd < bd) { bd = dd; best = q; } } return best; };
  function syncCtl() {
    const m = parseMode();
    ctl.querySelectorAll('[data-st]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.st === m.stack)));
    ctl.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.w === 'count') === m.count)));
    ctl.querySelectorAll('[data-dg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dg === dragMode)));
    ctl.querySelectorAll('[data-reg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reg === registerFor(S))));
    ctl.querySelector('[data-ov]').setAttribute('aria-pressed', String(!!DRAW.overlays));
    const cxb = ctl.querySelector('.st-cx'); if (cxb) cxb.setAttribute('aria-pressed', String(!!m.cx));
    hit.attr('class', `st-hit ${dragMode === 'lasso' ? 'lasso' : 'grab'}`);
    const allBtn = ctl.querySelector('.st-all'); if (allBtn) { allBtn.hidden = !solo || !!FAM[solo]; if (solo) allBtn.textContent = `Show all bands (${DISP(solo).short || DISP(solo).label} isolated)`; }
    famSel.value = solo && FAM[solo] ? solo : ''; y0In.value = S.y0; y1In.value = S.y1;
    ctl.querySelector('.st-back').hidden = !whereKey;
    el.querySelector('.st-span').textContent = `${S.y0} to ${S.y1}`;
    gLabels.selectAll('.st-end').attr('aria-pressed', (d, i, n) => String(n[i].getAttribute('data-d') === solo));
  }
  // the other bands stay as a faint ghost of the stacked state, so the isolated band is read against where it came from
  const bandOp = (key) => (solo && key !== solo ? 0.1 : 1);
  // isolate: the same band morphs from its place in the stack to a single area chart on the baseline (no fade out and back)
  function applySolo() {
    hoverBand(null);
    gSolo.selectAll('*').remove();
    gLabels.interrupt().attr('opacity', 0);
    const T = svg.transition('solo').duration(RM() ? 0 : 600).ease(d3.easeCubicInOut);
    gAreas.selectAll('path').transition(T).attr('d', shape).attr('opacity', (l) => bandOp(l.key));
    gEdges.selectAll('path').transition(T).attr('d', shape).attr('opacity', (l) => bandOp(l.key));
    T.on('end', () => { soloLayer(); labels(); gLabels.transition().duration(RM() ? 0 : 250).attr('opacity', 1); });
  }

  let TOP = 158;
  let yearN = new Map(), W, H, vertical, U, V, layers = [], samples = [], evs = [], byDomain = new Map(), stackKeys = [];
  // Correlated Atlas: with five families or fewer on stage the lanes take the five atlas hues in lane order; otherwise the domain palette
  const hueOf = (key) => (FAM[key] || FAM[famOf[key]] || {}).hue || 'signal';
  const stepsCache = new Map(); // cleared each render so re-anchored tokens take effect
  const tokenOf = (name) => (getComputedStyle(el).getPropertyValue(name) || '').trim();
  // the five steps of a display key: a family reads --h-<hue>-1..5, a split domain its own --h-<hue>-<domain>-1..5 (palette.css), with provisional steps behind
  const steps = (key) => {
    if (stepsCache.has(key)) return stepsCache.get(key);
    const hue = hueOf(key), base = FAM[key] ? `--h-${hue}` : `--h-${hue}-${key}`;
    let out = HUE_FALLBACK[hue].map((fb, i) => tokenOf(`${base}-${i + 1}`) || '');
    if (out.some((c) => !c)) { const fam = HUE_FALLBACK[hue].map((fb, i) => tokenOf(`--h-${hue}-${i + 1}`) || fb); const shift = FAM[key] ? 0 : Math.min(2, FAM[famOf[key]].domains.indexOf(key)); out = fam.map((c, i) => fam[Math.max(0, i - shift)]); }
    stepsCache.set(key, out); return out;
  };
  // the name's ink on a pale run: the family's label token (its dark step), never white on a pastel ribbon
  const labelInk = (key) => steps(key)[4]; // the family's (or split domain's) darkest step
  // the time step: bands pale toward 1026 and saturate toward the present, in the six periods' steps
  const PERIOD_STEP = [0, 0, 1, 2, 3, 4];
  const stepAt = (key, year) => { const i = Math.max(0, AGES.findIndex((a) => year >= a.start && year < a.end)); return PERIOD_STEP[i] ?? 4; };
  const colAt = (key, year) => steps(key)[stepAt(key, year)];
  const col = (key) => steps(key)[3];
  // the band's fill: one stepped ramp along x per band, hard stops at the period edges
  const bandFill = (key) => {
    const id = `st-ramp-${key}`;
    let g = defs.select(`#${id}`);
    if (g.empty()) g = defs.append('linearGradient').attr('id', id).attr('class', 'st-ramp').attr('gradientUnits', 'userSpaceOnUse');
    const x0 = U(frac(YEAR_MIN)), x1 = U(frac(YEAR_MAX + 1));
    g.attr('x1', vertical ? 0 : x0).attr('x2', vertical ? 0 : x1).attr('y1', vertical ? x0 : 0).attr('y2', vertical ? x1 : 0);
    const stops = [];
    AGES.forEach((a, i) => { const c = colAt(key, a.start), o0 = (U(frac(a.start)) - x0) / (x1 - x0), o1 = (U(frac(Math.min(a.end, YEAR_MAX + 1))) - x0) / (x1 - x0); stops.push([o0, c], [o1, c]); });
    g.selectAll('stop').data(stops).join('stop').attr('offset', (d) => `${Math.round(d[0] * 10000) / 100}%`).attr('stop-color', (d) => d[1]);
    return `url(#${id})`;
  };
  let hoverDomain = null;

  const headEl = el.querySelector('.view-head');
  let plotTop = 216; // the measured foot of the head stack on desktop: head, toolbar, key, each placed under the one before
  const MIN_PLOT = 160;
  function layout() {
    const r = el.getBoundingClientRect();
    W = r.width;
    vertical = W < 700;
    if (!vertical) {
      // the cartouche sits top left and the control row top right; the plot starts under the taller of the two, leaving the era notes their two lines
      const foot = Math.max(headEl.getBoundingClientRect().bottom, ctl.getBoundingClientRect().bottom) - r.top;
      plotTop = Math.max(120, Math.round(foot + 46)); // one period line above the plot
    }
    const reserve = plotTop + MIN_PLOT + 38 + 20; // the plot keeps at least MIN_PLOT px; a short view scrolls instead of squeezing
    // phone budget (two screens for the tab): the river is capped at 1.2 screens; the warped axis keeps the recent decades legible inside it
    H = vertical ? Math.max(plot.clientHeight || 300, Math.min(Math.round((window.innerHeight || 844) * 1.2), (S.y1 - S.y0 + 1) * 24 + 160)) : Math.max(r.height, reserve);
    el.classList.toggle('scroll-y', vertical || H > r.height + 1);
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  }

  function compute() {
    // all smoothing happens in warped axis space (frac of the millennium axis), so a band's width is
    // what the eye sees per pixel whether the window is a decade or a thousand years
    const y0 = S.y0, y1 = S.y1 + 1;
    const w0 = frac(y0), w1 = frac(y1);
    const wspan = w1 - w0;
    const step = wspan / (vertical ? 60 : 220); // phone density: 60 samples against 220, so the paths carry a quarter of the points
    const sigma = wspan / (vertical ? 40 : 70); // on phones the kernel widens with the coarser sampling so the paths stay smooth
    samples = d3.range(w0, w1 + step / 2, step);
    evs = db.events.filter((e) => drawn(e, S, true)); // the register (landmarks or all) and the period overlays, Vision 4 S5 and S6
    const { stack, count } = parseMode();
    const share0 = stack === 'share';
    const pad = (y1 - y0) * 0.06;
    const visible = evs.filter((e) => e.t >= y0 - pad && e.t <= y1 + pad);
    visible.forEach((e) => { e.w = frac(e.t); });
    // sparse stretches: widen the smoothing window (up to about 3x) where few events exist, in share mode
    const allW = visible.map((e) => e.w).sort((a, b) => a - b);
    const near = (w, h) => d3.bisectLeft(allW, w + h) - d3.bisectLeft(allW, w - h);
    const sigAt = (w) => (share0 ? Math.max(sigma, Math.min(3.3 * sigma, sigma * Math.sqrt(14 / Math.max(1, near(w, 1.5 * sigma))))) : sigma);
    yearN = d3.rollup(visible, (v) => v.length, (e) => e.year);
    const have = DOMAINS.filter((d) => S.domains.has(d.id)).map((d) => d.id);
    const kOf = (dom) => (split.has(famOf[dom]) ? dom : famOf[dom]);
    db.events.forEach((e) => { e._sk = kOf(e.domain); });
    stepsCache.clear(); // the display key: the family, or the domain once its family is split
    const doms = [];
    for (const f of FAMILIES) { const ds = f.domains.filter((d) => have.includes(d)); if (!ds.length) continue; if (split.has(f.id)) doms.push(...ds); else doms.push(f.id); }
    byDomain = new Map(doms.map((d) => [d, []]));
    visible.forEach((e) => byDomain.get(e._sk)?.push(e));
    const rows = samples.map((w) => { const sg = sigAt(w); return { t: w, k2: 2 * sg * sg }; });
    for (const d of doms) {
      const list = byDomain.get(d);
      for (const r of rows) {
        let v = 0;
        const k2 = r.k2;
        for (const e of list) { const dt = e.w - r.t; if (dt * dt < 9 * k2) v += (count ? 1 : 0.6 + e.significance) * Math.exp(-(dt * dt) / k2); }
        r[d] = v + 0.015; // floor keeps faint streams alive like the Histomap
      }
    }
    // order: weighted mean time, earliest at top
    const mean = (d) => { const l = byDomain.get(d); return l.length ? d3.mean(l, (e) => e.t) : 3000; };
    stackKeys = doms.slice().sort((a, b) => mean(a) - mean(b));
    // a visitor's order wins; domains it does not name keep their place by mean time
    if (order) { const o = order.filter((d) => doms.includes(d)); stackKeys = [...o, ...stackKeys.filter((d) => !o.includes(d))]; }
    if (solo && !doms.includes(solo)) solo = null;
    const share = share0;
    const offset = share ? d3.stackOffsetExpand : stack === 'silhouette' ? d3.stackOffsetSilhouette : stack === 'zero' ? d3.stackOffsetNone : d3.stackOffsetWiggle;
    const st = d3.stack().keys(stackKeys).offset(offset).order(d3.stackOrderNone)(rows);
    if (!share) { // recenter so the stack starts at zero
      const lo = d3.min(st, (l) => d3.min(l, (p) => p[0])), hi = d3.max(st, (l) => d3.max(l, (p) => p[1]));
      st.forEach((l) => l.forEach((p) => { p[0] -= lo; p[1] -= lo; }));
      st.domainMax = hi - lo;
    } else st.domainMax = 1;
    layers = st;
  }

  let X, RB = 0; // X: year -> pixel (warped); RB: height of the region strip
  function scales() {
    RB = 0; // the region strip no longer sits under the chart: after a band tap it stands in the chart's place
    // on phones the head is in flow above the plot, so the plot needs only the age line
    const top = (TOP = vertical ? 36 : plotTop), bottom = (vertical ? 24 : 56) + RB, left = vertical ? 44 : 16, right = vertical ? 12 : 16;
    // the right gutter holds the band names at their ends (and the hovered band's value); wide enough for the longest name
    GUT = vertical ? 0 : cx.on ? 300 : 120; // the names sit inside the bands; the gutter keeps the region names and any band too thin to carry its own
    if (!vertical) {
      U = d3.scaleLinear().domain([frac(S.y0), frac(S.y1 + 1)]).range([left, W - right - GUT]);
      // zero baseline rises from the floor; the other stacks hang from the top
      V = d3.scaleLinear().domain([0, layers.domainMax]).range(parseMode().stack === 'zero' ? [H - bottom, top] : [top, H - bottom]);
    } else {
      U = d3.scaleLinear().domain([frac(S.y0), frac(S.y1 + 1)]).range([top, H - bottom]);
      V = d3.scaleLinear().domain([0, layers.domainMax]).range([left, W - right]);
    }
    X = timeScale({ domain: [S.y0, S.y1 + 1], range: U.range() });
  }

  const area = () => (vertical
    ? d3.area().y((d, i) => U(samples[i])).x0((d) => V(d[0])).x1((d) => V(d[1])).curve(d3.curveBasis)
    : d3.area().x((d, i) => U(samples[i])).y0((d) => V(d[0])).y1((d) => V(d[1])).curve(d3.curveBasis));
  // the isolated band as its own area chart: baseline at the plot floor, height its value, on the lower 60 percent
  // of the plot so the upper band holds its name, the peak callout and the decade bars
  const soloH = () => (vertical ? 0.5 : 0.6);
  function soloScale() {
    const L = layers.find((l) => l.key === solo);
    const r = V.range(), lo = Math.min(r[0], r[1]), hi = Math.max(r[0], r[1]);
    const vmax = L ? d3.max(L, (p) => p[1] - p[0]) || 1 : 1;
    // horizontal: floor is the bottom of the plot; vertical: the left edge
    return vertical ? d3.scaleLinear().domain([0, vmax]).range([lo, lo + soloH() * (hi - lo)]) : d3.scaleLinear().domain([0, vmax]).range([hi, hi - soloH() * (hi - lo)]);
  }
  // pixel extent of layer L across the stack axis at sample i, for the current state
  function bandAt(L, i) {
    if (solo && L.key === solo) { const s = soloScale(); return [s(0), s(L[i][1] - L[i][0])]; }
    return [V(L[i][0]), V(L[i][1])];
  }
  function shape(L) {
    if (!(solo && L.key === solo)) return area()(L);
    const s = soloScale(), b = s(0);
    const A = vertical ? d3.area().y((d, i) => U(samples[i])).x0(() => b).x1((d) => s(d[1] - d[0])) : d3.area().x((d, i) => U(samples[i])).y0(() => b).y1((d) => s(d[1] - d[0]));
    return A.curve(d3.curveBasis)(L);
  }
  const idxOf = (t) => Math.max(0, Math.min(samples.length - 1, Math.round((frac(t) - samples[0]) / (samples[1] - samples[0]))));

  function pos(t, d) { // center of domain d's band at time t -> [x,y]
    const L = layers.find((l) => l.key === d);
    if (!L) return null;
    const w = frac(t);
    const i = idxOf(t);
    const [a, b] = bandAt(L, i);
    const c = (a + b) / 2;
    return vertical ? [c, U(w)] : [U(w), c];
  }

  function draw(animate) {
    if (vertical) animate = false; // phone density: bands and labels land in place, no per-band motion
    const T = animate ? svg.transition().duration(650).ease(d3.easeCubicOut) : null;
    // grid & axes
    const ticks = X.ticks(vertical ? 40 : 56);
    const base = H - (vertical ? 30 : 48) - RB; // baseline of the stream
    camClip.attr('x', -2).attr('y', vertical ? -2 : TOP - 1).attr('width', W + 4).attr('height', vertical ? H + 4 : base - TOP + 3);
    gGrid.selectAll('line').data(ticks, (d) => d).join('line')
      .attr('x1', (d) => (vertical ? 0 : X(d))).attr('x2', (d) => (vertical ? W : X(d)))
      .attr('y1', (d) => (vertical ? X(d) : TOP - 4)).attr('y2', (d) => (vertical ? X(d) : base))
      .attr('stroke', (d) => (X.major(d) ? INK(0.3) : INK(0.1))).attr('stroke-width', 1);
    const mono = (sel) => sel.attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', '#6e6e6a');
    // period overlays: the European period entries (kind overlay) as labelled ribbons across the plot, in both orientations,
    // only while the Period overlays toggle is on (evs holds them only then); they are not events in any census
    gOverlay.selectAll('*').remove();
    evs.filter((e) => e.kind === 'overlay' && (e.end_year || e.year + 50) >= S.y0 && e.year <= S.y1 + 1).sort((p, q) => p.year - q.year).forEach((o, i) => {
      const a = U(frac(Math.max(o.year, S.y0))), b = U(frac(Math.min(o.end_year || o.year + 50, S.y1 + 1)));
      const g = gOverlay.append('g').attr('role', 'img').attr('aria-label', `Period overlay: ${o.title_short}, ${o.year} to ${o.end_year || '?'}`);
      const lab = `${o.title_short} \u00b7 ${o.year} to ${o.end_year || ''}`.replace(/ to $/, '').toUpperCase();
      if (!vertical) {
        g.append('rect').attr('x', a).attr('width', Math.max(2, b - a)).attr('y', TOP).attr('height', Math.max(0, base - TOP)).attr('fill', INK(0.07));
        g.append('line').attr('x1', a).attr('x2', a).attr('y1', TOP).attr('y2', base).attr('stroke', INK(0.5)).attr('stroke-dasharray', '2 3');
        mono(g.append('text').attr('x', a + 5).attr('y', TOP + 13 + i * 14).attr('letter-spacing', '0.06em')).attr('fill', '#3b3935').attr('stroke', 'rgba(247,245,240,.9)').attr('stroke-width', 3).attr('paint-order', 'stroke').text(lab);
      } else {
        const [l, r] = V.range();
        g.append('rect').attr('y', a).attr('height', Math.max(2, b - a)).attr('x', Math.min(l, r)).attr('width', Math.abs(r - l)).attr('fill', INK(0.07));
        g.append('line').attr('y1', a).attr('y2', a).attr('x1', Math.min(l, r)).attr('x2', Math.max(l, r)).attr('stroke', INK(0.5)).attr('stroke-dasharray', '2 3');
        mono(g.append('text').attr('x', Math.min(l, r) + 5).attr('y', a + 13).attr('letter-spacing', '0.06em')).attr('fill', '#3b3935').attr('stroke', 'rgba(247,245,240,.9)').attr('stroke-width', 3).attr('paint-order', 'stroke').text(lab);
      }
    });
    if (!vertical) {
      gAxis.selectAll('*').remove();
      gAxis.attr('transform', `translate(0,${base})`);
      mono(gAxis.selectAll('text').data(ticks).join('text').attr('x', (d) => (X(d) < U.range()[0] + 14 ? U.range()[0] : X(d))).attr('y', 13).attr('text-anchor', (d) => (X(d) < U.range()[0] + 14 ? 'start' : 'middle')).attr('fill', (d) => (X.major(d) ? '#121212' : '#6e6e6a')).text((d) => d));
      // ages as a quiet top rail
      gAxis2.selectAll('*').remove();
      gAxis2.attr('transform', `translate(0,${TOP - 8})`);
      const ages = AGES.filter((a) => a.end > S.y0 && a.start < S.y1 + 1);
      gAxis2.append('line').attr('x1', U.range()[0]).attr('x2', U.range()[1]).attr('y1', 0).attr('y2', 0).attr('stroke', INK(0.4));
      const ag = gAxis2.selectAll('g').data(ages).join('g');
      ag.append('line').attr('x1', (a) => X(Math.max(S.y0, a.start)) + 0.5).attr('x2', (a) => X(Math.max(S.y0, a.start)) + 0.5).attr('y1', 0).attr('y2', 4).attr('stroke', INK(0.4));
      // the period line, printed once: years, then the materials and techniques that name the span (time.js); years alone when the span is narrow, nothing when even they do not fit
      const pxOf = (a) => X(Math.min(S.y1 + 1, a.end)) - X(Math.max(S.y0, a.start)) - 8; // the span's width less the 3px inset and a 5px gap to the next span
      const CH = 7.1; // Instrument Sans at 11px with 0.08em tracking
      const fits = (t, px) => px > t.length * CH;
      // council round 8: one line per span, never wrapped. The years keep their tracking; the technique part tries
      // full tracking, then none, then the whole line untracked (still 11px); when none fits the span's width (rendered widths decide) the years print alone
      const x0of = (a) => Math.max(X(Math.max(S.y0, a.start)), U.range()[0]) + 3; // inset to the visible plot, as the axis ticks are
      const era = ag.append('text').attr('class', 'st-era').attr('x', x0of).attr('y', -4).attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', '#3a3a38').attr('letter-spacing', '0.08em');
      era.each(function (a) {
        const t = d3.select(this), px = pxOf(a), yrs = a.short.toUpperCase(), tech = ` \u00b7 ${a.label}`.toUpperCase();
        const setParts = (parts) => t.selectAll('tspan').data(parts).join('tspan').attr('letter-spacing', (d) => d.ls).text((d) => d.text);
        const over = () => this.getComputedTextLength() > px;
        const tries = [[{ text: yrs, ls: null }, { text: tech, ls: '0.08em' }], [{ text: yrs, ls: null }, { text: tech, ls: '0' }], [{ text: yrs, ls: '0' }, { text: tech, ls: '0' }], [{ text: yrs, ls: null }], []];
        for (const parts of tries) { setParts(parts); if (!parts.length || !over()) break; }
      });
    } else {
      gAxis.selectAll('*').remove();
      gAxis.attr('transform', `translate(40,0)`);
      mono(gAxis.selectAll('text').data(ticks).join('text').attr('x', -4).attr('y', X).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => d));
      gAxis2.selectAll('*').remove();
    }
    // thin-record marks: stretches with few recorded events (shares there rest on few items)
    gGrid.selectAll('.sparse').remove();
    if (false && !vertical && parseMode().stack === 'share') { // the foot bars are gone: thinness lives in the where strip, in one unit (events per century per region)
      const bin = S.y1 - S.y0 > 300 ? 10 : 1;
      const thin = d3.range(Math.floor(S.y0 / bin) * bin, S.y1 + 1, bin).filter((y) => d3.sum(d3.range(y, y + bin), (yy) => yearN.get(yy) || 0) < 6);
      gGrid.selectAll('rect.sparse').data(thin).join('rect').attr('class', 'sparse').attr('x', (y) => X(Math.max(S.y0, y))).attr('width', (y) => Math.max(0, X(Math.min(S.y1 + 1, y + bin)) - X(Math.max(S.y0, y)))).attr('y', base).attr('height', 3).attr('fill', INK(0.35));
      thinNote = thin.length ? `\u25aa thin record: under 6 events that ${bin === 10 ? 'decade' : 'year'}, smoothing widened` : '';
    } else thinNote = '';

    // the band edge is a hairline in ink; the old print hatch encoded nothing and is gone
    const paths = gAreas.selectAll('path').data(layers, (d) => d.key).join(
      (enter) => enter.append('path').attr('fill', (d) => bandFill(d.key)).attr('d', shape).attr('opacity', 0),
    );
    layers.forEach((d) => bandFill(d.key));
    (T ? paths.transition(T) : paths).attr('d', shape).attr('opacity', (d) => bandOp(d.key)).attr('fill', (d) => bandFill(d.key));
    const edges = gEdges.selectAll('path').data(layers, (d) => d.key).join('path')
      .attr('fill', 'none').attr('stroke', 'var(--paper, #faf8f3)').attr('stroke-width', 0.75).style('pointer-events', 'none'); // 0.75px paper hairlines part the bands
    (T ? edges.transition(T) : edges).attr('d', shape).attr('opacity', (d) => bandOp(d.key));
    gSolo.selectAll('*').remove();
    if (T) T.on('end', () => { soloLayer(); labels(); }); else { soloLayer(); labels(); }
    if (T) gLabels.transition().duration(150).attr('opacity', 0).transition().delay(500).duration(300).attr('opacity', 1);
    hit.attr('x', 0).attr('y', vertical ? 0 : TOP - 4).attr('width', W).attr('height', vertical ? H : base + 8 - TOP);
    const where = !!whereKey && !vertical;
    [gAreas, gEdges, gLabels, gSolo, gLit, gArcs, gTicks, gOverlay, gNow, gHover, gLasso].forEach((g) => g.attr('display', where ? 'none' : null));
    hit.style('pointer-events', where ? 'none' : null);
    el.classList.toggle('st-where', where);
    yearRail(base);
    if (where) regions(TOP + 44, base); else gRegion.selectAll('*').remove();
    cuts(base);
    nowBand(base);
    relit();
    drawLasso();
    contract();
    reveal();
  }

  // ---- persistent year rail: the whole millennium under the axis, the current window as a crisp ink bar,
  // and a break mark wherever the time scale changes, with the stretch of each section printed at its start ----
  let thinNote = '';
  // the scale breaks as slanted cuts through the whole river: a ground slit with ink edges, leaning the way the axis stretches
  function cuts(base) {
    gCuts.selectAll('*').remove();
    if (vertical) return;
    const inWin = BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1);
    const lean = Math.max(24, (base - TOP) * 0.12);
    inWin.forEach((k) => {
      const x = X(k), g = gCuts.append('g').attr('role', 'img').attr('aria-label', `The time scale changes at ${k}`);
      g.append('path').attr('d', `M${x - lean / 2},${base}L${x + lean / 2},${TOP}`).attr('stroke', 'var(--paper, #faf8f3)').attr('stroke-width', 3).attr('fill', 'none');
      g.append('path').attr('d', `M${x - lean / 2 - 2},${base}L${x + lean / 2 - 2.5},${TOP}M${x - lean / 2 + 2.5},${base}L${x + lean / 2 + 2.5},${TOP}`).attr('stroke', INK(0.5)).attr('stroke-width', 0.7).attr('fill', 'none');
    });
  }
  function yearRail(base) {
    gRail.selectAll('*').remove();
    const mono = (s, fs = 10.5) => s.attr('font-family', 'Instrument Sans, monospace').attr('font-size', fs).attr('fill', '#6e6e6a').attr('letter-spacing', '0.06em');
    const [u0, u1] = U.range();
    const inWin = BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1);
    const full = S.y0 <= 1026 && S.y1 >= 2026;
    // average pixels per year across the window; a section's stretch is its own pixels per year against it
    const avg = (u1 - u0) / (S.y1 + 1 - S.y0);
    const stretch = (a, b) => (X(b) - X(a)) / (b - a) / avg;
    const fmt = (k) => (k < 1 ? k.toFixed(1) : k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)) + '\u00d7';
    if (vertical) {
      // phone: the rail runs down the left edge; breaks cross the year labels' gutter
      const rx = 4, ry = (t) => u0 + frac(t) * (u1 - u0);
      gRail.append('rect').attr('x', rx).attr('width', 3).attr('y', u0).attr('height', u1 - u0).attr('fill', 'var(--ground-3)');
      gRail.append('rect').attr('class', 'st-rail-win').attr('x', rx).attr('width', 3).attr('y', ry(S.y0)).attr('height', Math.max(2, ry(S.y1 + 1) - ry(S.y0)));
      inWin.forEach((k) => gRail.append('path').attr('class', 'st-break').attr('d', `M${36},${X(k) - 1.5}l8,-3M${36},${X(k) + 2.5}l8,-3`).append('title').text(`The time scale changes at ${k}`));
      return;
    }
    return; // on desktop the page's own locator runs along the foot; the view draws no second rail
    // eslint-disable-next-line no-unreachable
    const y = base + 27, rx = (t) => u0 + frac(t) * (u1 - u0);
    gRail.append('rect').attr('x', u0).attr('width', u1 - u0).attr('y', y).attr('height', 3).attr('fill', 'var(--ground-3)');
    // centuries as hairline notches so the rail reads as a scale
    gRail.selectAll('line.c').data(d3.range(1100, 2001, 100)).join('line').attr('class', 'c').attr('x1', rx).attr('x2', rx).attr('y1', y).attr('y2', y + 3).attr('stroke', 'var(--ground)').attr('stroke-width', 1);
    const a = rx(S.y0), b = rx(S.y1 + 1);
    if (!full) {
      // a funnel from the window on the rail up to the plot's edges: this crop of the millennium is what is drawn above
      gRail.append('path').attr('class', 'st-funnel').attr('d', `M${a},${y}L${u0},${base + 19}M${b},${y}L${u1},${base + 19}`);
    }
    gRail.append('rect').attr('class', 'st-rail-win').attr('x', a).attr('width', Math.max(2, b - a)).attr('y', y - 1).attr('height', 5)
      .append('title').text(`Showing ${S.y0} to ${S.y1}, inside 1026 to 2026`);
    mono(gRail.append('text').attr('class', 'st-rail-span').attr('x', u1 + 22).attr('y', y + 1.5).attr('dy', '0.35em').text('1026 TO 2026'));
  }

  // the encoding contract and the denominator, in a fixed footer band
  const contractEl = document.createElement('p');
  contractEl.className = 'st-contract';
  el.appendChild(contractEl);
  function contract() {
    const { stack, count } = parseMode();
    const what = count ? 'events' : 'significance-weighted events';
    const width = stack === 'share' ? `band height is each domain's share of ${what}` : `band height is the volume of ${what}`;
    const n = evs.filter((e) => e.kind !== 'overlay' && e.t >= S.y0 && e.t <= S.y1 + 1).length; // overlays are not events in the census
    const fam = stackKeys.length <= ATLAS.length ? 'family, atlas hues in lane order' : 'domain';
    keyEl.textContent = `${width}; color = ${fam}; x = year, stretched toward the present, // marks a change of scale`;
    const lastT = d3.max(evs, (e) => e.t) || YEAR_MAX, ly = Math.floor(lastT), lm = Math.min(11, Math.max(0, Math.floor((lastT - ly) * 12)));
    const txt = [`${n.toLocaleString('en-US')} sourced events, ${S.y0} to ${S.y1}`, `record through ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][lm]} ${ly}`, 'every event cites its source'];
    if (thinNote && !whereKey) txt.splice(1, 0, thinNote);
    if (whereKey && whereCensus) txt.splice(1, 0, `${DISP(whereKey).label}: ${whereCensus.total.toLocaleString('en-US')} landmarks placed`, 'thin: under 6 events per century per region, whole record');
    contractEl.innerHTML = txt.map((t) => `<span>${esc(t)}</span>`).join('');
    contractEl.title = txt.join('. ');
  }

  // ---- isolate: the band's name, its peak (one primary callout), its two strongest events and a straight bar
  // inset of its busiest decades, all in the band of plot the area chart leaves empty ----
  let soloCalled = new Set(), GUT = 0;
  function soloLayer() {
    gSolo.selectAll('*').remove();
    soloCalled = new Set();
    if (!solo) return;
    const L = layers.find((l) => l.key === solo);
    if (!L) return;
    const s = soloScale();
    const r = V.range(), lo = Math.min(r[0], r[1]), hi = Math.max(r[0], r[1]);
    const [u0, u1] = U.range();
    const n = samples.length;
    const { stack } = parseMode();
    const val = (i) => L[i][1] - L[i][0];
    const pct = stack === 'share';
    const fmtV = (v) => (pct ? `${Math.round(v * 100)}%` : v.toFixed(1));
    const pt = (i) => (vertical ? [s(val(i)), U(samples[i])] : [U(samples[i]), s(val(i))]);
    const mono = (sel, fs = 10.5) => sel.attr('font-family', 'Instrument Sans, monospace').attr('font-size', Math.max(10.5, fs)).attr('letter-spacing', '0.06em').attr('fill', '#3a3a38');
    // the free field: above the area (horizontal) or right of it (phone)
    const box = vertical ? { x: lo + soloH() * (hi - lo) + 10, y: u0 + 6, w: hi - (lo + soloH() * (hi - lo)) - 14, h: 260 } : { x: u0 + 8, y: lo + 4, w: u1 - u0 - 16, h: (1 - soloH()) * (hi - lo) - 10 };
    const g = gSolo.append('g').attr('class', 'st-solo-in');
    // name and encoding, flush left in the free field
    const label = DISP(solo).label;
    const fsName = vertical ? 16 : 26;
    // on the phone the free field is narrow, so the name and its caption hang from the right edge
    const nx = vertical ? box.x + box.w : box.x, na = vertical ? 'end' : 'start';
    g.append('text').attr('x', nx).attr('y', box.y + fsName * 0.85).attr('text-anchor', na).attr('font-family', 'Instrument Serif, serif').attr('font-size', fsName).attr('fill', '#121212').text(label);
    mono(g.append('text').attr('x', nx).attr('y', box.y + fsName + 14).attr('text-anchor', na), vertical ? 7.5 : 9).text(pct ? (vertical ? 'HEIGHT IS ITS SHARE' : 'HEIGHT IS ITS SHARE OF THE RECORD') : (vertical ? 'HEIGHT IS ITS VOLUME' : 'HEIGHT IS ITS WEIGHTED VOLUME'));
    // peak: the primary finding, a dot on the curve and a hairline leader to its value
    let pk = 0; for (let i = 1; i < n; i++) if (val(i) > val(pk)) pk = i;
    const [px, py] = pt(pk);
    const pyr = Math.min(S.y1, Math.floor(unfrac(samples[pk])));
    g.append('circle').attr('class', 'st-peak').attr('cx', px).attr('cy', py).attr('r', 3.5);
    // on the phone the peak reads as a line under the caption; on the desk it sits above its point with a leader
    let ly = vertical ? box.y + fsName + 28 : Math.max(box.y + 8, py - 26);
    // the name and caption block is an obstacle: a peak under it drops its label below the caption, or beside the point
    const titleW = Math.max(measure(label, fsName), 34 * 5.6) + 12;
    let beside = false;
    if (!vertical && px < box.x + titleW + 90 && ly < box.y + fsName + 24) { if (box.y + fsName + 32 < py - 8) ly = box.y + fsName + 32; else beside = true; }
    if (!vertical && !beside) g.append('line').attr('class', 'st-leader').attr('x1', px).attr('x2', px).attr('y1', py - 4).attr('y2', ly + 3);
    // beside the point but on the caption's row: the label clears the caption's end and a hairline leads back to the dot
    let pbx = px + 7;
    if (!vertical && beside && Math.abs(py + 4 - (box.y + fsName + 14)) < 13) { pbx = Math.max(pbx, box.x + 34 * 6.6 + 10); if (pbx > px + 7) g.append('line').attr('class', 'st-leader').attr('x1', px + 4).attr('x2', pbx - 3).attr('y1', py).attr('y2', py); }
    const anchorR = vertical || px > u1 - 120;
    mono(g.append('text').attr('x', vertical ? nx : beside ? pbx : anchorR ? px - 4 : px + 4).attr('y', beside ? py + 4 : ly).attr('text-anchor', anchorR && !beside ? 'end' : 'start'), vertical ? 8.5 : 10).attr('fill', '#121212').attr('font-weight', 500).text(`PEAK ${fmtV(val(pk))}, ${pyr}`)
      .attr('paint-order', 'stroke').attr('stroke', 'var(--ground)').attr('stroke-width', 3);
    const list = (byDomain.get(solo) || []).filter((e) => e.t >= S.y0 && e.t <= S.y1 + 1).sort((a, b) => b.significance - a.significance || b.t - a.t);
    // straight comparison: its busiest decades (years in a short window) as aligned bars, labeled at their ends
    const span = S.y1 - S.y0;
    const unit = span <= 30 ? 1 : 10;
    const roll = d3.rollups(list, (v) => v.length, (e) => Math.floor(e.year / unit) * unit).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const rowH = 15;
    const rows = Math.max(0, Math.min(8, roll.length, Math.floor((box.h - 22) / rowH)));
    const IW = vertical ? box.w : 230;
    // the inset's box is an obstacle for the callouts
    const ix = vertical ? box.x : box.x + box.w - IW;
    const iy = vertical ? box.y + fsName + 44 : box.y + 2;
    const insetBox = rows ? { x1: ix - 6, x2: ix + IW + 4, y1: iy - 4, y2: iy + 18 + rows * rowH } : null;
    // two strongest events as secondary callouts on the curve
    const placed = [{ x1: px - 70, x2: px + 110, y1: (beside ? py : ly) - 12, y2: (beside ? py : ly) + 4 }, { x1: box.x, x2: box.x + titleW, y1: box.y, y2: box.y + fsName + 20 }];
    if (insetBox) placed.push(insetBox);
    let shown = 0;
    for (const e of list) {
      if (shown >= 2 || vertical) break;
      const i = idxOf(e.t);
      const [ex, ey] = pt(i);
      const t = e.title.length > 44 ? shortTitleOf(e) : e.title;
      const w = measure(t, 11.5) + 6;
      const ty = Math.max(box.y + fsName + 34, ey - 20 - shown * 16);
      const right = ex + w > u1 - 4;
      const bb = { x1: right ? ex - w : ex, x2: right ? ex : ex + w, y1: ty - 11, y2: ty + 4 };
      if (placed.some((q) => !(bb.x2 < q.x1 || bb.x1 > q.x2 || bb.y2 < q.y1 || bb.y1 > q.y2))) continue;
      placed.push(bb); soloCalled.add(e.id);
      g.append('circle').attr('class', 'st-ev').attr('cx', ex).attr('cy', ey).attr('r', 2.6).attr('fill', col(solo));
      g.append('line').attr('class', 'st-leader').attr('x1', ex).attr('x2', ex).attr('y1', ey - 3).attr('y2', ty + 3);
      g.append('text').attr('x', right ? ex - 3 : ex + 3).attr('y', ty).attr('text-anchor', right ? 'end' : 'start').attr('font-family', 'Instrument Sans, serif').attr('font-size', 11.5).attr('fill', '#121212')
        .attr('paint-order', 'stroke').attr('stroke', 'var(--ground)').attr('stroke-width', 3).text(t);
      shown++;
    }
    if (!rows) return;
    const top = roll.slice(0, rows);
    const bx = d3.scaleLinear().domain([0, top[0][1]]).range([0, Math.max(20, IW - 74)]);
    const inset = gSolo.append('g').attr('class', 'st-inset').attr('transform', `translate(${ix},${iy})`);
    mono(inset.append('text').attr('y', 8), 9).text(unit === 10 ? 'BUSIEST DECADES' : 'BUSIEST YEARS');
    const row = inset.selectAll('g.r').data(top).join('g').attr('class', 'r').attr('transform', (d, i) => `translate(0,${16 + i * rowH})`)
      .attr('role', 'button').attr('tabindex', 0).attr('aria-label', (d) => `${d[1]} ${label} events in the ${d[0]}${unit === 10 ? 's' : ''}. Open that ${unit === 10 ? 'decade' : 'year'}`);
    row.append('rect').attr('class', 'hitr').attr('x', -2).attr('y', -1).attr('width', IW + 4).attr('height', rowH);
    mono(row.append('text').attr('x', 38).attr('y', 9).attr('text-anchor', 'end'), 9.5).text((d) => `${d[0]}${unit === 10 ? 's' : ''}`);
    // the bars are ranked by count but enter in decade order, so the eye reads them along time
    const byTime = top.map((d) => d[0]).sort((a, b) => a - b);
    row.append('rect').attr('class', 'bar').attr('x', 44).attr('y', 2).attr('height', rowH - 5).attr('fill', col(solo)).attr('width', 0)
      .transition().delay((d) => (RM() ? 0 : byTime.indexOf(d[0]) * 90)).duration(RM() ? 0 : 500).ease(d3.easeCubicOut).attr('width', (d) => Math.max(1, bx(d[1])));
    mono(row.append('text').attr('class', 'v').attr('x', (d) => 48 + bx(d[1])).attr('y', 9), 9.5).attr('fill', '#121212').text((d) => d[1]);
    const hiDec = (d) => {
      gSolo.selectAll('.st-dec').remove();
      if (!d) return;
      const a = X(Math.max(S.y0, d[0])), b = X(Math.min(S.y1 + 1, d[0] + unit));
      const rr = gSolo.insert('rect', ':first-child').attr('class', 'st-dec');
      if (vertical) rr.attr('x', lo).attr('width', hi - lo).attr('y', a).attr('height', Math.max(2, b - a));
      else rr.attr('x', a).attr('width', Math.max(2, b - a)).attr('y', lo).attr('height', hi - lo);
    };
    const open = (d) => { const a = Math.max(S.y0, d[0]), b = Math.min(S.y1, d[0] + unit - 1); if (b > a) set({ y0: a, y1: b }); };
    row.on('mouseenter focus', (ev, d) => hiDec(d)).on('mouseleave blur', () => hiDec(null)).on('click', (ev, d) => open(d))
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(d); } })
      .append('title').text((d) => `Open the ${d[0]}${unit === 10 ? 's' : ''}`);
  }
  const shortTitleOf = (e) => (e.title.length > 44 ? e.title.slice(0, e.title.lastIndexOf(' ', 42)) + '\u2026' : e.title);

  // ---- hover: the band under the pointer gets the one crisp edge on the map, and its name and value at its end ----
  let hoverHidden = [];
  function hoverBand(d) {
    gHover.selectAll('*').remove();
    hoverHidden.forEach((n) => n.style.removeProperty('visibility')); hoverHidden = [];
    if (!d) return;
    const L = layers.find((l) => l.key === d);
    if (!L) return;
    gHover.append('path').attr('class', 'st-crisp').attr('d', shape(L));
    const n = samples.length;
    // end of the band: the last sample with any thickness (the window's present edge)
    let i = n - 1;
    while (i > 0 && Math.abs(bandAt(L, i)[1] - bandAt(L, i)[0]) < 1) i--;
    const [a, b] = bandAt(L, i);
    const c = (a + b) / 2;
    const { stack } = parseMode();
    const nEv = (byDomain.get(d) || []).filter((e) => e.t >= S.y0 && e.t <= S.y1 + 1).length;
    const val = stack === 'share' ? `${Math.round((L[i][1] - L[i][0]) * 100)}% SHARE AT ${Math.min(S.y1, Math.floor(unfrac(samples[i])))}` : `${nEv} EVENTS IN VIEW`;
    const g = gHover.append('g').attr('class', 'st-endlab');
    const [u0, u1] = U.range();
    const name = DISP(d).label;
    const v2 = stack === 'share' ? `${nEv} EVENTS IN VIEW` : null;
    if (vertical) {
      // phone: the label sits in the strip above the plot, flush right
      const x = W - 12, y = TOP - 22;
      g.append('text').attr('class', 'nm').attr('x', x).attr('y', y).attr('text-anchor', 'end').text(name);
      g.append('text').attr('class', 'vl').attr('x', x).attr('y', y + 13).attr('text-anchor', 'end').text(v2 ? `${val} \u00b7 ${v2}` : val);
    } else {
      // desk: the band's own row in the gutter, the name in the display face (wrapped if the gutter is narrow), the value beneath
      const row = endRows().find((q) => q.key === d);
      const r = V.range(), lo = Math.min(r[0], r[1]), hi = Math.max(r[0], r[1]);
      const x = u1 + 22, maxW = GUT - 30;
      const words = name.split(' '), lines = [];
      let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, 17) > maxW) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const nl = lines.length + 1 + (v2 ? 1 : 0);
      const hgt = lines.length * 18 + (nl - lines.length) * 13;
      let y = Math.max(lo + 14, Math.min(hi - hgt + 10, (row ? row.y : c) - hgt / 2 + 12));
      g.append('line').attr('class', 'tick').attr('x1', u1 + 3).attr('x2', u1 + 18).attr('y1', c).attr('y2', c);
      lines.forEach((t, i) => g.append('text').attr('class', 'nm').attr('x', x).attr('y', y + i * 18).text(t));
      y += (lines.length - 1) * 18 + 13;
      g.append('text').attr('class', 'vl').attr('x', x).attr('y', y).text(val);
      if (v2) g.append('text').attr('class', 'vl').attr('x', x).attr('y', y + 13).text(v2);
      // the resting end labels under the hover label step aside; the hovered band's own row always does
      gLabels.select(`.st-end[data-d="${d}"]`).each(function () { this.style.visibility = 'hidden'; hoverHidden.push(this); });
    }
    // in-band labels under the end label step aside while it shows
    const bb = g.node().getBBox();
    gLabels.selectAll('text').each(function () { const q = this.getBBox(); const m = this.parentNode.transform?.baseVal?.consolidate?.()?.matrix; const ox = m ? m.e : 0, oy = m ? m.f : 0; if (!(q.x + ox > bb.x + bb.width + 4 || q.x + ox + q.width < bb.x - 4 || q.y + oy > bb.y + bb.height + 2 || q.y + oy + q.height < bb.y - 2)) { const tgt = this.parentNode.classList && this.parentNode.classList.contains('st-end') ? this.parentNode : this; tgt.style.visibility = 'hidden'; hoverHidden.push(tgt); } });
  }
  // walk overlay: the thread's events so far, lit along the bands
  let LIT = null;
  function relit() { drawLit(gLit, LIT, (id) => { const e = db.byId.get(id); if (!e || !layers.length || e.t < S.y0 || e.t > S.y1 + 1) return null; return pos(e.t, e._sk); }); }

  // this week: a thin bright edge where the record ends, the last thirty days as a softer band behind it
  function nowBand(base) {
    gNow.selectAll('*').remove();
    const R = recent();
    if (!R.latest || R.t < S.y0 || R.tMonth > S.y1 + 1) return;
    const lo = vertical ? 44 : TOP - 4, hi = vertical ? W - 12 : base;
    const a = X(Math.max(S.y0, R.tMonth)), m = X(Math.max(S.y0, R.tWeek)), b = X(Math.min(S.y1 + 1, R.t));
    const band = (p, q, cls, min) => {
      const w = Math.max(min, q - p), p0 = q - w;
      const r = gNow.append('rect').attr('class', cls);
      if (vertical) r.attr('x', lo).attr('width', hi - lo).attr('y', p0).attr('height', w);
      else r.attr('x', p0).attr('width', w).attr('y', lo).attr('height', hi - lo);
    };
    band(a, b, 'st-now-month', 7);
    band(m, b, 'st-now-week', 3);
    const edge = gNow.append('line').attr('class', 'st-now-edge');
    if (vertical) edge.attr('x1', lo).attr('x2', hi).attr('y1', b).attr('y2', b);
    else edge.attr('x1', b).attr('x2', b).attr('y1', lo - 6).attr('y2', hi);
    // the label needs room on the top rail; in wide windows the edge alone carries it (with a title)
    gNow.append('title').text(`This week: ${R.week.length} new record${R.week.length === 1 ? '' : 's'}, dated up to ${new Date(R.latest).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`);
    if (!vertical && b - a >= 48) {
      const n = R.week.length;
      const t = gNow.append('text').attr('class', 'st-now-label').attr('x', b - 4).attr('y', lo - 9).attr('text-anchor', 'end')
        .attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em')
        .text(`THIS WEEK \u00b7 ${n} NEW`);
      t.append('title').text(`${n} record${n === 1 ? '' : 's'} from the seven days to ${new Date(R.latest).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`);
    }
  }

  // region strip: one row per world region, a mark per event that has a region, so place stays visible
  const gRegion = svg.append('g');
  const live = document.createElement('div'); live.className = 'sr-only st-live'; live.setAttribute('aria-live', 'polite'); el.appendChild(live);
  let regFocusId = null;
  function regionFocus(id) { if (!id) return; const n = gRegion.selectAll('circle').filter((e) => e.id === id).node(); if (n) n.focus({ preventScroll: true }); }
  function regionKey(ev, list, rows) {
    const cur = list.find((e) => e.id === regFocusId) || list[0]; if (!cur) return;
    const k = ev.key;
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); tip.hide(); if (cx.on) cxPick(cur.id); else select(cur.id); return; }
    if (k === 'Escape') { ev.preventDefault(); tip.hide(); showArcs(null); gRegion.node().blur(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k)) return;
    ev.preventDefault();
    const row = list.filter((e) => e.region === cur.region).sort((a, b) => a.t - b.t);
    const i = row.findIndex((e) => e.id === cur.id);
    let next = null;
    if (k === 'ArrowRight') next = row[Math.min(row.length - 1, i + 1)];
    else if (k === 'ArrowLeft') next = row[Math.max(0, i - 1)];
    else if (k === 'Home') next = row[0];
    else if (k === 'End') next = row[row.length - 1];
    else { // the row above or below, at the nearest year
      const ri = rows.findIndex((r) => r.id === cur.region); const rr = rows[ri + (k === 'ArrowDown' ? 1 : -1)]; if (!rr) return;
      const other = list.filter((e) => e.region === rr.id); next = other.reduce((b, e) => (!b || Math.abs(e.t - cur.t) < Math.abs(b.t - cur.t) ? e : b), null);
    }
    if (next) regionFocus(next.id);
  }
  function regions(y, base) {
    gRegion.selectAll('*').remove();
    if (vertical || !whereKey) return;
    // the census counts the tapped band's register events in the window, overlays excluded: placed by region + global = the band
    let list = evs.filter((e) => e.kind !== 'overlay' && e._sk === whereKey && e.region && REGION[e.region] && e.t >= S.y0 && e.t <= S.y1 + 1);
    const census = { total: list.length, global: list.filter((e) => e.region === 'global').length };
    const rows = REGIONS.filter((r) => list.some((e) => e.region === r.id));
    if (!rows.length) return;
    const rowH = Math.max(13, Math.min(72, Math.floor((base - y - 24) / rows.length))); // the strip takes the chart's height
    const rowY = new Map(rows.map((r, i) => [r.id, y + rowH / 2 + i * rowH]));
    // thin record (Vision 4, S5): in a window wider than a century, a region with under six events in a century (counted
    // on the whole record, not the register) shows a hatched mark across that century instead of dots
    const thin = [];
    if (S.y1 - S.y0 > 100) {
      const whole = (typeof DATA.thinBase === 'function' ? DATA.thinBase() : db.events.filter((e) => e.region && e.kind !== 'overlay')); // the whole record, whatever the Draw toggle shows
      // one unit everywhere: events per century per region, as a rate over each period span clipped to the window (a 74-year stretch is judged by its rate, not its count)
      for (const r of rows) for (const a of AGES) {
        const c = Math.max(a.start, S.y0), end = Math.min(a.end, S.y1 + 1); if (end - c < 10) continue;
        const n = whole.filter((e) => e.region === r.id && e.year >= c && e.year < end).length;
        const rate = (n / (end - c)) * 100;
        if (rate < 6) thin.push({ region: r.id, c, end, n, rate });
      }
      list = list.filter((e) => !thin.some((t) => t.region === e.region && e.year >= t.c && e.year < t.end));
      census.hatched = census.total - list.length;
    }
    gRegion.append('text').attr('class', 'st-where-head').attr('x', U.range()[0]).attr('y', y - 6).attr('font-family', 'Instrument Sans, serif').attr('font-size', 15).attr('fill', '#121212').text(`${DISP(whereKey).label}. Where each landmark happened. Hatched stretches are where the archive is thin.`)
      .append('title').text(`${census.total.toLocaleString('en-US')} events: ${(census.total - census.global).toLocaleString('en-US')} placed by region, ${census.global.toLocaleString('en-US')} global${census.hatched ? `, ${census.hatched.toLocaleString('en-US')} in hatched centuries` : ''}. Thin: under 6 events per century per region on the whole record.`);
    whereCensus = census;
    const g = gRegion.selectAll('g').data(rows).join('g');
    g.append('line').attr('x1', U.range()[0]).attr('x2', U.range()[1]).attr('y1', (r) => rowY.get(r.id)).attr('y2', (r) => rowY.get(r.id)).attr('stroke', 'rgba(28,26,23,.08)');
    g.append('text').attr('class', 'st-rg-name').attr('x', U.range()[1] + 22).attr('y', (r) => rowY.get(r.id)).attr('dy', '0.35em').attr('text-anchor', 'start').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', (r) => r.color).text((r) => r.short.toUpperCase());
    // one Tab stop for the strip; the arrows then walk the dots, by year along a row, up and down between rows
    gRegion.attr('class', 'st-region').attr('tabindex', 0).attr('role', 'group').attr('aria-label', `Where the events happened: ${list.length} dots in ${rows.length} rows. Arrow keys move across the dots, Enter opens the record`)
      .on('focus', (ev) => { if (ev.target === gRegion.node()) regionFocus(regFocusId && list.some((e) => e.id === regFocusId) ? regFocusId : list[0] && list[0].id); })
      .on('keydown', (ev) => regionKey(ev, list, rows));
    if (thin.length) {
      // the hatch takes the region's own palest step (its hue at low opacity on paper), never black
      const regionPale = (id) => tokenOf(`--h-region-${id}`) || regionColor(id);
      rows.forEach((r) => { if (defs.select(`#st-thin-${r.id}`).empty()) defs.append('pattern').attr('id', `st-thin-${r.id}`).attr('class', 'st-thin-pat').attr('width', 4).attr('height', 4).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)').append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 4).attr('stroke-width', 1.2); defs.select(`#st-thin-${r.id} line`).attr('stroke', regionPale(r.id)).attr('stroke-opacity', 0.45); });
      const x0 = (c) => U(frac(Math.max(c, S.y0))), x1 = (t) => U(frac(Math.min(t.end, S.y1 + 1)));
      gRegion.selectAll('rect.st-thin').data(thin).join('rect').attr('class', 'st-thin').attr('x', (t) => x0(t.c)).attr('width', (t) => Math.max(1, x1(t) - x0(t.c))).attr('y', (t) => rowY.get(t.region) - Math.min(6, rowH / 2 - 1)).attr('height', Math.min(12, rowH - 2)).attr('fill', (t) => `url(#st-thin-${t.region})`).attr('opacity', 1)
        .attr('role', 'img').attr('aria-label', (t) => `Thin archive: ${Math.round(t.rate * 10) / 10} events per century in ${REGION[t.region].label}, ${t.c} to ${Math.min(t.end - 1, S.y1)}`)
        .on('mouseenter', (ev, t) => tip.show(ev, `<b>Thin archive</b><br>${Math.round(t.rate * 10) / 10} events per century in ${REGION[t.region].label}, ${t.c} to ${Math.min(t.end - 1, S.y1)} (${t.n} on the whole record). Thin means a thin archive.`)).on('mousemove', tip.move).on('mouseleave', tip.hide);
    }
    gRegion.selectAll('circle').data(list).join('circle').attr('cx', (e) => U(frac(e.t))).attr('cy', (e) => rowY.get(e.region)).attr('r', (e) => (rowH > 20 ? 2.4 + e.significance * 0.7 : 1.6 + e.significance * 0.45)).attr('fill', (e) => regionColor(e.region)).attr('opacity', 0.85)
      .attr('tabindex', -1).attr('role', 'button').attr('aria-label', (e) => `${e.title}, ${e.year}, ${REGION[e.region].label}`)
      .on('focus', (ev, e) => { regFocusId = e.id; showArcs(e.id); const r = ev.target.getBoundingClientRect(); tip.show({ clientX: r.left + r.width / 2, clientY: r.top }, eventTip(e)); live.textContent = `${e.title}, ${e.year}, ${REGION[e.region].label}`; })
      .on('blur', () => { tip.hide(); showArcs(null); }).style('cursor', 'pointer')
      .on('mouseenter', (ev, e) => { tip.show(ev, eventTip(e)); showArcs(e.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); showArcs(null); }).on('click', (ev, e) => (cx.on ? cxPick(e.id) : select(e.id)));
  }

  // in-stream labels: domain names at widest point, then notable events with greedy collision avoidance
  const mctx = document.createElement('canvas').getContext('2d');
  const measure = (t, fs) => { mctx.font = `${fs}px Instrument Sans, serif`; return mctx.measureText(t).width; };
  let namedInLane = new Set();
  function labels() {
    gLabels.selectAll('*').remove();
    defs.selectAll('.st-cl').remove();
    const placed = [];
    namedInLane = new Set();
    const collide = (b) => placed.some((p) => !(b.x2 < p.x1 || b.x1 > p.x2 || b.y2 < p.y1 || b.y1 > p.y2));
    const n = samples.length;
    const thAt = (L, i) => { const [a, b] = bandAt(L, i); return Math.abs(b - a); };
    const cutXs = vertical ? [] : BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1).map((k) => X(k));
    const PAPER = tokenOf('--paper') || '#faf8f3';
    // the name's ink for a run: paper on dark steps, the family's darkest step on pale ones, and only when it reads at 4.5:1 on every period step the run crosses
    const inkFor = (key, bb) => {
      const ya = unfrac(U.invert(bb.x1)), yb = unfrac(U.invert(bb.x2));
      const cols = AGES.filter((a) => a.end > ya && a.start < yb).map((a) => colAt(key, Math.max(a.start, ya)));
      if (!cols.length) return null;
      if (cols.every((c) => contrast(PAPER, c) >= 4.5)) return PAPER;
      const dark = labelInk(key); if (cols.every((c) => contrast(dark, c) >= 4.5)) return dark;
      return null;
    };
    // the Histomap poster sets each name inside its band along the flow: curved text on the band's centreline, at its widest run;
    // a family's name splits it into its domains, a domain's name folds the family back (no event titles in the river)
    layers.forEach((L, li) => {
      if (solo) return; // the isolated band is named in the free field above its chart
      const name = DISP(L.key).label.toUpperCase();
      // the name rides a heavily smoothed centreline, so it drifts with the flow instead of tumbling over every crest
      const raw = samples.map((w, i) => { const [a, b] = bandAt(L, i); return (a + b) / 2; });
      const k = Math.max(3, Math.round(n * 0.07));
      const sm = raw.map((v, i) => { let t = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { t += raw[j]; c++; } return t / c; });
      const pts = samples.map((w, i) => (vertical ? [sm[i], U(w)] : [U(w), sm[i]]));
      const ext = (j) => { const [a, b] = bandAt(L, j); return [Math.min(a, b), Math.max(a, b)]; };
      const cum = [0]; for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const total = cum[n - 1];
      const jAt = (len) => Math.max(0, Math.min(n - 1, d3.bisectLeft(cum, len)));
      const idx = d3.range(Math.floor(n * 0.02), Math.ceil(n * 0.98), 2).sort((p, q) => thAt(L, q) - thAt(L, p)).slice(0, 160);
      const maxTh = idx.length ? thAt(L, idx[0]) : 0;
      if (maxTh < 13) return;
      if (vertical) { // on a phone the river runs down the screen: the name sits straight across the band at its widest point
        const nm = (DISP(L.key).short || name).toUpperCase();
        for (const fs of [20, 16, 13]) {
          const wEst = nm.length * fs * 0.74;
          const bi = idx.find((i) => thAt(L, i) >= wEst + 10);
          if (bi == null) continue;
          const [a, b] = bandAt(L, bi), x = (a + b) / 2, y = U(samples[bi]);
          const bb = { x1: x - wEst / 2 - 4, x2: x + wEst / 2 + 4, y1: y - fs * 0.7, y2: y + fs * 0.7 };
          if (collide(bb)) continue;
          placed.push(bb); namedInLane.add(L.key);
          gLabels.append('text').attr('class', 'st-name').attr('data-k', L.key).attr('data-split', '0').attr('x', x).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'middle')
            .attr('font-family', 'Instrument Serif, serif').attr('font-size', fs).attr('letter-spacing', '0.06em').attr('fill', lum(colAt(L.key, S.y1)) < 0.5 ? 'var(--paper, #faf8f3)' : labelInk(L.key)).attr('opacity', 0.94).style('pointer-events', 'none').text(nm);
          break;
        }
        return;
      }
      const fsList = [40, 34, 28, 23, 19, 16, 13].filter((f) => f <= (vertical ? 22 : 40) && f <= maxTh * 0.8);
      let got = null;
      const shortName = (DISP(L.key).short || name).toUpperCase();
      // order of preference: the full name clear of the cuts, the full name across a cut (the slit passes under the letters), then the short name
      // council round 6: band titles sit level at 18px; the full name first, then the short one, each wherever the band is tall and gentle enough
      const tries = [[18, name, true, 'straight'], ...(name.includes(' ') ? [[18, name, true, 'straight2']] : []), ...(shortName !== name ? [[18, shortName, true, 'straight']] : [])];
      outer: for (const [fs, nm, acrossCuts, mode] of tries) {
        if (mode === 'straight' || mode === 'straight2') { // level titles; a two-word name may stack on two lines where one line has no room
          const two = mode === 'straight2' ? (() => { const ws = nm.split(' '); let best = 1, d = Infinity; for (let i = 1; i < ws.length; i++) { const dd = Math.abs(ws.slice(0, i).join(' ').length - ws.slice(i).join(' ').length); if (dd < d) { d = dd; best = i; } } return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')]; })() : null;
          const wEst = (two ? Math.max(two[0].length, two[1].length) : nm.length) * fs * 0.74, hh = two ? fs * 1.25 : fs * 0.6;
          for (const bi of idx) {
            const xc = pts[bi][0], xa = xc - wEst / 2, xb = xc + wEst / 2;
            if (xa < U.range()[0] + 4 || xb > U.range()[1] - 4) continue;
            const js = []; for (let x = xa; x <= xb; x += 6) js.push(jAt(cum[bi] + (x - xc)));
            const yc = d3.mean(js, (j) => sm[j]);
            if (js.some((j) => yc - hh < ext(j)[0] || yc + hh > ext(j)[1])) continue;
            const bb = { x1: xa - 6, x2: xb + 6, y1: yc - hh, y2: yc + hh };
            if (collide(bb)) continue;
            const ink = inkFor(L.key, bb); if (!ink) continue;
            got = { fs, b: bb, nm, straight: [xc, yc], ink, two };
            break outer;
          }
          continue;
        }
        const wEst = nm.length * fs * 0.74; // serif caps with 0.06em tracking
        for (const bi of idx) {
          if (thAt(L, bi) < fs * 1.1) break;
          const start = Math.max(4, Math.min(total - wEst - 4, cum[bi] - wEst / 2));
          if (start < 4 || start + wEst > total - 4) continue;
          let ok = true;
          const xs = [], ys = [];
          for (let len = start; len <= start + wEst; len += 6) {
            const j = jAt(len); const [lo, hi] = ext(j);
            // the whole run must sit inside the band on the smoothed line, and the line must stay gentle (no letters on a cliff)
            if (thAt(L, j) < fs * 1.1 || sm[j] - fs * 0.5 < lo || sm[j] + fs * 0.5 > hi) { ok = false; break; }
            if (j > 0 && Math.abs(sm[j] - sm[j - 1]) / Math.max(0.1, Math.abs(pts[j][0] - pts[j - 1][0])) > 0.6) { ok = false; break; }
            xs.push(pts[j][0]); ys.push(pts[j][1]);
          }
          if (!ok || !xs.length) continue;
          const bb = { x1: Math.min(...xs) - 6, x2: Math.max(...xs) + 6, y1: Math.min(...ys) - fs * 0.62, y2: Math.max(...ys) + fs * 0.62 };
          if (collide(bb) || (!acrossCuts && cutXs.some((cx) => cx >= bb.x1 - 8 && cx <= bb.x2 + 8))) continue;
          const ink = inkFor(L.key, bb); if (!ink) continue; // no ink reaches 4.5:1 on every step the run crosses: try another run
          got = { start, fs, b: bb, nm, ink };
          break outer;
        }
      }
      if (!got) return;
      placed.push(got.b); namedInLane.add(L.key);
      const id = `st-cl-${li}`;
      const line = vertical ? d3.line().x((d) => d[0]).y((d) => d[1]).curve(d3.curveBasis) : d3.line().x((d) => d[0]).y((d) => d[1]).curve(d3.curveBasis);
      const path = defs.append('path').attr('class', 'st-cl').attr('id', id).attr('d', line(pts));
      const real = path.node().getTotalLength() || total;
      const splittable = !FAM[L.key] || FAM[L.key].domains.length > 1; // a one-domain family has nothing to open
      const t = gLabels.append('text').attr('class', 'st-name').attr('data-k', L.key).attr('data-split', splittable ? '1' : '0').attr('dy', '0.35em').attr('font-family', 'Instrument Serif, serif').attr('font-size', got.fs).attr('letter-spacing', '0.06em')
        .attr('fill', got.ink).attr('opacity', 1).style('pointer-events', 'none');
      if (got.straight) t.attr('x', got.straight[0]).attr('y', got.straight[1]).attr('text-anchor', 'middle');
      if (splittable) t.attr('role', 'button').attr('tabindex', 0).attr('aria-label', `${DISP(L.key).label}: ${FAM[L.key] ? 'split into its domains' : 'fold back into its family'}`)
        .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSplit(L.key); } });
      if (got.two) { t.attr('dy', null); t.selectAll('tspan').data(got.two).join('tspan').attr('x', got.straight[0]).attr('y', (d, i) => got.straight[1] + (i ? got.fs * 0.6 : -got.fs * 0.6)).attr('dy', '0.35em').text((d) => d); } else if (got.straight) t.text(got.nm); else t.append('textPath').attr('href', `#${id}`).attr('startOffset', got.start * (real / total)).text(got.nm);
      if (splittable) t.append('title').text(FAM[L.key] ? `${DISP(L.key).label}: tap to split into its ${FAM[L.key].domains.length} domains` : `${DISP(L.key).label}: tap to fold back into ${DISP(famOf[L.key]).label}`);
    });
    endLabels();
  }

  // ---- end labels: every band is named in the right gutter at its end, pushed apart so none overprint; the hovered
  // band's row is replaced by its name in the display face with its value beneath (label directly at line ends) ----
  const endRows = () => {
    const n = samples.length;
    const rows = layers.filter((L) => !(solo && L.key !== solo) && !namedInLane.has(L.key)).map((L) => {
      let i = n - 1;
      while (i > 0 && Math.abs(bandAt(L, i)[1] - bandAt(L, i)[0]) < 1) i--;
      const [a, b] = bandAt(L, i);
      return { key: L.key, i, c: (a + b) / 2, th: Math.abs(b - a), y: (a + b) / 2 };
    }).sort((p, q) => p.c - q.c);
    const r = V.range(), lo = Math.min(r[0], r[1]) + 6, hi = Math.max(r[0], r[1]) - 6, step = 13.5;
    // the type never shrinks: when the rows cannot all fit at this pitch, the thinnest bands give up their label (hover still names them)
    const fit = Math.max(1, Math.floor((hi - lo) / step) + 1);
    if (rows.length > fit) {
      const keep = new Set(rows.slice().sort((p, q) => q.th - p.th).slice(0, fit).map((q) => q.key));
      for (let k = rows.length - 1; k >= 0; k--) if (!keep.has(rows[k].key)) rows.splice(k, 1);
    }
    for (let k = 1; k < rows.length; k++) rows[k].y = Math.max(rows[k].y, rows[k - 1].y + step);
    const over = rows.length ? rows[rows.length - 1].y - hi : 0;
    if (over > 0) rows.forEach((q) => { q.y -= over; });
    for (let k = rows.length - 2; k >= 0; k--) rows[k].y = Math.min(rows[k].y, rows[k + 1].y - step);
    rows.forEach((q) => { q.y = Math.max(lo, q.y); });
    for (let k = 1; k < rows.length; k++) rows[k].y = Math.max(rows[k].y, rows[k - 1].y + step);
    return rows;
  };
  let endRowsNow = [];
  function endLabels() {
    endRowsNow = [];
    if (vertical || !GUT || cx.on) return;
    const [, u1] = U.range();
    const g = gLabels.append('g').attr('class', 'st-ends');
    endRowsNow = endRows();
    for (const q of endRowsNow) {
      const row = g.append('g').attr('class', 'st-end').attr('data-d', q.key).attr('role', 'button').attr('tabindex', 0).attr('aria-pressed', String(solo === q.key)).attr('aria-label', `${DISP(q.key).label}: isolate this band`);
      row.on('click', () => toggleSolo(q.key));
      row.append('rect').attr('class', 'st-end-hit').attr('x', u1 + 10).attr('y', q.y - 6).attr('width', GUT - 12).attr('height', 12).attr('fill', 'transparent');
      row.append('path').attr('d', `M${u1 + 3},${q.c}L${u1 + 12},${q.y}L${u1 + 18},${q.y}`);
      const full = DISP(q.key).label.toUpperCase();
      row.append('text').attr('x', u1 + 22).attr('y', q.y).attr('dy', '0.35em').text(full.length * 7.1 > GUT - 28 ? (DISP(q.key).short || full).toUpperCase() : full);
    }
  }

  function showTicks(d) {
    gTicks.selectAll('*').remove();
    if (!d) return;
    const L = layers.find((l) => l.key === d);
    if (!L) return;
    const n = samples.length, st = samples[1] - samples[0];
    const list = (byDomain.get(d) || []).filter((e) => e.t >= S.y0 && e.t <= S.y1 + 1);
    gTicks.selectAll('line').data(list).join('line').each(function (e) {
      const i = Math.max(0, Math.min(n - 1, Math.round((frac(e.t) - samples[0]) / st)));
      const [a, b] = bandAt(L, i);
      const u = U(frac(e.t));
      const sel = d3.select(this);
      if (vertical) sel.attr('x1', a).attr('x2', b).attr('y1', u).attr('y2', u);
      else sel.attr('x1', u).attr('x2', u).attr('y1', a).attr('y2', b);
    }).attr('stroke', (e) => (e.region ? regionColor(e.region) : '#121212')).attr('stroke-width', (e) => 0.4 + e.significance * 0.3).attr('opacity', (e) => (e.region ? 0.9 : 0.55));
    gAreas.selectAll('path').attr('opacity', (l) => (l.key === d ? 1 : 0.42 * bandOp(l.key)));
  }

  function showArcs(id) {
    gArcs.selectAll('*').remove();
    if (!id) return;
    const e = db.byId.get(id);
    if (!e || !byDomain.has(e._sk)) return;
    const a = pos(e.t, e._sk);
    if (!a) return;
    const others = neighbors(id).map((x) => db.byId.get(x)).filter((x) => x && byDomain.has(x._sk) && x.t >= S.y0 && x.t <= S.y1 + 1);
    others.forEach((o) => {
      const b = pos(o.t, o._sk);
      if (!b) return;
      const p = gArcs.append('path').attr('d', `M${a[0]},${a[1]}Q${(a[0] + b[0]) / 2},${Math.min(a[1], b[1]) - Math.abs(a[0] - b[0]) * 0.35 - 20} ${b[0]},${b[1]}`)
        .attr('fill', 'none').attr('stroke', '#121212').attr('stroke-width', 1.2);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().duration(450).attr('stroke-dashoffset', 0);
      gArcs.append('circle').attr('cx', b[0]).attr('cy', b[1]).attr('r', 3.5).attr('fill', col(o._sk)).attr('stroke', '#121212');
    });
    gArcs.append('circle').attr('cx', a[0]).attr('cy', a[1]).attr('r', 5.5).attr('fill', col(e._sk)).attr('stroke', '#121212').attr('stroke-width', 1.5);
  }

  function pick(ev) {
    const [mx, my] = d3.pointer(ev, svg.node());
    const w = U.invert(vertical ? my : mx);
    const t = unfrac(w);
    const pp = vertical ? mx : my;
    const i = Math.max(0, Math.min(samples.length - 1, Math.round((w - samples[0]) / (samples[1] - samples[0]))));
    const within = (l) => { const [a, b] = bandAt(l, i); return pp >= Math.min(a, b) && pp <= Math.max(a, b); };
    const L = (solo && layers.find((l) => l.key === solo && within(l))) || layers.find(within);
    if (!L) return { d: null };
    const span = (samples[samples.length - 1] - samples[0]) / (vertical ? 40 : 90); // in warped units
    let best = null, bd = Infinity;
    for (const e of byDomain.get(L.key) || []) {
      const dd = Math.abs(e.w - w) - e.significance * span * 0.15;
      if (dd < bd && Math.abs(e.w - w) < span * 2.5) { bd = dd; best = e; }
    }
    return { d: L.key, e: best, t };
  }

  // ---- drag on the stream: reorder a band by carrying it over another, or lasso a region to list its events ----
  let dragging = null;
  const lassoEl = () => el.querySelector('.hp-panel.st-lasso-panel');
  function drawLasso() {
    gLasso.selectAll('*').remove();
    if (!lassoPoly || lassoPoly.length < 3) return;
    gLasso.append('path').attr('d', `M${lassoPoly.map((p) => p.join(',')).join('L')}Z`);
  }
  function lassoList() {
    const old = lassoEl(); if (old) old.remove();
    if (!lassoPoly || lassoPoly.length < 3) return;
    const hits = evs.filter((e) => e.t >= S.y0 && e.t <= S.y1 + 1 && byDomain.has(e._sk) && (!solo || e._sk === solo)).map((e) => ({ e, p: pos(e.t, e._sk) })).filter((x) => x.p && inPolygon(x.p, lassoPoly)).map((x) => x.e).sort((a, b) => a.t - b.t || b.significance - a.significance);
    const panel = document.createElement('aside');
    panel.className = 'hp-panel st-lasso-panel';
    panel.setAttribute('aria-label', 'Events inside the lasso');
    const ys = hits.length ? `${hits[0].year} to ${hits[hits.length - 1].year}` : '';
    const doms = [...new Set(hits.map((e) => e._sk))];
    panel.innerHTML = `<header><div><h4>${hits.length} event${hits.length === 1 ? '' : 's'} inside</h4><div class="m">${ys}${doms.length ? ` &middot; ${doms.length} domain${doms.length === 1 ? '' : 's'}` : ''}</div></div><button type="button" class="hp-act" data-a="clear">Clear</button></header>` +
      (hits.length ? `<ol>${hits.slice(0, 120).map((e) => `<li><button type="button" data-id="${esc(e.id)}" style="--c:${col(e._sk)}"><i></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button></li>`).join('')}</ol>${hits.length > 120 ? `<p class="none">${hits.length - 120} more; draw a smaller loop to read all.</p>` : ''}` : '<p class="none">Nothing recorded inside this loop.</p>');
    panel.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.a === 'clear') { lassoPoly = null; drawLasso(); panel.remove(); } else if (b.dataset.id) select(b.dataset.id); });
    panel.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-id]'); if (b) showArcs(b.dataset.id); });
    panel.addEventListener('mouseleave', () => showArcs(S.sel || null));
    el.appendChild(panel);
    flyIn(hits, panel);
  }
  // each hit leaves a dot at its place on the map that travels to its row in the list (date order, 40ms apart,
  // 500ms each, capped at 24 travellers); the rows themselves arrive on the same clock
  function flyIn(hits, panel) {
    gLasso.selectAll('.st-fly').remove();
    const rows = [...panel.querySelectorAll('li button')];
    rows.forEach((r, i) => { r.style.setProperty('--i', Math.min(i, 24)); });
    if (RM() || !hits.length) return;
    const sr = svg.node().getBoundingClientRect();
    const N = Math.min(24, hits.length);
    for (let i = 0; i < N; i++) {
      const e = hits[i], p = pos(e.t, e._sk), r = rows[i];
      if (!p || !r) continue;
      const rb = r.getBoundingClientRect();
      if (rb.top > sr.bottom || rb.bottom < sr.top) continue; // rows beyond the list's fold do not fly
      const tx = rb.left - sr.left + 10, ty = rb.top - sr.top + rb.height / 2;
      gLasso.append('circle').attr('class', 'st-fly').attr('r', 3).attr('fill', col(e._sk)).attr('cx', p[0]).attr('cy', p[1]).attr('opacity', 0.95)
        .transition().delay(i * 40).duration(500).ease(d3.easeCubicInOut).attr('cx', tx).attr('cy', ty).attr('r', 4)
        .transition().duration(150).attr('opacity', 0).remove();
    }
  }
  hit.call(d3.drag().clickDistance(4)
    .on('start', (ev) => {
      if (dragMode === 'lasso') { lassoPoly = [[ev.x, ev.y]]; const old = lassoEl(); if (old) old.remove(); drawLasso(); dragging = { lasso: true }; return; }
      const p = pick(ev.sourceEvent);
      if (!p.d) { dragging = null; return; }
      dragging = { d: p.d, over: p.d };
      hoverBand(null);
      hit.attr('class', 'st-hit grabbing');
      tip.hide();
    })
    .on('drag', (ev) => {
      if (!dragging) return;
      if (dragging.lasso) { const last = lassoPoly[lassoPoly.length - 1]; if (Math.hypot(ev.x - last[0], ev.y - last[1]) > 3) { lassoPoly.push([ev.x, ev.y]); drawLasso(); } return; }
      const p = pick(ev.sourceEvent);
      dragging.over = p.d || dragging.over;
      gAreas.selectAll('path').attr('opacity', (l) => (l.key === dragging.d ? 0.55 : l.key === dragging.over ? 1 : 0.35 * bandOp(l.key)));
      // a ghost edge marks the band under the pointer: that is where the carried band lands
      gGhost.selectAll('*').remove();
      const L = layers.find((l) => l.key === dragging.over);
      if (L && dragging.over !== dragging.d) gGhost.append('path').attr('class', 'st-drag-ghost').attr('d', area()(L));
    })
    .on('end', () => {
      if (!dragging) return;
      const d = dragging; dragging = null;
      gGhost.selectAll('*').remove();
      hit.attr('class', `st-hit ${dragMode === 'lasso' ? 'lasso' : 'grab'}`);
      if (d.lasso) { if (lassoPoly.length < 3) { lassoPoly = null; drawLasso(); } else lassoList(); return; }
      if (d.over && d.over !== d.d) {
        const keys = stackKeys.filter((k) => k !== d.d);
        keys.splice(keys.indexOf(d.over) + (stackKeys.indexOf(d.over) > stackKeys.indexOf(d.d) ? 1 : 0), 0, d.d);
        order = keys; compute(); scales(); draw(true); syncCtl();
      } else gAreas.selectAll('path').attr('opacity', (l) => bandOp(l.key));
    }));
  hit.on('dblclick', (ev) => { const p = pick(ev); if (p.d) { solo = solo === p.d ? null : p.d; applySolo(); syncCtl(); } });

  // the band is the thing: hovering it reads the band's own note (domain, share at that year, events in the window, peak decade).
  // Event tips belong to the dot strip and the callouts. A click pins the note; a double-click isolates the band.
  const TOUCH = matchMedia('(hover: none)').matches;
  const note = document.createElement('div'); note.className = 'st-note'; note.hidden = true; el.appendChild(note);
  let pinned = null;
  function bandNote(ev, p) {
    const d = p.d, yr = Math.min(S.y1, Math.floor(p.t)), w = frac(p.t); // the right edge is the window's last year, as the gutter reads it
    const i = Math.max(0, Math.min(samples.length - 1, Math.round((w - samples[0]) / (samples[1] - samples[0]))));
    const L = layers.find((l) => l.key === d);
    const row = L && L[i] && L[i].data;
    const tot = row ? stackKeys.reduce((a, k) => a + (row[k] || 0), 0) : 0;
    const share = row && tot ? (100 * (row[d] || 0)) / tot : 0;
    const list = (byDomain.get(d) || []).filter((e) => e.year >= S.y0 && e.year <= S.y1);
    const dec = d3.rollups(list, (v) => v.length, (e) => Math.floor(e.year / 10) * 10).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    note.innerHTML = `<span class="h"><i style="background:${col(d)}"></i>${esc(DISP(d).label)}</span><b>${share < 1 ? 'Under 1%' : `${Math.round(share)}%`} of the record in ${yr}</b><span class="f">${list.length.toLocaleString('en-US')} events, ${S.y0} to ${S.y1}${dec ? ` · peak ${dec[0]}s, ${dec[1]}` : ''}</span><span class="g">${TOUCH ? (pinned && !pinned.auto ? 'Pinned · tap to release' : 'Tap to pin') : pinned && !pinned.auto ? 'Pinned · click to release' : 'Click to pin · double-click isolates the band'}</span>`;
    note.hidden = false;
    const r = el.getBoundingClientRect(); const nw = note.offsetWidth || 240, nh = note.offsetHeight || 60;
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top - nh - 12;
    if (x + nw > r.width - 8) x = ev.clientX - r.left - nw - 14; if (y < 4) y = ev.clientY - r.top + 18;
    note.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function unpin() { pinned = null; note.hidden = true; }
  // the view opens with a selection made: the Artificial intelligence band's note sits at the band's right end until the reader pins or releases one
  let autoNote = true;
  function placeNote(d) {
    const L = layers.find((l) => l.key === d); if (!L || !samples.length) return false;
    const i = samples.length - 1, [a, b] = bandAt(L, i), u = U(samples[i]);
    const sr = svg.node().getBoundingClientRect();
    const x = vertical ? (a + b) / 2 : u, y = vertical ? u : (a + b) / 2;
    if (Math.abs(b - a) < 1) return false;
    bandNote({ clientX: sr.left + x - 8, clientY: sr.top + y }, { d, t: S.y1 });
    return true;
  }
  function defaultNote() {
    if (!autoNote || cx.on || !byDomain.has('ai')) return;
    pinned = { d: 'ai', auto: true };
    if (!placeNote('ai')) unpin();
  }
  hit.on('mousemove', (ev) => {
    if (dragging) return;
    const gr = gutterRow(ev);
    const p = gr ? { d: gr.key, t: S.y1, gutter: true } : pick(ev);
    hit.style('cursor', gr || p.d ? 'pointer' : null);
    if (p.d !== hoverDomain) { hoverDomain = p.d; showTicks(p.d); hoverBand(p.d); if (!p.d) gAreas.selectAll('path').attr('opacity', (l) => bandOp(l.key)); }
    showArcs(null);
    if (p.gutter) { tip.show(ev, `<div class="k"><i style="background:${col(p.d)}"></i>${esc(DISP(p.d).label)}</div><div class="m">${solo === p.d ? 'click to show all bands' : 'click to isolate this band'}</div>`); if (!pinned) note.hidden = true; }
    else if (p.d) { tip.hide(); if (!pinned || pinned.auto) bandNote(ev, p); } // the opening note is soft: hover reads other bands, leaving restores it
    else { tip.hide(); if (!pinned) note.hidden = true; else if (pinned.auto) placeNote(pinned.d); }
    hit.node().__pick = p;
  }).on('mouseleave', () => { if (dragging) return; hoverDomain = null; showTicks(null); hoverBand(null); gAreas.selectAll('path').attr('opacity', (l) => bandOp(l.key)); showArcs(null); tip.hide(); if (!pinned) note.hidden = true; else if (pinned.auto) placeNote(pinned.d); })
    .on('click', (ev) => {
      const gr = gutterRow(ev); if (gr) { toggleSolo(gr.key); return; }
      // a band's name under the hit surface splits or folds its family (the names let the pointer through so hover still reads the band)
      const nm = gLabels.selectAll('.st-name[data-split="1"]').nodes().find((q) => { const r = q.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; });
      if (nm) { autoNote = false; toggleSplit(nm.getAttribute('data-k')); return; }
      const p = pick(ev);
      if (cx.on) { if (p.e) cxPick(p.e.id); return; } // in Connections a click on the plot picks the nearest record
      autoNote = false;
      if (!p.d) { unpin(); return; }
      enterWhere(p.d); // a band tap: the region strip for that band stands in place of the chart
    });
  // where mode: the chart gives its place to the region strip of one band; the back control or Escape returns
  function enterWhere(k) {
    if (!byDomain.has(k)) return;
    if (vertical) { pinned = { d: k }; placeNote(k); return; } // on a phone the strip stays off; the tap pins the band's note
    whereKey = k; unpin(); hoverBand(null); tip.hide(); render(S, new Set(['mode'])); ctl.querySelector('.st-back').focus({ preventScroll: true }); }
  function leaveWhere() { if (!whereKey) return; whereKey = null; render(S, new Set(['mode'])); }
  // a family's name splits it into its domains; a domain's name folds its family back
  function toggleSplit(k) { const f = FAM[k] ? k : famOf[k]; if (!f) return; if (split.has(f)) split.delete(f); else split.add(f); if (solo && !FAM[solo] && famOf[solo] === f) solo = null; if (solo === f) solo = null; render(S, new Set(['mode'])); }
  // keyboard: the gutter rows are buttons
  gLabels.style('pointer-events', null);
  svg.on('keydown', (ev) => { const row = ev.target.closest && ev.target.closest('.st-end'); if (row && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); toggleSolo(row.getAttribute('data-d')); } if (ev.key === 'Escape' && solo) { solo = null; applySolo(); syncCtl(); } });

  // phones open on the present: the first screen holds 1900 to 2026, and the sticky line above offers the earlier centuries
  const earlier = el.querySelector('.st-earlier');
  let openedOnPresent = false;
  const sc = () => (vertical ? plot : el); // the scroller: the plot box on phones
  const svgTop = () => svg.node().getBoundingClientRect().top - sc().getBoundingClientRect().top + sc().scrollTop; // svg elements have no offsetTop
  function syncEarlier() { if (!vertical) { earlier.hidden = true; return; } earlier.hidden = sc().scrollTop < svgTop() + 40; }
  plot.addEventListener('scroll', syncEarlier, { passive: true });
  earlier.addEventListener('click', () => { sc().scrollTo({ top: 0, behavior: RM() ? 'auto' : 'smooth' }); });
  function openOnPresent() {
    if (!vertical || openedOnPresent) return;
    if (S.y0 > 1026) { openedOnPresent = true; return; } // a brushed window already chose where to look
    const box = sc();
    if (box.scrollHeight < box.clientHeight + 400) return; // the plot has not taken its height yet; the next render tries again
    openedOnPresent = true;
    // the plot arrives at its end: 2026 at the foot of the box, the AI era on the first screen, the earlier centuries a scroll up
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; syncEarlier(); });
  }
  let everDrawn = false, drawSeq = 0;
  function render(state, changed) {
    // the cold path: the first render arrives inside the task that decoded the record and mounted the view, so it
    // yields a frame first; layout and compute then run in their own task and the paths land in the frame after
    if (!everDrawn) { everDrawn = true; const seq = ++drawSeq; requestAnimationFrame(() => { if (seq !== drawSeq) return; layout(); requestAnimationFrame(() => { if (seq !== drawSeq) return; renderNow(state, changed, true); }); }); return; } // three frames: layout, compute, paths
    renderNow(state, changed, false);
  }
  function renderNow(state, changed, cold) {
    const full = changed.has('*') || changed.has('y0') || changed.has('y1');
    if (full) layout();
    cxSync();
    if (full || changed.has('domains') || changed.has('mode')) unpin(); // the bands move under a pinned note
    if (full || changed.has('domains') || changed.has('types') || changed.has('thread') || changed.has('q') || changed.has('mode')) {
      // the lasso is drawn in pixels; a new window or stack moves the bands under it, so it is lifted
      if (lassoPoly) { lassoPoly = null; const old = lassoEl(); if (old) old.remove(); }
      const t0 = performance.now(); compute(); const t1 = performance.now(); scales();
      performance.measure('stream:compute', { start: t0, end: t1 });
      const animate = !changed.has('*') && !changed.has('y0') && !changed.has('y1');
      if (vertical || cold) { // phones and the first render: the paths land in the next frame, so no single task carries compute and draw together
        const seq = ++drawSeq;
        requestAnimationFrame(() => { if (seq !== drawSeq) return; const a = performance.now(); draw(false); performance.measure('stream:draw', { start: a, end: performance.now() }); after(changed); });
        syncCtl(); return;
      }
      const t2 = performance.now(); draw(animate); performance.measure('stream:draw', { start: t2, end: performance.now() });
    }
    after(changed);
  }
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120));
  function after(changed) {
    syncCtl();
    // the locator thumbnail is not on the critical path: it lands when the thread is idle
    idle(() => { const a = performance.now(); loc.layout(locatorWidth(W, vertical, locHost.clientWidth || W - 22)).update(S.y0, S.y1); performance.measure('stream:locator', { start: a, end: performance.now() }); });
    if (changed.has('sel')) showArcs(S.sel || null);
    openOnPresent(); syncEarlier();
    if (!pinned || pinned.auto) defaultNote();
    if (S.sel && vertical && (changed.has('sel') || changed.has('*'))) { if (cx.on) cxFoldList(S.sel, { onExit: cxExit, onPick: cxPick }); else cxFold(S.sel); } // on phones the drawer is the index
    cxAfter();
  }

  // ---- Connections: pick a record, see where it appears across the tabs ----
  const cx = { on: false, sel: null, marks: [], focus: -1 };
  const cxHost = document.createElement('aside'); cxHost.className = 'cx-ix'; cxHost.hidden = true; el.appendChild(cxHost);
  // a record's place on the plot: its year on the axis, the middle of its band there
  function cxPos(e) {
    if (vertical) return null;
    const L = layers.find((l) => l.key === e._sk); if (!L) return null;
    const x = U(e.w); const n = samples.length;
    const i = Math.max(0, Math.min(n - 1, Math.round((e.w - samples[0]) / (samples[1] - samples[0]))));
    const [a, b] = bandAt(L, i); if (Math.abs(b - a) < 0.5) return null;
    return { x, y: (a + b) / 2 };
  }
  // before the draw: the mode flag decides the gutter; after it: the graph and the index
  function cxSync() {
    const want = !!parseMode().cx; // phones run the mode too: the pick brushes and the drawer carries the list
    if (want === cx.on) return;
    cx.on = want; if (!want) { cx.sel = null; cxFoldStop(); } else { if (!cx.sel && S.sel) cx.sel = S.sel; cx.win0 = [S.y0, S.y1]; cx.brushed = false; } cx.marks = []; cx.focus = -1; cx.all = false; // the window on entry comes back on Exit
    cxHost.hidden = !want || vertical; el.classList.toggle('cx-on', want && !vertical);
  }
  // phones: the column carries the links as ticks across the bands at their years (heavier for the picked record, hairline for the linked),
  // the other bands pale, and the view scrolls so the picked tick is on screen above the sheet
  let cxScrolledFor = null;
  function cxVertical() {
    gCx.selectAll('*').remove();
    const id = cx.sel || S.sel;
    const e = id ? db.byId.get(id) : null;
    if (!e) { gAreas.selectAll('path').attr('opacity', (l) => bandOp(l.key)); gLabels.style('opacity', null); return; }
    cxLinks(e.id, () => { if (cx.on && vertical) cxVertical(); });
    const linked = cxLinked(e, cxPool(), Infinity);
    const lit = new Set([e._sk, ...linked.map((l) => l.e._sk)]);
    gAreas.selectAll('path').attr('opacity', (l) => (lit.has(l.key) ? bandOp(l.key) : 0.35));
    gLabels.style('opacity', 0.6);
    const tickAt = (o) => { const L = layers.find((l) => l.key === o._sk); if (!L || !inWin(o)) return null; const i = Math.max(0, Math.min(samples.length - 1, Math.round((o.w - samples[0]) / (samples[1] - samples[0])))); const [a, b] = bandAt(L, i); if (Math.abs(b - a) < 0.5) return null; return { x0: Math.min(a, b), x1: Math.max(a, b), y: U(o.w) }; };
    const rows = linked.map((l) => ({ e: l.e, p: tickAt(l.e), me: false })).filter((r) => r.p);
    const mine = tickAt(e); if (mine) rows.push({ e, p: mine, me: true });
    const g = gCx.selectAll('g.cx-tick').data(rows, (r) => r.e.id).join('g').attr('class', (r) => `cx-tick${r.me ? ' me' : ''}`)
      .attr('role', 'button').attr('tabindex', -1).attr('aria-label', (r) => `${r.e.title}, ${r.e.year}${r.me ? ', the picked record' : ', linked'}`)
      .style('cursor', 'pointer').on('click', (ev, r) => { ev.stopPropagation(); if (!r.me) cxPick(r.e.id); });
    g.selectAll('line.hit').data((r) => [r]).join('line').attr('class', 'hit').attr('x1', (r) => r.p.x0 - 6).attr('x2', (r) => r.p.x1 + 6).attr('y1', (r) => r.p.y).attr('y2', (r) => r.p.y).attr('stroke', 'transparent').attr('stroke-width', 16);
    g.selectAll('line.mk').data((r) => [r]).join('line').attr('class', 'mk').attr('x1', (r) => r.p.x0 - (r.me ? 6 : 0)).attr('x2', (r) => r.p.x1 + (r.me ? 6 : 0)).attr('y1', (r) => r.p.y).attr('y2', (r) => r.p.y)
      .attr('stroke', '#121212').attr('stroke-width', (r) => (r.me ? 2.5 : 1)) // the picked record's tick is ink too, heavier and overshooting the band; red is kept for hover and focus.attr('shape-rendering', 'crispEdges');
    if (mine && cxScrolledFor !== e.id) { cxScrolledFor = e.id; const y = Math.max(0, svgTop() + mine.y - sc().clientHeight * 0.3); if (Math.abs(sc().scrollTop - y) > 40) sc().scrollTo({ top: y, behavior: RM() ? 'auto' : 'smooth' }); } // once per pick
  }
  function cxAfter() {
    if (cx.on && vertical) { cxHost.hidden = true; cxVertical(); return; }
    if (!cx.on || vertical) { gCx.selectAll('*').remove(); gAreas.selectAll('path').attr('opacity', (l) => bandOp(l.key)); gLabels.style('opacity', null); cxHost.hidden = true; return; }
    cxHost.style.top = `${TOP - 8}px`; cxHost.style.height = `${H - TOP - 12}px`;
    cxDraw();
  }
  // a pick brushes the window to the span of the record and its linked records, so the graph spreads (Locator scrub: a cut, window and locator together)
  function cxPick(id) {
    cx.sel = id; cx.focus = -1; cx.all = false;
    const e = db.byId.get(id);
    if (e && !cxLinks(id, () => { if (cx.on && cx.sel === id) cxPick(id); }) && !db.links) { cxDraw(); return; } // the links are still arriving; the pick repeats when they land
    if (e) { const all = cxLinked(e, cxPool(), Infinity); const [y0, y1] = cxSpan(e, all); const brush = all.length && (y0 !== S.y0 || y1 !== S.y1); if (brush) cx.brushed = true; if (vertical) { set(brush ? { y0, y1, sel: id } : { sel: id }); return; } if (brush) { set({ y0, y1 }); return; } } // phones: the drawer opens on the record with the list first
    cxDraw();
  }
  const cxPool = () => db.events.filter((o) => passes(o));
  const inWin = (o) => o.year >= S.y0 && o.year <= S.y1;
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && cx.on && el.classList.contains('on') && !el.contains(ev.target)) { ev.preventDefault(); cxExit(); } }); // Escape leaves the mode from anywhere on the page
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && el.classList.contains('on')) { if (whereKey) { ev.preventDefault(); leaveWhere(); } else if (pinned) { ev.preventDefault(); autoNote = false; unpin(); } } });
  function cxExit() { const m = parseMode(); const back = cx.brushed && cx.win0 ? { y0: cx.win0[0], y1: cx.win0[1] } : {}; set({ mode: modeStr(m.stack, m.count, false), ...back }); } // the picks' brushing is undone with the mode
  function cxDraw() {
    const e = cx.sel ? evs.find((o) => o.id === cx.sel) || db.events.find((o) => o.id === cx.sel) : null;
    if (e) cxLinks(e.id, () => { if (cx.on) cxDraw(); });
    const linked = e ? cxLinked(e, cxPool(), cx.all ? Infinity : 40) : [];
    const sel = e && inWin(e) ? cxPos(e) : null;
    cx.marks = linked.map((l) => { const p = inWin(l.e) ? cxPos(l.e) : null; return p ? { e: l.e, x: p.x, y: p.y } : null; }).filter(Boolean);
    const lit = new Set(e ? [e._sk, ...cx.marks.map((m) => m.e._sk)] : []);
    // the bands that hold no linked record pale; the record's own band and the linked bands stay
    gAreas.selectAll('path').attr('opacity', (l) => (e ? (lit.has(l.key) ? bandOp(l.key) : 0.35) : bandOp(l.key)));
    gLabels.style('opacity', e ? 0.6 : null); // names stay legible at 3:1 while the bands pale
    cxGraph(gCx, sel, cx.marks, { onPick: cxPick, focus: cx.focus, onFocus: cxFocus });
    cxIndex(cxHost, { e, linked, all: cx.all, onPick: cxPick, onExit: cxExit, onAll: () => { cx.all = true; cxDraw(); } });
  }
  el.addEventListener('keydown', (ev) => {
    if (!cx.on) return;
    if (ev.target !== el && ev.target.closest('input,select,textarea')) return;
    cxKey(ev, cx, { onPick: cxPick, onExit: cxExit, onFocus: cxFocus });
  });
  function cxFocus(i) { cx.focus = i; const e = db.byId.get(cx.sel); cxGraph(gCx, e && inWin(e) ? cxPos(e) : null, cx.marks, { onPick: cxPick, focus: i, onFocus: cxFocus }); }
  performance.measure('stream:mount', { start: mountT0, end: performance.now() });
  return {
    render,
    resize() { render(S, new Set(['*'])); },
    hover(id) { showArcs(id); },
    lit(l) { LIT = l; relit(); },
  };
}
