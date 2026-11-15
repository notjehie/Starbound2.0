// STARBOUND entry point: boot, title screen, mission flow and objectives.
import * as THREE from 'three';
import { state, settings, load, commit, onChange, setStage, stageName, atLeast, hardReset, save, isQuick } from './state.js';
import { QUICK } from './lines.js';
import { initEngine, setScene, engine, transition, fade, onTick } from './engine.js';
import { TASK_LIMITS, TASK_NAMES } from './science.js';
import { isSettingsOpen } from './ui.js';
import { initInput, setFP, input } from './input.js';
import { initAudio, sfx, setAmbience } from './audio.js';
import { speak, stopSpeak, $, el, button, setObjective, setPrompt, setLocation, toast, showHUD, showDialogue, openOverlay, closeOverlay, modal, openSettings, blocking, setModeListener } from './ui.js';
import { createCentre, CREW } from './centre.js';
import { conversation, BRIEFING, inspectInfo } from './dialogue.js';
import { openPayloadBench, openAssembly } from './design.js';
import { openChecklist, isPilot } from './launch.js';
import { openOrbitSelection, titleBackdrop } from './space.js';
import { createOps } from './ops.js';
import { computeAscent } from './ascent.js';
import { openAnalysis, openReport } from './analysis.js';
import { totals } from './engineering.js';
import { getStudio } from './design.js';
import { makeCharacter, SKINS, HAIR_COLOURS, HAIR_STYLES, SUITS, BUILDS, DEFAULT_AVATAR } from './builders.js';
import { award, setPointsListener, rankFor } from './points.js';
import { showPoints, setPointsTotal, setStepper } from './ui.js';
import { probeRecordings } from './voice.js';
import { SPEC } from './lines.js';
import { homecoming } from './moon.js';
import { walkActive, walkUse, gantryWalk, moonFlight, moonSurface, reentryGame, pickTeam, moonReport, moonState, TH, isExpedition, expStory } from './moon.js';
import { cabinScene } from './cabin.js';
import { startEngineering } from './eng.js';
import { startLobby } from './lobby.js';
import { spaceRun } from './flight.js';
import { initPip, sayAloud, openPipChat, setPipContext } from './pip.js';
import { setBuddyHooks, buddyNow } from './ui.js';
import { buddySay } from './ui.js';
import { plans } from './quick.js';

let centre = null;
const inCentre = () => engine.active === centre;
const isMoon = () => isExpedition(); let quiet = false;
function syncMode() { document.body.classList.toggle('in-centre', inCentre()); document.body.classList.toggle('moon', isMoon()); const cine = inCentre() && !!(centre && centre.cine); document.body.classList.toggle('cine', inCentre() && cine); const fp = (inCentre() || walkActive()) && !blocking() && !cine; setFP(fp); showHUD((inCentre() || walkActive()) && !blocking() && !cine); document.body.classList.toggle('fp', fp); }

const LEVEL = { arrive: 'Level 1 · A day at the space centre', crew: 'Level 1 · A day at the space centre', briefing: 'Level 1 · A day at the space centre', payload: 'Level 2 · Payload design', spacecraft: 'Level 3 · Spacecraft and launch', launch: 'Level 3 · Spacecraft and launch', orbit: 'Level 4 · Orbit and operations', ops: 'Level 4 · Orbit and operations', analysis: 'Level 5 · Results and discovery', report: 'Level 5 · Results and discovery' };
let roomName = '';
function updateObjective() {
  if (!centre) return; if (isMoon()) { const st = moonState().step; const t1 = st === 'arrive' ? ['Day 1 of 7 \u00B7 Walk in and check in with Godiva', 'Walk through the glass doors. Godiva is at the reception desk. Press Interact (E) to talk.', 'crew:specialist'] : ['Day 1 of 7 \u00B7 Suit up in Flight Preparation', 'Follow the amber arrow down the corridor to Flight Preparation and use the flight suits on the rack.', 'suits']; setObjective(t1[0], [], t1[1]); centre.setMarker(centre.posOf(t1[2])); setLocation(TH().title); if (inCentre()) buddySay(t1[1]); return; }
  if (!centre) return; const s = stageName(); let title = '', steps = [], hint = '', target = null;
  const crewStep = (id, where) => ({ text: `Meet ${CREW[id].name}, ${CREW[id].role} (${where})`, done: state.met[id] });
  if (s === 'arrive') { title = 'Walk into the space centre and check in with Godiva'; hint = 'Walk through the glass doors ahead. Godiva is at the reception desk. Press Interact (E) to talk to her.'; target = 'crew:specialist'; }
  else if (s === 'crew') { title = 'Meet your mission team'; steps = [crewStep('scientist', 'Science Laboratory'), crewStep('engineer', 'Engineering Bay'), crewStep('ops', 'Mission Control')]; const next = ['scientist', 'engineer', 'ops'].find((k) => !state.met[k]); target = next ? 'crew:' + next : null; hint = 'Follow the amber line along the corridor. Room names are beside each door.'; }
  else if (s === 'briefing') { title = 'Attend the mission briefing'; hint = 'Use the amber console in the Briefing Room, first door on the left of the corridor.'; target = 'briefing'; }
  else if (s === 'payload' && isQuick()) { title = 'Choose the telescope and where it will observe'; hint = 'Use the payload bench in front of you. The crew are around the centre if you want to ask them anything.'; target = 'payload'; }
  else if (s === 'launch' && isQuick()) { title = 'Launch the mission'; steps = [{ text: 'Optional: review or change the spacecraft at the assembly terminal', done: false }]; hint = isPilot() ? 'Use the launch console in Mission Control to ride out to the pad. You will sit in the capsule, work the switches and press the launch button yourself.' : 'Use the launch console at the front of Mission Control. Jehielle works the checklist; you fly the rocket.'; target = 'launch'; }
  else if (s === 'payload') { title = 'Choose the scientific payload'; hint = 'Use the payload bench in the Science Laboratory. The three instruments stand on the pedestals behind it.'; target = 'payload'; }
  else if (s === 'spacecraft') { const t = totals(state); title = 'Configure the spacecraft and pass the engineering review'; steps = [{ text: 'Choose all five subsystems', done: t.busComplete }, { text: 'Choose a launch vehicle', done: !!state.vehicle }, { text: 'Pass the engineering review', done: !!state.validated }]; hint = 'Use the assembly terminal in the Engineering Bay.'; target = 'spacecraft'; }
  else if (s === 'launch') { title = 'Launch the mission'; hint = isPilot() ? 'Use the launch console in Mission Control to ride out to the pad and board the rocket. You fly it from the cockpit.' : 'Use the launch console at the front of Mission Control and work the checklist in order.'; target = 'launch'; }
  else if (s === 'orbit' || s === 'ops') { title = 'Your spacecraft is in orbit: resume flight operations'; hint = 'Use the launch console in Mission Control.'; target = 'launch'; }
  else if (s === 'analysis') { title = 'Investigate the mission data'; hint = 'Use the analysis station in the Science Laboratory.'; target = 'analysis'; }
  else if (s === 'report') { title = 'Mission complete: review the report or fly again'; hint = 'The analysis station holds your mission report.'; target = 'analysis'; }
  if (settings.assist === 'independent') { steps = []; }
  setObjective(title, steps, hint); centre.setMarker(target ? centre.posOf(target) : null); setStepper(state.stage <= 2 ? 1 : s === 'payload' ? 2 : state.stage <= 5 ? 3 : state.stage <= 7 ? 4 : 5);
  setLocation(`${roomName}${roomName ? ' · ' : ''}${LEVEL[s]}`); if (inCentre()) buddySay(hint || title);
}

