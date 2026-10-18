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
  else { const f = flavour().colors; g.addColorStop(0, f[0]); g.addColorStop(0.55, f[1]); g.addColorStop(1, f[2]); }
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i <= 10; i++) { // slightly lumpy ball
    const a = (i / 10) * Math.PI * 2, rr2 = r * (1 + Math.sin(i * 2.3) * 0.06);
    i ? c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  c.closePath(); c.fill();
  c.shadowBlur = 0;
  const fid = golden ? 'gold' : wallet.flavour;
  if (fid === 'chocolate') { // chocolate drizzle
    c.strokeStyle = '#2a1206'; c.lineWidth = 2;
    c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(-r * 0.7, i * r * 0.28); c.quadraticCurveTo(0, i * r * 0.28 - 5, r * 0.7, i * r * 0.28 + 3); } c.stroke();
  } else if (fid === 'strawberry') { // pink glaze with sprinkles
    const cols = ['#fff', '#7bd3f7', '#ffe066'];
    for (let i = 0; i < 7; i++) { c.fillStyle = cols[i % 3]; c.save(); c.translate(Math.cos(i * 1.9) * r * 0.55, Math.sin(i * 2.7) * r * 0.5); c.rotate(i); c.fillRect(-3, -1, 6, 2); c.restore(); }
  } else if (fid === 'coconut') { // coconut flakes
    c.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { c.save(); c.translate(Math.cos(i * 1.3) * r * 0.6, Math.sin(i * 2.1) * r * 0.55); c.rotate(i * 0.8); c.fillRect(-3, -0.8, 6, 1.6); c.restore(); }
  } else {
    c.fillStyle = 'rgba(255,255,255,.75)'; // sugar
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * 1.7) * r * 0.55, Math.sin(i * 2.9) * r * 0.5, 1.4, 0, Math.PI * 2); c.fill(); }
  }
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

