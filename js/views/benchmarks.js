// L. BENCHMARKS: state of the art over time for each benchmark, as a share of its maximum score,
// with human baselines and saturation dates, and a summary of how long each took to saturate.
import { state as S, set } from '../store.js';
import { esc, roving } from '../ui.js';
import { host, seriesById, seriesLines } from '../data.js';
import { domainColor } from '../palette.js';
import { NOW_T, BCAT, bshort, bcolor, pct, fmtYM, yrs, DGROUPS, MAKERS, makerOf, makerInfo, firstSentence } from '../aidepth.js';
import { computeFrontier } from './genealogy.js';

// motion: entries run by date (a clip wipe left to right), 600 to 900 ms, eased out; nothing moves under reduced motion
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const INK = 'var(--ink)', INK_2 = 'var(--ink-3)';
const EASE = (t) => d3.easeCubicOut(t);  // called, not read, at the top level: d3 loads on demand (ai_now imports this module without it)
// the moment (0 to 1) at which an eased-out wipe reaches fraction f of its width
const tAt = (f) => 1 - Math.cbrt(Math.max(0, 1 - Math.max(0, Math.min(1, f))));
// a once-only ring around a saturation mark, timed to when the wipe reaches it
const pulse = (g, cx, cy, c, delay) => g.append('circle').attr('class', 'bm-pulse').attr('cx', cx).attr('cy', cy).attr('r', 6).attr('fill', 'none').attr('stroke', c).attr('pointer-events', 'none').style('animation-delay', `${Math.round(delay)}ms`);

const MODES = [['overlay', 'Overlay'], ['aligned', 'From launch'], ['pair', 'Two together']];
// lab families for the point filter; everything else is "other labs"
const LABS = [['openai', 'OpenAI', /openai/i], ['google', 'Google', /google|deepmind/i], ['anthropic', 'Anthropic', /anthropic/i], ['meta', 'Meta', /meta|facebook/i], ['microsoft', 'Microsoft', /microsoft/i], ['other', 'Other labs', null]];
const labOf = (org) => (LABS.find(([, , re]) => re && re.test(org || '')) || LABS[LABS.length - 1])[0];

// two counts for the Now bar and the canvas head, kept apart because they measure different things:
//   crossed: benchmarks whose record is at or past a published human baseline, out of those that publish one
//   saturated: benchmarks the record's rule marks (saturated_date), out of all of them; the rule is one line
// n and total carry the crossing figure with its denominator for readers that take one pair
export const SATURATION_RULE = 'a record at or past its human baseline, or, with no baseline, a record that stopped moving within six points of the ceiling';
export function humanLineCount(db) {
  const B = (db.benchmarks && (Array.isArray(db.benchmarks) ? db.benchmarks : db.benchmarks.benchmarks)) || [];
  const withHuman = B.filter((b) => b.human_baseline && b.human_baseline.value != null);
  const crossedList = withHuman.filter((b) => { const hv = pct(b, b.human_baseline.value); return (b.points || []).some((q) => pct(b, q.value) >= hv); });
  const saturatedList = B.filter((b) => b.saturated_date);
  return { crossed: crossedList.length, withHuman: withHuman.length, saturated: saturatedList.length, total: B.length, rule: SATURATION_RULE, n: crossedList.length, denominator: withHuman.length, crossedIds: crossedList.map((b) => b.id), saturatedIds: saturatedList.map((b) => b.id) };
}

