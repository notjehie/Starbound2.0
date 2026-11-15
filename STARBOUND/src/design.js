// Levels 2 and 3 (design half): payload bench and spacecraft assembly terminal.
// Both sit over a 3D studio that shows the player's actual hardware.
import * as THREE from 'three';
import { state, commit, setStage, stageName, settings, isQuick } from './state.js';
import { plans, explainFit } from './quick.js';
import { ORBITS } from './catalog.js';
import { QUICK } from './lines.js';
import { PAYLOADS, BUS, BUS_KEYS, VEHICLES, BUDGET, STRUCTURE, TARGET_DEPTH_PPM, FAIRING_RANK } from './catalog.js';
import { totals, validateDesign, assessPayload, dipSNR } from './engineering.js';
import { makeInstrument, makeSpacecraft, makeRocket, M, cyl, disposeTree } from './builders.js';
import { el, button, openOverlay, closeOverlay, modal, meter, toast, fmt } from './ui.js';
import { setScene, engine, onTick, applyEnv } from './engine.js';
import { sfx, setAmbience } from './audio.js';
import { award } from './points.js';
import { speak } from './voice.js';
import { AFIA, ENG } from './lines.js';

let studio = null;
export function getStudio() {
  if (studio) return studio;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e12); scene.fog = new THREE.Fog(0x0b0e12, 14, 40);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xcfd8e2, 0x22262b, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(4, 7, 5); scene.add(key); key.castShadow = !engine.lowQuality; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(0x9ec4ff, 0.9); rim.position.set(-6, 4, -5); scene.add(rim); applyEnv(scene, 0.55);
  const lamp = new THREE.PointLight(0xbfe6ff, 0, 30, 1.4); lamp.position.set(1.2, 2.2, 2.4); scene.add(lamp);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.96, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 1.94, 64), new THREE.MeshBasicMaterial({ color: 0xb5791f })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; scene.add(ring);
  const table = cyl(1.7, 1.8, 0.16, M.trim, 0, 0.08, 0, 48); table.receiveShadow = true; scene.add(table);
  const holder = new THREE.Group(); holder.position.y = 0.16; scene.add(holder);
  const s = { post: true, scene, camera, cameras: [camera], holder, lamp, spin: 0.18, model: null, yaw: 0.6, pitch: 0.28, dist: 6, focusY: 1, auto: true, callouts: [], layer: null,
    setModel(obj, height, lift = 0.1) { if (s.model) { holder.remove(s.model); disposeTree(s.model); } s.model = obj; obj.position.y = lift; holder.add(obj); obj.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } }); const k = Math.max(1, height / 4); key.position.set(4 * k, 7 * k, 5 * k); const sc0 = key.shadow.camera; const rr = Math.max(4, height * 0.75); sc0.left = -rr; sc0.right = rr; sc0.top = rr; sc0.bottom = -rr; sc0.near = 0.5; sc0.far = 30 * k; sc0.updateProjectionMatrix(); s.focusY = height / 2 + 0.2; s.dist = Math.max(3.6, height * 2.3 + 1.6); const sc = Math.max(1, height / 3.2); ring.scale.setScalar(sc); table.scale.set(sc, 1, sc); },
    setCallouts(list, layer) { s.callouts = list; s.layer = layer; if (layer) { layer.innerHTML = ''; for (const c of list) { c.el = el('div', { class: 'callout' }, el('i'), c.label); layer.append(c.el); } } },
    update(dt) { if (s.auto && !settings.reducedMotion) s.yaw += dt * s.spin;
      const shift = window.innerWidth > 900 ? -0.0 : 0; camera.position.set(Math.sin(s.yaw) * Math.cos(s.pitch) * s.dist + shift, s.focusY + Math.sin(s.pitch) * s.dist, Math.cos(s.yaw) * Math.cos(s.pitch) * s.dist); camera.lookAt(0, s.focusY, 0);
      if (s.layer && s.model) { const v = new THREE.Vector3(); for (const c of s.callouts) { v.copy(c.pos); s.model.localToWorld(v); v.project(camera); const on = v.z < 1; c.el.style.display = on ? '' : 'none'; c.el.style.left = ((v.x + 1) / 2 * window.innerWidth) + 'px'; c.el.style.top = ((1 - v.y) / 2 * window.innerHeight) + 'px'; } } },
  };
  // drag to orbit, wheel / pinch to zoom
  const cv = engine.canvas; let drag = null;
  cv.addEventListener('pointerdown', (e) => { if (engine.active === s) { drag = { x: e.clientX, y: e.clientY }; s.auto = false; } });
  window.addEventListener('pointermove', (e) => { if (drag && engine.active === s) { s.yaw -= (e.clientX - drag.x) * 0.008; s.pitch = Math.max(-0.1, Math.min(1.2, s.pitch + (e.clientY - drag.y) * 0.006)); drag = { x: e.clientX, y: e.clientY }; } });
  window.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { if (engine.active === s) { s.dist = Math.max(2.5, Math.min(60, s.dist * (1 + Math.sign(e.deltaY) * 0.08))); e.preventDefault(); } }, { passive: false });
  studio = s; return s;
}

