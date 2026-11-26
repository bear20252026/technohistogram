// Now (#v=now, alias #v=moment): October 2026 in figures, set in Two-Ink Press on the site ground. Exactly two
// inks: deep blue (#1E2A78) carries the type and the data, the atlas orange (#E25D13) carries one shape or line per
// block, laid 3px out of register so the overprint dark appears where they meet; red marks the selected square only.
// Top to bottom: the headline, THE BAR (ten cells, each a numeral, a label, an orange sparkline where series_v3 has
// the series, a source), STEP BACK as three small charts, LIMITS as 23 small multiples, POLITICIZED (the matrix,
// re-inked), PERSPECTIVES in two loose columns with the quotes as orange pull quotes.
//
// Data. The bar is computed from data/series_v3.json, data/compute_limits.json and the record; the other blocks fill
// from the optional files when the build lists them in the manifest (research in progress until then):
//   compute_limits.json   { items: [{ id, group, label, figure (object), unit, date, source: {title,url}, reading, series_v3? }] }
//   politics_map.json     { issues: [{id,label,question,cells:[{ actor, party, stance (yes|no|conditional), position, incentive, incentive_source_url?, moved?, evidence:{kind,quote_or_action,date,source_url,source_title} }]}], actors: [{id,label,kind,party?}] }
//   perspectives_now.json [{ id, name, affiliation, discipline, field?, view, quote, wrong_if, disagrees_with: [ids], date, source: {title,url} }]
// Field aliases are read loosely (statement/sentence/text, source_url/url/sources[0].url, issue_id/actor_id).
//
// Motion on arrival only: the blue pass prints over 900ms, the orange pass follows over 900ms with a registration
// jitter of 6px settling to 3px, the grain flickers at 12 fps for 1.5s and stills. Nothing else moves;
// prefers-reduced-motion shows the settled sheet.
import { esc } from '../ui.js';
import { db, ensure } from '../data.js';
import { set } from '../store.js';
import { context, lagEra, hype, diffusion, median } from './patterns_calc.js';
import { humanLineCount } from './benchmarks.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const narrow = () => window.innerWidth < 700;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace(/\d/g, (c) => SUP[+c]);
const sci = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; return `${+m.toFixed(1)} × 10${sup(e)}`; };
const tOf = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
const when = (d) => { if (d == null) return ''; const [y, m, dd] = String(d).split('-').map(Number); return m ? (dd ? `${dd} ${MON[m - 1]} ${y}` : `${MON[m - 1]} ${y}`) : String(y); };
const yearOf = (d) => +String(d).slice(0, 4);
const num = (v, d = 0) => (v == null || Number.isNaN(+v) ? '' : (+v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (v) => `${num(v)}%`;
const yrs = (v) => { const r = Math.round(v * 10) / 10; return `${num(r, Number.isInteger(r) ? 0 : 1)} ${r === 1 ? 'year' : 'years'}`; };
const urlOf = (x) => (!x ? '' : typeof x === 'string' ? x : x.url || x.source_url || (x.source && (typeof x.source === 'string' ? x.source : x.source.url)) || (Array.isArray(x.sources) && x.sources[0] && x.sources[0].url) || '');
const titleOf = (x, fb) => (!x ? fb : (x.source && typeof x.source === 'object' && x.source.title) || (Array.isArray(x.sources) && x.sources[0] && x.sources[0].title) || x.source_title || fb);
// short names for hosts that would otherwise wrap in a narrow mono line
const SHORT_HOST = { 'moneycontrol.com': 'Moneycontrol', 'aboutamazon.com': 'Amazon IR', 'federalregister.gov': 'Federal Register', 'counterpointresearch.com': 'Counterpoint', 'practicallaw.com': 'Reuters Practical Law', 'nvidianews.nvidia.com': 'NVIDIA newsroom', 'news.crunchbase.com': 'Crunchbase News', 'openai.com': 'OpenAI', 'microsoft.com': 'Microsoft', 'trendforce.com': 'TrendForce', 'emersoncollective.com': 'Emerson Collective' };
const shortHost = (u) => { const h = host(u); return SHORT_HOST[h] || h; };
const host = (u) => { try { const h = new URL(u).hostname.replace(/^www\./, '').split('.'); return h.length > 2 && !/^(co|com|org|ac|gov)$/.test(h[h.length - 2]) ? h.slice(-2).join('.') : h.join('.'); } catch { return ''; } };
const text = (x, ...keys) => { for (const k of keys) if (x && x[k]) return String(x[k]); return ''; };

// short source names for the series bullets; the URL comes from the series record
const SRC = { frontier_training_compute: 'Epoch AI', datacenter_electricity_v3: 'IEA', api_price_frontier: 'vendor price pages', chatgpt_weekly_users: 'company statement', gpu_export_scope: 'Federal Register', chip_export_controls: 'BIS', ai_share_venture: 'Crunchbase', ai_incidents: 'AI Index 2026', pew_concerned: 'Pew', flops_per_dollar_epoch: 'Epoch AI', flop_per_watt_datasheets: 'datasheets', open_weights_share: 'Epoch AI' };

const manifestLists = (f) => { const man = db.manifest || {}; return (Array.isArray(man.optional) && man.optional.includes(f)) || (man.sizes && man.sizes[f] != null); };
const optional = (f) => { if (!manifestLists(f)) return Promise.resolve(null); const man = db.manifest || {}; return fetch(`data/${f}${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null); };

export default function moment(el, { select }) {
  el.classList.add('mo-view', 'scroll-y');
  // the view's world leaves with it: the body tint and the press classes follow the shell's .on class
  const shown = () => el.classList.contains('on');
  let wasOn = shown();
  new MutationObserver(() => { const on = shown(); if (on === wasOn) return; wasOn = on; document.body.classList.toggle('now-ink', on); if (!on) { el.classList.remove('press', 'pressed'); stopGrain(); closeSheet(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
  document.body.classList.toggle('now-ink', wasOn);
  el.innerHTML = `
    <div class="mo-grain" aria-hidden="true"></div>
    <div class="mo">
      <header class="mo-head">
        <h1 class="mo-title"><span class="mo-title-t" data-text="AI NOW · OCTOBER 2026">AI NOW · OCTOBER 2026</span></h1>
        <p class="mo-standfirst">Ten figures, each drawn from its source numbers; three charts that put them against the past; the physical limits, each drawn; who holds which position; and eighteen voices placed by horizon and balance.</p>
      </header>
      <section class="mo-bar" aria-label="Ten figures"><ol class="mo-cells"></ol><p class="mo-rip" data-rip="bar" hidden></p></section>
      <section class="mo-step" aria-labelledby="mo-step-h"><h2 class="mo-h" id="mo-step-h">Step back</h2><div class="mo-charts"></div><p class="mo-rip" data-rip="step" hidden></p></section>
      <section class="mo-limits" aria-labelledby="mo-lim-h"><h2 class="mo-h" id="mo-lim-h">Limits</h2><div class="mo-lgrid" data-block="limits"></div><p class="mo-rip" data-rip="limits" hidden></p></section>
      <section class="mo-pol" aria-labelledby="mo-pol-h"><h2 class="mo-h" id="mo-pol-h">Politicized</h2>
        <div class="mo-polwrap">
          <div class="mo-mside"><p class="mo-mnote sc" hidden></p><div class="mo-mscroll"><div class="mo-matrix" role="grid" aria-label="Issues by kinds of actor: a square per stated position"></div></div><p class="mo-key sc" hidden></p></div>
          <aside class="mo-card" aria-live="polite"></aside>
        </div>
        <div class="mo-sheet" hidden><button type="button" class="mo-sheet-x" aria-label="Close">&times;</button><div class="mo-sheet-body"></div></div>
        <p class="mo-rip" data-rip="politics" hidden></p></section>
      <section class="mo-persp" aria-labelledby="mo-per-h"><h2 class="mo-h" id="mo-per-h">Perspectives</h2>
        <div class="mo-fieldwrap" hidden><p class="mo-method"></p><div class="mo-field"></div><div class="mo-fieldside"><div class="mo-pcard" aria-live="polite"></div><aside class="mo-unscored"></aside></div></div>
        <details class="mo-listtoggle" open><summary class="sc">The voices in full</summary><div class="mo-groups"></div></details><p class="mo-rip" data-rip="perspectives" hidden></p></section>
      <footer class="mo-foot sc">Computed from the record and its measures &middot; two inks, blue for type and data, orange for one line per block &middot; red marks the selected square</footer>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const rip = (block, msg) => { const p = $(`[data-rip="${block}"]`); if (!p) return; p.hidden = !msg; p.textContent = msg || ''; };

  // ---------- sparklines and bars in the two inks: the line in orange, its last point a blue dot 3px out of register ----------
  /* ---------- the drawings: every figure gets a picture, drawn in pixels at the measured width ----------
     A spec is kept per placeholder; drawViz renders it as an SVG sized to the box, so mono labels stay 12px and
     strokes stay 1.5px at every width. Orange is the one data line or filled share per picture; blue is the rest. */
  const VIZ = new Map(); let vizN = 0;
  const vz = (spec) => { const id = `vz${++vizN}`; VIZ.set(id, spec); return `<div class="mo-viz" data-vz="${id}" style="height:${spec.h || 72}px"></div>`; };
  const CH7 = 7.3; // px per mono character at 12px
  const tw = (s) => String(s).length * CH7;
  const T = (x, y, t, cls = '') => `<text class="vt ${cls}" x="${x.toFixed ? x.toFixed(1) : x}" y="${y.toFixed ? y.toFixed(1) : y}">${esc(String(t))}</text>`;
  const fitKey = (s, px) => (tw(s) <= px + 5 ? String(s) : String(s).slice(0, Math.max(1, Math.floor(px / CH7))));
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
      const top = 12, base = h - (two ? 30 : 18);
      const X = (x) => 3 + ((x - x0) / Math.max(1e-9, x1 - x0)) * (w - 6), Y = (y) => base - ((y - y0) / Math.max(1e-9, y1 - y0)) * (base - top);
      const pathD = xs.map((x, i) => `${i ? (s.step ? `H${X(x).toFixed(1)}V` : 'L') : 'M'}${s.step && i ? Y(ys[i]).toFixed(1) : `${X(x).toFixed(1)} ${Y(ys[i]).toFixed(1)}`}`).join('');
      const lx = X(xs[xs.length - 1]), ly = Y(ys[ys.length - 1]);
      const falling = P[0][1] > P[P.length - 1][1];
      const logTag = s.log ? T(falling ? w : 0, 9, 'log', falling ? 'e' : '') : '';
      const ends = two ? `${T(0, h - 16, la)}${T(w, h - 16, lb, 'e')}${T(0, h - 3, String(yearOf(ya)))}${T(w, h - 3, String(yearOf(yb)), 'e')}` : `${T(0, h - 4, la)}${T(w, h - 4, lb, 'e')}`;
      return `<line class="base" x1="0" y1="${base}" x2="${w}" y2="${base}"/><path class="o" d="${pathD}"/><circle class="b" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3"/>${logTag}${ends}`;
    },
    step(s, w, h) { return DRAW.line({ ...s, step: true }, w, h); },
    // vertical bars, the highlighted one orange, a key under each and the value above when they fit
    bars(s, w, h) {
      const V = s.vals, n = V.length, m = Math.max(...V.map((v) => v.v)), gap = 4, bw = (w - gap * (n - 1)) / n, top = 16, base = h - 18;
      const f = s.fmt || ((v) => num(v));
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
  function drawViz(node) {
    const spec = VIZ.get(node.dataset.vz); if (!spec || !DRAW[spec.type]) return;
    const w = Math.max(48, Math.floor(node.clientWidth)), h = spec.h || 72;
    node.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${DRAW[spec.type](spec, w, h)}</svg>`;
  }
  let vizW = 0;
  let heldId = null;
  const markHeld = () => { for (const g of el.querySelectorAll('.mo-fdot')) g.classList.toggle('hot', !!heldId && g.dataset.pid === heldId); for (const ln of el.querySelectorAll('.mo-field line.dis')) ln.classList.toggle('hot', !!heldId && (ln.dataset.a === heldId || ln.dataset.b === heldId)); };
  function drawAllViz(force) { const w = el.clientWidth; if (!force && w === vizW) return; vizW = w; for (const n of el.querySelectorAll('.mo-viz')) drawViz(n); markHeld(); }

  // a cell of the bar: numeral and unit, a four-word label, the picture, then the source and the atlas home
  const cell = (c) => `<li class="mo-cell${c.view ? ' link' : ''}"${c.view ? ` data-view="${esc(c.view)}"${c.at ? ` data-at="${esc(c.at)}"` : ''} tabindex="0" role="link"` : ''}${c.title ? ` title="${esc(c.title)}"` : ''}>
      <span class="mo-fig"><b class="n${String(c.figure).replace(/<[^>]*>/g, '').length > 3 ? ' long' : ''}">${c.figure}</b>${c.unit ? `<span class="u">${esc(c.unit)}</span>` : ''}</span>
      <span class="mo-lab">${esc(c.label)}</span>
      ${c.viz || '<span class="mo-nospark" aria-hidden="true"></span>'}
      <span class="mo-src">${c.date ? `<span class="d">${esc(c.date)}</span>` : ''}${c.date && (c.url || c.source) ? '<span class="sep"> &middot; </span>' : ''}${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source || shortHost(c.url))}</a>` : `<span>${esc(c.source || '')}</span>`}</span>
      ${c.view ? `<a class="mo-go" href="#v=${esc(c.view)}${c.at ? `&at=${esc(c.at)}` : ''}" data-view="${esc(c.view)}"${c.at ? ` data-at="${esc(c.at)}"` : ''} title="${esc(c.go || c.view)}" aria-label="${esc(c.go || c.view)}">&rarr;</a>` : ''}</li>`;

  el.addEventListener('click', (ev) => {
    const go = ev.target.closest('a.mo-go'); if (go) { ev.preventDefault(); set({ view: go.dataset.view, at: go.dataset.at || '', mode: '' }); return; }
    const rec = ev.target.closest('a.mo-rec'); if (rec) { ev.preventDefault(); set({ view: 'stream', sel: rec.dataset.e, mode: '' }); return; }
    const li = ev.target.closest('.mo-cell.link, .mo-chart.link'); if (li && !ev.target.closest('a')) { set({ view: li.dataset.view, at: li.dataset.at || '', mode: '' }); return; }
    const sq = ev.target.closest('.mo-sq'); if (sq) { pinCell(sq); return; }
    if (ev.target.closest('.mo-sheet-x')) { closeSheet(); return; }
    const fd = ev.target.closest('.mo-fdot'); if (fd) { showVoice(fd.dataset.pid); return; }
    const dis = ev.target.closest('.mo-dis a, a.mo-fname'); if (dis) { ev.preventDefault(); const tg = $('.mo-listtoggle'); if (tg && !tg.open) tg.open = true; const t = el.querySelector(`.mo-p[data-pid="${dis.dataset.to}"]`); if (t) { t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); t.classList.add('lit'); setTimeout(() => t.classList.remove('lit'), 1600); } }
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const li = ev.target.closest('.mo-cell.link, .mo-chart.link'); if (li) { ev.preventDefault(); set({ view: li.dataset.view, mode: '' }); return; }
    const sq = ev.target.closest('.mo-sq'); if (sq) { ev.preventDefault(); pinCell(sq); }
  });

  /* ---------- the series: AI now and the Limits fallback ---------- */
  let V3 = null;
  const series = (id) => (V3 ? V3.find((s) => s.id === id) : null);
  const last = (s) => (s && s.points && s.points.length ? s.points[s.points.length - 1] : null);
  const lastYearFull = (s) => { const pts = (s && s.points) || []; const full = pts.filter((p) => !/partial/.test(String(s.last_reading || '')) || +p[0] < new Date().getFullYear()); return full[full.length - 1] || last(s); };

  // THE BAR: ten cells. The figure is a figure, the unit and label are words, the sparkline is the series where
  // series_v3 has it (users, compute, power, price, venture, incidents); the token and capex cells read the Limits
  // items so the two blocks agree.
  // the big four's 2025 capital spending as four bars, keyed by the first word of each company's line
  const TICKER = { Amazon: 'AMZN', Alphabet: 'GOOG', Meta: 'META', Microsoft: 'MSFT' };
  const capexBars = (f) => { const pc = f && f.per_company_2025_bn; if (!pc || typeof pc !== 'object') return ''; const vals = Object.entries(pc).filter(([, v]) => typeof v === 'number').map(([k, v]) => { const n = k.split(/[\s(]/)[0]; return { k: TICKER[n] || n, v }; }).sort((a, b) => b.v - a.v); return vals.length ? vz({ type: 'bars', vals, hi: 'max', fmt: (v) => num(v) }) : ''; };
  function barCells(lim) {
    const out = [];
    const items = lim ? lim.items || lim.limits || [] : [];
    const wu = series('chatgpt_weekly_users');
    if (wu) { const L = last(wu), d = (wu.detail || []).find((x) => x.date === L[0]); out.push({ figure: num(L[1] / 1000, 1), unit: 'billion', label: 'weekly ChatGPT users', view: 'anatomy', go: 'Anatomy \u00b7 Users', date: when(L[0]), url: (d && d.source_url) || wu.source_url, source: shortHost((d && d.source_url) || wu.source_url) || SRC.chatgpt_weekly_users, viz: vz({ type: 'line', pts: wu.points, zero: true, fmt: (v) => `${num(v)} m` }), title: `${num(wu.points[0][1])} million in ${when(wu.points[0][0])} to ${num(L[1])} million in ${when(L[0])}${d && d.stated_by ? `, stated by ${d.stated_by}` : ''}` }); }
    const ft = series('frontier_training_compute');
    if (ft) {
      const L = last(ft), d = (ft.detail || []).find((x) => x.year === L[0]), prev = ft.points.find((p) => p[0] === L[0] - 1), ratio = prev ? L[1] / prev[1] : null;
      const about2 = ratio && ratio > 1.75 && ratio < 2.25;
      out.push({ figure: ratio ? `${about2 ? 2 : num(ratio, 1)}×` : sci(L[1]), unit: 'training run, 2026', view: 'anatomy', go: 'Anatomy \u00b7 compute layer', label: ratio ? `${about2 ? 'about double' : `${num(ratio, 1)} times`} ${L[0] - 1}\u2019s run` : 'operations in the largest run', date: String(L[0]), url: ft.source_url, source: SRC.frontier_training_compute, viz: vz({ type: 'line', pts: ft.points, log: true, years: true }), title: `${sci(L[1])} FLOP${d ? `, ${d.model}` : ''}; the line is the largest run each year on a log scale, from ${sci(ft.points[0][1])} in ${ft.points[0][0]} to ${sci(L[1])} in ${L[0]}` });
    }
    const dc = series('datacenter_electricity_v3'), dcOld = (db.series || []).find((x) => x.id === 'datacenter_electricity');
    if (dc) { const p = dc.points.filter((x) => x[0] <= 2025).pop(); const hist = dcOld && dcOld.points ? dcOld.points.filter((q) => q.year < p[0]).map((q) => [q.year, q.value]) : []; out.push({ figure: num(p[1]), unit: 'TWh', view: 'anatomy', go: 'Anatomy \u00b7 Energy', label: 'data centre electricity', date: String(p[0]), url: urlOf(dc) || dc.source_url, source: SRC.datacenter_electricity_v3, viz: vz({ type: 'line', pts: [...hist, ...dc.points.filter((x) => x[0] <= 2025)], zero: true, fmt: (v) => `${num(v)} TWh` }), title: `${num(p[1])} TWh in ${p[0]}, worldwide` }); }
    const tp = items.find((x) => x.id === 'token_price');
    const tpe = tp && tp.figure && typeof tp.figure === 'object' ? Object.entries(tp.figure).filter(([k, x]) => typeof x === 'number' && /^\d{4}-\d{2}\s/.test(k)) : [];
    const ap = series('api_price_frontier');
    if (tpe.length > 1) {
      const [k0, v0] = tpe[0]; let [k1, v1] = tpe[1]; for (const e of tpe.slice(1)) if (e[1] < v1) [k1, v1] = e;
      const name = (k) => k.replace(/^\d{4}-\d{2}\s/, '').replace(/\s*\(.*\)/, '');
      out.push({ figure: `${Math.round(v0 / v1)}×`, unit: 'cheaper', label: `frontier tokens since ${k0.slice(0, 4)}`, view: 'anatomy', go: 'Anatomy \u00b7 money layer', date: `${k0.slice(0, 4)} to ${k1.slice(0, 4)}`, url: urlOf(tp) || (ap && ap.source_url), source: (() => { const h = host(urlOf(tp) || (ap && ap.source_url)); return h === 'openai.com' ? 'OpenAI pricing' : h || SRC.api_price_frontier; })(), viz: ap ? vz({ type: 'step', pts: ap.points, log: true, fmt: (v) => `$${num(v, v < 3 ? 2 : 0)}` }) : '', title: `a million input tokens, ${name(k0)} at $${v0} to ${name(k1)} at $${v1}; the line is the frontier list price on a log scale` });
    } else if (ap && ap.points.length > 1) { const f = ap.points[0], L = last(ap); out.push({ figure: `${Math.round(f[1] / L[1])}×`, unit: 'cheaper', label: 'frontier token price', date: `${yearOf(f[0])} to ${yearOf(L[0])}`, url: ap.source_url, source: SRC.api_price_frontier, viz: vz({ type: 'step', pts: ap.points, log: true, fmt: (v) => `$${num(v, v < 3 ? 2 : 0)}` }) }); }
    const capex = items.find((x) => x.id === 'hyperscaler_capex');
    const capexBn = capex && capex.figure && typeof capex.figure === 'object' ? pickNum(capex.figure, '2025_actual_bn', '2025_cash_capex_bn_sum') : null;
    if (capexBn) out.push({ title: capex && capex.figure && capex.figure.per_company_2025_bn ? `2025 capital spending, $bn: ${Object.entries(capex.figure.per_company_2025_bn).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k.split(/[\s(]/)[0]} ${num(v)}`).join(', ')}` : '', figure: `$${num(capexBn)}`, unit: 'billion', label: 'big four capex 2025', view: 'capital', go: 'Capital', date: '2025', url: urlOf(capex), source: shortHost(urlOf(capex)), viz: capexBars(capex.figure), title: 'Amazon, Microsoft, Alphabet and Meta, 2025 cash capital spending' });
    else if (db.models && db.models.length) { const open = db.models.filter((m) => m.open_weights === true || m.weights === 'open').length; out.push({ figure: String(db.models.length), unit: 'models', label: 'tracked since 2017', view: 'genealogy', source: 'Models', title: `${open} with open weights` }); }
    const B = db.benchmarks && (Array.isArray(db.benchmarks) ? db.benchmarks : db.benchmarks.benchmarks);
    if (B && B.length) { const { crossed, withHuman, saturated, total } = humanLineCount(db); out.push({ figure: String(crossed), unit: `of ${withHuman} with a baseline`, label: 'crossed the human line', view: 'benchmarks', go: 'Benchmarks', source: 'Benchmarks', viz: vz({ type: 'squares', n: withHuman, k: crossed, lab: `${crossed} of ${withHuman} crossed` }), title: `${crossed} of the ${withHuman} benchmarks with a published human baseline have a record at or past it; ${saturated} of ${total} count as saturated by the record's rule` }); }
    const gs = series('gpu_export_scope'), cc = series('chip_export_controls');
    if (gs) { const L = last(gs); out.push({ figure: num(L[1]), unit: 'countries', label: 'under US chip licences', view: 'policy', at: 'po-press-h', go: 'Policy \u00b7 pressure', date: when(L[0]), url: gs.source_url, source: SRC.gpu_export_scope, viz: vz({ type: 'dots', n: Math.round(L[1]), lab: `${num(L[1])} countries` }), title: cc ? `${last(cc)[1]} US control actions since ${yearOf(cc.points[0][0])}; the bars count them by year` : '' }); }
    const vs = series('ai_share_venture'), inv = (db.series || []).find((x) => x.id === 'ai_private_investment');
    if (vs) { const L = last(vs), d = (vs.detail || []).find((x) => x.year === L[0]); out.push({ figure: pct(L[1]), unit: 'of venture', label: 'went to AI', view: 'capital', go: 'Capital', date: String(L[0]), url: (d && d.source_url) || vs.source_url, source: SRC.ai_share_venture, viz: vz({ type: 'split', pct: L[1], left: 'AI', right: 'other' }), title: d ? `$${num(d.ai_bn)} billion of AI venture funding in ${L[0]}` : '' }); }
    const inc = series('ai_incidents');
    if (inc) { const L = last(inc); out.push({ figure: num(L[1]), unit: 'incidents', label: 'AI Incident Database reports', view: 'policy', at: 'po-press-h', go: 'Policy \u00b7 pressure', date: String(L[0]), url: urlOf(inc) || inc.source_url, source: SRC.ai_incidents, viz: vz({ type: 'line', pts: inc.points, zero: true }) }); }
    const pw = series('pew_concerned');
    if (pw) { const L = last(pw); out.push({ figure: pct(L[1]), unit: 'of US adults', label: '\u201cmore concerned than excited\u201d', view: 'anatomy', go: 'Anatomy \u00b7 Users polls', date: String(L[0]), url: urlOf(pw) || pw.source_url, source: SRC.pew_concerned, viz: vz({ type: 'split', pct: L[1], left: 'concerned', right: 'excited or unsure' }), title: 'Pew\u2019s wording, US adults asked about AI in daily life' }); }
    void inv;
    return out.slice(0, 10);
  }

  // Limits from the series until compute_limits.json lands: energy, chips, export controls, capital, efficiency; data has no series yet
  function limitsFallback() {
    const rows = [];
    const dc = series('datacenter_electricity_v3');
    if (dc) { const p = dc.points.filter((x) => x[0] <= 2025).pop(), proj = dc.points.find((x) => x[0] === 2030); rows.push({ figure: `${num(p[1])} TWh`, context: `energy: data centres ${p[0]}${proj ? `, ${num(proj[1])} projected for 2030` : ''}`, date: String(p[0]), url: urlOf(dc) || dc.source_url, source: SRC.datacenter_electricity_v3 }); }
    const fw = series('flop_per_watt_datasheets');
    if (fw) { const L = last(fw), d = (fw.detail || []).find((x) => x.date === L[0]); rows.push({ figure: num(L[1]), context: `chips: GFLOP/s per watt, dense FP16 peak${d && d.chip ? `, ${d.chip}` : ''}`, date: when(L[0]), url: fw.source_url, source: SRC.flop_per_watt_datasheets }); }
    const gs = series('gpu_export_scope'), cc = series('chip_export_controls');
    if (cc) { const L = last(cc); rows.push({ figure: `${L[1]} actions`, context: `export controls: US and allied chip measures${gs ? `, ${last(gs)[1]} countries under licence` : ''}`, date: when(L[0]), url: cc.source_url, source: SRC.chip_export_controls }); }
    rows.push({ figure: '', context: 'data: the stock of public text', date: '', source: 'research in progress' });
    const vs = series('ai_share_venture');
    if (vs) { const L = last(vs), d = (vs.detail || []).find((x) => x.year === L[0]); rows.push({ figure: d ? `$${num(d.ai_bn)} bn` : pct(L[1]), context: `capital: AI venture funding, ${pct(L[1])} of all venture`, date: String(L[0]), url: (d && d.source_url) || vs.source_url, source: SRC.ai_share_venture }); }
    const fd = series('flops_per_dollar_epoch');
    if (fd) { const L = last(fd); rows.push({ figure: '+30% a year', context: 'efficiency: GPU performance per dollar, the Epoch trend', date: when(L[0]), url: fd.source_url, source: SRC.flops_per_dollar_epoch }); }
    return rows;
  }
  // compute_limits.json: items grouped (energy, chips, export controls, data, capital, efficiency, then the rest);
  // the figure is an object of readings, so the headline is its latest year or first number, with the unit's first part
  const GROUPS = { energy: 'Energy', chips: 'Chips', export_controls: 'Export controls', data: 'Data', capital: 'Capital', efficiency: 'Efficiency', training: 'Training', inference: 'Inference', latency_context: 'Context and speed', talent: 'Talent', physical: 'Physical' };
  const compact = (v) => (Math.abs(v) >= 1e12 ? `${num(v / 1e12, v / 1e12 < 10 ? 1 : 0)} tn` : Math.abs(v) >= 1e9 ? `${num(v / 1e9, v / 1e9 < 10 ? 1 : 0)} bn` : Math.abs(v) >= 1e6 ? `${num(v / 1e6, Number.isInteger(v / 1e6) ? 0 : v / 1e6 < 10 ? 2 : 1)} m` : Math.abs(v) >= 1e4 ? num(v) : num(v, Number.isInteger(v) ? 0 : 1));
  // headlines per item id, read from the item's own figure object; unknown ids fall to the generic rule below
  // the first numeric value under any of the named keys, else the first numeric value in the object
  const pickNum = (f, ...keys) => { for (const k of keys) if (typeof f[k] === 'number') return f[k]; return Object.values(f).find((v) => typeof v === 'number'); };
  const HEAD = {
    dc_electricity: (f) => `${num(f['2025'] != null ? f['2025'] : Object.values(f)[0])} TWh`,
    interconnection_queue: (f) => `${num(pickNum(f, 'generation_gw'))} GW`,
    largest_campus: (f) => `${num(pickNum(f, 'compute_gw', 'compute_gw_it'))} GW`,
    cowos_capacity: (f) => `${num(pickNum(f, 'end_2026_wpm') / 1000)}k`,
    hbm_share: (f) => `${Object.keys(f).length} makers`,
    nvidia_cadence: () => '1 a year',
    export_scope: (f) => num(f.countries_under_licence),
    china_domestic: (f) => compact(pickNum(f, 'chinese_ai_chips_shipped_2025', 'chinese_makers_2025')),
    text_stock: (f) => compact(f.tokens),
    synthetic_share: (f) => pct(f.synthetic_share_pct),
    hyperscaler_capex: (f) => `$${num(pickNum(f, '2025_actual_bn', '2025_cash_capex_bn_sum'))} bn`,
    venture_share: (f) => pct(f['2025'] != null ? f['2025'] : Object.values(f).pop()),
    algorithmic_progress: (f) => `${num(f.compute_halving_months)} months`,
    price_of_thought: (f) => `÷${num(f.fall_per_year_x)} a year`,
    largest_run: (f) => sci(f.flop),
    token_price: (f) => { const v = Object.entries(f).filter(([k, x]) => typeof x === 'number' && /\d{4}/.test(k)).map(([, x]) => x); return `\u00f7${num(v[0] / Math.min(...v.slice(1)))}`; },
    context_window: (f) => compact(Math.max(...Object.values(f).filter((x) => typeof x === 'number'))),
    inference_speed: (f) => `${num(f.gpt_oss_120b_tokens_per_s)}/s`,
    ai_phds: (f) => pct(f.to_industry_pct_2024),
    researcher_pay: (f) => `$${num(f.anthropic_swe_median_total_comp_usd / 1000)}k`,
    rack_power: (f) => `${num(pickNum(f, 'gb200_nvl72_reported_kw', 'rack_kw'))} kW`,
    node_roadmap: () => '2 nm',
    flop_per_watt: (f) => { const v = Object.values(f).filter((x) => typeof x === 'number'); return `×${num(v[v.length - 1] / v[0], 1)}`; },
  };
  function headline(x) {
    if (x.headline) return String(x.headline);
    if (HEAD[x.id] && x.figure && typeof x.figure === 'object') { try { return HEAD[x.id](x.figure); } catch { /* generic rule */ } }
    const unit = String(x.unit || '').split(';')[0].replace(/,.*$/, '').trim();
    const f = x.figure;
    if (typeof f === 'number') return f >= 1e20 ? `${sci(f)} ${unit}` : `${compact(f)} ${unit}`;
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object') {
      const ents = Object.entries(f);
      const years = ents.filter(([k, v]) => /^\d{4}$/.test(k) && typeof v === 'number' && +k <= new Date().getFullYear());
      const pick = years.length ? years[years.length - 1] : ents.find(([, v]) => typeof v === 'number');
      if (pick) { const v = pick[1]; return v >= 1e20 ? `${sci(v)} ${unit}` : `${compact(v)}${unit && !/^%/.test(unit) ? ` ${unit}` : unit}`; }
      return `${ents.length} ${unit || 'items'}`;
    }
    return '';
  }
  // four-word labels per limit
  const LABEL = { dc_electricity: 'data centre electricity', interconnection_queue: 'US grid queue waiting', largest_campus: 'largest announced AI campus', cowos_capacity: 'CoWoS wafers a month, 2026', hbm_share: 'HBM market share', nvidia_cadence: 'NVIDIA chip cadence', export_scope: 'countries under US licence', china_domestic: 'China\u2019s own accelerators, 2025', text_stock: 'public text stock, tokens', synthetic_share: 'synthetic share of pretraining', hyperscaler_capex: 'big four capex 2025', venture_share: 'AI share of venture', algorithmic_progress: 'compute halving time', price_of_thought: 'fixed performance, price index', largest_run: 'largest training run, FLOP', token_price: 'token price since 2023', context_window: 'largest context window, tokens', inference_speed: 'claimed tokens a second', ai_phds: 'to industry; +22% new PhDs', researcher_pay: 'Anthropic median; OpenAI $640k', rack_power: 'power per rack', node_roadmap: 'TSMC node roadmap', flop_per_watt: 'compute per watt since 2017' };
  // a drawing per limit from the item's own figure object; current against ceiling where a ceiling exists
  const yearIn = (v) => { const m = String(v).match(/(20\d\d)/); return m ? +m[1] + (/Q4|H2|late/.test(String(v)) ? 0.75 : /Q[23]/.test(String(v)) ? 0.4 : 0) : null; };
  const LH = 56;
  const LVIZ = {
    dc_electricity: (f) => { const old = (db.series || []).find((x) => x.id === 'datacenter_electricity'); const hist = old && old.points ? old.points.filter((q) => q.year < 2024).map((q) => [q.year, q.value]) : []; const pts = [...hist, ...Object.entries(f).filter(([k, v]) => /^\d{4}$/.test(k) && +k <= 2025 && typeof v === 'number').map(([k, v]) => [+k, v])]; return pts.length > 1 ? { type: 'line', pts, zero: true, fmt: (v) => `${num(v)} TWh` } : null; },
    interconnection_queue: (f) => ({ type: 'hbars', vals: [{ k: 'generation', v: f.generation_gw }, { k: 'storage', v: f.storage_gw }], max: f.generation_gw, hi: 0, fmt: (v) => `${num(v)} GW` }),
    largest_campus: (f) => ({ type: 'hbars', vals: [{ k: `first ${f.first_tranche_year || ''}`.trim(), v: f.first_tranche_mw / 1000 }, { k: 'initial', v: f.initial_gw_it }, { k: 'full', v: f.compute_gw_it, hollow: true }], hi: 0, fmt: (v) => `${num(v, v < 2 ? 2 : 1)} GW` }),
    cowos_capacity: (f) => ({ type: 'hbars', vals: [{ k: '2026', v: f.end_2026_wpm }, { k: '2028 aim', v: f.end_2028_target_wpm, hollow: true }], hi: 0, fmt: (v) => `${num(v / 1000)}k` }),
    hbm_share: (f) => ({ type: 'segs', vals: Object.entries(f).filter(([, v]) => typeof v === 'number').map(([k, v]) => ({ k, v })), unit: '%' }),
    nvidia_cadence: (f) => ({ type: 'ticks', from: 2025, to: 2029, items: Object.entries(f).map(([k, v]) => ({ k: k.split(' ')[0], year: yearIn(v) })).filter((x) => x.year), hi: 'first' }),
    export_scope: (f) => ({ type: 'dots', n: Math.round(f.countries_under_licence), lab: `${num(f.countries_under_licence)} countries` }),
    china_domestic: (f) => ({ type: 'hbars', vals: [{ k: 'Chinese', v: f.chinese_makers_2025 }, { k: 'all', v: f.china_ai_cards_2025_total, hollow: true }], hi: 0, fmt: (v) => `${num(v / 1e6, 2)} m` }),
    text_stock: (f) => ({ type: 'hbars', vals: [{ k: 'one run', v: 1e13 }, { k: 'stock', v: f.tokens, hollow: true }], hi: 0, fmt: (v) => `${num(v / 1e12)} tn` }),
    synthetic_share: (f) => ({ type: 'split', pct: f.synthetic_share_pct, left: 'synthetic', right: 'human' }),
    hyperscaler_capex: (f) => { const pc = f.per_company_2025_bn; return pc ? { type: 'bars', vals: Object.entries(pc).filter(([, v]) => typeof v === 'number').map(([k, v]) => { const n = k.split(/[\s(]/)[0]; return { k: TICKER[n] || n, v }; }).sort((a, b) => b.v - a.v), hi: 'max' } : null; },
    venture_share: (f) => ({ type: 'bars', vals: Object.entries(f).filter(([k, v]) => /^\d{4}$/.test(k) && typeof v === 'number').map(([k, v]) => ({ k, v })), hi: 'last', fmt: (v) => `${num(v)}%` }),
    algorithmic_progress: (f) => ({ type: 'stair', months: f.compute_halving_months, span: 48 }),
    // the yearly fall as an index: 100 at the start of a year, then each quarter's fall from the item's own rate
    price_of_thought: (f) => { const q = 1 - (f.fall_per_quarter_pct || 0) / 100; return q > 0 && q < 1 ? { type: 'bars', vals: [0, 1, 2, 3, 4].map((i) => ({ k: i ? `Q${i}` : 'start', v: +(100 * q ** i).toFixed(1) })), hi: 'last', fmt: (v) => num(v, v < 10 ? 1 : 0) } : null; },
    largest_run: () => { const ft = series('frontier_training_compute'); return ft ? { type: 'line', pts: ft.points, log: true, years: true } : null; },
    token_price: (f) => { const pts = Object.entries(f).filter(([k, v]) => typeof v === 'number' && /^\d{4}-\d{2}/.test(k)).map(([k, v]) => [k.slice(0, 7), v]); const ap = series('api_price_frontier'); return ap ? { type: 'step', pts: ap.points, log: true, fmt: (v) => `$${num(v, v < 3 ? 2 : 0)}` } : pts.length > 1 ? { type: 'step', pts, log: true, fmt: (v) => `$${num(v, 2)}` } : null; },
    context_window: (f) => ({ type: 'hbars', vals: Object.entries(f).filter(([, v]) => typeof v === 'number').map(([k, v]) => ({ k: k.split(' ')[0], v })).sort((a, b) => b.v - a.v), hi: 0, fmt: (v) => `${num(v / 1e6, v / 1e6 < 2 && !Number.isInteger(v / 1e6) ? 2 : 0)} m` }),
    inference_speed: (f) => ({ type: 'hbars', vals: [{ k: 'gpt-oss', v: f.gpt_oss_120b_tokens_per_s }, { k: 'frontier', v: 1000 }], hi: 0, fmt: (v) => `${num(v)}` }),
    ai_phds: (f) => ({ type: 'bars', vals: [{ k: '2022', v: f.to_industry_peak_2022_pct }, { k: '2024', v: f.to_industry_pct_2024 }], hi: 'last', fmt: (v) => `${num(v)}%` }),
    researcher_pay: (f) => ({ type: 'hbars', vals: [{ k: 'Anthropic', v: f.anthropic_swe_median_total_comp_usd }, { k: 'OpenAI', v: f.openai_swe_median_total_comp_usd }], hi: 0, fmt: (v) => `$${num(v / 1000)}k` }),
    rack_power: (f) => ({ type: 'hbars', vals: [{ k: 'GB200', v: f.gb200_nvl72_reported_kw }, { k: 'now', v: 200 }, { k: 'Kyber', v: f.kyber_reported_kw }, { k: String(f.planned_1mw_racks_from || '1 MW'), v: 1000, hollow: true }], hi: 2, fmt: (v) => `${num(v)} kW` }),
    node_roadmap: (f) => ({ type: 'ticks', from: 2025, to: 2029, items: Object.entries(f).filter(([k]) => /^[NA]\d+$/.test(k)).map(([k, v]) => ({ k, year: yearIn(v) || 2025.75 })), hi: 'first' }),
    flop_per_watt: (f) => ({ type: 'bars', vals: Object.entries(f).filter(([, v]) => typeof v === 'number').map(([k, v]) => ({ k: k.split(' ')[0], v })), hi: 'last' }),
  };
  const limitViz = (x) => { const f = x.figure; if (!f || typeof f !== 'object' || !LVIZ[x.id]) return ''; try { const spec = LVIZ[x.id](f); return spec ? vz({ ...spec, h: LH }) : ''; } catch { return ''; } };
  function limitsFrom(j) {
    const list = (j && (j.items || j.limits || j.rows)) || (Array.isArray(j) ? j : null);
    if (!list || !list.length) return null;
    const order = Object.keys(GROUPS);
    const groups = new Map();
    for (const x of list) { const g = text(x, 'group', 'id') || 'other'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); }
    return [...groups].sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99).map(([g, xs]) => ({
      label: GROUPS[g] || g.replace(/_/g, ' '),
      rows: xs.map((x) => {
        const u = urlOf(x), t = titleOf(x, '').replace(/[:,(].*$/, '').trim();
        const d = String(text(x, 'date', 'as_of', 'year')).replace(/\s*\(.*$/, '').replace(/;.*$/, '').trim();
        const sv = x.series_v3 ? series(x.series_v3) : null, logy = sv ? sv.points.some((p) => p[1] > 0) && Math.max(...sv.points.map((p) => p[1])) / Math.max(1e-9, Math.min(...sv.points.filter((p) => p[1] > 0).map((p) => p[1]))) > 100 : false;
        const viz = limitViz(x) || (sv && sv.points.length > 1 ? vz({ type: 'line', pts: sv.points.map((p) => [p[0], p[1]]), log: logy, h: LH }) : '');
        return { figure: esc(headline(x)), label: LABEL[x.id] || text(x, 'label', 'id').replace(/_/g, ' '), reading: text(x, 'reading', 'sentence', 'statement'), date: /^\d{4}(-\d\d)?(-\d\d)?$/.test(d) ? when(d) : d, url: u, source: t && t.length <= 24 ? t : shortHost(u), viz };
      }),
    }));
  }
  // small multiples: a card per limit in a six-column grid, grouped under mono heads and hairlines
  const card = (r, g, first) => `<li class="mo-lcard${first ? ' first' : ''}"${r.reading ? ` title="${esc(r.reading)}"` : ''}>
      <span class="mo-lg sc">${first ? esc(g) : ''}</span>
      <span class="mo-ltext"><span class="mo-lfig">${r.figure}</span><span class="mo-llab">${esc(r.label)}</span></span>
      ${r.viz || '<span class="mo-nospark" aria-hidden="true"></span>'}
      <span class="mo-src">${r.date ? `<span class="d">${esc(r.date)}</span>` : ''}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.source || shortHost(r.url))}</a>` : r.source ? `<span>${esc(r.source)}</span>` : ''}</span></li>`;
  function drawLimits(groups) {
    // one continuous six-column flow in group order; the first card of a group carries the group's name
    $('[data-block="limits"]').innerHTML = `<ol class="mo-lcards">${groups.map((g) => g.rows.map((r, i) => card(r, g.label, i === 0)).join('')).join('')}</ol>`;
  }

  /* ---------- Politicized: issues as rows, kinds of actor as columns, a square per stated position ---------- */
  const KINDS = { us_federal: 'US federal', congress: 'Congress', congress_r: 'Congress (R)', congress_d: 'Congress (D)', congress_bipartisan: 'Congress (both)', us_state: 'US states', local: 'Local', frontier_lab: 'Frontier labs', platform: 'Platforms', chipmaker: 'Chipmakers', venture: 'Venture', trade_group: 'Trade groups', publisher_creator: 'Publishers', union: 'Unions', civil_society: 'Civil society', academic: 'Academics', utility: 'Utilities', eu: 'EU', china: 'China', foreign_government: 'Foreign govts', international: 'International' };
  const STANCE = { yes: 'yes', no: 'no', conditional: 'with conditions', mixed: 'with conditions' };
  const SHORT = { yes: 'yes', no: 'no', conditional: 'cond.', mixed: 'cond.' };
  // party or administration: the actor's own field, else read from its label
  // normalised to R, D, bipartisan or an administration; "none" and "by cell" fall through to the label or the cell
  const normParty = (p) => { const v = String(p || '').trim(); if (!v || /^(none|by cell|n\/a)$/i.test(v)) return ''; if (/^(R|Republican)$/i.test(v)) return 'R'; if (/^(D|Democrat(ic)?)$/i.test(v)) return 'D'; if (/bipartisan|both/i.test(v)) return 'bipartisan'; return v; };
  const partyOf = (a, c) => { if (!a) return ''; const own = normParty(a.party); if (own) return own; if (c) { const cp = normParty(c.party); if (cp) return cp; } const l = String(a.label || ''); if (/bipartisan|\(R\).*\(D\)/i.test(l)) return 'bipartisan'; if (/\bRepublican|\(R\)/.test(l)) return 'R'; if (/\bDemocrat|\(D\)/.test(l)) return 'D'; const m = l.match(/(Trump|Biden) administration/i); return m ? `${m[1]} administration` : ''; };
  const partyLabel = (p) => (p === 'R' ? 'Republican' : p === 'D' ? 'Democratic' : p);
  // a kind column for the actor; Congress splits by party when the data carries one
  const kindOf = (a) => { const k = a.kind || 'other'; if (k !== 'congress') return k; const p = partyOf(a); return p === 'R' ? 'congress_r' : p === 'D' ? 'congress_d' : p ? 'congress_bipartisan' : 'congress'; };
  // the Policy atlas has no subject tag for China framing; those instruments sit under export controls there
  const POLICY_ISSUE = { 'china-framing': 'export-controls' };
  let POL = null, pinned = null;
  // the record event behind a cell: one that names the actor (in orgs or the title) within three days of the evidence date
  const dayOf = (d) => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
  const actorRe = (label) => { const w = String(label || '').replace(/\s*\(.*?\)/g, '').trim(); return w ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null; };
  function recordFor(label, date) {
    const d0 = dayOf(date), re = actorRe(label); if (d0 == null || !re || !Array.isArray(db.events)) return null;
    let best = null, bd = 4;
    for (const e of db.events) {
      if (!e.year || !e.month || !e.day) continue;
      const dd = Math.abs(Date.UTC(e.year, e.month - 1, e.day) / 864e5 - d0); if (dd > 3 || dd > bd) continue;
      if (!(e.orgs || []).some((o) => re.test(o)) && !re.test(e.title || '')) continue;
      if (dd < bd || (best && (e.significance || 0) > (best.significance || 0))) { best = e; bd = dd; }
    }
    return best;
  }
  function positions(j) {
    const out = [];
    const key = (c, k) => text(c, k, `${k}_id`, `${k}Id`);
    if (j.issues && j.issues.some((is) => Array.isArray(is.cells))) for (const is of j.issues) for (const c of is.cells || []) out.push({ ...c, issue: is.id });
    for (const c of j.cells || j.positions || j.entries || []) out.push({ ...c, issue: key(c, 'issue'), actor: key(c, 'actor') });
    for (const c of out) { const ev = c.evidence || {}; c.date = c.date || ev.date || ''; c.quote = c.quote || (ev.kind === 'quote' ? ev.quote_or_action : ''); c.action = c.action || (ev.kind && ev.kind !== 'quote' ? ev.quote_or_action : ''); c.url = urlOf(c) || ev.source_url || ''; c.srcTitle = titleOf(c, '') || ev.source_title || host(c.url); c.stance = c.stance ? String(c.stance).toLowerCase() : ''; c.movedText = typeof c.moved === 'string' ? c.moved : c.moved && typeof c.moved === 'object' ? text(c.moved, 'sentence', 'text', 'note') : ''; }
    return out;
  }
  function drawMatrix(j) {
    const wrap = $('.mo-polwrap'), grid = $('.mo-matrix');
    const cells = j ? positions(j) : [];
    if (!cells.length) { wrap.hidden = true; rip('politics', 'Politicized: research in progress; the matrix fills when data/politics_map.json lands.'); return; }
    wrap.hidden = false; rip('politics', '');
    const issues = (j.issues || [...new Set(cells.map((c) => c.issue))].map((id) => ({ id, label: id }))).map((x) => (typeof x === 'string' ? { id: x, label: x } : x));
    const actors = new Map((j.actors || []).map((a) => [a.id, a]));
    for (const c of cells) if (!actors.has(c.actor)) actors.set(c.actor, { id: c.actor, label: c.actor, kind: c.kind || 'other' });
    const present = new Set([...actors.values()].map(kindOf));
    const kinds = [...Object.keys(KINDS), ...[...present].filter((k) => !KINDS[k])].filter((k) => present.has(k));
    cells.forEach((c, i) => { c.k = `${c.issue}|${c.actor}|${c.date}|${i}`; });
    const byK = new Map(cells.map((c) => [c.k, c]));
    const hasStance = cells.some((c) => c.stance);
    POL = { issues, actors, kinds, cells, byK, hasStance };
    grid.style.setProperty('--cols', kinds.length);
    const tally = (is) => {
      // one position per actor, the later one where an actor moved, so the tally matches the squares
      const latest = new Map(); for (const c of cells.filter((c) => c.issue === is.id)) { const o = latest.get(c.actor); if (!o || String(c.date) > String(o.date)) latest.set(c.actor, c); }
      const here = [...latest.values()];
      if (!hasStance) return `${here.length} position${here.length === 1 ? '' : 's'}`;
      const n = (st) => here.filter((c) => (c.stance === 'mixed' ? 'conditional' : c.stance) === st).length;
      return [['yes', n('yes')], ['no', n('no')], ['cond.', n('conditional')]].filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(' \u00b7 ');
    };
    const cellHtml = (is, kind) => {
      const here = cells.filter((c) => c.issue === is.id && kindOf(actors.get(c.actor)) === kind).sort((a, b) => a.actor.localeCompare(b.actor) || String(a.date).localeCompare(String(b.date)));
      if (!here.length) return '<span class="mo-mcell none" role="gridcell" aria-hidden="true"></span>';
      const sq = (c) => { const a = actors.get(c.actor), p = partyOf(a, c); const tip = `${a.label}${p ? ` \u00b7 ${partyLabel(p)}` : ''}${c.stance ? ` \u00b7 ${STANCE[c.stance] || c.stance}` : ''}${c.date ? ` \u00b7 ${when(c.date)}` : ''}`; return `<button type="button" class="mo-sq" data-k="${esc(c.k)}" data-st="${esc(c.stance)}" title="${esc(tip)}" aria-label="${esc(is.label)}: ${esc(tip)}" aria-pressed="false"><i></i></button>`; };
      // an actor with two positions shows one square, the later stance, with the arrow before it marking the move;
      // the card carries the earlier position
      const runs = []; for (const c of here) { const r = runs[runs.length - 1]; if (r && r[0].actor === c.actor) r.push(c); else runs.push([c]); }
      return `<span class="mo-mcell" role="gridcell">${runs.map((r) => (r.length > 1 ? `<span class="mo-pair"><svg class="mo-arrow" viewBox="0 0 14 12" width="14" height="12" role="img" aria-label="moved"><title>moved</title><path d="M1.5 10.5 A7 7 0 0 1 12 5"/><path d="M8.5 4 L12.2 4.8 L11.3 8.5"/></svg>${sq(r[r.length - 1])}</span>` : sq(r[0]))).join('')}</span>`;
    };
    grid.innerHTML = `<div class="mo-mrow mo-mhead" role="row"><span class="mo-ml" role="columnheader"><span class="sc">issue</span></span>${kinds.map((k) => `<span class="mo-mc" role="columnheader">${esc(KINDS[k] || k.replace(/_/g, ' '))}</span>`).join('')}</div>` +
      issues.map((is) => `<div class="mo-mrow" role="row" data-issue="${esc(is.id)}"><span class="mo-ml" role="rowheader" title="${esc(is.question || '')}"><a class="mo-mlt" href="#v=policy&amp;issue=${esc(POLICY_ISSUE[is.id] || is.id)}" title="${esc(is.question || '')}: the Policy atlas on this issue">${esc(is.label)}</a><span class="mo-tally sc">${esc(tally(is))}</span></span>${kinds.map((k) => cellHtml(is, k)).join('')}</div>`).join('');
    const key = $('.mo-key'); key.hidden = !hasStance; key.innerHTML = hasStance ? '<i class="mo-ki yes"></i> yes <i class="mo-ki no"></i> no <i class="mo-ki conditional"></i> with conditions, to the row\u2019s question' : '';
    if (!grid.dataset.wired) {
      grid.dataset.wired = '1';
      if (!TOUCH) {
        grid.addEventListener('mouseover', (ev) => { const sq = ev.target.closest('.mo-sq'); if (sq && !pinned) showCell(sq, false); });
        grid.addEventListener('mouseleave', () => { if (!pinned) showCell(null); });
      }
      grid.addEventListener('focusin', (ev) => { const sq = ev.target.closest('.mo-sq'); if (sq && !pinned) showCell(sq, false); });
      const sc = $('.mo-mscroll'); sc.addEventListener('scroll', () => cue(), { passive: true });
      // the sheet closes once the matrix has scrolled away
      if ('IntersectionObserver' in window) new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting && !$('.mo-sheet').hidden) closeSheet(); }, { threshold: 0 }).observe(grid);
    }
    showCell(null);
    cue();
  }
  // the matrix is wider than its box at most widths: a fade on the cut edge and a count of columns
  function cue() {
    const sc = $('.mo-mscroll'), note = $('.mo-mnote'); if (!sc || !POL) return;
    const cut = sc.scrollWidth > sc.clientWidth + 2, atEnd = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 2;
    sc.classList.toggle('cut', cut && !atEnd);
    note.hidden = !cut; if (cut) note.textContent = `${POL.kinds.length} columns, scroll \u2192`;
  }
  function pinCell(sq) {
    if (pinned === sq) { pinned = null; sq.setAttribute('aria-pressed', 'false'); if (narrow()) closeSheet(); else showCell(sq, false); return; }
    if (pinned) pinned.setAttribute('aria-pressed', 'false');
    pinned = sq; sq.setAttribute('aria-pressed', 'true'); showCell(sq, true);
  }
  function closeSheet() { const sh = $('.mo-sheet'); sh.hidden = true; sh.classList.remove('on'); if (pinned) { pinned.setAttribute('aria-pressed', 'false'); pinned = null; } showCell(null); }
  // the reading's first sentence, whole; the full reading stays in the row's title
  const clause = (t) => firstSentence(String(t || '').trim());
  const firstSentence = (t) => String(t || '').split(/(?<=[.!?])\s+(?=[A-Z\u201c"])/)[0];
  function showCell(sq, isPinned) {
    const card = $('.mo-card'), grid = $('.mo-matrix'), sheet = $('.mo-sheet');
    grid.querySelectorAll('.mo-sq.hot').forEach((x) => x.classList.remove('hot'));
    grid.querySelectorAll('.mo-mrow.hot').forEach((x) => x.classList.remove('hot'));
    const hint = () => { const n = POL ? POL.cells.length : 0; return `<p class="mo-cardhint">${n ? `${n} stated positions across ${POL.issues.length} issues and ${POL.actors.size} actors in ${POL.kinds.length} kinds. ${TOUCH ? 'Tap a square to read one; tap again to keep it.' : 'Hover a square to read one; click to keep it.'} An arrow before a square marks an actor that moved; the card gives the earlier position.${POL.hasStance ? '<span class="mo-hkey"><i class="mo-ki yes"></i> yes <i class="mo-ki no"></i> no <i class="mo-ki conditional"></i> with conditions</span>' : ''}` : ''}</p>`; };
    if (!sq || !POL) { card.innerHTML = hint(); return; }
    sq.classList.add('hot'); sq.closest('.mo-mrow').classList.add('hot');
    const c = POL.byK.get(sq.dataset.k); if (!c) return;
    const is = POL.issues.find((x) => x.id === c.issue) || {}, ac = POL.actors.get(c.actor) || {}, party = partyOf(ac, c);
    // the same actor's other position in this issue (the move), then the rest of the row
    const twin = POL.cells.find((o) => o.issue === c.issue && o.actor === c.actor && o.k !== c.k);
    const moved = c.movedText || (twin && twin.movedText) || '';
    const earlier = twin && String(twin.date) < String(c.date) ? twin : null;
    const recEv = recordFor(ac.label || c.actor, c.date) || (earlier ? recordFor(ac.label || c.actor, earlier.date) : null);
    const rest = POL.cells.filter((o) => o.issue === c.issue && o.k !== c.k && o !== twin);
    const line = (o, tag) => { const a = POL.actors.get(o.actor) || {}; return `<li${tag ? ' class="twin"' : ''}><span class="mo-oa" title="${esc(a.label || '')}">${esc(String(a.label || o.actor).replace(/\s*\(.*?\)/g, ''))}</span><span class="mo-os" title="${esc(o.stance ? (STANCE[o.stance] || o.stance) : '')}">${esc(o.stance ? (SHORT[o.stance] || o.stance) : o.date ? when(o.date).slice(-4) : '')}</span><span class="mo-op" title="${esc(text(o, 'position', 'summary'))}">${esc(firstSentence(text(o, 'position', 'summary')))}</span></li>`; };
    const others = [...(twin ? [line(twin, true)] : []), ...rest.map((o) => line(o))];
    const ev = c.evidence || {};
    const html = `<div class="mo-cardhead"><span class="sc">${esc(is.label)} &middot; ${esc(ac.label || c.actor)}${party ? ` &middot; ${esc(partyLabel(party))}` : ac.kind ? ` &middot; ${esc(KINDS[kindOf(ac)] || ac.kind)}` : ''}${c.stance ? ` &middot; <b>${esc(STANCE[c.stance] || c.stance)}</b>` : ''}</span>${isPinned && !narrow() ? '<span class="sc mo-pin">kept</span>' : ''}</div>
      ${is.question ? `<p class="mo-qn sc">${esc(is.question)}</p>` : ''}
      <p class="mo-pos">${esc(text(c, 'position', 'summary'))}</p>
      ${moved ? `<p class="mo-moved"><span class="sc">moved</span>${esc(moved)}</p>` : ''}
      ${earlier ? `<p class="mo-earlier"><span class="sc">earlier${earlier.date ? ` &middot; ${esc(when(earlier.date))}` : ''}${earlier.stance ? ` &middot; ${esc(STANCE[earlier.stance] || earlier.stance)}` : ''}</span>${esc(text(earlier, 'position', 'summary'))}</p>` : ''}
      ${text(c, 'answers') || ev.answers ? `<p class="mo-answers"><span class="sc">answers</span>${esc(text(c, 'answers') || ev.answers)}</p>` : ''}
      ${text(c, 'incentive') ? `<p class="mo-inc"><span class="sc">incentive${c.incentive_source_url ? ` &middot; <a href="${esc(c.incentive_source_url)}" target="_blank" rel="noopener">${esc(host(c.incentive_source_url))}</a>` : ''}</span>${esc(text(c, 'incentive'))}</p>` : ''}
      ${c.quote ? `<blockquote class="mo-q"><span class="mo-qt">&ldquo;${esc(String(c.quote).trim().replace(/^[\u201c"']+|[\u201d"']+$/g, ''))}&rdquo;</span>` : c.action ? `<blockquote class="mo-q plain"><span class="sc">${esc(ev.kind || 'action')}</span><span>${esc(c.action)}</span>` : ''}${c.quote || c.action ? `<footer>${c.date ? esc(when(c.date)) : ''}${c.url ? `${c.date ? ' &middot; ' : ''}<a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.srcTitle || '')}">${esc(host(c.url))}</a>` : ''}</footer></blockquote>` : ''}
      ${recEv ? `<p class="mo-record"><a class="mo-rec" href="#v=stream&amp;e=${esc(recEv.id)}" data-e="${esc(recEv.id)}">Open the record &rarr;</a> <span class="sc">${esc(recEv.title)}</span></p>` : ''}
      ${others.length ? `<details class="mo-others"${narrow() ? '' : ' open'}><summary class="sc">on the same issue &middot; ${others.length}</summary><ul>${others.join('')}</ul></details>` : ''}`;
    if (narrow()) { card.innerHTML = hint(); $('.mo-sheet-body').innerHTML = html; sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('on')); $('.mo-sheet-body').scrollTop = 0; }
    else { card.innerHTML = html; if (!sheet.hidden) { sheet.hidden = true; sheet.classList.remove('on'); } }
  }

  /* ---------- Perspectives, grouped by six broad fields ---------- */
  const FIELDS = [
    ['economy and work', /^(economics|labor|labor history|work)/i],
    ['energy and compute', /^(energy|compute|infrastructure)/i],
    ['power and security', /^(china studies|geopolitics|military|security|frontier ai lab)/i],
    ['law', /^law/i],
    ['mind and culture', /^(philosophy|ethics|history of technology|education|culture|psychology)/i],
    ['Global South and health', /^(global south|health|development|medicine)/i],
  ];
  const fieldOf = (p) => { const f = text(p, 'field'); if (f) return f; const d = text(p, 'discipline'); const hit = FIELDS.find(([, re]) => re.test(d)); return hit ? hit[0] : d || 'other'; };
  const figText = (p) => { const f = p && p.figure; if (!f || f.value == null) return ''; const u = String(f.unit || ''); const isPct = /^percent/.test(u); const ws = u.replace(/^percent\s*/, '').replace(/\s*\(.*$/, '').split(/\s+/).filter(Boolean).slice(0, 3); while (ws.length && /^(of|in|per|by|a|an|the|to|from|and|for)$/.test(ws[ws.length - 1])) ws.pop(); const words = ws.join(' '); return `${isPct ? `${num(f.value)}%` : num(f.value)}${words ? ` ${words}` : ''}`; };
  function drawField(list, byId) {
    const wrap = $('.mo-fieldwrap'), fld = $('.mo-field');
    const sur = (p) => String(p.name || '').split(' ').pop();
    const n01 = (v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : null);
    const rows = list.map((p) => ({ id: p.id, name: p.name, sur: sur(p), hz: n01(p.horizon), bl: n01(p.balance), fig: figText(p), dis: (p.disagrees_with || []).filter((id) => byId.has(id)), topic: text(p, 'topic') }));
    const both = rows.filter((r) => r.hz != null && r.bl != null), one = rows.filter((r) => (r.hz == null) !== (r.bl == null)), none = rows.filter((r) => r.hz == null && r.bl == null);
    if (both.length < 3) { wrap.hidden = true; return false; }
    wrap.hidden = false;
    fld.innerHTML = vz({ type: 'field', both, one, year: new Date().getFullYear(), h: 380 });
    fld.firstElementChild.setAttribute('role', 'img'); fld.firstElementChild.setAttribute('aria-label', `${both.length} voices placed by horizon and balance, ${one.length} on one axis, ${none.length} unscored`);
    $('.mo-method').textContent = 'Placed by two readings of each voice\u2019s own words: horizon and net effect; the readings are quoted on each card. Hollow marks on the rails are voices who state one axis only.';
    $('.mo-unscored').innerHTML = none.length ? `<h3 class="sc">Argue the mechanism, not the timing</h3><ul>${none.map((r) => `<li><a href="#persp-${esc(r.id)}" data-to="${esc(r.id)}" class="mo-fname">${esc(r.name)}</a>${r.topic ? `<span class="sc">${esc(r.topic)}</span>` : ''}</li>`).join('')}</ul>` : '';
    showVoice(byId.has('acemoglu-2025') ? 'acemoglu-2025' : both[0].id);
    return true;
  }
  let PER = new Map();
  function showVoice(id) {
    const card = $('.mo-pcard'); const p = id ? PER.get(id) : null;
    heldId = p ? id : null; markHeld();
    if (!p) { card.innerHTML = `<p class="mo-pchint sc">Hover or tap a voice for its quote; the hairlines join voices that disagree, orange for the voice you hold. The voices in full are below.</p>`; return; }
    const url = urlOf(p), fig = figText(p);
    card.innerHTML = `<p class="mo-pcname"><b>${esc(p.name)}</b>${text(p, 'affiliation') ? ` <span>${esc(text(p, 'affiliation').split(';')[0])}</span>` : ''}</p>
      ${fig ? `<p class="mo-pcfig">${esc(fig)}</p>` : ''}
      ${text(p, 'quote') ? `<blockquote class="mo-pcq">${esc(text(p, 'quote'))}</blockquote>` : ''}
      <p class="mo-pcview">${esc(text(p, 'view', 'sentence', 'summary'))}</p>
      ${p.horizon_why || p.balance_why ? `<p class="mo-pcwhy"><span class="sc">readings</span> ${p.horizon_why ? `<span><b>horizon${typeof p.horizon === 'number' ? ` ${num(p.horizon * 10)} yrs` : ' not stated'}:</b> ${esc(p.horizon_why)}</span>` : ''}${p.balance_why ? ` <span><b>balance${typeof p.balance === 'number' ? ` ${p.balance >= 0.5 ? '+' : '\u2212'}${num(Math.abs(p.balance - 0.5) * 2, 1)}` : ' not stated'}:</b> ${esc(p.balance_why)}</span>` : ''}</p>` : ''}
      <p class="sc">${esc(when(text(p, 'date')))}${url ? ` &middot; <a href="${esc(url)}" target="_blank" rel="noopener">${esc(host(url))}</a>` : ''} &middot; <a href="#persp-${esc(p.id)}" data-to="${esc(p.id)}" class="mo-fname">full entry</a></p>`;
  }
  function drawPerspectives(j) {
    const host_ = $('.mo-groups');
    const list = Array.isArray(j) ? j : (j && (j.perspectives || j.items || j.views)) || null;
    if (!list || !list.length) { host_.hidden = true; rip('perspectives', 'Perspectives: research in progress; the list fills when data/perspectives_now.json lands.'); return; }
    host_.hidden = false; rip('perspectives', '');
    const byId = new Map(list.map((p) => [p.id, p])); PER = byId;
    const hasField = drawField(list, byId);
    const tog = $('.mo-listtoggle'); tog.open = true;
    const groups = new Map();
    for (const p of list) { const g = fieldOf(p); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); }
    const order = FIELDS.map((f) => f[0]);
    const sorted = [...groups].sort((a, b) => ((order.indexOf(a[0]) + 99) % 99) - ((order.indexOf(b[0]) + 99) % 99));
    // within a field, a pair that disagrees opens the list
    const arrange = (ps) => { for (const p of ps) { const t = (p.disagrees_with || []).map((id) => ps.find((q) => q.id === id)).find(Boolean); if (t) return [p, t, ...ps.filter((q) => q !== p && q !== t)]; } return ps; };
    const nameOf = (id) => { const q = byId.get(id); return q ? String(q.name).split(' ').pop() : id; };
    // two loose columns, packed by measured height with each field whole; the quote leads as an orange pull quote,
    // the name in mono beneath, then the view, the condition under which it is wrong, and who disagrees
    const entry = (p) => { const url = urlOf(p); const dis = (p.disagrees_with || []).filter((id) => byId.has(id)); const aff = text(p, 'affiliation', 'role'); return `<li class="mo-p" data-pid="${esc(p.id || '')}" id="persp-${esc(p.id || '')}">
        ${text(p, 'quote') ? `<blockquote class="mo-pull"><span class="mo-pq">${esc(text(p, 'quote'))}</span></blockquote>` : ''}
        <span class="mo-who">${esc(text(p, 'name'))}${aff ? `<span title="${esc(aff)}">${esc(aff.split(';')[0])}</span>` : ''}</span>
        <span class="mo-say"><span class="mo-sent">${esc(text(p, 'view', 'sentence', 'summary', 'statement'))}</span>
          ${text(p, 'wrong_if') ? `<span class="mo-wrong"><span class="sc">wrong if</span> ${esc(text(p, 'wrong_if'))}</span>` : ''}
          ${dis.length ? `<span class="mo-dis sc">disagrees with ${dis.map((id) => `<a href="#persp-${esc(id)}" data-to="${esc(id)}">${esc(nameOf(id))}</a>`).join(', ')}</span>` : ''}</span>
        <span class="mo-when sc">${esc(when(text(p, 'date')))}${url ? `${text(p, 'date') ? ' &middot; ' : ''}<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(titleOf(p, ''))}">${esc(host(url))}</a>` : ''}</span></li>`; };
    const colHtml = (gs) => `<div class="mo-gcol">${gs.map(([g, ps]) => `<section class="mo-group"><h3 class="sc">${esc(g)}</h3><ol class="mo-plist">${arrange(ps).map(entry).join('')}</ol></section>`).join('')}</div>`;
    host_.innerHTML = colHtml(sorted);
    const two = getComputedStyle(host_).gridTemplateColumns.split(' ').length > 1;
    if (two) {
      const hs = [...host_.querySelectorAll('.mo-group')].map((g) => g.getBoundingClientRect().height);
      const L = [], R = []; let hl = 0, hr = 0;
      for (const i of hs.map((h, i) => i).sort((a, b) => hs[b] - hs[a])) { if (hl <= hr) { L.push(i); hl += hs[i]; } else { R.push(i); hr += hs[i]; } }
      const pick = (ix) => ix.sort((a, b) => a - b).map((i) => sorted[i]);
      host_.innerHTML = colHtml(pick(L)) + colHtml(pick(R));
    }
    tog.open = true;  // under 700 the list is the block; above, it sits open under the field
  }

  /* ---------- Step back: four small charts from the atlas's own calculations ---------- */
  const CW = 300, CH = 230, PAD = { l: 34, r: 10, t: 30, b: 24 };  // 300 units wide: at four across on 1440 the viewBox unit is a pixel, so 12-unit labels stay 12px or larger
  const axisT = (x, y, t, cls = '') => `<text class="ax ${cls}" x="${x}" y="${y}">${esc(String(t))}</text>`;
  const chartBox = (cls, title, svg, caption, view) => `<figure class="mo-chart${view ? ' link' : ''} ${cls}"${view ? ` data-view="${esc(view)}" tabindex="0" role="link"` : ''}><figcaption><span class="sc">${esc(title)}</span>${caption}</figcaption>${svg}</figure>`;
  // adoption, two charts: US households (five technologies in percent of US homes from the year each passed
  // 10 percent) and ChatGPT (millions of weekly users worldwide from launch). Different units, so different
  // charts; the one caption under both says so.
  function householdsChart(A) {
    const pick = [['Radio', 'Radio'], ['Colour TV', 'Colour TV'], ['Personal computer (microcomputer)', 'PC'], ['Internet', 'Internet'], ['Smartphone', 'Smartphone']];
    const T = A && A.technologies ? pick.map(([n, short]) => [short, A.technologies[n]]).filter(([, p]) => p && p.length) : [];
    if (T.length < 3) return '';
    const span = 15, LAB = 80; // the technology labels sit in a column right of the plot, 17 units apart, each with a leader
    const W = CW - PAD.l - LAB, H = CH - PAD.t - PAD.b;
    const X = (yr) => PAD.l + (Math.min(span, Math.max(0, yr)) / span) * W, Y = (v) => PAD.t + H - (v / 100) * H;
    const segs = T.map(([n, pts]) => { const p0 = pts.find((p) => p.value >= 10); if (!p0) return null; const seg = pts.filter((p) => p.year >= p0.year && p.year - p0.year <= span); const e = seg[seg.length - 1]; return { n, y0: p0.year, d: seg.map((p, i) => `${i ? 'L' : 'M'}${X(p.year - p0.year).toFixed(1)} ${Y(Math.min(100, p.value)).toFixed(1)}`).join(''), ex: X(e.year - p0.year), ey: Y(Math.min(100, e.value)) }; }).filter(Boolean);
    segs.sort((a, b) => a.ey - b.ey); let ly = -99; for (const g of segs) { g.ly = Math.max(g.ey + 4, ly + 17); ly = g.ly; }
    const lx = PAD.l + W + 12;
    const lines = segs.map((g) => `<path class="b thin" d="${g.d}"/><line class="lead" x1="${Math.max(g.ex, lx - 14).toFixed(1)}" y1="${g.ey.toFixed(1)}" x2="${(lx - 3).toFixed(1)}" y2="${(g.ly - 4).toFixed(1)}"/><text class="lab" x="${lx}" y="${g.ly.toFixed(1)}">${esc(g.n)}</text>`).join('');
    const svg = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="US households: ${segs.map((g) => `${g.n} from ${g.y0}`).join(', ')}, share of homes over fifteen years from the year each passed 10 percent">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'share of US homes, years after 10%', 'l')}
      ${[0, 50, 100].map((v) => axisT(PAD.l - 4, Y(v) + 4, `${v}%`, 'r')).join('')}
      ${[0, 5, 10, 15].map((v) => axisT(X(v), CH - 4, v === 0 ? 'year 0' : `+${v}`, v === 0 ? 'l' : v === 15 ? 'e' : 'c')).join('')}
      ${lines}
    </svg>`;
    return { svg, segs };
  }
  function chatgptChart(wu) {
    if (!wu || !wu.points || wu.points.length < 2) return '';
    const W = CW - PAD.l - PAD.r - 8, H = CH - PAD.t - PAD.b;
    const t0 = tOf('2022-11-30'), L = last(wu), tL = tOf(L[0]), spanY = Math.max(1, Math.ceil(tL - t0)), maxU = Math.ceil(Math.max(...wu.points.map((p) => p[1])) / 300) * 300;
    const X = (yr) => PAD.l + (Math.min(spanY, Math.max(0, yr)) / spanY) * W, Y = (v) => PAD.t + H - (v / maxU) * H;
    const du = [[t0, 0], ...wu.points.map((p) => [tOf(p[0]), p[1]])].map(([t, v], i) => `${i ? 'L' : 'M'}${X(t - t0).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const cx = X(tL - t0), cy = Y(L[1]);
    const xt = []; for (let v = 0; v <= spanY; v++) xt.push(v);
    const svg = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="ChatGPT weekly users worldwide, millions, from launch in November 2022 to ${num(L[1])} million">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'millions of weekly users', 'l')}
      ${[0, maxU / 2, maxU].map((v) => axisT(PAD.l - 4, Y(v) + 4, num(v), 'r')).join('')}
      ${xt.map((v) => axisT(X(v), CH - 4, v === 0 ? 'launch' : v === spanY ? `+${v} yrs` : `+${v}`, v === 0 ? 'l' : v === spanY ? 'e' : 'c')).join('')}
      <path class="o" d="${du}"/><circle class="b" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3"/>
      <text class="lab o e" x="${(PAD.l + W).toFixed(1)}" y="${(PAD.t + H - 10).toFixed(1)}">${esc(`${num(L[1])} m on ${when(L[0])}`)}</text>
    </svg>`;
    return { svg, L, first: wu.points[0], spanY: tL - t0 };
  }
  function adoptionCharts(A, wu) {
    const hh = householdsChart(A), cg = chatgptChart(wu);
    if (!hh && !cg) return '';
    const d = diffusion(A), med = d && d.stats && d.stats.median_since_1990 != null ? d.stats.median_since_1990 : null;
    const cap = `<p class="mo-adcap">Two units, two charts: the left is the share of US households, from the year each technology passed 10 percent${med != null ? `, a median ${yrs(med)} from 10 to 50 percent for arrivals since 1990` : ''}; the right is a count of people, ChatGPT${cg ? ` from ${num(cg.first[1])} million to ${num(cg.L[1] / 1000, 1)} billion weekly users worldwide in ${yrs(cg.spanY)}` : ''}. A share of one country's homes and a worldwide head count are not comparable, so they do not share an axis.</p>`;
    return `<div class="mo-adopt" data-view="diffusion">${hh ? chartBox('adoption', 'US households', hh.svg, '', 'diffusion') : ''}${cg ? chartBox('chatgpt', 'ChatGPT, weekly users worldwide', cg.svg, '', 'diffusion') : ''}${cap}</div>`;
  }
  // hype: a bar per year counting the record's items tagged bubble or hype cycle; the open run since the last peak in orange
  function hypeChart(h) {
    if (!h || h.empty || !h.years || !h.years.length) return '';
    const ys = h.years.filter((y) => y.year >= 1967), y0 = ys[0].year, y1 = ys[ys.length - 1].year, m = Math.max(1, ...ys.map((y) => y.n));
    const W = CW - PAD.l - PAD.r, H = CH - PAD.t - PAD.b, bw = Math.max(1.5, W / (y1 - y0 + 1) - 1.5);
    const X = (y) => PAD.l + ((y - y0) / (y1 - y0 + 1)) * W, Y = (n) => PAD.t + H - (n / m) * H;
    const cur = h.episodes[h.episodes.length - 1], openFrom = h.stats.open ? cur.peak + 1 : null;
    const svg = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Hype items per year since 1967, the open run in orange, the troughs as dotted lines">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'items a year', 'l')}
      ${[0, m].map((v) => axisT(PAD.l - 4, Y(v) + 4, v, 'r')).join('')}
      ${[1970, 1990, 2010, 2025].filter((v) => v >= y0 && v <= y1).map((v) => axisT(X(v), CH - 4, v, v === 2025 ? 'e' : 'c')).join('')}
      ${axisT(PAD.l + W, PAD.t - 14, 'open run in orange', 'e')}
      ${ys.map((y) => `<rect class="${openFrom && y.year >= openFrom ? 'o' : 'b'}" x="${X(y.year).toFixed(1)}" y="${Y(y.n).toFixed(1)}" width="${bw.toFixed(1)}" height="${(PAD.t + H - Y(y.n)).toFixed(1)}"/>`).join('')}
      ${openFrom ? `<line class="peak o" x1="${(X(openFrom) + bw / 2).toFixed(1)}" y1="${PAD.t}" x2="${(X(openFrom) + bw / 2).toFixed(1)}" y2="${PAD.t + H}"/><text class="lab o" x="${(X(openFrom) + bw / 2 + 3).toFixed(1)}" y="${PAD.t + 14}">${openFrom}</text>` : ''}
      ${h.episodes.map((e) => `<line class="peak" x1="${(X(e.trough) + bw / 2).toFixed(1)}" y1="${PAD.t}" x2="${(X(e.trough) + bw / 2).toFixed(1)}" y2="${PAD.t + H}"/><text class="lab" x="${(X(e.trough) + bw / 2 + (X(e.trough) > PAD.l + W * 0.8 ? -3 : 3)).toFixed(1)}" y="${X(e.trough) > PAD.l + W * 0.8 ? PAD.t + 31 : PAD.t + 14}"${X(e.trough) > PAD.l + W * 0.8 ? ' text-anchor="end"' : ''}>${e.trough}</text>`).join('')}
    </svg>`;
    return chartBox('hype', 'Hype', svg, `<span class="cap">${h.stats.episodes} boom-to-bust turns in the record\u2019s hype items since ${h.episodes[0].peak}, the troughs as dotted lines, a median fall of ${yrs(h.stats.median_fall)}; ${openFrom ? `the current run, in orange, has been open since ${openFrom}, the orange tick` : `the last trough came in ${cur.trough}`}.</span>`, 'patterns');
  }
  // lag: a dot per invention-to-rule pair, by the decade of the rule, the decade's median as an orange bar
  function lagChart(lg) {
    if (!lg || !lg.pairs || lg.pairs.length < 10) return '';
    const P = lg.pairs.filter((p) => p.year >= 1900), decs = [...new Set(P.map((p) => Math.floor(p.year / 10) * 10))].sort((a, b) => a - b);
    const cap = 60, W = CW - PAD.l - PAD.r, H = CH - PAD.t - PAD.b, cw = W / decs.length;
    const Y = (lag) => PAD.t + H - (Math.sqrt(Math.min(cap, Math.max(0, lag))) / Math.sqrt(cap)) * H;
    const dots = P.map((p, i) => { const k = decs.indexOf(Math.floor(p.year / 10) * 10); const jx = ((i * 7919) % 100) / 100; return `<circle class="b dot" cx="${(PAD.l + cw * (k + 0.15 + 0.7 * jx)).toFixed(1)}" cy="${Y(p.lag).toFixed(1)}" r="2"/>`; }).join('');
    const meds = decs.map((d, k) => { const v = P.filter((p) => Math.floor(p.year / 10) * 10 === d).map((p) => p.lag); const mdn = median(v); return `<rect class="o" x="${(PAD.l + cw * k + 3).toFixed(1)}" y="${(Y(mdn) - 1).toFixed(1)}" width="${(cw - 6).toFixed(1)}" height="2"/>`; }).join('');
    const svg = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Years from an invention to the first rule that answers it, a dot per pair by the decade of the rule, the median per decade in orange">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'years to first rule', 'l')}
      ${[0, 10, 30].map((v) => axisT(PAD.l - 4, Y(v) + 4, v, 'r')).join('')}${axisT(PAD.l - 4, Y(cap) + 4, '60+', 'r')}
      ${decs.filter((d, k) => k % 2 === 0 || decs.length < 8).map((d) => axisT(PAD.l + cw * (decs.indexOf(d) + 0.5), CH - 4, `${String(d).slice(2)}s`, 'c')).join('')}
      ${axisT(PAD.l + W, PAD.t - 14, 'by decade', 'e')}
      ${dots}${meds}
    </svg>`;
    const now = [...lg.periods].reverse().find((p) => p.n >= 3) || lg.periods[lg.periods.length - 1], then = lg.periods.find((p) => p.from < 1950) || lg.periods[0];
    return chartBox('lag', 'Lag', svg, `<span class="cap">Years from an invention to the first rule that answers it, one dot per linked pair by the decade of the rule, the median per decade in orange: ${yrs(now.median_lag)} in the ${now.label} over ${now.n} pairs, ${yrs(then.median_lag)} ${then.label} over ${then.n}; lags past 60 years sit on the top line.</span>`, 'patterns');
  }
  async function drawStep() {
    rip('step', 'Step back: computing from the record.');
    try { await ensure('past', 'series'); } catch { /* the captions below say what is missing */ }
    const charts = [];
    try { const A = (db.series || []).find((x) => x.id === 'adoption'); charts.push(adoptionCharts(A, series('chatgpt_weekly_users'))); } catch (err) { console.warn('now: adoption', err); }
    let C = null;
    try { C = context(db.events, 1); } catch (err) { console.warn('now: context', err); }
    if (C) {
      try { charts.push(hypeChart(hype(C))); } catch (err) { console.warn('now: hype', err); }
      try { charts.push(lagChart(lagEra(C))); } catch (err) { console.warn('now: lag', err); }
    }
    const html = charts.filter(Boolean).join('');
    $('.mo-charts').innerHTML = html;
    rip('step', html ? '' : 'Step back: the record and its measures are not in this build.');
  }

  /* ---------- the print passes: blue, then orange with a registration jitter, then the grain stills ----------
     The grain is an SVG noise tile; for the flicker it is reseeded at 12 fps for 1.5s (18 frames, six seeds in
     turn), then holds the last seed. */
  const grainUrl = (seed) => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.16 0 0 0 0 0.47 0 0 0 1 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")`;
  let grainT = null;
  const stopGrain = () => { if (grainT) { clearInterval(grainT); grainT = null; } };
  function press() {
    el.classList.remove('pressed'); void el.offsetWidth; el.classList.add('press');
    const g = $('.mo-grain'); let frame = 0; stopGrain();
    grainT = setInterval(() => { frame += 1; g.style.backgroundImage = grainUrl(1 + (frame % 6)); if (frame >= 18) stopGrain(); }, 1000 / 12);
    setTimeout(() => { el.classList.remove('press'); el.classList.add('pressed'); }, 2000);
  }

  let built = false;
  async function build() {
    if (built) return; built = true;
    const [v3, lim, pol, per] = await Promise.all([optional('series_v3.json'), optional('compute_limits.json'), optional('politics_map.json'), optional('perspectives_now.json')]);
    V3 = v3 && Array.isArray(v3.series) ? v3.series : Array.isArray(v3) ? v3 : [];
    const cells = barCells(lim);
    $('.mo-cells').innerHTML = cells.map(cell).join('');
    rip('bar', cells.length ? '' : 'series_v3.json is not in this build; the bar fills when it lands.');
    if (!RM) press();
    const L = limitsFrom(lim);
    if (L) { rip('limits', ''); drawLimits(L); } else { drawLimits([{ label: 'From the measures', rows: limitsFallback().map((r) => ({ figure: esc(r.figure), label: r.context.replace(/^[a-z ]+: /, ''), date: r.date, url: r.url, source: r.source })) }]); rip('limits', 'From the measures until data/compute_limits.json lands; the data limit is research in progress.'); }
    drawMatrix(pol);
    drawPerspectives(per);
    drawAllViz(true);
    drawStep();
  }
  el.addEventListener('mouseover', (ev) => { const fd = ev.target.closest('.mo-fdot'); if (fd) showVoice(fd.dataset.pid); });
  el.addEventListener('focusin', (ev) => { const fd = ev.target.closest('.mo-fdot'); if (fd) showVoice(fd.dataset.pid); });
  if (typeof ResizeObserver !== 'undefined') { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => drawAllViz(false)); }).observe(el); }

  function render() { build(); }
  let wasNarrow = narrow();
  function resize() { cue(); if (wasNarrow !== narrow()) { wasNarrow = narrow(); if (pinned) showCell(pinned, true); else closeSheet(); } }
  return { render, resize, hover() {}, lit() {} };
}
