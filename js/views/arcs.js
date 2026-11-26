// ARCS: every linked event in the record as a tick on the warped year axis, every link as an arc. Policies that
// answer an event and pattern pairs rise above the axis; benchmarks moved, thread steps and deals hang below.
// Links are the compilers' judgments in links.json and the pattern pairs in patterns.json; every count is computed here.
import { state as S, YEAR_MIN, YEAR_MAX } from '../store.js';
import { frac, timeScale } from '../time.js';
import { passes } from '../data.js';
import { esc } from '../ui.js';
import { DOMAIN } from '../palette.js';
import { reduced } from '../lit.js';
import { atlasLocator, locatorWidth, BREAKS } from '../atlas.js';
import { cxBasis, cxWhy } from '../connect.js';

// kind, label, side, how the arc reads in the key
const KINDS = [
  ['po', 'Policies', 'up', 'a rule that answers the event'],
  ['pt', 'Pattern pairs', 'up', 'a pair the patterns drew: invention to rule, disaster to rule'],
  ['bm', 'Benchmarks', 'down', 'a benchmark the event moved'],
  ['th', 'Thread steps', 'down', 'the next step on a shared thread'],
  ['dl', 'Deals', 'down', 'a deal the event touches'],
];
const KIND = Object.fromEntries(KINDS.map((k) => [k[0], { label: k[1], side: k[2], read: k[3] }]));
const fmt = (n) => n.toLocaleString('en-US');
const median = (xs) => { if (!xs.length) return null; const a = xs.slice().sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const decadeOf = (y) => Math.floor(y / 10) * 10;

export default function arcs(el, { db, select, tip }) {
  el.innerHTML = `
    <div class="view-head arc-head"><span class="sc">Correlated history</span>
      <h2>Arcs</h2>
      <p class="arc-dek">Every event the compilers linked to a rule, a benchmark, a thread, a pattern or a deal, as a tick on the year axis; every link as an arc. Rules and pattern pairs rise above the axis, benchmarks, thread steps and deals hang below.</p>
      <div class="atlas-loc-host"></div>
      <p class="arc-contract atlas-key">tick = a linked event at its year; arc = one link, above for rules and pattern pairs, below for benchmarks, thread steps and deals; x = year, stretched toward the present; red = the hovered event and its links</p>
    </div>
    <div class="arc-ctl hp-bar"><span class="sc">Links</span><div class="arc-kinds" role="group" aria-label="Link kinds"></div></div>
    <div class="arc-stage">
      <svg class="arc-svg" role="group" aria-label="Linked events on a year axis with arcs for each link. Arrow keys walk the events, Enter opens one"></svg>
      <aside class="arc-ix" aria-live="polite" tabindex="0" aria-label="Index of the hovered event's links"></aside>
      <div class="arc-note" hidden></div>
    </div>
    <footer class="arc-foot"></footer>`;
  const $ = (q) => el.querySelector(q);
  const svg = d3.select($('.arc-svg'));
  const defs = svg.append('defs');
  const clip = defs.append('clipPath').attr('id', 'arc-clip').append('rect');
  const gBand = svg.append('g').attr('class', 'arc-band');
  const gArcs = svg.append('g').attr('class', 'arc-arcs').attr('clip-path', 'url(#arc-clip)');
  const gAxis = svg.append('g').attr('class', 'arc-axis');
  const gTicks = svg.append('g').attr('class', 'arc-ticks');
  const gLab = svg.append('g').attr('class', 'arc-lab');
  const ix = $('.arc-ix'), foot = $('.arc-foot'), kindsEl = $('.arc-kinds');
  const locHost = $('.atlas-loc-host');
  const loc = atlasLocator(locHost, { width: 260 });

  const kinds = new Set(['po', 'pt', 'bm', 'th']); // the four small kinds open the view; deals arrive on their chip
  const note = $('.arc-note');
  const DEK = $('.arc-dek').textContent;
  let win = [S.y0, S.y1];
  let all = { evs: [], links: [], counts: {} }, vis = { evs: [], links: [] }, hover = null, walk = -1, first = true, focusDecade = null, finding = '', finding2 = '';
  let W = 0, H = 0, phone = false, X = null, AX = 0, m = { l: 16, r: 316, t: 12, b: 36 };

  // ---- the links, computed once from the record ----
  function build() {
    const L = db.links && db.links.events ? db.links : { events: {}, names: {}, years: {} };
    const name = (k, id) => (L.names[k] || {})[id] || id;
    const evs = Object.keys(L.events).map((id) => db.byId.get(id)).filter(Boolean).sort((a, b) => a.year - b.year);
    const links = [];
    const byTh = new Map();
    for (const e of evs) {
      const E = L.events[e.id];
      for (const k of ['po', 'bm', 'dl']) for (const id of E[k] || []) { const yr = (L.years[k] || {})[id]; if (yr == null) continue; links.push({ kind: k, e, a: e.year, b: yr, id, name: name(k, id), why: cxWhy(L, k, id, e), basis: cxBasis(E, k, id) }); }
      for (const id of E.th || []) { if (!byTh.has(id)) byTh.set(id, []); byTh.get(id).push(e); }
    }
    for (const [id, list] of byTh) { list.sort((a, b) => a.year - b.year); for (let i = 1; i < list.length; i++) links.push({ kind: 'th', e: list[i - 1], e2: list[i], a: list[i - 1].year, b: list[i].year, id, name: name('th', id), basis: cxBasis(L.events[list[i - 1].id], 'th', id) || `thread steps ${i} and ${i + 1}` }); }
    for (const p of db.patterns || []) {
      if (!Array.isArray(p.pairs) || !p.pairs.length || !('from' in p.pairs[0])) continue;
      for (const pr of p.pairs) { const f = db.byId.get(pr.from), t = db.byId.get(pr.to); if (!f || !t) continue; links.push({ kind: 'pt', e: f, e2: t, a: f.year, b: t.year, id: p.id, name: p.title, lag: pr.lag, basis: 'pattern pair' }); }
    }
    const counts = {}; for (const l of links) counts[l.kind] = (counts[l.kind] || 0) + 1;
    all = { evs, links, counts };
    chips();
    footer();
  }
  // the finding, from what is on stage: the densest decade of the shown links and the median rule answer; a second line when deals are on
  function findOut() {
    const L = vis.links;
    const dec = new Map(); for (const l of L) dec.set(decadeOf(l.a), (dec.get(decadeOf(l.a)) || 0) + 1);
    let best = null; for (const [d, n] of dec) if (!best || n > best[1]) best = [d, n];
    const gaps = L.filter((l) => l.kind === 'po').map((l) => l.b - l.a).filter((g) => g >= 0);
    const K = median(gaps);
    focusDecade = best ? best[0] : null;
    const answer = K == null ? '' : K === 0 ? '; the median rule answered within its event\u2019s year' : `; the median rule answered ${Math.round(K)} year${Math.round(K) === 1 ? '' : 's'} after its event`;
    finding = best ? `The ${best[0]}s hold ${fmt(best[1])} of ${fmt(L.length)} links shown${answer}.` : 'No links in these years.';
    const dl = L.filter((l) => l.kind === 'dl').length;
    finding2 = dl ? `Deals are ${fmt(dl)} of them, ${fmt(L.filter((l) => l.kind === 'dl' && decadeOf(l.a) === focusDecade).length)} in the ${focusDecade}s.` : '';
  }

  function chips() {
    kindsEl.innerHTML = KINDS.map(([k, label]) => `<button type="button" class="arc-chip" data-k="${k}" aria-pressed="${kinds.has(k)}"><i class="${KIND[k].side}"></i>${label} <b>${fmt(all.counts[k] || 0)}</b></button>`).join('');
  }
  kindsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (kinds.has(k) && kinds.size === 1) return; // one kind always stays on stage
    if (kinds.has(k)) kinds.delete(k); else kinds.add(k);
    kindsEl.querySelectorAll('[data-k]').forEach((c) => c.setAttribute('aria-pressed', String(kinds.has(c.dataset.k))));
    draw(false);
  });
  function dek() { const d = $('.arc-dek'); if (!d) return; d.textContent = phone ? [finding, finding2].filter(Boolean).join(' ') : DEK; } // at 375 the dek carries the finding, since the index sits below the fold
  function footer() {
    const parts = KINDS.map(([k, label]) => `${label.toLowerCase()} ${fmt(all.counts[k] || 0)}`).join(', ');
    foot.innerHTML = `<span><b>${fmt(all.evs.length)}</b> linked events, <b>${fmt(all.links.length)}</b> links computed from the record</span><span>${esc(parts)}</span><span>links are the compilers' judgments; unlinked events may still have had rules</span>`;
  }

  // ---- layout ----
  function layout() {
    const r = el.getBoundingClientRect();
    W = r.width; phone = W < 760;
    const head = $('.arc-head').getBoundingClientRect(), ctl = $('.arc-ctl').getBoundingClientRect();
    const stage = $('.arc-stage');
    const top = Math.round(ctl.bottom - r.top) + 8;
    stage.style.top = `${top}px`; stage.style.height = phone ? 'auto' : `${Math.max(260, r.height - top - 22)}px`;
    m = { l: 16, r: phone ? 16 : 312, t: 16, b: 34 };
    const stageH = phone ? Math.max(300, Math.round(W * 0.95)) : Math.max(260, r.height - top - 22);
    H = stageH;
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    X = timeScale({ domain: [win[0], win[1] + 1], range: [m.l, W - m.r] });
    AX = m.t + Math.round((H - m.t - m.b) * 0.52);
    loc.layout(locatorWidth(W, phone, locHost.clientWidth || W - 24)).update(win[0], win[1]);
    void head;
  }

  // the arc: a quadratic over the span, its height a share of the span capped by the room on that side
  function arcPath(l, side) {
    const x1 = X(l.a), x2 = X(l.b + 1) - (X(l.b + 1) - X(l.b)) / 2;
    const span = Math.abs(x2 - x1);
    const room = side === 'up' ? AX - m.t - 18 : H - m.b - AX - 18;
    const h = Math.max(6, Math.min(room, span * 0.5));
    const cy = side === 'up' ? AX - 2 * h : AX + 2 * h;
    return `M${x1},${AX}Q${(x1 + x2) / 2},${cy} ${x2},${AX}`;
  }
  const inWin = (y) => y >= win[0] && y <= win[1];

  function draw(animate) {
    const okE = (e) => passes(e) && inWin(e.year);
    const inView = all.evs.filter(okE);
    const evSet = new Set(inView.map((e) => e.id));
    vis.links = all.links.filter((l) => kinds.has(l.kind) && evSet.has(l.e.id) && (l.e2 ? evSet.has(l.e2.id) : inWin(l.b)));
    const withLink = new Set(); for (const l of vis.links) { withLink.add(l.e.id); if (l.e2) withLink.add(l.e2.id); }
    vis.evs = inView.filter((e) => withLink.has(e.id)); // a tick is an event with a link on stage; events whose kinds are off wait with their chip
    clip.attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);

    // axis: the shared warped scale, years at one weight, breaks as double strokes
    gAxis.selectAll('*').remove();
    gAxis.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', AX).attr('y2', AX);
    const ticks = X.ticks(phone ? 64 : 56, 30);
    gAxis.selectAll('text').data(ticks).join('text').attr('x', (d) => (X(d) < m.l + 14 ? m.l : X(d))).attr('y', AX + 16).attr('text-anchor', (d) => (X(d) < m.l + 14 ? 'start' : 'middle')).attr('fill', (d) => (X.major(d) ? '#121212' : '#6e6e6a')).text((d) => d);
    for (const k of BREAKS) if (k > win[0] && k <= win[1]) gAxis.append('path').attr('class', 'arc-brk').attr('d', `M${X(k) - 4},${AX + 5}l4,-10M${X(k)},${AX + 5}l4,-10`);
    gAxis.append('text').attr('class', 'arc-side').attr('x', m.l).attr('y', m.t + 10).text('ABOVE: RULES AND PATTERN PAIRS');
    gAxis.append('text').attr('class', 'arc-side').attr('x', m.l).attr('y', H - m.b + 24).text('BELOW: BENCHMARKS, THREAD STEPS, DEALS');

    // the arcs
    const arcs = gArcs.selectAll('path').data(vis.links, (l) => `${l.kind}|${l.e.id}|${l.e2 ? l.e2.id : l.id}`);
    arcs.exit().remove();
    const perYear = new Map(); for (const l of vis.links) perYear.set(l.a, (perYear.get(l.a) || 0) + 1);
    arcs.enter().append('path').merge(arcs).attr('class', (l) => `arc-arc k-${l.kind}`).attr('d', (l) => arcPath(l, KIND[l.kind].side))
      .style('--op', (l) => Math.max(0.08, Math.min(0.85, 1 / Math.sqrt(perYear.get(l.a) || 1)))) // dense years thin out: opacity 1/sqrt(count in that year)
      .each(function (l) { d3.select(this).select('title').remove(); d3.select(this).append('title').text(`${l.e.title} (${l.a}) to ${l.e2 ? `${l.e2.title} (${l.b})` : `${l.name} (${l.b})`}`); });

    // the ticks: one per linked event in the window and the filters
    const tk = gTicks.selectAll('g').data(vis.evs, (e) => e.id);
    tk.exit().remove();
    const te = tk.enter().append('g').attr('class', 'arc-tick').attr('role', 'button').attr('tabindex', -1);
    te.append('rect').attr('class', 'hit').attr('x', -5).attr('y', -14).attr('width', 10).attr('height', 28);
    te.append('line').attr('y1', -7).attr('y2', 7);
    te.merge(tk).attr('transform', (e) => `translate(${X(e.year) + (X(e.year + 1) - X(e.year)) / 2},${AX})`)
      .on('mouseenter', (ev, e) => { setHover(e); noteShow(ev, e); }).on('mousemove', noteMove)
      .on('mouseleave', () => { noteHide(); setHover(null); })
      .on('click', (ev, e) => { noteHide(); select(e.id); })
      .on('focus', (ev, e) => setHover(e));
    // roving tabindex: one tick is in the Tab order (the hovered one, else the first), the arrows move between them
    te.merge(tk).attr('tabindex', (e, i) => ((hover ? e.id === hover.id : i === 0) ? 0 : -1));
    te.merge(tk).select('title').remove();
    te.merge(tk).append('title').text((e) => `${e.title} (${e.year})`);

    gBand.selectAll('*').remove();
    gLab.selectAll('*').remove();
    el.classList.remove('arc-focus');
    findOut();
    dek();
    if (animate && !reduced()) reveal(); else { if (first) focusOn(); }
    first = false;
    if (hover) setHover(hover); else paint(); // a redraw keeps the hovered event's arcs in red
  }

  // Grow and focus: the arcs draw in by year over 1.6s, then the densest decade holds the light and the finding lands
  function reveal() {
    clip.attr('width', 0).interrupt().transition().duration(1600).ease(d3.easeLinear).attr('width', W).on('end', () => { if (first === false) focusOn(); });
  }
  function focusOn() {
    if (focusDecade == null || hover) return;
    if (focusDecade + 9 < win[0] || focusDecade > win[1]) { el.classList.remove('arc-focus'); return; }
    const x0 = X(Math.max(win[0], focusDecade)), x1 = X(Math.min(win[1] + 1, focusDecade + 10));
    gBand.append('rect').attr('x', x0).attr('y', m.t).attr('width', Math.max(2, x1 - x0)).attr('height', H - m.t - m.b);
    gLab.append('text').attr('class', 'arc-dec').attr('x', Math.max(x1 - 4, m.l + 70)).attr('y', x1 < m.l + 300 ? m.t + 48 : m.t + 24).attr('text-anchor', 'end').text(`${focusDecade}s`); // at the band's right end, clear of the side label
    el.classList.add('arc-focus');
    gArcs.selectAll('path').classed('dim', (l) => decadeOf(l.a) !== focusDecade);
    gTicks.selectAll('g').classed('dim', (e) => decadeOf(e.year) !== focusDecade);
    if (!reduced()) { gBand.attr('opacity', 0).transition().duration(400).ease(d3.easeLinear).attr('opacity', 1); }
  }

  // the hover note: a ruled light card on the ground, one grammar with the other light surfaces
  function noteShow(ev, e) {
    const d = DOMAIN[e.domain]; const n = vis.links.filter((l) => l.e.id === e.id || (l.e2 && l.e2.id === e.id)).length;
    note.innerHTML = `<span class="h">${esc(d ? d.label : e.domain)} · ${esc(e.type || '')} · ${e.year}</span><b>${esc(e.title)}</b><span class="f">${n ? `${n} link${n === 1 ? '' : 's'} · click to open` : 'click to open'}</span>`;
    note.hidden = false; noteMove(ev);
  }
  function noteMove(ev) {
    const r = $('.arc-stage').getBoundingClientRect(); const nw = note.offsetWidth || 240, nh = note.offsetHeight || 60;
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top - nh - 12;
    if (x + nw > r.width - 8) x = ev.clientX - r.left - nw - 14; if (y < 4) y = ev.clientY - r.top + 18;
    note.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function noteHide() { note.hidden = true; }
  // ---- hover: one event's links in red, the rest paled; the side index names them with the reasons ----
  function setHover(e) {
    hover = e;
    if (e) { el.classList.remove('arc-focus'); gBand.selectAll('*').remove(); gLab.selectAll('*').remove(); }
    el.classList.toggle('arc-hover', !!e);
    gArcs.selectAll('path').classed('on', (l) => !!e && (l.e.id === e.id || (l.e2 && l.e2.id === e.id))).classed('dim', (l) => (e ? !(l.e.id === e.id || (l.e2 && l.e2.id === e.id)) : el.classList.contains('arc-focus') && decadeOf(l.a) !== focusDecade));
    gTicks.selectAll('g').classed('on', (o) => !!e && o.id === e.id).classed('dim', (o) => (e ? o.id !== e.id : false));
    if (e) { gTicks.selectAll('g').attr('tabindex', (o) => (o.id === e.id ? 0 : -1)); const t = gTicks.selectAll('g').filter((o) => o.id === e.id).node(); if (t && el.contains(document.activeElement) && document.activeElement !== t && !document.activeElement.closest('button,input,select,.arc-ix')) t.focus({ preventScroll: true }); }
    paint();
  }
  function paint() {
    const e = hover;
    if (!e) {
      ix.innerHTML = `<div class="arc-ixh"><span class="sc">Index</span><span class="arc-n">${fmt(vis.evs.length)} events with links on stage · ${fmt(vis.links.length)} links</span></div>${finding ? `<p class="arc-finding">${esc(finding)}</p>` : ''}${finding2 ? `<p class="arc-finding arc-finding-2">${esc(finding2)}</p>` : ''}`;
      return;
    }
    const mine = vis.links.filter((l) => l.e.id === e.id || (l.e2 && l.e2.id === e.id));
    const d = DOMAIN[e.domain];
    const rows = [];
    if (!mine.length) { const off = all.links.filter((l) => (l.e.id === e.id || (l.e2 && l.e2.id === e.id)) && (!kinds.has(l.kind) || !inWin(l.b))); const offK = [...new Set(off.map((l) => KIND[l.kind].label.toLowerCase()))]; rows.push(`<li class="arc-off">${off.length ? `${off.length} link${off.length === 1 ? '' : 's'} off stage: ${esc(offK.join(', '))}.` : 'Its links are measures, which carry no year.'}</li>`); }
    for (const [k, label] of KINDS) {
      const ls = mine.filter((l) => l.kind === k).sort((p, q) => (p.basis || '').localeCompare(q.basis || '') || p.b - q.b); if (!ls.length) continue;
      rows.push(`<li class="arc-grp"><span class="k">${label}</span><b>${ls.length}</b></li>`);
      for (const l of ls) {
        const other = l.e2 ? (l.e2.id === e.id ? l.e : l.e2) : null;
        const t = other ? other.title : l.name, yr = other ? other.year : l.b;
        const gap = yr - e.year;
        const line = [l.basis, l.why || (l.kind === 'pt' ? l.name : ''), !l.why && gap ? `${Math.abs(gap)} year${Math.abs(gap) === 1 ? '' : 's'} ${gap > 0 ? 'later' : 'earlier'}` : ''].filter(Boolean).join('; ');
        rows.push(`<li><span class="tt">${esc(t)}</span><span class="y">${yr}</span>${line ? `<small class="why">${esc(line)}</small>` : ''}</li>`);
      }
    }
    ix.innerHTML = `<div class="arc-ixh"><span class="sc">Index</span><span class="arc-n">${mine.length} link${mine.length === 1 ? '' : 's'}</span></div><div class="arc-sel"><b>${esc(e.title)}</b><span>${e.year}${d ? ` · ${esc(d.label)}` : ''}</span></div><ul class="arc-g">${rows.join('')}</ul><p class="arc-open">Click the tick to open the record.</p><button type="button" class="ix-open" data-reopen="${esc(e.id)}">Open the record</button>`;
  }

  // arrows walk the events by year; Enter opens; Escape clears
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el && ev.target.closest('button,input,select')) return;
    const k = ev.key, n = vis.evs.length;
    if (!n) return;
    if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); walk = hover ? (vis.evs.findIndex((o) => o.id === hover.id) + 1) % n : 0; setHover(vis.evs[walk]); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); walk = hover ? (vis.evs.findIndex((o) => o.id === hover.id) - 1 + n) % n : n - 1; setHover(vis.evs[walk]); }
    else if (k === 'Enter' && hover) { ev.preventDefault(); select(hover.id); }
    else if (k === 'Escape' && hover) { ev.preventDefault(); setHover(null); }
  });

  function render(state, ch) {
    const full = ch.has('*') || ch.has('y0') || ch.has('y1');
    if (ch.has('*') && !all.links.length) build();
    // the view's own window: the 2020s at first sight unless the reader has already brushed the shared window narrower; a brush made here edits it, the shared window itself is left alone
    if (first) win = S.y0 <= YEAR_MIN && S.y1 >= YEAR_MAX ? [2020, 2026] : [S.y0, S.y1];
    else if (ch.has('y0') || ch.has('y1')) win = [S.y0, S.y1];
    if (full) layout();
    if (full || ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q')) draw(first);
    if ((ch.has('*') || ch.has('sel')) && state.sel && db.byId.has(state.sel)) setHover(db.byId.get(state.sel));  // shell hook: a record named in the hash is the index's record
  }
  return { render, resize() { layout(); draw(false); }, hover() {} };
}
