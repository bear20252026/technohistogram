// B. THE COLUMNS, 10x: a dense, zoomable, correlated chart of the whole record on one continuous vertical clock.
// Eight lenses side by side, era bands behind them, dots coloured by domain or region, a sticky year rail,
// row cross-highlighting, zoom to decade, bezier threads between linked events, a mini-map and keyboard navigation.
import { domainColor, AI_ERAS, DOMAIN } from '../palette.js';
import { passes, drawn, neighbors } from '../data.js';
import { state as S, set, YEAR_MIN, YEAR_MAX } from '../store.js';
import { eventTip, esc } from '../ui.js';
import { timeScale, AGES, REGION, regionColor } from '../time.js';
import { shortTitle } from '../text.js';
import { drawLit, chipDrag } from '../lit.js';
import { ATLAS, atlasLocator, locatorWidth } from '../atlas.js';
import { popover } from '../hp_pop.js';
import { cxLinks, cxLinked, cxIndex, cxGraph, cxKey, cxSpan, cxFold } from '../connect.js';

const MAKE = new Set(['invention', 'discovery', 'product', 'milestone']);
export const LENSES = [
  { id: 'inv', label: 'Inventions', sub: 'machines, materials, networks', color: '#2d5a88', f: (e) => MAKE.has(e.type) && e.domain !== 'ai' && !e.ai_precursor },
  { id: 'ai', label: 'AI', sub: 'ideas, systems, people', color: '#b8282e', f: (e) => (e.domain === 'ai' || e.ai_precursor) && (MAKE.has(e.type) || ['concept', 'person', 'era'].includes(e.type)) },
  { id: 'money', label: 'Money', sub: 'markets, firms, booms, busts', color: '#c99a1e', f: (e) => e.type === 'market' },
  { id: 'policy', label: 'Policy', sub: 'law, war, standards', color: '#4c8a5a', f: (e) => e.type === 'policy' },
  { id: 'culture', label: 'Culture', sub: 'books, films, ideas', color: '#c4688a', f: (e) => e.type === 'culture' || (e.domain !== 'ai' && !e.ai_precursor && ['concept', 'person', 'era'].includes(e.type)) },
  { id: 'hope', label: 'Hopes', sub: 'promises and visions', color: '#d9b21e', f: (e) => e.type === 'hope' },
  { id: 'fear', label: 'Fears', sub: 'anxieties and warnings', color: '#d23a2f', f: (e) => e.type === 'fear' },
  { id: 'fail', label: 'Failures', sub: 'crashes, flops, harms', color: '#7a2420', f: (e) => e.type === 'failure' || e.type === 'incident' },
];
const MONO = 'Instrument Sans, monospace';
// motion stops under reduced motion; the static state carries the same information
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduced-motion');
// where the piecewise clock changes stride (time.js KNOTS); each is marked on the rail and the locator
const BREAKS = [1500, 1800, 1900, 1950, 2000];

