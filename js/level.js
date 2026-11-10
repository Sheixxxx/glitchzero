'use strict';
/* ===== Level Generator: процедурные секторы =====
   Тайлы: 0 пол, 1 стена, 2 трещина (секрет), 3 ящик, 4 силовой барьер, 5 колонна/сервер, 6 энергобочка */
const TS = 48;
const LevelGen = {
  STYLES: ['open', 'round', 'cross', 'pillars', 'servers', 'arena', 'garden'],
  STYLE_N: { open: 'Зал', round: 'Купол', cross: 'Перекрёсток', pillars: 'Зал колонн', servers: 'Серверная', arena: 'Арена', garden: 'Глитч-сад' },
  gen(seed, diff, o = {}) {
    const r = rng(seed), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const W = 42 + Math.min(12, diff), H = W;
    const t = new Uint8Array(W * H).fill(1), bush = new Uint8Array(W * H);
    const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[y * W + x] = v; };
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : t[y * W + x];
    const rooms = [], target = 6 + Math.min(5, Math.floor(diff / 3));
    for (let k = 0; k < 500 && rooms.length < target; k++) {
      const w = ri(8, 13), h = ri(8, 12), x = ri(2, W - w - 3), y = ri(2, H - h - 3);
      if (rooms.some(q => x < q.x + q.w + 3 && x + w + 3 > q.x && y < q.y + q.h + 3 && y + h + 3 > q.y)) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, type: 'normal', style: 'open' });
    }
    rooms.forEach((q, i) => {
      q.style = i === 0 ? 'open' : this.STYLES[ri(0, this.STYLES.length - 1)];
      if (q.style === 'arena' && (q.w < 10 || q.h < 10)) q.style = 'pillars';
      const cxi = Math.floor(q.cx), cyi = Math.floor(q.cy);
      q.prot = (x, y) => x === cxi || x === cxi + 1 || x === cxi - 1 || y === cyi || y === cyi + 1 || y === cyi - 1;
      for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) {
        let v = 0;
        const nx = (x + 0.5 - q.cx) / (q.w / 2), ny = (y + 0.5 - q.cy) / (q.h / 2);
        if (q.style === 'round' && nx * nx + ny * ny > 1.05) v = 1;
        if (q.style === 'cross' && Math.abs(nx) > 0.4 && Math.abs(ny) > 0.4) v = 1;
        if (q.style === 'pillars' && (x - q.x) % 3 === 2 && (y - q.y) % 3 === 2 && x < q.x + q.w - 1 && y < q.y + q.h - 1 && !q.prot(x, y)) v = 5;
        if (q.style === 'servers' && (y - q.y) % 3 === 2 && y < q.y + q.h - 2 && x > q.x && x < q.x + q.w - 1 && !q.prot(x, y)) v = 5;
        if (q.style === 'arena' && Math.abs(Math.hypot(nx, ny) - 0.55) < 0.09 && !q.prot(x, y)) v = 5;
        set(x, y, v);
      }
    });
    // коридоры (алгоритм Прима)
    const conn = [0], left = rooms.map((_, i) => i).slice(1);
    const carve = (x1, y1, x2, y2) => {
      const hz = r() < 0.5;
      const lineH = (xa, xb, y) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) { set(x, y, 0); set(x, y + 1, 0); } };
      const lineV = (ya, yb, x) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) { set(x, y, 0); set(x + 1, y, 0); } };
      if (hz) { lineH(x1, x2, y1); lineV(y1, y2, x2); } else { lineV(y1, y2, x1); lineH(x1, x2, y2); }
    };
    while (left.length) {
      let best = null;
      for (const i of conn) for (const j of left) { const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy); if (!best || d < best.d) best = { i, j, d }; }
      const a = rooms[best.i], b = rooms[best.j];
      carve(Math.floor(a.cx), Math.floor(a.cy), Math.floor(b.cx), Math.floor(b.cy));
      conn.push(best.j); left.splice(left.indexOf(best.j), 1);
    }
    if (rooms.length > 4) { const a = rooms[1], b = rooms[rooms.length - 1]; carve(Math.floor(a.cx), Math.floor(a.cy), Math.floor(b.cx), Math.floor(b.cy)); }
    const start = rooms[0]; start.type = 'start';
    let far = rooms[1], fd = 0; rooms.forEach(q => { const d = Math.hypot(q.cx - start.cx, q.cy - start.cy); if (d > fd) { fd = d; far = q; } });
    far.type = 'portal';
    const normals = rooms.filter(q => q.type === 'normal');
    if (normals.length > 2 && r() < 0.45 + diff * 0.01) normals[ri(0, normals.length - 1)].type = 'bonus';
    // секретные комнаты
    const secrets = [], nSec = (r() < 0.75 ? 1 : 0) + (r() < 0.25 + diff * 0.01 ? 1 : 0) + (o.extraSecret ? 1 : 0);
    for (let k = 0; k < 80 && secrets.length < nSec; k++) {
      const q = rooms[ri(0, rooms.length - 1)], side = ri(0, 3), sw = 4, sh = 4;
      let sx, sy, dx, dy;
      if (side === 0) { sx = ri(q.x, q.x + q.w - sw); sy = q.y - 1 - sh; dx = sx + 1; dy = q.y - 1; }
      else if (side === 1) { sx = ri(q.x, q.x + q.w - sw); sy = q.y + q.h + 1; dx = sx + 1; dy = q.y + q.h; }
      else if (side === 2) { sx = q.x - 1 - sw; sy = ri(q.y, q.y + q.h - sh); dx = q.x - 1; dy = sy + 1; }
      else { sx = q.x + q.w + 1; sy = ri(q.y, q.y + q.h - sh); dx = q.x + q.w; dy = sy + 1; }
      if (sx < 2 || sy < 2 || sx + sw > W - 2 || sy + sh > H - 2) continue;
      let ok = true;
      for (let y = sy - 1; y <= sy + sh; y++) for (let x = sx - 1; x <= sx + sw; x++) if (get(x, y) !== 1) ok = false;
      // проход должен вести к полу комнаты
      const inner = side === 0 ? get(dx, dy + 1) : side === 1 ? get(dx, dy - 1) : side === 2 ? get(dx + 1, dy) : get(dx - 1, dy);
      if (!ok || inner !== 0) continue;
      for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) set(x, y, 0);
      set(dx, dy, 2); if (side < 2) set(dx + 1, dy, 2); else set(dx, dy + 1, 2);
      secrets.push({ x: sx, y: sy, w: sw, h: sh, cx: sx + sw / 2, cy: sy + sh / 2, type: 'secret', found: false });
    }
    const free = (x, y) => get(x, y) === 0;
    const P2 = (q, m = 1) => ({ x: (q.x + m + r() * (q.w - 2 * m)) * TS, y: (q.y + m + r() * (q.h - 2 * m)) * TS });
    const pick = (q, m) => { for (let i = 0; i < 30; i++) { const p = P2(q, m); if (free(Math.floor(p.x / TS), Math.floor(p.y / TS))) return p; } return { x: q.cx * TS, y: q.cy * TS }; };
    const tileIn = (q, m = 1) => { for (let i = 0; i < 30; i++) { const x = ri(q.x + m, q.x + q.w - 1 - m), y = ri(q.y + m, q.y + q.h - 1 - m); if (free(x, y) && !q.prot(x, y)) return [x, y]; } return null; };
    // ящики, бочки, кусты
    rooms.forEach(q => {
      if (q.type === 'start') return;
      const nc = q.style === 'garden' ? 1 : ri(1, 4);
      for (let i = 0; i < nc; i++) { const p = tileIn(q); if (p) { set(p[0], p[1], 3); if (r() < 0.5 && free(p[0] + 1, p[1]) && !q.prot(p[0] + 1, p[1])) set(p[0] + 1, p[1], 3); } }
      if (r() < 0.6) { const p = tileIn(q); if (p) set(p[0], p[1], 6); }
      const nb = q.style === 'garden' ? ri(4, 7) : (r() < 0.55 ? ri(1, 2) : 0);
      for (let i = 0; i < nb; i++) { const c = tileIn(q, 1); if (!c) continue; const bw = ri(2, 3), bh = ri(2, 3); for (let y = c[1]; y < c[1] + bh; y++) for (let x = c[0]; x < c[0] + bw; x++) if (get(x, y) === 0) bush[y * W + x] = 1; }
    });
    // ускорители и телепорты
    const pads = [], tps = [];
    rooms.forEach(q => { if (q.type !== 'start' && r() < 0.35) { const p = tileIn(q); if (p) pads.push({ x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, a: ri(0, 3) * Math.PI / 2 }); } });
    if (rooms.length >= 5 && r() < 0.7) {
      const a = rooms[ri(1, Math.floor(rooms.length / 2))], b = rooms[ri(Math.floor(rooms.length / 2) + 1, rooms.length - 1)];
      const pa = tileIn(a), pb = tileIn(b);
      if (pa && pb && a !== b) tps.push({ a: { x: (pa[0] + 0.5) * TS, y: (pa[1] + 0.5) * TS }, b: { x: (pb[0] + 0.5) * TS, y: (pb[1] + 0.5) * TS } });
    }
    // терминалы взлома и алтари усилений
    const terms = [], shrines = [];
    rooms.forEach(q => {
      if (q.type === 'start') return;
      if (r() < 0.4) { const p = tileIn(q, 1); if (p) terms.push({ x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, prog: 0, done: false, k: ['emp', 'loot', 'ally', 'nuke'][ri(0, 3)] }); }
      if (r() < 0.28) { const p = tileIn(q); if (p) shrines.push({ x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, k: ['rage', 'haste', 'aegis', 'magnet'][ri(0, 3)], cd: 0 }); }
    });
    // комнаты-ловушки с барьерами
    const lockable = rooms.filter(q => q.type === 'normal');
    const nLock = Math.min(lockable.length, (diff >= 2 ? 1 : 0) + (diff >= 7 ? 1 : 0) + (r() < 0.3 ? 1 : 0));
    for (let i = 0; i < nLock; i++) {
      const q = lockable.splice(ri(0, lockable.length - 1), 1)[0]; q.lock = true; q.doors = [];
      for (let x = q.x - 1; x <= q.x + q.w; x++) for (const y of [q.y - 1, q.y + q.h]) if (get(x, y) === 0) q.doors.push([x, y]);
      for (let y = q.y; y < q.y + q.h; y++) for (const x of [q.x - 1, q.x + q.w]) if (get(x, y) === 0) q.doors.push([x, y]);
    }
    const biome = o.biome || D.BIOMES[Math.floor(r() * D.BIOMES.length)];
    // особые механики биома
    const feats = [];
    const okRect = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (get(x, y) !== 0) return false; return true; };
    rooms.forEach(q => {
      if (q.type === 'start' || q.lock) return;
      const cx = Math.floor(q.cx), cy = Math.floor(q.cy);
      if (biome.id === 'factory' && r() < 0.75) { const hz = r() < 0.5, L = hz ? q.w - 2 : q.h - 2; if (L >= 4) { const x0 = hz ? q.x + 1 : cx, y0 = hz ? cy : q.y + 1, w = hz ? L : 2, h = hz ? 2 : L; if (okRect(x0, y0, w, h)) feats.push({ k: 'belt', x: x0 * TS, y: y0 * TS, w: w * TS, h: h * TS, dx: hz ? (r() < 0.5 ? 1 : -1) : 0, dy: hz ? 0 : (r() < 0.5 ? 1 : -1) }); } if (r() < 0.6) { const p = tileIn(q, 1); if (p) feats.push({ k: 'steam', x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, r: 46, t: r() * 4, per: 3.5 }); } }
      if (biome.id === 'lab' && r() < 0.7) for (let i = 0; i < ri(1, 2); i++) { const p = tileIn(q, 1); if (p) feats.push({ k: 'acid', x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, r: 40 + r() * 30 }); }
      if (biome.id === 'city' && r() < 0.6 && q.w >= 7) { const y = q.y + 1 + Math.floor(r() * (q.h - 2)); let clear = true; for (let x = q.x; x < q.x + q.w; x++) if (get(x, y) !== 0) clear = false; if (clear) feats.push({ k: 'car', y: (y + 0.5) * TS, x1: q.x * TS, x2: (q.x + q.w) * TS, sp: (160 + r() * 120) * (r() < 0.5 ? 1 : -1), t: r(), col: ['#ff3dc8', '#00f0ff', '#ffd23d'][ri(0, 2)] }); }
      if (biome.id === 'frost' && r() < 0.8) { const w = Math.min(q.w - 2, ri(3, 6)), h = Math.min(q.h - 2, ri(3, 5)), x0 = q.x + 1 + Math.floor(r() * Math.max(1, q.w - 2 - w)), y0 = q.y + 1 + Math.floor(r() * Math.max(1, q.h - 2 - h)); if (w >= 2 && h >= 2) feats.push({ k: 'ice', x: x0 * TS, y: y0 * TS, w: w * TS, h: h * TS }); }
      if (biome.id === 'station' && r() < 0.45) { const p = tileIn(q, 1); if (p) feats.push({ k: 'vac', x: (p[0] + 0.5) * TS, y: (p[1] + 0.5) * TS, t: r() * 6, per: 7 }); }
    });
    const need = Math.max(1, Math.min(7, 3 + Math.floor(diff / 4)) + (o.coreMod || 0));
    const cores = [], coreRooms = rooms.filter(q => q.type !== 'start');
    for (let i = 0; i < need + 1; i++) cores.push(pick(coreRooms[i % coreRooms.length], 1.5));
    const enemies = [], mul = o.enMul || 1;
    rooms.forEach((q, ri2) => {
      if (q.type === 'start') return;
      let n = Math.round((2 + Math.floor(diff / 2.5) + (q.type === 'bonus' ? 2 : 0) + (q.style === 'arena' ? 1 : 0)) * mul);
      n = Math.min(n, 14);
      for (let i = 0; i < n; i++) {
        let ty = biome.en[ri(0, biome.en.length - 1)];
        if (diff >= 4 && r() < 0.06 + diff * 0.01) ty = 'guard';
        if (diff >= 6 && r() < 0.08) ty = 'splitter';
        if (q.style === 'servers' && r() < 0.3) ty = 'turret';
        const p = pick(q, 1.2); enemies.push({ type: ty, x: p.x, y: p.y, room: ri2 });
      }
    });
    const lasers = [], zones = [], lm = o.laserMul || 1;
    rooms.forEach(q => {
      if (q.type === 'start' || q.lock) return;
      const ch = (0.22 + diff * 0.04) * lm;
      if (r() < ch && q.w >= 8 && q.h >= 8 && q.style !== 'pillars' && q.style !== 'servers') lasers.push({ k: 'rot', x: q.cx * TS, y: q.cy * TS, len: (Math.min(q.w, q.h) / 2 - 0.6) * TS, a: r() * 6.28, sp: (0.5 + r() * 0.6 + diff * 0.03) * (r() < 0.5 ? 1 : -1), arms: diff > 8 && r() < 0.4 ? 2 : 1 });
      if (r() < ch * 0.8) { const hz = r() < 0.5; lasers.push({ k: 'slide', hz, x1: q.x * TS, y1: q.y * TS, x2: (q.x + q.w) * TS, y2: (q.y + q.h) * TS, t: r() * 6, sp: 0.5 + r() * 0.5 }); }
      if (r() < ch * 0.7 || q.type === 'bonus') { const hz = r() < 0.5; const p = hz ? (q.y + 1 + r() * (q.h - 2)) * TS : (q.x + 1 + r() * (q.w - 2)) * TS; lasers.push({ k: 'pulse', hz, p, a1: hz ? q.x * TS : q.y * TS, a2: hz ? (q.x + q.w) * TS : (q.y + q.h) * TS, t: r() * 3, per: 2.6 - Math.min(1, diff * 0.04) }); }
      const nz = (r() < 0.3 + diff * 0.03 ? 1 : 0) + (o.zoneMul ? ri(1, 3) : 0);
      for (let i = 0; i < nz; i++) { const p = pick(q, 1.5); zones.push({ x: p.x, y: p.y, r: 40 + r() * 35, t: r() * 3, per: 3 }); }
    });
    const chests = [], coins = [], heals = [];
    secrets.forEach(q => chests.push({ x: q.cx * TS, y: q.cy * TS, big: true, secret: true }));
    rooms.filter(q => q.type === 'bonus').forEach(q => { chests.push({ x: q.cx * TS, y: q.cy * TS, big: true, bonus: true }); for (let i = 0; i < 12; i++) coins.push(pick(q, 1)); });
    for (let i = 0; i < (o.extraChests || 0) + (r() < 0.4 ? 1 : 0); i++) { const q = normals[ri(0, normals.length - 1)] || far; chests.push(pick(q, 1.5)); }
    rooms.forEach(q => { if (q.type !== 'start') { for (let i = 0; i < ri(1, 4); i++) coins.push(pick(q, 1)); if (r() < 0.3) heals.push(pick(q, 1.5)); } });
    return {
      W, H, t, bush, rooms, secrets, biome, need, pads, tps, seed, terms, shrines, feats,
      start: { x: start.cx * TS, y: start.cy * TS }, portal: { x: far.cx * TS, y: far.cy * TS }, portalRoom: far,
      cores, enemies, lasers, zones, chests, coins, heals, rnd: r
    };
  },
  genArena(seed, biome, lay) {
    const r = rng(seed), W = 26, H = 26, t = new Uint8Array(W * H).fill(1), bush = new Uint8Array(W * H);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) t[y * W + x] = 0;
    const set4 = (x, y, v) => { t[y * W + x] = v; t[y * W + x + 1] = v; t[(y + 1) * W + x] = v; t[(y + 1) * W + x + 1] = v; };
    if (lay === 'ring') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) > 11.2) t[y * W + x] = 1; [[8, 12], [16, 12], [12, 8], [12, 16]].forEach(([x, y]) => set4(x, y, 5)); }
    else if (lay === 'cross') { [[5, 5], [19, 5], [5, 19], [19, 19]].forEach(([x, y]) => set4(x, y, 1)); [[12, 6], [12, 18], [6, 12], [18, 12]].forEach(([x, y]) => set4(x, y, 3)); }
    else if (lay === 'open') { [[7, 7], [17, 17]].forEach(([x, y]) => set4(x, y, 5)); [[17, 7], [7, 17]].forEach(([x, y]) => set4(x, y, 6)); }
    else if (lay === 'maze') { for (let i = 0; i < 4; i++) { const x = 6 + i * 4; for (let y = 5; y < 10; y++) if (i % 2) t[y * W + x] = 2; for (let y = 16; y < 21; y++) if (!(i % 2)) t[y * W + x] = 2; } }
    else [[6, 6], [18, 6], [6, 18], [18, 18]].forEach(([x, y]) => set4(x, y, 5));
    if (lay !== 'ring') [[3, 12], [21, 12]].forEach(([x, y]) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) bush[(y + b) * W + x + a] = 1; });
    const room = { x: 2, y: 2, w: W - 4, h: H - 4, cx: W / 2, cy: H / 2, type: 'boss', style: 'arena' };
    return { W, H, t, bush, rooms: [room], secrets: [], biome: biome || D.BIOMES[4], need: 0, pads: [], tps: [], terms: [], shrines: [], feats: [], seed, start: { x: W / 2 * TS, y: (H - 4) * TS }, portal: { x: W / 2 * TS, y: H / 2 * TS }, portalRoom: room, cores: [], enemies: [], lasers: [], zones: [], chests: [], coins: [], heals: [{ x: 4 * TS, y: 4 * TS }, { x: (W - 4) * TS, y: (H - 4) * TS }], rnd: r, arena: true };
  }
};