// A short, skippable sequence in the studio: captions advance while onFrame(0..1) animates the model.
function studioBeat(st, title, lines, onFrame) {
  return new Promise((resolve) => {
    const per = settings.reducedMotion ? 0.5 : 1.7, total = lines.length * per; let t = 0, shown = -1, finished = false;
    const text = el('p', { class: 'lead', 'aria-live': 'polite' }); const prog = el('div', { class: 'progress' }, lines.map(() => el('i')));
    const end = () => { if (finished) return; finished = true; document.body.classList.remove('no-timer'); stop(); onFrame && onFrame(1, st); st.lamp.intensity = 0; st.spin = 0.18; closeOverlay(); resolve(); };
    openOverlay(el('div', { class: 'station' }, el('section', { class: 'panel beat' }, el('div', { class: 'label' }, title), text, prog, el('div', { class: 'row-btns' }, button('Skip', end, 'ghost')))), 'station-overlay');
    st.auto = true; st.spin = 0.5; st.setCallouts([], null); document.body.classList.add('no-timer');
    const stop = onTick((dt) => { t += dt; const i = Math.min(lines.length - 1, Math.floor(t / per)); if (i !== shown) { shown = i; text.textContent = lines[i]; prog.children[i].className = 'on'; sfx.talk(); } onFrame && onFrame(Math.min(1, t / total), st); if (t >= total + 0.6) end(); });
  });
}

function touchDesign() { state.validated = false; if (stageName() === 'launch') setStage('spacecraft'); commit(); }
const TELE = { compact: { line: 'Small and cheap. Might miss the dip.', col: '#4fb3a5' }, wide: { line: 'Balanced. Sees the dip clearly.', col: '#f2a23a' }, precision: { line: 'Sharpest eyes. Heavy and expensive.', col: '#b98ad8' } };
const bar = (label, v, col) => el('div', { class: 'tbar' }, el('span', {}, label), el('i', {}, el('u', { style: { width: Math.round(Math.max(0.06, Math.min(1, v)) * 100) + '%', background: col } })));
function teleIcon(q) { const c = el('canvas', { width: 96, height: 96, class: 'tele-ico', 'aria-hidden': 'true' }); const g = c.getContext('2d'); const col = TELE[q.id].col; const k = 0.5 + q.aperture / 60; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, 96, 96); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect((i * 37) % 96, (i * 23) % 60, 1.5, 1.5); }
  g.save(); g.translate(48, 56); g.rotate(-0.6); const L = 46 * k, W = 20 * k; g.fillStyle = col; g.fillRect(-L / 2, -W / 2, L, W); g.fillStyle = '#e8ebee'; g.fillRect(L / 2 - 5, -W / 2 - 3, 7, W + 6); g.fillStyle = '#1b222a'; g.beginPath(); g.ellipse(L / 2 + 2, 0, 3, W / 2, 0, 0, 7); g.fill(); g.fillStyle = '#35506b'; g.fillRect(-L / 2 - 3, -W * 0.9, 6, W * 1.8); g.restore(); g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(80, 14, 4, 0, 7); g.fill(); return c; }
const kv = (k, v, cls = '') => el('div', { class: 'kv ' + cls }, el('span', {}, k), el('b', {}, v));

// Deterministic preview of what one dip would look like through this instrument.
function drawPrediction(cv, sigma) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h);
  let seed = 9001; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(6.283 * rnd());
  const range = Math.max(6000, sigma * 3.2); const y = (ppm) => h * 0.5 - (ppm + TARGET_DEPTH_PPM / 2) / range * h * 0.42;
  g.strokeStyle = '#27303a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y(0)); g.lineTo(w, y(0)); g.stroke();
  g.strokeStyle = '#b5791f'; g.setLineDash([5, 4]); g.beginPath(); for (let i = 0; i <= 96; i++) { const hr = (i / 96) * 24 - 12; const d = Math.abs(hr) < 1 ? -TARGET_DEPTH_PPM * Math.min(1, (1 - Math.abs(hr)) / 0.2) : 0; i ? g.lineTo(i / 96 * w, y(d)) : g.moveTo(0, y(d)); } g.stroke(); g.setLineDash([]);
  g.fillStyle = '#e8ebee'; for (let i = 0; i < 48; i++) { const hr = (i / 48) * 24 - 12; const d = Math.abs(hr) < 1 ? -TARGET_DEPTH_PPM * Math.min(1, (1 - Math.abs(hr)) / 0.2) : 0; g.beginPath(); g.arc((i + 0.5) / 48 * w, y(d + gauss() * sigma), 2.4, 0, 7); g.fill(); }
  g.fillStyle = '#8d97a3'; g.font = '11px system-ui'; g.fillText('24 hours around one 0.33 % dip', 8, h - 8);
}

