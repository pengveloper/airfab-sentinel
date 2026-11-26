// Relay server (server/) and the desktop end of its link (desktop/main/link.mjs).
// Runs a real server on a random local port and connects to it with Node's own WebSocket, the
// same client the desktop app uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import * as lz from '../server/lingzhu.mjs';
import { createApp, GUARD } from '../server/app.mjs';
import { Home } from '../server/home.mjs';
import { Link, linkUrl, validToken } from '../desktop/main/link.mjs';

const AK = 'ak_' + 'a'.repeat(40);
const TOKEN = 'home_' + 'b'.repeat(40);
const req = (text, extra = {}) => JSON.stringify({
  message_id: 'm' + Math.random().toString(36).slice(2, 10), agent_id: 'agent-1', user_id: 'U1', third_agent_id: 'wavrel',
  message: [{ role: 'user', type: 'text', text: '이전 질문', image_url: null }, { role: 'agent', type: 'text', text: '이전 답' }, { role: 'user', type: 'text', text, image_url: null }],
  metadata: { language: 'ko-KR', location: '서울특별시 어딘가', latitude: '37.5', longitude: '126.9', weather: '맑음', battery: '80', running_app: [] },
  ...extra,
});

async function start(opts = {}) {
  const app = createApp({ rokidAk: AK, homeToken: TOKEN, keepaliveMs: 50, ...opts });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `127.0.0.1:${app.server.address().port}`;
  return { app, http: `http://${base}`, ws: `ws://${base}/link` };
}

const ask = (s, body, auth = AK) => fetch(`${s.http}/rokid/sse`, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body });

function events(text) {
  return text.split('\n\n').filter(b => b.startsWith('event:message')).map(b => {
    const [ev, data] = b.split('\n');
    assert.equal(ev, 'event:message');
    assert.ok(data.startsWith('data:'));
    return JSON.parse(data.slice(5));
  });
}

// Resolves when the link is up, or with the error of its first failed attempt.
function connect(l, url, token = TOKEN) {
  return new Promise(resolve => {
    const on = st => { if (st.state === 'on' || st.state === 'retrying') { l.off('state', on); resolve(st); } };
    l.on('state', on);
    l.configure({ url, token });
  });
}

test('T-SRV-001 parses a request: newest words only, metadata dropped, language picked', () => {
  const q = lz.parseRequest(req('거실에 누가 있어?'));
  assert.deepEqual(Object.keys(q).sort(), ['agentId', 'lang', 'messageId', 'ok', 'photo', 'question']);
  assert.equal(q.question, '거실에 누가 있어?');
  assert.equal(q.lang, 'ko');
  assert.equal(JSON.stringify(q).includes('서울'), false);
  assert.equal(lz.parseRequest(req('客厅有人吗')).lang, 'zh');
  assert.equal(lz.parseRequest(req('Is anyone home?')).lang, 'ko', 'reported ko-KR wins for Latin text');
  assert.equal(lz.parseRequest(req('Is anyone home?', { metadata: { language: 'en-US' } })).lang, 'en');
  assert.equal(lz.parseRequest(req('x'.repeat(500))).question.length, 300);
  assert.equal(lz.parseRequest('{"message_id":"1","agent_id":"a b","message":[]}').error, 'BAD_ID');
  assert.equal(lz.parseRequest('nope').error, 'BAD_JSON');
  assert.equal(lz.parseRequest('{"a":"' + 'x'.repeat(70_000) + '"}').error, 'TOO_LARGE');
  const photo = lz.parseRequest(JSON.stringify({ message_id: 9, agent_id: 'a', message: [{ role: 'user', type: 'image', text: '', image_url: 'https://example.com/p.jpg' }] }));
  assert.equal(photo.photo, true); assert.equal(photo.question, ''); assert.equal(photo.messageId, '9');
});

