'use strict';
/* ===== 3D Renderer (Three.js): камера как в арена-шутерах, объёмный мир, свечение ===== */
const R3 = {
  ok: false, on: false,
  init() {
    if (!window.THREE) return;
    try {
      const T3 = THREE;
      this.cv = document.getElementById('gl');
      this.r = new T3.WebGLRenderer({ canvas: this.cv, antialias: true, powerPreference: 'high-performance' });
      this.r.setClearColor(0x020108, 1);
      this.scene = new T3.Scene(); this.scene.fog = new T3.Fog(0x020108, 18, 40);
      this.cam = new T3.PerspectiveCamera(45, 1, 0.1, 120);
      this.scene.add(new T3.HemisphereLight(0xa89cff, 0x1a0c3a, 1.0));
      this.sun = new T3.DirectionalLight(0xffffff, 0.55); this.sun.position.set(-4, 10, 6); this.scene.add(this.sun);
      this.pl = new T3.PointLight(0x00f0ff, 0.7, 7, 2); this.scene.add(this.pl);
      this.dummy = new T3.Object3D(); this.cols = {}; this.mats = {};
      this.initPoints(); this.initPools();
      this.ok = true; this.resize();
      addEventListener('resize', () => this.resize());
    } catch (e) { console.warn('3D недоступно', e); this.ok = false; }
  },
  active() { return this.ok && P.s.settings.r3d !== false; },
  // адаптивное качество: снижаем разрешение и эффекты, если FPS падает
  lvl: (('ontouchstart' in window) || navigator.maxTouchPoints > 0) ? 1 : 0, lowT: 0, hiT: 0,
  adapt(fps) {
    if (fps < 44) { this.lowT++; this.hiT = 0; } else if (fps > 57) { this.hiT++; this.lowT = 0; } else { this.lowT = 0; this.hiT = 0; }
    if (this.lowT >= 3 && this.lvl < 3) { this.lvl++; this.lowT = 0; this.resize(); }
    else if (this.hiT >= 30 && this.lvl > 0 && !this.dropped) { this.lvl--; this.hiT = 0; this.dropped = true; this.resize(); }
  },
  budget() { return [2400, 1500, 900, 600][this.lvl]; },
  resize() {
    if (!this.ok) return;
    const low = P.s && P.s.settings.quality === 'low';
    this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1) * (low ? 0.55 : 0.9) * [1, 0.8, 0.62, 0.5][this.lvl || 0]);
    this.r.setSize(innerWidth, innerHeight, false);
    this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix();
    if (this.pmat) this.pmat.uniforms.uS.value = this.r.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(this.cam.fov * Math.PI / 360));
  },
  C(s) { let c = this.cols[s]; if (!c) { c = this.cols[s] = new THREE.Color(); try { c.setStyle(s); } catch (e) { c.set(0xffffff); } } return c; },
  M(col, o = {}) {
    const k = col + JSON.stringify(o); if (this.mats[k]) return this.mats[k];
    const base = this.C(col).clone();
    const m = o.basic ? new THREE.MeshBasicMaterial({ color: base, transparent: !!o.op, opacity: o.op || 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add && !o.op, side: o.ds ? THREE.DoubleSide : THREE.FrontSide })
      : new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(o.dark === undefined ? 0.25 : o.dark), emissive: base, emissiveIntensity: o.e === undefined ? 0.45 : o.e, transparent: !!o.op, opacity: o.op || 1 });
    return this.mats[k] = m;
  },
  /* ---------- точки свечения и частиц ---------- */
  initPoints() {
    const N = this.PN = 2400, g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pSize = new Float32Array(N); this.pA = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.pA, 1));
    this.pmat = new THREE.ShaderMaterial({
      uniforms: { uS: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uS;void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*uS/-mv.z;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=1.0-smoothstep(0.0,1.0,d);a*=a;gl_FragColor=vec4(vC*a*vA*1.6,a*vA);}'
    });
    this.pts = new THREE.Points(g, this.pmat); this.pts.frustumCulled = false; this.scene.add(this.pts); this.pn = 0;
  },
  gp(x, y, z, col, size, a = 1) {
    if (this.pn >= (this.pBud || this.PN)) return; const i = this.pn++, c = this.C(col);
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
    this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b; this.pSize[i] = size; this.pA[i] = a;
  },
  /* ---------- пулы ---------- */
  initPools() {
    const T3 = THREE;
    const inst = (geo, mat, n) => { const m = new T3.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(T3.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; this.scene.add(m); return m; };
    this.iPB = inst(new T3.SphereGeometry(0.11, 10, 8), new T3.MeshBasicMaterial({ color: 0xffffff }), 400);
    this.iEB = inst(new T3.SphereGeometry(0.13, 10, 8), new T3.MeshBasicMaterial({ color: 0xffe0e8 }), 600);
    this.iCore = inst(new T3.OctahedronGeometry(0.22), new T3.MeshLambertMaterial({ color: 0x0a3a44, emissive: 0x00e8ff, emissiveIntensity: 0.9 }), 60);
    this.iCoin = inst(new T3.CylinderGeometry(0.1, 0.1, 0.035, 12), new T3.MeshLambertMaterial({ color: 0x664400, emissive: 0xffc23d, emissiveIntensity: 0.8 }), 400);
    this.iHeal = inst(new T3.BoxGeometry(0.34, 0.11, 0.11), new T3.MeshLambertMaterial({ color: 0x0a3a20, emissive: 0x3dffa0, emissiveIntensity: 0.9 }), 60);
    this.iHeal2 = inst(new T3.BoxGeometry(0.11, 0.34, 0.11), this.iHeal.material, 60);
    this.lasGeo = new T3.BoxGeometry(1, 1, 1); this.lasPool = []; this.ringPool = []; this.planePool = []; this.boxPool = [];
    this.ringGeo = new T3.RingGeometry(0.92, 1, 48); this.discGeo = new T3.CircleGeometry(1, 40); this.planeGeo = new T3.PlaneGeometry(1, 1);
    this.aim = new T3.Mesh(this.planeGeo, new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, side: T3.DoubleSide })); this.aim.rotation.x = -Math.PI / 2; this.aim.visible = false; this.scene.add(this.aim);
    this.aimArc = new T3.Mesh(new T3.CircleGeometry(1, 24, -0.65, 1.3), this.aim.material); this.aimArc.rotation.x = -Math.PI / 2; this.aimArc.visible = false; this.scene.add(this.aimArc);
  },
  use(pool, make) { let o = pool[pool.u]; if (!o) { o = make(); pool.push(o); this.scene.add(o); } pool.u++; o.visible = true; return o; },
  endPools() { for (const pool of [this.lasPool, this.ringPool, this.planePool, this.boxPool]) { for (let i = pool.u; i < pool.length; i++) pool[i].visible = false; } },
  laser(x1, z1, x2, z2, col, w = 0.12, h = 0.55, glow = true) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz); if (L < 0.01) return;
    const core = this.use(this.lasPool, () => new THREE.Mesh(this.lasGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })));
    core.material.color.copy(this.C('#fff0f4')); core.position.set((x1 + x2) / 2, h, (z1 + z2) / 2); core.scale.set(L, w * 0.45, w * 0.45); core.rotation.set(0, -Math.atan2(dz, dx), 0);
    const g = this.use(this.lasPool, () => new THREE.Mesh(this.lasGeo, new THREE.MeshBasicMaterial({ color: 0xff3d6a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
    g.material.color.copy(this.C(col)); g.position.copy(core.position); g.scale.set(L, w * 1.6, w * 1.6); g.rotation.copy(core.rotation);
    if (glow) { this.gp(x2, h, z2, col, 0.7, 0.9); const n = Math.min(10, Math.ceil(L)); for (let i = 0; i <= n; i++) this.gp(x1 + dx * i / n, h, z1 + dz * i / n, col, 0.5, 0.35); }
  },
  ring(x, z, r, col, op, y = 0.03, disc) {
    const m = this.use(this.ringPool, () => { const o = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); o.rotation.x = -Math.PI / 2; return o; });
    m.geometry = disc ? this.discGeo : this.ringGeo; m.material.color.copy(this.C(col)); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(r, r, 1);
  },
  plane(x, z, w, l, ang, col, op, y = 0.04) {
    const m = this.use(this.planePool, () => { const o = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); return o; });
    m.material.color.copy(this.C(col)); m.material.opacity = op; m.position.set(x, y, z); m.rotation.set(-Math.PI / 2, 0, -ang); m.scale.set(l, w, 1);
  },
  box(x, y, z, sx, sy, sz, col, op) {
    const m = this.use(this.boxPool, () => new THREE.Mesh(this.lasGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    m.material.color.copy(this.C(col)); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, 0, 0);
  },

  /* ---------- модели ---------- */
  eye(r) {
    const g = new THREE.Group(), w = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), this.M('#ffe6ee', { e: 0.8, dark: 0.9 }));
    const pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pu.position.z = r * 0.62; g.add(w); g.add(pu); return g;
  },
  /* ---------- детализированные бойцы ---------- */
  S(col, metal = 0.35, rough = 0.45, em = 0.08, emc) {
    const k = 's' + col + metal + rough + em + (emc || ''); if (this.mats[k]) return this.mats[k];
    return this.mats[k] = new THREE.MeshStandardMaterial({ color: this.C(col), metalness: metal, roughness: rough, emissive: this.C(emc || col), emissiveIntensity: em });
  },
  RB(w, h, d, r) {
    const k = 'rb' + w + h + d + r; this.geo = this.geo || {}; if (this.geo[k]) return this.geo[k];
    r = r === undefined ? Math.min(w, h) * 0.22 : r; const b = Math.min(w, h, d) * 0.12, W = w / 2 - b, Hh = h / 2 - b, rr = Math.min(r, W * 0.9, Hh * 0.9), s = new THREE.Shape();
    s.moveTo(-W + rr, -Hh); s.lineTo(W - rr, -Hh); s.quadraticCurveTo(W, -Hh, W, -Hh + rr); s.lineTo(W, Hh - rr); s.quadraticCurveTo(W, Hh, W - rr, Hh); s.lineTo(-W + rr, Hh); s.quadraticCurveTo(-W, Hh, -W, Hh - rr); s.lineTo(-W, -Hh + rr); s.quadraticCurveTo(-W, -Hh, -W + rr, -Hh);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * b) / 2); return this.geo[k] = g;
  },
  Cap(r, len, seg = 12) {
    const k = 'cap' + r + len; this.geo = this.geo || {}; if (this.geo[k]) return this.geo[k];
    const pts = []; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, -len / 2 + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, len / 2 + Math.sin(a) * r)); }
    return this.geo[k] = new THREE.LatheGeometry(pts, seg);
  },
  heroModel(H, skin) {
    const T3 = THREE, g = new T3.Group(), col = H.col, hid = H.id;
    const glow = this.M(col, { basic: 1 }), wht = this.M('#ffffff', { basic: 1 });
    const tint = { tri: '#ff9a3d', diamond: '#9fe8ff', hex: '#3dffa0', star: '#ffd23d', ring: '#ffffff', glitch: '#ff3dc8' }[skin];
    const SK = { tri: ['#ff7a1a', '#2a1a10', 0.3], diamond: ['#cfefff', '#5ab8ff', 0.8], hex: ['#4a6a3a', '#c8b070', 0.2], star: ['#ffc83d', '#fff4c0', 0.9], ring: ['#f4f4ff', '#ffe9a0', 0.5], glitch: ['#1a0a20', '#ff3dc8', 0.4] }[skin];
    const armor = SK ? this.S(SK[0], SK[2], 0.3, 0.1) : this.S(this.C(col).clone().lerp(this.C('#ffffff'), 0.25).getStyle(), 0.3, 0.38, 0.12);
    const plate = this.S(SK ? SK[1] : '#e4e2f4', 0.15, 0.5, 0.06);
    const suit = this.S('#22223a', 0.2, 0.75, 0.03), gm = this.S('#3a3d52', 0.85, 0.28, 0.02), blk = this.S('#101018', 0.5, 0.5, 0);
    const base = new T3.Mesh(new T3.TorusGeometry(0.42, 0.035, 8, 40), glow); base.rotation.x = Math.PI / 2; base.position.y = 0.03; g.add(base); g.userData.base = base;
    const piv = new T3.Group(); g.add(piv); g.userData.piv = piv;
    const A = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, par = piv, s) => { const o = new T3.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s) o.scale.set(...s); par.add(o); return o; };
    const RB = (w, h, d, r) => this.RB(w, h, d, r), Cap = (r, l) => this.Cap(r, l), Cy = (a, b, h, s = 16) => new T3.CylinderGeometry(a, b, h, s), Sp = (r, a = 18, b = 14) => new T3.SphereGeometry(r, a, b);
    const gunG = new T3.Group(); piv.add(gunG);
    // ---------- тело-гуманоид ----------
    const body = (o) => {
      const sh = o.sh, bk = o.bulk, hip = 0.09 * bk;
      if (!o.noLegs) for (const s of [-1, 1]) {
        A(RB(0.26 * bk, 0.1, 0.13 * bk), blk, 0.04, 0.05, s * hip); A(RB(0.08, 0.03, 0.12 * bk), glow, 0.16 * bk, 0.04, s * hip);
        A(Cap(0.055 * bk, 0.14), suit, 0, 0.21, s * hip); A(RB(0.08, 0.16, 0.1 * bk), armor, 0.04, 0.22, s * hip);
        A(Sp(0.06 * bk, 12, 10), plate, 0.05, 0.31, s * hip, 0, 0, 0, piv, [1, 0.8, 1]);
        A(Cap(0.065 * bk, 0.13), suit, 0, 0.41, s * hip); A(RB(0.1, 0.14, 0.11 * bk), armor, 0.03, 0.42, s * (hip + 0.01));
      }
      const ty = o.noLegs ? 0.62 : 0.72;
      A(RB(0.22 * bk, 0.12, hip * 2 + 0.16), suit, 0, ty - 0.2, 0); A(RB(0.24 * bk, 0.03, hip * 2 + 0.18), gm, 0, ty - 0.15, 0); A(RB(0.05, 0.035, 0.06), glow, 0.12 * bk, ty - 0.15, 0);
      const tor = A(RB(0.28 * bk, 0.34, sh * 1.7), suit, 0, ty, 0);
      A(RB(0.12, 0.3, sh * 1.45), armor, 0.1 * bk, ty + 0.02, 0); A(RB(0.06, 0.14, sh * 0.9), plate, 0.165 * bk, ty + 0.05, 0);
      A(RB(0.02, 0.02, sh * 1.2), glow, 0.18 * bk, ty - 0.07, 0); for (const s of [-1, 1]) A(RB(0.02, 0.18, 0.02), glow, 0.17 * bk, ty + 0.04, s * sh * 0.55);
      // эмблема скина
      const emG = { tri: new T3.ConeGeometry(0.06, 0.1, 3), diamond: new T3.OctahedronGeometry(0.06), hex: Cy(0.06, 0.06, 0.03, 6), star: new T3.DodecahedronGeometry(0.055), glitch: new T3.BoxGeometry(0.08, 0.08, 0.08) }[skin] || Sp(0.045, 12, 10);
      const em = A(emG, glow, 0.2 * bk, ty + 0.06, 0); if (skin === 'hex') em.rotation.z = Math.PI / 2;
      // плечи и руки
      for (const s of [-1, 1]) {
        A(Sp(0.11 * bk, 16, 12), armor, 0, ty + 0.15, s * sh, 0, 0, 0, piv, [1.1, 0.75, 1]); A(new T3.TorusGeometry(0.1 * bk, 0.012, 6, 24), glow, 0, ty + 0.12, s * sh, Math.PI / 2);
        A(RB(0.12, 0.05, 0.1), plate, 0, ty + 0.22, s * sh);
        A(Cap(0.045 * bk, 0.12), suit, 0.04, ty + 0.03, s * (sh + 0.02), 0, 0, -0.5);
        A(Cap(0.05 * bk, 0.12), armor, 0.15, ty - 0.08, s * (sh * 0.75), 0, 0, -1.35); A(RB(0.06, 0.06, 0.07), blk, 0.24, ty - 0.1, s * sh * 0.6);
      }
      // голова
      A(Cy(0.06, 0.07, 0.08, 12), gm, 0, ty + 0.22, 0);
      const hy = ty + 0.36; A(Sp(0.165, 24, 18), armor, 0, hy, 0, 0, 0, 0, piv, [1.08, 1, 0.95]);
      A(new T3.SphereGeometry(0.17, 24, 12, -0.9, 1.8, 1.05, 0.7), this.S('#05060c', 0.9, 0.12, 0.0), 0.005, hy, 0, 0, Math.PI / 2, 0, piv, [1.08, 1, 0.97]);
      A(new T3.SphereGeometry(0.172, 24, 4, -0.8, 1.6, 1.45, 0.08), glow, 0.005, hy, 0, 0, Math.PI / 2, 0, piv, [1.08, 1, 0.97]);
      for (const s of [-1, 1]) { A(Cy(0.045, 0.045, 0.04, 14), gm, 0, hy, s * 0.155, Math.PI / 2); A(Cy(0.02, 0.02, 0.045, 10), glow, 0, hy, s * 0.16, Math.PI / 2); }
      if (skin === 'ring') { const h = A(new T3.TorusGeometry(0.16, 0.015, 8, 40), wht, -0.02, hy + 0.27, 0, Math.PI / 2); g.userData.spin = (g.userData.spin || []).concat([h]); }
      return { tor, ty, hy };
    };
    let r;
    if (hid === 'vector') {
      r = body({ sh: 0.2, bulk: 1.22 });
      for (let i = 0; i < 6; i++) A(new T3.ConeGeometry(0.025, 0.12 + (i % 2) * 0.04, 6), glow, -0.1 + i * 0.035, r.hy + 0.17 - Math.abs(i - 2.5) * 0.012, 0, 0, 0, 0.5);
      A(RB(0.18, 0.3, 0.3), gm, -0.24, r.ty + 0.03, 0); for (const s of [-1, 1]) A(Cy(0.045, 0.045, 0.26, 14), this.S('#ff3dc8', 0.4, 0.3, 0.6), -0.3, r.ty + 0.03, s * 0.09);
      A(RB(0.36, 0.13, 0.11), gm, 0.2, 0, 0, 0, 0, 0, gunG); A(RB(0.2, 0.09, 0.09), blk, -0.08, -0.03, 0, 0, 0, 0.15, gunG);
      for (const s of [-1, 1]) { A(Cy(0.032, 0.032, 0.42, 16), gm, 0.55, 0.025, s * 0.032, 0, 0, Math.PI / 2, gunG); A(Cy(0.04, 0.04, 0.05, 16), blk, 0.76, 0.025, s * 0.032, 0, 0, Math.PI / 2, gunG); A(Cy(0.02, 0.02, 0.052, 12), glow, 0.77, 0.025, s * 0.032, 0, 0, Math.PI / 2, gunG); }
      A(RB(0.2, 0.06, 0.1), blk, 0.48, -0.06, 0, 0, 0, 0, gunG); for (let i = 0; i < 3; i++) A(Cy(0.014, 0.014, 0.06, 8), this.S('#ffd23d', 0.6, 0.3, 0.5), 0.12 + i * 0.05, 0.02, 0.065, 0, 0, Math.PI / 2, gunG);
      A(RB(0.06, 0.12, 0.06), blk, 0.12, -0.11, 0, 0, 0, -0.3, gunG); A(RB(0.16, 0.015, 0.02), glow, 0.24, 0.07, 0, 0, 0, 0, gunG);
      gunG.position.set(0.22, 0.6, 0.12);
    } else if (hid === 'quartz') {
      r = body({ sh: 0.24, bulk: 1.45 });
      const cm = this.S(col, 0.1, 0.1, 0.55); cm.transparent = true; cm.opacity = 0.85;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI - Math.PI / 2; A(new T3.OctahedronGeometry(0.07 + (i % 3) * 0.025, 0), cm, -0.26 - Math.abs(Math.sin(a)) * 0.04, r.ty + 0.15 + Math.cos(a) * 0.15, Math.sin(a) * 0.25, 0.3 * i, 0, 0.5, piv, [0.6, 2.2, 0.6]); }
      for (const s of [-1, 1]) A(new T3.OctahedronGeometry(0.07, 0), cm, 0, r.ty + 0.28, s * 0.3, 0, 0, s * 0.6, piv, [0.6, 1.8, 0.6]);
      A(Cy(0.34, 0.34, 0.06, 6), gm, 0.38, 0, 0, 0, 0, Math.PI / 2, gunG); A(Cy(0.3, 0.3, 0.07, 6), armor, 0.39, 0, 0, 0, 0, Math.PI / 2, gunG);
      A(new T3.TorusGeometry(0.31, 0.015, 6, 6), glow, 0.425, 0, 0, 0, Math.PI / 2, Math.PI / 6, gunG); A(new T3.OctahedronGeometry(0.1, 0), cm, 0.44, 0, 0, 0, 0, 0, gunG, [0.6, 1.4, 1]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; A(Sp(0.025, 8, 6), glow, 0.43, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0, 0, 0, gunG); }
      gunG.position.set(0.12, 0.72, 0.28);
    } else if (hid === 'nova') {
      r = body({ sh: 0.15, bulk: 0.9 });
      const cl = this.S(col, 0.05, 0.85, 0.12); cl.side = T3.DoubleSide;
      A(new T3.ConeGeometry(0.3, 0.7, 20, 1, true, Math.PI * 0.6, Math.PI * 1.8), cl, -0.06, r.ty - 0.05, 0, 0, 0, 0.12);
      A(new T3.SphereGeometry(0.21, 20, 14, 0, Math.PI * 2, 0, 2.1), cl, -0.03, r.hy + 0.02, 0, 0, 0, 0.25);
      A(Cy(0.055, 0.055, 0.06, 18), gm, 0.17, r.hy + 0.02, 0.05, 0, 0, Math.PI / 2); A(Cy(0.045, 0.045, 0.065, 18), glow, 0.175, r.hy + 0.02, 0.05, 0, 0, Math.PI / 2);
      A(RB(0.34, 0.09, 0.07), gm, 0.1, 0, 0, 0, 0, 0, gunG); A(RB(0.22, 0.1, 0.06), blk, -0.16, -0.02, 0, 0, 0, 0.1, gunG);
      A(Cy(0.02, 0.024, 0.85, 14), blk, 0.68, 0.01, 0, 0, 0, Math.PI / 2, gunG); A(RB(0.08, 0.04, 0.05), gm, 1.12, 0.01, 0, 0, 0, 0, gunG); A(RB(0.02, 0.03, 0.055), glow, 1.17, 0.01, 0, 0, 0, 0, gunG);
      A(Cy(0.035, 0.035, 0.3, 16), gm, 0.12, 0.1, 0, 0, 0, Math.PI / 2, gunG); A(Cy(0.042, 0.035, 0.05, 16), blk, 0.28, 0.1, 0, 0, 0, Math.PI / 2, gunG); A(Cy(0.03, 0.03, 0.01, 16), glow, 0.305, 0.1, 0, 0, 0, Math.PI / 2, gunG);
      for (const s of [-1, 1]) A(Cy(0.006, 0.006, 0.2, 6), gm, 0.5, -0.09, s * 0.04, s * 0.35, 0, 0, gunG);
      A(RB(0.06, 0.11, 0.045), blk, 0.08, -0.09, 0, 0, 0, 0.15, gunG); A(RB(0.3, 0.012, 0.074), glow, 0.12, 0.048, 0, 0, 0, 0, gunG);
      gunG.position.set(0.18, 0.66, 0.1);
    } else if (hid === 'phantom') {
      r = body({ sh: 0.15, bulk: 0.9, noLegs: true });
      const cl = this.S('#1a0f2a', 0.05, 0.8, 0.1, col); cl.side = T3.DoubleSide;
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T3.Vector2(0.13 + t * t * 0.2 + Math.sin(t * 9) * 0.01, 0.5 - t * 0.5)); }
      A(new T3.LatheGeometry(pts, 24), cl, 0, 0.05, 0);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; A(new T3.ConeGeometry(0.04, 0.14, 4), glow, Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3, Math.PI, 0, 0); }
      A(new T3.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, 2.0), cl, -0.02, r.hy + 0.01, 0, 0, 0, 0.2);
      for (const s of [-1, 1]) A(new T3.ConeGeometry(0.03, 0.22, 8), glow, -0.04, r.hy + 0.2, s * 0.1, s * -0.45, 0, 0.35);
      for (const s of [-1, 1]) {
        const bl = new T3.Shape(); bl.moveTo(0, -0.025); bl.lineTo(0.5, -0.01); bl.lineTo(0.62, 0.03); bl.lineTo(0.45, 0.03); bl.lineTo(0, 0.025);
        A(new T3.ExtrudeGeometry(bl, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), this.S('#e8f0ff', 0.95, 0.15, 0.25, col), 0.08, 0, s * 0.14, 0, s * 0.2, 0, gunG);
        A(RB(0.1, 0.035, 0.05), gm, 0.03, 0, s * 0.14, 0, s * 0.2, 0, gunG); A(Cy(0.03, 0.03, 0.02, 10), glow, 0.09, 0, s * 0.14, Math.PI / 2, 0, 0, gunG);
      }
      gunG.position.set(0.2, 0.52, 0); g.userData.float = 1;
    } else if (hid === 'singular') {
      r = body({ sh: 0.15, bulk: 0.95, noLegs: true });
      const rb = this.S('#160a1a', 0.1, 0.7, 0.1, col); rb.side = T3.DoubleSide;
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T3.Vector2(0.14 + t * 0.16, 0.48 - t * 0.48)); }
      A(new T3.LatheGeometry(pts, 24), rb, 0, 0.06, 0); for (let i = 0; i < 3; i++) A(new T3.TorusGeometry(0.17 + i * 0.05, 0.008, 6, 32), glow, 0, 0.42 - i * 0.15, 0, Math.PI / 2);
      const r1 = A(new T3.TorusGeometry(0.26, 0.012, 8, 48), glow, 0, r.hy, 0, 1.2, 0, 0), r2 = A(new T3.TorusGeometry(0.31, 0.008, 8, 48), wht, 0, r.hy, 0, -0.9, 0.6, 0);
      g.userData.spin = (g.userData.spin || []).concat([r1, r2]);
      A(Cy(0.018, 0.022, 1.15, 10), gm, 0, 0.05, 0, 0, 0, 0, gunG); for (let i = 0; i < 4; i++) A(Cy(0.026, 0.026, 0.03, 10), glow, 0, -0.35 + i * 0.2, 0, 0, 0, 0, gunG);
      for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; A(new T3.ConeGeometry(0.02, 0.18, 6), gm, Math.cos(a) * 0.08, 0.68, Math.sin(a) * 0.08, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4, gunG); }
      const orb = A(Sp(0.08, 20, 16), this.M('#000000', { basic: 1 }), 0, 0.74, 0, 0, 0, 0, gunG); A(new T3.TorusGeometry(0.12, 0.018, 8, 32), glow, 0, 0.74, 0, Math.PI / 2, 0, 0, gunG);
      g.userData.spin.push(orb); gunG.position.set(0.24, 0.45, 0.24); g.userData.float = 1;
    } else {
      r = body({ sh: 0.16, bulk: 1 });
      A(new T3.ConeGeometry(0.02, 0.2, 8), gm, -0.06, r.hy + 0.25, 0.08, 0, 0, -0.2); A(Sp(0.025, 10, 8), glow, -0.08, r.hy + 0.35, 0.08);
      A(RB(0.14, 0.28, 0.26), gm, -0.22, r.ty + 0.02, 0); A(RB(0.02, 0.2, 0.18), glow, -0.15, r.ty + 0.02, 0);
      for (const s of [-1, 1]) { A(Cy(0.04, 0.055, 0.14, 14), blk, -0.25, r.ty - 0.18, s * 0.08); A(Cy(0.035, 0.035, 0.02, 14), glow, -0.25, r.ty - 0.26, s * 0.08); }
      for (const s of [-1, 1]) {
        const gz = s * 0.13; A(RB(0.24, 0.075, 0.055), gm, 0.1, 0, gz, 0, 0, 0, gunG); A(RB(0.06, 0.1, 0.045), blk, 0.0, -0.07, gz, 0, 0, -0.25, gunG);
        A(Cy(0.022, 0.022, 0.12, 14), blk, 0.27, 0.01, gz, 0, 0, Math.PI / 2, gunG); A(new T3.TorusGeometry(0.024, 0.008, 6, 16), glow, 0.33, 0.01, gz, 0, Math.PI / 2, 0, gunG);
        A(RB(0.1, 0.02, 0.058), glow, 0.1, 0.04, gz, 0, 0, 0, gunG); A(Cy(0.015, 0.015, 0.06, 8), this.S(col, 0.2, 0.3, 0.7), 0.06, 0.0, gz + s * 0.03, Math.PI / 2, 0, 0, gunG);
      }
      gunG.position.set(0.24, 0.6, 0);
    }
    g.userData.torso = r.tor; this.merge(piv, new Set(g.userData.spin || []));
    const sh = new T3.Mesh(this.discGeo, new T3.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.scale.set(0.45, 0.45, 1); sh.position.y = 0.01; g.add(sh);
    g.scale.setScalar(1.55); return g;
  },
  enemyModel(e) {
    const T3 = THREE, g = new T3.Group(), col = e.col, m = this.M(col), r = e.r / TS * 1.25;
    const body = new T3.Group(); g.add(body); g.userData.body = body;
    const add = (geo, mat, y = r, x = 0, z = 0) => { const o = new T3.Mesh(geo, mat || m); o.position.set(x, y, z); body.add(o); return o; };
    switch (e.type) {
      case 'bug': add(new T3.OctahedronGeometry(r, 0)); add(new T3.OctahedronGeometry(r * 0.7, 0), this.M(col, { basic: 1, op: 0.35, add: 1 })).rotation.y = 0.7; break;
      case 'worm': for (let i = 0; i < 4; i++) add(new T3.SphereGeometry(r * (1 - i * 0.18), 12, 10), m, r * 0.9, -i * r * 0.9); break;
      case 'turret': add(new T3.CylinderGeometry(r, r * 1.15, r * 0.9, 8), m, r * 0.45); { const b = add(new T3.BoxGeometry(r * 1.6, r * 0.35, r * 0.35), this.M('#3a1018', { e: 0.3 }), r * 1.1, r * 0.8); g.userData.barrel = b; } break;
      case 'drone': add(new T3.ConeGeometry(r, r * 1.3, 3), m, r * 1.6).rotation.x = Math.PI; for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; add(new T3.TorusGeometry(r * 0.3, r * 0.06, 6, 16), this.M(col, { basic: 1 }), r * 2.1, Math.cos(a) * r, Math.sin(a) * r).rotation.x = Math.PI / 2; } break;
      case 'guard': add(new T3.CylinderGeometry(r, r, r * 1.5, 6), m, r * 0.75); add(new T3.CylinderGeometry(r * 0.7, r * 0.7, r * 1.55, 6), this.M(col, { basic: 1, op: 0.3, add: 1 }), r * 0.75); break;
      case 'bomber': add(new T3.SphereGeometry(r, 16, 12)); add(new T3.CylinderGeometry(0.03, 0.03, r * 0.6, 6), this.M('#ffd23d', { basic: 1 }), r * 2.1); g.userData.fuse = add(new T3.SphereGeometry(0.07, 8, 6), this.M('#ffd23d', { basic: 1 }), r * 2.4); break;
      case 'splitter': add(new T3.BoxGeometry(r * 1.3, r * 1.3, r * 1.3)); add(new T3.BoxGeometry(r * 1.3, r * 1.3, r * 1.3), this.M(col, { basic: 1, op: 0.35, add: 1 })).rotation.y = 0.78; break;
      case 'glitch': add(new T3.DodecahedronGeometry(r * 1.1), this.M('#ffd700', { e: 1 })); break;
      case 'hunter': { const sm = this.S(col, 0.5, 0.35, 0.25); add(this.Cap(r * 0.45, r * 1.2), sm, r * 0.9).rotation.z = Math.PI / 2; add(new T3.ConeGeometry(r * 0.4, r * 0.9, 6), sm, r * 0.9, r * 1.1).rotation.z = -Math.PI / 2;
        for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const l = add(new T3.CylinderGeometry(0.02, 0.015, r * 1.3, 5), this.S('#222', 0.7, 0.4, 0), r * 0.45, (i ? 0.3 : -0.3) * r, s * r * 0.55); l.rotation.x = s * 0.7; }
        for (let i = 0; i < 4; i++) add(new T3.ConeGeometry(r * 0.1, r * 0.4, 4), this.M('#ffffff', { basic: 1 }), r * 1.35, -r * 0.4 + i * r * 0.25).rotation.z = 0.4; break; }
      case 'sniper': { const sm = this.S(col, 0.6, 0.3, 0.2); add(new T3.CylinderGeometry(r * 0.2, r * 0.7, r * 1.6, 8), sm, r * 0.8); add(new T3.SphereGeometry(r * 0.5, 14, 10), this.S('#2a2a3a', 0.8, 0.25, 0.05), r * 1.8);
        add(new T3.CylinderGeometry(0.03, 0.03, r * 2.6, 8), this.S('#1a1a22', 0.8, 0.3, 0), r * 1.7, r * 1.2).rotation.z = Math.PI / 2; add(new T3.SphereGeometry(0.05, 8, 6), this.M('#ff2020', { basic: 1 }), r * 1.7, r * 2.5);
        for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28, l = add(new T3.CylinderGeometry(0.02, 0.02, r * 1.4, 5), this.S('#333', 0.7, 0.4, 0), r * 0.4, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); l.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); } break; }
      case 'tank': { const sm = this.S(col, 0.7, 0.35, 0.15), dk = this.S('#2a2238', 0.8, 0.4, 0.02); add(this.RB(r * 2, r * 0.9, r * 1.7), sm, r * 0.75); add(this.RB(r * 1.2, r * 0.6, r * 1.2), dk, r * 1.45);
        for (const s of [-1, 1]) { add(this.RB(r * 2.2, r * 0.6, r * 0.45), dk, r * 0.3, 0, s * r * 0.95); for (let i = 0; i < 4; i++) add(new T3.CylinderGeometry(r * 0.2, r * 0.2, r * 0.5, 12), this.S('#111', 0.5, 0.6, 0), r * 0.3, -r * 0.75 + i * r * 0.5, s * r * 0.95).rotation.x = Math.PI / 2; }
        add(new T3.CylinderGeometry(r * 0.15, r * 0.18, r * 1.6, 12), dk, r * 1.5, r * 0.9).rotation.z = Math.PI / 2; add(new T3.TorusGeometry(r * 0.17, 0.03, 6, 16), this.M(col, { basic: 1 }), r * 1.5, r * 1.7).rotation.y = Math.PI / 2; break; }
      case 'healer': { const sm = this.S('#e8fff4', 0.2, 0.4, 0.15); add(new T3.SphereGeometry(r * 0.8, 18, 14), sm, r * 1.1); add(new T3.TorusGeometry(r * 0.95, 0.04, 8, 32), this.M(col, { basic: 1 }), r * 1.1).rotation.x = Math.PI / 2;
        add(new T3.BoxGeometry(r * 0.9, r * 0.28, 0.05), this.M(col, { basic: 1 }), r * 1.2, r * 0.75).rotation.y = Math.PI / 2; add(new T3.BoxGeometry(r * 0.28, r * 0.9, 0.05), this.M(col, { basic: 1 }), r * 1.2, r * 0.75).rotation.y = Math.PI / 2;
        for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; add(new T3.CylinderGeometry(0.015, 0.015, r * 0.9, 5), this.S('#555', 0.8, 0.3, 0), r * 0.35, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); } break; }
      case 'shielder': { const sm = this.S(col, 0.6, 0.3, 0.2); add(this.Cap(r * 0.55, r * 0.8), sm, r * 1.0); add(new T3.SphereGeometry(r * 0.4, 14, 10), this.S('#c8dcff', 0.4, 0.3, 0.2), r * 1.9);
        const sh = add(new T3.SphereGeometry(r * 1.3, 20, 12, -1.1, 2.2, 0.5, 1.6), new T3.MeshBasicMaterial({ color: this.C(col), transparent: true, opacity: 0.28, side: T3.DoubleSide, blending: T3.AdditiveBlending, depthWrite: false }), r * 1.1, r * 0.3); sh.rotation.y = Math.PI / 2; g.userData.dome = sh; break; }
      case 'miner': { const sm = this.S(col, 0.5, 0.4, 0.2); add(this.RB(r * 1.4, r * 0.9, r * 1.2), sm, r * 0.7); add(new T3.CylinderGeometry(r * 0.3, r * 0.3, r * 0.5, 12), this.S('#333', 0.7, 0.3, 0), r * 1.35);
        for (let i = 0; i < 3; i++) add(new T3.SphereGeometry(r * 0.22, 10, 8), this.M('#ff3d20', { basic: 1 }), r * 1.15, -r * 0.4 + i * r * 0.4, -r * 0.65); for (const s of [-1, 1]) add(new T3.CylinderGeometry(r * 0.28, r * 0.28, r * 0.2, 12), this.S('#111', 0.4, 0.6, 0), r * 0.28, 0, s * r * 0.65).rotation.x = Math.PI / 2; break; }
    }
    if (e.type !== 'glitch') { const ey = this.eye(r * 0.36); ey.position.y = e.type === 'drone' ? r * 1.6 : e.type === 'turret' ? r * 0.9 : r * 1.05; g.add(ey); g.userData.eye = ey; g.userData.eyeR = r * 0.55; }
    const sh = new T3.Mesh(this.discGeo, new T3.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.scale.set(r, r, 1); sh.position.y = 0.012; g.add(sh);
    // маркер угрозы: красное зубчатое кольцо под каждым врагом
    if (e.type !== 'glitch') {
      const th = new T3.Group(); th.position.y = 0.03; g.add(th); g.userData.threat = th;
      const rm = new T3.Mesh(this.ringGeo, new T3.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.85, side: T3.DoubleSide, depthWrite: false })); rm.rotation.x = -Math.PI / 2; rm.scale.set(r * 1.35, r * 1.35, 1); th.add(rm);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, s = new T3.Mesh(new T3.ConeGeometry(0.05, 0.16, 3), this.M('#ff2040', { basic: 1 })); s.position.set(Math.cos(a) * r * 1.5, 0, Math.sin(a) * r * 1.5); s.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2); th.add(s); }
      // рожки/шипы — «живой» силуэт
      for (const s of [-1, 1]) { const h = new T3.Mesh(new T3.ConeGeometry(r * 0.12, r * 0.5, 5), this.M('#ff2040', { basic: 1 })); h.position.set(0, r * 2 + (e.type === 'drone' ? r * 0.4 : 0), s * r * 0.35); h.rotation.x = s * 0.4; body.add(h); }
    }
    this.merge(body); if (g.userData.threat) this.merge(g.userData.threat);
    g.userData.r = r; return g;
  },
  bossModel(b) {
    const T3 = THREE, g = new T3.Group(), col = b.col, m = this.M(col, { e: 0.5 }), gl = this.M(col, { basic: 1 }), r = b.r / TS * 1.1;
    const add = (geo, mat, y) => { const o = new T3.Mesh(geo, mat || m); o.position.y = y; g.add(o); return o; };
    if (b.id === 'firewall') { g.userData.a = add(new T3.CylinderGeometry(r, r * 1.1, r * 1.3, 6), m, r * 0.65); g.userData.b = add(new T3.TorusGeometry(r * 1.3, 0.06, 8, 40), gl, r * 0.8); g.userData.b.rotation.x = Math.PI / 2; g.userData.c = add(new T3.TorusGeometry(r * 0.8, 0.05, 8, 30), gl, r * 1.5); }
    else if (b.id === 'serpent') { add(new T3.SphereGeometry(r, 18, 14), m, r); const ey = this.eye(r * 0.3); ey.position.set(r * 0.6, r * 1.3, r * 0.4); g.add(ey); const ey2 = this.eye(r * 0.3); ey2.position.set(r * 0.6, r * 1.3, -r * 0.4); g.add(ey2); }
    else if (b.id === 'overclock') { g.userData.a = add(new T3.TorusGeometry(r * 0.8, r * 0.28, 10, 30), m, r); g.userData.a.rotation.x = Math.PI / 2; for (let i = 0; i < 8; i++) { const t = new T3.Mesh(new T3.BoxGeometry(r * 0.4, r * 0.3, r * 0.3), gl); const a = i / 8 * 6.28; t.position.set(Math.cos(a) * r * 1.15, 0, Math.sin(a) * r * 1.15); t.rotation.y = -a; g.userData.a.add(t); t.rotation.x = Math.PI / 2; } add(new T3.SphereGeometry(r * 0.45, 14, 10), gl, r); }
    else if (b.id === 'eye') { add(new T3.SphereGeometry(r, 24, 18), this.M('#e8e0ff', { e: 0.35, dark: 0.8 }), r * 1.4); const iris = add(new T3.SphereGeometry(r * 0.45, 16, 12), gl, r * 1.4); const pu = add(new T3.SphereGeometry(r * 0.22, 12, 10), new T3.MeshBasicMaterial({ color: 0 }), r * 1.4); g.userData.iris = iris; g.userData.pu = pu; g.userData.ring = add(new T3.TorusGeometry(r * 1.4, 0.05, 8, 50), gl, r * 1.4); }
    else if (b.id === 'crusher') {
      const st = this.S('#a89480', 0.6, 0.35, 0.18), hz = this.S('#ff9a1a', 0.4, 0.4, 0.45), dk = this.S('#3a3228', 0.6, 0.5, 0.08);
      const body = new T3.Group(); g.add(body); g.userData.body = body;
      const A = (geo, m, x, y, z) => { const o = new T3.Mesh(geo, m); o.position.set(x, y, z); body.add(o); return o; };
      A(this.RB(r * 2.2, r * 0.5, r * 2.2), dk, 0, r * 0.25, 0); A(this.RB(r * 1.8, r * 1.2, r * 1.8), st, 0, r * 1.1, 0);
      for (let i = 0; i < 6; i++) A(this.RB(r * 0.25, r * 0.1, r * 1.85), i % 2 ? hz : dk, -r * 0.65 + i * r * 0.26, r * 1.72, 0);
      g.userData.press = A(this.RB(r * 2.4, r * 0.4, r * 2.4), st, 0, r * 2.6, 0); for (const s of [-1, 1]) for (const f of [-1, 1]) A(new T3.CylinderGeometry(r * 0.12, r * 0.12, r * 1.6, 12), this.S('#aaa', 0.95, 0.2, 0.02), s * r * 0.95, r * 2.0, f * r * 0.95);
      for (const s of [-1, 1]) { const gr = A(new T3.CylinderGeometry(r * 0.55, r * 0.55, r * 0.2, 12), hz, 0, r * 1.1, s * r * 1.0); gr.rotation.x = Math.PI / 2; g.userData.gears = (g.userData.gears || []).concat([gr]); }
      A(this.RB(r * 0.5, r * 0.3, r * 1.2), this.M('#ff3d20', { basic: 1 }), r * 0.92, r * 1.3, 0);
      for (let i = 0; i < 3; i++) A(new T3.CylinderGeometry(r * 0.12, r * 0.15, r * 0.9, 10), dk, -r * 0.6, r * 2.9 + i * 0, -r * 0.6 + i * r * 0.6);
    }
    else if (b.id === 'cryo') {
      const ice = this.S('#cfefff', 0.2, 0.1, 0.35); ice.transparent = true; ice.opacity = 0.9; const dk = this.S('#1a2a3a', 0.6, 0.3, 0.05);
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new T3.Vector2(r * (0.3 + t * t * 0.9), r * 2.4 - t * r * 2.4)); }
      add(new T3.LatheGeometry(pts, 8), ice, 0); add(new T3.SphereGeometry(r * 0.38, 16, 12), dk, r * 2.6);
      add(new T3.SphereGeometry(r * 0.4, 16, 6, 0, 6.28, 1.2, 0.5), this.M('#9fe8ff', { basic: 1 }), r * 2.6);
      g.userData.crown = new T3.Group(); g.userData.crown.position.y = r * 3.0; g.add(g.userData.crown);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, c = new T3.Mesh(new T3.ConeGeometry(r * 0.08, r * (0.4 + (i % 2) * 0.35), 5), ice); c.position.set(Math.cos(a) * r * 0.35, r * 0.2, Math.sin(a) * r * 0.35); g.userData.crown.add(c); }
      g.userData.a = new T3.Group(); g.userData.a.position.y = r * 1.4; g.add(g.userData.a);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, s = new T3.Mesh(new T3.OctahedronGeometry(r * 0.18, 0), ice); s.scale.set(0.5, 1.8, 0.5); s.position.set(Math.cos(a) * r * 1.5, Math.sin(i) * r * 0.3, Math.sin(a) * r * 1.5); g.userData.a.add(s); }
    }
    else if (b.id === 'hive') {
      const sh = this.S('#2a3450', 0.8, 0.3, 0.08), gl = this.M(col, { basic: 1 });
      add(new T3.SphereGeometry(r, 24, 16, 0, 6.28, 0, 1.9), sh, r * 1.3).scale.set(1, 0.7, 1);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, c = add(new T3.CylinderGeometry(r * 0.12, r * 0.16, r * 0.25, 6), sh, r * 1.0); c.position.x = Math.cos(a) * r * 0.85; c.position.z = Math.sin(a) * r * 0.85; c.rotation.z = Math.cos(a) * 0.9; c.rotation.x = -Math.sin(a) * 0.9; const l = add(new T3.CircleGeometry(r * 0.1, 6), gl, r * 1.0); l.position.copy(c.position); l.position.y += r * 0.12; l.rotation.x = -Math.PI / 2; }
      const eye = add(new T3.SphereGeometry(r * 0.35, 16, 12), gl, r * 1.95); g.userData.iris = null;
      g.userData.b = add(new T3.TorusGeometry(r * 1.3, 0.05, 8, 60), gl, r * 1.0); g.userData.b.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28, l = add(new T3.CylinderGeometry(0.06, 0.04, r * 1.3, 6), sh, r * 0.4); l.position.x = Math.cos(a) * r * 0.9; l.position.z = Math.sin(a) * r * 0.9; l.rotation.z = Math.cos(a) * 0.5; l.rotation.x = -Math.sin(a) * 0.5; }
    }
    else { g.userData.a = add(new T3.OctahedronGeometry(r), b.id === 'null' ? new T3.MeshBasicMaterial({ color: 0xffffff, wireframe: true }) : m, r * 1.3); g.userData.b = add(new T3.TorusGeometry(r * 1.3, 0.06, 8, 50), gl, r * 1.3); g.userData.c = add(new T3.TorusGeometry(r * 1.6, 0.04, 8, 50), gl, r * 1.3); g.userData.c.rotation.x = Math.PI / 2; }
    const sh = new T3.Mesh(this.discGeo, new T3.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.5, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.scale.set(r * 1.2, r * 1.2, 1); sh.position.y = 0.012; g.add(sh);
    return g;
  },

  /* ---------- сборка уровня ---------- */
  build(G) {
    if (!this.ok) return;
    const T3 = THREE, lv = G.lv, pal = G.pal;
    if (this.lvG) { this.scene.remove(this.lvG); this.lvG.traverse(o => { if (o.geometry && o.geometry !== this.discGeo && o.geometry !== this.planeGeo && o.geometry !== this.ringGeo) o.geometry.dispose && o.geometry.dispose(); }); }
    const grp = this.lvG = new T3.Group(); this.scene.add(grp);
    this.scene.fog.color.set(0x020108);
    // пол (текстура из 2D-рендера пола)
    const fs = Math.min(24, Math.floor(2048 / lv.W)); const fc = this.floorCv = this.floorCv || document.createElement('canvas'); fc.width = lv.W * fs; fc.height = lv.H * fs; this.fs = fs;
    fc.getContext('2d').drawImage(G.mapCv, 0, 0, fc.width, fc.height);
    this.ftex = new T3.CanvasTexture(fc); this.ftex.anisotropy = 4;
    const floor = new T3.Mesh(new T3.PlaneGeometry(lv.W, lv.H), new T3.MeshLambertMaterial({ map: this.ftex, emissive: 0xffffff, emissiveMap: this.ftex, emissiveIntensity: 0.42 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(lv.W / 2, 0, lv.H / 2); grp.add(floor);
    const out = new T3.Mesh(new T3.PlaneGeometry(lv.W + 80, lv.H + 80), new T3.MeshLambertMaterial({ color: this.C(pal.wall).clone().multiplyScalar(0.35), emissive: this.C(pal.wall).clone().multiplyScalar(0.25) })); out.rotation.x = -Math.PI / 2; out.position.set(lv.W / 2, -0.02, lv.H / 2); grp.add(out);
    // стены и объекты
    const WH = 1.25, cnt = { w: 0, p: 0, c: 0, b: 0 }, at = (x, y) => (x < 0 || y < 0 || x >= lv.W || y >= lv.H) ? 1 : lv.t[y * lv.W + x];
    const open = (x, y) => { const v = at(x, y); return v === 0 || v === 3 || v === 6 || v === 4; };
    for (let i = 0; i < lv.t.length; i++) { const v = lv.t[i]; if (v === 1 || v === 2) cnt.w++; else if (v === 5) cnt.p++; else if (v === 3) cnt.c++; else if (v === 6) cnt.b++; }
    const wallMat = new T3.MeshLambertMaterial({ color: this.C(pal.wall).clone().lerp(this.C(pal.edge), 0.35).lerp(this.C('#ffffff'), 0.12), emissive: this.C(pal.wall).clone().lerp(this.C(pal.edge), 0.2), emissiveIntensity: 0.8 });
    this.iWall = new T3.InstancedMesh(new T3.BoxGeometry(1, WH, 1), wallMat, Math.max(1, cnt.w)); this.iWall.count = 0;
    this.iPil = new T3.InstancedMesh(new T3.CylinderGeometry(0.34, 0.4, 1.5, 6), new T3.MeshLambertMaterial({ color: this.C(pal.wall), emissive: this.C(pal.edge), emissiveIntensity: 0.25 }), Math.max(1, cnt.p)); this.iPil.count = 0;
    this.iCrate = new T3.InstancedMesh(new T3.BoxGeometry(0.8, 0.8, 0.8), new T3.MeshLambertMaterial({ color: 0x7a6040, emissive: 0x3a2a14, emissiveIntensity: 0.6 }), Math.max(1, cnt.c)); this.iCrate.count = 0;
    this.iBar = new T3.InstancedMesh(new T3.CylinderGeometry(0.28, 0.28, 0.75, 14), new T3.MeshLambertMaterial({ color: 0x400810, emissive: 0xff2a45, emissiveIntensity: 0.7 }), Math.max(1, cnt.b)); this.iBar.count = 0;
    this.tileInst = {}; const d = this.dummy;
    const colW = this.C(pal.wall), colC = this.C('#3a2a10');
    for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
      const i = y * lv.W + x, v = lv.t[i];
      if (v === 1 || v === 2) {
        const near = open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1) || open(x - 1, y - 1) || open(x + 1, y + 1) || open(x - 1, y + 1) || open(x + 1, y - 1);
        const h = near ? WH : 0.9;
        d.position.set(x + 0.5, h / 2, y + 0.5); d.scale.set(1, h / WH, 1); d.rotation.set(0, 0, 0); d.updateMatrix();
        const k = this.iWall.count++; this.iWall.setMatrixAt(k, d.matrix); this.iWall.setColorAt(k, v === 2 ? colC : (near ? colW : this.C('#06040e'))); this.tileInst[i] = ['w', k];
      } else if (v === 5) { d.position.set(x + 0.5, 0.75, y + 0.5); d.scale.set(1, 1, 1); d.rotation.set(0, 0.3, 0); d.updateMatrix(); const k = this.iPil.count++; this.iPil.setMatrixAt(k, d.matrix); this.tileInst[i] = ['p', k]; }
      else if (v === 3) { d.position.set(x + 0.5, 0.4, y + 0.5); d.scale.set(1, 1, 1); d.rotation.set(0, ((x * 7 + y * 3) % 5) * 0.12, 0); d.updateMatrix(); const k = this.iCrate.count++; this.iCrate.setMatrixAt(k, d.matrix); this.tileInst[i] = ['c', k]; }
      else if (v === 6) { d.position.set(x + 0.5, 0.375, y + 0.5); d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); const k = this.iBar.count++; this.iBar.setMatrixAt(k, d.matrix); this.tileInst[i] = ['b', k]; }
    }
    [this.iWall, this.iPil, this.iCrate, this.iBar].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; grp.add(m); });
    // каркас ящиков и колец бочек
    this.WH = WH; this.buildEdges();
    // кусты
    let nb = 0; for (let i = 0; i < lv.bush.length; i++) if (lv.bush[i]) nb++;
    this.iBush = new T3.InstancedMesh(new T3.ConeGeometry(0.17, 0.85, 5), new T3.MeshLambertMaterial({ color: 0x0b4a32, emissive: 0x1fd394, emissiveIntensity: 0.45 }), Math.max(1, nb * 4)); this.iBush.count = 0; this.bushInfo = [];
    for (let i = 0; i < lv.bush.length; i++) if (lv.bush[i]) { const x = i % lv.W, y = (i / lv.W) | 0, h = G.hsh(x, y); for (let k = 0; k < 4; k++) { const ox = ((h >> (k * 4)) & 15) / 15 * 0.8 + 0.1, oz = ((h >> (k * 4 + 2)) & 15) / 15 * 0.8 + 0.1; this.bushInfo.push([x + ox, y + oz, 0.8 + ((h >> k) & 3) * 0.15, i]); this.iBush.count++; } }
    this.iBush.instanceMatrix.setUsage(T3.DynamicDrawUsage); grp.add(this.iBush);
    // сундуки
    this.chestM = [];
    // портал
    const pg = this.portalG = new T3.Group(); grp.add(pg);
    for (let i = 0; i < 3; i++) { const t = new T3.Mesh(new T3.TorusGeometry(0.6 - i * 0.15, 0.04, 8, 40), new T3.MeshBasicMaterial({ color: 0xffffff })); t.position.y = 0.7; pg.add(t); }
    const disc = new T3.Mesh(this.discGeo, new T3.MeshBasicMaterial({ color: 0x3dffa0, transparent: true, opacity: 0.5, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide })); disc.scale.set(0.55, 0.55, 1); disc.position.y = 0.7; pg.add(disc); pg.userData.disc = disc;
    const pad = new T3.Mesh(new T3.CylinderGeometry(0.75, 0.85, 0.12, 24), this.M('#1a1638', { e: 0.2 })); pad.position.y = 0.06; pg.add(pad);
    // ускорители, телепорты
    lv.pads.forEach(p => { const m = new T3.Mesh(new T3.CylinderGeometry(0.4, 0.42, 0.05, 20), this.M('#00f0ff', { e: 0.6 })); m.position.set(p.x / TS, 0.03, p.y / TS); grp.add(m); });
    lv.tps.forEach(tp => [tp.a, tp.b].forEach(q => { const m = new T3.Mesh(new T3.TorusGeometry(0.38, 0.06, 8, 30), this.M('#b44dff', { basic: 1 })); m.rotation.x = Math.PI / 2; m.position.set(q.x / TS, 0.06, q.y / TS); grp.add(m); }));
    // декор: вентиляция и антенны на стенах, фонари, кабели и плиты на полу
    const hs = (x, y, k) => ((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0;
    const decW = [], decL = [], decF = [], decC = [];
    for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
      const v = at(x, y), h = hs(x, y, 1) % 100;
      if (v === 1) { const near = open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1); if (!near) continue; if (h < 22) decW.push([x, y, h]); else if (h < 30) decL.push([x + 0.5, y + 0.5]); }
      else if (v === 0) { if (h < 5) decF.push([x, y, h]); else if (h < 8 && (at(x - 1, y) === 1 || at(x + 1, y) === 1 || at(x, y - 1) === 1 || at(x, y + 1) === 1)) decC.push([x, y, h]); }
    }
    const IM = (geo, mat, list, fn) => { const m = new T3.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = 0; list.forEach(a => { fn(a); d.updateMatrix(); m.setMatrixAt(m.count++, d.matrix); }); m.instanceMatrix.needsUpdate = true; grp.add(m); return m; };
    const wcol = this.C(pal.wall).clone().lerp(this.C('#ffffff'), 0.08);
    IM(new T3.BoxGeometry(0.5, 0.16, 0.5), new T3.MeshLambertMaterial({ color: wcol, emissive: this.C(pal.wall), emissiveIntensity: 0.5 }), decW, ([x, y, h]) => { d.position.set(x + 0.5, WH + 0.08, y + 0.5); d.rotation.set(0, (h % 4) * 0.4, 0); d.scale.set(1, 1, 1); });
    IM(new T3.BoxGeometry(0.42, 0.03, 0.42), new T3.MeshBasicMaterial({ color: this.C(pal.edge) }), decW, ([x, y, h]) => { d.position.set(x + 0.5, WH + 0.17, y + 0.5); d.rotation.set(0, (h % 4) * 0.4, 0); d.scale.set(h % 3 ? 0.4 : 1, 1, h % 3 ? 1 : 0.4); });
    IM(new T3.CylinderGeometry(0.03, 0.03, 0.9, 5), new T3.MeshLambertMaterial({ color: 0x333355, emissive: 0x222244 }), decL, ([x, z]) => { d.position.set(x, WH + 0.45, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); });
    this.lamps = decL;
    IM(new T3.BoxGeometry(0.9, 0.02, 0.9), new T3.MeshLambertMaterial({ color: 0x0a0a18, emissive: this.C(pal.edge), emissiveIntensity: 0.18 }), decF, ([x, y]) => { d.position.set(x + 0.5, 0.012, y + 0.5); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); });
    IM(new T3.CylinderGeometry(0.035, 0.035, 0.9, 6), new T3.MeshLambertMaterial({ color: 0x111122, emissive: this.C(pal.edge), emissiveIntensity: 0.15 }), decC, ([x, y, h]) => { d.position.set(x + 0.5, 0.04, y + 0.5); d.rotation.set(0, 0, Math.PI / 2); d.rotation.y = (h % 2) * Math.PI / 2; d.scale.set(1, 1, 1); });
    this.biomeDeco(lv, grp, at, open, WH);
    // терминалы взлома
    this.termG = (lv.terms || []).map(tm => {
      const o = new T3.Group(); o.position.set(tm.x / TS, 0, tm.y / TS); grp.add(o);
      const b = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.6, 0.1, 6), this.M('#122018', { e: 0.15, dark: 0.7 })); b.position.y = 0.05; o.add(b);
      const st = new T3.Mesh(new T3.BoxGeometry(0.34, 0.75, 0.24), this.M('#1a2a22', { e: 0.15, dark: 0.7 })); st.position.y = 0.45; o.add(st);
      const scr = new T3.Mesh(new T3.BoxGeometry(0.4, 0.3, 0.04), this.M('#3dffa0', { basic: 1 })); scr.position.set(0, 0.9, 0.14); scr.rotation.x = -0.4; o.add(scr);
      for (let i = 0; i < 3; i++) { const k = new T3.Mesh(new T3.BoxGeometry(0.06, 0.06, 0.02), this.M(['#ffd23d', '#ff3d55', '#00f0ff'][i], { basic: 1 })); k.position.set(-0.1 + i * 0.1, 0.6, 0.13); o.add(k); }
      const ant = new T3.Mesh(new T3.CylinderGeometry(0.015, 0.015, 0.5, 4), this.M('#556', { e: 0.1 })); ant.position.set(0.12, 1.2, 0); o.add(ant);
      o.userData.scr = scr; return o;
    });
    // алтари усилений
    const SC = { rage: '#ff3d55', haste: '#00f0ff', aegis: '#78c8ff', magnet: '#ffd23d' };
    this.shrG = (lv.shrines || []).map(s => {
      const o = new T3.Group(); o.position.set(s.x / TS, 0, s.y / TS); grp.add(o); const c = SC[s.k];
      const b = new T3.Mesh(new T3.CylinderGeometry(0.38, 0.48, 0.25, 8), this.M('#201830', { e: 0.15, dark: 0.7 })); b.position.y = 0.12; o.add(b);
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.78, p = new T3.Mesh(new T3.BoxGeometry(0.08, 0.6, 0.08), this.M('#2a2040', { e: 0.15 })); p.position.set(Math.cos(a) * 0.4, 0.4, Math.sin(a) * 0.4); o.add(p); const tip = new T3.Mesh(new T3.SphereGeometry(0.05, 6, 4), this.M(c, { basic: 1 })); tip.position.set(Math.cos(a) * 0.4, 0.73, Math.sin(a) * 0.4); o.add(tip); }
      const gem = new T3.Mesh(s.k === 'rage' ? new T3.TetrahedronGeometry(0.2) : s.k === 'haste' ? new T3.ConeGeometry(0.16, 0.36, 3) : s.k === 'aegis' ? new T3.IcosahedronGeometry(0.18) : new T3.TorusGeometry(0.14, 0.05, 8, 16), this.M(c, { e: 1, dark: 0.8 })); gem.position.y = 0.75; o.add(gem);
      o.userData.gem = gem; o.userData.c = c; return o;
    });
    this.models = new Map(); this.heroG = null; this.bossG = null; this.lastSkin = null;
  },
  buildEdges() {
    const T3 = THREE, lv = G.lv, pal = G.pal, WH = this.WH;
    if (this.iEdge) { this.lvG.remove(this.iEdge); this.iEdge.geometry.dispose(); }
    const at = (x, y) => (x < 0 || y < 0 || x >= lv.W || y >= lv.H) ? 1 : lv.t[y * lv.W + x];
    const open = (x, y) => { const v = at(x, y); return v === 0 || v === 3 || v === 6 || v === 4; };
    const list = [];
    for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
      const v = at(x, y); if (v !== 1 && v !== 2) continue;
      if (open(x, y - 1)) list.push([x + 0.5, y, 1, 0]); if (open(x, y + 1)) list.push([x + 0.5, y + 1, 1, 0]);
      if (open(x - 1, y)) list.push([x, y + 0.5, 0, 1]); if (open(x + 1, y)) list.push([x + 1, y + 0.5, 0, 1]);
    }
    const m = this.iEdge = new T3.InstancedMesh(new T3.BoxGeometry(1, 1, 1), new T3.MeshBasicMaterial({ color: this.C(pal.edge) }), Math.max(1, list.length * 2)); m.count = 0;
    const d = this.dummy;
    list.forEach(([x, z, hx, hz]) => {
      d.rotation.set(0, 0, 0); d.position.set(x, WH, z); d.scale.set(hx ? 1.02 : 0.05, 0.05, hz ? 1.02 : 0.05); d.updateMatrix(); m.setMatrixAt(m.count++, d.matrix);
      d.position.set(x, 0.02, z); d.scale.set(hx ? 1.02 : 0.08, 0.03, hz ? 1.02 : 0.08); d.updateMatrix(); m.setMatrixAt(m.count++, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true; this.lvG.add(m); this.edgeList = list;
  },
  breakTile(i) {
    const ti = this.tileInst && this.tileInst[i]; if (!ti) return;
    const m = { w: this.iWall, p: this.iPil, c: this.iCrate, b: this.iBar }[ti[0]];
    this.dummy.position.set(0, -50, 0); this.dummy.scale.set(0.001, 0.001, 0.001); this.dummy.updateMatrix(); m.setMatrixAt(ti[1], this.dummy.matrix); m.instanceMatrix.needsUpdate = true;
    delete this.tileInst[i]; if (ti[0] === 'w') this.buildEdges();
    if (this.floorCv) { this.floorCv.getContext('2d').drawImage(G.mapCv, 0, 0, this.floorCv.width, this.floorCv.height); this.ftex.needsUpdate = true; }
  },
  /* ---------- уникальная архитектура биомов ---------- */
  biomeDeco(lv, grp, at, open, WH) {
    const T3 = THREE, id = lv.biome.id, d = this.dummy, hs = (x, y, k) => ((x * 2654435761) ^ (y * 40503) ^ (k * 97531)) >>> 0;
    const edge = [], inner = [];
    for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) { if (at(x, y) !== 1) continue; const n = open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1); (n ? edge : inner).push([x, y, hs(x, y, 7) % 1000, open(x, y + 1) ? 's' : open(x, y - 1) ? 'n' : open(x + 1, y) ? 'e' : 'w']); }
    const IM = (geo, mat, list, fn) => { if (!list.length) return; const m = new T3.InstancedMesh(geo, mat, list.length); m.count = 0; list.forEach(a => { d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); fn(a); d.updateMatrix(); m.setMatrixAt(m.count++, d.matrix); }); m.instanceMatrix.needsUpdate = true; grp.add(m); return m; };
    const off = (s, k) => s === 's' ? [0, k] : s === 'n' ? [0, -k] : s === 'e' ? [k, 0] : [-k, 0];
    this.bfx = [];
    if (id === 'factory') {
      const pipes = edge.filter(a => a[2] < 350), chim = inner.filter(a => a[2] < 25);
      IM(new T3.CylinderGeometry(0.11, 0.11, 1.02, 10), this.S('#8a7a6a', 0.85, 0.35, 0.03), pipes, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.52); d.position.set(x + 0.5 + ox, 0.55 + (h % 3) * 0.2, y + 0.5 + oz); d.rotation.set(s === 'n' || s === 's' ? 0 : Math.PI / 2, 0, Math.PI / 2); });
      IM(this.RB(0.5, 0.06, 1.04), this.S('#ff9a1a', 0.3, 0.5, 0.4), edge.filter(a => a[2] > 900), ([x, y]) => { d.position.set(x + 0.5, WH + 0.03, y + 0.5); });
      IM(new T3.CylinderGeometry(0.3, 0.36, 2.6, 12), this.S('#4a3a2e', 0.6, 0.6, 0.02), chim, ([x, y]) => { d.position.set(x + 0.5, 1.3, y + 0.5); });
      chim.forEach(([x, y]) => this.bfx.push(['smoke', x + 0.5, 2.7, y + 0.5]));
      IM(this.RB(0.7, 0.5, 0.5), this.S('#6a5a40', 0.5, 0.6, 0.05), edge.filter(a => a[2] > 350 && a[2] < 420), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.7); d.position.set(x + 0.5 + ox, 0.25, y + 0.5 + oz); d.rotation.y = h % 3; });
    } else if (id === 'lab') {
      const tanks = edge.filter(a => a[2] < 90);
      const gl = new T3.MeshStandardMaterial({ color: 0xbfffe8, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.25 });
      IM(new T3.CylinderGeometry(0.32, 0.32, 1.5, 18, 1, true), gl, tanks, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.85); d.position.set(x + 0.5 + ox, 0.85, y + 0.5 + oz); });
      IM(new T3.CylinderGeometry(0.28, 0.28, 1.1, 16), this.M('#3dffb0', { basic: 1, op: 0.55 }), tanks, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.85); d.position.set(x + 0.5 + ox, 0.7, y + 0.5 + oz); });
      IM(new T3.CylinderGeometry(0.36, 0.4, 0.14, 18), this.S('#ccd8d4', 0.6, 0.3, 0.05), tanks, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.85); d.position.set(x + 0.5 + ox, 0.07, y + 0.5 + oz); });
      tanks.forEach(([x, y, h, s]) => { const [ox, oz] = off(s, 0.85); this.bfx.push(['bub', x + 0.5 + ox, 0.2, y + 0.5 + oz]); });
      IM(this.RB(1.04, 0.05, 0.1), this.M('#ffffff', { basic: 1 }), edge.filter(a => a[2] > 500), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.5); d.position.set(x + 0.5 + ox * 1.02, WH * 0.6, y + 0.5 + oz * 1.02); if (s === 'e' || s === 'w') d.rotation.y = Math.PI / 2; });
    } else if (id === 'city') {
      const tall = edge.filter(a => a[2] < 420 && a[3] === 's').concat(inner.filter(a => a[2] < 400 && !open(a[0], a[1] - 1) && !open(a[0], a[1] - 2)));
      IM(new T3.BoxGeometry(1, 1, 1), this.S('#1a1028', 0.4, 0.6, 0.06), tall, ([x, y, h]) => { const H = 1.5 + (h % 5) * 0.7; d.position.set(x + 0.5, WH + H / 2, y + 0.5); d.scale.set(1, H, 1); });
      const signs = edge.filter(a => a[2] < 420 && a[3] === 's' && a[2] % 3 === 0);
      IM(new T3.PlaneGeometry(0.8, 0.45), this.M('#ff3dc8', { basic: 1, ds: 1 }), signs.filter(a => a[2] % 2), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.52); d.position.set(x + 0.5 + ox, WH + 0.8 + (h % 3) * 0.4, y + 0.5 + oz); d.rotation.y = s === 'e' ? Math.PI / 2 : s === 'w' ? -Math.PI / 2 : s === 'n' ? Math.PI : 0; });
      IM(new T3.PlaneGeometry(0.45, 0.9), this.M('#00f0ff', { basic: 1, ds: 1 }), signs.filter(a => !(a[2] % 2)), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.52); d.position.set(x + 0.5 + ox, WH + 1 + (h % 3) * 0.4, y + 0.5 + oz); d.rotation.y = s === 'e' ? Math.PI / 2 : s === 'w' ? -Math.PI / 2 : s === 'n' ? Math.PI : 0; });
      IM(new T3.BoxGeometry(0.06, 0.06, 0.06), this.M('#ffd23d', { basic: 1 }), tall.filter(a => a[2] % 2), ([x, y, h]) => { d.position.set(x + 0.5 + ((h % 7) - 3) * 0.1, WH + 1 + (h % 4) * 0.5, y + 1.01); d.scale.set(3, 1.5, 1); });
    } else if (id === 'frost') {
      IM(this.RB(1.02, 0.14, 1.02), this.S('#f4faff', 0.05, 0.7, 0.25), edge.concat(inner.filter(a => a[2] < 500)), ([x, y, h]) => { d.position.set(x + 0.5, WH + 0.06, y + 0.5); d.scale.set(1, 1 + (h % 3) * 0.4, 1); });
      const ic = this.S('#bfe8ff', 0.1, 0.05, 0.4); ic.transparent = true; ic.opacity = 0.85;
      IM(new T3.ConeGeometry(0.06, 0.45, 5), ic, edge.filter(a => a[2] < 500), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.53); d.position.set(x + 0.5 + ox + ((h % 5) - 2) * 0.15, WH - 0.25, y + 0.5 + oz); d.rotation.x = Math.PI; d.scale.set(1, 0.6 + (h % 4) * 0.25, 1); });
      IM(new T3.OctahedronGeometry(0.3, 0), ic, edge.filter(a => a[2] > 930), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.7); d.position.set(x + 0.5 + ox, 0.35, y + 0.5 + oz); d.scale.set(0.6, 1.6, 0.6); d.rotation.z = (h % 5) * 0.15; });
      this.bfx.push(['snow']);
    } else if (id === 'station') {
      const win = edge.filter(a => a[2] < 300);
      IM(new T3.PlaneGeometry(0.75, 0.5), this.M('#05081a', { basic: 1, ds: 1 }), win, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.505); d.position.set(x + 0.5 + ox, WH * 0.6, y + 0.5 + oz); d.rotation.y = s === 'e' ? Math.PI / 2 : s === 'w' ? -Math.PI / 2 : s === 'n' ? Math.PI : 0; });
      IM(new T3.TorusGeometry(0.34, 0.04, 6, 4), this.S('#8aa0c8', 0.9, 0.25, 0.05), win, ([x, y, h, s]) => { const [ox, oz] = off(s, 0.51); d.position.set(x + 0.5 + ox, WH * 0.6, y + 0.5 + oz); d.rotation.set(0, s === 'e' || s === 'w' ? Math.PI / 2 : 0, Math.PI / 4); d.scale.set(1.5, 1, 1); });
      win.forEach(([x, y, h, s]) => { const [ox, oz] = off(s, 0.51); for (let k = 0; k < 2; k++) this.bfx.push(['star', x + 0.5 + ox + ((hs(x, y, k) % 60) / 100 - 0.3) * (s === 'n' || s === 's' ? 1 : 0), WH * 0.6 + ((hs(x, y, k + 5) % 40) / 100 - 0.2), y + 0.5 + oz + ((hs(x, y, k) % 60) / 100 - 0.3) * (s === 'e' || s === 'w' ? 1 : 0)]); });
      IM(this.RB(0.5, 0.4, 0.35), this.S('#3a4868', 0.7, 0.3, 0.1), edge.filter(a => a[2] > 300 && a[2] < 380), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.68); d.position.set(x + 0.5 + ox, 0.2, y + 0.5 + oz); });
      edge.filter(a => a[2] > 300 && a[2] < 380).forEach(([x, y, h, s]) => { const [ox, oz] = off(s, 0.68); this.bfx.push(['con', x + 0.5 + ox, 0.45, y + 0.5 + oz]); });
    } else if (id === 'crystal' || id === 'core' || id === 'void') {
      const c = id === 'crystal' ? '#ff3dc8' : id === 'core' ? '#ff3d20' : '#3d7bff';
      IM(new T3.OctahedronGeometry(0.25, 0), this.S(c, 0.2, 0.1, 0.7), edge.filter(a => a[2] < 120), ([x, y, h, s]) => { const [ox, oz] = off(s, 0.62); d.position.set(x + 0.5 + ox, 0.3, y + 0.5 + oz); d.scale.set(0.6, 1.5 + (h % 3) * 0.5, 0.6); d.rotation.z = ((h % 5) - 2) * 0.2; });
    }
  },
  msModel(k) {
    const T3 = THREE, g = new T3.Group(), A = (geo, mat, x, y, z) => { const o = new T3.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    const gm = this.S('#3a3d52', 0.85, 0.3, 0.03), dk = this.S('#15151f', 0.6, 0.5, 0);
    if (k === 'gen') {
      A(new T3.CylinderGeometry(0.7, 0.8, 0.2, 8), dk, 0, 0.1, 0); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.78; A(this.RB(0.18, 1.1, 0.18), gm, Math.cos(a) * 0.5, 0.65, Math.sin(a) * 0.5); }
      g.userData.core = A(new T3.CylinderGeometry(0.25, 0.25, 0.9, 16), this.M('#ffd23d', { e: 1, dark: 0.9 }), 0, 0.7, 0);
      g.userData.rings = [0, 1, 2].map(i => { const t = A(new T3.TorusGeometry(0.38, 0.03, 8, 32), this.M('#ffd23d', { basic: 1 }), 0, 0.35 + i * 0.35, 0); t.rotation.x = Math.PI / 2; return t; });
      A(this.RB(0.9, 0.12, 0.9), gm, 0, 1.25, 0);
    } else if (k === 'bea') {
      A(new T3.CylinderGeometry(0.5, 0.6, 0.15, 12), dk, 0, 0.08, 0); A(new T3.CylinderGeometry(0.06, 0.1, 1.6, 8), gm, 0, 0.9, 0);
      g.userData.core = A(new T3.OctahedronGeometry(0.22), this.M('#ff3d55', { e: 1, dark: 0.9 }), 0, 1.85, 0);
      g.userData.rings = [A(new T3.TorusGeometry(0.35, 0.025, 8, 32), this.M('#ff3d55', { basic: 1 }), 0, 1.85, 0)];
    } else if (k === 'bot') {
      const bd = A(this.RB(0.7, 0.45, 0.55), this.S('#e8e6f4', 0.3, 0.4, 0.08), 0, 0.5, 0); A(this.RB(0.5, 0.1, 0.45), this.S('#00f0ff', 0.3, 0.3, 0.6), 0, 0.78, 0);
      for (const s of [-1, 1]) for (const f of [-1, 1]) { const w = A(new T3.CylinderGeometry(0.14, 0.14, 0.1, 16), dk, f * 0.25, 0.15, s * 0.3); w.rotation.x = Math.PI / 2; }
      A(new T3.SphereGeometry(0.15, 14, 10), this.S('#2a2a3a', 0.8, 0.2, 0), 0.3, 0.9, 0); g.userData.core = A(new T3.SphereGeometry(0.07, 10, 8), this.M('#00f0ff', { basic: 1 }), 0.42, 0.92, 0);
      A(this.RB(0.4, 0.3, 0.35), this.S('#ffb020', 0.4, 0.4, 0.2), -0.12, 0.92, 0);
    } else {
      A(new T3.CylinderGeometry(0.4, 0.5, 0.25, 8), dk, 0, 0.12, 0); g.userData.core = A(new T3.IcosahedronGeometry(0.25, 0), this.S('#ffd23d', 0.9, 0.15, 0.6), 0, 0.9, 0);
      g.userData.rings = [A(new T3.TorusGeometry(0.42, 0.02, 8, 40), this.M('#ffd23d', { basic: 1 }), 0, 0.9, 0), A(new T3.TorusGeometry(0.5, 0.015, 8, 40), this.M('#ffffff', { basic: 1 }), 0, 0.9, 0)];
    }
    this.lvG.add(g); return g;
  },
  drawMission(G, T, px, pz) {
    const M = G.ms; if (!M) { this.msG = null; return; }
    if (!this.msG || this.msG.userData.M !== M) {
      this.msG = { userData: { M } };
      if (M.gen) this.msG.o = this.msModel('gen'); if (M.bea) this.msG.o = this.msModel('bea'); if (M.bot) this.msG.o = this.msModel('bot'); if (M.art) this.msG.o = this.msModel('art');
    }
    const o = this.msG.o; if (!o) return; const u = o.userData;
    const obj = M.gen || M.bea || M.bot || M.art, x = obj.x / TS, z = obj.y / TS; o.position.set(x, 0, z);
    if (M.art) { o.visible = !M.art.got; u.core.rotation.set(T, T * 1.3, 0); u.core.position.y = 0.9 + Math.sin(T * 2) * 0.12; u.rings[0].rotation.set(T * 1.1, 0, T * 0.7); u.rings[1].rotation.set(-T * 0.8, T, 0); this.gp(x, 0.9, z, '#ffd23d', 2.4, 0.7); const ph = (T * 0.5) % 1; this.ring(x, z, 0.5 + ph * 6, '#ffd23d', 0.35 * (1 - ph), 0.04); return; }
    if (M.bot) { o.rotation.y = -(M.bot.ang || 0); this.gp(x, 0.9, z, '#00f0ff', 1, 0.6); const f = M.bot.hp / M.bot.max; this.plane(x - 0.45 * (1 - f), z - 0.75, 0.08, 0.9 * f, 0, f < 0.35 ? '#ff3d55' : '#3dffa0', 0.9, 1.3); if (M.bot.moving) this.ring(x, z, 0.6, '#00f0ff', 0.4); else this.ring(x, z, 220 / TS, '#00f0ff', 0.18 + Math.sin(T * 3) * 0.08); return; }
    const on = (M.gen && M.gen.on) || (M.bea && M.bea.on), col = M.gen ? '#ffd23d' : '#ff3d55';
    if (u.rings) u.rings.forEach((r, i) => { r.position.y = M.gen ? 0.35 + ((i * 0.35 + T * (on ? 0.8 : 0.1)) % 1.05) : 1.85; r.rotation.z = T * (i + 1); r.scale.setScalar(M.bea ? 1 + Math.sin(T * 6) * 0.2 : 1); });
    u.core.rotation.y = T * (on ? 4 : 0.5);
    this.gp(x, 1, z, col, on ? 3 : 1.5, on ? 0.7 : 0.4);
    if (!on && !M.done && !M.fail) this.ring(x, z, (M.gen ? 80 : 70) / TS, col, 0.4 + Math.sin(T * 4) * 0.2);
    if (M.gen && on) { const f = Math.max(0, M.gen.hp / M.gen.max); this.plane(x - 0.6 * (1 - f), z - 1.0, 0.1, 1.2 * f, 0, f < 0.35 ? '#ff3d55' : '#ffd23d', 0.9, 1.6); this.ring(x, z, 1.1, '#ffd23d', 0.25, 0.04, true); }
  },
  // склейка статичных деталей группы в один меш на материал (меньше вызовов отрисовки)
  merge(root, skip) {
    const T3 = THREE; root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), by = new Map(), rm = [];
    const walk = o => { for (const ch of o.children.slice()) { if (skip && skip.has(ch)) continue; if (ch.isMesh && !ch.isInstancedMesh && ch.material && !Array.isArray(ch.material)) { let L = by.get(ch.material); if (!L) by.set(ch.material, L = []); L.push(ch); rm.push(ch); } if (ch.children.length) walk(ch); } };
    walk(root);
    for (const [mat, L] of by) {
      if (L.length < 2) { rm.splice(rm.indexOf(L[0]), 1); continue; }
      let n = 0; const parts = L.map(m => { let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); const mx = inv.clone().multiply(m.matrixWorld); g.applyMatrix4(mx); if (!g.attributes.normal) g.computeVertexNormals(); n += g.attributes.position.count; return g; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
      for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const mg = new T3.BufferGeometry(); mg.setAttribute('position', new T3.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T3.BufferAttribute(nor, 3)); mg.computeBoundingSphere();
      const mm = new T3.Mesh(mg, mat); mm.userData.merged = true; root.add(mm);
    }
    for (const m of rm) if (m.parent) m.parent.remove(m);
    return root;
  },
  animHero(hg, T) {
    const u = hg.userData; if (u.float) u.piv.position.y = 0.12 + Math.sin(T * 3) * 0.06;
    if (u.spin) u.spin.forEach((o, i) => { o.rotation.y += 0.03 * (i + 1); o.rotation.z += 0.02; });
  },
  getModel(e) { let m = this.models.get(e); if (!m) { m = this.enemyModel(e); this.lvG.add(m); this.models.set(e, m); } return m; },

  /* ---------- проекция ---------- */
  proj(x, y, h = 0) { const v = new THREE.Vector3(x / TS, h, y / TS).project(this.cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, vis: v.z < 1 }; },
  pick(sx, sy) {
    const v = new THREE.Vector3(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(this.cam);
    const o = this.cam.position, dir = v.sub(o).normalize(); const t = -o.y / dir.y;
    return { x: (o.x + dir.x * t) * TS, y: (o.z + dir.z * t) * TS };
  },

  /* ---------- кадр ---------- */
  frame(G, dt, T) {
    const p = G.p, lv = G.lv, px = p.x / TS, pz = p.y / TS, cs = G.cs;
    this.pBud = this.budget(); this.pn = 0; for (const pool of [this.lasPool, this.ringPool, this.planePool, this.boxPool]) pool.u = 0;
    // камера
    const asp = innerWidth / innerHeight; this.zoomK = (this.zoomK || 1) + (((G.intro && G.boss) ? 0.55 : 1) - (this.zoomK || 1)) * Math.min(1, dt * 2); const D = Math.max(13 / asp, 10.5) * (G.lv.arena ? 1.3 : 1) * this.zoomK, el = 0.92;
    const foc = G.intro && G.boss, tx = foc ? G.boss.x / TS : px, tz = Math.min(lv.H - 6, foc ? G.boss.y / TS + 1 : pz), ck = foc ? 2.5 : 7; this.ct = this.ct || { x: px, z: pz }; this.ct.x += (tx - this.ct.x) * Math.min(1, dt * ck); this.ct.z += (tz - this.ct.z) * Math.min(1, dt * ck);
    const sh = (G.shk || 0) / TS;
    this.cam.position.set(this.ct.x + (Math.random() - 0.5) * sh, Math.sin(el) * D, this.ct.z - 1.4 + Math.cos(el) * D + (Math.random() - 0.5) * sh);
    this.cam.lookAt(this.ct.x, 0, this.ct.z - 1.4);
    this.scene.fog.near = D * 0.9; this.scene.fog.far = D * 2.2;
    const vis = (x, z, m = 3) => Math.abs(x - this.ct.x) < D * 0.75 * Math.max(1, asp) + m && Math.abs(z - this.ct.z) < D * 0.9 + m;
    // игрок
    const sk = P.cos('skin').v;
    if (!this.heroG || this.lastSkin !== sk + cs.hero.id) { if (this.heroG) this.lvG.remove(this.heroG); this.heroG = this.heroModel(cs.hero, sk); this.lvG.add(this.heroG); this.lastSkin = sk + cs.hero.id; }
    const hg = this.heroG, moving = (G.moveVec().x || G.moveVec().y);
    hg.position.set(px, moving ? Math.abs(Math.sin(T * 12)) * 0.06 : 0, pz);
    hg.userData.piv.rotation.y = -p.ang; hg.userData.base.rotation.z = T * 2; this.animHero(hg, T);
    if (sk === 'glitch') hg.userData.piv.position.x = (Math.random() < 0.08 ? (Math.random() - 0.5) * 0.12 : 0);
    hg.visible = G.state !== 'dying' && !(p.inv > 0 && p.dashT <= 0 && Math.floor(T * 20) % 2);
    this.pl.position.set(px, 3, pz + 1); this.pl.color.copy(this.C(cs.hero.col)); this.gp(px, 0.1, pz, cs.hero.col, 1.6, G.hidden ? 0.15 : 0.35);
    if (p.shield > 0) this.ring(px, pz, 0.55, '#78c8ff', 0.6, 0.05);
    // враги
    const seen = new Set();
    for (const e of G.enemies) {
      const ex = e.x / TS, ez = e.y / TS; if (!vis(ex, ez)) continue;
      const inBush = lv.bush[Math.floor(e.y / TS) * lv.W + Math.floor(e.x / TS)];
      if (inBush && Math.hypot(e.x - p.x, e.y - p.y) > 150) continue;
      const m = this.getModel(e); seen.add(e); m.visible = true;
      m.position.set(ex, e.type === 'drone' ? Math.sin(T * 3 + e.t) * 0.12 : 0, ez);
      const b = m.userData.body, pa = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.type === 'bug' || e.type === 'splitter') b.rotation.y = T * 2 + e.t; else if (e.type === 'drone') b.rotation.y = T * 3; else if (e.type === 'glitch') { b.rotation.y = T * 4; b.rotation.x = T * 3; } else b.rotation.y = -pa;
      if (m.userData.eye) { const er = m.userData.eyeR; m.userData.eye.position.x = Math.cos(pa) * er; m.userData.eye.position.z = Math.sin(pa) * er; m.userData.eye.rotation.y = -pa + Math.PI / 2; }
      if (e.elite) { this.ring(ex, ez, m.userData.r * 2.2, '#ffd23d', 0.6 + Math.sin(T * 5) * 0.25, 0.05); this.gp(ex, m.userData.r * 2.6, ez, '#ffd23d', 1.2, 0.9); for (let k = 0; k < 3; k++) { const a = T * 3 + k * 2.1; this.gp(ex + Math.cos(a) * m.userData.r * 1.8, 0.3 + k * 0.3, ez + Math.sin(a) * m.userData.r * 1.8, '#ffe27a', 0.35, 1); } }
      if (e.shd > 0) this.ring(ex, ez, m.userData.r * 1.4, '#4da6ff', 0.55, 0.4);
      if (m.userData.threat) { m.userData.threat.rotation.y = T * 1.5; m.userData.threat.children[0].material.opacity = 0.55 + Math.sin(T * 6 + e.t) * 0.3; }
      if (e.type !== 'turret' && e.type !== 'drone') { b.position.y = Math.abs(Math.sin(T * 8 + e.t * 3)) * 0.08; b.scale.y = 1 + Math.sin(T * 16 + e.t * 3) * 0.06; }
      const fl = e.flash > 0; m.scale.setScalar(fl ? 1.15 : (e.ai === 'bomb' && e.st === 1 ? 1 + Math.abs(Math.sin(T * 20)) * 0.25 : 1));
      this.gp(ex, 0.4, ez, fl ? '#ffffff' : e.fz > 0 ? '#9ff' : e.col, m.userData.r * 3, fl ? 0.8 : 0.3);
      if (e.ai === 'charge' && e.st === 1) this.plane(ex + e.cx * 1.3, ez + e.cy * 1.3, 0.5, 2.6, Math.atan2(e.cy, e.cx), '#ffffff', 0.25);
      if (e.ai === 'bomb' && e.st === 1) this.ring(ex, ez, 80 / TS, '#ff8a00', 0.5);
    }
    for (const [e, m] of this.models) { if (!seen.has(e)) { if (e.dead) { this.lvG.remove(m); this.models.delete(e); } else m.visible = false; } }
    // босс
    const B = G.boss;
    if (B) {
      if (!this.bossG || this.bossG.userData.id !== B.id) { if (this.bossG) this.lvG.remove(this.bossG); this.bossG = this.bossModel(B); this.bossG.userData.id = B.id; this.lvG.add(this.bossG); this.segG = []; }
      const bg = this.bossG, u = bg.userData, bx = B.x / TS, bz = B.y / TS; bg.visible = true; bg.position.set(bx, 0, bz);
      bg.scale.setScalar(B.flash > 0 ? 1.08 : 1);
      if (u.a) u.a.rotation.y = T * (B.st === 2 ? 14 : 1); if (u.b) u.b.rotation.z = T * 1.5; if (u.c) u.c.rotation.y = -T * 2;
      if (B.id === 'serpent') bg.rotation.y = -B.a;
      if (B.id === 'crusher') { const r = B.r / TS * 1.1; u.press.position.y = r * 2.6 - (B.squash || 0) * r * 1.2; (u.gears || []).forEach(q => q.rotation.y = T * 3); u.body.rotation.y = -Math.atan2(p.y - B.y, p.x - B.x); }
      if (B.id === 'cryo') { u.crown.rotation.y = T; bg.position.y = 0.3 + Math.sin(T * 1.5) * 0.15; for (let k = 0; k < 3; k++) this.gp(bx + (Math.random() - 0.5) * 3, Math.random() * 2, bz + (Math.random() - 0.5) * 3, '#cfefff', 0.2, 0.8); }
      if (B.id === 'hive') { bg.position.y = 0.4 + Math.sin(T * 2) * 0.2; if (B.armor < 1) this.ring(bx, bz, B.r / TS + 1.1, '#6aa8ff', 0.25, 1.2, true); }
      if (u.iris) { const pa = Math.atan2(p.y - B.y, p.x - B.x), r = B.r / TS * 1.1; u.iris.position.x = Math.cos(pa) * r * 0.65; u.iris.position.z = Math.sin(pa) * r * 0.65; u.pu.position.x = Math.cos(pa) * r * 0.95; u.pu.position.z = Math.sin(pa) * r * 0.95; u.ring.rotation.x = T; u.ring.rotation.y = T * 0.7; }
      this.gp(bx, 1, bz, B.col, 4, 0.45);
      if (B.segs.length) { while (this.segG.length < B.segs.length) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), this.M(B.col, { e: 0.4 })); this.lvG.add(s); this.segG.push(s); } B.segs.forEach((s, i) => { const o = this.segG[i], r = s.r / TS * 1.1; o.position.set(s.x / TS, r, s.y / TS); o.scale.setScalar(r); }); }
      if (B.las) for (const l of B.las) this.laser(l[0] / TS, l[1] / TS, l[2] / TS, l[3] / TS, '#ff2a5a', 0.16, 0.6);
    } else if (this.bossG) { this.bossG.visible = false; (this.segG || []).forEach(s => s.visible = false); }
    // снаряды
    let n = 0; const d = this.dummy;
    for (const b of G.pb) { if (n >= 400) break; d.position.set(b.x / TS, 0.55, b.y / TS); d.scale.setScalar(b.r / 5); d.rotation.set(0, 0, 0); d.updateMatrix(); this.iPB.setMatrixAt(n, d.matrix); this.iPB.setColorAt(n, this.C(b.col)); n++; this.gp(b.x / TS, 0.55, b.y / TS, b.col, 0.55 * b.r / 5, 0.9); this.gp((b.x - b.vx * 0.03) / TS, 0.55, (b.y - b.vy * 0.03) / TS, b.col, 0.4, 0.5); }
    this.iPB.count = n; this.iPB.instanceMatrix.needsUpdate = true; if (this.iPB.instanceColor) this.iPB.instanceColor.needsUpdate = true;
    n = 0; for (const b of G.eb) { if (n >= 600) break; d.position.set(b.x / TS, 0.55, b.y / TS); d.scale.setScalar(1); d.updateMatrix(); this.iEB.setMatrixAt(n++, d.matrix); this.gp(b.x / TS, 0.55, b.y / TS, '#ff2850', 0.75, 0.9); }
    this.iEB.count = n; this.iEB.instanceMatrix.needsUpdate = true;
    // подбираемое
    let nc = 0, nn = 0, nh = 0;
    for (const k of G.pick) {
      const x = k.x / TS, z = k.y / TS; if (!vis(x, z, 1)) continue;
      if (k.k === 'core' && nc < 60) { d.position.set(x, 0.6 + Math.sin(T * 3 + k.t) * 0.12, z); d.rotation.set(0, T * 1.5, 0); d.scale.setScalar(1); d.updateMatrix(); this.iCore.setMatrixAt(nc++, d.matrix); this.gp(x, 0.6, z, '#00f0ff', 1.3, 0.8); this.ring(x, z, 0.3, '#00f0ff', 0.4); }
      else if (k.k === 'coin' && nn < 400) { d.position.set(x, 0.22 + Math.sin(T * 4 + k.x) * 0.04, z); d.rotation.set(Math.PI / 2, 0, T * 3 + k.x); d.scale.setScalar(0.8 + Math.min(3, k.v) * 0.15); d.updateMatrix(); this.iCoin.setMatrixAt(nn++, d.matrix); this.gp(x, 0.22, z, '#ffb020', 0.35, 0.4); }
      else if (k.k === 'heal' && nh < 60) { d.position.set(x, 0.5 + Math.sin(T * 3 + k.t) * 0.08, z); d.rotation.set(0, T, 0); d.scale.setScalar(1); d.updateMatrix(); this.iHeal.setMatrixAt(nh, d.matrix); this.iHeal2.setMatrixAt(nh++, d.matrix); this.gp(x, 0.5, z, '#3dffa0', 1, 0.5); }
    }
    for (const [m, c] of [[this.iCore, nc], [this.iCoin, nn], [this.iHeal, nh], [this.iHeal2, nh]]) { m.count = c; m.instanceMatrix.needsUpdate = true; }
    if (!this.relPool) { this.relPool = []; this.relGeo = new THREE.OctahedronGeometry(0.22, 0); this.powGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 6); }
    this.relPool.u = 0;
    for (const k of G.pick) {
      if (k.k !== 'relic' && k.k !== 'pow') continue; const x = k.x / TS, z = k.y / TS; if (!vis(x, z, 1)) continue;
      const col = Relic.pcol(k), y = 0.75 + Math.sin(T * 2.5 + x) * 0.12;
      const m = this.use(this.relPool, () => new THREE.Mesh(this.relGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.6 })));
      m.geometry = k.k === 'relic' ? this.relGeo : this.powGeo; m.material.color.copy(this.C(col)); m.material.emissive.copy(this.C(col)); m.position.set(x, y, z); m.rotation.set(k.k === 'pow' ? 0.4 : 0, T * 2, k.k === 'pow' ? 0.3 : 0); m.scale.setScalar(k.k === 'relic' ? 1.1 : 1);
      this.gp(x, y, z, col, k.k === 'relic' ? 2 : 1.2, 0.7); this.ring(x, z, 0.45, col, 0.5 + Math.sin(T * 4) * 0.2);
      if (k.k === 'relic') { this.box(x, 1.6, z, 0.12, 3.2, 0.12, col, 0.25); for (let i = 0; i < 2; i++) { const ph = (T * 0.8 + i / 2) % 1; this.gp(x + Math.cos(T * 3 + i * 3) * 0.3, 0.1 + ph * 2.2, z + Math.sin(T * 3 + i * 3) * 0.3, col, 0.2, 1 - ph); } }
    }
    for (let i = this.relPool.u; i < this.relPool.length; i++) this.relPool[i].visible = false;
    if (G.dronePos) { const dp = G.dronePos, x = dp.x / TS, z = dp.y / TS, y = 1.3 + Math.sin(T * 5) * 0.08;
      if (!this.drG) { const g = new THREE.Group(), b = new THREE.Mesh(this.RB(0.3, 0.12, 0.3), this.S('#e8e6f4', 0.5, 0.3, 0.1)); g.add(b); for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 16), this.M('#00f0ff', { basic: 1 })); r.rotation.x = Math.PI / 2; r.position.set(s[0] * 0.2, 0.04, s[1] * 0.2); g.add(r); } const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.M('#00f0ff', { basic: 1 })); eye.position.set(0.16, -0.02, 0); g.add(eye); this.scene.add(g); this.drG = g; }
      this.drG.visible = true; this.drG.position.set(x, y, z); this.drG.rotation.y = -p.ang; this.gp(x, y - 0.1, z, '#00f0ff', 0.6, 0.6); }
    else if (this.drG) this.drG.visible = false;
    if (G.pows && G.pows.zap > 0) for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; this.gp(px + Math.cos(a) * 0.5, 0.3 + Math.random() * 0.8, pz + Math.sin(a) * 0.5, '#9ff', 0.25, 1); }
    if (G.pows && G.pows.inv > 0) this.ring(px, pz, 0.7, '#ffffff', 0.5 + Math.sin(T * 10) * 0.3, 0.5);
    if (G.pows && G.pows.gold > 0) this.gp(px, 1.8, pz, '#ffd23d', 0.8, 0.7);
    // лазеры
    for (const L of lv.lasers) {
      if (L.k === 'rot') { if (!vis(L.x / TS, L.y / TS, 6)) continue; for (let i = 0; i < L.arms * 2; i++) { const a = L.a + i * Math.PI / L.arms; this.laser(L.x / TS, L.y / TS, (L.x + Math.cos(a) * L.len) / TS, (L.y + Math.sin(a) * L.len) / TS, '#ff2a5a'); } this.box(L.x / TS, 0.3, L.y / TS, 0.35, 0.6, 0.35, '#ff3d55', 0.8); }
      else if (L.k === 'slide' && L.cur) { const c = L.cur; if (vis((c[0] + c[2]) / 2 / TS, (c[1] + c[3]) / 2 / TS, 8)) this.laser(c[0] / TS, c[1] / TS, c[2] / TS, c[3] / TS, '#ff2a5a'); }
      else if (L.k === 'pulse' && (L.on || L.warn)) { const s = L.hz ? [L.a1, L.p, L.a2, L.p] : [L.p, L.a1, L.p, L.a2]; if (!vis((s[0] + s[2]) / 2 / TS, (s[1] + s[3]) / 2 / TS, 8)) continue; if (L.on) this.laser(s[0] / TS, s[1] / TS, s[2] / TS, s[3] / TS, '#ff2a5a'); else this.plane((s[0] + s[2]) / 2 / TS, (s[1] + s[3]) / 2 / TS, 0.08, Math.hypot(s[2] - s[0], s[3] - s[1]) / TS, Math.atan2(s[3] - s[1], s[2] - s[0]), '#ff3d55', 0.5); }
    }
    // зоны
    for (const Z of lv.zones) { const x = Z.x / TS, z = Z.y / TS; if (!vis(x, z)) continue; const ph = (Z.t % Z.per) / Z.per, r = Z.r / TS; this.ring(x, z, r, '#ff2850', 0.8); this.ring(x, z, r, '#ff2850', Z.on ? 0.35 : 0.06 + ph * 0.12, 0.02, true); if (!Z.on) this.ring(x, z, r * Math.min(1, ph / 0.6), '#ff5a80', 0.5); else for (let i = 0; i < 4; i++) this.gp(x + (Math.random() - 0.5) * r, 0.2 + Math.random() * 0.6, z + (Math.random() - 0.5) * r, '#ff2850', 0.5, 0.7); }
    // телеграфы
    for (const t of G.tele) { const f = t.t / t.dur; if (t.k === 'line') { const L = Math.hypot(t.x2 - t.x1, t.y2 - t.y1) / TS; this.plane((t.x1 + t.x2) / 2 / TS, (t.y1 + t.y2) / 2 / TS, t.w / TS * (t.dmg ? 0.3 + f * 0.7 : 1), L, Math.atan2(t.y2 - t.y1, t.x2 - t.x1), t.col, 0.15 + f * 0.35); } else { this.ring(t.x / TS, t.y / TS, t.r / TS, t.col, 0.8); this.ring(t.x / TS, t.y / TS, t.r / TS * f, t.col, 0.2 + f * 0.3, 0.025, true); } }
    // барьеры
    for (const q of lv.rooms) if (q.active) for (const [x, y] of q.doors) this.box(x + 0.5, 0.6, y + 0.5, 1, 1.2, 1, '#ff2a50', 0.35 + Math.sin(T * 10 + x) * 0.1);
    // сундуки
    for (const ch of G.chests) { const x = ch.x / TS, z = ch.y / TS; if (!vis(x, z)) continue; const s = ch.big ? 0.42 : 0.32; this.box(x, s * 0.5, z, s * 1.6, s, s * 1.1, ch.open ? '#443300' : '#ffb020', ch.open ? 0.3 : 0.55); this.box(x, s * 1.05 + (ch.open ? 0.15 : 0), z, s * 1.7, s * 0.25, s * 1.2, '#ffe070', ch.open ? 0.2 : 0.75); if (!ch.open) this.gp(x, 0.4, z, '#ffd700', 1.6, 0.4 + Math.sin(T * 3 + x) * 0.15); }
    // портал
    const pg = this.portalG; if (B) pg.visible = false; else { pg.visible = true; const on = G.portalOpen; pg.position.set(lv.portal.x / TS, 0, lv.portal.y / TS); pg.children.forEach((c, i) => { if (i < 3) { c.material.color.copy(this.C(on ? ['#3dffa0', '#00f0ff', '#7b3dff'][i] : '#2a2a48')); c.rotation.x = T * (i + 1) * (on ? 1.2 : 0.2); c.rotation.y = T * (i % 2 ? -1 : 1) * (on ? 1 : 0.2); } }); pg.userData.disc.visible = on; pg.userData.disc.rotation.y = T; if (on) { this.gp(pg.position.x, 0.7, pg.position.z, '#3dffa0', 3, 0.5); for (let i = 0; i < 3; i++) { const a = T * 2 + i * 2.1, rr = ((T + i / 3) % 1); this.gp(pg.position.x + Math.cos(a) * (1 - rr), 0.1 + rr * 1.6, pg.position.z + Math.sin(a) * (1 - rr), '#bfffe0', 0.25, 1 - rr); } } }
    // ускорители, телепорты, разломы, торговец
    for (const pd of lv.pads) this.gp(pd.x / TS, 0.1, pd.y / TS, '#00f0ff', 1, 0.3 + Math.sin(T * 6) * 0.15);
    for (const tp of lv.tps) for (const q of [tp.a, tp.b]) { this.gp(q.x / TS, 0.3, q.y / TS, '#b44dff', 1.4, 0.5); this.gp(q.x / TS, 0.3 + ((T * 1.5) % 1) * 1.2, q.y / TS, '#d58cff', 0.3, 1 - (T * 1.5) % 1); }
    for (const rf of G.rifts) { this.ring(rf.x / TS, rf.y / TS, 0.6, '#b44dff', 0.7, 0.05); this.gp(rf.x / TS, 0.5, rf.y / TS, '#b44dff', 2.2, 0.5); }
    if (G.merchant) { const m = G.merchant; this.box(m.x / TS, 0.7 + Math.sin(T * 3) * 0.1, m.y / TS, 0.35, 0.35, 0.35, '#ffb020', m.used ? 0.2 : 0.9); this.gp(m.x / TS, 0.7, m.y / TS, '#ffb020', 2, m.used ? 0.1 : 0.5); }
    // объекты миссии
    this.drawMission(G, T, px, pz); DynEv.r3(G, this, T);
    if (G.dyn && G.dyn.id === 'blackout') { this.scene.fog.near = 3; this.scene.fog.far = 9; }
    // механики биома
    for (const f of lv.feats || []) {
      if (f.k === 'belt') { const cx = (f.x + f.w / 2) / TS, cz = (f.y + f.h / 2) / TS; if (!vis(cx, cz, 8)) continue; const hz = f.dx !== 0, L = (hz ? f.w : f.h) / TS, Wd = (hz ? f.h : f.w) / TS, dir = f.dx || f.dy, sp = (G.beltMul || 1);
        this.plane(cx, cz, Wd * 0.95, L, hz ? 0 : Math.PI / 2, '#ff9a1a', 0.12, 0.02);
        const n = Math.floor(L / 0.8); for (let i = 0; i < n; i++) { const o = ((i * 0.8 + T * 1.6 * sp * dir) % L + L) % L - L / 2, x = hz ? cx + o : cx, z = hz ? cz : cz + o; this.plane(x, z, Wd * 0.7, 0.12, hz ? 0 : Math.PI / 2, '#ffb84a', 0.55, 0.03); }
        for (const s of [-0.5, 0.5]) this.plane(hz ? cx : cx + s * Wd, hz ? cz + s * Wd : cz, 0.06, L, hz ? 0 : Math.PI / 2, '#ff9a1a', 0.8, 0.035); }
      else if (f.k === 'steam') { const x = f.x / TS, z = f.y / TS; if (!vis(x, z)) continue; const r = f.r / TS; this.ring(x, z, r, f.on ? '#ffffff' : f.warn ? '#ffd23d' : '#666677', f.on ? 0.8 : 0.5); this.box(x, 0.06, z, 0.5, 0.12, 0.5, '#555566', 0.8); if (f.warn) this.ring(x, z, r, '#ffd23d', 0.25, 0.02, true); if (f.on) for (let k = 0; k < 6; k++) this.gp(x + (Math.random() - 0.5) * r, Math.random() * 2.4, z + (Math.random() - 0.5) * r, '#e8eef8', 0.7 + Math.random() * 0.6, 0.55); else if (Math.random() < 0.3) this.gp(x, 0.2 + Math.random() * 0.5, z, '#99a', 0.3, 0.4); }
      else if (f.k === 'acid') { const x = f.x / TS, z = f.y / TS; if (!vis(x, z)) continue; const r = f.r / TS; this.ring(x, z, r, '#7dff3d', 0.45, 0.02, true); this.ring(x, z, r, '#b8ff5a', 0.8, 0.025); if (Math.random() < 0.6) this.gp(x + (Math.random() - 0.5) * r * 1.4, 0.05 + Math.random() * 0.25, z + (Math.random() - 0.5) * r * 1.4, '#a8ff4a', 0.25, 0.9); }
      else if (f.k === 'ice') { const cx = (f.x + f.w / 2) / TS, cz = (f.y + f.h / 2) / TS; if (!vis(cx, cz, 10)) continue; this.plane(cx, cz, f.h / TS, f.w / TS, 0, '#bfe8ff', 0.22, 0.015); if (Math.random() < 0.3) this.gp(f.x / TS + Math.random() * f.w / TS, 0.05, f.y / TS + Math.random() * f.h / TS, '#ffffff', 0.15, 1); }
      else if (f.k === 'car') { const x = (f.cx || 0) / TS, z = f.y / TS; this.plane((f.x1 + f.x2) / 2 / TS, z, 0.9, (f.x2 - f.x1) / TS, 0, '#ff3d55', 0.07, 0.02); if (!vis(x, z, 4)) continue; const d = Math.sign(f.sp);
        this.box(x, 0.3, z, 1.5, 0.4, 0.8, '#1a1a2a', 0.95); this.box(x - d * 0.1, 0.62, z, 0.8, 0.28, 0.7, f.col, 0.55); this.box(x, 0.12, z, 1.6, 0.06, 0.86, f.col, 0.9);
        this.gp(x + d * 0.78, 0.32, z - 0.25, '#ffffff', 0.5, 1); this.gp(x + d * 0.78, 0.32, z + 0.25, '#ffffff', 0.5, 1); this.gp(x - d * 0.78, 0.32, z, '#ff2040', 0.4, 0.9); this.plane(x + d * 1.8, z, 0.7, 2, 0, '#ffffcc', 0.12, 0.03); }
      else if (f.k === 'vac') { const x = f.x / TS, z = f.y / TS; if (!vis(x, z, 6)) continue; this.box(x, 0.04, z, 0.9, 0.08, 0.9, '#2a3048', 0.9); this.ring(x, z, 0.5, f.on ? '#6aa8ff' : f.warn ? '#ff3d55' : '#3a4060', 0.9, 0.09);
        if (f.warn) this.ring(x, z, 320 / TS, '#ff3d55', 0.15 + Math.sin(T * 14) * 0.1); if (f.on) for (let k = 0; k < 5; k++) { const a = Math.random() * 6.28, rr = Math.random() * 6; this.gp(x + Math.cos(a) * rr, 0.3, z + Math.sin(a) * rr, '#9cc4ff', 0.25, 0.8); } }
    }
    if (G.onIce) this.ring(px, pz, 0.5, '#cfefff', 0.3, 0.03);
    if (G.p.chill > 0) this.ring(px, pz, 0.62, '#9fe8ff', 0.6, 0.6);
    if (this.lvl < 2) for (const b of this.bfx || []) {
      if (b[0] === 'snow') { for (let k = 0; k < 40; k++) { const sx = this.ct.x + ((k * 7.3) % 20) - 10, sy = ((k * 3.1 - T * (0.6 + (k % 3) * 0.2)) % 4 + 4) % 4, sz = this.ct.z + ((k * 11.7) % 14) - 7 + Math.sin(T + k) * 0.3; this.gp(sx, sy, sz, '#ffffff', 0.12, 0.8); } continue; }
      if (!vis(b[1], b[3], 1)) continue;
      if (b[0] === 'smoke') for (let k = 0; k < 3; k++) { const ph = (T * 0.4 + k / 3 + b[1]) % 1; this.gp(b[1] + Math.sin(ph * 5 + b[3]) * 0.3, b[2] + ph * 2.2, b[3], '#8a8070', 0.6 + ph * 1.2, 0.35 * (1 - ph)); }
      else if (b[0] === 'bub') { const ph = (T * 0.7 + b[1] * 3) % 1; this.gp(b[1] + Math.sin(T * 3 + b[3]) * 0.1, b[2] + ph * 1.0, b[3], '#b0ffe0', 0.12, 1 - ph); this.gp(b[1], 0.7, b[3], '#3dffb0', 0.9, 0.35); }
      else if (b[0] === 'star') this.gp(b[1], b[2], b[3], '#ffffff', 0.06, 0.6 + Math.sin(T * 4 + b[1] * 9) * 0.4);
      else if (b[0] === 'con') this.gp(b[1], b[2], b[3], Math.floor(T * 3 + b[1]) % 2 ? '#3dffa0' : '#6aa8ff', 0.25, 1);
    }
    // фонари, терминалы, алтари
    for (const [x, z] of this.lamps || []) if (vis(x, z, 1)) { this.gp(x, this.WH + 0.95, z, G.pal.edge, 0.9, 0.7 + Math.sin(T * 3 + x) * 0.2); this.gp(x, this.WH + 0.95, z, '#ffffff', 0.25, 0.9); }
    (lv.terms || []).forEach((tm, i) => {
      const o = this.termG[i]; if (!o) return; const x = tm.x / TS, z = tm.y / TS; o.visible = vis(x, z); if (!o.visible) return;
      o.userData.scr.material.color.copy(this.C(tm.done ? '#334' : Math.floor(T * 4) % 2 ? '#3dffa0' : '#1d9f60'));
      if (tm.done) return;
      this.ring(x, z, 58 / TS, '#3dffa0', tm.near ? 0.9 : 0.35 + Math.sin(T * 3) * 0.15);
      if (tm.prog > 0) { this.ring(x, z, 58 / TS * tm.prog, '#3dffa0', 0.35, 0.025, true); for (let k = 0; k < 2; k++) this.gp(x + (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 1.5, z + (Math.random() - 0.5) * 0.6, '#3dffa0', 0.25, 1); }
      this.gp(x + 0.12, 1.47, z, '#3dffa0', 0.5, 0.5 + Math.sin(T * 8) * 0.4);
    });
    (lv.shrines || []).forEach((s, i) => {
      const o = this.shrG[i]; if (!o) return; const x = s.x / TS, z = s.y / TS; o.visible = vis(x, z); if (!o.visible) return;
      const ready = s.cd <= 0, gm = o.userData.gem; gm.visible = ready; gm.rotation.y = T * 2; gm.position.y = 0.8 + Math.sin(T * 2.5) * 0.1;
      if (ready) { this.gp(x, 0.8, z, o.userData.c, 2.2, 0.6); this.ring(x, z, 0.55, o.userData.c, 0.5 + Math.sin(T * 4) * 0.2); for (let k = 0; k < 2; k++) { const ph = (T * 0.6 + k / 2 + i * 0.3) % 1; this.gp(x + Math.cos(T + k * 3) * 0.3, 0.2 + ph * 1.6, z + Math.sin(T + k * 3) * 0.3, o.userData.c, 0.25, 1 - ph); } }
    });
    if (G.buff && G.buff.rage > 0) this.ring(px, pz, 0.6, '#ff3d55', 0.5 + Math.sin(T * 12) * 0.3, 0.06);
    if (G.buff && G.buff.magnet > 0) this.ring(px, pz, 0.9 + (T % 0.6), '#ffd23d', 0.4, 0.05);
    // чёрные дыры
    for (const h of G.holes) { const x = h.x / TS, z = h.y / TS; this.ring(x, z, 2.2, '#ff3d7f', 0.25, 0.03, true); for (let i = 0; i < 3; i++) this.ring(x, z, 0.5 + i * 0.35 + Math.sin(T * 6 + i) * 0.05, '#ff3d7f', 0.6, 0.05 + i * 0.02); this.gp(x, 0.6, z, '#ff3d7f', 3, 0.6); for (let i = 0; i < 6; i++) { const a = T * 4 + i, rr = 2 - ((T * 2 + i / 6) % 1) * 2; this.gp(x + Math.cos(a) * rr, 0.4, z + Math.sin(a) * rr, '#ff7aa8', 0.3, 0.8); } }
    // кусты
    const bd = this.dummy; let bi = 0;
    for (const [x, z, h, ti] of this.bushInfo) { const near = Math.hypot(x - px, z - pz) < 1.3; bd.position.set(x, h * 0.42 * (near ? 0.35 : 1), z); bd.rotation.set(Math.sin(T * 2 + x * 3) * 0.12, 0, Math.cos(T * 1.7 + z * 3) * 0.12); bd.scale.set(1, h * (near ? 0.35 : 1), 1); bd.updateMatrix(); this.iBush.setMatrixAt(bi++, bd.matrix); }
    this.iBush.count = bi; this.iBush.instanceMatrix.needsUpdate = true;
    // эффекты
    for (const v of G.vfx) {
      const f = v.t / v.d;
      if (v.k === 'beam') this.laser(v.x1 / TS, v.y1 / TS, v.x2 / TS, v.y2 / TS, v.col, 0.5 * (1 - f) + 0.08, 0.6);
      if (v.k === 'ring') this.ring(v.x / TS, v.y / TS, v.r / TS * (0.3 + f * 0.7), v.col, 0.8 * (1 - f), 0.06);
      if (v.k === 'arc') for (let i = 0; i <= 10; i++) { const a = v.a - v.arc / 2 + v.arc * i / 10, r = v.r / TS * (0.6 + f * 0.4); this.gp(v.x / TS + Math.cos(a) * r, 0.5, v.y / TS + Math.sin(a) * r, v.col, 0.6, 1 - f); }
      if (v.k === 'bolt') { for (let i = 0; i <= 6; i++) this.gp((v.x1 + (v.x2 - v.x1) * i / 6) / TS + (Math.random() - 0.5) * 0.2, 0.5, (v.y1 + (v.y2 - v.y1) * i / 6) / TS + (Math.random() - 0.5) * 0.2, v.col, 0.4, 1); }
      if (v.k === 'dome') { this.ring(px, pz, 0.8, v.col, 0.7, 0.05); for (let i = 0; i < 8; i++) { const a = T * 2 + i * 0.78; this.gp(px + Math.cos(a) * 0.8, 0.3 + (i % 3) * 0.3, pz + Math.sin(a) * 0.8, v.col, 0.4, 0.8); } }
    }
    if (G.orb) this.gp(G.orb.x / TS, 0.5, G.orb.y / TS, cs.hero.col, 0.8, 1);
    // частицы
    for (const q of G.parts) this.gp(q.x / TS, 0.3 + q.t * 0.8, q.y / TS, q.col, q.s * 0.06, 1 - q.t / q.d);
    // атмосфера
    for (const a of G.amb || []) { const x = this.ct.x + (a.x - 0.5) * D * 1.6, z = this.ct.z + (a.y - 0.5) * D * 1.4, y = ((a.ph + T * a.v * 0.05) % 3); this.gp(x, y, z, G.pal.edge, 0.12 * a.s, 0.5); }
    // прицел
    let aimOn = false;
    for (const id in G.touches) { const o = G.touches[id]; if ((o.role === 'atk' || o.role === 'atk2' || o.role === 'sup') && Math.hypot(o.x - o.ox, o.y - o.oy) > 18) { aimOn = true; const a = Math.atan2(o.y - o.oy, o.x - o.ox), L = (o.role === 'sup' ? 260 : cs.range) / TS; this.aim.material.color.copy(this.C(o.role === 'sup' ? '#ffd23d' : '#ffffff')); if (cs.hero.atk.t === 'wave' && o.role !== 'sup') { this.aimArc.visible = true; this.aimArc.position.set(px, 0.05, pz); this.aimArc.scale.set(L, L, 1); this.aimArc.rotation.set(-Math.PI / 2, 0, -a); this.aim.visible = false; } else { this.aim.visible = true; this.aimArc.visible = false; this.aim.position.set(px + Math.cos(a) * L / 2, 0.05, pz + Math.sin(a) * L / 2); this.aim.scale.set(L, 0.38, 1); this.aim.rotation.set(-Math.PI / 2, 0, -a); } } }
    if (!aimOn) { this.aim.visible = false; this.aimArc.visible = false; }
    // финал
    this.endPools();
    const g = this.pts.geometry; g.setDrawRange(0, this.pn);
    for (const k of ['position', 'color', 'size', 'alpha']) g.attributes[k].needsUpdate = true;
    this.r.render(this.scene, this.cam);
  },

  /* ---------- лобби: 3D-боец на постаменте ---------- */
  lobby(cv, H, skin, lock, T) {
    if (!this.ok) return false;
    const T3 = THREE;
    if (!this.lr) {
      this.lcv = document.createElement('canvas');
      this.lr = new T3.WebGLRenderer({ canvas: this.lcv, antialias: true, alpha: true, preserveDrawingBuffer: true }); this.lr.setClearColor(0, 0);
      this.ls = new T3.Scene(); this.lc = new T3.PerspectiveCamera(32, 1, 0.1, 50); this.lc.position.set(0, 2.1, 4.6); this.lc.lookAt(0, 0.95, 0);
      this.ls.add(new T3.HemisphereLight(0x9a8cff, 0x100828, 0.9)); const dl = new T3.DirectionalLight(0xffffff, 0.7); dl.position.set(2, 4, 3); this.ls.add(dl);
      this.lpl = new T3.PointLight(0xffffff, 1.5, 6, 2); this.lpl.position.set(0, 1.5, 1.2); this.ls.add(this.lpl);
      const ped = this.lped = new T3.Group(); this.ls.add(ped);
      const p1 = new T3.Mesh(new T3.CylinderGeometry(1.15, 1.3, 0.28, 48), new T3.MeshLambertMaterial({ color: 0x120c2a, emissive: 0x1a1040, emissiveIntensity: 0.6 })); p1.position.y = -0.14; ped.add(p1);
      const p2 = new T3.Mesh(new T3.CylinderGeometry(0.9, 1.0, 0.12, 48), new T3.MeshLambertMaterial({ color: 0x1c1440, emissive: 0x2a1860, emissiveIntensity: 0.5 })); p2.position.y = 0.05; ped.add(p2);
      this.lring = new T3.Mesh(new T3.TorusGeometry(1.0, 0.03, 8, 64), new T3.MeshBasicMaterial({ color: 0xffffff })); this.lring.rotation.x = Math.PI / 2; this.lring.position.y = 0.12; ped.add(this.lring);
      this.lring2 = new T3.Mesh(new T3.TorusGeometry(1.28, 0.02, 8, 64), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); this.lring2.rotation.x = Math.PI / 2; this.lring2.position.y = -0.02; ped.add(this.lring2);
      this.lbeam = new T3.Mesh(new T3.CylinderGeometry(0.75, 1.0, 3.2, 32, 1, true), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide })); this.lbeam.position.y = 1.6; ped.add(this.lbeam);
      this.lparts = []; for (let i = 0; i < 18; i++) { const m = new T3.Mesh(new T3.SphereGeometry(0.025, 6, 4), new T3.MeshBasicMaterial({ color: 0xffffff })); ped.add(m); this.lparts.push(m); }
      this.lhero = {};
    }
    const key = H.id + skin; if (!this.lhero[key]) { this.lhero[key] = this.heroModel(H, skin); this.lhero[key].userData.base.visible = false; }
    for (const k in this.lhero) { if (this.lhero[k].parent) this.ls.remove(this.lhero[k]); }
    const hm = this.lhero[key]; this.ls.add(hm); hm.scale.setScalar(1.75); hm.position.y = 0.11 + Math.sin(T * 2) * 0.05; hm.userData.piv.rotation.y = -Math.PI / 2 + Math.sin(T * 0.7) * 0.9; this.animHero(hm, T);
    const col = this.C(lock ? '#555566' : H.col);
    this.lring.material.color.copy(col); this.lring2.material.color.copy(col); this.lbeam.material.color.copy(col); this.lpl.color.copy(col); this.lring.rotation.z = T;
    this.lparts.forEach((m, i) => { const ph = (T * 0.35 + i / 18) % 1, a = i * 2.4 + T * 0.3; m.position.set(Math.cos(a) * 0.85 * (1 - ph * 0.3), ph * 2.6, Math.sin(a) * 0.85 * (1 - ph * 0.3)); m.material.color.copy(col); m.scale.setScalar(1 - ph); });
    const w = cv.width, h = cv.height; if (this.lcv.width !== w || this.lcv.height !== h) { this.lr.setPixelRatio(1); this.lr.setSize(w, h, false); this.lc.aspect = w / h; this.lc.updateProjectionMatrix(); }
    this.lr.render(this.ls, this.lc);
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    if (lock) c.filter = 'saturate(0.3) brightness(0.6)';
    c.drawImage(this.lcv, 0, 0); c.filter = 'none';
    return true;
  }
};