const game = {
  labelFor(it) {
    if (isMoon()) { const st = moonState().step; if (it.id === 'crew:specialist') return st === 'arrive' ? 'Check in with Godiva' : 'Talk to Godiva'; if (it.id === 'suits') return st === 'suit' ? 'Suit up for launch day' : 'Flight suits'; if (it.kind === 'patch') return 'Collect the mission patch'; if (it.kind === 'staff') return 'Say hello to ' + centre.npcs[+it.id.slice(6)].name; if (it.kind === 'crew') return 'Talk to ' + CREW[it.id.slice(5)].name; return null; }
    if (it.kind === 'crew') return 'Talk to ' + CREW[it.id.slice(5)].name;
    if (it.kind === 'patch') return 'Collect the mission patch';
    if (it.kind === 'staff') return 'Say hello to ' + centre.npcs[+it.id.slice(6)].name;
    if (it.kind === 'inspect') return 'Inspect ' + ({ model: 'the launcher model', wheel: 'the reaction wheel', tracker: 'the star tracker', suits: 'the clean-room garments', craft: 'the spacecraft' }[it.id] || 'the instrument');
    const s = stageName();
    if (it.id === 'briefing') return s === 'briefing' ? 'Start the mission briefing' : atLeast('payload') ? 'Review the mission briefing' : 'Briefing console';
    if (it.id === 'payload') return 'Use the payload bench';
    if (it.id === 'spacecraft') return 'Use the assembly terminal';
    if (it.id === 'launch') return s === 'launch' ? (isPilot() ? 'Board the rocket' : 'Start the launch checklist') : s === 'orbit' || s === 'ops' ? 'Resume flight operations' : 'Use the launch console';
    if (it.id === 'analysis') return s === 'report' ? 'Open the mission report' : 'Use the analysis station';
    return null;
  },
  onTarget(t) { setPrompt(t ? t.label : null); document.body.classList.toggle('has-target', !!t); },
  onRoom(r) { roomName = r.name; updateObjective(); },
  onAnnounce(text) { toast('Public address: "' + text + '"', 'info', 6000); if (!blocking()) speak(text, 'pa'); },
  onLockedDoor() { toast('This door needs an access badge. Check in with the Mission Specialist at the reception desk.', 'info'); sfx.deny(); },
  onUse(it) {
    initAudio(); const s = stageName();
    if (isMoon() && it.kind !== 'patch' && it.kind !== 'staff') return moonUse(it);
    if (it.kind === 'crew') return talk(it.id.slice(5));
    if (it.kind === 'staff') { const k = +it.id.slice(6), n = centre.npcs[k]; const list = STAFF_LINES[k]; n.said = ((n.said ?? -1) + 1) % list.length; sfx.talk(); award('staff:' + k, 20, 'Said hello to ' + n.name); return toast(`${n.name}, ${n.job.toLowerCase()}: "${list[n.said]}"`, 'info', 8000); }
    if (it.kind === 'patch') { const n = +it.id.slice(6); if (state.patches[n]) return; state.patches[n] = true; sfx.reveal(); award('patch:' + n, 75, 'Mission patch found'); toast('Mission patch ' + (6 - centre.patchesLeft) + ' of 6. ' + FACTS[n], 'good', 9000); if (centre.patchesLeft === 0) award('patches:all', 200, 'Collector: all six patches'); commit(); return; }
    if (it.kind === 'inspect') { const info = inspectInfo(it.id); sfx.select(); award('inspect:' + it.id, 25, 'Equipment inspected'); if (['model', 'wheel', 'tracker', 'suits', 'craft', 'inst:compact', 'inst:wide', 'inst:precision'].every((k) => state.awarded['inspect:' + k])) award('curious', 150, 'Curious mind: everything inspected'); return modal(info.title, el('div', {}, info.body.map((b) => el('p', {}, b))), [{ label: 'Close', value: true, cls: 'primary' }]); }
    const deny = (msg) => { sfx.deny(); toast(msg, 'info'); };
    if (it.id === 'briefing') { if (!atLeast('briefing')) return deny('The briefing begins once you have met the scientist, the engineer and the flight operations lead.'); return openBriefing(); }
    if (it.id === 'payload') { if (!atLeast('payload')) return deny('The payload bench unlocks after the mission briefing.'); if (state.launch) return deny('The spacecraft has launched. The payload can be changed when you redesign the mission after the report.'); return openPayloadBench(game); }
    if (it.id === 'spacecraft') { if (!state.payload) return deny('Choose a scientific payload at the payload bench first. The spacecraft is built around it.'); if (state.launch) return deny('The spacecraft has launched. Redesign is available after the mission report.'); return openAssembly(game); }
    if (it.id === 'launch') { if (s === 'orbit' || s === 'ops') return openOrbitSelection(game); if (state.launch) return deny('This mission has flown. Its data is at the analysis station in the Science Laboratory.'); if (!state.validated) return deny('Launch is locked until the spacecraft passes the engineering review at the assembly terminal.'); return openChecklist(game); }
    if (it.id === 'analysis') { if (s === 'report') return openReport(game); if (!state.opsResult) return deny('No mission data yet. This station unlocks when your spacecraft has finished observing.'); return openAnalysis(game); }
  },
  closeStation() { closeOverlay(); game.toCentre(); },
  afterLaunch() { if (engDone) return engAfterLaunch(); if (isMoon()) return moonAfterLaunch(); openOrbitSelection(game); },
  async afterOps() { await transition(async () => { setScene(centre); centre.place(3.1, 8.2, -Math.PI / 2); refreshCentre(); }, `${state.opsResult.days} days later · Science Laboratory`); syncMode(); toast('Mission data received. Use the analysis station.', 'good'); },
  toCentre(fresh) { if (!inCentre()) setScene(centre); if (fresh) centre.place(0.2, 4.0, Math.PI); refreshCentre(); syncMode(); },
};
const STAFF_LINES = [
  ['Morning! Every bolt on that spacecraft gets checked twice. A loose one on the ground is a lost mission in orbit.', 'The stand in the Engineering Bay turns so we can reach every side without touching the optics.', 'If the mass creeps up, the rocket has to get bigger. That is where budgets go to die.'],
  ['One dip proves nothing. I only get excited when it comes back on schedule.', 'Noise is not a mistake. It is just everything else the telescope saw.', 'When you fold the data, real signals stack up and accidents wash out.'],
  ['We rehearse every failure before launch, so nothing in flight is a first time.', 'Watch the status board in the corridor. It follows your mission live.', 'In Mission Control, a calm voice is part of the equipment.'],
];
const ROLE = () => ((settings.avatar || {}).outfit === 'astronaut' ? 'Astronaut' : 'Mission Lead');
function refreshCentre() { centre.rebuildCraft(); centre.refresh(); updateObjective(); }

const FACTS = ['TESS, NASA\u2019s planet-hunting telescope, watches each patch of sky for about 27 days at a time.', 'The Kepler space telescope found thousands of planets using the transit method you are about to use.', 'If Earth crossed the Sun as seen from far away, the Sun would dim by less than one hundredth of one percent.', 'Reaction wheels let a spacecraft turn without burning any fuel.', 'Sunlight takes a little over eight minutes to reach Earth.', 'The James Webb Space Telescope works near Sun-Earth L2, about 1.5 million kilometres from Earth.'];
function talk(role) {
  const c = centre.crew[role]; const conv = conversation(role); centre.faceTo(CREW[role].pos[0], CREW[role].pos[1]);
  showDialogue({ id: role, name: c.name, role: c.role, actor: c.actor }, conv.lines, () => {
    if (conv.firstMeet) { state.met[role] = true; award('meet:' + role, 50, 'Met ' + c.name); if (role === 'specialist' && stageName() === 'arrive') { setStage('crew'); sfx.confirm(); toast('Access badge issued. The corridor door is unlocked.', 'good'); if (isQuick()) { commit(); return teamCall(); } }
      if (stageName() === 'crew' && ['specialist', 'scientist', 'engineer', 'ops'].every((k) => state.met[k])) { setStage('briefing'); toast('You have met the team. The mission briefing is ready.', 'good'); } }
    commit();
  }, conv.quiz);
}

