// I. MONEY AND COMPUTE, SHEET 01: sourced AI deals as one Blueprint drawing, capital to labs to compute to energy.
// One visual, one line weight, one amber path. The deal list lives in the evidence panel (record drawer).
import { state as S, set, YEAR_MIN, YEAR_MAX } from '../store.js';
import { esc, tip } from '../ui.js';
import { host } from '../data.js';

export const KINDS = [
  { id: 'equity', label: 'Equity investment', color: '#d9a21e' },
  { id: 'acquisition', label: 'Acquisition', color: '#b0457a' },
  { id: 'licensing', label: 'Licensing and hiring', color: '#7a5aa6' },
  { id: 'cloud', label: 'Cloud contract', color: '#5b8fd0' },
  { id: 'compute', label: 'Compute and data centers', color: '#2d5a88' },
  { id: 'chips', label: 'Chip purchase', color: '#3c4180' },
  { id: 'energy', label: 'Power deal', color: '#8a4e2c' },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const STAGES = [
  { label: 'Capital', sub: 'investors, funds, acquirers' },
  { label: 'Labs and buyers', sub: 'model makers and AI buyers' },
  { label: 'Compute', sub: 'clouds, chips, data centers' },
  { label: 'Energy', sub: 'power for data centers' },
];

const LAB = /^(OpenAI|Anthropic|xAI|Mistral AI|Safe Superintelligence|Thinking Machines Lab|Inflection AI|Character\.AI|Scale AI|Cursor|Windsurf|Manus|Hugging Face|OpenRouter|Nuance|G42)/;
const COMPUTE = /^(NVIDIA|Nvidia|AMD|Intel|Broadcom|Groq|Cerebras|Etched|Tenstorrent|Mellanox|Arm|Ampere|ZT Systems|Nokia|CoreWeave|Nebius|Nscale|IREN|Lambda|Fluidstack|Oracle|Microsoft Azure|Amazon Web Services|Google Cloud|Stargate|OpenAI Stargate|Meta Hyperion|AI Infrastructure Partnership|Aligned Data|Google TPU|SpaceX \(|UAE \()/;
const ENERGY = /^(Helion|Brookfield|Constellation|Kairos|X-energy|Talen|Commonwealth Fusion|NextEra|Intersect Power|SB Energy)/;
const BUYER = /^(OpenAI|Anthropic|Meta|Microsoft|Apple|Oracle|Saudi PIF Humain|xAI|SpaceX)$/;
const BIG = { Microsoft: 'Microsoft Azure', Amazon: 'Amazon Web Services', Google: 'Google Cloud', Alphabet: 'Google Cloud', Meta: 'Meta data centers', 'Meta Hyperion data center': 'Meta data centers', 'OpenAI and SoftBank': 'Stargate (OpenAI, SoftBank)', 'OpenAI Stargate Abilene': 'Stargate Abilene', SpaceX: 'SpaceX (Colossus)', 'SpaceX (Colossus 1)': 'SpaceX (Colossus)', Alphabet_eq: 'Alphabet (AI infrastructure)' };

function canon0(n) {
  if (/investors|and others|^Investors/i.test(n) && !/BlackRock|MGX/.test(n)) return 'Venture and public investors';
  if (/^Nvidia and others$/i.test(n) || /^nvidia$/i.test(n)) return 'NVIDIA';
  if (n === 'Alphabet') return 'Google';
  if (n === 'The Walt Disney Company') return 'Disney';
  if (/^SoftBank, OpenAI, Oracle, MGX/.test(n)) return 'Stargate partners';
  if (/^BlackRock, GIP, MGX/.test(n) || /^AI Infrastructure Partnership, MGX/.test(n)) return 'BlackRock, GIP, MGX and partners';
  if (/^MGX, G42/.test(n)) return 'MGX, G42 and partners';
  if (/^G42, OpenAI, Oracle/.test(n)) return 'Stargate UAE partners';
  if (/^Coatue/.test(n)) return 'Coatue and investors';
  if (/^Apollo/.test(n)) return 'Apollo and lenders';
  return n;
}
function place(f) {
  const src = f.source_org, tgt = f.target_org;
  let tc = ENERGY.test(tgt) ? 3 : COMPUTE.test(tgt) ? 2 : 1;
  let tn = tgt;
  if (f.kind === 'equity' && tgt === 'Alphabet') { tc = 2; tn = BIG.Alphabet_eq; }
  else if (tc === 2) tn = BIG[tgt] || (tgt === 'Arm (abandoned)' ? 'Arm (deal abandoned)' : tgt);
  else if (tgt === 'Google') tn = 'Google (Gemini)';
  else if (['chips', 'compute', 'cloud'].includes(f.kind) && tc === 1 && BIG[tgt] && f.kind !== 'compute') { tc = 2; tn = BIG[tgt]; }
  let sc, sn;
  if (f.kind === 'energy') { sc = 2; sn = BIG[src] || src; }
  else if (['cloud', 'compute', 'chips'].includes(f.kind) && BUYER.test(src)) { sc = 1; sn = src; }
  else { sc = 0; sn = canon0(src); }
  if (sc >= tc) sc = tc - 1;
  if (sc === 2 && !BIG[sn] && !COMPUTE.test(sn)) sn = BIG[src] || sn;
  return { sc, sn, tc, tn };
}

// three significant figures throughout: $2.21T, $343B, $29.4B, $1.56B, $850M
const fmtB = (v) => (v == null ? 'undisclosed' : v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : v >= 100 ? `$${Math.round(v)}B` : v >= 10 ? `$${+v.toFixed(1)}B` : v >= 1 ? `$${+v.toFixed(2)}B` : `$${Math.round(v * 1000)}M`);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dealDate = (f) => (f.month ? `${MON[f.month - 1]} ${f.year}` : `${f.year}`);
export { fmtB, KIND, place };

const SHEET = { ground: '#0F2A44', line: '#DCE6EE', amber: '#E09F24' };
const fmtT = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)} trillion` : v >= 100 ? `$${Math.round(v)} billion` : `$${+v.toFixed(1)} billion`);
const monthLabel = (t) => `${MON[t % 12]} ${Math.floor(t / 12)}`;

export default function capital(el, { db, select }) {
  // a capped commitment ("up to $5 billion") is a ceiling, not a price, whatever else the note says: it draws dashed and its
  // figure reads "up to". The cap must match the deal's amount, or the amount less the cap must be a firm figure in the note
  // (Amazon's $5B now plus up to $20B later), so a side clause like "up to $400 million contingent" does not cap a $4.9B purchase.
  const dollars = (txt, re) => [...(txt || '').matchAll(re)].map((m) => +m[1].replace(/,/g, '') * (/^m/i.test(m[2]) ? 0.001 : 1));
  const capped = (f) => {
    const a = f.amount_usd_billion; if (a == null) return false;
    const caps = dollars(f.note, /up to (?:an additional |another )?\$([\d.,]+)\s*(billion|million|bn|b)\b/gi);
    const firm = dollars(f.note, /\$([\d.,]+)\s*(billion|million|bn|b)\b/gi);
    const near = (x, y) => Math.abs(x - y) <= Math.max(0.02 * y, 0.01);
    return caps.some((c) => near(c, a) || firm.some((x) => near(c + x, a)));
  };
  const deals = (db.flowList || []).map((f) => {
    const p = place(f);
    const cap = capped(f);
    return { ...f, ...p, t: f.year * 12 + ((f.month || 6) - 1), capped: cap, tentative: cap || (/\b(reported|preliminary|in talks|talks|proposed|tentative|letter of intent|intends?|plans? to|up to)\b/i.test(f.note || '') && !/\b(announced|closed|signed|completed|agreed)\b/i.test(f.note || '')), abandoned: f.status === 'abandoned' };
  }).sort((a, b) => a.t - b.t);
  const amtOf = (d) => (d.capped ? `up to ${fmtB(d.amount_usd_billion)}` : fmtB(d.amount_usd_billion));
  const suffix = (d) => (d.capped ? 'announced ceiling' : d.tentative ? 'reported' : '');
  const years = deals.length ? d3.extent(deals, (d) => d.year) : [2019, 2026];
  const tMin = deals.length ? d3.min(deals, (d) => d.t) : 0, tMax = deals.length ? d3.max(deals, (d) => d.t) : 0;
  let cut = tMax, playing = null, cur = [], picked = null;
  const live = (d) => d.t <= cut;

  // the one census behind every count on the sheet
  function census(list) {
    const ab = list.filter((d) => d.abandoned), ann = list.filter((d) => !d.abandoned), disc = ann.filter((d) => d.amount_usd_billion != null);
    return { n: list.length, announced: ann.length, abandoned: ab.length, disclosed: disc.length, sum: d3.sum(disc, (d) => d.amount_usd_billion) };
  }
  const srcHosts = new Set(deals.map((d) => host(d.source_url)).filter(Boolean)).size;
  const all = census(deals);
  const inWindow = () => deals.filter((d) => d.year >= (S.y0 ?? YEAR_MIN) && d.year <= (S.y1 ?? YEAR_MAX));

  el.classList.add('cap', 'bp', 'blueprint');
  el.innerHTML = `
    <div class="bp-frame" aria-hidden="true"></div>
    <h2 class="bp-head"><span class="bp-fig" data-k="fig">${esc(fmtT(all.sum))}</span> of AI deals announced since ${years[0]}</h2>
    <p class="bp-note">Announced values include multiyear plans and contracts. Dashed lines are plans and capped commitments.</p>
    <div class="bp-ctl">
      <div class="toggle" role="group" aria-label="Years">${[['All years', YEAR_MIN, YEAR_MAX], ['to 2023', years[0], 2023], ['2024', 2024, 2024], ['2025', 2025, 2025], ['2026', 2026, 2026]].map(([l, a, b]) => `<button type="button" data-y0="${a}" data-y1="${b}">${l}</button>`).join('')}</div>
      <button type="button" class="cap-play" aria-label="Play the deals month by month">Play ${years[0]} to ${years[1]}</button>
    </div>
    <div class="cap-flow" role="group" aria-label="Deal flow, capital to labs to compute to energy"><svg aria-hidden="true"></svg></div>
    <button type="button" class="bp-pick" data-chart hidden aria-label="Open the selected deal"></button>
    <p class="bp-src"><a href="#dl=list" class="bp-list" data-list="capital:deals">Deal list, sources and census</a></p>
    <span class="bp-exit" aria-hidden="true"></span>
    <dl class="bp-title" aria-label="Title block" data-chart>
      <dt>Sheet</dt><dd>01/03</dd>
      <dt>Scale</dt><dd>one line, one deal, equal width</dd>
      <dt>Count</dt><dd data-k="count"></dd>
      <dt>Priced</dt><dd data-k="census"></dd>
      <dt>Source</dt><dd>${srcHosts} publications</dd>
    </dl>`;
  const flowEl = el.querySelector('.cap-flow');
  const svg = d3.select(flowEl).select('svg');
  const sentence = (c) => `${c.n} deals; ${c.announced} announced${c.abandoned ? `, ${c.abandoned} abandoned, listed` : ''}; ${c.disclosed} of the ${c.announced} disclose a value.`;

  // controls
  el.querySelector('.bp-ctl').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.y0) { stop(); set({ y0: +b.dataset.y0, y1: +b.dataset.y1 }); return; }
    if (b.classList.contains('cap-play')) { if (playing) stop(); else play(); }
  });
  function syncCtl() {
    for (const b of el.querySelectorAll('[data-y0]')) b.setAttribute('aria-pressed', String(+b.dataset.y0 === (S.y0 ?? YEAR_MIN) && +b.dataset.y1 === (S.y1 ?? YEAR_MAX)));
  }
  function play() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { cut = tMax; draw(); return; }
    const list = inWindow(); if (!list.length) return;
    const a = d3.min(list, (d) => d.t), b = d3.max(list, (d) => d.t);
    cut = a - 1; el.querySelector('.cap-play').textContent = 'Stop'; el.querySelector('.cap-play').setAttribute('aria-pressed', 'true');
    const step = Math.max(60, Math.min(220, 9000 / Math.max(1, b - a + 1)));
    playing = d3.interval(() => { cut += 1; drawFlow(list, true); paintText(list); if (cut >= b) stop(); }, step);
  }
  function stop() {
    if (playing) playing.stop(); playing = null;
    const was = cut !== tMax; cut = tMax;
    const pb = el.querySelector('.cap-play'); pb.textContent = `Play ${years[0]} to ${years[1]}`; pb.removeAttribute('aria-pressed');
    if (was) draw();
  }

  // text: headline figure and the census sentence, always at their final value for the frame (no rolling from a wrong number)
  function paintText(list) {
    const c = census(list.filter(live));
    el.querySelector('[data-k="fig"]').textContent = c.sum ? fmtT(c.sum) : '$0';
    el.querySelector('.bp-title [data-k="census"]').textContent = `${c.disclosed} of ${c.announced} with a value`;
    const yr = list.length ? `${d3.min(list, (d) => d.year)} to ${d3.max(list, (d) => d.year)}` : '';
    el.querySelector('[data-k="count"]').textContent = cut < tMax ? `${c.n} deals through ${monthLabel(cut)}` : `${c.n} deals, ${yr}`;
  }

  // the drawing: four columns of outlined nodes, one 0.75px line per deal, the amber path along the largest chain
  function drawFlow(list, playingNow) {
    // phones get the whole four-stage drawing at full width, no node labels and no sideways scroll; the picked deal reads beneath
    const phone = flowEl.clientWidth < 560;
    const W = phone ? Math.max(280, flowEl.clientWidth) : Math.max(720, flowEl.clientWidth), H = Math.max(300, flowEl.clientHeight);
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
    const links = list.filter((d) => !d.abandoned).map((d) => ({ d, on: live(d) }));
    const mL = phone ? 14 : Math.min(230, W * 0.18), mR = phone ? 14 : Math.min(230, W * 0.18), NW = phone ? 5 : 6, top = phone ? 44 : 34, bottom = 8;
    const colX = [mL, mL + (W - mL - mR) / 3, mL + 2 * (W - mL - mR) / 3, W - mR];
    const nodes = new Map();
    const nodeOf = (c, n) => { const k = `${c}|${n}`; if (!nodes.has(k)) nodes.set(k, { k, c, n, in: [], out: [], amt: 0, cnt: 0 }); return nodes.get(k); };
    for (const l of links) {
      l.s = nodeOf(l.d.sc, l.d.sn); l.t = nodeOf(l.d.tc, l.d.tn); l.s.out.push(l); l.t.in.push(l);
      if (l.on) { const a = l.d.amount_usd_billion || 0; l.s.cnt += 1; l.t.cnt += 1; l.s.amt += a; l.t.amt += a; }
    }
    const ns = [...nodes.values()];
    const cols = [0, 1, 2, 3].map((c) => ns.filter((n) => n.c === c).sort((a, b) => (b.amt - a.amt) || (b.cnt - a.cnt) || a.n.localeCompare(b.n)));
    const GAP = 6, avail = H - top - bottom;
    const per = Math.max(2, Math.min(6, d3.min(cols.filter((c) => c.length), (col) => (avail - GAP * (col.length - 1)) / d3.sum(col, (n) => Math.max(1, n.in.length + n.out.length) || 1)) || 4));
    for (const col of cols) {
      for (const n of col) n.h = Math.max(per, per * Math.max(n.in.length, n.out.length));
      const tot = d3.sum(col, (n) => n.h) + GAP * (col.length - 1);
      let y = top + Math.max(0, (avail - tot) / 2);
      for (const n of col) { n.y = y; n.x = colX[n.c] - NW / 2; y += n.h + GAP; }
    }
    // link slots, in deal order, so lines do not cross inside a node
    for (const n of ns) { let y = n.y; for (const l of n.out.sort((a, b) => a.t.y - b.t.y)) { l.y0 = y + per / 2; y += per; } y = n.y; for (const l of n.in.sort((a, b) => a.s.y - b.s.y)) { l.y1 = y + per / 2; y += per; } }
    const path = (l) => { const x0 = l.s.x + NW, x1 = l.t.x, cx = (x0 + x1) / 2; return `M${x0},${l.y0}C${cx},${l.y0} ${cx},${l.y1} ${x1},${l.y1}`; };

    // the amber chain: largest capital source, its largest lab, that lab's largest compute, and the largest line into energy
    const chain = [];
    const big = (arr) => arr.filter((l) => l.on).sort((a, b) => (b.d.amount_usd_billion || 0) - (a.d.amount_usd_billion || 0))[0];
    const sorted = (arr) => arr.filter((l) => l.on).sort((a, b) => (b.d.amount_usd_billion || 0) - (a.d.amount_usd_billion || 0));
    const hasOut = (n, c) => n.out.some((l) => l.on && l.t.c === c);
    // capital to lab: the largest line into the lab column whose lab goes on to compute
    const l1 = sorted(links.filter((l) => l.s.c === 0 && l.t.c === 1)).find((l) => hasOut(l.t, 2)) || big(links.filter((l) => l.s.c === 0 && l.t.c === 1)); if (l1) chain.push(l1);
    // lab to compute: that lab's largest line, preferring a compute node that goes on to energy
    const c2 = l1 ? sorted(l1.t.out.filter((l) => l.t.c === 2)) : sorted(links.filter((l) => l.s.c === 1 && l.t.c === 2));
    const l2 = c2.find((l) => hasOut(l.t, 3)) || c2[0]; if (l2) chain.push(l2);
    // compute to energy: that node's largest line, else the largest line into energy anywhere (drawn as the same thread)
    const l3 = (l2 && big(l2.t.out.filter((l) => l.t.c === 3))) || big(links.filter((l) => l.t.c === 3)); if (l3) chain.push(l3);
    const amber = new Set(chain);

    svg.selectAll('*').remove();
    const g = svg.append('g');
    // column heads: chart labels, mono
    const colAmt = (i) => d3.sum(cols[i], (n) => (i === 0 ? d3.sum(n.out.filter((l) => l.on), (l) => l.d.amount_usd_billion || 0) : d3.sum(n.in.filter((l) => l.on), (l) => l.d.amount_usd_billion || 0)));
    const anchor = (i) => (phone ? (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') : i === 0 ? 'end' : i === 3 ? 'start' : 'middle');
    const headX = (i) => (phone ? (i === 0 ? colX[0] - NW / 2 : i === 3 ? colX[3] + NW / 2 : colX[i]) : colX[i]);
    const short = ['Capital', 'Labs', 'Compute', 'Energy'];
    const heads = g.selectAll('text.ch').data(STAGES).join('text').attr('class', (s, i) => `ch c-${i}`).attr('x', (s, i) => headX(i)).attr('y', 14).attr('text-anchor', (s, i) => anchor(i));
    if (phone) { heads.text((s, i) => short[i].toUpperCase()); heads.each(function (s, i) { const amt = colAmt(i); if (amt) g.append('text').attr('class', `ch c-${i}`).attr('x', headX(i)).attr('y', 28).attr('text-anchor', anchor(i)).text(fmtB(amt)); }); }
    else heads.text((s, i) => { const amt = colAmt(i); return `${s.label.toUpperCase()}${amt ? ' ' + fmtB(amt) : ''}`; });
    g.selectAll('line.cl').data(colX).join('line').attr('class', 'cl').attr('x1', (x) => x).attr('x2', (x) => x).attr('y1', top - 12).attr('y2', H - bottom);
    const gl = g.append('g').attr('class', 'links');
    cur = links;
    // color carries one encoding: lines take the capital gold family's steps by deal kind; the thread runs the heat
    // range by volume (amber under $50B, orange under $200B, magenta above); nodes and labels take their organ hue per column
    const heat = (l) => { const a = l.d.amount_usd_billion || 0; return a >= 200 ? 3 : a >= 50 ? 2 : 1; };
    gl.selectAll('path').data(links).join('path').attr('class', (l) => `lk k-${l.d.kind}${l.d.tentative ? ' tn' : ''}${l.d.amount_usd_billion == null ? ' und' : ''}${amber.has(l) ? ` amber heat-${heat(l)}` : ''}`).attr('d', path)
      .attr('opacity', (l) => (l.on ? null : 0)).attr('tabindex', (l) => (l.on ? 0 : -1)).attr('role', 'button').attr('aria-label', (l) => `${l.d.source_org} to ${l.d.target_org}, ${amtOf(l.d)}, ${dealDate(l.d)}`)
      .each(function (l) { d3.select(this).append('title').text(`${l.d.source_org} to ${l.d.target_org}: ${amtOf(l.d)}, ${KIND[l.d.kind]?.label || l.d.kind}, ${dealDate(l.d)}${suffix(l.d) ? ', ' + suffix(l.d) : ''}`); });
    const gn = g.append('g').attr('class', 'nodes');
    const nd = gn.selectAll('g.nd').data(ns, (n) => n.k).join('g').attr('class', (n) => `nd c-${n.c}${chain.some((l) => l.s === n || l.t === n) ? ' amber' : ''}`).attr('tabindex', -1).attr('transform', (n) => `translate(${n.x},${n.y})`);
    nd.append('rect').attr('width', NW).attr('height', (n) => n.h);
    nd.append('title').text((n) => `${n.n}: ${n.cnt} deal${n.cnt === 1 ? '' : 's'}${n.amt ? ', ' + fmtB(n.amt) : ''}`);
    // labels: the top five names per column by amount, and every node on the amber path
    const labeled = new Set(phone ? [] : cols.flatMap((col) => col.filter((n) => n.cnt).slice(0, 5)));
    if (!phone) for (const l of chain) { labeled.add(l.s); labeled.add(l.t); }
    // labels sit beside their node; in a column they keep 13px apart (sliding down), and a label that moved gets a
    // 0.75px leader back to its node, the drafting convention. Names shorten to the first words before the figure.
    const ctx = (drawFlow.c ||= document.createElement('canvas').getContext('2d')); ctx.font = '11px "JetBrains Mono", "Instrument Sans", Menlo, monospace';
    const colW = (W - mL - mR) / 3 - NW - 14;
    const fitName = (n, lim) => { const tag = n.amt ? ' ' + fmtB(n.amt) : ''; const w = (t) => ctx.measureText(t + tag).width; if (w(n.n) <= lim) return n.n + tag; const words = n.n.replace(/[(),]/g, ' ').trim().split(/\s+/); const two = words.slice(0, 2).join(' '); if (words.length > 2 && !/^(and|of|for|the)$/i.test(words[1]) && w(two) <= lim) return two + tag; if (w(words[0]) <= lim) return words[0] + tag; let t = n.n; while (t.length > 3 && w(t + '\u2026') > lim) t = t.slice(0, -1); return t.trimEnd() + '\u2026' + tag; };
    const LH = 13;
    const labs = [...labeled].map((n) => ({ n, y: n.y + n.h / 2, lim: n.c === 0 ? mL - 14 : n.c === 3 ? mR - NW - 14 : colW }));
    for (const c of [0, 1, 2, 3]) {
      const col = labs.filter((l) => l.n.c === c).sort((a, b) => a.y - b.y);
      let last = -Infinity; for (const l of col) { l.ly = Math.max(l.y, last + LH); last = l.ly; }
      const over = col.length ? col[col.length - 1].ly - (H - bottom - 4) : 0;
      if (over > 0) { let nxt = Infinity; for (const l of col.slice().reverse()) { l.ly = Math.min(l.ly - over, nxt - LH); nxt = l.ly; } }
    }
    const gLead = g.append('g').attr('class', 'leaders');
    for (const l of labs) {
      const n = l.n, right = n.c !== 0, x = right ? n.x + NW : n.x, lx = right ? x + 8 : x - 8;
      const moved = Math.abs(l.ly - l.y) > 3;
      if (moved) gLead.append('path').attr('class', 'ld').attr('d', `M${x},${l.y}H${right ? x + 4 : x - 4}L${lx},${l.ly}`);
      gn.append('text').datum(n).attr('class', `nm c-${n.c}${chain.some((k) => k.s === n || k.t === n) ? ' amber' : ''}`).attr('x', moved ? lx + (right ? 2 : -2) : lx - (right ? 2 : -2)).attr('y', l.ly + 4).attr('text-anchor', right ? 'start' : 'end').text(fitName(n, l.lim - (moved ? 4 : 0)));
    }

    // interaction: a wide transparent twin under the pointer makes each 0.75px line reachable by finger; hover or focus
    // reads the deal, click opens its record (on phones the first tap picks it and the caption beneath opens it)
    const gh = g.append('g').attr('class', 'hits');
    gh.selectAll('path').data(links.filter((l) => l.on)).join('path').attr('class', 'hit').attr('d', path)
      .on('pointerenter', (ev, l) => { if (!phone) { tip.show(ev, tipHtml(l)); hi(l); } }).on('pointermove', (ev) => { if (!phone) tip.move(ev); }).on('pointerleave', () => { if (!phone) { tip.hide(); hi(null); } })
      .on('click', (ev, l) => { if (phone) pick(l); else select(l.d.id); });
    const tipHtml = (l) => `<div class="h">${esc(l.d.source_org)} &rarr; ${esc(l.d.target_org)}</div><div class="m">${esc(amtOf(l.d))} &middot; ${esc(KIND[l.d.kind]?.label || l.d.kind)} &middot; ${esc(dealDate(l.d))}${suffix(l.d) ? ' &middot; ' + suffix(l.d) : ''}</div>`;
    function pick(l) {
      picked = l ? l.d.id : null;
      gl.selectAll('path.lk').classed('sel', (x) => x === l);
      const pb = el.querySelector('.bp-pick');
      if (!l) { pb.hidden = true; return; }
      pb.hidden = false;
      pb.innerHTML = `<span class="pk-who">${esc(l.d.source_org)} <span aria-hidden="true">&rarr;</span><span class="sr-only">to</span> ${esc(l.d.target_org)}</span><span class="pk-amt">${esc(amtOf(l.d))}${suffix(l.d) ? ', ' + suffix(l.d) : ''}</span><span class="pk-m">${esc(KIND[l.d.kind]?.label || l.d.kind)}, ${esc(dealDate(l.d))}. Open the record</span>`;
      pb.onclick = () => select(l.d.id);
    }
    // on phones the thread's largest deal is picked on arrival, so the caption never reads empty
    if (phone) { const keep = picked && links.find((l) => l.d.id === picked && l.on); pick(keep || chain.slice().sort((a, b) => (b.d.amount_usd_billion || 0) - (a.d.amount_usd_billion || 0))[0] || null); }
    else { el.querySelector('.bp-pick').hidden = true; }
    gl.selectAll('path.lk').on('pointerenter', (ev, l) => { tip.show(ev, tipHtml(l)); hi(l); })
      .on('pointermove', (ev) => tip.move(ev)).on('pointerleave', () => { tip.hide(); hi(null); })
      .on('focus', (ev, l) => hi(l)).on('blur', () => hi(null))
      .on('click', (ev, l) => select(l.d.id)).on('keydown', (ev, l) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(l.d.id); } });
    function hi(l) { gl.selectAll('path.lk').classed('hi', (x) => x === l).classed('dim', (x) => l && x !== l && !amber.has(x)); }

    // motion: the amber path draws on, capital to lab to compute to energy, 600ms a segment, ease-out quad; static under reduced motion or while playing
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gl.selectAll('path.amber').each(function (l, i) {
      const p = d3.select(this); const len = this.getTotalLength();
      if (reduce || playingNow) return;
      p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('draw').delay(300 + i * 620).duration(600).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0).on('end', () => p.attr('stroke-dasharray', null));
    });
    if (!reduce && !playingNow) nd.filter('.amber').attr('opacity', 0.35).transition('nd').delay((n, i) => 300 + i * 310).duration(300).attr('opacity', 1);
    // the handoff: the thread leaves the last energy node, drops to the sheet's foot and runs to the right margin, where sheet 02 picks it up
    const last = chain[chain.length - 1];
    if (last && last.t.c === 3 && !phone) {
      const ex = last.t.x + NW, ey = last.t.y + last.t.h / 2;
      const lead = g.append('path').attr('class', 'lead').attr('d', `M${ex},${ey}H${ex + 14}V${H - 2}H${W}`);
      el.classList.toggle('has-exit', true);
      if (!reduce && !playingNow) { const len = lead.node().getTotalLength(); lead.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('draw').delay(300 + chain.length * 620).duration(500).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0); }
    } else el.classList.toggle('has-exit', false);
  }

  // the deal list, for the evidence panel: every deal by stage, newest first, with its status and source
  function registerList() {
    if (!db.pointById) db.pointById = new Map();
    const groups = [[0, 1, 'Capital into labs and buyers'], [1, 2, 'Labs and buyers into compute'], [0, 2, 'Capital into compute'], [2, 3, 'Compute into energy'], [1, 3, 'Labs into energy']];
    const rows = (a, b) => deals.filter((d) => d.sc === a && d.tc === b).sort((x, y) => (y.t - x.t));
    const html = `<p class="dl-census">${esc(fmtT(all.sum))} of announced AI deals, ${years[0]} to ${years[1]}: ${esc(sentence(all))} Dollars nominal, as announced; ${srcHosts} publications and filings, each row linked.</p>` + groups.map(([a, b, title]) => {
      const rs = rows(a, b); if (!rs.length) return '';
      const c = census(rs);
      return `<section class="dl-g"><h3><span>${esc(title)}</span><span class="n">${rs.length} deals &middot; ${fmtB(c.sum)} announced${c.abandoned ? `, ${c.abandoned} abandoned not counted` : ''}</span></h3><ol>${rs.map((d) => `
        <li${d.abandoned ? ' class="abandoned"' : ''}><a class="dl-row" data-id="${esc(d.id)}" href="#dl=${esc(d.id.replace(/^deal:/, ''))}"><span class="dt">${esc(dealDate(d))}</span><span class="pr"><span class="who">${esc(d.source_org)} <span aria-hidden="true">&rarr;</span><span class="sr-only">to</span> ${esc(d.target_org)}</span><span class="kd">${esc(KIND[d.kind]?.label || d.kind)}</span></span><span class="am">${esc(amtOf(d))}${d.abandoned ? '<span class="tn">abandoned</span>' : suffix(d) ? `<span class="tn">${suffix(d)}</span>` : ''}</span></a><a class="src" href="${esc(d.source_url)}" target="_blank" rel="noopener">${esc(d.source_label)}</a></li>`).join('')}</ol></section>`;
    }).join('');
    db.pointById.set('capital:deals', { kicker: '<span class="ki">Deal list</span>', html: `<div class="deal-list">${html}</div>` });
  }
  registerList();
  el.querySelector('.bp-list').addEventListener('click', (ev) => { ev.preventDefault(); select('capital:deals'); });
  // a row in the panel opens its deal record in place (the href is the fallback for a new tab)
  const dr = document.querySelector('#drawer');
  if (dr && !dr.__capRows) { dr.__capRows = true; dr.addEventListener('click', (ev) => { const a = ev.target.closest('.deal-list .dl-row'); if (!a) return; ev.preventDefault(); select(a.dataset.id); }); }

  function draw() { const list = inWindow(); syncCtl(); drawFlow(list); paintText(list); }
  function render(state, ch) { if (ch.has('*') || ch.has('y0') || ch.has('y1')) draw(); }
  return { render, resize() { draw(); }, hover(id) { const l = id && cur.find((x) => x.d.id === id); svg.selectAll('path.lk').classed('hi', (x) => x === l); }, destroy() { stop(); } };
}
