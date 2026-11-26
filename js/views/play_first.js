// PLAY, Which came first: the game's own deal and answer; everything else comes from play_shared.js
import { createEngine, esc, yearText, oneLine, cutWords, attrib, CALLS, STAMP_WORD } from './play_shared.js';

export default function mount(el, ctx) {
  const E = createEngine(el, ctx, 'first');
  const { $, db, G, stamp, decode, enter, verdict, span, tally, after, inkRound, recordLine, headline, strip, zone3, header, yearPoints, WINDOW, pick, need, ready, drawOne, drawPair } = E;
  async function dealFirst() {
    const k = 'first', board = $('[data-board="first"]'); board.setAttribute('aria-busy', 'true');
    await ready();
    const [a, b] = drawPair(); G.first = { a, b, done: false };
    board.removeAttribute('aria-busy'); board.classList.remove('is-in');
    board.innerHTML = `
      <div class="gm-stage">${headline(k)}
        <div class="gm-pair" role="group" aria-label="Two events, pick the earlier">
          <button type="button" class="gm-card from-l" data-pick="a">${header(a)}<span class="gm-ct">${esc(a.title_short)}</span><span class="gm-cy" aria-hidden="true"></span></button>
          <button type="button" class="gm-card from-r" data-pick="b">${header(b)}<span class="gm-ct">${esc(b.title_short)}</span><span class="gm-cy" aria-hidden="true"></span></button>
          <span class="gm-hint sr-only">Left and right arrows move between the two; Enter picks.</span>
        </div>
      </div>
      ${strip(k, '')}
      ${zone3(k)}`;
    inkRound(board); enter(board);
  }
  function answerFirst(side) {
    const f = G.first; if (!f || f.done) return; f.done = true;
    const picked = f[side], other = side === 'a' ? f.b : f.a;
    const right = picked.year <= other.year; // equal years cannot occur (three years apart at least)
    const first = f.a.year <= f.b.year ? 'a' : 'b', second = first === 'a' ? 'b' : 'a';
    const gap = Math.abs(f.a.year - f.b.year);
    G.seen.add(f.a.id); G.seen.add(f.b.id);
    const board = $('[data-board="first"]');
    board.classList.add('is-answered');
    ['a', 'b'].forEach((kk) => {
      const c = board.querySelector(`[data-pick="${kk}"]`); c.disabled = true; c.classList.add('is-answer', kk === first ? 'is-first' : 'is-second'); if (kk === side) c.classList.add('is-pick', right ? 'is-right' : 'is-wrong');
      c.querySelector('.gm-cy').innerHTML = `<b data-decode>${esc(yearText(f[kk]))}</b>`;
      if (kk === first) c.insertAdjacentHTML('beforeend', '<span class="gm-band" aria-hidden="true">First</span>'); // the poster band across the card's corner
    });
    board.querySelector('.gm-result').innerHTML = `<p class="gm-line">${esc(oneLine(f[first].summary, 110))}</p>${recordLine(f[first])}`;
    tally('first', right, right ? 1 : 0, null, `${f[first].title_short}, ${f[first].year}`);
    if (!right) { const c = board.querySelector(`[data-pick="${side}"]`); c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 420); }
    // the years print on a beat, then the stamp drops
    setTimeout(() => { board.classList.add('years-in'); decode(board.querySelector('.gm-pair'), 360); }, 200);
    setTimeout(() => board.classList.add('band-in'), 420);
    // after the reveal the strip offers the next pair as a poster button in the round's ink
    board.querySelector('.gm-ctl').insertAdjacentHTML('beforeend', '<button type="button" class="gm-next" data-start="first">Next pair <span aria-hidden="true">&rarr;</span></button>');
    // the stamp lands at the picked card's year row; the bracket draws across the gutter from one year to the other
    setTimeout(() => verdict(board, right, '', board.querySelector(`[data-pick="${side}"]`)), 560);
    setTimeout(() => span(board.querySelector('.gm-stage'), board.querySelector('[data-pick="a"] .gm-cy b'), board.querySelector('[data-pick="b"] .gm-cy b'), `${gap} ${gap === 1 ? 'year' : 'years'}`, board.querySelector(`[data-pick="${first}"] .gm-cy b`)), 700); // the measure sits under the winner's year, clear of the stamp
    after('first');
  }

  // ---------- Guess the year ----------
  E.H.deal = dealFirst; E.H.pick = answerFirst;
  return E.view();
}
