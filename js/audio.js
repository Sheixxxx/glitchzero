'use strict';
/* ===== Реалистичный синтезированный звук: слои, реверберация цеха, 3D-панорама, шаги, фон ===== */
const SFX = (() => {
  let ac = null, master, comp, sfxG, musG, ambG, rev, revG, musTimer = null, step = 0, musMode = 'menu', last = {}, noiseBuf = null, brownBuf = null, ambOn = false;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ac.createGain(); master.connect(comp); comp.connect(ac.destination);
      sfxG = ac.createGain(); sfxG.connect(master); musG = ac.createGain(); musG.connect(master); ambG = ac.createGain(); ambG.connect(master);
      // реверберация «бетонный цех»: импульсный отклик из затухающего шума
      rev = ac.createConvolver(); rev.buffer = impulse(1.9, 2.6); revG = ac.createGain(); revG.gain.value = 0.55; rev.connect(revG); revG.connect(master);
      noiseBuf = mkNoise(2, 'white'); brownBuf = mkNoise(4, 'brown');
      vol(); startMusic(); startAmb();
    } catch (e) { ac = null; }
  }
  function impulse(sec, decay) { const n = ac.sampleRate * sec, b = ac.createBuffer(2, n, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1); } } return b; }
  function mkNoise(sec, kind) { const n = ac.sampleRate * sec, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
  function vol() { if (!ac) return; const st = P.s.settings; sfxG.gain.value = st.sfx; musG.gain.value = st.music * 0.35; ambG.gain.value = st.sfx * 0.5; }
  // выход с панорамой/дистанцией и посылом в реверб
  function out(pan = 0, g = 1, wet = 0.25) {
    const gn = ac.createGain(); gn.gain.value = g; let node = gn;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); gn.connect(p); node = p; }
    node.connect(sfxG); if (wet > 0) { const s = ac.createGain(); s.gain.value = wet; node.connect(s); s.connect(rev); }
    return gn;
  }
  function env(g, t, a, peak, d, end = 0.0008) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  // слой шума через фильтр
  function nz(dst, t, dur, type, f0, f1, q, peak, att = 0.002) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    const g = ac.createGain(); env(g, t, att, peak, dur); s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + att + dur + 0.05);
  }
  // тональный слой
  function tn(dst, t, dur, type, f0, f1, peak, att = 0.002) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, att, peak, dur); o.connect(g); g.connect(dst); o.start(t); o.stop(t + att + dur + 0.05);
  }
  // металлический «звон»: негармонические моды
  function metal(dst, t, base, dur, peak) { for (const [k, a] of [[1, 1], [1.59, 0.6], [2.14, 0.45], [2.83, 0.3], [3.71, 0.2]]) tn(dst, t, dur * (1.2 - k * 0.15), 'sine', base * k * (0.98 + Math.random() * 0.04), 0, peak * a, 0.001); }
  const R = () => 0.92 + Math.random() * 0.16;
  // ---------- звуки ----------
  const gun = { spark: 'rifle', vector: 'shotgun', quartz: 'heavy', nova: 'sniper', phantom: 'blade', singular: 'energy' };
  function shoot(kind, pan, g) {
    const t = ac.currentTime, o = out(pan, g, kind === 'sniper' ? 0.6 : 0.35), r = R();
    if (kind === 'shotgun' || kind === 'heavy') { nz(o, t, 0.28, 'lowpass', 2600, 300, 0.7, 0.9); tn(o, t, 0.22, 'sine', 95 * r, 38, 1.0); nz(o, t, 0.05, 'highpass', 3000, 0, 0.7, 0.5); tn(o, t + 0.22, 0.06, 'square', 600, 200, 0.05); nz(o, t + 0.25, 0.05, 'bandpass', 1800, 0, 4, 0.15); }
    else if (kind === 'sniper') { nz(o, t, 0.02, 'highpass', 4000, 0, 0.7, 1.0); nz(o, t, 0.45, 'lowpass', 5000, 400, 0.8, 0.7); tn(o, t, 0.3, 'sine', 120 * r, 35, 0.9); tn(o, t + 0.01, 0.12, 'sawtooth', 2400, 800, 0.05); }
    else if (kind === 'blade') { nz(o, t, 0.18, 'bandpass', 900, 4200, 2.5, 0.55, 0.03); metal(o, t + 0.05, 1900 * r, 0.25, 0.05); }
    else if (kind === 'energy') { tn(o, t, 0.25, 'sawtooth', 680 * r, 140, 0.18); tn(o, t, 0.3, 'sine', 160, 50, 0.6); nz(o, t, 0.2, 'bandpass', 1200, 300, 3, 0.35); }
    else { nz(o, t, 0.012, 'highpass', 3500, 0, 0.7, 0.9); nz(o, t, 0.16, 'bandpass', 1900 * r, 500, 0.9, 0.7); tn(o, t, 0.13, 'sine', 140 * r, 45, 0.8); tn(o, t + 0.004, 0.05, 'square', 220, 90, 0.08); }
  }
  function hitMetal(pan, g, big) { const t = ac.currentTime, o = out(pan, g, 0.3); nz(o, t, 0.04, 'highpass', 2500, 0, 0.7, 0.5); metal(o, t, (big ? 640 : 980) * R(), big ? 0.35 : 0.2, big ? 0.16 : 0.1); tn(o, t, 0.08, 'sine', 260, 90, 0.3); }
  function ricochet(pan, g) { const t = ac.currentTime, o = out(pan, g, 0.45); nz(o, t, 0.05, 'bandpass', 3000, 0, 1.5, 0.45); if (Math.random() < 0.55) tn(o, t + 0.01, 0.22, 'sine', 3400 * R(), 1100, 0.07); nz(o, t + 0.02, 0.12, 'lowpass', 900, 300, 0.6, 0.15); }
  function boom(pan, g, big) {
    const t = ac.currentTime, o = out(pan, g, 0.8);
    nz(o, t, 0.02, 'highpass', 2000, 0, 0.7, 1.0); nz(o, t, big ? 1.9 : 1.3, 'lowpass', 3500, 120, 0.7, 1.0, 0.006); tn(o, t, big ? 1.1 : 0.8, 'sine', 70, 24, 1.2, 0.004); tn(o, t, 0.35, 'triangle', 140, 40, 0.6);
    for (let i = 0; i < 6; i++) nz(o, t + 0.08 + Math.random() * 0.6, 0.05, 'bandpass', 1500 + Math.random() * 2500, 0, 3, 0.18 * Math.random());
  }
  function robotDie(pan, g) { const t = ac.currentTime, o = out(pan, g, 0.5); metal(o, t, 330 * R(), 0.5, 0.12); nz(o, t, 0.5, 'bandpass', 2600, 400, 4, 0.35, 0.01); tn(o, t, 0.6, 'sawtooth', 420, 55, 0.12, 0.01); nz(o, t + 0.25, 0.12, 'lowpass', 600, 100, 0.7, 0.5); }
  function hurt() { const t = ac.currentTime, o = out(0, 1, 0.2); tn(o, t, 0.25, 'sine', 110, 45, 1.0); nz(o, t, 0.12, 'lowpass', 1400, 200, 0.7, 0.7); metal(o, t, 520, 0.18, 0.08); }
  function eshot(pan, g) { const t = ac.currentTime, o = out(pan, g, 0.35); tn(o, t, 0.16, 'sawtooth', 1300 * R(), 260, 0.12); nz(o, t, 0.12, 'bandpass', 1600, 500, 2, 0.35); tn(o, t, 0.12, 'sine', 180, 60, 0.4); }
  function stepS(metalFloor) { const t = ac.currentTime, o = out((Math.random() - 0.5) * 0.15, 0.55, 0.15); nz(o, t, 0.06, 'lowpass', 900 * R(), 200, 0.8, 0.5); tn(o, t, 0.05, 'sine', 90, 50, 0.35); if (metalFloor) metal(o, t, 760 * R(), 0.08, 0.025); }
  const lib = {
    shoot: () => shoot('rifle', 0, 0.8), hit: () => hitMetal(0, 0.6), kill: () => robotDie(0, 0.8), hurt: () => hurt(),
    core: () => { const t = ac.currentTime, o = out(0, 0.6, 0.4); tn(o, t, 0.25, 'sine', 880, 0, 0.25); tn(o, t + 0.07, 0.35, 'sine', 1320, 0, 0.2); },
    coin: () => { const t = ac.currentTime, o = out(0, 0.35, 0.2); metal(o, t, 2400 * R(), 0.12, 0.06); },
    super: () => { const t = ac.currentTime, o = out(0, 1, 0.6); tn(o, t, 0.6, 'sawtooth', 90, 600, 0.25, 0.08); nz(o, t, 0.7, 'bandpass', 300, 3000, 1.5, 0.5, 0.1); tn(o, t + 0.5, 0.6, 'sine', 70, 30, 1.0); },
    dash: () => { const t = ac.currentTime, o = out(0, 0.6, 0.2); nz(o, t, 0.22, 'bandpass', 600, 2400, 1.2, 0.45, 0.03); },
    boom: () => boom(0, 1), portal: () => { const t = ac.currentTime, o = out(0, 0.7, 0.7); tn(o, t, 1.2, 'sine', 120, 480, 0.4, 0.2); nz(o, t, 1.2, 'bandpass', 200, 2000, 3, 0.25, 0.3); },
    ach: () => { const t = ac.currentTime, o = out(0, 0.6, 0.5); [523, 659, 784, 1046].forEach((f, i) => tn(o, t + i * 0.09, 0.5, 'triangle', f, 0, 0.18)); },
    click: () => { const t = ac.currentTime, o = out(0, 0.35, 0); nz(o, t, 0.015, 'highpass', 3000, 0, 0.7, 0.4); tn(o, t, 0.03, 'sine', 1800, 1200, 0.08); },
    open: () => { const t = ac.currentTime, o = out(0, 0.7, 0.4); metal(o, t, 420, 0.4, 0.1); nz(o, t, 0.35, 'lowpass', 1200, 300, 0.7, 0.4, 0.02); },
    laser: () => eshot(0, 0.25), boss: () => { const t = ac.currentTime, o = out(0, 1, 0.9); tn(o, t, 2.2, 'sawtooth', 55, 40, 0.35, 0.3); tn(o, t, 2.2, 'sine', 41, 30, 1.0, 0.2); nz(o, t, 2, 'lowpass', 400, 100, 0.7, 0.5, 0.4); },
    lose: () => { const t = ac.currentTime, o = out(0, 0.8, 0.6); tn(o, t, 1.6, 'sawtooth', 300, 40, 0.25, 0.02); nz(o, t, 1.4, 'lowpass', 1200, 80, 0.7, 0.4); }
  };
  function play(n) {
    if (!ac) return; const now = performance.now(); if (last[n] && now - last[n] < 40) return; last[n] = now;
    if (lib[n]) try { lib[n](); } catch (e) { }
  }
  // позиционные звуки из очереди эффектов движка
  function fx(o, G) {
    if (!ac || !G || !G.p) return; const p = G.p, yaw = G.yaw || -Math.PI / 2;
    const sp = (x, y) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - yaw; return { pan: Math.sin(a) * Math.min(1, d / 120), g: 1 / (1 + Math.max(0, d - 60) / 260) }; };
    const now = performance.now(), lim = (k, ms) => { if (last['fx' + k] && now - last['fx' + k] < ms) return true; last['fx' + k] = now; return false; };
    try {
      if (o.k === 'muzzle') { if (lim('m', 35)) return; shoot(gun[G.cs && G.cs.hero.id] || 'rifle', 0, 0.85); }
      else if (o.k === 'hit') { if (lim('h', 45)) return; const s = sp(o.x, o.y); hitMetal(s.pan, s.g * 0.8, o.big); }
      else if (o.k === 'wall') { if (lim('w', 60)) return; const s = sp(o.x, o.y); ricochet(s.pan, s.g * 0.6); }
      else if (o.k === 'boom') { if (lim('b', 80)) return; const s = sp(o.x, o.y); boom(s.pan, Math.min(1.1, s.g * 1.2), (o.r || 0) > 120); }
      else if (o.k === 'die') { if (lim('d', 60)) return; const s = sp(o.x, o.y); robotDie(s.pan, s.g); }
    } catch (e) { }
  }
  function enemyShot(x, y, G) { if (!ac || !G) return; const now = performance.now(); if (last.es && now - last.es < 70) return; last.es = now; const p = G.p, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - (G.yaw || -Math.PI / 2); try { eshot(Math.sin(a) * Math.min(1, d / 120), 0.5 / (1 + Math.max(0, d - 60) / 240)); } catch (e) { } }
  // шаги
  let stepT = 0; function steps(G, dt, moving, metalFloor) { if (!ac || !moving || G.state !== 'play') { stepT = 0.12; return; } stepT -= dt; if (stepT <= 0) { stepT = (G.p.boostT > 0 ? 0.24 : 0.32); stepS(metalFloor); } }
  // фон: вентиляция, гул, далёкий лязг
  let ambN = null, ambF = null, clankT = 6;
  function startAmb() {
    if (ambOn) return; ambOn = true;
    const s = ac.createBufferSource(); s.buffer = brownBuf; s.loop = true; ambF = ac.createBiquadFilter(); ambF.type = 'lowpass'; ambF.frequency.value = 380; const g = ac.createGain(); g.gain.value = 0.35; s.connect(ambF); ambF.connect(g); g.connect(ambG); s.start(); ambN = g;
    const h = ac.createOscillator(), hg = ac.createGain(); h.type = 'sine'; h.frequency.value = 50; hg.gain.value = 0.025; h.connect(hg); hg.connect(ambG); h.start();
    const h2 = ac.createOscillator(), hg2 = ac.createGain(); h2.type = 'sine'; h2.frequency.value = 100.6; hg2.gain.value = 0.012; h2.connect(hg2); hg2.connect(ambG); h2.start();
    setInterval(() => { if (!ac || P.s.settings.sfx <= 0) return; clankT -= 1; if (clankT <= 0) { clankT = 5 + Math.random() * 9; const t = ac.currentTime, o = out((Math.random() - 0.5) * 1.6, 0.12, 0.9); if (Math.random() < 0.5) metal(o, t, 180 + Math.random() * 300, 0.9, 0.08); else nz(o, t, 0.6, 'bandpass', 300 + Math.random() * 600, 0, 2, 0.3, 0.05); } }, 1000);
  }
  // музыка: тёмный эмбиент-синт вместо чиптюна
  const scales = { menu: [0, 3, 7, 10, 12, 15], game: [0, 3, 5, 7, 10, 12], boss: [0, 1, 5, 6, 10, 12] };
  function pad(f, dur, g) { const t = ac.currentTime, f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(400, t); f2.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f2.frequency.linearRampToValueAtTime(400, t + dur); const gg = ac.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + dur * 0.35); gg.gain.linearRampToValueAtTime(0.0001, t + dur); f2.connect(gg); gg.connect(musG); const s = ac.createGain(); s.gain.value = 0.4; gg.connect(s); s.connect(rev); for (const dt of [-6, 0, 7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(f2); o.start(t); o.stop(t + dur + 0.1); } }
  function startMusic() {
    if (musTimer) clearInterval(musTimer);
    musTimer = setInterval(() => {
      if (!ac || P.s.settings.music <= 0) return;
      const sc = scales[musMode], root = musMode === 'boss' ? 49 : musMode === 'game' ? 55 : 41.2, b = step % 32;
      if (b % 16 === 0) { const n = sc[(step / 16 | 0) % sc.length]; pad(root * 2 * Math.pow(2, n / 12), 4.6, 0.05); pad(root * 3 * Math.pow(2, n / 12), 4.6, 0.025); }
      if (musMode !== 'menu') { const t = ac.currentTime; if (b % 8 === 0) { tn(musG, t, 0.3, 'sine', 85, 38, 0.5); } if (b % 8 === 4) nz(musG, t, 0.12, 'bandpass', 1800, 0, 0.8, 0.12); if (musMode === 'boss' && b % 2 === 0) tn(musG, t, 0.14, 'sawtooth', root * (b % 16 < 8 ? 1 : 1.19), 0, 0.06); else if (b % 4 === 2) nz(musG, t, 0.03, 'highpass', 7000, 0, 0.7, 0.06); }
      step++;
    }, 150);
  }
  function mode(m) { musMode = m; if (ambF) ambF.frequency.value = m === 'menu' ? 260 : 380; }
  function vib(ms) { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; if (P.s.settings.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }
  return { init, play, vol, mode, vib, fx, enemyShot, steps };
})();
