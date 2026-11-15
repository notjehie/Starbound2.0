// The astronaut's seat: a capsule interior drawn over the outside view. The windows are
// open holes, so the sky, the ground falling away and the Earth are the real launch scene.
// Switches and buttons on the panel are pressed directly, pilot's-eye view.
import * as THREE from 'three';
import { box, cyl, std, canvasTex } from './builders.js';

export const PILOT_STEPS = [
  { id: 'suit', ctl: 'SUIT O2', label: 'Suit oxygen on, visor closed', why: 'You breathe from the suit if the cabin loses pressure.' },
  { id: 'power', ctl: 'INT POWER', label: 'Capsule to internal power', why: 'The capsule must run on its own batteries before the ground cables drop away.' },
  { id: 'guid', ctl: 'GUIDANCE', label: 'Align the guidance platform', why: 'The flight computer needs to know which way is up, and it needs steady power first.' },
  { id: 'comms', ctl: 'COMMS', label: 'Voice check with Mission Control', why: 'Nobody launches without a working link to the ground.' },
  { id: 'abort', ctl: 'ABORT ARM', label: 'Arm the launch escape system', why: 'The escape rocket is armed last, when everything else is ready.' },
];
const LAYOUT = ['comms', 'suit', 'guid', 'abort', 'power']; // deliberately not in checklist order
const PW = 2.5, PH = 0.84, CW = 1280, CH = 430;
const px = (x) => (x / PW + 0.5) * CW, py = (y) => (0.5 - y / PH) * CH;

