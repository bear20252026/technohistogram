// Capital and Compute, the ruled row of small multiples: six sourced measures from data/series_v3.json drawn as
// specimens on the light ground. Prices per million tokens (frontier and small tiers, log scale), GPU performance
// per dollar (Epoch's four points, log scale), data centre electricity (IEA, with the 2030 projection hollow),
// the largest known training run per year (Epoch, log scale), accelerator compute per watt (datasheets) and the AI
// share of global venture dollars (Crunchbase, bars).
// Each multiple carries its contract line, a finding, a source footer and opens its points in the drawer.
// Grow and focus: the marks of each multiple arrive the first time the row is 40 percent in view, 900ms ease-out
// cubic with 60ms starts; the finding fades in alongside (500 to 900ms) and at 900ms the finding's marks take the accent.
import { esc } from '../ui.js';
import { host } from '../data.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WANT = ['api_price_frontier', 'api_price_small', 'flops_per_dollar_epoch', 'datacenter_electricity_v3', 'frontier_training_compute', 'flop_per_watt_datasheets', 'ai_share_venture'];
const pow10 = (e) => `10${sup(e)}`;

// a dated point to a decimal year; "2024", "2016-05" and "2023-03-14" all read
const tOf = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
const fmtWhen = (d) => { const [y, m] = String(d).split('-').map(Number); return m ? `${MON[m - 1]} ${y}` : String(y); };
const money = (v) => (v >= 1 ? `$${+v.toFixed(2)}` : `$${v}`);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace(/\d/g, (c) => SUP[+c]);
const sci = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; return `${+m.toFixed(1)} × 10${sup(e)}`; };
const fmtFlop = (v) => `${+(v / 1e9).toFixed(1)}B`;

