// LINEAGE STRIP (Today): labs founded since 2010 as rows at their founding date; an arc links each founder to the lab
// they left. Arcs draw in founding order with a traveling dot the first time the strip is in view; hovering or
// focusing a lab crisps its founders' arcs and labels them in place. The store still aliases the old "talent" view
// to this strip, which today.js mounts from here.
import { esc, roving } from '../ui.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = d3.easeCubicOut;
// the entrance runs once per page; a rebuild after a resize draws at once
let shown = false;

export function lineageStrip(box, { db, select, tip }) {
  if (!box || !db.talent) { if (box) box.innerHTML = ''; return; }
  if (!box._roving) { box._roving = true; roving(box); }  // one Tab stop for the strip; arrows move between labs
  const orgs = [...db.orgById.values()].filter((o) => o.t && o.t >= 2010).sort((a, b) => a.t - b.t);
  const people = [...db.personById.values()];
  const byName = new Map(people.map((p) => [p.name.toLowerCase(), p]));
  const orgName = (id) => (db.orgById.get(id) || {}).name || id;
  // for each org: founders and the org each came from (last move into this org, or the previous role)
  const rows = orgs.map((o) => {
    const fs = (o.founders || []).map((n) => {
      const p = byName.get(n.toLowerCase());
      let from = null;
      if (p) {
        const mv = p.moves.filter((m) => m.to_org === o.id).sort((a, b) => a.t - b.t)[0];
        if (mv) from = mv.from_org;
        else { const r = (p.roles || []).filter((x) => x.org_id && x.org_id !== o.id && x.start && x.start < (o.founded || '9999')).sort((a, b) => (b.start || '').localeCompare(a.start || ''))[0]; if (r) from = r.org_id || r.org; }
      }
      return { name: n, p, from };
    });
    return { o, fs };
  }).filter((r) => r.fs.length);
  // the left gutter is sized to the longest lab name so nothing is clipped at the edge
  // on a phone the gutter is capped and long names are shortened, so the first arcs are on screen without scrolling
  const mctx = document.createElement('canvas').getContext('2d'); mctx.font = '13px Instrument Sans, serif';
  const narrow = box.clientWidth < 600;
  const L = narrow ? 132 : Math.min(320, Math.max(200, Math.ceil(d3.max(rows, (r) => mctx.measureText(r.o.name).width)) + 26));
  const fit = (t, w) => { mctx.font = '13px Instrument Sans, serif'; if (mctx.measureText(t).width <= w) return t; let x = t; while (x.length > 3 && mctx.measureText(x + '\u2026').width > w) x = x.slice(0, -1); return x.trimEnd() + '\u2026'; };
  const W = Math.max(900, box.clientWidth - 2), rowH = 28, R = 24, top = 26;
  const H = top + rows.length * rowH + 20;
  const x = d3.scaleLinear().domain([2010, 2027]).range([L, W - R]);
  const yOf = new Map(rows.map((r, i) => [r.o.id, top + i * rowH + rowH / 2]));
  // one arc per (from lab, to lab) pair; several founders from the same lab share the path and its label
  const pairMap = new Map();
  rows.forEach((r) => r.fs.forEach((f) => {
    if (!f.from || !yOf.has(f.from)) return;
    const k = f.from + '>' + r.o.id;
    if (!pairMap.has(k)) pairMap.set(k, { from: f.from, to: r.o.id, t: r.o.t, fs: [] });
    pairMap.get(k).fs.push(f);
  }));
  const arcs = [...pairMap.values()].sort((a, b) => a.t - b.t || yOf.get(a.from) - yOf.get(b.from));
  const nF = d3.sum(arcs, (a) => a.fs.length);
  if (narrow) { lineageList(box, { rows, arcs, nF, people, db, orgName, select }); return; }
  box.innerHTML = `<div class="ln-head"><div><span class="sc" style="color:var(--ink-3)">${rows.length} labs founded since 2010</span><h2>Who founded what</h2><p class="dek">Each row is one lab at its founding date. An arc links a founder to the lab they left; a thicker arc carries more founders. Hover a row to see its founders named on their arcs; click a name to open its record.</p>
      <p class="ln-contract"><span class="sc">Encoding</span> one row per lab at its founding date; each arc runs from the lab a founder left, weighted by its founders. Hover a lab.</p></div><div class="ln-note">${people.length} people and ${db.moves.length} dated moves, each with a source. ${nF} founders traced to a prior lab.</div></div>
    <div class="ln-strip"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Founding lineage of AI labs since 2010"></svg></div>
    <footer class="ln-foot"><span><b>Source</b> ${people.length} people and ${db.moves.length} dated moves, each with a source; open a name for its record.</span><span><b>Dates</b> founding dates and moves through October 2026; a founder is traced only where the record names the lab they left.</span><span><b>Denominator</b> ${rows.length} labs founded from 2010 on with at least one founder in the record; ${nF} of ${rows.reduce((n, r) => n + r.fs.length, 0)} founders traced to a prior lab.</span></footer>`;
  const svg = d3.select(box).select('svg');
  const years = d3.range(2010, 2027, 2);
  svg.append('g').selectAll('line').data(years).join('line').attr('x1', x).attr('x2', x).attr('y1', top - 10).attr('y2', H - 14).attr('stroke', 'var(--rule)');
  svg.append('g').selectAll('text').data(years).join('text').attr('class', 'ln-yr').attr('x', x).attr('y', top - 14).attr('text-anchor', 'middle').text((d) => d);
  const sx = (d) => Math.max(x((db.orgById.get(d.from) || {}).t || 2010), L) + 4;
  const path = (d) => { const y0 = yOf.get(d.from), y1 = yOf.get(d.to), x0 = sx(d), x1 = x(db.orgById.get(d.to).t); return `M${x0},${y0}C${x1},${y0} ${x0},${y1} ${x1 - 4},${y1}`; };
  const names = (d, k = 4) => d.fs.slice(0, k).map((f) => f.name).join(', ') + (d.fs.length > k ? ` +${d.fs.length - k}` : '');
  const anim = !RM();
  const gA = svg.append('g');
  const arcSel = gA.selectAll('path').data(arcs).join('path').attr('class', 'ln-arc' + (anim ? ' pending' : '')).attr('data-from', (d) => d.from).attr('data-to', (d) => d.to)
    .attr('stroke', 'var(--ink)').attr('stroke-width', (d) => Math.min(3.2, 1.2 + 0.45 * (d.fs.length - 1))).attr('d', path)
    .on('mouseenter', (ev, d) => { tip.show(ev, `<div class="k">Founder${d.fs.length > 1 ? 's' : ''}</div><div class="h">${esc(names(d, 8))}</div><div class="m">${esc(orgName(d.from))} &rarr; ${esc(orgName(d.to))}</div>`); hi(d.to); })
    .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); hi(null); })
    .on('click', (ev, d) => { const f = d.fs.find((f) => f.p); if (f) select(f.p.id); });
  const gR = svg.append('g');
  const row = gR.selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${yOf.get(r.o.id)})`).attr('class', 'ln-row').attr('data-org', (r) => r.o.id)
    .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (r) => `${r.o.name}, founded ${Math.floor(r.o.t)} by ${r.fs.map((f) => f.name).join(', ')}`)
    .on('mouseenter', (ev, r) => hi(r.o.id)).on('mouseleave', () => hi(null))
    .on('focus', (ev, r) => hi(r.o.id)).on('blur', () => hi(null))
    .on('keydown', (ev, r) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const f = r.fs.find((f) => f.p); if (f) select(f.p.id); } });
  row.append('line').attr('x1', L - 8).attr('x2', W - R).attr('y1', 0).attr('y2', 0).attr('stroke', 'var(--ground-3)');
  row.append('text').attr('class', 'ln-org').attr('x', L - 14).attr('text-anchor', 'end').attr('dy', '0.35em').text((r) => fit(r.o.name, L - 18))
    .on('click', (ev, r) => { const f = r.fs.find((f) => f.p); if (f) select(f.p.id); })
    .filter((r) => fit(r.o.name, L - 18) !== r.o.name).append('title').text((r) => r.o.name);
  row.append('circle').attr('class', 'ln-dot').attr('cx', (r) => x(r.o.t)).attr('r', 4.5).attr('fill', 'var(--ink)').attr('stroke', 'var(--ground)').attr('stroke-width', 1.5);
  // founder names sit above the row line with a ground halo, so the arcs that leave the dot never strike them through;
  // a dot in the last 15 percent of the axis carries its label on its left, so the newest labs are never cut at the edge
  const flip = (r) => x(r.o.t) > L + 0.85 * (W - R - L);
  const lab = row.append('text').attr('class', 'ln-yr ln-founders').attr('x', (r) => (flip(r) ? x(r.o.t) - 10 : x(r.o.t) + 10)).attr('text-anchor', (r) => (flip(r) ? 'end' : 'start')).attr('y', -9).attr('dy', '0.35em').attr('stroke-linejoin', 'round').text((r) => `${Math.floor(r.o.t)} · ${r.fs.map((f) => f.name.split(' ').pop()).slice(0, 5).join(', ')}${r.fs.length > 5 ? ` +${r.fs.length - 5}` : ''}`)
    // a label that would still run out of room drops names into its "+N" count instead of being cut
    .each(function (r) {
      const t = d3.select(this), room = flip(r) ? x(r.o.t) - 10 - L - 4 : W - R - x(r.o.t) - 12;
      const last = r.fs.map((f) => f.name.split(' ').pop());
      let k = Math.min(5, last.length);
      while (k > 1 && this.getComputedTextLength() > room) { k -= 1; t.text(`${Math.floor(r.o.t)} · ${last.slice(0, k).join(', ')} +${last.length - k}`); }
    });
  // every founders label gets a ground plate, and the arcs are masked out behind the plates, so an arc that
  // leaves a dot or crosses a row runs under the label instead of through it
  const mask = svg.insert('defs', ':first-child').append('mask').attr('id', 'ln-mask');
  mask.append('rect').attr('width', W).attr('height', H).attr('fill', '#fff');
  lab.each(function (r) {
    const b = this.getBBox(), y0 = yOf.get(r.o.id);
    d3.select(this.parentNode).insert('rect', 'text.ln-founders').attr('class', 'ln-plate').attr('x', b.x - 3).attr('y', b.y - 1).attr('width', b.width + 6).attr('height', b.height + 2).attr('fill', 'var(--ground)');
    mask.append('rect').attr('x', b.x - 3).attr('y', y0 + b.y - 1).attr('width', b.width + 6).attr('height', b.height + 2).attr('fill', '#000');
  });
  gA.attr('mask', 'url(#ln-mask)');
  const gL = svg.append('g').attr('class', 'ln-lbls');

  // hover or focus: the lab's founders' arcs crisp and carry their names at the arc's midpoint
  function hi(org) {
    svg.classed('ln-dim', !!org);
    arcSel.classed('hi', (d) => org && d.to === org).classed('mid', (d) => org && d.from === org && d.to !== org);
    row.classed('hi', (r) => org && (r.o.id === org || arcs.some((a) => a.to === org && a.from === r.o.id)));
    row.select('text.ln-founders').classed('hi', (r) => org && r.o.id === org);
    gL.selectAll('*').remove();
    if (!org) return;
    const labels = [];
    const centers = [...yOf.values()];
    arcSel.filter((d) => d.to === org).each(function (d) {
      const len = this.getTotalLength(), m = this.getPointAtLength(len * 0.5);
      // the label sits just under the nearest row line, the one band each row keeps free of its founders label
      const near = centers.reduce((a, c) => (Math.abs(c - m.y) < Math.abs(a - m.y) ? c : a), centers[0]);
      labels.push({ d, x: m.x, y: near + 11 });
    });
    // two labels in the same band step down a row band each
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y < labels[i - 1].y + rowH) labels[i].y = labels[i - 1].y + rowH;
    const t = gL.selectAll('text').data(labels).join('text').attr('class', 'ln-lbl').attr('x', (l) => l.x).attr('y', (l) => l.y).attr('text-anchor', 'middle');
    t.append('tspan').text((l) => names(l.d));
    t.append('tspan').attr('class', 'from').text((l) => ` from ${orgName(l.d.from)}`);
    // keep labels inside the drawn width
    t.each(function () { const w = this.getComputedTextLength(), cx = +this.getAttribute('x'); const nx = Math.max(L + w / 2, Math.min(W - R - w / 2, cx)); if (nx !== cx) this.setAttribute('x', nx); });
  }

  // the first time the strip is in view the arcs draw in founding order, each with a dot that travels from the lab a
  // founder left to the lab they started; a redraw (resize) that is already in view draws at once
  function reveal() {
    if (shown) { arcSel.classed('pending', false); return; }
    // behind the arrival overlay nothing is seen, so the draw waits for it to close
    if (document.body.classList.contains('intro-open')) { addEventListener('histomap:intro-closed', reveal, { once: true }); return; }
    shown = true;
    if (!anim) { arcSel.classed('pending', false); return; }
    const per = 420, gap = Math.min(70, Math.max(25, 1500 / Math.max(1, arcs.length)));
    arcSel.each(function (d, i) {
      const len = this.getTotalLength(), el = d3.select(this);
      el.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).classed('pending', false);
      el.transition().delay(i * gap).duration(per).ease(EASE).attr('stroke-dashoffset', 0).on('end', () => el.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
      const dot = gA.append('circle').attr('class', 'ln-travel').attr('r', Math.min(5, 2.5 + 0.4 * (d.fs.length - 1))).attr('fill', 'var(--ink)').attr('opacity', 0);
      const node = this;
      dot.transition().delay(i * gap).duration(per).ease(EASE).attr('opacity', 1).attrTween('cx', () => (t) => node.getPointAtLength(len * t).x).attrTween('cy', () => (t) => node.getPointAtLength(len * t).y)
        .transition().duration(160).attr('opacity', 0).remove();
    });
  }
  const strip = box.querySelector('.ln-strip');
  const r0 = strip.getBoundingClientRect();
  if (shown || (r0.top < innerHeight * 0.6 && r0.bottom > innerHeight * 0.2)) reveal();
  else {
    // the strip can be taller than a phone screen, so "in view" means it crosses the middle half of the viewport
    const io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { io.disconnect(); reveal(); } }, { rootMargin: '-25% 0px -25% 0px', threshold: 0 });
    io.observe(strip);
  }
}

// Under 600px the strip gives way to a ruled record: one row per lab in founding order with the year, the lab, the
// labs its founders left and the founder count as a two-digit numeral. Rows appear top to bottom at 80ms when the
// list comes into view; a tap opens the first founder's record.
function lineageList(box, { rows, arcs, nF, people, db, orgName, select }) {
  const fromOf = (r) => { const seen = []; r.fs.forEach((f) => { if (f.from && !seen.includes(f.from)) seen.push(f.from); }); return seen; };
  const li = rows.map((r, i) => {
    const from = fromOf(r), f0 = r.fs.find((f) => f.p);
    return `<li class="ln-li" style="--d:${i * 80}ms"><button type="button" class="ln-lirow" data-org="${esc(r.o.id)}"${f0 ? '' : ' disabled'} aria-label="${esc(r.o.name)}, founded ${Math.floor(r.o.t)}, ${r.fs.length} founder${r.fs.length === 1 ? '' : 's'}${from.length ? ', from ' + esc(from.map(orgName).join(', ')) : ''}">
      <span class="ln-ly">${Math.floor(r.o.t)}</span><span class="ln-ll"><span class="ln-ln">${esc(r.o.name)}</span><span class="ln-lf">${from.length ? 'from ' + esc(from.map(orgName).join(', ')) : 'origin not traced'}</span></span><span class="ln-lc">${String(r.fs.length).padStart(2, '0')}</span></button></li>`;
  }).join('');
  box.innerHTML = `<div class="ln-head"><div><span class="sc" style="color:var(--ink-3)">${rows.length} labs founded since 2010</span><h2>Who founded what</h2><p class="dek">Each row is one lab in founding order, with the labs its founders left. Tap a row to open its first founder's record.</p>
      <p class="ln-contract"><span class="sc">Encoding</span> one row per lab; the year is its founding; the second line names the labs its founders left; the numeral counts founders. Tap a row.</p></div><div class="ln-note">${people.length} people and ${db.moves.length} dated moves, each with a source. ${nF} founders traced to a prior lab.</div></div>
    <ol class="ln-list" aria-label="Labs founded since 2010, in founding order"><li class="ln-lh" aria-hidden="true"><span class="ln-ly">founded</span><span class="ln-ll">lab, and the labs its founders left</span><span class="ln-lc">n</span></li>${li}</ol>
    <footer class="ln-foot"><span><b>Source</b> ${people.length} people and ${db.moves.length} dated moves, each with a source; open a name for its record.</span><span><b>Dates</b> founding dates and moves through October 2026; a founder is traced only where the record names the lab they left.</span><span><b>Denominator</b> ${rows.length} labs founded from 2010 on with at least one founder in the record; ${nF} of ${rows.reduce((n, r) => n + r.fs.length, 0)} founders traced to a prior lab.</span></footer>`;
  box.querySelectorAll('.ln-lirow').forEach((b) => b.addEventListener('click', () => { const r = rows.find((x) => x.o.id === b.dataset.org); const f = r && r.fs.find((x) => x.p); if (f) select(f.p.id); }));
  const list = box.querySelector('.ln-list');
  const reveal = () => { shown = true; list.classList.add('in'); };
  if (shown || RM()) { list.classList.add('now'); reveal(); return; }
  const r0 = list.getBoundingClientRect();
  if (r0.top < innerHeight * 0.8 && r0.bottom > innerHeight * 0.2) reveal();
  else { const io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { io.disconnect(); reveal(); } }, { rootMargin: '-15% 0px -15% 0px', threshold: 0 }); io.observe(list); }
}
