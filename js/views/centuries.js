// CENTURIES: a correlated chart set as a Zurich timetable. Eleven equal columns, one per century, 1000s to 2000s.
// Inside each column all nine regions stand side by side as vertical bands, each as wide as its share of every event
// the record holds for that century; landmarks are the titles inside. Under six events in a cell is hatched (thin record).
// Reads only year, region and the landmark flag from the events. A tapped century, or a band, opens its full register
// (every event, landmark or not) as a list in the evidence panel. Nine regions appear as nine; no region leads.
// Techniques travel: where a landmark technique appears in one region and the record later shows it in use in another,
// the arrival is marked in the later band with a short leader, joined to where the record first has it.
import { esc, openList, roving } from '../ui.js';
import { REGION } from '../time.js';

// west to east, the order of the correlated charts; Global stands apart at the right
const ORDER = ['north-america', 'latin-america', 'europe', 'africa', 'middle-east', 'south-asia', 'east-asia', 'oceania', 'global'];
const NAME = { 'north-america': 'North America', 'latin-america': 'Latin America', europe: 'Europe', africa: 'Africa', 'middle-east': 'Middle East', 'south-asia': 'South Asia', 'east-asia': 'East Asia', oceania: 'Oceania', global: 'Global' };
const C0 = 1000, C1 = 2000;
const CENTS = Array.from({ length: (C1 - C0) / 100 + 1 }, (_, i) => C0 + i * 100);
const THIN = 6;
// nine regions in nine hue families, three steps each from pale to deep, on one warm undertone. These serve only when
// css/palette.css is missing; its --h-region-* hues are the page's. The step a band takes is how dense the
// record is in that cell: under 6 events the palest (and hatched), then 6 to 29, then 30 and more.
const HUES = {
  'north-america': ['#dde3ea', '#6f8cab', '#3f5d80'],
  'latin-america': ['#e2e8d5', '#8ba668', '#58773a'],
  europe: ['#efdcd5', '#c0735f', '#8c4434'],
  africa: ['#f1dfcf', '#cf8550', '#955428'],
  'middle-east': ['#f1e8cb', '#c9a94b', '#8a7022'],
  'south-asia': ['#f0dce3', '#c07090', '#87405e'],
  'east-asia': ['#e5dcea', '#9371ad', '#634485'],
  oceania: ['#d8e9e5', '#62a69a', '#2f7266'],
  global: ['#e4e1dc', '#928c82', '#615c54'],
};
const STEP = (n) => (n < THIN ? 0 : n < 30 ? 1 : 2);
const INK = '#17171a', LIGHT = '#f8f6f1';
// the record's own events for each travelling technique: where it first appears, then each later arrival in use,
// in its own region (wooden type in China, metal type in Goryeo, hwacha in Joseon) as well as beyond it.
// Only pairs the record holds are drawn; a missing id drops its mark. Paper, compass, astrolabe and double-entry have
// no arrival in another region within 1000 to 2099 in the record, so they draw nothing.
const TRAVEL = [
  { name: 'printing', from: 'bi-sheng-movable-type-1040', to: ['wang-zhen-wooden-movable-type-1313', 'jikji-metal-type-1377-1377', 'gutenberg-press-1450', 'mexico-city-printing-press-1539', 'stephen-daye-press-1638'] },
  { name: 'gunpowder', from: 'wujing-zongyao-gunpowder-1044', to: ['milemete-cannon-1326', 'hwacha-rocket-launcher-1451', 'fall-of-constantinople-orban-cannon-1453', 'first-battle-of-panipat-1526', 'tanegashima-arquebus-1543'] },
];
const GROT = "'Instrument Serif', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduced-motion');

