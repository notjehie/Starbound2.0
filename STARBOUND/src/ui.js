// DOM interface layer: HUD, dialogue, overlays, modals, settings.
import { settings, save, state, hardReset } from './state.js';
import { sfx, applyVolumes, initAudio } from './audio.js';
import { applyQuality } from './engine.js';
import { speak, stopSpeak, voiceOn, synthAvailable, hasRecordings } from './voice.js';
import { award } from './points.js';

export function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
export const $ = (s) => document.querySelector(s);
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
export function button(label, onclick, cls = '') { return el('button', { class: 'btn ' + cls, type: 'button', onclick: (e) => { initAudio(); sfx.click(); onclick(e); } }, label); }

export { speak, stopSpeak };
const voiceAvailable = () => true;

const ui = { overlay: null, dialogue: null, modalOpen: false, settingsOpen: false, onModeChange: null };
export const inDialogue = () => !!ui.dialogue;
export const blocking = () => !!(ui.overlay || ui.dialogue || ui.modalOpen || ui.settingsOpen);
export const setModeListener = (fn) => { ui.onModeChange = fn; };
const changed = () => ui.onModeChange && ui.onModeChange();

// ----- HUD -----
export function setObjective(title, steps = [], hint = '') {
  const box = $('#objective'); box.innerHTML = '';
  if (!title) { box.hidden = true; return; } box.hidden = false;
  box.append(el('div', { class: 'label' }, 'Current objective'), el('div', { class: 'obj-title' }, title));
  if (steps.length) box.append(el('ul', { class: 'obj-steps' }, steps.map((s) => el('li', { class: s.done ? 'done' : '' }, el('span', { class: 'tick', 'aria-hidden': 'true' }, s.done ? '✓' : '○'), s.text))));
  if (hint && settings.assist === 'guided') box.append(el('div', { class: 'obj-hint' }, hint));
}
export function setPrompt(text) { const p = $('#prompt'); if (!text) { p.hidden = true; return; } p.hidden = false; p.innerHTML = ''; p.append(el('kbd', {}, 'E'), ' ', text); $('#touch-use').textContent = text; }
export function setLocation(text) { $('#location').textContent = text || ''; }
export function toast(msg, kind = 'info', ms = 4200) {
  const t = el('div', { class: 'toast ' + kind, role: 'status' }, el('span', { class: 'tk' }, kind === 'alert' ? '▲ ALERT' : kind === 'good' ? '● OK' : '■ INFO'), msg);
  $('#toasts').append(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}
export function showHUD(on) { $('#hud').hidden = !on; }

// ----- Dialogue: subtitles always; recorded voice if installed, otherwise the browser voice -----
export function showDialogue(speaker, lines, onDone, quiz) {
  const box = $('#dialogue'); let i = 0, asked = false; box.hidden = false; box.innerHTML = '';
  const name = el('div', { class: 'dlg-name' }, speaker.name, el('span', {}, speaker.role));
  const text = el('p', { class: 'dlg-text', 'aria-live': 'polite' }); const opts = el('div', { class: 'dlg-opts' });
  const count = el('span', { class: 'dlg-count' }); const voice = el('span', { class: 'dlg-voice' });
  const next = el('button', { class: 'btn primary', type: 'button' }, 'Continue'); const skip = el('button', { class: 'btn ghost', type: 'button' }, 'Skip');
  box.append(name, text, opts, el('div', { class: 'dlg-foot' }, voice, count, skip, next));
  const done = () => { stopSpeak(); box.hidden = true; ui.dialogue = null; window.removeEventListener('keydown', key, true); if (speaker.actor) speaker.actor.talking = false; changed(); onDone && onDone(); };
  const sayLine = (t) => { text.textContent = t; const how = speak(t, speaker.id); voice.textContent = how === 'file' ? 'VOICE: RECORDED' : how === 'synth' ? 'VOICE: BROWSER SYNTHETIC VOICE' : 'VOICE: SUBTITLES ONLY'; if (how === 'none') sfx.talk(); };
  const show = () => { sayLine(lines[i]); count.textContent = `${i + 1} / ${lines.length}`; next.textContent = i === lines.length - 1 && !quiz ? 'Close' : 'Continue'; };
  const ask = () => { asked = true; sayLine(quiz.q); count.textContent = 'Question'; next.hidden = true; skip.hidden = true;
    const order = quiz.options.map((t, k) => ({ t, k })).sort((a, b) => ((a.t.length * 7 + a.k) % 3) - ((b.t.length * 7 + b.k) % 3));
    order.forEach((o, n) => opts.append(el('button', { class: 'btn opt-q', type: 'button', onclick: () => { const right = o.k === 0; opts.innerHTML = ''; sayLine(right ? quiz.right : quiz.wrong); award('quiz:' + speaker.id, right ? 100 : 25, right ? 'Correct answer' : 'Good try'); right ? sfx.confirm() : sfx.deny(); count.textContent = right ? '✓ Correct' : '○ Not quite'; next.hidden = false; next.textContent = 'Close'; quiz = null; next.focus(); } }, el('kbd', {}, String(n + 1)), ' ', o.t)));
    const f = opts.querySelector('button'); if (f) f.focus(); };
  const adv = () => { if (asked && quiz) return; i++; if (i >= lines.length) { if (quiz && !asked) return ask(); done(); } else show(); };
  const key = (e) => { if (asked && quiz) { const n = parseInt(e.key, 10); const b = opts.querySelectorAll('button')[n - 1]; if (b) { e.preventDefault(); e.stopPropagation(); b.click(); } return; } if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); adv(); } };
  next.onclick = adv; skip.onclick = () => { if (quiz && !asked) { i = lines.length - 1; stopSpeak(); return ask(); } done(); }; window.addEventListener('keydown', key, true);
  ui.dialogue = { done }; if (speaker.actor) speaker.actor.talking = true; show(); changed(); next.focus();
}

