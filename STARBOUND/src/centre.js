// Level 1 hub: the explorable space centre. First-person movement, collision,
// doors, crew, working screens and the stations that open Levels 2 to 5.
import * as THREE from 'three';
import { state, settings } from './state.js';
import { M, box, cyl, std, makeScreen, paintPanel, makeCharacter, makeInstrument, makeSpacecraft, makeRocket, canvasTex, disposeTree } from './builders.js';
import { moveVector, takeLook, takeZoom, takeJump, input } from './input.js';
import { sfx, setAmbience, announce } from './audio.js';
import { totals } from './engineering.js';
import { PAYLOADS, VEHICLES, BUDGET } from './catalog.js';
import { PA } from './lines.js';
import { inDialogue } from './ui.js';
import { DEFAULT_AVATAR } from './builders.js';
import { engine, applyEnv } from './engine.js';
import { dressCentre } from './decor.js';

const H = 3.4, T = 0.3, EYE = 1.66, RADIUS = 0.36;
export const ROOMS = [
  { id: 'reception', name: 'Reception', x: [-30, -18], z: [-6, 6], amb: 'centre', floor: 'floor' },
  { id: 'corridor', name: 'Main corridor', x: [-18, 20], z: [-2, 2], amb: 'centre', floor: 'floor' },
  { id: 'briefing', name: 'Mission briefing room', x: [-18, -6], z: [2, 12], amb: 'centre', floor: 'carpet' },
  { id: 'lab', name: 'Science laboratory', x: [-6, 6], z: [2, 12], amb: 'lab', floor: 'floor' },
  { id: 'engineering', name: 'Spacecraft engineering bay', x: [6, 20], z: [2, 14], amb: 'bay', floor: 'floor' },
  { id: 'prep', name: 'Flight preparation', x: [-18, -6], z: [-12, -2], amb: 'centre', floor: 'floor' },
  { id: 'control', name: 'Mission control', x: [-6, 20], z: [-16, -2], amb: 'control', floor: 'carpet' },
];
export const CREW = {
  specialist: { name: 'Godiva', role: 'Mission Specialist', pos: [-23.2, -1.4], face: [-28, 0], look: { skin: 0x6b4226, hair: 0x0e0b09, hairStyle: 'braids', jacket: 0x24364a, accent: 0xf2a23a, build: 'f' } },
  scientist: { name: 'Afia', role: 'Principal Scientist', pos: [-2.6, 5.4], face: [0, 2], look: { skin: 0x7a4a2b, hair: 0x15100c, hairStyle: 'afro', jacket: 0xdfe2e4, trousers: 0x2b3038, glasses: true, accent: 0x6fa8c4, build: 'f', scale: 0.97 } },
  engineer: { name: 'Lady Paula', role: 'Spacecraft Systems Engineer', pos: [9.6, 7.2], face: [12.5, 2], look: { skin: 0x8d5a34, hair: 0x1a120c, hairStyle: 'bun', jacket: 0x4a4f55, accent: 0xf2a23a, build: 'f', scale: 1.01 } },
  ops: { name: 'Jehielle', role: 'Flight Operations Lead', pos: [4.2, -5.6], face: [7, -2], look: { skin: 0x5c3a21, hair: 0x0c0a08, hairStyle: 'fade', jacket: 0x2e4a3f, accent: 0x9fd0a8, build: 'n' } },
};

