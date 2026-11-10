'use strict';
/* ===== Game Engine + Player Controller ===== */
const PERKS = [
  { n: 'Перегрев ствола', d: '+15% урона', ic: '⚡', f: c => c.dmg *= 1.15 },
  { n: 'Нанопластины', d: '+25 к макс. здоровью и лечение', ic: '⛨', f: (c, G) => { c.maxHp += 25; G.p.maxHp += 25; G.p.hp = G.p.maxHp; } },
  { n: 'Сервоприводы', d: '+10% скорости', ic: '»', f: c => c.spd *= 1.1 },
  { n: 'Лишний заряд', d: '+1 заряд боезапаса', ic: '▤', f: c => c.ammo += 1 },
  { n: 'Охладитель', d: 'Перезарядка быстрее на 15%', ic: '❄', f: c => c.reload *= 0.85 },
  { n: 'Бронебойность', d: 'Снаряды пробивают врагов', ic: '↣', f: c => c.fx.add('pierce') },
  { n: 'Вампиризм', d: 'Урон лечит вас', ic: '♥', f: c => c.fx.add('lifesteal') },
  { n: 'Гравилинза', d: 'Магнит ×1.6', ic: '⊛', f: c => c.magnet *= 1.6 },
  { n: 'Точный расчёт', d: '+10% шанс крита', ic: '✧', f: c => c.crit += 0.1 },
  { n: 'Сверхзаряд', d: 'Супер копится на 30% быстрее', ic: '★', f: c => c.sup *= 1.3 },
  { n: 'Энергощит', d: '+40 щита в каждом секторе', ic: '⬡', f: c => c.shield += 40 },
  { n: 'Регенератор', d: '+1 здоровья в секунду', ic: '✚', f: c => c.regen += 1 },
  { n: 'Детонатор', d: 'Враги взрываются при смерти', ic: '✺', f: c => c.fx.add('boom') },
  { n: 'Цепная молния', d: 'Шанс молнии по врагам', ic: 'ϟ', f: c => c.fx.add('chain') }
];

