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
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wavrel-'));
const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const linux = process.platform === 'linux';
const common = [...(linux ? ['--no-sandbox', '--password-store=basic', '--use-angle=swiftshader'] : []), '--enable-unsafe-swiftshader'];
const args = [...common, '--lang=ko', root, `--user-data-dir=${userData}`];   // 화면 언어는 기기 언어를 따르므로, 한국어 문장을 확인하는 첫 실행은 한국어로 띄웁니다
const ID = 'a1b2c3d4e5f60718';
// 창을 다루는 동작은 모두 창 안에서 직접 실행합니다.
// Windows 빌드 서버에서는 시험 도구가 창이 열리는 순간을 놓치는 일이 있었고, 그러면 도구의 누르기와 기다림이 창은 멀쩡한데도 끝나지 않았습니다.
// 창 안에서 식을 실행하는 길은 그때도 동작했으므로, 조건 기다리기와 누르기를 그 길 위에 다시 만들었습니다.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const drive = page => ({
  async until(fn, arg, timeout = 20_000) { const end = Date.now() + timeout; let last = null;
    for (;;) { try { const v = await page().evaluate(fn, arg); if (v) return v; } catch (e) { last = e; }
      if (Date.now() > end) throw new Error('timed out waiting for ' + String(fn).replace(/\s+/g, ' ').slice(0, 160) + (arg == null ? '' : ' with ' + JSON.stringify(arg)) + (last ? ' (' + String(last.message).slice(0, 120) + ')' : ''));
      await sleep(150); } },
  present(sel, timeout) { return this.until(q => !!document.querySelector(q), sel, timeout); },
  // 누르기 전에, 그 자리에 정말 그 요소가 보이고 다른 것에 가려지지 않았는지 확인합니다
  async click(sel) {
    await this.until(q => { const e = document.querySelector(q); if (!e || e.disabled) return false; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false;
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return top === e || e.contains(top); }, sel, 30_000);
    await page().evaluate(q => { document.querySelector(q).click(); }, sel).catch(() => { /* 누르면 화면이 새로 열리는 버튼 */ }); },
  key(k) { return page().evaluate(key => { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }, k); },
});
// 화면 기록은 참고용입니다. GPU가 없는 빌드 서버에서는 3D 장면 캡처가 느릴 수 있어, 실패해도 시험 결과에는 넣지 않습니다.
const shot = async (win, name) => { try { await win.screenshot({ path: path.join(out, name), timeout: 15_000 }); } catch { console.log(`note screenshot skipped: ${name}`); } };
const step = (name, ok = true) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const tryConnect = password => new Promise(resolve => {
  const c = mqtt.connect(`mqtt://127.0.0.1:${port}`, { username: 'lab', password, reconnectPeriod: 0, connectTimeout: 8000, clientId: 'espresense-a1b2c3d4e5f6' });
  c.once('connect', () => resolve(c)); c.once('error', () => { c.end(true); resolve(null); });
});

