// Patterns, computed in the browser. A line-for-line port of build_patterns() in build_data.py, with the constants
// lifted into parameters so a reader can move them. On the defaults it reproduces site/data/patterns.json
// (checked by tools/patterns_parity.js). Titles keep the build's plain sentence with its number.

export const DEFAULTS = {
  sig: 1, // significance floor for every pattern: events below it are left out
  lag: { c1: 1950, c2: 2000, c3: 2020, far: 300 },
  disaster: { quick: 2, bin: 25 },
  hype: { smooth: 3, mag: 1 },
  winters: { smooth: 7, prom: 6, start: 1943 },
  themes: { min: 6, persist: 10 },
  spill: {},
  diffusion: { lo: 10, hi: 50, early: 1950, late: 1990 },
  sentiment: { min: 10 },
  regions: { min: 10 },
};

import { AGES as TIME_AGES } from '../time.js';
const MAKE_TYPES = new Set(['invention', 'discovery', 'product', 'milestone']);
const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// short headers are built from the same numbers as the data sentence beneath them
const nw = (n) => (n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${nw(n)} times`);
const word = (n) => (n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));
const cap = (t) => t.slice(0, 1).toUpperCase() + t.slice(1);
const low = (t) => t.slice(0, 1).toLowerCase() + t.slice(1);
const pretty = (t) => t.replace(/-/g, ' ');

// Python's round(): decides on the exact binary value of the float, and sends an exact half to the even neighbour.
// toFixed with many digits gives that exact decimal expansion, so the decision is made on its digits.
export function pyRound(x, d = 0) {
  if (!Number.isFinite(x)) return x;
  const neg = x < 0, s = Math.abs(x).toFixed(Math.min(100, d + 40));
  const [ip, fp = ''] = s.split('.');
  const keep = ip + fp.slice(0, d), rest = fp.slice(d);
  let up = false;
  if (rest[0] > '5') up = true;
  else if (rest[0] === '5') up = /[1-9]/.test(rest.slice(1)) || Number(keep[keep.length - 1]) % 2 === 1;
  let n = BigInt(keep) + (up ? 1n : 0n);
  const v = Number(n) / 10 ** d;
  return neg ? -v : v;
}
const fmtG = (n) => String(n); // f"{n:g}" for one-decimal numbers
export function yrs(n) {
  n = pyRound(Number(n), 1);
  if (n > 0 && n < 1) { const m = Math.max(1, pyRound(n * 12)); return m === 1 ? `${word(m)} month` : `${word(m)} months`; }
  const s = fmtG(n);
  return n === 1 ? `${s} year` : `${s} years`;
}
const signed = (v) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(2);
export function median(v) {
  v = [...v].sort((a, b) => a - b);
  const n = v.length;
  if (!n) return null;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}
// first maximum / minimum, like Python's max()/min() with a key
const maxBy = (a, k) => { let b = null, bv = -Infinity; for (const x of a) { const v = k(x); if (b === null || v > bv) { b = x; bv = v; } } return b; };
const minBy = (a, k) => { let b = null, bv = Infinity; for (const x of a) { const v = k(x); if (b === null || v < bv) { b = x; bv = v; } } return b; };
// stable sort on a key or a tuple of keys, like Python's sorted(key=...)
const cmpK = (a, b) => { if (Array.isArray(a)) { for (let i = 0; i < a.length; i++) { const c = cmpK(a[i], b[i]); if (c) return c; } return 0; } return a < b ? -1 : a > b ? 1 : 0; };
const sortBy = (a, k) => a.map((x, i) => [k(x), i, x]).sort((p, q) => cmpK(p[0], q[0]) || p[1] - q[1]).map((p) => p[2]);
const counter = (a) => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); return m; };
const mostCommon = (m) => sortBy([...m], (kv) => -kv[1]);
const nice = (name) => { const n = name.toLowerCase(); const m = n.match(/^([\w\- ]+?) \(([\w\- ]+)\)$/); return m ? `${m[2]} ${m[1]}` : n; };
const agePhrase = (label) => (/^\d{3,4} to \d{3,4}$/.test(label) ? `years ${label}` : low(label));
const OPEN_RE = /commercial|consumer|civil\b|civilian|passenger|household|retail/i;
const openUse = (t) => (t.type === 'product' ? true : ['milestone', 'invention'].includes(t.type) ? OPEN_RE.test(t.title) || (t.tags || []).some((g) => g === 'consumer-adoption' || g === 'consumer-growth') : false);
const yearsSort = (ids, by) => [...ids].sort((a, b) => by.get(a).year - by.get(b).year || (a < b ? -1 : a > b ? 1 : 0));
// the periods of the whole record, from time.js (Vision 4, S6: spans named by their years), as [id, label, from, to]
const AGES = TIME_AGES.map((a) => [a.id, a.label, a.start, a.end]);
const RL = { europe: 'Europe', 'middle-east': 'the Middle East and North Africa', 'east-asia': 'East Asia', 'south-asia': 'South Asia', africa: 'sub-Saharan Africa', americas: 'the Americas', 'latin-america': 'Latin America', 'north-america': 'North America', oceania: 'Oceania', global: 'no single region' };
const rl = (r) => RL[r] || r;
// The headline figure of a pattern, built in the same function as its title from the same variables, so the title's
// number and the figure can never disagree: { n (display string), unit, label, cmp }
const num1 = (n) => (n == null ? '' : Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''));
const FIG = (n, unit, label, cmp = '') => ({ n: num1(n), unit, label, cmp });

// Shared context: the event pool after the significance floor, with the link maps the build uses.
export function context(events, sig = 1) {
  const lst = events.filter((e) => (e.significance || 0) >= sig);
  const by = new Map(lst.map((e) => [e.id, e]));
  const inn = new Map();
  for (const e of lst) for (const c of e.connects || []) { if (!inn.has(c)) inn.set(c, []); inn.get(c).push(e.id); }
  const linked = (e) => [...(e.connects || []).filter((c) => by.has(c)).map((c) => by.get(c)), ...(inn.get(e.id) || []).map((c) => by.get(c))];
  const topSig = (ids, n = 1) => sortBy(ids, (i) => -by.get(i).significance).slice(0, n);
  const T = (s) => ({ t: s });
  const EV = (i) => ({ e: i, t: by.get(i).title });
  return { lst, by, inn, linked, topSig, T, EV };
}

// ---------- 1. invention to regulation, by era ----------
// Two pairings of the compilers' links between a policy event and an earlier invention, discovery, product or milestone:
//   per rule (the chart): each policy event is paired with the EARLIEST such event linked to it, one pair per rule;
//   per invention (the second reading): each invention is paired with the FIRST policy event linked to it, one pair per invention.
// Neither is "the first rule after an invention" in the world; both count recorded links only.
function pairPerRule(lst, linked) {
  const pl = [], seen = new Set();
  for (const e of lst) {
    if (e.type !== 'policy') continue;
    const ups = linked(e).filter((u) => MAKE_TYPES.has(u.type) && u.year <= e.year);
    if (!ups.length) continue;
    const u = minBy(ups, (u) => u.year);
    const k = u.id + '|' + e.id;
    if (seen.has(k)) continue;
    seen.add(k);
    pl.push({ from: u.id, to: e.id, lag: e.year - u.year, year: e.year, domain: e.domain });
  }
  return pl;
}
function pairPerInvention(lst, linked) {
  const pl = [], seen = new Set();
  for (const u of lst) {
    if (!MAKE_TYPES.has(u.type)) continue;
    const rules = linked(u).filter((e) => e.type === 'policy' && e.year >= u.year);
    if (!rules.length) continue;
    const e = minBy(rules, (e) => e.year);
    const k = u.id + '|' + e.id;
    if (seen.has(k)) continue;
    seen.add(k);
    pl.push({ from: u.id, to: e.id, lag: e.year - u.year, year: e.year, domain: e.domain });
  }
  return pl;
}
// medians by period of the rule, with n per period, and the early and late readings the title compares
function lagPeriods(pl, q) {
  const cuts = [q.c1, q.c2, q.c3];
  const bins = [[`before ${cuts[0]}`, 0, cuts[0]], [`${cuts[0]} to ${cuts[1] - 1}`, cuts[0], cuts[1]], [`${cuts[1]} to ${cuts[2] - 1}`, cuts[1], cuts[2]], [cuts[2] % 10 === 0 && cuts[2] >= 2020 ? `${cuts[2]}s` : `since ${cuts[2]}`, cuts[2], 2100]];
  const per = [];
  for (const [lab, a, b] of bins) { const v = pl.filter((p) => a <= p.year && p.year < b).map((p) => p.lag); if (v.length) per.push({ label: lab, from: a, to: b, n: v.length, median_lag: median(v) }); }
  let early = per.find((x) => x.from < cuts[1] && x.n >= 3) || null;
  if (early && early.from < cuts[0]) { const v = pl.filter((p) => p.year < cuts[1]).map((p) => p.lag); early = { label: `before ${cuts[1]}`, n: v.length, median_lag: median(v) }; }
  const late = [...per].reverse().find((x) => x.n >= 3) || null;
  return { cuts, per, early, late };
}
const links = (n) => `${n} link${n === 1 ? '' : 's'}`;
export function lagEra(C, q = DEFAULTS.lag) {
  const { lst, by, linked, T, EV } = C;
  let pl = pairPerRule(lst, linked);
  const far = pl.filter((p) => p.lag > q.far);
  pl = pl.filter((p) => p.lag <= q.far);
  if (!pl.length) return null;
  const { cuts, per, early, late } = lagPeriods(pl, q);
  // the second reading: one link per invention, the first rule that links to it, the same periods and gap cap
  const inv = pairPerInvention(lst, linked).filter((p) => p.lag <= q.far);
  const invP = lagPeriods(inv, q);
  const n20 = pl.filter((p) => p.year >= 2020).length, inv20 = inv.filter((p) => p.year >= 2020).length;
  const longest = maxBy(pl, (p) => p.lag);
  const quick = pl.filter((p) => p.lag <= 1);
  const quickEx = quick.length ? maxBy(quick, (p) => by.get(p.to).significance + by.get(p.from).significance) : null;
  const medall = median(pl.map((p) => p.lag));
  // the period sentence accounts for every link, period by period, latest first
  const perSentence = (ps, n) => `${[...ps].reverse().map((x) => `${yrs(x.median_lag)} for rules ${/^\d{4}s$/.test(x.label) ? 'of the ' + x.label : /^\d/.test(x.label) ? 'of ' + x.label : x.label} (${links(x.n)})`).join(', ')}: ${links(n)} in all`;
  const sentence = `The median gap is ${perSentence(per, pl.length)}`;
  const figLag = early && late && early !== late ? late.median_lag : late ? late.median_lag : medall;
  const title = `Recorded invention-to-rule links: median gap by period of the rule, over ${pl.length} recorded links, ${n20} of them 2020s`;
  const figure = FIG(figLag, 'yrs', late ? `median gap for rules of the ${late.label}, ${late.n} of ${pl.length} links` : `median gap, ${links(pl.length)}`, early && late && early !== late ? `${yrs(early.median_lag)} ${early.label} (${per.filter((x) => x.to <= cuts[1]).map((x) => x.n).reverse().join(' + ')} links)` : '');
  let ov = [T(`Each dot is a policy event paired with the earliest invention, discovery, product or milestone the compilers linked to it, one pair per rule, placed at the year of the rule with its height showing the gap; the bars are the period medians, each with its count. `)];
  if (quickEx) ov.push(T('The shortest gaps are near zero: '), EV(quickEx.from), T(` (${by.get(quickEx.from).year}) was answered by `), EV(quickEx.to), T(' within a year. '));
  ov.push(T((far.length ? `${far.length < NUM_WORDS.length ? cap(NUM_WORDS[far.length]) : far.length} pair${far.length !== 1 ? 's' : ''} more than ${q.far === 300 ? 'three centuries' : yrs(q.far)} apart ${far.length === 1 ? 'is' : 'are'} left out as a succession rather than an answer. ` : '')));
  // the second reading, labelled, with its own n
  const invMed = inv.length ? median(inv.map((p) => p.lag)) : null;
  const second = inv.length
    ? `The first rule that links to each invention, ${links(inv.length)}, ${inv20} of them 2020s: median gap ${perSentence(invP.per, inv.length)}.`
    : '';
  return {
    id: 'invention-to-regulation', kind: 'lag-era', title, figure,
    subtitle: `${sentence}. Years between an invention, discovery, product or milestone and a policy event the compilers linked to it, grouped by the period of the rule; one link per rule, paired with its earliest linked invention`,
    overview: ov, exception: `${by.get(longest.from).title} to ${by.get(longest.to).title}: ${yrs(longest.lag)}`,
    cannot: `These are the recorded links only; most rules that followed an invention are not linked: ${n20} of the ${pl.length} fall in the 2020s, so the medians for the periods before 2020 rest on ${links(pl.length - n20)} between them. A rule linked to several inventions counts once, against the earliest; the per-invention reading counts each invention once, against its first linked rule. Absence of a link is not absence of a rule.`,
    pairs: pl, periods: per, stats: { n: pl.length, median_lag: medall, n_2020s: n20 },
    second: inv.length ? { label: 'Second reading: one link per invention', text: second, pairs: inv, periods: invP.per, stats: { n: inv.length, median_lag: invMed, n_2020s: inv20 }, early: invP.early, late: invP.late } : null,
    annotations: [{ event: longest.to, label: `${by.get(longest.to).title}: ${yrs(longest.lag)} after ${by.get(longest.from).title}` }].concat(quickEx ? [{ event: quickEx.to, label: `${by.get(quickEx.to).title}: same year as ${by.get(quickEx.from).title}` }] : []),
    events: yearsSort(new Set(pl.flatMap((p) => [p.from, p.to])), by),
  };
}

// ---------- 2. disaster, then rule ----------
export function disaster(C, q = DEFAULTS.disaster) {
  const { lst, by, linked, T, EV } = C;
  const pairs = new Map();
  for (const e of lst) {
    if (e.type !== 'policy') continue;
    for (const u of linked(e)) if ((u.type === 'failure' || u.type === 'incident') && u.year <= e.year) pairs.set(u.id + '|' + e.id, { from: u.id, to: e.id, lag: e.year - u.year, year: u.year, domain: u.domain });
  }
  const pl2 = sortBy([...pairs.values()], (p) => p.year);
  if (!pl2.length) return null;
  const lags = pl2.map((p) => p.lag);
  const within = lags.filter((l) => l <= q.quick).length;
  const byQ = new Map();
  for (const p of pl2) { const k = Math.floor(p.year / q.bin) * q.bin; if (!byQ.has(k)) byQ.set(k, []); byQ.get(k).push(p.lag); }
  const periods = [...byQ].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ from: k, to: k + q.bin - 1, n: v.length, median_lag: median(v) }));
  const longest = maxBy(pl2, (p) => p.lag);
  const strongest = sortBy(pl2, (p) => -(by.get(p.from).significance + by.get(p.to).significance)).slice(0, 3);
  const pct = pyRound((100 * within) / pl2.length);
  const qw = q.quick === 1 ? 'one year' : `${word(q.quick)} years`;
  const within0 = q.quick === 0; // 'within no years' reads badly; say the same year
  return {
    id: 'disaster-then-rule', kind: 'pairs',
    figure: FIG(pct, '%', `of disaster-linked rules within ${within0 ? 'the year' : qw}`, `median gap ${yrs(median(lags))}`),
    title: pct >= 75 ? `After a disaster, a rule within ${within0 ? 'the year' : qw}` : pct >= 50 ? `After a disaster, usually a rule within ${within0 ? 'the year' : qw}` : `${pct} percent of rules after a disaster come within ${within0 ? 'the year' : qw}`,
    subtitle: (within0 ? `${pct} percent of the rules linked to a disaster arrived in the same year; the median gap is ${yrs(median(lags))}` : `${pct} percent of the rules linked to a disaster arrived within ${qw} of it; the median gap is ${yrs(median(lags))}`) + `. Years from a failure or incident to a policy event the record links to it, over ${pl2.length} pairs, ${pl2[0].year} to ${pl2[pl2.length - 1].year}`,
    overview: [T(`Each stem rises from the year of a failure or incident to the number of years before a linked rule. Most stems are short: ${within} of ${pl2.length} pairs resolve ${within0 ? 'in the same year' : `within ${qw}`}. The clearest cases are `)]
      .concat(strongest.flatMap((p, i) => [EV(p.from), T(` (${by.get(p.from).year}) and `), EV(p.to), T(` (${by.get(p.to).year})` + (i < strongest.length - 1 ? '; ' : '.'))])),
    exception: `${by.get(longest.from).title} to ${by.get(longest.to).title}: ${yrs(longest.lag)}`,
    cannot: "Failures that led to no rule are invisible here, and a link is a compiler's judgment: the record cannot tell whether the rule would have come anyway.",
    pairs: pl2, periods,
    stats: { n: pl2.length, median_lag: median(lags), within_2_years: within, share_within_2: pyRound(within / pl2.length, 2), longest: { lag: longest.lag, from: longest.from, to: longest.to } },
    annotations: [...strongest.slice(0, 2), longest].map((p) => ({ event: p.to, label: `${by.get(p.to).title}, ${yrs(p.lag)} after ${by.get(p.from).title}` })),
    events: yearsSort(new Set(pl2.flatMap((p) => [p.from, p.to])), by),
  };
}

// ---------- 3. hype, crash, recovery ----------
export function hype(C, q = DEFAULTS.hype) {
  const { lst, by, T, EV } = C;
  const pool = lst.filter((e) => e.sentiment && ((e.tags || []).includes('bubble') || (e.tags || []).includes('hype-cycle')));
  if (!pool.length) return null;
  const y0 = Math.min(...pool.map((e) => e.year)), y1 = Math.max(...pool.map((e) => e.year));
  const net = new Map(); for (let y = y0; y <= y1; y++) net.set(y, 0);
  const byy = new Map();
  for (const e of pool) { net.set(e.year, net.get(e.year) + e.sentiment); if (!byy.has(e.year)) byy.set(e.year, []); byy.get(e.year).push(e); }
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const h = Math.floor(q.smooth / 2), lo = -h, hi = q.smooth - 1 - h;
  const sm = new Map(years.map((y) => { let s = 0; for (let yy = y + lo; yy <= y + hi; yy++) s += net.get(yy) || 0; return [y, s / q.smooth]; }));
  const runs = [];
  for (const y of years) { const s = sm.get(y) > 0 ? 1 : sm.get(y) < 0 ? -1 : 0; if (!s) continue; if (runs.length && runs[runs.length - 1].sign === s) runs[runs.length - 1].years.push(y); else runs.push({ sign: s, years: [y] }); }
  const pick = (ys, sign) => maxBy(ys.flatMap((yy) => (byy.get(yy) || []).filter((e) => e.sentiment * sign > 0)), (e) => sign * e.sentiment * 2 + e.significance);
  const episodes = [];
  for (let i = 0; i < runs.length - 1; i++) {
    const a = runs[i], b = runs[i + 1];
    if (a.sign === 1 && b.sign === -1) {
      const peak = maxBy(a.years, (y) => net.get(y)), trough = minBy(b.years, (y) => net.get(y));
      if (net.get(peak) < q.mag || net.get(trough) > -q.mag) continue;
      const rec = i + 2 < runs.length && runs[i + 2].sign === 1 ? runs[i + 2].years[0] : null;
      const hp = pick(a.years, 1), fr = pick(b.years, -1);
      episodes.push({ peak, trough, recovery: rec, fall: trough - peak, rebound: rec ? rec - trough : null, peak_event: hp ? hp.id : null, trough_event: fr ? fr.id : null, recovery_event: null });
    }
  }
  for (const ep of episodes) if (ep.recovery) { const c = (byy.get(ep.recovery) || []).filter((e) => e.sentiment > 0); if (c.length) ep.recovery_event = maxBy(c, (e) => e.sentiment * 2 + e.significance).id; }
  if (!episodes.length) return { id: 'hype-crash-recovery', kind: 'cycles', empty: true, title: `No boom in the record turns to a bust with these settings; ${pool.length} items are tagged bubble or hype cycle`, subtitle: `Yearly net sentiment over ${pool.length} items tagged bubble or hype cycle, ${y0} to ${y1}`, overview: [], years: years.map((y) => ({ year: y, net: pyRound(net.get(y), 2), smooth: pyRound(sm.get(y), 2), n: (byy.get(y) || []).length })), episodes: [], stats: { n: pool.length, episodes: 0 }, annotations: [], events: [] };
  const falls = episodes.map((e) => e.fall), rebs = episodes.filter((e) => e.rebound != null).map((e) => e.rebound);
  const withReb = episodes.filter((e) => e.rebound != null);
  const longestReb = withReb.length ? maxBy(withReb, (e) => e.rebound) : null;
  const openEp = episodes.filter((e) => e.rebound == null);
  const sw = q.smooth === 3 ? 'three years' : yrs(q.smooth);
  const ov = [T(`The band is the yearly sum of sentiment scores over items tagged as a bubble or a hype cycle, hope above the line and fear below, smoothed over ${sw} to find runs. ${episodes.length} boom-to-bust turns appear. `)];
  for (const ep of episodes) if (ep.peak_event && ep.trough_event) ov.push(EV(ep.peak_event), T(` (peak ${ep.peak}) gave way to `), EV(ep.trough_event), T(`; the mood bottoms in ${ep.trough}` + (ep.recovery ? ` and the mood turns positive again by ${ep.recovery}. ` : ', with no recovery yet in the record. ')));
  const sentence = `Booms in the record have turned to busts ${times(episodes.length)} since ${episodes[0].peak}; the fall takes a median ${yrs(median(falls))}` + (rebs.length ? ` and the recovery a median ${yrs(median(rebs))}` : '');
  const title = episodes.length === 1 ? `One boom has turned to bust since ${episodes[0].peak}` : `${cap(nw(episodes.length))} booms have turned to busts since ${episodes[0].peak}`;
  return {
    id: 'hype-crash-recovery', kind: 'cycles', title,
    figure: FIG(episodes.length, 'busts', `boom-to-bust turns since ${episodes[0].peak}`, `fall ${yrs(median(falls))}${rebs.length ? `, recovery ${yrs(median(rebs))}` : ''}`),
    subtitle: `${sentence}. Yearly net sentiment over ${pool.length} items tagged bubble or hype cycle, ${y0} to ${y1}, with each peak, trough and first positive year after it`,
    overview: ov, exception: longestReb ? `The ${longestReb.trough} trough took ${yrs(longestReb.rebound)} to recover` : '',
    cannot: "Scores are the compilers' readings; coverage of markets is much denser after 2015.",
    years: years.map((y) => ({ year: y, net: pyRound(net.get(y), 2), smooth: pyRound(sm.get(y), 2), n: (byy.get(y) || []).length })), episodes,
    stats: { n: pool.length, episodes: episodes.length, median_fall: median(falls), median_rebound: rebs.length ? median(rebs) : null, open: openEp.length },
    annotations: episodes.filter((e) => e.peak_event).map((e) => ({ event: e.peak_event, label: `peak ${e.peak}: ${by.get(e.peak_event).title}` })).concat(episodes.filter((e) => e.trough_event).map((e) => ({ event: e.trough_event, label: `trough ${e.trough}: ${by.get(e.trough_event).title}` }))),
    events: episodes.flatMap((e) => [e.peak_event, e.trough_event, e.recovery_event]).filter(Boolean),
  };
}

// ---------- 4. AI winters and booms ----------
export function winters(C, q = DEFAULTS.winters) {
  const { lst, T, EV } = C;
  const tot = counter(lst.map((e) => e.year));
  const aic = counter(lst.filter((e) => e.domain === 'ai' || e.ai_precursor).map((e) => e.year));
  const maxY = Math.max(...tot.keys());
  const ys = []; for (let y = q.start; y <= maxY; y++) ys.push(y);
  const share = new Map(ys.map((y) => [y, tot.get(y) ? (aic.get(y) || 0) / tot.get(y) : 0]));
  const hw = Math.floor(q.smooth / 2);
  const smo = new Map(ys.map((y) => { const w = ys.filter((yy) => Math.abs(yy - y) <= hw); let s = 0; for (const yy of w) s += share.get(yy); return [y, s / w.length]; }));
  const peaks = [], troughs = [];
  let dirn = null, cur = [ys[0], smo.get(ys[0])];
  const PROM = q.prom / 100;
  for (const y of ys.slice(1)) {
    const v = smo.get(y);
    if (dirn === null) { if (v - cur[1] >= PROM) { dirn = 'up'; cur = [y, v]; } else if (cur[1] - v >= PROM) { dirn = 'down'; cur = [y, v]; } continue; }
    if (dirn === 'up') { if (v >= cur[1]) cur = [y, v]; else if (cur[1] - v >= PROM) { peaks.push(cur[0]); dirn = 'down'; cur = [y, v]; } }
    else { if (v <= cur[1]) cur = [y, v]; else if (v - cur[1] >= PROM) { troughs.push(cur[0]); dirn = 'up'; cur = [y, v]; } }
  }
  const gaps = troughs.slice(1).map((b, i) => b - troughs[i]);
  const lastTr = troughs.length ? troughs[troughs.length - 1] : null;
  const W = [[1974, 1980], [1987, 1993]];
  const hits = troughs.filter((t) => W.some(([a, b]) => a <= t && t <= b));
  const aiEx = (y, sign) => maxBy(lst.filter((e) => e.year === y && (e.domain === 'ai' || e.ai_precursor) && (e.sentiment || 0) * sign >= 0), (e) => e.significance);
  const pkEv = new Map(peaks.map((y) => [y, aiEx(y, 1)])), trEv = new Map(troughs.map((y) => [y, aiEx(y, -1)]));
  const winterClause = () => { if (!troughs.length) return ''; if (!hits.length) return '; none falls in a conventional AI winter'; if (hits.length === 1) return `; only the ${hits[0]} trough falls in a conventional AI winter`; return `; ${word(hits.length)} of them fall in the conventional AI winters`; };
  const sentence = (troughs.length ? `AI's share of the record has fallen into ${troughs.length} trough${troughs.length !== 1 ? 's' : ''} since ${q.start}` : `AI's share of the record shows no trough since ${q.start} at this dip size`) + (gaps.length ? `, about every ${pyRound(gaps.reduce((a, b) => a + b, 0) / gaps.length)} years` : '') + winterClause() + (lastTr ? `; it has not dipped since ${lastTr}` : '');
  const title = troughs.length ? `AI's share has dipped ${times(troughs.length)} since ${q.start}` : `AI's share has not dipped since ${q.start}`;
  const sw = q.smooth === 7 ? 'seven years' : yrs(q.smooth);
  const ov = [T(`The line is the share of all recorded events each year belonging to AI or its precursors, smoothed over ${sw}, so the corpus's own growth does not count as a boom. Peaks fall in ${peaks.join(', ')}` + (troughs.length ? ` and troughs in ${troughs.join(', ')}. ` : '. '))];
  if (hits.length) { const n = hits.length; ov.push(T(`${cap(word(n))} of the ${word(troughs.length)} troughs, ${hits.join(', ')}, ${n === 1 ? 'falls' : 'fall'} inside the conventional AI winters (1974 to 1980 and 1987 to 1993). `)); }
  for (const y of peaks.slice(-3)) if (pkEv.get(y)) ov.push(T(`The ${y} peak carries `), EV(pkEv.get(y).id), T('. '));
  for (const y of troughs.slice(-2)) if (trEv.get(y)) ov.push(T(`The ${y} trough carries `), EV(trEv.get(y).id), T('. '));
  const smw = q.smooth === 7 ? 'seven-year' : `${q.smooth}-year`;
  return {
    id: 'ai-winters', kind: 'ai-cycles', title,
    figure: gaps.length ? FIG(gaps.reduce((a, b) => a + b, 0) / gaps.length, 'yrs', 'between troughs in AI\u2019s share of the record', `${troughs.length} troughs since ${q.start}, last ${lastTr}`) : FIG(troughs.length, 'troughs', `in AI\u2019s share of the record since ${q.start}`, lastTr ? `last ${lastTr}` : ''),
    subtitle: `${sentence}. AI and precursor events as a share of all events per year, ${q.start} to ${ys[ys.length - 1]}, ${smw} smoothing, peaks and troughs detected on the smoothed line`,
    overview: ov, exception: 'The share has climbed since 2012 without a trough, which may be a longer boom or a corpus compiled in 2026', cannot: 'A corpus compiled in 2026 over-represents recent years; the share corrects for volume only.',
    years: ys.map((y) => ({ year: y, share: pyRound(share.get(y), 3), smooth: pyRound(smo.get(y), 3), n: tot.get(y) || 0, ai: aic.get(y) || 0 })),
    peaks: peaks.map((y) => ({ year: y, event: pkEv.get(y) ? pkEv.get(y).id : null })), troughs: troughs.map((y) => ({ year: y, event: trEv.get(y) ? trEv.get(y).id : null })),
    winters: W.map(([a, b]) => ({ from: a, to: b })),
    stats: { peaks: peaks.length, troughs: troughs.length, mean_gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null, last_trough: lastTr },
    annotations: peaks.filter((y) => pkEv.get(y)).map((y) => ({ event: pkEv.get(y).id, label: `peak ${y}: ${pkEv.get(y).title}` })).concat(troughs.filter((y) => trEv.get(y)).map((y) => ({ event: trEv.get(y).id, label: `trough ${y}: ${trEv.get(y).title}` }))),
    events: [...pkEv.values(), ...trEv.values()].filter(Boolean).map((v) => v.id),
  };
}

