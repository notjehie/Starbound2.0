import { ORBITS, MISSION_DAYS, STRUCTURE, PAYLOADS } from './catalog.js';
import { totals, opt } from './engineering.js';

export const CADENCE = 1 / 48; // days (30 minutes)
export const EVENTS = [
  { id: 'power', start: 20, end: 26, title: 'Solar array fault' },
  { id: 'pointing', start: 30, end: 34, title: 'Reaction wheel momentum build-up' },
  { id: 'comms', start: 37, end: 42, title: 'Ground network outage' },
];

function visible(orbit, t) {
  if (orbit.id === 'leo') return ((t * 1440) % 96) / 96 < 0.6;
  if (orbit.id === 'heo') return ((t + 1) % 13.7) > 1.0;
  return (t % 4) > 0.125;
}
function contactHours(orbit, t) { // hours of ground contact inside one 30-minute step
  if (orbit.id === 'leo') return 0.5 * (orbit.contactPerDay / 24);
  if (orbit.id === 'heo') return ((t + 1) % 13.7) < 0.667 ? 0.5 : 0;
  return (t % 1) < 1 / 3 ? 0.5 : 0;
}

export function createOps(st) {
  const tot = totals(st); const orbit = ORBITS[st.orbit];
  const days = st.launch ? st.launch.durationDays : MISSION_DAYS;
  const N = Math.round(days * 48);
  const payload = PAYLOADS[st.payload];
  const power = opt(st, 'power'), comms = opt(st, 'comms'), storage = opt(st, 'storage'), thermal = opt(st, 'thermal'), adcs = opt(st, 'adcs');
  const gbPerSample = tot.dataRate / 48;
  const sunFactor = orbit.id === 'leo' ? 0.85 : 1;
  const o = {
    N, days, i: 0, t: 0, battery: 1, batteryWh: power.gen * 2.5, stored: 0, cap: storage.cap,
    queue: [], qHead: 0, carry: 0,
    delivered: new Uint8Array(N), collected: new Uint8Array(N), lost: new Uint8Array(N), nf: new Float32Array(N),
    mode: 'on', cadenceHalf: false, heaterLow: false, safeUntil: -1,
    desatUntil: -1, active: { power: false, comms: false, pointing: false }, fired: {}, decisions: {}, log: [], pending: null, finished: false,
    counts: { collected: 0, delivered: 0, lost: 0, safeModes: 0, visibleSteps: 0 },
    tel: {}, result: null, overflowLogged: false,
  };
  const log = (msg, level = 'info') => o.log.push({ day: +o.t.toFixed(2), msg, level });

  function loads(instOn, safe) {
    if (safe) return STRUCTURE.power + 0.3 * (storage.power + adcs.power + thermal.power + comms.power);
    return STRUCTURE.power + storage.power + adcs.power + thermal.power * (o.heaterLow ? 0.3 : 1)
      + comms.power * (o.heaterLow ? 0.5 : 1) + (instOn ? payload.power : payload.power * 0.1);
  }
  function genNow() { return power.gen * sunFactor * (o.active.power ? 0.65 : 1); }

  function buildDecision(ev) {
    if (ev.id === 'power') {
      const gen = Math.round(power.gen * sunFactor * 0.65);
      const full = Math.round(loads(true, false));
      const saved = o.heaterLow; o.heaterLow = true; const cut = Math.round(loads(true, false)); o.heaterLow = saved; const half = Math.round((loads(true, false) + loads(false, false)) / 2);
      if (gen >= full) {
        return { id: 'power', title: 'Solar array fault', absorbed: true,
          text: `One array string has failed. Generation drops 35 % to ${gen} W for about six days. Your load is ${full} W, so the power margin you designed absorbs the fault.`,
          options: [{ id: 'none', label: 'Acknowledge. Continue normal operations', effect: 'No change to science operations.' }] };
      }
      return { id: 'power', title: 'Solar array fault', absorbed: false,
        text: `One array string has failed. Generation drops 35 % to ${gen} W for about six days. The spacecraft needs ${full} W with the instrument running. The battery will drain unless load is reduced; if it empties, the spacecraft enters safe mode and observing stops for a day.`,
        options: [
          { id: 'cut', label: 'Keep observing; cut heaters and halve transmitter power', effect: `Load falls to ${cut} W${cut > gen ? `, still ${cut - gen} W short, so the battery drains slowly` : ', within generation'}. Detector temperature drifts (more noise) and downlink is halved.` },
          { id: 'half', label: 'Duty-cycle the instrument: 6 hours on, 6 hours off', effect: `Average load falls to ${half} W${half > gen ? `, still ${half - gen} W short, so the battery drains slowly` : ', within generation'}. Half of the observing time in this period is lost.` },
          { id: 'off', label: 'Switch the instrument off until power is restored', effect: 'Protects the spacecraft completely. No observations for about six days.' },
        ] };
    }
    if (ev.id === 'pointing') {
      if (st.bus.adcs === 'fine') return { id: 'pointing', title: ev.title, absorbed: true,
        text: 'The reaction wheels are spinning faster than planned as they absorb sunlight pressure. Your fine guidance system saw it early and is unloading them a little at a time between measurements. Pointing is unaffected.',
        options: [{ id: 'none', label: 'Acknowledge. Continue normal operations', effect: 'No change to science operations.' }] };
      return { id: 'pointing', title: ev.title, absorbed: false,
        text: 'The reaction wheels are spinning faster than planned as they absorb sunlight pressure. With coarse sensors the spacecraft noticed late. Until the wheels are unloaded the telescope cannot hold the star steady, and every measurement is noisier.',
        options: [
          { id: 'desat', label: 'Stop observing for 18 hours and unload the wheels now', effect: 'No observations for 18 hours. Pointing is back to normal afterwards.' },
          { id: 'ride', label: 'Keep observing and let the wheels unload slowly', effect: 'No observing time is lost, but measurements are about 60 % noisier for four days.' },
        ] };
    }
    const perDay = tot.dataRate; const free = Math.max(0, o.cap - o.stored);
    const daysToFull = free / perDay;
    return { id: 'comms', title: 'Ground network outage', absorbed: false,
      text: `The ground stations are offline for about five days. No data can be sent. The recorder holds ${o.stored.toFixed(1)} of ${o.cap} GB and fills at ${perDay} GB per day: ${daysToFull >= 5.2 ? 'enough room to ride out the outage' : `it will be full in ${daysToFull.toFixed(1)} days, and anything recorded after that is lost`}.`,
      options: [
        { id: 'keep', label: 'Keep observing at full cadence', effect: daysToFull >= 5.2 ? 'Recorder has room. Nothing is lost; data is sent after contact returns.' : 'Recorder overflows before contact returns. Later observations in the outage are lost.' },
        { id: 'half', label: 'Halve the measurement cadence', effect: 'Data volume halves, so the recorder lasts twice as long. Each dip is sampled by half as many points.' },
        { id: 'off', label: 'Pause observations until contact returns', effect: 'Nothing is lost from the recorder, but nothing is observed for five days.' },
      ] };
  }

  o.decide = (choice) => {
    const d = o.pending; if (!d) return;
    o.decisions[d.id] = choice; o.pending = null;
    const optn = d.options.find((x) => x.id === choice) || d.options[0]; choice = optn.id; o.decisions[d.id] = choice;
    log(`Decision (${d.title}): ${optn.label}.`, 'decision');
    if (d.id === 'power') { if (choice === 'cut') o.heaterLow = true; if (choice === 'half') o.mode = 'half'; if (choice === 'off') o.mode = 'off'; }
    if (d.id === 'comms') { if (choice === 'half') o.cadenceHalf = true; if (choice === 'off') o.mode = 'off'; }
    if (d.id === 'pointing' && choice === 'desat') o.desatUntil = o.i + 36;
  };
  o.setMode = (m) => { if (o.mode !== m) { o.mode = m; log(`Instrument commanded: ${m === 'on' ? 'continuous observing' : m === 'half' ? '6 h on / 6 h off' : 'standby'}.`, 'decision'); } };

  function downlink(t, allowEvent) {
    let hours = contactHours(orbit, t);
    if (allowEvent && o.active.comms) hours = 0;
    const safe = o.i < o.safeUntil;
    const gb = comms.rate * hours * (o.heaterLow ? 0.5 : 1) * (safe ? 0.25 : 1);
    o.carry += gb / gbPerSample;
    let n = Math.floor(o.carry); o.carry -= n;
    while (n > 0 && o.qHead < o.queue.length) { const idx = o.queue[o.qHead++]; o.delivered[idx] = 1; o.counts.delivered++; o.stored = Math.max(0, o.stored - gbPerSample); n--; }
    if (o.qHead >= o.queue.length) o.carry = Math.min(o.carry, 1);
    return hours > 0;
  }

  // Advance one 30-minute step. Returns false when waiting for a decision or finished.
  o.step = () => {
    if (o.finished || o.pending) return false;
    const t = o.i * CADENCE; o.t = t;
    for (const ev of EVENTS) {
      if (!o.fired[ev.id] && t >= ev.start && t < ev.end) { o.fired[ev.id] = true; o.active[ev.id] = true; log(`${ev.title} begins.`, 'alert'); o.pending = buildDecision(ev); return false; }
      if (o.active[ev.id] && t >= ev.end) {
        o.active[ev.id] = false; log(`${ev.title} resolved. Normal operations restored.`, 'info');
        if (ev.id === 'power') { o.heaterLow = false; if (o.decisions.power === 'half' || o.decisions.power === 'off') o.mode = 'on'; }
        if (ev.id === 'comms') { o.cadenceHalf = false; if (o.decisions.comms === 'off') o.mode = 'on'; }
      }
    }
    const safe = o.i < o.safeUntil;
    const desat = o.i < o.desatUntil;
    const instOn = !safe && !desat && (o.mode === 'on' || (o.mode === 'half' && Math.floor(t * 4) % 2 === 0));
    const gen = genNow(), load = loads(instOn, safe);
    o.battery = Math.min(1, o.battery + ((gen - load) * 0.5) / o.batteryWh);
    if (o.battery <= 0) { o.battery = 0.03; o.safeUntil = o.i + 48; o.counts.safeModes++; log('Battery depleted. Spacecraft entered safe mode: instrument off for 24 hours while the battery recharges.', 'alert'); }
    const vis = visible(orbit, t);
    if (vis) o.counts.visibleSteps++;
    if (instOn && vis && !(o.cadenceHalf && o.i % 2 === 1)) {
      if (o.stored + gbPerSample > o.cap) {
        o.lost[o.i] = 1; o.counts.lost++;
        if (!o.overflowLogged) { o.overflowLogged = true; log('Recorder full. New observations are being lost until data is sent down.', 'alert'); }
      } else {
        o.overflowLogged = false;
        o.queue.push(o.i); o.stored += gbPerSample; o.collected[o.i] = 1; o.counts.collected++;
        let nf = 1;
        if (orbit.thermalSwing) nf = (st.bus.thermal === 'active' && !o.heaterLow) ? 1.1 : 1.35;
        else if (st.bus.thermal === 'active' && o.heaterLow) nf = 1.25;
        if (o.active.pointing && o.decisions.pointing === 'ride') nf *= 1.6;
        o.nf[o.i] = nf;
      }
    }
    const inContact = downlink(t, true);
    o.tel = { t, battery: o.battery, gen: Math.round(gen), load: Math.round(load), stored: o.stored, cap: o.cap, contact: inContact, visible: vis, instOn, safe,
      outage: o.active.comms, fault: o.active.power, wheels: o.active.pointing && o.decisions.pointing === 'ride', desat, mode: o.mode,
      state: safe ? 'SAFE MODE' : desat ? 'UNLOADING WHEELS' : !instOn ? 'INSTRUMENT STANDBY' : !vis ? 'TARGET OCCULTED' : 'OBSERVING' };
    o.i++;
    if (o.i >= N) finish();
    return !o.finished;
  };

  function finish() {
    // Three days of end-of-mission downlink passes: whatever is still on board after that is not delivered.
    for (let k = 0; k < 144; k++) downlink(o.days + k * CADENCE, false);
    const onboard = o.queue.length - o.qHead;
    log(`Mission operations complete. ${o.counts.delivered} of ${o.counts.collected} recorded measurements reached the ground${onboard ? `; ${onboard} were still on board when the mission ended` : ''}.`, 'info');
    o.finished = true;
    o.result = {
      N, days: o.days, delivered: Array.from(o.delivered), nf: Array.from(o.nf, (x) => Math.round(x * 100) / 100),
      counts: Object.assign({ onboard }, o.counts), decisions: o.decisions, log: o.log,
      coverage: o.counts.delivered / N, sigma: tot.sigma,
    };
  }
  // Run to completion with scripted decisions (used by tests).
  o.runAll = (choices = {}) => { let guard = 0; while (!o.finished && guard++ < 1e5) { if (o.pending) o.decide(choices[o.pending.id] || o.pending.options[0].id); else o.step(); } return o.result; };
  return o;
}
