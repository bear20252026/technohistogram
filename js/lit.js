// Shared by the History views: the walk overlay, chip drag and reorder, point in polygon, and two motion helpers.

// prefers-reduced-motion: every reveal below falls back to its final state
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll-linked reveal: run `fn` once, the first time `node` is at least 40 percent in view (or fills 40 percent of
// the viewport, for charts taller than the screen). Under reduced motion `fn` runs at once so the final state shows.
export function whenInView(node, fn, { ratio = 0.4 } = {}) {
  if (!node || typeof IntersectionObserver === 'undefined' || reduced()) { fn(); return; }
  // while the intro overlay covers the page nothing underneath is in view; wait for it to close
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) {
    const mo = new MutationObserver(() => { if (intro.hidden) { mo.disconnect(); whenInView(node, fn, { ratio }); } });
    mo.observe(intro, { attributes: true, attributeFilter: ['hidden'] });
    return;
  }
  const io = new IntersectionObserver((ents) => {
    const e = ents[0];
    if (!e || !e.isIntersecting) return;
    const rootH = e.rootBounds ? e.rootBounds.height : innerHeight;
    if (e.intersectionRatio >= ratio || e.intersectionRect.height >= rootH * ratio) { io.disconnect(); fn(); }
  }, { threshold: [0, 0.1, 0.2, 0.3, ratio, 0.6, 0.8, 1] });
  io.observe(node);
}

// Draw a stroked path in along its own length (the time axis for a curve), in reading order of the data.
export function drawPath(sel, { duration = 700, delay = 0, ease = d3.easeCubicOut } = {}) {
  sel.each(function () {
    const L = this.getTotalLength ? this.getTotalLength() : 0;
    if (!L) return;
    const d = typeof delay === 'function' ? delay.apply(this, arguments) : delay;
    d3.select(this).attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
      .transition().delay(d).duration(duration).ease(ease).attr('stroke-dashoffset', 0).on('end', function () { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
  });
}

// drawLit: the thread's events light up one by one as a walk advances.
// `lit` is { ids, cur, color, index } from tour.js (walkLit) or null; `posOf(id)` returns [x, y] in the
// group's coordinate space, or null when the event is not placed in the current window.
export function drawLit(g, lit, posOf) {
  g.selectAll('*').remove();
  if (!lit || !lit.ids.length) return;
  const pts = [];
  lit.ids.forEach((id) => { const p = posOf(id); if (p && isFinite(p[0]) && isFinite(p[1])) pts.push({ id, p, cur: id === lit.cur }); });
  if (!pts.length) return;
  g.attr('class', 'walk-lit').style('pointer-events', 'none');
  // a step is new when the walk advanced since the last draw; the window slides and redraws many times per step,
  // so the reveal keys on the step and resumes from where it was rather than restarting
  const node = g.node(), key = `${lit.ids.length}|${lit.cur}`, now = performance.now();
  const st = node.__lit || (node.__lit = { key: '', t0: 0 });
  const fresh = st.key !== key;
  if (fresh) { st.key = key; st.t0 = now; }
  const DUR = 600, el = now - st.t0, live = !reduced() && el < DUR;
  if (pts.length > 1) {
    const line = d3.line().x((d) => d.p[0]).y((d) => d.p[1]).curve(d3.curveCatmullRom.alpha(0.6));
    const path = g.append('path').attr('class', 'lit-thread').attr('d', line(pts)).attr('stroke', lit.color);
    if (live) {
      // the dashed path extends from the previous lit event to the new one; a mask slides along the path so the dash pattern stays put
      const L = path.node().getTotalLength();
      const prevL = (() => { const tmp = g.append('path').attr('d', line(pts.slice(0, -1))); const v = tmp.node().getTotalLength(); tmp.remove(); return v; })();
      const mid = `lit-mask-${Math.random().toString(36).slice(2, 8)}`;
      const mk = g.append('mask').attr('id', mid).attr('maskUnits', 'userSpaceOnUse').attr('x', -1e5).attr('y', -1e5).attr('width', 2e5).attr('height', 2e5);
      const cover = mk.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 6).attr('stroke-dasharray', `${L} ${L}`);
      const k0 = d3.easeCubicOut(el / DUR), hid = (L - prevL) * (1 - k0);
      cover.attr('stroke-dashoffset', hid).transition().duration(DUR - el).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0).on('end', () => { path.attr('mask', null); mk.remove(); });
      path.attr('mask', `url(#${mid})`);
    }
  }
  const n = g.selectAll('g.lit').data(pts, (d) => d.id).join('g')
    .attr('class', (d) => 'lit' + (d.cur ? ' cur' : ''))
    .attr('transform', (d) => `translate(${d.p[0]},${d.p[1]})`);
  // a white glow reads as light on any band colour; the dot carries the thread colour with an ink core
  n.append('circle').attr('class', 'glow').attr('r', (d) => (d.cur ? 14 : 7));
  n.filter((d) => d.cur).append('circle').attr('class', 'ring').attr('r', 9).attr('stroke', lit.color);
  const dot = n.append('circle').attr('class', 'dot').attr('fill', lit.color).attr('r', (d) => (d.cur ? (live ? 5.5 * d3.easeCubicOut(Math.max(0, Math.min(1, (el - (DUR - 320)) / 320))) : 5.5) : 3.6));
  n.append('circle').attr('class', 'core').attr('r', (d) => (d.cur ? 1.8 : 1.2));
  // the current event lights up as its path arrives rather than appearing
  if (live) dot.filter((d) => d.cur).transition().delay(Math.max(0, DUR - el - 320)).duration(Math.min(320, DUR - el)).ease(d3.easeCubicOut).attr('r', 5.5);
}

