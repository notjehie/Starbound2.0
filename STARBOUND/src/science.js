// Data layer + analysis helpers + mission evaluation.
// PRIMARY DATA SOURCE: if data/real_data.js has defined globalThis.STARBOUND_REAL_DATA
// (built by tools/prepare_tess_data.py from real TESS observations), it is used.
// Otherwise a clearly labelled SIMULATED dataset is generated here.
import { totals } from './engineering.js';
import { BUDGET } from './catalog.js';

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussStream(seed) { const r = mulberry(seed); return () => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }

function transit(t, eph) { // smooth-edged box, returns fractional dimming
  const half = eph.durationH / 48; let ph = ((t - eph.t0) % eph.period + eph.period) % eph.period; if (ph > eph.period / 2) ph -= eph.period;
  const x = Math.abs(ph) / half; if (x >= 1) return 0;
  const edge = x > 0.8 ? (1 - x) / 0.2 : 1;
  return eph.depthPpm * 1e-6 * edge;
}

let cache = {};
export function primaryDataset() {
  if (cache.primary) return cache.primary;
  const real = globalThis.STARBOUND_REAL_DATA;
  if (real && real.time && real.flux && real.meta) {
    const t0 = real.time[0];
    cache.primary = { time: real.time.map((x) => x - t0), flux: real.flux, quality: real.quality || real.time.map(() => 0), meta: Object.assign({ real: true }, real.meta), ephemeris: real.meta.ephemeris || [] };
    return cache.primary;
  }
  const N = 60 * 48, time = new Array(N), flux = new Array(N), quality = new Array(N).fill(0);
  const g = gaussStream(700), r = mulberry(1428);
  const ephemeris = [
    { name: 'Signal 1', period: 16.05, t0: 7.0, depthPpm: 3300, durationH: 2.0 },
    { name: 'Signal 2', period: 9.98, t0: 3.4, depthPpm: 500, durationH: 2.2 },
  ];
  for (let i = 0; i < N; i++) {
    const t = i / 48; time[i] = t;
    let f = 1 + 300e-6 * Math.sin((2 * Math.PI * t) / 54 + 0.6) + 120e-6 * Math.sin((2 * Math.PI * t) / 27 + 2.1);
    for (const e of ephemeris) f -= transit(t, e);
    let s = 80e-6;
    if ((t > 12.1 && t < 12.5) || (t > 44.0 && t < 44.3)) { quality[i] = 1; s = 900e-6; f += 600e-6; } // scattered-light style interval
    if (r() < 0.004) { quality[i] = 2; f += (r() < 0.5 ? 1 : -1) * (1500e-6 + 2500e-6 * r()); }     // isolated outlier
    flux[i] = f + g() * s;
  }
  cache.primary = { time, flux, quality, ephemeris,
    meta: { real: false, label: 'SIMULATED DATASET', target: 'Simulated M-dwarf star (modelled loosely on the TOI-700 system)', catalogueId: 'None: simulated target',
      mission: 'None: simulated (stands in for TESS)', sector: 'Not applicable', cadence: '30 minutes', fileId: 'starbound-sim-primary-v1 (seed 700)',
      source: 'Generated in src/science.js', sourceUrl: null,
      processing: 'Synthetic: slow stellar variability + two box-shaped periodic dips + Gaussian noise + flagged intervals. Flux normalised to 1. These are NOT NASA measurements.',
      replace: 'To use real observations of TOI-700 (TIC 150428135), run tools/prepare_tess_data.py and reload.' } };
  return cache.primary;
}

export function comparisonDataset() {
  if (cache.comp) return cache.comp;
  const real = globalThis.STARBOUND_REAL_COMPARISON;
  if (real && real.time && real.flux && real.meta) { const t0 = real.time[0]; cache.comp = { time: real.time.map((x) => x - t0), flux: real.flux, quality: real.quality || real.time.map(() => 0), meta: Object.assign({ real: true }, real.meta), ephemeris: real.meta.ephemeris || [] }; return cache.comp; }
  const cad = 0.020417, N = Math.round(300 / cad), time = new Array(N), flux = new Array(N), quality = new Array(N).fill(0);
  const g = gaussStream(186); const ephemeris = [{ name: 'Comparison signal', period: 129.9, t0: 40, depthPpm: 420, durationH: 6 }];
  for (let i = 0; i < N; i++) { const t = i * cad; time[i] = t; flux[i] = 1 + 150e-6 * Math.sin((2 * Math.PI * t) / 34) - transit(t, ephemeris[0]) + g() * 180e-6; }
  cache.comp = { time, flux, quality, ephemeris,
    meta: { real: false, label: 'SIMULATED DATASET', target: 'Simulated long-period comparison (modelled loosely on Kepler-186 f)', catalogueId: 'None: simulated target', mission: 'None: simulated (stands in for Kepler)',
      sector: 'Not applicable', cadence: '29.4 minutes', fileId: 'starbound-sim-comparison-v1 (seed 186)', source: 'Generated in src/science.js', sourceUrl: null,
      processing: 'Synthetic: stellar variability + one shallow box-shaped periodic dip + Gaussian noise. NOT NASA measurements.', replace: 'Supply real Kepler data via tools/prepare_tess_data.py --kepler.' } };
  return cache.comp;
}

