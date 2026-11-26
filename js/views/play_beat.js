// PLAY, Beat the forecasters (play_beat.js): the game's own deal, call and score card; the set, tracker, corner, inks,
// decode loop and stamp come from play_shared.js. The quote is the stage: poster serif in ink a, the speaker and the year
// named in 12px mono at the foot, and a small timeline inside the card with the forecast's date and its target year as two
// ticks so the distance is felt before the call. The three calls are three poster-letter buttons filling the strip in
// tints of the round's pair. On a call the black Yours stamp drops onto the chosen button; the record's stamp lands on the
// button it judged, in that verdict's Ledger ink; the strip prints the outcome in poster mono and the board flashes ink a
// (agree) or ink b (differ). A record without a settled verdict never enters the deal.
import { createEngine, esc, oneLine, cutWords, hasYear, CALLS, STAMP_WORD } from './play_shared.js';

const NOW = 2026;
const SETTLED = new Set(CALLS.map((c) => c[0]));
// the Ledger ink of each verdict (palette.css --led-*), used for the record's stamp
const VERDICT_INK = { came_true: 'right', came_true_late: 'late', wrong: 'wrong' };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// the record's first sentence, whole: no cut on a character count, so no ellipsis on the board
const firstSentence = (t) => { const m = /^(.+?[.!?])(?=\s+[A-Z\u201C"(]|\s*$)/.exec(String(t || '').trim()); return m ? m[1] : String(t || '').trim(); };
// the shared stamp's word over the stage: RIGHT when the calls agree, the record's verdict when they differ
const BIG = { came_true: 'Came true', came_true_late: 'Late', wrong: 'Wrong' };

export default function mount(el, ctx) {
  const E = createEngine(el, ctx, 'call');
  const { $, db, G, SET, decode, enter, tally, inkRound, headline, tracker, zone3, pick, need, setOf, verdict } = E;
  const k = 'call';
  const callPool = () => (db.predictions || []).filter((p) => SETTLED.has(p.outcome));
  // the Ledger's own came-true rate: settled forecasts (pending and misattributed left out), came true early or late
  function ledgerRate() {
    const judged = (db.predictions || []).filter((p) => ['came_true', 'came_true_late', 'partly', 'wrong'].includes(p.outcome));
    const came = judged.filter((p) => p.outcome === 'came_true' || p.outcome === 'came_true_late').length;
    return { judged: judged.length, came, rate: judged.length ? came / judged.length : 0 };
  }

  // the timeline inside the card: a rule from the decade before the forecast to 2026, the forecast's date as a tick in
  // ink a, the year it named as a tick in ink b with the span between them; no year named leaves the span open to 2026
  function timeline(p) {
    const made = +p.year_made, target = hasYear(p) ? +p.predicted_for : null;
    const lo = Math.floor((Math.min(made, target ?? made) - 10) / 10) * 10, hi = Math.max(NOW, target ?? NOW);
    const x = (y) => Math.max(0, Math.min(100, ((y - lo) / (hi - lo)) * 100));
    const xm = x(made), xt = target ? x(target) : 100, span = Math.abs(xt - xm);
    const gap = target ? target - made : NOW - made;
    const right = (pct) => (pct > 78 ? ' r' : '');
    const spanLabel = span >= 12 ? `<span class="gm-tl-gap" style="left:${Math.min(xm, xt)}%;width:${span}%">${target ? `${plural(gap, 'year')} ahead` : 'no year named'}</span>` : '';
    return `<div class="gm-tl" aria-hidden="true" data-chart>
      <i class="gm-tl-rule"></i>
      <span class="gm-tl-span${target ? '' : ' open'}" style="left:${Math.min(xm, xt)}%;width:${span}%"></span>${spanLabel}
      <b class="gm-tl-tick made${right(xm)}" style="left:${xm}%"><i></i><span>${made}</span></b>
      ${target ? `<b class="gm-tl-tick for${right(xt)}" style="left:${xt}%"><i></i><span>for ${target}</span></b>` : ''}
      ${!target || hi - target > (hi - lo) * 0.1 ? `<b class="gm-tl-tick now r${xt > 90 && target ? ' up' : ''}" style="left:${x(hi)}%"><i></i><span>${hi}</span></b>` : ''}
    </div>`;
  }
  const foot = (p) => `${p.who}, ${p.year_made}${hasYear(p) ? ` \u00B7 for ${p.predicted_for}` : ' \u00B7 no year named'}`;
  // 26 words on the stage, 22 under 480px wide
  const quoteOf = (p) => { const cap = window.innerWidth < 480 ? 22 : 26; return p.quote ? `\u201C${cutWords(p.quote, cap)}\u201D` : cutWords(p.claim, cap); };
  const words = (t) => String(t).split(/\s+/).length;

  async function dealCall() {
    const board = $('[data-board="call"]'); board.setAttribute('aria-busy', 'true');
    await need('predictions');
    const pool = callPool(); let p = null;
    for (let i = 0; i < 60 && (!p || G.seen.has(p.id)); i++) p = pick(pool);
    if (!p) { board.removeAttribute('aria-busy'); board.innerHTML = '<p class="gm-hint">The Ledger has not arrived.</p>'; return; }
    G.call = { p, done: false };
    board.removeAttribute('aria-busy'); board.classList.remove('is-in', 'is-answered', 'agree', 'differ');
    const q = quoteOf(p);
    board.innerHTML = `
      <div class="gm-stage">${headline(k)}
        <div class="gm-one gm-fc from-l${words(q) > 18 ? ' long' : words(q) <= 9 ? ' short' : ''}">
          <blockquote class="gm-ct" data-chart>${esc(q)}</blockquote>
          ${timeline(p)}
          <span class="gm-cd">${esc(foot(p))}</span>
        </div>
      </div>
      <div class="gm-strip gm-bstrip">
        ${tracker(k)}<p class="gm-bline" data-bline aria-live="polite"></p>
        <div class="gm-ctl"><div class="gm-calls" role="group" aria-label="Your call">${CALLS.map(([kk, l], i) => `<button type="button" class="gm-call t${i}" data-call="${kk}"><span class="gm-call-w">${l}</span><span class="gm-call-stamps" aria-hidden="true"></span></button>`).join('')}<span class="gm-hint sr-only">Left and right arrows move between the calls; Enter makes one.</span></div></div>
      </div>
      ${zone3(k)}`;
    // the span's label stays only where the span has room for it (measured, so phones drop it on short spans)
    const gapL = board.querySelector('.gm-tl-gap'); if (gapL && gapL.scrollWidth + 16 > gapL.clientWidth) gapL.remove();
    // on a phone all three year labels sit above the rule; 2026 steps aside when the year named is close to it
    const nowL = board.querySelector('.gm-tl-tick.now > span'), forL = board.querySelector('.gm-tl-tick.for > span');
    if (nowL && forL && window.innerWidth <= 760) { const a = nowL.getBoundingClientRect(), b = forL.getBoundingClientRect(); if (a.left < b.right + 6 && b.left < a.right + 6) nowL.remove(); }
    markCells(board); inkRound(board); enter(board);
  }

  // the tracker's filled cells carry the round's record (who, year: verdict) on hover
  const markCells = (board) => { const st = setOf(k); board.querySelectorAll('.gm-cells > i').forEach((c, i) => { if (st.log[i]) c.title = st.log[i].line; }); };

  // the stamps: Yours in black on the chosen button, the record's in its verdict ink on the button it judged
  const yours = () => '<span class="gm-stamp gm-st yours" aria-hidden="true">Yours</span>';
  const record = (outcome) => `<span class="gm-stamp gm-st rec v-${VERDICT_INK[outcome]}" aria-hidden="true">Record</span>`;
  const beat = (fn, ms) => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? fn() : setTimeout(fn, ms));

  function answerCall(call) {
    const c = G.call; if (!c || c.done) return; c.done = true;
    const p = c.p, right = call === p.outcome;
    G.seen.add(p.id);
    const board = $('[data-board="call"]');
    board.classList.add('is-answered', right ? 'agree' : 'differ');
    board.querySelectorAll('.gm-call').forEach((b) => {
      const mine = b.dataset.call === call, rec = b.dataset.call === p.outcome;
      b.disabled = true; b.setAttribute('aria-pressed', String(mine));
      if (mine) b.classList.add('is-pick'); if (rec) b.classList.add('is-record');
    });
    // beat 1: Yours drops in (220ms); beat 2: the record's stamp lands beside or across; beat 3: the strip prints, the
    // board flashes in ink a or ink b, the docket prints the record's reason and the next forecast is offered
    board.querySelector(`.gm-call[data-call="${call}"] .gm-call-stamps`).insertAdjacentHTML('beforeend', yours());
    // the record's button fills solid in its tint for 600ms as its stamp lands; the other two fall back
    beat(() => {
      const rb = board.querySelector('.gm-call.is-record'); rb.querySelector('.gm-call-stamps').insertAdjacentHTML('beforeend', record(p.outcome)); rb.classList.add('lit'); setTimeout(() => rb.classList.remove('lit'), 600);
      // the shared stamp lands over the stage's right half on the same beat (it flashes the board); the word is RIGHT when
      // the calls agree, the record's verdict when they differ (the Yours stamp already names your call)
      verdict(board, right, right ? 'You and the record agree' : '');
      const slot = board.querySelector('.gm-verdict-slot'), big = slot && slot.querySelector('.gm-big-stamp');
      if (big && !right) { big.textContent = BIG[p.outcome]; big.classList.add(`v-${VERDICT_INK[p.outcome]}`); }
      // on a phone the stamp sits under the rule at the stage's foot (no note there); the years sit above the rule, so nothing is covered
      if (slot && window.innerWidth <= 760) { slot.style.top = 'auto'; slot.style.bottom = '4px'; slot.style.transform = 'translate(-50%, 0)'; }
    }, 300);
    beat(() => {
      const line = board.querySelector('[data-bline]');
      // the strip's line is the record's fact, its first sentence whole, in display type sized to its length
      const fact = firstSentence(p.outcome_note);
      line.classList.toggle('len-m', fact.length > 110 && fact.length <= 160); line.classList.toggle('len-l', fact.length > 160);
      line.innerHTML = `<span data-decode-text>${esc(fact)}</span>`;
      decode(line, 300);
      board.querySelector('.gm-bstrip').insertAdjacentHTML('beforeend', '<button type="button" class="gm-next" data-start="call">Next forecast</button>');
      const dock = board.querySelector('.gm-result');
      // the docket: the link to the record; the set's rounds live on the tracker's cells
      dock.innerHTML = `<a class="gm-open" href="#v=predictions&e=${esc(p.id)}">Open the record <span aria-hidden="true">&rarr;</span></a>`;
      markCells(board);
      // on a phone the strip and the docket sit under the stage; when the reason falls below the fold the strip rises
      // to the top of the screen so the line, the three posters, Next forecast and the reason are read together
      const sc = board.closest('.view');
      if (window.innerWidth <= 760 && sc && dock.getBoundingClientRect().bottom > sc.getBoundingClientRect().bottom) {
        const strip = board.querySelector('.gm-bstrip'), reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        sc.scrollTo({ top: sc.scrollTop + strip.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8, behavior: reduce ? 'auto' : 'smooth' });
      }
    }, 600);
    tally(k, right, right ? 1 : 0, { came: p.outcome !== 'wrong', year: p.year_made, outcome: p.outcome }, `${p.who}, ${p.year_made}: ${STAMP_WORD[p.outcome].toLowerCase()}`);
    if (setOf(k).n >= SET) setTimeout(scoreCard, 1800);
  }

  // after ten: the hits against the Ledger's own came-true rate, written from the data in hand
  function scoreCard() {
    const st = setOf(k), board = $('[data-board="call"]'), hits = st.hits.filter(Boolean).length;
    const L = ledgerRate(), yr = Math.min(...st.extra.map((x) => x.year));
    const line = hits / SET > L.rate ? `You read the record better than ${yr}\u2019s forecasters` : 'The record was harder than it looks';
    const sub = `Of ${L.judged} forecasts the Ledger has judged, ${L.came} came true.`;
    board.classList.remove('is-answered', 'agree', 'differ', 'is-in');
    board.innerHTML = `<div class="gm-card-set"><p class="gm-set-k">Did it come true? \u00B7 ten rounds</p><b class="gm-set-n" data-decode>${hits} of ${SET}</b><p class="gm-set-line">${esc(line)}</p><p class="gm-set-sub">${esc(sub)}</p><span class="gm-cells big" aria-hidden="true">${st.hits.map((h) => `<i class="${h ? 'r' : 'w'}"></i>`).join('')}</span><div class="gm-set-act"><button type="button" class="gm-start" data-again="call">Play again</button><a class="gm-start ghost" href="#v=first">Try Which came first</a></div></div>`;
    inkRound(board); enter(board);
  }

  E.H.deal = dealCall; E.H.call = answerCall;
  return E.view();
}
