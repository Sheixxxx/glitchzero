'use strict';
/* ===== Ассеты: CC0-модели (Quaternius, Poly Haven), PBR-текстуры, HDRI ===== */
const AS = {
  ready: false, prog: 0, gltf: {}, props: {}, tex: {}, mats: {}, env: null,
  CHAR: ['astronaut', 'mech1', 'mech2', 'mech3', 'mech4', 'anim_robot', 'enemy_small', 'enemy_flying', 'enemy_large', 'robot_enemy', 'robot_flying', 'robot_legs_gun', 'robot_flying_gun', 'gun_smg'],
  PROPS: ['Barrel_01', 'old_military_crate', 'portable_generator', 'utility_box_01', 'modular_industrial_pipes_01', 'hanging_industrial_lamp', 'worn_metal_rack', 'metal_trash_can', 'propane_tank', 'power_box_01', 'street_lamp_01', 'industrial_pastic_container'],
  // герои → модель
  HERO: { spark: 'astronaut', vector: 'mech1', quartz: 'mech2', nova: 'mech3', phantom: 'mech4', singular: 'anim_robot' },
  // враги → [модель, высота, оттенок]
  ENEMY: { bug: ['enemy_small', 1.0], worm: ['enemy_flying', 0.9], turret: ['robot_legs_gun', 1.5], drone: ['robot_flying', 1.3], guard: ['enemy_large', 2.2], bomber: ['enemy_small', 1.0, '#ff8a00'], splitter: ['robot_enemy', 1.5], glitch: ['enemy_flying', 1.0, '#ffd700'],
    hunter: ['robot_enemy', 1.6, '#ff2a6a'], sniper: ['robot_legs_gun', 1.7, '#ff4040'], tank: ['enemy_large', 2.8, '#c86bff'], healer: ['robot_flying_gun', 1.4, '#3dffb0'], shielder: ['enemy_large', 2.2, '#4da6ff'], miner: ['robot_enemy', 1.4, '#ffcc33'] },
  // биом → [пол, стены, оттенок стен]
  BIO: { grid: ['metal_plate_02', 'concrete_wall_008'], circuit: ['metal_plate', 'blue_metal_plate'], crystal: ['concrete_floor_worn_001', 'precast_concrete_wall'], void: ['metal_plate_02', 'concrete_panels'], core: ['concrete_floor_worn_001', 'rusty_metal_02'],
    factory: ['garage_floor', 'rusty_corrugated_iron'], lab: ['floor_tiles_06', 'concrete_panels'], city: ['asphalt_02', 'concrete_tile_facade'], frost: ['concrete_floor_02', 'precast_concrete_wall'], station: ['metal_plate', 'blue_metal_plate'] },
  load() {
    if (this.loading || !window.THREE || !THREE.GLTFLoader) return; this.loading = true;
    const gl = new THREE.GLTFLoader(), jobs = [];
    const tick = () => { this.done = (this.done || 0) + 1; this.prog = this.done / this.total; };
    for (const n of this.CHAR) jobs.push(new Promise(res => gl.load('assets/models/' + n + '.glb', g => { this.gltf[n] = g; tick(); res(); }, undefined, e => { console.warn('model', n, e); tick(); res(); })));
    for (const n of this.PROPS) jobs.push(new Promise(res => gl.load('assets/p/' + n + '.gltf', g => { this.props[n] = this.prepProp(g.scene); tick(); res(); }, undefined, e => { console.warn('prop', n, e); tick(); res(); })));
    if (THREE.RGBELoader) jobs.push(new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/env.hdr', t => { this.hdr = t; tick(); res(); }, undefined, () => { tick(); res(); })));
    this.total = jobs.length;
    return Promise.all(jobs).then(() => { this.ready = true; if (typeof R3 !== 'undefined' && R3.ok) R3.onAssets(); });
  },
  prepProp(sc) {
    const meshes = []; sc.updateMatrixWorld(true);
    sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; meshes.push(o); } });
    const box = new THREE.Box3().setFromObject(sc), size = box.getSize(new THREE.Vector3());
    return { scene: sc, meshes, box, size };
  },
  // PBR-материал по id текстуры
  T(id, k, rx = 1, ry = rx) {
    const key = id + k + rx + 'x' + ry; if (this.tex[key]) return this.tex[key];
    const t = new THREE.TextureLoader().load('assets/tex/' + id + '_' + k + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.repeat.set(rx, ry); if (k === 'diff') t.encoding = THREE.sRGBEncoding;
    return this.tex[key] = t;
  },
  mat(id, rep, tint, em, ry) {
    const key = id + rep + (ry || '') + (tint || '') + (em || ''); if (this.mats[key]) return this.mats[key];
    const mk = k => this.T(id, k, rep, ry || rep);
    const m = new THREE.MeshStandardMaterial({ map: mk('diff'), normalMap: mk('nor'), metalness: /metal|iron|plate/.test(id) ? 0.3 : 0.0, roughness: /metal|iron|plate/.test(id) ? 0.55 : 0.85, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.35 });
    if (tint) m.color = new THREE.Color(tint);
    if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = 0.06; }
    return this.mats[key] = m;
  },
  // клон анимированной модели, нормализованный по высоте
  char(name, h, tint) {
    const g = this.gltf[name]; if (!g) return null;
    const sc = THREE.SkeletonUtils.clone(g.scene);
    const wrap = new THREE.Group(); wrap.add(sc);
    sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (tint) { o.material = Array.isArray(o.material) ? o.material.map(m => this.tint(m, tint)) : this.tint(o.material, tint); } } });
    const box = new THREE.Box3().setFromObject(sc), sz = box.getSize(new THREE.Vector3()), k = h / Math.max(0.01, sz.y);
    sc.scale.setScalar(k); sc.position.y = -box.min.y * k;
    const mixer = new THREE.AnimationMixer(sc), acts = {};
    for (const c of g.animations) { const n = c.name.split('|').pop(); acts[n] = mixer.clipAction(c); }
    wrap.userData.mixer = mixer; wrap.userData.acts = acts; wrap.userData.cur = null;
    return wrap;
  },
  tintCache: {},
  tint(m, col) { const k = m.uuid + col; if (this.tintCache[k]) return this.tintCache[k]; const c = m.clone(); c.color = c.color.clone().lerp(new THREE.Color(col), 0.55); c.emissive = new THREE.Color(col); c.emissiveIntensity = 0.12; return this.tintCache[k] = c; },
  play(wrap, names, fade = 0.18, once) {
    const u = wrap.userData, A = u.acts; let n = null; for (const x of names) if (A[x]) { n = x; break; } if (!n || u.cur === n) return;
    const a = A[n]; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!once; a.play();
    if (u.cur && A[u.cur]) A[u.cur].crossFadeTo(a, fade, false); u.cur = n;
  },
  // много копий пропа одним InstancedMesh на каждую часть
  inst(id, list, h, fn, fit) {
    const P = this.props[id]; if (!P || !list.length) return null; const k = Math.min(h / Math.max(0.01, P.size.y), fit ? fit / Math.max(0.01, P.size.x, P.size.z) : 1e9), grp = new THREE.Group(), ims = [];
    const base = new THREE.Matrix4(), tmp = new THREE.Matrix4(), d = new THREE.Object3D();
    for (const m of P.meshes) { const im = new THREE.InstancedMesh(m.geometry, m.material, list.length); im.castShadow = list.length < 40; im.receiveShadow = true; im.frustumCulled = false; ims.push([im, m.matrixWorld.clone()]); grp.add(im); }
    list.forEach((a, i) => { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.setScalar(k); fn(d, a, i); d.position.y += -P.box.min.y * d.scale.y; d.updateMatrix(); for (const [im, mw] of ims) { tmp.multiplyMatrices(d.matrix, mw); im.setMatrixAt(i, tmp); } });
    ims.forEach(([im]) => im.instanceMatrix.needsUpdate = true);
    grp.userData.hide = i => { const z = new THREE.Matrix4().makeScale(0, 0, 0); ims.forEach(([im]) => { im.setMatrixAt(i, z); im.instanceMatrix.needsUpdate = true; }); };
    return grp;
  },
  one(id, h) { const P = this.props[id]; if (!P) return null; const s = P.scene.clone(true), k = h / Math.max(0.01, P.size.y); s.scale.setScalar(k); s.position.y = -P.box.min.y * k; const g = new THREE.Group(); g.add(s); return g; }
};
window.AS = AS;
