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
    c.clearRect(0, 0, bg.width, bg.height);
    for (const p of pts) { p.y -= p.v; if (p.y < -5) { p.y = bg.height + 5; p.x = Math.random() * bg.width; } c.fillStyle = 'hsla(' + p.h + ',100%,65%,' + (0.25 + p.s / 5) + ')'; c.fillRect(p.x, p.y, p.s, p.s * 3); }
  })();
  // Отключаем двойной тап-зум на iOS
  let lt = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lt < 300 && !e.target.closest('input,textarea')) e.preventDefault(); lt = n; }, { passive: false });
})();