export default function centuries(el, { db, select, tip }) {
  el.classList.add('cy');
  // the shared palette (css/palette.css, from data/palette.json history.regions): one base hex per region, stepped here
  // toward History's ground; the fallback families above serve a build without it
  const css = getComputedStyle(document.documentElement);
  const ground = css.getPropertyValue('--h-ground').trim() || '#f8f6f1';
  const hues = {};
  for (const r of ORDER) {
    // three density steps: the palette's own --h-region-<id>-1..3 when it sets them, else the base stepped toward the ground
    const st = [1, 2, 3].map((k) => css.getPropertyValue(`--h-region-${r}-${k}`).trim());
    const v = css.getPropertyValue(`--h-region-${r}`).trim();
    hues[r] = st.every((x) => /^#/.test(x)) ? st : /^#/.test(v) ? [0.24, 0.58, 1].map((t) => d3.color(d3.interpolateLab(ground, v)(t)).formatHex()) : HUES[r];
  }
  const lum = (h) => { const c = d3.rgb(h); const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bandFill = (r, cl) => hues[r][STEP(cl.all.length)];
  const bandInk = (r, cl) => { const f = bandFill(r, cl); return ratio(f, INK) >= ratio(f, LIGHT) ? INK : LIGHT; };
  el.innerHTML = `<div class="cy-wrap">
    <header class="cy-head"><h2 class="cy-hl"></h2></header>
    <div class="cy-chart"></div>
    <p class="cy-foot"></p>
  </div>`;
  const hl = el.querySelector('.cy-hl'), chart = el.querySelector('.cy-chart'), foot = el.querySelector('.cy-foot');
  roving(el, '.cy-chart [role="button"]');

  // ---- the counts: landmarks per century and region (the widths), every event per cell (the thin mark and the register)
  const centOf = (y) => Math.floor(y / 100) * 100;
  let cells = null;
  function count() {
    const evs = db.events.filter((e) => e.kind !== 'overlay' && e.year >= C0 && e.year < C1 + 100);
    const m = new Map(CENTS.map((c) => [c, { c, lm: [], all: [], by: new Map(ORDER.map((r) => [r, { r, lm: [], all: [] }])) }]));
    for (const e of evs) {
      const col = m.get(centOf(e.year)); if (!col) continue;
      const r = ORDER.includes(e.region) ? e.region : e.region === 'americas' ? 'north-america' : 'global';
      const cell = col.by.get(r);
      col.all.push(e); cell.all.push(e);
      // landmarks: one entry per episode; period labels are not landmarks of a place
      if (e.landmark && e.type !== 'era') { col.lm.push(e); cell.lm.push(e); }
    }
    for (const col of m.values()) {
      const regs = [...col.by.values()];
      for (const cl of regs) { cl.share = col.all.length ? cl.all.length / col.all.length : 0; cl.thin = cl.all.length < THIN; }
      // titles worth a spine first: the most linked landmarks, then the earliest
      for (const cl of regs) cl.lm.sort((a, b) => (b.connects || []).length - (a.connects || []).length || a.year - b.year);
    }
    return m;
  }

  // ---- the techniques the record shows travelling, and the headline that names them
  const regionOf = (e) => (ORDER.includes(e.region) ? e.region : e.region === 'americas' ? 'north-america' : 'global');
  function travels() {
    return TRAVEL.map((t) => {
      const a = db.byId.get(t.from);
      const to = t.to.map((id) => db.byId.get(id)).filter((e) => e && a && e.year > a.year && e.year >= C0);
      return a && to.length ? { name: t.name, a, to } : null;
    }).filter(Boolean);
  }
  function headline(tr) {
    if (!tr.length) return 'Nine regions, eleven centuries of landmarks';
    const names = tr.map((t) => t.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const t = `${list.charAt(0).toUpperCase()}${list.slice(1)} travel from region to region`;
    return t.split(/\s+/).length <= 8 ? t : `${names.length} techniques travel from region to region`;
  }

  const rOf = (id) => NAME[id] || REGION[id]?.label || id;
  const listFor = (c, r) => {
    const col = cells.get(c), cl = r ? col.by.get(r) : null;
    const ids = [...(cl ? cl.all : col.all)].sort((a, b) => a.t - b.t || a.year - b.year).map((e) => e.id);
    const lm = cl ? cl.lm.length : col.lm.length;
    openList(`cent:${c}${r ? ':' + r : ''}`, {
      kicker: `<span class="ki">Centuries</span><span class="ki">${c}s</span>`,
      title: r ? `The ${c}s in ${rOf(r)}` : `The ${c}s`,
      sub: `${lm} landmark${lm === 1 ? '' : 's'}${cl && cl.thin ? ' · thin record' : ''}`,
      ids,
      note: cl && cl.thin ? `Fewer than ${THIN} events are recorded here for the century; the band is hatched to show a thin record.` : undefined,
    });
  };

  let hot = null; // the region carrying the one accent
  function accent(r) {
    hot = r;
    chart.querySelectorAll('.cy-band').forEach((n) => n.classList.toggle('hot', n.dataset.r === r));
    chart.classList.toggle('has-hot', !!r);
  }

  let drawnOnce = false;
  function draw() {
    if (!cells) cells = count();
    const tr = travels();
    hl.textContent = headline(tr);
    foot.innerHTML = `Band width: each region's share of all events recorded that century. <span class="cy-trail-key" aria-hidden="true"></span> A technique arriving in use. <span class="cy-hatch-key" aria-hidden="true"></span> Hatched: under ${THIN} events recorded, a thin record.`;
    const W = chart.clientWidth, H = chart.clientHeight;
    chart.innerHTML = '';
    if (!W) return;
    if (W < 700) phone(W, tr); else { chart.style.height = ''; if (H) wide(W, chart.clientHeight, tr); }
    if (hot) accent(hot);
    drawnOnce = true;
  }

  // ---- desktop and tablet: eleven equal columns
  function wide(W, H, tr) {
    const GUT = W >= 1200 ? 8 : 5, n = CENTS.length;
    const CW = (W - GUT * (n - 1)) / n;
    const numH = Math.round(Math.min(56, Math.max(26, CW * 0.36)));
    const numF = Math.round(Math.min(40, CW * 0.31));
    const top = numH + 8, bh = H - top - 2;
    const svg = d3.select(chart).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', 'Landmark events by century and region');
    const defs = svg.append('defs');
    const hatch = (id, col) => { const p = defs.append('pattern').attr('id', id).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)'); p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', col).attr('stroke-width', 1.4); };
    hatch('cy-h', 'rgba(28,26,23,.42)'); hatch('cy-h-ink', 'rgba(243,238,227,.55)'); hatch('cy-h-hot', 'rgba(255,255,255,.6)');
    const MIN = 3, GAP = 1;
    spines = [];
    const at = new Map(); // band geometry per century and region, for the travel marks
    const grow = !drawnOnce && !RM();
    CENTS.forEach((c, i) => {
      const col = cells.get(c), x0 = i * (CW + GUT);
      const g = svg.append('g').attr('class', 'cy-col').attr('data-c', c);
      // the numeral, a button for the century's register
      const ng = g.append('g').attr('class', 'cy-num').attr('role', 'button').attr('tabindex', -1)
        .attr('aria-label', `The ${c}s: ${col.lm.length} landmarks, ${col.all.length} events. Open the register`)
        .on('click', () => listFor(c)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); listFor(c); } });
      ng.append('rect').attr('x', x0).attr('y', 0).attr('width', CW).attr('height', numH).attr('fill', 'transparent');
      ng.append('text').attr('class', 'cy-numt').attr('x', x0).attr('y', numH - 8).style('font-size', numF + 'px').style('font-family', GROT).text(c);
      g.append('line').attr('x1', x0).attr('x2', x0 + CW).attr('y1', numH).attr('y2', numH).attr('class', 'cy-rule');
      // widths: every region drawn in every century, a narrow band at least, the rest shared by the full record's counts
      const free = CW - MIN * ORDER.length - GAP * (ORDER.length - 1);
      let x = x0;
      ORDER.forEach((r, k) => {
        const cl = col.by.get(r), w = MIN + free * cl.share;
        const b = g.append('g').attr('class', `cy-band${cl.thin ? ' thin' : ''}${cl.lm.length ? '' : ' empty'}`).attr('data-r', r)
          .attr('role', 'button').attr('tabindex', -1)
          .attr('aria-label', `${rOf(r)}, ${c}s: ${cl.lm.length} of ${col.lm.length} landmarks, ${cl.all.length} of ${col.all.length} events${cl.thin ? ', thin record' : ''}. Open the register`)
          .on('mouseenter', (ev) => { accent(r); tip.show(ev, tipHtml(c, cl, col)); })
          .on('mousemove', tip.move)
          .on('mouseleave', () => { tip.hide(); accent(null); })
          .on('focus', () => accent(r)).on('blur', () => accent(null))
          .on('click', () => listFor(c, r))
          .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); listFor(c, r); } });
        const bx = x, bw = Math.max(MIN, w);
        at.set(`${c}:${r}`, { x: bx, w: bw });
        const fill = b.append('rect').attr('class', 'cy-fill').attr('x', bx).attr('y', top).attr('width', bw).attr('height', bh).attr('fill', bandFill(r, cl));
        b.style('--cy-ink', bandInk(r, cl)).style('--cy-deep', hues[r][2]);
        if (cl.thin && bw >= 3) b.append('rect').attr('class', 'cy-thin').attr('x', bx).attr('y', top).attr('width', bw).attr('height', bh);
        // grow: each band rises from the foot of its column, the columns in turn, once
        if (grow) b.selectAll('rect').attr('y', top + bh).attr('height', 0).transition().delay(i * 60 + k * 12).duration(700).ease(d3.easeCubicOut).attr('y', top).attr('height', bh);
        // a wider hit area for slivers, so every region can be pointed at
        if (bw < 8) b.append('rect').attr('x', bx - (8 - bw) / 2).attr('y', top).attr('width', 8).attr('height', bh).attr('fill', 'transparent');
        labelBand(b, r, cl, bx, bw, top, bh);
        x += bw + GAP;
      });
      if (grow) g.selectAll('text').style('opacity', 0).transition().delay(i * 60 + 520).duration(300).style('opacity', 1);
    });
    trails(svg, tr, (e) => { const c = centOf(e.year), g = at.get(`${c}:${regionOf(e)}`); return g ? { x: g.x + Math.min(2, g.w / 2), y: top + ((e.year - c) / 100) * bh, w: g.w } : null; }, W, grow);
  }

  // movement, not ownership: a dashed path from where the record first has a technique to each later arrival in use,
  // a dot in the arriving band and a short leader naming it
  function trails(svg, tr, pos, W, grow) {
    const g = svg.append('g').attr('class', 'cy-trails');
    const placed = [];
    // every dot is an obstacle for every chip, so no label covers another arrival
    const dots = tr.flatMap((t) => [t.a, ...t.to]).map(pos).filter(Boolean);
    const hits = (x1, x2, y) => spines.some((q) => x1 < q.x2 && x2 > q.x1 && y + 12 > q.y1 && y - 13 < q.y2) || placed.some((p) => x1 < p.x2 && x2 > p.x1 && Math.abs(y - p.y) < 22) || dots.some((d) => d.x > x1 - 6 && d.x < x2 + 6 && Math.abs(d.y - y) < 16);
    for (const t of tr) {
      const a = pos(t.a); if (!a) continue;
      g.append('circle').attr('class', 'cy-tdot from').attr('cx', a.x).attr('cy', a.y).attr('r', 3.5);
      for (const e of t.to) {
        const b = pos(e); if (!b) continue;
        const mx = (a.x + b.x) / 2;
        const path = g.append('path').attr('class', 'cy-trail').attr('d', `M${a.x},${a.y}C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`);
        if (grow) path.style('opacity', 0).transition().delay(1300).duration(500).style('opacity', null);
        g.append('circle').attr('class', 'cy-tdot').attr('cx', b.x).attr('cy', b.y).attr('r', 4);
        const label = `${t.name}, in use`;
        const lw = tw(label, ROW_F) + 10;
        let lx = b.x + b.w + 6; if (lx + lw > W) lx = b.x - 10 - lw;
        // the nearest free row to the arrival, up first (titles rise from the foot), then down; either side of the band
        let ly = b.y, ok = !hits(lx, lx + lw, ly);
        const alt = b.x - 10 - lw;
        for (let k = 1; !ok && k < 16; k++) for (const [x, y] of [[lx, b.y - k * 22], [alt, b.y - k * 22], [lx, b.y + k * 22], [alt, b.y + k * 22]]) {
          if (!ok && x >= 0 && x + lw <= W && y > 20 && !hits(x, x + lw, y)) { lx = x; ly = y; ok = true; }
        }
        placed.push({ x1: lx, x2: lx + lw, y: ly });
        const lg = g.append('g').attr('class', 'cy-lead').attr('role', 'button').attr('tabindex', -1).attr('aria-label', `${label}: ${e.title}, ${e.year}, ${rOf(regionOf(e))}. Open the record`)
          .on('click', () => select(e.id)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.id); } })
          .on('mouseenter', (ev) => tip.show(ev, `<div class="k">${esc(t.name)} &middot; ${e.year}</div><div class="h">${esc(e.title)}</div><div class="m">${esc(rOf(regionOf(e)))}, first in the record ${t.a.year} in ${esc(rOf(regionOf(t.a)))}</div>`))
          .on('mousemove', tip.move).on('mouseleave', tip.hide);
        lg.append('line').attr('x1', lx > b.x ? b.x - 2 + b.w : b.x - 4).attr('x2', lx > b.x ? lx : lx + lw).attr('y1', b.y).attr('y2', ly).attr('class', 'cy-leadln');
        lg.append('rect').attr('x', lx).attr('y', ly - 11).attr('width', lw).attr('height', 21).attr('class', 'cy-chip');
        lg.append('text').attr('x', lx + 5).attr('y', ly + 4).attr('class', 'cy-leadt').text(label);
        if (grow) lg.style('opacity', 0).transition().delay(1500).duration(400).style('opacity', 1);
      }
    }
  }

  const ctx = document.createElement('canvas').getContext('2d');
  const tw = (t, font) => { ctx.font = font; return ctx.measureText(t).width; };
  const NAME_F = "600 14px Instrument Sans, Georgia, serif", ROW_F = "400 14px Instrument Sans, Georgia, serif", MONO_F = "400 13px 'Instrument Sans', sans-serif";
  const fit = (t, w, font) => { if (tw(t, font) <= w) return t; let s = t; while (s.length > 3 && tw(s + '\u2026', font) > w) s = s.slice(0, -1); return s.trimEnd() + '\u2026'; };

  // inside a band: its name across the top where it fits, else up the band; then landmark titles as spines, read
  // bottom to top, as many as the width holds; the count of landmarks at the foot
  let spines = []; // boxes of the drawn spines, so no travel chip lands on a title
  function labelBand(b, r, cl, bx, bw, top, bh) {
    const name = NAME[r];
    let y = top + 4, used = 0;
    const nw = tw(name, NAME_F);
    if (bw >= nw + 10) { b.append('text').attr('class', 'cy-name').attr('x', bx + 5).attr('y', top + 18).text(name); y = top + 28; spines.push({ x1: bx + 3, x2: bx + 7 + nw, y1: top + 4, y2: top + 24 }); }
    else if (bw >= 17) { const vn = fit(name, bh - 40, NAME_F); b.append('text').attr('class', 'cy-name').attr('transform', `translate(${bx + bw / 2 - 5},${top + 8}) rotate(90)`).text(vn); used = 1; spines.push({ x1: bx + bw / 2 - 7, x2: bx + bw / 2 + 9, y1: top + 6, y2: top + 10 + tw(vn, NAME_F) }); }
    if (!cl.lm.length) return;
    const spineW = 18, avail = bw - 6 - used * spineW;
    const k = Math.max(0, Math.floor(avail / spineW));
    const rows = cl.lm.slice(0, k);
    const y0 = top + bh - 26, y1 = y + 4, len = y0 - y1;
    // a band only one strip wide shares it: the name hangs from the top, its first landmark rises from the foot
    if (used && !rows.length && bw >= 17) {
      const e = cl.lm[0], y0s = top + bh - 26, room = y0s - (top + 8 + Math.min(tw(name, NAME_F), bh - 40) + 18);
      if (room > 60) {
        const st = fit(`${e.year}  ${e.title_short || e.title}`, room, ROW_F);
        spines.push({ x1: bx + bw / 2 - 10, x2: bx + bw / 2 + 6, y1: y0s - tw(st, ROW_F), y2: y0s });
        b.append('text').attr('class', 'cy-spine').attr('transform', `translate(${bx + bw / 2 + 5},${y0s}) rotate(-90)`).attr('data-id', e.id)
          .text(st)
          .on('click', (ev) => { ev.stopPropagation(); select(e.id); });
        rows.push(e);
      }
    }
    rows.forEach((e, j) => {
      if (used && j === 0 && !k) return;
      const sx = bx + 4 + used * spineW + j * spineW + 12;
      const st = fit(`${e.year}  ${e.title_short || e.title}`, len, ROW_F);
      spines.push({ x1: sx - 14, x2: sx + 2, y1: y0 - tw(st, ROW_F), y2: y0 });
      b.append('text').attr('class', 'cy-spine').attr('transform', `translate(${sx},${y0}) rotate(-90)`).attr('data-id', e.id)
        .text(st)
        .on('click', (ev) => { ev.stopPropagation(); select(e.id); });
    });
    if (bw >= 22) {
      const more = cl.lm.length - rows.length;
      b.append('text').attr('class', 'cy-n').attr('x', bx + 5).attr('y', top + bh - 8).text(more > 0 && rows.length ? `+${more}` : cl.lm.length);
    }
  }

  function tipHtml(c, cl, col) {
    const pct = Math.round(cl.share * 100);
    return `<div class="k">${esc(rOf(cl.r))} &middot; ${c}s</div><div class="h">${cl.all.length} of ${col.all.length} events (${pct}%)</div><div class="m">${cl.lm.length} landmark${cl.lm.length === 1 ? '' : 's'}${cl.thin ? ' &middot; thin record' : ''}</div>`;
  }

  // ---- phone: the centuries stack, each a row of horizontal bands with its leading titles under it
  function phone(W, tr) {
    const rowH = 34, numW = 64;
    // under each row: the arrivals of travelling techniques that century, then the most linked landmarks
    const arr = new Map();
    for (const t of tr) for (const e of t.to) { const c = centOf(e.year); if (!arr.has(c)) arr.set(c, []); arr.get(c).push({ t, e }); }
    const blocks = CENTS.map((c) => { const col = cells.get(c); const top2 = [...col.lm].sort((a, b) => (b.connects || []).length - (a.connects || []).length || a.year - b.year).slice(0, 2); return { c, col, arr: arr.get(c) || [], titles: top2 }; });
    const bH = (bk) => rowH + 6 + (bk.titles.length + bk.arr.length) * 20 + 18;
    const H = blocks.reduce((s, bk) => s + bH(bk), 0);
    chart.style.height = H + 'px';
    const svg = d3.select(chart).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', 'Landmark events by century and region');
    const defs = svg.append('defs');
    const hatch = (id, col) => { const p = defs.append('pattern').attr('id', id).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)'); p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', col).attr('stroke-width', 1.4); };
    hatch('cy-h', 'rgba(28,26,23,.42)'); hatch('cy-h-ink', 'rgba(243,238,227,.55)'); hatch('cy-h-hot', 'rgba(255,255,255,.6)');
    let y = 0;
    const MIN = 3, GAP = 1, BW = W - numW;
    for (const bk of blocks) {
      const { c, col } = bk;
      const g = svg.append('g').attr('class', 'cy-col').attr('data-c', c);
      const ng = g.append('g').attr('class', 'cy-num').attr('role', 'button').attr('tabindex', -1).attr('aria-label', `The ${c}s: ${col.lm.length} landmarks. Open the register`)
        .on('click', () => listFor(c)).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); listFor(c); } });
      ng.append('rect').attr('x', 0).attr('y', y).attr('width', numW - 6).attr('height', rowH).attr('fill', 'transparent');
      ng.append('text').attr('class', 'cy-numt').attr('x', 0).attr('y', y + rowH - 8).style('font-size', '24px').style('font-family', GROT).text(c);
      const free = BW - MIN * ORDER.length - GAP * (ORDER.length - 1);
      let x = numW;
      ORDER.forEach((r) => {
        const cl = col.by.get(r), bw = MIN + free * cl.share;
        const b = g.append('g').attr('class', `cy-band${cl.thin ? ' thin' : ''}${cl.lm.length ? '' : ' empty'}`).attr('data-r', r).attr('role', 'button').attr('tabindex', -1)
          .attr('aria-label', `${rOf(r)}, ${c}s: ${cl.lm.length} of ${col.lm.length} landmarks${cl.thin ? ', thin record' : ''}. Open the register`)
          .on('click', () => { accent(r); listFor(c, r); }).on('focus', () => accent(r)).on('blur', () => accent(null))
          .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); listFor(c, r); } });
        b.append('rect').attr('class', 'cy-fill').attr('x', x).attr('y', y).attr('width', bw).attr('height', rowH).attr('fill', bandFill(r, cl));
        b.style('--cy-ink', bandInk(r, cl)).style('--cy-deep', hues[r][2]);
        if (cl.thin && bw >= 3) b.append('rect').attr('class', 'cy-thin').attr('x', x).attr('y', y).attr('width', bw).attr('height', rowH);
        const nm = NAME[r];
        if (bw >= tw(nm, NAME_F) + 10) b.append('text').attr('class', 'cy-name').attr('x', x + 5).attr('y', y + 22).text(nm);
        else if (bw >= 30 && cl.lm.length) b.append('text').attr('class', 'cy-n').attr('x', x + 5).attr('y', y + 22).text(cl.lm.length);
        x += bw + GAP;
      });
      let ty = y + rowH + 20;
      for (const { t, e } of bk.arr) {
        g.append('text').attr('class', 'cy-row cy-arr').attr('x', numW).attr('y', ty).attr('data-id', e.id).text(fit(`${t.name}, in use: ${rOf(regionOf(e))}, ${e.year}`, BW, ROW_F)).on('click', () => select(e.id));
        ty += 20;
      }
      for (const e of bk.titles) {
        g.append('text').attr('class', 'cy-row').attr('x', numW).attr('y', ty).attr('data-id', e.id).text(fit(`${e.year}  ${e.title_short || e.title}`, BW, ROW_F)).on('click', () => select(e.id));
        ty += 20;
      }
      y += bH(bk);
    }
  }

  function render(state, ch) { if (ch.has('*')) { cells = null; draw(); } }
  return { render, resize() { draw(); }, hover() {} };
}
