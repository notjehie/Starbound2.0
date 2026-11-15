// Level 3 (launch half): interactive pre-launch checklist, countdown and an
// ascent driven by the player's own vehicle, spacecraft mass and launch margin.
import * as THREE from 'three';
import { state, commit, setStage, settings, isQuick } from './state.js';
import { QUICK } from './lines.js';
import { onTick } from './engine.js';
import { VEHICLES, PAYLOADS } from './catalog.js';
import { totals } from './engineering.js';
import { computeAscent } from './ascent.js';
import { makeRocket, makeSpacecraft, makeEarth, makeStars, M, box, cyl, canvasTex, std } from './builders.js';
import { el, button, openOverlay, closeOverlay, modal, toast, fmt } from './ui.js';
import { setScene, transition, engine } from './engine.js';
import { sfx, setAmbience, engineSound } from './audio.js';
import { speak } from './voice.js';
import { JEHIELLE } from './lines.js';
import { award } from './points.js';
import { input } from './input.js';
import { makeCockpit, PILOT_STEPS } from './cockpit.js';
export const isPilot = () => (settings.avatar || {}).outfit === 'astronaut';

const STEPS = [
  { id: 'range', label: 'Range clear', ctl: 'RANGE SAFETY', why: 'Nothing else may start until the launch corridor is confirmed empty of ships and aircraft.' },
  { id: 'prop', label: 'Propellant loading complete, vents closed', ctl: 'PROPELLANT', why: 'Tanks must be full and sealed before the vehicle is switched to its own systems.' },
  { id: 'power', label: 'Transfer to internal power', ctl: 'INTERNAL POWER', why: 'The rocket must run on its own batteries before ground connections are removed.' },
  { id: 'guidance', label: 'Load guidance for parking orbit', ctl: 'GUIDANCE', why: 'The flight computer needs its trajectory, and it needs stable internal power to hold it.' },
  { id: 'payload', label: 'Payload safe: arrays stowed, instrument cover closed', ctl: 'PAYLOAD SAFE', why: 'The spacecraft must be configured for the vibration and heating of ascent.' },
  { id: 'telemetry', label: 'Telemetry lock with the spacecraft', ctl: 'TELEMETRY', why: 'Mission control must be receiving data before committing to launch.' },
  { id: 'arm', label: 'Retract the access arm', ctl: 'ACCESS ARM', why: 'The arm is the last physical link to the tower. It moves only when everything on board is ready.' },
  { id: 'poll', label: 'Go / no-go poll', ctl: 'POLL STATIONS', why: 'Every station confirms readiness only after its own checks are complete.' },
  { id: 'ignition', label: 'Arm the ignition sequence', ctl: 'ARM IGNITION', why: 'Arming is the final act, after all stations have reported go.' },
];

// Quick Mission: flight operations works the checklist aloud; the player gives the final go.
function calledChecklist(game) {
  const t = totals(state); const v = t.vehicle; let n = 0, acc = 0; speak(QUICK.checklist, 'ops'); const list = el('ol', { class: 'checklist' }); const foot = el('div', { class: 'row-btns' });
  const draw = () => { list.innerHTML = ''; STEPS.forEach((s, i) => list.append(el('li', { class: i < n ? 'done' : i === n ? 'next' : '' }, el('span', { class: 'tick' }, i < n ? '\u2713' : String(i + 1)), s.label))); };
  const iv = setInterval(() => { n++; sfx.switch(); draw(); if (n >= STEPS.length) { stop(); foot.innerHTML = ''; foot.append(button('Step away', () => game.closeStation(), 'ghost'), button('Give the go: start the countdown', () => { award('checklist:' + state.runs, 100, 'Go for launch'); closeOverlay(); startLaunch(game); }, 'primary pulse')); } }, 550); const stop = () => clearInterval(iv);
  foot.append(button('Step away', () => { stop(); game.closeStation(); }, 'ghost'), el('span', { class: 'note' }, 'Jehielle is calling the steps\u2026')); draw();
  openOverlay(el('div', { class: 'station solo' }, el('section', { class: 'panel wide' }, el('div', { class: 'label' }, 'Quick Mission \u00B7 Launch'), el('h2', {}, 'Launch console'), el('p', { class: 'lead' }, `Jehielle: "${QUICK.checklist}" ${v.name} is on the pad with your ${t.mass} kg spacecraft. You will steer the first stage and command staging yourself.`), list, foot)), 'station-overlay dim');
}

