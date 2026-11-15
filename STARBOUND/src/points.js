// Mission points: a running score that rewards doing things and subtracts for running over time.
import { state, save } from './state.js';
let listener = null;
export const setPointsListener = (fn) => { listener = fn; };
export function award(id, pts, label, once = true) {
  if (once && state.awarded[id]) return false; state.awarded[id] = true;
  state.points = Math.max(0, state.points + pts); state.pointLog.push({ label, pts }); save();
  if (listener) listener(pts, label, state.points); return true;
}
export const RANKS = [[0, 'Trainee'], [800, 'Flight Controller'], [1600, 'Mission Engineer'], [2400, 'Mission Lead'], [3200, 'Flight Director'], [4000, 'Starbound Commander']];
export function rankFor(p) { let r = RANKS[0][1], next = null; for (const [min, name] of RANKS) { if (p >= min) r = name; else if (next === null) next = min; } return { name: r, next }; }