export function makeCockpit() {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, 1, 0.02, 20);
  scene.add(new THREE.AmbientLight(0xa8a290, 0.75)); const cabin = new THREE.PointLight(0xffd9a8, 2.6, 7, 1.4); cabin.position.set(0, 0.75, -0.1); scene.add(cabin);
  const winL = new THREE.DirectionalLight(0xdfeaff, 1.4); winL.position.set(0.4, 1, -1); scene.add(winL);
  const hullT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#77756a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a483f'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); g.strokeRect(4, 4, w / 2 - 4, h / 2 - 4); g.fillStyle = '#a9a698'; for (let i = 0; i < 8; i++) { for (const [x, y] of [[14 + i * 32, 12], [14 + i * 32, h - 12], [12, 14 + i * 32], [w - 12, 14 + i * 32]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } } }, [2, 2]);
  const hull = new THREE.MeshStandardMaterial({ map: hullT, roughness: 0.75, metalness: 0.35 }); const dark = std(0x16191d, 0.6, 0.4), metal = std(0x8f969d, 0.4, 0.7), pad = std(0x4a4034, 0.95);
  const A = (m) => { scene.add(m); return m; };
  // shell with three window openings
  A(box(0.1, 2.6, 2.6, hull, -1.78, 0, -0.3)); A(box(0.1, 2.6, 2.6, hull, 1.78, 0, -0.3)); A(box(3.7, 0.1, 2.6, hull, 0, 1.02, -0.3)); A(box(3.7, 0.1, 2.6, dark, 0, -1.3, -0.3));
  A(box(3.7, 0.22, 0.1, hull, 0, 0.94, -1.4)); A(box(3.7, 0.14, 0.12, hull, 0, -0.2, -1.4)); A(box(3.7, 1.1, 0.1, dark, 0, -0.8, -1.42));
  for (const x of [-1.62, 1.62]) A(box(0.3, 1.2, 0.1, hull, x, 0.37, -1.4)); for (const x of [-0.53, 0.53]) A(box(0.08, 1.1, 0.1, hull, x, 0.37, -1.39));
  for (const x of [-0.53, 0.53, -1.47, 1.47]) for (const y of [-0.08, 0.3, 0.68]) A(cyl(0.014, 0.014, 0.02, metal, x, y, -1.33, 8)).rotation.x = Math.PI / 2;
  A(box(2.8, 0.06, 0.46, dark, 0, -0.2, -1.17)); A(box(2.8, 0.03, 0.03, pad, 0, -0.17, -0.95));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.15), new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.045, depthWrite: false })); glass.position.set(0, 0.37, -1.43); scene.add(glass);
  // overhead and side equipment
  A(box(1.6, 0.05, 0.7, dark, 0, 0.95, -0.85)); const ohLamps = []; for (let i = 0; i < 10; i++) { const l = box(0.05, 0.02, 0.05, new THREE.MeshBasicMaterial({ color: 0x1f3a2a }), -0.63 + i * 0.14, 0.92, -1.05); scene.add(l); ohLamps.push(l); A(box(0.03, 0.05, 0.03, metal, -0.63 + i * 0.14, 0.9, -0.8)); }
  for (const sx of [-1, 1]) { A(box(0.06, 0.9, 1.3, dark, sx * 1.72, -0.25, -0.75)); for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) A(box(0.02, 0.05, 0.035, c % 3 ? metal : std(0xb5791f, 0.5), sx * 1.68, 0.05 - r * 0.2, -1.2 + c * 0.14));
    const b = cyl(0.07, 0.07, 0.6, sx < 0 ? std(0x2f5d8a, 0.4, 0.5) : std(0x9aa1a8, 0.4, 0.6), sx * 1.62, -0.85, -0.6, 12); b.rotation.x = Math.PI / 2; A(b); const hose = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 20, Math.PI), std(0xd8d3c6, 0.8)); hose.position.set(sx * 1.62, -0.55, -0.9); hose.rotation.y = Math.PI / 2; A(hose);
    A(box(0.05, 0.25, 0.25, pad, sx * 1.7, 0.55, -0.5)); }
  // dense equipment panels on every wall: dials, switch rows, breakers and placards
  const busy = (seed, W = 512, Hh = 512) => canvasTex(W, Hh, (g, w, h) => { let sd = seed; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }; g.fillStyle = '#8d897a'; g.fillRect(0, 0, w, h);
    const cell = 128; for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { g.fillStyle = r() < 0.5 ? '#9a9686' : '#7f7b6d'; g.fillRect(x + 4, y + 4, cell - 8, cell - 8); g.strokeStyle = '#4c493f'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, cell - 8, cell - 8); g.fillStyle = '#3a382f'; for (const [a, b] of [[10, 10], [cell - 10, 10], [10, cell - 10], [cell - 10, cell - 10]]) { g.beginPath(); g.arc(x + a, y + b, 2.5, 0, 7); g.fill(); }
      const k = r();
      if (k < 0.34) { const n = k < 0.17 ? 1 : 2; for (let i = 0; i < n; i++) { const cx = x + (n === 1 ? 64 : 36 + i * 56), cy = y + 60, R = n === 1 ? 40 : 24; g.fillStyle = '#0d0e0f'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.strokeStyle = '#c9c6b8'; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#e8e6da'; g.lineWidth = 1.5; for (let t = 0; t < 12; t++) { const a = 2.3 + t * 0.44; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); g.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94); g.stroke(); } g.strokeStyle = r() < 0.3 ? '#e5564b' : '#f1efe4'; g.lineWidth = 2.5; const a = 2.3 + r() * 4.8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7); g.stroke(); } g.fillStyle = '#1b1a16'; g.fillRect(x + 30, y + 104, 68, 9); }
      else if (k < 0.72) { for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) { const sx = x + 20 + i * 22, sy = y + 30 + row * 50; g.fillStyle = '#1b1a16'; g.fillRect(sx - 7, sy - 4, 14, 20); g.fillStyle = '#d9d6c9'; g.fillRect(sx - 2.5, sy + (r() < 0.5 ? -8 : 4), 5, 13); g.fillStyle = '#26251f'; g.fillRect(sx - 8, sy + 22, 16, 4); if (r() < 0.25) { g.fillStyle = r() < 0.5 ? '#6fbf8b' : '#f2a23a'; g.beginPath(); g.arc(sx, sy - 12, 3, 0, 7); g.fill(); } } }
      else if (k < 0.9) { for (let row = 0; row < 5; row++) for (let i = 0; i < 6; i++) { g.fillStyle = '#17160f'; g.beginPath(); g.arc(x + 20 + i * 18, y + 22 + row * 19, 5.5, 0, 7); g.fill(); g.fillStyle = r() < 0.08 ? '#f1efe4' : '#3d3b33'; g.beginPath(); g.arc(x + 20 + i * 18, y + 22 + row * 19, 2.5, 0, 7); g.fill(); } }
      else { g.fillStyle = '#b5261e'; g.fillRect(x + 34, y + 30, 60, 44); g.fillStyle = '#f1efe4'; g.fillRect(x + 44, y + 40, 40, 6); g.fillRect(x + 44, y + 52, 26, 6); g.fillStyle = '#d8a520'; for (let i = 0; i < 6; i++) g.fillRect(x + 20 + i * 16, y + 92, 8, 14); } } });
  const plate = (w, h, tex, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.2 })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); return m; };
  plate(2.5, 2.2, busy(11), -1.725, -0.1, -0.3, 0, Math.PI / 2); plate(2.5, 2.2, busy(29), 1.725, -0.1, -0.3, 0, -Math.PI / 2); plate(3.5, 2.4, busy(47, 1024, 512), 0, 0.965, -0.3, Math.PI / 2, 0); plate(3.6, 0.5, busy(63, 1024, 128), 0, -0.52, -1.36, 0, 0);
  // a small card clipped to the left strut
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshBasicMaterial({ map: canvasTex(128, 180, (g, w, h) => { g.fillStyle = '#f1efe8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b5261e'; g.fillRect(0, 0, w, 22); g.fillStyle = '#fff'; g.font = '700 13px system-ui'; g.fillText('ASCENT', 8, 16); g.fillStyle = '#222'; g.font = '11px system-ui'; ['1 SUIT O2', '2 INT POWER', '3 GUIDANCE', '4 COMMS', '5 ABORT ARM', '6 LAUNCH', '', 'STEER: CORRIDOR', 'MECO: STAGE', 'ORBIT: DEPLOY'].forEach((t, i) => g.fillText(t, 8, 40 + i * 14)); }) })); card.position.set(-1.35, 0.05, -1.3); card.rotation.y = 0.5; scene.add(card);

  // instrument panel
  const panel = new THREE.Group(); panel.position.set(0, -0.64, -1.0); panel.rotation.x = -0.42; scene.add(panel);
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  panel.add(box(PW + 0.08, PH + 0.08, 0.06, dark, 0, 0, -0.035)); const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); panel.add(face);
  const hits = []; const hitBox = (id, x, y, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, 0.05); m.userData.id = id; panel.add(m); hits.push(m); };
  const SY = -0.2; const sw = {};
  LAYOUT.forEach((id, i) => { const x = -1.05 + i * 0.25; panel.add(box(0.1, 0.12, 0.03, metal, x, SY, 0.015)); const piv = new THREE.Group(); piv.position.set(x, SY, 0.03); const lever = cyl(0.014, 0.02, 0.1, std(0xdfe2e4, 0.3, 0.8), 0, 0, 0.05, 10); lever.rotation.x = Math.PI / 2; piv.add(lever); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), std(0xdfe2e4, 0.3, 0.8)); tip.position.z = 0.1; piv.add(tip); piv.rotation.x = 0.55; panel.add(piv); sw[id] = { piv, x, on: false }; hitBox(id, x, SY, 0.24, 0.3); });
  const mkBtn = (id, x, col, round) => { const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.1, roughness: 0.4 }); const base = round ? cyl(0.1, 0.1, 0.03, dark, x, SY, 0.015, 24) : box(0.2, 0.15, 0.03, dark, x, SY, 0.015); if (round) base.rotation.x = Math.PI / 2; const cap = round ? cyl(0.075, 0.075, 0.05, mat, x, SY, 0.05, 24) : box(0.16, 0.11, 0.05, mat, x, SY, 0.05); if (round) cap.rotation.x = Math.PI / 2; panel.add(base, cap); hitBox(id, x, SY, 0.3, 0.32); return { cap, mat, z: 0.05, push: 0 }; };
  const btn = { launch: mkBtn('launch', 0.36, 0xd8271c, true), stage: mkBtn('stage', 0.72, 0xe09a1e, false), deploy: mkBtn('deploy', 1.04, 0x3d9a5f, false) };
  const guard = box(0.24, 0.24, 0.012, new THREE.MeshStandardMaterial({ color: 0xf2c230, transparent: true, opacity: 0.55, roughness: 0.3 }), 0, -0.12, 0); const gp = new THREE.Group(); gp.position.set(0.36, SY + 0.12, 0.09); gp.add(guard); panel.add(gp);
  // hand controller
  const stick = new THREE.Group(); stick.position.set(0.0, -1.08, -0.72); stick.add(cyl(0.022, 0.03, 0.34, dark, 0, 0.17, 0, 10), cyl(0.04, 0.035, 0.12, std(0x23282e, 0.9), 0, 0.36, 0, 12)); scene.add(stick); A(cyl(0.09, 0.11, 0.06, dark, 0, -1.08, -0.72, 16));
  // the pilot's knees, so there is a body in the seat
  for (const sx of [-1, 1]) { const k = cyl(0.11, 0.13, 0.7, std(0xd8731f, 0.85), sx * 0.26, -1.12, -0.42, 12); k.rotation.x = Math.PI / 2 - 0.25; A(k); }

  const ray = new THREE.Raycaster(); let drawT = 0, tt = 0, look = { yaw: 0, pitch: -0.4 };
  function draw(d) {
    g.fillStyle = '#8d897a'; g.fillRect(0, 0, CW, CH); g.strokeStyle = '#4c493f'; g.lineWidth = 3; g.strokeRect(6, 6, CW - 12, CH - 12); g.fillStyle = '#7f7b6d'; g.fillRect(14, 244, CW - 28, CH - 258); g.strokeRect(14, 244, CW - 28, CH - 258); g.fillStyle = '#3a382f'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(22 + i * 82.4, 14, 3, 0, 7); g.arc(22 + i * 82.4, CH - 14, 3, 0, 7); g.fill(); }
    const boxed = (x, y, w, h, title) => { g.fillStyle = '#07090c'; g.fillRect(x, y, w, h); g.strokeStyle = '#39424d'; g.strokeRect(x, y, w, h); g.fillStyle = '#8d97a3'; g.font = '600 15px system-ui'; g.textAlign = 'left'; g.fillText(title, x + 10, y + 20); };
    const mono = (t, x, y, s = 40, c = '#f2a23a') => { g.fillStyle = c; g.font = `600 ${s}px ui-monospace, monospace`; g.fillText(t, x, y); };
    const dial = (cx, cy, R, title, frac, val, unit, col = '#f1efe4') => { g.fillStyle = '#0d0e0f'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.strokeStyle = '#c9c6b8'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#e8e6da'; for (let i = 0; i <= 20; i++) { const a = 2.36 + i * 0.236; g.lineWidth = i % 5 ? 1.5 : 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * (i % 5 ? 0.84 : 0.76), cy + Math.sin(a) * R * (i % 5 ? 0.84 : 0.76)); g.lineTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93); g.stroke(); }
      g.fillStyle = '#b9b6a8'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.fillText(title, cx, cy - R * 0.36); g.fillStyle = col; g.font = '600 20px ui-monospace, monospace'; g.fillText(val, cx, cy + R * 0.52); g.fillStyle = '#8d897a'; g.font = '600 11px system-ui'; g.fillText(unit, cx, cy + R * 0.74);
      const a = 2.36 + Math.max(0, Math.min(1, frac)) * 4.72; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); g.lineTo(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72); g.stroke(); g.fillStyle = '#c9c6b8'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); g.textAlign = 'left'; };
    boxed(24, 18, 250, 66, 'EVENT TIMER'); mono(d.clock, 150, 72, 38);
    boxed(290, 18, 220, 66, 'CABIN'); [['O2', 0.86, '#6fbf8b'], ['BATT', d.live ? 0.92 : 0.2, '#6fbf8b'], ['PRESS', 0.74, '#6fa8c4']].forEach(([n, v, c], i) => { g.fillStyle = '#8d97a3'; g.font = '600 11px system-ui'; g.fillText(n, 300 + i * 70, 52); g.fillStyle = '#1b222a'; g.fillRect(300 + i * 70, 58, 56, 12); g.fillStyle = c; g.fillRect(300 + i * 70, 58, 56 * v, 12); });
    const an = parseFloat(d.alt) || 0, vn = parseFloat(String(d.vel).replace(/[^0-9.]/g, '')) || 0;
    dial(100, 162, 70, 'ALTITUDE', an / 200, d.alt, 'KM'); dial(267, 162, 70, 'VELOCITY', vn / 8000, d.vel, 'M / S'); dial(434, 162, 70, 'G LOAD', d.g / 5, d.g.toFixed(1), 'G', d.g > 3.5 ? '#e5564b' : '#6fbf8b');
    // attitude ball
    const bx = 640, by = 126, R = 100; g.save(); g.beginPath(); g.arc(bx, by, R, 0, 7); g.clip(); g.translate(bx, by); g.rotate(-d.roll * 0.6); const off = (d.pitch - Math.PI / 4) / (Math.PI / 2) * R * 1.8; g.fillStyle = '#2f6fb3'; g.fillRect(-R * 2, -R * 3 + off, R * 4, R * 3); g.fillStyle = '#6b4a2b'; g.fillRect(-R * 2, off, R * 4, R * 3); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-R * 2, off); g.lineTo(R * 2, off); g.stroke(); for (let i = -3; i <= 3; i++) { if (!i) continue; g.beginPath(); g.moveTo(-18, off + i * 26); g.lineTo(18, off + i * 26); g.stroke(); } g.restore();
    g.strokeStyle = '#f2a23a'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx - 46, by); g.lineTo(bx - 14, by); g.lineTo(bx, by + 12); g.lineTo(bx + 14, by); g.lineTo(bx + 46, by); g.stroke(); g.strokeStyle = '#c9c6b8'; g.lineWidth = 9; g.beginPath(); g.arc(bx, by, R + 3, 0, 7); g.stroke(); g.strokeStyle = '#4c493f'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, R + 9, 0, 7); g.stroke();
    // steering corridor
    boxed(770, 20, 486, 86, d.steering ? 'STEERING: KEEP THE MARKER IN THE GREEN' : 'STEERING CORRIDOR'); g.fillStyle = '#141a20'; g.fillRect(790, 54, 446, 34); g.fillStyle = 'rgba(111,191,139,0.35)'; g.fillRect(790 + 223 - d.band * 223, 54, d.band * 446, 34); if (d.steering) { g.fillStyle = Math.abs(d.steerX) <= d.band ? '#6fbf8b' : '#e5564b'; g.fillRect(790 + 223 + d.steerX * 223 - 6, 50, 12, 42); }
    // stage lamps
    boxed(770, 118, 486, 114, 'FLIGHT EVENTS'); [['ENGINES', d.lamps[0]], ['STAGE 2', d.lamps[1]], ['FAIRING', d.lamps[2]], ['ORBIT', d.lamps[3]]].forEach(([n, on], i) => { const x = 790 + i * 116; g.fillStyle = on ? '#6fbf8b' : '#1f2a24'; g.fillRect(x, 150, 100, 40); g.fillStyle = on ? '#07090c' : '#5a6570'; g.font = '700 15px system-ui'; g.textAlign = 'center'; g.fillText(n, x + 50, 176); }); g.textAlign = 'left'; g.fillStyle = '#c3cad1'; g.font = '600 17px system-ui'; g.fillText(d.msg.slice(0, 52), 790, 220);
    // labels and lamps for the physical controls
    g.textAlign = 'center'; const blink = Math.sin(tt * 7) > 0;
    for (const id of LAYOUT) { const s = sw[id], st = PILOT_STEPS.find((q) => q.id === id), cx = px(s.x); const next = d.next === id; g.fillStyle = s.on ? '#6fbf8b' : next && blink ? '#f2a23a' : '#26303a'; g.beginPath(); g.arc(cx, py(SY) - 62, 11, 0, 7); g.fill(); g.fillStyle = '#17160f'; g.fillRect(cx - 62, py(SY) + 64, 124, 24); g.fillStyle = next ? '#f2a23a' : '#e8e6da'; g.font = '700 16px system-ui'; g.fillText(st.ctl, cx, py(SY) + 82); }
    const lab = (x, t, on) => { g.fillStyle = '#17160f'; g.fillRect(px(x) - 52, py(SY) + 62, 104, 26); g.fillStyle = on ? (blink ? '#ffffff' : '#f2a23a') : '#e8e6da'; g.font = '700 19px system-ui'; g.fillText(t, px(x), py(SY) + 82); };
    lab(0.36, 'LAUNCH', d.next === 'launch'); lab(0.72, 'STAGE', d.next === 'stage'); lab(1.04, 'DEPLOY', d.next === 'deploy'); g.textAlign = 'left'; tex.needsUpdate = true;
  }
  return {
    scene, camera, look,
    set(id, on) { if (sw[id]) sw[id].on = on; },
    press(nx, ny) { ray.setFromCamera(new THREE.Vector2(nx, ny), camera); const h = ray.intersectObjects(hits, false)[0]; if (!h) return null; const b = btn[h.object.userData.id]; if (b) b.push = 1; return h.object.userData.id; },
    update(dt, d) {
      tt += dt; const asp = camera.aspect || 1.5; const fov = Math.min(104, Math.max(62, 2 * Math.atan(Math.tan(0.9) / asp) * 180 / Math.PI)); if (Math.abs(fov - camera.fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
      for (const id of LAYOUT) { const s = sw[id]; s.piv.rotation.x += ((s.on ? -0.55 : 0.55) - s.piv.rotation.x) * Math.min(1, dt * 14); }
      for (const [id, b] of Object.entries(btn)) { b.push = Math.max(0, b.push - dt * 4); b.cap.position.z = b.z - b.push * 0.025; b.mat.emissiveIntensity = d.next === id ? 0.9 + Math.sin(tt * 7) * 0.6 : 0.08; }
      gp.rotation.x += ((d.guardUp ? -1.9 : 0) - gp.rotation.x) * Math.min(1, dt * 8);
      stick.rotation.z = -d.steerIn * 0.3; ohLamps.forEach((l, i) => l.material.color.setHex(d.live ? ((i * 7 + Math.floor(tt * 2)) % 9 === 0 ? 0xf2a23a : 0x7dffb0) : 0x1f3a2a));
      const sh = d.shake || 0; camera.position.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh - d.gPush * 0.03, d.gPush * 0.05); camera.rotation.set(look.pitch, look.yaw, (Math.random() - 0.5) * sh * 0.4, 'YXZ'); cabin.intensity = 2.4 + (d.glow || 0) * 1.5;
      drawT -= dt; if (drawT <= 0) { drawT = 0.09; draw(d); }
    },
  };
}