// ----- Points and level progress -----
export function showPoints(pts, label, total) {
  const box = $('#points'); box.hidden = false; box.querySelector('b').textContent = fmt(total);
  const pop = el('div', { class: 'pt-pop ' + (pts < 0 ? 'neg' : 'pos') }, (pts > 0 ? '+' : '−') + Math.abs(pts), el('span', {}, label)); $('#pt-pops').append(pop); setTimeout(() => pop.remove(), 2600);
  box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); if (pts > 0) sfx.select(); else sfx.deny();
}
export function setPointsTotal(total, show = true) { const box = $('#points'); box.hidden = !show; box.querySelector('b').textContent = fmt(total); }
export function setStepper(level) { const s = $('#stepper'); s.innerHTML = ''; ['Space centre', 'Payload', 'Spacecraft and launch', 'Operations', 'Discovery'].forEach((n, k) => s.append(el('span', { class: k + 1 < level ? 'done' : k + 1 === level ? 'on' : '' }, el('i', {}, k + 1 < level ? '✓' : String(k + 1)), n))); }

// ----- Full-screen station overlays -----
export function openOverlay(node, cls = '') {
  const o = $('#overlay'); o.innerHTML = ''; o.className = 'overlay ' + cls; o.append(node); o.hidden = false; ui.overlay = node; changed();
  o.tabIndex = -1; o.focus({ preventScroll: true });
}
export function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; ui.overlay = null; changed(); }

