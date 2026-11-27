// Project lab: one JSON file per project in projects/, plus projects/parts.json.
// This script checks them and writes what the app and the website read:
//   console/js/projects-data.js      the Projects view in the app and the demo
//   web/projects/index.html          wavrel.com/projects/ (Korean)
//   web/en/projects/index.html       wavrel.com/en/projects/ (English)
//
//   node tools/projects.mjs           write the three files
//   node tools/projects.mjs --check   exit 1 if they are out of date (CI and tests)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'projects');

export const VIEWS = ['space', 'motion', 'presence', 'camera', 'rules', 'models', 'nodes', 'evidence', 'glass'];
export const STATUS = ['OPERATOR_REQUIRED', 'HARDWARE_VERIFIED'];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(file, msg) { throw new Error(`projects/${file}: ${msg}`); }
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>]/.test(v);
const pair = (v, max) => v && text(v.ko, max) && text(v.en, max);
const lists = (v, max) => v && Array.isArray(v.ko) && Array.isArray(v.en) && v.ko.length > 0 && v.ko.length === v.en.length && v.ko.length <= 8 && [...v.ko, ...v.en].every(t => text(t, max));

export const WHEN = ['motion', 'enter', 'quiet'];
export const THEN = ['led', 'notify'];
const NAME = /^(\*|[A-Za-z0-9_-]{1,40})$/;