const BRIEF_ART = [
  (g, w, h, t) => { for (let i = 0; i < 70; i++) { const x = (i * 97 + t * (6 + i % 5) * 4) % w, y = (i * 53) % h; g.fillStyle = `rgba(255,255,255,${0.25 + (i % 4) * 0.18})`; g.fillRect(x, y, 2, 2); } g.strokeStyle = '#f2a23a'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, h * 0.3, 0, 7); g.stroke(); g.beginPath(); g.ellipse(w / 2, h / 2, h * 0.42, h * 0.15, -0.5, 0, 7); g.stroke(); const a = t * 0.9; g.fillStyle = '#e8ebee'; g.beginPath(); g.arc(w / 2 + Math.cos(a) * h * 0.42 * Math.cos(-0.5) - Math.sin(a) * h * 0.15 * Math.sin(-0.5), h / 2 + Math.cos(a) * h * 0.42 * Math.sin(-0.5) + Math.sin(a) * h * 0.15 * Math.cos(-0.5), 6, 0, 7); g.fill(); },
  (g, w, h, t) => { const ph = (t * 0.16) % 1, cx = w * 0.5, cy = h * 0.5, R = h * 0.34; const gr = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R); const dim = Math.abs(ph - 0.5) < 0.2 ? 0.9 : 1; gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(0.8, '#f08a3c'); gr.addColorStop(1, '#8a3a16'); g.globalAlpha = dim; g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = '#07090c'; g.beginPath(); g.arc(cx - R * 1.8 + ph * R * 3.6, cy + R * 0.15, R * 0.14, 0, 7); g.fill(); },
  (g, w, h, t) => { const ph = (t * 0.14) % 1; g.strokeStyle = '#2a323c'; g.strokeRect(w * 0.08, h * 0.15, w * 0.84, h * 0.7); g.strokeStyle = '#e8ebee'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 200; i++) { const u = i / 200; if (u > ph) break; const k = (u * 3) % 1; const dip = Math.abs(k - 0.5) < 0.06 ? h * 0.3 * Math.min(1, (0.06 - Math.abs(k - 0.5)) / 0.02) : 0; const y = h * 0.32 + dip + Math.sin(i * 1.7) * 2; i ? g.lineTo(w * 0.08 + u * w * 0.84, y) : g.moveTo(w * 0.08 + u * w * 0.84, y); } g.stroke(); g.fillStyle = '#8d97a3'; g.font = '600 13px system-ui'; g.fillText('BRIGHTNESS OVER TIME (ILLUSTRATION, NOT DATA)', w * 0.08, h * 0.95); },
  (g, w, h, t) => { const cx = w / 2, cy = h / 2 + Math.sin(t * 1.2) * 5; g.fillStyle = '#35506b'; for (const sx of [-1, 1]) { g.fillRect(cx + sx * 44 - (sx < 0 ? 96 : 0), cy - 20, 96, 40); g.strokeStyle = '#07090c'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx + sx * 44 + sx * i * 24, cy - 20); g.lineTo(cx + sx * 44 + sx * i * 24, cy + 20); g.stroke(); } } g.fillStyle = '#b98a2e'; g.fillRect(cx - 40, cy - 46, 80, 92); g.fillStyle = '#e8ebee'; g.fillRect(cx - 22, cy - 86, 44, 42); g.fillStyle = '#07090c'; g.beginPath(); g.arc(cx, cy - 86, 16, 0, 7); g.fill(); g.strokeStyle = '#e8ebee'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy + 60, 14, Math.PI, 0); g.stroke(); },
  (g, w, h, t) => { [['MASS', 0.72, '#6fa8c4'], ['POWER', 0.58, '#6fbf8b'], ['BUDGET', 0.86, '#f2a23a']].forEach(([n, v, c], i) => { const y = h * 0.24 + i * h * 0.24, k = Math.min(1, t * 0.6) * v; g.fillStyle = '#8d97a3'; g.font = '600 14px system-ui'; g.fillText(n, w * 0.1, y - 8); g.fillStyle = '#1b222a'; g.fillRect(w * 0.1, y, w * 0.8, 18); g.fillStyle = c; g.fillRect(w * 0.1, y, w * 0.8 * k, 18); g.fillStyle = '#e5564b'; g.fillRect(w * 0.1 + w * 0.8 * 0.95, y - 5, 3, 28); }); },
  (g, w, h, t) => { g.fillStyle = '#3a6ea5'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.2, 0, 7); g.fill(); g.strokeStyle = '#4a5560'; g.lineWidth = 2; g.beginPath(); g.ellipse(w / 2, h / 2, h * 0.42, h * 0.3, 0, 0, 7); g.stroke(); const a = t * 0.8, sx = w / 2 + Math.cos(a) * h * 0.42, sy = h / 2 + Math.sin(a) * h * 0.3; g.fillStyle = '#e8ebee'; g.fillRect(sx - 5, sy - 5, 10, 10); if (Math.sin(a) > 0) { g.strokeStyle = 'rgba(111,191,139,0.8)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(w / 2, h / 2 + h * 0.2); g.stroke(); g.setLineDash([]); } },
  (g, w, h, t) => { ['Dips measured', 'Dips repeat on schedule', 'Honest conclusion'].forEach((n, i) => { const y = h * 0.28 + i * h * 0.22, on = t > 0.8 + i * 0.9; g.strokeStyle = on ? '#6fbf8b' : '#4a5560'; g.lineWidth = 3; g.strokeRect(w * 0.14, y - 16, 24, 24); if (on) { g.beginPath(); g.moveTo(w * 0.14 + 5, y - 3); g.lineTo(w * 0.14 + 11, y + 4); g.lineTo(w * 0.14 + 21, y - 11); g.stroke(); } g.fillStyle = on ? '#e8ebee' : '#8d97a3'; g.font = '600 18px system-ui'; g.fillText(n, w * 0.14 + 40, y + 3); }); },
  (g, w, h, t) => { const tilt = Math.sin(t * 0.9) * 0.12; g.save(); g.translate(w / 2, h * 0.42); g.rotate(tilt); g.strokeStyle = '#e8ebee'; g.lineWidth = 4; g.beginPath(); g.moveTo(-w * 0.28, 0); g.lineTo(w * 0.28, 0); g.stroke(); for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * w * 0.28, 0); g.lineTo(sx * w * 0.28, h * 0.2); g.stroke(); g.fillStyle = sx < 0 ? '#6fa8c4' : '#f2a23a'; g.fillRect(sx * w * 0.28 - 34, h * 0.2, 68, 12); } g.restore(); g.fillStyle = '#e8ebee'; g.fillRect(w / 2 - 3, h * 0.42, 6, h * 0.36); g.fillStyle = '#8d97a3'; g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillText('EVIDENCE', w * 0.22, h * 0.9); g.fillText('CLAIM', w * 0.78, h * 0.9); g.textAlign = 'left'; },
];
function openBriefing() {
  let i = 0, t0 = 0, typed = null; const root = el('div', { class: 'station solo' }); const first = stageName() === 'briefing';
  const art = el('canvas', { width: 640, height: 260, class: 'brief-art', 'aria-hidden': 'true' }); const g = art.getContext('2d');
  const stop = onTick((dt) => { t0 += dt; g.fillStyle = '#07090c'; g.fillRect(0, 0, 640, 260); g.save(); try { BRIEF_ART[i % BRIEF_ART.length](g, 640, 260, t0); } catch (e) { /* decorative */ } g.restore(); });
  const leave = () => { clearInterval(typed); stop(); stopSpeak(); };
  const render = () => { root.innerHTML = ''; clearInterval(typed); t0 = 0; const b = BRIEFING[i]; const who = CREW[b.who]; const last = i === BRIEFING.length - 1; speak(b.text, b.who);
    const text = el('p', { class: 'brief-text', 'aria-label': b.text }); let n = settings.reducedMotion ? b.text.length : 0; text.textContent = b.text.slice(0, n); typed = setInterval(() => { n = Math.min(b.text.length, n + 3); text.textContent = b.text.slice(0, n); if (n >= b.text.length) clearInterval(typed); }, 30);
    root.append(el('section', { class: 'panel wide briefing cinema' }, el('div', { class: 'label' }, `Mission briefing · ${i + 1} of ${BRIEFING.length}`), el('h2', {}, b.title), art,
      el('div', { class: 'lower-third' }, portrait(who.look), el('div', { class: 'dlg-name' }, who.name, el('span', {}, who.role))), text,
      el('div', { class: 'progress' }, BRIEFING.map((_, k) => el('i', { class: k <= i ? 'on' : '' }))),
      el('div', { class: 'row-btns' }, i > 0 ? button('Back', () => { i--; render(); }, 'ghost') : button('Leave', () => { leave(); game.closeStation(); }, 'ghost'),
        last ? button(first ? 'Accept the mission' : 'Close briefing', () => { leave(); if (first) { award('briefing', 100, 'Mission accepted'); setStage('payload'); sfx.confirm(); toast('Mission accepted. You are now responsible for it.', 'good'); } game.closeStation(); }, 'primary') : button('Continue', () => { i++; sfx.talk(); render(); }, 'primary')))); };
  render(); openOverlay(root, 'station-overlay dim'); syncMode();
}