// ---------------- Level 2: payload bench ----------------
export function openPayloadBench(game) {
  const st = getStudio(); setScene(st); setAmbience('lab'); st.auto = true; st.setCallouts([], null);
  let focus = state.payload || 'wide'; let compare = false, more = false; const tested = {}; const TCOL = { compact: '#6fa8c4', wide: '#6fbf8b', precision: '#b98ad8' };
  const chip = (icon, text, col) => el('span', { class: 'chip', style: { borderColor: col } }, el('i', { style: { color: col } }, icon), text);
  // live test view: the star through this telescope, and the brightness it records
  const labCv = el('canvas', { width: 520, height: 230, class: 'lab-view', role: 'img', 'aria-label': 'Live test view of the star through this telescope' }); const lg = labCv.getContext('2d'); const lab = { sig: 300, id: focus, col: '#6fbf8b', run: null, t: 0, seen: false };
  const stopLab = onTick((dt) => { if (labCv.isConnected) lab.seen = true; else if (lab.seen) { stopLab(); return; } lab.t += dt; const W = 520, Hh = 230, g = lg; const noise = Math.min(1, lab.sig / 2600); const run = lab.run && lab.run.id === lab.id ? lab.run : null; if (run) { run.t += dt; if (run.t > 4.2) { lab.run = null; tested[lab.id] = true; sfx.reveal(); award('test:' + lab.id, 30, 'Telescope tested'); if (['compact', 'wide', 'precision'].every((k) => tested[k])) award('test:all', 60, 'Careful scientist: all three tested'); render(); } }
    const u = run ? run.t / 4.2 : (lab.t * 0.12) % 1; const inDip = Math.abs(u - 0.5) < 0.09; g.fillStyle = '#05070a'; g.fillRect(0, 0, W, Hh);
    // eyepiece
    g.save(); g.beginPath(); g.arc(112, 112, 96, 0, 7); g.clip(); g.fillStyle = '#080b10'; g.fillRect(0, 0, 224, 230); const blur = 20 + noise * 46; const gr = g.createRadialGradient(112, 112, 2, 112, 112, blur * 1.6); gr.addColorStop(0, `rgba(255,205,160,${inDip ? 0.82 : 1})`); gr.addColorStop(0.45, `rgba(240,110,60,${inDip ? 0.6 : 0.8})`); gr.addColorStop(1, 'rgba(240,110,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 224, 230);
    g.fillStyle = '#05070a'; g.beginPath(); g.arc(112 - 60 + u * 120, 118, 5, 0, 7); g.globalAlpha = Math.max(0.08, 1 - noise * 1.5); g.fill(); g.globalAlpha = 1; for (let i = 0; i < 260 * noise; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; g.fillRect(Math.random() * 224, Math.random() * 230, 2, 2); } g.restore(); g.strokeStyle = lab.col; g.lineWidth = 4; g.beginPath(); g.arc(112, 112, 96, 0, 7); g.stroke(); g.fillStyle = '#8d97a3'; g.font = '600 11px system-ui'; g.textAlign = 'center'; g.fillText('THROUGH THE TELESCOPE', 112, 224);
    // brightness trace
    const x0 = 240, w = 264, y0 = 30, h = 150; g.textAlign = 'left'; g.fillText('BRIGHTNESS IT RECORDS', x0, 18); g.strokeStyle = '#2a323c'; g.lineWidth = 1; g.strokeRect(x0, y0, w, h); g.strokeStyle = 'rgba(242,162,58,0.7)'; g.setLineDash([5, 5]); g.beginPath(); for (let i = 0; i <= 60; i++) { const q = i / 60; const d = Math.abs(q - 0.5) < 0.09 ? 46 * Math.min(1, (0.09 - Math.abs(q - 0.5)) / 0.02) : 0; i ? g.lineTo(x0 + q * w, y0 + 40 + d) : g.moveTo(x0 + q * w, y0 + 40 + d); } g.stroke(); g.setLineDash([]);
    const upto = run ? u : 1; g.fillStyle = lab.col; for (let i = 0; i < 70; i++) { const q = i / 70; if (q > upto) break; const d = Math.abs(q - 0.5) < 0.09 ? 46 * Math.min(1, (0.09 - Math.abs(q - 0.5)) / 0.02) : 0; const n = Math.sin(i * 12.9898 + lab.id.length * 7) * 43758.5453; const r = (n - Math.floor(n) - 0.5) * 2; g.beginPath(); g.arc(x0 + q * w, y0 + 40 + d + r * (lab.sig / 3300) * 46, 2.6, 0, 7); g.fill(); }
    if (run) { g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x0 + u * w, y0); g.lineTo(x0 + u * w, y0 + h); g.stroke(); } g.fillStyle = '#f2a23a'; g.font = '600 11px system-ui'; g.fillText('- - the real dip: 0.33 %', x0, y0 + h + 18); g.fillStyle = lab.col; g.fillText('● what this telescope measures', x0, y0 + h + 34); });
  const root = el('div', { class: 'station' });
  const show = (id) => { const m = makeInstrument(id); st.setModel(m, m.userData.height, 0.18); };
  function render() {
    root.innerHTML = ''; const p = PAYLOADS[focus]; const a = assessPayload(focus);
    const preview = Object.assign({}, state, { payload: focus }); const t = totals(preview); const sig = Math.sqrt(p.noise ** 2 + 40 ** 2);
    const cards = Object.values(PAYLOADS).map((q) => { const aq = assessPayload(q.id); return el('button', { type: 'button', class: 'card' + (q.id === focus ? ' focus' : '') + (q.id === state.payload ? ' chosen' : ''), style: { borderLeft: '5px solid ' + TCOL[q.id] }, 'aria-pressed': String(q.id === focus), onclick: () => { focus = q.id; sfx.select(); show(q.id); render(); } },
      el('div', { class: 'tele-row' }, teleIcon(q), el('div', { class: 'tele-main' }, el('div', { class: 'card-top' }, el('b', {}, q.name), el('span', { class: 'tag' }, q.short)), el('div', { class: 'card-desc' }, TELE[q.id].line),
        bar('Sharp eyes', Math.sqrt(120 / q.noise), '#6fa8c4'), bar('Weight', q.mass / 210, '#b98ad8'), bar('Power use', q.power / 240, '#6fbf8b'), bar('Cost', q.cost / 120, '#f2a23a'))),
      tested[q.id] ? el('div', { class: 'suit ' + aq.level }, aq.level === 'suitable' ? '● Tested: sees the dip' : aq.level === 'marginal' ? '◆ Tested: barely sees it' : '▲ Tested: cannot see it') : el('div', { class: 'suit' }, '▶ Not tested yet'), q.id === state.payload ? el('div', { class: 'chosen-flag' }, '✓ SELECTED') : null); });
    const table = el('table', { class: 'cmp' }, el('thead', {}, el('tr', {}, el('th', {}, ''), Object.values(PAYLOADS).map((q) => el('th', {}, q.short)))),
      el('tbody', {}, [['Aperture (cm)', 'aperture'], ['Mass (kg)', 'mass'], ['Power (W)', 'power'], ['Cost (M)', 'cost'], ['Data (GB/day)', 'dataRate'], ['Noise per point (ppm)', 'noise']].map(([l, k]) => el('tr', {}, el('th', {}, l), Object.values(PAYLOADS).map((q) => el('td', {}, String(q[k]))))),
        el('tr', {}, el('th', {}, 'One-dip signal / noise'), Object.values(PAYLOADS).map((q) => el('td', {}, assessPayload(q.id).snr.toFixed(1)))),
        el('tr', {}, el('th', {}, 'Needs'), Object.values(PAYLOADS).map((q) => el('td', {}, Object.keys(q.requires).length ? Object.entries(q.requires).map(([k, v]) => BUS[k].options[v].name).join('; ') : 'No special support')))));
    const pcv = el('canvas', { width: 320, height: 150, class: 'pred', role: 'img', 'aria-label': 'Predicted appearance of one dip with this instrument' });
    const left = el('section', { class: 'panel left' }, el('div', { class: 'label' }, 'Level 2 · Payload design'), el('h2', {}, 'Payload bench'),
      el('div', { class: 'why-box' }, el('b', {}, 'Why this matters'), el('span', {}, 'The star dims by only 0.33 %. Tap a telescope, run a test, and see which one can actually catch that dip without eating the budget.')),
      compare ? el('div', { class: 'scroll' }, table) : el('div', { class: 'cards scroll' }, cards),
      el('div', { class: 'row-btns' }, button(compare ? 'Show instrument cards' : 'Compare specifications', () => { compare = !compare; render(); }, 'ghost')));
    const verdict = a.level === 'suitable' ? ['good', '✔ It can see the dip clearly'] : a.level === 'marginal' ? ['warn', '◆ It can barely see the dip'] : ['bad', '✖ The dip is lost in the noise'];
    lab.sig = sig; lab.id = focus; lab.col = TCOL[focus];
    const right = el('section', { class: 'panel right' }, el('div', { class: 'label' }, 'Test bench · ' + p.short), el('h3', { style: { color: TCOL[focus] } }, p.name),
      labCv,
      lab.run && lab.run.id === focus ? el('div', { class: 'verdict run' }, 'Observing the star… watch for the dip') : tested[focus] ? el('div', { class: 'verdict ' + verdict[0] }, verdict[1]) : button('▶ Run a test observation', () => { lab.run = { id: focus, t: 0 }; sfx.select(); render(); }, 'primary pulse test-btn'),
      el('div', { class: 'chips' }, chip('⚖', p.mass + ' kg', '#b98ad8'), chip('⚡', p.power + ' W', '#6fbf8b'), chip('◉', p.cost + ' M', '#f2a23a'), chip('⌖', p.aperture + ' cm lens', '#6fa8c4')),
      meter('Budget used so far', t.cost, BUDGET, 'M', t.cost > BUDGET ? 'bad' : ''),
      tested[focus] ? el('p', { class: 'note' }, a.why) : el('p', { class: 'note' }, 'Run the test to watch this telescope try to catch the dip. Test all three for bonus points.'),
      el('button', { type: 'button', class: 'btn ghost small', onclick: () => { more = !more; render(); } }, more ? 'Hide the numbers' : 'Show the numbers'),
      more ? el('div', {}, el('div', { class: 'kvs' }, kv('Data produced', p.dataRate + ' GB / day'), kv('Fairing needed', p.fairing === 'S' ? 'Small or larger' : 'Medium or larger'), kv('Noise per measurement', `~${Math.round(sig)} ppm (with fine pointing)`), kv('One dip stands', a.snr.toFixed(1) + '× above noise')), pcv, el('p', { class: 'note' }, 'PREDICTION from the instrument noise model, not mission data. Limits: ' + p.limits + (Object.keys(p.requires).length ? ' Requires: ' + Object.entries(p.requires).map(([k, v]) => BUS[k].options[v].name).join(' and ') + '.' : ''))) : null,
      el('div', { class: 'row-btns' }, button('Leave bench', () => game.closeStation(), 'ghost'),
        button(state.payload === focus ? 'Keep ' + p.short : 'Select ' + p.short, async () => {
          if (a.level === 'unsuitable') { sfx.deny(); await modal('Instrument rejected', el('div', {}, el('p', {}, a.why), el('p', {}, 'Choose an instrument with lower noise.')), [{ label: 'Choose another', value: true, cls: 'primary' }]); return; }
          if (a.level === 'marginal') { sfx.deny(); const go = await modal('Afia: this instrument is marginal', el('div', {}, el('p', {}, a.why), el('p', {}, 'You may proceed, but the mission could end without a conclusion. Would you like to redesign?')), [{ label: 'Proceed at risk', value: true }, { label: 'Choose another', value: false, cls: 'primary' }]); if (!go) return; state.payloadWarned = true; }
          const changed = state.payload !== focus; state.payload = focus;
          if (changed) { for (const [k, v] of Object.entries(p.requires)) if (state.bus[k] && state.bus[k] !== v) toast(`${BUS[k].label}: the ${p.short} needs "${BUS[k].options[v].name}". Update it at the assembly terminal.`, 'alert', 7000); touchDesign(); }
          sfx.confirm(); award('payload:' + state.runs, a.level === 'suitable' ? 150 : 75, a.level === 'suitable' ? 'Suitable payload chosen' : 'Payload chosen'); if (stageName() === 'payload') setStage('spacecraft'); commit();
          if (changed) await studioBeat(st, 'Payload activation \u00B7 ' + p.short, ['Bench power applied. The instrument is drawing ' + p.power + ' W.', 'Detector cooling to its operating temperature.', 'Calibration lamp on. First light recorded on the detector.', 'Afia: "' + AFIA.accept + '"'], (u, s2) => { if (u > 0.76 && !s2._said) { s2._said = true; speak(AFIA.accept, 'scientist'); } if (u < 0.1) s2._said = false; s2.lamp.intensity = u > 0.5 && u < 0.8 ? 60 * (0.6 + 0.4 * Math.sin(u * 90)) : 6 * u; });
          if (isQuick() && !state.launch) { quickPlan(game); return; }
          toast(`${p.name} selected. Mission state updated.`, 'good'); game.closeStation();
        }, 'primary')));
    root.append(left, right, el('div', { class: 'studio-hint' }, 'Drag to rotate · scroll to zoom'));
    drawPrediction(pcv, sig);
  }
  show(focus); render(); openOverlay(root, 'station-overlay');
}

