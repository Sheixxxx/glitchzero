'use strict';
/* ===== UI Manager ===== */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICO = {
  shop: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  heroes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.3c3 .3 5 2.6 5 5.7"/>',
  skills: '<circle cx="12" cy="5" r="2.3"/><circle cx="5.5" cy="18.5" r="2.3"/><circle cx="18.5" cy="18.5" r="2.3"/><path d="M12 7.3v4.2M12 11.5l-5 5M12 11.5l5 5"/>',
  inv: '<path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M4 12h16M10 12v2h4v-2"/>',
  museum: '<path d="M3 9l9-5 9 5M5 9v9M9.7 9v9M14.3 9v9M19 9v9M3 20.5h18"/>',
  quests: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM8.5 13.5l2.5 2.5 4.5-5"/>',
  ach: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7 21l5-2.8 5 2.8-1.6-7.6"/><path d="m12 6.5.8 1.7 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.7.9.4-1.8-1.3-1.2 1.8-.2z"/>',
  road: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3.4 4M16 6h3a3 3 0 0 1-3.4 4M12 13v4M8.5 21h7M10 17h4v4h-4z"/>',
  stats: '<path d="M3 21h18M6 17v-5M11 17V7M16 17v-8M21 4l-5 5-5-2-5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  box: '<path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9"/>',
  back: '<path d="M15 5l-7 7 7 7"/>'
};
const ic = n => '<svg class="i" viewBox="0 0 24 24">' + ICO[n] + '</svg>';
const UI = {
  el: null, modal: null, scr: 'lobby', f: { ach: 'all', achSt: 'all', inv: 'all', shop: 'offers' }, sel: {},
  init() {
    this.el = document.getElementById('ui'); this.modal = document.getElementById('modal');
    document.body.addEventListener('click', e => {
      const t = e.target.closest('[data-a]'); if (!t) return;
      SFX.init(); SFX.play('click');
      this.act(t.dataset.a, t.dataset.v, t);
    });
    document.body.addEventListener('input', e => {
      const t = e.target; if (!t.dataset.in) return; const st = P.s.settings;
      if (t.dataset.in === 'sfx' || t.dataset.in === 'music') { st[t.dataset.in] = +t.value; SFX.vol(); }
      if (t.dataset.in === 'ctrl') { st.ctrl = +t.value; G.resize(); }
      P.save();
    });
    P.onToast = o => this.toast(o);
    G.ui = {
      onEnd: (R, res) => this.results(R, res),
      onPerk: (ch, n) => this.perk(ch, n),
      onRoute: (nodes, n, ms) => this.routeMap(nodes, n, ms),
      onMerchant: () => this.merchant(),
      onPause: () => this.pause()
    };
    this.applyTheme(); this.go('lobby');
    const loop = () => { requestAnimationFrame(loop); if (G.state === 'off' || document.getElementById('modal').classList.contains('on')) this.paintStages(performance.now() / 1000); }; loop();
  },
  applyTheme() { const t = P.cos('theme').v; document.documentElement.style.setProperty('--a1', t[0]); document.documentElement.style.setProperty('--a2', t[1]); },
  go(s) { this.scr = s; this.closeModal(); this.render(); this.el.scrollTop = 0; },
  render() {
    const f = this['s_' + this.scr]; if (!f) return;
    document.body.classList.toggle('ingame', false);
    this.el.style.display = 'block'; this.el.innerHTML = f.call(this);
    document.getElementById('pauseBtn').style.display = 'none';
  },
  hideUI() { this.el.style.display = 'none'; this.el.innerHTML = ''; document.body.classList.add('ingame'); document.getElementById('pauseBtn').style.display = 'flex'; },
  showModal(html, cls = '') { this.modal.innerHTML = '<div class="mbox ' + cls + '">' + html + '</div>'; this.modal.classList.add('on'); },
  closeModal() { this.modal.classList.remove('on'); this.modal.innerHTML = ''; },

  /* ---------- общие куски ---------- */
  res() {
    const s = P.s;
    return `<div class="res"><span class="r tr" title="Трофеи"><i>♛</i>${fmt(P.trophies())}</span><span class="r cr" title="Кредиты"><i>¤</i>${fmt(s.credits)}</span><span class="r gm" title="Осколки"><i>◆</i>${fmt(s.gems)}</span><span class="r bt" title="Биты — для улучшения бойцов"><i>⌬</i>${fmt(s.bits)}</span></div>`;
  },
  head(title, sub) { return `<div class="top"><button class="back" data-a="go" data-v="lobby" aria-label="Назад">${ic('back')}</button><div class="ttl"><h2>${title}</h2>${sub ? '<small>' + sub + '</small>' : ''}</div>${this.res()}</div>`; },
  bar(v, max, col) { const p = Math.max(0, Math.min(100, v / max * 100)); return `<div class="bar"><i style="width:${p}%;${col ? 'background:' + col : ''}"></i></div>`; },
  rar(r) { return D.RAR[r].c; },
  itemCard(o, extra = '') {
    const it = D.ITEMS[o.id], eq = Object.values(P.s.eq).includes(o.uid);
    return `<div class="icard r${it.r} ${eq ? 'eq' : ''}" data-a="item" data-v="${o.uid}" style="--rc:${this.rar(it.r)}"><div class="ic">${it.ic}</div><div class="in">${it.n}</div><div class="il">ур. ${o.lvl}</div>${eq ? '<b class="eqb">НАДЕТО</b>' : ''}${extra}</div>`;
  },
  heroOrb(h, size = 120, lock) { return `<canvas class="herocv" data-h="${h.id}" ${lock ? 'data-lock="1"' : ''} width="${size * 2}" height="${size * 2}" style="width:${size}px;height:${size}px"></canvas>`; },
  // Живое превью следов и эффектов сбора
  paintFx(cv, T) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = cv.dataset.k, v = cv.dataset.v;
    c.setTransform(1, 0, 0, 1, 0, 0); const bg = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6); bg.addColorStop(0, '#1c1240'); bg.addColorStop(1, '#07060f'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(123,61,255,.18)'; c.lineWidth = 1; for (let x = (T * 30) % 20; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.globalCompositeOperation = 'lighter';
    if (k === 'trail') {
      const pos = t => ({ x: W / 2 + Math.cos(t * 1.6) * W * 0.36, y: H / 2 + Math.sin(t * 3.2) * H * 0.28 });
      for (let i = 40; i >= 0; i--) {
        const t = T - i * 0.025, p = pos(t), f = 1 - i / 40; if (v === 'none') break;
        if (v === 'neon') { c.fillStyle = `rgba(0,240,255,${f * 0.6})`; c.beginPath(); c.arc(p.x, p.y, 3 + f * 9, 0, 6.28); c.fill(); }
        else if (v === 'pixel') { if (i % 2) continue; c.fillStyle = `hsla(${(i * 25) % 360},100%,60%,${f})`; const s = 4 + f * 8; c.fillRect(p.x - s / 2 + Math.sin(i * 7) * 6, p.y - s / 2 + Math.cos(i * 5) * 6, s, s); }
        else if (v === 'fire') { c.fillStyle = `rgba(255,${80 + f * 150 | 0},20,${f * 0.7})`; c.beginPath(); c.arc(p.x + Math.sin(i * 3 + T * 9) * 4, p.y - (1 - f) * 18, 2 + f * 12, 0, 6.28); c.fill(); }
        else if (v === 'rainbow') { c.fillStyle = `hsla(${(T * 200 + i * 9) % 360},100%,60%,${f * 0.8})`; c.beginPath(); c.arc(p.x, p.y, 3 + f * 8, 0, 6.28); c.fill(); }
        else if (v === 'code') { if (i % 3) continue; c.fillStyle = `rgba(61,255,160,${f})`; c.font = `bold ${10 + f * 10 | 0}px monospace`; c.fillText('01ABF7'[i % 6], p.x + Math.sin(i) * 8, p.y); }
      }
      const p = pos(T); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#fff'; c.shadowColor = '#00f0ff'; c.shadowBlur = 16; c.beginPath(); c.arc(p.x, p.y, 8, 0, 6.28); c.fill(); c.shadowBlur = 0;
    } else {
      const ph = (T % 1.4) / 1.4, cx = W / 2, cy = H / 2;
      c.fillStyle = '#00f0ff'; c.save(); c.translate(cx, cy); c.rotate(T); c.globalAlpha = ph < 0.15 ? 0.3 : 1 - Math.min(1, ph * 3); c.beginPath(); c.moveTo(0, -12); c.lineTo(10, 0); c.lineTo(0, 12); c.lineTo(-10, 0); c.fill(); c.restore(); c.globalAlpha = 1;
      if (v === 'flash') { c.fillStyle = `rgba(255,255,255,${1 - ph})`; c.beginPath(); c.arc(cx, cy, 10 + ph * 40, 0, 6.28); c.fill(); }
      if (v === 'burst') for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28 + i, d = ph * 70; c.fillStyle = `hsla(${40 + i * 5},100%,60%,${1 - ph})`; c.fillRect(cx + Math.cos(a) * d - 2, cy + Math.sin(a) * d - 2, 4, 4); }
      if (v === 'ring') for (let j = 0; j < 3; j++) { const q = Math.max(0, ph - j * 0.12); c.strokeStyle = `rgba(0,240,255,${(1 - q) * 0.9})`; c.lineWidth = 4 - j; c.beginPath(); c.arc(cx, cy, q * 75, 0, 6.28); c.stroke(); }
      if (v === 'stars') for (let i = 0; i < 10; i++) { const a = i * 0.63, d = ph * 60, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + ph * ph * 40; c.fillStyle = `rgba(255,220,80,${1 - ph})`; c.save(); c.translate(x, y); c.rotate(T * 3 + i); c.beginPath(); for (let s = 0; s < 10; s++) { const rr = s % 2 ? 3 : 7, aa = s / 10 * 6.28; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } c.fill(); c.restore(); }
    }
    c.globalCompositeOperation = 'source-over';
  },
  // Живой постамент бойца
  paintStages(T) {
    document.querySelectorAll('.fxcv').forEach(cv => this.paintFx(cv, T));
    const list = document.querySelectorAll('.herocv'); if (!list.length) return;
    list.forEach(cv => {
      const H = D.HEROES.find(x => x.id === cv.dataset.h); if (!H) return;
      if (P.s.settings.r3d !== false && R3.lobby(cv, H, cv.dataset.skin || P.cos('skin').v, !!cv.dataset.lock, T)) return;
      const c = cv.getContext('2d'), S = cv.width / 2, cx = S, cy = S * 1.02, col = H.col, R = S * 0.28;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(2, 0, 0, 2, 0, 0);
      const s = S / 2, X = s, Y = s * 1.15;
      if (cv.dataset.lock) c.filter = 'grayscale(1) brightness(0.45)';
      // луч
      const bg = c.createLinearGradient(0, 0, 0, Y); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, col + '55');
      c.fillStyle = bg; c.beginPath(); c.moveTo(X - s * 0.18, 0); c.lineTo(X + s * 0.18, 0); c.lineTo(X + s * 0.55, Y + s * 0.1); c.lineTo(X - s * 0.55, Y + s * 0.1); c.fill();
      // платформа
      c.save(); c.translate(X, Y + s * 0.42);
      for (let i = 3; i >= 0; i--) { c.beginPath(); c.ellipse(0, i * 4, s * (0.72 - i * 0.04), s * (0.2 - i * 0.01), 0, 0, 6.28); c.fillStyle = i ? '#0a0818' : '#15102e'; c.fill(); }
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, s * 0.72, s * 0.2, 0, 0, 6.28); c.stroke();
      c.setLineDash([10, 8]); c.lineDashOffset = -T * 40; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.14, 0, 0, 6.28); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter'; G.gl(c, col, 0, 0, s * 0.7, 0.35); c.globalCompositeOperation = 'source-over';
      c.restore();
      // частицы
      for (let i = 0; i < 14; i++) { const ph = (T * 0.4 + i / 14) % 1, a = i * 2.4; c.globalAlpha = (1 - ph) * 0.8; c.fillStyle = col; c.fillRect(X + Math.cos(a) * s * 0.55 * (1 - ph * 0.3), Y + s * 0.4 - ph * s * 1.1, 2, 2); }
      c.globalAlpha = 1;
      const bob = Math.sin(T * 2) * s * 0.04;
      G.paintHero(c, H, P.cos('skin').v, X, Y - s * 0.1 + bob, s * 0.3, -Math.PI / 2 + Math.sin(T * 0.8) * 0.6, T, { glow: 0.5 });
      c.filter = 'none';
    });
  },

  /* ---------- ЛОББИ ---------- */
  s_lobby() {
    const s = P.s, h = D.HEROES.find(x => x.id === s.hero), hs = s.heroes[s.hero], md = D.MODES.find(m => m.id === s.mode) || D.MODES[0];
    const need = P.xpNeed(s.lvl), q = P.questsReady(), rd = P.roadReady(), cases = s.cases.c + s.cases.b + s.cases.m;
    const nextRoad = D.ROAD.find(r => r.at > P.trophies()), prevAt = (D.ROAD[D.ROAD.indexOf(nextRoad) - 1] || { at: 0 }).at;
    const sb = (go, icon, name, badge) => `<button class="sb" data-a="go" data-v="${go}"><i>${ic(icon)}</i>${badge ? '<b class="bd">' + badge + '</b>' : ''}${name}</button>`;
    const sz = Math.min(250, Math.max(190, Math.min(innerWidth * 0.62, innerHeight * 0.34)));
    return `<div class="lobby">
      <div class="ltop">
        <div class="prof" data-a="go" data-v="profile">
          <div class="av" style="--xp:${Math.round(s.xp / need * 100)}"><span>${esc(s.avatar)}</span><b class="lv">${s.lvl}</b></div>
          <div><div class="nm">${esc(s.name)}${s.prestige ? ' <span class="pres">✺' + s.prestige + '</span>' : ''}</div><div class="tt">${esc(s.title)}</div>${this.bar(s.xp, need)}</div>
        </div>
        ${this.res()}
      </div>
      <div class="lmid">
        <div class="side">
          ${sb('shop', 'shop', 'Магазин')}${sb('heroes', 'heroes', 'Бойцы')}${sb('skills', 'skills', 'Навыки', P.spFree() > 0 ? P.spFree() : 0)}${sb('inventory', 'inv', 'Арсенал')}${sb('museum', 'museum', 'Музей')}
        </div>
        <div class="stage" data-a="go" data-v="heroes">
          <div class="glyph-logo" data-a="logo" data-t="GLITCH//ZERO">GLITCH<span>//</span>ZERO</div>
          <div class="logosub">ПРОТОКОЛ ПРОРЫВА</div>
          ${this.heroOrb(h, sz)}
          <div class="hname" style="color:${h.col}">${h.n}</div>
          <div class="hsub"><span>${h.role}</span><span style="color:${h.col}">⚡ Сила ${hs.pow}</span><span style="color:#ffd23d">♛ ${hs.tr}</span></div>
          ${s.streak > 1 ? '<div class="streak">🔥 Серия ' + s.streak + ' • награды ×' + (1 + 0.08 * Math.min(s.streak, 10)).toFixed(2) + '</div>' : ''}
        </div>
        <div class="side">
          ${sb('quests', 'quests', 'Задания', q)}${sb('achievements', 'ach', 'Награды')}${sb('road', 'road', 'Путь', rd)}${sb('stats', 'stats', 'Статистика')}${sb('settings', 'settings', 'Опции')}
        </div>
      </div>
      <div class="lbot">
        <div class="roadmini" data-a="go" data-v="road">${nextRoad ? `<span>♛ ${P.trophies()}</span>${this.bar(P.trophies() - prevAt, nextRoad.at - prevAt, 'linear-gradient(90deg,#ff8a00,#fff066)')}<span>${nextRoad.at}</span>` : '<span>Путь трофеев пройден!</span>'}</div>
        <div class="lbtns">
          <button class="casebtn ${cases ? 'has' : ''}" data-a="cases"><i>${ic('box')}</i><b>${cases}</b><small>КЕЙСЫ</small></button>
          <button class="modebtn" data-a="go" data-v="modes" style="--mc:${md.c}"><i>${md.ic}</i><div><b>${md.n}</b><small>${this.modeSub(md.id)}</small></div></button>
          <button class="play" data-a="play">В БОЙ</button>
        </div>
      </div>
    </div>`;
  },
  modeSub(id) {
    const s = P.s;
    if (id === 'campaign') return 'Сектор ' + Math.min(30, this.sel.stage || s.campaign.stage);
    if (id === 'challenge') { const c = D.CHALLENGES.find(c => c.id === (this.sel.ch || 'c_onehp')); return c.n; }
    if (id === 'boss') return D.BOSSM[this.sel.boss || 'firewall'].n;
    if (id === 'daily') return s.daily.runDone ? 'Награда получена' : 'Награда доступна!';
    if (id === 'secret') return '???';
    const r = (s.records[id] || [])[0]; return r ? 'Рекорд: ' + r.label : 'Без рекорда';
  },

  /* ---------- РЕЖИМЫ ---------- */
  secretState() { const s = P.s.stats; return [(s.secretRooms || 0) >= 5, !!s.egg_logo, (s.glitchKills || 0) >= 1]; },
  s_modes() {
    const s = P.s, ss = this.secretState(), open = ss.every(x => x);
    let h = this.head('Режимы', 'У каждого режима свои правила и рекорды') + '<div class="grid modes">';
    D.MODES.forEach(m => { h += `<div class="mcard ${s.mode === m.id ? 'sel' : ''}" style="--mc:${m.c}" data-a="mode" data-v="${m.id}"><i>${m.ic}</i><b>${m.n}</b><p>${m.d}</p><small>${this.modeSub(m.id)}</small></div>`; });
    h += open ? `<div class="mcard secret ${s.mode === 'secret' ? 'sel' : ''}" style="--mc:#fff" data-a="mode" data-v="secret"><i>∅</i><b>Сектор NULL</b><p>Ты нашёл то, чего не должно существовать.</p><small>Секретный уровень</small></div>`
      : `<div class="mcard locked" style="--mc:#444"><i>?</i><b>???</b><p>Что-то скрывается в системе...</p><small>${ss.map(x => x ? '◆' : '◇').join(' ')}</small></div>`;
    h += '</div>';
    if (s.mode === 'campaign') {
      h += '<h3 class="sec">Карта кампании</h3><div class="stages">';
      for (let i = 1; i <= 30; i++) { const lock = i > s.campaign.stage, st = s.campaign.stars[i] || 0, boss = i % 5 === 0; h += `<button class="stg ${lock ? 'lock' : ''} ${boss ? 'boss' : ''} ${(this.sel.stage || s.campaign.stage) === i ? 'sel' : ''}" ${lock ? '' : `data-a="stage" data-v="${i}"`}><b>${boss ? '☗' : i}</b><small>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small></button>`; }
      h += '</div>';
    }
    if (s.mode === 'challenge') {
      h += '<h3 class="sec">Испытания</h3><div class="list">';
      D.CHALLENGES.forEach(c => { const done = s.challenges[c.id]; h += `<div class="row ${this.sel.ch === c.id ? 'sel' : ''}" data-a="ch" data-v="${c.id}"><i>${done ? '✓' : '⚑'}</i><div><b>${c.n}</b><p>${c.d}</p></div><small>${done ? 'Пройдено' : '◆' + c.rew.g + ' ¤' + c.rew.c}</small></div>`; });
      h += '</div>';
    }
    if (s.mode === 'boss') {
      h += '<h3 class="sec">Выбор босса</h3><div class="grid bosses">';
      D.BOSSES.filter(b => !b.secret).forEach(b => { const kills = s.stats['boss_' + b.id] || 0, rec = (s.records['boss_' + b.id] || [])[0]; h += `<div class="bcard ${this.sel.boss === b.id ? 'sel' : ''}" style="--bc:${b.col}" data-a="bosssel" data-v="${b.id}"><div class="bi">${D.ITEMS[b.relic].ic}</div><b>${b.n}</b><p>${b.d}</p><small>Побед: ${kills}${rec ? ' • Рекорд ' + rec.label : ''}</small><small>Награда: ${D.ITEMS[b.relic].n}</small></div>`; });
      h += '</div>';
    }
    const recs = s.records[s.mode === 'boss' ? 'boss_' + (this.sel.boss || 'firewall') : s.mode] || [];
    if (recs.length) { h += '<h3 class="sec">Таблица рекордов</h3><div class="list">'; recs.slice(0, 10).forEach((r, i) => { h += `<div class="row"><i>${i + 1}</i><div><b>${r.label}</b><p>${D.HEROES.find(x => x.id === r.hero).n} • ${new Date(r.date).toLocaleDateString('ru')}</p></div></div>`; }); h += '</div>'; }
    h += '<div class="pad"><button class="play wide" data-a="play">ИГРАТЬ</button></div>';
    return h;
  },

  /* ---------- БОЙЦЫ ---------- */
  s_heroes() {
    const s = P.s; let h = this.head('Бойцы', 'Выберите бойца и улучшайте его силу') + '<div class="grid heroes">';
    D.HEROES.forEach(H => {
      const hs = s.heroes[H.id], own = hs && hs.own, cs = own ? P.calc(H.id) : null;
      const lockTxt = H.unlock.t === 'trophy' ? '♛ ' + H.unlock.v + ' трофеев' : '◆ ' + H.unlock.v;
      h += `<div class="hcard ${own ? '' : 'lock'} ${s.hero === H.id ? 'sel' : ''}" style="--hc:${H.col}">
        ${this.heroOrb(H, 120, !own)}
        <b>${H.n}</b><small>${H.role}</small><p>${H.d}</p>
        <div class="sup">★ ${H.sup.n}: ${H.sup.d}</div>
        ${own ? `<div class="hst"><span>❤ ${cs.maxHp}</span><span>⚔ ${Math.round(cs.dmg)}${H.atk.n > 1 ? '×' + H.atk.n : ''}</span><span>⟳ ${cs.reload.toFixed(2)}с</span><span>♛ ${hs.tr}</span></div>
        <div class="pw">Сила ${hs.pow}/11 ${this.bar(hs.pow, 11, H.col)}</div>
        <div class="btns">${s.hero === H.id ? '<button class="btn dis">Выбран</button>' : `<button class="btn" data-a="pickhero" data-v="${H.id}">Выбрать</button>`}
        ${hs.pow < 11 ? `<button class="btn gold" data-a="uphero" data-v="${H.id}">⇮ ¤${P.heroUp(H.id).c} ⌬${P.heroUp(H.id).b}</button>` : '<button class="btn dis">MAX</button>'}</div>`
          : `<div class="btns">${H.unlock.t === 'gems' ? `<button class="btn gold" data-a="buyhero" data-v="${H.id}">Купить ◆${H.unlock.v}</button>` : '<button class="btn dis">' + lockTxt + '</button>'}</div>`}
      </div>`;
    });
    return h + '</div>';
  },

  /* ---------- ИНВЕНТАРЬ ---------- */
  s_inventory() {
    const s = P.s, cs = P.calc(s.hero), f = this.f.inv;
    let h = this.head('Инвентарь', s.inv.length + ' предметов') + '<div class="eqrow">';
    for (const sl in D.SLOTS) { const o = s.inv.find(i => i.uid === s.eq[sl]); h += o ? `<div class="slot full" data-a="item" data-v="${o.uid}" style="--rc:${this.rar(D.ITEMS[o.id].r)}"><i>${D.ITEMS[o.id].ic}</i><small>${D.SLOTS[sl]}</small><b>${D.ITEMS[o.id].n}</b></div>` : `<div class="slot"><i>+</i><small>${D.SLOTS[sl]}</small><b>Пусто</b></div>`; }
    h += '</div>';
    const sets = P.activeSets(); if (sets.length) h += '<div class="sets">' + sets.map(x => `<span>⚭ ${x.n}: ${x.d}</span>`).join('') + '</div>';
    h += `<div class="statsum"><span>❤ ${cs.maxHp}</span><span>⚔ ${Math.round(cs.dmg)}</span><span>⟳ ${cs.reload.toFixed(2)}с</span><span>✧ ${Math.round(cs.crit * 100)}%</span><span>⛨ ${Math.round(cs.armor * 100)}%</span><span>» ${Math.round(cs.spd)}</span><span>¤ +${Math.round((cs.coin - 1) * 100)}%</span><span>⚡ ${[...cs.fx].length} эфф.</span></div>`;
    h += '<div class="chips">' + [['all', 'Все'], ...Object.entries(D.SLOTS)].map(([k, n]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="finv" data-v="${k}">${n}</button>`).join('') + '</div>';
    const L = s.inv.filter(o => f === 'all' || D.ITEMS[o.id].slot === f).sort((a, b) => D.ITEMS[b.id].r - D.ITEMS[a.id].r || b.lvl - a.lvl);
    h += '<div class="grid items">' + (L.length ? L.map(o => this.itemCard(o)).join('') : '<p class="empty">Пусто. Предметы выпадают из кейсов, сундуков, боссов и врагов.</p>') + '</div>';
    return h;
  },
  statLines(st, cmp) {
    const keys = new Set([...Object.keys(st), ...Object.keys(cmp || {})]); let h = '';
    keys.forEach(k => { const v = st[k] || 0, c = cmp ? (cmp[k] || 0) : null, N = D.STATN[k] || [k, '']; const d = c === null ? '' : v - c; h += `<div class="sl"><span>${N[0]}</span><b>${v > 0 ? '+' : ''}${v}${N[1]}</b>${d !== '' && d !== 0 ? `<em class="${(d > 0) !== (k === 'dashcd') ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(Math.round(d * 10) / 10)}</em>` : ''}</div>`; });
    return h;
  },
  itemModal(uid) {
    const s = P.s, o = s.inv.find(i => i.uid === +uid); if (!o) return this.closeModal();
    const it = D.ITEMS[o.id], st = P.itemStats(o), eqUid = s.eq[it.slot], isEq = eqUid === o.uid;
    const cur = !isEq && eqUid ? s.inv.find(i => i.uid === eqUid) : null, cst = cur ? P.itemStats(cur) : (isEq ? null : {});
    const set = D.SETS.find(x => x.items.includes(it.id));
    this.showModal(`<div class="idet" style="--rc:${this.rar(it.r)}">
      <div class="big">${it.ic}</div><h3>${it.n}</h3><div class="rt">${D.RAR[it.r].n} • ${D.SLOTS[it.slot]} • ур. ${o.lvl}/10</div>
      <div class="sls">${this.statLines(st, cst)}</div>
      ${it.fx ? `<div class="fx">⚡ ${D.FX[it.fx]}</div>` : ''}
      ${set ? `<div class="setinfo">⚭ Комплект «${set.n}»: ${set.items.map(i => D.ITEMS[i].n).join(' + ')}</div>` : ''}
      ${cur ? `<div class="cmp">Сравнение с: ${D.ITEMS[cur.id].n} (ур. ${cur.lvl})</div>` : ''}
      <div class="btns">
        ${isEq ? `<button class="btn" data-a="unequip" data-v="${it.slot}">Снять</button>` : `<button class="btn prim" data-a="equip" data-v="${o.uid}">Надеть</button>`}
        ${o.lvl < 10 ? `<button class="btn gold ${s.credits < P.upCost(o) ? 'dis' : ''}" data-a="upitem" data-v="${o.uid}">Улучшить ¤${P.upCost(o)}</button>` : '<button class="btn dis">MAX</button>'}
        <button class="btn red" data-a="sell" data-v="${o.uid}">Разобрать +¤${P.sellVal(o)}</button>
      </div><button class="x" data-a="close">✕</button></div>`);
  },

  /* ---------- НАВЫКИ ---------- */
  s_skills() {
    const s = P.s; let h = this.head('Дерево навыков', 'Свободно очков: ' + P.spFree() + ' из ' + P.spTotal());
    h += `<div class="pad row2"><span>Очки дают уровни аккаунта и престиж.</span><button class="btn small" data-a="resetsk">Сброс ◆20</button>${P.canPrestige() ? '<button class="btn gold small" data-a="prestige">✺ ПРЕСТИЖ</button>' : ''}</div><div class="tree">`;
    for (const b in D.BRANCH) {
      const [nm, col] = D.BRANCH[b]; h += `<div class="branch" style="--bc:${col}"><h3>${nm}</h3>`;
      D.SKILLS.filter(x => x.b === b).forEach((sk, i) => {
        const r = s.skills[sk.id] || 0, can = P.canLearn(sk), lock = sk.tier > 0 && !(s.skills[D.SKILLS.find(x => x.b === b && x.tier === sk.tier - 1).id] > 0);
        h += `${i ? '<div class="link ' + (lock ? '' : 'on') + '"></div>' : ''}<div class="node ${r ? 'got' : ''} ${r >= sk.max ? 'max' : ''} ${can ? 'can' : ''} ${lock ? 'lock' : ''}" data-a="skill" data-v="${sk.id}"><b>${sk.n}</b><small>${r}/${sk.max}</small></div>`;
      });
      h += '</div>';
    }
    return h + '</div>';
  },
  skDesc(sk) { let t = Object.entries(sk.st).map(([k, v]) => (D.STATN[k] || [k, ''])[0] + ' ' + (v > 0 ? '+' : '') + v + (D.STATN[k] || ['', ''])[1]).join(', '); if (sk.fx) t += (t ? '. ' : '') + D.FX[sk.fx]; return t + (sk.max > 1 ? ' (за ранг)' : ''); },

  /* ---------- ДОСТИЖЕНИЯ ---------- */
  s_achievements() {
    const s = P.s, d = P.derived(), f = this.f.ach, fs = this.f.achSt, total = D.ACH.length, got = Object.keys(s.ach).length;
    let h = this.head('Достижения', got + ' / ' + total + ' открыто') + `<div class="pad">${this.bar(got, total)}</div>`;
    h += '<div class="chips">' + [['all', 'Все'], ...Object.entries(D.ACH_CAT)].map(([k, n]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="fach" data-v="${k}">${n}</button>`).join('') + '</div>';
    h += '<div class="chips">' + [['all', 'Любые'], ['done', 'Выполненные'], ['todo', 'Не выполненные']].map(([k, n]) => `<button class="chip ${fs === k ? 'on' : ''}" data-a="fachs" data-v="${k}">${n}</button>`).join('') + '</div><div class="grid achs">';
    D.ACH.filter(a => (f === 'all' || a.cat === f) && (fs === 'all' || (fs === 'done') === !!s.ach[a.id])).forEach(a => {
      const done = !!s.ach[a.id], hid = a.hid && !done, v = Math.min(a.tgt, P.achVal(a, d));
      const rw = [a.rew.c ? '¤' + a.rew.c : '', a.rew.g ? '◆' + a.rew.g : '', a.rew.t ? 'Титул «' + a.rew.t + '»' : ''].filter(Boolean).join(' • ');
      h += `<div class="acard ${done ? 'done' : ''}" style="--rc:${this.rar(a.r)}"><div class="aic">${hid ? '?' : a.ic}</div><div class="atx"><b>${hid ? 'Секретное достижение' : a.n}</b><p>${hid ? 'Условие скрыто. Исследуйте систему.' : a.d}</p>${!done && !hid ? this.bar(v, a.tgt) + '<small>' + fmt(v) + ' / ' + fmt(a.tgt) + '</small>' : ''}<small class="rw">${D.RAR[a.r].n} • ${rw}</small></div>${done ? '<i class="ck">✓</i>' : ''}</div>`;
    });
    return h + '</div>';
  },

  /* ---------- ЗАДАНИЯ ---------- */
  s_quests() {
    P.ensureDaily(); const s = P.s, d = s.daily, now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const left = Math.floor((mid - now) / 60000);
    let h = this.head('Ежедневные задания', 'Обновление через ' + Math.floor(left / 60) + 'ч ' + left % 60 + 'м');
    h += `<div class="qhead"><div><b>🔥 ${s.questStreak}</b><small>дней серии</small></div><div><b>${d.quests.filter(q => q.done).length}/5</b><small>выполнено</small></div><div><b>${d.bonus ? '✓' : '▣'}</b><small>Бонус: Большой кейс</small></div></div><div class="list">`;
    d.quests.forEach((q, i) => {
      const v = P.qProg(q), r = P.qRew(q), ok = v >= q.tgt;
      h += `<div class="qcard ${q.done ? 'done' : ''}"><div class="qt"><b>${q.n}</b><small>${['Лёгкое', 'Среднее', 'Сложное'][q.tier]} • ¤${r.c} • ${r.xp} опыта${r.g ? ' • ◆' + r.g : ''}</small>${this.bar(v, q.tgt)}<small>${v} / ${q.tgt}</small></div>${q.done ? '<button class="btn dis">✓</button>' : `<button class="btn ${ok ? 'gold' : 'dis'}" data-a="claimq" data-v="${i}">Забрать</button>`}</div>`;
    });
    h += '</div><h3 class="sec">Награды за серии</h3><div class="grid achs">';
    D.ACH.filter(a => a.cat === 'streak').forEach(a => { const done = !!s.ach[a.id]; h += `<div class="acard mini ${done ? 'done' : ''}" style="--rc:${this.rar(a.r)}"><div class="aic">${a.ic}</div><div class="atx"><b>${a.n}</b><p>${a.d}</p></div>${done ? '<i class="ck">✓</i>' : ''}</div>`; });
    return h + '</div>';
  },

  /* ---------- МАГАЗИН ---------- */
  s_shop() {
    const s = P.s, f = this.f.shop, now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0); const left = Math.floor((mid - now) / 60000);
    let h = this.head('Магазин', 'Все покупки — за игровую валюту') + '<div class="chips">' + [['offers', 'Предложения дня'], ['cases', 'Кейсы'], ...Object.entries(D.SHOPCAT), ['ex', 'Обмен']].map(([k, n]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="fshop" data-v="${k}">${n}</button>`).join('') + '</div>';
    if (f === 'offers') {
      h += `<p class="pad muted">Новые предложения через ${Math.floor(left / 60)}ч ${left % 60}м</p><div class="grid shop">`;
      P.offers().forEach(o => {
        const b = s.daily.bought.includes(o.id); let ic, n, sub, col = '#7b3dff';
        if (o.t === 'item') { const it = D.ITEMS[o.v]; ic = it.ic; n = it.n; sub = D.RAR[it.r].n; col = this.rar(it.r); }
        else if (o.t === 'case') { ic = '▣'; n = D.CASES[o.v].n; sub = 'Кейс'; col = D.CASES[o.v].col; }
        else if (o.t === 'bits') { ic = '⌬'; n = o.v + ' битов'; sub = 'Для улучшения бойцов'; }
        else { ic = '¤'; n = o.v + ' кредитов'; sub = 'Валюта'; col = '#ffd23d'; }
        h += `<div class="scard" style="--rc:${col}"><div class="sic">${ic}</div><b>${n}</b><small>${sub}</small>${b ? '<button class="btn dis">Куплено</button>' : `<button class="btn gold" data-a="buyoffer" data-v="${o.id}">${o.g ? '◆' : '¤'}${o.p}</button>`}</div>`;
      });
      h += '</div>';
    } else if (f === 'cases') {
      h += '<div class="grid shop">'; for (const k in D.CASES) { const c = D.CASES[k]; h += `<div class="scard" style="--rc:${c.col}"><div class="sic">▣</div><b>${c.n}</b><small>${c.rolls} наград • у вас: ${s.cases[k]}</small><button class="btn gold" data-a="buycase" data-v="${k}">${c.g ? '◆' : '¤'}${c.price}</button>${s.cases[k] ? `<button class="btn prim" data-a="opencase" data-v="${k}">Открыть</button>` : ''}</div>`; } h += '</div>';
    } else if (f === 'ex') {
      h += `<div class="grid shop"><div class="scard" style="--rc:#ffd23d"><div class="sic">¤</div><b>300 кредитов</b><small>за 10 осколков</small><button class="btn gold" data-a="exch" data-v="1">◆10</button></div><div class="scard" style="--rc:#3dffa0"><div class="sic">⌬</div><b>40 битов</b><small>за 10 осколков</small><button class="btn gold" data-a="exch" data-v="2">◆10</button></div></div>`;
    } else {
      h += '<div class="grid shop">'; D.SHOP.filter(x => x.cat === f).forEach(x => {
        const own = s.shop.owned.includes(x.id), eq = s.shop.eq[x.cat] === x.id;
        let prev = '';
        if (x.cat === 'theme') prev = `<div class="sw" style="background:linear-gradient(135deg,${x.v[0]},${x.v[1]})"></div>`;
        else if (x.cat === 'field') { const v = x.v || D.BIOMES[0]; prev = `<div class="sw" style="background:${v.floor};border:2px solid ${v.edge}"></div>`; }
        else if (x.cat === 'skin') { const H = D.HEROES.find(q => q.id === s.hero) || D.HEROES[0]; prev = `<canvas class="herocv" data-h="${H.id}" data-skin="${x.v}" width="240" height="240" style="width:120px;height:120px"></canvas>`; }
        else prev = `<canvas class="fxcv" data-k="${x.cat}" data-v="${x.v}" width="240" height="160" style="width:150px;height:100px"></canvas>`;
        h += `<div class="scard ${eq ? 'sel' : ''}">${prev}<b>${x.n}</b><small>${D.SHOPCAT[x.cat]}</small>${own ? (eq ? '<button class="btn dis">Выбрано</button>' : `<button class="btn prim" data-a="cos" data-v="${x.id}">Выбрать</button>`) : `<button class="btn gold" data-a="buycos" data-v="${x.id}">${x.g ? '◆' : '¤'}${x.p}</button>`}</div>`;
      }); h += '</div>';
    }
    return h;
  },

  /* ---------- МУЗЕЙ ---------- */
  s_museum() {
    const s = P.s, found = Object.keys(s.museum.items).length;
    let h = this.head('Музей редкостей', found + ' / ' + D.ITEM_LIST.length + ' предметов найдено') + `<div class="pad">${this.bar(found, D.ITEM_LIST.length, 'linear-gradient(90deg,#b44dff,#ff3d7f)')}</div>`;
    h += '<h3 class="sec">Реликвии боссов</h3><div class="grid items">';
    D.ITEM_LIST.filter(i => i.boss).forEach(it => { const f = s.museum.items[it.id]; h += `<div class="icard r5 ${f ? '' : 'unk'}" style="--rc:${this.rar(5)}"><div class="ic">${f ? it.ic : '?'}</div><div class="in">${f ? it.n : '???'}</div><div class="il">${f ? new Date(f).toLocaleDateString('ru') : 'Не найдено'}</div></div>`; });
    h += '</div>';
    for (const sl in D.SLOTS) {
      h += `<h3 class="sec">${D.SLOTS[sl]}</h3><div class="grid items">`;
      D.ITEM_LIST.filter(i => i.slot === sl && !i.boss).forEach(it => { const f = s.museum.items[it.id]; h += `<div class="icard r${it.r} ${f ? '' : 'unk'}" style="--rc:${this.rar(it.r)}" ${f ? `data-a="museumitem" data-v="${it.id}"` : ''}><div class="ic">${f ? it.ic : '?'}</div><div class="in">${f ? it.n : '???'}</div><div class="il">${D.RAR[it.r].n}</div></div>`; });
      h += '</div>';
    }
    h += '<h3 class="sec">Комплекты</h3><div class="list">' + D.SETS.map(st => { const ok = st.items.every(i => s.museum.items[i]); return `<div class="row"><i>⚭</i><div><b>${ok ? st.n : '???'}</b><p>${ok ? st.items.map(i => D.ITEMS[i].n).join(' + ') + ' — ' + st.d : 'Найдите все предметы комплекта'}</p></div></div>`; }).join('') + '</div>';
    const eggs = [['logo', 'Тайна логотипа'], ['konami', 'Код старой школы'], ['name', 'Имя бога'], ['code', 'Секретный код']];
    h += '<h3 class="sec">Пасхалки</h3><div class="list">' + eggs.map(([k, n]) => `<div class="row"><i>${s.museum.eggs[k] ? '✦' : '?'}</i><div><b>${s.museum.eggs[k] ? n : '???'}</b></div></div>`).join('') + '</div>';
    return h;
  },

  /* ---------- СТАТИСТИКА ---------- */
  s_stats() {
    const s = P.s, st = s.stats, pt = st.playTime || 0;
    const rows = [['Забегов', st.runs], ['Секторов пройдено', st.sectors], ['Врагов уничтожено', st.kills], ['Боссов побеждено', st.bossKills], ['Ядер собрано', st.cores], ['Секретных комнат', st.secretRooms], ['Сундуков открыто', st.chests], ['Нанесено урона', st.damage], ['Макс. комбо', st.maxCombo], ['Лучший сектор (бесконечный)', st.maxEndless], ['Лучшая серия побед', st.bestStreak], ['Секторов без урона', st.perfect], ['Кредитов заработано', st.coinsEarned], ['Кейсов открыто', st.casesOpened], ['Время в забегах', Math.floor(pt / 3600) + 'ч ' + Math.floor(pt % 3600 / 60) + 'м']];
    let h = this.head('Статистика', 'Завершение игры: ' + P.completion() + '%') + '<div class="grid statg">' + rows.map(r => `<div class="stc"><b>${typeof r[1] === 'string' ? r[1] : fmt(r[1] || 0)}</b><small>${r[0]}</small></div>`).join('') + '</div>';
    h += '<h3 class="sec">Рекорды</h3><div class="list">';
    D.MODES.forEach(m => { if (m.id === 'boss') { D.BOSSES.filter(b => !b.secret).forEach(b => { const r = (s.records['boss_' + b.id] || [])[0]; h += `<div class="row"><i>☗</i><div><b>${b.n}</b><p>${r ? 'Лучшее время: ' + r.label : '—'}</p></div></div>`; }); return; } const r = (s.records[m.id] || [])[0]; h += `<div class="row"><i>${m.ic}</i><div><b>${m.n}</b><p>${r ? r.label + ' • ' + D.HEROES.find(x => x.id === r.hero).n : '—'}</p></div></div>`; });
    h += '</div><h3 class="sec">История забегов</h3><div class="list">';
    if (!s.history.length) h += '<p class="empty">Ещё нет забегов.</p>';
    s.history.forEach(r => { const m = D.MODES.find(x => x.id === r.mode) || { n: 'NULL', ic: '∅' }; h += `<div class="row ${r.win ? 'win' : 'loss'}"><i>${r.win ? '✓' : '✕'}</i><div><b>${m.n} • ${D.HEROES.find(x => x.id === r.hero).n}</b><p>${r.sectors} сект. • ${r.kills} убийств • ${r.time}с • ¤${r.credits} • ♛${r.tr > 0 ? '+' : ''}${r.tr}</p></div><small>${new Date(r.d).toLocaleDateString('ru')}</small></div>`; });
    return h + '</div>';
  },

  /* ---------- ПУТЬ ТРОФЕЕВ ---------- */
  s_road() {
    const s = P.s, t = P.trophies(); let h = this.head('Путь трофеев', '♛ ' + t + ' трофеев') + '<div class="road">';
    const heroesAt = D.HEROES.filter(x => x.unlock.t === 'trophy');
    D.ROAD.forEach((r, i) => {
      const got = s.road.includes(i), ok = t >= r.at; const hero = heroesAt.find(x => x.unlock.v <= r.at && x.unlock.v > (D.ROAD[i - 1] || { at: 0 }).at);
      const lbl = r.t === 'c' ? '¤ ' + r.v + ' кредитов' : r.t === 'g' ? '◆ ' + r.v + ' осколков' : r.t === 'bits' ? '⌬ ' + r.v + ' битов' : '▣ ' + D.CASES[r.v].n;
      h += `${hero ? `<div class="rnode hero" style="--hc:${hero.col}"><b>♛ ${hero.unlock.v}</b><span>Боец: ${hero.n}</span><i>${(s.heroes[hero.id] || {}).own ? '✓' : '🔒'}</i></div>` : ''}<div class="rnode ${ok ? 'ok' : ''} ${got ? 'got' : ''}"><b>♛ ${r.at}</b><span>${lbl}</span>${got ? '<i>✓</i>' : ok ? `<button class="btn gold small" data-a="road" data-v="${i}">Забрать</button>` : '<i>🔒</i>'}</div>`;
    });
    return h + '</div>';
  },

  /* ---------- ПРОФИЛЬ ---------- */
  s_profile() {
    const s = P.s, comp = P.completion(), rare = s.inv.slice().sort((a, b) => D.ITEMS[b.id].r - D.ITEMS[a.id].r || b.lvl - a.lvl).slice(0, 4);
    let h = this.head('Профиль', '') + `<div class="profile">
      <div class="pcard">
        <div class="pav">${esc(s.avatar)}</div>
        <input class="nmi" maxlength="16" value="${esc(s.name)}" id="nameIn"><button class="btn small" data-a="savename">Сохранить имя</button>
        <div class="ptitle">«${esc(s.title)}»</div>
        <div class="ring" style="--p:${comp}"><b>${comp}%</b><small>игры пройдено</small></div>
        <div class="pst"><span>Уровень <b>${s.lvl}</b></span><span>Престиж <b>${s.prestige}</b></span><span>Трофеи <b>${P.trophies()}</b></span><span>Достижения <b>${Object.keys(s.ach).length}/${D.ACH.length}</b></span><span>Бойцы <b>${Object.values(s.heroes).filter(x => x.own).length}/6</b></span><span>Предметы <b>${Object.keys(s.museum.items).length}/${D.ITEM_LIST.length}</b></span></div>
        ${this.bar(s.xp, P.xpNeed(s.lvl))}<small>${s.xp} / ${P.xpNeed(s.lvl)} опыта${s.lvl >= 50 ? ' • Доступен ПРЕСТИЖ' : ''}</small>
        ${P.canPrestige() ? '<button class="btn gold" data-a="prestige">✺ Совершить престиж</button>' : '<small class="muted">Престиж откроется на 50 уровне: сброс уровня и навыков ради постоянного бонуса +5% ко всему.</small>'}
      </div>
      <h3 class="sec">Аватар</h3><div class="avs">${D.AVATARS.map((a, i) => { const lock = i >= 4 && s.lvl < i * 3 && !s.prestige; return `<button class="avb ${s.avatar === a ? 'on' : ''} ${lock ? 'lock' : ''}" ${lock ? '' : `data-a="avatar" data-v="${a}"`}>${lock ? '🔒' : a}${lock ? '<small>ур.' + i * 3 + '</small>' : ''}</button>`; }).join('')}</div>
      <h3 class="sec">Титул</h3><div class="chips">${P.titles().map(t => `<button class="chip ${s.title === t ? 'on' : ''}" data-a="title" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <h3 class="sec">Витрина редкостей</h3><div class="grid items">${rare.length ? rare.map(o => this.itemCard(o)).join('') : '<p class="empty">Пока пусто</p>'}</div>
    </div>`;
    return h;
  },

  /* ---------- НАСТРОЙКИ ---------- */
  s_settings() {
    const st = P.s.settings; const tg = (k, n) => `<div class="set"><span>${n}</span><button class="tog ${st[k] ? 'on' : ''}" data-a="tog" data-v="${k}"><i></i></button></div>`;
    return this.head('Настройки') + `<div class="setts">
      <div class="set"><span>Звуки</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-in="sfx"></div>
      <div class="set"><span>Музыка</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-in="music"></div>
      <div class="set"><span>Размер кнопок</span><input type="range" min="0.8" max="1.3" step="0.05" value="${st.ctrl}" data-in="ctrl"></div>
      <div class="set"><span>Графика боя</span><div class="seg"><button class="${st.r3d !== false ? 'on' : ''}" data-a="r3d" data-v="1">3D</button><button class="${st.r3d === false ? 'on' : ''}" data-a="r3d" data-v="0">2D</button></div></div>
      ${tg('vib', 'Вибрация')}${tg('shake', 'Тряска экрана')}${tg('fps', 'Показывать FPS')}
      <div class="set"><span>Качество графики</span><div class="seg"><button class="${st.quality === 'high' ? 'on' : ''}" data-a="qual" data-v="high">Высокое</button><button class="${st.quality === 'low' ? 'on' : ''}" data-a="qual" data-v="low">Экономия</button></div></div>
      <h3 class="sec">Сохранения</h3>
      <div class="btns"><button class="btn prim" data-a="export">⇩ Экспорт JSON</button><button class="btn" data-a="copysave">Копировать</button><label class="btn">⇧ Импорт файла<input type="file" accept=".json,application/json" id="impFile" hidden></label></div>
      <textarea id="impTxt" placeholder="…или вставьте сюда текст сохранения"></textarea><button class="btn" data-a="importtxt">Загрузить из текста</button>
      <h3 class="sec">Секретный код</h3><div class="btns"><input id="codeIn" class="nmi" placeholder="Введите код"><button class="btn" data-a="code">Активировать</button></div>
      <h3 class="sec">Опасная зона</h3><button class="btn red" data-a="wipe">Сбросить весь прогресс</button>
      <p class="muted">GLITCH//ZERO • прогресс хранится в этом браузере. Делайте экспорт, чтобы перенести его на другое устройство.</p>
    </div>`;
  },

  /* ---------- Действия ---------- */
  act(a, v, t) {
    const s = P.s;
    switch (a) {
      case 'go': this.go(v); break;
      case 'close': this.closeModal(); break;
      case 'logo': s.secret.logo++; if (s.secret.logo >= 7 && !s.stats.egg_logo) { s.stats.egg_logo = 1; s.museum.eggs.logo = 1; this.toast({ t: 'ach', n: 'Система заметила вас...', d: 'Что-то изменилось', r: 4 }); P.checkAch(); P.save(); } document.querySelector('.glyph-logo')?.classList.add('gl'); setTimeout(() => document.querySelector('.glyph-logo')?.classList.remove('gl'), 300); break;
      case 'mode': s.mode = v; P.save(); this.render(); break;
      case 'stage': this.sel.stage = +v; this.render(); break;
      case 'ch': this.sel.ch = v; this.render(); break;
      case 'bosssel': this.sel.boss = v; this.render(); break;
      case 'play': this.play(); break;
      case 'pickhero': s.hero = v; P.save(); this.render(); break;
      case 'uphero': if (P.upHero(v)) { SFX.play('ach'); this.render(); } else this.toast({ n: 'Недостаточно ресурсов', d: 'Нужны кредиты и биты' }); break;
      case 'buyhero': if (P.buyHero(v)) { SFX.play('ach'); this.render(); } else this.toast({ n: 'Недостаточно осколков' }); break;
      case 'item': this.itemModal(v); break;
      case 'equip': P.equip(+v); this.closeModal(); this.render(); break;
      case 'unequip': P.unequip(v); this.closeModal(); this.render(); break;
      case 'upitem': if (P.upgrade(+v)) { SFX.play('ach'); this.render(); this.itemModal(v); } else this.toast({ n: 'Недостаточно кредитов' }); break;
      case 'cfy': { const f = this.cfCb; this.cfCb = null; this.closeModal(); if (f) f(); break; }
      case 'sell': this.ask('Разобрать предмет? Вы получите кредиты.', () => { P.sell(+v); this.render(); }); break;
      case 'museumitem': { const it = D.ITEMS[v]; this.showModal(`<div class="idet" style="--rc:${this.rar(it.r)}"><div class="big">${it.ic}</div><h3>${it.n}</h3><div class="rt">${D.RAR[it.r].n} • ${D.SLOTS[it.slot]}</div><div class="sls">${this.statLines(it.st)}</div>${it.fx ? '<div class="fx">⚡ ' + D.FX[it.fx] + '</div>' : ''}<small>Найден: ${new Date(s.museum.items[v]).toLocaleString('ru')}</small><button class="x" data-a="close">✕</button></div>`); break; }
      case 'finv': this.f.inv = v; this.render(); break;
      case 'fach': this.f.ach = v; this.render(); break;
      case 'fachs': this.f.achSt = v; this.render(); break;
      case 'fshop': this.f.shop = v; this.render(); break;
      case 'skill': { const sk = D.SKILLS.find(x => x.id === v), r = s.skills[v] || 0; this.showModal(`<div class="idet" style="--rc:${D.BRANCH[sk.b][1]}"><div class="big">⟡</div><h3>${sk.n}</h3><div class="rt">${D.BRANCH[sk.b][0]} • ранг ${r}/${sk.max}</div><p>${this.skDesc(sk)}</p><div class="btns">${P.canLearn(sk) ? `<button class="btn gold" data-a="learn" data-v="${v}">Изучить (1 очко)</button>` : `<button class="btn dis">${r >= sk.max ? 'Изучено полностью' : P.spFree() <= 0 ? 'Нет очков' : 'Изучите предыдущий навык'}</button>`}</div><button class="x" data-a="close">✕</button></div>`); break; }
      case 'learn': if (P.learn(v)) { SFX.play('ach'); this.render(); this.act('skill', v); } break;
      case 'resetsk': this.ask('Сбросить все навыки за 20 осколков?', () => { if (!P.resetSkills()) this.toast({ n: 'Недостаточно осколков' }); this.render(); }); break;
      case 'prestige': this.ask('Престиж: уровень и навыки сбросятся, вы получите постоянный бонус +5% и 100 осколков. Продолжить?', () => { P.doPrestige(); this.render(); }); break;
      case 'claimq': if (P.claimQuest(+v)) { SFX.play('ach'); this.render(); } break;
      case 'road': if (P.claimRoad(+v)) { SFX.play('ach'); this.render(); } break;
      case 'buyoffer': if (P.buyOffer(v)) { SFX.play('coin'); this.render(); } else this.toast({ n: 'Недостаточно валюты' }); break;
      case 'buycase': if (P.buyCase(v)) { SFX.play('coin'); this.render(); } else this.toast({ n: 'Недостаточно валюты' }); break;
      case 'buycos': if (P.buy(v)) { SFX.play('ach'); this.applyTheme(); this.render(); } else this.toast({ n: 'Недостаточно валюты' }); break;
      case 'cos': s.shop.eq[D.SHOPM[v].cat] = v; P.save(); this.applyTheme(); this.render(); break;
      case 'exch': if (s.gems >= 10) { s.gems -= 10; if (v === '1') s.credits += 300; else s.bits += 40; P.save(); this.render(); } else this.toast({ n: 'Недостаточно осколков' }); break;
      case 'cases': this.casesModal(); break;
      case 'opencase': this.openCase(v); break;
      case 'savename': { const n = document.getElementById('nameIn').value.trim().slice(0, 16) || 'Игрок'; s.name = n; if (n.toUpperCase() === 'ZERO') { s.stats.egg_name = 1; s.museum.eggs.name = 1; } P.checkAch(); P.save(); this.render(); break; }
      case 'avatar': s.avatar = v; P.save(); this.render(); break;
      case 'title': s.title = v; P.save(); this.render(); break;
      case 'tog': s.settings[v] = !s.settings[v]; P.save(); this.render(); break;
      case 'r3d': s.settings.r3d = v === '1'; P.save(); this.render(); break;
      case 'qual':s.settings.quality = v; P.save(); G.resize(); this.render(); break;
      case 'export': { const ta = document.getElementById('impTxt'); if (ta) ta.value = SaveSys.exportJSON(s); this.toast({ n: 'Сохранение готово', d: 'Текст в поле ниже — скопируйте его. В обычном браузере также скачается файл.' }); const b = new Blob([SaveSys.exportJSON(s)], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'glitchzero-save-' + P.today() + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); break; }
      case 'copysave': { const txt = SaveSys.exportJSON(s); const ta = document.getElementById('impTxt'); ta.value = txt; ta.select(); try { navigator.clipboard.writeText(txt).then(() => this.toast({ n: 'Скопировано' })); } catch (e) { document.execCommand('copy'); } break; }
      case 'importtxt': this.doImport(document.getElementById('impTxt').value); break;
      case 'code': this.code(document.getElementById('codeIn').value); break;
      case 'wipe': this.ask('Удалить ВЕСЬ прогресс? Это нельзя отменить.', () => setTimeout(() => this.ask('Точно? Последнее предупреждение.', () => { SaveSys.wipe(); location.reload(); }), 50)); break;
      case 'resume': this.closeModal(); this.hideUI(); G.resume(); break;
      case 'quit': this.closeModal(); G.state = 'dying'; G.end(false); break;
      case 'route': { const r = this.routes[+v]; this.closeModal(); SFX.play('portal'); G.chooseRoute(r); break; }
      case 'perk': { const pk = this.perks[+v]; this.closeModal(); G.takePerk(pk); break; }
      case 'mbuy': if (G.merchantBuy(+v)) this.merchant(); else this.toast({ n: 'Мало кредитов забега' }); break;
      case 'again': this.play(); break;
      case 'tutgo': s.tutorial = true; P.save(); this.closeModal(); G.resume(); break;
    }
  },
  ask(msg, cb) { this.cfCb = cb; this.showModal(`<h3>Подтверждение</h3><p class="muted" style="font-size:13px;margin:10px 0">${msg}</p><div class="btns"><button class="btn" data-a="close">Отмена</button><button class="btn red" data-a="cfy">Да</button></div>`); },
  doImport(txt) {
    try { const ns = SaveSys.importJSON(txt); SaveSys.save(ns); this.toast({ n: 'Сохранение загружено' }); setTimeout(() => location.reload(), 600); }
    catch (e) { this.toast({ n: 'Ошибка импорта', d: e.message || 'Неверный файл' }); }
  },
  code(c) {
    const s = P.s; c = (c || '').trim().toUpperCase(); s.secret.codes = s.secret.codes || [];
    const codes = { GLITCH: { g: 50 }, ZERO: { c: 1000 }, NEON: { case: 'b' }, NULL: { hint: 1 } };
    if (!codes[c]) return this.toast({ n: 'Неверный код' });
    if (s.secret.codes.includes(c)) return this.toast({ n: 'Код уже использован' });
    s.secret.codes.push(c); const r = codes[c]; s.museum.eggs.code = 1;
    if (r.g) s.gems += r.g; if (r.c) s.credits += r.c; if (r.case) s.cases[r.case]++;
    if (r.hint) this.toast({ n: 'Подсказка NULL', d: 'Пять тайных комнат. Семь касаний имени. Одна золотая погоня.', r: 5 });
    else this.toast({ n: 'Код активирован!', r: 3 });
    P.save(); this.render();
  },
  casesModal() {
    const s = P.s; let h = '<h3>Ваши кейсы</h3><div class="grid shop">';
    for (const k in D.CASES) { const c = D.CASES[k]; h += `<div class="scard" style="--rc:${c.col}"><div class="sic">▣</div><b>${c.n}</b><small>×${s.cases[k]}</small>${s.cases[k] ? `<button class="btn gold" data-a="opencase" data-v="${k}">Открыть</button>` : '<button class="btn dis">Нет</button>'}</div>`; }
    h += '</div><p class="muted">Кейсы дают награды за победы, путь трофеев, задания и в магазине.</p><button class="x" data-a="close">✕</button>';
    this.showModal(h);
  },
  openCase(k) {
    const out = P.openCase(k); if (!out) return;
    SFX.play('open');
    const c = D.CASES[k];
    this.showModal(`<div class="caseopen" style="--rc:${c.col}"><div class="cbox">▣</div><h3>${c.n}</h3><div class="loot">${out.map((o, i) => {
      let ic, n, col = '#fff';
      if (o.t === 'c') { ic = '¤'; n = '+' + o.v + ' кредитов'; col = '#ffd23d'; } else if (o.t === 'bits') { ic = '⌬'; n = '+' + o.v + ' битов'; col = '#3dffa0'; } else if (o.t === 'g') { ic = '◆'; n = '+' + o.v + ' осколков'; col = '#ff3dc8'; }
      else if (o.t === 'item') { const it = D.ITEMS[o.v]; ic = it.ic; n = it.n; col = this.rar(it.r); } else { const H = D.HEROES.find(x => x.id === o.v); ic = '☻'; n = 'НОВЫЙ БОЕЦ: ' + H.n; col = H.col; }
      return `<div class="lc" style="--rc:${col};animation-delay:${0.5 + i * 0.25}s"><i>${ic}</i><span>${n}</span></div>`;
    }).join('')}</div><button class="btn gold" data-a="cases">Готово</button></div>`, 'wide');
    setTimeout(() => SFX.play('ach'), 500);
  },
  play() {
    const s = P.s, m = s.mode; this.closeModal();
    const cfg = { mode: m };
    if (m === 'campaign') { cfg.stage = Math.min(30, this.sel.stage || s.campaign.stage); if (s.campaign.stage > 30 && !this.sel.stage) cfg.stage = 30; }
    if (m === 'challenge') cfg.chId = this.sel.ch || 'c_onehp';
    if (m === 'boss') cfg.boss = this.sel.boss || 'firewall';
    if (m === 'secret' && !this.secretState().every(x => x)) { s.mode = 'campaign'; return this.render(); }
    this.hideUI(); G.resize(); G.start(cfg);
    if (!s.tutorial) { G.state = 'paused'; this.showModal(`<h3>Как играть</h3><div class="tut"><p>◆ Собери <b>ядра энергии</b>, чтобы открыть <b>портал</b> — стрелка у края экрана подскажет путь.</p><p>📱 Левая половина экрана — <b>джойстик</b>. Кнопка <b>АТАКА</b>: тап — автоприцел, потяни — ручной прицел.</p><p>★ <b>СУПЕР</b> заряжается от урона. <b>РЫВОК</b> делает вас неуязвимым на миг.</p><p>⌨ ПК: WASD, мышь, пробел — супер, Shift — рывок.</p><p>⌧ Трещины в стенах можно сломать — за ними секреты!</p></div><button class="btn gold" data-a="tutgo">Поехали!</button>`); }
  },

  /* ---------- игровые модалки ---------- */
  pause() {
    const R = G.run, cs = G.cs;
    this.showModal(`<h3>ПАУЗА</h3><div class="pst"><span>Сектор <b>${R.sector}</b></span><span>Убийств <b>${R.kills}</b></span><span>Кредиты <b>${R.coins}</b></span><span>Добыча <b>${R.loot.length}</b></span></div>
      <div class="fxlist">${[...cs.fx].map(f => '<span>⚡ ' + D.FX[f] + '</span>').join('') || '<span class="muted">Нет особых эффектов</span>'}</div>
      <div class="btns col"><button class="btn gold" data-a="resume">Продолжить</button><button class="btn red" data-a="quit">Завершить забег</button></div>`);
  },
  routeMap(nodes, n, ms) {
    this.routes = nodes;
    const res = ms ? `<div class="msres ${ms.ok ? 'ok' : ''}"><b>✓ ${ms.n}</b><span>+¤${ms.coins}</span><small>${ms.ok ? '★ Бонус выполнен: ' + ms.side + ' (+8 ◆)' : '☆ Бонус не выполнен: ' + ms.side}</small></div>` : '';
    const ys = [18, 50, 82];
    const lines = nodes.map((x, i) => `<path d="M 0 50 C 55 50, 45 ${ys[i]}, 100 ${ys[i]}" stroke="${x.col}" />`).join('');
    this.showModal(`<div class="route"><h3>СЕКТОР ${n} ПРОЙДЕН</h3>${res}<p class="muted">Выберите путь — у каждого свой риск и награда</p>
      <div class="rmap"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg><div class="rnow"><i>◉</i><small>ВЫ ЗДЕСЬ</small></div>
      <div class="rnodes">${nodes.map((x, i) => `<button class="rnode" data-a="route" data-v="${i}" style="--rc:${x.col};animation-delay:${0.15 + i * 0.12}s"><i>${x.ic}</i><div><b>${x.n}</b><small>${x.d}</small></div></button>`).join('')}</div></div></div>`);
  },
  perk(ch, n) {
    this.perks = ch;
    this.showModal(`<h3>Сектор ${n} пройден!</h3><p class="muted">Выберите усиление на этот забег</p><div class="perks">${ch.map((p, i) => `<button class="perk" data-a="perk" data-v="${i}"><i>${p.ic}</i><b>${p.n}</b><small>${p.d}</small></button>`).join('')}</div>`);
  },
  merchant() {
    const R = G.run;
    this.showModal(`<h3>¤ Секретный торговец</h3><p class="muted">«Психи с портала платят наличными...» У вас: ¤${R.coins}</p><div class="list">${G.merchantOffers().map((o, i) => `<div class="row"><i>¤</i><div><b>${o.n}</b><p>${o.d}</p></div><button class="btn gold small ${R.coins < o.p ? 'dis' : ''}" data-a="mbuy" data-v="${i}">¤${o.p}</button></div>`).join('')}</div><button class="btn" data-a="resume">Уйти</button>`);
  },
  results(R, res) {
    const win = R.success, md = D.MODES.find(m => m.id === R.mode) || { n: 'Сектор NULL' };
    this.render0 = true; this.scr = 'lobby'; this.el.style.display = 'block'; document.body.classList.remove('ingame'); document.getElementById('pauseBtn').style.display = 'none';
    this.el.innerHTML = `<div class="results ${win ? 'win' : 'loss'}">
      <div class="rtitle">${win ? 'ПОБЕДА' : 'СБОЙ СИСТЕМЫ'}</div><div class="rsub">${md.n}${R.mode === 'campaign' ? ' • Сектор ' + R.stage : ''}${R.mode === 'campaign' && win ? ' • ' + '★'.repeat(R.stars) + '☆'.repeat(3 - R.stars) : ''}</div>
      ${res.rec ? '<div class="newrec">★ НОВЫЙ РЕКОРД ★</div>' : ''}
      <div class="grid statg">
        <div class="stc"><b>${R.sectors}</b><small>Секторов</small></div><div class="stc"><b>${R.kills}</b><small>Убийств</small></div>
        <div class="stc"><b>${R.cores}</b><small>Ядер</small></div><div class="stc"><b>×${R.maxCombo}</b><small>Макс. комбо</small></div>
        <div class="stc"><b>${Math.floor(R.time / 60)}:${String(Math.floor(R.time % 60)).padStart(2, '0')}</b><small>Время</small></div><div class="stc"><b>${Math.round(R.dmgTaken)}</b><small>Получено урона</small></div>
      </div>
      <div class="rew">
        <div class="rw tr"><i>♛</i><b data-count="${res.tr}">${res.tr > 0 ? '+' : ''}${res.tr}</b><small>Трофеи</small></div>
        <div class="rw cr"><i>¤</i><b data-count="${res.credits}">+${res.credits}</b><small>Кредиты</small></div>
        <div class="rw xp"><i>✦</i><b data-count="${res.xp}">+${res.xp}</b><small>Опыт</small></div>
        <div class="rw bt"><i>⌬</i><b>+${res.bits}</b><small>Биты</small></div>
      </div>
      ${res.streak > 1 ? `<div class="streak">🔥 Серия побед ${res.streak} — множитель наград ×${res.strMul.toFixed(2)}</div>` : ''}
      ${res.extra.map(x => '<div class="extra">✦ ' + x + '</div>').join('')}
      ${res.loot.length ? '<h3 class="sec">Добыча</h3><div class="grid items">' + res.loot.map((id, i) => { const it = D.ITEMS[id]; return `<div class="icard r${it.r} pop" style="--rc:${this.rar(it.r)};animation-delay:${0.3 + i * 0.15}s"><div class="ic">${it.ic}</div><div class="in">${it.n}</div><div class="il">${D.RAR[it.r].n}</div></div>`; }).join('') + '</div>' : ''}
      <div class="btns"><button class="btn" data-a="go" data-v="lobby">В лобби</button><button class="btn gold" data-a="again">Ещё раз</button></div>
    </div>`;
    this.el.querySelectorAll('[data-count]').forEach(el => { const tgt = +el.dataset.count; let t0 = performance.now(); const pre = tgt > 0 ? '+' : ''; const tick = n => { const f = Math.min(1, (n - t0) / 900); el.textContent = pre + Math.round(tgt * f); if (f < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    SFX.play(win ? 'ach' : 'lose');
  },

  /* ---------- уведомления ---------- */
  tq: [], tbusy: false,
  toast(o) { this.tq.push(o); if (o.t === 'ach') SFX.play('ach'); this.nextToast(); },
  nextToast() {
    const box = document.getElementById('toasts'); if (box.children.length >= (document.body.classList.contains('ingame') ? 1 : 3) || !this.tq.length) return;
    const o = this.tq.shift(), d = document.createElement('div'), col = o.r !== undefined ? D.RAR[o.r].c : '#7b3dff';
    d.className = 'toast ' + (o.t || ''); d.style.setProperty('--rc', col);
    const rw = o.rew ? [o.rew.c ? '¤' + o.rew.c : '', o.rew.g ? '◆' + o.rew.g : '', o.rew.t ? 'Титул «' + o.rew.t + '»' : ''].filter(Boolean).join(' ') : '';
    d.innerHTML = `${o.t === 'ach' ? '<div class="tic">' + (o.ic || '★') + '</div>' : ''}<div><small>${o.t === 'ach' ? (o.ic ? 'ДОСТИЖЕНИЕ' : 'НАГРАДА') : o.t === 'lvl' ? 'НОВЫЙ УРОВЕНЬ' : o.t === 'item' ? 'НАХОДКА' : 'GLITCH//ZERO'}</small><b>${esc(o.n)}</b>${o.d ? '<p>' + esc(o.d) + '</p>' : ''}${rw ? '<em>' + rw + '</em>' : ''}</div>`;
    box.appendChild(d); setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); this.nextToast(); }, 400); }, o.t === 'ach' ? 3600 : 2400);
    this.nextToast();
  }
};
