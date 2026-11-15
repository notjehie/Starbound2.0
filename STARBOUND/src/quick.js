// Quick Mission planning: the engineer fits a spacecraft around the chosen telescope
// and orbit, and each orbit is described by what it is expected to return.
// Everything here runs the same simulation the full mission uses.
import { BUS, BUS_KEYS, VEHICLES, ORBITS, PAYLOADS } from './catalog.js';
import { validateDesign, orbitAvailability, totals, opt } from './engineering.js';
import { computeAscent } from './ascent.js';
import { createOps } from './ops.js';
import { evaluateEvidence } from './science.js';

function fly(payload, bus, vehicle, orbit) {
  const st = { payload, bus, vehicle, orbit, launch: null, validated: true, validationFailures: 0, checklistErrors: 0, marks: [], period: null, times: {} };
  st.launch = computeAscent(st); st.opsResult = createOps(st).runAll(); const ev = evaluateEvidence(st);
  return { st, res: st.opsResult, ev };
}
// Cheapest design that passes review, reaches the orbit and returns the most science.
export function autoFit(payload, orbitId) {
  const keys = BUS_KEYS; const lists = keys.map((k) => Object.keys(BUS[k].options)); const cands = [];
  const walk = (i, bus) => { if (i === keys.length) { for (const vehicle of Object.keys(VEHICLES)) { const st = { payload, bus: { ...bus }, vehicle, launch: null }; const v = validateDesign(st); if (!v.ok) continue; if (!orbitAvailability(st, orbitId).ok) continue; cands.push({ bus: { ...bus }, vehicle, cost: v.totals.spent }); } return; } for (const o of lists[i]) { bus[keys[i]] = o; walk(i + 1, bus); } };
  walk(0, {}); if (!cands.length) return null;
  cands.sort((a, b) => a.cost - b.cost); let best = null;
  for (const c of cands.slice(0, 40)) { const r = fly(payload, c.bus, c.vehicle, orbitId); const p = r.ev.primary; const score = p.covered * 1000 + Math.min(p.snr, 30) * 20 + r.res.coverage * 200 - c.cost; if (!best || score > best.score) best = { ...c, score, covered: p.covered, possible: p.possible, snr: p.snr, coverage: r.res.coverage, totals: totals(r.st), margin: r.st.launch.reserve }; }
  return best;
}
export function plans(payload) { return Object.keys(ORBITS).map((id) => ({ orbit: id, fit: autoFit(payload, id) })); }
// One plain sentence per fitted item: what it is and why it was chosen.
export function explainFit(st) {
  const t = totals(st); const p = PAYLOADS[st.payload]; const o = (k) => opt(st, k); const out = [];
  out.push(['Power', `${o('power').name}: ${t.gen} W against a ${t.load} W load, ${Math.round(t.powerMargin * 100)} % margin. ${t.powerMargin >= 0.35 ? 'Enough to ride out an array fault.' : 'Enough to pass review, with little to spare if an array fails.'}`]);
  out.push(['Communications', `${o('comms').name}: ${o('comms').rate} GB per contact-hour${o('comms').deepSpace ? ', and it works from deep space.' : '. Near-Earth orbits only.'}`]);
  out.push(['Data storage', `${o('storage').name}: holds ${(t.storage / t.dataRate).toFixed(0)} days of data between contacts.`]);
  out.push(['Thermal control', `${o('thermal').name}${p.requires.thermal ? ': the ' + p.short + ' requires it.' : o('thermal').power ? ': keeps the detector steady.' : ': enough for this instrument and lighter.'}`]);
  out.push(['Attitude control', `${o('adcs').name}: about ${Math.round(t.sigma)} ppm of noise per measurement once pointing is included.`]);
  out.push(['Launch vehicle', `${t.vehicle.name}: lifts ${t.mass} kg with ${Math.round(t.launchMargin * 100)} % margin.`]);
  const small = VEHICLES.kestrel; if (st.vehicle !== 'kestrel') out.push(['Why not the small rocket', t.mass > small.capacity ? `Kestrel-S lifts ${small.capacity} kg and this spacecraft is ${t.mass} kg.` : 'Kestrel-S could lift it, but not with the margin this orbit needs.']);
  return out;
}
