// PLAY, legacy shim: the three games live in play_first.js, play_year.js and play_beat.js on the shared engine
// (play_shared.js). This module keeps older mounts and the search index working: it mounts the game the state names.
import playFirst from './play_first.js';
import playYear from './play_year.js';
import playBeat from './play_beat.js';
export { GAMES_N, GAMES } from './play_index.js';
export default function games(el, ctx, st) {
  const k = st && st.view === 'year' ? 'year' : st && st.view === 'beat' ? 'beat' : 'first';
  return ({ first: playFirst, year: playYear, beat: playBeat })[k](el, ctx);
}