// ---------- 5. themes that travel together ----------
export function themes(C, q = DEFAULTS.themes) {
  const { lst, by, topSig, T, EV } = C;
  const pc = new Map(), span = new Map();
  for (const e of lst) {
    const t = [...new Set(e.tags || [])].sort();
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const k = t[i] + '\u0000' + t[j]; pc.set(k, (pc.get(k) || 0) + 1); if (!span.has(k)) span.set(k, []); span.get(k).push(e); }
  }
  let prs = [];
  for (const [k, n] of pc) {
    if (n < q.min) continue;
    const [a, b] = k.split('\u0000');
    const evs = sortBy(span.get(k), (e) => e.year);
    const cents = new Set(evs.map((e) => Math.floor(e.year / 100)));
    prs.push({ a, b, n, first: evs[0].year, last: evs[evs.length - 1].year, centuries: cents.size, span: evs[evs.length - 1].year - evs[0].year, first_event: evs[0].id, last_event: evs[evs.length - 1].id, top: topSig(evs.map((e) => e.id), 3) });
  }
  prs = sortBy(prs, (p) => -p.n);
  if (!prs.length) return null;
  const big = prs.filter((p) => p.n >= q.persist);
  const persistent = big.length ? maxBy(big, (p) => p.centuries * 1e6 + p.span) : prs[0];
  const topn = prs[0];
  const tagcount = counter(lst.flatMap((e) => e.tags || []));
  const ov = [T(`Each arc joins two themes the compilers tagged on the same event; width is the number of shared events, and arcs are ordered by how long the pairing has persisted. The most common pairing is ${pretty(topn.a)} with ${pretty(topn.b)}, ${topn.n} events from `), EV(topn.first_event), T(` (${topn.first}) to `), EV(topn.last_event), T(` (${topn.last}). The longest-lived is ${pretty(persistent.a)} with ${pretty(persistent.b)}, from `), EV(persistent.first_event), T(` (${persistent.first}) to `), EV(persistent.last_event), T(` (${persistent.last}). `)];
  const recent = prs.slice(0, 12).filter((p) => p.first >= 2018);
  const top40 = prs.slice(0, 40);
  const tagSet = [...new Set(top40.flatMap((p) => [p.a, p.b]))].sort();
  const minW = q.min === 6 ? 'six' : word(q.min);
  return {
    id: 'themes-together', kind: 'cooccur',
    figure: FIG(persistent.centuries, 'centuries', `${pretty(persistent.a)} and ${pretty(persistent.b)} tagged together`, `${persistent.n} shared events, ${persistent.first} to ${persistent.last}`),
    title: `${cap(pretty(persistent.a))} and ${pretty(persistent.b)}, paired for ${nw(persistent.centuries)} ${persistent.centuries === 1 ? 'century' : 'centuries'}`,
    subtitle: `${cap(pretty(persistent.a))} and ${pretty(persistent.b)} appear together in ${persistent.n} events across ${persistent.centuries} centuries, the longest-lived pairing in the record. Pairs of themes tagged on the same event, over ${prs.length} pairings with at least ${minW} shared events and ${[...tagcount].filter(([, n]) => n >= q.min).length} themes`,
    overview: ov, exception: recent.length ? `${recent[0].a} with ${recent[0].b}: ${recent[0].n} events, all since ${recent[0].first}` : '',
    cannot: 'Tags are a 2026 vocabulary applied backwards, so medieval and early modern items carry few tags and old pairings are understated.',
    pairs: top40, tags: Object.fromEntries(tagSet.map((t) => [t, tagcount.get(t)])),
    stats: { pairs: prs.length, top: topn, persistent },
    annotations: [{ event: persistent.first_event, label: `earliest ${persistent.a} + ${persistent.b}: ${by.get(persistent.first_event).title}` }, { event: topn.last_event, label: `latest ${topn.a} + ${topn.b}: ${by.get(topn.last_event).title}` }],
    events: yearsSort(new Set(prs.slice(0, 12).flatMap((p) => [p.first_event, p.last_event, ...p.top])), by),
  };
}

