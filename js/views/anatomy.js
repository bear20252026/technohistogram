// F. ANATOMY OF AI, drawn as ISOMETRIC FLOWS in Blueprint Notation (Vision 4 hero): the ten organs are blocks on one
// isometric ground, the fifteen flows are pipes along its grid, one path is lit in amber (the organ in hand; Labs by
// default lights funding into Labs and training compute out of it). Leader lines carry each organ's name and one sourced
// figure to the margins; the explainer and the organ's events open in the evidence panel. Block height is the organ's
// event count in the window; the year scrub recomputes every figure from the series files. Same model, new geometry.
import { wrapChars, tspans } from '../text.js';
import { passes, ensure, fmtDate as fmtEv, host } from '../data.js';
import { recent, fmtDate as fmtDay } from '../recent.js';
import { state as S, YEAR_MIN, YEAR_MAX } from '../store.js';
import { esc, openEvidence } from '../ui.js';
import { loadExplainers, factAt, flowSeries, fmtFlowValue, cardHTML } from '../explainers.js';

const rx = (re) => (e) => re.test(e.title);
const has = (e, ...tags) => tags.some((t) => (e.tags || []).includes(t));
const orgRe = /OpenAI|DeepMind|Anthropic|Google Brain|Meta AI|FAIR|xAI|Mistral|DeepSeek|Microsoft Research|Baidu|Alibaba|Moonshot|Zhipu|Cohere|Inflection/i;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Y_LO = 2017, Y_HI = 2026;

const NODES = [
  { id: 'models', label: 'Models', organ: 'the cortex', color: 'var(--ai-organ-models-label)', f: (e) => has(e, 'reasoning-models') || e.domain === 'ai' && ['transformer', 'foundation', 'agentic', 'deep'].includes(e.ai_era) && ['product', 'milestone', 'invention', 'discovery', 'concept'].includes(e.type) || rx(/\bGPT|\bmodel\b|Claude|Gemini|Llama|BERT|transformer|AlphaFold|diffusion/i)(e) },
  { id: 'labs', label: 'Labs', organ: 'the heart', color: 'var(--ai-organ-labs-label)', f: (e) => (e.orgs || []).some((o) => orgRe.test(o)) || (rx(orgRe)(e) && e.domain === 'ai') },
  { id: 'chips', label: 'Chips', organ: 'the skeleton', color: 'var(--ai-organ-chips-label)', f: (e) => e.domain === 'semiconductors' || has(e, 'geopolitics-chips', 'moores-law', 'china-ai') && rx(/chip|semiconductor|export|GPU|Nvidia|Huawei|TSMC/i)(e) || rx(/\bchip|GPU|TPU|Nvidia|TSMC|semiconductor|ASML|CUDA|H100|Blackwell/i)(e) },
  { id: 'energy', label: 'Energy', organ: 'the metabolism', color: 'var(--ai-organ-energy-label)', f: (e) => e.domain === 'energy' || has(e, 'energy-demand', 'data-centers') || rx(/data ?cent|electric|nuclear|power grid|gigawatt|\bGW\b|energy|Stargate|power plant|reactor/i)(e) },
  { id: 'data', label: 'Data', organ: 'the lungs', color: 'var(--ai-organ-data-label)', f: (e) => has(e, 'privacy', 'copyright', 'surveillance') || rx(/\bdata\b|dataset|ImageNet|corpus|Common Crawl|training data|scrap/i)(e) },
  { id: 'talent', label: 'Talent', organ: 'the nerves', color: 'var(--ai-organ-talent-label)', f: (e) => e.type === 'person' || has(e, 'labor') || rx(/researcher|hired|talent|leaves|departs|co-?found|PhD|students/i)(e) },
  { id: 'capital', label: 'Capital', organ: 'the bloodstream', color: 'var(--ai-organ-capital-label)', f: (e) => (e.type === 'market' && !rx(/chip|GPU/i)(e)) || has(e, 'bubble', 'funding') || rx(/invest|funding|valuation|\bIPO\b|billion|market cap|acquire|stock/i)(e) },
  { id: 'products', label: 'Products', organ: 'the hands', color: 'var(--ai-organ-products-label)', f: (e) => has(e, 'coding-agents') || (e.type === 'product' && ['ai', 'software', 'internet'].includes(e.domain) && !rx(/model|GPT-\d|weights/i)(e)) || rx(/ChatGPT|assistant|Copilot|\bagents?\b|Claude Code|Codex|Cursor|chatbot/i)(e) },
  // the senses are AI's public: an event only lands here when it is about AI (the WHO pandemic declaration carries a misinformation tag but is not an AI-users event)
  { id: 'users', label: 'Users', organ: 'the senses', color: 'var(--ai-organ-users-label)', f: (e) => (e.domain === 'ai' || rx(/\bAI\b|ChatGPT|chatbot|deepfake|algorithm/i)(e)) && (has(e, 'democratization', 'misinformation') || (e.type === 'culture' && e.year >= 2010) || rx(/\busers\b|adoption|million people|weekly|students|survey|poll/i)(e)) },
  { id: 'policy', label: 'Policy', organ: 'the skin', color: 'var(--ai-organ-policy-label)', f: (e) => e.type === 'policy' || has(e, 'regulation') || (e.type === 'incident' && has(e, 'safety')) || rx(/\bAct\b|executive order|regulat|ban\b|court|ruling|lawsuit|sues/i)(e) },
];
const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));
// [from, to, label, layer, magnitude series key (null = uniform speed)]
const FLOWS = [
  ['energy', 'chips', 'power', 'compute', 'datacenter_electricity'], ['energy', 'labs', 'power', 'compute', 'datacenter_electricity'], ['chips', 'labs', 'compute', 'compute', 'nvidia_datacenter'],
  ['capital', 'labs', 'funding', 'money', 'ai_private_investment'], ['capital', 'chips', 'capex', 'money', 'nvidia_datacenter'],
  ['data', 'labs', 'corpora', 'data', 'arxiv_ai'], ['talent', 'labs', 'people', 'people', 'ai_publications'], ['labs', 'models', 'training', 'compute', 'training_compute'], ['models', 'products', 'inference', 'compute', null],
  ['products', 'users', 'access', 'people', null], ['users', 'data', 'feedback', 'data', null], ['products', 'capital', 'revenue', 'money', null],
  ['policy', 'labs', 'rules', 'rules', 'policy_count'], ['policy', 'chips', 'export controls', 'rules', null], ['policy', 'data', 'rights', 'rules', null],
].map(([a, b, label, layer, mag], i) => ({ a, b, label, layer, mag, i, key: `${a}>${b}` }));
const HUB_H = 330; // phones: the hub-and-rings panel above the organ list
const LAYERS = [
  { id: 'money', label: 'Money', color: 'var(--ai-organ-capital-2)' }, { id: 'compute', label: 'Compute', color: 'var(--ai-organ-chips-2)' }, { id: 'data', label: 'Data', color: 'var(--ai-organ-data-2)' },
  { id: 'rules', label: 'Rules', color: 'var(--ai-organ-policy-2)' }, { id: 'people', label: 'People', color: 'var(--ai-organ-people-2)' },
];

// Blueprint Notation (AESTHETIC_SYSTEMS.md): one ground, one line weight, one ink, one accent part
const BP = '#0F2A44', INK = '#DCE6EE', INK2 = '#B4C3D1', LW = 0.75;
const ACC = () => tok('--ai-amber', '#E09F24'); // the mineral ochre
const ink = (a) => `rgba(220,230,238,${a})`;
// snapshots: an organ and a year, ticks on the year slider
const QUICK = [['capital', 2021], ['users', 2023], ['policy', 2024], ['chips', 2025]];
const SERIES_NAMES = ['IEA', 'NVIDIA 10-K', 'AI Index via OWID', 'Epoch AI', 'arXiv', 'CSET via OWID', '100M-users dates', 'Policy atlas', 'Lineage data'];