// Chips that reorder by drag and toggle by click (pointer events; keyboard clicks still arrive as click events
// with detail 0). `onReorder(ids)` gets the new order after a drag; `onClick(id, chip)` after a plain press.
export function chipDrag(container, { onReorder, onClick, sel = '.hp-chip', key = 'd' } = {}) {
  let drag = null;
  container.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest(sel);
    if (!b || !container.contains(b) || ev.button) return;
    drag = { b, id: b.dataset[key], x0: ev.clientX, y0: ev.clientY, moved: false, pid: ev.pointerId };
    try { b.setPointerCapture(ev.pointerId); } catch {}
  });
  container.addEventListener('pointermove', (ev) => {
    if (!drag || !onReorder) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 5) return;
    drag.moved = true; drag.b.classList.add('dragging');
    const chips = [...container.querySelectorAll(sel)];
    const over = chips.find((c) => { if (c === drag.b) return false; const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; });
    if (!over) return;
    const r = over.getBoundingClientRect();
    const horizontal = r.width > r.height * 1.4 && chips.length > 1 && Math.abs(chips[0].getBoundingClientRect().top - chips[chips.length - 1].getBoundingClientRect().top) < r.height;
    const before = horizontal || container.classList.contains('row') ? ev.clientX < r.left + r.width / 2 : ev.clientY < r.top + r.height / 2;
    const parent = over.parentNode;
    if (before) parent.insertBefore(drag.b, over); else parent.insertBefore(drag.b, over.nextSibling);
  });
  const end = (ev) => {
    if (!drag) return;
    const d = drag; drag = null;
    d.b.classList.remove('dragging');
    try { d.b.releasePointerCapture(d.pid); } catch {}
    if (d.moved) { if (onReorder) onReorder([...container.querySelectorAll(sel)].map((c) => c.dataset[key])); }
    else if (onClick && ev.type === 'pointerup') onClick(d.id, d.b, ev);
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
  container.addEventListener('click', (ev) => { const b = ev.target.closest(sel); if (b && ev.detail === 0 && onClick) onClick(b.dataset[key], b, ev); });
}

// ray casting: is [x, y] inside the polygon of [x, y] points
export function inPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
