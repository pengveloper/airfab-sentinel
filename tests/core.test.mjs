// 콘솔 데이터 계층(console/js/core.js) 자동 시험. 의존성 없이 실행합니다:  npm test  (또는 node --test tests/core.test.mjs)
// 브라우저 전역을 최소한으로 흉내 내고, 시계와 MQTT 클라이언트를 가짜로 바꿔 끼웁니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(fileURLToPath(new URL('../console/js/core.js', import.meta.url)), 'utf8');
const ID = 'a1b2c3d4e5f60718';

function boot() {
  const clock = { t: 1_800_000_000_000 };
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.t); }
    static now() { return clock.t; }
  }
  const store = new Map();
  const sent = [];
  const handlers = {};
  const client = {
    on(ev, f) { (handlers[ev] ||= []).push(f); },
    subscribe() {}, end() {},
    publish(topic, payload) { sent.push([topic, payload]); },
  };
  const ctx = {
    console, JSON, Math, Map, Set, Object, Array, String, Number, isNaN, parseInt, Date: FakeDate,
    setInterval: () => 0, setTimeout: () => 0, clearTimeout() {},
    location: { protocol: 'file:', hostname: '' },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    mqtt: { connect: () => client },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const Lab = ctx.Lab;
  const emit = (ev, ...a) => (handlers[ev] || []).forEach(f => f(...a));
  const goLive = () => { Lab.connect('ws://localhost:9001', 'lab', 'x', () => {}); emit('connect'); };
  const msg = (topic, payload, retain = false) =>
    emit('message', topic, Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)), { retain });
  const motion = (state, score, id = ID) => msg(`espectre/v1/devices/${id}/motion`, { timestamp_ms: 0, state, score });
  const tick = ms => { clock.t += ms; };
  return { Lab, clock, sent, goLive, msg, motion, tick };
}

test('T-CON-001 식별자는 앞 4자만 남기고 가린다', () => {
  const { Lab } = boot();
  assert.equal(Lab.mask('espectre/v1/devices/a1b2c3d4e5f60718/motion'), 'espectre/v1/devices/a1b2…/motion');
  assert.equal(Lab.mask('aa:bb:cc:dd:ee:ff'), 'aa:bb:…');
  assert.equal(Lab.mask('aabbccddeeff'), 'aabb…');
});

test('T-CON-002 motion 메시지가 노드와 감지 구간을 만든다', () => {
  const { Lab, goLive, motion, tick } = boot(); goLive();
  motion('idle', 0.1); tick(200); motion('motion', 1.2); tick(3000); motion('idle', 0.1);
  const n = Lab.S.csi.get(ID);
  assert.equal(n.events.length, 1);
  assert.equal(n.events[0].e - n.events[0].s, 3000);
  assert.equal(n.events[0].peak, 1.2);
  assert.ok(Lab.cfg.nodes.some(x => x.key === 'csi:' + ID));
});

test('T-CON-003 보관(retained) 메시지만으로는 노드도 단계 확인도 생기지 않는다', () => {
  const { Lab, goLive, msg, motion } = boot(); goLive();
  msg(`espectre/v1/devices/${ID}/sensing`, { threshold: 0.7 }, true);
  msg('espresense/rooms/office/status', 'online', true);
  assert.equal(Lab.S.csi.size, 0);
  assert.deepEqual(Object.keys(Lab.cfg.bring), ['broker']);
  motion('idle', 0.1); // 새 메시지가 오면 노드가 생기고, 보관돼 있던 임계값이 적용된다
  assert.equal(Lab.S.csi.get(ID).thr, 0.7);
  assert.ok(Lab.cfg.bring.csi);
});

test('T-CON-004 세션 통계: 감지, 놓침, 오탐, 재현율', () => {
  const { Lab, goLive, motion, tick } = boot(); goLive();
  motion('idle', 0.1); Lab.sessionStart('csi:' + ID, 'manual');
  tick(2000); Lab.label(true); tick(500); motion('motion', 1.1); tick(2000); motion('idle', 0.1); Lab.label(false); // 감지
  tick(10000); Lab.label(true); tick(2000); Lab.label(false);                                                    // 놓침
  tick(10000); motion('motion', 0.9); tick(1500); motion('idle', 0.1);                                           // 오탐
  tick(5000); Lab.sessionStop();
  const s = Lab.S.sessions[0];
  assert.deepEqual([s.labels, s.hits, s.miss, s.falses], [2, 1, 1, 1]);
  assert.equal(s.recall, 0.5);
  assert.equal(s.sim, false);
  assert.equal(s.trace.labels.length, 2);
  assert.equal(s.trace.events.length, 2);
});

