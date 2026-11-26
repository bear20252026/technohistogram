// PATTERNS: nine recurring structures computed from the corpus by build_data.py (site/data/patterns.json).
// The build writes titles and overviews from the computed numbers; patterns_calc.js repeats that computation in the browser
// so a reader can move its constants and watch the sentence recompute. This file draws and holds the controls.
//
// Visual lift (Oct 2026, DESIGN_BRIEF.md): each finding opens with its key number as the dominant numeral; a strip of nine
// small multiples at the top and a sticky rail carry the same numbers live; charts draw in by date order the first time they
// scroll into view; a settings change morphs the same marks to their new places with the prior state left as a ghost;
// named examples are labeled directly on hairline leaders; every chart ends in an encoding contract and a source line;
// hovering any example pins its events on the shared year rail at the foot of the page.
import { placeLabels } from '../labels.js';
import { esc, scrubMark, openList } from '../ui.js';
import { members } from './patterns_members.js';
import { DOMAIN, domainColor } from '../palette.js';
import { set as setState } from '../store.js';
import { timeScale, YEAR_MAX, REGION, regionColor, AGES } from '../time.js';
import { DEFAULTS, COMPUTE, context, median } from './patterns_calc.js';

const dl = (id) => (DOMAIN[id] ? DOMAIN[id].label : id);
// Color direction (VISION_4.md): History's five families, each a hue family in steps 1 (palest) to 5 (darkest); a mark takes the
// family of its domain, a poster cell one family with steps. Tokens are CSS custom properties on .fd (lift_patterns.css),
// to be pointed at palette.css when it lands.
const FAMILY = { computing: 'signal', chips: 'signal', internet: 'signal', comms: 'signal', media: 'know', society: 'know', software: 'know', energy: 'power', materials: 'power', transport: 'move', space: 'move', biotech: 'life', health: 'life', agriculture: 'life', home: 'know', ai: 'ai' };
// palette.css names each member domain's own shade: --h-<family>-<domain>-5 (semiconductors and communications for chips and comms)
const PAL_FAMILY = { signal: 'signal', know: 'knowledge', power: 'power', move: 'movement', life: 'life', ai: 'ai' };
const PAL_DOMAIN = { chips: 'semiconductors', comms: 'communications' };
const fam = (f, k) => `var(--fd-${f}-${k})`;
const famColor = (domain) => (domain === 'ai' ? 'var(--h-ai-5)' : FAMILY[domain] ? `var(--h-${PAL_FAMILY[FAMILY[domain]]}-${PAL_DOMAIN[domain] || domain}-5, ${fam(FAMILY[domain], 5)})` : 'var(--ink-2)');
const regionHue = (id) => `var(--h-region-${(id || '').split('-')[0]}, ${regionColor(id)})`;
// the family of each poster cell
const CELL_FAMILY = { 'lag-era': 'signal', pairs: 'power', cycles: 'know', hypecount: 'know', 'ai-cycles': 'ai', cooccur: 'move', spill: 'power', diffusion: 'life', sentiment: 'know', regions: 'signal' };
const HOPE = fam('know', 2), FEAR = fam('know', 5); // hope above the line in ink, fear below in a muted brick (DESIGN_BRIEF.md: red means selection or annotation only)
const yrs = (n) => (n == null || !Number.isFinite(n) ? 'no' : `${Number.isInteger(n) ? n : n.toFixed(1)} year${n === 1 ? '' : 's'}`);
const pretty = (t) => String(t).replace(/-/g, ' ');
const num1 = (n) => (n == null ? '' : Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''));
const REDUCED = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Controls per pattern: two or three word labels, each moving one constant of the computation in patterns_calc.js.
const SIG = { k: 'sig', label: 'Min significance', min: 1, max: 5, step: 1 };
const PARAMS = {
  'lag-era': [{ k: 'lag.c1', label: 'First break', min: 1800, max: 1990, step: 10, note: 'shapes the periods; the median holds' }, { k: 'lag.c2', label: 'Second break', min: 1950, max: 2015, step: 5, note: 'shapes the periods; the median holds' }, { k: 'lag.c3', label: 'Third break', min: 2000, max: 2024, step: 1, note: 'shapes the periods; the median holds' }, { k: 'lag.far', label: 'Max gap', min: 50, max: 1000, step: 50, unit: 'y', note: 'shapes the chart; the median holds' }, SIG],
  pairs: [{ k: 'disaster.quick', label: 'Response window', min: 0, max: 10, step: 1, unit: 'y' }, { k: 'disaster.bin', label: 'Period length', min: 10, max: 100, step: 5, unit: 'y', note: 'shapes the chart; the share holds' }, SIG],
  cycles: [{ k: 'hype.smooth', label: 'Smoothing', min: 1, max: 9, step: 1, unit: 'y' }, { k: 'hype.mag', label: 'Min swing', min: 0.5, max: 6, step: 0.5 }, SIG],
  'ai-cycles': [{ k: 'winters.smooth', label: 'Smoothing', min: 1, max: 15, step: 2, unit: 'y' }, { k: 'winters.prom', label: 'Min dip', min: 1, max: 20, step: 1, unit: 'pts' }, { k: 'winters.start', label: 'Start year', min: 1930, max: 1990, step: 1 }, SIG],
  cooccur: [{ k: 'themes.min', label: 'Min shared', min: 3, max: 20, step: 1, note: 'shapes the arcs; the centuries hold' }, { k: 'themes.persist', label: 'Long-lived from', min: 4, max: 30, step: 1, note: 'shapes the arcs; the centuries hold' }, SIG],
  spill: [SIG],
  diffusion: [{ k: 'diffusion.lo', label: 'Low mark', min: 5, max: 40, step: 5, unit: '%' }, { k: 'diffusion.hi', label: 'High mark', min: 30, max: 90, step: 5, unit: '%' }, { k: 'diffusion.early', label: 'Early before', min: 1910, max: 1980, step: 5, note: 'shapes the comparison; the years hold' }, { k: 'diffusion.late', label: 'Late since', min: 1960, max: 2005, step: 5 }],
  sentiment: [{ k: 'sentiment.min', label: 'Decade floor', min: 1, max: 40, step: 1 }, SIG],
  regions: [{ k: 'regions.min', label: 'Age floor', min: 1, max: 40, step: 1, note: 'shapes the sentence; the share holds' }, SIG],
};
PARAMS.hypecount = PARAMS.cycles; // the count and the turns share the hype settings
const getK = (o, k) => k.split('.').reduce((a, x) => a[x], o);
const setK = (o, k, v) => { const ks = k.split('.'); const last = ks.pop(); ks.reduce((a, x) => a[x], o)[last] = v; };
const clone = (o) => JSON.parse(JSON.stringify(o));

const KIND_LABEL = { 'lag-era': 'invention-to-rule links', pairs: 'disaster, then rule', cycles: 'hype, crash, recovery', hypecount: 'hype items a year', 'ai-cycles': 'AI winters and booms', cooccur: 'themes that travel together', spill: 'spillovers', diffusion: 'diffusion speeding up', sentiment: 'sentiment swings', regions: 'where events cluster' };

// The one number each finding turns on, with its unit and a short label; drawn at 5 to 10x the label (library: one numeral carries navigation).
// Read from the computed pattern so it follows the reader's settings.
function keyOf(p, q) {
  if (p.figure) return { cmp: '', ...p.figure }; // written by patterns_calc beside the title, from the same variables
  const S = p.stats || {};
  switch (p.kind) {
    case 'lag-era': {
      const per = (p.periods || []).filter((x) => x.n);
      const late = [...per].reverse().find((x) => x.n >= 3) || per[per.length - 1];
      if (!late) return { n: num1(S.median_lag), unit: 'yr', label: 'median gap, recorded invention-to-rule links' };
      let early = per.find((x) => x.from < q.lag.c2 && x.n >= 3) || null;
      if (early && early.from < q.lag.c1) { const v = (p.pairs || []).filter((d) => d.year < q.lag.c2).map((d) => d.lag); early = { label: `before ${q.lag.c2}`, median_lag: median(v) }; }
      return { n: num1(late.median_lag), unit: late.median_lag === 1 ? 'yr' : 'yrs', label: `median gap for rules of the ${late.label}, ${late.n} links`, cmp: early && early !== late ? `${yrs(early.median_lag)} ${early.label}` : '' };
    }
    case 'pairs': return { n: String(Math.round((S.share_within_2 || 0) * 100)), unit: '%', label: `of disaster-linked rules within ${q.disaster.quick} year${q.disaster.quick === 1 ? '' : 's'}`, cmp: S.median_lag != null ? `median gap ${yrs(S.median_lag)}` : '' };
    case 'cycles': return { n: String(S.episodes || 0), unit: S.episodes === 1 ? 'bust' : 'busts', label: `boom-to-bust turns since ${(p.episodes && p.episodes[0] && p.episodes[0].peak) || ''}`, cmp: S.median_fall != null ? `fall ${yrs(S.median_fall)}${S.median_rebound != null ? `, recovery ${yrs(S.median_rebound)}` : ''}` : '' };
    case 'ai-cycles': return S.mean_gap != null ? { n: num1(S.mean_gap), unit: 'yrs', label: 'between troughs in AI\u2019s share of the record', cmp: `${S.troughs} troughs since ${q.winters.start}, last ${S.last_trough}` } : { n: String(S.troughs || 0), unit: S.troughs === 1 ? 'trough' : 'troughs', label: `in AI\u2019s share of the record since ${q.winters.start}`, cmp: S.last_trough ? `last ${S.last_trough}` : '' };
    case 'cooccur': { const P = S.persistent || S.top; return P ? { n: String(P.centuries), unit: P.centuries === 1 ? 'century' : 'centuries', label: `${pretty(P.a)} and ${pretty(P.b)} tagged together`, cmp: `${P.n} shared events, ${P.first} to ${P.last}` } : { n: String(S.pairs || 0), unit: 'pairs', label: 'theme pairings' }; }
    case 'spill': {
      const mil = S.military && S.military.median_lag != null, lab = S.lab && S.lab.median_lag != null;
      if (mil) return { n: num1(S.military.median_lag), unit: 'yrs', label: 'from a military origin to open use', cmp: lab ? `lab result to product: ${yrs(S.lab.median_lag)}` : 'no lab-to-product pair at this significance' };
      if (lab) return { n: num1(S.lab.median_lag), unit: 'yrs', label: 'from a lab result to a product', cmp: 'no military pair at this significance' };
      return { n: '0', unit: 'pairs', label: 'meet this significance', cmp: '' };
    }
    case 'diffusion': { const v = S.median_since_1990 != null ? S.median_since_1990 : S.median_before_1950; return { n: num1(v), unit: 'yrs', label: `from ${q.diffusion.lo}% to ${q.diffusion.hi}% of US homes, since ${q.diffusion.late}`, cmp: S.median_before_1950 != null ? `before ${q.diffusion.early}: ${yrs(S.median_before_1950)}` : '' }; }
    case 'sentiment': { const mf = (p.decades || []).find((d) => d.decade === S.most_fearful_decade); return { n: String(S.sign_changes), unit: S.sign_changes === 1 ? 'flip' : 'flips', label: 'between net hope and net fear since the 1920s', cmp: mf && mf.mean != null ? `most fearful: the ${mf.decade}s (${mf.mean.toFixed(2)})` : '' }; }
    case 'regions': {
      const ages = (p.ages || []).filter((a) => a.n);
      const last = ages[ages.length - 1], first = ages[0];
      const top = (a) => Object.entries(a.regions).sort((u, v) => v[1] - u[1])[0];
      if (!last) return { n: '', unit: '', label: '' };
      const [r, n] = top(last);
      const f = first && first !== last ? top(first) : null;
      const ageName = (a) => (a.label || a.id);
      return { n: String(Math.round((n / last.n) * 100)), unit: '%', label: `of located events in ${REGION[r] ? REGION[r].label : r}, ${ageName(last)}`, cmp: f ? `${REGION[f[0]] ? REGION[f[0]].short : f[0]} ${Math.round((f[1] / first.n) * 100)}% in ${ageName(first)}` : '' };
    }
    default: return { n: '', unit: '', label: '' };
  }
}