test('T-SRV-002 answers in the event format the platform expects', () => {
  const ev = events(lz.answer('m1', 'a1', '조용합니다.\n'));
  assert.equal(ev.length, 2);
  assert.deepEqual(ev[0], { role: 'agent', type: 'answer', answer_stream: '조용합니다.', message_id: 'm1', agent_id: 'a1', is_finish: false });
  assert.deepEqual(ev[1], { role: 'agent', type: 'answer', answer_stream: '', message_id: 'm1', agent_id: 'a1', is_finish: true });
});

test('T-SRV-003 refuses requests without the right key and unknown paths', async () => {
  const s = await start();
  try {
    assert.equal((await ask(s, req('hi'), null)).status, 401);
    assert.equal((await ask(s, req('hi'), 'wrong-key-0123456789')).status, 401);
    assert.equal((await ask(s, req('hi'), TOKEN)).status, 401, 'the home token is not the Rokid key');
    assert.equal((await fetch(`${s.http}/rokid/sse`)).status, 405);
    assert.equal((await fetch(`${s.http}/health`)).status, 200);
    assert.equal((await fetch(`${s.http}/admin`)).status, 404);
    assert.equal((await ask(s, 'not json')).status, 400);
    assert.equal((await ask(s, '{"x":"' + 'y'.repeat(70_000) + '"}')).status, 413);
    assert.throws(() => createApp({ rokidAk: AK, homeToken: AK }), /differ/);
    assert.throws(() => createApp({ rokidAk: 'short', homeToken: TOKEN }), /16/);
  } finally { await s.app.close(); }
});

test('T-SRV-004 says so on the lens when the home PC is not connected', async () => {
  const s = await start();
  try {
    const r = await ask(s, req('거실에 누가 있어?'));
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/event-stream/);
    assert.equal(r.headers.get('x-accel-buffering'), 'no');
    const text = await r.text();
    assert.ok(text.startsWith(': keepalive'), 'a comment goes out at once so proxies start streaming');
    const ev = events(text);
    assert.equal(ev[0].answer_stream, lz.SAY.NO_HOME.ko);
    assert.equal(ev.at(-1).is_finish, true);
    const en = events(await (await ask(s, req('Is anyone home?', { metadata: { language: 'en-US' } }))).text());
    assert.equal(en[0].answer_stream, lz.SAY.NO_HOME.en);
  } finally { await s.app.close(); }
});

test('T-SRV-005 a question from the glasses reaches the desktop link and its answer comes back', async () => {
  const s = await start();
  const l = new Link();
  try {
    let answered;
    l.on('ask', q => { assert.equal(q.text, '거실에 누가 있어?'); assert.equal(q.lang, 'ko'); setTimeout(() => { answered = l.answer(q.id, '거실은 조용합니다.'); }, 120); });
    assert.equal((await connect(l, s.ws)).state, 'on');
    assert.equal(s.app.status().home.connected, true);
    const text = await (await ask(s, req('거실에 누가 있어?'))).text();
    const ev = events(text);
    assert.equal(ev[0].answer_stream, '거실은 조용합니다.');
    assert.equal(ev[1].is_finish, true);
    assert.equal(answered, true);
    assert.ok(text.indexOf(': keepalive', 3) > 0, 'keeps the stream alive while the PC thinks');
    assert.equal(l.answer('aaaaaaaaaaaa', 'not asked'), false, 'only answers to questions that were asked');
    assert.deepEqual(l.status().counts, { asked: 1, answered: 1 });
  } finally { l.stop(); await s.app.close(); }
});

test('T-SRV-006 a wrong home token never connects, and the server counts it', async () => {
  const s = await start();
  const l = new Link();
  try {
    const st = await connect(l, s.ws, 'wrong_' + 'c'.repeat(30));
    assert.equal(st.state, 'retrying'); assert.equal(st.error, 'UNREACHABLE');
    assert.equal(s.app.status().home.connected, false);
    assert.equal(s.app.status().counts.authRejected, 1);
  } finally { l.stop(); await s.app.close(); }
});

