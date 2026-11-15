// Level 4: orbit selection and the mission operations console.
import * as THREE from 'three';
import { state, commit, setStage, settings, isQuick } from './state.js';
import { ORBITS, PAYLOADS } from './catalog.js';
import { totals, orbitAvailability, opt } from './engineering.js';
import { createOps, EVENTS } from './ops.js';
import { makeSpacecraft, makeEarth, makeStars } from './builders.js';
import { el, button, openOverlay, closeOverlay, modal, toast, fmt } from './ui.js';
import { setScene, transition, engine, onTick } from './engine.js';
import { sfx, setAmbience } from './audio.js';
import { award } from './points.js';
import { speak } from './voice.js';
import { JEHIELLE } from './lines.js';
import { input } from './input.js';

let space = null;
function getSpace() {
  if (space) { space.rebuild(); return space; }
  const fg = new THREE.Scene(), bg = new THREE.Scene(); bg.background = new THREE.Color(0x000003);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 500), bcam = new THREE.PerspectiveCamera(42, 1, 1, 4e6);
  const sunDir = new THREE.Vector3(0.75, 0.25, 0.6).normalize();
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4); sun.position.copy(sunDir).multiplyScalar(50); fg.add(sun); sun.castShadow = !engine.lowQuality; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix(); const fill = new THREE.HemisphereLight(0x35507a, 0x05060a, 0.55); fg.add(fill);
  const bsun = new THREE.DirectionalLight(0xffffff, 3.2); bsun.position.copy(sunDir); bg.add(bsun); bg.add(new THREE.AmbientLight(0x1a2233, 0.35));
  const earth = makeEarth(6371, engine.lowQuality ? 0 : 1); earth.userData.atmo.material.uniforms.sun.value.copy(sunDir); bg.add(earth); bg.add(makeStars(3000, 3e6, 9));
  const holder = new THREE.Group(); fg.add(holder); let craft = null;
  let dist = 6571, wantDist = 6571, yaw = 0.4, shade = 1;
  const s = { scene: fg, camera: cam, cameras: [cam, bcam], holder,
    rebuild() { if (craft) holder.remove(craft); craft = makeSpacecraft(state); craft.rotation.set(0.5, 0, 0.35); holder.add(craft); holder.visible = true; craft.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } }); s.craft = craft; },
    setOrbit(id) { wantDist = id === 'leo' ? 6971 : id === 'heo' ? 120000 : id === 'l2' ? 1500000 : 6571; },
    setShade(v) { shade = v; },
    render(r) { r.render(bg, bcam); r.clearDepth(); r.render(fg, cam); },
    update(dt) { if (!settings.reducedMotion) yaw += dt * 0.035; dist += (wantDist - dist) * Math.min(1, dt * 0.9);
      const h = craft ? craft.userData.height : 2; cam.position.set(Math.sin(yaw) * 9, 2.2, Math.cos(yaw) * 9); cam.lookAt(0, h * 0.35, 0);
      const far = Math.min(1, Math.max(0, (dist - 7500) / 40000)); const ex = -0.35 - 0.2 * far, ey = -0.92 + 0.66 * far, ez = -0.18 - 0.64 * far, en = Math.hypot(ex, ey, ez); earth.position.set(ex / en * dist, ey / en * dist, ez / en * dist); earth.rotation.y += dt * 0.01; earth.userData.clouds.rotation.y += dt * 0.002;
      bcam.quaternion.copy(cam.quaternion); bcam.position.set(0, 0, 0); sun.intensity += ((shade * 3.4) - sun.intensity) * Math.min(1, dt * 3); },
  };
  s.rebuild(); space = s; return s;
}

function orbitDiagram(id) {
  const c = el('canvas', { width: 220, height: 110, role: 'img', 'aria-label': 'Sketch of the ' + ORBITS[id].name + ' (not to scale)' }); const g = c.getContext('2d'); g.fillStyle = '#0b0e12'; g.fillRect(0, 0, 220, 110);
  g.strokeStyle = '#f2a23a'; g.lineWidth = 1.5; g.fillStyle = '#3a6ea5';
  if (id === 'leo') { g.beginPath(); g.arc(110, 55, 26, 0, 7); g.fill(); g.beginPath(); g.arc(110, 55, 33, 0, 7); g.stroke(); }
  if (id === 'heo') { g.beginPath(); g.arc(60, 55, 12, 0, 7); g.fill(); g.beginPath(); g.ellipse(112, 55, 78, 34, 0, 0, 7); g.stroke(); g.fillStyle = '#8d97a3'; g.beginPath(); g.arc(198, 26, 4, 0, 7); g.fill(); }
  if (id === 'l2') { g.beginPath(); g.arc(70, 55, 7, 0, 7); g.fill(); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(-16, 55, 34, 0, 7); g.fill(); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(78, 55); g.lineTo(168, 55); g.stroke(); g.setLineDash([]); g.beginPath(); g.ellipse(178, 55, 10, 22, 0, 0, 7); g.stroke(); }
  g.fillStyle = '#8d97a3'; g.font = '10px system-ui'; g.fillText('Not to scale', 6, 104); return c;
}

