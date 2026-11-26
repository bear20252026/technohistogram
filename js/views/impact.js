// IMPACT (VISION_4.md Addendum and the main-session rules): four tabs, five screens, Zürich Data throughout: off-white
// field, black marks, one yellow for the latest point or the mark in hand; motion is a variable axis and a morphing
// encoding, never a draw-on. Millennium (incomes in every region impact.json carries, then the price of light as a
// rolling numeral); Last ten years (the LifeMap hero: gains stacked above a baseline, the measures not improving hanging
// below; the two tables live in the evidence panel); By region (one matrix); Shadows (six costs). Reads
// site/data/impact.json and data/impact_now.json; every number is read from the series, nothing is asserted here.
// Vocabulary outside the evidence panel: measures, verdict, stand-ins, left out.
import { esc } from '../ui.js';
import { host } from '../data.js';
import { reduced } from '../lit.js';

// the Millennium tab's two screens, for the shell's stepper
export const SCREENS = [{ id: 'incomes', title: 'Incomes' }, { id: 'light', title: 'Price of light' }];

const PAPER = '#f7f7f5', INK = '#121212';
// Color direction (VISION_4.md): subject families in stepped ranges on the off-white field. Tokens --imp-<family>-1..3 can
// override the printed fallbacks; step 1 is darkest. Health greens, income golds, tools and prices blues, access teals,
// shadows reds and plums.
// palette.css tokens: --imp-<family>-1 is the lightest step, -3 the darkest, -label the text color; the fallbacks here
// print the same ramp. hue(id, step): step 0 is the darkest.
const FAMILY = {
  health: ['#2F7A4A', '#5E956D', '#ABC7B0', '#2F7A4A'], income: ['#B5851A', '#C49E58', '#EADFA0', '#8E6A24'], tools: ['#2B5FA8', '#5780BA', '#A7BDD9', '#2B5FA8'],
  access: ['#1F7F84', '#59999C', '#AAC8C8', '#207C81'], 'shadow-red': ['#B3352C', '#C76458', '#E3B0A6', '#B3352C'], 'shadow-plum': ['#6E2A5E', '#8D567D', '#C3A6B9', '#6E2A5E'], other: ['#4a4f5a', '#6e7380', '#9a9eaa', '#4a4f5a'],
};
const FAM_OF = {
  health: ['life_expectancy', 'maternal_mortality', 'child_mortality', 'dtp3_coverage', 'vaccines-lives-saved', 'suicide_rate', 'air_pollution_deaths', 'amr_deaths', 'depression_us', 'overdose_deaths_us', 'smallpox-cases', 'infectious-disease-deaths'],
  income: ['extreme_poverty', 'median_income', 'gdp-per-capita', 'gini', 'housing_cost_to_income', 'labor_productivity', 'working-hours', 'child-labor', 'literacy', 'pisa_math', 'population', 'loneliness', 'famine-deaths', 'disaster-deaths'],
  tools: ['genome-sequencing-cost', 'solar-module-price', 'battery-pack-price', 'price-of-light', 'cost-of-communication', 'travel-time'],
  access: ['electricity_access', 'safe_water_access', 'internet_use', 'cereal-yields'],
  'shadow-red': ['co2-emissions', 'road_deaths', 'road-deaths', 'obesity_adults', 'obesity', 'e-waste'],
  'shadow-plum': ['time_online_daily', 'screen-time', 'nuclear-warheads', 'co2_per_capita'],
};
const SUBJECT = { road_deaths: 'health', 'road-deaths': 'health', 'nuclear-warheads': 'tools' }; // coloured by subject on the LifeMap; shadow hues only on the Shadows tab
const famOf = (id) => SUBJECT[id] || Object.keys(FAM_OF).find((f) => FAM_OF[f].includes(id)) || 'other';
const shadowFamOf = (id) => Object.keys(FAM_OF).find((f) => FAM_OF[f].includes(id)) || famOf(id);
const FAM_ORDER = ['income', 'health', 'access', 'tools', 'other', 'shadow-red', 'shadow-plum']; // warm to cool above the line, shadows last
const hue = (id, step = 0, fam) => { const f = fam || famOf(id), steps = FAMILY[f]; const i = Math.min(step, 2); return `var(--imp-${f}-${3 - i}, ${steps[i]})`; };
const labelHue = (id) => { const f = famOf(id); return `var(--imp-${f}-label, ${FAMILY[f][3]})`; };
// the income gold family stepped across the regions of the GDP poster, with region tints toward amber and olive
const GOLDS = ['#6B4E0E', '#9A6B18', '#C88A1E', '#E0A82E', '#B85D28', '#8C3B2B', '#4E6B48', '#2F5C6E']; // eight distinct inks, one per country
const MONO = 'Instrument Sans, monospace';
// the four tabs are the shell's views (store.js): millennium, decade, regions, shadows, all drawn by this module
const TABS = ['millennium', 'decade', 'regions', 'shadows'];

const fmtV = (v) => {
  if (v == null || !isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2).replace(/\.?0+$/, '')} billion`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '')} million`;
  if (a >= 100) return d3.format(',.0f')(v);
  if (a >= 10) return d3.format('.1f')(v).replace(/\.0$/, '');
  if (a >= 1) return d3.format('.2~f')(v);
  return d3.format('.3~f')(v);
};
const pct0 = (x) => `${Math.round(x * 100)}%`;
// plain names for every measure (the full title stays in the evidence panel)
const PLAIN = { life_expectancy: 'Life expectancy', maternal_mortality: 'Mothers dying in childbirth', child_mortality: 'Children dying before five', obesity_adults: 'Adult obesity', obesity: 'Adult obesity', overdose_deaths_us: 'Overdose deaths, US', suicide_rate: 'Suicide', depression_us: 'Depression, US', loneliness: 'Loneliness', time_online_daily: 'Time online', 'screen-time': 'Time online', median_income: 'Median income', gini: 'Income inequality', labor_productivity: 'Output per hour worked', pisa_math: 'Maths scores (PISA)', housing_cost_to_income: 'House prices against income', air_pollution_deaths: 'Air pollution deaths', extreme_poverty: 'Extreme poverty', electricity_access: 'Electricity at home', safe_water_access: 'Safe drinking water', dtp3_coverage: 'Infant vaccination', amr_deaths: 'Drug-resistant infections', road_deaths: 'Road deaths', 'road-deaths': 'Road deaths', co2_per_capita: 'CO2 per person', internet_use: 'People online', 'gdp-per-capita': 'Income per person', literacy: 'Literacy', 'working-hours': 'Working hours', 'price-of-light': 'Price of light', 'famine-deaths': 'Famine deaths', 'disaster-deaths': 'Disaster deaths', 'smallpox-cases': 'Smallpox', 'vaccines-lives-saved': 'Lives saved by vaccines', 'cereal-yields': 'Cereal yields', 'cost-of-communication': 'Cost of a phone call', 'travel-time': 'Crossing the Atlantic', population: 'World population', 'child-labor': 'Child labour', 'infectious-disease-deaths': 'Infectious disease deaths', 'genome-sequencing-cost': 'Sequencing a genome', 'solar-module-price': 'Solar panels', 'battery-pack-price': 'Battery packs', 'co2-emissions': 'CO2 emissions', 'nuclear-warheads': 'Nuclear warheads', 'e-waste': 'Electronic waste' };
const plain = (e) => PLAIN[e.id] || e.title;

