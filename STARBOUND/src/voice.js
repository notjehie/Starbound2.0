// Voice playback. Every fixed line of dialogue has an id (for example "paula_01").
// If a recording exists at audio/voice/<id>.mp3 (or .m4a, .wav, .ogg) it is played.
// Otherwise the browser's synthetic voice reads the line, unless that speaker already
// has recordings, in which case the line is subtitles only (so voices are never mixed).
import { settings } from './state.js';

export const SPEAKERS = { specialist: 'godiva', scientist: 'afia', engineer: 'paula', ops: 'jehielle', pa: 'pa' };
export const LINES = [];            // { id, who, text, when }
const byText = new Map(); const counts = {};
export function reg(who, text, when = '') { const key = SPEAKERS[who]; counts[key] = (counts[key] || 0) + 1; const id = `${key}_${String(counts[key]).padStart(2, '0')}`; LINES.push({ id, who, text, when }); byText.set(who + '|' + text, id); return text; }
export const lineId = (who, text) => byText.get(who + '|' + text) || null;

const EXT = ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'webm']; const recorded = {}; let current = null, files = null;
// audio/voice/manifest.js lists the recordings that exist, so the game never requests a missing file.
function fileFor(id) { if (!files) { files = new Map(); const list = (typeof window !== 'undefined' && window.STARBOUND_VOICE_FILES) || []; for (const f of list) { const m = /^(.+)\.([a-z0-9]+)$/i.exec(f); if (m && EXT.includes(m[2].toLowerCase())) { files.set(m[1].toLowerCase(), f); const key = m[1].toLowerCase().split('_')[0]; for (const [who, k] of Object.entries(SPEAKERS)) if (k === key) recorded[who] = true; } } } return files.get(id) || null; }
const SYN = { specialist: { pitch: 1.1, rate: 1.0, pick: 0 }, scientist: { pitch: 1.2, rate: 0.98, pick: 1 }, engineer: { pitch: 1.0, rate: 1.0, pick: 2 }, ops: { pitch: 0.95, rate: 1.04, pick: 3 }, pa: { pitch: 1, rate: 1, pick: 0 } };
export const synthAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
export const voiceOn = () => settings.voice !== false;
export const hasRecordings = (who) => { fileFor(''); return !!recorded[who]; };
const vol = () => Math.max(0, Math.min(1, (settings.volume.voice ?? 0.9) * settings.volume.master));
export function probeRecordings() { fileFor(''); }
export function stopSpeak() { try { if (typeof window !== 'undefined' && window.__sbTTSStop) window.__sbTTSStop(); if (current) { current.pause(); current = null; } if (synthAvailable()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
function synth(text, who) { if (!synthAvailable()) return; try { const sy = window.speechSynthesis; const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, '')); const v = SYN[who] || SYN.specialist; const rank = (x) => (/natural|neural|online/i.test(x.name) ? 8 : 0) + (/Google UK English Female|Sonia|Libby|Samantha|Serena|Karen|Aria|Jenny/i.test(x.name) ? 5 : 0) + (/Google/i.test(x.name) ? 2 : 0) + (/en-GB|en_GB/i.test(x.lang) ? 1 : 0) - (/espeak|compact/i.test(x.name) ? 6 : 0); const en = sy.getVoices().filter((x) => /^en/i.test(x.lang)).sort((a, b) => rank(b) - rank(a)); if (en.length) { const good = en.filter((x) => rank(x) >= rank(en[0]) - 3); u.voice = good[v.pick % good.length]; } u.rate = v.rate * 0.96; u.lang = 'en-GB'; u.pitch = v.pitch; u.rate = v.rate; u.volume = vol(); sy.speak(u); } catch (e) { /* optional */ } }
// Returns 'file', 'synth' or 'none' (what the player will hear for this line).
export function speak(text, who) {
  stopSpeak(); if (!voiceOn() || typeof window === 'undefined') return 'none';
  const id = lineId(who, text); const f = id ? fileFor(id) : (fileFor(''), null);
  if (f) { try { const a = new Audio('audio/voice/' + f); a.volume = vol(); current = a; a.play().catch(() => {}); return 'file'; } catch (e) { /* fall through */ } }
  if (recorded[who]) return 'none';
  if (typeof window.__sbTTS === 'function') { window.__sbTTS(text, who); return 'tts'; }
  if (!synthAvailable()) return 'none';
  synth(text, who); return 'synth';
}
