// E. SENTIMENT WHEEL: years around the circle, hopes outward, fears inward, recurring threads bundled through the hub.
// V2: a region ring and filter, half-century bins before 1926 so the long window is not empty, and a Voyant-style
// term analysis (Cirrus cloud, Trends, Contexts) computed in the browser from the titles and summaries in the window.
import { domainColor, threadColor, prettyTag } from '../palette.js';
import { shortTitle } from '../text.js';
import { passes, drawn, registerFor, neighbors } from '../data.js';
import { state as S, set } from '../store.js';
import { eventTip, esc } from '../ui.js';
import { REGIONS, REGION, regionColor } from '../time.js';
import { drawLit, reduced, whenInView } from '../lit.js';
import { placeLabels } from '../labels.js';

const GAP = 22; // degrees left open at the top for the title of the ring
const BIN_FROM = 1926; // one wedge per year from here; half-century wedges before
const isHope = (e) => e.sentiment > 0 || (e.type === 'hope' && !e.sentiment);
const isFear = (e) => e.sentiment < 0 || ((e.type === 'fear' || e.type === 'failure' || e.type === 'incident') && !e.sentiment);
const mag = (e) => (Math.abs(e.sentiment) || 1) * (0.5 + e.significance * 0.5);
const UNASSIGNED = { id: 'unassigned', label: 'Global or unassigned', short: 'Global', color: '#a59a83' };
const regionOf = (e) => (e.region && REGION[e.region] ? e.region : 'unassigned');
const TERM_TYPES = new Set(['fear', 'hope', 'culture', 'concept']);
const THIN = 25;