export default function impact(el, { db, openEvidence }) {
  const D = db.impact || {};
  const M = D.metrics || [], SH = D.shadows || [];
  const all = [...M, ...SH];
  const RM = reduced();
  const pts = (m) => (m.points || []).filter((p) => p.value != null).sort((a, b) => a.year - b.year);
  const first = (m) => pts(m)[0], last = (m) => pts(m)[pts(m).length - 1];
  const srcOf = (m) => (m.sources || [])[0] || {};
  const srcLine = (m) => { const s = srcOf(m); return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a>` : esc(s.title || ''); };

  // ---------------------------------------------------------------- the last ten years: data, verdicts, census (unchanged rule)
  const NOW_MAX_YEAR = new Date().getFullYear(), REL = 0.002, STALE = 6;
  const slopeOf = (P) => { // least squares; endpoint slope for two readings
    if (P.length < 2) return null;
    if (P.length === 2) return (P[1].value - P[0].value) / (P[1].year - P[0].year || 1);
    const xs = P.map((p) => p.year), ys = P.map((p) => p.value), mx = d3.mean(xs), my = d3.mean(ys);
    const den = d3.sum(xs, (x) => (x - mx) ** 2); if (!den) return null;
    return d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / den;
  };
  const SAME = { life_expectancy: 'life-expectancy', maternal_mortality: 'maternal-mortality', child_mortality: 'child-mortality', obesity_adults: 'obesity', extreme_poverty: 'extreme-poverty', electricity_access: 'electricity-access', safe_water_access: 'clean-water', road_deaths: 'road-deaths', time_online_daily: 'screen-time' };
  const nowSeries = new Map(); // id -> { id, title, unit, better, shadow, byRegion: Map(region -> [{year, value}]), trend?, source, notes?, card?, research }
  for (const m of all) {
    const clean = (rp) => rp.filter((p) => p.value != null && p.year <= NOW_MAX_YEAR).sort((a, b) => a.year - b.year);
    const byRegion = new Map([['World', clean(pts(m))]]);
    for (const [name, rp] of Object.entries(m.region_series || {})) { if (name.includes(':')) continue; byRegion.set(name, clean(rp)); }
    const src = srcOf(m);
    nowSeries.set(m.id, { id: m.id, title: m.title, unit: m.unit || '', better: m.better || 'up', shadow: SH.includes(m), byRegion, source: { title: src.title || host(src.url || ''), url: src.url || '' }, card: m, research: false });
  }
  let nowMeta = null;
  function mergeResearch(J) {
    if (!J || !Array.isArray(J.metrics)) return 0;
    nowMeta = J; let n = 0;
    for (const r of J.metrics) {
      const byRegion = new Map();
      for (const [reg, rows] of Object.entries(r.series || {})) { const P = rows.map(([year, value]) => ({ year, value })).filter((p) => p.value != null && p.year <= NOW_MAX_YEAR).sort((a, b) => a.year - b.year); if (P.length) byRegion.set(reg, P); }
      if (!byRegion.size) continue;
      const sameId = SAME[r.id] || [...nowSeries.values()].find((e) => !e.research && e.title.toLowerCase() === String(r.label).toLowerCase())?.id;
      const prev = sameId ? nowSeries.get(sameId) : null;
      if (prev) nowSeries.delete(sameId);
      const better = r.direction === 'down_is_better' ? 'down' : r.direction === 'up_is_better' ? 'up' : 'contested';
      nowSeries.set(r.id, { id: r.id, title: r.label, unit: r.unit || '', better, shadow: prev ? prev.shadow : false, byRegion, trend: r.trend || {}, source: { title: r.source || '', url: r.source_url || '' }, notes: r.notes || '', sparse: !!r.sparse, card: prev ? prev.card : null, research: true });
      n++;
    }
    return n;
  }
  const nowRegions = () => { const c = new Map(); for (const { byRegion } of nowSeries.values()) for (const r of byRegion.keys()) if (r !== 'World') c.set(r, (c.get(r) || 0) + 1); return ['World', ...[...c].filter(([, k]) => k >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r]) => r)]; };
  // Kind (S4d): a measure of life, or a technology stand-in (the price of a technology, the share using it, a programme's
  // output). Everything not listed here is a measure of life; the list is the whole rule.
  const PROXY = new Set(['genome-sequencing-cost', 'solar-module-price', 'battery-pack-price', 'price-of-light', 'cost-of-communication', 'travel-time', 'internet_use', 'cereal-yields']);
  const STAT = new Set(['vaccines-lives-saved']); // a cumulative total: it sits beside the ribbons as a figure, outside both counts
  const kindOf = (e) => (STAT.has(e.id) ? 'stat' : PROXY.has(e.id) ? 'proxy' : 'outcome');
  const CONTEXT = new Set(['population']); // shown for context, without a better-or-worse verdict: no ribbon, no mark, no Places verdict
  const CLASSED = ['improving', 'stalled', 'worsening'];
  const isClassed = (r) => CLASSED.includes(r.cls);
  const CLASS_WORD = { improving: 'improving', stalled: 'stalled', worsening: 'worsening', insufficient_data: 'too few readings', unclassed: 'direction contested', 'no recent data': 'no recent data', 'not measured for this region': 'not measured for this region', context: 'context, no verdict' };
  function classify(e, P) {
    const lastP = P[P.length - 1];
    if (!lastP || lastP.year < NOW_MAX_YEAR - STALE) return { cls: 'no recent data', last: lastP };
    const win = P.filter((p) => p.year >= lastP.year - 10);
    const slope = slopeOf(win), mean = d3.mean(win, (p) => p.value);
    const base = { last: lastP, window: win.length ? [win[0].year, lastP.year] : null, slope, n: win.length, sparse: win.length === 2 };
    if (e.better === 'contested') return { ...base, cls: 'unclassed' };
    if (win.length < 2 || slope == null || !mean) return { ...base, cls: 'insufficient_data' };
    const rel = slope / Math.abs(mean), gain = rel * (e.better === 'down' ? -1 : 1);
    return { ...base, rel, cls: gain > REL ? 'improving' : gain < -REL ? 'worsening' : 'stalled' };
  }
  const excludeWhy = (r) => { // why a measure is left out of the count, with the fact that decides it
    if (r.cls === 'no recent data') return `left out: no recent decade${r.last ? ` (last reading ${r.last.year})` : ''}`;
    if (r.cls === 'insufficient_data') return `left out: no verdict (${r.n === 1 ? 'one reading' : `${r.n || 'too few'} readings`} in the last ten years)`;
    if (r.cls === 'unclassed') return 'left out: no verdict (direction contested)';
    if (r.cls === 'context') return 'shown for context, without a better-or-worse verdict';
    if (r.cls === 'not measured for this region') { const regs = [...r.e.byRegion.keys()].filter((k) => k !== r.region); return `left out: not measured for ${r.region}${regs.length ? ` (${regs.slice(0, 2).join(', ')}${regs.length > 2 ? ` and ${regs.length - 2} more` : ''} only)` : ''}`; }
    return CLASS_WORD[r.cls] || r.cls;
  };
  const nowRows = (region) => [...nowSeries.values()].map((e) => {
    const P = e.byRegion.get(region);
    if (!P || P.length < 1) return { e, region, none: true, cls: 'not measured for this region' };
    if (CONTEXT.has(e.id)) return { e, region, P, ...classify(e, P), cls: 'context' };
    const t = e.trend && e.trend[region];
    if (t && t.class) { // the research's own reading of its rule, carried as computed
      const lastP = P[P.length - 1], l10 = t.last10 || {};
      return { e, region, P, cls: t.class, last: lastP, window: l10.years || null, slope: l10.slope_per_year ?? null, rel: l10.relative_per_year ?? null, n: l10.n, sparse: !!(t.sparse || e.sparse || l10.n === 2), exPandemic: t.last10_ex_pandemic || null };
    }
    return { e, region, P, ...classify(e, P) };
  });
  const gain = (r) => (r.rel == null ? 0 : r.rel * (r.e.better === 'down' ? -1 : 1)); // the yearly change the good way, as a share of the level
  const slopeText = (r) => { if (r.slope == null) return ''; const a = Math.abs(r.slope); const f = a >= 100 ? d3.format(',.0f') : a >= 10 ? d3.format('.1f') : a >= 1 ? d3.format('.2f') : d3.format('.3f'); return `${r.slope > 0 ? '+' : r.slope < 0 ? '\u2212' : ''}${f(a)} a year${r.rel != null ? ` (${r.rel > 0 ? '+' : r.rel < 0 ? '\u2212' : ''}${(Math.abs(r.rel) * 100).toFixed(2)}% of its value)` : ''}`; };
  const yearsIn = (r) => (r.P || []).filter((p) => r.window && p.year >= r.window[0] && p.year <= r.window[1]).map((p) => p.year);
  function slopeLine(r) { // the verdict sentence: class, slope and the years it was read on
    const cls = CLASS_WORD[r.cls] || r.cls, Cls = cls.charAt(0).toUpperCase() + cls.slice(1), ys = yearsIn(r), n = r.n ?? ys.length;
    if (r.cls === 'insufficient_data') return `No verdict: ${n === 1 ? `one reading${ys.length ? ` (${ys[0]})` : ''}` : `${n} readings`} in the last ten years.`;
    if (r.cls === 'context') return 'Population is shown for context, without a better-or-worse verdict.';
    if (r.cls === 'unclassed') return `No verdict: the direction is contested${r.slope != null && r.window ? `; the slope over ${r.window[0]} to ${r.window[1]} is ${slopeText(r)}` : ''}.`;
    if (!isClassed(r) || !r.window) return `${Cls}.`;
    if (n === 2) return `${Cls} on two readings, ${ys.length === 2 ? `${ys[0]} and ${ys[1]}` : `${r.window[0]} and ${r.window[1]}`}; endpoint slope ${slopeText(r)}. The last ten years hold only these two.`;
    const span = r.window[1] - r.window[0];
    return `${Cls}: ${slopeText(r)} over ${r.window[0]} to ${r.window[1]}, ${n} readings${span < 10 ? ` (every reading since ${r.window[0]}; the measure is younger than ten years)` : ''}.`;
  }
  const noteText = (t = '') => t.replace(/;?\s*see trend\.[a-z0-9_.]+/gi, '').replace(/\s+\./g, '.').trim();
  // one census for every count on the page
  const census = (region) => {
    const rows = nowRows(region), classed = rows.filter(isClassed);
    const O = classed.filter((r) => kindOf(r.e) === 'outcome'), X = classed.filter((r) => kindOf(r.e) === 'proxy');
    return { region, rows, classed, O, X, oUp: O.filter((r) => r.cls === 'improving').length, xUp: X.filter((r) => r.cls === 'improving').length, excluded: rows.length - classed.length };
  };

  // ---------------------------------------------------------------- translate: the latest value and the direction in plain words
  const UNIT = (e) => { const u = e.unit.toLowerCase(); if (u.startsWith('%') || u.includes('% of')) return 'pct'; if (/dollar|us\$|\$|pound/.test(u)) return 'money'; if (/^years/.test(u)) return 'years'; if (/^hours/.test(u)) return 'hours'; if (/per 100,000/.test(u)) return 'per100k'; if (/per 1,000/.test(u)) return 'per1k'; return 'count'; };
  const money = (v) => (v >= 1000 ? d3.format(',.0f')(v) : v >= 100 ? d3.format('.0f')(v) : v >= 10 ? d3.format('.1f')(v) : d3.format('.2f')(v));
  const nowWord = (r) => { // "10%", "$525", "73 years", "37 per 1,000"
    if (!r.last) return ''; const v = r.last.value, u = UNIT(r.e), e = r.e;
    if (u === 'pct') return `${v >= 10 ? Math.round(v) : v.toFixed(1)}%`;
    if (u === 'money') return `${/pound/.test(e.unit) ? '£' : '$'}${money(v)}${/per day/.test(e.unit) ? ' a day' : /per watt/.test(e.unit) ? ' a watt' : /per kwh/i.test(e.unit) ? ' per kWh' : ''}`;
    if (u === 'years') return `${v.toFixed(1)} years`;
    if (u === 'hours') return `${v >= 100 ? d3.format(',.0f')(v) : v.toFixed(1)} hours${/per day/.test(e.unit) ? ' a day' : /per year/.test(e.unit) ? ' a year' : ''}`;
    if (u === 'per100k') return `${fmtV(v)} per 100,000`;
    if (u === 'per1k') return `${fmtV(v)} per 1,000`;
    if (/tonnes per hectare/.test(e.unit)) return `${v.toFixed(1)} t/ha`;
    if (/billion tonnes/.test(e.unit)) return `${v.toFixed(1)} billion t`;
    if (/million tonnes/.test(e.unit)) return `${fmtV(v)} million t`;
    if (/tonnes per person/.test(e.unit)) return `${v.toFixed(1)} t`;
    return fmtV(v);
  };
  const feel = (a) => (a >= 0.45 ? 'half' : a >= 0.28 ? 'a third' : a >= 0.2 ? 'a quarter' : a >= 0.14 ? 'a sixth' : a >= 0.08 ? 'a tenth' : a >= 0.005 ? `${Math.round(a * 100)} percent` : 'under half a percent');
  const dirWord = (r) => { // "falling", "about a quarter cheaper every year", "up about 3.6 points a year"
    if (!isClassed(r) || r.slope == null) return '';
    const u = UNIT(r.e), s = r.slope, a = Math.abs(s), rel = Math.abs(r.rel || 0), up = s > 0;
    if (r.cls === 'stalled') return 'about level';
    if (u === 'pct') return `${up ? 'up' : 'down'} about ${a >= 1 ? a.toFixed(1) : a.toFixed(2)} points a year`;
    if (u === 'money' && kindOf(r.e) === 'proxy') return `about ${feel(rel)} ${up ? 'dearer' : 'cheaper'} every year`;
    if (u === 'money') return `${up ? 'rising' : 'falling'} about ${feel(rel)} a year`;
    if (u === 'years') return `${up ? 'up' : 'down'} about ${Math.round(a * 52)} weeks a year`;
    if (u === 'hours') return `${up ? 'up' : 'down'} about ${Math.round(a * 60)} minutes a year`;
    return `${up ? 'rising' : 'falling'}, about ${feel(rel)} a year`;
  };

  // ---------------------------------------------------------------- markup
  const cur = { view: 'millennium', screen: 1 };
  el.innerHTML = `
    <section class="iv-panel iv-mill" data-view="millennium" hidden>
      <figure class="iv-poster" aria-label="Income per person, 1000 to 2022, every region the data carries">
        <h3 class="iv-claim"><span class="ln">incomes barely moved</span><span class="ln">for seven centuries,</span><span class="ln" data-third>then split.</span></h3>
        <div class="iv-poster-ch"></div>
        <figcaption class="iv-rail"><span><b>01</b> income per person, 1000 to 2022, <span class="iv-nreg"></span> countries<span class="iv-close"></span></span><span>international dollars (2011 prices), log scale</span><button type="button" class="iv-link" data-axis aria-pressed="false">stretch the last two centuries</button><span class="iv-src">source: ${srcLine(all.find((m) => m.id === 'gdp-per-capita') || {})}</span></figcaption>
      </figure>
      <figure class="iv-light" aria-label="Price of light in Britain, 1300 to 2023">
        <h3 class="iv-claim"><span class="ln">a million hours of light:</span><span class="ln">£30,000, then £2.</span></h3>
        <div class="iv-light-num" aria-live="polite"><span class="cur">£</span><span class="v"></span></div>
        <div class="iv-light-year sc"></div>
        <div class="iv-light-rail"></div>
        <figcaption class="iv-rail"><span><b>02</b> price of light, Britain, 1300 to 2023</span><span>pounds (2000 prices) per million lumen-hours</span><span class="iv-src">source: ${srcLine(all.find((m) => m.id === 'price-of-light') || {})}</span></figcaption>
      </figure>
    </section>
    <section class="iv-panel iv-now" data-view="decade" hidden>
      <h3 class="iv-h"></h3>
      <div class="iv-strip" role="list" aria-label="Measures of life with a verdict"></div>
      <p class="iv-named" aria-live="polite"></p>
      <div class="iv-ctl"><label class="sc">Region <select data-region></select></label><button type="button" class="iv-btn" data-six aria-pressed="false"></button><button type="button" class="iv-btn" data-table="outcome">Open the table</button></div>
      <div class="iv-map-row"><div class="iv-lifemap"></div><aside class="iv-stat"></aside></div>
      <p class="iv-tools"><span class="t"></span> <button type="button" class="iv-link" data-table="proxy">Their table</button> <span class="sep">·</span> <button type="button" class="iv-link" data-all>All 43 measures</button></p>
      <p class="iv-src sc"></p>
    </section>
    <section class="iv-panel iv-reg" data-view="regions" hidden>
      <h3 class="iv-h"></h3>
      <div class="iv-ctl"><span class="sc iv-key"><i class="k-up"></i> improving <i class="k-flat"></i> flat <i class="k-down"></i> worsening</span></div>
      <div class="iv-mx-scroll"><table class="iv-mx" data-chart></table></div>
      <div class="iv-place" hidden><label class="sc">Place <select data-place></select></label><ul class="iv-place-list"></ul></div>
      <p class="iv-src sc">Sources: Our World in Data, one source per measure, in the evidence panel.</p>
    </section>
    <section class="iv-panel iv-sh" data-view="shadows" hidden>
      <h3 class="iv-h">six costs that grew with the gains</h3>
      <div class="iv-tiles"></div>
      <p class="iv-src sc"></p>
    </section>`;
  const $ = (s) => el.querySelector(s);
  const nowState = { region: 'World', six: false };

  // ---------------------------------------------------------------- tabs and screens come from the shell (state.view, state.screen)
  function showTab() {
    const k = TABS.includes(cur.view) ? cur.view : 'millennium';
    el.dataset.tab = k;
    el.querySelectorAll('.iv-panel').forEach((p) => { p.hidden = p.dataset.view !== k; });
    if (k === 'millennium') drawMill(); else if (k === 'decade') drawNow(); else if (k === 'regions') drawRegions(); else drawShadows();
  }

  // ---------------------------------------------------------------- Millennium, screen 1: incomes in every region the data carries
  // Zürich: equal-interval centuries on an off-white field, every line black, the latest point of each the one yellow.
  // The variable axis is the move: a control stretches the last two centuries and the lines morph to the new scale.
  const GDP = all.find((m) => m.id === 'gdp-per-capita'), LIGHT = all.find((m) => m.id === 'price-of-light');
  const PS = { W: 0, stretch: false, svg: null, x: null, y: null, series: [], geo: null };
  const xScale = (stretch, l, r) => { const X = d3.scaleLinear().domain(stretch ? [1000, 1800, 2022] : [1000, 2022]).range(stretch ? [l, l + (r - l) * 0.38, r] : [l, r]); return X; };
  function drawPoster() {
    const hostEl = $('.iv-poster-ch'); if (!GDP || !hostEl) return;
    const W = hostEl.clientWidth; if (!W || W === PS.W) return; PS.W = W;
    const narrow = W < 600, H = narrow ? 320 : 430, m0 = { l: narrow ? 44 : 58, r: narrow ? 124 : 190, t: 16, b: 30 };
    const series = Object.entries(GDP.region_series || {}).filter(([name]) => !name.includes(':')).map(([name, rp]) => ({ name, P: rp.filter((p) => p.value != null && p.value > 0).sort((a, b) => a.year - b.year) })).filter((s) => s.P.length > 1);
    const nEl = $('.iv-nreg'); if (nEl) nEl.textContent = String(series.length);
    // the third line and the rail clause are computed: did the gap between the richest and China close since 1980?
    const at = (name, yr) => { const q = series.find((x) => x.name === name); const pt = q && q.P.find((p) => p.year === yr); return pt ? pt.value : null; };
    const last = (name) => { const q = series.find((x) => x.name === name); return q ? q.P[q.P.length - 1] : null; };
    const uk80 = at('United Kingdom', 1980), cn80 = at('China', 1980), ukL = last('United Kingdom'), cnL = last('China');
    const closing = uk80 && cn80 && ukL && cnL && uk80 / cn80 > ukL.value / cnL.value * 1.5; // the ratio fell by half or more
    const spans = [...el.querySelectorAll('.iv-poster .iv-claim .ln')];
    if (spans.length === 3 && closing) { spans[0].textContent = 'Incomes flat for centuries,'; spans[1].textContent = 'then split,'; spans[2].textContent = 'now closing.'; } // eight words; "now closing" is the ratio falling by half
    const FOLD = { 2: 'twofold', 3: 'threefold', 4: 'fourfold', 5: 'fivefold', 6: 'sixfold', 7: 'sevenfold', 8: 'eightfold', 9: 'ninefold', 10: 'tenfold', 11: 'elevenfold', 12: 'twelvefold' };
    const fold = (name) => { const a = at(name, 1980), l = last(name); const k = a && l ? Math.round(l.value / a) : 0; return k >= 2 ? `${name} ${FOLD[k] || `${k}-fold`}` : ''; };
    const cl = $('.iv-close'); if (cl) { const parts = [fold('China'), fold('India')].filter(Boolean); cl.textContent = `${parts.length ? ` \u00b7 ${parts.join(' and ')} since 1980` : ''} \u00b7 no African or Latin American country in this record`; }
    const y = d3.scaleLog().domain([d3.min(series, (s) => d3.min(s.P, (p) => p.value)) * 0.9, d3.max(series, (s) => d3.max(s.P, (p) => p.value)) * 1.1]).range([H - m0.b, m0.t]);
    hostEl.innerHTML = '';
    const svg = d3.select(hostEl).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `GDP per person on a log scale, ${series.map((s) => s.name).join(', ')}, year 1000 to 2022`);
    PS.svg = svg; PS.y = y; PS.series = series; PS.geo = { W, H, m0, narrow };
    svg.append('g').attr('class', 'cent');
    for (const v of [1000, 10000]) { svg.append('line').attr('x1', m0.l).attr('x2', W - m0.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', INK).attr('stroke-opacity', 0.25); svg.append('text').attr('x', m0.l - 6).attr('y', y(v) + 3).attr('text-anchor', 'end').attr('font-family', MONO).attr('font-size', 10).attr('fill', INK).text(d3.format(',')(v)); }
    svg.append('g').attr('class', 'lines').selectAll('path').data(series).join('path').attr('fill', 'none').attr('stroke', (s, i) => GOLDS[i % GOLDS.length]).attr('stroke-width', 1.5).attr('stroke-linejoin', 'round');
    svg.append('g').attr('class', 'ends');
    svg.append('g').attr('class', 'labs').attr('font-family', MONO).attr('font-size', narrow ? 9.5 : 11).attr('fill', INK);
    layoutPoster(false);
  }
  function layoutPoster(animate) {
    const { W, H, m0, narrow } = PS.geo, y = PS.y, x = xScale(PS.stretch, m0.l, W - m0.r), svg = PS.svg, dur = animate && !RM ? 900 : 0;
    const T = (sel) => (dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel);
    const cents = d3.range(1000, 2001, 100);
    const cg = svg.select('.cent').selectAll('g').data(cents, (d) => d).join((en) => { const g = en.append('g'); g.append('line').attr('y1', m0.t).attr('y2', H - m0.b).attr('stroke', INK).attr('stroke-opacity', (d) => (d % 500 ? 0.14 : 0.4)); g.append('text').attr('y', H - m0.b + 16).attr('text-anchor', 'middle').attr('font-family', MONO).attr('font-size', 10).attr('fill', INK).text((d) => d); return g; });
    T(cg.select('line')).attr('x1', (d) => x(d)).attr('x2', (d) => x(d));
    const hid = (d) => (narrow && d % 200) || (PS.stretch && d < 1800 && d % 200) || (narrow && PS.stretch && d < 1800 && d !== 1000); // a phone's stretched axis keeps 1000, 1800, 1900, 2000
    cg.select('text').attr('display', (d) => (hid(d) ? 'none' : null));
    T(cg.select('text')).attr('x', (d) => x(d));
    const line = d3.line().x((p) => x(p.year)).y((p) => y(p.value));
    T(svg.select('.lines').selectAll('path')).attr('d', (s) => line(s.P));
    const SHORTN = narrow ? { 'United States': 'US', 'United Kingdom': 'UK' } : {};
    const labs = PS.series.map((s) => { const l = s.P[s.P.length - 1]; return { s, l, y: y(l.value), text: `${SHORTN[s.name] || s.name} ${d3.format(',')(Math.round(l.value))}` }; }).sort((a, b) => a.y - b.y);
    for (let k = 0; k < 8; k++) { for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13; for (let i = labs.length - 2; i >= 0; i--) if (labs[i + 1].y - labs[i].y < 13) labs[i].y = labs[i + 1].y - 13; }
    const col = (d) => GOLDS[PS.series.indexOf(d.s) % GOLDS.length];
    const ends = svg.select('.ends').selectAll('circle').data(labs, (d) => d.s.name).join('circle').attr('r', 3.2).attr('fill', col).attr('cy', (d) => y(d.l.value));
    T(ends).attr('cx', (d) => x(d.l.year));
    svg.select('.labs').selectAll('text').data(labs, (d) => d.s.name).join('text').attr('x', W - m0.r + 8).attr('y', (d) => d.y + 3.5).attr('fill', col).text((d) => d.text);
    const b = $('[data-axis]'); if (b) { b.setAttribute('aria-pressed', String(PS.stretch)); b.textContent = PS.stretch ? 'equal centuries' : 'stretch the last two centuries'; }
  }
  $('.iv-mill').addEventListener('click', (ev) => { if (ev.target.closest('[data-axis]')) { PS.stretch = !PS.stretch; layoutPoster(true); } });

  // ---------------------------------------------------------------- Millennium, screen 2: the price of light rolls from the first reading to the last
  const LP = LIGHT ? pts(LIGHT) : [];
  const lightAt = (yr) => { // log interpolation between readings
    if (!LP.length) return null; if (yr <= LP[0].year) return LP[0].value; if (yr >= LP[LP.length - 1].year) return LP[LP.length - 1].value;
    const i = d3.bisector((p) => p.year).left(LP, yr), a = LP[i - 1], b = LP[i]; if (b.year === yr) return b.value;
    const t = (yr - a.year) / (b.year - a.year); return Math.exp(Math.log(a.value) + (Math.log(b.value) - Math.log(a.value)) * t);
  };
  const fmtL = (v) => (v >= 1000 ? d3.format(',.0f')(v) : v >= 100 ? d3.format('.0f')(v) : v >= 10 ? d3.format('.1f')(v) : d3.format('.2f')(v));
  const LS = { year: 1300, raf: 0, shown: false };
  function setLight(yr, roll = true) {
    const numEl = $('.iv-light-num .v'), yrEl = $('.iv-light-year'), rail = $('.iv-light-rail'); if (!numEl || !LP.length) return;
    const from = LS.year, to = Math.max(LP[0].year, Math.min(LP[LP.length - 1].year, Math.round(yr)));
    cancelAnimationFrame(LS.raf);
    const place = (y) => { LS.year = y; numEl.textContent = fmtL(lightAt(y)); const msHit = (LIGHT.milestones || []).find((d) => d.year === y); yrEl.textContent = `${y}${msHit ? ` \u00b7 ${msHit.label}` : LP.some((p) => p.year === y) ? '' : ' (between readings)'}`; const mk = rail.querySelector('.mk'); if (mk) { const q = (y - 1300) / (2023 - 1300); mk.style.left = `calc(${q * 100}% - ${q * 13}px)`; } rail.querySelectorAll('[data-ms]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.ms) === y))); };
    if (RM || !roll || from === to) { place(to); return; }
    const dur = Math.max(200, Math.min(1200, Math.abs(to - from) * 1.6)), t0 = performance.now(); // 1.6ms a year: the full span rolls in 1.2s
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); place(Math.round(from + (to - from) * e)); if (k < 1) LS.raf = requestAnimationFrame(step); };
    LS.raf = requestAnimationFrame(step);
  }
  function drawLight() {
    const rail = $('.iv-light-rail'); if (!rail || !LIGHT || rail.dataset.built) return;
    rail.dataset.built = '1';
    const ms = (LIGHT.milestones || []).slice().sort((a, b) => a.year - b.year);
    const px = (yr) => ((yr - 1300) / (2023 - 1300)) * 100;
    rail.innerHTML = `<div class="line"></div><i class="mk"></i>${ms.map((d, i) => `<button type="button" data-ms="${d.year}" aria-pressed="false" style="left:${px(d.year)}%; --p:${px(d.year) / 100}" aria-label="${d.year}: ${esc(d.label)}; £${esc(fmtL(lightAt(d.year)))}" class="${i % 2 ? 'lo' : 'hi'}"><i></i><span><b>${d.year}</b> ${esc(d.label)}</span></button>`).join('')}<span class="end l">1300</span><span class="end r">2023</span>`;
    rail.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ms]'); if (b) setLight(Number(b.dataset.ms)); });
    rail.addEventListener('pointermove', (ev) => { if (ev.target.closest('[data-ms]')) return; const r = rail.getBoundingClientRect(); setLight(1300 + ((ev.clientX - r.left) / r.width) * (2023 - 1300), false); });
    setLight(1300, false);
  }
  function drawMill() {
    const two = cur.screen >= 2;
    $('.iv-poster').hidden = two; $('.iv-light').hidden = !two;
    if (two) { drawLight(); if (!LS.shown) { LS.shown = true; setLight(2023); } } else drawPoster();
  }

  // ---------------------------------------------------------------- Last ten years: headline, strip, LifeMap, tools line
  const nowEl = $('.iv-now'), hEl = nowEl.querySelector('.iv-h'), stripEl = nowEl.querySelector('.iv-strip'), namedEl = nowEl.querySelector('.iv-named'), mapEl = nowEl.querySelector('.iv-lifemap'), toolsEl = nowEl.querySelector('.iv-tools .t'), srcEl = nowEl.querySelector('.iv-now > .iv-src'), sixBtn = nowEl.querySelector('[data-six]'), regSel = nowEl.querySelector('[data-region]');
  function drawNow() {
    const C = census(nowState.region), notUp = C.O.filter((r) => r.cls !== 'improving');
    const where = C.region === 'World' ? '' : `, ${C.region}`;
    hEl.textContent = `${C.oUp} of ${C.O.length} measures of life still improving${where}`;
    // the strip: one mark per measure with a verdict, filled when improving; a tap names the mark
    const ordered = [...C.O].sort((a, b) => (a.cls === 'improving' ? 0 : 1) - (b.cls === 'improving' ? 0 : 1) || gain(b) - gain(a));
    stripEl.innerHTML = ordered.map((r) => `<button type="button" role="listitem" class="mk ${r.cls}${nowState.six && r.cls === 'improving' ? ' dim' : ''}" data-id="${esc(r.e.id)}" style="--c:${hue(r.e.id)}" aria-label="${esc(plain(r.e))}: ${r.cls}" aria-pressed="false"></button>`).join('');
    namedEl.textContent = nowState.six ? `${notUp.map((r) => `${plain(r.e)} (${r.cls === 'stalled' ? 'about level' : 'worsening'})`).join(' · ')}` : '';
    sixBtn.textContent = nowState.six ? `Show all ${C.O.length}` : `Show the ${notUp.length} that aren't`;
    sixBtn.setAttribute('aria-pressed', String(nowState.six));
    toolsEl.textContent = `${C.xUp} of ${C.X.length} tools and programmes still spreading or getting cheaper${where}.`;
    srcEl.textContent = `Sources: each measure's own, in the evidence panel${nowMeta ? ` (gathered ${nowMeta.built})` : ''}.`;
    if (![...regSel.options].length) regSel.innerHTML = nowRegions().map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
    regSel.value = nowState.region;
    drawLifemap(C);
    const statEl = nowEl.querySelector('.iv-stat'), V = nowSeries.get('vaccines-lives-saved'), VP = V && V.byRegion.get('World');
    statEl.innerHTML = VP && VP.length ? `<b>${esc(fmtV(VP[VP.length - 1].value))}</b><span>lives saved by childhood vaccines since ${VP[0].year}, to ${VP[VP.length - 1].year}</span><button type="button" class="iv-link" data-stat>Evidence</button>` : '';
  }
  // LifeMap (council round 1): one ribbon per measure with a verdict, equal heights, the improving above one divider and
  // the rest below, grouped in subject families (income, health, access, tools; shadows last). Each ribbon carries its own
  // ten-year trace, its latest value and its change; the area encodes nothing, so unlike units never stack. The ribbon
  // in hand takes an ink outline. A change of region or filter morphs the ribbons to their new places (700ms).
  const LM = { W: 0, svg: null, hand: null };
  function drawLifemap(C) {
    const W = mapEl.clientWidth; if (!W) return;
    // phones: 48px rows, the name and the value on the first line and the trace beneath; wider: 17px rows with the trace between
    const narrow = W < 600, RH = narrow ? 48 : 17, GAP = 2, nameW = narrow ? 0 : 210, m0 = { t: 6, b: 6 };
    const list = nowState.six ? C.O.filter((r) => r.cls !== 'improving') : C.O;
    const fo = (r) => FAM_ORDER.indexOf(famOf(r.e.id));
    const up = list.filter((r) => r.cls === 'improving').sort((a, b) => fo(a) - fo(b) || gain(b) - gain(a));
    const down = list.filter((r) => r.cls !== 'improving').sort((a, b) => fo(a) - fo(b) || gain(a) - gain(b));
    const both = up.length > 0 && down.length > 0, DIV = both ? 40 : 0, CAP = !both && list.length ? 22 : 0; // the divider carries its two labels; one side alone takes a caption
    const H = m0.t + CAP + up.length * (RH + GAP) + DIV + down.length * (RH + GAP) + m0.b;
    const fresh = W !== LM.W || !LM.svg || !mapEl.contains(LM.svg.node()); LM.W = W;
    if (fresh) { mapEl.innerHTML = ''; LM.svg = d3.select(mapEl).append('svg'); LM.svg.append('g').attr('class', 'rib'); const dv = LM.svg.append('g').attr('class', 'div'); dv.append('line').attr('class', 'base').attr('stroke', INK).attr('stroke-width', 1.2); dv.append('text').attr('class', 'la').attr('x', 0).attr('fill', INK).attr('font-family', MONO).attr('font-size', 12).attr('letter-spacing', '0.06em').text('IMPROVING'); dv.append('text').attr('class', 'lb').attr('x', 0).attr('fill', INK).attr('font-family', MONO).attr('font-size', 12).attr('letter-spacing', '0.06em').text('STALLED OR WORSENING'); }
    const svg = LM.svg, dur = fresh || RM ? 0 : 700, T = (sel) => (dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel);
    T(svg).attr('viewBox', `0 0 ${W} ${H}`).attr('height', H); svg.attr('width', W).attr('role', 'img').attr('aria-label', `${up.length} measures improving above the line, ${down.length} stalled or worsening below it, ${C.region}`);
    const baseY = m0.t + CAP + up.length * (RH + GAP) + DIV / 2;
    T(svg.select('.base')).attr('x1', 0).attr('x2', W).attr('y1', baseY).attr('y2', baseY).attr('opacity', both ? 1 : 0);
    T(svg.select('.la')).attr('y', both ? baseY - 7 : m0.t + 12).attr('opacity', up.length ? 1 : 0);
    T(svg.select('.lb')).attr('y', both ? baseY + 15 : m0.t + 12).attr('opacity', down.length ? 1 : 0);
    const items = [];
    up.forEach((r, i) => items.push({ id: r.e.id, r, i, y: m0.t + CAP + i * (RH + GAP), side: 1 }));
    down.forEach((r, i) => items.push({ id: r.e.id, r, i, y: m0.t + CAP + up.length * (RH + GAP) + DIV + i * (RH + GAP), side: -1 }));
    // the row's end: the latest value, its year and one word for the direction (no change figure: the slope is a fit, not an observed change)
    const word = (r) => (r.cls === 'stalled' ? 'about level' : r.slope > 0 ? 'rising' : 'falling');
    const ending = (r) => `${nowWord(r)} \u00b7 ${r.last ? r.last.year : ''} \u00b7 ${word(r)}`;
    // the trace's box: between the name column and a fixed 168px value column at wide widths; the lower half of the row on phones
    let valEnd = W - 168; // moved further left below if a value text is wider than the column
    const traceBox = () => (narrow ? { x0: 8, x1: valEnd, y0: 22, y1: RH - 5 } : { x0: nameW + 8, x1: valEnd, y0: 4, y1: RH - 4 });
    const fitted = (r) => (r.P || []).filter((p) => r.window && p.year >= r.window[0] && p.year <= r.window[1]);
    const scales = (r) => { const P = fitted(r); if (P.length < 2) return null; const b = traceBox(); const x = d3.scaleLinear().domain([P[0].year, P[P.length - 1].year]).range([b.x0, b.x1]), ext = d3.extent(P, (p) => p.value), y = d3.scaleLinear().domain(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext).range([b.y1, b.y0]); return { P, x, y }; };
    const trace = (d) => { const sc = scales(d.r); return sc ? d3.line().x((p) => sc.x(p.year)).y((p) => sc.y(p.value))(sc.P) : ''; };
    const textY = narrow ? 15 : RH / 2 + 3.5, valY = narrow ? 37 : textY;
    const g = svg.select('.rib').selectAll('g.r').data(items, (d) => d.id).join((en) => {
      const gg = en.append('g').attr('class', 'r').style('cursor', 'pointer').attr('transform', (d) => `translate(0,${d.y})`).attr('opacity', 0);
      gg.append('rect').attr('x', 0).attr('width', W).attr('height', RH);
      gg.append('text').attr('class', 'nm').attr('x', 8).attr('fill', PAPER).attr('font-family', MONO).attr('font-size', narrow ? 12 : 10.5);
      gg.append('path').attr('class', 'tr').attr('fill', 'none').attr('stroke', PAPER).attr('stroke-width', 1.2).attr('stroke-opacity', 0.9);
      gg.append('circle').attr('class', 'lp').attr('r', 2.4).attr('fill', PAPER);
      gg.append('text').attr('class', 'vl').attr('text-anchor', 'end').attr('fill', PAPER).attr('font-family', MONO).attr('font-size', narrow ? 12 : 10.5);
      gg.append('title');
      gg.on('click', (_, d) => openSeries(d.id, nowState.region)).on('pointerenter', (_, d) => hand(d.id)).on('pointerleave', () => hand(null));
      return gg;
    }, (upd) => upd, (ex) => T(ex).attr('opacity', 0).remove());
    g.select('rect').attr('width', W).attr('height', RH).style('fill', (d) => hue(d.id, d.i % 2)).attr('stroke', PAPER).attr('stroke-width', 0.8);
    g.select('.nm').attr('y', textY).text((d) => plain(d.r.e)); // the full name, always
    g.select('.vl').attr('x', W - 8).attr('y', valY).text((d) => ending(d.r));
    let maxW = 0; g.select('.vl').each(function () { let w = 0; try { w = this.getComputedTextLength(); } catch (_) { w = 0; } if (!w) w = (this.textContent || '').length * (narrow ? 7.3 : 6.4); maxW = Math.max(maxW, w); });
    valEnd = narrow ? W - 8 - maxW - 14 : Math.min(W - 168, W - 8 - maxW - 14);
    g.select('.tr').attr('d', trace);
    g.select('.lp').each(function (d) { const sc = scales(d.r); if (!sc) { d3.select(this).attr('display', 'none'); return; } const l = sc.P[sc.P.length - 1]; d3.select(this).attr('display', null).attr('cx', sc.x(l.year)).attr('cy', sc.y(l.value)); });
    g.select('title').text((d) => `${plain(d.r.e)}: ${nowWord(d.r)} in ${d.r.last ? d.r.last.year : ''}, ${dirWord(d.r)}`);
    T(g).attr('transform', (d) => `translate(0,${d.y})`).attr('opacity', 1);
  }
  function hand(id) { // the ribbon in hand: an ink outline, drawn last so it sits on top
    LM.hand = id; if (!LM.svg) return;
    LM.svg.selectAll('g.r rect').attr('stroke', (d) => (d.id === id ? INK : PAPER)).attr('stroke-width', (d) => (d.id === id ? 1.6 : 0.8));
    LM.svg.selectAll('g.r').each(function (d) { if (d.id === id) this.parentNode.appendChild(this); });
  }
  nowEl.addEventListener('change', (ev) => { if (ev.target.matches('[data-region]')) { nowState.region = ev.target.value; drawNow(); } });
  nowEl.addEventListener('click', (ev) => {
    const mk = ev.target.closest('.iv-strip .mk'); if (mk) { const r = census(nowState.region).O.find((q) => q.e.id === mk.dataset.id); if (r) { stripEl.querySelectorAll('.mk').forEach((b) => b.setAttribute('aria-pressed', String(b === mk))); namedEl.textContent = `${plain(r.e)}: ${nowWord(r)}, ${dirWord(r)}.`; } return; }
    if (ev.target.closest('[data-six]')) { nowState.six = !nowState.six; drawNow(); return; }
    const tb = ev.target.closest('[data-table]'); if (tb) { evTable(tb.dataset.table); return; }
    if (ev.target.closest('[data-all]')) evAll();
    if (ev.target.closest('[data-stat]')) openSeries('vaccines-lives-saved', 'World');
  });

  // ---------------------------------------------------------------- By region: one matrix, twelve columns, no horizontal scroll
  const regEl = $('.iv-reg'), mxT = regEl.querySelector('.iv-mx'), regH = regEl.querySelector('.iv-h');
  const mxCap = () => { const W = regEl.clientWidth || 1200; return Math.max(3, Math.min(14, Math.floor((W - 208) / 82))); }; // 82px columns after a 208px measure column (the longest name whole): 14 at 1440, no scroll
  const SHORT = { 'High-income countries': 'High income', 'Low-income countries': 'Low income', 'Lower-middle-income countries': 'Lower-mid income', 'Upper-middle-income countries': 'Upper-mid income', 'WHO African Region': 'WHO Africa', 'WHO Region of the Americas': 'WHO Americas', 'WHO South-East Asia Region': 'WHO SE Asia', 'WHO Western Pacific Region': 'WHO W. Pacific', 'WHO Eastern Mediterranean Region': 'WHO E. Medit.', 'WHO European Region': 'WHO Europe', 'Western Europe': 'W. Europe', 'North America': 'N. America', 'South America': 'S. America', 'United Kingdom': 'UK', 'United States': 'US' };
  // a fixed geographic order, west to east, then the income groups; World stands apart as the first column
  const GEO = ['World', 'North America', 'United States', 'South America', 'Europe', 'Western Europe', 'United Kingdom', 'Africa', 'India', 'China', 'Asia', 'High-income countries', 'Upper-middle-income countries', 'Lower-middle-income countries', 'Low-income countries'];
  const geoRank = (r) => { const i = GEO.indexOf(r); return i < 0 ? GEO.length : i; };
  const matrixRegions = () => { const c = new Map(); for (const { byRegion } of nowSeries.values()) for (const r of byRegion.keys()) if (!/[(,]/.test(r)) c.set(r, (c.get(r) || 0) + 1); return [...c].filter(([r, k]) => r === 'World' || k >= 2).map(([r]) => r).sort((a, b) => geoRank(a) - geoRank(b) || a.localeCompare(b)); };
  const placeState = { place: 'World' };
  function drawRegions() {
    const phone = regEl.clientWidth > 0 && regEl.clientWidth < 600; // phones: one Place selector and full names with a word each, 44px rows
    regEl.querySelector('.iv-mx-scroll').hidden = phone; regEl.querySelector('.iv-key').hidden = phone; regEl.querySelector('.iv-place').hidden = !phone;
    if (phone) { drawPlaceList(); return; }
    const cols = matrixRegions().map((r) => { const rows = nowRows(r), classed = rows.filter(isClassed); return { r, rows: new Map(rows.map((q) => [q.e.id, q])), n: classed.length }; }).filter((c) => c.n > 0);
    const shown = cols.slice(0, mxCap());
    const ids = [...nowSeries.values()].map((e) => ({ e, k: shown.reduce((n, c) => n + (isClassed(c.rows.get(e.id) || {}) ? 1 : 0), 0) })).filter((x) => x.k > 0).sort((a, b) => FAM_ORDER.indexOf(famOf(a.e.id)) - FAM_ORDER.indexOf(famOf(b.e.id)) || plain(a.e).localeCompare(plain(b.e)));
    // rows 20px with 12px labels; every row in view, no scroll box
    mxT.innerHTML = `<thead><tr><th class="m" scope="col">Measure</th>${shown.map((c) => `<th scope="col" class="${c.r === 'World' ? 'w' : ''}"${SHORT[c.r] ? ` title="${esc(c.r)}"` : ''}><span class="r">${esc(SHORT[c.r] || c.r)}</span></th>`).join('')}</tr></thead>
      <tbody>${ids.map(({ e }) => `<tr style="--c:${hue(e.id)}"><th scope="row" class="m">${esc(plain(e))}</th>${shown.map((c) => { const q = c.rows.get(e.id); const cls = q && isClassed(q) ? q.cls : null; return cls ? `<td class="${cls}${c.r === 'World' ? ' w' : ''}"><button type="button" data-id="${esc(e.id)}" data-r="${esc(c.r)}" aria-label="${esc(plain(e))}, ${esc(c.r)}: ${cls}; opens the evidence" title="${esc(`${plain(e)}, ${c.r}: ${cls}${q.slope != null ? `, ${slopeText(q)}` : ''}`)}"><i></i></button></td>` : `<td class="none${c.r === 'World' ? ' w' : ''}"${q && q.cls !== 'not measured for this region' ? ` title="${esc(`${plain(e)}, ${c.r}: ${CLASS_WORD[q.cls] || q.cls}`)}"` : ''}>${q && q.cls !== 'not measured for this region' ? '<i></i>' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody>`;
    // the headline: the stronger sentence only when the matrix bears it out (every health verdict improving in every column, no income verdict improving); otherwise the plain one
    const verdicts = (fam) => ids.filter(({ e }) => famOf(e.id) === fam).flatMap(({ e }) => shown.map((c) => c.rows.get(e.id)).filter((q) => q && isClassed(q)).map((q) => q.cls));
    const hv = verdicts('health'), iv = verdicts('income');
    const strong = hv.length > 0 && hv.every((c) => c === 'improving') && iv.length > 0 && iv.every((c) => c !== 'improving');
    regH.textContent = strong ? 'Health kept improving everywhere; incomes stalled' : 'Progress differs across measures and places.';
  }
  function drawPlaceList() {
    const sel = regEl.querySelector('[data-place]'), places = matrixRegions();
    if (!places.includes(placeState.place)) placeState.place = 'World';
    sel.innerHTML = places.map((r) => `<option value="${esc(r)}"${r === placeState.place ? ' selected' : ''}>${esc(r)}</option>`).join('');
    const rows = nowRows(placeState.place).filter(isClassed).sort((a, b) => FAM_ORDER.indexOf(famOf(a.e.id)) - FAM_ORDER.indexOf(famOf(b.e.id)) || plain(a.e).localeCompare(plain(b.e)));
    const WORD = { improving: 'Improving', stalled: 'Flat', worsening: 'Worsening' };
    regEl.querySelector('.iv-place-list').innerHTML = rows.map((q) => `<li style="--c:${hue(q.e.id)}"><button type="button" data-id="${esc(q.e.id)}" data-r="${esc(placeState.place)}"><i class="${q.cls}"></i><span class="n">${esc(plain(q.e))}</span><span class="v">${WORD[q.cls]}</span></button></li>`).join('');
    regH.textContent = 'Progress differs across measures and places.';
  }
  regEl.addEventListener('change', (ev) => { if (ev.target.matches('[data-place]')) { placeState.place = ev.target.value; drawPlaceList(); } });
  regEl.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-r]'); if (b) openSeries(b.dataset.id, b.dataset.r); });

  // ---------------------------------------------------------------- Shadows: six costs in the shadow reds and plums
  const shEl = $('.iv-sh'), tilesEl = shEl.querySelector('.iv-tiles');
  const researchIdOf = (cardId) => Object.entries(SAME).find(([, c]) => c === cardId)?.[0] || cardId;
  let tilesW = 0;
  function drawShadows() {
    const W = tilesEl.clientWidth; if (!W || W === tilesW) return; tilesW = W;
    const cols = W < 560 ? 1 : W < 980 ? 2 : 3, tw = Math.floor((W - (cols - 1) * 24) / cols), ch = 130, m0 = { l: 8, r: 70, t: 12, b: 20 };
    const rows = nowRows('World');
    tilesEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const rising = SH.filter((m) => { const r = rows.find((q) => q.e.id === researchIdOf(m.id)) || rows.find((q) => q.e.id === m.id); return r && isClassed(r) && r.slope > 0; }).length;
    const COUNT = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    shEl.querySelector('.iv-h').textContent = rising === SH.length ? 'All of these costs are still rising.' : `${COUNT[rising] || rising} of these costs ${rising === 1 ? 'is' : 'are'} still rising.`;
    tilesEl.innerHTML = SH.map((m) => { const id = researchIdOf(m.id), r = rows.find((q) => q.e.id === id) || rows.find((q) => q.e.id === m.id); const l = last(m); return `<button type="button" class="iv-tile" data-id="${esc(id)}"><span class="t">${esc(plain(m))}</span><span class="d" data-chart>${r && isClassed(r) ? `${esc(nowWord(r))}, ${esc(dirWord(r))}` : `${esc(r && r.last ? nowWord(r) : fmtV(l.value))} in ${l.year}${r ? `; ${esc(CLASS_WORD[r.cls] || r.cls)}` : ''}`}</span><span class="ch" data-m="${esc(m.id)}"></span><span class="s sc" data-chart>${first(m).year} to ${l.year} · ${esc(m.unit)}</span></button>`; }).join('');
    for (const m of SH) {
      const hostEl = tilesEl.querySelector(`.ch[data-m="${CSS.escape(m.id)}"]`), P = pts(m); if (!hostEl || P.length < 2) continue;
      const x = d3.scaleLinear().domain([P[0].year, P[P.length - 1].year]).range([m0.l, tw - m0.r]), y = d3.scaleLinear().domain([Math.min(0, d3.min(P, (p) => p.value)), d3.max(P, (p) => p.value)]).nice().range([ch - m0.b, m0.t]);
      const svg = d3.select(hostEl).append('svg').attr('viewBox', `0 0 ${tw} ${ch}`).attr('width', tw).attr('height', ch).attr('role', 'img').attr('aria-label', `${plain(m)}, ${P[0].year} to ${P[P.length - 1].year}`);
      svg.append('line').attr('x1', m0.l).attr('x2', tw - m0.r).attr('y1', ch - m0.b).attr('y2', ch - m0.b).attr('stroke', INK).attr('stroke-opacity', 0.3);
      const id = researchIdOf(m.id), fam = shadowFamOf(id), step = Math.max(0, FAM_OF[fam] ? FAM_OF[fam].filter((k) => nowSeries.has(k) || k === id).indexOf(id) : -1) % 3, c1 = hue(id, step, fam), c0 = hue(id, 0, fam); // each tile its own step of its family
      svg.append('path').attr('d', d3.area().x((p) => x(p.year)).y0(ch - m0.b).y1((p) => y(p.value))(P)).style('fill', c1).attr('fill-opacity', 0.28);
      svg.append('path').attr('d', d3.line().x((p) => x(p.year)).y((p) => y(p.value))(P)).attr('fill', 'none').style('stroke', c1).attr('stroke-width', 1.6);
      const l = P[P.length - 1];
      svg.append('circle').attr('cx', x(l.year)).attr('cy', y(l.value)).attr('r', 3.5).style('fill', c0);
      svg.append('text').attr('x', x(l.year) + 7).attr('y', y(l.value) + 3.5).attr('font-family', MONO).attr('font-size', 10.5).style('fill', labelHue(id)).text(fmtV(l.value));
      const ax = svg.append('g').attr('font-family', MONO).attr('font-size', 9.5).attr('fill', 'var(--ink-3)');
      ax.append('text').attr('x', m0.l).attr('y', ch - 6).text(P[0].year); ax.append('text').attr('x', tw - m0.r).attr('y', ch - 6).attr('text-anchor', 'end').text(l.year);
    }
    const seen = new Map(); for (const m of SH) { const t = srcOf(m); const short = (t.title || host(t.url || '')).split(':')[0].split(' via ').pop().trim(); if (!seen.has(short)) seen.set(short, t.url || ''); }
    shEl.querySelector('.iv-src').innerHTML = `Sources: ${[...seen].map(([short, url]) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(short)}</a>` : esc(short))).join(', ')}; the full titles in the evidence panel.`;
  }
  tilesEl.addEventListener('click', (ev) => { const b = ev.target.closest('.iv-tile'); if (b) openSeries(b.dataset.id, 'World'); });

  // ---------------------------------------------------------------- the evidence panel (the shell's #drawer): tables, one measure, all 43, compare
  let evBody = null;
  function evOpen(key, title, sub, html, back = null) {
    openEvidence(`impact:${key}`, { kicker: '<span class="ki">Impact</span><span class="ki">Evidence</span>', title, sub, html: `${back ? `<button type="button" class="iv-link iv-back" data-ev-back>${esc(back.label)}</button>` : ''}${html}`, onMount: (body) => {
      evBody = body;
      body.querySelectorAll('[data-ev-back]').forEach((b) => b.addEventListener('click', () => back && back.fn()));
      body.querySelectorAll('[data-ev-series]').forEach((row) => { const go = () => openSeries(row.dataset.evSeries, row.dataset.evRegion || nowState.region); row.addEventListener('click', go); row.addEventListener('keydown', (e2) => { if (e2.key === 'Enter' || e2.key === ' ') { e2.preventDefault(); go(); } }); });
      body.querySelectorAll('[data-table]').forEach((b) => b.addEventListener('click', () => evTable(b.dataset.table)));
      body.querySelectorAll('[data-all-list]').forEach((b) => b.addEventListener('click', () => evAll()));
      body.querySelectorAll('[data-cmp]').forEach((sel) => sel.addEventListener('change', () => drawCompare(sel.dataset.cmp, sel.dataset.cmpRegion, sel.value)));
      if (body.querySelector('.iv-ev-ch')) { const sel = body.querySelector('[data-cmp]'); drawCompare(sel.dataset.cmp, sel.dataset.cmpRegion, sel.value); }
    } });
  }
  // sparkline, 120 by 28: the last twenty-five years in blue, the latest point orange
  function sparkSvg(r, w = 120, h = 28) {
    const P = (r.P || []).filter((p) => p.year >= (r.last ? r.last.year : NOW_MAX_YEAR) - 25); if (P.length < 2) return '';
    const x = d3.scaleLinear().domain([P[0].year, P[P.length - 1].year]).range([2, w - 6]), y = d3.scaleLinear().domain(d3.extent(P, (p) => p.value)).range([h - 4, 4]);
    const d = d3.line().x((p) => x(p.year)).y((p) => y(p.value))(P), l = P[P.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" style="stroke:${hue(r.e.id, 1)}" stroke-width="1.3"/><circle cx="${x(l.year)}" cy="${y(l.value)}" r="2.6" style="fill:${hue(r.e.id, 0)}"/></svg>`;
  }
  function evTable(kind) {
    const C = census(nowState.region), list = (kind === 'proxy' ? C.X : C.O).slice().sort((a, b) => (a.cls === 'improving' ? 0 : a.cls === 'stalled' ? 1 : 2) - (b.cls === 'improving' ? 0 : b.cls === 'stalled' ? 1 : 2) || gain(b) - gain(a));
    const head = kind === 'proxy' ? `${C.xUp} of ${C.X.length} tools and programmes still spreading or getting cheaper` : `${C.oUp} of ${C.O.length} measures of life still improving`;
    evOpen(`table-${kind}-${C.region}`, head, `${C.region}`, `<table class="iv-ev-t"><thead><tr><th>${kind === 'proxy' ? 'Tools and programmes' : 'Better lives'}</th><th>Now</th><th>Direction</th><th><span class="vh">Last twenty-five years</span></th></tr></thead>
      <tbody>${list.map((r) => `<tr class="${r.cls}" style="--c:${hue(r.e.id)}" data-ev-series="${esc(r.e.id)}" data-ev-region="${esc(C.region)}" tabindex="0"><th scope="row"><i class="mk"></i>${esc(plain(r.e))}</th><td>${esc(nowWord(r))}</td><td>${esc(dirWord(r))}</td><td class="sp">${sparkSvg(r)}</td></tr>`).join('')}</tbody></table>
      <p class="iv-ev-foot sc"><button type="button" class="iv-link" data-table="${kind === 'proxy' ? 'outcome' : 'proxy'}">${kind === 'proxy' ? 'Measures of life' : 'Tools and programmes'}</button> · <button type="button" class="iv-link" data-all-list>All ${C.rows.length} measures</button></p>`);
  }
  function evAll() {
    const C = census(nowState.region), order = { improving: 0, stalled: 1, worsening: 2 };
    const list = C.rows.slice().sort((a, b) => (order[a.cls] ?? 3) - (order[b.cls] ?? 3) || plain(a.e).localeCompare(plain(b.e)));
    evOpen(`all-${C.region}`, `All ${C.rows.length} measures, ${C.region}`, `${C.classed.length} with a verdict · ${C.excluded} left out · stand-ins marked`, `<ul class="iv-ev-list">${list.map((r) => `<li class="${r.cls.replace(/\s/g, '-')}" style="--c:${hue(r.e.id)}"${r.none ? '' : ` data-ev-series="${esc(r.e.id)}" data-ev-region="${esc(C.region)}" tabindex="0"`}><i class="mk"></i><span><b>${esc(plain(r.e))}</b>${kindOf(r.e) === 'proxy' ? ' <small>stand-in</small>' : kindOf(r.e) === 'stat' ? ' <small>total, outside the counts</small>' : ''}<span class="sub">${esc(isClassed(r) ? `${r.cls}${r.last ? `, ${nowWord(r)} in ${r.last.year}` : ''}` : excludeWhy(r))}</span></span></li>`).join('')}</ul>
      <p class="iv-ev-foot sc">Stand-ins: the price of a technology, the share using it, or a programme's output. Verdict rule: the yearly slope over the last ten years, as a share of the level, beyond 0.2 percent the good way is improving; beyond 0.2 percent the other way is worsening; between is stalled.</p>`);
  }
  function openSeries(id, region = 'World') {
    const e = nowSeries.get(id); if (!e) return;
    const r = nowRows(region).find((q) => q.e.id === id); if (!r) return;
    const kind = kindOf(e);
    const back = { label: `\u2190 ${kind === 'proxy' ? 'Tools and programmes' : kind === 'stat' ? 'All measures' : 'Measures of life'}`, fn: () => (kind === 'stat' ? evAll() : evTable(kind)) };
    const facts = [['Source', e.source.url ? `<a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(e.source.title || host(e.source.url))}</a>` : esc(e.source.title || '')], ['Units', esc(e.unit)], ['Region', esc(region)]];
    if (r.window) facts.push(['Years fitted', `${r.window[0]} to ${r.window[1]}, ${r.n ?? yearsIn(r).length} readings`]);
    if (r.slope != null) facts.push(['Slope', esc(slopeText(r))]);
    if (r.last) facts.push(['Last reading', `${esc(fmtV(r.last.value))} in ${r.last.year}`]);
    facts.push(['Verdict', esc(slopeLine(r))]);
    facts.push(['Rule', 'yearly slope as a share of the level: beyond +0.2 percent the good way is improving, beyond 0.2 percent the other way is worsening, between is stalled; a verdict needs a reading in the last six years and two in the last ten.']);
    if (e.notes) facts.push(['Notes', esc(noteText(e.notes))]);
    const others = [...nowSeries.values()].filter((q) => q.id !== id && q.byRegion.get(region) && q.byRegion.get(region).length > 1).sort((a, b) => plain(a).localeCompare(plain(b)));
    evOpen(`${id}-${region}`, plain(e), e.title, `${r.none ? `<p class="iv-ev-lead">${esc(excludeWhy(r))}.</p>` : `<p class="iv-ev-lead"><b>${esc(nowWord(r))}</b>${isClassed(r) ? `, ${esc(dirWord(r))}` : ''}.</p>`}
      <div class="iv-ev-ch"></div>
      <label class="sc iv-cmp">Compare with <select data-cmp="${esc(id)}" data-cmp-region="${esc(region)}"><option value="">nothing</option>${others.map((q) => `<option value="${esc(q.id)}">${esc(plain(q))}</option>`).join('')}</select></label>
      <dl class="iv-ev-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`, back);
  }
  // the panel chart: the measure over its last twenty-five years in blue, the latest point orange, the fitted ten
  // years shaded; a comparison joins as index 100 at the start of the fitted years, in orange
  function drawCompare(id, region, otherId) {
    const hostEl = evBody && evBody.querySelector('.iv-ev-ch'); if (!hostEl) return;
    const e = nowSeries.get(id), r = nowRows(region).find((q) => q.e.id === id); if (!e || !r || r.none) { hostEl.innerHTML = ''; return; }
    const W = hostEl.clientWidth || 380, H = 150, m0 = { l: 8, r: 64, t: 10, b: 22 };
    const y1 = r.last.year, y0 = y1 - 25, P = r.P.filter((p) => p.year >= y0);
    const other = otherId ? nowSeries.get(otherId) : null, Q = other ? (other.byRegion.get(region) || []).filter((p) => p.year >= y0) : [];
    const idx = other && r.window ? (() => { const b = P.find((p) => p.year >= r.window[0]) || P[0], bq = Q.find((p) => p.year >= r.window[0]) || Q[0]; return b && bq && b.value && bq.value ? { a: b.value, b: bq.value } : null; })() : null;
    const A = idx ? P.map((p) => ({ year: p.year, value: (p.value / idx.a) * 100 })) : P, B = idx ? Q.map((p) => ({ year: p.year, value: (p.value / idx.b) * 100 })) : [];
    const x = d3.scaleLinear().domain([y0, y1]).range([m0.l, W - m0.r]), y = d3.scaleLinear().domain(d3.extent([...A, ...B], (p) => p.value)).nice().range([H - m0.b, m0.t]);
    hostEl.innerHTML = '';
    const svg = d3.select(hostEl).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `${plain(e)}, ${y0} to ${y1}${other ? `, with ${plain(other)} as index 100` : ''}`);
    const c0 = hue(id, 0), c1 = hue(id, 1), co = other ? hue(other.id, 0) : INK;
    if (r.window) svg.append('rect').attr('x', x(r.window[0])).attr('width', Math.max(2, x(r.window[1]) - x(r.window[0]))).attr('y', m0.t).attr('height', H - m0.b - m0.t).style('fill', c1).attr('fill-opacity', 0.1);
    const line = d3.line().x((p) => x(p.year)).y((p) => y(p.value));
    svg.append('path').attr('d', line(A)).attr('fill', 'none').style('stroke', c1).attr('stroke-width', 1.6);
    if (B.length > 1) svg.append('path').attr('d', line(B)).attr('fill', 'none').style('stroke', co).attr('stroke-width', 1.4).attr('stroke-dasharray', '3 3');
    const l = A[A.length - 1];
    svg.append('circle').attr('cx', x(l.year)).attr('cy', y(l.value)).attr('r', 3.5).style('fill', c0);
    const tx = svg.append('g').attr('font-family', MONO).attr('font-size', 10);
    tx.append('text').attr('x', x(l.year) + 7).attr('y', y(l.value) + 3.5).style('fill', labelHue(id)).text(idx ? `${Math.round(l.value)}` : fmtV(l.value));
    if (B.length > 1) { const lb = B[B.length - 1]; tx.append('text').attr('x', x(lb.year) + 7).attr('y', y(lb.value) + 3.5).style('fill', labelHue(other.id)).text(`${Math.round(lb.value)} ${plain(other).toLowerCase()}`); }
    tx.append('text').attr('x', m0.l).attr('y', H - 6).attr('fill', 'var(--ink-3)').text(y0); tx.append('text').attr('x', W - m0.r).attr('y', H - 6).attr('text-anchor', 'end').attr('fill', 'var(--ink-3)').text(y1);
    if (idx) tx.append('text').attr('x', m0.l).attr('y', m0.t + 2).attr('fill', 'var(--ink-3)').text(`index 100 in ${r.window[0]}`);
  }

  // ---------------------------------------------------------------- data, render, resize
  fetch(`data/impact_now.json${db.version ? `?v=${db.version}` : ''}`).then((r) => (r.ok ? r.json() : null)).then((J) => {
    if (!mergeResearch(J)) return;
    regSel.innerHTML = nowRegions().map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join(''); regSel.value = nowState.region;
    LM.W = 0; tilesW = 0; // the merged data redraws whatever is on screen
    showTab();
  }).catch(() => {});
  function render(state, ch) { cur.view = state.view; cur.screen = state.screen || 1; if (ch.has('*') || ch.has('view') || ch.has('screen')) showTab(); }
  return { render, resize() { PS.W = 0; LM.W = 0; tilesW = 0; showTab(); }, hover() {} };
}
