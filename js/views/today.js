// AI PLATES (Vision 4, S1 and S2): the AI tab's plate host. One plate at a time, each with its own deep link
// (anatomy, strata, genealogy, capital, benchmarks, policy, lineage keep their ids so tours and links resolve); the
// host renders only the selected plate and keeps the others mounted but hidden once they have been seen.
// Anatomy, Strata and Capital share one navy blueprint surface (.td-sec.blueprint).
import { state as S, set } from '../store.js';
import { esc } from '../ui.js';
import { ensureNow as need, ensure as later } from '../data.js';
import { bshort, bcolor, fmtYM } from '../aidepth.js';

const SECTIONS = [
  { id: 'anatomy', kind: 'fixed', dark: true, blueprint: true, module: 'anatomy', kicker: 'The system today', sub: 'How the parts feed one another' },
  { id: 'strata', kind: 'tall', dark: true, blueprint: true, module: 'strata', kicker: 'Money and compute', sub: 'Where the money goes' },
  { id: 'genealogy', kind: 'tall', module: 'genealogy', kicker: 'Models', sub: 'Notable releases since 2017' },
  // flow sections carry the head their module will draw, so a deep link shows the kicker, the headline and a ruled
  // skeleton of the section's height before the module and its data arrive
  { id: 'capital', kind: 'flow', dark: true, blueprint: true, module: 'capital', kicker: 'Money and compute', sub: 'Where the money goes', head: ['Capital and compute', 'Capital and Compute'] },
  { id: 'benchmarks', kind: 'flow', module: 'benchmarks', kicker: 'Benchmarks', sub: 'one graph, and what it misses', head: ['Benchmarks and saturation', 'Benchmarks'] },
  { id: 'policy', kind: 'flow', module: 'policy', kicker: 'Policy', sub: 'Where rules bind', head: ['Policy atlas', 'Policy Atlas'] },
  { id: 'lineage', kind: 'flow', module: null, kicker: 'Lineage', sub: 'Who founded what', head: ['Labs founded since 2010', 'Who founded what'] },
];
const skeleton = (s) => (s.head ? `<div class="td-skel" data-skel="${s.id}" aria-hidden="true"><div class="view-head"><span class="sc">${esc(s.head[0])}</span><h2>${esc(s.head[1])}</h2></div>${'<i></i>'.repeat(16)}</div>` : '');

// datasets each section needs before it draws; Anatomy draws at once and refreshes when policy and talent land
const SECTION_NEEDS = { genealogy: ['benchmarks'], capital: ['flows'], benchmarks: ['benchmarks'], policy: ['policy'], lineage: ['talent'] };

