// Deep-space run: the player flies the spacecraft by hand through an asteroid field and
// then away from the pull of a black hole. These hazards are game fiction, said so on screen.
import * as THREE from 'three';
import { settings } from './state.js';
import { makeStars, box, cyl, std } from './builders.js';
import { input } from './input.js';
import { el, openOverlay, closeOverlay, buddySay } from './ui.js';
import { sfx, engineSound } from './audio.js';
import { award } from './points.js';
import { TH } from './moon.js';

const hold = (set) => ({ onpointerdown: (e) => { e.preventDefault(); set(true); }, onpointerup: () => set(false), onpointerleave: () => set(false), onpointercancel: () => set(false) });

export function spaceRun(done) {
  const th = TH(); const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000004); const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
  scene.add(new THREE.AmbientLight(0x6a7890, 0.7)); const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(30, 40, 60); scene.add(sun); scene.add(makeStars(2200, 3000));
  // the ship, seen from behind
  const ship = new THREE.Group(); const white = std(0xe9ebec, 0.4, 0.2), dark = std(0x23282e, 0.5, 0.5), foil = std(0xb98a2e, 0.35, 0.85);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.7, 24), white); cap.rotation.x = -Math.PI / 2; cap.position.z = -1.9; ship.add(cap); const sm = cyl(1.15, 1.15, 2.3, foil, 0, 0, 0.1, 24); sm.rotation.x = Math.PI / 2; ship.add(sm); const noz = cyl(0.45, 0.8, 0.8, dark, 0, 0, 1.6, 16); noz.rotation.x = Math.PI / 2; ship.add(noz);
  for (const sx of [-1, 1]) { ship.add(box(3.2, 0.05, 1.1, std(0x24364a, 0.3, 0.6), sx * 2.8, 0, 0.2)); ship.add(box(0.5, 0.08, 0.12, dark, sx * 1.3, 0, 0.2)); } ship.add(box(0.5, 0.35, 0.05, dark, 0, 0.45, -2.0));
  const glow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fc8ff).multiplyScalar(1.6), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); glow.rotation.x = Math.PI / 2; glow.position.z = 3.1; ship.add(glow);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ship.add(bubble); scene.add(ship);
  // rocks
  let sd = 31; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }; const rockM = [std(0x6b6258, 1), std(0x574f47, 1), std(0x7d7468, 1)]; const rocks = [];
  const place = (a, first) => { a.r = 0.8 + rnd() * 2.2; a.z = first ? -60 - rnd() * 320 : -330 - rnd() * 60; const aim = rnd() < 0.35; a.x = aim ? P.x + (rnd() - 0.5) * 3 : (rnd() - 0.5) * 30; a.y = aim ? P.y + (rnd() - 0.5) * 2 : (rnd() - 0.5) * 17; a.m.scale.set(a.r, a.r * (0.7 + rnd() * 0.5), a.r * (0.8 + rnd() * 0.4)); a.sp = [rnd() - 0.5, rnd() - 0.5]; a.hit = false; a.m.visible = true; };
  const P = { x: 0, y: 0, vx: 0, vy: 0 }; for (let i = 0; i < 44; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockM[i % 3]); scene.add(m); const a = { m }; place(a, true); rocks.push(a); }
  // speed streaks
  const NS = 260; const sp = new Float32Array(NS * 3); for (let i = 0; i < NS; i++) { sp[i * 3] = (rnd() - 0.5) * 80; sp[i * 3 + 1] = (rnd() - 0.5) * 50; sp[i * 3 + 2] = -rnd() * 300; } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd6ff, size: 0.35, transparent: true, opacity: 0.7 })));
  // the black hole and, at the end, the place we are going
  const hole = new THREE.Group(); hole.add(new THREE.Mesh(new THREE.SphereGeometry(13, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }))); const disc = new THREE.Mesh(new THREE.RingGeometry(15, 34, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a3a).multiplyScalar(2.2), transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); disc.rotation.x = 1.25; hole.add(disc); const halo = new THREE.Mesh(new THREE.RingGeometry(13.2, 14.6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(3), side: THREE.DoubleSide })); hole.add(halo); hole.visible = false; scene.add(hole);
  const dest = new THREE.Mesh(new THREE.SphereGeometry(60, 40, 28), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1 })); dest.position.set(30, -10, -1400); dest.visible = false; scene.add(dest);
  // HUD
  const btn = { l: false, r: false, u: false, d: false }; const shieldEl = el('b'); const bar = el('i'); const msg = el('div', { class: 'callout-line show', role: 'status' }); const phaseEl = el('div', { class: 'label' });
  const hud = el('div', { class: 'launch-hud moon-hud' }, el('div', { class: 'panel tele-panel' }, phaseEl, el('div', { class: 'tele' }, el('div', { class: 'kv' }, el('span', {}, 'Shields'), shieldEl), el('div', { class: 'kv' }, el('span', {}, 'Distance flown'), el('div', { class: 'runbar' }, bar))), el('p', { class: 'note' }, 'You are flying. Steer with the arrow buttons, the arrow keys or W A S D. The asteroid field and the black hole are part of the game story, not real hazards on this route.')), msg,
    el('div', { class: 'fly-btns' }, el('button', Object.assign({ type: 'button', class: 'btn sq big', 'aria-label': 'Steer left' }, hold((v) => (btn.l = v))), '◀ LEFT'), el('div', { class: 'ud' }, el('button', Object.assign({ type: 'button', class: 'btn primary big', 'aria-label': 'Steer up' }, hold((v) => (btn.u = v))), '▲ UP'), el('button', Object.assign({ type: 'button', class: 'btn primary big', 'aria-label': 'Steer down' }, hold((v) => (btn.d = v))), '▼ DOWN')), el('button', Object.assign({ type: 'button', class: 'btn sq big', 'aria-label': 'Steer right' }, hold((v) => (btn.r = v))), 'RIGHT ▶')));
  const R = { t: 0, phase: 'intro', shields: 4, hits: 0, inv: 0, shake: 0, pull: 0, said: '', finished: false, captured: 0 }; const say = (s) => { if (s !== R.said) { R.said = s; msg.textContent = s; buddySay(s); } };
  const T_ROCKS = 4, T_HOLE = 40, T_CLEAR = 66, T_END = 73; const flash = () => { const f = el('div', { class: 'flash red' }); document.body.append(f); setTimeout(() => f.remove(), 450); };
  const hurt = (why) => { if (R.inv > 0) return; R.inv = 1.6; R.shake = 0.6; R.hits++; R.shields--; sfx.alert(); flash(); if (R.shields <= 0) { R.shields = 2; award('run:tow:' + R.hits, -25, 'Shields gone: Mission Control steadied the ship'); say('Shields are gone! Mission Control is steadying us. Shields back to two. Keep flying, we can do this.'); } else say(why); };
  const sc = { R, P, rocks, scene, camera, cameras: [camera],
    onEnter() { document.body.classList.add('away', 'no-timer'); openOverlay(hud, 'hud-overlay'); say('Helmets on, everyone! Asteroid field ahead. You are the pilot. Steer with the arrows and dodge the rocks.'); },
    onExit() { engineSound(0, 0); document.body.classList.remove('away'); },
    update(dt) { if (R.finished) return; dt = Math.min(dt, 0.05); R.t += dt; R.inv = Math.max(0, R.inv - dt); R.shake = Math.max(0, R.shake - dt); const k = input.keys; const ix = ((btn.r || k.KeyD || k.ArrowRight) ? 1 : 0) - ((btn.l || k.KeyA || k.ArrowLeft) ? 1 : 0), iy = ((btn.u || k.KeyW || k.ArrowUp) ? 1 : 0) - ((btn.d || k.KeyS || k.ArrowDown) ? 1 : 0);
      const ph = R.t < T_ROCKS ? 'intro' : R.t < T_HOLE ? 'rocks' : R.t < T_CLEAR ? 'hole' : 'clear';
      if (ph !== R.phase) { R.phase = ph; if (ph === 'rocks') say('Here they come. Small moves. Slide between them.'); if (ph === 'hole') { hole.visible = true; sfx.alert(); say('Whoa. My sensors are going wild. A black hole is pulling us to the LEFT! Steer RIGHT and keep holding!'); } if (ph === 'clear') { dest.visible = true; sfx.confirm(); award('run:clear', 150 + R.shields * 75, `Flew through the danger with ${R.shields} shield${R.shields === 1 ? '' : 's'} left`); say(`We are through! You flew that yourself. Look ahead: that is ${th.name}.`); } }
      phaseEl.textContent = ph === 'hole' ? 'Day 3 of 7 · Black hole · steer away' : ph === 'clear' ? 'Day 3 of 7 · Clear space' : 'Day 3 of 7 · Asteroid field · you are flying';
      // black-hole pull grows, then fades as we pass it
      const hu = ph === 'hole' ? (R.t - T_HOLE) / (T_CLEAR - T_HOLE) : 0; R.pull = ph === 'hole' ? Math.sin(Math.min(1, hu) * Math.PI) * 8.4 : 0; hole.position.set(-30 + hu * 4, 6, -330 + hu * 330); disc.rotation.z += dt * 1.4;
      P.vx += (ix * 10.5 - P.vx) * Math.min(1, dt * 4.5); P.vy += (iy * 8.5 - P.vy) * Math.min(1, dt * 4.5); P.x = Math.max(-12, Math.min(12, P.x + (P.vx - R.pull) * dt)); P.y = Math.max(-6.5, Math.min(6.5, P.y + (P.vy + R.pull * 0.2) * dt));
      if (ph === 'hole' && P.x <= -11.5) { P.x = 2; P.vx = 0; R.captured++; R.inv = 0; hurt('Too close! The black hole grabbed us. I pulled us back. Hold RIGHT harder!'); } else if (ph === 'hole' && R.pull > 3) say(P.x < -5 ? 'We are sliding in! Hold RIGHT!' : 'Good. Keep holding RIGHT. Do not let go.');
      const speed = ph === 'clear' ? 30 : 58 + Math.min(20, R.t * 0.5);
      for (const a of rocks) { a.z += speed * dt; a.m.rotation.x += a.sp[0] * dt; a.m.rotation.y += a.sp[1] * dt; if (ph === 'hole') { a.x -= R.pull * 0.6 * dt; } a.m.position.set(a.x, a.y, a.z);
        if (!a.hit && a.m.visible && Math.abs(a.z) < a.r + 1.6 && Math.hypot(a.x - P.x, a.y - P.y) < a.r + 1.0) { a.hit = true; a.m.visible = false; hurt('Ouch, that one clipped us. Shields took it. Keep dodging!'); }
        if (a.z > 14) { if (ph === 'rocks' || (ph === 'hole' && hu < 0.2) || ph === 'intro') place(a, false); else a.m.visible = false; } }
      const pa = sg.attributes.position; for (let i = 0; i < NS; i++) { pa.array[i * 3 + 2] += speed * 1.6 * dt; if (pa.array[i * 3 + 2] > 10) pa.array[i * 3 + 2] = -300; } pa.needsUpdate = true;
      if (ph === 'clear') { dest.position.z += dt * 160; dest.position.z = Math.min(-200, dest.position.z); }
      ship.position.set(P.x, P.y, 0); ship.rotation.z = -P.vx * 0.045 - R.pull * 0.02; ship.rotation.x = P.vy * 0.03; glow.scale.y = 0.8 + Math.random() * 0.4; bubble.material.opacity = R.inv > 0 ? 0.25 * Math.abs(Math.sin(R.t * 18)) : 0; engineSound(0.35, 0.1);
      const sh = R.shake > 0 && !settings.reducedMotion ? R.shake * 0.8 : 0; camera.position.set(P.x * 0.82 + (Math.random() - 0.5) * sh, P.y * 0.82 + 3.4 + (Math.random() - 0.5) * sh, 10.5); camera.lookAt(P.x * 0.9 - (ph === 'hole' ? 3 * Math.sin(Math.min(1, hu) * Math.PI) : 0), P.y * 0.9, -34); camera.rotation.z += -R.pull * 0.012;
      shieldEl.textContent = '◆'.repeat(Math.max(0, R.shields)) + '◇'.repeat(Math.max(0, 4 - R.shields)); shieldEl.style.color = R.shields <= 1 ? '#e5564b' : '#6fbf8b'; bar.style.width = Math.min(100, R.t / T_END * 100) + '%';
      if (R.t >= T_END) { R.finished = true; setTimeout(() => { closeOverlay(); done(); }, 300); } } };
  return sc;
}
