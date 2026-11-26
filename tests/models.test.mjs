// 로컬 모델 연결(desktop/main/models.mjs) 자동 시험. Ollama 대신 같은 API를 흉내 내는 작은 HTTP 서버에 붙습니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Models, serverUrl, validModelName, describeModel, readAnswer } from '../desktop/main/models.mjs';

/** Ollama의 /api/tags, /api/chat만 흉내 내는 서버. handler로 응답을 바꿉니다. */
async function fakeOllama(handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const j = body ? JSON.parse(body) : null; seen.push({ method: req.method, url: req.url, body: j });
      const out = handler(req, j, seen.length) || { status: 404, body: { error: 'not found' } };
      const send = () => { res.writeHead(out.status || 200, { 'content-type': 'application/json' }); res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body)); };
      out.delay ? setTimeout(send, out.delay) : send();
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

const TAGS = { models: [
  { name: 'nemotron-mini:4b', size: 2_700_000_000, details: { family: 'nemotron', parameter_size: '4B', quantization_level: 'Q4_K_M' } },
  { name: 'muse-glimmer:30b', size: 18_000_000_000, details: { family: 'muse', parameter_size: '30B', quantization_level: 'Q4_K_M' } },
  { name: '../../etc/passwd', size: 1 },
] };
const chat = text => ({ body: { message: { role: 'assistant', content: text }, eval_count: 40, eval_duration: 2e9, load_duration: 5e8, done: true } });

test('T-MOD-001 모델 서버 주소는 이 PC와 집 안 망의 http 주소만 받는다', () => {
  for (const [raw, want] of [['http://127.0.0.1:11434', 'http://127.0.0.1:11434'], ['http://localhost:11434/', 'http://localhost:11434'],
    ['http://192.168.0.20:11434', 'http://192.168.0.20:11434'], ['http://[::1]:11434', 'http://[::1]:11434']]) assert.equal(serverUrl(raw), want, raw);
  for (const raw of ['https://127.0.0.1:11434', 'http://8.8.8.8:11434', 'http://ollama.example.com', 'http://my-pc.local:11434',
    'http://user:pw@127.0.0.1:11434', 'http://127.0.0.1:11434/api', 'http://127.0.0.1:11434/?x=1', 'file:///etc/passwd', '', null]) assert.equal(serverUrl(raw), null, String(raw));
});

test('T-MOD-002 설치된 모델 목록을 읽고, 이상한 이름은 버린다', async () => {
  const s = await fakeOllama(req => (req.url === '/api/tags' ? { body: TAGS } : null));
  const r = await new Models({ url: s.url }).list();
  assert.equal(r.ok, true);
  assert.deepEqual(r.models.map(m => m.name), ['nemotron-mini:4b', 'muse-glimmer:30b']);
  assert.deepEqual(r.models[0], { name: 'nemotron-mini:4b', size: 2_700_000_000, family: 'nemotron', params: '4B', quant: 'Q4_K_M' });
  assert.equal(validModelName('a/b:1'), true); assert.equal(validModelName('a/../b'), false); assert.equal(describeModel({}), null);
  await s.close();
});

test('T-MOD-003 서버가 꺼져 있으면 NOT_RUNNING을 알린다', async () => {
  const s = await fakeOllama(() => null); const url = s.url; await s.close();
  const r = await new Models({ url }).list();
  assert.deepEqual([r.ok, r.error, r.models.length], [false, 'NOT_RUNNING', 0]);
});

test('T-MOD-004 질문을 보내고 답, 걸린 시간, 초당 토큰을 돌려준다', async () => {
  const s = await fakeOllama((req, j) => (req.url === '/api/chat' ? chat('  거실에 움직임이 있습니다.  ') : null));
  let t = 1000; const m = new Models({ url: s.url, now: () => (t += 250) });
  const r = await m.ask({ model: 'nemotron-mini:4b', prompt: '요약해 줘', system: '짧게', maxTokens: 64 });
  assert.deepEqual(r, { ok: true, text: '거실에 움직임이 있습니다.', ms: 250, tokens: 40, tokensPerSec: 20, loadMs: 500 });
  const sent = s.seen[0].body;
  assert.equal(sent.stream, false); assert.equal(sent.model, 'nemotron-mini:4b'); assert.equal(sent.options.num_predict, 64);
  assert.deepEqual(sent.messages, [{ role: 'system', content: '짧게' }, { role: 'user', content: '요약해 줘' }]);
  await s.close();
});

test('T-MOD-005 잘못된 모델 이름, 빈 질문, 너무 긴 질문은 서버에 보내지 않는다', async () => {
  const s = await fakeOllama(() => chat('x'));
  const m = new Models({ url: s.url });
  assert.equal((await m.ask({ model: '../x', prompt: 'hi' })).error, 'BAD_MODEL');
  assert.equal((await m.ask({ model: 'a', prompt: '   ' })).error, 'BAD_PROMPT');
  assert.equal((await m.ask({ model: 'a', prompt: 'x'.repeat(8001) })).error, 'BAD_PROMPT');
  assert.equal((await m.ask({ model: 'a', prompt: 'hi', system: {} })).error, 'BAD_PROMPT');
  assert.equal(s.seen.length, 0);
  await s.close();
});

test('T-MOD-006 질문은 한 번에 하나씩 차례로 처리한다', async () => {
  let active = 0, peak = 0;
  const s = await fakeOllama(() => { active++; peak = Math.max(peak, active); return { ...chat('ok'), delay: 60 }; });
  const orig = s.seen; const m = new Models({ url: s.url });
  const wrap = m.fetch; m.fetch = async (...a) => { const r = await wrap(...a); active--; return r; };
  const out = await Promise.all([m.ask({ model: 'a', prompt: '1' }), m.ask({ model: 'b', prompt: '2' }), m.ask({ model: 'c', prompt: '3' })]);
  assert.deepEqual(out.map(o => o.ok), [true, true, true]);
  assert.equal(peak, 1); assert.deepEqual(orig.map(x => x.body.model), ['a', 'b', 'c']);
  await s.close();
});

test('T-MOD-007 없는 모델과 이상한 응답을 구분해서 알린다', async () => {
  const s = await fakeOllama((req, j) => (j.model === 'missing' ? { status: 404, body: { error: "model 'missing' not found" } } : { body: '<html>' }));
  const m = new Models({ url: s.url });
  const a = await m.ask({ model: 'missing', prompt: 'hi' });
  assert.deepEqual([a.ok, a.error, a.detail], [false, 'NO_SUCH_MODEL', "model 'missing' not found"]);
  assert.equal((await m.ask({ model: 'other', prompt: 'hi' })).error, 'BAD_RESPONSE');
  assert.deepEqual(readAnswer({}, 1), { ok: false, error: 'BAD_RESPONSE' });
  assert.equal(m.setUrl('http://example.com'), false); assert.equal(m.url, s.url);
  await s.close();
});
