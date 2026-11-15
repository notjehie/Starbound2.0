// Fine detail for the space centre: trim, clutter, equipment, signage and the world outside.
// Static pieces are merged per material after building, so the detail costs few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, box, cyl, std, canvasTex, makeScreen } from './builders.js';

const H = 3.4;
export function dressCentre({ scene, addCol, tick, engine }) {
  const G = new THREE.Group(); const live = new THREE.Group(); scene.add(live);
  const A = (m) => { G.add(m); return m; };
  const mats = {}; const C = (hex, rough = 0.7, metal = 0, extra) => mats[hex + ':' + rough + ':' + metal] || (mats[hex + ':' + rough + ':' + metal] = std(hex, rough, metal, extra));
  const basic = (hex) => mats['b' + hex] || (mats['b' + hex] = new THREE.MeshBasicMaterial({ color: hex }));
  const glow = (hex, k = 3) => mats['g' + hex] || (mats['g' + hex] = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
  const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); e.position.set(x, y, z); e.scale.set(sx, sy, sz); return e; };
  const pic = (w, h, draw, x, y, z, ry, px = 256) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(px, Math.round(px * h / w), draw) })); m.position.set(x, y, z); m.rotation.y = ry; live.add(m); const f = box(w + 0.06, h + 0.06, 0.025, M.trim, x, y, z); f.rotation.y = ry; f.translateZ(-0.018); A(f); return m; };

  // ---------- trim on every wall: skirting and a dado rail ----------
  const gaps = { 'z2': [[-13.05, -10.95], [-1.05, 1.05], [11.95, 14.05]], 'z-2': [[-13.05, -10.95], [5.95, 8.05], [10.5, 18.9]], 'x-18': [[-1.05, 1.05]] };
  const skirt = C(0x2b3036, 0.6, 0.3), rail = C(0x8f969d, 0.45, 0.5);
  function trim(axis, k, a, b, side) { // side: +1 or -1, which face of the wall line
    const gs = (gaps[axis + k] || []).slice().sort((p, q) => p[0] - q[0]); let s = a; const off = side * 0.165;
    const seg = (p, q) => { if (q - p < 0.1) return; const c = (p + q) / 2, len = q - p; for (const [y, h, d, m] of [[0.06, 0.12, 0.03, skirt], [1.02, 0.035, 0.022, rail]]) A(axis === 'z' ? box(len, h, d, m, c, y, k + off) : box(d, h, len, m, k + off, y, c)); };
    for (const g of gs) { if (g[1] < a || g[0] > b) continue; seg(s, g[0]); s = g[1]; } seg(s, b);
  }
  trim('z', 6, -30, -18, -1); trim('z', -6, -30, -18, 1); trim('x', -18, -6, 6, -1);
  trim('z', 2, -18, 20, -1); trim('z', -2, -18, 20, 1); trim('x', 20, -2, 2, -1); trim('x', -18, -2, 2, 1);
  trim('z', 2, -18, 20, 1); trim('z', 12, -18, 6, -1); trim('x', -18, 2, 12, 1); trim('x', -6, 2, 12, -1); trim('x', -6, 2, 12, 1); trim('x', 6, 2, 12, -1); trim('x', 6, 2, 14, 1); trim('z', 14, 6, 20, -1); trim('x', 20, 2, 14, -1);
  trim('z', -2, -18, 20, -1); trim('z', -12, -18, -6, 1); trim('x', -18, -12, -2, 1); trim('x', -6, -12, -2, -1); trim('x', -6, -16, -2, 1); trim('z', -16, -6, 20, 1); trim('x', 20, -16, -2, -1);

  // ---------- ceilings: vents, sprinklers, service runs ----------
  const ventM = C(0x1a1d21, 0.6, 0.5);
  const vent = (x, z) => { A(box(0.62, 0.03, 0.62, ventM, x, H - 0.02, z)); for (let i = 0; i < 5; i++) A(box(0.56, 0.012, 0.03, rail, x, H - 0.045, z - 0.24 + i * 0.12)); };
  for (const [x, z] of [[-27, 2.5], [-21, -3.5], [-12, 0.9], [2, -0.9], [14, 0.9], [-15, 9], [-9, 4.5], [-3, 9], [3, 4], [9, 11], [17, 4.5], [-15, -9], [-8.5, -4.5], [0, -13], [9, -5], [16, -12]]) vent(x, z);
  for (let x = -16; x <= 18; x += 4.25) A(cyl(0.035, 0.035, 0.05, C(0xb53a2e, 0.5, 0.3), x, H - 0.04, 0, 8));
  for (const [zz, col] of [[1.35, 0x9aa1a8], [1.5, 0x2f5d8a], [-1.4, 0x9aa1a8]]) { const p = cyl(0.045, 0.045, 37.6, C(col, 0.4, 0.6), 1, H - 0.16, zz, 10); p.rotation.z = Math.PI / 2; A(p); }
  for (let x = -17; x <= 19; x += 3) for (const zz of [1.42, -1.4]) A(box(0.05, 0.14, 0.2, ventM, x, H - 0.08, zz));

  // ---------- signage: exit signs, room plates, extinguishers ----------
  const exitT = canvasTex(128, 48, (g) => { g.fillStyle = '#0c3b1e'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#9dffbf'; g.font = '700 30px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('EXIT', 30, 26); });
  const exitM = new THREE.MeshBasicMaterial({ map: exitT });
  for (const [x, z, ry] of [[-12, 1.8, Math.PI], [0, 1.8, Math.PI], [13, 1.8, Math.PI], [-12, -1.8, 0], [7, -1.8, 0], [-17.8, 0, Math.PI / 2], [-12, 2.2, 0], [0, 2.2, 0], [13, 2.2, 0], [-12, -2.2, Math.PI], [7, -2.2, Math.PI], [-18.2, 0, -Math.PI / 2]]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), exitM); e.position.set(x, 2.72, z); e.rotation.y = ry; live.add(e); }
  const ext = (x, z, ry) => { const g = new THREE.Group(); g.add(box(0.34, 0.62, 0.04, C(0xc9cdd0, 0.6), 0, 1.15, 0), cyl(0.075, 0.075, 0.42, C(0xb5261e, 0.35, 0.3), 0, 1.1, 0.09, 14), cyl(0.03, 0.04, 0.08, ventM, 0, 1.35, 0.09, 10), box(0.2, 0.2, 0.01, C(0xb5261e, 0.5), 0, 1.72, 0.012)); g.position.set(x, 0, z); g.rotation.y = ry; A(g); };
  ext(-8, 1.82, Math.PI); ext(10.6, 1.82, Math.PI); ext(-15.4, -1.82, 0); ext(3, -1.82, 0); ext(-18.17, 5.3, -Math.PI / 2); ext(19.82, 12, -Math.PI / 2); ext(-5.82, -14, Math.PI / 2);
  // floor way-finding arrows at each door
  const arrowM = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.fillStyle = 'rgba(181,121,31,0.9)'; g.beginPath(); g.moveTo(32, 6); g.lineTo(56, 34); g.lineTo(40, 34); g.lineTo(40, 58); g.lineTo(24, 58); g.lineTo(24, 34); g.lineTo(8, 34); g.fill(); }) });
  for (const [x, z, r] of [[-12, 1.2, 0], [0, 1.2, 0], [13, 1.2, 0], [-12, -1.2, Math.PI], [7, -1.2, Math.PI]]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), arrowM); a.rotation.x = -Math.PI / 2; a.rotation.z = r + Math.PI; a.position.set(x, 0.011, z); live.add(a); }

  // ---------- small things on desks ----------
  let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mugM = [C(0xe9ebec, 0.5), C(0x24364a, 0.5), C(0xb5791f, 0.5)], paperM = C(0xf1efe8, 0.9), keyM = C(0x16181b, 0.6);
  function clutter(x, z, ry = 0, w = 1.4, y = 0.79) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    g.add(box(0.42, 0.018, 0.14, keyM, (rnd() - 0.5) * 0.2, 0.01, 0.12)); g.add(box(0.06, 0.02, 0.1, keyM, 0.34, 0.012, 0.14));
    if (rnd() < 0.8) { const mx = (rnd() < 0.5 ? -1 : 1) * (w * 0.32 + rnd() * 0.08); g.add(cyl(0.04, 0.035, 0.09, mugM[Math.floor(rnd() * 3)], mx, 0.045, 0.02 + rnd() * 0.15, 12)); }
    if (rnd() < 0.8) { const p = box(0.21, 0.012 + rnd() * 0.03, 0.297, paperM, -w * 0.3 + rnd() * 0.1, 0.012, 0.05); p.rotation.y = (rnd() - 0.5) * 0.6; g.add(p); }
    if (rnd() < 0.5) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 16, Math.PI), keyM); h.position.set(w * 0.28, 0.04, -0.12); h.rotation.set(-Math.PI / 2, 0, rnd() * 3); g.add(h); }
    A(g); }
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) { if (row === 0 && i === 1) continue; clutter(-1.4 + i * 4.6 + (row ? 1.2 : 0), -11.2 + row * 3.4, 0, 2.0); }
  clutter(-23.4, -2.6, Math.PI, 3.0); clutter(-22.4, -2.6, Math.PI, 1.2); clutter(-8, -8.6, Math.PI / 2, 2.0);

  // ---------- reception ----------
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.85, map: canvasTex(512, 512, (g) => { g.clearRect(0, 0, 512, 512); g.strokeStyle = '#b5791f'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 236, 0, 7); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 214, 0, 7); g.stroke(); g.beginPath(); g.ellipse(256, 256, 180, 70, -0.5, 0, 7); g.stroke(); g.fillStyle = '#b5791f'; g.beginPath(); g.arc(256, 256, 40, 0, 7); g.fill(); g.beginPath(); g.arc(398, 176, 12, 0, 7); g.fill(); g.font = '700 34px system-ui'; g.textAlign = 'center'; g.fillText('STARBOUND', 256, 420); }) })); emblem.rotation.x = -Math.PI / 2; emblem.position.set(-24.5, 0.012, 1.6); live.add(emblem);
  const planet = (c1, c2, ring) => (g, w, h) => { g.fillStyle = '#080a0e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.15})`; g.fillRect((i * 73) % w, (i * 151) % h, 2, 2); } const gr = g.createRadialGradient(w * 0.42, h * 0.42, 6, w * 0.5, h * 0.5, w * 0.3); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(w * 0.5, h * 0.5, w * 0.28, 0, 7); g.fill(); if (ring) { g.strokeStyle = 'rgba(230,210,170,0.8)'; g.lineWidth = 6; g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.44, w * 0.1, -0.3, 0, 7); g.stroke(); } };
  [['#ffd9a0', '#b4521c', false], ['#9fc4ff', '#1d3f7a', false], ['#f0dcb0', '#8a6a3a', true], ['#e8ebee', '#5c6670', false]].forEach(([a, b, r], i) => pic(1.1, 1.1, planet(a, b, r), -28.3 + i * 1.9, 1.85, 5.83, Math.PI));
  for (let i = 0; i < 3; i++) { A(cyl(0.008, 0.008, 0.9, keyM, -24.4 + i * 1.0, H - 0.45, -2.6, 6)); live.add(sph(0.12, glow(0xffe2b0, 2.4), -24.4 + i * 1.0, H - 0.95, -2.6)); }
  A(box(0.24, 0.02, 0.17, keyM, -24.6, 0.8, -2.45)); A(cyl(0.05, 0.06, 0.035, C(0xb5791f, 0.3, 0.8), -22.1, 0.8, -2.4, 14));
  const clockT = makeScreen(0.5, 0.5, 128, false); clockT.group.position.set(-19.4, 2.5, -5.83); live.add(clockT.group); let ckT = 0;
  tick.push((dt) => { ckT -= dt; if (ckT > 0) return; ckT = 1; clockT.redraw((g, w, h) => { const d = new Date(); g.fillStyle = '#e9ebec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a1e23'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); const hand = (a, len, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); g.stroke(); }; hand((d.getHours() % 12 + d.getMinutes() / 60) / 12 * 6.283, 30, 5, '#1a1e23'); hand(d.getMinutes() / 60 * 6.283, 46, 3, '#1a1e23'); hand(d.getSeconds() / 60 * 6.283, 50, 1.5, '#b5261e'); }); });
  // magazines and a low table between the benches
  A(box(1.1, 0.05, 0.6, C(0x3a4047, 0.5, 0.2), -22.2, 0.4, 4.9)); A(cyl(0.03, 0.03, 0.4, rail, -22.2, 0.2, 4.9, 8)); A(box(0.21, 0.01, 0.29, C(0x35506b, 0.8), -22.4, 0.432, 4.9)); A(box(0.21, 0.01, 0.29, C(0xb5791f, 0.8), -22.0, 0.436, 4.95)); addCol(-22.75, -21.65, 4.6, 5.2);

  // ---------- corridor ----------
  A(box(0.42, 1.1, 0.4, C(0xe9ebec, 0.5), -16.5, 0.55, -1.6)); A(cyl(0.15, 0.15, 0.42, new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.45, roughness: 0.1 }), -16.5, 1.31, -1.6, 14)); addCol(-16.75, -16.25, -1.82, -1.38);
  for (const [x, c] of [[4.4, 0x2f5d3a], [4.95, 0x2f5d8a]]) { A(cyl(0.2, 0.17, 0.62, C(c, 0.6), x, 0.31, -1.62, 14)); } addCol(4.15, 5.2, -1.85, -1.4);
  A(box(2.0, 0.07, 0.42, C(0x3a4047, 0.5, 0.2), 9.6, 0.45, 1.58)); for (const dx of [-0.85, 0.85]) A(box(0.06, 0.45, 0.4, rail, 9.6 + dx, 0.225, 1.58)); addCol(8.6, 10.6, 1.36, 1.8);
  pic(1.5, 0.95, (g, w, h) => { g.fillStyle = '#7a5c3a'; g.fillRect(0, 0, w, h); const cols = ['#f1efe8', '#fff3b0', '#cfe6ff', '#ffd6d6', '#d9f2d9']; for (let i = 0; i < 11; i++) { g.save(); g.translate(20 + (i % 4) * 60 + (i * 13) % 17, 18 + Math.floor(i / 4) * 52); g.rotate(((i * 37) % 11 - 5) * 0.02); g.fillStyle = cols[i % 5]; g.fillRect(0, 0, 46, 40); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(5, 8 + k * 7, 30 - (k * 5) % 12, 2); g.fillStyle = '#b5261e'; g.beginPath(); g.arc(23, 4, 3, 0, 7); g.fill(); g.restore(); } }, 5.2, 1.6, 1.835, Math.PI);

  // ---------- briefing room ----------
  pic(2.6, 1.3, (g, w, h) => { g.fillStyle = '#f4f5f3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1d3f7a'; g.lineWidth = 2; g.beginPath(); g.arc(60, 66, 18, 0, 7); g.stroke(); g.beginPath(); g.ellipse(60, 66, 46, 20, -0.3, 0, 7); g.stroke(); g.strokeStyle = '#b5261e'; g.beginPath(); g.moveTo(120, 40); g.lineTo(160, 40); g.lineTo(166, 70); g.lineTo(186, 70); g.lineTo(192, 40); g.lineTo(240, 40); g.stroke(); g.fillStyle = '#1a1e23'; g.font = '11px system-ui'; g.fillText('depth 0.33 %', 150, 86); g.fillText('repeat? period = ?', 124, 110); g.fillText('ORBIT', 44, 110); }, -17.83, 1.6, 7.2, Math.PI / 2);
  A(box(0.36, 0.14, 0.3, C(0xdcdcd8, 0.5), -12, H - 0.34, 8.6)); A(cyl(0.02, 0.02, 0.26, rail, -12, H - 0.14, 8.6, 6)); A(cyl(0.05, 0.05, 0.03, keyM, -12, H - 0.33, 8.78, 10).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) { const x = -13.9 + i * 1.27; A(box(0.3, 0.012, 0.21, C(0x8f969d, 0.4, 0.6), x, 0.8, 5.75)); const lid = box(0.3, 0.2, 0.01, C(0x8f969d, 0.4, 0.6), x, 0.9, 5.86); lid.rotation.x = -0.25; A(lid); A(box(0.21, 0.008, 0.29, paperM, x + 0.1, 0.8, 6.7)); A(cyl(0.032, 0.028, 0.11, new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, roughness: 0.05 }), x - 0.3, 0.855, 6.6, 10)); }
  A(cyl(0.11, 0.13, 0.04, keyM, -12, 0.815, 6.2, 16));

  // ---------- laboratory ----------
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.32, roughness: 0.05 }); const liq = [C(0x3a8fb7, 0.3), C(0xb5791f, 0.3), C(0x4a9a62, 0.3)];
  for (let i = 0; i < 7; i++) { const z = 4.1 + i * 0.75, x = -5.25 - (i % 2) * 0.22; if (i % 3 === 0) { A(cyl(0.035, 0.07, 0.16, glassM, x, 1.03, z, 12)); A(cyl(0.03, 0.062, 0.07, liq[i % 3], x, 0.985, z, 12)); } else { A(cyl(0.045, 0.045, 0.13, glassM, x, 1.015, z, 12)); A(cyl(0.04, 0.04, 0.05 + (i % 3) * 0.02, liq[i % 3], x, 0.98, z, 12)); } }
  for (const z of [4.8, 7.3]) { A(cyl(0.17, 0.17, 0.05, keyM, -4.6, 0.62, z, 16)); A(cyl(0.025, 0.025, 0.6, rail, -4.6, 0.3, z, 8)); A(cyl(0.2, 0.2, 0.02, rail, -4.6, 0.01, z, 16)); }
  const scopeS = makeScreen(0.3, 0.2, 128, false); const sg = new THREE.Group(); sg.add(box(0.42, 0.28, 0.3, C(0xc9cdd0, 0.5)), scopeS.group); scopeS.group.position.set(-0.03, 0.01, 0.152); sg.add(cyl(0.02, 0.02, 0.02, keyM, 0.16, 0.06, 0.155, 8).rotateX(Math.PI / 2)); sg.position.set(-5.4, 1.09, 6.0); sg.rotation.y = Math.PI / 2; live.add(sg); let scT = 0;
  tick.push((dt, t) => { scT -= dt; if (scT > 0) return; scT = 0.1; scopeS.redraw((g, w, h) => { g.fillStyle = '#04120a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#124a2a'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * w / 6, 0); g.lineTo(i * w / 6, h); g.stroke(); } g.strokeStyle = '#7dffb0'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 3) { const u = (x / w + t * 0.15) % 1; const dip = Math.abs(u - 0.5) < 0.07 ? 16 : 0; const y = h * 0.4 + dip + Math.sin(x * 0.9 + t * 9) * 1.5; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }); });
  for (let i = 0; i < 4; i++) A(box(0.26, 0.2, 0.34, i % 2 ? C(0x35506b, 0.6) : C(0x9a3b2e, 0.6), 5.72, 0.1 + Math.floor(i / 2) * 0.21, 9.4 + (i % 2) * 0.4));
  pic(0.5, 0.5, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181b'; g.beginPath(); g.moveTo(w / 2, 30); g.lineTo(w - 36, h - 44); g.lineTo(36, h - 44); g.fill(); g.fillStyle = '#f2c230'; g.fillRect(w / 2 - 6, 90, 12, 60); g.fillRect(w / 2 - 6, 160, 12, 12); g.fillStyle = '#16181b'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.fillText('CLEAN OPTICS', w / 2, h - 14); }, 5.83, 1.75, 3.2, -Math.PI / 2);

  // ---------- engineering bay ----------
  pic(4.0, 1.3, (g, w, h) => { g.fillStyle = '#8a7a5c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 6; y < h; y += 8) for (let x = 6; x < w; x += 8) g.fillRect(x, y, 2, 2); g.fillStyle = '#1b1e22'; const T = (x, y, a, b) => g.fillRect(x, y, a, b); for (let i = 0; i < 9; i++) { const x = 14 + i * 27; T(x, 14, 5, 38 + (i % 3) * 8); T(x - 4, 10, 13, 8); } for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + i * 46, 78, 7 + i, 0, 7); g.lineWidth = 4; g.strokeStyle = '#1b1e22'; g.stroke(); } g.fillStyle = '#b5261e'; T(206, 60, 30, 12); g.fillStyle = '#d8a520'; T(170, 64, 24, 8); }, 19.83, 1.75, 8.5, -Math.PI / 2, 256);
  A(box(0.85, 0.06, 3.6, C(0x6b5a44, 0.6), 19.35, 0.9, 8.5)); for (const z of [6.85, 10.15]) A(box(0.8, 0.9, 0.06, ventM, 19.35, 0.45, z)); A(box(0.8, 0.04, 3.5, ventM, 19.35, 0.3, 8.5)); addCol(18.9, 19.8, 6.7, 10.3);
  A(box(0.2, 0.16, 0.16, C(0x35506b, 0.4, 0.6), 19.3, 1.01, 7.2)); A(cyl(0.09, 0.09, 0.06, rail, 19.25, 0.96, 8.0, 14)); A(box(0.3, 0.05, 0.3, C(0xb98a2e, 0.4, 0.8), 19.3, 0.955, 8.9)); A(cyl(0.012, 0.012, 0.22, rail, 19.3, 1.04, 9.5, 6)); A(box(0.14, 0.1, 0.2, C(0xb5791f, 0.5), 19.3, 0.98, 9.7));
  for (const [x, z, s] of [[17.3, 3.0, 1], [18.3, 3.05, 0.8], [17.5, 3.0, 0.7]]) { const y = s === 0.7 ? 1.0 + 0.3 : s * 0.4; A(box(0.9 * s, 0.8 * s, 0.7 * s, C(0x6b5a44, 0.8), x, y, z)); A(box(0.92 * s, 0.05, 0.72 * s, ventM, x, y + 0.2 * s, z)); } addCol(16.8, 18.8, 2.6, 3.45);
  const rack = new THREE.Group(); rack.add(box(0.7, 2.0, 0.6, ventM, 0, 1, 0)); for (let i = 0; i < 6; i++) rack.add(box(0.62, 0.26, 0.02, C(0x2a2f35, 0.4, 0.5), 0, 0.3 + i * 0.3, 0.3)); rack.position.set(6.55, 0, 10.6); rack.rotation.y = Math.PI / 2; A(rack); const rack2 = rack.clone(); rack2.position.z = 11.5; A(rack2); addCol(6.2, 6.9, 10.2, 11.9);
  const leds = []; for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i += 2) for (let k = 0; k < 2; k++) { const l = box(0.03, 0.03, 0.01, new THREE.MeshBasicMaterial({ color: 0x6fbf8b }), 6.87, 0.36 + i * 0.3, 10.4 + r * 0.9 + k * 0.07); live.add(l); leds.push(l); }
  let ledT = 0; tick.push((dt) => { ledT -= dt; if (ledT > 0) return; ledT = 0.28; for (const l of leds) { const v = Math.random(); l.material.color.setHex(v < 0.08 ? 0xe5564b : v < 0.3 ? 0x1f3a2a : 0x7dffb0); } });
  const lane = new THREE.MeshBasicMaterial({ color: 0xd8a520 }); for (const [x, z, w, d] of [[13, 4.6, 0.08, 4.6], [10.6, 6.9, 4.9, 0.08]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lane); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.009, z); live.add(p); }
  const lad = new THREE.Group(); for (const sx of [-0.3, 0.3]) { const r = box(0.05, 2.3, 0.05, C(0xd8a520, 0.5, 0.4), sx, 1.1, 0); r.rotation.x = 0.28; lad.add(r); } for (let i = 0; i < 6; i++) lad.add(box(0.6, 0.04, 0.16, rail, 0, 0.3 + i * 0.34, -0.25 + i * 0.1)); lad.add(box(0.7, 0.05, 0.6, rail, 0, 2.15, 0.45), box(0.05, 2.15, 0.05, C(0xd8a520, 0.5, 0.4), -0.3, 1.07, 0.7), box(0.05, 2.15, 0.05, C(0xd8a520, 0.5, 0.4), 0.3, 1.07, 0.7)); lad.position.set(10.6, 0, 11.6); lad.rotation.y = 0.5; A(lad); addCol(10.1, 11.1, 11.1, 12.3);

  // ---------- flight preparation ----------
  A(box(0.32, 0.04, 2.4, ventM, -6.34, 1.45, -4.6)); for (let i = 0; i < 3; i++) { const z = -5.4 + i * 0.8; A(sph(0.16, C(0xe9ebec, 0.35, 0.1), -6.36, 1.63, z)); A(sph(0.118, C(0x1a2a4a, 0.1, 0.8), -6.44, 1.64, z, 0.8, 0.75, 0.9)); A(cyl(0.13, 0.14, 0.05, rail, -6.36, 1.5, z, 14)); }
  for (let i = 0; i < 2; i++) { const s = new THREE.Group(); s.add(box(0.5, 0.95, 0.2, C(0xd8731f, 0.7), 0, 1.45, 0), box(0.44, 0.75, 0.2, C(0xd8731f, 0.7), 0, 0.62, 0), box(0.12, 0.12, 0.21, C(0xe9ebec, 0.6), 0.14, 1.7, 0), cyl(0.012, 0.012, 0.3, rail, 0, 2.05, 0, 6)); s.position.set(-16.6, 0, -7.2 - i * 0.9); s.rotation.y = Math.PI / 2; A(s); } A(box(0.06, 0.06, 2.0, rail, -16.6, 2.2, -7.6)); addCol(-17.0, -16.3, -8.5, -6.9);
  for (let i = 0; i < 3; i++) { A(box(0.14, 0.3, 0.3, C(0xe8e8e6, 0.6), -13.2 + i * 0.9, 0.15, -6.55)); A(box(0.15, 0.06, 0.34, ventM, -13.2 + i * 0.9, 0.03, -6.53)); }
  const bag = cyl(0.2, 0.2, 0.7, C(0x35506b, 0.9), -10, 0.2, -4.0, 14); bag.rotation.z = Math.PI / 2; A(bag); A(box(0.5, 0.03, 0.05, keyM, -10, 0.41, -4.0)); addCol(-10.4, -9.6, -4.25, -3.75);
  for (let i = 0; i < 7; i++) { A(box(0.04, 0.14, 0.02, rail, -17.2 + i * 0.95 + 0.82, 1.1, -11.26)); A(box(0.3, 0.1, 0.01, C(0xe9ebec, 0.7), -17.2 + i * 0.95 + 0.5, 1.75, -11.265)); }

  // ---------- mission control ----------
  const flag = (x, cols) => pic(0.95, 0.6, (g, w, h) => { cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h / cols.length, w, h / cols.length + 1); }); if (cols.length === 3 && cols[1] === '#fcd116') { g.fillStyle = '#000'; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2.513, b = a + 1.2566; g.lineTo(w / 2 + Math.cos(a) * h * 0.14, h / 2 + Math.sin(a) * h * 0.14); g.lineTo(w / 2 + Math.cos(b) * h * 0.055, h / 2 + Math.sin(b) * h * 0.055); } g.fill(); } }, -5.83, 2.45, x, Math.PI / 2, 256);
  flag(-12.6, ['#ce1126', '#fcd116', '#006b3f']); flag(-11.2, ['#12161b', '#b5791f', '#12161b']);
  const side = [makeScreen(2.2, 1.2, 384), makeScreen(2.2, 1.2, 384)]; side.forEach((s, i) => { s.group.position.set(-5.83, 1.75, -4.4 - i * 2.4); s.group.rotation.y = Math.PI / 2; live.add(s.group); }); let sdT = 0;
  tick.push((dt, t) => { sdT -= dt; if (sdT > 0) return; sdT = 0.5; side[0].redraw((g, w, h) => { g.fillStyle = '#07090c'; g.fillRect(0, 0, w, h); g.fillStyle = '#8d97a3'; g.font = `600 ${h * 0.09}px system-ui`; g.fillText('GROUND STATIONS', 12, h * 0.13); ['ACCRA', 'MADRID', 'CANBERRA', 'GOLDSTONE'].forEach((n, i) => { const up = Math.sin(t * 0.2 + i * 1.7) > -0.3; g.fillStyle = '#c3cad1'; g.font = `${h * 0.085}px ui-monospace, monospace`; g.fillText(n, 12, h * 0.32 + i * h * 0.17); g.fillStyle = up ? '#6fbf8b' : '#f2a23a'; g.fillText(up ? '● IN VIEW' : '◆ BELOW HORIZON', w * 0.45, h * 0.32 + i * h * 0.17); }); });
    side[1].redraw((g, w, h) => { g.fillStyle = '#07090c'; g.fillRect(0, 0, w, h); g.fillStyle = '#8d97a3'; g.font = `600 ${h * 0.09}px system-ui`; g.fillText('SPACE WEATHER', 12, h * 0.13); g.strokeStyle = '#6fa8c4'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 4) { const y = h * 0.6 + Math.sin(x * 0.03 + t * 0.4) * h * 0.12 + Math.sin(x * 0.11 + t) * h * 0.04; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.fillStyle = '#6fbf8b'; g.font = `${h * 0.085}px ui-monospace, monospace`; g.fillText('● SOLAR ACTIVITY: QUIET', 12, h * 0.92); }); });
  const bar = []; for (let i = 0; i < 13; i++) { const l = box(0.24, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0x1f3a2a }), 1 + i * 1.0, 3.62 - 0.12, -15.8); live.add(l); bar.push(l); } let barT = 0, barI = 0;
  tick.push((dt) => { barT -= dt; if (barT > 0) return; barT = 0.12; barI = (barI + 1) % bar.length; bar.forEach((l, i) => l.material.color.setHex(i === barI ? 0xf2a23a : Math.abs(i - barI) < 3 ? 0x7dffb0 : 0x1f3a2a)); });
  A(box(11, 0.04, 0.06, rail, 14.5, 1.0, -5.9)); for (let i = 0; i <= 5; i++) A(box(0.05, 1.0, 0.05, rail, 9 + i * 2.2, 0.5, -5.9)); const rg = box(10.9, 0.8, 0.02, M.glass, 14.5, 0.55, -5.9); live.add(rg); addCol(9, 20, -6.0, -5.8);

  // ---------- the world outside ----------
  const lampGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a8).multiplyScalar(2.5), fog: false });
  const out = (hex) => mats['o' + hex] || (mats['o' + hex] = new THREE.MeshBasicMaterial({ color: hex, fog: false }));
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), out(0x15181a)); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.08; live.add(gnd);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(232, 9), out(0x23272b)); road.rotation.x = -Math.PI / 2; road.position.set(-148, -0.06, 14); road.rotation.z = -0.07; live.add(road);
  for (let i = 0; i < 14; i++) { const x = -40 - i * 16, z = 10 + (i * 16) * 0.07 + (i % 2 ? 6.5 : -6.5); A(box(0.18, 5, 0.18, out(0x2b3036), x, 2.5, z)); A(sph(0.3, lampGlow, x, 5.1, z)); }
  const dish = (x, z, s) => { const g = new THREE.Group(); g.add(cyl(0.5 * s, 0.9 * s, 6 * s, out(0x9aa1a8), 0, 3 * s, 0, 10)); const d = new THREE.Mesh(new THREE.SphereGeometry(5 * s, 20, 10, 0, Math.PI * 2, 0, 0.75), new THREE.MeshBasicMaterial({ color: 0xcfd3d6, side: THREE.DoubleSide, fog: false })); d.rotation.x = Math.PI - 0.7; d.position.set(0, 9.6 * s, -1.6 * s); g.add(d); g.position.set(x, 0, z); g.rotation.y = 2.6; A(g); };
  dish(-6, 62, 1); dish(14, 78, 1.3); dish(-30, 84, 0.9);
  A(box(46, 14, 30, out(0x1e2327), 62, 7, 56)); A(box(46.4, 0.6, 30.4, out(0x2b3036), 62, 14.2, 56)); for (let i = 0; i < 6; i++) A(box(3, 1.2, 0.2, lampGlow, 44 + i * 7, 9, 40.9));
  for (let i = 0; i < 26; i++) { const a = 0.7 + i * 0.16, r = 120 + (i * 37) % 60; const c = new THREE.Mesh(new THREE.ConeGeometry(3 + (i % 3), 10 + (i % 4) * 3, 7), out(0x101a14)); c.position.set(Math.cos(a) * r, 6, Math.sin(a) * r); A(c); }
  { const n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd() * 6.283, e = 0.12 + rnd() * 1.3; pos[i * 3] = Math.cos(a) * Math.cos(e) * 640; pos[i * 3 + 1] = Math.sin(e) * 640; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 640; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); live.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }))); }
  // entrance: flags, planters, bollards
  for (let i = 0; i < 3; i++) { const z = -11 + i * 3; A(cyl(0.06, 0.08, 8, out(0xb9bec4), -40, 4, z, 8)); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15, 6, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false, map: canvasTex(96, 58, (g, w, h) => { const c = [['#ce1126', '#fcd116', '#006b3f'], ['#12161b', '#b5791f', '#12161b'], ['#0b3d91', '#ffffff', '#0b3d91']][i]; c.forEach((col, k) => { g.fillStyle = col; g.fillRect(0, k * h / 3, w, h / 3 + 1); }); }) })); f.position.set(-40.98, 7.3, z); live.add(f); const base = f.geometry.attributes.position.array.slice(); tick.push((dt, t) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = base[k * 3]; p.array[k * 3 + 2] = Math.sin(x * 3 + t * 3 + i) * 0.09 * (0.95 - x); } p.needsUpdate = true; }); }
  for (const z of [-7.2, 7.2]) { A(box(1.2, 0.6, 3.2, out(0x2b3036), -33, 0.3, z)); for (let k = 0; k < 4; k++) A(sph(0.5, out(0x163322), -33, 0.9, z - 1.1 + k * 0.75)); }
  for (let i = 0; i < 7; i++) { if (Math.abs(-6 + i * 2) < 3) continue; A(cyl(0.12, 0.12, 0.8, out(0xb5791f), -36.5, 0.4, -6 + i * 2, 8)); }
  // launch pad searchlights
  const beamM = new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beams = [[-232, 62], [-286, 8], [-244, -6]].map(([x, z], i) => { const b = new THREE.Mesh(new THREE.ConeGeometry(7, 90, 16, 1, true), beamM); b.geometry.translate(0, -45, 0); b.rotation.x = Math.PI; const piv = new THREE.Group(); piv.position.set(x, 0, z); piv.add(b); live.add(piv); return { piv, i, tx: -260 - x, tz: 30 - z }; });
  tick.push((dt, t) => { for (const b of beams) { const a = Math.atan2(b.tx, b.tz); const tilt = 0.5 + Math.sin(t * 0.3 + b.i * 2) * 0.12; b.piv.rotation.set(0, a, 0); b.piv.children[0].rotation.x = Math.PI - tilt; } });

  // ---------- merge the static pieces ----------
  scene.add(G); G.updateMatrixWorld(true); const groups = new Map();
  G.traverse((o) => { if (!o.isMesh) return; const k = o.material.uuid; if (!groups.has(k)) groups.set(k, { mat: o.material, list: [] }); let g = o.geometry.clone(); if (g.index) g = g.toNonIndexed(); g.applyMatrix4(o.matrixWorld); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); groups.get(k).list.push(g); });
  scene.remove(G);
  for (const { mat, list } of groups.values()) { try { const merged = mergeGeometries(list, false); if (merged) scene.add(new THREE.Mesh(merged, mat)); } catch (e) { /* skip a group that will not merge */ } for (const g of list) g.dispose(); }
}