export function openChecklist(game) {
  if (isPilot()) return startLaunch(game, true);
  if (isQuick()) return calledChecklist(game);
  const done = new Set(); const t = totals(state); const v = t.vehicle; const root = el('div', { class: 'station solo' }); let msg = null;
  const assist = settings.assist;
  function render() {
    root.innerHTML = ''; const nextIdx = STEPS.findIndex((s) => !done.has(s.id)); const all = nextIdx === -1;
    const list = el('ol', { class: 'checklist' }, STEPS.map((s, i) => el('li', { class: done.has(s.id) ? 'done' : (assist === 'guided' && i === nextIdx ? 'next' : '') }, el('span', { class: 'tick' }, done.has(s.id) ? '✓' : String(i + 1)), s.label)));
    // The console layout is fixed and deliberately not in checklist order.
    const order = ['telemetry', 'range', 'guidance', 'ignition', 'power', 'payload', 'poll', 'prop', 'arm'];
    const panel = el('div', { class: 'switches' }, order.map((id) => { const s = STEPS.find((x) => x.id === id); const i = STEPS.indexOf(s); const on = done.has(id);
      return el('button', { type: 'button', class: 'switch' + (on ? ' on' : '') + (assist === 'guided' && i === nextIdx ? ' hint' : ''), 'aria-pressed': String(on), disabled: on, onclick: async () => {
        if (i !== nextIdx) { state.checklistErrors++; commit(); sfx.deny(); const need = STEPS[nextIdx]; msg = { kind: 'bad', text: `Hold. "${s.ctl}" is out of sequence. Next is step ${nextIdx + 1}: ${need.label}. ${assist === 'independent' ? '' : need.why}` }; render(); return; }
        sfx.switch();
        if (id === 'poll') { await modal('Go / no-go poll', el('ul', { class: 'poll' }, [['Range', 'Corridor clear.'], ['Vehicle', `${v.name}: propellant loaded, on internal power.`], ['Engineering', `Spacecraft ${t.mass} kg against ${v.capacity} kg capacity. Margin ${Math.round(t.launchMargin * 100)} %.`], ['Payload', `${t.payload.name}: safe and stowed.`], ['Flight operations', 'Telemetry locked. Ground stations ready.'], ['Science', 'Target and observing plan loaded.']].map(([a, b]) => el('li', {}, el('b', {}, a), el('span', {}, b), el('em', {}, 'GO')))), [{ label: 'All stations are go', value: true, cls: 'primary' }], 'wide'); }
        done.add(id); msg = { kind: 'good', text: `${s.label}: confirmed.` }; render();
      } }, el('i', { class: 'lamp' }), el('span', {}, s.ctl)); }));
    root.append(el('section', { class: 'panel wide' }, el('div', { class: 'label' }, 'Level 3 · Launch'), el('h2', {}, 'Launch console'),
      el('p', { class: 'lead' }, `Jehielle: "${v.name} is on the pad with your ${t.mass} kg spacecraft. Work the checklist in order. Each control confirms one step."`),
      el('div', { class: 'cl-grid' }, el('div', {}, el('div', { class: 'label' }, 'Pre-launch checklist'), list), el('div', {}, el('div', { class: 'label' }, 'Console controls'), panel, msg ? el('div', { class: 'assess ' + (msg.kind === 'bad' ? 'unsuitable' : 'suitable'), role: 'status' }, msg.text) : el('div', { class: 'assess' }, assist === 'guided' ? 'The next control is outlined.' : 'Find each control on the console and confirm the steps in order.'))),
      el('div', { class: 'row-btns' }, button('Step away', () => game.closeStation(), 'ghost'), all ? button('Start the countdown', () => { award('checklist:' + state.runs, state.checklistErrors ? 75 : 150, state.checklistErrors ? 'Checklist complete' : 'Flawless checklist'); closeOverlay(); startLaunch(game); }, 'primary') : el('span', { class: 'note' }, `${done.size} of ${STEPS.length} steps confirmed`))));
  }
  render(); openOverlay(root, 'station-overlay dim');
}

async function startLaunch(game, pilot = false) {
  const asc = computeAscent(state); state.launch = asc; commit(); document.body.classList.add('no-timer'); // the flight itself is not timed
  let sc; await transition(async () => { sc = buildLaunchScene(game, asc, pilot); setScene(sc); setAmbience('pad'); }, pilot ? 'Strapped in \u00B7 top of the rocket \u00B7 Launch Complex 2' : 'Launch Complex 2');
  sc.begin();
}

