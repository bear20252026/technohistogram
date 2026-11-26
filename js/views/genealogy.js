// H. MODELS: a frontier timeline. One row per lab, one mark per model, the frontier line joins models that set a
// new record on any benchmark in benchmarks.json (computed here from the data). Toggle to show every lab and model.
import { placeLabels } from '../labels.js';
import { state as S } from '../store.js';
import { esc } from '../ui.js';
import { modelEvents } from '../data.js';

// the price overlay: Epoch's cheapest model at a fixed capability level, dollars per million tokens
const PRICE_GROUP = 'MMLU | at least GPT-4-0314 level';
const fmtPrice = (v) => (v >= 10 ? `$${Math.round(v)}` : v >= 1 ? `$${+v.toFixed(1)}` : `$${+v.toFixed(2)}`);

export const LANES = [
  { id: 'openai', label: 'OpenAI', sub: 'OpenAI', color: '#6f8f4a', re: /^OpenAI$/ },
  { id: 'anthropic', label: 'Anthropic', sub: 'Anthropic', color: '#e3a031', re: /^Anthropic$/ },
  { id: 'google', label: 'Google', sub: 'Google, Brain, DeepMind', color: '#d8603c', re: /Google|DeepMind/ },
  { id: 'xai', label: 'xAI', sub: 'xAI', color: '#8a4e2c', re: /^xAI$/ },
  { id: 'meta', label: 'Meta', sub: 'Meta, Meta AI', color: '#b8282e', re: /^Meta/ },
  { id: 'msnv', label: 'Microsoft, NVIDIA', sub: 'Microsoft, NVIDIA', color: '#8f6aa0', re: /Microsoft|NVIDIA/ },
  { id: 'mistral', label: 'Mistral', sub: 'Mistral AI', color: '#3c4180', re: /Mistral/ },
  { id: 'west', label: 'Other labs', sub: 'BigScience, Stability, TII, Databricks, BFL, Thinking Machines', color: '#a59a83', re: /BigScience|Stability|TII|Databricks|Black Forest|Thinking Machines/ },
  { id: 'deepseek', label: 'DeepSeek', sub: 'DeepSeek', color: '#2d5a88', re: /DeepSeek/ },
  { id: 'alibaba', label: 'Alibaba', sub: 'Alibaba, Qwen team', color: '#79a3c6', re: /Alibaba/ },
  { id: 'china', label: 'Other China labs', sub: 'Moonshot, Zhipu, MiniMax, ByteDance', color: '#3f8f78', re: /Moonshot|Zhipu|MiniMax|ByteDance/ },
];
const laneOf = (m) => (LANES.find((l) => l.re.test(m.org)) || LANES[7]).id;

// Families: lineage lines connect members in date order. A model may belong to more than one family.
const FAMILIES = [
  ['GPT', /^GPT-\d/], ['o-series', /^(OpenAI )?o\d/], ['DALL-E', /^DALL-E/], ['Sora', /^Sora/], ['Claude', /^Claude/],
  ['Gemini', /^Gemini/], ['Gemma', /^Gemma/], ['Veo', /^Veo/], ['PaLM', /^PaLM/], ['Llama', /^Llama|^LLaMA/i], ['Muse', /^Muse Spark/],
  ['Mistral', /^Mistral|^Mixtral|^Magistral/], ['DeepSeek', /^DeepSeek/], ['Qwen', /^Qwen/], ['Kimi', /^Kimi/], ['Grok', /^Grok/],
  ['GLM', /^GLM/], ['Megatron', /Megatron|Nemotron/], ['Turing NLG', /Turing[- ]NLG/], ['Phi', /^Phi-/],
];

export const MODALITY = [
  { id: 'text', label: 'Text', word: 'Text', test: (s) => s === 'text' },
  { id: 'reason', label: 'Reasoning', word: 'Reasoning', test: (s) => /reasoning/.test(s) },
  { id: 'vision', label: 'Text and image in', word: 'Vision', test: (s) => s === 'text+image' },
  { id: 'multi', label: 'Multimodal', word: 'Multimodal', test: (s) => /multimodal|voice/.test(s) },
  { id: 'image', label: 'Image generation', word: 'Image', test: (s) => /text-to-image|^image$/.test(s) },
  { id: 'video', label: 'Video', word: 'Video', test: (s) => /video/.test(s) && !/world/.test(s) },
  { id: 'audio', label: 'Audio', word: 'Audio', test: (s) => s === 'audio' },
  { id: 'world', label: 'World model', word: 'World', test: (s) => /world/.test(s) },
];
export const MOD = Object.fromEntries(MODALITY.map((x) => [x.id, x]));
export const modalityOf = (m) => (MODALITY.find((x) => x.test(String(m.modality || '').toLowerCase())) || MODALITY[0]).id;