export function modal(title, body, buttons = [{ label: 'OK', value: true, cls: 'primary' }], cls = '') {
  return new Promise((res) => {
    const m = $('#modal'); m.innerHTML = ''; m.hidden = false; ui.modalOpen = true; changed();
    const close = (v) => { m.hidden = true; m.innerHTML = ''; ui.modalOpen = false; changed(); res(v); };
    const card = el('div', { class: 'modal-card ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, el('h2', {}, title), typeof body === 'string' ? el('p', {}, body) : body,
      el('div', { class: 'modal-btns' }, buttons.map((b) => button(b.label, () => close(b.value), b.cls || ''))));
    m.append(card); const f = card.querySelector('.modal-btns button:last-child'); if (f) f.focus();
  });
}

// ----- Settings -----
export function openSettings(extra = {}) {
  const m = $('#settings'); m.innerHTML = ''; m.hidden = false; ui.settingsOpen = true; changed();
  const close = () => { m.hidden = true; ui.settingsOpen = false; save(); changed(); };
  const slider = (label, get, set, min = 0, max = 1, step = 0.05) => { const out = el('output', {}, Math.round(get() * 100) + '%'); const inp = el('input', { type: 'range', min, max, step, value: get(), 'aria-label': label, oninput: (e) => { set(+e.target.value); out.textContent = Math.round(+e.target.value * 100) + '%'; applyVolumes(); } }); return el('label', { class: 'row' }, el('span', {}, label), inp, out); };
  const seg = (label, opts, get, set) => el('div', { class: 'row' }, el('span', {}, label), el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, opts.map(([v, t]) => { const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(get() === v), class: get() === v ? 'on' : '', onclick: () => { set(v); sfx.click(); openSettings(extra); } }, t); return b; })));
  const card = el('div', { class: 'modal-card settings', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' },
    el('h2', {}, 'Settings'),
    el('h3', {}, 'Assistance'),
    seg('Assist level', [['guided', 'Guided'], ['standard', 'Standard'], ['independent', 'Independent']], () => settings.assist, (v) => { settings.assist = v; extra.onAssist && extra.onAssist(); }),
    el('p', { class: 'note' }, settings.assist === 'guided' ? 'Guided: objective markers, crew hints and highlighted controls.' : settings.assist === 'standard' ? 'Standard: objective list and mission displays, no markers or hints.' : 'Independent: a single objective line. No markers, no hints. Same mission, same science.'),
    seg('Task timers', [['on', 'On'], ['relaxed', 'Relaxed (double time)'], ['off', 'Off']], () => settings.timers || 'on', (v) => { settings.timers = v; }),
    el('p', { class: 'note' }, 'Every task has a time limit. When it runs out you can still finish, but the overrun lowers the Schedule score in the mission report. The timer pauses in Settings and during cinematic sequences.'),
    el('h3', {}, 'Audio'),
    seg('Sound effects, ambience and robot voice', [[false, 'Off'], [true, 'On']], () => settings.sound === true, (v) => { settings.sound = v; applyVolumes(); if (!v) stopSpeak(); }),
    el('p', { class: 'note' }, 'Sound is off by default. Your own voice recordings, once added, play whether this is on or off.'),
    slider('Master volume', () => settings.volume.master, (v) => (settings.volume.master = v)),
    slider('Ambience', () => settings.volume.ambience, (v) => (settings.volume.ambience = v)),
    slider('Effects and alerts', () => settings.volume.effects, (v) => (settings.volume.effects = v)),
    voiceAvailable() ? seg('Spoken dialogue', [[true, 'On'], [false, 'Off']], () => settings.voice !== false, (v) => { settings.voice = v; if (!v) stopSpeak(); }) : null,
    voiceAvailable() ? slider('Voice volume', () => settings.volume.voice ?? 0.9, (v) => (settings.volume.voice = v)) : null,
    el('p', { class: 'note' }, 'Lines with a recording in audio/voice are played in your team\u2019s voices. Other lines use the browser\u2019s synthetic voice, or subtitles only once a speaker has recordings. All dialogue is always subtitled.'),
    el('h3', {}, 'Controls and display'),
    seg('Camera in the centre', [['third', 'See my avatar'], ['first', 'First person']], () => settings.view || 'third', (v) => { settings.view = v; }),
    slider('Look sensitivity', () => settings.sensitivity / 2, (v) => (settings.sensitivity = v * 2), 0.1, 1, 0.05),
    seg('Graphics quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], () => settings.quality, (v) => { settings.quality = v; applyQuality(); }),
    seg('Reduced motion', [[false, 'Off'], [true, 'On']], () => settings.reducedMotion, (v) => { settings.reducedMotion = v; document.body.classList.toggle('reduced', v); }),
    el('h3', {}, 'Controls'),
    el('p', { class: 'note' }, 'Desktop: W A S D to move, mouse to look, E to interact, V to switch camera view, Shift to walk faster, Esc to release the mouse, P for settings. Touch: left pad to move, drag on the right to look, button to interact.'),
    el('div', { class: 'modal-btns' },
      button('Erase save and restart', async () => { close(); const ok = await modal('Erase saved mission?', 'This deletes all progress and returns to the start.', [{ label: 'Cancel', value: false }, { label: 'Erase', value: true, cls: 'danger' }]); if (ok) { hardReset(); location.reload(); } }, 'ghost'),
      button('Done', close, 'primary')));
  m.append(card);
}
export function isSettingsOpen() { return ui.settingsOpen; }

// Small labelled meter used across consoles. Status is carried by text and shape, not colour alone.
export function meter(label, value, max, unit, status) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return el('div', { class: 'meter ' + (status || '') }, el('div', { class: 'meter-head' }, el('span', {}, label), el('b', {}, `${fmt(value)} / ${fmt(max)} ${unit}`)), el('div', { class: 'bar' }, el('i', { style: { width: pct + '%' } })), status ? el('div', { class: 'meter-status' }, status === 'bad' ? '▲ Exceeds limit' : status === 'warn' ? '◆ Low margin' : '● Within limits') : null);
}
export { state };

