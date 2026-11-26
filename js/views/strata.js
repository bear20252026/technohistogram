// Money and compute, screen 2 of 3: the layered ridge. Six physical layers of the AI system drawn as one isometric
// stack on the blueprint sheet, energy at the base up to products at the top, each band labelled with its physical
// size today (data/compute_limits.json). One amber thread, the money, enters from the Capital sheet above at the
// right margin, drops to the base and climbs the ridge band by band; its stations carry the announced deal value
// that lands in each layer (data/capital_flows.json, abandoned deals excluded). A band opens its evidence in the drawer.
import { ensure, onData } from '../data.js';
import { state as S, set } from '../store.js';
import { renderDrawer } from '../ui.js';

// Blueprint ground and ink at one line weight; the layers take the AI page's organ hue families (Vision 4 color
// direction) and the money thread runs in the heat range by volume. Tokens come from palette.css when it lands
// (--organ-<id>, --heat-1..3); the fallbacks here are the same printed-ink values.
const GROUND = '#0F2A44', LINE = '#DCE6EE', ACCENT = '#E09F24', LW = 0.75;
const lineA = (a) => `rgba(220,230,238,${a})`;
const HUE_FALLBACK = { energy: '#E07B39', chips: '#C9508F', compute: '#D9A441', data: '#4FB3C9', models: '#8E79D6', products: '#E2746A' };
const HEAT_FALLBACK = ['#E09F24', '#E8702A', '#C9508F']; // amber, orange, magenta: small, middling, the largest volume
const hex2 = (h) => { const m = h.replace('#', ''); const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };
const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };
// a family in steps off one base: the band's faces (dark, tinted), its line (the base), its text (light, tinted)
const family = (base) => ({ base, face: mix(GROUND, base, 0.18), side: mix(GROUND, base, 0.1), line: base, text: mix(base, '#F4EFE6', 0.55), hot: mix(base, '#F4EFE6', 0.35) });
const MONO = '"Instrument Sans", sans-serif';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// the six layers, base first; kinds = the deal kinds in capital_flows.json whose money lands in the layer;
// limit = the compute_limits.json item that states the layer's physical size, fig() turns its figure into the label
const LAYERS = [
  { id: 'energy', name: 'Energy', kinds: ['energy'], verb: 'buys power from', limit: 'dc_electricity',
    fig: (f) => [`${fmtN(f['2025'])} TWh of data centre electricity, 2025`, `${fmtN(f['2025'])} TWh, 2025`] },
  { id: 'chips', name: 'Chips', kinds: ['chips'], verb: 'buys chips from', limit: 'cowos_capacity',
    fig: (f) => [`${fmtN(f.end_2026_wpm)} CoWoS wafers a month by end 2026`, `${fmtK(f.end_2026_wpm)} wafers a month`] },
  { id: 'compute', name: 'Compute', kinds: ['compute', 'cloud'], verb: 'commits to', limit: 'largest_campus',
    fig: (f) => [`${fmtN(f.compute_gw_it)} GW, the largest announced AI campus`, `${fmtN(f.compute_gw_it)} GW campus`] },
  { id: 'data', name: 'Data', kinds: [], verb: '', limit: 'text_stock',
    fig: (f) => [`${fmtBig(f.tokens)} tokens of public text, the whole stock`, `${fmtBig(f.tokens).replace(' trillion', 'T')} tokens of text`] },
  { id: 'models', name: 'Models', kinds: ['equity'], verb: 'invests in', limit: 'largest_run',
    fig: (f) => [`${fmtFlop(f.flop)} FLOP, the largest training run`, `${fmtFlop(f.flop)} FLOP, largest run`] },
  { id: 'products', name: 'Products', kinds: ['acquisition', 'licensing'], verb: 'buys', limit: 'token_price',
    fig: (f) => { const k = Object.keys(f).find((x) => /2026/.test(x)); const v = k ? f[k] : null; return v == null ? ['', ''] : [`$${v} per million tokens, GPT-5.2, from $${f['2023-03 GPT-4 (8k)'] || 30} in 2023`, `$${v} per M tokens`]; } },
];
const VERBS = { equity: 'invests in', acquisition: 'buys', compute: 'commits to', cloud: 'contracts', chips: 'buys chips from', energy: 'buys power from', licensing: 'licenses' };

