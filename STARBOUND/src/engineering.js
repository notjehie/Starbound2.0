import { PAYLOADS, BUS, BUS_KEYS, STRUCTURE, VEHICLES, BUDGET, FAIRING_RANK, TARGET_DEPTH_PPM, ORBITS } from './catalog.js';

export const opt = (st, key) => (st.bus[key] ? BUS[key].options[st.bus[key]] : null);

// Every number shown in the engineering readout comes from here.
export function totals(st) {
  const p = st.payload ? PAYLOADS[st.payload] : null;
  let partsMass = p ? p.mass : 0;
  let load = STRUCTURE.power + (p ? p.power : 0);
  let cost = STRUCTURE.cost + (p ? p.cost : 0);
  let chosen = 0;
  for (const k of BUS_KEYS) {
    const o = opt(st, k);
    if (o) { partsMass += o.mass; load += o.power; cost += o.cost; chosen++; }
  }
  const structure = STRUCTURE.baseMass + STRUCTURE.fraction * partsMass;
  const mass = Math.round(partsMass + structure);
  const pw = opt(st, 'power');
  const gen = pw ? pw.gen : 0;
  const v = st.vehicle ? VEHICLES[st.vehicle] : null;
  const spent = cost + (v ? v.cost : 0);
  const adcs = opt(st, 'adcs');
  const sigma = p ? Math.sqrt(p.noise ** 2 + (adcs ? adcs.jitter : 250) ** 2) : null;
  return {
    payload: p, mass, structure: Math.round(structure), load, gen,
    powerMargin: gen ? (gen - load) / gen : null,
    cost, spent, remaining: BUDGET - spent, budget: BUDGET,
    vehicle: v, launchMargin: v ? (v.capacity - mass) / v.capacity : null,
    dataRate: p ? p.dataRate : 0, storage: opt(st, 'storage') ? opt(st, 'storage').cap : 0,
    sigma, busComplete: chosen === BUS_KEYS.length,
  };
}

// Signal-to-noise of one 2-hour dip (4 measurements) for a given noise per point.
export function dipSNR(sigma, depth = TARGET_DEPTH_PPM, nPoints = 4) { return (depth / sigma) * Math.sqrt(nPoints); }

export function assessPayload(id) {
  const p = PAYLOADS[id];
  const best = dipSNR(Math.sqrt(p.noise ** 2 + 40 ** 2));
  const level = best < 3 ? 'unsuitable' : best < 6.5 ? 'marginal' : 'suitable';
  const why = level === 'suitable'
    ? `A single 0.33 % dip would stand ${best.toFixed(0)} times above the noise. Each event can be seen on its own.`
    : level === 'marginal'
      ? `A single 0.33 % dip would stand only about ${best.toFixed(1)} times above the noise, even with fine pointing. Individual dips will be hard to tell from noise; the case would rest on catching every repeat.`
      : `A 0.33 % dip would be lost in the noise (${best.toFixed(1)} sigma). This instrument cannot meet the objective.`;
  return { level, snr: best, why };
}

// Engineering review before launch. Returns a list of issues; empty means go.
export function validateDesign(st) {
  const t = totals(st); const issues = [];
  const p = t.payload;
  if (!p) issues.push({ area: 'Payload', msg: 'No payload selected.', fix: 'Select an instrument at the laboratory terminal.' });
  for (const k of BUS_KEYS) if (!st.bus[k]) issues.push({ area: BUS[k].label, msg: `No ${BUS[k].label.toLowerCase()} option selected.`, fix: 'Choose one option for every subsystem.' });
  if (!t.vehicle) issues.push({ area: 'Launch vehicle', msg: 'No launch vehicle selected.', fix: 'Choose a launch vehicle.' });
  if (!p || !t.busComplete || !t.vehicle) return { ok: false, issues, totals: t };
  if (t.powerMargin < 0.1) {
    issues.push({ area: 'Power', msg: `Arrays generate ${t.gen} W against a ${t.load} W load (${(t.powerMargin * 100).toFixed(0)} % margin). The review requires at least 10 %.`,
      fix: 'Fit larger arrays, or reduce the load with lighter subsystems or a smaller instrument.' });
  }
  for (const [k, need] of Object.entries(p.requires)) {
    if (st.bus[k] !== need) issues.push({ area: BUS[k].label, msg: `${p.name} requires "${BUS[k].options[need].name}". The selected option cannot support it.`,
      fix: `Select "${BUS[k].options[need].name}", or choose a less demanding instrument.` });
  }
  if (t.mass > t.vehicle.capacity) {
    issues.push({ area: 'Launch mass', msg: `Spacecraft mass is ${t.mass} kg; ${t.vehicle.name} can lift ${t.vehicle.capacity} kg.`,
      fix: 'Choose a larger launch vehicle or remove mass from the spacecraft.' });
  }
  if (FAIRING_RANK[p.fairing] > FAIRING_RANK[t.vehicle.fairing]) {
    issues.push({ area: 'Fairing', msg: `The ${p.aperture} cm telescope does not fit inside the ${t.vehicle.name} fairing.`,
      fix: 'Choose a vehicle with a larger fairing, or a smaller instrument.' });
  }
  if (t.spent > BUDGET) {
    issues.push({ area: 'Budget', msg: `Total cost is ${t.spent} M against a budget of ${BUDGET} M (over by ${t.spent - BUDGET} M).`,
      fix: 'Choose a cheaper launch vehicle or subsystems, or a less expensive instrument.' });
  }
  return { ok: issues.length === 0, issues, totals: t };
}

export function orbitAvailability(st, orbitId) {
  const o = ORBITS[orbitId]; const t = totals(st); const reasons = [];
  const margin = st.launch ? st.launch.margin : t.launchMargin;
  if (margin < o.minMargin) reasons.push(`Needs ${(o.minMargin * 100).toFixed(0)} % launch margin; this launch had ${(margin * 100).toFixed(0)} %.`);
  if (o.needsDeepSpace && !opt(st, 'comms').deepSpace) reasons.push('The low-gain antenna cannot close a link from 1.5 million km.');
  return { ok: reasons.length === 0, reasons };
}
