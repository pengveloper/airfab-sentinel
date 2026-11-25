// 데스크톱 앱 연기 시험: 실제 Electron 창을 띄워 첫 실행부터 메시지 수신까지 확인합니다.
// 실행:  npm run test:app   (Linux에서는 화면이 필요합니다: xvfb-run -a npm run test:app)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mqtt from 'mqtt';
import { _electron } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'smoke'); fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-lab-'));
const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const linux = process.platform === 'linux';
const args = [...(linux ? ['--no-sandbox', '--password-store=basic', '--use-angle=swiftshader'] : []), '--enable-unsafe-swiftshader', root, `--user-data-dir=${userData}`];
const ID = 'a1b2c3d4e5f60718';
// 화면 기록은 참고용입니다. GPU가 없는 빌드 서버에서는 3D 장면 캡처가 느릴 수 있어, 실패해도 시험 결과에는 넣지 않습니다.
const shot = async (win, name) => { try { await win.screenshot({ path: path.join(out, name), timeout: 15_000 }); } catch { console.log(`note screenshot skipped: ${name}`); } };
const step = (name, ok = true) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const tryConnect = password => new Promise(resolve => {
  const c = mqtt.connect(`mqtt://127.0.0.1:${port}`, { username: 'lab', password, reconnectPeriod: 0, connectTimeout: 4000, clientId: 'espresense-a1b2c3d4e5f6' });
  c.once('connect', () => resolve(c)); c.once('error', () => { c.end(true); resolve(null); });
});