function fmtN(v) { return v == null ? '' : Number(v).toLocaleString('en-US'); }
function fmtK(v) { return v == null ? '' : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v); }
function fmtBig(v) { if (v == null) return ''; const t = v / 1e12; return t >= 1 ? `${fmtN(Math.round(t))} trillion` : fmtN(v); }
function fmtFlop(v) { if (!v) return ''; const e = Math.floor(Math.log10(v)); const m = v / Math.pow(10, e); return `${m.toFixed(1)} \u00d7 10${sup(e)}`; }
function sup(n) { const d = { '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079' }; return String(n).split('').map((c) => d[c] || c).join(''); }
// money in billions of dollars: 1,309.4 reads $1.31T, 639.1 reads $639B, 5.75 reads $5.8B
function fmtB(b) { if (b == null) return ''; if (b >= 1000) return `$${(b / 1000).toFixed(2)}T`; if (b >= 100) return `$${Math.round(b)}B`; if (b >= 10) return `$${b.toFixed(b % 1 ? 1 : 0)}B`; return `$${b.toFixed(b % 1 ? 1 : 0)}B`; }
const dealDate = (f) => (f.month ? `${MON[f.month - 1]} ${f.year}` : String(f.year));

export default function strata(el, { db }) {
  el.classList.add('st-host');
  el.innerHTML = `<div class="st-root st-ridge">
    <h2 class="sx-head"></h2>
    <p class="sx-lead"></p>
    <canvas class="st-cv" tabindex="0" role="img" aria-label="Six layers of the AI system drawn as a ridge, energy at the base up to products, with the announced money as one amber thread climbing through them. Select a layer for its evidence."></canvas>
    <p class="sx-src"></p>
  </div>`;
  const root = el.querySelector('.st-root'), cv = el.querySelector('.st-cv'), ctx = cv.getContext('2d');
  // palette tokens, read at layout so palette.css can land after the module
  let HUES = {}, HEAT = HEAT_FALLBACK;
  function readPalette() {
    const cs = getComputedStyle(root);
    const tok = (n, fb) => { const v = (cs.getPropertyValue(n) || '').trim(); return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fb; };
    HUES = Object.fromEntries(LAYERS.map((L) => [L.id, family(tok(`--organ-${L.id}`, HUE_FALLBACK[L.id]))]));
    HEAT = HEAT_FALLBACK.map((fb, i) => tok(`--heat-${i + 1}`, fb));
  }
  const heatOf = (sum) => { if (!money || !total.sum) return HEAT[0]; const top = Math.max(...LAYERS.map((L) => money[L.id].sum)); const r = sum / top; return r > 0.6 ? HEAT[2] : r > 0.12 ? HEAT[1] : HEAT[0]; };
  const headEl = el.querySelector('.sx-head'), leadEl = el.querySelector('.sx-lead'), srcEl = el.querySelector('.sx-src');

  /* ---------- data ---------- */
  let limits = null; // compute_limits.json items by id
  let money = null;  // per layer: { sum, priced, announced, deals }
  let total = { sum: 0, priced: 0, announced: 0 };
  const optional = (f) => { const man = db.manifest || {}; const listed = (Array.isArray(man.optional) && man.optional.includes(f)) || (man.sizes && man.sizes[f] != null); if (!listed) return Promise.resolve(null); return fetch(`data/${f}${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null); };
  function census() {
    const fl = (db.flowList || []).filter((f) => f.status !== 'abandoned');
    total = { sum: 0, priced: 0, announced: fl.length };
    money = {};
    for (const L of LAYERS) {
      const deals = fl.filter((f) => L.kinds.includes(f.kind)).sort((a, b) => (b.amount_usd_billion || 0) - (a.amount_usd_billion || 0));
      const priced = deals.filter((f) => f.amount_usd_billion != null);
      const sum = priced.reduce((s, f) => s + f.amount_usd_billion, 0);
      money[L.id] = { sum, priced: priced.length, announced: deals.length, deals };
      total.sum += sum; total.priced += priced.length;
    }
  }
  const physical = (L, short) => { const it = limits && limits[L.limit]; if (!it || !it.figure) return ''; try { return L.fig(it.figure)[short ? 1 : 0] || ''; } catch (e) { return ''; } };
  const share = () => (money && total.sum ? money.compute.sum / total.sum : 0);

  /* ---------- copy: the headline says the meaning, the lead names the thread, the foot names the sources ---------- */
  function words() {
    const pct = Math.round(share() * 100);
    headEl.textContent = money && total.sum ? `${pct}% of announced AI money buys compute` : 'Six layers under AI, and the money that climbs them';
    leadEl.textContent = money && total.sum
      ? `Six layers from the grid to the app; the money thread is the ${fmtB(total.sum).replace('$', '$').replace('T', ' trillion')} announced since 2019, stationed where it lands.`
      : 'Six layers from the grid to the app, each labelled with its size today; the money thread is the announced money, stationed where it lands.';
    srcEl.textContent = `Source \u00b7 Histomap capital_flows.json (announced deals, 2019 to 2026) and compute_limits.json: IEA, TrendForce, OpenAI, Epoch AI, OpenAI pricing \u00b7 Oct 2026`;
  }

  /* ---------- geometry ---------- */
  let W = 0, H = 0, dpr = 1, bands = [], thread = [], threadLen = 0, stations = [], titleBox = null, mobile = false;
  function layout() {
    const r = root.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width)); H = Math.max(420, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    readPalette();
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    mobile = W < 700;
    const mL = W * 0.03;
    const headBottom = Math.max(leadEl.getBoundingClientRect().bottom - r.top, headEl.getBoundingClientRect().bottom - r.top);
    const srcH = srcEl.offsetHeight || 16;
    const tbW = Math.min(272, W - 2 * mL), tbH = 4 * 20 + 8;
    const s = mobile ? 0.42 : 0.56;                     // setback: where the next band rests on this band's top face
    const ridgeTop = headBottom + (mobile ? 18 : 14);  // the products band's back edge stays under the copy
    // th = front face height; oy = top face depth on screen; rise = th + s * oy; stack = 5 rise + th + oy
    let th;
    if (mobile) {
      // a phone sheet is as tall as the ridge needs: fixed band height, the source line under the title block
      th = 38;
      const stack = 5 * (th + s * th * 2.4) + th + th * 2.4;
      const need = Math.round(ridgeTop + stack + 14 + tbH + 10 + srcH + 2 * 0.02 * H + 24);
      if (Math.abs(need - H) > 2) { root.style.height = need + 'px'; H = need; cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; }
    }
    const fx = W * 0.02, fy = H * 0.02;
    // the title block (272 by about 92) sits bottom right; the base band ends above it
    titleBox = { x: W - mL - tbW, y: H - fy - (mobile ? 10 + srcH + 8 : 18) - tbH, w: tbW, h: tbH };
    const yBase = titleBox.y - 14;                    // the energy band's front face bottom
    const avail = Math.max(220, yBase - ridgeTop);
    if (!mobile) th = clamp(avail / (5 * (1 + 2.4 * s) + 3.4), 22, 46);
    const oy = th * 2.4, rise = th + s * oy;
    let ox = oy * (mobile ? 1.0 : 1.73);
    const x0 = mL + (mobile ? 6 : W * 0.04);
    const xMax = W - mL - 10;
    let bw0 = Math.min(W * (mobile ? 0.6 : 0.56), xMax - x0 - ox);
    const k = mobile ? bw0 * 0.04 : bw0 * 0.075;      // each band narrower than the one under it: the ridge
    const bw5 = bw0 - 5 * k;
    if (x0 + 5 * s * ox + bw5 + ox > xMax) ox = (xMax - x0 - bw5) / (5 * s + 1); // a steeper view on a narrow sheet
    const sx = s * ox;
    bands = LAYERS.map((L, i) => {
      const x = x0 + i * sx, bw = bw0 - i * k, y = yBase - th - i * rise; // y = front top edge
      const poly = [[x, y + th], [x + bw, y + th], [x + bw + ox, y + th - oy], [x + bw + ox, y - oy], [x + ox, y - oy], [x, y]];
      return { L, i, x, y, bw, th, ox, oy, poly, dy: y - 0.25 * oy, dx0: x + 0.25 * ox, dx1: x + bw + 0.25 * ox };
    });
    // the thread: in at the top edge on the right margin (from Capital's last node), down to the base deck, then up
    // the ridge, each deck crossed the other way, the climbs along the band edges
    const pts = [[W - fx - 10, 0]];
    const b0 = bands[0];
    pts.push([W - fx - 10, b0.dy]);
    pts.push([b0.dx1, b0.dy]);
    stations = [];
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i], fromRight = i % 2 === 0;
      const sxp = b.x + b.bw / 2 + 0.25 * b.ox;
      stations.push({ b, x: sxp, y: b.dy });
      pts.push([fromRight ? b.dx0 : b.dx1, b.dy]);
      const n = bands[i + 1];
      if (!n) break;
      if (fromRight) { // along the depth to the next band's front left foot, up its edge, onto its deck
        pts.push([n.x, n.y + n.th]); pts.push([n.x, n.y]); pts.push([n.dx0, n.dy]);
      } else {
        pts.push([b.x + b.bw + s * b.ox, b.y - s * b.oy]); pts.push([n.x + n.bw, n.y + n.th]); pts.push([n.x + n.bw, n.y]); pts.push([n.dx1, n.dy]);
      }
    }
    thread = pts;
    threadLen = 0; for (let i = 1; i < pts.length; i++) threadLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    // station reach along the thread, for the draw-on
    let acc = 0, si = 0;
    for (let i = 1; i < pts.length && si < stations.length; i++) {
      const a = pts[i - 1], c = pts[i], seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
      while (si < stations.length) {
        const st = stations[si];
        const onSeg = Math.abs(a[1] - c[1]) < 0.01 && Math.abs(st.y - a[1]) < 0.01 && st.x >= Math.min(a[0], c[0]) - 0.5 && st.x <= Math.max(a[0], c[0]) + 0.5;
        if (!onSeg) break;
        st.at = acc + Math.abs(st.x - a[0]); si++;
      }
      acc += seg;
    }
  }

  /* ---------- drawing ---------- */
  let t0 = 0, prog = 1, raf = 0, hoverB = null;
  const selId = () => (S.sel && String(S.sel).startsWith('strata:') ? String(S.sel).slice(7) : null);
  function poly(p) { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
  function frame() {
    ctx.strokeStyle = lineA(0.9); ctx.lineWidth = LW; ctx.strokeRect(W * 0.02 + 0.5, H * 0.02 + 0.5, W * 0.96, H * 0.96);
  }
  function drawBand(b, a, lit) {
    const { x, y, bw, th, ox, oy } = b;
    ctx.globalAlpha = a;
    const top = [[x, y], [x + bw, y], [x + bw + ox, y - oy], [x + ox, y - oy]];
    const front = [[x, y], [x + bw, y], [x + bw, y + th], [x, y + th]];
    const side = [[x + bw, y], [x + bw + ox, y - oy], [x + bw + ox, y - oy + th], [x + bw, y + th]];
    const F = HUES[b.L.id] || family(LINE);
    ctx.fillStyle = GROUND; poly(top); ctx.fill();
    ctx.fillStyle = F.face; poly(front); ctx.fill();
    ctx.fillStyle = F.side; poly(side); ctx.fill();
    ctx.lineWidth = lit ? 1.25 : LW; ctx.strokeStyle = lit ? F.hot : F.line; ctx.lineJoin = 'round';
    poly(top); ctx.stroke(); poly(front); ctx.stroke(); poly(side); ctx.stroke();
    // label on the front face: the layer's name in its hue, then its physical size today
    const name = b.L.name.toUpperCase(), fig = physical(b.L, mobile || bw < 420);
    const two = th >= 30 && (mobile || bw < 560);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = lit ? F.hot : F.text;
    if (two) {
      ctx.font = `500 10px ${MONO}`; ctx.fillText(spaced(name), x + 10, y + th * 0.33);
      ctx.font = `${mobile ? 10.5 : 11}px ${MONO}`; ctx.globalAlpha = a * 0.85; ctx.fillText(fitText(fig, bw - 18), x + 10, y + th * 0.7);
    } else {
      ctx.font = `500 10.5px ${MONO}`; const nm = spaced(name); ctx.fillText(nm, x + 10, y + th / 2);
      const nw = ctx.measureText(nm).width;
      ctx.font = `12px ${MONO}`; ctx.globalAlpha = a * 0.85; ctx.fillText(fitText(fig, bw - 30 - nw), x + 10 + nw + 14, y + th / 2);
    }
    ctx.globalAlpha = 1;
  }
  const spaced = (s) => s.split('').join('\u200a');
  function fitText(s, w) { if (!s) return ''; if (ctx.measureText(s).width <= w) return s; let t = s; while (t.length > 3 && ctx.measureText(t + '\u2026').width > w) t = t.slice(0, -1); return t.replace(/[\s,]+$/, '') + '\u2026'; }
  // the thread's color is the heat of the layer it runs through: the run up to and across a deck takes that layer's volume
  function drawThread(len) {
    if (len <= 0) return;
    ctx.save();
    ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    let acc = 0;
    for (let i = 1; i < thread.length && acc < len; i++) {
      const a = thread[i - 1], c = thread[i], seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const st = stations.find((x) => x.at != null && x.at >= acc - 0.5) || stations[stations.length - 1], m = money && st && money[st.b.L.id];
      ctx.strokeStyle = m && m.priced ? heatOf(m.sum) : HEAT[0];
      const part = clamp((len - acc) / seg, 0, 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (c[0] - a[0]) * part, a[1] + (c[1] - a[1]) * part); ctx.stroke();
      acc += seg;
    }
    ctx.restore();
    // stations: a dot and the money that lands in the layer, read once the thread has reached them
    for (const st of stations) {
      if (st.at == null || st.at > len) continue;
      const m = money && money[st.b.L.id];
      const priced = m && m.priced > 0;
      const heat = priced ? heatOf(m.sum) : HEAT[0];
      ctx.beginPath(); ctx.arc(st.x, st.y, 3.2, 0, Math.PI * 2);
      if (priced) { ctx.fillStyle = heat; ctx.fill(); } else { ctx.fillStyle = GROUND; ctx.fill(); ctx.strokeStyle = heat; ctx.lineWidth = 1.25; ctx.stroke(); }
      ctx.font = `${mobile ? 11 : 12}px ${MONO}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      // the label stays on the deck: the deal count goes first when the deck is short, then the words
      const room = st.b.dx1 - st.x - 12;
      const forms = !m ? [''] : priced ? [`${fmtB(m.sum)} \u00b7 ${m.priced} priced deal${m.priced === 1 ? '' : 's'} of ${m.announced}`, `${fmtB(m.sum)} \u00b7 ${m.priced} of ${m.announced} deals`, fmtB(m.sum)] : ['no priced deal in the ledger', 'no priced deal', 'no deal'];
      const label = forms.find((f) => ctx.measureText(f).width <= room) || forms[forms.length - 1];
      ctx.fillStyle = priced ? heat : lineA(0.8);
      ctx.fillText(label, st.x + 9, st.y - 7);
    }
  }
  function titleBlock() {
    const { x, y, w } = titleBox;
    const rows = [
      ['SHEET', '02 of 03'],
      ['SCALE', 'one band per layer, equal depth'],
      ['COUNT', money ? `${total.priced} priced deals of ${total.announced}` : 'reading the ledger'],
      ['SOURCE', 'capital_flows, compute_limits'],
    ];
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.strokeStyle = lineA(0.9); ctx.lineWidth = LW;
    rows.forEach((r, i) => {
      const ry = y + i * 20;
      ctx.beginPath(); ctx.moveTo(x, ry + 0.5); ctx.lineTo(x + w, ry + 0.5); ctx.stroke();
      ctx.fillStyle = lineA(0.75); ctx.font = `500 10.5px ${MONO}`; ctx.fillText(r[0].split('').join('\u200a'), x + 2, ry + 10.5);
      ctx.fillStyle = LINE; ctx.font = `11px ${MONO}`; ctx.fillText(fitText(r[1], w - 62), x + 56, ry + 10.5);
    });
    ctx.beginPath(); ctx.moveTo(x, y + rows.length * 20 + 0.5); ctx.lineTo(x + w, y + rows.length * 20 + 0.5); ctx.stroke();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = GROUND; ctx.fillRect(0, 0, W, H);
    frame();
    const sel = selId();
    bands.forEach((b, i) => {
      const t = clamp((prog * 2.0 - i * 0.1) / 0.5, 0, 1); // measured tempo: 100ms stagger, each band in by 500ms
      if (t <= 0) return;
      drawBand(b, easeOut(t), hoverB === b || sel === b.L.id);
    });
    const tt = clamp((prog * 2.0 - 0.7) / 1.3, 0, 1); // the thread runs from 700ms to 2000ms, linear
    drawThread(threadLen * tt);
    titleBlock();
  }
  function tick(now) {
    raf = 0;
    if (!t0) t0 = now;
    prog = REDUCED ? 1 : clamp((now - t0) / 2000, 0, 1);
    draw();
    if (prog < 1) raf = requestAnimationFrame(tick);
  }
  function start(first) {
    if (first) { t0 = 0; prog = REDUCED ? 1 : 0; }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  const invalidate = () => { if (!raf) raf = requestAnimationFrame((n) => { raf = 0; draw(); }); };

  /* ---------- hit testing and the evidence ---------- */
  const inPoly = (p, px, py) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const bandAt = (px, py) => { for (let i = bands.length - 1; i >= 0; i--) if (inPoly(bands[i].poly, px, py)) return bands[i]; return null; };
  const local = (ev) => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  cv.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'touch') return; const b = bandAt(...local(ev)); if (b !== hoverB) { hoverB = b; cv.style.cursor = b ? 'pointer' : 'default'; invalidate(); } });
  cv.addEventListener('pointerleave', () => { if (hoverB) { hoverB = null; cv.style.cursor = 'default'; invalidate(); } });
  cv.addEventListener('click', (ev) => { const b = bandAt(...local(ev)); if (b) open(b.L); });
  cv.addEventListener('keydown', (ev) => {
    const cur = selId(); const i = LAYERS.findIndex((L) => L.id === cur);
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') { ev.preventDefault(); open(LAYERS[clamp(i + 1, 0, 5)]); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') { ev.preventDefault(); open(LAYERS[i < 0 ? 0 : clamp(i - 1, 0, 5)]); }
    else if (ev.key === 'Enter' && i < 0) { ev.preventDefault(); open(LAYERS[0]); }
  });
  // every layer is a record the drawer can open, so a deep link to one lands with its evidence
  function registerAll() {
    if (!db.pointById) db.pointById = new Map();
    for (const L of LAYERS) db.pointById.set('strata:' + L.id, { kicker: '<span class="ki">Money and compute</span>', html: evidence(L) });
    if (selId()) renderDrawer();
  }
  function open(L) {
    registerAll();
    set({ sel: 'strata:' + L.id });
  }
  function evidence(L) {
    const it = limits && limits[L.limit];
    const m = money && money[L.id];
    const i = LAYERS.indexOf(L);
    const srcs = it && it.source ? `<p class="sx-ev-src">Source: <a href="${esc(it.source.url)}" target="_blank" rel="noopener">${esc(it.source.title)}</a>${it.date ? `, ${esc(it.date)}` : ''}</p>` : '';
    const rows = m && m.deals.length ? m.deals.map((f) => {
      const amt = f.amount_usd_billion != null ? fmtB(f.amount_usd_billion) : 'value not disclosed';
      const src = f.source_url ? ` <a href="${esc(f.source_url)}" target="_blank" rel="noopener">${esc(f.source_label || 'source')}</a>` : '';
      return `<li><b>${esc(amt)}</b> ${esc(f.source_org)} ${esc(VERBS[f.kind] || L.verb || 'funds')} ${esc(f.target_org)}, ${esc(dealDate(f))}.${src}</li>`;
    }).join('') : '';
    const moneyLine = !m ? '' : m.priced
      ? `<p>${esc(fmtB(m.sum))} of announced money lands here: ${m.priced} priced deal${m.priced === 1 ? '' : 's'} of ${m.announced} announced, ${Math.round((m.sum / total.sum) * 100)}% of the ${esc(fmtB(total.sum))} on the thread.</p>`
      : `<p>No deal in the ledger lands in this layer; the thread passes through it without a priced station.</p>`;
    return `<div class="sx-ev">
      <p class="sx-ev-k">Layer ${i + 1} of 6, ${i === 0 ? 'the base' : i === 5 ? 'the top' : `above ${esc(LAYERS[i - 1].name.toLowerCase())}`}</p>
      <h3 class="sx-ev-h">${esc(L.name)}</h3>
      ${it ? `<p class="sx-ev-fig">${esc(physical(L, false))}</p><p>${esc(it.reading || '')}</p>${srcs}` : `<p>The size of this layer arrives with compute_limits.json.</p>`}
      <h4 class="sx-ev-h4">Money on the thread</h4>
      ${moneyLine}
      ${rows ? `<ol class="sx-ev-deals">${rows}</ol>` : ''}
    </div>`;
  }

  /* ---------- lifecycle ---------- */
  let built = false;
  function render(state, ch) {
    const full = !ch || ch.has('*');
    if (!built) {
      built = true;
      words(); layout(); start(true);
      ensure('flows').then(() => { if (!el.isConnected) return; census(); words(); layout(); invalidate(); registerAll(); });
      optional('compute_limits.json').then((j) => { if (!el.isConnected || !j) return; limits = Object.fromEntries(((j && j.items) || []).map((x) => [x.id, x])); invalidate(); registerAll(); });
      return;
    }
    if (full) { words(); layout(); invalidate(); return; }
    if (ch.has('sel')) invalidate();
  }
  onData((name) => { if (name === 'flows' && el.isConnected) { census(); words(); layout(); invalidate(); } });
  return {
    render,
    resize() { if (built) { layout(); invalidate(); } },
    hover() {},
    lit() {},
  };
}