function drawCoin(c, x, y, r, rot) {
  const sx = Math.abs(Math.cos(rot * 1.5)) * 0.8 + 0.2; // spinning
  c.save(); c.translate(x, y); c.scale(sx, 1);
  c.fillStyle = '#c99000'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(0, 0, r * 0.82, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#a06c00'; c.font = `bold ${Math.round(r * 1.1)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('₦', 0, 1); c.textBaseline = 'alphabetic';
  c.restore();
}

function drawJuice(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = 'rgba(255,255,255,.85)'; // glass
  c.beginPath(); c.moveTo(-r * 0.7, -r); c.lineTo(r * 0.7, -r); c.lineTo(r * 0.55, r); c.lineTo(-r * 0.55, r); c.closePath(); c.fill();
  c.fillStyle = '#ff9f1c'; // orange juice
  c.beginPath(); c.moveTo(-r * 0.64, -r * 0.55); c.lineTo(r * 0.64, -r * 0.55); c.lineTo(r * 0.52, r * 0.9); c.lineTo(-r * 0.52, r * 0.9); c.closePath(); c.fill();
  c.strokeStyle = '#e94f37'; c.lineWidth = 3; c.lineCap = 'round'; // straw
  c.beginPath(); c.moveTo(r * 0.15, -r * 0.4); c.lineTo(r * 0.45, -r * 1.5); c.stroke();
  c.fillStyle = '#ffe066'; c.beginPath(); c.arc(-r * 0.55, -r * 0.95, r * 0.32, 0, Math.PI * 2); c.fill(); // orange slice
  c.restore();
}

// ---------- scenery ----------
const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
function drawScene(t) {
  const gy = groundY();
  const L = state.mode === 'menu' ? ENDLESS : levelOf(state.level);
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, L.sky[0]); sky.addColorStop(0.55, L.sky[1]); sky.addColorStop(1, L.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
  if (L.night) for (const s of stars) {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * gy, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // moon at night, sun by day
  const orb = Math.min(W, H) * 0.05;
  if (L.rain) {
    // heavy rain clouds instead of the sun
    ctx.fillStyle = 'rgba(70,80,92,.85)';
    for (const [cx, cy, cr] of [[0.15, 0.1, 1.6], [0.32, 0.07, 2.1], [0.55, 0.1, 1.8], [0.78, 0.06, 2.3], [0.95, 0.11, 1.5]]) {
      ctx.beginPath(); ctx.ellipse(cx * W, cy * gy, orb * cr * 1.6, orb * cr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    if (!L.night) { ctx.fillStyle = 'rgba(255,230,120,.35)'; ctx.beginPath(); ctx.arc(W * 0.82, gy * 0.2, orb * 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = L.night ? '#ffe8a3' : '#ffd23f'; ctx.beginPath(); ctx.arc(W * 0.82, gy * 0.2, orb, 0, Math.PI * 2); ctx.fill();
  }
  // party lights for the owambe
  if (L.party) {
    const cols = ['#ff5e5b', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff'];
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, gy * 0.12);
    for (let lx = 0; lx <= W; lx += 40) ctx.lineTo(lx, gy * 0.12 + Math.sin(lx / 90) * 14);
    ctx.stroke();
    for (let lx = 20, k = 0; lx < W; lx += 40, k++) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4 + k);
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath(); ctx.arc(lx, gy * 0.12 + Math.sin(lx / 90) * 14 + 6, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // city skyline
  const city = L.night ? '#2a1838' : '#6b5a7a';
  ctx.fillStyle = city;
  let x = 0, i = 0;
  while (x < W) {
    const bw = 40 + ((i * 37) % 50), bh = 60 + ((i * 53) % 120);
    ctx.fillRect(x, gy - bh, bw, bh);
    ctx.fillStyle = L.night ? 'rgba(255,209,102,.55)' : 'rgba(255,255,255,.25)';
    for (let wy = gy - bh + 10; wy < gy - 14; wy += 16) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if ((wx * 7 + wy * 3 + i) % 5 === 0) ctx.fillRect(wx, wy, 5, 7);
    ctx.fillStyle = city;
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

// Weather drawn on top of everything: rain in Port Harcourt, harmattan dust in Jos.
const drops = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));
const dust = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.5, p: Math.random() * 6 }));
function drawWeather(t) {
  if (state.mode === 'menu') return;
  const L = levelOf(state.level);
  if (L.rain) {
    ctx.strokeStyle = 'rgba(210,225,240,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of drops) {
      const y = ((d.y + t * 0.9 * d.s) % 1) * H, x = ((d.x + t * 0.08) % 1) * W;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16 * d.s);
    }
    ctx.stroke();
  }
  if (L.dust) {
    ctx.fillStyle = 'rgba(214,180,130,.12)'; ctx.fillRect(0, 0, W, H);
    for (const d of dust) {
      ctx.fillStyle = 'rgba(230,200,150,.35)';
      ctx.beginPath(); ctx.arc(((d.x + t * 0.03) % 1) * W, (d.y + Math.sin(t + d.p) * 0.02) * H, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- levels ----------
// Each level: how many puff-puffs to catch, how fast things fall, how often pepper and gold come,
// the sky colours, and what your character says when the level starts.
const LEVELS = [
  { city: 'Lagos', name: 'Morning Batch', goal: 15, speed: 140, gap: 1.0, pepper: 0.08, gold: 0.05, juice: 0,
    sky: ['#7ec8f0', '#bfe3f2', '#ffd9a8'], night: false,
    story: "Traffic don hold for Third Mainland, but Mama's stall is open and the first batch is flying! Catch 15 puff-puff for breakfast.",
    say: "Lagos, good morning! 🍩" },
  { city: 'Ibadan', name: 'School Run', goal: 25, speed: 175, gap: 0.85, pepper: 0.13, gold: 0.05, juice: 0,
    sky: ['#4aa3df', '#9fd0ec', '#ffe0a0'], night: false,
    story: "You're visiting your cousins in Ibadan and they want some for break time. Someone mixed pepper in the bowl, so watch out!",
    say: "Make I pack for my cousins!" },
  { city: 'Port Harcourt', name: 'Rainy Day Cravings', goal: 35, speed: 200, gap: 0.75, pepper: 0.16, gold: 0.06, juice: 0.05,
    sky: ['#5b6774', '#7d8a96', '#a9b3bb'], night: false, rain: true,
    story: "It's raining outside in Port Harcourt and all you want is hot puff-puff and a cold glass of juice. Catch them before the rain makes them soggy! A juice gives you back a heart.",
    say: "Rain don start... I need puff-puff! ☔" },
  { city: 'Abuja', name: 'Owambe Night', goal: 45, speed: 240, gap: 0.6, pepper: 0.2, gold: 0.12, juice: 0.04,
    sky: ['#2b1b4f', '#7a2e7a', '#ff7a6b'], night: true, party: true,
    story: "Owambe in Abuja tonight! The small chops tray needs filling, and more golden puffs are falling for big points.",
    say: "Owambe don start! 🎉" },
  { city: 'Jos', name: 'Harmattan Midnight', goal: 60, speed: 280, gap: 0.5, pepper: 0.24, gold: 0.08, juice: 0.04,
    sky: ['#0d0b24', '#24194a', '#5a2a5e'], night: true, dust: true,
    story: "Cold harmattan night in Jos. Everyone is asleep, but hot puff-puff is the only thing that can warm you up. This is the fastest batch yet!",
    say: "This cold ehn... 🥶 pass me puff-puff!" },
];
// After the last city the game keeps going and keeps getting harder.
const ENDLESS = { city: 'All over Naija', name: 'Endless Frying', goal: Infinity, speed: 300, gap: 0.45, pepper: 0.26, gold: 0.1, juice: 0.04,
  sky: ['#1d1430', '#5a2a5e', '#ff8a4c'], night: true, party: true,
  story: "You've eaten puff-puff in every city! Now it's endless. How long can you last?",
  say: "I no dey tire! 💪" };
const levelOf = (n) => LEVELS[n - 1] || ENDLESS;

// Things your character says during play (one is picked at random).
const LINES = {
  gold: ['Gold! ✨', 'Na gold be this!', 'Big points!'],
  streak10: ['10 in a row! 🔥', 'I no dey miss!', 'Sweet!'],
  streak20: ['20 straight!! 😎', 'Champion!', 'Who fit stop me?'],
  hurt: ['Ehn! Pepper! 🌶️', 'My mouth dey burn!', 'Who put pepper there?!'],
  lastLife: ['One heart left, careful o!', 'Last chance!'],
  miss: ['Ah, it fell!', 'Mama go vex...'],
  juice: ['Cold juice! 🧃', 'Refreshing!', 'Na this I need!'],
  shield: ['Coconut shield! 🥥', 'Pepper no fit me!'],
};
const pickLine = (k) => LINES[k][Math.floor(Math.random() * LINES[k].length)];
function say(text, secs = 2.2) { state.say = { text, life: secs }; }

// ---------- coins, flavours and travel ----------
// Your coins and what you've bought are saved in this browser (start.ng only stores leaderboard scores).
const FLAVOURS = [
  { id: 'classic', name: 'Classic', price: 0, emoji: '🍩', perk: 'The original. Mama’s recipe.', colors: ['#f8cf7f', '#d98a33', '#9c5216'] },
  { id: 'milky', name: 'Milky', price: 40, emoji: '🥛', perk: 'Soft and fluffy: everything falls 10% slower.', colors: ['#fffaf0', '#f3dcae', '#c99a5b'] },
  { id: 'chocolate', name: 'Chocolate', price: 100, emoji: '🍫', perk: 'Rich and sweet: twice as many golden puffs.', colors: ['#b07a4f', '#6b3d1f', '#3a1c0b'] },
  { id: 'coconut', name: 'Coconut', price: 160, emoji: '🥥', perk: 'Coconut shield: blocks the first pepper in each city.', colors: ['#fffdf7', '#ead9c0', '#b9a17e'] },
  { id: 'strawberry', name: 'Strawberry', price: 250, emoji: '🍓', perk: 'Lucky glaze: every coin is worth double.', colors: ['#ffd1dc', '#ff7f9f', '#c2365c'] },
];
const TICKETS = [0, 20, 40, 60, 80]; // price to travel straight to each city (Lagos is free)

const wallet = { coins: 0, owned: ['classic'], flavour: 'classic', cities: [1], startCity: 1 };
try { Object.assign(wallet, JSON.parse(localStorage.getItem('ppc_wallet') || '{}')); } catch {}
function saveWallet() { try { localStorage.setItem('ppc_wallet', JSON.stringify(wallet)); } catch {} renderCoins(); }
const flavour = () => FLAVOURS.find((f) => f.id === wallet.flavour) || FLAVOURS[0];
function addCoins(n) { wallet.coins += n; state.runCoins += n; saveWallet(); }
function unlockCity(n) { if (n <= LEVELS.length && !wallet.cities.includes(n)) { wallet.cities.push(n); saveWallet(); } }
function renderCoins() {
  for (const id of ['menu-coins', 'shop-coins', 'hud-coins']) { const el = document.getElementById(id); if (el) el.textContent = wallet.coins; }
}

function renderCityPicker() {
  const box = $('city-picker'); box.replaceChildren();
  LEVELS.forEach((L, i) => {
    const n = i + 1, open = wallet.cities.includes(n);
    const b = document.createElement('button');
    b.className = 'chip' + (wallet.startCity === n ? ' on' : '');
    b.disabled = !open;
    b.textContent = (open ? '' : '🔒 ') + L.city;
    b.onclick = () => { wallet.startCity = n; saveWallet(); renderCityPicker(); };
    box.append(b);
  });
}

function renderShop() {
  renderCoins();
  const fl = $('shop-flavours'); fl.replaceChildren();
  for (const f of FLAVOURS) {
    const owned = wallet.owned.includes(f.id), on = wallet.flavour === f.id;
    const row = document.createElement('div'); row.className = 'shop-row' + (on ? ' on' : '');
    const sw = document.createElement('i'); sw.className = 'flav';
    sw.style.background = `radial-gradient(circle at 35% 35%, ${f.colors[0]}, ${f.colors[1]} 55%, ${f.colors[2]})`;
    const txt = document.createElement('div'); txt.className = 'shop-txt';
    const nm = document.createElement('b'); nm.textContent = `${f.emoji} ${f.name}`;
    const pk = document.createElement('small'); pk.textContent = f.perk;
    txt.append(nm, pk);
    const btn = document.createElement('button'); btn.className = 'buy';
    if (on) { btn.textContent = 'Using'; btn.disabled = true; }
    else if (owned) { btn.textContent = 'Use'; btn.onclick = () => { wallet.flavour = f.id; saveWallet(); renderShop(); }; }
    else {
      btn.textContent = `🪙 ${f.price}`; btn.disabled = wallet.coins < f.price;
      btn.onclick = () => { if (wallet.coins < f.price) return; wallet.coins -= f.price; wallet.owned.push(f.id); wallet.flavour = f.id; saveWallet(); beep(880, 0.15, 'triangle', 0.12, 1.4); renderShop(); };
    }
    row.append(sw, txt, btn); fl.append(row);
  }
  const tk = $('shop-tickets'); tk.replaceChildren();
  LEVELS.forEach((L, i) => {
    const n = i + 1; if (n === 1) return;
    const open = wallet.cities.includes(n);
    const row = document.createElement('div'); row.className = 'shop-row';
    const txt = document.createElement('div'); txt.className = 'shop-txt';
    const nm = document.createElement('b'); nm.textContent = `✈️ ${L.city}`;
    const pk = document.createElement('small'); pk.textContent = L.name;
    txt.append(nm, pk);
    const btn = document.createElement('button'); btn.className = 'buy';
    if (open) { btn.textContent = 'Unlocked'; btn.disabled = true; }
    else {
      btn.textContent = `🪙 ${TICKETS[i]}`; btn.disabled = wallet.coins < TICKETS[i];
      btn.onclick = () => { if (wallet.coins < TICKETS[i]) return; wallet.coins -= TICKETS[i]; unlockCity(n); beep(880, 0.15, 'triangle', 0.12, 1.4); renderShop(); };
    }
    row.append(txt, btn); tk.append(row);
  });
}
function openShop() { $('start-panel').hidden = true; renderShop(); $('shop-panel').hidden = false; }
function closeShop() { $('shop-panel').hidden = true; renderCityPicker(); $('start-panel').hidden = false; }

// ---------- game state ----------
const state = {
  mode: 'menu', // menu | play | over
  x: 0, vx: 0, facing: 1, moving: false,
  items: [], pops: [],
  puffs: 0, lives: 3, streak: 0, bestStreak: 0,
  time: 0, spawnIn: 0, hurt: 0,
  level: 1, levelPuffs: 0, levelTime: 0, say: null, missCount: 0, runCoins: 0, shield: false,
};
let style = cleanStyle(StartNg.player.style);
StartNg.onChange = () => { style = cleanStyle(StartNg.player.style); };

const keys = new Set();
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && state.mode === 'levelup') { e.preventDefault(); beginLevel(); }
  else if ((e.key === 'Enter' || e.key === ' ') && (state.mode === 'menu' || state.mode === 'over') && $('shop-panel').hidden && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); startGame(); }
  if (e.key === 'Escape' && state.mode !== 'menu') { e.preventDefault(); goToMenu(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

let pointerX = null;
canvas.addEventListener('pointerdown', (e) => { pointerX = e.clientX; });
addEventListener('pointermove', (e) => { if (pointerX !== null || e.pointerType === 'mouse') pointerX = e.clientX; });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointerX = null; });
canvas.addEventListener('pointerleave', () => { pointerX = null; });

function startGame() {
  Object.assign(state, { x: W / 2, vx: 0, items: [], pops: [], puffs: 0, lives: 3, streak: 0, bestStreak: 0, time: 0, hurt: 0, level: wallet.cities.includes(wallet.startCity) ? wallet.startCity : 1, say: null, runCoins: 0 });
  pointerX = null;
  $('start-panel').hidden = true; $('over-panel').hidden = true; $('shop-panel').hidden = true;
  showLevelIntro();
}

// The story card shown before each level.
function showLevelIntro(bonusLife = false, coinsWon = 0) {
  const L = levelOf(state.level);
  state.mode = 'levelup'; state.items = []; keys.clear(); pointerX = null;
  $('hud').hidden = true; $('quit-btn').hidden = false;
  $('level-num').textContent = (L === ENDLESS ? 'Bonus round' : `Level ${state.level} of ${LEVELS.length}`) + ` · 📍 ${L.city}`;
  $('level-name').textContent = L.name;
  $('level-story').textContent = L.story;
  $('level-goal').textContent = L.goal === Infinity ? 'Catch as many as you can!' : `Goal: catch ${L.goal} puff-puffs`;
  $('level-bonus').hidden = !bonusLife;
  $('level-coins').hidden = !coinsWon; $('level-coins').textContent = `🪙 +${coinsWon} coins for finishing the city!`;
  const face = $('level-face');
  if (StartNg.player?.face) { face.src = StartNg.player.face; face.hidden = false; } else face.hidden = true;
  $('level-who').textContent = StartNg.player?.name || 'Guest';
  $('level-panel').hidden = false;
}

function beginLevel() {
  const L = levelOf(state.level);
  Object.assign(state, { mode: 'play', levelPuffs: 0, levelTime: 0, spawnIn: 0.8, missCount: 0, shield: wallet.flavour === 'coconut' });
  $('level-panel').hidden = true; $('hud').hidden = false; $('quit-btn').hidden = false;
  say(L.say, 2.5);
  updateHud();
  beep(520, 0.1, 'square', 0.08, 1.5);
}

function levelComplete() {
  state.items = []; state.pops = [];
  beep(660, 0.12, 'triangle', 0.14, 1.5); setTimeout(() => beep(880, 0.2, 'triangle', 0.14, 1.5), 130);
  state.level++;
  unlockCity(state.level);
  const bonus = state.lives < 3;
  if (bonus) state.lives++;
  addCoins(10);
  showLevelIntro(bonus, 10);
}

function updateHud() {
  $('hud-score').textContent = state.puffs;
  $('hud-streak').textContent = state.streak;
  $('hud-lives').textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, 3 - state.lives));
  renderCoins();
  const L = levelOf(state.level);
  $('hud-level').textContent = `📍 ${L.city} · ` + (L.goal === Infinity ? `${state.levelPuffs}` : `${state.levelPuffs}/${L.goal}`);
}

function spawn() {
  const r = Math.max(14, Math.min(22, W / 30));
  const L = levelOf(state.level);
  // a small ramp inside each level (and a bigger one in Endless) so it slowly gets harder
  const ramp = L === ENDLESS ? Math.min(state.levelTime * 2.5, 250) : Math.min(state.levelTime * 1.5, 40);
  const pepperChance = Math.min(0.34, L.pepper + (L === ENDLESS ? state.levelTime * 0.001 : 0));
  const roll = Math.random();
  const gold = L.gold * (wallet.flavour === 'chocolate' ? 2 : 1);
  let type = roll < pepperChance ? 'pepper' : roll < pepperChance + gold ? 'gold' : roll < pepperChance + gold + L.juice ? 'juice' : 'puff';
  if (type === 'puff' && Math.random() < 0.09) type = 'coin';
  const speed = (L.speed + ramp) * (0.85 + Math.random() * 0.3) * Math.max(0.8, H / 800) * (wallet.flavour === 'milky' ? 0.9 : 1);
  state.items.push({ type, x: r + 40 + Math.random() * (W - 2 * r - 80), y: -r, vy: speed, r, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3 });
  const gap = L === ENDLESS ? Math.max(0.28, L.gap - state.levelTime * 0.002) : L.gap;
  state.spawnIn = gap * (0.7 + Math.random() * 0.6);
}

function pop(x, y, text, color) { state.pops.push({ x, y, text, color, life: 1 }); }

function loseLife() {
  state.lives--; state.streak = 0; state.hurt = 0.6;
  beep(160, 0.25, 'sawtooth', 0.12, 0.5);
  if (state.lives <= 0) { endGame(); return; }
  say(state.lives === 1 ? pickLine('lastLife') : pickLine('hurt'));
}

function update(dt) {
  if (state.mode !== 'play') return;
  state.time += dt; state.levelTime += dt;
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
      if (it.type === 'pepper' && state.shield) { state.shield = false; pop(it.x, it.y, 'Blocked! 🥥', '#fffdf7'); say(pickLine('shield'), 1.5); beep(300, 0.12, 'square', 0.08, 1.5); }
      else if (it.type === 'pepper') { pop(it.x, it.y, 'Ouch! 🌶️', '#ff6b5b'); loseLife(); }
      else if (it.type === 'coin') {
        const v = wallet.flavour === 'strawberry' ? 2 : 1;
        addCoins(v); pop(it.x, it.y, `+${v} 🪙`, '#ffd34d'); beep(1200, 0.07, 'square', 0.06, 1.3);
      }
      else if (it.type === 'juice') {
        if (state.lives < 3) { state.lives++; pop(it.x, it.y, '+❤️', '#ff9a9a'); }
        else { state.puffs += 3; pop(it.x, it.y, '+3', '#ffb347'); }
        say(pickLine('juice'), 1.5);
        beep(500, 0.15, 'sine', 0.14, 1.8);
      }
      else {
        const pts = it.type === 'gold' ? 5 : 1;
        state.puffs += pts; state.levelPuffs += pts; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
        if (it.type === 'gold') say(pickLine('gold'), 1.4);
        else if (state.streak === 10) say(pickLine('streak10'));
        else if (state.streak === 20) say(pickLine('streak20'));
        pop(it.x, it.y, '+' + pts, it.type === 'gold' ? '#ffd34d' : '#d8fd71');
        beep(it.type === 'gold' ? 880 : 620 + Math.min(state.streak, 20) * 15, 0.09, 'triangle', 0.14, 1.3);
      }
    }
    if (!it.done && it.y - it.r > gy) {
      it.done = true;
      if (it.type === 'puff' || it.type === 'gold') {
        state.streak = 0; pop(it.x, gy - 10, 'missed', '#ffb3a7'); beep(240, 0.12, 'sine', 0.06, 0.7);
        if (++state.missCount % 4 === 0) say(pickLine('miss'), 1.6);
      }
    }
  }
  state.items = state.items.filter((it) => !it.done && it.y - it.r < H);
  for (const p of state.pops) { p.life -= dt * 1.3; p.y -= 40 * dt; }
  state.pops = state.pops.filter((p) => p.life > 0);
  if (state.say && (state.say.life -= dt) <= 0) state.say = null;
  updateHud();
  if (state.mode === 'play' && state.levelPuffs >= levelOf(state.level).goal) levelComplete();
}

