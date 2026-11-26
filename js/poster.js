// The poster: one still of the arrival for automated capture. The link card (Slack, the artifact page) is a screenshot a
// headless browser takes of this page about eight seconds in. That browser presents itself as an ordinary desktop Chrome,
// but it has no input device at all: no fine pointer, no hover, no touch points, a combination no laptop, desktop or
// phone reports. On that signal (or navigator.webdriver, which plainer automation sets) the arrival draws one composed
// still, the globe mid-burst with the first loops of the coil formed beneath it, instead of whichever frame the timer
// happens to catch. A hash of poster=1 asks for the same still in any browser; poster=<year>,<window>,<ahead>,<ball>,
// <lift>,<ox>,<oy>,<spin>,<rise> tunes it for review. Anyone who does reach the still can click or press a key to go on
// to the page, and it lets go on its own after half a minute. Without the signal POSTER is null and nothing here applies.
import { hashParams } from './store.js';

const DEFAULTS = {
  year: 1400,   // the coil beneath is formed to this year plus forty (the helix's horizon); the camera holds this year in hand
  window: 160,  // the years in flight between the formed edge and the globe
  ahead: 60,    // where the globe hangs: years past the formed edge along the coil's axis, clear of the last numeral
  ball: 1.15,   // the globe's radius as a share of the loop radius on screen
  lift: 0.38,   // the camera's extra distance (the helix's cam.lift)
  ox: 0.58,     // the loop in hand's centre on the stage, as shares of its width and height; the still sits high so the
  oy: 0.34,     // card's crop (the top half of the frame) holds the whole globe and the loops with a margin
  spin: 2.6,    // the globe's turn, radians: the opening where the pictures have left faces the coil
  rise: 0.5,    // how far the globe hangs above the coil's axis, as a share of the loop radius (it arrived from above)
};

function parse(raw) {
  const v = String(raw || '').split(',').map((s) => parseFloat(s));
  const keys = ['year', 'window', 'ahead', 'ball', 'lift', 'ox', 'oy', 'spin', 'rise'];
  const out = { ...DEFAULTS };
  if (v.length > 1 || (v.length === 1 && v[0] > 1026)) keys.forEach((k, i) => { if (Number.isFinite(v[i])) out[k] = v[i]; });
  return out;
}

const asked = hashParams().get('poster');
const noInput = !matchMedia('(pointer: fine)').matches && !matchMedia('(hover: hover)').matches && !(navigator.maxTouchPoints > 0);
export const POSTER = asked != null ? parse(asked) : (navigator.webdriver || noInput ? { ...DEFAULTS } : null);

// The still has no chrome: the top bar goes and the stage takes the whole viewport, so the coil beneath and the globe share one frame.
if (POSTER) { const st = document.createElement('style'); st.id = 'poster-style'; st.textContent = '.topbar { display: none !important; }'; document.head.appendChild(st); }