/** What "Set up for this project" may change: turn on or add rules, and two model switches. */
function checkSetup(file, s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail(file, 'setup must be an object');
  for (const k of Object.keys(s)) if (!['rules', 'models', 'open'].includes(k)) fail(file, `setup has an unknown key ${k}`);
  if (s.open !== undefined && !VIEWS.includes(s.open)) fail(file, 'setup.open must be a screen');
  if (s.models !== undefined) {
    if (!s.models || typeof s.models !== 'object') fail(file, 'setup.models must be an object');
    for (const [k, v] of Object.entries(s.models)) if (!['glass', 'gcam'].includes(k) || v !== true) fail(file, 'setup.models may only turn on glass or gcam');
  }
  if (s.rules !== undefined) {
    if (!Array.isArray(s.rules) || s.rules.length > 5) fail(file, 'setup.rules must be a list of up to 5 rules');
    for (const r of s.rules) {
      const w = r && r.when, t = r && r.then;
      if (!w || !WHEN.includes(w.t)) fail(file, `rule when.t must be one of ${WHEN.join(', ')}`);
      if (w.t === 'enter' ? !NAME.test(w.room || '') || w.room === '*' : !NAME.test(w.node || '')) fail(file, 'rule needs a node (motion, quiet) or a room (enter)');
      if (w.t === 'quiet' && !(Number.isInteger(w.sec) && w.sec >= 10 && w.sec <= 3600)) fail(file, 'quiet rule needs sec 10 to 3600');
      if (!t || !THEN.includes(t.t)) fail(file, `rule then.t must be one of ${THEN.join(', ')}`);
      if (t.t === 'led' && (!/^#[0-9a-f]{6}$/i.test(t.color || '') || !(Number.isInteger(t.sec) && t.sec >= 1 && t.sec <= 60))) fail(file, 'led rule needs a #rrggbb color and sec 1 to 60');
      if (t.t === 'notify' && !['info', 'alert'].includes(t.level)) fail(file, 'notify rule needs level info or alert');
    }
  }
}

/** Reads and checks every project. Throws with the file name and the first problem found. */
export const evidenceDir = path.join(root, 'evidence');
const MACLIKE = /([0-9a-f]{2}[:-]){5}[0-9a-f]{2}|\b\d{1,3}(\.\d{1,3}){3}\b/i;

/** A hardware check exported from the app (evidence/EVD-YYYYMMDD-<project>.json). */
function checkEvidence(file, p, evDir) {
  if (!/^EVD-\d{8}-[a-z0-9-]+$/.test(p.evidence || '')) fail(file, 'HARDWARE_VERIFIED needs an evidence id (EVD-YYYYMMDD-<project>)');
  const ef = path.join(evDir, `${p.evidence}.json`);
  if (!fs.existsSync(ef)) fail(file, `evidence/${p.evidence}.json is missing`);
  const e = JSON.parse(fs.readFileSync(ef, 'utf8'));
  if (e.v !== 1 || e.id !== p.evidence || e.project !== p.id) fail(file, 'the evidence file is for another project');
  if (e.source !== 'live') fail(file, 'evidence must come from a real board, not the simulator');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) fail(file, 'evidence needs a date');
  if (!Array.isArray(e.criteria) || e.criteria.length !== p.success.ko.length || e.criteria.some(c => c.result !== 'pass')) fail(file, 'every success criterion must have passed');
  if (typeof e.note === 'string' && (e.note.length > 400 || MACLIKE.test(e.note))) fail(file, 'the evidence note must not hold addresses');
  return e;
}

export function load(from = dir, evDir = evidenceDir) {
  const parts = JSON.parse(fs.readFileSync(path.join(from, 'parts.json'), 'utf8'));
  for (const [id, p] of Object.entries(parts)) if (!ID.test(id) || !pair(p, 80)) fail('parts.json', `bad part ${id}`);
  const projects = [];
  for (const file of fs.readdirSync(from).filter(f => f.endsWith('.json') && f !== 'parts.json').sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(from, file), 'utf8'));
    if (!ID.test(p.id || '')) fail(file, 'id must be lowercase words joined by hyphens');
    if (!file.endsWith(`-${p.id}.json`)) fail(file, 'file name must be <order>-<id>.json');
    if (!Number.isInteger(p.order) || p.order < 1) fail(file, 'order must be a positive whole number');
    if (![1, 2, 3].includes(p.level)) fail(file, 'level must be 1, 2 or 3');
    if (!Number.isInteger(p.minutes) || p.minutes < 5 || p.minutes > 600) fail(file, 'minutes must be 5 to 600');
    if (typeof p.demo !== 'boolean') fail(file, 'demo must be true or false');
    if (!STATUS.includes(p.status)) fail(file, `status must be one of ${STATUS.join(', ')}`);
    if (p.status === 'HARDWARE_VERIFIED') p.verified = checkEvidence(file, p, evDir).date;
    if (p.start !== undefined && p.start !== true) fail(file, 'start, if present, must be true');
    if (!pair(p.title, 60)) fail(file, 'title needs ko and en, up to 60 characters');
    if (!pair(p.summary, 400)) fail(file, 'summary needs ko and en, up to 400 characters');
    if (!lists(p.learn, 120)) fail(file, 'learn needs matching ko and en lists');
    if (!lists(p.success, 120)) fail(file, 'success needs matching ko and en lists');
    if (!Array.isArray(p.parts) || !p.parts.length || p.parts.some(id => !parts[id])) fail(file, 'parts must name entries in parts.json');
    if (!Array.isArray(p.firmware) || p.firmware.some(f => !text(f.name, 60) || !/^https:\/\/[^\s"'<>]+$/.test(f.url || ''))) fail(file, 'firmware entries need a name and an https URL');
    if (!Array.isArray(p.steps) || p.steps.length < 2 || p.steps.length > 10) fail(file, 'steps must have 2 to 10 entries');
    for (const s of p.steps) {
      if (!pair(s, 240)) fail(file, 'each step needs ko and en, up to 240 characters');
      if (s.view !== undefined && !VIEWS.includes(s.view)) fail(file, `step view must be one of ${VIEWS.join(', ')}`);
    }
    if (p.setup !== undefined) checkSetup(file, p.setup);
    if (projects.some(q => q.id === p.id || q.order === p.order)) fail(file, 'id and order must be unique');
    projects.push(p);
  }
  projects.sort((a, b) => a.order - b.order);
  return { projects, parts };
}

export function renderData({ projects, parts }) {
  return '/* Generated by tools/projects.mjs from projects/*.json. Edit those files, then run the script. */\n'
    + `window.PROJECTS=Object.freeze(${JSON.stringify(projects)});\nwindow.PARTS=Object.freeze(${JSON.stringify(parts)});\n`;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  ko: {
    title: 'Wavrel 프로젝트: 센서, 모델, 안경으로 만들어 보기',
    desc: 'ESP32 보드, 공개 모델, 스마트 안경을 엮은 Wavrel 예제 프로젝트. 부품, 펌웨어, 순서, 성공 기준을 한 장에 정리했습니다.',
    h1: '프로젝트로 배우기',
    lede: '하나씩 따라 하면 보드에서 렌즈까지 이어지는 작은 실험입니다. 앱의 프로젝트 화면에서도 같은 순서로 체크하며 진행할 수 있습니다.',
    setup: "앱의 '이 프로젝트에 맞추기'가 하는 일",
    level: ['', '쉬움', '보통', '도전'], min: m => `약 ${m}분`, demo: '데모로 먼저 보기', learn: '배우는 것', parts: '부품', fw: '펌웨어와 도구', steps: '순서', success: '성공 기준',
    status: { OPERATOR_REQUIRED: '실기 검증 전', HARDWARE_VERIFIED: '실기 검증됨' },
    addH: '프로젝트 더하기', add: '프로젝트는 저장소의 projects 폴더에 JSON 파일 하나로 들어갑니다. 형식과 검사 방법은 안내 문서에 있고, 풀 리퀘스트로 보내 주시면 됩니다.', addLink: '프로젝트 추가 안내',
    nav: ['데모', '받기', '프로젝트'], other: ['/en/projects/', 'English', 'en'], home: '/', homeLabel: 'Wavrel 처음 화면', skip: '본문으로 건너뛰기', navLabel: '사이트', footLabel: '바닥글', privacy: '개인정보 처리방침',
    foot: 'Wavrel은 MIT 라이선스 오픈소스입니다.', demoUrl: '/demo/?lang=ko',
  },
  en: {
    title: 'Wavrel projects: build with sensors, models and glasses',
    desc: 'Example Wavrel projects that combine ESP32 boards, open models and smart glasses, with parts, firmware, steps and what success looks like.',
    h1: 'Learn by building',
    lede: 'Small experiments that run from a board to a lens, one step at a time. The Projects view in the app follows the same steps with a checklist.',
    setup: "What 'Set up for this project' does in the app",
    level: ['', 'Easy', 'Medium', 'Challenging'], min: m => `About ${m} min`, demo: 'Try it in the demo first', learn: 'What you learn', parts: 'Parts', fw: 'Firmware and tools', steps: 'Steps', success: 'It works when',
    status: { OPERATOR_REQUIRED: 'Not yet checked on hardware', HARDWARE_VERIFIED: 'Checked on hardware' },
    addH: 'Add a project', add: 'A project is one JSON file in the repository\'s projects folder. The guide explains the format and the check; send it as a pull request.', addLink: 'How to add a project',
    nav: ['Demo', 'Get it', 'Projects'], other: ['/projects/', '한국어', 'ko'], home: '/en/', homeLabel: 'Wavrel home', skip: 'Skip to content', navLabel: 'Site', footLabel: 'Footer', privacy: 'Privacy policy',
    foot: 'Wavrel is open source under the MIT license.', demoUrl: '/demo/?lang=en',
  },
};

/** One line per change, in the same words the app uses. */
export function describeSetup(s, lang) {
  const ko = lang === 'ko', out = [];
  const when = w => w.t === 'motion' ? (ko ? (w.node === '*' ? '어느 노드든 움직임이 있으면' : `${w.node}에 움직임이 있으면`) : (w.node === '*' ? 'motion on any node' : `motion on ${w.node}`))
    : w.t === 'enter' ? (ko ? `${w.room}에 들어오면` : `someone enters ${w.room}`) : (ko ? `${w.sec}초 동안 조용하면` : `${w.sec} s of quiet`);
  const then = t => t.t === 'led' ? (ko ? `LED를 ${t.color}로 ${t.sec}초` : `LED ${t.color} for ${t.sec} s`) : (ko ? (t.level === 'alert' ? '경고 알림' : '알림') : (t.level === 'alert' ? 'an alert' : 'a notice'));
  for (const r of s.rules || []) out.push(ko ? `규칙 켜기: ${when(r.when)} → ${then(r.then)}` : `Turn on the rule: ${when(r.when)} → ${then(r.then)}`);
  if (s.models && s.models.glass) out.push(ko ? "'휴대폰·안경 질문에 답하기' 켜기" : "Turn on 'Answer questions from phone and glasses'");
  if (s.models && s.models.gcam) out.push(ko ? "'안경 질문에도 카메라 사진을 함께 보내기' 켜기" : "Turn on 'Send a camera picture with questions from the glasses too'");
  out.push(ko ? '다른 규칙과 설정은 건드리지 않고, 되돌리기로 원래대로 돌아갑니다' : 'Nothing else changes, and Undo puts it back');
  return out;
}

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="3.2" fill="#ecb955"/><path d="M6 10.5a7.5 7.5 0 0 1 7.5 7.5M6 5.5A12.5 12.5 0 0 1 18.5 18" fill="none" stroke="#9cc6ff" stroke-width="2.2" stroke-linecap="round"/></svg>';

export function renderPage({ projects, parts }, lang) {
  const c = COPY[lang], self = lang === 'ko' ? 'https://wavrel.com/projects/' : 'https://wavrel.com/en/projects/';
  const li = a => a.map(t => `<li>${esc(t)}</li>`).join('');
  const cards = projects.map((p, i) => `
      <article class="proj" id="${p.id}" aria-labelledby="${p.id}-t">
        <header>
          <p class="num">${String(i + 1).padStart(2, '0')}</p>
          <h2 id="${p.id}-t">${esc(p.title[lang])}</h2>
          <p class="meta"><span class="state">${c.level[p.level]}</span><span class="state">${c.min(p.minutes)}</span><span class="state">${p.status === 'HARDWARE_VERIFIED' ? `<a href="https://github.com/pengveloper/wavrel/blob/main/evidence/${p.evidence}.json">${c.status[p.status]} · ${p.verified}</a>` : c.status[p.status]}</span></p>
          <p class="sum">${esc(p.summary[lang])}</p>
          ${p.demo ? `<p><a href="${c.demoUrl}#projects">${c.demo}</a></p>` : ''}
        </header>
        <div class="cols3">
          <section><h3>${c.learn}</h3><ul class="dots">${li(p.learn[lang])}</ul>
            <h3>${c.parts}</h3><ul class="dots">${li(p.parts.map(id => parts[id][lang]))}</ul>
            <h3>${c.fw}</h3><ul class="dots">${p.firmware.map(f => `<li><a href="${esc(f.url)}">${esc(f.name)}</a></li>`).join('')}</ul></section>
          <section><h3>${c.steps}</h3><ol class="steps">${li(p.steps.map(s => s[lang]))}</ol></section>
          <section><h3>${c.success}</h3><ul class="dots ok">${li(p.success[lang])}</ul>
            ${p.setup ? `<h3>${c.setup}</h3><ul class="dots">${li(describeSetup(p.setup, lang))}</ul>` : ''}</section>
        </div>
      </article>`).join('');
  const navHref = [c.demoUrl, `${c.home}#get`, lang === 'ko' ? '/projects/' : '/en/projects/'];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.desc)}">
<link rel="canonical" href="${self}">
<link rel="alternate" hreflang="ko" href="https://wavrel.com/projects/">
<link rel="alternate" hreflang="en" href="https://wavrel.com/en/projects/">
<link rel="alternate" hreflang="x-default" href="https://wavrel.com/en/projects/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wavrel">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.desc)}">
<meta property="og:url" content="${self}">
<meta property="og:image" content="https://wavrel.com/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#05080d">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/img/icon.png" type="image/png">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/site.css">
</head>
<body>
<!-- Generated by tools/projects.mjs from projects/*.json. -->
<a class="skip" href="#main">${c.skip}</a>
<header class="site">
  <div class="wrap">
    <a class="brand" href="${c.home}" aria-label="${c.homeLabel}">${ICON}Wavrel</a>
    <nav class="nav" aria-label="${c.navLabel}">
      <a class="opt" href="${navHref[0]}">${c.nav[0]}</a>
      <a class="opt" href="${navHref[1]}">${c.nav[1]}</a>
      <a class="opt" href="${navHref[2]}" aria-current="page">${c.nav[2]}</a>
      <a class="lang" href="${c.other[0]}" hreflang="${c.other[2]}" lang="${c.other[2]}">${c.other[1]}</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap">
      <h1 id="hero-title">${c.h1}</h1>
      <p class="lede">${c.lede}</p>
    </div>
  </section>
  <div class="wrap projlist">${cards}
  </div>
  <section class="sec" aria-labelledby="add-title">
    <div class="wrap">
      <h2 id="add-title">${c.addH}</h2>
      <p class="intro">${c.add}</p>
      <p class="intro"><a class="btn" href="https://github.com/pengveloper/wavrel/blob/main/projects/README.md">${c.addLink}</a></p>
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <div>
      <p>${c.foot}</p>
      <p>© 2026 pengveloper</p>
    </div>
    <nav aria-label="${c.footLabel}">
      <a href="/privacy/">${c.privacy}</a>
      <a href="https://github.com/pengveloper/wavrel">GitHub</a>
      <a href="${c.other[0]}" hreflang="${c.other[2]}" lang="${c.other[2]}">${c.other[1]}</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;
}

export function outputs(data = load()) {
  return {
    'console/js/projects-data.js': renderData(data),
    'web/projects/index.html': renderPage(data, 'ko'),
    'web/en/projects/index.html': renderPage(data, 'en'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [rel, body] of Object.entries(outputs())) {
    const file = path.join(root, rel);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (now === body) continue;
    if (check) { console.error(`out of date: ${rel} (run node tools/projects.mjs)`); stale++; }
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); console.log(`wrote ${rel}`); }
  }
  process.exitCode = stale ? 1 : 0;
}
