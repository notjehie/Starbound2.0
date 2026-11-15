// Level 5: light-curve investigation, interpretation and the mission report.
import { state, commit, setStage, settings, resetMission } from './state.js';
import { save as saveAll } from './state.js';
import { missionDataset, comparisonDataset, primaryDataset, fold, binSeries, periodFromMarks, ASSESSMENTS, scoreMission, evaluateEvidence } from './science.js';
import { totals, opt } from './engineering.js';
import { PAYLOADS, VEHICLES, ORBITS, BUS, BUS_KEYS, BUDGET } from './catalog.js';
import { createOps } from './ops.js';
import { el, button, openOverlay, closeOverlay, modal, toast, fmt } from './ui.js';
import { sfx, setAmbience } from './audio.js';
import * as THREE from 'three';
import { fade, setScene, engine, onTick } from './engine.js';
import { makeStars } from './builders.js';
import { award, rankFor } from './points.js';
import { speak } from './voice.js';
import { SPEC, JEHIELLE } from './lines.js';

const QUALITY = { 0: 'Good', 1: 'Flagged: scattered light interval', 2: 'Flagged: isolated outlier' };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function fitCanvas(cv, hCss) { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth || cv.parentElement.clientWidth || 600; cv.width = Math.round(w * dpr); cv.height = Math.round(hCss * dpr); cv.style.height = hCss + 'px'; return dpr; }

// Depth and signal-to-noise of the folded dip at phase zero, measured from the points themselves.
function foldStats(ds, period, t0, hide) {
  if (!period || period <= 0) return null; const inn = [], out = [];
  for (let i = 0; i < ds.time.length; i++) { if (hide && ds.quality[i]) continue; let ph = ((ds.time[i] - t0) / period) % 1; if (ph < 0) ph += 1; if (ph > 0.5) ph -= 1; const dh = Math.abs(ph * period * 24); (dh <= 0.9 ? inn : dh > 3 ? out : []).push(ds.flux[i]); }
  if (inn.length < 2 || out.length < 10) return { n: inn.length, depth: 0, snr: 0 };
  const mo = out.reduce((a, b) => a + b, 0) / out.length, mi = inn.reduce((a, b) => a + b, 0) / inn.length; const sd = Math.sqrt(out.reduce((a, b) => a + (b - mo) ** 2, 0) / out.length);
  return { n: inn.length, depth: (mo - mi) * 1e6, snr: (mo - mi) / (sd / Math.sqrt(inn.length)), sd: sd * 1e6 };
}

