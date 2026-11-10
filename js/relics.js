'use strict';
/* ===== Реликвии забега, синергии и временные бонусы ===== */
D.RRAR = { c: ['Обычная', '#b8c4d8'], r: ['Редкая', '#3da5ff'], e: ['Эпическая', '#b44dff'], l: ['Легендарная', '#ffb020'] };
D.RELICS = [
  { id: 'chaos', n: 'Реликвия хаоса', ic: '✷', r: 'e', d: 'Каждое убийство вызывает случайный эффект' },
  { id: 'heart', n: 'Энергетическое сердце', ic: '♥', r: 'c', d: '+35 к максимальному здоровью' },
  { id: 'qmag', n: 'Квантовый магнит', ic: '⊛', r: 'c', d: 'Радиус притяжения ×2.5' },
  { id: 'reactor', n: 'Нестабильный реактор', ic: '☢', r: 'r', d: 'Урон +40%, но входящий урон +20%' },
  { id: 'phase', n: 'Фазовое ядро', ic: '◐', r: 'r', d: 'Рывок перезаряжается на 40% быстрее' },
  { id: 'fang', n: 'Клык вампира', ic: '⟆', r: 'c', d: 'Убийство лечит 3 HP' },
  { id: 'coil', n: 'Тесла-катушка', ic: 'ϟ', r: 'r', d: 'Попадания бьют цепной молнией' },
  { id: 'frost', n: 'Криоядро', ic: '❄', r: 'r', d: 'Попадания иногда замораживают' },
  { id: 'ember', n: 'Тлеющий уголь', ic: '♨', r: 'c', d: 'Попадания поджигают врагов' },
  { id: 'bombh', n: 'Сердце детонатора', ic: '✺', r: 'e', d: 'Враги взрываются при смерти' },
  { id: 'mirror', n: 'Зеркальный щит', ic: '◇', r: 'r', d: 'Получив урон, выпускаете кольцо пуль' },
  { id: 'glass', n: 'Стеклянная пушка', ic: '⚠', r: 'e', d: 'Урон +65%, здоровье −30%' },
  { id: 'hglass', n: 'Песочные часы', ic: '⧗', r: 'r', d: 'При HP < 30% время замедляется (раз в 20 с)' },
  { id: 'lucky', n: 'Счастливая монета', ic: '¤', r: 'c', d: 'Монеты ×1.5' },
  { id: 'greed', n: 'Жадность', ic: '$', r: 'c', d: 'Из сундуков в 2 раза больше монет' },
  { id: 'adren', n: 'Адреналин', ic: '➹', r: 'c', d: 'Убийство даёт ускорение на 1.5 с' },
  { id: 'overch', n: 'Перегрузчик', ic: '⚡', r: 'r', d: 'Супер заряжается на 45% быстрее' },
  { id: 'echo', n: 'Эхо-модуль', ic: '⫸', r: 'e', d: '20% шанс выстрелить дважды' },
  { id: 'shgen', n: 'Генератор щита', ic: '⬡', r: 'r', d: 'Щит восстанавливается, если вас не били 3 с' },
  { id: 'thorn', n: 'Шипастая броня', ic: '✹', r: 'c', d: 'Враги получают урон при ударе по вам' },
  { id: 'scope', n: 'Оптический прицел', ic: '⊕', r: 'c', d: 'Дальность +30%, крит +10%' },
  { id: 'bers', n: 'Берсерк', ic: '☠', r: 'e', d: 'Чем меньше здоровья, тем больше урон (до +80%)' },
  { id: 'cchip', n: 'Комбо-чип', ic: '×', r: 'r', d: 'Комбо держится дольше, +1% урона за каждый удар серии' },
  { id: 'buddy', n: 'Дрон-напарник', ic: '✈', r: 'e', d: 'Дрон летает рядом и стреляет по врагам' },
  { id: 'ghost', n: 'Призрачный плащ', ic: '◌', r: 'r', d: 'После рывка 1 с неуязвимости' },
  { id: 'nova', n: 'Ядро новы', ic: '✦', r: 'e', d: 'Получив урон, взрываетесь (раз в 3 с)' },
  { id: 'grav', n: 'Гравитон', ic: '◎', r: 'r', d: 'Враги рядом с вами замедлены' },
  { id: 'recyc', n: 'Переработчик', ic: '♻', r: 'c', d: '25% шанс вернуть заряд при попадании' },
  { id: 'lens', n: 'Крит-линза', ic: '◉', r: 'r', d: 'Критический урон +70%' },
  { id: 'phoenix', n: 'Перо феникса', ic: '♆', r: 'l', d: 'Один раз за забег воскрешает с 50% HP' },
  { id: 'static', n: 'Статическое поле', ic: '⌁', r: 'r', d: 'Каждые 1.2 с бьёт током ближайшего врага' },
  { id: 'midas', n: 'Рука Мидаса', ic: '♛', r: 'l', d: 'Убийства дают монеты, элита — реликвию' },
  { id: 'pierce', n: 'Бронебойный сердечник', ic: '➶', r: 'r', d: 'Снаряды пробивают +1 врага' },
  { id: 'split', n: 'Расщепитель', ic: '⋔', r: 'e', d: '+1 снаряд в каждом выстреле' }
];
D.RELM = {}; D.RELICS.forEach(r => D.RELM[r.id] = r);
D.SYN = [
  { a: 'frost', b: 'coil', n: 'Сверхпроводник', d: 'Цепная молния замораживает' },
  { a: 'ember', b: 'bombh', n: 'Напалм', d: 'Взрывы поджигают всё вокруг' },
  { a: 'reactor', b: 'glass', n: 'Критическая масса', d: 'Ещё +30% урона' },
  { a: 'fang', b: 'bers', n: 'Кровавая ярость', d: 'Убийство лечит 8 HP' },
  { a: 'buddy', b: 'static', n: 'Рой', d: 'Дрон стреляет вдвое чаще' },
  { a: 'qmag', b: 'lucky', n: 'Золотая лихорадка', d: 'Монеты ×2.5' },
  { a: 'phase', b: 'ghost', n: 'Фазовый сдвиг', d: 'Рывок почти без перезарядки' },
  { a: 'chaos', b: 'echo', n: 'Энтропия', d: 'Хаос срабатывает дважды' },
  { a: 'mirror', b: 'nova', n: 'Сверхновая', d: 'Взрыв при уроне вдвое сильнее и больше' },
  { a: 'scope', b: 'lens', n: 'Снайперская оптика', d: 'Крит +15% дополнительно' }
];
D.POWS = {
  zap: { n: 'Электроразряд', ic: 'ϟ', col: '#9ff', d: 8 }, drone: { n: 'Дрон-помощник', ic: '✈', col: '#00f0ff', d: 12 },
  haste: { n: 'Ускорение', ic: '➹', col: '#3dffa0', d: 7 }, shield: { n: 'Щит', ic: '⬡', col: '#78c8ff', d: 6 },
  rapid: { n: 'Скорострельность', ic: '⫸', col: '#ffd23d', d: 8 }, magnet: { n: 'Магнит', ic: '⊛', col: '#ffb020', d: 10 },
  heal: { n: 'Ремонт', ic: '✚', col: '#3dffa0', d: 1 }, slow: { n: 'Стазис', ic: '⧗', col: '#b44dff', d: 5 },
  gold: { n: 'Золотая лихорадка', ic: '¤', col: '#ffd23d', d: 12 }, inv: { n: 'Неуязвимость', ic: '✦', col: '#ffffff', d: 4 }
};
const Relic = {
  pcol(k) { return k.k === 'relic' ? D.RRAR[D.RELM[k.id].r][1] : D.POWS[k.id].col; },
  has(G, id) { return G.run && G.run.rel && G.run.rel.has(id); },
  syn(G, n) { return G.run && G.run.syn && G.run.syn.has(n); },
  roll(G) {
    const own = G.run.rel, pool = D.RELICS.filter(r => !own.has(r.id)); if (!pool.length) return null;
    const w = r => ({ c: 10, r: 6, e: 3, l: 1 }[r.r]) * (r.r !== 'c' ? 1 + G.cs.luck : 1);
    let x = Math.random() * pool.reduce((a, r) => a + w(r), 0); for (const r of pool) { x -= w(r); if (x <= 0) return r.id; } return pool[0].id;
  },
  drop(G, x, y) { const id = this.roll(G); if (id) G.pick.push({ k: 'relic', id, x, y, t: 0 }); },
  dropPow(G, x, y) { const ks = Object.keys(D.POWS); G.pick.push({ k: 'pow', id: ks[Math.floor(Math.random() * ks.length)], x, y, t: 0 }); },
  gain(G, id) {
    const R = G.run, cs = G.cs, p = G.p, rr = D.RELM[id]; if (!rr || R.rel.has(id)) return; R.rel.add(id); G.stat('relics');
    const fx = cs.fx;
    switch (id) {
      case 'heart': p.maxHp += 35; p.hp += 35; break;
      case 'qmag': cs.magnet *= 2.5; break;
      case 'phase': cs.dashcd *= 0.6; break;
      case 'coil': fx.add('chain'); break; case 'frost': fx.add('freeze'); break; case 'ember': fx.add('burn'); break;
      case 'bombh': fx.add('boom'); break; case 'thorn': fx.add('thorns'); break; case 'phoenix': fx.add('revive'); break;
      case 'pierce': fx.add('pierce'); break; case 'split': fx.add('multi'); break; case 'ghost': fx.add('ghost'); break;
      case 'glass': p.maxHp = Math.max(1, Math.round(p.maxHp * 0.7)); p.hp = Math.min(p.hp, p.maxHp); break;
      case 'scope': cs.range *= 1.3; cs.crit += 0.1; break;
      case 'lens': cs.critd += 0.7; break;
      case 'overch': cs.sup *= 1.45; break;
      case 'cchip': cs.combo += 2; break;
    }
    G.relCard = { id, t: 0 };
    SFX.play('ach'); SFX.vib([20, 30, 20]); G.burst(p.x, p.y, D.RRAR[rr.r][1], 50, 380);
    for (const s of D.SYN) if (!R.syn.has(s.n) && R.rel.has(s.a) && R.rel.has(s.b)) {
      R.syn.add(s.n); G.stat('synergies');
      if (s.n === 'Фазовый сдвиг') cs.dashcd *= 0.4; if (s.n === 'Снайперская оптика') cs.crit += 0.15;
      setTimeout(() => { G.banner('СИНЕРГИЯ: ' + s.n.toUpperCase(), '#ff3dc8', D.RELM[s.a].n + ' + ' + D.RELM[s.b].n, s.d); G.shake(8); SFX.play('super'); G.burst(G.p.x, G.p.y, '#ff3dc8', 70, 450); }, 1800);
    }
  },
  pow(G, id) {
    const P0 = D.POWS[id], p = G.p; G.pows[id] = P0.d; G.stat('powerups');
    if (id === 'heal' && !G.rules.noHeal) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35); G.floatText(p.x, p.y - 30, '+35%', '#3dffa0', 1.3); }
    if (id === 'shield') p.shield += 50;
    if (id === 'haste') p.boostT = P0.d;
    if (id === 'slow') G.slowT = P0.d;
    if (id === 'magnet') { G.buff = G.buff || {}; G.buff.magnet = P0.d; }
    if (id === 'inv') p.inv = Math.max(p.inv, P0.d);
    G.floatText(p.x, p.y - 44, P0.ic + ' ' + P0.n, P0.col, 1.5); SFX.play('super'); G.burst(p.x, p.y, P0.col, 30, 300);
    G.vfx.push({ k: 'ring', x: p.x, y: p.y, r: 90, t: 0, d: 0.4, col: P0.col });
  },
  dmgMul(G) {
    if (!G.run || !G.run.rel) return 1; const p = G.p; let m = 1;
    if (this.has(G, 'reactor')) m *= 1.4; if (this.has(G, 'glass')) m *= 1.65; if (this.syn(G, 'Критическая масса')) m *= 1.3;
    if (this.has(G, 'bers')) m *= 1 + 0.8 * Math.max(0, 1 - p.hp / p.maxHp);
    if (this.has(G, 'cchip')) m *= 1 + Math.min(0.4, G.run.combo * 0.01);
    return m;
  },
  coinMul(G) { let m = 1; if (this.has(G, 'lucky')) m *= this.syn(G, 'Золотая лихорадка') ? 2.5 : 1.5; if (G.pows && G.pows.gold > 0) m *= 2; return m; },
  reloadMul(G) { return G.pows && G.pows.rapid > 0 ? 2.5 : 1; },
  onHurt(G, dmg) {
    const p = G.p; if (this.has(G, 'reactor')) dmg *= 1.2; G.lastHitT = G.run.time;
    if (this.has(G, 'mirror')) { const n = this.syn(G, 'Сверхновая') ? 20 : 12; for (let i = 0; i < n; i++) { const a = i / n * 6.28; G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, r: 5, dmg: G.cs.dmg * 0.8, life: 0.6, pierce: 1, bounce: 0, col: '#9fe8ff', hit: new Set() }); } }
    if (this.has(G, 'nova') && (G.novaCd || 0) < G.run.time) { G.novaCd = G.run.time + 3; const big = this.syn(G, 'Сверхновая'); G.explode(p.x, p.y, big ? 170 : 110, G.cs.dmg * (big ? 4 : 2.5), false); }
    if (this.has(G, 'hglass') && p.hp - dmg < p.maxHp * 0.3 && (G.hgCd || 0) < G.run.time) { G.hgCd = G.run.time + 20; G.slowT = 3; G.banner('ПЕСОЧНЫЕ ЧАСЫ', '#b44dff', 'Время замедлено'); }
    return dmg;
  },
  onKill(G, e) {
    const p = G.p, R = G.run;
    if (this.has(G, 'fang') && !G.rules.noHeal) p.hp = Math.min(p.maxHp, p.hp + (this.syn(G, 'Кровавая ярость') ? 8 : 3));
    if (this.has(G, 'adren')) p.boostT = Math.max(p.boostT || 0, 1.5);
    if (this.has(G, 'midas')) { G.dropCoin(e.x, e.y, 2); if (e.elite) this.drop(G, e.x + 30, e.y); }
    if (this.has(G, 'chaos')) for (let k = 0; k < (this.syn(G, 'Энтропия') ? 2 : 1); k++) {
      const r = Math.floor(Math.random() * 5);
      if (r === 0) G.explode(e.x, e.y, 90, G.cs.dmg * 2, false);
      else if (r === 1) { for (const o of G.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < 200) o.fz = 2.5; G.vfx.push({ k: 'ring', x: e.x, y: e.y, r: 200, t: 0, d: 0.4, col: '#9ff' }); }
      else if (r === 2) for (let i = 0; i < 3; i++) G.dropCoin(e.x, e.y, 2);
      else if (r === 3) { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; G.pb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 5, dmg: G.cs.dmg * 0.7, life: 0.6, pierce: 1, bounce: 0, col: '#ff3dc8', hit: new Set() }); } }
      else if (!G.rules.noHeal) p.hp = Math.min(p.maxHp, p.hp + 5);
    }
    if (this.syn(G, 'Напалм')) for (const o of G.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < 90) { o.burn = 3; o.burnDmg = G.cs.dmg * 0.25; }
    if (Math.random() < 0.035 + G.cs.luck * 0.02) this.dropPow(G, e.x, e.y);
  },
  onHit(G, e) {
    if (this.has(G, 'recyc') && Math.random() < 0.25 && G.p.ammo < G.cs.ammo) G.p.ammo = Math.min(G.cs.ammo, G.p.ammo + 1);
    if (this.syn(G, 'Сверхпроводник') && Math.random() < 0.2) e.fz = Math.max(e.fz, 1.2);
  },
  onFire(G, ang) { if (this.has(G, 'echo') && !G.echoing && Math.random() < 0.2) { G.echoing = true; G.p.ammo += 1; setTimeout(() => { if (G.state === 'play') G.fire(ang + 0.05); G.echoing = false; }, 90); } },
  tick(G, dt) {
    const p = G.p, R = G.run; if (!R.rel) return;
    for (const k in G.pows) G.pows[k] -= dt;
    const zap = (rng, dmg, col) => { let best = null, bd = rng * rng; for (const e of G.enemies) { if (e.dead) continue; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } } if (best) { G.vfx.push({ k: 'bolt', x1: p.x, y1: p.y, x2: best.x, y2: best.y, t: 0, d: 0.15, col }); G.hurtEnemy(best, dmg, { noFx: true }); SFX.play('laser'); } else if (G.boss && Math.hypot(G.boss.x - p.x, G.boss.y - p.y) < rng + G.boss.r) { G.vfx.push({ k: 'bolt', x1: p.x, y1: p.y, x2: G.boss.x, y2: G.boss.y, t: 0, d: 0.15, col }); G.hurtBoss(dmg); } };
    G.zapT = (G.zapT || 0) - dt; if (G.pows.zap > 0 && G.zapT <= 0) { G.zapT = 0.35; zap(170, G.cs.dmg * 0.6, '#9ff'); }
    G.stT = (G.stT || 0) - dt; if (this.has(G, 'static') && G.stT <= 0) { G.stT = 1.2; zap(240, G.cs.dmg * 0.9, '#00f0ff'); }
    const drone = this.has(G, 'buddy') || G.pows.drone > 0;
    if (drone) {
      const a = R.time * 2.2; G.dronePos = { x: p.x + Math.cos(a) * 44, y: p.y - 30 + Math.sin(a) * 18 };
      G.drT = (G.drT || 0) - dt; if (G.drT <= 0) { G.drT = this.syn(G, 'Рой') ? 0.25 : 0.5; const t = G.nearestEnemy(380); if (t) { const d = G.dronePos, ang = Math.atan2(t.y - d.y, t.x - d.x); G.pb.push({ x: d.x, y: d.y, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, r: 4, dmg: G.cs.dmg * 0.45, life: 0.7, pierce: 0, bounce: 0, col: '#00f0ff', hit: new Set() }); } }
    } else G.dronePos = null;
    if (this.has(G, 'shgen') && R.time - (G.lastHitT || 0) > 3 && p.shield < 40) p.shield = Math.min(40, p.shield + 8 * dt);
    if (this.has(G, 'grav')) for (const e of G.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 150) e.fz = Math.max(e.fz, 0.05);
  }
};
