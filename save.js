'use strict';
/* ===== Save System: LocalStorage + контрольная сумма + резервная копия ===== */
const SaveSys = (() => {
  const KEY = 'glitchzero_save_v1', BAK = 'glitchzero_save_bak';

  function def() {
    return {
      v: 1, name: 'Игрок', avatar: '◈', title: 'Новичок', created: Date.now(),
      lvl: 1, xp: 0, prestige: 0,
      credits: 250, gems: 30, bits: 0,
      heroes: { spark: { own: true, pow: 1, tr: 0 } }, hero: 'spark',
      inv: [], uid: 1, eq: { weapon: null, armor: null, chip: null, relic: null },
      skills: {}, ach: {},
      stats: {}, records: {}, history: [],
      campaign: { stage: 1, stars: {} }, challenges: {},
      daily: { date: '', quests: [], offers: [], bought: [], runDone: false, maxCombo: 0, bonus: false },
      questStreak: 0, lastAllDate: '',
      streak: 0, road: [], cases: { c: 1, b: 0, m: 0 },
      shop: { owned: ['skin_def', 'trail_def', 'fx_def', 'theme_def', 'field_def'], eq: { skin: 'skin_def', trail: 'trail_def', pick: 'fx_def', theme: 'theme_def', field: 'field_def' } },
      museum: { items: {}, boss: {}, eggs: {} },
      settings: { sfx: 0.7, music: 0.35, vib: true, quality: 'high', fps: false, shake: true, ctrl: 1 },
      secret: { logo: 0 }, mode: 'campaign', tutorial: false
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  // Слияние с дефолтом: недостающие поля восстанавливаются, неверные типы заменяются
  function merge(base, data) {
    if (data === null || typeof data !== 'object' || Array.isArray(base) !== Array.isArray(data)) return base;
    if (Array.isArray(base)) return data;
    const out = {};
    for (const k in base) out[k] = (k in data) ? (typeof base[k] === 'object' && base[k] !== null ? merge(base[k], data[k]) : (typeof data[k] === typeof base[k] || base[k] === null ? data[k] : base[k])) : base[k];
    for (const k in data) if (!(k in out)) out[k] = data[k];
    return out;
  }

  function validate(s) {
    if (!s || typeof s !== 'object') throw new Error('bad');
    s.inv = (s.inv || []).filter(it => it && D.ITEMS[it.id] && Number.isFinite(it.lvl));
    for (const sl in s.eq) if (s.eq[sl] && !s.inv.find(i => i.uid === s.eq[sl])) s.eq[sl] = null;
    for (const h in s.heroes) if (!D.HEROES.find(x => x.id === h)) delete s.heroes[h];
    if (!s.heroes.spark) s.heroes.spark = { own: true, pow: 1, tr: 0 };
    if (!s.heroes[s.hero] || !s.heroes[s.hero].own) s.hero = 'spark';
    ['credits', 'gems', 'bits', 'lvl', 'xp', 'prestige'].forEach(k => { if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = k === 'lvl' ? 1 : 0; });
    s.lvl = Math.min(50, Math.max(1, Math.floor(s.lvl)));
    return s;
  }

  function parse(raw) {
    const o = JSON.parse(raw);
    if (o && o.payload && o.sum) {
      if (hash(o.payload) !== o.sum) throw new Error('checksum');
      return validate(merge(def(), JSON.parse(o.payload)));
    }
    return validate(merge(def(), o));
  }

  function load() {
    try { const r = localStorage.getItem(KEY); if (r) return { s: parse(r), st: 'ok' }; }
    catch (e) {
      try { const b = localStorage.getItem(BAK); if (b) return { s: parse(b), st: 'backup' }; } catch (e2) { }
      return { s: def(), st: 'corrupt' };
    }
    return { s: def(), st: 'new' };
  }

  let lastBak = 0;
  function save(s) {
    try {
      const payload = JSON.stringify(s);
      const wrapped = JSON.stringify({ payload, sum: hash(payload), t: Date.now() });
      localStorage.setItem(KEY, wrapped);
      if (Date.now() - lastBak > 60000) { localStorage.setItem(BAK, wrapped); lastBak = Date.now(); }
      return true;
    } catch (e) { return false; }
  }

  function exportJSON(s) { const p = JSON.stringify(s); return JSON.stringify({ game: 'GLITCH//ZERO', payload: p, sum: hash(p) }, null, 0); }
  function importJSON(txt) {
    const o = JSON.parse(txt);
    if (o.payload) { if (o.sum && hash(o.payload) !== o.sum) throw new Error('Контрольная сумма не совпадает — файл повреждён'); return validate(merge(def(), JSON.parse(o.payload))); }
    return validate(merge(def(), o));
  }
  function wipe() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch (e) { } }

  return { def, load, save, exportJSON, importJSON, wipe };
})();