// The personal guide (Guided assist only): a small companion that says what to do next.
let buddyText = ''; let buddyHooks = {}; export const setBuddyHooks = (h) => { buddyHooks = h; }; export const buddyNow = () => buddyText;
export function buddySay(text) {
  const b = $('#buddy'); if (!b) return; const on = settings.assist === 'guided' && !!text; b.hidden = !on; if (!on) { buddyText = text || ''; return; } if (text === buddyText) return; buddyText = text;
  if (!b.firstChild) { const c = el('canvas', { width: 64, height: 64, 'aria-hidden': 'true' }); const g = c.getContext('2d'); g.fillStyle = '#f2a23a'; g.beginPath(); g.arc(32, 34, 24, 0, 7); g.fill(); g.fillStyle = '#12161b'; g.fillRect(14, 24, 36, 18); g.fillStyle = '#7dffb0'; g.beginPath(); g.arc(24, 33, 4, 0, 7); g.arc(40, 33, 4, 0, 7); g.fill(); g.strokeStyle = '#f2a23a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 10); g.lineTo(32, 2); g.stroke(); g.fillStyle = '#7dffb0'; g.beginPath(); g.arc(32, 3, 3, 0, 7); g.fill(); b.append(c, el('div', { class: 'bubble' }, el('b', {}, 'PIP \u00B7 your guide'), el('span', {}))); }
  b.querySelector('span').textContent = text; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); if (!b.dataset.wired) { b.dataset.wired = '1'; b.addEventListener('click', () => { if (buddyHooks.open) buddyHooks.open(); }); } if (buddyHooks.speak) buddyHooks.speak(text);
}

function pipTalk(text) { try { const sy = window.speechSynthesis; if (!sy || !text) return; sy.cancel(); const u = new SpeechSynthesisUtterance(text); const rank = (x) => (/natural|neural|online/i.test(x.name) ? 8 : 0) + (/Google UK English Female|Sonia|Libby|Samantha|Aria|Jenny/i.test(x.name) ? 5 : 0) + (/Google/i.test(x.name) ? 2 : 0); const en = sy.getVoices().filter((x) => /^en/i.test(x.lang)).sort((a, b) => rank(b) - rank(a)); if (en.length) u.voice = en[0]; u.pitch = 1.25; u.rate = 1.0; u.volume = Math.max(0.3, settings.volume.master); sy.speak(u); } catch (e) { /* voice is optional */ } }
async function pipMenu() {
  if (blocking()) return; const v = await modal('PIP \u00B7 your guide', el('p', {}, buddyText || 'I am here to help.'), [{ label: settings.pipVoice === false ? 'Turn my voice on' : 'Turn my voice off', value: 'voice' }, { label: 'How do I move?', value: 'move' }, { label: 'Say that again', value: 'again', cls: 'primary' }]);
  if (v === 'voice') { settings.pipVoice = settings.pipVoice === false; save(); if (settings.pipVoice !== false) pipTalk('My voice is on.'); else if (window.speechSynthesis) window.speechSynthesis.cancel(); }
  if (v === 'move') { const t = 'Drag the left side of the screen to walk, and the right side to look around. Tap Interact when I point at something. On a keyboard, use W, A, S, D and E.'; toast('PIP: ' + t, 'info', 9000); pipTalk(t); }
  if (v === 'again') pipTalk(buddyText);
}