const app = await _electron.launch({ args, cwd: root, env: { ...process.env, LANGUAGE: 'ko', WAVREL_MQTT_PORT: String(port), ...(linux ? { WAVREL_DEV_BASIC_STORE: '1' } : {}) }, timeout: 60_000 });
let failed = false;
try {
  let win = await app.firstWindow(); const ui = drive(() => win);
  await ui.until(() => document.readyState !== 'loading', null, 90_000);   // 빌드 서버에서는 첫 화면(3D 장면 준비 포함)이 뜨는 데 오래 걸릴 때가 있습니다
  const ready = () => ui.until(() => window.Lab && window.I18N && window.Desk && window.Desk.status(), null, 90_000);
  // 언어를 바꾸면 화면이 새로 열립니다. Windows에서는 그 뒤로 처음 잡아 둔 창 객체의 기다림이 끝나지 않는 일이 있어,
  // 열려 있는 창을 직접 물어 원하는 언어로 돌아온 창을 다시 잡습니다.
  const settle = async lang => { const end = Date.now() + 45_000;
    for (;;) { for (const w of app.windows()) { try { if (await w.evaluate(l => !!(window.I18N && I18N.lang === l && window.Lab && window.Desk && window.Desk.status()), lang)) return w; } catch { /* 다시 여는 중 */ } }
      if (Date.now() > end) throw new Error('the window did not come back in ' + lang); await new Promise(r => setTimeout(r, 300)); } };
  await ready();
  // --lang이 듣지 않는 환경에서는 화면 안에서 한국어로 바꿉니다.
  const langState = () => win.evaluate(() => ({ lang: window.I18N && I18N.lang, saved: (() => { try { return localStorage.getItem('wavrel-lang'); } catch (e) { return 'unavailable: ' + e.name; } })(), system: navigator.language, search: location.search }));
  if ((await langState()).lang !== 'ko') {
    await win.evaluate(() => { I18N.set('ko'); }).catch(() => {}); win = await settle('ko');
    const st = await langState(); console.log('note started in English, switched to Korean: ' + JSON.stringify(st));
    assert.equal(st.lang, 'ko'); assert.equal(st.search, '', 'the language parameter is removed from the address once applied');
  }

  console.log('note 3D scene: ' + (await win.evaluate(() => (window.Space && Space.ok) ? 'WebGL' : '2D fallback')));
  // 1. 창의 격리 상태
  const iso = await win.evaluate(async () => ({ url: location.href, require: typeof window.require, process: typeof window.process, bridge: Object.keys(window.desktop).sort(),
    csp: (await fetch('index.html')).headers.get('content-security-policy'), outside: await fetch('app://wavrel/../package.json').then(r => r.status, () => 0) }));
  assert.equal(iso.url, 'app://wavrel/index.html'); assert.equal(iso.require, 'undefined'); assert.equal(iso.process, 'undefined');
  assert.ok(iso.csp.includes("script-src 'self'") && iso.csp.includes("object-src 'none'")); assert.notEqual(iso.outside, 200);
  assert.deepEqual(iso.bridge, ['copy', 'info', 'onBroker', 'onMessage', 'publish', 'replayRetained', 'restart', 'revealPassword', 'setup', 'status', 'suggestPassword']);
  step('window is isolated: no Node, fixed bridge, CSP header, no path escape');

  // 2. 첫 실행: 비밀번호를 정하기 전에는 브로커가 꺼져 있다
  await ui.present('#setup:not([hidden])', 20_000);
  assert.equal((await win.evaluate(() => window.desktop.status())).running, false);
  assert.equal(await tryConnect('anything-at-all'), null);
  await sleep(2600); await shot(win, '01-setup.png');
  await ui.click('#su-gen'); await ui.until(() => document.querySelector('#su-pass').value.length === 20);
  const password = await win.evaluate(() => document.querySelector('#su-pass').value);
  await ui.click('#su-go');
  await ui.until(() => window.Desk.status() && window.Desk.status().running, null, 15_000);
  await ui.present('#desk:not([hidden])'); await sleep(600); await shot(win, '02-broker.png');
  const saved = fs.readFileSync(path.join(userData, 'settings.json'), 'utf8');
  assert.ok(!saved.includes(password), 'the password must not be stored in clear text');
  step('first run: broker starts only after a password is set, and the password is not stored in clear text');
  await ui.click('#dk-close');

  // 3. 인증
  // 연결이 안 된 것과 허브가 거절한 것을 구분합니다: 틀린 비밀번호는 허브의 거절 횟수가 실제로 늘어야 통과입니다.
  const rejected = async () => (await win.evaluate(() => window.desktop.status())).counts.authRejected;
  const rejectedAtStart = await rejected(); let refused = false;
  for (let i = 0; i < 3 && !refused; i++) { assert.equal(await tryConnect('wrong-password-123'), null, 'a wrong password never connects'); refused = await rejected() > rejectedAtStart; }
  assert.ok(refused, 'the hub itself rejected the wrong password');
  let board = null; for (let i = 0; i < 3 && !board; i++) board = await tryConnect(password);   // 빌드 서버에서 첫 연결이 늦는 일이 있어 다시 시도합니다
  assert.ok(board, 'correct password connects');
  const commands = [], alerts = []; board.on('message', (topic, p) => { if (topic === 'wled/lab/api') commands.push(p.toString()); else if (topic === 'lab/out/notify') alerts.push(p.toString()); });
  await new Promise(r => board.subscribe(['wled/lab/api', 'lab/out/notify'], r));
  step('authentication: wrong password rejected, correct password accepted');

  // 창 조작 버튼(최소화, 닫기)이 차지하는 영역 밖에 브로커 버튼이 있어야 누를 수 있습니다. 좁은 화면에서도 마찬가지입니다.
  const fit = await win.evaluate(() => { const o = navigator.windowControlsOverlay, r = document.querySelector('#openConn').getBoundingClientRect(), area = o && o.visible ? o.getTitlebarAreaRect() : null;
    return { left: r.left, right: r.right, limit: area ? area.x + area.width : innerWidth, width: innerWidth }; });
  assert.ok(fit.left >= 0 && fit.right <= fit.limit + 1, `hub button must stay clear of the window controls: ${JSON.stringify(fit)}`);
  step(`top bar fits a ${fit.width}px wide window`);

  // 4. 보드 메시지가 화면까지
  await ui.until(() => Lab.S.source === 'live', null, 10_000);
  await ui.present('#sp-empty:not([hidden])', 20_000);
  const box = await win.evaluate(() => { const r = document.querySelector('#sp-empty').getBoundingClientRect(), v = document.querySelector('#v-space').getBoundingClientRect(); return { empty: [Math.round(r.width), Math.round(r.height)], view: [Math.round(v.width), Math.round(v.height)], hash: location.hash, visibility: document.visibilityState }; });
  console.log('note waiting-state layout:', JSON.stringify(box));
  assert.ok(box.empty[0] > 0 && box.empty[1] > 0, 'the waiting-for-boards message must have a size');
  await shot(win, '03-waiting.png');
  board.publish(`espectre/v1/devices/${ID}/sensing`, JSON.stringify({ threshold: 0.5 }), { retain: true });
  for (const r of ['office', 'living', 'entry']) board.publish(`espresense/rooms/${r}/status`, 'online');
  let t = 0; const timer = setInterval(() => { t += 0.2; const burst = (t % 6) > 3;
    board.publish(`espectre/v1/devices/${ID}/motion`, JSON.stringify({ timestamp_ms: Math.round(t * 1000), state: burst ? 'motion' : 'idle', score: burst ? 1.2 + Math.random() * 0.2 : 0.1 + Math.random() * 0.05 }));
    ['office', 'living', 'entry'].forEach((r, i) => board.publish(`espresense/devices/tag1/${r}`, JSON.stringify({ id: 'tag1', name: 'tag', distance: 2 + i, rssi: -60 }))); }, 200);
  await ui.until(() => Lab.S.csi.size === 1 && Lab.S.rooms.size === 3 && Lab.cfg.bring.csi && Lab.cfg.bring.rooms && Lab.cfg.bring.rooms.list.length === 3, null, 15_000);
  const seen = await win.evaluate(() => ({ source: Lab.S.source, sim: Lab.S.simEver, bring: Object.keys(Lab.cfg.bring).sort(), clients: window.Desk.status().clients }));
  assert.equal(seen.source, 'live'); assert.equal(seen.sim, false); assert.deepEqual(seen.bring, ['broker', 'csi', 'rooms']);
  assert.equal(seen.clients[0].id, 'espres…');
  await sleep(5000); await shot(win, '04-live.png');
  step('board messages reach the window; first-measurement steps fill in; client id is masked');

  // 5. 규칙이 보낸 명령이 기기에게 도달
  for (let i = 0; i < 100 && !commands.length; i++) await new Promise(r => setTimeout(r, 250));   // 규칙은 움직임이 시작될 때 실행됩니다
  const got = commands[0] || null;
  assert.ok(got && JSON.parse(got).seg, 'a rule command arrives as WLED JSON');
  // 앱이 보낸 명령은 화면의 LED 표시와 기록에도 남아야 한다 (웹 콘솔에서 브로커가 되돌려 줄 때와 같게)
  // 기록에 남은 마지막 LED 명령을 기준으로 봅니다. LED 표시는 8초 뒤 꺼지므로, 그보다 최근 명령이면 켜져 있어야 합니다.
  // (Windows 빌드 서버에서는 창 안의 평가 한 번이 수 초 걸릴 때가 있어, 켜져 있는 순간을 잡는 방식은 우연에 기댑니다)
  const led = await ui.until(() => { const e = [...Lab.S.log].reverse().find(l => l.topic === Lab.cfg.led.topic); if (!e) return null;
    return { age: Date.now() - Date.parse(e.t), lit: Array.isArray(Lab.S.led.color) && Lab.S.led.color.length === 3, logged: Lab.S.log.filter(l => l.topic === Lab.cfg.led.topic).length }; }, null, 30_000);
  assert.ok(led.logged >= 1, 'the LED command is in the log');
  assert.ok(led.lit || led.age > 7000, 'a recent LED command lights the console LED: ' + JSON.stringify(led));
  step('rule engine command is delivered to devices and shows on the console LED and in the log');

  // 5-1. 알림: 구독한 기기(안경·휴대폰 앱 자리)에 정해진 꼴로 도착하고, 기기가 꾸며 낸 알림은 어디에도 가지 않는다
  for (let i = 0; i < 40 && !alerts.length; i++) await new Promise(r => setTimeout(r, 250));
  const alert = alerts[0] ? JSON.parse(alerts[0]) : null;
  assert.ok(alert && alert.v === 1 && alert.kind === 'motion' && alert.source === 'broker', 'a motion alert arrives as v1 JSON labelled as broker data');
  assert.ok(!alerts[0].includes(ID), 'the alert carries no full device id');
  const before = alerts.length; board.publish('lab/out/notify', JSON.stringify({ v: 1, title: 'forged' })); await new Promise(r => setTimeout(r, 600));
  assert.ok(!alerts.slice(before).some(a => a.includes('forged')), 'a device cannot publish an alert');
  await ui.click('#tab-rules'); await ui.until(() => /움직임$/.test(document.querySelector('#ntl-title').textContent), null, 5000);   // 자동화 화면의 미리보기에도 같은 문장이 뜬다
  await win.evaluate(() => Glass.open()); await sleep(500);
  const glass = await win.evaluate(() => ({ open: Glass.isOpen(), state: document.querySelector('#gl-state').textContent, src: document.querySelector('#gl-src').textContent }));
  assert.equal(glass.open, true); assert.ok(['움직임', '조용함'].includes(glass.state)); assert.equal(glass.src, '실측');
  await shot(win, '04-glass.png'); await ui.key('Escape');
  await ui.until(() => !Glass.isOpen(), null, 5000);
  step('alerts reach a subscriber as v1 JSON, cannot be forged by a device, and the glasses screen opens and closes');
  clearInterval(timer); board.end(true);

  // 6. 화면 기록 (데모)
  await ui.click('#openConn'); await ui.click('#dk-demo'); await ui.click('#tab-space'); await sleep(9000); await shot(win, '05-demo-space.png');
  assert.ok(await win.evaluate(() => document.querySelectorAll('#sp-feed li').length >= 3 && !document.querySelector('#v-space').hidden), 'the space view is showing its event list');
  const dim = await win.evaluate(async () => { let min = 1; for (let i = 0; i < 8; i++) { for (const li of [...document.querySelectorAll('#sp-feed li')].slice(1, 4)) min = Math.min(min, +getComputedStyle(li).opacity); await new Promise(r => setTimeout(r, 80)); } return min; });
  assert.equal(dim, 1, 'event list rows stay fully visible between updates');   // 같은 내용을 다시 그려 목록이 깜빡이던 문제의 재발 방지
  for (const v of ['motion', 'presence', 'rules', 'nodes', 'evidence']) { await ui.click('#tab-' + v); await sleep(1200); await shot(win, `06-${v}.png`); }
  step('demo views open without errors');
  // 7. 창은 밖으로 나가지 못한다
  await win.evaluate(() => { try { location.href = 'https://example.com/'; } catch (e) { /* blocked */ } }); await sleep(800);
  assert.equal((await win.evaluate(() => location.href)).startsWith('app://wavrel/'), true);
  assert.equal(await win.evaluate(() => window.open('https://example.com/') === null), true);
  assert.equal(app.windows().length, 1);
  step('navigation and new windows are blocked');

} catch (e) { failed = true; console.error(e);
  // 실패했을 때 원인을 좁힐 수 있도록 창의 상태를 남깁니다.
  try { const w = await app.firstWindow(); console.log('state at failure:', JSON.stringify(await w.evaluate(() => ({ lang: window.I18N && I18N.lang, address: location.href, setupHidden: document.querySelector('#setup').hidden, emptyHidden: document.querySelector('#sp-empty').hidden, csi: window.Lab && Lab.S.csi.size, rooms: window.Lab && Lab.S.rooms.size, devs: window.Lab && Lab.S.devs.size, deskHidden: document.querySelector('#desk').hidden, source: window.Lab && Lab.S.source, status: window.Desk && window.Desk.status(), size: [innerWidth, innerHeight], visibility: document.visibilityState, body: document.body.className })))); } catch { /* ignore */ }
  try { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); } catch { /* ignore */ } }
