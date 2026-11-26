// Settings and the broker password. The password is encrypted with the OS credential
// protection (DPAPI on Windows) through Electron's safeStorage and never written in clear text.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app, safeStorage } from 'electron';

const file = () => path.join(app.getPath('userData'), 'settings.json');
let cache;

function load() { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; } }
function save(obj) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file());
}

// Windows uses DPAPI and macOS the Keychain. Linux desktops without a keyring have no secure
// backend; a developer can opt in to Chromium's weaker fallback there with an environment flag.
// The flag does nothing on Windows or macOS.
function secure() {
  if (safeStorage.isEncryptionAvailable()) return true;
  if (process.platform === 'linux' && process.env.WAVREL_DEV_BASIC_STORE === '1') { safeStorage.setUsePlainTextEncryption(true); return safeStorage.isEncryptionAvailable(); }
  return false;
}

export const PASSWORD_RULE = /^[A-Za-z0-9!@#$%^&*_\-+=.]{10,64}$/;

export function hasPassword() { return getPassword() != null; }

export function getPassword() {
  if (cache !== undefined) return cache;
  const enc = load().passwordEnc;
  cache = null;
  if (enc && secure()) { try { cache = safeStorage.decryptString(Buffer.from(enc, 'base64')); } catch { cache = null; } }
  return cache;
}

export function setPassword(pw) {
  if (typeof pw !== 'string' || !PASSWORD_RULE.test(pw)) throw Object.assign(new Error('invalid password'), { code: 'INVALID' });
  if (!secure()) throw Object.assign(new Error('secure storage unavailable'), { code: 'NO_SECURE_STORAGE' });
  const s = load(); s.passwordEnc = safeStorage.encryptString(pw).toString('base64'); save(s); cache = pw;
}

/** 20 characters without look-alikes (no 0/O, 1/l/I), from the OS random source. */
export function suggestPassword() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 20 }, () => abc[crypto.randomInt(abc.length)]).join('');
}

/** Where the local model server (Ollama) listens. Not a secret; checked again by models.mjs. */
export function getModelUrl() { const v = load().modelUrl; return typeof v === 'string' ? v : undefined; }
export function setModelUrl(url) { const s = load(); s.modelUrl = String(url).slice(0, 200); save(s); }

/**
 * The relay server link (desktop/main/link.mjs): its address in clear, the PC token sealed like
 * the hub password. getLink() returns the token only to the main process.
 */
export function getLink() {
  const s = load();
  let token = null;
  if (s.linkTokenEnc && secure()) { try { token = safeStorage.decryptString(Buffer.from(s.linkTokenEnc, 'base64')); } catch { token = null; } }
  return { url: typeof s.linkUrl === 'string' ? s.linkUrl : null, token };
}

/** A missing token keeps the one already saved. */
export function setLink(url, token) {
  const s = load();
  if (token) {
    if (!secure()) throw Object.assign(new Error('secure storage unavailable'), { code: 'NO_SECURE_STORAGE' });
    s.linkTokenEnc = safeStorage.encryptString(token).toString('base64');
  }
  s.linkUrl = String(url).slice(0, 300);
  save(s);
}

export function clearLink() { const s = load(); delete s.linkUrl; delete s.linkTokenEnc; save(s); }