export function createCentre(game) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0d11); scene.fog = new THREE.Fog(0x0a0d11, 30, 70);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 900); camera.rotation.order = 'YXZ';
  const colliders = [], wallMeshes = [], interactables = [], doors = [], actors = [], tick = [];
  const addCol = (x1, x2, z1, z2) => { const c = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), on: true }; colliders.push(c); return c; };
  const add = (o) => { scene.add(o); return o; };

  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x3a3d42, 0.95)); applyEnv(scene, 0.4);
  const blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blob = (x, z, r, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); (parent || scene).add(m); return m; };
  const sun = new THREE.DirectionalLight(0xffd9b0, 0.5); sun.position.set(-30, 12, 6); scene.add(sun);

  // ----- shell -----
  for (const r of ROOMS) {
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    const fm = M[r.floor].clone(); fm.map = M[r.floor].map.clone(); fm.map.repeat.set(w / 2, d / 2); fm.map.needsUpdate = true; if (r.floor === 'floor') { fm.roughness = 0.3; fm.metalness = 0.18; }
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fm); f.rotation.x = -Math.PI / 2; f.position.set(cx, 0, cz); add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.ceiling); c.rotation.x = Math.PI / 2; c.position.set(cx, H, cz); add(c);
    const nx = Math.max(1, Math.round(w / 6)), nz = Math.max(1, Math.round(d / 5));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), M.panelLight); p.rotation.x = Math.PI / 2; p.position.set(r.x[0] + (i + 0.5) * w / nx, H - 0.01, r.z[0] + (j + 0.5) * d / nz); add(p); }
    const L = new THREE.PointLight(r.id === 'control' ? 0xbcd0e6 : 0xfff0dc, r.id === 'control' ? 26 : 34, Math.max(w, d) * 1.5, 1.5); L.position.set(cx, H - 1.0, cz); add(L);
    if (w > 16 || d > 13) { const L2 = L.clone(); L.position.x = cx - w / 4; L2.position.x = cx + w / 4; add(L2); }
  }
  const aoMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf2c27a).multiplyScalar(4) });
  const wallPiece = (x, z, w, d, y = H / 2, h = H, collide = true) => { const wm = M.wall.clone(); wm.map = M.wall.map.clone(); wm.map.repeat.set(Math.max(w, d) / 2.4, 1); wm.map.needsUpdate = true; const m = box(w, h, d, wm, x, y, z); add(m); wallMeshes.push(m); if (collide) { addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2); if (h === H) { const alongX = w > d; const len = alongX ? w : d; for (const sgn of [-1, 1]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.7), aoMat); a.rotation.x = -Math.PI / 2; a.rotation.z = alongX ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? -Math.PI / 2 : Math.PI / 2); a.position.set(alongX ? x : x + sgn * (w / 2 + 0.35), 0.008, alongX ? z + sgn * (d / 2 + 0.35) : z); add(a); } } } return m; };
  function wall(axis, k, a, b, gaps = []) { // axis 'x': wall runs along x at z = k
    let s = a; const gs = [...gaps].sort((p, q) => p[0] - q[0]);
    const seg = (p, q) => { if (q - p < 0.02) return; const c = (p + q) / 2, len = q - p; axis === 'x' ? wallPiece(c, k, len, T) : wallPiece(k, c, T, len); };
    for (const g of gs) { seg(s, g[0]); const c = (g[0] + g[1]) / 2, len = g[1] - g[0]; axis === 'x' ? wallPiece(c, k, len, T, (H + 2.35) / 2, H - 2.35, false) : wallPiece(k, c, T, len, (H + 2.35) / 2, H - 2.35, false); s = g[1]; }
    seg(s, b);
  }
  const DG = { rec: [-0.95, 0.95], brief: [-12.95, -11.05], lab: [-0.95, 0.95], eng: [12.05, 13.95], prep: [-12.95, -11.05], ctl: [6.05, 7.95] };
  wall('x', 6, -30, -18); wall('x', -6, -30, -18); wall('x', 2, -18, 20, [DG.brief, DG.lab, DG.eng]); wall('x', -2, -18, 20, [DG.prep, DG.ctl, [10.6, 18.8]]);
  wallPiece(14.7, -2, 8.2, T, 0.45, 0.9, false); addCol(10.6, 18.8, -2 - T / 2, -2 + T / 2); wallMeshes.push(add(box(8.2, 1.45, 0.04, M.glass, 14.7, 1.625, -2))); for (let i = 0; i <= 4; i++) add(box(0.07, 1.45, 0.1, M.trim, 10.6 + i * 2.05, 1.625, -2)); add(box(8.3, 0.06, 0.34, M.trim, 14.7, 0.92, -2));
  for (const zz of [-1.78, 1.78]) add(box(37.6, 0.03, 0.07, glowM, 1, H - 0.03, zz));
  wall('x', 12, -18, 6); wall('x', 14, 6, 20); wall('x', -12, -18, -6); wall('x', -16, -6, 20);
  wall('z', -18, -12, 12, [DG.rec]); wall('z', -6, 2, 12); wall('z', -6, -16, -2); wall('z', 6, 2, 14); wall('z', 20, -16, 14);
  // glazed entrance wall
  for (const sgn of [-1, 1]) { addCol(-30.2, -29.9, sgn * 1.1, sgn * 6); const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, 4.9), new THREE.MeshBasicMaterial({ visible: false })); blocker.position.set(-30, H / 2, sgn * 3.55); scene.add(blocker); wallMeshes.push(blocker); const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.9, H), M.glass); glass.rotation.y = Math.PI / 2; glass.position.set(-30, H / 2, sgn * 3.55); add(glass); }
  { const top = new THREE.Mesh(new THREE.PlaneGeometry(2.2, H - 2.5), M.glass); top.rotation.y = Math.PI / 2; top.position.set(-30, (H + 2.5) / 2, 0); add(top); }
  for (let i = 0; i <= 6; i++) { if (i === 3) continue; add(box(0.12, H, 0.08, M.trim, -30, H / 2, -6 + i * 2)); } add(box(0.12, 0.12, 12, M.trim, -30, 2.5, 0));
  door('z', -30, [-1.1, 1.1], null, 'Entrance');
  // the forecourt you walk in from
  addCol(-47.3, -47, -7, 7); addCol(-47, -30, -7.3, -7); addCol(-47, -30, 7, 7.3);
  { const path = new THREE.Mesh(new THREE.PlaneGeometry(17, 5), new THREE.MeshBasicMaterial({ color: 0x3a3f45, fog: false })); path.rotation.x = -Math.PI / 2; path.position.set(-38.5, -0.02, 0); add(path); for (const zz of [-2.5, 2.5]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(17, 0.12), new THREE.MeshBasicMaterial({ color: 0xb5791f, fog: false })); e.rotation.x = -Math.PI / 2; e.position.set(-38.5, -0.01, zz); add(e); } }
  // exterior: dusk sky, apron and a distant pad
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1424'); gr.addColorStop(0.42, '#243a5c'); gr.addColorStop(0.5, '#d98f5c'); gr.addColorStop(0.53, '#3a332f'); gr.addColorStop(1, '#17191c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) })); add(sky);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshBasicMaterial({ color: 0x1c1f22, fog: false })); apron.rotation.x = -Math.PI / 2; apron.position.set(-330, -0.05, 0); add(apron);
  const fac = new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.6, metalness: 0.4, fog: false });
  add(box(0.6, 4.2, 44, fac, -30.3, H + 2.1, 0)); add(box(0.6, H, 16, fac, -30.3, H / 2, 14)); add(box(0.6, H, 16, fac, -30.3, H / 2, -14)); add(box(3.4, 0.18, 13, M.trim, -31.8, H + 0.1, 0));
  const fsign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ transparent: true, fog: false, map: canvasTex(1024, 170, (g, W, Hh) => { g.clearRect(0, 0, W, Hh); g.fillStyle = '#e8ebee'; g.font = '700 110px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('STARBOUND', 20, 88); g.fillStyle = '#f2a23a'; g.fillRect(760, 60, 230, 10); }) })); fsign.rotation.y = -Math.PI / 2; fsign.position.set(-30.62, H + 2.0, 0); add(fsign);
  for (const zz of [-9, 9]) { const lamp = new THREE.PointLight(0xffd9a8, 30, 26, 1.6); lamp.position.set(-36, 4, zz); add(lamp); add(cyl(0.06, 0.08, 4, M.trim, -36, 2, zz, 8)); }
  const farPad = new THREE.Group(); farPad.position.set(-260, 0, 30); const dm = new THREE.MeshBasicMaterial({ color: 0x0d0f12, fog: false });
  farPad.add(box(6, 62, 6, dm, 9, 31, 0), box(26, 2, 26, dm, 0, 1, 0));
  for (let i = 0; i < 6; i++) { farPad.add(box(6.4, 0.5, 6.4, new THREE.MeshBasicMaterial({ color: 0x2b3036, fog: false }), 9, 8 + i * 10, 0)); farPad.add(box(0.5, 0.5, 0.5, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b0).multiplyScalar(3), fog: false }), 5.7, 8 + i * 10, 3.3)); }
  for (const yy of [20, 40]) farPad.add(box(7, 0.8, 1.2, dm, 4.5, yy, 0));
  { const pr = makeRocket('aquila', 'M'); pr.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.fog = false; } }); const bb = new THREE.Box3().setFromObject(pr); const k = 54 / Math.max(1, bb.max.y - bb.min.y); pr.scale.setScalar(k); pr.position.y = 2 - bb.min.y * k; farPad.add(pr); const pl = new THREE.PointLight(0xfff0dc, 1300, 160, 1.6); pl.position.set(-22, 30, 22); farPad.add(pl); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: false })); beacon.position.set(9, 63, 0); farPad.add(beacon); add(farPad);
  tick.push((dt, t) => { beacon.visible = Math.sin(t * 3) > 0; });

  // ----- doors -----
  function door(axis, k, gap, lockedFn, name) {
    const c = (gap[0] + gap[1]) / 2, w = gap[1] - gap[0];
    const g = new THREE.Group(); const panel = box(axis === 'x' ? w : 0.09, 2.35, axis === 'x' ? 0.09 : w, std(0x59616a, 0.4, 0.7)); panel.position.y = 1.175; g.add(panel);
    const win = box(axis === 'x' ? w * 0.5 : 0.1, 0.7, axis === 'x' ? 0.1 : w * 0.5, M.glass); win.position.y = 1.55; g.add(win);
    g.position.set(axis === 'x' ? c : k, 0, axis === 'x' ? k : c); add(g); wallMeshes.push(panel);
    const lamp = box(axis === 'x' ? 0.5 : 0.34, 0.06, axis === 'x' ? 0.34 : 0.5, new THREE.MeshBasicMaterial({ color: 0x6fbf8b })); lamp.position.set(axis === 'x' ? c : k, 2.42, axis === 'x' ? k : c); add(lamp);
    for (const e of [gap[0] - 0.06, gap[1] + 0.06]) add(box(axis === 'x' ? 0.12 : T + 0.08, 2.41, axis === 'x' ? T + 0.08 : 0.12, M.trim, axis === 'x' ? e : k, 1.205, axis === 'x' ? k : e));
    add(box(axis === 'x' ? w + 0.24 : T + 0.08, 0.12, axis === 'x' ? T + 0.08 : w + 0.24, M.trim, axis === 'x' ? c : k, 2.47, axis === 'x' ? k : c));
    const col = axis === 'x' ? addCol(gap[0], gap[1], k - T / 2, k + T / 2) : addCol(k - T / 2, k + T / 2, gap[0], gap[1]);
    const d = { axis, k, c, w, g, lamp, col, open: 0, target: 0, lockedFn, name, warned: 0, cx: axis === 'x' ? c : k, cz: axis === 'x' ? k : c };
    doors.push(d); return d;
  }
  const needBadge = () => !state.met.specialist;
  door('z', -18, DG.rec, needBadge, 'Reception');
  door('x', 2, DG.brief, null, 'Briefing'); door('x', 2, DG.lab, null, 'Lab'); door('x', 2, DG.eng, null, 'Engineering'); door('x', -2, DG.prep, null, 'Prep'); door('x', -2, DG.ctl, null, 'Control');

  // ----- helpers for furnishing -----
  const sign = (text, x, y, z, ry, w = 1.6) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.22), new THREE.MeshBasicMaterial({ transparent: true, map: canvasTex(512, 112, (g, W, Hh) => { g.fillStyle = '#12161b'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#f2a23a'; g.fillRect(0, 0, 10, Hh); g.fillStyle = '#e8ebee'; g.font = '600 46px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(text.toUpperCase(), 30, Hh / 2 + 2); }) })); s.position.set(x, y, z); s.rotation.y = ry; add(s); return s; };
  const desk = (x, z, w = 1.6, d = 0.8, ry = 0, collide = true) => { const g = new THREE.Group(); g.add(box(w, 0.05, d, M.deskTop, 0, 0.76, 0), box(w - 0.1, 0.7, 0.04, M.desk, 0, 0.38, -d / 2 + 0.05), box(0.05, 0.74, d - 0.1, M.desk, -w / 2 + 0.05, 0.37, 0), box(0.05, 0.74, d - 0.1, M.desk, w / 2 - 0.05, 0.37, 0)); g.position.set(x, 0, z); g.rotation.y = ry; add(g); if (collide) { const a = Math.abs(Math.sin(ry)) > 0.5; addCol(x - (a ? d : w) / 2, x + (a ? d : w) / 2, z - (a ? w : d) / 2, z + (a ? w : d) / 2); } return g; };
  const chair = (x, z, ry = 0) => { const g = new THREE.Group(); g.add(box(0.46, 0.06, 0.46, M.darkMetal, 0, 0.47, 0), box(0.46, 0.5, 0.06, M.darkMetal, 0, 0.75, -0.21), cyl(0.03, 0.03, 0.45, M.metal, 0, 0.23, 0, 8), cyl(0.26, 0.26, 0.03, M.metal, 0, 0.02, 0, 16)); g.position.set(x, 0, z); g.rotation.y = ry; add(g); return g; };
  const hit = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); add(m); return m; };
  const interact = (id, kind, mesh, pos) => { const it = { id, kind, mesh, pos: pos || mesh.position.clone() }; mesh.userData.it = it; interactables.push(it); return it; };
  const terminal = (id, x, z, ry, title) => { const g = desk(x, z, 1.5, 0.75, ry); const sc = makeScreen(0.9, 0.52, 512); sc.group.position.set(0, 1.12, -0.12); sc.group.rotation.x = -0.12; g.add(sc.group); g.add(box(0.06, 0.2, 0.06, M.darkMetal, 0, 0.86, -0.14)); g.add(box(0.5, 0.02, 0.18, M.black, 0, 0.795, 0.16)); const h = hit(x, 1.05, z, 1.5, 1.2, 1.1); interact(id, 'station', h, new THREE.Vector3(x, 1.2, z)); return { g, sc, title }; };
  const screens = {};

  // ----- reception -----
  desk(-23.4, -2.6, 3.4, 0.9, 0); add(box(3.4, 0.35, 0.06, M.trim, -23.4, 0.95, -2.2));
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ transparent: true, map: canvasTex(1024, 256, (g, W, Hh) => { g.clearRect(0, 0, W, Hh); g.fillStyle = '#1a1e23'; g.font = '700 120px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('STARBOUND', 40, 96); g.fillStyle = '#b5791f'; g.fillRect(44, 168, 150, 8); g.fillStyle = '#4a5058'; g.font = '500 44px system-ui, sans-serif'; g.fillText('DEEP SPACE SCIENCE CENTRE', 214, 174); }) })); logo.position.set(-24, 2.1, -5.83); add(logo);
  const model = makeRocket('aquila', 'M'); model.scale.setScalar(0.055); model.position.set(-20.2, 0.95, 4.2); add(model); add(cyl(0.45, 0.5, 0.95, M.trim, -20.2, 0.475, 4.2, 24)); addCol(-20.7, -19.7, 3.7, 4.7);
  interact('model', 'inspect', hit(-20.2, 1.6, 4.2, 1, 2.6, 1));
  for (const zz of [-4.6, 4.6]) { add(box(3, 0.42, 0.7, M.darkMetal, -26.5, 0.21, zz)); addCol(-28, -25, zz - 0.35, zz + 0.35); }
  screens.rec = makeScreen(2.2, 1.24, 512); screens.rec.group.position.set(-18.18, 1.9, -3.6); screens.rec.group.rotation.y = -Math.PI / 2; add(screens.rec.group);

  // ----- corridor -----
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(37.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xb5791f })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(1, 0.006, 0); add(stripe);
  sign('Briefing', -10.2, 2.1, 1.84, Math.PI); sign('Science Laboratory', 2.2, 2.1, 1.84, Math.PI, 2.2); sign('Engineering Bay', 15.2, 2.1, 1.84, Math.PI, 2); sign('Flight Preparation', -9.9, 2.1, -1.84, 0, 2.2); sign('Mission Control', 9.3, 2.1, -1.84, 0, 2);
  screens.cor = makeScreen(2.4, 1.0, 640); screens.cor.group.position.set(-5, 1.9, -1.83); add(screens.cor.group);
  screens.cor2 = makeScreen(2.0, 0.9, 512); screens.cor2.group.position.set(17, 1.9, 1.83); screens.cor2.group.rotation.y = Math.PI; add(screens.cor2.group);

  // ----- briefing room -----
  add(box(5.2, 0.07, 1.7, M.deskTop, -12, 0.76, 6.2)); add(box(4.6, 0.72, 1.1, M.desk, -12, 0.36, 6.2)); addCol(-14.6, -9.4, 5.35, 7.05);
  for (let i = 0; i < 4; i++) { chair(-13.9 + i * 1.27, 5.0, 0); chair(-13.9 + i * 1.27, 7.4, Math.PI); }
  screens.brief = makeScreen(5.2, 2.5, 768); screens.brief.group.position.set(-12, 1.95, 11.82); screens.brief.group.rotation.y = Math.PI; add(screens.brief.group);
  add(box(0.7, 1.05, 0.5, M.desk, -8.2, 0.525, 9.6)); add(box(0.74, 0.04, 0.54, M.amber, -8.2, 1.07, 9.6)); addCol(-8.55, -7.85, 9.35, 9.85);
  interact('briefing', 'station', hit(-8.2, 1.0, 9.6, 0.9, 1.6, 0.9), new THREE.Vector3(-8.2, 1.3, 9.6));

  // ----- laboratory -----
  const tPay = terminal('payload', 0.2, 5.6, Math.PI, 'Payload bench'); screens.pay = tPay.sc;
  const tAna = terminal('analysis', 4.6, 8.2, -Math.PI / 2, 'Analysis station'); screens.ana = tAna.sc;
  const instPos = { compact: -3.6, wide: -1.6, precision: 0.6 };
  for (const id of Object.keys(PAYLOADS)) { const x = instPos[id]; add(cyl(0.42, 0.46, 0.7, M.trim, x, 0.35, 10.4, 24)); const inst = makeInstrument(id); inst.scale.setScalar(0.62); inst.position.set(x, 0.78, 10.4); add(inst); addCol(x - 0.45, x + 0.45, 9.95, 10.85); interact('inst:' + id, 'inspect', hit(x, 1.4, 10.4, 0.9, 2.2, 0.9)); tick.push((dt) => { inst.rotation.y += dt * 0.25; }); }
  add(box(0.8, 0.9, 5.5, M.desk, -5.4, 0.45, 6.6)); add(box(0.86, 0.05, 5.6, M.deskTop, -5.4, 0.92, 6.6)); addCol(-5.85, -4.95, 3.8, 9.4);
  for (let i = 0; i < 4; i++) { add(box(0.34, 0.3 + (i % 2) * 0.16, 0.4, i % 2 ? M.white : M.darkMetal, -5.45, 1.1 + (i % 2) * 0.08, 4.5 + i * 1.3)); }
  screens.lab = makeScreen(2.6, 1.3, 640); screens.lab.group.position.set(5.82, 2.0, 5.2); screens.lab.group.rotation.y = -Math.PI / 2; add(screens.lab.group);

  // ----- engineering bay -----
  const tSc = terminal('spacecraft', 9.4, 4.6, Math.PI, 'Assembly terminal'); screens.sc = tSc.sc;
  const stand = new THREE.Group(); stand.position.set(14.2, 0, 9.2); add(stand);
  stand.add(cyl(1.5, 1.6, 0.25, M.trim, 0, 0.125, 0, 32), cyl(0.5, 0.6, 0.5, M.metal, 0, 0.5, 0, 24));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stand.add(box(0.12, 3.2, 0.12, M.amber, sx * 2.1, 1.6, sz * 2.1));
  stand.add(box(4.3, 0.12, 0.12, M.amber, 0, 3.2, -2.1), box(4.3, 0.12, 0.12, M.amber, 0, 3.2, 2.1), box(0.12, 0.12, 4.3, M.amber, -2.1, 3.2, 0), box(0.12, 0.12, 4.3, M.amber, 2.1, 3.2, 0));
  addCol(12.5, 15.9, 7.5, 10.9);
  let craft = null; const craftHolder = new THREE.Group(); craftHolder.position.y = 0.85; stand.add(craftHolder);
  interact('craft', 'inspect', hit(14.2, 1.6, 9.2, 3.2, 3, 3.2));
  tick.push((dt) => { craftHolder.rotation.y += dt * 0.12; });
  for (const [x, z] of [[18.6, 5], [18.6, 11.5], [8, 12.6]]) { add(box(1.2, 0.9, 0.7, std(0x9a3b2e, 0.6, 0.3), x, 0.45, z)); add(box(1.26, 0.04, 0.76, M.darkMetal, x, 0.92, z)); addCol(x - 0.6, x + 0.6, z - 0.35, z + 0.35); }
  screens.eng = makeScreen(3.0, 1.5, 640); screens.eng.group.position.set(12.5, 2.05, 13.82); screens.eng.group.rotation.y = Math.PI; add(screens.eng.group);

  // ----- flight preparation -----
  for (let i = 0; i < 7; i++) { add(box(0.9, 2.1, 0.55, i % 3 === 1 ? M.white : std(0x6d7780, 0.5, 0.5), -17.2 + i * 0.95 + 0.5, 1.05, -11.55)); } addCol(-17.4, -10.2, -11.85, -11.25);
  add(box(3.2, 0.45, 0.6, M.darkMetal, -12, 0.225, -7.2)); addCol(-13.6, -10.4, -7.5, -6.9);
  desk(-8, -8.6, 2.4, 0.9, Math.PI / 2);
  const wheel = new THREE.Group(); wheel.add(cyl(0.18, 0.18, 0.08, M.metal, 0, 0, 0, 28), cyl(0.2, 0.2, 0.03, M.darkMetal, 0, 0, 0, 28), cyl(0.04, 0.04, 0.14, M.amber, 0, 0, 0, 12)); wheel.position.set(-8, 0.9, -9.2); add(wheel); tick.push((dt) => { wheel.rotation.y += dt * 2.2; });
  const tracker = new THREE.Group(); tracker.add(cyl(0.07, 0.09, 0.26, M.black, 0, 0.13, 0, 16), box(0.2, 0.08, 0.2, M.foil, 0, -0.03, 0)); tracker.position.set(-8, 0.86, -8.0); tracker.rotation.z = 0.3; add(tracker);
  interact('wheel', 'inspect', hit(-8, 1.0, -9.2, 0.6, 0.6, 0.6)); interact('tracker', 'inspect', hit(-8, 1.0, -8.0, 0.6, 0.6, 0.6));
  for (let i = 0; i < 3; i++) { const s = new THREE.Group(); s.add(box(0.5, 0.9, 0.2, M.white, 0, 1.45, 0), box(0.44, 0.7, 0.2, M.white, 0, 0.62, 0), cyl(0.012, 0.012, 0.3, M.metal, 0, 2.05, 0, 6)); s.position.set(-16.6, 0, -4 - i * 1.0); s.rotation.y = Math.PI / 2; add(s); }
  add(box(0.06, 0.06, 3.2, M.metal, -16.6, 2.2, -5)); addCol(-17.0, -16.3, -6.6, -3.4);
  interact('suits', 'inspect', hit(-16.6, 1.3, -5, 0.8, 2.2, 3.2));

  // ----- mission control -----
  screens.main = makeScreen(13, 3.0, 1024); screens.main.group.position.set(7, 1.95, -15.82); add(screens.main.group);
  const seats = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) { const x = -1.4 + i * 4.6 + (row ? 1.2 : 0), z = -11.2 + row * 3.4; if (row === 0 && i === 1) continue; desk(x, z, 2.2, 0.8, 0); const sc = makeScreen(0.7, 0.4, 256); sc.group.position.set(x - 0.4, 1.06, z - 0.2); add(sc.group); const sc2 = makeScreen(0.7, 0.4, 256); sc2.group.position.set(x + 0.4, 1.06, z - 0.2); add(sc2.group); seats.push({ x, z, sc, sc2 }); chair(x, z + 0.75, Math.PI); }
  const tLaunch = terminal('launch', 3.2, -12.2, 0, 'Launch console'); screens.launch = tLaunch.sc;
  add(box(1.55, 0.04, 0.8, M.amber, 3.2, 0.735, -12.2));
  const staffLooks = [{ skin: 0x6b4226, hair: 0x0c0a08, jacket: 0x2e4a3f, hairStyle: 'fade', build: 'm' }, { skin: 0xd7a574, hair: 0x3a2416, jacket: 0x2e4a3f, hairStyle: 'long', build: 'f' }, { skin: 0x8d5a34, hair: 0x111111, jacket: 0x24364a, glasses: true, hairStyle: 'afro', build: 'f' }];
  [seats[0], seats[3], seats[5]].forEach((s, i) => { if (!s) return; const a = makeCharacter(Object.assign({ seated: true }, staffLooks[i])); a.group.position.set(s.x, 0.0, s.z + 0.78); a.group.rotation.y = Math.PI; add(a.group); actors.push(a); });
  const labTech = makeCharacter({ skin: 0x4a2c17, hair: 0x0e0b09, jacket: 0xdfe2e4, hairStyle: 'short', build: 'm' }); labTech.group.position.set(-4.4, 0, 9.2); labTech.group.rotation.y = -Math.PI / 2; add(labTech.group); actors.push(labTech);


  // ----- set dressing: plants, posters, clocks, lab and bay equipment -----
  const leafM = std(0x2f5d3a, 0.8), potM = std(0x2a2f35, 0.6, 0.3);
  const plant = (x, z, s = 1) => { const g = new THREE.Group(); g.add(cyl(0.2 * s, 0.16 * s, 0.42 * s, potM, 0, 0.21 * s, 0, 16)); for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, (0.7 + (i % 3) * 0.22) * s, 5), leafM); const a = i * 0.7; lf.position.set(Math.cos(a) * 0.07 * s, (0.72 + (i % 3) * 0.1) * s, Math.sin(a) * 0.07 * s); lf.rotation.set(Math.sin(a) * 0.38, 0, -Math.cos(a) * 0.38); g.add(lf); } g.position.set(x, 0, z); add(g); blob(x, z, 0.38 * s); addCol(x - 0.2, x + 0.2, z - 0.2, z + 0.2); };
  for (const [x, z, s] of [[-29, 5.1, 1.2], [-29, -5.1, 1.2], [-17.3, 1.35, 1], [19.3, -1.3, 1], [-17.2, 11.2, 1.1], [-5.2, -2.8, 1], [5.2, 2.8, 0.9]]) plant(x, z, s);
  const poster = (kind, title, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshBasicMaterial({ map: canvasTex(288, 400, (g, W, Hh) => { g.fillStyle = '#0f1318'; g.fillRect(0, 0, W, Hh); g.strokeStyle = '#f2a23a'; g.lineWidth = 3;
      if (kind === 'transit') { const gr = g.createRadialGradient(144, 150, 10, 144, 150, 86); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#b4521c'); g.fillStyle = gr; g.beginPath(); g.arc(144, 150, 86, 0, 7); g.fill(); g.fillStyle = '#0f1318'; g.beginPath(); g.arc(112, 172, 13, 0, 7); g.fill(); g.strokeStyle = '#e8ebee'; g.beginPath(); g.moveTo(30, 285); g.lineTo(110, 285); g.lineTo(124, 312); g.lineTo(164, 312); g.lineTo(178, 285); g.lineTo(258, 285); g.stroke(); }
      if (kind === 'orbit') { g.fillStyle = '#3a6ea5'; g.beginPath(); g.arc(110, 170, 34, 0, 7); g.fill(); g.beginPath(); g.ellipse(144, 170, 118, 58, -0.25, 0, 7); g.stroke(); g.strokeStyle = '#6fa8c4'; g.beginPath(); g.arc(110, 170, 48, 0, 7); g.stroke(); g.fillStyle = '#e8ebee'; g.beginPath(); g.arc(252, 132, 6, 0, 7); g.fill(); }
      if (kind === 'launch') { g.fillStyle = '#e8ebee'; g.beginPath(); g.moveTo(144, 50); g.quadraticCurveTo(166, 90, 166, 130); g.lineTo(166, 270); g.lineTo(122, 270); g.lineTo(122, 130); g.quadraticCurveTo(122, 90, 144, 50); g.fill(); g.fillStyle = '#f2a23a'; g.beginPath(); g.moveTo(126, 276); g.lineTo(162, 276); g.lineTo(144, 330); g.fill(); g.fillStyle = '#1b1e22'; g.fillRect(122, 150, 44, 12); }
      if (kind === 'clean') { g.strokeStyle = '#6fbf8b'; g.lineWidth = 6; g.strokeRect(60, 70, 168, 200); g.beginPath(); g.moveTo(96, 170); g.lineTo(132, 208); g.lineTo(196, 126); g.stroke(); }
      g.fillStyle = '#e8ebee'; g.font = '700 26px system-ui, sans-serif'; g.fillText(title.toUpperCase(), 22, 362); g.fillStyle = '#8d97a3'; g.font = '14px system-ui, sans-serif'; g.fillText('STARBOUND PROGRAMME', 22, 384); }) })); m.position.set(x, y, z); m.rotation.y = ry; add(m); const f = box(0.96, 1.31, 0.03, M.trim, x, y, z); f.rotation.y = ry; f.translateZ(-0.02); add(f); };
  poster('transit', 'The transit method', -5, 1.75, 1.84, Math.PI); poster('orbit', 'Choosing an orbit', 7.6, 1.75, 1.84, Math.PI); poster('launch', 'Ascent to orbit', 0.5, 1.75, -1.84, 0); poster('clean', 'Clean-room protocol', -6.17, 1.75, -7, -Math.PI / 2); poster('orbit', 'Ground stations', -5.83, 1.75, -9, Math.PI / 2); poster('launch', 'Launch complex 2', -18.17, 1.75, 3.6, -Math.PI / 2);
  // mission-control wall clocks
  const clocks = [['UTC', () => new Date().toISOString().slice(11, 19)], ['LOCAL', () => new Date().toTimeString().slice(0, 8)], ['MISSION', () => (state.launch ? (state.opsResult ? 'COMPLETE' : 'IN FLIGHT') : 'PRE-LAUNCH')]].map(([label, fn], i) => { const sc = makeScreen(1.5, 0.5, 384); sc.group.position.set(19.83, 2.55, -5.4 - i * 1.9); sc.group.rotation.y = -Math.PI / 2; add(sc.group); return { sc, label, fn }; });
  let ckT = 0; tick.push((dt) => { ckT -= dt; if (ckT > 0 || roomId !== 'control') return; ckT = 1; for (const c of clocks) c.sc.redraw((g, w, h) => { g.fillStyle = '#07090c'; g.fillRect(0, 0, w, h); g.fillStyle = '#8d97a3'; g.font = `600 ${h * 0.2}px system-ui`; g.fillText(c.label, 14, h * 0.28); g.fillStyle = '#f2a23a'; g.font = `600 ${h * 0.46}px ui-monospace, monospace`; g.fillText(c.fn(), 14, h * 0.82); }); });
  // laboratory: cabinet, shelves and bench instruments
  add(box(1.7, 2.1, 0.7, M.white, 3.9, 1.05, 11.5)); add(box(1.5, 0.9, 0.04, M.glass, 3.9, 1.45, 11.13)); add(box(1.7, 0.06, 0.74, M.darkMetal, 3.9, 0.95, 11.5)); addCol(3.05, 4.75, 11.15, 11.85);
  for (const y of [1.5, 1.95]) { add(box(0.3, 0.04, 3.2, M.darkMetal, -5.68, y, 6.6)); for (let i = 0; i < 6; i++) add(box(0.2, 0.22 + (i % 3) * 0.06, 0.16 + (i % 2) * 0.1, i % 2 ? M.white : std(0x35506b, 0.6), -5.68, y + 0.14 + (i % 3) * 0.03, 5.3 + i * 0.52)); }
  const scope = new THREE.Group(); scope.add(box(0.26, 0.04, 0.3, M.darkMetal, 0, 0.02, 0), cyl(0.03, 0.03, 0.34, M.metal, -0.08, 0.2, -0.1, 10), cyl(0.045, 0.04, 0.2, M.white, 0, 0.3, 0, 12), cyl(0.02, 0.02, 0.12, M.black, 0, 0.44, 0.04, 10)); scope.children[3].rotation.x = 0.5; scope.position.set(-5.35, 0.95, 8.9); add(scope);
  // engineering bay: hazard ring, overhead crane, cable tray
  const hz = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.16, 64), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#d8a520'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#16181b'; for (let i = -64; i < 64; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 8, 64); g.lineTo(i + 72, 0); g.lineTo(i + 64, 0); g.fill(); } }, [24, 1]) })); hz.rotation.x = -Math.PI / 2; hz.position.set(14.2, 0.008, 9.2); add(hz);
  add(box(13.4, 0.22, 0.3, M.amber, 13, H - 0.2, 9.2)); add(box(0.5, 0.3, 0.5, M.darkMetal, 14.2, H - 0.45, 9.2)); add(cyl(0.012, 0.012, 0.5, M.metal, 14.2, H - 0.85, 9.2, 6)); add(box(0.1, 0.1, 0.1, M.amber, 14.2, H - 1.12, 9.2));
  add(box(0.5, 0.08, 11.4, M.darkMetal, 19.4, H - 0.35, 8)); for (let i = 0; i < 4; i++) add(box(0.06, 0.06, 11.4, std([0x9a3b2e, 0x2f5d8a, 0xd8a520, 0x2f5d3a][i], 0.6), 19.25 + i * 0.1, H - 0.28, 8));
  // briefing-room credenza
  add(box(3.2, 0.8, 0.5, M.desk, -15.6, 0.4, 2.45)); add(box(3.26, 0.04, 0.54, M.deskTop, -15.6, 0.82, 2.45)); addCol(-17.2, -14, 2.2, 2.7);

  dressCentre({ scene, addCol, tick, engine });

  // ----- crew -----
  const crew = {};
  for (const [id, c] of Object.entries(CREW)) {
    blob(c.pos[0], c.pos[1], 0.5); const a = makeCharacter(c.look); a.group.position.set(c.pos[0], 0, c.pos[1]); a.group.rotation.y = Math.atan2(c.face[0] - c.pos[0], c.face[1] - c.pos[1]); add(a.group); actors.push(a);
    addCol(c.pos[0] - 0.3, c.pos[0] + 0.3, c.pos[1] - 0.3, c.pos[1] + 0.3);
    interact('crew:' + id, 'crew', hit(c.pos[0], 1.0, c.pos[1], 0.75, 2.0, 0.75), new THREE.Vector3(c.pos[0], 1.9, c.pos[1]));
    crew[id] = { actor: a, name: c.name, role: c.role, x: c.pos[0], z: c.pos[1], base: a.group.rotation.y, waved: false };
  }
  // staff who walk real routes between rooms, stop to work, and stop for you
  const npcs = [];
  const STAFF = [
    { name: 'Kwame', job: 'Propulsion technician', look: { skin: 0x5c3a21, hair: 0x0d0d0d, jacket: 0x4a4f55, accent: 0xf2a23a, hairStyle: 'fade', build: 'm', carry: 'tablet' }, speed: 1.3, path: [[10.8, 5.7, 7, 2.6], [13, 4.2], [13, 2], [13, 0.5], [7, 0.5], [7, -2], [7, -3.6], [8.3, -4.3, 6, 2.2]] },
    { name: 'Dr Esi', job: 'Data scientist', look: { skin: 0x7a4a2b, hair: 0x15100c, jacket: 0xdfe2e4, trousers: 0x2b3038, accent: 0x6fa8c4, hairStyle: 'bun', build: 'f', glasses: true }, speed: 1.15, path: [[2.5, 6.9, 8, 1.2], [1.6, 4.4], [0, 3.3], [0, 2], [0, -0.9], [-12, -0.9], [-12, -2], [-12, -4.2], [-10.6, -5.6, 6, 1.1]] },
    { name: 'Nana', job: 'Flight controller', look: { skin: 0xb9794d, hair: 0x0d0d0d, jacket: 0x2e4a3f, accent: 0x9fd0a8, hairStyle: 'braids', build: 'f', carry: 'tablet' }, speed: 1.22, path: [[-9.4, 4.3, 6, -2.2], [-12, 3.6], [-12, 2], [-12, 1.1], [15.9, 1.1], [16.6, 1.25, 7, 0]] },
  ];
  STAFF.forEach((d, k) => { const a = makeCharacter(d.look); add(a.group); actors.push(a); const p0 = d.path[0]; const h = hit(p0[0], 1.0, p0[1], 0.7, 2.0, 0.7); const it = interact('staff:' + k, 'staff', h, new THREE.Vector3(p0[0], 1.9, p0[1]));
    npcs.push({ a, d, it, h, b: blob(p0[0], p0[1], 0.5), i: 0, dir: 1, x: p0[0], z: p0[1], yaw: p0[3] || 0, pause: 2 + k * 2.5, walk: 0, name: d.name, job: d.job }); });
  blob(14.2, 9.2, 2.6); blob(-20.2, 4.2, 0.9); for (const x of [-3.6, -1.6, 0.6]) blob(x, 10.4, 0.8); blob(-4.4, 9.2, 0.5);
  tick.push((dt) => { for (const n of npcs) { const dp = Math.hypot(player.x - n.x, player.z - n.z); let moving = false, want = n.yaw;
      if (dp < 1.25 || (inDialogue() && dp < 2.5)) { want = Math.atan2(player.x - n.x, player.z - n.z); }
      else if (n.pause > 0) { n.pause -= dt; const p = n.d.path[n.i]; if (p[3] != null) want = p[3]; }
      else { let j = n.i + n.dir; if (j < 0 || j >= n.d.path.length) { n.dir *= -1; j = n.i + n.dir; } const p = n.d.path[j]; const dx = p[0] - n.x, dz = p[1] - n.z, dd = Math.hypot(dx, dz), step = n.d.speed * dt;
        if (dd <= step) { n.x = p[0]; n.z = p[1]; n.i = j; n.pause = p[2] || 0; } else { n.x += dx / dd * step; n.z += dz / dd * step; want = Math.atan2(dx, dz); moving = true; } }
      let dy = want - n.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); n.yaw += dy * Math.min(1, dt * 7); n.walk = moving ? n.d.speed / 2.7 : 0;
      n.a.group.position.set(n.x, 0, n.z); n.a.group.rotation.y = n.yaw; n.b.position.set(n.x, 0.012, n.z); n.h.position.set(n.x, 1.0, n.z); n.it.pos.set(n.x, 1.9, n.z); } });

  // ----- collectible mission patches (one per room) -----
  const patchMat = new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#f2a23a'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#12161b'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill(); g.strokeStyle = '#f2a23a'; g.lineWidth = 5; g.beginPath(); g.ellipse(64, 64, 40, 16, -0.5, 0, 7); g.stroke(); g.fillStyle = '#e8ebee'; g.beginPath(); g.arc(64, 64, 11, 0, 7); g.fill(); }) });
  const patches = [[-27.6, 3.0], [-16.6, 10.4], [2.2, 11.2], [18.8, 13.0], [-9.4, -10.9], [18.6, -14.6]].map(([x, z], n) => { const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 28), [glowM, patchMat, patchMat]); d.rotation.x = Math.PI / 2; g.add(d); g.position.set(x, 1.15, z); add(g); const h = hit(x, 1.15, z, 0.55, 0.55, 0.55); interact('patch:' + n, 'patch', h, new THREE.Vector3(x, 1.15, z)); return { g, h, n }; });
  tick.push((dt, t) => { for (const q of patches) { const on = !state.patches[q.n]; q.g.visible = on; q.h.userData.off = !on; q.g.rotation.y += dt * 1.6; q.g.position.y = 1.15 + Math.sin(t * 2 + q.n) * 0.05; } });
  // ----- the player's own avatar (seen in third-person view and in the arrival sequence) -----
  let avatar = null; const avBlob = blob(0, 0, 0.5); let camBack = 2.7;

  // ----- targeting aids -----
  const bracket = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xf2a23a, transparent: true, opacity: 0.55, depthTest: false })); bracket.visible = false; bracket.renderOrder = 5; add(bracket);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xf2a23a, transparent: true, opacity: 0.85, depthTest: false, fog: false })); marker.renderOrder = 6; marker.visible = false; add(marker);
  let markerPos = null;
  const gArrow = new THREE.Group(); { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 3), new THREE.MeshBasicMaterial({ color: 0xf2a23a, transparent: true, opacity: 0.85, depthTest: false, fog: false })); cone.rotation.x = Math.PI / 2; cone.scale.z = 0.15; gArrow.add(cone); gArrow.renderOrder = 6; gArrow.visible = false; add(gArrow); }

  // ----- player -----
  const player = { x: -28, z: 0, yaw: -Math.PI / 2, face: -Math.PI / 2, pitch: 0, bob: 0, stepAcc: 0, vx: 0, vz: 0, y: 0, vy: 0, zoom: 3.3 };
  function collide() {
    for (let pass = 0; pass < 2; pass++) for (const c of colliders) { if (!c.on) continue;
      const nx = Math.max(c.x1, Math.min(player.x, c.x2)), nz = Math.max(c.z1, Math.min(player.z, c.z2)); let dx = player.x - nx, dz = player.z - nz; const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = RADIUS - d; player.x += (dx / d) * push; player.z += (dz / d) * push; }
      else { const pl = player.x - c.x1, pr = c.x2 - player.x, pt = player.z - c.z1, pb = c.z2 - player.z; const m = Math.min(pl, pr, pt, pb); if (m === pl) player.x = c.x1 - RADIUS; else if (m === pr) player.x = c.x2 + RADIUS; else if (m === pt) player.z = c.z1 - RADIUS; else player.z = c.z2 + RADIUS; } }
  }
  const ray = new THREE.Raycaster(); ray.far = 3.0; const camRay = new THREE.Raycaster(); const losRay = new THREE.Raycaster();
  const thirdNow = () => settings.view === 'third' && player.zoom >= 0.9; const centreV = new THREE.Vector2(0, 0);
  let target = null, roomId = null, annT = 40, cine = null;
  const V = (x, y, z) => new THREE.Vector3(x, y, z); const fogKeep = scene.fog; const lookV = new THREE.Vector3();
  // arrival film: four shots, cut between them
  const SHOTS = [
    { dur: 4.6, p0: V(-218, 2.5, 74), p1: V(-212, 10, 62), l0: V(-260, 22, 30), l1: V(-260, 34, 30) },
    { dur: 4.4, p0: V(-118, 9, 26), p1: V(-56, 4.2, 9), l0: V(-30, 5, 0), l1: V(-30, 4.4, 0) },
    { dur: 4.0, p0: V(-19.0, 2.9, 1.4), p1: V(-20.6, 2.2, 2.5), l0: V(-25, 1.4, -1.2), l1: V(-25.6, 1.4, -0.8) },
    { dur: 2.6, p0: V(-20.6, 2.2, 2.5), p1: null, l0: V(-25.6, 1.4, -0.8), l1: V(-14, 1.5, 0) },
  ];
  const PA_UNUSED = ['Range control reports the launch corridor is clear for today\u2019s window.', 'Clean-room protocol is in effect in the Engineering Bay. Garments are required beyond the yellow line.', 'Ground station handover in ten minutes. Flight operations staff to Mission Control.', 'Science team reminder: calibration frames are due before the end of shift.'];
  function roomAt(x, z) { for (const r of ROOMS) if (x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]) return r; return null; }

  const api = {
    scene, camera, crew, player, screens, cameras: [camera], post: true,
    setAvatar(cfg) { if (avatar) { scene.remove(avatar.group); disposeTree(avatar.group); } avatar = makeCharacter(Object.assign({}, DEFAULT_AVATAR, cfg || {})); scene.add(avatar.group); },
    get patchesLeft() { return patches.filter((q) => !state.patches[q.n]).length; },
    onEnter() { roomId = null; },
    onExit() { bracket.visible = false; },
    get cine() { return !!cine; },
    intro(done, onShot) { cine = { t: 0, shot: -1, dur: settings.reducedMotion ? 0.1 : SHOTS.reduce((q, x) => q + x.dur, 0), done, onShot }; },
    skipIntro() { if (cine) cine.t = cine.dur; },
    npcs, rooms: ROOMS, get marker() { return markerPos; }, staffLine(k) { return npcs[k]; },
    faceTo(x, z) { player.yaw = player.face = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = -0.02; },
    place(x, z, yaw) { player.x = x; player.z = z; player.yaw = player.face = yaw; player.pitch = settings.view === 'third' ? -0.14 : 0; player.vx = player.vz = 0; },
    setMarker(v) { markerPos = v ? v.clone() : null; },
    posOf(id) { const it = interactables.find((i) => i.id === id); return it ? it.pos : null; },
    target: () => target,
    use() { if (target) game.onUse(target); },
    rebuildCraft() { if (craft) { craftHolder.remove(craft); disposeTree(craft); } craft = makeSpacecraft(state); craft.scale.setScalar(0.9); craftHolder.add(craft); },
    update(dt) {
      const t = engine.time; const active = input.fp && !cine;
      if (active) {
        const lk = takeLook(); player.yaw -= lk.x; player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - lk.y));
        const mv = moveVector(); const sp = mv.run ? 8.2 : 4.5; const s = Math.sin(player.yaw), co = Math.cos(player.yaw);
        const tx = (-s * mv.y + co * mv.x) * sp, tz = (-co * mv.y - s * mv.x) * sp; const k = Math.min(1, dt * 11); player.vx += (tx - player.vx) * k; player.vz += (tz - player.vz) * k; const ox = player.x, oz = player.z;
        player.x += player.vx * dt; player.z += player.vz * dt; collide();
        player.zoom = Math.max(0, Math.min(6.5, player.zoom + takeZoom())); if (takeJump() && player.y <= 0.001) { player.vy = 4.3; sfx.step(); }
        if (thirdNow() && Math.hypot(tx, tz) > 0.3) { let d = Math.atan2(-player.vx, -player.vz) - player.face; d = Math.atan2(Math.sin(d), Math.cos(d)); player.face += d * Math.min(1, dt * 12); } else if (!thirdNow()) player.face = player.yaw;
        const moved = Math.hypot(player.x - ox, player.z - oz); player.stepAcc += moved; if (player.stepAcc > 0.72) { player.stepAcc = 0; sfx.step(); }
        if (!settings.reducedMotion) player.bob += moved * 4.4;
      } else { takeLook(); takeZoom(); takeJump(); player.vx = player.vz = 0; }
      player.vy -= 13 * dt; player.y = Math.max(0, player.y + player.vy * dt); if (player.y === 0) player.vy = 0;
      camera.position.set(player.x, EYE + player.y + (settings.reducedMotion || thirdNow() ? 0 : Math.sin(player.bob) * 0.022), player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      const third = thirdNow() && !inDialogue(); document.body.classList.toggle('third', third); const speed = dt > 0 ? Math.hypot(player.x - (player.lx ?? player.x), player.z - (player.lz ?? player.z)) / dt : 0; player.lx = player.x; player.lz = player.z;
      if (avatar) { avatar.group.visible = third || !!cine; avatar.group.position.set(player.x, player.y, player.z); avBlob.position.set(player.x, 0.013, player.z); avatar.group.rotation.y = player.face + Math.PI; avatar.update(dt, null, { walk: Math.min(1.4, speed / 3.3), noLook: true }); }
      if (third && !cine) { const cp = Math.cos(player.pitch), f = new THREE.Vector3(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp); const headP = new THREE.Vector3(player.x, 1.62 + player.y, player.z); const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const want = headP.clone().addScaledVector(f, -player.zoom).add(new THREE.Vector3(0, 0.22, 0)); const dir = want.clone().sub(headP); const len = dir.length(); dir.normalize(); camRay.set(headP, dir); camRay.far = len; const hitW = camRay.intersectObjects(wallMeshes, false)[0]; const d = hitW ? Math.max(0.35, hitW.distance - 0.25) : len; camBack += (d - camBack) * Math.min(1, dt * 10); camera.position.copy(headP).addScaledVector(dir, Math.min(d, camBack)); camera.position.y = Math.min(H - 0.25, Math.max(0.5, camera.position.y)); if (avatar) avatar.group.visible = camBack > 0.9; }
      if (avatar) avBlob.visible = avatar.group.visible;
      if (cine) { cine.t += dt; let k = 0, tt = cine.t; while (k < SHOTS.length - 1 && tt > SHOTS[k].dur) { tt -= SHOTS[k].dur; k++; } const sh = SHOTS[k];
        if (k !== cine.shot) { cine.shot = k; scene.fog = k < 2 ? null : fogKeep; cine.onShot && cine.onShot(k); if (k === 2) crew.specialist.waveNow = true; }
        const u = Math.min(1, tt / sh.dur), e = k === 3 ? u * u * (3 - 2 * u) : u * (2 - u) * 0.85 + u * 0.15; const p1 = sh.p1 || V(player.x, EYE, player.z);
        camera.position.lerpVectors(sh.p0, p1, e); lookV.lerpVectors(sh.l0, sh.l1, e); camera.lookAt(lookV);
        if (cine.t >= cine.dur) { const cb = cine.done; cine = null; scene.fog = fogKeep; camBack = 0.4; cb && cb(); } }
      // doors
      for (const d of doors) { const dist = Math.hypot(player.x - d.cx, player.z - d.cz); const locked = d.lockedFn && d.lockedFn(); const byStaff = !d.lockedFn && npcs.some((n) => Math.hypot(n.x - d.cx, n.z - d.cz) < 1.9); const want = (dist < 2.6 && !locked) || byStaff ? 1 : 0;
        if (locked && dist < 1.8 && t - d.warned > 6) { d.warned = t; game.onLockedDoor(d); }
        if (want !== d.target) { d.target = want; if (dist < 12) sfx.door(); }
        d.open += (d.target - d.open) * Math.min(1, dt * 5); const off = d.open * (d.w - 0.08); if (d.axis === 'x') d.g.position.x = d.c + off; else d.g.position.z = d.c + off;
        d.col.on = d.open < 0.7; d.lamp.material.color.setHex(locked ? 0xe5564b : 0x6fbf8b); }
      // room and ambience
      const r = roomAt(player.x, player.z); if (r && r.id !== roomId) { roomId = r.id; setAmbience(r.amb); game.onRoom(r); }
      annT -= dt; if (annT < 0 && active) { annT = 70 + Math.random() * 50; announce(); game.onAnnounce(PA[Math.floor(Math.random() * PA.length)]); }
      for (const f of tick) f(dt, t);
      for (const c of Object.values(crew)) { const dx = player.x - c.x, dz = player.z - c.z, dd = Math.hypot(dx, dz); let turn = 0, wave = false; if (dd < 5) { let a = Math.atan2(dx, dz) - c.base; a = Math.atan2(Math.sin(a), Math.cos(a)); turn = Math.max(-0.8, Math.min(0.8, a * 0.6)); }
        if (dd < 4.6 && !c.waved && !inDialogue() && !cine) { c.waved = true; wave = true; } if (dd > 9) c.waved = false; if (c.waveNow) { c.waveNow = false; wave = true; } c.opt = { turn, wave }; }
      const lookAt = cine ? V(player.x, EYE, player.z) : camera.position; const crewActs = new Map(Object.values(crew).map((c) => [c.actor, c])); const npcActs = new Map(npcs.map((n) => [n.a, n]));
      for (const a of actors) { const c = crewActs.get(a), n = npcActs.get(a); a.update(dt, n && n.walk ? null : lookAt, c ? c.opt : n ? { walk: n.walk } : undefined); }
      // interaction target
      target = null; bracket.visible = false;
      if (active && thirdNow()) { // Roblox-style proximity prompt: the nearest thing you are standing next to
        let best = null, bd = 1e9; const hp = new THREE.Vector3(player.x, 1.5, player.z);
        for (const it of interactables) { if (it.mesh.userData.off) continue; const dx = it.pos.x - player.x, dz = it.pos.z - player.z; const d = Math.hypot(dx, dz); const reach = it.kind === 'patch' ? 1.7 : it.kind === 'station' ? 2.3 : 2.5; if (d > reach || d >= bd) continue; const tp = new THREE.Vector3(it.pos.x, 1.3, it.pos.z); const dir = tp.clone().sub(hp); const len = dir.length(); losRay.set(hp, dir.normalize()); losRay.far = Math.max(0.1, len - 0.5); if (losRay.intersectObjects(wallMeshes, false).length) continue; best = it; bd = d; }
        if (best) { const label = game.labelFor(best); if (label) { target = best; target.label = label; const p = best.mesh.geometry.parameters; bracket.position.copy(best.mesh.position); bracket.scale.set(p.width, p.height, p.depth); bracket.visible = best.kind !== 'crew' && best.kind !== 'staff'; } } }
      else if (active) { ray.setFromCamera(centreV, camera); ray.far = settings.view === 'third' ? 3.2 + camBack : 3.0; const hits = ray.intersectObjects([...interactables.filter((i) => !i.mesh.userData.off).map((i) => i.mesh), ...wallMeshes], false);
        if (hits.length && hits[0].object.userData.it) { const it = hits[0].object.userData.it; const label = game.labelFor(it); if (label) { target = it; target.label = label; const p = it.mesh.geometry.parameters; bracket.position.copy(it.mesh.position); bracket.scale.set(p.width, p.height, p.depth); bracket.visible = it.kind !== 'crew' && it.kind !== 'staff'; } } }
      game.onTarget(target);
      // floor arrow that points toward the next goal (Guided only)
      if (markerPos && settings.assist === 'guided' && active) { const dx = markerPos.x - player.x, dz = markerPos.z - player.z, dd = Math.hypot(dx, dz); gArrow.visible = dd > 3.5; if (dd > 0.01) { gArrow.position.set(player.x + dx / dd * 1.5, 0.12, player.z + dz / dd * 1.5); gArrow.rotation.y = Math.atan2(dx, dz); } } else gArrow.visible = false;
      // objective marker (Guided only)
      if (markerPos && settings.assist === 'guided') { marker.visible = true; marker.position.set(markerPos.x, markerPos.y + 0.75 + Math.sin(t * 2.4) * 0.07, markerPos.z); marker.rotation.y = t * 1.5; } else marker.visible = false;
    },
    refresh() { paintScreens(api, seats); },
  };
  let seatT = 0; tick.push((dt) => { seatT -= dt; if (seatT < 0) { seatT = 1.2; for (const s of seats) for (const sc of [s.sc, s.sc2]) sc.redraw((g, w, h) => { g.fillStyle = '#0a0d11'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3d7d8c'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w; x += 6) { const y = h / 2 + Math.sin(x * 0.05 + engine.time * 2 + s.x) * h * 0.18 + (Math.random() - 0.5) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.fillStyle = '#8d97a3'; g.fillRect(8, 8, w * 0.4, 6); g.fillRect(8, 20, w * 0.25, 6); }); } });
  // animated briefing-room display: a star dimming as something crosses it (illustration)
  let bT = 0; tick.push((dt) => { bT -= dt; if (bT > 0 || roomId !== 'briefing') return; bT = 0.08; screens.brief.redraw((g, w, h) => { const ph = (engine.time * 0.12) % 1; g.fillStyle = '#07090c'; g.fillRect(0, 0, w, h);
    const cx = w * 0.27, cy = h * 0.5, R = h * 0.3; const gr = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(0.8, '#f08a3c'); gr.addColorStop(1, '#8a3a16'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    const px = cx - R * 1.6 + ph * R * 3.2; g.fillStyle = '#07090c'; g.beginPath(); g.arc(px, cy + R * 0.2, R * 0.13, 0, 7); g.fill();
    const gx = w * 0.52, gw = w * 0.43, gy = h * 0.3, gh = h * 0.4; g.strokeStyle = '#2a323c'; g.strokeRect(gx, gy, gw, gh); g.strokeStyle = '#e8ebee'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 100; i++) { const u = i / 100; const inT = Math.abs(u - 0.5) < 0.085; const edge = Math.min(1, (0.085 - Math.abs(u - 0.5)) / 0.02); const y = gy + gh * 0.3 + (inT ? gh * 0.4 * edge : 0); i ? g.lineTo(gx + u * gw, y) : g.moveTo(gx + u * gw, y); } g.stroke();
    g.fillStyle = '#f2a23a'; g.beginPath(); g.arc(gx + ph * gw, gy + gh * 0.3 + (Math.abs(ph - 0.5) < 0.085 ? gh * 0.4 * Math.min(1, (0.085 - Math.abs(ph - 0.5)) / 0.02) : 0), 7, 0, 7); g.fill();
    g.fillStyle = '#8d97a3'; g.font = `600 ${h * 0.055}px system-ui`; g.fillText('BRIGHTNESS OVER TIME', gx, gy - 14); g.fillText('ILLUSTRATION OF A TRANSIT (NOT DATA)', gx, gy + gh + h * 0.09); }); });
  api.setAvatar(settings.avatar); api.rebuildCraft(); api.refresh();
  return api;
}

function paintScreens(api, seats) {
  const s = api.screens; const t = totals(state); const p = t.payload; const v = t.vehicle;
  const stageNames = ['Arrival', 'Crew introductions', 'Mission briefing', 'Payload design', 'Spacecraft design', 'Launch', 'Orbit selection', 'Operations', 'Data analysis', 'Mission report'];
  s.rec.redraw((g, w, h) => paintPanel(g, w, h, 'Welcome', [['Visitor status', state.met.specialist ? 'BADGE ISSUED' : 'CHECK IN AT DESK', state.met.specialist ? '#6fbf8b' : '#f2a23a'], ['Programme', 'STARBOUND'], ['Today', 'Mission assignment']]));
  const lines = [['Mission phase', stageNames[state.stage]], ['Payload', p ? p.short : 'not selected'], ['Launch vehicle', v ? v.name : 'not selected'], ['Budget committed', `${t.spent} / ${BUDGET} M`]];
  s.cor.redraw((g, w, h) => paintPanel(g, w, h, 'Mission status board', lines)); s.cor2.redraw((g, w, h) => paintPanel(g, w, h, 'Mission status board', lines));
  s.pay.redraw((g, w, h) => paintPanel(g, w, h, 'Payload bench', [['Instrument', p ? p.name : 'none'], ['Mass', p ? p.mass + ' kg' : '-'], ['Power', p ? p.power + ' W' : '-']]));
  s.ana.redraw((g, w, h) => paintPanel(g, w, h, 'Analysis station', [['Mission data', state.opsResult ? 'RECEIVED' : 'AWAITING MISSION', state.opsResult ? '#6fbf8b' : '#8d97a3'], ['Measurements', state.opsResult ? String(state.opsResult.counts.delivered) : '-']], '#6fa8c4'));
  s.lab.redraw((g, w, h) => paintPanel(g, w, h, 'Science objective', [['Target', 'M-dwarf star, repeated dimming'], ['Reported dip', '~0.33 %'], ['Question', 'Does the dip repeat?'], ['Instrument', p ? p.short : 'to be selected']], '#6fa8c4'));
  s.sc.redraw((g, w, h) => paintPanel(g, w, h, 'Assembly terminal', [['Mass', p ? t.mass + ' kg' : '-'], ['Power margin', t.powerMargin == null ? '-' : Math.round(t.powerMargin * 100) + ' %'], ['Review', state.validated ? 'PASSED' : 'PENDING', state.validated ? '#6fbf8b' : '#f2a23a']]));
  s.eng.redraw((g, w, h) => paintPanel(g, w, h, 'Spacecraft on stand', [['Dry mass', p ? t.mass + ' kg' : 'no payload yet'], ['Load / generation', t.gen ? `${t.load} / ${t.gen} W` : `${t.load} W / -`], ['Launch vehicle', v ? `${v.name} (${v.capacity} kg)` : 'not selected'], ['Engineering review', state.validated ? 'PASSED' : 'PENDING', state.validated ? '#6fbf8b' : '#f2a23a']]));
  s.launch.redraw((g, w, h) => paintPanel(g, w, h, 'Launch console', [['Vehicle', v ? v.name : '-'], ['Status', state.launch ? 'LAUNCHED' : state.validated ? 'READY FOR CHECKLIST' : 'AWAITING REVIEW', state.validated ? '#6fbf8b' : '#f2a23a']]));
  s.main.redraw((g, w, h) => { g.fillStyle = '#080a0d'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2a23a'; g.fillRect(0, 0, w, 5);
    g.fillStyle = '#8d97a3'; g.font = `600 ${h * 0.085}px system-ui`; g.fillText('STARBOUND MISSION CONTROL', 24, h * 0.14); g.fillStyle = '#e8ebee'; g.font = `600 ${h * 0.12}px ui-monospace, monospace`; g.fillText(stageNames[state.stage].toUpperCase(), 24, h * 0.32);
    g.strokeStyle = '#27303a'; g.lineWidth = 2; const mx = w * 0.42, mw = w * 0.56, my = h * 0.12, mh = h * 0.78; g.strokeRect(mx, my, mw, mh); g.strokeStyle = '#1b222a'; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(mx + i * mw / 8, my); g.lineTo(mx + i * mw / 8, my + mh); g.stroke(); } for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(mx, my + i * mh / 4); g.lineTo(mx + mw, my + i * mh / 4); g.stroke(); }
    g.strokeStyle = state.launch ? '#f2a23a' : '#3d4651'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 80; i++) { const u = i / 80; const y = my + mh / 2 + Math.sin(u * Math.PI * 4 + 0.6) * mh * 0.3; i ? g.lineTo(mx + u * mw, y) : g.moveTo(mx + u * mw, y); } g.stroke();
    g.fillStyle = '#8d97a3'; g.font = `${h * 0.06}px system-ui`; g.fillText(state.launch ? 'GROUND TRACK: PARKING ORBIT' : 'GROUND TRACK: PLANNED', mx + 12, my + mh - 14);
    const rows = [['PAYLOAD', p ? p.short : '--'], ['VEHICLE', v ? v.name.toUpperCase() : '--'], ['MASS', p ? t.mass + ' KG' : '--'], ['BUDGET', `${t.spent}/${BUDGET} M`], ['REVIEW', state.validated ? 'PASSED' : 'PENDING']];
    rows.forEach((r, i) => { g.fillStyle = '#8d97a3'; g.font = `${h * 0.07}px system-ui`; g.fillText(r[0], 24, h * 0.48 + i * h * 0.1); g.fillStyle = '#e8ebee'; g.font = `600 ${h * 0.07}px ui-monospace, monospace`; g.fillText(r[1], w * 0.16, h * 0.48 + i * h * 0.1); }); });
}
