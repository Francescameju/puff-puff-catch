// Puff-Puff Catch: catch falling puff-puff as your start.ng character, dodge the pepper.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();

const groundY = () => H - Math.max(60, H * 0.1);
const charScale = () => Math.max(0.7, Math.min(1.25, H / 760));

// ---------- sound ----------
let audio = null, muted = false;
try { muted = localStorage.getItem('ppc_muted') === '1'; } catch {}
$('mute').textContent = muted ? '🔈' : '🔊';
$('mute').onclick = () => {
  muted = !muted;
  $('mute').textContent = muted ? '🔈' : '🔊';
  try { localStorage.setItem('ppc_muted', muted ? '1' : '0'); } catch {}
};
function beep(freq, dur = 0.08, type = 'sine', vol = 0.15, slide = 0) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, audio.currentTime + dur);
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch {}
}

// ---------- the player's start.ng character ----------
const HEX = /^#[0-9a-f]{6}$/i;
const pick = (v, ok, def) => (ok.includes(v) ? v : def);
function cleanStyle(s = {}) {
  s = s || {};
  return {
    body: pick(s.body, ['female', 'male'], 'female'),
    top: HEX.test(s.primaryColor) ? s.primaryColor : '#4b7bec',
    bottom: HEX.test(s.secondaryColor) ? s.secondaryColor : '#2b2f4a',
    skin: HEX.test(s.skinColor) ? s.skinColor : '#8d5524',
    hairColor: HEX.test(s.hairColor) ? s.hairColor : '#17120f',
    hair: pick(s.hair, ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'], 'short'),
    hat: pick(s.hat, ['none', 'cap', 'beanie', 'tophat', 'crown'], 'none'),
    accessory: pick(s.accessory, ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'], 'none'),
  };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }

// Draws the character standing with feet at (x, y). About 130 units tall before scaling.
function drawCharacter(c, x, y, s, st, t, moving, facing, holdUp) {
  c.save();
  c.translate(x, y); c.scale(s, s);
  const swing = moving ? Math.sin(t * 14) * 5 : 0;
  const bob = moving ? Math.abs(Math.sin(t * 14)) * 2 : 0;

  // shadow
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath(); c.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); c.fill();

  c.translate(0, -bob);
  const female = st.body === 'female';

  // legs and shoes
  if (female) {
    c.fillStyle = st.skin;
    rr(c, -11, -38, 8, 36 + swing * 0.4, 3);
    rr(c, 3, -38, 8, 36 - swing * 0.4, 3);
  } else {
    c.fillStyle = st.bottom;
    rr(c, -12, -52, 10, 50 + swing * 0.4, 3);
    rr(c, 2, -52, 10, 50 - swing * 0.4, 3);
  }
  c.fillStyle = '#222';
  c.beginPath(); c.ellipse(-8, 0 + swing * 0.4, 7, 4, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8, 0 - swing * 0.4, 7, 4, 0, 0, Math.PI * 2); c.fill();

  // backpack sits behind the body
  if (st.accessory === 'backpack') {
    c.fillStyle = '#8a5a2b';
    rr(c, -22, -90, 44, 36, 8);
  }

  // skirt or hips
  if (female) {
    c.fillStyle = st.bottom;
    c.beginPath(); c.moveTo(-15, -58); c.lineTo(15, -58); c.lineTo(21, -34); c.lineTo(-21, -34); c.closePath(); c.fill();
  }

  // arms: raised to catch while playing
  c.fillStyle = st.skin;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 16, -88);
    // arms are drawn hanging down; rotate them out to the side, or up over the head to catch
    c.rotate(holdUp ? -side * (Math.PI - 0.45) + Math.sin(t * 10) * 0.06 : -side * 0.15 + side * swing * 0.03);
    c.fillStyle = st.top; rr(c, -5, -2, 10, 14, 4);
    c.fillStyle = st.skin; rr(c, -4, 10, 8, 20, 4);
    c.beginPath(); c.arc(0, 31, 5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // body (top)
  c.fillStyle = st.top;
  rr(c, -17, -92, 34, female ? 36 : 42, 9);
  c.fillStyle = shade(st.top, -0.12);
  rr(c, -17, -62, 34, 6, 3);
  if (st.accessory === 'backpack') {
    c.strokeStyle = '#5c3a18'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-10, -92); c.lineTo(-10, -62); c.moveTo(10, -92); c.lineTo(10, -62); c.stroke();
  }

  // neck and scarf
  c.fillStyle = st.skin; rr(c, -5, -98, 10, 8, 2);
  if (st.accessory === 'scarf') {
    c.fillStyle = '#e94f37';
    rr(c, -14, -98, 28, 9, 4);
    rr(c, 4, -92, 8, 18, 3);
  }

  const hx = 0, hy = -114, hr = 17;
  const hc = st.hairColor;

  // hair behind the head
  c.fillStyle = hc;
  if (st.hair === 'afro') { c.beginPath(); c.arc(hx, hy - 4, 25, 0, Math.PI * 2); c.fill(); }
  if (st.hair === 'braids') {
    for (const sx of [-15, -11, 11, 15]) rr(c, hx + sx - 2.5, hy - 4, 5, 34, 2.5);
  }
  if (st.hair === 'dreads') {
    for (const sx of [-17, -12, -7, 7, 12, 17]) rr(c, hx + sx - 3, hy - 6, 6, 28 + (Math.abs(sx) % 5) * 2, 3);
  }
  if (st.hair === 'ponytail') {
    c.save(); c.translate(hx - facing * 14, hy - 8); c.rotate(-facing * 0.5 + Math.sin(t * 8) * (moving ? 0.15 : 0.04));
    rr(c, -5, 0, 10, 30, 5); c.restore();
  }

  // head and face
  c.fillStyle = st.skin;
  c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(hx - hr, hy + 2, 4, 0, Math.PI * 2); c.arc(hx + hr, hy + 2, 4, 0, Math.PI * 2); c.fill();
  const lx = facing * 2;
  c.fillStyle = '#1b1b1b';
  c.beginPath(); c.arc(hx - 6 + lx, hy + 1, 2.3, 0, Math.PI * 2); c.arc(hx + 6 + lx, hy + 1, 2.3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.8; c.lineCap = 'round';
  c.beginPath(); c.arc(hx + lx, hy + 6, 5, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();

  // hair on top of the head
  c.fillStyle = hc;
  if (st.hair !== 'bald' && st.hair !== 'afro') {
    c.beginPath(); c.arc(hx, hy - 1, hr + 1, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
  }
  if (st.hair === 'afro') {
    c.beginPath(); c.arc(hx, hy - 3, hr + 2, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
  }
  if (st.hair === 'bun') { c.beginPath(); c.arc(hx, hy - hr - 6, 8, 0, Math.PI * 2); c.fill(); }

  // accessories on the face
  if (st.accessory === 'beard') {
    c.fillStyle = hc;
    c.beginPath(); c.arc(hx, hy + 4, hr - 1, 0.05 * Math.PI, 0.95 * Math.PI); c.closePath(); c.fill();
    c.fillStyle = st.skin; rr(c, hx - 5 + lx, hy + 6, 10, 3, 1.5);
  }
  if (st.accessory === 'glasses') {
    c.strokeStyle = '#111'; c.lineWidth = 2;
    c.beginPath(); c.arc(hx - 6 + lx, hy + 1, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(hx + 6 + lx, hy + 1, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(hx - 1 + lx, hy + 1); c.lineTo(hx + 1 + lx, hy + 1); c.stroke();
  }
  if (st.accessory === 'earrings') {
    c.fillStyle = '#ffd34d';
    c.beginPath(); c.arc(hx - hr, hy + 9, 3, 0, Math.PI * 2); c.arc(hx + hr, hy + 9, 3, 0, Math.PI * 2); c.fill();
  }

  // hats
  const top = hy - hr - (st.hair === 'afro' ? 7 : 0);
  if (st.hat === 'cap') {
    c.fillStyle = shade(st.top, -0.15);
    c.beginPath(); c.arc(hx, top + hr - 2, hr + 1, Math.PI, 0); c.closePath(); c.fill();
    rr(c, facing > 0 ? hx : hx - 28, top + hr - 4, 28, 5, 2.5);
  } else if (st.hat === 'beanie') {
    c.fillStyle = '#e94f37';
    c.beginPath(); c.arc(hx, top + hr - 1, hr + 2, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#ffd166'; rr(c, hx - hr - 2, top + hr - 4, (hr + 2) * 2, 6, 3);
    c.beginPath(); c.arc(hx, top - 2, 4, 0, Math.PI * 2); c.fill();
  } else if (st.hat === 'tophat') {
    c.fillStyle = '#16161c';
    rr(c, hx - 23, top + 4, 46, 6, 3);
    rr(c, hx - 14, top - 22, 28, 28, 3);
    c.fillStyle = '#e94f37'; rr(c, hx - 14, top - 2, 28, 4, 1);
  } else if (st.hat === 'crown') {
    c.fillStyle = '#ffd34d';
    c.beginPath();
    c.moveTo(hx - 15, top + 6); c.lineTo(hx - 15, top - 8); c.lineTo(hx - 8, top - 1); c.lineTo(hx, top - 12);
    c.lineTo(hx + 8, top - 1); c.lineTo(hx + 15, top - 8); c.lineTo(hx + 15, top + 6); c.closePath(); c.fill();
    c.fillStyle = '#e94f37'; c.beginPath(); c.arc(hx, top + 1, 2.5, 0, Math.PI * 2); c.fill();
  }

  c.restore();
}

// ---------- falling things ----------
function drawPuff(c, x, y, r, rot, golden) {
  c.save(); c.translate(x, y); c.rotate(rot);
  if (golden) { c.shadowColor = '#ffd700'; c.shadowBlur = 18; }
  const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  if (golden) { g.addColorStop(0, '#fffbd0'); g.addColorStop(0.5, '#ffd34d'); g.addColorStop(1, '#c99000'); }
  else { g.addColorStop(0, '#f8cf7f'); g.addColorStop(0.55, '#d98a33'); g.addColorStop(1, '#9c5216'); }
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i <= 10; i++) { // slightly lumpy ball
    const a = (i / 10) * Math.PI * 2, rr2 = r * (1 + Math.sin(i * 2.3) * 0.06);
    i ? c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  c.closePath(); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,.75)'; // sugar
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * 1.7) * r * 0.55, Math.sin(i * 2.9) * r * 0.5, 1.4, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawPepper(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.1);
  g.addColorStop(0, '#ff8a7a'); g.addColorStop(0.5, '#e8231a'); g.addColorStop(1, '#8e0d06');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, -r * 0.7);
  c.bezierCurveTo(r * 1.2, -r * 0.9, r * 1.1, r * 0.5, r * 0.3, r * 1.0);
  c.quadraticCurveTo(0, r * 0.7, -r * 0.3, r * 1.0);
  c.bezierCurveTo(-r * 1.1, r * 0.5, -r * 1.2, -r * 0.9, 0, -r * 0.7);
  c.fill();
  c.fillStyle = '#2f9e44'; rr(c, -3, -r * 1.15, 6, r * 0.55, 3);
  c.beginPath(); c.ellipse(0, -r * 0.7, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---------- scenery ----------
const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
function drawScene(t) {
  const gy = groundY();
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#1d1430'); sky.addColorStop(0.55, '#5a2a5e'); sky.addColorStop(1, '#ff8a4c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
  for (const s of stars) {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * gy, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // moon
  ctx.fillStyle = '#ffe8a3'; ctx.beginPath(); ctx.arc(W * 0.82, gy * 0.2, Math.min(W, H) * 0.05, 0, Math.PI * 2); ctx.fill();
  // city skyline
  ctx.fillStyle = '#2a1838';
  let x = 0, i = 0;
  while (x < W) {
    const bw = 40 + ((i * 37) % 50), bh = 60 + ((i * 53) % 120);
    ctx.fillRect(x, gy - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,209,102,.55)';
    for (let wy = gy - bh + 10; wy < gy - 14; wy += 16) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if ((wx * 7 + wy * 3 + i) % 5 === 0) ctx.fillRect(wx, wy, 5, 7);
    ctx.fillStyle = '#2a1838';
    x += bw + 4; i++;
  }
  // street
  ctx.fillStyle = '#3b2b1f'; ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = '#c9a227'; ctx.fillRect(0, gy, W, 4);
  // mama's frying pot, left side
  const px = Math.min(80, W * 0.12), py = gy;
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(px, py - 14, 34, 16, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#d98a33'; ctx.beginPath(); ctx.ellipse(px, py - 16, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(px - 12 + k * 12, py - 30 - ((t * 30 + k * 15) % 40), 6 + k, 0, Math.PI * 2); ctx.fill(); }
}

// ---------- game state ----------
const state = {
  mode: 'menu', // menu | play | over
  x: 0, vx: 0, facing: 1, moving: false,
  items: [], pops: [],
  puffs: 0, lives: 3, streak: 0, bestStreak: 0,
  time: 0, spawnIn: 0, hurt: 0,
};
let style = cleanStyle(StartNg.player.style);
StartNg.onChange = () => { style = cleanStyle(StartNg.player.style); };

const keys = new Set();
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && state.mode !== 'play') { e.preventDefault(); startGame(); }
  if (e.key === 'Escape' && state.mode !== 'menu') { e.preventDefault(); goToMenu(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

let pointerX = null;
canvas.addEventListener('pointerdown', (e) => { pointerX = e.clientX; });
addEventListener('pointermove', (e) => { if (pointerX !== null || e.pointerType === 'mouse') pointerX = e.clientX; });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointerX = null; });
canvas.addEventListener('pointerleave', () => { pointerX = null; });

function startGame() {
  Object.assign(state, { mode: 'play', x: W / 2, vx: 0, items: [], pops: [], puffs: 0, lives: 3, streak: 0, bestStreak: 0, time: 0, spawnIn: 0.6, hurt: 0 });
  pointerX = null;
  $('start-panel').hidden = true; $('over-panel').hidden = true; $('hud').hidden = false; $('quit-btn').hidden = false;
  updateHud();
  beep(520, 0.1, 'square', 0.08, 1.5);
}

function updateHud() {
  $('hud-score').textContent = state.puffs;
  $('hud-streak').textContent = state.streak;
  $('hud-lives').textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, 3 - state.lives));
}

function spawn() {
  const r = Math.max(14, Math.min(22, W / 30));
  const level = state.time;
  const pepperChance = Math.min(0.32, 0.12 + level * 0.004);
  const roll = Math.random();
  const type = roll < pepperChance ? 'pepper' : roll < pepperChance + 0.06 ? 'gold' : 'puff';
  const speed = (150 + Math.min(level * 6, 330)) * (0.85 + Math.random() * 0.3) * Math.max(0.8, H / 800);
  state.items.push({ type, x: r + 40 + Math.random() * (W - 2 * r - 80), y: -r, vy: speed, r, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3 });
  state.spawnIn = Math.max(0.28, 0.95 - level * 0.012) * (0.7 + Math.random() * 0.6);
}

function pop(x, y, text, color) { state.pops.push({ x, y, text, color, life: 1 }); }

function loseLife() {
  state.lives--; state.streak = 0; state.hurt = 0.6;
  beep(160, 0.25, 'sawtooth', 0.12, 0.5);
  if (state.lives <= 0) endGame();
}

function update(dt) {
  if (state.mode !== 'play') return;
  state.time += dt;
  const s = charScale();
  const half = 22 * s;

  // movement
  const speed = Math.max(380, W * 0.75);
  let dir = 0;
  if (keys.has('arrowleft') || keys.has('a')) dir -= 1;
  if (keys.has('arrowright') || keys.has('d')) dir += 1;
  if (dir) { state.x += dir * speed * dt; pointerX = null; }
  else if (pointerX !== null) {
    const diff = pointerX - state.x;
    state.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * 1.3 * dt);
    if (Math.abs(diff) > 2) dir = Math.sign(diff);
  }
  state.moving = dir !== 0;
  if (dir) state.facing = dir;
  state.x = Math.max(half + 6, Math.min(W - half - 6, state.x));
  state.hurt = Math.max(0, state.hurt - dt);

  // falling things
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) spawn();
  const gy = groundY();
  const catchTop = gy - 160 * s, catchBottom = gy - 70 * s;
  for (const it of state.items) {
    it.y += it.vy * dt; it.rot += it.vr * dt;
    if (!it.done && it.y + it.r > catchTop && it.y - it.r < catchBottom && Math.abs(it.x - state.x) < 30 * s + it.r * 0.8) {
      it.done = true;
      if (it.type === 'pepper') { pop(it.x, it.y, 'Ouch! 🌶️', '#ff6b5b'); loseLife(); }
      else {
        const pts = it.type === 'gold' ? 5 : 1;
        state.puffs += pts; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
        pop(it.x, it.y, '+' + pts, it.type === 'gold' ? '#ffd34d' : '#d8fd71');
        beep(it.type === 'gold' ? 880 : 620 + Math.min(state.streak, 20) * 15, 0.09, 'triangle', 0.14, 1.3);
      }
    }
    if (!it.done && it.y - it.r > gy) {
      it.done = true;
      if (it.type !== 'pepper') { state.streak = 0; pop(it.x, gy - 10, 'missed', '#ffb3a7'); beep(240, 0.12, 'sine', 0.06, 0.7); }
    }
  }
  state.items = state.items.filter((it) => !it.done && it.y - it.r < H);
  for (const p of state.pops) { p.life -= dt * 1.3; p.y -= 40 * dt; }
  state.pops = state.pops.filter((p) => p.life > 0);
  updateHud();
}

function render(t) {
  drawScene(t);
  for (const it of state.items) {
    if (it.type === 'pepper') drawPepper(ctx, it.x, it.y, it.r, it.rot);
    else drawPuff(ctx, it.x, it.y, it.r, it.rot, it.type === 'gold');
  }
  const gy = groundY();
  const x = state.mode === 'play' ? state.x : W / 2;
  if (!(state.hurt > 0 && Math.floor(state.hurt * 20) % 2)) {
    drawCharacter(ctx, x, gy + 2, charScale(), style, t, state.moving && state.mode === 'play', state.facing, state.mode === 'play');
  }
  // name tag above the character
  const name = StartNg.player?.name || 'Guest';
  ctx.font = `bold ${Math.round(13 * charScale())}px sans-serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(name).width + 14, ty = gy - 175 * charScale();
  ctx.fillStyle = 'rgba(41,42,35,.75)'; rr(ctx, x - tw / 2, ty - 13, tw, 20, 10);
  ctx.fillStyle = '#fffefa'; ctx.fillText(name, x, ty + 2);

  for (const p of state.pops) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = p.color; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pause politely: if the tab is hidden, stop the clock so nothing falls unseen.
document.addEventListener('visibilitychange', () => { last = performance.now(); keys.clear(); });

// ---------- game over, saving and the leaderboard ----------
async function endGame() {
  state.mode = 'over';
  $('quit-btn').hidden = true;
  state.items = []; state.pops = [];
  $('hud').hidden = true;
  $('final-puffs').textContent = state.puffs;
  $('final-streak').textContent = state.bestStreak;
  $('over-panel').hidden = false;
  beep(330, 0.4, 'triangle', 0.12, 0.5);

  let localBest = 0;
  try { localBest = +localStorage.getItem('ppc_best') || 0; if (state.puffs > localBest) localStorage.setItem('ppc_best', state.puffs); } catch {}

  const msg = $('save-msg');
  if (!StartNg.user) {
    msg.innerHTML = '';
    const a = document.createElement('a');
    a.href = StartNg.signInUrl(); a.textContent = 'Sign in with start.ng';
    msg.append(a, ' to save your score to the leaderboard.');
  } else {
    msg.textContent = 'Saving your run…';
    const saved = await StartNg.saveRun({ puffs: state.puffs, streak: state.bestStreak });
    if (saved.ok) {
      const r = saved.result || {};
      msg.textContent = r.improved ? `New best! You're #${r.rank} on the board.` : `Not your best this time. Your best is #${r.rank}.`;
    } else {
      msg.textContent = saved.error || 'Could not save this run.';
    }
  }
  loadBoard('board-over');
}

async function loadBoard(id) {
  const list = $(id);
  const entries = await StartNg.leaderboard(10);
  list.replaceChildren();
  if (!entries) { list.innerHTML = '<li class="muted">Leaderboard shows up when playing on start.ng</li>'; return; }
  if (!entries.length) { list.innerHTML = '<li class="muted">No scores yet. Be the first!</li>'; return; }
  for (const e of entries) {
    const li = document.createElement('li');
    if (StartNg.user && e.player_id === StartNg.user.id) li.className = 'me';
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = '#' + e.rank;
    const who = document.createElement('span'); who.className = 'who';
    const sw = document.createElement('i'); sw.className = 'swatch'; sw.style.background = HEX.test(e.color) ? e.color : '#888';
    who.append(sw, e.name);
    const pts = document.createElement('b'); pts.textContent = `${e.stats?.puffs ?? e.score} 🍩`;
    li.append(rank, who, pts);
    list.append(li);
  }
}

// Leave a run (or the game-over screen) and go back to the start screen. A quit run isn't saved.
function goToMenu() {
  Object.assign(state, { mode: 'menu', items: [], pops: [], moving: false });
  keys.clear(); pointerX = null;
  $('hud').hidden = true; $('quit-btn').hidden = true; $('over-panel').hidden = true;
  $('start-panel').hidden = false;
  loadBoard('board-start');
}
$('quit-btn').onclick = goToMenu;
$('menu-btn').onclick = goToMenu;
$('play-btn').onclick = startGame;
$('again-btn').onclick = startGame;

// ---------- start up ----------
StartNg.renderCard();
StartNg.refresh().then(() => loadBoard('board-start'));