// ---------- 6. spillovers ----------
export function spill(C) {
  const { lst, by, inn, linked, T, EV } = C;
  const mil = [];
  for (const e of lst) {
    if (!(e.tags || []).includes('military-origins')) continue;
    for (const d of inn.get(e.id) || []) { const t = by.get(d); if (t.year > e.year && !(t.tags || []).includes('military-origins') && openUse(t)) mil.push({ from: e.id, to: d, lag: t.year - e.year }); }
  }
  const lab = [];
  const seen = new Set();
  for (const e of lst) {
    if (e.type !== 'product') continue;
    for (const u of linked(e)) { const k = u.id + '|' + e.id; if ((u.type === 'discovery' || u.type === 'invention') && u.year <= e.year && !seen.has(k)) { seen.add(k); lab.push({ from: u.id, to: e.id, lag: e.year - u.year }); } }
  }
  if (!mil.length && !lab.length) return null;
  const ml = mil.map((m) => m.lag), ll = lab.map((m) => m.lag);
  const sig = (m) => by.get(m.from).significance + by.get(m.to).significance;
  const mex = sortBy(mil, (m) => -sig(m)).slice(0, 3), lex = sortBy(lab, (m) => -sig(m)).slice(0, 3);
  const mlong = mil.length ? maxBy(mil, (m) => m.lag) : null, llong = lab.length ? maxBy(lab, (m) => m.lag) : null;
  const ov = [T(`Two strips of dots: on top, ${mil.length} links from an item tagged as military in origin to a later item in open use; below, ${lab.length} links from a discovery or invention to a later product. Position is the gap in years. `)];
  for (const m of mex.slice(0, 2)) ov.push(EV(m.from), T(` (${by.get(m.from).year}) led, after ${yrs(m.lag)}, to `), EV(m.to), T('; '));
  for (const m of lex.slice(0, 2)) ov.push(EV(m.from), T(` (${by.get(m.from).year}) became `), EV(m.to), T(` after ${yrs(m.lag)}. `));
  const lbl = (m) => `${by.get(m.to).title}, ${yrs(m.lag)} after ${by.get(m.from).title}`;
  return {
    id: 'spillovers', kind: 'spill',
    figure: ml.length ? FIG(median(ml), 'yrs', 'from a military origin to open use', ll.length ? `lab result to product: ${yrs(median(ll))}` : 'no lab-to-product pair at this significance') : ll.length ? FIG(median(ll), 'yrs', 'from a lab result to a product', 'no military pair at this significance') : FIG(0, 'pairs', 'meet this significance'),
    title: ml.length ? `Military ideas reach open use in ${yrs(median(ml))}` : ll.length ? `Lab results become products in ${yrs(median(ll))}` : 'No linked spillover meets these settings',
    subtitle: (ml.length ? `A military-born idea reaches open use in a median ${yrs(median(ml))}` + (ll.length ? `; a lab result becomes a product in a median ${yrs(median(ll))}` : '') : ll.length ? `A lab result becomes a product in a median ${yrs(median(ll))}; no military-born link meets these settings` : 'No linked spillover meets these settings') + `. Years between linked events: ${mil.length} military-to-open-use links and ${lab.length} discovery-or-invention-to-product links`,
    overview: ov, exception: llong ? `${by.get(llong.from).title} to ${by.get(llong.to).title}: ${yrs(llong.lag)}` : '',
    cannot: 'Crossings that were never linked are invisible, and the short lags of the 2020s partly reflect how densely the compilers linked recent items.',
    military: mil, lab,
    stats: { military: { n: mil.length, median_lag: ml.length ? median(ml) : null }, lab: { n: lab.length, median_lag: ll.length ? median(ll) : null } },
    annotations: mex.slice(0, 2).map((m) => ({ event: m.to, label: lbl(m), strip: 'military' })).concat(lex.slice(0, 2).map((m) => ({ event: m.to, label: lbl(m), strip: 'lab' }))).concat(llong ? [{ event: llong.to, label: lbl(llong), strip: 'lab' }] : []),
    events: yearsSort(new Set([...mex, ...lex, ...(mlong ? [mlong] : []), ...(llong ? [llong] : [])].flatMap((m) => [m.from, m.to])), by),
  };
}

