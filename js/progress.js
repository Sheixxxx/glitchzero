'use strict';
/* ===== Прогрессия, предметы, инвентарь, достижения, задания ===== */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function strSeed(s) { let h = 7; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 2654435761); return h >>> 0; }
function fmt(n) { n = Math.floor(n); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : '' + n; }

const P = {
  s: null, onToast: null, dirty: false,
  init(s) { this.s = s; this.ensureDaily(); this.checkHeroUnlocks(); },
  save() { SaveSys.save(this.s); },
  today(off = 0) { const d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  stat(k, n = 1) { const st = this.s.stats; st[k] = (st[k] || 0) + n; },
  statMax(k, v) { const st = this.s.stats; if (!(st[k] >= v)) st[k] = v; },
  toast(o) { if (this.onToast) this.onToast(o); },

  /* ---- Уровень и опыт ---- */
  xpNeed(l) { return 80 + l * 45; },
  addXp(n) {
    const s = this.s; s.xp += Math.round(n); let up = 0;
    while (s.lvl < 50 && s.xp >= this.xpNeed(s.lvl)) { s.xp -= this.xpNeed(s.lvl); s.lvl++; up++; s.credits += 50 + s.lvl * 10; }
    if (s.lvl >= 50) s.xp = Math.min(s.xp, this.xpNeed(50));
    if (up) this.toast({ t: 'lvl', n: 'Уровень ' + s.lvl + '!', d: '+1 очко навыков, +' + (50 + s.lvl * 10) + ' кредитов' });
    return up;
  },
  canPrestige() { return this.s.lvl >= 50; },
  doPrestige() {
    const s = this.s; if (!this.canPrestige()) return false;
    s.prestige++; s.lvl = 1; s.xp = 0; s.skills = {}; s.gems += 100;
    this.toast({ t: 'ach', n: 'ПРЕСТИЖ ' + s.prestige, d: 'Постоянный бонус +' + (s.prestige * 5) + '% ко всему', r: 5 });
    this.checkAch(); this.save(); return true;
  },
  presBonus() { return this.s.prestige * 0.05; },

  /* ---- Навыки ---- */
  spTotal() { return (this.s.lvl - 1) + this.s.prestige * 3; },
  spUsed() { let n = 0; for (const k in this.s.skills) n += this.s.skills[k]; return n; },
  spFree() { return this.spTotal() - this.spUsed(); },
  canLearn(sk) {
    const r = this.s.skills[sk.id] || 0; if (r >= sk.max || this.spFree() <= 0) return false;
    if (sk.tier === 0) return true;
    const prev = D.SKILLS.find(x => x.b === sk.b && x.tier === sk.tier - 1); return (this.s.skills[prev.id] || 0) > 0;
  },
  learn(id) {
    const sk = D.SKILLS.find(x => x.id === id); if (!sk || !this.canLearn(sk)) return false;
    this.s.skills[id] = (this.s.skills[id] || 0) + 1; this.stat('skillsLearned'); this.checkAch(); this.save(); return true;
  },
  resetSkills() { if (this.s.gems < 20) return false; this.s.gems -= 20; this.s.skills = {}; this.save(); return true; },

  /* ---- Предметы ---- */
  addItem(id, silent) {
    const it = D.ITEMS[id]; if (!it) return null;
    const o = { uid: this.s.uid++, id, lvl: 1 }; this.s.inv.push(o);
    if (!this.s.museum.items[id]) { this.s.museum.items[id] = Date.now(); if (!silent) this.toast({ t: 'item', n: 'Новый предмет: ' + it.n, d: D.RAR[it.r].n, r: it.r }); }
    if (it.r >= 3) this.statMax('gotRar' + it.r, 1);
    if (it.boss) this.s.museum.boss[id] = true;
    return o;
  },
  itemMult(o) { return 1 + (o.lvl - 1) * 0.12; },
  itemStats(o) { const it = D.ITEMS[o.id], m = this.itemMult(o), r = {}; for (const k in it.st) r[k] = Math.round(it.st[k] * m * 10) / 10; return r; },
  upCost(o) { const it = D.ITEMS[o.id]; return Math.round(40 * o.lvl * (it.r + 1) * (1 + o.lvl * 0.25)); },
  upgrade(uid) {
    const o = this.s.inv.find(i => i.uid === uid); if (!o || o.lvl >= 10) return false;
    const c = this.upCost(o); if (this.s.credits < c) return false;
    this.s.credits -= c; o.lvl++; this.stat('upgrades'); this.statMax('maxItemLvl', o.lvl); this.checkAch(); this.save(); return true;
  },
  sellVal(o) { return Math.round(15 * (D.ITEMS[o.id].r + 1) * (1 + (o.lvl - 1) * 0.6)); },
  sell(uid) {
    const i = this.s.inv.findIndex(x => x.uid === uid); if (i < 0) return false;
    for (const k in this.s.eq) if (this.s.eq[k] === uid) this.s.eq[k] = null;
    this.s.credits += this.sellVal(this.s.inv[i]); this.s.inv.splice(i, 1); this.save(); return true;
  },
  equip(uid) {
    const o = this.s.inv.find(i => i.uid === uid); if (!o) return;
    this.s.eq[D.ITEMS[o.id].slot] = uid; this.stat('equips'); this.checkAch(); this.save();
  },
  unequip(slot) { this.s.eq[slot] = null; this.save(); },
  eqItems() { const r = []; for (const k in this.s.eq) { const o = this.s.inv.find(i => i.uid === this.s.eq[k]); if (o) r.push(o); } return r; },
  activeSets() { const ids = this.eqItems().map(o => o.id); return D.SETS.filter(st => st.items.every(i => ids.includes(i))); },

  /* ---- Бойцы ---- */
  trophies() { let t = 0; for (const h in this.s.heroes) t += this.s.heroes[h].tr || 0; return t; },
  heroUp(id) { const h = this.s.heroes[id]; return { c: 120 * h.pow + 40 * h.pow * h.pow, b: 15 * h.pow }; },
  upHero(id) {
    const h = this.s.heroes[id]; if (!h || !h.own || h.pow >= 11) return false;
    const c = this.heroUp(id); if (this.s.credits < c.c || this.s.bits < c.b) return false;
    this.s.credits -= c.c; this.s.bits -= c.b; h.pow++; this.statMax('maxPower', h.pow); this.checkAch(); this.save(); return true;
  },
  checkHeroUnlocks() {
    const t = this.trophies();
    D.HEROES.forEach(h => {
      if (h.unlock.t === 'trophy' && t >= h.unlock.v && !(this.s.heroes[h.id] && this.s.heroes[h.id].own)) {
        this.s.heroes[h.id] = { own: true, pow: 1, tr: 0 }; this.toast({ t: 'ach', n: 'Новый боец: ' + h.n, d: h.role, r: 3 });
      }
    });
  },
  buyHero(id) {
    const h = D.HEROES.find(x => x.id === id); if (!h || h.unlock.t !== 'gems' || this.s.gems < h.unlock.v) return false;
    if (this.s.heroes[id] && this.s.heroes[id].own) return false;
    this.s.gems -= h.unlock.v; this.s.heroes[id] = { own: true, pow: 1, tr: 0 }; this.checkAch(); this.save(); return true;
  },

  /* ---- Итоговые характеристики ---- */
  calc(heroId) {
    const H = D.HEROES.find(h => h.id === heroId), hs = this.s.heroes[heroId] || { pow: 1 };
    const st = { dmg: 0, hp: 0, spd: 0, rate: 0, crit: 5, critd: 50, magnet: 0, regen: 0, armor: 0, range: 0, sup: 0, coin: 0, xp: 0, dodge: 0, shield: 0, luck: 0, dashcd: 0, healb: 0, evt: 0, combo: 0, core: 0 };
    const fx = new Set();
    const add = (o, m = 1) => { for (const k in o) st[k] = (st[k] || 0) + o[k] * m; };
    this.eqItems().forEach(o => { add(this.itemStats(o)); if (D.ITEMS[o.id].fx) fx.add(D.ITEMS[o.id].fx); });
    D.SKILLS.forEach(sk => { const r = this.s.skills[sk.id] || 0; if (r) { add(sk.st, r); if (sk.fx) fx.add(sk.fx); } });
    this.activeSets().forEach(set => { add(set.st); if (set.fx) fx.add(set.fx); });
    const pm = 1 + (hs.pow - 1) * 0.08 + this.presBonus();
    const pb = this.presBonus() * 100;
    return {
      hero: H, fx,
      maxHp: Math.round((H.hp + st.hp) * pm),
      dmg: H.atk.dmg * pm * (1 + st.dmg / 100),
      spd: H.spd * (1 + Math.min(60, st.spd) / 100),
      reload: H.reload / (1 + Math.max(-50, st.rate) / 100),
      ammo: H.ammo + (fx.has('ammo') ? 1 : 0),
      crit: Math.min(75, st.crit) / 100, critd: 1 + st.critd / 100,
      magnet: 70 * (1 + st.magnet / 100), regen: st.regen,
      armor: Math.min(60, st.armor) / 100, range: H.atk.range * (1 + st.range / 100),
      sup: 1 + st.sup / 100, coin: 1 + (st.coin + pb) / 100, xp: 1 + (st.xp + pb) / 100,
      dodge: Math.min(40, st.dodge) / 100, shield: st.shield, luck: st.luck / 100,
      dashcd: 3 * Math.max(0.35, 1 + st.dashcd / 100), healb: 1 + st.healb / 100,
      evt: st.evt / 100, combo: 2.5 + st.combo, core: st.core, raw: st
    };
  },
  power(heroId) { const c = this.calc(heroId); return Math.round(c.maxHp * 2 + c.dmg * (1 + c.crit) / c.reload * 10); },

  /* ---- Кейсы ---- */
  rollItem(r, minR = 0) {
    const w = [50, 28, 14, 6, 1.8, 0.2].map((x, i) => i < minR ? 0 : x * (i >= 2 ? 1 + r : 1));
    let t = w.reduce((a, b) => a + b), x = Math.random() * t, rar = 0;
    for (let i = 0; i < 6; i++) { x -= w[i]; if (x <= 0) { rar = i; break; } }
    const pool = D.ITEM_LIST.filter(i => i.r === rar && !i.boss);
    if (!pool.length) return D.ITEM_LIST.filter(i => i.r === 4 && !i.boss)[0].id;
    return pool[Math.floor(Math.random() * pool.length)].id;
  },
  openCase(type) {
    const s = this.s; if (!s.cases[type]) return null;
    s.cases[type]--; this.stat('casesOpened');
    const cs = D.CASES[type], out = [], luck = this.calc(s.hero).luck;
    const tierB = type === 'm' ? 0.6 : type === 'b' ? 0.3 : 0;
    for (let i = 0; i < cs.rolls; i++) {
      const x = Math.random();
      if (x < 0.42) { const v = Math.round((30 + Math.random() * 60) * (1 + tierB)); s.credits += v; out.push({ t: 'c', v }); }
      else if (x < 0.66) { const v = Math.round((6 + Math.random() * 14) * (1 + tierB)); s.bits += v; out.push({ t: 'bits', v }); }
      else if (x < 0.74) { const v = 2 + Math.floor(Math.random() * 6); s.gems += v; out.push({ t: 'g', v }); }
      else { const id = this.rollItem(luck + tierB, type === 'm' && i === cs.rolls - 1 ? 3 : 0); this.addItem(id, true); out.push({ t: 'item', v: id }); }
    }
    // шанс бойца
    const locked = D.HEROES.filter(h => h.unlock.t === 'trophy' && !(s.heroes[h.id] && s.heroes[h.id].own));
    if (locked.length && Math.random() < (type === 'm' ? 0.12 : type === 'b' ? 0.05 : 0.015)) {
      const h = locked[0]; s.heroes[h.id] = { own: true, pow: 1, tr: 0 }; out.push({ t: 'hero', v: h.id });
    }
    this.checkAch(); this.save(); return out;
  },

  /* ---- Магазин ---- */
  buy(id) {
    const it = D.SHOPM[id], s = this.s; if (!it || s.shop.owned.includes(id)) return false;
    if (it.g ? s.gems < it.p : s.credits < it.p) return false;
    if (it.g) s.gems -= it.p; else s.credits -= it.p;
    s.shop.owned.push(id); s.shop.eq[it.cat] = id; this.stat('shopBuys'); this.checkAch(); this.save(); return true;
  },
  cos(cat) { return D.SHOPM[this.s.shop.eq[cat]] || D.SHOP.find(x => x.cat === cat); },
  offers() {
    this.ensureDaily(); const d = this.s.daily;
    if (!d.offers.length) {
      const r = rng(strSeed(d.date + 'shop'));
      const pool = D.ITEM_LIST.filter(i => i.r >= 2 && i.r <= 4 && !i.boss);
      const it = pool[Math.floor(r() * pool.length)], it2 = pool[Math.floor(r() * pool.length)];
      d.offers = [
        { id: 'o1', t: 'item', v: it.id, p: 250 * it.r, g: false },
        { id: 'o2', t: 'case', v: 'b', p: 400, g: false },
        { id: 'o3', t: 'bits', v: 80, p: 200, g: false },
        { id: 'o4', t: 'item', v: it2.id, p: 12 * it2.r, g: true },
        { id: 'o5', t: 'c', v: 600, p: 20, g: true },
        { id: 'o6', t: 'case', v: 'm', p: 120, g: true }
      ];
    }
    return d.offers;
  },
  buyOffer(oid) {
    const o = this.offers().find(x => x.id === oid), s = this.s, d = s.daily;
    if (!o || d.bought.includes(oid)) return false;
    if (o.g ? s.gems < o.p : s.credits < o.p) return false;
    if (o.g) s.gems -= o.p; else s.credits -= o.p;
    if (o.t === 'item') this.addItem(o.v); else if (o.t === 'case') s.cases[o.v]++; else if (o.t === 'bits') s.bits += o.v; else if (o.t === 'c') s.credits += o.v;
    d.bought.push(oid); this.stat('shopBuys'); this.checkAch(); this.save(); return true;
  },
  buyCase(type) {
    const c = D.CASES[type], s = this.s;
    if (c.g ? s.gems < c.price : s.credits < c.price) return false;
    if (c.g) s.gems -= c.price; else s.credits -= c.price; s.cases[type]++; this.save(); return true;
  },

  /* ---- Ежедневные задания ---- */
  ensureDaily() {
    const s = this.s, t = this.today();
    if (s.daily.date === t) return;
    if (s.lastAllDate !== this.today(-1) && s.lastAllDate !== t) s.questStreak = 0;
    const r = rng(strSeed(t + 'q' + s.created));
    const pool = D.QUESTS.slice(), qs = [];
    for (let i = 0; i < 5; i++) {
      const q = pool.splice(Math.floor(r() * pool.length), 1)[0], tier = Math.floor(r() * 3);
      qs.push({ k: q.k, n: q.n.replace('{t}', q.t[tier]), tgt: q.t[tier], tier, base: q.max ? 0 : (s.stats[q.k] || 0), max: !!q.max, done: false });
    }
    s.daily = { date: t, quests: qs, offers: [], bought: [], runDone: false, maxCombo: 0, bonus: false };
  },
  qProg(q) { const v = q.max ? this.s.daily.maxCombo : (this.s.stats[q.k] || 0) - q.base; return Math.min(q.tgt, Math.max(0, v)); },
  qRew(q) { return { c: 80 + q.tier * 60, xp: 50 + q.tier * 30, g: q.tier === 2 ? 5 : 0 }; },
  claimQuest(i) {
    this.ensureDaily(); const q = this.s.daily.quests[i]; if (!q || q.done || this.qProg(q) < q.tgt) return false;
    const r = this.qRew(q); q.done = true; this.s.credits += r.c; this.s.gems += r.g; this.addXp(r.xp); this.stat('questsDone');
    if (this.s.daily.quests.every(x => x.done) && !this.s.daily.bonus) {
      this.s.daily.bonus = true; this.s.cases.b++;
      this.s.questStreak = this.s.lastAllDate === this.today(-1) ? this.s.questStreak + 1 : 1;
      this.s.lastAllDate = this.today(); this.statMax('questStreakBest', this.s.questStreak);
      this.toast({ t: 'ach', n: 'Все задания выполнены!', d: 'Большой кейс • серия ' + this.s.questStreak + ' дн.', r: 3 });
    }
    this.checkAch(); this.save(); return true;
  },
  questsReady() { this.ensureDaily(); return this.s.daily.quests.filter(q => !q.done && this.qProg(q) >= q.tgt).length; },

  /* ---- Путь трофеев ---- */
  roadReady() { const t = this.trophies(); return D.ROAD.filter((r, i) => t >= r.at && !this.s.road.includes(i)).length; },
  claimRoad(i) {
    const r = D.ROAD[i], s = this.s; if (!r || this.trophies() < r.at || s.road.includes(i)) return false;
    s.road.push(i);
    if (r.t === 'c') s.credits += r.v; else if (r.t === 'g') s.gems += r.v; else if (r.t === 'bits') s.bits += r.v; else if (r.t === 'case') s.cases[r.v]++;
    this.save(); return true;
  },

  /* ---- Рекорды и история ---- */
  addRecord(mode, score, label) {
    const L = this.s.records[mode] = this.s.records[mode] || [];
    const asc = mode === 'boss';
    L.push({ score, label, hero: this.s.hero, date: Date.now() });
    L.sort((a, b) => asc ? a.score - b.score : b.score - a.score); L.length = Math.min(L.length, 10);
    return L.findIndex(x => x.score === score && x.label === label) === 0;
  },

  /* ---- Достижения ---- */
  derived() {
    const s = this.s, st = Object.assign({}, s.stats);
    st.lvl = s.lvl + s.prestige * 50; st.prestige = s.prestige;
    st.uniqItems = Object.keys(s.museum.items).length;
    st.heroesOwned = Object.values(s.heroes).filter(h => h.own).length;
    st.trophies = this.trophies();
    st.stars = Object.values(s.campaign.stars).reduce((a, b) => a + b, 0);
    st.campaignStage = s.campaign.stage;
    st.bossRelics = ['fw_core', 'serp_fang', 'oc_heart', 'eye_lens', 'zero_key'].filter(i => s.museum.boss[i]).length;
    st.uniqEvents = Object.keys(s.stats).filter(k => k.startsWith('ev_')).length;
    st.uniqBiomes = Object.keys(s.stats).filter(k => k.startsWith('bio_')).length;
    st.uniqBosses = ['firewall', 'serpent', 'overclock', 'eye', 'zero'].filter(b => s.stats['boss_' + b]).length;
    st.challengesDone = Object.keys(s.challenges).length;
    st.fullBranch = ['atk', 'def', 'tech'].some(b => D.SKILLS.filter(x => x.b === b).every(x => (s.skills[x.id] || 0) >= x.max)) ? 1 : (s.stats.fullBranch || 0);
    if (st.fullBranch) s.stats.fullBranch = 1;
    const sets = this.activeSets(); if (sets.length) s.stats.setsActive = Math.max(s.stats.setsActive || 0, 1);
    if (sets.find(x => x.id === 'paradox')) s.stats.set_paradox = 1;
    st.setsActive = s.stats.setsActive || 0; st.set_paradox = s.stats.set_paradox || 0;
    st.completion = this.completion(true);
    return st;
  },
  achVal(a, d) { return d[a.key] || 0; },
  checkAch() {
    const d = this.derived(); let any = false;
    for (const a of D.ACH) {
      if (this.s.ach[a.id]) continue;
      if (this.achVal(a, d) >= a.tgt) {
        this.s.ach[a.id] = Date.now(); any = true;
        if (a.rew.c) this.s.credits += a.rew.c; if (a.rew.g) this.s.gems += a.rew.g;
        this.toast({ t: 'ach', n: a.n, d: a.d, r: a.r, ic: a.ic, rew: a.rew });
      }
    }
    if (any) this.save();
  },
  titles() {
    const L = D.LVL_TITLES.filter(t => this.s.lvl >= t[0] || this.s.prestige > 0).map(t => t[1]);
    D.ACH.forEach(a => { if (a.rew.t && this.s.ach[a.id]) L.push(a.rew.t); });
    if (this.s.prestige) L.push('Престиж ' + this.s.prestige);
    return L;
  },
  completion(raw) {
    const s = this.s;
    const a = Object.keys(s.ach).length / D.ACH.length;
    const i = Object.keys(s.museum.items).length / D.ITEM_LIST.length;
    const h = Object.values(s.heroes).filter(x => x.own).length / D.HEROES.length;
    const sh = s.shop.owned.length / D.SHOP.length;
    const c = Math.min(30, s.campaign.stage - 1) / 30;
    const sk = Math.min(1, this.spUsed() / 30);
    const v = (a * 35 + i * 25 + h * 10 + sh * 10 + c * 15 + sk * 5);
    return raw ? Math.floor(v) : Math.min(100, Math.floor(v));
  },

  /* ---- Итоги забега ---- */
  finishRun(R) {
    const s = this.s, h = s.heroes[R.hero];
    const modeMul = R.mode === 'chaos' ? 2 : R.mode === 'daily' ? 1.5 : 1;
    const win = R.success;
    if (win) { s.streak++; this.statMax('bestStreak', s.streak); } else s.streak = 0;
    const strMul = 1 + 0.08 * Math.min(s.streak, 10);
    const credits = Math.round(R.coins * R.cs.coin * modeMul * strMul * (win ? 1 : 0.7));
    const xp = Math.round(R.xp * R.cs.xp * modeMul * strMul);
    let tr = win ? 8 + Math.min(R.sectors, 12) : (R.sectors > 0 ? Math.min(R.sectors, 4) : -Math.min(3, h.tr));
    if (R.mode === 'challenge' || R.mode === 'secret') tr = win ? 10 : 0;
    h.tr = Math.max(0, h.tr + tr);
    const bits = R.sectors * 3 + (win ? 5 : 0);
    s.credits += credits; s.bits += bits; this.stat('coinsEarned', credits);
    const lvlUp = this.addXp(xp);
    const loot = R.loot.map(id => { this.addItem(id); return id; });
    let extra = [];
    if (R.mode === 'campaign' && win) {
      const st = R.stage; s.campaign.stars[st] = Math.max(s.campaign.stars[st] || 0, R.stars);
      if (st === s.campaign.stage) { s.campaign.stage++; if (st % 5 === 0) { s.cases.b++; extra.push('Большой кейс за главу!'); } }
    }
    if (R.mode === 'challenge' && win && !s.challenges[R.chId]) {
      const ch = D.CHALLENGES.find(c => c.id === R.chId); s.challenges[R.chId] = Date.now(); s.gems += ch.rew.g; s.credits += ch.rew.c;
      extra.push('Награда испытания: ' + ch.rew.g + ' осколков, ' + ch.rew.c + ' кредитов');
    }
    if (R.mode === 'daily' && win && !s.daily.runDone) { s.daily.runDone = true; this.stat('dailyWins'); s.gems += 20; s.cases.c++; extra.push('Награда дня: 20 осколков + кейс'); }
    if (R.mode === 'secret' && win) { this.stat('nullWins'); }
    if (win && Math.random() < 0.35) { s.cases.c++; extra.push('Бонус: Кейс данных'); }
    let score = R.mode === 'boss' ? Math.round(R.time * 10) / 10 : R.mode === 'campaign' ? R.stage : R.sectors * 1000 + R.kills;
    const rec = (R.mode !== 'boss' || win) ? this.addRecord(R.mode === 'boss' ? 'boss_' + R.boss : R.mode, score, R.mode === 'boss' ? score + ' с' : R.sectors + ' сект.') : false;
    s.history.unshift({ d: Date.now(), mode: R.mode, hero: R.hero, win, sectors: R.sectors, kills: R.kills, credits, xp, tr, time: Math.round(R.time) });
    s.history.length = Math.min(40, s.history.length);
    const hr = new Date().getHours(); if (hr < 5) this.stat('nightRuns');
    this.checkHeroUnlocks(); this.checkAch(); this.save();
    return { credits, xp, tr, bits, loot, extra, lvlUp, rec, strMul, streak: s.streak };
  }
};
