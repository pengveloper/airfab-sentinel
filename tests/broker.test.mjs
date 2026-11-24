// 내장 브로커(desktop/main/broker.mjs) 자동 시험. 실제 TCP 소켓으로 붙어 봅니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import mqtt from 'mqtt';
import { Hub, LIMITS, isPrivateAddress, validTopic, maskId, samePassword } from '../desktop/main/broker.mjs';

const PW = 'correct-horse-42';
const boot = async (extra = {}) => { const hub = new Hub({ port: 0, host: '127.0.0.1', getPassword: () => PW, ...extra }); await hub.start(); return hub; };
const connect = (hub, opts = {}) => new Promise(resolve => {
  const c = mqtt.connect(`mqtt://127.0.0.1:${hub.port}`, { username: 'lab', password: PW, reconnectPeriod: 0, connectTimeout: 3000, ...opts });
  c.once('connect', () => resolve({ ok: true, c })); c.once('error', e => { c.end(true); resolve({ ok: false, code: e.code, c }); });
});
const wait = ms => new Promise(r => setTimeout(r, ms));

test('T-HUB-001 사설망과 루프백 주소만 받아들인다', () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.0.10', '169.254.3.4', '::1', '::ffff:192.168.1.5', 'fd12::1', 'fe80::1']) assert.equal(isPrivateAddress(a), true, a);
  for (const a of ['8.8.8.8', '172.32.0.1', '192.169.1.1', '100.64.0.1', '2001:db8::1', '::ffff:1.2.3.4', '', undefined]) assert.equal(isPrivateAddress(a), false, String(a));
});

test('T-HUB-002 올바른 비밀번호만 접속된다', async () => {
  const hub = await boot();
  const good = await connect(hub); assert.equal(good.ok, true); good.c.end(true);
  assert.equal((await connect(hub, { password: 'wrong-password' })).ok, false);
  assert.equal((await connect(hub, { username: 'root' })).ok, false);
  assert.equal((await connect(hub, { username: undefined, password: undefined })).ok, false);
  await hub.stop();
});

test('T-HUB-003 로그인 실패가 이어지면 그 주소를 잠시 막는다', async () => {
  let t = 1_000_000; const hub = await boot({ now: () => t });
  for (let i = 0; i < LIMITS.authFails; i++) assert.equal((await connect(hub, { password: 'nope-nope-nope' })).ok, false);
  assert.equal((await connect(hub)).ok, false, '막힌 동안에는 올바른 비밀번호도 거절');
  t += LIMITS.blockMs + 1;
  const again = await connect(hub); assert.equal(again.ok, true, '시간이 지나면 다시 접속'); again.c.end(true);
  assert.equal(hub.status().counts.authRejected, LIMITS.authFails);
  await hub.stop();
});

test('T-HUB-004 기기 메시지가 창으로 전달되고 보관 메시지는 따로 기억된다', async () => {
  const hub = await boot(); const got = []; hub.on('message', m => got.push(m));
  const { c } = await connect(hub);
  c.publish('espectre/v1/devices/abc/motion', '{"state":"idle","score":0.1}');
  c.publish('espresense/rooms/office/status', 'online', { retain: true });
  await wait(200);
  assert.deepEqual(got.map(m => m.topic), ['espectre/v1/devices/abc/motion', 'espresense/rooms/office/status']);
  assert.ok(got.every(m => m.retain === false));
  assert.deepEqual(hub.retainedList(), [{ topic: 'espresense/rooms/office/status', payload: 'online', retain: true }]);
  c.publish('espresense/rooms/office/status', '', { retain: true }); await wait(150);
  assert.equal(hub.retainedList().length, 0, '빈 보관 메시지는 지움');
  c.end(true); await hub.stop();
});

test('T-HUB-005 예약 토픽과 너무 큰 메시지는 받지 않는다', async () => {
  const hub = await boot(); const got = []; hub.on('message', m => got.push(m.topic));
  for (const [topic, payload] of [['$SYS/fake', 'x'], ['lab/console/cmd', 'x'], ['big/topic', 'x'.repeat(LIMITS.maxPayload + 1)]]) {
    const { c } = await connect(hub); c.on('error', () => {}); c.publish(topic, payload); await wait(150); c.end(true);
  }
  assert.deepEqual(got, []);
  assert.equal(hub.status().counts.publishRejected, 3);
  assert.equal(validTopic('wled/lab/api'), true); assert.equal(validTopic('a/#'), false); assert.equal(validTopic('x'.repeat(201)), false);
  await hub.stop();
});

test('T-HUB-006 인증 전에 많은 데이터를 보내는 소켓은 끊는다', async () => {
  const hub = await boot();
  const closed = await new Promise(resolve => {
    const s = net.connect(hub.port, '127.0.0.1', () => s.write(Buffer.alloc(LIMITS.preAuthBytes + 1024, 0x61)));
    s.on('close', () => resolve(true)); s.on('error', () => {}); setTimeout(() => resolve(false), 2000);
  });
  assert.equal(closed, true);
  await hub.stop();
});

test('T-HUB-007 앱이 보낸 명령은 기기에게 가고, 창으로 되돌아오지 않는다', async () => {
  const hub = await boot(); const echoed = []; hub.on('message', m => echoed.push(m));
  const { c } = await connect(hub); const seen = [];
  await new Promise(r => c.subscribe('wled/lab/api', r)); c.on('message', (t, p) => seen.push([t, p.toString()]));
  assert.equal(hub.publish('wled/lab/api', '{"on":true}'), true);
  assert.equal(hub.publish('a/#', 'x'), false); assert.equal(hub.publish('$SYS/x', 'x'), false);
  await wait(200);
  assert.deepEqual(seen, [['wled/lab/api', '{"on":true}']]); assert.equal(echoed.length, 0);
  c.end(true); await hub.stop();
});

test('T-HUB-008 상태에는 가린 클라이언트 이름만 나가고 비밀번호는 없다', async () => {
  const hub = await boot(); const { c } = await connect(hub, { clientId: 'espresense-a1b2c3d4e5f6' }); await wait(100);
  const s = hub.status();
  assert.equal(s.clients.length, 1); assert.equal(s.clients[0].id, 'espres…'); assert.equal(maskId('abc'), 'abc');
  assert.ok(!JSON.stringify(s).includes(PW)); assert.ok(!JSON.stringify(s).includes('a1b2c3d4e5f6'));
  assert.equal(samePassword(PW, PW), true); assert.equal(samePassword(PW, PW + 'x'), false); assert.equal(samePassword(null, PW), false);
  c.end(true); await hub.stop();
});

test('T-HUB-009 포트가 이미 쓰이고 있으면 알기 쉬운 오류를 낸다', async () => {
  const a = await boot(); const b = new Hub({ port: a.port, host: '127.0.0.1', getPassword: () => PW });
  await assert.rejects(() => b.start(), e => e.code === 'EADDRINUSE');
  assert.equal(b.running, false);
  await a.stop();
});