// The mission record: only measurements the player's spacecraft delivered, with a
// SIMULATED instrument-noise layer set by the payload, pointing and thermal state.
export function missionDataset(st) {
  const base = primaryDataset(); const res = st.opsResult; if (!res) return null;
  const g = gaussStream(4242); const time = [], flux = [], quality = [], sig = [];
  const n = Math.min(base.time.length, res.N);
  for (let i = 0; i < base.time.length; i++) {
    const z = g(); // one draw per index keeps runs reproducible
    if (i >= n || !res.delivered[i] || base.flux[i] == null || !Number.isFinite(base.flux[i])) continue;
    const s = res.sigma * (res.nf[i] || 1);
    time.push(base.time[i]); flux.push(base.flux[i] + z * s * 1e-6); quality.push(base.quality[i]); sig.push(s);
  }
  return { time, flux, quality, sigma: sig, ephemeris: base.ephemeris, days: res.days,
    meta: Object.assign({}, base.meta, { label: (base.meta.real ? 'REAL SOURCE DATA' : 'SIMULATED DATASET') + ' + simulated instrument layer',
      processing: base.meta.processing + ` Mission layer: only the ${time.length} measurements your spacecraft delivered are shown; simulated instrument noise of about ${Math.round(res.sigma)} ppm per point is added.` }) };
}

export function fold(time, flux, period, t0 = 0) {
  const out = new Array(time.length);
  for (let i = 0; i < time.length; i++) { let ph = ((time[i] - t0) / period) % 1; if (ph < 0) ph += 1; if (ph > 0.5) ph -= 1; out[i] = { x: ph, y: flux[i], i }; }
  return out;
}
export function binSeries(xs, ys, width) {
  const m = new Map();
  for (let i = 0; i < xs.length; i++) { const k = Math.floor(xs[i] / width); const b = m.get(k) || { s: 0, n: 0 }; b.s += ys[i]; b.n++; m.set(k, b); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, b]) => ({ x: (k + 0.5) * width, y: b.s / b.n, n: b.n }));
}
export function periodFromMarks(marks) {
  if (marks.length < 2) return null;
  const s = [...marks].sort((a, b) => a - b); const gaps = []; for (let i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);
  const base = Math.min(...gaps); if (base < 0.3) return null;
  let sum = 0, n = 0; for (const gp of gaps) { const k = Math.max(1, Math.round(gp / base)); sum += gp / k; n++; }
  return sum / n;
}

// Ground truth of what the delivered data can support.
export function evaluateEvidence(st) {
  const ds = missionDataset(st); if (!ds) return null;
  const out = [];
  for (const e of ds.ephemeris) {
    let covered = 0, possible = 0, nIn = 0, s2 = 0;
    for (let t0 = e.t0; t0 < primaryDataset().time.length / 48 + 1e-9 && t0 < 60.01; t0 += e.period) {
      if (t0 > ds.days) { possible++; continue; }
      possible++; let k = 0;
      for (let i = 0; i < ds.time.length; i++) if (Math.abs(ds.time[i] - t0) <= e.durationH / 48 && ds.quality[i] === 0) { k++; s2 += ds.sigma[i] ** 2; }
      if (k >= 2) covered++; nIn += k;
    }
    const sigma = nIn ? Math.sqrt(s2 / nIn) : Infinity;
    const snr = nIn ? (e.depthPpm / sigma) * Math.sqrt(nIn) : 0;
    const snrSingle = nIn && covered ? (e.depthPpm / sigma) * Math.sqrt(nIn / covered) : 0;
    const cls = covered >= 2 && snr >= 7 ? 'recurring' : (covered >= 1 && snr >= 4) ? 'single' : 'none';
    out.push({ name: e.name, period: e.period, depthPpm: e.depthPpm, covered, possible, nIn, snr, snrSingle, cls });
  }
  return { signals: out, primary: out[0], points: ds.time.length };
}

export const ASSESSMENTS = [
  { id: 'none', rank: 0, label: 'No significant signal', text: 'The record shows no dimming that stands clearly above the noise. The investigation is inconclusive.' },
  { id: 'single', rank: 1, label: 'A dip is observed, but not shown to repeat', text: 'At least one dimming event is present, but the data cannot show that it recurs. It could be instrumental or a one-off. Inconclusive.' },
  { id: 'candidate', rank: 2, label: 'Recurring dips consistent with a transiting planet candidate', text: 'Dips of similar depth repeat at a regular interval. This is consistent with a transiting planet and justifies follow-up observations to confirm it.' },
  { id: 'confirmed', rank: 3, label: 'A new planet has been discovered and confirmed', text: 'The light curve alone proves that a planet exists.' },
];

