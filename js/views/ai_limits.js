// AI · Money and compute, sheet 3 of 3: eight limits as drafting cells on the blueprint. Solid lines are readings,
// dashed lines are plans or estimates. The other fifteen limits live in the evidence panel, one line each.
// Data: data/compute_limits.json (23 items with a figure object, a reading and a source), data/series_v3.json for
// the frontier token price. Registered as the third screen of `money` in store.js VIEWS (hash #v=money&s=3).
import { esc } from '../ui.js';
import { db } from '../data.js';
import { createViz, num } from './ai_viz.js';

export const SCREENS = [{ id: 'limits', title: 'Eight limits' }];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = (d) => { const m = String(d || '').match(/^(\d{4})(?:-(\d\d))?(?:-(\d\d))?/); if (!m) return String(d || ''); return m[3] ? `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}` : m[2] ? `${MON[+m[2] - 1]} ${m[1]}` : m[1]; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const SHORT_HOST = { 'iea.org': 'IEA', 'energyanalysis.lbl.gov': 'LBNL', 'federalregister.gov': 'Federal Register', 'epoch.ai': 'Epoch AI', 'openai.com': 'OpenAI', 'nvidia.com': 'NVIDIA', 'trendforce.com': 'TrendForce', 'ir.aboutamazon.com': 'Amazon IR', 'aboutamazon.com': 'Amazon', 'tomshardware.com': "Tom's Hardware", 'reuters.com': 'Reuters', 'bloomberg.com': 'Bloomberg', 'arxiv.org': 'arXiv', 'semianalysis.com': 'SemiAnalysis' };
const shortHost = (u) => SHORT_HOST[host(u)] || host(u);
const urlOf = (x) => (x.source && typeof x.source === 'object' ? x.source.url : x.url) || '';
const srcName = (x) => { const t = x.source && typeof x.source === 'object' ? String(x.source.title || '').replace(/[:,(].*$/, '').trim() : ''; return t && t.length <= 18 ? t : shortHost(urlOf(x)); };
const dateOf = (x) => String(x.date || x.as_of || x.year || '').replace(/\s*\(.*$/, '').replace(/;.*$/, '').trim();

// the eight cells: a short label (meaning first), the headline figure, and a picture. `plan` names the dashed parts.
const EIGHT = ['dc_electricity', 'interconnection_queue', 'cowos_capacity', 'rack_power', 'text_stock', 'hyperscaler_capex', 'token_price', 'export_scope'];
const TICKER = { Amazon: 'AMZN', Alphabet: 'GOOG', Meta: 'META', Microsoft: 'MSFT' };
const CELL = {
  dc_electricity: { label: 'Data centres drew more power', fig: (f) => [num(f[2025]), 'TWh in 2025'], viz: (f) => ({ type: 'hbars', vals: [{ k: '2024', v: f[2024] }, { k: '2025', v: f[2025] }, { k: '2030 plan', v: f[2030], hollow: true }], hi: 1, fmt: (v) => `${num(v)} TWh` }) },
  interconnection_queue: { label: 'Generation waits for the grid', fig: (f) => [num(f.generation_gw), 'GW in US queues'], viz: (f) => ({ type: 'hbars', vals: [{ k: 'generation', v: f.generation_gw }, { k: 'storage', v: f.storage_gw }], max: f.generation_gw, hi: 0, fmt: (v) => `${num(v)} GW` }) },
  cowos_capacity: { label: 'Packaging doubles by 2028', fig: (f) => [`${num(f.end_2026_wpm / 1000)}k`, 'wafers a month'], viz: (f) => ({ type: 'hbars', vals: [{ k: '2026', v: f.end_2026_wpm }, { k: '2028 aim', v: f.end_2028_target_wpm, hollow: true }], hi: 0, fmt: (v) => `${num(v / 1000)}k` }) },
  rack_power: { label: 'Racks head for a megawatt', fig: (f) => [num(f.gb200_nvl72_reported_kw), 'kW a rack now'], viz: (f) => ({ type: 'hbars', vals: [{ k: 'GB200', v: f.gb200_nvl72_reported_kw }, { k: 'Kyber', v: f.kyber_reported_kw }, { k: String(f.planned_1mw_racks_from || 'planned'), v: 1000, hollow: true }], hi: 0, fmt: (v) => `${num(v)} kW` }) },
  text_stock: { label: 'Public text runs out', fig: (f) => [`${num(f.tokens / 1e12)} tn`, 'tokens exist'], viz: (f) => ({ type: 'hbars', vals: [{ k: 'one run', v: 1e13 }, { k: 'stock', v: f.tokens, hollow: true }], hi: 0, fmt: (v) => `${num(v / 1e12)} tn` }) },
  hyperscaler_capex: { label: 'Four companies spend $360 bn', fig: (f) => { const pc = f.per_company_2025_bn || {}; const t = Object.values(pc).filter((v) => typeof v === 'number').reduce((a, b) => a + b, 0); return [`$${num(f.total_2025_bn || t)} bn`, 'capex in 2025']; }, viz: (f) => { const pc = f.per_company_2025_bn; return pc ? { type: 'bars', vals: Object.entries(pc).filter(([, v]) => typeof v === 'number').map(([k, v]) => ({ k: TICKER[k.split(/[\s(]/)[0]] || k, v })).sort((a, b) => b.v - a.v), hi: 'max' } : null; } },
  token_price: { label: 'Frontier tokens got cheaper', fig: (f) => { const e = Object.entries(f).filter(([k, v]) => typeof v === 'number' && /^\d{4}-\d{2}/.test(k)).sort(); return e.length > 1 ? [`${num(e[0][1] / e[e.length - 1][1])}×`, `cheaper since ${e[0][0].slice(0, 4)}`] : ['', '']; }, viz: (f, series) => { const ap = series('api_price_frontier'); const pts = Object.entries(f).filter(([k, v]) => typeof v === 'number' && /^\d{4}-\d{2}/.test(k)).map(([k, v]) => [k.slice(0, 7), v]).sort(); return ap && ap.points.length > 1 ? { type: 'step', pts: ap.points, log: true, fmt: (v) => `$${num(v, v < 3 ? 2 : 0)}` } : pts.length > 1 ? { type: 'step', pts, log: true, fmt: (v) => `$${num(v, 2)}` } : null; } },
  export_scope: { label: 'Chips need a US licence', fig: (f) => [num(f.countries_under_licence), 'countries'], viz: (f) => ({ type: 'dots', n: Math.round(f.countries_under_licence) }) },
};
// one line per limit for the evidence panel: the item's own label, its headline figure and its reading
const headline = (x) => { const f = x.figure; if (typeof f === 'number') return `${num(f)} ${x.unit || ''}`.trim(); if (typeof f === 'string') return f; if (f && typeof f === 'object') { const e = Object.entries(f); const yrs = e.filter(([k, v]) => /^\d{4}$/.test(k) && typeof v === 'number' && +k <= new Date().getFullYear()); const p = yrs.length ? yrs[yrs.length - 1] : e.find(([, v]) => typeof v === 'number'); if (p) return `${num(p[1], p[1] < 10 ? 1 : 0)} ${String(x.unit || '').split(';')[0]}`.trim(); } return ''; };

export default function aiLimits(el, ctx) {
  const { select, openEvidence } = ctx;
  const viz = createViz('lm-viz');
  const series = (id) => ((db.series_v3 || db.v3 || [])).find((s) => s.id === id) || (window.__v3 || []).find((s) => s.id === id);
  let items = [], drawn = false;
  const $ = (q) => el.querySelector(q);

  el.classList.add('lm-view');
  el.innerHTML = `<section class="lm-sheet" aria-labelledby="lm-h1">
      <div class="lm-frame" aria-hidden="true"></div>
      <h1 class="lm-head" id="lm-h1"></h1>
      <p class="lm-fig" data-chart></p>
      <ol class="lm-cells"></ol>
      <div class="lm-bottom"><p class="lm-src"></p>
      <dl class="lm-title"><div><dt>Sheet</dt><dd>03 of 03</dd></div><div><dt>Scale</dt><dd>solid readings, dashed plans</dd></div><div><dt>Count</dt><dd class="lm-count"></dd></div><div><dt>Source</dt><dd class="lm-source"></dd></div></dl></div>
    </section>`;

  async function load() {
    if (items.length) return items;
    try { const r = await fetch('data/compute_limits.json'); const j = await r.json(); items = (j && (j.items || j.limits)) || []; } catch { items = []; }
    if (!series('api_price_frontier')) { try { const r = await fetch('data/series_v3.json'); const j = await r.json(); window.__v3 = (j && (j.series || j)) || []; } catch { /* the cell falls back to the item's own figures */ } }
    return items;
  }

  function draw() {
    const byId = new Map(items.map((x) => [x.id, x]));
    const eight = EIGHT.map((id) => byId.get(id)).filter(Boolean);
    const dc = byId.get('dc_electricity');
    const lead = dc && dc.figure && dc.figure[2025] ? `${num(dc.figure[2025])} TWh` : '';
    $('.lm-head').textContent = 'Power, chips, text and money set AI\u2019s pace';
    $('.lm-fig').textContent = lead ? `${lead} to data centres in 2025` : '';
    $('.lm-cells').innerHTML = eight.map((x) => {
      const c = CELL[x.id]; const f = x.figure || {};
      let fig = ['', '']; try { fig = c.fig(f); } catch { /* keep blank */ }
      let spec = null; try { spec = c.viz(f, series); } catch { spec = null; }
      const plan = spec && spec.vals ? spec.vals.some((v) => v.hollow) : false;
      const u = urlOf(x), d = dateOf(x);
      return `<li class="lm-cell${plan ? ' has-plan' : ''}" data-id="${esc(x.id)}" data-chart tabindex="0" role="button" aria-label="${esc(x.label || x.id)}" title="${esc(x.reading || '')}">
          <span class="lm-lab">${esc(c.label)}</span>
          <span class="lm-num">${esc(fig[0])}<span class="lm-unit">${esc(fig[1])}</span></span>
          ${spec ? viz.vz({ ...spec, h: spec.type === 'dots' ? 72 : 96 }) : '<span class="lm-nopic"></span>'}
          <span class="lm-foot">${d ? `<span>${esc(when(d))}</span>` : ''}${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(srcName(x))}</a>` : ''}</span>
        </li>`;
    }).join('');
    const rest = items.filter((x) => !EIGHT.includes(x.id));
    $('.lm-count').textContent = `${eight.length} of ${items.length} limits`;
    $('.lm-source').textContent = `compute_limits.json, ${items.length} items`;
    $('.lm-src').innerHTML = `Dates and sources on each cell. <button type="button" class="lm-more">The other ${rest.length} limits</button>`;
    viz.drawAll(el, true);
    drawn = true;
  }

  // the evidence panel: one cell's reading, or the other fifteen as one line each
  function openCell(x) {
    const u = urlOf(x);
    openEvidence(`limits:${x.id}`, { kicker: '<span class="ki">Limit</span>', title: x.label || x.id, sub: when(dateOf(x)), html: `<p>${esc(x.reading || '')}</p>${u ? `<p class="small"><a href="${esc(u)}" target="_blank" rel="noopener">${esc(x.source && x.source.title ? x.source.title : shortHost(u))}</a></p>` : ''}` });
  }
  function openRest() {
    const rest = items.filter((x) => !EIGHT.includes(x.id));
    openEvidence('limits:others', { kicker: '<span class="ki">Limits</span>', title: `The other ${rest.length} limits`, html: `<ol class="lm-list">${rest.map((x) => { const u = urlOf(x); return `<li><b>${esc(headline(x))}</b> ${esc(x.label || x.id)}${x.reading ? `<br><span>${esc(x.reading)}</span>` : ''}${u ? ` <a href="${esc(u)}" target="_blank" rel="noopener">${esc(srcName(x))}</a>` : ''}</li>`; }).join('')}</ol>` });
  }
  el.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) return;
    if (ev.target.closest('.lm-more')) { openRest(); return; }
    const cell = ev.target.closest('.lm-cell'); if (!cell) return;
    const x = items.find((i) => i.id === cell.dataset.id); if (x) openCell(x);
  });
  el.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; const cell = ev.target.closest('.lm-cell'); if (!cell) return; ev.preventDefault(); cell.click(); });

  return {
    async render(state, changed) {
      if (!drawn || changed.has('*')) { await load(); if (!drawn) draw(); }
      const sel = String(state.sel || ''); for (const c of el.querySelectorAll('.lm-cell')) c.classList.toggle('is-sel', sel === `limits:${c.dataset.id}`);
    },
    resize() { if (drawn) viz.drawAll(el, true); },
    teardown() { el.innerHTML = ''; el.classList.remove('lm-view'); },
  };
}