export default function multiples(el, { select, tip, onReady }) {
  let S = null, seen = RM, grown = false, built = false;
  const svgs = new Map();

  // the row's markup: a kicker, three articles, each with a title, a contract line, the drawing, a label line for
  // the hovered point, the finding and a source footer
  el.innerHTML = `
    <div class="cm-h"><span class="sc">Prices, chips and power</span><span class="cm-n">six sourced measures</span></div>
    <div class="cm-row">
      ${art('price', 'List price per million tokens', 'US$ per million input tokens, log scale; frontier and small tiers, list price at launch or a documented change')}
      ${art('flops', 'GPU performance per dollar', 'FLOP/s per US$, inflation adjusted, log scale; Epoch AI reads the trend as about 30 percent a year')}
      ${art('power', 'Data centre electricity', 'TWh a year, global, IEA; the 2030 point is a projection and is drawn hollow')}
      ${art('train', 'Largest known training run', 'FLOP, the largest training compute Epoch AI records per publication year, log scale; 2026 is partial and drawn hollow')}
      ${art('watt', 'Accelerator compute per watt', 'GFLOP/s per W, dense FP16 or BF16 peak over TDP, vendor datasheets, log scale; the B200 figures are SemiAnalysis readings')}
      ${art('venture', 'AI share of venture funding', 'Percent of global venture dollars that went to AI companies, Crunchbase year-end counts')}
    </div>`;
  function art(id, title, contract) {
    return `<article class="cm" data-cm="${id}">
      <h3>${esc(title)}</h3>
      <p class="cm-contract">${esc(contract)}</p>
      <svg class="cm-svg" role="group" aria-label="${esc(title)}"></svg>
      <p class="cm-label" aria-live="polite"></p>
      <p class="cm-find"></p>
      <footer class="cm-foot"></footer>
    </article>`;
  }

  // the points are drawer records: Capital registers them under series:<id>:<index> and the drawer renders them
  function record(s, i, p, d) {
    const id = `series:${s.id}:${i}`;
    const when = fmtWhen(d ? d.date : p[0]);
    let title, kicker, rows;
    if (s.id.startsWith('api_price')) {
      title = d.model; kicker = `<span class="ki">Price point</span><span class="ki">${esc(d.org)}</span>`;
      rows = [['Input', `${money(d.input)} per million tokens`], ['Output', `${money(d.output)} per million tokens`], ['Tier', s.id === 'api_price_frontier' ? 'Frontier' : 'Small'], ['Read on', when]];
    } else if (s.id === 'flops_per_dollar_epoch') {
      title = p[2]; kicker = `<span class="ki">GPU</span><span class="ki">Epoch AI</span>`;
      rows = [['Performance per dollar', `${sci(p[1])} FLOP/s per US$`], ['Release', when], ['Basis', 'inflation adjusted, prices normalised to the H100 release']];
    } else if (s.id === 'frontier_training_compute') {
      title = d.model; kicker = `<span class="ki">Training run</span><span class="ki">${esc(d.org.split(',')[0])}</span>`;
      rows = [['Training compute', `${sci(d.flop)} FLOP`], ['Published', fmtWhen(d.date)], ['Rank', `largest known run of ${p[0]}${p[0] === 2026 ? ', partial year' : ''}`]];
    } else if (s.id === 'flop_per_watt_datasheets') {
      title = d.chip; kicker = `<span class="ki">Accelerator</span><span class="ki">${esc(d.chip.startsWith('TPU') ? 'Google' : 'NVIDIA')}</span>`;
      rows = [['Compute per watt', `${+p[1].toFixed(0)} GFLOP/s per W`], ['Dense peak', `${d.tflops_dense} TFLOP/s`], ['Power', `${d.watts} W`], ['Released', when], ['Reading', d.note]];
    } else if (s.id === 'ai_share_venture') {
      title = `${p[1]}% of venture dollars in ${p[0]}`; kicker = `<span class="ki">Venture share</span><span class="ki">Crunchbase</span>`;
      rows = [['AI funding', `$${d.ai_bn}B`], ['All venture funding', `$${d.global_bn}B`], ['Share', `${p[1]} percent`], ['Year', String(p[0])]];
    } else {
      const proj = p[0] >= 2030;
      title = `${p[1]} TWh in ${p[0]}${proj ? ' (projection)' : ''}`; kicker = `<span class="ki">${proj ? 'Projection' : 'Reading'}</span><span class="ki">IEA</span>`;
      rows = [['Consumption', `${p[1]} TWh`], ['Year', String(p[0])], ['Status', proj ? 'IEA projection, about 3 percent of global demand' : 'reported']];
    }
    const url = (d && d.source_url) || s.source_url;
    const more = (s.sources || []).filter((x) => x.url !== url);
    const html = `
      <h3>${esc(title)}</h3>
      <div class="date"><span>${esc(when)}</span><span>${esc(s.label)}</span></div>
      <dl class="dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="summary">${esc(s.notes)}</p>
      <div class="sect-h"><span>Source${more.length ? 's' : ''}</span><span>${1 + more.length}</span></div>
      <ol class="sources"><li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(s.source)}</a><span class="host">${esc(host(url))}</span></li>${more.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a><span class="host">${esc(host(x.url))}</span></li>`).join('')}</ol>`;
    return { id, kicker, html, title, when };
  }

  async function load(db) {
    if (S) return S;
    try { const r = await fetch('data/series_v3.json'); const j = await r.json(); S = Object.fromEntries((j.series || []).filter((s) => WANT.includes(s.id)).map((s) => [s.id, s])); }
    catch { S = {}; }
    if (!db.pointById) db.pointById = new Map();
    for (const s of Object.values(S)) s.points.forEach((p, i) => { const rec = record(s, i, p, s.detail && s.detail[i]); db.pointById.set(rec.id, rec); });
    return S;
  }

  // ---- drawing ----
  const W0 = 320, H0 = 150, M = { t: 10, r: 14, b: 22, l: 36 };
  function svgOf(id) { const svg = d3.select(el.querySelector(`[data-cm="${id}"] svg`)); const w = Math.max(200, svg.node().clientWidth || W0); svg.attr('viewBox', `0 0 ${w} ${H0}`).attr('height', H0); svgs.set(id, { svg, w }); return { svg, w }; }
  const axes = (svg, w, x, y, xt, yt, yfmt, r = M.r) => {
    svg.selectAll('*').remove();
    svg.append('g').attr('class', 'cm-grid').selectAll('line').data(yt).join('line').attr('x1', M.l).attr('x2', w - r).attr('y1', (v) => y(v)).attr('y2', (v) => y(v));
    svg.append('g').attr('class', 'cm-ax').selectAll('text.yl').data(yt).join('text').attr('class', 'yl').attr('x', M.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(yfmt);
    svg.append('g').attr('class', 'cm-ax').selectAll('text.xl').data(xt).join('text').attr('class', 'xl').attr('x', (v) => x(v)).attr('y', H0 - 6).attr('text-anchor', 'middle').text((v) => String(v));
    svg.append('line').attr('class', 'cm-base').attr('x1', M.l).attr('x2', w - r).attr('y1', H0 - M.b).attr('y2', H0 - M.b);
  };
  const stage = (anim, sel, i0 = 0) => {
    // Grow and focus: marks arrive from radius 0, 900ms ease-out cubic, 60ms starts; held at zero until seen
    const held = !RM && !seen;
    if (held) { sel.attr('r', 0); return; }
    // 60ms starts, tightened when there are many marks so the whole grow lands before the focus shift at 1900ms
    const n = sel.size(), step = Math.min(60, 900 / Math.max(1, n));
    if (anim && !RM) sel.attr('r', 0).transition('grow').delay((d, i) => (i0 + i) * step).duration(900).ease(d3.easeCubicOut).attr('r', (d) => d.r);
    else sel.attr('r', (d) => d.r);
  };
  const hoverOn = (sel, art, text, rec) => {
    const lab = art.querySelector('.cm-label');
    sel.on('mouseenter', (ev, d) => { lab.textContent = text(d); if (tip) tip.show(ev, `<b>${esc(text(d))}</b><div class="k">click for the record</div>`); })
      .on('mousemove', (ev) => tip && tip.move(ev))
      .on('mouseleave', () => { lab.textContent = ''; if (tip) tip.hide(); })
      .on('focus', (ev, d) => { lab.textContent = text(d); })
      .on('blur', () => { lab.textContent = ''; })
      .on('click', (ev, d) => { if (tip) tip.hide(); select(rec(d).id); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(rec(d).id); } });
    // a 24px pointer target behind each circular mark (the marks themselves stay 6 to 9px); the hit forwards the same pointer handlers
    sel.each(function (d) {
      if (this.tagName !== 'circle') return;
      const mk = this;
      d3.select(mk.parentNode).insert('circle', () => mk).attr('class', 'mk-hit').attr('cx', mk.getAttribute('cx')).attr('cy', mk.getAttribute('cy')).attr('r', 12).attr('fill', 'transparent').attr('aria-hidden', 'true').style('cursor', 'pointer').datum(d)
        .on('mouseenter', (ev) => { lab.textContent = text(d); if (tip) tip.show(ev, `<b>${esc(text(d))}</b><div class="k">click for the record</div>`); })
        .on('mousemove', (ev) => tip && tip.move(ev))
        .on('mouseleave', () => { lab.textContent = ''; if (tip) tip.hide(); })
        .on('click', () => { if (tip) tip.hide(); select(rec(d).id); });
    });
  };

  function drawPrice(anim) {
    const a = el.querySelector('[data-cm="price"]'); const F = S.api_price_frontier, Sm = S.api_price_small; if (!F || !Sm) return;
    const { svg, w } = svgOf('price');
    const pts = [...F.points.map((p, i) => ({ s: F, i, t: tOf(p[0]), v: p[1], d: F.detail[i], tier: 'frontier', r: 4 })), ...Sm.points.map((p, i) => ({ s: Sm, i, t: tOf(p[0]), v: p[1], d: Sm.detail[i], tier: 'small', r: 3 }))].sort((p, q) => p.t - q.t);
    const R = 58; // room at the right for the tier labels
    const x = d3.scaleLinear().domain([2023, 2027]).range([M.l, w - R]);
    const y = d3.scaleLog().domain([0.03, 100]).range([H0 - M.b, M.t]);
    axes(svg, w, x, y, [2023, 2024, 2025, 2026], [0.1, 1, 10, 100], (v) => (v >= 1 ? `$${v}` : `${v * 100}¢`), R);
    const g = svg.append('g').attr('class', 'cm-marks');
    const tier = (k) => pts.filter((p) => p.tier === k);
    const lastOf = (k) => { const t = tier(k), tm = d3.max(t, (p) => p.t); return t.filter((p) => p.t === tm).sort((p, q) => p.v - q.v)[0]; };
    const first = tier('frontier')[0]; const last = lastOf('frontier');
    const m = g.selectAll('circle').data(pts).join('circle').attr('class', (d) => `mk ${d.tier}${d === first || d === last ? ' key' : ''}`).attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.d.model}, ${money(d.v)} per million input tokens, ${fmtWhen(d.d.date)}`);
    m.append('title').text((d) => `${d.d.model}: ${money(d.v)} in, ${money(d.d.output)} out per million tokens, ${fmtWhen(d.d.date)}`);
    // tier labels sit by each tier's last point
    const lastS = lastOf('small');
    g.append('text').attr('class', 'cm-tier').attr('x', x(last.t) + 7).attr('y', y(last.v) + 3).text('frontier');
    g.append('text').attr('class', 'cm-tier').attr('x', x(lastS.t) + 7).attr('y', y(lastS.v) + 3).text('small');
    stage(anim, m);
    hoverOn(m, a, (d) => `${d.d.model}, ${money(d.v)} in and ${money(d.d.output)} out per million tokens, ${fmtWhen(d.d.date)}`, (d) => ({ id: `series:${d.s.id}:${d.i}` }));
    const yrs = last.t - first.t;
    a.querySelector('.cm-find').textContent = `Frontier list price fell from ${money(first.v)} to ${money(last.v)} per million input tokens between ${fmtWhen(first.d.date)} and ${fmtWhen(last.d.date)}, ${Math.round(first.v / last.v)} times cheaper in ${yrs.toFixed(1)} years.`;
    foot(a, F, `${F.points.length + Sm.points.length} price points, last read ${fmtWhen(F.last_reading)}`);
  }

  function drawFlops(anim) {
    const a = el.querySelector('[data-cm="flops"]'); const E = S.flops_per_dollar_epoch; if (!E) return;
    const { svg, w } = svgOf('flops');
    const pts = E.points.map((p, i) => ({ s: E, i, t: tOf(p[0]), v: p[1], name: p[2], r: 4.5 }));
    const x = d3.scaleLinear().domain([2016, 2023.5]).range([M.l, w - M.r]);
    const y = d3.scaleLog().domain([1e9, 4e10]).range([H0 - M.b, M.t]);
    axes(svg, w, x, y, [2016, 2018, 2020, 2022], [1e9, 1e10], (v) => `${v / 1e9 >= 10 ? '10' : '1'}B`);
    // Epoch's rate, about 30 percent a year, as a hairline through the first point
    const rate = svg.append('line').attr('class', 'cm-rate').attr('x1', x(pts[0].t)).attr('y1', y(pts[0].v)).attr('x2', x(2023.3)).attr('y2', y(pts[0].v * 1.3 ** (2023.3 - pts[0].t)));
    rate.append('title').text('about 30 percent a year, the rate Epoch AI states');
    const g = svg.append('g').attr('class', 'cm-marks');
    const m = g.selectAll('circle').data(pts).join('circle').attr('class', (d, i) => `mk${i === 0 || i === pts.length - 1 ? ' key' : ''}`).attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.name}, ${sci(d.v)} FLOP/s per dollar, ${fmtWhen(E.points[d.i][0])}`);
    m.append('title').text((d) => `${d.name}: ${sci(d.v)} FLOP/s per US$, ${fmtWhen(E.points[d.i][0])}`);
    g.selectAll('text.cm-pt').data(pts).join('text').attr('class', 'cm-pt').attr('x', (d) => x(d.t) + (d.i === pts.length - 1 ? -8 : 8)).attr('y', (d) => y(d.v) + (d.i === pts.length - 1 ? 14 : 3)).attr('text-anchor', (d) => (d.i === pts.length - 1 ? 'end' : 'start')).text((d) => d.name.split(' ')[0]);
    stage(anim, m);
    hoverOn(m, a, (d) => `${d.name}: ${sci(d.v)} FLOP/s per dollar, ${fmtWhen(E.points[d.i][0])}`, (d) => ({ id: `series:${E.id}:${d.i}` }));
    const f = pts[0], l = pts[pts.length - 1];
    a.querySelector('.cm-find').textContent = `${l.name.split(' ')[0]} delivers ${Math.round(l.v / f.v)} times the ${f.name.split(' ')[0]}'s performance per dollar, ${(l.t - f.t).toFixed(1)} years apart.`;
    foot(a, E, `${E.points.length} GPUs, data updated ${fmtWhen(E.last_reading)}`);
  }

  function drawPower(anim) {
    const a = el.querySelector('[data-cm="power"]'); const P = S.datacenter_electricity_v3; if (!P) return;
    const { svg, w } = svgOf('power');
    const pts = P.points.map((p, i) => ({ s: P, i, t: p[0], v: p[1], proj: p[0] >= 2030, r: 4.5 }));
    const x = d3.scaleLinear().domain([2023.5, 2030.5]).range([M.l, w - M.r]);
    const y = d3.scaleLinear().domain([0, 1000]).range([H0 - M.b, M.t]);
    axes(svg, w, x, y, [2024, 2026, 2028, 2030], [0, 500, 1000], (v) => (v ? `${v}` : '0'));
    const g = svg.append('g').attr('class', 'cm-marks');
    // the step from the reported years to the projection is a hairline, dashed where it is projected
    g.append('line').attr('class', 'cm-join').attr('x1', x(pts[0].t)).attr('y1', y(pts[0].v)).attr('x2', x(pts[1].t)).attr('y2', y(pts[1].v));
    g.append('line').attr('class', 'cm-join proj').attr('x1', x(pts[1].t)).attr('y1', y(pts[1].v)).attr('x2', x(pts[2].t)).attr('y2', y(pts[2].v));
    const m = g.selectAll('circle').data(pts).join('circle').attr('class', (d) => `mk${d.proj ? ' proj' : ''}${d.i === 1 ? ' key' : ''}`).attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.v} TWh in ${d.t}${d.proj ? ', projection' : ''}`);
    m.append('title').text((d) => `${d.v} TWh in ${d.t}${d.proj ? ' (IEA projection)' : ''}`);
    g.selectAll('text.cm-pt').data(pts).join('text').attr('class', 'cm-pt').attr('x', (d) => x(d.t) + (d.proj ? -8 : 0)).attr('y', (d) => y(d.v) - 9).attr('text-anchor', (d) => (d.proj ? 'end' : 'middle')).text((d) => `${d.v}${d.proj ? ' projected' : ''}`);
    stage(anim, m);
    hoverOn(m, a, (d) => `${d.v} TWh in ${d.t}${d.proj ? ', an IEA projection' : ', reported by the IEA'}`, (d) => ({ id: `series:${P.id}:${d.i}` }));
    const [a24, a25, a30] = pts;
    a.querySelector('.cm-find').textContent = `${a25.v} TWh in ${a25.t}, ${Math.round((a25.v / a24.v - 1) * 100)} percent above ${a24.t}; the IEA projects ${a30.v} TWh by ${a30.t}.`;
    foot(a, P, `${P.points.length} readings, last ${P.last_reading}`);
  }
  function drawTrain(anim) {
    const a = el.querySelector('[data-cm="train"]'); const T = S.frontier_training_compute; if (!T) return;
    const { svg, w } = svgOf('train');
    const pts = T.points.map((p, i) => ({ s: T, i, t: p[0], v: p[1], d: T.detail[i], r: 4 }));
    const x = d3.scaleLinear().domain([2011.5, 2026.5]).range([M.l + 6, w - M.r]);
    const y = d3.scaleLog().domain([1e17, 1e28]).range([H0 - M.b, M.t]);
    axes(svg, w, x, y, [2012, 2016, 2020, 2024], [1e18, 1e21, 1e24, 1e27], (v) => pow10(Math.round(Math.log10(v))));
    const g = svg.append('g').attr('class', 'cm-marks');
    const f = pts[0], l = pts[pts.length - 1];
    const m = g.selectAll('circle').data(pts).join('circle').attr('class', (d) => `mk${d === f || d === l ? ' key' : ''}${d.t === 2026 ? ' part' : ''}`).attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.d.model}, ${sci(d.v)} FLOP, ${d.t}`);
    m.append('title').text((d) => `${d.d.model} (${d.d.org.split(',')[0]}): ${sci(d.v)} FLOP, ${d.t}`);
    stage(anim, m);
    hoverOn(m, a, (d) => `${d.d.model}, ${sci(d.v)} FLOP, ${d.t}${d.t === 2026 ? ' so far' : ''}`, (d) => ({ id: `series:${T.id}:${d.i}` }));
    a.querySelector('.cm-find').textContent = `The largest known run grew from ${sci(f.v)} FLOP in ${f.t} to ${sci(l.v)} in ${l.t}, about ${(l.v / f.v / 1e9).toFixed(1)} billion times in ${l.t - f.t} years.`;
    foot(a, T, `${T.points.length} yearly maxima, CSV read ${fmtWhen(T.source.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '2026-10')}`);
  }

  function drawWatt(anim) {
    const a = el.querySelector('[data-cm="watt"]'); const Wt = S.flop_per_watt_datasheets; if (!Wt) return;
    const { svg, w } = svgOf('watt');
    const pts = Wt.points.map((p, i) => ({ s: Wt, i, t: tOf(p[0]), v: p[1], d: Wt.detail[i], r: 4.5 }));
    const x = d3.scaleLinear().domain([2016, 2025.5]).range([M.l, w - M.r]);
    const y = d3.scaleLog().domain([50, 5000]).range([H0 - M.b, M.t]);
    axes(svg, w, x, y, [2016, 2019, 2022, 2025], [100, 1000], (v) => (v >= 1000 ? `${v / 1000}k` : String(v)));
    const g = svg.append('g').attr('class', 'cm-marks');
    const f = pts[0], l = pts[pts.length - 1];
    const m = g.selectAll('circle').data(pts).join('circle').attr('class', (d) => `mk${d === f || d === l ? ' key' : ''}`).attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.d.chip}, ${Math.round(d.v)} gigaflops per second per watt, ${fmtWhen(d.d.date)}`);
    m.append('title').text((d) => `${d.d.chip}: ${Math.round(d.v)} GFLOP/s per W (${d.d.tflops_dense} TFLOP/s dense, ${d.d.watts} W), ${fmtWhen(d.d.date)}`);
    // short chip names beside the marks; the last two sit left so they stay inside the frame
    // A100 and B200 read to the left, TPU v4 below, H100 above; the rest to the right
    const place = (d) => (d.i === 2 ? { dx: -8, dy: 3, a: 'end' } : d.i === 3 ? { dx: 0, dy: 13, a: 'middle' } : d.i === 4 ? { dx: 0, dy: -8, a: 'middle' } : d.i === 5 ? { dx: -8, dy: 3, a: 'end' } : { dx: 8, dy: 3, a: 'start' });
    g.selectAll('text.cm-pt').data(pts).join('text').attr('class', 'cm-pt').attr('x', (d) => x(d.t) + place(d).dx).attr('y', (d) => y(d.v) + place(d).dy).attr('text-anchor', (d) => place(d).a).text((d) => d.d.chip.split(' ')[0] + (d.d.chip.startsWith('TPU') ? ' v4' : ''));
    stage(anim, m);
    hoverOn(m, a, (d) => `${d.d.chip}: ${Math.round(d.v)} GFLOP/s per W, ${d.d.tflops_dense} TFLOP/s dense at ${d.d.watts} W, ${fmtWhen(d.d.date)}`, (d) => ({ id: `series:${Wt.id}:${d.i}` }));
    a.querySelector('.cm-find').textContent = `${l.d.chip.split(' ')[0]} delivers ${Math.round(l.v / f.v)} times the ${f.d.chip.split(' ')[0]}'s compute per watt, ${(l.t - f.t).toFixed(1)} years apart; NVIDIA lists no per-GPU TDP for the B200, so its figures are SemiAnalysis readings.`;
    foot(a, Wt, `${Wt.points.length} chips, last reading ${fmtWhen(Wt.last_reading)}`);
  }

  function drawVenture(anim) {
    const a = el.querySelector('[data-cm="venture"]'); const V = S.ai_share_venture; if (!V) return;
    const { svg, w } = svgOf('venture');
    const pts = V.points.map((p, i) => ({ s: V, i, t: p[0], v: p[1], d: V.detail[i] }));
    const x = d3.scaleBand().domain(pts.map((p) => String(p.t))).range([M.l + 12, w - M.r - 12]).paddingInner(0.5);
    const y = d3.scaleLinear().domain([0, 60]).range([H0 - M.b, M.t]);
    axes(svg, w, d3.scaleLinear().domain([0, 1]).range([0, 0]), y, [], [0, 25, 50], (v) => `${v}%`);
    svg.append('g').attr('class', 'cm-ax').selectAll('text.xl').data(pts).join('text').attr('class', 'xl').attr('x', (d) => x(String(d.t)) + x.bandwidth() / 2).attr('y', H0 - 6).attr('text-anchor', 'middle').text((d) => String(d.t));
    const g = svg.append('g').attr('class', 'cm-marks');
    const base = H0 - M.b;
    const m = g.selectAll('rect').data(pts).join('rect').attr('class', (d) => `mk bar${d.i === pts.length - 1 ? ' key' : ''}`).attr('x', (d) => x(String(d.t))).attr('width', x.bandwidth()).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.v} percent of venture dollars to AI in ${d.t}, ${d.d.ai_bn} of ${d.d.global_bn} billion dollars`);
    m.append('title').text((d) => `${d.t}: ${d.v}% of venture dollars, $${d.d.ai_bn}B of $${d.d.global_bn}B`);
    // the bars stay ink; the finding's year is marked by its value label (red is annotation, not fill)
    g.selectAll('text.cm-pt').data(pts).join('text').attr('class', (d) => `cm-pt${d.i === pts.length - 1 ? ' key' : ''}`).attr('x', (d) => x(String(d.t)) + x.bandwidth() / 2).attr('y', (d) => y(d.v) - 6).attr('text-anchor', 'middle').text((d) => `${d.v}%`);
    // bars grow from the baseline on the same clock as the marks
    const held = !RM && !seen;
    if (held) m.attr('y', base).attr('height', 0);
    else if (anim && !RM) m.attr('y', base).attr('height', 0).transition('grow').delay((d, i) => i * 60).duration(900).ease(d3.easeCubicOut).attr('y', (d) => y(d.v)).attr('height', (d) => base - y(d.v));
    else m.attr('y', (d) => y(d.v)).attr('height', (d) => base - y(d.v));
    hoverOn(m, a, (d) => `${d.t}: $${d.d.ai_bn}B of $${d.d.global_bn}B in venture funding went to AI, ${d.v} percent`, (d) => ({ id: `series:${V.id}:${d.i}` }));
    const f = pts[0], l = pts[pts.length - 1];
    a.querySelector('.cm-find').textContent = `AI took ${l.v} percent of global venture dollars in ${l.t}, $${l.d.ai_bn}B of $${l.d.global_bn}B, up from ${Math.round(f.v)} percent in ${f.t}.`;
    foot(a, V, `${V.points.length} years, last ${V.last_reading}`);
  }
  function foot(a, s, tail) {
    a.querySelector('.cm-foot').innerHTML = `<a href="${esc(s.source_url)}" target="_blank" rel="noopener">${esc(s.source)}</a><span class="cm-last">${esc(tail)}</span>`;
  }

  function drawAll(anim) {
    if (!S) return;
    drawPrice(anim); drawFlops(anim); drawPower(anim); drawTrain(anim); drawWatt(anim); drawVenture(anim);
    // the finding comes in with the marks (fading from 500ms, read by 900ms) and the focus shift, the finding's marks
    // in red, lands as the grow does at 900ms; both run once, and a redraw during the grow leaves the timers alone
    const show = () => { el.classList.add('grown'); };
    const focus = () => { el.classList.add('grown', 'focused'); drawAll.ft = 0; };
    if (anim && !RM && !grown) { grown = true; setTimeout(show, 500); drawAll.ft = setTimeout(focus, 900); }
    else if (RM || (grown && !drawAll.ft)) focus();
  }

  // in view: 40 percent of the row, or enough of it to fill 40 percent of the viewport
  const inView = (e) => e.isIntersecting && (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= 0.4 * ((e.rootBounds && e.rootBounds.height) || innerHeight));
  const io = 'IntersectionObserver' in window && !RM ? new IntersectionObserver((es) => { if (es.some(inView)) { io.disconnect(); seen = true; if (built) drawAll(true); } }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }) : null;
  if (io) io.observe(el); else seen = true;

  return {
    async build(db) {
      await load(db);
      built = true;
      drawAll(seen);
      if (onReady) onReady();
    },
    resize() { if (built) drawAll(false); },
  };
}
