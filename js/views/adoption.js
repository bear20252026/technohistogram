// ADOPTION (History). Blueprint Atlas on the navy ground: US households, the four slowest and four fastest
// technologies by the years they took to go from 10 to 50 percent of US households, drawn as line objects on an
// equal-interval axis in the order they reached one home in ten. The headline compares the median interval before and
// after 1990. Every number is computed here from site/data/series/adoption.json; the full curves (the diffusion module)
// open in the evidence panel.
import { state as S } from '../store.js';
import { seriesById, host, ensureNow } from '../data.js';
import { esc } from '../ui.js';
import { reduced } from '../lit.js';
import diffusion from './diffusion.js';

const CSS_HREF = new URL('../../css/adoption.css', import.meta.url).href;
const KEY = 'adoption:curves';
const SPLIT = 1990;
const PICK = 4; // slowest and fastest each
// the 20 curves are the 22 entries less the alternative refrigerator line and the Television entry, which starts in
// 1992 at 97 percent (the same set diffusion.js draws)
const SKIP = (n) => /alt\. series/.test(n) || n === 'Television';
const NAME = { 'Telephone (landline)': 'telephone', 'Personal computer (microcomputer)': 'personal computer', 'Colour TV': 'colour TV', 'Cable TV': 'cable TV' };
const nameOf = (n) => NAME[n] || n.toLowerCase();


