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

const StartNg = {
  user: null,          // signed-in player, or null
  player: FALLBACK_GUEST, // who we draw: the user, or the guest look
  onChange: () => {},

  signInUrl() {
    return `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  },

  async refresh() {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
    if (!reply) { this.renderCard(); return; } // start.ng didn't answer: keep what we have
    this.user = reply.user ?? null;
    this.player = reply.user ?? reply.guest ?? FALLBACK_GUEST;
    this.renderCard();
    this.onChange();
  },

  renderCard() {
    const p = this.player;
    const face = document.getElementById('player-face');
    face.hidden = !p.face;
    if (p.face) face.src = p.face;
    document.getElementById('player-name').textContent = p.name || 'Guest';
    document.getElementById('player-account').textContent = this.user?.account ? `@${this.user.account}` : 'Not signed in';
    const btn = document.getElementById('player-sign-in');
    btn.hidden = !!this.user;
    btn.onclick = () => (location.href = this.signInUrl());
    document.getElementById('player-card').hidden = false;
  },

  // Save a finished run. Only signed-in players can save.
  async saveRun(stats) {
    if (!this.user) return { ok: false, error: 'guest' };
    const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
    return reply ?? { ok: false, error: 'Could not reach start.ng' };
  },

  async leaderboard(limit = 10) {
    const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 8000);
    return reply?.ok ? reply.entries : null;
  },
};

// Players may sign in or out on start.ng in another tab: ask again when they come back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) StartNg.refresh(); });
addEventListener('focus', () => StartNg.refresh());

// After signing in, start.ng sends players back with a session in the address.
// We use the connect page instead, so just clean the address bar.
if (location.hash.includes('startng_session=')) {
  history.replaceState(null, '', location.pathname + location.search);
}
