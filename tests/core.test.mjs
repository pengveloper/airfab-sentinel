// 콘솔 데이터 계층(console/js/core.js) 자동 시험. 의존성 없이 실행합니다:  npm test  (또는 node --test tests/core.test.mjs)
// 브라우저 전역을 최소한으로 흉내 내고, 시계와 MQTT 클라이언트를 가짜로 바꿔 끼웁니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = f => readFileSync(fileURLToPath(new URL('../console/js/' + f, import.meta.url)), 'utf8');
const SRC = read('core.js'), I18N = read('i18n-en.js') + '\n' + read('i18n.js');   // 언어 층이 먼저 올라와야 core.js가 L을 씁니다
const ID = 'a1b2c3d4e5f60718';

function boot(saved, language = 'ko-KR') {
  const clock = { t: 1_800_000_000_000 };
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.t); }
    static now() { return clock.t; }
  }
  const store = new Map();
  if (saved) store.set('sentinel-lab-console-v1', JSON.stringify(saved)); // 예전에 저장해 둔 설정에서 시작하는 경우
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
    location: { protocol: 'file:', hostname: '', search: '' }, navigator: { language }, URLSearchParams,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    mqtt: { connect: () => client },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(I18N, ctx);
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

const notes = sent => sent.filter(m => m[0] === 'lab/out/notify').map(m => JSON.parse(m[1]));

test('T-CON-011 움직임 알림은 정해진 꼴(v1)로 한 토픽에 나가고, 식별자는 가려진다', () => {
  const { Lab, goLive, motion, tick, sent } = boot(); goLive();
  motion('idle', 0.1); tick(200); motion('motion', 1.23);
  const out = notes(sent);
  assert.equal(out.length, 1);
  const n = out[0];
  assert.deepEqual(Object.keys(n).sort(), ['body', 'id', 'kind', 'level', 'source', 'title', 'ts', 'ttl', 'v']);
  assert.deepEqual([n.v, n.kind, n.level, n.source, n.ttl], [1, 'motion', 'alert', 'broker', 8]);
  assert.equal(n.title, 'CSI a1b2: 움직임'); assert.match(n.body, /^점수 1\.23/);
  assert.ok(!JSON.stringify(n).includes(ID), '기기 ID 전체가 알림에 들어가면 안 된다');
  assert.equal(Lab.S.notes[0].id, n.id);
  tick(500); motion('idle', 0.1); tick(500); motion('motion', 1.4);                // 같은 규칙은 3초 안에 다시 울리지 않는다
  assert.equal(notes(sent).length, 1);
});

test('T-CON-012 시뮬레이터 값이 섞인 알림은 실측이라고 적지 않는다', () => {
  const { Lab, goLive, msg, motion, tick, sent } = boot(); goLive();
  msg('lab/sim/active', '1'); motion('idle', 0.1); tick(200); motion('motion', 1.2);
  assert.equal(notes(sent)[0].source, 'broker_with_simulator');
});

test('T-CON-013 검증 세션: 시작, 통과마다 감지 여부, 끝난 뒤 결과를 알린다', () => {
  const { Lab, goLive, motion, tick, sent } = boot(); goLive();
  Lab.cfg.rules.forEach(r => { r.on = false; });                                    // 세션 안내만 봅니다
  motion('idle', 0.1); Lab.sessionStart('csi:' + ID, 'manual');
  tick(2000); Lab.label(true); tick(500); motion('motion', 1.1); tick(2000); motion('idle', 0.1);
  const ss = Lab.S.session, first = ss.cur; Lab.label(false); tick(2200); Lab.passCheck(ss, first, 1);
  tick(8000); Lab.label(true); tick(2000); const second = ss.cur; Lab.label(false); tick(2200); Lab.passCheck(ss, second, 2);
  tick(3000); Lab.sessionStop();
  const out = notes(sent);
  assert.deepEqual(out.map(n => n.title), ['검증 시작: CSI a1b2', '통과 1: 감지됨', '통과 2: 놓침', '검증 끝: 1/2 감지']);
  assert.deepEqual(out.map(n => n.level), ['info', 'info', 'alert', 'alert']);
  assert.equal(out[2].body, '지금까지 1/2 감지'); assert.equal(out[3].body, '놓침 1 · 오탐 0 · 재현율 50%');
  assert.equal(Lab.passCheck(ss, second, 2), null, '끝난 세션에는 통과 안내를 더 내지 않는다');
  Lab.cfg.notify.session = false; Lab.sessionStart('csi:' + ID, 'manual'); Lab.sessionStop();
  assert.equal(notes(sent).length, 4, '안내를 끄면 세션 알림이 나가지 않는다');
});

