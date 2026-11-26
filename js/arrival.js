// The arrival: the Image World globe drops onto the night, bounces, and breaks open; its 342 photographs and the record's
// 3,429 grains fly to their own places on the spiral, which waits beneath. Ported from the histograph study (Three.js
// for the photographs, a 2D overlay for the grains); the study's album layout is replaced by targets the spiral
// supplies (views/helix.js arrivalTargets: grains and the pictures' own places), so what forms here is the helix itself.
// The grains are the record's own sparkle: every one in the blend at its year, full and bright, so the swarm carries the
// colour from yellow through pink and violet to blue and white as the clock runs. When the clock ends the overlay fades
// and the real spiral, pictures seated, takes over and dives to today.
import * as THREE from '../vendor/three.module.js';
import { slotOf, SLOT_MAX } from './time.js';

const BASE = 'arrival/';
const V = (window.__BUILD ? `?v=${window.__BUILD}` : '');
import { heat, sunk, mix } from './spectrum.js';
import { POSTER } from './poster.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---------- six seconds ----------
// The title has the night to itself for half a second, then the globe, big enough to fill the frame's middle, drops onto the
// floor, bounces twice more and breaks open. Each contact lights the floor.
// A phone held upright plays the same arrival in under three seconds: the same fall and the first bounce at their own tempo,
// then the years leave the globe in under a second. The spiral's own settle (views/helix.js onReveal) runs under the fade.
const PHONE = typeof innerWidth === 'number' && innerHeight > innerWidth;
const DROP = PHONE ? 0.08 : 0.5, FALL = 0.42, CONTACT = 0.05;
const HOPS = PHONE ? [[0.11, 0.28]] : [[0.11, 0.34], [0.045, 0.22], [0.018, 0.14]];
const IMPACT = DROP + FALL + HOPS.reduce((t, [, d]) => t + CONTACT + d, 0) + CONTACT;
const CLK0 = IMPACT + 0.02, CLK1 = PHONE ? CLK0 + 0.68 : 4.75;
const FLY = PHONE ? 0.4 : 0.55;
const END = PHONE ? CLK1 + FLY : 5.3;
const FADE = 0.5; // the overlay's fade onto the spiral, after END
const TITLE_HOLD = PHONE ? 0.2 : 0.55, TITLE_FADE = PHONE ? 0.5 : 0.7; // the title stays through the first bounces, then dissolves as the globe opens

// ---------- the poster ----------
// POSTER (js/poster.js) is set for automated capture (navigator.webdriver) or a poster= hash: the arrival then draws one
// composed still instead of running. The helix beneath holds POSTER.year in hand with the coil formed to its horizon, forty
// years on; this overlay copies that scene in, then paints the years in flight as grains and pictures arcing from the globe,
// which hangs on the coil's axis past the formed edge (see still). Without POSTER the arrival runs exactly as before.