function render(t) {
  drawScene(t);
  for (const it of state.items) {
    if (it.type === 'pepper') drawPepper(ctx, it.x, it.y, it.r, it.rot);
    else if (it.type === 'juice') drawJuice(ctx, it.x, it.y, it.r, it.rot * 0.15);
    else if (it.type === 'coin') drawCoin(ctx, it.x, it.y, it.r * 0.75, it.rot);
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

  // speech bubble: what your character is saying
  if (state.say && state.mode === 'play') {
    const fs = Math.round(15 * Math.max(0.85, charScale()));
    ctx.font = `bold ${fs}px "Trebuchet MS", sans-serif`;
    const text = state.say.text;
    const bw = ctx.measureText(text).width + 24, bh = fs + 18;
    const bx = Math.max(8, Math.min(W - bw - 8, x - bw / 2)), by = ty - 22 - bh;
    ctx.globalAlpha = Math.min(1, state.say.life * 3);
    ctx.fillStyle = '#fffefa'; rr(ctx, bx, by, bw, bh, 12);
    ctx.beginPath(); ctx.moveTo(x - 7, by + bh - 1); ctx.lineTo(x + 7, by + bh - 1); ctx.lineTo(x, by + bh + 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#292a23'; ctx.textAlign = 'center'; ctx.fillText(text, bx + bw / 2, by + bh / 2 + fs * 0.35);
    ctx.globalAlpha = 1;
  }

  for (const p of state.pops) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = p.color; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  drawWeather(t);
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
  $('final-level').textContent = levelOf(state.level) === ENDLESS ? 'All' : state.level;
  $('final-city').textContent = `You made it to 📍 ${levelOf(state.level).city} and won 🪙 ${state.runCoins} coins`;
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
  $('hud').hidden = true; $('quit-btn').hidden = true; $('over-panel').hidden = true; $('level-panel').hidden = true;
  state.level = 1; state.say = null; $('shop-panel').hidden = true;
  renderCityPicker(); renderCoins();
  $('start-panel').hidden = false;
  loadBoard('board-start');
}
$('quit-btn').onclick = goToMenu;
$('menu-btn').onclick = goToMenu;
$('play-btn').onclick = startGame;
$('again-btn').onclick = startGame;
$('level-go').onclick = beginLevel;
$('shop-btn').onclick = openShop;
$('shop-back').onclick = closeShop;

// ---------- start up ----------
renderCityPicker(); renderCoins();
StartNg.renderCard();
StartNg.refresh().then(() => loadBoard('board-start'));
