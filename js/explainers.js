// Anatomy explainers: plain-language cards per organ, numbers computed from the series files for a given year,
// and flow magnitudes that drive the particle speed. Prose lives in data/anatomy_explainers.json; nothing numeric is typed there.
import { esc } from './ui.js';
import { host, db } from './data.js';

let cache = null;
export async function loadExplainers() {
  if (cache) return cache;
  try {
    const r = await fetch(`data/anatomy_explainers.json${db.manifest && db.manifest.version ? `?v=${db.manifest.version}` : ''}`);
    cache = r.ok ? await r.json() : { organs: {}, flows: {}, layers: {} };
  } catch { cache = { organs: {}, flows: {}, layers: {} }; }
  return cache;
}

const fmtSI = (v) => d3.format('.3~s')(v).replace('G', 'B');
// 9.4e26 -> "9.4 × 10²⁶"
const SUP = { '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079', '-': '\u207b' };
const fmtFLOP = (v) => { const [m, e] = d3.format('.1~e')(v).split('e'); return `${m} \u00d7 10${String(+e).split('').map((c) => SUP[c] || c).join('')}`; };
// human names for the data files, used wherever a source is shown to a reader
const SOURCE_NAME = {
  'series/datacenter_electricity.json': 'IEA data centre electricity estimates', 'series/nvidia_revenue.json': 'NVIDIA Form 10-K filings by fiscal year',
  'series/ai_private_investment.json': 'Stanford AI Index private investment figures, via Our World in Data', 'series/training_compute.json': 'Epoch AI notable models dataset',
  'series/arxiv_ai.json': 'arXiv paper counts by category and year', 'series/ai_publications.json': 'CSET scholarly publication counts, via Our World in Data',
  'series/time_to_100m_users.json': 'months-to-100-million-users figures', 'series/llm_inference_price.json': 'Epoch AI inference prices',
  'policy.json': 'Policy atlas, with per-measure sources', 'talent.json': 'Lineage data, with per-organization sources',
};
export const sourceName = (file) => SOURCE_NAME[file] || '';
const S2 = (db, id) => db.series.find((s) => s.id === id);
const atOrBefore = (pts, y, f = () => true) => pts.filter((p) => p.value != null && f(p) && Math.floor(p.year) <= y).sort((a, b) => a.year - b.year).pop();