// Live Earth behind the title screen.
export function titleBackdrop() { const sp = getSpace(); sp.holder.visible = false; sp.setOrbit(null); sp.setShade(1); return sp; }

export async function openOrbitSelection(game) {
  let sp; await transition(async () => { sp = getSpace(); sp.setOrbit(null); sp.setShade(1); setScene(sp); setAmbience('space'); }, state.opsResult ? '' : 'Parking orbit · 200 km');
  if (isQuick()) { // the orbit was chosen with the telescope; use it if the launch left enough margin
    let pick = state.plannedOrbit && orbitAvailability(state, state.plannedOrbit).ok ? state.plannedOrbit : null;
    if (!pick) { pick = ['l2', 'heo', 'leo'].find((id) => orbitAvailability(state, id).ok) || 'leo'; if (state.plannedOrbit) toast(`The launch left ${state.launch.reserve} % margin, not enough for ${ORBITS[state.plannedOrbit].name}. The mission will work from ${ORBITS[pick].name} instead.`, 'alert', 10000); }
    state.orbit = pick; setStage('ops'); commit(); sp.setOrbit(pick); await acquireTarget(); openOps(game, sp); return; }
  const root = el('div', { class: 'station bottom' }); let focus = null; const L = state.launch;
  function render() {
    root.innerHTML = '';
    const cards = Object.values(ORBITS).map((o) => { const av = orbitAvailability(state, o.id);
      return el('button', { type: 'button', class: 'card orbit' + (focus === o.id ? ' focus' : '') + (av.ok ? '' : ' blocked'), 'aria-pressed': String(focus === o.id), onclick: () => { focus = o.id; sfx.select(); sp.setOrbit(o.id); render(); } },
        el('div', { class: 'card-top' }, el('b', {}, o.name), el('span', { class: 'tag' }, o.alt)), orbitDiagram(o.id),
        el('dl', {}, el('dt', {}, 'Observation'), el('dd', {}, o.observe), el('dt', {}, 'Communications'), el('dd', {}, o.comms), el('dt', {}, 'Characteristics'), el('dd', {}, o.traits), el('dt', {}, 'Suitability'), el('dd', {}, o.fit)),
        el('div', { class: 'suit ' + (av.ok ? 'suitable' : 'unsuitable') }, av.ok ? '● Reachable with this spacecraft' : '▲ Not reachable: ' + av.reasons.join(' '))); });
    const t = totals(state);
    root.append(el('section', { class: 'panel full' }, el('div', { class: 'label' }, 'Level 4 · Orbit and mission operations'), el('h2', {}, 'Select the operating orbit'),
      el('p', { class: 'lead' }, `Jehielle: "You are in a 200 km parking orbit with ${L.reserve} % launch margin left for the transfer. Your recorder holds ${(t.storage / t.dataRate).toFixed(0)} days of data and your antenna is the ${opt(state, 'comms').name}. Choose where the mission will work."`),
      el('div', { class: 'cards three' }, cards),
      el('div', { class: 'row-btns' }, el('span', { class: 'note' }, focus ? 'The view behind shows the Earth as seen from the selected orbit.' : 'Select an orbit to preview it.'),
        button(focus ? 'Commit to ' + ORBITS[focus].name : 'Select an orbit', async () => {
          if (!focus) return; const av = orbitAvailability(state, focus);
          if (!av.ok) { sfx.deny(); await modal('Orbit not reachable', el('div', {}, el('p', {}, av.reasons.join(' ')), el('p', {}, 'This follows from the design and launch you flew. Choose a reachable orbit now; you can redesign the mission after the report.')), [{ label: 'Choose another orbit', value: true, cls: 'primary' }]); return; }
          state.orbit = focus; setStage('ops'); commit(); sfx.confirm(); closeOverlay(); sp.setOrbit(focus); await acquireTarget(); openOps(game, sp);
        }, 'primary'))));
  }
  render(); openOverlay(root, 'station-overlay');
}