await app.close().catch(() => {});
await new Promise(r => setTimeout(r, 1000));
try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* 임시 폴더는 운영체제가 치웁니다 */ }

// ---- 두 번째 실행: 영어. 새 프로필로 띄워 첫 실행 화면부터 영어인지 봅니다. ----
// 화면 안에서 언어를 바꾸면 페이지가 새로 열리는데, Windows 빌드 서버에서는 그 뒤로 창을 다루는 기다림이 가끔 끝나지 않습니다.
// 그래서 전체 화면 점검은 처음부터 영어로 띄운 창에서 하고, 언어 버튼은 맨 마지막에 눌러 결과만 확인합니다.
async function english() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wavrel-en-'));
  const app2 = await _electron.launch({ args: [...common, '--lang=en-US', root, `--user-data-dir=${profile}`], cwd: root, env: { ...process.env, LANGUAGE: 'en', WAVREL_MQTT_PORT: String(port), ...(linux ? { WAVREL_DEV_BASIC_STORE: '1' } : {}) }, timeout: 60_000 });
  try {
    let win = await app2.firstWindow(); const ui = drive(() => win); await ui.until(() => document.readyState !== 'loading', null, 90_000);   // 빌드 서버에서는 첫 화면(3D 장면 준비 포함)이 뜨는 데 오래 걸릴 때가 있습니다
    await ui.until(() => window.Lab && window.I18N && window.Desk && window.Desk.status(), null, 90_000);
    const state = w => w.evaluate(() => ({ lang: I18N.lang, doc: document.documentElement.lang, saved: (() => { try { return localStorage.getItem('wavrel-lang'); } catch (e) { return 'unavailable'; } })(), search: location.search }));
    const st = await state(win); assert.equal(st.lang, 'en', 'an English system starts in English: ' + JSON.stringify(st)); assert.equal(st.doc, 'en');
    const leftover = () => win.evaluate(() => { const H = /[\u3131-\u318e\uac00-\ud7a3]/, seen = [];
      const w = document.createTreeWalker(document.body, 4, { acceptNode: n => /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) || n.parentNode.closest('.lang') ? 2 : 1 });
      for (let n; (n = w.nextNode());) if (H.test(n.nodeValue)) seen.push(n.nodeValue.trim().slice(0, 60));
      for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) if (!el.closest('.lang')) for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && H.test(v)) seen.push('@' + a + ' ' + v.slice(0, 50)); }
      return seen; });
    const korean = (await leftover()).map(t => 'first run: ' + t); await shot(win, '07-en-first-run.png');
    await ui.click('#su-demo'); await sleep(4000);
    for (const v of ['space', 'motion', 'presence', 'camera', 'rules', 'nodes', 'evidence']) { await ui.click('#tab-' + v); await sleep(900); korean.push(...(await leftover()).map(t => v + ': ' + t)); if (v === 'space' || v === 'rules') await shot(win, `07-en-${v}.png`); }
    await win.evaluate(() => Glass.open()); await sleep(500); korean.push(...(await leftover()).map(t => 'glass: ' + t)); await win.evaluate(() => Glass.close());
    await ui.click('#openConn'); await sleep(500); korean.push(...(await leftover()).map(t => 'broker panel: ' + t)); await ui.click('#dk-close');
    const report = await win.evaluate(() => Report.build().replace(/<style[\s\S]*?<\/style>/, ''));
    assert.deepEqual(korean, [], 'no Korean text is left on any English screen');
    assert.ok(!/[\u3131-\u318e\uac00-\ud7a3]/.test(report), 'the English report holds no Korean text');
    assert.deepEqual(await win.evaluate(() => [...I18N.missing]), [], 'every sentence shown has a translation');
    // 빈 표의 안내 줄은 제목 줄 아래, 표 안에 있어야 한다 (다른 화면의 스타일이 새어 들어와 제목 줄을 가리던 문제의 재발 방지)
    await ui.click('#tab-evidence'); await sleep(600);
    const emptyRow = await win.evaluate(() => { const td = document.querySelector('#ev-sessions tr.empty td'), th = document.querySelector('#ev-sessions th'); if (!td) return null; const a = td.getBoundingClientRect(), b = th.getBoundingClientRect(); return { left: a.left - b.left, below: a.top >= b.bottom - 1 }; });
    assert.ok(emptyRow && Math.abs(emptyRow.left) < 2 && emptyRow.below, 'the empty-table row sits under its header: ' + JSON.stringify(emptyRow));
    step('English: no Korean text on the first-run screen, any view, the glasses screen, the broker panel or the report');

    // 언어 버튼: 누르면 화면이 한국어로 다시 열리고, 선택이 저장되며, 주소에는 흔적이 남지 않는다
    await win.evaluate(() => { document.querySelector('#lang').click(); }).catch(() => {});
    let after = null; const end = Date.now() + 45_000;
    while (!after && Date.now() < end) { for (const w of app2.windows()) { try { const x = await state(w); if (x.lang === 'ko') after = x; } catch { /* 다시 여는 중 */ } } if (!after) await new Promise(r => setTimeout(r, 300)); }
    assert.ok(after, 'the window comes back in Korean after the language button');
    assert.equal(after.saved, 'ko'); assert.equal(after.search, ''); assert.equal(after.doc, 'ko');
    step('language button: the window reopens in the other language and the choice is saved');
  } catch (e) { failed = true; console.error(e); try { await (await app2.firstWindow()).screenshot({ path: path.join(out, 'failure-en.png'), timeout: 10_000 }); } catch { /* ignore */ } }
  await app2.close().catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* 임시 폴더는 운영체제가 치웁니다 */ }
}
if (!failed) await english();
process.exit(failed ? 1 : 0);