// Key figure for an organ in a given year. Returns { v (number for count-up), fmt (number -> string), text, k (caption), src, year } or null.
export function factAt(db, organ, Y) {
  const y = Math.floor(Y);
  switch (organ) {
    case 'energy': {
      const s = S2(db, 'datacenter_electricity'); if (!s) return null;
      const p = atOrBefore(s.points, y, (p) => !p.projection);
      if (!p) return { v: null, text: 'no estimate yet', k: `no IEA data center estimate before ${d3.min(s.points.filter((q) => !q.projection), (q) => q.year)}`, src: s.sources?.[0], file: 'series/datacenter_electricity.json' };
      return { v: p.value, fmt: (v) => `${Math.round(v)} TWh`, k: `data center electricity, ${Math.floor(p.year)} (IEA)`, ks: `data center electricity, ${Math.floor(p.year)}`, unit: 'TWh', src: (p.sources || s.sources)?.[0], year: p.year, file: 'series/datacenter_electricity.json' };
    }
    case 'chips': {
      const s = S2(db, 'nvidia_revenue'); if (!s || !s.data_center_points) return null;
      const p = atOrBefore(s.data_center_points, y);
      if (!p) return null;
      return { v: p.value * 1e6, fmt: (v) => `$${fmtSI(v)}`, k: `Nvidia Data Center revenue, FY${p.year}`, ks: `Nvidia data center revenue, FY${String(p.year).slice(2)}`, unit: 'US$', src: (p.sources || s.sources)?.[0], year: p.year, file: 'series/nvidia_revenue.json' };
    }
    case 'capital': {
      const s = S2(db, 'ai_private_investment'); if (!s) return null;
      const p = atOrBefore(s.points, y);
      if (!p) return null;
      return { v: p.value, fmt: (v) => `$${fmtSI(v)}`, k: `global private AI investment, ${p.year} (2021 dollars)${p.year < y ? ', latest year' : ''}`, ks: `private AI investment, ${p.year}`, unit: 'US$', src: s.sources?.[0], year: p.year, file: 'series/ai_private_investment.json' };
    }
    case 'models': {
      const s = S2(db, 'training_compute'); if (!s) return null;
      const p = s.points.filter((q) => q.value && q.year < y + 1).reduce((a, b) => (b.value > (a?.value || 0) ? b : a), null);
      if (!p) return null;
      return { v: Math.log10(p.value), fmt: (v) => `${fmtFLOP(Math.pow(10, v))} FLOP`, k: y >= 2026 ? `largest training run to date: ${p.label} (Epoch AI)` : `largest training run by ${y}: ${p.label}`, ks: y >= 2026 ? `largest training run to date` : `largest training run by ${y}`, unit: 'FLOP', src: s.sources?.[0], year: p.year, file: 'series/training_compute.json' };
    }
    case 'data': {
      const s = S2(db, 'arxiv_ai'); if (!s) return null;
      const p = atOrBefore(s.points, y);
      if (!p) return null;
      return { v: p.value, fmt: (v) => `${fmtSI(Math.round(v))} papers`, k: `AI papers on arXiv, ${Math.floor(p.year)}${Math.floor(p.year) >= 2026 ? ' (partial year)' : ''}`, ks: Math.floor(p.year) >= 2026 ? `arXiv AI papers so far, ${Math.floor(p.year)}` : `AI papers on arXiv, ${Math.floor(p.year)}`, unit: 'papers', src: s.sources?.[0], year: p.year, file: 'series/arxiv_ai.json' };
    }
    case 'talent': {
      const s = S2(db, 'ai_publications'); if (!s) return null;
      const p = atOrBefore(s.points, y);
      if (!p) return null;
      return { v: p.value, fmt: (v) => `${fmtSI(Math.round(v))} publications`, k: `AI publications worldwide, ${p.year}${p.year < y ? ', latest year' : ''}`, ks: `AI publications worldwide, ${p.year}`, unit: 'publications', src: s.sources?.[0], year: p.year, file: 'series/ai_publications.json' };
    }
    case 'users': {
      const s = S2(db, 'time_to_100m_users'); if (!s) return null;
      const cands = s.points.filter((p) => p.year <= y && p.value != null);
      const p = cands.reduce((a, b) => (!a || b.value < a.value ? b : a), null);
      if (!p) return null;
      // the measure each product's figure counts (sign-ups, estimated monthly actives) comes from the point's detail
      const measure = /sign-ups/i.test(p.detail || '') ? '100M sign-ups' : '100M users';
      return { v: p.value, fmt: (v) => (v < 1 ? `${Math.round(v * 30)} days` : `${+v.toFixed(v < 10 ? 1 : 0)} months`), k: `${p.label}: ${measure}, ${Math.floor(p.year)}; the fastest among products launched by ${y}`, ks: `${p.label}: ${measure}, ${Math.floor(p.year)}`, unit: 'time', src: (p.sources || s.sources)?.[0], year: p.year, file: 'series/time_to_100m_users.json' };
    }
    case 'products': {
      const s = S2(db, 'llm_inference_price'); if (!s) return null;
      const lines = (s.groups && typeof s.groups === 'object' ? Object.entries(s.groups).filter(([, p]) => Array.isArray(p)).map(([name, points]) => ({ name, points })) : [{ name: s.title, points: s.points || [] }]);
      const L = lines.find((l) => /GPT-4-0314/.test(l.name) && /MMLU/.test(l.name)) || lines[0];
      const pts = (L ? L.points : []).filter((p) => p.value != null && p.year < y + 1);
      if (!pts.length) return { v: null, text: 'no price yet', k: 'prices start with GPT-4 in 2023', ks: 'no prices before 2023', src: s.sources?.[0], file: 'series/llm_inference_price.json' };
      const p = pts.reduce((a, b) => (b.value < a.value ? b : a));
      return { v: Math.log10(p.value), fmt: (v) => `$${+Math.pow(10, v).toFixed(Math.pow(10, v) < 1 ? 3 : 2)} per 1M tokens`, k: `per 1M tokens at GPT-4 level, ${Math.floor(p.year)} (${p.label})`, ks: `cheapest GPT-4-level inference, ${Math.floor(p.year)}`, unit: 'US$ per 1M tokens', src: s.sources?.[0], year: p.year, file: 'series/llm_inference_price.json' };
    }
    case 'policy': {
      const list = (db.policy || []).filter((x) => x.year <= y);
      if (!db.policy || !db.policy.length) return null;
      return { v: list.length, fmt: (v) => `${Math.round(v)} measures`, k: `AI measures enacted, in force or introduced by ${y}`, ks: `AI measures on record, ${y}`, unit: 'measures', src: { title: 'Policy atlas, per-measure sources in the Policy section', url: '#v=policy' }, year: y, file: 'policy.json' };
    }
    case 'labs': {
      if (!db.orgById || !db.orgById.size) return null;
      const list = [...db.orgById.values()].filter((o) => o.t && o.t >= 2010 && o.t < y + 1);
      return { v: list.length, fmt: (v) => `${Math.round(v)} organizations`, k: `founded 2010 to ${y}, in this record (Lineage data)`, ks: `founded 2010 to ${y}, in this record`, unit: 'organizations', src: { title: 'Lineage data, per-organization sources in the Lineage strip', url: '#v=lineage' }, year: y, file: 'talent.json' };
    }
    default: return null;
  }
}

