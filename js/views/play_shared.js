// PLAY, shared engine (play_shared.js): the set of ten, the tracker, the corner numeral, the stamp, the decode loop, the
// score card, the docket, the ink pairs and the domain glyphs. Each game (play_first.js, play_year.js, play_beat.js) mounts
// through createEngine() and brings only its deal and its answer. games.js re-exports for legacy mounts.
import { esc } from '../ui.js';
export { esc };
import { ensureNow as need, seriesById, aiCount } from '../data.js';
import { DOMAIN } from '../palette.js';
import { ageForYear, REGION } from '../time.js';

export const YEAR_LO = 1026, YEAR_HI = 2026;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// on a coarse pointer the hint names the touch; on a fine one it names the keys
const coarse = () => window.matchMedia('(pointer: coarse)').matches;
const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const domainLabel = (k) => DOMAIN[k]?.label || k;
export const yearText = (e) => `${e.approximate_year ? 'about ' : ''}${e.year}`;
// the first sentence of a record's summary, clipped to one line of reading. A period ends a sentence only when a space
// and a capital follow it and the token before it is longer than two letters and not a short abbreviation; otherwise the
// line is the first 140 characters to a word boundary.
const ABBR = new Set(['dr', 'mr', 'mrs', 'ms', 'st', 'no', 'vs', 'inc', 'co', 'ltd', 'u.s', 'u.k', 'jr', 'sr', 'mt', 'ft', 'fig', 'ca', 'approx']);
const clipWords = (t, n) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '\u2026');
export const oneLine = (s, max = 170) => {
  const t = String(s || '').trim(); if (!t) return '';
  const re = /([.!?])["\u201D)]?\s+(?=["\u201C(]?[A-Z])/g; let m;
  while ((m = re.exec(t))) {
    const tok = (t.slice(0, m.index).match(/(\S+)$/) || ['', ''])[1].replace(/^["\u201C(]+/, '');
    const letters = tok.replace(/[^A-Za-z0-9]/g, '');
    if (m[1] === '.' && (letters.length <= 2 || ABBR.has(tok.toLowerCase().replace(/\.$/, '')))) continue;
    const first = t.slice(0, m.index + m[0].trimEnd().length);
    return first.length <= max ? first : clipWords(first, Math.min(140, max));
  }
  return t.length <= max ? t : clipWords(t, Math.min(140, max));
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
// a forecast is playable when the record has settled it one of three ways
export const CALLS = [['came_true', 'Came true'], ['came_true_late', 'Came true late'], ['wrong', 'Wrong']];
export const STAMP_WORD = { came_true: 'Came true', came_true_late: 'Came true late', wrong: 'Wrong' };
export const hasYear = (p) => p.predicted_for && p.predicted_for !== 'None';
export const meaning = (p) => (p.outcome === 'wrong' ? 'It did not come true.'
  : p.outcome === 'came_true' ? (hasYear(p) ? 'It came true by the year named.' : 'It came true; no year was named.')
    : hasYear(p) ? 'It came true, later than the year named.' : 'No year was named; the record scores it on whether it came true.');
// attribution in sentence case: who, role, year made, the year named
// a quote on the stage stops at 30 words; the Ledger record holds the whole of it
export const cutWords = (t, max) => { const w = String(t || '').split(/\s+/); return w.length <= max ? t : `${w.slice(0, max).join(' ')}\u2026`; };
const roleCase = (r) => (r && /^[A-Z][a-z]/.test(r) ? r.charAt(0).toLowerCase() + r.slice(1) : r || '');
export const attrib = (p, short = false) => [p.who, short ? null : roleCase(p.role), p.year_made, hasYear(p) ? `for ${p.predicted_for}` : 'no year named'].filter(Boolean).join(', ');

export const KINDS = { first: 'first', year: 'year', beat: 'call' };
// the engine: everything the three games share, bound to one mounted element
export function createEngine(el, ctx, kind) {
  el.classList.add('gm-view');
  el.innerHTML = `<div class="gm"><div class="gm-games"><section class="gm-game" data-game="${kind}" aria-label="${kind === 'first' ? 'Which came first' : kind === 'year' ? 'Guess the year' : 'Beat the forecasters'}"><div class="gm-board" data-board="${kind}"></div></section></div></div>`;
  const $ = (s) => el.querySelector(s);
  const G = { first: null, year: null, call: null, seen: new Set() };
  const { db, select } = ctx;

  // ---------- the pool: events with a short title that gives no year away ----------
  let pool = null;
  function buildPool() {
    pool = db.events.filter((e) => e.year >= YEAR_LO && e.year <= YEAR_HI && e.title_short && (e.significance == null || +e.significance >= 3) && !/\d{3,4}/.test(e.title_short) && !/\d{3,4}/.test(e.title || ''));
    if (pool.length < 40) pool = db.events.filter((e) => e.year >= YEAR_LO && e.year <= YEAR_HI && e.title_short && !/\d{3,4}/.test(e.title_short));
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // Which came first asserts "Both are <domain>", so a pair is drawn only where both tags can be right: the record's
  // coarse domains stretch back over clocks, calendars and herbals, and a tag older than its field is left out of pairs
  const DOMAIN_FROM = { space: 1600, ai: 1940, internet: 1960, semiconductors: 1900, software: 1936, computing: 1600, biotech: 1796, energy: 1700, media: 1400 };
  const tagFits = (e) => !(e.domain in DOMAIN_FROM) || e.year >= DOMAIN_FROM[e.domain];
  function drawOne() {
    if (!pool) buildPool();
    for (let i = 0; i < 60; i++) { const e = pick(pool); if (e && !G.seen.has(e.id)) return e; }
    G.seen.clear(); return pick(pool);
  }
  function drawPair() {
    if (!pool) buildPool();
    for (let i = 0; i < 80; i++) {
      const a = pick(pool); if (!a || G.seen.has(a.id) || !tagFits(a)) continue;
      // the gap is capped so the question is a judgment: 25 years at most, 15 once the later event is in or after 1990,
      // and never under three; a mate from the same age (time.js AGES) is preferred, another age only when none is there
      const mates = pool.filter((b) => { if (b.id === a.id || b.domain !== a.domain || !tagFits(b) || G.seen.has(b.id)) return false; const d = Math.abs(b.year - a.year); return d >= 3 && d <= (Math.max(a.year, b.year) >= 1990 ? 15 : 25); });
      const sameAge = mates.filter((b) => ageForYear(b.year) === ageForYear(a.year));
      const from = sameAge.length ? sameAge : mates;
      if (from.length) { const b = pick(from); return Math.random() < 0.5 ? [a, b] : [b, a]; }
    }
    G.seen.clear(); return drawPair();
  }
  async function ready() { await need('past', 'text'); if (!pool || pool.length < db.events.length / 4) buildPool(); }

  // ---------- the set: ten rounds, a tracker, a score card ----------
  const SET = 10;
  const PROMPT = { first: 'Which came first?', year: 'What year?', call: 'Did it come true?' };
  const NEXT = { first: ['year', 'Try Guess the year'], year: ['call', 'Try Beat the forecasters'], call: ['first', 'Try Which came first'] };
  const sets = { first: newSet(), year: newSet(), call: newSet() };
  function newSet() { return { n: 0, pts: 0, hits: [], streak: 0, best: 0, extra: [], log: [] }; }
  const setOf = (k) => sets[k];
  const nn = (i) => String(i).padStart(2, '0');
  // the headline is the prompt in poster letters, the pair's inks alternating round by round
  const headline = (k) => `<h2 class="gm-hl ${setOf(k).n % 2 ? 'ink-b' : 'ink-a'}" data-decode-text>${PROMPT[k]}</h2>`;
  // the round tracker: ten square cells that fill in ink a (right) or ink b (wrong) as the set goes
  const tracker = (k) => { const st = setOf(k); const at = Math.min(SET, st.n + 1);
    return `<div class="gm-track" role="group" aria-label="Round ${at} of ${SET}"><span class="gm-cells" aria-hidden="true">${Array.from({ length: SET }, (_, i) => `<i class="${st.hits[i] === true ? 'r' : st.hits[i] === false ? 'w' : i === st.n ? 'now' : ''}"></i>`).join('')}</span><span class="gm-roundn">Round <b>${at}</b> of ${SET}</span></div>`; };
  // the corner: the set's points as one big numeral, the streak as repeated ink squares
  // the corner: the set's points as one big numeral that pops when it changes, the streak under it from two in a row
  const corner = (k) => { const st = setOf(k);
    return `<div class="gm-ledger" role="group" aria-label="Score"><span class="gm-corner"><b class="gm-big" aria-label="${st.pts} points">${st.pts}</b>${st.streak >= 2 ? `<span class="gm-streak-t">${st.streak} in a row</span>` : ''}</span>${st.n ? '<button type="button" class="gm-reset" data-reset>Start over</button>' : ''}</div>`; };
  const score = (k) => { const board = $(`[data-board="${k}"]`); if (!board) return;
    board.querySelectorAll('.gm-ledger').forEach((n) => { const was = n.querySelector('.gm-big')?.textContent; n.outerHTML = corner(k);
      const big = board.querySelector('.gm-ledger .gm-big'); if (big && was !== undefined && was !== big.textContent && !reduced()) { big.classList.add('pop'); requestAnimationFrame(() => requestAnimationFrame(() => big.classList.remove('pop'))); } });
    board.querySelectorAll('.gm-track').forEach((n) => { n.outerHTML = tracker(k); }); };
  const REST = { first: 'Pick a card; the record answers with the year and its source.', year: 'Lock a year; the record answers with its own and the distance.', call: 'Make the call; the record answers with its verdict.' };
  // at rest from round 2 the docket carries the set's last three results, so the foot is never bare
  const sessionLog = (k) => { const st = setOf(k); if (!st.log.length) return '';
    const rows = st.log.map((r, i) => ({ ...r, i })).slice(-3).reverse();
    return `<ol class="gm-log" aria-label="Last rounds">${rows.map((r) => `<li><i class="${r.right ? 'r' : 'w'}" aria-hidden="true"></i><span class="gm-log-n">${nn(r.i + 1)}</span><span class="gm-log-t">${esc(r.line)}</span><span class="gm-log-p">${r.pts ? `+${r.pts}` : '0'}</span></li>`).join('')}</ol>`; };
  const docket = (k, inner) => `<div class="gm-result" aria-live="polite">${inner || sessionLog(k)}</div>`;
  const zone3 = (k, inner) => `<div class="gm-dock">${docket(k, inner)}${corner(k)}</div>`;
  const strip = (k, inner) => `<div class="gm-strip">${tracker(k)}<div class="gm-ctl">${inner}</div></div>`;
  // a small drawn glyph per domain, the trading-card header mark
  const GLYPH = {
    ai: '<circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="2.5"/>', computing: '<rect x="2" y="2" width="12" height="12"/><path d="M2 8h12M8 2v12"/>', semiconductors: '<rect x="4" y="4" width="8" height="8"/><path d="M1 6h3M1 10h3M12 6h3M12 10h3M6 1v3M10 1v3M6 12v3M10 12v3"/>',
    software: '<path d="M6 2L2 8l4 6M10 2l4 6-4 6"/>', internet: '<circle cx="3" cy="13" r="2"/><circle cx="13" cy="13" r="2"/><circle cx="8" cy="3" r="2"/><path d="M4.5 11.5L7 5M11.5 11.5L9 5M5 13h6"/>', communications: '<path d="M2 8a6 6 0 0 1 12 0M4.5 8a3.5 3.5 0 0 1 7 0"/><circle cx="8" cy="8" r="1.2"/><path d="M8 9v6"/>',
    media: '<rect x="2" y="3" width="12" height="10"/><path d="M2 6h12M5 3v10"/>', society: '<circle cx="5" cy="5" r="2.5"/><circle cx="11" cy="5" r="2.5"/><path d="M1 14a4 4 0 0 1 8 0M7 14a4 4 0 0 1 8 0"/>', energy: '<path d="M9 1L3 9h5l-1 6 6-8H8z"/>', transport: '<circle cx="4.5" cy="12" r="2"/><circle cx="11.5" cy="12" r="2"/><path d="M1 10l2-6h7l3 4h2v2"/>',
    biotech: '<path d="M3 1c0 4 10 4 10 8s-10 4-10 6M13 1c0 4-10 4-10 8s10 4 10 6M5 4h6M5 12h6"/>', space: '<path d="M8 1l2 5 5 .5-4 3.5 1.5 5L8 12l-4.5 3L5 10 1 6.5 6 6z"/>', materials: '<path d="M8 1l6 3.5v7L8 15l-6-3.5v-7z M8 8l6-3.5M8 8v7M8 8L2 4.5"/>',
  };
  GLYPH.agriculture = '<path d="M8 15V7M8 7C8 4 5 2 2 2c0 3 2 6 6 5M8 7c0-3 3-5 6-5 0 3-2 6-6 5"/>'; GLYPH.health = '<path d="M8 2v12M2 8h12"/><circle cx="8" cy="8" r="6.5"/>'; GLYPH.home = '<path d="M2 8l6-6 6 6M4 7v7h8V7"/>';
  const glyph = (d) => `<svg class="gm-gl" viewBox="0 0 16 16" aria-hidden="true">${GLYPH[d] || '<path d="M8 1l7 7-7 7-7-7z"/>'}</svg>`;
  const topLine = (e) => `${domainLabel(e.domain)} \u00B7 ${REGION[e.region]?.short || e.region || ''}`.replace(/ \u00B7 $/, '');
  const header = (e) => `<span class="gm-cd">${esc(topLine(e))}${glyph(e.domain)}</span>`;
  // a year scores by closeness: three points within ten years, two within twenty-five, one within fifty
  const yearPoints = (d) => (d <= 10 ? 3 : d <= 25 ? 2 : d <= 50 ? 1 : 0);
  const WINDOW = 120;
  // Brute Letter: each round deals a pair of printed inks from a twelve-colour cycle (palette.css --play-pair-*; the fallbacks
  // are the same inks). The first letter takes ink a, the second ink b; the stamp stays black.
  const PAIRS = [['cobalt', '#1B365D', 'persimmon', '#B84326'], ['moss', '#2E7D4F', 'plum', '#6a2c5a'], ['rose', '#d2506c', 'ink-blue', '#1c2a58'], ['ochre', '#c6952c', 'slate', '#48596a'], ['brick', '#a63f28', 'sea', '#2a7668'], ['violet', '#5c4a98', 'mustard', '#7A6A1E']];
  let round = 0;
  function inkRound(board) {
    const [na, ca, nb, cb] = PAIRS[round % PAIRS.length]; round += 1;
    const i = ((round - 1) % PAIRS.length) + 1; // palette.css names the pairs 1a/1b … 6a/6b, with a -label ink for small type
    board.style.setProperty('--ink-a', `var(--play-pair-${i}a, ${ca})`); board.style.setProperty('--ink-b', `var(--play-pair-${i}b, ${cb})`);
    board.style.setProperty('--ink-a-l', `var(--play-pair-${i}a-label, ${ca})`); board.style.setProperty('--ink-b-l', `var(--play-pair-${i}b-label, ${cb})`);
  }
  // the answer lands as an Archive Index stamp: the year set as a catalogue number, a hard cut on a beat
  const stamp = (text, k = '') => `<span class="gm-stamp${k ? ` ${k}` : ''}" aria-hidden="true">${esc(text)}</span>`;
  // decode: numerals run through the digits, letters through the alphabet, then settle; one frame loop (static when motion is reduced)
  function decode(root, ms = 360) {
    const nodes = [...root.querySelectorAll('[data-decode], [data-decode-text]')];
    if (!nodes.length) return;
    const finals = nodes.map((n) => n.textContent);
    if (reduced()) return;
    const t0 = performance.now(), ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', DIG = '0123456789';
    const tick = (t) => { const k = Math.min(1, (t - t0) / ms);
      nodes.forEach((n, i) => { const fin = finals[i]; const keep = Math.floor(k * fin.length);
        n.textContent = fin.slice(0, keep) + fin.slice(keep).replace(/[0-9]/g, () => DIG[Math.floor(Math.random() * 10)]).replace(/[A-Za-z]/g, () => ABC[Math.floor(Math.random() * 26)]); });
      if (k < 1) requestAnimationFrame(tick); else nodes.forEach((n, i) => { n.textContent = finals[i]; }); };
    requestAnimationFrame(tick);
  }
  // the deal: letters slide in on a hard beat (CSS transition, 160ms), the headline decodes in
  const enter = (board) => { requestAnimationFrame(() => requestAnimationFrame(() => { board.classList.add('is-in'); })); if (reduced()) return; const hl = board.querySelectorAll('.gm-hl[data-decode-text], .gm-set-n[data-decode]'); hl.forEach((n) => { n.style.visibility = 'hidden'; }); setTimeout(() => { hl.forEach((n) => { n.style.visibility = ''; }); decode(board, 300); }, 620); };
  // the payoff: RIGHT or WRONG stamps across the strip, the board flashes in the ink for 400ms, a note prints under the stamp
  // verdict(board, right, note, anchor): the stamp lands over the stage's right half, or over the anchor (the picked card's
  // lower half on Which came first) so no title is covered
  function verdict(board, right, note, anchor) {
    let slot = board.querySelector('.gm-verdict-slot');
    const stage = board.querySelector('.gm-stage') || board;
    if (!slot) { slot = document.createElement('div'); slot.className = 'gm-verdict-slot'; slot.setAttribute('aria-hidden', 'true'); stage.appendChild(slot); }
    // anchor: an element on the stage; the stamp's top edge sits at the top of its year row (.gm-cy, or the element itself)
    // and the stamp centres on the right 64 percent line of the anchor, clear of the year at its left
    if (anchor) { const sr = stage.getBoundingClientRect(), ar = anchor.getBoundingClientRect(); const foot = anchor.querySelector('.gm-cy') || anchor; const fr = foot.getBoundingClientRect();
      slot.classList.add('anchored'); slot.style.left = `${Math.round(ar.left + ar.width * 0.64 - sr.left)}px`; slot.style.top = `${Math.round(fr.bottom - sr.top)}px`; }
    slot.innerHTML = `<span class="gm-big-stamp ${right ? 'r' : 'w'}">${right ? 'Right' : 'Wrong'}</span>${note ? `<span class="gm-note">${esc(note)}</span>` : ''}`;
    requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.add('is-in')));
    board.classList.remove('flash-r', 'flash-w'); void board.offsetWidth; board.classList.add(right ? 'flash-r' : 'flash-w');
    setTimeout(() => board.classList.remove('flash-r', 'flash-w'), 620);
  }
  // tally(k, right, pts, extra, line): line is the round's one-line record for the session log (the game's own words)
  // span(stage, a, b, label): a bracket from mark a to mark b (elements on the stage), horizontal across a gutter or
  // vertical down a stack, with the measure on its middle; one device for distance across the three games
  // at: the mark the measure sits under (a or b); by default it sits at the bracket's middle
  function span(stage, a, b, label, at) {
    stage.querySelectorAll('.gm-span').forEach((n) => n.remove());
    const sr = stage.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const el = document.createElement('div');
    const stacked = Math.abs(ra.top - rb.top) > Math.abs(ra.left - rb.left);
    if (stacked) { const low = Math.max(ra.bottom, rb.bottom); const lo = Math.min(ra.left, rb.left); el.className = 'gm-span h row'; el.style.left = `${Math.round(lo - sr.left)}px`; el.style.width = `${Math.round(sr.width - 2 * (lo - sr.left))}px`; el.style.top = `${Math.round(low - sr.top + 14)}px`; }
    else { const [l, r] = ra.left <= rb.left ? [ra, rb] : [rb, ra]; el.className = 'gm-span h'; el.style.left = `${Math.round(l.left + l.width / 2 - sr.left)}px`; el.style.width = `${Math.round(r.left + r.width / 2 - l.left - l.width / 2)}px`; el.style.top = `${Math.round(Math.max(ra.bottom, rb.bottom) - sr.top + 6)}px`; }
    el.innerHTML = `<b>${esc(label)}</b>`; el.setAttribute('aria-hidden', 'true'); stage.appendChild(el);
    if (at && !stacked) { const rt = at.getBoundingClientRect(); el.querySelector('b').style.left = `${Math.round(rt.left + rt.width / 2 - sr.left - parseFloat(el.style.left))}px`; }
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in'))); return el;
  }
  function tally(k, right, pts, extra, line) { const st = setOf(k); st.hits[st.n] = right; st.n += 1; st.pts += pts; st.log.push({ right, pts, line: line || (right ? 'Right' : 'Wrong') }); st.streak = right ? st.streak + 1 : 0; st.best = Math.max(st.best, st.streak); if (extra) st.extra.push(extra); score(k); }
  // after ten rounds the score card fills the board in poster letters, with one line drawn from the set's own data
  function setLine(k) { const st = setOf(k), hits = st.hits.filter(Boolean).length;
    if (k === 'first') return hits > 5 ? 'Better than the coin' : hits === 5 ? 'Even with the coin' : 'The coin would beat you';
    if (k === 'year') { const avg = Math.round(st.extra.reduce((a, b) => a + b, 0) / Math.max(1, st.extra.length)); return avg === 0 ? 'Spot on, every time' : `Off by ${avg} years on average`; }
    const theirs = st.extra.filter((x) => x.came).length, yr = Math.min(...st.extra.map((x) => x.year));
    return hits > theirs ? `You beat ${yr}\u2019s forecasters` : hits === theirs ? `Even with ${yr}\u2019s forecasters` : `${yr}\u2019s forecasters beat you`; }
  function scoreCard(k) { const st = setOf(k), board = $(`[data-board="${k}"]`), hits = st.hits.filter(Boolean).length, [nk, nl] = NEXT[k];
    board.innerHTML = `<div class="gm-card-set"><b class="gm-set-n" data-decode>${hits} of ${SET}</b><p class="gm-set-line">${esc(setLine(k))} \u00B7 best streak ${st.best}${st.pts !== hits ? ` \u00B7 ${st.pts} points` : ''}</p><span class="gm-cells big" aria-hidden="true">${st.hits.map((h) => `<i class="${h ? 'r' : 'w'}"></i>`).join('')}</span><div class="gm-set-act"><button type="button" class="gm-start" data-again="${k}">Play again</button><a class="gm-start ghost" href="#v=${nk === 'call' ? 'beat' : nk}">${nl}</a></div></div>`;
    inkRound(board); enter(board); }
  const after = (k) => { if (setOf(k).n >= SET) { setTimeout(() => scoreCard(k), 1400); return true; } return false; };
  const recordLine = (e) => `<button type="button" class="gm-open" data-open="${esc(e.id)}">Open the record <span aria-hidden="true">&rarr;</span></button>`;

  // ---------- events: the game registers its deal and its answers; the engine routes clicks and keys ----------
  const H = { deal: () => {}, pick: null, year: null, call: null };
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.start) H.deal();
    else if (b.dataset.call && H.call) H.call(b.dataset.call);
    else if (b.dataset.pick && H.pick) H.pick(b.dataset.pick);
    else if (b.hasAttribute('data-answer') && H.year) H.year();
    else if (b.dataset.open) select(b.dataset.open);
    else if (b.dataset.again) { sets[kind] = newSet(); G[kind] = null; H.deal(); }
    else if (b.hasAttribute('data-reset')) { sets[kind] = newSet(); score(kind); }
  });
  // Parameter sweep: the slider moves only its own value label in 150ms steps; the record answers on Enter or the button
  let labT = 0, labAt = 0;
  el.addEventListener('input', (ev) => {
    const r = ev.target.closest('[data-year]'); if (!r) return;
    const out = r.closest('.gm-ruler-row').querySelector('.gm-yv'); const now = performance.now();
    clearTimeout(labT);
    if (now - labAt >= 150) { out.textContent = r.value; labAt = now; } else labT = setTimeout(() => { out.textContent = r.value; labAt = performance.now(); }, 150 - (now - labAt));
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.target.closest('[data-year]') && ev.key === 'Enter' && H.year) { ev.preventDefault(); H.year(); return; }
    const c = ev.target.closest('.gm-card[data-pick], .gm-call[data-call]');
    if (c && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); const sel = c.matches('.gm-card') ? '.gm-card[data-pick]' : '.gm-call[data-call]'; const cards = [...el.querySelectorAll(sel)]; const i = cards.indexOf(c); cards[(i + (ev.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length].focus(); }
  });
  let dealt = false;
  // the view contract: render deals once on first paint; the game opens on something dealt
  const view = () => ({ render() { if (!dealt) { dealt = true; H.deal(); } }, resize() {}, hover() {} });
  return { el, $, db, select, G, sets, kind, SET, H, view, need, ready, drawOne, drawPair, pick, headline, tracker, corner, score, docket, zone3, strip, header, topLine, glyph, stamp, decode, enter, verdict, span, tally, after, scoreCard, inkRound, recordLine, yearPoints, WINDOW, setOf, newSet };
}