export default function benchmarks(el, { db, select, tip }) {
  roving(el);  // one Tab stop per chart; arrows move between its marks
  el.classList.add('scroll-y');
  const all = db.benchmarks || [];
  let hiId = null;
  const ctx = document.createElement('canvas').getContext('2d');
  const fit = (t, w, font) => { ctx.font = font; if (ctx.measureText(t).width <= w) return t; let x = t; while (x.length > 3 && ctx.measureText(x + '\u2026').width > w) x = x.slice(0, -1); return x.trimEnd() + '\u2026'; };
  const sat = all.filter((b) => b.ts);
  const med = (a) => d3.median(a) || 0;
  const P = [['before 2020', (b) => b.t0 < 2020], ['2020 to 2022', (b) => b.t0 >= 2020 && b.t0 < 2023], ['2023 or later', (b) => b.t0 >= 2023]].map(([l, f]) => ({ l, v: sat.filter(f) }));
  const openN = all.filter((b) => !b.ts).length;
  // reader controls: human line on or off, lab families switched off, the two benchmarks of the pair view
  let humanOn = true;
  const labOff = new Set();
  const byId = (id) => all.find((b) => b.id === id || b.key === id);
  let pairA = (byId('mmlu') || all[0]).id, pairB = (byId('gpqa-diamond') || all[1] || all[0]).id;
  const labPass = (p) => !labOff.size || !labOff.has(labOf(p.org));
  const opt = (sel) => all.map((b) => `<option value="${esc(b.id)}" ${b.id === sel ? 'selected' : ''}>${esc(bshort(b))}</option>`).join('');
  // the next draw animates (first paint, mode change); brushing and resizing redraw in place
  let animNext = true;
  // entrance transitions wait until the chart is in view, then run once
  const q = []; let io = null;
  const go = (fn) => q.push(fn);
  const flush = () => { const fns = q.splice(0); fns.forEach((f) => f()); if (io) { io.disconnect(); io = null; } };
  function arm() {
    if (io) { io.disconnect(); io = null; }
    if (!q.length) return;
    // behind the arrival overlay nothing is seen, so the entrance waits for it to close
    if (document.body.classList.contains('intro-open')) { addEventListener('histomap:intro-closed', arm, { once: true }); return; }
    const stages = [el.querySelector('.bm-multiples'), el.querySelector('.bm-main')].filter(Boolean);
    if (stages.some((n) => { const r = n.getBoundingClientRect(); return r.top < innerHeight * 0.75 && r.bottom > innerHeight * 0.25; })) { flush(); return; }
    // the charts can be taller than the screen, so "in view" means any part of one crossing the middle half of the viewport
    io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) flush(); }, { rootMargin: '-25% 0px -25% 0px', threshold: 0 });
    stages.forEach((n) => io.observe(n));
  }
  const rankT0 = new Map(all.slice().sort((p, q) => p.t0 - q.t0).map((b, i) => [b.id, i]));

  el.innerHTML = `
    <div class="bm-wrap bm-screen">
      <header class="bm-lead">
        <span class="sc">AI · Models · Benchmarks</span>
        <h2 class="bm-head" id="bm-head"></h2>
        <p class="bm-dek"></p>
        <p class="bm-srcline"></p>
      </header>
      <div class="bm-chart bm-multiples" role="group" aria-labelledby="bm-head" data-chart="small multiples, one per benchmark"></div>
      <details class="bm-more">
        <summary><span class="sc">Evidence</span> the saturation rule, the specimen stage, the critique</summary>
        <div class="bm-more-in" hidden>
          <p class="bm-rule"></p>
    <header class="bm-top">
        <div class="pl-intro"><span class="sc">The specimen stage</span><h2>Benchmark by benchmark</h2>
          <p>${all.length} AI benchmarks and the record score on each over time, drawn as a share of the best possible score (error rates read as 100 minus error). A benchmark counts as saturated on the date research notes mark: when its record reached the human baseline or stopped moving near the ceiling.</p></div>
        <div class="bm-find">
          <h3 class="sc">Median time to saturation, by year introduced</h3>
          <div class="bm-stats">${P.map((p) => `<p class="bm-stat"><b>${yrs(med(p.v.map((b) => b.ts - b.t0)))}</b><span>${p.l}, ${p.v.length} saturated</span></p>`).join('')}</div>
          <p class="bm-fn">${openN} benchmarks are still open and not counted; most were released in 2024 or later.</p>
        </div>
      </header>
      <div class="pl-sticky bm-sticky">
        <div class="pl-ctl">
          <div class="pl-grp"><span class="sc">Show</span><div class="toggle" role="group" aria-label="Chart layout">${MODES.map(([v, l]) => `<button type="button" data-m="${v}">${l}</button>`).join('')}</div></div>
          <div class="pl-grp bm-pair" hidden><span class="sc">Pair</span><select data-pa aria-label="First benchmark">${opt(pairA)}</select><span class="sc">with</span><select data-pb aria-label="Second benchmark">${opt(pairB)}</select></div>
          <div class="pl-grp"><span class="sc">Labs</span><div class="bm-labs" role="group" aria-label="Lab families">${LABS.map(([id, l]) => `<button type="button" class="chip" data-lab="${id}" aria-pressed="true">${l}</button>`).join('')}</div></div>
          <div class="pl-grp bm-wing"><span class="sc">Years</span><svg class="bm-win" width="220" height="30" aria-label="Drag to set years shown"></svg></div>
          <div class="pl-key" aria-label="How to read these charts">
            <span><svg width="30" height="12" aria-hidden="true"><path d="M2 10H10V6H18V2H28" fill="none" stroke="var(--ink)" stroke-width="1.8"/></svg>record score</span>
            <button type="button" class="bm-human" data-human aria-pressed="true"><svg width="26" height="12" aria-hidden="true"><line x1="1" y1="6" x2="25" y2="6" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2"/></svg>human line</button>
            <span><svg width="14" height="12" aria-hidden="true"><path d="M7 1.5 12 6 7 10.5 2 6Z" fill="var(--ground)" stroke="var(--ink)" stroke-width="1.5"/></svg>saturated</span>
            ${Object.entries(BCAT).filter(([k]) => all.some((b) => b.domain === k)).map(([, c]) => `<span><i class="bm-sw" style="background:${c.color}"></i>${c.label}</span>`).join('')}
          </div>
          <span class="pl-count count"></span>
        </div>
      </div>
      <p class="bm-pair-read" hidden></p>
      <div class="bm-main">
        <div class="bm-chart2"></div>
        <section class="bm-sum" aria-labelledby="bm-sum-h">
          <h3 class="sc" id="bm-sum-h">Introduced to saturated <span class="bm-cap" aria-hidden="true"></span></h3>
          <p class="bm-sum-big"><b class="bm-big" aria-live="off"></b><span class="bm-big-l"></span></p>
          <p class="bm-sum-p">Each bar runs from a benchmark's release to its saturation date. Open bars are still unsaturated in October 2026. Newer benchmarks saturate in a fraction of the time older ones took.</p>
          <div class="bm-sum-svg"></div>
          <p class="bm-finding" aria-live="polite"></p>
        </section>
      </div>
          <section class="bm-crit" aria-labelledby="bc-h">
            <div class="bc-head"><h3 id="bc-h">What a score does not tell you</h3><p class="bc-dek"></p></div>
            <ol class="bc-list"></ol>
          </section>
        </div>
      </details>
    </div>`;
  // the comparison strips rendered by today.js sit under the graph, so the section reads graph, strips, critique, stage
  const seat = el.querySelector('.bm-vs-seat'), slot = el.parentElement && el.parentElement.querySelector(':scope > .td-vs-slot');
  if (seat && slot) seat.appendChild(slot); else if (seat) seat.remove();
  const panelsEl = el.querySelector('.bm-chart'), chart = el.querySelector('.bm-chart2'), sumEl = el.querySelector('.bm-sum-svg'), countEl = el.querySelector('.pl-count'), pairRead = el.querySelector('.bm-pair-read'), pairCtl = el.querySelector('.bm-pair');
  const bigEl = el.querySelector('.bm-big'), bigL = el.querySelector('.bm-big-l'), findEl = el.querySelector(".bm-finding"), capEl = el.querySelector('.bm-cap');
  const mode = () => (MODES.some(([m]) => m && m === S.mode) ? S.mode : 'overlay');

  const list = () => {
    const terms = (S.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((b) => terms.every((t) => b._txt.includes(t)));
  };
  // brushed window, clamped to the benchmark era
  const win = () => { const a = Math.max(2010, Math.min(S.y0, 2024)); const b = Math.max(a + 2, Math.min(NOW_T, S.y1 + 1)); return [a, Math.min(b, NOW_T + 0.2)]; };
  const inWin = (b) => { const [a, z] = win(); return (b.ts || NOW_T) >= a && b.t0 <= z; };

  function tipPoint(b, p) {
    return `<div class="k"><i style="background:${bcolor(b)}"></i>${esc(bshort(b))} &middot; ${esc(fmtYM(p.date))}</div><div class="h">${esc(p.model)}</div><div class="m">${esc(p.org)} &middot; ${+p.value.toFixed(2)}${b.higher_is_better ? '' : ' error'} (${Math.round(pct(b, p.value))}% of max) &middot; click to open</div>`;
  }
  function tipBench(b) {
    const d = b.ts ? `saturated ${fmtYM(b.saturated_date)}, after ${yrs(b.ts - b.t0)}` : `unsaturated after ${yrs(NOW_T - b.t0)}`;
    return `<div class="k"><i style="background:${bcolor(b)}"></i>${esc((BCAT[b.domain] || {}).label || b.domain)} &middot; introduced ${esc(fmtYM(b.introduced))}</div><div class="h">${esc(b.name)}</div><div class="m">${esc(d)} &middot; click to open</div>`;
  }
  const bindPoint = (sel) => sel.attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${bshort(d.b)}, ${fmtYM(d.p.date)}: ${d.p.model}, ${d.p.org}, ${d.p.value}`)
    .on('mouseenter', (ev, d) => { tip.show(ev, tipPoint(d.b, d.p)); mark(d.b.id); })
    .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); })
    .on('click', (ev, d) => { ev.stopPropagation(); select(d.p.id); })
    .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(d.p.id); } });

  // step path for one benchmark in the given scales; holds the record to now
  function steps(b, x, y, tx = (t) => t) {
    const pts = b.points.map((p) => [x(tx(p.t, b)), y(pct(b, p.value))]);
    let d = '';
    pts.forEach(([px, py], i) => { d += i ? `H${px}V${py}` : `M${px},${py}`; });
    return { d, tail: pts.length ? [pts[pts.length - 1], [x(tx(NOW_T, b)), pts[pts.length - 1][1]]] : null };
  }

  // the one red mark on the screen: the selected benchmark, else the most recently saturated
  const redId = (bl) => (S.sel && bl.some((b) => b.id === S.sel) ? S.sel : (lastSat(bl) || bl[0] || {}).id);
  function drawPanels(bl, anim) {
    const W = panelsEl.clientWidth;
    // task groups as rows: reasoning, agents, knowledge, then vision and code; columns sized to the widest group
    const groups = DGROUPS.map(([id, label, ds]) => ({ id, label, list: bl.filter((b) => ds.includes(b.domain)) })).filter((g) => g.list.length).sort((p, q) => q.list.length - p.list.length);
    const widest = Math.max(1, ...groups.map((g) => g.list.length));
    const cols = W >= 1100 ? Math.min(widest, 7) : W >= 700 ? Math.min(widest, 4) : 3;
    const LW = W >= 700 ? 92 : 0;
    // small groups share a row, first fit by size: a group whose label and cards fit beside an earlier row's cards joins it
    const rows = [];
    groups.forEach((g) => { const need = g.list.length + (LW ? 1 : 0); const r = LW ? rows.find((x) => x.used + need <= cols + 1) : null; if (r) { g.inline = true; r.used += need; r.gs.push(g); } else { g.inline = false; rows.push({ used: need, gs: [g] }); } });
    const ordered = rows.flatMap((r) => r.gs);
    groups.length = 0; groups.push(...ordered);
    panelsEl.innerHTML = `<div class="bm-grid bm-grouped" style="grid-template-columns:${LW ? `${LW}px ` : ''}repeat(${cols},minmax(0,1fr))"></div>`;
    const grid = panelsEl.firstChild;
    const pw = Math.floor((W - LW - cols * 14) / cols);
    const red = redId(bl);
    let gi = 0;
    const host = (b) => { const g = groups.find((x) => x.list.includes(b)); if (g && g.list[0] === b) { const lab = document.createElement('div'); lab.className = 'bm-grp' + (gi++ ? '' : ' first') + (g.inline ? ' inline' : ''); lab.dataset.task = g.id; lab.innerHTML = `<span class="sc">${esc(g.label)}</span><b>${g.list.length}</b>`; if (!LW) lab.style.gridColumn = '1 / -1'; grid.appendChild(lab); } return grid; };
    bl = groups.flatMap((g) => g.list);
    const [a, z] = win();
    const PH = W >= 700 ? 96 : 84, M = { l: W >= 700 ? 26 : 22, r: 8, t: 8, b: 18 };
    const x = d3.scaleLinear().domain([a, z]).range([M.l, pw - M.r]);
    const y = d3.scaleLinear().domain([0, 100]).range([PH - M.b, M.t]);
    const span = z - a, step = span > 12 ? 4 : span > 6 ? 2 : 1;
    const ticks = d3.range(Math.ceil(a / step) * step, z, step).filter((t) => x(t) > M.l + 10 && x(t) < pw - M.r - 12).reduce((acc, t) => { if (!acc.length || x(t) - x(acc[acc.length - 1]) >= 30) acc.push(t); return acc; }, []);
    for (const b of bl) {
      // records are one ink; the domain hue is a 2px tag beside the name, and the accent belongs to the hovered or selected line
      const hue = bcolor(b), c = INK, on = inWin(b);
      const card = document.createElement('article');
      card.className = 'bm-card' + (on ? '' : ' off') + (b.id === red ? ' red' : '');
      card.dataset.id = b.id;
      card.dataset.task = (groups.find((g) => g.list.includes(b)) || {}).id || '';
      // the state in the card's corner: a filled diamond and the date once saturated (the diamond is the mark on the chart), else open
      const st = b.ts ? `<span class="bm-tag sat" aria-label="saturated ${esc(fmtYM(b.saturated_date))}"><span aria-hidden="true">&#9670;</span> ${esc(fmtYM(b.saturated_date))}</span>` : `<span class="bm-tag">open</span>`;
      card.innerHTML = `<button type="button" class="bm-h" data-b="${esc(b.id)}" style="--c:${hue}"><i></i><span class="t">${esc(bshort(b))}</span>${st}</button><div class="bm-sub">${esc((BCAT[b.domain] || {}).label || '')} &middot; since ${esc(fmtYM(b.introduced))} &middot; ${esc(b.metric.replace(/\s*\(%\)/, ''))}</div>`;
      host(b).appendChild(card);
      const svg = d3.select(card).append('svg').attr('width', pw).attr('height', PH).attr('viewBox', `0 0 ${pw} ${PH}`).attr('role', 'group').attr('aria-label', `${b.name}: ${b.points.length} record results`);
      // before introduction, shaded
      if (b.t0 > a) svg.append('rect').attr('x', M.l).attr('y', M.t).attr('width', Math.max(0, Math.min(x(b.t0), pw - M.r) - M.l)).attr('height', PH - M.t - M.b).attr('fill', 'var(--ground-2)');
      [0, 50, 100].forEach((v) => {
        svg.append('line').attr('x1', M.l).attr('x2', pw - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 0 ? 'var(--rule-strong)' : 'var(--rule)');
        svg.append('text').attr('class', 'bm-tk').attr('x', M.l - 4).attr('y', y(v) + 3).attr('text-anchor', 'end').text(v);
      });
      ticks.forEach((t) => { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', PH - M.b).attr('y2', PH - M.b + 3).attr('stroke', 'var(--rule-strong)'); svg.append('text').attr('class', 'bm-tk').attr('x', x(t)).attr('y', PH - 4).attr('text-anchor', 'middle').text(t); });
      const clip = 'bmc-' + b.key;
      const cw = pw - M.l - M.r, delay = anim ? Math.min(400, (rankT0.get(b.id) || 0) * 25) : 0, D = 650;
      const cr = svg.append('clipPath').attr('id', clip).append('rect').attr('x', M.l).attr('y', 0).attr('width', anim ? 0 : cw).attr('height', PH);
      if (anim) go(() => cr.transition().delay(delay).duration(D).ease(EASE).attr('width', cw));
      const g = svg.append('g').attr('clip-path', `url(#${clip})`);
      const hb = b.human_baseline && pct(b, b.human_baseline.value);
      if (humanOn && hb != null && !isNaN(hb)) {
        g.append('line').attr('x1', M.l).attr('x2', pw - M.r).attr('y1', y(hb)).attr('y2', y(hb)).attr('stroke', 'var(--ink-2)').attr('stroke-width', 1).attr('stroke-dasharray', '3 2');
      }
      const s = steps(b, x, y);
      g.append('path').attr('class', 'ln').attr('d', s.d).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2);
      if (s.tail) g.append('line').attr('class', 'tail').attr('x1', s.tail[0][0]).attr('y1', s.tail[0][1]).attr('x2', s.tail[1][0]).attr('y2', s.tail[1][1]).attr('stroke', c).attr('stroke-width', 1.4).attr('stroke-dasharray', '2 2').attr('opacity', 0.7);
      if (b.ts) {
        const xs = x(b.ts);
        if (xs >= M.l && xs <= pw - M.r) {
          g.append('line').attr('x1', xs).attr('x2', xs).attr('y1', M.t).attr('y2', PH - M.b).attr('stroke', 'var(--ink)').attr('stroke-opacity', 0.35);
          const sp = [...b.points].reverse().find((p) => p.t <= b.ts + 0.01) || b.points[b.points.length - 1];
          const sy = y(pct(b, sp.value));
          g.append('path').attr('d', `M${xs},${sy - 5}L${xs + 5},${sy}L${xs},${sy + 5}L${xs - 5},${sy}Z`).attr('fill', 'var(--ground)').attr('stroke', 'var(--ink)').attr('stroke-width', 1.5).attr('pointer-events', 'none');
          if (anim) go(() => pulse(svg, xs, sy, 'var(--ink)', delay + D * tAt((xs - M.l) / cw)));
        }
      }
      if (humanOn && hb != null && !isNaN(hb)) svg.append('text').attr('class', 'bm-hl').attr('x', pw - M.r - 2).attr('y', hb > 85 ? y(hb) + 11 : y(hb) - 3).attr('text-anchor', 'end').text(`human ${Math.round(hb)}`);
      const data = b.points.map((p) => ({ b, p }));
      bindPoint(g.selectAll('circle').data(data).join('circle').attr('class', (d) => 'bm-pt' + (labPass(d.p) ? '' : ' dim')).attr('data-id', (d) => d.p.id)
        .attr('cx', (d) => x(d.p.t)).attr('cy', (d) => y(pct(b, d.p.value))).attr('r', 3.6).attr('fill', c).attr('stroke', 'var(--ground)').attr('stroke-width', 1.2));
    }
  }

  function drawOverlay(bl, aligned, pair, anim) {
    const W = chart.clientWidth, mobile = W < 640;
    const H = mobile ? 360 : Math.max(380, Math.min(540, el.clientHeight - 250));
    // every line ends in a label; the gutter narrows on phones rather than dropping the labels
    const LG = mobile ? 72 : 132;
    const M = { l: 32, r: 12 + LG, t: 14, b: 30 };
    const [a, z] = win();
    const x = aligned ? d3.scaleLinear().domain([0, Math.ceil(d3.max(bl, (b) => NOW_T - b.t0) || 10)]).range([M.l, W - M.r]) : d3.scaleLinear().domain([a, z]).range([M.l, W - M.r]);
    const tx = aligned ? (t, b) => t - b.t0 : (t) => t;
    const y = d3.scaleLinear().domain([0, 100]).range([H - M.b, M.t]);
    chart.innerHTML = '';
    const svg = d3.select(chart).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', `Record scores for ${bl.length} benchmarks, ${aligned ? 'by years since launch' : 'by date'}`);
    const gx = svg.append('g');
    d3.range(0, 101, 25).forEach((v) => { gx.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v ? 'var(--rule)' : 'var(--rule-strong)'); gx.append('text').attr('class', 'bm-tk').attr('x', M.l - 5).attr('y', y(v) + 3).attr('text-anchor', 'end').text(v + (v === 100 ? '%' : '')); });
    const xt = x.ticks(Math.max(3, Math.floor((W - M.l - M.r) / 70)));
    const hls = [];  // human baseline labels, spaced below so two close baselines never share a line
    xt.forEach((t) => { gx.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', H - M.b).attr('y2', H - M.b + 4).attr('stroke', 'var(--rule-strong)'); gx.append('text').attr('class', 'bm-tk').attr('x', x(t)).attr('y', H - M.b + 15).attr('text-anchor', 'middle').text(aligned ? (t ? `+${t} yr` : 'launch') : t); });
    if (aligned) gx.append('text').attr('class', 'bm-tk').attr('x', W - M.r).attr('y', H - 2).attr('text-anchor', 'end').text('years since the benchmark was released');
    // the wipe runs left to right, so every line enters in date order (or, from launch, in order of elapsed time)
    const cx0 = M.l - 6, cw = W - M.l - M.r + 12, D = 900;
    const cr = svg.append('clipPath').attr('id', 'bmo-clip').append('rect').attr('x', cx0).attr('y', 0).attr('width', anim ? 0 : cw).attr('height', H);
    if (anim) go(() => cr.transition().duration(D).ease(EASE).attr('width', cw));
    const g = svg.append('g').attr('clip-path', 'url(#bmo-clip)');
    const ends = [];
    for (const b of bl) {
      // one ink for every record; in Two together the second line is the lighter ink so the pair stays legible without hue
      const hue = bcolor(b), c = pair && bl.indexOf(b) === 1 ? INK_2 : INK, on = aligned || inWin(b);
      const gg = g.append('g').attr('class', 'bm-line' + (on ? '' : ' off')).attr('data-id', b.id);
      const s = steps(b, x, y, tx);
      const hb = b.human_baseline && pct(b, b.human_baseline.value);
      if (pair && humanOn && hb != null && !isNaN(hb)) {
        gg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(hb)).attr('y2', y(hb)).attr('stroke', c).attr('stroke-width', 1).attr('stroke-dasharray', '3 2').attr('opacity', 0.8).attr('pointer-events', 'none');
        hls.push({ el: gg.append('text').attr('class', 'bm-hl').attr('x', M.l + 4).attr('y', y(hb) - 3).attr('fill', c).text(`human ${Math.round(hb)}, ${bshort(b)}`), y: y(hb) - 3 });
      }
      gg.append('path').attr('class', 'hit').attr('d', s.d).attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 10)
        .on('mouseenter', (ev) => { tip.show(ev, tipBench(b)); mark(b.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); }).on('click', () => select(b.id));
      gg.append('path').attr('class', 'ln').attr('d', s.d).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2).attr('pointer-events', 'none');
      if (s.tail) gg.append('line').attr('class', 'tail').attr('x1', s.tail[0][0]).attr('y1', s.tail[0][1]).attr('x2', s.tail[1][0]).attr('y2', s.tail[1][1]).attr('stroke', c).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 2').attr('opacity', 0.7).attr('pointer-events', 'none');
      if (b.ts) {
        const sp = [...b.points].reverse().find((p) => p.t <= b.ts + 0.01) || b.points[b.points.length - 1];
        const xs = x(tx(b.ts, b)), sy = y(pct(b, sp.value));
        gg.append('path').attr('d', `M${xs},${sy - 5}L${xs + 5},${sy}L${xs},${sy + 5}L${xs - 5},${sy}Z`).attr('fill', 'var(--ground)').attr('stroke', c).attr('stroke-width', 1.6).attr('pointer-events', 'none');
        if (anim && on) go(() => pulse(svg, xs, sy, c, D * tAt((xs - cx0) / cw)));
      }
      bindPoint(gg.selectAll('circle').data(b.points.map((p) => ({ b, p }))).join('circle').attr('class', (d) => 'bm-pt' + (labPass(d.p) ? '' : ' dim')).attr('data-id', (d) => d.p.id)
        .attr('cx', (d) => x(tx(d.p.t, b))).attr('cy', (d) => y(pct(b, d.p.value))).attr('r', pair ? 4 : 3).attr('fill', c).attr('stroke', 'var(--ground)').attr('stroke-width', 1));
      const last = b.points[b.points.length - 1];
      if (on) ends.push({ b, y: y(pct(b, last.value)), c });
    }
    // two human baselines within a line height of each other: the lower label drops under its line
    hls.sort((p, q) => p.y - q.y);
    for (let i = 1; i < hls.length; i++) if (hls[i].y - hls[i - 1].y < 13) { hls[i].y = Math.max(hls[i].y + 14, hls[i - 1].y + 13); hls[i].el.attr('y', hls[i].y); }
    // end labels in a right gutter, dodged so they never overlap; they land as the wipe reaches the right edge
    ends.sort((p, q) => p.y - q.y);
    const gap = mobile ? 11 : 12.5, top = M.t + 4, bot = H - M.b;
    ends.forEach((e, i) => { e.ly = Math.max(e.y, i ? ends[i - 1].ly + gap : top); });
    for (let i = ends.length - 1; i >= 0; i--) { const lim = i === ends.length - 1 ? bot : ends[i + 1].ly - gap; if (ends[i].ly > lim) ends[i].ly = lim; }
    const lx = W - M.r + 6;
    const lg = svg.append('g').attr('class', 'bm-ends' + (mobile ? ' sm' : ''));
    if (anim) { lg.style('opacity', 0); go(() => lg.transition().delay(D - 250).duration(300).style('opacity', 1)); }
    ends.forEach((e) => {
      const gg = lg.append('g').attr('class', 'bm-end').attr('data-id', e.b.id).attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${bshort(e.b)}: open the record`).style('cursor', 'pointer').on('click', () => select(e.b.id))
        .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.b.id); } })
        .on('mouseenter', (ev) => { tip.show(ev, tipBench(e.b)); mark(e.b.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); });
      gg.append('path').attr('d', `M${W - M.r + 1},${e.y}L${lx - 2},${e.ly}`).attr('stroke', INK).attr('stroke-opacity', 0.45).attr('fill', 'none');
      gg.append('rect').attr('class', 'bm-dtag').attr('x', lx).attr('y', e.ly - 5).attr('width', 2).attr('height', 10).attr('fill', bcolor(e.b));
      gg.append('text').attr('x', lx + 6).attr('y', e.ly + 3.5).attr('fill', e.c).text(fit(bshort(e.b), LG - 16, mobile ? '500 9.5px "Instrument Sans", sans-serif' : '500 11px "Instrument Sans", sans-serif'));
    });
  }

  // the dominant numeral: median time to saturation across the saturated benchmarks shown, counting up with the bars
  function drawBig(rows, anim, total) {
    const sh = rows.filter((b) => b.ts && inWin(b));
    if (!sh.length) { bigEl.textContent = 'open'; bigL.textContent = 'none of the benchmarks shown has saturated'; return; }
    const v = med(sh.map((b) => b.ts - b.t0));
    const early = sh.filter((b) => b.t0 < 2020), late = sh.filter((b) => b.t0 >= 2023);
    const parts = [];
    if (early.length && late.length) parts.push(`${yrs(med(early.map((b) => b.ts - b.t0)))} for those introduced before 2020, ${yrs(med(late.map((b) => b.ts - b.t0)))} from 2023 on`);
    bigL.textContent = `median time to saturation, ${sh.length} saturated benchmark${sh.length === 1 ? '' : 's'} shown${parts.length ? '. ' + parts.join('') : ''}`;
    if (!anim) { bigEl.textContent = yrs(v); return; }
    bigEl.textContent = yrs(0.05);
    go(() => d3.select(bigEl).transition().duration(total).ease(EASE).tween('n', () => { const i = d3.interpolateNumber(0.05, v); return (t) => { bigEl.textContent = yrs(i(t)); }; }));
  }

  function drawSummary(bl, anim) {
    const W = sumEl.clientWidth || 360;
    const rows = bl.slice().sort((p, q) => p.t0 - q.t0);
    const RH = 21, LW = Math.min(160, Math.max(110, W * 0.36)), DW = 62;
    const M = { t: 18, b: 6 };
    const H = M.t + rows.length * RH + M.b;
    const x = d3.scaleLinear().domain([2010, 2027]).range([LW, W - DW]);
    sumEl.innerHTML = '';
    const svg = d3.select(sumEl).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', 'Time from introduction to saturation for each benchmark');
    const step = (W - LW - DW) / 17 * 2 < 34 ? 4 : 2;
    d3.range(2010, 2027, step).forEach((t) => { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', M.t - 4).attr('y2', H - M.b).attr('stroke', 'var(--rule)'); svg.append('text').attr('class', 'bm-tk').attr('x', x(t)).attr('y', 10).attr('text-anchor', 'middle').text(t); });
    svg.append('text').attr('class', 'bm-tk').attr('x', W).attr('y', 10).attr('text-anchor', 'end').text('time');
    // Grow and focus: bars grow 900ms on ease-out cubic, starting 60ms apart top to bottom (compressed so the last bar
    // lands at 1140ms however many there are); at 1900ms the focus shifts over 400ms, linear, to the fastest saturation
    const SD = 900, SG = Math.min(60, 240 / Math.max(1, rows.length - 1));
    drawBig(rows, anim, SD + SG * (rows.length - 1));
    const satRows = rows.filter((b) => b.ts && inWin(b));
    const fastest = satRows.length > 1 ? satRows.reduce((p, q) => (q.ts - q.t0 < p.ts - p.t0 ? q : p)) : null;
    sumEl.classList.remove('bm-focused');
    clearTimeout(drawSummary.focusT);
    const focus = () => {
      if (!fastest) return;
      sumEl.querySelectorAll('.bm-srow').forEach((n) => n.classList.toggle('fast', n.dataset.id === fastest.id));
      sumEl.classList.add('bm-focused');
      findEl.textContent = `Shortest time to saturation: ${bshort(fastest)}, ${yrs(fastest.ts - fastest.t0)} after its introduction in ${Math.floor(fastest.t0)}.`;
    };
    findEl.textContent = '';
    if (fastest && anim) go(() => { drawSummary.focusT = setTimeout(focus, 1900); });
    else if (fastest) focus();
    rows.forEach((b, i) => {
      const yy = M.t + i * RH, hue = bcolor(b), c = INK, e = b.ts || NOW_T, open = !b.ts;
      const dl = anim ? i * SG : 0;
      const g = svg.append('g').attr('class', 'bm-srow' + (inWin(b) ? '' : ' off')).attr('data-id', b.id).attr('transform', `translate(0,${yy})`).attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', `${b.name}: introduced ${fmtYM(b.introduced)}, ${open ? 'not saturated' : 'saturated ' + fmtYM(b.saturated_date)}`)
        .on('mouseenter', (ev) => { tip.show(ev, tipBench(b)); mark(b.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); })
        .on('click', () => select(b.id)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(b.id); } });
      g.append('rect').attr('class', 'bg').attr('x', 0).attr('y', 0).attr('width', W).attr('height', RH - 1);
      g.append('rect').attr('class', 'bm-dtag').attr('x', 0).attr('y', RH / 2 - 6).attr('width', 2).attr('height', 12).attr('fill', hue);
      g.append('text').attr('class', 'bm-sl').attr('x', 7).attr('y', RH / 2 + 4).text(fit(bshort(b), LW - 17, '400 12.5px Instrument Sans, serif'));
      const x0 = x(b.t0), x1 = Math.max(x0 + 3, x(e));
      const bar = g.append('rect').attr('class', 'bm-bar').attr('x', x0).attr('y', 5).attr('width', anim ? 0 : x1 - x0).attr('height', RH - 11).attr('fill', open ? 'none' : c).attr('stroke', c).attr('stroke-width', open ? 1.3 : 0).attr('stroke-dasharray', open ? '3 2' : null);
      if (anim) go(() => bar.transition().delay(dl).duration(SD).ease(d3.easeCubicOut).attr('width', x1 - x0));
      const tail = g.append('g').attr('class', 'bm-stail');
      if (!open) tail.append('path').attr('d', `M${x1},${RH / 2 - 5}L${x1 + 5},${RH / 2}L${x1},${RH / 2 + 5}L${x1 - 5},${RH / 2}Z`).attr('fill', 'var(--ground)').attr('stroke', 'var(--ink)').attr('stroke-width', 1.4);
      tail.append('text').attr('class', 'bm-sd').attr('x', W).attr('y', RH / 2 + 4).attr('text-anchor', 'end').attr('fill', open ? 'var(--ink-3)' : 'var(--ink)').text(open ? `${yrs(NOW_T - b.t0)}+` : yrs(b.ts - b.t0));
      if (anim) {
        tail.style('opacity', 0);
        go(() => { tail.transition().delay(dl + SD - 160).duration(200).style('opacity', 1); if (!open) pulse(g, x1, RH / 2, 'var(--ink)', dl + SD - 80); });
      }
    });
  }

  function draw() {
    const bl = list();
    const m = mode();
    const anim = animNext && !RM() && el.clientWidth > 0;
    animNext = false;
    q.length = 0;
    el.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
    const [a, z] = win();
    const nOn = bl.filter(inWin).length;
    countEl.innerHTML = `<b>${nOn}</b> of ${all.length} benchmarks in ${Math.floor(a)} to ${Math.min(2026, Math.ceil(z) - 1)}`;
    if (!bl.length) {
      panelsEl.innerHTML = `<div class="pl-empty"><h3>No benchmarks match</h3><p>Nothing matches the search "${esc(S.q)}".</p><button type="button" class="btn-ghost" data-clear="1">Clear search</button></div>`;
      chart.innerHTML = ''; sumEl.innerHTML = '';
      return;
    }
    drawPanels(bl, anim);
    // the evidence block draws only once it is open (closed, its boxes have no width)
    if (!chart.clientWidth) { mark(); arm(); return; }
    pairCtl.hidden = m !== 'pair';
    pairRead.hidden = m !== 'pair';
    capEl.textContent = m === 'pair' ? '' : `${bl.length} of ${all.length}`;
    if (m === 'pair') {
      const A = byId(pairA) || all[0], B = byId(pairB) || all[1] || all[0];
      capEl.textContent = A === B ? bshort(A) : `${bshort(A)} \u00b7 ${bshort(B)}`;
      const pl = A === B ? [A] : [A, B];
      drawOverlay(pl, false, true, anim);
      const span = (b) => (b.ts ? `${yrs(b.ts - b.t0)} from ${fmtYM(b.introduced)} to saturation` : `open after ${yrs(NOW_T - b.t0)}`);
      pairRead.innerHTML = pl.map((b) => `<span><i class="bm-sw" style="background:${bcolor(b)}"></i><b>${esc(bshort(b))}</b> ${esc(span(b))}</span>`).join('') + (pl.length === 2 && A.ts && B.ts ? `<span class="d">${esc(yrs(Math.abs((A.ts - A.t0) - (B.ts - B.t0))))} apart</span>` : '');
      drawSummary(pl, anim);
      mark(); arm();
      return;
    }
    drawOverlay(bl, m === 'aligned', false, anim);
    drawSummary(bl, anim);
    mark(); arm();
  }

  // ---- window: a brush over 2010 to 2026 that sets the years in view
  const winSvg = d3.select(el.querySelector('.bm-win'));
  const WX = d3.scaleLinear().domain([2010, 2027]).range([4, 216]);
  const brush = d3.brushX().extent([[4, 6], [216, 24]]).handleSize(6)
    .on('end', (ev) => {
      if (!ev.sourceEvent || !ev.selection) return;
      const [a, z] = ev.selection.map(WX.invert);
      const y0 = Math.max(2010, Math.min(2024, Math.round(a))), y1 = Math.max(y0 + 1, Math.min(2026, Math.round(z) - 1));
      set({ y0, y1 });
    });
  function drawWin() {
    winSvg.selectAll('*').remove();
    d3.range(2010, 2027, 4).forEach((t) => { winSvg.append('line').attr('x1', WX(t)).attr('x2', WX(t)).attr('y1', 6).attr('y2', 24).attr('stroke', 'var(--rule)'); winSvg.append('text').attr('class', 'bm-tk').attr('x', WX(t)).attr('y', 30).attr('text-anchor', t === 2010 ? 'start' : 'middle').text(String(t).slice(2)); });
    winSvg.append('line').attr('x1', 4).attr('x2', 216).attr('y1', 15).attr('y2', 15).attr('stroke', 'var(--rule-strong)');
    const g = winSvg.append('g').attr('class', 'bm-brush').call(brush);
    const [a, z] = win();
    g.call(brush.move, [WX(a), WX(Math.min(2027, z))]);
  }

  function mark(id) {
    const cur = id || hiId || (S.sel && db.benchById.get(S.sel)?.id) || null;
    const pt = S.sel && S.sel.startsWith('bench:') ? S.sel : null;
    el.classList.toggle('bm-focus', !!cur && mode() !== '');
    sumEl.classList.toggle('bm-hover', !!cur);
    el.querySelectorAll('.bm-line, .bm-end, .bm-srow, .bm-card').forEach((n) => n.classList.toggle('hi', n.dataset.id === cur));
    el.querySelectorAll('.bm-pt').forEach((n) => n.classList.toggle('sel', n.dataset.id === pt));
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.m != null) set({ mode: b.dataset.m });
    else if (b.dataset.b) select(b.dataset.b);
    else if (b.dataset.clear) set({ q: '' });
    else if (b.dataset.human != null) { humanOn = !humanOn; b.setAttribute('aria-pressed', String(humanOn)); draw(); }
    else if (b.dataset.lab) {
      const k = b.dataset.lab;
      if (labOff.has(k)) labOff.delete(k); else labOff.add(k);
      if (labOff.size === LABS.length) labOff.clear();
      el.querySelectorAll('[data-lab]').forEach((x) => x.setAttribute('aria-pressed', String(!labOff.has(x.dataset.lab))));
      el.querySelectorAll('.bm-pt').forEach((n) => n.classList.toggle('dim', !labPass(d3.select(n).datum().p)));
    }
  });
  // Specimen Stage: a new pair is a hard swap; the stage holds the old specimen, the identifier flips at 120ms, the
  // chart and summary cut to the new pair at 240ms with no transition
  let swapT1 = 0, swapT2 = 0;
  const hardSwap = () => {
    if (RM()) { draw(); return; }
    clearTimeout(swapT1); clearTimeout(swapT2);
    const A = byId(pairA) || all[0], B = byId(pairB) || all[1] || all[0];
    swapT1 = setTimeout(() => { capEl.textContent = A === B ? bshort(A) : `${bshort(A)} \u00b7 ${bshort(B)}`; }, 120);
    swapT2 = setTimeout(() => { animNext = false; draw(); }, 240);
  };
  el.querySelector('[data-pa]').addEventListener('change', (ev) => { pairA = ev.target.value; hardSwap(); });
  el.querySelector('[data-pb]').addEventListener('change', (ev) => { pairB = ev.target.value; hardSwap(); });
  el.addEventListener('mouseover', (ev) => { const h = ev.target.closest('.bm-h'); if (h) mark(h.dataset.b); });
  el.addEventListener('mouseout', (ev) => { if (ev.target.closest('.bm-h')) mark(); });

  /* ---------- shared helpers that outlived the canvas ---------- */
  let critique = null;              // data/benchmark_critique.json once it lands
  const mkOf = (b) => makerOf(b, critique && critique.makers);
  const lastSat = (bl) => { const sh = bl.filter((b) => b.ts); return sh.length ? sh.reduce((p, q) => (q.ts > p.ts ? q : p)) : null; };
  // the screen's head: the two counts from humanLineCount, the rule in one line, the source line
  function drawHead() {
    const hl = humanLineCount(db);
    el.querySelector('.bm-head').textContent = `${hl.crossed} of ${hl.withHuman} human baselines have been passed`;
    el.querySelector('.bm-dek').textContent = `${hl.saturated} of ${hl.total} count as saturated.`;
    el.querySelector('.bm-srcline').innerHTML = `Epoch AI Benchmarking Hub and benchmark papers, read October 2026; human lines from each paper.`;
  }
  drawHead();
  // the folded evidence keeps its text out of the page until opened (a closed details still renders its text to tools)
  { const more = el.querySelector('.bm-more'), inner = el.querySelector('.bm-more-in'); more.addEventListener('toggle', () => { inner.hidden = !more.open; if (more.open) { draw(); drawWin(); } }); }
  el.querySelector('.bm-rule').textContent = `Saturated means ${humanLineCount(db).rule}.`;

  /* ---------- critique: what a score does not tell you ---------- */
  const critList = el.querySelector('.bc-list'), critDek = el.querySelector('.bc-dek');
  const KINDS = [['saturation', 'Saturation'], ['human', 'Human lines'], ['makers', 'Who makes them'], ['authorship', 'Who makes them'], ['contamination', 'Contamination'], ['reporting', 'Self-reporting'], ['gaming', 'Gaming'], ['goodhart', 'Goodhart effects'], ['validity', 'Validity'], ['usefulness', 'Usefulness'], ['economics', 'Scores and the economy'], ['prediction', 'What saturation predicted'], ['other', 'Also on record']];
  const kindLabel = (k) => (KINDS.find(([id]) => id === k) || [k, k])[1];
  function fallbackFindings() {
    const rows = [];
    const sh = all.filter((b) => b.ts), late = sh.filter((b) => b.t0 >= 2023), early = sh.filter((b) => b.t0 < 2020);
    const srcOf = (b) => (b.sources && b.sources[0]) || null;
    const newest = lastSat(all);
    if (sh.length) rows.push({ kind: 'saturation', claim: `${sh.length} of ${all.length} benchmarks here have saturated. ${late.length && early.length ? `Those introduced from 2023 on took a median ${yrs(med(late.map((b) => b.ts - b.t0)))}; those introduced before 2020 took ${yrs(med(early.map((b) => b.ts - b.t0)))}.` : ''} A saturated benchmark stops telling models apart.`, source: newest && srcOf(newest) });
    const withH = all.filter((b) => b.human_baseline), passed = withH.filter((b) => b.points.some((p) => pct(b, p.value) >= pct(b, b.human_baseline.value)));
    if (withH.length) rows.push({ kind: 'human', claim: `${withH.length} of ${all.length} publish a human baseline and models have passed ${passed.length} of them. The baselines are not alike: ${withH.filter((b) => /expert|medalist|PhD/i.test(b.human_baseline.note || '')).length} are expert panels, the rest are crowd workers or the authors.`, source: (withH.find((b) => b.human_baseline.source) || {}).human_baseline?.source ? { url: withH.find((b) => b.human_baseline.source).human_baseline.source, title: 'human baseline source' } : null });
    const nMk = Object.fromEntries(MAKERS.map(([id]) => [id, all.filter((b) => mkOf(b) === id).length]));
    rows.push({ kind: 'makers', claim: `${nMk.lab} of ${all.length} were made by company labs, ${nMk.academic} by university groups and ${nMk.independent} by foundations or research nonprofits, read from each record's creator line. Labs that make a benchmark also report scores on it.`, source: srcOf(all.find((b) => mkOf(b) === 'lab') || all[0]) });
    const leak = all.filter((b) => /contaminat|leak|training data|memoriz/i.test(b.notes || ''));
    if (leak.length) rows.push({ kind: 'contamination', claim: `Research notes on ${leak.map(bshort).join(', ')} raise test questions reaching training data; scores on older public sets overstate ability on new problems.`, source: srcOf(leak[0]) });
    const selfr = all.filter((b) => /self-report|reported by|lab report|prompting|CoT|few-shot|5-shot/i.test(b.notes || ''));
    if (selfr.length) rows.push({ kind: 'reporting', claim: `Most record scores are reported by the lab that trained the model, with prompting and tooling that differ run to run; notes on ${selfr.slice(0, 4).map(bshort).join(', ')} record setups that independent evaluators could not always reproduce.`, source: srcOf(selfr[0]) });
    const verified = all.flatMap((b) => b.points).filter((p) => p.verification), partly = verified.filter((p) => p.verification !== 'supported');
    if (verified.length) rows.push({ kind: 'other', claim: `${verified.length} of the newest record results carry a fact-check verdict; ${partly.length} are only partly supported by their source as published.`, source: null });
    return rows;
  }
  function renderCritique() {
    const found = critique && Array.isArray(critique.findings) && critique.findings.length ? critique.findings : null;
    const rows = (found || fallbackFindings()).map((f) => ({ kind: (f.kind || 'other').toLowerCase(), claim: f.claim || f.text || f.finding || '', source: f.source && typeof f.source === 'object' ? f.source : (f.url || f.source_url) ? { url: f.url || f.source_url, title: f.source_title || f.source || '' } : (f.sources && f.sources[0]) || null, year: f.year || '', lead: false })).filter((r) => r.claim);
    // the economics finding of the research is an absence; it is stated as its own line, with no correlation computed here
    if (found && rows.some((r) => r.kind === 'economics')) rows.push({ kind: 'economics', claim: 'No study links a saturated benchmark to adoption, revenue or prices; the closest evidence runs the other way.', source: null, year: '', lead: true });
    const order = new Map(KINDS.map(([id], i) => [id, i]));
    rows.sort((p, q) => (order.has(p.kind) ? order.get(p.kind) : 99) - (order.has(q.kind) ? order.get(q.kind) : 99) || (q.lead ? 1 : 0) - (p.lead ? 1 : 0) || (p.year || 0) - (q.year || 0));
    const sm = critique && critique.summary;
    critDek.textContent = found ? `${rows.length - 1} sourced findings on ${sm ? sm.benchmarks : all.length} benchmarks, grouped by kind; counts overlap. Each row links to its source.` : `${rows.length} findings read from the records on this page: saturation dates, human lines and the fact-check verdicts. Sourced studies on contamination, Goodhart effects and what saturation predicted fill this list when the research file lands.`;
    // Archive Index: each kind is a group under a sticky running head, so a long list keeps its locator while it scrolls
    const groups = []; rows.forEach((r) => { const g = groups[groups.length - 1]; if (g && g.kind === r.kind) g.rows.push(r); else groups.push({ kind: r.kind, rows: [r] }); });
    let i = 0;
    critList.innerHTML = groups.map((g) => `<li class="bc-group"><div class="bc-run"><span class="sc">${esc(kindLabel(g.kind))}</span><span class="sc n">${g.rows.length}</span></div><ol>${g.rows.map((r) => `<li class="bc-row${r.lead ? ' lead' : ''}" style="--d:${(i++) * 80}ms"><span class="bc-claim">${esc(r.claim)}</span><span class="bc-src">${r.source && r.source.url ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(host(r.source.url))}</a>${r.year ? ` ${esc(String(r.year))}` : ''}` : `<span class="bc-none">${r.lead ? 'the research found no such study' : 'from the records above'}</span>`}</span></li>`).join('')}</ol></li>`).join('');
  }
  renderCritique();
  // the critique file is fetched only once the build lists it, so a missing file never logs an error
  if (db.manifest && Array.isArray(db.manifest.optional) && db.manifest.optional.includes('benchmark_critique.json')) {
    fetch(`data/benchmark_critique.json?v=${encodeURIComponent(db.manifest.version || '')}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j) return; critique = j; renderCritique(); }).catch(() => {});
  }
  return {
    render(state, ch) {
      if (ch.has('*') || ch.has('mode')) animNext = true;
      if (ch.has('*') || ch.has('y0') || ch.has('y1') || ch.has('q') || ch.has('mode')) { draw(); drawWin(); }
      else if (ch.has('sel')) mark();
    },
    resize() { draw(); drawWin(); },
    hover(id) {
      hiId = id && db.benchById.get(id) ? db.benchById.get(id).id : null;
      mark();
      if (hiId && S.tour) { const n = el.querySelector(`.bm-card[data-id="${CSS.escape(hiId)}"]`); if (n) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    },
  };
}

