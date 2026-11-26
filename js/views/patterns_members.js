// The events behind each number in Patterns. Given a computed pattern (p), the reader's settings (q), the significance
// context (C, from patterns_calc.context) and a figure the reader clicked, return the exact records that produced it:
// the pattern's own pair and episode lists where it stores them, and the same filters patterns_calc.js runs otherwise.
// Returns { title, sub, ids } (events) or { title, sub, rows } (plain rows, for the OWID diffusion series).
import { REGION } from '../time.js';

const yrs = (n) => (n == null || !Number.isFinite(n) ? 'no years' : `${Number.isInteger(n) ? n : (Math.round(n * 10) / 10)} year${n === 1 ? '' : 's'}`);
const pretty = (t) => String(t).replace(/-/g, ' ');
const signed = (v) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(2);
const uniq = (ids) => [...new Set(ids.filter(Boolean))];
const regionName = (r) => (REGION[r] ? REGION[r].label : pretty(r));
const sorted = (ids, by) => uniq(ids).sort((a, b) => (by.get(a)?.year || 0) - (by.get(b)?.year || 0));
const isAI = (e) => e.domain === 'ai' || e.ai_precursor;
const has = (e, t) => (e.tags || []).includes(t);

// pairs of linked events (lag-era, disaster, spill): one pair, a period of pairs, or a share of them
function pairList(pairs, by, title, sub) { return { title, sub, pairs, ids: sorted(pairs.flatMap((d) => [d.from, d.to]), by) }; }
const span = (ys) => (ys.length ? (ys[0] === ys[ys.length - 1] ? `${ys[0]}` : `${ys[0]} to ${ys[ys.length - 1]}`) : '');