export default function columns(el, { db, select, tip }) {
  el.classList.add('scroll-xy');
  el.tabIndex = 0;
  el.setAttribute('aria-label', 'Columns. Arrow keys move between events, Enter opens one, plus and minus zoom, Home shows the whole millennium.');
  el.innerHTML = `
    <div class="cw-top">
      <div class="view-head cw-head"><span class="sc">Correlated history</span><h2>Columns</h2>
      <p>Columns of events, ${YEAR_MIN} to ${YEAR_MAX}. One row shows what was invented, funded, legislated, celebrated and feared in the same years. Click a year on the rail or a folded decade to open it; click an event to thread its links across columns.</p>
      <p class="cw-contract atlas-key" aria-label="How to read"></p><div class="atlas-loc-host"></div></div>
      <div class="cw-ctl">
        <button type="button" class="hp-act hp-popbtn" data-pop aria-expanded="false" aria-controls="cw-pop">Chart options</button>
        <button type="button" class="cw-back" data-back hidden>&larr; whole millennium</button>
        <div class="hp-pop" id="cw-pop" role="group" aria-label="Chart options" hidden>
        <span class="sc">Time scale</span><div class="toggle" role="group" aria-label="Time scale"><button type="button" data-scale="warp" title="Piecewise: the present expanded">Stretched</button><button type="button" data-scale="linear">Linear</button><button type="button" data-scale="log">Log</button></div>
        <span class="sc">Colour</span><div class="toggle" role="group" aria-label="Dot colour"><button type="button" data-col="domain">Domain</button><button type="button" data-col="region">Region</button></div>
        <button type="button" class="hp-act" data-pin aria-pressed="false">Pin year</button>
        <button type="button" class="hp-act" data-path aria-pressed="false">Pick two</button>
        <button type="button" class="hp-act cw-cx" data-cx aria-pressed="false">Connections</button>
        <span class="sc">Lenses</span><div class="toggle cw-preset" role="group" aria-label="How many lenses"><button type="button" data-n="8" title="All eight lenses">8</button><button type="button" data-n="5" title="First five of your order">5</button><button type="button" data-n="3" title="First three of your order">3</button></div>
        <span class="cw-kbd sc">&uarr;&darr;&larr;&rarr; move &middot; enter open &middot; + / &minus; zoom</span>
        </div>
      </div>
    </div>
    <div class="cw-lenses"><span class="sc">Lenses</span><div class="hp-chips row" aria-label="Lenses: press to show or hide, drag to reorder"></div></div>
    <div class="cols-head"></div>
    <div class="cols-body"></div>
    <footer class="cw-foot"></footer>`;
  const foot = el.querySelector('.cw-foot');
  const contractEl = el.querySelector('.cw-contract');
  // the record's last entry, for the footer's "through" date
  const lastT = d3.max(db.events, (e) => e.t) || YEAR_MAX;
  const lastLabel = (() => { const yr = Math.floor(lastT); const m = Math.min(11, Math.floor((lastT - yr) * 12)); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]} ${yr}`; })();
  const head = el.querySelector('.cols-head');
  const body = el.querySelector('.cols-body');
  const railSvg = d3.select(body).append('svg').attr('class', 'rail').attr('aria-hidden', 'true');
  const svg = d3.select(body).append('svg').attr('class', 'cols-main').attr('role', 'group').attr('aria-label', 'Eight synchronized columns of events by year: inventions, AI, money, policy, culture, hopes, fears and failures');
  const gBands = svg.append('g');
  const gGrid = svg.append('g');
  const gRow = svg.append('g').style('pointer-events', 'none');
  const gPin = svg.append('g').attr('class', 'cw-pin').style('pointer-events', 'none');
  const gCells = svg.append('g');
  const gCols = svg.append('g');
  const gArcs = svg.append('g').style('pointer-events', 'none');
  const gFocus = svg.append('g').style('pointer-events', 'none');
  const gPath = svg.append('g').attr('class', 'cw-path').style('pointer-events', 'none');
  const gLit = svg.append('g').style('pointer-events', 'none');
  const gCx = svg.append('g').attr('class', 'cx-layer'); // the connections graph, above the items so its marks take the click
  let LIT = null;
  const relit = () => drawLit(gLit, LIT, (id) => posById.get(id) || null);
  const mini = d3.select(body).append('svg').attr('class', 'cw-mini').attr('aria-hidden', 'true');

  let W, RAIL, MINI = 0, CW, H, y, items = [], posById = new Map(), cols = [], colour = 'domain', focusKey = null, mobile = false;
  // the visitor's lens set and order, a pinned reference year, and the two ends of a path through the connects graph
  let active = LENSES.map((l) => l.id), pinYear = null, picking = false, pinning = false, ends = [], pathIds = null;
  // the lens order and picks live in memory for the session; a preset (8, 5 or 3) takes the first lenses of that order,
  // and until the visitor chooses, the preset is the largest count that fits the screen without horizontal scroll
  let lensOrder = LENSES.map((l) => l.id), preset = null, customActive = null;
  const AL = () => active.map((id) => LENSES.find((l) => l.id === id));
  const lensCol = (l) => { const i = active.indexOf(l.id); return active.length <= ATLAS.length && i >= 0 ? ATLAS[i] : l.color; };
  let firstHead = true;
  const chips = el.querySelector('.cw-lenses .hp-chips');
  const presetEl = el.querySelector('.cw-preset');
  const locHost = el.querySelector('.atlas-loc-host');
  const loc = atlasLocator(locHost, { width: 260 });
  const fitsN = (w) => { const rail = w < 760 ? 54 : 96, mini = w < 760 ? 0 : Math.max(120, Math.min(190, Math.round(w * 0.125))); const n = Math.floor((w - rail - mini - 2) / (w < 760 ? 160 : 140)); return n >= 8 ? 8 : n >= 5 ? 5 : 3; };
  function applyPreset(n) { active = lensOrder.slice(0, n); }
  function syncPreset() { presetEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(preset !== 'custom' && +b.dataset.n === active.length && lensOrder.slice(0, active.length).every((id, i) => active[i] === id)))); }
  presetEl.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-n]'); if (!b) return; preset = +b.dataset.n; applyPreset(preset); refresh(); });
  function drawChips() {
    const order = [...active, ...lensOrder.filter((id) => !active.includes(id))];
    lensOrder = order;
    syncPreset();
    chips.innerHTML = order.map((id) => { const l = LENSES.find((x) => x.id === id); const on = active.includes(id); return `<button type="button" class="hp-chip${on ? '' : ' off'}" data-d="${id}" aria-pressed="${on}" style="--c:${lensCol(l)}" title="${esc(l.sub)}"><i></i>${esc(l.label)}</button>`; }).join('');
  }
  chipDrag(chips, {
    onReorder(ids) { lensOrder = ids; active = ids.filter((id) => active.includes(id)); refresh(); },
    onClick(id) { if (active.includes(id)) { if (active.length === 1) return; active = active.filter((x) => x !== id); } else { const order = [...chips.querySelectorAll('.hp-chip')].map((c) => c.dataset.d); active = order.filter((x) => x === id || active.includes(x)); } preset = 'custom'; customActive = active.slice(); refresh(); },
  });
  function refresh() { drawChips(); layout(); drawFrame(); drawItems(); showArcs(S.sel || null); drawPin(); drawPath(); }
  drawChips();
  // the mode string carries the clock and, after a dot, the connections flag: 'linear.cx'
  const modeParts = () => (S.mode || '').split('.');
  const scaleMode = () => { const m = modeParts()[0]; return m === 'linear' || m === 'log' ? m : 'warp'; };
  const cxWanted = () => modeParts().includes('cx');
  const modeWith = (scale, on) => [scale === 'warp' ? '' : scale, on ? 'cx' : ''].filter(Boolean).join('.');
  const dotColor = (e) => (colour === 'region' ? (e.region ? regionColor(e.region) : '#b9b1a0') : domainColor(e.domain));
  const isFull = () => S.y0 <= YEAR_MIN && S.y1 >= YEAR_MAX;

  // ---- layout: height follows the density of the clock so the present always has room ----
  function layout() {
    const r = el.getBoundingClientRect();
    mobile = r.width < 760;
    // before the visitor has chosen, the lens count follows the screen (8 at 1440, 5 at 1024, 3 on a phone)
    if (preset === null) { const n = fitsN(r.width - (cx.on ? 288 : 0)); if (n !== active.length) { applyPreset(n); drawChips(); } } // the connections index takes its column from the lens count, not from the lenses
    RAIL = mobile ? 54 : 96;
    // the locator takes 10 to 20 percent of the canvas so the viewport reads as a rectangle, not a sliver
    MINI = mobile ? 0 : Math.max(120, Math.min(190, Math.round(r.width * 0.125)));
    CW = Math.max(mobile ? 160 : 140, Math.floor((r.width - RAIL - MINI - 2 - (cx.on ? 288 : 0)) / AL().length));
    W = CW * AL().length;
    const probe = timeScale({ domain: [S.y0, S.y1 + 1], range: [0, 1], mode: scaleMode() });
    // pixels so that the most expanded year gets about 28px, with a floor from the viewport and a ceiling for sanity
    let maxPerYear = 0;
    for (let yy = S.y0; yy <= S.y1; yy += Math.max(1, Math.floor((S.y1 - S.y0) / 400))) maxPerYear = Math.max(maxPerYear, probe(yy + 1) - probe(yy));
    const ideal = (mobile ? 30 : 28) / Math.max(maxPerYear, 1e-6);
    H = Math.round(Math.max(r.height - 150, Math.min(16000, ideal))) + 40;
    y = timeScale({ domain: [S.y0, S.y1 + 1], range: [16, H - 24], mode: scaleMode() });
    railSvg.attr('width', RAIL).attr('height', H);
    svg.attr('width', W).attr('height', H);
    head.innerHTML = `<div class="cw-corner sc" style="width:${RAIL}px">year</div>` +
      AL().map((l, i) => `<div class="cw-lens${firstHead && !RM() ? ' cw-grow' : ''}" style="width:${CW}px;--i:${i}"><div class="bar" style="background:${lensCol(l)}"></div><div class="row"><span class="lg">${l.label}</span><span class="mono n" data-n="${l.id}"></span></div><div class="sub">${l.sub}</div></div>`).join('') +
      (MINI ? `<div class="cw-corner cw-loc-head" style="width:${MINI}px" title="All the years shown, lens by lens; the box is this screen. Click or drag to move."><span class="sc">locator</span></div>` : '');
    firstHead = false;
    mini.style('display', MINI ? null : 'none');
    el.querySelectorAll('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scale === scaleMode())));
    el.querySelectorAll('[data-col]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.col === colour)));
    el.querySelector('[data-back]').hidden = isFull();
    contract();
  }
  // the encoding contract (head) and the denominator footer (fixed at the foot of the scroller)
  function contract() {
    const clock = { warp: 'a year axis stretched toward the present', linear: 'a linear year axis', log: 'a log year axis' }[scaleMode()];
    contractEl.textContent = `column = lens${active.length <= ATLAS.length ? ', its rule in a family hue' : ''}; color = ${colour}; y = date on ${clock}; a fold is a decade with more events than fit, click to open it`;
  }
  function footer() {
    const inWin = db.events.filter((e) => drawn(e) && e.year >= S.y0 && e.year <= S.y1).length;
    const shown = cols.reduce((n, c) => n + c.list.length, 0);
    const folded = cols.reduce((n, c) => n + c.list.length - c.loose.length, 0);
    const nFolds = cols.reduce((n, c) => n + c.folded.size, 0);
    foot.innerHTML = `<span><b>${inWin.toLocaleString('en-US')}</b> events, ${S.y0} to ${S.y1}${mobile ? '' : `; ${shown.toLocaleString('en-US')} placings across ${AL().length} lenses${nFolds ? `, ${folded.toLocaleString('en-US')} of them in ${nFolds} folded decade${nFolds === 1 ? '' : 's'}` : ''}`}</span><span>every event cites its source; open one to read it</span><span>record through ${lastLabel}</span>`;
  }

  // ---- frame: era bands, year rules, the sticky rail ----
  function drawFrame() {
    const span = S.y1 - S.y0;
    const longView = span > 150;
    const eras = (longView ? AGES : AI_ERAS).filter((e) => e.end > S.y0 && e.start <= S.y1 + 1);
    const top = (d) => y(Math.max(S.y0, d.start)), bot = (d) => y(Math.min(S.y1 + 1, d.end));
    gBands.selectAll('rect').data(eras, (d) => d.id).join('rect')
      .attr('x', 0).attr('width', W).attr('y', top).attr('height', (d) => Math.max(0, bot(d) - top(d)))
      .attr('fill', (d, i) => (d.winter ? 'rgba(80,110,150,.10)' : i % 2 ? 'rgba(184,40,46,.035)' : 'rgba(28,26,23,.025)'))
      .style('cursor', 'zoom-in').on('click', (ev, d) => zoomTo(Math.max(S.y0, d.start), Math.min(S.y1, d.end - 1)));
    const ticks = y.ticks(mobile ? 28 : 22);
    gGrid.selectAll('line.h').data(ticks, (d) => d).join('line').attr('class', 'h')
      .attr('x1', 0).attr('x2', W).attr('y1', y).attr('y2', y)
      .attr('stroke', (d) => (y.major(d) ? 'rgba(28,26,23,.4)' : 'rgba(28,26,23,.13)'));
    gGrid.selectAll('.vl').data(AL()).join('line').attr('class', 'vl').attr('x1', (d, i) => i * CW + 0.5).attr('x2', (d, i) => i * CW + 0.5).attr('y1', 0).attr('y2', H).attr('stroke', 'rgba(28,26,23,.16)');

    railSvg.selectAll('*').remove();
    railSvg.append('rect').attr('width', RAIL).attr('height', H).attr('fill', 'var(--paper)');
    const rb = railSvg.append('g');
    const ew = RAIL > 60 ? 30 : 14;
    rb.selectAll('rect').data(eras).join('rect').attr('x', 2).attr('width', ew).attr('y', (d) => top(d) + 0.5).attr('height', (d) => Math.max(0, bot(d) - top(d) - 1))
      .attr('fill', (d) => (d.winter ? '#8aa3c0' : longView ? '#121212' : '#b8282e')).attr('opacity', (d, i) => (d.winter ? 0.55 : longView ? 0.06 + (i % 2) * 0.06 : 0.12 + d.level * 0.07))
      .style('cursor', 'zoom-in').on('click', (ev, d) => zoomTo(Math.max(S.y0, d.start), Math.min(S.y1, d.end - 1)));
    rb.selectAll('text.era').data(eras).join('text').attr('class', 'era')
      .attr('transform', (d) => `translate(${2 + ew / 2},${(top(d) + bot(d)) / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-family', MONO).attr('font-size', 10.5)
      .attr('letter-spacing', '0.06em').attr('fill', (d) => (d.level > 4 || d.winter ? '#121212' : '#48433b')).style('pointer-events', 'none')
      .text((d) => { const h = bot(d) - top(d); const t = (d.short || d.label).toUpperCase(), tl = d.label.toUpperCase(); return h > tl.length * 7 ? tl : h > t.length * 7 ? t : ''; });
    rb.selectAll('text.yr').data(ticks).join('text').attr('class', 'yr')
      .attr('x', RAIL - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('font-family', (d) => (y.major(d) ? 'Instrument Serif, serif' : MONO))
      .attr('font-size', (d) => (y.major(d) ? 20 : 10.5)).attr('fill', (d) => (d % 10 === 0 ? '#121212' : '#6e6e6a')).text((d) => d)
      .style('cursor', 'zoom-in').on('click', (ev, d) => zoomTo(Math.floor(d / 10) * 10, Math.floor(d / 10) * 10 + 9))
      .append('title').text((d) => `Zoom to the ${Math.floor(d / 10) * 10}s`);
    rb.append('line').attr('x1', RAIL - 0.5).attr('x2', RAIL - 0.5).attr('y1', 0).attr('y2', H).attr('stroke', 'rgba(28,26,23,.42)');
    // where the clock changes stride: a double slash across the rail's edge, with the stride on either side in its title
    if (scaleMode() === 'warp') {
      const avg = (y(S.y1 + 1) - y(S.y0)) / (S.y1 + 1 - S.y0);
      const seg = [S.y0, ...BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1), S.y1 + 1];
      rb.selectAll('path.brk').data(BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1)).join('path').attr('class', 'brk cw-break')
        .attr('d', (k) => (mobile ? `M${3},${y(k) + 3}l4,-6M${8},${y(k) + 3}l4,-6` : `M${ew + 6},${y(k) + 4}l5,-8M${ew + 11},${y(k) + 4}l5,-8`))
        .append('title').text((k) => { const i = seg.indexOf(k); const st = (a, b) => ((y(b) - y(a)) / (b - a) / avg).toFixed(1); return `The clock changes stride at ${k}: ${st(seg[i - 1], k)}\u00d7 the average stride above, ${st(k, seg[i + 1])}\u00d7 below`; });
    }
    // live year readout (moves with the hovered row)
    rb.append('g').attr('class', 'cw-readout').style('display', 'none').call((g) => { g.append('rect').attr('x', ew + 6).attr('width', RAIL - ew - 8).attr('height', 16).attr('y', -8).attr('fill', '#121212'); g.append('text').attr('x', RAIL - 6).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', MONO).attr('font-size', 11).attr('fill', '#f7f7f5'); });
  }

  function zoomTo(a, b) {
    a = Math.max(YEAR_MIN, a); b = Math.min(YEAR_MAX, b);
    if (b - a < 1) return;
    if (a === S.y0 && b === S.y1) return;
    set({ y0: a, y1: b });
  }

  // ---- items: dots in swarm lanes, labels by significance into free slots ----
  function drawItems() {
    const evs = db.events.filter((e) => drawn(e, S, true) && e.year >= S.y0 && e.year <= S.y1); // register and overlays, Vision 4 S5 and S6
    posById = new Map();
    cols = AL().map((l, ci) => ({ l, ci, list: evs.filter(l.f) }));
    cols.forEach((c) => { const n = el.querySelector(`[data-n="${c.l.id}"]`); if (n) n.textContent = c.list.length; });
    const LH = 13;
    const data = [];
    const wrap = (s, n) => {
      if (s.length <= n) return [s, ''];
      const cut = s.lastIndexOf(' ', n);
      const a = s.slice(0, cut > 0 ? cut : n);
      let b = s.slice(a.length).trim();
      if (b.length > n) b = b.slice(0, n - 1).trim() + '\u2026';
      return [a, b];
    };
    // word-wrap into at most `max` lines of `n` characters; null when the text does not fit, so the caller can fall back
    // to a count, a dot or a hover instead of a cut
    const wrapN = (s, n, max) => {
      const words = s.split(' '), lines = []; let cur = '';
      for (const w of words) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= n) cur += ' ' + w; else { lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      return lines.length <= max && lines.every((l) => l.length <= n) ? lines : null;
    };
    // dense decades fold into one swatch per column: a count, the strongest title, and a click that zooms to the decade
    const DENSE_N = 14;
    const cells = [];
    for (const c of cols) {
      const x0 = c.ci * CW;
      const dense = new Set();
      for (const [dec, arr] of d3.group(c.list, (e) => Math.floor(e.year / 10) * 10)) {
        const a = y(Math.max(S.y0, dec)), b = y(Math.min(S.y1 + 1, dec + 10));
        const h = Math.abs(b - a);
        if (arr.length > DENSE_N && arr.length * 7 > h) {
          dense.add(dec);
          const rep = arr.slice().sort((p, q) => q.significance - p.significance || p.t - q.t)[0];
          const cell = { c, x0, dec, arr, top: Math.min(a, b), h, rep, key: c.l.id + '|' + dec };
          cells.push(cell);
          arr.forEach((e) => { e._cx = x0 + CW / 2; e._cy = cell.top + h / 2; posById.set(e.id + '|' + c.l.id, [e._cx, e._cy]); if (!posById.has(e.id)) posById.set(e.id, [e._cx, e._cy]); });
        }
      }
      c.folded = dense;
      c.loose = c.list.filter((e) => !dense.has(Math.floor(e.year / 10) * 10));
    }
    const cg = gCells.selectAll('g.cell').data(cells, (d) => d.key).join((en) => {
      const g = en.append('g').attr('class', 'cell cw-in').style('cursor', 'zoom-in');
      g.append('rect').attr('class', 'bg'); g.append('text').attr('class', 'n'); g.append('text').attr('class', 't'); g.append('text').attr('class', 'z');
      return g;
    });
    cg.style('cursor', 'zoom-in').selectAll('text').attr('opacity', null);
    cg.attr('role', 'button').attr('tabindex', 0);
    cg.select('rect.bg').attr('x', (d) => d.x0 + 3).attr('y', (d) => d.top + 1).attr('width', CW - 6).attr('height', (d) => Math.max(2, d.h - 2))
      .attr('fill', (d) => d3.color(lensCol(d.c.l)).copy({ opacity: 0.1 })).attr('stroke', (d) => d3.color(lensCol(d.c.l)).copy({ opacity: 0.55 })).attr('stroke-width', 0.8);
    cg.select('text.n').attr('x', (d) => d.x0 + 9).attr('y', (d) => d.top + Math.min(14, d.h / 2 + 3.5)).attr('font-family', MONO).attr('font-size', 10).attr('fill', '#121212')
      .text((d) => (d.h >= 12 ? `${d.arr.length} events ` : '')); // the trailing space keeps the count apart from the title for a reader of the text
    cg.select('text.t').attr('x', (d) => d.x0 + 9).attr('y', (d) => d.top + 29).attr('font-family', 'Instrument Sans, serif').attr('font-size', 11).attr('fill', '#48433b')
      .each(function (d) {
        const t = d3.select(this); t.text(null);
        d._tl = 0;
        if (d.h < 40) return;
        const mc = Math.floor((CW - 18) / 5.4);
        // the strongest title of the decade, on up to three lines as the row's height allows; a title that will not fit is left to the open link
        const lines = wrapN(shortTitle(d.rep), mc, d.h >= 67 ? 3 : d.h >= 54 ? 2 : 1);
        if (!lines) return;
        lines.forEach((l, i) => t.append('tspan').attr('x', d.x0 + 9).attr('dy', i ? '1.1em' : 0).text(`${l} `)); // the trailing space keeps the words apart for a reader of the text
        d._tl = lines.length;
      });
    cg.select('text.z').attr('x', (d) => d.x0 + 9).attr('y', (d) => d.top + 44 + Math.max(0, d._tl - 1) * 13).attr('font-family', MONO).attr('font-size', 10.5).attr('fill', '#8e8878')
      .text((d) => (d.h >= 56 + Math.max(0, d._tl - 1) * 13 ? `open the ${d.dec}s \u2192` : ''));
    // the name starts with what the cell shows (count, title, open line), then says which lens and what Enter does
    cg.attr('aria-label', function (d) { const seen = [...this.querySelectorAll('text')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); return `${seen.length ? seen.join(' ') : `${d.arr.length} events`}. ${d.c.l.label}, the ${d.dec}s. Enter zooms to the decade`; });
    cg.on('click', function (ev, d) { tip.hide(); openFold(this, d); })
      .on('keydown', function (ev, d) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openFold(this, d); } })
      .on('mouseenter', (ev, d) => { tip.show(ev, `<b>${d.arr.length} ${esc(d.c.l.label.toLowerCase())} events, ${d.dec}s</b><br>Strongest: ${esc(d.rep.title)}<br><span style="color:var(--ink-3)">Click to zoom to the decade</span>`); rowAt(d.dec + 5); })
      .on('mousemove', tip.move).on('mouseleave', () => tip.hide());
    for (const c of cols) {
      const x0 = c.ci * CW;
      const sorted = c.loose.slice().sort((a, b) => a.t - b.t);
      const lastY = [];
      sorted.forEach((e) => {
        const yy = y(e.t);
        let lane = 0;
        while (lastY[lane] !== undefined && yy - lastY[lane] < 6) lane++;
        lastY[lane] = yy;
        e._cx = x0 + 6 + Math.min(lane, 2) * 4; // one 3px tick per event; a shared year steps the tick 4px right, nothing else
        e._cy = yy;
      });
      // folded decades are occupied space: no label may spill into them
      const occ = cells.filter((k) => k.c === c).map((k) => [k.top - 2, k.top + k.h + 2]);
      const free = (a, b) => !occ.some(([p, q]) => a < q && b > p);
      const byS = c.loose.slice().sort((a, b) => b.significance - a.significance || a.t - b.t);
      const labelX = x0 + 6 + 2 * 4 + 9;
      const maxW = CW - (labelX - x0) - 6;
      const charW = (e) => (e.significance >= 5 ? 6.4 : e.significance >= 4 ? 5.9 : 5.4);
      const maxChars = Math.floor(maxW / 5.4);
      const roomy = y(S.y1 + 1) - y(S.y1) > 40;
      for (const e of byS) {
        const yy = y(e.t);
        // a label is one line of the full title, one line of the short title, or two lines of the full title; otherwise a dot
        const mc = Math.floor(maxW / charW(e));
        let lines = e.title.length <= mc ? [e.title] : shortTitle(e).length <= mc ? [shortTitle(e)] : wrap(e.title, mc);
        if (lines[1] && lines[1].endsWith('\u2026')) { const alt = wrap(shortTitle(e), mc); lines = alt[1].endsWith('\u2026') ? null : alt; }
        const two = !!lines && lines.length === 2 && lines[1] !== '';
        let placed = null;
        // a title that fits on neither one line nor two becomes a dot with the title on hover
        if (lines && (e.significance >= 2 || roomy)) {
          for (const off of [0, -LH * 0.6, LH * 0.6, -LH, LH, -LH * 1.6, LH * 1.6]) {
            const a = yy + off - LH / 2, b = yy + off + LH / 2 + (two ? LH : 0);
            if (free(a, b)) { placed = yy + off; break; }
          }
          // a two-line label that cannot be seated tries the short form on one line, then gives way to the dot
          if (placed === null && two && shortTitle(e).length <= mc) {
            for (const off of [0, -LH * 0.6, LH * 0.6, -LH, LH]) {
              const a = yy + off - LH / 2, b = yy + off + LH / 2;
              if (free(a, b)) { placed = yy + off; lines.length = 0; lines.push(shortTitle(e)); break; }
            }
          }
        }
        if (placed !== null) {
          const isTwo = lines.length === 2 && lines[1] !== '';
          occ.push([placed - LH / 2, placed + LH / 2 + (isTwo ? LH : 0)]);
          e._ly = placed; e._two = isTwo; e._lines = lines;
        } else { e._ly = null; e._lines = null; }
      }
      c.loose.forEach((e) => { data.push({ e, c, labelX, maxChars, key: e.id + '|' + c.l.id }); posById.set(e.id + '|' + c.l.id, [e._cx, e._cy]); if (!posById.has(e.id)) posById.set(e.id, [e._cx, e._cy]); });
    }
    items = data;

    const g = gCols.selectAll('g.it').data(data, (d) => d.key).join((en) => {
      const g = en.append('g').attr('class', 'it cw-in').attr('data-id', (d) => d.e.id).style('cursor', 'pointer');
      g.append('line').style('pointer-events', 'none'); g.append('rect').attr('class', 'tk'); g.append('text').style('pointer-events', 'none'); g.append('rect').attr('class', 'hit');
      return g;
    });
    g.attr('data-key', (d) => d.key);
    // one mark family: a 3px tick in the gutter, taller for a weightier event, coloured by the chosen key
    const tkH = (d) => 4 + d.e.significance * 1.4;
    g.select('rect.tk').attr('x', (d) => d.e._cx - 1.5).attr('y', (d) => d.e._cy - tkH(d) / 2).attr('width', 3).attr('height', tkH)
      .attr('fill', (d) => dotColor(d.e)).attr('stroke', 'none');
    g.select('line').attr('x1', (d) => d.e._cx + 3).attr('x2', (d) => (d.e._ly == null ? d.e._cx + 3 : d.labelX - 2))
      .attr('y1', (d) => d.e._cy).attr('y2', (d) => (d.e._ly == null ? d.e._cy : d.e._ly)).attr('stroke', 'rgba(28,26,23,.3)').attr('stroke-width', 0.6);
    g.select('text').attr('x', (d) => d.labelX).attr('y', (d) => d.e._ly ?? -999).attr('dy', '0.35em')
      .attr('font-family', 'Instrument Sans, serif').attr('font-size', (d) => (d.e.significance >= 4 ? 12 : 11))
      .attr('font-weight', (d) => (d.e.significance >= 5 ? 600 : 400))
      .attr('fill', (d) => (d.e.significance >= 3 ? '#121212' : '#48433b'))
      .each(function (d) {
        const t = d3.select(this);
        t.selectAll('tspan').remove();
        if (d.e._ly == null) { t.text(''); return; }
        const [a, b = ''] = d.e._lines || [d.e.title];
        t.text(null);
        const maxW = CW - (d.labelX - d.c.ci * CW) - 6;
        // the character estimate is checked against the rendered width: a line that runs over steps its type down a little, and if that is not enough the label gives way to the dot
        const fit = (ts) => { const n = ts.node(); if (n.getComputedTextLength() <= maxW) return true; const fs0 = parseFloat(t.attr('font-size')) || 11; for (let fs = fs0 - 0.5; fs >= fs0 - 1.5; fs -= 0.5) { t.attr('font-size', fs); if (n.getComputedTextLength() <= maxW) return true; } return false; };
        const ok1 = fit(t.append('tspan').text(a));
        const ok2 = b ? fit(t.append('tspan').attr('x', d.labelX).attr('dy', '1.1em').text(b)) : true;
        if (!ok1 || !ok2) { t.text(''); d.e._ly = null; d.e._lines = null; }
      });
    // the clickable area is the label's rendered box (plus the dot), so hover and click always agree
    g.select('rect.hit').attr('fill', 'transparent').each(function (d) {
      const r = d3.select(this);
      if (d.e._ly == null) { r.attr('width', 0).attr('height', 0); return; }
      const bb = this.parentNode.querySelector('text').getBBox();
      r.attr('x', bb.x - 2).attr('y', bb.y - 1).attr('width', bb.width + 4).attr('height', bb.height + 2);
    });
    g.on('mouseenter', (ev, d) => { tip.show(ev, eventTip(d.e)); showArcs(d.e.id, d.c.l.id); rowAt(d.e.t); })
      .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); showArcs(S.sel || null); })
      .on('click', (ev, d) => { tip.hide(); focusKey = d.key; if (cx.on) { cxPick(d.e.id); return; } if (picking) { pickEnd(d.e.id); return; } select(d.e.id); })
      .on('dblclick', (ev, d) => { ev.preventDefault(); zoomTo(Math.floor(d.e.year / 10) * 10, Math.floor(d.e.year / 10) * 10 + 9); });
    drawMini();
    relit();
    arrive();
    footer();
  }

  // ---- arrival: rows fade in by date as they scroll into view; a fold that was clicked unfolds from its own place ----
  let pending = [], unfold = null, scrollRaf = 0, cut = false;
  const cyOf = (n, d) => (d.e ? d.e._cy : d.top + d.h / 2);
  function arrive() {
    const fresh = [];
    gCols.selectAll('g.it.cw-in').each(function (d) { fresh.push({ node: this, cy: cyOf(this, d), t: d.e.t, lens: d.c.l.id }); });
    gCells.selectAll('g.cell.cw-in').each(function (d) { fresh.push({ node: this, cy: cyOf(this, d), t: d.dec, lens: d.c.l.id }); });
    const show = (p, delay) => { const n = p.node; n.style.transitionDelay = delay ? `${delay}ms` : ''; n.classList.add('cw-show'); setTimeout(() => { n.classList.remove('cw-in', 'cw-show'); n.style.transitionDelay = ''; }, delay + 420); };
    if (RM() || cut) { fresh.forEach((p) => { p.node.classList.remove('cw-in'); }); pending = []; unfold = null; return; }
    if (unfold && S.y0 === unfold.dec && S.y1 === unfold.dec + 9) {
      // the opened decade: its lens's rows travel from the fold's centre to their own years (the same marks, moved),
      // the other lenses arrive by date
      const mine = fresh.filter((p) => p.lens === unfold.lens).sort((a, b) => a.t - b.t);
      const step = Math.min(12, 360 / Math.max(1, mine.length));
      mine.forEach((p, i) => {
        p.node.classList.remove('cw-in');
        // from the fold's centre toward each row's year, the travel capped so labels do not pile up in flight
        d3.select(p.node).attr('transform', `translate(0,${Math.max(-160, Math.min(160, H / 2 - p.cy))})`).attr('opacity', 0)
          .transition().delay(i * step).duration(550).ease(d3.easeCubicOut).attr('transform', 'translate(0,0)').attr('opacity', 1)
          .on('end', function () { d3.select(this).attr('transform', null).attr('opacity', null); });
      });
      pending = fresh.filter((p) => p.lens !== unfold.lens);
      unfold = null;
    } else pending = fresh;
    pending.sort((a, b) => a.cy - b.cy);
    revealTick(show);
  }
  function revealTick(show) {
    if (!pending.length) return;
    show = show || ((p, delay) => { const n = p.node; n.style.transitionDelay = delay ? `${delay}ms` : ''; n.classList.add('cw-show'); setTimeout(() => { n.classList.remove('cw-in', 'cw-show'); n.style.transitionDelay = ''; }, delay + 420); });
    const top = el.scrollTop - body.offsetTop, bot = top + el.clientHeight;
    const now = [], rest = [];
    // half a screen of lookahead, so rows are in place before a steady scroll reaches them
    const ahead = el.clientHeight * 0.5;
    for (const p of pending) (p.cy < bot + ahead ? now : rest).push(p);
    pending = rest;
    if (!now.length) return;
    // rows already above the screen are simply there; rows on screen arrive by date, within 420ms
    const inside = now.filter((p) => p.cy >= top - 20 && p.cy <= bot + 20).sort((a, b) => a.t - b.t);
    now.forEach((p) => { if (p.cy < top - 20 || p.cy > bot + 20) show(p, 0); });
    const step = Math.min(14, 360 / Math.max(1, inside.length));
    inside.forEach((p, i) => show(p, Math.round(i * step)));
  }
  el.addEventListener('scroll', () => { if (scrollRaf) return; scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; revealTick(); if (miniUpd) miniUpd(); }); }, { passive: true });
  // a fold opens in place: its swatch widens to the column before the decade takes the whole clock
  function openFold(node, d) {
    if (S.y0 === d.dec && S.y1 === d.dec + 9) return; // already the whole clock; nothing to open
    unfold = { dec: d.dec, lens: d.c.l.id };
    if (RM()) { zoomTo(d.dec, d.dec + 9); return; }
    const sel = d3.select(node);
    sel.style('cursor', 'default').on('mouseenter', null);
    sel.selectAll('text').transition().duration(120).attr('opacity', 0);
    sel.select('rect.bg').transition().duration(260).ease(d3.easeCubicInOut)
      .attr('x', d.x0 + 0.5).attr('width', CW - 1).attr('fill', d3.color(lensCol(d.c.l)).copy({ opacity: 0.22 }))
      .on('end', () => zoomTo(d.dec, d.dec + 9));
    // the locator's box closes onto the decade at the same time, so the map and its locator agree at both ends
    if (miniScale) {
      mini.select('.vp').interrupt().transition().duration(260).ease(d3.easeCubicInOut).attr('y', miniScale(d.top)).attr('height', Math.max(6, miniScale(d.h)));
      mini.selectAll('.cw-loc-yr text').transition().duration(120).attr('opacity', 0);
    }
  }

  // ---- row alignment: a band across every column at the hovered year, with a readout in the rail ----
  function rowAt(t) {
    gRow.selectAll('*').remove();
    const ro = railSvg.select('.cw-readout');
    if (t == null) { ro.style('display', 'none'); railSvg.selectAll('text.yr').style('visibility', null); return; }
    const yr = Math.floor(t);
    const a = y(yr), b = y(yr + 1);
    // the readout covers the rail where it sits; the year labels under it step aside
    railSvg.selectAll('text.yr').style('visibility', (d) => (Math.abs(y(d) - y(t)) < (y.major(d) ? 18 : 13) ? 'hidden' : null));
    gRow.append('rect').attr('x', 0).attr('width', W).attr('y', Math.min(a, b)).attr('height', Math.max(2, Math.abs(b - a))).attr('fill', 'rgba(28,26,23,.07)');
    gRow.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'rgba(28,26,23,.5)').attr('stroke-dasharray', '2 3');
    ro.style('display', null).attr('transform', `translate(0,${y(t)})`).select('text').text(yr);
  }
  svg.on('mousemove', (ev) => { if (ev.target.closest && ev.target.closest('g.it')) return; const [, my] = d3.pointer(ev, svg.node()); rowAt(y.invert(my)); })
    .on('mouseleave', () => rowAt(null))
    .on('click.pin', (ev) => { if (!pinning) return; ev.stopPropagation(); const [, my] = d3.pointer(ev, svg.node()); setPin(Math.floor(y.invert(my))); }, true)
    .on('dblclick', (ev) => { if (ev.target.closest && ev.target.closest('g.it')) return; const [, my] = d3.pointer(ev, svg.node()); const yr = Math.floor(y.invert(my) / 10) * 10; zoomTo(yr, yr + 9); });

  // ---- threads: bezier links between the selected event and its neighbours, across columns ----
  function showArcs(id, fromLens) {
    gArcs.selectAll('*').remove();
    gCols.selectAll('g.it').attr('opacity', null);
    if (!id) return;
    const e = db.byId.get(id);
    if (!e) return;
    const lens = fromLens || (AL().find((l) => l.f(e)) || LENSES.find((l) => l.f(e)) || {}).id;
    const a = posById.get(id + '|' + lens) || posById.get(id);
    if (!a) return;
    const nb = new Set(neighbors(id));
    gCols.selectAll('g.it').attr('opacity', (d) => (d.e.id === id || nb.has(d.e.id) ? 1 : 0.28));
    const hopLabels = []; // placed hop labels, so two neighbours in the same rows do not print on top of each other
    for (const o of nb) {
      const b = posById.get(o);
      if (!b) continue;
      const dx = b[0] - a[0];
      const bend = Math.abs(dx) < 10 ? -60 : 0;
      const p = gArcs.append('path')
        .attr('d', `M${a[0]},${a[1]}C${a[0] + dx * 0.4 + bend},${a[1]} ${b[0] - dx * 0.4 + bend},${b[1]} ${b[0]},${b[1]}`)
        .attr('fill', 'none').attr('stroke', domainColor(db.byId.get(o).domain)).attr('stroke-width', 1.4).attr('opacity', 0.9);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().duration(400).attr('stroke-dashoffset', 0);
      // a pulse travels the thread once, from the selected event to its neighbour, so direction and distance are read
      const node = p.node();
      gArcs.append('circle').attr('class', 'cw-pulse').attr('r', 3.2).attr('fill', domainColor(db.byId.get(o).domain)).attr('transform', `translate(${a[0]},${a[1]})`)
        .transition().delay(RM() ? 0 : 60).duration(RM() ? 0 : Math.min(900, 420 + len * 0.4)).ease(d3.easeCubicInOut)
        .attrTween('transform', () => (k) => { const q = node.getPointAtLength(k * len); return `translate(${q.x},${q.y})`; })
        .on('end interrupt', function () { d3.select(this).remove(); });
      gArcs.append('circle').attr('cx', b[0]).attr('cy', b[1]).attr('r', 4).attr('fill', 'none').attr('stroke', '#121212');
      const oe = db.byId.get(o);
      // the year delta sits in the gutter left of the dot, clear of the item's title; the gutter belongs to the
      // hop numbers while a path is on, and in windows wider than three centuries the rows are too dense to label
      if (ends.length || S.y1 - S.y0 > 300) continue;
      if (hopLabels.some(([x, yy]) => Math.abs(x - b[0]) < 30 && Math.abs(yy - b[1]) < 11)) continue;
      hopLabels.push([b[0], b[1]]);
      gArcs.append('text').attr('x', b[0] - 8).attr('y', b[1] + 3).attr('text-anchor', 'end').attr('font-family', MONO).attr('font-size', 10.5).attr('fill', '#121212').attr('stroke', 'var(--paper)').attr('stroke-width', 3).attr('paint-order', 'stroke').text(`${oe.year > e.year ? '+' : ''}${oe.year - e.year}y`);
    }
    gArcs.append('circle').attr('cx', a[0]).attr('cy', a[1]).attr('r', 7).attr('fill', 'none').attr('stroke', '#121212').attr('stroke-width', 1.5);
  }

  // ---- locator: the whole window as per-lens density, a year gutter with every break of the clock marked,
  // and this screen as a crisp rectangle with its first and last year printed at its corners ----
  let miniScale = null, miniUpd = null;
  function drawMini() {
    if (mobile) return;
    const MW = MINI, MH = Math.max(200, el.clientHeight - head.offsetHeight - 24);
    const GUT = 40;
    mini.attr('width', MW).attr('height', MH).selectAll('*').remove();
    miniScale = d3.scaleLinear().domain([0, H]).range([0, MH]);
    const n = AL().length;
    const bins = Math.max(60, Math.floor(MH / 3)), bh = MH / bins, cw = (MW - GUT - 6) / n;
    mini.append('rect').attr('width', MW).attr('height', MH).attr('fill', 'var(--ground-2)');
    // density per lens, one hue each, a square-root ramp for magnitude
    const counts = cols.map((c) => { const a = new Array(bins).fill(0); c.list.forEach((e) => { const i = Math.min(bins - 1, Math.floor((e._cy / H) * bins)); a[i] += 0.6 + e.significance * 0.4; }); return a; });
    const max = d3.max(counts, (a) => d3.max(a)) || 1;
    counts.forEach((a, ci) => mini.append('g').selectAll('rect').data(a).join('rect').attr('x', GUT + ci * cw).attr('width', Math.max(1, cw - 1)).attr('y', (d, i) => i * bh).attr('height', Math.max(1, bh - 0.5)).attr('fill', AL()[ci].color).attr('opacity', (d) => (d ? 0.15 + 0.85 * Math.sqrt(d / max) : 0)));
    mini.append('line').attr('x1', GUT - 0.5).attr('x2', GUT - 0.5).attr('y1', 0).attr('y2', MH).attr('stroke', 'var(--rule-strong)');
    // the year gutter: ticks from the same clock, so the locator is a scaled copy of the rail
    const tks = y.ticks(Math.round(26 * H / MH));
    const my = (t) => miniScale(y(t));
    const gt = mini.append('g').attr('class', 'cw-loc-ticks');
    gt.selectAll('line').data(tks).join('line').attr('x1', GUT - 4).attr('x2', GUT).attr('y1', my).attr('y2', my).attr('stroke', (d) => (y.major(d) ? '#121212' : 'var(--rule-strong)'));
    gt.selectAll('text').data(tks.filter((d) => y.major(d) || tks.length < 9)).join('text').attr('x', GUT - 6).attr('y', my).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('font-family', MONO).attr('font-size', 10.5).attr('fill', (d) => (y.major(d) ? '#121212' : '#6e6e6a')).text((d) => d);
    if (scaleMode() === 'warp') {
      gt.selectAll('path').data(BREAKS.filter((k) => k > S.y0 && k < S.y1 + 1)).join('path').attr('class', 'cw-break')
        .attr('d', (k) => `M${2},${my(k) + 2.5}l3,-5M${5},${my(k) + 2.5}l3,-5`).append('title').text((k) => `The clock changes stride at ${k}`);
    }
    // this screen
    const vp = mini.append('rect').attr('class', 'vp').attr('x', 0.75).attr('width', MW - 1.5).attr('fill', 'none').attr('stroke', '#121212').attr('stroke-width', 1.5).style('cursor', 'grab');
    const lab = mini.append('g').attr('class', 'cw-loc-yr');
    const t0 = lab.append('text').attr('x', MW - 4).attr('text-anchor', 'end');
    const t1 = lab.append('text').attr('x', MW - 4).attr('text-anchor', 'end');
    const yrAt = (py) => Math.max(S.y0, Math.min(S.y1, Math.floor(y.invert(py))));
    miniUpd = () => {
      const vh = el.clientHeight - head.offsetHeight;
      const top = Math.max(0, el.scrollTop - body.offsetTop);
      const a = miniScale(top), h = Math.max(6, miniScale(Math.min(H - top, vh)));
      vp.attr('y', a).attr('height', h);
      // the screen's first and last year sit at the box's corners, inside when the box is tall enough
      const inside = h > 30;
      t0.attr('y', inside ? a + 10 : a - 3).text(yrAt(top));
      t1.attr('y', inside ? a + h - 4 : a + h + 9).text(yrAt(Math.min(H, top + vh)));
    };
    miniUpd();
    const go = (ev) => { const [, my2] = d3.pointer(ev, mini.node()); const vh = el.clientHeight - head.offsetHeight; el.scrollTop = body.offsetTop + miniScale.invert(my2) - vh / 2; };
    mini.on('click', go);
    mini.call(d3.drag().on('start drag', (ev) => { const vh = el.clientHeight - head.offsetHeight; el.scrollTop = body.offsetTop + miniScale.invert(ev.y) - vh / 2; }));
  }

  // ---- keyboard navigation ----
  function focusItem(key, opts = {}) {
    focusKey = key;
    gFocus.selectAll('*').remove();
    const d = items.find((i) => i.key === key);
    if (!d) return;
    gFocus.append('rect').attr('x', d.c.ci * CW + 1).attr('width', CW - 2).attr('y', d.e._cy - 9).attr('height', 18).attr('fill', 'none').attr('stroke', '#121212').attr('stroke-dasharray', '3 2');
    rowAt(d.e.t); showArcs(d.e.id, d.c.l.id);
    const node = svg.node().getBoundingClientRect();
    const fake = { clientX: node.left + d.e._cx + 12, clientY: node.top + d.e._cy };
    tip.show(fake, eventTip(d.e));
    if (!opts.noScroll) {
      const top = d.e._cy + body.offsetTop - el.clientHeight / 2;
      const left = Math.max(0, d.c.ci * CW - el.clientWidth / 3);
      el.scrollTo({ top, left, behavior: 'smooth' });
    }
  }
  el.addEventListener('keydown', (ev) => {
    if (cx.on && ev.key === 'Escape') { ev.preventDefault(); cxExit(); return; } // Escape leaves the mode wherever focus sits
    if (ev.target !== el && ev.target.closest('button,input,select')) return;
    if (cx.on && cxKey(ev, cx, { onPick: cxPick, onExit: cxExit, onFocus: cxFocus })) return;
    const k = ev.key;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', '+', '=', '-', '_', 'Home'].includes(k)) return;
    ev.preventDefault();
    const cur = items.find((i) => i.key === focusKey);
    if (k === 'Escape') { focusKey = null; gFocus.selectAll('*').remove(); tip.hide(); showArcs(S.sel || null); rowAt(null); return; }
    if (k === 'Home') { zoomTo(YEAR_MIN, YEAR_MAX); return; }
    if (k === '+' || k === '=' || k === '-' || k === '_') {
      const c = cur ? cur.e.year : (S.y0 + S.y1) / 2;
      const span = S.y1 - S.y0 + 1;
      const ns = k === '+' || k === '=' ? Math.max(5, Math.round(span / 2)) : Math.min(YEAR_MAX - YEAR_MIN + 1, span * 2);
      let a = Math.round(c - ns / 2); let b = a + ns - 1;
      if (a < YEAR_MIN) { a = YEAR_MIN; b = a + ns - 1; } if (b > YEAR_MAX) { b = YEAR_MAX; a = Math.max(YEAR_MIN, b - ns + 1); }
      zoomTo(a, b); return;
    }
    if (k === 'Enter') { if (cur) select(cur.e.id); return; }
    if (!cur) { const first = items.slice().sort((p, q) => p.e._cy - q.e._cy || p.c.ci - q.c.ci)[0]; if (first) focusItem(first.key); return; }
    const inCol = items.filter((i) => i.c.ci === cur.c.ci).sort((p, q) => p.e._cy - q.e._cy || p.e.id.localeCompare(q.e.id));
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      const idx = inCol.findIndex((i) => i.key === cur.key);
      const nx = inCol[idx + (k === 'ArrowDown' ? 1 : -1)];
      if (nx) focusItem(nx.key);
      return;
    }
    const tci = cur.c.ci + (k === 'ArrowRight' ? 1 : -1);
    if (tci < 0 || tci >= AL().length) return;
    const cand = items.filter((i) => i.c.ci === tci);
    if (!cand.length) return;
    const nearest = cand.reduce((b, i) => (Math.abs(i.e._cy - cur.e._cy) < Math.abs(b.e._cy - cur.e._cy) ? i : b));
    focusItem(nearest.key);
  });

  // ---- controls ----
  popover(el.querySelector('.cw-ctl .hp-popbtn'), el.querySelector('.cw-ctl .hp-pop'));
  el.querySelector('.cw-ctl').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || 'pop' in b.dataset) return;
    if (b.dataset.scale) set({ mode: modeWith(b.dataset.scale, cxWanted()) });
    else if ('cx' in b.dataset) { const on = !cxWanted(); if (on && S.sel) cx.sel = S.sel; set(on && S.sel ? { mode: modeWith(scaleMode(), true), sel: '' } : { mode: modeWith(scaleMode(), on) }); } // starting the mode with a record open picks it
    else if (b.dataset.col) { colour = b.dataset.col; layout(); drawItems(); showArcs(S.sel || null); }
    else if ('back' in b.dataset) zoomTo(YEAR_MIN, YEAR_MAX);
    else if ('pin' in b.dataset) { if (pinYear != null) { setPin(null); } else { pinning = !pinning; picking = false; syncModes(); } }
    else if ('path' in b.dataset) { if (pathIds || ends.length) { clearPath(); } else { picking = !picking; pinning = false; syncModes(); } }
  });
  // ---- Connections: pick a record, see where it appears across the tabs ----
  const cx = { on: false, sel: null, marks: [], focus: -1 };
  const cxHost = document.createElement('aside'); cxHost.className = 'cx-ix'; cxHost.hidden = true; el.appendChild(cxHost);
  const cxPos = (e) => { const p = posById.get(e.id); return p ? { x: p[0], y: p[1] } : null; };
  const cxSelPos = () => { const e = cx.sel && db.events.find((o) => o.id === cx.sel); return e ? cxPos(e) : null; };
  function cxSync() {
    const want = cxWanted() && el.clientWidth >= 760; // measured here: the first render has not laid out yet, and phones never run the mode
    if (want === cx.on) return;
    cx.on = want; if (!want) cx.sel = null; else { if (!cx.sel && S.sel) cx.sel = S.sel; cx.win0 = [S.y0, S.y1]; cx.brushed = false; } cx.marks = []; cx.focus = -1; cx.all = false; // the window on entry comes back on Exit
    cxHost.hidden = !want; el.classList.toggle('cx-on', want);
    const b = el.querySelector('.cw-cx'); if (b) b.setAttribute('aria-pressed', String(want));
  }
  function cxAfter() {
    if (!cx.on) { gCx.selectAll('*').remove(); gCols.selectAll('g.it').style('opacity', null); return; }
    // the view scrolls; the index stays put beside the columns
    const r = el.getBoundingClientRect(), ht = r.top + head.offsetHeight;
    cxHost.style.cssText = `position:fixed;right:${Math.round(innerWidth - r.right + MINI + 12)}px;top:${Math.round(ht + 8)}px;height:${Math.round(r.bottom - ht - 36)}px`;
    cxDraw();
  }
  const cxPool = () => db.events.filter((o) => passes(o));
  // a pick brushes the window to the span of the record and its linked records (Locator scrub: a cut, window and locator together)
  function cxPick(id) {
    cx.sel = id; cx.focus = -1; cx.all = false;
    const e = db.byId.get(id);
    if (e && !cxLinks(id, () => { if (cx.on && cx.sel === id) cxPick(id); }) && !db.links) { cxDraw(); return; } // the links are still arriving; the pick repeats when they land
    if (e) { const all = cxLinked(e, cxPool(), Infinity); const [y0, y1] = cxSpan(e, all); if (all.length && (y0 !== S.y0 || y1 !== S.y1)) { cx.brushed = true; set({ y0, y1 }); cxScroll(); return; } }
    cxDraw(); cxScroll();
  }
  function cxFocus(i) { cx.focus = i; cxGraph(gCx, cxSelPos(), cx.marks, { onPick: cxPick, focus: i, onFocus: cxFocus }); }
  function cxScroll() { const p = cxSelPos(); if (p) { const top = body.offsetTop + p.y - (el.clientHeight - head.offsetHeight) / 2; if (Math.abs(el.scrollTop - top) > el.clientHeight / 2) el.scrollTo({ top, behavior: 'auto' }); } }
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && cx.on && el.classList.contains('on') && !el.contains(ev.target)) { ev.preventDefault(); cxExit(); } }); // Escape leaves the mode from anywhere on the page
  function cxExit() { const back = cx.brushed && cx.win0 ? { y0: cx.win0[0], y1: cx.win0[1] } : {}; set({ mode: modeWith(scaleMode(), false), ...back }); } // the picks' brushing is undone with the mode
  function cxDraw() {
    const e = cx.sel ? db.events.find((o) => o.id === cx.sel) : null;
    if (e) cxLinks(e.id, () => { if (cx.on) cxDraw(); });
    const linked = e ? cxLinked(e, cxPool(), cx.all ? Infinity : 40) : []; // the whole record, so the count is true; marks only where the window holds the event
    const sel = e ? cxPos(e) : null;
    cx.marks = linked.map((l) => { const p = cxPos(l.e); return p ? { e: l.e, x: p.x, y: p.y } : null; }).filter(Boolean);
    const lit = new Set(e ? [e.id, ...cx.marks.map((m) => m.e.id)] : []);
    gCols.selectAll('g.it').style('opacity', (d) => (e ? (lit.has(d.e.id) ? null : 0.55) : null)); // titles stay at 3:1 or better
    cxGraph(gCx, sel, cx.marks, { onPick: cxPick, focus: cx.focus, onFocus: cxFocus });
    cxIndex(cxHost, { e, linked, all: cx.all, onPick: cxPick, onExit: cxExit, onAll: () => { cx.all = true; cxDraw(); } });
  }
  function syncModes() {
    el.classList.toggle('pinning', pinning); el.classList.toggle('picking', picking);
    const pb = el.querySelector('[data-pin]'), kb = el.querySelector('[data-path]');
    pb.setAttribute('aria-pressed', String(pinning || pinYear != null)); pb.textContent = pinYear != null ? `Unpin ${pinYear}` : 'Pin year';
    kb.setAttribute('aria-pressed', String(picking || !!pathIds)); kb.textContent = pathIds || ends.length ? 'Clear path' : picking ? 'Pick two' : 'Pick two';
  }

  // ---- pinned year: a reference line that stays while the window moves ----
  function setPin(yr) { pinYear = yr; pinning = false; syncModes(); drawPin(); }
  function drawPin() {
    gPin.selectAll('*').remove();
    railSvg.selectAll('.cw-pinlab').remove();
    railSvg.selectAll('text').attr('opacity', null);
    if (pinYear == null || pinYear < S.y0 || pinYear > S.y1) return;
    const py = y(pinYear + 0.5);
    // the rail's own tick at that year gives way to the pin's label
    railSvg.selectAll('text').filter(function () { return !this.closest('.cw-pin') && Math.abs(+this.textContent - pinYear) <= (S.y1 - S.y0 > 150 ? 4 : 1); }).attr('opacity', 0);
    gPin.append('line').attr('x1', 0).attr('x2', W).attr('y1', py).attr('y2', py);
    const lab = railSvg.append('g').attr('class', 'cw-pin cw-pinlab').attr('transform', `translate(${RAIL - 4},${py})`);
    lab.append('rect').attr('x', -46).attr('y', -9).attr('width', 46).attr('height', 18).attr('rx', 2);
    lab.append('text').attr('x', -23).attr('y', 3.5).attr('text-anchor', 'middle').text(pinYear);
  }

  // ---- shortest path: breadth first through `connects`, both directions, between two picked events ----
  function pickEnd(id) {
    ends = ends.includes(id) ? ends : [...ends, id].slice(-2);
    if (ends.length < 2) { drawPath(); syncModes(); return; }
    picking = false;
    pathIds = shortest(ends[0], ends[1]);
    syncModes(); drawPath(); pathPanel();
  }
  function clearPath() { ends = []; pathIds = null; picking = false; const old = el.querySelector('.cw-pathpanel'); if (old) old.remove(); syncModes(); drawPath(); gCols.selectAll('g.it').attr('opacity', null); }
  function shortest(a, b) {
    if (a === b) return [a];
    const prev = new Map([[a, null]]);
    const queue = [a];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of neighbors(cur)) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        if (n === b) { const out = [b]; let k = b; while ((k = prev.get(k)) != null) out.unshift(k); return out; }
        queue.push(n);
      }
    }
    return null;
  }
  function drawPath() {
    gPath.selectAll('*').remove();
    const ids = pathIds || ends;
    if (!ids.length) return;
    const pts = ids.map((id) => ({ id, p: posById.get(id) }));
    const on = new Set(ids);
    if (pathIds) gCols.selectAll('g.it').attr('opacity', (d) => (on.has(d.e.id) ? 1 : 0.22));
    for (let i = 0; pathIds && i < pts.length - 1; i++) {
      const a = pts[i].p, b = pts[i + 1].p;
      if (!a || !b) continue;
      const dx = b[0] - a[0], bend = Math.abs(dx) < 10 ? -60 : 0;
      const d = `M${a[0]},${a[1]}C${a[0] + dx * 0.4 + bend},${a[1]} ${b[0] - dx * 0.4 + bend},${b[1]} ${b[0]},${b[1]}`;
      gPath.append('path').attr('class', 'halo').attr('d', d);
      const p = gPath.append('path').attr('d', d);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().delay(i * 120).duration(360).attr('stroke-dashoffset', 0);
    }
    pts.forEach((x, i) => {
      if (!x.p) return;
      const g = gPath.append('g').attr('class', i === 0 || i === pts.length - 1 ? 'end' : 'hop').attr('transform', `translate(${x.p[0]},${x.p[1]})`);
      g.append('circle').attr('r', i === 0 || i === pts.length - 1 ? 6 : 4.5);
      g.append('text').attr('x', -10).attr('y', 3.5).attr('text-anchor', 'end').text(i + 1);
    });
  }
  function pathPanel() {
    const old = el.querySelector('.cw-pathpanel'); if (old) old.remove();
    const panel = document.createElement('aside');
    panel.className = 'hp-panel cw-pathpanel';
    const A = db.byId.get(ends[0]), B = db.byId.get(ends[1]);
    const hops = pathIds ? pathIds.length - 1 : null;
    panel.innerHTML = `<header><div><h4>${pathIds ? `${hops} hop${hops === 1 ? '' : 's'}` : 'No path'}</h4><div class="m">${esc(A.year)} to ${esc(B.year)} &middot; shortest route through the links</div></div><button type="button" class="hp-act" data-a="clear">Clear</button></header>` +
      (pathIds ? `<ol>${pathIds.map((id, i) => { const e = db.byId.get(id); return `<li><button type="button" data-id="${esc(id)}" style="--c:${domainColor(e.domain)}"><i></i><span class="y">${e.year}</span><span><span class="hop">${i + 1}.</span> ${esc(e.title)}</span></button></li>`; }).join('')}</ol>` : `<p class="none">No chain of links in the record joins these two.</p>`);
    panel.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.a === 'clear') clearPath(); else if (b.dataset.id) select(b.dataset.id); });
    panel.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-id]'); if (b) { const p = posById.get(b.dataset.id); if (p) el.scrollTo({ top: p[1] + body.offsetTop - el.clientHeight / 2, behavior: 'smooth' }); } });
    el.appendChild(panel);
  }

  function render(state, ch) {
    cxSync();
    const full = ch.has('*') || ch.has('y0') || ch.has('y1') || ch.has('mode');
    if (full) { layout(); drawFrame(); loc.layout(locatorWidth(el.clientWidth, mobile, locHost.clientWidth || el.clientWidth - 20)).update(S.y0, S.y1); }
    // a brushed window is a cut: rows land at once, window and locator together; the first view and an opened fold keep their arrival
    cut = !ch.has('*') && (ch.has('y0') || ch.has('y1')) && !unfold;
    if (full || ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q')) { drawItems(); drawPin(); drawPath(); }
    cut = false;
    cxAfter();
    if (S.sel && mobile && (ch.has('sel') || ch.has('*'))) cxFold(S.sel); // on phones the drawer is the index
    // the scroll position settles after the new height is laid out; the locator's box follows it
    if (full) requestAnimationFrame(() => { if (miniUpd) miniUpd(); });
    if (full || ch.has('sel')) {
      showArcs(S.sel || null);
      const p = S.sel && posById.get(S.sel);
      if (p && (ch.has('sel') || ch.has('*'))) {
        const top = p[1] + body.offsetTop - el.clientHeight / 2;
        el.scrollTo({ top, left: Math.max(0, p[0] - el.clientWidth / 3), behavior: ch.has('*') ? 'auto' : 'smooth' });
      }
    }
    if (full && focusKey && items.some((i) => i.key === focusKey)) focusItem(focusKey, { noScroll: true });
  }
  return { render, resize() { render(S, new Set(['*'])); }, hover(id) { showArcs(id || S.sel || null); }, lit(l) { LIT = l; relit(); } };
}
