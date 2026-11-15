// Procedural audio (Web Audio). No recorded assets: every sound is synthesised.
// Channels: ambience (room tone, engine) and effects (interface, doors, footsteps, alerts).
import { settings } from './state.js';

let ctx = null, master, ambG, fxG, noiseBuf, ambNodes = null, engineNodes = null;
export const audioReady = () => !!ctx;

export function initAudio() { // must be called from a user gesture
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    ctx = new AC(); master = ctx.createGain(); ambG = ctx.createGain(); fxG = ctx.createGain();
    ambG.connect(master); fxG.connect(master); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.35 + b * 2.2; }
    applyVolumes();
  } catch (e) { ctx = null; }
}
export function applyVolumes() { if (!ctx) return; master.gain.value = settings.sound === true ? settings.volume.master : 0; ambG.gain.value = settings.volume.ambience; fxG.gain.value = settings.volume.effects; }

function noise(loop = true) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; }
function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, dest = fxG, slide = 0) {
  if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function burst(dur, freq, q, vol, when = 0, type = 'bandpass') {
  if (!ctx) return; const t = ctx.currentTime + when; const s = noise(false), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(fxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone(880, 0.05, 'triangle', 0.06); },
  select() { tone(660, 0.07, 'triangle', 0.07); tone(990, 0.09, 'triangle', 0.05, 0.05); },
  confirm() { tone(523, 0.1, 'sine', 0.09); tone(784, 0.16, 'sine', 0.09, 0.09); },
  deny() { tone(220, 0.16, 'square', 0.05); tone(174, 0.22, 'square', 0.05, 0.12); },
  alert() { for (let i = 0; i < 3; i++) { tone(740, 0.14, 'square', 0.05, i * 0.3); tone(590, 0.14, 'square', 0.05, i * 0.3 + 0.15); } },
  switch() { burst(0.035, 2400, 2, 0.25); tone(140, 0.04, 'square', 0.04); },
  step() { burst(0.07, 240 + Math.random() * 120, 1.2, 0.16, 0, 'lowpass'); },
  door() { if (!ctx) return; burst(0.5, 900, 0.7, 0.07); tone(90, 0.5, 'sawtooth', 0.025, 0, fxG, 40); },
  talk() { tone(300 + Math.random() * 80, 0.05, 'sine', 0.035); },
  beep(hi) { tone(hi ? 1320 : 880, hi ? 0.5 : 0.12, 'sine', 0.09); },
  data() { tone(1200 + Math.random() * 600, 0.03, 'sine', 0.025); },
  staging() { burst(0.35, 300, 0.6, 0.5, 0, 'lowpass'); tone(70, 0.4, 'sine', 0.2, 0, fxG, -30); },
  applause() { if (!ctx) return; for (let i = 0; i < 60; i++) burst(0.05, 1500 + Math.random() * 2500, 1.5, 0.05 + Math.random() * 0.05, Math.random() * 2.4); },
  reveal() { [392, 494, 587, 784].forEach((f, i) => tone(f, 1.6 - i * 0.2, 'sine', 0.06, i * 0.22)); },
};

// Room tone. Each place has its own mix of hum, air and activity.
const ROOMS = {
  none: { hum: 0, air: 0, act: 0 },
  centre: { hum: 0.018, air: 0.05, act: 0.0, airF: 500 },
  lab: { hum: 0.03, air: 0.035, act: 0.012, airF: 900 },
  control: { hum: 0.022, air: 0.03, act: 0.03, airF: 700 },
  bay: { hum: 0.035, air: 0.06, act: 0.008, airF: 350 },
  space: { hum: 0.012, air: 0.0, act: 0.006, airF: 300 },
  pad: { hum: 0.0, air: 0.07, act: 0, airF: 260 },
};
let actTimer = null, room = 'none';
export function setAmbience(name) {
  room = name; if (!ctx) return; const r = ROOMS[name] || ROOMS.none; const t = ctx.currentTime;
  if (!ambNodes) {
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 58; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 170; const hg = ctx.createGain(); hg.gain.value = 0;
    hum.connect(hf); hf.connect(hg); hg.connect(ambG); hum.start();
    const air = noise(), af = ctx.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 500; const ag = ctx.createGain(); ag.gain.value = 0; air.connect(af); af.connect(ag); ag.connect(ambG); air.start();
    ambNodes = { hg, ag, af };
  }
  ambNodes.hg.gain.linearRampToValueAtTime(r.hum, t + 0.8); ambNodes.ag.gain.linearRampToValueAtTime(r.air, t + 0.8); ambNodes.af.frequency.linearRampToValueAtTime(r.airF || 500, t + 0.8);
  clearInterval(actTimer);
  if (r.act) actTimer = setInterval(() => { if (!ctx || ctx.state !== 'running') return; const x = Math.random();
    if (room === 'control') { if (x < 0.5) burst(0.03, 3000, 3, r.act * 2, 0); else if (x < 0.62) tone(1000, 0.06, 'sine', r.act * 0.6, 0, ambG); else if (x < 0.7) { burst(0.5, 700, 3, r.act, 0); } }
    else if (room === 'lab') { if (x < 0.25) tone(1600 + Math.random() * 400, 0.05, 'sine', r.act, 0, ambG); else if (x < 0.4) burst(0.03, 2600, 3, r.act * 2); }
    else if (x < 0.2) tone(700 + Math.random() * 500, 0.05, 'sine', r.act, 0, ambG);
  }, 380);
}
export function announce() { tone(660, 0.35, 'sine', 0.05, 0, ambG); tone(520, 0.5, 'sine', 0.05, 0.3, ambG); }

// Rocket engine: filtered noise whose level follows thrust and whose brightness falls with air density.
export function engineSound(level, air = 1) {
  if (!ctx) return;
  if (!engineNodes) { const n = noise(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; const g = ctx.createGain(); g.gain.value = 0; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const og = ctx.createGain(); og.gain.value = 0;
    n.connect(f); f.connect(g); g.connect(ambG); o.connect(og); og.connect(ambG); n.start(); o.start(); engineNodes = { f, g, og }; }
  const t = ctx.currentTime; engineNodes.g.gain.linearRampToValueAtTime(level * (0.25 + 0.75 * air) * 1.4, t + 0.15); engineNodes.og.gain.linearRampToValueAtTime(level * 0.12 * (0.3 + 0.7 * air), t + 0.15); engineNodes.f.frequency.linearRampToValueAtTime(140 + 1500 * air, t + 0.15);
}
