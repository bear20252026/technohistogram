// AI · MODELS (Vision 4 hero): two screens on the navy blueprint.
// Screen 1, the transit map: each lab family is a metro line running left to right through the years; its models are
// the stations (record-setting models carry their names); a lab founded by people from another lab branches off that
// line at its founding; people moving between labs afterwards are interchanges, a connector with a ring on each line.
// One accent, the selected line. Full detail (the lane timeline, the people behind an interchange) is in the evidence
// panel. Screen 2 is benchmarks.js, task-grouped small multiples.
import { state as S } from '../store.js';
import { esc } from '../ui.js';
import { ensure } from '../data.js';
import { LANES, computeFrontier, wOf } from './genealogy.js';

export const SCREENS = [{ id: 'lineage', title: 'Lineage' }, { id: 'benchmarks', title: 'Benchmarks' }];

// line colours: one hue family per lab from palette.json's AI organ families (step 2 for a line, step 3 for a fork of
// that family: Anthropic off OpenAI, xAI off Google, Mistral off Meta); --lab-<id> tokens take over the moment they land
const FAMILY = { openai: ['models', 2], anthropic: ['models', 3], google: ['data', 2], xai: ['data', 3], meta: ['labs', 2], mistral: ['labs', 3], deepseek: ['policy', 2], alibaba: ['energy', 2], china: ['talent', 2], msnv: ['chips', 2], west: ['users', 2] };
const FALLBACK = { models: ['#4D4990', '#8E7CF0', '#ADA4F2'], data: ['#376C90', '#5BC8F0', '#95D7F0'], labs: ['#3F5792', '#6F9BF5', '#9AB9F5'], policy: ['#2B6973', '#3FBFB0', '#87D1C3'], energy: ['#7B4F47', '#F0803A', '#F6A77A'], talent: ['#7B5B7B', '#F2A0C0', '#F5BBCF'], chips: ['#763F74', '#E25FB3', '#ED92C6'], users: ['#62648B', '#BDB6E6', '#CFCAE9'] };
const TOKEN = { west: 'other' };   // palette.css names the catch-all line --lab-other
const laneColor = (id) => { const [fam, step] = FAMILY[id] || ['users', 2]; return `var(--lab-${TOKEN[id] || id}, var(--ai-organ-${fam}-${step}, ${FALLBACK[fam][step - 1]}))`; };
const AGG = new Set(['china', 'west', 'msnv']);   // lines that gather several labs carry no founding year
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const laneOfName = (name) => (LANES.find((l) => l.re.test(name || '')) || LANES[7]).id;
const laneLabel = (id) => (LANES.find((l) => l.id === id) || {}).label || id;
const fmtT = (t) => { const y = Math.floor(t), m = Math.round((t - y) * 12 + 0.5); return m >= 1 && m <= 12 ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}` : String(y); };

export default function aiModels(el, ctx) {
  const { db, select, tip } = ctx;
  el.classList.add('scroll-y', 'ai-models');
  el.innerHTML = `
    <section class="td-sec flow dark blueprint tm-sec" data-sec="genealogy" aria-labelledby="tm-h">
      <div class="tm-wrap">
        <header class="tm-head">
          <span class="sc">AI · Models · Lineage</span>
          <h2 id="tm-h" class="tm-h"></h2>
          <p class="tm-src"></p>
        </header>
        <div class="tm-stage"><svg class="tm-svg" role="group" aria-label="Transit map of AI lab lineage, 2017 to 2026"></svg></div>
        <p class="tm-foot sc" aria-live="polite"></p>
      </div>
    </section>
    <section class="td-sec flow dark blueprint" data-sec="benchmarks" hidden><div class="view bm-host" data-view="benchmarks"></div></section>`;
  const sec1 = el.querySelector('[data-sec="genealogy"]'), sec2 = el.querySelector('[data-sec="benchmarks"]');
  const svg = d3.select(el.querySelector('.tm-svg')), stage = el.querySelector('.tm-stage'), foot = el.querySelector('.tm-foot');
  const hEl = el.querySelector('.tm-h'), srcEl = el.querySelector('.tm-src');

  /* ---------- data: lines, stations, branches, interchanges ---------- */
  const models = (db.modelList || []).filter((m) => m.t >= 2017);
  models.forEach((m) => { m.lane = laneOfName(m.org); });
  let frontier = new Map(), built = null;
  function build() {
    const orgs = db.orgById ? [...db.orgById.values()] : [];
    const people = db.personById ? [...db.personById.values()] : [];
    const orgLane = new Map(orgs.map((o) => [o.id, laneOfName(o.name)]));
    // a free-text origin (High-Flyer AI, MoPub, Twitter) joins a line only when it names one; it never falls into Other labs
    const named = (name) => { const l = LANES.find((x) => x.id !== 'west' && x.re.test(name || '')); return l ? l.id : null; };
    const laneOrg = (id) => orgLane.get(id) || named(id);
    // a lane's principal org: the earliest founded org that maps to it
    const principal = new Map();
    orgs.filter((o) => o.t).sort((a, b) => a.t - b.t).forEach((o) => { const l = orgLane.get(o.id); if (!principal.has(l)) principal.set(l, o); });
    frontier = computeFrontier(models, db.benchmarks || []);
    const lanes = LANES.map((l) => {
      const ms = models.filter((m) => m.lane === l.id).sort((a, b) => a.t - b.t);
      if (!ms.length) return null;
      const org = principal.get(l.id);
      const founded = org && org.t && org.t >= 2017 ? org.t : null;
      const t0 = Math.min(ms[0].t, founded || Infinity);
      return { id: l.id, label: l.label, sub: l.sub, color: laneColor(l.id), ms, org, founded, t0, from: null, founders: [] };
    }).filter(Boolean);
    const laneById = new Map(lanes.map((l) => [l.id, l]));
    // branches: founders who moved into the principal org from another lane's org at or before founding
    const moves = db.moves || [];
    lanes.forEach((L) => {
      if (!L.founded || !L.org || L.founded > L.ms[0].t + 0.1) return;
      const fs = moves.filter((mv) => mv.to_org === L.org.id && mv.t && mv.t <= L.founded + 0.6 && mv.from_org && laneOrg(mv.from_org) && laneOrg(mv.from_org) !== L.id && laneById.has(laneOrg(mv.from_org)));
      const byLane = d3.rollup(fs, (v) => v.length, (mv) => laneOrg(mv.from_org));
      if (!byLane.size) return;
      const from = [...byLane.entries()].filter(([id]) => laneById.get(id).t0 <= L.founded).sort((a, b) => b[1] - a[1])[0];
      if (!from) return;
      L.from = from[0]; L.founders = fs.filter((mv) => laneOrg(mv.from_org) === from[0]).map((mv) => ({ mv, p: people.find((p) => p.key === mv.person) }));
    });
    // interchanges: moves between two lanes after both lines run, grouped per pair and year
    const xs = new Map();
    moves.forEach((mv) => {
      if (!mv.t || mv.t < 2017 || !mv.from_org || !mv.to_org) return;
      const a = laneOrg(mv.from_org), b = laneOrg(mv.to_org);
      if (!a || !b || a === b || !laneById.has(a) || !laneById.has(b)) return;
      const to = laneById.get(b);
      if (to.founders.some((f) => f.mv === mv)) return;            // founding moves are the branch, not an interchange
      if (mv.t < laneById.get(a).t0 - 0.1 || mv.t < to.t0 - 0.1) return;
      const k = `${a}|${b}|${Math.floor(mv.t)}`;
      if (!xs.has(k)) xs.set(k, { a, b, t: mv.t, list: [] });
      const g = xs.get(k); g.list.push({ mv, p: people.find((p) => p.key === mv.person) }); g.t = Math.min(g.t, mv.t);
    });
    const inter = [...xs.values()].sort((p, q) => p.t - q.t);
    // vertical order: by first appearance, a child line directly under its parent when it can be
    const order = lanes.slice().sort((a, b) => a.t0 - b.t0);
    const placed = [];
    order.forEach((L) => { if (!L.from) placed.push(L); });
    order.filter((L) => L.from).forEach((L) => { const i = placed.findIndex((P) => P.id === L.from); const after = placed.slice(i + 1).findIndex((P) => P.from !== L.from); const at = i < 0 ? placed.length : after < 0 ? placed.length : i + 1 + after; placed.splice(at, 0, L); });
    built = { lanes: placed, inter, nBranch: lanes.filter((L) => L.from).length, nInter: inter.reduce((s, g) => s + g.list.length, 0) };
    return built;
  }

  /* ---------- selection: one line in amber ---------- */
  let selLane = null;
  const laneOfSel = () => { if (S.sel && db.modelById && db.modelById.get(S.sel)) return db.modelById.get(S.sel).lane; return null; };
  const defaultLane = () => { const f = models.filter((m) => frontier.has(m.id)).sort((a, b) => b.t - a.t)[0]; return f ? f.lane : (built && built.lanes[0] && built.lanes[0].id); };

  /* ---------- draw ---------- */
  let drawn = false, W = 0;
  function draw(anim) {
    const B = built || build();
    const lanes = B.lanes;
    W = stage.clientWidth; if (!W) return;
    const phone = W < 700;
    const PITCH = phone ? 44 : W < 1100 ? 54 : Math.max(48, Math.min(60, Math.floor(((el.clientHeight || 900) - 250) / Math.max(1, lanes.length))));
    const M = { l: phone ? 12 : 16, r: phone ? 120 : 40, t: 40, b: 34 };
    const innerW = phone ? Math.max(1100, W * 2.4) : W;
    const H = M.t + lanes.length * PITCH + M.b;
    svg.attr('width', innerW).attr('height', H).attr('viewBox', `0 0 ${innerW} ${H}`);
    stage.classList.toggle('scroll-x', phone);
    svg.selectAll('*').remove();
    const NAMEW = phone ? 96 : 150;
    const x = d3.scaleLinear().domain([2016.6, 2027]).range([M.l + NAMEW, innerW - M.r]);
    const yOf = new Map(lanes.map((L, i) => [L.id, M.t + i * PITCH + PITCH / 2]));
    const cur = selLane || laneOfSel() || defaultLane();
    // year grid and labels
    const gAx = svg.append('g').attr('class', 'tm-ax');
    d3.range(2017, 2027).forEach((yr) => {
      gAx.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', M.t - 10).attr('y2', H - M.b + 6);
      gAx.append('text').attr('x', x(yr) + 4).attr('y', H - M.b + 20).text(yr);
    });
    const gLines = svg.append('g').attr('class', 'tm-lines'), gInter = svg.append('g').attr('class', 'tm-inter'), gSt = svg.append('g').attr('class', 'tm-st'), gLab = svg.append('g').attr('class', 'tm-lab');
    const R = 6, SW = phone ? 5 : 7, BEND = PITCH * 0.9;
    const ease = d3.easeCubicOut;
    const tAt = (t) => (lanes.length ? 200 + ((t - 2016.6) / (2027 - 2016.6)) * 700 : 0);
    lanes.forEach((L, i) => {
      const y = yOf.get(L.id), on = L.id === cur;
      const xStart = x(Math.max(2016.6, L.t0)), xEnd = x(2026.95);
      let d;
      if (L.from && yOf.has(L.from)) {
        // the branch: along the parent, then a 45 degree bend down (or up) onto this line's own level
        const yP = yOf.get(L.from), dir = Math.sign(y - yP) || 1;
        const xb = Math.max(x(2016.6) + BEND, xStart);
        d = `M${xb - BEND - 12},${yP}H${xb - BEND}L${xb},${y}H${xEnd}`;
        void dir;
      } else d = `M${xStart},${y}H${xEnd}`;
      const g = gLines.append('g').attr('class', 'tm-line' + (on ? ' on' : '')).attr('data-lane', L.id);
      if (on) g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', 'var(--chalk)').attr('stroke-width', SW + 6).attr('stroke-opacity', 0.35).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('class', 'tm-halo');
      const path = g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', L.color).attr('stroke-width', on ? SW + 1 : SW).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      // a wide invisible hit path selects the line
      g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 18).style('cursor', 'pointer')
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${L.label} line, ${L.ms.length} models${L.from ? `, founded by people from ${laneLabel(L.from)}` : ''}`)
        .on('click', () => pickLane(L.id)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickLane(L.id); } })
        .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${esc(L.label)}</div><div class="h">${L.ms.length} models since ${fmtT(L.ms[0].t)}</div><div class="m">${L.from ? `line branches from ${esc(laneLabel(L.from))}, ${esc(fmtT(L.founded))}: ${esc(L.founders.map((f) => f.p ? f.p.name : f.mv.person).join(', '))}` : esc(L.sub)}</div>`)).on('mousemove', tip.move).on('mouseleave', () => tip.hide());
      // the terminus: the line's name on its mark, with the founding year where the line begins inside the frame
      const term = L.from ? null : { x: xStart, y };
      if (term) gSt.append('rect').attr('x', term.x - 5).attr('y', y - 9).attr('width', 10).attr('height', 18).attr('rx', 2).attr('class', 'tm-term' + (on ? ' on' : '')).attr('fill', L.color);
      const nameX = L.from ? x(Math.max(2016.6, L.t0)) - BEND - 16 : xStart - 10;
      const nameY = L.from ? y + 4 : y + 4;
      gLab.append('text').attr('class', 'tm-name' + (on ? ' on' : '')).attr('x', nameX).attr('y', nameY).attr('text-anchor', 'end').attr('fill', L.color)
        .text(`${L.label}${AGG.has(L.id) ? '' : L.founded ? ` · ${Math.floor(L.founded)}` : L.org && L.org.t ? ` · ${Math.floor(L.org.t)}` : ''}`);
      // on phones the map scrolls sideways and opens on the latest years, so the line is named at its right end too
      if (phone) gLab.append('text').attr('class', 'tm-name end' + (on ? ' on' : '')).attr('x', xEnd + 6).attr('y', y + 4).attr('text-anchor', 'start').attr('fill', L.color).text(L.label);
      // stations: every model a small mark; a record-setting model a named station
      const dense = W < 1100;
      const recs = L.ms.filter((m) => frontier.has(m.id));
      const lastRec = recs[recs.length - 1];
      const labelled = new Set(recs.filter((m) => !dense || m === lastRec || frontier.get(m.id).size >= 2).map((m) => m.id));
      const placedX = [];
      L.ms.forEach((m) => {
        const cx = x(m.t), isN = frontier.has(m.id);
        const st = gSt.append('g').attr('class', 'tm-station' + (isN ? ' named' : '') + (S.sel === m.id ? ' sel' : '')).attr('transform', `translate(${cx},${y})`).attr('tabindex', 0).attr('role', 'button')
          .attr('aria-label', `${m.name}, ${m.org}, ${fmtT(m.t)}${isN ? ', set a benchmark record' : ''}`)
          .on('click', (ev) => { ev.stopPropagation(); select(m.id); }).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(m.id); } })
          .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${esc(L.label)} · ${esc(fmtT(m.t))}</div><div class="h">${esc(m.name)}</div><div class="m">${esc(wOf(m))} weights${isN ? ` · record on ${[...frontier.get(m.id).keys()].length} benchmark${frontier.get(m.id).size === 1 ? '' : 's'}` : ''}</div>`)).on('mousemove', tip.move).on('mouseleave', () => tip.hide());
        if (isN) st.append('circle').attr('r', R).attr('fill', 'var(--night)').attr('stroke', L.color).attr('stroke-width', 2.5);
        else st.append('circle').attr('r', 2.6).attr('fill', 'var(--night)').attr('stroke', L.color).attr('stroke-width', 1.5);
        if (isN && labelled.has(m.id)) placedX.push({ m, cx });
      });
      // station labels: upright, above the line, alternating to the lower side when the previous label is too close
      const ctx2 = document.createElement('canvas').getContext('2d'); ctx2.font = `${phone ? 10.5 : 12}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace'}`;
      let lastAbove = -Infinity, lastBelow = -Infinity, prevSide = 'below';
      const xMax = innerW - M.r;
      placedX.forEach(({ m, cx }, i) => {
        const w = ctx2.measureText(m.name).width + 8;
        const next = placedX[i + 1];
        // a neighbour within a label's width on either side means the pair staggers: this one takes the side the last one did not
        const crowded = (next && next.cx - cx < w) || (i > 0 && cx - placedX[i - 1].cx < w);
        let side = crowded ? (prevSide === 'above' ? 'below' : 'above') : 'above';
        // the last labels on a line anchor to their end so nothing runs past the frame
        const anchor = cx + w / 2 > xMax ? 'end' : 'middle';
        const x0 = anchor === 'end' ? cx + R - w : cx - w / 2, x1 = anchor === 'end' ? cx + R : cx + w / 2;
        const fits = (sd) => x0 >= (sd === 'above' ? lastAbove : lastBelow);
        if (!fits(side)) side = fits(side === 'above' ? 'below' : 'above') ? (side === 'above' ? 'below' : 'above') : null;
        if (side === 'below' && PITCH < 50) side = null;   // tight lanes (phones) label above only; the rest stay on hover
        if (!side) return;
        if (side === 'above') lastAbove = x1; else lastBelow = x1;
        prevSide = side;
        gLab.append('text').attr('class', 'tm-slab' + (on ? ' on' : '')).attr('x', anchor === 'end' ? cx + R : cx).attr('y', side === 'above' ? y - R - 9 : y + R + 17).attr('text-anchor', anchor).text(m.name);
      });
      if (anim) {
        const len = path.node().getTotalLength();
        path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().delay(i * 40).duration(900).ease(ease).attr('stroke-dashoffset', 0).on('end', () => path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
      }
    });
    // interchanges
    B.inter.forEach((g) => {
      const ya = yOf.get(g.a), yb = yOf.get(g.b), cx = x(g.t);
      const on = g.a === cur || g.b === cur;
      const gi = gInter.append('g').attr('class', 'tm-x' + (on ? ' on' : ' quiet')).attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', `${g.list.length} ${g.list.length === 1 ? 'person' : 'people'} from ${laneLabel(g.a)} to ${laneLabel(g.b)}, ${Math.floor(g.t)}`)
        .on('click', () => openInter(g)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openInter(g); } })
        .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${Math.floor(g.t)} · interchange</div><div class="h">${esc(laneLabel(g.a))} to ${esc(laneLabel(g.b))}</div><div class="m">${esc(g.list.map((f) => f.p ? f.p.name : f.mv.person).join(', '))}</div>`)).on('mousemove', tip.move).on('mouseleave', () => tip.hide());
      gi.append('line').attr('x1', cx).attr('x2', cx).attr('y1', ya).attr('y2', yb).attr('class', 'tm-xline');
      // the ring grows with the number of people who moved; the names are in the tooltip and the evidence panel
      [ya, yb].forEach((yy) => gi.append('circle').attr('cx', cx).attr('cy', yy).attr('r', R - 1 + Math.min(2, g.list.length - 1)).attr('class', 'tm-xring'));
      gi.append('path').attr('d', `M${cx - 4},${yb - (yb > ya ? 8 : -8)}L${cx},${yb - (yb > ya ? 3 : -3)}L${cx + 4},${yb - (yb > ya ? 8 : -8)}`).attr('class', 'tm-xarrow').attr('fill', 'none');
    });
    // headline from the data, source line, foot
    const nLines = lanes.length, nSt = models.length, nNamed = models.filter((m) => frontier.has(m.id)).length;
    hEl.textContent = `${nLines} lab lines, ${B.nBranch} branched from older labs`;
    srcEl.innerHTML = `${nSt} models since 2017 as stations, ${nNamed} that set a benchmark record named; ${B.nInter} moves between labs as interchanges. <span class="tm-srcs">Epoch AI notable models, lab releases, Wikipedia role histories.</span>`;
    const Lc = lanes.find((L) => L.id === cur);
    foot.textContent = Lc ? `${Lc.label} line, lit: ${Lc.ms.length} models, ${Lc.ms.filter((m) => frontier.has(m.id)).length} with a record` : '';
    if (phone && !drawn) requestAnimationFrame(() => { stage.scrollLeft = stage.scrollWidth; });
    drawn = true;
  }
  function pickLane(id) { selLane = id; draw(false); }
  function openInter(g) {
    const title = `${laneLabel(g.a)} to ${laneLabel(g.b)}, ${Math.floor(g.t)}`;
    const html = `<ol class="tm-ev">${g.list.map((f) => `<li><b>${esc(f.p ? f.p.name : f.mv.person)}</b>${f.mv.note ? ` · ${esc(f.mv.note)}` : ''}${f.mv.date ? ` <span class="sc">${esc(String(f.mv.date))}</span>` : ''}${f.mv.source_url ? ` <a href="${esc(f.mv.source_url)}" target="_blank" rel="noopener">source</a>` : ''}</li>`).join('')}</ol>`;
    if (ctx.openEvidence) ctx.openEvidence(`lineage:${g.a}:${g.b}:${Math.floor(g.t)}`, { kicker: 'Interchange', title, html });
    else if (g.list[0] && g.list[0].p) select(g.list[0].p.id);
  }

  /* ---------- screen 2: benchmarks.js mounted on its own section ---------- */
  let bench = null, benchLoading = null;
  function ensureBench() {
    if (bench) return Promise.resolve(bench);
    if (benchLoading) return benchLoading;
    benchLoading = Promise.all([import('./benchmarks.js'), ensure('benchmarks')]).then(([mod]) => { bench = mod.default(sec2.querySelector('.bm-host'), ctx); sec2.querySelector('.bm-host').classList.add('on'); return bench; });
    return benchLoading;
  }

  let screen = 1, lineageAsked = false, benchDirty = true;
  function render(state, ch) {
    const sc = Math.max(1, Math.min(2, +state.screen || 1));
    const full = ch.has('*');
    if (sc !== screen || full) { screen = sc; sec1.hidden = screen !== 1; sec2.hidden = screen !== 2; el.scrollTop = 0; }
    if (screen === 1) {
      if (!lineageAsked) { lineageAsked = true; Promise.all([ensure('talent'), ensure('benchmarks')]).then(() => { built = null; draw(!RM && !drawn); }); }
      if (full || ch.has('sel') || !drawn) { if (ch.has('sel') && laneOfSel()) selLane = null; draw(!RM && !drawn); }
    } else {
      ensureBench().then((api) => { if (benchDirty || full) { api.render(state, new Set(['*'])); benchDirty = false; } else api.render(state, ch); });
    }
  }
  return {
    render,
    resize() { if (screen === 1) draw(false); else if (bench && bench.resize) bench.resize(); },
    hover(id) { if (bench && bench.hover) bench.hover(id); },
    lit(l) { if (bench && bench.lit) bench.lit(l); },
  };
}
