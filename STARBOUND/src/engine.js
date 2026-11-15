// Renderer, frame loop, scene switching, adaptive quality and fades.
import * as THREE from 'three';
import { settings } from './state.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
let composer = null, renderPass = null, postFailed = false;
function getComposer(r) { if (composer || postFailed) return composer; try { const w = window.innerWidth, h = window.innerHeight; const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }); composer = new EffectComposer(r, rt); renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); composer.addPass(renderPass); composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.5, 2.4)); composer.addPass(new OutputPass()); composer.setPixelRatio(engine.pixelRatio); composer.setSize(w, h); } catch (e) { postFailed = true; composer = null; } return composer; }

export const engine = { renderer: null, canvas: null, active: null, time: 0, pixelRatio: 1, lowQuality: false, fps: 60, failed: false };
const tickers = new Set();
export const onTick = (fn) => { tickers.add(fn); return () => tickers.delete(fn); };

export function initEngine(canvas) {
  engine.canvas = canvas;
  try {
    engine.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { engine.failed = true; return false; }
  const r = engine.renderer;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace; r.autoClear = false; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality(); resize();
  window.addEventListener('resize', resize);
  let last = performance.now(), acc = 0, frames = 0, slow = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; engine.time += dt;
    acc += dt; frames++;
    if (acc >= 1) { engine.fps = frames / acc; acc = 0; frames = 0;
      if (settings.quality === 'auto' && engine.fps < 28) { slow++; if (slow >= 3 && engine.pixelRatio > 0.75) { engine.pixelRatio = Math.max(0.75, engine.pixelRatio - 0.25); engine.lowQuality = true; r.setPixelRatio(engine.pixelRatio); slow = 0; } } else slow = 0; }
    for (const f of tickers) f(dt);
    const a = engine.active; if (!a) return;
    if (a.update) a.update(dt);
    r.clear();
    const pc = a.post && !a.render && !engine.lowQuality && settings.quality !== 'low' ? getComposer(r) : null;
    if (pc) { renderPass.scene = a.scene; renderPass.camera = a.camera; pc.render(dt); }
    else if (a.render) a.render(r); else r.render(a.scene, a.camera);
  };
  requestAnimationFrame(loop);
  return true;
}
let env = null;
// Soft studio reflections so metal, glass and foil read as real materials.
export function applyEnv(scene, intensity = 0.5) { try { if (!env) { const pm = new THREE.PMREMGenerator(engine.renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } scene.environment = env; scene.environmentIntensity = intensity; } catch (e) { /* reflections are optional */ } }
export function applyQuality() {
  const q = settings.quality; const dpr = window.devicePixelRatio || 1;
  engine.pixelRatio = q === 'low' ? Math.min(1, dpr) : q === 'high' ? Math.min(2, dpr) : Math.min(1.5, dpr);
  engine.lowQuality = q === 'low';
  if (engine.renderer) engine.renderer.setPixelRatio(engine.pixelRatio);
}
export function resize() {
  const w = window.innerWidth, h = window.innerHeight; if (!engine.renderer) return;
  engine.renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(engine.pixelRatio); composer.setSize(w, h); }
  const a = engine.active; if (a) for (const c of a.cameras || [a.camera]) { if (c && c.isPerspectiveCamera) { c.aspect = w / h; c.updateProjectionMatrix(); } }
}
export function setScene(sc) {
  if (engine.active && engine.active.onExit) engine.active.onExit();
  engine.active = sc; resize();
  if (sc && sc.onEnter) sc.onEnter();
}
const fadeEl = () => document.getElementById('fade');
export function fade(to, ms = 500) {
  const el = fadeEl(); if (settings.reducedMotion) ms = Math.min(ms, 120);
  el.style.transitionDuration = ms + 'ms'; el.style.pointerEvents = to ? 'auto' : 'none';
  return new Promise((res) => { requestAnimationFrame(() => { el.style.opacity = to ? 1 : 0; setTimeout(res, ms + 30); }); });
}
export async function transition(fn, caption) {
  const cap = document.getElementById('fade-caption'); cap.textContent = caption || '';
  await fade(true); try { await fn(); } finally { if (caption) await new Promise((r) => setTimeout(r, 1100)); await fade(false); cap.textContent = ''; }
}