// Relative magnitude 0..1 for a flow in a year, used for particle speed; null when no series applies (uniform speed).
export function flowMagnitude(db, key, Y) {
  const y = Math.floor(Y);
  const ratio = (pts, val = (p) => p.value, log = false) => {
    const P = pts.filter((p) => val(p) != null);
    if (!P.length) return null;
    const p = P.filter((q) => Math.floor(q.year) <= y).sort((a, b) => a.year - b.year).pop();
    if (!p) return 0.05;
    const T = log ? (v) => Math.log10(v) : (v) => v;
    const lo = log ? T(d3.min(P, val)) : 0, hi = T(d3.max(P, val));
    return hi > lo ? Math.max(0, Math.min(1, (T(val(p)) - lo) / (hi - lo))) : null;
  };
  switch (key) {
    case 'datacenter_electricity': { const s = S2(db, key); return s ? ratio(s.points.filter((p) => !p.projection)) : null; }
    case 'nvidia_datacenter': { const s = S2(db, 'nvidia_revenue'); return s && s.data_center_points ? ratio(s.data_center_points) : null; }
    case 'ai_private_investment': case 'arxiv_ai': case 'ai_publications': { const s = S2(db, key); return s ? ratio(s.points) : null; }
    case 'training_compute': { const s = S2(db, key); if (!s) return null; const P = s.points.filter((p) => p.value && p.year >= 2010); const m = d3.max(P.filter((p) => p.year < y + 1), (p) => p.value); if (!m) return 0.05; const lo = Math.log10(d3.min(P, (p) => p.value)), hi = Math.log10(d3.max(P, (p) => p.value)); return (Math.log10(m) - lo) / (hi - lo); }
    case 'policy_count': { const P = db.policy || []; if (!P.length) return null; return P.filter((x) => x.year <= y).length / P.length; }
    default: return null;
  }
}

