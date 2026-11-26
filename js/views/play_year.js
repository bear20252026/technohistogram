// PLAY, Guess the year (play_year.js): one event in poster letters and a ruler the width of the strip. The slider is the
// ruler (8px track, decade ticks, century numerals in poster mono), your year rides the thumb and prints at 96px while
// you drag, Lock this year is a full-height black block at the right end. On lock the true year drops onto the ruler
// as a black No. stamp on a 220ms beat (the one copy of the true year on the board), a bracket draws from your mark to
// the stamp with the distance over it, the shared RIGHT or WRONG stamp lands beside the ruler (within five years is
// right), the points land in the corner, the board flashes in the ink. Everything shared (the set of ten, the tracker,
// the corner, the docket) is play_shared.js.
import { createEngine, esc, oneLine, YEAR_LO, YEAR_HI } from './play_shared.js';

// the board flashes ink a and the tracker cell fills ink a within this many years of the record; points still land by
// distance (three within ten, two within twenty-five, one within fifty)
const HIT = 5;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.matchMedia('(max-width: 760px)').matches;
const pct = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const offBy = (d) => (d === 0 ? 'Spot on' : `Off by ${plural(d, 'year')}`);

export default function mount(el, ctx) {
  const E = createEngine(el, ctx, 'year');
  const { $, G, stamp, decode, enter, tally, after, verdict, inkRound, recordLine, headline, strip, zone3, header, yearPoints, WINDOW, ready, drawOne } = E;

  // the ruler: a tick every decade (every twenty years on a phone, the half centuries kept), the half century taller,
  // the century tallest and numbered in poster mono; the window's two ends are numbered when no numeral is near (room for the label at the width in play)
  function ruler(lo, hi) {
    const phone = narrow(), ticks = [];
    for (let y = Math.ceil(lo / 10) * 10; y <= hi; y += 10) if (!phone || y % 20 === 0 || y % 50 === 0) ticks.push(y);
    const labelled = ticks.filter((y) => y % 50 === 0);
    const near = (y) => labelled.some((l) => Math.abs(l - y) < (narrow() ? 26 : 14));
    const tick = (y) => `<i class="${y % 100 === 0 ? 'c' : y % 50 === 0 ? 'h' : ''}" style="left:${pct(y, lo, hi)}%">${y % 100 === 0 ? `<b>${y}</b>` : y % 50 === 0 ? `<b class="s">${y}</b>` : ''}</i>`;
    const end = (y, side) => (near(y) ? '' : `<em class="${side}" style="left:${pct(y, lo, hi)}%">${y}</em>`);
    return `<div class="gm-ticks" aria-hidden="true" data-chart>${ticks.map(tick).join('')}${end(lo, 'lo')}${end(hi, 'hi')}</div>`;
  }
  // the readout and the rider over the thumb print the year at once; the ruler keeps the thumb's position as --at
  function follow(board) {
    const r = board.querySelector('[data-year]'), out = board.querySelector('.gm-yv'), cur = board.querySelector('.gm-cur');
    if (!r || !out) return;
    out.textContent = r.value; if (cur) cur.textContent = r.value;
    board.querySelector('.gm-ruler').style.setProperty('--at', `${pct(+r.value, +r.min, +r.max)}%`);
  }

  async function dealYear() {
    const k = 'year', board = $('[data-board="year"]'); board.setAttribute('aria-busy', 'true');
    await ready();
    const e = drawOne(); G.year = { e, done: false };
    board.removeAttribute('aria-busy'); board.classList.remove('is-in', 'is-answered', 'is-locked', 'is-hit', 'is-tight');
    // a window a person can aim in: 120 years round a decoy midpoint, so the centre gives nothing away
    let mid = e.year + Math.round((Math.random() * 2 - 1) * (WINDOW / 2 - 15));
    mid = Math.max(YEAR_LO + WINDOW / 2, Math.min(YEAR_HI - WINDOW / 2, mid));
    const lo = mid - WINDOW / 2, hi = mid + WINDOW / 2;
    G.year.lo = lo; G.year.hi = hi;
    board.innerHTML = `
      <div class="gm-stage">${headline(k)}
        <div class="gm-one from-l">${header(e)}<span class="gm-ct">${esc(e.title_short)}</span></div>
      </div>
      ${strip(k, `<div class="gm-ruler-row">
        <div class="gm-ruler" style="--at:50%" data-chart>${ruler(lo, hi)}<div class="gm-ruler-cur" aria-hidden="true"><b class="gm-cur">${mid}</b></div><input type="range" min="${lo}" max="${hi}" step="1" value="${mid}" data-year aria-label="Your year, ${lo} to ${hi}" aria-describedby="gm-year-hint"><div class="gm-ruler-marks" aria-hidden="true"></div></div>
        <div class="gm-yv-w" data-chart><span class="gm-yl">Your year</span><output class="gm-yv" for="" aria-live="off">${mid}</output></div>
        <button type="button" class="gm-lock" data-answer><span>Lock this year</span></button>
        <span class="gm-hint sr-only" id="gm-year-hint">Arrow keys move the slider a year; Enter locks it.</span></div>`)}
      ${zone3(k)}`;
    inkRound(board); enter(board);
  }

  function answerYear() {
    const y = G.year; if (!y || y.done) return; y.done = true;
    const board = $('[data-board="year"]'), range = board.querySelector('[data-year]');
    const guess = +range.value, truth = y.e.year;
    const d = Math.abs(guess - truth), pts = yearPoints(d), hit = d <= HIT;
    G.seen.add(y.e.id);
    board.classList.add('is-answered'); board.classList.toggle('is-hit', hit);
    range.disabled = true;
    board.querySelector('[data-answer]').outerHTML = '<button type="button" class="gm-lock next" data-start="year"><span>Next event</span></button>';
    // the true year drops onto the ruler as a black stamp; the bracket draws from your mark to it with the distance in years over it
    const { lo, hi } = y; const tp = Math.max(0, Math.min(100, pct(truth, lo, hi))), gp = pct(guess, lo, hi);
    const from = gp <= tp ? 'l' : 'r';
    const span = (Math.abs(tp - gp) / 100) * (board.querySelector('.gm-ruler').clientWidth - 16);
    board.classList.toggle('is-tight', span < 150);
    // an end label under the stamp's footprint (60px either side) yields to it; the stamp carries the number
    const w = board.querySelector('.gm-ruler').clientWidth - 10, tx = (tp / 100) * w;
    board.querySelectorAll('.gm-ticks em').forEach((em) => { em.classList.toggle('under', Math.abs((pct(+em.textContent, lo, hi) / 100) * w - tx) < 60); });
    board.querySelector('.gm-ruler-marks').innerHTML = `
      <span class="gm-ruler-stamp" style="--tp:${tp}%">${stamp(`No. ${truth}`, 'black')}</span>
      <span class="gm-bracket from-${from}${d === 0 ? ' zero' : ''}" style="left:${Math.min(tp, gp)}%;width:${Math.abs(tp - gp)}%"></span>
      ${d ? `<b class="gm-off" style="--mid:${(tp + gp) / 2}%">${esc(plural(d, 'year'))}</b>` : ''}`;
    board.querySelector('.gm-result').innerHTML = `<p class="gm-line">${esc(oneLine(y.e.summary, 120))}</p>${recordLine(y.e)}`;
    tally('year', hit, pts, d);
    // the points rise off the corner numeral
    if (pts) board.querySelector('.gm-big')?.insertAdjacentHTML('beforeend', `<i class="gm-plus" aria-hidden="true">+${pts}</i>`);
    // the beats: the ruler stamp lands (220ms), the bracket draws behind it; the shared verdict stamp
    // drops on the same beat and flashes the board
    const cut = reduced();
    const beat = (ms, fn) => (cut ? fn() : setTimeout(fn, ms));
    requestAnimationFrame(() => requestAnimationFrame(() => board.classList.add('is-locked')));
    // RIGHT within five years, WRONG beyond, as on the other boards; the bracket carries the number. At desk widths the
    // stamp lands where the readout stood, centred on the track between the ruler and Next; on a phone it takes the band
    // under the stage's year (play_year.css)
    verdict(board, hit, '');
    const slot = board.querySelector('.gm-verdict-slot');
    if (slot && !narrow()) {
      const sr = board.querySelector('.gm-stage').getBoundingClientRect(), cr = board.querySelector('.gm-yv-w').getBoundingClientRect(), tr = board.querySelector('.gm-ruler input').getBoundingClientRect();
      slot.style.left = `${Math.round(cr.left + cr.width / 2 - sr.left)}px`; slot.style.top = `${Math.round(tr.top + tr.height / 2 - sr.top)}px`;
    }
    after('year');
  }

  // the readout moves with the thumb, without the engine's 150ms step
  el.addEventListener('input', (ev) => { const r = ev.target.closest('[data-year]'); if (r) follow(r.closest('[data-board]')); });
  // the ruler's ticks thin out on a phone; a resize across the break redraws them for the round in play
  let wasNarrow = narrow();
  const onResize = () => { const now = narrow(); if (now === wasNarrow) return; wasNarrow = now; const y = G.year, rl = $('.gm-ruler .gm-ticks'); if (y && rl) rl.outerHTML = ruler(y.lo, y.hi); };

  E.H.deal = dealYear; E.H.year = answerYear;
  const v = E.view();
  return { ...v, resize() { onResize(); v.resize?.(); } };
}
