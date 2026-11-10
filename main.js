'use strict';
/* ===== Точка входа ===== */
(function () {
  const L = SaveSys.load();
  P.init(L.s);
  G.init(document.getElementById('game'));
  UI.init();
  if (L.st === 'backup') UI.toast({ n: 'Сохранение восстановлено', d: 'Основной файл был повреждён — загружена резервная копия' });
  if (L.st === 'corrupt') UI.toast({ n: 'Сохранение повреждено', d: 'Начата новая игра' });
  P.checkAch();
  document.getElementById('pauseBtn').addEventListener('click', () => G.pause());
  document.addEventListener('change', e => {
    if (e.target.id !== 'impFile' || !e.target.files[0]) return;
    const r = new FileReader(); r.onload = () => UI.doImport(r.result); r.readAsText(e.target.files[0]);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.pause(); P.save(); } });
  addEventListener('beforeunload', () => P.save());
  setInterval(() => { if (G.state === 'off') P.save(); }, 15000);
  // Фоновые частицы меню
  const bg = document.getElementById('bg'), c = bg.getContext('2d'); let pts = [];
  const rs = () => { bg.width = innerWidth; bg.height = innerHeight; pts = Array.from({ length: Math.min(70, innerWidth / 12) }, () => ({ x: Math.random() * bg.width, y: Math.random() * bg.height, v: 0.2 + Math.random() * 0.6, s: Math.random() * 2 + 0.5, h: Math.random() < 0.5 ? 270 : 185 })); };
  rs(); addEventListener('resize', rs);
  (function loop() {
    requestAnimationFrame(loop); if (G.state !== 'off') return;
    const W = bg.width, H = bg.height, T = performance.now() / 1000, hz = H * 0.58;
    const cs = getComputedStyle(document.documentElement), a1 = cs.getPropertyValue('--a1').trim() || '#7b3dff', a2 = cs.getPropertyValue('--a2').trim() || '#00f0ff';
    const sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#03020a'); sky.addColorStop(1, '#12072a'); c.fillStyle = sky; c.fillRect(0, 0, W, hz);
    const fl = c.createLinearGradient(0, hz, 0, H); fl.addColorStop(0, '#0c0420'); fl.addColorStop(1, '#020106'); c.fillStyle = fl; c.fillRect(0, hz, W, H - hz);
    // солнце-ядро
    const sr = Math.min(W, H) * 0.2, sx = W / 2, sy = hz - sr * 0.35;
    const sg = c.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.4); sg.addColorStop(0, a1 + '66'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, hz);
    c.save(); c.beginPath(); c.rect(0, 0, W, hz); c.clip();
    const sun = c.createLinearGradient(0, sy - sr, 0, sy + sr); sun.addColorStop(0, a2); sun.addColorStop(1, a1); c.fillStyle = sun; c.globalAlpha = 0.55;
    c.beginPath(); c.arc(sx, sy, sr, 0, 6.28); c.fill(); c.globalAlpha = 1; c.fillStyle = '#0c0420';
    for (let i = 0; i < 7; i++) { const y = sy + sr * 0.05 + i * sr * 0.14; c.fillRect(sx - sr, y, sr * 2, 2 + i * 1.6); }
    c.restore();
    // перспективная сетка
    c.strokeStyle = a1; c.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { c.globalAlpha = 0.35; c.beginPath(); c.moveTo(W / 2 + i * W * 0.012, hz); c.lineTo(W / 2 + i * W * 0.16, H); c.stroke(); }
    for (let i = 0; i < 16; i++) { const f = ((i + (T * 0.35) % 1) / 16), y = hz + (H - hz) * f * f; c.globalAlpha = 0.15 + f * 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.globalAlpha = 1; c.strokeStyle = a2; c.lineWidth = 2; c.shadowColor = a2; c.shadowBlur = 14; c.beginPath(); c.moveTo(0, hz); c.lineTo(W, hz); c.stroke(); c.shadowBlur = 0;
    for (const p of pts) { p.y -= p.v; if (p.y < -5) { p.y = hz + 5; p.x = Math.random() * W; } if (p.y > hz) p.y = hz; c.fillStyle = 'hsla(' + p.h + ',100%,70%,' + (0.2 + p.s / 6) + ')'; c.fillRect(p.x, p.y, p.s, p.s * 2.5); }
  })();
  // Отключаем двойной тап-зум на iOS
  let lt = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lt < 300 && !e.target.closest('input,textarea')) e.preventDefault(); lt = n; }, { passive: false });
})();
