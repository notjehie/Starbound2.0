import { totals } from './engineering.js';
import { MISSION_DAYS } from './catalog.js';

// Simplified two-stage ascent. Thrust-to-weight depends on how much of the
// vehicle's capacity the player's spacecraft uses, so every launch differs.
export function computeAscent(st) {
  const t = totals(st); const v = t.vehicle;
  const margin = Math.max(0, Math.min(1, t.launchMargin));
  const g = 9.81, dt = 1; const samples = [];
  let vel = 0, alt = 0, down = 0, time = 0, stage = 1, events = [];
  const twr0 = 1.18 + 0.4 * margin;
  const t1 = 155 - 10 * margin;                // stage-1 burn time, s
  let stage2Start = null, maxQ = null;
  while (time < 900) {
    let acc;
    if (stage === 1) acc = g * (twr0 + (3.6 - twr0) * (time / t1) ** 1.6);
    else { const u = (time - stage2Start) / 380; acc = g * ((0.75 + 0.5 * margin) + 2.4 * Math.min(1, u) ** 1.4); }
    // gravity turn: vertical for 12 s, then pitch over towards horizontal
    const pitch = time < 12 ? Math.PI / 2 : Math.max(0.02, (Math.PI / 2) * Math.exp(-(time - 12) / (95 + 30 * (1 - margin))));
    const drag = alt < 60000 ? 0.000012 * vel * vel * Math.exp(-alt / 8000) : 0;
    vel += (acc - g * Math.sin(pitch) * (1 - Math.min(1, (vel / 7800) ** 2)) - drag) * dt;
    alt += vel * Math.sin(pitch) * dt; down += vel * Math.cos(pitch) * dt;
    time += dt;
    if (!maxQ && alt > 11000) { maxQ = time; events.push({ t: time, label: 'Max-Q: peak aerodynamic load' }); }
    if (stage === 1 && time >= t1) { stage = 2; stage2Start = time + 4; events.push({ t: time, label: 'Main engine cut-off, stage separation' }); time += 4; alt += vel * Math.sin(pitch) * 4; down += vel * Math.cos(pitch) * 4; events.push({ t: time, label: 'Second-stage ignition' }); }
    if (stage === 2 && !events.find((e) => e.label.startsWith('Fairing')) && alt > 115000) events.push({ t: time, label: 'Fairing separation' });
    samples.push({ t: time, alt, vel, down, stage, pitch });
    if (vel >= 7600) break;
  }
  events.push({ t: time, label: 'Orbital insertion' });
  const reserve = Math.round(margin * 100);
  const durationDays = margin < 0.05 ? Math.round(MISSION_DAYS * 0.9) : MISSION_DAYS;
  return {
    margin, mass: t.mass, vehicle: v.id, insertionTime: time, samples, events, reserve, durationDays,
    note: margin < 0.05
      ? `Launch margin was only ${reserve} %. Reaching orbit used propellant reserved for station keeping; the mission is shortened to ${durationDays} days.`
      : `Launch margin ${reserve} %. Full ${durationDays}-day mission available.`,
  };
}
