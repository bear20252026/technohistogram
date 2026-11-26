// N. POLICY ATLAS: AI laws, regulations, executive actions and strategies by jurisdiction over time,
// with a tile map of the world colored by how far each place had gone by the end of the brushed window.
import { state as S, set } from '../store.js';
import { esc, roving } from '../ui.js';
import { wrapMeasured, tspans } from '../text.js';
import { NOW_T, PSTATUS, PSTAT, PTYPES, PTYPE, pswatch } from '../aidepth.js';
import { host } from '../data.js';

const REGIONS = ['International', 'Europe', 'North America', 'Asia', 'Middle East', 'Africa', 'South America', 'Oceania'];
const LEVEL_RANK = { international: 0, supranational: 0, national: 1, state: 2, city: 3 };
const UP = { 'Shanghai': 'China', 'Shenzhen': 'China' };
const BLOCS = [
  ['European Union', 'EU'], ['Council of Europe', 'CoE'], ['African Union', 'AU'], ['United Nations', 'UN'], ['UNESCO', 'UNESCO'],
  ['OECD', 'OECD'], ['G7', 'G7'], ['G20', 'G20'], ['GPAI', 'GPAI'], ['AI summits', 'Summits'],
];
// coarse tile grid: [name, abbreviation, column, row]; places without records are drawn faintly for shape
const TILES = [
  ['Canada', 'CA', 2, 0], ['United States', 'US', 2, 1], ['Mexico', 'MX', 2, 2], ['Colombia', 'CO', 3, 3], ['Peru', 'PE', 3, 4], ['Brazil', 'BR', 4, 4], ['Chile', 'CL', 3, 5], ['Argentina', 'AR', 4, 5], ['Uruguay', 'UY', 5, 5],
  ['United Kingdom', 'UK', 8, 0], ['Denmark', 'DK', 10, 0], ['Sweden', 'SE', 11, 0], ['Finland', 'FI', 12, 0], ['Russia', 'RU', 14, 0],
  ['Ireland', 'IE', 7, 1], ['Netherlands', 'NL', 9, 1], ['Germany', 'DE', 10, 1], ['Poland', 'PL', 11, 1], ['Ukraine', 'UA', 12, 1], ['Kazakhstan', 'KZ', 15, 1], ['South Korea', 'KR', 17, 1], ['Japan', 'JP', 18, 1],
  ['Spain', 'ES', 8, 2], ['France', 'FR', 9, 2], ['Italy', 'IT', 10, 2], ['Greece', 'GR', 11, 2], ['Turkey', 'TR', 12, 2], ['Pakistan', 'PK', 14, 2], ['China', 'CN', 16, 2],
  ['Morocco', 'MA', 8, 3], ['Egypt', 'EG', 11, 3], ['Israel', 'IL', 12, 3], ['Saudi Arabia', 'SA', 13, 3], ['United Arab Emirates', 'AE', 14, 3], ['India', 'IN', 15, 3], ['Taiwan', 'TW', 17, 3],
  ['Nigeria', 'NG', 9, 4], ['Kenya', 'KE', 11, 4], ['Qatar', 'QA', 13, 4], ['Thailand', 'TH', 15, 4], ['Vietnam', 'VN', 16, 4], ['Philippines', 'PH', 17, 4],
  ['Rwanda', 'RW', 10, 5], ['Mauritius', 'MU', 12, 5], ['Malaysia', 'MY', 15, 5], ['Singapore', 'SG', 16, 5], ['Indonesia', 'ID', 17, 5],
  ['South Africa', 'ZA', 10, 6], ['Australia', 'AU', 18, 6], ['New Zealand', 'NZ', 19, 7],
];
// one green, light to dark, carries how far rules have got; proposals are an outline of the same green, not a fill,
// and places where every instrument died are hatched grey, so the tile reads without the key
// four risograph inks on paper: ultramarine once rules bind and are in force, teal once enacted (a pale teal for guidance),
// pink outline while only proposed, orange hatch where every instrument died; the marks below use the same inks by status
const ULTRA = PSTAT.in_force.color, TEAL = PSTAT.enacted.color, PINK = PSTAT.proposed.color, ORANGE = PSTAT.repealed.color;
const GREEN = TEAL, HATCH = ORANGE;
const STRENGTH = [
  { v: 4, label: 'Binding rules in force', color: ULTRA },
  { v: 3, label: 'Enacted, or executive order', color: TEAL },
  { v: 2, label: 'Strategy or guidance only', color: '#4d7a7c' },
  { v: 1, label: 'Proposals only', color: null, outline: PINK },
  { v: 0.5, label: 'Only repealed, vetoed or blocked', color: null, hatch: true },
];
const swatch = (s) => s.hatch ? `<i class="hatch"></i>` : s.outline ? `<i style="border:1.5px solid ${s.outline};background:var(--ground-2)"></i>` : `<i style="background:${s.color}"></i>`;
const TERMINAL = new Set(['repealed', 'vetoed', 'blocked']);
const GROUND_2 = '#1d2748', GROUND_3 = '#28335a';   // navy tile grounds (palette ai ground 141C3A stepped up)
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const YEARS = d3.range(2016, 2027);