test('T-CON-014 예전에 저장한 설정은 알림 규칙을 새 형식으로 옮겨 온다', () => {
  const old = { room: { w: 10, h: 7 }, nodes: [], pinned: [], cam: { url: '' }, led: { topic: 'wled/lab/api' }, broker: { url: 'x', user: 'lab' }, bring: {},
    rules: [{ id: 'r3', on: true, name: '5분 동안 조용하면 알림 토픽으로 보내기', when: { t: 'quiet', node: '*', sec: 300 }, then: { t: 'publish', topic: 'lab/notify', payload: '{"msg":"quiet"}' }, fired: 0, last: 0 },
      { id: 'rx', on: true, name: '내가 만든 규칙', when: { t: 'motion', node: '*' }, then: { t: 'publish', topic: 'my/topic', payload: '{}' }, fired: 0, last: 0 }] };
  const { Lab } = boot(old);
  const r = Lab.cfg.rules;
  assert.equal(JSON.stringify(r.find(x => x.id === 'r3').then), '{"t":"notify","level":"info"}');
  assert.equal(JSON.stringify(r.find(x => x.id === 'rx').then), '{"t":"publish","topic":"my/topic","payload":"{}"}', '직접 만든 규칙은 건드리지 않는다');
  assert.ok(r.some(x => x.when.t === 'motion' && x.then.t === 'notify'));
  assert.equal(Lab.cfg.notify.session, true);
});

test('T-CON-015 조용함 규칙은 규칙마다 정한 시간이 지났을 때 그 규칙만 실행된다', () => {
  const { Lab, goLive, motion, tick } = boot(); goLive();
  Lab.cfg.rules.length = 0;
  Lab.cfg.rules.push({ id: 'q1', on: true, name: '1분', when: { t: 'quiet', node: '*', sec: 60 }, then: { t: 'notify', level: 'info' }, fired: 0, last: 0 },
    { id: 'q5', on: true, name: '5분', when: { t: 'quiet', node: '*', sec: 300 }, then: { t: 'notify', level: 'info' }, fired: 0, last: 0 });
  const fired = () => Lab.cfg.rules.map(r => r.fired).join(',');
  motion('motion', 1.2); tick(1000); motion('idle', 0.1);                           // 조용해진 순간부터 잽니다
  tick(59000); Lab.quietTick(); assert.equal(fired(), '0,0');
  tick(2000); Lab.quietTick(); assert.equal(fired(), '1,0', '1분 규칙만 실행');
  tick(60000); Lab.quietTick(); assert.equal(fired(), '1,0', '같은 조용한 구간에서 다시 실행되지 않는다');
  tick(180000); Lab.quietTick(); assert.equal(fired(), '1,1', '5분이 지나면 5분 규칙이 실행');
  motion('motion', 1.2); tick(1000); motion('idle', 0.1); tick(61000); Lab.quietTick();
  assert.equal(fired(), '2,1', '움직임이 한 번 있은 뒤에는 다시 잰다');
});

test('T-CON-016 내보낸 기록의 머리말: 세션의 노드 식별자를 가리고, 출처는 기록에 담긴 대로 적는다', () => {
  const { Lab, goLive, motion, tick } = boot();
  Lab.demo(); Lab.ingest('espectre/v1/devices/' + ID + '/motion', JSON.stringify({ state: 'idle', score: 0.1, threshold: 0.5 }), 'sim');
  assert.equal(JSON.parse(Lab.exportLog().split('\n')[0]).data_source, 'built_in_simulator');
  goLive(); motion('idle', 0.1);                                                    // 데모를 보다가 연결: 실측 기록은 새로 시작
  Lab.sessionStart('csi:' + ID, 'manual'); tick(1000); Lab.label(true); motion('motion', 1.2); tick(1500); motion('idle', 0.1); Lab.label(false); tick(500); Lab.sessionStop();
  const text = Lab.exportLog(), head = JSON.parse(text.split('\n')[0]);
  assert.ok(!text.includes(ID), '전체 식별자가 어디에도 없어야 한다');
  assert.equal(head.sessions.length, 1); assert.equal(head.sessions[0].node, 'csi:a1b2…');
  assert.equal(head.data_source, 'broker'); assert.equal(head.verification, 'OPERATOR_TO_CONFIRM');
  assert.ok(text.trim().split('\n').slice(1).every(l => JSON.parse(l).src === 'live'), '시뮬레이터 줄이 실측 기록에 섞이지 않는다');
  Lab.disconnect();
  assert.equal(JSON.parse(Lab.exportLog().split('\n')[0]).data_source, 'broker', '연결을 끊은 뒤에 내려받아도 출처는 그대로');
});

