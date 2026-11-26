// AI · Now (#v=now, screens 1 and 2): the present, printed. The day's front page run through a risograph: four inks
// built as families on the Now paper, hot and dense, the crowding of 2017 to 2026 felt before it is read.
//
// Screen 1, the wall: every AI event in the record is a label printed in its ink (ultramarine for models and
// products, orange for money and compute, teal for rules and policy, pink for people and incidents), stacked by
// period into solid ink columns; the eighteen latest labels of each column are knocked out in paper at 11px, the
// rest are texture that multiplies into deeper ink where it overlaps; 2024 to 2026 rise past the top edge. The
// headline says what the wall means; three printed stamps across the top carry the lead figures, each in its ink.
// Screen 2, the rate sheet: seven printed cards (numeral, one line, a small ink chart where a series exists) and two
// double-width chart cards (US households; ChatGPT worldwide). Motion is print passes: ultramarine first, left to
// right accelerating through the 2020s, then orange, teal and pink on three beats, the headline's second pass last.
//
// Data: data/series_v3.json, data/compute_limits.json (the token and capex figures, so Now and Money agree), the
// record (events with domain ai), the benchmarks file (crossed the human line), db.series adoption (US households).
import { esc, tip } from '../ui.js';
import { db, ensure } from '../data.js';
import { set } from '../store.js';
import { diffusion } from './patterns_calc.js';
import { humanLineCount } from './benchmarks.js';
import { createViz, num } from './ai_viz.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TICKER = { Amazon: 'AMZN', Alphabet: 'GOOG', Meta: 'META', Microsoft: 'MSFT' };
const RECORD = /\b(record|largest|biggest|first|fastest|most)\b/i;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace(/\d/g, (c) => SUP[+c]);
const sci = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; return `${+m.toFixed(1)} × 10${sup(e)}`; };
const tOf = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
const when = (d) => { if (d == null) return ''; const [y, m, dd] = String(d).split('-').map(Number); return m ? (dd ? `${dd} ${MON[m - 1]} ${y}` : `${MON[m - 1]} ${y}`) : String(y); };
const yearOf = (d) => +String(d).slice(0, 4);
const pct = (v) => `${num(v)}%`;
const yrs = (v) => { const r = Math.round(v * 10) / 10; return `${num(r, Number.isInteger(r) ? 0 : 1)} ${r === 1 ? 'year' : 'years'}`; };
const urlOf = (x) => (!x ? '' : typeof x === 'string' ? x : x.url || x.source_url || (x.source && (typeof x.source === 'string' ? x.source : x.source.url)) || (Array.isArray(x.sources) && x.sources[0] && x.sources[0].url) || '');
const SHORT_HOST = { 'moneycontrol.com': 'Moneycontrol', 'aboutamazon.com': 'Amazon IR', 'federalregister.gov': 'Federal Register', 'openai.com': 'OpenAI pricing', 'news.crunchbase.com': 'Crunchbase News', 'iea.org': 'IEA', 'epoch.ai': 'Epoch AI', 'pewresearch.org': 'Pew' };
const host = (u) => { try { const h = new URL(u).hostname.replace(/^www\./, '').split('.'); return h.length > 2 && !/^(co|com|org|ac|gov)$/.test(h[h.length - 2]) ? h.slice(-2).join('.') : h.join('.'); } catch { return ''; } };
const shortHost = (u) => { const h = host(u); return SHORT_HOST[h] || h; };
const SRC = { frontier_training_compute: 'Epoch AI', datacenter_electricity_v3: 'IEA', api_price_frontier: 'vendor price pages', chatgpt_weekly_users: 'company statement', gpu_export_scope: 'Federal Register', ai_share_venture: 'Crunchbase', ai_incidents: 'AI Index 2026', pew_concerned: 'Pew' };
const manifestLists = (f) => { const man = db.manifest || {}; return (Array.isArray(man.optional) && man.optional.includes(f)) || (man.sizes && man.sizes[f] != null); };
const optional = (f) => { if (!manifestLists(f)) return Promise.resolve(null); const man = db.manifest || {}; return fetch(`data/${f}${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null); };
const pickNum = (f, ...keys) => { for (const k of keys) if (typeof f[k] === 'number') return f[k]; return Object.values(f).find((v) => typeof v === 'number'); };
const FRAC = ['', 'one', 'two', 'three', 'four'];

export const SCREENS = [{ id: 'wall', title: 'The wall' }, { id: 'rates', title: 'The rate sheet' }];

export default function aiNow(el, ctx = {}) {
  const { select, openEvidence } = ctx;
  el.classList.add('nw-view', 'scroll-y');
  const $ = (s) => el.querySelector(s);
  const viz = createViz('nw-viz');
  const { vz } = viz;
  let V3 = null, built = false, screen = 1;
  const series = (id) => (V3 ? V3.find((s) => s.id === id) : null);
  const last = (s) => (s && s.points && s.points.length ? s.points[s.points.length - 1] : null);

  el.innerHTML = `
    <section class="nw-screen nw-wall" data-screen="1" aria-labelledby="nw-h1">
      <div class="nw-wallbox" data-chart role="img"><div class="nw-cols"></div><div class="nw-axis"></div></div>
      <header class="nw-head">
        <h1 class="nw-h1" id="nw-h1"></h1>
        <p class="nw-sub"></p>
      </header>
      <ol class="nw-key" aria-label="Domain key"></ol>
      <ol class="nw-stamps"></ol>
    </section>
    <section class="nw-screen nw-sheet" data-screen="2" aria-labelledby="nw-h2" hidden>
      <h2 class="nw-h2" id="nw-h2">Cheaper every year.<br>Hungrier every year.</h2>
      <ol class="nw-cards"></ol>
    </section>`;

  /* ---------- the figures ---------- */
  function figures(lim) {
    const F = {};
    const items = lim ? lim.items || lim.limits || [] : [];
    const wu = series('chatgpt_weekly_users');
    if (wu) { const L = last(wu), d = (wu.detail || []).find((x) => x.date === L[0]); F.users = { id: 'users', figure: num(L[1] / 1000, 1), unit: 'billion', meaning: 'people use ChatGPT every week', date: when(L[0]), url: (d && d.source_url) || wu.source_url, source: shortHost((d && d.source_url) || wu.source_url) || SRC.chatgpt_weekly_users, mark: vz({ type: 'line', pts: wu.points, zero: true, bare: true, h: 60 }), view: 'anatomy', title: `${num(wu.points[0][1])} million in ${when(wu.points[0][0])} to ${num(L[1])} million in ${when(L[0])}${d && d.stated_by ? `, stated by ${d.stated_by}` : ''}` }; }
    const ft = series('frontier_training_compute');
    if (ft) { const L = last(ft), prev = ft.points.find((p) => p[0] === L[0] - 1), ratio = prev ? L[1] / prev[1] : null; const about2 = ratio && ratio > 1.75 && ratio < 2.25; F.compute = { id: 'compute', figure: ratio ? `${about2 ? 2 : num(ratio, 1)}×` : sci(L[1]), unit: '', meaning: ratio ? `biggest training run ${about2 ? 'doubled' : 'grew'} yearly` : 'operations in the largest run', date: String(L[0]), url: ft.source_url, source: SRC.frontier_training_compute, cviz: vz({ type: 'line', pts: ft.points, log: true, bare: true, h: 40 }), view: 'anatomy', title: `${sci(L[1])} FLOP in ${L[0]}` }; }
    const dc = series('datacenter_electricity_v3');
    if (dc) { const p = dc.points.filter((x) => x[0] <= 2025).pop(); F.power = { id: 'power', figure: num(p[1]), unit: 'TWh', meaning: 'of electricity to data centres', date: String(p[0]), url: urlOf(dc) || dc.source_url, source: SRC.datacenter_electricity_v3, cviz: vz({ type: 'line', pts: dc.points.filter((x) => x[0] <= 2025), zero: true, bare: true, h: 40 }), view: 'anatomy' }; }
    const tp = items.find((x) => x.id === 'token_price');
    const tpe = tp && tp.figure && typeof tp.figure === 'object' ? Object.entries(tp.figure).filter(([k, x]) => typeof x === 'number' && /^\d{4}-\d{2}\s/.test(k)) : [];
    const ap = series('api_price_frontier');
    if (tpe.length > 1) { const [k0, v0] = tpe[0]; let v1 = tpe[1][1]; for (const e of tpe.slice(1)) if (e[1] < v1) v1 = e[1]; F.price = { id: 'price', figure: `${Math.round(v0 / v1)}×`, unit: '', meaning: `cheaper frontier tokens since ${k0.slice(0, 4)}`, date: `${k0.slice(0, 4)} to ${new Date().getFullYear()}`, url: urlOf(tp) || (ap && ap.source_url), source: shortHost(urlOf(tp) || (ap && ap.source_url)) || SRC.api_price_frontier, cviz: ap && ap.points && ap.points.length > 1 ? vz({ type: 'step', pts: ap.points, log: true, bare: true, h: 40 }) : '', view: 'anatomy' }; }
    const capex = items.find((x) => x.id === 'hyperscaler_capex');
    const capexBn = capex && capex.figure && typeof capex.figure === 'object' ? pickNum(capex.figure, '2025_actual_bn', '2025_cash_capex_bn_sum') : null;
    if (capexBn) { const pc = capex.figure.per_company_2025_bn || {}; const vals = Object.entries(pc).filter(([, v]) => typeof v === 'number').map(([k, v]) => { const n = k.split(/[\s(]/)[0]; return { k: TICKER[n] || n, v }; }).sort((a, b) => b.v - a.v); F.capex = { id: 'capex', figure: `$${num(capexBn)}`, unit: 'billion', meaning: 'in capital spending across four companies in 2025', note: 'Amazon, Microsoft, Alphabet and Meta. Includes spending beyond AI; reporting periods and accounting definitions differ.', date: '2025', url: urlOf(capex), source: shortHost(urlOf(capex)), mark: vals.length ? vz({ type: 'bars', vals, hi: 'max', fmt: (v) => num(v), bare: true, h: 60 }) : '', view: 'capital', title: vals.map((v) => `${v.k} $${num(v.v)} bn`).join(', ') }; }
    const B = db.benchmarks && (Array.isArray(db.benchmarks) ? db.benchmarks : db.benchmarks.benchmarks);
    if (B && B.length) { const { crossed, withHuman } = humanLineCount(db); F.human = { id: 'human', figure: `${crossed} of ${withHuman}`, unit: '', meaning: 'benchmarks with a human baseline are past it', source: 'Benchmarks', mark: vz({ type: 'squares', n: withHuman, k: crossed, size: 14, h: 60 }), view: 'benchmarks', title: `${crossed} of the ${withHuman} benchmarks with a published human baseline have a record at or past it` }; }
    const gs = series('gpu_export_scope');
    if (gs) { const L = last(gs); F.export = { id: 'export', figure: num(L[1]), unit: '', meaning: 'countries need US chip licences', date: when(L[0]), url: gs.source_url, source: SRC.gpu_export_scope, view: 'policy' }; }
    const vs = series('ai_share_venture');
    if (vs) { const L = last(vs), d = (vs.detail || []).find((x) => x.year === L[0]); F.venture = { id: 'venture', figure: pct(L[1]), unit: '', meaning: 'of venture money to AI', date: String(L[0]), url: (d && d.source_url) || vs.source_url, source: SRC.ai_share_venture, cviz: vz({ type: 'line', pts: vs.points, zero: true, bare: true, h: 40 }), view: 'capital' }; }
    const inc = series('ai_incidents');
    if (inc) { const L = last(inc); F.incidents = { id: 'incidents', figure: num(L[1]), unit: '', meaning: 'incidents reported last year', date: String(L[0]), url: urlOf(inc) || inc.source_url, source: SRC.ai_incidents, cviz: vz({ type: 'line', pts: inc.points, zero: true, bare: true, h: 40 }), view: 'policy' }; }
    const pw = series('pew_concerned');
    if (pw) { const L = last(pw); F.pew = { id: 'pew', figure: pct(L[1]), unit: '', meaning: 'US adults \u201cmore concerned than excited\u201d', date: String(L[0]), url: urlOf(pw) || pw.source_url, source: SRC.pew_concerned, view: 'anatomy' }; }
    return F;
  }
  // The three stamps across the top of the wall: who (people using it every week), what (benchmarks past the human
  // line), how much (the money behind the build); each in its own ink with the chart as a 60px mark beside the numeral.
  const LEADS = ['users', 'human', 'capex'];
  const INDEX = ['compute', 'power', 'price', 'export', 'venture', 'incidents', 'pew'];
  const INK_OF = { users: 'u', human: 't', capex: 'o', compute: 'u', power: 'o', price: 'o', export: 't', venture: 'o', incidents: 'p', pew: 'p' };
  const STAMP_LINE = { users: 'weekly ChatGPT users', human: 'benchmarks past the human line', capex: 'capital spending, four companies, 2025' };
  const CARD_LINE = { compute: 'training run doubles yearly', power: 'to data centres', price: 'cheaper tokens since 2023', export: 'countries need US licences', venture: 'of venture money to AI', incidents: 'incidents reported last year', pew: 'adults more concerned than excited' };
  const srcLine = (f) => `${f.date ? `${esc(f.date)} &middot; ` : ''}${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>` : esc(f.source || '')}`;
  const stamp = (f, i) => `<li class="nw-stamp ink-${INK_OF[f.id] || 'u'}" style="--i:${i}" data-view="${esc(f.view || '')}"${f.title ? ` title="${esc(f.title)}"` : ''}>
      <div class="nw-stamprow"><b class="nw-num">${esc(f.figure).replace(/^(\S+) of (\S+)$/, '$1<small>of</small>$2')}</b>${f.mark || ''}</div>
      <span class="nw-unit">${f.unit ? `${esc(f.unit)} ` : ''}${esc(STAMP_LINE[f.id] || f.meaning)}</span>
      <p class="nw-src">${srcLine(f)}</p>
    </li>`;
  const stampWait = (k, i) => `<li class="nw-stamp nw-wait ink-${INK_OF[k] || 'u'}" style="--i:${i}" data-wait="${k}"><div class="nw-stamprow"><b class="nw-num">&nbsp;</b></div><span class="nw-unit">${esc(STAMP_LINE[k])}</span><p class="nw-src">on its way</p></li>`;
  const card = (f, i) => `<li class="nw-card ink-${INK_OF[f.id] || 'u'}" style="--i:${i}" data-view="${esc(f.view || '')}"${f.title ? ` title="${esc(f.title)}"` : ''}>
      <b class="nw-cnum">${esc(f.figure)}</b>
      <p class="nw-cline">${f.unit ? `${esc(f.unit)} ` : ''}${esc(CARD_LINE[f.id] || f.meaning)}</p>
      ${f.cviz || ''}
    </li>`;

  /* ---------- the wall ---------- */
  // each event takes the ink of its organ (the Anatomy's rules, first match wins): ultramarine for models, labs and
  // products; teal for policy, data and users; orange for energy and chips; pink for capital and talent
  const rx = (re) => (e) => re.test(e.title);
  const has = (e, ...tags) => tags.some((t) => (e.tags || []).includes(t));
  const orgRe = /OpenAI|DeepMind|Anthropic|Google Brain|Meta AI|FAIR|xAI|Mistral|DeepSeek|Microsoft Research|Baidu|Alibaba|Moonshot|Zhipu|Cohere|Inflection/i;
  const ORGANS = [
    ['models', (e) => has(e, 'reasoning-models') || (['transformer', 'foundation', 'agentic', 'deep'].includes(e.ai_era) && ['product', 'milestone', 'invention', 'discovery', 'concept'].includes(e.type)) || rx(/\bGPT|\bmodel\b|Claude|Gemini|Llama|BERT|transformer|AlphaFold|diffusion/i)(e)],
    ['labs', (e) => (e.orgs || []).some((o) => orgRe.test(o)) || rx(orgRe)(e)],
    ['chips', (e) => has(e, 'geopolitics-chips', 'moores-law', 'china-ai') && rx(/chip|semiconductor|export|GPU|Nvidia|Huawei|TSMC/i)(e) || rx(/\bchip|GPU|TPU|Nvidia|TSMC|semiconductor|ASML|CUDA|H100|Blackwell/i)(e)],
    ['energy', (e) => has(e, 'energy-demand', 'data-centers') || rx(/data ?cent|electric|nuclear|power grid|gigawatt|\bGW\b|energy|Stargate|power plant|reactor/i)(e)],
    ['data', (e) => has(e, 'privacy', 'copyright', 'surveillance') || rx(/\bdata\b|dataset|ImageNet|corpus|Common Crawl|training data|scrap/i)(e)],
    ['talent', (e) => e.type === 'person' || has(e, 'labor') || rx(/researcher|hired|talent|leaves|departs|co-?found|PhD|students/i)(e)],
    ['capital', (e) => (e.type === 'market' && !rx(/chip|GPU/i)(e)) || has(e, 'bubble', 'funding') || rx(/invest|funding|valuation|\bIPO\b|billion|market cap|acquire|stock/i)(e)],
    ['products', (e) => has(e, 'coding-agents') || (e.type === 'product' && !rx(/model|GPT-\d|weights/i)(e)) || rx(/ChatGPT|assistant|Copilot|\bagents?\b|Claude Code|Codex|Cursor|chatbot/i)(e)],
    ['users', (e) => has(e, 'democratization', 'misinformation') || (e.type === 'culture' && e.year >= 2010) || rx(/\busers\b|adoption|million people|weekly|students|survey|poll/i)(e)],
    ['policy', (e) => e.type === 'policy' || has(e, 'regulation') || (e.type === 'incident' && has(e, 'safety')) || rx(/\bAct\b|executive order|regulat|ban\b|court|ruling|lawsuit|sues/i)(e)],
  ];
  const organOf = (e) => { for (const [id, f] of ORGANS) if (f(e)) return id; return 'other'; };
  // four inks, one encoding: ultramarine for models and products, orange for money and compute, teal for rules and
  // policy, pink for people and incidents
  const INK4 = { models: 'u', labs: 'u', products: 'u', other: 'u', energy: 'o', chips: 'o', capital: 'o', policy: 't', data: 't', talent: 'p', users: 'p' };
  const inkOf = (e) => (e.type === 'incident' || e.type === 'person' ? 'p' : INK4[organOf(e)] || 'u');
  const INK_NAME = { u: 'models and products', o: 'money and compute', t: 'rules and policy', p: 'people and incidents' };
  const inkName = (e) => INK_NAME[inkOf(e)];
  const periodOf = (y) => (y >= 2017 ? String(y) : y >= 2010 ? '2010 to 2016' : y >= 1960 ? `${Math.floor(y / 10) * 10}s` : 'to 1959');
  const PERIODS = ['to 1959', '1960s', '1970s', '1980s', '1990s', '2000s', '2010 to 2016', ...Array.from({ length: 10 }, (_, i) => String(2017 + i))];
  const LEGIBLE = 18, PITCH_LG = 12, PITCH_TX = 6, NARROW = 52, STAMP_H = 212; // STAMP_H matches .nw-stamp height in ai_now.css
  let wallGen = 0, wallKey = '';

  function wall(partial, inFrame) {
    if (partial && !inFrame) { requestAnimationFrame(() => wall(true, true)); return; } // the past wave: write and measure inside a frame, not in the wave's microtask
    const ai = db.events.filter((e) => e.domain === 'ai').sort((a, b) => b.year - a.year || (b.month || 0) - (a.month || 0) || (b.day || 0) - (a.day || 0)); // latest first: the top of a column is the present
    const by = new Map(PERIODS.map((p) => [p, []]));
    for (const e of ai) { const p = periodOf(e.year); if (by.has(p)) by.get(p).push(e); }
    const complete = db.loaded.has('past') || db.complete;
    const total = ai.length, since = ai.filter((e) => e.year >= 2017).length, share = total ? since / total : 0;
    const fifths = Math.round(share * 5);
    $('.nw-h1').innerHTML = !complete ? `${num(since)} AI events <br>since 2017.` : fifths >= 2 && fifths <= 4 ? `${FRAC[fifths][0].toUpperCase()}${FRAC[fifths].slice(1)} in five AI events <br>arrived since 2017.` : `${num(share * 100)}% of AI events <br>arrived since 2017.`;
    subBase = !complete ? 'The earlier record is on its way.' : `${num(total)} events, one label each.`; wallTotal = total;
    inkCount = { u: 0, o: 0, t: 0, p: 0 }; for (const e of ai) inkCount[inkOf(e)]++;
    $('.nw-key').innerHTML = ['u', 'o', 't', 'p'].filter((k) => inkCount[k]).map((k) => `<li class="nw-krow ink-${k}${pinned === k ? ' pin' : ''}" data-ink="${k}" tabindex="0" role="button" aria-pressed="${pinned === k}"><i></i><span>${INK_NAME[k]}</span><b>${num(inkCount[k])}</b></li>`).join('');
    setSub();
    const box = $('.nw-wallbox'), cols = $('.nw-cols'), axis = $('.nw-axis');
    const dense = el.clientWidth < 700;
    const W = cols.clientWidth, narrowN = PERIODS.filter((p) => !/^\d{4}$/.test(p)).length, wideN = PERIODS.length - narrowN, gap = dense ? 4 : 8;
    const nw = dense ? 40 : NARROW, cw = dense ? 76 : Math.max(60, Math.floor((W - narrowN * nw - (PERIODS.length - 1) * gap) / wideN));
    // a legible label is whole words only, as many as fit the column at 11px mono; one that cannot fit a whole word is texture
    const chars = (w) => Math.max(4, Math.floor((w - 6) / 6.6));
    const label = (e, w) => { const n = chars(w); const words = String(e.title_short || e.title || '').split(/\s+/); let out = ''; for (const wd of words) { const next = out ? `${out} ${wd}` : wd; if (next.length > n) break; out = next; } return out.replace(/[:;,.]$/, ''); };
    const axisDraw = () => { axis.innerHTML = PERIODS.map((p) => { const L = by.get(p), w = /^\d{4}$/.test(p) ? cw : nw; return `<span style="width:${w}px">${esc(p).replace(' to 20', '<br>to ').replace('to 1959', 'to<br>1959')}<b>${L.length || complete ? num(L.length) : '\u00b7'}</b></span>`; }).join(''); axis.style.gap = cols.style.gap = `${gap}px`; box.setAttribute('aria-label', `${num(total)} AI events in the record as labels stacked by period into ink columns, ${PERIODS.map((p) => `${p}: ${by.get(p).length}`).join(', ')}`); };
    const t0 = performance.now(); let labels = 0;
    const N = PERIODS.length;
    // a column taller than the stage bleeds off the top: its hidden rows are texture, so the eighteen legible labels
    // sit at the visible top
    // no column enters a stamp or the top bar at any viewport: the stamps' footprint and the stage top are reserved
    // before the columns are laid; a column under the stamps is capped at their bottom edge minus 8px, a column
    // clear of them at the stage top plus 8px. The legible eighteen (or as many as fit) print from the column's top;
    // the rest is texture whose pitch shrinks to fit the cap (the count stays on the axis)
    const Hv = cols.clientHeight || 600, EDGE = 8;
    const xs = []; { let x = 0; for (const p of PERIODS) { const w = /^\d{4}$/.test(p) ? cw : nw; xs.push([x, x + w]); x += w + gap; } }
    $('.nw-stamps').style.width = dense ? '' : `${xs[PERIODS.indexOf('2022')][1]}px`; // the stamps row spans the 2017 to 2022 columns exactly, so 2023 on rise clear of it
    const cr = cols.getBoundingClientRect(), st = dense ? null : $('.nw-stamps').getBoundingClientRect();
    const stampH = st ? parseFloat(getComputedStyle($('.nw-stamps')).getPropertyValue('--nw-stamp-h')) || STAMP_H : 0;
    const stampBottom = st ? st.top - cr.top + (st.height > 0 ? st.height : stampH) : -1;
    const capOf = (ci) => Hv - EDGE - (st && xs[ci][0] < st.right - cr.left && xs[ci][1] > st.left - cr.left ? stampBottom : 0);
    const order = (L, ci, w) => {
      const cap = Math.max(PITCH_LG, capOf(ci));
      const fits = [], skip = [];
      for (const e of L) { const ok = label(e, w).length > 0 && (dense ? e.landmark || RECORD.test(e.title) : fits.length < LEGIBLE); (ok ? fits : skip).push(e); }
      let lgN = fits.length, restN = L.length - lgN;
      const pitch = () => (restN ? (cap - lgN * PITCH_LG) / restN : cap - lgN * PITCH_LG);
      while (lgN > 0 && pitch() < 1) { lgN--; restN++; }
      const px = restN ? Math.min(PITCH_TX, Math.max(1, pitch())) : PITCH_TX;
      const below = [...fits.slice(lgN), ...skip].sort((a, b) => (inkOf(a) < inkOf(b) ? -1 : inkOf(a) > inkOf(b) ? 1 : 0)); // the rest groups by domain ink into solid bands
      return { lg: fits.slice(0, lgN), below, px };
    };
    const ev = (e, legible, w) => (legible ? `<span class="nw-ev lg ink-${inkOf(e)}" data-id="${esc(e.id)}" tabindex="0">${esc(label(e, w))}</span>` : `<i class="nw-ev tx ink-${inkOf(e)}" data-id="${esc(e.id)}"></i>`);
    const colPx = new Map();
    const bodyOf = (p) => { const L = by.get(p), w = /^\d{4}$/.test(p) ? cw : nw; const O = order(L, PERIODS.indexOf(p), w); colPx.set(p, O.px); labels += O.lg.length; return [...O.lg.map((e) => ev(e, true, w)), ...O.below.map((e) => ev(e, false, w))].join(''); };
    const later = PERIODS.filter((p) => !/^\d{4}$/.test(p)); // the earlier seven columns fill in the next frame; their shells hold the width so nothing drawn moves
    const key = `${dense}|${W}|${Hv}`;
    if (partial && key === wallKey && cols.children.length === PERIODS.length) { // the past wave landed: the recent columns are already printed
      const gen2 = ++wallGen;
      requestAnimationFrame(() => { if (gen2 !== wallGen) return; for (const p of later) { const c = cols.querySelector(`.nw-col[data-p="${p}"]`); if (c) { c.innerHTML = bodyOf(p); c.style.setProperty('--tx', `${colPx.get(p).toFixed(2)}px`); } } axisDraw(); el.dataset.wall += `, past wave: earlier columns refilled`; });
      return;
    }
    wallKey = key;
    cols.innerHTML = PERIODS.map((p, ci) => { const w = /^\d{4}$/.test(p) ? cw : nw; const delay = Math.round(900 * Math.sqrt(ci / (N - 1))); const body = later.includes(p) ? '' : bodyOf(p); return `<div class="nw-col${w === nw ? ' narrow' : ''}" style="width:${w}px;--d:${delay}ms;--tx:${(colPx.get(p) || PITCH_TX).toFixed(2)}px" data-p="${esc(p)}">${body}</div>`; }).join('');
    const gen = ++wallGen;
    requestAnimationFrame(() => { if (gen !== wallGen) return; for (const p of later) { const c = cols.querySelector(`.nw-col[data-p="${p}"]`); if (c) { c.innerHTML = bodyOf(p); c.style.setProperty('--tx', `${colPx.get(p).toFixed(2)}px`); } } el.dataset.wall += `, earlier columns +${later.length}`; });
    const t1 = performance.now(); void cols.offsetHeight;
    el.dataset.wall = `${dense ? 'dense' : 'full'} ${labels} labels, build ${(t1 - t0).toFixed(0)}ms, layout ${(performance.now() - t1).toFixed(0)}ms`;
    el.classList.toggle('nw-dense', dense);
    if (dense) requestAnimationFrame(() => { box.scrollLeft = box.scrollWidth; }); // phones open on the recent wave; the earlier columns are a swipe left
    axisDraw();
    el.style.setProperty('--nw-lg', `${PITCH_LG}px`); el.style.setProperty('--nw-tx', `${PITCH_TX}px`);
  }

  /* ---------- step back: the two adoption charts ---------- */
  let CW = 560, CH = 170; const PAD = { l: 40, r: 10, t: 26, b: 22 }; // the chart cards are double width: 560 by 170
  const axisT = (x, y, t, cls = '') => `<text class="ax ${cls}" x="${x}" y="${y}">${esc(String(t))}</text>`;
  function householdsChart(A) {
    const pick = [['Radio', 'Radio'], ['Colour TV', 'Colour TV'], ['Personal computer (microcomputer)', 'PC'], ['Internet', 'Internet'], ['Smartphone', 'Smartphone']];
    const T = A && A.technologies ? pick.map(([n, short]) => [short, A.technologies[n]]).filter(([, p]) => p && p.length) : [];
    if (T.length < 3) return null;
    const span = 15, LAB = 90, W = CW - PAD.l - LAB, H = CH - PAD.t - PAD.b;
    const X = (yr) => PAD.l + (Math.min(span, Math.max(0, yr)) / span) * W, Y = (v) => PAD.t + H - (v / 100) * H;
    const segs = T.map(([n, pts]) => { const p0 = pts.find((p) => p.value >= 10); if (!p0) return null; const seg = pts.filter((p) => p.year >= p0.year && p.year - p0.year <= span); const e = seg[seg.length - 1]; return { n, y0: p0.year, d: seg.map((p, i) => `${i ? 'L' : 'M'}${X(p.year - p0.year).toFixed(1)} ${Y(Math.min(100, p.value)).toFixed(1)}`).join(''), ex: X(e.year - p0.year), ey: Y(Math.min(100, e.value)) }; }).filter(Boolean);
    segs.sort((a, b) => a.ey - b.ey); let ly = -99; for (const g of segs) { g.ly = Math.max(g.ey + 4, ly + 14); ly = g.ly; }
    const lx = PAD.l + W + 12;
    const lines = segs.map((g) => `<path class="b thin" d="${g.d}"/><line class="lead" x1="${Math.max(g.ex, lx - 14).toFixed(1)}" y1="${g.ey.toFixed(1)}" x2="${(lx - 3).toFixed(1)}" y2="${(g.ly - 4).toFixed(1)}"/><text class="lab" x="${lx}" y="${g.ly.toFixed(1)}">${esc(g.n)}</text>`).join('');
    return { svg: `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="US households: ${segs.map((g) => `${g.n} from ${g.y0}`).join(', ')}, share of homes over fifteen years from the year each passed 10 percent">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'share of US homes, years after 10%', 'l')}
      ${[0, 50, 100].map((v) => axisT(PAD.l - 4, Y(v) + 4, `${v}%`, 'r')).join('')}
      ${[0, 5, 10, 15].map((v) => axisT(X(v), CH - 4, v === 0 ? 'year 0' : `+${v}`, v === 0 ? 'l' : v === 15 ? 'e' : 'c')).join('')}
      ${lines}</svg>`, segs };
  }
  function chatgptChart(wu) {
    if (!wu || !wu.points || wu.points.length < 2) return null;
    const W = CW - PAD.l - PAD.r - 8, H = CH - PAD.t - PAD.b;
    const t0 = tOf('2022-11-30'), L = last(wu), tL = tOf(L[0]), spanY = Math.max(1, Math.ceil(tL - t0)), maxU = Math.ceil(Math.max(...wu.points.map((p) => p[1])) / 300) * 300;
    const X = (yr) => PAD.l + (Math.min(spanY, Math.max(0, yr)) / spanY) * W, Y = (v) => PAD.t + H - (v / maxU) * H;
    const du = [[t0, 0], ...wu.points.map((p) => [tOf(p[0]), p[1]])].map(([t, v], i) => `${i ? 'L' : 'M'}${X(t - t0).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const cx = X(tL - t0), cy = Y(L[1]);
    const xt = []; for (let v = 0; v <= spanY; v++) xt.push(v);
    return { svg: `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="ChatGPT weekly users worldwide, millions, from launch in November 2022 to ${num(L[1])} million">
      <line class="rule" x1="${PAD.l}" y1="${PAD.t + H}" x2="${PAD.l + W}" y2="${PAD.t + H}"/>
      ${axisT(PAD.l - 4, PAD.t - 14, 'millions of weekly users', 'l')}
      ${[0, maxU / 2, maxU].map((v) => axisT(PAD.l - 4, Y(v) + 4, num(v), 'r')).join('')}
      ${xt.map((v) => axisT(X(v), CH - 4, v === 0 ? 'launch' : v === spanY ? `+${v} yrs` : `+${v}`, v === 0 ? 'l' : v === spanY ? 'e' : 'c')).join('')}
      <path class="o" d="${du}"/><circle class="b" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3"/>
      <text class="lab o e" x="${(PAD.l + W).toFixed(1)}" y="${(PAD.t + H - 10).toFixed(1)}">${esc(`${num(L[1])} m on ${when(L[0])}`)}</text></svg>`, L, first: wu.points[0], spanY: tL - t0 };
  }
  let capText = '', INDEX_ROWS = [], LEAD_ROWS = [], sheetWaited = false, sheetGen = 0;
  const nextFrame = (fn) => requestAnimationFrame(() => setTimeout(fn, 0)); // a later task, so a write and its draw never share one long task
  // the evidence panel: the adoption caption, or the seven index lines with their dates and sources
  const srcLink = (f) => (f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>` : esc(f.source || ''));
  function openPanel(key) {
    const fallback = (k, spec) => { if (!db.pointById) db.pointById = new Map(); db.pointById.set(k, { kicker: spec.kicker, html: `<h3>${esc(spec.title)}</h3>${spec.html}` }); set({ sel: k }); };
    const open = openEvidence || fallback;
    if (key === 'adoption') open('now:adoption', { kicker: '<span class="ki">Step back</span>', title: 'Two adoption charts', html: `<p>${esc(capText)}</p>` });
    else open('now:index', { kicker: '<span class="ki">The rate sheet</span>', title: 'Ten readings, dated and sourced', html: `<ol class="nw-plist">${[...LEAD_ROWS, ...INDEX_ROWS].map((f) => `<li><b>${esc(f.figure)}${f.unit ? ` ${esc(f.unit)}` : ''}</b> ${esc(f.meaning)}${f.note ? ` ${esc(f.note)}` : ''}<br><span>${f.date ? `${esc(f.date)} &middot; ` : ''}${srcLink(f)}</span></li>`).join('')}</ol>` });
  }
  function sheet(F) {
    INDEX_ROWS = INDEX.map((k) => F[k]).filter(Boolean); LEAD_ROWS = LEADS.map((k) => F[k]).filter(Boolean);
    const names = [...new Set(INDEX_ROWS.map((f) => f.source).filter(Boolean))];
    const A = (db.series || []).find((x) => x.id === 'adoption'), hh = householdsChart(A), cg = chatgptChart(series('chatgpt_weekly_users'));
    if (!A && !sheetWaited) { sheetWaited = true; ensure('series').then(() => nextFrame(() => { sheet(F); nextFrame(() => viz.drawAll(el, true)); })); }
    const d = diffusion(A), med = d && d.stats && d.stats.median_since_1990 != null ? d.stats.median_since_1990 : null;
    capText = `${med != null ? `Technologies took ${yrs(med)} to go from 10 to 50 percent of US homes` : 'Technologies took years to reach half of US homes'}; ChatGPT reached ${cg ? `${num(cg.L[1] / 1000, 1)} billion people in ${yrs(cg.spanY)}` : 'a billion people in under four years'}. Two units, so two charts: a share of US homes against years since 10 percent, and people worldwide against years since launch.`;
    const n = INDEX_ROWS.length;
    $('.nw-cards').innerHTML = `${INDEX_ROWS.map(card).join('')}
      <li class="nw-card nw-srccell ink-u" style="--i:${n}"><p class="nw-src">${esc(names.join(', '))}</p><button type="button" class="nw-more" data-ev="index">Dates and sources</button></li>`;
    const gen = ++sheetGen;
    nextFrame(() => { if (gen !== sheetGen) return; $('.nw-cards').insertAdjacentHTML('beforeend', `${hh ? `<li class="nw-card nw-chartcard ink-u" style="--i:${n + 1}"><figure class="nw-chart" data-chart>${hh.svg}<figcaption>US households</figcaption></figure></li>` : ''}
      ${cg ? `<li class="nw-card nw-chartcard ink-p" style="--i:${n + 2}"><figure class="nw-chart" data-chart>${cg.svg}<figcaption>ChatGPT weekly users <button type="button" class="nw-more" data-ev="adoption">How the two compare</button></figcaption></figure></li>` : ''}`); });
  }

  /* ---------- print passes: blue first, orange second ---------- */
  let pressT = 0, wallDirty = false;
  function press() { if (RM) { el.classList.add('nw-settled'); return; } el.classList.remove('nw-settled'); el.classList.add('nw-press'); clearTimeout(pressT); pressT = setTimeout(() => { el.classList.remove('nw-press'); el.classList.add('nw-settled'); }, 2600); }

  async function build() {
    if (built) return; built = true;
    // the first marks come from the recent wave already in db.events (2010 on); the earlier columns join when
    // events_past lands, the benchmarks lead when its file arrives; the other two leads need neither
    // the wall needs only the record, so it prints at once; the stamps and the sheet follow when the two figure files
    // land, each write in a frame of its own
    roW = el.clientWidth;
    if (!db.loaded.has('past')) ensure('past').then(() => { if (screen === 1) wall(true); else wallDirty = true; });
    wall();
    press();
    const [v3, lim] = await Promise.all([optional('series_v3.json'), optional('compute_limits.json')]);
    await new Promise((r) => nextFrame(r));
    V3 = v3 && Array.isArray(v3.series) ? v3.series : Array.isArray(v3) ? v3 : [];
    const F = figures(lim);
    $('.nw-stamps').innerHTML = LEADS.map((k, i) => (F[k] ? stamp(F[k], i) : stampWait(k, i))).join('');
    if (!F.human) ensure('benchmarks').then(() => { const F2 = figures(lim); const w = $('.nw-stamp[data-wait="human"]'); if (F2.human && w) { LEAD_ROWS = LEADS.map((k) => F2[k]).filter(Boolean); w.outerHTML = stamp(F2.human, 1); nextFrame(() => viz.drawAll(el, true)); } });
    nextFrame(() => { sheet(F); nextFrame(() => viz.drawAll(el, true)); });
  }
  function showScreen(n) {
    screen = n === 2 ? 2 : 1;
    for (const s of el.querySelectorAll('.nw-screen')) s.hidden = +s.dataset.screen !== screen;
    el.scrollTop = 0;
    if (built) { if (screen === 1) { wall(); wallDirty = false; } viz.drawAll(el, true); press(); }
  }
  // the key, the rows, the columns and the stamps answer to the pointer and the keyboard: a domain lit or pinned
  // (the other inks fall back), a row's tip and outline, a column's count in the sub line, a stamp's source line
  let subBase = '', wallTotal = 0, inkCount = { u: 0, o: 0, t: 0, p: 0 }, pinned = '';
  const setSub = (text) => { const sub = $('.nw-sub'); if (sub) sub.textContent = text || (pinned ? `${INK_NAME[pinned]}: ${num(inkCount[pinned])} of ${num(wallTotal)}` : subBase); };
  const light = (k) => { if (k) el.dataset.lit = k; else if (pinned) el.dataset.lit = pinned; else delete el.dataset.lit; };
  const pin = (k) => { pinned = pinned === k ? '' : k; for (const r of el.querySelectorAll('.nw-krow')) { const on = r.dataset.ink === pinned; r.classList.toggle('pin', on); r.setAttribute('aria-pressed', String(on)); } light(); setSub(); };
  const byId = (id) => db.events.find((e) => e.id === id);
  const rowTip = (evl, ev) => { const e = byId(evl.dataset.id); if (!e) return; tip.show(ev, `<div class="k">${esc(String(e.year))}${e.type ? ` &middot; ${esc(e.type)}` : ''}</div><div class="h">${esc(e.title)}</div><div class="m">${esc(inkName(e))} &middot; click to open</div>`); };
  const colOf = (node) => node.closest('.nw-col');
  const litAxis = (col, on) => { if (!col) return; const i = [...col.parentNode.children].indexOf(col); const ax = $('.nw-axis'); const sp = ax && ax.children[i]; if (sp) sp.classList.toggle('lit', on); if (on) setSub(`${col.dataset.p}: ${num(col.children.length)} events`); else setSub(); };
  el.addEventListener('pointerover', (ev) => {
    const krow = ev.target.closest('.nw-krow'); if (krow) { light(krow.dataset.ink); return; }
    const evl = ev.target.closest('.nw-ev'); if (evl) { rowTip(evl, ev); }
    const col = colOf(ev.target); if (col && !col.classList.contains('lit')) { col.classList.add('lit'); litAxis(col, true); }
  });
  el.addEventListener('pointermove', (ev) => { if (ev.target.closest('.nw-ev')) tip.move(ev); });
  el.addEventListener('pointerout', (ev) => {
    const to = ev.relatedTarget;
    if (ev.target.closest('.nw-krow') && !(to && to.closest && to.closest('.nw-krow'))) light();
    if (ev.target.closest('.nw-ev') && !(to && to.closest && to.closest('.nw-ev'))) tip.hide();
    const col = colOf(ev.target); if (col && !(to && col.contains(to))) { col.classList.remove('lit'); litAxis(col, false); }
  });
  el.addEventListener('focusin', (ev) => { const krow = ev.target.closest('.nw-krow'); if (krow) light(krow.dataset.ink); });
  el.addEventListener('focusout', (ev) => { if (ev.target.closest('.nw-krow')) light(); });
  el.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = ev.target.closest('.nw-krow, .nw-ev'); if (!t) return; ev.preventDefault(); t.click(); });
  el.addEventListener('click', (ev) => {
    const more = ev.target.closest('.nw-more'); if (more) { openPanel(more.dataset.ev); return; }
    const krow = ev.target.closest('.nw-krow'); if (krow) { pin(krow.dataset.ink); return; }
    const evl = ev.target.closest('.nw-ev'); if (evl && select) { tip.hide(); select(evl.dataset.id); return; }
    const li = ev.target.closest('.nw-stamp, .nw-card'); if (li && li.dataset.view && !ev.target.closest('a, button')) set({ view: li.dataset.view, mode: '' });
  });
  // a resize rebuilds the wall only when the width changed: a height change (the headline settling, the stage growing) is not a reflow of the columns
  let raf = 0, roW = -1; const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!built) return; const w = el.clientWidth; if (w === roW) return; roW = w; if (screen === 1) wall(); viz.drawAll(el, true); }); }) : null;
  if (ro) { roW = el.clientWidth; ro.observe(el); }

  function render(state, ch) {
    const want = state && state.screen ? +state.screen : 1;
    if (!built) build().then(() => showScreen(want));
    else if (want !== screen || (ch && (ch.has('view') || ch.has('*')))) showScreen(want);
  }
  return { render, resize() { if (built && screen === 1) wall(); }, hover() {}, lit() {}, teardown() { if (ro) ro.disconnect(); clearTimeout(pressT); tip.hide(); } };
}
