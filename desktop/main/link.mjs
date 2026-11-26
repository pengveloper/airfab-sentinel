// The desktop end of the relay server link (server/). Keeps one outgoing WebSocket to the
// server so a question asked on Rokid glasses anywhere can reach this PC, which has no public
// address. Pure Node (no Electron imports) so it can be tested on its own.
//
// The link only carries questions and answers. It cannot publish to the hub, change settings
// or reach anything else on this PC: a question becomes lab/in/ask for the window, and only an
// answer the window publishes to lab/out/notify for that question goes back.
import { EventEmitter } from 'node:events';

export const LINK = Object.freeze({ pingMs: 60_000, pongMs: 20_000, retryMinMs: 2_000, retryMaxMs: 60_000, busyRetryMs: 60_000, askMs: 50_000, text: 300, answer: 400 });

const TOKEN = /^[A-Za-z0-9_\-.~+/=]{16,256}$/;
const SERVER_ID = /^[a-f0-9]{12}$/;

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Accepts wss:// (or ws:// to this PC itself, for a server run locally), without user, password,
 * query or fragment. Returns the clean URL or null.
 */
export function linkUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  const secure = u.protocol === 'wss:' || (u.protocol === 'ws:' && LOOPBACK.has(u.hostname));
  if (!secure || !u.hostname || u.username || u.password || u.search || u.hash) return null;
  if (u.pathname === '/' || u.pathname === '') u.pathname = '/link';
  return u.toString();
}

export const validToken = t => typeof t === 'string' && TOKEN.test(t);

export class Link extends EventEmitter {
  constructor({ WebSocket = globalThis.WebSocket, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    super();
    Object.assign(this, { WebSocket, now, setTimer, clearTimer });
    this.url = null; this.token = null; this.ws = null; this.wanted = false;
    this.state = 'off'; this.error = null; this.since = 0; this.tries = 0;
    this.timers = new Set(); this.pending = new Map();
    this.counts = { asked: 0, answered: 0 };
  }

  #later(fn, ms) { const t = this.setTimer(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  #cancelTimers() { for (const t of this.timers) this.clearTimer(t); this.timers.clear(); }
  #set(state, error = null) { this.state = state; this.error = error; this.emit('state', this.status()); }

  /** Sets where to connect. A missing URL or token stops the link. */
  configure({ url, token }) {
    this.stop();
    this.url = url ? linkUrl(url) : null;
    this.token = validToken(token) ? token : null;
    if (this.url && this.token) { this.wanted = true; this.#open(); }
    return this.status();
  }

  stop() {
    this.wanted = false; this.#cancelTimers(); this.pending.clear();
    const ws = this.ws; this.ws = null;
    if (ws) { try { ws.close(1000, 'stop'); } catch { /* closed */ } }
    if (this.state !== 'off') this.#set('off');
  }

  #open() {
    if (!this.wanted) return;
    this.#set('connecting', this.error);
    let ws, opened = false;
    try { ws = new this.WebSocket(this.url, { headers: { authorization: `Bearer ${this.token}`, 'user-agent': 'Wavrel desktop' } }); }
    catch { return this.#retry('BAD_URL'); }
    this.ws = ws;
    let pingTimer = null, pongTimer = null;
    const stopBeat = () => { if (pingTimer) this.clearTimer(pingTimer); if (pongTimer) this.clearTimer(pongTimer); pingTimer = pongTimer = null; };
    const beat = () => {
      pingTimer = this.setTimer(() => {
        if (this.ws !== ws) return;
        try { ws.send('{"type":"ping"}'); } catch { return; }
        pongTimer = this.setTimer(() => { if (this.ws === ws) { try { ws.close(4002, 'no pong'); } catch { /* closed */ } } }, LINK.pongMs);
      }, LINK.pingMs);
    };
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      opened = true; this.tries = 0; this.since = this.now(); this.#set('on'); beat();
    });
    ws.addEventListener('message', e => {
      if (this.ws !== ws || typeof e.data !== 'string' || e.data.length > 16_384) return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.type === 'pong') { stopBeat(); beat(); return; }
      if (!m || m.type !== 'ask' || typeof m.id !== 'string' || !SERVER_ID.test(m.id) || typeof m.text !== 'string') return;
      const text = Array.from(m.text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, LINK.text).join('');
      if (!text) return;
      const lang = m.lang === 'ko' || m.lang === 'zh' ? m.lang : 'en';
      this.pending.set(m.id, this.now()); this.counts.asked++;
      this.#later(() => this.pending.delete(m.id), LINK.askMs);
      this.emit('ask', { id: m.id, text, lang });
      this.emit('state', this.status());
    });
    // A refused upgrade (wrong token, 404) fires only 'error' in Node's WebSocket, never
    // 'close', so either event ends this attempt.
    const end = code => {
      stopBeat();
      if (this.ws !== ws) return;
      this.ws = null; this.pending.clear();
      try { ws.close(); } catch { /* never opened */ }
      if (!this.wanted) return;
      if (code === 4001) return this.#retry('BUSY', LINK.busyRetryMs);
      this.#retry(opened ? 'DROPPED' : 'UNREACHABLE');
    };
    ws.addEventListener('error', () => end(0));
    ws.addEventListener('close', e => end(e.code));
  }

  #retry(error, ms) {
    if (!this.wanted) return;
    this.tries++;
    const wait = ms || Math.min(LINK.retryMaxMs, LINK.retryMinMs * 2 ** Math.min(this.tries - 1, 5));
    this.#set('retrying', error);
    this.#later(() => this.#open(), wait);
  }

  /** Sends the answer to a question this link asked in the last 50 seconds. */
  answer(id, text) {
    if (!this.pending.has(id) || !this.ws || this.state !== 'on') return false;
    this.pending.delete(id);
    const body = Array.from(String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, LINK.answer).join('');
    if (!body) return false;
    try { this.ws.send(JSON.stringify({ type: 'answer', id, text: body })); } catch { return false; }
    this.counts.answered++;
    this.emit('state', this.status());
    return true;
  }

  status() {
    return { state: this.state, url: this.url, hasToken: !!this.token, error: this.error, since: this.state === 'on' ? this.since : 0, counts: { ...this.counts } };
  }
}