// Target acquisition: steer the telescope's reticle onto the guide star and hold it there.
function acquireTarget() {
  return new Promise((resolve) => {
    speak(JEHIELLE.ops.acquire, 'ops'); document.body.classList.add('no-timer');
    const W = 640, Hh = 360; const cv = el('canvas', { width: W, height: Hh, class: 'acq', tabindex: '0', role: 'img', 'aria-label': 'Telescope view with a reticle and a marked guide star' }); const info = el('p', { class: 'lead', 'aria-live': 'polite' }, 'Drag on the view, or use W A S D or the arrow keys, to move the reticle onto the marked guide star. Hold it there to lock.');
    let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const stars = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * Hh, r: 0.6 + rnd() * 1.6 })); const tgt = { x: W * (0.25 + rnd() * 0.5), y: Hh * (0.25 + rnd() * 0.5) };
    const jit = { basic: 1.6, fine: 0.7 }[state.bus.adcs] || 1; const R = settings.assist === 'guided' ? 26 : settings.assist === 'standard' ? 20 : 15; let rx = W * 0.85, ry = Hh * 0.8, t = 0, lock = 0, done = false, drag = null;
    const finish = (auto) => { if (done) return; done = true; stop(); document.body.classList.remove('no-timer'); const pts = auto ? 20 : Math.max(40, Math.round(200 - t * 7)); state.acquire = { seconds: Math.round(t), auto }; award('acquire:' + state.runs, pts, auto ? 'Automatic target acquisition' : `Target locked in ${t.toFixed(0)} s`); speak(JEHIELLE.ops.locked, 'ops'); sfx.confirm(); closeOverlay(); resolve(); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * Hh }; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); drag = pos(e); }); cv.addEventListener('pointermove', (e) => { if (drag) drag = pos(e); }); cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointercancel', () => { drag = null; });
    const stop = onTick((dt) => { t += dt; const k = input.keys; let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), iy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
      if (drag) { const dx = drag.x - rx, dy = drag.y - ry, m = Math.hypot(dx, dy); if (m > 2) { ix = dx / m * Math.min(1, m / 40); iy = dy / m * Math.min(1, m / 40); } }
      rx += (ix * 150 + Math.sin(t * 1.3) * 22 * jit + Math.sin(t * 3.1 + 1) * 12 * jit) * dt; ry += (iy * 150 + Math.cos(t * 1.1) * 20 * jit + Math.sin(t * 2.7) * 12 * jit) * dt; rx = Math.max(8, Math.min(W - 8, rx)); ry = Math.max(8, Math.min(Hh - 8, ry));
      const on = Math.hypot(rx - tgt.x, ry - tgt.y) < R; lock = on ? lock + dt : Math.max(0, lock - dt * 2); if (on && Math.random() < dt * 8) sfx.data();
      const g = cv.getContext('2d'); g.fillStyle = '#04060a'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#cfd6de'; for (const s of stars) { g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
      g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(tgt.x, tgt.y, 3.2, 0, 7); g.fill(); g.strokeStyle = '#f2a23a'; g.lineWidth = 1.5; g.strokeRect(tgt.x - 14, tgt.y - 14, 28, 28); g.fillStyle = '#f2a23a'; g.font = '11px system-ui'; g.fillText('GUIDE STAR', tgt.x + 18, tgt.y - 8);
      g.strokeStyle = on ? '#6fbf8b' : '#e8ebee'; g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, R, 0, 7); g.moveTo(rx - R - 8, ry); g.lineTo(rx - 6, ry); g.moveTo(rx + 6, ry); g.lineTo(rx + R + 8, ry); g.moveTo(rx, ry - R - 8); g.lineTo(rx, ry - 6); g.moveTo(rx, ry + 6); g.lineTo(rx, ry + R + 8); g.stroke();
      if (lock > 0) { g.strokeStyle = '#6fbf8b'; g.lineWidth = 4; g.beginPath(); g.arc(rx, ry, R + 6, -Math.PI / 2, -Math.PI / 2 + Math.min(1, lock / 1.6) * Math.PI * 2); g.stroke(); }
      info.textContent = on ? `\u25CF On target. Hold steady: ${Math.round(Math.min(1, lock / 1.6) * 100)} %` : `\u25CB Searching. ${t.toFixed(0)} s elapsed. Faster locks earn more points.`;
      if (lock >= 1.6) finish(false); });
    openOverlay(el('div', { class: 'station solo' }, el('section', { class: 'panel wide' }, el('div', { class: 'label' }, 'Level 4 \u00B7 Target acquisition'), el('h2', {}, 'Point the telescope'), el('p', { class: 'note' }, 'Jehielle: "' + JEHIELLE.ops.acquire + '" ' + (state.bus.adcs === 'basic' ? 'Your coarse reaction wheels make the view wander more.' : 'Your fine guidance system keeps the view steady.')), cv, info, el('div', { class: 'row-btns' }, button('Let the flight computer do it (few points)', () => finish(true), 'ghost')))), 'station-overlay dim'); cv.focus();
  });
}

