// J. THREADS: guided narrated tours plus "Rhymes", paired then and now episodes.
import { state as S, set, YEAR_MIN, YEAR_MAX } from '../store.js';
import { frac, REGION } from '../time.js';
import { esc, scrubMark } from '../ui.js';
import { host, fmtDate, ensure, census } from '../data.js';
import { DOMAIN, domainColor } from '../palette.js';
import { startTour, endTour, setCustomTour } from '../tour.js';
import { chipDrag, reduced } from '../lit.js';
import { placeLabels } from '../labels.js';

// touch readers get touch words (swipe, tap); fine pointers keep the keyboard and mouse words
const coarse = () => matchMedia('(pointer: coarse)').matches;

const THEN = '#2d5a88', NOW = '#d8603c', MINE = '#b8282e';
// the visitor's thread travels in the hash as m=mine_<event ids, comma separated>_<name>; ids are [a-z0-9-] only
const encodeMine = (m) => (m.ids.length || m.name ? `mine_${m.ids.join(',')}_${m.name}` : '');
const decodeMine = (mode) => { const x = /^mine_([^_]*)_?(.*)$/.exec(mode || ''); return x ? { ids: x[1].split(',').filter(Boolean), name: x[2] || '' } : null; };
const ABBR = /\b(Mr|Mrs|Ms|Dr|St|No|Inc|Co|Ltd|Jr|Sr|vs|ca|Gen|Col|Prof|Fig|al|U\.S|U\.K)\.$/;
// the first sentence of a summary, not fooled by "Mr." or an initial
const firstSentence = (t) => { const s = String(t || '').trim(); const re = /[.!?]+["')]*(?=\s+[A-Z0-9"'(]|\s*$)/g; let m; while ((m = re.exec(s))) { const head = s.slice(0, m.index + m[0].length); if (ABBR.test(head) || /(^|\s)[A-Z]\.$/.test(head)) continue; return head; } return s; };

export default function threads(el, { db, select }) {
  el.classList.add('scroll-y');
  const tours = (Array.isArray(db.tours) ? db.tours : db.tours?.tours) || [];
  const rhymes = Array.isArray(db.rhymes) ? db.rhymes : (db.rhymes && db.rhymes.rhymes) || [];
  let pinned = null;

  // ---- your own thread: pick events, order them, name it, walk it like the built-in ones ----
  let mine = decodeMine(S.mode) || { ids: [], name: '' };
  let mineQ = '';
  function mineTour() {
    const evs = mine.ids.map((id) => db.byId.get(id)).filter(Boolean);
    if (!evs.length) return null;
    const ys = evs.map((e) => e.year);
    const steps = evs.map((e) => { const span = e.year < 1800 ? 40 : e.year < 1926 ? 15 : 6; return { event: e.id, y0: Math.max(YEAR_MIN, e.year - span), y1: Math.min(YEAR_MAX, e.year + span), narration: firstSentence(e.summary) || e.title }; });
    return { id: 'mine', title: mine.name || 'Your thread', years: `${Math.min(...ys)} to ${Math.max(...ys)}`, color: MINE, dek: `${evs.length} event${evs.length === 1 ? '' : 's'} you chose, in your order.`, steps, custom: true };
  }
  const allTours = () => { const m = mineTour(); return m ? [...tours, m] : tours; };
  setCustomTour(mineTour());
  let nameTimer = null;
  function mineChanged({ hash = true } = {}) {
    setCustomTour(mineTour());
    if (hash && (!S.mode || S.mode.startsWith('mine_'))) set({ mode: encodeMine(mine) });
    syncBuilder();
  }
  const mineLink = () => { const p = new URLSearchParams(); p.set('v', 'threads'); if (encodeMine(mine)) p.set('m', encodeMine(mine)); return `${location.origin}${location.pathname}#${p.toString().replace(/%2C/g, ',')}`; };
  function builderHtml() {
    return `<section class="tb-build" aria-label="Build your own thread">
      <div class="full"><span class="sc">Your thread</span><h3>Build one</h3></div>
      <div><div class="row"><input type="search" class="tb-q" placeholder="Search events" aria-label="Search events" autocomplete="off" value="${esc(mineQ)}" /></div><ul class="tb-res"></ul></div>
      <div><div class="row"><input type="text" class="tb-name" placeholder="Name it" aria-label="Name it" maxlength="60" value="${esc(mine.name)}" /></div>
        <ol class="tb-list" aria-label="Events in your thread, drag to reorder"></ol><p class="tb-empty"></p>
        <div class="th-strip" role="img" aria-label="Your events on the millennium"></div>
        <div class="tb-line" role="img" aria-label="Your events on the millennium, numbered in walking order"><svg viewBox="0 0 400 56"></svg></div>${axis}
        <div class="tc-ctl"><button type="button" class="pri" data-start="mine">Walk it <span aria-hidden="true">&rarr;</span></button><button type="button" data-read="mine">Read it</button><button type="button" class="ghost" data-sort>Sort by year</button><button type="button" class="ghost" data-clear>Clear</button></div>
        <div class="tb-link"><input type="text" readonly aria-label="Link to this thread" /><button type="button" class="hp-act" data-copy>Copy link</button></div></div>
    </section>`;
  }
  function syncBuilder() {
    const b = el.querySelector('.tb-build'); if (!b) return;
    const q = mineQ.trim().toLowerCase();
    // a match at the start of a word outranks one inside it, then significance
    const rank = (e) => (String(e.year) === q ? 3 : new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(e.title.toLowerCase()) ? 2 : 1);
    const res = q.length >= 2 ? db.events.filter((e) => !mine.ids.includes(e.id) && (e.title.toLowerCase().includes(q) || String(e.year) === q)).sort((a, c) => rank(c) - rank(a) || c.significance - a.significance || a.t - c.t).slice(0, 12) : [];
    b.querySelector('.tb-res').innerHTML = res.map((e) => `<li><button type="button" data-add="${esc(e.id)}" style="--c:${domainColor(e.domain)}"><i></i><span class="y">${e.year}</span><span>${esc(e.title)}</span><span class="add">Add</span></button></li>`).join('') || (q.length >= 2 ? '<li class="tb-empty">No title matches.</li>' : '');
    const evs = mine.ids.map((id) => db.byId.get(id)).filter(Boolean);
    b.querySelector('.tb-list').innerHTML = evs.map((e, i) => `<li data-id="${esc(e.id)}" style="--c:${domainColor(e.domain)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="ev"><i></i><span class="y">${e.year}</span><span>${esc(e.title)}</span><button type="button" class="rm" data-rm="${esc(e.id)}" aria-label="Remove ${esc(e.title)}">Remove</button></span></li>`).join('');
    b.querySelector('.tb-empty').textContent = evs.length ? '' : 'Search above and add events; they walk in the order you set.';
    b.querySelector('.th-strip').innerHTML = strip(evs.map((e) => ({ y: e.year, c: MINE })));
    builderLine(b.querySelector('.tb-line svg'), evs);
    const has = evs.length > 0, active = S.tour === 'mine';
    b.querySelectorAll('[data-start], [data-read], [data-sort], [data-copy]').forEach((x) => { x.disabled = !has; });
    b.querySelector('[data-start]').innerHTML = active ? `Resume at ${S.step + 1} <span aria-hidden="true">&rarr;</span>` : 'Walk it <span aria-hidden="true">&rarr;</span>';
    b.querySelector('.tb-link input').value = has ? mineLink() : '';
  }
  function bindBuilder() {
    const b = el.querySelector('.tb-build'); if (!b) return;
    b.querySelector('.tb-q').addEventListener('input', (ev) => { mineQ = ev.target.value; syncBuilder(); });
    b.querySelector('.tb-name').addEventListener('input', (ev) => { mine.name = ev.target.value.replace(/[_,]/g, ' '); clearTimeout(nameTimer); nameTimer = setTimeout(() => mineChanged(), 400); });
    chipDrag(b.querySelector('.tb-list'), { sel: 'li', key: 'id', onReorder(ids) { mine.ids = ids; mineChanged(); }, onClick(id, li, ev) { const rm = ev.target.closest && ev.target.closest('[data-rm]'); if (rm) { mine.ids = mine.ids.filter((x) => x !== id); mineChanged(); } else select(id); } });
    b.querySelector('.tb-list').addEventListener('click', (ev) => { const rm = ev.target.closest('[data-rm]'); if (rm && ev.detail === 0) { mine.ids = mine.ids.filter((x) => x !== rm.dataset.rm); mineChanged(); } });
    b.addEventListener('click', (ev) => {
      const x = ev.target.closest('button'); if (!x) return;
      if (x.dataset.add) { mine.ids = [...mine.ids, x.dataset.add]; mineChanged(); b.querySelector('.tb-q').focus(); }
      else if ('sort' in x.dataset) { mine.ids = mine.ids.slice().sort((p, q) => (db.byId.get(p)?.t || 0) - (db.byId.get(q)?.t || 0)); mineChanged(); }
      else if ('clear' in x.dataset) { mine = { ids: [], name: '' }; mineQ = ''; b.querySelector('.tb-q').value = ''; b.querySelector('.tb-name').value = ''; mineChanged(); }
      else if ('copy' in x.dataset) { const inp = b.querySelector('.tb-link input'); inp.select(); const done = () => { x.textContent = 'Copied'; setTimeout(() => { x.textContent = 'Copy link'; }, 1600); }; if (navigator.clipboard) navigator.clipboard.writeText(inp.value).then(done, done); else { document.execCommand('copy'); done(); } }
    });
  }

  const yr = (id) => db.byId.get(id)?.year;
  const strip = (pts, w = 100) => pts.map((p) => `<span style="left:${frac(Math.min(YEAR_MAX, Math.max(YEAR_MIN, p.y)) + 0.5) * w}%;background:${p.c}"></span>`).join('');
  const axis = `<div class="th-ax" aria-hidden="true" style="position:relative;height:12px">${[1026, 1500, 1800, 1900, 1950, 2000, 2026].map((y) => `<span class="${y === 1500 || y === 1950 ? 'th-ax-opt' : ''}" style="position:absolute;left:${frac(y) * 100}%;transform:translateX(${y === 1026 ? 0 : y === 2026 ? -100 : -50}%)">${y}</span>`).join('')}</div>`;

  // axis ticks that would touch are hidden after layout (1026 and 1500 sit 9 percent apart on the millennium scale); first and last always stay
  function axisFit() {
    el.querySelectorAll('.th-ax').forEach((ax) => {
      const ts = [...ax.children]; if (ts.length < 3) return;
      ts.forEach((t) => { t.style.visibility = ''; });
      const r = ts.map((t) => t.getBoundingClientRect()), last = r[r.length - 1], GAP = 6;
      let keep = r[0];
      ts.slice(1, -1).forEach((t, i) => {
        const b = r[i + 1];
        if (!b.width) return;
        if (b.left < keep.right + GAP || b.right > last.left - GAP) t.style.visibility = 'hidden'; else keep = b;
      });
    });
  }

  // card hover: the steps join up in walking order on a small millennium timeline; the path is drawn on hover (CSS), first and last years labelled
  const MH = 38;
  function mini(pts) { return pts.length ? `<svg viewBox="0 0 400 ${MH}" data-ys="${pts.map((p) => p.y).join(',')}"></svg>` : ''; }
  function miniAll() {
    el.querySelectorAll('.th-mini svg[data-ys]').forEach((sv) => {
      const MW = Math.max(120, sv.clientWidth || sv.parentElement.clientWidth || 400), ys = sv.dataset.ys.split(',').map(Number);
      const xs = ys.map((y) => frac(Math.min(YEAR_MAX, Math.max(YEAR_MIN, y)) + 0.5) * MW);
      const nodes = xs.map((x, i) => [x, i % 2 ? 16 : 22]);
      const d = nodes.map((n, i) => `${i ? 'L' : 'M'}${n[0].toFixed(1)},${n[1]}`).join('');
      const L = nodes.slice(1).reduce((a, n, i) => a + Math.hypot(n[0] - nodes[i][0], n[1] - nodes[i][1]), 0);
      const la = (x) => (x < 30 ? 'start' : x > MW - 30 ? 'end' : 'middle');
      sv.setAttribute('viewBox', `0 0 ${MW} ${MH}`);
      sv.innerHTML = `<path class="path" d="${d}" style="--L:${L.toFixed(0)};stroke-dasharray:${L.toFixed(0)}" />${nodes.map((n, i) => `<circle class="pt" cx="${n[0].toFixed(1)}" cy="${n[1]}" r="3" style="--d:${Math.min(0.6, i * 0.05).toFixed(2)}s" />`).join('')}<text class="lab" x="${xs[0].toFixed(1)}" y="9" text-anchor="${la(xs[0])}">${ys[0]}</text>${ys[ys.length - 1] !== ys[0] ? `<text class="lab" x="${xs[xs.length - 1].toFixed(1)}" y="9" text-anchor="${la(xs[xs.length - 1])}">${ys[ys.length - 1]}</text>` : ''}`;
    });
  }
  // builder: the thread's own timeline, redrawn with transitions each time an event is added, removed or reordered
  function builderLine(svgEl, evs) {
    if (!svgEl) return;
    const Wb = Math.max(120, svgEl.clientWidth || svgEl.parentElement.clientWidth || 400), Hb = 56, base = Hb - 10;
    const svg = d3.select(svgEl).attr('viewBox', `0 0 ${Wb} ${Hb}`);
    svg.select('line.base').attr('x2', Wb);
    const pts = evs.map((e, i) => ({ id: e.id, e, i, x: frac(e.year + 0.5) * Wb, y: base - 8 - (i % 2 ? 6 : 14) }));
    // step numbers go through the shared placer: when two steps a year apart would print on top of each other, the
    // later number stands down (its dot, stem and title stay)
    const nums = pts.map((p) => ({ p, w: 14, h: 10, pri: -p.i, cands: [[p.x - 7, p.y - 16]] }));
    placeLabels(nums, { gap: 1 });
    nums.forEach((n) => { n.p.hideN = !!n.hidden; });
    const dur = reduced() ? 0 : 400, ez = d3.easeCubicOut;
    if (svg.select('line.base').empty()) svg.append('line').attr('class', 'base').attr('x1', 0).attr('x2', Wb).attr('y1', base).attr('y2', base);
    const d = pts.length > 1 ? pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y}`).join('') : '';
    let path = svg.select('path.path');
    if (path.empty()) path = svg.append('path').attr('class', 'path').attr('d', d);
    path.transition().duration(dur).ease(ez).attr('d', d);
    const g = svg.selectAll('g.ev').data(pts, (p) => p.id);
    const en = g.enter().append('g').attr('class', 'ev').attr('transform', (p) => `translate(${p.x},${p.y})`);
    en.append('line').attr('class', 'stem').attr('y1', 0).attr('y2', (p) => base - p.y).attr('stroke', 'var(--rule-strong)');
    en.append('circle').attr('class', 'pt new').attr('r', 0).transition().duration(dur).ease(d3.easeBackOut.overshoot(1.2)).attr('r', 4);
    en.append('text').attr('class', 'n').attr('y', -7).attr('text-anchor', 'middle').attr('opacity', 0).text((p) => String(p.i + 1).padStart(2, '0')).transition().delay(dur * 0.5).duration(dur).attr('opacity', 1);
    en.append('title').text((p) => `${p.e.year}: ${p.e.title}`);
    const all = en.merge(g);
    all.transition().duration(dur).ease(ez).attr('transform', (p) => `translate(${p.x},${p.y})`);
    all.select('line.stem').transition().duration(dur).attr('y2', (p) => base - p.y);
    all.select('text.n').text((p) => String(p.i + 1).padStart(2, '0')).classed('hid', (p) => p.hideN);
    all.select('circle.pt').classed('new', false);
    g.exit().select('circle').transition().duration(dur * 0.6).attr('r', 0);
    g.exit().transition().duration(dur * 0.6).attr('opacity', 0).remove();
    // first and last years, labelled directly on the baseline
    const ends = pts.length ? [pts[0], pts[pts.length - 1]].filter((p, i, a) => i === 0 || p.x - a[0].x > 36) : [];
    const yl = svg.selectAll('text.yr').data(ends, (p) => p.id);
    yl.enter().append('text').attr('class', 'yr').attr('y', Hb - 0).attr('x', (p) => p.x).attr('text-anchor', (p) => (p.x < 30 ? 'start' : p.x > Wb - 30 ? 'end' : 'middle')).attr('opacity', 0).text((p) => p.e.year).transition().duration(dur).attr('opacity', 1);
    yl.transition().duration(dur).attr('x', (p) => p.x).attr('text-anchor', (p) => (p.x < 30 ? 'start' : p.x > Wb - 30 ? 'end' : 'middle'));
    yl.exit().remove();
  }

  // the fixed source line: how many threads and steps, and how many distinct cited events they rest on
  function footLine(ts) {
    const ids = new Set(); let steps = 0;
    ts.forEach((t) => (t.steps || []).forEach((st) => { steps++; if (st.event) ids.add(st.event); }));
    const evs = [...ids].map((id) => db.byId.get(id)).filter(Boolean);
    const cited = evs.filter((e) => Array.isArray(e.sources) && e.sources.length).length;
    const n = (x) => x.toLocaleString('en-US');
    return `<span>Source: ${ts.length} threads, ${steps} steps, ${n(cited)} of ${n(evs.length)} events cited in their records</span><span>Histomap record, ${n(census().events)} events, ${YEAR_MIN} to ${YEAR_MAX}</span>`;
  }
  function tourCard(t) {
    const pts = t.steps.map((s) => ({ y: yr(s.event), c: t.color })).filter((p) => p.y);
    const active = S.tour === t.id;
    return `<article class="tc" style="--tc:${t.color}">
      <div class="tc-bar"></div>
      <div class="tc-top"><span class="sc">Sheet ${sheetNo(t)}</span><span class="sc">${esc(t.years)}</span><span class="sc">${t.steps.length} steps</span></div>
      <h3><a class="tc-link" href="#v=threads&m=story-${esc(t.id)}" data-read="${esc(t.id)}">${esc(t.title)}</a></h3>
      <p>${esc(t.dek)}</p>
      <div class="th-strip tc-strip" role="img" aria-label="Steps from ${esc(t.years)}, ${coarse() ? 'tap' : 'click'} to open the sheet" data-read="${esc(t.id)}" title="Open the sheet">${strip(pts)}</div>
      <div class="th-mini" aria-hidden="true">${mini(pts)}</div>${axis}
      <ol class="tc-steps">${t.steps.slice(0, 3).map((s) => `<li><span class="y">${yr(s.event) || ''}</span>${esc(db.byId.get(s.event)?.title || '')}</li>`).join('')}<li class="more">and ${t.steps.length - 3} more</li></ol>
      <div class="tc-ctl"><button type="button" class="pri" data-start="${t.id}">${active ? `Resume the walk at ${S.step + 1}` : 'Walk it on the map'} <span aria-hidden="true">&rarr;</span></button><button type="button" data-read="${t.id}">Open the sheet</button>${active ? `<button type="button" class="ghost" data-end="1">End</button>` : ''}</div>
    </article>`;
  }

  function evList(ids, color) {
    return `<ul class="rh-ev">${ids.map((id) => { const e = db.byId.get(id); return e ? `<li><button type="button" data-id="${esc(id)}"><i style="background:${color}"></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button></li>` : ''; }).join('')}</ul>`;
  }
  // sources attached to one side of the pair, each with the claim it supports
  const sideSrc = (side) => (side.sources || []).length ? `<ol class="rh-side-src" aria-label="Sources for this side">${side.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.supports || '')}">${esc(x.title || host(x.url))}</a></li>`).join('')}</ol>` : '';
  function rhymeCard(r, i) {
    const then = r.then || {}, now = r.now || {};
    const tIds = then.event_ids || [], nIds = now.event_ids || [];
    const pts = [...tIds.map((id) => ({ y: yr(id), c: THEN })), ...nIds.map((id) => ({ y: yr(id), c: NOW }))].filter((p) => p.y);
    const early = /^1[0-8]\d\d/.test(then.years || '') ? `<span class="early" title="Before 1926">${esc(String(then.years).slice(0, 4))} &larr;</span>` : '';
    return `<article class="rh${pinned === r.id ? ' pin' : ''}" data-r="${esc(r.id)}" tabindex="-1">
      <h3>${esc(r.title)}</h3>
      <div class="th-strip rh-strip" role="img" aria-label="Then ${esc(then.years || '')}, now ${esc(now.years || '')}">${strip(pts)}${early}</div>${axis}
      <div class="rh-pair">
        <section class="then"><div class="lab"><span class="sc">Then</span><span class="yrs">${esc(then.years || '')}</span></div><p>${esc(then.summary || '')}</p>${tIds.length ? evList(tIds, THEN) : `<p class="rh-none">Before the map begins in 1926; see sources.</p>`}${sideSrc(then)}</section>
        <section class="now"><div class="lab"><span class="sc">Now</span><span class="yrs">${esc(now.years || '')}</span></div><p>${esc(now.summary || '')}</p>${evList(nIds, NOW)}${sideSrc(now)}</section>
      </div>
      <p class="rh-thesis">${esc(r.thesis || '')}</p>
      <div class="rh-foot">
        <button type="button" class="ghost rh-pinbtn" data-pin="${esc(r.id)}" aria-pressed="${pinned === r.id}">${pinned === r.id ? 'Unpin from timeline' : 'Pin both on timeline'}</button>
        <ol class="rh-src">${(r.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a></li>`).join('')}</ol>
      </div>
      ${r.sources_incomplete ? `<details class="rh-verif"><summary><span class="sc">Sources incomplete</span> Some claims are covered only by the linked event records</summary><p>${esc(r.verification_note || '')}</p></details>` : r.verification === 'supported' ? '' : r.verification ? `<details class="rh-verif ok"><summary><span class="sc">Fact checked</span> Corrected or qualified, with sources added</summary><p>${esc(r.verification_note || '')}</p></details>` : ''}
    </article>`;
  }

  function rhymePins(r) {
    if (!r) return null;
    const p = (ids, c) => (ids || []).map((id) => db.byId.get(id)).filter(Boolean).map((e) => ({ year: e.year, month: e.month, color: c, strong: true }));
    return [...p(r.then?.event_ids, THEN), ...p(r.now?.event_ids, NOW)];
  }
  const byId = (id) => rhymes.find((r) => r.id === id);

  function draw() {
    el.innerHTML = `
      <div class="th-wrap">
        <header class="th-head"><span class="sc">Threads</span><h2>Threads</h2>
          <p>${["Six","Seven","Eight","Nine"][tours.length - 6] || tours.length} numbered sheets, each one long argument through the record, and room for one of yours.</p></header>
        <div class="tc-grid">${tours.map(tourCard).join('')}</div>
        ${builderHtml()}
        ${rhymes.length ? `<header class="th-head rh-head"><span class="sc">Paired episodes &middot; ${rhymes.length}</span><h2>Earlier episodes, paired</h2>
          <p>Paired episodes, then and now. <span class="k"><i style="background:${THEN}"></i>then</span> <span class="k"><i style="background:${NOW}"></i>now</span> Each pair marks both episodes on the timeline below${coarse() ? ' when tapped' : ' on hover'}; a pin keeps the marks while you browse other views.</p></header>
        <div class="rh-grid">${rhymes.map(rhymeCard).join('')}</div>` : ''}
        <footer class="th-foot">${footLine(tours)}</footer>
      </div>`;
    // sources arrive after first paint (events_text.json); the cited count waits for them
    ensure('text').then(() => { const f = el.querySelector('.th-foot'); if (f) f.innerHTML = footLine(tours); });
    bindBuilder();
    syncBuilder();
    miniAll();
    axisFit();
  }

  el.addEventListener('click', (ev) => {
    // the thread title (a link) and the row's strip open the story; the Read button at the right edge stays as the second path
    const lk = ev.target.closest('a.tc-link, .tc-strip[data-read]');
    if (lk && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.button === 0) { ev.preventDefault(); set({ mode: 'story-' + lk.dataset.read, sel: '' }); el.scrollTop = 0; return; }
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.closest('.tb-build') && !b.dataset.start && !b.dataset.read) return;
    if (b.dataset.read) { set({ mode: b.dataset.read === 'mine' ? encodeMine(mine) : 'story-' + b.dataset.read, sel: '' }); el.scrollTop = 0; }
    else if (b.dataset.back) { set({ mode: '' }); }
    else if (b.dataset.walk) { set({ mode: '' }); startTour(b.dataset.walk, +b.dataset.at || 0); }
    else if (b.dataset.start) { const t = b.dataset.start; startTour(t, S.tour === t ? S.step : 0); }
    else if (b.dataset.end) endTour();
    else if (b.dataset.pin) {
      pinned = pinned === b.dataset.pin ? null : b.dataset.pin;
      scrubMark('rhyme', rhymePins(byId(pinned)));
      el.querySelectorAll('.rh').forEach((c) => { const on = c.dataset.r === pinned; c.classList.toggle('pin', on); const pb = c.querySelector('.rh-pinbtn'); pb.setAttribute('aria-pressed', String(on)); pb.textContent = on ? 'Unpin from timeline' : 'Pin both on timeline'; });
    } else if (b.dataset.id) select(b.dataset.id);
  });
  const hov = (ev) => { const c = ev.target.closest('.rh'); scrubMark('rhyme', rhymePins(byId(c ? c.dataset.r : pinned))); };
  el.addEventListener('mouseover', hov);
  el.addEventListener('focusin', hov);
  el.addEventListener('mouseleave', () => scrubMark('rhyme', rhymePins(byId(pinned))));

  // ---------------- sheets: one screen per step, Blueprint Notation ----------------
  // A thread is a numbered sheet. The vertical rail carries its steps as ticks at their years; leader lines reach the
  // labels (five words or fewer) at the margin; the current step is the one amber part and holds its sentence and the
  // event's source. Advancing is a hard cut: keys, the buttons, a tick, or a swipe. The sheet never scrolls.
  let io = null, stepIdx = -1, storyId = '', sheetShow = null;
  // the tab opens on sheet 01; a story-<id> mode names a sheet; a mine_ mode (the builder's deep link) is a sheet of its own
  const storyTour = () => {
    if (S.mode.startsWith('mine_')) { const m = decodeMine(S.mode); if (m && encodeMine(m) !== encodeMine(mine)) { mine = m; setCustomTour(mineTour()); } return mineTour() || tours[0]; }
    return allTours().find((t) => 'story-' + t.id === S.mode) || tours[0];
  };
  const sheetNo = (t) => { const k = tours.findIndex((x) => x.id === t.id); return k < 0 ? String(tours.length + 1).padStart(2, '0') : String(k + 1).padStart(2, '0'); };
  const pad2 = (n) => String(n).padStart(2, '0');
  const FAMILY = { computing: 'signal', semiconductors: 'signal', internet: 'signal', communications: 'signal', society: 'knowledge', software: 'knowledge', media: 'knowledge', energy: 'power', materials: 'power', transport: 'movement', space: 'movement', biotech: 'life', health: 'life', agriculture: 'life', home: 'knowledge', ai: 'ai' };
  // a bar takes its step's domain ink from palette.css (--h-<family>-<domain>-4 unselected, the family's step when the domain has none)
  const barInk = (e, step = 4) => { const f = FAMILY[e.domain]; return f ? (f === 'ai' ? `var(--h-ai-${step})` : `var(--h-${f}-${e.domain}-${step}, var(--h-${f}-${step}))`) : 'var(--h-signal-4)'; };
  const shortLabel = (st, e) => st.label || (e.title.split(/\s+/).length <= 5 ? e.title : e.title.split(/\s+/).slice(0, 5).join(' '));

  function drawStory(t) {
    stepIdx = -1;
    const steps = t.steps.map((st, i) => ({ ...st, i, e: db.byId.get(st.event) })).filter((st) => st.e);
    const y0 = Math.min(...steps.map((st) => st.e.year)), y1 = Math.max(...steps.map((st) => st.e.year));
    const no = sheetNo(t);
    el.innerHTML = `<div class="sh" style="--tc:var(--thread-${esc(t.id)}, ${t.color})">
      <div class="sh-frame">
        <div class="sh-top"><span class="sh-title">${esc(t.title)}</span>${t.caption ? `<span class="sh-cap">${esc(t.caption)}</span>` : ''}</div>
        <svg class="sh-rail" aria-hidden="true"></svg>
        <div class="sh-tree" aria-hidden="true"></div>
        <ol class="sh-list" aria-label="Steps">${steps.map((st, k) => `<li><button type="button" data-go="${st.i}">${pad2(k + 1)} ${st.e.year} ${esc(shortLabel(st, st.e))}</button></li>`).join('')}</ol>
        <section class="sh-cur" aria-live="polite">
          <p class="sh-step"><span class="sh-date"></span></p>
          <span class="sh-yr" aria-hidden="true">${y0}</span>
          <h2 class="sh-h"></h2>
          <p class="sh-say"></p>
          <p class="sh-src"></p>
          <div class="sh-ctl"><button type="button" data-prev="1" aria-label="Previous step"><span aria-hidden="true">&larr;</span> Back</button><button type="button" class="pri" data-next="1" aria-label="Next step">Next <span aria-hidden="true">&rarr;</span></button><button type="button" data-ev="1" aria-expanded="false">Evidence</button></div>
        </section>
        <aside class="sh-tb" aria-label="Title block">
          <div class="sh-sw" role="tablist" aria-label="Sheets">${allTours().map((x, i) => `<button type="button" role="tab" data-read="${esc(x.id)}" aria-selected="${x.id === t.id ? 'true' : 'false'}" tabindex="${x.id === t.id ? '0' : '-1'}"><span class="n">${pad2(i + 1)}</span> ${esc(x.title)}</button>`).join('<span class="dot" aria-hidden="true">&middot;</span>')}</div>
          <span class="sh-tbl">Sheet ${no} &middot; step <span class="sh-k">01</span> of ${pad2(steps.length)} &middot; ${esc(t.years)}</span>
        </aside>
        <aside class="sh-ev" hidden aria-label="Evidence">
          <div class="sh-evtop"><span class="sc">Evidence</span><button type="button" class="ghost" data-evclose="1">Close</button></div>
          <p class="sh-evmeta sc"></p>
          <h3 class="sh-evh"></h3>
          <p class="sh-evsum"></p>
          <ol class="sh-evsrc"></ol>
          <div class="sh-evctl"><button type="button" class="pri" data-walk="${esc(t.id)}" data-at="0">Walk it on the map <span aria-hidden="true">&rarr;</span></button><button type="button" data-id="">Open record</button></div>
        </aside>
      </div>
    </div>`;
    el.classList.add('sheet');
    const frame = el.querySelector('.sh-frame'), svg = d3.select(frame.querySelector('.sh-rail')), evp = frame.querySelector('.sh-ev');
    let nodes = null;

    // the genealogy: a vertical time rail at the left; each step a horizontal bar at its year, splitting from the bar
    // of the earlier step it connects to (the latest such step; the one before it when the record links none)
    const parentOf = (k) => {
      const me = steps[k]; const links = new Set(me.e.connects || []);
      if (me.parent) { const j = steps.findIndex((o, q) => q < k && o.e.id === me.parent); if (j >= 0) return j; }
      for (let j = k - 1; j >= 0; j--) { const o = steps[j]; if (links.has(o.e.id) || (o.e.connects || []).includes(me.e.id)) return j; }
      return -1;  // no recorded connection: the bar stands on its own; reading order is not descent
    };
    const par = steps.map((_, k) => (k ? parentOf(k) : -1));
    const depth = steps.map((_, k) => { let d = 0, j = k; while (par[j] >= 0) { d++; j = par[j]; } return d; });
    function rail() {
      const W = frame.clientWidth, H = frame.clientHeight; if (!W || !H) return;
      const narrow = W < 700;
      const box = frame.querySelector('.sh-tree').getBoundingClientRect(), fb = frame.getBoundingClientRect();
      const left = box.left - fb.left, right = box.right - fb.left, top = box.top - fb.top + 24, bottom = box.bottom - fb.top - 28;
      svg.attr('width', W).attr('height', H).selectAll('*').remove();  // no viewBox: the frame may grow after this runs and the drawing must not scale with it
      const rx = left + (narrow ? 34 : 64);
      const padY = Math.max(1, Math.round((y1 - y0) * 0.03));
      const y = d3.scaleLinear().domain([y0 - padY, y1 + padY]).range([top, bottom]);
      svg.append('line').attr('class', 'ax').attr('x1', rx).attr('x2', rx).attr('y1', top - 8).attr('y2', bottom + 8);
      // bar rows in year order, pushed apart to the gap the frame affords; the tick stays at the true year
      const gap = narrow ? (bottom - top) / steps.length : Math.max(16, Math.min(30, (bottom - top) / steps.length));  // narrow: every bar fits, whatever the count
      const rows = steps.map((st, k) => ({ st, k, ty: y(st.e.year + 0.5), by: y(st.e.year + 0.5) })).sort((p, q) => p.ty - q.ty || p.k - q.k);
      for (let i = 1; i < rows.length; i++) rows[i].by = Math.max(rows[i].by, rows[i - 1].by + gap);
      const over = rows[rows.length - 1].by - bottom; if (over > 0) { rows[rows.length - 1].by = bottom; for (let i = rows.length - 2; i >= 0; i--) rows[i].by = Math.min(rows[i].by, rows[i + 1].by - gap); }
      const byK = []; rows.forEach((r) => { byK[r.k] = r; });
      const ind = narrow ? 12 : W < 900 ? 18 : 26, x0 = rx + (narrow ? 18 : 36), L = narrow ? 44 : Math.max(72, Math.min(150, (right - x0 - 230 - ind * Math.max(...depth)) )), bh = narrow ? 7 : 9;
      rows.forEach((r) => { r.x = x0 + ind * depth[r.k]; r.x2 = r.x + L; });
      const g = svg.append('g');
      // the split: from the parent's bar straight down (or up) to the child's row, then the child's bar runs right
      g.selectAll('path.sp').data(rows.filter((r) => par[r.k] >= 0)).join('path').attr('class', 'sp')
        .attr('d', (r) => { const pr = byK[par[r.k]]; return `M${r.x},${pr.by}V${r.by}`; });
      // the tick on the rail at the true year, tied to the row when the row was pushed
      g.selectAll('path.ld').data(rows).join('path').attr('class', 'ld').attr('d', (r) => `M${rx},${r.ty}H${rx + 8}L${x0 - 8},${r.by}H${r.x}`);
      nodes = g.selectAll('g.nd').data(rows).join('g').attr('class', 'nd').style('cursor', 'pointer').on('click', (ev, r) => go(r.st.i));
      nodes.append('rect').attr('class', 'tk').attr('x', rx - 3).attr('y', (r) => r.ty - 3).attr('width', 6).attr('height', 6);
      // each bar in its step's domain ink; the active step alone in amber
      nodes.append('rect').attr('class', 'bar').attr('x', (r) => r.x).attr('y', (r) => r.by - bh / 2).attr('width', L).attr('height', bh).style('--bar', (r) => barInk(r.st.e));
      nodes.append('text').attr('class', 'yr').attr('x', (r) => r.x2 + 8).attr('y', (r) => r.by).attr('dy', '0.35em').text((r) => r.st.e.year);
      if (!narrow) nodes.append('text').attr('class', 'lb').attr('x', (r) => r.x2 + 50).attr('y', (r) => r.by).attr('dy', '0.35em').text((r) => shortLabel(r.st, r.st.e));
      nodes.append('rect').attr('class', 'hit').attr('x', (r) => r.x - 6).attr('y', (r) => r.by - gap / 2).attr('width', narrow ? 110 : 320).attr('height', gap);
      nodes.append('title').text((r) => `${r.st.e.year}: ${r.st.e.title}`);
      mark();
    }
    function mark() { if (!nodes) return; nodes.classed('on', (d) => d.st.i === stepIdx).classed('done', (d) => d.st.i < stepIdx); }

    function srcLine(e) {
      const s = (e.sources || [])[0];
      if (!s) return 'Source in the record';
      return `Source: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a>`;
    }
    function fillEvidence(st, e) {
      const reg = e.region && REGION[e.region] ? ` \u00b7 ${REGION[e.region].label}` : '';
      evp.querySelector('.sh-evmeta').textContent = `${fmtDate(e)} \u00b7 ${DOMAIN[e.domain]?.label || e.domain} \u00b7 ${e.type}${reg}`;
      evp.querySelector('.sh-evh').textContent = e.title;
      evp.querySelector('.sh-evsum').textContent = e.summary || '';
      evp.querySelector('.sh-evsrc').innerHTML = (e.sources || []).map((s, i) => `<li><span class="n">${i + 1}</span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(host(s.url))}</span></li>`).join('') || '<li class="none">Sources load with the record.</li>';
      evp.querySelector('[data-walk]').dataset.at = st.i; evp.querySelector('[data-id]').dataset.id = e.id;
    }
    // the hard cut: everything on the sheet changes at once, nothing slides
    function show(i) {
      const st = steps.find((q) => q.i === i) || steps[0]; const e = st.e; stepIdx = st.i;
      const k = steps.findIndex((q) => q.i === st.i);
      frame.querySelector('.sh-yr').textContent = e.year;
      frame.querySelector('.sh-date').textContent = fmtDate(e) !== String(e.year) ? fmtDate(e) : (REGION[e.region]?.label || '');
      frame.querySelector('.sh-h').textContent = e.title;
      frame.querySelector('.sh-say').textContent = st.narration || '';
      frame.querySelector('.sh-src').innerHTML = srcLine(e);
      frame.querySelector('.sh-k').textContent = pad2(k + 1);
      frame.querySelector('[data-prev]').disabled = k === 0;
      frame.querySelector('[data-next]').disabled = k === steps.length - 1;
      frame.querySelectorAll('.sh-list button').forEach((b) => b.setAttribute('aria-current', +b.dataset.go === st.i ? 'step' : 'false'));
      fillEvidence(st, e);
      mark();
    }
    const go = (i) => { if (steps.some((q) => q.i === i)) show(i); };
    const move = (d) => { const k = steps.findIndex((q) => q.i === stepIdx); const nx = steps[k + d]; if (nx) show(nx.i); };
    sheetShow = { go, move, toggleEv(v) { const on = v == null ? evp.hidden : v; evp.hidden = !on; frame.querySelector('[data-ev]').setAttribute('aria-expanded', String(on)); frame.classList.toggle('ev-open', on); if (on) evp.querySelector('[data-evclose]').focus({ preventScroll: true }); }, isEv: () => !evp.hidden };
    frame.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.prev) move(-1); else if (b.dataset.next) move(1); else if (b.dataset.go != null) go(+b.dataset.go);
      else if (b.dataset.ev) sheetShow.toggleEv(); else if (b.dataset.evclose) { sheetShow.toggleEv(false); frame.querySelector('[data-ev]').focus({ preventScroll: true }); }
    });
    // a swipe on a touch screen is the same cut
    let tx = null, ty = null;
    frame.addEventListener('touchstart', (ev) => { const t0 = ev.touches[0]; tx = t0.clientX; ty = t0.clientY; }, { passive: true });
    frame.addEventListener('touchend', (ev) => { if (tx == null) return; const t0 = ev.changedTouches[0], dx = t0.clientX - tx, dy = t0.clientY - ty; tx = ty = null; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5 && !ev.target.closest('.sh-ev')) move(dx < 0 ? 1 : -1); }, { passive: true });
    rail();
    show(steps[0].i);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (el.classList.contains('sheet') && storyId.startsWith(t.id + ':')) rail(); });
    // sources arrive after first paint; the source line and the evidence list fill in then
    ensure('text').then(() => { if (el.classList.contains('sheet') && storyId.startsWith(t.id + ':')) show(stepIdx); });
    el._storyResize = () => { rail(); };
    if (el._storyRO) el._storyRO.disconnect();
    if (typeof ResizeObserver !== 'undefined') { let last = `${frame.clientWidth}x${frame.clientHeight}`; el._storyRO = new ResizeObserver(() => { if (!el.classList.contains('sheet')) return; const now = `${frame.clientWidth}x${frame.clientHeight}`; if (now !== last) { last = now; rail(); } }); el._storyRO.observe(frame); }
  }

  function storyKeys(ev) {
    if (!el.classList.contains('sheet') || !sheetShow) return;
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === 'Escape' && !S.sel) {
      ev.preventDefault();
      if (sheetShow.isEv()) { sheetShow.toggleEv(false); el.querySelector('[data-ev]')?.focus({ preventScroll: true }); } return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { if (ev.key === ' ' && ev.target.closest('button, a')) return; ev.preventDefault(); sheetShow.move(1); }
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); sheetShow.move(-1); }
  }
  document.addEventListener('keydown', storyKeys);

  let lastMode = S.mode;
  function render(state, ch) {
    if (!(ch.has('mode') || ch.has('*'))) return;
    const t = storyTour();
    const key = `${t.id}:${t.custom ? S.mode : ''}`;
    if (storyId !== key || ch.has('*')) { storyId = key; drawStory(t); el.scrollTop = 0; }
  }
  return { render, resize() { if (el._storyResize && el.classList.contains('sheet')) el._storyResize(); }, hover() {} };
}