export function runArrival({ targets, ready, onReveal, onDone }) {
  const reduced = !POSTER && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = document.createElement('div');
  host.className = 'arrival';
  // the title: index.html stands it on the night (#ar-pre) while the files come in, and this takes that element as its own, so
  // nothing re-sets when the globe arrives. The still (POSTER) and a page without the element make their own title, as before.
  let pre = document.getElementById('ar-pre');
  if (pre && POSTER) { pre.remove(); pre = null; }
  host.innerHTML = '<canvas class="ar-gl"></canvas><canvas class="ar-ov"></canvas>' +
    (pre ? '' : '<h2 class="ar-lines" aria-live="polite"><span>Technology <em>Histomap</em></span><small>3.3 million BCE to 2026</small></h2>');
  document.body.appendChild(host);
  if (pre) pre.classList.add('live'); // it stays up once html.arrival-mode is gone
  requestAnimationFrame(() => document.documentElement.classList.remove('arrival-mode'));
  const gl = host.querySelector('.ar-gl'), ov = host.querySelector('.ar-ov'), ctx = ov.getContext('2d');
  const lines = pre || host.querySelector('.ar-lines');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, premultipliedAlpha: true }); }
  catch (e) { host.remove(); if (pre) pre.remove(); onReveal && onReveal(); onDone && onDone(); return () => {}; }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  let DPR = Math.min(devicePixelRatio, 2);

  const L = { W: 0, H: 0, cx: 0, cy: 0, R: 0, ballR: 0, ballX: 0, ballY0: 0, floor: 0, Hv: 0, s: 12, phone: false, dot: null, picAt: null, arr: null, img: null };
  const D = { events: [], images: [] };
  let meshes = [], sheetTex = [], sheetGeo = null, booted = false, t0 = 0, lastS = 0, slowPrev = false, preOut = false, done = false, raf = 0, T = null;
  const evKey = []; // each grain's place in the blend, 32 steps across the thousand years
  let wpp = 1;
  const toWorld = (px, py, out) => out.set((px - L.W / 2) * wpp, (L.H / 2 - py) * wpp, 0);

  function layout() {
    L.W = innerWidth; L.H = innerHeight; L.phone = L.W < 760;
    T = targets(); // { ok, dots: Float32Array(2n) viewport px, cx, cy, R, pic } from the spiral, or null while it lays out
    if (T && T.ok) {
      L.cx = T.cx; L.cy = T.cy; L.R = T.R; L.dot = T.dots; L.s = T.pic; L.picAt = T.picAt || null;
    } else {
      L.cx = L.W / 2; L.cy = L.H * 0.52; L.R = Math.min(L.W, L.H) * 0.36; L.s = L.phone ? 9 : 12;
      L.dot = null;
    }
    L.ballR = POSTER ? clamp(L.R * POSTER.ball, 40, 320) : clamp(Math.min(L.W, L.H) * 0.27, 110, 300); // the globe fills the frame's middle
    L.ballX = L.cx; L.floor = L.cy + L.ballR; L.ballY0 = -L.ballR * 1.2; L.Hv = L.H;
    const n = D.events.length;
    if (n && !L.arr) { L.arr = new Float32Array(n); for (let i = 0; i < n; i++) L.arr[i] = clamp(slotOf(D.events[i][0]) / SLOT_MAX, 0, 1); }
    if (L.dot) for (const m of meshes) { const it = m.userData.it; const e = it.e; if (e >= 0 && L.picAt && Number.isFinite(L.picAt[e * 2])) { it.px = L.picAt[e * 2]; it.py = L.picAt[e * 2 + 1]; } else if (e >= 0 && Number.isFinite(L.dot[e * 2])) { it.px = L.dot[e * 2]; it.py = L.dot[e * 2 + 1]; } else { it.px = L.cx + (rnd() - 0.5) * 40; it.py = L.cy + (rnd() - 0.5) * 40; } }
    for (const it of D.images) if (!(it.arr >= 0)) it.arr = clamp(slotOf(it.y) / SLOT_MAX, 0, 1);
  }
  function resize() {
    DPR = Math.min(devicePixelRatio, 2);
    layout();
    for (const c of [gl, ov]) { c.style.width = L.W + 'px'; c.style.height = L.H + 'px'; }
    renderer.setPixelRatio(DPR); renderer.setSize(L.W, L.H, false);
    ov.width = L.W * DPR; ov.height = L.H * DPR;
    camera.aspect = L.W / L.H; camera.position.set(0, 0, 60); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    wpp = 2 * 60 * Math.tan(THREE.MathUtils.degToRad(20)) / L.H;
  }
  function ball(t) {
    const fl = L.floor - L.ballR;
    if (t < DROP) return { y: L.ballY0, sq: 0 };
    if (t < DROP + FALL) { const u = (t - DROP) / FALL; return { y: L.ballY0 + (fl - L.ballY0) * u * u, sq: 0 }; }
    let c = DROP + FALL;
    for (const [h, d] of HOPS) {
      if (t < c + CONTACT) return { y: fl, sq: Math.sin(Math.PI * (t - c) / CONTACT) * (0.05 + h * 0.5) };
      c += CONTACT;
      if (t < c + d) { const v = (t - c) / d; return { y: fl - h * L.Hv * 4 * v * (1 - v), sq: 0 }; }
      c += d;
    }
    return { y: fl, sq: Math.min(1, (t - c) / CONTACT) * 0.12 };
  }
  const clock = (t) => { const u = clamp((t - CLK0) / (CLK1 - CLK0), 0, 1); return 1 - Math.pow(1 - u, 1.9); };
  const clockT = (a) => CLK0 + (1 - Math.pow(1 - a, 1 / 1.9)) * (CLK1 - CLK0);
  function remaining(t) { const k = clock(t); let n = 0; for (const it of D.images) if (it.arr > k) n++; return n / Math.max(1, D.images.length); }

  const imgVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const imgFrag = `uniform sampler2D map; uniform vec4 rect; uniform float opacity; varying vec2 vUv;
    void main(){ vec2 uvp = vUv; if (!gl_FrontFacing) uvp.x = 1.0 - uvp.x; vec3 c = texture2D(map, rect.xy + uvp * rect.zw).rgb * 0.96; gl_FragColor = vec4(c, opacity); }`;

  const SPR = {};
  function grain(key) {
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas'), S = 32; c.width = c.height = S;
    const h = heat(key / 31), x = c.getContext('2d'), col = mix(h, '#ffffff', 0.18), deep = sunk(h, 0.55);
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, col); g.addColorStop(0.3, col); g.addColorStop(0.42, hexA(deep, 0.5)); g.addColorStop(0.75, hexA(deep, 0.08)); g.addColorStop(1, hexA(deep, 0));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return (SPR[key] = c);
  }

  async function boot() {
    // the data and the picture sheets left with the page's first wave (index.html, window.__arr); without that they are asked for here
    const A = window.__arr || null, dataUrl = `${BASE}data2.json${V}`;
    let res = A && A.data ? await A.data.catch(() => null) : null;
    if (!res || !res.ok) res = await fetch(dataUrl);
    const data = await res.json();
    if (done) return;
    D.events = data.events; D.images = data.images.filter((i) => i.e >= 0);
    D.images.sort((a, b) => a.y - b.y || a.u - b.u);
    // the counts are the record's. Pictures are counted once each: data2.json pictures is the number of distinct pictures among
    // the record's own (record_pictures) and the globe's pool, which share some (one file on two records, a pool crop that
    // is the record's picture; tools/distinct_pictures.py). It is printed only while it was counted from the two sets this
    // file carries (pictures_from); once the record has moved on the line prints no picture count instead of an old one.
    // It used to print the sum of the two sets, which counted the shared pictures twice.
    const pf = data.pictures_from, picN = data.pictures > 0 && Array.isArray(pf) && pf[0] === data.record_pictures && pf[1] === D.images.length ? data.pictures : 0;
    const sub = lines.querySelector('small'), counts = ` \u00b7 ${D.events.length.toLocaleString('en-US')} records${picN ? ` \u00b7 ${picN.toLocaleString('en-US')} pictures` : ''}`;
    if (sub && pre) { const c = document.createElement('i'); c.textContent = counts; sub.appendChild(c); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on'))); } // the title is already up: the count eases in beside it
    else if (sub) sub.textContent = `3.3 million BCE to 2026${counts}`;
    const n = D.events.length;
    D.events.forEach((e) => evKey.push(clamp(Math.round(slotOf(e[0]) / SLOT_MAX * 31), 0, 31)));
    const nAtlas = Math.max(...D.images.map((i) => i.atlas)) + 1;
    // The nine sheets are 2048 px square. Loaded as image elements they were decoded and uploaded together inside the globe's
    // first frame, on the main thread: a quarter of a second in which the fall had already begun. Each is now decoded off the
    // main thread into a bitmap (flipped here: WebGL ignores flipY for bitmaps), and uploaded below, one per frame, before
    // the clock starts. A browser without createImageBitmap options takes the old path through the loader.
    const anis = renderer.capabilities.getMaxAnisotropy();
    const dress = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
    const viaLoader = (i) => new Promise((ok, no) => new THREE.TextureLoader().load(`${BASE}thumb${i}.jpg${V}`, (t) => ok(dress(t)), undefined, no));
    const sheets = A && A.sheets ? await A.sheets.catch(() => null) : null;
    const viaBitmap = async (i) => {
      const blob = sheets && sheets[i] ? await sheets[i] : await (await fetch(`${BASE}thumb${i}.jpg${V}`)).blob();
      const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const t = new THREE.Texture(bmp); t.flipY = false; t.needsUpdate = true; return dress(t);
    };
    const tex = await Promise.all(Array.from({ length: nAtlas }, (_, i) => (typeof createImageBitmap === 'function' ? viaBitmap(i).catch(() => viaLoader(i)) : viaLoader(i))));
    sheetTex = tex;
    if (done) { for (const t of tex) t.dispose(); return; }
    const geo = sheetGeo = new THREE.PlaneGeometry(1, 1), golden = Math.PI * (3 - Math.sqrt(5));
    D.images.forEach((it, i) => {
      const q = (i * 0.7548776662 + 0.31) % 1, z = 1 - 2 * q, rad = Math.sqrt(1 - z * z), th = golden * i;
      const dir = new THREE.Vector3(Math.cos(th) * rad, z, Math.sin(th) * rad);
      const a = it.a;
      const full = new THREE.Vector4(it.u, it.v, it.uw, it.vh);
      const sq = a > 1 ? new THREE.Vector4(it.u + (it.uw - it.uw / a) / 2, it.v, it.uw / a, it.vh) : new THREE.Vector4(it.u, it.v + (it.vh - it.vh * a) / 2, it.uw, it.vh * a);
      const mat = new THREE.ShaderMaterial({ vertexShader: imgVert, fragmentShader: imgFrag, transparent: true, side: THREE.DoubleSide,
        uniforms: { map: { value: tex[it.atlas] }, rect: { value: full.clone() }, opacity: { value: 1 } } });
      const m = new THREE.Mesh(geo, mat);
      m.userData = { it, dir, full, sq, a: clamp(a, 0.6, 1.7), arc: 20 + rnd() * 40,
        outward: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))) };
      scene.add(m); meshes.push(m);
    });
    resize();
    addEventListener('resize', resize);
    // warm the GPU before the clock starts: each sheet uploads in a task of its own (the page stays free to take a tap between
    // them), then the shaders compile, so the globe's first frame costs what its last does
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r)), breathe = () => new Promise((r) => setTimeout(r, 0));
    for (const t of tex) {
      if (done) return;
      try { renderer.initTexture(t); if (t.image && t.image.close) t.image.close(); } catch (e) { /* it uploads with its first draw instead */ }
      await breathe();
    }
    try { await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 800))]); } catch (e) { /* compiled with the first draw instead */ }
    // and the spiral beneath has laid out and seated its pictures (views/helix.js arrivalReady), a redraw of a tenth of a second
    // that used to land wherever the sheets happened to finish; two and a half seconds at most, then the clock starts regardless
    const w0 = performance.now();
    while (!done && ready && !ready() && performance.now() - w0 < 2500) await nextFrame();
    if (done) return;
    await nextFrame();
    booted = true; t0 = performance.now() / 1000;
    if (window.performance && performance.mark) performance.mark('arrival-clock');
  }

  const COL = []; for (let k = 0; k < 32; k++) COL.push(mix(heat(k / 31), '#ffffff', 0.3));
  // the light under the globe: a warm halo behind it, and the floor lit at each contact
  function light(time, b, Rb) {
    const cx = L.ballX, cy = b.y;
    if (time < IMPACT + 0.4) {
      const a = 0.22 * clamp((time - DROP * 0.6) / 0.4, 0, 1) * (time < IMPACT ? 1 : 1 - (time - IMPACT) / 0.4);
      const g = ctx.createRadialGradient(cx, cy, Rb * 0.5, cx, cy, Rb * 2.1);
      g.addColorStop(0, `rgba(255,232,180,${a})`); g.addColorStop(0.45, `rgba(255,214,150,${a * 0.35})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - Rb * 2.2, cy - Rb * 2.2, Rb * 4.4, Rb * 4.4);
    }
    if (b.sq > 0 && time < IMPACT + 0.05) { // the floor takes the blow
      const a = clamp(b.sq * 2.2, 0, 0.55), fw = L.ballR * 2.6, fh = L.ballR * 0.5;
      const g = ctx.createRadialGradient(cx, L.floor, 0, cx, L.floor, fw);
      g.addColorStop(0, `rgba(255,236,200,${a})`); g.addColorStop(0.35, `rgba(255,220,170,${a * 0.3})`); g.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.save(); ctx.translate(cx, L.floor); ctx.scale(1, fh / fw); ctx.translate(-cx, -L.floor);
      ctx.fillStyle = g; ctx.fillRect(cx - fw, L.floor - fw, fw * 2, fw * 2); ctx.restore();
    }
  }
  function drawOverlay(time) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    const b = ball(Math.min(time, IMPACT));
    const rem = L.dot ? remaining(time) : 1, Rb = L.ballR * Math.sqrt(Math.max(rem, 0.02));
    ctx.globalCompositeOperation = 'lighter';
    light(time, b, Rb);
    if (!L.dot) { ctx.globalCompositeOperation = 'source-over'; return; }
    const sz0 = L.phone ? 1.6 : 2.2, trails = rem > 0.15; // the last burst, this century's crowd, flies without tails or it whites out
    for (let i = 0; i < D.events.length; i++) {
      const tx = L.dot[i * 2]; if (!Number.isFinite(tx)) continue;
      const dl = clockT(L.arr[i]);
      const kk = clamp((time - dl) / FLY, 0, 1); if (kk <= 0) continue;
      const e = easeOut(kk), ty = L.dot[i * 2 + 1], arc = 24 * ((i % 5) / 5);
      const ang = i * 2.399, sx = L.ballX + Math.cos(ang) * Rb * 0.9, sy = b.y + Math.sin(ang) * Rb * 0.9;
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e - Math.sin(Math.PI * e) * arc;
      if (trails && kk > 0.04 && kk < 1) { // the trail: a short tail back along the flight, never longer than a few grains' leap
        const e2 = easeOut(Math.max(0, kk - 0.06)); let x2 = sx + (tx - sx) * e2, y2 = sy + (ty - sy) * e2 - Math.sin(Math.PI * e2) * arc;
        const dx = x - x2, dy = y - y2, len = Math.hypot(dx, dy), cap = L.phone ? 26 : 44;
        if (len > cap) { x2 = x - dx / len * cap; y2 = y - dy / len * cap; }
        ctx.globalAlpha = 0.2 * (1 - kk); ctx.strokeStyle = COL[evKey[i]]; ctx.lineWidth = sz0 * 0.7;
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      }
      const sz = sz0 * (0.6 + 0.4 * kk);
      ctx.globalAlpha = 0.55 + 0.45 * kk;
      ctx.drawImage(grain(evKey[i]), x - sz, y - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // the clock waits at impact until the spiral has laid out and can say where everything lands
  let held = 0, holdFrom = null, revealed = false, skipped = false;
  // any input skips to the helix
  const skip = (ev) => {
    if (ev && ev.type === 'keydown' && (ev.metaKey || ev.ctrlKey || ev.altKey)) return;
    skipped = true;
    if (!booted && !done && !POSTER) { onReveal && onReveal(); finish(); } // still loading: the reader goes straight to the page
  };
  const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  for (const t of skipEvents) addEventListener(t, skip, { passive: true, capture: true });
  const v = new THREE.Vector3(), tgt = new THREE.Vector3(), flatQ = new THREE.Quaternion();
  const spinAxis = new THREE.Vector3(0, 1, 0), spinQ = new THREE.Quaternion();
  // the still lets go for anyone who reaches it by hand: one click, key or scroll, or half a minute, and the arrival cuts to the page
  let stillOn = !!POSTER;
  function release() { if (!stillOn) return; stillOn = false; skipped = true; for (const m of meshes) m.visible = true; const st = document.getElementById('poster-style'); if (st) st.remove(); }
  if (POSTER) {
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, release, { passive: true, once: false });
    setTimeout(release, 30000);
  }

  function frame() {
    if (done) return;
    raf = requestAnimationFrame(frame);
    if (!booted) return;
    if (stillOn) { still(); return; }
    const nowS = performance.now() / 1000;
    // one stalled frame (a hidden tab, a hitch) pauses the arrival where it was instead of skipping it ahead. Only the first
    // of a run: on a device where every frame is slow the clock keeps real time, so the arrival ends when it should
    // (it used to hold back on every slow frame, which stretched the arrival many times over on slow graphics)
    const gap = lastS ? nowS - lastS : 0;
    if (gap > 0.1 && !slowPrev) t0 += gap - 1 / 60;
    slowPrev = gap > 0.1;
    lastS = nowS;
    let raw = nowS - t0;
    if (!L.dot) { layout(); }
    if (!L.dot && raw - held > IMPACT) { if (holdFrom == null) holdFrom = raw; held += raw - holdFrom; holdFrom = raw; }
    let time = raw - held;
    if ((reduced || skipped) && time < END) { held = raw - END; holdFrom = null; time = END; } // the cut: the clock jumps to the reveal and runs on from there
    // the page's own title is already up (its rule eases it in): it only has to leave. A title made here comes up with the clock, as before
    if (pre) { if (time >= IMPACT + TITLE_HOLD) { if (!preOut) { preOut = true; pre.style.transition = 'none'; } pre.style.opacity = clamp(1 - (time - IMPACT - TITLE_HOLD) / TITLE_FADE, 0, 1); } }
    else lines.style.opacity = time < 0.1 ? 0 : time < 0.6 ? easeOut((time - 0.1) / 0.5) : time < IMPACT + TITLE_HOLD ? 1 : clamp(1 - (time - IMPACT - TITLE_HOLD) / TITLE_FADE, 0, 1);
    const b = ball(Math.min(time, IMPACT + 0.05));
    const rem = remaining(time), Rpx = L.ballR * Math.sqrt(Math.max(rem, 0.02));
    const R = Rpx * wpp, sx = 1 + b.sq * 0.6, sy = 1 - b.sq;
    const cW = toWorld(L.ballX, b.y + L.ballR * b.sq, tgt).clone();
    spinQ.setFromAxisAngle(spinAxis, 0.7 * Math.min(time, IMPACT) + 0.4 + 0.5 * easeOut(clock(time)));
    const camPos = camera.position;
    for (const m of meshes) {
      const u = m.userData, it = u.it;
      const dl = clockT(it.arr), k = L.dot ? clamp((time - dl) / FLY, 0, 1) : 0, e = easeInOut(k);
      v.copy(u.dir).applyQuaternion(spinQ);
      const onBall = new THREE.Vector3(cW.x + v.x * R * sx, cW.y + v.y * R * sy, v.z * R * sx);
      toWorld(it.px || L.cx, it.py || L.cy, tgt);
      m.position.lerpVectors(onBall, tgt, e);
      m.position.z += Math.sin(Math.PI * e) * u.arc * wpp;
      m.quaternion.slerpQuaternions(u.outward.clone().premultiply(spinQ), flatQ, e);
      const ballSide = Math.max(Rpx * 0.22, 6) * wpp, cell = L.s * wpp;
      const w0 = ballSide * Math.sqrt(u.a), h0 = ballSide / Math.sqrt(u.a);
      m.scale.set(w0 + (cell - w0) * e, h0 + (cell - h0) * e, 1);
      m.renderOrder = 1;
      m.material.uniforms.rect.value.lerpVectors(u.full, u.sq, e);
      const facing = clamp((v.dot(new THREE.Vector3().subVectors(camPos, onBall).normalize()) + 0.05) / 0.3, 0, 1);
      m.material.uniforms.opacity.value = THREE.MathUtils.lerp(facing, 1, clamp(e * 3, 0, 1));
    }
    renderer.render(scene, camera);
    drawOverlay(time);
    if (time >= END && !revealed) { revealed = true; host.classList.add('fade'); onReveal && onReveal(); }
    if (time >= END + FADE) finish();
  }
  // ---------- the still ----------
  // Composed by year rather than by the clock: at or before Y0 (the helix's horizon) an event or picture is seated in the coil
  // beneath and this overlay leaves it alone; between Y0 and Y1 it is in flight, the nearer to Y0 the further along its arc;
  // after Y1 it is still on the globe. The coil the helix painted is copied in first, so the still keeps the arrival's own
  // opaque ground and nothing of the page's chrome shows.
  let stillTick = 0;
  function still() {
    if (!L.dot || (++stillTick % 30 === 0)) layout(); // seats arrive as the coil beneath lays out, pictures and fonts included
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    const hx = document.querySelector('.hx-canvas');
    if (hx && hx.width > 0) { const r = hx.getBoundingClientRect(); ctx.drawImage(hx, r.left, r.top, r.width, r.height); }
    const Y0 = POSTER.year + 40, Y1 = Y0 + Math.max(1, POSTER.window);
    const prog = (y) => clamp((Y1 - y) / (Y1 - Y0), 0, 1);
    const Rpx = L.ballR, R = Rpx * wpp;
    const cW = toWorld(L.ballX, L.cy, tgt).clone();
    window.__STILL = { cx: L.cx, cy: L.cy, ballR: Rpx, loopR: L.R, W: L.W, H: L.H }; // the still's geometry, for review
    spinQ.setFromAxisAngle(spinAxis, POSTER.spin);
    const camPos = camera.position;
    for (const m of meshes) {
      const u = m.userData, it = u.it;
      if (L.dot && it.y <= Y0) { m.visible = false; continue; } // seated: the coil beneath shows it
      m.visible = true;
      const k = L.dot && it.y <= Y1 ? prog(it.y) : 0, e = easeInOut(k);
      v.copy(u.dir).applyQuaternion(spinQ);
      const onBall = new THREE.Vector3(cW.x + v.x * R, cW.y + v.y * R, v.z * R);
      toWorld(it.px || L.cx, it.py || L.cy, tgt);
      m.position.lerpVectors(onBall, tgt, e);
      m.position.z += Math.sin(Math.PI * e) * u.arc * wpp;
      m.quaternion.slerpQuaternions(u.outward.clone().premultiply(spinQ), flatQ, e);
      const ballSide = Math.max(Rpx * 0.22, 6) * wpp, cell = L.s * wpp;
      const w0 = ballSide * Math.sqrt(u.a), h0 = ballSide / Math.sqrt(u.a);
      m.scale.set(w0 + (cell - w0) * e, h0 + (cell - h0) * e, 1);
      m.renderOrder = 1;
      m.material.uniforms.rect.value.lerpVectors(u.full, u.sq, e);
      const facing = clamp((v.dot(new THREE.Vector3().subVectors(camPos, onBall).normalize()) + 0.05) / 0.3, 0, 1);
      m.material.uniforms.opacity.value = THREE.MathUtils.lerp(facing, 1, clamp(e * 3, 0, 1));
    }
    renderer.render(scene, camera);
    if (!L.dot) return;
    ctx.globalCompositeOperation = 'lighter';
    const sz0 = L.phone ? 1.4 : 2; // a touch larger than in motion, so the streams read in a still
    for (let i = 0; i < D.events.length; i++) {
      const y = D.events[i][0]; if (y > Y1) continue;
      const tx = L.dot[i * 2]; if (!Number.isFinite(tx)) continue;
      if (y <= Y0) { // landed: the grain sits lit on its cell, as it does in motion until the overlay fades
        const sz = sz0 * 0.9; ctx.globalAlpha = 0.85; ctx.drawImage(grain(evKey[i]), tx - sz, L.dot[i * 2 + 1] - sz, sz * 2, sz * 2); continue;
      }
      const kk = prog(y), e = easeOut(kk);
      const ang = i * 2.399, sx = L.ballX + Math.cos(ang) * Rpx * 0.9, sy = L.cy + Math.sin(ang) * Rpx * 0.9;
      const x = sx + (tx - sx) * e, yy = sy + (L.dot[i * 2 + 1] - sy) * e - Math.sin(Math.PI * e) * 24 * ((i % 5) / 5);
      const sz = sz0 * (0.6 + 0.4 * kk);
      ctx.globalAlpha = 0.4 + 0.6 * kk;
      ctx.drawImage(grain(evKey[i]), x - sz, yy - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    for (const t of skipEvents) removeEventListener(t, skip, { capture: true });
    clearTimeout(cap);
    // the sheets leave the GPU with the overlay (nine 2048 px textures with their mip chains), not whenever the context is collected
    try { for (const t of sheetTex) t.dispose(); for (const m of meshes) m.material.dispose(); if (sheetGeo) sheetGeo.dispose(); renderer.dispose(); } catch (e) { /* nothing to free */ }
    host.remove();
    if (pre) pre.remove();
    onDone && onDone();
  }
  // a link too thin for the sheets: after twelve seconds of the title alone the page opens without the globe
  const cap = setTimeout(() => { if (!booted && !done && !POSTER) { onReveal && onReveal(); finish(); } }, 12000);
  boot().then(() => { if (!done) frame(); }).catch((e) => { console.error(e); if (!done) { onReveal && onReveal(); finish(); } });
  return finish;
}
