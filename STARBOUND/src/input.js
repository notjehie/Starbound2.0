// Keyboard, mouse (pointer lock with drag fallback) and touch controls.
import { settings } from './state.js';
import { initAudio } from './audio.js';

export const input = { zoom: 0, jump: false, keys: {}, mx: 0, my: 0, dx: 0, dy: 0, locked: false, fp: false, touch: false, onInteract: null, onKey: null };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    input.keys[e.code] = true;
    if (input.fp && e.code === 'Space' && !e.repeat) input.jump = true;
    if (input.fp && (e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); input.onInteract && input.onInteract(); }
    if (input.fp && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    input.onKey && input.onKey(e);
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = {}; });
  canvas.addEventListener('click', () => { initAudio(); if (input.fp && !input.touch && canvas.requestPointerLock && !input.locked) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-look fallback remains */ } } });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', input.locked); });
  let drag = false;
  canvas.addEventListener('mousedown', () => { drag = true; }); window.addEventListener('mouseup', () => { drag = false; });
  window.addEventListener('mousemove', (e) => { if (!input.fp) return; if (input.locked || drag) { input.dx += e.movementX || 0; input.dy += e.movementY || 0; } });

  // Touch, Roblox style: touch anywhere on the left to get a thumbstick under your thumb,
  // drag anywhere else to turn the camera, pinch to zoom, buttons to jump and interact.
  const pad = document.getElementById('touch-pad'), nub = document.getElementById('touch-nub'); let padId = null, pc = null; const looks = new Map(); let pinch = 0;
  const enableTouch = () => { if (!input.touch) { input.touch = true; document.body.classList.add('touch'); } };
  window.addEventListener('touchstart', enableTouch, { capture: true, passive: true });
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0) enableTouch();
  const R = 58;
  canvas.addEventListener('touchstart', (e) => { enableTouch(); initAudio(); if (!input.fp) return; e.preventDefault();
    for (const t of e.changedTouches) { if (padId === null && t.clientX < window.innerWidth * 0.45) { padId = t.identifier; pc = { x: t.clientX, y: t.clientY }; pad.style.left = (t.clientX - 64) + 'px'; pad.style.top = (t.clientY - 64) + 'px'; pad.style.bottom = 'auto'; pad.classList.add('live'); }
      else looks.set(t.identifier, { x: t.clientX, y: t.clientY }); } pinch = 0; }, { passive: false });
  window.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) {
    if (t.identifier === padId) { let x = (t.clientX - pc.x) / R, y = (t.clientY - pc.y) / R; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } input.mx = x; input.my = -y; nub.style.transform = `translate(${x * 38}px, ${y * 38}px)`; }
    else if (looks.has(t.identifier)) { const p = looks.get(t.identifier); if (looks.size === 1) { input.dx += (t.clientX - p.x) * 2.4; input.dy += (t.clientY - p.y) * 2.4; } p.x = t.clientX; p.y = t.clientY; } }
    if (looks.size >= 2) { const [a, b] = [...looks.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) input.zoom += (pinch - d) * 0.012; pinch = d; } }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === padId) { padId = null; input.mx = input.my = 0; nub.style.transform = ''; pad.classList.remove('live'); pad.style.left = pad.style.top = pad.style.bottom = ''; } looks.delete(t.identifier); } pinch = 0; };
  window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
  document.getElementById('touch-use').addEventListener('click', () => { input.onInteract && input.onInteract(); });
  const jb = document.getElementById('touch-jump'); jb.addEventListener('touchstart', (e) => { e.preventDefault(); input.jump = true; }, { passive: false }); jb.addEventListener('click', () => { input.jump = true; });
  canvas.addEventListener('wheel', (e) => { if (input.fp) { input.zoom += Math.sign(e.deltaY) * 0.5; e.preventDefault(); } }, { passive: false });
}
export function setFP(on) { input.fp = on; if (!on) { input.keys = {}; input.mx = input.my = 0; if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } }
export function moveVector() {
  const k = input.keys; let x = input.mx, y = input.my;
  if (k.KeyW || k.ArrowUp) y += 1; if (k.KeyS || k.ArrowDown) y -= 1; if (k.KeyD || k.ArrowRight) x += 1; if (k.KeyA || k.ArrowLeft) x -= 1;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  return { x, y, run: !!(k.ShiftLeft || k.ShiftRight || input.runOn) };
}
export function takeZoom() { const z = input.zoom; input.zoom = 0; return z; }
export function takeJump() { const j = input.jump; input.jump = false; return j; }
export function takeLook() { const s = 0.0022 * settings.sensitivity; const r = { x: input.dx * s, y: input.dy * s }; input.dx = input.dy = 0; return r; }
