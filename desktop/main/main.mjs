// Wavrel desktop: one window, one embedded MQTT hub.
// Security posture: the window is sandboxed, loads only files shipped with the app through
// app://wavrel, cannot navigate away or open windows, and talks to this process over a
// short list of validated IPC calls.
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, clipboard, ipcMain, protocol, session, shell } from 'electron';
import { Hub } from './broker.mjs';
import * as store from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'app://wavrel/';
const ROOT = () => path.join(app.getAppPath(), 'console');
const EXTERNAL = new Set(['espectre.dev', 'espresense.com', 'tasmota.github.io', 'templates.blakadder.com', 'github.com', 'mosquitto.org']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "font-src 'self'",
  "img-src 'self' data: blob: http: https:",   // http: is for a camera stream on the LAN
  "connect-src 'self' ws: wss:", "frame-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, supportFetchAPI: true } }]);

// Wavrel was called Sentinel Lab, and Electron names the data folder after the product. When this
// computer has settings from the old name and none under the new one, keep using the old folder:
// on Windows the hub password is sealed with a key kept in that folder, so moving only settings.json
// would lose it.
// An explicit --user-data-dir always wins.
const legacyData = path.join(app.getPath('appData'), 'Sentinel Lab');
if (!app.commandLine.hasSwitch('user-data-dir') && !existsSync(path.join(app.getPath('userData'), 'settings.json'))
  && existsSync(path.join(legacyData, 'settings.json'))) app.setPath('userData', legacyData);

let win = null;
const port = Number(process.env.WAVREL_MQTT_PORT) || 1883;
const hub = new Hub({ port, getPassword: () => store.getPassword() });
const send = (channel, data) => { if (win && !win.isDestroyed()) win.webContents.send(channel, data); };
const publicStatus = () => ({ ...hub.status(), hasPassword: store.hasPassword(), error: lastError });
let lastError = null;

hub.on('message', m => send('mqtt:message', m));
hub.on('clients', () => send('broker:state', publicStatus()));
hub.on('state', () => send('broker:state', publicStatus()));

async function startHub() {
  lastError = null;
  try { await hub.start(); } catch (e) { lastError = e.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'START_FAILED'; }
  send('broker:state', publicStatus());
  return publicStatus();
}

function openExternal(url) {
  try { const u = new URL(url); if (u.protocol === 'https:' && EXTERNAL.has(u.hostname)) shell.openExternal(u.toString()); } catch { /* ignore */ }
}

async function serve(request) {
  const url = new URL(request.url);
  if (url.host !== 'wavrel' || request.method !== 'GET') return new Response('', { status: 404 });
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(ROOT(), rel));
  if (!file.startsWith(ROOT() + path.sep)) return new Response('', { status: 403 });
  try {
    const body = await fs.readFile(file);
    return new Response(body, { headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' } });
  } catch { return new Response('', { status: 404 }); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 420, minHeight: 600, show: false, backgroundColor: '#05080d',
    title: 'Wavrel', icon: path.join(HERE, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#05080d', symbolColor: '#c9d3df', height: 44 },
    webPreferences: { preload: path.join(HERE, '..', 'preload', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false, devTools: !app.isPackaged },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  win.loadURL(ORIGIN + 'index.html');
}

const trusted = event => { try { return event.senderFrame === event.sender.mainFrame && event.senderFrame.url.startsWith(ORIGIN); } catch { return false; } };
const handle = (channel, fn) => ipcMain.handle(channel, (event, arg) => { if (!trusted(event)) throw new Error('untrusted sender'); return fn(arg); });

function wireIpc() {
  handle('app:info', () => ({ name: app.getName(), version: app.getVersion(), platform: process.platform, packaged: app.isPackaged }));
  handle('broker:status', () => publicStatus());
  handle('broker:suggest', () => store.suggestPassword());
  handle('broker:setup', async password => {
    try { store.setPassword(password); } catch (e) { return { ...publicStatus(), error: e.code || 'INVALID' }; }
    await hub.stop(); return startHub();
  });
  handle('broker:reveal', () => store.getPassword());
  handle('broker:restart', async () => { await hub.stop(); return startHub(); });
  handle('mqtt:replay', () => hub.retainedList());
  handle('mqtt:publish', arg => !!arg && hub.publish(arg.topic, arg.payload));
  handle('clipboard:write', text => { if (typeof text === 'string' && text.length <= 200_000) { clipboard.writeText(text); return true; } return false; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (event, url) => { if (!url.startsWith(ORIGIN)) { event.preventDefault(); openExternal(url); } });
    contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    contents.on('will-attach-webview', event => event.preventDefault());
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', serve);
    // The page may go full screen (presentation mode) and reach a camera on the LAN. Nothing else.
    const allowed = new Set(['fullscreen', 'local-network', 'local-network-access', 'loopback-network']);
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.has(permission) && wc.getURL().startsWith(ORIGIN)));
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && String(origin).startsWith('app://wavrel'));
    wireIpc();
    createWindow();
    if (store.hasPassword()) await startHub();
  });
  app.on('window-all-closed', async () => { await hub.stop().catch(() => {}); app.quit(); });
}
