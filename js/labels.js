// Shared greedy label placer. Every chart that names points on a canvas (Stream annotations, Diffusion race end
// labels, Pattern scatters, Capital Sankey nodes, Lineage founders) runs its labels through here so that no two
// labels overprint and none runs off the edge. Labels are placed in priority order; each tries its candidate
// boxes in order and takes the first that is inside the bounds, clear of obstacles and clear of labels already
// placed. A label whose candidates all fail is hidden (or, with `keep`, left at its first candidate and flagged).
//
// item: { w, h, pri, cands: [[x, y], ...] (top-left corners, best first), accept?: (box) => boolean, ...anything }
// returns the same items with x, y, ci (chosen candidate index), displaced (ci > 0) and hidden set.

const overlaps = (a, b, gap) => !(a.x2 < b.x1 - gap || a.x1 > b.x2 + gap || a.y2 < b.y1 - gap || a.y1 > b.y2 + gap);

export function placeLabels(items, { bounds = null, obstacles = [], gap = 2, keep = false } = {}) {
  const placed = obstacles.slice();
  const order = items.slice().sort((a, b) => (b.pri || 0) - (a.pri || 0));
  for (const it of order) {
    it.hidden = true; it.displaced = false; it.ci = -1;
    const cands = typeof it.cands === 'function' ? it.cands() : it.cands;
    for (let i = 0; i < cands.length; i++) {
      const [x, y] = cands[i];
      const box = { x1: x, y1: y, x2: x + it.w, y2: y + it.h };
      if (bounds && (box.x1 < bounds.x0 || box.x2 > bounds.x1 || box.y1 < bounds.y0 || box.y2 > bounds.y1)) continue;
      if (it.accept && !it.accept(box)) continue;
      if (placed.some((p) => overlaps(p, box, gap))) continue;
      it.x = x; it.y = y; it.ci = i; it.hidden = false; it.displaced = i > 0; it.box = box;
      placed.push(box);
      break;
    }
    if (it.hidden && keep && cands.length) { const [x, y] = cands[0]; it.x = x; it.y = y; it.ci = 0; it.box = { x1: x, y1: y, x2: x + it.w, y2: y + it.h }; }
  }
  return items;
}

// Candidate corners for a label that wants to sit at (x, y) and may slide up or down in steps, nearest first.
// `h` is the label height; the box is vertically centred on y.
export function slideY(x, y, h, { step = 12, reach = 6, down = true, up = true } = {}) {
  const out = [[x, y - h / 2]];
  for (let k = 1; k <= reach; k++) {
    if (down) out.push([x, y - h / 2 + k * step]);
    if (up) out.push([x, y - h / 2 - k * step]);
  }
  return out;
}

// Candidate corners around a point: right, left, above, below, then the diagonals, at a given offset.
export function around(px, py, w, h, off = 6) {
  return [
    [px + off, py - h / 2], [px - off - w, py - h / 2],
    [px - w / 2, py - off - h], [px - w / 2, py + off],
    [px + off, py - off - h], [px - off - w, py - off - h], [px + off, py + off], [px - off - w, py + off],
  ];
}

// Text width through a shared canvas, in the font the label is drawn with.
let _ctx = null;
export function textWidth(text, font) {
  const c = _ctx || (_ctx = document.createElement('canvas').getContext('2d'));
  c.font = font;
  return c.measureText(String(text)).width;
}