/* ---------- tests versus people: two aligned columns of numerals that share a baseline ----------
   Left, what the tests say (saturation and the human line); right, what people do (adoption, prices, power), each
   as the same card: a label, one numeral, a sentence, a small chart on a common baseline, and its source. */
const fmtMoney = (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${Math.round(v / 1e9)}B` : v >= 1e6 ? `$${Math.round(v / 1e6)}M` : `$${v}`);
const SW = 150, SH = 28;
// the span a small chart covers, printed under it: first to last year of the points drawn
const span = (pts, suffix = '') => { const p = pts.filter((d) => d.value > 0); return p.length ? `${Math.floor(d3.min(p, (d) => d.year))} to ${Math.floor(d3.max(p, (d) => d.year))}${suffix}` : ''; };
function spark(pts, color, log = false) {
  const p = pts.filter((d) => d.value > 0);
  if (p.length < 2) return '';
  const x = d3.scaleLinear().domain(d3.extent(p, (d) => d.year)).range([1, SW - 1]);
  const y = (log ? d3.scaleLog() : d3.scaleLinear()).domain(d3.extent(p, (d) => d.value)).range([SH - 2, 2]);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.value));
  const last = p[p.length - 1];
  return `<svg width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" aria-hidden="true"><path d="${line(p)}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${x(last.year)}" cy="${y(last.value)}" r="2.5" fill="${color}"/></svg>`;
}
// a share of a whole, as filled and empty cells on the same baseline as the sparklines
function cells(n, of, color) {
  const w = Math.min(14, Math.floor((SW + 2) / of) - 2);
  return `<svg width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" aria-hidden="true">${d3.range(of).map((i) => `<rect x="${i * (w + 2)}" y="${SH - 14}" width="${w}" height="12" fill="${i < n ? color : 'none'}" stroke="${color}" stroke-width="${i < n ? 0 : 0.8}"/>`).join('')}</svg>`;
}
// one bar against a shared scale, so the two medians read against each other at a glance
function bar(v, max, color, label) {
  const w = Math.max(2, (v / max) * (SW - 1));
  return `<svg width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" aria-hidden="true"><rect x="0" y="${SH - 14}" width="${w}" height="12" fill="${color}"/><text x="${w + 4}" y="${SH - 4}" class="vs-bl">${esc(label)}</text></svg>`;
}