// ---------- 7. diffusion speeding up ----------
export function diffusion(A, q = DEFAULTS.diffusion) {
  if (!A || !A.technologies) return null;
  const { T } = { T: (s) => ({ t: s }) };
  const cross = (pts, th) => { let prev = null; for (const p of pts) { if (p.value >= th) { if (prev === null) return ['start', p.year]; return ['x', prev.year + ((th - prev.value) / (p.value - prev.value)) * (p.year - prev.year)]; } prev = p; } return null; };
  const rows = [];
  for (const [name, pts] of Object.entries(A.technologies)) {
    if (name.includes('alt. series') || name === 'Television') continue;
    const c10 = cross(pts, q.lo), c50 = cross(pts, q.hi);
    if (c10 && c50 && c50[0] === 'x') rows.push({ name, year10: pyRound(c10[1], 1), year50: pyRound(c50[1], 1), years: pyRound(c50[1] - c10[1], 1), open10: c10[0] === 'start' });
  }
  if (rows.length < 6) return null;
  const early = rows.filter((r) => r.year10 < q.early).map((r) => r.years), late = rows.filter((r) => r.year10 >= q.late).map((r) => r.years), mid = rows.filter((r) => q.early <= r.year10 && r.year10 < q.late).map((r) => r.years);
  const xs = rows.map((r) => r.year10), yv = rows.map((r) => r.years);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = yv.reduce((a, b) => a + b, 0) / yv.length;
  let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (yv[i] - my); den += (x - mx) ** 2; });
  const slope = num / Math.max(1e-9, den);
  const recent = rows.filter((r) => r.year10 >= q.early), old = rows.filter((r) => r.year10 < q.early);
  const slowRecent = recent.length ? maxBy(recent, (r) => r.years) : null, fastEarly = old.length ? minBy(old, (r) => r.years) : null;
  const fastest = minBy(rows, (r) => r.years), slowest = maxBy(rows, (r) => r.years);
  const lo = q.lo, hi = q.hi;
  const half = hi === 50 ? 'half' : `${hi} percent`;
  const sentence = early.length && late.length
    ? `Technologies that reached ${lo} percent of US homes before ${q.early} took a median ${yrs(median(early))} to reach ${half}; those arriving since ${q.late} took ${yrs(median(late))}`
    : `The gap from ${lo} to ${hi} percent of US homes shrinks by about ${Math.abs(slope * 10).toFixed(1)} years per decade of arrival`;
  const title = early.length && late.length
    ? `${cap(half)} of US homes in ${yrs(median(late))} since ${q.late}`
    : `${lo} to ${hi} percent of US homes, ${Math.abs(slope * 10).toFixed(1)} years shorter per decade`;
  const ov = [T(`Each dot is a technology from the US household adoption figures, placed at the year it crossed ${lo} percent of homes, with its height the years it then took to reach ${half}. The trend slopes down by about ${Math.abs(slope * 10).toFixed(1)} years per decade of arrival. The slowest was the ${nice(slowest.name)} (${yrs(slowest.years)}, from ${Math.trunc(slowest.year10)}), the fastest the ${nice(fastest.name)} (${yrs(fastest.years)}, from ${Math.trunc(fastest.year10)}). `)];
  const ann = [slowest, fastest].concat(fastEarly && fastEarly !== fastest ? [fastEarly] : []).concat(slowRecent && slowRecent !== slowest ? [slowRecent] : []);
  return {
    id: 'diffusion-faster', kind: 'diffusion', title,
    figure: early.length && late.length ? FIG(median(late), 'yrs', `from ${lo}% to ${hi}% of US homes, since ${q.late}`, `before ${q.early}: ${yrs(median(early))}`) : FIG(Math.abs(slope * 10), 'yrs', `shorter per decade of arrival, ${lo}% to ${hi}% of US homes`),
    subtitle: `${sentence}. Years from ${lo} to ${hi} percent of US households against the year ${lo} percent was reached, ${rows.length} technologies (Our World in Data)`,
    overview: ov, exception: fastEarly ? `${fastEarly.name}: ${yrs(fastEarly.years)} from ${Math.trunc(fastEarly.year10)}` + (slowRecent ? `; ${slowRecent.name}: ${yrs(slowRecent.years)} from ${Math.trunc(slowRecent.year10)}` : '') : '',
    cannot: `US households only; the source starts most old technologies at ${lo} percent, and the smartphone and social media figures count adults, so the comparison is indicative.`,
    rows, stats: { n: rows.length, median_before_1950: early.length ? median(early) : null, median_1950_1989: mid.length ? median(mid) : null, median_since_1990: late.length ? median(late) : null, slope_per_decade: pyRound(slope * 10, 2), early: q.early, late: q.late, lo, hi },
    annotations: ann.map((r) => ({ label: `${r.name}: ${yrs(r.years)}`, name: r.name })),
    source: (A.sources || [{}])[0].url, events: [],
  };
}

