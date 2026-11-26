// AI · RULES, screens 1 and 3 (Vision 4 hero, on the AI page's navy). Screen 2 is the Policy atlas (its own module).
// Screen 1, Positions: an alluvial for one issue at a time. Actors, grouped by kind and named, on the left; the three
// answers to the issue's question (yes, with conditions, no) on the right; one blue flow per stated position. An actor
// on record with two positions on the issue switched: both of its flows are orange, the earlier one drawn hollow. A tap
// on a flow opens the position's card in the evidence panel (position, incentive, dated quote or action, source).
// Screen 3, Disagreements: pairs of voices who name each other in disagrees_with, quote against quote, blue and orange,
// one pair per screen with a hard cut between pairs; the voices in full open in the evidence panel.
// Data: site/data/politics_map.json and site/data/perspectives_now.json (shapes in moment.js's header comment).
import { esc } from '../ui.js';
import { db } from '../data.js';

export const SCREENS = [{ id: 'positions', title: 'Positions' }, { id: 'atlas', title: 'Policy atlas' }, { id: 'voices', title: 'Disagreements' }];

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = (d) => { if (!d) return ''; const [y, m, dd] = String(d).split('-').map(Number); return m ? (dd ? `${dd} ${MON[m - 1]} ${y}` : `${MON[m - 1]} ${y}`) : String(y); };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const strip = (l) => String(l || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const manifestLists = (f) => { const man = db.manifest || {}; return (Array.isArray(man.optional) && man.optional.includes(f)) || (man.sizes && man.sizes[f] != null); };
const optional = (f) => { if (!manifestLists(f)) return Promise.resolve(null); const man = db.manifest || {}; return fetch(`data/${f}${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null); };

/* ---------- the politicization map, from moment.js ---------- */
const KINDS = { us_federal: 'US federal', congress: 'Congress', congress_r: 'Congress (R)', congress_d: 'Congress (D)', congress_bipartisan: 'Congress (both)', us_state: 'US states', local: 'Local', frontier_lab: 'Frontier labs', platform: 'Platforms', chipmaker: 'Chipmakers', venture: 'Venture', trade_group: 'Trade groups', publisher_creator: 'Publishers', union: 'Unions', civil_society: 'Civil society', academic: 'Academics', utility: 'Utilities', eu: 'EU', china: 'China', foreign_government: 'Foreign govts', international: 'International' };
const normParty = (p) => { const v = String(p || '').trim(); if (!v || /^(none|by cell|n\/a)$/i.test(v)) return ''; if (/^(R|Republican)$/i.test(v)) return 'R'; if (/^(D|Democrat(ic)?)$/i.test(v)) return 'D'; if (/bipartisan|both/i.test(v)) return 'bipartisan'; return v; };
const partyOf = (a, c) => { if (!a) return ''; const own = normParty(a.party); if (own) return own; if (c) { const cp = normParty(c.party); if (cp) return cp; } const l = String(a.label || ''); if (/bipartisan|\(R\).*\(D\)/i.test(l)) return 'bipartisan'; if (/\bRepublican|\(R\)/.test(l)) return 'R'; if (/\bDemocrat|\(D\)/.test(l)) return 'D'; const m = l.match(/(Trump|Biden) administration/i); return m ? `${m[1]} administration` : ''; };
const partyLabel = (p) => (p === 'R' ? 'Republican' : p === 'D' ? 'Democratic' : p);
const kindOf = (a) => { const k = (a && a.kind) || 'other'; if (k !== 'congress') return k; const p = partyOf(a); return p === 'R' ? 'congress_r' : p === 'D' ? 'congress_d' : p ? 'congress_bipartisan' : 'congress'; };
const dayOf = (d) => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
const actorRe = (label) => { const w = strip(label); return w ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null; };
// the record event behind a position: one that names the actor (in orgs or the title) within three days of the evidence
function recordFor(label, date) {
  const d0 = dayOf(date), re = actorRe(label); if (d0 == null || !re || !Array.isArray(db.events)) return null;
  let best = null, bd = 4;
  for (const e of db.events) {
    if (!e.year || !e.month || !e.day) continue;
    const dd = Math.abs(Date.UTC(e.year, e.month - 1, e.day) / 864e5 - d0); if (dd > 3 || dd > bd) continue;
    if (!(e.orgs || []).some((o) => re.test(o)) && !re.test(e.title || '')) continue;
    if (dd < bd || (best && (e.significance || 0) > (best.significance || 0))) { best = e; bd = dd; }
  }
  return best;
}

// the three answers, top to bottom
const ST = [
  { id: 'yes', label: 'yes', lines: ['yes'] },
  { id: 'conditional', label: 'with conditions', lines: ['with', 'conditions'] },
  { id: 'no', label: 'no', lines: ['no'] },
];
// kinds of actor in three families: the flows' tint steps (government deepest, industry middle, society lightest)
const KGROUP = (k) => (/^(us_federal|congress|us_state|local|eu|china|foreign_government|international)/.test(k) ? 'gov' : /^(frontier_lab|platform|chipmaker|venture|trade_group|utility)/.test(k) ? 'ind' : 'soc');
const stOf = (s) => { const v = String(s || '').toLowerCase(); return v === 'mixed' ? 'conditional' : v; };
const ST_LABEL = Object.fromEntries(ST.map((s) => [s.id, s.label]));
// the issue row's names and the headline's words for what "yes" and "no" mean on each question
const ISSUE = {
  'open-weights': { name: 'Open weights', on: 'open weights', yes: 'want them open', no: 'want them closed' },
  preemption: { name: 'Preemption', on: 'preemption', yes: 'want one federal rule', no: 'want state laws kept' },
  'export-controls': { name: 'Chip exports', on: 'chip exports', yes: 'want limits', no: 'oppose limits' },
  copyright: { name: 'Copyright', on: 'copyright', yes: 'want payment', no: 'oppose payment' },
  datacenters: { name: 'Data centers', on: 'data centers', yes: 'want companies to pay', no: 'oppose paying' },
  labor: { name: 'Labor', on: 'labor', yes: 'want limits', no: 'oppose limits' },
  'china-framing': { name: 'China race', on: 'China', yes: 'call it a race', no: 'reject the race' },
  'child-safety': { name: 'Children', on: 'children', yes: 'want limits', no: 'oppose limits' },
  deepfakes: { name: 'Deepfakes', on: 'deepfakes', yes: 'want legal limits', no: 'oppose new limits' },
  antitrust: { name: 'Antitrust', on: 'antitrust', yes: 'see harm to competition', no: 'see no harm' },
  xrisk: { name: 'Extinction risk', on: 'extinction risk', yes: 'take it seriously', no: 'reject the alarm' },
  war: { name: 'War', on: 'AI in war', yes: 'accept military use', no: 'oppose military use' },
};
const issueName = (is) => (ISSUE[is.id] && ISSUE[is.id].name) || strip(is.label).split(/\s+(?:vs|and)\s+/)[0];

// the meaning of an issue in eight words or fewer, from the latest stance of each actor
function headline(is, latest) {
  const n = latest.length; const k = Object.fromEntries(ST.map((s) => [s.id, latest.filter((c) => c.st === s.id).length]));
  const w = ISSUE[is.id] || { on: issueName(is).toLowerCase(), yes: 'say yes', no: 'say no' };
  const on = `On ${w.on},`;
  const fit = (...alts) => alts.find((t) => words(t) <= 8) || alts[alts.length - 1];
  if (!n) return `${on} no one on record yet`;
  if (k.no * 2 > n) return fit(`${on} most ${w.no}`, `Most ${w.no}`);
  if ((k.yes + k.conditional) * 2 > n) {
    if (k.conditional >= k.yes) return fit(`${on} most ${w.yes}, with conditions`, `${on} most ${w.yes}`);
    return fit(`${on} most ${w.yes}`, `Most ${w.yes}`);
  }
  return fit(`${on} the voices split evenly`, `${on} an even split`);
}

const cv = document.createElement('canvas').getContext('2d');
const fitText = (t, w, font) => { cv.font = font; if (cv.measureText(t).width <= w) return t; let s = t; while (s.length > 3 && cv.measureText(`${s}\u2026`).width > w) s = s.slice(0, -1); return `${s.trim()}\u2026`; };

/* ---------- the disagreement pairs ---------- */
const TOPIC = { jobs: 'jobs', productivity: 'growth', security: 'security', safety: 'safety', law: 'the law', mind: 'the mind', education: 'schooling', health: 'health', energy: 'energy', 'Global South': 'the Global South' };
const sur = (p) => String(p.name || '').split(' ').pop();
const quoteOf = (p) => String(p.quote || '').trim().replace(/^[\u201c"']+|[\u201d"']+$/g, '');
const SRC3 = 'Quotes in each speaker\u2019s own words, linked to the source.';
function pairsOf(list) {
  const by = new Map(list.map((p) => [p.id, p]));
  const cands = []; const seen = new Set();
  for (const p of list) for (const d of p.disagrees_with || []) {
    const q = by.get(d); if (!q || q.id === p.id) continue;
    const key = [p.id, q.id].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    const mutual = (q.disagrees_with || []).includes(p.id);
    const [a, b] = String(p.date) <= String(q.date) ? [p, q] : [q, p];
    const ta = TOPIC[a.topic] || a.topic || '', tb = TOPIC[b.topic] || b.topic || '';
    const on = ta === tb || !tb ? ta : !ta ? tb : `${ta} and ${tb}`;
    const head = `${sur(a)} and ${sur(b)} disagree${on ? ` on ${on}` : ''}`;
    const w = words(head) + words(quoteOf(a)) + words(quoteOf(b)) + words(SRC3);
    if (!quoteOf(a) || !quoteOf(b) || words(head) > 8 || w > 60) continue;
    cands.push({ a, b, mutual, head, w, same: ta === tb });
  }
  // mutual first, then a shared topic; no voice in more than two pairs; six to eight pairs
  const ORDER = ['jobs', 'safety', 'security', 'productivity', 'Global South', 'mind', 'law', 'education', 'health', 'energy'];
  const rank = (c) => Math.min(...[c.a.topic, c.b.topic].map((t) => { const i = ORDER.indexOf(t); return i < 0 ? 99 : i; }));
  cands.sort((x, y) => (y.mutual - x.mutual) || (y.same - x.same) || rank(x) - rank(y) || x.w - y.w);
  const use = new Map(), out = [];
  for (const c of cands) {
    if (out.length >= 8) break;
    if ((use.get(c.a.id) || 0) >= 2 || (use.get(c.b.id) || 0) >= 2) continue;
    out.push(c); use.set(c.a.id, (use.get(c.a.id) || 0) + 1); use.set(c.b.id, (use.get(c.b.id) || 0) + 1);
  }
  return out;
}

export default function rulesPositions(el, ctx) {
  const { openEvidence, select } = ctx;
  el.classList.add('scroll-y', 'rp-view');
  el.innerHTML = `
    <section class="rp-sec rp-pos" data-sc="1" aria-labelledby="rp-h2">
      <header class="rp-head">
        <span class="sc rp-kick">AI · Rules · Positions</span>
        <div class="rp-issues" role="tablist" aria-label="Issue"></div>
        <h2 id="rp-h2" class="rp-h"></h2>
        <p class="rp-q"></p>
      </header>
      <div class="rp-stage"><svg class="rp-svg" role="group"></svg></div>
      <p class="rp-src sc"></p>
    </section>
    <section class="rp-sec rp-pairs" data-sc="3" hidden aria-labelledby="rp-h3">
      <header class="rp-head">
        <span class="sc rp-kick">AI · Rules · Disagreements</span>
        <h2 id="rp-h3" class="rp-h"></h2>
      </header>
      <div class="rp-duel" aria-live="polite"></div>
      <footer class="rp-pfoot">
        <div class="rp-pager"><button type="button" class="rp-pb" data-d="-1" aria-label="Previous pair">\u2190</button><span class="rp-pn sc"></span><button type="button" class="rp-pb" data-d="1" aria-label="Next pair">\u2192</button></div>
        <button type="button" class="rp-full sc">The voices in full</button>
      </footer>
      <p class="rp-src sc">${esc(SRC3)}</p>
    </section>`;
  const $ = (s) => el.querySelector(s);
  const secPos = $('.rp-pos'), secPairs = $('.rp-pairs');
  const svg = d3.select($('.rp-svg')), stage = $('.rp-stage');
  let POL = null, PER = null, PAIRS = [], issue = 'export-controls', pairAt = 0, screen = 1, loaded = null, drawnFor = '';

  function load() {
    if (!loaded) loaded = Promise.all([optional('politics_map.json'), optional('perspectives_now.json')]).then(([pm, pn]) => {
      if (pm && Array.isArray(pm.issues)) {
        const actors = new Map((pm.actors || []).map((a) => [a.id, a]));
        const cells = [];
        for (const is of pm.issues) (is.cells || []).forEach((c, i) => {
          const ev = c.evidence || {};
          cells.push({ ...c, issue: is.id, i, st: stOf(c.stance), date: c.date || ev.date || '', quote: ev.kind === 'quote' ? ev.quote_or_action : '', action: ev.kind && ev.kind !== 'quote' ? ev.quote_or_action : '', kindEv: ev.kind || '', url: ev.source_url || c.source_url || '', srcTitle: ev.source_title || '', movedText: typeof c.moved === 'string' ? c.moved : '' });
          if (!actors.has(c.actor)) actors.set(c.actor, { id: c.actor, label: c.actor, kind: 'other' });
        });
        POL = { issues: pm.issues, actors, cells };
        if (!POL.issues.some((x) => x.id === issue)) issue = POL.issues[0].id;
      }
      const list = Array.isArray(pn) ? pn : pn && (pn.perspectives || pn.items);
      if (list && list.length) { PER = new Map(list.map((p) => [p.id, p])); PAIRS = pairsOf(list); }
    });
    return loaded;
  }

  /* ---------- screen 2 ---------- */
  function issueRow() {
    const row = $('.rp-issues');
    row.innerHTML = POL.issues.map((is) => `<button type="button" role="tab" data-is="${esc(is.id)}" aria-selected="${is.id === issue}" title="${esc(is.question || is.label)}">${esc(issueName(is))}</button>`).join('');
  }
  $('.rp-issues').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-is]'); if (!b || b.dataset.is === issue) return; issue = b.dataset.is; $('.rp-issues').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.is === issue))); drawPositions(true); });
  $('.rp-issues').addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const bs = [...$('.rp-issues').querySelectorAll('button')]; const i = bs.findIndex((b) => b.dataset.is === issue);
    const n = bs[(i + (ev.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]; ev.preventDefault(); n.focus(); n.click();
  });

  function flowsFor(isId) {
    const here = POL.cells.filter((c) => c.issue === isId && ST_LABEL[c.st]);
    const byA = d3.group(here, (c) => c.actor);
    const actors = [];
    for (const [id, cs] of byA) {
      cs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const a = POL.actors.get(id); const latest = cs[cs.length - 1];
      const moved = cs.length > 1 || !!latest.movedText;
      actors.push({ id, a, label: strip(a.label), kind: kindOf(a), cells: cs, latest, moved, twin: cs.length > 1 });
    }
    return actors;
  }

  function drawPositions(animate) {
    if (!POL) return;
    const is = POL.issues.find((x) => x.id === issue);
    const actors = flowsFor(issue);
    const latest = actors.map((x) => x.latest);
    $('#rp-h2').textContent = headline(is, latest);
    $('.rp-q').textContent = is.question || '';
    const dates = POL.cells.map((c) => c.date).filter(Boolean).sort();
    const nAct = new Set(POL.cells.map((c) => c.actor)).size;
    $('.rp-pos .rp-src').textContent = `Source: ${POL.cells.length} positions by ${nAct} actors, each a dated quote or action, ${String(dates[0]).slice(0, 4)} to ${String(dates[dates.length - 1]).slice(0, 4)}.`;

    // left order: kinds by the mean of their answers (fewest crossings), actors within a kind the same way
    const score = (x) => { const s = ST.findIndex((t) => t.id === x.latest.st); return s < 0 ? 1 : s; };
    const kinds = d3.groups(actors, (x) => x.kind).map(([k, xs]) => ({ k, xs: xs.sort((p, q) => score(p) - score(q) || p.label.localeCompare(q.label)), m: d3.mean(xs, score) })).sort((p, q) => p.m - q.m || p.k.localeCompare(q.k));
    const flows = []; // one per position: the earlier position of a switcher too
    for (const g of kinds) for (const x of g.xs) x.cells.forEach((c, j) => flows.push({ x, c, early: x.twin && j < x.cells.length - 1, sw: x.moved }));

    const W = stage.clientWidth, narrow = W < 640;
    const H = Math.max(narrow ? 420 : 380, stage.clientHeight || 0);
    const LW = narrow ? 128 : Math.min(300, Math.max(210, W * 0.2)), RW = narrow ? 96 : 230, NB = narrow ? 7 : 10;
    const KG = narrow ? 30 : 34, AG = narrow ? 5 : 7, SG = narrow ? 26 : 34;
    const n = flows.length;
    const u = Math.max(narrow ? 13 : 16, Math.min(narrow ? 24 : 34, (H - 8 - kinds.length * KG - (actors.length - kinds.length) * AG) / n));
    const hL = kinds.length * KG + (actors.length - kinds.length) * AG + n * u;
    const counts = Object.fromEntries(ST.map((s) => [s.id, flows.filter((f) => f.c.st === s.id).length]));
    const said = Object.fromEntries(ST.map((s) => [s.id, latest.filter((c) => c.st === s.id).length]));  // the label counts each actor once, at its latest answer
    const live = ST.filter((s) => counts[s.id]);
    const hR = n * u + (live.length - 1) * SG;
    const Hs = Math.max(hL, hR) + 8;
    const x0 = LW, x1 = W - RW;
    svg.attr('width', W).attr('height', Hs).attr('viewBox', `0 0 ${W} ${Hs}`).attr('aria-label', `${actors.length} actors flowing into the answers to: ${is.question || is.label}`);
    svg.selectAll('*').remove();

    // left nodes
    let y = 4 + Math.max(0, (Hs - 8 - hL) / 2);
    const gL = svg.append('g').attr('class', 'rp-left');
    for (const g of kinds) {
      gL.append('text').attr('class', 'rp-kind').attr('x', x0 - (narrow ? 8 : 12)).attr('y', y + KG - 9).attr('text-anchor', 'end').text(KINDS[g.k] || g.k.replace(/_/g, ' '));
      y += KG;
      g.xs.forEach((x, i) => {
        if (i) y += AG;
        const h = x.cells.length * u;
        x.y0 = y; x.y1 = y + h;
        gL.append('rect').attr('class', `rp-node${x.moved ? ' sw' : ''}`).attr('data-st', x.latest.st).attr('data-kg', KGROUP(x.kind)).attr('x', x0).attr('y', y).attr('width', NB).attr('height', h);
        const t = gL.append('text').attr('class', `rp-actor${x.moved ? ' sw' : ''}`).attr('x', x0 - (narrow ? 8 : 12)).attr('y', y + h / 2 + 5).attr('text-anchor', 'end');
        const lab = fitText(x.label, x0 - (narrow ? 8 : 12) - 2, `${x.moved ? 500 : 400} ${narrow ? 13.5 : 15}px Instrument Sans, serif`);
        t.text(lab).append('title').text(x.a.label + (partyOf(x.a, x.latest) ? ` \u00b7 ${partyLabel(partyOf(x.a, x.latest))}` : ''));
        y += h;
      });
    }
    // flows leave each actor in date order (earlier on top)
    for (const g of kinds) for (const x of g.xs) x.cells.forEach((c, j) => { const f = flows.find((ff) => ff.c === c); f.ly = x.y0 + j * u; });
    // right nodes: flows enter in the order they leave
    let ry = 4 + Math.max(0, (Hs - 8 - hR) / 2);
    const gR = svg.append('g').attr('class', 'rp-right');
    const node = {};
    for (const s of live) {
      const h = counts[s.id] * u; node[s.id] = { y0: ry, y1: ry + h };
      gR.append('rect').attr('class', 'rp-node r').attr('data-st', s.id).attr('x', x1 - NB).attr('y', ry).attr('width', NB).attr('height', h);
      const tx = x1 + (narrow ? 8 : 14);
      const lab = gR.append('text').attr('class', 'rp-st').attr('data-st', s.id).attr('x', tx).attr('y', ry + h / 2 - (narrow && s.lines.length > 1 ? 10 : 2));
      (narrow ? s.lines : [s.label]).forEach((ln, i) => lab.append('tspan').attr('x', tx).attr('dy', i ? 15 : 0).text(ln));
      gR.append('text').attr('class', 'rp-n').attr('data-st', s.id).attr('x', tx).attr('y', ry + h / 2 + (narrow ? (s.lines.length > 1 ? 30 : 22) : 30)).text(said[s.id]);
      let k = 0; flows.filter((f) => f.c.st === s.id).sort((p, q) => p.ly - q.ly).forEach((f) => { f.ry = ry + k * u; k++; });
      ry += h + SG;
    }
    // the flows
    const xa = x0 + NB, xb = x1 - NB, mx = (xa + xb) / 2;
    const band = (f) => `M${xa},${f.ly}C${mx},${f.ly} ${mx},${f.ry} ${xb},${f.ry}L${xb},${f.ry + u}C${mx},${f.ry + u} ${mx},${f.ly + u} ${xa},${f.ly + u}Z`;
    const gF = svg.insert('g', '.rp-left').attr('class', 'rp-flows');
    flows.sort((p, q) => p.sw - q.sw);  // the orange flows on top
    for (const f of flows) {
      const lbl = `${f.x.a.label}: ${ST_LABEL[f.c.st]}${f.c.date ? `, ${when(f.c.date)}` : ''}${f.early ? ', earlier position' : f.sw ? ', switched' : ''}`;
      gF.append('path').attr('class', `rp-flow${f.sw ? ' sw' : ''}${f.early ? ' early' : ''}`).attr('d', band(f)).attr('data-a', f.x.id).attr('data-i', f.c.i).attr('data-st', f.c.st).attr('data-kg', KGROUP(f.x.kind))
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', lbl).append('title').text(lbl);
    }
    // a word on the switchers' earlier flows, at their middle, where there is room
    for (const f of flows.filter((ff) => ff.early)) gF.append('text').attr('class', 'rp-was').attr('x', xa + 8).attr('y', f.ly + u / 2 + 4).text(`earlier, ${String(f.c.date).slice(0, 4)}`);
    if (animate && !RM) {
      const clip = svg.append('defs').append('clipPath').attr('id', 'rp-clip').append('rect').attr('x', 0).attr('y', 0).attr('height', Hs).attr('width', xa);
      gF.attr('clip-path', 'url(#rp-clip)');
      clip.transition().duration(700).ease(d3.easeCubicOut).attr('width', W).on('end', () => gF.attr('clip-path', null));
    }
    drawnFor = `${issue}|${W}`;
  }
  const flowAt = (t) => t && t.closest && t.closest('.rp-flow');
  stage.addEventListener('click', (ev) => { const p = flowAt(ev.target); if (p) openCell(p.dataset.a, +p.dataset.i); });
  stage.addEventListener('keydown', (ev) => { const p = flowAt(ev.target); if (p && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openCell(p.dataset.a, +p.dataset.i); } });
  const hot = (id) => { stage.classList.toggle('hot', !!id); stage.querySelectorAll('.rp-flow').forEach((p) => p.classList.toggle('on', p.dataset.a === id)); };
  stage.addEventListener('pointerover', (ev) => { const p = flowAt(ev.target); hot(p ? p.dataset.a : null); });
  stage.addEventListener('pointerleave', () => hot(null));
  stage.addEventListener('focusin', (ev) => { const p = flowAt(ev.target); hot(p ? p.dataset.a : null); });
  stage.addEventListener('focusout', () => hot(null));

  function cellHtml(isId, actorId, i) {
    const is = POL.issues.find((x) => x.id === isId); const a = POL.actors.get(actorId);
    const cs = POL.cells.filter((c) => c.issue === isId && c.actor === actorId).sort((p, q) => String(p.date).localeCompare(String(q.date)));
    const c = cs.find((x) => x.i === i) || cs[cs.length - 1]; if (!c || !a) return null;
    const other = cs.find((x) => x !== c);
    const party = partyOf(a, c);
    const ev = recordFor(a.label, c.date);
    const quote = c.quote ? `<blockquote class="rp-cq">&ldquo;${esc(String(c.quote).trim().replace(/^[\u201c"']+|[\u201d"']+$/g, ''))}&rdquo;</blockquote>` : c.action ? `<p class="summary">${esc(c.action)}</p>` : '';
    const html = `
      <p class="rp-cst"><span class="sc">${esc(is.question || '')}</span><b>${esc(ST_LABEL[c.st] || c.st)}</b>${c.date ? `<span class="sc">${esc(when(c.date))}</span>` : ''}</p>
      ${c.position ? `<p class="summary">${esc(c.position)}</p>` : ''}
      ${c.incentive ? `<div class="sect-h"><span>Incentive</span></div><p class="rp-cinc">${esc(c.incentive)}${c.incentive_source_url ? ` <a href="${esc(c.incentive_source_url)}" target="_blank" rel="noopener">${esc(host(c.incentive_source_url))}</a>` : ''}</p>` : ''}
      ${quote ? `<div class="sect-h"><span>${c.quote ? 'In their words' : esc(c.kindEv || 'Action')}</span><span>${esc(when(c.date))}</span></div>${quote}` : ''}
      ${c.movedText ? `<div class="sect-h"><span>Switched</span></div><p class="rp-cmv">${esc(c.movedText)}</p>` : ''}
      ${other ? `<div class="sect-h"><span>${String(other.date) < String(c.date) ? 'Earlier' : 'Later'} position</span><span>${esc(when(other.date))}</span></div><p class="rp-cmv"><b>${esc(ST_LABEL[other.st] || other.st)}.</b> ${esc(other.position || '')}</p>` : ''}
      ${c.url ? `<div class="sect-h"><span>Source</span><span>1</span></div><ol class="sources"><li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.srcTitle || host(c.url))}</a> <span class="host">${esc(host(c.url))}</span></li></ol>` : ''}
      ${ev ? `<div class="sect-h"><span>In the record</span></div><ul class="links"><li><button type="button" data-id="${esc(ev.id)}"><span class="y">${ev.year}</span><span>${esc(ev.title)}</span></button></li></ul>` : ''}`;
    return { kicker: `<span class="ki">Position</span> &middot; ${esc(issueName(is))}`, title: a.label, sub: `${KINDS[kindOf(a)] || a.kind}${party ? ` \u00b7 ${partyLabel(party)}` : ''}`, html, onMount: (body) => body.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) select(b.dataset.id); }) };
  }
  function openCell(actorId, i) {
    const spec = cellHtml(issue, actorId, i); if (!spec || !openEvidence) return;
    openEvidence(`rules:pos:${issue}:${actorId}:${i}`, spec);
  }

  /* ---------- screen 3 ---------- */
  const voiceLine = (p) => `${esc(String(p.affiliation || '').split(/[;,]/)[0])}`;
  function drawPair() {
    const duel = $('.rp-duel');
    if (!PAIRS.length) { $('#rp-h3').textContent = 'Disagreements arrive with the voices'; duel.innerHTML = ''; return; }
    pairAt = (pairAt + PAIRS.length) % PAIRS.length;
    const pr = PAIRS[pairAt];
    $('#rp-h3').textContent = pr.head;
    const side = (p, cls) => `<figure class="rp-side ${cls}"><button type="button" class="rp-qbtn" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: open the full entry"><blockquote>&ldquo;${esc(quoteOf(p))}&rdquo;</blockquote></button>
      <figcaption><b>${esc(p.name)}</b><span>${voiceLine(p)}</span><span class="sc">${esc(when(p.date))}${p.source && p.source.url ? ` &middot; <a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(host(p.source.url))}</a>` : ''}</span></figcaption></figure>`;
    duel.innerHTML = side(pr.a, 'a') + '<span class="rp-vs sc" aria-hidden="true">against</span>' + side(pr.b, 'b');
    $('.rp-pn').textContent = `${pairAt + 1} of ${PAIRS.length}`;
  }
  $('.rp-pager').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-d]'); if (!b) return; pairAt += +b.dataset.d; drawPair(); });  // hard cut: no transition
  $('.rp-duel').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-v]'); if (b) openVoice(b.dataset.v); });
  $('.rp-full').addEventListener('click', () => openAll());

  const nameOf = (id) => (PER.get(id) ? PER.get(id).name : id);
  const voiceBody = (p) => `
    ${p.quote ? `<blockquote class="rp-cq">&ldquo;${esc(quoteOf(p))}&rdquo;</blockquote>` : ''}
    ${p.view ? `<p class="summary">${esc(p.view)}</p>` : ''}
    ${p.wrong_if ? `<p class="rp-cmv"><span class="sc">Wrong if</span> ${esc(p.wrong_if)}</p>` : ''}
    ${(p.disagrees_with || []).length ? `<p class="rp-cmv"><span class="sc">Disagrees with</span> ${(p.disagrees_with || []).filter((id) => PER.has(id)).map((id) => `<button type="button" class="rp-vl" data-v="${esc(id)}">${esc(nameOf(id))}</button>`).join(', ')}</p>` : ''}
    ${p.source && p.source.url ? `<ol class="sources"><li><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.source.title || host(p.source.url))}</a> <span class="host">${esc(when(p.date))}</span></li></ol>` : ''}`;
  const wire = (body) => body.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) openVoice(b.dataset.v); });
  function voiceSpec(id) { const p = PER && PER.get(id); if (!p) return null; return { kicker: '<span class="ki">Voice</span>', title: p.name, sub: String(p.affiliation || ''), html: voiceBody(p), onMount: wire }; }
  function openVoice(id) { const s = voiceSpec(id); if (s && openEvidence) openEvidence(`rules:voice:${id}`, s); }
  function allSpec() {
    if (!PER) return null;
    const list = [...PER.values()].sort((a, b) => sur(a).localeCompare(sur(b)));
    return { kicker: '<span class="ki">Voices</span>', title: 'The voices in full', sub: `${list.length} voices, ${PAIRS.length} pairs drawn`, html: `<ol class="rp-all">${list.map((p) => `<li><h4><button type="button" class="rp-vl" data-v="${esc(p.id)}">${esc(p.name)}</button> <span>${esc(String(p.affiliation || '').split(';')[0])}</span></h4>${voiceBody(p)}</li>`).join('')}</ol>`, onMount: wire };
  }
  function openAll() { const s = allSpec(); if (s && openEvidence) openEvidence('rules:voices', s); }

  // a shared link with e=rules:... reopens its card once the data is in
  function reopen(state) {
    const k = state.sel || ''; if (!k.startsWith('rules:') || !openEvidence || (db.pointById && db.pointById.has(k))) return;
    const [, kind, ...rest] = k.split(':');
    if (kind === 'pos' && POL) { const [is, a, i] = rest; const spec = POL.issues.some((x) => x.id === is) ? cellHtml(is, a, +i) : null; if (spec) { issue = is; openEvidence(k, spec); } }
    else if (kind === 'voice') { const s = voiceSpec(rest.join(':')); if (s) openEvidence(k, s); }
    else if (kind === 'voices') { const s = allSpec(); if (s) openEvidence(k, s); }
  }

  function render(state, ch) {
    const sc = +state.screen === 3 ? 3 : 1;  // 1 Positions, 3 Disagreements (2 is the atlas's)
    const full = !ch || ch.has('*');
    const turned = sc !== screen;
    screen = sc;
    secPos.hidden = sc !== 1; secPairs.hidden = sc !== 3;
    if (turned) el.scrollTop = 0;
    load().then(() => {
      reopen(state);
      if (screen === 1 && POL) {
        if (!$('.rp-issues').children.length) issueRow();
        else $('.rp-issues').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.is === issue)));
        if (full || turned || drawnFor !== `${issue}|${stage.clientWidth}`) drawPositions(full || turned);
      }
      if (screen === 3) drawPair();
    });
  }
  return {
    render,
    resize() { if (screen === 1 && POL) drawPositions(false); },
    hover() {},
    teardown() {},
  };
}