// Time allowed for each task, in seconds. "Relaxed" timers double these.
export const TASK_LIMITS = { arrive: 90, crew: 240, briefing: 180, payload: 240, spacecraft: 420, launch: 180, orbit: 120, ops: 420, analysis: 480 };
export const TASK_NAMES = { arrive: 'Check in at reception', crew: 'Meet the mission team', briefing: 'Attend the briefing', payload: 'Choose the payload', spacecraft: 'Configure the spacecraft and pass review', launch: 'Complete the launch checklist', orbit: 'Select the orbit', ops: 'Run mission operations', analysis: 'Investigate the data and submit an assessment' };
// Schedule performance from the recorded task times. Each task scores 100 on time and loses points in proportion to the overrun.
export function scheduleScore(st) {
  const rows = Object.keys(TASK_LIMITS).filter((k) => st.times && st.times[k]).map((k) => { const { used, limit } = st.times[k]; const over = Math.max(0, used - limit); return { key: k, name: TASK_NAMES[k], used, limit, over, score: Math.max(0, Math.round(100 - (over / limit) * 100)) }; });
  if (!rows.length) return null;
  return { rows, score: Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length), late: rows.filter((r) => r.over > 0).length };
}

export function scoreMission(st) {
  const ev = evaluateEvidence(st); const t = totals(st); const res = st.opsResult; const p = ev.primary;
  const truthRank = p.cls === 'recurring' ? 2 : p.cls === 'single' ? 1 : 0;
  const a = ASSESSMENTS.find((x) => x.id === st.assessment) || ASSESSMENTS[0];
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
  const objectiveMet = truthRank === 2;
  const science = clamp(45 * (p.covered / Math.max(1, p.possible)) + 55 * Math.min(1, p.snr / 12));
  const spentFrac = t.spent / BUDGET;
  let resource = clamp(100 - Math.max(0, spentFrac - 0.8) * 250); if (!objectiveMet) resource = Math.min(resource, 60);
  let compat = clamp(100 - 15 * Math.min(4, st.validationFailures) - 5 * Math.min(6, st.checklistErrors) - (st.launch && st.launch.margin < 0.05 ? 15 : 0));
  const visibleFrac = res.counts.visibleSteps / res.N;
  const obs = clamp(60 * Math.min(1, res.coverage / Math.max(0.01, visibleFrac)) + 40 * Math.min(1, p.snrSingle / 8));
  const comm = clamp(100 * (res.counts.collected ? res.counts.delivered / res.counts.collected : 0) - 20 * Math.min(1, res.counts.lost / Math.max(1, res.counts.collected + res.counts.lost)) * 5);
  let interp; const d = a.rank - truthRank;
  if (a.id === 'confirmed') interp = 10; else if (d === 0) interp = 100; else if (d === -1) interp = 60; else if (d === -2) interp = 35; else interp = 30;
  let periodNote = '';
  if (a.id === 'candidate' && truthRank === 2) {
    const P = st.period; const err = P ? Math.abs(P - p.period) : null;
    if (!P) { interp -= 15; periodNote = 'No period was measured to support the claim.'; }
    else if (err < 0.15) periodNote = `Your period of ${P.toFixed(2)} days matches the spacing of the dips.`;
    else if (Math.abs(P - p.period / 2) < 0.15 || Math.abs(P - p.period * 2) < 0.3) { interp -= 10; periodNote = `Your period of ${P.toFixed(2)} days is a multiple or fraction of the true spacing (an alias).`; }
    else { interp -= 20; periodNote = `Your period of ${P.toFixed(2)} days does not line the dips up.`; }
  }
  interp = clamp(interp);
  const areas = [
    { key: 'science', name: 'Scientific objective', score: science },
    { key: 'resource', name: 'Resource management', score: resource },
    { key: 'compat', name: 'Spacecraft and launch compatibility', score: compat },
    { key: 'obs', name: 'Observation quality', score: obs },
    { key: 'comm', name: 'Communications performance', score: comm },
    { key: 'interp', name: 'Scientific interpretation', score: interp },
  ];
  const w = { science: 0.25, resource: 0.15, compat: 0.1, obs: 0.2, comm: 0.1, interp: 0.2 };
  const schedule = scheduleScore(st); if (schedule) { areas.push({ key: 'schedule', name: 'Schedule (task time limits)', score: schedule.score }); w.schedule = 0.1; }
  const wSum = areas.reduce((s, x) => s + w[x.key], 0);
  const overall = Math.round(areas.reduce((s, x) => s + x.score * w[x.key], 0) / wSum);
  const grade = overall >= 85 ? 'Excellent' : overall >= 70 ? 'Successful' : overall >= 50 ? 'Partial' : 'Inconclusive';
  const supported = ASSESSMENTS.find((x) => x.rank === truthRank);
  const verdict = a.id === 'confirmed'
    ? 'Overclaim. A light curve can show dips consistent with a transit; it cannot confirm a planet by itself. Confirmation needs independent evidence, such as ruling out eclipsing binaries and follow-up measurements.'
    : d === 0 ? 'Your assessment matches what the evidence supports.'
      : d < 0 ? `Your assessment was more cautious than the data required. The evidence supports: "${supported.label}".`
        : `Your assessment claims more than the data supports. The evidence supports: "${supported.label}".`;
  return { schedule, areas, overall, grade, evidence: ev, truthRank, supported, verdict, periodNote, objectiveMet, spent: t.spent };
}
