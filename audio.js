'use strict';
/* ===== Синтезированный звук и музыка (WebAudio, без файлов) ===== */
const SFX = (() => {
  let ac = null, master, sfxG, musG, musTimer = null, step = 0, musMode = 'menu', last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination);
      sfxG = ac.createGain(); sfxG.connect(master); musG = ac.createGain(); musG.connect(master);
      vol(); startMusic();
    } catch (e) { ac = null; }
  }
  function vol() { if (!ac) return; const st = P.s.settings; sfxG.gain.value = st.sfx; musG.gain.value = st.music * 0.5; }
  function tone(f, d, type = 'square', v = 0.15, slide = 0, dest) {
    if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, v = 0.2, f = 1200) {
    if (!ac) return; const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    fl.type = 'lowpass'; fl.frequency.value = f; s.buffer = b; g.gain.value = v;
    s.connect(fl); fl.connect(g); g.connect(sfxG); s.start(t);
  }
  const lib = {
    shoot: () => tone(880, 0.07, 'square', 0.06, -500),
    hit: () => tone(220, 0.06, 'sawtooth', 0.07, -120),
    kill: () => { tone(500, 0.12, 'triangle', 0.12, -380); noise(0.12, 0.08, 2000); },
    hurt: () => { tone(140, 0.2, 'sawtooth', 0.18, -80); noise(0.15, 0.12, 800); },
    core: () => { tone(660, 0.08, 'sine', 0.14); setTimeout(() => tone(990, 0.12, 'sine', 0.12), 60); },
    coin: () => tone(1400, 0.05, 'square', 0.05, 300),
    super: () => { tone(200, 0.5, 'sawtooth', 0.15, 900); noise(0.4, 0.12, 3000); },
    dash: () => tone(300, 0.15, 'sine', 0.12, 600),
    boom: () => noise(0.35, 0.25, 600),
    portal: () => { [0, 1, 2, 3].forEach(i => setTimeout(() => tone(400 + i * 200, 0.15, 'triangle', 0.12), i * 70)); },
    ach: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.13), i * 90)); },
    click: () => tone(1200, 0.03, 'square', 0.04),
    open: () => { tone(300, 0.3, 'triangle', 0.12, 800); },
    laser: () => tone(1800, 0.05, 'sawtooth', 0.03, -900),
    boss: () => { tone(80, 1.2, 'sawtooth', 0.25, -40); noise(1, 0.15, 400); },
    lose: () => { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.12), i * 150)); }
  };
  function play(n) {
    if (!ac) return; const now = performance.now(); if (last[n] && now - last[n] < 40) return; last[n] = now;
    if (lib[n]) lib[n]();
  }
  // Генеративная музыка: бас + арпеджио
  const scales = { menu: [0, 3, 7, 10, 12, 15], game: [0, 3, 5, 7, 10, 12], boss: [0, 1, 5, 6, 10, 12] };
  function startMusic() {
    if (musTimer) clearInterval(musTimer);
    musTimer = setInterval(() => {
      if (!ac || P.s.settings.music <= 0) return;
      const sc = scales[musMode], root = musMode === 'boss' ? 98 : musMode === 'game' ? 110 : 82.4;
      const bpm16 = step % 16;
      if (bpm16 % 4 === 0) tone(root * (bpm16 === 8 ? 1.335 : 1) / 2, 0.35, 'triangle', 0.22, 0, musG);
      if (musMode !== 'menu' && bpm16 % 4 === 2) noiseHat();
      const n = sc[(step * 7 + Math.floor(step / 8)) % sc.length];
      if (step % 2 === 0 || musMode === 'boss') tone(root * 2 * Math.pow(2, n / 12), 0.16, 'square', 0.035, 0, musG);
      step++;
    }, 140);
  }
  function noiseHat() {
    const t = ac.currentTime, b = ac.createBuffer(1, 2000, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = 0.05; s.buffer = b; s.connect(f); f.connect(g); g.connect(musG); s.start(t);
  }
  function mode(m) { musMode = m; }
  function vib(ms) { if (P.s.settings.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }
  return { init, play, vol, mode, vib };
})();