function buildLaunchScene(game, asc, pilot) {
  const v = VEHICLES[state.vehicle]; const fg = new THREE.Scene(), bg = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 6000), bcam = new THREE.PerspectiveCamera(50, 1, 0.004, 60000);
  const day = new THREE.Color(0x7fb2e6), night = new THREE.Color(0x000004); bg.background = day.clone();
  const sunDir = new THREE.Vector3(0.6, 0.55, 0.45).normalize();
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.0); sun.position.copy(sunDir).multiplyScalar(100); fg.add(sun); const hemi = new THREE.HemisphereLight(0xbfd6f0, 0x4a463f, 1.0); fg.add(hemi);
  const bsun = new THREE.DirectionalLight(0xffffff, 3.2); bsun.position.copy(sunDir); bg.add(bsun); bg.add(new THREE.AmbientLight(0x223344, 0.5));
  const earth = makeEarth(6371, engine.lowQuality ? 0 : 1); earth.userData.atmo.material.uniforms.sun.value.copy(sunDir); bg.add(earth); earth.rotation.set(0.5, 2.2, 0);
  const stars = makeStars(2200, 30000); stars.material.opacity = 0; bg.add(stars);
  // ground, pad and tower (metres); they fall away beneath the rocket
  const ground = new THREE.Group(); fg.add(ground);
  const gdisc = new THREE.Mesh(new THREE.CircleGeometry(5000, 48), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#56604a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,40,25' : '140,130,100'},${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 3 + Math.random() * 10); } }, [40, 40]) })); gdisc.rotation.x = -Math.PI / 2; ground.add(gdisc);
  ground.add(cyl(26, 28, 3, std(0x8a8d90, 0.9), 0, 1.5, 0, 40)); const padTop = 3;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 900), std(0x3a3d40, 0.95)); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.05, -470); ground.add(road);
  const tower = new THREE.Group(); const TH = v.height * 1.12; tower.position.set(-v.height * 0.2 - 4, padTop, 0); ground.add(tower);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) tower.add(box(0.35, TH, 0.35, M.darkMetal, x, TH / 2, z));
  for (let y = 4; y < TH; y += 5) { tower.add(box(4.3, 0.2, 0.2, M.darkMetal, 0, y, -2), box(4.3, 0.2, 0.2, M.darkMetal, 0, y, 2), box(0.2, 0.2, 4.3, M.darkMetal, -2, y, 0), box(0.2, 0.2, 4.3, M.darkMetal, 2, y, 0)); }
  const arm = box(v.height * 0.2 + 2, 0.6, 1.2, M.amber, v.height * 0.1 + 1, TH * 0.78, 0); tower.add(arm); arm.visible = false; // retracted during the checklist
  for (const [x, z] of [[58, -8], [-58, 6], [-6, -60], [-30, 52]]) { ground.add(box(0.28, v.height * 1.35, 0.28, M.metal, x, v.height * 0.675, z)); }
  // rocket with the player's spacecraft inside the fairing
  const rocket = makeRocket(state.vehicle, PAYLOADS[state.payload].fairing); const U = rocket.userData; const rig = new THREE.Group(); rig.add(rocket); fg.add(rig); rocket.position.y = padTop;
  const craft = makeSpacecraft(state, { fold: true }); const fit = Math.min(1, (U.payloadSpace * 1.5) / Math.max(1.4, craft.userData.bw * 1.5)); craft.scale.setScalar(fit); craft.position.y = U.payloadY; rocket.add(craft); craft.visible = false;
  // exhaust plume
  const plumeTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.15, 'rgba(255,205,120,0.95)'); gr.addColorStop(0.5, 'rgba(255,130,50,0.5)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const mkPlume = (r, len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 1.5, len, 20, 1, true), new THREE.MeshBasicMaterial({ map: plumeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.geometry.translate(0, -len / 2, 0); m.visible = false; return m; };
  const plume1 = mkPlume(U.R * (v.boosters ? 2.2 : 1), U.H * 0.9); plume1.position.y = 0.2; U.s1.add(plume1);
  const plume2 = mkPlume(U.R * 0.45, U.H * 0.35); plume2.position.y = U.H * 0.52 + 1 - U.H * 0.03; U.s2.add(plume2);
  const glow = new THREE.PointLight(0xffa860, 0, 600, 1.2); glow.position.y = -6; rig.add(glow);
  // launch smoke
  const NS = 90; const sp = new Float32Array(NS * 3), sv = []; for (let i = 0; i < NS; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 4; sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = padTop; sp[i * 3 + 2] = Math.sin(a) * r; sv.push([Math.cos(a) * (8 + Math.random() * 22), 1 + Math.random() * 5, Math.sin(a) * (8 + Math.random() * 22)]); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ size: 26, map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(235,230,225,0.75)'); gr.addColorStop(1, 'rgba(235,230,225,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, opacity: 0 })); ground.add(smoke);

  // ----- HUD -----
  const hud = el('div', { class: 'launch-hud' }); const big = el('div', { class: 'count', 'aria-live': 'assertive' }); const tele = el('div', { class: 'tele' }); const evl = el('ul', { class: 'events' }); const call = el('div', { class: 'callout-line', role: 'status' });
  const camBtns = el('div', { class: 'seg' }); const ctrl = el('div', { class: 'launch-ctrl' });
  hud.append(el('div', { class: 'panel tele-panel' }, el('div', { class: 'label' }, `${v.name} · ${asc.mass} kg spacecraft · margin ${asc.reserve} %`), big, tele, el('div', { class: 'label' }, 'Flight events'), evl), call, ctrl);
  const tv = (k) => { const b = el('b'); tele.append(el('div', { class: 'kv' }, el('span', {}, k), b)); return b; };
  const tAlt = tv('Altitude'), tVel = tv('Velocity'), tDown = tv('Downrange'), tStage = tv('Stage'), tAcc = tv('Acceleration');
  const evEls = asc.events.map((e) => { const li = el('li', {}, el('span', {}, 'T+' + fmt(e.t) + ' s'), e.label); evl.append(li); return li; });
  let camMode = pilot ? 'cockpit' : 'auto'; const cams = [['cockpit', pilot ? 'Cockpit' : 'Inside the rocket'], ['auto', pilot ? 'Outside' : 'Auto'], ['pad', 'Ground'], ['track', 'Tracking'], ['onboard', 'Onboard']]; if (pilot) hud.classList.add('pilot');
  const drawCams = () => { camBtns.innerHTML = ''; for (const [id, name] of cams) camBtns.append(el('button', { type: 'button', class: camMode === id ? 'on' : '', 'aria-pressed': String(camMode === id), onclick: () => { camMode = id; sfx.click(); drawCams(); } }, name)); };
  let fast = false; const ffBtn = el('button', { type: 'button', class: 'btn ghost', 'aria-pressed': 'false', onclick: () => { fast = !fast; ffBtn.setAttribute('aria-pressed', String(fast)); ffBtn.textContent = fast ? 'Normal speed' : 'Fast-forward'; } }, 'Fast-forward');
  ctrl.append(el('div', { class: 'label' }, 'Camera'), camBtns, ffBtn); drawCams();

  // ----- flight state -----
  let T = pilot ? -10 : -12, phase = pilot ? 'pre' : 'count', idx = 0, lastWhole = null, sepT = null, fairT = null, endT = 0, deployed = 0, deploying = false, shownEv = 0, s1Free = null, done = false;
  const S = asc.samples; const insertion = asc.insertionTime;
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(); let camYaw = 0.9;
  const sampleAt = (t) => { while (idx < S.length - 1 && S[idx + 1].t <= t) idx++; const a = S[idx], b = S[Math.min(S.length - 1, idx + 1)]; const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0; return { alt: a.alt + (b.alt - a.alt) * u, vel: a.vel + (b.vel - a.vel) * u, down: a.down + (b.down - a.down) * u, pitch: a.pitch + (b.pitch - a.pitch) * u, stage: a.stage, acc: (b.vel - a.vel) / Math.max(1e-3, b.t - a.t) }; };
  const say = (text, line) => { if (line) speak(line, 'ops'); call.textContent = text; call.classList.remove('show'); void call.offsetWidth; call.classList.add('show'); };

  // steering corridor and stage command
  const G = { on: false, done: false, x: 0, t: 0, total: 0, inBand: 0, btn: 0, band: settings.assist === 'guided' ? 0.4 : settings.assist === 'standard' ? 0.32 : 0.25 };
  const gMark = el('i'); const gAcc = el('span', { class: 'note' }); const hold = (dir) => ({ onpointerdown: (e) => { e.preventDefault(); G.btn = dir; }, onpointerup: () => { G.btn = 0; }, onpointerleave: () => { G.btn = 0; } });
  const guide = el('div', { class: 'panel guide', hidden: true }, el('div', { class: 'label' }, 'Guidance: keep the marker in the corridor \u00B7 A / D or the arrow buttons'), el('div', { class: 'guide-row' }, el('button', Object.assign({ type: 'button', class: 'btn sq', 'aria-label': 'Steer left' }, hold(-1)), '\u25C0'), el('div', { class: 'guide-track' }, el('div', { class: 'guide-band', style: { left: (50 - G.band * 50) + '%', width: (G.band * 100) + '%' } }), gMark), el('button', Object.assign({ type: 'button', class: 'btn sq', 'aria-label': 'Steer right' }, hold(1)), '\u25B6')), gAcc);
  let waitStage = false, waitT = 0, stageDone = false;
  const stageBtn = el('button', { type: 'button', class: 'btn primary pulse stage-btn', hidden: true, onclick: () => commandStage(false) }, 'SEPARATE STAGE  (Space)');
  hud.append(guide, stageBtn);
  // ----- astronaut: the cockpit and its switches -----
  const ck = makeCockpit(); if (!pilot) for (const q of PILOT_STEPS) ck.set(q.id, true); const pdone = new Set(); let canDeploy = false, curMode = '', kmsg = 'COMPLETE THE ASCENT CHECKLIST', steerIn = 0;
  const pList = el('ol', { class: 'checklist' }); const pre = el('div', { class: 'panel pre-panel' }, el('div', { class: 'label' }, 'Astronaut · Ascent checklist'), el('p', { class: 'note' }, 'Tap the switches on the panel in this order. Drag to look around the cabin.'), pList); hud.append(pre);
  const pNext = () => { const n = PILOT_STEPS.find((q) => !pdone.has(q.id)); return phase === 'pre' ? (n ? n.id : 'launch') : waitStage ? 'stage' : canDeploy ? 'deploy' : null; };
  const drawP = () => { pList.innerHTML = ''; const nx = pNext(); [...PILOT_STEPS, { id: 'launch', label: 'Lift the guard and press LAUNCH' }].forEach((q, i) => pList.append(el('li', { class: pdone.has(q.id) ? 'done' : (settings.assist !== 'independent' && q.id === nx ? 'next' : '') }, el('span', { class: 'tick' }, pdone.has(q.id) ? '✓' : String(i + 1)), q.label))); };
  function pressed(id) { if (!id) return; const st = PILOT_STEPS.find((q) => q.id === id);
    if (st) { if (phase !== 'pre' || pdone.has(id)) return; const need = PILOT_STEPS.find((q) => !pdone.has(q.id)); if (need.id !== id) { state.checklistErrors++; commit(); sfx.deny(); kmsg = 'HOLD: ' + need.ctl + ' FIRST'; return say(`Hold. ${st.ctl} is out of sequence. Next is ${need.ctl}. ${settings.assist === 'independent' ? '' : need.why}`); }
      pdone.add(id); ck.set(id, true); sfx.switch(); const all = pdone.size === PILOT_STEPS.length; kmsg = all ? 'GO FOR LAUNCH: PRESS LAUNCH' : st.ctl + ' SET'; say(all ? 'All switches set. Mission Control is go. Lift the guard and press LAUNCH.' : `${st.label}: confirmed.`); return drawP(); }
    if (id === 'launch') { if (phase !== 'pre') return; if (pdone.size < PILOT_STEPS.length) { sfx.deny(); return say('The launch button is locked until the checklist is complete.'); } pdone.add('launch'); drawP(); sfx.confirm(); award('checklist:' + state.runs, state.checklistErrors ? 75 : 150, state.checklistErrors ? 'Checklist complete' : 'Flawless cockpit checklist'); award('pilot:' + state.runs, 100, 'You pressed the launch button'); phase = 'count'; T = -10; kmsg = 'COUNTDOWN'; setTimeout(() => { pre.hidden = true; }, 2500); return; }
    if (id === 'stage') { if (waitStage) commandStage(false); else sfx.deny(); return; }
    if (id === 'deploy') { if (canDeploy) doDeploy(); else sfx.deny(); } }
  let pd = null; const overUI = (e) => e.target && e.target.closest && e.target.closest('button, .panel, #settings, #modal, .launch-ctrl');
  const onDown = (e) => { if (!ck || curMode !== 'cockpit' || overUI(e)) return; pd = { x: e.clientX, y: e.clientY, moved: 0 }; };
  const onMove = (e) => { if (!pd) return; const dx = e.clientX - pd.x, dy = e.clientY - pd.y; pd.moved += Math.abs(dx) + Math.abs(dy); pd.x = e.clientX; pd.y = e.clientY; if (pd.moved > 8) { ck.look.yaw = Math.max(-0.9, Math.min(0.9, ck.look.yaw + dx * 0.004)); ck.look.pitch = Math.max(-0.95, Math.min(0.5, ck.look.pitch + dy * 0.004)); } };
  const onUp = (e) => { if (!pd) return; const tap = pd.moved <= 8; pd = null; if (tap) pressed(ck.press(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)); };
  function doDeploy() { if (!canDeploy) return; canDeploy = false; ctrl.innerHTML = ''; sfx.staging(); rig.attach(craft); deploying = true; if (pilot) { camMode = 'auto'; kmsg = (settings.mission && settings.mission !== 'star') ? 'ON COURSE. WELL FLOWN.' : 'TELESCOPE RELEASED'; } say(JEHIELLE.flight.sep, JEHIELLE.flight.sep); }
  pre.hidden = !pilot; if (pilot) { drawP(); window.__pilot = { screen(id) { const m = ck.scene.getObjectsByProperty ? null : null; let o = null; ck.scene.traverse((x) => { if (x.userData && x.userData.id === id) o = x; }); const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(ck.camera); return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight]; }, get phase() { return phase; }, get mode() { return curMode; }, get T() { return T; } }; }
  const onKey = (e) => { if (e.code === 'Space' && waitStage) { e.preventDefault(); commandStage(false); } }; window.addEventListener('keydown', onKey);
  function finishSteering() { if (G.done) return; G.done = true; guide.hidden = true; const acc = G.total > 0 ? G.inBand / G.total : 1; const loss = Math.round((1 - acc) * 8) / 100; asc.margin = Math.max(0, asc.margin - loss); asc.reserve = Math.round(asc.margin * 100); asc.steering = Math.round(acc * 100); asc.note = `Steering accuracy ${asc.steering} %${loss > 0 ? `, which cost ${Math.round(loss * 100)} points of launch margin` : ''}. ` + asc.note; state.launch = asc; state.guidance = { acc: asc.steering, loss: Math.round(loss * 100) }; commit(); award('steer:' + state.runs, Math.round(acc * 300), `Steering ${asc.steering} % accurate`); }
  function commandStage(auto) { if (!waitStage) return; waitStage = false; stageDone = true; stageBtn.hidden = true; award('stage:' + state.runs, auto ? 10 : Math.max(20, Math.round(100 - waitT * 35)), auto ? 'Flight computer staged for you' : `Staging in ${waitT.toFixed(1)} s`); }
  const sc = {
    scene: fg, camera: cam, cameras: ck ? [cam, bcam, ck.camera] : [cam, bcam],
    begin() { openOverlay(hud, 'hud-overlay'); window.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); if (pilot) { say('You are strapped in at the top of the rocket. Work the ascent checklist on your panel, then press LAUNCH.'); } else say('Jehielle: "' + JEHIELLE.flight.go + '"', JEHIELLE.flight.go); },
    render(r) { r.render(bg, bcam); r.clearDepth(); r.render(fg, cam); if (ck && curMode === 'cockpit') { r.clearDepth(); r.render(ck.scene, ck.camera); } },
    onExit() { engineSound(0, 0); window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); },
    update(dt) {
      if (done) return;
      // --- player flying: steering through the first stage, then commanding stage separation ---
      const onPad = phase === 'count' || phase === 'pre'; const steering = phase === 'ascent' && sepT === null && T >= 12 && !waitStage && !G.done;
      if (steering && !G.on) { G.on = true; guide.hidden = false; say(JEHIELLE.flight.steer, JEHIELLE.flight.steer); }
      if (steering) { G.t += dt; const k = input.keys; const inp = (k.KeyD || k.ArrowRight || G.btn > 0 ? 1 : 0) - (k.KeyA || k.ArrowLeft || G.btn < 0 ? 1 : 0); steerIn = inp; const wind = 0.5 * Math.sin(G.t * 0.9) + 0.32 * Math.sin(G.t * 2.3 + 1) + 0.22 * Math.sin(G.t * 0.37 + 2);
        G.x = Math.max(-1, Math.min(1, G.x + (wind + inp * 1.0) * dt * 0.9)); G.total += dt; if (Math.abs(G.x) <= G.band) G.inBand += dt; gMark.style.left = (50 + G.x * 50) + '%'; gMark.className = Math.abs(G.x) <= G.band ? 'in' : 'out'; gAcc.textContent = Math.round(G.inBand / Math.max(0.01, G.total) * 100) + ' % in the corridor'; }
      if (waitStage) { waitT += dt; if (waitT > 5) commandStage(true); }
      if (phase === 'pre') big.textContent = 'HOLD'; const rate = phase === 'pre' ? 0 : phase === 'count' ? 1 : phase === 'orbit' ? 1 : waitStage ? 0 : (T < 12 ? 1 : steering ? 6 : (fast ? 26 : 7)); T += dt * rate;
      // countdown
      if (phase === 'count') { const n = Math.ceil(-T); if (n !== lastWhole && n >= 0 && n <= 10) { lastWhole = n; big.textContent = n > 0 ? 'T−' + n : 'LIFTOFF'; sfx.beep(n === 0); if (n === 6) say(JEHIELLE.flight.ignition, JEHIELLE.flight.ignition); if (n === 3) { plume1.visible = true; smoke.material.opacity = 0.5; } } else if (-T > 10) big.textContent = 'T−' + Math.ceil(-T);
        if (T >= -3) { engineSound(Math.min(1, (T + 3) / 3), 1); glow.intensity = 3000 * Math.min(1, (T + 3) / 3); plume1.scale.set(1, Math.min(1, (T + 3) / 3) * 0.5, 1); }
        if (T >= 0) { phase = 'ascent'; say(JEHIELLE.flight.liftoff, JEHIELLE.flight.liftoff); } }
      const tt = Math.max(0, Math.min(T, insertion)); const s = sampleAt(tt); const air = Math.exp(-s.alt / 9000);
      if (phase !== 'count') {
        big.textContent = 'T+' + fmt(Math.min(T, insertion)) + ' s';
        tAlt.textContent = (s.alt / 1000).toFixed(1) + ' km'; tVel.textContent = fmt(s.vel) + ' m/s'; tDown.textContent = fmt(s.down / 1000) + ' km'; tStage.textContent = phase === 'orbit' ? 'Spacecraft' : s.stage === 1 ? 'First stage' : 'Second stage'; tAcc.textContent = (Math.max(0, s.acc) / 9.81).toFixed(1) + ' g';
        while (shownEv < asc.events.length && asc.events[shownEv].t <= T) { const e = asc.events[shownEv];
          if (e.label.startsWith('Main engine') && !stageDone) { if (!waitStage) { waitStage = true; waitT = 0; T = e.t; finishSteering(); stageBtn.hidden = false; stageBtn.focus(); say(JEHIELLE.flight.meco, JEHIELLE.flight.meco); plume1.visible = false; engineSound(0, 0); } break; }
          evEls[shownEv].classList.add('done'); const vl = e.label.startsWith('Main engine') ? JEHIELLE.flight.stage : e.label.startsWith('Fairing') ? JEHIELLE.flight.fairing : e.label.startsWith('Orbital') ? JEHIELLE.flight.orbit : null; say(e.label + '.', vl); shownEv++;
          if (e.label.startsWith('Main engine')) { sepT = T; sfx.staging(); plume1.visible = false; plume2.visible = true; fg.attach(U.s1); s1Free = { v: 0, r: (Math.random() - 0.5) * 0.3 }; }
          if (e.label.startsWith('Second-stage')) { plume2.visible = true; }
          if (e.label.startsWith('Fairing')) { fairT = T; sfx.staging(); craft.visible = true; U.band.visible = false; }
          if (e.label.startsWith('Orbital')) { phase = 'orbit'; endT = 0; plume2.visible = false; engineSound(0, 0); say('Orbital insertion confirmed. ' + asc.note, JEHIELLE.flight.orbit); showDeploy(); } }
      }
      // world placement: the rocket stays at the origin and the world moves
      ground.position.y = -s.alt; ground.visible = s.alt < 9000; smoke.visible = s.alt < 2500;
      earth.position.set(0, -6371 - s.alt / 1000, 0); earth.rotation.z = 0.0 + (s.down / 6371000);
      bg.background.copy(night).lerp(day, Math.min(1, air * 1.15)); stars.material.opacity = Math.max(0, 1 - air * 3); hemi.intensity = 0.25 + 0.75 * air;
      rig.rotation.z = -(Math.PI / 2 - s.pitch) * (onPad ? 0 : 1); rig.rotation.x = G.on && !G.done ? G.x * 0.07 : rig.rotation.x * 0.9;
      if (phase === 'ascent') { const thrust = s.stage === 1 ? 1 : (sepT !== null && T - sepT < 4 ? 0 : 0.55); engineSound(thrust, air); glow.intensity = thrust * 3500 * (0.4 + 0.6 * air);
        const flick = 0.92 + Math.random() * 0.16; plume1.scale.set(1 + (1 - air) * 1.6, (0.55 + (1 - air) * 0.9) * flick, 1 + (1 - air) * 1.6); plume2.scale.set(1 + (1 - air) * 2.5, flick, 1 + (1 - air) * 2.5);
        if (T < 12) { const pa = smoke.geometry.attributes.position; for (let i = 0; i < NS; i++) { pa.array[i * 3] += sv[i][0] * dt; pa.array[i * 3 + 1] += sv[i][1] * dt; pa.array[i * 3 + 2] += sv[i][2] * dt; } pa.needsUpdate = true; smoke.material.size = 26 + T * 9; smoke.material.opacity = Math.max(0, 0.55 - T * 0.02); } }
      if (s1Free) { s1Free.v += dt * rate * 0.9; U.s1.position.y -= s1Free.v * dt * 6; U.s1.rotation.z += s1Free.r * dt; if (T - sepT > 60) U.s1.visible = false; }
      if (fairT !== null) { const u = Math.min(1, (T - fairT) / 14); U.halves[0].position.x = u * U.H * 0.5; U.halves[1].position.x = -u * U.H * 0.5; U.halves[0].rotation.z = -u * 0.9; U.halves[1].rotation.z = u * 0.9; U.halves[0].position.y = U.halves[1].position.y = (U.H * 0.72 + 1) - u * U.H * 0.2; if (u >= 1) U.halves.forEach((h) => (h.visible = false)); }
      if (deploying) { deployed = Math.min(1, deployed + dt / 4); craft.userData.setFold(1 - deployed); craft.position.y += dt * 0.6; if (deployed >= 1) { deploying = false; finish(); } }
      // cameras
      const mode = camMode !== 'auto' ? camMode : onPad || s.alt < 350 ? 'pad' : phase === 'orbit' ? 'orbit' : (sepT !== null && T - sepT < 40) || (fairT !== null && T - fairT < 18) ? 'onboard' : 'track';
      const H = U.H; const axis = tmp.set(Math.sin(Math.PI / 2 - s.pitch), Math.cos(Math.PI / 2 - s.pitch), 0); if (onPad) axis.set(0, 1, 0); curMode = mode; rig.visible = mode !== 'cockpit';
      if (mode === 'cockpit') { cam.position.copy(axis).multiplyScalar(H * 0.85 + padTop); look.set(axis.x + axis.y * 0.55, axis.y - axis.x * 0.55, 0).multiplyScalar(500).add(cam.position); cam.fov = ck.camera.fov; }
      else if (mode === 'pad') { const push = onPad ? Math.min(1, (T + 12) / 12) : 1; cam.position.set(H * (2.6 - push * 0.7), 5 - s.alt + padTop, H * (2.4 - push * 0.6)); look.set(0, padTop + H * 0.5 + Math.min(s.alt, H * 3) * 0.0, 0); cam.fov = onPad ? 46 : Math.max(14, 46 - s.alt * 0.02); }
      else if (mode === 'track') { camYaw += dt * 0.05; cam.position.set(Math.cos(camYaw) * H * 2.1 + axis.x * H * 0.4, H * 0.35 + axis.y * H * 0.4, Math.sin(camYaw) * H * 2.1); look.copy(axis).multiplyScalar(H * 0.5 + padTop); cam.fov = 44; }
      else if (mode === 'onboard') { cam.position.copy(axis).multiplyScalar(H * 0.78 + padTop).add(new THREE.Vector3(-axis.y, axis.x, 0).multiplyScalar(U.R * 2.4)).add(new THREE.Vector3(0, 0, U.R * 1.6)); look.copy(axis).multiplyScalar(-H * 0.6); cam.fov = 72; }
      else { endT += dt; const a = 0.6 + endT * 0.12; craft.getWorldPosition(look); cam.position.copy(look).add(new THREE.Vector3(Math.cos(a) * 9, 3.2, Math.sin(a) * 9)); cam.fov = 42; }
      const shake = phase === 'ascent' && !settings.reducedMotion ? (mode === 'pad' ? Math.max(0, 1 - s.alt / 1500) * 0.5 : 0.05 + air * 0.12) : 0; if (mode !== 'cockpit') { cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake; }
      cam.lookAt(look); if (mode === 'cockpit') { cam.rotateY(ck.look.yaw); cam.rotateX(ck.look.pitch + 0.4); }
      if (ck) { const gl = Math.max(0, s.acc) / 9.81; const burning = phase === 'ascent' && !waitStage; if (phase !== 'pre' && kmsg === 'COUNTDOWN' && phase === 'ascent') kmsg = 'LIFTOFF'; if (steering) kmsg = 'STEER: A / D OR THE ARROWS'; else if (waitStage) kmsg = 'ENGINE CUT-OFF: PRESS STAGE'; else if (canDeploy) kmsg = 'IN ORBIT: PRESS DEPLOY'; else if (phase === 'ascent' && G.done && stageDone) kmsg = 'SECOND STAGE BURNING';
        ck.update(dt, { clock: phase === 'pre' ? 'HOLD' : T < 0 ? 'T-' + String(Math.ceil(-T)).padStart(2, '0') : 'T+' + fmt(Math.min(T, insertion)), alt: (s.alt / 1000).toFixed(1), vel: fmt(s.vel), g: phase === 'ascent' ? 1 + gl : 1 * (phase === 'orbit' ? 0 : 1), pitch: onPad ? Math.PI / 2 : s.pitch, roll: G.on && !G.done ? G.x : 0, steering, steerX: G.x, band: G.band, steerIn: steering ? steerIn : 0, lamps: [phase !== 'pre' && T > -3, sepT !== null, fairT !== null, phase === 'orbit'], msg: kmsg, next: settings.assist === 'independent' && phase === 'pre' ? null : pNext(), guardUp: phase !== 'pre' || pdone.size >= PILOT_STEPS.length, live: phase !== 'pre' || pdone.has('power'), shake: settings.reducedMotion ? 0 : (phase === 'count' && T > -3 ? 0.006 : burning ? 0.004 + air * 0.012 : 0), gPush: burning ? Math.min(1, gl / 3) : 0, glow: burning ? air : 0 }); } cam.updateProjectionMatrix(); bcam.fov = cam.fov; bcam.updateProjectionMatrix(); bcam.position.copy(cam.position).multiplyScalar(0.001); bcam.quaternion.copy(cam.quaternion);
    },
  };
  function showDeploy() {
    ctrl.innerHTML = ''; ctrl.append(el('div', { class: 'label' }, 'Spacecraft command'), el('p', { class: 'note' }, 'The spacecraft is still attached to the second stage with its arrays stowed and is running on battery.'),
      button('Separate spacecraft and deploy arrays', () => doDeploy(), 'primary pulse')); canDeploy = true;
  }
  async function finish() {
    say(JEHIELLE.flight.yours, JEHIELLE.flight.yours); sfx.confirm(); award('orbit:' + state.runs, 150, 'Orbit achieved');
    ctrl.append(button((settings.mission && settings.mission !== 'star') ? 'Unstrap and float into the cabin' : 'Continue to orbit selection', async () => { done = true; document.body.classList.remove('no-timer'); closeOverlay(); setStage('orbit'); game.afterLaunch(); }, 'primary'));
  }
  return sc;
}
