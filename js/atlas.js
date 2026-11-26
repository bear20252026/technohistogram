// Correlated Atlas: the pieces the History views share so their time scaffold reads as one.
// One span (1026 to 2026), one set of scale breaks with the interval years repeated at each section,
// five family hues in a fixed order for a view with five or fewer families, and a locator strip
// for the upper right corner that shows the whole span with the current window in red.
import { YEAR_MIN, YEAR_MAX } from './time.js';

export const ATLAS = ['#AB1006', '#E25D13', '#ECB800', '#8EB7C3', '#4F6D4A'];
export const BREAKS = [1500, 1800, 1900, 1950, 2000];
export const SECTIONS = [YEAR_MIN, ...BREAKS, YEAR_MAX + 1];

// family hue by position when the view shows five or fewer families, otherwise the fallback
export const familyHue = (i, n, fallback) => (n <= ATLAS.length ? ATLAS[i % ATLAS.length] : fallback);

// equal width per section between breaks: unequal intervals, so the breaks are drawn as double strokes
export function sectionScale(x0, x1) {
  const w = (x1 - x0) / (SECTIONS.length - 1);
  const f = (y) => {
    const t = Math.max(YEAR_MIN, Math.min(YEAR_MAX + 1, y));
    let i = 0;
    while (i < SECTIONS.length - 2 && t >= SECTIONS[i + 1]) i++;
    return x0 + w * (i + (t - SECTIONS[i]) / (SECTIONS[i + 1] - SECTIONS[i]));
  };
  f.sectionW = w;
  return f;
}

// the strip: baseline, double-stroke breaks with the year under each, the window as a red outline.
// update(y0, y1) jumps the window with no transition (a cut moves window and locator together);
// layout(width) redraws the strip at a new width (240 to 300px on a desk, the full row on a phone). Labels never drop under 9px.
export function atlasLocator(host, { width = 260, title = 'Where these years sit in the millennium' } = {}) {
  const h = 28, top = 6, bar = 9;
  const svg = d3.select(host).append('svg').attr('class', 'atlas-loc').attr('role', 'img');
  svg.append('title').text(title);
  let X, win, cur = null, W = 0;
  function build(w) {
    W = Math.max(120, Math.round(w));
    const left = 1, right = W - 1;
    svg.attr('width', W).attr('height', h).attr('viewBox', `0 0 ${W} ${h}`);
    svg.selectAll('*:not(title)').remove();
    X = sectionScale(left, right);
    svg.append('line').attr('class', 'al-base').attr('x1', left).attr('x2', right).attr('y1', top + bar).attr('y2', top + bar);
    const gb = svg.append('g').attr('class', 'al-breaks');
    for (const b of BREAKS) {
      const x = X(b);
      gb.append('path').attr('class', 'al-brk').attr('d', `M${x - 3},${top + bar + 2}L${x + 0.5},${top - 1}M${x + 1},${top + bar + 2}L${x + 4.5},${top - 1}`);
      gb.append('text').attr('class', 'al-yr').attr('x', x).attr('y', h - 2).attr('text-anchor', 'middle').text(b);
    }
    svg.append('text').attr('class', 'al-yr').attr('x', left).attr('y', h - 2).attr('text-anchor', 'start').text(YEAR_MIN);
    svg.append('text').attr('class', 'al-yr').attr('x', right).attr('y', h - 2).attr('text-anchor', 'end').text(YEAR_MAX);
    win = svg.append('rect').attr('class', 'al-win').attr('y', top).attr('height', bar);
    if (cur) api.update(cur[0], cur[1]);
  }
  const api = {
    svg,
    layout(w) { if (Math.round(w) !== W) build(w); return api; },
    update(y0, y1) {
      cur = [y0, y1];
      const a = X(y0), b = Math.max(X(y1 + 1), a + 2);
      win.interrupt().attr('x', a).attr('width', b - a);
      svg.select('title').text(`${title}: ${y0} to ${y1}`);
      return api;
    },
  };
  build(width);
  return api;
}

// the locator's width for a view: 240 to 300px on a desk, the full row on a phone
export const locatorWidth = (viewW, phone, rowW) => (phone ? Math.max(200, rowW) : Math.max(240, Math.min(300, Math.round(viewW * 0.19))));

// the family label at a lane's end: mono, medium weight (shared so the three views match)
export const laneLabel = (sel) => sel.attr('font-family', 'Instrument Sans, monospace').attr('font-size', 9.5).attr('font-weight', 500).attr('letter-spacing', '0.05em').attr('fill', '#3a3a38');