test('T-SRV-007 a second PC with the same token waits instead of knocking the first one off', async () => {
  const s = await start();
  const a = new Link(), b = new Link();
  try {
    assert.equal((await connect(a, s.ws)).state, 'on');
    const st = await new Promise(resolve => { b.on('state', x => { if (x.state === 'retrying') resolve(x); }); b.configure({ url: s.ws, token: TOKEN }); });
    assert.equal(st.error, 'BUSY');
    assert.equal(a.status().state, 'on');
    assert.equal(s.app.status().home.counts.refused, 1);
  } finally { a.stop(); b.stop(); await s.app.close(); }
});

test('T-SRV-008 a PC that does not answer in time gets a polite timeout on the lens', async () => {
  const s = await start({ home: new Home({ timeoutMs: 200 }) });
  const l = new Link();
  try {
    await connect(l, s.ws);
    const ev = events(await (await ask(s, req('거실에 누가 있어?'))).text());
    assert.equal(ev[0].answer_stream, lz.SAY.TIMEOUT.ko);
    assert.equal(s.app.status().home.counts.timeouts, 1);
  } finally { l.stop(); await s.app.close(); }
});

test('T-SRV-009 repeated wrong keys from one address are blocked for a while', async () => {
  let t = 1_000_000;
  const s = await start({ now: () => t });
  try {
    for (let i = 0; i < GUARD.fails; i++) assert.equal((await ask(s, req('hi'), 'bad-key-0123456789abc')).status, 401);
    assert.equal((await ask(s, req('hi'))).status, 429, 'even the right key waits out the block');
    t += GUARD.blockMs + 1;
    assert.equal((await ask(s, req('hi'))).status, 200);
  } finally { await s.app.close(); }
});

test('T-SRV-010 a retried request is not asked twice, and photo-only questions get an explanation', async () => {
  const s = await start();
  const l = new Link();
  try {
    await connect(l, s.ws);
    let asks = 0;
    l.on('ask', q => { asks++; setTimeout(() => l.answer(q.id, '네.'), 50); });
    const body = req('불 켜져 있어?');
    const [x, y] = await Promise.all([ask(s, body), ask(s, body)]);
    assert.equal(events(await x.text())[0].answer_stream, '네.');
    assert.equal(events(await y.text())[0].answer_stream, '네.');
    assert.equal(asks, 1);
    const photo = JSON.stringify({ message_id: 'p1', agent_id: 'agent-1', message: [{ role: 'user', type: 'image', text: '', image_url: 'https://example.com/a.jpg' }], metadata: { language: 'zh-CN' } });
    assert.equal(events(await (await ask(s, photo)).text())[0].answer_stream, lz.SAY.PHOTO.zh);
    assert.equal(asks, 1, 'no picture is fetched or forwarded');
  } finally { l.stop(); await s.app.close(); }
});

test('T-LNK-001 the desktop link accepts only safe addresses and token shapes', () => {
  assert.equal(linkUrl('wss://agent.wavrel.com'), 'wss://agent.wavrel.com/link');
  assert.equal(linkUrl('wss://agent.wavrel.com/link'), 'wss://agent.wavrel.com/link');
  assert.equal(linkUrl('ws://127.0.0.1:8080/link'), 'ws://127.0.0.1:8080/link');
  for (const bad of ['ws://agent.wavrel.com/link', 'https://agent.wavrel.com', 'wss://u:p@agent.wavrel.com/link', 'wss://agent.wavrel.com/link?token=x', 'wss://agent.wavrel.com/link#x', '', 'nonsense', 'ws://192.168.0.10/link'])
    assert.equal(linkUrl(bad), null, bad);
  assert.equal(validToken('a'.repeat(43)), true);
  assert.equal(validToken('short'), false);
  assert.equal(validToken('has space ' + 'a'.repeat(20)), false);
  const l = new Link();
  assert.equal(l.configure({ url: 'ws://example.com/link', token: TOKEN }).state, 'off', 'refused URL never connects');
});
