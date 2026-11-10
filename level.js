'use strict';
/* ===== Level Generator: процедурные секторы ===== */
const TS = 48;
const LevelGen = {
  gen(seed, diff, o = {}) {
    const r = rng(seed), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const W = 34 + Math.min(14, diff), H = W;
    const t = new Uint8Array(W * H).fill(1);
    const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[y * W + x] = v; };
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : t[y * W + x];
    const rooms = [], target = 6 + Math.min(5, Math.floor(diff / 3));
    for (let k = 0; k < 400 && rooms.length < target; k++) {
      const w = ri(7, 12), h = ri(7, 11), x = ri(2, W - w - 3), y = ri(2, H - h - 3);
      if (rooms.some(q => x < q.x + q.w + 3 && x + w + 3 > q.x && y < q.y + q.h + 3 && y + h + 3 > q.y)) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, type: 'normal' });
    }
    rooms.forEach(q => { for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) set(x, y, 0); });
    // соединения (алгоритм Прима)
    const conn = [0], left = rooms.map((_, i) => i).slice(1);
    const carve = (x1, y1, x2, y2) => {
      const hz = r() < 0.5;
      const lineH = (xa, xb, y) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) { set(x, y, 0); set(x, y + 1, 0); } };
      const lineV = (ya, yb, x) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) { set(x, y, 0); set(x + 1, y, 0); } };
      if (hz) { lineH(x1, x2, y1); lineV(y1, y2, x2); } else { lineV(y1, y2, x1); lineH(x1, x2, y2); }
    };
    while (left.length) {
      let best = null;
      for (const i of conn) for (const j of left) {
        const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy);
        if (!best || d < best.d) best = { i, j, d };
      }
      const a = rooms[best.i], b = rooms[best.j];
      carve(Math.floor(a.cx), Math.floor(a.cy), Math.floor(b.cx), Math.floor(b.cy));
      conn.push(best.j); left.splice(left.indexOf(best.j), 1);
    }
    // петля для вариативности
    if (rooms.length > 4) { const a = rooms[1], b = rooms[rooms.length - 1]; carve(Math.floor(a.cx), Math.floor(a.cy), Math.floor(b.cx), Math.floor(b.cy)); }
    const start = rooms[0]; start.type = 'start';
    let far = rooms[1], fd = 0; rooms.forEach(q => { const d = Math.hypot(q.cx - start.cx, q.cy - start.cy); if (d > fd) { fd = d; far = q; } });
    far.type = 'portal';
    const normals = rooms.filter(q => q.type === 'normal');
    if (normals.length > 2 && r() < 0.45 + diff * 0.01) normals[ri(0, normals.length - 1)].type = 'bonus';
    // колонны-укрытия
    rooms.forEach(q => {
      if (q.type === 'start' || q.w < 9 || q.h < 8 || r() < 0.4) return;
      [[q.x + 2, q.y + 2], [q.x + q.w - 3, q.y + q.h - 3]].forEach(([x, y]) => { if (r() < 0.8) set(x, y, 1); });
    });
    // секретные комнаты
    const secrets = [], nSec = (r() < 0.75 ? 1 : 0) + (r() < 0.25 + diff * 0.01 ? 1 : 0) + (o.extraSecret ? 1 : 0);
    for (let k = 0; k < 60 && secrets.length < nSec; k++) {
      const q = rooms[ri(0, rooms.length - 1)], side = ri(0, 3), sw = 4, sh = 4;
      let sx, sy, dx, dy;
      if (side === 0) { sx = ri(q.x, q.x + q.w - sw); sy = q.y - 1 - sh; dx = sx + 1; dy = q.y - 1; }
      else if (side === 1) { sx = ri(q.x, q.x + q.w - sw); sy = q.y + q.h + 1; dx = sx + 1; dy = q.y + q.h; }
      else if (side === 2) { sx = q.x - 1 - sw; sy = ri(q.y, q.y + q.h - sh); dx = q.x - 1; dy = sy + 1; }
      else { sx = q.x + q.w + 1; sy = ri(q.y, q.y + q.h - sh); dx = q.x + q.w; dy = sy + 1; }
      if (sx < 2 || sy < 2 || sx + sw > W - 2 || sy + sh > H - 2) continue;
      let ok = true;
      for (let y = sy - 1; y <= sy + sh; y++) for (let x = sx - 1; x <= sx + sw; x++) if (get(x, y) !== 1) ok = false;
      if (!ok) continue;
      for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) set(x, y, 0);
      set(dx, dy, 2); if (side < 2) set(dx + 1, dy, 2); else set(dx, dy + 1, 2);
      secrets.push({ x: sx, y: sy, w: sw, h: sh, cx: sx + sw / 2, cy: sy + sh / 2, type: 'secret', found: false });
    }
    const P2 = (q, m = 1) => ({ x: (q.x + m + r() * (q.w - 2 * m)) * TS, y: (q.y + m + r() * (q.h - 2 * m)) * TS });
    const free = (p) => get(Math.floor(p.x / TS), Math.floor(p.y / TS)) === 0;
    const pick = (q, m) => { for (let i = 0; i < 20; i++) { const p = P2(q, m); if (free(p)) return p; } return { x: q.cx * TS, y: q.cy * TS }; };
    const biome = o.biome || D.BIOMES[Math.floor(r() * D.BIOMES.length)];
    // ядра
    const need = Math.max(1, Math.min(7, 3 + Math.floor(diff / 4)) + (o.coreMod || 0));
    const cores = [], coreRooms = rooms.filter(q => q.type !== 'start');
    for (let i = 0; i < need + 1; i++) { const q = coreRooms[i % coreRooms.length]; cores.push(pick(q, 1.5)); }
    // враги
    const enemies = [], mul = o.enMul || 1;
    rooms.forEach(q => {
      if (q.type === 'start') return;
      let n = Math.round((2 + Math.floor(diff / 2.5) + (q.type === 'bonus' ? 2 : 0)) * mul);
      n = Math.min(n, 14);
      for (let i = 0; i < n; i++) {
        let ty = biome.en[ri(0, biome.en.length - 1)];
        if (diff >= 4 && r() < 0.06 + diff * 0.01) ty = 'guard';
        if (diff >= 6 && r() < 0.08) ty = 'splitter';
        const p = pick(q, 1.2); enemies.push({ type: ty, x: p.x, y: p.y });
      }
    });
    // ловушки
    const lasers = [], zones = [], lm = o.laserMul || 1;
    rooms.forEach(q => {
      if (q.type === 'start') return;
      const ch = (0.25 + diff * 0.04) * lm;
      if (r() < ch && q.w >= 8 && q.h >= 8) lasers.push({ k: 'rot', x: q.cx * TS, y: q.cy * TS, len: (Math.min(q.w, q.h) / 2 - 0.6) * TS, a: r() * 6.28, sp: (0.5 + r() * 0.6 + diff * 0.03) * (r() < 0.5 ? 1 : -1), arms: diff > 8 && r() < 0.4 ? 2 : 1 });
      if (r() < ch * 0.8) { const hz = r() < 0.5; lasers.push({ k: 'slide', hz, x1: q.x * TS, y1: q.y * TS, x2: (q.x + q.w) * TS, y2: (q.y + q.h) * TS, t: r() * 6, sp: 0.5 + r() * 0.5 }); }
      if (r() < ch * 0.7 || q.type === 'bonus') { const hz = r() < 0.5; const p = hz ? (q.y + 1 + r() * (q.h - 2)) * TS : (q.x + 1 + r() * (q.w - 2)) * TS; lasers.push({ k: 'pulse', hz, p, a1: hz ? q.x * TS : q.y * TS, a2: hz ? (q.x + q.w) * TS : (q.y + q.h) * TS, t: r() * 3, per: 2.6 - Math.min(1, diff * 0.04) }); }
      const nz = (r() < 0.3 + diff * 0.03 ? 1 : 0) + (o.zoneMul ? ri(1, 3) : 0);
      for (let i = 0; i < nz; i++) { const p = pick(q, 1.5); zones.push({ x: p.x, y: p.y, r: 40 + r() * 35, t: r() * 3, per: 3 }); }
    });
    // сундуки, монеты, аптечки
    const chests = [], coins = [], heals = [];
    secrets.forEach(q => chests.push({ x: q.cx * TS, y: q.cy * TS, big: true, secret: true }));
    rooms.filter(q => q.type === 'bonus').forEach(q => { chests.push({ x: q.cx * TS, y: q.cy * TS, big: true, bonus: true }); for (let i = 0; i < 12; i++) coins.push(pick(q, 1)); });
    for (let i = 0; i < (o.extraChests || 0) + (r() < 0.4 ? 1 : 0); i++) { const q = normals[ri(0, normals.length - 1)] || far; const p = pick(q, 1.5); chests.push({ x: p.x, y: p.y }); }
    rooms.forEach(q => { if (q.type !== 'start') { for (let i = 0; i < ri(1, 4); i++) coins.push(pick(q, 1)); if (r() < 0.3) heals.push(pick(q, 1.5)); } });
    return {
      W, H, t, rooms, secrets, biome, need,
      start: { x: start.cx * TS, y: start.cy * TS }, portal: { x: far.cx * TS, y: far.cy * TS }, portalRoom: far,
      cores, enemies, lasers, zones, chests, coins, heals, rnd: r
    };
  },
  genArena(seed, biome) {
    const r = rng(seed), W = 26, H = 26, t = new Uint8Array(W * H).fill(1);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) t[y * W + x] = 0;
    [[6, 6], [18, 6], [6, 18], [18, 18]].forEach(([x, y]) => { t[y * W + x] = 1; t[y * W + x + 1] = 1; t[(y + 1) * W + x] = 1; t[(y + 1) * W + x + 1] = 1; });
    const room = { x: 2, y: 2, w: W - 4, h: H - 4, cx: W / 2, cy: H / 2, type: 'boss' };
    return { W, H, t, rooms: [room], secrets: [], biome: biome || D.BIOMES[4], need: 0, start: { x: W / 2 * TS, y: (H - 4) * TS }, portal: { x: W / 2 * TS, y: H / 2 * TS }, portalRoom: room, cores: [], enemies: [], lasers: [], zones: [], chests: [], coins: [], heals: [{ x: 4 * TS, y: 4 * TS }, { x: (W - 4) * TS, y: (H - 4) * TS }], rnd: r, arena: true };
  }
};