// Quick Mission: choose the orbit by what it is expected to return; the engineer fits the spacecraft.
function quickPlan(game) {
  const p = PAYLOADS[state.payload]; const list = plans(state.payload); const st = getStudio(); st.setCallouts([], null);
  const root = el('div', { class: 'station bottom' });
  const cards = list.map(({ orbit, fit }) => { const o = ORBITS[orbit];
    if (!fit) return el('div', { class: 'card orbit blocked' }, el('div', { class: 'card-top' }, el('b', {}, o.name), el('span', { class: 'tag' }, o.alt)), el('p', { class: 'card-desc' }, o.observe), el('div', { class: 'suit unsuitable' }, `\u25B2 No spacecraft within the ${BUDGET} M budget can carry the ${p.short} there.`));
    const strong = fit.covered >= 3 && fit.snr >= 7, ok = fit.covered >= 2 && fit.snr >= 5;
    return el('button', { type: 'button', class: 'card orbit', onclick: () => choose(orbit, fit) }, el('div', { class: 'card-top' }, el('b', {}, o.name), el('span', { class: 'tag' }, o.alt)), el('p', { class: 'card-desc' }, o.observe),
      el('div', { class: 'big-stat' }, el('b', {}, `${fit.covered} of ${fit.possible}`), ' dips expected in your record'),
      el('div', { class: 'card-stats' }, kv('Record coverage', Math.round(fit.coverage * 100) + ' %'), kv('Signal above noise', fit.snr.toFixed(0) + '\u00D7'), kv('Spacecraft', fit.totals.mass + ' kg'), kv('Rocket', VEHICLES[fit.vehicle].name), kv('Total cost', `${fit.cost} of ${BUDGET} M`), kv('Launch margin', fit.margin + ' %')),
      el('div', { class: 'suit ' + (strong ? 'suitable' : ok ? 'marginal' : 'unsuitable') }, strong ? '\u25CF Strong plan: enough repeats, well above the noise' : ok ? '\u25C6 Workable: enough to show a repeat, with little to spare' : '\u25B2 Risky: the record may be inconclusive')); });
  root.append(el('section', { class: 'panel full' }, el('div', { class: 'label' }, 'Quick Mission \u00B7 Where should it observe?'), el('h2', {}, `Choose the orbit for the ${p.name}`),
    el('p', { class: 'lead' }, 'Each orbit is shown by what it should return. The predictions come from flying the mission in simulation with the spacecraft Lady Paula would fit. In flight, faults and your own flying will change the result.'), el('div', { class: 'cards three' }, cards),
    el('div', { class: 'row-btns' }, button('Choose a different telescope', () => { closeOverlay(); openPayloadBench(game); }, 'ghost'))));
  async function choose(orbit, fit) {
    Object.assign(state.bus, fit.bus); state.vehicle = fit.vehicle; state.plannedOrbit = orbit; state.validated = true; setStage('launch'); commit(); sfx.confirm(); award('plan:' + state.runs, 150, 'Mission plan agreed'); speak(QUICK.fitted, 'engineer');
    const m = makeSpacecraft(state); st.setModel(m, m.userData.height, 0.3); closeOverlay();
    const go = await modal('Lady Paula: your spacecraft', el('div', {}, el('p', {}, '"' + QUICK.fitted + '"'), el('ul', { class: 'issues big' }, explainFit(state).map(([k, v]) => el('li', {}, el('b', {}, k + '. '), v))), el('p', { class: 'note' }, `Planned orbit: ${ORBITS[orbit].name}. Engineering review: passed.`)), [{ label: 'Change something', value: false }, { label: 'Go to launch', value: true, cls: 'primary' }], 'wide');
    if (go) game.closeStation(); else openAssembly(game);
  }
  openOverlay(root, 'station-overlay');
}

