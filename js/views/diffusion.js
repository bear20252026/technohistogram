// C. DIFFUSION: from invention to everyday use. S-curves of US household adoption (OWID), lag bars from an
// anchor event in the record to 10, 50 and 90 percent, a race mode, and months to 100 million users.
// Every number is computed from the series files; anchors are events in the record, named as such.
import { placeLabels, slideY, textWidth } from '../labels.js';
import { state as S, set } from '../store.js';
import { shortTitle } from '../text.js';
import { seriesById, host } from '../data.js';
import { esc, eventTip } from '../ui.js';
import { domainColor } from '../palette.js';
import { ATLAS, atlasLocator, locatorWidth } from '../atlas.js';
import { reduced, whenInView, drawPath } from '../lit.js';

// anchor candidates per technology: explicit ids first, then a title pattern over invention-type events (earliest wins)
const ANCHORS = {
  'Telephone (landline)': { ids: ['bell-telephone-1876'], re: /bell.*telephone|telephone.*(bell|patent)/i },
  Radio: { ids: ['marconi-transatlantic-1901'], re: /marconi|first radio broadcast|kdka/i },
  'Electric power': { ids: ['edison-pearl-street-1882'], re: /pearl street|central power station/i },
  Refrigerator: { re: /refrigerator/i }, 'Refrigerator (alt. series)': { re: /refrigerator/i },
  Television: { ids: ['television-baird-demo-1926'] }, 'Colour TV': { re: /colou?r television/i },
  Automobile: { ids: ['ford-model-t-1908'], re: /motorwagen|benz patent/i },
  'Personal computer (microcomputer)': { ids: ['altair-8800-1975'] }, Computer: { ids: ['altair-8800-1975'] },
  Internet: { ids: ['arpanet-first-message-1969'] }, 'Cell phone': { ids: ['first-cell-phone-call-1973', 'first-mobile-phone-call-1973'] },
  Smartphone: { ids: ['ibm-simon-1994'] }, 'Social media': { ids: ['sixdegrees-1997'] }, Tablet: { ids: ['ipad-2010'] },
  'Washing machine': { re: /washing machine/i }, 'Air conditioning': { re: /air.condition/i }, Microwave: { re: /microwave oven/i },
  'Cable TV': { re: /cable television/i }, Dishwasher: { re: /dishwasher/i }, Podcasting: { re: /podcast/i }, 'Ebook reader': { re: /kindle|e-?book reader/i },
};
const SHORT = { 'Telephone (landline)': 'Telephone', 'Personal computer (microcomputer)': 'Personal computer', 'Refrigerator (alt. series)': 'Refrigerator (alt.)' };
const MAKE = new Set(['invention', 'product', 'milestone', 'discovery']);
const TH = [10, 50, 90];
const ALIGN = [10, 25, 50, 75, 90];
const THC = { 10: '#a3a39d', 50: '#5c5c58', 90: '#121212' }; // an ink ramp: darker the deeper the adoption; red is kept for the hovered curve and the marker
const GROUND = 'var(--ground)';
const yr = (v) => (v == null ? '' : String(Math.round(v)));
const plural = (n, u = 'year') => `${n} ${u}${n === 1 ? '' : 's'}`;