/* ---------- text analysis ---------- */
const STOP = new Set(`a an the and or but if then than that this these those there here is are was were be been being am do does did done have has had having of to in on at by for with from as into onto over under about above below between among through during before after since until while within without again further once out off up down not no nor only own same so too very can will just should could would may might must shall let also both each few more most other some such any all every either neither one two three four five six seven eight nine ten first second third last next new old it its it's he she they them his her their theirs we us our ours you your yours i me my mine who whom whose which what when where why how because however whether although though even still yet already ever never often sometimes always rather quite much many less least several another others way ways thing things part parts year years day days time times later early earlier late soon ago per via vs versus than like unlike well`.split(/\s+/));
// curated: generic words that would otherwise dominate a technology corpus
const CURATED = new Set(`technology technologies technological tech system systems world use used uses using user users called known make makes made making become becomes became becoming begin begins began beginning start starts started starting end ends ended set sets lead leads led published publishes publish announce announces announced release releases released launch launches launched introduce introduces introduced describe describes described write writes wrote written say says said show shows showed shown take takes took taken give gives gave given come comes came go goes went get gets got see sees saw seen put find finds found work works worked working based term terms idea ideas including include includes included event events history historical later large small long short high low big major minor key main real general public people person company companies group groups number numbers million millions billion billions thousand thousands hundred hundreds percent percentage case cases example examples form forms kind kinds type types version versions name names word words human humans era age century decade decades modern`.split(/\s+/));
// document-type nouns and bare roles that name the record rather than the feeling in it
const DOCTYPES = new Set('book books paper papers article articles essay essays film films movie movies survey surveys study studies conference conferences president presidents man men woman women people person letter letters speech speeches lecture lectures interview interviews novel novels story stories play plays poll polls magazine newspaper journal review reviews chapter chapters edition editions volume volumes page pages title titled author authors writer writers editor editors publisher publishers reader readers director directors company companies firm firms government governments university universities professor professors scientist scientists researcher researchers engineer engineers program programs project projects group groups member members national international american british public work works word words term terms name names number numbers percent example examples version versions series episode episodes show shows season seasons'.split(' '));
const MONTHS = new Set('month months week weeks appear appeared appears january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday'.split(' '));
const REPORTING = new Set('coin coined coins warn warned warns propose proposed proposes report reported reports argue argued argues conduct conducted present presented premiere premiered create created creates develop developed develops design designed build built found founded form formed open opened close closed hold held host hosted air aired debut debuted screen screened star starred depict depicted portray portrayed feature featured tell told ask asked meet met win won lose lost note noted claim claimed state stated states united york john american effect effects'.split(' '));
const normTok = (w) => {
  let t = w.toLowerCase().replace(/^'+|'+$/g, '').replace(/'s$/, '');
  if (t.length > 4 && /ies$/.test(t)) t = t.slice(0, -3) + 'y';
  else if (t.length > 4 && /(sh|ch|ss|x|z)es$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && /[^s]s$/.test(t) && !/us$|is$/.test(t)) t = t.slice(0, -1);
  return t;
};
export function tokens(text) {
  const out = [];
  for (const w of String(text || '').split(/[^A-Za-z']+/)) {
    if (w.length < 3) continue;
    const t = normTok(w);
    if (t.length < 3 || STOP.has(t) || CURATED.has(t) || MONTHS.has(t) || REPORTING.has(t) || DOCTYPES.has(t) || DOCTYPES.has(w.toLowerCase()) || STOP.has(w.toLowerCase())) continue;
    out.push(t);
  }
  return out;
}
const sentences = (text) => String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter(Boolean);
const mentions = (e, term) => { const re = termRe(term); return re.test(e.title) || re.test(e.summary || ''); };
const termRe = (term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es|ies|'s)?\\b`, 'i');

export default function wheel(el, { db, select, tip }) {
  el.innerHTML = `
    <div class="wh-stage">
      <div class="view-head stacked"><span class="sc">A millennium of feeling about machines</span><h2>Sentiment Wheel</h2>
        <p>Time runs clockwise from the top: one wedge per year from ${BIN_FROM}, one per half-century before. Bars outward are hopes, bars inward are fears, each segment one event sized by intensity and significance. The outer ring colors each event by region; threads through the hub join recurring worries and promises.</p></div>
      <div class="wh-ctl hp-bar"><div class="hp-grp"><span class="sc">Start year</span><input class="hp-in yr" type="number" inputmode="numeric" aria-label="Start year" /><button type="button" class="hp-act" data-rot-reset hidden>Reset</button></div></div>
      <div class="wheel-legend" style="position:absolute;left:16px;top:120px;z-index:3;width:220px"></div>
      <svg role="img" aria-label="Radial chart of hopes and fears by year, with a region ring"></svg>
      <p class="wh-contract"></p>
    </div>
    <aside class="wh-regions" aria-label="Regions"></aside>
    <aside class="wh-inset" aria-label="Hope and fear totals by period, straight bars"></aside>
    <section class="wh-cmp" aria-label="Two regions side by side"><div class="wh-cmp-head"><h2>Side by side</h2><span class="m"></span></div><div class="wh-cmp-grid"></div></section>
    <section class="wh-terms" aria-label="Term analysis">
      <div class="wt-head"><div><h2>Term cloud</h2>
        <p class="dek">Terms from titles and summaries of hope, fear, culture and concept events in the years shown. Hover a term to light the segments mentioning it; click for its contexts.</p></div>
        <div class="wt-meta"></div></div>
      <div class="wt-grid">
        <div class="wt-panel"><h3>Cirrus <small>top 60 terms, sized by frequency</small></h3><div class="wt-cirrus"><svg role="group" aria-label="Word cloud of top 60 terms in selected years, sized by frequency"></svg></div></div>
        <div class="wt-panel"><h3>Trends <small>share of events mentioning a term</small></h3><div class="wt-trends"></div><div class="wt-pick"><div class="hp-chips" aria-label="Tracked terms"></div><input type="text" placeholder="add a term" aria-label="Add a term to Trends" maxlength="24" /></div></div>
        <div class="wt-panel"><h3>Contexts <small class="wt-ctx-n"></small></h3><div class="wt-ctx"><div class="empty">Click a term in the cloud or a trend to read the sentences that use it.</div></div></div>
      </div>
    </section>`;
  const stage = el.querySelector('.wh-stage');
  const legendEl = el.querySelector('.wheel-legend');
  const insetEl = el.querySelector('.wh-inset');
  const fmtInt = (n) => Number(n).toLocaleString('en-US'); // every bare count in the view carries a thousands separator
  const contractEl = el.querySelector('.wh-contract');
  const regionsEl = el.querySelector('.wh-regions');
  const termsEl = el.querySelector('.wh-terms');
  const cirrusEl = el.querySelector('.wt-cirrus');
  const trendsEl = el.querySelector('.wt-trends');
  const pickEl = el.querySelector('.wt-pick input');
  const ctxEl = el.querySelector('.wt-ctx');
  const ctxN = el.querySelector('.wt-ctx-n');
  const metaEl = el.querySelector('.wt-meta');
  const svg = d3.select(stage).select('svg');
  const g = svg.append('g');
  const gRings = g.append('g');
  const gBundles = g.append('g');
  const gRest = g.append('g').style('pointer-events', 'none'); // the hub numeral at rest, under the hover layer
  // Mask reveal (Aesthetic Systems): on first view a hard-edged circle aperture opens from the hub over the whole drawing
  // (rings, bars, region ring, rug, labels); nothing is drawn in, the picture is already there and the mask uncovers it
  const sweepId = `wh-mask-${Math.random().toString(36).slice(2, 8)}`;
  const sweepClip = svg.append('clipPath').attr('id', sweepId).append('circle').attr('cx', 0).attr('cy', 0).attr('r', 0);
  const gSweep = g.append('g');
  const gBars = gSweep.append('g');
  const gRegion = gSweep.append('g');
  const gRug = gSweep.append('g');
  const gLabels = gSweep.append('g');
  const gHi = g.append('g').style('pointer-events', 'none');
  gLabels.attr('class', 'wh-labels');
  svg.on('mouseenter.calls focusin.calls', () => svg.classed('wh-all', true)).on('mouseleave.calls focusout.calls', () => svg.classed('wh-all', false));
  let swept = false, sweeping = false;
  const gLit = g.append('g').style('pointer-events', 'none');
  let LIT = null;
  const relit = () => drawLit(gLit, LIT, (id) => pos.get(id) || null);
  let W, H, R, Rb, R0, cx, cy, ang, mobile, narrow, pos = new Map();
  let bins = [], binOfYear = () => 0, binAng = () => [0, 0];
  let evsNow = [], termDocs = [], region = regionFromMode(), captionSpan = null;
  let trendTerms = ['machine', 'automation', 'privacy', 'nuclear', 'intelligence', 'jobs', 'surveillance', 'robot'];
  let activeTerm = null;
  // in-memory agency: the year at the top of the wheel, and a pair of regions to set side by side
  let startYear = null, cmpMode = false, pair = [];
  const rotIn = el.querySelector('.wh-ctl input'), rotReset = el.querySelector('[data-rot-reset]');
  const setStart = (y) => { startYear = y == null || y <= S.y0 || y > S.y1 ? null : Math.round(y); syncRot(); draw(); };
  rotIn.addEventListener('change', () => setStart(+rotIn.value));
  rotIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { setStart(+rotIn.value); rotIn.blur(); } });
  rotReset.addEventListener('click', () => setStart(null));
  function syncRot() { rotIn.min = S.y0; rotIn.max = S.y1; rotIn.value = startYear == null ? S.y0 : startYear; rotReset.hidden = startYear == null; }

  function regionFromMode() { const m = /^r:(.+)$/.exec(S.mode || ''); return m ? m[1] : ''; }

  function layout() {
    const r = el.getBoundingClientRect();
    mobile = r.width < 760;
    narrow = r.width < 1100;
    FOOT = mobile ? 0 : 48;
    W = r.width;
    const top = 96;
    if (mobile) {
      R = W / 2 - 30;
      H = top + 2 * R + 56;
      cx = W / 2; cy = top + R + 24;
      legendEl.style.cssText = 'position:static;margin:4px 12px 10px';
      stage.style.height = 'auto';
      if (legendEl.nextElementSibling !== contractEl) { stage.appendChild(legendEl); stage.appendChild(contractEl); } // threads list flows under the wheel, the contract closes the page
    } else {
      H = Math.max(520, r.height);
      const rightCol = narrow ? 0 : 270;
      // the contract footer takes a 48px band at the bottom of the stage; the wheel centres in what is left
      R = Math.max(120, Math.min((H - FOOT - 24) / 2 - 128, (W - 300 - rightCol) / 2 - 150));
      cx = 300 + (W - 300 - rightCol) / 2; cy = (H - FOOT) / 2 + 4;
      legendEl.style.cssText = 'position:absolute;left:16px;top:324px;z-index:3;width:250px;max-height:calc(100% - 340px);overflow:auto';
      if (legendEl.nextElementSibling !== svg.node()) stage.insertBefore(legendEl, svg.node());
      stage.style.height = `${H}px`;
    }
    Rb = R * 0.62; R0 = Math.max(R * 0.34, Math.min(66, R * 0.42)); // the hub never shrinks below the size that keeps its numeral six times its label
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block');
    g.attr('transform', `translate(${cx},${cy})`);
  }
  const xy = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r];
  let labeled = new Set(), segAng = new Map();
  const mctx = document.createElement('canvas').getContext('2d');
  let FOOT = 0; // height of the fixed contract band under the wheel (0 when it flows below the stage on narrow screens)
  const RIM = () => R + 14;
  // longest label that stays inside the drawing area along its ray
  const roomAt = (a) => {
    const dx = Math.sin(a), dy = -Math.cos(a), r0 = RIM(), lim = [];
    if (dx > 1e-3) lim.push((W - cx - 6) / dx - r0); if (dx < -1e-3) lim.push((-cx + 6) / dx - r0);
    if (dy > 1e-3) lim.push((H - FOOT - cy - 6) / dy - r0); if (dy < -1e-3) lim.push((-cy + 6) / dy - r0);
    return Math.max(0, Math.min(...lim));
  };
  const fitT = (t, w) => { if (mctx.measureText(t).width <= w) return t; let x = t; while (x.length > 6 && mctx.measureText(x + '\u2026').width > w) x = x.slice(0, -1); return x.trimEnd() + '\u2026'; };
  function rimLabel(gg, e, a, hover) {
    const size = mobile ? 10 : 10.5;
    mctx.font = `${hover ? '600 ' : ''}${size}px Instrument Sans, serif`;
    const room = roomAt(a);
    if (room < 60) return false;
    const deg = (a * 180) / Math.PI, flip = deg > 180;
    const [x, y] = xy(a, RIM());
    // the short title when the full one does not fit along the ray; if even that does not fit, no label (the dot and hover remain)
    const maxW = hover ? Math.min(room, 320) : Math.min(room, 190);
    let t = e.title;
    if (mctx.measureText(t).width > maxW) t = shortTitle(e);
    if (mctx.measureText(t).width > maxW) { if (!hover) return false; t = fitT(t, maxW); }
    const tx = gg.append('text').attr('transform', `translate(${x},${y}) rotate(${flip ? deg + 90 : deg - 90})`).attr('text-anchor', flip ? 'end' : 'start').attr('dy', '0.35em')
      .attr('font-family', 'Instrument Sans, serif').attr('font-size', size).attr('font-weight', hover ? 600 : null).attr('fill', isFear(e) ? '#a02a24' : '#5c4a10')
      .attr('paint-order', 'stroke').attr('stroke', '#f7f7f5').attr('stroke-width', hover ? 4 : 2.5).attr('stroke-linejoin', 'round').attr('data-id', e.id).attr('data-a', a).text(t);
    if (!hover) tx.style('cursor', 'pointer').on('click', () => select(e.id)).on('mouseenter', (ev) => { tip.show(ev, eventTip(e)); hi(e.id); }).on('mouseleave', () => { tip.hide(); hi(S.sel || null); });
    return true;
  }

  // wedges: one per year from BIN_FROM, one per half-century before, clipped to the window
  function makeBins() {
    const out = [];
    let y = S.y0;
    while (y <= S.y1) {
      if (y < BIN_FROM) { const e = Math.min(BIN_FROM, Math.floor(y / 50) * 50 + 50); out.push({ y0: y, y1: Math.min(e, S.y1 + 1), half: true }); y = e; }
      else { out.push({ y0: y, y1: y + 1, half: false }); y += 1; }
    }
    return out;
  }
  const inRegion = (e) => !region || (region === 'unassigned' ? regionOf(e) === 'unassigned' || e.region === 'global' : e.region === region);

  function draw(light) {
    captionSpan = null;
    const base = db.events.filter((e) => drawn(e) && e.year >= S.y0 && e.year <= S.y1);
    const evs = base.filter(inRegion);
    evsNow = evs;
    bins = makeBins();
    // a chosen start year turns the wheel: its wedge sits first after the gap, earlier wedges follow the latest ones
    if (startYear != null) { const k = bins.findIndex((b) => startYear >= b.y0 && startYear < b.y1); if (k > 0) bins = [...bins.slice(k), ...bins.slice(0, k)]; }
    const binIdx = new Int16Array(S.y1 - S.y0 + 2);
    bins.forEach((b, i) => { for (let yy = b.y0; yy < b.y1; yy++) binIdx[yy - S.y0] = i; });
    const binOf = (t) => binIdx[Math.max(0, Math.min(binIdx.length - 1, Math.floor(t) - S.y0))];
    const cnt = new Array(bins.length).fill(0);
    evs.forEach((e) => cnt[binOf(e.year)]++);
    // angular axis: each wedge gets a base share plus room for its activity; empty half-century wedges stay thin
    const wts = bins.map((b, i) => (b.half ? (cnt[i] ? 1.6 + 0.55 * Math.sqrt(cnt[i]) : 0.8) : cnt[i] ? 1 + 0.55 * Math.sqrt(cnt[i]) : region ? 0.45 : 1));
    const cum = [0]; wts.forEach((w) => cum.push(cum[cum.length - 1] + w));
    const a0r = (GAP / 2) * Math.PI / 180, a1r = (360 - GAP / 2) * Math.PI / 180, tot = cum[cum.length - 1];
    sweepIn();
    ang = (t) => { const i = Math.max(0, Math.min(bins.length - 1, binOf(Math.max(S.y0, Math.min(S.y1 + 0.999, t))))); const b = bins[i]; const f = Math.max(0, Math.min(1, (t - b.y0) / (b.y1 - b.y0))); return a0r + ((cum[i] + f * wts[i]) / tot) * (a1r - a0r); };
    const angBin = (i) => [a0r + (cum[i] / tot) * (a1r - a0r), a0r + (cum[i + 1] / tot) * (a1r - a0r)];
    binOfYear = binOf; binAng = angBin;
    // scale: max stacked magnitude per wedge on each side
    const key = (e) => binOf(e.year);
    const hs = d3.rollup(evs.filter(isHope), (v) => d3.sum(v, mag), key);
    const fs = d3.rollup(evs.filter(isFear), (v) => d3.sum(v, mag), key);
    const hm = Math.max(2, d3.max([...hs.values()]) || 0), fm = Math.max(2, d3.max([...fs.values()]) || 0);
    Rb = R0 + (R - R0) * Math.max(0.38, Math.min(0.72, fm / (hm + fm)));
    const k = Math.min((R - Rb - 6) / Math.sqrt(hm), (Rb - R0 - 6) / Math.sqrt(fm));
    const sq = (T) => (T > 0 ? (k * Math.sqrt(T)) / T : 0);

    // rings and ticks
    gRings.selectAll('*').remove();
    [R0, Rb, R].forEach((r, i) => gRings.append('circle').attr('r', r).attr('fill', 'none').attr('stroke', i === 1 ? 'rgba(28,26,23,.55)' : 'rgba(28,26,23,.14)').attr('stroke-width', i === 1 ? 1 : 0.8));
    const hub = gRings.append('circle').attr('r', R0).attr('fill', 'rgba(28,26,23,.03)').attr('class', 'wh-rot');
    const rim = gRings.append('circle').attr('r', R + 5).attr('fill', 'none').attr('stroke', 'rgba(28,26,23,.08)').attr('stroke-width', 6).attr('class', 'wh-rot');
    // dragging the hub or the outer ring turns the wheel: the wedge under the pointer follows it
    const angAt = (ev) => { const [px, py] = d3.pointer(ev, g.node()); let a = Math.atan2(px, -py); if (a < 0) a += 2 * Math.PI; return a; };
    const binAt = (a) => { let lo = 0, hi = bins.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (angBin(m)[1] <= a) lo = m + 1; else hi = m; } return lo; };
    let rotFrom = null;
    const rot = d3.drag().clickDistance(3)
      .on('start', (ev) => { rotFrom = { y: bins[binAt(angAt(ev))].y0 }; d3.select(ev.sourceEvent.target).classed('grabbing', true); })
      .on('drag', (ev) => {
        if (!rotFrom) return;
        const now = binAt(angAt(ev));
        const cur = bins.findIndex((b) => b.y0 === rotFrom.y);
        if (cur === now) return;
        // the grabbed wedge moves to index `now`: rotate so that bins[cur - now] comes first
        const n = bins.length, k = ((cur - now) % n + n) % n;
        const first = bins[k];
        startYear = first.y0 <= S.y0 ? null : first.y0;
        syncRot(); draw(true);
      })
      .on('end', () => { if (!rotFrom) return; rotFrom = null; gRings.selectAll('.grabbing').classed('grabbing', false); draw(); });
    hub.call(rot); rim.call(rot);
    const yearBins = bins.filter((b) => !b.half);
    const step = yearBins.length > 60 ? 10 : yearBins.length > 25 ? 5 : 1;
    const tickAt = (y, strong, big) => {
      const a = ang(y);
      const [x1, y1] = xy(a, R0), [x2, y2] = xy(a, R + 8);
      gRings.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', strong ? 'rgba(28,26,23,.32)' : 'rgba(28,26,23,.1)');
      const [tx, ty] = xy(a, Rb);
      const deg = (a * 180) / Math.PI;
      const flip = deg > 90 && deg < 270;
      gRings.append('text').attr('transform', `translate(${tx},${ty}) rotate(${flip ? deg + 180 : deg})`).attr('dy', flip ? '1.15em' : '-0.45em')
        .attr('text-anchor', 'middle').attr('font-family', big ? 'Instrument Serif, serif' : 'Instrument Sans, monospace')
        .attr('font-size', big ? 15 : 10.5).attr('fill', '#6e6e6a').attr('paint-order', 'stroke').attr('stroke', '#f7f7f5').attr('stroke-width', 3).text(y);
    };
    const minTick = 34 / Rb; // radians between tick labels at the baseline
    let lastTick = a0r + 0.16 - minTick; // no tick label hard against the gap, where HOPE and FEAR sit
    bins.forEach((b, i) => {
      if (b.half) {
        const [a0, a1] = angBin(i);
        if (b.y0 % 50 === 0 || i === 0) { const a = ang(b.y0); if (a - lastTick >= minTick) { tickAt(b.y0, b.y0 % 100 === 0, b.y0 % 500 === 0); lastTick = a; } }
        // a faint wedge boundary so grouped half-centuries read as bins
        const [x1, y1] = xy(a1, R0), [x2, y2] = xy(a1, R);
        gRings.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'rgba(28,26,23,.08)');
      } else if (b.y0 % step === 0) {
        const a = ang(b.y0); if (a - lastTick >= minTick) { tickAt(b.y0, b.y0 % 50 === 0, b.y0 % 50 === 0); lastTick = a; }
      }
    });
    if (bins.some((b) => b.half)) {
      // a bracket just outside the region ring marks the half-century wedges
      const hb = bins.filter((b) => b.half);
      const runs = []; bins.forEach((b, i) => { if (!b.half) return; const r = runs[runs.length - 1]; if (r && r.end === i - 1) r.end = i; else runs.push({ start: i, end: i }); });
      runs.forEach((r) => gRings.append('path').attr('d', d3.arc()({ innerRadius: R + 10, outerRadius: R + 11, startAngle: angBin(r.start)[0], endAngle: angBin(r.end)[1] })).attr('fill', '#6e6e6a'));
      const big = runs.reduce((p, q) => (q.end - q.start > p.end - p.start ? q : p));
      const a0 = angBin(big.start)[0], a1 = angBin(big.end)[1];
      // the caption is a ray like the rim labels where there is room; near the top (where the REGION RING title sits and
      // the stage edge is close) or where its ray would be cut, it runs horizontally beside the bracket instead
      const am = (a0 + a1) / 2, deg = (am * 180) / Math.PI, nearTop = Math.min(am, 2 * Math.PI - am) < 0.3;
      const capText = `${S.y0} to ${BIN_FROM - 1}: ${hb.length} half-century wedge${hb.length === 1 ? '' : 's'}`;
      mctx.font = '8.5px Instrument Sans, monospace';
      const capW = mctx.measureText(capText).width + 4;
      const capStyle = (t) => t.attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.06em').attr('fill', '#6e6e6a').attr('paint-order', 'stroke').attr('stroke', '#f7f7f5').attr('stroke-width', 3).attr('dy', '0.35em');
      captionSpan = null;
      if (!mobile && (nearTop || roomAt(am) - 4 < capW)) {
        const right = am < Math.PI;
        let [hx, hy] = xy(am, R + 16);
        if (nearTop) hx = right ? Math.max(hx, 44) : Math.min(hx, -44);
        capStyle(gRings.append('text')).attr('x', hx).attr('y', hy).attr('text-anchor', right ? 'start' : 'end').text(capText);
        // the angular footprint of the horizontal box, so rim labels keep clear of it
        const xs = [hx, hx + (right ? capW : -capW)], ys = [hy - 6, hy + 6], as = [];
        xs.forEach((x) => ys.forEach((y) => { let a = Math.atan2(x, -y); if (a < 0) a += 2 * Math.PI; as.push(a); }));
        captionSpan = [Math.min(...as), Math.max(...as)];
      } else if (!mobile) {
        const [lx, ly] = xy(am, R + 13);
        capStyle(gRings.append('text')).attr('transform', `translate(${lx},${ly}) rotate(${deg > 180 ? deg + 90 : deg - 90})`).attr('text-anchor', deg > 180 ? 'end' : 'start').text(capText);
        captionSpan = [am, am];
      }
    }
    // labels for the gap
    gRings.append('text').attr('x', 0).attr('y', -Rb - (R - Rb) * 0.5).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', '#7d6410').text('HOPE');
    gRings.append('text').attr('x', 0).attr('y', -Rb + (Rb - R0) * 0.5).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', '#a02a24').text('FEAR');
    gRings.append('path').attr('d', `M-4,${-Rb - 14}l4,-6l4,6M-4,${-Rb + 14}l4,6l4,-6`).attr('fill', 'none').attr('stroke', '#6e6e6a');
    gRings.append('text').attr('x', 0).attr('y', -R - 9).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', '#6e6e6a').text('REGION RING');

    // stacked bar segments
    const segs = [], ring = [];
    pos = new Map(); segAng = new Map();
    const byBin = d3.group(evs, key);
    for (const [bi, list] of byBin) {
      const [ba0, ba1] = angBin(bi);
      const bw = (ba1 - ba0) * 0.8, a0 = ba0 + ((ba1 - ba0) - bw) / 2;
      const outK = sq(hs.get(bi) || 0), inK = sq(fs.get(bi) || 0);
      let o = Rb + 2, i = Rb - 2;
      list.filter(isHope).sort((a, b) => b.significance - a.significance).forEach((e) => { const l = mag(e) * outK; segs.push({ e, a0, a1: a0 + bw, r0: o, r1: o + l - 0.6 }); segAng.set(e.id, a0 + bw / 2); pos.set(e.id, xy(a0 + bw / 2, o + l / 2)); o += l; });
      list.filter(isFear).sort((a, b) => b.significance - a.significance).forEach((e) => { const l = mag(e) * inK; segs.push({ e, a0, a1: a0 + bw, r0: i - l + 0.6, r1: i }); segAng.set(e.id, a0 + bw / 2); pos.set(e.id, xy(a0 + bw / 2, i - l / 2)); i -= l; });
      list.filter((e) => !isHope(e) && !isFear(e)).forEach((e) => pos.set(e.id, xy(ang(e.t), Rb)));
      // region ring: the wedge split equally among its events, grouped by region
      const sorted = list.slice().sort((a, b) => regionOf(a).localeCompare(regionOf(b)));
      const sw = (ba1 - ba0) / sorted.length;
      sorted.forEach((e, j) => ring.push({ e, a0: ba0 + j * sw, a1: ba0 + (j + 1) * sw, reg: regionOf(e) }));
    }
    const arcG = d3.arc().innerRadius((d) => d.r0).outerRadius((d) => d.r1).startAngle((d) => d.a0).endAngle((d) => d.a1);
    gBars.selectAll('path').data(segs, (d) => d.e.id).join('path').attr('d', arcG)
      .attr('fill', (d) => domainColor(d.e.domain)).attr('stroke', 'var(--ground)').attr('stroke-width', 0.4).style('cursor', 'pointer')
      .on('mouseenter', (ev, d) => { tip.show(ev, eventTip(d.e)); hi(d.e.id); }).on('mousemove', tip.move)
      .on('mouseleave', () => { tip.hide(); hi(S.sel || null); }).on('click', (ev, d) => select(d.e.id));
    const arcR = d3.arc().innerRadius(R + 2).outerRadius(R + 8).startAngle((d) => d.a0).endAngle((d) => d.a1);
    gRegion.selectAll('path').data(ring, (d) => d.e.id).join('path').attr('d', arcR)
      .attr('fill', (d) => (d.reg === 'unassigned' ? UNASSIGNED.color : regionColor(d.reg))).attr('fill-opacity', (d) => (d.reg === 'unassigned' ? 0.28 : 0.95)).style('cursor', 'pointer')
      .on('mouseenter', (ev, d) => { tip.show(ev, `<div class="k">${esc((d.reg === 'unassigned' ? UNASSIGNED : REGION[d.reg]).label)}</div><div class="h">${esc(d.e.title)}</div><div class="m">${d.e.year}${d.reg === 'unassigned' ? ' &middot; no region recorded for this event yet' : ''}</div>`); hi(d.e.id); })
      .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); hi(S.sel || null); }).on('click', (ev, d) => select(d.e.id));
    // rug of neutral events on the baseline
    const neutral = evs.filter((e) => !isHope(e) && !isFear(e));
    gRug.selectAll('line').data(neutral, (d) => d.id).join('line').each(function (e) {
      const a = ang(e.t);
      const [x1, y1] = xy(a, Rb - 1.5 - e.significance * 0.6), [x2, y2] = xy(a, Rb + 1.5 + e.significance * 0.6);
      d3.select(this).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
    }).attr('stroke', (e) => domainColor(e.domain)).attr('stroke-width', 1).attr('opacity', 0.5).style('cursor', 'pointer')
      .on('mouseenter', (ev, e) => { tip.show(ev, eventTip(e)); hi(e.id); }).on('mousemove', tip.move)
      .on('mouseleave', () => { tip.hide(); hi(S.sel || null); }).on('click', (ev, e) => select(e.id));

    // rim labels only for significance 5 hopes and fears; any other bar gets its label on hover
    gLabels.selectAll('*').remove();
    labeled = new Set();
    const strong = evs.filter((e) => (isHope(e) || isFear(e)) && e.significance >= 5).sort((a, b) => mag(b) - mag(a));
    const minSep = Math.max(2.6 * Math.PI / 180, 16 / RIM());
    const maxN = mobile ? 0 : 40;
    // the rim labels are rays at one radius, so the shared placer runs on the angle axis (thousandths of a radian):
    // each label is a box one separation wide, the half-century caption (a ray at the same radius) is an obstacle,
    // and every box is mirrored by 2 pi so nothing collides across the gap at the top
    const K = 1000, turn = 2 * Math.PI * K;
    const abox = (a) => ({ x1: (a - minSep / 2) * K, y1: 0, x2: (a + minSep / 2) * K, y2: 1 });
    const mirrored = (b) => [b, { ...b, x1: b.x1 + turn, x2: b.x2 + turn }, { ...b, x1: b.x1 - turn, x2: b.x2 - turn }];
    const obstacles = captionSpan == null ? [] : mirrored({ x1: (captionSpan[0] - minSep / 2) * K, y1: 0, x2: (captionSpan[1] + minSep / 2) * K, y2: 1 });
    const items = strong.map((e) => { const a = ang(e.t); return { e, a, w: minSep * K, h: 1, pri: mag(e), cands: [[(a - minSep / 2) * K, 0]] }; });
    placeLabels(items, { obstacles, gap: 0 });
    const taken = [];
    let n = 0;
    for (const it of items.sort((p, q) => q.pri - p.pri)) {
      if (it.hidden || n >= maxN) continue;
      if (taken.some((b) => it.box.x1 < b.x2 && it.box.x2 > b.x1)) continue; // the mirrored copies of labels already placed
      if (!rimLabel(gLabels, it.e, it.a, false)) continue;
      // at rest the ring carries one primary and two secondary callouts; the rest of the placed set shows while the
      // pointer or focus is on the wheel (class on the group, opacity in CSS)
      gLabels.node().lastElementChild.classList.add(n === 0 ? 'wh-call-1' : n < 3 ? 'wh-call-2' : 'wh-call-more');
      taken.push(...mirrored(it.box).slice(1));
      labeled.add(it.e.id); n++;
    }
    // empty-region notice inside the hub
    gRings.selectAll('.empty-note').remove();
    if (!evs.length) gRings.append('text').attr('class', 'empty-note').attr('x', 0).attr('y', 0).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, serif').attr('font-size', 13).attr('fill', '#6e6e6a').text('No events here in these years');

    // thread bundles through the hub (only the picked thread), then the hub numeral at rest
    drawBundles(db.events.filter((e) => drawn(e, { ...S, thread: '' }) && e.year >= S.y0 && e.year <= S.y1 && inRegion(e)));
    hubRest();
    relit();
    if (light) return; // mid-drag: the text panels wait for the pointer to lift
    drawRegions(base);
    drawInset(evs);
    contract(base, evs);
    drawCompare(base);
    analyze();
  }


  /* ---------- first view: the wedges sweep in clockwise from the top, in year order ---------- */
  function sweepIn() {
    if (swept || sweeping) return;
    if (reduced()) { swept = true; return; }
    sweeping = true;
    // the aperture ends at the far corner of the stage, so it clears everything, including the rim labels
    const rEnd = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    sweepClip.attr('cx', 0).attr('cy', 0).attr('r', 0);
    g.attr('clip-path', `url(#${sweepId})`);
    whenInView(stage, () => {
      const dur = 1400, t0 = performance.now();
      const tick = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / dur)), e = d3.easeExpOut(k); // frame stamps can precede t0
        sweepClip.attr('r', Math.max(0, rEnd * e));
        if (k < 1) requestAnimationFrame(tick); else { g.attr('clip-path', null); swept = true; sweeping = false; }
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- hairline leaders from a named anchor in the hub to each lit segment ---------- */
  function leaders(ids, label, sub) {
    const pts = ids.map((id) => pos.get(id)).filter(Boolean);
    if (!pts.length) return;
    // a burst of lines would hide the wheel, so the twelve strongest events get a leader and every match keeps a dot
    const lit = ids.map((id) => ({ id, e: db.byId.get(id), p: pos.get(id) })).filter((d) => d.e && d.p).sort((a, b) => mag(b.e) - mag(a.e));
    const lined = lit.slice(0, 12);
    const from = (p) => { const r = Math.hypot(p[0], p[1]) || 1; return [(p[0] / r) * (R0 - 2), (p[1] / r) * (R0 - 2)]; };
    const L = gHi.selectAll('path.wh-leader').data(lined, (d) => d.id).join('path').attr('class', 'wh-leader')
      .attr('d', (d) => { const a = from(d.p); return `M${a[0]},${a[1]}L${d.p[0]},${d.p[1]}`; });
    gHi.selectAll('circle.wh-leader-pt').data(lit, (d) => d.id).join('circle').attr('class', 'wh-leader-pt').attr('cx', (d) => d.p[0]).attr('cy', (d) => d.p[1]).attr('r', 2.2);
    if (!reduced()) L.each(function () { const len = this.getTotalLength(); d3.select(this).attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().duration(260).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0); });
    gRest.attr('opacity', 0); // the thread or term name takes the hub while the leaders are lit
    const hub = gHi.append('g').attr('class', 'wh-hub-lab');
    hub.append('circle').attr('r', R0 - 3).attr('fill', 'var(--ground)').attr('fill-opacity', 0.92);
    const fs = Math.min(26, Math.max(12, (R0 * 1.5) / Math.max(4, label.length)));
    if (R0 < 46) sub = '';
    hub.append('text').attr('text-anchor', 'middle').attr('dy', sub ? '-0.1em' : '0.35em').attr('font-family', 'Instrument Serif, serif').attr('font-size', fs).attr('fill', 'var(--ink)').text(label);
    if (sub) hub.append('text').attr('text-anchor', 'middle').attr('dy', '1.3em').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', 'var(--ink-2)').text(sub);
  }

  /* ---------- straight inset: hope against fear per period, paired with the radial overview ---------- */
  function drawInset(evs) {
    const span = S.y1 - S.y0 + 1;
    const step = span <= 220 ? 10 : span <= 700 ? 50 : 100;
    const periodOf = (y) => Math.floor(y / step) * step;
    const hs = d3.rollup(evs.filter(isHope), (v) => d3.sum(v, mag), (e) => periodOf(e.year));
    const fs = d3.rollup(evs.filter(isFear), (v) => d3.sum(v, mag), (e) => periodOf(e.year));
    const hn = d3.rollup(evs.filter(isHope), (v) => v.length, (e) => periodOf(e.year));
    const fn = d3.rollup(evs.filter(isFear), (v) => v.length, (e) => periodOf(e.year));
    const p0 = periodOf(S.y0), p1 = periodOf(S.y1);
    const periods = d3.range(p0, p1 + 1, step);
    // 220px tall on the wide layout so the straight reading can be read before the radial (LIFT_CRITIQUE_2.md, fix 11); shorter when it flows under the wheel and scales to the column
    const wide = el.clientWidth >= 1100;
    // on a short stage the inset gives up height first, down to 160px, before the stage grows past the view
    let insetTop = 0;
    const chrome = 50; // the caption above the bars and the one-line how-to-read below them
    const measureTop = () => regionsEl.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop + 12;
    regionsEl.classList.remove('wh-short');
    if (wide) { insetTop = measureTop(); if (H - FOOT - 8 - insetTop - chrome < 220) { regionsEl.classList.add('wh-short'); insetTop = measureTop(); } }
    const room = wide ? H - FOOT - 8 - insetTop - chrome : 0;
    // the inset holds 220px on the wide layout (LIFT_CRITIQUE_4.md); the region note, not the inset, gives way on a short stage
    const Wi = 236, Hi = wide ? 220 : 120, m = { l: 4, r: 4, t: 16, b: 16 };
    const mid = m.t + (Hi - m.t - m.b) * 0.5;
    const mx = Math.max(1, d3.max(periods, (p) => Math.max(hs.get(p) || 0, fs.get(p) || 0)));
    const x = d3.scaleBand().domain(periods).range([m.l, Wi - m.r]).paddingInner(0.25);
    // square-root heights: the record is a hundred times denser after 1950, and a linear bar would hide every earlier period
    const yh = d3.scaleSqrt().domain([0, mx]).range([0, mid - m.t]);
    const yf = d3.scaleSqrt().domain([0, mx]).range([0, Hi - m.b - mid]);
    const topH = periods.reduce((a, p) => ((hs.get(p) || 0) > (hs.get(a) || 0) ? p : a), periods[0]);
    const topF = periods.reduce((a, p) => ((fs.get(p) || 0) > (fs.get(a) || 0) ? p : a), periods[0]);
    const unit = step === 10 ? 'decade' : step === 50 ? 'half-century' : 'century';
    const nm = (p) => (step === 10 ? `${p}s` : `${p}`);
    insetEl.innerHTML = `<span class="sc">Hope against fear, by ${unit}</span>`;
    if (wide) insetEl.style.top = `${insetTop}px`; else insetEl.style.top = '';
    const sv = d3.select(insetEl).append('svg').attr('viewBox', `0 0 ${Wi} ${Hi}`).attr('width', Wi).attr('height', Hi).attr('role', 'img').attr('aria-label', `Summed hope and fear intensity per ${unit}, hope above the line and fear below`);
    sv.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', Wi - m.r).attr('y1', mid).attr('y2', mid);
    const row = sv.append('g').selectAll('g').data(periods).join('g').attr('transform', (p) => `translate(${x(p)},0)`).style('cursor', 'default')
      .on('mouseenter', (ev, p) => tip.show(ev, `<div class="k">${nm(p)}</div><div class="m">${hn.get(p) || 0} hope${(hn.get(p) || 0) === 1 ? '' : 's'} &middot; ${fn.get(p) || 0} fear${(fn.get(p) || 0) === 1 ? '' : 's'}</div>`)).on('mousemove', tip.move).on('mouseleave', tip.hide);
    row.append('rect').attr('x', 0).attr('width', x.bandwidth()).attr('y', m.t).attr('height', Hi - m.t - m.b).attr('fill', 'transparent');
    const hb = row.append('rect').attr('class', 'hb').attr('x', 0).attr('width', x.bandwidth()).attr('fill', '#c9a86a').attr('y', (p) => mid - yh(hs.get(p) || 0)).attr('height', (p) => yh(hs.get(p) || 0));
    const fb = row.append('rect').attr('class', 'fb').attr('x', 0).attr('width', x.bandwidth()).attr('fill', '#a02a24').attr('y', mid + 0.5).attr('height', (p) => yf(fs.get(p) || 0));
    // direct labels on the two extremes, no legend: the words sit where the bars are
    sv.append('text').attr('x', x(topH) + x.bandwidth() / 2).attr('y', m.t - 4).attr('text-anchor', x(topH) > Wi * 0.7 ? 'end' : x(topH) < Wi * 0.3 ? 'start' : 'middle').attr('class', 'n').text(`hope peaks ${nm(topH)}`);
    sv.append('text').attr('x', x(topF) + x.bandwidth() / 2).attr('y', Hi - 4).attr('text-anchor', x(topF) > Wi * 0.7 ? 'end' : x(topF) < Wi * 0.3 ? 'start' : 'middle').attr('class', 'n').text(`fear peaks ${nm(topF)}`);
    const first = periods[0], last = periods[periods.length - 1];
    if (x(first) + 40 < x(topH) || x(first) + 40 < x(topF)) sv.append('text').attr('x', m.l).attr('y', mid + 3.5).attr('text-anchor', 'start').attr('paint-order', 'stroke').attr('stroke', 'var(--ground)').attr('stroke-width', 3).text(nm(first));
    if (x(last) - 40 > x(topH) && x(last) - 40 > x(topF)) sv.append('text').attr('x', Wi - m.r).attr('y', mid + 3.5).attr('text-anchor', 'end').attr('paint-order', 'stroke').attr('stroke', 'var(--ground)').attr('stroke-width', 3).text(nm(last));
    d3.select(insetEl).append('p').attr('class', 'how').text(`Hope above, fear below; square-root scale.`);
    // the inset sits under the region list; only when the list and a 160px inset still overrun a short stage does the
    // stage grow, and then by the remainder alone, so the contract footer stays as close to the fold as the column allows
    if (wide) { const need = insetTop + insetEl.offsetHeight + FOOT + 8; if (need > H) { H = need; stage.style.height = `${H}px`; svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`); } }
    if (!reduced() && !insetEl.dataset.shown) {
      // first view: bars grow from the baseline in year order, left to right
      hb.attr('y', mid).attr('height', 0); fb.attr('height', 0);
      whenInView(insetEl, () => {
        insetEl.dataset.shown = '1';
        hb.transition().delay((p, i) => i * (500 / periods.length)).duration(400).ease(d3.easeCubicOut).attr('y', (p) => mid - yh(hs.get(p) || 0)).attr('height', (p) => yh(hs.get(p) || 0));
        fb.transition().delay((p, i) => i * (500 / periods.length)).duration(400).ease(d3.easeCubicOut).attr('height', (p) => yf(fs.get(p) || 0));
      });
    } else insetEl.dataset.shown = '1';
  }


  /* ---------- encoding contract and source footer: what the marks mean, what the denominator is, where it comes from ---------- */
  const fmtN = (n) => n.toLocaleString('en-US');
  function contract(base, evs) {
    const sent = evs.filter((e) => isHope(e) || isFear(e)).length; // the wedges' base, the same count the hub and the region list use
    const scope = region ? (region === 'unassigned' ? UNASSIGNED.label : REGION[region]?.label || region) : 'all regions';
    const srcN = evs.filter((e) => (Array.isArray(e.sources) && e.sources.length) || e.source || e.url).length;
    contractEl.innerHTML = `<span>Reading: one wedge per year from ${BIN_FROM}, half-century wedges before, clockwise from the top; a bar is one event, outward for hope, inward for fear, length is intensity \u00d7 significance; the outer ring is region.</span><span>Denominator: ${registerFor(S) === 'landmarks' ? `${fmtN(sent)} landmarks of ${fmtN(evs.length)}` : `${fmtN(sent)} of ${fmtN(evs.length)} events`} in ${S.y0} to ${S.y1} (${esc(scope)}) carry a recorded hope or fear and draw the wheel; the rest are not shown.${registerFor(S) === 'landmarks' ? (() => { const all = db.events.filter((e) => e.kind !== 'overlay' && passes(e) && e.year >= S.y0 && e.year <= S.y1 && inRegion(e)); return ` Under All, the whole record draws: ${fmtN(all.filter((e) => isHope(e) || isFear(e)).length)} of ${fmtN(all.length)}.`; })() : ''}</span><span>Source: the event records, ${fmtN(srcN)} with their own citations; sentiment, intensity and significance are fields of each record.</span>`;
  }

  /* ---------- regions ---------- */
  function drawRegions(all) {
    const base = all.filter((e) => isHope(e) || isFear(e)); // the list counts the wheel's own base, not the whole record
    const counts = new Map();
    base.forEach((e) => { const r = regionOf(e) === 'unassigned' || e.region === 'global' ? 'unassigned' : e.region; counts.set(r, (counts.get(r) || 0) + 1); });
    const list = REGIONS.filter((r) => r.id !== 'global').map((r) => ({ ...r, n: counts.get(r.id) || 0 }));
    list.push({ ...UNASSIGNED, n: counts.get('unassigned') || 0 });
    const assigned = base.length - (counts.get('unassigned') || 0);
    const cur = region ? list.find((r) => r.id === region) : null;
    regionsEl.innerHTML = `<span class="sc">Regions &middot; ${cmpMode ? 'pick two' : 'click to filter'}</span>
      <button type="button" data-r="" aria-pressed="${!region}"><i style="--c:#121212"></i><span>All regions</span><span class="n">${fmtInt(base.length)}</span></button>` +
      list.map((r) => `<button type="button" data-r="${r.id}" aria-pressed="${region === r.id}" class="${cmpMode && pair.includes(r.id) ? 'cmp' : ''}" style="${r.n ? '' : 'opacity:.55'}"><i style="--c:${r.color}"></i><span>${esc(r.label)}</span><span class="n">${fmtInt(r.n)}</span></button>`).join('') +
      `<div class="hp-bar" style="margin-top:8px"><button type="button" class="hp-act" data-cmp aria-pressed="${cmpMode}">${cmpMode ? 'Stop comparing' : 'Compare two'}</button></div>` +
      (cur && cur.n < THIN ? `<div class="thin">The record here is thin: ${cur.n} event${cur.n === 1 ? '' : 's'} from ${esc(cur.label)} in these years. Treat the shape as a sketch.</div>` : '') +
      `<div class="note">${fmtInt(assigned)} of the ${fmtInt(base.length)} sentiment records in these years carry a region; the rest are shown as "Global or unassigned" in muted gray.</div>`;
  }
  regionsEl.addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-cmp]');
    if (c) { cmpMode = !cmpMode; if (!cmpMode) pair = []; const base = db.events.filter((e) => drawn(e) && e.year >= S.y0 && e.year <= S.y1); drawRegions(base); drawCompare(base); return; }
    const b = ev.target.closest('[data-r]'); if (!b) return;
    const r = b.dataset.r;
    if (cmpMode && r) { pair = pair.includes(r) ? pair.filter((x) => x !== r) : [...pair, r].slice(-2); const base = db.events.filter((e) => drawn(e) && e.year >= S.y0 && e.year <= S.y1); drawRegions(base); drawCompare(base); return; }
    set({ mode: r ? `r:${r}` : '' });
  });

  /* ---------- two regions side by side: a small wheel each, counts, and the terms that set them apart ---------- */
  const cmpEl = el.querySelector('.wh-cmp');
  let cmpKey = '';
  function drawCompare(base) {
    const on = cmpMode && pair.length === 2;
    cmpEl.classList.toggle('on', on);
    if (!on) { cmpEl.querySelector('.wh-cmp-grid').innerHTML = ''; cmpKey = ''; return; }
    const inR = (e, r) => (r === 'unassigned' ? regionOf(e) === 'unassigned' || e.region === 'global' : e.region === r);
    const sets = pair.map((r) => ({ r, meta: r === 'unassigned' ? UNASSIGNED : REGION[r], evs: base.filter((e) => inR(e, r)) }));
    // terms: document frequency per side; a term is distinctive when its share on one side is well above the other
    const docs = sets.map((s) => s.evs.filter((e) => TERM_TYPES.has(e.type)));
    const dfs = docs.map((d) => { const m = new Map(); d.forEach((e) => new Set(tokens(`${e.title}. ${e.summary || ''}`)).forEach((t) => m.set(t, (m.get(t) || 0) + 1))); return m; });
    const share = (i, t) => (dfs[i].get(t) || 0) / Math.max(1, docs[i].length);
    const distinct = (i) => [...dfs[i]].filter(([, n]) => n >= 2).map(([t, n]) => [t, n, share(i, t) - share(1 - i, t)]).sort((a, b) => b[2] - a[2] || b[1] - a[1]).slice(0, 8);
    cmpEl.querySelector('.wh-cmp-head .m').textContent = `${S.y0} to ${S.y1}`;
    cmpEl.querySelector('.wh-cmp-grid').innerHTML = sets.map((s, i) => {
      const h = s.evs.filter(isHope).length, f = s.evs.filter(isFear).length, o = s.evs.length - h - f;
      const pct = (n) => (s.evs.length ? Math.round((100 * n) / s.evs.length) : 0);
      return `<article class="wh-cmp-card" data-r="${s.r}" style="--c:${s.meta.color}"><h3><i></i>${esc(s.meta.label)}</h3><div class="m">${s.evs.length} events &middot; ${h} hopes &middot; ${f} fears &middot; ${o} other</div>
        <div class="bar" title="hopes ${pct(h)}%, fears ${pct(f)}%, other ${pct(o)}%"><i style="width:${pct(h)}%;background:#c9a86a"></i><i style="width:${pct(f)}%;background:#a02a24"></i><i style="width:${pct(o)}%;background:rgba(28,26,23,.18)"></i></div>
        <svg viewBox="0 0 264 264" role="img" aria-label="${esc(s.meta.label)}: hopes outward and fears inward by year"></svg>
        <div class="terms">${distinct(i).map(([t, n]) => `<span>${esc(t)} <b>${n}</b></span>`).join('') || '<span>too few documents for terms</span>'}</div></article>`;
    }).join('');
    // the small wheels share the big wheel's angles, so a wedge sits in the same place on all three
    const key = pair.slice().sort().join('|'), fresh = key !== cmpKey; cmpKey = key;
    drawCompareStraight(sets, fresh);
    sets.forEach((s) => {
      const svg = d3.select(cmpEl.querySelector(`.wh-cmp-card[data-r="${s.r}"] svg`));
      const gg = svg.append('g').attr('transform', 'translate(132,132)');
      const r1 = 108, rb = 68, r0 = 34;
      // a new pair morphs out of the main wheel: the same wedges at the main wheel's radius, settling to the small size
      if (fresh && !reduced()) { const k0 = Math.min(2.4, R / r1); gg.attr('transform', `translate(132,132) scale(${k0})`).attr('opacity', 0.35).transition().duration(600).ease(d3.easeCubicOut).attr('transform', 'translate(132,132) scale(1)').attr('opacity', 1); }
      [r0, rb, r1].forEach((r, i) => gg.append('circle').attr('r', r).attr('fill', 'none').attr('stroke', i === 1 ? 'rgba(28,26,23,.5)' : 'rgba(28,26,23,.14)'));
      const hs = d3.rollup(s.evs.filter(isHope), (v) => d3.sum(v, mag), (e) => binOfYear(e.year));
      const fs = d3.rollup(s.evs.filter(isFear), (v) => d3.sum(v, mag), (e) => binOfYear(e.year));
      const hm = Math.max(2, d3.max([...hs.values()]) || 0), fm = Math.max(2, d3.max([...fs.values()]) || 0);
      const k = Math.min((r1 - rb - 2) / Math.sqrt(hm), (rb - r0 - 2) / Math.sqrt(fm));
      const arc = d3.arc();
      const seg = (map, out) => [...map].forEach(([bi, T]) => { const [a0, a1] = binAng(bi); const l = k * Math.sqrt(T); gg.append('path').attr('d', arc({ innerRadius: out ? rb + 1 : rb - 1 - l, outerRadius: out ? rb + 1 + l : rb - 1, startAngle: a0, endAngle: a1 })).attr('fill', out ? '#c9a86a' : '#a02a24'); });
      seg(hs, true); seg(fs, false);
      gg.append('text').attr('y', -rb - (r1 - rb) / 2 + 3).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', '#7d6410').text('HOPE');
      gg.append('text').attr('y', -rb + (rb - r0) / 2 + 3).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', '#a02a24').text('FEAR');
      // sparse ticks
      const yrs = [S.y0, ...d3.range(Math.ceil(S.y0 / 100) * 100, S.y1 + 1, S.y1 - S.y0 > 300 ? 100 : 25).filter((yy) => yy > S.y0 && yy <= S.y1)];
      let lastA = -1;
      yrs.forEach((yy) => { const a = ang(yy); if (a - lastA < 0.3) return; lastA = a; const [x, y] = xy(a, r1 + 12); gg.append('text').attr('x', x).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', '#6e6e6a').text(yy); });
    });
  }

  // the straight reading of the pair: one column per period, two aligned bars (left the first region, right the second),
  // hopes up from the baseline and fears down, so the two regions can be read against the same scale and the same years
  // (DESIGN_FRAMING_LIBRARY.md, Data visualization: a radial overview gets a straight partner for exact comparison)
  function drawCompareStraight(sets, fresh) {
    let host = cmpEl.querySelector('.wh-cmp-straight');
    if (!host) { host = document.createElement('div'); host.className = 'wh-cmp-straight'; cmpEl.appendChild(host); }
    const span = S.y1 - S.y0 + 1;
    const step = span <= 400 ? 10 : span <= 1200 ? 50 : 100; // decades when they fit, otherwise half-centuries or centuries
    const p0 = Math.floor(S.y0 / step) * step, periods = d3.range(p0, S.y1 + 1, step);
    const unit = step === 10 ? 'decade' : step === 50 ? 'half-century' : 'century';
    const Wc = Math.max(320, host.clientWidth || cmpEl.clientWidth || 600), Hc = 170, m = { t: 14, r: 8, b: 26, l: 62 };
    const x = d3.scaleBand().domain(periods).range([m.l, Wc - m.r]).paddingInner(0.25);
    const bw = Math.max(1.5, (x.bandwidth() - 1) / 2);
    const rows = sets.map((s, i) => periods.map((p) => { const in_ = s.evs.filter((e) => e.year >= p && e.year < p + step); return { s, i, p, h: in_.filter(isHope).length, f: in_.filter(isFear).length }; }));
    const top = Math.max(1, d3.max(rows.flat(), (d) => Math.max(d.h, d.f)));
    const mid = m.t + (Hc - m.t - m.b) / 2, half = (Hc - m.t - m.b) / 2;
    const y = d3.scaleLinear().domain([0, top]).range([0, half]);
    host.innerHTML = `<div class="sc">${esc(sets[0].meta.label)} against ${esc(sets[1].meta.label)}, by ${unit}</div><svg role="img" aria-label="${esc(sets[0].meta.label)} and ${esc(sets[1].meta.label)}: hopes up and fears down per ${unit}" viewBox="0 0 ${Wc} ${Hc}" width="${Wc}" height="${Hc}"></svg><p class="how">Each ${unit} has two bars on one scale: left ${esc(sets[0].meta.label)}, right ${esc(sets[1].meta.label)}. Up from the line counts hopes, down counts fears. Hover a bar for numbers.</p>`;
    const svg = d3.select(host.querySelector('svg'));
    svg.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', Wc - m.r).attr('y1', mid).attr('y2', mid);
    // the axis names carry the direction: the extremes read "12 hopes" above and "12 fears" below, zero on the line
    svg.append('text').attr('x', m.l - 8).attr('y', mid - half).attr('dy', '0.35em').attr('text-anchor', 'end').text(`${top} hope${top === 1 ? '' : 's'}`);
    svg.append('text').attr('x', m.l - 8).attr('y', mid + half).attr('dy', '0.35em').attr('text-anchor', 'end').text(`${top} fear${top === 1 ? '' : 's'}`);
    svg.append('text').attr('x', m.l - 8).attr('y', mid).attr('dy', '0.35em').attr('text-anchor', 'end').text('0');
    const every = Math.max(1, Math.ceil(periods.length / Math.floor((Wc - m.l - m.r) / 44)));
    periods.forEach((p, i) => { if (i % every === 0) svg.append('text').attr('x', x(p) + x.bandwidth() / 2).attr('y', Hc - m.b + 12).attr('text-anchor', 'middle').text(p); });
    const g = svg.append('g');
    const bar = (d, up) => g.append('rect').attr('x', x(d.p) + d.i * (bw + 1)).attr('width', bw).attr('fill', d.s.meta.color).attr('fill-opacity', up ? 0.95 : 0.55)
      .attr('y', up ? mid - y(d.h) : mid).attr('height', up ? y(d.h) : y(d.f)).attr('data-h', d.h).attr('data-f', d.f).attr('data-i', periods.indexOf(d.p))
      .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${esc(d.s.meta.label)} \u00b7 ${d.p} to ${d.p + step - 1}</div><div class="m">${d.h} hope${d.h === 1 ? '' : 's'} \u00b7 ${d.f} fear${d.f === 1 ? '' : 's'}</div>`)).on('mousemove', tip.move).on('mouseleave', tip.hide);
    rows.flat().forEach((d) => { if (d.h) bar(d, true); if (d.f) bar(d, false); });
    // the bars grow from the baseline in period order on a fresh pair; a settings change redraws them in place
    if (fresh && !reduced()) g.selectAll('rect').each(function () { const r = d3.select(this), y1 = +r.attr('y'), h1 = +r.attr('height'), up = y1 < mid, i = +r.attr('data-i'); r.attr('y', mid).attr('height', 0).transition().delay(40 + (500 * i) / Math.max(1, periods.length - 1)).duration(320).ease(d3.easeCubicOut).attr('y', up ? y1 : mid).attr('height', h1); });
  }

  /* ---------- threads ---------- */
  function threadList(evs) {
    const counts = new Map();
    evs.forEach((e) => (e.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const list = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, mobile ? 10 : 14).map(([t]) => t);
    if (S.thread && !list.includes(S.thread)) list.unshift(S.thread);
    return list;
  }
  function drawBundles(evs) {
    gBundles.selectAll('*').remove();
    const threads = threadList(evs);
    const line = d3.line().curve(d3.curveBundle.beta(0.9));
    const data = [];
    // the hub is the numeral slot: bundles are drawn only for the thread the reader picked, in its hue; nothing else crosses it
    threads.filter((t) => t === S.thread).forEach((t, ti) => {
      const list = evs.filter((e) => (e.tags || []).includes(t)).sort((a, b) => a.t - b.t);
      const rr = R0 * 0.55; // one thread: its bundle bows through the middle third of the hub, under the numeral
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        const aa = ang(a.t), ab = ang(b.t);
        const am = (aa + ab) / 2;
        const pts = [xy(aa, R0), xy(aa, R0 * 0.82), xy(am, rr), xy(ab, R0 * 0.82), xy(ab, R0)];
        data.push({ t, a, b, d: line(pts), span: b.t - a.t });
      }
    });
    gBundles.selectAll('path').data(data).join('path').attr('d', (d) => d.d).attr('fill', 'none')
      .attr('stroke', (d) => threadColor(d.t)).attr('stroke-width', 1.6).attr('opacity', 0.9);
    const ends = new Map();
    data.forEach((d) => { ends.set(d.a.id + d.t, [d.a, d.t]); ends.set(d.b.id + d.t, [d.b, d.t]); });
    gBundles.selectAll('circle').data([...ends.values()]).join('circle').attr('r', 1.8).attr('fill', ([, t]) => threadColor(t))
      .attr('transform', ([e]) => `translate(${xy(ang(e.t), R0)})`);
    legendEl.innerHTML = `<div class="sc" style="color:var(--ink-3);margin-bottom:6px">Recurring threads &middot; ${S.thread ? 'following one through the hub' : 'click one to draw it through the hub'}</div>` +
      threads.map((t) => {
        const n = evs.filter((e) => (e.tags || []).includes(t));
        const span = n.length ? `${d3.min(n, (e) => e.year)} to ${d3.max(n, (e) => e.year)}` : '';
        const on = S.thread === t;
        return `<button type="button" data-t="${esc(t)}" aria-pressed="${on}" style="display:grid;grid-template-columns:18px 1fr auto;gap:6px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid var(--rule);background:${on ? 'var(--ground-2)' : 'none'};padding:5px 0;font-size:13px;min-height:30px"><i style="height:2px;background:${threadColor(t)};display:block"></i><span>${esc(prettyTag(t))}</span><span class="mono" style="font-size:10.5px;color:var(--ink-3)">${n.length} &middot; ${span}</span></button>` +
          // the picked thread's head carries Draw the links: Arcs, filtered to this thread, with its steps as the arcs below the axis
          (on ? `<div class="wh-thread-head"><span class="mono">steps and links on the year axis</span><button type="button" class="wh-draw" data-arcs="${esc(t)}" title="Open Arcs filtered to this thread: its steps as arcs under the year axis">Draw the links</button></div>` : '');
      }).join('') + (S.thread ? '<button type="button" data-t="" class="btn-ghost" style="margin-top:8px">Show all threads</button>' : '') +
      (threads.length ? '' : '<div style="font-size:12px;color:var(--ink-3)">No recurring tags among these events.</div>');
  }
  legendEl.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-arcs]');
    if (a) { set({ view: 'arcs', thread: a.dataset.arcs, sel: '' }); return; } // Arcs reads the thread filter: the stage holds this thread's events and their steps
    const b = ev.target.closest('[data-t]'); if (b) set({ thread: b.dataset.t === S.thread ? '' : b.dataset.t });
  });

  /* ---------- highlight ---------- */
  function hi(id) {
    gHi.selectAll('*').remove();
    gRest.attr('opacity', 1);
    gBars.selectAll('path').attr('opacity', null);
    gRug.selectAll('line').attr('opacity', 0.5);
    gLabels.selectAll('text').attr('opacity', null).classed('wh-yield', false);
    if (!id || !pos.has(id)) return;
    const a = pos.get(id);
    const nb = neighbors(id).filter((n) => pos.has(n));
    const keep = new Set([id, ...nb]);
    gBars.selectAll('path').attr('opacity', (d) => (keep.has(d.e.id) ? 1 : 0.35));
    nb.forEach((n) => {
      const b = pos.get(n);
      gHi.append('path').attr('d', `M${a}Q0,0 ${b}`).attr('fill', 'none').attr('stroke', '#121212').attr('stroke-width', 1.2);
      gHi.append('circle').attr('cx', b[0]).attr('cy', b[1]).attr('r', 4).attr('fill', 'none').attr('stroke', '#121212');
    });
    gHi.append('circle').attr('cx', a[0]).attr('cy', a[1]).attr('r', 7).attr('fill', 'none').attr('stroke', '#121212').attr('stroke-width', 1.6);
    const e = db.byId.get(id);
    if (e) hubYear(e);
    if (e && segAng.has(id) && !labeled.has(id) && !mobile) {
      const ha = segAng.get(id);
      // the hovered label takes the ray; resting labels dim, and any within one separation of the ray stand down
      const sep = Math.max(2.6 * Math.PI / 180, 16 / RIM()) * 1.1, TAU = 2 * Math.PI;
      gLabels.selectAll('text').attr('opacity', 0.25).classed('wh-yield', function () { const la = +this.getAttribute('data-a'); const d = Math.abs(((la - ha) % TAU + TAU + Math.PI) % TAU - Math.PI); return d < sep; });
      rimLabel(gHi, e, ha, true);
    }
  }
  // the hovered year as the dominant numeral in the hub, its label and the wedge's hope and fear counts beneath
  // (DESIGN_FRAMING_LIBRARY.md, Hierarchy: one numeral at six times its label carries the reading; the bundles stay behind it)
  function hubYear(e) {
    if (!binOfYear || !bins.length) return;
    const bi = binOfYear(e.year), b = bins[bi]; if (!b) return;
    const wedge = evsNow.filter((q) => binOfYear(q.year) === bi);
    gRest.attr('opacity', 0);
    hubNumeral(gHi, e.year, b.half ? `${b.y0} to ${b.y1 - 1}` : 'this year', wedge.filter(isHope).length, wedge.filter(isFear).length, true);
  }
  // at rest the hub carries the window: how many hopes and fears sit on the wheel, and the years they span
  function hubRest() {
    gRest.selectAll('*').remove();
    const h = evsNow.filter(isHope).length, f = evsNow.filter(isFear).length;
    if (!h && !f) return;
    // following a thread, the hub names it and lets its bundle show through the disc under the numeral
    hubNumeral(gRest, h + f, S.thread ? prettyTag(S.thread) : `${S.y0} to ${S.y1}`, h, f, false, S.thread ? 0.5 : 0.94, 'sentiment records'); // the base the wedges draw: events carrying a hope or a fear
  }
  function hubNumeral(layer, value, label, h, f, fade, disc = 0.94, unit = '') {
    layer.selectAll('.wh-hub-year').remove();
    // a count is written with its thousands separator and named by its unit line; a year stays a plain four-digit numeral
    const str = unit ? fmtInt(value) : String(value), digits = Math.max(2, str.replace(/,/g, '').length + (str.includes(',') ? 0.4 : 0));
    // the numeral fills the hub: capped by the hub width for its digit count and by the hub height with two lines under it
    const fs = Math.max(24, Math.min(R0 * 0.92, (2 * R0 - 10) / (0.52 * digits)));
    const lab = Math.max(10.5, Math.min(11, fs / 6.2)); // the label is never more than a sixth of the numeral
    const hub = layer.append('g').attr('class', 'wh-hub-year').style('pointer-events', 'none');
    hub.append('circle').attr('r', R0 - 2).attr('fill', 'var(--ground)').attr('fill-opacity', disc);
    hub.append('text').attr('class', 'n').attr('text-anchor', 'middle').attr('y', -3).attr('dy', '0.1em').attr('font-family', 'Instrument Serif, serif').attr('font-size', fs).attr('letter-spacing', '-0.02em').attr('fill', 'var(--ink)').text(str);
    const sub = hub.append('text').attr('class', 'l').attr('text-anchor', 'middle').attr('y', fs * 0.42 + lab * 1.5).attr('font-family', 'Instrument Sans, monospace').attr('font-size', lab).attr('letter-spacing', '0.06em').attr('fill', 'var(--ink-2)');
    // the type never shrinks: lines that would run past the hub's disc are dropped, the span first, the tally second (both live in the region list and the footer)
    const line2 = `${fmtInt(h)} HOPE${h === 1 ? '' : 'S'} \u00b7 ${fmtInt(f)} FEAR${f === 1 ? '' : 'S'}`, fitsHub = (t) => t.length * lab * 0.66 <= 2 * R0 - 12;
    // with a unit, the first line is the unit and the span together when they fit, the unit alone otherwise (never dropped)
    const line1 = unit ? (fitsHub(`${unit} \u00b7 ${label}`) ? `${unit} \u00b7 ${label}` : unit) : label;
    if (unit || fitsHub(line1)) sub.append('tspan').attr('x', 0).text(line1.toUpperCase());
    if (fitsHub(line2)) sub.append('tspan').attr('x', 0).attr('dy', sub.node().childNodes.length ? '1.35em' : 0).text(line2);
    if (fade && !reduced()) hub.attr('opacity', 0).transition().duration(200).ease(d3.easeCubicOut).attr('opacity', 1);
  }
  // term hover: light the segments, rug marks and rim labels of events that mention the term
  function hiTerm(term) {
    gHi.selectAll('*').remove();
    if (!term) { gBars.selectAll('path').attr('opacity', null); gRug.selectAll('line').attr('opacity', 0.5); gLabels.selectAll('text').attr('opacity', null); gRegion.selectAll('path').attr('opacity', null); return; }
    const has = new Set(evsNow.filter((e) => mentions(e, term)).map((e) => e.id));
    gBars.selectAll('path').attr('opacity', (d) => (has.has(d.e.id) ? 1 : 0.12));
    gRegion.selectAll('path').attr('opacity', (d) => (has.has(d.e.id) ? 1 : 0.25));
    gRug.selectAll('line').attr('opacity', (e) => (has.has(e.id) ? 1 : 0.1));
    gLabels.selectAll('text').attr('opacity', function () { return has.has(this.dataset.id) ? 1 : 0.15; });
    const ids = [...has].filter((id) => pos.has(id));
    leaders(ids, term, `${ids.length} event${ids.length === 1 ? '' : 's'} in view`);
  }
  // thread hover in the legend: the same leaders, from the thread name in the hub to its events on the wheel
  function hiThread(t) {
    gHi.selectAll('*').remove();
    gBars.selectAll('path').attr('opacity', null); gRug.selectAll('line').attr('opacity', 0.5); gLabels.selectAll('text').attr('opacity', null);
    if (!t) return;
    const ids = evsNow.filter((e) => (e.tags || []).includes(t) && pos.has(e.id)).map((e) => e.id);
    const has = new Set(ids);
    gBars.selectAll('path').attr('opacity', (d) => (has.has(d.e.id) ? 1 : 0.12));
    gRug.selectAll('line').attr('opacity', (e) => (has.has(e.id) ? 1 : 0.1));
    gLabels.selectAll('text').attr('opacity', function () { return has.has(this.dataset.id) ? 1 : 0.15; });
    leaders(ids, prettyTag(t), `${ids.length} event${ids.length === 1 ? '' : 's'} in view`);
  }
  legendEl.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-t]'); if (b && b.dataset.t) hiThread(b.dataset.t); });
  legendEl.addEventListener('mouseleave', () => { hiThread(null); hi(S.sel || null); });
  legendEl.addEventListener('focusin', (ev) => { const b = ev.target.closest('[data-t]'); if (b && b.dataset.t) hiThread(b.dataset.t); });
  legendEl.addEventListener('focusout', () => { hiThread(null); hi(S.sel || null); });

  /* ---------- term analysis ---------- */
  function analyze() {
    termDocs = evsNow.filter((e) => TERM_TYPES.has(e.type));
    const df = new Map(), typeOf = new Map();
    termDocs.forEach((e) => {
      const seen = new Set(tokens(`${e.title}. ${e.summary || ''}`));
      seen.forEach((t) => { df.set(t, (df.get(t) || 0) + 1); const ty = typeOf.get(t) || { hope: 0, fear: 0, other: 0 }; ty[isHope(e) ? 'hope' : isFear(e) ? 'fear' : 'other']++; typeOf.set(t, ty); });
    });
    const top = [...df].filter(([, n]) => n >= 2 || termDocs.length < 40).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);
    metaEl.innerHTML = `${termDocs.length} documents (hope, fear, culture, concept) &middot; ${df.size} distinct terms<br>${S.y0} to ${S.y1}${region ? ` &middot; ${esc((region === 'unassigned' ? UNASSIGNED : REGION[region]).label)}` : ''}`;
    drawCirrus(top, typeOf);
    drawTrends();
    if (activeTerm) showContexts(activeTerm); else { ctxEl.innerHTML = '<div class="empty">Click a term in the cloud or a trend to read the sentences that use it.</div>'; ctxN.textContent = ''; }
  }

  function drawCirrus(top, typeOf) {
    const box = cirrusEl.getBoundingClientRect();
    const Wc = Math.max(200, box.width), Hc = Math.max(200, box.height);
    const s = d3.select(cirrusEl).select('svg').attr('viewBox', `0 0 ${Wc} ${Hc}`);
    s.selectAll('*').remove();
    if (!top.length) { s.append('text').attr('x', Wc / 2).attr('y', Hc / 2).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, serif').attr('font-size', 13).attr('fill', '#6e6e6a').text('No hope, fear, culture or concept events in these years.'); return; }
    const nmax = top[0][1], nmin = top[top.length - 1][1];
    const fs = d3.scaleSqrt().domain([nmin, Math.max(nmin + 1, nmax)]).range([mobile ? 11 : 13, Math.min(54, Hc / 4.5)]);
    const placed = [];
    const fits = (b) => b.x0 >= 0 && b.x1 <= Wc && b.y0 >= 0 && b.y1 <= Hc && !placed.some((p) => b.x0 < p.x1 + 3 && b.x1 > p.x0 - 3 && b.y0 < p.y1 + 2 && b.y1 > p.y0 - 2);
    const colorOf = (t) => { const ty = typeOf.get(t); if (!ty) return '#121212'; if (ty.fear > ty.hope * 1.5) return '#a02a24'; if (ty.hope > ty.fear * 1.5) return '#7d6410'; return '#121212'; };
    let shown = 0;
    for (const [t, n] of top) {
      const size = fs(n);
      mctx.font = `${size}px Instrument Serif, serif`;
      const w = mctx.measureText(t).width + 4, h = size * 1.1;
      let ok = null;
      for (let i = 0; i < 1400 && !ok; i++) {
        const th = i * 0.32, r = 1.6 * th;
        const x = Wc / 2 + r * Math.cos(th) * (Wc / Hc), y = Hc / 2 + r * Math.sin(th);
        const b = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
        if (fits(b)) ok = { ...b, x, y };
      }
      if (!ok) continue;
      placed.push(ok); shown++;
      s.append('text').attr('x', ok.x).attr('y', ok.y).attr('dy', '0.33em').attr('text-anchor', 'middle').attr('font-size', size).attr('fill', colorOf(t)).attr('data-term', t).classed('on', activeTerm === t)
        .attr('role', 'img').attr('aria-label', `${t}: ${n} of ${termDocs.length} documents`).text(t); // the count as the label, one visible node for assistive tech
    }
    s.selectAll('text[data-term]')
      .on('mouseenter', function () { cirrusEl.classList.add('dim'); this.classList.add('on'); hiTerm(this.dataset.term); })
      .on('mouseleave', function () { cirrusEl.classList.remove('dim'); if (activeTerm !== this.dataset.term) this.classList.remove('on'); hiTerm(null); hi(S.sel || null); })
      .on('click', function () { setActive(this.dataset.term); })
      // keyboard path: Tab reaches each term, focus lights its segments and leaders, Enter or Space opens its contexts
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', function () { return `${this.dataset.term}: highlight the events that mention it`; })
      .on('focus', function () { cirrusEl.classList.add('dim'); this.classList.add('on'); hiTerm(this.dataset.term); })
      .on('blur', function () { cirrusEl.classList.remove('dim'); if (activeTerm !== this.dataset.term) this.classList.remove('on'); hiTerm(null); hi(S.sel || null); })
      .on('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setActive(this.dataset.term); } });
    const h3 = cirrusEl.previousElementSibling; if (h3) h3.querySelector('small').textContent = `top ${shown} terms, sized by how many documents use them`;
  }

  // decades inside the window, trimmed to where the documents are; half-centuries when that is still too many
  function periods() {
    const ys = termDocs.map((e) => e.year);
    const lo = ys.length ? Math.max(S.y0, d3.quantile(ys.slice().sort(d3.ascending), 0.02)) : S.y0, hi = S.y1;
    let stepY = 10;
    if ((hi - lo) / 10 > 30) stepY = 50;
    const out = [];
    for (let y = Math.floor(lo / stepY) * stepY; y <= hi; y += stepY) out.push({ y0: Math.max(S.y0, y), y1: Math.min(S.y1 + 1, y + stepY), label: stepY === 10 ? `${y}s` : `${y}` });
    return out;
  }
  function drawTrends() {
    const per = periods();
    const docsPer = per.map((p) => termDocs.filter((e) => e.year >= p.y0 && e.year < p.y1));
    trendsEl.innerHTML = trendTerms.map((t) => {
      const re = termRe(t);
      // periods with fewer than four documents are left as gaps rather than drawn as spikes
      const sparse = docsPer.map((d) => d.length < 4);
      const vals = docsPer.map((docs, i) => (sparse[i] ? null : docs.filter((e) => re.test(e.title) || re.test(e.summary || '')).length / docs.length));
      const total = termDocs.filter((e) => re.test(e.title) || re.test(e.summary || '')).length;
      const w = 160, h = 34, mx = Math.max(0.02, d3.max(vals.filter((v) => v != null)) || 0);
      const x = d3.scaleLinear().domain([0, Math.max(1, vals.length - 1)]).range([2, w - 2]), y = d3.scaleLinear().domain([0, mx]).range([h - 3, 3]);
      const line = d3.line().defined((v) => v != null).x((v, i) => x(i)).y((v) => y(v)).curve(d3.curveMonotoneX);
      const area = d3.area().defined((v) => v != null).x((v, i) => x(i)).y0(h - 2).y1((v) => y(v)).curve(d3.curveMonotoneX);
      return `<button type="button" class="wt-trend${activeTerm === t ? ' on' : ''}" data-term="${esc(t)}" title="${esc(t)}: ${total} of ${termDocs.length} documents">
        <span class="nm"><span>${esc(t)}</span><span class="n">${total} &middot; peak ${Math.round(mx * 100)}%</span></span>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${area(vals) || ''}" fill="rgba(28,26,23,.08)"/><path d="${line(vals) || ''}" fill="none" stroke="#121212" stroke-width="1.2"/>${vals.map((v, i) => `<circle cx="${x(i)}" cy="${v == null ? h - 2 : y(v)}" r="${v == null ? 1 : 1.8}" fill="${v == null ? '#a59a83' : '#121212'}"><title>${esc(per[i].label)}: ${v == null ? `too few documents (${docsPer[i].length})` : `${Math.round(v * 100)}% of ${docsPer[i].length} documents`}</title></circle>`).join('')}</svg>
        <span class="ax"><span>${esc(per[0].label)}</span><span>${esc(per[per.length - 1].label)}</span></span></button>`;
    }).join('') || '<div class="empty">No terms selected.</div>';
    chipsEl.innerHTML = trendTerms.map((t) => `<button type="button" class="hp-chip static" data-d="${esc(t)}" aria-pressed="${activeTerm === t}"><i style="--c:#121212"></i>${esc(t)}<span class="x" aria-hidden="true">&times;</span></button>`).join('');
  }
  const chipsEl = el.querySelector('.wt-pick .hp-chips');
  chipsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.hp-chip'); if (!b) return;
    trendTerms = trendTerms.filter((t) => t !== b.dataset.d);
    if (activeTerm === b.dataset.d) activeTerm = null;
    drawTrends();
    if (!activeTerm) { ctxEl.innerHTML = '<div class="empty">Click a term in the cloud or a trend to read the sentences that use it.</div>'; ctxN.textContent = ''; }
  });
  trendsEl.addEventListener('mouseover', (ev) => { const b = ev.target.closest('.wt-trend'); if (b) hiTerm(b.dataset.term); });
  trendsEl.addEventListener('mouseout', (ev) => { const b = ev.target.closest('.wt-trend'); if (b && !trendsEl.contains(ev.relatedTarget?.closest?.('.wt-trend'))) { hiTerm(null); hi(S.sel || null); } });
  trendsEl.addEventListener('click', (ev) => { const b = ev.target.closest('.wt-trend'); if (b) setActive(b.dataset.term); });
  pickEl.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const t = normTok(pickEl.value.trim().split(/\s+/)[0] || '');
    if (t.length < 3) return;
    if (!trendTerms.includes(t)) { trendTerms = [...trendTerms.slice(trendTerms.length >= 10 ? 1 : 0), t]; }
    pickEl.value = '';
    drawTrends();
    setActive(t);
  });

  function setActive(term) {
    activeTerm = activeTerm === term ? null : term;
    el.querySelectorAll('.wt-cirrus text, .wt-trend').forEach((n) => n.classList.toggle('on', n.dataset.term === activeTerm));
    if (activeTerm) showContexts(activeTerm); else { ctxEl.innerHTML = '<div class="empty">Click a term in the cloud or a trend to read the sentences that use it.</div>'; ctxN.textContent = ''; }
  }
  function showContexts(term) {
    const re = termRe(term);
    const rows = [];
    termDocs.slice().sort((a, b) => a.t - b.t).forEach((e) => {
      const ss = [e.title, ...sentences(e.summary)].filter((s) => re.test(s));
      if (ss.length) rows.push({ e, s: ss[0] === e.title && ss[1] ? ss[1] : ss[0], isTitle: ss[0] === e.title && !ss[1] });
    });
    ctxN.textContent = rows.length ? `${rows.length} document${rows.length === 1 ? '' : 's'} use "${term}"` : `no document uses "${term}" here`;
    const mark = (s) => esc(s).replace(new RegExp(re.source, 'gi'), (m) => `<mark>${m}</mark>`);
    const MAX = 40;
    ctxEl.innerHTML = rows.length ? rows.slice(0, MAX).map(({ e, s }) => {
      const reg = regionOf(e);
      return `<button type="button" data-ev="${esc(e.id)}"><span class="y">${e.year}</span>${mark(s)}${reg !== 'unassigned' ? `<span class="r">${esc(REGION[reg].short)}</span>` : ''}</button>`;
    }).join('') + (rows.length > MAX ? `<div class="more">${rows.length - MAX} more; narrow the years to read them all.</div>` : '')
      : `<div class="empty">"${esc(term)}" does not appear in the hope, fear, culture or concept events of these years${region ? ' and region' : ''}. Widen the years or try another term.</div>`;
  }
  ctxEl.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) select(b.dataset.ev); });
  ctxEl.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hi(b.dataset.ev); });
  ctxEl.addEventListener('mouseout', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hi(S.sel || null); });

  let fontsHooked = false;
  function render(state, ch) {
    const r = regionFromMode();
    const regionChanged = r !== region; region = r;
    const full = ch.has('*') || ch.has('y0') || ch.has('y1');
    if (full) { layout(); if (startYear != null && (startYear <= S.y0 || startYear > S.y1)) startYear = null; syncRot(); }
    if (full || ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q') || regionChanged) draw();
    hi(S.sel || null);
    if (!fontsHooked && document.fonts && document.fonts.status !== 'loaded') { fontsHooked = true; document.fonts.ready.then(() => render(S, new Set(['*']))); }
  }
  return { render, resize() { render(S, new Set(['*'])); }, hover(id) { hi(id || S.sel || null); }, lit(l) { LIT = l; relit(); } };
}
