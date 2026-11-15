// Crew dialogue. Fixed lines live in lines.js (they are the lines the team records).
// Lines built here contain live numbers from the player's mission and are subtitled.
import { state, atLeast, stageName } from './state.js';
import { totals, assessPayload, validateDesign } from './engineering.js';
import { PAYLOADS, BUDGET, VEHICLES } from './catalog.js';
import { SPEC, AFIA, ENG, JEHIELLE, QUIZ } from './lines.js';

const once = (key) => { if (state.heard[key]) return false; state.heard[key] = true; return true; };

export function conversation(role) {
  const t = totals(state); const p = t.payload; const stage = stageName();
  if (role === 'specialist') {
    if (once('sp.intro')) return { firstMeet: true, lines: SPEC.intro, quiz: QUIZ.specialist };
    if (stage === 'crew') { const left = ['scientist', 'engineer', 'ops'].filter((k) => !state.met[k]).map((k) => ({ scientist: 'Afia in the laboratory', engineer: 'Lady Paula in the engineering bay', ops: 'Jehielle in mission control' }[k])); return { lines: [left.length ? `You still need to meet ${left.join(' and ')}. Follow the amber line down the corridor.` : SPEC.briefingReady] }; }
    if (stage === 'briefing') return { lines: [SPEC.briefingGo] };
    if (stage === 'payload') return { lines: [SPEC.payload] };
    if (stage === 'spacecraft') return { lines: [p ? `The ${p.name} is on the books at ${p.cost} million. Lady Paula will help you build a spacecraft that can carry it. Watch the budget: ${t.remaining} million is left.` : SPEC.payload] };
    if (stage === 'launch') return { lines: [SPEC.launch] };
    if (stage === 'analysis') return { lines: [SPEC.analysis] };
    return { lines: [SPEC.idle] };
  }
  if (role === 'scientist') {
    if (once('sc.intro')) return { firstMeet: true, lines: AFIA.intro, quiz: QUIZ.scientist };
    if (stage === 'payload') return { lines: [p ? `You have the ${p.name} selected. ${assessPayload(state.payload).why}` : AFIA.payloadHint] };
    if (stage === 'spacecraft' || stage === 'launch') return { lines: [p ? `The ${p.short} gives about ${Math.round(t.sigma)} parts per million of noise per measurement once pointing is included. ${state.payload === 'compact' ? 'That is close to the size of the dip itself, so you will be relying on catching every repeat.' : 'That is comfortably below the dip. Now protect the observing time: gaps are what hide transits.'}` : AFIA.payloadHint] };
    if (stage === 'analysis') return { lines: [AFIA.analysis] };
    if (atLeast('report')) return { lines: [AFIA.after] };
    return { lines: [AFIA.idle] };
  }
  if (role === 'engineer') {
    if (once('en.intro')) return { firstMeet: true, lines: ENG.intro, quiz: QUIZ.engineer };
    if (stage === 'payload') return { lines: [p ? `${p.name}: ${p.mass} kg and ${p.power} W. ${state.payload === 'precision' ? 'That one needs fine pointing and active cooling, and it will not fit a small fairing. Possible, but everything else gets bigger.' : 'That is a comfortable load for a small spacecraft.'}` : ENG.noPayload] };
    if (stage === 'spacecraft') { const v = validateDesign(state); if (!t.busComplete || !t.vehicle) return { lines: [ENG.startBuild] }; return { lines: [v.ok ? ENG.looksGood : `I can already see a problem: ${v.issues[0].msg} ${v.issues[0].fix}`] }; }
    if (stage === 'launch') return { lines: [`She is ${t.mass} kg on a ${VEHICLES[state.vehicle].name}, which leaves ${Math.round(t.launchMargin * 100)} percent launch margin. ${t.launchMargin < 0.1 ? 'That is thin. You will reach low orbit, but the higher orbits will be out of reach.' : 'That is a healthy margin. You will have a choice of orbits.'}`] };
    return { lines: [ENG.idle] };
  }
  if (role === 'ops') {
    if (once('op.intro')) return { firstMeet: true, lines: JEHIELLE.intro, quiz: QUIZ.ops };
    if (stage === 'launch') return { lines: [JEHIELLE.launchGo] };
    if (stage === 'spacecraft' || stage === 'payload') return { lines: [t.dataRate && t.storage ? `Your instrument produces ${t.dataRate} GB a day. With a ${t.storage} GB recorder that is ${(t.storage / t.dataRate).toFixed(0)} days before it is full if we cannot downlink.` : JEHIELLE.early] };
    return { lines: [JEHIELLE.idle] };
  }
  return { lines: ['...'] };
}

