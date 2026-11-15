// Procedural models, textures and materials. No external assets are used.
import * as THREE from 'three';
import { PAYLOADS, VEHICLES } from './catalog.js';

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function speckle(g, w, h, n, alpha, seed = 1) { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${alpha * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
export const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));

export const M = {
  get floor() { return once('floor', () => std(0xffffff, 0.55, 0.05, { map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5b6168'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, 0.07, 3); g.strokeStyle = 'rgba(20,24,28,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }, [1, 1]) })); },
  get carpet() { return once('carpet', () => std(0xffffff, 0.95, 0, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2d3640'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.09, 5); }, [1, 1]) })); },
  get wall() { return once('wall', () => std(0xffffff, 0.85, 0, { map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c9cdd0'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, 0.03, 7); g.fillStyle = '#8a9096'; g.fillRect(0, h - 26, w, 26); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 2, h); g.fillRect(0, h - 28, w, 2); }, [1, 1]) })); },
  get ceiling() { return once('ceil', () => std(0x30353b, 0.9)); },
  get trim() { return once('trim', () => std(0x22272d, 0.5, 0.6)); },
  get metal() { return once('metal', () => std(0x9aa1a8, 0.38, 0.85)); },
  get darkMetal() { return once('dmetal', () => std(0x2a2f35, 0.45, 0.7)); },
  get white() { return once('white', () => std(0xe9ebec, 0.6, 0.05)); },
  get desk() { return once('desk', () => std(0x3a4047, 0.6, 0.2)); },
  get deskTop() { return once('desktop', () => std(0xd8dadb, 0.45, 0.05)); },
  get amber() { return once('amber', () => std(0xf2a23a, 0.5, 0.2)); },
  get glass() { return once('glass', () => new THREE.MeshPhysicalMaterial({ color: 0xbfd6dc, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide })); },
  get panelLight() { return once('plight', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf3f1e8).multiplyScalar(4.5) })); },
  get foil() { return once('foil', () => std(0xffffff, 0.34, 0.9, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b98a2e'; g.fillRect(0, 0, w, h); const r = rng(11); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,220,140' : '70,45,5'},${0.10 + r() * 0.16})`; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + r() * 40 - 20, y + r() * 40 - 20); g.lineTo(x + r() * 40 - 20, y + r() * 40 - 20); g.fill(); } }, [1, 1]) })); },
  get solar() { return once('solar', () => std(0xffffff, 0.25, 0.5, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#0f1b3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6f7f9e'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { g.strokeRect(i * 32 + 0.5, 0, 0.5, h); g.strokeRect(0, i * 32 + 0.5, w, 0.5); } g.fillStyle = 'rgba(120,150,255,0.08)'; g.fillRect(0, 0, w, h / 2); }, [1, 1]) })); },
  get black() { return once('black', () => std(0x08090a, 0.9)); },
  get rocketWhite() { return once('rw', () => std(0xeceeef, 0.42, 0.1)); },
  get rocketDark() { return once('rd', () => std(0x1b1e22, 0.5, 0.4)); },
};

export function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return m; }

// A display driven by a 2D canvas. redraw(fn) repaints it.
export function makeScreen(w, h, px = 512, bezel = true) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); face.position.z = 0.026; g.add(face);
  if (bezel) g.add(box(w + 0.06, h + 0.06, 0.05, M.black));
  const ctx = c.getContext('2d');
  return { group: g, face, ctx, canvas: c, redraw(fn) { fn(ctx, c.width, c.height); t.needsUpdate = true; } };
}
export function paintPanel(g, w, h, title, lines, accent = '#f2a23a') {
  g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h);
  g.fillStyle = accent; g.fillRect(0, 0, w, 6);
  g.fillStyle = '#8d97a3'; g.font = `600 ${Math.round(h * 0.07)}px system-ui, sans-serif`; g.fillText(title.toUpperCase(), 18, h * 0.14);
  let y = h * 0.27; const fs = Math.round(h * 0.075);
  for (const ln of lines) {
    const [k, v, col] = Array.isArray(ln) ? ln : [ln, '', null];
    g.font = `${fs}px system-ui, sans-serif`; g.fillStyle = '#aab3bd'; g.fillText(k, 18, y);
    if (v !== '') { g.font = `600 ${fs}px ui-monospace, monospace`; g.fillStyle = col || '#e8ebee'; const tw = g.measureText(v).width; g.fillText(v, w - 18 - tw, y); }
    y += fs * 1.45;
  }
}

// ---------- People ----------
export const SKINS = [0xf0c8a4, 0xd7a574, 0xb9794d, 0x8d5a34, 0x6b4226, 0x4a2c17];
export const HAIR_COLOURS = [0x0e0b09, 0x3a2416, 0x6b4a2b, 0x9c3b2a, 0xbfbfbf];
export const HAIR_STYLES = [['short', 'Short'], ['fade', 'Fade'], ['afro', 'Afro'], ['bun', 'Bun'], ['long', 'Long'], ['braids', 'Braids']];
export const SUITS = [0x24364a, 0x2e4a3f, 0x4a4f55, 0x6b2f3a, 0x3a2f5c, 0xdfe2e4];
export const BUILDS = [['f', 'Slim'], ['n', 'Medium'], ['m', 'Broad']];
export const DEFAULT_AVATAR = { skin: 0x8d5a34, hair: 0x0e0b09, hairStyle: 'short', jacket: 0x24364a, build: 'n' };

export function makeCharacter(o = {}) {
  const { skin = 0x8d5a34, hair = 0x0e0b09, jacket = 0x2f4858, trousers = 0x1c2127, hairStyle = 'short', seated = false, scale = 1, accent = 0xf2a23a, build = 'n', glasses = false, outfit = 'crew', carry = null, helmet = false } = o;
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const astro = outfit === 'astronaut'; const sk = std(skin, 0.58), jk = std(jacket, astro ? 0.7 : 0.78), tr = astro ? jk : std(trousers, 0.88), hr = std(hair, 0.62), dk = std(0x0e0f11, 0.5), white = std(0xf4f2ee, 0.35);
  const lip = std(new THREE.Color(skin).lerp(new THREE.Color(0x7a2a2a), 0.55).getHex(), 0.5);
  const cap = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), m);
  const sph = (r, m, sx = 1, sy = 1, sz = 1) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m); e.scale.set(sx, sy, sz); return e; };
  const shW = build === 'm' ? 1.1 : build === 'f' ? 0.92 : 1.0, hipW = build === 'm' ? 0.96 : build === 'f' ? 1.05 : 1.0;
  const hipY = seated ? 0.5 : 0.9;
  // legs: hip pivot -> thigh -> knee pivot -> shin -> shoe
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.088 * hipW, hipY, 0); body.add(leg);
    const th = cap(0.07, 0.29, tr); th.position.y = -0.21; leg.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.43; leg.add(knee);
    const shin = cap(0.055, 0.3, tr); shin.position.y = -0.2; knee.add(shin);
    const shoe = cap(astro ? 0.054 : 0.046, 0.13, astro ? std(0xe8e8e6, 0.6) : dk); shoe.rotation.x = Math.PI / 2; shoe.scale.y = 1; shoe.position.set(0, -0.425, 0.045); knee.add(shoe);
    if (astro) { knee.add(cyl(0.062, 0.06, 0.05, std(0xe8e8e6, 0.6), 0, -0.33, 0, 14)); const pk = box(0.085, 0.1, 0.03, jk, sx * 0.045, -0.24, 0.055); leg.add(pk); leg.add(box(0.09, 0.012, 0.032, dk, sx * 0.045, -0.19, 0.056)); }
    if (seated) { leg.rotation.x = -Math.PI / 2; knee.rotation.x = Math.PI / 2; }
    leg.userData.knee = knee; legs.push(leg);
  }
  const pelvis = sph(1, tr, 0.145 * hipW, 0.09, 0.1); pelvis.position.y = hipY + 0.015; body.add(pelvis);
  // torso: a turned profile gives a tapered waist, chest and shoulders
  const prof = [[0.118, 0], [0.128, 0.08], [0.142 * shW, 0.22], [0.158 * shW, 0.34], [0.15 * shW, 0.41], [0.1 * shW, 0.46], [0.05, 0.49]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), jk); torso.scale.z = 0.66; torso.position.y = hipY + 0.05; body.add(torso);
  const hem = cyl(0.124, 0.13, 0.05, jk, 0, hipY + 0.05, 0, 24); hem.scale.z = 0.7; body.add(hem);
  body.add(box(0.012, 0.34, 0.012, dk, 0, hipY + 0.25, 0.098));
  for (const sx of [-1, 1]) { const c = box(0.05, 0.016, 0.03, jk, sx * 0.032, hipY + 0.515, 0.045); c.rotation.z = sx * 0.5; body.add(c); }
  const badge = box(0.05, 0.065, 0.006, white, 0.075, hipY + 0.33, 0.1); badge.rotation.x = -0.08; body.add(badge); body.add(box(0.05, 0.012, 0.007, std(accent, 0.5), 0.075, hipY + 0.355, 0.101));
  if (astro) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 22), std(0xb9bec4, 0.3, 0.85)); ring.rotation.x = Math.PI / 2; ring.position.y = hipY + 0.535; body.add(ring); body.add(box(0.11, 0.03, 0.008, white, -0.07, hipY + 0.36, 0.099)); body.add(box(0.2, 0.05, 0.14, std(0x2a2f35, 0.5, 0.4), 0, hipY + 0.07, 0)); const pk = box(0.16, 0.22, 0.07, std(0xdcdcd8, 0.6), 0, hipY + 0.3, -0.125); body.add(pk); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.178 * shW, hipY + 0.455, 0); body.add(a);
    a.add(sph(0.047, jk)); const up = cap(0.044, 0.21, jk); up.position.y = -0.15; a.add(up);
    const fore = new THREE.Group(); fore.position.y = -0.29; a.add(fore);
    const lo = cap(0.038, 0.2, jk); lo.position.y = -0.125; fore.add(lo);
    fore.add(cyl(0.042, 0.042, 0.022, std(accent, 0.5), 0, -0.225, 0, 14));
    const hand = sph(0.04, sk, 0.8, 1.15, 0.55); hand.position.y = -0.285; fore.add(hand);
    if (astro) { const pt = cyl(0.047, 0.047, 0.05, sx < 0 ? std(accent, 0.5) : white, 0, -0.1, 0, 14); a.add(pt); fore.add(cyl(0.045, 0.048, 0.05, std(0xe8e8e6, 0.6), 0, -0.24, 0, 14)); }
    a.rotation.z = sx * 0.085; fore.rotation.x = -0.14; if (seated) { a.rotation.x = -0.5; fore.rotation.x = -0.95; }
    a.userData.fore = fore; arms.push(a);
  }
  body.add(cyl(0.04, 0.046, 0.085, sk, 0, hipY + 0.565, 0, 14));
  const head = new THREE.Group(); head.position.y = hipY + 0.595; body.add(head);
  if (helmet) { const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xdfeeff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false })); dome.position.y = 0.12; dome.renderOrder = 3; head.add(dome); const shell = new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 18, Math.PI * 0.62, Math.PI * 1.76), std(0xf1f1ee, 0.4, 0.1)); shell.position.y = 0.12; shell.rotation.y = Math.PI / 2; head.add(shell); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 24), std(0xb9bec4, 0.3, 0.85)); rim.rotation.x = Math.PI / 2; rim.position.y = -0.045; head.add(rim); const vis = new THREE.Mesh(new THREE.SphereGeometry(0.207, 20, 10, Math.PI * 0.3, Math.PI * 0.4, Math.PI * 0.2, Math.PI * 0.16), std(0xd8a520, 0.2, 0.9)); vis.position.y = 0.12; head.add(vis); }
  const skull = sph(0.1, sk, 0.92, 1.12, 1.0); skull.position.y = 0.118; head.add(skull);
  const jaw = sph(0.076, sk, 0.9, 0.82, 0.92); jaw.position.set(0, 0.062, 0.014); head.add(jaw);
  for (const sx of [-1, 1]) {
    const eye = sph(0.0155, white, 1, 0.62, 0.45); eye.position.set(sx * 0.035, 0.128, 0.087); head.add(eye);
    const iris = sph(0.0082, std(0x2a1a10, 0.3), 1, 1, 0.5); iris.position.set(sx * 0.035, 0.128, 0.0935); head.add(iris);
    const brow = box(0.034, 0.0055, 0.008, hr, sx * 0.036, 0.151, 0.089); brow.rotation.z = sx * 0.05; head.add(brow);
    const ear = sph(0.02, sk, 0.45, 1, 0.75); ear.position.set(sx * 0.093, 0.115, 0.0); head.add(ear);
  }
  const nose = sph(0.0125, sk, 0.85, 1.25, 1); nose.position.set(0, 0.096, 0.098); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0042, 6, 12, Math.PI), lip); mouth.rotation.z = Math.PI; mouth.position.set(0, 0.066, 0.086); mouth.scale.y = 0.45; head.add(mouth);
  if (glasses) { for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0028, 6, 18), dk); r.position.set(sx * 0.035, 0.128, 0.097); head.add(r); } head.add(box(0.016, 0.003, 0.003, dk, 0, 0.13, 0.098)); }
  // hair
  const capGeo = (r, phi) => new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, Math.PI * phi);
  const addCap = (r = 0.106, phi = 0.52) => { const m = new THREE.Mesh(capGeo(r, phi), hr); m.scale.set(0.94, 1.13, 1.03); m.position.set(0, 0.122, -0.008); m.rotation.x = -0.2; head.add(m); };
  if (hairStyle === 'short') addCap();
  if (hairStyle === 'fade') addCap(0.103, 0.4);
  if (hairStyle === 'afro') { addCap(); const af = sph(0.124, hr, 1.1, 0.96, 1.0); af.position.set(0, 0.2, -0.045); head.add(af); }
  if (hairStyle === 'bun') { addCap(); const b = sph(0.05, hr); b.position.set(0, 0.245, -0.055); head.add(b); }
  if (hairStyle === 'long') { addCap(0.108, 0.55); const back = cap(0.088, 0.19, hr); back.scale.z = 0.5; back.position.set(0, 0.03, -0.068); head.add(back); for (const sx of [-1, 1]) { const lk = cap(0.026, 0.16, hr); lk.position.set(sx * 0.092, 0.04, 0.012); head.add(lk); } }
  if (hairStyle === 'braids') { addCap(0.107, 0.5); for (let i = 0; i < 11; i++) { const a = Math.PI * 0.18 + (i / 10) * Math.PI * 1.64; const br = cap(0.0105, 0.25, hr); br.position.set(Math.sin(a) * 0.092, 0.01, -Math.cos(a) * 0.088 * (Math.abs(Math.sin(a)) > 0.9 ? 0.2 : 1)); head.add(br); const bead = sph(0.013, std(accent, 0.4)); bead.position.set(br.position.x, -0.13, br.position.z); head.add(bead); } }
  const eyes = head.children.filter((c) => c.geometry && c.geometry.parameters && (Math.abs(c.geometry.parameters.radius - 0.0155) < 1e-6 || Math.abs(c.geometry.parameters.radius - 0.0082) < 1e-6));
  let prop = null; if (carry === 'tablet') { prop = box(0.2, 0.012, 0.14, dk); prop.add(box(0.18, 0.004, 0.12, new THREE.MeshBasicMaterial({ color: 0x6fa8c4 }), 0, 0.008, 0)); arms[0].userData.fore.add(prop); prop.position.set(0.02, -0.3, 0.06); prop.rotation.set(0.5, 0, 0.3); }
  g.scale.setScalar(scale);
  let blinkT = 2 + Math.random() * 4, waveT = 0, bodyYaw = 0, t = Math.random() * 10, yaw = 0, talk = 0, phase = 0, walkAmt = 0;
  const wp = new THREE.Vector3();
  return {
    group: g, head, arms, legs, talking: false,
    update(dt, camPos, opt = {}) {
      t += dt; torso.scale.y = 1 + Math.sin(t * 1.3) * 0.01; body.rotation.z = Math.sin(t * 0.45) * 0.006;
      let want = 0, pitch = 0;
      if (camPos && !opt.noLook) { g.getWorldPosition(wp); const dx = camPos.x - wp.x, dz = camPos.z - wp.z; const d = Math.hypot(dx, dz);
        if (d < 6) { let a = Math.atan2(dx, dz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); want = THREE.MathUtils.clamp(a - bodyYaw, -1.1, 1.1); pitch = -0.04; } }
      yaw += (want - yaw) * Math.min(1, dt * 4); head.rotation.y = yaw; head.rotation.x = pitch + (this.talking ? Math.sin(t * 5.5) * 0.03 : 0);
      talk += ((this.talking ? 1 : 0) - talk) * Math.min(1, dt * 5); mouth.scale.y = 0.45 + (this.talking ? Math.abs(Math.sin(t * 11)) * 0.9 : 0);
      blinkT -= dt; const shut = blinkT < 0.12; if (blinkT < 0) blinkT = 2.5 + Math.random() * 4; for (const e of eyes) e.scale.y = shut ? 0.08 : (e.geometry.parameters.radius > 0.01 ? 0.62 : 1);
      if (opt.wave) waveT = 1.8; waveT = Math.max(0, waveT - dt); const wv = Math.min(1, waveT * 3) * (waveT > 0 ? 1 : 0);
      if (opt.turn != null) { bodyYaw += (opt.turn - bodyYaw) * Math.min(1, dt * 3); body.rotation.y = bodyYaw; }
      const w = opt.walk || 0; walkAmt += (w - walkAmt) * Math.min(1, dt * 8); const moving = walkAmt > 0.03; phase += dt * (4.6 + 3.6 * w) * (moving ? 1 : 0);
      if (!seated) {
        const amp = moving ? Math.min(0.62, 0.26 + 0.36 * walkAmt) * Math.min(1, walkAmt * 4) : 0; const sp = Math.sin(phase), sw = sp * amp;
        legs[0].rotation.x = sw; legs[1].rotation.x = -sw; legs[0].userData.knee.rotation.x = Math.max(0, -Math.cos(phase + 0.6)) * 1.25 * amp; legs[1].userData.knee.rotation.x = Math.max(0, Math.cos(phase + 0.6)) * 1.25 * amp;
        if (opt.turn == null) body.rotation.y = -sp * 0.07 * (amp / 0.6); head.rotation.y += sp * 0.05 * (amp / 0.6); body.rotation.x = amp * 0.06; body.rotation.z = Math.sin(t * 0.45) * 0.006 + Math.cos(phase) * 0.018 * (amp / 0.6);
        const carryHold = prop ? 1 : 0;
        arms[0].rotation.x = carryHold ? -0.55 : -sw * 0.75; arms[0].userData.fore.rotation.x = carryHold ? -1.25 : -0.14 - amp * 0.5 - Math.max(0, -sp) * amp * 0.5;
        arms[1].rotation.x = sw * 0.75 - talk * (0.5 + Math.sin(t * 3.1) * 0.16) - wv * 2.6; arms[1].rotation.z = 0.085 + wv * 0.35; arms[1].userData.fore.rotation.x = -0.14 - talk * (0.85 + Math.sin(t * 2.3) * 0.22) - amp * 0.5 - Math.max(0, sp) * amp * 0.5 - wv * 0.3; arms[1].userData.fore.rotation.z = wv * Math.sin(t * 11) * 0.45;
        body.position.y = (Math.abs(Math.cos(phase)) - 0.5) * 0.03 * (amp / 0.6) + (moving ? 0 : Math.sin(t * 0.7) * 0.003);
      } else { arms[0].userData.fore.rotation.x = -0.95 + Math.sin(t * 7) * 0.03; arms[1].userData.fore.rotation.x = -0.95 + Math.cos(t * 6) * 0.03; }
    },
  };
}

// ---------- Instruments and spacecraft ----------
export function makeInstrument(id) {
  const p = PAYLOADS[id]; const g = new THREE.Group(); const r = p.aperture / 100 * 0.62 + 0.05; const len = 0.5 + p.aperture / 100 * 2.2;
  const tube = cyl(r, r, len, id === 'precision' ? M.foil : M.white, 0, len / 2, 0, 32); g.add(tube);
  const baffle = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r, len * 0.28, 32, 1, true), std(0x0c0d0f, 0.9, 0, { side: THREE.DoubleSide })); baffle.position.y = len + len * 0.14; g.add(baffle);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 32), new THREE.MeshPhysicalMaterial({ color: 0x1a2a4a, roughness: 0.05, metalness: 0.6, clearcoat: 1 })); lens.rotation.x = -Math.PI / 2; lens.position.y = len + 0.002; g.add(lens);
  g.add(cyl(r * 1.05, r * 1.05, 0.03, M.darkMetal, 0, len * 0.2, 0, 32)); g.add(cyl(r * 1.05, r * 1.05, 0.03, M.darkMetal, 0, len * 0.75, 0, 32));
  g.add(box(r * 1.7, 0.16, r * 1.7, M.darkMetal, 0, 0.0, 0));
  if (id === 'wide') for (let i = 0; i < 4; i++) g.add(box(0.05, 0.1, 0.05, M.amber, Math.cos(i * 1.57) * r * 0.6, -0.1, Math.sin(i * 1.57) * r * 0.6));
  if (id === 'precision') { const cooler = cyl(r * 0.5, r * 0.5, 0.22, M.metal, r * 1.25, 0.25, 0); g.add(cooler); const rad = box(0.02, len * 0.7, r * 2.2, M.white, -r * 1.2, len * 0.45, 0); g.add(rad); }
  g.userData.height = len * 1.3; return g;
}

// The spacecraft model is assembled from the player's actual selections.
export function makeSpacecraft(st, opts = {}) {
  const g = new THREE.Group(); const anchors = {};
  const p = st.payload ? PAYLOADS[st.payload] : null;
  const big = st.payload === 'precision';
  const bw = big ? 1.25 : 0.95, bh = big ? 1.05 : 0.8;
  const bus = box(bw, bh, bw, M.foil, 0, bh / 2, 0); g.add(bus);
  g.add(box(bw + 0.04, 0.05, bw + 0.04, M.darkMetal, 0, 0.0, 0)); g.add(box(bw + 0.04, 0.05, bw + 0.04, M.darkMetal, 0, bh, 0));
  g.add(cyl(bw * 0.36, bw * 0.42, 0.14, M.metal, 0, -0.09, 0, 28));
  anchors.structure = new THREE.Vector3(bw / 2, bh * 0.15, bw / 2);
  if (p) { const inst = makeInstrument(st.payload); inst.position.y = bh + 0.08; g.add(inst); anchors.payload = new THREE.Vector3(0, bh + inst.userData.height * 0.8, 0); }
  const arrays = new THREE.Group(); g.add(arrays); g.userData.arrays = [];
  if (st.bus.power === 'body') { for (const s of [-1, 1]) { const pn = box(0.02, bh * 0.86, bw * 0.86, M.solar, s * (bw / 2 + 0.012), bh / 2, 0); arrays.add(pn); } anchors.power = new THREE.Vector3(bw / 2 + 0.02, bh * 0.7, 0); }
  else if (st.bus.power) {
    const n = st.bus.power === 'large' ? 4 : 2, pw = st.bus.power === 'large' ? 0.8 : 0.7, ph = st.bus.power === 'large' ? 1.0 : 0.72;
    for (const s of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(s * (bw / 2), bh * 0.55, 0); arrays.add(wing);
      wing.add(cyl(0.02, 0.02, 0.24, M.metal, s * 0.12, 0, 0, 8).rotateZ(Math.PI / 2));
      for (let i = 0; i < n; i++) { const pn = box(pw - 0.03, ph, 0.025, M.solar, s * (0.24 + pw / 2 + i * pw), 0, 0); wing.add(pn); const fr = box(pw, ph + 0.03, 0.012, M.metal, s * (0.24 + pw / 2 + i * pw), 0, -0.012); wing.add(fr); }
      g.userData.arrays.push({ wing, s });
    }
    anchors.power = new THREE.Vector3(bw / 2 + 0.24 + pw * n * 0.6, bh * 0.55, 0);
  }
  if (st.bus.comms === 'low') { g.add(cyl(0.012, 0.012, 0.42, M.metal, -bw * 0.32, bh + 0.21, bw * 0.32, 8)); g.add(cyl(0.04, 0.04, 0.03, M.white, -bw * 0.32, bh + 0.43, bw * 0.32, 12)); anchors.comms = new THREE.Vector3(-bw * 0.32, bh + 0.45, bw * 0.32); }
  if (st.bus.comms === 'high') {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 12, 0, Math.PI * 2, 0, 0.9), std(0xe6e8ea, 0.5, 0.1, { side: THREE.DoubleSide }));
    const dg = new THREE.Group(); dish.rotation.x = Math.PI; dish.position.y = 0.42; dg.add(dish); dg.add(cyl(0.01, 0.01, 0.3, M.metal, 0, 0.2, 0, 6)); dg.add(cyl(0.03, 0.03, 0.04, M.darkMetal, 0, 0.35, 0, 10));
    dg.rotation.x = Math.PI / 2; dg.position.set(0, bh * 0.5, bw / 2 + 0.06); g.add(dg); anchors.comms = new THREE.Vector3(0, bh * 0.5, bw / 2 + 0.4);
  }
  if (st.bus.storage) { const s = st.bus.storage === 'big' ? 0.22 : 0.13; g.add(box(s, s * 0.7, 0.04, M.darkMetal, bw * 0.22, bh * 0.25, -bw / 2 - 0.02)); anchors.storage = new THREE.Vector3(bw * 0.22, bh * 0.25, -bw / 2 - 0.05); }
  if (st.bus.thermal) {
    const act = st.bus.thermal === 'active';
    const rad = box(bw * 0.8, bh * 0.75, 0.02, M.white, -bw * 0.02, bh * 0.52, -bw / 2 - 0.012); g.add(rad);
    if (act) for (let i = 0; i < 5; i++) g.add(box(bw * 0.78, 0.012, 0.03, M.metal, -bw * 0.02, bh * 0.25 + i * bh * 0.135, -bw / 2 - 0.03));
    anchors.thermal = new THREE.Vector3(-bw * 0.3, bh * 0.8, -bw / 2 - 0.04);
  }
  if (st.bus.adcs) {
    const fine = st.bus.adcs === 'fine';
    const n = fine ? 2 : 1; for (let i = 0; i < n; i++) { const stt = cyl(0.045, 0.06, 0.16, M.black, (i ? -1 : 1) * bw * 0.36, bh + 0.08, -bw * 0.34, 12); stt.rotation.z = (i ? 1 : -1) * 0.5; g.add(stt); }
    anchors.adcs = new THREE.Vector3(bw * 0.36, bh + 0.18, -bw * 0.34);
  }
  g.userData.anchors = anchors; g.userData.bw = bw; g.userData.bh = bh; g.userData.height = bh + (p ? 0.08 + (0.5 + p.aperture / 100 * 2.2) * 1.3 : 0);
  // fold = 1 stows deployable arrays against the bus (launch configuration)
  g.userData.setFold = (f) => { for (const a of g.userData.arrays) { a.wing.rotation.y = a.s * f * 1.5; a.wing.scale.x = 1 - f * 0.82; } };
  if (opts.fold) g.userData.setFold(1);
  return g;
}

// ---------- Launch vehicles ----------
export function makeRocket(vehicleId, fairingClass) {
  const v = VEHICLES[vehicleId]; const g = new THREE.Group(); const H = v.height; const R = H * 0.042;
  const h1 = H * 0.52, h2 = H * 0.2, hf = H * 0.24;
  const s1 = new THREE.Group(), s2 = new THREE.Group(), fair = new THREE.Group(); g.add(s1, s2, fair);
  s1.add(cyl(R, R, h1, M.rocketWhite, 0, h1 / 2 + 1.0, 0, 36));
  s1.add(cyl(R * 1.005, R * 1.005, h1 * 0.08, M.rocketDark, 0, h1 * 0.9 + 1.0, 0, 36));
  s1.add(cyl(R * 1.005, R * 1.005, h1 * 0.03, std(0xf2a23a, 0.5), 0, h1 * 0.6 + 1.0, 0, 36));
  s1.add(cyl(R, R * 1.03, 1.0, M.rocketDark, 0, 0.5 + 0.5, 0, 36));
  const nEng = vehicleId === 'kestrel' ? 5 : 7; const nozzles = [];
  for (let i = 0; i < nEng; i++) { const a = i === 0 ? 0 : (i / (nEng - 1)) * Math.PI * 2, rr = i === 0 ? 0 : R * 0.62; const nz = cyl(R * 0.14, R * 0.24, 1.0, M.darkMetal, Math.cos(a) * rr, 0.2, Math.sin(a) * rr, 14); s1.add(nz); nozzles.push(nz.position.clone()); }
  for (let i = 0; i < 4; i++) { const f = box(0.08, H * 0.07, R * 0.9, M.rocketDark, Math.cos(i * 1.5708 + 0.785) * R * 1.3, H * 0.05 + 1, Math.sin(i * 1.5708 + 0.785) * R * 1.3); f.rotation.y = -(i * 1.5708 + 0.785) + Math.PI / 2; s1.add(f); }
  const boosters = [];
  for (let i = 0; i < v.boosters; i++) { const b = new THREE.Group(); const sx = i ? -1 : 1; b.add(cyl(R * 0.55, R * 0.55, h1 * 0.72, M.rocketWhite, 0, h1 * 0.36 + 1, 0, 24)); const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.55, R * 1.6, 24), M.rocketDark); cone.position.y = h1 * 0.72 + 1 + R * 0.8; b.add(cone); b.add(cyl(R * 0.3, R * 0.45, 1.0, M.darkMetal, 0, 0.4, 0, 14)); b.position.x = sx * R * 1.6; s1.add(b); boosters.push(b); nozzles.push(new THREE.Vector3(sx * R * 1.6, 0.2, 0)); }
  const y2 = h1 + 1.0;
  s2.add(cyl(R, R, h2, M.rocketWhite, 0, y2 + h2 / 2, 0, 36)); s2.add(cyl(R * 1.005, R * 1.005, h2 * 0.12, M.rocketDark, 0, y2 + h2 * 0.08, 0, 36));
  s2.add(cyl(R * 0.2, R * 0.42, H * 0.035, M.darkMetal, 0, y2 - H * 0.018, 0, 18));
  const fr = R * ({ S: 1.0, M: 1.22, L: 1.45 }[v.fairing]); const yf = y2 + h2;
  const prof = []; for (let i = 0; i <= 18; i++) { const u = i / 18; const y = u * hf; const rad = u < 0.12 ? R + (fr - R) * (u / 0.12) : u < 0.55 ? fr : fr * Math.cos(((u - 0.55) / 0.45) * Math.PI / 2) ** 0.75; prof.push(new THREE.Vector2(Math.max(0.02, rad), y)); }
  const halves = [];
  for (const s of [0, 1]) { const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 18, s * Math.PI, Math.PI), std(0xeceeef, 0.42, 0.1, { side: THREE.DoubleSide })); m.position.y = yf; fair.add(m); halves.push(m); }
  const band = cyl(fr * 1.004, fr * 1.004, hf * 0.035, std(0xf2a23a, 0.5), 0, yf + hf * 0.3, 0, 36); fair.add(band);
  g.userData = { s1, s2, fair, halves, band, boosters, nozzles, H, R, payloadY: yf + hf * 0.14, payloadSpace: fr, fairingClass };
  return g;
}

// ---------- Space ----------
function noise3(seed) {
  const p = new Uint8Array(512); const r = rng(seed); for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  const h = (x, y, z) => p[p[p[x & 255] + (y & 255)] + (z & 255)] / 255; const f = (t) => t * t * (3 - 2 * t);
  const n = (x, y, z) => { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); const u = f(x - X), v = f(y - Y), w = f(z - Z); const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(X, Y, Z), h(X + 1, Y, Z), u), l(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v), l(l(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), l(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w); };
  return (x, y, z, oct = 5) => { let a = 0, amp = 0.5, fq = 1; for (let i = 0; i < oct; i++) { a += n(x * fq, y * fq, z * fq) * amp; amp *= 0.5; fq *= 2.03; } return a; };
}
export function makeEarth(radius, detail = 1) {
  const W = detail > 0 ? 1024 : 512, H = W / 2; const land = noise3(42), cl = noise3(77);
  const mk = (clouds) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const img = g.createImageData(W, H); const d = img.data;
    for (let y = 0; y < H; y++) { const lat = (0.5 - y / H) * Math.PI; const cy = Math.sin(lat), cr = Math.cos(lat);
      for (let x = 0; x < W; x++) { const lon = (x / W) * Math.PI * 2; const px = cr * Math.cos(lon), pz = cr * Math.sin(lon); const i = (y * W + x) * 4;
        if (clouds) { const v = cl(px * 3.1 + 9, cy * 4.2, pz * 3.1, 5); const a = Math.max(0, Math.min(1, (v - 0.56) * 4.5)); d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 170; continue; }
        const e = land(px * 2.1 + 3, cy * 2.1, pz * 2.1, 6); const ice = Math.abs(lat) > 1.22 + (e - 0.5) * 0.5;
        let r, gg, b;
        if (ice) { r = 228; gg = 234; b = 238; }
        else if (e > 0.52) { const t = Math.min(1, (e - 0.52) * 7); const dry = land(px * 5 + 20, cy * 5, pz * 5, 3); const arid = Math.max(0, 1 - Math.abs(lat) * 1.6) * (dry > 0.5 ? 1 : 0.3);
          r = 48 + 70 * arid + 40 * t; gg = 78 + 30 * arid + 18 * t; b = 42 + 20 * arid + 20 * t; }
        else { const dp = Math.max(0, (0.52 - e) * 5); r = 14 + 22 * (1 - dp); gg = 52 + 58 * (1 - dp); b = 112 + 62 * (1 - dp); }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; } }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const g = new THREE.Group();
  const surf = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), new THREE.MeshStandardMaterial({ map: mk(false), roughness: 0.75, metalness: 0.05 })); g.add(surf);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.004, 96, 64), new THREE.MeshStandardMaterial({ map: mk(true), transparent: true, roughness: 1, depthWrite: false })); g.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.022, 96, 64), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { sun: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normalMatrix * normal); vW = normalize((modelMatrix * vec4(normal,0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ float rim = pow(clamp(0.72 + vN.z, 0.0, 1.0), 3.2); float lit = clamp(dot(vW, sun) * 0.6 + 0.55, 0.05, 1.0); gl_FragColor = vec4(vec3(0.16,0.42,1.0) * rim * lit, rim * lit * 0.9); }' })); g.add(atmo);
  g.userData = { surf, clouds, atmo }; return g;
}
export function makeStars(n = 2500, radius = 9000, seed = 5) {
  const r = rng(seed); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); pos[i * 3] = radius * s * Math.cos(a); pos[i * 3 + 1] = radius * u; pos[i * 3 + 2] = radius * s * Math.sin(a);
    const b = 0.35 + Math.pow(r(), 3) * 0.65, tint = r(); col[i * 3] = b * (0.85 + 0.15 * tint); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (1 - 0.15 * tint); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 1, depthWrite: false }));
}
export function disposeTree(obj) { obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
