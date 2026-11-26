// PLAY, the index of games across the atlas (search and counts); the three inline games follow it
import { aiCount } from '../data.js';
// the index: title, one instruction, the count it draws on (from the loaded record), the first move
const INDEX = [
  { id: 'ledger', title: 'Score the forecasts', how: 'Read each forecast, give your verdict, and the record answers with its own.', go: '#v=predictions', act: 'Open the Ledger', count: (db) => [db.predictions?.length, 'forecasts'] },
  { id: 'thread', title: 'Build a thread', how: 'Search the record, pull events into a thread of your own, name it and copy its link.', go: '#v=threads&m=mine_', act: 'Open the builder', count: (db) => [db.events?.length, 'events to draw from'] },
  { id: 'strata', title: 'Peel the Strata', how: 'Drag the peel slider and a century of AI comes apart into its layers.', go: '#v=strata', act: 'Open the Strata', count: () => [aiCount({ from: 1926, to: 2026 }), 'events about AI, 1926 to 2026'] },
  { id: 'stream', title: 'Lasso the Stream', how: 'Switch the drag to lasso and ring a region; the events inside list themselves.', go: '#v=stream', act: 'Open the Stream', count: (db) => [db.events?.length, 'events in the stream'] },
  { id: 'race', title: 'Race the diffusion curves', how: 'Every curve starts its clock the year it crossed ten percent of households. Watch which reached ninety first.', go: '#v=diffusion&m=race', act: 'Start the race', count: () => { const A = seriesById('adoption'); return [A ? Object.keys(A.technologies).filter((n) => !/alt\. series/.test(n) && n !== 'Television').length : null, 'technologies']; } },
  { id: 'patterns', title: 'Tune a pattern', how: 'Move a threshold and the finding is recomputed in front of you, the prior state left as a ghost.', go: '#v=patterns', act: 'Open the Patterns', count: (db) => [db.patterns?.length, 'findings'] },
  { id: 'walk', title: 'Walk a thread', how: 'A narrated walk across the views, one stop at a time, with the record open at each.', go: (db) => `#v=threads&tr=${db.tours?.[0]?.id || 'automation'}.1`, act: 'Start a walk', count: (db) => [db.tours?.length, 'walks'] },
];
// the games played on this page, in order: Which came first, Guess the year, Beat the forecasters
const INLINE = 3;
export const GAMES_N = INDEX.length + INLINE;
// the search index (ui.js): every game by id and title, the three inline ones after the index
export const GAMES = [...INDEX.map(({ id, title, how }) => ({ id, title, how })), { id: 'first', title: 'Which came first' }, { id: 'year', title: 'Guess the year' }, { id: 'call', title: 'Beat the forecasters' }];
