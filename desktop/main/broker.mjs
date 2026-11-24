// Embedded MQTT hub. Pure Node (no Electron imports) so it can be tested on its own.
// Boards on the LAN publish here; the desktop window reads the same stream in-process.
import net from 'node:net';
import os from 'node:os';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Aedes } from 'aedes';

export const LIMITS = Object.freeze({
  maxClients: 32,          // sockets accepted at once
  preAuthBytes: 4096,      // bytes a socket may send before it has authenticated
  maxPayload: 65536,       // largest PUBLISH payload accepted from a device
  maxTopic: 200,
  authFails: 5,            // failed logins per address ...
  authWindowMs: 60_000,    // ... inside this window ...
  blockMs: 60_000,         // ... block that address for this long
  retained: 500,           // retained messages remembered for replay to the window
  connectTimeoutMs: 10_000,
});

const RESERVED = ['$', 'lab/console/'];

/** True for loopback, RFC 1918, link-local and unique-local addresses. */
export function isPrivateAddress(addr) {
  if (!addr) return false;
  let a = String(addr).toLowerCase();
  if (a.startsWith('::ffff:')) a = a.slice(7);
  if (net.isIPv4(a)) {
    const [p, q] = a.split('.').map(Number);
    return p === 10 || p === 127 || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 169 && q === 254);
  }
  if (net.isIPv6(a)) return a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  return false;
}

/** IPv4 addresses a board on the same LAN can reach. */
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal && isPrivateAddress(i.address) && !i.address.startsWith('169.254.')) out.push({ name, address: i.address });
    }
  }
  return out;
}

/** Client ids often embed a MAC address; show only the start. */
export const maskId = id => { const s = String(id || ''); return s.length > 6 ? s.slice(0, 6) + '…' : s; };

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
export const samePassword = (a, b) => a != null && b != null && crypto.timingSafeEqual(sha(a), sha(b));

export function validTopic(t) {
  return typeof t === 'string' && t.length > 0 && t.length <= LIMITS.maxTopic && !/[#+\u0000]/.test(t) && !RESERVED.some(p => t.startsWith(p));
}

export class Hub extends EventEmitter {
  constructor({ user = 'lab', getPassword, port = 1883, host = '0.0.0.0', now = Date.now } = {}) {
    super();
    Object.assign(this, { user, getPassword, port, host, now });
    this.server = null; this.aedes = null; this.running = false;
    this.clients = new Map(); this.retained = new Map(); this.fails = new Map();
    this.counts = { messages: 0, authRejected: 0, remoteDropped: 0, publishRejected: 0 };
  }

  #blocked(ip) {
    const f = this.fails.get(ip);
    if (!f) return false;
    if (f.until && this.now() < f.until) return true;
    if (f.until) this.fails.delete(ip);
    return false;
  }

  #fail(ip) {
    const t = this.now(), f = this.fails.get(ip) || { times: [] };
    f.times = f.times.filter(x => t - x < LIMITS.authWindowMs); f.times.push(t);
    if (f.times.length >= LIMITS.authFails) { f.until = t + LIMITS.blockMs; f.times = []; }
    this.fails.set(ip, f); this.counts.authRejected++;
  }

  async start() {
    if (this.running) return this.status();
    const deny = (cb, code) => { const e = new Error('not authorized'); e.returnCode = code; cb(e, false); };
    this.aedes = await Aedes.createBroker({
      connectTimeout: LIMITS.connectTimeoutMs,
      maxClientsIdLength: 64,
      authenticate: (client, username, password, cb) => {
        const ip = client.conn && client.conn.remoteAddress || '?';
        if (this.#blocked(ip)) return deny(cb, 5);
        const expected = this.getPassword ? this.getPassword() : null;
        if (!expected || username !== this.user || !password || !samePassword(password.toString('utf8'), expected)) { this.#fail(ip); return deny(cb, 4); }
        this.fails.delete(ip);
        if (client.conn) client.conn.authed = true;
        cb(null, true);
      },
      authorizePublish: (client, packet, cb) => {
        if (!client) return cb(null);                       // published by the app itself
        if (!validTopic(packet.topic) || (packet.payload && packet.payload.length > LIMITS.maxPayload)) { this.counts.publishRejected++; return cb(new Error('publish refused')); }
        cb(null);
      },
    });
    this.aedes.on('client', c => { this.clients.set(c.id, { id: maskId(c.id), address: (c.conn && c.conn.remoteAddress || '').replace(/^::ffff:/, ''), since: this.now() }); this.emit('clients', this.status()); });
    this.aedes.on('clientDisconnect', c => { this.clients.delete(c.id); this.emit('clients', this.status()); });
    this.aedes.on('clientError', () => {}); this.aedes.on('connectionError', () => {});
    this.aedes.on('publish', (packet, client) => {
      const topic = packet.topic;
      if (!topic || topic.startsWith('$')) return;
      const payload = packet.payload ? packet.payload.toString('utf8').slice(0, LIMITS.maxPayload) : '';
      if (packet.retain) {
        if (!payload) this.retained.delete(topic);
        else if (this.retained.has(topic) || this.retained.size < LIMITS.retained) this.retained.set(topic, payload);
      }
      if (!client) return;                                  // do not echo the app's own publishes back as device data
      this.counts.messages++;
      this.emit('message', { topic, payload, retain: false });
    });

    this.server = net.createServer(socket => {
      socket.on('error', () => {});
      if (!isPrivateAddress(socket.remoteAddress)) { this.counts.remoteDropped++; return socket.destroy(); }
      let seen = 0;
      const guard = chunk => { if (socket.authed) return socket.off('data', guard); seen += chunk.length; if (seen > LIMITS.preAuthBytes) socket.destroy(); };
      socket.on('data', guard);
      this.aedes.handle(socket);
    });
    this.server.maxConnections = LIMITS.maxClients;
    await new Promise((resolve, reject) => {
      const onErr = e => reject(Object.assign(new Error(e.code === 'EADDRINUSE' ? 'port in use' : e.message), { code: e.code }));
      this.server.once('error', onErr);
      this.server.listen(this.port, this.host, () => { this.server.off('error', onErr); resolve(); });
    }).catch(async e => { await new Promise(r => this.aedes.close(() => r())); this.aedes = null; this.server = null; throw e; });
    this.port = this.server.address().port;
    this.running = true; this.emit('state', this.status());
    return this.status();
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    await new Promise(r => this.aedes.close(() => r()));
    await new Promise(r => this.server.close(() => r()));
    this.clients.clear(); this.aedes = null; this.server = null;
    this.emit('state', this.status());
  }

  /** Publish from the app (rule engine). Returns false when the topic or payload is refused. */
  publish(topic, payload) {
    if (!this.running || !validTopic(topic) || typeof payload !== 'string' || payload.length > 8192) return false;
    this.aedes.publish({ cmd: 'publish', topic, payload: Buffer.from(payload, 'utf8'), qos: 0, retain: false, dup: false }, () => {});
    return true;
  }

  retainedList() { return [...this.retained].map(([topic, payload]) => ({ topic, payload, retain: true })); }

  status() {
    return { running: this.running, port: this.port, user: this.user, addresses: lanAddresses(), clients: [...this.clients.values()], counts: { ...this.counts } };
  }
}
