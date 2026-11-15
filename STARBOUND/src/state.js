// Single authoritative mission state. Every level reads and writes this object.
const KEY = 'starbound.save.v2';
const SKEY = 'starbound.settings.v1';
export const STAGES = ['arrive', 'crew', 'briefing', 'payload', 'spacecraft', 'launch', 'orbit', 'ops', 'analysis', 'report'];

export function freshState() {
  return {
    stage: 0,
    met: { specialist: false, scientist: false, engineer: false, ops: false },
    heard: {},
    payload: null,
    payloadWarned: false,
    bus: { power: null, comms: null, storage: null, thermal: null, adcs: null },
    vehicle: null,
    validated: false,
    validationFailures: 0,
    checklistErrors: 0,
    launch: null,      // ascent result
    orbit: null,
    opsResult: null,   // delivered mask, noise factors, log, stats
    marks: [],
    period: null,
    assessment: null,
    score: null,
    plannedOrbit: null, points: 0, awarded: {}, pointLog: [], patches: {}, guidance: null, acquire: null,
    timer: null,       // { stage, used } for the task in progress
    times: {},         // finished tasks: stage name -> { used, limit }
    runs: 0,
  };
}

export const state = freshState();
export const settings = {
  sound: false, mode: 'quick', assist: 'guided', timers: 'on', avatar: null, playerName: '', view: 'third', sensitivity: 1, quality: 'auto', reducedMotion: false,
  volume: { master: 0.8, ambience: 0.6, effects: 0.8 },
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function commit() { save(); listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }
export const isQuick = () => settings.mode !== 'full';
export function stageName() { return STAGES[state.stage]; }
export function setStage(name) { const i = STAGES.indexOf(name); if (i >= 0) { state.stage = i; commit(); } }
export function atLeast(name) { return state.stage >= STAGES.indexOf(name); }

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(SKEY, JSON.stringify(settings));
  } catch (e) { /* storage unavailable: play continues in memory */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (s) { Object.assign(settings, s, { volume: Object.assign({}, settings.volume, s.volume) }); }
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d.stage === 'number') {
      Object.assign(state, freshState(), d);
      // An interrupted launch or operations phase restarts from its beginning.
      if (STAGES[state.stage] === 'ops') { state.stage = STAGES.indexOf('orbit'); state.orbit = null; }
      return true;
    }
  } catch (e) { /* ignore corrupt save */ }
  return false;
}
// Replay: wipe the mission but keep settings. keepCrew skips re-introductions.
export function resetMission(keepCrew = true) {
  const runs = state.runs + 1;
  const heard = keepCrew ? state.heard : {};
  const met = keepCrew ? state.met : freshState().met;
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, freshState(), { runs, heard, met });
  if (keepCrew) state.stage = STAGES.indexOf('payload');
  commit();
}
export function hardReset() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, freshState());
  commit();
}