// the isometric ground: grid cells (u, v); x grows with u - v, depth with u + v. The main line runs along u at v = 1
// (energy, chips, labs, models, products, users); rules, data and talent stand behind it (v = 0), capital in front (v = 2).
const ISO = {
  policy: [1, 0], data: [2, 0], talent: [3, 0],
  energy: [0, 1], chips: [1, 1], labs: [2, 1], models: [3, 1], products: [4, 1], users: [5, 1],
  capital: [3, 2],
};
const HS = 0.24; // half footprint of a block, in cells
// pipe routes in grid cells: from a face of the source block to a face of the target, along the grid
const ROUTES = {
  'energy>chips': [[0 + HS, 1], [1 - HS - 0.26, 1]],
  'chips>labs': [[1 + HS, 1], [2 - HS - 0.26, 1]],
  'labs>models': [[2 + HS, 1], [3 - HS - 0.26, 1]],
  'models>products': [[3 + HS, 1], [4 - HS - 0.26, 1]],
  'products>users': [[4 + HS, 1], [5 - HS - 0.26, 1]],
  'energy>labs': [[0, 1 + HS], [0, 1.75], [1.85, 1.75], [1.85, 1 + HS]],
  'capital>labs': [[3 - HS, 2], [2.15, 2], [2.15, 1 + HS]],
  'capital>chips': [[3, 2 + HS], [3, 2.6], [1, 2.6], [1, 1 + HS]],
  'products>capital': [[4, 1 + HS], [4, 1.9], [3 + HS, 1.9]],
  'data>labs': [[2, 0 + HS], [2, 1 - HS]],
  'talent>labs': [[3, 0 + HS], [3, 0.45], [2.15, 0.45], [2.15, 1 - HS]],
  'policy>labs': [[1.15, 0 + HS], [1.15, 0.45], [1.85, 0.45], [1.85, 1 - HS]],
  'policy>chips': [[0.92, 0 + HS], [0.92, 1 - HS]],
  'policy>data': [[1 + HS, -0.12], [2 - HS, -0.12]],
  'users>data': [[5, 1 - HS], [5, -0.7], [2, -0.7], [2, 0 - HS]],
};
// the path each organ lights when it is in hand: one flow in, one out (the sourced ones first)
const PATH = {
  labs: ['capital>labs', 'labs>models'], models: ['labs>models', 'models>products'], products: ['models>products', 'products>users'],
  users: ['products>users', 'users>data'], data: ['users>data', 'data>labs'], talent: ['talent>labs', 'labs>models'],
  capital: ['products>capital', 'capital>labs'], chips: ['energy>chips', 'chips>labs'], energy: ['energy>chips', 'energy>labs'],
  policy: ['policy>labs', 'policy>chips'],
};
// color direction: each organ its own hue family on navy (three steps, pale to bright), flows in a heat range by volume.
// Tokens --ai-organ-<id>-1..3 and --ai-heat-1..5 from palette.css govern when present; these are the fallbacks.
const FAM = { // fallbacks mirror site/css/palette.css; the live values come from the tokens
  models: ['#4D4990', '#8E7CF0', '#ADA4F2'], chips: ['#763F74', '#E25FB3', '#ED92C6'], capital: ['#756750', '#E8B84A', '#EDCC86'], energy: ['#7B4F47', '#F0803A', '#F6A77A'],
  policy: ['#2B6973', '#3FBFB0', '#87D1C3'], data: ['#376C90', '#5BC8F0', '#95D7F0'], users: ['#62648B', '#BDB6E6', '#CFCAE9'], labs: ['#3F5792', '#6F9BF5', '#9AB9F5'],
  products: ['#5E735A', '#B8D36A', '#CCDE98'], talent: ['#7B5B7B', '#F2A0C0', '#F5BBCF'],
};
const HEAT = ['#E09F24', '#EB8A2C', '#E5603A', '#DE4078', '#D23AA6'];
// flow volume rank, one to five: the sourced money and compute flows run hottest, the rules flows palest
const VOL = { 'capital>labs': 5, 'labs>models': 5, 'chips>labs': 4, 'models>products': 4, 'energy>labs': 4, 'capital>chips': 3, 'products>users': 3, 'energy>chips': 3, 'data>labs': 3, 'talent>labs': 2, 'products>capital': 2, 'users>data': 2, 'policy>labs': 1, 'policy>chips': 1, 'policy>data': 1 };
let CSSV = null;
const tok = (name, fallback) => { if (!CSSV) CSSV = getComputedStyle(document.documentElement); const v = CSSV.getPropertyValue(name).trim(); return v || fallback; };
const fam = (id, step) => tok(`--ai-organ-${id}-${step}`, FAM[id][step - 1]);
const heat = (step) => tok(`--ai-heat-${step}`, HEAT[step - 1]);
const COS = Math.cos(Math.PI / 6), SIN = 0.5;
const REST = 'labs';
// the reveal runs once per page load, not once per visit to the tab: an in-memory flag only, nothing is stored
let revealed = false;