// ----- the story so far -----
const starsBg = (g, w, h, t) => { for (let i = 0; i < 90; i++) { const tw = 0.35 + 0.3 * Math.sin(t * 1.3 + i); g.fillStyle = `rgba(255,255,255,${tw})`; g.fillRect((i * 137) % w, (i * 71) % (h * 0.8), 2, 2); } };
const redStar = (g, x, y, R, dim) => { const gr = g.createRadialGradient(x, y, R * 0.1, x, y, R * 2.2); gr.addColorStop(0, `rgba(255,${200 - dim * 60},${150 - dim * 70},1)`); gr.addColorStop(0.4, `rgba(240,110,60,${0.95 - dim * 0.35})`); gr.addColorStop(0.46, 'rgba(240,110,60,0.18)'); gr.addColorStop(1, 'rgba(240,110,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 2.2, 0, 7); g.fill(); };
const STORY = [
  { when: 'Three nights ago · 02:14', title: 'A star blinked', text: 'On a hill outside the city, a student volunteer was watching a small, quiet red star through a school telescope. Nothing ever happens to this star. Then, for three hours, it grew a tiny bit dimmer. And then it came back. Can you spot it? Tap the star when it fades.',
    art: (g, w, h, t) => { starsBg(g, w, h, t); const dim = Math.max(0, Math.sin(t * 0.7)) ** 4; redStar(g, w * 0.68, h * 0.3, 26, dim); g.fillStyle = '#0d1014'; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.62, h * 0.86); g.lineTo(w, h * 0.8); g.lineTo(w, h); g.fill(); g.fillStyle = '#1e252c'; g.fillRect(w * 0.22, h * 0.6, 54, 34); g.beginPath(); g.arc(w * 0.22 + 27, h * 0.6, 27, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(242,162,58,0.35)'; g.setLineDash([4, 8]); g.beginPath(); g.moveTo(w * 0.22 + 34, h * 0.56); g.lineTo(w * 0.68, h * 0.3); g.stroke(); g.setLineDash([]); g.fillStyle = '#f2a23a'; g.fillRect(w * 0.22 + 20, h * 0.66, 8, 10); } },
  { when: 'The next morning', title: 'It was not the first time', text: 'She posted it online, expecting nothing. Within an hour an observatory on the other side of the world replied. They had seen the same star do the same thing eleven nights earlier. Same depth. Same length. Two dips are a coincidence. Or the start of a pattern.',
    art: (g, w, h, t) => { g.strokeStyle = '#2a323c'; g.strokeRect(w * 0.08, h * 0.2, w * 0.84, h * 0.55); g.strokeStyle = '#e8ebee'; g.lineWidth = 3; g.beginPath(); const ph = Math.min(1, (t * 0.22) % 1.6); for (let i = 0; i <= 240; i++) { const u = i / 240; if (u > ph) break; const d = (c) => Math.abs(u - c) < 0.035 ? h * 0.22 * Math.min(1, (0.035 - Math.abs(u - c)) / 0.012) : 0; const y = h * 0.36 + d(0.27) + d(0.73) + Math.sin(i * 2.1) * 2.2; i ? g.lineTo(w * 0.08 + u * w * 0.84, y) : g.moveTo(w * 0.08 + u * w * 0.84, y); } g.stroke(); g.fillStyle = '#f2a23a'; g.font = '600 14px system-ui'; if (ph > 0.3) g.fillText('DIP 1', w * 0.28, h * 0.7); if (ph > 0.76) g.fillText('DIP 2 · 11 NIGHTS LATER', w * 0.6, h * 0.7); g.fillStyle = '#8d97a3'; g.fillText('BRIGHTNESS OF THE STAR (STORY ILLUSTRATION)', w * 0.08, h * 0.9); } },
  { when: 'The question', title: 'What can hide a star?', text: 'Stars do not blink for no reason. Something may be passing in front of it: a planet nobody has ever seen, a second star, a cloud of dust. Or both telescopes simply made a mistake. From the ground, with clouds, daylight and shaking air in the way, nobody can tell which.',
    art: (g, w, h, t) => { starsBg(g, w, h, t); redStar(g, w * 0.5, h * 0.48, 44, 0); const u = (t * 0.18) % 1; g.fillStyle = '#05070a'; g.beginPath(); g.arc(w * 0.2 + u * w * 0.6, h * 0.52, 12, 0, 7); g.fill(); g.fillStyle = '#f2a23a'; g.font = '700 46px system-ui'; g.textAlign = 'center'; g.fillText('?', w * 0.2 + u * w * 0.6, h * 0.3); g.textAlign = 'left'; } },
  { when: 'Your call', title: 'What is your hunch?', text: 'Every investigation starts with a guess. Make yours now. At the end of the mission, the data will tell you whether you were right.', choice: [['planet', 'A hidden planet'], ['star', 'A second, fainter star'], ['glitch', 'A telescope mistake'], ['unsure', 'Too early to say']],
    art: (g, w, h, t) => { starsBg(g, w, h, t); redStar(g, w * 0.5, h * 0.45, 38, Math.max(0, Math.sin(t)) ** 6); } },
  { when: 'Why it matters', title: 'A new world, if it is real', text: 'Small red stars like this one are where rocky planets can stay warm enough for water. If something is circling this star, it would be a world no human has ever known about. To find out, someone has to put a telescope above the air and stare at that one star for weeks without blinking.',
    art: (g, w, h, t) => { starsBg(g, w, h, t); redStar(g, w * 0.26, h * 0.5, 40, 0); const a = t * 0.6; const x = w * 0.26 + Math.cos(a) * w * 0.34, y = h * 0.5 + Math.sin(a) * h * 0.16; g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.ellipse(w * 0.26, h * 0.5, w * 0.34, h * 0.16, 0, 0, 7); g.stroke(); const gr = g.createRadialGradient(x - 4, y - 4, 2, x, y, 15); gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(1, '#1d3f7a'); g.fillStyle = Math.sin(a) > 0 || Math.abs(x - w * 0.26) > 40 ? gr : 'rgba(0,0,0,0)'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); } },
  { when: 'Today · 06:40', title: 'They chose you', text: 'This morning the Starbound programme approved one small mission to find the truth. One spacecraft. One tight budget. One launch window. And one person in charge of all of it, from the first decision to the last data point. A car is already waiting to take you to the space centre.', last: true,
    art: (g, w, h, t) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1424'); gr.addColorStop(0.7, '#d98f5c'); gr.addColorStop(0.72, '#17191c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#0d0f12'; g.fillRect(w * 0.62, h * 0.2, 14, h * 0.52); g.fillStyle = '#e8ebee'; g.fillRect(w * 0.585, h * 0.26, 12, h * 0.46); g.beginPath(); g.moveTo(w * 0.585, h * 0.26); g.lineTo(w * 0.585 + 6, h * 0.18); g.lineTo(w * 0.585 + 12, h * 0.26); g.fill(); g.fillStyle = Math.sin(t * 3) > 0 ? '#ff5a4a' : '#5a2020'; g.fillRect(w * 0.62 + 4, h * 0.17, 5, 5); const cx = ((t * 40) % (w * 0.5)); g.fillStyle = '#0d0f12'; g.fillRect(cx, h * 0.76, 38, 10); g.fillRect(cx + 8, h * 0.72, 20, 8); g.fillStyle = '#ffe2b0'; g.fillRect(cx + 38, h * 0.78, 30, 2); } },
];
const HUNCH = { planet: 'a hidden planet', star: 'a second, fainter star', glitch: 'a telescope mistake', unsure: 'too early to say' };
function playStory() {
  return new Promise((res) => { let i = 0, t0 = 0, typed = null; document.body.classList.add('no-timer');
    const art = el('canvas', { width: 720, height: 300, class: 'brief-art story-art', 'aria-hidden': 'true' }); const g = art.getContext('2d'); const root = el('div', { class: 'station solo story' });
    const stop = onTick((dt) => { t0 += dt; g.fillStyle = '#05070a'; g.fillRect(0, 0, 720, 300); g.save(); try { STORY[i].art(g, 720, 300, t0); } catch (e) { /* decorative */ } g.restore(); });
    const end = () => { clearInterval(typed); stop(); document.body.classList.remove('no-timer'); closeOverlay(); res(); };
    const render = () => { root.innerHTML = ''; clearInterval(typed); t0 = 0; const s = STORY[i]; const who = settings.playerName ? `${ROLE()} ${settings.playerName}` : ROLE(); const full = s.last ? s.text + ` Good luck, ${who}.` : s.text;
      const text = el('p', { class: 'brief-text', 'aria-label': full }); let n = settings.reducedMotion ? full.length : 0; text.textContent = full.slice(0, n); const btns = el('div', { class: 'row-btns' }); const showAll = () => { n = full.length; text.textContent = full; clearInterval(typed); };
      typed = setInterval(() => { n = Math.min(full.length, n + 2); text.textContent = full.slice(0, n); if (n >= full.length) clearInterval(typed); }, 28); text.addEventListener('click', showAll);
      const next = () => { sfx.talk(); if (i >= STORY.length - 1) return end(); i++; render(); };
      if (s.choice) btns.append(el('div', { class: 'opts hunch' }, s.choice.map(([v, label]) => el('button', { type: 'button', class: 'opt', onclick: () => { settings.hunch = v; save(); sfx.confirm(); award('hunch', 25, 'You made a prediction'); next(); } }, el('b', {}, label)))));
      else btns.append(button('Skip the story', end, 'ghost'), button(s.last ? 'Go to the space centre' : 'Next', next, 'primary pulse'));
      root.append(el('section', { class: 'panel wide briefing cinema' }, el('div', { class: 'label' }, `${s.when} · Chapter ${i + 1} of ${STORY.length}`), el('h2', {}, s.title), art, text, el('div', { class: 'progress' }, STORY.map((_, k) => el('i', { class: k <= i ? 'on' : '' }))), btns)); };
    let spotted = false; art.style.cursor = 'pointer'; art.addEventListener('pointerdown', (e) => { if (i !== 0 || spotted) return; const r = art.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 720, y = (e.clientY - r.top) / r.height * 300; if (Math.hypot(x - 720 * 0.68, y - 300 * 0.3) < 60) { spotted = true; sfx.reveal(); award('story:star', 50, 'Sharp eyes: you spotted the blinking star'); toast('That is the one. You saw it blink, just like she did.', 'good', 5000); } });
    render(); openOverlay(root, 'station-overlay story-overlay'); syncMode(); });
}

// ----- Seven Days on the Moon: the parts that happen in and after the space centre -----
const TEAM = () => [...Object.entries(CREW).map(([id, c]) => ({ id, name: c.name, look: c.look, skill: { specialist: 'Mission specialist. Calm under pressure, knows every procedure.', scientist: 'Scientist. Knows which rocks are worth bringing home.', engineer: 'Engineer. Can fix the lander with what is on board.', ops: 'Flight operations. The best navigator in the building.' }[id] })), ...centre.npcs.slice(0, 2).map((n, k) => ({ id: 'staff' + k, name: n.name, look: n.d.look, skill: k ? 'Data scientist. Runs the experiments and the cameras.' : 'Propulsion technician. Knows the engines inside out.' }))];
const teamLooks = () => { if (!centre) return [CREW.scientist.look, CREW.engineer.look]; const all = TEAM(); return (moonState().team || []).map((id) => (all.find((c) => c.id === id) || all[0]).look); };
async function moonUse(it) {
  const m = moonState(); const deny = (t) => { sfx.deny(); toast(t, 'info'); };
  if (it.id === 'crew:specialist' && m.step === 'arrive') { centre.faceTo(CREW.specialist.pos[0], CREW.specialist.pos[1]); sfx.talk(); sayAloud(`Welcome to Starbound${settings.playerName ? ', ' + settings.playerName : ''}. You made it. I am Godiva. This week you fly to ${TH().name} to find our lost probe, ${TH().probe}. But nobody goes alone. First, choose two crew mates.`, 'specialist'); await modal('Godiva · Mission Specialist', el('div', { class: 'howto' }, el('p', {}, `Welcome to Starbound${settings.playerName ? ', ' + settings.playerName : ''}. You made it. Here is your week.`), el('ul', {}, ['Day 1: choose your crew and suit up.', 'Day 2: walk to the rocket, climb aboard and launch it yourself.', 'Day 3: float through the cabin on the way there.', `Day 4: land on ${TH().name} by hand and climb down the ladder.`, `Days 4 to 6: explore, and find the lost probe ${TH().probe}.`, 'Day 7: lift off, fly the re-entry and splash down.'].map((x) => el('li', {}, x))), el('p', {}, `First: nobody goes to ${TH().name} alone. Choose two crew mates.`)), [{ label: 'Choose my crew', value: true, cls: 'primary' }], 'wide-guide'); m.team = await pickTeam(TEAM()); m.step = 'suit'; state.met.specialist = true; award('moon:team', 100, 'Crew chosen'); commit(); syncMode(); updateObjective(); return toast('Crew confirmed. Your badge now opens the corridor door.', 'good', 6000); }
  if (it.id === 'suits') { if (m.step !== 'suit') return deny('Check in with Godiva at reception first.'); sfx.confirm(); return moonLaunchDay(); }
  if (it.kind === 'crew') return toast(`${CREW[it.id.slice(5)].name}: "Good luck up there. We will be watching every second."`, 'info', 6000);
  if (it.kind === 'inspect') { const info = inspectInfo(it.id); return modal(info.title, el('div', {}, info.body.map((b) => el('p', {}, b))), [{ label: 'Close', value: true, cls: 'primary' }]); }
  deny('That station is for the Blinking Star mission. For this one, follow the amber arrow.');
}
let engDone = null;
async function engFly(done) { engDone = done; settings.mission = 'orbit'; settings.avatar = Object.assign({}, settings.avatar || {}, { outfit: 'astronaut' }); document.body.classList.remove('eng-on');
  if (!state.vehicle) { const fit = (plans('wide').find((p) => p.fit) || {}).fit; if (fit) Object.assign(state, { payload: 'wide', bus: fit.bus, vehicle: fit.vehicle, validated: true }); setStage('launch'); }
  let sc; await transition(async () => { sc = gantryWalk(teamLooks(), () => { engBoard(); }); setScene(sc); }, 'Launch day · walk to your rocket with your team'); syncMode(); sayAloud('There is the rocket you built, with your spacecraft in the nose. Walk across the access arm with your team and step inside.'); }
async function engBoard() { let sc; await transition(async () => { sc = cabinScene('pad', teamLooks(), () => { openChecklist(game); }); setScene(sc); }, 'Inside the spacecraft · climb to your seat'); syncMode(); sayAloud('Climb the ladder to your seat. You are flying it to orbit yourself.'); }
async function engAfterLaunch() { let sc; await transition(async () => { sc = cabinScene('space', teamLooks(), () => { engRun(); }); setScene(sc); }, 'Engines off · float through the cabin'); syncMode(); }
async function engRun() { let sc; await transition(async () => { sc = spaceRun(() => { const d = engDone; engDone = null; settings.mission = 'star'; document.body.classList.add('eng-on'); syncMode(); d(); }); setScene(sc); }, 'Helmets on · fly through the asteroids to your orbit'); syncMode(); }
async function moonLaunchDay() {
  const m = moonState(); settings.avatar = Object.assign({}, settings.avatar || {}, { outfit: 'astronaut' }); save();
  if (!state.vehicle) { const fit = (plans('wide').find((p) => p.fit) || {}).fit; if (fit) Object.assign(state, { payload: 'wide', bus: fit.bus, vehicle: fit.vehicle, validated: true }); setStage('launch'); }
  m.step = 'gantry'; commit(); let sc; await transition(async () => { sc = gantryWalk(teamLooks(), () => { m.step = 'board'; commit(); moonBoard(); }); setScene(sc); }, 'Day 2 of 7 · Launch day · the crew access arm, 80 metres up'); syncMode();
}
async function moonBoard() { const m = moonState(); let sc; await transition(async () => { sc = cabinScene('pad', teamLooks(), () => { m.step = 'launch'; commit(); openChecklist(game); }); setScene(sc); }, 'Day 2 of 7 · Inside the spacecraft'); syncMode(); }
async function moonCabin() { const m = moonState(); let sc; await transition(async () => { sc = cabinScene('space', teamLooks(), () => { m.step = 'run'; commit(); moonRun(); }); setScene(sc); }, `Day 3 of 7 · Engines off · on the way to ${TH().name}`); syncMode(); }
async function moonRun() { const m = moonState(); let sc; await transition(async () => { sc = spaceRun(() => { m.step = 'land'; commit(); moonLand(); }); setScene(sc); }, 'Day 3 of 7 \u00B7 Helmets on \u00B7 you have the controls'); }
async function moonAfterLaunch() { const m = moonState(); m.step = 'cabin'; commit(); await moonCabin(); }
async function moonLand() { const m = moonState(); let sc; await transition(async () => { sc = moonFlight('land', (r) => { m.step = 'surface'; commit(); moonWalk(); }); setScene(sc); }, `Day 4 of 7 · 100 metres above ${TH().name}`); }
async function moonWalk() { const m = moonState(); let sc; await transition(async () => { sc = moonSurface(teamLooks(), 0, () => { m.step = 'home'; commit(); moonHome(); }); setScene(sc); }, 'Day 4 of 7 · The hatch opens'); syncMode(); }
async function moonHome() { let sc; await transition(async () => { sc = moonFlight('ascent', async () => { await transition(async () => { setScene(titleBackdrop()); }, 'Day 7 of 7 · Three days later · Earth fills the window'); syncMode(); const acc = await reentryGame(); moonState().step = 'done'; commit(); await new Promise((res) => { transition(async () => { setScene(homecoming(teamLooks(), res)); }, 'Day 7 of 7 \u00B7 Splashdown \u00B7 the recovery ship').then(() => syncMode()); }); await transition(async () => { setScene(titleBackdrop()); }, 'Mission complete'); syncMode(); await moonReport(acc); hardReset(); location.reload(); }); setScene(sc); }, 'Day 7 of 7 · Time to go home'); }
function moonResume() { const st = moonState().step; if (st === 'gantry' || st === 'launch' || st === 'board') return moonLaunchDay(); if (st === 'cabin') return moonCabin(); if (st === 'run') return moonRun(); if (st === 'land') return moonLand(); if (st === 'surface') return moonWalk(); if (st === 'home') return moonHome(); }

// ----- choosing a mission, the assist level and the short briefing -----
const MISSIONS = [
  { id: 'eng', name: 'Engineering Lab: Build a Spacecraft', tag: 'Start here \u00B7 the NASA way', time: '6 steps \u00B7 about 15 minutes', text: 'Design a real science spacecraft, assemble it part by part in a 3D cleanroom, then test it until it is ready to fly.', wide: true },
  { id: 'star', name: 'The Blinking Star', tag: 'Discover a hidden world', time: '5 levels · 10 to 40 minutes', text: 'A red star keeps fading. Build a space telescope, launch it and find out what is hiding there.', brief: ['A small red star keeps getting dimmer for a few hours, then recovering. Nobody knows why.', 'Your job: choose a telescope, build the spacecraft around it, launch it, keep it alive in orbit, and decide what the data really shows.', 'You start outside the Starbound space centre. Walk in and check in with Godiva.'] },
  { id: 'moon', name: 'Seven Days on the Moon', tag: 'Land, explore, come home', time: '7 days · about 15 minutes', text: 'A probe on the Moon heard something and went silent. Fly there with your crew, find it, and bring its memory home.', brief: ['The Moon still has secrets: what its rocks are made of, and whether it still shakes with moonquakes.', 'Your job: pick a crew, launch, land the lander yourself, collect three rock samples, take photos, set up a sensor, and fly everyone home.', 'You have 7 days. You start outside the Starbound space centre. Walk in and check in with Godiva.'] },
  { id: 'mercury', name: 'Mercury: the Burning Planet', tag: 'Find ice beside the Sun', time: '7 days \u00B7 about 15 minutes', text: 'A probe found something in a crater where sunlight never reaches. Land, find it, and bring the answer home.' },
  { id: 'europa', name: 'Signal from Europa', tag: 'Listen to a hidden ocean', time: '7 days \u00B7 about 15 minutes', text: 'Something is knocking under the ice of Jupiter\u2019s moon. Go there and hear it for yourself.' },
];
const STAR_STORY = { title: 'The Blinking Star', ground: '#e0703a', story: [['Three nights ago', 'A student was watching a small red star through a school telescope. For three hours it grew dimmer. Then it came back.'], ['The mystery', 'Another observatory saw the very same fade eleven nights earlier. Something may be passing in front of that star. A planet nobody has ever seen? Or only a mistake?'], ['Your mission', 'Build a space telescope, launch it above the clouds, and watch that star without blinking. Then decide what the evidence really shows.']] };
function chooseMission() { return new Promise((res) => { const root = el('div', { class: 'station solo' }); root.append(el('section', { class: 'panel wide' }, el('div', { class: 'label' }, 'Choose your mission'), el('h2', {}, 'Where do you want to go?'), el('div', { class: 'mission-grid' }, MISSIONS.map((m) => el('button', { type: 'button', class: 'opt mission' + (m.soon ? ' soon' : '') + (m.wide ? ' wide' : ''), disabled: m.soon ? true : undefined, onclick: () => { sfx.confirm(); closeOverlay(); res(m.id); } }, el('span', { class: 'label' }, m.tag), el('b', {}, m.name), el('div', { class: 'note' }, m.text), el('i', {}, m.time)))), el('div', { class: 'row-btns' }, button('Back', () => { closeOverlay(); res(null); }, 'ghost')))); openOverlay(root, 'station-overlay story-overlay'); }); }
async function chooseAssist() { const v = await modal('How much help do you want?', el('p', {}, 'Guided gives you PIP, a personal guide who tells you what to do, with arrows and pop-ups. You can change this in Settings.'), [{ label: 'Independent', value: 'independent' }, { label: 'Standard', value: 'standard' }, { label: 'Guided (with PIP)', value: 'guided', cls: 'primary' }]); settings.assist = v || 'guided'; save(); }
function missionBrief() { const m = MISSIONS.find((x) => x.id === (settings.mission || 'star')); return modal('Your mission · ' + m.name, el('div', { class: 'howto' }, m.brief.map((x) => el('p', {}, x))), m.id === 'star' ? [{ label: 'Tell me the full story', value: 'story' }, { label: 'Start', value: true, cls: 'primary' }] : [{ label: 'Start', value: true, cls: 'primary' }], 'wide-guide'); }

// ----- how to play -----
function openGuide(nextLabel = 'Close') {
  const sec = (t, ...c) => el('div', { class: 'guide-sec' }, el('h3', {}, t), ...c); const li = (items) => el('ul', {}, items.map((x) => el('li', {}, x)));
  const body = el('div', { class: 'howto' },
    sec('What is STARBOUND?', el('p', {}, 'You run one real-style space mission from start to finish. A distant star keeps getting slightly dimmer, then brighter again. Your job is to find out why. It might be a planet passing in front of the star.')),
    sec('How you win', el('p', {}, 'Collect clear evidence and report honestly what it shows. You score points for good choices, finishing tasks on time, exploring, and a conclusion that matches your data. Claiming more than your data proves loses points.')),
    sec('Two ways to play', el('p', {}, 'Astronaut (the pilot): you sit inside the rocket, flip the cockpit switches, press the launch button and fly to orbit from the pilot\u2019s seat. Mission crew: you run the launch from Mission Control. You choose when you create your character.')),
    sec('The mission in five steps', el('ol', {}, ['Meet your crew at the space centre and get your mission.', 'Choose a telescope (the payload) and where it will observe from.', 'Build the spacecraft, then fly the rocket yourself.', 'Keep the spacecraft healthy in orbit while it watches the star.', 'Study the data, mark the dips, and decide what you can truly say.'].map((x) => el('li', {}, x)))),
    sec('Controls on a tablet or phone', li(['Left side of the screen: drag to walk, like Roblox.', 'Right side: drag to look around. Pinch to zoom in or out.', 'Interact button: talk to people and use glowing stations.', 'Jump button: jump. View button: switch between seeing your character and first person.'])),
    sec('Controls on a computer', li(['W A S D or arrow keys to walk, Shift to run, Space to jump.', 'Click the view, then move the mouse to look. Mouse wheel zooms.', 'E to talk or use something. V switches camera. P opens Settings.'])),
    sec('On screen', li(['Top left: where you are and what to do next.', 'The map shows you (white arrow), your next goal (amber diamond), your crew (blue) and staff (grey).', 'The clock is the time left for this task. Running over costs 10 points every 10 seconds, but the mission never ends early.', 'Stars are your points. Six hidden mission patches and friendly staff give extra.'])),
    sec('Tips', li(['Follow the amber line on the corridor floor and the amber diamond.', 'Stuck? Talk to a crew member again. They explain the next step.', 'Open Help at any time to read this again.'])));
  return modal('How to play', body, [{ label: nextLabel, value: true, cls: 'primary' }], 'wide-guide');
}

// ----- task timers -----
// Every task has a time limit. Running out does not stop the mission; it is recorded and scored.
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
let timerShown = '', lastBeep = -1;
function tickTimer(dt) {
  if (isMoon()) { const b = $('#timer'); if (!b.hidden) b.hidden = true; return; }
  const box = $('#timer'); const name = stageName(); const mult = settings.timers === 'relaxed' ? 2 : 1;
  // close the books on the previous task when the stage changes
  if (state.timer && state.timer.stage !== state.stage) { const prev = state.timer.name; if (TASK_LIMITS[prev] && state.timer.used <= state.timer.limit && !state.times[prev]) award('ontime:' + prev, 50, 'On time: ' + TASK_NAMES[prev]);
    if (TASK_LIMITS[prev]) state.times[prev] = { used: Math.round(state.timer.used) + (state.times[prev] ? state.times[prev].used : 0), limit: state.timer.limit }; state.timer = null; }
  if (!centre || settings.timers === 'off' || !TASK_LIMITS[name]) { if (!box.hidden) box.hidden = true; return; }
  if (!state.timer) { state.timer = { stage: state.stage, name, used: 0, limit: TASK_LIMITS[name] * mult, expired: false }; lastBeep = -1; }
  const t = state.timer; t.limit = TASK_LIMITS[name] * mult;
  const paused = isSettingsOpen() || centre.cine || document.body.classList.contains('no-timer') || document.hidden || !$('#title').hidden;
  if (!paused) t.used += dt;
  const left = t.limit - t.used;
  if (left <= 0 && !t.expired) { t.expired = true; sfx.alert(); toast(`Time is up for "${TASK_NAMES[name]}". You can still finish it, but you lose 10 points for every 10 seconds over.`, 'alert', 8000); if (!blocking()) speak(SPEC.timeUp, 'specialist'); save(); }
  if (left < 0) { const k = Math.floor(-left / 10); if (k >= 1 && k <= 12) award(`late:${name}:${state.runs}:${k}`, -10, 'Overtime'); }
  if (left > 0 && left <= 10 && Math.ceil(left) !== lastBeep && !paused) { lastBeep = Math.ceil(left); sfx.beep(false); }
  const text = left >= 0 ? mmss(Math.ceil(left)) : '+' + mmss(-left); const cls = left < 0 ? 'over' : left <= 20 ? 'low' : ''; const key = text + cls + paused;
  if (key !== timerShown || box.hidden) { timerShown = key; box.hidden = false; box.className = cls; box.innerHTML = ''; box.append(el('span', {}, left < 0 ? '\u25B2 OVERTIME' : paused ? 'TIMER PAUSED' : left <= 20 ? '\u25C6 TIME LEFT' : 'TIME LEFT'), el('b', {}, text), el('i', {}, 'of ' + mmss(t.limit))); box.setAttribute('aria-label', `${left < 0 ? 'Overtime' : 'Time left'} ${text} for ${TASK_NAMES[name]}`); }
}

// ----- Quick Mission: the 20-second team call -----
function portrait(look) { const c = el('canvas', { width: 96, height: 96, 'aria-hidden': 'true' }); const g = c.getContext('2d'); const hex = (n) => '#' + n.toString(16).padStart(6, '0'); g.fillStyle = '#141a20'; g.fillRect(0, 0, 96, 96); g.fillStyle = hex(look.jacket); g.beginPath(); g.ellipse(48, 104, 40, 34, 0, 0, 7); g.fill(); g.fillStyle = hex(look.hair); if (look.hairStyle === 'afro') { g.beginPath(); g.arc(48, 38, 30, 0, 7); g.fill(); } if (look.hairStyle === 'bun') { g.beginPath(); g.arc(48, 12, 10, 0, 7); g.fill(); } if (look.hairStyle === 'braids' || look.hairStyle === 'long') g.fillRect(24, 30, 48, 46);
  g.fillStyle = hex(look.skin); g.beginPath(); g.ellipse(48, 46, 19, 23, 0, 0, 7); g.fill(); g.fillRect(41, 62, 14, 14); g.fillStyle = hex(look.hair); g.beginPath(); g.ellipse(48, 31, 20, look.hairStyle === 'fade' ? 9 : 12, 0, Math.PI, 0); g.fill(); g.fillStyle = '#1a1210'; g.beginPath(); g.arc(41, 46, 2, 0, 7); g.arc(55, 46, 2, 0, 7); g.fill(); g.strokeStyle = '#5a2a22'; g.lineWidth = 2; g.beginPath(); g.arc(48, 54, 6, 0.2, Math.PI - 0.2); g.stroke(); return c; }
function teamCall() {
  const order = ['scientist', 'engineer', 'ops', 'specialist']; let i = -1, done = false, timer = null; document.body.classList.add('no-timer');
  const cards = order.map((r) => el('div', { class: 'call-card' }, portrait(CREW[r].look), el('b', {}, CREW[r].name), el('span', {}, CREW[r].role))); const text = el('p', { class: 'dlg-text', 'aria-live': 'polite' });
  const finish = () => { if (done) return; done = true; clearTimeout(timer); stopSpeak(); document.body.classList.remove('no-timer'); for (const r of Object.keys(CREW)) { state.met[r] = true; state.heard[{ specialist: 'sp', scientist: 'sc', engineer: 'en', ops: 'op' }[r] + '.intro'] = true; } award('teamcall', 150, 'Team call complete'); setStage('payload'); closeOverlay(); refreshCentre(); syncMode(); toast('Level 1 complete: you have met your team and accepted the mission. Level 2: walk down the corridor to the Science Laboratory and use the payload bench to choose the telescope that will watch the star.', 'good', 12000); };
  const next = () => { i++; if (i >= order.length) return finish(); cards.forEach((c, k) => c.classList.toggle('on', k === i)); const r = order[i]; text.textContent = QUICK[r]; speak(QUICK[r], r); timer = setTimeout(next, Math.max(4200, QUICK[r].length * 62)); };
  openOverlay(el('div', { class: 'station solo' }, el('section', { class: 'panel wide' }, el('div', { class: 'label' }, 'Level 1 \u00B7 Meet your mission team (Quick Mission)'), el('h2', {}, settings.playerName ? `${settings.playerName}, meet your team` : 'Meet your team'), el('div', { class: 'call-row' }, cards), text, el('div', { class: 'row-btns' }, button('Next', () => { clearTimeout(timer); next(); }, 'ghost'), button('Skip to the mission', finish, 'primary')))), 'station-overlay dim'); syncMode(); next();
}

// ----- avatar creator -----
function openCreator(start) {
  initAudio(); sfx.confirm(); const title = $('#title'); title.hidden = true;
  const cfg = Object.assign({ outfit: 'crew' }, DEFAULT_AVATAR, settings.avatar || {}); let name = settings.playerName || ''; let actor = null;
  const st = getStudio(); setScene(st); st.auto = false; st.yaw = 0.35; st.setCallouts([], null);
  const rebuild = () => { actor = makeCharacter(cfg); st.setModel(actor.group, 1.85, 0); st.dist = 4.4; st.pitch = 0.1; };
  const stopTick = onTick((dt) => { if (actor) actor.update(dt, null, { noLook: true }); });
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const swatches = (label, list, key) => el('div', { class: 'cr-row' }, el('div', { class: 'label' }, label), el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label }, list.map((c, i) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(cfg[key] === c), 'aria-label': `${label} ${i + 1}`, class: 'swatch' + (cfg[key] === c ? ' on' : ''), style: { background: hex(c) }, onclick: () => { cfg[key] = c; sfx.select(); rebuild(); render(); } }))));
  const segs = (label, list, key) => el('div', { class: 'cr-row' }, el('div', { class: 'label' }, label), el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, list.map(([v, n]) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(cfg[key] === v), class: cfg[key] === v ? 'on' : '', onclick: () => { cfg[key] = v; sfx.select(); rebuild(); render(); } }, n))));
  const root = el('div', { class: 'station creator' }); const nameIn = el('input', { type: 'text', maxlength: '16', placeholder: 'Your name', value: name, 'aria-label': 'Your name', oninput: (e) => { name = e.target.value.trim(); } });
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function render() { root.innerHTML = '';
    root.append(el('section', { class: 'panel left' }, el('div', { class: 'label' }, 'Step 1 of 2 \u00B7 Create your mission lead'), el('h2', {}, 'Who is leading this mission?'), el('p', { class: 'lead' }, 'This is you. The crew will know you by this name, and you will see yourself in the space centre.'),
      el('div', { class: 'scroll' }, el('div', { class: 'cr-row' }, el('div', { class: 'label' }, 'Choose your role'), el('div', { class: 'opts role-opts' }, [['astronaut', 'Astronaut (the pilot)', 'Ride the rocket. Sit in the cockpit, flip the switches, press the launch button and steer to orbit from the pilot\u2019s seat.'], ['crew', 'Mission crew', 'Run the launch from Mission Control. Work the launch console and watch the rocket from the ground cameras.']].map(([v, n, d]) => el('button', { type: 'button', class: 'opt' + (cfg.outfit === v ? ' chosen' : ''), 'aria-pressed': String(cfg.outfit === v), onclick: () => { cfg.outfit = v; if (v === 'astronaut' && SUITS.includes(cfg.jacket)) cfg.jacket = 0xd8731f; if (v === 'crew' && !SUITS.includes(cfg.jacket)) cfg.jacket = SUITS[0]; sfx.select(); rebuild(); render(); } }, el('b', {}, (cfg.outfit === v ? '\u2713 ' : '') + n), el('div', { class: 'note' }, d))))), el('div', { class: 'cr-row' }, el('div', { class: 'label' }, 'Name'), nameIn), swatches('Skin tone', SKINS, 'skin'), segs('Hair style', HAIR_STYLES, 'hairStyle'), swatches('Hair colour', HAIR_COLOURS, 'hair'), swatches(cfg.outfit === 'astronaut' ? 'Flight suit colour' : 'Uniform colour', cfg.outfit === 'astronaut' ? [0xd8731f, 0x2f5d8a, 0xe9ebec, ...SUITS.slice(0, 3)] : SUITS, 'jacket'), segs('Build', BUILDS, 'build')),
      el('div', { class: 'row-btns' }, button('Surprise me', () => { cfg.skin = pick(SKINS); cfg.hair = pick(HAIR_COLOURS); cfg.hairStyle = pick(HAIR_STYLES)[0]; cfg.jacket = pick(SUITS); cfg.build = pick(BUILDS)[0]; rebuild(); render(); }, 'ghost'))),
      el('section', { class: 'panel right' }, el('div', { class: 'label' }, 'Step 2 of 2 \u00B7 How do you want to play?'), el('h3', {}, 'How long do you want to play?'),
        el('div', { class: 'opts col' }, [['quick', '\u26A1 Quick Mission \u00B7 about 10 minutes', 'Straight to the action: meet the team, pick the telescope, fly the rocket, solve the mystery.'], ['full', '\uD83D\uDE80 Full Mission \u00B7 about 40 minutes', 'The whole story: explore the space centre, talk to everyone, build every part of the spacecraft.']].map(([v, n, d]) => el('button', { type: 'button', class: 'opt' + ((settings.mode || 'quick') === v ? ' chosen' : ''), 'aria-pressed': String((settings.mode || 'quick') === v), onclick: () => { settings.mode = v; sfx.select(); render(); } }, el('b', {}, ((settings.mode || 'quick') === v ? '\u2713 ' : '') + n), el('div', { class: 'note' }, d)))),
        el('h3', {}, 'How much help do you want?'),
        el('div', { class: 'opts col help-opts' }, [['guided', '\uD83E\uDDED Guided', 'A marker shows where to go. Best first time.'], ['standard', '\uD83C\uDFAF Standard', 'Goals only. You find the way.'], ['independent', '\uD83E\uDD85 Independent', 'No help. For experts.']].map(([v, n, d]) => el('button', { type: 'button', class: 'opt' + (settings.assist === v ? ' chosen' : ''), 'aria-pressed': String(settings.assist === v), onclick: () => { settings.assist = v; sfx.select(); render(); } }, el('b', {}, (settings.assist === v ? '\u2713 ' : '') + n), el('div', { class: 'note' }, d)))),
        el('p', { class: 'note' }, 'Every task is timed. Finish on time for bonus points; run over and you lose 10 points every 10 seconds. Find the six mission patches hidden around the centre for extra points. Use the View button (or V) to switch between seeing your character and first-person view. Help explains everything again at any time.'),
        el('div', { class: 'row-btns' }, button('Back', () => { stopTick(); closeOverlay(); title.hidden = false; }, 'ghost'), button('Begin mission', () => { settings.avatar = Object.assign({}, cfg); settings.playerName = name; save(); stopTick(); closeOverlay(); title.hidden = false; start(true); }, 'primary pulse'))),
      el('div', { class: 'studio-hint' }, 'Drag to rotate your avatar')); }
  rebuild(); render(); openOverlay(root, 'station-overlay');
}

