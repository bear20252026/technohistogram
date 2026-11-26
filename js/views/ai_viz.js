// Shared pictures for the AI page's two-ink and blueprint sheets: every figure gets a drawing, rendered in pixels at the
// measured width so mono labels stay 12px and strokes stay their width at every size. A spec is kept per placeholder;
// drawAll renders each as an SVG sized to its box. Classes, not colours: .o is the one accent shape or line per
// picture, .b the rest, .hollow an outline, .base the baseline, .vt a mono label; the sheet's CSS maps them to inks.
import { esc } from '../ui.js';

const tOf = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
const yearOf = (d) => +String(d).slice(0, 4);
export const num = (v, d = 0) => (v == null || Number.isNaN(+v) ? '' : (+v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));

export function createViz(cls = 'viz') {
  const VIZ = new Map(); let vizN = 0;
  const vz = (spec) => { const id = `${cls}${++vizN}`; VIZ.set(id, spec); return `<div class="${cls}" data-vz="${id}" style="height:${spec.h || 72}px"></div>`; };
  const CH7 = 7.3; // px per mono character at 12px
  const tw = (s) => String(s).length * CH7;
  const T = (x, y, t, c = '') => `<text class="vt ${c}" x="${x.toFixed ? x.toFixed(1) : x}" y="${y.toFixed ? y.toFixed(1) : y}">${esc(String(t))}</text>`;
  const fit = (s, px) => { s = String(s); const n = Math.floor(px / CH7); return s.length <= n ? s : n <= 2 ? '' : `${s.slice(0, n - 1)}\u2026`; };
  const DRAW = {
    // a line with a baseline, first and last values in mono at the ends, the last point marked
    line(s, w, h) {
      const P = s.pts.filter((p) => !s.log || p[1] > 0); if (P.length < 2) return '';
      const xs = P.map((p) => (typeof p[0] === 'number' ? p[0] : tOf(p[0]))), ys = P.map((p) => (s.log ? Math.log10(p[1]) : p[1]));
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = s.zero && !s.log ? 0 : Math.min(...ys), y1 = Math.max(...ys);
      const f = s.fmt || ((v) => num(v)), a = s.years ? String(yearOf(P[0][0])) : f(P[0][1]), b = s.years ? String(yearOf(P[P.length - 1][0])) : f(P[P.length - 1][1]);
      const ya = P[0][0], yb = P[P.length - 1][0], wide = w >= 200;
      let la = wide && !s.years ? `${a} \u00b7 ${yearOf(ya)}` : a, lb = wide && !s.years ? `${b} \u00b7 ${yearOf(yb)}` : b;
      let two = !wide && !s.years;
      if (tw(la) + tw(lb) + 10 > w) { la = a; lb = b; two = !s.years; }
      if (tw(la) + tw(lb) + 10 > w) { la = a.replace(/\s\S+$/, ''); lb = b.replace(/\s\S+$/, ''); }
      const top = s.bare ? 3 : 12, base = s.bare ? h - 3 : h - (two ? 30 : 18);
      const X = (x) => 3 + ((x - x0) / Math.max(1e-9, x1 - x0)) * (w - 6), Y = (y) => base - ((y - y0) / Math.max(1e-9, y1 - y0)) * (base - top);
      const pathD = xs.map((x, i) => `${i ? (s.step ? `H${X(x).toFixed(1)}V` : 'L') : 'M'}${s.step && i ? Y(ys[i]).toFixed(1) : `${X(x).toFixed(1)} ${Y(ys[i]).toFixed(1)}`}`).join('');
      const lx = X(xs[xs.length - 1]), ly = Y(ys[ys.length - 1]);
      const falling = P[0][1] > P[P.length - 1][1];
      const logTag = s.log ? T(falling ? w : 0, 9, 'log', falling ? 'e' : '') : '';
      const ends = two ? `${T(0, h - 16, la)}${T(w, h - 16, lb, 'e')}${T(0, h - 3, String(yearOf(ya)))}${T(w, h - 3, String(yearOf(yb)), 'e')}` : `${T(0, h - 4, la)}${T(w, h - 4, lb, 'e')}`;
      if (s.bare) return `<path class="o" d="${pathD}"/><circle class="b" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5"/>`; // the mark alone: the line and its latest point
      return `<line class="base" x1="0" y1="${base}" x2="${w}" y2="${base}"/><path class="o" d="${pathD}"/><circle class="b" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3"/>${logTag}${ends}`;
    },
    step(s, w, h) { return DRAW.line({ ...s, step: true }, w, h); },
    // vertical bars, the highlighted one orange, a key under each and the value above when they fit
    bars(s, w, h) {
      const V = s.vals, n = V.length, m = Math.max(...V.map((v) => v.v)), gap = s.bare ? 3 : 4, bw = (w - gap * (n - 1)) / n, top = s.bare ? 2 : 16, base = s.bare ? h - 2 : h - 18;
      const f = s.fmt || ((v) => num(v));
      if (s.bare) return V.map((v, i) => { const bh = Math.max(1.5, (v.v / m) * (base - top)); const x = i * (bw + gap); const hi = s.hi === i || (s.hi === 'last' && i === n - 1) || (s.hi === 'max' && v.v === m); return `<rect class="${hi ? 'o' : 'b'}" x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"/>`; }).join(''); // the mark alone
      return `<line class="base" x1="0" y1="${base}" x2="${w}" y2="${base}"/>${V.map((v, i) => { const bh = Math.max(1.5, (v.v / m) * (base - top)); const x = i * (bw + gap); const hi = s.hi === i || (s.hi === 'last' && i === n - 1) || (s.hi === 'max' && v.v === m); const lab = fit(f(v.v), bw + gap - 2), key = tw(v.k) <= bw + gap - 2 ? v.k : String(v.k).slice(0, 1); return `<rect class="${hi ? 'o' : 'b'}${v.hollow ? ' hollow' : ''}" x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"/>${lab ? T(x + bw / 2, base - bh - 4, lab, 'c') : ''}${key ? T(x + bw / 2, h - 4, key, 'c') : ''}`; }).join('')}`;
    },
    // horizontal bars, a ladder: key at the left, value at the end of the bar; the highlighted one orange
    hbars(s, w, h) {
      const V = s.vals, n = V.length, m = s.max || Math.max(...V.map((v) => v.v)), kw = Math.min(w >= 160 ? 84 : 64, Math.max(...V.map((v) => tw(v.k))) + 6), rh = h / n, bh = Math.min(10, rh - 6);
      const f = s.fmt || ((v) => num(v)), span = w - kw;
      return V.map((v, i) => { const y = i * rh + rh / 2; const bl = Math.max(1.5, (v.v / m) * (span - tw(f(v.v)) - 6)); const hi = s.hi === i || (s.hi === 'last' && i === n - 1) || (s.hi === 'max' && v.v === m); return `${T(0, y + 4, fit(v.k, kw - 4))}<rect class="${hi ? 'o' : 'b'}${v.hollow ? ' hollow' : ''}" x="${kw}" y="${(y - bh / 2).toFixed(1)}" width="${bl.toFixed(1)}" height="${bh}"/>${T(kw + bl + 5, y + 4, f(v.v))}`; }).join('');
    },
    // a count as squares, k of n filled
    squares(s, w, h) {
      const sz = s.size || 14, gap = 4, per = Math.max(1, Math.floor((w + gap) / (sz + gap))), rows = Math.ceil(s.n / per), oy = Math.max(0, (h - rows * (sz + gap)) / 2);
      return Array.from({ length: s.n }, (_, i) => `<rect class="${i < s.k ? 'o' : 'b hollow'}" x="${(i % per) * (sz + gap)}" y="${(oy + Math.floor(i / per) * (sz + gap)).toFixed(1)}" width="${sz}" height="${sz}"/>`).join('');
    },
    // a count as dots in rows
    dots(s, w, h) {
      const r = 4, pitch = 12, per = Math.max(1, Math.floor((w + 4) / pitch)), rows = Math.ceil(s.n / per), oy = Math.max(0, (h - rows * pitch) / 2);
      return Array.from({ length: s.n }, (_, i) => `<circle class="${i < (s.k == null ? s.n : s.k) ? 'o' : 'b hollow'}" cx="${(i % per) * pitch + r}" cy="${(oy + Math.floor(i / per) * pitch + r).toFixed(1)}" r="${r}"/>`).join('');
    },
    // a share as a split bar: the share in orange, the rest hollow, both labelled
    split(s, w, h) {
      const y = Math.round(h / 2) - 8, bh = 14, a = Math.max(2, (s.pct / 100) * w);
      const left = `${num(s.pct)}%${s.left && tw(`${num(s.pct)}% ${s.left}`) <= a - 4 ? ` ${s.left}` : ''}`, rest = 100 - s.pct;
      const right = `${num(rest)}%${s.right && tw(`${num(rest)}% ${s.right}`) <= w - a - 4 ? ` ${s.right}` : ''}`;
      return `<rect class="o" x="0" y="${y}" width="${a.toFixed(1)}" height="${bh}"/><rect class="b hollow" x="${a.toFixed(1)}" y="${y}" width="${(w - a).toFixed(1)}" height="${bh}"/>${T(0, y + bh + 14, left)}${T(w, y + bh + 14, right, 'e')}`;
    },
    // parts of a whole as segments of one bar; the first in orange, the rest in blue, then hollow
    segs(s, w, h) {
      const tot = s.vals.reduce((a, v) => a + v.v, 0), y = Math.round(h / 2) - 7, bh = 14; let x = 0;
      const labs = s.vals.map((v) => `${v.k} ${num(v.v)}${s.unit || ''}`), fitsBelow = labs.reduce((a, l) => a + tw(l) + 8, 0) <= w;
      return s.vals.map((v, i) => { const sw = (v.v / tot) * w; const up = !fitsBelow && i % 2 === 1; const lx = Math.min(x, w - tw(labs[i])); const out = `<rect class="${i === 0 ? 'o' : i === 1 ? 'b' : 'b hollow'}" x="${x.toFixed(1)}" y="${y}" width="${sw.toFixed(1)}" height="${bh}"/>${T(lx, up ? y - 5 : y + bh + 14, labs[i])}`; x += sw; return out; }).join('');
    },
    // ticks on a year line, labels above and below in turn
    ticks(s, w, h) {
      const y = Math.round(h / 2) + 2, X = (yr) => 8 + ((yr - s.from) / Math.max(1e-9, s.to - s.from)) * (w - 16);
      const axis = `<line class="base" x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
      const items = [...s.items].sort((a, b) => a.year - b.year);
      const rowEnd = { up: -99, down: -99 };
      return axis + items.map((it, i) => { const x = X(it.year), up = i % 2 === 0, hi = it.hi || (s.hi === 'first' && i === 0); let lab = `${it.k} ${String(Math.floor(it.year)).slice(2)}`; let half = tw(lab) / 2; const row = up ? 'up' : 'down'; let tx = Math.max(half, x, rowEnd[row] + 8 + half); if (tx + half > w) { lab = String(Math.floor(it.year)).slice(2); half = tw(lab) / 2; tx = Math.max(half, x, rowEnd[row] + 8 + half); } tx = Math.min(w - half, tx); rowEnd[row] = tx + half; return `<line class="${hi ? 'o' : 'b'} tick" x1="${x.toFixed(1)}" y1="${y - 7}" x2="${x.toFixed(1)}" y2="${y + 7}"/>${T(tx, up ? y - 11 : y + 20, lab, `c${hi ? ' o' : ''}`)}`; }).join('');
    },
    // a halving staircase: the level halves every m months across the span, on a log scale
    stair(s, w, h) {
      const months = s.span || 48, steps = Math.floor(months / s.months), top = 12, base = h - 18, X = (mo) => (mo / months) * w, Y = (k) => top + (k / steps) * (base - top);
      let d = `M0 ${top}`; for (let k = 0; k < steps; k++) { d += `H${X((k + 1) * s.months).toFixed(1)}V${Y(k + 1).toFixed(1)}`; }
      return `<line class="base" x1="0" y1="${base}" x2="${w}" y2="${base}"/><path class="o" d="${d}"/>${T(w, 9, 'log', 'e')}${T(0, h - 4, '\u00d71')}${T(w, h - 4, `\u00f7${2 ** steps} in ${months / 12} yrs`, 'e')}`;
    },
  };
  // the perspectives field: horizon across (now to a decade), balance up (harm to benefit); a blue dot and surname per
  // voice, orange hairlines between voices that disagree; one-axis voices sit as ticks on their axis's margin
  DRAW.field = function (s, w, h) {
    const leftOnes = s.one.filter((d) => d.hz == null), botOnes = s.one.filter((d) => d.hz != null);
    // rails outside the plane for the voices who state one axis only: a hollow tick, the name, and what is not stated
    const railL = leftOnes.length ? Math.min(120, 28 + Math.max(...leftOnes.map((d) => tw(d.sur)))) : 0, railB = botOnes.length ? 22 : 0;
    const L = railL + 14, R = 8, Tp = leftOnes.length ? 30 : 18, B = 34 + railB, X = (hz) => L + hz * (w - L - R), Y = (bl) => Tp + (1 - bl) * (h - Tp - B);
    const dots = s.both, byId = new Map(dots.map((d) => [d.id, d]));
    // labels: right of the dot, nudged down when two would collide
    const placed = []; for (const d of [...dots].sort((a, b) => X(a.hz) - X(b.hz) || Y(a.bl) - Y(b.bl))) { let x = X(d.hz) + 8, y = Y(d.bl) + 4; const wdt = tw(d.sur); if (x + wdt > w - R) x = X(d.hz) - 8 - wdt; let tries = 0; while (tries++ < 6 && placed.some((q) => Math.abs(q.y - y) < 14 && x < q.x + q.w && x + wdt > q.x)) y += 14; placed.push({ x, y, w: wdt }); d.lx = x; d.ly = y; }
    const lines = []; const seen = new Set();
    for (const d of dots) for (const o of d.dis) { const q = byId.get(o); if (!q) continue; const k = [d.id, q.id].sort().join('|'); if (seen.has(k)) continue; seen.add(k); lines.push(`<line class="dis" data-a="${esc(d.id)}" data-b="${esc(q.id)}" x1="${X(d.hz).toFixed(1)}" y1="${Y(d.bl).toFixed(1)}" x2="${X(q.hz).toFixed(1)}" y2="${Y(q.bl).toFixed(1)}"/>`); }
    const frame = `<line class="base" x1="${L}" y1="${Tp}" x2="${L}" y2="${h - B}"/><line class="base" x1="${L}" y1="${h - B}" x2="${w - R}" y2="${h - B}"/>
      ${T(L + 4, Tp - 6, 'benefit \u2191')}${T(L + 4, h - B - 6, 'harm \u2193')}${T(L, h - B + 14, `now, ${s.year}`)}${T(w - R, h - B + 14, `${s.year + 10}, a decade out`, 'e')}${w >= 560 ? T((L + w - R) / 2, h - B + 14, 'horizon \u2192', 'c') : ''}`;
    // one-axis voices: a tick on the margin of the axis they have, the name beside it, names nudged apart
    const rx = railL - 10, ry = h - railB + 4;
    let my = -99; const leftM = leftOnes.sort((a, b) => Y(a.bl) - Y(b.bl)).map((d) => { const y = Math.max(Y(d.bl) + 4, my + 14); my = y; return `<g class="mo-fdot margin" data-pid="${esc(d.id)}" tabindex="0" role="button" aria-label="${esc(d.name)}, horizon not stated"><circle class="hollow" cx="${rx}" cy="${Y(d.bl).toFixed(1)}" r="4"/>${T(rx - 8, y, d.sur, 'e')}</g>`; });
    const railEnd = w - R - tw('balance not stated') - 10;
    let mx = -99; const botM = botOnes.sort((a, b) => X(a.hz) - X(b.hz)).map((d) => { const x = X(d.hz); const right = x + 8 + tw(d.sur) <= railEnd && x + 8 > mx; const lx = right ? x + 8 : x - 8; mx = right ? lx + tw(d.sur) : mx; return `<g class="mo-fdot margin" data-pid="${esc(d.id)}" tabindex="0" role="button" aria-label="${esc(d.name)}, balance not stated"><circle class="hollow" cx="${x.toFixed(1)}" cy="${ry}" r="4"/>${T(lx, ry + 4, d.sur, right ? '' : 'e')}</g>`; });
    const railLab = (leftOnes.length ? `<line class="base" x1="${rx}" y1="${Tp}" x2="${rx}" y2="${h - B}"/>${T(0, Tp - 18, 'horizon')}${T(0, Tp - 6, 'not stated')}` : '') + (botOnes.length ? `<line class="base" x1="${L}" y1="${ry}" x2="${w - R}" y2="${ry}"/>${T(w - R, ry + 4, 'balance not stated', 'e')}` : '');
    const margins = railLab + leftM.join('') + botM.join('');
    return frame + lines.join('') + margins + dots.map((d) => `<g class="mo-fdot" data-pid="${esc(d.id)}" tabindex="0" role="button" aria-label="${esc(d.name)}"><circle class="b" cx="${X(d.hz).toFixed(1)}" cy="${Y(d.bl).toFixed(1)}" r="4"/><circle class="halo" cx="${X(d.hz).toFixed(1)}" cy="${Y(d.bl).toFixed(1)}" r="14"/>${T(d.lx, d.ly, d.sur)}${d.fig ? `<text class="vt fig" x="${d.lx.toFixed(1)}" y="${(d.ly + 14).toFixed(1)}">${esc(d.fig)}</text>` : ''}</g>`).join('');
  };

  function drawViz(node, width) {
    const s = VIZ.get(node.dataset.vz); if (!s) return;
    const w = Math.max(40, width || node.clientWidth), h = s.h || 72;
    let inner = ''; try { inner = DRAW[s.type] ? DRAW[s.type](s, w, h) : ''; } catch (e) { inner = ''; }
    node.innerHTML = inner ? `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"${s.dashed ? ' class="dashed"' : ''}>${inner}</svg>` : '';
  }
  let lastW = -1;
  // measure every box first, then write every SVG: one layout, not one per figure
  function drawAll(root, force) { const w = root.clientWidth; if (!force && w === lastW) return; lastW = w; const nodes = [...root.querySelectorAll(`.${cls}`)]; const widths = nodes.map((n) => n.clientWidth); nodes.forEach((n, i) => drawViz(n, widths[i])); }
  return { vz, drawAll, drawViz, DRAW, tw, T, fit };
}