test('T-CON-017 영어 화면에서는 알림, 규칙 이름, 내보낸 기록의 안내문이 영어로 나간다', () => {
  const { Lab, goLive, motion, tick, sent } = boot(null, 'en-US'); goLive();
  motion('idle', 0.1); tick(200); motion('motion', 1.23);
  const n = notes(sent)[0];
  assert.equal(n.title, 'CSI a1b2: motion'); assert.match(n.body, /^Score 1\.23/);
  assert.equal(Lab.ruleName(Lab.cfg.rules[0]), 'When motion starts, change the LED color');
  assert.equal(Lab.ruleName(Lab.cfg.rules[1]), 'When a pinned device enters Office, change the LED color');
  assert.equal(Lab.ruleName(Lab.cfg.rules[2]), 'When it is quiet for 5 min, send an alert');
  assert.equal(JSON.parse(Lab.exportLog().split('\n')[0]).note, 'Identifiers are masked to their first 4 characters.');
  assert.ok(!/[\u3131-\u318e\uac00-\ud7a3]/.test(JSON.stringify([Lab.S.notes, Lab.S.feed, Lab.report()])), 'no Korean text in alerts, events or the summary');
});

test('T-CON-018 규칙 이름은 저장한 글자가 아니라 규칙의 내용에서 만들고, 기본 이름은 언어를 따라간다', () => {
  const saved = { room: { w: 10, h: 7 }, nodes: [{ key: 'cam', type: 'cam', alias: '카메라', x: 5, y: 1 }, { key: 'led', type: 'led', alias: '책상 조명', x: 2, y: 1 }], pinned: [], cam: { url: '' }, led: { topic: 'wled/lab/api' }, broker: { url: 'x', user: 'lab' }, bring: {}, notify: { session: true },
    rules: [{ id: 'rx', on: true, name: '예전에 저장된 이름', when: { t: 'quiet', node: '*', sec: 60 }, then: { t: 'publish', topic: 'my/topic', payload: '{}' }, fired: 0, last: 0 }] };
  const ko = boot(saved).Lab, en = boot(saved, 'en-US').Lab;
  assert.equal(ko.ruleName(ko.cfg.rules[0]), '1분 동안 조용하면 my/topic 토픽으로 보내기');
  assert.equal(en.ruleName(en.cfg.rules[0]), 'When it is quiet for 1 min, publish to my/topic');
  assert.equal(en.node('cam').alias, 'Camera'); assert.equal(en.node('led').alias, '책상 조명'); assert.equal(ko.node('cam').alias, '카메라');
});

test('T-CON-019 토픽 필터 맞춤: 데스크톱에서 앱이 보낸 메시지를 구독 중인 토픽에만 돌려줄 때 쓴다', () => {
  const { Lab } = boot();
  const m = Lab.topicMatch;
  assert.equal(m('wled/lab/api', 'wled/lab/api'), true); assert.equal(m('wled/lab/api', 'wled/lab/api/x'), false);
  assert.equal(m('espresense/devices/#', 'espresense/devices/a/office'), true); assert.equal(m('espresense/devices/#', 'espresense/rooms/office'), false);
  assert.equal(m('espectre/v1/devices/+/motion', 'espectre/v1/devices/abc/motion'), true); assert.equal(m('espectre/v1/devices/+/motion', 'espectre/v1/devices/abc/health'), false);
  assert.equal(m('espresense/rooms/+/+', 'espresense/rooms/office'), false); assert.equal(m('lab/sim/active', 'lab/out/notify'), false);
});
