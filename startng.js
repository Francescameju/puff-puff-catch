// Everything that talks to start.ng lives here (see https://start.ng/docs.md).
// The game itself is in game.js and still plays fine if start.ng never answers.

const START_NG = 'https://start.ng';
let connectFramePromise;

function connectFrame() {
  connectFramePromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return connectFramePromise;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
async function askStartNg(message, replyType, timeoutMs = 5000) {
  let el;
  try { el = await connectFrame(); } catch { return null; }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      // Only trust replies that really come from start.ng's connect frame.
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    try { el.contentWindow.postMessage({ ...message, requestId }, START_NG); } catch { done(null); }
  });
}

// The look start.ng uses for guests, in case start.ng can't be reached (e.g. testing locally).
const FALLBACK_GUEST = {
  name: 'Guest',
  style: { body: 'female', primaryColor: '#4b7bec', secondaryColor: '#2b2f4a', skinColor: '#8d5524', hairColor: '#17120f', hair: 'afro', hat: 'none', accessory: 'none' },
  face: null,
};

// Backup sign-in: after signing in, start.ng sends players back with a game session in
// the address. Some browsers (Safari, Brave, strict privacy settings) hide the start.ng
// sign-in from the connect page, so we keep this session and use the HTTP API with it.
const API = 'https://api.start.ng';
const GAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'puff-puff-catch';
{
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('startng_session')) {
    try { sessionStorage.setItem('startng_session', params.get('startng_session')); } catch {}
    history.replaceState(null, '', location.pathname + location.search);
  }
}
function getSession() { try { return sessionStorage.getItem('startng_session'); } catch { return null; } }
function dropSession() { try { sessionStorage.removeItem('startng_session'); } catch {} }

const StartNg = {
  user: null,             // signed-in player, or null
  via: null,              // how they're signed in: 'connect' or 'api'
  player: FALLBACK_GUEST, // who we draw: the user, or the guest look
  onChange: () => {},

  signInUrl() {
    return `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  },

  async refresh() {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
    const guest = reply?.guest ?? FALLBACK_GUEST;

    if (reply?.user) {
      this.user = reply.user; this.via = 'connect'; this.player = reply.user;
    } else if (getSession()) {
      // The connect page didn't see a sign-in: try the session instead.
      const p = await this.playerFromSession();
      if (p) {
        this.user = { id: p.id, name: p.name, account: null, style: p.style, face: null };
        this.via = 'api';
        this.player = { name: p.name, style: p.style || guest.style, face: null };
      } else if (reply) {
        this.user = null; this.via = null; this.player = guest;
      }
    } else if (reply) {
      this.user = null; this.via = null; this.player = guest;
    }
    this.renderCard();
    this.onChange();
  },

  async playerFromSession() {
    try {
      const res = await fetch(`${API}/games/${GAME}/player`, { headers: { Authorization: `Bearer ${getSession()}` } });
      if (res.status === 401) { dropSession(); return null; }
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },

  renderCard() {
    const p = this.player;
    const face = document.getElementById('player-face');
    face.hidden = !p.face;
    if (p.face) face.src = p.face;
    document.getElementById('player-name').textContent = p.name || 'Guest';
    document.getElementById('player-account').textContent =
      this.user?.account ? `@${this.user.account}` : this.user ? 'Signed in' : 'Not signed in';
    const btn = document.getElementById('player-sign-in');
    btn.hidden = !!this.user;
    btn.onclick = () => (location.href = this.signInUrl());
    document.getElementById('player-card').hidden = false;
  },

  // Save a finished run. Only signed-in players can save.
  async saveRun(stats) {
    if (!this.user) return { ok: false, error: 'guest' };
    if (this.via === 'connect') {
      const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
      if (reply?.ok || !getSession()) return reply ?? { ok: false, error: 'Could not reach start.ng' };
    }
    // HTTP API with the game session
    try {
      const res = await fetch(`${API}/games/${GAME}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSession()}` },
        body: JSON.stringify({ stats }),
      });
      if (res.ok) return { ok: true, result: await res.json() };
      if (res.status === 401) {
        dropSession(); this.user = null; this.via = null; this.renderCard();
        return { ok: false, error: 'Your sign-in expired. Sign in again to save.' };
      }
      return { ok: false, error: 'start.ng did not accept this run.' };
    } catch { return { ok: false, error: 'Could not reach start.ng' }; }
  },

  async leaderboard(limit = 10) {
    const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 5000);
    if (reply?.ok) return reply.entries;
    try {
      const res = await fetch(`${API}/games/${GAME}/leaderboard?limit=${limit}`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },
};

// Players may sign in or out on start.ng in another tab: ask again when they come back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) StartNg.refresh(); });
addEventListener('focus', () => StartNg.refresh());
