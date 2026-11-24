// 묶은 실행 파일이 실제로 뜨는지 확인합니다. 디버깅 포트(--inspect)는 빌드에서 꺼 두었기 때문에,
// 창 쪽의 원격 디버깅으로만 붙어 주소와 격리 상태를 읽습니다.
// 실행:  node tests/packaged.check.mjs <실행 파일 경로>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) { console.error('usage: node tests/packaged.check.mjs <path to executable>'); process.exit(2); }
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-lab-pkg-'));
const linux = process.platform === 'linux';
const child = spawn(exe, [...(linux ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--remote-debugging-port=9339', `--user-data-dir=${userData}`], { env: { ...process.env, SENTINEL_MQTT_PORT: '18839' }, stdio: 'ignore' });
let code = 1;
try {
  let browser = null;
  for (let i = 0; i < 40 && !browser; i++) { await new Promise(r => setTimeout(r, 750)); browser = await chromium.connectOverCDP('http://127.0.0.1:9339').catch(() => null); }
  if (!browser) throw new Error('the packaged app did not open a window');
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('app://sentinel/')); if (!page) await new Promise(r => setTimeout(r, 500)); }
  if (!page) throw new Error('no app:// window found');
  await page.waitForFunction(() => window.Lab && window.Desk && window.Desk.status(), null, { timeout: 20_000 });
  const r = await page.evaluate(async () => ({ info: await window.desktop.info(), require: typeof window.require, status: await window.desktop.status(), setup: !document.querySelector('#setup').hidden }));
  console.log(JSON.stringify(r));
  if (!r.info.packaged || r.require !== 'undefined' || r.status.running || !r.setup) throw new Error('unexpected state in the packaged app');
  console.log('ok   packaged app starts, loads app://sentinel, is isolated, and waits for a password before starting the broker');
  await browser.close().catch(() => {}); code = 0;
} catch (e) { console.error('FAIL', e.message); }
child.kill(); await new Promise(r => setTimeout(r, 800));
fs.rmSync(userData, { recursive: true, force: true });
process.exit(code);