// ---------- 8. sentiment swings ----------
export function sentiment(C, q = DEFAULTS.sentiment) {
  const { lst, by, T, EV } = C;
  const sy = new Map();
  for (const e of lst) if (e.sentiment) { if (!sy.has(e.year)) sy.set(e.year, []); sy.get(e.year).push(e); }
  if (!sy.size) return null;
  const yk = [...sy.keys()].sort((a, b) => a - b);
  const rows = yk.map((y) => { const v = sy.get(y); return { year: y, n: v.length, hope: v.filter((e) => e.sentiment > 0).length, fear: v.filter((e) => e.sentiment < 0).length, mean: pyRound(v.reduce((a, e) => a + e.sentiment, 0) / v.length, 3) }; });
  const dec = new Map();
  for (const v of sy.values()) for (const e of v) { const d = Math.floor(e.year / 10) * 10; if (!dec.has(d)) dec.set(d, []); dec.get(d).push(e); }
  const decades = [...dec].sort((a, b) => a[0] - b[0]).map(([d, v]) => {
    const fear = sortBy(v.filter((e) => e.sentiment < 0), (e) => [e.sentiment, -e.significance]);
    const hope = sortBy(v.filter((e) => e.sentiment > 0), (e) => [-e.sentiment, -e.significance]);
    return { decade: d, n: v.length, hope: hope.length, fear: fear.length, mean: pyRound(v.reduce((a, e) => a + e.sentiment, 0) / v.length, 3), top_fear: fear.slice(0, 2).map((e) => e.id), top_hope: hope.slice(0, 2).map((e) => e.id) };
  });
  let solid = decades.filter((d) => d.n >= q.min); if (!solid.length) solid = decades;
  const mostFear = minBy(solid, (d) => d.mean), mostHope = maxBy(solid, (d) => d.mean);
  const flips = solid.slice(1).map((b, i) => [solid[i], b]).filter(([a, b]) => (a.mean > 0) !== (b.mean > 0));
  const total = rows.reduce((a, r) => a + r.n, 0);
  let ov = [T(`Bars count hopeful items above the line and fearful ones below for each year; the dashed line is the decade mean of the score, from \u22122 to +2. The mood crosses the line ${flips.length} times. The most hopeful decade is the ${mostHope.decade}s (mean ${signed(mostHope.mean)}), led by `)].concat(mostHope.top_hope.length ? [EV(mostHope.top_hope[0])] : []).concat([T(`; the most fearful is the ${mostFear.decade}s (mean ${signed(mostFear.mean)}), led by `)]).concat(mostFear.top_fear.length ? [EV(mostFear.top_fear[0])] : []).concat([T('. ')]);
  if (flips.length) { const [a, b] = flips[flips.length - 1]; ov.push(T(`The latest turn came between the ${a.decade}s (${signed(a.mean)}) and the ${b.decade}s (${signed(b.mean)}). `)); }
  const mw = q.min === 10 ? 'ten' : word(q.min);
  return {
    id: 'sentiment-oscillation', kind: 'sentiment',
    title: `Hope and fear have flipped ${times(flips.length)} since the ${solid[0].decade}s`,
    figure: FIG(flips.length, 'flips', `between net hope and net fear since the ${solid[0].decade}s`, `most fearful: the ${mostFear.decade}s (${signed(mostFear.mean)})`),
    subtitle: `The record's mood has flipped between net hope and net fear ${times(flips.length)} since the ${solid[0].decade}s; the ${mostFear.decade}s are its most fearful decade (mean ${signed(mostFear.mean)}). Compilers' sentiment score on ${total} hopes, fears and cultural items, by year and by decade, ${rows[0].year} to ${rows[rows.length - 1].year}`,
    overview: ov, exception: `The 2020s carry ${decades[decades.length - 1].n} scored items against ${solid[0].n} for the ${solid[0].decade}s, so early decades swing on a handful of voices`, cannot: `Scores read what was written and kept; decades with fewer than ${mw} items are drawn but not counted.`,
    years: rows, decades,
    stats: { n: total, most_fearful_decade: mostFear.decade, most_hopeful_decade: mostHope.decade, sign_changes: flips.length, min: q.min },
    annotations: [...mostHope.top_hope.slice(0, 1), ...mostFear.top_fear.slice(0, 1)].map((i) => ({ event: i, label: `${by.get(i).year}: ${by.get(i).title}` })),
    events: decades.flatMap((d) => [...d.top_fear, ...d.top_hope]),
  };
}