// line drawings in a 100 x 100 box, strokes only; every shape carries pathLength 1 for the draw-on
const P = (d) => `<path d="${d}"${/Z\s*$/.test(d) ? ' class="cl"' : ''} pathLength="1"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" pathLength="1"/>`;
const R = (x, y, w, h, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" pathLength="1"/>`;
const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="1"/>`;
const DRAW = {
  // candlestick telephone: base, stem, mouthpiece, receiver on its hook, cord
  'Telephone (landline)': P('M30 94 Q50 84 70 94 Z') + L(50, 88, 50, 30) + P('M50 30 L40 18 Q50 12 60 18 Z') + L(50, 46, 64, 40)
    + P('M64 40 L72 40 L72 72 L64 72') + R(66, 64, 10, 14, 3) + P('M30 94 Q16 86 20 70 Q24 58 18 48'),
  // cathedral radio: arched cabinet, grille, dial, two knobs
  Radio: P('M20 94 L20 46 Q20 12 50 12 Q80 12 80 46 L80 94 Z') + P('M32 64 L32 44 Q32 26 50 26 Q68 26 68 44 L68 64 Z')
    + L(41, 30, 41, 64) + L(50, 26, 50, 64) + L(59, 30, 59, 64) + C(50, 76, 5) + C(32, 86, 3.5) + C(68, 86, 3.5),
  // wringer washer: tub on legs, wringer rollers above
  'Washing machine': P('M24 44 L76 44 L72 84 L28 84 Z') + L(30, 84, 26, 96) + L(70, 84, 74, 96) + L(26, 52, 74, 52)
    + L(42, 44, 42, 30) + L(58, 44, 58, 30) + R(32, 18, 36, 6, 3) + R(32, 25, 36, 6, 3) + P('M68 21 L80 14 L84 18'),
  // window air conditioner: cabinet, slatted grille, control strip
  'Air conditioning': R(12, 30, 76, 46, 2) + L(12, 70, 88, 70) + L(20, 38, 62, 38) + L(20, 45, 62, 45) + L(20, 52, 62, 52) + L(20, 59, 62, 59)
    + L(70, 36, 70, 64) + C(79, 42, 3.5) + C(79, 54, 3.5) + P('M6 76 L94 76'),
  // dishwasher: tall door, control band, handle, rack line seen through the vent
  Dishwasher: R(22, 12, 56, 82, 2) + L(22, 26, 78, 26) + C(32, 19, 2.5) + C(42, 19, 2.5) + L(56, 19, 70, 19) + L(36, 34, 64, 34)
    + L(26, 88, 74, 88),
  // microwave: box, door window, control panel with buttons
  Microwave: R(8, 30, 84, 48, 3) + R(16, 38, 50, 32, 2) + L(72, 30, 72, 78) + R(77, 38, 10, 8, 1) + C(79, 56, 1.8) + C(85, 56, 1.8)
    + C(79, 63, 1.8) + C(85, 63, 1.8) + L(60, 50, 60, 58),
  // social media: two speech bubbles answering each other
  'Social media': P('M10 20 L60 20 Q66 20 66 26 L66 50 Q66 56 60 56 L32 56 L20 66 L22 56 L16 56 Q10 56 10 50 Z') + L(20, 32, 54, 32) + L(20, 42, 46, 42)
    + P('M44 62 L84 62 Q90 62 90 68 L90 86 Q90 92 84 92 L80 92 L82 100 L70 92 L50 92 Q44 92 44 86 Z') + L(54, 74, 80, 74),
  // tablet: slab, screen, home button
  Tablet: R(22, 10, 56, 84, 6) + R(28, 18, 44, 64, 1) + C(50, 88, 2.6),
  // the rest of the twenty, drawn when the data makes them the slowest or fastest
  Refrigerator: R(26, 8, 48, 88, 4) + L(26, 36, 74, 36) + L(66, 18, 66, 30) + L(66, 44, 66, 66) + L(30, 96, 30, 100) + L(70, 96, 70, 100),
  'Electric power': P('M38 56 Q26 46 26 32 Q26 10 50 10 Q74 10 74 32 Q74 46 62 56 L62 70 L38 70 Z') + L(40, 76, 60, 76) + L(42, 82, 58, 82) + P('M44 70 L46 40 L50 48 L54 40 L56 70'),
  Automobile: P('M8 70 L8 56 L20 52 L30 34 L66 34 L78 52 L92 56 L92 70 Z') + C(26, 72, 9) + C(74, 72, 9) + L(48, 34, 48, 52) + L(22, 52, 78, 52),
  'Colour TV': R(10, 22, 80, 58, 6) + R(18, 30, 54, 42, 8) + C(81, 40, 3) + C(81, 52, 3) + L(30, 80, 26, 92) + L(70, 80, 74, 92) + L(38, 22, 28, 8) + L(62, 22, 72, 8),
  'Cable TV': R(10, 24, 80, 56, 6) + R(18, 32, 64, 40, 4) + L(30, 80, 30, 88) + L(70, 80, 70, 88) + P('M50 88 Q50 96 64 96 L90 96'),
  'Personal computer (microcomputer)': R(20, 8, 60, 46, 3) + R(27, 15, 46, 32, 1) + L(44, 54, 40, 64) + L(56, 54, 60, 64) + R(10, 66, 80, 18, 2) + L(18, 75, 82, 75),
  Internet: C(50, 50, 38) + P('M50 12 Q30 50 50 88') + P('M50 12 Q70 50 50 88') + L(12, 50, 88, 50) + P('M18 32 Q50 40 82 32') + P('M18 68 Q50 60 82 68'),
  'Cell phone': R(32, 22, 36, 74, 6) + R(37, 30, 26, 22, 1) + L(60, 22, 60, 6) + C(42, 62, 2) + C(50, 62, 2) + C(58, 62, 2) + C(42, 72, 2) + C(50, 72, 2) + C(58, 72, 2) + C(42, 82, 2) + C(50, 82, 2) + C(58, 82, 2),
};
const FALLBACK = R(20, 20, 60, 60, 4);

// the stylesheet is the module's own; the plate is measured only once it applies
let cssReady = null;
function loadCss() {
  if (cssReady) return cssReady;
  const have = document.querySelector(`link[href="${CSS_HREF}"]`);
  if (have && have.sheet) return (cssReady = Promise.resolve());
  const l = have || Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CSS_HREF });
  cssReady = new Promise((res) => { l.addEventListener('load', res, { once: true }); l.addEventListener('error', res, { once: true }); });
  if (!have) document.head.appendChild(l);
  return cssReady;
}

// crossing of a threshold, linearly interpolated between observed years. A series whose first value is above the
// threshold has no observed crossing (null); one that starts exactly on it crosses in its first year.
function cross(pts, th) {
  let prev = null;
  for (const p of pts) {
    if (p.value >= th) {
      if (!prev) return p.value === th ? p.year : null;
      return prev.year + ((th - prev.value) / (p.value - prev.value)) * (p.year - prev.year);
    }
    prev = p;
  }
  return null;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

export default function adoption(el, ctx) {
  const css = loadCss();
  el.classList.add('ad-view');
  // the curves file may still be on its way on a cold deep link: hold the ground, then build once it lands
  let api = null, last = null;
  const shell = { render(s, ch) { if (api) api.render(s, ch); else last = s; }, resize() { if (api) api.resize(); }, hover() {}, teardown() { if (api) api.teardown(); } };
  const boot = () => { api = build(el, ctx); if (last) api.render(last, new Set(['*'])); };
  Promise.all([css, seriesById('adoption') ? null : ensureNow('series')]).then(() => { if (seriesById('adoption')) boot(); else el.innerHTML = '<div class="state-msg"><div><h2>No adoption data</h2></div></div>'; });
  return shell;
}

function build(el, ctx) {
  const A = seriesById('adoption');

  // every one of the twenty, with its crossings and the interval, or the reason it has none
  const all = Object.entries(A.technologies).filter(([n]) => !SKIP(n)).map(([n, pts]) => {
    const t10 = cross(pts, 10), t50 = cross(pts, 50);
    const why = t10 == null && pts[0].value > 10 ? `starts at ${+pts[0].value.toFixed(1)} percent in ${pts[0].year}` : t50 == null ? `peaks at ${+Math.max(...pts.map((p) => p.value)).toFixed(1)} percent by ${pts[pts.length - 1].year}` : '';
    return { key: n, name: nameOf(n), pts, t10, t50, yrs: t10 != null && t50 != null ? t50 - t10 : null, why };
  });
  const timed = all.filter((t) => t.yrs != null);
  const out = all.filter((t) => t.yrs == null);
  const bySpeed = timed.slice().sort((a, b) => a.yrs - b.yrs);
  const chosen = [...bySpeed.slice(-PICK), ...bySpeed.slice(0, PICK)].sort((a, b) => a.t10 - b.t10);
  const before = timed.filter((t) => t.t10 < SPLIT), after = timed.filter((t) => t.t10 >= SPLIT);
  const mB = Math.round(median(before.map((t) => t.yrs))), mA = Math.round(median(after.map((t) => t.yrs)));
  const ratio = mB / mA;
  const headline = ratio >= 3 ? 'US homes adopt technology three times sooner'
    : ratio >= 2 ? 'US homes adopt technology in half the time'
    : ratio > 1.2 ? 'US homes adopt technology sooner than they did'
    : 'US homes adopt technology at the same pace';
  const yrsTxt = (v) => { const n = Math.round(v); return `${n} year${n === 1 ? '' : 's'}`; };
  const srcUrl = A.sources[0].url;
  const span = [Math.min(...all.map((t) => t.pts[0].year)), Math.max(...all.map((t) => t.pts[t.pts.length - 1].year))];

  el.innerHTML = `<div class="ad-root">
    <header class="ad-head"><span class="ad-kick">US adoption</span><h2 class="ad-title">${esc(headline)}</h2>
      <p class="ad-lede">Years from 10% to 50% adoption in US homes.</p><p class="ad-dek">How long Americans took to adopt twenty technologies, from the telephone to the smartphone. One country, not the world.</p></header>
    <div class="ad-plate"></div>
    <footer class="ad-foot"><span>Source: <a href="${esc(srcUrl)}" target="_blank" rel="noopener">Our World in Data</a>, from Comin and Hobijn (2004) and others</span>
      <button type="button" class="ad-more" aria-haspopup="dialog">All ${all.length} curves <span aria-hidden="true">&rarr;</span></button></footer>
  </div>`;
  const plate = el.querySelector('.ad-plate');
  el.querySelector('.ad-more').addEventListener('click', () => openCurves());

  let hiKey = null, drawn = false;
  const meas = document.createElement('canvas').getContext('2d');
  const tw = (t, font) => { meas.font = font; return meas.measureText(t).width; };
  const NM_FONT = (px) => `400 ${px}px Instrument Sans, Georgia, serif`;
  // a name wider than its cell breaks into two lines at the space nearest the middle
  const lines = (t, w, font) => { if (tw(t, font) <= w || !t.includes(' ')) return [t]; const sp = [...t.matchAll(/ /g)].map((m) => m.index); const mid = t.length / 2; const i = sp.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0]; return [t.slice(0, i), t.slice(i + 1)]; };
  function draw() {
    const W = Math.max(280, plate.clientWidth), phone = el.clientWidth < 760;
    const grid = phone || W < 1000; // a tablet-width plate sets the eight in two rows of four
    const cols = phone ? 2 : W < 1000 ? 4 : chosen.length, rows = Math.ceil(chosen.length / cols), cw = W / cols;
    const nmPx = phone ? 16 : cw < 110 ? 15 : 17;
    const Y_FONT = '400 12px "Instrument Sans", sans-serif', R_FONT = '400 14px "Instrument Sans", sans-serif';
    const fit = cw - 10;
    // per cell: "10% reached: 1903", the name, "43 years to 50%"; each breaks into two lines when wider than its cell
    const L3 = chosen.map((t) => ({ y: lines(`10% reached: ${Math.round(t.t10)}`, fit, Y_FONT), n: lines(t.name, fit, NM_FONT(nmPx)), r: lines(`${yrsTxt(t.yrs)} to 50%`, fit, R_FONT) }));
    const ny = Math.max(...L3.map((l) => l.y.length)), nn = Math.max(...L3.map((l) => l.n.length)), nr = Math.max(...L3.map((l) => l.r.length));
    const below = 18 + ny * 15 + 8 + nn * (nmPx + 2) + 6 + nr * 17 + 18; // per-cell baseline, year lines, name lines, interval lines, bar
    let s, H, rowH;
    let off = 0;
    if (grid) { s = Math.min(phone ? 112 : 130, cw * 0.62); rowH = s + 16 + below + 22; H = rows * rowH; if (!phone) { off = Math.max(0, (plate.clientHeight - H) * 0.4); H = Math.max(H, plate.clientHeight); } }
    else { const avail = Math.max(160, plate.clientHeight); s = Math.max(56, Math.min(cw * 0.86, avail - below - 40, 200)); rowH = avail; H = avail; off = Math.max(0, (avail - (s + 14 + below + 12)) * 0.42); }
    const maxYrs = Math.max(...chosen.map((t) => t.yrs));
    const tsp = (arr, x, dy) => arr.map((ln, k) => `<tspan x="${x}" dy="${k ? dy : 0}">${esc(ln)}</tspan>`).join('');
    const cells = chosen.map((t, i) => {
      const c = i % cols, r = Math.floor(i / cols), cx = c * cw + cw / 2;
      const axis = grid ? off + r * rowH + s + 16 : off + 12 + s + 14;
      const top = axis - 14 - s;
      const l = L3[i];
      const yY = axis + 18, yName = yY + (ny - 1) * 15 + 8 + nmPx, yYr = yName + (nn - 1) * (nmPx + 2) + 6 + 15, yDim = yYr + (nr - 1) * 17 + 14;
      const dw = Math.max(6, (t.yrs / maxYrs) * cw * 0.84);
      // each object stands on its own baseline; no rule runs between the cells
      const base = `<line class="ad-ax" x1="${c * cw + 10}" x2="${(c + 1) * cw - 10}" y1="${axis}" y2="${axis}"/>`;
      return `<g class="ad-cell" role="listitem" tabindex="0" data-k="${esc(t.key)}" style="--i:${i}" aria-label="${esc(t.name)}: ${yrsTxt(t.yrs)} from 10 to 50 percent of US households, ${Math.round(t.t10)} to ${Math.round(t.t50)}">
        <rect class="ad-hit" x="${c * cw}" y="${top - 8}" width="${cw}" height="${yDim - top + 18}"/>
        <g class="ad-obj" transform="translate(${cx - s / 2},${top}) scale(${s / 100})">${DRAW[t.key] || FALLBACK}</g>
        ${base}
        <text class="ad-y" x="${cx}" y="${yY}" text-anchor="middle">${tsp(l.y, cx, 15)}</text>
        <text class="ad-nm" x="${cx}" y="${yName}" text-anchor="middle" font-size="${nmPx}">${tsp(l.n, cx, nmPx + 2)}</text>
        <text class="ad-yr" x="${cx}" y="${yYr}" text-anchor="middle">${tsp(l.r, cx, 17)}</text>
        <rect class="ad-bar" x="${cx - dw / 2}" y="${yDim - 3}" width="${dw}" height="6"/>
      </g>`;
    }).join('');
    const axisLine = '';
    plate.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="list" aria-label="The ${PICK} slowest and ${PICK} fastest, in the order they reached one home in ten">${axisLine}${cells}</svg>`;
    plate.classList.toggle('phone', phone);
    if (!drawn && !reduced()) { plate.classList.add('drawing'); setTimeout(() => plate.classList.remove('drawing'), 2200); }
    drawn = true;
    setHi(hiKey);
  }
  function setHi(k) {
    hiKey = k;
    plate.querySelectorAll('.ad-cell').forEach((c) => c.classList.toggle('hi', c.dataset.k === k));
    const svg = plate.querySelector('svg'); if (svg) svg.classList.toggle('has-hi', !!k);
  }
  plate.addEventListener('pointerover', (ev) => { const c = ev.target.closest('.ad-cell'); if (c) setHi(c.dataset.k); });
  plate.addEventListener('pointerleave', () => setHi(null));
  plate.addEventListener('focusin', (ev) => { const c = ev.target.closest('.ad-cell'); if (c) setHi(c.dataset.k); });
  plate.addEventListener('focusout', () => setHi(null));
  plate.addEventListener('click', (ev) => { const c = ev.target.closest('.ad-cell'); if (c) openCurves(); });
  plate.addEventListener('keydown', (ev) => { const c = ev.target.closest('.ad-cell'); if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openCurves(); } });

  // ---- evidence panel: method, the full table, the twenty curves (diffusion module) ----
  const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const panelHtml = () => `<div class="ad-ev">
    <p class="summary">Each interval runs from the year a technology first reached 10 percent of US households to the year it reached 50 percent, read off the yearly values with straight lines between observed years. ${timed.length} of the ${all.length} technologies have both crossings in the data; the ${PICK} slowest and ${PICK} fastest are drawn. The headline compares the median interval for the ${before.length} that reached 10 percent before ${SPLIT} (${r1(median(before.map((t) => t.yrs)))} years) with the ${after.length} that reached it in ${SPLIT} or later (${r1(median(after.map((t) => t.yrs)))} years). Smartphone and social media are shares of adults rather than households.</p>
    <div class="sect-h"><span>All ${timed.length} intervals</span><span>${timed.length}</span></div>
    <table class="ad-tab"><thead><tr><th>Technology</th><th>10%</th><th>50%</th><th>Years</th></tr></thead><tbody>
      ${timed.slice().sort((a, b) => a.t10 - b.t10).map((t) => `<tr${chosen.includes(t) ? ' class="on"' : ''}><td>${esc(t.name)}</td><td>${r1(t.t10)}</td><td>${r1(t.t50)}</td><td>${r1(t.yrs)}</td></tr>`).join('')}
    </tbody></table>
    <div class="sect-h"><span>Without an interval</span><span>${out.length}</span></div>
    <ul class="ad-out">${out.map((t) => `<li><b>${esc(t.name)}</b> ${esc(t.why)}</li>`).join('')}</ul>
    <div class="sect-h"><span>The ${all.length} curves</span><span>${span[0]} to ${span[1]}</span></div>
    <div class="ad-host"></div>
    <div class="sect-h"><span>Source</span><span>1</span></div>
    <ol class="sources"><li><a href="${esc(srcUrl)}" target="_blank" rel="noopener">${esc(A.sources[0].title)}</a><span class="host">${esc(host(srcUrl))}</span></li></ol>
  </div>`;
  let curves = null;
  const mountCurves = (body) => {
    const h = body.querySelector('.ad-host'); if (!h) return;
    curves = diffusion(h, ctx);
    curves.render(S, new Set(['*']));
  };
  function openCurves() {
    const spec = { kicker: '<span class="ki">Adoption</span>', title: `All ${all.length} curves`, sub: `US households, ${span[0]} to ${span[1]}`, html: panelHtml(), onMount: mountCurves };
    if (ctx.openEvidence) { ctx.openEvidence(KEY, spec); return; }
    localPanel(spec);
  }
  // without the shared evidence panel (an older shell) the same content opens in a sheet over the plate
  let sheet = null;
  function localPanel(spec) {
    if (!sheet) {
      sheet = document.createElement('aside'); sheet.className = 'ad-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', spec.title);
      el.appendChild(sheet);
      sheet.addEventListener('click', (ev) => { if (ev.target.closest('.ad-x')) { sheet.hidden = true; el.querySelector('.ad-more').focus(); } });
      sheet.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { sheet.hidden = true; el.querySelector('.ad-more').focus(); } });
    }
    sheet.hidden = false;
    sheet.innerHTML = `<div class="ad-sh-top"><div><span class="sc">Adoption</span><h3>${esc(spec.title)}</h3><span class="ad-sh-sub">${esc(spec.sub)}</span></div><button type="button" class="ad-x" aria-label="Close">&times;</button></div><div class="ad-sh-body">${spec.html}</div>`;
    mountCurves(sheet.querySelector('.ad-sh-body'));
    sheet.querySelector('.ad-x').focus();
  }

  let lastW = 0, lastH = 0;
  // the plate redraws whenever its box changes (fonts, the scrubber, a rotated phone)
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { const w = plate.clientWidth, h = plate.clientHeight; if (!w || (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2)) return; lastW = w; lastH = h; draw(); }).observe(plate);
  return {
    render(state, ch) {
      if (ch.has('*') || !plate.children.length) { lastW = plate.clientWidth; lastH = plate.clientHeight; draw(); }
      // a shared link to the panel (e=adoption:curves) opens it once the tab is up
      if (state.sel === KEY && (ch.has('*') || ch.has('sel')) && !ctx.openEvidence) openCurves();
      if (curves && !ch.has('*')) curves.render(state, ch);
    },
    resize() { if (curves && curves.resize) curves.resize(); },
    hover() {},
    teardown() { if (curves && curves.teardown) curves.teardown(); },
  };
}