const G = {
  cv: null, cx: null, W: 0, H: 0, dpr: 1, z: 1, cam: { x: 0, y: 0 }, state: 'off', frame: 0, touch: false,
  keys: {}, mouse: { x: 0, y: 0, down: false, wx: 0, wy: 0 }, touches: {}, ui: {},
  init(cv) {
    this.cv = cv; this.cx = cv.getContext('2d');
    this.resize(); addEventListener('resize', () => this.resize());
    this.bindInput();
    let last = performance.now(), fpsT = 0, fc = 0; this.fps = 60;
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      fc++; fpsT += dt; if (fpsT > 0.5) { this.fps = Math.round(fc / fpsT); fc = 0; fpsT = 0; }
      if (this.state === 'off') return;
      if (this.state === 'play') { try { this.update(dt); } catch (e) { console.error(e); } }
      this.render(dt);
    };
    requestAnimationFrame(loop);
  },
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1) * (P.s && P.s.settings.quality === 'low' ? 0.6 : 1);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.z = this.H > this.W ? Math.max(0.55, Math.min(1.1, this.W / (TS * 10.5))) : Math.max(0.6, Math.min(1.25, Math.sqrt(this.W * this.H) / (TS * 13.5)));
    const cs = P.s ? P.s.settings.ctrl : 1, m = Math.min(this.W, this.H) / 400 * cs;
    const k = Math.max(0.8, Math.min(1.3, m));
    this.btn = {
      atk: { x: this.W - 92 * k, y: this.H - 112 * k, r: 56 * k },
      sup: { x: this.W - 206 * k, y: this.H - 62 * k, r: 40 * k },
      dash: { x: this.W - 74 * k, y: this.H - 238 * k, r: 32 * k }
    };
  },

  /* ---------- Ввод ---------- */
  bindInput() {
    const cv = this.cv;
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (this.state !== 'play') return;
      if (e.code === 'Space' || e.code === 'KeyE') { this.doSuper(null); e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'KeyQ') this.dash();
      if (e.code === 'Escape' || e.code === 'KeyP') this.pause();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    cv.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    cv.addEventListener('mousedown', e => {
      if (this.touch) return; SFX.init();
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { const w = this.s2w(e.clientX, e.clientY); this.doSuper(Math.atan2(w.y - this.p.y, w.x - this.p.x)); }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const ts = (e) => {
      e.preventDefault(); this.touch = true; SFX.init();
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY, b = this.btn, inB = (o, k = 1.35) => Math.hypot(x - o.x, y - o.y) < o.r * k;
        let role = null;
        if (inB(b.atk)) role = 'atk'; else if (inB(b.sup, 1.25)) role = 'sup'; else if (inB(b.dash, 1.3)) { this.dash(); continue; }
        else if (x < this.W * 0.55) role = 'move'; else role = 'atk2';
        this.touches[t.identifier] = { role, ox: x, oy: y, x, y };
      }
    };
    const tm = (e) => { e.preventDefault(); for (const t of e.changedTouches) { const o = this.touches[t.identifier]; if (o) { o.x = t.clientX; o.y = t.clientY; } } };
    const te = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const o = this.touches[t.identifier]; delete this.touches[t.identifier]; if (!o || this.state !== 'play') continue;
        const dx = o.x - o.ox, dy = o.y - o.oy, drag = Math.hypot(dx, dy) > 18;
        if (o.role === 'atk' || o.role === 'atk2') this.fire(drag ? Math.atan2(dy, dx) : null);
        if (o.role === 'sup') this.doSuper(drag ? Math.atan2(dy, dx) : null);
      }
    };
    cv.addEventListener('touchstart', ts, { passive: false }); cv.addEventListener('touchmove', tm, { passive: false });
    cv.addEventListener('touchend', te, { passive: false }); cv.addEventListener('touchcancel', te, { passive: false });
    // Konami
    const kc = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']; let ki = 0;
    addEventListener('keydown', e => { ki = e.code === kc[ki] ? ki + 1 : (e.code === kc[0] ? 1 : 0); if (ki === kc.length) { ki = 0; P.s.stats.egg_konami = 1; P.s.museum.eggs.konami = 1; P.s.gems += 10; P.checkAch(); P.save(); } });
  },
  s2w(x, y) { return { x: (x - this.W / 2) / this.z + this.cam.x, y: (y - this.H / 2) / this.z + this.cam.y }; },
  moveVec() {
    let x = 0, y = 0; const k = this.keys;
    if (k.KeyW || k.ArrowUp) y--; if (k.KeyS || k.ArrowDown) y++; if (k.KeyA || k.ArrowLeft) x--; if (k.KeyD || k.ArrowRight) x++;
    for (const id in this.touches) { const o = this.touches[id]; if (o.role === 'move') { const dx = o.x - o.ox, dy = o.y - o.oy, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / 50); x = dx / d * m; y = dy / d * m; } } }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } return { x, y };
  },

  /* ---------- Запуск забега ---------- */
  start(cfg) {
    const s = P.s; SFX.init();
    this.cfg = cfg; this.cs = P.calc(s.hero); this.cs.fx = new Set(this.cs.fx);
    const rules = this.rules = {};
    let total = 1;
    if (cfg.mode === 'endless' || cfg.mode === 'chaos') total = Infinity;
    if (cfg.mode === 'daily') total = 5;
    if (cfg.mode === 'challenge') {
      const id = cfg.chId; total = 3;
      if (id === 'c_onehp') { rules.oneHp = true; this.cs.dmg *= 3; }
      if (id === 'c_speed') rules.timeLimit = 120;
      if (id === 'c_pacifist') rules.noAtk = true;
      if (id === 'c_dark') { rules.dark = true; rules.noMap = true; }
      if (id === 'c_horde') rules.enMul = 3;
      if (id === 'c_laser') { rules.laserMul = 3.5; rules.laserDmg = 2; }
      if (id === 'c_noheal') { rules.noHeal = true; total = 4; }
      if (id === 'c_bossrush') { rules.noHeal = true; rules.bosses = ['firewall', 'serpent', 'overclock']; }
    }
    this.total = total;
    const hpMax = rules.oneHp ? 1 : this.cs.maxHp;
    this.p = { x: 0, y: 0, r: 16, hp: hpMax, maxHp: hpMax, ammo: this.cs.ammo, ammoT: 0, sup: 0, shield: 0, inv: 0, dashCd: 0, dashT: 0, dvx: 0, dvy: 0, ang: 0, shots: 0, still: 0, moved: false };
    this.run = { mode: cfg.mode, hero: s.hero, stage: cfg.stage || 0, chId: cfg.chId, boss: cfg.boss, sector: 0, kills: 0, cores: 0, coins: 0, xp: 0, loot: [], time: 0, combo: 0, comboT: 0, maxCombo: 0, revived: false, dmgTaken: 0, lowhp: false };
    this.stat('runs'); this.stat('m_' + cfg.mode);
    SFX.mode('game');
    this.nextSector();
  },
  stat(k, n = 1) { P.stat(k, n); },
  bossFor() {
    const R = this.run, c = this.cfg;
    if (c.mode === 'boss') return c.boss;
    if (c.mode === 'secret') return 'null';
    if (this.rules.bosses) return this.rules.bosses[R.sector - 1];
    if (c.mode === 'campaign' && R.stage % 5 === 0) return ['firewall', 'serpent', 'overclock', 'eye', 'firewall', 'zero'][R.stage / 5 - 1];
    if ((c.mode === 'endless' || c.mode === 'chaos') && R.sector % 5 === 0) return ['firewall', 'serpent', 'overclock', 'eye', 'zero'][(R.sector / 5 - 1) % 5];
    if (c.mode === 'daily' && R.sector === 5) return ['firewall', 'serpent', 'overclock', 'eye', 'zero'][strSeed(P.today()) % 5];
    return null;
  },
  nextSector() {
    const R = this.run, c = this.cfg; R.sector++;
    const diff = this.diff = c.mode === 'campaign' ? R.stage : c.mode === 'endless' ? R.sector : c.mode === 'daily' ? 1 + R.sector * 2 : c.mode === 'chaos' ? R.sector + 2 : c.mode === 'challenge' ? 3 + R.sector * 2 : c.mode === 'secret' ? 14 : 8;
    const seed = c.mode === 'daily' ? strSeed(P.today()) + R.sector * 999 : (Math.random() * 1e9) | 0;
    const bossId = this.bossFor();
    this.ev = {}; this.mods = {};
    // события и модификаторы
    let evId = null;
    const r = Math.random;
    if (!bossId) {
      if (c.mode === 'chaos' || r() < 0.3 + this.cs.evt + (c.mode === 'daily' ? 0.15 : 0)) evId = this.pickEvent();
      const nm = (diff >= 3 ? 1 : 0) + (diff >= 9 ? 1 : 0) + (c.mode === 'chaos' ? 1 : 0);
      for (let i = 0; i < nm; i++) if (r() < 0.55 || c.mode === 'chaos') this.mods[D.MODS[Math.floor(r() * D.MODS.length)].id] = true;
    }
    if (this.rules.dark) this.mods.dark = true;
    if (evId) this.ev[evId] = true;
    const ev = this.ev, rl = this.rules;
    const opt = {
      enMul: (rl.enMul || 1) * (ev.redcode ? 2 : 1), laserMul: (rl.laserMul || 1) * (this.mods.lasers ? 2 : 1), zoneMul: ev.anomaly,
      coreMod: this.cs.core + (ev.void ? -2 : 0), extraChests: ev.treasure ? 3 : 0, extraSecret: this.cs.fx.has('sense') && r() < 0.3
    };
    const lv = this.lv = bossId ? LevelGen.genArena(seed, D.BIOMES[R.sector % 5]) : LevelGen.gen(seed, diff, opt);
    const fc = P.cos('field'); this.pal = fc.v || lv.biome;
    if (!bossId) this.stat('bio_' + lv.biome.id);
    // сущности
    this.enemies = []; this.pb = []; this.eb = []; this.parts = []; this.texts = []; this.pick = []; this.tele = []; this.holes = []; this.vfx = []; this.rifts = [];
    this.chests = lv.chests.map(c => Object.assign({ open: false }, c));
    this.crack = {}; this.boss = null; this.merchant = null; this.portalOpen = !bossId && lv.need <= 0;
    this.coresHave = 0; this.need = lv.need; this.slowT = 0; this.glitchT = 0; this.secDmg = 0; this.secTime = 0; this.evT = 12; this.stormT = 3;
    lv.enemies.forEach(e => { this.spawnEnemy(e.type, e.x, e.y); if (ev.clones) this.spawnEnemy(e.type, e.x + 20, e.y + 10); });
    lv.cores.forEach(p => this.pick.push({ k: 'core', x: p.x, y: p.y, t: Math.random() * 6 }));
    lv.coins.forEach(p => this.pick.push({ k: 'coin', x: p.x, y: p.y, v: 2, t: 0 }));
    if (!rl.noHeal) lv.heals.forEach(p => this.pick.push({ k: 'heal', x: p.x, y: p.y, t: 0 }));
    if (ev.merchant) { const q = lv.rooms[1 + Math.floor(r() * (lv.rooms.length - 1))] || lv.rooms[0]; this.merchant = { x: q.cx * TS, y: q.cy * TS + 20, used: false }; }
    if (ev.rift) for (let i = 0; i < 2; i++) { const q = lv.rooms[1 + Math.floor(r() * (lv.rooms.length - 1))]; if (q) this.rifts.push({ x: q.cx * TS, y: q.cy * TS, t: 3 }); }
    if (ev.glitchking) { const q = lv.rooms[lv.rooms.length - 1]; const g = this.spawnEnemy('glitch', q.cx * TS, q.cy * TS); g.aggro = true; }
    const p = this.p;
    p.x = lv.start.x; p.y = lv.start.y; p.shield = this.cs.shield; p.inv = 1; p.ammo = this.cs.ammo;
    if (ev.blessing) { p.hp = p.maxHp; p.shield += 50; }
    if (this.mods.fragile && !rl.oneHp) { p.maxHp = Math.round(this.cs.maxHp * 0.75); p.hp = Math.min(p.hp, p.maxHp); } else if (!rl.oneHp) p.maxHp = this.cs.maxHp;
    if (bossId) {
      const b = this.boss = Enemies.boss(this, bossId, lv.portal.x, lv.portal.y - 60, diff);
      this.banner(b.n, b.col, 'БОСС'); SFX.mode('boss'); SFX.play('boss');
    } else {
      SFX.mode('game');
      this.banner('СЕКТОР ' + R.sector + (this.total !== Infinity ? '/' + this.total : ''), '#00f0ff', lv.biome.n.toUpperCase());
    }
    if (evId) { const E = D.EVM[evId]; setTimeout(() => this.banner(E.n, E.c, 'СОБЫТИЕ', E.d), 1400); this.stat('events'); this.stat('ev_' + evId); }
    this.activeEvent = evId;
    this.cam.x = p.x; this.cam.y = p.y;
    this.explored = new Uint8Array(lv.W * lv.H); this.renderMap(); this.state = 'play';
  },
  pickEvent() {
    const L = D.EVENTS, tot = L.reduce((a, e) => a + e.w * (e.rare ? 1 + this.cs.luck : 1), 0);
    let x = Math.random() * tot; for (const e of L) { x -= e.w * (e.rare ? 1 + this.cs.luck : 1); if (x <= 0) return e.id; } return 'chaos';
  },
  spawnEnemy(type, x, y) { const e = Enemies.make(this, type, x, y, this.diff); this.enemies.push(e); return e; },

  /* ---------- Карта ---------- */
  solid(tx, ty) { const lv = this.lv; if (tx < 0 || ty < 0 || tx >= lv.W || ty >= lv.H) return true; const v = lv.t[ty * lv.W + tx]; return v === 1 || v === 2; },
  tileAt(x, y) { return this.lv.t[Math.floor(y / TS) * this.lv.W + Math.floor(x / TS)]; },
  collide(e) {
    let hit = false; const r = e.r, tx0 = Math.floor((e.x - r) / TS), tx1 = Math.floor((e.x + r) / TS), ty0 = Math.floor((e.y - r) / TS), ty1 = Math.floor((e.y + r) / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.solid(tx, ty)) continue;
      const cx = Math.max(tx * TS, Math.min(e.x, tx * TS + TS)), cy = Math.max(ty * TS, Math.min(e.y, ty * TS + TS));
      let dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
      if (d < r) { hit = true; if (d < 0.01) { dx = 0; dy = -1; d = 1; } e.x = cx + dx / d * r; e.y = cy + dy / d * r; }
    }
    return hit;
  },
  renderMap() {
    const lv = this.lv, pal = this.pal, c = this.mapCv = this.mapCv || document.createElement('canvas');
    c.width = lv.W * TS; c.height = lv.H * TS; const x = c.getContext('2d');
    x.fillStyle = pal.floor; x.fillRect(0, 0, c.width, c.height);
    for (let ty = 0; ty < lv.H; ty++) for (let tx = 0; tx < lv.W; tx++) this.drawTile(x, tx, ty);
    const m = this.miniCv = this.miniCv || document.createElement('canvas'); m.width = lv.W * 3; m.height = lv.H * 3;
    const mx = m.getContext('2d'); mx.clearRect(0, 0, m.width, m.height);
  },
  drawTile(x, tx, ty) {
    const lv = this.lv, pal = this.pal, v = lv.t[ty * lv.W + tx], X = tx * TS, Y = ty * TS;
    if (v === 0) {
      x.fillStyle = pal.floor; x.fillRect(X, Y, TS, TS);
      x.strokeStyle = pal.line; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, TS - 1, TS - 1);
      if ((tx * 7 + ty * 13) % 11 === 0) { x.fillStyle = pal.line; x.fillRect(X + TS / 2 - 2, Y + TS / 2 - 2, 4, 4); }
      return;
    }
    const open = (a, b) => { const q = (a < 0 || b < 0 || a >= lv.W || b >= lv.H) ? 1 : lv.t[b * lv.W + a]; return q === 0; };
    let nearFloor = open(tx - 1, ty) || open(tx + 1, ty) || open(tx, ty - 1) || open(tx, ty + 1);
    x.fillStyle = nearFloor ? pal.wall : '#020204'; x.fillRect(X, Y, TS, TS);
    if (!nearFloor) return;
    x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(X + 4, Y + 4, TS - 8, TS - 8);
    x.strokeStyle = pal.edge; x.lineWidth = 2; x.globalAlpha = 0.85; x.beginPath();
    if (open(tx, ty - 1)) { x.moveTo(X, Y + 1); x.lineTo(X + TS, Y + 1); }
    if (open(tx, ty + 1)) { x.moveTo(X, Y + TS - 1); x.lineTo(X + TS, Y + TS - 1); }
    if (open(tx - 1, ty)) { x.moveTo(X + 1, Y); x.lineTo(X + 1, Y + TS); }
    if (open(tx + 1, ty)) { x.moveTo(X + TS - 1, Y); x.lineTo(X + TS - 1, Y + TS); }
    x.stroke(); x.globalAlpha = 1;
    if (v === 2) { x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 10, Y + 8); x.lineTo(X + 22, Y + 24); x.lineTo(X + 18, Y + 38); x.moveTo(X + 22, Y + 24); x.lineTo(X + 36, Y + 30); x.stroke(); }
  },
  breakWall(tx, ty) {
    const lv = this.lv; lv.t[ty * lv.W + tx] = 0; const x = this.mapCv.getContext('2d');
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (tx + a >= 0 && ty + b >= 0 && tx + a < lv.W && ty + b < lv.H) this.drawTile(x, tx + a, ty + b);
    this.burst((tx + 0.5) * TS, (ty + 0.5) * TS, this.pal.edge, 25, 260); SFX.play('boom'); this.shake(5);
    for (const q of lv.secrets) if (!q.found && Math.abs(tx + 0.5 - q.cx) < 4.5 && Math.abs(ty + 0.5 - q.cy) < 4.5) {
      q.found = true; this.stat('secretRooms'); this.banner('СЕКРЕТНАЯ КОМНАТА', '#ffd700'); SFX.play('ach');
    }
  },

  /* ---------- Боевая система ---------- */
  nearestEnemy(range) {
    const p = this.p; let best = null, bd = range * range;
    const test = (x, y, o) => { const d = (x - p.x) ** 2 + (y - p.y) ** 2; if (d < bd) { bd = d; best = o; } };
    for (const e of this.enemies) if (e.aggro || true) test(e.x, e.y, e);
    if (this.boss) test(this.boss.x, this.boss.y, this.boss);
    return best;
  },
  aimAuto() {
    const t = this.nearestEnemy(this.cs.range * 1.15 + 40);
    if (t) return Math.atan2(t.y - this.p.y, t.x - this.p.x);
    for (const ch of this.chests) if (!ch.open) { }
    return this.p.ang;
  },
  fire(ang) {
    const p = this.p, cs = this.cs, H = cs.hero;
    if (this.rules.noAtk) { this.floatText(p.x, p.y - 30, 'Атака отключена', '#888'); return; }
    if (p.ammo < 1) return;
    if (ang === null || ang === undefined) ang = this.aimAuto();
    p.ammo -= 1; p.ang = ang; p.shots++;
    const over = cs.fx.has('overclock') && p.shots % 4 === 0;
    let dmg = cs.dmg * (over ? 3 : 1);
    SFX.play('shoot');
    const A = H.atk;
    if (A.t === 'wave') {
      const arc = A.spr + (cs.fx.has('multi') ? 0.5 : 0), rng = cs.range;
      this.vfx.push({ k: 'arc', x: p.x, y: p.y, a: ang, arc, r: rng, t: 0, d: 0.22, col: H.col });
      const hitT = (x, y, r) => { const d = Math.hypot(x - p.x, y - p.y); if (d > rng + r) return false; let da = Math.abs(((Math.atan2(y - p.y, x - p.x) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da < arc / 2 + 0.2; };
      for (const e of this.enemies.slice()) if (hitT(e.x, e.y, e.r)) this.hurtEnemy(e, dmg, {});
      if (this.boss && hitT(this.boss.x, this.boss.y, this.boss.r)) this.hurtBoss(dmg);
      this.eb = this.eb.filter(b => !hitT(b.x, b.y, 4));
      // ломает трещины
      for (let i = 1; i <= 2; i++) { const tx = Math.floor((p.x + Math.cos(ang) * i * 40) / TS), ty = Math.floor((p.y + Math.sin(ang) * i * 40) / TS); if (this.lv.t[ty * this.lv.W + tx] === 2) this.damageWall(tx, ty, dmg); }
      return;
    }
    const n = A.n + (cs.fx.has('multi') ? 1 : 0), spr = A.n > 1 ? A.spr : (cs.fx.has('multi') ? 0.15 : 0);
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * spr : 0) + (A.n >= 5 ? (Math.random() - 0.5) * 0.06 : 0);
      const delay = H.id === 'phantom' ? i * 0.07 : 0;
      const mk = () => this.pb.push({
        x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * A.v, vy: Math.sin(a) * A.v, r: A.t === 'orb' ? 10 : over ? 8 : 5,
        dmg, life: cs.range / A.v, pierce: (A.pierce || 0) + (cs.fx.has('pierce') ? 1 : 0), bounce: (A.bounce || 0) + (cs.fx.has('ricochet') ? 2 : 0),
        col: over ? '#fff' : H.col, hit: new Set(), orb: A.t === 'orb'
      });
      if (delay) setTimeout(() => { if (this.state === 'play') mk(); }, delay * 1000); else mk();
    }
  },
  doSuper(ang) {
    const p = this.p, cs = this.cs, H = cs.hero; if (p.sup < 1 || this.state !== 'play') return;
    if (ang === null || ang === undefined) ang = this.aimAuto();
    p.sup = 0; this.stat('supers'); SFX.play('super'); SFX.vib(40); this.shake(8);
    const dmg = cs.dmg;
    switch (H.sup.t) {
      case 'nova': for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; this.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 7, dmg: dmg * 1.4, life: 0.8, pierce: 2, bounce: 0, col: H.col, hit: new Set() }); } break;
      case 'dash': p.dashT = 0.32; p.dvx = Math.cos(ang) * 1150; p.dvy = Math.sin(ang) * 1150; p.inv = 0.5; p.superDash = dmg * 5; p.sdHit = new Set(); break;
      case 'shield': p.inv = 3; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35 * (this.rules.noHeal ? 0 : 1)); this.vfx.push({ k: 'dome', t: 0, d: 3, col: H.col }); break;
      case 'beam': {
        const x2 = p.x + Math.cos(ang) * 1000, y2 = p.y + Math.sin(ang) * 1000;
        this.vfx.push({ k: 'beam', x1: p.x, y1: p.y, x2, y2, t: 0, d: 0.4, col: H.col });
        for (const e of this.enemies.slice()) if (this.segDist(e.x, e.y, p.x, p.y, x2, y2) < e.r + 22) this.hurtEnemy(e, dmg * 5, {});
        if (this.boss && this.segDist(this.boss.x, this.boss.y, p.x, p.y, x2, y2) < this.boss.r + 22) this.hurtBoss(dmg * 5);
        for (let i = 1; i < 20; i++) { const tx = Math.floor((p.x + Math.cos(ang) * i * 48) / TS), ty = Math.floor((p.y + Math.sin(ang) * i * 48) / TS); const v = this.lv.t[ty * this.lv.W + tx]; if (v === 2) this.breakWall(tx, ty); if (v === 1) break; }
        break;
      }
      case 'phase': this.slowT = 4; this.glitchT = 0.2; break;
      case 'hole': this.holes.push({ x: p.x + Math.cos(ang) * 260, y: p.y + Math.sin(ang) * 260, t: 0, d: 3.2, tick: 0, dmg: dmg * 1.1 }); break;
    }
    if (cs.fx.has('chrono')) this.slowT = Math.max(this.slowT, 2);
  },
  dash() {
    const p = this.p; if (this.state !== 'play' || p.dashCd > 0) return;
    let m = this.moveVec(); if (!m.x && !m.y) m = { x: Math.cos(p.ang), y: Math.sin(p.ang) };
    const l = Math.hypot(m.x, m.y); p.dashT = 0.16; p.dvx = m.x / l * 900; p.dvy = m.y / l * 900; p.dashCd = this.cs.dashcd;
    p.inv = Math.max(p.inv, this.cs.fx.has('ghost') ? 1 : 0.2); this.stat('dashes'); SFX.play('dash');
  },
  crit() { return Math.random() < this.cs.crit; },
  dmgMul() { return (this.cs.fx.has('laststand') && this.p.hp < this.p.maxHp * 0.3) ? 1.4 : 1; },
  hurtEnemy(e, dmg, o) {
    if (e.dead) return;
    let c = false; if (!o.noFx) { c = this.crit(); if (c) dmg *= this.cs.critd; dmg *= this.dmgMul(); }
    e.hp -= dmg; e.flash = 0.08; e.aggro = true; this.stat('damage', dmg);
    if (!o.noFx) {
      this.p.sup = Math.min(1, this.p.sup + dmg / 380 * this.cs.sup);
      const fx = this.cs.fx;
      if (fx.has('lifesteal') && !this.rules.noHeal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + dmg * 0.04);
      if (fx.has('freeze') && Math.random() < 0.15) e.fz = 2;
      if (fx.has('burn')) { e.burn = 3; e.burnDmg = this.cs.dmg * 0.18; }
      if (fx.has('execute') && e.hp < e.maxHp * 0.15) e.hp = 0;
      if (fx.has('chain') && Math.random() < 0.2 && !o.chain) {
        let best = null, bd = 220 * 220; for (const q of this.enemies) if (q !== e && !q.dead) { const d = (q.x - e.x) ** 2 + (q.y - e.y) ** 2; if (d < bd) { bd = d; best = q; } }
        if (best) { this.vfx.push({ k: 'bolt', x1: e.x, y1: e.y, x2: best.x, y2: best.y, t: 0, d: 0.15, col: '#9ff' }); this.hurtEnemy(best, dmg * 0.6, { chain: true }); }
      }
    }
    this.floatText(e.x + (Math.random() - 0.5) * 16, e.y - e.r, Math.round(dmg) + (c ? '!' : ''), c ? '#ffd23d' : '#fff', c ? 1.3 : 1);
    SFX.play('hit');
    if (e.hp <= 0) this.killEnemy(e);
  },
  killEnemy(e, silent) {
    if (e.dead) return; e.dead = true; const R = this.run, d = D.EN[e.type];
    this.burst(e.x, e.y, e.col, 16, 260); SFX.play('kill');
    if (e.type === 'glitch') { this.stat('glitchKills'); P.s.gems += 25; this.banner('ГЛЮК ПОЙМАН!', '#ffd700', '+25 осколков'); for (let i = 0; i < 20; i++) this.dropCoin(e.x, e.y, 3); R.loot.push(P.rollItem(0.5, 3)); }
    R.kills++; this.stat('kills'); this.stat('k_' + e.type); if (e.type === 'guard') this.stat('eliteKills');
    R.comboT > 0 ? R.combo++ : (R.combo = 1); R.comboT = this.cs.combo; R.maxCombo = Math.max(R.maxCombo, R.combo);
    P.statMax('maxCombo', R.combo); if (R.combo > P.s.daily.maxCombo) P.s.daily.maxCombo = R.combo;
    const cm = 1 + Math.min(R.combo, 50) * 0.02;
    R.xp += d.xp * cm * (this.ev.rift || this.ev.redcode ? 2 : 1);
    const drops = (this.ev.giant ? 2 : 1) * (this.cs.fx.has('greed') ? 2 : 1);
    const ch = this.ev.gold ? 1 : 0.45 + this.cs.luck * 0.3;
    for (let i = 0; i < drops; i++) if (Math.random() < ch) this.dropCoin(e.x, e.y, Math.ceil(cm * (this.ev.gold ? 3 : 1)));
    if (Math.random() < 0.04 + this.cs.luck * 0.03 && !this.rules.noHeal) this.pick.push({ k: 'heal', x: e.x, y: e.y, t: 0 });
    if (Math.random() < 0.006 * (1 + this.cs.luck * 2) + (e.type === 'guard' ? 0.01 : 0)) { R.loot.push(P.rollItem(this.cs.luck)); this.floatText(e.x, e.y - 30, 'ПРЕДМЕТ!', '#b44dff', 1.4); }
    if (d.split) for (let i = 0; i < 2; i++) { const b = this.spawnEnemy('bug', e.x + (i ? 14 : -14), e.y); b.aggro = true; b.r = 10; b.hp = b.maxHp = b.maxHp * 0.5; }
    if (this.cs.fx.has('boom') && !silent) this.explode(e.x, e.y, 70, this.cs.dmg * 1.2, false);
    if (this.ev.storm && Math.random() < 0.1) this.pick.push({ k: 'core', x: e.x, y: e.y, t: 0 });
    if (R.combo % 10 === 0) { this.banner('КОМБО ×' + R.combo, '#ff3dc8'); SFX.vib(20); }
  },
  hurtBoss(dmg) {
    const b = this.boss; if (!b || b.dead) return;
    const c = this.crit(); if (c) dmg *= this.cs.critd; dmg *= this.dmgMul();
    b.hp -= dmg; b.flash = 0.06; this.stat('damage', dmg);
    this.p.sup = Math.min(1, this.p.sup + dmg / 500 * this.cs.sup);
    if (this.cs.fx.has('lifesteal') && !this.rules.noHeal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + dmg * 0.02);
    this.floatText(b.x + (Math.random() - 0.5) * b.r, b.y - b.r, Math.round(dmg) + (c ? '!' : ''), c ? '#ffd23d' : '#fff', c ? 1.4 : 1.1);
    if (b.hp <= 0) this.killBoss();
  },
  killBoss() {
    const b = this.boss, R = this.run; b.dead = true; this.boss = null;
    this.burst(b.x, b.y, b.col, 120, 600); this.burst(b.x, b.y, '#fff', 60, 400); this.shake(25); SFX.play('boom'); SFX.vib([60, 40, 120]);
    this.stat('bossKills'); this.stat('boss_' + b.id); R.xp += 120 + this.diff * 10; R.coins += 80 + this.diff * 8;
    const relic = D.BOSSM[b.id].relic;
    if (!P.s.museum.boss[relic] || Math.random() < 0.25) R.loot.push(relic);
    else R.loot.push(P.rollItem(0.6, 2));
    this.eb = []; this.tele = []; this.enemies.forEach(e => e.hp = 0); this.enemies.forEach(e => this.killEnemy(e, true));
    this.banner('БОСС ПОВЕРЖЕН', b.col, b.n);
    this.portalOpen = true; this.lv.portal = { x: b.x, y: b.y };
    for (let i = 0; i < 25; i++) this.dropCoin(b.x, b.y, 3);
    if (!this.rules.noHeal) this.pick.push({ k: 'heal', x: b.x + 40, y: b.y });
  },
  damageWall(tx, ty, dmg) { const k = tx + ',' + ty; this.crack[k] = (this.crack[k] || 70 + this.diff * 4) - dmg; this.burst((tx + 0.5) * TS, (ty + 0.5) * TS, '#fff', 3, 120); if (this.crack[k] <= 0) this.breakWall(tx, ty); },
  explode(x, y, r, dmg, hostile) {
    this.burst(x, y, hostile ? '#ff8a00' : '#ffd23d', 30, 360); this.vfx.push({ k: 'ring', x, y, r, t: 0, d: 0.3, col: hostile ? '#ff8a00' : '#ffd23d' }); SFX.play('boom'); this.shake(6);
    if (hostile) { if (Math.hypot(this.p.x - x, this.p.y - y) < r + this.p.r) this.hurtPlayer(dmg, null); }
    else for (const e of this.enemies.slice()) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) this.hurtEnemy(e, dmg, { noFx: true });
  },
  ebullet(x, y, a, sp, dmg) { const sl = this.ev.slowmo ? 0.7 : 1; this.eb.push({ x, y, vx: Math.cos(a) * sp * sl, vy: Math.sin(a) * sp * sl, r: 6, dmg, life: 4 }); },
  hurtPlayer(dmg, src) {
    const p = this.p; if (p.inv > 0 || this.state !== 'play') return;
    if (Math.random() < this.cs.dodge) { this.floatText(p.x, p.y - 26, 'УКЛОН', '#3dffa0'); p.inv = 0.3; return; }
    dmg *= (1 - this.cs.armor) * (this.ev.overload ? 1.25 : 1);
    if (src && this.cs.fx.has('thorns')) this.hurtEnemy(src, dmg * 0.6 + this.cs.dmg * 0.3, { noFx: true });
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
    p.hp -= dmg; p.inv = 0.45; this.secDmg += dmg; this.run.dmgTaken += dmg;
    this.floatText(p.x, p.y - 26, '-' + Math.round(dmg), '#ff3d55', 1.1);
    this.shake(7); SFX.play('hurt'); SFX.vib(30); this.hurtFlash = 0.25; this.run.comboT = Math.min(this.run.comboT, 0.4);
    if (p.hp <= 0) {
      if ((this.cs.fx.has('revive')) && !this.run.revived) { this.run.revived = true; p.hp = p.maxHp * 0.5; p.inv = 2; this.banner('РЕЗЕРВНАЯ КОПИЯ', '#3dffa0', 'Вы восстановлены'); this.burst(p.x, p.y, '#3dffa0', 60, 400); return; }
      p.hp = 0; this.die();
    }
  },
  dropCoin(x, y, v) { const a = Math.random() * 6.28, s = 60 + Math.random() * 140; this.pick.push({ k: 'coin', x, y, v, t: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s }); },
  segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - t * dx, py - y1 - t * dy); },

  /* ---------- Эффекты ---------- */
  burst(x, y, col, n, sp) {
    const cap = P.s.settings.quality === 'low' ? 160 : 450; if (this.parts.length > cap) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = Math.random() * sp; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, d: 0.3 + Math.random() * 0.5, col, s: 2 + Math.random() * 3 }); }
  },
  trailP(x, y, col) { this.parts.push({ x, y, vx: 0, vy: 0, t: 0, d: 0.35, col, s: 4 }); },
  floatText(x, y, s, col, sc = 1) { if (this.texts.length < 60) this.texts.push({ x, y, s, col, t: 0, sc }); },
  banner(s, col, sub, d2) { this.bn = { s, col, sub, d2, t: 0 }; },
  shake(v) { if (P.s.settings.shake) this.shk = Math.max(this.shk || 0, v); },

  /* ---------- Обновление ---------- */
  update(dt) {
    this.frame++; const p = this.p, R = this.run, cs = this.cs, lv = this.lv;
    R.time += dt; this.secTime += dt; this.stat('playTime', dt);
    if (this.rules.timeLimit && R.time > this.rules.timeLimit) { this.banner('ВРЕМЯ ВЫШЛО', '#ff3d55'); this.die(); return; }
    this.slowT -= dt; this.glitchT -= dt; this.hurtFlash = (this.hurtFlash || 0) - dt;
    // хаос-режим: смена событий
    if (this.cfg.mode === 'chaos' && !this.boss) { this.evT -= dt; if (this.evT <= 0) { this.evT = 12; const id = this.pickEvent(); this.ev = {}; this.ev[id] = true; this.activeEvent = id; const E = D.EVM[id]; this.banner(E.n, E.c, 'ХАОС', E.d); this.stat('events'); this.stat('ev_' + id); if (id === 'blessing') { p.hp = p.maxHp; p.shield += 50; } if (id === 'glitchking') this.spawnEnemy('glitch', p.x + 200, p.y).aggro = true; } }
    // движение игрока
    const m = this.moveVec();
    if (p.dashT > 0) {
      p.dashT -= dt; p.x += p.dvx * dt; p.y += p.dvy * dt; this.trailP(p.x, p.y, cs.hero.col);
      if (p.superDash) for (const e of this.enemies.slice()) if (!p.sdHit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 14) { p.sdHit.add(e); this.hurtEnemy(e, p.superDash, {}); }
      if (p.superDash && this.boss && !p.sdHit.has(this.boss) && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.r + p.r + 14) { p.sdHit.add(this.boss); this.hurtBoss(p.superDash); }
      if (p.dashT <= 0) p.superDash = 0;
    } else { p.x += m.x * cs.spd * dt; p.y += m.y * cs.spd * dt; }
    if (m.x || m.y) { p.still = 0; if (!this.mouse.down) p.ang = Math.atan2(m.y, m.x); } else { p.still += dt; if (p.still > 30 && !p.afk) { p.afk = true; this.stat('afk'); } }
    this.collide(p);
    if (!this.touch) { const w = this.s2w(this.mouse.x, this.mouse.y); this.mouse.wx = w.x; this.mouse.wy = w.y; if (this.mouse.down) { p.ang = Math.atan2(w.y - p.y, w.x - p.x); if (!this.fireCd || this.fireCd <= 0) { if (p.ammo >= 1) { this.fire(p.ang); this.fireCd = 0.18; } } } }
    this.fireCd = (this.fireCd || 0) - dt;
    // таймеры
    p.inv -= dt; p.dashCd -= dt;
    if (p.ammo < cs.ammo) { p.ammoT += dt / cs.reload * (this.ev.overload ? 1.6 : 1); if (p.ammoT >= 1) { p.ammoT = 0; p.ammo++; } } else p.ammoT = 0;
    if (!this.rules.noHeal && cs.regen > 0) p.hp = Math.min(p.maxHp, p.hp + cs.regen * dt);
    if (!this.rules.noHeal && this.secTime > 3 && performance.now() - (this.lastHurt || 0) > 4000 && p.hp < p.maxHp) { }
    if (cs.fx.has('supgen')) p.sup = Math.min(1, p.sup + dt * 0.03);
    if (R.comboT > 0) { R.comboT -= dt; if (R.comboT <= 0) R.combo = 0; }
    if (p.hp < p.maxHp * 0.05 && p.hp > 0) R.lowhp = true;
    // орбита
    if (cs.fx.has('orbit')) { const a = R.time * 3, ox = p.x + Math.cos(a) * 46, oy = p.y + Math.sin(a) * 46; this.orb = { x: ox, y: oy }; for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - ox, e.y - oy) < e.r + 9 && (e.orbCd || 0) < R.time) { e.orbCd = R.time + 0.4; this.hurtEnemy(e, cs.dmg * 0.5, { noFx: true }); } for (const b of this.eb) if (Math.hypot(b.x - ox, b.y - oy) < 12) b.life = 0; }
    // враги
    for (const e of this.enemies) { if (e.dead) continue; if (Math.abs(e.x - p.x) > 1100 || Math.abs(e.y - p.y) > 1100) continue; Enemies.update(this, e, dt); }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.boss) Enemies.bossUpdate(this, this.boss, dt);
    // снаряды игрока
    for (const b of this.pb) {
      b.life -= dt; const ox = b.x, oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);
      if (this.solid(tx, ty)) {
        if (lv.t[ty * lv.W + tx] === 2) this.damageWall(tx, ty, b.dmg);
        if (b.bounce > 0) { b.bounce--; const cX = this.solid(Math.floor(b.x / TS), Math.floor(oy / TS)), cY = this.solid(Math.floor(ox / TS), Math.floor(b.y / TS)); if (cX) b.vx *= -1; if (cY) b.vy *= -1; if (!cX && !cY) { b.vx *= -1; b.vy *= -1; } b.x = ox; b.y = oy; b.hit.clear(); }
        else { b.life = 0; this.burst(b.x, b.y, b.col, 4, 120); }
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) { b.hit.add(e); this.hurtEnemy(e, b.dmg, {}); if (b.pierce-- <= 0) { b.life = 0; break; } }
      }
      const B = this.boss;
      if (B && b.life > 0 && !b.hit.has(B)) {
        let h = (B.x - b.x) ** 2 + (B.y - b.y) ** 2 < (B.r + b.r) ** 2, mul = 1;
        if (!h && B.segs.length) for (const s of B.segs) if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 < (s.r + b.r) ** 2) { h = true; mul = 0.6; break; }
        if (h) { b.hit.add(B); this.hurtBoss(b.dmg * mul); if (b.pierce-- <= 0) b.life = 0; }
      }
    }
    this.pb = this.pb.filter(b => b.life > 0);
    // снаряды врагов
    const es = (this.slowT > 0 ? 0.35 : 1);
    for (const b of this.eb) {
      b.life -= dt; b.x += b.vx * dt * es; b.y += b.vy * dt * es;
      if (this.solid(Math.floor(b.x / TS), Math.floor(b.y / TS))) { b.life = 0; continue; }
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (p.r + b.r - 2) ** 2) { b.life = 0; this.hurtPlayer(b.dmg, null); }
    }
    this.eb = this.eb.filter(b => b.life > 0);
    // ловушки
    const ldm = 14 * (1 + this.diff * 0.04) * (this.rules.laserDmg || 1);
    for (const L of lv.lasers) {
      if (L.k === 'rot') { L.a += L.sp * dt * (this.slowT > 0 ? 0.4 : 1); for (let i = 0; i < L.arms * 2; i++) { const a = L.a + i * Math.PI / L.arms; if (this.segDist(p.x, p.y, L.x, L.y, L.x + Math.cos(a) * L.len, L.y + Math.sin(a) * L.len) < p.r + 3) { this.hurtPlayer(ldm, null); break; } } }
      else if (L.k === 'slide') { L.t += dt * L.sp; const f = (Math.sin(L.t) + 1) / 2; if (L.hz) { const y = L.y1 + f * (L.y2 - L.y1); L.cur = [L.x1, y, L.x2, y]; } else { const x = L.x1 + f * (L.x2 - L.x1); L.cur = [x, L.y1, x, L.y2]; } if (this.segDist(p.x, p.y, ...L.cur) < p.r + 3) this.hurtPlayer(ldm, null); }
      else { L.t += dt; const ph = (L.t % L.per) / L.per; L.on = ph > 0.55; L.warn = ph > 0.35 && ph <= 0.55; if (L.on) { const s = L.hz ? [L.a1, L.p, L.a2, L.p] : [L.p, L.a1, L.p, L.a2]; if (this.segDist(p.x, p.y, ...s) < p.r + 3) this.hurtPlayer(ldm, null); } }
    }
    for (const Z of lv.zones) { Z.t += dt; const ph = (Z.t % Z.per) / Z.per; Z.on = ph > 0.6; if (Z.on && Math.hypot(p.x - Z.x, p.y - Z.y) < Z.r) this.hurtPlayer(ldm * 0.8, null); }
    // телеграфы
    for (const T of this.tele) {
      T.t += dt * (this.slowT > 0 ? 0.5 : 1);
      if (T.t >= T.dur && !T.done) {
        T.done = true;
        if (T.k === 'line' && T.dmg) { this.vfx.push({ k: 'beam', x1: T.x1, y1: T.y1, x2: T.x2, y2: T.y2, t: 0, d: 0.25, col: T.col }); if (this.segDist(p.x, p.y, T.x1, T.y1, T.x2, T.y2) < T.w / 2 + p.r) this.hurtPlayer(T.dmg, null); }
        if (T.k === 'circle') { this.vfx.push({ k: 'ring', x: T.x, y: T.y, r: T.r, t: 0, d: 0.3, col: T.col }); if (Math.hypot(p.x - T.x, p.y - T.y) < T.r + p.r) this.hurtPlayer(T.dmg, null); }
      }
    }
    this.tele = this.tele.filter(T => !T.done);
    // шторм
    if (this.ev.storm) { this.stormT -= dt; if (this.stormT <= 0) { this.stormT = 2.2; const x = p.x + (Math.random() - 0.5) * 400, y = p.y + (Math.random() - 0.5) * 400; this.tele.push({ k: 'circle', x, y, r: 50, t: 0, dur: 1.1, dmg: 18, col: '#3da5ff' }); if (Math.random() < 0.3 && this.tileAt(x, y) === 0) this.pick.push({ k: 'core', x, y, t: 0 }); } }
    // разломы
    for (const rf of this.rifts) { rf.t -= dt; if (rf.t <= 0 && Math.hypot(rf.x - p.x, rf.y - p.y) < 700 && this.enemies.length < 80) { rf.t = 6; const e = this.spawnEnemy(['bug', 'worm', 'drone'][Math.floor(Math.random() * 3)], rf.x, rf.y); e.aggro = true; this.burst(rf.x, rf.y, '#b44dff', 14, 200); } }
    // чёрные дыры
    for (const h of this.holes) {
      h.t += dt; h.tick -= dt;
      for (const e of this.enemies) { const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy); if (d < 240 && d > 4) { e.x += dx / d * 220 * dt; e.y += dy / d * 220 * dt; } }
      if (h.tick <= 0) { h.tick = 0.25; for (const e of this.enemies.slice()) if (Math.hypot(h.x - e.x, h.y - e.y) < 90) this.hurtEnemy(e, h.dmg, { noFx: true }); if (this.boss && Math.hypot(h.x - this.boss.x, h.y - this.boss.y) < 90 + this.boss.r) this.hurtBoss(h.dmg * 0.7); }
    }
    this.holes = this.holes.filter(h => h.t < h.d);
    // подбор
    const mag = cs.fx.has('magnetall') ? 1e9 : cs.magnet;
    for (const k of this.pick) {
      k.t += dt;
      if (k.vx) { k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 0.9; k.vy *= 0.9; if (Math.abs(k.vx) < 5) k.vx = k.vy = 0; }
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
      const mr = k.k === 'core' ? (cs.fx.has('magnetall') ? 1e9 : mag * 1.4) : k.k === 'heal' ? 40 : mag;
      if (d < mr && d > 1) { const s = Math.max(380, 900 - d); k.x += dx / d * s * dt; k.y += dy / d * s * dt; }
      if (d < p.r + 12) { k.got = true; this.collect(k); }
    }
    this.pick = this.pick.filter(k => !k.got);
    // сундуки
    for (const c of this.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 34) this.openChest(c);
    // торговец
    if (this.merchant && !this.merchant.used && Math.hypot(this.merchant.x - p.x, this.merchant.y - p.y) < 40) { this.merchant.used = true; this.state = 'menu'; this.ui.onMerchant && this.ui.onMerchant(); }
    // портал
    if (!this.portalOpen && this.coresHave >= this.need && !this.boss) { this.portalOpen = true; this.banner('ПОРТАЛ ОТКРЫТ', '#3dffa0'); SFX.play('portal'); }
    if (this.portalOpen && Math.hypot(lv.portal.x - p.x, lv.portal.y - p.y) < 34) this.sectorClear();
    // частицы
    for (const q of this.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; }
    this.parts = this.parts.filter(q => q.t < q.d);
    for (const t of this.texts) { t.t += dt; t.y -= 40 * dt; } this.texts = this.texts.filter(t => t.t < 0.8);
    for (const v of this.vfx) v.t += dt; this.vfx = this.vfx.filter(v => v.t < v.d);
    // скин-след
    const tr = P.cos('trail').v; if (tr !== 'none' && (m.x || m.y) && this.frame % 2 === 0) this.cosTrail(tr);
    // исследование для мини-карты
    if (this.frame % 10 === 0) this.explore();
    if (this.frame % 120 === 0) P.checkAch();
  },
  cosTrail(tr) {
    const p = this.p, col = tr === 'rainbow' ? 'hsl(' + (this.frame * 6 % 360) + ',100%,60%)' : tr === 'fire' ? (Math.random() < 0.5 ? '#ff8a00' : '#ff3d55') : tr === 'code' ? '#3dff6a' : this.cs.hero.col;
    this.parts.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + (Math.random() - 0.5) * 10, vx: 0, vy: tr === 'code' ? 30 : 0, t: 0, d: 0.5, col, s: tr === 'pixel' ? 5 : 3, sq: tr === 'pixel' || tr === 'code', ch: tr === 'code' ? (Math.random() < 0.5 ? '0' : '1') : null });
  },
  collect(k) {
    const R = this.run, p = this.p, fx = P.cos('pick').v;
    if (k.k === 'core') {
      this.coresHave++; R.cores++; this.stat('cores'); SFX.play('core');
      R.xp += 6 * (this.mods.double ? 2 : 1) * (this.ev.anomaly ? 2 : 1);
      if (this.cs.fx.has('vamp_core') && !this.rules.noHeal) p.hp = Math.min(p.maxHp, p.hp + 15);
      this.floatText(p.x, p.y - 30, '◆ ' + this.coresHave + '/' + this.need, '#00f0ff', 1.2);
      if (fx === 'burst') this.burst(k.x, k.y, '#00f0ff', 24, 300);
      else if (fx === 'ring') this.vfx.push({ k: 'ring', x: k.x, y: k.y, r: 60, t: 0, d: 0.35, col: '#00f0ff' });
      else if (fx === 'stars') { for (let i = 0; i < 10; i++) this.texts.push({ x: k.x + (Math.random() - 0.5) * 50, y: k.y + (Math.random() - 0.5) * 30, s: '✦', col: '#ffd700', t: 0, sc: 1 }); }
      else this.burst(k.x, k.y, '#00f0ff', 10, 160);
    } else if (k.k === 'coin') { R.coins += k.v; SFX.play('coin'); if (fx !== 'flash') this.burst(k.x, k.y, '#ffd23d', 3, 80); }
    else if (k.k === 'heal') { const h = p.maxHp * 0.25 * this.cs.healb; p.hp = Math.min(p.maxHp, p.hp + h); this.floatText(p.x, p.y - 30, '+' + Math.round(h), '#3dffa0', 1.2); SFX.play('core'); }
  },
  openChest(c) {
    c.open = true; this.stat('chests'); SFX.play('open'); this.burst(c.x, c.y, '#ffd700', 30, 300);
    const n = c.big ? 14 : 6; for (let i = 0; i < n; i++) this.dropCoin(c.x, c.y, c.big ? 3 : 2);
    if (c.bonus) this.stat('bonusRooms');
    const ch = c.secret ? 0.7 : c.big ? 0.45 : 0.15;
    if (Math.random() < ch + this.cs.luck * 0.3) { const id = P.rollItem(this.cs.luck + (c.secret ? 0.4 : 0), c.secret ? 1 : 0); this.run.loot.push(id); this.floatText(c.x, c.y - 30, D.ITEMS[id].n, D.RAR[D.ITEMS[id].r].c, 1.3); }
    if (c.secret && Math.random() < 0.3) { P.s.gems += 3; this.floatText(c.x, c.y - 50, '+3 осколка', '#ff3dc8'); }
  },
  merchantOffers() {
    return [
      { n: 'Ремкомплект', d: 'Восстановить 50% здоровья', p: 25, f: () => { this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.5); } },
      { n: 'Ядро энергии', d: '+1 ядро для портала', p: 35, f: () => { this.coresHave++; } },
      { n: 'Тайный предмет', d: 'Случайный редкий+ предмет', p: 90, f: () => { this.run.loot.push(P.rollItem(0.6, 2)); } },
      { n: 'Заряд супер', d: 'Мгновенно заполнить супер', p: 30, f: () => { this.p.sup = 1; } }
    ];
  },
  merchantBuy(i) {
    const o = this.merchantOffers()[i]; if (!o || this.run.coins < o.p) return false;
    this.run.coins -= o.p; o.f(); this.stat('merchantBuys'); P.checkAch(); SFX.play('coin'); return true;
  },
  explore() {
    const p = this.p, lv = this.lv, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS), R = 7, mx = this.miniCv.getContext('2d');
    for (let y = pty - R; y <= pty + R; y++) for (let x = ptx - R; x <= ptx + R; x++) {
      if (x < 0 || y < 0 || x >= lv.W || y >= lv.H) continue; const i = y * lv.W + x; if (this.explored[i] === 2) continue;
      const v = lv.t[i]; const wasWall = this.explored[i] === 1;
      if (v === 0) { mx.fillStyle = 'rgba(120,140,255,0.35)'; mx.fillRect(x * 3, y * 3, 3, 3); this.explored[i] = 2; }
      else if (!wasWall) { mx.fillStyle = (v === 2 && this.cs.fx.has('sense')) ? '#ffd700' : this.pal.edge; mx.fillRect(x * 3, y * 3, 3, 3); this.explored[i] = 1; }
    }
  },
  sectorClear() {
    const R = this.run; this.state = 'menu'; SFX.play('portal'); this.stat('sectors');
    if (this.secDmg === 0) { this.stat('perfect'); }
    if (R.lowhp && this.p.hp > 0) this.stat('lowhp');
    R.lowhp = false;
    R.coins += 10 + this.diff * 2; R.xp += 15 + this.diff * 4;
    if (this.cfg.mode === 'endless') P.statMax('maxEndless', R.sector);
    if (this.cfg.mode === 'chaos') P.statMax('maxChaos', R.sector);
    P.checkAch();
    if (R.sector >= this.total) { this.end(true); return; }
    if (!this.rules.noHeal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.3);
    const pool = PERKS.slice(), ch = []; for (let i = 0; i < 3; i++) ch.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.ui.onPerk(ch, R.sector);
  },
  takePerk(pk) { pk.f(this.cs, this); this.nextSector(); },
  die() { if (this.state !== 'play') return; this.state = 'dying'; SFX.play('lose'); SFX.vib([80, 50, 160]); this.burst(this.p.x, this.p.y, this.cs.hero.col, 80, 500); setTimeout(() => this.end(false), 1300); },
  end(win) {
    const R = this.run; this.state = 'off'; SFX.mode('menu');
    if (this.cfg.mode === 'endless') P.statMax('maxEndless', R.sector - (win ? 0 : 1));
    let stars = 1; if (win) { if (R.dmgTaken < this.cs.maxHp * 0.5) stars++; if (R.time < 75 + this.diff * 6) stars++; }
    const rr = Object.assign({}, R, { success: win || ((this.total === Infinity) && R.sector >= 4), sectors: R.sector - (win ? 0 : 1), stars, cs: this.cs });
    if (this.total === Infinity) rr.sectors = R.sector - 1;
    const res = P.finishRun(rr);
    this.ui.onEnd && this.ui.onEnd(rr, res);
  },
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.ui.onPause && this.ui.onPause(); },
  resume() { if (this.state === 'paused' || this.state === 'menu') { this.state = 'play'; this.touches = {}; } },
  quit() { this.state = 'off'; SFX.mode('menu'); },

  /* ---------- Отрисовка ---------- */
  render(dt) {
    const c = this.cx, p = this.p, lv = this.lv, W = this.W, H = this.H, z = this.z, dpr = this.dpr, hi = P.s.settings.quality !== 'low';
    if (!lv) return;
    this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 8);
    let sx = 0, sy = 0; if (this.shk > 0) { sx = (Math.random() - 0.5) * this.shk; sy = (Math.random() - 0.5) * this.shk; this.shk *= 0.88; if (this.shk < 0.3) this.shk = 0; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const ox = W / 2 - this.cam.x * z + sx, oy = H / 2 - this.cam.y * z + sy;
    c.setTransform(dpr * z, 0, 0, dpr * z, ox * dpr, oy * dpr);
    // карта
    const vx = this.cam.x - W / 2 / z - 60, vy = this.cam.y - H / 2 / z - 60, vw = W / z + 120, vh = H / z + 120;
    const sx0 = Math.max(0, vx), sy0 = Math.max(0, vy), sw = Math.min(this.mapCv.width - sx0, vw), sh = Math.min(this.mapCv.height - sy0, vh);
    if (sw > 0 && sh > 0) c.drawImage(this.mapCv, sx0, sy0, sw, sh, sx0, sy0, sw, sh);
    const T = performance.now() / 1000;
    // подсветка секретов
    if (this.cs.fx.has('sense')) { c.fillStyle = 'rgba(255,215,0,' + (0.15 + Math.sin(T * 4) * 0.1) + ')'; for (let i = 0; i < lv.t.length; i++) if (lv.t[i] === 2) { const x = i % lv.W, y = (i / lv.W) | 0; c.fillRect(x * TS, y * TS, TS, TS); } }
    // зоны
    for (const Z of lv.zones) { const ph = (Z.t % Z.per) / Z.per; c.beginPath(); c.arc(Z.x, Z.y, Z.r, 0, 6.28); c.fillStyle = Z.on ? 'rgba(255,40,90,0.45)' : 'rgba(255,40,90,' + (0.06 + ph * 0.15) + ')'; c.fill(); c.strokeStyle = 'rgba(255,60,120,0.7)'; c.lineWidth = 2; c.stroke(); if (!Z.on) { c.beginPath(); c.arc(Z.x, Z.y, Z.r * Math.min(1, ph / 0.6), 0, 6.28); c.stroke(); } }
    // разломы, торговец
    for (const rf of this.rifts) { c.save(); c.translate(rf.x, rf.y); c.rotate(T * 2); c.strokeStyle = '#b44dff'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, 6.28); c.stroke(); c.restore(); }
    if (this.merchant) { const m = this.merchant; c.globalAlpha = m.used ? 0.3 : 1; this.glow(c, '#ffb020', hi ? 20 : 0); c.fillStyle = '#ffb020'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('¤', m.x, m.y + Math.sin(T * 3) * 4); c.font = '11px Manrope,sans-serif'; c.fillText('ТОРГОВЕЦ', m.x, m.y - 28); this.glow(c, 0, 0); c.globalAlpha = 1; }
    // портал
    if (!this.boss) { const pp = lv.portal; c.save(); c.translate(pp.x, pp.y); for (let i = 0; i < 3; i++) { c.rotate(T * (i + 1) * (this.portalOpen ? 1.5 : 0.3)); c.strokeStyle = this.portalOpen ? ['#3dffa0', '#00f0ff', '#7b3dff'][i] : '#333355'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 26 - i * 6, i, i + 4.5); c.stroke(); } c.restore(); if (this.portalOpen && hi) { c.fillStyle = 'rgba(61,255,160,0.12)'; c.beginPath(); c.arc(pp.x, pp.y, 50 + Math.sin(T * 5) * 6, 0, 6.28); c.fill(); } }
    // сундуки
    for (const ch of this.chests) { c.save(); c.translate(ch.x, ch.y); const s = ch.big ? 16 : 12; c.globalAlpha = ch.open ? 0.25 : 1; this.glow(c, '#ffd700', hi && !ch.open ? 14 : 0); c.strokeStyle = '#ffd700'; c.lineWidth = 2.5; c.strokeRect(-s, -s * 0.75, s * 2, s * 1.5); c.fillStyle = 'rgba(255,215,0,0.15)'; c.fillRect(-s, -s * 0.75, s * 2, s * 1.5); c.beginPath(); c.moveTo(-s, -s * 0.1); c.lineTo(s, -s * 0.1); c.stroke(); this.glow(c, 0, 0); c.restore(); }
    // лазеры
    c.lineCap = 'round';
    for (const L of lv.lasers) {
      let segs = [];
      if (L.k === 'rot') for (let i = 0; i < L.arms * 2; i++) { const a = L.a + i * Math.PI / L.arms; segs.push([L.x, L.y, L.x + Math.cos(a) * L.len, L.y + Math.sin(a) * L.len]); }
      else if (L.k === 'slide' && L.cur) segs.push(L.cur);
      else if (L.k === 'pulse') { if (L.on || L.warn) segs.push(L.hz ? [L.a1, L.p, L.a2, L.p] : [L.p, L.a1, L.p, L.a2]); }
      const warn = L.k === 'pulse' && L.warn;
      for (const s of segs) { c.strokeStyle = warn ? 'rgba(255,60,90,0.25)' : 'rgba(255,40,90,0.35)'; c.lineWidth = warn ? 2 : 9; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); if (!warn) { c.strokeStyle = '#ffd0dd'; c.lineWidth = 2.5; c.stroke(); } }
      if (L.k === 'rot') { c.fillStyle = '#ff3d55'; c.beginPath(); c.arc(L.x, L.y, 9, 0, 6.28); c.fill(); }
    }
    // телеграфы
    for (const t of this.tele) { const f = t.t / t.dur; c.strokeStyle = t.col; c.globalAlpha = 0.25 + f * 0.5; if (t.k === 'line') { c.lineWidth = t.w * (t.dmg ? f : 1); c.globalAlpha = t.dmg ? 0.15 + f * 0.35 : 0.2; c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(t.x2, t.y2); c.stroke(); } else { c.lineWidth = 2; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 6.28); c.stroke(); c.fillStyle = t.col; c.globalAlpha = 0.12 + f * 0.25; c.beginPath(); c.arc(t.x, t.y, t.r * f, 0, 6.28); c.fill(); } c.globalAlpha = 1; }
    // подбираемое
    for (const k of this.pick) {
      if (k.k === 'core') { const s = 9 + Math.sin(T * 4 + k.t) * 2; c.save(); c.translate(k.x, k.y); c.rotate(T * 1.5); this.glow(c, '#00f0ff', hi ? 18 : 0); c.fillStyle = '#00f0ff'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, 0); c.lineTo(0, s); c.lineTo(-s * 0.7, 0); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(-2, -2, 4, 4); this.glow(c, 0, 0); c.restore(); }
      else if (k.k === 'coin') { c.fillStyle = '#ffd23d'; c.beginPath(); c.arc(k.x, k.y, 4 + Math.min(3, k.v), 0, 6.28); c.fill(); }
      else { c.fillStyle = '#3dffa0'; c.fillRect(k.x - 3, k.y - 9, 6, 18); c.fillRect(k.x - 9, k.y - 3, 18, 6); }
    }
    // чёрные дыры
    for (const h of this.holes) { const g = c.createRadialGradient(h.x, h.y, 4, h.x, h.y, 100); g.addColorStop(0, '#000'); g.addColorStop(0.4, 'rgba(255,61,127,0.5)'); g.addColorStop(1, 'rgba(255,61,127,0)'); c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, 100, 0, 6.28); c.fill(); c.strokeStyle = '#ff3d7f'; c.lineWidth = 2; c.beginPath(); c.arc(h.x, h.y, 30 + Math.sin(T * 10) * 4, T * 5, T * 5 + 4); c.stroke(); }
    // враги
    for (const e of this.enemies) { if (Math.abs(e.x - this.cam.x) > W / z || Math.abs(e.y - this.cam.y) > H / z) continue; this.drawEnemy(c, e, T, hi); }
    if (this.boss) this.drawBoss(c, this.boss, T, hi);
    // снаряды
    c.globalCompositeOperation = 'lighter';
    for (const b of this.pb) { c.fillStyle = b.col; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.28); c.fill(); c.strokeStyle = b.col; c.lineWidth = b.r; c.globalAlpha = 0.4; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); c.stroke(); c.globalAlpha = 1; }
    for (const b of this.eb) { c.fillStyle = '#ff3d55'; c.beginPath(); c.arc(b.x, b.y, b.r + 2, 0, 6.28); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r - 2, 0, 6.28); c.fill(); }
    for (const q of this.parts) { c.globalAlpha = 1 - q.t / q.d; c.fillStyle = q.col; if (q.ch) { c.font = '10px monospace'; c.fillText(q.ch, q.x, q.y); } else if (q.sq) c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); else { c.beginPath(); c.arc(q.x, q.y, q.s, 0, 6.28); c.fill(); } }
    c.globalAlpha = 1;
    for (const v of this.vfx) {
      const f = v.t / v.d; c.globalAlpha = 1 - f; c.strokeStyle = v.col;
      if (v.k === 'arc') { c.lineWidth = 14; c.beginPath(); c.arc(v.x, v.y, v.r * (0.6 + f * 0.4), v.a - v.arc / 2, v.a + v.arc / 2); c.stroke(); }
      if (v.k === 'beam') { c.lineWidth = 34 * (1 - f) + 4; c.beginPath(); c.moveTo(v.x1, v.y1); c.lineTo(v.x2, v.y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 6 * (1 - f); c.stroke(); }
      if (v.k === 'ring') { c.lineWidth = 4; c.beginPath(); c.arc(v.x, v.y, v.r * (0.4 + f * 0.6), 0, 6.28); c.stroke(); }
      if (v.k === 'bolt') { c.lineWidth = 2; c.beginPath(); c.moveTo(v.x1, v.y1); c.lineTo((v.x1 + v.x2) / 2 + (Math.random() - 0.5) * 20, (v.y1 + v.y2) / 2 + (Math.random() - 0.5) * 20); c.lineTo(v.x2, v.y2); c.stroke(); }
      if (v.k === 'dome') { c.lineWidth = 3; c.globalAlpha = 0.6; c.beginPath(); c.arc(p.x, p.y, 34 + Math.sin(T * 8) * 3, 0, 6.28); c.stroke(); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // игрок
    if (this.state !== 'dying') this.drawPlayer(c, T, hi);
    if (this.orb) { c.fillStyle = '#fff'; this.glow(c, this.cs.hero.col, hi ? 12 : 0); c.beginPath(); c.arc(this.orb.x, this.orb.y, 7, 0, 6.28); c.fill(); this.glow(c, 0, 0); }
    // прицел (тач)
    for (const id in this.touches) { const o = this.touches[id]; if ((o.role === 'atk' || o.role === 'atk2' || o.role === 'sup') && Math.hypot(o.x - o.ox, o.y - o.oy) > 18) { const a = Math.atan2(o.y - o.oy, o.x - o.ox), L = o.role === 'sup' ? 260 : this.cs.range; c.strokeStyle = o.role === 'sup' ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.35)'; c.lineWidth = this.cs.hero.atk.t === 'wave' ? 30 : 10; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L); c.stroke(); } }
    // тексты
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of this.texts) { c.globalAlpha = 1 - t.t / 0.8; c.fillStyle = t.col; c.font = 'bold ' + Math.round(14 * t.sc) + 'px Unbounded,sans-serif'; c.fillText(t.s, t.x, t.y); }
    c.globalAlpha = 1;
    // экранный слой
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.mods.dark || this.ev.lost) { const px = (p.x - this.cam.x) * z + W / 2, py = (p.y - this.cam.y) * z + H / 2, rr = (this.rules.dark ? 150 : 230) * z; const g = c.createRadialGradient(px, py, rr * 0.3, px, py, rr * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.96)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (this.slowT > 0) { c.fillStyle = 'rgba(80,120,255,0.08)'; c.fillRect(0, 0, W, H); }
    if (this.hurtFlash > 0) { c.fillStyle = 'rgba(255,0,60,' + this.hurtFlash * 0.8 + ')'; c.fillRect(0, 0, W, H); }
    if (this.glitchT > 0 || this.ev.chaos && Math.random() < 0.02) { for (let i = 0; i < 4; i++) { const y = Math.random() * H, h = 10 + Math.random() * 30; c.drawImage(this.cv, 0, y * dpr, W * dpr, h * dpr, (Math.random() - 0.5) * 30, y, W, h); } }
    this.drawHUD(c, T);
  },
  glow(c, col, b) { if (b) { c.shadowColor = col; c.shadowBlur = b; } else c.shadowBlur = 0; },
  shape(c, sh, r) {
    c.beginPath();
    if (sh === 'tri') { c.moveTo(r * 1.2, 0); c.lineTo(-r * 0.8, r * 0.95); c.lineTo(-r * 0.8, -r * 0.95); }
    else if (sh === 'diamond') { c.moveTo(r * 1.2, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.lineTo(0, -r); }
    else if (sh === 'hex') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    else if (sh === 'star') for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, rr = i % 2 ? r * 0.5 : r * 1.15; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    else c.arc(0, 0, r, 0, 6.28);
    c.closePath();
  },
  drawPlayer(c, T, hi) {
    const p = this.p, col = this.cs.hero.col, sk = P.cos('skin').v;
    c.save(); c.translate(p.x, p.y);
    if (p.inv > 0 && Math.floor(T * 20) % 2 && p.dashT <= 0) c.globalAlpha = 0.5;
    if (p.shield > 0) { c.strokeStyle = 'rgba(120,200,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, p.r + 8, 0, 6.28); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, p.r * 0.8, p.r, p.r * 0.4, 0, 0, 6.28); c.fill();
    c.rotate(p.ang);
    this.glow(c, col, hi ? 22 : 0);
    c.fillStyle = '#05050c'; c.strokeStyle = col; c.lineWidth = 3.5;
    if (sk === 'ring') { c.beginPath(); c.arc(0, 0, p.r, 0, 6.28); c.stroke(); c.beginPath(); c.arc(0, 0, p.r * 0.5, 0, 6.28); c.fillStyle = col; c.fill(); }
    else if (sk === 'glitch') { this.shape(c, 'circle', p.r); c.fill(); c.stroke(); c.fillStyle = col; for (let i = 0; i < 3; i++) c.fillRect((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, 8, 3); }
    else { this.shape(c, sk, p.r); c.fill(); c.stroke(); }
    c.fillStyle = col; c.fillRect(p.r * 0.3, -3, p.r * 0.9, 6);
    c.beginPath(); c.arc(0, 0, 4, 0, 6.28); c.fill();
    this.glow(c, 0, 0); c.restore();
    // полоски над игроком
    const w = 40; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p.x - w / 2, p.y - 34, w, 5); c.fillStyle = '#3dffa0'; c.fillRect(p.x - w / 2, p.y - 34, w * Math.max(0, p.hp / p.maxHp), 5);
    const A = this.cs.ammo, aw = (w - (A - 1) * 2) / A;
    for (let i = 0; i < A; i++) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p.x - w / 2 + i * (aw + 2), p.y - 27, aw, 4); const f = i < Math.floor(p.ammo) ? 1 : i === Math.floor(p.ammo) ? p.ammoT : 0; c.fillStyle = '#ff9a3d'; c.fillRect(p.x - w / 2 + i * (aw + 2), p.y - 27, aw * f, 4); }
  },
  drawEnemy(c, e, T, hi) {
    c.save(); c.translate(e.x, e.y);
    const col = e.flash > 0 ? '#fff' : e.fz > 0 ? '#9ff' : e.col;
    this.glow(c, col, hi ? 12 : 0); c.strokeStyle = col; c.fillStyle = 'rgba(10,0,10,0.85)'; c.lineWidth = 2.5;
    const r = e.r;
    switch (e.type) {
      case 'bug': c.rotate(T * 2 + e.t); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, rr = i % 2 ? r * 0.6 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); break;
      case 'worm': c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); c.beginPath(); c.arc(Math.sin(e.t * 8) * 4, 0, r * 0.4, 0, 6.28); c.fillStyle = col; c.fill(); break;
      case 'turret': c.strokeRect(-r, -r, r * 2, r * 2); c.fillRect(-r, -r, r * 2, r * 2); c.rotate(Math.atan2(this.p.y - e.y, this.p.x - e.x)); c.fillStyle = col; c.fillRect(0, -4, r * 1.3, 8); break;
      case 'drone': c.rotate(T * 3); c.beginPath(); c.moveTo(0, -r); c.lineTo(r, r * 0.7); c.lineTo(-r, r * 0.7); c.closePath(); c.fill(); c.stroke(); break;
      case 'guard': c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); if (e.st === 1) { c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(0, 0); c.lineTo(e.cx * 80, e.cy * 80); c.stroke(); } break;
      case 'bomber': c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); if (e.st === 1 && Math.floor(T * 14) % 2) { c.fillStyle = '#fff'; c.fill(); } c.fillStyle = col; c.fillRect(-2, -r - 6, 4, 6); break;
      case 'splitter': c.rotate(T); c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); c.rotate(0.78); c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); break;
      case 'glitch': c.fillStyle = '#ffd700'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + T * 4, rr = i % 2 ? r * 0.5 : r * 1.2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); break;
    }
    this.glow(c, 0, 0); c.restore();
    if (e.hp < e.maxHp) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(e.x - 16, e.y - e.r - 10, 32, 4); c.fillStyle = '#ff3d55'; c.fillRect(e.x - 16, e.y - e.r - 10, 32 * Math.max(0, e.hp / e.maxHp), 4); }
  },
  drawBoss(c, b, T, hi) {
    const col = b.flash > 0 ? '#fff' : b.col;
    if (b.las) { c.lineCap = 'round'; for (const l of b.las) { c.strokeStyle = 'rgba(255,40,90,0.35)'; c.lineWidth = 12; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); c.strokeStyle = '#ffe0ea'; c.lineWidth = 3; c.stroke(); } }
    if (b.segs.length) for (let i = b.segs.length - 1; i >= 0; i--) { const s = b.segs[i]; c.fillStyle = '#04140c'; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.28); c.fill(); c.stroke(); }
    c.save(); c.translate(b.x, b.y); this.glow(c, col, hi ? 30 : 0); c.strokeStyle = col; c.fillStyle = '#08020a'; c.lineWidth = 4;
    const r = b.r;
    if (b.id === 'firewall') { c.rotate(T * 0.5); this.shape(c, 'hex', r); c.fill(); c.stroke(); c.rotate(-T); this.shape(c, 'hex', r * 0.6); c.stroke(); }
    else if (b.id === 'serpent') { c.rotate(b.a); c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(r * 0.4, -r * 0.4, 5, 0, 6.28); c.arc(r * 0.4, r * 0.4, 5, 0, 6.28); c.fill(); }
    else if (b.id === 'overclock') { c.rotate(T * (b.st === 2 ? 20 : 3)); for (let i = 0; i < 8; i++) { c.rotate(0.785); c.fillStyle = col; c.fillRect(r * 0.7, -5, r * 0.5, 10); } c.fillStyle = '#08020a'; c.beginPath(); c.arc(0, 0, r * 0.8, 0, 6.28); c.fill(); c.stroke(); }
    else if (b.id === 'eye') { c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, 6.28); c.fill(); c.stroke(); const a = Math.atan2(this.p.y - b.y, this.p.x - b.x); c.fillStyle = col; c.beginPath(); c.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.3, r * 0.35, 0, 6.28); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.35, r * 0.15, 0, 6.28); c.fill(); }
    else { c.rotate(T); this.shape(c, 'diamond', r); c.fill(); c.stroke(); c.rotate(-T * 2); this.shape(c, 'star', r * 0.6); c.stroke(); if (b.id === 'null' && Math.random() < 0.3) { c.fillStyle = '#fff'; c.fillRect((Math.random() - 0.5) * r * 2, (Math.random() - 0.5) * r * 2, 20, 4); } }
    this.glow(c, 0, 0); c.restore();
  },
  drawHUD(c, T) {
    const p = this.p, R = this.run, W = this.W, H = this.H, cs = this.cs, safe = 10;
    c.textBaseline = 'middle';
    // HP
    const hw = Math.min(220, W * 0.42);
    c.fillStyle = 'rgba(5,5,15,0.75)'; this.rr(c, safe, safe, hw, 46, 10); c.fill();
    c.fillStyle = '#1a1a2a'; c.fillRect(safe + 8, safe + 8, hw - 16, 12);
    c.fillStyle = p.hp / p.maxHp < 0.3 ? '#ff3d55' : '#3dffa0'; c.fillRect(safe + 8, safe + 8, (hw - 16) * Math.max(0, p.hp / p.maxHp), 12);
    if (p.shield > 0) { c.fillStyle = 'rgba(120,200,255,0.8)'; c.fillRect(safe + 8, safe + 8, Math.min(hw - 16, (hw - 16) * p.shield / p.maxHp), 4); }
    c.fillStyle = '#fff'; c.font = 'bold 10px Unbounded,sans-serif'; c.textAlign = 'left'; c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, safe + 12, safe + 14.5);
    c.fillStyle = '#00f0ff'; c.font = 'bold 12px Unbounded,sans-serif';
    c.fillText(this.boss ? '☗ БОСС' : '◆ ' + this.coresHave + '/' + this.need, safe + 8, safe + 34);
    c.fillStyle = '#ffd23d'; c.fillText('¤ ' + R.coins, safe + 82, safe + 34);
    c.fillStyle = '#aab'; c.font = '10px Unbounded,sans-serif'; c.textAlign = 'right';
    const tm = this.rules.timeLimit ? Math.max(0, this.rules.timeLimit - R.time) : R.time;
    c.fillText(Math.floor(tm / 60) + ':' + String(Math.floor(tm % 60)).padStart(2, '0'), safe + hw - 8, safe + 34);
    // модификаторы
    let my = safe + 58; c.textAlign = 'left'; c.font = '10px Manrope,sans-serif';
    const tags = Object.keys(this.mods).map(k => D.MODS.find(m => m.id === k).n); if (this.activeEvent) tags.unshift('⚠ ' + D.EVM[this.activeEvent].n);
    tags.forEach(t => { c.fillStyle = 'rgba(5,5,15,0.6)'; const tw = c.measureText(t).width + 12; this.rr(c, safe, my, tw, 18, 6); c.fill(); c.fillStyle = t[0] === '⚠' ? '#ffb020' : '#b9a6ff'; c.fillText(t, safe + 6, my + 9); my += 21; });
    // комбо
    if (R.combo >= 3) { c.textAlign = 'center'; const s = 1 + Math.min(0.5, R.combo / 60); c.font = 'bold ' + Math.round(22 * s) + 'px Unbounded,sans-serif'; c.fillStyle = 'hsl(' + (300 - Math.min(R.combo, 50) * 3) + ',100%,65%)'; c.fillText('×' + R.combo, W / 2, (this.boss ? 70 : 30)); c.font = '9px Unbounded,sans-serif'; c.fillStyle = '#fff'; c.fillText('КОМБО', W / 2, (this.boss ? 70 : 30) + 18); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(W / 2 - 30, (this.boss ? 70 : 30) + 27, 60 * Math.max(0, R.comboT / cs.combo), 2); }
    // босс
    if (this.boss) { const b = this.boss, bw = Math.min(W - 140, 440); c.fillStyle = 'rgba(5,5,15,0.8)'; this.rr(c, W / 2 - bw / 2, 12, bw, 30, 8); c.fill(); c.fillStyle = b.col; c.fillRect(W / 2 - bw / 2 + 6, 30, (bw - 12) * Math.max(0, b.hp / b.maxHp), 7); c.strokeStyle = 'rgba(255,255,255,0.3)'; [0.33, 0.66].forEach(f => { c.beginPath(); c.moveTo(W / 2 - bw / 2 + 6 + (bw - 12) * f, 28); c.lineTo(W / 2 - bw / 2 + 6 + (bw - 12) * f, 39); c.stroke(); }); c.fillStyle = '#fff'; c.font = 'bold 10px Unbounded,sans-serif'; c.textAlign = 'center'; c.fillText(b.n + ' • ФАЗА ' + b.phase, W / 2, 20); }
    // мини-карта
    if (!this.ev.lost && !this.rules.noMap && !this.lv.arena) {
      const ms = Math.min(110, W * 0.26), mx = W - ms - safe, myy = safe + 44, k = ms / (this.lv.W * 3);
      c.fillStyle = 'rgba(5,5,15,0.75)'; this.rr(c, mx - 4, myy - 4, ms + 8, ms + 8, 8); c.fill();
      c.drawImage(this.miniCv, mx, myy, ms, ms);
      const f = ms / (this.lv.W * TS);
      if (this.portalOpen) { c.fillStyle = '#3dffa0'; c.fillRect(mx + this.lv.portal.x * f - 3, myy + this.lv.portal.y * f - 3, 6, 6); }
      c.fillStyle = '#00f0ff'; for (const q of this.pick) if (q.k === 'core' && this.explored[Math.floor(q.y / TS) * this.lv.W + Math.floor(q.x / TS)]) c.fillRect(mx + q.x * f - 1.5, myy + q.y * f - 1.5, 3, 3);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(mx + p.x * f, myy + p.y * f, 2.5, 0, 6.28); c.fill();
    }
    // стрелка-навигатор
    let tg = null;
    if (this.portalOpen) tg = this.lv.portal; else if (!this.boss) { let bd = 1e12; for (const q of this.pick) if (q.k === 'core') { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; tg = q; } } }
    if (tg) { const sx = (tg.x - this.cam.x) * this.z + W / 2, sy = (tg.y - this.cam.y) * this.z + H / 2; if (sx < 20 || sy < 20 || sx > W - 20 || sy > H - 20) { const a = Math.atan2(sy - H / 2, sx - W / 2), rx = W / 2 - 40, ry = H / 2 - 60, t = Math.min(Math.abs(rx / Math.cos(a)), Math.abs(ry / Math.sin(a))); c.save(); c.translate(W / 2 + Math.cos(a) * t, H / 2 + Math.sin(a) * t); c.rotate(a); c.fillStyle = this.portalOpen ? '#3dffa0' : '#00f0ff'; c.globalAlpha = 0.6 + Math.sin(T * 6) * 0.3; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-4, 0); c.lineTo(-8, 10); c.closePath(); c.fill(); c.restore(); } }
    // баннер
    if (this.bn) { const b = this.bn; b.t += 1 / 60; const f = b.t < 0.25 ? b.t / 0.25 : b.t > 2.2 ? Math.max(0, 1 - (b.t - 2.2) / 0.4) : 1; if (b.t > 2.6) this.bn = null; else { c.globalAlpha = f; c.textAlign = 'center'; const y = H * 0.3; if (b.sub) { c.font = 'bold 11px Unbounded,sans-serif'; c.fillStyle = '#aab'; c.fillText(b.sub, W / 2, y - 26); } c.font = '900 ' + Math.min(34, W / 12) + 'px Unbounded,sans-serif'; c.fillStyle = b.col; this.glow(c, b.col, 20); c.fillText(b.s, W / 2 + (1 - f) * 40, y); this.glow(c, 0, 0); if (b.d2) { c.font = '12px Manrope,sans-serif'; c.fillStyle = '#dde'; c.fillText(b.d2, W / 2, y + 28); } c.globalAlpha = 1; } }
    if (P.s.settings.fps) { c.fillStyle = '#0f0'; c.font = '10px monospace'; c.textAlign = 'left'; c.fillText(this.fps + ' FPS', safe, H - 10); }
    // тач-кнопки
    if (this.touch) {
      for (const id in this.touches) { const o = this.touches[id]; if (o.role === 'move') { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.beginPath(); c.arc(o.ox, o.oy, 50, 0, 6.28); c.stroke(); const dx = o.x - o.ox, dy = o.y - o.oy, d = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); c.fillStyle = 'rgba(0,240,255,0.5)'; c.beginPath(); c.arc(o.ox + Math.cos(a) * d, o.oy + Math.sin(a) * d, 24, 0, 6.28); c.fill(); } }
      const B = this.btn;
      const btn = (o, col, fill, label, icon) => {
        c.fillStyle = 'rgba(5,5,15,0.55)'; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 6.28); c.fill();
        if (fill < 1) { c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 4; c.beginPath(); c.arc(o.x, o.y, o.r - 2, 0, 6.28); c.stroke(); }
        c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(o.x, o.y, o.r - 2, -Math.PI / 2, -Math.PI / 2 + 6.28 * fill); c.stroke();
        if (fill >= 1) { c.fillStyle = col; c.globalAlpha = 0.25 + Math.sin(T * 6) * 0.1; c.beginPath(); c.arc(o.x, o.y, o.r - 4, 0, 6.28); c.fill(); c.globalAlpha = 1; }
        c.fillStyle = fill >= 1 ? '#fff' : 'rgba(255,255,255,0.5)'; c.textAlign = 'center'; c.font = 'bold ' + Math.round(o.r * 0.55) + 'px sans-serif'; c.fillText(icon, o.x, o.y - 2);
        c.font = 'bold 8px Unbounded,sans-serif'; c.fillText(label, o.x, o.y + o.r * 0.55);
      };
      btn(B.atk, '#ff9a3d', Math.min(1, (Math.floor(p.ammo) + p.ammoT) / cs.ammo), 'АТАКА', '✦');
      btn(B.sup, '#ffd700', p.sup, 'СУПЕР', '★');
      btn(B.dash, '#00f0ff', p.dashCd > 0 ? 1 - p.dashCd / cs.dashcd : 1, 'РЫВОК', '⇢');
    } else {
      c.textAlign = 'right'; c.font = '10px Manrope,sans-serif'; c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillText('WASD — движение • ЛКМ — атака • ПКМ/Пробел — супер (' + Math.floor(p.sup * 100) + '%) • Shift — рывок • Esc — пауза', W - 12, H - 14);
      const sw = 160; c.fillStyle = 'rgba(5,5,15,0.7)'; this.rr(c, W - sw - 12, H - 44, sw, 14, 6); c.fill(); c.fillStyle = p.sup >= 1 ? '#ffd700' : '#aa8a20'; c.fillRect(W - sw - 10, H - 42, (sw - 4) * p.sup, 10);
    }
  },
  rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
};