export function versusColumns(slot, { db, select }) {
  const all = db.benchmarks || [];
  const sat = all.filter((b) => b.ts);
  const med = (a) => d3.median(a) || 0;
  const early = sat.filter((b) => b.t0 < 2020), late = sat.filter((b) => b.t0 >= 2023);
  const mE = med(early.map((b) => b.ts - b.t0)), mL = med(late.map((b) => b.ts - b.t0)), mMax = Math.max(mE, mL, 0.1);
  const withHuman = all.filter((b) => b.human_baseline && b.human_baseline.value != null && b.points.length);
  const passed = withHuman.filter((b) => { const last = b.points[b.points.length - 1]; return pct(b, last.value) >= pct(b, b.human_baseline.value); });
  const open = all.filter((b) => !b.ts);
  const newest = open.slice().sort((a, b) => b.t0 - a.t0).slice(0, 3);
  const INK = 'var(--ink-2)';
  const names = (bs) => bs.map((b) => `<button type="button" class="lnk" data-bench="${esc(b.id)}">${esc(bshort(b))}</button>`).join(', ');
  const tests = [
    { k: 'Saturated', big: `${sat.length} of ${all.length}`, d: `benchmarks where the record reached the human line or stopped moving near the ceiling.`, svg: cells(sat.length, all.length, INK), sp: `2010 to 2026` },
    early.length ? { k: 'Introduced before 2020', big: yrs(mE), d: `median time from release to saturation, ${early.length} benchmark${early.length === 1 ? '' : 's'}.`, svg: bar(mE, mMax, INK, yrs(mE)), sp: `years, one scale` } : null,
    late.length ? { k: 'Introduced 2023 on', big: yrs(mL), d: `median time from release to saturation, ${late.length} benchmark${late.length === 1 ? '' : 's'}, drawn on the same scale as the bar for those introduced before 2020.`, svg: bar(mL, mMax, INK, yrs(mL)), sp: `years, one scale` } : null,
    withHuman.length ? { k: 'Human line passed', big: `${passed.length} of ${withHuman.length}`, d: `benchmarks with a published human baseline where the record has passed it${passed.length ? `: ${names(passed)}` : ''}.`, svg: cells(passed.length, withHuman.length, INK), sp: `${withHuman.length} with a human line` } : null,
    { k: 'Still open', big: String(open.length), d: open.length ? `not yet saturated${newest.length ? `, including ${names(newest)}` : ''}.` : 'every benchmark tracked has saturated.', svg: cells(open.length, all.length, INK), sp: `2010 to 2026` },
  ].filter(Boolean);

  const people = [];
  const t100 = seriesById('time_to_100m_users');
  const chat = t100 && (t100.points || []).find((p) => /chatgpt/i.test(p.label));
  if (chat) {
    const s = (chat.sources || [])[0] || (t100.sources || [])[0];
    const ordered = t100.points.slice().sort((a, b) => a.value - b.value);
    const hmax = Math.max(...ordered.map((p) => Math.log10(p.value * 6 + 1) * 10), 2);
    people.push({ k: 'Adoption', big: `${chat.value} months`, d: `ChatGPT reached 100 million users about ${chat.value} months after launch (${esc(chat.detail || '')}). Facebook took ${(t100.points.find((p) => /facebook/i.test(p.label)) || {}).value} months, Netflix ${(t100.points.find((p) => /netflix/i.test(p.label)) || {}).value}.`, src: s, acc: true, sp: `${ordered.length} products, months`,
      svg: `<svg width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" aria-hidden="true">${ordered.map((p, i) => { const h = Math.max(2, Math.log10(p.value * 6 + 1) * 10 / hmax * (SH - 3)); return `<rect x="${i * 16}" y="${SH - 1 - h}" width="12" height="${h}" fill="${/chatgpt/i.test(p.label) ? 'var(--accent)' : 'var(--ground-3)'}"><title>${esc(p.label)}: ${p.value} months</title></rect>`; }).join('')}</svg>` });
  }
  const inv = seriesById('ai_private_investment');
  if (inv) {
    const pts = (inv.points || []).filter((p) => p.value != null).sort((a, b) => a.year - b.year);
    const first = pts[0], last = pts[pts.length - 1];
    if (first && last) people.push({ k: 'Private investment', big: fmtMoney(last.value), d: `Global private investment in AI companies in ${last.year}, in constant 2021 dollars, up from ${fmtMoney(first.value)} in ${first.year}. Nominal figures in the AI Index run higher.`, src: (inv.sources || [])[0], svg: spark(pts, INK), sp: span(pts) });
  }
  const nv = seriesById('nvidia_revenue');
  if (nv && nv.data_center_points) {
    const pts = nv.data_center_points.filter((p) => p.value != null).sort((a, b) => a.year - b.year);
    const last = pts[pts.length - 1], prev = pts.find((p) => p.year === last.year - 3) || pts[Math.max(0, pts.length - 4)];
    people.push({ k: 'Chips', big: fmtMoney(last.value * 1e6), d: `NVIDIA data center revenue in fiscal ${last.year} (year ended January ${last.year}), against ${fmtMoney(prev.value * 1e6)} in fiscal ${prev.year}.`, src: (last.sources || nv.sources || [])[0], svg: spark(pts, INK, true), sp: span(pts, ', fiscal, log') });
  }
  const pr = seriesById('llm_inference_price');
  if (pr) {
    const L = seriesLines(pr).filter((l) => /GPT-4-0314/.test(l.name) && /MMLU/.test(l.name))[0];
    if (L && L.points.length > 1) {
      const pts = L.points.slice().sort((a, b) => a.year - b.year);
      const a = pts[0], b = pts[pts.length - 1];
      people.push({ k: 'Price of capability', big: `${Math.round(a.value / b.value)}x`, d: `${Math.round(a.value / b.value)} times cheaper: the cheapest model matching GPT-4 (March 2023) on MMLU fell from $${a.value} to $${b.value} per million tokens between ${a.date || Math.floor(a.year)} and ${b.date || Math.floor(b.year)} (${esc(b.label)}).`, src: (pr.sources || [])[0], svg: spark(pts, INK, true), sp: span(pts, ', log') });
    }
  }
  const dc = seriesById('datacenter_electricity');
  if (dc) {
    const pts = (dc.points || []).filter((p) => !p.projection).sort((a, b) => a.year - b.year);
    const last = pts[pts.length - 1], proj = (dc.points || []).filter((p) => p.projection && p.scenario !== 'headwinds').sort((a, b) => a.year - b.year)[0];
    if (last) people.push({ k: 'Electricity', big: `${last.value} TWh`, d: `Global data centre electricity use in ${last.year} (IEA estimate${last.label ? ', ' + esc(last.label) : ''})${proj ? `, projected to reach ${proj.value} TWh by ${proj.year} in the IEA base case` : ''}.`, src: (last.sources || dc.sources || [])[0], svg: spark(pts, INK), sp: span(pts) });
  }
  const card = (c, i) => `<div class="u"><span class="ix">${String(i + 1).padStart(2, '0')}</span><span class="sc">${esc(c.k)}</span><b${c.acc ? ' class="acc"' : ''}>${c.big}</b><span class="d">${c.d}</span>${c.svg || ''}<span class="sp">${c.sp || ''}</span>${c.src ? `<a href="${esc(c.src.url)}" target="_blank" rel="noopener">${esc(host(c.src.url))}</a>` : '<span class="src"></span>'}</div>`;
  const n = Math.max(tests.length, people.length);
  slot.className = 'td-vs vs2';
  slot.style.setProperty('--n', n);
  slot.setAttribute('aria-label', 'What tests say versus what people do');
  slot.innerHTML = `
    <div class="vs-col vs-tests"><span class="sc">What the tests say</span><h3>Scores on ${all.length} benchmarks, as a share of the best possible</h3><div class="td-usage" aria-label="Benchmark saturation and the human line">${tests.map(card).join('')}</div></div>
    <div class="vs-mid" aria-hidden="true"><span>vs</span></div>
    <div class="vs-col vs-people"><span class="sc">What people do</span><h3>Use and spending measured outside the lab</h3><div class="td-usage" id="td-usage" aria-label="Usage and spending outside the lab">${people.map(card).join('')}</div></div>`;
  slot.addEventListener('click', (ev) => { const b = ev.target.closest('[data-bench]'); if (b) { ev.stopPropagation(); select(b.dataset.bench); } });
}
