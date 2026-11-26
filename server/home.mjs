// The one Wavrel desktop app this server answers for. The app keeps a WebSocket open to
// /link; a question from the glasses goes down that socket and the answer comes back up it.
// The server keeps no history: a question lives only until it is answered or times out.
import crypto from 'node:crypto';

export const HOME = Object.freeze({ timeoutMs: 45_000, pending: 3, message: 16_384, answer: 400, pingMs: 30_000 });

const ID = /^[a-f0-9]{12}$/;

export class Home {
  constructor({ timeoutMs = HOME.timeoutMs, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    Object.assign(this, { timeoutMs, setTimer, clearTimer });
    this.ws = null; this.since = 0; this.pending = new Map();
    this.counts = { asked: 0, answered: 0, timeouts: 0, refused: 0 };
  }

  get connected() { return !!this.ws; }

  /**
   * The first app to connect answers; another PC with the same token waits (close code 4001)
   * and tries again later, so a desktop and a laptop never take turns knocking each other off.
   * A connection that went silent is dropped by the server's heartbeat within a minute.
   */
  attach(ws, now = Date.now()) {
    if (this.ws && this.ws !== ws) { this.counts.refused++; try { ws.close(4001, 'busy'); } catch { /* gone */ } return false; }
    this.ws = ws; this.since = now;
    ws.on('message', (data, binary) => this.#receive(ws, data, binary));
    ws.on('close', () => { if (this.ws === ws) { this.ws = null; this.#failAll('NO_HOME'); } });
    ws.on('error', () => {});
    return true;
  }

  /** Resolves with { ok: true, text } or { ok: false, error: NO_HOME | BUSY | TIMEOUT }. */
  ask(text, lang) {
    if (!this.ws) return Promise.resolve({ ok: false, error: 'NO_HOME' });
    if (this.pending.size >= HOME.pending) return Promise.resolve({ ok: false, error: 'BUSY' });
    const id = crypto.randomBytes(6).toString('hex');
    this.counts.asked++;
    return new Promise(resolve => {
      const timer = this.setTimer(() => { this.pending.delete(id); this.counts.timeouts++; resolve({ ok: false, error: 'TIMEOUT' }); }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      try { this.ws.send(JSON.stringify({ type: 'ask', id, text, lang })); }
      catch { this.#settle(id, { ok: false, error: 'NO_HOME' }); }
    });
  }

  #settle(id, result) {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id); this.clearTimer(p.timer); p.resolve(result);
    return true;
  }

  #failAll(error) { for (const id of [...this.pending.keys()]) this.#settle(id, { ok: false, error }); }

  #receive(ws, data, binary) {
    if (ws !== this.ws || binary || !data || data.length > HOME.message) return;
    let m;
    try { m = JSON.parse(data.toString('utf8')); } catch { return; }
    if (m && m.type === 'ping') { try { ws.send('{"type":"pong"}'); } catch { /* closed */ } return; }
    if (!m || m.type !== 'answer' || typeof m.id !== 'string' || !ID.test(m.id) || typeof m.text !== 'string') return;
    const text = Array.from(m.text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, HOME.answer).join('');
    if (this.#settle(m.id, text ? { ok: true, text } : { ok: false, error: 'TIMEOUT' })) this.counts.answered++;
  }

  status() { return { connected: this.connected, since: this.connected ? this.since : 0, pending: this.pending.size, counts: { ...this.counts } }; }
}