export function openAnalysis(game) {
  setAmbience('lab');
  const sets = { mission: missionDataset(state), comparison: comparisonDataset() };
  const A = { which: 'mission', view: null, hide: false, mode: 'pan', marks: { mission: [...(state.marks || [])], comparison: [] }, period: { mission: state.period || null, comparison: null }, hover: null, seen: { flagged: false, compare: false, fold: false, zoom: false } };
  const ds = () => sets[A.which]; const span = () => [ds().time[0], ds().time[ds().time.length - 1]];
  const root = el('div', { class: 'station analysis' });
  const plot = el('canvas', { class: 'plot', tabindex: '0', role: 'img', 'aria-label': 'Light curve: brightness over time' }), fcv = el('canvas', { class: 'plot small', role: 'img', 'aria-label': 'Folded light curve' }), star = el('canvas', { class: 'starview', width: 300, height: 190, role: 'img', 'aria-label': 'Illustration of the star driven by your period' });
  const readout = el('div', { class: 'readout' }), advice = el('p', { class: 'advice', 'aria-live': 'polite' }), ladder = el('ol', { class: 'ladder' }), foldInfo = el('div', { class: 'kvs' }), marksEl = el('div', { class: 'marks' }), prov = el('div', { class: 'prov' });
  const pIn = el('input', { type: 'number', min: '0.2', max: '200', step: '0.01', 'aria-label': 'Trial period in days', oninput: (e) => { const v = parseFloat(e.target.value); A.period[A.which] = v > 0 ? v : null; A.seen.fold = true; sync(false); } });
  const pSl = el('input', { type: 'range', min: '0.5', max: '40', step: '0.01', 'aria-label': 'Trial period slider', oninput: (e) => { A.period[A.which] = +e.target.value; A.seen.fold = true; sync(true); } });
  const tabs = el('div', { class: 'tabs', role: 'tablist' }), modes = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Pointer tool' });

  // ----- main plot -----
  let geom = null;
  function drawPlot() {
    const d = ds(); const dpr = fitCanvas(plot, window.innerHeight < 800 ? 210 : 280); const g = plot.getContext('2d'), W = plot.width, Hh = plot.height; const [x0, x1] = A.view; const padL = 62 * dpr, padB = 30 * dpr, padT = 10 * dpr, padR = 10 * dpr;
    g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, Hh);
    const ys = []; for (let i = 0; i < d.time.length; i++) if (d.time[i] >= x0 && d.time[i] <= x1 && !d.quality[i]) ys.push(d.flux[i]);
    const s = ys.sort((a, b) => a - b); let lo = s.length ? s[0] : 0.995, hi = s.length ? s[s.length - 1] : 1.005; plot.dataset.x0 = x0; plot.dataset.x1 = x1; const pad = Math.max(2e-4, (hi - lo) * 0.25); lo -= pad; hi += pad;
    const X = (t) => padL + (t - x0) / (x1 - x0) * (W - padL - padR), Y = (f) => padT + (hi - f) / (hi - lo) * (Hh - padT - padB); geom = { X, Y, x0, x1, padL, padR, W, dpr };
    g.font = `${11 * dpr}px system-ui`; g.strokeStyle = '#1e252d'; g.fillStyle = '#8d97a3'; g.lineWidth = 1;
    const stepY = niceStep((hi - lo) * 1e6 / 5); for (let v = Math.ceil((lo - 1) * 1e6 / stepY) * stepY; v <= (hi - 1) * 1e6; v += stepY) { const y = Y(1 + v / 1e6); g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke(); g.fillText((v > 0 ? '+' : '') + fmt(v) + ' ppm', 4 * dpr, y + 4 * dpr); }
    const stepX = niceStep((x1 - x0) / Math.max(3, Math.min(8, Math.floor(W / (95 * dpr))))); for (let v = Math.ceil(x0 / stepX) * stepX; v <= x1; v += stepX) { const x = X(v); g.beginPath(); g.moveTo(x, padT); g.lineTo(x, Hh - padB); g.stroke(); g.fillText((stepX < 1 ? v.toFixed(2) : v.toFixed(0)) + ' d', x - 10 * dpr, Hh - 10 * dpr); }
    g.save(); g.beginPath(); g.rect(padL, padT, W - padL - padR, Hh - padT - padB); g.clip();
    const dense = (d.time.length * (W / (X(d.time[d.time.length - 1]) - X(d.time[0]) + 1))) > 6000; const r = (dense ? 1.2 : 2.1) * dpr;
    for (let i = 0; i < d.time.length; i++) { const t = d.time[i]; if (t < x0 || t > x1) continue; const q = d.quality[i]; if (q && A.hide) continue; const x = X(t), y = Y(d.flux[i]);
      if (!q) { g.fillStyle = '#dfe3e7'; g.fillRect(x - r / 2, y - r / 2, r, r); } else { g.strokeStyle = '#f2a23a'; g.lineWidth = 1.2 * dpr; const k = 3.2 * dpr; if (q === 1) g.strokeRect(x - k / 2, y - k / 2, k, k); else { g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke(); } } }
    A.marks[A.which].forEach((m, i) => { const x = X(m); g.strokeStyle = '#f2a23a'; g.lineWidth = 1.5 * dpr; g.setLineDash([4 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(x, padT); g.lineTo(x, Hh - padB); g.stroke(); g.setLineDash([]); g.fillStyle = '#f2a23a'; g.fillText('M' + (i + 1), x + 3 * dpr, padT + 12 * dpr); });
    const P = A.period[A.which], m0 = A.marks[A.which][0]; if (P && m0 != null) { g.strokeStyle = 'rgba(111,168,196,0.55)'; g.lineWidth = dpr; for (let t = m0 + Math.ceil((x0 - m0) / P) * P; t <= x1; t += P) { g.beginPath(); g.moveTo(X(t), Hh - padB - 10 * dpr); g.lineTo(X(t), Hh - padB); g.stroke(); } }
    if (A.sel) { g.fillStyle = 'rgba(242,162,58,0.15)'; g.fillRect(Math.min(A.sel.a, A.sel.b), padT, Math.abs(A.sel.b - A.sel.a), Hh - padT - padB); }
    if (A.hover) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = dpr; g.beginPath(); g.moveTo(X(A.hover.t), padT); g.lineTo(X(A.hover.t), Hh - padB); g.stroke(); }
    g.restore();
    if (!s.length) { g.fillStyle = '#8d97a3'; g.fillText('No measurements in this interval.', padL + 20, Hh / 2); }
  }
  const niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))); const n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; };
  function drawFold() {
    const d = ds(); const P = A.period[A.which]; const dpr = fitCanvas(fcv, 150); const g = fcv.getContext('2d'), W = fcv.width, Hh = fcv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, Hh); g.font = `${11 * dpr}px system-ui`; g.fillStyle = '#8d97a3';
    if (!P) { g.fillText('Set a trial period to fold the data.', 14 * dpr, Hh / 2); return; }
    const t0 = A.marks[A.which][0] ?? 0; const pts = fold(d.time, d.flux, P, t0).filter((p) => !(A.hide && d.quality[p.i])); const halfH = Math.min(12, P * 12); const win = halfH / (P * 24);
    const inW = pts.filter((p) => Math.abs(p.x) <= win); const ys = inW.map((p) => p.y).sort((a, b) => a - b); if (!ys.length) return; let lo = ys[Math.floor(ys.length * 0.01)], hi = ys[Math.ceil(ys.length * 0.99) - 1]; const pad = Math.max(2e-4, (hi - lo) * 0.2); lo -= pad; hi += pad;
    const X = (ph) => (ph + win) / (2 * win) * W, Y = (f) => (hi - f) / (hi - lo) * (Hh - 18 * dpr) + 2 * dpr;
    g.fillStyle = 'rgba(223,227,231,0.5)'; for (const p of inW) g.fillRect(X(p.x) - dpr, Y(p.y) - dpr, 2 * dpr, 2 * dpr);
    const bins = binSeries(inW.map((p) => p.x + win), inW.map((p) => p.y), (2 * win) / 36); g.strokeStyle = '#f2a23a'; g.lineWidth = 2 * dpr; g.beginPath(); bins.forEach((b, i) => { const x = X(b.x - win), y = Y(b.y); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.strokeStyle = '#3d4651'; g.lineWidth = dpr; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, Hh - 16 * dpr); g.stroke(); g.fillStyle = '#8d97a3'; g.fillText(`-${halfH.toFixed(0)} h`, 4 * dpr, Hh - 4 * dpr); g.fillText('centre of mark M1', W / 2 - 46 * dpr, Hh - 4 * dpr); g.fillText(`+${halfH.toFixed(0)} h`, W - 34 * dpr, Hh - 4 * dpr);
  }
  function drawStar() {
    const g = star.getContext('2d'), W = star.width, Hh = star.height; g.fillStyle = '#05070a'; g.fillRect(0, 0, W, Hh); const cx = W / 2, cy = Hh / 2 - 6, R = 62;
    const gr = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R); gr.addColorStop(0, '#ffd7a3'); gr.addColorStop(0.7, '#f39a4a'); gr.addColorStop(1, '#9a4217'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    const P = A.period[A.which], m0 = A.marks[A.which][0]; const st = P && m0 != null ? foldStats(ds(), P, m0, A.hide) : null; g.font = '11px system-ui'; g.fillStyle = '#8d97a3';
    if (!st || st.snr < 3 || A.hover == null) { g.fillText(!P || m0 == null ? 'Mark a dip and set a period to drive this view.' : st && st.snr < 3 ? 'No clear dip at this period: nothing to show.' : 'Move over the light curve to scrub time.', 10, Hh - 8); return; }
    let ph = ((A.hover.t - m0) / P) % 1; if (ph < 0) ph += 1; if (ph > 0.5) ph -= 1; const dh = ph * P * 24; const r = R * Math.sqrt(Math.max(0, st.depth) / 1e6); const x = cx + (dh / 1.0) * R;
    if (Math.abs(dh) < 6) { g.fillStyle = '#05070a'; g.beginPath(); g.arc(x, cy + R * 0.22, Math.max(2, r), 0, 7); g.fill(); }
    g.fillStyle = '#8d97a3'; g.fillText(Math.abs(dh) < 1 ? 'In the dip: the model object is in front of the star.' : `${Math.abs(dh).toFixed(1)} h ${dh < 0 ? 'before' : 'after'} the predicted dip.`, 10, Hh - 8);
  }

  // ----- interaction -----
  const tAt = (px) => geom.x0 + (px * geom.dpr - geom.padL) / (geom.W - geom.padL - geom.padR) * (geom.x1 - geom.x0);
  const clampView = (a, b) => { const [s0, s1] = span(); const w = Math.min(b - a, s1 - s0 + 2), minW = 0.25; let ww = Math.max(minW, w); let x0 = a + (w - ww) / 2; x0 = Math.max(s0 - 1, Math.min(x0, s1 + 1 - ww)); A.view = [x0, x0 + ww]; };
  const zoom = (f, at) => { const [a, b] = A.view; const c = at ?? (a + b) / 2; clampView(c - (c - a) * f, c + (b - c) * f); A.seen.zoom = true; sync(); };
  const ptrs = new Map(); let dragStart = null, pinch0 = null, moved = false;
  plot.addEventListener('wheel', (e) => { e.preventDefault(); const r = plot.getBoundingClientRect(); zoom(e.deltaY > 0 ? 1.25 : 0.8, tAt(e.clientX - r.left)); }, { passive: false });
  plot.addEventListener('pointerdown', (e) => { plot.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, e.clientX); const r = plot.getBoundingClientRect(); dragStart = { x: e.clientX - r.left, view: [...A.view] }; moved = false; if (ptrs.size === 2) { const xs = [...ptrs.values()]; pinch0 = { d: Math.abs(xs[0] - xs[1]), view: [...A.view] }; } });
  plot.addEventListener('pointermove', (e) => { const r = plot.getBoundingClientRect(); const px = e.clientX - r.left; if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, e.clientX);
    if (ptrs.size === 2 && pinch0) { const xs = [...ptrs.values()]; const d = Math.abs(xs[0] - xs[1]); const f = pinch0.d / Math.max(20, d); const c = (pinch0.view[0] + pinch0.view[1]) / 2, hw = (pinch0.view[1] - pinch0.view[0]) / 2 * f; clampView(c - hw, c + hw); moved = true; sync(); return; }
    if (dragStart && ptrs.size === 1) { const dx = px - dragStart.x; if (Math.abs(dx) > 4) moved = true;
      if (A.mode === 'pan' && moved) { const dt = dx * geom.dpr / (geom.W - geom.padL - geom.padR) * (dragStart.view[1] - dragStart.view[0]); clampView(dragStart.view[0] - dt, dragStart.view[1] - dt); }
      if (A.mode === 'select' && moved) A.sel = { a: dragStart.x * geom.dpr, b: px * geom.dpr }; }
    hoverAt(px); });
  const up = (e) => { const r = plot.getBoundingClientRect(); const px = e.clientX - r.left; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
    if (dragStart && !ptrs.size) { if (A.mode === 'select' && A.sel) { const a = tAt(A.sel.a / geom.dpr), b = tAt(A.sel.b / geom.dpr); A.sel = null; if (Math.abs(b - a) > 0.05) { clampView(Math.min(a, b), Math.max(a, b)); A.seen.zoom = true; } } else if (A.mode === 'mark' && !moved) addMark(tAt(px)); dragStart = null; sync(); } };
  plot.addEventListener('pointerup', up); plot.addEventListener('pointercancel', up); plot.addEventListener('pointerleave', () => { if (!ptrs.size) { A.hover = null; readout.textContent = 'Move over the plot to read a measurement.'; drawPlot(); drawStar(); } });
  plot.addEventListener('keydown', (e) => { const [a, b] = A.view; const w = b - a; if (e.key === 'ArrowLeft') clampView(a - w * 0.15, b - w * 0.15); else if (e.key === 'ArrowRight') clampView(a + w * 0.15, b + w * 0.15); else if (e.key === '+' || e.key === '=') return zoom(0.7); else if (e.key === '-') return zoom(1.4); else return; e.preventDefault(); sync(); });
  function hoverAt(px) { const d = ds(); const t = tAt(px); let best = -1, bd = 1e9; for (let i = 0; i < d.time.length; i++) { if (A.hide && d.quality[i]) continue; const dd = Math.abs(d.time[i] - t); if (dd < bd) { bd = dd; best = i; } }
    if (best < 0) return; A.hover = { t, i: best }; const q = d.quality[best]; if (q && bd < 0.05) A.seen.flagged = true;
    readout.textContent = bd > (A.view[1] - A.view[0]) / 40 + 0.03 ? `Day ${t.toFixed(2)}: no measurement here (gap in the record).` : `Day ${d.time[best].toFixed(2)} · brightness ${((d.flux[best] - 1) * 1e6 >= 0 ? '+' : '') + fmt((d.flux[best] - 1) * 1e6)} ppm · quality: ${QUALITY[q]}${d.sigma ? ` · noise ~${Math.round(d.sigma[best])} ppm` : ''}`; drawPlot(); drawStar(); }
  function addMark(t) { const d = ds(); // snap to the local minimum of a 3-point running mean
    let best = t, bv = Infinity; for (let i = 1; i < d.time.length - 1; i++) { if (Math.abs(d.time[i] - t) > 0.2 || d.quality[i]) continue; const v = (d.flux[i - 1] + d.flux[i] + d.flux[i + 1]) / 3; if (v < bv) { bv = v; best = d.time[i]; } }
    const m = A.marks[A.which]; if (m.some((x) => Math.abs(x - best) < 0.15)) return; m.push(best); m.sort((a, b) => a - b); sfx.select(); if (A.which === 'mission') award('mark:' + state.runs, 50, 'First dip marked'); }
  function setWhich(w) { A.which = w; if (w === 'comparison') A.seen.compare = true; A.view = [span()[0] - 0.5, span()[1] + 0.5]; A.hover = null; pSl.max = w === 'comparison' ? '200' : '40'; sync(); }

  // ----- guidance: what the evidence so far does and does not show -----
  function advise() {
    const m = A.marks[A.which], P = A.period[A.which]; const st = P && m.length ? foldStats(ds(), P, m[0], A.hide) : null; let text;
    if (A.which === 'comparison') text = st && st.snr >= 5 ? `In the comparison record the dips are ${fmt(st.depth)} ppm deep and ${P.toFixed(1)} days apart. Shallower and far rarer than your target's, yet the same logic applies: equal dips, equal spacing. A long period needs a long record, which is why some worlds take years to find.` : 'This is the comparison record: a different star watched for 300 days. Its dips are shallow and more than a hundred days apart. Try to find them, then fold on their spacing.';
    else if (!m.length) text = ds().time.length < 200 ? 'There is very little data here. Look anyway: note the gaps, and be honest about what a record this thin can support.' : 'Start by looking. Zoom in and scan for places where the brightness drops for an hour or two and comes back. Use the Mark tool on any dip you find. Watch for flagged points: orange squares and crosses are measurements the pipeline did not trust.';
    else if (m.length === 1) text = 'One dip marked. That is an observed signal, nothing more. A single dip can be a flare of noise, a pointing slip or a passing cloud of charged particles. Does it happen again? Keep looking.';
    else if (!P) text = `You have ${m.length} marks. If they are the same event repeating, the spacing between them is the period. Press "Use spacing of marks" and look at the folded plot.`;
    else if (!st || st.n < 2) text = 'Too few measurements fall at that phase to say anything. Try a different period.';
    else if (st.snr >= 7) text = `Folded at ${P.toFixed(2)} days the dips stack on top of each other: about ${fmt(st.depth)} ppm deep, ${st.snr.toFixed(0)} times the scatter. Equal depth at equal spacing is what a transiting object produces. That makes it a candidate. It is still not a confirmed planet: an eclipsing pair of background stars can look the same in a light curve.`;
    else if (st.snr >= 3.5) text = `At ${P.toFixed(2)} days there is a hint of a dip at the centre (${st.snr.toFixed(1)} times the scatter), but it is weak. Check each mark: is every one a real drop, or is one of them a flagged interval or a noise spike?`;
    else text = `Folded at ${P.toFixed(2)} days the points do not line up into a dip. Either the period is wrong or the marks are not the same kind of event. Adjust the period slowly and watch the orange line.`;
    advice.textContent = text;
    if (A.which === 'mission' && st && st.snr >= 7 && m.length >= 2) award('period:' + state.runs, 200, 'Period found: the dips line up'); if (A.seen.flagged) award('flag:' + state.runs, 50, 'Data quality checked'); if (A.seen.compare) award('compare:' + state.runs, 50, 'Compared with a second record'); if (A.seen.star3d) award('star3d:' + state.runs, 50, 'Viewed the result in 3D');
    const steps = [['Observed signal', m.length >= 1, 'A dip is marked in the record.'], ['Possible transit', !!(st && st.snr >= 7 && m.length >= 2), 'Dips repeat with equal depth at a regular period.'], ['Supporting evidence', !!(st && st.snr >= 7 && A.seen.flagged && A.seen.compare), 'Data quality checked; shape compared with another known record.'], ['Confirmed planet', false, 'Not reachable from a light curve alone. Needs independent follow-up.']];
    ladder.innerHTML = ''; steps.forEach(([n, ok, why]) => ladder.append(el('li', { class: ok ? 'done' : '' }, el('b', {}, (ok ? '✓ ' : '○ ') + n), el('span', {}, why))));
    foldInfo.innerHTML = ''; if (st && P) foldInfo.append(el('div', { class: 'kv' }, el('span', {}, 'Dip depth at centre'), el('b', {}, fmt(st.depth) + ' ppm')), el('div', { class: 'kv' }, el('span', {}, 'Stands above scatter'), el('b', {}, st.snr.toFixed(1) + '×')), el('div', { class: 'kv' }, el('span', {}, 'Measurements in the dip'), el('b', {}, String(st.n))));
  }
  function sync(fromSlider) {
    const P = A.period[A.which]; if (document.activeElement !== pIn) pIn.value = P ? P.toFixed(2) : ''; if (!fromSlider) pSl.value = P || pSl.min;
    tabs.innerHTML = ''; for (const [id, name] of [['mission', 'Your mission record'], ['comparison', 'Comparison record']]) tabs.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(A.which === id), class: A.which === id ? 'on' : '', onclick: () => { sfx.click(); setWhich(id); } }, name));
    modes.innerHTML = ''; for (const [id, name] of [['pan', 'Pan'], ['select', 'Zoom to region'], ['mark', 'Mark dip']]) modes.append(el('button', { type: 'button', role: 'radio', 'aria-checked': String(A.mode === id), class: A.mode === id ? 'on' : '', onclick: () => { A.mode = id; sfx.click(); sync(); } }, name));
    marksEl.innerHTML = ''; const m = A.marks[A.which]; if (!m.length) marksEl.append(el('span', { class: 'note' }, 'No dips marked yet.')); m.forEach((x, i) => marksEl.append(el('span', { class: 'chip' }, `M${i + 1} · day ${x.toFixed(2)}`, el('button', { type: 'button', 'aria-label': `Remove mark ${i + 1}`, onclick: () => { m.splice(i, 1); sync(); } }, '×'))));
    const meta = ds().meta; prov.innerHTML = ''; prov.append(el('div', { class: 'badge ' + (meta.real ? 'real' : 'sim') }, meta.label), ...[['Target', meta.target], ['Catalogue ID', meta.catalogueId], ['Mission', meta.mission], ['Sector / quarter', meta.sector], ['Cadence', meta.cadence], ['File', meta.fileId], ['Source', meta.sourceUrl ? el('a', { href: meta.sourceUrl, target: '_blank', rel: 'noopener' }, meta.source) : meta.source], ['Processing', meta.processing]].map(([k, v]) => el('div', { class: 'kv' }, el('span', {}, k), el('b', {}, v))));
    plot.style.cursor = A.mode === 'mark' ? 'crosshair' : A.mode === 'select' ? 'col-resize' : 'grab';
    drawPlot(); drawFold(); drawStar(); advise();
  }

  const showAdvice = settings.assist !== 'independent';
  root.append(
    el('header', { class: 'panel abar' }, el('div', {}, el('div', { class: 'label' }, 'Level 5 · Results and discovery'), el('h2', {}, 'Light-curve investigation')), tabs, el('div', { class: 'row-btns' }, button('Leave station', () => { save(); game.closeStation(); }, 'ghost'), button('Submit assessment', () => assess(), 'primary'))),
    el('section', { class: 'panel main' }, el('div', { class: 'toolbar' }, modes, button('−', () => zoom(1.5), 'ghost sq'), button('+', () => zoom(0.66), 'ghost sq'), button('Whole record', () => { A.view = [span()[0] - 0.5, span()[1] + 0.5]; sync(); }, 'ghost'),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', onchange: (e) => { A.hide = e.target.checked; A.seen.flagged = true; sync(); } }), ' Hide flagged measurements')), plot, readout,
      el('div', { class: 'label' }, 'Marked dips'), marksEl),
    el('section', { class: 'panel foldp' }, el('div', { class: 'label' }, 'Period finder: fold the record on a trial period'), el('div', { class: 'toolbar' }, el('label', {}, 'Period (days) ', pIn), pSl, button('Use spacing of marks', () => { const P = periodFromMarks(A.marks[A.which]); if (!P) { toast('Mark at least two separate dips first.', 'info'); return; } A.period[A.which] = P; A.seen.fold = true; sync(); }, 'ghost')), fcv, foldInfo,
      el('p', { class: 'note' }, 'Folding cuts the record into pieces one period long and stacks them. If the period is right, every dip lands at the centre and the orange line (the average) sinks there.')),
    el('aside', { class: 'panel side' }, el('div', { class: 'label' }, 'Afia'), showAdvice ? advice : button('Ask Afia what this shows', () => modal('Afia', advice.textContent), 'ghost'),
      el('div', { class: 'label' }, 'From signal to planet'), ladder, el('div', { class: 'label' }, 'Star view'), star, el('p', { class: 'note' }, 'Illustration driven by your marks and period. It is not an image of the star.'), button('Open the 3D star view', () => open3D(), 'ghost'),
      el('div', { class: 'label' }, 'Data provenance'), prov));
  // 3D star view, locked to the folded data: the model object crosses the star exactly when the measurements dip.
  function open3D() {
    const P = A.period[A.which], m0 = A.marks[A.which][0]; const stt = P && m0 != null ? foldStats(ds(), P, m0, A.hide) : null;
    if (!stt || stt.snr < 3) { toast('Mark at least two dips and find a period that lines them up first. The 3D view is driven by your result.', 'info', 6000); return; }
    const prev = engine.active; const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000002); const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 5000); cam.position.set(0, -0.6, 21); cam.lookAt(0, -1.7, 0);
    scene.add(makeStars(1500, 2000, 31));
    const mat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float time; varying vec3 vN; varying vec3 vP; float n(vec3 p){ return sin(p.x*7.0+time*0.6)*sin(p.y*8.0-time*0.4)*sin(p.z*7.5+time*0.5); } void main(){ float mu = clamp(vN.z, 0.0, 1.0); float limb = 0.32 + 0.68 * mu; float g = n(vP*3.0) * 0.5 + n(vP*9.0) * 0.3 + n(vP*21.0) * 0.2; vec3 c = mix(vec3(1.0,0.36,0.10), vec3(1.0,0.80,0.52), mu); gl_FragColor = vec4(c * limb * (0.96 + 0.045 * g), 1.0); }' });
    const starM = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 48), mat); scene.add(starM);
    const glowC = document.createElement('canvas'); glowC.width = glowC.height = 128; const gg = glowC.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 38, 64, 64, 64); gr.addColorStop(0, 'rgba(255,150,70,0.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(6.6, 6.6, 1); glow.position.z = -0.5; scene.add(glow);
    const rP = Math.max(0.03, 2 * Math.sqrt(Math.max(0, stt.depth) / 1e6)); const planet = new THREE.Mesh(new THREE.SphereGeometry(rP, 32, 24), new THREE.MeshBasicMaterial({ color: 0x020203 })); scene.add(planet);
    const pts = fold(ds().time, ds().flux, P, m0).filter((q) => !(A.hide && ds().quality[q.i])).map((q) => ({ h: q.x * P * 24, y: q.y })).filter((q) => Math.abs(q.h) <= 6);
    const ys = pts.map((q) => q.y).sort((a, b) => a - b); const lo = ys[0] - 2e-4, hi = ys[ys.length - 1] + 2e-4;
    const mini = el('canvas', { width: 720, height: 110, role: 'img', 'aria-label': 'Your folded measurements with a time cursor' }); const info = el('p', { class: 'lead', 'aria-live': 'polite' }); let hours = -5, playing = !settings.reducedMotion;
    const slider = el('input', { type: 'range', min: '-6', max: '6', step: '0.02', value: '-5', 'aria-label': 'Hours from the centre of the dip', oninput: (e) => { hours = +e.target.value; playing = false; playBtn.textContent = 'Play'; } });
    const playBtn = button(playing ? 'Pause' : 'Play', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; }, 'ghost');
    const hud = el('div', { class: 'star-hud' }, el('section', { class: 'panel' }, el('div', { class: 'label' }, `3D star view \u00B7 driven by your period of ${P.toFixed(2)} days and measured depth of ${fmt(stt.depth)} ppm`), info, mini, slider,
      el('p', { class: 'note' }, 'ILLUSTRATION, not an image. The dark disc is a model object sized from your measured dip depth and placed by your period. The dots are your delivered measurements. If the disc is on the star when the dots are low, your period explains the data.'), el('div', { class: 'row-btns' }, playBtn, button('Back to the light curve', close, 'primary'))));
    const drawMini = () => { const g = mini.getContext('2d'), W = mini.width, Hh = mini.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#dfe3e7'; for (const q of pts) g.fillRect((q.h + 6) / 12 * W - 1.5, (hi - q.y) / (hi - lo) * (Hh - 6) + 1, 3, 3); g.fillStyle = '#f2a23a'; g.fillRect((hours + 6) / 12 * W - 1, 0, 2, Hh); };
    const sc = { scene, camera: cam, cameras: [cam], update(dt) { mat.uniforms.time.value += dt; starM.rotation.y += dt * 0.01; if (playing) { hours += dt * 1.1; if (hours > 6) hours = -6; slider.value = hours; }
      planet.position.set(hours / 1.0 * 2, -0.44, 3); planet.visible = Math.abs(hours) < 3;
      const near = pts.filter((q) => Math.abs(q.h - hours) < 0.3); const mean = near.length ? near.reduce((a, q) => a + q.y, 0) / near.length : null;
      info.textContent = `${hours < 0 ? Math.abs(hours).toFixed(1) + ' h before' : hours.toFixed(1) + ' h after'} the centre of the dip. ` + (mean == null ? 'No measurements at this moment.' : `Your measurements here average ${((mean - 1) * 1e6 >= 0 ? '+' : '') + fmt((mean - 1) * 1e6)} ppm.`); drawMini(); } };
    function close() { root.hidden = false; hud.remove(); document.getElementById('overlay').className = 'overlay station-overlay solid'; setScene(prev); sync(); }
    A.seen.star3d = true; root.hidden = true; const ov = document.getElementById('overlay'); ov.className = 'overlay station-overlay'; ov.append(hud); setScene(sc); sfx.select();
  }
  function save() { state.marks = [...A.marks.mission]; state.period = A.period.mission; commit(); }
  async function assess() {
    save(); let pick = state.assessment || null, conf = 'medium';
    const body = el('div', {}, el('p', {}, 'State what your mission record supports. You are judged on whether the claim matches the evidence, not on how exciting it is.'),
      el('div', { class: 'opts col', role: 'radiogroup' }, ASSESSMENTS.map((a) => { const b = el('button', { type: 'button', class: 'opt', role: 'radio', 'aria-checked': 'false', onclick: () => { pick = a.id; sfx.select(); body.querySelectorAll('.opt').forEach((x) => { x.classList.remove('chosen'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('chosen'); b.setAttribute('aria-checked', 'true'); } }, el('b', {}, a.label), el('div', { class: 'note' }, a.text)); return b; })),
      el('p', { class: 'note' }, `Period you measured: ${state.period ? state.period.toFixed(2) + ' days' : 'none'}. Dips marked: ${state.marks.length}.`));
    const ok = await modal('Submit your scientific assessment', body, [{ label: 'Keep investigating', value: false }, { label: 'Submit', value: true, cls: 'primary' }], 'wide');
    if (!ok) return; if (!pick) { toast('Choose one of the four statements.', 'info'); return assess(); }
    state.assessment = pick; const score = scoreMission(state); const interp = score.areas.find((x) => x.key === 'interp').score; if (pick === 'confirmed') award('claim:' + state.runs, -150, 'Overclaim: a planet cannot be confirmed here'); else if (interp >= 80) award('claim:' + state.runs, 300, 'Your claim matches the evidence'); else award('claim:' + state.runs, 50, 'Assessment submitted'); award('final:' + state.runs, score.overall * 5, `Mission evaluation ${score.overall} / 100`); state.score = { overall: score.overall, grade: score.grade }; setStage('report'); commit(); closeOverlay(); discovery(game, score);
  }
  A.view = [span()[0] - 0.5, span()[1] + 0.5]; openOverlay(root, 'station-overlay solid'); const onR = () => { if (root.isConnected) sync(); else window.removeEventListener('resize', onR); }; window.addEventListener('resize', onR);
  requestAnimationFrame(() => sync()); readout.textContent = 'Move over the plot to read a measurement.';
}

// ----- the discovery moment -----
async function discovery(game, score) {
  const ev = score.evidence.primary; const good = score.truthRank === 2; const a = ASSESSMENTS.find((x) => x.id === state.assessment);
  const lines = [
    ['Science Laboratory', 'Assessment transmitted to Mission Control.'],
    ['Jehielle · Mission Control', `"${JEHIELLE.filed}" ${a.label}.`, 'ops', JEHIELLE.filed],
    ['Afia', good ? `"The record caught ${ev.covered} of ${ev.possible} dips. Folded together they stand ${ev.snr.toFixed(0)} times above the noise, every ${ev.period.toFixed(2)} days."` : ev.cls === 'single' ? `"The record holds a dip, but not enough clean repeats to show a pattern. ${ev.covered} of ${ev.possible} possible events were caught."` : '"The record does not hold a dip we can trust. Gaps and noise have hidden whatever is there."'],
    ['Afia', score.verdict],
    (() => { const l = good && a.id === 'candidate' ? SPEC.resultGood : a.id === 'confirmed' ? SPEC.resultOver : SPEC.resultHonest; return ['Godiva', '"' + l + '"', 'specialist', l]; })(),
  ];
  const stage = el('div', { class: 'discovery' }); const cvs = el('canvas', { width: 520, height: 220, role: 'img', 'aria-label': 'Folded light curve of your mission record' }); const text = el('div', { class: 'disc-text', 'aria-live': 'polite' }); const cont = button('View the mission report', () => { closeOverlay(); openReport(game, score); }, 'primary'); cont.hidden = true;
  stage.append(el('div', { class: 'label' }, 'Mission result'), cvs, text, el('div', { class: 'row-btns' }, button('Skip', () => { i = lines.length; step(); }, 'ghost'), cont));
  await fade(true, 600); openOverlay(stage, 'station-overlay solid center'); await fade(false, 600);
  // folded record at the true spacing, drawn progressively
  const ds = missionDataset(state); const pts = fold(ds.time, ds.flux, ev.period, ds.ephemeris[0].t0).filter((p) => Math.abs(p.x) < 12 / (ev.period * 24)); let shown = 0;
  const draw = () => { const g = cvs.getContext('2d'), W = cvs.width, Hh = cvs.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, Hh); const win = 12 / (ev.period * 24); const ys = pts.map((p) => p.y).sort((x, y) => x - y); if (!ys.length) { g.fillStyle = '#8d97a3'; g.font = '13px system-ui'; g.fillText('No measurements near the expected events.', 20, Hh / 2); return; } const lo = ys[Math.floor(ys.length * 0.01)] - 3e-4, hi = ys[Math.ceil(ys.length * 0.99) - 1] + 3e-4;
    g.fillStyle = '#dfe3e7'; for (let k = 0; k < Math.min(shown, pts.length); k++) { const p = pts[k]; g.fillRect((p.x + win) / (2 * win) * W - 1.5, (hi - p.y) / (hi - lo) * (Hh - 20), 3, 3); }
    g.fillStyle = '#8d97a3'; g.font = '11px system-ui'; g.fillText(`Your delivered measurements, folded every ${ev.period.toFixed(2)} days (±12 h around the expected dip)`, 8, Hh - 6); };
  const timer = setInterval(() => { shown += Math.max(2, pts.length / 60); draw(); if (shown >= pts.length) clearInterval(timer); }, 40);
  let i = 0; function step() { if (i >= lines.length) { cont.hidden = false; cont.focus(); if (good && state.assessment === 'candidate') sfx.applause(); return; } const [who, t, vw, vl] = lines[i++]; text.append(el('p', {}, el('b', {}, who), t)); if (vl) speak(vl, vw); if (i === 3) (good ? sfx.reveal : sfx.select)(); else sfx.talk(); setTimeout(step, settings.reducedMotion ? 900 : 2600); }
  step();
}

// ----- mission report -----
function counterfactuals() {
  const res = state.opsResult; const out = []; const base = res.counts.delivered;
  for (const id of ['power', 'pointing', 'comms']) { const mine = res.decisions[id]; if (!mine || mine === 'none') { if (mine === 'none') out.push({ id, text: id === 'power' ? 'Your power margin absorbed the array fault with no loss. That was decided at the assembly terminal, weeks before the fault happened.' : 'Your fine guidance system handled the reaction wheel build-up with no loss. Coarse sensors would have forced a choice between lost time and noisier data.' }); continue; }
    if (id === 'pointing') { out.push({ id, text: mine === 'ride' ? 'During the wheel build-up you kept observing, so four days of measurements carry about 60 % more noise.' : 'During the wheel build-up you stopped for 18 hours to unload the wheels, trading a short gap for clean data.' }); continue; }
    let best = null; for (const alt of ['cut', 'half', 'off', 'keep']) { if (alt === mine) continue; const o = createOps(state); if (!['power', 'comms'].every(Boolean)) continue; const r = o.runAll(Object.assign({}, res.decisions, { [id]: alt })); if (r.decisions[id] !== alt) continue; if (!best || r.counts.delivered > best.n) best = { alt, n: r.counts.delivered, label: null }; }
    if (best) { const diff = best.n - base; const name = id === 'power' ? 'solar array fault' : 'ground network outage'; out.push({ id, text: diff > 20 ? `During the ${name}, a different choice would have delivered about ${fmt(diff)} more measurements (${(diff / 48).toFixed(1)} days of data).` : `During the ${name}, your choice was as good as or better than the alternatives for this spacecraft.` }); } }
  return out;
}

export function openReport(game, scoreIn) {
  const score = scoreIn || scoreMission(state); const t = totals(state); const res = state.opsResult; const ev = score.evidence; const p = ev.primary; const a = ASSESSMENTS.find((x) => x.id === state.assessment); const orbit = ORBITS[state.orbit]; const L = state.launch;
  const sec = (title, ...kids) => el('section', { class: 'rsec' }, el('h3', {}, title), ...kids); const kv = (k, v) => el('div', { class: 'kv' }, el('span', {}, k), el('b', {}, v));
  const visFrac = res.counts.visibleSteps / res.N;
  const effects = [
    `Payload: the ${t.payload.name} with ${opt(state, 'adcs').name.toLowerCase()} gave about ${Math.round(t.sigma)} ppm of noise per measurement, so a single 0.33 % dip stood ${(3300 / t.sigma * 2).toFixed(1)} times above the noise.`,
    `Launch: ${t.mass} kg on ${t.vehicle.name} left ${L.reserve} % margin. ${L.note}`,
    `Orbit: ${orbit.name} allowed the target to be seen ${Math.round(visFrac * 100)} % of the time. Your record covers ${Math.round(res.coverage * 100)} %.`,
    res.counts.lost ? `Data handling: ${fmt(res.counts.lost)} measurements were lost because the ${opt(state, 'storage').name} filled before a contact.` : 'Data handling: the recorder never overflowed.',
    res.counts.onboard ? `Communications: ${fmt(res.counts.onboard)} recorded measurements were still on board when the mission ended. The ${opt(state, 'comms').name} could not send them down in time from this orbit.` : 'Communications: everything recorded was delivered.',
    res.counts.safeModes ? `Power: the battery emptied ${res.counts.safeModes} time(s) and the spacecraft entered safe mode, costing about a day of observing each time.` : 'Power: the spacecraft never entered safe mode.',
    ...counterfactuals().map((c) => c.text),
    `Result: ${p.covered} of ${p.possible} dips of the main signal were caught, with a combined signal-to-noise of ${p.snr.toFixed(1)}.`,
  ];
  const lessons = [];
  if (a.id === 'confirmed') lessons.push('A light curve shows that something dims a star on a schedule. Confirming a planet needs independent evidence, such as ruling out background eclipsing stars or measuring the star’s wobble.');
  if (score.truthRank < 2 && p.snrSingle < 6.5) lessons.push('The instrument noise was close to the size of the dip. A lower-noise instrument, or fine pointing, would make each event visible on its own.');
  if (score.truthRank < 2 && p.covered < 2) lessons.push('Too few events were caught. Coverage matters as much as precision: gaps from the orbit, a full recorder or instrument-off periods can each hide a two-hour dip.');
  if (res.counts.lost) lessons.push('Size the recorder for the longest stretch without contact, including an outage, not for an average day.');
  if (res.counts.onboard > 50) lessons.push('Downlink rate must match the data the instrument produces in that orbit, or science is left on board.');
  if (res.counts.safeModes) lessons.push('Power margin on the ground is what gives you choices in flight. A thin margin turned one fault into lost observing time.');
  if (t.spent / BUDGET > 0.9 && score.objectiveMet) lessons.push('The objective was met, but with little budget to spare. Check whether a smaller launcher or lighter subsystems would have returned the same science.');
  if (score.objectiveMet && t.spent / BUDGET <= 0.8) lessons.push('You met the objective well inside the budget. Matching the design to the question, and no more, is good engineering.');
  if (state.validationFailures) lessons.push(`The engineering review caught ${state.validationFailures} design problem(s) before launch. Finding them on the ground costs minutes; finding them in orbit costs the mission.`);
  if (ev.signals[1] && ev.signals[1].cls !== 'none' && score.truthRank === 2) lessons.push(`Your record also holds a second, much shallower periodic signal near ${ev.signals[1].period.toFixed(1)} days (${ev.signals[1].snr.toFixed(1)} sigma). Small signals reward low noise and long, unbroken coverage.`);
  if (score.schedule && score.schedule.late) lessons.push('Some tasks ran past their time limit. Real missions run to a schedule: launch windows and ground-station passes do not wait.');
  if (!lessons.length) lessons.push('A well-matched design, calm operations and a claim that fits the evidence: that is a complete mission.');
  const base = primaryDataset(); const ref = el('canvas', { width: 560, height: 150, role: 'img', 'aria-label': 'Complete source record folded at the main signal period' });
  const prevBest = settings.best || null; const newBest = !prevBest || state.points > prevBest.points; if (newBest) { settings.best = { points: state.points, overall: score.overall, grade: score.grade }; saveAll(); }
  const root = el('div', { class: 'station report' }, el('article', { class: 'panel reportcard' },
    el('div', { class: 'label' }, 'Final mission report · run ' + (state.runs + 1) + (settings.playerName ? ' · ' + ((settings.avatar || {}).outfit === 'astronaut' ? 'Astronaut' : 'Mission lead') + ': ' + settings.playerName : '')), el('h2', {}, 'STARBOUND mission evaluation'),
    settings.hunch ? el('p', { class: 'note' }, `Your hunch before the mission: ${({ planet: 'a hidden planet', star: 'a second, fainter star', glitch: 'a telescope mistake', unsure: 'too early to say' })[settings.hunch]}. Compare it with what your evidence supports below.`) : null,
    el('p', { class: 'best' }, newBest ? (prevBest ? `\u2605 New personal best! You beat ${prevBest.points.toLocaleString()} points.` : '\u2605 First mission complete. This is the score to beat.') : `Your best so far: ${prevBest.points.toLocaleString()} points. Fly again to beat it.`),
    el('div', { class: 'grade pts' }, el('div', { class: 'gnum' }, '★'), el('div', {}, el('b', {}, `${fmt(state.points)} mission points · ${rankFor(state.points).name}`), el('span', {}, rankFor(state.points).next ? `${fmt(rankFor(state.points).next - state.points)} more points for the next rank. Fly again to beat your score.` : 'Top rank reached.'))),
    el('div', { class: 'grade ' + score.grade.toLowerCase() }, el('div', { class: 'gnum' }, String(score.overall)), el('div', {}, el('b', {}, score.grade), el('span', {}, score.objectiveMet ? 'Scientific objective met: recurring dips established.' : 'Scientific objective not met: the record cannot establish that the dimming repeats.'))),
    sec('Mission objective', el('p', {}, 'Determine whether the dimming of the target star repeats on a regular schedule, consistent with a transiting planet, and report what the evidence supports.')),
    sec('Evaluation', el('div', { class: 'areas' }, score.areas.map((x) => el('div', { class: 'area' }, el('div', { class: 'meter-head' }, el('span', {}, x.name), el('b', {}, x.score + ' / 100')), el('div', { class: 'bar' }, el('i', { style: { width: x.score + '%' } })))))),
    sec('Scientific interpretation', kv('Your assessment', a.label), kv('What the evidence supports', score.supported.label), el('p', {}, score.verdict + (score.periodNote ? ' ' + score.periodNote : '')), el('p', { class: 'note' }, base.meta.real ? 'This was a validation exercise using real archival observations of a star whose planets are already known. No new discovery is claimed.' : 'This investigation used a SIMULATED dataset, clearly labelled as such. No real-world discovery is claimed.')),
    sec('Your design', el('div', { class: 'kvs two' }, kv('Payload', `${t.payload.name} (${t.payload.short})`), ...BUS_KEYS.map((k) => kv(BUS[k].label, opt(state, k).name)), kv('Launch vehicle', t.vehicle.name), kv('Orbit', orbit.name), kv('Spacecraft mass', t.mass + ' kg'), kv('Power load / generation', `${t.load} / ${t.gen} W`), kv('Budget used', `${t.spent} of ${BUDGET} M (${Math.round(t.spent / BUDGET * 100)} %)`), kv('Engineering reviews failed', String(state.validationFailures)), kv('Checklist errors', String(state.checklistErrors)))),
    sec('Operations and data', el('div', { class: 'kvs two' }, kv('Mission length', res.days + ' days'), kv('Measurements delivered', fmt(res.counts.delivered)), kv('Record coverage', Math.round(res.coverage * 100) + ' %'), kv('Lost to full recorder', fmt(res.counts.lost)), kv('Left on board', fmt(res.counts.onboard)), kv('Safe-mode entries', String(res.counts.safeModes)), kv('Array fault decision', decisionName('power', res.decisions.power)), kv('Wheel build-up decision', decisionName('pointing', res.decisions.pointing)), kv('Network outage decision', decisionName('comms', res.decisions.comms)))),
    score.schedule ? sec('Schedule', el('table', { class: 'cmp sched' }, el('thead', {}, el('tr', {}, el('th', {}, 'Task'), el('th', {}, 'Time used'), el('th', {}, 'Time allowed'), el('th', {}, 'Result'))), el('tbody', {}, score.schedule.rows.map((r) => el('tr', {}, el('th', {}, r.name), el('td', {}, mmss(r.used)), el('td', {}, mmss(r.limit)), el('td', {}, r.over > 0 ? '\u25B2 ' + mmss(r.over) + ' over' : '\u25CF On time'))))), el('p', { class: 'note' }, score.schedule.late ? `${score.schedule.late} of ${score.schedule.rows.length} tasks ran over their time limit.` : 'Every task was finished inside its time limit.')) : null,
    sec('Mission points', el('table', { class: 'cmp sched' }, el('tbody', {}, state.pointLog.map((r) => el('tr', {}, el('th', {}, r.label), el('td', {}, (r.pts > 0 ? '+' : '−') + Math.abs(r.pts))))))),
    sec('How your decisions shaped the result', el('ul', { class: 'issues' }, effects.map((e) => el('li', {}, e)))),
    sec('Lessons learned', el('ul', { class: 'issues' }, lessons.map((e) => el('li', {}, e)))),
    sec('Reference: the complete source record', ref, el('p', { class: 'note' }, `${base.meta.label}. All ${fmt(base.time.length)} source measurements folded at ${p.period.toFixed(2)} days, without your mission's gaps or instrument noise layer. Source: ${base.meta.source}.`)),
    el('div', { class: 'row-btns' }, button('Return to the space centre', () => { closeOverlay(); game.toCentre(); }, 'ghost'), button('Redesign the mission and fly again', async () => { const ok = await modal('Fly the mission again?', 'Your design, launch and results will be cleared. The crew remember you, so you start at the payload bench.', [{ label: 'Cancel', value: false }, { label: 'Start a new run', value: true, cls: 'primary' }]); if (ok) { resetMission(true); closeOverlay(); game.toCentre(true); } }, 'primary'))));
  openOverlay(root, 'station-overlay solid');
  const g = ref.getContext('2d'); g.fillStyle = '#0b0e12'; g.fillRect(0, 0, ref.width, ref.height); const e0 = base.ephemeris[0]; if (e0) { const win = 12 / (e0.period * 24); const pts = fold(base.time, base.flux, e0.period, e0.t0).filter((q) => Math.abs(q.x) < win && !base.quality[q.i] && Number.isFinite(q.y)); const ys = pts.map((q) => q.y).sort((x, y) => x - y); const lo = ys[0] - 2e-4, hi = ys[ys.length - 1] + 2e-4; g.fillStyle = '#dfe3e7'; for (const q of pts) g.fillRect((q.x + win) / (2 * win) * ref.width - 1, (hi - q.y) / (hi - lo) * (ref.height - 8) + 2, 2.5, 2.5); }
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s) % 60).padStart(2, '0')}`;
function decisionName(id, v) { const m = { desat: 'Stopped 18 h to unload wheels', ride: 'Kept observing with noisier pointing', none: 'Absorbed by the design', cut: 'Cut heaters and transmitter power', half: id === 'power' ? 'Duty-cycled the instrument' : 'Halved the cadence', off: 'Instrument off', keep: 'Kept observing' }; return m[v] || 'Not reached'; }
