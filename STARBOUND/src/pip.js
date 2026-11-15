// PIP, the player's companion: a real voice, and a friend you can talk to.
// On the hosted game page PIP speaks with a Claude voice, listens through the microphone and
// answers with Claude. Opened from files, PIP falls back to the device voice and built-in replies.
import { settings, save } from './state.js';
import { el } from './ui.js';

let voiceErr = '', tts = null, sample = null, dict = null, keep = null, context = () => '', hintNow = () => '', history = [], panel = null, lastSaid = '';
const CREW_VOICE = { specialist: 'buttery', scientist: 'rounded', engineer: 'glassy', ops: 'buttery', pa: 'glassy' };
export const voiceKind = () => (tts ? 'claude' : (typeof window !== 'undefined' && window.speechSynthesis ? 'device' : 'none'));
export function setPipContext(fn, hintFn) { context = fn; if (hintFn) hintNow = hintFn; }

function deviceSpeak(text, pitch = 1.2) {
  try { const sy = window.speechSynthesis; if (!sy || !text) return; sy.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/[“”"]/g, '')); u.lang = 'en-US';
    const rank = (x) => (/natural|neural|online/i.test(x.name) ? 8 : 0) + (/Google UK English Female|Google US English|Sonia|Libby|Samantha|Aria|Jenny/i.test(x.name) ? 5 : 0) + (/Google/i.test(x.name) ? 2 : 0);
    const en = sy.getVoices().filter((x) => /^en/i.test(x.lang)).sort((a, b) => rank(b) - rank(a)); if (en.length) u.voice = en[0]; u.pitch = pitch; u.rate = 1; u.volume = 1; keep = u; setTimeout(() => { try { sy.resume(); sy.speak(u); } catch (e) { /* optional */ } }, 90); } catch (e) { /* optional */ }
}
export function stopVoice() { try { if (tts) tts.stop(); if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
// who: 'pip' or a crew role. Returns true when something will be heard.
export function sayAloud(text, who = 'pip') {
  if (!text || settings.pipVoice === false) return false; lastSaid = text;
  if (tts) { tts.speak(String(text).slice(0, 1900), { voice: who === 'pip' ? 'airy' : (CREW_VOICE[who] || 'buttery'), language: 'en' }).catch((e) => { voiceErr = (e && e.code) || 'error'; if (e && e.code === 'not_granted') { tts = null; } }); return true; }
  if (window.claude && typeof window.claude.use === 'function') { try { window.claude.use('tts').then((v) => { if (v) { tts = v; sayAloud(text, who); } }).catch(() => {}); } catch (e) { /* ignore */ } return false; }
  if (window.speechSynthesis) { deviceSpeak(text, 1); return true; }
  return false;
}
export function initPip() {
  try { if (window.speechSynthesis) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); } } catch (e) { /* ignore */ }
  const c = typeof window !== 'undefined' ? window.claude : null; if (!c || typeof c.use !== 'function') return;
  const grab = (name, set) => { try { c.use(name).then((v) => { if (v) set(v); }).catch(() => {}); } catch (e) { /* not offered */ } };
  grab('tts', (v) => { tts = v; window.__sbTTS = (text, who) => sayAloud(text, who); window.__sbTTSStop = () => { try { v.stop(); } catch (e) { /* ignore */ } }; });
  grab('sample', (v) => { sample = v; }); grab('dictation', (v) => { dict = v; });
}

const FACTS = ['A day on Mercury, from one sunrise to the next, lasts about 176 Earth days.', 'The footprints left on the Moon by astronauts could last for millions of years, because there is no wind to blow them away.', 'Europa, a moon of Jupiter, has an ocean under its ice with about twice as much water as all of Earth’s oceans.', 'Light from the Sun takes a little over eight minutes to reach Earth.', 'On the Moon you would weigh about one sixth of what you weigh on Earth.', 'In orbit, astronauts see about sixteen sunrises and sunsets every day.', 'Space is not far away. It starts only about 100 kilometres above your head.', 'Mercury has ice hiding in craters near its poles, where sunlight never reaches.'];
const JOKES = ['Why did the Sun go to school? To get a little brighter!', 'How do you organise a space party? You planet!', 'Why couldn’t the astronaut book a room on the Moon? Because it was full!', 'What do planets like to read? Comet books!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function offline(q) { const t = q.toLowerCase(); const now = hintNow() || 'Follow the amber arrow and I will point the way.'; const name = settings.playerName || 'friend';
  if (/joke|funny|laugh/.test(t)) return pick(JOKES);
  if (/fact|tell me something|did you know|teach/.test(t)) return 'Here is one I love. ' + pick(FACTS);
  if (/who are you|your name|what are you/.test(t)) return `I am PIP! I am your pocket robot and your friend on this mission, ${name}. I ride on your shoulder and I never get tired.`;
  if (/scared|afraid|nervous|worried|fear/.test(t)) return 'That is okay. Even real astronauts feel that way. Take a breath with me. We do one small step at a time, and I am right here.';
  if (/hello|hi\b|hey|good (morning|evening|afternoon)/.test(t)) return `Hey ${name}! So good to hear you. Ready for the next bit?`;
  if (/thank/.test(t)) return 'Any time! That is what friends are for.';
  if (/how are you|you okay|feeling/.test(t)) return 'My batteries are full and my antenna is tingling. I love mission days!';
  if (/move|walk|control|how do i/.test(t)) return 'Drag the left side of the screen to walk and the right side to look. Tap Interact when something lights up. On a keyboard it is W, A, S, D and E.';
  if (/what|where|stuck|help|next|do now|lost|confus/.test(t)) return 'Here is what we do now. ' + now;
  if (/moon|mercury|europa|star|planet|space|rocket|earth|sun|jupiter/.test(t)) return pick(FACTS);
  return `Good question, ${name}. I am not sure, but I do know this: ${now}`;
}
async function answer(q) {
  if (sample) { try { const sys = `You are PIP, a small, warm, funny robot companion inside STARBOUND, a space mission game for young players. You are the player's friend, not a manual. The player's name is ${settings.playerName || 'unknown'}. Speak in 1 to 3 short sentences that sound good read aloud. No lists, no emoji, no markdown. Be encouraging and playful. Real space facts must be accurate; if you are not sure, say so. Do not invent game buttons or features. What is happening in the game right now: ${context() || 'the player is exploring'}. If they ask what to do, base it on that.`;
      const msgs = [{ role: 'user', content: sys + '\n\nThe player says: ' + (history[0] ? history[0].q : q) }]; history.forEach((h, i) => { msgs.push({ role: 'assistant', content: h.a }); msgs.push({ role: 'user', content: i + 1 < history.length ? history[i + 1].q : q }); });
      const r = await sample(msgs, { modelTier: 'quick', cache: false }); if (r && r.text) return r.text.trim(); } catch (e) { if (e && e.code === 'not_granted') sample = null; } }
  return offline(q);
}

export function openPipChat(greeting) {
  if (panel) { panel.querySelector('input').focus(); return; }
  const log = el('div', { class: 'pip-log', 'aria-live': 'polite' }); const inp = el('input', { type: 'text', placeholder: 'Say something to PIP…', 'aria-label': 'Message to PIP', maxlength: '200' }); let busy = false;
  const add = (who, text) => { const b = el('div', { class: 'pip-msg ' + who }, text); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  const send = async (q) => { q = (q || '').trim(); if (!q || busy) return; busy = true; inp.value = ''; add('me', q); const wait = add('pip', '…'); const a = await answer(q); history.push({ q, a }); if (history.length > 6) history.shift(); wait.textContent = a; log.scrollTop = log.scrollHeight; sayAloud(a); busy = false; };
  const chips = el('div', { class: 'pip-chips' }, ['What do I do now?', 'Tell me a space fact', 'Tell me a joke', 'I am nervous'].map((c) => el('button', { type: 'button', onclick: () => send(c) }, c)));
  const mic = el('button', { type: 'button', class: 'pip-mic', 'aria-label': 'Talk to PIP with your voice' }, '🎤 Talk'); let listening = false;
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (dict) { try { dict.onFinal(({ text }) => { if (panel) send(text); }); dict.onPartial(({ text }) => { if (panel) inp.value = text; }); dict.onState(({ state }) => { listening = state === 'listening'; mic.classList.toggle('on', listening); mic.textContent = listening ? '■ Listening… tap to stop' : '🎤 Talk'; }); } catch (e) { /* ignore */ }
    mic.onclick = () => { if (listening) { dict.stop().catch(() => {}); return; } stopVoice(); dict.start().catch((e) => { if (e && e.code === 'not_granted') mic.hidden = true; }); }; }
  else if (SR) { mic.onclick = () => { try { stopVoice(); const r = new SR(); r.lang = 'en-US'; r.interimResults = false; mic.classList.add('on'); mic.textContent = 'Listening…'; r.onresult = (e) => send(e.results[0][0].transcript); r.onend = r.onerror = () => { mic.classList.remove('on'); mic.textContent = '🎤 Talk'; }; r.start(); } catch (e) { mic.hidden = true; } }; }
  else mic.hidden = true;
  const voiceBtn = el('button', { type: 'button', class: 'pip-voice' }); const drawVoice = () => { voiceBtn.textContent = settings.pipVoice === false ? '🔇 Voice off' : '🔊 Voice on'; };
  voiceBtn.onclick = () => { settings.pipVoice = settings.pipVoice === false; save(); drawVoice(); if (settings.pipVoice === false) stopVoice(); else { voiceErr = ''; sayAloud('My voice is on. Can you hear me?'); setTimeout(() => { if (voiceErr && panel) note.textContent = 'PIP\u2019s voice was refused here (' + voiceErr + '). Open the game page in the Chrome browser itself and tap the screen once first.'; }, 2500); } }; drawVoice();
  const note = el('div', { class: 'pip-note' }, voiceErr ? 'PIP\u2019s voice was refused here (' + voiceErr + '). Try the game page in the Chrome browser itself.' : voiceKind() === 'claude' ? (sample ? 'PIP can hear you, think and talk here.' : 'PIP talks out loud here.') : voiceKind() === 'device' ? 'PIP is using this device’s voice. If you hear nothing, turn the media volume up, or play on the game page in Chrome.' : 'This browser gave PIP no voice. PIP will answer in writing.');
  const close = () => { if (dict && listening) dict.stop().catch(() => {}); panel.remove(); panel = null; };
  panel = el('div', { id: 'pip-chat', role: 'dialog', 'aria-label': 'Talk to PIP' }, el('div', { class: 'pip-head' }, el('b', {}, 'PIP · your friend'), voiceBtn, el('button', { type: 'button', class: 'pip-x', 'aria-label': 'Close', onclick: close }, '×')), log, chips, el('form', { class: 'pip-form', onsubmit: (e) => { e.preventDefault(); send(inp.value); } }, mic, inp, el('button', { type: 'submit', class: 'pip-send' }, 'Send')), note);
  document.body.append(panel); const hi = greeting || `Hi ${settings.playerName || 'friend'}! I am PIP. Ask me anything, or tap Talk and just say it.`; add('pip', hi); sayAloud(hi);
}
export const repeatLast = () => sayAloud(lastSaid);
