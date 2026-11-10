'use strict';
/* ===== Enemy System: обычные враги и боссы ===== */
const Enemies = {
  make(G, type, x, y, diff, elite) {
    const d = D.EN[type], ev = G.ev;
    let hp = d.hp * (1 + 0.13 * (diff - 1)) * (G.mods.armored ? 1.35 : 1) * (ev.giant ? 1.6 : 1);
    const e = {
      type, x, y, r: d.r * (ev.giant ? 1.35 : 1), hp, maxHp: hp, spd: d.spd * (1 + Math.min(0.5, diff * 0.015)) * (G.mods.fast ? 1.2 : 1) * (ev.chaos ? 1.3 : 1),
      dmg: d.dmg * (1 + 0.06 * (diff - 1)), col: d.col, ai: d.ai, t: Math.random() * 5, cd: 1 + Math.random() * 2,
      aggro: false, hitCd: 0, fz: 0, burn: 0, st: 0, vx: 0, vy: 0, flash: 0, life: type === 'glitch' ? 30 : 0
    };
    if (elite) { e.elite = true; e.hp = e.maxHp = hp * (3 + Math.min(2, diff * 0.15)); e.r *= 1.4; e.dmg *= 1.5; e.spd *= 1.1; e.aggro = true; }
    return e;
  },
  update(G, e, dt) {
    const p = G.p, slow = (G.slowT > 0 ? 0.35 : 1) * (G.ev.slowmo ? 0.7 : 1) * (e.fz > 0 ? 0.35 : 1);
    const rdist = Math.hypot(p.x - e.x, p.y - e.y) || 1, hid = G.hidden && rdist > 120;
    if (!hid) { e.lsx = p.x; e.lsy = p.y; }
    let gx = hid ? (e.lsx !== undefined ? e.lsx : e.x) : p.x, gy = hid ? (e.lsy !== undefined ? e.lsy : e.y) : p.y;
    if (e.tgt && e.tgt.hp > 0 && rdist > 140) { gx = e.tgt.x; gy = e.tgt.y; }
    const dx = gx - e.x, dy = gy - e.y, dist = hid ? Math.max(500, Math.hypot(dx, dy)) : rdist, md = Math.hypot(dx, dy) || 1, nx = dx / md, ny = dy / md;
    e.t += dt; e.cd -= dt * slow; e.hitCd -= dt; e.fz -= dt; e.flash -= dt; e.shd = Math.max(0, (e.shd || 0) - dt);
    if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; G.hurtEnemy(e, e.burnDmg, { noFx: true }); if (e.dead) return; } }
    if (G.mods.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
    if (!e.aggro) { if ((rdist < 400 && !hid) || e.hp < e.maxHp) e.aggro = true; else return; }
    if (hid && md < 20) { e.t += dt; return; }
    if (e.orbit) { if (e.orbit !== G.boss) { e.orbit = null; } else { if (e.cd <= 0) { e.cd = 2.4 + Math.random(); G.ebullet(e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), 230, e.dmg); } return; } }
    let mx = 0, my = 0, sp = e.spd * slow;
    switch (e.ai) {
      case 'chase': mx = nx; my = ny; break;
      case 'zig': { const s = Math.sin(e.t * 6); mx = nx - ny * s; my = ny + nx * s; break; }
      case 'turret':
        if (e.cd <= 0 && dist < 480) { e.cd = 1.7; G.ebullet(e.x, e.y, Math.atan2(dy, dx), 250, e.dmg); if (G.diff > 6) { G.ebullet(e.x, e.y, Math.atan2(dy, dx) + 0.25, 250, e.dmg); G.ebullet(e.x, e.y, Math.atan2(dy, dx) - 0.25, 250, e.dmg); } }
        break;
      case 'kite':
        if (dist < 200) { mx = -nx; my = -ny; } else if (dist > 300) { mx = nx; my = ny; } else { mx = -ny * 0.7; my = nx * 0.7; }
        if (e.cd <= 0 && dist < 460) { e.cd = 2.2; const a = Math.atan2(dy, dx); [-0.2, 0, 0.2].forEach(o => G.ebullet(e.x, e.y, a + o, 230, e.dmg)); }
        break;
      case 'charge':
        if (e.st === 0) { mx = nx; my = ny; if (dist < 280 && e.cd <= 0) { e.st = 1; e.stT = 0.55; e.cx = nx; e.cy = ny; } }
        else if (e.st === 1) { e.stT -= dt; if (e.stT <= 0) { e.st = 2; e.stT = 0.5; } }
        else { mx = e.cx; my = e.cy; sp = 430 * slow; e.stT -= dt; if (e.stT <= 0) { e.st = 0; e.cd = 2; } }
        break;
      case 'bomb':
        if (e.st === 0) { mx = nx; my = ny; if (rdist < 55) { e.st = 1; e.stT = 0.6; } }
        else { e.stT -= dt; if (e.stT <= 0) { G.explode(e.x, e.y, 80, e.dmg, true); e.hp = 0; G.killEnemy(e, true); return; } }
        break;
      case 'hunter': // кружит, затем делает выпад
        if (e.st === 0) { const s = dist < 190 ? 1 : 0; mx = nx * (1 - s) - ny * s; my = ny * (1 - s) + nx * s; sp *= 1.1; if (dist < 230 && e.cd <= 0) { e.st = 1; e.stT = 0.35; e.cx = nx; e.cy = ny; } }
        else if (e.st === 1) { e.stT -= dt; if (e.stT <= 0) { e.st = 2; e.stT = 0.32; } }
        else { mx = e.cx; my = e.cy; sp = 560 * slow; e.stT -= dt; if (e.stT <= 0) { e.st = 0; e.cd = 1.6 + Math.random(); } }
        break;
      case 'sniper': // держит дистанцию, прицеливается лучом
        if (e.st === 0) { if (dist < 330) { mx = -nx; my = -ny; } else if (dist > 470) { mx = nx; my = ny; } else { mx = -ny * 0.4; my = nx * 0.4; }
          if (e.cd <= 0 && dist < 560 && !hid) { e.st = 1; e.stT = 1.0; e.aa = Math.atan2(dy, dx); G.tele.push({ k: 'line', x1: e.x, y1: e.y, x2: e.x + Math.cos(e.aa) * 700, y2: e.y + Math.sin(e.aa) * 700, w: 10, t: 0, dur: 1.0, col: '#ff2a2a', dmg: 0, ally: true }); } }
        else { e.stT -= dt; if (e.stT <= 0) { e.st = 0; e.cd = 3; for (let k = 0; k < 3; k++) G.ebullet(e.x, e.y, e.aa + (k - 1) * 0.02, 620, e.dmg); } }
        break;
      case 'tank': // медленный, бьёт ударной волной
        mx = nx; my = ny;
        if (e.cd <= 0 && dist < 200) { e.cd = 3.2; G.tele.push({ k: 'circle', x: e.x, y: e.y, r: 130, t: 0, dur: 0.9, col: '#c86bff', dmg: e.dmg }); G.shake(2); }
        break;
      case 'healer': { // держится за союзниками, чинит их
        let best = null, bd = 1e9; for (const o of G.enemies) if (o !== e && !o.dead && o.hp < o.maxHp) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
        if (best && bd > 90) { mx = best.x - e.x; my = best.y - e.y; } else if (dist < 260) { mx = -nx; my = -ny; }
        if (best && bd < 160 && e.cd <= 0) { e.cd = 1.6; best.hp = Math.min(best.maxHp, best.hp + best.maxHp * 0.18); G.vfx.push({ k: 'beam', x1: e.x, y1: e.y, x2: best.x, y2: best.y, t: 0, d: 0.35, col: '#3dffb0' }); G.floatText(best.x, best.y - 20, '+', '#3dffb0'); }
        break; }
      case 'shielder': { // прикрывает союзников щитом
        let cx = 0, cy = 0, n = 0; for (const o of G.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 300) { cx += o.x; cy += o.y; n++; if (Math.hypot(o.x - e.x, o.y - e.y) < 140) o.shd = 0.3; }
        if (n) { cx /= n; cy /= n; mx = (cx + (p.x - cx) * 0.3) - e.x; my = (cy + (p.y - cy) * 0.3) - e.y; if (Math.hypot(mx, my) < 20) { mx = 0; my = 0; } } else { mx = nx; my = ny; }
        break; }
      case 'miner': // бегает рядом и минирует путь
        { const s = Math.sin(e.t * 1.5); mx = nx * 0.5 - ny * s; my = ny * 0.5 + nx * s; }
        if (e.cd <= 0) { e.cd = 2.2; G.tele.push({ k: 'circle', x: e.x, y: e.y, r: 55, t: 0, dur: 2.0, col: '#ffcc33', dmg: e.dmg }); }
        break;
      case 'flee':
        mx = -nx + Math.sin(e.t * 2) * 0.6; my = -ny + Math.cos(e.t * 2.3) * 0.6; e.life -= dt;
        if (e.life <= 0) { e.dead = true; G.floatText(e.x, e.y, 'Глюк сбежал...', '#ffd700'); }
        break;
    }
    // разделение врагов
    if (G.frame % 3 === 0) for (const o of G.enemies) {
      if (o === e) continue; const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy, rr = (e.r + o.r);
      if (od < rr * rr && od > 0.1) { const k = (rr - Math.sqrt(od)) / rr; e.x += ox * k * 0.3; e.y += oy * k * 0.3; }
    }
    const ml = Math.hypot(mx, my); if (ml > 0) { e.x += mx / ml * sp * dt; e.y += my / ml * sp * dt; }
    G.collide(e);
    if (e.dmg > 0 && e.ai !== 'bomb' && rdist < e.r + p.r && e.hitCd <= 0) {
      e.hitCd = 0.7; G.hurtPlayer(e.dmg, e);
    }
  },

  /* ===== Боссы ===== */
  boss(G, id, x, y, diff) {
    const B = D.BOSSM[id], hp = B.hp * (1 + 0.12 * Math.max(0, diff - 5));
    const b = { id, n: B.n, x, y, r: B.r, hp, maxHp: hp, col: B.col, phase: 1, t: 0, cd: 2, cd2: 3, cd3: 4, a: 0, st: 0, flash: 0, segs: [], hist: [], dmgMul: 1 + 0.05 * Math.max(0, diff - 5), clones: false, pat: 0 };
    if (id === 'serpent') { for (let i = 0; i < 16; i++) b.segs.push({ x, y: y + i * 20, r: 20 - i * 0.6 }); }
    return b;
  },
  bossUpdate(G, b, dt) {
    const p = G.p, slow = G.slowT > 0 ? 0.45 : 1, dmt = dt * slow;
    b.t += dmt; b.cd -= dmt; b.cd2 -= dmt; b.cd3 -= dmt; b.flash -= dt;
    const fr = b.hp / b.maxHp, ph = fr < 0.33 ? 3 : fr < 0.66 ? 2 : 1;
    if (ph !== b.phase) { b.phase = ph; G.banner('ФАЗА ' + ph, b.col); G.shake(14); SFX.play('boss'); G.burst(b.x, b.y, b.col, 50, 400); b.cd = 1; }
    const dx = p.x - b.x, dy = p.y - b.y, dist = Math.hypot(dx, dy) || 1, aim = Math.atan2(dy, dx);
    const dm = 12 * b.dmgMul;
    const ring = (n, sp, off = 0) => { for (let i = 0; i < n; i++) G.ebullet(b.x, b.y, off + i / n * Math.PI * 2, sp, dm); };
    const fan = (n, s, sp) => { for (let i = 0; i < n; i++) G.ebullet(b.x, b.y, aim + (i - (n - 1) / 2) * s, sp, dm); };
    const beam = (a, w = 22, delay = 0.9) => G.tele.push({ k: 'line', x1: b.x, y1: b.y, x2: b.x + Math.cos(a) * 1300, y2: b.y + Math.sin(a) * 1300, w, t: 0, dur: delay, dmg: dm * 2.4, col: b.col });
    const zone = (x, y, r = 70) => G.tele.push({ k: 'circle', x, y, r, t: 0, dur: 1.0, dmg: dm * 2, col: b.col });
    const moveTo = (tx, ty, sp) => { const ddx = tx - b.x, ddy = ty - b.y, d = Math.hypot(ddx, ddy); if (d > 4) { b.x += ddx / d * sp * dmt; b.y += ddy / d * sp * dmt; } };
    const C = { x: G.lv.W / 2 * TS, y: G.lv.H / 2 * TS };
    const lasers = (n, len, sp) => { b.a += sp * dmt; b.las = []; for (let i = 0; i < n; i++) { const a = b.a + i / n * Math.PI * 2; b.las.push([b.x, b.y, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len]); } };
    b.las = null;
    switch (b.id) {
      case 'firewall':
        moveTo(C.x, C.y, 60);
        if (ph >= 2) lasers(ph === 3 ? 4 : 2, 560, ph === 3 ? 0.75 : 0.55);
        if (b.cd <= 0) { b.cd = ph === 1 ? 1.6 : ph === 2 ? 1.3 : 1.0; ring(14 + ph * 2, 210 + ph * 20, b.t); }
        if (b.cd2 <= 0) { b.cd2 = 3; fan(3, 0.18, 320); }
        if (ph === 3 && b.cd3 <= 0) { b.cd3 = 6; G.spawnEnemy('bug', b.x + 80, b.y); G.spawnEnemy('bug', b.x - 80, b.y); }
        break;
      case 'serpent': {
        const sp = (ph === 1 ? 170 : ph === 2 ? 225 : 275) * slow;
        b.a = b.a || 0; let ta = aim, da = ((ta - b.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b.a += Math.max(-2.4 * dmt, Math.min(2.4 * dmt, da));
        b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
        b.x = Math.max(3 * TS, Math.min((G.lv.W - 3) * TS, b.x)); b.y = Math.max(3 * TS, Math.min((G.lv.H - 3) * TS, b.y));
        b.hist.unshift({ x: b.x, y: b.y }); if (b.hist.length > 400) b.hist.pop();
        b.segs.forEach((s, i) => { const h = b.hist[Math.min(b.hist.length - 1, (i + 1) * 5)]; if (h) { s.x = h.x; s.y = h.y; } });
        if (ph >= 2 && b.cd <= 0) { b.cd = 1.4; const tl = b.segs[b.segs.length - 1]; zone(tl.x, tl.y, 55); }
        if (ph === 3 && b.cd2 <= 0) { b.cd2 = 2.2; b.segs.forEach((s, i) => { if (i % 3 === 0) { G.ebullet(s.x, s.y, b.a + Math.PI / 2, 200, dm); G.ebullet(s.x, s.y, b.a - Math.PI / 2, 200, dm); } }); }
        if (ph === 1 && b.cd2 <= 0) { b.cd2 = 2.5; fan(3, 0.25, 280); }
        for (const s of b.segs) if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + p.r) { G.hurtPlayer(dm, null); break; }
        break;
      }
      case 'overclock':
        if (ph === 3 && !b.clones) { b.clones = true; for (let i = 0; i < 2; i++) { const e = G.spawnEnemy('guard', b.x + (i ? 90 : -90), b.y); e.hp = e.maxHp = 400; e.col = '#ffb020'; } }
        if (b.st === 0) { moveTo(p.x, p.y, 110); if (b.cd <= 0) { b.st = 1; b.stT = 0.65; b.da = aim; G.tele.push({ k: 'line', x1: b.x, y1: b.y, x2: b.x + Math.cos(aim) * 520, y2: b.y + Math.sin(aim) * 520, w: b.r * 2, t: 0, dur: 0.65, dmg: 0, col: b.col }); } }
        else if (b.st === 1) { b.stT -= dmt; if (b.stT <= 0) { b.st = 2; b.stT = 0.55; SFX.play('dash'); } }
        else {
          b.x += Math.cos(b.da) * 950 * dt * slow; b.y += Math.sin(b.da) * 950 * dt * slow; b.stT -= dmt;
          const hit = G.collide(b); G.trailP(b.x, b.y, b.col);
          if (dist < b.r + p.r) G.hurtPlayer(dm * 1.8, null);
          if (b.stT <= 0 || hit) { b.st = 0; b.cd = ph === 3 ? 1.5 : ph === 2 ? 2 : 2.5; if (ph >= 2) ring(10, 260, b.da); G.shake(6); }
        }
        if (b.cd2 <= 0 && b.st === 0) { b.cd2 = 2.8; fan(5, 0.16, 300); }
        break;
      case 'eye':
        moveTo(C.x + Math.cos(b.t * 0.4) * 220, C.y + Math.sin(b.t * 0.55) * 160, 80);
        if (b.cd <= 0) { b.cd = ph === 1 ? 2.6 : 2.2; if (ph === 1) beam(aim); else [-0.35, 0, 0.35].forEach(o => beam(aim + o)); }
        if (ph === 3) { if (b.cd2 <= 0) { b.cd2 = 3; for (let i = 0; i < 3; i++) zone(p.x + (Math.random() - 0.5) * 160, p.y + (Math.random() - 0.5) * 160); } if (b.cd3 <= 0) { b.cd3 = 0.13; b.a += 0.37; G.ebullet(b.x, b.y, b.a, 180, dm * 0.7); } }
        else if (b.cd2 <= 0) { b.cd2 = 2; ring(8, 170, b.t); }
        break;
      case 'crusher': { // пресс-гигант
        if (b.st === 0) { moveTo(p.x, p.y, 55 + ph * 12);
          if (b.cd <= 0) { b.cd = ph === 3 ? 2.2 : 3; G.tele.push({ k: 'circle', x: b.x, y: b.y, r: 160, t: 0, dur: 1.0, dmg: dm * 2.2, col: b.col }); b.st = 1; b.stT = 1.0; }
          if (b.cd2 <= 0) { b.cd2 = ph === 1 ? 3.5 : 2.4; const n = 3 + ph * 2; for (let i = 0; i < n; i++) zone(p.x + (Math.random() - 0.5) * 300, p.y + (Math.random() - 0.5) * 300, 50); }
          if (ph >= 2 && b.cd3 <= 0) { b.cd3 = 4; b.st = 3; b.stT = 0.6; b.da = aim; G.tele.push({ k: 'line', x1: b.x, y1: b.y, x2: b.x + Math.cos(aim) * 600, y2: b.y + Math.sin(aim) * 600, w: b.r * 2, t: 0, dur: 0.6, dmg: 0, col: b.col, ally: true }); } }
        else if (b.st === 1) { b.stT -= dmt; b.squash = 1 - b.stT; if (b.stT <= 0) { b.st = 0; b.squash = 0; G.shake(16); G.burst(b.x, b.y, b.col, 50, 420); if (ph >= 2) ring(16, 240, b.t); } }
        else if (b.st === 3) { b.stT -= dmt; if (b.stT <= 0) { b.st = 4; b.stT = 0.5; SFX.play('dash'); } }
        else { b.x += Math.cos(b.da) * 820 * dt * slow; b.y += Math.sin(b.da) * 820 * dt * slow; b.stT -= dmt; const hit = G.collide(b); G.trailP(b.x, b.y, b.col); if (dist < b.r + p.r) G.hurtPlayer(dm * 1.6, null); if (b.stT <= 0 || hit) { b.st = 0; G.shake(8); ring(10, 220, b.da); } }
        if (ph === 3 && !b.adds) { b.adds = true; for (let i = 0; i < 3; i++) G.spawnEnemy('miner', b.x + (i - 1) * 90, b.y + 60).aggro = true; }
        G.beltMul = ph === 3 ? 2.2 : ph === 2 ? 1.5 : 1;
        break; }
      case 'cryo': { // королева льда
        moveTo(C.x + Math.cos(b.t * 0.5) * 170, C.y + Math.sin(b.t * 0.5) * 170, 90);
        if (dist < 210) G.p.chill = 0.3;
        if (b.cd <= 0) { b.cd = ph === 3 ? 1.8 : 2.6; const n = ph === 1 ? 5 : 8; for (let i = 0; i < n; i++) beam(aim + i / n * Math.PI * 2, 18, 1.0); }
        if (b.cd2 <= 0) { b.cd2 = ph === 1 ? 2.2 : 1.4; fan(ph + 2, 0.22, 240); }
        if (ph >= 2 && b.cd3 <= 0) { b.cd3 = 7; for (let i = 0; i < 2; i++) { const e = G.spawnEnemy('shielder', b.x + (i ? 70 : -70), b.y); e.col = '#9fe8ff'; e.aggro = true; } }
        if (ph === 3) { b.sp2 = (b.sp2 || 0) - dmt; if (b.sp2 <= 0) { b.sp2 = 0.09; b.a += 0.41; G.ebullet(b.x, b.y, b.a, 150, dm * 0.6); G.ebullet(b.x, b.y, b.a + Math.PI, 150, dm * 0.6); } }
        break; }
      case 'hive': { // матка дронов с щитом из роя
        b.orb = (b.orb || []).filter(e => !e.dead);
        if (!b.orbInit || (b.orb.length === 0 && b.cd3 <= 0)) { b.orbInit = true; b.cd3 = 12; for (let i = 0; i < 4 + ph * 2; i++) { const e = G.spawnEnemy('drone', b.x, b.y); e.orbit = b; e.oi = i; e.aggro = true; e.hp = e.maxHp = 90; b.orb.push(e); } G.banner('РОЙ-ЩИТ', b.col, 'Уничтожьте дронов!'); }
        b.orb.forEach((e, i) => { const a = b.t * 1.4 + i / b.orb.length * Math.PI * 2; e.x = b.x + Math.cos(a) * (b.r + 50); e.y = b.y + Math.sin(a) * (b.r + 50); });
        b.armor = b.orb.length ? 0.25 : 1;
        moveTo(C.x + Math.cos(b.t * 0.3) * 260, C.y - 120 + Math.sin(b.t * 0.6) * 80, 70);
        if (b.cd <= 0) { b.cd = ph === 3 ? 2 : 3; const n = 6 + ph * 3; for (let i = 0; i < n; i++) setTimeout(() => { if (G.boss === b) zone(p.x + (Math.random() - 0.5) * 260, p.y + (Math.random() - 0.5) * 260, 45); }, i * 90); }
        if (b.cd2 <= 0) { b.cd2 = 2.6; fan(5, 0.12, 300); }
        if (ph >= 2) lasers(ph === 3 ? 3 : 1, 520, 0.5);
        break; }
      case 'zero': case 'null': {
        const fast = b.id === 'null' ? 0.65 : 1;
        if (b.id === 'null' && b.cd3 <= 0) { b.cd3 = 3.2; G.burst(b.x, b.y, '#fff', 30, 300); b.x = C.x + (Math.random() - 0.5) * 600; b.y = C.y + (Math.random() - 0.5) * 600; G.collide(b); G.glitchT = 0.3; }
        else moveTo(C.x, C.y, 50);
        if (ph >= 2) lasers(ph === 3 ? 3 : 2, 480, 0.6);
        if (b.cd <= 0) {
          b.pat = (b.pat + 1) % 5; b.cd = (ph === 3 ? 1.6 : 2.4) * fast;
          const pt = b.pat;
          if (pt === 0) ring(20, 230, b.t);
          if (pt === 1) [-0.3, 0, 0.3].forEach(o => beam(aim + o, 20, 0.8));
          if (pt === 2) for (let i = 0; i < 4; i++) zone(p.x + (Math.random() - 0.5) * 220, p.y + (Math.random() - 0.5) * 220);
          if (pt === 3) { for (let k = 0; k < 3; k++) setTimeout(() => { if (G.boss === b) fan(5, 0.14, 330); }, k * 220); }
          if (pt === 4) { G.spawnEnemy('drone', b.x + 60, b.y); G.spawnEnemy('bomber', b.x - 60, b.y); }
          if (ph === 3 && pt % 2 === 0) ring(12, 160, -b.t);
        }
        break;
      }
    }
    if (b.las) for (const l of b.las) if (G.segDist(p.x, p.y, l[0], l[1], l[2], l[3]) < p.r + 5) { G.hurtPlayer(dm * 1.3, null); break; }
    if (b.id !== 'serpent' && dist < b.r + p.r) G.hurtPlayer(dm, null);
  }
};
