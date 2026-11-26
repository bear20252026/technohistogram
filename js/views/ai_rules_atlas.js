// AI · RULES, screen 2: the Policy atlas (policy.js) on navy in the four inks' navy-safe steps; screens 1 and 3 are rules_positions.js.
// The atlas reads db.policy at mount, so the data is ensured first and the first render is replayed once it lands.
import { ensure } from '../data.js';
import policy from './policy.js';

export const SCREENS = [{ id: 'positions', title: 'Positions' }, { id: 'atlas', title: 'Policy atlas' }, { id: 'voices', title: 'Disagreements' }];

export default function aiRulesAtlas(el, ctx) {
  el.classList.add('scroll-y', 'atlas');
  let api = null, pending = null;
  ensure('policy').then(() => { api = policy(el, ctx); if (pending) api.render(pending, new Set(['*'])); pending = null; });
  return {
    render(state, ch) { if (api) api.render(state, ch); else pending = state; },
    resize() { if (api && api.resize) api.resize(); },
    hover(id) { if (api && api.hover) api.hover(id); },
    lit(l) { if (api && api.lit) api.lit(l); },
  };
}