// ----- minimap -----
let mapT = 0;
function drawMap(dt) {
  mapT -= dt; if (mapT > 0 || !centre || !inCentre()) return; mapT = 0.1; const c = $('#minimap'); const g = c.getContext('2d'); const W = c.width, Hh = c.height; const sx = (x) => (x + 31) / 52 * W, sz = (z) => (z + 17) / 32 * Hh;
  g.clearRect(0, 0, W, Hh); g.fillStyle = 'rgba(13,16,20,0.82)'; g.fillRect(0, 0, W, Hh); const here = centre.rooms.find((r) => centre.player.x >= r.x[0] && centre.player.x <= r.x[1] && centre.player.z >= r.z[0] && centre.player.z <= r.z[1]);
  for (const r of centre.rooms) { g.fillStyle = r === here ? 'rgba(242,162,58,0.22)' : 'rgba(255,255,255,0.07)'; g.strokeStyle = r === here ? '#f2a23a' : '#5a6570'; g.lineWidth = 1; const x = sx(r.x[0]), y = sz(r.z[0]), w = sx(r.x[1]) - x, h = sz(r.z[1]) - y; g.fillRect(x, y, w, h); g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  g.font = '600 8px system-ui'; g.fillStyle = '#aab3bc'; g.textAlign = 'center'; for (const [n, x, z] of [['RECEPTION', -24, 0], ['BRIEFING', -12, 7], ['LAB', 0, 7], ['ENGINEERING', 13, 8], ['PREP', -12, -7], ['MISSION CONTROL', 7, -9]]) g.fillText(n, sx(x), sz(z) + 3);
  for (const n of centre.npcs) { g.fillStyle = '#8d97a3'; g.beginPath(); g.arc(sx(n.x), sz(n.z), 2.2, 0, 7); g.fill(); }
  for (const k of Object.keys(CREW)) { g.fillStyle = '#6fa8c4'; g.beginPath(); g.arc(sx(CREW[k].pos[0]), sz(CREW[k].pos[1]), 3, 0, 7); g.fill(); }
  const m = settings.assist === 'guided' ? centre.marker : null; if (m) { const x = sx(m.x), y = sz(m.z), p = 4.5 + Math.sin(engine.time * 4) * 1.2; g.fillStyle = '#f2a23a'; g.beginPath(); g.moveTo(x, y - p); g.lineTo(x + p, y); g.lineTo(x, y + p); g.lineTo(x - p, y); g.fill(); }
  const P = centre.player; g.save(); g.translate(sx(P.x), sz(P.z)); g.rotate(-P.face); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.fill(); g.restore();
}

// ----- boot -----
function boot() {
  const hadSave = load(); document.body.classList.toggle('reduced', settings.reducedMotion);
  const canvas = $('#view'); const ok = initEngine(canvas);
  const title = $('#title'); const status = $('#boot-status');
  const tw = $('#title-word'); const word = tw.textContent; tw.textContent = ''; [...word].forEach((ch, i) => tw.append(el('span', { style: { animationDelay: (0.75 + i * 0.09) + 's' }, 'aria-hidden': 'true' }, ch)));
  if (!ok) { status.textContent = 'This browser could not start WebGL, which the 3D scenes need. Try a current version of Chrome, Edge, Firefox or Safari, or enable hardware acceleration.'; status.classList.add('error'); return; }
  initInput(canvas); setModeListener(syncMode); input.onInteract = () => { if (blocking()) return; if (inCentre()) centre.use(); else walkUse(); };
  input.onKey = (e) => { if (e.code === 'KeyP' && !blocking() && inCentre()) openSettings({ onAssist: updateObjective }); if (e.code === 'KeyV' && !blocking() && inCentre()) toggleView(); if (e.code === 'KeyH' && !blocking() && inCentre()) openGuide(); };
  const toggleView = () => { settings.view = settings.view === 'third' ? 'first' : 'third'; if (settings.view === 'third' && centre && centre.player.zoom < 0.9) centre.player.zoom = 3.3; save(); $('#btn-view').textContent = settings.view === 'third' ? 'View: 3rd person' : 'View: 1st person'; toast(settings.view === 'third' ? 'Third-person view: you can see your character.' : 'First-person view: you see through your character\u2019s eyes.', 'info', 3000); };
  $('#btn-view').textContent = settings.view === 'first' ? 'View: 1st person' : 'View: 3rd person'; $('#btn-view').addEventListener('click', () => { if (!blocking()) toggleView(); }); $('#btn-help').addEventListener('click', () => { if (!$('#modal').hidden) return; openGuide(); });
  onTick(drawMap);
  setPointsListener(showPoints); probeRecordings(); initPip(); setBuddyHooks({ speak: (t) => { if (!quiet) sayAloud(t); }, open: () => openPipChat() }); const setRun = (on) => { input.runOn = on; for (const id of ['btn-run', 'touch-run']) { const b = $('#' + id); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); } $('#btn-run').textContent = on ? '\uD83C\uDFC3 Run: ON' : '\uD83C\uDFC3 Run: off'; $('#touch-run').textContent = on ? 'RUN \u2713' : 'Run'; }; $('#btn-run').addEventListener('click', () => setRun(!input.runOn)); $('#touch-run').addEventListener('click', () => setRun(!input.runOn)); window.addEventListener('keydown', (e) => { if (e.code === 'KeyR' && input.fp && !e.repeat) setRun(!input.runOn); }); setPipContext(() => `Mission: ${isMoon() ? TH().title : 'The Blinking Star'}. Current step: ${buddyNow() || 'exploring'}`, () => buddyNow()); $('#btn-pip').addEventListener('click', () => { initAudio(); openPipChat(); });
  $('#btn-settings').addEventListener('click', () => { initAudio(); openSettings({ onAssist: updateObjective }); });
  onTick(tickTimer);
  onChange(() => { if (centre && inCentre()) { centre.refresh(); updateObjective(); } });
  const start = async (fresh) => {
    initAudio(); sfx.confirm(); if (fresh) hardReset(); document.body.classList.toggle('moon', isMoon());
    status.textContent = 'Building the space centre…'; await new Promise((r) => setTimeout(r, 30));
    await fade(true, 400);
    try { centre = createCentre(game); } catch (err) { console.error(err); await fade(false, 200); status.textContent = 'The space centre failed to load: ' + err.message; status.classList.add('error'); return; }
    title.hidden = true; setScene(centre); centre.setAvatar(settings.avatar); setPointsTotal(state.points);
    const s = stageName(); if (s === 'analysis' || s === 'report') centre.place(3.1, 8.2, -Math.PI / 2); else if (s === 'orbit') centre.place(3.2, -10.6, 0); else if (atLeast('payload')) centre.place(-10, 0, -Math.PI / 2);
    if (isMoon() && !fresh && ['gantry', 'board', 'launch', 'cabin', 'run', 'land', 'surface', 'home'].includes(moonState().step)) { refreshCentre(); await fade(false, 300); return moonResume(); }
    if (stageName() === 'arrive' && !state.heard['intro']) { centre.place(-44.5, 0, -Math.PI / 2); quiet = true; }
    refreshCentre();
    if (stageName() === 'arrive' && !state.heard['intro']) { state.heard['intro'] = true; syncMode(); await fade(false, 300); await expStory((t) => sayAloud(t), isMoon() ? null : STAR_STORY); await fade(true, 300); const card = el('div', { class: 'arrive-card' }, el('div', { class: 'label' }, 'Day one \u00B7 06:40'), el('h2', {}, 'Launch Complex 2'), el('p', { class: 'lead' }, 'Your rocket is waiting on the pad.'), el('p', { class: 'note' }, 'Press any key or tap to skip')); document.body.append(card); const skip = () => centre.skipIntro(); window.addEventListener('keydown', skip, { once: true }); card.addEventListener('pointerdown', skip); engine.canvas.addEventListener('pointerdown', skip, { once: true });
      const caps = [['Day one \u00B7 06:40', 'Launch Complex 2', 'Your rocket is waiting on the pad.'], ['Day one \u00B7 06:52', 'Starbound Deep Space Science Centre', 'Where the mission is designed, built and flown.'], ['Day one \u00B7 07:00', settings.playerName ? `Welcome, ${ROLE()} ${settings.playerName}` : `Welcome, ${ROLE()}`, 'Godiva is expecting you at the reception desk.'], ['Day one \u00B7 07:00', 'Walk in. Your mission starts now', '']];
      centre.intro(() => { card.remove(); window.removeEventListener('keydown', skip); document.body.classList.remove('cine'); quiet = false; syncMode(); buddySay(''); updateObjective(); toast(input.touch ? 'Left pad to move, drag to look, button to interact.' : 'Click the view to look around. W A S D to move, E to interact.', 'info', 9000); }, (k) => { const c = caps[k]; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in'); card.children[0].textContent = c[0]; card.children[1].textContent = c[1]; card.children[2].textContent = c[2]; }); syncMode(); await fade(false, 1200); return; }
    syncMode(); await fade(false, 900);
    if (stageName() === 'arrive') toast(input.touch ? 'Left pad to move, drag to look, button to interact.' : 'Click the view to look around. W A S D to move, E to interact.', 'info', 9000);
  };
  const play = async () => { initAudio(); title.hidden = true; if (!settings.assist) settings.assist = 'guided'; settings.mission = 'star'; save(); let lob; await transition(async () => { lob = startLobby({ say: (t, who) => sayAloud(t, who || 'reception') }); window.__lobby = lob; }, 'Starbound Spacecraft Engineering Centre'); const pick = await lob.done; const mission = pick.mission; save(); await transition(async () => { window.__eng = startEngineering({ say: (t, who) => sayAloud(t, who), mission, name: pick.name, guide: pick.guide, solo: pick.solo, fly: engFly }); }, 'Briefing theatre · ' + mission.name); };
  const assistPick = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Assist level' }); const drawAssist = () => { assistPick.innerHTML = ''; for (const [v, n, d] of [['guided', 'Guided', 'Markers, hints and crew help'], ['standard', 'Standard', 'Objectives only'], ['independent', 'Independent', 'No markers or hints']]) assistPick.append(el('button', { type: 'button', role: 'radio', 'aria-checked': String(settings.assist === v), class: settings.assist === v ? 'on' : '', title: d, onclick: () => { settings.assist = v; save(); drawAssist(); } }, n)); };
  drawAssist(); $('#title-assist').append(assistPick);
  const btns = $('#title-btns');
  btns.append(button('\u25B6  PLAY', () => play(), 'primary pulse play'));
  btns.append(button('How to play', () => modal('How to play', el('div', { class: 'howto' }, el('p', {}, 'STARBOUND is a space mission design game. You and up to three team mates design a complete science mission and build its spacecraft.'), el('ol', {}, ['Choose the mission objective.', 'Order the concept of operations.', 'Set requirements and how to verify them.', 'Design: pick the instrument, orbit, rocket, lifetime and every subsystem. Watch mass, power, data, communications, lifetime and budget.', 'Build it part by part in the 3D cleanroom, then test it.', 'Launch and get your mission review.'].map((x) => el('li', {}, x))), el('p', {}, 'Drag to turn the model, pinch or scroll to zoom, tap a part to learn what it does. Every choice affects the others: the goal is the highest science return that still meets every requirement and the budget.')), [{ label: 'Close', value: true, cls: 'primary' }], 'wide-guide'), 'ghost'), button('Settings', () => openSettings(), 'ghost'));
  if (settings.best) $('#boot-status').before(el('p', { class: 'best' }, `\u2605 Your best mission: ${settings.best.points.toLocaleString()} points \u00B7 grade ${settings.best.grade}. Can you beat it?`));
  status.textContent = 'Ready.';
  setTimeout(() => { try { if (!centre) { setScene(titleBackdrop()); title.classList.add('live'); } } catch (e) { /* the backdrop is decorative */ } }, 60);
  window.__starbound = { state, game, engine, settings, moonState, cockpit: () => { settings.avatar = Object.assign({}, settings.avatar || {}, { outfit: 'astronaut' }); const fit = (plans('wide').find((q) => q.fit) || {}).fit; Object.assign(state, { payload: 'wide', bus: fit.bus, vehicle: fit.vehicle, validated: true }); setStage('launch'); openChecklist(game); }, moon: { welcome: () => { transition(async () => { setScene(homecoming(teamLooks(), () => { window.__homeDone = true; })); }, 'Home').then(() => syncMode()); }, land: () => { moonLand(); }, walk: () => { moonWalk(); }, home: () => { moonHome(); }, pad: () => { moonBoard(); }, cabin: () => { moonCabin(); }, run: () => { moonRun(); } }, sim: { createOps, computeAscent, setStage, commit }, get centre() { return centre; } }; // exposed for automated tests
}
window.addEventListener('error', (e) => { const s = document.getElementById('boot-status'); if (s && !document.getElementById('title').hidden) { s.textContent = 'Error: ' + e.message; s.classList.add('error'); } });
boot();
