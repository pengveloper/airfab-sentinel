// Wavrel relay server: lets Rokid glasses ask the Wavrel PC at home a question from anywhere.
//
//   glasses → Rokid cloud → POST /rokid/sse (Bearer AK) ─┐
//                                                        ├→ this server → WebSocket /link → home PC
//   home PC (Wavrel desktop app) → GET /link (Bearer home token) ─┘
//
// Runs behind Caddy, which terminates TLS. Nothing here is stored on disk, and the request
// metadata the glasses send (location, weather, battery) is dropped as soon as it is parsed.
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import * as lz from './lingzhu.mjs';
import { Home, HOME } from './home.mjs';

export const GUARD = Object.freeze({ fails: 10, windowMs: 600_000, blockMs: 900_000, tracked: 10_000, keepaliveMs: 5_000, dedupMs: 60_000 });

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && crypto.timingSafeEqual(sha(a), sha(b));
const bearer = req => { const m = /^Bearer\s+(\S{16,256})$/.exec(String(req.headers.authorization || '')); return m ? m[1] : null; };
const loopback = a => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';

/** Caddy sets X-Forwarded-For to the real client; believe it only from Caddy on this machine. */
function clientIp(req) {
  const peer = req.socket.remoteAddress || '';
  if (!loopback(peer)) return peer;
  return String(req.headers['x-forwarded-for'] || peer).split(',').pop().trim().slice(0, 64);
}

export function createApp({ rokidAk, homeToken, home = new Home(), now = Date.now, log = () => {}, keepaliveMs = GUARD.keepaliveMs } = {}) {
  if (!rokidAk || !homeToken || rokidAk.length < 16 || homeToken.length < 16) throw new Error('rokidAk and homeToken must each be at least 16 characters');
  if (same(rokidAk, homeToken)) throw new Error('rokidAk and homeToken must differ');
  const fails = new Map();
  const recent = new Map();   // message_id → answer promise, so a retried request is not asked twice
  const counts = { questions: 0, authRejected: 0, blocked: 0 };

  const blocked = ip => { const f = fails.get(ip); if (!f || !f.until) return false; if (now() < f.until) return true; fails.delete(ip); return false; };
  const fail = ip => {
    counts.authRejected++;
    if (fails.size >= GUARD.tracked && !fails.has(ip)) fails.delete(fails.keys().next().value);
    const t = now(), f = fails.get(ip) || { times: [] };
    f.times = f.times.filter(x => t - x < GUARD.windowMs); f.times.push(t);
    if (f.times.length >= GUARD.fails) { f.until = t + GUARD.blockMs; f.times = []; }
    fails.set(ip, f);
  };
  const authed = (req, secret) => {
    const ip = clientIp(req);
    if (blocked(ip)) { counts.blocked++; return 'BLOCKED'; }
    if (!same(bearer(req), secret)) { fail(ip); return 'DENIED'; }
    fails.delete(ip); return 'OK';
  };

  const plain = (res, status, text, extra = {}) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
    res.end(text + '\n');
  };

  function readBody(req, limit) {
    return new Promise(resolve => {
      const chunks = []; let size = 0, done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      req.on('data', c => { size += c.length; if (size > limit) { finish(null); req.pause(); } else chunks.push(c); });
      req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
      req.on('error', () => finish(null));
    });
  }

  function answerFor(q) {
    if (!q.question) return Promise.resolve(lz.SAY[q.photo ? 'PHOTO' : 'EMPTY'][q.lang]);
    const key = q.agentId + '/' + q.messageId, hit = recent.get(key);
    if (hit && now() - hit.at < GUARD.dedupMs) return hit.answer;
    counts.questions++;
    const answer = home.ask(q.question, q.lang).then(r => r.ok ? r.text : lz.SAY[r.error][q.lang]);
    recent.set(key, { at: now(), answer });
    for (const [k, v] of recent) if (now() - v.at >= GUARD.dedupMs) recent.delete(k); else break;
    return answer;
  }

  async function rokid(req, res) {
    const auth = authed(req, rokidAk);
    if (auth !== 'OK') return plain(res, auth === 'BLOCKED' ? 429 : 401, auth === 'BLOCKED' ? 'too many attempts' : 'unauthorized', auth === 'DENIED' ? { 'www-authenticate': 'Bearer' } : {});
    const raw = await readBody(req, lz.LIMITS.body);
    if (raw == null) return plain(res, 413, 'too large', { connection: 'close' });
    const q = lz.parseRequest(raw);
    if (!q.ok) return plain(res, 400, 'bad request');
    res.writeHead(200, lz.HEADERS);
    res.write(lz.KEEPALIVE);
    const beat = setInterval(() => { if (!res.writableEnded) res.write(lz.KEEPALIVE); }, keepaliveMs);
    try {
      const text = await answerFor(q);
      if (!res.writableEnded && !res.destroyed) res.end(lz.answer(q.messageId, q.agentId, text));
    } finally { clearInterval(beat); }
  }

  const server = http.createServer((req, res) => {
    const t0 = now(), path = (req.url || '/').split('?')[0];
    res.on('finish', () => log({ path: path.slice(0, 40), status: res.statusCode, ms: now() - t0 }));
    if (path === '/health' && req.method === 'GET') return plain(res, 200, 'ok');
    if (path === '/rokid/sse') {
      if (req.method !== 'POST') return plain(res, 405, 'method not allowed', { allow: 'POST' });
      return rokid(req, res).catch(() => { if (!res.headersSent) plain(res, 500, 'error'); else res.end(); });
    }
    plain(res, 404, 'not found');
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;

  const wss = new WebSocketServer({ noServer: true, maxPayload: HOME.message, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    const refuse = (code, text) => { socket.end(`HTTP/1.1 ${code} ${text}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`); };
    if ((req.url || '').split('?')[0] !== '/link') return refuse(404, 'Not Found');
    const auth = authed(req, homeToken);
    if (auth !== 'OK') return refuse(auth === 'BLOCKED' ? 429 : 401, auth === 'BLOCKED' ? 'Too Many Requests' : 'Unauthorized');
    wss.handleUpgrade(req, socket, head, ws => {
      ws.alive = true;
      ws.on('pong', () => { ws.alive = true; });
      log({ path: '/link', status: home.attach(ws, now()) ? 101 : 409, ms: 0 });
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch { /* closed */ } }
  }, HOME.pingMs);
  heartbeat.unref();

  return {
    server, home,
    status: () => ({ home: home.status(), counts: { ...counts } }),
    close: () => new Promise(resolve => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(() => resolve()); server.closeAllConnections?.(); }),
  };
}