const app = await _electron.launch({ args, cwd: root, env: { ...process.env, SENTINEL_MQTT_PORT: String(port), ...(linux ? { SENTINEL_DEV_BASIC_STORE: '1' } : {}) }, timeout: 60_000 });
let failed = false;
try {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForFunction(() => window.Lab && window.Desk && window.Desk.status(), null, { timeout: 20_000 });

  // 1. 창의 격리 상태
  const iso = await win.evaluate(async () => ({ url: location.href, require: typeof window.require, process: typeof window.process, bridge: Object.keys(window.desktop).sort(),
    csp: (await fetch('index.html')).headers.get('content-security-policy'), outside: await fetch('app://sentinel/../package.json').then(r => r.status, () => 0) }));
  assert.equal(iso.url, 'app://sentinel/index.html'); assert.equal(iso.require, 'undefined'); assert.equal(iso.process, 'undefined');
  assert.ok(iso.csp.includes("script-src 'self'") && iso.csp.includes("object-src 'none'")); assert.notEqual(iso.outside, 200);
  assert.deepEqual(iso.bridge, ['copy', 'info', 'onBroker', 'onMessage', 'publish', 'replayRetained', 'restart', 'revealPassword', 'setup', 'status', 'suggestPassword']);
  step('window is isolated: no Node, fixed bridge, CSP header, no path escape');

  // 2. 첫 실행: 비밀번호를 정하기 전에는 브로커가 꺼져 있다
  await win.waitForSelector('#setup:not([hidden])', { state: 'attached', timeout: 20_000 });
  assert.equal((await win.evaluate(() => window.desktop.status())).running, false);
  assert.equal(await tryConnect('anything-at-all'), null);
  await win.waitForTimeout(2600); await shot(win, '01-setup.png');
  await win.click('#su-gen'); await win.waitForFunction(() => document.querySelector('#su-pass').value.length === 20);
  const password = await win.inputValue('#su-pass');
  await win.click('#su-go');
  await win.waitForFunction(() => window.Desk.status() && window.Desk.status().running, null, { timeout: 15_000 });
  await win.waitForSelector('#desk:not([hidden])'); await win.waitForTimeout(600); await shot(win, '02-broker.png');
  const saved = fs.readFileSync(path.join(userData, 'settings.json'), 'utf8');
  assert.ok(!saved.includes(password), 'the password must not be stored in clear text');
  step('first run: broker starts only after a password is set, and the password is not stored in clear text');
  await win.click('#dk-close');

  // 3. 인증
  assert.equal(await tryConnect('wrong-password-123'), null);
  const board = await tryConnect(password); assert.ok(board, 'correct password connects');
  const commands = [], alerts = []; board.on('message', (topic, p) => { if (topic === 'wled/lab/api') commands.push(p.toString()); else if (topic === 'lab/out/notify') alerts.push(p.toString()); });
  await new Promise(r => board.subscribe(['wled/lab/api', 'lab/out/notify'], r));
  step('authentication: wrong password rejected, correct password accepted');

  // 창 조작 버튼(최소화, 닫기)이 차지하는 영역 밖에 브로커 버튼이 있어야 누를 수 있습니다. 좁은 화면에서도 마찬가지입니다.
  const fit = await win.evaluate(() => { const o = navigator.windowControlsOverlay, r = document.querySelector('#openConn').getBoundingClientRect(), area = o && o.visible ? o.getTitlebarAreaRect() : null;
    return { left: r.left, right: r.right, limit: area ? area.x + area.width : innerWidth, width: innerWidth }; });
  assert.ok(fit.left >= 0 && fit.right <= fit.limit + 1, `hub button must stay clear of the window controls: ${JSON.stringify(fit)}`);
  step(`top bar fits a ${fit.width}px wide window`);

  // 4. 보드 메시지가 화면까지
  await win.waitForFunction(() => Lab.S.source === 'live', null, { timeout: 10_000 });
  await win.waitForSelector('#sp-empty:not([hidden])', { state: 'attached', timeout: 20_000 });
  const box = await win.evaluate(() => { const r = document.querySelector('#sp-empty').getBoundingClientRect(), v = document.querySelector('#v-space').getBoundingClientRect(); return { empty: [Math.round(r.width), Math.round(r.height)], view: [Math.round(v.width), Math.round(v.height)], hash: location.hash, visibility: document.visibilityState }; });
  console.log('note waiting-state layout:', JSON.stringify(box));
  assert.ok(box.empty[0] > 0 && box.empty[1] > 0, 'the waiting-for-boards message must have a size');
  await shot(win, '03-waiting.png');
  board.publish(`espectre/v1/devices/${ID}/sensing`, JSON.stringify({ threshold: 0.5 }), { retain: true });
  for (const r of ['office', 'living', 'entry']) board.publish(`espresense/rooms/${r}/status`, 'online');
  let t = 0; const timer = setInterval(() => { t += 0.2; const burst = (t % 6) > 3;
    board.publish(`espectre/v1/devices/${ID}/motion`, JSON.stringify({ timestamp_ms: Math.round(t * 1000), state: burst ? 'motion' : 'idle', score: burst ? 1.2 + Math.random() * 0.2 : 0.1 + Math.random() * 0.05 }));
    ['office', 'living', 'entry'].forEach((r, i) => board.publish(`espresense/devices/tag1/${r}`, JSON.stringify({ id: 'tag1', name: 'tag', distance: 2 + i, rssi: -60 }))); }, 200);
  await win.waitForFunction(() => Lab.S.csi.size === 1 && Lab.S.rooms.size === 3 && Lab.cfg.bring.csi && Lab.cfg.bring.rooms && Lab.cfg.bring.rooms.list.length === 3, null, { timeout: 15_000 });
  const seen = await win.evaluate(() => ({ source: Lab.S.source, sim: Lab.S.simEver, bring: Object.keys(Lab.cfg.bring).sort(), clients: window.Desk.status().clients }));
  assert.equal(seen.source, 'live'); assert.equal(seen.sim, false); assert.deepEqual(seen.bring, ['broker', 'csi', 'rooms']);
  assert.equal(seen.clients[0].id, 'espres…');
  await win.waitForTimeout(5000); await shot(win, '04-live.png');
  step('board messages reach the window; first-measurement steps fill in; client id is masked');

  // 5. 규칙이 보낸 명령이 기기에게 도달
  for (let i = 0; i < 100 && !commands.length; i++) await new Promise(r => setTimeout(r, 250));   // 규칙은 움직임이 시작될 때 실행됩니다
  const got = commands[0] || null;
  assert.ok(got && JSON.parse(got).seg, 'a rule command arrives as WLED JSON');
  step('rule engine command is delivered to devices');

  // 5-1. 알림: 구독한 기기(안경·휴대폰 앱 자리)에 정해진 꼴로 도착하고, 기기가 꾸며 낸 알림은 어디에도 가지 않는다
  for (let i = 0; i < 40 && !alerts.length; i++) await new Promise(r => setTimeout(r, 250));
  const alert = alerts[0] ? JSON.parse(alerts[0]) : null;
  assert.ok(alert && alert.v === 1 && alert.kind === 'motion' && alert.source === 'broker', 'a motion alert arrives as v1 JSON labelled as broker data');
  assert.ok(!alerts[0].includes(ID), 'the alert carries no full device id');
  const before = alerts.length; board.publish('lab/out/notify', JSON.stringify({ v: 1, title: 'forged' })); await new Promise(r => setTimeout(r, 600));
  assert.ok(!alerts.slice(before).some(a => a.includes('forged')), 'a device cannot publish an alert');
  await win.click('#tab-rules'); await win.waitForFunction(() => /움직임$/.test(document.querySelector('#ntl-title').textContent), null, { timeout: 5000 });   // 자동화 화면의 미리보기에도 같은 문장이 뜬다
  await win.evaluate(() => Glass.open()); await win.waitForTimeout(500);
  const glass = await win.evaluate(() => ({ open: Glass.isOpen(), state: document.querySelector('#gl-state').textContent, src: document.querySelector('#gl-src').textContent }));
  assert.equal(glass.open, true); assert.ok(['움직임', '조용함'].includes(glass.state)); assert.equal(glass.src, '실측');
  await shot(win, '04-glass.png'); await win.keyboard.press('Escape');
  await win.waitForFunction(() => !Glass.isOpen(), null, { timeout: 5000 });
  step('alerts reach a subscriber as v1 JSON, cannot be forged by a device, and the glasses screen opens and closes');
  clearInterval(timer); board.end(true);

  // 6. 화면 기록 (데모)
  await win.click('#openConn'); await win.click('#dk-demo'); await win.click('#tab-space'); await win.waitForTimeout(9000); await shot(win, '05-demo-space.png');
  assert.ok(await win.evaluate(() => document.querySelectorAll('#sp-feed li').length >= 3 && !document.querySelector('#v-space').hidden), 'the space view is showing its event list');
  const dim = await win.evaluate(async () => { let min = 1; for (let i = 0; i < 8; i++) { for (const li of [...document.querySelectorAll('#sp-feed li')].slice(1, 4)) min = Math.min(min, +getComputedStyle(li).opacity); await new Promise(r => setTimeout(r, 80)); } return min; });
  assert.equal(dim, 1, 'event list rows stay fully visible between updates');   // 같은 내용을 다시 그려 목록이 깜빡이던 문제의 재발 방지
  for (const v of ['motion', 'presence', 'rules', 'nodes', 'evidence']) { await win.click('#tab-' + v); await win.waitForTimeout(1200); await shot(win, `06-${v}.png`); }
  step('demo views open without errors');
  // 7. 창은 밖으로 나가지 못한다
  await win.evaluate(() => { try { location.href = 'https://example.com/'; } catch (e) { /* blocked */ } }); await win.waitForTimeout(800);
  assert.equal(win.url().startsWith('app://sentinel/'), true);
  assert.equal(await win.evaluate(() => window.open('https://example.com/') === null), true);
  assert.equal(app.windows().length, 1);
  step('navigation and new windows are blocked');

} catch (e) { failed = true; console.error(e);
  // 실패했을 때 원인을 좁힐 수 있도록 창의 상태를 남깁니다.
  try { const w = await app.firstWindow(); console.log('state at failure:', JSON.stringify(await w.evaluate(() => ({ setupHidden: document.querySelector('#setup').hidden, emptyHidden: document.querySelector('#sp-empty').hidden, csi: window.Lab && Lab.S.csi.size, rooms: window.Lab && Lab.S.rooms.size, devs: window.Lab && Lab.S.devs.size, deskHidden: document.querySelector('#desk').hidden, source: window.Lab && Lab.S.source, status: window.Desk && window.Desk.status(), size: [innerWidth, innerHeight], visibility: document.visibilityState, body: document.body.className })))); } catch { /* ignore */ }
  try { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); } catch { /* ignore */ } }
await app.close().catch(() => {});
await new Promise(r => setTimeout(r, 1000));
try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* 임시 폴더는 운영체제가 치웁니다 */ }
process.exit(failed ? 1 : 0);
