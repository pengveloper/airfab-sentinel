// Takes one still picture from the camera on the LAN for a vision model. Runs in the main
// process: the window never fetches the picture itself, and the picture goes only to the model
// server on this PC or the home network, never through the relay server.
import { isPrivateAddress } from './broker.mjs';
import net from 'node:net';

export const CAMERA_LIMITS = Object.freeze({ bytes: 3_000_000, timeoutMs: 6000 });

/**
 * The still-picture address for a camera, from what the Camera view holds. Tasmota's webcam
 * firmware streams on :81/stream and serves a still at /snapshot.jpg on port 80, so a stream
 * address is turned into the still address. Only plain HTTP to a private IP literal is accepted.
 */
export function snapshotUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' || u.username || u.password || u.hash) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!net.isIP(host) || !isPrivateAddress(host)) return null;
  if (u.port === '81' && /^\/stream\/?$/.test(u.pathname)) { u.port = ''; u.pathname = '/snapshot.jpg'; u.search = ''; }
  else if (!/\.(jpe?g)$/i.test(u.pathname) && !/snapshot|capture|still/i.test(u.pathname)) { u.pathname = '/snapshot.jpg'; u.search = ''; }
  return u.toString();
}

const isJpeg = b => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;

/** Resolves with { ok: true, b64, bytes, url } or { ok: false, error: BAD_URL | UNREACHABLE | TIMEOUT | TOO_LARGE | NOT_JPEG }. */
export async function takeSnapshot(raw, { fetch = globalThis.fetch, timeoutMs = CAMERA_LIMITS.timeoutMs } = {}) {
  const url = snapshotUrl(raw);
  if (!url) return { ok: false, error: 'BAD_URL' };
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: 'error', cache: 'no-store' });
    if (!r.ok) return { ok: false, error: 'UNREACHABLE', url };
    const len = Number(r.headers.get('content-length') || 0);
    if (len > CAMERA_LIMITS.bytes) return { ok: false, error: 'TOO_LARGE', url };
    const chunks = []; let size = 0, tooLarge = false;
    for await (const c of r.body) { size += c.length; if (size > CAMERA_LIMITS.bytes) { tooLarge = true; break; } chunks.push(c); }
    if (tooLarge) return { ok: false, error: 'TOO_LARGE', url };
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    if (!isJpeg(buf)) return { ok: false, error: 'NOT_JPEG', url };
    return { ok: true, b64: buf.toString('base64'), bytes: buf.length, url };
  } catch (e) {
    return { ok: false, error: ac.signal.aborted ? 'TIMEOUT' : 'UNREACHABLE', url };
  } finally { clearTimeout(timer); }
}
