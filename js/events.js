'use strict';
/* ===== Динамические события посреди сектора ===== */
const DynEv = {
  L: {
    blackout: { n: 'ОТКЛЮЧЕНИЕ СВЕТА', d: 'Видно только рядом с вами', col: '#8888aa', dur: 15 },
    lockdown: { n: 'АВАРИЙНАЯ БЛОКИРОВКА', d: 'Вас заперли — отбейте волну', col: '#ff3d55', dur: 14 },
    elite: { n: 'ЭЛИТНАЯ УГРОЗА', d: 'Рядом появилась элитная цель', col: '#ffd23d', dur: 1 },
    invasion: { n: 'ВТОРЖЕНИЕ', d: 'Три волны врагов!', col: '#ff3d7f', dur: 16 },
    merchant: { n: 'СЕКРЕТНЫЙ ТОРГОВЕЦ', d: 'Торговец рядом — ненадолго', col: '#b44dff', dur: 30 },
    passage: { n: 'СКРЫТЫЙ ПРОХОД', d: 'Трещины рассыпались — ищите секреты', col: '#ffd700', dur: 1 },
    reactor: { n: 'ПЕРЕГРУЗКА РЕАКТОРА', d: 'Удары энергии по всей зоне!', col: '#ff8a00', dur: 12 },
    chest: { n: 'РЕДКИЙ СУНДУК', d: 'Золотой сундук исчезнет через 30 с', col: '#ffb020', dur: 30 },
    signal: { n: 'НЕИЗВЕСТНЫЙ СИГНАЛ', d: 'Проверьте источник… если осмелитесь', col: '#3dffb0', dur: 40 },
    gravity: { n: 'СБОЙ ГРАВИТАЦИИ', d: 'Всё тянет к сингулярности', col: '#6aa8ff', dur: 12 },
    anomaly: { n: 'АНОМАЛЬНАЯ ЗОНА', d: 'Внутри зоны: урон ×2, враги замедлены', col: '#ff3dc8', dur: 18 },
    storm: { n: 'ЭНЕРГЕТИЧЕСКИЙ ШТОРМ', d: 'Молнии бьют с неба, иногда оставляя ядра', col: '#3da5ff', dur: 18 },
    datarain: { n: 'ДОЖДЬ ДАННЫХ', d: 'Падают блоки — в них монеты', col: '#00f0ff', dur: 12 },
    glitch: { n: 'ЗОЛОТОЙ ГЛЮК', d: 'Поймайте его, пока не сбежал!', col: '#ffd700', dur: 1 },
    frenzy: { n: 'ОВЕРКЛОК ВРАГОВ', d: 'Враги быстрее, но монеты ×2', col: '#ff9a1a', dur: 15 }
  },
  reset(G) { G.dyn = null; G.dynT = (G.diff < 2 ? 70 : 40) + Math.random() * 25; },
  free(G, cx, cy, rmin, rmax) { for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, d = rmin + Math.random() * (rmax - rmin), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (G.tileAt(x, y) === 0) return { x, y }; } return null; },
  start(G, id) {
    const E = this.L[id], p = G.p, ev = G.dyn = { id, t: 0, dur: E.dur, n: E.n, col: E.col };
    G.banner(E.n, E.col, 'СОБЫТИЕ', E.d); SFX.play('boss'); G.shake(5); G.stat('events'); G.stat('dyn_' + id);
    switch (id) {
      case 'lockdown': ev.x = p.x; ev.y = p.y; ev.r = 260; G.waveSpawn(p.x, p.y, 4 + Math.floor(G.diff / 3)); break;
      case 'elite': { const q = this.free(G, p.x, p.y, 300, 500); if (q) { const ty = ['guard', 'tank', 'hunter', 'shielder', 'sniper'][Math.floor(Math.random() * 5)], e = Enemies.make(G, ty, q.x, q.y, G.diff, true); G.enemies.push(e); G.burst(q.x, q.y, '#ffd23d', 40, 300); } break; }
      case 'invasion': ev.w = 0; break;
      case 'merchant': { const q = this.free(G, p.x, p.y, 120, 220); if (q) G.merchant = { x: q.x, y: q.y, used: false, tmp: true }; break; }
      case 'passage': { const lv = G.lv; let n = 0; for (let i = 0; i < lv.t.length; i++) if (lv.t[i] === 2) { const x = i % lv.W, y = (i / lv.W) | 0; if (Math.hypot((x + 0.5) * TS - p.x, (y + 0.5) * TS - p.y) < 1400) { G.breakWall(x, y); n++; } } G.floatText(p.x, p.y - 40, 'Открыто проходов: ' + n, '#ffd700', 1.3); break; }
      case 'chest': { const q = this.free(G, p.x, p.y, 350, 700); if (q) { ev.ch = { x: q.x, y: q.y, big: true, open: false, gold: true }; G.chests.push(ev.ch); } break; }
      case 'signal': { const q = this.free(G, p.x, p.y, 600, 1100) || this.free(G, p.x, p.y, 300, 600); if (q) { ev.x = q.x; ev.y = q.y; } else ev.t = ev.dur; break; }
      case 'gravity': { const q = this.free(G, p.x, p.y, 150, 260); ev.x = q ? q.x : p.x + 200; ev.y = q ? q.y : p.y; break; }
      case 'anomaly': { const q = this.free(G, p.x, p.y, 60, 180); ev.x = q ? q.x : p.x; ev.y = q ? q.y : p.y; ev.r = 150; break; }
      case 'storm': G.ev.storm = true; break;
      case 'glitch': { const q = this.free(G, p.x, p.y, 200, 350); if (q) { const g = G.spawnEnemy('glitch', q.x, q.y); g.aggro = true; } break; }
      case 'frenzy': G.ev.gold = true; G.mods.fast = true; break;
    }
  },
  end(G) {
    const ev = G.dyn; if (!ev) return;
    if (ev.id === 'storm') G.ev.storm = false; if (ev.id === 'frenzy') { G.ev.gold = false; G.mods.fast = false; }
    if (ev.id === 'merchant' && G.merchant && G.merchant.tmp) G.merchant = null;
    if (ev.id === 'chest' && ev.ch && !ev.ch.open) { G.chests = G.chests.filter(c => c !== ev.ch); G.floatText(G.p.x, G.p.y - 40, 'Сундук исчез…', '#888'); }
    if (ev.id === 'lockdown') { G.banner('БЛОКИРОВКА СНЯТА', '#3dffa0'); G.dropCoin(G.p.x, G.p.y, 3); G.dropCoin(G.p.x, G.p.y, 3); }
    G.dyn = null; G.dynT = 40 + Math.random() * 30;
  },
  tick(G, dt) {
    if (G.boss || G.intro || G.state !== 'play' || G.lv.arena) return;
    const p = G.p;
    if (!G.dyn) { G.dynT = (G.dynT === undefined ? 40 : G.dynT) - dt; if (G.dynT <= 0) { const ks = Object.keys(this.L); this.start(G, ks[Math.floor(Math.random() * ks.length)]); } return; }
    const ev = G.dyn; ev.t += dt;
    switch (ev.id) {
      case 'lockdown': { const dx = p.x - ev.x, dy = p.y - ev.y, d = Math.hypot(dx, dy); if (d > ev.r - p.r) { p.x = ev.x + dx / d * (ev.r - p.r); p.y = ev.y + dy / d * (ev.r - p.r); } break; }
      case 'invasion': if (ev.t > ev.w * 5 && ev.w < 3) { ev.w++; G.waveSpawn(p.x, p.y, 3 + ev.w + Math.floor(G.diff / 4)); G.floatText(p.x, p.y - 50, 'ВОЛНА ' + ev.w + '/3', '#ff3d7f', 1.4); } break;
      case 'reactor': ev.k = (ev.k || 0) - dt; if (ev.k <= 0) { ev.k = 0.45; const q = this.free(G, p.x, p.y, 0, 380); if (q) G.tele.push({ k: 'circle', x: q.x, y: q.y, r: 70, t: 0, dur: 1.1, dmg: 16 + G.diff, col: '#ff8a00' }); } break;
      case 'signal': if (ev.x && Math.hypot(ev.x - p.x, ev.y - p.y) < 50) { if (Math.random() < 0.55) { Relic.drop(G, ev.x, ev.y); G.banner('СИГНАЛ: ТАЙНИК', '#3dffb0', 'Реликвия найдена'); } else { G.waveSpawn(ev.x, ev.y, 6); Relic.dropPow(G, ev.x, ev.y); G.banner('СИГНАЛ: ЛОВУШКА', '#ff3d55', 'Засада!'); } ev.t = ev.dur; } break;
      case 'gravity': { const pull = (o, k) => { const dx = ev.x - o.x, dy = ev.y - o.y, d = Math.hypot(dx, dy); if (d < 520 && d > 12) { o.x += dx / d * k * dt; o.y += dy / d * k * dt; } }; pull(p, 120); G.enemies.forEach(e => pull(e, 170)); G.pick.forEach(k => pull(k, 260)); ev.x += Math.cos(ev.t * 0.8) * 40 * dt; ev.y += Math.sin(ev.t * 0.6) * 40 * dt; if (Math.hypot(p.x - ev.x, p.y - ev.y) < 28 && G.frame % 15 === 0) G.hurtPlayer(8, null); for (const e of G.enemies) if (Math.hypot(e.x - ev.x, e.y - ev.y) < 30 && G.frame % 10 === 0) G.hurtEnemy(e, 25, { noFx: true }); break; }
      case 'anomaly': G.inAnom = Math.hypot(p.x - ev.x, p.y - ev.y) < ev.r; for (const e of G.enemies) if (Math.hypot(e.x - ev.x, e.y - ev.y) < ev.r) e.fz = Math.max(e.fz, 0.05); break;
      case 'datarain': ev.k = (ev.k || 0) - dt; if (ev.k <= 0) { ev.k = 0.3; const q = this.free(G, p.x, p.y, 0, 320); if (q) { G.tele.push({ k: 'circle', x: q.x, y: q.y, r: 34, t: 0, dur: 0.9, dmg: 10, col: '#00f0ff' }); setTimeout(() => { if (G.dyn === ev) G.dropCoin(q.x, q.y, 1); }, 900); } } break;
    }
    if (ev.id !== 'anomaly') G.inAnom = false;
    if (ev.t >= ev.dur) { G.inAnom = false; this.end(G); }
  },
  hud(G, c, W, H, T) {
    const ev = G.dyn; if (!ev) return;
    if (ev.id === 'blackout') { const pq = G.proj(G.p.x, G.p.y), g = c.createRadialGradient(pq.x, pq.y, 60, pq.x, pq.y, Math.min(W, H) * 0.42); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,4,0.94)'); c.fillStyle = g; c.fillRect(0, 0, W, H); if (Math.random() < 0.02) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, W, H); } }
    if (ev.dur > 1) {
      const w = Math.min(260, W * 0.6), x = W / 2 - w / 2, y = G.touch || W < 560 ? Math.round(Math.max(H * 0.27, 215)) : H - 62, f = 1 - ev.t / ev.dur;
      c.fillStyle = 'rgba(5,5,15,0.8)'; G.rr(c, x, y, w, 30, 8); c.fill(); c.strokeStyle = ev.col; c.globalAlpha = 0.6 + Math.sin(T * 6) * 0.3; c.lineWidth = 1.5; G.rr(c, x, y, w, 30, 8); c.stroke(); c.globalAlpha = 1;
      c.textAlign = 'center'; c.font = 'bold 9px Unbounded,sans-serif'; c.fillStyle = ev.col; c.fillText('⚠ ' + ev.n + '  ' + Math.ceil(ev.dur - ev.t) + ' с', W / 2, y + 12);
      c.fillStyle = '#1a1a2a'; c.fillRect(x + 8, y + 21, w - 16, 3); c.fillStyle = ev.col; c.fillRect(x + 8, y + 21, (w - 16) * f, 3);
    }
    if (G.inAnom) { c.fillStyle = 'rgba(255,61,200,0.07)'; c.fillRect(0, 0, W, H); }
    // стрелка к сигналу/сундуку
    const tg = ev.id === 'signal' && ev.x ? ev : ev.id === 'chest' && ev.ch && !ev.ch.open ? ev.ch : null;
    if (tg) { const pq = G.proj(tg.x, tg.y); if (pq.x < 20 || pq.y < 20 || pq.x > W - 20 || pq.y > H - 20) { const a = Math.atan2(pq.y - H / 2, pq.x - W / 2), t = Math.min(Math.abs((W / 2 - 60) / Math.cos(a)), Math.abs((H / 2 - 80) / Math.sin(a))); c.save(); c.translate(W / 2 + Math.cos(a) * t, H / 2 + Math.sin(a) * t); c.rotate(a); c.fillStyle = ev.col; c.globalAlpha = 0.7 + Math.sin(T * 8) * 0.3; c.beginPath(); c.moveTo(12, 0); c.lineTo(-7, -9); c.lineTo(-7, 9); c.fill(); c.restore(); } }
  },
  r3(G, R, T) {
    const ev = G.dyn; if (!ev) return;
    if (ev.id === 'lockdown') { const x = ev.x / TS, z = ev.y / TS, r = ev.r / TS; R.ring(x, z, r, '#ff3d55', 0.8 + Math.sin(T * 10) * 0.15, 0.05); R.ring(x, z, r, '#ff3d55', 0.4, 0.9); for (let i = 0; i < 8; i++) { const a = T * 0.5 + i / 8 * 6.28; R.box(x + Math.cos(a) * r, 0.6, z + Math.sin(a) * r, 0.12, 1.2, 0.12, '#ff3d55', 0.7); } }
    if (ev.id === 'signal' && ev.x) { const x = ev.x / TS, z = ev.y / TS, ph = (T * 0.6) % 1; R.box(x, 2, z, 0.1, 4, 0.1, '#3dffb0', 0.3); R.ring(x, z, 0.3 + ph * 4, '#3dffb0', 0.5 * (1 - ph)); R.gp(x, 1, z, '#3dffb0', 1.5, 0.7); R.gp(x, 4, z, '#ffffff', 0.5, Math.floor(T * 3) % 2); }
    if (ev.id === 'gravity') { const x = ev.x / TS, z = ev.y / TS; R.gp(x, 0.6, z, '#000000', 2, 1); R.ring(x, z, 0.5, '#6aa8ff', 0.9, 0.3); for (let i = 0; i < 8; i++) { const a = T * 3 + i * 0.8, rr = 3 - ((T * 1.5 + i / 8) % 1) * 3; R.gp(x + Math.cos(a) * rr, 0.4, z + Math.sin(a) * rr, '#9cc4ff', 0.3, 0.8); } R.ring(x, z, 520 / TS, '#6aa8ff', 0.08 + Math.sin(T * 4) * 0.04, 0.03, true); }
    if (ev.id === 'anomaly') { const x = ev.x / TS, z = ev.y / TS, r = ev.r / TS; R.ring(x, z, r, '#ff3dc8', 0.18, 0.02, true); R.ring(x, z, r, '#ff3dc8', 0.8, 0.04); for (let i = 0; i < 4; i++) R.gp(x + (Math.random() - 0.5) * r * 1.6, Math.random() * 1.5, z + (Math.random() - 0.5) * r * 1.6, Math.random() < 0.5 ? '#ff3dc8' : '#00f0ff', 0.3, 0.8); }
    if (ev.id === 'chest' && ev.ch && !ev.ch.open) { const x = ev.ch.x / TS, z = ev.ch.y / TS; R.box(x, 2, z, 0.25, 4, 0.25, '#ffb020', 0.3); R.gp(x, 0.6, z, '#ffd700', 2.5, 0.6); }
    if (ev.id === 'reactor') R.gp(G.p.x / TS, 3, G.p.y / TS, '#ff8a00', 4, 0.12);
    if (ev.id === 'datarain') for (let i = 0; i < 6; i++) { const ph = (T * 1.4 + i / 6) % 1; R.gp(G.p.x / TS + ((i * 3.7) % 10) - 5, 5 - ph * 5, G.p.y / TS + ((i * 5.3) % 8) - 4, '#00f0ff', 0.25, 1 - ph); }
  }
};