// 10 x 10 glyphs, stroked in currentColor
export function glyph(id) {
  switch (id) {
    case 'text': return '<path d="M1 2.5h8M1 5h8M1 7.5h5"/>';
    case 'reason': return '<path d="M5 9V5M5 5 2 1.5M5 5l3-3.5"/><circle cx="5" cy="5" r="1" fill="currentColor"/>';
    case 'vision': return '<path d="M.6 5C2 2.4 3.4 1.6 5 1.6S8 2.4 9.4 5C8 7.6 6.6 8.4 5 8.4S2 7.6.6 5Z"/><circle cx="5" cy="5" r="1.4" fill="currentColor"/>';
    case 'multi': return '<circle cx="2.8" cy="2.8" r="1.5"/><circle cx="7.2" cy="2.8" r="1.5"/><circle cx="2.8" cy="7.2" r="1.5"/><circle cx="7.2" cy="7.2" r="1.5" fill="currentColor"/>';
    case 'image': return '<rect x="1" y="1.5" width="8" height="7"/><path d="M1.5 8 4 5l2 2 1.2-1.2L9 8"/>';
    case 'video': return '<rect x="1" y="2" width="8" height="6"/><path d="M4 3.6v2.8L6.4 5Z" fill="currentColor"/>';
    case 'audio': return '<path d="M1.5 4v2M3.5 2.5v5M5.5 1v8M7.5 3v4"/>';
    case 'world': return '<path d="M5 1 9 3v4L5 9 1 7V3Z M1 3l4 2 4-2M5 5v4"/>';
    default: return '';
  }
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtParams = (p) => (p == null ? 'params undisclosed' : p >= 1000 ? `${+(p / 1000).toFixed(2)}T params` : p >= 1 ? `${+p.toFixed(1)}B params` : `${Math.round(p * 1000)}M params`);
export const fmtModelDate = (m) => (m.month ? `${MON[m.month - 1]} ${m.year}` : `${m.year}`);
export const rOf = (p) => (p == null ? 6.5 : 3 + 2.25 * Math.log10(Math.max(0.1, p) / 0.1));
const OPEN = '#3f8f78', CLOSED = '#121212', GATED = '#a0661a', FRONT = '#b8282e';
// the frontier step line is ink, dashed, so red stays the selection and the record rings
const STEP = 'var(--ink)', STEP_DASH = '4 3';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// motion budget (DESIGN_BRIEF: enter by data 600 to 900ms, morphs 350 to 500ms, hover 180ms)
const T = { lane: 40, spread: 400, mark: 220, line: 900, morph: 450, hover: 180, fam: 450, price: 600 };
export const wOf = (m) => m.weights || (m.open_weights ? 'open' : 'closed');
export const wColor = (m) => ({ open: OPEN, gated: GATED, closed: CLOSED })[wOf(m)];
export const wLabel = (m) => ({ open: 'open weights', gated: 'gated weights', closed: 'closed weights' })[wOf(m)];

/* ---------- frontier: which models set a benchmark record (computed from benchmarks.json) ---------- */
const ALLOW = new Set('pro preview exp max high medium xhigh shot few zero cot with self consistency maj1 instruct launch evaluation ensemble'.split(' '));
const ALIAS = [[/^gemini ultra\b/i, 'Gemini 1.0 Ultra'], [/^GPT \(Generative Pre-Training\)/i, 'GPT-1'], [/^o1-preview \/ o1-mini/i, 'OpenAI o1'], [/^GPT-4o \(2024-05-13\), OpenAI launch/i, 'GPT-4o']];
const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/^openai\s+/, '').replace(/^deepseek\//, '').replace(/[-_](\d{8}|\d{4}-\d{2}-\d{2}|\d{4}|\d{2}-\d{2})\b/g, '').split(/[^a-z0-9]+/).filter(Boolean);
const normFull = (s) => s.toLowerCase().replace(/^openai\s+/, '').split(/[^a-z0-9]+/).filter(Boolean);
const okTok = (t) => ALLOW.has(t) || /^\d+$/.test(t) || /^\d+[bk]$/.test(t);
const monthsOf = (y, m) => y * 12 + (m || 6);
export function computeFrontier(models, benchmarks) {
  const keys = models.map((m) => ({ m, short: norm(m.name), full: normFull(m.name), mon: monthsOf(m.year, m.month) }));
  const byModel = new Map();
  for (const b of benchmarks || []) {
    for (const p of b.points || []) {
      const [py, pm] = String(p.date || '').split('-').map(Number);
      if (!py || py < 2017) continue;
      const pmon = monthsOf(py, pm);
      let best = null;
      const al = ALIAS.find(([re]) => re.test(p.model));
      if (al) best = keys.find((k) => k.m.name === al[1]) || null;
      if (!best) {
        const bt = norm(p.model);
        for (const k of keys) {
          for (const key of [k.short, k.full]) {
            if (!key.length || key.length > bt.length) continue;
            if (key.some((t, i) => bt[i] !== t)) continue;
            const rem = bt.slice(key.length);
            if (!rem.every((t) => okTok(t) || k.full.includes(t))) continue;
            const dm = pmon - k.mon;
            if (dm < -1 || dm > 18) continue;
            if (!best || key.length > best.len) best = { ...k, len: key.length };
          }
        }
      }
      if (!best) continue;
      const id = best.m.id;
      if (!byModel.has(id)) byModel.set(id, new Map());
      const rec = byModel.get(id);
      if (!rec.has(b.key)) rec.set(b.key, { name: b.name, date: p.date, value: p.value, metric: b.metric });
    }
  }
  return byModel; // model id -> Map(benchKey -> record)
}

export default function genealogy(el, { db, select, tip }) {
  const models = db.modelList || [];
  models.forEach((m) => { m.lane = laneOf(m); m.mod = modalityOf(m); m.fams = FAMILIES.filter(([, re]) => re.test(m.name)).map(([f]) => f); });
  const frontier = computeFrontier(models, db.benchmarks);
  models.forEach((m) => { m.recsAll = frontier.get(m.id) || null; m.recs = m.recsAll; });
  // names for the benchmarks that produced records, for the frontier picker
  const benchName = new Map(); models.forEach((m) => m.recsAll && m.recsAll.forEach((r, k) => benchName.set(k, r.name.replace(/\s*\(.*?\)/g, ''))));
  let frontBench = '', priceOn = false;
  const wOff = new Set(), modOff = new Set();
  const applyFrontier = () => models.forEach((m) => { m.recs = !frontBench ? m.recsAll : m.recsAll && m.recsAll.has(frontBench) ? new Map([[frontBench, m.recsAll.get(frontBench)]]) : null; });
  const pass = (m) => !wOff.has(wOf(m)) && !modOff.has(m.mod);
  const priceSeries = (() => { const s = (db.series || []).find((x) => x.id === 'llm_inference_price'); const g = s && s.groups && s.groups[PRICE_GROUP]; return g ? { pts: g.filter((p) => p.value != null).map((p) => ({ t: p.year, v: p.value, label: p.label })).sort((a, b) => a.t - b.t), src: s.sources?.[0] } : null; })();
  const nOpen = models.filter((m) => wOf(m) === 'open').length, nGated = models.filter((m) => wOf(m) === 'gated').length, nFront = models.filter((m) => m.recs).length;
  const laneCount = new Map(LANES.map((l) => [l.id, models.filter((m) => m.lane === l.id).length]));
  const TOP = [...LANES].sort((a, b) => laneCount.get(b.id) - laneCount.get(a.id)).slice(0, 8).map((l) => l.id);
  let showAll = S.mode === 'all';
  const frontierBenches = new Set(); models.forEach((m) => m.recs && [...m.recs.keys()].forEach((k) => frontierBenches.add(k)));
  const benchTotal = (db.benchmarks || []).length;  // the same records the Benchmarks section counts

  el.innerHTML = `
    <div class="ft">
      <div class="ft-top">
        <div class="view-head gen-headline"><span class="sc">Model frontier</span><h2>Models, 2017 to 2026</h2>
        <p>One row per lab, one mark per model. The dashed step line above the lanes counts benchmark records as they were set: ${nFront} models took a record on at least one of ${benchTotal === frontierBenches.size ? `the ${benchTotal} benchmarks` : `${frontierBenches.size} of the ${benchTotal} benchmarks; the other ${benchTotal - frontierBenches.size} have no model in this atlas attached`}.</p></div>
        <div class="ft-ctl" aria-label="Legend and controls">
          <div class="ft-grp" role="group" aria-label="Weights"><span class="sc">Weights</span><button type="button" class="lg-i" data-w="open" aria-pressed="true"><i style="background:${OPEN}"></i>open (${nOpen})</button>${nGated ? `<button type="button" class="lg-i" data-w="gated" aria-pressed="true" title="Weights released on request under a research license"><i style="background:${GATED}"></i>gated (${nGated})</button>` : ''}<button type="button" class="lg-i" data-w="closed" aria-pressed="true"><i style="background:${CLOSED}"></i>closed (${models.length - nOpen - nGated})</button></div>
          <div class="ft-grp" role="group" aria-label="Modality"><span class="sc">Modality</span>${MODALITY.filter((x) => models.some((m) => m.mod === x.id)).map((x) => `<button type="button" class="ft-mod" data-mod="${x.id}" aria-pressed="true" title="${esc(x.label)}: ${models.filter((m) => m.mod === x.id).length} models" aria-label="${esc(x.label)}"><svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">${glyph(x.id)}</svg><span>${esc(x.word)}</span></button>`).join('')}</div>
          <label class="ft-grp ft-front"><span class="sc">Frontier by</span><select data-front><option value="">any of ${frontierBenches.size}${benchTotal !== frontierBenches.size ? ` of ${benchTotal}` : ''} benchmarks</option>${[...benchName.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></label>
          ${priceSeries ? `<button type="button" class="ft-price" data-price aria-pressed="false">Price line</button>` : ''}
          <span class="lg-i"><i class="dash"></i>params undisclosed</span>
          <div class="toggle" role="group" aria-label="Rows"><button type="button" data-all="0" aria-pressed="${!showAll}">Top 8 labs</button><button type="button" data-all="1" aria-pressed="${showAll}">All ${models.length} models</button></div>
        </div>
      </div>
      <div class="ft-body"><svg role="group" aria-label="Timeline of AI model releases by lab, 2017 to 2026"></svg><div class="ft-note"><span class="ft-count"></span><span class="ft-contract"><b>Reading the chart</b> one mark per model at release, one row per lab; fill: weights, green open to black closed; red ring: a record. Hover a mark.</span><span class="ft-src"><b>Sources</b> each model's launch post or model card (open a mark); records from the tracked benchmarks; price line from Epoch AI. Busy years get more room on the axis; amber fill is gated weights; hovering sizes a mark by its parameters.</span></div></div>
    </div>`;
  const body = el.querySelector('.ft-body');
  const note = el.querySelector('.ft-note .ft-count');
  const noteBox = el.querySelector('.ft-note');
  const svg = d3.select(body).select('svg');
  const gGrid = svg.append('g');
  const gRows = svg.append('g');
  const gLine = svg.append('g');
  let strip = 0;
  const gFam = svg.append('g').attr('class', 'ft-fam').style('pointer-events', 'none');
  const gMarks = svg.append('g').attr('class', 'ft-marks');
  const gLabels = svg.append('g').attr('class', 'ft-labels').style('pointer-events', 'none');
  gLine.attr('class', 'ft-line');
  const gHover = svg.append('g').attr('class', 'ft-hover').style('pointer-events', 'none');
  // enter by data: the chart stays blank until 40 percent of it is in view, then marks arrive lane by lane in date order
  let entered = RM, pending = false, prevRowY = null, prevPos = null, prevPrice = false;
  const io = 'IntersectionObserver' in window && !RM ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); if (pending) enter(); else entered = true; } }, { threshold: 0.4 }) : null;
  if (io) io.observe(el); else entered = true;
  const ctx = document.createElement('canvas').getContext('2d');

  el.querySelector('.ft-ctl').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-all]');
    if (b) { showAll = b.dataset.all === '1'; el.querySelectorAll('[data-all]').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.all === '1') === showAll))); full(true); return; }
    const w = ev.target.closest('[data-w]');
    if (w) { const k = w.dataset.w; if (wOff.has(k)) wOff.delete(k); else wOff.add(k); if (wOff.size === 3) wOff.clear(); el.querySelectorAll('[data-w]').forEach((x) => x.setAttribute('aria-pressed', String(!wOff.has(x.dataset.w)))); full(); return; }
    const md = ev.target.closest('[data-mod]');
    if (md) { const k = md.dataset.mod; if (modOff.has(k)) modOff.delete(k); else modOff.add(k); if (modOff.size === el.querySelectorAll('[data-mod]').length) modOff.clear(); el.querySelectorAll('[data-mod]').forEach((x) => x.setAttribute('aria-pressed', String(!modOff.has(x.dataset.mod)))); full(); return; }
    const pr = ev.target.closest('[data-price]');
    if (pr) { priceOn = !priceOn; pr.setAttribute('aria-pressed', String(priceOn)); full(); }
  });
  el.querySelector('[data-front]').addEventListener('change', (ev) => { frontBench = ev.target.value; applyFrontier(); full(); });

  let W, H, L, rows = [], x, rowY = new Map(), hoverId = null, mobile = false, vis = [];

  // a time axis that gives busy years more room: half calendar time, half the share of releases
  function makeX(w) {
    const years = d3.range(2017, 2028);
    const n = models.length;
    const cum = years.map((y) => models.filter((m) => m.year < y).length / n);
    const lin = years.map((y) => (y - 2017) / 10);
    const f = years.map((y, i) => 0.5 * lin[i] + 0.5 * cum[i]);
    const t0 = 2017.3, t1 = 2026.95;
    const F = (t) => { const i = Math.max(0, Math.min(9, Math.floor(t) - 2017)); return f[i] + (t - (2017 + i)) * (f[i + 1] - f[i]); };
    const f0 = F(t0), f1 = F(t1);
    const sc = (t) => L + ((F(Math.max(2017, Math.min(2027, t))) - f0) / (f1 - f0)) * (w - L - 24);
    sc.year = (y) => sc(y);
    return sc;
  }

  const ftEl = el.querySelector('.ft'), topEl = el.querySelector('.ft-top');
  function layout() {
    const cw = el.clientWidth;
    // the section may carry a kicker above this view; size to what is left
    const sec = el.closest('.td-sec');
    const avail = sec ? sec.clientHeight - el.offsetTop : el.clientHeight;
    ftEl.style.height = `${avail}px`;
    const ch = Math.max(300, avail - topEl.offsetHeight);
    mobile = cw < 760;
    L = mobile ? 96 : 172;
    vis = LANES.filter((l) => (showAll || TOP.includes(l.id)) && laneCount.get(l.id));
    const minRow = mobile ? 44 : 30;
    W = mobile ? Math.max(cw, 900) : cw;
    // the frontier gets its own strip above the lanes (desktop), so the line never zigzags between labs
    const STRIP = mobile ? 0 : priceOn ? 112 : 56;
    // the year labels sit above the contract and source footer, whatever height the footer wraps to
    const axisH = mobile ? 44 : Math.max(60, (noteBox.offsetHeight || 40) + 30), top = 8 + STRIP;
    const rh = Math.max(minRow, Math.floor((ch - axisH - top) / vis.length));
    strip = STRIP;
    H = mobile ? top + rh * vis.length + axisH : Math.max(ch, top + rh * vis.length + axisH);
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    rows = vis.map((l, i) => ({ l, y0: top + i * rh, y1: top + (i + 1) * rh, cy: top + i * rh + rh / 2, h: rh }));
    rowY = new Map(rows.map((r) => [r.l.id, r]));
    x = makeX(W);
    // positions: same-month stacks fan out vertically inside the row
    const shown = models.filter((m) => rowY.has(m.lane) && pass(m));
    const groups = d3.group(shown, (m) => `${m.lane}|${m.year}-${m.month || 0}`);
    for (const [, g] of groups) {
      g.sort((a, b) => (b.recs ? 1 : 0) - (a.recs ? 1 : 0) || a.name.localeCompare(b.name));
      const spread = Math.min(rh * 0.3, 11);
      g.forEach((m, i) => { const r = rowY.get(m.lane); m.fx = x(m.t) + (i % 2 ? 4 : 0) * (i > 0 ? 1 : 0); m.fy = r.cy + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * spread); });
    }
    return shown;
  }

  function drawFrame() {
    const years = d3.range(2017, 2027);
    gRows.selectAll('*').remove();
    const rg = gRows.selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${r.y0})`);
    // state morph: a lane already on screen slides to its new position instead of reappearing
    if (prevRowY && entered && !RM) rg.filter((r) => prevRowY.has(r.l.id) && prevRowY.get(r.l.id) !== r.y0).attr('transform', (r) => `translate(0,${prevRowY.get(r.l.id)})`).transition('row').duration(T.morph).ease(d3.easeCubicInOut).attr('transform', (r) => `translate(0,${r.y0})`);
    prevRowY = new Map(rows.map((r) => [r.l.id, r.y0]));
    rg.append('rect').attr('x', 0).attr('width', W).attr('height', (r) => r.h).attr('fill', '#121212').attr('fill-opacity', (r, i) => (i % 2 ? 0.02 : 0.05));
    rg.append('line').attr('x1', 0).attr('x2', W).attr('y1', 0.5).attr('y2', 0.5).attr('stroke', 'rgba(28,26,23,.14)');
    rg.append('rect').attr('x', 0).attr('width', 4).attr('height', (r) => r.h).attr('fill', (r) => r.l.color);
    rg.append('text').attr('class', 'ft-lab').attr('x', 12).attr('y', (r) => r.h / 2 - (r.h > 40 ? 3 : 0)).attr('dy', '0.35em').attr('font-size', mobile ? 13 : rows.length > 8 ? 14 : 16).text((r) => r.l.label)
      .each(function (r) { const t = d3.select(this); let s = r.l.label; ctx.font = `${t.attr('font-size')}px Instrument Serif, serif`; while (s.length > 4 && ctx.measureText(s).width > L - 18) { s = s.slice(0, -2).trim(); t.text(s + '\u2026'); } });
    rg.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', (r) => r.h / 2 + 12).attr('dy', '0.35em').style('display', (r) => (r.h > 40 ? null : 'none'))
      .text((r) => { const ms = models.filter((m) => m.lane === r.l.id && pass(m)); const o = ms.filter((m) => wOf(m) === 'open').length, f = ms.filter((m) => m.recs).length; return `${ms.length} \u00b7 ${o} open \u00b7 ${f} frontier`; })
      .each(function () { const t = d3.select(this); let s = t.text(); ctx.font = '9.5px Instrument Sans, monospace'; while (s.length > 6 && ctx.measureText(s).width > L - 18) { s = s.slice(0, -4).trim() + '\u2026'; t.text(s); } });
    gGrid.selectAll('*').remove();
    const yb = rows.length ? rows[rows.length - 1].y1 : 0;
    gGrid.selectAll('line.y').data(years).join('line').attr('class', 'y').attr('x1', (y) => x(y)).attr('x2', (y) => x(y)).attr('y1', 0).attr('y2', yb + 4).attr('stroke', 'rgba(28,26,23,.18)');
    gGrid.selectAll('text.ft-yr').data(years).join('text').attr('class', 'ft-yr').attr('x', (y) => x(y) + 4).attr('y', yb + 17).text((y) => y);
    // shade years outside the brushed window
    const out = [];
    if (S.y0 > 2017) out.push([x(2017), x(Math.min(2027, S.y0))]);
    if (S.y1 < 2026) out.push([x(S.y1 + 1), x(2027)]);
    gGrid.selectAll('rect.out').data(out).join('rect').attr('class', 'out').attr('x', (d) => d[0]).attr('width', (d) => Math.max(0, d[1] - d[0])).attr('y', 0).attr('height', yb).attr('fill', 'rgba(247,247,245,.6)');
    gGrid.append('rect').attr('x', 0).attr('y', 0).attr('width', L - 2).attr('height', yb).attr('fill', 'var(--ground)').attr('fill-opacity', 0.75).lower();
  }

  // the frontier line: a step through record-setting models in date order. On entry (and when the benchmark filter
  // changes) it draws left to right with a traveling dot; the dot then stays at the current frontier as the "now" mark.
  function drawMarks(shown, { morph = false } = {}) {
    const anim = entered && !RM;
    const front = shown.filter((m) => m.recs).sort((a, b) => a.t - b.t || a.fy - b.fy);
    const frontKey = front.map((m) => m.id).join(',');
    const lineAnim = anim && (frontKey !== drawMarks.frontKey || !prevPos);
    drawMarks.frontKey = frontKey;
    gLine.selectAll('*').interrupt().remove();
    if (strip && front.length > 1) {
      let cum = 0; front.forEach((m) => { cum += m.recs.size; m.cum = cum; });
      const FS = 56; // the frontier keeps its 56px band; the price line takes the rest of the strip
      const sy = d3.scaleLinear().domain([0, cum]).range([FS - 2, 10]);
      const line = d3.line().x((m) => m.fx).y((m) => sy(m.cum)).curve(d3.curveStepAfter);
      gLine.append('rect').attr('x', L).attr('y', 0).attr('width', Math.max(0, W - L)).attr('height', FS).attr('fill', 'var(--ground-2)');
      gLine.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', 14).text('Frontier').attr('font-size', 13).attr('font-family', 'Instrument Serif, serif').attr('fill', STEP);
      gLine.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', 30).text(frontBench ? `${cum} records on ${benchName.get(frontBench)}` : `${cum} records on ${frontierBenches.size}${benchTotal !== frontierBenches.size ? ` of ${benchTotal}` : ''} benchmarks`).each(function () { const t = d3.select(this); let s = t.text(); ctx.font = '9.5px Instrument Sans, monospace'; while (s.length > 6 && ctx.measureText(s).width > L - 18) { s = s.slice(0, -4).trim() + '\u2026'; t.text(s); } });
      const ticks = gLine.selectAll('line.tick').data(front).join('line').attr('class', 'tick').attr('x1', (m) => m.fx).attr('x2', (m) => m.fx).attr('y1', (m) => sy(m.cum)).attr('y2', (m) => m.fy).attr('stroke', STEP).attr('stroke-width', 0.6).attr('stroke-opacity', 0.35);
      const path = gLine.append('path').attr('class', 'front').attr('d', line([{ fx: front[0].fx, cum: 0 }, ...front])).attr('fill', 'none').attr('stroke', STEP).attr('stroke-width', 1.4).attr('stroke-opacity', 0.9).attr('stroke-dasharray', STEP_DASH);
      const steps = gLine.selectAll('circle.st').data(front).join('circle').attr('class', 'st').attr('cx', (m) => m.fx).attr('cy', (m) => sy(m.cum)).attr('r', 2.2).attr('fill', STEP);
      const last = front[front.length - 1];
      const now = gLine.append('circle').attr('class', 'now').attr('cx', last.fx).attr('cy', sy(last.cum)).attr('r', 3.6).attr('fill', 'var(--ground)').attr('stroke', STEP).attr('stroke-width', 2);
      const nowLab = gLine.append('text').attr('class', 'ft-sub ft-now').attr('x', last.fx + (last.fx > W - 90 ? -8 : 8)).attr('y', sy(last.cum) + 3.5).attr('text-anchor', last.fx > W - 90 ? 'end' : 'start').attr('fill', STEP).text(`${cum} records`);
      if (lineAnim) {
        // the step draws over 900ms; each step dot and tick appears as the line passes it; the dot travels with the line's end
        const len = path.node().getTotalLength();
        const node = path.node();
        path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('front').duration(T.line).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0).on('end', () => path.attr('stroke-dasharray', STEP_DASH).attr('stroke-dashoffset', null));
        const frac = (m) => { const l0 = x(front[0].t) ; return Math.max(0, Math.min(1, (m.fx - l0) / Math.max(1, last.fx - l0))); };
        steps.attr('r', 0).transition('st').delay((m) => T.line * frac(m)).duration(160).attr('r', 2.2);
        ticks.attr('y2', (m) => sy(m.cum)).transition('tk').delay((m) => T.line * frac(m)).duration(240).ease(d3.easeCubicOut).attr('y2', (m) => m.fy);
        nowLab.attr('opacity', 0).transition('nl').delay(T.line).duration(T.hover).attr('opacity', 1);
        now.transition('dot').duration(T.line).ease(d3.easeCubicInOut).tween('travel', function () { return (u) => { const pt = node.getPointAtLength(u * len); d3.select(this).attr('cx', pt.x).attr('cy', pt.y); }; });
      }
    } else if (front.length > 1) {
      const line = d3.line().x((m) => m.fx).y((m) => m.fy).curve(d3.curveBumpX);
      const path = gLine.append('path').attr('class', 'front').attr('d', line(front)).attr('fill', 'none').attr('stroke', STEP).attr('stroke-width', 1.4).attr('stroke-opacity', 0.9).attr('stroke-dasharray', STEP_DASH);
      if (lineAnim) { const len = path.node().getTotalLength(); path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('front').duration(T.line).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0).on('end', () => path.attr('stroke-dasharray', STEP_DASH).attr('stroke-dashoffset', null)); }
    } else if (strip) {
      gLine.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', 14).text('Frontier').attr('font-size', 13).attr('font-family', 'Instrument Serif, serif').attr('fill', STEP);
      gLine.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', 30).text(front.length === 1 ? '1 record in these rows' : 'no records in these rows');
    }
    if (strip && priceOn && priceSeries) drawPrice(anim && (morph || !prevPrice));
    prevPrice = priceOn;
    const g = gMarks.selectAll('g.m').data(shown, (d) => d.id).join((en) => {
      const g = en.append('g').attr('class', 'm').attr('tabindex', 0).attr('role', 'button');
      g.append('circle').attr('class', 'halo');
      g.append('circle').attr('class', 'ring');
      g.append('circle').attr('class', 'dot');
      return g;
    });
    g.interrupt('pos').interrupt('enter');
    // state morph: a mark already on screen moves to its new position; a new mark grows in at its place
    const isNew = (d) => !prevPos || !prevPos.has(d.id);
    if (anim && morph && prevPos) {
      g.filter((d) => !isNew(d)).attr('transform', (d) => { const p = prevPos.get(d.id); return `translate(${p[0]},${p[1]})`; }).transition('pos').duration(T.morph).ease(d3.easeCubicInOut).attr('transform', (d) => `translate(${d.fx},${d.fy})`);
      g.filter(isNew).attr('transform', (d) => `translate(${d.fx},${d.fy})`);
    } else g.attr('transform', (d) => `translate(${d.fx},${d.fy})`);
    g.attr('aria-label', (d) => `${d.name}, ${d.org}, ${fmtModelDate(d)}, ${fmtParams(d.params_billion)}, ${wLabel(d)}${d.recs ? ', set a benchmark record' : ''}`);
    g.select('circle.halo').attr('r', (d) => (d.recs ? 11 : 8)).attr('fill', 'transparent');
    g.select('circle.ring').attr('r', 0).attr('fill', 'none').attr('stroke', (d) => (LANES.find((l) => l.id === d.lane) || LANES[7]).color).attr('stroke-width', 1.2).attr('opacity', 0);
    const rBase = (d) => (d.recs ? 6.5 : 4.5);
    const dot = g.select('circle.dot').attr('fill', (d) => (d.params_billion == null && !d.recs ? 'var(--ground)' : wColor(d)))
      .attr('stroke', (d) => (d.recs ? FRONT : wColor(d))).attr('stroke-width', (d) => (d.recs ? 2 : 1.2))
      .attr('stroke-dasharray', (d) => (d.params_billion == null && !d.recs ? '2 1.6' : null));
    // Match cut: a filter swap keeps every shared mark at its position and scale and cuts the rest on one frame;
    // only a row toggle (lanes added or removed) moves marks, and then they travel rather than reappear
    const rowKey = rows.map((r) => r.l.id).join(',');
    const cut = morph && prevPos && rowKey === drawMarks.rowKey;
    drawMarks.rowKey = rowKey;
    if (cut) {
      // the hovered mark is the matched element: it is drawn at its hover size on the first frame, so nothing about it changes across the cut
      dot.attr('r', (d) => (hoverId === d.id ? Math.max(rBase(d), rOf(d.params_billion)) : rBase(d))).attr('stroke-width', (d) => (S.sel === d.id ? 3 : hoverId === d.id ? 2.6 : d.recs ? 2 : 1.2));
      drawMarks.delayOf = null; drawMarks.until = 0;
    } else if (anim && (morph || !prevPos)) {
      // on entry the whole chart grows in lane by lane in date order; on a row toggle only the additions grow in,
      // in date order over a short spread, so the lane-by-lane entry never replays
      const fresh = g.filter((d) => isNew(d) || !morph);
      const laneIdx = new Map(rows.map((r, i) => [r.l.id, i]));
      const delayOf = new Map();
      if (morph) {
        const arr = fresh.data().slice().sort((p, q) => p.t - q.t);
        arr.forEach((d, i) => delayOf.set(d.id, arr.length > 1 ? (i / (arr.length - 1)) * (T.spread / 2) : 0));
      } else {
        const byLane = d3.group(fresh.data(), (d) => d.lane);
        byLane.forEach((arr, lane) => { arr.sort((p, q) => p.t - q.t); arr.forEach((d, i) => delayOf.set(d.id, laneIdx.get(lane) * T.lane + (arr.length > 1 ? (i / (arr.length - 1)) * T.spread : 0))); });
      }
      fresh.select('circle.dot').attr('r', 0).transition('enter').delay((d) => delayOf.get(d.id) || 0).duration(T.mark).ease(d3.easeCubicOut).attr('r', rBase);
      g.filter((d) => !isNew(d) && morph).select('circle.dot').attr('r', rBase);
      drawMarks.delayOf = delayOf;
      drawMarks.until = performance.now() + (d3.max([...delayOf.values()]) || 0) + T.mark + 20;
    } else { dot.attr('r', rBase); drawMarks.delayOf = null; drawMarks.until = 0; }
    prevPos = new Map(shown.map((d) => [d.id, [d.fx, d.fy]]));
    // the hovered mark is redrawn in place across the cut; a hovered mark the filter removed takes its label with it
    if (cut && hoverId) { const hm = shown.find((m) => m.id === hoverId); if (hm) { hoverLabel(hm); familyLines(hm); } else { hoverId = null; hoverLabel(null); familyLines(null); } }
    g.on('mouseenter', (ev, d) => hl(d)).on('mouseleave', () => hl(null))
      .on('focus', (ev, d) => hl(d)).on('blur', () => hl(null))
      .on('click', (ev, d) => { select(d.id); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(d.id); } });
    labels(shown);
    applyDim();
  }

  // price overlay: log scale, dollars per million tokens for the cheapest model at GPT-4 level, in the lower half of the strip.
  // When switched on it draws in left to right while the lanes slide down to make room.
  function drawPrice(anim) {
    const PC = '#2d5a88', y0 = 60, y1 = strip - 6;
    const pts = priceSeries.pts;
    const py = d3.scaleLog().domain([d3.min(pts, (p) => p.v), d3.max(pts, (p) => p.v)]).range([y1 - 4, y0 + 10]);
    const g = gLine.append('g').attr('class', 'price');
    g.append('rect').attr('x', L).attr('y', y0).attr('width', Math.max(0, W - L)).attr('height', y1 - y0).attr('fill', 'rgba(45,90,136,.05)');
    g.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', y0 + 14).text('Price').attr('font-size', 13).attr('font-family', 'Instrument Serif, serif').attr('fill', PC);
    g.append('text').attr('class', 'ft-sub').attr('x', 12).attr('y', y0 + 30).text('$/1M tokens, GPT-4 level').each(function () { const t = d3.select(this); let s = t.text(); ctx.font = '9.5px Instrument Sans, monospace'; while (s.length > 6 && ctx.measureText(s).width > L - 18) { s = s.slice(0, -4).trim() + '\u2026'; t.text(s); } });
    const step = d3.line().x((p) => x(p.t)).y((p) => py(p.v)).curve(d3.curveStepAfter);
    const path = g.append('path').attr('d', step(pts)).attr('fill', 'none').attr('stroke', PC).attr('stroke-width', 1.6);
    const last = pts[pts.length - 1];
    const tail = g.append('line').attr('x1', x(last.t)).attr('x2', x(2026.95)).attr('y1', py(last.v)).attr('y2', py(last.v)).attr('stroke', PC).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 2').attr('opacity', 0.7);
    const dots = g.selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.t)).attr('cy', (p) => py(p.v)).attr('r', 3).attr('fill', 'var(--ground)').attr('stroke', PC).attr('stroke-width', 1.5).style('pointer-events', 'all')
      .on('mouseenter', (ev, p) => tip.show(ev, `<div class="k"><i style="background:${PC}"></i>${esc(fmtModelDate({ year: Math.floor(p.t), month: Math.max(1, Math.round((p.t % 1) * 12 + 0.5)) }))}</div><div class="h">${esc(p.label)}</div><div class="m">${fmtPrice(p.v)} per 1M tokens at GPT-4 level (MMLU)</div>`)).on('mousemove', tip.move).on('mouseleave', tip.hide);
    const ends = [pts[0], last].map((p, i) => g.append('text').attr('class', 'ft-sub').attr('x', x(p.t) + (i ? 6 : -6)).attr('y', py(p.v) + (i ? 4 : -6)).attr('text-anchor', i ? 'start' : 'end').attr('fill', PC).text(fmtPrice(p.v)));
    const src = priceSeries.src ? g.append('a').attr('href', priceSeries.src.url).attr('target', '_blank').attr('rel', 'noopener').append('text').attr('class', 'ft-sub').attr('x', W - 6).attr('y', y1 - 2).attr('text-anchor', 'end').attr('fill', PC).text('Epoch AI') : null;
    if (!anim) return;
    const len = path.node().getTotalLength();
    const fx0 = x(pts[0].t), fx1 = x(last.t);
    path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('pr').duration(T.price).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0).on('end', () => path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
    dots.attr('r', 0).transition('prd').delay((p) => T.price * ((x(p.t) - fx0) / Math.max(1, fx1 - fx0))).duration(160).attr('r', 3);
    [tail, ends[1], ...(src ? [src] : [])].forEach((n) => n.attr('opacity', 0).transition('prt').delay(T.price).duration(T.hover).attr('opacity', n === tail ? 0.7 : 1));
  }

  // labels: frontier models first, then the rest by parameter count; a label is kept only where it does not collide
  function labels(shown) {
    gLabels.selectAll('*').remove();
    const cand = shown.slice().sort((a, b) => (b.recs ? 1 : 0) - (a.recs ? 1 : 0) || (b.params_billion || 0) - (a.params_billion || 0));
    ctx.font = '500 11.5px Instrument Sans, Georgia, serif';
    // every label goes through the shared placer with a small gap, so neighbours never touch: above, below, right, left of its mark
    const items = cand.map((m, i) => {
      const r = rowY.get(m.lane);
      const txt = m.name.replace(/^OpenAI /, '');
      const w = ctx.measureText(txt).width + 6, h = 12;
      const dr = m.recs ? 7 : 5;
      const opts = [
        { x: m.fx, y: m.fy - dr - 4, a: 'middle', x0: m.fx - w / 2, y0: m.fy - dr - 4 - h },
        { x: m.fx, y: m.fy + dr + 12, a: 'middle', x0: m.fx - w / 2, y0: m.fy + dr + 2 },
        { x: m.fx + dr + 4, y: m.fy + 4, a: 'start', x0: m.fx + dr + 2, y0: m.fy - 6 },
        { x: m.fx - dr - 4, y: m.fy + 4, a: 'end', x0: m.fx - dr - 4 - w, y0: m.fy - 6 },
      ];
      const marks = shown.filter((o) => o.lane === m.lane && o !== m).map((o) => ({ x1: o.fx - 6, x2: o.fx + 6, y1: o.fy - 6, y2: o.fy + 6 }));
      return { m, txt, opts, w, h, pri: cand.length - i, cands: opts.map((o) => [o.x0, o.y0]), accept: (b) => b.y1 >= r.y0 + 1 && b.y2 <= r.y1 - 1 && b.x1 >= L && b.x2 <= W - 4 && !marks.some((k) => b.x1 < k.x2 && b.x2 > k.x1 && b.y1 < k.y2 && b.y2 > k.y1) };
    });
    placeLabels(items, { gap: 2 });
    const placed = items.filter((it) => !it.hidden);
    for (const it of placed) {
      const o = it.opts[it.ci];
      const t = gLabels.append('text').attr('class', `ft-nm${it.m.recs ? '' : ' dim'}`).attr('x', o.x).attr('y', o.y).attr('text-anchor', o.a).attr('data-id', it.m.id).text(it.txt);
      // the placer works from canvas metrics; the rendered glyphs decide, so a label crossing the right bound is pulled back inside it
      let dx = 0;
      try { const bb = t.node().getBBox(); if (bb.width && bb.x + bb.width > W - 4) { dx = W - 4 - (bb.x + bb.width); t.attr('x', o.x + dx); } } catch { /* detached svg: keep the planned place */ }
      it.m.labelBox = { x1: o.x0 + dx, y1: o.y0, x2: o.x0 + it.w + dx, y2: o.y0 + it.h };
      // a label arrives just after its mark
      const dl = drawMarks.delayOf && drawMarks.delayOf.get(it.m.id);
      if (dl != null) t.style('opacity', 0).transition('lab').delay(dl + T.mark * 0.6).duration(T.hover).style('opacity', 1).on('end', function () { d3.select(this).style('opacity', null); });
    }
    shown.forEach((m) => { if (!placed.some((it) => it.m === m)) m.labelBox = null; });
    const hidden = shown.length - placed.length;
    const filtered = wOff.size || modOff.size ? `${shown.length} of ${models.filter((m) => rowY.has(m.lane)).length} models pass the filters. ` : '';
    note.textContent = `${filtered}${hidden > 0 ? `${placed.length} of ${shown.length} labeled at this width; hover any mark for its name. ` : ''}Marks in the same month fan out within a row.`;
  }

  function matchQ(m) {
    if (!S.q) return true;
    const t = `${m.name} ${m.org} ${m.notable_for} ${m.modality}`.toLowerCase();
    return S.q.toLowerCase().split(/\s+/).filter(Boolean).every((x) => t.includes(x));
  }
  function applyDim() {
    const h = hoverId ? models.find((m) => m.id === hoverId) : null;
    const fam = h ? new Set(h.fams) : null;
    const on = (m) => {
      if (S.sel && S.sel === m.id) return 1;
      if (m.year < S.y0 || m.year > S.y1 || !matchQ(m)) return 0.18;
      if (fam) return m.id === hoverId || (fam.size && m.fams.some((f) => fam.has(f))) ? 1 : 0.35;
      return 1;
    };
    gMarks.selectAll('g.m').attr('opacity', on).classed('sel', (m) => S.sel === m.id).classed('hot', (m) => hoverId === m.id);
    // labels under the hover label step aside (they come back when the hover ends)
    const hb = hoverBox;
    gLabels.selectAll('text').attr('opacity', (d, i, nodes) => { const m = models.find((x) => x.id === nodes[i].dataset.id); if (!m) return 1; if (hoverId && (m.id === hoverId || (hb && m.labelBox && !(m.labelBox.x2 < hb.x1 || m.labelBox.x1 > hb.x2 || m.labelBox.y2 < hb.y1 || m.labelBox.y1 > hb.y2)))) return 0; return on(m); });
    // hover: the mark crisps (heavier edge, sized by parameters, a thin ring in the lab's color); selection keeps the heaviest ring
    const dots = gMarks.selectAll('g.m circle.dot');
    const rings = gMarks.selectAll('g.m circle.ring');
    const rHot = (d) => Math.max(d.recs ? 6.5 : 4.5, rOf(d.params_billion));
    const rSet = (d) => (hoverId === d.id ? rHot(d) : d.recs ? 6.5 : 4.5);
    const swSet = (d) => (S.sel === d.id ? 3 : hoverId === d.id ? 2.6 : d.recs ? 2 : 1.2);
    if (RM) { dots.attr('r', rSet).attr('stroke-width', swSet); rings.attr('r', (d) => rHot(d) + 4).attr('opacity', (d) => (hoverId === d.id ? 0.9 : 0)); }
    else {
      const entering = performance.now() < (drawMarks.until || 0);
      // only marks still in the document take a transition; one removed by a filter mid-hover is skipped
      const live = function () { return this.isConnected; };
      dots.filter(live).filter((d) => !(entering && drawMarks.delayOf && drawMarks.delayOf.has(d.id))).transition('hov').duration(T.hover).ease(d3.easeCubicOut).attr('r', rSet).attr('stroke-width', swSet);
      rings.filter(live).transition('hov').duration(T.hover).ease(d3.easeCubicOut).attr('r', (d) => rHot(d) + 4).attr('opacity', (d) => (hoverId === d.id ? 0.9 : 0));
    }
    gLine.selectAll('path.front').attr('stroke-opacity', fam ? 0.35 : 0.8);
  }

  // hover: the model's own label beside its mark (name, lab, date, parameters, weights, records, family) and the
  // family's lineage line drawn through its members in date order
  let hoverBox = null;
  function hoverLabel(m) {
    gHover.selectAll('*').interrupt().remove();
    hoverBox = null;
    if (!m || m.fx == null) return;
    const r = rowY.get(m.lane); if (!r) return;
    const Lc = LANES.find((l) => l.id === m.lane) || LANES[7];
    const rr = Math.max(m.recs ? 6.5 : 4.5, rOf(m.params_billion)) + 4;
    const recs = m.recs ? [...m.recs.values()].map((x) => x.name.replace(/\s*\(.*?\)/g, '')) : [];
    const fams = m.fams.map((f) => { const n = models.filter((o) => o.fams.includes(f) && pass(o) && rowY.has(o.lane)).length; return n > 1 ? `${f} family, ${n} releases` : null; }).filter(Boolean);
    const lines = [
      { t: m.name, cls: 'ft-hn' },
      { t: `${m.org} \u00b7 ${fmtModelDate(m)} \u00b7 ${fmtParams(m.params_billion)} \u00b7 ${wLabel(m)} \u00b7 ${(MOD[m.mod] || MODALITY[0]).word.toLowerCase()}`, cls: 'ft-hm' },
      recs.length ? { t: `Record on ${recs.slice(0, 3).join(', ')}${recs.length > 3 ? ` and ${recs.length - 3} more` : ''}`, cls: 'ft-hm rec' } : null,
      fams.length ? { t: fams.join('; '), cls: 'ft-hm' } : null,
    ].filter(Boolean);
    const fonts = { 'ft-hn': '500 12.5px Instrument Sans, Georgia, serif', 'ft-hm': '10.5px Instrument Sans, monospace', 'ft-hm rec': '10.5px Instrument Sans, monospace' };
    const lh = (l) => (l.cls === 'ft-hn' ? 15 : 13);
    const w = d3.max(lines, (l) => { ctx.font = fonts[l.cls]; return ctx.measureText(l.t).width; }) + 12;
    const hgt = d3.sum(lines, lh) + 8;
    // on a scrolling (mobile) drawing the block stays inside the part of the drawing on screen
    const vx0 = mobile ? body.scrollLeft : 0, vx1 = mobile ? body.scrollLeft + body.clientWidth : W;
    const right = m.fx + rr + 6 + w <= vx1 - 6 || m.fx - rr - 6 - w < vx0 + 4;
    const x0 = Math.max(vx0 + 4, Math.min(vx1 - w - 4, right ? m.fx + rr + 6 : m.fx - rr - 6 - w));
    // the block sits beside the mark, inside the drawing: in the row where it fits, spilling into a neighbour row when it must
    let y0 = m.fy - hgt / 2;
    const yb = rows.length ? rows[rows.length - 1].y1 : H;
    y0 = Math.max(strip + 2, Math.min(yb - hgt - 2, y0));
    const g = gHover.append('g').attr('transform', `translate(${x0},${y0})`);
    g.append('rect').attr('class', 'ft-hb').attr('width', w).attr('height', hgt).attr('fill', 'var(--ground)').attr('fill-opacity', 0.96).attr('stroke', Lc.color).attr('stroke-width', 1);
    g.append('rect').attr('width', 3).attr('height', hgt).attr('fill', Lc.color);
    let y = 4;
    lines.forEach((l) => { y += lh(l); g.append('text').attr('class', l.cls).attr('x', 8).attr('y', y - 3).text(l.t); });
    hoverBox = { x1: x0, y1: y0, x2: x0 + w, y2: y0 + hgt };
    // hairline from the mark to the block when it had to move
    const near = Math.abs(m.fy - (y0 + hgt / 2)) > 6;
    if (near) gHover.append('line').attr('x1', m.fx + (right ? rr : -rr)).attr('y1', m.fy).attr('x2', right ? x0 : x0 + w).attr('y2', y0 + hgt / 2).attr('stroke', Lc.color).attr('stroke-width', 0.8).lower();
    if (!RM) g.attr('opacity', 0).transition('hv').duration(T.hover).attr('opacity', 1);
  }
  function familyLines(m) {
    gFam.selectAll('*').interrupt().remove();
    if (!m || !m.fams.length) return;
    const Lc = LANES.find((l) => l.id === m.lane) || LANES[7];
    for (const f of m.fams) {
      const mem = models.filter((o) => o.fams.includes(f) && o.fx != null && pass(o) && rowY.has(o.lane)).sort((a, b) => a.t - b.t || a.fy - b.fy);
      if (mem.length < 2) continue;
      const line = d3.line().x((o) => o.fx).y((o) => o.fy).curve(d3.curveBumpX);
      const p = gFam.append('path').attr('d', line(mem)).attr('fill', 'none').attr('stroke', Lc.color).attr('stroke-width', 1.6).attr('stroke-opacity', 0.9).attr('stroke-linecap', 'round');
      if (!RM) { const len = p.node().getTotalLength(); p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition('fam').duration(T.fam).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0); }
    }
  }
  function hl(m) { hoverId = m ? m.id : null; hoverLabel(m); familyLines(m); applyDim(); }

  // the entry: lanes, marks, labels and the frontier arrive once, when the chart is in view
  function enter() {
    if (entered) return;
    entered = true; pending = false;
    svg.classed('ft-wait', false);
    prevPos = null; prevRowY = null;
    const shown = layout(); drawFrame(); drawMarks(shown);
  }

  function scrollToModel(m) {
    if (!m || m.fx == null || !mobile) return;
    const vx = m.fx - body.scrollLeft;
    if (vx < L + 10 || vx > body.clientWidth - 40) body.scrollTo({ left: Math.max(0, m.fx - L - 40), behavior: 'smooth' });
  }

  let fontsHooked = false;
  function full(resetScroll, morph = true) {
    const shown = layout(); drawFrame(); drawMarks(shown, { morph: morph && entered });
    if (!entered && !pending) { pending = true; svg.classed('ft-wait', true); }
    if (entered) svg.classed('ft-wait', false);
    if (!entered && io) { const r = el.getBoundingClientRect(); const vh = innerHeight; const vis = Math.min(r.bottom, vh) - Math.max(r.top, 0); if (vis >= 0.4 * Math.min(r.height, vh)) { io.disconnect(); enter(); } }
    if (resetScroll && mobile) body.scrollLeft = 0;
    if (!fontsHooked && document.fonts && document.fonts.status !== 'loaded') { fontsHooked = true; document.fonts.ready.then(() => full(false, false)); }
  }
  function render(state, ch) {
    if (ch.has('*')) { full(); scrollToModel(S.sel && db.modelById?.get(S.sel)); return; }
    if (ch.has('y0') || ch.has('y1')) { drawFrame(); applyDim(); }
    if (ch.has('q') || ch.has('sel')) { applyDim(); if (ch.has('sel')) scrollToModel(S.sel && db.modelById?.get(S.sel)); }
    if (ch.has('mode')) { const a = S.mode === 'all'; if (a !== showAll) { showAll = a; el.querySelectorAll('[data-all]').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.all === '1') === showAll))); full(true); } }
  }
  return { render, resize() { full(false, false); }, hover(id) { const m = id && db.modelById?.get(id); hl(m || null); if (m && S.tour) scrollToModel(m); } };
}

export { modelEvents };