export default function today(el, ctx) {
  const { db, select, tip, markSubnav } = ctx;
  el.classList.add('today');
  el.classList.add('plates');
  // every plate is in the DOM from the start (hidden), so a deep link finds its section at once; the kicker row names the
  // plate and steps to its neighbours in the plate index order
  el.innerHTML = SECTIONS.map((s, i) => `
    <section class="td-sec ${s.kind}${s.dark ? ' dark' : ''}${s.blueprint ? ' blueprint' : ''}" data-sec="${s.id}" aria-label="${esc(s.kicker)}" hidden>
      ${i === 0 ? '' : `<div class="td-kicker"><span><b>${esc(s.kicker)}</b> &middot; ${esc(s.sub)}</span></div>`}
      ${s.id === 'benchmarks' ? '<div class="td-vs-slot"></div>' : ''}
      ${s.module ? `<div class="view" data-view="${s.id}">${skeleton(s)}</div>` : `<div class="td-lineage" id="td-lineage">${skeleton(s)}</div>`}
    </section>`).join('');

  const subs = new Map(); // id -> {el, api, dirty, loading}
  const secEls = new Map(SECTIONS.map((s) => [s.id, el.querySelector(`[data-sec="${s.id}"]`)]));

  async function ensure(id, force) {
    if (subs.has(id)) { const h = subs.get(id); if (force && h.api && h.dirty) { h.api.render(S, new Set(['*'])); h.dirty = false; } return h; }
    const s = SECTIONS.find((x) => x.id === id);
    if (!s || !s.module) return null;
    const holder = { el: secEls.get(id).querySelector('.view'), api: null, dirty: true, loading: null };
    subs.set(id, holder);
    holder.loading = (async () => {
      const [mod] = await Promise.all([import(`./${s.module}.js`), need(SECTION_NEEDS[id] || [])]);
      if (id === 'benchmarks') { const vs = secEls.get(id).querySelector('.td-vs-slot'); if (vs) { vs.innerHTML = '<div class="td-vs"></div>' + caveats(); mod.versusColumns(vs.firstChild, { db, select }); } }
      // the Anatomy draws from the first wave (policy core included); the full policy text and the talent file are a
      // speculative load that waits until the first marks are on screen, then the organ dims refresh
      if (id === 'anatomy') later('policy', 'talent').then(() => { if (holder.api) { holder.api.render(S, new Set(['*'])); holder.dirty = false; } });
      holder.el.querySelector(':scope > .td-skel')?.remove();
      holder.api = mod.default(holder.el, { db, select, tip });
      holder.el.classList.add('on');
      if (holder.dirty && (force || visible.has(id))) { holder.api.render(S, new Set(['*'])); holder.dirty = false; }
    })();
    await holder.loading;
    if (force && holder.dirty) { holder.api.render(S, new Set(['*'])); holder.dirty = false; }
    return holder;
  }

  // the shown plate: the others stay mounted but hidden; a plate renders when it is shown (and again when it is shown
  // after a change it missed)
  const visible = new Set();
  let shown = null;
  el.addEventListener('click', (ev) => {
    const j = ev.target.closest('[data-jump]');
    if (j) { const sec = j.closest('.td-sec'); const i = SECTIONS.findIndex((s) => s.id === sec.dataset.sec); const to = SECTIONS[i + (j.dataset.jump === 'next' ? 1 : -1)]; if (to) set({ view: to.id }); return; }
  });
  async function show(id) {
    const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
    if (shown !== s.id) {
      shown = s.id; visible.clear(); visible.add(s.id);
      secEls.forEach((e, k) => { e.hidden = k !== s.id; const iv = e.querySelector(':scope > .view'); if (iv) { iv.classList.toggle('on', k === s.id); iv.inert = k !== s.id; } });
      el.scrollTop = 0;
      el.dataset.plate = s.id;
    }
    if (s.id === 'lineage') { if (!lineageAsked) { lineageAsked = true; need('talent').then(() => lineage()); } else lineage(); }
    await ensure(s.id, true);
    const h = subs.get(s.id); if (h && h.api && h.api.resize) h.api.resize(); // the plate was hidden while the window may have changed
  }

  function render(state, ch) {
    const full = ch.has('*');
    const want = SECTIONS.some((s) => s.id === state.view) ? state.view : shown || 'anatomy';
    if (want !== shown) show(want);
    for (const h of subs.values()) {
      if (!h.api) continue;
      const id = h.el.dataset.view;
      if (visible.has(id)) { h.api.render(state, full || h.dirty ? new Set(['*']) : ch); h.dirty = false; }
      else h.dirty = true;
    }
    if (full && db.talent && shown === 'lineage') lineage();
  }

  // the tests-versus-people columns are built by benchmarks.js (versusColumns), so one module owns the benchmark numbers
  el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-bench]'); if (b) select(b.dataset.bench); });

  /* ---------- caveats panel for benchmarks ---------- */
  function benchNotes() {
    const all = (db.benchmarks || []).filter((b) => b.notes).slice().sort((a, b) => a.t0 - b.t0);
    if (!all.length) return '';
    return `<div class="td-bnotes"><h5>Benchmark by benchmark <span>${all.length} benchmarks, each with a note on how its scores were gathered; click a name to open the record</span></h5>
      <div class="bn-grid">${all.map((b) => `<div class="bn" style="--c:${bcolor(b)}"><button type="button" class="bn-name" data-bench="${esc(b.id)}">${esc(bshort(b))}</button><span class="bn-meta">${esc(fmtYM(b.introduced))}${b.ts ? ` to ${esc(fmtYM(b.saturated_date))}` : ', open'}</span><p>${esc(b.notes)}</p></div>`).join('')}</div></div>`;
  }
  function caveats() {
    return `<div class="td-caveat" role="note" aria-label="How to read benchmark scores">
      <h4>Read these scores with care</h4>
      <p><b>Contamination.</b> Test questions leak into training data through the open web, so a model can have seen the answers. Scores on older public sets overstate ability on new problems.</p>
      <p><b>Self-reporting.</b> Most record scores are reported by the lab that trained the model, often with prompting, tooling and sampling choices that differ from run to run and that independent evaluators cannot always reproduce.</p>
      <p><b>Saturation.</b> Once scores approach the ceiling a benchmark stops discriminating, and the field moves to a harder one.</p>
      <p><b>Balance.</b> The strip above, "what people do", shows use and spending measured outside the lab; users and prices move for reasons a test score cannot capture.</p>
      ${benchNotes()}
    </div>`;
  }

  /* ---------- lineage strip: built by talent.js (lineageStrip) ---------- */
  let lineageMod = null, lineageAsked = false;
  function lineage() {
    const box = el.querySelector('#td-lineage');
    if (!box) return;
    if (lineageMod) { lineageMod.lineageStrip(box, { db, select, tip }); return; }
    import('./talent.js').then((m) => { lineageMod = m; m.lineageStrip(box, { db, select, tip }); });
  }

  return {
    render,
    show,
    scrollTo: show, // the shell's name for landing on a plate
    resize() { for (const h of subs.values()) if (h.api) { if (visible.has(h.el.dataset.view)) (h.api.resize ? h.api.resize() : h.api.render(S, new Set(['*']))); else h.dirty = true; } lineage(); },
    hover(id) { const h = subs.get(S.view) || subs.get('anatomy'); for (const x of subs.values()) if (x.api && x.api.hover && (x === h || !id)) x.api.hover(id); },
    lit(l) { for (const x of subs.values()) if (x.api && x.api.lit) x.api.lit(l); },
  };
}