// ---------------- Level 3: spacecraft and launch vehicle ----------------
export function openAssembly(game) {
  const st = getStudio(); setScene(st); setAmbience('bay'); st.auto = true;
  let tab = 'bus'; const root = el('div', { class: 'station' }); const layer = el('div', { class: 'callouts' });
  function showModel() {
    if (tab === 'vehicle' && state.vehicle) { const r = makeRocket(state.vehicle, PAYLOADS[state.payload].fairing); st.setModel(r, r.userData.H, 0); st.setCallouts([{ label: 'Fairing: spacecraft rides here', pos: new THREE.Vector3(r.userData.payloadSpace, r.userData.payloadY + 2, 0) }, { label: 'Second stage', pos: new THREE.Vector3(r.userData.R, r.userData.H * 0.62, 0) }, { label: 'First stage', pos: new THREE.Vector3(r.userData.R, r.userData.H * 0.3, 0) }], layer); return; }
    const m = makeSpacecraft(state); st.setModel(m, m.userData.height, 0.3);
    const names = { payload: 'Scientific payload', power: 'Power', comms: 'Communications', storage: 'Data storage', thermal: 'Thermal control', adcs: 'Attitude control', structure: 'Structure' };
    st.setCallouts(Object.entries(m.userData.anchors).map(([k, pos]) => ({ label: names[k], pos })), layer);
  }
  function render() {
    root.innerHTML = ''; const t = totals(state); const p = t.payload; const live = validateDesign(state);
    const optStats = (key, o) => { const s = [kv('Mass', o.mass + ' kg'), kv('Power', (key === 'power' ? '+' + o.gen : o.power) + ' W'), kv('Cost', o.cost + ' M')];
      if (key === 'comms') s.push(kv('Downlink', o.rate + ' GB / contact-hour'), kv('Deep space', o.deepSpace ? 'Yes' : 'No')); if (key === 'storage') s.push(kv('Holds', `${o.cap} GB (${(o.cap / t.dataRate).toFixed(0)} days of data)`)); if (key === 'adcs') s.push(kv('Pointing noise', o.jitter + ' ppm')); if (key === 'thermal') s.push(kv('Detector stability', o.power ? 'Held steady' : 'Follows environment')); return s; };
    const groups = BUS_KEYS.map((key) => { const grp = BUS[key]; const need = p.requires[key];
      return el('fieldset', { class: 'group' }, el('legend', {}, grp.label, state.bus[key] ? el('span', { class: 'ok' }, ' ✓') : el('span', { class: 'todo' }, ' ○ choose one')), el('p', { class: 'note' }, grp.blurb + (need ? ` The ${p.short} requires "${grp.options[need].name}".` : '')),
        el('div', { class: 'opts' }, Object.entries(grp.options).map(([id, o]) => el('button', { type: 'button', class: 'opt' + (state.bus[key] === id ? ' chosen' : ''), 'aria-pressed': String(state.bus[key] === id), onclick: () => { state.bus[key] = id; sfx.select(); touchDesign(); showModel(); render(); } }, el('b', {}, (state.bus[key] === id ? '✓ ' : '') + o.name), el('div', { class: 'card-stats' }, optStats(key, o)))))); });
    const vehicles = Object.values(VEHICLES).map((v) => { const fits = t.mass <= v.capacity; const fair = FAIRING_RANK[p.fairing] <= FAIRING_RANK[v.fairing];
      return el('button', { type: 'button', class: 'card' + (state.vehicle === v.id ? ' chosen focus' : ''), 'aria-pressed': String(state.vehicle === v.id), onclick: () => { state.vehicle = v.id; sfx.select(); touchDesign(); showModel(); render(); } },
        el('div', { class: 'card-top' }, el('b', {}, v.name), el('span', { class: 'tag' }, v.klass)), el('div', { class: 'card-desc' }, v.note),
        el('div', { class: 'card-stats' }, kv('Capacity', v.capacity + ' kg'), kv('Cost', v.cost + ' M'), kv('Fairing', { S: 'Small', M: 'Medium', L: 'Large' }[v.fairing]), kv('Margin with this design', Math.round((v.capacity - t.mass) / v.capacity * 100) + ' %')),
        el('div', { class: 'suit ' + (fits && fair ? 'suitable' : 'unsuitable') }, fits && fair ? '● Can carry this spacecraft' : !fits ? '▲ Spacecraft is too heavy' : '▲ Telescope does not fit the fairing'), state.vehicle === v.id ? el('div', { class: 'chosen-flag' }, '✓ SELECTED') : null); });
    const left = el('section', { class: 'panel left' }, el('div', { class: 'label' }, 'Level 3 · Spacecraft and launch'), el('h2', {}, 'Assembly terminal'),
      el('div', { class: 'tabs', role: 'tablist' }, el('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === 'bus'), class: tab === 'bus' ? 'on' : '', onclick: () => { tab = 'bus'; sfx.click(); showModel(); render(); } }, '1 · Subsystems'), el('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === 'vehicle'), class: tab === 'vehicle' ? 'on' : '', onclick: () => { tab = 'vehicle'; sfx.click(); showModel(); render(); } }, '2 · Launch vehicle')),
      el('div', { class: 'scroll' }, tab === 'bus' ? [el('p', { class: 'lead' }, `Build a spacecraft around the ${p.name}. Choose one option for each of the five subsystems. The structure (${STRUCTURE.baseMass} kg plus 25 % of everything it carries) is sized automatically.`), groups] : [el('p', { class: 'lead' }, 'Choose the rocket. It must lift the spacecraft mass and its fairing must fit the telescope. Unused capacity becomes launch margin, which opens higher orbits.'), el('div', { class: 'cards' }, vehicles), el('p', { class: 'note' }, 'Vehicles and figures are fictional, simplified game parameters.')]));
    const stat = (cond, warn) => (cond ? 'bad' : warn ? 'warn' : 'good');
    const checks = live.issues.length ? el('ul', { class: 'issues' }, live.issues.map((i) => el('li', {}, el('b', {}, '▲ ' + i.area + ': '), i.msg))) : el('div', { class: 'assess suitable' }, el('b', {}, '● No open issues.'), ' Request the engineering review to confirm.');
    const right = el('section', { class: 'panel right' }, el('div', { class: 'label' }, 'Live engineering readout'), el('h3', {}, p.name + ' spacecraft'),
      meter('Launch mass' + (t.vehicle ? ' vs ' + t.vehicle.name + ' capacity' : ' (no vehicle yet)'), t.mass, t.vehicle ? t.vehicle.capacity : Math.max(t.mass, 320), 'kg', t.vehicle ? stat(t.mass > t.vehicle.capacity, t.launchMargin < 0.1) : ''),
      meter('Power load vs generation', t.load, t.gen || t.load, 'W', t.gen ? stat(t.powerMargin < 0.1, t.powerMargin < 0.2) : ''),
      meter('Budget', t.spent, BUDGET, 'M', stat(t.spent > BUDGET, t.remaining < 20)),
      el('div', { class: 'kvs' }, kv('Structure mass', t.structure + ' kg'), kv('Power margin', t.powerMargin == null ? 'no arrays' : Math.round(t.powerMargin * 100) + ' % (review needs 10 %)'), kv('Launch margin', t.launchMargin == null ? 'no vehicle' : Math.round(t.launchMargin * 100) + ' %'), kv('Recorder holds', t.storage ? (t.storage / t.dataRate).toFixed(0) + ' days of data' : 'not chosen'), kv('Noise per measurement', state.bus.adcs ? '~' + Math.round(t.sigma) + ' ppm' : 'choose attitude control'), kv('One dip stands', state.bus.adcs ? dipSNR(t.sigma).toFixed(1) + '× above noise' : '-'), kv('Budget remaining', t.remaining + ' M')),
      el('div', { class: 'label' }, 'Open issues'), checks,
      el('div', { class: 'row-btns' }, button('Leave terminal', () => game.closeStation(), 'ghost'),
        button(state.validated ? 'Review passed ✓' : 'Request engineering review', async () => {
          const v = validateDesign(state);
          if (!v.ok) { state.validationFailures++; commit(); sfx.deny(); speak(ENG.reviewFail, 'engineer'); await modal('Lady Paula: the design does not close', el('div', {}, el('p', {}, `I found ${v.issues.length} ${v.issues.length === 1 ? 'problem' : 'problems'}. Nothing is lost; change the design and ask again.`), el('ul', { class: 'issues big' }, v.issues.map((i) => el('li', {}, el('b', {}, i.area + '. '), i.msg, el('div', { class: 'fix' }, 'What to do: ' + i.fix))))), [{ label: 'Back to the design', value: true, cls: 'primary' }], 'wide'); return; }
          state.validated = true; if (stageName() === 'spacecraft') setStage('launch'); commit(); sfx.confirm(); speak(ENG.reviewPass, 'engineer'); award('review:' + state.runs, state.validationFailures ? 100 : 250, state.validationFailures ? 'Engineering review passed' : 'Review passed first time');
          await modal('Engineering review passed', el('div', {}, el('p', {}, `Lady Paula: "Mass ${v.totals.mass} kg on ${v.totals.vehicle.name} with ${Math.round(v.totals.launchMargin * 100)} % margin. Power margin ${Math.round(v.totals.powerMargin * 100)} %. ${v.totals.remaining} M of budget unspent. She is cleared for launch."`), el('p', {}, v.totals.launchMargin < 0.1 ? 'Note: launch margin is below 10 %, so only low Earth orbit will be reachable.' : v.totals.launchMargin < 0.25 ? 'Note: this margin reaches low or high elliptical orbit, but not Sun-Earth L2 (needs 25 %).' : 'This margin can reach any of the three orbits.')), [{ label: 'Proceed to Mission Control', value: true, cls: 'primary' }]);
          const m = makeSpacecraft(state); st.setModel(m, m.userData.height, 0.3); const kids = m.children.slice(); kids.forEach((k) => (k.visible = false)); let n0 = 0;
          await studioBeat(st, 'Spacecraft integration', ['Structure and insulation blankets assembled.', `${p.name} mated to the top deck.`, 'Power, communications and data systems fitted and connected.', 'Thermal and attitude control installed. Alignment checked.', `Integration complete: ${v.totals.mass} kg, cleared for transport to the pad.`], (u) => { const n = Math.min(kids.length, Math.floor(u * kids.length * 1.3)); for (; n0 < n; n0++) { kids[n0].visible = true; if (n0 % 3 === 0) sfx.switch(); } });
          game.closeStation();
        }, 'primary')));
    root.append(left, right, layer, el('div', { class: 'studio-hint' }, 'Drag to rotate · scroll to zoom'));
  }
  showModel(); render(); openOverlay(root, 'station-overlay');
}