export function members(p, q, C, fig) {
  const { lst, by } = C;
  const F = fig || { t: 'key' };
  switch (p.kind) {
    case 'lag-era': {
      if (F.t === 'pair') { const d = F.d, a = by.get(d.from), b = by.get(d.to); return pairList([d], by, `${yrs(d.lag)} from invention to rule`, `${a ? a.year : ''} to ${b ? b.year : ''} · the invention and the rule it drew`); }
      const per = (p.periods || []).filter((x) => x.n);
      let x = F.t === 'period' ? F.q : [...per].reverse().find((v) => v.n >= 3) || per[per.length - 1];
      if (!x) return pairList(p.pairs, by, `${p.pairs.length} invention-to-rule pairs`, `median ${yrs(p.stats.median_lag)} over all periods`);
      const inP = p.pairs.filter((d) => d.year >= x.from && d.year < x.to);
      const ry = inP.map((d) => d.year).sort((a, b) => a - b);
      return pairList(inP, by, `Median ${yrs(x.median_lag)} from invention to rule, ${x.label}`, `${x.label} only: rules dated ${span(ry)} with their inventions; ${p.pairs.length} pairs over all periods`);
    }
    case 'pairs': {
      if (F.t === 'pair') { const d = F.d, a = by.get(d.from), b = by.get(d.to); return pairList([d], by, `${yrs(d.lag)} from disaster to rule`, `${a ? a.year : ''} to ${b ? b.year : ''} · the failure and the rule that answered it`); }
      if (F.t === 'period') { const inP = p.pairs.filter((d) => d.year >= F.q.from && d.year <= F.q.to); return pairList(inP, by, `${F.q.from} to ${F.q.to}: median ${yrs(F.q.median_lag)} to a rule`, `failures dated ${F.q.from} to ${F.q.to} only, with the rules that answered them; ${p.pairs.length} pairs over all periods`); }
      const quick = q.disaster.quick, inQ = p.pairs.filter((d) => d.lag <= quick);
      return pairList(inQ, by, `${Math.round((p.stats.share_within_2 || 0) * 100)}% of disaster-linked rules within ${quick === 0 ? 'the year' : yrs(quick)}`, `the ${inQ.length} pairs answered that soon, of ${p.pairs.length} over all periods`);
    }
    case 'cycles': {
      const pool = lst.filter((e) => e.sentiment && (has(e, 'bubble') || has(e, 'hype-cycle')));
      const inYears = (a, b) => pool.filter((e) => e.year >= a && e.year <= b);
      if (F.t === 'year') { const r = F.r, v = inYears(r.year, r.year); return { title: `${r.year}: net ${r.net > 0 ? '+' : ''}${r.net} over ${v.length} item${v.length === 1 ? '' : 's'}`, sub: 'items tagged bubble or hype cycle, scored for hope or fear', ids: sorted(v.map((e) => e.id), by) }; }
      if (F.t === 'episode') { const e = F.e, v = inYears(e.peak, e.trough); return { title: `Boom ${e.peak} to bust ${e.trough} · ${v.length} items`, sub: `the fall took ${yrs(e.fall)}${e.recovery ? `; positive again ${e.recovery}` : '; no recovery yet in the record'}`, ids: sorted(v.map((e2) => e2.id), by) }; }
      const eps = p.episodes || [], v = uniq(eps.flatMap((e) => inYears(e.peak, e.trough).map((x) => x.id)));
      return { title: `${eps.length} boom-to-bust turn${eps.length === 1 ? '' : 's'} since ${eps[0] ? eps[0].peak : ''} · ${v.length} items`, sub: 'every scored item from each peak to its trough', ids: sorted(v, by) };
    }
    case 'hypecount': {
      const pool = lst.filter((e) => e.sentiment && (has(e, 'bubble') || has(e, 'hype-cycle')));
      if (F.t === 'year') { const r = F.r, v = pool.filter((e) => e.year === r.year); return { title: `${r.year}: ${v.length} item${v.length === 1 ? '' : 's'} tagged bubble or hype cycle`, sub: 'the record\u2019s hype items dated that year', ids: sorted(v.map((e) => e.id), by) }; }
      const by_ = p.stats.busiest, v = pool.filter((e) => e.year === by_);
      return { title: `${by_}: ${v.length} items tagged bubble or hype cycle, the busiest year`, sub: `of ${pool.length} such items in the record`, ids: sorted(v.map((e) => e.id), by) };
    }
    case 'ai-cycles': {
      const ai = (y) => lst.filter((e) => e.year === y && isAI(e));
      if (F.t === 'year') { const r = F.r, v = ai(r.year); return { title: `${r.year}: ${r.ai} of ${r.n} events are AI`, sub: `${Math.round(r.share * 100)}% of the year's record`, ids: sorted(v.map((e) => e.id), by) }; }
      if (F.t === 'mark') { const v = ai(F.year); return { title: `${p.stats.troughs} troughs since ${q.winters.start} · ${v.length} AI event${v.length === 1 ? '' : 's'} in the ${F.year} ${F.kind}`, sub: `AI and precursor events dated ${F.year}`, ids: sorted(v.map((e) => e.id), by) }; }
      const trs = p.troughs || [], v = uniq(trs.flatMap((t) => ai(t.year).map((e) => e.id)));
      return { title: `${trs.length} trough${trs.length === 1 ? '' : 's'} since ${q.winters.start} · ${v.length} AI events in the trough years`, sub: trs.map((t) => t.year).join(', '), ids: sorted(v, by) };
    }
    case 'cooccur': {
      if (F.t === 'tag') { const v = lst.filter((e) => has(e, F.tag)); return { title: `${pretty(F.tag)} · ${v.length} event${v.length === 1 ? '' : 's'}`, sub: 'every event the compilers tagged with this theme', ids: sorted(v.map((e) => e.id), by) }; }
      const pr = F.t === 'pair' ? F.q : p.stats.persistent || p.stats.top;
      if (!pr) return null;
      const v = lst.filter((e) => has(e, pr.a) && has(e, pr.b));
      return { title: `${pretty(pr.a)} + ${pretty(pr.b)} · ${v.length} shared events`, sub: `${pr.first} to ${pr.last}, ${pr.centuries} ${pr.centuries === 1 ? 'century' : 'centuries'}`, ids: sorted(v.map((e) => e.id), by) };
    }
    case 'spill': {
      if (F.t === 'pair') { const d = F.d, a = by.get(d.from), b = by.get(d.to); return pairList([d], by, `${yrs(d.lag)} from ${F.strip === 'military' ? 'military origin to open use' : 'lab result to product'}`, `${a ? a.year : ''} to ${b ? b.year : ''}`); }
      const key = F.t === 'strip' ? F.strip : 'military';
      const list = key === 'military' ? p.military : p.lab, st = p.stats[key];
      return pairList(list, by, `${key === 'military' ? 'Military ideas reach open use' : 'Lab results become products'} in a median ${yrs(st.median_lag)}`, `every pair behind the ${key} median; origin and destination of each`);
    }
    case 'diffusion': {
      const dq = q.diffusion, rows = F.t === 'row' ? [F.r] : [...p.rows].sort((a, b) => a.year10 - b.year10);
      const row = (r) => ({ y: Math.round(r.year10), t: r.name, sub: `${dq.lo}% in ${Math.round(r.year10)}${r.open10 ? ' (series starts there)' : ''}, ${dq.hi}% in ${Math.round(r.year50)}: ${yrs(r.years)}` });
      return { title: F.t === 'row' ? `${F.r.name}: ${yrs(F.r.years)} from ${dq.lo}% to ${dq.hi}% of US homes` : `${rows.length} technologies, ${dq.lo}% to ${dq.hi}% of US homes`, sub: 'Our World in Data household adoption figures; no event records behind these points', rows: rows.map(row), source: p.source };
    }
    case 'sentiment': {
      const scored = lst.filter((e) => e.sentiment);
      if (F.t === 'year') { const v = scored.filter((e) => e.year === F.year && (F.sign > 0 ? e.sentiment > 0 : e.sentiment < 0)); return { title: `${F.year}: ${v.length} ${F.sign > 0 ? 'hopeful' : 'fearful'} item${v.length === 1 ? '' : 's'}`, sub: 'hopes, fears and cultural items scored by the compilers', ids: sorted(v.map((e) => e.id), by) }; }
      if (F.t === 'decade') { const d = F.d, v = scored.filter((e) => Math.floor(e.year / 10) * 10 === d.decade); return { title: `${d.decade}s: ${v.length} scored items, mean ${signed(d.mean)}`, sub: `${d.hope} hopeful, ${d.fear} fearful`, ids: sorted(v.map((e) => e.id), by) }; }
      let solid = (p.decades || []).filter((d) => d.n >= q.sentiment.min); if (!solid.length) solid = p.decades || [];
      const flips = solid.slice(1).map((b, i) => [solid[i], b]).filter(([a, b]) => (a.mean > 0) !== (b.mean > 0));
      const decs = uniq(flips.flatMap(([a, b]) => [a.decade, b.decade]));
      const v = scored.filter((e) => decs.includes(Math.floor(e.year / 10) * 10));
      return { title: `Flipped ${flips.length} time${flips.length === 1 ? '' : 's'} · ${v.length} items in the decades that turned`, sub: decs.map((d) => `${d}s`).join(', '), ids: sorted(v.map((e) => e.id), by) };
    }
    case 'regions': {
      const reg = lst.filter((e) => e.region);
      const inAge = (a) => reg.filter((e) => e.year >= a.from && e.year < a.to);
      if (F.t === 'cell') { const c = F.c, v = inAge(c.age).filter((e) => e.region === c.r); return { title: `${c.age.label}: ${regionName(c.r)} · ${v.length} of ${c.age.n} located events`, sub: `${Math.round(c.s * 100)}% of the age`, ids: sorted(v.map((e) => e.id), by) }; }
      if (F.t === 'age') { const v = inAge(F.a); return { title: `${F.a.label} · ${v.length} located events`, sub: `${Object.keys(F.a.regions).length} regions appear`, ids: sorted(v.map((e) => e.id), by) }; }
      // the same age and region the title and figure name: patterns_calc records them in stats.last_age / first_age
      const ages = (p.ages || []).filter((a) => a.n), S = p.stats || {};
      const last = ages.find((a) => a.id === S.last_age) || ages[ages.length - 1], first = ages.find((a) => a.id === S.first_age) || ages[0];
      if (!last) return null;
      const top = (a) => Object.entries(a.regions).sort((u, v) => v[1] - u[1])[0];
      const [r, n] = top(last), f = first && first !== last ? top(first) : null;
      const v = inAge(last).filter((e) => e.region === r);
      return { title: `${Math.round((n / last.n) * 100)}% of located events in ${regionName(r)}, ${last.label}`, sub: `${last.label} only: ${v.length} of ${last.n} located events${f ? `; ${first.label} had ${Math.round((f[1] / first.n) * 100)}% in ${regionName(f[0])}` : ''}`, ids: sorted(v.map((e) => e.id), by) };
    }
    default: return null;
  }
}