// Raw yearly series behind a flow, for the flow panel's sparkline: { name, unit, points: [{year, value}], src } or null.
export function flowSeries(db, key) {
  const pick = (s, pts, name, unit) => (s && pts && pts.length ? { name: name || s.title, unit: unit || s.unit || '', points: pts.filter((p) => p.value != null).map((p) => ({ year: Math.floor(p.year), value: p.value })).sort((a, b) => a.year - b.year), src: s.sources?.[0] } : null);
  switch (key) {
    case 'datacenter_electricity': { const s = S2(db, key); return pick(s, s && s.points.filter((p) => !p.projection), 'data center electricity', 'TWh'); }
    case 'nvidia_datacenter': { const s = S2(db, 'nvidia_revenue'); return pick(s, s && (s.data_center_points || []).map((p) => ({ ...p, value: p.value * 1e6 })), 'Nvidia data center revenue', 'US$'); }
    case 'ai_private_investment': { const s = S2(db, key); return pick(s, s && s.points, 'private AI investment', 'US$'); }
    case 'arxiv_ai': { const s = S2(db, key); return pick(s, s && s.points, 'AI papers on arXiv', 'papers'); }
    case 'ai_publications': { const s = S2(db, key); return pick(s, s && s.points, 'AI publications', 'publications'); }
    case 'training_compute': { const s = S2(db, key); if (!s) return null; const P = s.points.filter((p) => p.value && p.year >= 2010); const ys = d3.range(2010, 2027).map((y) => ({ year: y, value: d3.max(P.filter((p) => p.year < y + 1), (p) => p.value) || null })); return pick(s, ys, 'largest training run', 'FLOP'); }
    case 'policy_count': { const P = db.policy || []; if (!P.length) return null; return { name: 'AI measures on the books', unit: 'measures', points: d3.range(2010, 2027).map((y) => ({ year: y, value: P.filter((x) => x.year <= y).length })), src: { title: 'Policy atlas', url: '#v=policy' } }; }
    default: return null;
  }
}
export const fmtFlowValue = (v, unit) => (unit === 'US$' ? `$${fmtSI(v)}` : unit === 'FLOP' ? fmtFLOP(v) : unit === 'TWh' ? `${Math.round(v)} TWh` : fmtSI(Math.round(v)));

// Card markup. opts: { node, X (explainers json), fact, flows (in/out lists with labels), events (landmark events), count, year, color }
export function cardHTML({ node, X, fact, flowsIn, flowsOut, events, count, year }) {
  const ex = (X.organs || {})[node.id] || {};
  const layerLabel = (k) => ((X.layers || {})[k] || {}).label || k;
  const flowRow = (f, dir) => `<li><button type="button" data-go="${esc(f.other.id)}" style="--c:${f.other.color}"><span class="arr">${dir === 'in' ? '&larr;' : '&rarr;'}</span><b>${esc(f.other.label)}</b><span class="fl">${esc(f.label)}</span><span class="ly">${esc(layerLabel(f.layer))}</span></button>${f.note ? `<p>${esc(f.note)}</p>` : ''}</li>`;
  const num = fact ? (fact.v == null ? `<b class="num muted">${esc(fact.text || 'no figure')}</b>` : `<b class="num" data-count>${esc(fact.fmt(fact.v))}</b>`) : '<b class="num muted">no figures for this organ</b>';
  const src = fact && fact.src ? `<a href="${esc(fact.src.url)}" target="_blank" rel="noopener">${esc(fact.src.title && fact.src.title.length < 70 ? fact.src.title : host(fact.src.url))}</a>` : '';
  return `
    <div class="ax-head" style="--c:${node.color}">
      <span class="sc">${esc(node.label)} &middot; ${esc(node.organ)}</span>
      <button type="button" class="ax-close" data-close aria-label="Close explainer">&times;</button>
    </div>
    <div class="ax-body">
      <h3>What it is</h3>
      ${(ex.what || []).map((s) => `<p>${esc(s)}</p>`).join('')}
      <h3>Key number, ${year}</h3>
      <div class="ax-num">${num}<span class="k">${fact ? esc(fact.k) : ''}</span>${src ? `<span class="src">Source: ${src}</span>` : ''}${ex.number && ex.number.how ? `<span class="how">${esc(ex.number.how)}</span>` : ''}</div>
      <h3>How it connects</h3>
      <ul class="ax-flows">${flowsIn.map((f) => flowRow(f, 'in')).join('')}${flowsOut.map((f) => flowRow(f, 'out')).join('')}</ul>
      <h3 id="ax-landmarks">Landmarks <small>${count} events in the record for this organ</small></h3>
      <ul class="ax-ev">${events.map((e) => `<li><button type="button" data-ev="${esc(e.id)}"><span class="y">${e.year}</span><span class="t">${esc(e.title)}</span></button></li>`).join('')}</ul>
    </div>
    <div class="ax-more"><button type="button" data-more>Landmarks <span aria-hidden="true">&darr;</span></button></div>`;
}