// ---------- 9. where events cluster ----------
export function regions(C, q = DEFAULTS.regions) {
  const { lst, by, topSig, T, EV } = C;
  const reg = lst.filter((e) => e.region);
  const ages = [];
  for (const [aid, lab, a, b] of AGES) {
    const v = reg.filter((e) => a <= e.year && e.year < b);
    if (!v.length) continue;
    const c = mostCommon(counter(v.map((e) => e.region)));
    const [top, tn] = c[0];
    ages.push({ id: aid, label: lab, from: a, to: b, n: v.length, regions: Object.fromEntries(c), top, top_share: pyRound(tn / v.length, 2), examples: Object.fromEntries(c.map(([r]) => [r, topSig(v.filter((e) => e.region === r).map((e) => e.id), 1)[0]])) });
  }
  if (!ages.length) return null;
  const big = 5 * q.min; // the later age needs a fuller sample than the first (50 against 10 on the defaults)
  const first = ages.find((a) => a.n >= q.min) || ages[0];
  const lastA = [...ages].reverse().find((a) => a.n >= big && a !== first) || [...ages].reverse().find((a) => a.n >= q.min) || ages[ages.length - 1];
  const thin = reg.length < 100;
  const lastYear = Math.max(...reg.map((e) => e.year));
  const sentence = first !== lastA
    ? `${cap(rl(first.top))} holds ${pyRound(first.top_share * 100)} percent of located events in the ${agePhrase(first.label)}; ${rl(lastA.top)} holds ${pyRound(lastA.top_share * 100)} percent in the ${agePhrase(lastA.label)}`
    : `Only ${reg.length} events carry a region so far; ${rl(first.top)} holds ${pyRound(first.top_share * 100)} percent of them`;
  const title = first !== lastA ? (first.top === lastA.top ? `${cap(rl(first.top))} leads first and last` : `${cap(rl(first.top))} then, ${rl(lastA.top)} now`) : `${cap(rl(first.top))} holds ${pyRound(first.top_share * 100)} percent of located events`;
  const ov = [T(`Each column is an age of the millennium; its bands are the share of located events in each world region. ${reg.length} events carry a region` + (thin ? ' so far, a provisional sample while the millennium research lands. ' : '. '))];
  for (const a of ages) { const ex = a.examples[a.top]; if (ex) ov.push(T(`In the ${agePhrase(a.label)} the largest band is ${rl(a.top)}, ${a.regions[a.top]} of ${a.n} located events, for example `), EV(ex), T('. ')); }
  const spread = minBy(ages, (a) => a.top_share);
  if (lastYear < 1926) ov.push(T(`Regions were researched for the millennium record and end in ${lastYear}; the events of 1926 to 2026 do not yet carry one, so the later ages are empty here. `));
  return {
    id: 'regional-clusters', kind: 'regions', title,
    figure: FIG(pyRound(lastA.top_share * 100), '%', `of located events in ${rl(lastA.top)}, ${agePhrase(lastA.label)}`, first !== lastA ? `${rl(first.top)} ${pyRound(first.top_share * 100)}% in ${agePhrase(first.label)}` : ''),
    subtitle: `${sentence}. Share of events by world region within each age of the millennium, over ${reg.length} events with a region` + (thin ? ' (provisional sample)' : ''),
    overview: ov, exception: `${spread.label}, the most dispersed age: the leading region holds only ${pyRound(spread.top_share * 100)} percent and ${Object.keys(spread.regions).length} regions appear`, cannot: 'Regions follow the sources the compilers could read, which favour Europe and North America; silence is not absence.' + (lastYear < 1926 ? ` Events after ${lastYear} carry no region yet.` : ''),
    ages, stats: { n: reg.length, thin, first_age: first.id, last_age: lastA.id },
    annotations: ages.filter((a) => a.examples[a.top]).map((a) => ({ event: a.examples[a.top], label: `${a.label}: ${by.get(a.examples[a.top]).title}`, age: a.id })),
    events: yearsSort(new Set(ages.flatMap((a) => Object.values(a.examples))), by),
  };
}