export default function patterns(el, { db, select, tip }) {
  el.classList.add('scroll-y');
  const byId = db.byId;
  const ctxCache = new Map();
  const ctxFor = (sig) => { if (!ctxCache.has(sig)) ctxCache.set(sig, context(db.events, sig)); return ctxCache.get(sig); };
  const adoption = () => db.series.find((x) => x.id === 'adoption');
  // Every title and figure is computed here, on the defaults, from the record now loaded (patterns_calc writes the
  // title and the figure from the same variables); the build's patterns.json supplies the id, kind and anything the
  // calc does not carry, and stands in only if a computation fails.
  const specs = (db.patterns || []).flatMap((b) => (b.id === 'hype-crash-recovery' ? [b, { id: 'hype-count', kind: 'hypecount' }] : [b]));
  if (!specs.some((b) => b.id === 'hype-count') && specs.length) specs.push({ id: 'hype-count', kind: 'hypecount' });
  const base = specs.map((b) => {
    try { const q = clone(DEFAULTS); const c = COMPUTE[b.id] ? COMPUTE[b.id](ctxFor(q.sig), adoption(), q) : null; return c ? { ...b, ...c } : b; } catch (err) { console.error('pattern', b.id, err); return b; }
  });
  const cur = new Map(base.map((p) => [p.id, p])); // the pattern as drawn now: computed on defaults, recomputed after a change
  // Vision 4, S8: Pattern 09 (regional clusters) measures where the compilers' events are located, who built the record
  // rather than the world, so it leaves the index and the count; its code stays reachable by #v=patterns&f=regional-clusters
  const CUT = new Set(['regional-clusters']);
  const fParam = (new URLSearchParams(location.hash.slice(1)).get('f') || '').replace(/[^a-z0-9-]/g, '');
  const shown = base.filter((p) => !CUT.has(p.id) || p.id === fParam);
  const nIndex = shown.filter((p) => !CUT.has(p.id)).length; // the count the index and the kickers state
  const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  // the sample behind a figure, in the unit the figure counts: beside every numeral and in the index
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const sampleOf = (p) => {
    const S = p.stats || {};
    switch (p.kind) {
      case 'lag-era': return `${p.pairs.length} recorded links`;
      case 'pairs': return `${p.pairs.length} recorded links`;
      case 'cycles': return `${nf(S.n)} scored items`;
      case 'ai-cycles': { const ai = (p.years || []).reduce((a, r) => a + (r.ai || 0), 0); return `${nf(ai)} AI events in ${(p.years || []).length} years`; }
      case 'cooccur': return `${S.pairs || 0} theme pairings`;
      case 'spill': return `${((S.military && S.military.n) || 0) + ((S.lab && S.lab.n) || 0)} recorded links`;
      case 'diffusion': return `${(p.rows || []).length} technologies`;
      case 'sentiment': return `${nf(S.n)} scored items`;
      case 'regions': return `${nf(S.n)} located events`;
      default: return '';
    }
  };
  const params = new Map(base.map((p) => [p.id, clone(DEFAULTS)]));
  const noCall = new Set();
  const keepGhost = new Set(); // patterns whose ghost of the prior state stays after the morph (the Keep ghost toggle)
  const ghosts = new Map(); // id -> { g: cloned data layer of the state before the current interaction, key, title }
  const revealed = new Set(); // charts that have already drawn in
  const kindOf = (id) => base.find((b) => b.id === id).kind;
  const changed = (id) => { const q = params.get(id), d = DEFAULTS; return (PARAMS[kindOf(id)] || []).some((c) => getK(q, c.k) !== getK(d, c.k)); };
  const segs = (ov) => (ov || []).map((s) => (s.e && byId.get(s.e) ? `<span class="pt-link" role="link" tabindex="0" data-id="${esc(s.e)}">${esc(s.t)}</span>` : esc(s.t))).join('');
  const shortOf = (id, fallback) => { const e = byId.get(id); if (!e) return fallback; const t = e.title_short || e.title; return t.includes(String(e.year)) ? t : `${t}, ${e.year}`; };
  const nEvents = db.events.filter((e) => e.kind !== 'overlay').length.toLocaleString('en-US'); // the census rule: overlays are never events

  // On phones the slider a thumb reaches first is one that moves the headline figure; the still ones (a note under the
  // label) follow. Done in DOM order, not CSS order, so assistive tech, tab order and a tap on the first slider agree.
  const PHONE = window.matchMedia('(max-width: 760px), (pointer: coarse)');
  const ctlOrder = (list) => (PHONE.matches ? [...list.filter((c) => !c.note), ...list.filter((c) => c.note)] : list);
  const ctlHtml = (p) => `<div class="pt-play" role="group" aria-label="Settings for this pattern">
      ${ctlOrder(PARAMS[p.kind] || []).map((c, i) => { const v = getK(params.get(p.id), c.k); return `<label class="pp-c${c.note ? ' has-note still' : ''}" data-i="${(PARAMS[p.kind] || []).indexOf(c)}"><span class="pp-l">${esc(c.label)}${c.note ? `<small class="pp-note">${esc(c.note)}</small>` : ''}</span><input type="range" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}" aria-label="${esc(c.label)}"><output>${v}${c.unit || ''}</output></label>`; }).join('')}
      <div class="pp-act">
        <button type="button" class="pp-b" data-act="call" aria-pressed="true">Callouts</button>
        <button type="button" class="pp-b" data-act="ghost" aria-pressed="false" hidden title="Prior state stays on the chart as a ghost">Keep ghost</button>
        <button type="button" class="pp-b" data-act="copy">Copy list</button>
        <button type="button" class="pp-b" data-act="csv">Download CSV</button>
        <button type="button" class="pp-b pp-reset" data-act="reset" hidden>Reset</button>
      </div>
    </div>`;
  const readHtml = (p) => `<span class="sc">Overview</span><p>${segs(p.overview)}</p>
        <div class="pt-notes">${p.exception ? `<div><span class="sc">Exception</span>${esc(p.exception)}</div>` : ''}${p.cannot ? `<div><span class="sc">What the record cannot tell</span>${esc(p.cannot)}</div>` : ''}${p.second ? `<div class="pt-second"><span class="sc">${esc(p.second.label)}</span>${esc(p.second.text)}<span class="pt-second-per">${p.second.periods.map((x) => `${esc(x.label)}: ${esc(yrs(x.median_lag))} over ${x.n} link${x.n === 1 ? '' : 's'}`).join(' · ')}</span></div>` : ''}</div>
        ${p.events && p.events.length ? `<details class="pt-det"><summary class="sc">Events behind this chart &middot; ${p.events.length}</summary><ul class="pt-ev">${p.events.map((id) => byId.get(id)).filter(Boolean).map((e) => `<li><button type="button" data-id="${esc(e.id)}"><i style="background:${domainColor(e.domain)}"></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button></li>`).join('')}</ul></details>` : ''}`;
  const keyHtml = (k) => `<span class="pt-big" aria-hidden="true">${esc(k.n)}<small>${esc(k.unit)}</small></span><span class="pt-numl">${esc(k.label)}</span><span class="pt-cmp">${esc(k.cmp || '')}</span><span class="pt-was" hidden></span>`;
  const keyText = (k) => `${k.n} ${k.unit}, ${k.label}`;
  // Dots that would land on one another (the compressed axis and the square-root lag scale make this common in the
  // 2010s and 2020s) are settled by a short collision pass: each dot is pulled to its true year and lag and pushed off
  // its neighbours by a 4.2px radius, so every dot stays visible and is its own hover target; its stem follows it.
  // Deterministic for a given record (d3's seeded jiggle). Stems and ticks take no pointer events.
  const dodge = (pairs, xf, yf, yMax, xRange) => {
    const nodes = pairs.map((d) => ({ d, x: xf(d), y: yf(d), tx: xf(d), ty: yf(d) }));
    const R = 4.2, D = R * 2;
    const sim = d3.forceSimulation(nodes).force('x', d3.forceX((n) => n.tx).strength(0.3)).force('y', d3.forceY((n) => n.ty).strength(0.8)).force('c', d3.forceCollide(R).iterations(4)).stop();
    for (let i = 0; i < 120; i++) { sim.tick(); if (yMax != null) for (const n of nodes) if (n.y > yMax) { n.y = yMax; n.vy = 0; } }
    // settle whatever the forces left: any two dots closer than a diameter are pushed apart along x, symmetric, until none remain
    const sorted = nodes.slice().sort((u, v) => u.x - v.x);
    for (let pass = 0; pass < 150; pass++) {
      let moved = false;
      for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length && sorted[j].x - sorted[i].x < D; j++) {
        const a = sorted[i], b = sorted[j], dy = Math.abs(a.y - b.y); if (dy >= D) continue;
        const need = Math.sqrt(D * D - dy * dy) - Math.abs(b.x - a.x) + 0.2; if (need <= 0) continue;
        const atR = xRange && b.x >= xRange[1] - 0.01, atL = xRange && a.x <= xRange[0] + 0.01;
        if (atR && !atL) a.x -= need; else if (atL && !atR) b.x += need; else { a.x -= need / 2; b.x += need / 2; }
        moved = true;
      }
      if (xRange) for (const n of sorted) { if (n.x > xRange[1]) { n.x = xRange[1]; moved = true; } else if (n.x < xRange[0]) { n.x = xRange[0]; moved = true; } }
      if (!moved) break;
      sorted.sort((u, v) => u.x - v.x);
    }
    const pos = new Map(nodes.map((n) => [n.d, n]));
    return { x: (d) => pos.get(d).x, y: (d) => pos.get(d).y };
  };
  const SINGULAR = { yrs: 'yr', busts: 'bust', troughs: 'trough', centuries: 'century', flips: 'flip', pairs: 'pair' };
  const PLURAL = Object.fromEntries(Object.entries(SINGULAR).map(([a, b]) => [b, a]));
  // one figure, its unit agreeing with the number: "1 yr", "4 busts", "0 troughs"
  const normKey = (k) => { if (!k) return k; const one = k.n === '1'; const u = one ? SINGULAR[k.unit] || k.unit : PLURAL[k.unit] || k.unit; return { ...k, unit: u }; };
  const keyId = (k) => `${k.n}|${k.unit}`;
  // the glance card carries the figure's first clause ("of located events in North America"); the card on the article has the whole label

  // ---------- the lines on screen, written from the figure's own values (the measured title and its counts live in the panel) ----------
  const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const small = (n) => (Number.isInteger(n) && n >= 0 && n <= 10 ? SMALL[n] : String(n));
  const yrsPlain = (n) => (n === 1 ? 'a year' : `${Number.isInteger(n) ? n : Number(n).toFixed(1)} years`);
  // the meaning, as a sentence of eight words or fewer
  const aboutYears = (n) => (n == null ? '' : n < 0.5 ? 'within a year' : Math.round(n) === 1 ? 'about a year' : `about ${Math.round(n)} years`);
  const cardOf = (p) => {
    const S = p.stats || {}, q = params.get(p.id) || DEFAULTS, k = { pre: '', ...normKey(keyOf(p, q)) };
    if (p.empty) return k;
    switch (p.kind) {
      case 'lag-era': { const { late } = lagEnds(p); return late && late.median_lag != null ? { ...k, n: num1(late.median_lag), unit: late.median_lag === 1 ? 'yr' : 'yrs' } : k; } // the computed late median
      case 'hypecount': return { ...k, n: String(S.busiest || ''), unit: '', cmp: `${S.busiest_n || ''} items that year` };
      case 'ai-cycles': return S.troughs ? { ...k, n: String(S.troughs), unit: S.troughs === 1 ? 'dip' : 'dips', cmp: S.mean_gap != null ? `${num1(S.mean_gap)} years between dips on average` : k.cmp } : k;
      case 'spill': return S.military && S.military.median_lag != null ? { ...k, pre: 'about', n: String(Math.round(S.military.median_lag)), unit: 'years' } : k;
      case 'diffusion': { const v = S.median_since_1990 != null ? S.median_since_1990 : S.median_before_1950; return v != null ? { ...k, pre: 'about', n: String(Math.round(v)), unit: 'years' } : k; }
      default: return k;
    }
  };
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t); // captions start with a capital (council round 8)
  const sayOf = (p) => cap(sayRaw(p));
  const sayRaw = (p) => {
    const S = p.stats || {}, F = p.figure || {}, q = params.get(p.id) || DEFAULTS;
    if (p.empty) return 'no result with these settings';
    switch (p.kind) {
      case 'lag-era': { const { late } = lagEnds(p); if (!late) return 'Recorded invention-to-rule gaps'; const others = (p.periods || []).filter((x) => x !== late && x.n >= 3).map((x) => x.median_lag); const shortest = others.every((v) => late.median_lag <= v); const first = (p.periods || []).find((x) => x.n >= 3); return shortest ? `Recorded invention-to-rule gaps: shortest now, ${aboutYears(late.median_lag)}` : first && first !== late && late.median_lag < first.median_lag ? `Recorded invention-to-rule gaps shrink to ${aboutYears(late.median_lag)}` : `Recorded invention-to-rule gaps now ${aboutYears(late.median_lag)}`; } // eight words at most: the gate counts the headline
      case 'pairs': { const pct = Math.round((S.share_within_2 || 0) * 100), w = q.disaster ? q.disaster.quick : 2; return pct >= 50 ? `Most rules after a disaster land within ${small(w)} year${w === 1 ? '' : 's'}` : `${pct}% of rules after a disaster land within ${small(w)} year${w === 1 ? '' : 's'}`; }
      case 'cycles': return `boom${S.episodes === 1 ? '' : 's'} ${S.episodes === 1 ? 'has' : 'have'} turned to bust${S.episodes === 1 ? '' : 's'} since ${p.episodes[0].peak}`;
      case 'hypecount': return S.busiest === YEAR_MAX ? 'This year is already the busiest for hype' : 'The busiest year for hype on record';
      case 'ai-cycles': { const y0 = q.winters ? q.winters.start : 1943; return S.troughs ? `AI\u2019s share has dipped ${S.troughs === 1 ? 'once' : S.troughs === 2 ? 'twice' : `${small(S.troughs)} times`} since ${y0}` : `AI\u2019s share has not dipped since ${y0}`; }
      case 'cooccur': { const per = S.persistent; return per ? `${per.a} and ${per.b} are the pair that lasts longest` : 'no pair of themes persists'; }
      case 'spill': return S.military && S.military.median_lag != null ? 'How long military ideas take to get out' : 'Too few spillovers to time';
      case 'diffusion': return S.median_since_1990 != null ? `Since ${q.diffusion ? q.diffusion.late : 1990}, halfway takes ${aboutYears(S.median_since_1990)}` : 'Adoption times by decade of arrival';
      case 'sentiment': { const mm = /since the (\d{4})s/.exec(F.label || ''); return S.sign_changes ? `hope and fear have traded places since the ${mm ? mm[1] : 1920}s` : `hope and fear have not traded places since the ${mm ? mm[1] : 1920}s`; }
      case 'regions': return `${F.label ? F.label.replace(/^of located events in /, '').split(',')[0] : 'one region'} holds most located events now`;
      default: return p.title || '';
    }
  };
  // the early and late periods the lag finding compares (as patterns_calc chose them: the latest period with three links or more, and the periods before the middle cut)
  const lagEnds = (p) => { const per = p.periods || []; const late = [...per].reverse().find((x) => x.n >= 3) || null; const q = params.get(p.id) || DEFAULTS; const c = q.lag || DEFAULTS.lag; let early = per.find((x) => x.from < c.c2 && x.n >= 3) || null; if (early && early.from < c.c1) { const v = (p.pairs || []).filter((d) => d.year < c.c2).map((d) => d.lag); early = { label: `before ${c.c2}`, n: v.length, median_lag: d3.median(v) }; } return { early, late }; };
  const yrsWord = (n) => (n === 1 ? 'one year' : n === 0 ? 'under a year' : `${Number.isInteger(n) ? small(n) : Number(n).toFixed(1)} years`);
  // the figure's label on screen, without counts
  const labelOf = (p) => {
    if (p.kind === 'lag-era') { const { late } = lagEnds(p); return late ? `For rules dated ${late.from || late.label.replace(/\D/g, '')} onward, the median gap is ${yrsWord(late.median_lag)}.` : `The median gap is ${yrsWord((p.stats || {}).median_lag)}.`; }
    const k = normKey(keyOf(p, params.get(p.id))), lab = k.label || '';
    return lab.replace(/,?\s*(over\s+)?\d[\d,]*\s+of\s+\d[\d,]*\s+links?/g, '').replace(/,\s*\d[\d,]*\s+links?\b/g, '').replace(/\s*\(\d[^)]*\)/g, '').replace(/,\s*$/, '').trim();
  };
  const besideOf = (p) => {
    if (p.kind === 'lag-era' && p.pairs) { const n20 = p.pairs.filter((d) => d.year >= 2020).length; return n20 > p.pairs.length / 2 ? 'Most recorded links involve rules from the 2020s.' : n20 > p.pairs.length / 4 ? 'Many recorded links involve rules from the 2020s.' : ''; }
    return '';
  };
  // the sample, for the source line under the chart: "105 of 124 recorded links" (the lag finding keeps its counts in the panel)
  const nLine = (p) => {
    const S = p.stats || {};
    switch (p.kind) {
      case 'lag-era': return 'recorded invention-to-rule links';
      case 'pairs': return `${Math.round((S.share_within_2 || 0) * p.pairs.length)} of ${p.pairs.length} recorded links`;
      case 'cycles': return `${nf(S.n)} items tagged bubble or hype cycle`;
      case 'hypecount': return `${S.busiest_n} of ${nf(S.n)} items tagged bubble or hype cycle`;
      case 'ai-cycles': { const ai = (p.years || []).reduce((a, r) => a + (r.ai || 0), 0); return `${nf(ai)} AI events in ${(p.years || []).length} years of the record`; }
      case 'cooccur': return `${S.persistent ? S.persistent.shared : 0} shared events, ${nf(S.pairs)} theme pairings`;
      case 'spill': return `${(S.military && S.military.n) || 0} military and ${(S.lab && S.lab.n) || 0} lab-to-market recorded links`;
      case 'diffusion': return `${(p.rows || []).filter((r) => r.year10 >= 1990).length} of ${(p.rows || []).length} technologies arrived since 1990`;
      case 'sentiment': return `${nf(S.n)} scored items in ${(p.decades || []).length} decades`;
      case 'regions': return `${nf(S.n)} events with a region`;
      default: return sampleOf(p);
    }
  };
  let active = null; // the finding on screen; null is the grid
  const navHtml = (i) => { const prev = shown[i - 1], next = shown[i + 1]; return `<nav class="pt-nav" aria-label="Other findings">${prev ? `<button type="button" data-jump="${esc(prev.id)}"><span class="sc">Previous</span><span>${String(i).padStart(2, '0')} ${esc(KIND_LABEL[prev.kind] || prev.kind)}</span></button>` : '<span></span>'}<button type="button" data-act="grid" class="mid"><span class="sc">All findings</span></button>${next ? `<button type="button" data-jump="${esc(next.id)}" class="next"><span class="sc">Next</span><span>${String(i + 2).padStart(2, '0')} ${esc(KIND_LABEL[next.kind] || next.kind)}</span></button>` : '<span></span>'}</nav>`; };
  el.innerHTML = `<div class="sh-wrap pt-wrap fd">
    <header class="sh-head pt-top fd-top"><h2>What recurs across the record</h2></header>
    <ol class="fd-grid" aria-label="Findings">${shown.map((p, i) => { const k = cardOf(p); return `<li><button type="button" class="fd-cell" data-f="${esc(p.id)}" data-fam="${CELL_FAMILY[p.kind] || 'signal'}"><span class="fd-ix">${String(i + 1).padStart(2, '0')}</span><span class="fd-num"${k.n ? '' : ' hidden'} data-u="${esc(k.unit)}"><small class="pre">${esc(k.pre)}</small><b>${esc(k.n)}</b><small>${esc(k.unit)}</small></span><svg class="fd-mini" aria-hidden="true"></svg><span class="fd-say">${esc(sayOf(p))}</span></button></li>`; }).join('')}</ol>
    <div class="pt-list">${shown.map((p, i) => `<article class="pt" id="p-${esc(p.id)}" data-p="${esc(p.id)}" data-fam="${CELL_FAMILY[p.kind] || 'signal'}" hidden>
      <div class="pt-head">
        <div class="pt-tt"><span class="sc pt-index"><i class="pt-seal" aria-hidden="true"></i>${CUT.has(p.id) ? '<b>Outside the index</b>' : `<b>${String(i + 1).padStart(2, '0')}</b> of ${String(nIndex).padStart(2, '0')}`} &middot; ${esc(KIND_LABEL[p.kind] || 'pattern')}<em class="pp-mine" hidden> &middot; your settings</em></span><h3 class="pt-say" aria-live="polite">${esc(sayOf(p))}</h3>${CUT.has(p.id) ? '<p class="pt-cutnote">Not in the index: this finding measures where the compilers\u2019 events are located, so it describes who built the record.</p>' : ''}</div>
        <div class="pt-num" role="button" tabindex="0" data-behind="${esc(p.id)}" title="Events behind this number">${(() => { const k = cardOf(p); return `<span class="pt-big" aria-hidden="true"${k.n ? '' : ' hidden'} data-u="${esc(k.unit)}"><small class="pre">${esc(k.pre)}</small>${esc(k.n)}<small>${esc(k.unit)}</small></span>`; })()}<span class="pt-numl">${esc(labelOf(p))}</span><span class="pt-was" hidden></span></div>
      </div>
      <p class="pt-beside">${esc(besideOf(p))}</p>
      <div class="pt-chart"></div>
      <div class="pt-foot"><p class="pt-source"></p></div>
      ${navHtml(i)}
      <aside class="pt-panel" hidden aria-label="Method and evidence">
        <div class="pt-panel-h"><span class="sc">Method and evidence</span><button type="button" class="pt-panel-x" data-act="panel-close" aria-label="Close the panel">&times;</button></div>
        <h4 class="pt-mt">${esc(p.title)}</h4><p class="pt-sub">${esc(p.subtitle || '')}</p><p class="pt-cmp">${esc(cardOf(p).cmp || '')}</p>
        ${ctlHtml(p)}
        <div class="pt-contract"></div>
        <div class="pt-read">${readHtml(p)}</div>
      </aside>
    </article>`).join('')}</div>
    ${shown.length ? '' : '<div class="state-msg" style="position:static"><div><h2>No findings computed yet</h2><p>Findings are computed from the events at build time.</p></div></div>'}
  </div>`;
  const grid = el.querySelector('.fd-grid');

  // ---------- grow and focus: a cell grows into the one finding on screen; All findings returns to the grid ----------
  function activate(id, focus, fromCell) {
    if (!shown.some((p) => p.id === id)) return;
    const from = fromCell ? fromCell.getBoundingClientRect() : null;
    for (const a of el.querySelectorAll('article.pt')) { if (a.dataset.p !== id) { a.hidden = true; const pn = a.querySelector('.pt-panel'); if (pn) pn.hidden = true; } }
    active = id;
    grid.hidden = true;
    const art = el.querySelector(`#p-${CSS.escape(id)}`);
    art.hidden = false;
    el.scrollTop = 0;
    const c = cur.get(id); if (c && !c.empty) drawOne(c); // a hidden chart has no width, so it draws when shown
    if (from && !REDUCED() && art.animate) {
      const to = art.getBoundingClientRect();
      const sx = Math.max(0.2, from.width / to.width), sy = Math.max(0.2, from.height / to.height);
      art.style.transformOrigin = '0 0';
      art.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    if (focus) { const h = art.querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    syncing || setState({ screen: 2 }); // the shell's stepper reads screen 2 as one finding
  }
  function showGrid(focusId) {
    for (const a of el.querySelectorAll('article.pt')) { a.hidden = true; const pn = a.querySelector('.pt-panel'); if (pn) pn.hidden = true; }
    const was = active; active = null;
    grid.hidden = false;
    el.scrollTop = 0;
    drawMinis();
    const cell = grid.querySelector(`.fd-cell[data-f="${CSS.escape(focusId || was || '')}"]`); if (cell) cell.focus({ preventScroll: true });
    syncing || setState({ screen: 1 });
  }
  // the shell's screen stepper (hash s=): screen 1 is the grid, screen 2 one finding (the linked one, else the first)
  let syncing = false;
  function syncScreen(sc) {
    syncing = true;
    try { if (sc >= 2) { if (!active) activate(fParam && shown.some((p) => p.id === fParam) ? fParam : shown[0].id, false); } else if (active) showGrid(); } finally { syncing = false; }
  }
  function panel(id, open) {
    const art = el.querySelector(`#p-${CSS.escape(id)}`); if (!art) return;
    const pn = art.querySelector('.pt-panel'), bt = art.querySelector('[data-act="panel"]');
    pn.hidden = !open; if (bt) bt.setAttribute('aria-expanded', String(open));
    if (open) { const x = pn.querySelector('.pt-panel-x'); if (x) x.focus({ preventScroll: true }); if (PHONE.matches) reorderControls(art); } else if (bt) bt.focus({ preventScroll: true });
  }
  el.__ptActivate = (id) => activate(id, false);
  el.__ptGrid = () => showGrid();
  el.__ptPanel = (id, open = true) => panel(id, open);

  // ---------- live numbers: article numeral, rail and strip ----------
  function setKey(id, p) {
    const k = cardOf(p);
    const art = el.querySelector(`[data-p="${CSS.escape(id)}"]`);
    const big = art.querySelector('.pt-big'); let bigText = big.querySelector('small.pre').nextSibling; if (!bigText || bigText.nodeType !== 3) bigText = big.insertBefore(document.createTextNode(''), bigText); const old = bigText.nodeValue;
    big.querySelector('small:not(.pre)').textContent = k.unit; big.querySelector('small.pre').textContent = k.pre; big.hidden = !k.n; big.dataset.u = k.unit;
    tweenText(bigText, old, k.n);
    art.querySelector('.pt-numl').textContent = labelOf(p);
    art.querySelector('.pt-cmp').textContent = k.cmp || '';
    const cell = grid.querySelector(`.fd-cell[data-f="${CSS.escape(id)}"]`);
    if (cell) { const nm = cell.querySelector('.fd-num'), b = nm.querySelector('b'), sm = nm.querySelector('small:not(.pre)'), sy = cell.querySelector('.fd-say'); tweenText(b.firstChild || b.appendChild(document.createTextNode('')), b.firstChild && b.firstChild.nodeValue, k.n); sm.textContent = k.unit; nm.querySelector('small.pre').textContent = k.pre; nm.hidden = !k.n; nm.dataset.u = k.unit; sy.textContent = sayOf(p); }
    const g = ghosts.get(id);
    const was = art.querySelector('.pt-was');
    if (g && g.key && g.key !== keyId(k)) { was.textContent = `was ${g.keyText}`; was.hidden = false; } else was.hidden = true;
  }
  function setEmptyKey(id) {
    const art = el.querySelector(`[data-p="${CSS.escape(id)}"]`);
    const big = art.querySelector('.pt-big'); big.hidden = false; { let t = big.querySelector('small.pre').nextSibling; if (!t || t.nodeType !== 3) t = big.insertBefore(document.createTextNode(''), t); t.nodeValue = 'none'; } big.querySelector('small:not(.pre)').textContent = ''; big.querySelector('small.pre').textContent = '';
    art.querySelector('.pt-numl').textContent = 'with these settings'; art.querySelector('.pt-cmp').textContent = ''; art.querySelector('.pt-was').hidden = true;
    const cell = grid.querySelector(`.fd-cell[data-f="${CSS.escape(id)}"]`);
    if (cell) { const nm = cell.querySelector('.fd-num'); nm.hidden = false; nm.querySelector('b').textContent = 'none'; nm.querySelector('small:not(.pre)').textContent = ''; nm.querySelector('small.pre').textContent = ''; cell.querySelector('.fd-say').textContent = 'no result with these settings'; }
  }
  // a sentence that changed its words shows it for a beat (background from ground-3 back to none, 900ms)
  function flashIf(node, text) {
    if (node.textContent === text) return;
    node.textContent = text;
    if (REDUCED()) return;
    node.classList.remove('pt-flash'); void node.offsetWidth; node.classList.add('pt-flash');
    node.addEventListener('animationend', () => node.classList.remove('pt-flash'), { once: true });
  }
  // a numeral moves to its new value through the intermediate values (400ms) rather than jumping
  function tweenText(node, from, to) {
    if (!node) return;
    const a = parseFloat(from), b = parseFloat(to);
    if (REDUCED() || !Number.isFinite(a) || !Number.isFinite(b) || a === b || /[^\d.\-]/.test(String(to))) { node.nodeValue = to; return; }
    const dec = (String(to).split('.')[1] || '').length;
    const t0 = performance.now();
    const step = (t) => { const u = Math.min(1, (t - t0) / 400), e = 1 - Math.pow(1 - u, 3); node.nodeValue = u < 1 ? (a + (b - a) * e).toFixed(dec) : to; if (u < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // recompute one pattern from its settings and redraw only that article (the sliders keep focus while dragging)
  const pending = new Set();
  let raf = 0;
  function schedule(id) { pending.add(id); if (!raf) raf = requestAnimationFrame(() => { raf = 0; const ids = [...pending]; pending.clear(); ids.forEach(update); }); }
  function update(id) {
    const q = params.get(id), kind = kindOf(id);
    const art = el.querySelector(`[data-p="${CSS.escape(id)}"]`);
    let p;
    try { p = changed(id) ? COMPUTE[id](ctxFor(q.sig), adoption(), q) : base.find((b) => b.id === id); } catch (err) { console.error('pattern', id, err); p = null; }
    const isMine = changed(id);
    art.querySelector('.pp-mine').hidden = !isMine;
    art.querySelector('[data-act="reset"]').hidden = !isMine;
    art.querySelector('[data-act="ghost"]').hidden = !ghosts.has(id);
    if (!p || p.empty) {
      const t = p && p.title ? p.title : 'No linked events meet these settings; loosen one to see the pattern again';
      art.querySelector('h3').textContent = t;
      art.querySelector('.pt-sub').textContent = p && p.subtitle ? p.subtitle : '';
      art.querySelector('.pt-chart').innerHTML = '<p class="pp-none">Nothing to draw with these settings.</p>';
      art.querySelector('.pt-read').innerHTML = '';
      art.querySelector('.pt-contract').textContent = '';
      art.querySelector('.pt-source').textContent = '';
      hiFns.delete(id);
      setEmptyKey(id);
      if (!grid.hidden) drawMini({ id, kind, empty: true });
      return;
    }
    cur.set(id, { ...p, kind });
    const h3 = art.querySelector('h3'), sub = art.querySelector('.pt-sub');
    const keyBefore = art.querySelector('.pt-big').textContent;
    flashIf(h3, sayOf({ ...p, kind })); flashIf(sub, p.subtitle || '');
    const mt = art.querySelector('.pt-mt'); if (mt) flashIf(mt, p.title || '');
    art.querySelector('.pt-read').innerHTML = readHtml(p);
    const bs = art.querySelector('.pt-beside'); if (bs) bs.textContent = besideOf(cur.get(id));
    for (const r of el.querySelectorAll(`.pt-rail [data-jump="${CSS.escape(id)}"] .pt-rn`)) r.textContent = sampleOf(cur.get(id));
    setKey(id, cur.get(id));
    const was = art.querySelector('.pt-was');
    if (art.querySelector('.pt-big').textContent === keyBefore && was.hidden && changed(id)) { was.textContent = 'same number with this setting'; was.hidden = false; clearTimeout(was._t); was._t = setTimeout(() => { if (was.textContent === 'same number with this setting') was.hidden = true; }, 3000); }
    drawOne(cur.get(id), { morph: true });
    if (!grid.hidden) drawMini(cur.get(id));
  }

  // the events behind a pattern, with the role each plays (pairs keep their gap)
  function rowsFor(p) {
    const out = [];
    const pairList = p.pairs && p.pairs[0] && p.pairs[0].from ? p.pairs : null;
    const links = pairList || (p.military || p.lab ? [...(p.military || []).map((m) => ({ ...m, strip: 'military' })), ...(p.lab || []).map((m) => ({ ...m, strip: 'lab' }))] : null);
    if (links) {
      for (const l of links) { const a = byId.get(l.from), b = byId.get(l.to); if (a && b) out.push([a.year, a.title, b.year, b.title, l.lag, l.strip || '', a.id, b.id]); }
      return { head: ['from_year', 'from', 'to_year', 'to', 'gap_years', 'strip', 'from_id', 'to_id'], rows: out };
    }
    if (p.rows) return { head: ['technology', `year_${p.stats.lo || 10}`, `year_${p.stats.hi || 50}`, 'years'], rows: p.rows.map((r) => [r.name, r.year10, r.year50, r.years]) };
    return { head: ['year', 'title', 'domain', 'type', 'id'], rows: (p.events || []).map((i) => byId.get(i)).filter(Boolean).map((e) => [e.year, e.title, e.domain, e.type, e.id]) };
  }
  const csvCell = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  function exportList(id, how, btn) {
    const p = cur.get(id); if (!p) return;
    const { head, rows } = rowsFor(p);
    const flash = (msg) => { const t = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = t; }, 1400); };
    if (how === 'csv') {
      const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `histomap-${id}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash(`${rows.length} rows`);
      return;
    }
    const txt = `${p.title}\n\n` + rows.map((r) => (r.length >= 8 ? `${r[0]} ${r[1]} -> ${r[2]} ${r[3]} (${r[4]} years)` : r.slice(0, 2).join(' '))).join('\n');
    const done = () => flash('Copied');
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); flash(ok ? 'Copied' : 'Copy blocked'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }

  // ---------- ghost of the prior state ----------
  // Taken when an interaction with the settings begins (pointer down or first key on a slider, or Reset), so a drag
  // compares against where the reader started, not against the previous frame. Library: show transformation endpoints.
  function snapshot(id) {
    const art = el.querySelector(`[data-p="${CSS.escape(id)}"]`);
    const svg = art.querySelector('.pt-chart svg'); if (!svg) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'pt-ghost');
    for (const n of [...svg.children]) { if (n.tagName === 'text' || n.tagName === 'title' || n.tagName === 'defs' || /pt-ax|pt-call|pt-ghost/.test(n.getAttribute('class') || '')) continue; const c = n.cloneNode(true); c.querySelectorAll('text, title').forEach((t) => t.remove()); g.appendChild(c); }
    // ghost marks are scenery: no keys for the morph, no hover, no enter order of their own
    g.querySelectorAll('[data-k], [data-x], .pt-mk').forEach((n) => { n.removeAttribute('data-k'); n.removeAttribute('data-x'); n.classList.remove('pt-mk'); n.style.opacity = ''; });
    const k = normKey(keyOf(cur.get(id), params.get(id)));
    const q = params.get(id);
    const settings = (PARAMS[kindOf(id)] || []).map((c) => `${c.label.toLowerCase()} ${getK(q, c.k)}${c.unit || ''}`).join(', ');
    ghosts.set(id, { g, key: keyId(k), keyText: `${k.n}${k.unit === '%' ? '' : ' '}${k.unit}`, settings });
    art.querySelector('[data-act="ghost"]').hidden = false;
  }

  // the ghost holds at 30% while the live marks travel (1100ms), then leaves in 400ms
  function fadeGhost(g, hold) {
    if (!g || g._fading) return; g._fading = true;
    const go = () => { if (!g.isConnected) return; const a = g.animate([{ opacity: getComputedStyle(g).opacity }, { opacity: 0 }], { duration: REDUCED() ? 1 : 400, fill: 'forwards' }); a.onfinish = () => g.remove(); };
    if (hold) setTimeout(go, hold); else go();
  }
  const reorderControls = () => {
    for (const play of el.querySelectorAll('.pt-play')) {
      const cs = [...play.querySelectorAll('.pp-c')];
      const order = PHONE.matches ? [...cs.filter((c) => !c.classList.contains('still')), ...cs.filter((c) => c.classList.contains('still'))] : cs.slice().sort((a, b) => +a.dataset.i - +b.dataset.i);
      const anchor = cs[0]; if (!anchor) continue;
      let ref = anchor.previousSibling;
      for (const c of order) { if (ref) ref.after(c); else play.prepend(c); ref = c; }
    }
  };
  if (PHONE.addEventListener) PHONE.addEventListener('change', reorderControls);
  // the chart must be in view while a thumb moves, or the morph and its ghost happen offscreen: on pointerdown over a
  // slider, scroll the view so the chart is visible and the slider row stays under the finger (instant, not smooth)
  el.addEventListener('pointerdown', (ev) => {
    const c = ev.target.closest('.pt-play .pp-c'); if (!c) return;
    const art = c.closest('article.pt'); const chart = art && art.querySelector('.pt-chart'); if (!chart) return;
    const vr = el.getBoundingClientRect(), cr = chart.getBoundingClientRect(), sr = c.getBoundingClientRect();
    const top = vr.top + (PHONE.matches ? 58 : 60), bottom = vr.bottom - 8;
    let delta = 0;
    if (cr.top < top) delta = Math.max(cr.top - top, sr.bottom - bottom); // chart above: scroll up, but keep the slider on screen
    else if (cr.bottom > bottom) delta = Math.min(cr.bottom - bottom, sr.top - top); // chart below: scroll down, but keep the slider on screen
    if (Math.abs(delta) > 4) el.scrollTop += delta;
  }, { capture: true, passive: true });
  // a still slider says so the moment it is touched, before any value changes
  el.addEventListener('pointerdown', (ev) => {
    const c = ev.target.closest('.pp-c.still'); if (!c) return;
    const art = c.closest('article.pt'); const was = art && art.querySelector('.pt-was'); if (!was) return;
    was.textContent = 'same number with this setting'; was.hidden = false; clearTimeout(was._t);
    was._t = setTimeout(() => { if (was.textContent === 'same number with this setting') was.hidden = true; }, 3000);
  }, { capture: true, passive: true });
  el.addEventListener('pointerdown', (ev) => { const r = ev.target.closest('.pt-play input[type="range"]'); if (r) snapshot(r.closest('[data-p]').dataset.p); }, true);
  el.addEventListener('keydown', (ev) => { const r = ev.target.closest('.pt-play input[type="range"]'); if (r && /^Arrow|Home|End|Page/.test(ev.key) && !r.dataset.keying) { r.dataset.keying = '1'; snapshot(r.closest('[data-p]').dataset.p); } }, true);
  el.addEventListener('blur', (ev) => { const r = ev.target.closest && ev.target.closest('.pt-play input[type="range"]'); if (r) delete r.dataset.keying; }, true);

  // Parameter sweep: while the thumb moves only the declared value changes, in 150ms steps; the whole field reorganizes
  // once, on release (change), so the one cause behind the change stays legible
  const clampV = (q, k, v) => {
    if (k === 'lag.c1') v = Math.min(v, q.lag.c2 - 5); if (k === 'lag.c2') v = Math.max(q.lag.c1 + 5, Math.min(v, q.lag.c3 - 1)); if (k === 'lag.c3') v = Math.max(v, q.lag.c2 + 1);
    if (k === 'diffusion.lo') v = Math.min(v, q.diffusion.hi - 5); if (k === 'diffusion.hi') v = Math.max(q.diffusion.lo + 5, v);
    if (k === 'diffusion.early') v = Math.min(v, q.diffusion.late); if (k === 'diffusion.late') v = Math.max(v, q.diffusion.early);
    return v;
  };
  const sliderLabel = (r, id, v) => { const c = (PARAMS[kindOf(id)] || []).find((x) => x.k === r.dataset.k); return `${v}${c && c.unit ? c.unit : ''}`; };
  el.addEventListener('input', (ev) => {
    const r = ev.target.closest('.pt-play input[type="range"]'); if (!r) return;
    const art = r.closest('[data-p]'), id = art.dataset.p, q = params.get(id);
    if (!ghosts.has(id)) snapshot(id);
    const v = clampV(q, r.dataset.k, Number(r.value));
    if (v !== Number(r.value)) r.value = v;
    r.dataset.pending = String(v);
    const out = r.nextElementSibling, now = performance.now(), last = Number(r.dataset.t || 0);
    clearTimeout(r._lt);
    if (now - last >= 150) { out.textContent = sliderLabel(r, id, v); r.dataset.t = String(now); }
    else r._lt = setTimeout(() => { out.textContent = sliderLabel(r, id, Number(r.dataset.pending)); r.dataset.t = String(performance.now()); }, 150 - (now - last));
  });
  el.addEventListener('change', (ev) => {
    const r = ev.target.closest('.pt-play input[type="range"]'); if (!r) return;
    const art = r.closest('[data-p]'), id = art.dataset.p, q = params.get(id);
    const v = clampV(q, r.dataset.k, Number(r.dataset.pending ?? r.value));
    if (v !== Number(r.value)) r.value = v;
    clearTimeout(r._lt); r.nextElementSibling.textContent = sliderLabel(r, id, v); delete r.dataset.pending;
    if (getK(q, r.dataset.k) === v) return;
    setK(q, r.dataset.k, v);
    schedule(id);
  });
  el.addEventListener('click', (ev) => {
    const j = ev.target.closest('[data-jump]');
    if (j) { ev.preventDefault(); activate(j.dataset.jump, true); return; }
    const cell = ev.target.closest('.fd-cell');
    if (cell) { ev.preventDefault(); activate(cell.dataset.f, true, cell); return; }
    const ga = ev.target.closest('[data-act="grid"]');
    if (ga) { ev.preventDefault(); showGrid(); return; }
    const pa = ev.target.closest('[data-act="panel"]');
    if (pa) { ev.preventDefault(); panel(pa.closest('[data-p]').dataset.p, pa.getAttribute('aria-expanded') !== 'true'); return; }
    const px = ev.target.closest('[data-act="panel-close"]');
    if (px) { ev.preventDefault(); panel(px.closest('[data-p]').dataset.p, false); return; }
    const act = ev.target.closest('[data-act]');
    if (act) {
      const art = act.closest('[data-p]'), id = art.dataset.p;
      if (act.dataset.act === 'call') { const off = !noCall.has(id); if (off) noCall.add(id); else noCall.delete(id); art.classList.toggle('no-call', off); act.setAttribute('aria-pressed', String(!off)); }
      else if (act.dataset.act === 'ghost') { const on = !keepGhost.has(id); if (on) keepGhost.add(id); else keepGhost.delete(id); act.setAttribute('aria-pressed', String(on)); if (!on) art.querySelectorAll('.pt-ghost').forEach((g) => fadeGhost(g, 0)); else if (ghosts.has(id) && !art.querySelector('.pt-ghost')) drawOne(cur.get(id), { morph: false, keep: true }); }
      else if (act.dataset.act === 'reset') { snapshot(id); params.set(id, clone(DEFAULTS)); art.querySelectorAll('.pt-play input').forEach((r) => { const c = PARAMS[kindOf(id)].find((x) => x.k === r.dataset.k); r.value = getK(DEFAULTS, r.dataset.k); r.nextElementSibling.textContent = `${r.value}${c.unit || ''}`; }); update(id); }
      else exportList(id, act.dataset.act, act);
      return;
    }
    const nb = ev.target.closest('[data-behind]'); if (nb) { const c = cur.get(nb.dataset.behind); if (c && !c.empty) behind(c, { t: 'key' }); return; }
    const b = ev.target.closest('[data-id]'); if (b) select(b.dataset.id);
  });
  el.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; const nb = ev.target.closest('[data-behind]'); if (nb) { ev.preventDefault(); const c = cur.get(nb.dataset.behind); if (c && !c.empty) behind(c, { t: 'key' }); } });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.classList.contains('pt-link')) select(ev.target.dataset.id); });
  el.addEventListener('keydown', (ev) => { if (ev.key !== 'Escape' || !active) return; const art = el.querySelector(`#p-${CSS.escape(active)}`); const pn = art && art.querySelector('.pt-panel'); if (pn && !pn.hidden) { ev.preventDefault(); panel(active, false); } else if (ev.target.closest('.pt')) { ev.preventDefault(); showGrid(); } });
  // hovering a named example anywhere in a finding lights its marks here and pins its year on the shared rail below
  el.addEventListener('mouseover', (ev) => { const b = ev.target.closest('.pt-read [data-id], .pt-legend [data-id]'); if (b) hiAll(b.dataset.id); });
  el.addEventListener('mouseout', (ev) => { const b = ev.target.closest('.pt-read [data-id], .pt-legend [data-id]'); if (b) hiAll(null); });
  el.addEventListener('focusin', (ev) => { const b = ev.target.closest('.pt-read [data-id], .pt-legend [data-id]'); if (b) hiAll(b.dataset.id); });
  el.addEventListener('focusout', (ev) => { const b = ev.target.closest('.pt-read [data-id], .pt-legend [data-id]'); if (b) hiAll(null); });

  const hiFns = new Map();
  let drawing = null; // id of the pattern whose chart is being drawn
  const hiPush = (fn) => hiFns.set(drawing, fn);
  function hiAll(id, extra) {
    hiFns.forEach((f) => f(id));
    const ids = id ? [id, ...(extra || [])] : [];
    scrubMark('patterns', ids.length ? ids.map((i) => byId.get(i)).filter(Boolean).map((e, i) => ({ year: e.year, month: e.month, color: 'var(--accent)', strong: i === 0 })) : null);
  }
  new MutationObserver(() => { if (!el.classList.contains('on')) scrubMark('patterns', null); }).observe(el, { attributes: true, attributeFilter: ['class'] });

  // ---------- shared helpers ----------
  function frame(host, H, label) {
    const W = Math.max(320, host.clientWidth);
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
    return { svg, W, H };
  }
  // axes and grids carry class pt-ax: they stay put during a morph and are not ghosted
  // the warped time axis changes stride at fixed knot years; each change is marked with a double slash at the baseline and
  // the stride of the section after it, as Stream does, so an uneven run of ticks reads as a scale break and not a mistake
  const BREAKS = [1500, 1800, 1900, 1950, 2000];
  function xAxis(svg, x, y0, W, m) {
    const g = svg.append('g').attr('class', 'pt-ax');
    g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y0).attr('y2', y0).attr('stroke', 'var(--rule-strong)');
    const [d0, d1] = x.domain ? x.domain() : [0, 0];
    const bks = x.mode === 'warp' ? BREAKS.filter((b) => x(b) - x(d0) > 14 && x(d1) - x(b) > 14) : [];
    const ticks = (x.ticks ? x.ticks(64) : []).filter((t) => !bks.some((b) => b !== t && Math.abs(x(b) - x(t)) < 16));
    g.append('g').selectAll('text').data(ticks).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', y0 + 14).attr('text-anchor', 'middle').text((d) => d);
    if (!bks.length) return;
    const edges = [d0, ...bks, d1];
    const avg = (x(d1) - x(d0)) / (d1 - d0);
    const bg = g.append('g').attr('class', 'pt-breaks').attr('aria-hidden', 'true');
    bks.forEach((b) => { const px = x(b); bg.append('path').attr('d', `M${px - 4},${y0 + 4} l3,-8 M${px},${y0 + 4} l3,-8`).attr('stroke', 'var(--ground)').attr('stroke-width', 4).attr('fill', 'none'); bg.append('path').attr('d', `M${px - 4},${y0 + 4} l3,-8 M${px},${y0 + 4} l3,-8`).attr('stroke', 'var(--ink-2)').attr('stroke-width', 1.2).attr('fill', 'none'); });
    // one stride label per section, skipped where the section is too narrow to carry it
    const strideF = '10.5px "Instrument Sans", sans-serif';
    let first = true;
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i], c = edges[i + 1], w = x(c) - x(a);
      const k = ((x(c) - x(a)) / (c - a)) / avg; const num = `${k < 0.95 ? k.toFixed(1) : Math.round(k)}\u00d7`;
      // a mono glyph at 10.5px is about 6.3px wide: the word 'scale' rides the first label only where the section carries it
      const fits = (t) => t.length * 6.3 + 10 <= w;
      const txt = first && fits(`scale ${num}`) ? `scale ${num}` : num; if (!fits(txt)) continue; first = false;
      bg.append('text').attr('class', 'pt-stride').attr('x', x(a) + (i === 0 ? 0 : 7)).attr('y', y0 + 26).attr('text-anchor', 'start').style('font', strideF).text(txt);
    }
  }
  function yAxis(svg, y, m, W, label, fmt = (d) => d) {
    const t = y.ticks(5);
    const g = svg.append('g').attr('class', 'pt-ax');
    g.append('g').selectAll('line').data(t).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).attr('stroke', 'rgba(18,18,18,.1)');
    g.append('g').selectAll('text').data(t).join('text').attr('class', 'pt-tk').attr('x', m.l - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').text(fmt);
    if (label) g.append('text').attr('class', 'pt-tk').attr('x', m.l).attr('y', m.t - 8).text(label);
  }
  // Callouts: a ring on the point, a hairline leader, and a direct label. Each label is measured after drawing and moved
  // (up or down in 13px steps, then to the other side) until it overlaps no earlier label, ring or the chart edge.
  // A long annotation is labeled on the chart by its short name and year; the full sentence is listed under the chart.
  function callouts(svg, items, W) {
    const boxes = [];
    const g = svg.append('g').attr('class', 'pt-call');
    const H = +svg.attr('height');
    const pts = items.filter((a) => Number.isFinite(a.x) && Number.isFinite(a.y)).sort((a, b) => a.x - b.x);
    pts.forEach((a) => boxes.push({ x: a.x - 7, y: a.y - 7, w: 14, h: 14 }));
    // text already on the chart (axis ticks, axis titles, legends) is an obstacle too; measured on screen so transformed groups count
    const sr = svg.node().getBoundingClientRect();
    svg.selectAll('text').each(function () { const r = this.getBoundingClientRect(); if (r.width && r.height) boxes.push({ x: r.left - sr.left - 2, y: r.top - sr.top - 1, w: r.width + 4, h: r.height + 2 }); });
    svg.selectAll('.pt-mk circle').each(function () { const r = this.getBoundingClientRect(); if (r.width && r.height) boxes.push({ x: r.left - sr.left - 1, y: r.top - sr.top - 1, w: r.width + 2, h: r.height + 2 }); });
    // a direct label where the short name fits the width; a numbered ring where even that would crowd the chart (phones)
    const maxC = W < 600 ? 26 : 34, maxDirect = W < 600 ? 22 : 48;
    const host = svg.node().parentNode;
    const art = host.closest('article.pt'), legendHost = (art && art.querySelector('.pt-panel .pt-contract')) || null;
    const old = (art || host).querySelector('.pt-legend'); if (old) old.remove();
    let n = 0;
    pts.forEach((a) => {
      if (a.plain) { a.text = true; a.show = a.label; return; }
      a.show = a.label.length > maxC && a.short ? a.short : a.label;
      if (a.show.length > maxDirect) { a.num = ++n; a.show = String(a.num); } else a.text = true;
      a.listed = a.show !== a.label;
    });
    const area = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
    const annG = (a) => g.append('g').attr('class', a.plain ? 'pt-ann pt-ann-plain' : 'pt-ann').style('cursor', a.id || a.behind ? 'pointer' : 'default').on('click', () => (a.behind ? a.behind() : a.id && select(a.id))).on('mouseenter', () => a.id && hiAll(a.id)).on('mouseleave', () => a.id && hiAll(null));
    // numbered rings: the first clear slot around the point, or the least crowded one; a leader where the ring sits off the point
    const ring = (a) => {
      const gg = annG(a);
      const up = a.dy == null || a.dy < 0;
      const cands = [[0, up ? -16 : 16], [0, up ? 16 : -16], [16, 0], [-16, 0], [13, up ? -13 : 13], [-13, up ? -13 : 13], [13, up ? 13 : -13], [-13, up ? 13 : -13], [0, up ? -28 : 28], [0, up ? 28 : -28], [24, 24], [-24, 24], [24, -24], [-24, -24], [28, 0], [-28, 0], [0, 42], [0, -42], [0, 58], [0, -58], [0, 74], [0, -74]];
      let bx = a.x, by = a.y + (up ? -16 : 16), best = Infinity;
      for (const [dx, dy] of cands) {
        const cx = a.x + dx, cy = a.y + dy;
        if (cx < 10 || cx > W - 10 || cy < 10 || cy > H - 10) continue;
        const box = { x: cx - 11, y: cy - 11, w: 22, h: 22 };
        const ov = boxes.reduce((s, b) => s + area(box, b), 0);
        if (ov < best) { best = ov; bx = cx; by = cy; }
        if (ov === 0) break;
      }
      const dxx = bx - a.x, dyy = by - a.y, len = Math.hypot(dxx, dyy) || 1;
      // the numeral sits at the 10.5px floor, so its disc is 9px round
      gg.append('line').attr('class', 'pt-lead').attr('x1', a.x + (dxx / len) * 4).attr('y1', a.y + (dyy / len) * 4).attr('x2', bx - (dxx / len) * 9).attr('y2', by - (dyy / len) * 9).attr('stroke', 'var(--ink-2)').attr('stroke-width', 0.6);
      gg.append('circle').attr('cx', a.x).attr('cy', a.y).attr('r', 4).style('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 1.2);
      gg.append('circle').attr('cx', bx).attr('cy', by).attr('r', 9).style('fill', 'var(--ground)').attr('stroke', 'var(--accent)').attr('stroke-width', 1);
      gg.append('text').attr('class', 'pt-ann-n').attr('x', bx).attr('y', by).attr('dy', '0.35em').attr('text-anchor', 'middle').text(a.num);
      boxes.push({ x: bx - 10, y: by - 10, w: 20, h: 20 });
    };
    pts.filter((a) => a.num).forEach(ring);
    // text labels go through the shared placer: annotations first, then the plain names of unlabelled points;
    // a plain name that finds no clear spot is dropped (the point keeps its hover); an annotation that finds none
    // becomes a numbered ring and is listed beneath, so no two labels ever sit on each other
    const texts = pts.filter((a) => a.text).map((a) => {
      const gg = annG(a);
      if (!a.plain) gg.append('circle').attr('cx', a.x).attr('cy', a.y).attr('r', 6).style('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 1.2);
      const t = gg.append('text').attr('class', a.plain ? 'pt-tk' : 'pt-ann-t').attr('dy', '0.35em').text(a.show);
      const tw = t.node().getComputedTextLength ? t.node().getComputedTextLength() : a.show.length * 6;
      const th = a.plain ? 11 : 13;
      const pref = a.dy != null ? a.y + a.dy : a.y - 18;
      const dir = a.dy != null && a.dy > 0 ? -1 : 1;
      const sides = a.x + 14 + tw < W - 2 ? ['r', 'l'] : ['l', 'r'];
      const cands = [];
      for (let k = 0; k < 16; k++) {
        const ly = pref + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 13 * dir;
        for (const side of sides) { const lx = side === 'r' ? a.x + 14 : a.x - 14; cands.push([side === 'r' ? lx : lx - tw, ly - th / 2, side, lx, ly]); }
      }
      return { a, gg, t, w: tw + 4, h: th, pri: a.plain ? 1 : 2, cands };
    });
    placeLabels(texts, { bounds: { x0: 0, y0: 2, x1: W, y1: H }, obstacles: boxes.map((b) => ({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h })), gap: 1 });
    texts.forEach((it) => {
      const { a, gg, t } = it;
      if (it.hidden) {
        gg.remove();
        if (a.plain) return;
        a.text = false; a.num = ++n; a.show = String(a.num); a.listed = true; ring(a);
        return;
      }
      const [, , side, lx, ly] = it.cands[it.ci];
      const right = side === 'r';
      t.attr('x', lx + (right ? 2 : -2)).attr('y', ly).attr('text-anchor', right ? 'start' : 'end');
      gg.append('path').attr('class', 'pt-lead').attr('d', `M${a.x + (right ? 5 : -5)},${a.y + (ly < a.y ? -3 : ly > a.y ? 3 : 0)}L${lx},${ly}`).attr('stroke', 'var(--ink-2)').attr('stroke-width', 0.6).style('fill', 'none');
      const bb = t.node().getBBox();
      gg.insert('rect', 'text').attr('x', bb.x - 3).attr('y', bb.y - 1).attr('width', bb.width + 6).attr('height', bb.height + 2).style('fill', 'var(--ground)').attr('opacity', 0.92);
      boxes.push({ x: bb.x - 3, y: bb.y - 1, w: bb.width + 6, h: bb.height + 2 });
    });
    // the callouts in full (every shortened or numbered label with its full sentence, in chart order) live in the evidence panel, keeping the poster to its sixty words
    const listed = pts.filter((a) => a.listed).sort((u, v) => (u.num && v.num ? u.num - v.num : u.num ? 1 : v.num ? -1 : u.x - v.x));
    if (listed.length) {
      const ol = document.createElement('ol'); ol.className = 'pt-legend'; ol.setAttribute('aria-label', 'Callouts in full');
      listed.forEach((a) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="n${a.num ? ' num' : ''}">${esc(a.show)}</span>${a.id ? `<span class="pt-link" role="link" tabindex="0" data-id="${a.id}">${esc(a.label)}</span>` : `<span>${esc(a.label)}</span>`}`;
        ol.appendChild(li);
      });
      ol.addEventListener('click', (ev) => { const b = ev.target.closest('[data-id]'); if (b) select(b.dataset.id); });
      if (legendHost) legendHost.insertAdjacentElement('afterend', ol); else host.appendChild(ol);
    }
    return g;
  }
  // the pair tooltip, then the marks of both ends lit and both years pinned on the shared rail
  const pairEnter = (head, thenWord) => (ev, d) => { const a = byId.get(d.from), b = byId.get(d.to); if (a && b) tip.show(ev, `<div class="k">${head(d)}</div><div class="h">${esc(a.title)} (${a.year})</div><div class="m">${thenWord}: ${esc(b.title)} (${b.year})</div><div class="m">2 events</div>`); hiAll(d.to, [d.from]); };
  const pairLeave = () => { tip.hide(); hiAll(null); };
  // the events behind a number: any bar, dot or headline figure opens the drawer as a dated list of the records that produced it
  const CLICK = '';
  function behind(p, fig) {
    const q = params.get(p.id);
    const spec = members(p, q, ctxFor(q.sig), fig);
    if (!spec) return;
    openList(`list:${p.id}`, { kicker: `<i style="background:var(--ink)"></i><span class="ki">Pattern</span><span class="ki">${esc(KIND_LABEL[p.kind] || p.kind)}</span>`, ...spec });
  }

  // ---------- 1. invention to regulation, by era ----------
  function lagEra(p, host) {
    const { svg, W } = frame(host, 320, 'Years from an invention to the first linked rule, by year of the rule');
    const m = { l: 44, r: 16, t: 34, b: 30 }, H = 320;
    const x = timeScale({ domain: [Math.min(...p.pairs.map((d) => d.year)) - 3, YEAR_MAX + 1], range: [m.l, W - m.r] });
    const y = d3.scaleSqrt().domain([0, d3.max(p.pairs, (d) => d.lag) || 1]).range([H - m.b, m.t]);
    yAxis(svg, y, m, W, 'Years between linked invention and rule');
    xAxis(svg, x, H - m.b, W, m);
    // period medians
    const per = p.periods.filter((q) => q.n);
    const pg = svg.append('g');
    pg.selectAll('rect').data(per).join('rect').attr('data-k', (q) => `med:${q.label}`).attr('x', (q) => x(Math.max(q.from, x.domain()[0]))).attr('width', (q) => Math.max(1, x(Math.min(YEAR_MAX + 1, q.to)) - x(Math.max(q.from, x.domain()[0])))).attr('y', (q) => y(q.median_lag) - 3).attr('height', 6).style('fill', 'var(--ink)').attr('opacity', 0.45).style('cursor', 'pointer')
      .on('mouseenter', (ev, q) => tip.show(ev, `<div class="k">${esc(q.label)}</div><div class="h">median ${yrs(q.median_lag)} over ${q.n} pair${q.n === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, q) => behind(p, { t: 'period', q }));
    // on narrow screens the period legend drops below the axis title instead of running into it
    const lg = svg.append('g').attr('class', 'pt-ax').attr('transform', `translate(${W - m.r},${W < 700 ? m.t + 10 : m.t - 4})`);
    per.forEach((q, i) => { const t = lg.append('text').attr('class', 'pt-tk').attr('x', 0).attr('y', i * 13).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text(W < 700 ? `${q.label}: ${yrs(q.median_lag)}` : `${q.label}: median ${yrs(q.median_lag)}`); const tw = t.node().getComputedTextLength(); lg.append('line').attr('x1', -tw - 16).attr('x2', -tw - 6).attr('y1', i * 13 - 3).attr('y2', i * 13 - 3).attr('stroke', 'var(--ink)').attr('opacity', 0.45).attr('stroke-width', 2); });
    const dg = dodge(p.pairs, (d) => x(d.year + 0.5), (d) => y(d.lag), y(0), [m.l + 4, W - m.r - 4]), px = dg.x, py = dg.y;
    const pr = svg.append('g').selectAll('g').data(p.pairs).join('g').attr('class', 'pt-mk').attr('data-k', (d) => `${d.from}|${d.to}`).attr('data-x', (d) => px(d))
      .on('mouseenter', pairEnter((d) => `${esc(dl(d.domain))} &middot; ${yrs(d.lag)}`, 'rule')).on('mousemove', tip.move).on('mouseleave', pairLeave).on('click', (ev, d) => behind(p, { t: 'pair', d }));
    pr.append('line').style('pointer-events', 'none').attr('x1', (d) => px(d)).attr('x2', (d) => px(d)).attr('y1', y(0)).attr('y2', (d) => py(d)).attr('stroke', 'var(--ink)').attr('stroke-width', 1).attr('opacity', 0.3);
    pr.append('rect').style('pointer-events', 'none').attr('class', 'pt-dtick').attr('x', (d) => px(d) - 1.5).attr('y', y(0) - 1).attr('width', 3).attr('height', 3).style('fill', (d) => domainColor(d.domain));
    pr.append('circle').style('pointer-events', 'all').attr('cx', (d) => px(d)).attr('cy', (d) => py(d)).attr('r', 3.5).style('fill', (d) => famColor(d.domain)).attr('stroke', 'var(--ground)');
    callouts(svg, (p.annotations || []).map((a) => { const d = p.pairs.find((q) => q.to === a.event); return d && { x: px(d), y: py(d), label: a.label, short: shortOf(a.event, a.label), id: a.event }; }).filter(Boolean), W);
    hiPush((id) => { pr.attr('opacity', (d) => (!id || d.to === id || d.from === id ? 1 : 0.2)); pr.select('circle').attr('r', (d) => (id && (d.to === id || d.from === id) ? 5 : 3.5)); });
    return { contract: 'x is the year of the rule · y is years between the linked invention and the rule, square-root scale · dots take the rule\u2019s domain family hue, constant size, nudged apart where years crowd so each can be hovered (the tooltip has the exact year and lag) · the 3px tick at the baseline is the rule\u2019s domain, which the dot takes on hover', n: `${p.pairs.length} recorded invention-to-rule links, ${(p.stats && p.stats.n_2020s) || p.pairs.filter((d) => d.year >= 2020).length} of them 2020s` };
  }

  // ---------- 2. disaster, then rule ----------
  function pairsChart(p, host) {
    const { svg, W } = frame(host, 320, 'Lag from failure to rule, by year of the failure');
    const m = { l: 44, r: 16, t: 34, b: 30 }, H = 320;
    const x = timeScale({ domain: [Math.min(...p.pairs.map((d) => d.year)) - 2, YEAR_MAX + 1], range: [m.l, W - m.r] });
    const y = d3.scaleSqrt().domain([0, d3.max(p.pairs, (d) => d.lag) || 1]).range([H - m.b, m.t]);
    yAxis(svg, y, m, W, 'years to rule');
    xAxis(svg, x, H - m.b, W, m);
    const per = p.periods.filter((q) => q.n);
    svg.append('g').selectAll('rect').data(per).join('rect').attr('data-k', (q) => `med:${q.from}`).attr('x', (q) => x(q.from)).attr('width', (q) => Math.max(1, x(Math.min(YEAR_MAX + 1, q.to + 1)) - x(q.from))).attr('y', (q) => y(q.median_lag) - 3).attr('height', 6).style('fill', 'var(--ink)').attr('opacity', 0.4).style('cursor', 'pointer')
      .on('mouseenter', (ev, q) => tip.show(ev, `<div class="k">${q.from} to ${q.to}</div><div class="h">median ${yrs(q.median_lag)} over ${q.n} pair${q.n === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, q) => behind(p, { t: 'period', q }));
    { // period medians, left to right; one that would run into the label before it at the same height is left to its bar
      const placed = [];
      svg.append('g').attr('class', 'pt-ax').selectAll('text').data(per).join('text').attr('class', 'pt-tk').attr('x', (q) => x(q.from) + 3).attr('y', (q) => y(q.median_lag) - 5).style('fill', 'var(--ink-2)').text((q) => `median ${q.median_lag}y (${q.n})`)
        .each(function (q) { let x1 = x(q.from) + 3, x2 = x1 + this.getComputedTextLength(); const yy = y(q.median_lag) - 5; if (x2 > W - m.r) { x2 = W - m.r; x1 = x2 - this.getComputedTextLength(); d3.select(this).attr('x', x2).attr('text-anchor', 'end'); } if (placed.some((b) => x1 < b.x2 + 4 && x2 > b.x1 && Math.abs(yy - b.y) < 12)) this.remove(); else placed.push({ x1, x2, y: yy }); }); }
    const dg = dodge(p.pairs, (d) => x(d.year + 0.5), (d) => y(d.lag), y(0), [m.l + 4, W - m.r - 4]), px = dg.x, py = dg.y;
    const pr = svg.append('g').selectAll('g').data(p.pairs).join('g').attr('class', 'pt-mk').attr('data-k', (d) => `${d.from}|${d.to}`).attr('data-x', (d) => px(d))
      .on('mouseenter', pairEnter((d) => `${esc(dl(d.domain))} &middot; ${yrs(d.lag)}`, 'then')).on('mousemove', tip.move).on('mouseleave', pairLeave).on('click', (ev, d) => behind(p, { t: 'pair', d }));
    pr.append('line').style('pointer-events', 'none').attr('x1', (d) => px(d)).attr('x2', (d) => px(d)).attr('y1', y(0)).attr('y2', (d) => py(d)).attr('stroke', 'var(--ink)').attr('stroke-width', 1.2).attr('opacity', 0.4);
    pr.append('rect').style('pointer-events', 'none').attr('class', 'pt-dtick').attr('x', (d) => px(d) - 1.5).attr('y', y(0) - 1).attr('width', 3).attr('height', 3).style('fill', (d) => domainColor(d.domain));
    pr.append('circle').style('pointer-events', 'all').attr('cx', (d) => px(d)).attr('cy', (d) => py(d)).attr('r', 3.5).style('fill', (d) => famColor(d.domain)).attr('stroke', 'var(--ground)');
    callouts(svg, (p.annotations || []).map((a) => { const d = p.pairs.find((q) => q.to === a.event); return d && { x: px(d), y: py(d), label: a.label, short: shortOf(a.event, a.label), id: a.event }; }).filter(Boolean), W);
    hiPush((id) => { pr.attr('opacity', (d) => (!id || d.to === id || d.from === id ? 1 : 0.2)); pr.select('circle').attr('r', (d) => (id && (d.to === id || d.from === id) ? 5 : 3.5)); });
    return { contract: 'x is the year of the failure · y is years to the linked rule, square-root scale · dots take the rule\u2019s domain family hue, constant size, nudged apart where years crowd so each can be hovered (the tooltip has the exact year and lag) · the 3px tick at the baseline is the rule\u2019s domain, which the dot takes on hover · bars are period medians', n: `${p.pairs.length} failure-to-rule pairs` };
  }

  // ---------- 3. hype, crash, recovery ----------
  function cycles(p, host) {
    const { svg, W } = frame(host, 340, 'Yearly net sentiment of bubble and hype-cycle items, with peaks and troughs');
    const m = { l: 44, r: 16, t: 40, b: 30 }, H = 340;
    const rows = p.years;
    // the shared millennium clock: the early centuries hold a handful of items, the last decades hold most of them
    const x = timeScale({ domain: [rows[0].year - 1, YEAR_MAX + 1], range: [m.l, W - m.r] });
    const ext = d3.max(rows, (r) => Math.abs(r.net)) || 1;
    const y = d3.scaleLinear().domain([-ext, ext]).range([H - m.b, m.t]).nice();
    yAxis(svg, y, m, W, 'net score per year', (d) => (d > 0 ? `+${d}` : d));
    xAxis(svg, x, H - m.b, W, m);
    svg.append('line').attr('class', 'pt-ax').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--ink)').attr('opacity', 0.5);
    // episode shading: boom from peak to trough in fear tint, recovery to the next positive year
    const eg = svg.append('g');
    eg.selectAll('rect').data(p.episodes).join('rect').attr('data-k', (e) => `ep:${e.peak}`).attr('x', (e) => x(e.peak)).attr('width', (e) => Math.max(1, x(e.trough + 1) - x(e.peak))).attr('y', m.t - 6).attr('height', H - m.t - m.b + 6).style('fill', FEAR).attr('opacity', 0.1).style('cursor', 'pointer')
      .on('mouseenter', (ev, e) => { const n = p.years.filter((r) => r.year >= e.peak && r.year <= e.trough).reduce((a, r) => a + r.n, 0); tip.show(ev, `<div class="k">boom ${e.peak} to bust ${e.trough}</div><div class="h">${n} scored item${n === 1 ? '' : 's'} over ${yrs(e.fall)}</div>${CLICK}`); }).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, e) => behind(p, { t: 'episode', e }));
    const bw = (r) => Math.max(1, x(r.year + 1) - x(r.year) - 0.6);
    const bars = svg.append('g').selectAll('rect').data(rows.filter((r) => r.net)).join('rect').attr('class', 'pt-mk').attr('data-k', (r) => `y:${r.year}`).attr('data-x', (r) => x(r.year)).attr('x', (r) => x(r.year)).attr('width', bw).attr('y', (r) => (r.net > 0 ? y(r.net) : y(0))).attr('height', (r) => Math.abs(y(r.net) - y(0))).style('fill', (r) => (r.net > 0 ? HOPE : FEAR)).attr('opacity', 0.85)
      .style('cursor', 'pointer').on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${r.year}</div><div class="h">net ${r.net > 0 ? '+' : ''}${r.net} over ${r.n} item${r.n === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, r) => behind(p, { t: 'year', r }));
    const line = d3.line().x((r) => x(r.year + 0.5)).y((r) => y(r.smooth)).curve(d3.curveMonotoneX);
    svg.append('path').attr('class', 'pt-line').attr('data-k', 'smooth').attr('d', line(rows)).style('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.4).attr('stroke-dasharray', '4 3');
    // peak / trough / recovery markers
    const items = [], recov = [];
    for (const e of p.episodes) {
      const pk = rows.find((r) => r.year === e.peak), tr = rows.find((r) => r.year === e.trough);
      if (pk && e.peak_event && byId.get(e.peak_event)) items.push({ x: x(e.peak + 0.5), y: y(pk.net), label: `${e.peak} peak: ${byId.get(e.peak_event).title}`, short: `peak ${e.peak}: ${byId.get(e.peak_event).title_short || byId.get(e.peak_event).title}`, id: e.peak_event, dy: -16 });
      if (tr && e.trough_event && byId.get(e.trough_event)) items.push({ x: x(e.trough + 0.5), y: y(tr.net), label: `${e.trough} trough: ${byId.get(e.trough_event).title}`, short: `trough ${e.trough}: ${byId.get(e.trough_event).title_short || byId.get(e.trough_event).title}`, id: e.trough_event, dy: 16 });
      if (e.recovery) { svg.append('line').attr('data-k', `rec:${e.recovery}`).attr('x1', x(e.recovery + 0.5)).attr('x2', x(e.recovery + 0.5)).attr('y1', m.t - 4).attr('y2', y(0)).attr('stroke', 'var(--ink-2)').attr('stroke-dasharray', '2 3'); recov.push(e.recovery); }
    }
    // "positive again" flags along the top, each dropped a row when it would touch the one before
    const rows_ = [];
    const fg = svg.append('g').attr('class', 'pt-ax');
    recov.sort((u, v) => u - v).forEach((yr) => {
      const t = fg.append('text').attr('class', 'pt-tk').style('fill', 'var(--ink-2)').text(`positive again ${yr}`);
      const tw = t.node().getComputedTextLength(), x0 = x(yr + 0.5) + 3;
      const flip = x0 + tw > W - m.r;
      let k = 0; while (rows_[k] != null && rows_[k] > (flip ? x0 - 6 - tw : x0) - 6) k++;
      rows_[k] = flip ? x0 - 6 : x0 + tw; t.attr('x', flip ? x0 - 6 : x0).attr('text-anchor', flip ? 'end' : 'start').attr('y', m.t - 8 - k * 12);
    });
    callouts(svg, items, W);
    hiPush((id) => { const e = id && byId.get(id); bars.attr('opacity', (r) => (!e || r.year === e.year ? 0.85 : 0.25)); });
    return { contract: `x is year · bars are the net score per year, ink up for hope and brick down for fear · dashed line is the ${params.get(p.id).hype.smooth}-year mean · brick tint spans each peak to its trough`, n: `${p.stats.n.toLocaleString('en-US')} items tagged bubble or hype cycle` };
  }

  // ---------- 4. AI winters and booms ----------
  function aiCycles(p, host) {
    const { svg, W } = frame(host, 320, 'Share of all events that belong to AI, per year, with peaks and troughs');
    const m = { l: 44, r: 16, t: 36, b: 30 }, H = 320;
    const rows = p.years;
    const x = d3.scaleLinear().domain([rows[0].year, rows[rows.length - 1].year + 1]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    yAxis(svg, y, m, W, W < 600 ? '' : 'AI share of the year', (d) => `${Math.round(d * 100)}%`); // on a phone the winter labels need that row, and the subtitle already names the measure
    const ax = svg.append('g').attr('class', 'pt-ax');
    ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('stroke', 'var(--rule-strong)');
    ax.append('g').selectAll('text').data(x.ticks(8)).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', H - m.b + 14).attr('text-anchor', 'middle').text((d) => d);
    // conventional winters as tinted bands
    const wg = svg.append('g');
    wg.selectAll('rect').data(p.winters).join('rect').attr('data-k', (w) => `w:${w.from}`).attr('x', (w) => x(w.from)).attr('width', (w) => x(w.to + 1) - x(w.from)).attr('y', m.t - 6).attr('height', H - m.t - m.b + 6).style('fill', '#5b7fa6').attr('opacity', 0.1);
    svg.append('g').attr('class', 'pt-ax').selectAll('text').data(p.winters).join('text').attr('class', 'pt-tk').attr('x', (w) => x(w.from) + 3).attr('y', (w, i) => m.t - 10 - (i % 2) * 11).style('fill', '#3f5f85').text((w) => `winter ${w.from} to ${w.to}`);
    const bars = svg.append('g').selectAll('rect').data(rows).join('rect').attr('class', 'pt-mk').attr('data-k', (r) => `y:${r.year}`).attr('data-x', (r) => x(r.year)).attr('x', (r) => x(r.year)).attr('width', (r) => Math.max(1, x(r.year + 1) - x(r.year) - 0.6)).attr('y', (r) => y(r.share)).attr('height', (r) => y(0) - y(r.share)).style('fill', domainColor('ai')).attr('opacity', 0.28)
      .style('cursor', 'pointer').on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${r.year}</div><div class="h">${r.ai} of ${r.n} events are AI (${Math.round(r.share * 100)}%)</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, r) => behind(p, { t: 'year', r }));
    const line = d3.line().x((r) => x(r.year + 0.5)).y((r) => y(r.smooth)).curve(d3.curveMonotoneX);
    svg.append('path').attr('class', 'pt-line').attr('data-k', 'smooth').attr('d', line(rows)).style('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.8);
    const sm = (yv) => { const r = rows.find((q) => q.year === yv); return r ? r.smooth : 0; };
    const items = [];
    const sh = (id, fb) => (id && byId.get(id) ? byId.get(id).title_short || byId.get(id).title : fb);
    const mark = (kind, d, dy) => { const e = d.event && byId.get(d.event); return { behind: () => behind(p, { t: 'mark', year: d.year, kind }), x: x(d.year + 0.5), y: y(sm(d.year)), label: e ? `${d.year} ${kind}: ${e.title}` : `${d.year} ${kind}`, short: e ? sh(d.event, '') : `${d.year} ${kind}`, id: d.event, dy }; };
    for (const pk of p.peaks) items.push(mark('peak', pk, -16));
    for (const tr of p.troughs) items.push(mark('trough', tr, 18));
    callouts(svg, items, W);
    // gaps between troughs
    const tg = svg.append('g').attr('class', 'pt-ax');
    p.troughs.slice(1).forEach((t, i) => { const a = p.troughs[i].year, b = t.year; tg.append('line').attr('x1', x(a + 0.5)).attr('x2', x(b + 0.5)).attr('y1', H - m.b - 6).attr('y2', H - m.b - 6).attr('stroke', 'var(--ink-3)').attr('stroke-width', 1); if (x(b) - x(a) >= 34) tg.append('text').attr('class', 'pt-tk pt-gap').attr('x', x((a + b) / 2 + 0.5)).attr('y', H - m.b - 10).attr('text-anchor', 'middle').text(`${b - a} y`); }); // a gap too narrow for its number keeps only its bar
    // and a gap number that lands on a callout gives way to it
    { const others = [...svg.node().querySelectorAll('text:not(.pt-gap)')].map((t) => t.getBoundingClientRect()).filter((r) => r.width);
      tg.selectAll('text.pt-gap').each(function () { const r = this.getBoundingClientRect(); if (others.some((o) => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top)) this.remove(); }); }
    hiPush((id) => { const e = id && byId.get(id); bars.attr('opacity', (r) => (!e || r.year === e.year ? 0.28 : 0.1)); });
    return { contract: `x is year · bars are AI\u2019s raw share of that year\u2019s events · line is the ${params.get(p.id).winters.smooth}-year mean, where peaks and troughs are found · blue bands are the conventional AI winters`, n: `${rows.length} years, ${rows[0].year} to ${rows[rows.length - 1].year}` };
  }

  // ---------- 5. themes that travel together ----------
  function cooccur(p, host) {
    // arc diagram ordered by first year of each theme; arc width = shared events; colour by persistence (centuries)
    // narrow screens show the strongest pairings only, so each theme keeps a readable label
    const W0 = Math.max(320, host.clientWidth);
    const prs = p.pairs.slice(0, W0 < 560 ? 11 : W0 < 900 ? 19 : 28);
    const tags = Array.from(new Set(prs.flatMap((q) => [q.a, q.b])));
    const firstYear = {}; prs.forEach((q) => { firstYear[q.a] = Math.min(firstYear[q.a] || 9999, q.first); firstYear[q.b] = Math.min(firstYear[q.b] || 9999, q.first); });
    tags.sort((a, b) => firstYear[a] - firstYear[b] || (p.tags[b] || 0) - (p.tags[a] || 0));
    const H = W0 < 560 ? 300 : 380, m = { l: 20, r: 20 };
    const { svg, W } = frame(host, H, 'Themes that are tagged together, arcs sized by shared events');
    const x = d3.scalePoint().domain(tags).range([m.l + 30, W - m.r - 30]);
    const base = H - 112;
    const w = d3.scaleSqrt().domain([0, d3.max(prs, (q) => q.n)]).range([0.8, 12]);
    const col = d3.scaleLinear().domain([1, 3]).range(['#b5b5ae', '#121212']).clamp(true);
    const arcs = svg.append('g').selectAll('path').data(prs).join('path').attr('class', 'pt-mk').attr('data-k', (q) => `${q.a}+${q.b}`).attr('data-x', (q) => Math.min(x(q.a), x(q.b)))
      .attr('d', (q) => { const a = x(q.a), b = x(q.b), r = Math.abs(b - a) / 2; return `M${Math.min(a, b)},${base}A${r},${Math.min(r, base - 20)} 0 0 1 ${Math.max(a, b)},${base}`; })
      .style('fill', 'none').attr('stroke', (q) => col(q.centuries)).attr('stroke-width', (q) => w(q.n)).attr('opacity', 0.5)
      .on('mouseenter', function (ev, q) { d3.select(this).attr('opacity', 1); const a = byId.get(q.first_event), b = byId.get(q.last_event); tip.show(ev, `<div class="k">${esc(pretty(q.a))} + ${esc(pretty(q.b))}</div><div class="h">${q.n} shared events, ${q.first} to ${q.last} (${q.centuries} centur${q.centuries === 1 ? 'y' : 'ies'})</div>${a && b ? `<div class="m">first: ${esc(a.title)} (${a.year})<br>latest: ${esc(b.title)} (${b.year})</div>` : ''}`); hiAll(q.first_event, [q.last_event]); })
      .on('mousemove', tip.move).on('mouseleave', function () { d3.select(this).attr('opacity', 0.5); tip.hide(); hiAll(null); })
      .style('cursor', 'pointer').on('click', (ev, q) => behind(p, { t: 'pair', q }));
    const nodes = svg.append('g').selectAll('g').data(tags).join('g').attr('class', 'pt-mk').attr('data-k', (t) => `t:${t}`).attr('data-x', (t) => x(t)).attr('transform', (t) => `translate(${x(t)},${base})`);
    nodes.append('circle').attr('r', (t) => 3 + Math.sqrt(p.tags[t] || 1) * 0.6).style('fill', 'var(--ink)').attr('stroke', 'var(--ground)').attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('mouseenter', (ev, t) => tip.show(ev, `<div class="k">theme</div><div class="h">${esc(pretty(t))}: ${p.tags[t] || 0} event${p.tags[t] === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, t) => behind(p, { t: 'tag', tag: t }));
    const steep = x.step() < 44;
    nodes.append('text').attr('class', 'pt-lbl').attr('transform', steep ? 'rotate(62)' : 'rotate(40)').attr('x', 8).attr('y', steep ? 6 : 10).attr('text-anchor', 'start').style('font-size', steep ? '11px' : null).text((t) => pretty(t));
    nodes.append('text').attr('class', 'pt-tk').attr('y', -10).attr('text-anchor', 'middle').text((t, i) => (i === 0 || x(t) - x(tags[i - 1]) >= 30 ? firstYear[t] : ''));
    // annotate persistent and top
    const ann = [];
    const per = p.stats.persistent, top = p.stats.top;
    for (const q of [per, top]) { if (!q) continue; const a = x(q.a), b = x(q.b); if (a == null || b == null) continue; const r = Math.abs(b - a) / 2; ann.push({ x: (a + b) / 2, y: base - Math.min(r, base - 20), label: `${pretty(q.a)} + ${pretty(q.b)}: ${q.n} events, ${q.first} to ${q.last}`, short: `${pretty(q.a)} + ${pretty(q.b)}, ${q.first} to ${q.last}`, id: q.first_event, dy: -14 }); }
    callouts(svg, ann, W);
    hiPush((id) => arcs.attr('opacity', (q) => (!id || q.first_event === id || q.last_event === id || (q.top || []).includes(id) ? 0.5 : 0.1)));
    return { contract: `x orders themes by the year they first appear in a pairing (${prs.length} strongest pairings shown) · arc width is shared events · darker arcs persist across more centuries · node size is the theme\u2019s event count`, n: `${p.stats.pairs} pairings with at least ${params.get(p.id).themes.min} shared events` };
  }

  // ---------- 6. spillovers ----------
  function spill(p, host) {
    const { svg, W } = frame(host, 340, 'Years from a military or lab origin to civilian or product use');
    const m = { l: 16, r: 16, t: 36, b: 30 }, H = 340;
    const all = [...p.military, ...p.lab];
    const x = d3.scaleSqrt().domain([0, d3.max(all, (d) => d.lag) || 1]).range([m.l, W - m.r]);
    const rowsY = { military: m.t + 62, lab: m.t + 182 };
    const ax = svg.append('g').attr('class', 'pt-ax');
    ax.append('g').selectAll('line').data(x.ticks(8)).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'rgba(18,18,18,.1)');
    ax.append('g').selectAll('text').data(x.ticks(8)).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', H - m.b + 14).attr('text-anchor', 'middle').text((d) => d);
    ax.append('text').attr('class', 'pt-tk').attr('x', W - m.r).attr('y', H - m.b + 26).attr('text-anchor', 'end').text('years between the linked events');
    const strips = [['military', 'Military origin to civilian use', p.military, p.stats.military], ['lab', 'Discovery or invention to product', p.lab, p.stats.lab]];
    const marks = [];
    for (const [key, label, list, st] of strips) {
      const yb = rowsY[key];
      const sg = svg.append('g').attr('class', 'pt-ax');
      sg.append('text').attr('class', 'pt-lbl').attr('x', m.l).attr('y', yb - 42).text(label);
      sg.append('text').attr('class', 'pt-tk pt-tkb').attr('x', m.l).attr('y', yb - 30).style('cursor', 'pointer').style('pointer-events', 'all').text(`${st.n} links · median ${yrs(st.median_lag || 0)}`)
        .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${esc(label)}</div><div class="h">${st.n} linked pair${st.n === 1 ? '' : 's'}, ${st.n * 2} events</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', () => behind(p, { t: 'strip', strip: key }));
      sg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', yb).attr('y2', yb).attr('stroke', 'var(--rule-strong)');
      if (st.median_lag != null) { svg.append('line').attr('data-k', `med:${key}`).attr('x1', x(st.median_lag)).attr('x2', x(st.median_lag)).attr('y1', yb - 30).attr('y2', yb + 30).attr('stroke', 'var(--ink)').attr('stroke-width', 1.5); sg.append('text').attr('class', 'pt-tk').attr('x', x(st.median_lag) + 4).attr('y', yb + 36).style('fill', 'var(--ink)').text(`median ${yrs(st.median_lag)}`); }
      // beeswarm-ish: jitter deterministic by index within lag bins
      const bins = {};
      const pts = list.map((d) => { const k = Math.round(x(d.lag) / 7); bins[k] = (bins[k] || 0) + 1; const n = bins[k]; return { ...d, strip: key, cx: x(d.lag), cy: yb + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 6 }; });
      const g = svg.append('g').selectAll('circle').data(pts).join('circle').attr('class', 'pt-mk').attr('data-k', (d) => `${key}:${d.from}|${d.to}`).attr('data-x', (d) => { const e = byId.get(d.to); return e ? e.year : d.cx; }).attr('cx', (d) => d.cx).attr('cy', (d) => d.cy).attr('r', 3.6).style('fill', (d) => { const e = byId.get(d.to); return e ? famColor(e.domain) : 'var(--ink-2)'; }).attr('stroke', 'var(--ground)').attr('opacity', 0.9)
        .on('mouseenter', pairEnter((d) => yrs(d.lag), 'then')).on('mousemove', tip.move).on('mouseleave', pairLeave).on('click', (ev, d) => behind(p, { t: 'pair', d, strip: key }));
      marks.push({ sel: g, pts });
    }
    const items = (p.annotations || []).map((a) => { const mk = marks.find((q) => q.pts.some((d) => d.to === a.event && d.strip === a.strip)) || marks.find((q) => q.pts.some((d) => d.to === a.event)); const d = mk && mk.pts.find((q) => q.to === a.event); return d && { x: d.cx, y: d.cy, label: a.label, short: shortOf(a.event, a.label), id: a.event, dy: d.strip === 'military' ? -22 : 22 }; }).filter(Boolean);
    callouts(svg, items, W);
    hiPush((id) => marks.forEach((mk) => mk.sel.attr('opacity', (d) => (!id || d.to === id || d.from === id ? 0.9 : 0.15)).attr('r', (d) => (id && (d.to === id || d.from === id) ? 5 : 3.6))));
    return { contract: 'x is years between the two linked events, square-root scale · each dot is one link, in the later event\u2019s domain family hue · the two rows are the two kinds of origin · vertical bar is the row median', n: `${p.military.length} military links and ${p.lab.length} lab links` };
  }

  // ---------- 7. diffusion speeding up ----------
  function diffusion(p, host) {
    const { svg, W } = frame(host, 320, 'Years from 10 to 50 percent of US households against the year 10 percent was reached');
    const m = { l: 44, r: 16, t: 36, b: 30 }, H = 320;
    const rows = p.rows;
    const x = d3.scaleLinear().domain([Math.floor(d3.min(rows, (r) => r.year10) / 10) * 10 - 5, 2025]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.years) + 4]).range([H - m.b, m.t]).nice();
    const dq = params.get(p.id).diffusion;
    yAxis(svg, y, m, W, `years from ${dq.lo}% to ${dq.hi}% of homes`);
    const ax = svg.append('g').attr('class', 'pt-ax');
    ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('stroke', 'var(--rule-strong)');
    ax.append('g').selectAll('text').data(x.ticks(8)).join('text').attr('class', 'pt-tk').attr('x', x).attr('y', H - m.b + 14).attr('text-anchor', 'middle').text((d) => d);
    ax.append('text').attr('class', 'pt-tk').attr('x', W - m.r).attr('y', H - m.b + 26).attr('text-anchor', 'end').text(`year the technology reached ${dq.lo}% of US households`);
    // period medians
    const st = p.stats;
    const meds = [[x.domain()[0], dq.early, st.median_before_1950, `before ${dq.early}`], [dq.early, dq.late, st.median_1950_1989, `${dq.early} to ${dq.late - 1}`], [dq.late, 2025, st.median_since_1990, `since ${dq.late}`]].filter((q) => q[2] != null && q[1] > q[0]);
    const mg = svg.append('g');
    mg.selectAll('line').data(meds).join('line').attr('data-k', (q, i) => `med:${i}`).attr('x1', (q) => x(q[0])).attr('x2', (q) => x(q[1])).attr('y1', (q) => y(q[2])).attr('y2', (q) => y(q[2])).attr('stroke', 'var(--ink)').attr('stroke-width', 2).attr('opacity', 0.45);
    const lg = svg.append('g').attr('class', 'pt-ax').attr('transform', `translate(${W - m.r},${m.t + 8})`);
    meds.forEach((q, i) => { const t = lg.append('text').attr('class', 'pt-tk').attr('x', 0).attr('y', i * 13).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text(`${q[3]}: median ${yrs(q[2])}`); const tw = t.node().getComputedTextLength(); lg.append('line').attr('x1', -tw - 16).attr('x2', -tw - 6).attr('y1', i * 13 - 3).attr('y2', i * 13 - 3).attr('stroke', 'var(--ink)').attr('opacity', 0.45).attr('stroke-width', 2); });
    // trend line
    const xs = rows.map((r) => r.year10), ys = rows.map((r) => r.years);
    const mx = d3.mean(xs), my = d3.mean(ys);
    const slope = d3.sum(rows, (r) => (r.year10 - mx) * (r.years - my)) / d3.sum(rows, (r) => (r.year10 - mx) ** 2);
    const [x0, x1] = x.domain();
    svg.append('line').attr('class', 'pt-line').attr('data-k', 'trend').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(my + slope * (x0 - mx))).attr('y2', y(Math.max(0, my + slope * (x1 - mx)))).attr('stroke', 'var(--ink-3)').attr('stroke-dasharray', '3 3');
    const dots = svg.append('g').selectAll('g').data(rows).join('g').attr('class', 'pt-mk').attr('data-k', (r) => `t:${r.name}`).attr('data-x', (r) => x(r.year10))
      .on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${esc(r.name)}</div><div class="h">${dq.lo}% in ${Math.round(r.year10)}${r.open10 ? ' (first reading)' : ''}, ${dq.hi}% in ${Math.round(r.year50)}</div><div class="m">${yrs(r.years)} · click for the reading</div>`)).on('mousemove', tip.move).on('mouseleave', tip.hide).style('cursor', 'pointer').on('click', (ev, r) => behind(p, { t: 'row', r }));
    dots.append('circle').attr('cx', (r) => x(r.year10)).attr('cy', (r) => y(r.years)).attr('r', 5).style('fill', (r) => (r.open10 ? 'var(--ground)' : 'var(--ink)')).attr('stroke', 'var(--ink)').attr('stroke-width', 1.4);
    const named = new Set((p.annotations || []).map((a) => a.name));
    callouts(svg, (p.annotations || []).map((a) => { const r = rows.find((q) => q.name === a.name); return r && { x: x(r.year10), y: y(r.years), label: a.label, short: a.label }; }).filter(Boolean)
      .concat(W < 600 ? [] : rows.filter((r) => !named.has(r.name)).map((r) => ({ x: x(r.year10), y: y(r.years), label: r.name, plain: true, dy: -12 }))), W);
    if (W < 600) svg.append('text').attr('class', 'pt-tk pt-ax').attr('x', m.l).attr('y', m.t - 22).text('tap a dot for its name and years');
    return { contract: `x is the year a technology reached ${dq.lo}% of US households · y is years to ${dq.hi}% · hollow dot: its series begins at or above ${dq.lo}% · dashed line is the linear trend · bars are period medians`, n: `${rows.length} technologies`, source: p.source ? { title: 'Our World in Data, technology adoption in US households', url: p.source } : null };
  }

  // ---------- 8. sentiment swings ----------
  function sentimentChart(p, host) {
    const { svg, W } = frame(host, 320, 'Hopeful and fearful items per year, with the decade mean');
    const m = { l: 44, r: 16, t: 30, b: 30 }, H = 320;
    const rows = p.years;
    const x = timeScale({ domain: [rows[0].year, YEAR_MAX + 1], range: [m.l, W - m.r] });
    const maxN = d3.max(rows, (r) => Math.max(r.hope, r.fear));
    const yc = d3.scaleSqrt().domain([0, maxN]).range([0, (H - m.t - m.b) / 2 - 6]);
    const mid = m.t + (H - m.t - m.b) / 2;
    svg.append('line').attr('class', 'pt-ax').attr('x1', m.l).attr('x2', W - m.r).attr('y1', mid).attr('y2', mid).attr('stroke', 'var(--rule-strong)');
    const bw = (r) => Math.max(1, x(r.year + 1) - x(r.year) - 0.5);
    const g = svg.append('g');
    g.selectAll('rect.h').data(rows).join('rect').attr('class', 'h pt-mk').attr('data-k', (r) => `h:${r.year}`).attr('data-x', (r) => x(r.year)).attr('x', (r) => x(r.year)).attr('width', bw).attr('y', (r) => mid - yc(r.hope)).attr('height', (r) => yc(r.hope)).style('fill', HOPE).attr('opacity', 0.85).style('cursor', 'pointer')
      .on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${r.year}</div><div class="h">${r.hope} hopeful item${r.hope === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, r) => behind(p, { t: 'year', year: r.year, sign: 1 }));
    g.selectAll('rect.f').data(rows).join('rect').attr('class', 'f pt-mk').attr('data-k', (r) => `f:${r.year}`).attr('data-x', (r) => x(r.year)).attr('x', (r) => x(r.year)).attr('width', bw).attr('y', mid).attr('height', (r) => yc(r.fear)).style('fill', FEAR).attr('opacity', 0.85).style('cursor', 'pointer')
      .on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${r.year}</div><div class="h">${r.fear} fearful item${r.fear === 1 ? '' : 's'}</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, r) => behind(p, { t: 'year', year: r.year, sign: -1 }));
    const ym = d3.scaleLinear().domain([-1, 1]).range([mid + (H - m.t - m.b) / 2 - 6, m.t + 6]);
    const minN = params.get(p.id).sentiment.min;
    const solid = p.decades.filter((d) => d.n >= minN);
    const line = d3.line().x((d) => x(d.decade + 5)).y((d) => ym(d.mean)).curve(d3.curveMonotoneX);
    svg.append('path').attr('class', 'pt-line').attr('data-k', 'mean').attr('d', line(solid)).style('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.6).attr('stroke-dasharray', '4 3');
    const dm = svg.append('g').selectAll('g').data(p.decades).join('g').attr('class', 'pt-mk').attr('data-k', (d) => `d:${d.decade}`).attr('data-x', (d) => x(d.decade + 5))
      .on('mouseenter', (ev, d) => { const f = d.top_fear.map((i) => byId.get(i)).filter(Boolean), h = d.top_hope.map((i) => byId.get(i)).filter(Boolean); tip.show(ev, `<div class="k">${d.decade}s &middot; mean ${d.mean > 0 ? '+' : ''}${d.mean.toFixed(2)} over ${d.n} items${d.n < minN ? ' (too few to count)' : ''}</div><div class="h">${d.hope} hopeful, ${d.fear} fearful</div><div class="m">${f[0] ? 'fear: ' + esc(f[0].title) : ''}${h[0] ? '<br>hope: ' + esc(h[0].title) : ''}</div>${CLICK}`); const i = d.mean < 0 ? d.top_fear[0] : d.top_hope[0]; if (i) hiAll(i, [d.mean < 0 ? d.top_hope[0] : d.top_fear[0]].filter(Boolean)); })
      .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); hiAll(null); }).style('cursor', 'pointer').on('click', (ev, d) => behind(p, { t: 'decade', d }));
    dm.append('circle').attr('cx', (d) => x(d.decade + 5)).attr('cy', (d) => ym(Math.max(-1, Math.min(1, d.mean)))).attr('r', (d) => (d.n >= minN ? 4 : 2.5)).style('fill', (d) => (d.n >= minN ? (d.mean >= 0 ? HOPE : FEAR) : 'var(--ground)')).attr('stroke', 'var(--ink)');
    xAxis(svg, x, H - m.b, W, m);
    const ax = svg.append('g').attr('class', 'pt-ax');
    ax.append('text').attr('class', 'pt-tk').attr('x', m.l - 6).attr('y', m.t + 4).attr('text-anchor', 'end').style('fill', HOPE).text('hope');
    ax.append('text').attr('class', 'pt-tk').attr('x', m.l - 6).attr('y', H - m.b - 2).attr('text-anchor', 'end').style('fill', FEAR).text('fear');
    const items = [];
    const mh = p.decades.find((d) => d.decade === p.stats.most_hopeful_decade), mf = p.decades.find((d) => d.decade === p.stats.most_fearful_decade);
    if (mh && mh.top_hope[0] && byId.get(mh.top_hope[0])) items.push({ x: x(mh.decade + 5), y: ym(mh.mean), label: `most hopeful, ${mh.decade}s (${mh.mean > 0 ? '+' : ''}${mh.mean.toFixed(2)}): ${byId.get(mh.top_hope[0]).title}`, short: `most hopeful, ${mh.decade}s (${mh.mean > 0 ? '+' : ''}${mh.mean.toFixed(2)})`, id: mh.top_hope[0], dy: -18 });
    if (mf && mf.top_fear[0] && byId.get(mf.top_fear[0])) items.push({ x: x(mf.decade + 5), y: ym(mf.mean), label: `most fearful, ${mf.decade}s (${mf.mean.toFixed(2)}): ${byId.get(mf.top_fear[0]).title}`, short: `most fearful, ${mf.decade}s (${mf.mean.toFixed(2)})`, id: mf.top_fear[0], dy: 22 });
    callouts(svg, items, W);
    hiPush((id) => { const e = id && byId.get(id); g.selectAll('rect').attr('opacity', (r) => (!e || r.year === e.year ? 0.85 : 0.25)); });
    return { contract: `x is year · bars count hopeful items up in ink and fearful items down in brick, square-root scale · dashed line is the decade mean from -1 to +1 · a hollow decade dot has fewer than ${minN} items`, n: `${p.stats.n.toLocaleString('en-US')} hopes, fears and cultural items` };
  }

  // ---------- 9. where events cluster ----------
  function regions(p, host) {
    const ages = p.ages;
    const W0 = Math.max(320, host.clientWidth);
    const regs = Array.from(new Set(ages.flatMap((a) => Object.keys(a.regions))));
    const exs0 = (p.annotations || []);
    const mobile = W0 < 560;
    // no legend and no numbered list: each region is named on its widest band, or in the right margin with a hairline
    // leader to its band in the last age; the example of each age is named under its column and outlined on its band
    const m = { l: 44, r: mobile ? 84 : 92, t: 36, b: mobile ? 66 : exs0.length ? 60 : 46 }, H = 262 + m.b;
    const { svg, W } = frame(host, H, 'Share of located events by world region within each age of the millennium');
    const x = d3.scaleBand().domain(ages.map((a) => a.id)).range([m.l, W - m.r]).paddingInner(0.18);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    const bw = x.bandwidth();
    yAxis(svg, y, m, W, 'share of located events', (d) => `${Math.round(d * 100)}%`);
    const cells = [];
    for (const a of ages) {
      let acc = 0;
      const order = Object.entries(a.regions).sort((u, v) => v[1] - u[1]);
      for (const [r, n] of order) { const s = n / a.n; cells.push({ age: a, r, n, s, y0: acc, y1: acc + s }); acc += s; }
    }
    const rects = svg.append('g').selectAll('rect').data(cells).join('rect').attr('class', 'pt-mk').attr('data-k', (c) => `${c.age.id}:${c.r}`).attr('data-x', (c) => x(c.age.id)).attr('x', (c) => x(c.age.id)).attr('width', bw).attr('y', (c) => y(c.y1)).attr('height', (c) => Math.max(0.5, y(c.y0) - y(c.y1) - 1)).style('fill', (c) => regionHue(c.r)).attr('opacity', 0.9)
      .on('mouseenter', (ev, c) => { const ex = c.age.examples[c.r] && byId.get(c.age.examples[c.r]); tip.show(ev, `<div class="k">${esc(c.age.label)}</div><div class="h">${esc(REGION[c.r] ? REGION[c.r].label : c.r)}: ${c.n} of ${c.age.n} located events (${Math.round(c.s * 100)}%)</div>${ex ? `<div class="m">e.g. ${esc(ex.title)} (${ex.year})</div>` : ''}${CLICK}`); if (ex) hiAll(ex.id); })
      .on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); hiAll(null); }).style('cursor', 'pointer').on('click', (ev, c) => behind(p, { t: 'cell', c }));
    const nameOf = (r) => (REGION[r] ? REGION[r].short : r);
    const hOf = (c) => y(c.y0) - y(c.y1);
    const lab = svg.append('g').attr('class', 'pt-ax pt-dl');
    const tw = (txt) => { const t = lab.append('text').attr('class', 'pt-tk').text(txt); const w = t.node().getComputedTextLength(); t.remove(); return w; };
    const named = new Set();
    // 1. the region's name on its widest band, when the band can hold it
    for (const r of regs) {
      const c = cells.filter((q) => q.r === r).sort((u, v) => hOf(v) - hOf(u))[0]; if (!c) continue;
      const h = hOf(c); if (h < 12) continue;
      const nm = nameOf(r), full = `${nm} ${Math.round(c.s * 100)}%`;
      const txt = tw(full) <= bw - 8 ? full : tw(nm) <= bw - 8 ? nm : null; if (!txt) continue;
      lab.append('text').attr('class', 'pt-tk').attr('x', x(c.age.id) + 5).attr('y', (y(c.y1) + y(c.y0)) / 2).attr('dy', '0.35em').style('fill', 'var(--ground)').text(txt);
      named.add(r); c.named = true;
    }
    // 2. the share on every other band wide enough for it
    for (const c of cells) { if (c.named || c.s < 0.12 || hOf(c) < 12) continue; const pct = `${Math.round(c.s * 100)}%`, nm = `${nameOf(c.r)} ${pct}`; const txt = named.has(c.r) && tw(nm) <= bw - 8 ? nm : tw(pct) <= bw - 8 ? pct : null; if (txt) lab.append('text').attr('class', 'pt-tk').attr('x', x(c.age.id) + 5).attr('y', (y(c.y1) + y(c.y0)) / 2).attr('dy', '0.35em').style('fill', 'var(--ground)').text(txt); }
    // 3. regions too thin everywhere: named in the right margin with a hairline leader to their band in the last age they appear
    const last = ages[ages.length - 1];
    const margin = regs.filter((r) => !named.has(r)).map((r) => { const c = cells.filter((q) => q.r === r).sort((u, v) => ages.indexOf(v.age) - ages.indexOf(u.age))[0]; return c && { r, c, cy: (y(c.y1) + y(c.y0)) / 2, inLast: c.age === last }; }).filter(Boolean).sort((u, v) => u.cy - v.cy);
    const STEP = 12, top = m.t + 6, bot = H - m.b - 4;
    for (let i = 0; i < margin.length; i++) { margin[i].ly = Math.max(margin[i].cy, i ? margin[i - 1].ly + STEP : top); }
    for (let i = margin.length - 1; i >= 0; i--) { const lim = i < margin.length - 1 ? margin[i + 1].ly - STEP : bot; margin[i].ly = Math.min(margin[i].ly, lim); }
    const lx = W - m.r + 8;
    for (const d of margin) {
      const x1 = x(d.c.age.id) + bw + 1;
      lab.append('path').attr('class', 'pt-lead').attr('d', `M${x1},${d.cy} H${lx - 10} L${lx - 4},${d.ly}`).attr('fill', 'none').attr('stroke', 'var(--ink-3)').attr('stroke-width', 0.7).attr('opacity', d.inLast ? 1 : 0.8);
      lab.append('rect').attr('x', lx - 1).attr('y', d.ly - 4).attr('width', 5).attr('height', 8).style('fill', regionHue(d.r));
      lab.append('text').attr('class', 'pt-tk').attr('x', lx + 7).attr('y', d.ly).attr('dy', '0.35em').style('fill', 'var(--ink-2)').text(nameOf(d.r));
    }
    const ax = svg.append('g').attr('class', 'pt-ax').selectAll('g').data(ages).join('g').attr('transform', (a) => `translate(${x(a.id) + bw / 2},${H - m.b})`);
    // narrow columns stagger their age names on two rows so neighbours never touch
    const stag = bw < 70;
    ax.append('text').attr('class', 'pt-lbl').attr('y', (a, i) => 16 + (stag && i % 2 ? 12 : 0)).attr('text-anchor', 'middle').text((a) => { const A = AGES.find((q) => q.id === a.id); return A ? A.short : a.label; });
    ax.append('text').attr('class', 'pt-tk').attr('y', stag ? 42 : 30).attr('text-anchor', 'middle').text((a) => (bw > 150 ? `${a.from} to ${a.to - 1} · ${a.n} event${a.n === 1 ? '' : 's'}` : bw > 70 ? `${a.n} events` : `${a.n}`));
    // examples: an ink outline on the band and the event named under its column, no numbering to look up
    const exs = exs0.map((an) => { const c = cells.find((q) => q.age.id === an.age && q.age.examples[q.r] === an.event); const e = byId.get(an.event); return c && e && { c, e }; }).filter(Boolean);
    const bg = svg.append('g').attr('class', 'pt-call');
    const maxW = x.step() - 6; // the example name may use the gap beside its column, never its neighbour's
    exs.forEach(({ c, e }) => {
      const gg = bg.append('g').attr('class', 'pt-ann').style('cursor', 'pointer').on('click', () => select(e.id)).on('mouseenter', () => hiAll(e.id)).on('mouseleave', () => hiAll(null));
      gg.append('rect').attr('x', x(c.age.id) + 0.75).attr('y', y(c.y1) + 0.75).attr('width', bw - 1.5).attr('height', Math.max(1, y(c.y0) - y(c.y1) - 2.5)).style('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.5);
      const t = gg.append('text').attr('class', 'pt-ann-t').attr('x', x(c.age.id) + bw / 2).attr('y', H - m.b + (stag ? 56 : 44)).attr('text-anchor', 'middle');
      if (mobile) t.text(`${e.year}`);
      else { let words = e.title.replace(/^(The|A|An)\s+/i, '').split(/\s+/); t.text(`${e.year} ${words.join(' ')}`); while (words.length > 1 && t.node().getComputedTextLength() > maxW) { words = words.slice(0, -1); t.text(`${e.year} ${words.join(' ')}\u2026`); } if (t.node().getComputedTextLength() > maxW) t.text(`${e.year}`); }
      gg.append('title').text(`${e.year}: ${e.title}`);
    });
    if (p.stats.thin) svg.append('text').attr('class', 'pt-tk pt-ax').attr('x', W - m.r).attr('y', m.t - 22).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text(`provisional: ${p.stats.n} located events so far`);
    hiPush((id) => rects.attr('opacity', (c) => (!id || c.age.examples[c.r] === id ? 0.9 : 0.3)));
    return { contract: 'x is the age of the millennium · each column stacks the share of located events by world region, largest at the foot · each region is named on its widest band, or in the right margin with a leader to its band · an ink outline marks the example named under the column', n: `${p.stats.n.toLocaleString('en-US')} events with a region` };
  }

  function hypeCountChart(p, host) {
    const { svg, W } = frame(host, 340, 'Items tagged bubble or hype cycle, counted by year');
    const m = { l: 44, r: 16, t: 40, b: 30 }, H = 340;
    const rows = p.years.filter((r) => r.year >= 1900);
    const x = timeScale({ domain: [1900, YEAR_MAX + 1], range: [m.l, W - m.r] });
    const mx = d3.max(rows, (r) => r.n) || 1;
    const y = d3.scaleLinear().domain([0, mx]).range([H - m.b, m.t]).nice();
    yAxis(svg, y, m, W, 'items a year');
    xAxis(svg, x, H - m.b, W, m);
    const bw = (r) => Math.max(1, x(r.year + 1) - x(r.year) - 0.6);
    const bars = svg.append('g').selectAll('rect').data(rows.filter((r) => r.n)).join('rect').attr('class', 'pt-mk').attr('data-k', (r) => `y:${r.year}`).attr('x', (r) => x(r.year)).attr('width', bw).attr('y', (r) => y(r.n)).attr('height', (r) => y(0) - y(r.n))
      .style('fill', (r) => (r.year === p.stats.busiest ? fam('know', 5) : fam('know', 3))).attr('opacity', 1).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (r) => `${r.year}: ${r.n} item${r.n === 1 ? '' : 's'}`)
      .style('cursor', 'pointer').on('mouseenter', (ev, r) => tip.show(ev, `<div class="k">${r.year}</div><div class="h">${r.n} item${r.n === 1 ? '' : 's'} tagged bubble or hype cycle</div>${CLICK}`)).on('mousemove', tip.move).on('mouseleave', tip.hide).on('click', (ev, r) => behind(p, { t: 'year', r }));
    // troughs of the boom-to-bust finding as dotted lines, their year at the top
    const items = [];
    for (const e of p.episodes || []) {
      svg.append('line').attr('data-k', `tr:${e.trough}`).attr('x1', x(e.trough + 0.5)).attr('x2', x(e.trough + 0.5)).attr('y1', m.t - 4).attr('y2', y(0)).attr('stroke', 'var(--ink-2)').attr('stroke-dasharray', '2 3');
      const ev = e.trough_event && byId.get(e.trough_event);
      if (ev) items.push({ x: x(e.trough + 0.5), y: m.t + 6, label: `${e.trough} trough: ${ev.title}`, short: `trough ${e.trough}: ${ev.title_short || ev.title}`, id: ev.id, dy: -8 });
    }
    const b = rows.find((r) => r.year === p.stats.busiest);
    if (b) svg.append('text').attr('class', 'pt-tk').attr('x', Math.min(x(b.year + 0.5), W - m.r - 4)).attr('y', y(b.n) - 6).attr('text-anchor', x(b.year) > W * 0.8 ? 'end' : 'middle').style('fill', fam('know', 5)).text(`${b.year}: ${b.n} items`);
    callouts(svg, items, W);
    hiPush((id) => { const e = id && byId.get(id); bars.attr('opacity', (r) => (!e ? 1 : r.year === e.year ? 1 : 0.2)); });
    return { contract: 'x is year · bars count the items tagged bubble or hype cycle in that year, in the knowledge family; the busiest year darkest · dotted lines are the troughs of the boom-to-bust finding, same settings', n: `${p.stats.n.toLocaleString('en-US')} items tagged bubble or hype cycle, ${p.years[0].year} to ${p.years[p.years.length - 1].year}` };
  }
  const charts = { 'lag-era': lagEra, pairs: pairsChart, cycles, hypecount: hypeCountChart, 'ai-cycles': aiCycles, cooccur, spill, diffusion, sentiment: sentimentChart, regions };

  // ---------- morph: the same marks move from where they were to where they are now ----------
  const GEOM = ['cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'transform', 'd', 'stroke-width', 'opacity'];
  const numsOf = (d) => (d.match(/-?\d*\.?\d+/g) || []).length;
  function morph(oldSvg, newSvg) {
    if (!oldSvg || REDUCED()) return;
    const old = new Map();
    for (const n of oldSvg.querySelectorAll('[data-k]')) { const k = n.getAttribute('data-k'); if (!old.has(k)) old.set(k, n); }
    const t = d3.transition('morph').duration(1100).ease(d3.easeCubicInOut);
    // labels that are placed rather than keyed follow their marks: they arrive once the marks have landed
    for (const n of newSvg.querySelectorAll('.pt-call, .pt-dl')) n.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 1375, easing: 'linear', fill: 'backwards' });
    // a mark that has no earlier self fades in to its own opacity, then hands back to the attribute
    const fadeIn = (n) => d3.select(n).style('opacity', 0).transition(t).style('opacity', n.getAttribute('opacity') || 1).on('end', () => { n.style.opacity = ''; });
    for (const n of newSvg.querySelectorAll('[data-k]')) {
      const o = old.get(n.getAttribute('data-k'));
      if (!o) { fadeIn(n); continue; }
      const pairs = [[n, o]];
      // a group mark (a lollipop or a labeled dot) morphs through its children, matched by order and tag
      if (n.tagName === 'g') { const nc = [...n.children], oc = [...o.children]; nc.forEach((c, i) => { if (oc[i] && oc[i].tagName === c.tagName) pairs.push([c, oc[i]]); }); }
      for (const [a, b] of pairs) {
        const s = d3.select(a);
        for (const at of GEOM) {
          const nv = a.getAttribute(at), ov = b.getAttribute(at);
          if (nv == null || ov == null || nv === ov) continue;
          if (at === 'd' && numsOf(nv) !== numsOf(ov)) { fadeIn(a); continue; }
          a.setAttribute(at, ov);
          s.transition(t).attr(at, nv);
        }
      }
    }
  }
  // ---------- enter: marks draw in along the time axis in date order, once, when the chart scrolls into view ----------
  function enterHead(art) {
    const head = art && art.querySelector('.pt-head'); if (!head || !head.classList.contains('pre')) return;
    head.classList.remove('pre');
    const seal = head.querySelector('.pt-seal'); if (seal) seal.animate([{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'backwards' });
    [head.querySelector('.pt-index'), head.querySelector('h3'), head.querySelector('.pt-sub')].forEach((n, i) => { if (n) n.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160 + i * 120, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'backwards' }); });
    const num = head.querySelector('.pt-num'); if (num) num.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200, delay: 120, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'backwards' });
  }
  // the header band stamps in on its own visibility, since it sits a screen above its chart on tall findings
  const ioHead = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { ioHead.unobserve(e.target); enterHead(e.target.closest('.pt')); } }, { root: el, threshold: 0.5 }) : null;
  function enter(host) {
    enterHead(host.closest('.pt'));
    const svg = host.querySelector('svg'); if (!svg) return;
    const marks = [...svg.querySelectorAll('[data-x]')];
    const xs = marks.map((n) => +n.getAttribute('data-x')).filter(Number.isFinite);
    const lo = Math.min(...xs), hi = Math.max(...xs), span = hi - lo || 1;
    for (const n of marks) {
      const t = (+n.getAttribute('data-x') - lo) / span, op = getComputedStyle(n).opacity;
      // a mark positioned by an SVG transform attribute keeps it: CSS transform would override it mid-animation
      const kf = n.hasAttribute('transform') ? [{ opacity: 0 }, { opacity: op }] : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: op, transform: 'none' }];
      n.animate(kf, { duration: 320, delay: 60 + t * 640, easing: EASE_OUT, fill: 'backwards' });
    }
    for (const n of svg.querySelectorAll('.pt-line')) n.animate([{ clipPath: 'inset(-20px 100% -20px -20px)' }, { clipPath: 'inset(-20px -20px -20px -20px)' }], { duration: 820, delay: 80, easing: EASE_OUT, fill: 'backwards' });
    for (const n of [...svg.querySelectorAll('.pt-call'), ...svg.querySelectorAll('.pt-dl'), ...host.querySelectorAll('.pt-legend')]) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 760, easing: EASE_OUT, fill: 'backwards' });
    for (const n of svg.querySelectorAll('.pt-ghost')) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, fill: 'backwards' });
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting && e.intersectionRatio >= 0.4) { const host = e.target; io.unobserve(host); host.classList.remove('pre'); revealed.add(host.closest('[data-p]').dataset.p); enter(host); } }, { root: el, threshold: [0.4] }) : null;

  const headShown = new Set(); // a header stamps in once, with its chart's first reveal
  function drawOne(p, { morph: doMorph = false, keep = false } = {}) {
    const art = el.querySelector(`[data-p="${CSS.escape(p.id)}"]`);
    const host = art && art.querySelector('.pt-chart');
    if (!host) return;
    const oldSvg = host.querySelector('svg');
    const tmp = oldSvg ? oldSvg.cloneNode(true) : null; // positions before this change, for the morph
    host.innerHTML = '';
    drawing = p.id;
    const fn = charts[p.kind];
    let meta = null;
    try { if (fn) meta = fn(p, host); else host.innerHTML = '<p class="ab-small">Chart for this pattern is not drawn yet.</p>'; } catch (err) { console.error('pattern', p.id, err); host.innerHTML = '<p class="ab-small">This chart could not be drawn.</p>'; }
    const svg = host.querySelector('svg');
    // the ghost of the state before the reader's current change sits behind the live marks
    const gh = ghosts.get(p.id);
    if (svg && gh) { const gEl = svg.insertBefore(gh.g.cloneNode(true), svg.firstChild); if (!keepGhost.has(p.id)) fadeGhost(gEl, REDUCED() ? 0 : 1100); }
    if (svg && doMorph) morph(tmp, svg);
    // first reveal: marks wait for the chart to scroll into view
    if (svg && io && !REDUCED() && !revealed.has(p.id) && !keep) { host.classList.add('pre'); if (!headShown.has(p.id)) { const hd = art.querySelector('.pt-head'); hd.classList.add('pre'); headShown.add(p.id); if (ioHead) ioHead.observe(hd); } io.observe(host); } else if (REDUCED()) revealed.add(p.id);
    // encoding contract and source footer, fixed under every chart
    const foot = art.querySelector('.pt-foot');
    const den = art.querySelector('.pt-den'); if (den) den.textContent = meta ? meta.n : '';
    if (meta) {
      const q = params.get(p.id);
      const mine = changed(p.id) ? ` · your settings: ${(PARAMS[p.kind] || []).filter((c) => getK(q, c.k) !== getK(DEFAULTS, c.k)).map((c) => `${c.label.toLowerCase()} ${getK(q, c.k)}${c.unit || ''}`).join(', ')}` : '';
      const ghostNote = gh && keepGhost.has(p.id) ? ` · ghost marks: before your last change (${gh.settings})` : '';
      art.querySelector('.pt-contract').innerHTML = `<span class="sc">What is plotted</span>${esc(meta.contract)} · ${esc(meta.n)}${esc(mine)}${esc(ghostNote)}`;
      const open = !art.querySelector('.pt-panel').hidden;
      foot.querySelector('.pt-source').innerHTML = `${esc(nLine(p))} · ${meta.source ? `<a href="${esc(meta.source.url)}" target="_blank" rel="noopener">${esc(meta.source.title)}</a> and ` : ''}the Histomap record, from ${nEvents} events${changed(p.id) ? ' · your settings' : ''} · <button type="button" class="pt-evb" data-act="panel" aria-expanded="${open}">Method and evidence</button>`;
    } else { art.querySelector('.pt-contract').textContent = ''; foot.querySelector('.pt-source').textContent = ''; }
  }
  function draw() { if (active) { const c = cur.get(active); if (c && !c.empty) drawOne(c); } else drawMinis(); }
  // ---------- the poster cells: each chart as a silhouette with one accent ----------
  function drawMini(p) {
    const a = grid.querySelector(`.fd-cell[data-f="${CSS.escape(p.id)}"] svg`); if (!a) return;
    const W = Math.max(80, a.clientWidth || 200), H = Math.max(48, a.clientHeight || 96);
    const s = d3.select(a).attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
    s.selectAll('*').remove();
    const F = CELL_FAMILY[p.kind] || 'signal', st = (k) => fam(F, k);
    const ink = st(5), g3 = st(2);
    const base_ = H - 4;
    s.append('line').attr('x1', 0).attr('x2', W).attr('y1', base_).attr('y2', base_).attr('stroke', 'var(--rule-strong)').attr('stroke-width', 0.6);
    if (p.empty) { s.append('text').attr('class', 'pt-tk').attr('x', W / 2).attr('y', base_ - 10).attr('text-anchor', 'middle').style('fill', g3).text('no result'); return; }
    const yearX = (lo, hi) => d3.scaleLinear().domain([lo, hi]).range([1, W - 1]);
    try {
      if (p.kind === 'lag-era') { // the Now view's step-back form: a dot per link by the decade of the rule, the decade's median as a bar
        const P = p.pairs.filter((d) => d.year >= 1900), decs = [...new Set(P.map((d) => Math.floor(d.year / 10) * 10))].sort((u, v) => u - v), cw = (W - 2) / decs.length;
        const cap = 60, y = (lag) => base_ - (Math.sqrt(Math.min(cap, Math.max(0, lag))) / Math.sqrt(cap)) * (base_ - 3);
        const stepOf = (yr) => Math.min(4, 2 + Math.floor(((yr - 1900) / (YEAR_MAX - 1900)) * 3)); // paler toward 1900, deeper toward the present
        s.append('g').selectAll('circle').data(P).join('circle').attr('cx', (d, i) => 1 + cw * (decs.indexOf(Math.floor(d.year / 10) * 10) + 0.15 + 0.7 * (((i * 7919) % 100) / 100))).attr('cy', (d) => y(d.lag)).attr('r', 1.4).attr('fill', (d) => st(stepOf(d.year)));
        s.append('g').selectAll('rect').data(decs).join('rect').attr('x', (d, k) => 1 + cw * k + 2).attr('width', Math.max(2, cw - 4)).attr('y', (d) => y(d3.median(P.filter((q) => Math.floor(q.year / 10) * 10 === d), (q) => q.lag)) - 1).attr('height', 2).attr('fill', ink);
      } else if (p.kind === 'pairs') {
        const quick = (params.get(p.id).disaster || DEFAULTS.disaster).quick, bins = d3.range(0, 11).map((l) => ({ lag: l, n: p.pairs.filter((d) => (l === 10 ? d.lag >= 10 : Math.round(d.lag) === l)).length }));
        const x = d3.scaleBand().domain(bins.map((b) => b.lag)).range([1, W - 1]).paddingInner(0.25), y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.n) || 1]).range([base_ - 12, 2]);
        s.append('g').selectAll('rect').data(bins).join('rect').attr('x', (b) => x(b.lag)).attr('width', x.bandwidth()).attr('y', (b) => y(b.n)).attr('height', (b) => Math.max(b.n ? 1 : 0, base_ - 12 - y(b.n))).attr('fill', (b) => (b.lag <= quick ? st(4) : st(2)));
        s.append('g').selectAll('text').data([0, 5, 10]).join('text').attr('class', 'pt-tk').attr('x', (l) => x(l) + x.bandwidth() / 2).attr('y', base_ - 2).attr('text-anchor', 'middle').style('font-size', '9px').style('fill', 'var(--ink-3)').text((l) => (l === 10 ? '10+ yrs' : l));
      } else if (p.kind === 'cycles') {
        const rows = p.years.filter((r) => r.year >= 1900), x = yearX(1900, YEAR_MAX), ext = d3.max(rows, (r) => Math.abs(r.net)) || 1, y = d3.scaleLinear().domain([-ext, ext]).range([base_, 2]);
        s.select('line').attr('y1', y(0)).attr('y2', y(0));
        s.append('g').selectAll('rect').data(rows.filter((r) => r.net)).join('rect').attr('x', (r) => x(r.year)).attr('width', Math.max(0.8, x(1901) - x(1900) - 0.3)).attr('y', (r) => (r.net > 0 ? y(r.net) : y(0))).attr('height', (r) => Math.abs(y(r.net) - y(0))).attr('fill', (r) => (r.net > 0 ? st(2) : st(5)));
      } else if (p.kind === 'hypecount') { // the Now view's step-back count: a bar per year, the busiest year in the accent
        const rows = p.years.filter((r) => r.year >= 1967), x = yearX(1967, YEAR_MAX + 1), m = d3.max(rows, (r) => r.n) || 1, y = d3.scaleLinear().domain([0, m]).range([base_, 2]);
        s.append('g').selectAll('rect').data(rows.filter((r) => r.n)).join('rect').attr('x', (r) => x(r.year)).attr('width', Math.max(1, x(1968) - x(1967) - 0.5)).attr('y', (r) => y(r.n)).attr('height', (r) => base_ - y(r.n)).attr('fill', (r) => (r.year === p.stats.busiest ? st(5) : r.n >= m * 0.5 ? st(4) : r.n >= m * 0.2 ? st(3) : st(2)));
      } else if (p.kind === 'ai-cycles') {
        const rows = p.years, x = yearX(rows[0].year, rows[rows.length - 1].year), y = d3.scaleLinear().domain([0, 1]).range([base_, 2]);
        s.append('g').selectAll('rect').data(p.winters).join('rect').attr('x', (w) => x(w.from)).attr('width', (w) => x(w.to + 1) - x(w.from)).attr('y', 0).attr('height', base_).attr('fill', '#EBC7C9').attr('opacity', 0.22); // council round 8: soft bands
        s.append('path').attr('d', d3.line().x((r) => x(r.year)).y((r) => y(r.smooth)).curve(d3.curveMonotoneX)(rows)).attr('fill', 'none').attr('stroke', '#8F1D21').attr('stroke-width', 2);
        s.append('g').selectAll('circle').data(p.troughs || []).join('circle').attr('cx', (t) => x(t.year)).attr('cy', (t) => y(t.smooth != null ? t.smooth : (rows.find((r) => r.year === t.year) || {}).smooth || 0)).attr('r', 2.2).attr('fill', ink);
      } else if (p.kind === 'cooccur') {
        const prs = p.pairs.slice(0, 14), tags = Array.from(new Set(prs.flatMap((q) => [q.a, q.b]))), x = d3.scalePoint().domain(tags).range([3, W - 3]);
        const per = p.stats.persistent;
        s.append('g').selectAll('path').data(prs).join('path').attr('d', (q) => { const a = x(q.a), b = x(q.b), r = Math.abs(b - a) / 2; return `M${Math.min(a, b)},${base_}A${r},${Math.min(r, base_ - 2)} 0 0 1 ${Math.max(a, b)},${base_}`; }).attr('fill', 'none').attr('stroke', (q) => (per && q.a === per.a && q.b === per.b ? st(5) : q.centuries >= 4 ? st(4) : q.centuries >= 2 ? st(3) : st(2))).attr('stroke-width', (q) => (per && q.a === per.a && q.b === per.b ? 1.8 : 0.9));
      } else if (p.kind === 'spill') {
        const all = [...p.military, ...p.lab], x = d3.scaleSqrt().domain([0, d3.max(all, (d) => d.lag) || 1]).range([1, W - 1]);
        const row = (list, yy, med, hot) => { s.append('g').selectAll('circle').data(list).join('circle').attr('cx', (d) => x(d.lag)).attr('cy', yy).attr('r', 1.6).attr('fill', hot ? st(4) : st(2)); if (med != null) s.append('line').attr('x1', x(med)).attr('x2', x(med)).attr('y1', yy - 9).attr('y2', yy + 9).attr('stroke', hot ? st(5) : st(3)).attr('stroke-width', 2); };
        row(p.military, H * 0.3, p.stats.military.median_lag, true); row(p.lab, H * 0.68, p.stats.lab.median_lag, false);
      } else if (p.kind === 'diffusion') {
        const rows = p.rows, x = d3.scaleLinear().domain(d3.extent(rows, (r) => r.year10)).range([2, W - 2]), y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.years)]).range([base_, 2]);
        const mx = d3.mean(rows, (r) => r.year10), my = d3.mean(rows, (r) => r.years), slope = d3.sum(rows, (r) => (r.year10 - mx) * (r.years - my)) / d3.sum(rows, (r) => (r.year10 - mx) ** 2);
        const [x0, x1] = x.domain();
        s.append('line').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(my + slope * (x0 - mx))).attr('y2', y(Math.max(0, my + slope * (x1 - mx)))).attr('stroke', st(4)).attr('stroke-width', 1.6);
        s.append('g').selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.year10)).attr('cy', (r) => y(r.years)).attr('r', 2).attr('fill', (r) => st(r.year10 >= 1990 ? 5 : r.year10 >= 1950 ? 3 : 2));
      } else if (p.kind === 'sentiment') {
        const rows = p.years.filter((r) => r.year >= 1900), x = yearX(1900, YEAR_MAX), maxN = d3.max(rows, (r) => Math.max(r.hope, r.fear)) || 1, yc = d3.scaleSqrt().domain([0, maxN]).range([0, H / 2 - 3]), mid = H / 2;
        s.select('line').attr('y1', mid).attr('y2', mid);
        const bw = Math.max(0.8, x(1901) - x(1900) - 0.3);
        s.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.year)).attr('width', bw).attr('y', (r) => mid - yc(r.hope)).attr('height', (r) => yc(r.hope)).attr('fill', st(2));
        s.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.year)).attr('width', bw).attr('y', mid).attr('height', (r) => yc(r.fear)).attr('fill', st(5));
      } else if (p.kind === 'regions') {
        const ages = p.ages, x = d3.scaleBand().domain(ages.map((a) => a.id)).range([0, W]).paddingInner(0.2), y = d3.scaleLinear().domain([0, 1]).range([base_, 2]);
        for (const a of ages) { let acc = 0; const order = Object.entries(a.regions).sort((u, v) => v[1] - u[1]); order.forEach(([r, n], i) => { const sh = n / a.n; s.append('rect').attr('x', x(a.id)).attr('width', x.bandwidth()).attr('y', y(acc + sh)).attr('height', Math.max(0.3, y(acc) - y(acc + sh) - 0.6)).attr('fill', i === 0 ? regionHue(r) : 'var(--ground-3)'); acc += sh; }); }
      }
    } catch (err) { console.error('mini', p.id, err); }
  }
  function drawMinis() { if (grid.hidden) return; for (const p of shown) { const c = cur.get(p.id); if (c) drawMini(c); } }


  // arriving by link at one finding (#v=findings&f=<id>); otherwise the grid
  if (fParam && shown.some((p) => p.id === fParam)) setState({ screen: 2 }, { replace: true }); // the shell then renders screen 2, which syncScreen reads as the linked finding
  function render(state, ch) { if (ch.has('*')) draw(); if (ch.has('*') || ch.has('screen')) syncScreen(state.screen || 1); }
  return { render, resize() { draw(); }, hover(id) { hiFns.forEach((f) => f(id)); } };
}