export default function anatomy(el, ctx) {
  const { db, select } = ctx;
  let X = { organs: {}, flows: {}, layers: {} };
  loadExplainers().then((x) => { X = x || X; if (focus && !card.hidden) openCard(focus, false); });
  let yr = Y_HI, focus = null, flowFocus = null, layersOff = new Set(), members = new Map(), playT = null;
  let mobile = false, drawn = false, cell = 100, ORG = { x: 0, y: 0 }, W = 0, H = 0, hovered = null;
  const drawing = false;
  el.classList.add('iso');
  el.innerHTML = `
    <div class="ai-stage">
      <div class="ai-title" aria-label="Sheet title block">
        <span class="sc">Anatomy of AI</span>
        <p class="ai-year" aria-live="polite"><span class="an-yr">${Y_HI}</span></p>
        <h2 class="ai-head">Power and money go in, models come out.</h2>
        <p class="ai-key" data-key hidden></p>
        <p class="ai-cap"><b data-nev>&nbsp;</b> events, ten organs<button type="button" class="an-week" data-week aria-expanded="false" hidden><i class="an-week-dot" aria-hidden="true"></i><span class="an-week-n"></span></button></p>
      </div>
      <ol class="ai-list" aria-label="Organs" hidden></ol>
      <aside class="an-week-pop" hidden role="dialog" aria-label="New records this week"></aside>
      <div class="ai-ctl an-ctl">
        <div class="ai-layers an-layers" role="group" aria-label="Layers"><span class="sc">Layers</span>${LAYERS.map((l) => `<button type="button" data-layer="${l.id}" aria-pressed="true"><i style="--c:${l.color}"></i>${l.label}</button>`).join('')}</div>
        <div class="ai-scrub an-scrub"><label class="sc" for="an-year">Year</label><div class="ai-rail"><input id="an-year" type="range" min="${Y_LO}" max="${Y_HI}" step="1" value="${Y_HI}" aria-valuetext="${Y_HI}"><div class="ai-snaps">${QUICK.map(([o, y], i) => `<button type="button" data-q="${o}:${y}" class="r${i % 2}" style="left:${((y - Y_LO) / (Y_HI - Y_LO)) * 100}%" aria-label="${NODE[o].label}, ${y}"><i></i><span><b>${NODE[o].label} </b>${String(y).slice(2)}</span></button>`).join('')}</div></div><output for="an-year">${Y_HI}</output><button type="button" class="an-play" data-play aria-pressed="false">Play</button></div>
      </div>
      <div class="ai-source"><span class="sc">Source</span> <span data-src>${SERIES_NAMES.join(', ')}</span></div>
    </div>
`;
  const stage = el.querySelector('.ai-stage');
  const ctl = el.querySelector('.an-ctl');
  const card = document.createElement('div'); card.hidden = true; // the old in-view card, kept detached: the explainer lives in the shell's evidence panel
  const list = el.querySelector('.ai-list');
  const yrOut = ctl.querySelector('output'), yrIn = ctl.querySelector('#an-year'), yrH = el.querySelector('.an-yr');
  const svg = d3.select(stage).insert('svg', '.ai-ctl').attr('role', 'group').attr('aria-label', 'Isometric diagram of the AI system: ten organs as blocks, fifteen flows as pipes');
  const defs = svg.append('defs');
  defs.append('marker').attr('id', 'an-arrow').attr('viewBox', '0 0 8 8').attr('refX', 7).attr('refY', 4).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0L8,4L0,8Z').attr('fill', INK);
  [1, 2, 3, 4, 5].forEach((k) => defs.append('marker').attr('id', `an-arrow-h${k}`).attr('viewBox', '0 0 8 8').attr('refX', 7).attr('refY', 4).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0L8,4L0,8Z').attr('fill', heat(k)));
  const root = svg.append('g');
  const gGround = root.append('g').attr('class', 'ground').style('pointer-events', 'none');
  const gScene = root.append('g').attr('class', 'scene');
  const gBlocks = gScene, gPipes = gScene;
  const gLead = root.append('g').attr('class', 'leads').style('pointer-events', 'none');
  const gLabels = root.append('g').attr('class', 'mlabels');
  const gHi = root.append('g').style('pointer-events', 'none');
  const peekBox = { hidden: true };

  /* ---------- projection ---------- */
  const PX = (u, v, z = 0) => [ORG.x + (u - v) * cell * COS, ORG.y + (u + v) * cell * SIN - z];
  const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts) => `M${pts.map(pt).join('L')}Z`;
  const line = (pts) => `M${pts.map(pt).join('L')}`;
  // block height in px: a floor plus the organ's share of events in the window
  function blockH(id) {
    const n = (members.get(id) || []).length, mx = Math.max(1, d3.max(NODES, (d) => (members.get(d.id) || []).length) || 1);
    return cell * (0.12 + 0.28 * Math.sqrt(n / mx));
  }
  const PIPE_Z = () => cell * 0.16;

  /* ---------- layout ---------- */
  let compact = false, titleBottom = 0; // under 1100 the stage stacks: title, drawing, controls, source, then the organ list and the panel
  function layout() {
    const ew = el.getBoundingClientRect().width;
    mobile = ew < 760; compact = ew < 1280;
    el.classList.toggle('an-mobile', mobile);
    el.classList.toggle('compact', compact);
    const r = compact ? svg.node().getBoundingClientRect() : stage.getBoundingClientRect();
    const tEl = el.querySelector('.ai-title'), tr = tEl.getBoundingClientRect();
    const titleH = (tr.height ? tr.bottom - (compact ? tr.top : stage.getBoundingClientRect().top) : 0) || tEl.offsetHeight || 150;
    const ctlH = ctl.offsetHeight || 64, srcH = el.querySelector('.ai-source').offsetHeight || 20;
    W = Math.max(320, r.width); H = Math.max(260, r.height);
    const lab = compact ? 0 : 156;        // margin label columns
    titleBottom = compact ? 0 : titleH;
    const top = compact ? 10 : titleH + 16, bottom = compact ? 10 : ctlH + srcH + 28;
    // grid extent in projected units: x from the energy front lane (u 0, v 2.05) to the feedback lane right of users (u 5, v -0.55)
    const xs = [-1.6, 5.6].map((d) => d * COS), ys = [-0.05, 3.22]; // block tops of the back row to the front corner of Users
    const availW = W - 2 * lab - (compact ? 16 : 40), availH = H - top - bottom;
    const cx = availW / (xs[1] - xs[0]), cy = availH / (ys[1] - ys[0]);
    cell = Math.max(44, Math.min(170, cx, cy));
    const gx = (xs[0] + xs[1]) / 2 * cell, gy = (ys[0] + ys[1]) / 2 * cell;
    ORG = { x: lab + (W - 2 * lab) / 2 - gx, y: top + (H - top - bottom) / 2 - gy };
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    list.hidden = !compact;
    footer();
  }
  function footer() {}

  function computeMembers() {
    const full = S.y0 === YEAR_MIN && S.y1 === YEAR_MAX;
    const lo = full ? 2010 : S.y0, hi = Math.min(S.y1, yr);
    const evs = db.events.filter((e) => passes(e) && e.year >= lo && e.year <= hi);
    const CORE = { energy: (e) => e.domain === 'energy' || has(e, 'energy-demand'), chips: (e) => e.domain === 'semiconductors', capital: (e) => e.type === 'market', policy: (e) => e.type === 'policy', models: (e) => e.domain === 'ai' && ['product', 'milestone'].includes(e.type) && rx(/model|GPT|Claude|Gemini|Llama|R1/i)(e), talent: (e) => e.type === 'person' || has(e, 'labor'), data: (e) => has(e, 'copyright', 'privacy') };
    const AM = db.anatomyMap;
    const FALLBACK = ['policy', 'capital', 'energy', 'chips', 'talent', 'data', 'models', 'products', 'users', 'labs'].map((id) => NODE[id]);
    const buckets = new Map(NODES.map((n) => [n.id, []]));
    for (const e of evs) {
      let organ;
      if (AM && AM.has(e.id)) organ = AM.get(e.id);
      else organ = FALLBACK.find((n) => n.f(e))?.id;
      if (organ && buckets.has(organ)) buckets.get(organ).push(e);
    }
    members = new Map(NODES.map((n) => { const c = CORE[n.id] || (() => false); return [n.id, buckets.get(n.id).sort((a, b) => (c(b) - c(a)) || b.significance - a.significance || b.t - a.t)]; }));
    return [lo, hi];
  }


  /* ---------- draw: ground, pipes, blocks, leaders ---------- */
  const ORDER = NODES.map((n) => n.id).sort((a, b) => (ISO[a][0] + ISO[a][1]) - (ISO[b][0] + ISO[b][1]) || ISO[a][1] - ISO[b][1]);
  function draw(first = false) {
    computeMembers();
    el.querySelector('[data-nev]').textContent = d3.format(',')(d3.sum(NODES, (n) => (members.get(n.id) || []).length));
    ground();
    pipes();
    blocks(first);
    paintOrder();
    leaders();
    if (compact) listRows();
    applyLayers();
    light();
  }
  function ground() {
    gGround.selectAll('*').remove();
    // the ground grid: one hairline per cell line across the drawing's footprint
    for (let u = -1; u <= 6; u++) gGround.append('path').attr('d', line([PX(u, -0.9), PX(u, 2.9)])).attr('stroke', ink(0.09)).attr('stroke-width', LW).attr('fill', 'none');
    for (let v = -1; v <= 3; v++) gGround.append('path').attr('d', line([PX(-0.9, v), PX(5.9, v)])).attr('stroke', ink(0.09)).attr('stroke-width', LW).attr('fill', 'none');
  }
  // every route is cut into pieces of at most half a cell so each piece has one depth (u + v at its middle); blocks and
  // pieces then paint in depth order, so a pipe passes behind the blocks it runs behind and over the faces it enters
  function pieces() {
    const out = [];
    for (const f of FLOWS) {
      const R = ROUTES[f.key];
      let k = 0;
      for (let i = 0; i < R.length - 1; i++) {
        const [u0, v0] = R[i], [u1, v1] = R[i + 1], len = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.ceil(len / 0.5));
        for (let q = 0; q < n; q++) {
          const a = [u0 + (u1 - u0) * (q / n), v0 + (v1 - v0) * (q / n)], b = [u0 + (u1 - u0) * ((q + 1) / n), v0 + (v1 - v0) * ((q + 1) / n)];
          const last = i === R.length - 2 && q === n - 1;
          out.push({ id: `p:${f.key}:${k++}`, f, a, b, depth: (a[0] + a[1] + b[0] + b[1]) / 2 + 0.001, last });
        }
      }
    }
    return out;
  }
  const PIECES = pieces();
  function pipes() {
    const z = PIPE_Z(), w = Math.max(5, cell * 0.075);
    const sel = gPipes.selectAll('g.pipe').data(PIECES, (d) => d.id);
    const ent = sel.enter().append('g').attr('class', 'item pipe').attr('data-key', (d) => d.f.key).attr('data-layer', (d) => d.f.layer).attr('tabindex', (d) => (d.last ? 0 : -1)).attr('role', (d) => (d.last ? 'button' : null))
      .attr('aria-label', (d) => (d.last ? `${NODE[d.f.a].label} to ${NODE[d.f.b].label}: ${d.f.label}` : null));
    ent.append('path').attr('class', 'bore');
    ent.append('path').attr('class', 'wall');
    ent.append('path').attr('class', 'core');
    ent.filter((d) => d.last).append('title').text((d) => `${d.f.label}: ${NODE[d.f.a].label} to ${NODE[d.f.b].label}${d.f.mag ? '' : ' (no figures behind this flow)'}`);
    const all = ent.merge(sel);
    all.each(function (d) {
      const g = d3.select(this), hc = heat(VOL[d.f.key] || 1);
      // each piece overdraws its neighbor by a hair so the joins do not show
      const A = PX(d.a[0], d.a[1], z), B = PX(d.b[0], d.b[1], z), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, ex = (dx / L) * 0.6, ey = (dy / L) * 0.6;
      const dd = `M${(A[0] - ex).toFixed(1)},${(A[1] - ey).toFixed(1)}L${(d.last ? B[0] : B[0] + ex).toFixed(1)},${(d.last ? B[1] : B[1] + ey).toFixed(1)}`;
      g.style('--heat', hc);
      g.select('.bore').attr('d', dd).attr('fill', 'none').attr('stroke', BP).attr('stroke-width', w + 2).attr('stroke-linecap', 'butt');
      g.select('.wall').attr('d', dd).attr('fill', 'none').attr('stroke', hc).attr('stroke-opacity', 0.28).attr('stroke-width', w);
      g.select('.core').attr('d', dd).attr('fill', 'none').attr('stroke', hc).attr('stroke-opacity', 0.9).attr('stroke-width', LW).attr('stroke-dasharray', d.f.mag ? null : '3 4').attr('marker-end', d.last ? 'url(#an-arrow)' : null);
    });
    all.on('click', (ev, d) => { ev.stopPropagation(); openFlow(d.f); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openFlow(d.f); } })
      .on('mouseenter', (ev, d) => hoverFlow(d.f.key)).on('mouseleave', () => hoverFlow(null))
      .on('focus', (ev, d) => hoverFlow(d.f.key)).on('blur', () => hoverFlow(null));
  }
  const depthOf = (d) => (d.depth != null ? d.depth : ISO[d.id][0] + ISO[d.id][1]);
  function paintOrder() { gScene.selectAll(':scope > g.item').sort((a, b) => depthOf(a) - depthOf(b)); }
  function blockFaces(id) {
    const [u, v] = ISO[id], h = blockH(id);
    const g = { a: PX(u - HS, v - HS), b: PX(u + HS, v - HS), c: PX(u + HS, v + HS), d: PX(u - HS, v + HS) };
    const t = { a: PX(u - HS, v - HS, h), b: PX(u + HS, v - HS, h), c: PX(u + HS, v + HS, h), d: PX(u - HS, v + HS, h) };
    return { top: poly([t.a, t.b, t.c, t.d]), left: poly([g.d, g.c, t.c, t.d]), right: poly([g.c, g.b, t.b, t.c]), base: poly([g.a, g.b, g.c, g.d]), h, apex: t.a, front: t.c, tb: t.b, td: t.d };
  }
  function blocks(first) {
    const sel = gBlocks.selectAll('g.block').data(ORDER.map((id) => NODE[id]), (n) => n.id);
    const ent = sel.enter().append('g').attr('class', 'item block').attr('data-id', (n) => n.id).attr('tabindex', 0).attr('role', 'button').attr('aria-pressed', 'false');
    ent.append('path').attr('class', 'shadow');
    ent.append('path').attr('class', 'face left');
    ent.append('path').attr('class', 'face right');
    ent.append('path').attr('class', 'face top');
    ent.append('g').attr('class', 'ticks');
    ent.append('text').attr('class', 'bname').attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.08em').attr('fill', BP).attr('font-weight', 600);
    ent.append('title');
    const all = ent.merge(sel);
    all.each(function (n) {
      const g = d3.select(this), F = blockFaces(n.id), list = members.get(n.id) || [];
      g.attr('aria-label', `${n.label}, ${n.organ}: ${list.length} events to ${yr}`);
      g.select('title').text(`${n.label}: ${list.length} events in the years shown`);
      const T = (s) => (first || RM ? s : s.transition().duration(450).ease(d3.easeCubicOut));
      g.select('.shadow').attr('d', F.base).attr('fill', ink(0.05)).attr('stroke', 'none');
      T(g.select('.face.left')).attr('d', F.left);
      T(g.select('.face.right')).attr('d', F.right);
      T(g.select('.face.top')).attr('d', F.top);
      g.selectAll('.face').attr('stroke', INK).attr('stroke-width', LW).attr('stroke-linejoin', 'round');
      g.style('--c1', fam(n.id, 1)).style('--c2', fam(n.id, 2)).style('--c3', fam(n.id, 3));
      g.select('.face.left').attr('fill', fam(n.id, 1)).attr('fill-opacity', 0.5); g.select('.face.right').attr('fill', fam(n.id, 2)).attr('fill-opacity', 0.6); g.select('.face.top').attr('fill', fam(n.id, 3)).attr('fill-opacity', 0.78);
      // the name sits on the top face
      const [u, v] = ISO[n.id], c = PX(u, v, F.h);
      T(g.select('.bname')).attr('x', c[0]).attr('y', c[1] + 3.5);
      g.select('.bname').text(cell >= 68 ? n.label.toUpperCase() : '');
      // one tick per ten events along the front-right edge: the count made visible
      const tk = g.select('.ticks').selectAll('line').data(d3.range(Math.min(12, Math.floor(list.length / 10))));
      tk.exit().remove();
      const e1 = PX(u + HS, v + HS), e2 = PX(u + HS, v - HS);
      tk.enter().append('line').merge(g.select('.ticks').selectAll('line')).attr('x1', (d, i, a) => e1[0] + (e2[0] - e1[0]) * ((i + 1) / (a.length + 1))).attr('x2', (d, i, a) => e1[0] + (e2[0] - e1[0]) * ((i + 1) / (a.length + 1)) + 3)
        .attr('y1', (d, i, a) => e1[1] + (e2[1] - e1[1]) * ((i + 1) / (a.length + 1))).attr('y2', (d, i, a) => e1[1] + (e2[1] - e1[1]) * ((i + 1) / (a.length + 1)) - 2).attr('stroke', INK2).attr('stroke-width', LW);
    });
    all.on('click', (ev, n) => { ev.stopPropagation(); openCard(n.id); })
      .on('keydown', (ev, n) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCard(n.id); return; }
        if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(ev.key)) {
          ev.preventDefault();
          const i = ORDER.indexOf(n.id), j = (i + (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ORDER.length - 1)) % ORDER.length;
          gBlocks.select(`g.block[data-id="${ORDER[j]}"]`).node()?.focus({ preventScroll: true });
        }
      })
      .on('mouseenter', (ev, n) => hoverBlock(n.id)).on('mouseleave', () => hoverBlock(null))
      .on('focus', (ev, n) => hoverBlock(n.id)).on('blur', () => hoverBlock(null));
  }
  /* ---------- leaders to the margin labels: name and one sourced figure per organ ---------- */
  // leaders: from a top corner of the block, a short run along the grid, then straight across to the margin label. The
  // corner, the run and the side are chosen per organ for the fewest crossings of other blocks, five labels a side.
  function outline(id) {
    const [u, v] = ISO[id], h = blockH(id);
    const P = [PX(u - HS, v - HS, h), PX(u + HS, v - HS, h), PX(u + HS, v - HS, 0), PX(u + HS, v + HS, 0), PX(u - HS, v + HS, 0), PX(u - HS, v + HS, h)];
    const cx = d3.mean(P, (p) => p[0]), cy = d3.mean(P, (p) => p[1]);
    return P.map(([x, y]) => [x + Math.sign(x - cx) * 5, y + Math.sign(y - cy) * 5]);
  }
  const segX = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const inPoly = (p, P) => { let w = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) w = !w; return w; };
  function crosses(path, P) {
    for (let i = 0; i < path.length - 1; i++) { if (inPoly(path[i], P) || inPoly(path[i + 1], P)) return true; for (let k = 0; k < P.length; k++) if (segX(path[i], path[i + 1], P[k], P[(k + 1) % P.length])) return true; }
    return false;
  }
  function labelOf(id) {
    const fact = factAt(db, id, yr);
    if (!fact) return { fig: '', key: '' };
    if (fact.v == null) return { fig: '', key: fact.text || fact.k || '' };
    return { fig: fact.fmt(fact.v), key: fact.ks || fact.k || '' };
  }
  function leaders() {
    gLead.selectAll('*').remove();
    gLabels.selectAll('*').remove();
    if (compact) return;
    const lab = 156, pad = 16;
    const rowH = Math.max(70, Math.min(76, (H * 0.62) / 5));
    const outlines = Object.fromEntries(NODES.map((n) => [n.id, outline(n.id)]));
    const lx = { left: lab - 4, right: W - lab + 4 };
    const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], RUNS = [[0, 0], [-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [-0.9, 0], [0.9, 0], [0, -0.9], [0, 0.9]];
    const options = NODES.map((n) => {
      const [u, v] = ISO[n.id], h = blockH(n.id), out = [];
      for (const side of ['left', 'right']) for (const c of CORNERS) for (const r of RUNS) {
        const a = PX(u + c[0] * HS, v + c[1] * HS, h), b = PX(u + c[0] * HS + r[0], v + c[1] * HS + r[1], h);
        const path = [a, b, [lx[side], b[1]]];
        if (side === 'left' ? b[0] < lx.left + 30 : b[0] > lx.right - 30) continue;
        let cost = 0;
        for (const m of NODES) if (m.id !== n.id && crosses(path, outlines[m.id])) cost += 10;
        cost += Math.hypot(r[0], r[1]) * 1.5 + Math.abs(b[0] - lx[side]) / W;
        out.push({ side, a, b, cost });
      }
      out.sort((p, q) => p.cost - q.cost);
      return { id: n.id, out };
    });
    // the organs with the least choice pick first; each side holds five
    const quota = { left: 5, right: 5 }, picked = {};
    options.map((o) => ({ ...o, gap: (o.out.find((x) => x.side !== o.out[0].side)?.cost ?? 99) - o.out[0].cost })).sort((p, q) => q.gap - p.gap)
      .forEach((o) => { const best = o.out.find((x) => quota[x.side] > 0) || o.out[0]; quota[best.side]--; picked[o.id] = best; });
    for (const side of ['left', 'right']) {
      const runs = NODES.map((n) => n.id).filter((id) => picked[id].side === side).map((id) => ({ id, ...picked[id], y: picked[id].b[1] })).sort((p, q) => p.y - q.y);
      const ys = runs.map((r) => r.y);
      for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + rowH);
      const shift = d3.mean(ys) - d3.mean(runs, (r) => r.y);
      const minY = side === 'left' ? titleBottom + 40 : 104; // the title block sits top left
      runs.forEach((r, k) => { r.ly = Math.max(minY, Math.min(H - 140, ys[k] - shift)); });
      for (let k = 1; k < runs.length; k++) runs[k].ly = Math.max(runs[k].ly, runs[k - 1].ly + rowH);
      for (let k = runs.length - 2; k >= 0; k--) runs[k].ly = Math.min(runs[k].ly, runs[k + 1].ly - rowH);
      runs.forEach((p) => {
        const jx = side === 'left' ? lx.left + 22 : lx.right - 22;   // the leader jogs to the label's line just before the margin
        const d = `M${pt(p.a)}L${pt(p.b)}L${jx.toFixed(1)},${p.b[1].toFixed(1)}L${lx[side].toFixed(1)},${p.ly.toFixed(1)}`;
        gLead.append('path').attr('data-id', p.id).attr('d', d).attr('fill', 'none').attr('stroke', fam(p.id, 2)).attr('stroke-opacity', 0.7).attr('stroke-width', LW);
        gLead.append('circle').attr('data-id', p.id).attr('cx', p.a[0]).attr('cy', p.a[1]).attr('r', 1.8).attr('fill', fam(p.id, 3));
        const g = gLabels.append('g').attr('class', 'mlabel').attr('data-id', p.id).attr('transform', `translate(${side === 'left' ? pad : W - pad},${p.ly})`).attr('style', `--c3:${fam(p.id, 3)}`);
        const anchor = side === 'left' ? 'start' : 'end';
        const n = NODE[p.id], L = labelOf(p.id);
        g.append('text').attr('class', 'ml-name').attr('text-anchor', anchor).attr('y', -12).attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('letter-spacing', '0.1em').attr('fill', INK).text(n.label.toUpperCase());
        g.append('text').attr('class', 'ml-fig').attr('text-anchor', anchor).attr('y', 16).attr('font-family', 'Instrument Serif, Georgia, serif').attr('font-size', Math.round((W >= 1100 ? 24 : 20) * Math.min(1, 13 / Math.max(1, (L.fig || '').length)))).attr('fill', tok(`--ai-organ-${p.id}-label`, fam(p.id, 2))).text(L.fig || '');
        const key = g.append('text').attr('class', 'ml-key').attr('text-anchor', anchor).attr('y', L.fig ? 33 : 8).attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', INK);
        tspans(key, wrapChars(L.key, Math.floor((lab - pad - 8) / 6.4), 2), anchor === 'end' ? W - pad : pad, 12);
        g.on('click', () => openCard(p.id)).style('cursor', 'pointer');
      });
    }
  }
  function listRows() {
    list.innerHTML = NODES.map((n) => { const L = labelOf(n.id), c = (members.get(n.id) || []).length; return `<li><button type="button" data-go="${n.id}" aria-pressed="${focus === n.id}" style="--c3:${fam(n.id, 3)}"><span class="nm">${esc(n.label)}</span><span class="fig">${esc(L.fig || '')}</span><span class="key">${esc(L.key)}</span><span class="ct">${c} events</span></button></li>`; }).join('');
  }
  list.addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) openCard(b.dataset.go); });

  /* ---------- light: the amber path, the hover, the layers ---------- */
  function litKeys() {
    if (flowFocus) return new Set([flowFocus]);
    if (focus) return new Set(PATH[focus] || []);
    return new Set();
  }
  function light() {
    const lit = litKeys();
    gPipes.selectAll('g.pipe').classed('lit', (d) => lit.has(d.f.key)).classed('hot', (d) => hovered && (d.f.a === hovered || d.f.b === hovered))
      .select('.core').attr('marker-end', (d) => (d.last ? `url(#an-arrow-h${lit.has(d.f.key) ? 5 : VOL[d.f.key] || 1})` : null));
    gBlocks.selectAll('g.block').classed('on', (n) => n.id === focus).classed('hot', (n) => n.id === hovered).attr('aria-pressed', (n) => String(n.id === focus));
    gLead.selectAll('[data-id]').classed('on', function () { return this.dataset.id === focus; }).classed('hot', function () { return this.dataset.id === hovered; });
    gLabels.selectAll('g.mlabel').classed('on', function () { return this.dataset.id === focus; }).classed('hot', function () { return this.dataset.id === hovered; });
    list.querySelectorAll('[data-go]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === focus)));
    ctl.querySelectorAll('[data-q]').forEach((b) => { const [o, y] = b.dataset.q.split(':'); b.setAttribute('aria-pressed', String(focus === o && yr === +y)); });
  }
  function hoverBlock(id) { hovered = id; light(); }
  function hoverFlow(key) { gPipes.selectAll('g.pipe').classed('hot', (d) => d.f.key === key); }
  function applyLayers() {
    gPipes.selectAll('g.pipe').classed('off', (d) => layersOff.has(d.f.layer));
  }
  function hiEvent(id) {
    gHi.selectAll('*').remove();
    if (!id || !drawn) return;
    NODES.filter((n) => (members.get(n.id) || []).some((e) => e.id === id)).forEach((n) => {
      const F = blockFaces(n.id);
      gHi.append('path').attr('d', F.top).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3').attr('transform', 'translate(0,-6)');
    });
  }
  function refresh() { draw(); }

  /* ---------- series_v3: where people meet the system (polls, hiring, open weights) ---------- */
  let V3 = null, v3Loading = null;
  function loadV3() {
    if (V3 || v3Loading) return v3Loading;
    v3Loading = fetch('data/series_v3.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      V3 = {}; (j && j.series ? j.series : []).forEach((x) => { V3[x.id] = x; });
      if (focus && !card.hidden) addV3Sections(focus);
      peopleMini();
    }).catch(() => { V3 = {}; });
    return v3Loading;
  }
  const v3 = (id) => (V3 && V3[id]) || null;
  const fmtPct = (v) => `${Math.round(v)}%`;
  // the sections sit between How it connects and Landmarks; ink only, one line weight, direct labels, contract and source footer
  function addV3Sections(id) {
    if (!V3 || card.hidden || card.dataset.organ !== id || card.querySelector('.ax-v3')) return;
    // right after the key number, before How it connects
    const flowsUl = card.querySelector('.ax-flows'); const anchor = flowsUl && flowsUl.previousElementSibling && flowsUl.previousElementSibling.tagName === 'H3' ? flowsUl.previousElementSibling : card.querySelector('#ax-landmarks'); if (!anchor) return;
    let html = '';
    if (id === 'users') {
      const wu = v3('chatgpt_weekly_users');
      if (wu) html += `<h3>Weekly users, as stated</h3><div class="ax-v3" data-v3="wau"></div>
        <p class="ax-v3-contract">Steps hold each OpenAI statement of ChatGPT weekly users until the next, y 0 to 1.2 billion; the company publishes no running count, hover a mark for who stated it.</p>
        <p class="ax-v3-src">Company figures: <a href="${esc(wu.source_url)}" target="_blank" rel="noopener">OpenAI statements as reported by The Verge, Reuters, CNBC, TechCrunch and Moneycontrol</a> \u00b7 last reading ${esc(wu.last_reading)}</p>`;
      const polls = [
        { id: 'pew_concerned', name: 'Pew' }, { id: 'ipsos_nervous', name: 'Ipsos' }, { id: 'gallup_harm', name: 'Gallup' },
      ].map((pl) => ({ ...pl, s: v3(pl.id) })).filter((pl) => pl.s);
      if (polls.length) {
        html += `<h3>What people say</h3><div class="ax-v3" data-v3="polls"></div>
        <p class="ax-v3-contract">One line per poll, share of adults agreeing, y 0 to 60 percent, hollow marks mid-2026; wordings differ and are the pollsters' own: Pew \u201cmore concerned than excited\u201d, Ipsos \u201cmake me nervous\u201d, Gallup \u201cmore harm than good\u201d.</p>
        <p class="ax-v3-src">${polls.map((pl) => `<a href="${esc(pl.s.source_url)}" target="_blank" rel="noopener">${esc(pl.name)}</a> last reading ${esc(pl.s.last_reading)}`).join(' \u00b7 ')}</p>`;
      }
    }
    if (id === 'models') {
      const s3 = v3('open_weights_share');
      const nm = v3('notable_models_per_year');
      if (s3) html += `<h3>${nm ? 'Models released, and how many open' : 'Open weights'}</h3><div class="ax-v3 pair">${nm ? '<div data-v3="count"></div>' : ''}<div data-v3="open"></div></div>
        <p class="ax-v3-contract">${nm ? 'Left, notable models per release year, y 0 to 120; right, the share with open weights by Epoch\'s accessibility field, y 0 to 60 percent; 2026 is partial (hollow mark, dashed bar) and Epoch adds recent models with a lag.' : 'Bars are the share of notable models released in a year with open weights, by Epoch AI\'s accessibility field, y 0 to 60 percent; the 2026 bar is partial and stays hollow.'}</p>
        <p class="ax-v3-src"><a href="${esc(s3.source_url)}" target="_blank" rel="noopener">Epoch AI, notable AI models</a> last reading ${esc(s3.last_reading)}</p>`;
    }
    if (!html) return;
    const wrap = document.createElement('div'); wrap.innerHTML = html;
    [...wrap.childNodes].forEach((n) => anchor.parentNode.insertBefore(n, anchor));
    card.querySelectorAll('[data-v3]').forEach((host) => {
      const k = host.dataset.v3;
      if (k === 'polls') pollsChart(host); else if (k === 'open') openWeightsChart(host); else if (k === 'count') countChart(host); else if (k === 'wau') statementsChart(host);
    });
    spine();
  }
  const MONO = 'Instrument Sans, monospace';
  const axisText = (sv, x, y, t, anchor = 'end', fill = INK2) => sv.append('text').attr('x', x).attr('y', y).attr('dy', '0.35em').attr('text-anchor', anchor).attr('font-family', MONO).attr('font-size', 11).attr('fill', fill).text(t);
  const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(/\.0$/, '')}B` : `${m}M`);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (d) => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
  // company statements as a step line; every mark carries its figure and date, placed where no other label or line sits
  function statementsChart(host) {
    const s3 = v3('chatgpt_weekly_users'); if (!s3) return;
    const W = Math.max(260, host.clientWidth || 380), H = 160, M = { t: 18, r: 16, b: 18, l: 34 };
    const sv = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', s3.label);
    const pts = s3.points.map((p, i) => ({ d: p[0], t: new Date(p[0]).getTime(), v: p[1], who: (s3.detail && s3.detail[i] && s3.detail[i].stated_by) || '' }));
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const x = d3.scaleLinear().domain([t0, t1]).range([M.l, W - M.r]), y = d3.scaleLinear().domain([0, 1200]).range([H - M.b, M.t]);
    [0, 600, 1200].forEach((v) => { sv.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', ink(v ? 0.18 : 0.5)).attr('stroke-width', LW); axisText(sv, M.l - 6, y(v), fmtM(v)); });
    axisText(sv, x(t0), H - 4, pts[0].d.slice(0, 4), 'start'); axisText(sv, x(t1), H - 4, pts[pts.length - 1].d.slice(0, 4), 'end');
    sv.append('path').attr('d', d3.line().x((p) => x(p.t)).y((p) => y(p.v)).curve(d3.curveStepAfter)(pts)).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', LW);
    // one line per mark, figure then date; the label takes the first clear spot around the mark, lifting with a leader when the steps crowd
    const placed = [], segs = [];
    for (let i = 1; i < pts.length; i++) { segs.push({ x0: x(pts[i - 1].t), x1: x(pts[i].t), y0: y(pts[i - 1].v), y1: y(pts[i - 1].v) }); segs.push({ x0: x(pts[i].t), x1: x(pts[i].t), y0: y(pts[i].v), y1: y(pts[i - 1].v) }); }
    const hits = (bx, q) => bx.x0 < q.x1 + 3 && bx.x1 > q.x0 - 3 && bx.y0 < q.y1 + 2 && bx.y1 > q.y0 - 2;
    const clear = (bx) => bx.x0 >= M.l - 28 && bx.x1 <= W && bx.y0 >= 0 && bx.y1 <= H - M.b - 1 && !placed.some((q) => hits(bx, q)) && !segs.some((q) => hits(bx, q));
    pts.forEach((p) => {
      const px = x(p.t), py = y(p.v), fig = fmtM(p.v), date = fmtDate(p.d), w = (fig.length + 1 + date.length) * 6.7, h = 12;
      const g = sv.append('g'); g.append('title').text(`${fig} weekly users, ${date}: ${p.who}`);
      g.append('circle').attr('cx', px).attr('cy', py).attr('r', 2.2).attr('fill', INK).attr('stroke', INK).attr('stroke-width', LW);
      const cands = [];
      [0, 14, 28, 42].forEach((lift) => {
        cands.push({ x0: px - 6 - w, y0: py - 6 - h - lift, anchor: 'end', tx: px - 6, lift });
        cands.push({ x0: px + 6, y0: py - 6 - h - lift, anchor: 'start', tx: px + 6, lift });
        if (!lift) { cands.push({ x0: px + 6, y0: py + 5, anchor: 'start', tx: px + 6, lift }); cands.push({ x0: px - 6 - w, y0: py + 5, anchor: 'end', tx: px - 6, lift }); }
      });
      const c = cands.map((k) => ({ ...k, x1: k.x0 + w, y1: k.y0 + h })).find(clear) || { x0: px + 6, y0: py - 6 - h, x1: px + 6 + w, y1: py - 6, anchor: 'start', tx: px + 6, lift: 0 };
      placed.push(c);
      if (c.lift) g.append('line').attr('x1', px).attr('x2', px).attr('y1', py - 4).attr('y2', c.y1 + 1).attr('stroke', ink(0.45)).attr('stroke-width', LW);
      const tx = g.append('text').attr('x', c.tx).attr('y', c.y0 + 9.5).attr('text-anchor', c.anchor).attr('font-family', MONO).attr('font-size', 11).attr('fill', INK);
      tx.append('tspan').text(fig); tx.append('tspan').attr('fill', INK2).text(` ${date}`);
    });
  }
  // notable models per year as a line with marks; the partial year hollow with its own label
  function countChart(host) {
    const s3 = v3('notable_models_per_year'); if (!s3) return;
    const W = Math.max(180, host.clientWidth || 200), H = 120, M = { t: 14, r: 46, b: 18, l: 30 };
    const sv = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', s3.label);
    const pts = s3.points, x = d3.scaleLinear().domain(d3.extent(pts, (p) => p[0])).range([M.l, W - M.r]), y = d3.scaleLinear().domain([0, 120]).range([H - M.b, M.t]);
    [0, 60, 120].forEach((v) => { sv.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', ink(v ? 0.18 : 0.5)).attr('stroke-width', LW); axisText(sv, M.l - 6, y(v), v); });
    axisText(sv, x(2010), H - 4, '2010', 'start'); axisText(sv, x(2026), H - 4, '2026', 'end');
    sv.append('path').attr('d', d3.line().x((p) => x(p[0])).y((p) => y(p[1]))(pts)).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', LW);
    pts.forEach((p) => { const partial = p[0] === 2026; sv.append('circle').attr('cx', x(p[0])).attr('cy', y(p[1])).attr('r', partial ? 2.4 : 1.6).attr('fill', partial ? BP : INK).attr('stroke', INK).attr('stroke-width', LW).append('title').text(`${p[1]} notable models, ${p[0]}${partial ? ' (partial)' : ''}`); });
    const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a)), last = pts[pts.length - 1];
    axisText(sv, x(peak[0]), y(peak[1]) - 8, `${peak[1]} in ${peak[0]}`, 'middle', INK);
    axisText(sv, x(last[0]) + 7, y(last[1]) - 6, String(last[1]), 'start', INK); axisText(sv, x(last[0]) + 7, y(last[1]) + 7, 'so far', 'start');
  }
  function pollsChart(host) {
    const W = Math.max(260, host.clientWidth || 380), H = 120, M = { t: 10, r: 124, b: 18, l: 28 };
    const sv = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Three opinion polls on AI, 2021 to 2026');
    const polls = [
      { id: 'pew_concerned', name: 'Pew', dash: null }, { id: 'ipsos_nervous', name: 'Ipsos', dash: '4 3' }, { id: 'gallup_harm', name: 'Gallup', dash: '1 3' },
    ].map((pl) => ({ ...pl, s: v3(pl.id) })).filter((pl) => pl.s);
    const x = d3.scaleLinear().domain([2021, 2026]).range([M.l, W - M.r]), y = d3.scaleLinear().domain([0, 60]).range([H - M.b, M.t]);
    [0, 30, 60].forEach((v) => { sv.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', ink(v ? 0.18 : 0.5)).attr('stroke-width', LW); sv.append('text').attr('x', M.l - 6).attr('y', y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK2).text(v); });
    [2021, 2026].forEach((yy) => sv.append('text').attr('x', x(yy)).attr('y', H - 4).attr('text-anchor', yy === 2021 ? 'start' : 'end').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK2).text(yy));
    const line = d3.line().x((p) => x(p[0])).y((p) => y(p[1]));
    const ends = [];
    polls.forEach((pl) => {
      const pts = pl.s.points.filter((p) => p[0] >= 2021);
      sv.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', LW).attr('stroke-dasharray', pl.dash);
      pts.forEach((p) => sv.append('circle').attr('cx', x(p[0])).attr('cy', y(p[1])).attr('r', 2.2).attr('fill', p[0] === 2026 ? BP : INK).attr('stroke', INK).attr('stroke-width', LW));
      const last = pts[pts.length - 1];
      ends.push({ name: pl.name, v: last[1], yr: last[0], yy: y(last[1]), xx: x(last[0]) });
    });
    // end labels, nudged apart so none overlap
    ends.sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 13) ends[i].yy = ends[i - 1].yy + 13;
    ends.forEach((e) => sv.append('text').attr('x', e.xx + 8).attr('y', e.yy).attr('dy', '0.35em').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK).text(`${e.name} ${fmtPct(e.v)}${e.yr < 2026 ? ` (${e.yr})` : ''}`));
  }
  function openWeightsChart(host) {
    const s3 = v3('open_weights_share'); if (!s3) return;
    const W = Math.max(260, host.clientWidth || 380), H = 120, M = { t: 16, r: 8, b: 18, l: 28 };
    const sv = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Share of notable models with open weights, 2018 to 2026');
    const pts = s3.points;
    const x = d3.scaleBand().domain(pts.map((p) => p[0])).range([M.l, W - M.r]).paddingInner(0.35), y = d3.scaleLinear().domain([0, 60]).range([H - M.b, M.t]);
    [0, 30, 60].forEach((v) => { sv.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', ink(v ? 0.18 : 0.5)).attr('stroke-width', LW); sv.append('text').attr('x', M.l - 6).attr('y', y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK2).text(v); });
    pts.forEach((p) => {
      const partial = p[0] === 2026;
      // line, not shading: every bar is an outline; the partial year's outline is dashed
      sv.append('rect').attr('x', x(p[0])).attr('y', y(p[1])).attr('width', x.bandwidth()).attr('height', y(0) - y(p[1])).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', LW).attr('stroke-dasharray', partial ? '3 2' : null);
      sv.append('text').attr('x', x(p[0]) + x.bandwidth() / 2).attr('y', y(p[1]) - 4).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK).text(Math.round(p[1]));
      if (p[0] % 2 === 0 && (W >= 380 || p[0] !== 2024)) sv.append('text').attr('x', partial ? x(p[0]) + x.bandwidth() : x(p[0]) + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', partial ? 'end' : 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 11).attr('fill', INK2).text(partial ? '2026 partial' : String(p[0]).slice(2));
    });
  }
  // the People layer carries the hiring series as its small multiple; hover or focus opens the full reading in the field
  function peopleMini() {}
  function peoplePeek() {}

  function spine() {
    const body = card.querySelector('.ax-body'); if (!body) return;
    // one caveat line per chart, and the key number's, folded under a Notes disclosure (closed; the source footer stays in view)
    body.querySelectorAll('.ax-v3-contract, .ax-num .how').forEach((el) => {
      if (el.parentNode.classList.contains('ax-notes')) return;
      const det = document.createElement('details'); det.className = 'ax-notes';
      const sum = document.createElement('summary'); sum.textContent = 'Notes'; det.appendChild(sum);
      el.parentNode.insertBefore(det, el); det.appendChild(el);
    });
    // the contents row: every block head after What it is, before Landmarks (the bottom cue leads there); rebuilt when sections arrive
    const heads = [...body.querySelectorAll(':scope > h3')].filter((h) => !/^what it is/i.test(h.textContent.trim()) && h.id !== 'ax-landmarks');
    const old = body.querySelector('.ax-toc'); if (old) old.remove();
    if (heads.length < 2) return;
    const toc = document.createElement('nav'); toc.className = 'ax-toc'; toc.setAttribute('aria-label', 'In this explainer');
    heads.forEach((h, i) => {
      if (!h.id) h.id = `ax-b${i}`;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.to = h.id;
      b.textContent = h.childNodes[0].textContent.split(',')[0].trim();
      b.addEventListener('click', () => { card.scrollTo({ top: h.offsetTop - (card.querySelector('.ax-head')?.offsetHeight || 0) - toc.offsetHeight - 4, behavior: RM ? 'auto' : 'smooth' }); });
      toc.appendChild(b);
    });
    body.insertBefore(toc, body.firstChild);
    // the row stays under the head while the card scrolls
    card.style.setProperty('--ax-head-h', `${card.querySelector('.ax-head')?.offsetHeight || 0}px`);
    tocMark();
  }
  // the block in view carries the accent rule
  function tocMark() {
    const toc = card.querySelector('.ax-toc'); if (!toc) return;
    const btns = [...toc.querySelectorAll('button')], line = card.scrollTop + (card.querySelector('.ax-head')?.offsetHeight || 0) + toc.offsetHeight + 12;
    let cur = null; btns.forEach((b) => { const h = card.querySelector(`#${b.dataset.to}`); if (h && h.offsetTop <= line) cur = b; });
    btns.forEach((b) => b.classList.toggle('on', b === cur));
  }
  card.addEventListener('scroll', tocMark, { passive: true });


  /* ---------- explainer card: the evidence panel, never empty ---------- */
  // the lit organ's key figure in the title block
  function titleKey() {
    const p = el.querySelector('[data-key]');
    if (!p) return;
    const id = focus || REST, fact = factAt(db, id, yr), n = NODE[id];
    if (!fact || fact.v == null) { p.hidden = true; return; }
    p.hidden = false;
    p.innerHTML = `<b style="color:var(--ai-organ-${esc(id)}-label)">${esc(fact.fmt(fact.v))}</b> <span>${esc(fact.ks || fact.k || n.label)}</span>`;
  }
  function openCard(id, redraw = true) {
    closeWeek(false);
    flowFocus = null;
    focus = id;
    const n = NODE[id];
    const fact = factAt(db, id, yr);
    const flowInfo = (f) => ({ ...f, other: NODE[f.a === id ? f.b : f.a], note: (X.flows[f.key] || {}).note || '', layer: f.layer });
    const flowsIn = FLOWS.filter((f) => f.b === id).map(flowInfo), flowsOut = FLOWS.filter((f) => f.a === id).map(flowInfo);
    const ex = X.organs[id] || {};
    const landmarks = (ex.landmarks || []).map((eid) => db.byId.get(eid)).filter(Boolean).filter((e) => e.year <= yr);
    const list = members.get(id) || [];
    const events = (landmarks.length >= 3 ? landmarks : [...landmarks, ...list.filter((e) => !landmarks.includes(e))].slice(0, 5)).sort((a, b) => a.year - b.year);
    const color = `var(--ai-organ-${id}-label)`;
    const flowRow = (f, dir) => `<li><button type="button" data-go="${esc(f.other.id)}" style="--c:var(--ai-organ-${esc(f.other.id)}-label)"><span class="arr" aria-hidden="true">${dir === 'in' ? '&larr;' : '&rarr;'}</span><b>${esc(f.other.label)}</b><span class="fl">${esc(f.label)}</span><span class="ly">${esc(f.layer)}</span></button>${f.note ? `<p>${esc(f.note)}</p>` : ''}</li>`;
    const num = fact && fact.v != null ? `<p class="anx-num"><b>${esc(fact.fmt(fact.v))}</b><span>${esc(fact.k || '')}</span></p>` : `<p class="anx-num"><span>${esc((fact && fact.text) || 'no figure for this year')}</span></p>`;
    const src = fact && fact.src ? `<p class="anx-src">Source: <a href="${esc(fact.src.url)}" target="_blank" rel="noopener">${esc(fact.src.title && fact.src.title.length < 70 ? fact.src.title : host(fact.src.url))}</a></p>` : '';
    const how = (ex.number && ex.number.how) || '';
    const html = `<div class="anx" style="--c:${color}">
      ${(ex.what || []).map((t) => `<p class="summary">${esc(t)}</p>`).join('')}
      <div class="sect-h"><span>Key number, ${yr}</span></div>
      ${num}${src}${how ? `<details class="anx-notes"><summary>Notes</summary><p>${esc(how)}</p></details>` : ''}
      <div class="sect-h"><span>How it connects</span><span>${flowsIn.length + flowsOut.length}</span></div>
      <ul class="anx-flows">${flowsIn.map((f) => flowRow(f, 'in')).join('')}${flowsOut.map((f) => flowRow(f, 'out')).join('')}</ul>
      <div class="sect-h"><span>Landmarks</span><span>${list.length} in the record</span></div>
      <ul class="links anx-ev">${events.map((e) => `<li><button type="button" data-id="${esc(e.id)}"><i style="background:${color}"></i><span class="y">${e.year}</span><span class="t">${esc(e.title)}</span></button></li>`).join('')}</ul>
    </div>`;
    openEvidence(`anatomy:${id}`, {
      kicker: `<span class="ki">Organ</span><span class="ki" style="color:${color}">${esc(n.organ)}</span>`,
      title: n.label, sub: `${list.length} events, ${Y_LO} to ${yr}`, html,
      onMount(body) { body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openCard(b.dataset.go))); },
    });
    light();
    titleKey();
  }
  function moreCue() {
    const more = card.querySelector('.ax-more'); const lm = card.querySelector('#ax-landmarks');
    if (!more) return;
    const atEnd = card.scrollTop + card.clientHeight >= card.scrollHeight - 12;
    const lmSeen = lm && lm.offsetTop < card.scrollTop + card.clientHeight - 40;
    more.classList.toggle('hide', atEnd || !!lmSeen || card.scrollHeight <= card.clientHeight + 4);
  }
  card.addEventListener('scroll', moreCue, { passive: true });
  const cardOpen = () => !card.hidden;
  // the panel is never empty: closing returns it to Labs
  function closeCard() { openCard(REST, false); }
  card.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-close]')) { const o = focus; closeCard(); if (o) gBlocks.select(`g.block[data-id="${REST}"]`).node()?.focus({ preventScroll: true }); return; }
    const more = ev.target.closest('[data-more]');
    if (more) { const lm = card.querySelector('#ax-landmarks'); if (lm) card.scrollTo({ top: lm.offsetTop - (card.querySelector('.ax-head')?.offsetHeight || 0) - 8, behavior: RM ? 'auto' : 'smooth' }); return; }
    const go = ev.target.closest('[data-go]');
    if (go) { openCard(go.dataset.go); return; }
    const evb = ev.target.closest('[data-ev]');
    if (evb) select(evb.dataset.ev);
  });
  card.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hiEvent(b.dataset.ev); });
  card.addEventListener('mouseout', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hiEvent(null); });

  /* ---------- flow panel: one flow's magnitude over the years, draggable to scrub ---------- */
  function openFlow(f, redraw = true) {
    closeWeek(false);
    focus = null; flowFocus = f.key;
    const na = NODE[f.a], nb = NODE[f.b];
    const note = (X.flows[f.key] || {}).note || '';
    const ser = f.mag ? flowSeries(db, f.mag) : null;
    const pts = ser ? ser.points.filter((p) => p.year >= Y_LO - 7 && p.year <= Y_HI).sort((a, b) => a.year - b.year) : [];
    const cur = pts.filter((p) => p.year <= yr).pop();
    const spark = pts.length ? `<div class="anx-spark" role="slider" aria-label="Year" aria-valuemin="${Y_LO}" aria-valuemax="${Y_HI}" aria-valuenow="${yr}" tabindex="0"></div>
        <p class="anx-num"><b data-sv>${cur ? esc(fmtFlowValue(cur.value, ser.unit)) : 'no figure'}</b><span data-sk>${cur ? esc(`${ser.name}, ${cur.year}`) : esc(`${ser.name}: nothing before ${pts[0].year}`)}</span></p>
        ${ser.src ? `<p class="anx-src">Source: <a href="${esc(ser.src.url)}" target="_blank" rel="noopener">${esc(ser.src.title && ser.src.title.length < 70 ? ser.src.title : host(ser.src.url))}</a></p>` : ''}` : '<p class="summary">No figures behind this flow; the pipe is drawn dashed.</p>';
    const html = `<div class="anx" style="--c:${na.color}">
      ${note ? `<p class="summary">${esc(note)}</p>` : ''}
      <div class="sect-h"><span>Over time</span></div>
      ${spark}
      <div class="sect-h"><span>Between</span></div>
      <ul class="anx-flows"><li><button type="button" data-go="${esc(na.id)}" style="--c:${na.color}"><span class="arr" aria-hidden="true">&larr;</span><b>${esc(na.label)}</b><span class="fl">${esc(na.organ)}</span></button></li><li><button type="button" data-go="${esc(nb.id)}" style="--c:${nb.color}"><span class="arr" aria-hidden="true">&rarr;</span><b>${esc(nb.label)}</b><span class="fl">${esc(nb.organ)}</span></button></li></ul>
    </div>`;
    openEvidence(`anatomy:flow:${f.key}`, {
      kicker: `<span class="ki">Flow</span><span class="ki">${esc(f.layer)}</span>`,
      title: `${na.label} to ${nb.label}`, sub: f.label, html,
      onMount(body) {
        body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openCard(b.dataset.go)));
        const sp = body.querySelector('.anx-spark'); if (sp) sparkline(sp, pts, ser);
      },
    });
    light();
  }
  function sparkline(host, pts, ser) {
    const W = Math.max(200, host.clientWidth || 260), H = 72, M = { l: 6, r: 6, t: 10, b: 18 };
    const log = ser.unit === 'FLOP' || ser.unit === 'US$' && d3.max(pts, (p) => p.value) / Math.max(1e-9, d3.min(pts, (p) => p.value)) > 50;
    const x = d3.scalePoint().domain(pts.map((p) => p.year)).range([M.l, W - M.r]);
    const y = (log ? d3.scaleLog() : d3.scaleLinear()).domain([log ? d3.min(pts, (p) => p.value) : 0, d3.max(pts, (p) => p.value)]).range([H - M.b, M.t]);
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const c = '#121212'; // the evidence panel is paper
    svg.append('path').attr('d', d3.line().x((p) => x(p.year)).y((p) => y(p.value)).curve(d3.curveMonotoneX)(pts)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.6);
    svg.append('path').attr('d', d3.area().x((p) => x(p.year)).y0(H - M.b).y1((p) => y(p.value)).curve(d3.curveMonotoneX)(pts)).attr('fill', c).attr('fill-opacity', 0.12);
    svg.selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.year)).attr('cy', (p) => y(p.value)).attr('r', 2.2).attr('fill', c);
    pts.filter((p, i) => i === 0 || i === pts.length - 1 || p.year % 3 === 0).forEach((p) => svg.append('text').attr('x', x(p.year)).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-family', 'Instrument Sans, monospace').attr('font-size', 10.5).attr('fill', '#6b6b6b').text(String(p.year).slice(2)));
    const mk = svg.append('g').attr('class', 'mk');
    mk.append('line').attr('y1', M.t - 4).attr('y2', H - M.b).attr('stroke', '#121212').attr('stroke-width', LW);
    mk.append('circle').attr('r', 3).attr('fill', ACC());
    const place = () => { const p = pts.filter((q) => q.year <= yr).pop() || pts[0]; mk.attr('transform', `translate(${x(p.year)},0)`); mk.select('circle').attr('cy', y(p.value)); host.setAttribute('aria-valuenow', yr); const v = card.querySelector('[data-sv]'), k = card.querySelector('[data-sk]'); if (v && k) { const q = pts.filter((z) => z.year <= yr).pop(); v.textContent = q ? fmtFlowValue(q.value, ser.unit) : 'no figure'; k.textContent = q ? `${ser.name}, ${q.year}` : `${ser.name}: nothing before ${pts[0].year}`; } };
    place();
    const toYear = (px) => { const yrs = pts.map((p) => p.year); const nearest = yrs.reduce((a, b) => (Math.abs(x(b) - px) < Math.abs(x(a) - px) ? b : a)); return Math.max(Y_LO, Math.min(Y_HI, nearest)); };
    svg.style('cursor', 'ew-resize').call(d3.drag().on('start drag', (ev) => { const ny = toYear(ev.x); if (ny !== yr) setYear(ny); place(); }));
    host.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); setYear(Math.max(Y_LO, Math.min(Y_HI, yr + (ev.key === 'ArrowRight' ? 1 : -1)))); } });
    sparkline.place = place;
  }


  /* ---------- controls ---------- */
  ctl.addEventListener('click', (ev) => {
    const lb = ev.target.closest('[data-layer]');
    if (lb) { const id = lb.dataset.layer; if (layersOff.has(id)) layersOff.delete(id); else layersOff.add(id); lb.setAttribute('aria-pressed', String(!layersOff.has(id))); applyLayers(); return; }
    if (ev.target.closest('[data-play]')) { if (playT) stopPlay(); else startPlay(); return; }
    const q = ev.target.closest('[data-q]');
    if (q) { const [o, y] = q.dataset.q.split(':'); setYear(+y); openCard(o); }
  });
  yrIn.addEventListener('input', () => { setYear(+yrIn.value); });
  function setYear(y, fromPlay = false) {
    if (!fromPlay && playT) stopPlay();
    yr = y;
    yrIn.value = y; yrIn.setAttribute('aria-valuetext', String(y)); yrOut.textContent = y; yrH.textContent = y;
    footer();
    if (drawn) refresh();
    if (focus && S.sel === `anatomy:${focus}`) openCard(focus, false);
    else if (flowFocus && sparkline.place) sparkline.place();
    titleKey();
  }
  function startPlay() {
    const btn = ctl.querySelector('[data-play]');
    btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true');
    let y = yr >= Y_HI ? Y_LO - 1 : yr;
    const step = () => { y += 1; setYear(y, true); if (y >= Y_HI) stopPlay(); };
    step();
    playT = setInterval(step, RM ? 600 : 1100);
  }
  function stopPlay() {
    clearInterval(playT); playT = null;
    const btn = ctl.querySelector('[data-play]');
    if (btn) { btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); }
  }

  /* ---------- this week: the records dated within seven days of the record's newest date ---------- */
  const weekBtn = el.querySelector('[data-week]'), weekPop = el.querySelector('.an-week-pop');
  function weekLine() {
    const R = recent();
    if (!R.latest) { weekBtn.hidden = true; return; }
    const n = R.week.length;
    weekBtn.hidden = false;
    const headEl = el.querySelector('.anat-head'), hb = headEl ? headEl.offsetHeight : 0;
    // the week is named by its dates, computed from the record: the seven days to its newest date
    const span = weekSpan(R);
    weekBtn.querySelector('.an-week-n').textContent = n === 0 ? `none new, ${span}` : `${n} new, ${span}`;
    // the title block may have grown or shrunk a line; the rail starts under it
    if (drawn && !mobile && headEl && headEl.offsetHeight !== hb) { layout(); if (!drawing) draw(); }
    weekBtn.title = `Records dated ${span}, ${R.year}, within seven days of ${fmtDay(R.latest)}, the newest date in the record (not today)${R.month.length ? `; ${R.month.length} more within thirty days` : ''}`;
  }
  // "Oct 16 to 23", or "Sep 28 to Oct 4" across a month edge
  function weekSpan(R) {
    const a = new Date(R.weekFrom), b = new Date(R.latest);
    return a.getUTCMonth() === b.getUTCMonth() ? `${fmtDay(R.weekFrom)} to ${b.getUTCDate()}` : `${fmtDay(R.weekFrom)} to ${fmtDay(R.latest)}`;
  }
  function weekList() {
    const R = recent();
    const row = (e) => {
      const srcs = (e.sources || []).slice(0, 3);
      return `<li><button type="button" data-ev="${esc(e.id)}"><span class="d">${esc(fmtEv(e).replace(/ \d{4}$/, ''))}</span><span class="t">${esc(e.title)}</span></button>${srcs.length ? `<span class="s">${srcs.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title || x.url)}">${esc(host(x.url))}</a>`).join('')}</span>` : db.loaded.has('text') ? '' : '<span class="s muted">sources loading</span>'}</li>`;
    };
    weekPop.innerHTML = `<div class="wk-head"><span class="sc">This week <span aria-hidden="true">&middot;</span> ${esc(weekSpan(R))}, ${R.year}</span><button type="button" class="wk-x" data-close aria-label="Close">&times;</button></div>
      <p class="wk-lede">${R.week.length} record${R.week.length === 1 ? '' : 's'} dated ${esc(weekSpan(R))}, within seven days of the record's newest date. Open one for its summary and sources.</p>
      <ol class="wk-list">${R.week.map(row).join('')}</ol>
      ${R.month.length ? `<p class="wk-month"><span class="sc">Last thirty days</span> ${R.month.length} more record${R.month.length === 1 ? '' : 's'}, ${esc(fmtDay(R.monthFrom))} to ${esc(fmtDay(R.weekFrom))}</p><ol class="wk-list soft">${R.month.slice(0, 12).map(row).join('')}${R.month.length > 12 ? `<li class="more">and ${R.month.length - 12} more</li>` : ''}</ol>` : ''}`;
  }
  function openWeek() {
    weekList();
    weekPop.hidden = false;
    weekBtn.setAttribute('aria-expanded', 'true');
    if (!db.loaded.has('text')) ensure('text').then(() => { if (!weekPop.hidden) weekList(); });
    weekPop.querySelector('.wk-x').focus({ preventScroll: true });
  }
  function closeWeek(refocus = true) {
    if (weekPop.hidden) return;
    weekPop.hidden = true;
    weekBtn.setAttribute('aria-expanded', 'false');
    if (refocus) weekBtn.focus({ preventScroll: true });
  }
  weekBtn.addEventListener('click', () => (weekPop.hidden ? openWeek() : closeWeek()));
  weekPop.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-close]')) { closeWeek(); return; }
    const b = ev.target.closest('[data-ev]');
    if (b) select(b.dataset.ev);
  });
  weekPop.addEventListener('mouseover', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hiEvent(b.dataset.ev); });
  weekPop.addEventListener('mouseout', (ev) => { const b = ev.target.closest('[data-ev]'); if (b) hiEvent(null); });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !weekPop.hidden && !S.sel) { ev.stopPropagation(); closeWeek(); } });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && flowFocus && !S.sel) { ev.stopPropagation(); closeCard(); gBlocks.select(`g.block[data-id="${REST}"]`).node()?.focus({ preventScroll: true }); } });
  el.addEventListener('pointerdown', (ev) => { if (!weekPop.hidden && !weekPop.contains(ev.target) && !weekBtn.contains(ev.target)) closeWeek(false); });

  /* ---------- the reveal: blocks rise in stagger, pipes draw, the amber organ grows into focus, then still ---------- */
  function reveal() {
    if (revealed || RM) { revealed = true; return; }
    revealed = true;
    el.classList.add('revealing');
    const blocksSel = gBlocks.selectAll('g.block');
    blocksSel.style('opacity', 0).attr('transform', 'translate(0,14)');
    blocksSel.transition().delay((n, i) => 60 + i * 45).duration(400).ease(d3.easeCubicOut).style('opacity', 1).attr('transform', 'translate(0,0)');
    const pipeDelay = 60 + ORDER.length * 45;
    // the pipes draw on piece by piece along each route
    const perKey = {};
    PIECES.forEach((d) => { perKey[d.f.key] = (perKey[d.f.key] || 0) + 1; });
    const seen = {};
    gPipes.selectAll('g.pipe').each(function (d) {
      const k = seen[d.f.key] = (seen[d.f.key] || 0) + 1;
      d3.select(this).style('opacity', 0).transition().delay(pipeDelay + (k / perKey[d.f.key]) * 450).duration(100).style('opacity', 1);
    });
    const focusAt = pipeDelay + 520;
    gLead.style('opacity', 0).transition().delay(focusAt).duration(300).style('opacity', 1);
    gLabels.style('opacity', 0).transition().delay(focusAt).duration(300).style('opacity', 1);
    el.classList.remove('lit-ready');
    setTimeout(() => { el.classList.add('lit-ready'); el.classList.remove('revealing'); }, focusAt);
  }

  /* ---------- lifecycle ---------- */
  function render(state, ch) {
    if (ch.has('*')) {
      layout();
      const first = !drawn;
      if (first) {
        // a shared link's selection wins; otherwise Labs, opened in the evidence panel (on compact screens, on tap)
        const sel = String(S.sel || '');
        if (sel.startsWith('anatomy:flow:') && FLOWS.some((f) => f.key === sel.slice(13))) flowFocus = sel.slice(13);
        else if (sel.startsWith('anatomy:') && NODE[sel.slice(8)]) focus = sel.slice(8);
        else focus = REST;
      }
      if (first) { syncLane(); titleKey(); }
      draw(first);
      // the panel opens on a tap, Enter or a deep link; arrival only lights Labs and shows its figure in the title block
      if (flowFocus && S.sel === `anatomy:flow:${flowFocus}`) openFlow(FLOWS.find((f) => f.key === flowFocus), false);
      else if (focus && S.sel === `anatomy:${focus}`) openCard(focus, false);
      else light();
      titleKey();
      drawn = true;
      weekLine(); loadV3();
      if (first) { if (RM || revealed) el.classList.add('lit-ready'); else reveal(); }
    } else if (ch.has('y0') || ch.has('y1') || ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q') || ch.has('events')) {
      footer(); refresh(); if (focus && S.sel === `anatomy:${focus}`) openCard(focus, false);
    }
  }
  // the stage keeps out of the evidence panel's lane while the drawer is open (read from the drawer itself, so a deep
  // link's first paint counts too); the resize observer below relayouts when the width changes
  const drawerEl = document.getElementById('drawer');
  const syncLane = () => { const on = !!(drawerEl && drawerEl.classList.contains('on')); if (el.classList.contains('lane') !== on) el.classList.toggle('lane', on); };
  if (drawerEl && typeof MutationObserver !== 'undefined') new MutationObserver(syncLane).observe(drawerEl, { attributes: true, attributeFilter: ['class'] });
  syncLane();
  // the title block's height settles once the faces load; lay out again then so the margin labels start below it
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (drawn) render(S, new Set(['*'])); });
  let lastW = 0, lastT = 0, roT = 0;
  if (typeof ResizeObserver !== 'undefined') {
    const relayout = () => { clearTimeout(roT); roT = setTimeout(() => render(S, new Set(['*'])), 60); };
    new ResizeObserver(() => { const w = stage.getBoundingClientRect().width; if (!drawn || Math.abs(w - lastW) < 2) { lastW = w; return; } lastW = w; relayout(); }).observe(stage);
    // the title block grows when its key figure lands or the faces load; the margin labels start below it
    new ResizeObserver(() => { const t = el.querySelector('.ai-title').getBoundingClientRect().height; if (!drawn || Math.abs(t - lastT) < 2) { lastT = t; return; } lastT = t; relayout(); }).observe(el.querySelector('.ai-title'));
  }
  return { render, resize() { render(S, new Set(['*'])); }, hover(id) { hiEvent(id); } };
}