export default function diffusion(el, { db, select, tip }) {
  el.classList.add('scroll-y');
  const A = seriesById('adoption');
  const H100 = seriesById('time_to_100m_users');
  if (!A) { el.innerHTML = '<div class="state-msg"><div><h2>No adoption figures</h2></div></div>'; return { render() {}, resize() {}, hover() {} }; }

  // crossing of a threshold: first point at or above it, linearly interpolated; 'start' when the series begins above it
  const cross = (pts, th) => { let prev = null; for (const p of pts) { if (p.value >= th) { if (!prev) return { kind: 'start', y: p.year }; return { kind: 'x', y: prev.year + ((th - prev.value) / (p.value - prev.value)) * (p.year - prev.year) }; } prev = p; } return null; };
  const anchorFor = (name) => {
    const a = ANCHORS[name] || {};
    for (const id of a.ids || []) { const e = db.byId.get(id); if (e) return e; }
    if (a.re) { const c = db.events.filter((e) => MAKE.has(e.type) && a.re.test(e.title)).sort((p, q) => p.year - q.year); if (c[0]) return c[0]; }
    return null;
  };
  const techs = Object.entries(A.technologies).filter(([n]) => !/alt\. series/.test(n) && n !== 'Television').map(([name, pts]) => {
    const c = Object.fromEntries(TH.map((t) => [t, cross(pts, t)]));
    const anchor = anchorFor(name);
    return { name, short: SHORT[name] || name, pts, c, anchor, start: pts[0].year, end: pts[pts.length - 1].year, last: pts[pts.length - 1].value };
  }).sort((a, b) => a.start - b.start);
  const half = (t) => (t.c[50] && t.c[50].kind === 'x' && t.c[10] ? Math.round(t.c[50].y - t.c[10].y) : null); // years from 10% to 50%
  const toHalf = (t) => (t.anchor && t.c[50] && t.c[50].kind === 'x' ? Math.round(t.c[50].y - t.anchor.year) : null);

  // headline from computed numbers
  const tel = techs.find((t) => t.name.startsWith('Telephone')), cell = techs.find((t) => t.name === 'Cell phone'), web = techs.find((t) => t.name === 'Internet'), elec = techs.find((t) => t.name === 'Electric power');
  // two examples, not three: the telephone's long road and the internet's short one
  const head = [tel && toHalf(tel) != null ? `From Bell's patent to half of US households, the telephone took ${plural(toHalf(tel))}` : null,
    web && half(web) != null ? `the internet went from 10 to 50 percent in ${half(web)}` : null].filter(Boolean).join('; ') + '.';

  el.innerHTML = `
    <div class="view-head"><span class="sc">Invention to everyday use</span>
      <h2>US households</h2>
      <p class="df-sub">How long Americans took to adopt twenty technologies, from the telephone to the smartphone. United States only.</p>
      <p>${esc(head)} Lag bars run from an anchor event in the record to the years it crossed 10, 50 and 90 percent of households.</p>
      <p class="df-contract atlas-key">height = share of US households; color = technology, ink darker the later it arrived, family hues when five or fewer are chosen; x = year, or years since the chosen crossing; red = hovered line and your marker</p>
      <div class="atlas-loc-host"></div>
    </div>
    <div class="view-ctl st-ctl"><div class="st-scale"><span class="sc" style="color:var(--ink-3)">Curves</span>
      <div class="toggle" role="group" aria-label="Diffusion mode"><button type="button" data-m="grid">Small multiples</button><button type="button" data-m="overlay">Aligned</button><button type="button" data-m="race">Race</button></div></div></div>
    <div class="df-wrap">
      <section class="df-sec"><h3>How long each step took <small>anchor event &rarr; 10% &rarr; 50% &rarr; 90% of US households</small></h3><div class="df-lags"></div>
        <p class="df-note">Anchor events are items in this record, named on hover; they mark a first demonstration, patent or product and make no claim about who invented what. Most older technologies start at 10 percent in the underlying data, so an open left end means the crossing is not observed. Smartphone and social media figures are shares of adults, not households. Source: <a href="${esc(A.sources[0].url)}" target="_blank" rel="noopener">${esc(host(A.sources[0].url))}</a>.</p></section>
      <section class="df-sec df-curves"><h3 class="df-h3"></h3>
        <div class="df-pick">
          <div class="hp-grp df-techgrp"><span class="sc df-techs-lbl">Technologies</span><button type="button" class="hp-act df-techs-tgl" aria-expanded="false" aria-controls="df-techs">Technologies</button><div class="hp-chips df-techs" id="df-techs" aria-label="Technologies to show"></div><button type="button" class="hp-act" data-all>All</button><button type="button" class="hp-act" data-none>None</button></div>
          <div class="hp-grp"><span class="sc">Align at</span><div class="toggle" role="group" aria-label="Align at">${ALIGN.map((a) => `<button type="button" data-al="${a}">${a}%</button>`).join('')}</div></div>
          <div class="hp-grp"><span class="sc">Marker</span><button type="button" class="hp-act" data-mark>Clear marker</button></div>
        </div>
        <div class="df-grid"></div><div class="df-race"></div><div class="df-markrow"></div><div class="df-table"></div></section>
      ${H100 ? `<section class="df-sec"><h3>Months to 100 million users <small>products, counted by users</small></h3><div class="df-100"></div><p class="df-note">${esc(H100.notes || '')}</p></section>` : ''}
    </div>
    <footer class="df-foot"><span class="df-foot-n"></span><span>denominator: US households (adults for smartphone and social media)</span><span><span class="df-src-k">source: </span><a href="${esc(A.sources[0].url)}" target="_blank" rel="noopener">${esc(host(A.sources[0].url))}</a></span><span>anchor events cite this record</span></footer>`;
  const $ = (s) => el.querySelector(s);
  const spanAll = (() => { const ys = techs.flatMap((t) => t.pts.map((p) => p.year)); return [d3.min(ys), d3.max(ys)]; })();
  $('.df-foot-n').textContent = `${techs.length} technologies, ${spanAll[0]} to ${spanAll[1]}`;
  // the locator shows the series' span in the millennium; a hovered technology narrows it to its own years
  const locHost = $('.atlas-loc-host');
  const loc = atlasLocator(locHost, { width: 260, title: 'Where these years sit in the millennium' }).update(spanAll[0], spanAll[1]);
  const locLayout = () => { const w = el.clientWidth || 1440; loc.layout(locatorWidth(w, w < 760, locHost.clientWidth || w - 24)); };
  el.querySelector('.toggle').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) set({ mode: b.dataset.m === 'grid' ? '' : b.dataset.m }); });
  el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-id]'); if (b) select(b.dataset.id); });

  let hi = null, raceTimer = null;
  const shownOnce = new Set(); // sections that have had their first-view draw-in; a redraw after that is static
  // in-memory agency: which technologies are drawn, the threshold curves align on, and a dropped marker
  let picked = new Set(techs.map((t) => t.name)), alignTh = 10, markRel = null, markYear = null;
  const cAt = (t, th) => (t.c[th] !== undefined ? t.c[th] : (t.c[th] = cross(t.pts, th)));
  const shown = () => techs.filter((t) => picked.has(t.name));
  const pickEl = $('.df-pick');
  pickEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    // on a phone the chips sit behind a disclosure; opening it changes nothing in the plot
    if (b.classList.contains('df-techs-tgl')) { const g = b.closest('.df-techgrp'); const open = !g.classList.contains('open'); g.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); return; }
    if (b.dataset.t !== undefined) { if (picked.has(b.dataset.t)) picked.delete(b.dataset.t); else picked.add(b.dataset.t); }
    else if ('all' in b.dataset) picked = new Set(techs.map((t) => t.name));
    else if ('none' in b.dataset) picked = new Set();
    else if (b.dataset.al) { alignTh = +b.dataset.al; markRel = null; }
    else if ('mark' in b.dataset) { markRel = null; markYear = null; }
    else return;
    draw();
  });
  function syncPick() {
    $('.df-techs').innerHTML = techs.map((t) => `<button type="button" class="hp-chip static" data-t="${esc(t.name)}" aria-pressed="${picked.has(t.name)}" style="--c:${t.anchor ? domainColor(t.anchor.domain) : 'var(--ink-3)'}"><i></i>${esc(t.short)}</button>`).join('');
    const tg = pickEl.querySelector('.df-techs-tgl'); if (tg) tg.textContent = `Technologies (${picked.size} of ${techs.length})`;
    const race = S.mode === 'race' || S.mode === 'overlay';
    pickEl.querySelectorAll('[data-al]').forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.al === alignTh)); });
    pickEl.querySelector('[data-al]').closest('.hp-grp').style.display = race ? '' : 'none';
    const mk = pickEl.querySelector('[data-mark]');
    const has = race ? markRel != null : markYear != null;
    mk.disabled = !has; mk.textContent = has ? 'Clear marker' : 'Click to drop';
  }
  const markRow = (html) => { $('.df-markrow').innerHTML = html || ''; };
  const valueAt = (pts, xkey, vkey, xv) => { let prev = null; for (const p of pts) { if (p[xkey] >= xv) { if (!prev) return p[xkey] === xv ? p[vkey] : null; return prev[vkey] + ((xv - prev[xkey]) / (p[xkey] - prev[xkey])) * (p[vkey] - prev[vkey]); } prev = p; } return null; };
  const W = () => Math.max(320, el.clientWidth - 48);
  const setHi = (name) => { hi = name; el.querySelectorAll('[data-t]').forEach((n) => { n.classList.toggle('dim', !!hi && n.dataset.t !== hi); n.classList.toggle('hi', !!hi && n.dataset.t === hi); }); const t = hi && techs.find((q) => q.name === hi); if (t) loc.update(t.start, t.end); else loc.update(spanAll[0], spanAll[1]); };

  // ---- lag bars ----
  function lags() {
    const hostEl = $('.df-lags'); hostEl.innerHTML = '';
    const w = W(), narrow = w < 640, rowH = 22, m = { l: narrow ? 104 : 150, r: narrow ? 16 : 60, t: 22, b: 8 };
    const x0 = d3.min(techs, (t) => (t.anchor ? t.anchor.year : t.start)) - 3;
    const x = d3.scaleLinear().domain([x0, 2026]).range([m.l, w - m.r]);
    const rows = techs.slice().sort((a, b) => (a.anchor ? a.anchor.year : a.start) - (b.anchor ? b.anchor.year : b.start));
    const h = m.t + rows.length * rowH + m.b + 18; // the last 18px hold the legend line whole
    const svg = d3.select(hostEl).append('svg').attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'group').attr('aria-label', 'Years from anchor event to 10, 50 and 90 percent adoption');
    const ticks = x.ticks(Math.floor(w / 90));
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t - 6).attr('y2', h - m.b - 18).attr('stroke', (d) => (d % 50 ? 'rgba(28,26,23,.08)' : 'rgba(28,26,23,.25)'));
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', m.t - 10).attr('text-anchor', 'middle').text((d) => d);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('data-t', (t) => t.name).attr('transform', (t, i) => `translate(0,${m.t + i * rowH + rowH / 2})`).style('cursor', 'pointer')
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (t) => `${t.short}: ${half(t) != null ? `${plural(half(t))} from 10 to 50 percent, ${yr(t.c[10].y)} to ${yr(t.c[50].y)}` : `${Math.round(t.last)} percent in ${t.end}`}${t.anchor ? '; open the anchor event' : ''}`)
      .on('mouseenter', (ev, t) => { setHi(t.name); tip.show(ev, tipFor(t)); }).on('mousemove', tip.move).on('mouseleave', () => { setHi(null); tip.hide(); })
      .on('focus', (ev, t) => setHi(t.name)).on('blur', () => setHi(null))
      .on('click', (ev, t) => { if (t.anchor) select(t.anchor.id); }).on('keydown', (ev, t) => { if ((ev.key === 'Enter' || ev.key === ' ') && t.anchor) { ev.preventDefault(); select(t.anchor.id); } });
    g.append('rect').attr('class', 'df-trow').attr('x', 0).attr('y', -rowH / 2).attr('width', w).attr('height', rowH).attr('fill', 'transparent');
    g.append('text').attr('x', m.l - 10).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', 'Instrument Serif, serif').attr('font-size', 15).attr('fill', 'var(--ink)').text((t) => t.short);
    // anchor -> 10%: dotted lead
    g.filter((t) => t.anchor && t.c[10]).append('line').attr('class', 'df-lead').attr('x1', (t) => x(t.anchor.year)).attr('x2', (t) => x(t.c[10].y)).attr('y1', 0).attr('y2', 0).attr('stroke', 'var(--ink-3)').attr('stroke-dasharray', '2 3');
    g.filter((t) => t.anchor).append('circle').attr('cx', (t) => x(t.anchor.year)).attr('r', 3.2).attr('fill', GROUND).attr('stroke', (t) => domainColor(t.anchor.domain)).attr('stroke-width', 1.6);
    // segments 10->50 and 50->90
    const seg = (a, b, col) => g.filter((t) => t.c[a] && t.c[b] && t.c[b].kind === 'x').append('line').attr('class', `df-seg df-seg-${b}`).attr('x1', (t) => x(t.c[a].y)).attr('x2', (t) => x(t.c[b].y)).attr('y1', 0).attr('y2', 0).attr('stroke', col).attr('stroke-width', 5).attr('stroke-linecap', 'butt');
    seg(10, 50, THC[50]); seg(50, 90, THC[90]);
    // open ends: series starts above threshold or never reaches the next one
    g.filter((t) => t.c[10] && t.c[10].kind === 'start').append('path').attr('d', (t) => `M${x(t.c[10].y) - 7},-4 L${x(t.c[10].y)},0 L${x(t.c[10].y) - 7},4`).attr('fill', 'none').attr('stroke', THC[10]).attr('stroke-width', 1.4);
    g.filter((t) => t.c[50] && t.c[50].kind === 'x' && !t.c[90]).append('line').attr('class', 'df-seg df-seg-open').attr('x1', (t) => x(t.c[50].y)).attr('x2', (t) => x(t.end)).attr('y1', 0).attr('y2', 0).attr('stroke', THC[90]).attr('stroke-width', 1).attr('stroke-dasharray', '1 3');
    TH.forEach((th) => g.filter((t) => t.c[th] && t.c[th].kind === 'x').append('circle').attr('class', `df-th df-th-${th}`).attr('cx', (t) => x(t.c[th].y)).attr('r', th === 90 ? 3.5 : 3).attr('fill', THC[th]).attr('stroke', GROUND));
    // right label: years from 10 to 50, or last value
    if (!narrow) g.append('text').attr('class', 'pt-tk df-rl').attr('x', (t) => x(Math.max(t.c[90] && t.c[90].kind === 'x' ? t.c[90].y : t.end, t.c[50] ? t.c[50].y : t.start)) + 8).attr('dy', '0.35em').attr('fill', 'var(--ink-2)')
      .text((t) => (half(t) != null ? `10 to 50%: ${plural(half(t))}` : t.c[50] && t.c[50].kind === 'start' ? `above 50% at start` : `${Math.round(t.last)}% in ${t.end}`))
      .each(function () { const x0 = +this.getAttribute('x'), tw = this.getComputedTextLength(); if (x0 + tw > w - 4) d3.select(this).attr('x', w - 4).attr('text-anchor', 'end').attr('paint-order', 'stroke').attr('stroke', GROUND).attr('stroke-width', 3).attr('stroke-linejoin', 'round'); }); // a label that would pass the plot width ends at the edge, haloed in ground where it crosses a bar
    // the reason line: which rows are drawn short, and why, computed from the series
    const noAnchor = rows.filter((t) => !t.anchor), noHalf = rows.filter((t) => !(t.c[50] && t.c[50].kind === 'x')), no90 = rows.filter((t) => t.c[50] && t.c[50].kind === 'x' && !t.c[90]);
    const names = (L) => L.map((t) => t.short).join(', ');
    const note = document.createElement('p'); note.className = 'df-note df-lnote';
    note.textContent = [
      noAnchor.length ? `${noAnchor.length} of ${rows.length} technologies have no anchor event in the record, so their rows begin at the 10 percent crossing: ${names(noAnchor)}.` : '',
      noHalf.length ? `${noHalf.length} have not reached 50 percent and end at their last value: ${names(noHalf)}.` : '',
      no90.length ? `${no90.length} have reached 50 but not 90 percent; the open line runs to their last reading: ${names(no90)}.` : ''
    ].filter(Boolean).join(' ');
    hostEl.appendChild(note);
    // first view: each bar extends from its anchor to 10, then 50, then 90 percent, in the order the record reaches them
    if (!shownOnce.has('lags') && !reduced()) {
      const atX1 = function () { return this.getAttribute('x1'); };
      const lead = svg.selectAll('.df-lead').attr('x2', atX1), s50 = svg.selectAll('.df-seg-50').attr('x2', atX1), s90 = svg.selectAll('.df-seg-90, .df-seg-open').attr('x2', atX1);
      svg.selectAll('.df-th').attr('r', 0); const rl = svg.selectAll('.df-rl').attr('opacity', 0);
      whenInView(hostEl, () => {
        shownOnce.add('lags');
        const ez = d3.easeCubicOut;
        lead.transition().duration(300).ease(ez).attr('x2', (t) => x(t.c[10].y));
        svg.selectAll('.df-th-10').transition().delay(240).duration(160).attr('r', 3);
        s50.transition().delay(300).duration(300).ease(ez).attr('x2', (t) => x(t.c[50].y));
        svg.selectAll('.df-th-50').transition().delay(540).duration(160).attr('r', 3);
        s90.transition().delay(600).duration(300).ease(ez).attr('x2', function (t) { return this.classList.contains('df-seg-open') ? x(t.end) : x(t.c[90].y); });
        svg.selectAll('.df-th-90').transition().delay(840).duration(160).attr('r', 3.5);
        rl.transition().delay(820).duration(200).attr('opacity', 1);
      });
    } else shownOnce.add('lags');
    // legend
    const lg = svg.append('g').attr('transform', `translate(${narrow ? 8 : m.l},${h - 9})`).attr('class', 'pt-tk'); // sits in its own band under the rows; on a phone it starts at the left edge so all three fit
    [['anchor event', GROUND, 'var(--ink)'], ['10% to 50%', THC[50]], ['50% to 90%', THC[90]]].forEach(([l, c, st], i) => { const gg = lg.append('g').attr('transform', `translate(${i * (narrow ? 100 : 110)},0)`); gg.append('circle').attr('r', 3).attr('fill', c).attr('stroke', st || c); gg.append('text').attr('x', 7).attr('dy', '0.35em').text(l); });
  }
  const tipFor = (t) => `<div class="k">${esc(t.short)} &middot; ${esc(A.unit)}</div><div class="h">${t.anchor ? `Anchor: ${esc(t.anchor.title)} (${t.anchor.year})` : 'No anchor event linked'}</div><div class="m">${TH.map((th) => `${th}%: ${t.c[th] ? (t.c[th].kind === 'start' ? `before ${t.c[th].y} (first reading above)` : yr(t.c[th].y)) : 'not reached'}`).join(' &middot; ')}${toHalf(t) != null ? `<br>${plural(toHalf(t))} from the anchor to half of households` : ''}${t.anchor ? '<br>click to open the anchor event' : ''}</div>`;

  // ---- curves: grid, aligned overlay, race ----
  function curveSvg(hostEl, w, h, m, label) { const svg = d3.select(hostEl).append('svg').attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`); if (label) svg.attr('role', 'group').attr('aria-label', label); return svg; }
  function grid() {
    const hostEl = $('.df-grid'); hostEl.innerHTML = ''; $('.df-race').innerHTML = '';
    $('.df-h3').innerHTML = 'Each curve on its own years <small>share of US households, 10, 50 and 90 percent marked</small>';
    const cols = W() > 1100 ? 4 : W() > 760 ? 3 : W() > 520 ? 2 : 1, cw = Math.floor(W() / cols) - 14, ch = 150, m = { l: 30, r: 10, t: 26, b: 20 };
    const list = shown();
    if (!list.length) { hostEl.innerHTML = '<p class="df-note">No technology chosen.</p>'; markRow(''); return; }
    const vals = [];
    for (const t of list) {
      const card = document.createElement('div'); card.className = 'df-card'; card.dataset.t = t.name; hostEl.appendChild(card);
      card.innerHTML = `<h4>${esc(t.short)}</h4><p class="df-cap">${esc(caption(t))}</p>`;
      const svg = curveSvg(card, cw, ch, m, `${t.short}: ${caption(t)}`);
      const x = d3.scaleLinear().domain([Math.min(t.anchor ? t.anchor.year : t.start, t.start), 2026]).range([m.l, cw - m.r]);
      const y = d3.scaleLinear().domain([0, 100]).range([ch - m.b, m.t]);
      TH.forEach((th) => svg.append('line').attr('x1', m.l).attr('x2', cw - m.r).attr('y1', y(th)).attr('y2', y(th)).attr('stroke', THC[th]).attr('opacity', 0.35).attr('stroke-dasharray', '2 3'));
      svg.append('g').selectAll('text').data(TH).join('text').attr('class', 'pt-tk').attr('x', m.l - 4).attr('y', (d) => y(d)).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => d);
      const xt = x.ticks(4);
      svg.append('g').selectAll('text').data(xt).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', ch - 6).attr('text-anchor', 'middle').text((d) => d);
      if (t.anchor) { svg.append('line').attr('x1', x(t.anchor.year)).attr('x2', x(t.anchor.year)).attr('y1', y(0)).attr('y2', y(100)).attr('stroke', domainColor(t.anchor.domain)).attr('stroke-width', 1.2); svg.append('text').attr('class', 'pt-tk').attr('x', x(t.anchor.year) + 3).attr('y', m.t - 8).attr('fill', domainColor(t.anchor.domain)).text(`${t.anchor.year} ${t.anchor.title.length > 30 ? shortTitle(t.anchor) : t.anchor.title}`); }
      const line = d3.line().x((p) => x(p.year)).y((p) => y(p.value)).curve(d3.curveMonotoneX);
      svg.append('path').attr('class', 'df-curve').attr('d', line(t.pts)).attr('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.8);
      TH.forEach((th) => { const c = t.c[th]; if (c && c.kind === 'x') svg.append('circle').attr('class', 'df-th').attr('data-k', (c.y - t.start) / Math.max(1, t.end - t.start)).attr('cx', x(c.y)).attr('cy', y(th)).attr('r', 3.5).attr('fill', THC[th]).attr('stroke', GROUND); });
      // a dropped marker year runs through every card; the value where it meets the curve is read off
      if (markYear != null && markYear >= x.domain()[0] && markYear <= x.domain()[1]) {
        const v = valueAt(t.pts, 'year', 'value', markYear);
        const gm = svg.append('g').attr('class', 'df-mark');
        gm.append('line').attr('x1', x(markYear)).attr('x2', x(markYear)).attr('y1', y(0)).attr('y2', y(100));
        if (v != null) { gm.append('circle').attr('cx', x(markYear)).attr('cy', y(v)).attr('r', 3.5).attr('fill', 'var(--accent)'); gm.append('text').attr('x', x(markYear) + (x(markYear) > cw - 50 ? -5 : 5)).attr('y', y(v) < m.t + 16 ? y(v) + 14 : y(v) - 6).attr('text-anchor', x(markYear) > cw - 50 ? 'end' : 'start').attr('fill', 'var(--accent)').text(`${Math.round(v)}%`); vals.push([t, v]); }
      }
      svg.on('click', (ev) => { ev.stopPropagation(); const [mx] = d3.pointer(ev, svg.node()); markYear = Math.round(x.invert(mx)); draw(); });
      card.addEventListener('mouseenter', (ev) => { setHi(t.name); tip.show(ev, tipFor(t)); }); card.addEventListener('mousemove', tip.move); card.addEventListener('mouseleave', () => { setHi(null); tip.hide(); });
      if (t.anchor) { card.querySelector('h4').style.cursor = 'pointer'; card.querySelector('h4').addEventListener('click', () => select(t.anchor.id)); }
    }
    markRow(markYear != null ? `<b>${markYear}</b>${vals.length ? vals.sort((a, b) => b[1] - a[1]).map(([t, v]) => `<span>${esc(t.short)} ${Math.round(v)}%</span>`).join('') : '<span>no technology has a reading for this year</span>'}` : '');
    // first view: every S-curve draws in along its own years, earliest technology first; the threshold dots
    // appear as the line passes them
    if (!shownOnce.has('grid') && !reduced()) {
      const curves = d3.select(hostEl).selectAll('.df-curve'), dots = d3.select(hostEl).selectAll('.df-th').attr('r', 0);
      curves.attr('stroke-dasharray', function () { const L = this.getTotalLength(); return `${L} ${L}`; }).attr('stroke-dashoffset', function () { return this.getTotalLength(); });
      whenInView(hostEl, () => {
        shownOnce.add('grid');
        const order = new Map(list.map((t, i) => [t.name, i]));
        const delayOf = (node) => Math.min(600, order.get(node.closest('.df-card').dataset.t) * 45);
        drawPath(curves, { duration: 700, delay: function () { return delayOf(this); } });
        dots.transition().delay(function () { return delayOf(this) + 700 * +this.dataset.k; }).duration(180).attr('r', 3.5);
      });
    } else shownOnce.add('grid');
    table(list);
  }
  // straight comparison beside the small multiples: years from 10 to 50 percent as aligned bars, shortest first
  function table(list) {
    const hostEl = $('.df-table'); hostEl.innerHTML = '';
    const rows = list.filter((t) => half(t) != null).sort((a, b) => half(a) - half(b) || a.start - b.start);
    const rest = list.filter((t) => half(t) == null);
    if (!rows.length) return;
    const w = W(), narrow = w < 640, rowH = 24, m = { l: narrow ? 104 : 150, r: narrow ? 66 : 240, t: 26, b: 4 }, h = m.t + rows.length * rowH + m.b;
    hostEl.innerHTML = `<h4 class="df-th4">Years from 10 to 50 percent, shortest first</h4><p class="df-contract">Bar length is years between the 10 and 50 percent crossings of the household share; the label at bar end gives years and crossing dates.</p>`;
    const maxY = d3.max(rows, half);
    const x = d3.scaleLinear().domain([0, maxY]).range([m.l, w - m.r]);
    const svg = curveSvg(hostEl, w, h, m, 'Years from 10 to 50 percent of US households, one bar per technology, shortest first');
    const tks = x.ticks(narrow ? 3 : 8);
    svg.append('g').selectAll('line').data(tks).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t - 6).attr('y2', h - m.b).attr('stroke', (d) => (d ? 'rgba(18,18,18,.08)' : 'rgba(18,18,18,.3)'));
    svg.append('g').selectAll('text').data(tks).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', m.t - 10).attr('text-anchor', 'middle').text((d) => (d === tks[tks.length - 1] ? (narrow ? `${d} y` : `${d} years`) : d));
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('data-t', (t) => t.name).attr('transform', (t, i) => `translate(0,${m.t + i * rowH + rowH / 2})`).style('cursor', 'pointer')
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (t) => `${t.short}: ${half(t) != null ? `${plural(half(t))} from 10 to 50 percent, ${yr(t.c[10].y)} to ${yr(t.c[50].y)}` : `${Math.round(t.last)} percent in ${t.end}`}${t.anchor ? '; open the anchor event' : ''}`)
      .on('mouseenter', (ev, t) => { setHi(t.name); tip.show(ev, tipFor(t)); }).on('mousemove', tip.move).on('mouseleave', () => { setHi(null); tip.hide(); })
      .on('focus', (ev, t) => setHi(t.name)).on('blur', () => setHi(null))
      .on('click', (ev, t) => { if (t.anchor) select(t.anchor.id); }).on('keydown', (ev, t) => { if ((ev.key === 'Enter' || ev.key === ' ') && t.anchor) { ev.preventDefault(); select(t.anchor.id); } });
    g.append('rect').attr('class', 'df-trow').attr('x', 0).attr('y', -rowH / 2).attr('width', w).attr('height', rowH).attr('fill', 'transparent');
    g.append('text').attr('x', m.l - 10).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', 'Instrument Serif, serif').attr('font-size', 15).attr('fill', 'var(--ink)').text((t) => t.short);
    const bars = g.append('rect').attr('class', 'df-tbar').attr('x', m.l).attr('y', -5).attr('height', 10).attr('fill', THC[50]).attr('width', (t) => Math.max(1.5, x(half(t)) - m.l));
    const lab = g.append('text').attr('class', 'pt-tk df-tlab').attr('x', (t) => x(half(t)) + 7).attr('dy', '0.35em').attr('fill', 'var(--ink-2)').text((t) => (narrow ? plural(half(t)) : `${plural(half(t))} · ${yr(t.c[10].y)} to ${yr(t.c[50].y)}`));
    if (!shownOnce.has('table') && !reduced()) {
      bars.attr('width', 0); lab.attr('opacity', 0);
      whenInView(hostEl, () => {
        shownOnce.add('table');
        bars.transition().delay((t, i) => i * 40).duration(500).ease(d3.easeCubicOut).attr('width', (t) => Math.max(1.5, x(half(t)) - m.l));
        lab.transition().delay((t, i) => i * 40 + 420).duration(200).attr('opacity', 1);
      });
    } else shownOnce.add('table');
    const foot = document.createElement('p'); foot.className = 'df-note df-tfoot';
    foot.innerHTML = `${rest.length ? `Not in the table: ${esc(rest.map((t) => t.short).join(', '))} (series start above 50 percent or have not reached it). ` : ''}Denominator: US households (adults for smartphone and social media). Source: <a href="${esc(A.sources[0].url)}" target="_blank" rel="noopener">${esc(host(A.sources[0].url))}</a>.`;
    hostEl.appendChild(foot);
  }
  function caption(t) {
    const h = toHalf(t), hh = half(t);
    if (h != null) return `Reached half of US households in ${yr(t.c[50].y)}, ${plural(h)} after ${t.anchor.title.replace(/\.$/, '')} (${t.anchor.year}).`;
    if (hh != null) return `From 10 to 50 percent in ${plural(hh)} (${yr(t.c[10].y)} to ${yr(t.c[50].y)}).`;
    if (t.c[50] && t.c[50].kind === 'start') return `Already above half of households at the first reading, in ${t.start}.`;
    return `${Math.round(t.last)} percent in ${t.end}, the last reading; not yet at half.`;
  }
  function overlay(race) {
    const hostEl = $('.df-race'); hostEl.innerHTML = ''; $('.df-grid').innerHTML = ''; $('.df-table').innerHTML = '';
    const th = alignTh;
    $('.df-h3').innerHTML = race ? `The race <small>every curve starts its clock the year it crossed ${th} percent</small>` : `Aligned at ${th} percent <small>years since each technology crossed ${th} percent of households</small>`;
    const w = W(), narrowR = race && w < 640, big = w < 640 ? 64 : 112;
    // on a phone the race clock takes a band above the plot, so no curve or label runs under the numeral
    const h = Math.min(520, Math.max(360, w * 0.42)) + (narrowR ? big * 0.8 + 62 : 0), m = { l: 40, r: w < 640 ? 120 : 170, t: narrowR ? 20 + big * 0.8 + 62 : 20, b: 30 }; // the phone band holds the clock and a two-line finding
    const rows = shown().filter((t) => cAt(t, th)).map((t) => { const c0 = cAt(t, th).y; return { ...t, rel: t.pts.filter((p) => p.year >= c0 - 0.01).map((p) => ({ x: p.year - c0, v: p.value })) }; }).filter((t) => t.rel.length > 1);
    if (!rows.length) { hostEl.innerHTML = `<p class="df-note">${shown().length ? `None of the chosen series crosses ${th} percent.` : 'No technology chosen.'}</p>`; markRow(''); return; }
    const maxX = Math.max(5, Math.min(60, d3.max(rows, (t) => t.rel[t.rel.length - 1].x)));
    rows.forEach((t) => { t.rel = t.rel.filter((p) => p.x <= maxX); });
    const x = d3.scaleLinear().domain([0, maxX]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, 100]).range([h - m.b, m.t]);
    const svg = curveSvg(hostEl, w, h, m, 'Adoption curves aligned at the year each technology reached 10 percent of US households');
    svg.append('g').selectAll('line').data(x.ticks(10)).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', h - m.b).attr('stroke', 'rgba(28,26,23,.08)');
    [...new Set([...TH, th])].forEach((t) => svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', THC[t] || 'var(--ink-2)').attr('opacity', 0.4).attr('stroke-dasharray', '2 3'));
    svg.append('g').selectAll('text').data(x.ticks(w < 640 ? 4 : 10)).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', h - 10).attr('text-anchor', 'middle').text((d) => `${d} y`);
    svg.append('g').selectAll('text').data([...new Set([0, 10, 50, 90, 100, th])].sort((a, b) => a - b)).join('text').attr('class', 'pt-tk').attr('x', m.l - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => `${d}%`);
    const ramp = d3.scaleSequential(d3.interpolateRgb('#b4b4ae', '#121212')).domain([1903, 2011]); // ink ramp by start year: the newer, the darker
    const byStart = rows.slice().sort((a, b) => a.start - b.start).map((t) => t.name);
    const color = (start, name) => (rows.length <= ATLAS.length && name ? ATLAS[byStart.indexOf(name)] : ramp(start));
    const line = d3.line().x((p) => x(p.x)).y((p) => y(p.v)).curve(d3.curveMonotoneX);
    const clipId = `df-clip-${Date.now()}`;
    const clip = svg.append('clipPath').attr('id', clipId).append('rect').attr('x', 0).attr('y', 0).attr('width', race ? m.l : w).attr('height', h);
    const gl = svg.append('g').attr('clip-path', `url(#${clipId})`);
    const paths = gl.selectAll('path').data(rows).join('path').attr('class', 'df-curve').attr('data-t', (t) => t.name).attr('d', (t) => line(t.rel)).attr('fill', 'none').attr('stroke', (t) => color(t.start, t.name)).attr('stroke-width', 1.8).style('cursor', 'pointer')
      .on('mouseenter', (ev, t) => { setHi(t.name); tip.show(ev, tipFor(t)); }).on('mousemove', tip.move).on('mouseleave', () => { setHi(null); tip.hide(); }).on('click', (ev, t) => { if (t.anchor) select(t.anchor.id); });
    // end labels: each wants to sit beside its curve's end; the shared placer slides later ones up or down so none
    // overprints, keeps them inside the chart, and a leader line marks any that moved. Curves that run further right
    // pass behind a paper halo on the text.
    const left = narrowR, cxr = left ? m.l : w - 6, cy0 = left ? 8 : m.t;
    // Grow and focus needs its finding sentence placed before the labels, so the labels keep clear of it
    const to90 = (t) => (t.c[90] && t.c[90].kind === 'x' ? t.c[90].y - cAt(t, th).y : null);
    const lead = race ? rows.filter((t) => to90(t) != null).sort((a, b) => to90(a) - to90(b))[0] : null;
    const finding = lead ? `${lead.short}: ${th} to 90 percent in ${plural(Math.round(to90(lead)))}, the soonest of ${rows.length}` : '';
    // the finding wraps inside the clock's column so the labels keep their room
    const fpx = narrowR ? 13 : 15, fmax = left ? w - m.l - 12 : big * 1.5;
    const fw = (t) => t.length * fpx * 0.5; // the canvas measure cannot be trusted before the serif face is in; half an em per character is a safe estimate
    const flines = []; if (lead) { let cur = ''; for (const word of finding.split(' ')) { const t = cur ? `${cur} ${word}` : word; if (cur && fw(t) > fmax) { flines.push(cur); cur = word; } else cur = t; } if (cur) flines.push(cur); }
    const clockBox = race && !left ? [{ x1: cxr - Math.max(big * 1.7, d3.max(flines, fw) || 0) - 6, y1: 0, x2: w, y2: cy0 + big * 0.8 + 24 + flines.length * 18 }] : [];
    const lfont = '10.5px "Instrument Sans", sans-serif';
    const ends = rows.map((t) => { const ex = x(t.rel[t.rel.length - 1].x), ey = y(t.rel[t.rel.length - 1].v); const txt = `${t.short} · ${t.start}`; const lw = textWidth(txt, lfont) + 4; const cb = clockBox[0]; const xl = cb && ex + 6 + lw > cb.x1 && ey < cb.y2 + 8 ? Math.min(ex - 6 - lw, cb.x1 - 8 - lw) : ex + 6 + lw > w - 2 ? ex - 6 - lw : ex + 6; return { t, txt, ex, ey, w: lw, h: 12, pri: t.c[90] ? 2 : 1, cands: slideY(xl, ey, 12, { step: 12, reach: 14 }) }; });
    // the race clock (one dominant numeral plus its five-word label) sits in the top right corner and is kept clear
    // under 240px of plot there is no room for twenty names: each curve ends in a dot in its own color and the name
    // comes on hover or focus (the tooltip and the pick chips above still carry every name)
    const dotsOnly = x.range()[1] - x.range()[0] < 240;
    if (!dotsOnly) placeLabels(ends, { bounds: { x0: m.l - 60, y0: m.t - 6, x1: w, y1: h - m.b + 6 }, gap: 1, keep: true, obstacles: clockBox });
    else ends.forEach((d) => { d.x = d.ex - 3; d.y = d.ey - 3; d.w = 6; d.h = 6; });
    const labels = svg.append('g').selectAll('g').data(ends).join('g').attr('data-t', (d) => d.t.name).attr('transform', (d) => `translate(${d.x},${d.y + d.h / 2})`).attr('opacity', race ? 0 : 1);
    if (dotsOnly) {
      labels.append('circle').attr('cx', 3).attr('r', 3.2).attr('fill', (d) => color(d.t.start, d.t.name)).attr('stroke', GROUND).attr('stroke-width', 1.2).style('cursor', 'pointer')
        .attr('tabindex', 0).attr('role', 'img').attr('aria-label', (d) => d.txt)
        .on('mouseenter', (ev, d) => { setHi(d.t.name); tip.show(ev, `<div class="k">${esc(d.txt)}</div>`); }).on('focus', (ev, d) => { setHi(d.t.name); tip.show(ev, `<div class="k">${esc(d.txt)}</div>`); }).on('mousemove', tip.move).on('mouseleave', () => { setHi(null); tip.hide(); }).on('blur', () => { setHi(null); tip.hide(); });
      labels.append('title').text((d) => d.txt);
    }
    if (!dotsOnly) labels.append('line').attr('x1', (d) => d.ex - d.x).attr('x2', (d) => (d.x > d.ex ? 0 : d.w)).attr('y1', (d) => d.ey - (d.y + d.h / 2)).attr('y2', 0).attr('stroke', 'rgba(28,26,23,.35)');
    if (!dotsOnly) labels.append('text').attr('x', (d) => (d.x > d.ex ? 2 : d.w - 2)).attr('text-anchor', (d) => (d.x > d.ex ? 'start' : 'end')).attr('dy', '0.35em').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10).attr('fill', (d) => color(d.t.start))
      .attr('paint-order', 'stroke').attr('stroke', GROUND).attr('stroke-width', 3).attr('stroke-linejoin', 'round').text((d) => d.txt);
    if (race) {
      // the live year is the largest element in the chart, about ten times its label, so the race reads from across the room
      const clock = svg.append('text').attr('class', 'df-clock').attr('x', cxr).attr('y', cy0 + big * 0.78).attr('text-anchor', left ? 'start' : 'end').attr('font-family', 'Instrument Serif, serif').attr('font-size', big).attr('fill', 'var(--ink)').attr('letter-spacing', '-0.03em').text('0');
      svg.append('text').attr('class', 'pt-tk').attr('x', cxr).attr('y', cy0 + big * 0.78 + 18).attr('text-anchor', left ? 'start' : 'end').attr('fill', 'var(--ink-2)').text(`years since ${th} percent`);
      const dur = 9000, t0 = performance.now();
      // Grow and focus: when every curve has grown, the focus shifts over 400ms, linear, to the technology that
      // reached 90 percent soonest after the crossing; the rest pale, and one finding sentence lands at the upper right
      const findEl = lead ? svg.append('text').attr('class', 'df-finding').attr('font-size', narrowR ? 13 : 15).attr('x', cxr).attr('y', cy0 + big * 0.78 + 34).attr('text-anchor', left ? 'start' : 'end').attr('opacity', 0) : null;
      if (findEl) flines.forEach((ln, i) => findEl.append('tspan').attr('x', cxr).attr('dy', i ? 17 : 0).text(ln));
      const focus = () => { if (!lead) return; svg.classed('df-focus', true); paths.classed('df-lead-t', (t) => t.name === lead.name); labels.classed('df-lead-t', (d) => d.t.name === lead.name); if (findEl) findEl.transition().duration(400).ease(d3.easeLinear).attr('opacity', 1); };
      const fin = () => { clip.attr('width', w); labels.attr('opacity', 1); clock.text(`${Math.round(maxX)}`); focus(); };
      if (reduced()) fin();
      else {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur), e = d3.easeCubicInOut(k), cx = x(maxX * e);
          clip.attr('width', cx); clock.text(`${Math.round(maxX * e)}`);
          labels.attr('opacity', (d) => (d.ex <= cx ? 1 : 0));
          if (k < 1) raceTimer = requestAnimationFrame(step); else { raceTimer = null; setTimeout(focus, 760); }
        };
        raceTimer = requestAnimationFrame(step);
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'df-replay'; btn.textContent = 'Replay'; if (narrowR) { btn.style.left = 'auto'; btn.style.right = '8px'; } btn.addEventListener('click', () => overlay(true)); hostEl.appendChild(btn);
      }
    } else if (!shownOnce.has('overlay') && !reduced()) {
      // first view of the aligned chart: curves draw in along the years axis, earliest technology first; labels follow their line
      labels.attr('opacity', 0);
      const order = new Map(rows.slice().sort((a, b) => a.start - b.start).map((t, i) => [t.name, i]));
      paths.attr('stroke-dasharray', function () { const L = this.getTotalLength(); return `${L} ${L}`; }).attr('stroke-dashoffset', function () { return this.getTotalLength(); });
      whenInView(hostEl, () => {
        shownOnce.add('overlay');
        drawPath(paths, { duration: 800, delay: (t) => Math.min(500, order.get(t.name) * 40) });
        labels.transition().delay((d) => Math.min(500, order.get(d.t.name) * 40) + 700).duration(200).attr('opacity', 1);
      });
    } else shownOnce.add('overlay');
    // marker: a click drops a vertical at N years since the threshold; every curve is read where it crosses
    const gm = svg.append('g').attr('class', 'df-mark');
    const drawMark = () => {
      gm.selectAll('*').remove();
      if (markRel == null) { markRow(''); return; }
      const mx = x(markRel);
      gm.append('line').attr('x1', mx).attr('x2', mx).attr('y1', m.t).attr('y2', h - m.b);
      gm.append('text').attr('class', 'yr').attr('x', mx + 4).attr('y', y(3)).text(`+${Math.round(markRel)} y`);
      const vals = rows.map((t) => [t, valueAt(t.rel, 'x', 'v', markRel)]).filter((d) => d[1] != null).sort((a, b) => b[1] - a[1]);
      vals.forEach(([t, v]) => gm.append('circle').attr('cx', mx).attr('cy', y(v)).attr('r', 3.5).attr('fill', color(t.start, t.name)));
      markRow(`<b>+${Math.round(markRel)} years</b>${vals.map(([t, v]) => `<span>${esc(t.short)} ${Math.round(v)}%</span>`).join('')}`);
    };
    svg.on('click', (ev) => { if (ev.target.tagName === 'path') return; const [mx] = d3.pointer(ev, svg.node()); markRel = Math.max(0, Math.min(maxX, x.invert(mx))); drawMark(); syncPick(); });
    drawMark();
  }

  // ---- months to 100 million users ----
  function hundred() {
    const hostEl = $('.df-100'); if (!hostEl) return; hostEl.innerHTML = '';
    const pts = H100.points.slice().sort((a, b) => a.value - b.value);
    const w = W(), rowH = 24, m = { l: w < 640 ? 70 : 110, r: w < 640 ? 90 : 250, t: 20, b: 6 }, h = m.t + pts.length * rowH + m.b;
    const svg = curveSvg(hostEl, w, h, m, 'Months for products and services to reach 100 million users, shortest first');
    const x = d3.scaleLog().domain([0.1, d3.max(pts, (p) => p.value) * 1.3]).range([m.l, w - m.r]);
    const tks = w < 480 ? [0.1, 1, 12, 60, 240] : [0.1, 1, 6, 12, 24, 60, 120, 240]; // phones: ticks a label apart
    svg.append('g').selectAll('line').data(tks).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t - 4).attr('y2', h - m.b).attr('stroke', 'rgba(28,26,23,.1)');
    svg.append('g').selectAll('text').data(tks).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', m.t - 8).attr('text-anchor', 'middle').text((d) => (d < 1 ? '3 days' : d >= 12 ? `${d / 12} y` : `${d} mo`));
    const g = svg.append('g').selectAll('g').data(pts).join('g').attr('transform', (p, i) => `translate(0,${m.t + i * rowH + rowH / 2})`)
      .on('mouseenter', (ev, p) => tip.show(ev, `<div class="k">${p.year} &middot; ${esc(p.label)}</div><div class="h">${p.value < 1 ? esc(p.detail || '') : plural(p.value, 'month')} to 100 million</div><div class="m">${esc(p.detail || '')}${p.sources && p.sources[0] ? ` &middot; ${esc(host(p.sources[0].url))}` : ''}</div>`)).on('mousemove', tip.move).on('mouseleave', tip.hide);
    g.append('text').attr('x', m.l - 10).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', 'Instrument Serif, serif').attr('font-size', 15).attr('fill', 'var(--ink)').text((p) => p.label);
    g.append('rect').attr('x', m.l).attr('y', -6).attr('width', (p) => Math.max(2, x(Math.max(0.1, p.value)) - m.l)).attr('height', 12).attr('fill', (p) => (p.year >= 2022 ? '#b8282e' : '#2d5a88')).attr('opacity', 0.85);
    // the span label sits after the bar; under 480px the launch year stays in the hover note; a label that would pass the plot width turns end-anchored inside the bar, in ground on the bar colour
    const lab = g.append('text').attr('class', 'pt-tk').attr('x', (p) => x(Math.max(0.1, p.value)) + 6).attr('dy', '0.35em').attr('fill', 'var(--ink-2)').text((p) => `${p.value < 1 ? p.detail : p.value >= 12 ? `${(p.value / 12).toFixed(p.value % 12 ? 1 : 0)} years` : plural(p.value, 'month')}${w < 480 ? '' : ` · launched ${p.year}`}`);
    lab.each(function (p) { const x1 = x(Math.max(0.1, p.value)); const tw = this.getComputedTextLength(); if (x1 + 6 + tw > w - 4) d3.select(this).attr('x', x1 - 6).attr('text-anchor', 'end').attr('fill', 'var(--ground)'); });
    if (w >= 640) g.filter((p) => p.sources && p.sources[0]).append('a').attr('href', (p) => p.sources[0].url).attr('target', '_blank').attr('rel', 'noopener').append('text').attr('class', 'pt-tk').attr('x', w - 4).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', 'var(--ink-3)').text((p) => host(p.sources[0].url));
  }

  function draw() {
    if (raceTimer) { cancelAnimationFrame(raceTimer); raceTimer = null; }
    el.querySelectorAll('.toggle button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.m === 'grid' ? '' : b.dataset.m) === (S.mode === 'race' || S.mode === 'overlay' ? S.mode : ''))));
    lags();
    if (S.mode === 'race') overlay(true); else if (S.mode === 'overlay') overlay(false); else grid();
    syncPick();
    hundred();
  }
  function render(state, ch) { if (ch.has('*')) locLayout(); if (ch.has('*') || ch.has('mode')) draw(); }
  return { render, resize() { draw(); }, hover() {} };
}