function openOps(game, sp) {
  const o = createOps(state); const orbit = ORBITS[state.orbit]; const t = totals(state); const p = PAYLOADS[state.payload];
  sp.setOrbit(state.orbit);
  const root = el('div', { class: 'station ops' });
  const SPEEDS = [[0, 'Pause'], [12, '1×'], [48, '4×'], [160, '12×']]; let askedOne = false, speed = isQuick() ? 48 : 12, acc = 0, lastSpeed = isQuick() ? 48 : 12, uiT = 0, logN = 0, ended = false;
  const clock = el('div', { class: 'clock' }), stateEl = el('div', { class: 'opstate' }); const speedSeg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Simulation speed' });
  const drawSpeed = () => { speedSeg.innerHTML = ''; for (const [v, n] of SPEEDS) speedSeg.append(el('button', { type: 'button', role: 'radio', 'aria-checked': String(speed === v), class: speed === v ? 'on' : '', onclick: () => { speed = v; if (v) lastSpeed = v; sfx.click(); drawSpeed(); } }, n)); };
  const mk = (label) => { const bar = el('i'); const val = el('b'); const note = el('div', { class: 'meter-status' }); const box = el('div', { class: 'meter' }, el('div', { class: 'meter-head' }, el('span', {}, label), val), el('div', { class: 'bar' }, bar), note); return { box, set(pct, text, status, n) { bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; val.textContent = text; box.className = 'meter ' + (status || ''); note.textContent = n || ''; } }; };
  const mBat = mk('Battery'), mPow = mk('Power: load vs generation'), mRec = mk('Data recorder'), mObs = mk('Mission elapsed');
  const kvEl = (k) => { const b = el('b'); return { row: el('div', { class: 'kv' }, el('span', {}, k), b), b }; };
  const kInst = kvEl('Instrument'), kTarget = kvEl('Target'), kComm = kvEl('Ground contact'), kColl = kvEl('Measurements recorded'), kDown = kvEl('Delivered to ground'), kLost = kvEl('Lost (recorder full)');
  const modeSeg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Instrument mode' }); const drawMode = () => { modeSeg.innerHTML = ''; for (const [v, n] of [['on', 'Observe'], ['half', '6 h on / 6 h off'], ['off', 'Standby']]) modeSeg.append(el('button', { type: 'button', role: 'radio', 'aria-checked': String(o.mode === v), class: o.mode === v ? 'on' : '', onclick: () => { o.setMode(v); sfx.switch(); drawMode(); } }, n)); };
  const tl = el('canvas', { width: 900, height: 64, class: 'timeline', role: 'img', 'aria-label': 'Observation timeline' }); const logEl = el('ul', { class: 'oplog', 'aria-live': 'polite' });
  const decision = el('div', { class: 'decision', hidden: true });
  root.append(
    el('header', { class: 'panel opsbar' }, el('div', {}, el('div', { class: 'label' }, `Level 4 · Mission operations · ${orbit.name}`), clock), stateEl, el('div', {}, el('div', { class: 'label' }, 'Time'), speedSeg)),
    el('section', { class: 'panel left' }, el('div', { class: 'label' }, 'Spacecraft'), mBat.box, mPow.box, mRec.box, el('div', { class: 'label' }, 'Instrument command'), modeSeg, el('div', { class: 'kvs' }, kInst.row, kTarget.row, kComm.row)),
    el('section', { class: 'panel right' }, el('div', { class: 'label' }, 'Science return'), mObs.box, el('div', { class: 'kvs' }, kColl.row, kDown.row, kLost.row), el('div', { class: 'label' }, 'Flight log'), logEl),
    el('section', { class: 'panel tlpanel' }, el('div', { class: 'label' }, 'Observation timeline'), tl, el('div', { class: 'legend' }, el('span', { class: 'lg d' }, '■ delivered'), el('span', { class: 'lg s' }, '■ recorded, waiting for contact'), el('span', { class: 'lg l' }, '▲ lost'), el('span', { class: 'lg n' }, '□ not observed'), el('span', { class: 'lg e' }, '─ event'))), decision);
  drawSpeed(); drawMode(); openOverlay(root, 'station-overlay clear');
  toast(`Operations begin. ${orbit.observe}`, 'info', 8000);

  function drawTimeline() {
    const g = tl.getContext('2d'), w = tl.width, h = tl.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h); const per = o.N / w;
    for (let x = 0; x < w; x++) { const a = Math.floor(x * per), b = Math.max(a + 1, Math.floor((x + 1) * per)); if (a >= o.i) break; let d = 0, c = 0, l = 0, n = 0; for (let i = a; i < b && i < o.i; i++) { n++; if (o.delivered[i]) d++; else if (o.collected[i]) c++; else if (o.lost[i]) l++; }
      const hh = h - 22; if (d) { g.fillStyle = '#e8ebee'; g.fillRect(x, 4 + hh * (1 - d / n), 1, hh * d / n); } if (c) { g.fillStyle = '#f2a23a'; g.fillRect(x, 4 + hh * (1 - (d + c) / n), 1, hh * c / n); } if (l) { g.fillStyle = '#e5564b'; g.fillRect(x, 4, 1, 5); } }
    for (const ev of EVENTS) { g.fillStyle = '#6fa8c4'; g.fillRect(ev.start / o.days * w, h - 14, (ev.end - ev.start) / o.days * w, 3); g.fillStyle = '#8d97a3'; g.font = '10px system-ui'; if (o.fired[ev.id]) g.fillText(ev.title, ev.start / o.days * w, h - 1); }
    g.fillStyle = '#f2a23a'; g.fillRect(o.i / o.N * w, 0, 1.5, h - 16);
    g.fillStyle = '#5c6670'; g.font = '10px system-ui'; for (let d = 0; d <= o.days; d += 10) g.fillText('d' + d, Math.min(w - 18, d / o.days * w + 2), h - 18 + 0);
  }
  function refresh() {
    const T = o.tel; if (T.t == null) return;
    const d = Math.floor(T.t), hr = Math.floor((T.t - d) * 24); clock.textContent = `Day ${String(d).padStart(2, '0')} · ${String(hr).padStart(2, '0')}:00 of ${o.days} days`;
    stateEl.textContent = T.state; stateEl.className = 'opstate ' + (T.safe ? 'bad' : T.fault || T.outage || T.wheels || T.desat ? 'warn' : 'good');
    mBat.set(T.battery * 100, Math.round(T.battery * 100) + ' %', T.battery < 0.25 ? 'bad' : T.battery < 0.6 ? 'warn' : 'good', T.battery < 0.25 ? '▲ Low: safe mode if it reaches zero' : T.gen < T.load ? '◆ Draining' : '● Charged or charging');
    mPow.set(T.load / Math.max(1, T.gen) * 100, `${T.load} / ${T.gen} W`, T.load > T.gen ? 'bad' : T.load > T.gen * 0.9 ? 'warn' : 'good', T.fault ? '▲ Array fault: generation reduced 35 %' : T.load > T.gen ? '▲ Load exceeds generation' : '● Generation covers the load');
    mRec.set(T.stored / T.cap * 100, `${T.stored.toFixed(1)} / ${T.cap} GB`, T.stored / T.cap > 0.95 ? 'bad' : T.stored / T.cap > 0.75 ? 'warn' : 'good', T.stored / T.cap > 0.95 ? '▲ Full: new observations are being lost' : '● ' + ((T.cap - T.stored) / t.dataRate).toFixed(1) + ' days of room left');
    mObs.set(o.i / o.N * 100, `${(o.i / 48).toFixed(1)} / ${o.days} days`, '', '');
    kInst.b.textContent = T.safe ? 'Off (safe mode)' : T.desat ? 'Off (unloading wheels)' : T.instOn ? (T.wheels ? 'Observing, pointing degraded' : 'Observing') : 'Standby'; kTarget.b.textContent = T.visible ? 'In view' : 'Blocked'; kComm.b.textContent = T.outage ? 'OUTAGE: no stations' : T.contact ? 'In contact, sending data' : 'No station in view';
    kColl.b.textContent = fmt(o.counts.collected); kDown.b.textContent = fmt(o.counts.delivered); kLost.b.textContent = fmt(o.counts.lost);
    while (logN < o.log.length) { const e = o.log[logN++]; logEl.prepend(el('li', { class: 'log-' + e.level }, el('span', {}, 'Day ' + e.day.toFixed(1)), (e.level === 'alert' ? '▲ ' : e.level === 'decision' ? '▶ ' : '') + e.msg)); if (e.level === 'alert') sfx.alert(); }
    sp.setShade(T.safe ? 0.35 : orbit.id === 'leo' && !T.visible ? 0.6 : 1); drawTimeline();
  }
  function showDecision() {
    const d = o.pending; decision.hidden = false; decision.innerHTML = ''; sfx.alert(); speak(d.absorbed ? JEHIELLE.ops.absorbed : JEHIELLE.ops[d.id], 'ops');
    decision.append(el('div', { class: 'panel decision-card', role: 'alertdialog', 'aria-label': d.title }, el('div', { class: 'label warn' }, '▲ Operational event · Day ' + o.t.toFixed(1)), el('h2', {}, d.title), el('p', { class: 'lead' }, 'Jehielle: "' + d.text + '"'),
      el('div', { class: 'opts col' }, d.options.map((op) => el('button', { type: 'button', class: 'opt', onclick: () => { o.decide(op.id); award(`event:${d.id}:${state.runs}`, d.absorbed ? 150 : 100, d.absorbed ? 'Your design absorbed the fault' : 'Decision made under pressure'); sfx.confirm(); decision.hidden = true; drawMode(); speed = lastSpeed; drawSpeed(); } }, el('b', {}, op.label), el('div', { class: 'note' }, 'Consequence: ' + op.effect)))),
      settings.assist === 'guided' && !d.absorbed ? el('p', { class: 'note' }, 'Hint: compare the shortfall in watts or the days of recorder room against the length of the event. The cheapest choice in observing time is usually the one that just covers the gap.') : null));
    const card = decision.querySelector('.decision-card'); card.tabIndex = -1; card.focus();
  }
  const stop = onTick((dt) => {
    if (ended) return;
    if (!o.pending && !o.finished && speed) { acc += dt * speed; let n = Math.floor(acc); acc -= n; while (n-- > 0 && !o.pending && !o.finished) o.step(); if (Math.random() < dt * 3 && o.tel.contact) sfx.data(); }
    if (o.pending && decision.hidden) { const d = o.pending; if (isQuick() && (d.absorbed || askedOne)) { const op = d.options[0]; o.decide(op.id); toast(`${d.title}: ${d.absorbed ? 'absorbed by your design.' : 'handled by flight operations (' + op.label.toLowerCase() + ').'}`, 'info', 7000); } else { askedOne = true; refresh(); showDecision(); } }
    uiT -= dt; if (uiT < 0) { uiT = 0.12; refresh(); }
    if (o.finished) { ended = true; stop(); refresh(); finish(); }
  });
  async function finish() {
    state.opsResult = o.result; setStage('analysis'); commit(); const r = o.result; sfx.confirm(); speak(JEHIELLE.ops.done, 'ops'); award('coverage:' + state.runs, Math.round(r.coverage * 300), `Record coverage ${Math.round(r.coverage * 100)} %`);
    await modal('Mission operations complete', el('div', {}, el('p', {}, `Jehielle: "That is the end of the observing campaign. ${fmt(r.counts.delivered)} measurements reached the ground, covering ${Math.round(r.coverage * 100)} % of the ${r.days} days."`),
      el('ul', { class: 'issues' }, el('li', {}, `Recorded on board: ${fmt(r.counts.collected)}`), el('li', {}, `Lost to a full recorder: ${fmt(r.counts.lost)}`), el('li', {}, `Still on board at the end, never sent: ${fmt(r.counts.onboard)}`), el('li', {}, `Safe-mode entries: ${r.counts.safeModes}`)),
      el('p', {}, 'The data has been passed to Afia in the Science Laboratory.')), [{ label: 'Go to the Science Laboratory', value: true, cls: 'primary' }]);
    closeOverlay(); game.afterOps();
  }
}