test('T-CON-005 정답 구간 앞뒤 2초 안의 감지는 일치로 센다', () => {
  const { Lab, goLive, motion, tick } = boot(); goLive();
  motion('idle', 0.1); Lab.sessionStart('csi:' + ID, 'manual');
  tick(3000); Lab.label(true); tick(1000); Lab.label(false);
  tick(1500); motion('motion', 1.0); tick(1000); motion('idle', 0.1); // 정답이 끝나고 1.5초 뒤에 시작
  tick(3000); Lab.sessionStop();
  assert.equal(Lab.S.sessions[0].hits, 1);
  assert.equal(Lab.S.sessions[0].falses, 0);
});

test('T-CON-006 세 노드의 거리로 기기 위치를 추정한다', () => {
  const { Lab, goLive, msg } = boot(); goLive();
  const nodes = { office: [1, 1], living: [9, 1], entry: [5, 6] }, truth = [4, 3];
  for (const r in nodes) msg(`espresense/rooms/${r}/status`, 'online');
  for (const r in nodes) { const n = Lab.cfg.nodes.find(x => x.key === 'ble:' + r); n.x = nodes[r][0]; n.y = nodes[r][1]; }
  for (let i = 0; i < 3; i++) for (const r in nodes)
    msg(`espresense/devices/tag1/${r}`, { id: 'tag1', distance: Math.hypot(truth[0] - nodes[r][0], truth[1] - nodes[r][1]), rssi: -60 });
  const d = Lab.S.devs.get('tag1');
  assert.ok(d.pos, '위치가 계산돼야 한다');
  assert.ok(Math.hypot(d.pos.x - truth[0], d.pos.y - truth[1]) < 0.3, `오차 ${Math.hypot(d.pos.x - truth[0], d.pos.y - truth[1]).toFixed(2)}m`);
});

test('T-CON-007 PIR 입력이 정답 구간을 자동으로 기록한다', () => {
  const { Lab, goLive, msg, motion, tick } = boot(); goLive();
  motion('idle', 0.1); msg('espresense/rooms/living/input_1', 'OFF');
  Lab.sessionStart('csi:' + ID, 'pir:living/1');
  tick(1000); msg('espresense/rooms/living/input_1', 'ON'); tick(2000); msg('espresense/rooms/living/input_1', 'OFF');
  tick(1000); Lab.sessionStop();
  const s = Lab.S.sessions[0];
  assert.equal(s.labels, 1);
  assert.deepEqual([...s.trace.labels[0]], [1000, 3000]);
});

test('T-CON-008 움직임 규칙이 WLED JSON 명령을 보낸다', () => {
  const { Lab, goLive, motion, tick, sent } = boot(); goLive();
  motion('idle', 0.1); tick(200); motion('motion', 1.2);
  const out = sent.find(m => m[0] === 'wled/lab/api');
  assert.ok(out, 'LED 토픽으로 발행돼야 한다');
  assert.deepEqual(JSON.parse(out[1]).seg[0].col[0], [236, 185, 85]);
});

test('T-CON-009 시뮬레이터 값이 섞이면 단계 확인과 기록 표시가 실측으로 올라가지 않는다', () => {
  const { Lab, goLive, msg, motion } = boot(); goLive();
  msg('lab/sim/active', '1', true);
  motion('idle', 0.1); msg('espresense/rooms/office/status', 'online');
  assert.deepEqual(Object.keys(Lab.cfg.bring), ['broker']);
  const head = JSON.parse(Lab.exportLog().split('\n')[0]);
  assert.equal(head.data_source, 'broker_with_simulator');
  assert.equal(head.verification, 'SIMULATED');
});

test('T-CON-010 내보낸 기록에 가리지 않은 식별자가 없다', () => {
  const { Lab, goLive, motion, msg } = boot(); goLive();
  motion('idle', 0.1); msg('espresense/devices/aabbccddeeff/office', { id: 'aabbccddeeff', distance: 2, rssi: -70 });
  const out = Lab.exportLog();
  assert.ok(!out.includes(ID));
  assert.ok(!out.includes('aabbccddeeff'));
  assert.equal(JSON.parse(out.split('\n')[0]).verification, 'OPERATOR_TO_CONFIRM');
});
