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
      fc++; fpsT += dt; if (fpsT > 0.5) { this.fps = Math.round(fc / fpsT); fc = 0; fpsT = 0; if (this.state === 'play' && R3.on) R3.adapt(this.fps); }
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
    cv.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; if (document.pointerLockElement === cv && this.state === 'play') this.yaw += e.movementX * 0.0026 * (P.s.settings.sens || 1); });
    cv.addEventListener('mousedown', e => {
      if (this.touch) return; SFX.init(); if (this.isTP() && document.pointerLockElement !== cv && this.state === 'play' && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (er) { } }
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { if (this.isTP()) this.doSuper(this.aimTP()); else { const w = this.s2w(e.clientX, e.clientY); this.doSuper(Math.atan2(w.y - this.p.y, w.x - this.p.x)); } }
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
        this.touches[t.identifier] = { role, ox: x, oy: y, x, y, lx: x, ly: y };
      }
    };
    const tm = (e) => { e.preventDefault(); for (const t of e.changedTouches) { const o = this.touches[t.identifier]; if (o) { o.x = t.clientX; o.y = t.clientY; if (this.isTP() && o.role !== 'move') { this.yaw += (o.x - o.lx) * 0.0085 * (P.s.settings.sens || 1); } o.lx = o.x; o.ly = o.y; } } };
    const te = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const o = this.touches[t.identifier]; delete this.touches[t.identifier]; if (!o || this.state !== 'play') continue;
        const dx = o.x - o.ox, dy = o.y - o.oy, drag = Math.hypot(dx, dy) > 18;
        if (this.isTP()) { if (o.role === 'atk' || (o.role === 'atk2' && !drag)) this.fire(null); if (o.role === 'sup') this.doSuper(null); continue; }
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
  proj(x, y, h = 0) { if (R3.on) return R3.proj(x, y, h); return { x: (x - this.cam.x) * this.z + this.W / 2, y: (y - this.cam.y) * this.z + this.H / 2, vis: true }; },
  render3d(dt) {
    const c = this.cx, p = this.p, W = this.W, H = this.H, dpr = this.dpr, T = performance.now() / 1000;
    this.cam.x = p.x; this.cam.y = p.y;
    if (this.shk > 0) { this.shk *= 0.88; if (this.shk < 0.3) this.shk = 0; }
    R3.frame(this, dt, T);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // полоски здоровья
    const hp = this.proj(p.x, p.y, 1.95);
    if (this.state !== 'dying') {
      const w = 50, y0 = hp.y - 6; c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(hp.x - w / 2 - 1, y0 - 1, w + 2, 8);
      const hf = Math.max(0, p.hp / p.maxHp); c.fillStyle = hf < 0.3 ? '#ff3d55' : '#3dffa0'; c.fillRect(hp.x - w / 2, y0, w * hf, 6);
      if (p.shield > 0) { c.fillStyle = '#78c8ff'; c.fillRect(hp.x - w / 2, y0, Math.min(w, w * p.shield / p.maxHp), 2); }
      const A = this.cs.ammo, aw = (w - (A - 1) * 2) / A;
      for (let i = 0; i < A; i++) { c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(hp.x - w / 2 + i * (aw + 2), y0 + 8, aw, 5); const f = i < Math.floor(p.ammo) ? 1 : i === Math.floor(p.ammo) ? p.ammoT : 0; c.fillStyle = f >= 1 ? '#ffae3d' : '#a0601a'; c.fillRect(hp.x - w / 2 + i * (aw + 2), y0 + 8, aw * f, 5); }
      c.font = '800 10px Unbounded,sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(P.s.name, hp.x, y0 - 10); c.fillStyle = '#fff'; c.fillText(P.s.name, hp.x, y0 - 10);
    }
    for (const e of this.enemies) { if (e.hp >= e.maxHp || Math.abs(e.x - p.x) > 900 || Math.abs(e.y - p.y) > 900) continue; const q = this.proj(e.x, e.y, e.r / TS * 2.6 + 0.3); c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(q.x - 18, q.y, 36, 6); c.fillStyle = '#ff3d55'; c.fillRect(q.x - 17, q.y + 1, 34 * Math.max(0, e.hp / e.maxHp), 4); }
    if (this.merchant && !this.merchant.used) { const q = this.proj(this.merchant.x, this.merchant.y, 1.3); c.font = '700 10px Unbounded,sans-serif'; c.fillStyle = '#ffb020'; c.fillText('ТОРГОВЕЦ', q.x, q.y); }
    for (const t of this.texts) { const q = this.proj(t.x, t.y, 1.2), f = t.t / 0.8, s = t.sc * (f < 0.15 ? 0.6 + f * 4 : 1); c.globalAlpha = 1 - f * f; c.font = '900 ' + Math.round(16 * s) + 'px Unbounded,sans-serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(t.s, q.x, q.y - f * 30); c.fillStyle = t.col; c.fillText(t.s, q.x, q.y - f * 30); }
    c.globalAlpha = 1;
    if (this.mods.dark || this.ev.lost) { const rr = (this.rules.dark ? 130 : 200); const g = c.createRadialGradient(hp.x, hp.y + 60, rr * 0.3, hp.x, hp.y + 60, rr * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.96)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    c.drawImage(this.vign(), 0, 0, W, H);
    if (this.hidden) { c.strokeStyle = 'rgba(61,255,160,0.35)'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); }
    if (this.slowT > 0) { c.fillStyle = 'rgba(80,120,255,0.12)'; c.fillRect(0, 0, W, H); }
    if (this.hurtFlash > 0) { c.fillStyle = 'rgba(255,0,60,' + this.hurtFlash * 0.7 + ')'; c.fillRect(0, 0, W, H); }
    if (this.glitchT > 0) { c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 6; i++) c.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6); }
    if (this.isTP() && this.state === 'play') { const a = this.aimTP(), locked = Math.abs(((a - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.001, d = this.cs.range * 0.85, q = this.proj(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.1), col = locked ? '#ff3d55' : 'rgba(255,255,255,0.85)', r = locked ? 12 + Math.sin(T * 10) * 2 : 9;
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y, r, 0, 6.28); c.stroke(); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + (locked ? T * 2 : 0); c.beginPath(); c.moveTo(q.x + Math.cos(an) * (r + 3), q.y + Math.sin(an) * (r + 3)); c.lineTo(q.x + Math.cos(an) * (r + 9), q.y + Math.sin(an) * (r + 9)); c.stroke(); } c.fillStyle = col; c.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); this.hitT = (this.hitT || 0) - 1 / 60; if (this.hitT > 0) { c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(q.x + sx * 6, q.y + sy * 6); c.lineTo(q.x + sx * 13, q.y + sy * 13); c.stroke(); } }
      if (!this.touch && document.pointerLockElement !== this.cv) { c.font = '700 11px Unbounded,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText('Кликните, чтобы управлять камерой мышью', W / 2, H - 40); } }
    this.drawHUD(c, T);
  },
  s2w(x, y) { if (R3.on) return R3.pick(x, y); return{ x: (x - this.W / 2) / this.z + this.cam.x, y: (y - this.H / 2) / this.z + this.cam.y }; },
  moveVec() {
    let x = 0, y = 0; const k = this.keys;
    if (k.KeyW || k.ArrowUp) y--; if (k.KeyS || k.ArrowDown) y++; if (k.KeyA || k.ArrowLeft) x--; if (k.KeyD || k.ArrowRight) x++;
    for (const id in this.touches) { const o = this.touches[id]; if (o.role === 'move') { const dx = o.x - o.ox, dy = o.y - o.oy, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / 50); x = dx / d * m; y = dy / d * m; } } }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    if (this.isTP()) { const yw = this.yaw || 0, fx = Math.cos(yw), fy = Math.sin(yw); return { x: -fy * x + fx * -y, y: fx * x + fy * -y }; }
    return { x, y };
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
    this.run = { mode: cfg.mode, hero: s.hero, stage: cfg.stage || 0, chId: cfg.chId, boss: cfg.boss, sector: 0, kills: 0, cores: 0, coins: 0, xp: 0, loot: [], time: 0, combo: 0, comboT: 0, maxCombo: 0, revived: false, dmgTaken: 0, lowhp: false, rel: new Set(), syn: new Set() }; this.pows = {}; this.relCard = null;
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
    if (c.mode === 'campaign' && R.stage % 5 === 0) return ['firewall', 'serpent', 'overclock', 'eye', 'cryo', 'zero'][R.stage / 5 - 1];
    if ((c.mode === 'endless' || c.mode === 'chaos') && R.sector % 5 === 0) return ['firewall', 'crusher', 'serpent', 'cryo', 'overclock', 'hive', 'eye', 'zero'][(R.sector / 5 - 1) % 8];
    if (c.mode === 'daily' && R.sector === 5) return ['firewall', 'serpent', 'overclock', 'eye', 'zero', 'crusher', 'cryo', 'hive'][strSeed(P.today()) % 8];
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
      coreMod: this.cs.core + (ev.void ? -2 : 0), extraChests: (ev.treasure ? 3 : 0) + ((this.route && this.route.chests) || 0), extraSecret: this.cs.fx.has('sense') && r() < 0.3
    };
    if (this.route && this.route.enMul) opt.enMul *= this.route.enMul; if (this.route && this.route.shop) ev.merchant = true;
    const BB = bossId && D.BOSSM[bossId], abio = BB && (D.BIOMES.find(q => q.id === BB.biome) || D.BIOMES[R.sector % 5]);
    const lv = this.lv = bossId ? LevelGen.genArena(seed, abio, BB.arena) : LevelGen.gen(seed, diff, opt);
    if (bossId) this.arenaFeats(lv, bossId);
    const fc = P.cos('field'); this.pal = fc.v || lv.biome;
    if (!bossId) this.stat('bio_' + lv.biome.id);
    // сущности
    this.enemies = []; this.pb = []; this.eb = []; this.parts = []; this.texts = []; this.pick = []; this.tele = []; this.holes = []; this.vfx = []; this.rifts = [];
    this.chests = lv.chests.map(c => Object.assign({ open: false }, c));
    this.crack = {}; this.boss = null; this.merchant = null; this.portalOpen = !bossId && lv.need <= 0;
    this.coresHave = 0; this.need = lv.need; this.slowT = 0; this.beltMul = 1; this.intro = null; this.glitchT = 0; this.secDmg = 0; this.secTime = 0; this.evT = 12; this.stormT = 3;
    lv.enemies.forEach(e => { this.spawnEnemy(e.type, e.x, e.y).room = e.room; if (ev.clones) this.spawnEnemy(e.type, e.x + 20, e.y + 10).room = e.room; });
    this.tpCd = 0; this.hidden = false; this.lockT = 0;
    this.amb = Array.from({ length: 45 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 2, v: 4 + Math.random() * 12, ph: Math.random() * 6 }));
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
      this.intro = { t: 0, d: 3.2, n: b.n, sub: D.BOSSM[bossId].t || '', col: b.col, desc: D.BOSSM[bossId].d }; SFX.mode('boss'); SFX.play('boss'); setTimeout(() => { if (this.boss === b) { this.shake(18); SFX.play('boom'); this.burst(b.x, b.y, b.col, 90, 520); } }, 1500);
    } else {
      SFX.mode('game');
      this.banner('СЕКТОР ' + R.sector + (this.total !== Infinity ? '/' + this.total : ''), '#00f0ff', lv.biome.n.toUpperCase());
    }
    if (evId) { const E = D.EVM[evId]; setTimeout(() => this.banner(E.n, E.c, 'СОБЫТИЕ', E.d), 1400); this.stat('events'); this.stat('ev_' + evId); }
    this.activeEvent = evId;
    this.yaw = -Math.PI / 2; R3.cd = undefined;
    this.ms = null; if (!bossId) this.initMission(this.route); this.route = null; DynEv.reset(this); this.inAnom = false;
    this.cam.x = p.x; this.cam.y = p.y;
    this.explored = new Uint8Array(lv.W * lv.H);
    R3.on = R3.active(); document.body.classList.toggle('r3d', R3.on);
    this.renderMap(); if (R3.on) { try { R3.build(this); } catch (e) { console.error(e); R3.on = false; document.body.classList.remove('r3d'); this.renderMap(); } }
    this.state = 'play';
  },
  /* ---------- Миссии сектора ---------- */
  initMission(route) {
    const lv = this.lv, rooms = lv.rooms.filter(q => q.type !== 'start'), st = lv.rooms.find(q => q.type === 'start') || lv.rooms[0];
    const far = rooms.slice().sort((a, b) => Math.hypot(b.cx - st.cx, b.cy - st.cy) - Math.hypot(a.cx - st.cx, a.cy - st.cy));
    const mid = far[Math.floor(far.length / 2)] || far[0], P0 = q => ({ x: q.cx * TS, y: q.cy * TS });
    let k = route && route.ms;
    if (!k) { const pool = ['cores', 'clear', 'hack', 'defend', 'survive', 'escort', 'artifact', 'escape', 'elite']; k = pool[Math.floor(Math.random() * pool.length)]; if (this.diff < 2) k = 'cores'; }
    const M = { k, done: false, fail: false, kills: 0, t: 0 };
    const INFO = {
      cores: ['СБОР ЯДЕР', 'Соберите энергоядра для портала'], clear: ['ЗАЧИСТКА', 'Уничтожьте большую часть врагов'], hack: ['ВЗЛОМ СЕТИ', 'Взломайте 3 терминала'],
      defend: ['ЗАЩИТА ГЕНЕРАТОРА', 'Запустите генератор и удержите 40 с'], survive: ['ВЫЖИВАНИЕ', 'Активируйте маяк и продержитесь 35 с'], escort: ['СОПРОВОЖДЕНИЕ', 'Доведите робота-курьера до портала'],
      artifact: ['ПОТЕРЯННЫЙ АРТЕФАКТ', 'Найдите артефакт по сигналу'], escape: ['ПОБЕГ', 'Тревога! Доберитесь до портала за 60 с'], elite: ['ОХОТА', 'Найдите и уничтожьте элитную цель']
    };
    M.n = INFO[k][0]; M.d = INFO[k][1];
    if (k === 'cores') M.goal = this.need;
    else { this.pick = this.pick.filter(q => q.k !== 'core'); this.need = 0; }
    if (k === 'clear') M.goal = Math.max(5, Math.ceil(this.enemies.length * 0.75));
    if (k === 'hack') { while (lv.terms.length < 3 && rooms.length) { const q = rooms[Math.floor(Math.random() * rooms.length)]; lv.terms.push({ x: (q.cx + 1.5) * TS, y: q.cy * TS, prog: 0, done: false, k: ['emp', 'loot', 'ally', 'nuke'][lv.terms.length % 4] }); } M.goal = 3; }
    if (k === 'defend') { M.gen = Object.assign(P0(mid), { hp: 420 + this.diff * 30, max: 420 + this.diff * 30, on: false, r: 26 }); M.tgt = M.gen; M.goal = 40; }
    if (k === 'survive') { M.bea = Object.assign(P0(mid), { on: false }); M.tgt = M.bea; M.goal = 35; }
    if (k === 'escort') { M.bot = Object.assign(P0(st), { hp: 280 + this.diff * 25, max: 280 + this.diff * 25, r: 18, i: 0 }); M.bot.x += 40; M.path = this.bfsPath(M.bot.x, M.bot.y, lv.portal.x, lv.portal.y); M.goal = M.path.length || 1; M.tgt = M.bot; }
    if (k === 'artifact') { const q = far.find(z => z !== lv.portalRoom) || far[0]; M.art = Object.assign(P0(q), { got: false }); M.goal = 1; }
    if (k === 'escape') { const pl = this.bfsPath(this.p.x, this.p.y, lv.portal.x, lv.portal.y).length; M.goal = Math.max(40, Math.min(90, Math.round(pl * TS / (this.cs.spd || 200) * 2.2 + 15))); M.d = 'Тревога! Доберитесь до портала за ' + M.goal + ' с'; this.portalOpen = true; }
    if (k === 'elite') { const q = far.find(z => z !== lv.portalRoom) || far[0], ty = ['guard', 'tank', 'hunter', 'shielder'][Math.floor(Math.random() * 4)]; const e = Enemies.make(this, ty, q.cx * TS, q.cy * TS, this.diff, true); e.aggro = false; this.enemies.push(e); M.elite = e; M.tgt = e; M.goal = 1; }
    const sides = [['nohit', 'Без урона'], ['fast', 'Быстрее 90 с'], ['combo', 'Комбо ×15'], ['loot', 'Открыть все сундуки']];
    M.side = sides[Math.floor(Math.random() * sides.length)];
    if (route && route.loot) M.loot = route.loot;
    this.ms = M; this.secCombo = 0;
    setTimeout(() => { if (this.ms === M) this.banner(M.n, '#00f0ff', 'ЗАДАНИЕ', M.d + ' • Бонус: ' + M.side[1]); }, 2600);
  },
  arenaFeats(lv, id) {
    const W = lv.W * TS, H = lv.H * TS;
    if (id === 'crusher') { lv.feats.push({ k: 'belt', x: 3 * TS, y: 3 * TS, w: W - 6 * TS, h: 2 * TS, dx: 1, dy: 0 }, { k: 'belt', x: 3 * TS, y: H - 5 * TS, w: W - 6 * TS, h: 2 * TS, dx: -1, dy: 0 }); [[6, 12], [19, 12]].forEach(([x, y]) => lv.feats.push({ k: 'steam', x: x * TS, y: y * TS, r: 52, t: x, per: 3 })); }
    if (id === 'cryo') { lv.feats.push({ k: 'ice', x: 4 * TS, y: 4 * TS, w: W - 8 * TS, h: H - 8 * TS }); }
    if (id === 'hive') { [[5, 5], [20, 20], [20, 5], [5, 20]].forEach(([x, y], i) => lv.feats.push({ k: 'vac', x: x * TS, y: y * TS, t: i * 2, per: 8 })); }
    if (id === 'eye' || id === 'null') lv.feats.push({ k: 'acid', x: 6 * TS, y: 13 * TS, r: 55 }, { k: 'acid', x: 20 * TS, y: 13 * TS, r: 55 });
  },
  updFeats(dt) {
    const p = this.p, F = this.lv.feats; this.featSlow = 1; this.onIce = false; if (!F || !F.length) return;
    const inR = (f, o) => o.x > f.x && o.x < f.x + f.w && o.y > f.y && o.y < f.y + f.h, bm = this.beltMul || 1;
    for (const f of F) {
      if (f.k === 'belt') { const sp = 115 * bm * dt; if (inR(f, p) && p.dashT <= 0) { p.x += f.dx * sp; p.y += f.dy * sp; } for (const e of this.enemies) if (inR(f, e)) { e.x += f.dx * sp; e.y += f.dy * sp; } for (const k of this.pick) if (inR(f, k)) { k.x += f.dx * sp * 0.8; k.y += f.dy * sp * 0.8; } }
      else if (f.k === 'steam') { f.t += dt; const ph = (f.t % f.per) / f.per; f.on = ph > 0.7; f.warn = ph > 0.5 && !f.on; if (f.on) { if (Math.hypot(p.x - f.x, p.y - f.y) < f.r) this.hurtPlayer(10 * (1 + this.diff * 0.04), null); for (const e of this.enemies) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r && this.frame % 10 === 0) this.hurtEnemy(e, 8, { noFx: true }); } }
      else if (f.k === 'acid') { if (Math.hypot(p.x - f.x, p.y - f.y) < f.r) { this.featSlow = 0.55; if (this.frame % 20 === 0) this.hurtPlayer(5, null); } for (const e of this.enemies) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r && this.frame % 20 === 0) this.hurtEnemy(e, 6, { noFx: true }); }
      else if (f.k === 'ice') { if (inR(f, p)) this.onIce = true; }
      else if (f.k === 'car') { f.t += dt * Math.abs(f.sp) / (f.x2 - f.x1 + 400); const L = f.x2 - f.x1 + 400, u = (f.t % 1) * L, x = f.sp > 0 ? f.x1 - 200 + u : f.x2 + 200 - u; f.cx = x; f.warn = true; if (Math.abs(p.x - x) < 40 && Math.abs(p.y - f.y) < 26 && p.inv <= 0) { this.hurtPlayer(22, null); p.y += (p.y < f.y ? -1 : 1) * 40; this.shake(8); } for (const e of this.enemies) if (Math.abs(e.x - x) < 40 && Math.abs(e.y - f.y) < 26 && (e.carCd || 0) < this.run.time) { e.carCd = this.run.time + 0.6; this.hurtEnemy(e, 60, { noFx: true }); } }
      else if (f.k === 'vac') { f.t += dt; const ph = (f.t % f.per) / f.per; f.on = ph > 0.72; f.warn = ph > 0.55 && !f.on; if (f.on) { const pull = (o, k) => { const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy); if (d < 320 && d > 10) { o.x += dx / d * k * dt * (1 - d / 360); o.y += dy / d * k * dt * (1 - d / 360); } }; pull(p, 230); this.enemies.forEach(e => pull(e, 260)); this.pick.forEach(k => pull(k, 300)); if (Math.hypot(p.x - f.x, p.y - f.y) < 30) this.hurtPlayer(12, null); for (const e of this.enemies) if (Math.hypot(e.x - f.x, e.y - f.y) < 30 && this.frame % 8 === 0) this.hurtEnemy(e, 20, { noFx: true }); } }
    }
  },
  bfsPath(x1, y1, x2, y2) {
    const lv = this.lv, W = lv.W, s = Math.floor(y1 / TS) * W + Math.floor(x1 / TS), g = Math.floor(y2 / TS) * W + Math.floor(x2 / TS), prev = new Int32Array(lv.t.length).fill(-1), q = [s]; prev[s] = s;
    const ok = i => { const v = lv.t[i]; return v === 0 || v === 4; };
    for (let h = 0; h < q.length; h++) { const i = q[h]; if (i === g) break; const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= lv.t.length || prev[j] !== -1) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue; if (!ok(j)) continue; prev[j] = i; q.push(j); } }
    if (prev[g] === -1) return []; const path = []; for (let i = g; i !== s; i = prev[i]) path.push({ x: (i % W + 0.5) * TS, y: (Math.floor(i / W) + 0.5) * TS }); return path.reverse();
  },
  waveSpawn(cx, cy, n) {
    const L = this.lv.biome.en; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, d = 260 + Math.random() * 120; let x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (this.tileAt(x, y) !== 0) { x = cx + Math.cos(a) * 120; y = cy + Math.sin(a) * 120; } if (this.tileAt(x, y) !== 0) continue; const e = this.spawnEnemy(L[Math.floor(Math.random() * L.length)], x, y); e.aggro = true; this.burst(x, y, '#ff3d55', 12, 200); }
  },
  updMission(dt) {
    const M = this.ms, p = this.p; if (!M || M.done || M.fail || this.boss) return;
    M.t += dt; this.secCombo = Math.max(this.secCombo || 0, this.run.combo);
    const finish = () => { M.done = true; M.tgt = null; this.portalOpen = true; this.banner('ЗАДАНИЕ ВЫПОЛНЕНО', '#3dffa0', M.n, 'Портал открыт'); SFX.play('ach'); this.shake(6); this.burst(p.x, p.y, '#3dffa0', 50, 400); };
    const failf = (why) => { M.fail = true; M.tgt = null; this.portalOpen = true; this.banner('ЗАДАНИЕ ПРОВАЛЕНО', '#ff3d55', why, 'Портал открыт, но без награды'); SFX.play('lose'); };
    switch (M.k) {
      case 'cores': M.prog = this.coresHave; if (this.coresHave >= this.need) finish(); break;
      case 'clear': M.prog = M.kills; if (M.kills >= M.goal) finish(); break;
      case 'hack': M.prog = this.lv.terms.filter(t => t.done).length; if (M.prog >= 3) finish(); break;
      case 'defend': { const g = M.gen;
        if (!g.on) { M.prog = 0; if (Math.hypot(g.x - p.x, g.y - p.y) < 80) { g.on = true; M.wt = 0; this.banner('ГЕНЕРАТОР ЗАПУЩЕН', '#ffd23d', 'ЗАЩИТА', 'Враги идут к генератору!'); SFX.play('boss'); } break; }
        M.prog = Math.min(M.goal, (M.prog || 0) + dt); M.wt -= dt; if (M.wt <= 0) { M.wt = 5; this.waveSpawn(g.x, g.y, 3 + Math.floor(this.diff / 4)); this.enemies.forEach(e => { if (Math.hypot(e.x - g.x, e.y - g.y) < 600) e.tgt = g; }); }
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - g.x, e.y - g.y) < e.r + g.r + 6) g.hp -= e.dmg * dt * 1.3;
        for (const b of this.eb) if (Math.hypot(b.x - g.x, b.y - g.y) < g.r) { g.hp -= b.dmg * 0.6; b.life = 0; }
        if (g.hp <= 0) { this.burst(g.x, g.y, '#ff8a00', 60, 420); this.shake(10); failf('Генератор уничтожен'); this.enemies.forEach(e => e.tgt = null); } else if (M.prog >= M.goal) { finish(); this.enemies.forEach(e => e.tgt = null); }
        break; }
      case 'survive': { const b = M.bea;
        if (!b.on) { M.prog = 0; if (Math.hypot(b.x - p.x, b.y - p.y) < 70) { b.on = true; M.wt = 0; M.tgt = null; this.banner('МАЯК АКТИВИРОВАН', '#ff3d55', 'ВЫЖИВАНИЕ', 'Держитесь!'); SFX.play('boss'); } break; }
        M.prog = Math.min(M.goal, (M.prog || 0) + dt); M.wt -= dt; if (M.wt <= 0) { M.wt = 4.5; this.waveSpawn(p.x, p.y, 3 + Math.floor(this.diff / 3)); }
        if (M.prog >= M.goal) finish(); break; }
      case 'escort': { const b = M.bot, nxt = M.path[b.i];
        const near = Math.hypot(b.x - p.x, b.y - p.y) < 220; b.moving = near && !!nxt;
        if (b.moving) { const dx = nxt.x - b.x, dy = nxt.y - b.y, d = Math.hypot(dx, dy); const sp = 85 * dt; if (d < sp) { b.x = nxt.x; b.y = nxt.y; b.i++; } else { b.x += dx / d * sp; b.y += dy / d * sp; } b.ang = Math.atan2(dy, dx); }
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r + 6) b.hp -= e.dmg * dt * 1.2;
        for (const q of this.eb) if (Math.hypot(q.x - b.x, q.y - b.y) < b.r) { b.hp -= q.dmg * 0.5; q.life = 0; }
        if (this.frame % 90 === 0) this.enemies.forEach(e => { if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < 300 && Math.random() < 0.4) e.tgt = b; });
        M.prog = b.i; if (b.hp <= 0) { this.burst(b.x, b.y, '#ff8a00', 50, 380); this.shake(8); failf('Курьер уничтожен'); } else if (!nxt || Math.hypot(b.x - this.lv.portal.x, b.y - this.lv.portal.y) < 40) finish();
        break; }
      case 'artifact': { const a = M.art; M.dist = Math.hypot(a.x - p.x, a.y - p.y); M.prog = 0;
        if (M.dist < 34 && !a.got) { a.got = true; M.prog = 1; this.burst(a.x, a.y, '#ffd23d', 60, 400); this.run.loot.push(P.rollItem(0.6, 2)); Relic.drop(this, a.x, a.y + 30); this.waveSpawn(a.x, a.y, 4); finish(); }
        break; }
      case 'escape': M.prog = Math.min(M.goal, M.t); if (M.t > M.goal) { if (this.frame % 30 === 0) this.hurtPlayer(6, null); } M.wt = (M.wt || 3) - dt; if (M.wt <= 0) { M.wt = 4; this.waveSpawn(p.x, p.y, 2 + Math.floor(this.diff / 4)); } break;
      case 'elite': M.prog = M.elite.dead ? 1 : 0; if (M.elite.dead) finish(); break;
    }
  },
  missionReward() {
    const M = this.ms, R = this.run; if (!M) return;
    if (M.k === 'escape' && !M.fail) M.done = true;
    if (!M.done || M.fail) return;
    R.msDone = (R.msDone || 0) + 1;
    const base = 25 + this.diff * 4; R.coins += base; R.xp += 20 + this.diff * 5;
    const s = M.side[0], ok = s === 'nohit' ? this.secDmg === 0 : s === 'fast' ? this.secTime < 90 : s === 'combo' ? (this.secCombo || 0) >= 15 : this.chests.every(c => c.open);
    if (ok) { R.msPerf = (R.msPerf || 0) + 1; P.s.gems += 8; R.coins += base; this.stat('perfectMissions'); const id = Relic.roll(this); if (id) Relic.gain(this, id); }
    if (M.loot) R.loot.push(P.rollItem(0.5 + this.cs.luck, 2));
    this.lastMs = { n: M.n, coins: base * (ok ? 2 : 1), side: M.side[1], ok };
  },
  pickEvent() {
    const L = D.EVENTS, tot = L.reduce((a, e) => a + e.w * (e.rare ? 1 + this.cs.luck : 1), 0);
    let x = Math.random() * tot; for (const e of L) { x -= e.w * (e.rare ? 1 + this.cs.luck : 1); if (x <= 0) return e.id; } return 'chaos';
  },
  spawnEnemy(type, x, y) { const e = Enemies.make(this, type, x, y, this.diff); this.enemies.push(e); return e; },

  /* ---------- Карта ---------- */
  solid(tx, ty) { const lv = this.lv; if (tx < 0 || ty < 0 || tx >= lv.W || ty >= lv.H) return true; return lv.t[ty * lv.W + tx] !== 0; },
  breakable(v) { return v === 2 || v === 3 || v === 6; },
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
    const lv = this.lv, c = this.mapCv = this.mapCv || document.createElement('canvas');
    c.width = lv.W * TS; c.height = lv.H * TS; const x = c.getContext('2d');
    x.fillStyle = '#010103'; x.fillRect(0, 0, c.width, c.height);
    this.drawRegion(x, 0, 0, lv.W - 1, lv.H - 1);
    const m = this.miniCv = this.miniCv || document.createElement('canvas'); m.width = lv.W * 3; m.height = lv.H * 3;
    m.getContext('2d').clearRect(0, 0, m.width, m.height);
  },
  drawRegion(x, x0, y0, x1, y1) {
    const lv = this.lv; x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(lv.W - 1, x1); y1 = Math.min(lv.H - 1, y1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) this.drawFloor(x, tx, ty);
    for (let ty = Math.max(0, y0 - 1); ty <= Math.min(lv.H - 1, y1 + 1); ty++) for (let tx = x0; tx <= x1; tx++) this.drawSolid(x, tx, ty);
  },
  hsh(a, b) { let h = (a * 374761393 + b * 668265263 + (this.lv.seed | 0)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; },
  drawFloor(x, tx, ty) {
    const lv = this.lv, pal = this.pal, X = tx * TS, Y = ty * TS, v = lv.t[ty * lv.W + tx];
    if (v === 1 || v === 2) { x.fillStyle = '#010103'; x.fillRect(X, Y, TS, TS); return; }
    const h = this.hsh(tx, ty);
    x.fillStyle = pal.floor; x.fillRect(X, Y, TS, TS);
    if (!R3.on && (tx + ty) % 2 === 0) { x.fillStyle = 'rgba(255,255,255,0.018)'; x.fillRect(X, Y, TS, TS); }
    x.globalAlpha = 0.45; x.strokeStyle = pal.line; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 0.5, Y); x.lineTo(X + 0.5, Y + TS); x.moveTo(X, Y + 0.5); x.lineTo(X + TS, Y + 0.5); x.stroke(); x.globalAlpha = 1;
    x.save(); x.globalAlpha = 0.35; x.strokeStyle = pal.edge; x.fillStyle = pal.edge;
    const id = this.pal.id || lv.biome.id;
    if (h % 11 === 0) { // дорожки схемы
      x.lineWidth = 1.5; x.beginPath(); const s = h % 4; x.moveTo(X + TS / 2, Y + TS / 2);
      if (s === 0) x.lineTo(X + TS, Y + TS / 2); else if (s === 1) x.lineTo(X + TS / 2, Y + TS); else if (s === 2) { x.lineTo(X + TS * 0.8, Y + TS / 2); x.lineTo(X + TS, Y + TS * 0.3); } else x.lineTo(X, Y + TS / 2);
      x.stroke(); x.beginPath(); x.arc(X + TS / 2, Y + TS / 2, 2.5, 0, 6.28); x.fill();
    }
    if (h % 19 === 3) { x.globalAlpha = 0.18; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; x.lineTo(X + TS / 2 + Math.cos(a) * 14, Y + TS / 2 + Math.sin(a) * 14); } x.closePath(); x.stroke(); }
    if (h % 31 === 5) { x.globalAlpha = 0.12; x.fillRect(X + 6, Y + 6, TS - 12, TS - 12); x.globalAlpha = 0.4; x.strokeRect(X + 6, Y + 6, TS - 12, TS - 12); }
    if (id === 'crystal' && h % 13 === 1) { x.globalAlpha = 0.5; x.beginPath(); x.moveTo(X + 14, Y + 34); x.lineTo(X + 20, Y + 12); x.lineTo(X + 26, Y + 34); x.closePath(); x.fill(); x.beginPath(); x.moveTo(X + 24, Y + 36); x.lineTo(X + 32, Y + 20); x.lineTo(X + 36, Y + 36); x.fill(); }
    if (id === 'core' && h % 9 === 2) { x.globalAlpha = 0.55; x.strokeStyle = '#ff5a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 4, Y + 10 + h % 20); x.lineTo(X + 20, Y + 24); x.lineTo(X + 30, Y + 18); x.lineTo(X + 44, Y + 30); x.stroke(); }
    if (id === 'void' && h % 5 === 0) { x.globalAlpha = 0.6; x.fillStyle = '#fff'; x.fillRect(X + h % 40, Y + (h >> 5) % 40, 1.5, 1.5); }
    if (id === 'circuit' && h % 15 === 4) { x.globalAlpha = 0.4; x.fillStyle = '#0a2a26'; x.fillRect(X + 12, Y + 12, 24, 24); x.strokeRect(X + 12, Y + 12, 24, 24); for (let i = 0; i < 4; i++) { x.fillRect(X + 15 + i * 6, Y + 8, 2, 4); x.fillRect(X + 15 + i * 6, Y + 36, 2, 4); } }
    if (id === 'grid' && h % 7 === 0) { x.globalAlpha = 0.35; x.fillRect(X + TS / 2 - 4, Y + TS / 2 - 0.5, 8, 1); x.fillRect(X + TS / 2 - 0.5, Y + TS / 2 - 4, 1, 8); }
    x.restore();
    // тень от стены сверху
    if (ty > 0) { const up = lv.t[(ty - 1) * lv.W + tx]; if (up === 1 || up === 2 || up === 5) { const g = x.createLinearGradient(0, Y, 0, Y + 18); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X, Y, TS, 18); } }
  },
  drawSolid(x, tx, ty) {
    const lv = this.lv, pal = this.pal, v = lv.t[ty * lv.W + tx], X = tx * TS, Y = ty * TS, Dp = 16;
    if (v === 0 || v === 4) return;
    if (R3.on) { if (v !== 1 && v !== 2) this.drawFloor(x, tx, ty); return; }
    const at =(a, b) => (a < 0 || b < 0 || a >= lv.W || b >= lv.H) ? 1 : lv.t[b * lv.W + a];
    const open = (a, b) => { const q = at(a, b); return q === 0 || q === 3 || q === 6 || q === 4; };
    if (v === 1 || v === 2) {
      const near = open(tx - 1, ty) || open(tx + 1, ty) || open(tx, ty - 1) || open(tx, ty + 1) || open(tx - 1, ty + 1) || open(tx + 1, ty + 1);
      if (!near) { x.fillStyle = '#020206'; x.fillRect(X, Y - Dp, TS, TS); return; }
      const frontOpen = open(tx, ty + 1);
      // верх
      const g = x.createLinearGradient(X, Y - Dp, X, Y + TS - Dp); g.addColorStop(0, pal.wall); g.addColorStop(1, '#05040c');
      x.fillStyle = g; x.fillRect(X, Y - Dp, TS, TS);
      const wh = this.hsh(tx, ty);
      if (wh % 7 === 0) { x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 4; i++) x.fillRect(X + 10, Y - Dp + 12 + i * 6, TS - 20, 2); }
      else if (wh % 11 === 0) { x.fillStyle = pal.edge; x.globalAlpha = 0.35; x.beginPath(); x.arc(X + TS / 2, Y - Dp + TS / 2, 3, 0, 6.28); x.fill(); x.globalAlpha = 1; }
      // фасад
      if (frontOpen) {
        const f = x.createLinearGradient(0, Y + TS - Dp, 0, Y + TS); f.addColorStop(0, '#120c26'); f.addColorStop(1, '#06040e');
        x.fillStyle = f; x.fillRect(X, Y + TS - Dp, TS, Dp);
        x.fillStyle = pal.edge; x.globalAlpha = 0.55; for (let i = 0; i < 3; i++) if ((this.hsh(tx, ty) >> i) & 1) x.fillRect(X + 8 + i * 13, Y + TS - Dp + 6, 6, 2); x.globalAlpha = 1;
      }
      // неоновые кромки
      x.strokeStyle = pal.edge; x.lineWidth = 2; x.globalAlpha = 0.9; x.beginPath();
      if (open(tx, ty - 1)) { x.moveTo(X, Y - Dp + 1); x.lineTo(X + TS, Y - Dp + 1); }
      if (frontOpen) { x.moveTo(X, Y + TS - Dp); x.lineTo(X + TS, Y + TS - Dp); }
      if (open(tx - 1, ty)) { x.moveTo(X + 1, Y - Dp); x.lineTo(X + 1, Y + TS - (frontOpen ? 0 : Dp)); }
      if (open(tx + 1, ty)) { x.moveTo(X + TS - 1, Y - Dp); x.lineTo(X + TS - 1, Y + TS - (frontOpen ? 0 : Dp)); }
      x.stroke();
      if (frontOpen) { x.globalAlpha = 0.25; x.lineWidth = 6; x.beginPath(); x.moveTo(X, Y + TS - Dp); x.lineTo(X + TS, Y + TS - Dp); x.stroke(); }
      x.globalAlpha = 1;
      if (v === 2) { x.strokeStyle = 'rgba(255,220,150,0.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X + 10, Y - Dp + 8); x.lineTo(X + 22, Y - Dp + 22); x.lineTo(X + 18, Y + TS - 6); x.moveTo(X + 22, Y - Dp + 22); x.lineTo(X + 38, Y - Dp + 28); x.stroke(); }
      return;
    }
    this.drawFloor(x, tx, ty);
    if (v === 5) { // колонна данных
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.ellipse(X + TS / 2, Y + TS - 6, 20, 8, 0, 0, 6.28); x.fill();
      x.fillStyle = '#0a0818'; x.fillRect(X + 8, Y - 8, TS - 16, TS - 6);
      const g = x.createLinearGradient(X + 8, 0, X + TS - 8, 0); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)'); x.fillStyle = g; x.fillRect(X + 8, Y - 8, TS - 16, TS - 6);
      x.fillStyle = pal.wall; x.fillRect(X + 6, Y - 14, TS - 12, 10);
      x.strokeStyle = pal.edge; x.lineWidth = 1.5; x.strokeRect(X + 6.5, Y - 13.5, TS - 13, 9);
      x.fillStyle = pal.edge; for (let i = 0; i < 4; i++) { x.globalAlpha = ((this.hsh(tx, ty + i) & 3) ? 0.9 : 0.25); x.fillRect(X + 13 + (i % 2) * 14, Y + 2 + Math.floor(i / 2) * 12, 7, 3); }
      x.globalAlpha = 0.5; x.fillRect(X + TS / 2 - 1, Y - 4, 2, TS - 12); x.globalAlpha = 1;
    } else if (v === 3) { // ящик
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(X + 6, Y + 10, TS - 8, TS - 10);
      x.fillStyle = '#2a1d0c'; x.fillRect(X + 5, Y + 14, TS - 10, TS - 18);
      x.fillStyle = '#4a3214'; x.fillRect(X + 5, Y + 4, TS - 10, 12);
      x.strokeStyle = '#ffb020'; x.lineWidth = 2; x.strokeRect(X + 6, Y + 5, TS - 12, TS - 10);
      x.globalAlpha = 0.6; x.beginPath(); x.moveTo(X + 8, Y + 16); x.lineTo(X + TS - 8, Y + TS - 7); x.moveTo(X + TS - 8, Y + 16); x.lineTo(X + 8, Y + TS - 7); x.stroke(); x.globalAlpha = 1;
      x.fillStyle = '#ffb020'; x.fillRect(X + TS / 2 - 5, Y + 7, 10, 3);
    } else if (v === 6) { // энергобочка
      x.fillStyle = 'rgba(255,40,40,0.18)'; x.beginPath(); x.arc(X + TS / 2, Y + TS / 2 + 4, 24, 0, 6.28); x.fill();
      x.fillStyle = '#2a0610'; x.fillRect(X + 12, Y + 8, TS - 24, TS - 14);
      x.fillStyle = '#ff3d55'; x.fillRect(X + 12, Y + 16, TS - 24, 4); x.fillRect(X + 12, Y + 30, TS - 24, 4);
      x.fillStyle = '#4a0c18'; x.beginPath(); x.ellipse(X + TS / 2, Y + 8, (TS - 24) / 2, 5, 0, 0, 6.28); x.fill();
      x.strokeStyle = '#ff6a7a'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = '#ffd23d'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⚡', X + TS / 2, Y + 26);
    }
  },
  breakWall(tx, ty) {
    const lv = this.lv, v = lv.t[ty * lv.W + tx], cx = (tx + 0.5) * TS, cy = (ty + 0.5) * TS; lv.t[ty * lv.W + tx] = 0;
    this.drawRegion(this.mapCv.getContext('2d'), tx - 1, ty - 1, tx + 1, ty + 1);
    if (R3.on) R3.breakTile(ty * lv.W + tx);
    this.explored[ty * lv.W + tx] = 0;
    if (v === 3) {
      this.burst(cx, cy, '#ffb020', 18, 220); SFX.play('hit'); this.stat('crates');
      for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) this.dropCoin(cx, cy, 1);
      if (Math.random() < 0.18 && !this.rules.noHeal) this.pick.push({ k: 'heal', x: cx, y: cy, t: 0 });
      if (Math.random() < 0.05) this.pick.push({ k: 'core', x: cx, y: cy, t: 0 });
      if (Math.random() < 0.14) Relic.dropPow(this, cx, cy);
      return;
    }
    if (v === 6) {
      this.explode(cx, cy, 95, this.cs.dmg * 3 + 30, false);
      if (Math.hypot(this.p.x - cx, this.p.y - cy) < 80) this.hurtPlayer(14, null);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = lv.t[(ty + b) * lv.W + tx + a]; if (q === 3 || q === 6) setTimeout(() => { if (this.lv === lv && lv.t[(ty + b) * lv.W + tx + a] === q) this.breakWall(tx + a, ty + b); }, 120); }
      return;
    }
    this.burst(cx, cy, this.pal.edge, 25, 260); SFX.play('boom'); this.shake(5);
    for (const q of lv.secrets) if (!q.found && Math.abs(tx + 0.5 - q.cx) < 4.5 && Math.abs(ty + 0.5 - q.cy) < 4.5) {
      q.found = true; this.stat('secretRooms'); this.banner('СЕКРЕТНАЯ КОМНАТА', '#ffd700'); SFX.play('ach');
    }
  },
  updateRooms(dt) {
    const lv = this.lv, p = this.p, ptx = p.x / TS, pty = p.y / TS;
    lv.rooms.forEach((q, i) => {
      if (!q.lock || q.cleared) return;
      const inside = ptx > q.x + 0.6 && ptx < q.x + q.w - 0.6 && pty > q.y + 0.6 && pty < q.y + q.h - 0.6;
      if (!q.active && inside) {
        q.active = true; q.t = 0;
        const n = 2 + Math.floor(this.diff / 3);
        for (let k = 0; k < n; k++) { const ty = lv.biome.en[(Math.random() * lv.biome.en.length) | 0]; const e = this.spawnEnemy(ty, (q.x + 1 + Math.random() * (q.w - 2)) * TS, (q.y + 1 + Math.random() * (q.h - 2)) * TS); e.room = i; e.aggro = true; this.collide(e); this.burst(e.x, e.y, '#ff3d55', 10, 160); }
        q.doors.forEach(([x, y]) => { if (lv.t[y * lv.W + x] === 0) lv.t[y * lv.W + x] = 4; });
        this.banner('ЗАХВАТ КОМНАТЫ', '#ff3d55', 'ВЫХОДЫ ЗАБЛОКИРОВАНЫ', 'Уничтожьте всех врагов'); SFX.play('boss'); this.shake(8);
        this.enemies.forEach(e => { if (e.room === i) e.aggro = true; });
      }
      if (q.active) {
        q.t += dt;
        const left = this.enemies.filter(e => e.room === i && !e.dead).length;
        if (left === 0 || q.t > 50) {
          q.active = false; q.cleared = true;
          q.doors.forEach(([x, y]) => { if (lv.t[y * lv.W + x] === 4) lv.t[y * lv.W + x] = 0; });
          this.chests.push({ x: q.cx * TS, y: q.cy * TS, big: true, open: false });
          this.banner('КОМНАТА ЗАЧИЩЕНА', '#3dffa0', 'НАГРАДА'); SFX.play('portal'); this.stat('lockRooms');
        }
      }
    });
  },
  updateTiles(dt) {
    const lv = this.lv, p = this.p, i = Math.floor(p.y / TS) * lv.W + Math.floor(p.x / TS);
    this.hidden = !!lv.bush[i];
    this.tpCd -= dt; p.boostT = (p.boostT || 0) - dt;
    for (const pd of lv.pads) if (Math.abs(pd.x - p.x) < 22 && Math.abs(pd.y - p.y) < 22 && p.boostT < 0.9) { p.boostT = 1.3; SFX.play('dash'); this.burst(pd.x, pd.y, '#00f0ff', 10, 200); }
    // алтари усилений
    const bf = this.buff = this.buff || {}; for (const k in bf) bf[k] -= dt;
    for (const s of lv.shrines || []) {
      s.cd -= dt; if (s.cd > 0 || Math.hypot(s.x - p.x, s.y - p.y) > 30) continue;
      s.cd = 30; const N = { rage: ['ЯРОСТЬ', 'Урон ×1.6 на 10 с', '#ff3d55'], haste: ['ФОРСАЖ', 'Скорость ×1.7 на 8 с', '#00f0ff'], aegis: ['ЭГИДА', '+60 щита', '#78c8ff'], magnet: ['ГРАВИТОН', 'Притягивает всё 12 с', '#ffd23d'] }[s.k];
      if (s.k === 'rage') bf.rage = 10; if (s.k === 'haste') p.boostT = 8; if (s.k === 'aegis') p.shield += 60; if (s.k === 'magnet') bf.magnet = 12;
      this.banner(N[0], N[2], 'АЛТАРЬ', N[1]); SFX.play('super'); this.burst(s.x, s.y, N[2], 40, 320); this.vfx.push({ k: 'ring', x: s.x, y: s.y, r: 120, t: 0, d: 0.5, col: N[2] }); this.stat('shrines');
    }
    // терминалы взлома
    for (const tm of lv.terms || []) {
      if (tm.done) continue; const near = Math.hypot(tm.x - p.x, tm.y - p.y) < 58;
      tm.prog = Math.max(0, tm.prog + (near ? dt / 2.6 : -dt * 0.5)); tm.near = near;
      if (near && this.frame % 6 === 0) this.trailP(tm.x + (Math.random() - 0.5) * 40, tm.y + (Math.random() - 0.5) * 40, '#3dffa0');
      if (tm.prog < 1) continue;
      tm.done = true; this.stat('hacks'); SFX.play('ach'); this.shake(5); this.burst(tm.x, tm.y, '#3dffa0', 50, 400);
      if (tm.k === 'emp') { for (const e of this.enemies) if (Math.hypot(e.x - tm.x, e.y - tm.y) < 460) { e.fz = 5; e.flash = 0.2; } this.eb.length = 0; this.vfx.push({ k: 'ring', x: tm.x, y: tm.y, r: 460, t: 0, d: 0.7, col: '#9ff' }); this.banner('ЭМИ-ИМПУЛЬС', '#9ff', 'ВЗЛОМ', 'Враги заморожены, пули стёрты'); }
      else if (tm.k === 'loot') { for (let i = 0; i < 16; i++) this.dropCoin(tm.x, tm.y, 3); this.pick.push({ k: 'heal', x: tm.x + 30, y: tm.y, t: 0 }); this.banner('СЕЙФ ВСКРЫТ', '#ffd23d', 'ВЗЛОМ', 'Монеты и аптечка'); }
      else if (tm.k === 'ally') { const ts = this.enemies.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 5); ts.forEach((e, i) => { this.tele.push({ k: 'circle', x: e.x, y: e.y, r: 70, t: 0, dur: 0.6 + i * 0.15, col: '#3dffa0', dmg: 0, ally: true }); setTimeout(() => { if (this.state === 'play') this.explode(e.x, e.y, 80, this.cs.dmg * 4 + 40, false); }, (0.6 + i * 0.15) * 1000); }); this.banner('ОРБИТАЛЬНЫЙ УДАР', '#3dffa0', 'ВЗЛОМ', 'Спутник бьёт по врагам'); }
      else { this.tele.push({ k: 'circle', x: tm.x, y: tm.y, r: 190, t: 0, dur: 1.4, col: '#ff8a00', dmg: 0, ally: true }); setTimeout(() => { if (this.state === 'play') this.explode(tm.x, tm.y, 190, this.cs.dmg * 6 + 80, false); }, 1400); this.banner('ПЕРЕГРУЗКА', '#ff8a00', 'ВЗЛОМ', 'Взрыв через 1.4 с — отойдите!'); }
    }
    if (this.tpCd <= 0) for (const tp of lv.tps) for (const [a, b] of [[tp.a, tp.b], [tp.b, tp.a]]) if (Math.hypot(a.x - p.x, a.y - p.y) < 22) {
      this.burst(p.x, p.y, '#b44dff', 24, 260); p.x = b.x; p.y = b.y; this.cam.x = p.x; this.cam.y = p.y; this.tpCd = 1.6; p.inv = Math.max(p.inv, 0.5);
      this.burst(p.x, p.y, '#b44dff', 24, 260); SFX.play('portal'); this.stat('teleports'); this.glitchT = 0.15; return;
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
  isTP() { return R3.on && R3.TP; },
  aimTP() {
    const p = this.p, yw = this.yaw || 0, rng = this.cs.range * 1.2 + 40; let best = null, bs = 1e9;
    const test = (x, y, r) => { const d = Math.hypot(x - p.x, y - p.y); if (d > rng + r) return; const da = Math.abs(((Math.atan2(y - p.y, x - p.x) - yw + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da > 0.38) return; const sc = d * (1 + da * 2.5); if (sc < bs) { bs = sc; best = { x, y }; } };
    for (const e of this.enemies) if (!e.dead) test(e.x, e.y, e.r); if (this.boss) test(this.boss.x, this.boss.y, this.boss.r);
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : yw;
  },
  aimAuto() {
    if (this.isTP()) return this.aimTP();
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
    p.ammo -= 1; p.ang = ang; p.shots++; p.shotT = 0.45; this.fx({ k: 'muzzle', a: ang, col: H.col });
    const over = cs.fx.has('overclock') && p.shots % 4 === 0;
    let dmg = cs.dmg * (over ? 3 : 1);
    const A = H.atk;
    if (A.t === 'wave') {
      const arc = A.spr + (cs.fx.has('multi') ? 0.5 : 0), rng = cs.range;
      this.vfx.push({ k: 'arc', x: p.x, y: p.y, a: ang, arc, r: rng, t: 0, d: 0.22, col: H.col });
      const hitT = (x, y, r) => { const d = Math.hypot(x - p.x, y - p.y); if (d > rng + r) return false; let da = Math.abs(((Math.atan2(y - p.y, x - p.x) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da < arc / 2 + 0.2; };
      for (const e of this.enemies.slice()) if (hitT(e.x, e.y, e.r)) this.hurtEnemy(e, dmg, {});
      if (this.boss && hitT(this.boss.x, this.boss.y, this.boss.r)) this.hurtBoss(dmg);
      this.eb = this.eb.filter(b => !hitT(b.x, b.y, 4));
      // ломает трещины
      for (let i = 1; i <= 2; i++) { const tx = Math.floor((p.x + Math.cos(ang) * i * 40) / TS), ty = Math.floor((p.y + Math.sin(ang) * i * 40) / TS); if (this.breakable(this.lv.t[ty * this.lv.W + tx])) this.damageWall(tx, ty, dmg); }
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
    Relic.onFire(this, ang);
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
        for (let i = 1; i < 20; i++) { const tx = Math.floor((p.x + Math.cos(ang) * i * 48) / TS), ty = Math.floor((p.y + Math.sin(ang) * i * 48) / TS); const v = this.lv.t[ty * this.lv.W + tx]; if (this.breakable(v)) this.breakWall(tx, ty); else if (v) break; }
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
  dmgMul() { return ((this.cs.fx.has('laststand') && this.p.hp < this.p.maxHp * 0.3) ? 1.4 : 1) * (this.buff && this.buff.rage > 0 ? 1.6 : 1) * Relic.dmgMul(this) * (this.inAnom ? 2 : 1); },
  hurtEnemy(e, dmg, o) {
    if (e.dead) return;
    let c = false; if (!o.noFx) { c = this.crit(); if (c) dmg *= this.cs.critd; dmg *= this.dmgMul(); }
    if (e.shd > 0) dmg *= 0.5;
    this.fx({ k: 'hit', x: e.x, y: e.y, col: e.col, big: dmg > this.cs.dmg * 1.5, h: e.r / TS * 2.2 }); this.hitT = 0.12;
    if (!o.noFx) Relic.onHit(this, e);
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
    if (e.hp <= 0) this.killEnemy(e);
  },
  killEnemy(e, silent) {
    if (e.dead) return; e.dead = true; const R = this.run, d = D.EN[e.type]; this.fx({ k: 'die', e, x: e.x, y: e.y, col: e.col });
    this.burst(e.x, e.y, e.col, 16, 260);
    if (e.type === 'glitch') { this.stat('glitchKills'); P.s.gems += 25; this.banner('ГЛЮК ПОЙМАН!', '#ffd700', '+25 осколков'); for (let i = 0; i < 20; i++) this.dropCoin(e.x, e.y, 3); R.loot.push(P.rollItem(0.5, 3)); }
    R.kills++; this.stat('kills'); this.stat('k_' + e.type); if (e.type === 'guard' || e.elite) this.stat('eliteKills');
    if (e.elite) { this.banner('ЭЛИТА ПОВЕРЖЕНА', '#ffd23d', 'НАГРАДА', '+15 осколков и предмет'); P.s.gems += 15; for (let i = 0; i < 14; i++) this.dropCoin(e.x, e.y, 3); R.loot.push(P.rollItem(0.4 + this.cs.luck, 2)); this.pick.push({ k: 'heal', x: e.x, y: e.y, t: 0 }); this.shake(10); this.burst(e.x, e.y, '#ffd23d', 60, 420); this.vfx.push({ k: 'ring', x: e.x, y: e.y, r: 160, t: 0, d: 0.6, col: '#ffd23d' }); }
    if (this.ms) this.ms.kills = (this.ms.kills || 0) + 1;
    Relic.onKill(this, e); if (e.elite) Relic.drop(this, e.x, e.y);
    R.comboT > 0 ? R.combo++ : (R.combo = 1); R.comboT = this.cs.combo; R.maxCombo = Math.max(R.maxCombo, R.combo);
    P.statMax('maxCombo', R.combo); if (R.combo > P.s.daily.maxCombo) P.s.daily.maxCombo = R.combo;
    const cm = 1 + Math.min(R.combo, 50) * 0.02;
    R.xp += d.xp * cm * (this.ev.rift || this.ev.redcode ? 2 : 1);
    const drops = (this.ev.giant ? 2 : 1) * (this.cs.fx.has('greed') ? 2 : 1);
    const ch = this.ev.gold ? 1 : 0.45 + this.cs.luck * 0.3;
    for (let i = 0; i < drops; i++) if (Math.random() < ch) this.dropCoin(e.x, e.y, Math.ceil(cm * (this.ev.gold ? 3 : 1)));
    if (Math.random() < 0.04 + this.cs.luck * 0.03 && !this.rules.noHeal) this.pick.push({ k: 'heal', x: e.x, y: e.y, t: 0 });
    if (Math.random() < 0.006 * (1 + this.cs.luck * 2) + (e.type === 'guard' ? 0.01 : 0)) { R.loot.push(P.rollItem(this.cs.luck)); this.floatText(e.x, e.y - 30, 'ПРЕДМЕТ!', '#b44dff', 1.4); }
    if (d.split) for (let i = 0; i < 2; i++) { const b = this.spawnEnemy('bug', e.x + (i ? 14 : -14), e.y); b.aggro = true; b.room = e.room; b.r = 10; b.hp = b.maxHp = b.maxHp * 0.5; }
    if (this.cs.fx.has('boom') && !silent) this.explode(e.x, e.y, 70, this.cs.dmg * 1.2, false);
    if (this.ev.storm && Math.random() < 0.1) this.pick.push({ k: 'core', x: e.x, y: e.y, t: 0 });
    if (R.combo % 10 === 0) { this.banner('КОМБО ×' + R.combo, '#ff3dc8'); SFX.vib(20); }
  },
  hurtBoss(dmg) {
    const b = this.boss; if (!b || b.dead || this.intro) return;
    if (b.armor !== undefined && b.armor < 1) { dmg *= b.armor; if (this.frame % 20 === 0) this.floatText(b.x, b.y - b.r - 10, 'ЩИТ РОЯ', '#6aa8ff'); }
    const c = this.crit(); if (c) dmg *= this.cs.critd; dmg *= this.dmgMul(); this.fx({ k: 'hit', x: b.x, y: b.y, col: b.col, big: true, h: 2.5 }); this.hitT = 0.12;
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
    Relic.drop(this, b.x - 40, b.y + 40); Relic.drop(this, b.x + 40, b.y + 40);
    if (!this.rules.noHeal) this.pick.push({ k: 'heal', x: b.x + 40, y: b.y });
  },
  damageWall(tx, ty, dmg) { const k = tx + ',' + ty; const tv = this.lv.t[ty * this.lv.W + tx]; this.crack[k] = (this.crack[k] || (tv === 3 ? 28 : tv === 6 ? 15 : 70 + this.diff * 4)) - dmg; this.burst((tx + 0.5) * TS, (ty + 0.5) * TS, '#fff', 3, 120); if (this.crack[k] <= 0) this.breakWall(tx, ty); },
  fx(o) { (this.fxq = this.fxq || []).push(o); if (this.fxq.length > 120) this.fxq.shift(); SFX.fx(o, this); },
  explode(x, y, r, dmg, hostile) {
    this.fx({ k: 'boom', x, y, r, hostile });
    this.burst(x, y, hostile ? '#ff8a00' : '#ffd23d', 30, 360); this.vfx.push({ k: 'ring', x, y, r, t: 0, d: 0.3, col: hostile ? '#ff8a00' : '#ffd23d' }); this.shake(6);
    if (hostile) { if (Math.hypot(this.p.x - x, this.p.y - y) < r + this.p.r) this.hurtPlayer(dmg, null); }
    else for (const e of this.enemies.slice()) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) this.hurtEnemy(e, dmg, { noFx: true });
  },
  ebullet(x, y, a, sp, dmg) { SFX.enemyShot(x, y, this); const sl = this.ev.slowmo ? 0.7 : 1; this.eb.push({ x, y, vx: Math.cos(a) * sp * sl, vy: Math.sin(a) * sp * sl, r: 6, dmg, life: 4 }); },
  hurtPlayer(dmg, src) {
    const p = this.p; if (p.inv > 0 || this.state !== 'play') return;
    if (Math.random() < this.cs.dodge) { this.floatText(p.x, p.y - 26, 'УКЛОН', '#3dffa0'); p.inv = 0.3; return; }
    dmg *= (1 - this.cs.armor) * (this.ev.overload ? 1.25 : 1);
    if (src && this.cs.fx.has('thorns')) this.hurtEnemy(src, dmg * 0.6 + this.cs.dmg * 0.3, { noFx: true });
    dmg = Relic.onHurt(this, dmg); this.fx({ k: 'phit', x: p.x, y: p.y });
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
    } else { const bs = (p.boostT > 0 ? 1.7 : 1) * (this.featSlow || 1) * (p.chill > 0 ? 0.6 : 1); let vx = m.x * cs.spd * bs, vy = m.y * cs.spd * bs; if (this.onIce) { const k = Math.min(1, dt * 2.2); p.ivx = (p.ivx || 0) + (vx - (p.ivx || 0)) * k; p.ivy = (p.ivy || 0) + (vy - (p.ivy || 0)) * k; vx = p.ivx; vy = p.ivy; if ((Math.abs(vx) > 40 || Math.abs(vy) > 40) && this.frame % 3 === 0) this.trailP(p.x, p.y, '#cfefff'); } else { p.ivx = vx; p.ivy = vy; } p.x += vx * dt; p.y += vy * dt; if (p.boostT > 0 && this.frame % 2 === 0) this.trailP(p.x, p.y, '#00f0ff'); }
    p.chill = (p.chill || 0) - dt; this.updFeats(dt); SFX.steps(this, dt, !!(m.x || m.y) && p.dashT <= 0, /station|circuit|grid|factory|core/.test(this.lv.biome.id)); Relic.tick(this, dt); DynEv.tick(this, dt); if (this.relCard) { this.relCard.t += dt; if (this.relCard.t > 3.2) this.relCard = null; }
    this.updateTiles(dt); if (this.frame % 6 === 0) this.updateRooms(dt * 6);
    if (m.x || m.y) { p.still = 0; if (!this.mouse.down) p.ang = Math.atan2(m.y, m.x); } else { p.still += dt; if (p.still > 30 && !p.afk) { p.afk = true; this.stat('afk'); } }
    this.collide(p);
    p.shotT = (p.shotT || 0) - dt; if (this.isTP() && p.shotT > 0) p.ang = this.aimTP(); else if (this.isTP() && !(m.x || m.y)) { const da = ((this.yaw - p.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.ang += da * Math.min(1, dt * 8); }
    if (!this.touch) { const w = this.isTP() ? { x: p.x + Math.cos(this.yaw) * 300, y: p.y + Math.sin(this.yaw) * 300 } : this.s2w(this.mouse.x, this.mouse.y); this.mouse.wx = w.x; this.mouse.wy = w.y; if (this.mouse.down) { p.ang = this.isTP() ? this.aimTP() : Math.atan2(w.y - p.y, w.x - p.x); if (!this.fireCd || this.fireCd <= 0) { if (p.ammo >= 1) { this.fire(p.ang); this.fireCd = 0.18; } } } }
    this.fireCd = (this.fireCd || 0) - dt;
    // таймеры
    p.inv -= dt; p.dashCd -= dt;
    if (p.ammo < cs.ammo) { p.ammoT += dt / cs.reload * (this.ev.overload ? 1.6 : 1) * Relic.reloadMul(this); if (p.ammoT >= 1) { p.ammoT = 0; p.ammo++; } } else p.ammoT = 0;
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
    if (this.intro) { this.intro.t += dt; p.inv = Math.max(p.inv, 0.2); if (this.intro.t > this.intro.d) this.intro = null; }
    if (this.boss && !this.intro) Enemies.bossUpdate(this, this.boss, dt);
    // снаряды игрока
    for (const b of this.pb) {
      b.life -= dt; const ox = b.x, oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);
      if (this.solid(tx, ty)) {
        if (this.breakable(lv.t[ty * lv.W + tx])) this.damageWall(tx, ty, b.dmg);
        if (b.bounce > 0) { b.bounce--; const cX = this.solid(Math.floor(b.x / TS), Math.floor(oy / TS)), cY = this.solid(Math.floor(ox / TS), Math.floor(b.y / TS)); if (cX) b.vx *= -1; if (cY) b.vy *= -1; if (!cX && !cY) { b.vx *= -1; b.vy *= -1; } b.x = ox; b.y = oy; b.hit.clear(); }
        else { b.life = 0; this.burst(b.x, b.y, b.col, 4, 120); this.fx({ k: 'wall', x: ox, y: oy, col: b.col, vx: b.vx, vy: b.vy }); }
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
      if (this.solid(Math.floor(b.x / TS), Math.floor(b.y / TS))) { b.life = 0; this.fx({ k: 'wall', x: b.x - b.vx * dt, y: b.y - b.vy * dt, col: '#ff4060', vx: b.vx, vy: b.vy }); continue; }
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
        if (T.k === 'circle') { this.vfx.push({ k: 'ring', x: T.x, y: T.y, r: T.r, t: 0, d: 0.3, col: T.col }); if (!T.ally && Math.hypot(p.x - T.x, p.y - T.y) < T.r + p.r) this.hurtPlayer(T.dmg, null); }
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
    const mag = (cs.fx.has('magnetall') || (this.buff && this.buff.magnet > 0)) ? 1e9 : cs.magnet;
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
    this.updMission(dt);
    if (!this.portalOpen && !this.ms && this.coresHave >= this.need && !this.boss) { this.portalOpen = true; this.banner('ПОРТАЛ ОТКРЫТ', '#3dffa0'); SFX.play('portal'); }
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
    } else if (k.k === 'relic') { Relic.gain(this, k.id); } else if (k.k === 'pow') { Relic.pow(this, k.id); } else if (k.k === 'coin') { R.coins += Math.round(k.v * Relic.coinMul(this)); SFX.play('coin'); if (fx !== 'flash') this.burst(k.x, k.y, '#ffd23d', 3, 80); }
    else if (k.k === 'heal') { const h = p.maxHp * 0.25 * this.cs.healb; p.hp = Math.min(p.maxHp, p.hp + h); this.floatText(p.x, p.y - 30, '+' + Math.round(h), '#3dffa0', 1.2); SFX.play('core'); }
  },
  openChest(c) {
    c.open = true; this.stat('chests'); SFX.play('open'); this.burst(c.x, c.y, '#ffd700', 30, 300);
    const n = (c.big ? 14 : 6) * (Relic.has(this, 'greed') ? 2 : 1); for (let i = 0; i < n; i++) this.dropCoin(c.x, c.y, c.big ? 3 : 2);
    if (Math.random() < (c.secret ? 0.9 : c.big ? 0.5 : 0.2) + this.cs.luck * 0.2) Relic.drop(this, c.x, c.y + 26); else if (Math.random() < 0.5) Relic.dropPow(this, c.x, c.y + 26);
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
    this.missionReward();
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
    this.perkCh = ch; this.ui.onRoute(this.routeNodes(), R.sector, this.lastMs); this.lastMs = null;
  },
  takePerk(pk) { pk.f(this.cs, this); this.nextSector(); },
  routeNodes() {
    const T = [
      { k: 'fight', n: 'Боевая зона', d: 'Случайное задание, обычная награда', ic: '⚔', col: '#00f0ff' },
      { k: 'danger', n: 'Опасная зона', d: 'Врагов ×1.6, предмет в награду', ic: '☠', col: '#ff3d55', enMul: 1.6, loot: 1 },
      { k: 'elite', n: 'Элитная охота', d: 'Элитная цель, редкая награда', ic: '♛', col: '#ffd23d', ms: 'elite', loot: 1 },
      { k: 'treasure', n: 'Сокровищница', d: 'Мало врагов, много сундуков', ic: '◈', col: '#ffb020', ms: 'artifact', enMul: 0.6, chests: 4 },
      { k: 'shop', n: 'Чёрный рынок', d: 'Торговец в секторе', ic: '¤', col: '#b44dff', shop: 1, enMul: 0.8 },
      { k: 'rest', n: 'Комната отдыха', d: '+60% здоровья сейчас, тихий сектор', ic: '✚', col: '#3dffa0', heal: 0.6, enMul: 0.5, ms: 'cores' }
    ];
    const a = T.slice(), out = [a.shift()]; while (out.length < 3) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out.sort(() => Math.random() - 0.5);
  },
  chooseRoute(r) { this.route = r; if (r.heal && !this.rules.noHeal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * r.heal); this.ui.onPerk(this.perkCh, this.run.sector); },
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
  glowS(col, r) {
    const k = col + '|' + r; this.gc = this.gc || {};
    if (!this.gc[k]) { const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d'); const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, col); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.9; x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); this.gc[k] = c; }
    return this.gc[k];
  },
  gl(c, col, x, y, r, a = 1) { c.globalAlpha = a; c.drawImage(this.glowS(col, Math.max(4, Math.round(r))), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; },
  vign() {
    if (this.vg && this.vg.width === this.W && this.vg.height === this.H) return this.vg;
    const c = this.vg = document.createElement('canvas'); c.width = this.W; c.height = this.H; const x = c.getContext('2d');
    const g = x.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,8,0.72)'); x.fillStyle = g; x.fillRect(0, 0, this.W, this.H);
    return c;
  },
  render(dt) {
    const c = this.cx, p = this.p, lv = this.lv, W = this.W, H = this.H, z = this.z, dpr = this.dpr, hi = P.s.settings.quality !== 'low';
    if (!lv) return;
    if (R3.on) return this.render3d(dt);
    this.cam.x +=(p.x - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 8);
    let sx = 0, sy = 0; if (this.shk > 0) { sx = (Math.random() - 0.5) * this.shk; sy = (Math.random() - 0.5) * this.shk; this.shk *= 0.88; if (this.shk < 0.3) this.shk = 0; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#010103'; c.fillRect(0, 0, W, H);
    const ox = W / 2 - this.cam.x * z + sx, oy = H / 2 - this.cam.y * z + sy;
    c.setTransform(dpr * z, 0, 0, dpr * z, ox * dpr, oy * dpr);
    const vx = this.cam.x - W / 2 / z - 60, vy = this.cam.y - H / 2 / z - 60, vw = W / z + 120, vh = H / z + 120;
    const sx0 = Math.max(0, vx), sy0 = Math.max(0, vy), sw = Math.min(this.mapCv.width - sx0, vw), sh = Math.min(this.mapCv.height - sy0, vh);
    if (sw > 0 && sh > 0) c.drawImage(this.mapCv, sx0, sy0, sw, sh, sx0, sy0, sw, sh);
    const T = performance.now() / 1000, inV = (x, y, m = 80) => x > vx - m && x < vx + vw + m && y > vy - m && y < vy + vh + m;
    const edge = this.pal.edge;
    c.globalCompositeOperation = 'lighter';
    // свет от кромок пола (пятна освещения)
    if (hi) for (const q of lv.rooms) if (inV(q.cx * TS, q.cy * TS, 400)) this.gl(c, edge, q.cx * TS, q.cy * TS, Math.min(q.w, q.h) * TS * 0.6, 0.07);
    // секреты
    if (this.cs.fx.has('sense')) for (let i = 0; i < lv.t.length; i++) if (lv.t[i] === 2) { const x = (i % lv.W + 0.5) * TS, y = (((i / lv.W) | 0) + 0.5) * TS; if (inV(x, y)) this.gl(c, '#ffd700', x, y, 40, 0.3 + Math.sin(T * 4) * 0.15); }
    // ускорители и телепорты
    for (const pd of lv.pads) if (inV(pd.x, pd.y)) {
      this.gl(c, '#00f0ff', pd.x, pd.y, 34, 0.35);
      c.save(); c.translate(pd.x, pd.y); c.rotate(Math.atan2(this.p.y - pd.y, this.p.x - pd.x) * 0 + pd.a); c.strokeStyle = '#00f0ff'; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const o = ((T * 2 + i / 3) % 1) * 24 - 12; c.globalAlpha = 1 - Math.abs(o) / 14; c.beginPath(); c.moveTo(o - 6, -9); c.lineTo(o + 3, 0); c.lineTo(o - 6, 9); c.stroke(); }
      c.globalAlpha = 1; c.restore();
    }
    for (const tp of lv.tps) for (const q of [tp.a, tp.b]) if (inV(q.x, q.y)) {
      this.gl(c, '#b44dff', q.x, q.y, 44, 0.45);
      c.strokeStyle = '#d58cff'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(q.x, q.y, 20 - i * 5, 9 - i * 2, 0, T * (2 + i) , T * (2 + i) + 4.4); c.stroke(); }
    }
    c.globalCompositeOperation = 'source-over';
    // зоны
    for (const Z of lv.zones) { if (!inV(Z.x, Z.y)) continue; const ph = (Z.t % Z.per) / Z.per; c.beginPath(); c.arc(Z.x, Z.y, Z.r, 0, 6.28); c.fillStyle = Z.on ? 'rgba(255,40,90,0.4)' : 'rgba(255,40,90,' + (0.05 + ph * 0.12) + ')'; c.fill(); c.strokeStyle = 'rgba(255,60,120,0.8)'; c.lineWidth = 2; c.setLineDash([8, 6]); c.lineDashOffset = -T * 20; c.stroke(); c.setLineDash([]); if (!Z.on) { c.beginPath(); c.arc(Z.x, Z.y, Z.r * Math.min(1, ph / 0.6), 0, 6.28); c.stroke(); } else this.gl(c, '#ff2850', Z.x, Z.y, Z.r * 1.3, 0.3); }
    // барьеры комнат
    for (const q of lv.rooms) if (q.active) for (const [x, y] of q.doors) {
      const X = x * TS, Y = y * TS; if (!inV(X, Y)) continue;
      c.fillStyle = 'rgba(255,30,70,0.22)'; c.fillRect(X, Y, TS, TS);
      c.strokeStyle = '#ff3d55'; c.lineWidth = 2; c.globalAlpha = 0.7 + Math.sin(T * 12 + x) * 0.3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(X, Y + 6 + i * 12 + Math.sin(T * 9 + i) * 2); c.lineTo(X + TS, Y + 6 + i * 12 - Math.sin(T * 9 + i) * 2); c.stroke(); }
      c.globalAlpha = 1;
    }
    // разломы, торговец
    for (const rf of this.rifts) { this.gl(c, '#b44dff', rf.x, rf.y, 50, 0.4); c.save(); c.translate(rf.x, rf.y); c.rotate(T * 2); c.strokeStyle = '#d58cff'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, 6.28); c.stroke(); c.rotate(-T * 4); c.beginPath(); c.ellipse(0, 0, 16, 7, 0, 0, 6.28); c.stroke(); c.restore(); }
    if (this.merchant) { const m = this.merchant; c.globalAlpha = m.used ? 0.3 : 1; this.gl(c, '#ffb020', m.x, m.y, 50, 0.4); c.fillStyle = '#ffb020'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('¤', m.x, m.y + Math.sin(T * 3) * 4); c.font = '700 10px Unbounded,sans-serif'; c.fillText('ТОРГОВЕЦ', m.x, m.y - 30); c.globalAlpha = 1; }
    // портал
    if (!this.boss) {
      const pp = lv.portal, on = this.portalOpen;
      if (on) { this.gl(c, '#3dffa0', pp.x, pp.y, 90, 0.4 + Math.sin(T * 4) * 0.1); }
      c.save(); c.translate(pp.x, pp.y);
      c.fillStyle = on ? 'rgba(10,40,30,0.8)' : 'rgba(10,10,20,0.8)'; c.beginPath(); c.ellipse(0, 6, 34, 14, 0, 0, 6.28); c.fill();
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(T * (i + 1) * (on ? 1.4 : 0.25) * (i % 2 ? -1 : 1)); c.strokeStyle = on ? ['#3dffa0', '#00f0ff', '#7b3dff', '#fff'][i] : '#2a2a48'; c.lineWidth = 3 - i * 0.5; c.beginPath(); c.arc(0, 0, 30 - i * 6, i, i + 4.2); c.stroke(); c.restore(); }
      if (on) for (let i = 0; i < 6; i++) { const a = T * 2 + i, rr = (T * 40 + i * 20) % 40; c.fillStyle = '#bfffe0'; c.globalAlpha = 1 - rr / 40; c.fillRect(Math.cos(a) * (40 - rr), Math.sin(a) * (40 - rr) - rr * 0.3, 2, 2); }
      c.globalAlpha = 1; c.restore();
    }
    // сундуки
    for (const ch of this.chests) {
      if (!inV(ch.x, ch.y)) continue;
      c.save(); c.translate(ch.x, ch.y + (ch.open ? 0 : Math.sin(T * 3 + ch.x) * 2)); const s = ch.big ? 17 : 13;
      if (!ch.open) this.gl(c, '#ffd700', 0, 0, s * 3, 0.35);
      c.globalAlpha = ch.open ? 0.3 : 1;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(0, s * 0.9, s * 1.1, s * 0.35, 0, 0, 6.28); c.fill();
      const g = c.createLinearGradient(0, -s, 0, s); g.addColorStop(0, '#5a3a08'); g.addColorStop(1, '#2a1804'); c.fillStyle = g; c.fillRect(-s, -s * 0.5, s * 2, s * 1.2);
      c.fillStyle = '#7a5210'; c.fillRect(-s, -s * 0.85, s * 2, s * 0.45);
      c.strokeStyle = '#ffd23d'; c.lineWidth = 2; c.strokeRect(-s, -s * 0.85, s * 2, s * 1.55);
      c.fillStyle = '#ffd23d'; c.fillRect(-3, -s * 0.5, 6, 8); c.fillRect(-s, -s * 0.42, s * 2, 2);
      c.globalAlpha = 1; c.restore();
    }
    // лазеры
    c.lineCap = 'round';
    for (const L of lv.lasers) {
      let segs = [];
      if (L.k === 'rot') for (let i = 0; i < L.arms * 2; i++) { const a = L.a + i * Math.PI / L.arms; segs.push([L.x, L.y, L.x + Math.cos(a) * L.len, L.y + Math.sin(a) * L.len]); }
      else if (L.k === 'slide' && L.cur) segs.push(L.cur);
      else if (L.k === 'pulse') { if (L.on || L.warn) segs.push(L.hz ? [L.a1, L.p, L.a2, L.p] : [L.p, L.a1, L.p, L.a2]); }
      const warn = L.k === 'pulse' && L.warn;
      for (const s of segs) {
        if (!inV((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, 500)) continue;
        if (warn) { c.strokeStyle = 'rgba(255,60,90,0.35)'; c.lineWidth = 2; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); c.setLineDash([]); continue; }
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,30,80,0.18)'; c.lineWidth = 22; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke();
        c.strokeStyle = 'rgba(255,50,100,0.5)'; c.lineWidth = 8; c.stroke();
        c.strokeStyle = '#fff0f4'; c.lineWidth = 2.5; c.stroke();
        this.gl(c, '#ff3d6a', s[2], s[3], 16, 0.8);
        c.globalCompositeOperation = 'source-over';
      }
      if (L.k === 'rot') { c.fillStyle = '#1a0610'; c.beginPath(); c.arc(L.x, L.y, 12, 0, 6.28); c.fill(); c.strokeStyle = '#ff3d55'; c.lineWidth = 3; c.stroke(); this.gl(c, '#ff3d55', L.x, L.y, 24, 0.6); }
    }
    // телеграфы
    for (const t of this.tele) { const f = t.t / t.dur; c.strokeStyle = t.col; if (t.k === 'line') { c.lineWidth = t.w * (t.dmg ? f : 1); c.globalAlpha = t.dmg ? 0.15 + f * 0.35 : 0.2; c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(t.x2, t.y2); c.stroke(); c.globalAlpha = 0.8; c.lineWidth = 1; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]); } else { c.globalAlpha = 0.7; c.lineWidth = 2; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 6.28); c.stroke(); c.fillStyle = t.col; c.globalAlpha = 0.12 + f * 0.3; c.beginPath(); c.arc(t.x, t.y, t.r * f, 0, 6.28); c.fill(); } c.globalAlpha = 1; }
    // подбираемое
    for (const k of this.pick) {
      if (!inV(k.x, k.y)) continue;
      if (k.k === 'core') {
        const s = 10 + Math.sin(T * 4 + k.t) * 2, bob = Math.sin(T * 3 + k.t) * 4;
        c.fillStyle = 'rgba(0,240,255,0.15)'; c.beginPath(); c.ellipse(k.x, k.y + 14, 12, 4, 0, 0, 6.28); c.fill();
        c.globalCompositeOperation = 'lighter'; this.gl(c, '#00f0ff', k.x, k.y + bob, 34, 0.7); c.globalCompositeOperation = 'source-over';
        c.save(); c.translate(k.x, k.y + bob); c.rotate(T * 1.5);
        c.fillStyle = '#00d8ff'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, 0); c.lineTo(0, s); c.lineTo(-s * 0.7, 0); c.closePath(); c.fill();
        c.fillStyle = '#b8fbff'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, 0); c.lineTo(0, 0); c.closePath(); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); c.restore();
      } else if (k.k === 'coin') { c.globalCompositeOperation = 'lighter'; this.gl(c, '#ffb020', k.x, k.y, 12, 0.5); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#ffd23d'; c.beginPath(); c.arc(k.x, k.y, 4 + Math.min(3, k.v), 0, 6.28); c.fill(); c.fillStyle = '#fff6c0'; c.fillRect(k.x - 1.5, k.y - 3, 3, 3); }
      else { const bob = Math.sin(T * 3 + k.t) * 3; c.globalCompositeOperation = 'lighter'; this.gl(c, '#3dffa0', k.x, k.y + bob, 26, 0.5); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#3dffa0'; c.fillRect(k.x - 3.5, k.y - 10 + bob, 7, 20); c.fillRect(k.x - 10, k.y - 3.5 + bob, 20, 7); c.fillStyle = '#d8ffe8'; c.fillRect(k.x - 1.5, k.y - 8 + bob, 3, 16); }
    }
    // чёрные дыры
    for (const h of this.holes) { const g = c.createRadialGradient(h.x, h.y, 4, h.x, h.y, 110); g.addColorStop(0, '#000'); g.addColorStop(0.35, 'rgba(255,61,127,0.55)'); g.addColorStop(1, 'rgba(255,61,127,0)'); c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, 110, 0, 6.28); c.fill(); c.strokeStyle = '#ff3d7f'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(h.x, h.y, 24 + i * 16, T * (5 - i) + i, T * (5 - i) + i + 3.5); c.stroke(); } }
    // враги
    for (const e of this.enemies) {
      if (!inV(e.x, e.y)) continue;
      const inBush = lv.bush[Math.floor(e.y / TS) * lv.W + Math.floor(e.x / TS)];
      if (inBush && Math.hypot(e.x - p.x, e.y - p.y) > 150) continue;
      this.drawEnemy(c, e, T, hi);
    }
    if (this.boss) this.drawBoss(c, this.boss, T, hi);
    // игрок
    if (this.state !== 'dying') this.drawPlayer(c, T, hi);
    // снаряды
    c.globalCompositeOperation = 'lighter';
    for (const b of this.pb) { this.gl(c, b.col, b.x, b.y, b.r * 4, 0.55); c.strokeStyle = b.col; c.lineWidth = b.r * 1.6; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.035, b.y - b.vy * 0.035); c.stroke(); c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.7, 0, 6.28); c.fill(); }
    for (const b of this.eb) { this.gl(c, '#ff2850', b.x, b.y, 20, 0.7); c.fillStyle = '#ff5a78'; c.beginPath(); c.arc(b.x, b.y, b.r + 1, 0, 6.28); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r - 2.5, 0, 6.28); c.fill(); }
    for (const q of this.parts) { c.globalAlpha = 1 - q.t / q.d; c.fillStyle = q.col; if (q.ch) { c.font = '10px monospace'; c.fillText(q.ch, q.x, q.y); } else if (q.sq) c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); else { c.beginPath(); c.arc(q.x, q.y, q.s, 0, 6.28); c.fill(); } }
    c.globalAlpha = 1;
    for (const v of this.vfx) {
      const f = v.t / v.d; c.globalAlpha = 1 - f; c.strokeStyle = v.col;
      if (v.k === 'arc') { c.lineWidth = 18 * (1 - f) + 4; c.beginPath(); c.arc(v.x, v.y, v.r * (0.6 + f * 0.4), v.a - v.arc / 2, v.a + v.arc / 2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); }
      if (v.k === 'beam') { c.lineWidth = 40 * (1 - f) + 4; c.beginPath(); c.moveTo(v.x1, v.y1); c.lineTo(v.x2, v.y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 8 * (1 - f); c.stroke(); }
      if (v.k === 'ring') { c.lineWidth = 6 * (1 - f) + 1; c.beginPath(); c.arc(v.x, v.y, v.r * (0.3 + f * 0.7), 0, 6.28); c.stroke(); this.gl(c, v.col, v.x, v.y, v.r, 0.4 * (1 - f)); }
      if (v.k === 'bolt') { c.lineWidth = 3; c.beginPath(); c.moveTo(v.x1, v.y1); for (let i = 1; i < 4; i++) c.lineTo(v.x1 + (v.x2 - v.x1) * i / 4 + (Math.random() - 0.5) * 22, v.y1 + (v.y2 - v.y1) * i / 4 + (Math.random() - 0.5) * 22); c.lineTo(v.x2, v.y2); c.stroke(); }
      if (v.k === 'dome') { c.lineWidth = 3; c.globalAlpha = 0.7; c.beginPath(); c.arc(p.x, p.y, 36 + Math.sin(T * 8) * 3, 0, 6.28); c.stroke(); this.gl(c, v.col, p.x, p.y, 50, 0.25); }
    }
    c.globalAlpha = 1;
    // атмосферные частицы
    if (hi) for (const a of this.amb) { a.y -= a.v * dt / 600; if (a.y < 0) a.y += 1; const x = vx + ((a.x * vw + Math.sin(T * 0.5 + a.ph) * 20) % vw), y = vy + a.y * vh; c.globalAlpha = 0.25 + Math.sin(T * 2 + a.ph) * 0.15; c.fillStyle = edge; c.fillRect(x, y, a.s, a.s); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (this.orb) { this.gl(c, this.cs.hero.col, this.orb.x, this.orb.y, 20, 0.7); c.fillStyle = '#fff'; c.beginPath(); c.arc(this.orb.x, this.orb.y, 6, 0, 6.28); c.fill(); }
    // кусты (глитч-трава) поверх
    const tx0 = Math.max(0, Math.floor(vx / TS)), tx1 = Math.min(lv.W - 1, Math.ceil((vx + vw) / TS)), ty0 = Math.max(0, Math.floor(vy / TS)), ty1 = Math.min(lv.H - 1, Math.ceil((vy + vh) / TS));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!lv.bush[ty * lv.W + tx]) continue;
      const X = tx * TS, Y = ty * TS, near = Math.hypot(X + TS / 2 - p.x, Y + TS / 2 - p.y) < 70;
      c.globalAlpha = near ? 0.35 : 0.92;
      c.fillStyle = '#071a14'; c.fillRect(X, Y + 4, TS, TS - 4);
      const h = this.hsh(tx, ty);
      for (let i = 0; i < 7; i++) { const bx = X + 4 + ((h >> (i * 3)) & 7) * 5.5, sw2 = Math.sin(T * 2 + i + tx) * 4; c.strokeStyle = i % 3 ? '#1fd394' : '#7affd0'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx, Y + TS); c.quadraticCurveTo(bx + sw2 * 0.5, Y + TS / 2, bx + sw2, Y + 2 + (i % 3) * 5); c.stroke(); }
      if ((h + Math.floor(T * 3)) % 23 === 0) { c.fillStyle = '#c8fff0'; c.fillRect(X + (h % 40), Y + 10, 6, 2); }
    }
    c.globalAlpha = 1;
    // прицел (тач)
    for (const id in this.touches) { const o = this.touches[id]; if ((o.role === 'atk' || o.role === 'atk2' || o.role === 'sup') && Math.hypot(o.x - o.ox, o.y - o.oy) > 18) { const a = Math.atan2(o.y - o.oy, o.x - o.ox), L = o.role === 'sup' ? 260 : this.cs.range, wv = this.cs.hero.atk.t === 'wave'; const col = o.role === 'sup' ? '255,215,0' : '255,255,255'; c.fillStyle = 'rgba(' + col + ',0.16)'; c.strokeStyle = 'rgba(' + col + ',0.6)'; c.lineWidth = 2; c.save(); c.translate(p.x, p.y); c.rotate(a); c.beginPath(); if (wv) { c.moveTo(0, 0); c.arc(0, 0, L, -this.cs.hero.atk.spr / 2, this.cs.hero.atk.spr / 2); c.closePath(); } else c.rect(0, -9, L, 18); c.fill(); c.stroke(); c.restore(); } }
    // тексты
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of this.texts) { const f = t.t / 0.8, s = t.sc * (f < 0.15 ? 0.6 + f * 4 : 1); c.globalAlpha = 1 - f * f; c.font = '900 ' + Math.round(15 * s) + 'px Unbounded,sans-serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(t.s, t.x, t.y); c.fillStyle = t.col; c.fillText(t.s, t.x, t.y); }
    c.globalAlpha = 1;
    // экранный слой
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.mods.dark || this.ev.lost) { const px = (p.x - this.cam.x) * z + W / 2, py = (p.y - this.cam.y) * z + H / 2, rr = (this.rules.dark ? 150 : 230) * z; const g = c.createRadialGradient(px, py, rr * 0.3, px, py, rr * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.96)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    c.drawImage(this.vign(), 0, 0, W, H);
    if (this.hidden) { c.strokeStyle = 'rgba(61,255,160,0.35)'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); }
    if (this.slowT > 0) { c.fillStyle = 'rgba(80,120,255,0.1)'; c.fillRect(0, 0, W, H); }
    if (this.hurtFlash > 0) { c.fillStyle = 'rgba(255,0,60,' + this.hurtFlash * 0.7 + ')'; c.fillRect(0, 0, W, H); }
    if (this.glitchT > 0 || this.ev.chaos && Math.random() < 0.02) { for (let i = 0; i < 5; i++) { const y = Math.random() * H, h = 8 + Math.random() * 30; c.drawImage(this.cv, 0, y * dpr, W * dpr, h * dpr, (Math.random() - 0.5) * 34, y, W, h); } }
    if (this.isTP() && this.state === 'play') { const a = this.aimTP(), locked = Math.abs(((a - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.001, d = this.cs.range * 0.85, q = this.proj(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.1), col = locked ? '#ff3d55' : 'rgba(255,255,255,0.85)', r = locked ? 12 + Math.sin(T * 10) * 2 : 9;
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y, r, 0, 6.28); c.stroke(); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + (locked ? T * 2 : 0); c.beginPath(); c.moveTo(q.x + Math.cos(an) * (r + 3), q.y + Math.sin(an) * (r + 3)); c.lineTo(q.x + Math.cos(an) * (r + 9), q.y + Math.sin(an) * (r + 9)); c.stroke(); } c.fillStyle = col; c.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); this.hitT = (this.hitT || 0) - 1 / 60; if (this.hitT > 0) { c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(q.x + sx * 6, q.y + sy * 6); c.lineTo(q.x + sx * 13, q.y + sy * 13); c.stroke(); } }
      if (!this.touch && document.pointerLockElement !== this.cv) { c.font = '700 11px Unbounded,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText('Кликните, чтобы управлять камерой мышью', W / 2, H - 40); } }
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
  // общий рисовальщик бойца (используется и в лобби)
  paintHero(c, H, sk, x, y, r, ang, T, opt = {}) {
    const col = H.col;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 1.1, r * 0.4, 0, 0, 6.28); c.fill();
    c.globalCompositeOperation = 'lighter'; this.gl(c, col, 0, 0, r * 3.6, opt.glow || 0.35); c.globalCompositeOperation = 'source-over';
    // кольцо
    c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 2; c.setLineDash([r * 0.5, r * 0.35]); c.lineDashOffset = -T * 30;
    c.beginPath(); c.arc(0, 0, r * 1.5, 0, 6.28); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.rotate(ang);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, '#2a2a48'); g.addColorStop(1, '#05050c');
    // оружие
    c.fillStyle = '#141428'; c.fillRect(r * 0.3, -r * 0.28, r * 1.15, r * 0.56); c.fillStyle = col; c.fillRect(r * 0.5, -r * 0.12, r * 1.0, r * 0.24);
    c.globalCompositeOperation = 'lighter'; this.gl(c, col, r * 1.5, 0, r * 0.7, 0.8); c.globalCompositeOperation = 'source-over';
    c.fillStyle = g; c.strokeStyle = col; c.lineWidth = r * 0.2;
    if (sk === 'ring') { c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); }
    else { this.shape(c, sk === 'glitch' ? 'circle' : sk, r); c.fill(); c.stroke(); }
    c.globalAlpha = 0.5; c.lineWidth = 1.5; this.shape(c, sk === 'glitch' || sk === 'ring' ? 'circle' : sk, r * 0.62); c.stroke(); c.globalAlpha = 1;
    // «визор»
    c.fillStyle = col; c.beginPath(); c.ellipse(r * 0.38, 0, r * 0.22, r * 0.5, 0, 0, 6.28); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(r * 0.44, -r * 0.12, r * 0.08, r * 0.16, 0, 0, 6.28); c.fill();
    if (sk === 'glitch') { c.fillStyle = col; for (let i = 0; i < 3; i++) c.fillRect((Math.random() - 0.5) * r * 2, (Math.random() - 0.5) * r * 2, r * 0.6, r * 0.2); }
    c.restore();
  },
  drawPlayer(c, T, hi) {
    const p = this.p;
    if (p.inv > 0 && Math.floor(T * 20) % 2 && p.dashT <= 0) c.globalAlpha = 0.5;
    if (this.hidden) c.globalAlpha = 0.55;
    if (p.shield > 0) { c.strokeStyle = 'rgba(120,200,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r + 10, 0, 6.28); c.stroke(); }
    this.paintHero(c, this.cs.hero, P.cos('skin').v, p.x, p.y, p.r, p.ang, T, { glow: hi ? 0.4 : 0.25 });
    c.globalAlpha = 1;
    const w = 44, y0 = p.y - 38;
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(p.x - w / 2 - 1, y0 - 1, w + 2, 7);
    const hf = Math.max(0, p.hp / p.maxHp); c.fillStyle = hf < 0.3 ? '#ff3d55' : '#3dffa0'; c.fillRect(p.x - w / 2, y0, w * hf, 5);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(p.x - w / 2, y0, w * hf, 1.5);
    const A = this.cs.ammo, aw = (w - (A - 1) * 2) / A;
    for (let i = 0; i < A; i++) { c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(p.x - w / 2 + i * (aw + 2), y0 + 7, aw, 4); const f = i < Math.floor(p.ammo) ? 1 : i === Math.floor(p.ammo) ? p.ammoT : 0; c.fillStyle = f >= 1 ? '#ffae3d' : '#a0601a'; c.fillRect(p.x - w / 2 + i * (aw + 2), y0 + 7, aw * f, 4); }
  },
  drawEnemy(c, e, T, hi) {
    const col = e.flash > 0 ? '#ffffff' : e.fz > 0 ? '#9ff' : e.col, r = e.r;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(e.x, e.y + r * 0.9, r, r * 0.35, 0, 0, 6.28); c.fill();
    if (hi) { c.globalCompositeOperation = 'lighter'; this.gl(c, e.col, e.x, e.y, r * 2.6, 0.28); c.globalCompositeOperation = 'source-over'; }
    c.save(); c.translate(e.x, e.y);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.2); g.addColorStop(0, '#3a1030'); g.addColorStop(1, '#0a0208');
    c.strokeStyle = col; c.fillStyle = g; c.lineWidth = 2.5;
    const pa = Math.atan2(this.p.y - e.y, this.p.x - e.x);
    switch (e.type) {
      case 'bug': c.save(); c.rotate(T * 2 + e.t); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, rr = i % 2 ? r * 0.62 : r * (1 + Math.sin(T * 8 + i) * 0.08); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); break;
      case 'worm': for (let i = 3; i >= 1; i--) { c.globalAlpha = 0.4; c.beginPath(); c.arc(-Math.cos(pa) * i * 7, -Math.sin(pa) * i * 7 + Math.sin(e.t * 10 + i) * 3, r * (1 - i * 0.18), 0, 6.28); c.fill(); c.stroke(); } c.globalAlpha = 1; c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); break;
      case 'turret': c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + 0.39; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); c.save(); c.rotate(pa); c.fillStyle = '#2a0a10'; c.fillRect(0, -6, r * 1.5, 12); c.fillStyle = col; c.fillRect(r * 0.9, -4, r * 0.6, 8); c.restore(); break;
      case 'drone': c.save(); c.rotate(T * 3); c.beginPath(); c.moveTo(0, -r); c.lineTo(r, r * 0.7); c.lineTo(-r, r * 0.7); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = col; c.globalAlpha = 0.6; for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; c.beginPath(); c.arc(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 4, 0, 6.28); c.stroke(); } c.restore(); c.globalAlpha = 1; break;
      case 'guard': c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; c.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65); } c.closePath(); c.stroke(); if (e.st === 1) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(0, 0); c.lineTo(e.cx * 120, e.cy * 120); c.stroke(); c.setLineDash([]); } break;
      case 'bomber': c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill(); c.stroke(); if (e.st === 1 && Math.floor(T * 14) % 2) { c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#ff8a00'; c.beginPath(); c.arc(0, 0, 80, 0, 6.28); c.stroke(); } c.fillStyle = col; c.fillRect(-2, -r - 7, 4, 7); c.fillStyle = '#ffd23d'; c.beginPath(); c.arc(0, -r - 8, 3 + Math.random() * 2, 0, 6.28); c.fill(); break;
      case 'splitter': c.save(); c.rotate(T); c.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); c.rotate(0.78); c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); c.restore(); break;
      case 'glitch': c.fillStyle = '#ffd700'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + T * 4, rr = i % 2 ? r * 0.5 : r * 1.2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); break;
      default: c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + T; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); break;
    }
    // глаз
    if (e.type !== 'glitch') { const er = r * 0.34, ex = Math.cos(pa) * r * 0.18, ey = Math.sin(pa) * r * 0.18; c.fillStyle = '#ffe6ee'; c.beginPath(); c.arc(ex, ey, er, 0, 6.28); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(ex + Math.cos(pa) * er * 0.4, ey + Math.sin(pa) * er * 0.4, er * 0.55, 0, 6.28); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(ex + Math.cos(pa) * er * 0.5, ey + Math.sin(pa) * er * 0.5, er * 0.25, 0, 6.28); c.fill(); }
    c.restore();
    if (e.hp < e.maxHp) { c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(e.x - 17, e.y - r - 12, 34, 5); c.fillStyle = '#ff3d55'; c.fillRect(e.x - 16, e.y - r - 11, 32 * Math.max(0, e.hp / e.maxHp), 3); }
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
    DynEv.hud(this, c, W, H, T);
    // HP
    const hw = Math.min(220, W * 0.42);
    c.fillStyle = 'rgba(5,5,15,0.75)'; this.rr(c, safe, safe, hw, 46, 10); c.fill();
    c.fillStyle = '#1a1a2a'; c.fillRect(safe + 8, safe + 8, hw - 16, 12);
    c.fillStyle = p.hp / p.maxHp < 0.3 ? '#ff3d55' : '#3dffa0'; c.fillRect(safe + 8, safe + 8, (hw - 16) * Math.max(0, p.hp / p.maxHp), 12);
    if (p.shield > 0) { c.fillStyle = 'rgba(120,200,255,0.8)'; c.fillRect(safe + 8, safe + 8, Math.min(hw - 16, (hw - 16) * p.shield / p.maxHp), 4); }
    c.fillStyle = '#fff'; c.font = 'bold 10px Unbounded,sans-serif'; c.textAlign = 'left'; c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, safe + 12, safe + 14.5);
    c.fillStyle = '#00f0ff'; c.font = 'bold 12px Unbounded,sans-serif';
    c.fillText(this.boss ? '☗ БОСС' : this.ms ? '◆ ' + R.cores : '◆ ' + this.coresHave + '/' + this.need, safe + 8, safe + 34);
    c.fillStyle = '#ffd23d'; c.fillText('¤ ' + R.coins, safe + 82, safe + 34);
    c.fillStyle = '#aab'; c.font = '10px Unbounded,sans-serif'; c.textAlign = 'right';
    const tm = this.rules.timeLimit ? Math.max(0, this.rules.timeLimit - R.time) : R.time;
    c.fillText(Math.floor(tm / 60) + ':' + String(Math.floor(tm % 60)).padStart(2, '0'), safe + hw - 8, safe + 34);
    // модификаторы
    let my = safe + 58 + (this.boss && W < 560 ? 40 : 0);
    const M = this.ms; if (M && !this.boss) {
      const done = M.done, fail = M.fail, col = fail ? '#ff3d55' : done ? '#3dffa0' : '#00f0ff', f = Math.min(1, (M.prog || 0) / (M.goal || 1));
      c.fillStyle = 'rgba(5,5,15,0.78)'; this.rr(c, safe, my, hw, 52, 10); c.fill(); c.strokeStyle = col; c.globalAlpha = 0.5 + Math.sin(T * 4) * 0.2; c.lineWidth = 1.5; this.rr(c, safe, my, hw, 52, 10); c.stroke(); c.globalAlpha = 1;
      c.textAlign = 'left'; c.font = 'bold 10px Unbounded,sans-serif'; c.fillStyle = col; c.fillText((done ? '✓ ' : fail ? '✕ ' : '▸ ') + M.n, safe + 8, my + 12);
      let txt = ''; if (M.k === 'artifact' && !done) { const d = M.dist || 9999; txt = 'СИГНАЛ: ' + (d < 300 ? '█████ рядом!' : d < 600 ? '███░░ сильный' : d < 1000 ? '██░░░ средний' : '█░░░░ слабый'); } else if (M.k === 'defend' && M.gen && M.gen.on) txt = 'Генератор ' + Math.max(0, Math.ceil(M.gen.hp / M.gen.max * 100)) + '%  •  ' + Math.ceil(M.goal - M.prog) + ' с'; else if (M.k === 'defend' || M.k === 'survive') txt = (M.k === 'defend' ? (M.gen.on ? '' : 'Подойдите к генератору') : (M.bea.on ? 'Осталось ' + Math.ceil(M.goal - M.prog) + ' с' : 'Найдите маяк')); else if (M.k === 'escort') txt = 'Курьер ' + Math.max(0, Math.ceil(M.bot.hp / M.bot.max * 100)) + '%  ' + (M.bot.moving ? '▶ идёт' : '■ ждёт вас'); else if (M.k === 'escape') txt = M.t > M.goal ? 'ВРЕМЯ ВЫШЛО — уходите!' : 'Осталось ' + Math.ceil(M.goal - M.t) + ' с'; else txt = Math.floor(M.prog || 0) + ' / ' + M.goal;
      if (done) txt = 'Портал открыт'; if (fail) txt = 'Провалено';
      c.font = '10px Manrope,sans-serif'; c.fillStyle = '#dde'; c.fillText(txt, safe + 8, my + 26);
      c.fillStyle = '#1a1a2a'; c.fillRect(safe + 8, my + 34, hw - 16, 4); c.fillStyle = col; c.fillRect(safe + 8, my + 34, (hw - 16) * (M.k === 'escape' ? 1 - f : f), 4);
      const so = M.side[0] === 'nohit' ? this.secDmg === 0 : M.side[0] === 'fast' ? this.secTime < 90 : M.side[0] === 'combo' ? (this.secCombo || 0) >= 15 : this.chests.every(q => q.open);
      c.font = '9px Manrope,sans-serif'; c.fillStyle = so ? '#ffd23d' : '#8889a0'; c.fillText((so ? '★ ' : '☆ ') + 'Бонус: ' + M.side[1], safe + 8, my + 46);
      my += 58;
    }
    c.textAlign = 'left'; c.font = '10px Manrope,sans-serif';
    const tags = Object.keys(this.mods).map(k => D.MODS.find(m => m.id === k).n); if (this.activeEvent) tags.unshift('⚠ ' + D.EVM[this.activeEvent].n);
    tags.forEach(t => { c.fillStyle = 'rgba(5,5,15,0.6)'; const tw = c.measureText(t).width + 12; this.rr(c, safe, my, tw, 18, 6); c.fill(); c.fillStyle = t[0] === '⚠' ? '#ffb020' : '#b9a6ff'; c.fillText(t, safe + 6, my + 9); my += 21; });
    // комбо
    if (R.combo >= 3) { c.textAlign = 'center'; const s = 1 + Math.min(0.5, R.combo / 60); c.font = 'bold ' + Math.round(22 * s) + 'px Unbounded,sans-serif'; c.fillStyle = 'hsl(' + (300 - Math.min(R.combo, 50) * 3) + ',100%,65%)'; const cy0 = this.boss ? (W < 560 ? 116 : 70) : (W < 560 ? 76 : 30); c.fillText('×' + R.combo, W / 2, cy0); c.font = '9px Unbounded,sans-serif'; c.fillStyle = '#fff'; c.fillText('КОМБО', W / 2, cy0 + 18); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(W / 2 - 30, cy0 + 27, 60 * Math.max(0, R.comboT / cs.combo), 2); }
    // босс
    if (this.boss) { const b = this.boss, nar = W < 560, bw = nar ? W - 20 : Math.min(W - 140, 440), by = nar ? 62 : 12; c.fillStyle = 'rgba(5,5,15,0.8)'; this.rr(c, W / 2 - bw / 2, by, bw, 30, 8); c.fill(); c.fillStyle = b.col; c.fillRect(W / 2 - bw / 2 + 6, by + 18, (bw - 12) * Math.max(0, b.hp / b.maxHp), 7); c.strokeStyle = 'rgba(255,255,255,0.3)'; [0.33, 0.66].forEach(f => { c.beginPath(); c.moveTo(W / 2 - bw / 2 + 6 + (bw - 12) * f, by + 16); c.lineTo(W / 2 - bw / 2 + 6 + (bw - 12) * f, by + 27); c.stroke(); }); c.fillStyle = '#fff'; c.font = 'bold 10px Unbounded,sans-serif'; c.textAlign = 'center'; c.fillText(b.n + ' • ФАЗА ' + b.phase, W / 2, by + 8); }
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
    if (this.ms && this.ms.tgt && !this.ms.done && !this.ms.fail) tg = this.ms.tgt; else if (this.ms && this.ms.k === 'hack' && !this.ms.done) { let bd = 1e12; for (const q of this.lv.terms) if (!q.done) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; tg = q; } } } else if (this.portalOpen) tg = this.lv.portal; else if (!this.boss) { let bd = 1e12; for (const q of this.pick) if (q.k === 'core') { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; tg = q; } } }
    if (tg) { const pq = this.proj(tg.x, tg.y), sx = pq.x, sy = pq.y; if (sx < 20 || sy < 20 || sx > W - 20 || sy > H - 20) { const a = Math.atan2(sy - H / 2, sx - W / 2), rx = W / 2 - 40, ry = H / 2 - 60, t = Math.min(Math.abs(rx / Math.cos(a)), Math.abs(ry / Math.sin(a))); c.save(); c.translate(W / 2 + Math.cos(a) * t, H / 2 + Math.sin(a) * t); c.rotate(a); c.fillStyle = this.portalOpen ? '#3dffa0' : '#00f0ff'; c.globalAlpha = 0.6 + Math.sin(T * 6) * 0.3; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-4, 0); c.lineTo(-8, 10); c.closePath(); c.fill(); c.restore(); } }
    // баннер
    if (this.bn) { const b = this.bn; b.t += 1 / 60; const f = b.t < 0.25 ? b.t / 0.25 : b.t > 2.2 ? Math.max(0, 1 - (b.t - 2.2) / 0.4) : 1; if (b.t > 2.6) this.bn = null; else { c.globalAlpha = f; c.textAlign = 'center'; const y = H * 0.3; if (b.sub) { c.font = 'bold 11px Unbounded,sans-serif'; c.fillStyle = '#aab'; c.fillText(b.sub, W / 2, y - 26); } c.font = '900 ' + Math.min(34, W / 12) + 'px Unbounded,sans-serif'; c.fillStyle = b.col; this.glow(c, b.col, 20); c.fillText(b.s, W / 2 + (1 - f) * 40, y); this.glow(c, 0, 0); if (b.d2) { c.font = '12px Manrope,sans-serif'; c.fillStyle = '#dde'; c.fillText(b.d2, W / 2, y + 28); } c.globalAlpha = 1; } }
    // реликвии и бонусы
    { const rel = [...R.rel], ms2 = Math.min(110, W * 0.26), sz = 24, per = Math.max(1, Math.floor((ms2 + 8) / (sz + 4))); let ry = (this.ev.lost || this.rules.noMap || this.lv.arena) ? (this.boss && W < 560 ? 100 : safe + 44) : safe + 44 + ms2 + 14;
      rel.forEach((id, i) => { const r = D.RELM[id], col = D.RRAR[r.r][1], x = W - safe - (i % per + 1) * (sz + 4) + 4, y = ry + Math.floor(i / per) * (sz + 4); c.fillStyle = 'rgba(5,5,15,0.8)'; this.rr(c, x, y, sz, sz, 6); c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; this.rr(c, x, y, sz, sz, 6); c.stroke(); c.fillStyle = col; c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText(r.ic, x + sz / 2, y + sz / 2 + 1); });
      if (R.syn.size) { c.font = 'bold 8px Unbounded,sans-serif'; c.fillStyle = '#ff3dc8'; c.textAlign = 'right'; c.fillText('СИНЕРГИИ: ' + R.syn.size, W - safe, ry + Math.ceil(rel.length / per) * (sz + 4) + 8); }
      const pw = Object.keys(this.pows).filter(k => this.pows[k] > 0 && k !== 'heal'); let px0 = W / 2 - pw.length * 22, py0 = (W < 560 ? (this.boss ? 112 : 72) : (this.boss ? 52 : 0)) + (R.combo >= 3 ? 70 : 46) - (W < 560 && R.combo < 3 ? 0 : 0);
      pw.forEach((k, i) => { const P0 = D.POWS[k], f = this.pows[k] / P0.d, x = px0 + i * 44 + 22, y = py0; c.fillStyle = 'rgba(5,5,15,0.8)'; c.beginPath(); c.arc(x, y, 17, 0, 6.28); c.fill(); c.strokeStyle = P0.col; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + f * 6.28); c.stroke(); c.fillStyle = P0.col; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText(P0.ic, x, y + 1); if (f < 0.25 && Math.floor(T * 8) % 2) { c.globalAlpha = 0.4; c.beginPath(); c.arc(x, y, 17, 0, 6.28); c.fill(); c.globalAlpha = 1; } });
      const RC = this.relCard; if (RC) { const r = D.RELM[RC.id], col = D.RRAR[r.r][1], t = RC.t, a = t < 0.3 ? t / 0.3 : t > 2.7 ? Math.max(0, (3.2 - t) / 0.5) : 1, sc = t < 0.3 ? 0.6 + 0.4 * (t / 0.3) + Math.sin(t / 0.3 * Math.PI) * 0.12 : 1, cw = Math.min(300, W - 40), ch = 132, cx = W / 2, cy = H * 0.62;
        c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(sc, sc); this.glow(c, col, 30); c.fillStyle = 'rgba(8,6,20,0.94)'; this.rr(c, -cw / 2, -ch / 2, cw, ch, 14); c.fill(); this.glow(c, 0, 0); c.strokeStyle = col; c.lineWidth = 2; this.rr(c, -cw / 2, -ch / 2, cw, ch, 14); c.stroke();
        c.save(); c.beginPath(); this.rr(c, -cw / 2, -ch / 2, cw, ch, 14); c.clip(); const sx = ((t * 1.2) % 1.6 - 0.3) * cw * 1.4 - cw / 2; const gr = c.createLinearGradient(sx - 40, 0, sx + 40, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(-cw / 2, -ch / 2, cw, ch); c.restore();
        c.textAlign = 'center'; c.font = 'bold 9px Unbounded,sans-serif'; c.fillStyle = col; c.fillText('НОВАЯ РЕЛИКВИЯ • ' + D.RRAR[r.r][0].toUpperCase(), 0, -ch / 2 + 18);
        c.font = '34px sans-serif'; this.glow(c, col, 20); c.fillStyle = col; c.fillText(r.ic, 0, -14); this.glow(c, 0, 0);
        c.font = '900 15px Unbounded,sans-serif'; c.fillStyle = '#fff'; c.fillText(r.n, 0, 22); c.font = '11px Manrope,sans-serif'; c.fillStyle = '#c9c6e6'; c.fillText(r.d, 0, 42); c.restore(); } }
    if (this.intro) { const I = this.intro, f = Math.min(1, I.t / 0.4), o = I.t > I.d - 0.5 ? Math.max(0, (I.d - I.t) / 0.5) : 1, bh = H * 0.13 * f * o;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
      if (I.t > 0.5) { const a = Math.min(1, (I.t - 0.5) / 0.4) * o, sl = (1 - Math.min(1, (I.t - 0.5) / 0.4)) * 80; c.globalAlpha = a; c.textAlign = 'center';
        c.font = 'bold 11px Unbounded,sans-serif'; c.fillStyle = '#ff3d55'; c.fillText('⚠ УГРОЗА УРОВНЯ ОМЕГА ⚠', W / 2, H * 0.62);
        c.font = '900 ' + Math.min(52, W / 8) + 'px Unbounded,sans-serif'; this.glow(c, I.col, 30); c.fillStyle = I.col; c.fillText(I.n, W / 2 - sl, H * 0.62 + 46); this.glow(c, 0, 0);
        c.fillStyle = '#fff'; c.font = 'italic 13px Manrope,sans-serif'; c.fillText('«' + I.sub + '»', W / 2 + sl, H * 0.62 + 74);
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '11px Manrope,sans-serif'; c.fillText(I.desc, W / 2, H - bh - 14);
        c.fillStyle = I.col; c.fillRect(W / 2 - 120 * a, H * 0.62 + 86, 240 * a, 2); c.globalAlpha = 1; } }
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
  rr(c, x, y, w, h, r) { r = Math.min(r, h / 2); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - r); c.lineTo(x + w - r, y + h); c.lineTo(x, y + h); c.lineTo(x, y + r); c.closePath(); }
};
