// Local language models through Ollama's HTTP API. Pure Node (no Electron imports) so it can be
// tested on its own. The window never talks to the model server directly: it asks this module
// over IPC, and this module only ever calls an address on this computer or the home network.
import net from 'node:net';
import { isPrivateAddress } from './broker.mjs';

export const DEFAULT_URL = 'http://127.0.0.1:11434';

export const MODEL_LIMITS = Object.freeze({
  prompt: 8000,          // characters in one question
  system: 2000,          // characters of instructions
  answerTokens: 1024,    // the most tokens one answer may use
  responseBytes: 2_000_000,
  listTimeoutMs: 4000,
  askTimeoutMs: 180_000, // a large model's first answer includes loading it into memory
});

const NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

/**
 * The model server's base URL, or null when it is not allowed.
 * Allowed: plain http to localhost, a loopback address, or a private (home network) address
 * written as an IP. Other host names are refused so a name cannot later resolve somewhere else.
 */
export function serverUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' || u.username || u.password || u.search || u.hash) return null;
  if (u.pathname !== '/' && u.pathname !== '') return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ok = host === 'localhost' || (net.isIP(host) && isPrivateAddress(host));
  if (!ok) return null;
  return `http://${u.host}`;
}

export const validModelName = n => typeof n === 'string' && NAME.test(n) && !n.includes('..');

/** Turns one entry of Ollama's /api/tags into what the window shows. */
export function describeModel(m) {
  const d = (m && m.details) || {};
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const name = str(m && (m.name || m.model), 120);
  if (!validModelName(name)) return null;
  return { name, size: Number.isFinite(m.size) ? m.size : 0, family: str(d.family, 40), params: str(d.parameter_size, 20), quant: str(d.quantization_level, 20) };
}

/** Reads one Ollama /api/chat reply (stream off) into text and timing. */
export function readAnswer(j, ms) {
  const text = j && j.message && typeof j.message.content === 'string' ? j.message.content : null;
  if (text == null) return { ok: false, error: 'BAD_RESPONSE' };
  const tokens = Number.isFinite(j.eval_count) ? j.eval_count : null;
  const evalNs = Number.isFinite(j.eval_duration) && j.eval_duration > 0 ? j.eval_duration : null;
  const loadNs = Number.isFinite(j.load_duration) ? j.load_duration : null;
  return {
    ok: true, text: text.trim(), ms, tokens,
    tokensPerSec: tokens != null && evalNs ? Math.round((tokens / (evalNs / 1e9)) * 10) / 10 : null,
    loadMs: loadNs != null ? Math.round(loadNs / 1e6) : null,
  };
}

export class Models {
  constructor({ url = DEFAULT_URL, fetch = globalThis.fetch, now = Date.now } = {}) {
    this.fetch = fetch; this.now = now; this.url = serverUrl(url) || DEFAULT_URL;
    this.queue = Promise.resolve();
  }

  setUrl(raw) { const u = serverUrl(raw); if (!u) return false; this.url = u; return true; }

  async #call(path, body, timeoutMs) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await this.fetch(this.url + path, {
        method: body ? 'POST' : 'GET', signal: ctl.signal, redirect: 'error',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (text.length > MODEL_LIMITS.responseBytes) return { error: 'TOO_LARGE' };
      let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
      if (!res.ok) return { error: res.status === 404 ? 'NO_SUCH_MODEL' : 'SERVER_ERROR', detail: j && typeof j.error === 'string' ? j.error.slice(0, 200) : '' };
      return j ? { j } : { error: 'BAD_RESPONSE' };
    } catch (e) {
      return { error: e && e.name === 'AbortError' ? 'TIMEOUT' : 'NOT_RUNNING' };
    } finally { clearTimeout(timer); }
  }

  /** Installed models, or the reason there are none to show. */
  async list() {
    const r = await this.#call('/api/tags', null, MODEL_LIMITS.listTimeoutMs);
    if (r.error) return { ok: false, url: this.url, error: r.error, models: [] };
    const models = (Array.isArray(r.j.models) ? r.j.models : []).map(describeModel).filter(Boolean).slice(0, 200);
    return { ok: true, url: this.url, models };
  }

  /**
   * One question to one model. Questions run one after another, because a laptop GPU holds
   * one model at a time; running them together would only make every answer slower.
   */
  ask({ model, prompt, system = '', maxTokens = 512 } = {}) {
    if (!validModelName(model)) return Promise.resolve({ ok: false, error: 'BAD_MODEL' });
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MODEL_LIMITS.prompt) return Promise.resolve({ ok: false, error: 'BAD_PROMPT' });
    if (typeof system !== 'string' || system.length > MODEL_LIMITS.system) return Promise.resolve({ ok: false, error: 'BAD_PROMPT' });
    const tokens = Math.max(16, Math.min(MODEL_LIMITS.answerTokens, Math.floor(Number(maxTokens) || 512)));
    const run = async () => {
      const messages = system.trim() ? [{ role: 'system', content: system }, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
      const t0 = this.now();
      const r = await this.#call('/api/chat', { model, messages, stream: false, options: { num_predict: tokens } }, MODEL_LIMITS.askTimeoutMs);
      if (r.error) return { ok: false, error: r.error, detail: r.detail || '' };
      return readAnswer(r.j, this.now() - t0);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
}