export const BRIEFING = [
  { title: 'Mission briefing', who: 'specialist', text: SPEC.brief[0] },
  { title: 'What we are investigating', who: 'scientist', text: AFIA.brief[0] },
  { title: 'Why the observation matters', who: 'scientist', text: AFIA.brief[1] },
  { title: 'What the spacecraft must accomplish', who: 'engineer', text: ENG.brief[0] },
  { title: 'Constraints', who: 'engineer', text: ENG.brief[1] },
  { title: 'Operations', who: 'ops', text: JEHIELLE.brief[0] },
  { title: 'What counts as success', who: 'specialist', text: SPEC.brief[1] },
  { title: 'A note on honesty', who: 'scientist', text: AFIA.brief[2] },
];

export function inspectInfo(id) {
  if (id.startsWith('inst:')) { const p = PAYLOADS[id.slice(5)]; const a = assessPayload(p.id); return { title: `${p.name} (${p.short})`, body: [p.desc, `Aperture ${p.aperture} cm. Mass ${p.mass} kg. Power ${p.power} W. Cost ${p.cost} M. Data ${p.dataRate} GB per day. Noise about ${p.noise} ppm per 30-minute measurement.`, `Capability: ${p.capability}`, `Limits: ${p.limits}`, `Against this mission's 0.33 % dip: ${a.level}. ${a.why}`, 'Values are simplified game parameters, not specifications of real hardware.'] }; }
  const info = {
    model: { title: 'Launch vehicle family model', body: ['A scale model of the medium launcher. Three vehicles are available to the programme: small, medium and heavy.', 'A launcher is chosen by what it can lift and what fits inside its fairing, the nose shell that protects the spacecraft on the way up. Paying for capacity you do not use is one of the most common ways missions overspend.'] },
    wheel: { title: 'Flight spare: reaction wheel', body: ['A heavy disc spun by a motor. Speeding the wheel up one way turns the spacecraft the other way, so the spacecraft can point without using any propellant.', 'A telescope has to keep a star on the same pixels for hours. Better wheels and sensors mean less jitter, and less jitter means less noise in every brightness measurement.'] },
    tracker: { title: 'Flight spare: star tracker', body: ['A small camera that photographs the sky, matches the star pattern against a catalogue, and tells the spacecraft exactly where it is pointing.', 'The fine guidance option adds two of these. Without them the spacecraft relies on coarse sensors and the image wanders, smearing starlight across the detector.'] },
    suits: { title: 'Clean-room garments', body: ['Anyone working near flight hardware wears these. A single fingerprint or flake of skin on a telescope mirror scatters light and raises the noise floor of the instrument for the whole mission.', 'Spacecraft cannot be cleaned after launch. Whatever is on the optics on launch day stays there.'] },
    craft: { title: 'Spacecraft on the assembly stand', body: state.payload ? [`This is your spacecraft as currently configured: ${totals(state).mass} kg. The model on the stand changes as you change the design at the assembly terminal.`, 'The gold blanket is multi-layer insulation. The telescope sits on top; arrays, antenna, radiator and star trackers are fitted according to your selections.'] : ['The stand holds an empty spacecraft bus. It will be fitted out as you choose a payload and subsystems.'] },
  };
  return info[id] || { title: 'Equipment', body: ['Nothing further to report.'] };
}