// id -> compute(eventsCtx, adoption, params)
// ---------- 3b. hype items a year (the Now view's step-back count, handed to Findings) ----------
// a bar per year counting the record's items tagged bubble or hype cycle; the run since the last peak that has
// not yet turned to a bust is the open run. Peaks and troughs come from hype() with the same settings.
export function hypeCount(C, q = DEFAULTS.hype) {
  const { lst, T, EV, by } = C;
  const h = hype(C, q);
  if (!h) return null;
  const pool = lst.filter((e) => e.sentiment && ((e.tags || []).includes('bubble') || (e.tags || []).includes('hype-cycle')));
  const years = h.years.map((y) => ({ year: y.year, n: y.n }));
  const y0 = years[0].year, y1 = years[years.length - 1].year;
  const busiest = years.reduce((a, b) => (b.n > a.n ? b : a), years[0]);
  const eps = h.episodes || [], last = eps[eps.length - 1] || null;
  const open = !!(last && h.stats && h.stats.open && last.rebound == null && last.trough < y1) || false;
  // the open run: from the year after the last trough with no recovery, or after the last peak when the record ends in a boom
  const runFrom = last ? (last.recovery ? null : last.trough + 1) : null;
  const sinceLastPeak = last ? last.peak : null;
  const runItems = runFrom ? pool.filter((e) => e.year >= runFrom) : [];
  const total = pool.length;
  const thisYear = years[years.length - 1];
  const title = `Hype items a year, ${y0} to ${y1}: ${busiest.n} in ${busiest.year}, the busiest year of the record${last ? `; the last trough ${last.trough}` : ''}`;
  const figure = FIG(busiest.n, 'items', `tagged hype in ${busiest.year}, the busiest year`, thisYear.year !== busiest.year ? `${thisYear.n} so far in ${thisYear.year}` : last ? `last trough ${last.trough}` : '');
  const ov = [T(`Each bar counts the record's items tagged as a bubble or a hype cycle in one year, ${total} items from ${y0} to ${y1}. `)];
  if (last && last.trough_event && by.get(last.trough_event)) ov.push(T(`The last trough, ${last.trough}: `), EV(last.trough_event), T(runFrom ? `. Since then ${runItems.length} item${runItems.length === 1 ? '' : 's'} carry the tag and the mood has not turned down again. ` : '. '));
  return {
    id: 'hype-count', kind: 'hypecount', title, figure,
    subtitle: `Items tagged bubble or hype cycle, counted by year over ${total} items, ${y0} to ${y1}; peaks and troughs as in the boom-to-bust finding, with the same settings`,
    overview: ov, exception: busiest ? `${busiest.year}: ${busiest.n} items, the busiest year in the record` : '',
    cannot: 'Tags are the compilers\u2019 readings and coverage of markets is much denser after 2015, so a tall recent bar is partly a denser record.',
    years, episodes: eps, run_from: runFrom, since_peak: sinceLastPeak,
    stats: { n: total, run: runItems.length, run_from: runFrom, busiest: busiest.year, busiest_n: busiest.n, open },
    events: runItems.slice().sort((a, b) => b.significance - a.significance || a.year - b.year).slice(0, 12).map((e) => e.id),
    run_ids: runItems.map((e) => e.id),
  };
}

export const COMPUTE = {
  'invention-to-regulation': (C, A, p) => lagEra(C, p.lag),
  'disaster-then-rule': (C, A, p) => disaster(C, p.disaster),
  'hype-crash-recovery': (C, A, p) => hype(C, p.hype),
  'hype-count': (C, A, p) => hypeCount(C, p.hype),
  'ai-winters': (C, A, p) => winters(C, p.winters),
  'themes-together': (C, A, p) => themes(C, p.themes),
  spillovers: (C) => spill(C),
  'diffusion-faster': (C, A, p) => diffusion(A, p.diffusion),
  'sentiment-oscillation': (C, A, p) => sentiment(C, p.sentiment),
  'regional-clusters': (C, A, p) => regions(C, p.regions),
};
export const ORDER = Object.keys(COMPUTE);

export function computeAll(events, adoption, params = DEFAULTS) {
  const C = context(events, params.sig);
  return ORDER.map((id) => COMPUTE[id](C, adoption, params)).filter(Boolean);
}
