// 화면 언어 자동 시험:  npm test  (또는 node --test tests/i18n.test.mjs)
// 콘솔의 모든 한국어 문장에 영어 문장이 있는지, 그 문장이 자리표와 마크업을 지키는지 소스에서 직접 확인합니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanAll, dictionary, shapeProblems } from '../tools/i18n-scan.mjs';

const read = f => readFileSync(fileURLToPath(new URL('../console/js/' + f, import.meta.url)), 'utf8');
function load(language, search = '', saved = null) {
  const store = new Map(saved ? [['sentinel-lab-lang', saved]] : []);
  const ctx = { navigator: { language }, location: { search, href: 'app://sentinel/index.html' + search, reload() { ctx.reloaded = true; } }, URLSearchParams, URL, history: { replaceState() {} },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('i18n-en.js') + '\n' + read('i18n.js'), ctx);
  return { L: ctx.L, I18N: ctx.I18N, store, ctx };
}

test('T-I18N-001 콘솔의 모든 한국어 문장에 영어 문장이 있고, 표시가 붙지 않은 한국어 문장이 없다', () => {
  const { perFile, keys } = scanAll(), en = dictionary();
  const untagged = Object.entries(perFile).flatMap(([f, r]) => r.untagged.map(u => f + ': ' + u.key.slice(0, 60)));
  const logic = Object.entries(perFile).flatMap(([f, r]) => r.odd.map(u => f + ': ' + u.key.slice(0, 60)));
  assert.deepEqual(untagged, [], 'every Korean literal goes through L');
  assert.deepEqual(logic, [], 'no program logic depends on a displayed Korean string');
  assert.deepEqual([...keys.keys()].filter(k => !(k in en)), [], 'every key has an English sentence');
  assert.ok(keys.size > 400);
});

test('T-I18N-002 영어 문장은 원문의 자리표와 마크업을 그대로 지닌다', () => {
  const { keys } = scanAll(), en = dictionary();
  const bad = [...keys.keys()].flatMap(k => shapeProblems(k, en[k] ?? '').map(p => p + ': ' + k.slice(0, 60)));
  assert.deepEqual(bad, []);
});

test('T-I18N-003 언어는 주소, 저장한 선택, 기기 언어 순으로 정해지고, 자리표는 영어 어순에 맞게 옮겨진다', () => {
  assert.equal(load('ko-KR').I18N.lang, 'ko'); assert.equal(load('en-US').I18N.lang, 'en'); assert.equal(load('de-DE').I18N.lang, 'en');
  assert.equal(load('en-US', '', 'ko').I18N.lang, 'ko'); assert.equal(load('ko-KR', '?lang=en').I18N.lang, 'en');
  const ko = load('ko-KR'), en = load('en-US');
  assert.equal(ko.L`${7}단계 중 ${3}단계`, '7단계 중 3단계'); assert.equal(en.L`${7}단계 중 ${3}단계`, '3 of 7 steps');
  assert.equal(en.L('조용함'), 'Quiet'); assert.equal(ko.L('조용함'), '조용함');
  assert.equal(en.L`사전에 없는 문장 ${1}`, '사전에 없는 문장 1'); assert.deepEqual([...en.I18N.missing], ['사전에 없는 문장 {0}'], '없는 문장은 원문을 보여 주고 따로 적어 둔다');
  en.I18N.set('ko'); assert.equal(en.store.get('sentinel-lab-lang'), 'ko'); assert.equal(en.ctx.reloaded, true);
});

test('T-I18N-004 기본으로 붙은 이름은 화면 언어를 따라가고, 직접 지은 이름은 그대로 둔다', () => {
  const ko = load('ko-KR').I18N, en = load('en-US').I18N;
  assert.equal(en.alias('카메라'), 'Camera'); assert.equal(ko.alias('Camera'), '카메라'); assert.equal(ko.alias('Living room'), '거실');
  assert.equal(en.alias('우리집 현관 센서'), '우리집 현관 센서'); assert.equal(ko.alias('Front door'), 'Front door'); assert.equal(en.alias('CSI a1b2'), 'CSI a1b2');
});