export default function policy(el, { db, select, tip }) {
  roving(el);  // one Tab stop per chart; arrows move between its marks
  el.classList.add('scroll-y');
  const all = db.policy || [];
  const hidden = new Set();
  // places picked on the map; one filters the timeline, several compare side by side
  const places = new Set();
  let mapMode = 'strict', hiId = null;
  // subject filter: one issue at a time, read from and written to #issue= so Now's matrix rows can link in
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  let ISSUES = [], issueOf = new Map(), issueAlias = {}, issue = '';
  const hashIssue = () => { const v = new URLSearchParams(location.hash.slice(1)).get('issue') || ''; return issueAlias[v] || v; };
  const issueLabel = (id) => (ISSUES.find((i) => i.id === id) || {}).label || id;
  const issueOk = (x) => !issue || (issueOf.get(x.key || x.id) || []).includes(issue);
  const writeIssue = () => { const p = new URLSearchParams(location.hash.slice(1)); if (issue) p.set('issue', issue); else p.delete('issue'); const h = '#' + p.toString().replace(/%2C/g, ','); if (h !== location.hash) history.replaceState(null, '', h); };
  function setIssue(id) { issue = id && ISSUES.some((i) => i.id === id) ? id : ''; writeIssue(); draw(); }
  const ctx = document.createElement('canvas').getContext('2d');
  const fit = (t, w, font) => { ctx.font = font; if (ctx.measureText(t).width <= w) return t; let x = t; while (x.length > 3 && ctx.measureText(x + '\u2026').width > w) x = x.slice(0, -1); return x.trimEnd() + '\u2026'; };
  const placeOf = (x) => { if (x.level === 'state' || x.level === 'city') return UP[x.jurisdiction] || (x.region === 'North America' ? 'United States' : x.jurisdiction); if (/summit/i.test(x.jurisdiction)) return 'AI summits'; return x.jurisdiction; };
  all.forEach((x) => { x.place = placeOf(x); x.t0 = Math.min(...[x.ti, x.te, x.tf].filter((v) => v != null)); x.t1 = Math.max(...[x.ti, x.te, x.tf].filter((v) => v != null)); });
  const tileSet = new Set(TILES.map((t) => t[0])), blocSet = new Set(BLOCS.map((b) => b[0]));

  // lifecycle state at the end of year Y; repeal, veto and block dates are not recorded, so those show only at 2026
  function asOf(x, Y) {
    const T = Y + 1;
    if (TERMINAL.has(x.status) && Y >= 2026) return x.status;
    if (x.tf != null && x.tf <= T) return 'in_force';
    if (x.te != null && x.te <= T) return x.tf != null ? 'enacted' : x.status === 'in_force' ? 'in_force' : 'enacted';
    if (x.ti != null && x.ti <= T) return 'proposed';
    if (x.t0 <= T && !TERMINAL.has(x.status)) return x.status;
    return null;
  }
  function strength(x, Y) {
    const s = asOf(x, Y);
    if (!s) return 0;
    if (TERMINAL.has(s)) return 0.5;
    if (s === 'proposed') return 1;
    const binding = x.type === 'law' || x.type === 'regulation' || x.type === 'treaty' || x.type === 'bill';
    if (x.type === 'executive_order') return 3;
    if (binding) return s === 'in_force' ? 4 : 3;
    return 2;
  }

  el.innerHTML = `
    <div class="po-wrap">
      <header class="po-top">
        <div class="pl-intro po-lead">
          <span class="sc">AI · Rules · Atlas</span>
          <h2 class="po-head" id="po-head"></h2>
          <p class="po-srcline"></p>
          <div class="po-glyphs" role="img" aria-label="The four status glyphs: a filled ultramarine disc in force, a teal disc enacted, a pink outline proposed, an orange hatched disc repealed, vetoed or blocked; a disc binds, a square does not" data-chart="status glyphs">${PSTATUS.filter((st, i, arr) => arr.findIndex((q) => q.color === st.color && !!q.hatch === !!st.hatch && !!q.hollow === !!st.hollow) === i).map((st) => `
            <div class="po-glyph"><svg width="56" height="56" viewBox="-28 -28 56 56" aria-hidden="true"><defs><pattern id="po-hatch-g-${st.id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${GROUND_2}"/><line y2="6" stroke="${st.color}" stroke-width="2"/></pattern></defs><circle r="20" fill="${st.hatch ? `url(#po-hatch-g-${st.id})` : st.hollow ? 'var(--ground)' : st.color}" stroke="${st.color}" stroke-width="${st.hollow ? 3 : st.hatch ? 2 : 0}"/><rect x="-6" y="-6" width="12" height="12" transform="translate(30,-30) scale(0.001)" fill="none"/></svg><span class="po-gname">${st.hatch ? 'Repealed, vetoed or blocked' : st.label}</span></div>`).join('')}
            <div class="po-glyph shapes"><svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="var(--ink)"/><rect x="33" y="5.5" width="13" height="13" fill="var(--ink)"/></svg><span class="po-gname">disc binds, square does not</span></div>
          </div>
        </div>
        <section class="po-map" aria-labelledby="po-map-h">
          <div class="po-map-head"><h3 class="sc" id="po-map-h">As of <b class="po-yr"></b></h3>
            <div class="toggle" role="group" aria-label="Color the map by"><button type="button" data-mm="strict">Strongest</button><button type="button" data-mm="count">Count</button><button type="button" data-mm="first">First mover</button></div></div>
          <div class="po-tiles"></div>
          <div class="po-legend"></div>
          <div class="po-years"><span class="sc">Started each year</span><span class="po-years-n" hidden></span><svg aria-hidden="true"></svg><input type="range" min="2016" max="2026" step="1" aria-label="Year the map shows" /></div>
          <div class="po-hint" aria-live="polite"></div>
        </section>
      </header>
      <div class="pl-sticky">
        <div class="po-issues" role="group" aria-label="Filter by subject" hidden></div>
        <div class="pl-ctl">
          <div class="po-stat" role="group" aria-label="Show or hide by status"></div>
          <span class="po-place"></span>
          <span class="pl-count count"></span>
        </div>
        <div class="pl-axis"><svg aria-hidden="true"></svg></div>
      </div>
      <div class="po-chart" data-gate-scroll="own"></div>
      <details class="po-more bm-more">
        <summary><span class="sc">Evidence</span> rules and their pressure</summary>
        <div class="po-more-in" hidden>
        <p class="po-fn">Repeal, veto and court-block dates are not recorded, so those outcomes sit at 2026. State and city measures count toward their country.</p>
        <section class="po-press" aria-labelledby="po-press-h" hidden>
          <div class="po-press-head">
            <div><h3 id="po-press-h">Rules and their pressure</h3>
            <p class="po-press-dek">Four counts beside the rules: export-control actions on chips, national AI strategies, copyright suits against AI companies and reported incidents. The step line is the running total; bars count each year; a hatched bar is a year still in progress.</p></div>
          </div>
          <div class="po-press-grid"></div>
        </section>
        </div>
      </details>

    </div>`;
  const chart = el.querySelector('.po-chart'), axisSvg = d3.select(el.querySelector('.pl-axis svg'));
  // the glyph margin sits beside the head, above the full-width cartogram
  {
    const margin = document.createElement('div'); margin.className = 'po-margin';
    margin.appendChild(el.querySelector('.po-glyphs'));
    margin.appendChild(el.querySelector('.po-years'));           // the year bars and the as-of slider live in the margin too
    el.querySelector('.po-top').insertBefore(margin, el.querySelector('.po-map'));
  }
  // the headline says the meaning: whether binding rules in force outnumber the guidance and strategies in force
  {
    const live = all.filter((x) => x.status === 'in_force' || x.status === 'enacted');
    const bind = live.filter((x) => (PTYPE[x.type] || PTYPES[0]).fill).length, guide = live.length - bind;
    el.querySelector('.po-head').textContent = bind > guide ? 'Binding AI rules now outnumber guidance' : 'Guidance still outnumbers binding AI rules';
    el.querySelector('.po-srcline').textContent = `${bind} binding rules in force or enacted against ${guide} guidance documents; ${all.length} instruments from ${new Set(all.map((x) => x.jurisdiction)).size} jurisdictions, each linked to its primary text.`;
  }
  const countEl = el.querySelector('.pl-count'), statEl = el.querySelector('.po-stat'), placeEl = el.querySelector('.po-place');
  const tilesEl = el.querySelector('.po-tiles'), legEl = el.querySelector('.po-legend'), yrEl = el.querySelector('.po-yr'), hintEl = el.querySelector('.po-hint');
  const yearsEl = el.querySelector('.po-years'), yearsSvg = d3.select(yearsEl.querySelector('svg')), yearRange = yearsEl.querySelector('input');
  const issuesEl = el.querySelector('.po-issues');

  const win = () => { const a = S.y0 < 2010 ? 2016 : Math.min(S.y0, 2024); return [a, Math.max(a + 2, Math.min(NOW_T + 0.05, S.y1 + 1))]; };
  const asYear = () => Math.max(2010, Math.min(2026, S.y1));
  const textOk = (x) => { if (!S.q) return true; return S.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => x._txt.includes(t)); };
  const base = () => { const [a, z] = win(); return all.filter((x) => x.t1 >= a && x.t0 <= z && textOk(x) && issueOk(x)); };

  // the map is built once per width; each call repaints the fills, so a change of year morphs the colors in place
  let mapW = 0, mapKey = '';
  function drawMap() {
    const Y = asYear();
    yrEl.textContent = Y;
    el.querySelectorAll('[data-mm]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mm === mapMode)));
    const items = all.filter((x) => textOk(x) && issueOk(x));
    const by = d3.group(items, (x) => x.place);
    // first mover: the year a place's earliest instrument started, among those started by Y
    const firstYear = (v) => { const t = d3.min(v.filter((x) => asOf(x, Y)), (x) => x.t0); return t == null ? 0 : Math.max(2010, Math.floor(t)); };
    const val = (name) => {
      const v = by.get(name) || [];
      if (mapMode === 'count') return v.filter((x) => { const s = asOf(x, Y); return s && !TERMINAL.has(s); }).length;
      if (mapMode === 'first') return firstYear(v);
      return d3.max(v, (x) => strength(x, Y)) || 0;
    };
    const maxC = Math.max(1, d3.max([...tileSet, ...blocSet], (n) => (mapMode === 'count' ? val(n) : 0)) || 1);
    const cScale = d3.scaleSequentialSqrt([0, maxC], d3.interpolateRgb(GROUND_3, ULTRA));
    const years = mapMode === 'first' ? [...tileSet, ...blocSet].map(val).filter(Boolean) : [];
    const yMin = years.length ? d3.min(years) : 2010, yMax = Math.max(yMin + 1, Y);
    const fScale = d3.scaleSequential([yMin, yMax], d3.interpolateRgb('#DDE8E5', '#2B6973'));
    const color = (name) => { const v = val(name); if (mapMode === 'count') return v ? cScale(v) : null; if (mapMode === 'first') return v ? fScale(v) : null; return (STRENGTH.find((s) => s.v === v) || {}).color || null; };
    const W = tilesEl.clientWidth || 480;
    // tiles never go below 28px (a usable touch target); under 600px the geographic grid gives way to a 6-column
    // grid of 44px tiles in reading order (north to south, west to east), so every tile is on screen with no sideways scroll
    const phone = W < 600;
    const G = phone ? 4 : 2;
    const T = phone ? Math.max(40, Math.floor((W - 5 * G) / 6)) : Math.max(24, Math.min(36, Math.floor((W - 19 * G) / 20)));
    const COLS = phone ? 6 : 20;
    const key = `${W}|${(S.q || '')}|${issue}`;
    if (key !== mapKey) {
      mapKey = key; mapW = W;
      const order = TILES.slice().sort((a, b) => a[3] - b[3] || a[2] - b[2]);
      const rows = phone ? Math.ceil(order.length / COLS) : 8, mh = rows * (T + G);
      const bw = Math.max(T * 1.9, 44);
      const perRow = Math.max(1, Math.floor((W + G) / (bw + G)));
      const bh = Math.ceil(BLOCS.length / perRow) * (T + G);
      const H = mh + 10 + bh;
      tilesEl.innerHTML = '';
      const SW = phone ? W : Math.max(W, COLS * (T + G));
      const svg = d3.select(tilesEl).append('svg').attr('width', SW).attr('height', H).attr('viewBox', `0 0 ${SW} ${H}`).attr('role', 'group');
      svg.append('defs').html(`<pattern id="po-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${GROUND_2}"/><line x1="0" y1="0" x2="0" y2="4" stroke="${HATCH}" stroke-width="1.1"/></pattern>`);
      const ox = phone ? 0 : Math.max(0, (SW - COLS * (T + G)) / 2);
      const tile = (g, name, ab, x, y, w) => {
        const has = by.has(name), n = (by.get(name) || []).length;
        const gg = g.append('g').attr('class', 'po-tile' + (has ? '' : ' none')).attr('transform', `translate(${x},${y})`).attr('data-place', name);
        gg.append('rect').attr('width', w).attr('height', T).attr('fill', has ? GROUND_2 : 'transparent').attr('stroke', has ? 'var(--rule-strong)' : 'var(--rule)').attr('stroke-dasharray', has ? null : '2 2');
        gg.append('text').attr('x', w / 2).attr('y', T / 2 + 3.5).attr('text-anchor', 'middle').attr('class', 'po-ab').attr('fill', has ? 'var(--ink)' : 'var(--ink-3)').text(w < ab.length * 6 + 4 ? ab.slice(0, 3) : ab);
        if (has) {
          gg.attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${name}: ${n} record${n === 1 ? '' : 's'}`)
            .on('click', () => togglePlace(name))
            .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); togglePlace(name); } })
            .on('mouseenter', (ev) => { if (!coarse()) tip.show(ev, tileTip(name, by.get(name), asYear())); }).on('mousemove', tip.move).on('mouseleave', () => tip.hide());
        }
      };
      const gm = svg.append('g');
      order.forEach(([n, ab, c, r], i) => tile(gm, n, ab, phone ? (i % COLS) * (T + G) : ox + c * (T + G), phone ? Math.floor(i / COLS) * (T + G) : r * (T + G), T));
      const gb = svg.append('g').attr('transform', `translate(0,${mh + 10})`);
      BLOCS.forEach(([n, ab], i) => tile(gb, n, ab, (i % perRow) * (bw + G), Math.floor(i / perRow) * (T + G), bw));
      // places with records but no tile would be lost; none expected, but list them for safety
      const missing = [...by.keys()].filter((n) => !tileSet.has(n) && !blocSet.has(n));
      if (missing.length) console.warn('policy: no tile for', missing);
    }
    // paint: fills follow the year; the CSS transition carries each tile from its old color to its new one
    d3.select(tilesEl).select('svg').attr('aria-label', `Map of policy activity as of ${Y}`);
    d3.select(tilesEl).selectAll('.po-tile').each(function () {
      const name = this.dataset.place, has = by.has(name), c = color(name);
      const t = d3.select(this);
      t.classed('on', places.has(name)).classed('dim', !places.has(name) && places.size > 0);
      if (has) t.attr('aria-pressed', String(places.has(name)));
      const sv = mapMode === 'strict' ? STRENGTH.find((s) => s.v === val(name)) : null;
      t.select('rect').attr('fill', sv && sv.hatch ? 'url(#po-hatch)' : c || (has ? GROUND_2 : 'transparent'))
        .attr('stroke', sv && sv.outline ? sv.outline : has ? 'var(--rule-strong)' : 'var(--rule)').attr('stroke-width', sv && sv.outline ? 1.6 : 1);
      const dark = c && (mapMode === 'count' ? val(name) / maxC > 0.4 : mapMode === 'first' ? (val(name) - yMin) / (yMax - yMin) < 0.5 : val(name) >= 3);
      t.select('text').attr('fill', dark ? '#f7f7f5' : has ? 'var(--ink)' : 'var(--ink-3)');
    });
    legEl.innerHTML = mapMode === 'count'
      ? `<span class="po-ramp" style="background:linear-gradient(90deg, ${cScale(0.0001)}, ${cScale(maxC)})"></span><span class="po-rl">1</span><span class="po-rl r">${maxC} active instruments</span>`
      : mapMode === 'first'
        ? `<span class="po-ramp" style="background:linear-gradient(90deg, ${fScale(yMin)}, ${fScale(yMax)})"></span><span class="po-rl">first instrument ${yMin}</span><span class="po-rl r">${yMax}</span>`
        : '';
    drawYears(items, Y);
  }
  // the straight comparison beside the map: how many instruments started each year, with the as-of year marked;
  // drag across the bars, or use the slider, to move the year
  function drawYears(items, Y) {
    const counts = YEARS.map((y) => ({ y, n: items.filter((x) => Math.floor(x.t0) === y).length }));
    const W = yearsEl.clientWidth || 480, H = 54, L = 0, R = 0, top = 12, base = H - 14;
    const x = d3.scaleBand().domain(YEARS).range([L, W - R]).paddingInner(0.18);
    const yS = d3.scaleLinear().domain([0, Math.max(1, d3.max(counts, (c) => c.n))]).range([0, base - top]);
    yearsSvg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    yearsSvg.selectAll('*').remove();
    yearsSvg.append('line').attr('x1', L).attr('x2', W - R).attr('y1', base + 0.5).attr('y2', base + 0.5).attr('stroke', 'var(--rule-strong)');
    const g = yearsSvg.selectAll('g').data(counts).join('g');
    g.append('rect').attr('class', (d) => 'po-ybar' + (d.y === Y ? ' cur' : d.y > Y ? ' later' : '')).attr('x', (d) => x(d.y)).attr('width', x.bandwidth()).attr('y', (d) => base - Math.max(d.n ? 1.5 : 0, yS(d.n))).attr('height', (d) => Math.max(d.n ? 1.5 : 0, yS(d.n)));
    g.append('text').attr('class', (d) => 'po-ycount' + (d.y === Y ? ' cur' : '')).attr('x', (d) => x(d.y) + x.bandwidth() / 2).attr('y', (d) => base - Math.max(d.n ? 1.5 : 0, yS(d.n)) - 3).attr('text-anchor', 'middle').text((d) => (d.n ? d.n : ''));
    g.append('text').attr('class', (d) => 'po-yyr' + (d.y === Y ? ' cur' : '')).attr('x', (d) => x(d.y) + x.bandwidth() / 2).attr('y', H - 2).attr('text-anchor', 'middle').text((d) => (W < 420 && d.y % 2 ? '' : String(d.y).slice(2)));
    yearsSvg.append('line').attr('class', 'po-ymark').attr('x1', x(Y) + x.bandwidth() + 1.5).attr('x2', x(Y) + x.bandwidth() + 1.5).attr('y1', 2).attr('y2', base + 4);
    const started = d3.sum(counts.filter((c) => c.y <= Y), (c) => c.n);
    yearsEl.querySelector('.po-years-n').textContent = `(${started} by the end of ${Y})`;
    yearRange.value = Y;
    const pick = (ev) => { const px = ev.clientX - yearsEl.querySelector('svg').getBoundingClientRect().left; const i = Math.max(0, Math.min(YEARS.length - 1, Math.floor((px - L) / ((W - L - R) / YEARS.length)))); return YEARS[i]; };
    const svgEl = yearsEl.querySelector('svg');
    svgEl.onpointerdown = (ev) => { svgEl.setPointerCapture(ev.pointerId); setYear(pick(ev)); };
    svgEl.onpointermove = (ev) => { if (ev.buttons) setYear(pick(ev)); };
  }
  function setYear(Y) {
    if (Y === asYear()) return;
    const patch = { y1: Y };
    if (S.y0 > Y) patch.y0 = Y;
    set(patch);
  }
  yearRange.addEventListener('input', () => setYear(+yearRange.value));
  function tileTip(name, v, Y) {
    const st = d3.rollups(v, (a) => a.length, (x) => asOf(x, Y) || 'later').sort((a, b) => b[1] - a[1]);
    const first = v.filter((x) => asOf(x, Y)).sort((p, q) => p.t0 - q.t0)[0];
    const fl = first ? ` &middot; first: ${esc(first.title.length > 60 ? first.title.slice(0, 57).replace(/\s+\S*$/, '') + '\u2026' : first.title)} (${Math.floor(first.t0)})` : '';
    return `<div class="k">${esc(name)} &middot; as of ${Y}</div><div class="h">${v.length} record${v.length === 1 ? '' : 's'}</div><div class="m">${st.map(([k, n]) => `${n} ${esc(k === 'later' ? 'not yet started' : (PSTAT[k]?.label || k).toLowerCase())}`).join(', ')}${fl} &middot; ${places.has(name) ? 'click to drop' : places.size ? 'click to add' : 'click to filter'}</div>`;
  }

  function drawIssues() {
    if (!ISSUES.length) return;
    const [a, z] = win();
    const inWin = all.filter((x) => x.t1 >= a && x.t0 <= z && textOk(x));
    const n = (id) => inWin.filter((x) => (issueOf.get(x.key || x.id) || []).includes(id)).length;
    issuesEl.hidden = false;
    issuesEl.innerHTML = `<label class="po-subject"><span class="sc">Subject</span><select aria-label="Subject"><option value="">All subjects (${inWin.length})</option>${ISSUES.map((i) => `<option value="${esc(i.id)}"${issue === i.id ? ' selected' : ''}>${esc(i.label)} (${n(i.id)})</option>`).join('')}</select></label>`;
    issuesEl.querySelector('select').addEventListener('change', (ev) => setIssue(ev.target.value));
  }
  function draw() {
    drawIssues();
    drawMap();
    const list0 = base().filter((x) => !places.size || places.has(x.place));
    const sc = d3.rollup(list0, (v) => v.length, (x) => x.status);
    // the chips are filters, not a legend: a label and a count in ink; the marks carry the encoding
    statEl.innerHTML = PSTATUS.map((s) => `<button type="button" data-st="${s.id}" aria-pressed="${!hidden.has(s.id)}">${s.label}<b>${sc.get(s.id) || 0}</b></button>`).join('');
    const nPlace = all.filter((x) => places.has(x.place)).length;
    const pl = [...places];
    placeEl.innerHTML = pl.length
      ? `<span class="po-show"><span class="sc">${pl.length > 1 ? 'Comparing' : 'Showing'}</span>${pl.map((p) => `<button type="button" class="po-chip" data-unplace="${esc(p)}" aria-label="Drop ${esc(p)}">${esc(p)}<span aria-hidden="true">&times;</span></button>`).join('')}<span class="n">${list0.length} of ${nPlace} in these years</span>${pl.length > 1 ? `<button type="button" class="po-chip reset" data-clearplace="1">Reset</button>` : ''}</span>`
      : `<span class="po-show muted"><span class="sc">Showing</span><b>all places</b></span>`;
    hintEl.innerHTML = pl.length > 1
      ? `Timeline puts ${pl.map((p) => `<b>${esc(p)}</b>`).join(', ')} first; other places follow, dimmed.`
      : pl.length ? `Timeline puts <b>${esc(pl[0])}</b> first${/United States|China/.test(pl[0]) ? ', with its state and city measures' : ''}; other places follow, dimmed.` : '';
    const list = list0.filter((x) => !hidden.has(x.status));
    // with a place selected, the other places stay below, dimmed, so the selected rows are seen moving to the top
    const rest = places.size ? base().filter((x) => !places.has(x.place) && !hidden.has(x.status)) : [];
    const [a, z] = win();
    // the count says what the map holds; a record whose place has no tile is named rather than silently counted as placed
    const unplaced = list.filter((x) => !tileSet.has(x.place) && !blocSet.has(x.place));
    const span = `${Math.floor(a)} to ${Math.min(2026, Math.ceil(z) - 1)}`;
    const subj = issue ? ` on ${esc(issueLabel(issue).toLowerCase())}` : '';
    countEl.innerHTML = unplaced.length
      ? `<b>${list.length}</b> of ${all.length} instruments${subj}, ${span}; ${list.length - unplaced.length} on the map, ${unplaced.length} elsewhere (${[...new Set(unplaced.map((x) => x.place))].sort().join(', ')})`
      : `<b>${list.length}</b> of ${all.length} instruments${subj}, ${span}`;
    const W = chart.clientWidth || el.clientWidth;
    const mobile = W < 700;
    const LW = mobile ? 118 : 200, R = mobile ? 10 : 20;
    const x = d3.scaleLinear().domain([a, z]).range([LW + 10, W - R]);
    // axis
    const AH = 26;
    axisSvg.attr('width', W).attr('height', AH).attr('viewBox', `0 0 ${W} ${AH}`);
    axisSvg.selectAll('*').remove();
    const px = x(a + 1) - x(a), stepY = [1, 2, 5].find((k) => k * px >= 38) || 5;
    const ticks = d3.range(Math.ceil(a / stepY) * stepY, z + 0.01, stepY).filter((t) => x(t) <= W - R + 1);
    axisSvg.append('line').attr('x1', LW + 10).attr('x2', W - R).attr('y1', AH - 1).attr('y2', AH - 1).attr('stroke', 'var(--rule-strong)');
    ticks.forEach((t) => { axisSvg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', AH - 6).attr('y2', AH - 1).attr('stroke', 'var(--rule-strong)'); const tight = x(t) - LW < 18; axisSvg.append('text').attr('class', 'tick-label').attr('x', tight ? x(t) + 3 : x(t)).attr('y', AH - 10).attr('text-anchor', tight ? 'start' : 'middle').text(t); });
    // running head of the record: the three role-fixed columns are named where they sit
    axisSvg.append('text').attr('class', 'tick-label').attr('x', 0).attr('y', AH - 10).text('jurisdiction');
    if (!mobile) axisSvg.append('text').attr('class', 'tick-label').attr('x', LW - 24).attr('y', AH - 10).attr('text-anchor', 'end').text('level');
    axisSvg.append('text').attr('class', 'tick-label').attr('x', LW - 6).attr('y', AH - 10).attr('text-anchor', 'end').text('n');
    axisSvg.append('line').attr('x1', 0).attr('x2', LW).attr('y1', AH - 1).attr('y2', AH - 1).attr('stroke', 'var(--rule-strong)');

    // positions before the rebuild, so rows that persist can move to their new place instead of reappearing
    const prevRow = new Map(), prevHead = new Map();
    chart.querySelectorAll('.po-row[data-k]').forEach((n) => prevRow.set(n.dataset.k, +n.dataset.y));
    chart.querySelectorAll('.po-ghead[data-g]').forEach((n) => prevHead.set(n.dataset.g, +n.dataset.y));
    const introOpen = document.body.classList.contains('intro-open');
    const morph = !RM() && !introOpen && prevRow.size > 0, enter = !RM() && !introOpen;
    chart.innerHTML = '';
    if (!list.length) {
      chart.innerHTML = `<div class="pl-empty"><h3>No instruments match</h3><p>${list0.length ? 'Every status in this selection is switched off.' : 'None fall in these years with this search or place.'}</p><button type="button" class="btn-ghost" data-reset="1">Show everything</button></div>`;
      return;
    }
    // rows: region, then level, then volume
    const toRows = (xs) => d3.groups(xs, (x) => x.jurisdiction).map(([j, v]) => ({ j, v, region: v[0].region, level: v[0].level, place: v[0].place }));
    const byJ = toRows(list), byJRest = toRows(rest);
    const sortRows = (rows) => rows.sort((p, q) => (LEVEL_RANK[p.level] ?? 1) - (LEVEL_RANK[q.level] ?? 1) || q.v.length - p.v.length || p.j.localeCompare(q.j));
    const groups = (places.size
      ? [...places].map((pn) => ({ r: pn, rows: sortRows(byJ.filter((d) => d.place === pn)) })).filter((g) => g.rows.length)
      : REGIONS.map((r) => ({ r, rows: sortRows(byJ.filter((d) => d.region === r)) })).filter((g) => g.rows.length))
      .concat(REGIONS.map((r) => ({ r, rest: true, rows: sortRows(byJRest.filter((d) => d.region === r)) })).filter((g) => g.rows.length));
    const SL = 14, GH = 30;
    const LF = mobile ? '400 11.5px Instrument Sans, serif' : '400 13px Instrument Sans, serif';
    let y = 4;
    const heads = [], rows = [];
    for (const g of groups) {
      heads.push({ g, y }); y += GH;
      for (const r of g.rows) {
        // pack marks into sub-lanes so nothing overlaps
        const lanesEnd = [];
        const items = r.v.slice().sort((p, q) => p.t0 - q.t0);
        for (const it of items) {
          const s = Math.min(x(Math.max(a, it.t0)), x(Math.max(a, Math.min(z, it.t))) - 6) - 2, e = Math.max(x(Math.min(z, it.t1)), x(Math.max(a, Math.min(z, it.t))) + 6) + 2;
          let k = lanesEnd.findIndex((end) => end < s);
          if (k < 0) { k = lanesEnd.length; lanesEnd.push(e); } else lanesEnd[k] = e;
          it._lane = k;
        }
        // the jurisdiction name wraps onto up to three lines rather than being cut; the row grows to hold it
        const subR = r.level === 'state' || r.level === 'city';
        const tagR = subR ? r.level : r.level === 'supranational' || r.level === 'international' ? 'intl' : '';
        ctx.font = '400 9.5px "Instrument Sans", sans-serif';
        const twR = tagR ? ctx.measureText(tagR).width + 6 : 0;
        // on narrow screens the level tag moves under the name, so the name keeps the whole gutter
        const lines = wrapMeasured(ctx, r.j, LW - (subR ? 10 : 0) - (mobile ? 0 : twR) - 24, LF, 3);
        const h = Math.max(Math.max(1, lanesEnd.length) * SL + 6, lines.length * 12 + (mobile && tagR ? 12 : 0) + 4);
        rows.push({ ...r, y, h, items, lines, rest: !!g.rest });
        y += h;
      }
      y += 6;
    }
    const H = y + 20;
    const svg = d3.select(chart).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', `Policy atlas, ${list.length} instruments`).classed('po-anim', morph);
    svg.append('defs').html(`<pattern id="po-hatch-t" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="${GROUND_2}"/><line x1="0" y1="0" x2="0" y2="3" stroke="${HATCH}" stroke-width="1"/></pattern>`);
    const grid = svg.append('g');
    ticks.forEach((t) => grid.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', H).attr('stroke', 'var(--rule)').attr('stroke-width', 0.6));
    // Archive Index: records appear top to bottom at 80ms intervals (one row band at a time); past the first screen they land together
    const rowDelay = (y) => `${Math.min(Math.round(y / 24), 30) * 80}ms`;
    const place = (sel, y0, y1) => { sel.attr('data-y', y1); if (y0 != null && y0 !== y1) { sel.style('transform', `translate(0,${y0}px)`); sel.node().getBoundingClientRect(); } sel.style('transform', `translate(0,${y1}px)`); };
    heads.forEach(({ g, y: hy }) => {
      const gg = svg.append('g').attr('class', 'po-ghead' + (g.rest ? ' po-rest' : '')).attr('data-g', g.r + (g.rest ? '|rest' : ''));
      const wasH = prevHead.get(g.r + (g.rest ? '|rest' : ''));
      place(gg, morph ? wasH : null, hy);
      if (enter && (wasH == null || !morph)) gg.classed('in', true).style('--d', rowDelay(hy));
      gg.append('line').attr('x1', 0).attr('x2', W).attr('y1', 0.5).attr('y2', 0.5).attr('stroke', 'var(--rule-strong)');
      const nm = gg.append('text').attr('class', 'pl-gh').attr('x', 0).attr('y', 21).text(g.r);
      ctx.font = '400 19px "Instrument Serif", serif';
      const nw = ctx.measureText(g.r).width, cnt = d3.sum(g.rows, (r) => r.v.length);
      // the count sits at the gutter's right edge, or runs on after the name (same text element, so it cannot collide) when the gutter is too narrow for both
      if (nw + 34 > LW - 6) nm.append('tspan').attr('class', 'pl-gn').attr('dx', 8).text(cnt);
      else gg.append('text').attr('class', 'pl-gn').attr('x', LW - 6).attr('y', 20).attr('text-anchor', 'end').text(cnt);
    });
    const xa = x(a), xw = Math.max(1, x(z) - xa);
    for (const r of rows) {
      const gg = svg.append('g').attr('class', 'po-row' + (r.rest ? ' po-rest' : '')).attr('data-k', r.j);
      const was = prevRow.get(r.j);
      place(gg, morph ? was : null, r.y);
      // a row that was not on screen before appears in its turn; a row that moved travels with its marks
      const fresh = enter && (was == null || !morph);
      if (fresh) gg.classed('in', true).style('--d', rowDelay(r.y));
      gg.append('line').attr('x1', 0).attr('x2', W).attr('y1', r.h - 0.5).attr('y2', r.h - 0.5).attr('stroke', 'var(--rule)');
      const sub = r.level === 'state' || r.level === 'city';
      const tag = sub ? r.level : r.level === 'supranational' || r.level === 'international' ? 'intl' : '';
      const ind = sub ? 10 : 0;
      ctx.font = '400 9.5px "Instrument Sans", sans-serif';
      const tw = tag ? ctx.measureText(tag).width + 6 : 0;
      tspans(gg.append('text').attr('class', 'po-jl' + (sub ? ' sub' : '')).attr('x', ind).attr('y', 11), r.lines, ind, 12);
      if (tag && mobile) gg.append('text').attr('class', 'po-lv').attr('x', ind).attr('y', 11 + r.lines.length * 12).text(tag);
      else if (tag) gg.append('text').attr('class', 'po-lv').attr('x', LW - 24).attr('y', 10.5).attr('text-anchor', 'end').text(tag);
      gg.append('text').attr('class', 'pl-gn').attr('x', LW - 6).attr('y', 11).attr('text-anchor', 'end').text(r.v.length);
      for (const it of r.items) {
        const cy = 3 + it._lane * SL + SL / 2, st = PSTAT[it.status] || PSTATUS[0], ty = PTYPE[it.type] || PTYPES[0];
        const g2 = gg.append('g').attr('class', 'po-mk').attr('data-id', it.id).attr('tabindex', 0).attr('role', 'button')
          .attr('aria-label', `${it.jurisdiction}: ${it.title}. ${ty.label}, ${st.label}.`)
          .on('mouseenter', (ev) => { tip.show(ev, markTip(it)); mark(it.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); })
          .on('focus', () => mark(it.id)).on('blur', () => mark())
          .on('click', () => select(it.id)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(it.id); } });
        const x0 = x(Math.max(a, it.t0)), x1 = x(Math.min(z, it.t1)), xk = x(Math.max(a, Math.min(z, it.t)));
        g2.append('rect').attr('class', 'hit').attr('x', Math.min(x0, xk - 6) - 2).attr('y', cy - 6).attr('width', Math.max(x1, xk + 6) - Math.min(x0, xk - 6) + 4).attr('height', 12);
        if (x1 - x0 > 1) g2.append('line').attr('x1', x0).attr('x2', x1).attr('y1', cy).attr('y2', cy).attr('stroke', st.color).attr('stroke-width', 1.3).attr('stroke-opacity', 0.7);
        if (it.t0 < a) g2.append('path').attr('d', `M${x0 + 4},${cy - 3}L${x0},${cy}L${x0 + 4},${cy + 3}`).attr('fill', 'none').attr('stroke', st.color).attr('stroke-width', 1.2);
        if (it.ti != null && it.ti >= a && Math.abs(x(it.ti) - xk) > 5) g2.append('circle').attr('cx', x(it.ti)).attr('cy', cy).attr('r', 1.8).attr('fill', st.color);
        if (it.tf != null && it.tf >= a && it.tf <= z && Math.abs(x(it.tf) - xk) > 5) g2.append('line').attr('x1', x(it.tf)).attr('x2', x(it.tf)).attr('y1', cy - 4.5).attr('y2', cy + 4.5).attr('stroke', st.color).attr('stroke-width', 1.6);
        // two shapes only: a filled disc binds, a hollow one does not; the type is written on the row when the mark is hovered or focused
        // the same encoding as the map: green darkens as rules bind, hollow while proposed, hatched once dead; a disc binds, a square does not
        const fill = st.hatch ? 'url(#po-hatch-t)' : st.hollow ? 'var(--ground)' : st.color, sw = st.hollow ? 1.5 : st.hatch ? 1 : 0.8;
        if (ty.fill) g2.append('circle').attr('class', 'gl').attr('cx', xk).attr('cy', cy).attr('r', 4).attr('fill', fill).attr('stroke', st.color).attr('stroke-width', sw);
        else g2.append('rect').attr('class', 'gl').attr('x', xk - 3.5).attr('y', cy - 3.5).attr('width', 7).attr('height', 7).attr('fill', fill).attr('stroke', st.color).attr('stroke-width', sw);
        const flip = xk > xa + xw * 0.62, off = TERMINAL.has(it.status) ? 16 : 9, lbl = `${ty.label} \u00b7 ${it.title.length > 64 ? it.title.slice(0, 61).replace(/\s+\S*$/, '') + '\u2026' : it.title}`;
        g2.append('text').attr('class', 'po-inl').attr('x', flip ? xk - off : xk + off).attr('y', cy + 3.5).attr('text-anchor', flip ? 'end' : 'start').text(lbl);
        if (TERMINAL.has(it.status)) g2.append('path').attr('d', `M${xk + 6},${cy - 3}l4,6M${xk + 10},${cy - 3}l-4,6`).attr('stroke', 'var(--ink-3)').attr('stroke-width', 1.3);
        // the one human mark on the page: a red circle around the selected or hovered entry
        g2.append('circle').attr('class', 'po-ring').attr('cx', xk).attr('cy', cy).attr('r', 7.5);
      }
    }
    mark();
  }
  function markTip(it) {
    const st = PSTAT[it.status] || PSTATUS[0];
    const d = [['introduced', it.date_introduced], ['enacted', it.date_enacted], ['in force', it.date_in_force]].filter((p) => p[1]).map((p) => `${p[0]} ${String(p[1]).slice(0, 7)}`).join(', ');
    // the type and name are written on the row while the mark is hovered, so the tip carries only status, place and dates
    return `<div class="k"><i style="${pswatch(st)}"></i>${esc(st.label)} &middot; ${esc(it.jurisdiction)}</div><div class="m">${esc(d)} &middot; click to open</div>`;
  }
  function mark(id) {
    const cur = id || hiId || (S.sel && S.sel.startsWith('policy:') ? S.sel : null);
    // the hovered mark's name is copied to a top layer of the svg, so it is never drawn under neighbouring marks
    const svg = chart.querySelector('svg');
    if (svg) svg.querySelectorAll(':scope > .po-inl').forEach((n) => n.remove());
    chart.querySelectorAll('.po-mk').forEach((n) => {
      const on = n.dataset.id === cur; n.classList.toggle('hi', on);
      const t = on && svg && n.querySelector('.po-inl');
      if (t) { const c = t.cloneNode(true), m = n.getCTM(), r = svg.getCTM(); c.classList.add('top'); c.setAttribute('transform', `translate(${m.e - r.e},${m.f - r.f})`); svg.appendChild(c); }
    });
  }
  function togglePlace(name) { if (places.has(name)) places.delete(name); else places.add(name); draw(); }

  /* ---------- rules and their pressure: four small multiples from series_v3 ---------- */
  const pressEl = el.querySelector('.po-press'), pressGrid = el.querySelector('.po-press-grid');
  const PRESS = [
    ['chip_export_controls', 'Chip export controls', 'US and allied actions', 'dated actions'],
    ['national_ai_strategies', 'National AI strategies', 'released per year', 'strategies'],
    ['ai_copyright_lawsuits', 'AI copyright suits', 'filed per year', 'cases'],
    ['ai_incidents', 'Reported AI incidents', 'per year', 'incidents'],
  ];
  let pressData = null, pressDrawn = false;
  el.querySelector('.po-more').addEventListener('toggle', (ev) => { const d = ev.currentTarget; el.querySelector('.po-more-in').hidden = !d.open; if (d.open && pressData && !pressDrawn) drawPress(); });
  const ACTOR_PLACE = { US: 'United States', Netherlands: 'Netherlands', Japan: 'Japan', EU: 'European Union' };
  const tOf = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
  const WORDS = (t) => new Set(String(t).toLowerCase().match(/[a-z]{6,}/g) || []);
  // an export-control action is linked to an atlas record when the dates sit within three weeks and the texts share a long word
  function linkAction(a) {
    const t = tOf(a.date), w = WORDS(a.action), place = ACTOR_PLACE[a.actor];
    let best = null, bd = Infinity;
    all.forEach((x) => {
      if (place && x.jurisdiction !== place) return;
      const near = [x.ti, x.te, x.tf].filter((v) => v != null).map((v) => Math.abs(v - t)).sort((p, q) => p - q)[0];
      if (near == null || near > 21 / 365) return;
      const shared = [...WORDS(x.title + ' ' + (x.summary || ''))].filter((k) => w.has(k)).length;
      if (shared && near < bd) { bd = near; best = x; }
    });
    return best;
  }
  const pressLast = (sr) => sr.last_reading ? String(sr.last_reading) : '';
  const isPartial = (sr, yr) => /partial/i.test(sr.last_reading || '') ? yr === Math.max(...sr.points.map((p) => Math.floor(typeof p[0] === 'number' ? p[0] : tOf(p[0])))) : (yr === 2026 && /^2026-/.test(sr.last_reading || ''));
  function drawPress() {
    if (!pressData) return;
    pressEl.hidden = false;
    const W = pressGrid.clientWidth; if (!W) return;
    const anim = !pressDrawn && !RM(); pressDrawn = true;
    const cols = W < 600 ? 1 : W < 1000 ? 2 : 4;
    const cw = Math.floor((W - (cols - 1) * 28) / cols), H = 150, M = { l: 30, r: 30, t: 10, b: 20 };
    pressGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    pressGrid.innerHTML = '';
    PRESS.forEach(([id, name, sub, unit], i) => {
      const sr = pressData.find((q) => q.id === id); if (!sr) return;
      const dated = typeof sr.points[0][0] === 'string';
      // per-year counts and the running total; export controls arrive as a cumulative count at dated actions
      const yearly = new Map();
      if (dated) sr.points.forEach((p) => { const y = Math.floor(tOf(p[0])); yearly.set(y, (yearly.get(y) || 0) + 1); });
      else sr.points.forEach((p) => yearly.set(p[0], p[1]));
      const years = [...yearly.keys()].sort((p, q) => p - q), y0 = years[0], y1 = years[years.length - 1];
      let run = 0; const cum = dated ? sr.points.map((p) => [tOf(p[0]), p[1]]) : years.map((y) => [y + 1, (run += yearly.get(y))]);
      const total = cum[cum.length - 1][1];
      const fig = document.createElement('figure'); fig.className = 'po-sm'; fig.style.setProperty('--d', `${i * 80}ms`);
      fig.innerHTML = `<figcaption><span class="po-sm-n sc">${String(i + 1).padStart(2, '0')}</span><span class="po-sm-name">${esc(name)} <small>${esc(sub)}</small></span><span class="po-sm-big"><b>${total.toLocaleString('en-US')}</b> <small>${esc(unit)} by ${esc(dated ? String(sr.points[sr.points.length - 1][0]).slice(0, 7) : String(y1))}${isPartial(sr, y1) ? ', partial' : ''}</small></span></figcaption>
        <div class="po-sm-svg"></div>
        <p class="po-sm-contract"><span class="sc">Encoding</span> bars count each year on the left scale; the step line is the running total on the right scale${dated ? ', stepping at each dated action' : ''}.</p>
        <footer class="po-sm-foot"><a href="${esc(sr.source_url)}" target="_blank" rel="noopener">${esc(host(sr.source_url))}</a><span>read ${esc(pressLast(sr))}</span></footer>`;
      pressGrid.appendChild(fig);
      const x = d3.scaleLinear().domain([y0, y1 + 1]).range([M.l, cw - M.r]);
      const yb = d3.scaleLinear().domain([0, Math.max(...yearly.values())]).nice().range([H - M.b, M.t]);
      const yc = d3.scaleLinear().domain([0, total]).nice().range([H - M.b, M.t]);
      const svg = d3.select(fig.querySelector('.po-sm-svg')).append('svg').attr('width', cw).attr('height', H).attr('role', 'group').attr('aria-label', `${name}: ${years.map((y) => `${y} ${yearly.get(y)}`).join(', ')}; ${total} in total`);
      svg.append('defs').append('pattern').attr('id', `po-hatch-${i}`).attr('width', 4).attr('height', 4).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)').append('line').attr('y2', 4).attr('stroke', 'var(--ink-3)').attr('stroke-width', 1);
      svg.append('line').attr('class', 'po-sm-base').attr('x1', M.l).attr('x2', cw - M.r).attr('y1', H - M.b).attr('y2', H - M.b);
      [yb.domain()[1]].forEach((v) => svg.append('text').attr('class', 'tick-label').attr('x', M.l - 4).attr('y', yb(v) + 3).attr('text-anchor', 'end').text(v));
      svg.append('text').attr('class', 'tick-label').attr('x', cw - M.r + 4).attr('y', yc(yc.domain()[1]) + 3).text(yc.domain()[1]);
      svg.append('text').attr('class', 'tick-label po-sm-cap').attr('x', M.l - 4).attr('y', H - M.b + 12).attr('text-anchor', 'end').text('yr');
      svg.append('text').attr('class', 'tick-label po-sm-cap').attr('x', cw - M.r + 4).attr('y', H - M.b + 12).text('total');
      const step = Math.max(1, Math.ceil((y1 - y0) / Math.max(2, Math.floor((cw - M.l - M.r) / 44))));
      years.filter((y) => (y - y0) % step === 0).forEach((y) => svg.append('text').attr('class', 'tick-label').attr('x', x(y + 0.5)).attr('y', H - 6).attr('text-anchor', 'middle').text(String(y).slice(2)));
      const bw = Math.max(2, x(y0 + 1) - x(y0) - 3);
      const bars = svg.append('g').selectAll('rect').data(years).join('rect').attr('class', (y) => 'po-sm-bar' + (isPartial(sr, y) ? ' partial' : '')).attr('x', (y) => x(y) + 1.5).attr('width', bw).attr('y', (y) => yb(yearly.get(y))).attr('height', (y) => H - M.b - yb(yearly.get(y))).attr('fill', (y) => (isPartial(sr, y) ? `url(#po-hatch-${i})` : null));
      bars.append('title').text((y) => `${y}: ${yearly.get(y)} ${unit}${isPartial(sr, y) ? ' (partial year)' : ''}`);
      const line = d3.line().x((d) => x(d[0])).y((d) => yc(d[1])).curve(d3.curveStepAfter);
      const pts = [[dated ? cum[0][0] : y0, 0], ...cum];
      if (!dated) pts.push([y1 + 1, total]);
      const path = svg.append('path').attr('class', 'po-sm-line').attr('d', line(pts) + (dated ? `H${x(Math.min(y1 + 1, NOW_T))}` : '')).attr('fill', 'none');
      if (anim) {
        const len = path.node().getTotalLength();
        path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().delay(i * 80 + 120).duration(700).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0).on('end', () => path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
        bars.attr('y', H - M.b).attr('height', 0).transition().delay(i * 80).duration(500).ease(d3.easeCubicOut).attr('y', (y) => yb(yearly.get(y))).attr('height', (y) => H - M.b - yb(yearly.get(y)));
      }
      if (dated) {
        // each dated action is a step mark; the linked atlas record lights while it is hovered
        const acts = (sr.detail || []).map((a, k) => ({ a, k, t: tOf(a.date), n: sr.points[k] ? sr.points[k][1] : k + 1, rec: linkAction(a) }));
        const gm = svg.append('g').selectAll('g').data(acts).join('g').attr('class', (d) => 'po-sm-act' + (d.rec ? ' linked' : '')).attr('transform', (d) => `translate(${x(d.t)},${yc(d.n)})`).attr('tabindex', 0).attr('role', (d) => (d.rec ? 'button' : 'img')).attr('aria-label', (d) => `${d.a.date}, ${d.a.actor}: ${d.a.action}${d.rec ? '; in this atlas as ' + d.rec.title : ''}`);
        gm.append('circle').attr('r', 2.6);
        gm.append('circle').attr('class', 'hit').attr('r', 12); // 24px target
        const tipAct = (d) => `<div class="k">${esc(d.a.date)} &middot; ${esc(d.a.actor)} &middot; action ${d.n} of ${acts.length}</div><div class="h">${esc(d.a.action)}</div><div class="m">${d.rec ? `in this atlas: ${esc(d.rec.title)}${d.rec.id === S.sel ? '' : ' &middot; click to open'}` : 'not among the atlas records'}</div>`;
        gm.on('mouseenter', (ev, d) => { tip.show(ev, tipAct(d)); if (d.rec) mark(d.rec.id); }).on('mousemove', tip.move).on('mouseleave', () => { tip.hide(); mark(); })
          .on('focus', (ev, d) => { if (d.rec) mark(d.rec.id); }).on('blur', () => mark())
          .on('click', (ev, d) => { if (d.rec) select(d.rec.id); }).on('keydown', (ev, d) => { if (d.rec && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); select(d.rec.id); } });
        if (anim) gm.style('opacity', 0).transition().delay((d, k) => i * 80 + 120 + 700 * (k + 1) / acts.length).duration(120).style('opacity', null);
      }
    });
  }
  // the subject map is optional and fetched only once the build lists it; the deep link #issue= is read once it has loaded
  const man = db.manifest || {};
  if ((Array.isArray(man.optional) && man.optional.includes('policy_issue_map.json')) || (man.sizes && man.sizes['policy_issue_map.json'] != null)) {
    fetch(`data/policy_issue_map.json${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.issues)) return;
        ISSUES = j.issues.filter((i) => i && i.id && i.label); issueAlias = j.alias || {}; issueOf = new Map(Object.entries(j.map || {}));
        const want = hashIssue();
        issue = ISSUES.some((i) => i.id === want) ? want : '';
        draw();
      }).catch(() => {});
    // the store rewrites the hash without this key, so only a hash that names a subject changes the filter
    addEventListener('hashchange', () => { if (!ISSUES.length || !new URLSearchParams(location.hash.slice(1)).has('issue')) return; const want = hashIssue(); const next = ISSUES.some((i) => i.id === want) ? want : ''; if (next !== issue) { issue = next; draw(); } });
  }
  if ((Array.isArray(man.optional) && man.optional.includes('series_v3.json')) || (man.sizes && man.sizes['series_v3.json'] != null)) {
    fetch(`data/series_v3.json${man.version ? `?v=${encodeURIComponent(man.version)}` : ''}`).then((r) => (r.ok ? r.json() : null))
      .then((j) => { pressData = j && Array.isArray(j.series) ? j.series : Array.isArray(j) ? j : null; if (pressData) drawPress(); }).catch(() => {});
  }

  // a deep link opens behind the arrival overlay; once it closes, a chart already in view gets its entrance
  addEventListener('histomap:intro-closed', () => { const r = chart.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) draw(); }, { once: true });
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.issue != null) setIssue(b.dataset.issue === issue ? '' : b.dataset.issue);
    else if (b.dataset.st) { const s = b.dataset.st; if (hidden.has(s)) hidden.delete(s); else hidden.add(s); if (hidden.size === PSTATUS.length) hidden.clear(); draw(); }
    else if (b.dataset.mm) { mapMode = b.dataset.mm; drawMap(); }
    else if (b.dataset.unplace) togglePlace(b.dataset.unplace);
    else if (b.dataset.clearplace) { places.clear(); draw(); }
    else if (b.dataset.reset) { hidden.clear(); places.clear(); if (issue) { issue = ''; writeIssue(); } if (S.q) set({ q: '' }); else draw(); }
  });

  return {
    render(state, ch) {
      if (ch.has('*') || ch.has('y0') || ch.has('y1') || ch.has('q')) draw();
      else if (ch.has('sel')) mark();
      if (pressData && !pressDrawn) drawPress();
    },
    resize() { draw(); drawPress(); },
    hover(id) {
      hiId = id && String(id).startsWith('policy:') ? id : null;
      mark();
      if (hiId && S.tour) { const n = chart.querySelector(`.po-mk[data-id="${CSS.escape(hiId)}"]`); if (n) { const r = n.getBoundingClientRect(), vr = el.getBoundingClientRect(); el.scrollTo({ top: Math.max(0, el.scrollTop + r.top - vr.top - el.clientHeight * 0.4), behavior: 'smooth' }); } }
    },
  };
}
