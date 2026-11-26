// Rokid's custom-agent interface (the Lingzhu platform, rizon.rokid.com).
// The platform POSTs what the glasses heard and reads the answer back as Server-Sent Events.
// Field names follow the platform's public examples; the request also carries the wearer's
// location, weather and battery, which this server never reads, stores or forwards.

export const LIMITS = Object.freeze({ body: 65_536, question: 300, answer: 400, id: 64 });

const ID = /^[A-Za-z0-9._:-]{1,64}$/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const KANA = /[぀-ヿ]/;
const HAN = /[㐀-鿿]/;

const clean = s => String(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => { const a = Array.from(s); return a.length > n ? a.slice(0, n - 1).join('') + '…' : s; };

/** ko, zh or en: the script of the question first, then the language the glasses report. */
export function pickLang(text, reported) {
  if (HANGUL.test(text)) return 'ko';
  if (HAN.test(text) && !KANA.test(text)) return 'zh';
  const r = String(reported || '').toLowerCase();
  if (r.startsWith('ko')) return 'ko';
  if (r.startsWith('zh')) return 'zh';
  return 'en';
}

/**
 * Reads one request body. Returns { ok: true, messageId, agentId, question, lang, photo } or
 * { ok: false, error }. Only the newest text the wearer said is kept; earlier turns, pictures
 * and every metadata field except the language are dropped here.
 */
export function parseRequest(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, error: 'EMPTY' };
  if (Buffer.byteLength(raw) > LIMITS.body) return { ok: false, error: 'TOO_LARGE' };
  let j;
  try { j = JSON.parse(raw); } catch { return { ok: false, error: 'BAD_JSON' }; }
  if (!j || typeof j !== 'object') return { ok: false, error: 'BAD_JSON' };
  const messageId = typeof j.message_id === 'string' || typeof j.message_id === 'number' ? String(j.message_id) : '';
  const agentId = typeof j.agent_id === 'string' ? j.agent_id : '';
  if (!ID.test(messageId) || !ID.test(agentId)) return { ok: false, error: 'BAD_ID' };
  const turns = Array.isArray(j.message) ? j.message.slice(-20) : [];
  let text = '', photo = false;
  for (let i = turns.length - 1; i >= 0; i--) {
    const m = turns[i];
    if (!m || typeof m !== 'object' || m.role !== 'user') continue;
    if (m.type === 'image' || m.image_url) photo = true;
    if (typeof m.text === 'string' && clean(m.text)) { text = clean(m.text); break; }
  }
  const reported = j.metadata && typeof j.metadata === 'object' && typeof j.metadata.language === 'string' ? j.metadata.language.slice(0, 16) : '';
  return { ok: true, messageId, agentId, question: cut(text, LIMITS.question), lang: pickLang(text, reported), photo };
}

/** One SSE event. The platform expects the event line before the data line. */
export function event(messageId, agentId, answer, finish) {
  const data = { role: 'agent', type: 'answer', answer_stream: answer, message_id: messageId, agent_id: agentId, is_finish: !!finish };
  return `event:message\ndata:${JSON.stringify(data)}\n\n`;
}

export const KEEPALIVE = ': keepalive\n\n';

/** The answer, then the empty closing event the platform waits for. */
export function answer(messageId, agentId, text) {
  const body = cut(clean(text), LIMITS.answer) || '…';
  return event(messageId, agentId, body, false) + event(messageId, agentId, '', true);
}

export const HEADERS = Object.freeze({
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  'x-accel-buffering': 'no',
  'x-content-type-options': 'nosniff',
});

/** What the glasses show when the home PC cannot answer. */
export const SAY = Object.freeze({
  NO_HOME: { ko: '집의 Wavrel PC가 연결되어 있지 않습니다.', en: 'The Wavrel PC at home is not connected.', zh: '家里的 Wavrel 电脑没有连接。' },
  TIMEOUT: { ko: 'PC가 제때 답하지 못했습니다. 다시 물어 주세요.', en: 'The PC did not answer in time. Please ask again.', zh: '电脑没有及时回答，请再问一次。' },
  BUSY: { ko: '앞의 질문에 답하는 중입니다. 잠시 뒤에 물어 주세요.', en: 'Still answering the last question. Ask again in a moment.', zh: '正在回答上一个问题，请稍后再问。' },
  EMPTY: { ko: '질문을 듣지 못했습니다.', en: 'I did not catch a question.', zh: '没有听到问题。' },
  PHOTO: { ko: '사진 질문은 아직 받지 않습니다. 말로 물어 주세요.', en: 'Photo questions are not supported yet. Please ask out loud.', zh: '暂不支持图片提问，请用语音提问。' },
});
